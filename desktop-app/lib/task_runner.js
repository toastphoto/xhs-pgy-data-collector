const fs = require('fs');
const path = require('path');
const { safeName } = require('./evidence');
const { normalizeSigningTask } = require('./signing_task');

const SAFE_BATCH_LIMIT = 50;
const SAFE_RUN_COOLDOWN_MS = 5 * 60 * 1000;
const SAFE_RUN_COOLDOWN_FILE = '.pgy_task_cooldown.json';
const ALLOWED_TASK_HOSTS = Object.freeze(['pgy.xiaohongshu.com']);

const TASK_PRESETS = {
  standard: {
    key: 'standard',
    label: '标准（保守）',
    pageWaitMs: 4500,
    pageWaitJitterMs: 2500,
    tabWaitMs: 2500,
    // 本次实现（方案一）：不强求 note_url，默认不做“点击补全链接”
    resolveNoteUrlByClick: false,
    resolveLimit: 0
  },
  conservative: {
    key: 'conservative',
    label: '更保守',
    pageWaitMs: 8000,
    pageWaitJitterMs: 5000,
    tabWaitMs: 4500,
    resolveNoteUrlByClick: false,
    resolveLimit: 0
  }
};

const LEGACY_PRESET_ALIASES = {
  fast: 'standard'
};

function normalizePresetKey(value) {
  const key = String(value || 'standard').trim();
  return LEGACY_PRESET_ALIASES[key] || key;
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitteredDelayMs(baseMs, jitterMs = 0) {
  const base = Math.max(0, Number(baseMs || 0));
  const jitter = Math.max(0, Number(jitterMs || 0));
  if (!jitter) return Math.round(base);
  return Math.round(base + Math.random() * jitter);
}

function normalizeTaskUrl(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const withProtocol = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const url = new URL(withProtocol);
    url.protocol = 'https:';
    return url.toString();
  } catch (_) {
    return withProtocol;
  }
}

