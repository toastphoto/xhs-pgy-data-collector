import { store } from '../state/store.js';
import { createAdvancedSection, createMetricCard, createNotice, createPageIntro } from '../ui/components.js';

let _msgs = [
  { role: 'assistant', content: '把你的需求直接发我：比如“筛选粉丝5-20w、互动率>3%、报价<8000的美妆达人”。我会先同步历史数据，然后用数据库查询再给你结论。' }
];
let _input = '';
let _busy = false;
let _cfg = null; // ai config
let _provider = 'compat';
let _dbStats = null;
let _kbStats = null;
let _models = []; // compat models
let _showConfig = false;

const LS_KEY = 'aiChatMessages_v1';

function loadMsgsFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) _msgs = arr;
  } catch (_) {}
}
function saveMsgsToLocalStorage() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(_msgs.slice(-80))); // 防止无限增长
  } catch (_) {}
}

async function loadAll() {
  // 仅首次尝试恢复会话
  if (_msgs && _msgs.length <= 1) loadMsgsFromLocalStorage();
  try {
    const c = await window.desktopAPI.ai.getConfig();
    if (c?.ok) {
      _cfg = c.config;
      _provider = c.config?.activeProvider || 'compat';
    }
  } catch (_) {}
  try {
    const s = await window.desktopAPI.db.stats();
    if (s?.ok) _dbStats = s;
  } catch (_) {}
  try {
    const k = await window.desktopAPI.kb.stats();
    if (k?.ok) _kbStats = k.meta || null;
  } catch (_) {}
  store.set({ report: { ...(store.state.report || {}), _t: Date.now() } });
}

async function syncRuns() {
  _busy = true;
  store.set({ report: { ...(store.state.report || {}), _t: Date.now() } });
  try {
    const r = await window.desktopAPI.db.syncRuns();
    if (!r?.ok) alert(`同步失败：${r?.error || 'unknown error'}`);
    else {
      const kbOk = r?.kb?.ok;
      if (kbOk === false) alert(`同步完成，但知识库更新失败：${r.kb?.error || 'unknown error'}`);
    }
  } finally {
    _busy = false;
    await loadAll();
  }
}

async function rebuildKb() {
  _busy = true;
  store.set({ report: { ...(store.state.report || {}), _t: Date.now() } });
  try {
    const r = await window.desktopAPI.kb.rebuild();
    if (!r?.ok) alert(`重建失败：${r?.error || 'unknown error'}`);
  } finally {
    _busy = false;
    await loadAll();
  }
}

async function saveConfig() {
  if (!_cfg) return;
  _cfg.activeProvider = _provider;
  const r = await window.desktopAPI.ai.setConfig(_cfg);
  if (!r?.ok) alert(`保存失败：${r?.error || 'unknown error'}`);
}

async function fetchModels() {
  try {
    const r = await window.desktopAPI.ai.listModels({ provider: _provider });
    if (!r?.ok) {
      alert(`获取模型列表失败：${r?.error || 'unknown error'}`);
      return;
    }
    _models = Array.isArray(r.models) ? r.models : [];
    if (!_models.length) alert(r.note || '未获取到模型列表（可能是该供应商不支持该接口）');
    store.set({ report: { ...(store.state.report || {}), _t: Date.now() } });
  } catch (e) {
    alert(`获取模型异常：${e?.message || String(e)}`);
  }
}

