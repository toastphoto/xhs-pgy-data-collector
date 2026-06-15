const { app, BrowserWindow, BrowserView, ipcMain, shell, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const { applyTransform } = require('./lib/transform');
const XLSX = require('xlsx');
let ExcelJS = null;
try {
  // 仅用于“媒介资源表”美化导出（列宽/冻结/表头样式等）
  ExcelJS = require('exceljs');
} catch (_) {
  ExcelJS = null;
}
const { extractFromTemplate } = require('./lib/extract_dom');
const { saveEvidence, safeName } = require('./lib/evidence');
const { TaskRunner } = require('./lib/task_runner');
const { buildQualityReport } = require('./lib/quality_report');
const { resolveInsideRoot, resolveInsideAny } = require('./lib/path_guard');
const { openDb, initDb, dbGet, dbAll } = require('./lib/db/sqlite');
const { syncRunsToDb } = require('./lib/db/import_runs');
const { chatDeepSeek, chatOpenAICompat, listModelsOpenAICompat } = require('./lib/ai/providers');
const { loadIndexFromDisk, rebuildKbFromDb, searchIndex } = require('./lib/kb/index');

let mainWindow = null;
let browserView = null;
let backendProc = null;
let taskRunner = null;
let dbInstance = null;
let dbInitPromise = null;
let aiLastSqlResult = null; // { sql, rows } for optional export
let kbCache = { loaded: false, index: null, meta: null };

let recordingEnabled = false;
let currentRecording = [];

const UI_WIDTH = 520;          // 左侧控制台默认宽度（renderer 可拖拽后动态更新）
const SPLITTER_WIDTH = 10;     // renderer 分割条宽度（px）
const TOPBAR_HEIGHT = 56;      // 顶部工具栏高度（与 renderer 里保持一致）
const DEFAULT_API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = '8010';

function getRecordingsDir() {
  const dir = path.join(app.getPath('userData'), 'recordings');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getTemplatesDir() {
  const dir = path.join(app.getPath('userData'), 'templates');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getRunsDir() {
  const dir = path.join(app.getPath('userData'), 'runs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getDbPath() {
  const dir = path.join(app.getPath('userData'), 'db');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'content_analyzer.sqlite');
}

async function getDb() {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;
  const dbPath = getDbPath();
  dbInitPromise = (async () => {
    const db = await openDb(dbPath);
    initDb(db);
    dbInstance = db;
    return db;
  })();
  return dbInitPromise;
}

function getAiConfigPath() {
  return path.join(app.getPath('userData'), 'ai_config.json');
}

function loadAiConfig() {
  const p = getAiConfigPath();
  if (!fs.existsSync(p)) {
    return {
      activeProvider: 'compat',
      deepseek: { apiKey: '', model: 'deepseek-chat' },
      compat: { baseUrl: 'https://ai.comfly.chat', apiKey: '', model: 'gpt-4o-mini' }
    };
  }
  try {
    const obj = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return {
      activeProvider: obj?.activeProvider || 'compat',
      deepseek: { apiKey: obj?.deepseek?.apiKey || '', model: obj?.deepseek?.model || 'deepseek-chat' },
      compat: {
        baseUrl: obj?.compat?.baseUrl || 'https://ai.comfly.chat',
        apiKey: obj?.compat?.apiKey || '',
        model: obj?.compat?.model || 'gpt-4o-mini'
      }
    };
  } catch (_) {
    return {
      activeProvider: 'compat',
      deepseek: { apiKey: '', model: 'deepseek-chat' },
      compat: { baseUrl: 'https://ai.comfly.chat', apiKey: '', model: 'gpt-4o-mini' }
    };
  }
}

function saveAiConfig(cfg) {
  const p = getAiConfigPath();
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8');
}

function getUserDataDir() {
  return app.getPath('userData');
}

function getKbIndex() {
  if (kbCache.loaded) return kbCache;
  const r = loadIndexFromDisk({ userDataDir: getUserDataDir() });
  kbCache = { loaded: true, index: r.index || null, meta: r.meta || null };
  return kbCache;
}

function setKbCacheFromDisk() {
  kbCache.loaded = false;
  return getKbIndex();
}

function resolveInsideRuns(maybePath) {
  return resolveInsideRoot(maybePath, getRunsDir());
}

function resolveInsideRecordings(maybePath) {
  return resolveInsideRoot(maybePath, getRecordingsDir());
}

function resolveInsideTemplates(maybePath) {
  return resolveInsideRoot(maybePath, getTemplatesDir());
}

function ensureDefaultTemplateInUserData() {
  try {
    const userDir = getTemplatesDir();
    const existing = fs.readdirSync(userDir).filter((f) => f.toLowerCase().endsWith('.json'));
    if (existing.length > 0) return;

    const bundled = path.join(__dirname, 'templates', 'default_pgy_v1.json');
    if (!fs.existsSync(bundled)) {
      console.warn('[template] 未找到内置默认模板：', bundled);
      return;
    }
    const dst = path.join(userDir, 'default_pgy_v1.json');
    fs.copyFileSync(bundled, dst);
    console.log('[template] 已初始化默认模板到 userData:', dst);
  } catch (err) {
    console.warn('[template] 初始化默认模板失败：', err);
  }
}

function buildWaitForSelectorJs(selector, timeoutMs) {
  return `
    (function(){
      const sel = ${JSON.stringify(String(selector || ''))};
      const end = Date.now() + ${Number(timeoutMs) || 0};
      return new Promise((resolve) => {
        const tick = () => {
          try {
            const el = document.querySelector(sel);
            if (el) return resolve(true);
          } catch (_) {}
          if (Date.now() > end) return resolve(false);
          setTimeout(tick, 200);
        };
        tick();
      });
    })()
  `;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeRunId() {
  return `run_${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

function buildClickTabByTextJs(tabText) {
  return `
    (function(){
      const wanted0 = ${JSON.stringify(String(tabText || ''))};
      const wanted = wanted0.replace(/\\s+/g, '').trim();
      if (!wanted) return { ok: false, reason: 'empty_tab_text' };

      const isVisible = (el) => {
        try {
          const r = el.getBoundingClientRect();
          if (!r || r.width <= 0 || r.height <= 0) return false;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
          return true;
        } catch (_) { return true; }
      };

      const norm = (s) => String(s || '').replace(/\\s+/g, '').trim();
      const score = (el) => {
        const t = norm(el.textContent || '');
        if (!t) return -1;
        if (t === wanted) return 100;
        if (t.includes(wanted)) return 80;
        return -1;
      };

      const collect = (selector) => Array.from(document.querySelectorAll(selector)).filter(isVisible);
      const pools = [
        collect('[role="tab"]'),
        collect('button'),
        collect('a'),
        collect('[class*="tab" i]'),
        collect('div')
      ];

      let best = null;
      let bestScore = -1;
      pools.flat().forEach((el) => {
        const sc = score(el);
        if (sc > bestScore) { bestScore = sc; best = el; }
      });
      if (!best || bestScore < 0) return { ok: false, reason: 'not_found' };

      try { best.scrollIntoView({ block: 'center' }); } catch (_) {}
      try { best.click(); } catch (_) { return { ok: false, reason: 'click_failed' }; }
      return { ok: true, score: bestScore, text: (best.textContent || '').trim() };
    })()
  `;
}

async function clickTabByText(webContents, tabText) {
  try {
    const r = await webContents.executeJavaScript(buildClickTabByTextJs(tabText), true);
    return r?.ok ? { ok: true, detail: r } : { ok: false, detail: r };
  } catch (err) {
    return { ok: false, detail: { ok: false, reason: 'execute_failed', error: String(err?.message || err) } };
  }
}

function mergePreferNonEmpty(target, patch) {
  const out = { ...(target || {}) };
  const p = patch || {};
  Object.keys(p).forEach((k) => {
    const v = p[k];
    if (v === undefined || v === null) return;
    if (typeof v === 'string' && v.trim() === '') return;
    if (out[k] === undefined || out[k] === null || (typeof out[k] === 'string' && out[k].trim() === '')) {
      out[k] = v;
    }
  });
  return out;
}

function mergeNotesUnique(a, b) {
  const listA = Array.isArray(a) ? a : [];
  const listB = Array.isArray(b) ? b : [];
  const map = new Map();
  const keyOf = (x, idx) => {
    const u = (x?.note_url || x?.url || '').trim();
    if (u) return `u:${u}`;
    const t = (x?.note_title || x?.title || '').trim();
    if (t) return `t:${t}`;
    return `i:${idx}`;
  };
  listA.forEach((x, i) => map.set(keyOf(x, i), x));
  listB.forEach((x, i) => {
    const k = keyOf(x, i);
    if (!map.has(k)) map.set(k, x);
  });
  return Array.from(map.values());
}

// 在“笔记数据”页，很多卡片并没有 a[href]，导致 note_url 抓不到。
// 这里提供一个可选兜底：对缺失 note_url 的卡片，尝试点击打开详情页读取 URL，再返回。
async function resolveNoteUrlsByClick(webContents, notes, noteCardSelector, { timeoutMs = 12000, limit = 10 } = {}) {
  const list = Array.isArray(notes) ? notes : [];
  const baseUrl = webContents.getURL();
  let resolved = 0;
  let lastClipboardSample = '';

  const clickAt = async ({ x, y }) => {
    try {
      webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
      webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
      return true;
    } catch (_) {
      return false;
    }
  };

  const getCardCenter = async ({ cardSel, index, fallbackSel }) => {
    const js = `
      (function(){
        const cardSel = ${JSON.stringify(String(cardSel || ''))};
        const index = ${Number.isFinite(index) ? index : -1};
        const fallbackSel = ${JSON.stringify(String(fallbackSel || ''))};
        let el = null;
        try {
          if (cardSel && index >= 0) {
            const cards = document.querySelectorAll(cardSel);
            el = cards && cards[index] ? cards[index] : null;
          }
        } catch (_) {}
        if (!el) {
          try { el = fallbackSel ? document.querySelector(fallbackSel) : null; } catch (_) {}
        }
        if (!el) return null;
        try { el.scrollIntoView({block:'center'}); } catch (_) {}
        const r = el.getBoundingClientRect();
        if (!r || !r.width || !r.height) return null;
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      })()
    `;
    try {
      return await webContents.executeJavaScript(js, true);
    } catch (_) {
      return null;
    }
  };

  const clickCard = async ({ cardSel, index, fallbackSel }) => {
    // 优先用真实鼠标事件（更像用户手势，复制按钮也更可能生效）
    const pt = await getCardCenter({ cardSel, index, fallbackSel });
    if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) return await clickAt(pt);
    // fallback：DOM click
    try {
      const js = `
        (function(){
          const cardSel = ${JSON.stringify(String(cardSel || ''))};
          const index = ${Number.isFinite(index) ? index : -1};
          const fallbackSel = ${JSON.stringify(String(fallbackSel || ''))};
          let el = null;
          try {
            if (cardSel && index >= 0) {
              const cards = document.querySelectorAll(cardSel);
              el = cards && cards[index] ? cards[index] : null;
            }
          } catch (_) {}
          if (!el) {
            try { el = fallbackSel ? document.querySelector(fallbackSel) : null; } catch (_) {}
          }
          if (!el) return false;
          try { el.scrollIntoView({block:'center'}); } catch (_) {}
          try { el.click(); return true; } catch (_) { return false; }
        })()
      `;
      return await webContents.executeJavaScript(js, true);
    } catch (_) {
      return false;
    }
  };

  const readUrlFromNoteDetail = async () => {
    // 通过“复制小红书笔记链接”按钮提取链接（优先读属性，其次走剪贴板）
    try {
      const pickFirstHttp = (text) => {
        if (!text) return null;
        const m = String(text).match(/https?:\/\/[^\s"'<>]+/i);
        return m ? m[0] : null;
      };
      const pickFirstNoteId = (text) => {
        if (!text) return null;
        const t = String(text);
        // 常见：/explore/<24hex> 或 /discovery/item/<24hex>
        const m1 = t.match(/\/explore\/([0-9a-f]{24})/i);
        if (m1) return m1[1];
        const m2 = t.match(/\/discovery\/item\/([0-9a-f]{24})/i);
        if (m2) return m2[1];
        // 常见 key：noteId/itemId
        const m3 = t.match(/(?:noteId|note_id|itemId|item_id)["'\s:=]+([0-9a-f]{24})/i);
        if (m3) return m3[1];
        // 兜底：任意 24 位 hex（可能误命中，但比 null 强）
        const m4 = t.match(/\b([0-9a-f]{24})\b/i);
        return m4 ? m4[1] : null;
      };

      const r = await webContents.executeJavaScript(
        `(function(){
          const textIncludes = (el, s) => ((el?.textContent || '').replace(/\\s+/g,'').includes(s));
          const findCopyBtn = () => {
            const s = '复制小红书笔记链接';
            const cands = Array.from(document.querySelectorAll('a,button,span,div')).slice(0, 2000);
            return cands.find(el => textIncludes(el, s));
          };
          const btn = findCopyBtn();
          if (!btn) return { ok:false, reason:'copy_btn_not_found' };
          const attrs = ['data-clipboard-text','data-copy','data-url','data-href','data-link','href','value'];
          for (const k of attrs) {
            try {
              const v = btn.getAttribute && btn.getAttribute(k);
              if (v && (/https?:\\/\\//i.test(v) || /\\/explore\\//i.test(v) || /\\/discovery\\/item\\//i.test(v))) {
                return { ok:true, url:v, via:'attr', key:k };
              }
            } catch (_) {}
          }
          // 尝试在附近寻找真正的链接
          try {
            const near = btn.closest('a[href]') || btn.querySelector('a[href]');
            const h = near && near.getAttribute('href');
            if (h) return { ok:true, url:h, via:'near_href' };
          } catch (_) {}

          // 尝试直接从弹层 HTML 里找出 url（有些实现不会写到剪贴板）
          try {
            const html = document.documentElement ? document.documentElement.outerHTML : '';
            const m = html.match(/https?:\\/\\/[^\\s"'<>]+/i);
            if (m) return { ok:true, url:m[0], via:'modal_html' };
          } catch (_) {}

          // 尝试从弹层 DOM 中推断 noteId（不依赖复制能力）
          try {
            const findModalRoot = () => {
              const headers = Array.from(document.querySelectorAll('h1,h2,h3,div,span'))
                .filter(el => (el.textContent || '').trim() === '笔记详情')
                .slice(0, 5);
              for (const h of headers) {
                const root = h.closest('[role="dialog"],.ant-modal,.ant-drawer,.modal,.drawer') || h.parentElement;
                if (root) return root;
              }
              return document.body;
            };
            const root = findModalRoot();
            const html = root ? (root.outerHTML || '') : '';
            return { ok:true, url:null, via:'modal_scan', html: html.slice(0, 200000) };
          } catch (_) {}

          // 触发复制（可能会写入剪贴板）
          try { btn.scrollIntoView({block:'center'}); } catch (_) {}
          try { btn.click(); } catch (_) {}
          return { ok:true, url:null, via:'clicked' };
        })()`,
        true
      );
      if (!r?.ok) return null;
      if (r.url) {
        try {
          return new URL(r.url, baseUrl).toString();
        } catch (_) {
          return r.url;
        }
      }

      // 若拿到了弹层 html（modal_scan），直接在 Node 侧解析 noteId 并拼 URL
      if (r?.via === 'modal_scan' && r?.html) {
        const noteId = pickFirstNoteId(r.html);
        if (noteId) return `https://www.xiaohongshu.com/explore/${noteId}`;
      }
      // fallback: 再用“真实点击”触发复制，然后读剪贴板
      try {
        const pos = await webContents.executeJavaScript(
          `(function(){
            const textIncludes = (el, s) => ((el?.textContent || '').replace(/\\s+/g,'').includes(s));
            const s = '复制小红书笔记链接';
            const cands = Array.from(document.querySelectorAll('a,button,span,div')).slice(0, 2000);
            const btn = cands.find(el => textIncludes(el, s));
            if (!btn) return null;
            try { btn.scrollIntoView({block:'center'}); } catch (_) {}
            const r = btn.getBoundingClientRect();
            if (!r || !r.width || !r.height) return null;
            return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
          })()`,
          true
        );
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
          await clickAt(pos);
          await sleep(350);
        }
      } catch (_) {}

      // 最后：读剪贴板
      try {
        const t = (clipboard.readText() || '').trim();
        const u = pickFirstHttp(t);
        if (u) return u;
        if (t) lastClipboardSample = t.slice(0, 200);
      } catch (_) {}

    } catch (_) {}
    return null;
  };

  const closeNoteDetail = async () => {
    try {
      await webContents.executeJavaScript(
        `(function(){
          // 1) 常见 close 按钮
          const sels = [
            '[aria-label*="关闭"]',
            '[aria-label*="close"]',
            'button[class*="close"]',
            'div[class*="close"]',
            '.ant-modal-close',
            '.ant-drawer-close'
          ];
          for (const sel of sels) {
            try {
              const el = document.querySelector(sel);
              if (el) { el.click(); return true; }
            } catch (_) {}
          }
          // 2) 右上角 X
          const xs = Array.from(document.querySelectorAll('button,div,span')).filter(el => (el.textContent || '').trim() === '×');
          if (xs[0]) { try { xs[0].click(); return true; } catch (_) {} }
          // 3) ESC
          try {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
            return true;
          } catch (_) {}
          return false;
        })()`,
        true
      );
    } catch (_) {}
  };

  const isNoteDetailOpen = async () => {
    try {
      const r = await webContents.executeJavaScript(
        `(function(){
          const t = (document.body && document.body.innerText) ? document.body.innerText : '';
          return t.includes('笔记详情') || t.includes('复制小红书笔记链接');
        })()`,
        true
      );
      return !!r;
    } catch (_) {
      return false;
    }
  };

  const waitOpen = async () => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const u = webContents.getURL();
      if (u && u !== baseUrl) return u;
      // 若未发生 URL 变化：等待“笔记详情”弹层出现后，从弹层提取链接
      if (await isNoteDetailOpen()) {
        const link = await readUrlFromNoteDetail();
        if (link) return link;
      }
      await sleep(250);
    }
    return null;
  };

  const waitBack = async () => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const u = webContents.getURL();
      if (u === baseUrl) return true;
      await sleep(250);
    }
    return false;
  };

  for (const n of list) {
    if (resolved >= limit) break;
    if (n?.note_url) continue;
    const idx = Number.isFinite(n?.__cardIndex) ? Number(n.__cardIndex) : -1;
    const fallbackSel = n?.__cardSelector;
    const cardSel = String(noteCardSelector || '').trim();
    if (!cardSel && !fallbackSel) continue;

    try {
      // 清理剪贴板，避免读到上一次的链接
      try { clipboard.clear(); } catch (_) {}
      const ok = await clickCard({ cardSel, index: idx, fallbackSel });
      if (!ok) continue;
      const newUrl = await waitOpen();
      if (newUrl) {
        n.note_url = newUrl;
        resolved++;
      }

      // 关闭弹层（URL 不变时 goBack 无效）
      await closeNoteDetail();
      // 若确实发生了 URL 跳转，则再返回
      if (webContents.getURL() !== baseUrl) {
        if (webContents.canGoBack()) {
          webContents.goBack();
          await waitBack();
        } else {
          await webContents.loadURL(baseUrl);
        }
      }
      await sleep(600);
    } catch (_) {
      // best-effort
    }
  }

  return { resolved, baseUrl, lastClipboardSample };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#fafafb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Task 1：不再加载 iframe 的 shell.html，改为原生控制台 UI（index.html）
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 右侧内嵌浏览器（真内嵌）
  browserView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'browser_preload.js'),
      // Task 2：持久化登录态（单账号 profile）
      partition: 'persist:pgy_default',
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setBrowserView(browserView);
  // 很多站点（含蒲公英）会用 target=_blank / window.open 做站内跳转。
  // 如果直接 deny，用户点击会“没反应”。这里改为：拦截新窗口并在当前 BrowserView 内打开。
  browserView.webContents.setWindowOpenHandler((details) => {
    try {
      const url = details?.url;
      if (url && /^https?:\/\//i.test(url)) {
        browserView.webContents.loadURL(url);
        mainWindow?.webContents.send('browser:url', { url });
      }
    } catch (_) {}
    return { action: 'deny' };
  });

  // 初始打开空白页
  browserView.webContents.loadURL('about:blank');

  let uiWidth = UI_WIDTH;
  const applyBounds = () => {
    if (!mainWindow || !browserView) return;
    const [w, h] = mainWindow.getContentSize();
    const x = Math.round(uiWidth + SPLITTER_WIDTH);
    const y = TOPBAR_HEIGHT;
    const width = Math.max(320, w - x);
    const height = Math.max(240, h - TOPBAR_HEIGHT);
    browserView.setBounds({ x, y, width, height });
    // width 由我们根据 uiWidth 控制；height 跟随窗口即可
    browserView.setAutoResize({ width: false, height: true });
  };

  mainWindow.on('resize', applyBounds);
  mainWindow.on('ready-to-show', applyBounds);
  applyBounds();

  // renderer 拖拽分割条后同步右侧 BrowserView 边界
  ipcMain.handle('browser:setLayout', async (_e, payload) => {
    try {
      const cw = Number(payload?.consoleWidth || 0);
      if (Number.isFinite(cw) && cw > 0) {
        // 限制范围（保持右侧浏览器至少 320）
        const [w] = mainWindow.getContentSize();
        const min = 420;
        const max = Math.max(min, w - 320 - SPLITTER_WIDTH);
        uiWidth = Math.max(min, Math.min(max, cw));
        applyBounds();
      }
      return { ok: true, uiWidth };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  });

  // 记录导航（用于回放）
  browserView.webContents.on('did-navigate', (_e, url) => {
    // 推送当前 URL 给控制台 UI（用于地址栏显示）
    mainWindow?.webContents.send('browser:url', { url });

    if (!recordingEnabled) return;
    currentRecording.push({
      t: Date.now(),
      type: 'navigate',
      url
    });
    mainWindow?.webContents.send('recording:count', currentRecording.length);
  });

  // SPA 场景：hash/history 跳转不会触发 did-navigate
  browserView.webContents.on('did-navigate-in-page', (_e, url) => {
    mainWindow?.webContents.send('browser:url', { url });
  });

  browserView.webContents.on('did-finish-load', () => {
    try {
      const url = browserView?.webContents?.getURL?.() || '';
      mainWindow?.webContents.send('browser:url', { url });
    } catch (_) {}
  });

  // Task 6：批量任务引擎（串行队列 + 暂停介入 + 证据包）
  taskRunner = new TaskRunner({
    getRunsDir,
    makeRunId,
    sendState: (payload) => mainWindow?.webContents.send('tasks:state', payload),
    openUrl: async (url) => {
      if (!browserView) throw new Error('browserView 未初始化');
      const finalUrl = url && /^https?:\/\//i.test(url) ? url : `https://${url}`;
      await browserView.webContents.loadURL(finalUrl);
      mainWindow?.webContents.send('browser:url', { url: finalUrl });
    },
    getCurrentUrl: () => {
      try {
        return browserView?.webContents?.getURL?.() || '';
      } catch (_) {
        return '';
      }
    },
    checkLogin: pgyCheckLogin,
    extractCurrentMultiPage: pgyExtractCurrentMultiPage
  });
  // 推一份初始 state，避免渲染端等待
  try {
    mainWindow?.webContents.send('tasks:state', taskRunner.state);
  } catch (_) {}

  mainWindow.on('closed', () => {
    mainWindow = null;
    browserView = null;
    taskRunner = null;
  });
}

