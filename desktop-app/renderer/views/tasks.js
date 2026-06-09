import { store } from '../state/store.js';

const PRESETS = [
  { key: 'standard', label: '标准（推荐）' },
  { key: 'conservative', label: '保守（更稳）' },
  { key: 'fast', label: '加速（更快）' }
];

let _draftText = '';
let _draftUrls = [];
let _draftItems = []; // {pgy_url, creator_name}[]
let _presetKey = 'standard';
let _selectedTemplatePath = '';
let _importPreview = null; // {stats, items, filePath} | null

function parseUrls(rawText) {
  const text = String(rawText || '');
  // 支持：按行粘贴 / CSV（逗号分隔）/ 空白分隔
  const tokens = text
    .split(/[\n\r\t ]+/g)
    .flatMap((x) => x.split(','))
    .map((x) => x.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set();
  for (const t of tokens) {
    // 取第一列（允许用户粘贴“url,备注”）
    const first = String(t).split(',')[0].trim();
    if (!first) continue;
    const u = /^https?:\/\//i.test(first) ? first : `https://${first}`;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function statusBadge(status) {
  const s = String(status || 'pending');
  const map = {
    pending: { text: '待处理', cls: 'pending' },
    running: { text: '处理中', cls: 'running' },
    paused: { text: '已暂停', cls: 'paused' },
    ok: { text: '成功', cls: 'ok' },
    fail: { text: '失败', cls: 'fail' },
    skipped: { text: '跳过', cls: 'skipped' }
  };
  const v = map[s] || map.pending;
  const el = document.createElement('span');
  el.textContent = v.text;
  el.className = `status-badge ${v.cls}`;
  return el;
}

function queueStats(queue) {
  const list = Array.isArray(queue) ? queue : [];
  const stats = { total: list.length, pending: 0, running: 0, paused: 0, ok: 0, fail: 0, skipped: 0 };
  list.forEach((it) => {
    const k = String(it?.status || 'pending');
    if (stats[k] === undefined) stats[k] = 0;
    stats[k] += 1;
  });
  return stats;
}

function statCard(label, value, tone = '') {
  const card = document.createElement('div');
  card.className = `stat-card ${tone}`;
  const k = document.createElement('div');
  k.className = 'stat-label';
  k.textContent = label;
  const v = document.createElement('div');
  v.className = 'stat-value';
  v.textContent = String(value ?? 0);
  card.appendChild(k);
  card.appendChild(v);
  return card;
}

export function renderTasks(state) {
  const root = document.createElement('div');
  root.className = 'view';

  const runId = state.tasks?.runId || '';
  const runDir = state.tasks?.runDir || '';
  const queue = (state.tasks?.queue && state.tasks.queue.length)
    ? state.tasks.queue
    : _draftUrls.map((u, i) => ({ id: `t${i + 1}`, url: u, status: 'pending', error: '' }));
  const stats = queueStats(queue);

  const stText = state.tasks?.running
    ? (state.tasks?.paused ? '已暂停' : '运行中')
    : (state.tasks?.runId ? '已结束/未运行' : '未运行');

  const hero = document.createElement('section');
  hero.className = 'task-hero';
  const heroMain = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = '批量任务';
  const desc = document.createElement('p');
  desc.textContent = '导入或粘贴蒲公英达人链接，按模板串行采集；遇到登录、风控或抽取失败时会暂停等待人工处理。';
  heroMain.appendChild(title);
  heroMain.appendChild(desc);

  const heroMeta = document.createElement('div');
  heroMeta.className = 'run-meta';
  heroMeta.innerHTML = `<div>状态：<b>${stText}</b></div><div>runId：<b>${runId || '-'}</b></div><div title="${runDir || ''}">runDir：${runDir || '-'}</div>`;

  const btnRow = document.createElement('div');
  btnRow.className = 'task-actions';

  const btnOpenRun = document.createElement('button');
  btnOpenRun.className = 'btn';
  btnOpenRun.textContent = '打开本次运行目录';
  btnOpenRun.disabled = !runDir;
  btnOpenRun.addEventListener('click', async () => {
    const r = await window.desktopAPI.tasks.openRunDir();
    if (!r?.ok) alert(`打开失败：${r?.error || 'unknown error'}`);
  });

  const btnOpenRuns = document.createElement('button');
  btnOpenRuns.className = 'btn';
  btnOpenRuns.textContent = '打开 runs 总目录';
  btnOpenRuns.addEventListener('click', async () => {
    const r = await window.desktopAPI.tasks.openRunsDir();
    if (!r?.ok) alert(`打开失败：${r?.error || 'unknown error'}`);
  });

  btnRow.appendChild(btnOpenRun);
  btnRow.appendChild(btnOpenRuns);
  heroMeta.appendChild(btnRow);
  hero.appendChild(heroMain);
  hero.appendChild(heroMeta);
  root.appendChild(hero);

  const statGrid = document.createElement('div');
  statGrid.className = 'stat-grid';
  statGrid.appendChild(statCard('总数', stats.total));
  statGrid.appendChild(statCard('成功', stats.ok, 'ok'));
  statGrid.appendChild(statCard('处理中/暂停', stats.running + stats.paused, 'warn'));
  statGrid.appendChild(statCard('失败/跳过', stats.fail + stats.skipped, 'bad'));
  root.appendChild(statGrid);

  // 选择模板（默认跟随 templates.activeTemplatePath）
  const templates = state.templates?.templates || [];
  if (!_selectedTemplatePath) {
    _selectedTemplatePath =
      state.templates?.activeTemplatePath || templates?.[0]?.path || '';
  }

  const header = document.createElement('div');
  header.className = 'task-toolbar';

  const templateSel = document.createElement('select');
  templateSel.className = 'tpl-input';
  templateSel.style.maxWidth = '520px';
  templateSel.style.height = '34px';
  templateSel.disabled = templates.length === 0;
  templates.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.path;
    opt.textContent = `${t.name || ''}${t.version ? ` (${t.version})` : ''}`;
    if (t.path === _selectedTemplatePath) opt.selected = true;
    templateSel.appendChild(opt);
  });
  templateSel.addEventListener('change', () => {
    _selectedTemplatePath = templateSel.value;
    store.set({
      templates: { ...store.state.templates, activeTemplatePath: _selectedTemplatePath }
    });
  });

  const presetSel = document.createElement('select');
  presetSel.className = 'tpl-input';
  presetSel.style.width = '220px';
  presetSel.style.height = '34px';
  PRESETS.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.key;
    opt.textContent = p.label;
    if (p.key === _presetKey) opt.selected = true;
    presetSel.appendChild(opt);
  });
  presetSel.addEventListener('change', () => {
    _presetKey = presetSel.value;
  });

  const btnTplRefresh = document.createElement('button');
  btnTplRefresh.className = 'btn';
  btnTplRefresh.style.height = '34px';
  btnTplRefresh.textContent = '刷新模板';
  btnTplRefresh.addEventListener('click', async () => {
    try {
      const r = await window.desktopAPI.template.list();
      if (!r?.ok) {
        alert(`刷新模板失败：${r?.error || 'unknown error'}`);
        return;
      }
      const files = r.files || [];
      const nextActive = store.state.templates.activeTemplatePath || files?.[0]?.path || '';
      store.set({
        templates: {
          ...store.state.templates,
          templates: files,
          activeTemplatePath: nextActive
        }
      });
    } catch (e) {
      alert(`刷新模板异常：${e?.message || String(e)}`);
    }
  });

  header.appendChild(templateSel);
  header.appendChild(btnTplRefresh);
  header.appendChild(presetSel);
  root.appendChild(header);

  if (templates.length === 0) {
  const tip = document.createElement('div');
    tip.className = 'task-note';
    tip.textContent = '模板下拉为空：请先到「采集模板」页保存一个模板，或点击上方“刷新模板”。';
    root.appendChild(tip);
  }

  // 手工介入提示
  if (state.tasks?.paused) {
    const banner = document.createElement('div');
    banner.className = 'task-banner warn';
    banner.textContent =
      `队列已暂停：${state.tasks.pauseReason || '需要手工介入'}\n请在右侧浏览器完成登录/处理风控/切到正确页面后，点击“继续”；或点击“跳过当前”。`;
    root.appendChild(banner);
  }

  // URL 输入
  const inputWrap = document.createElement('div');
  inputWrap.className = 'task-panel';

  const textarea = document.createElement('textarea');
  textarea.className = 'tpl-input';
  textarea.style.height = '110px';
  textarea.style.padding = '10px 10px';
  textarea.style.resize = 'vertical';
  textarea.placeholder = '粘贴 creator_url（每行一个，或 CSV/逗号分隔）';
  textarea.value = _draftText;
  textarea.addEventListener('input', () => {
    _draftText = textarea.value;
  });

  const inputBtns = document.createElement('div');
  inputBtns.className = 'task-actions';

  const btnParse = document.createElement('button');
  btnParse.className = 'btn';
  btnParse.textContent = '解析并加入队列';
  btnParse.disabled = !!state.tasks?.running;
  btnParse.addEventListener('click', () => {
    const urls = parseUrls(_draftText);
    const merged = [..._draftUrls, ...urls];
    _draftUrls = parseUrls(merged.join('\n')); // 去重
    _draftText = _draftUrls.join('\n');
    textarea.value = _draftText;
    // 触发一次 re-render（复用 store）
    store.set({ tasks: { ...store.state.tasks } });
  });

  const btnPaste = document.createElement('button');
  btnPaste.className = 'btn';
  btnPaste.textContent = '从剪贴板读取';
  btnPaste.disabled = !!state.tasks?.running;
  btnPaste.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      _draftText = text;
      textarea.value = _draftText;
    } catch (e) {
      const next = window.prompt('无法直接读取剪贴板，请手工粘贴：');
      if (next) {
        _draftText = next;
        textarea.value = _draftText;
      }
    }
  });

  const btnImportExcel = document.createElement('button');
  btnImportExcel.className = 'btn';
  btnImportExcel.textContent = '导入Excel';
  btnImportExcel.disabled = !!state.tasks?.running;
  btnImportExcel.addEventListener('click', async () => {
    try {
      const r = await window.desktopAPI.tasks.importExcel();
      if (r?.canceled) return;
      if (!r?.ok) {
        alert(`导入失败：${r?.error || 'unknown error'}`);
        return;
      }
      const items = Array.isArray(r.items) ? r.items : [];
      const urls = items.map((x) => x?.pgy_url).filter(Boolean);
      _draftUrls = parseUrls(urls.join('\n'));
      _draftText = _draftUrls.join('\n');
      textarea.value = _draftText;
      _draftItems = items
        .map((x) => ({
          pgy_url: x?.pgy_url || '',
          creator_name: x?.creator_name || ''
        }))
        .filter((x) => x.pgy_url);
      _importPreview = { filePath: r.filePath || '', stats: r.stats || {}, items: items.slice(0, 10) };
      store.set({ tasks: { ...store.state.tasks } });
    } catch (e) {
      alert(`导入异常：${e?.message || String(e)}`);
    }
  });

  const btnClear = document.createElement('button');
  btnClear.className = 'btn';
  btnClear.textContent = '清空';
  btnClear.disabled = !!state.tasks?.running;
  btnClear.addEventListener('click', () => {
    _draftText = '';
    _draftUrls = [];
    _draftItems = [];
    _importPreview = null;
    textarea.value = '';
    store.set({ tasks: { ...store.state.tasks } });
  });

  inputBtns.appendChild(btnParse);
  inputBtns.appendChild(btnPaste);
  inputBtns.appendChild(btnImportExcel);
  inputBtns.appendChild(btnClear);

  inputWrap.appendChild(textarea);
  inputWrap.appendChild(inputBtns);
  root.appendChild(inputWrap);

  if (_importPreview) {
    const box = document.createElement('div');
    box.className = 'import-preview';
    const s = _importPreview.stats || {};
    const lines = [];
    lines.push(`导入文件：${_importPreview.filePath || ''}`);
    lines.push(`统计：sheet=${s.sheets ?? '-'}，扫描行=${s.rows ?? '-'}，提取=${s.extracted ?? '-'}，去重后=${s.deduped ?? _draftUrls.length}`);
    lines.push('');
    lines.push('预览（前10条）：');
    (_importPreview.items || []).forEach((it, idx) => {
      const name = (it?.creator_name || '').trim() || '(无昵称)';
      const url = it?.pgy_url || '';
      lines.push(`${idx + 1}. ${name}  ${url}`);
    });
    box.textContent = lines.join('\n');
    root.appendChild(box);
  }

  // 控制按钮
  const ctrl = document.createElement('div');
  ctrl.className = 'task-actions main-actions';

  const btnStart = document.createElement('button');
  btnStart.className = 'btn primary';
  btnStart.textContent = '开始';
  btnStart.disabled = !!state.tasks?.running;
  btnStart.addEventListener('click', async () => {
    const urls = _draftUrls.length ? _draftUrls : parseUrls(_draftText);
    if (!urls.length) {
      alert('URL 列表为空');
      return;
    }
    if (!_selectedTemplatePath) {
      alert('未选择模板。请先到「采集模板」里选择/保存一个模板');
      return;
    }
    try {
      // 如果是从 Excel 导入的，并且 items 覆盖了这些 url，则优先传 items（便于队列显示昵称/导出元信息）
      const items =
        Array.isArray(_draftItems) && _draftItems.length
          ? _draftItems.filter((x) => urls.includes(/^https?:\/\//i.test(x.pgy_url) ? x.pgy_url : `https://${x.pgy_url}`))
          : [];
      const r = await window.desktopAPI.tasks.start({
        urls,
        items,
        templatePath: _selectedTemplatePath,
        presetKey: _presetKey
      });
      if (!r?.ok) {
        alert(`启动失败：${r?.error || 'unknown error'}`);
        return;
      }
      // 启动后，队列状态由 tasks:state 推送覆盖，这里只保留草稿
      _draftUrls = urls;
      _draftText = urls.join('\n');
      textarea.value = _draftText;
    } catch (e) {
      alert(`启动异常：${e?.message || String(e)}`);
    }
  });

  const btnPause = document.createElement('button');
  btnPause.className = 'btn ghost';
  btnPause.textContent = '暂停';
  btnPause.disabled = !state.tasks?.running || !!state.tasks?.paused;
  btnPause.addEventListener('click', async () => {
    try {
      const r = await window.desktopAPI.tasks.pause();
      if (!r?.ok) alert(`暂停失败：${r?.error || 'unknown error'}`);
    } catch (e) {
      alert(`暂停异常：${e?.message || String(e)}`);
    }
  });

  const btnResume = document.createElement('button');
  btnResume.className = 'btn ghost';
  btnResume.textContent = '继续';
  btnResume.disabled = !state.tasks?.running || !state.tasks?.paused;
  btnResume.addEventListener('click', async () => {
    try {
      const r = await window.desktopAPI.tasks.resume();
      if (!r?.ok) alert(`继续失败：${r?.error || 'unknown error'}`);
    } catch (e) {
      alert(`继续异常：${e?.message || String(e)}`);
    }
  });

  const btnSkip = document.createElement('button');
  btnSkip.className = 'btn ghost';
  btnSkip.textContent = '跳过当前';
  btnSkip.disabled = !state.tasks?.running || !state.tasks?.currentId;
  btnSkip.addEventListener('click', async () => {
    const ok = window.confirm('确定要跳过当前任务吗？');
    if (!ok) return;
    try {
      const r = await window.desktopAPI.tasks.skipCurrent();
      if (!r?.ok) alert(`跳过失败：${r?.error || 'unknown error'}`);
    } catch (e) {
      alert(`跳过异常：${e?.message || String(e)}`);
    }
  });

  ctrl.appendChild(btnStart);
  ctrl.appendChild(btnPause);
  ctrl.appendChild(btnResume);
  ctrl.appendChild(btnSkip);

  root.appendChild(ctrl);

  // 队列表格
  const tableTitle = document.createElement('div');
  tableTitle.className = 'section-label';
  tableTitle.textContent = '队列';
  root.appendChild(tableTitle);

  const table = document.createElement('table');
  table.className = 'task-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 90px;">状态</th>
        <th>URL</th>
        <th style="width: 220px;">达人/备注</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  if (!queue.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="3" class="empty-row">暂无队列。请先粘贴 URL 并“解析并加入队列”。</td>`;
    tbody.appendChild(tr);
  } else {
    queue.forEach((it) => {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.appendChild(statusBadge(it.status));
      const td2 = document.createElement('td');
      td2.className = 'url-cell';
      td2.textContent = it.url || '';
      const td3 = document.createElement('td');
      td3.className = 'note-cell';
      const label = (it.label || '').trim();
      td3.textContent = [label, it.error].filter(Boolean).join('\n');
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tbody.appendChild(tr);
    });
  }

  root.appendChild(table);

  // 日志
  const logTitle = document.createElement('div');
  logTitle.className = 'section-label';
  logTitle.textContent = '日志（最近 200 行）';
  root.appendChild(logTitle);

  const pre = document.createElement('pre');
  pre.className = 'task-log';

  const logs = state.tasks?.logs || [];
  pre.textContent = logs
    .map((l) => `[${l.ts || ''}] ${String(l.level || '').toUpperCase()} ${l.message || ''}`)
    .join('\n');
  root.appendChild(pre);

  return root;
}