function configModal() {
  if (!_showConfig) return null;
  const cfg = _cfg || { activeProvider: _provider, deepseek: { apiKey: '', model: 'deepseek-chat' }, compat: { baseUrl: 'https://ai.comfly.chat', apiKey: '', model: 'gpt-4o-mini' } };

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      _showConfig = false;
      store.set({ report: { ...(store.state.report || {}), _t: Date.now() } });
    }
  });

  const modal = document.createElement('div');
  modal.className = 'modal';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = 'AI 配置（API Key / Base URL / 模型）';
  const close = document.createElement('button');
  close.className = 'btn ghost';
  close.style.height = '34px';
  close.textContent = '关闭';
  close.addEventListener('click', () => {
    _showConfig = false;
    store.set({ report: { ...(store.state.report || {}), _t: Date.now() } });
  });
  header.appendChild(title);
  header.appendChild(close);

  const body = document.createElement('div');
  body.className = 'modal-body';

  const tabs = document.createElement('div');
  tabs.style.display = 'flex';
  tabs.style.gap = '10px';
  tabs.style.marginBottom = '12px';

  const tabCompat = document.createElement('button');
  tabCompat.className = `btn ${_provider === 'compat' ? 'primary' : 'ghost'}`;
  tabCompat.textContent = 'OpenAI 兼容（推荐）';
  tabCompat.addEventListener('click', () => {
    _provider = 'compat';
    store.set({ report: { ...(store.state.report || {}), _t: Date.now() } });
  });

  const tabDeep = document.createElement('button');
  tabDeep.className = `btn ${_provider === 'deepseek' ? 'primary' : 'ghost'}`;
  tabDeep.textContent = 'DeepSeek 官方';
  tabDeep.addEventListener('click', () => {
    _provider = 'deepseek';
    store.set({ report: { ...(store.state.report || {}), _t: Date.now() } });
  });

  tabs.appendChild(tabCompat);
  tabs.appendChild(tabDeep);
  body.appendChild(tabs);

  const grid = document.createElement('div');
  grid.className = 'form-grid';

  const inputRow = (label, inputEl) => {
    const l = document.createElement('div');
    l.className = 'form-label';
    l.textContent = label;
    grid.appendChild(l);
    grid.appendChild(inputEl);
  };

  if (_provider === 'compat') {
    const base = document.createElement('input');
    base.className = 'tpl-input';
    base.style.height = '34px';
    base.value = cfg.compat?.baseUrl || 'https://ai.comfly.chat';
    base.addEventListener('input', () => {
      cfg.compat.baseUrl = base.value;
      _cfg = cfg;
    });
    inputRow('Base URL', base);

    const key = document.createElement('input');
    key.className = 'tpl-input';
    key.type = 'password';
    key.placeholder = 'sk-...';
    key.style.height = '34px';
    key.value = cfg.compat?.apiKey || '';
    key.addEventListener('input', () => {
      cfg.compat.apiKey = key.value;
      _cfg = cfg;
    });
    inputRow('API Key', key);

    const model = document.createElement('input');
    model.className = 'tpl-input';
    model.style.height = '34px';
    model.placeholder = '例如：gpt-4o-mini / chatgpt-4o-latest / claude-3.7...';
    model.value = cfg.compat?.model || '';
    model.addEventListener('input', () => {
      cfg.compat.model = model.value;
      _cfg = cfg;
    });
    inputRow('默认模型', model);

    const help = document.createElement('div');
    help.className = 'form-help';
    help.textContent = 'Base URL 只填域名即可（例如 https://ai.comfly.chat）。即使你填了 /v1，程序也会自动规整，避免 /v1 重复。';
    grid.appendChild(help);
  } else {
    const key = document.createElement('input');
    key.className = 'tpl-input';
    key.type = 'password';
    key.style.height = '34px';
    key.value = cfg.deepseek?.apiKey || '';
    key.addEventListener('input', () => {
      cfg.deepseek.apiKey = key.value;
      _cfg = cfg;
    });
    inputRow('API Key', key);

    const model = document.createElement('input');
    model.className = 'tpl-input';
    model.style.height = '34px';
    model.value = cfg.deepseek?.model || 'deepseek-chat';
    model.addEventListener('input', () => {
      cfg.deepseek.model = model.value;
      _cfg = cfg;
    });
    inputRow('默认模型', model);
  }

  body.appendChild(grid);

  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  const btnModels = document.createElement('button');
  btnModels.className = 'btn ghost';
  btnModels.textContent = '获取模型列表';
  btnModels.disabled = _provider !== 'compat';
  btnModels.addEventListener('click', fetchModels);

  const btnSave = document.createElement('button');
  btnSave.className = 'btn primary';
  btnSave.textContent = '保存';
  btnSave.addEventListener('click', async () => {
    _cfg = cfg;
    await saveConfig();
    _showConfig = false;
    await loadAll();
  });

  actions.appendChild(btnModels);
  actions.appendChild(btnSave);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(actions);
  backdrop.appendChild(modal);
  return backdrop;
}