function isAllowedTaskUrl(value) {
  try {
    const url = new URL(normalizeTaskUrl(value));
    return ALLOWED_TASK_HOSTS.includes(url.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

function normalizeUrlList(urls) {
  const list = Array.isArray(urls) ? urls : [];
  const out = [];
  const seen = new Set();
  for (const x of list) {
    const u = normalizeTaskUrl(x);
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function normalizeItems(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const urls = normalizeUrlList(payload?.urls || []);
  const outItems = [];
  const seen = new Set();

  // 优先 items（允许携带 label/nickname）
  for (const it of items) {
    const u = normalizeTaskUrl(it?.pgy_url || it?.url || '');
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    outItems.push({
      url: u,
      label: String(it?.creator_name || it?.name || it?.label || '').trim(),
      note: String(it?.note || '').trim(),
      status: ['selected', 'excluded'].includes(String(it?.status || '').trim()) ? String(it.status).trim() : 'candidate',
      priority: String(it?.priority || '').trim(),
      excludeReason: String(it?.excludeReason || it?.exclude_reason || '').trim()
    });
  }

  // 补充 urls（若未出现在 items 中）
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    outItems.push({ url: u, label: '', note: '', status: 'candidate', priority: '', excludeReason: '' });
  }

  return outItems;
}

class TaskRunner {
  /**
   * @param {{
   *  getRunsDir: ()=>string,
   *  makeRunId: ()=>string,
   *  sendState: (payload:any)=>void,
   *  openUrl: (url:string)=>Promise<void>,
   *  getCurrentUrl: ()=>string,
   *  checkLogin: ()=>Promise<{ok:boolean, loggedIn?:boolean, url?:string, isLoginPage?:boolean, error?:string}>,
   *  extractCurrentMultiPage: (templatePath:string, options:any)=>Promise<any>
   * }} deps
   */
  constructor(deps) {
    this.deps = deps;
    this.state = {
      running: false,
      paused: false,
      pauseReason: '',
      presetKey: 'standard',
      templatePath: '',
      options: {},
      signingTask: null,
      runId: '',
      runDir: '',
      queue: [],
      currentId: null,
      logs: []
    };

    this._loopPromise = null;
    this._pauseGate = null;
    this._pauseGateResolve = null;
    this._skipAfterCurrent = false;
    this._lastFinishedAt = 0;
  }

  _log(level, message, extra) {
    const line = {
      t: Date.now(),
      ts: new Date().toLocaleString('zh-CN', { hour12: false }),
      level,
      message: String(message || ''),
      extra: extra ?? null
    };
    this.state.logs.push(line);
    if (this.state.logs.length > 200) this.state.logs = this.state.logs.slice(-200);
    this._emitState();
  }

  _emitState() {
    try {
      this.deps.sendState(JSON.parse(JSON.stringify(this.state)));
    } catch (_) {
      // ignore
    }
    this._writeTaskState();
  }

  _writeMeta() {
    if (!this.state.runDir) return;
    try {
      const metaPath = path.join(this.state.runDir, 'meta.json');
      fs.mkdirSync(this.state.runDir, { recursive: true });
      fs.writeFileSync(
        metaPath,
        JSON.stringify(
          {
            runId: this.state.runId,
            createdAt: nowIso(),
            presetKey: this.state.presetKey,
            preset: TASK_PRESETS[this.state.presetKey] || TASK_PRESETS.standard,
            templatePath: this.state.templatePath,
            options: this.state.options,
            signingTask: this.state.signingTask || null,
            items: this.state.queue.map((x) => ({
              url: x.url,
              label: x.label || '',
              note: x.note || '',
              status: x.candidateStatus || 'candidate',
              priority: x.priority || '',
              excludeReason: x.excludeReason || ''
            })),
            urls: this.state.queue.map((x) => x.url)
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch (err) {
      this._log('warn', `写入 meta.json 失败：${String(err?.message || err)}`);
    }
  }

  _writeTaskState() {
    if (!this.state.runDir) return;
    try {
      const queue = Array.isArray(this.state.queue) ? this.state.queue : [];
      const counts = queue.reduce((acc, item) => {
        const key = item?.status || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const payload = {
        runId: this.state.runId,
        runDir: this.state.runDir,
        updatedAt: nowIso(),
        running: Boolean(this.state.running),
        paused: Boolean(this.state.paused),
        pauseReason: this.state.pauseReason || '',
        currentId: this.state.currentId || null,
        presetKey: this.state.presetKey,
        signingTask: this.state.signingTask || null,
        counts,
        queue: queue.map((item) => ({
          id: item.id,
          url: item.url,
          label: item.label || '',
          status: item.status,
          startedAt: item.startedAt || null,
          finishedAt: item.finishedAt || null,
          error: item.error || '',
          subRunId: item.subRunId || '',
          subRunDir: item.subRunDir || '',
          jsonPath: item.jsonPath || ''
        })),
        logs: this.state.logs.slice(-80)
      };
      fs.mkdirSync(this.state.runDir, { recursive: true });
      fs.writeFileSync(path.join(this.state.runDir, 'task_state.json'), JSON.stringify(payload, null, 2), 'utf-8');
    } catch (_) {
      // 状态文件是辅助产物，不能影响采集主流程。
    }
  }

  _newPauseGate() {
    this._pauseGate = new Promise((resolve) => {
      this._pauseGateResolve = resolve;
    });
    return this._pauseGate;
  }

  _getCooldownPath() {
    try {
      const runsDir = this.deps.getRunsDir();
      fs.mkdirSync(runsDir, { recursive: true });
      return path.join(runsDir, SAFE_RUN_COOLDOWN_FILE);
    } catch (_) {
      return '';
    }
  }

  _readLastFinishedAt() {
    let fromFile = 0;
    const cooldownPath = this._getCooldownPath();
    if (cooldownPath && fs.existsSync(cooldownPath)) {
      try {
        const payload = JSON.parse(fs.readFileSync(cooldownPath, 'utf-8'));
        fromFile = Number(payload?.lastFinishedAt || 0);
      } catch (_) {
        fromFile = 0;
      }
    }
    const value = Math.max(Number(this._lastFinishedAt || 0), Number(fromFile || 0));
    if (Number.isFinite(value) && value > 0) this._lastFinishedAt = value;
    return Number.isFinite(value) ? value : 0;
  }

  _writeLastFinishedAt(ts = Date.now()) {
    const value = Number(ts || Date.now());
    if (!Number.isFinite(value) || value <= 0) return;
    this._lastFinishedAt = value;
    const cooldownPath = this._getCooldownPath();
    if (!cooldownPath) return;
    try {
      fs.writeFileSync(
        cooldownPath,
        JSON.stringify({ lastFinishedAt: value, lastFinishedAtIso: new Date(value).toISOString() }, null, 2),
        'utf-8'
      );
    } catch (_) {
      // 冷却文件写入失败时仍保留内存冷却，不能影响当前收尾。
    }
  }

  async start(payload) {
    if (this.state.running) return { ok: false, error: '任务正在运行中' };

    const templatePath = String(payload?.templatePath || '').trim();
    if (!templatePath) return { ok: false, error: '未选择模板（请先到「采集模板」里选择/保存一个模板）' };

    const presetKey = normalizePresetKey(payload?.presetKey || 'standard');
    const preset = TASK_PRESETS[presetKey] || TASK_PRESETS.standard;
    const items = normalizeItems(payload || {});
    if (!items.length) return { ok: false, error: 'URL 列表为空' };
    const invalidItems = items.filter((item) => !isAllowedTaskUrl(item.url));
    if (invalidItems.length) {
      const sample = invalidItems[0]?.url || '';
      return {
        ok: false,
        code: 'PGY_TASK_URL_NOT_ALLOWED',
        error: `为了降低误操作和平台风控风险，批量采集只允许蒲公英链接（${ALLOWED_TASK_HOSTS.join(', ')}）。请移除或修正：${sample}`
      };
    }
    if (items.length > SAFE_BATCH_LIMIT) {
      return {
        ok: false,
        error: `为了降低平台风控风险，单次最多采集 ${SAFE_BATCH_LIMIT} 个达人。请拆成多批，或先导出候选表分批执行。`
      };
    }
    const lastFinishedAt = this._readLastFinishedAt();
    const elapsedSinceLastRun = Date.now() - Number(lastFinishedAt || 0);
    if (lastFinishedAt && elapsedSinceLastRun < SAFE_RUN_COOLDOWN_MS) {
      const remainingMs = SAFE_RUN_COOLDOWN_MS - elapsedSinceLastRun;
      const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
      return {
        ok: false,
        code: 'PGY_RUN_COOLDOWN',
        error: `为降低平台风控风险，上一批结束后需要间隔至少 5 分钟再开始下一批。请休息约 ${remainingMin} 分钟后重试。`
      };
    }
    const signingTask = normalizeSigningTask(payload?.signingTask || {});

    const runId = this.deps.makeRunId();
    const runDir = path.join(this.deps.getRunsDir(), runId);
    fs.mkdirSync(runDir, { recursive: true });

    const requestedOptions = payload?.options && typeof payload.options === 'object' ? payload.options : {};
    const requestedTabWaitMs = Number(requestedOptions.tabWaitMs || 0);
    const effectiveOptions = {
      ...requestedOptions,
      tabWaitMs: Number.isFinite(requestedTabWaitMs) && requestedTabWaitMs > 0
        ? Math.max(preset.tabWaitMs, requestedTabWaitMs)
        : preset.tabWaitMs,
      resolveNoteUrlByClick: false,
      resolveLimit: 0
    };

    this.state = {
      ...this.state,
      running: true,
      paused: false,
      pauseReason: '',
      presetKey: preset.key,
      templatePath,
      options: effectiveOptions,
      signingTask,
      runId,
      runDir,
      currentId: null,
      queue: items.map((it, i) => ({
        id: `t${i + 1}`,
        url: it.url,
        label: it.label || '',
        note: it.note || '',
        candidateStatus: it.status || 'candidate',
        priority: it.priority || '',
        excludeReason: it.excludeReason || '',
        status: 'pending', // pending | running | paused | ok | fail | skipped
        startedAt: null,
        finishedAt: null,
        error: '',
        subRunId: '',
        subRunDir: '',
        jsonPath: ''
      })),
      logs: []
    };

    this._skipAfterCurrent = false;
    this._log('info', `任务开始：${items.length} 条，预设=${preset.label}，签约任务=${signingTask.taskName}`);
    this._writeMeta();
    this._emitState();

    this._loopPromise = this._runLoop().catch((err) => {
      this._log('error', `任务循环异常：${String(err?.message || err)}`);
      this.state.running = false;
      this.state.paused = false;
      this.state.pauseReason = '';
      this._writeLastFinishedAt(Date.now());
      this._emitState();
    });

    return { ok: true, runId, runDir };
  }

  async pause(reason = 'user') {
    if (!this.state.running) return { ok: false, error: '当前没有运行中的任务' };
    if (this.state.paused) return { ok: true };
    this.state.paused = true;
    this.state.pauseReason = reason === 'user' ? '用户暂停' : String(reason || '暂停');
    this._log('warn', `已暂停：${this.state.pauseReason}`);
    this._newPauseGate();
    this._emitState();
    return { ok: true };
  }

  async resume() {
    if (!this.state.running) return { ok: false, error: '当前没有运行中的任务' };
    if (!this.state.paused) return { ok: true };
    this.state.paused = false;
    const reason = this.state.pauseReason;
    this.state.pauseReason = '';
    this._log('info', `继续执行（上次暂停原因：${reason || '-'}）`);
    const r = this._pauseGateResolve;
    this._pauseGateResolve = null;
    this._pauseGate = null;
    r?.('resume');
    this._emitState();
    return { ok: true };
  }

  async skipCurrent() {
    if (!this.state.running) return { ok: false, error: '当前没有运行中的任务' };
    if (!this.state.currentId) return { ok: false, error: '当前没有正在处理的任务' };

    // 若在暂停点，直接解锁并跳过；若正在执行中，则标记“结束后跳过”
    if (this.state.paused && this._pauseGateResolve) {
      this._log('warn', `跳过当前（${this.state.currentId}）`);
      const r = this._pauseGateResolve;
      this._pauseGateResolve = null;
      this._pauseGate = null;
      this.state.paused = false;
      this.state.pauseReason = '';
      r('skip');
      this._emitState();
      return { ok: true };
    }

    this._skipAfterCurrent = true;
    this._log('warn', `已标记：当前任务结束后跳过（${this.state.currentId}）`);
    return { ok: true };
  }

  async _waitIfPaused() {
    if (!this.state.paused) return 'resume';
    if (!this._pauseGate) this._newPauseGate();
    const action = await this._pauseGate;
    return action || 'resume';
  }

  async _pauseForManualIntervention(reason, item) {
    this.state.paused = true;
    this.state.pauseReason = reason;
    if (item) item.status = 'paused';
    this._log('warn', `需要手工介入：${reason}`);
    this._newPauseGate();
    this._emitState();
    const action = await this._waitIfPaused();
    return action;
  }

  async _runLoop() {
    const preset = TASK_PRESETS[this.state.presetKey] || TASK_PRESETS.standard;
    for (let i = 0; i < this.state.queue.length; i++) {
      const item = this.state.queue[i];
      if (item.status !== 'pending') continue;

      this.state.currentId = item.id;
      item.status = 'running';
      item.startedAt = Date.now();
      this._skipAfterCurrent = false;
      this._emitState();

      // 整体暂停点（用户点暂停）
      if (this.state.paused) {
        const action = await this._waitIfPaused();
        if (action === 'skip') {
          item.status = 'skipped';
          item.finishedAt = Date.now();
          this._emitState();
          continue;
        }
      }

      const creatorId = safeName(`${i + 1}_${item.url}`).slice(0, 60);
      const subRunId = `${this.state.runId}/${creatorId}`;

      // 为每个 URL 做“可重试”的 loop：遇到登录态/抽取失败时暂停，resume 后重试
      let done = false;
      while (!done) {
        // 1) 打开 creator_url
        try {
          this._log('info', `打开：${item.url}`);
          await this.deps.openUrl(item.url);
          await sleep(jitteredDelayMs(preset.pageWaitMs, preset.pageWaitJitterMs));
        } catch (err) {
          item.error = `打开失败：${String(err?.message || err)}`;
          const action = await this._pauseForManualIntervention(item.error, item);
          if (action === 'skip') {
            item.status = 'skipped';
            item.finishedAt = Date.now();
            done = true;
          } else {
            item.status = 'running';
          }
          this._emitState();
          continue;
        }

        // 2) 登录态检查（URL 命中 /login 或 pgy:checkLogin loggedIn=false）
        try {
          const curUrl = String(this.deps.getCurrentUrl() || '');
          if (/\/login/i.test(curUrl)) {
            const action = await this._pauseForManualIntervention('检测到 /login，请在右侧完成登录后点击“继续”', item);
            if (action === 'skip') {
              item.status = 'skipped';
              item.finishedAt = Date.now();
              done = true;
            } else {
              item.status = 'running';
            }
            this._emitState();
            continue;
          }

          const login = await this.deps.checkLogin();
          if (login?.ok && login?.riskDetected) {
            const action = await this._pauseForManualIntervention(
              `检测到页面可能触发安全验证/风控：${login.riskText || '请在右侧手工确认后继续'}`,
              item
            );
            if (action === 'skip') {
              item.status = 'skipped';
              item.finishedAt = Date.now();
              done = true;
            } else {
              item.status = 'running';
            }
            this._emitState();
            continue;
          }
          if (login?.ok && login?.loggedIn === false) {
            const action = await this._pauseForManualIntervention('检测到未登录（pgy:checkLogin loggedIn=false），请手工介入后继续', item);
            if (action === 'skip') {
              item.status = 'skipped';
              item.finishedAt = Date.now();
              done = true;
            } else {
              item.status = 'running';
            }
            this._emitState();
            continue;
          }
        } catch (_) {
          // best-effort：不阻断
        }

        // 3) 调用抽取（使用当前模板）
        this._log('info', `抽取中：${item.url}`);
        const r = await this.deps.extractCurrentMultiPage(this.state.templatePath, {
          ...this.state.options,
          runId: subRunId
        });

        if (this._skipAfterCurrent) {
          item.status = 'skipped';
          item.finishedAt = Date.now();
          item.error = '用户请求跳过';
          this._skipAfterCurrent = false;
          this._log('warn', `已跳过：${item.url}`);
          done = true;
          this._emitState();
          continue;
        }

        if (!r?.ok) {
          item.error = r?.riskDetected
            ? `检测到页面可能触发安全验证/风控：${r?.riskText || r?.error || '请在右侧手工确认后继续'}`
            : `抽取失败：${r?.error || 'unknown error'}`;
          const action = await this._pauseForManualIntervention(item.error, item);
          if (action === 'skip') {
            item.status = 'skipped';
            item.finishedAt = Date.now();
            done = true;
          } else {
            item.status = 'running';
          }
          this._emitState();
          continue;
        }

        item.status = 'ok';
        item.finishedAt = Date.now();
        item.subRunId = subRunId;
        item.subRunDir = r.runDir || '';
        item.jsonPath = r.jsonPath || '';
        item.error = '';
        this._log('info', `完成：${item.url}`);
        this._emitState();
        done = true;
      }
    }

    this.state.running = false;
    this.state.paused = false;
    this.state.pauseReason = '';
    this.state.currentId = null;
    this._writeLastFinishedAt(Date.now());
    this._log('info', '任务队列已结束');
    this._emitState();
  }
}

module.exports = {
  TaskRunner,
  TASK_PRESETS,
  SAFE_BATCH_LIMIT,
  SAFE_RUN_COOLDOWN_MS,
  SAFE_RUN_COOLDOWN_FILE,
  ALLOWED_TASK_HOSTS,
  isAllowedTaskUrl,
  jitteredDelayMs,
  normalizePresetKey,
  normalizeTaskUrl
};