function httpGetJson({ host, port, path: urlPath, timeoutMs = 1200 }) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host,
        port: Number(port),
        path: urlPath,
        method: 'GET',
        timeout: timeoutMs
      },
      (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (d) => (buf += d));
        res.on('end', () => {
          let json = null;
          try {
            json = buf ? JSON.parse(buf) : null;
          } catch (_) {}
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (err) => {
      resolve({
        ok: false,
        status: null,
        code: err?.code || 'HTTP_ERROR',
        error: String(err?.message || err)
      });
    });
    req.end();
  });
}

async function waitForBackendReady({ host, port, timeoutMs = 20000, intervalMs = 500 }) {
  const startedAt = Date.now();
  let last = null;

  while (Date.now() - startedAt < timeoutMs) {
    // 优先健康检查（若不存在则 fallback 到 /api/config）
    const health = await httpGetJson({ host, port, path: '/api/desktop/health' });
    if (health.ok) return { ok: true, path: '/api/desktop/health' };

    // health 404 视为“不存在” -> 继续探测 /api/config
    const config = await httpGetJson({ host, port, path: '/api/config' });
    if (config.ok) return { ok: true, path: '/api/config' };

    // 记录最后一次结果，用于超时后输出 code
    last = config?.status ? { status: config.status } : { code: config?.code || health?.code || 'NOT_READY' };
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return {
    ok: false,
    code: last?.code || (last?.status ? `HTTP_${last.status}` : 'BACKEND_TIMEOUT')
  };
}

function startBackendIfNeeded() {
  // 默认启动 Python 后端（可通过环境变量禁用）
  if (process.env.ELECTRON_START_BACKEND === 'false') return;
  if (backendProc) return;

  // 假设项目结构为：workspace/content-analyzer + workspace/desktop-app
  const backendDir = path.resolve(__dirname, '..', 'content-analyzer');
  const backendEntry = path.join(backendDir, 'main.py');

  if (!fs.existsSync(backendEntry)) {
    console.warn('[backend] 未找到后端入口 main.py，跳过启动：', backendEntry);
    return;
  }

  // 可按需在这里固定端口
  const env = {
    ...process.env,
    API_HOST: process.env.API_HOST || DEFAULT_API_HOST,
    API_PORT: process.env.API_PORT || DEFAULT_API_PORT,
    DEBUG: process.env.DEBUG || 'false'
  };

  // 兼容 Windows/macOS：python 命令可能叫 python3 / py
  const pythonCandidates = [];
  if (process.env.PYTHON) pythonCandidates.push(process.env.PYTHON);
  // 常见优先级：macOS/Linux -> python3；Windows -> py；再退回 python
  pythonCandidates.push('python3', 'py', 'python');

  const trySpawn = (idx) => {
    if (idx >= pythonCandidates.length) {
      console.error('[backend] 未找到可用的 Python 命令。请设置环境变量 PYTHON（例如 python3/py/python 或 Python.exe 全路径）。');
      mainWindow?.webContents.send('backend:status', { running: false, code: 'PYTHON_NOT_FOUND' });
      return;
    }

    const pythonCmd = pythonCandidates[idx];
    console.log('[backend] 尝试启动：', pythonCmd, backendEntry);

    const proc = spawn(pythonCmd, [backendEntry], {
      cwd: backendDir,
      env,
      stdio: 'pipe'
    });

    // 关键：命令不存在时会触发 error 事件（ENOENT）
    proc.on('error', (err) => {
      if (err && err.code === 'ENOENT') {
        console.warn('[backend] 命令不存在：', pythonCmd);
        trySpawn(idx + 1);
        return;
      }
      console.error('[backend] 启动失败：', err);
      mainWindow?.webContents.send('backend:status', { running: false, code: err?.code || 'SPAWN_ERROR' });
    });

    proc.stdout.on('data', (buf) => {
      const s = buf.toString();
      console.log('[backend]', s.trimEnd());
    });
    proc.stderr.on('data', (buf) => {
      const s = buf.toString();
      console.error('[backend]', s.trimEnd());
    });
    proc.on('exit', (code) => {
      console.warn('[backend] exited:', code);
      if (backendProc === proc) backendProc = null;
      mainWindow?.webContents.send('backend:status', { running: false, code });
    });

    backendProc = proc;
    // Task 2：spawn 后先探测后端就绪（成功后才 running=true）
    waitForBackendReady({ host: env.API_HOST, port: env.API_PORT })
      .then((ready) => {
        if (!ready?.ok) {
          mainWindow?.webContents.send('backend:status', {
            running: false,
            host: env.API_HOST,
            port: env.API_PORT,
            code: ready?.code || 'BACKEND_NOT_READY'
          });
          return;
        }
        mainWindow?.webContents.send('backend:status', {
          running: true,
          host: env.API_HOST,
          port: env.API_PORT,
          readyPath: ready.path
        });
      })
      .catch((err) => {
        mainWindow?.webContents.send('backend:status', {
          running: false,
          host: env.API_HOST,
          port: env.API_PORT,
          code: err?.code || 'BACKEND_PROBE_ERROR'
        });
      });
  };

  trySpawn(0);
}

function stopBackend() {
  if (!backendProc) return;
  try {
    backendProc.kill();
  } catch (_) {}
  backendProc = null;
}

// =========================
// IPC：浏览器控制
// =========================
ipcMain.handle('backend:info', async () => {
  const host = process.env.API_HOST || DEFAULT_API_HOST;
  const port = process.env.API_PORT || DEFAULT_API_PORT;
  const ready = await waitForBackendReady({ host, port, timeoutMs: 300 });
  return { ok: true, host, port, running: !!ready?.ok, readyPath: ready?.path || '' };
});

ipcMain.handle('browser:getUrl', async () => {
  try {
    const url = browserView?.webContents?.getURL?.() || '';
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('browser:open', async (_e, url) => {
  if (!browserView) return { ok: false, error: 'browserView 未初始化' };
  const finalUrl = url && /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    await browserView.webContents.loadURL(finalUrl);
    mainWindow?.webContents.send('browser:url', { url: finalUrl });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('browser:nav', async (_e, action) => {
  if (!browserView) return { ok: false, error: 'browserView 未初始化' };
  try {
    if (action === 'back' && browserView.webContents.canGoBack()) browserView.webContents.goBack();
    if (action === 'forward' && browserView.webContents.canGoForward()) browserView.webContents.goForward();
    if (action === 'reload') browserView.webContents.reload();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

// =========================
// IPC：PGY 登录态检测
// =========================
async function pgyCheckLogin() {
  if (!browserView) return { ok: false, error: 'browserView 未初始化' };
  try {
    const result = await browserView.webContents.executeJavaScript(
      `
        (function(){
          const url = location.href;
          const path = location.pathname || '';
          const isLoginPage = /\\/login/i.test(path) || /\\/login/i.test(url);

          // 经验性判断：不在 /login 且出现“退出/登出”按钮、或常见用户/头像元素
          const hasLogout = Array.from(document.querySelectorAll('a,button')).some((el) =>
            /退出|登出|Logout/i.test((el.textContent || '').trim())
          );
          const hasUserEl = !!(
            document.querySelector('[class*="avatar" i]') ||
            document.querySelector('img[class*="avatar" i]') ||
            document.querySelector('[class*="user" i]') ||
            document.querySelector('[data-user]') ||
            hasLogout
          );

          const loggedIn = !isLoginPage && hasUserEl;
          return { ok: true, loggedIn, url, isLoginPage };
        })()
      `,
      true
    );
    return result;
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

ipcMain.handle('pgy:checkLogin', async () => {
  return await pgyCheckLogin();
});

// =========================
// IPC：PGY 智能推断笔记卡片 selector（用于配置 noteCardSelector）
// =========================
ipcMain.handle('pgy:suggestNoteCardSelector', async () => {
  if (!browserView) return { ok: false, error: 'browserView 未初始化' };
  try {
    const js = `
      (function(){
        const hrefPatterns = ['/explore/','/discovery/item/','/note/'];
        const anchors = Array.from(document.querySelectorAll('a[href]'))
          .filter(a => {
            const h = a.getAttribute('href') || '';
            return hrefPatterns.some(p => h.includes(p));
          });

        const buildSel = (el) => {
          if (!el || el.nodeType !== 1) return null;
          if (el.id) return '#' + CSS.escape(el.id);
          const tag = el.tagName.toLowerCase();
          const cls = (typeof el.className === 'string' ? el.className.split(/\\s+/).filter(Boolean) : []).slice(0,2);
          if (cls.length) return tag + '.' + cls.map(c => CSS.escape(c)).join('.');
          return tag;
        };

        const containsLink = (node) => {
          try {
            const a = node.querySelector('a[href]');
            if (!a) return false;
            const h = a.getAttribute('href') || '';
            return hrefPatterns.some(p => h.includes(p));
          } catch (_) { return false; }
        };

        // Fallback：有些“笔记数据”卡片不是 <a href>，而是 div onclick。
        // 用指标标签（阅读/点赞/收藏/发布时间）推断卡片容器。
        const pickCardsByMetrics = () => {
          const labelNodes = Array.from(document.querySelectorAll('span,div'))
            .filter(el => (el.textContent || '').trim() === '阅读')
            .slice(0, 200);
          if (!labelNodes.length) return [];
          const cards = [];
          const seen = new Set();
          const hasMetricLabels = (root) => {
            const t = (root.textContent || '');
            // 这里用“至少两个”标签做判定，避免误判
            const ok1 = t.includes('阅读');
            const ok2 = t.includes('点赞');
            const ok3 = t.includes('收藏');
            const ok4 = t.includes('发布时间');
            const score = (ok1?1:0) + (ok2?1:0) + (ok3?1:0) + (ok4?1:0);
            return score >= 2;
          };
          for (const n of labelNodes) {
            let el = n;
            for (let d = 0; d < 7; d++) {
              if (!el) break;
              if (el.nodeType === 1 && hasMetricLabels(el)) {
                const key = el;
                if (!seen.has(key)) {
                  seen.add(key);
                  cards.push(el);
                }
                break;
              }
              el = el.parentElement;
            }
          }
          return cards;
        };

        const seen = new Set();
        const cand = [];
        if (anchors.length >= 3) {
          for (const a of anchors.slice(0, 60)) {
            let el = a;
            for (let d=0; d<5; d++) {
              if (!el) break;
              const sel = buildSel(el);
              if (sel && !seen.has(sel)) {
                seen.add(sel);
                let cnt = 0;
                let ok = false;
                try {
                  const nodes = Array.from(document.querySelectorAll(sel));
                  cnt = nodes.length;
                  ok = cnt >= 3 && cnt <= 400 && nodes.every(containsLink);
                } catch (_) {
                  cnt = 0;
                  ok = false;
                }
                if (ok) cand.push({ sel, cnt, reason: 'link' });
              }
              el = el.parentElement;
            }
          }
        } else {
          // 用 metrics 推断
          const cards = pickCardsByMetrics();
          const cardCount = cards.length;
          for (const c of cards.slice(0, 60)) {
            let el = c;
            for (let d=0; d<4; d++) {
              if (!el) break;
              const sel = buildSel(el);
              if (sel && !seen.has(sel)) {
                seen.add(sel);
                let cnt = 0;
                let ok = false;
                try {
                  const nodes = Array.from(document.querySelectorAll(sel));
                  cnt = nodes.length;
                  // 判断：数量合理，并且大部分都包含“阅读”标签
                  const hasRead = (node) => ((node.textContent || '').includes('阅读'));
                  const hits = nodes.slice(0, 50).filter(hasRead).length;
                  ok = cnt >= 3 && cnt <= 400 && hits >= Math.max(2, Math.floor(Math.min(50, nodes.length) * 0.6));
                } catch (_) {
                  cnt = 0;
                  ok = false;
                }
                if (ok) cand.push({ sel, cnt, reason: 'metrics', anchors: 0, cardCount });
              }
              el = el.parentElement;
            }
          }
        }

        if (!cand.length) {
          // 兜底：若页面没有链接结构，也没有明显指标标签，提示用户滚动或切到笔记数据列表
          return {
            ok:false,
            error:'未能自动识别笔记卡片。请确保右侧已在「笔记数据」tab，并滚动让列表加载出多条卡片后重试。',
            anchors: anchors.length
          };
        }

        cand.sort((a,b) => {
          const targetA = (a.reason === 'link') ? anchors.length : (a.cardCount || 0);
          const targetB = (b.reason === 'link') ? anchors.length : (b.cardCount || 0);
          const da = Math.abs(a.cnt - targetA);
          const db = Math.abs(b.cnt - targetB);
          if (da !== db) return da - db;
          if (a.cnt !== b.cnt) return b.cnt - a.cnt;
          return b.sel.length - a.sel.length;
        });

        const best = cand[0];
        const confidence = best.reason === 'link' ? 'medium' : 'medium';
        return {
          ok:true,
          noteCardSelector: best.sel,
          confidence,
          anchors: anchors.length,
          cardCount: best.cnt,
          reason: best.reason
        };
      })()
    `;
    const r = await browserView.webContents.executeJavaScript(js, true);
    return r;
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

// =========================
// PGY Resource v1：从页面文本做“指标名->数值”抽取（缺失留空）
// 说明：该抽取偏“稳健”，尽量不依赖易变 class；未来再逐步替换为精确 selector。
// =========================
async function pgyExtractResourceDelta(webContents, tabKey, noteCardSelector) {
  try {
    const js = `
      (function(){
        const tabKey = ${JSON.stringify(String(tabKey || ''))};
        const noteCardSelector = ${JSON.stringify(String(noteCardSelector || ''))};
        const text = (document.body && document.body.innerText ? document.body.innerText : '').replace(/\\u00a0/g,' ');

        const pick = (label) => {
          if (!label) return '';
          const re = new RegExp(label + '[\\\\s\\\\S]{0,40}?([¥￥]?\\\\s*[0-9][0-9,\\\\.]*\\\\s*(?:%|万|w)?|-[ ]*|-)', 'i');
          const m = text.match(re);
          return m ? (m[1] || '').trim() : '';
        };
        const pickRe = (re) => {
          try {
            const m = text.match(re);
            return m ? (m[1] || '').trim() : '';
          } catch (_) { return ''; }
        };

        const out = { metrics: {}, creator: {}, notesTop: [] };

        if (!tabKey || tabKey === 'base') {
          // 优先用稳定 class：达人卡片中的昵称/小红书号/粉丝/获赞与收藏/报价
          try {
            const nameEl = document.querySelector('.blogger-base-info .blogger-name');
            const nm = nameEl ? (nameEl.innerText || nameEl.textContent || '').trim() : '';
            if (nm) out.creator.creator_name = nm;
          } catch (_) {}

          try {
            const idEl = document.querySelector('.base-info-item.blogger-redid a');
            const idTxt = idEl ? (idEl.innerText || idEl.textContent || '').trim() : '';
            if (idTxt) out.creator.xhs_id = idTxt;
          } catch (_) {}

          try {
            const locEl = document.querySelector('.blogger-location__text');
            const loc = locEl ? (locEl.innerText || locEl.textContent || '').trim() : '';
            if (loc && loc !== '--') out.creator.location = loc;
          } catch (_) {}

          try {
            const items = Array.from(document.querySelectorAll('.blogger-data__item'));
            for (const it of items) {
              const lab = (it.querySelector('.blogger-data__label')?.innerText || '').trim();
              const val = (it.querySelector('.blogger-data__value')?.innerText || '').trim();
              if (lab && val && val !== '--') out.metrics[lab] = val;
            }
          } catch (_) {}

          try {
            const boxes = Array.from(document.querySelectorAll('.quote-list .price-box'));
            for (const b of boxes) {
              const spans = Array.from(b.querySelectorAll('span'));
              const lab = (spans[0]?.innerText || spans[0]?.textContent || '').trim();
              const val = (spans[1]?.innerText || spans[1]?.textContent || '').trim();
              if (lab && val && val !== '--') out.metrics[lab] = val;
            }
          } catch (_) {}

          // 如果上面 selector 没取到，再做文本兜底（避免页面结构变动）
          const findCreatorName = () => {
            // 0) 先解析小红书号（页面可能是“小红书号/小红书ID/小红书ID号”等）
            const xhsId = pickRe(/小红书(?:号|ID)[:：]\\s*([^\\n\\s]+)/);

            // 1) 优先：在 DOM 中找到包含“小红书号/ID”的节点，向上收敛到“达人卡片”容器
            const labelNodes = Array.from(document.querySelectorAll('span,div,p,li'))
              .filter((el) => {
                const t = (el.textContent || '').trim();
                return /小红书(?:号|ID)/.test(t);
              })
              .slice(0, 20);

            // 2) 若能拿到 xhsId，则优先定位包含 xhsId 的节点（更精准）
            let anchor = null;
            if (xhsId) {
              const idNodes = Array.from(document.querySelectorAll('span,div,p,li'))
                .filter((el) => ((el.textContent || '').includes(xhsId)))
                .slice(0, 10);
              anchor = idNodes[0] || labelNodes[0] || null;
            } else {
              anchor = labelNodes[0] || null;
            }

            const isBadName = (s) => {
              if (!s) return true;
              const x = String(s).trim();
              if (x.length < 2 || x.length > 40) return true;
              if (/^[0-9\\.,%万wW¥￥\\s-]+$/.test(x)) return true;
              if (x.includes('小红书') || x.includes('粉丝') || x.includes('获赞') || x.includes('收藏') || x.includes('报价') || x.includes('一口价')) return true;
              if (x.includes('数据更新至') || x.includes('数据概览') || x.includes('笔记数据') || x.includes('粉丝分析')) return true;
              if (x.includes('退出') || x.includes('登出')) return true;
              return false;
            };

            const shrinkToCard = (node) => {
              let root = node || null;
              for (let i = 0; i < 8; i++) {
                if (!root || !root.parentElement) break;
                const p = root.parentElement;
                const txt = (p.innerText || '').replace(/\\u00a0/g, ' ');
                // 容器不要太大（避免 body/nav），并且必须包含“小红书”字样
                if (txt.includes('小红书') && txt.length < 1600 && !txt.includes('退出')) root = p;
                else break;
              }
              return root;
            };

            const pickByFontSize = (root) => {
              if (!root || !root.querySelectorAll) return '';
              const cands = Array.from(root.querySelectorAll('h1,h2,h3,strong,b,span,div'))
                .filter((el) => el && (el.offsetParent !== null))
                .map((el) => {
                  const t = (el.innerText || el.textContent || '').trim();
                  if (!t || t.includes('\\n')) return null;
                  if (isBadName(t)) return null;
                  let fs = 0;
                  try { fs = parseFloat(getComputedStyle(el).fontSize) || 0; } catch (_) { fs = 0; }
                  return { t, fs };
                })
                .filter(Boolean);
              cands.sort((a, b) => (b.fs || 0) - (a.fs || 0));
              return cands[0]?.t || '';
            };

            if (anchor) {
              const card = shrinkToCard(anchor);
              // 先用字体最大值法（通常昵称字号最大）
              const n1 = pickByFontSize(card);
              if (n1) return n1;

              // 兜底：取 card 文本中，“小红书号/ID”之前最近的非数值行
              const lines = (card.innerText || card.textContent || '')
                .replace(/\\u00a0/g, ' ')
                .split(/\\n+/)
                .map((s) => s.trim())
                .filter(Boolean);
              const idx = lines.findIndex((x) => /小红书(?:号|ID)/.test(x));
              const seg = idx > 0 ? lines.slice(0, idx).reverse() : lines;
              for (const ln of seg) {
                if (!isBadName(ln)) return ln;
              }
            }

            // 最后兜底：页面第一个 h1（可能是登录账号名，因此放最后）
            const h1 = document.querySelector('h1');
            const h1t = h1 && (h1.textContent || '').trim() ? (h1.textContent || '').trim() : '';
            return isBadName(h1t) ? '' : h1t;
          };

          const nm = findCreatorName();
          if (nm && !out.creator.creator_name) out.creator.creator_name = nm;

          const xhsId = pickRe(/小红书(?:号|ID)[:：]\\s*([^\\n\\s]+)/);
          if (xhsId && !out.creator.xhs_id) out.creator.xhs_id = xhsId;

          const upd = pickRe(/数据更新至[:：]\\s*(\\d{4}-\\d{2}-\\d{2})/);
          if (upd) out.metrics['数据更新至'] = upd;

          const followers = pickRe(/粉丝\\s*([0-9][0-9,\\.]*\\s*(?:万|w)?)/);
          if (followers && !out.metrics['粉丝数']) out.metrics['粉丝数'] = followers;

          const likesFav = pickRe(/获赞与收藏\\s*([0-9][0-9,\\.]*\\s*(?:万|w)?)/);
          if (likesFav && !out.metrics['获赞与收藏']) out.metrics['获赞与收藏'] = likesFav;

          const p1 = pick('图文笔记一口价');
          if (p1 && !out.metrics['图文笔记一口价']) out.metrics['图文笔记一口价'] = p1;
          const p2 = pick('视频笔记一口价');
          if (p2 && !out.metrics['视频笔记一口价']) out.metrics['视频笔记一口价'] = p2;
        }

        if (tabKey.includes('数据概览')) {
          const labels = [
            '曝光中位数','阅读中位数','互动中位数','外溢进店中位数',
            '中位点赞量','中位收藏量','中位评论量','中位分享量','中位关注量',
            '互动率','视频完播率','图文3秒阅读率','千赞笔记比例','百赞笔记比例',
            '近7天活跃天数','邀约48小时回复率','粉丝量变化幅度'
          ];
          for (const l of labels) {
            const v = pick(l);
            if (v && v !== '-') out.metrics[l] = v;
          }
          const srcAnchor = text.indexOf('流量来源');
          if (srcAnchor >= 0) {
            const seg = text.slice(srcAnchor, srcAnchor + 2500);
            const cats = ['发现页','搜索页','关注页','博主个人页','附近页','其他'];
            for (const c of cats) {
              const m = seg.match(new RegExp(c + '\\\\s*([0-9\\\\.]+%)'));
              if (m) {
                out.metrics['阅读量来源-' + c + '%'] = m[1];
                out.metrics['曝光量来源-' + c + '%'] = m[1];
              }
            }
          }
        }

        if (tabKey.includes('笔记数据')) {
          const sel = noteCardSelector;
          if (sel) {
            const cards = Array.from(document.querySelectorAll(sel)).slice(0, 10);
            const parseNum = (t, label) => {
              const m = t.match(new RegExp(label + '\\\\s*([0-9][0-9,\\\\.]*\\\\s*(?:万|w)?|-)'));
              return m ? (m[1] || '').trim() : '';
            };
            const parseTitle = (t) => {
              const lines = String(t || '').split(/\\n+/).map(s => s.trim()).filter(Boolean);
              for (const ln of lines) {
                if (['阅读','点赞','收藏','发布时间'].includes(ln)) continue;
                if (/^(阅读|点赞|收藏|发布时间)/.test(ln)) continue;
                if (/\\d{4}-\\d{2}-\\d{2}/.test(ln)) continue;
                if (ln.length >= 2 && ln.length <= 80) return ln;
              }
              return lines[0] || '';
            };
            for (const c of cards) {
              const t = (c.innerText || c.textContent || '').replace(/\\u00a0/g,' ');
              const d = (t.match(/\\d{4}-\\d{2}-\\d{2}/) || [])[0] || '';
              out.notesTop.push({
                '标题': parseTitle(t),
                '阅读': parseNum(t, '阅读'),
                '点赞': parseNum(t, '点赞'),
                '收藏': parseNum(t, '收藏'),
                '发布时间': d,
                '含推广': t.includes('含推广') ? 'true' : ''
              });
            }
          }
        }

        if (tabKey.includes('粉丝分析')) {
          const labels = ['粉丝增量','粉丝量变化幅度','活跃粉丝占比','阅读粉丝占比','互动粉丝占比'];
          for (const l of labels) {
            const v = pick(l);
            if (v && v !== '-') out.metrics[l] = v;
          }

          const sexSegIdx = text.indexOf('性别');
          if (sexSegIdx >= 0) {
            const seg = text.slice(sexSegIdx, sexSegIdx + 1200);
            const f = seg.match(/女性\\s*([0-9\\.]+%)/);
            const m = seg.match(/男性\\s*([0-9\\.]+%)/);
            if (f) out.metrics['性别-女性%'] = f[1];
            if (m) out.metrics['性别-男性%'] = m[1];
          }

          const ageIdx = text.indexOf('年龄');
          if (ageIdx >= 0) {
            const seg = text.slice(ageIdx, ageIdx + 1800);
            const map = {
              '<18': /<18\\s*([0-9\\.]+%)/,
              '18-24': /18\\s*-\\s*24\\s*([0-9\\.]+%)/,
              '25-34': /25\\s*-\\s*34\\s*([0-9\\.]+%)/,
              '35-44': /35\\s*-\\s*44\\s*([0-9\\.]+%)/,
              '>44': />44\\s*([0-9\\.]+%)/,
            };
            for (const k of Object.keys(map)) {
              const mm = seg.match(map[k]);
              if (mm) out.metrics['年龄-' + k + '%'] = mm[1];
            }
          }

          const regIdx = text.indexOf('地域');
          if (regIdx >= 0) {
            const seg = text.slice(regIdx, regIdx + 2200);
            const rows = Array.from(seg.matchAll(/([\\u4e00-\\u9fa5]{2,8})\\s*([0-9\\.]+%)/g))
              .map(x => ({ name:x[1], pct:x[2] }));
            const seen = new Set();
            const uniq = [];
            for (const r of rows) {
              const key = r.name + r.pct;
              if (seen.has(key)) continue;
              seen.add(key);
              uniq.push(r);
            }
            uniq.slice(0, 7).forEach((r, i) => {
              out.metrics['地域Top' + (i+1) + '-省'] = r.name;
              out.metrics['地域Top' + (i+1) + '-占比%'] = r.pct;
            });
          }

          const devIdx = text.indexOf('设备');
          if (devIdx >= 0) {
            const seg = text.slice(devIdx, devIdx + 2500);
            const brands = ['apple','huawei','xiaomi','vivo','oppo','honor','samsung','oneplus','realme','wiko'];
            for (const b of brands) {
              const mm = seg.match(new RegExp(b + '\\\\s*([0-9\\\\.]+%)','i'));
              if (mm) out.metrics['设备-' + b + '%'] = mm[1];
            }
          }

          const intIdx = text.indexOf('兴趣');
          if (intIdx >= 0) {
            const seg = text.slice(intIdx, intIdx + 2200);
            const rows = Array.from(seg.matchAll(/([\\u4e00-\\u9fa5]{2,10})\\s*([0-9\\.]+%)/g))
              .map(x => ({ name:x[1], pct:x[2] }));
            const seen = new Set();
            const uniq = [];
            for (const r of rows) {
              const key = r.name + r.pct;
              if (seen.has(key)) continue;
              seen.add(key);
              uniq.push(r);
            }
            uniq.slice(0, 5).forEach((r, i) => {
              out.metrics['兴趣Top' + (i+1) + '-类目'] = r.name;
              out.metrics['兴趣Top' + (i+1) + '-占比%'] = r.pct;
            });
          }
        }

        return out;
      })()
    `;
    return await webContents.executeJavaScript(js, true);
  } catch (_) {
    return { metrics: {}, creator: {}, notesTop: [] };
  }
}

async function pgySuggestNoteCardSelectorForCurrentPage(webContents) {
  try {
    const js = `
      (function(){
        const buildSel = (el) => {
          if (!el || el.nodeType !== 1) return null;
          if (el.id) return '#' + CSS.escape(el.id);
          const tag = el.tagName.toLowerCase();
          const cls = (typeof el.className === 'string' ? el.className.split(/\\s+/).filter(Boolean) : []).slice(0,2);
          if (cls.length) return tag + '.' + cls.map(c => CSS.escape(c)).join('.');
          return tag;
        };
        const labelNodes = Array.from(document.querySelectorAll('span,div'))
          .filter(el => (el.textContent || '').trim() === '阅读')
          .slice(0, 200);
        if (!labelNodes.length) return { ok:false, error:'未找到“阅读”标签节点' };
        const hasMetricLabels = (root) => {
          const t = (root.textContent || '');
          const ok1 = t.includes('阅读');
          const ok2 = t.includes('点赞');
          const ok3 = t.includes('收藏');
          const ok4 = t.includes('发布时间');
          const score = (ok1?1:0) + (ok2?1:0) + (ok3?1:0) + (ok4?1:0);
          return score >= 2;
        };
        const cards = [];
        const seenEl = new Set();
        for (const n of labelNodes) {
          let el = n;
          for (let d = 0; d < 7; d++) {
            if (!el) break;
            if (el.nodeType === 1 && hasMetricLabels(el)) {
              if (!seenEl.has(el)) { seenEl.add(el); cards.push(el); }
              break;
            }
            el = el.parentElement;
          }
        }
        if (cards.length < 3) return { ok:false, error:'卡片数量过少（请滚动让列表加载）', cardCount: cards.length };
        const seen = new Set();
        const cand = [];
        for (const c of cards.slice(0, 60)) {
          let el = c;
          for (let d=0; d<4; d++) {
            if (!el) break;
            const sel = buildSel(el);
            if (sel && !seen.has(sel)) {
              seen.add(sel);
              let cnt = 0;
              let ok = false;
              try {
                const nodes = Array.from(document.querySelectorAll(sel));
                cnt = nodes.length;
                const hits = nodes.slice(0, 50).filter(x => (x.textContent || '').includes('阅读')).length;
                ok = cnt >= 3 && cnt <= 400 && hits >= Math.max(2, Math.floor(Math.min(50, nodes.length) * 0.6));
              } catch (_) { cnt = 0; ok = false; }
              if (ok) cand.push({ sel, cnt });
            }
            el = el.parentElement;
          }
        }
        if (!cand.length) return { ok:false, error:'未能推断 selector' };
        cand.sort((a,b) => b.cnt - a.cnt);
        return { ok:true, noteCardSelector: cand[0].sel, cardCount: cand[0].cnt };
      })()
    `;
    return await webContents.executeJavaScript(js, true);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

// =========================
// IPC：PGY 从当前达人页测试提取（多页：达人详情页 + tabs）
// =========================
async function pgyExtractCurrentMultiPage(templatePath, options) {
  if (!browserView) return { ok: false, error: 'browserView 未初始化' };

  const safeTemplatePath = resolveInsideTemplates(templatePath);
  if (!safeTemplatePath) return { ok: false, error: '非法路径：只允许使用 templates 目录内模板' };
  if (!fs.existsSync(safeTemplatePath)) return { ok: false, error: '模板文件不存在' };

  let template = null;
  try {
    template = JSON.parse(fs.readFileSync(safeTemplatePath, 'utf-8'));
  } catch (err) {
    return { ok: false, error: `模板解析失败：${String(err?.message || err)}` };
  }

  const opt = options || {};
  const runId = String(opt.runId || '').trim() || makeRunId();
  const runDir = path.join(getRunsDir(), runId);
  const evidenceDir = path.join(runDir, 'evidence');
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

  const tabTexts = Array.isArray(opt.tabTexts) && opt.tabTexts.length
    ? opt.tabTexts
    : Array.isArray(template?.tabTexts) && template.tabTexts.length
      ? template.tabTexts
      : ['数据概览', '笔记数据', '粉丝分析'];

  const tabWaitMs = Number(opt.tabWaitMs || 0) > 0 ? Number(opt.tabWaitMs) : 1200;
  const resolveNoteUrlByClick = opt.resolveNoteUrlByClick ?? template?.resolveNoteUrlByClick ?? true;
  const resolveLimit = Number(opt.resolveLimit || 0) > 0 ? Number(opt.resolveLimit) : 10;

  const pages = [];
  const mergedSummary = {};
  let mergedNotes = [];
  let noteUrlResolve = { resolved: 0, lastClipboardSample: '' };
  let mergedMetrics = {};
  let notesTop10 = [];
  let noteCardSelector = String(template?.noteCardSelector || '').trim();

  const mergeMetrics = (delta) => {
    if (!delta || typeof delta !== 'object') return;
    for (const [k, v] of Object.entries(delta)) {
      if (v === undefined || v === null) continue;
      const s = String(v).trim();
      if (!s || s === '-') continue;
      if (!mergedMetrics[k]) mergedMetrics[k] = s;
    }
  };

  const extractOnce = async (pageName, tabText) => {
    const baseUrl = browserView.webContents.getURL();
    const extracted = await extractFromTemplate(browserView.webContents, template, { baseUrl });
    // 强制以真实页面 URL 为准，避免被历史遗留的非空字段（例如带反引号）“锁死”不更新
    try {
      if (extracted?.creator_summary) extracted.creator_summary.creator_url = baseUrl;
    } catch (_) {}
    const evidence = await saveEvidence(browserView.webContents, evidenceDir, pageName);
    pages.push({
      name: pageName,
      url: baseUrl,
      evidence
    });

    // 资源表 v1：额外抽取（缺失留空）
    try {
      const key = tabText ? String(tabText) : 'base';
      if (key.includes('笔记') && !noteCardSelector) {
        const s = await pgySuggestNoteCardSelectorForCurrentPage(browserView.webContents);
        if (s?.ok && s.noteCardSelector) noteCardSelector = String(s.noteCardSelector);
      }
      const delta = await pgyExtractResourceDelta(browserView.webContents, key, noteCardSelector);
      if (delta?.creator && typeof delta.creator === 'object') {
        // 关键字段强覆盖：避免被“登录账号名”等历史值锁死
        if (delta.creator.creator_name) mergedSummary.creator_name = String(delta.creator.creator_name).trim();
        if (delta.creator.xhs_id) mergedSummary.xhs_id = String(delta.creator.xhs_id).trim();
        Object.assign(mergedSummary, mergePreferNonEmpty(mergedSummary, delta.creator));
      }
      if (delta?.metrics && typeof delta.metrics === 'object') mergeMetrics(delta.metrics);
      if (key.includes('笔记') && Array.isArray(delta?.notesTop) && delta.notesTop.length) {
        notesTop10 = delta.notesTop.slice(0, 10);
      }
    } catch (_) {}

    return extracted;
  };

  try {
    const initialUrl = browserView.webContents.getURL();

    // 1) 先采集达人详情页（当前页面）
    const r0 = await extractOnce('0_达人详情页', '');
    Object.assign(mergedSummary, mergePreferNonEmpty(mergedSummary, r0.creator_summary));
    mergedNotes = mergeNotesUnique(mergedNotes, r0.notes);

    // 2) 依次尝试点击 tab -> 每个页面采集并合并
    for (let i = 0; i < tabTexts.length; i++) {
      const tabText = tabTexts[i];
      if (!tabText) continue;
      const click = await clickTabByText(browserView.webContents, tabText);
      if (!click.ok) {
        pages.push({
          name: `tab_${i + 1}_${safeName(tabText)}`,
          tabText,
          ok: false,
          reason: click?.detail?.reason || 'not_found'
        });
        continue;
      }
      await sleep(tabWaitMs);
      const r = await extractOnce(`tab_${i + 1}_${safeName(tabText)}`, tabText);
      // 在“笔记数据”tab 上尝试通过点击卡片补全 note_url（页面往往没有 href）
      if (resolveNoteUrlByClick && String(tabText).includes('笔记')) {
        try {
          noteUrlResolve = await resolveNoteUrlsByClick(
            browserView.webContents,
            r.notes,
            r?._meta?.noteCardSelector,
            { limit: resolveLimit }
          );
        } catch (_) {}
      }
      Object.assign(mergedSummary, mergePreferNonEmpty(mergedSummary, r.creator_summary));
      mergedNotes = mergeNotesUnique(mergedNotes, r.notes);
    }

    const rawResult = {
      platform: template?.platform || 'pgy',
      creator_url: initialUrl,
      creator_summary: mergedSummary,
      notes: mergedNotes,
      metrics: mergedMetrics,
      notes_top10: notesTop10,
      crawl_time: new Date().toISOString(),
      pages,
      _debug: {
        noteUrlResolved: noteUrlResolve?.resolved || 0,
        noteUrlClipboardSample: noteUrlResolve?.lastClipboardSample || '',
        noteCardSelector: noteCardSelector || ''
      }
    };

    // 规范化少量关键字段（避免历史遗留/拷贝带反引号等）
    try {
      if (rawResult?.creator_summary?.creator_url) {
        rawResult.creator_summary.creator_url = applyTransform(rawResult.creator_summary.creator_url, 'url', { baseUrl: initialUrl });
      } else if (rawResult?.creator_summary) {
        rawResult.creator_summary.creator_url = applyTransform(initialUrl, 'url', { baseUrl: initialUrl });
      }
      if (rawResult?.creator_url) {
        rawResult.creator_url = applyTransform(rawResult.creator_url, 'url', { baseUrl: initialUrl });
      }
    } catch (_) {}

    const qualityReport = buildQualityReport(rawResult);
    rawResult.quality_report = qualityReport;

    const jsonPath = path.join(runDir, 'raw_result.json');
    fs.writeFileSync(jsonPath, JSON.stringify(rawResult, null, 2), 'utf-8');
    const qualityPath = path.join(runDir, 'quality_report.json');
    fs.writeFileSync(qualityPath, JSON.stringify(qualityReport, null, 2), 'utf-8');

    return {
      ok: true,
      runId,
      runDir,
      jsonPath,
      qualityPath,
      qualityReport,
      evidenceDir,
      debug: rawResult._debug,
      preview: {
        creator_summary: rawResult.creator_summary,
        notes_count: mergedNotes.length,
        notes_sample: mergedNotes.slice(0, 5)
      }
    };
  } catch (err) {
    try {
      const evidence = await saveEvidence(browserView.webContents, evidenceDir, 'error_current_page');
      fs.writeFileSync(
        path.join(runDir, 'error.json'),
        JSON.stringify({ error: String(err?.message || err), evidence }, null, 2),
        'utf-8'
      );
    } catch (_) {}
    return { ok: false, error: String(err?.message || err), runId, runDir };
  }
}

ipcMain.handle('pgy:extractCurrentMultiPage', async (_e, templatePath, options) => {
  return await pgyExtractCurrentMultiPage(templatePath, options);
});

// =========================
// IPC：录制/回放
// =========================
ipcMain.handle('recording:start', async () => {
  recordingEnabled = true;
  currentRecording = [];
  mainWindow?.webContents.send('recording:count', 0);
  return { ok: true };
});

ipcMain.handle('recording:stop', async () => {
  recordingEnabled = false;
  const dir = getRecordingsDir();
  const filename = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        createdAt: Date.now(),
        meta: { platform: 'pgy', mode: 'safe_dom', vars: ['creator_url'] },
        actions: currentRecording
      },
      null,
      2
    ),
    'utf-8'
  );
  return { ok: true, filePath };
});

ipcMain.on('recording:action', (_e, action) => {
  if (!recordingEnabled) return;
  currentRecording.push({ ...action, t: Date.now() });
  mainWindow?.webContents.send('recording:count', currentRecording.length);
});

ipcMain.handle('recording:list', async () => {
  const dir = getRecordingsDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse();
  const items = files.map((f) => {
    const p = path.join(dir, f);
    let createdAt = null;
    let actionCount = null;
    let meta = null;
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      const data = JSON.parse(raw);
      createdAt = data?.createdAt || null;
      actionCount = Array.isArray(data?.actions) ? data.actions.length : null;
      meta = data?.meta || null;
    } catch (_) {}
    return { name: f, path: p, createdAt, actionCount, meta };
  });
  return { ok: true, files: items };
});

ipcMain.handle('recording:delete', async (_e, filePath) => {
  const src = resolveInsideRecordings(filePath);
  if (!src) return { ok: false, error: '非法路径：只允许操作 recordings 目录内文件' };
  if (!fs.existsSync(src)) return { ok: false, error: '文件不存在' };
  try {
    fs.unlinkSync(src);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('recording:rename', async (_e, filePath, newName) => {
  const src = resolveInsideRecordings(filePath);
  if (!src) return { ok: false, error: '非法路径：只允许操作 recordings 目录内文件' };
  if (!fs.existsSync(src)) return { ok: false, error: '文件不存在' };

  const base = path.basename(String(newName || '').trim());
  if (!base || base === '.' || base === '..') return { ok: false, error: '新文件名不能为空' };
  if (base.includes('/') || base.includes('\\') || base.includes(path.sep)) return { ok: false, error: '新文件名不合法' };
  const finalBase = base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
  const dst = resolveInsideRecordings(path.join(getRecordingsDir(), finalBase));
  if (!dst) return { ok: false, error: '新文件名不合法' };
  if (fs.existsSync(dst)) return { ok: false, error: '目标文件已存在' };

  try {
    fs.renameSync(src, dst);
    return { ok: true, filePath: dst, name: path.basename(dst) };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('recording:openFolder', async () => {
  try {
    const p = getRecordingsDir();
    const r = await shell.openPath(p);
    if (r) return { ok: false, error: r };
    return { ok: true, path: p };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('recording:replay', async (_e, filePath) => {
  if (!browserView) return { ok: false, error: 'browserView 未初始化' };
  const safePath = resolveInsideRecordings(filePath);
  if (!safePath) return { ok: false, error: '非法路径：只允许回放 recordings 目录内文件' };
  if (!safePath || !fs.existsSync(safePath)) return { ok: false, error: '文件不存在' };

  const raw = fs.readFileSync(safePath, 'utf-8');
  const data = JSON.parse(raw);
  const actions = data.actions || [];

  // 回放：先关闭录制，避免把回放又录进去
  recordingEnabled = false;

  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (a.type === 'navigate' && a.url) {
      try {
        await browserView.webContents.loadURL(a.url);
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 600));
      continue;
    }

    if (a.type === 'click' && a.selector) {
      const okWait = await browserView.webContents.executeJavaScript(
        buildWaitForSelectorJs(a.selector, 10000),
        true
      );
      if (!okWait) {
        return {
          ok: false,
          code: 'WAIT_FOR_SELECTOR_TIMEOUT',
          error: `click 前等待元素出现超时：${a.selector}`,
          stepIndex: i,
          action: a
        };
      }
      const js = `
        (function(){
          let el = null;
          try { el = document.querySelector(${JSON.stringify(a.selector)}); } catch (_) {}
          if (!el) return false;
          el.scrollIntoView({block:'center'});
          try { el.click(); return true; } catch (_) { return false; }
        })()
      `;
      let okClick = false;
      try { okClick = await browserView.webContents.executeJavaScript(js, true); } catch (_) {}
      if (!okClick) {
        return {
          ok: false,
          code: 'ACTION_FAILED',
          error: `click 执行失败：${a.selector}`,
          stepIndex: i,
          action: a
        };
      }
      await new Promise((r) => setTimeout(r, 450));
      continue;
    }

    if (a.type === 'input' && a.selector) {
      const okWait = await browserView.webContents.executeJavaScript(
        buildWaitForSelectorJs(a.selector, 10000),
        true
      );
      if (!okWait) {
        return {
          ok: false,
          code: 'WAIT_FOR_SELECTOR_TIMEOUT',
          error: `input 前等待元素出现超时：${a.selector}`,
          stepIndex: i,
          action: a
        };
      }
      const js = `
        (function(){
          let el = null;
          try { el = document.querySelector(${JSON.stringify(a.selector)}); } catch (_) {}
          if (!el) return false;
          el.scrollIntoView({block:'center'});
          try {
            el.focus();
            el.value = ${JSON.stringify(a.value || '')};
            el.dispatchEvent(new Event('input', {bubbles:true}));
            el.dispatchEvent(new Event('change', {bubbles:true}));
            return true;
          } catch (_) { return false; }
        })()
      `;
      let okInput = false;
      try { okInput = await browserView.webContents.executeJavaScript(js, true); } catch (_) {}
      if (!okInput) {
        return {
          ok: false,
          code: 'ACTION_FAILED',
          error: `input 执行失败：${a.selector}`,
          stepIndex: i,
          action: a
        };
      }
      await new Promise((r) => setTimeout(r, 450));
      continue;
    }
  }

  return { ok: true };
});

// =========================
// IPC：模板（list/load/save/clone）
// =========================
ipcMain.handle('template:list', async () => {
  try {
    const dir = getTemplatesDir();
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')).sort().reverse();
    const items = files.map((f) => {
      const p = path.join(dir, f);
      let meta = {};
      let mtime = null;
      try {
        const st = fs.statSync(p);
        mtime = st.mtimeMs || null;
      } catch (_) {}
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const data = JSON.parse(raw);
        meta = {
          version: data?.version,
          platform: data?.platform,
          mode: data?.mode
        };
      } catch (_) {}
      return { name: f, path: p, mtime, ...meta };
    });
    return { ok: true, files: items };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('template:load', async (_e, filePath) => {
  const safePath = resolveInsideTemplates(filePath);
  if (!safePath) return { ok: false, error: '非法路径：只允许操作 templates 目录内文件' };
  if (!fs.existsSync(safePath)) return { ok: false, error: '文件不存在' };
  try {
    const raw = fs.readFileSync(safePath, 'utf-8');
    const data = JSON.parse(raw);
    return { ok: true, filePath: safePath, data };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('template:save', async (_e, filePath, contentJson) => {
  try {
    const dir = getTemplatesDir();

    let target = null;
    if (filePath) {
      target = resolveInsideTemplates(filePath);
      if (!target) return { ok: false, error: '非法路径：只允许操作 templates 目录内文件' };
    } else {
      const filename = `template_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      target = path.join(dir, filename);
    }

    fs.writeFileSync(target, JSON.stringify(contentJson || {}, null, 2), 'utf-8');
    return { ok: true, filePath: target, name: path.basename(target) };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('template:clone', async (_e, srcPath, newName) => {
  const src = resolveInsideTemplates(srcPath);
  if (!src) return { ok: false, error: '非法路径：只允许操作 templates 目录内文件' };
  if (!fs.existsSync(src)) return { ok: false, error: '源文件不存在' };

  const dir = getTemplatesDir();
  const base0 = String(newName || '').trim();
  const baseCandidate = base0 ? path.basename(base0) : '';
  let finalBase = baseCandidate;
  if (!finalBase) {
    const stem = path.basename(src, path.extname(src));
    finalBase = `${stem}_clone_${Date.now()}.json`;
  } else {
    if (finalBase.includes('/') || finalBase.includes('\\') || finalBase.includes(path.sep)) {
      return { ok: false, error: '新文件名不合法' };
    }
    if (!finalBase.toLowerCase().endsWith('.json')) finalBase = `${finalBase}.json`;
  }

  const dst = resolveInsideTemplates(path.join(dir, finalBase));
  if (!dst) return { ok: false, error: '新文件名不合法' };
  if (fs.existsSync(dst)) return { ok: false, error: '目标文件已存在' };

  try {
    fs.copyFileSync(src, dst);
    return { ok: true, filePath: dst, name: path.basename(dst) };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

// =========================
// IPC：批量任务（start/pause/resume/skipCurrent）
// =========================
ipcMain.handle('tasks:start', async (_e, payload) => {
  if (!taskRunner) return { ok: false, error: 'taskRunner 未初始化' };
  return await taskRunner.start(payload || {});
});

ipcMain.handle('tasks:pause', async () => {
  if (!taskRunner) return { ok: false, error: 'taskRunner 未初始化' };
  return await taskRunner.pause('user');
});

ipcMain.handle('tasks:resume', async () => {
  if (!taskRunner) return { ok: false, error: 'taskRunner 未初始化' };
  return await taskRunner.resume();
});

ipcMain.handle('tasks:skipCurrent', async () => {
  if (!taskRunner) return { ok: false, error: 'taskRunner 未初始化' };
  return await taskRunner.skipCurrent();
});

ipcMain.handle('tasks:openRunDir', async () => {
  if (!taskRunner) return { ok: false, error: 'taskRunner 未初始化' };
  const dir = taskRunner?.state?.runDir || '';
  if (!dir) return { ok: false, error: 'runDir 为空' };
  try {
    const r = await shell.openPath(dir);
    return r ? { ok: false, error: r } : { ok: true, dir };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('tasks:openRunsDir', async () => {
  try {
    const dir = getRunsDir();
    const r = await shell.openPath(dir);
    return r ? { ok: false, error: r } : { ok: true, dir };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

function _pickFirstPgyUrl(s) {
  if (s == null) return null;
  const t = String(s);
  const m = t.match(/https?:\/\/pgy\.xiaohongshu\.com\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

function _pickFirstXhsUrl(s) {
  if (s == null) return null;
  const t = String(s);
  const m = t.match(/https?:\/\/(?:www\.)?xiaohongshu\.com\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

function _findKeyByHeader(row, keywords) {
  const keys = Object.keys(row || {});
  for (const k of keys) {
    const name = String(k || '').trim();
    if (!name) continue;
    if (keywords.some((kw) => name.includes(kw))) return k;
  }
  return null;
}

function parseExcelToPgyItems(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const items = [];
  const seen = new Set();

  const sheetNames = wb.SheetNames || [];
  let scannedSheets = 0;
  let scannedRows = 0;
  let extracted = 0;

  for (const sheet of sheetNames) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
    if (!Array.isArray(rows) || rows.length === 0) continue;
    scannedSheets += 1;

    // 尝试从表头自动识别列
    const sample = rows[0] || {};
    const colName = _findKeyByHeader(sample, ['达人昵称', '昵称', '达人', '博主', 'KOL']);
    const colPgy = _findKeyByHeader(sample, ['蒲公英', 'pgy', 'PGY']);
    const colXhs = _findKeyByHeader(sample, ['主页链接', '主页', '小红书', 'XHS']);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      scannedRows += 1;

      let pgyUrl = colPgy ? _pickFirstPgyUrl(r[colPgy]) : null;
      let xhsUrl = colXhs ? _pickFirstXhsUrl(r[colXhs]) : null;

      if (!pgyUrl) {
        // fallback: 扫描整行
        for (const v of Object.values(r)) {
          pgyUrl = _pickFirstPgyUrl(v);
          if (pgyUrl) break;
        }
      }
      if (!xhsUrl) {
        for (const v of Object.values(r)) {
          xhsUrl = _pickFirstXhsUrl(v);
          if (xhsUrl) break;
        }
      }
      if (!pgyUrl) continue;

      // 去重按蒲公英链接
      if (seen.has(pgyUrl)) continue;
      seen.add(pgyUrl);
      extracted += 1;

      let creatorName = '';
      if (colName && r[colName] && !_pickFirstPgyUrl(r[colName]) && !_pickFirstXhsUrl(r[colName])) {
        creatorName = String(r[colName]).trim();
      }
      items.push({
        creator_name: creatorName,
        pgy_url: pgyUrl,
        xhs_url: xhsUrl || '',
        sheet,
        row_index: i + 2 // 近似 Excel 行号（表头占 1 行）
      });
    }
  }

  return {
    ok: true,
    filePath,
    items,
    stats: {
      sheets: scannedSheets,
      rows: scannedRows,
      extracted,
      deduped: items.length
    }
  };
}

ipcMain.handle('tasks:importExcel', async () => {
  try {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: '选择媒介资源表（Excel）',
      properties: ['openFile'],
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xlsm', 'xls'] }]
    });
    if (r.canceled || !r.filePaths?.[0]) return { ok: false, canceled: true };
    const filePath = r.filePaths[0];
    return parseExcelToPgyItems(filePath);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

function cleanStr(v) {
  if (v === undefined || v === null) return '';
  let s = String(v).trim();
  // 去掉 `...` / "..."/'...'
  for (let i = 0; i < 2; i++) {
    const t = s.trim();
    if ((t.startsWith('`') && t.endsWith('`')) || (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      s = t.slice(1, -1).trim();
    } else {
      s = t;
      break;
    }
  }
  return s;
}

function listRunDirs() {
  const runsDir = getRunsDir();
  const names = fs.readdirSync(runsDir).filter((n) => n.startsWith('run_'));
  const items = names
    .map((name) => {
      const p = path.join(runsDir, name);
      try {
        const st = fs.statSync(p);
        if (!st.isDirectory()) return null;
        return { name, path: p, mtimeMs: st.mtimeMs };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  return items;
}

function findRawResultFiles(runDir) {
  const out = [];
  // 允许 runDir 下直接放 raw_result.json，或放在一级子目录下
  const direct = path.join(runDir, 'raw_result.json');
  if (fs.existsSync(direct)) out.push(direct);
  const children = fs.readdirSync(runDir);
  for (const c of children) {
    const p = path.join(runDir, c);
    let st = null;
    try { st = fs.statSync(p); } catch (_) { st = null; }
    if (!st || !st.isDirectory()) continue;
    const fp = path.join(p, 'raw_result.json');
    if (fs.existsSync(fp)) out.push(fp);
  }
  return out;
}

function getResourceTableColumns() {
  const cols = [
    '平台','数据更新至','达人昵称','小红书号','达人主页','标签','地区',
    '粉丝数','获赞与收藏','图文笔记一口价','视频笔记一口价',
    // 数据概览
    '曝光中位数','阅读中位数','互动中位数','外溢进店中位数',
    '中位点赞量','中位收藏量','中位评论量','中位分享量','中位关注量',
    '互动率','视频完播率','图文3秒阅读率','千赞笔记比例','百赞笔记比例',
    '近7天活跃天数','邀约48小时回复率','粉丝量变化幅度',
    '阅读量来源-发现页%','阅读量来源-搜索页%','阅读量来源-关注页%','阅读量来源-博主个人页%','阅读量来源-附近页%','阅读量来源-其他%',
    '曝光量来源-发现页%','曝光量来源-搜索页%','曝光量来源-关注页%','曝光量来源-博主个人页%','曝光量来源-附近页%','曝光量来源-其他%',
    // 粉丝分析
    '粉丝增量','活跃粉丝占比','阅读粉丝占比','互动粉丝占比',
    '性别-女性%','性别-男性%',
    '年龄-<18%','年龄-18-24%','年龄-25-34%','年龄-35-44%','年龄->44%',
    '地域Top1-省','地域Top1-占比%','地域Top2-省','地域Top2-占比%','地域Top3-省','地域Top3-占比%',
    '地域Top4-省','地域Top4-占比%','地域Top5-省','地域Top5-占比%','地域Top6-省','地域Top6-占比%','地域Top7-省','地域Top7-占比%',
    '设备-apple%','设备-huawei%','设备-xiaomi%','设备-vivo%','设备-oppo%','设备-honor%','设备-samsung%','设备-oneplus%','设备-realme%','设备-wiko%',
    '兴趣Top1-类目','兴趣Top1-占比%','兴趣Top2-类目','兴趣Top2-占比%','兴趣Top3-类目','兴趣Top3-占比%','兴趣Top4-类目','兴趣Top4-占比%','兴趣Top5-类目','兴趣Top5-占比%'
  ];
  for (let i = 1; i <= 10; i++) {
    cols.push(`笔记${i}-标题`, `笔记${i}-阅读`, `笔记${i}-点赞`, `笔记${i}-收藏`, `笔记${i}-发布时间`, `笔记${i}-含推广`);
  }
  return cols;
}

function getResourceTableGroups(columns) {
  const cols = Array.isArray(columns) ? columns : [];
  const notesIdx = cols.findIndex((c) => String(c).startsWith('笔记1-标题'));
  const notesCols = notesIdx >= 0 ? cols.slice(notesIdx) : cols.filter((c) => String(c).startsWith('笔记'));
  const other = notesIdx >= 0 ? cols.slice(0, notesIdx) : cols.filter((c) => !String(c).startsWith('笔记'));

  const pick = (names) => other.filter((c) => names.includes(c));
  const basic = pick(['平台','数据更新至','达人昵称','小红书号','达人主页','标签','地区']);
  const quote = pick(['粉丝数','获赞与收藏','图文笔记一口价','视频笔记一口价']);
  const overview = other.filter((c) => (
    ['曝光中位数','阅读中位数','互动中位数','外溢进店中位数',
     '中位点赞量','中位收藏量','中位评论量','中位分享量','中位关注量',
     '互动率','视频完播率','图文3秒阅读率','千赞笔记比例','百赞笔记比例',
     '近7天活跃天数','邀约48小时回复率','粉丝量变化幅度',
     '阅读量来源-发现页%','阅读量来源-搜索页%','阅读量来源-关注页%','阅读量来源-博主个人页%','阅读量来源-附近页%','阅读量来源-其他%',
     '曝光量来源-发现页%','曝光量来源-搜索页%','曝光量来源-关注页%','曝光量来源-博主个人页%','曝光量来源-附近页%','曝光量来源-其他%']
      .includes(c)
  ));
  const fans = other.filter((c) => !basic.includes(c) && !quote.includes(c) && !overview.includes(c));

  const groups = [];
  if (basic.length) groups.push({ name: '基础信息', columns: basic });
  if (quote.length) groups.push({ name: '报价&规模', columns: quote });
  if (overview.length) groups.push({ name: '数据概览', columns: overview });
  if (fans.length) groups.push({ name: '粉丝分析', columns: fans });
  if (notesCols.length) groups.push({ name: '笔记Top10', columns: notesCols });
  return groups;
}

function normalizeSelectedColumns(selected, allColumns) {
  const all = Array.isArray(allColumns) ? allColumns : [];
  const setAll = new Set(all);
  const sel = Array.isArray(selected) ? selected.map((x) => String(x)) : [];
  const out = [];
  const seen = new Set();
  for (const c of sel) {
    if (!setAll.has(c)) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out.length ? out : all.slice();
}

function getColumnPresetPath() {
  const dir = path.join(app.getPath('userData'), 'export_presets');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'resource_columns.json');
}

function exportRunToExcel(runDir) {
  const jsonFiles = findRawResultFiles(runDir);
  const results = [];
  for (const fp of jsonFiles) {
    try {
      const obj = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      results.push({ fp, obj });
    } catch (_) {}
  }

  const creators = [];
  const notes = [];
  for (const r of results) {
    const obj = r.obj || {};
    const sum = obj.creator_summary || {};
    const creator_name = cleanStr(sum.creator_name || sum.name || '');
    const creator_url = cleanStr(sum.creator_url || obj.creator_url || '');
    const followers = sum.followers ?? null;

    creators.push({
      creator_name,
      creator_url,
      followers,
      run_subdir: path.basename(path.dirname(r.fp)),
      json_path: r.fp
    });

    const list = Array.isArray(obj.notes) ? obj.notes : [];
    for (const n of list) {
      notes.push({
        creator_name,
        creator_url,
        note_title: cleanStr(n?.note_title || ''),
        note_url: cleanStr(n?.note_url || ''),
        run_subdir: path.basename(path.dirname(r.fp))
      });
    }
  }

  // SheetJS: json -> sheet
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(creators);
  const ws2 = XLSX.utils.json_to_sheet(notes);
  XLSX.utils.book_append_sheet(wb, ws1, '达人汇总');
  XLSX.utils.book_append_sheet(wb, ws2, '笔记明细');

  const base = path.basename(runDir);
  const outName = `蒲公英采集结果_${base}.xlsx`;
  const outPath = path.join(runDir, outName);
  XLSX.writeFile(wb, outPath);
  return { outPath, creators: creators.length, notes: notes.length, files: jsonFiles.length };
}

function exportRunToResourceXlsx(runDir, opts) {
  const jsonFiles = findRawResultFiles(runDir);
  const results = [];
  for (const fp of jsonFiles) {
    try {
      const obj = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      results.push({ fp, obj });
    } catch (_) {}
  }

  const allCols = getResourceTableColumns();
  const cols = normalizeSelectedColumns(opts?.selectedColumns, allCols);

  let creatorCount = 0;
  let noteCount = 0;
  const rows = [];

  for (const r of results) {
    const obj = r.obj || {};
    const sum = obj.creator_summary || {};
    const metrics = obj.metrics || {};
    const top = Array.isArray(obj.notes_top10) ? obj.notes_top10 : [];

    const row = {};
    row['平台'] = String(obj.platform || 'pgy');
    row['数据更新至'] = cleanStr(metrics['数据更新至'] || '');
    row['达人昵称'] = cleanStr(sum.creator_name || sum.name || '');
    row['小红书号'] = cleanStr(sum.xhs_id || sum.xhsId || '');
    row['达人主页'] = cleanStr(sum.creator_url || obj.creator_url || '');
    row['标签'] = cleanStr(sum.tags || '');
    row['地区'] = cleanStr(sum.location || sum.region || '');

    // 直接映射同名字段（从全量列名中映射，避免 selectedColumns 丢失字段名时无法赋值）
    for (const k of allCols) {
      if (row[k] !== undefined) continue;
      if (metrics && metrics[k] !== undefined) row[k] = cleanStr(metrics[k]);
    }

    for (let i = 1; i <= 10; i++) {
      const n = top[i - 1] || {};
      row[`笔记${i}-标题`] = cleanStr(n['标题'] || n.title || '');
      row[`笔记${i}-阅读`] = cleanStr(n['阅读'] || n.read || '');
      row[`笔记${i}-点赞`] = cleanStr(n['点赞'] || n.like || '');
      row[`笔记${i}-收藏`] = cleanStr(n['收藏'] || n.collect || '');
      row[`笔记${i}-发布时间`] = cleanStr(n['发布时间'] || n.date || '');
      row[`笔记${i}-含推广`] = cleanStr(n['含推广'] || n.promo || '');
      if (row[`笔记${i}-标题`]) noteCount += 1;
    }

    rows.push(row);
    creatorCount += 1;
  }

  const base = path.basename(runDir);
  const mode = String(opts?.mode || 'full');
  const outName = mode === 'slim' ? `媒介资源表_${base}_精简版.xlsx` : `媒介资源表_${base}.xlsx`;
  const outPath = path.join(runDir, outName);

  // 1) 去掉“整列全为空”的列（用户选择 A 策略）
  const alwaysKeep = new Set(['平台', '达人昵称', '小红书号', '达人主页']);
  const finalCols = cols.filter((c) => {
    if (alwaysKeep.has(c)) return true;
    return rows.some((r) => {
      const v = r[c];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
  });

  // 2) 导出美化（优先 ExcelJS；若依赖缺失则回退到 SheetJS）
  if (ExcelJS) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'content-analyzer-desktop';
    wb.created = new Date();
    const ws = wb.addWorksheet('媒介资源表', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    // columns + width（根据内容自动估算）
    const isLongCol = (h) => /标题|达人主页|标签/.test(h);
    const estimateWidth = (h) => {
      const sampleMax = Math.max(
        h.length,
        ...rows.slice(0, 200).map((r) => String(r[h] ?? '').length)
      );
      const base = isLongCol(h) ? 18 : 10;
      return Math.min(Math.max(base, Math.min(sampleMax + 2, 40)), 60);
    };

    ws.columns = finalCols.map((h) => ({
      header: h,
      key: h,
      width: estimateWidth(h)
    }));

    // header style（浅底深字，保证可读性）
    const headerRow = ws.getRow(1);
    // 约 2cm（ExcelJS 的 row.height 单位为 points）
    headerRow.height = 57;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    });

    // data rows
    const isNumericLike = (h) => /数|量|价|率|%|占比|阅读|点赞|收藏|曝光|互动|中位/.test(h);
    // 笔记区分色：从“笔记1-标题”开始的所有 Top10 笔记列
    const notesStartIdx = Math.max(0, finalCols.findIndex((h) => String(h).startsWith('笔记1-标题')));
    for (const r of rows) {
      const added = ws.addRow(finalCols.map((c) => (r[c] === undefined ? '' : r[c])));
      added.height = 20;
      added.eachCell((cell, colNumber) => {
        const h = finalCols[colNumber - 1];
        cell.font = { name: 'Arial', size: 11, color: { argb: 'FF111827' } };
        // 默认白底；笔记区用浅黄色做分区
        const isNotesCol = notesStartIdx >= 0 && notesStartIdx > 0 ? (colNumber - 1) >= notesStartIdx : String(h).startsWith('笔记');
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isNotesCol ? 'FFFFF7CC' : 'FFFFFFFF' } };
        cell.alignment = {
          vertical: 'top',
          horizontal: isNumericLike(h) ? 'right' : 'left',
          wrapText: isLongCol(h)
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFF3F4F6' } },
          left: { style: 'thin', color: { argb: 'FFF3F4F6' } },
          bottom: { style: 'thin', color: { argb: 'FFF3F4F6' } },
          right: { style: 'thin', color: { argb: 'FFF3F4F6' } }
        };
      });
    }

    // auto filter
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: finalCols.length }
    };

    wb.xlsx.writeFile(outPath);
    return { outPath, creators: creatorCount, notesTop: noteCount, files: jsonFiles.length, droppedCols: cols.length - finalCols.length, selectedCols: cols.length };
  }

  // fallback: SheetJS（无样式，但至少列减少）
  const aoa = [finalCols];
  for (const r of rows) aoa.push(finalCols.map((c) => (r[c] === undefined ? '' : r[c])));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, '媒介资源表');
  XLSX.writeFile(wb, outPath);
  return { outPath, creators: creatorCount, notesTop: noteCount, files: jsonFiles.length, droppedCols: cols.length - finalCols.length, selectedCols: cols.length };
}

ipcMain.handle('exports:getResourceColumns', async () => {
  try {
    const columns = getResourceTableColumns();
    return { ok: true, columns, groups: getResourceTableGroups(columns) };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('exports:loadColumnPreset', async () => {
  try {
    const p = getColumnPresetPath();
    if (!fs.existsSync(p)) return { ok: true, selectedColumns: [] };
    const obj = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const selectedColumns = Array.isArray(obj?.selectedColumns) ? obj.selectedColumns.map(String) : [];
    const knownColumns = Array.isArray(obj?.knownColumns) ? obj.knownColumns.map(String) : [];
    return { ok: true, selectedColumns, knownColumns };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('exports:saveColumnPreset', async (_e, selectedColumns) => {
  try {
    const p = getColumnPresetPath();
    const knownColumns = getResourceTableColumns();
    const payload = {
      selectedColumns: Array.isArray(selectedColumns) ? selectedColumns.map(String) : [],
      knownColumns,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(p, JSON.stringify(payload, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('exports:listRuns', async () => {
  try {
    return { ok: true, runs: listRunDirs() };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('exports:exportRun', async (_e, payload) => {
  try {
    const runDirRaw = payload?.runDir || '';
    const runDir = runDirRaw ? resolveInsideRuns(runDirRaw) : null;
    const pick = runDir || (listRunDirs()[0]?.path || '');
    if (!pick) return { ok: false, error: '未找到 runs 目录或 run_* 目录为空' };
    const r = exportRunToExcel(pick);
    return { ok: true, runDir: pick, ...r };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('exports:exportResourceRun', async (_e, payload) => {
  try {
    const runDirRaw = payload?.runDir || '';
    const runDir = runDirRaw ? resolveInsideRuns(runDirRaw) : null;
    const pick = runDir || (listRunDirs()[0]?.path || '');
    if (!pick) return { ok: false, error: '未找到 runs 目录或 run_* 目录为空' };
    const r = exportRunToResourceXlsx(pick, {
      selectedColumns: payload?.selectedColumns,
      mode: payload?.mode || 'full'
    });
    return { ok: true, runDir: pick, ...r };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('exports:openPath', async (_e, p) => {
  try {
    const t = String(p || '').trim();
    if (!t) return { ok: false, error: 'path 为空' };
    const allowed = resolveInsideAny(t, [getRunsDir(), path.dirname(getColumnPresetPath())]);
    if (!allowed) return { ok: false, error: '非法路径：只允许打开 runs/export 相关目录' };
    const r = await shell.openPath(allowed);
    return r ? { ok: false, error: r } : { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

// =========================
// DB（SQLite）：同步历史 runs / 查询统计
// =========================
ipcMain.handle('db:stats', async () => {
  try {
    const db = await getDb();
    const runs = dbGet(db, 'select count(1) as n from runs')?.n || 0;
    const creators = dbGet(db, 'select count(1) as n from creators')?.n || 0;
    const notes = dbGet(db, 'select count(1) as n from notes')?.n || 0;
    return { ok: true, runs, creators, notes, dbPath: getDbPath() };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('db:syncRuns', async () => {
  try {
    const db = await getDb();
    const runsDir = getRunsDir();
    const r = syncRunsToDb({ db, runsDir, dbPath: getDbPath() });
    // 同步后自动重建知识库（不需要用户额外动作）
    let kb = null;
    try {
      kb = rebuildKbFromDb({ userDataDir: getUserDataDir(), db });
      setKbCacheFromDisk();
    } catch (e) {
      kb = { ok: false, error: String(e?.message || e) };
    }
    return { ...r, kb };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

// =========================
// KB（本地知识库：全文检索）
// =========================
ipcMain.handle('kb:stats', async () => {
  try {
    const kb = getKbIndex();
    const meta = kb.meta || { docCount: 0, builtAt: null };
    return { ok: true, meta };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('kb:rebuild', async () => {
  try {
    const db = await getDb();
    const r = rebuildKbFromDb({ userDataDir: getUserDataDir(), db });
    setKbCacheFromDisk();
    return r;
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('kb:search', async (_e, payload) => {
  try {
    const q = String(payload?.query || '').trim();
    const limit = Number(payload?.limit || 50);
    const kb = getKbIndex();
    if (!kb.index) return { ok: false, error: '知识库尚未构建（请先同步历史数据或点击重建知识库）' };
    const hits = searchIndex(kb.index, q, limit);
    // 限制返回字段，避免过大
    const out = hits.slice(0, Math.max(1, Math.min(200, limit || 50))).map((h) => ({
      id: h.id,
      creator_url: h.creator_url,
      creator_name: h.creator_name,
      xhs_id: h.xhs_id,
      region: h.region,
      tags: h.tags,
      score: h.score
    }));
    return { ok: true, query: q, hits: out };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

// =========================
// AI：配置 + 对话（带可选 SQL 工具）
// =========================
ipcMain.handle('ai:getConfig', async () => {
  try {
    return { ok: true, config: loadAiConfig() };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('ai:setConfig', async (_e, config) => {
  try {
    saveAiConfig(config || {});
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('ai:listModels', async (_e, payload) => {
  try {
    const cfg = loadAiConfig();
    const provider = String(payload?.provider || cfg.activeProvider || 'compat');
    if (provider === 'deepseek') {
      // DeepSeek 官方也支持 /v1/models，但这里先保持简单：返回空，提示用户用 compat 方式拉列表
      return { ok: true, models: [], note: 'deepseek 官方模型列表暂未接入；请使用 OpenAI 兼容供应商拉取模型列表。' };
    }
    const r = await listModelsOpenAICompat({ baseUrl: cfg.compat.baseUrl, apiKey: cfg.compat.apiKey });
    return r;
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

async function _aiCall(provider, cfg, messages) {
  if (provider === 'deepseek') {
    return await chatDeepSeek({ apiKey: cfg.deepseek.apiKey, model: cfg.deepseek.model, messages });
  }
  // compat
  return await chatOpenAICompat({
    baseUrl: cfg.compat.baseUrl,
    apiKey: cfg.compat.apiKey,
    model: cfg.compat.model,
    messages
  });
}

function _isSelectSql(sql) {
  const s = String(sql || '').trim().toLowerCase();
  if (!s) return false;
  if (!s.startsWith('select')) return false;
  if (s.includes(';') && s.split(';').filter(Boolean).length > 1) return false;
  if (/(insert|update|delete|drop|alter|create|pragma|attach|detach)\b/.test(s)) return false;
  return true;
}

ipcMain.handle('ai:chat', async (_e, payload) => {
  try {
    const cfg = loadAiConfig();
    const provider = String(payload?.provider || cfg.activeProvider || 'compat');
    const userMessages = Array.isArray(payload?.messages) ? payload.messages : [];
    const allowSql = payload?.allowSql !== false;

    const system = {
      role: 'system',
      content:
        '你是一个媒介投放数据分析助手。你可以基于本地数据库（SQLite）里历史采集的达人数据做筛选/对比/增长分析。' +
        '\\n\\n数据库表：' +
        '\\n- creators(run_id, creator_url, creator_name, xhs_id, tags, region, followers, likes_fav, price_image, price_video, exposure_median, read_median, interact_median, interact_rate, fans_change_rate, metrics_json)' +
        '\\n- notes(run_id, creator_url, creator_name, idx, title, read_cnt, like_cnt, collect_cnt, publish_date, is_promo)' +
        '\\n\\n如果你需要查询/检索数据，请只输出一段 JSON（不要输出其它文字），格式二选一：' +
        '\\n1) {\"tool\":\"kbSearch\",\"query\":\"通勤穿搭 高级感\",\"limit\":50}' +
        '\\n2) {\"tool\":\"runSql\",\"sql\":\"SELECT ... LIMIT 200\"}' +
        '\\n其中 runSql 查询必须是 SELECT，必须带 LIMIT（<= 2000）。' +
        '\\n拿到工具结果后，你再输出最终的中文结论与推荐（此时不要再输出 JSON）。'
    };

    // tool loop (v1) - at most 2 tool calls
    const messages = [system, ...userMessages];
    for (let step = 0; step < 3; step++) {
      const r = await _aiCall(provider, cfg, messages);
      if (!r?.ok) return r;
      const content = String(r.content || '').trim();

      if (!allowSql) return r;

      let toolReq = null;
      try {
        toolReq = JSON.parse(content);
      } catch (_) {
        toolReq = null;
      }
      if (!toolReq || !toolReq.tool) return r;

      // record the tool request as assistant message
      messages.push({ role: 'assistant', content });

      if (toolReq.tool === 'kbSearch') {
        const query = String(toolReq.query || '').trim();
        const limit = Math.max(1, Math.min(200, Number(toolReq.limit || 50)));
        const kb = getKbIndex();
        if (!kb.index) return { ok: false, error: '知识库尚未构建（请先同步历史数据）' };
        const hits = searchIndex(kb.index, query, limit)
          .slice(0, limit)
          .map((h) => ({
            id: h.id,
            creator_name: h.creator_name,
            xhs_id: h.xhs_id,
            region: h.region,
            tags: h.tags,
            creator_url: h.creator_url,
            score: h.score
          }));
        messages.push({
          role: 'user',
          content: '【知识库检索结果 kbSearch】\\n' + JSON.stringify({ query, hits }, null, 2)
        });
        continue;
      }

      if (toolReq.tool === 'runSql' && toolReq.sql) {
        const sql = String(toolReq.sql || '').trim();
        if (!_isSelectSql(sql)) return { ok: false, error: 'SQL 只允许 SELECT，且不得包含写操作。' };
        if (!/limit\s+\d+/i.test(sql)) return { ok: false, error: 'SQL 必须包含 LIMIT。' };
        const m = sql.match(/limit\s+(\d+)/i);
        const limit = m ? Number(m[1]) : 200;
        if (limit > 2000) return { ok: false, error: 'LIMIT 最大 2000（避免 token 爆炸）。' };

        const db = await getDb();
        const rows = dbAll(db, sql);
        aiLastSqlResult = { sql, rows };
        messages.push({
          role: 'user',
          content: '【SQL 查询结果】\\n' + 'sql: ' + sql + '\\n' + 'rows(json):\\n' + JSON.stringify(rows, null, 2)
        });
        continue;
      }

      return { ok: false, error: `未知工具：${String(toolReq.tool)}` };
    }

    return { ok: false, error: '工具调用轮次过多，建议缩小问题范围或加筛选条件。' };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle('ai:exportLastSqlResult', async () => {
  try {
    if (!ExcelJS) return { ok: false, error: 'exceljs 未安装，无法导出' };
    if (!aiLastSqlResult || !Array.isArray(aiLastSqlResult.rows)) return { ok: false, error: '没有可导出的查询结果（请先在对话中触发一次 SQL 查询）' };

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出筛选结果',
      defaultPath: path.join(getRunsDir(), 'AI筛选结果.xlsx'),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { ok: true, canceled: true };

    const rows = aiLastSqlResult.rows;
    const cols = rows.length ? Object.keys(rows[0]) : ['result'];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('结果', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = cols.map((h) => ({ header: h, key: h, width: Math.min(Math.max(10, h.length + 2), 40) }));

    const headerRow = ws.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF111827' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    });

    for (const r of rows) ws.addRow(cols.map((c) => (r?.[c] === undefined ? '' : r[c])));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

    await wb.xlsx.writeFile(filePath);
    return { ok: true, filePath, rowCount: rows.length };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

// =========================
// 生命周期
// =========================
app.whenReady().then(() => {
  ensureDefaultTemplateInUserData();
  createMainWindow();
  startBackendIfNeeded();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});