async function send() {
  const text = String(_input || '').trim();
  if (!text || _busy) return;

  _msgs.push({ role: 'user', content: text });
  saveMsgsToLocalStorage();
  _input = '';
  _busy = true;
  store.set({ report: { ...(store.state.report || {}), _t: Date.now() } });

  try {
    const payload = { provider: _provider, messages: _msgs.map((m) => ({ role: m.role, content: m.content })) };
    const r = await window.desktopAPI.ai.chat(payload);
    if (!r?.ok) {
      _msgs.push({ role: 'assistant', content: `请求失败：${r?.error || 'unknown error'}` });
    } else {
      _msgs.push({ role: 'assistant', content: r.content || '' });
    }
    saveMsgsToLocalStorage();
  } catch (e) {
    _msgs.push({ role: 'assistant', content: `异常：${e?.message || String(e)}` });
    saveMsgsToLocalStorage();
  } finally {
    _busy = false;
    store.set({ report: { ...(store.state.report || {}), _t: Date.now() } });
  }
}

function bubble(m) {
  const box = document.createElement('div');
  box.style.display = 'flex';
  box.style.justifyContent = m.role === 'user' ? 'flex-end' : 'flex-start';
  box.style.margin = '10px 0';

  const b = document.createElement('div');
  b.style.maxWidth = '78%';
  b.style.padding = '10px 12px';
  b.style.borderRadius = '14px';
  b.style.whiteSpace = 'pre-wrap';
  b.style.lineHeight = '1.6';
  b.style.border = '1px solid rgba(17,24,39,0.10)';
  if (m.role === 'user') {
    b.style.background = 'linear-gradient(180deg, #ff6aa9 0%, #e85a9a 100%)';
    b.style.color = '#fff';
  } else {
    b.style.background = '#fff';
    b.style.color = 'var(--text)';
  }
  b.textContent = m.content || '';
  box.appendChild(b);
  return box;
}

export function renderReport(state) {
  const root = document.createElement('div');
  root.className = 'view ai-report-view';
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.minHeight = 'calc(100vh - 120px)';

  root.appendChild(createPageIntro({
    title: 'AI 分析',
    description: '把采集过的达人数据同步进本地库后，可以直接用自然语言筛选、对比和生成候选判断。'
  }));

  root.appendChild(createNotice({
    text: '建议先同步历史数据，再提问。API Key 只保存在本机配置里，不要写进项目文件。',
    tone: 'info'
  }));

  const top = document.createElement('div');
  top.className = 'card ai-report-panel';

  const sel = document.createElement('select');
  sel.className = 'tpl-input';
  sel.style.width = '220px';
  sel.style.height = '34px';
  sel.innerHTML = `
    <option value="compat">OpenAI兼容（聚合/ChatGPT/Gemini）</option>
    <option value="deepseek">DeepSeek官方</option>
  `;
  sel.value = _provider;
  sel.addEventListener('change', () => {
    _provider = sel.value;
    saveConfig();
  });

  const selModel = document.createElement('select');
  selModel.className = 'tpl-input';
  selModel.style.width = '220px';
  selModel.style.height = '34px';
  const currentModel = _provider === 'deepseek' ? (_cfg?.deepseek?.model || 'deepseek-chat') : (_cfg?.compat?.model || 'gpt-4o-mini');
  const options = (_provider === 'compat' && _models.length) ? _models : [currentModel];
  selModel.innerHTML = options
    .map((m) => `<option value="${m.replace(/"/g, '&quot;')}">${m}</option>`)
    .join('');
  selModel.value = currentModel;
  selModel.addEventListener('change', async () => {
    if (!_cfg) await loadAll();
    if (_provider === 'deepseek') _cfg.deepseek.model = selModel.value;
    else _cfg.compat.model = selModel.value;
    await saveConfig();
  });

  const btnModels = document.createElement('button');
  btnModels.className = 'btn ghost';
  btnModels.style.height = '34px';
  btnModels.textContent = '获取模型列表';
  btnModels.disabled = _provider !== 'compat';
  btnModels.addEventListener('click', fetchModels);

  const btnSync = document.createElement('button');
  btnSync.className = 'btn ghost';
  btnSync.style.height = '34px';
  btnSync.textContent = _busy ? '同步中…' : '同步历史数据';
  btnSync.disabled = _busy;
  btnSync.addEventListener('click', syncRuns);

  const btnKb = document.createElement('button');
  btnKb.className = 'btn ghost';
  btnKb.style.height = '34px';
  btnKb.textContent = _busy ? '构建中…' : '重建知识库';
  btnKb.disabled = _busy;
  btnKb.addEventListener('click', rebuildKb);

  const btnExport = document.createElement('button');
  btnExport.className = 'btn ghost';
  btnExport.style.height = '34px';
  btnExport.textContent = '导出上次筛选结果';
  btnExport.addEventListener('click', async () => {
    const r = await window.desktopAPI.ai.exportLastSqlResult();
    if (r?.canceled) return;
    if (!r?.ok) alert(`导出失败：${r?.error || 'unknown error'}`);
    else alert(`已导出：${r.filePath}`);
  });

  const btnCfg = document.createElement('button');
  btnCfg.className = 'btn ghost';
  btnCfg.style.height = '34px';
  btnCfg.textContent = '配置 API Key';
  btnCfg.addEventListener('click', () => {
    _showConfig = true;
    store.set({ report: { ...(store.state.report || {}), _t: Date.now() } });
  });

  const primaryActions = document.createElement('div');
  primaryActions.className = 'ai-report-actions';
  primaryActions.appendChild(btnSync);
  primaryActions.appendChild(btnExport);

  const statusGrid = document.createElement('div');
  statusGrid.className = 'ai-status-grid';
  statusGrid.appendChild(createMetricCard({
    label: '采集任务',
    value: _dbStats?.ok ? String(_dbStats.runs || 0) : '-'
  }));
  statusGrid.appendChild(createMetricCard({
    label: '达人',
    value: _dbStats?.ok ? String(_dbStats.creators || 0) : '-',
    tone: _dbStats?.creators ? 'good' : ''
  }));
  statusGrid.appendChild(createMetricCard({
    label: '笔记',
    value: _dbStats?.ok ? String(_dbStats.notes || 0) : '-'
  }));
  statusGrid.appendChild(createMetricCard({
    label: '知识库',
    value: _kbStats?.builtAt ? String(_kbStats.docCount || 0) : '-',
    tone: _kbStats?.builtAt ? 'good' : ''
  }));

  const kbStat = document.createElement('div');
  kbStat.className = 'muted-line';
  if (_kbStats?.builtAt) {
    kbStat.textContent = `知识库最近更新：${_kbStats.builtAt}`;
  } else {
    kbStat.textContent = '知识库尚未构建。同步历史数据后会自动构建，也可以在高级设置里手动重建。';
  }

  const advancedControls = document.createElement('div');
  advancedControls.className = 'ai-advanced-controls';
  advancedControls.appendChild(sel);
  advancedControls.appendChild(selModel);
  advancedControls.appendChild(btnModels);
  advancedControls.appendChild(btnKb);
  advancedControls.appendChild(btnCfg);

  top.appendChild(primaryActions);
  top.appendChild(statusGrid);
  top.appendChild(kbStat);
  top.appendChild(createAdvancedSection({
    title: '高级设置：模型、知识库和 API',
    children: [advancedControls]
  }));

  root.appendChild(top);

  const chat = document.createElement('div');
  chat.className = 'card ai-chat-card';
  chat.style.padding = '12px';
  chat.style.flex = '1';
  chat.style.minHeight = '420px';
  chat.style.display = 'flex';
  chat.style.flexDirection = 'column';

  const list = document.createElement('div');
  list.style.flex = '1';
  list.style.overflow = 'auto';
  list.style.padding = '4px 2px';
  _msgs.forEach((m) => list.appendChild(bubble(m)));

  const bottom = document.createElement('div');
  bottom.style.display = 'flex';
  bottom.style.gap = '10px';
  bottom.style.alignItems = 'flex-end';
  bottom.style.marginTop = '10px';

  const ta = document.createElement('textarea');
  ta.className = 'tpl-input';
  ta.style.height = '84px';
  ta.style.padding = '10px 12px';
  ta.style.resize = 'none';
  ta.value = _input;
  ta.placeholder = '输入你的需求…（Enter 发送，Shift+Enter 换行）';
  ta.addEventListener('input', () => (_input = ta.value));
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  const btn = document.createElement('button');
  btn.className = 'btn primary';
  btn.style.height = '44px';
  btn.style.padding = '0 16px';
  btn.textContent = _busy ? '发送中…' : '发送';
  btn.disabled = _busy;
  btn.addEventListener('click', send);

  bottom.appendChild(ta);
  bottom.appendChild(btn);

  chat.appendChild(list);
  chat.appendChild(bottom);
  root.appendChild(chat);

  const modal = configModal();
  if (modal) root.appendChild(modal);

  if (!_cfg && !(state.report && state.report._loadedOnce)) {
    store.set({ report: { ...(store.state.report || {}), _loadedOnce: true } });
    setTimeout(() => loadAll(), 0);
  }

  return root;
}
