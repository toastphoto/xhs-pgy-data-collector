import { store } from '../state/store.js';

let _runs = [];
let _selectedRunDir = '';
let _msg = '';
let _columns = [];
let _groups = [];
let _checked = new Set();
let _query = '';
let _colsLoadedOnce = false;
let _activeGroup = '';

function setMsg(s) {
  _msg = s || '';
  store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
}

async function refreshRuns() {
  setMsg('刷新 runs 列表中...');
  try {
    const r = await window.desktopAPI.exports.listRuns();
    if (!r?.ok) {
      setMsg(`刷新失败：${r?.error || 'unknown error'}`);
      return;
    }
    _runs = Array.isArray(r.runs) ? r.runs : [];
    if (!_selectedRunDir) _selectedRunDir = _runs?.[0]?.path || '';
    setMsg('');
  } catch (e) {
    setMsg(`刷新异常：${e?.message || String(e)}`);
  }
}

async function ensureColumnsLoaded() {
  if (_colsLoadedOnce) return;
  _colsLoadedOnce = true;
  try {
    const r = await window.desktopAPI.exports.getResourceColumns();
    if (r?.ok) {
      _columns = Array.isArray(r.columns) ? r.columns : [];
      _groups = Array.isArray(r.groups) ? r.groups : [];
    }
    const p = await window.desktopAPI.exports.loadColumnPreset();
    const preset = p?.ok && Array.isArray(p.selectedColumns) ? p.selectedColumns.map(String) : [];
    const known = p?.ok && Array.isArray(p.knownColumns) ? p.knownColumns.map(String) : [];
    const presetSet = new Set(preset);
    const knownSet = new Set(known);

    // 规则：
    // - 如果没有 preset：全选
    // - 如果有 preset：按 preset 勾选；若发现“新增列”（当前列不在 knownColumns 里）则默认勾选
    if (!preset.length) {
      _checked = new Set(_columns);
    } else {
      _checked = new Set(preset);
      _columns.forEach((c) => {
        if (!knownSet.has(c)) _checked.add(c); // 新增列默认勾选
      });
    }
  } catch (_) {
    // ignore
  }
}

function _filteredColumns(cols) {
  const q = String(_query || '').trim();
  if (!q) return cols;
  return cols.filter((c) => String(c).includes(q));
}

export function renderExports(state) {
  const root = document.createElement('div');
  root.className = 'view';

  const title = document.createElement('h2');
  title.textContent = '结果 & 导出';
  root.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = '选择一个 runs/run_* 目录，将其下所有子任务的 raw_result.json 汇总导出为 Excel。支持：①媒介资源表（达人一行，Top10 笔记列）②达人汇总+笔记明细（两张表）。';
  root.appendChild(desc);

  // 首次进入：加载 runs + 列定义/上次选择
  if (!_runs.length && !(state.exports && state.exports._loadedOnce)) {
    store.set({ exports: { ...(store.state.exports || {}), _loadedOnce: true } });
    setTimeout(() => refreshRuns().then(() => store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } })), 0);
  }
  if (!_colsLoadedOnce) {
    setTimeout(() => ensureColumnsLoaded().then(() => store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } })), 0);
  }

  const bar = document.createElement('div');
  bar.style.display = 'flex';
  bar.style.flexWrap = 'wrap';
  bar.style.gap = '10px';
  bar.style.alignItems = 'center';
  bar.style.margin = '10px 0 10px 0';

  const sel = document.createElement('select');
  sel.className = 'tpl-input';
  sel.style.maxWidth = '560px';
  sel.style.height = '34px';
  (_runs || []).forEach((it) => {
    const opt = document.createElement('option');
    opt.value = it.path;
    opt.textContent = it.name || it.path;
    if (it.path === _selectedRunDir) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => {
    _selectedRunDir = sel.value;
  });

  const btnRefresh = document.createElement('button');
  btnRefresh.className = 'btn ghost';
  btnRefresh.style.height = '34px';
  btnRefresh.textContent = '刷新';
  btnRefresh.addEventListener('click', async () => {
    await refreshRuns();
    store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
  });

  const btnExport = document.createElement('button');
  btnExport.className = 'btn ghost';
  btnExport.style.height = '34px';
  btnExport.textContent = '导出 Excel（两张表）';
  btnExport.addEventListener('click', async () => {
    setMsg('导出中...');
    try {
      const r = await window.desktopAPI.exports.exportRun({ runDir: _selectedRunDir });
      if (!r?.ok) {
        setMsg(`导出失败：${r?.error || 'unknown error'}`);
        return;
      }
      setMsg(`导出成功：\n${r.outPath}\n\n统计：raw_result.json=${r.files}，达人=${r.creators}，笔记=${r.notes}`);
    } catch (e) {
      setMsg(`导出异常：${e?.message || String(e)}`);
    }
  });

  const btnExportResource = document.createElement('button');
  btnExportResource.className = 'btn primary';
  btnExportResource.style.height = '34px';
  btnExportResource.textContent = '导出媒介资源表（达人一行）';
  btnExportResource.addEventListener('click', async () => {
    setMsg('导出中...');
    try {
      const r = await window.desktopAPI.exports.exportResourceRun({ runDir: _selectedRunDir });
      if (!r?.ok) {
        setMsg(`导出失败：${r?.error || 'unknown error'}`);
        return;
      }
      const dropped = (r.droppedCols !== undefined) ? `，已移除全空列=${r.droppedCols}` : '';
      setMsg(`导出成功：\n${r.outPath}\n\n统计：raw_result.json=${r.files}，达人=${r.creators}，Top10笔记(非空标题)=${r.notesTop}${dropped}`);
    } catch (e) {
      setMsg(`导出异常：${e?.message || String(e)}`);
    }
  });

  const btnOpenRun = document.createElement('button');
  btnOpenRun.className = 'btn ghost';
  btnOpenRun.style.height = '34px';
  btnOpenRun.textContent = '打开 run 目录';
  btnOpenRun.disabled = !_selectedRunDir;
  btnOpenRun.addEventListener('click', async () => {
    const r = await window.desktopAPI.exports.openPath(_selectedRunDir);
    if (!r?.ok) alert(`打开失败：${r?.error || 'unknown error'}`);
  });

  bar.appendChild(sel);
  bar.appendChild(btnRefresh);
  bar.appendChild(btnExportResource);
  bar.appendChild(btnExport);
  bar.appendChild(btnOpenRun);
  root.appendChild(bar);

  // 二次导出：按列勾选（两栏 + sticky 操作条）
  const sec = document.createElement('div');
  sec.className = 'card';
  sec.style.marginTop = '14px';
  sec.style.padding = '14px';

  const head = document.createElement('div');
  head.style.display = 'flex';
  head.style.alignItems = 'baseline';
  head.style.justifyContent = 'space-between';
  head.style.gap = '12px';
  head.style.marginBottom = '10px';

  const h3 = document.createElement('div');
  h3.style.fontWeight = '900';
  h3.style.letterSpacing = '0.2px';
  h3.textContent = '二次导出（按列勾选）';

  const hint = document.createElement('div');
  hint.style.color = 'var(--muted)';
  hint.style.fontSize = '12px';
  hint.textContent = '导出精简版：按勾选列导出，并自动剔除全空列；会记住你的上次选择。';

  head.appendChild(h3);
  head.appendChild(hint);
  sec.appendChild(head);

  const groups = (_groups && _groups.length) ? _groups : [{ name: '全部列', columns: _columns }];
  if (!_activeGroup && groups.length) _activeGroup = groups[0].name;
  if (!groups.some((g) => g.name === _activeGroup) && groups.length) _activeGroup = groups[0].name;
  const active = groups.find((g) => g.name === _activeGroup) || groups[0] || { name: '全部列', columns: _columns };

  const tools = document.createElement('div');
  tools.style.display = 'flex';
  tools.style.flexWrap = 'wrap';
  tools.style.gap = '8px';
  tools.style.alignItems = 'center';
  tools.style.marginBottom = '12px';

  const search = document.createElement('input');
  search.className = 'tpl-input';
  search.placeholder = '搜索列名（例如：粉丝 / 报价 / 笔记）';
  search.style.height = '34px';
  search.style.maxWidth = '360px';
  search.value = _query;
  search.addEventListener('input', () => {
    _query = search.value;
    store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
  });

  const mkMiniBtn = (label, onClick) => {
    const b = document.createElement('button');
    b.className = 'btn ghost';
    b.style.height = '34px';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };

  tools.appendChild(search);
  tools.appendChild(
    mkMiniBtn('全选', () => {
      _columns.forEach((c) => _checked.add(c));
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    })
  );
  tools.appendChild(
    mkMiniBtn('全不选', () => {
      _checked = new Set();
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    })
  );
  tools.appendChild(
    mkMiniBtn('反选', () => {
      const next = new Set();
      _columns.forEach((c) => { if (!_checked.has(c)) next.add(c); });
      _checked = next;
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    })
  );
  sec.appendChild(tools);

  const pane = document.createElement('div');
  pane.style.display = 'grid';
  pane.style.gridTemplateColumns = '190px 1fr';
  pane.style.gap = '12px';
  pane.style.minHeight = '360px';

  // 左：分组
  const left = document.createElement('div');
  left.style.background = 'var(--panel2)';
  left.style.border = '1px solid var(--line)';
  left.style.borderRadius = '14px';
  left.style.padding = '10px';

  groups.forEach((g) => {
    const cols = Array.isArray(g.columns) ? g.columns : [];
    const total = cols.length;
    const checkedN = cols.filter((c) => _checked.has(c)).length;
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.style.width = '100%';
    btn.style.display = 'flex';
    btn.style.justifyContent = 'space-between';
    btn.style.alignItems = 'center';
    btn.style.padding = '10px 10px';
    btn.style.marginBottom = '8px';
    btn.style.borderRadius = '12px';
    btn.style.background = (g.name === _activeGroup) ? 'var(--primary-weak)' : 'rgba(255,255,255,0.55)';
    btn.style.borderColor = (g.name === _activeGroup) ? 'rgba(232, 90, 154, 0.22)' : 'rgba(17,24,39,0.08)';
    btn.addEventListener('click', () => {
      _activeGroup = g.name;
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    });

    const name = document.createElement('div');
    name.style.fontWeight = '700';
    name.textContent = g.name;

    const badge = document.createElement('div');
    badge.style.fontSize = '12px';
    badge.style.color = 'var(--muted)';
    badge.textContent = `${checkedN}/${total}`;

    btn.appendChild(name);
    btn.appendChild(badge);
    left.appendChild(btn);
  });

  // 右：列列表
  const right = document.createElement('div');
  right.style.border = '1px solid var(--line)';
  right.style.borderRadius = '14px';
  right.style.background = 'var(--panel)';
  right.style.overflow = 'auto';
  right.style.position = 'relative';

  const rightTop = document.createElement('div');
  rightTop.style.padding = '12px 12px 10px 12px';
  rightTop.style.borderBottom = '1px solid var(--line)';
  rightTop.style.position = 'sticky';
  rightTop.style.top = '0';
  rightTop.style.zIndex = '2';
  rightTop.style.background = 'rgba(255,255,255,0.92)';
  rightTop.style.backdropFilter = 'blur(10px)';

  const rtTitle = document.createElement('div');
  rtTitle.style.fontWeight = '800';
  rtTitle.textContent = `${active.name} · 列选择`;
  const rtSub = document.createElement('div');
  rtSub.style.color = 'var(--muted)';
  rtSub.style.fontSize = '12px';
  rtSub.style.marginTop = '4px';
  rtSub.textContent = `已选 ${_checked.size} / ${_columns.length}`;

  rightTop.appendChild(rtTitle);
  rightTop.appendChild(rtSub);
  right.appendChild(rightTop);

  const list = document.createElement('div');
  list.style.padding = '10px 12px 68px 12px'; // 预留 sticky 底部

  const cols = _filteredColumns(Array.isArray(active.columns) ? active.columns : []);
  if (!cols.length && String(_query || '').trim()) {
    const empty = document.createElement('div');
    empty.style.color = 'var(--muted)';
    empty.style.fontSize = '13px';
    empty.textContent = '当前分组下无匹配列。';
    list.appendChild(empty);
  } else {
    cols.forEach((c) => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.gap = '10px';
      row.style.alignItems = 'center';
      row.style.padding = '10px 10px';
      row.style.borderRadius = '12px';
      row.style.cursor = 'pointer';
      row.style.border = '1px solid rgba(17,24,39,0.06)';
      row.style.background = 'rgba(17,24,39,0.02)';
      row.style.marginBottom = '8px';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = _checked.has(c);
      cb.addEventListener('change', () => {
        if (cb.checked) _checked.add(c);
        else _checked.delete(c);
        store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
      });

      const txt = document.createElement('div');
      txt.style.fontSize = '13px';
      txt.style.color = 'var(--text)';
      txt.style.flex = '1';
      txt.textContent = c;

      row.appendChild(cb);
      row.appendChild(txt);
      list.appendChild(row);
    });
  }
  right.appendChild(list);

  // sticky 导出条
  const sticky = document.createElement('div');
  sticky.style.position = 'sticky';
  sticky.style.bottom = '0';
  sticky.style.left = '0';
  sticky.style.right = '0';
  sticky.style.zIndex = '3';
  sticky.style.padding = '10px 12px';
  sticky.style.borderTop = '1px solid var(--line)';
  sticky.style.background = 'rgba(255,255,255,0.92)';
  sticky.style.backdropFilter = 'blur(10px)';
  sticky.style.display = 'flex';
  sticky.style.alignItems = 'center';
  sticky.style.justifyContent = 'space-between';
  sticky.style.gap = '10px';

  const leftStat = document.createElement('div');
  leftStat.style.color = 'var(--muted)';
  leftStat.style.fontSize = '12px';
  leftStat.textContent = `已选 ${_checked.size} / ${_columns.length} · 会自动剔除全空列`;

  const btnExportSlim = document.createElement('button');
  btnExportSlim.className = 'btn primary';
  btnExportSlim.style.height = '36px';
  btnExportSlim.textContent = '导出精简版';
  btnExportSlim.disabled = !_columns.length;
  btnExportSlim.addEventListener('click', async () => {
    const selectedColumns = _columns.filter((c) => _checked.has(c));
    if (!selectedColumns.length) {
      alert('请至少勾选 1 列');
      return;
    }
    setMsg('导出精简版中...');
    try {
      await window.desktopAPI.exports.saveColumnPreset(selectedColumns);
      const r = await window.desktopAPI.exports.exportResourceRun({
        runDir: _selectedRunDir,
        selectedColumns,
        mode: 'slim'
      });
      if (!r?.ok) {
        setMsg(`导出失败：${r?.error || 'unknown error'}`);
        return;
      }
      const dropped = (r.droppedCols !== undefined) ? `，已移除全空列=${r.droppedCols}` : '';
      setMsg(`导出成功：\n${r.outPath}\n\n统计：达人=${r.creators}，selectedCols=${r.selectedCols ?? selectedColumns.length}${dropped}`);
    } catch (e) {
      setMsg(`导出异常：${e?.message || String(e)}`);
    }
  });

  sticky.appendChild(leftStat);
  sticky.appendChild(btnExportSlim);
  right.appendChild(sticky);

  pane.appendChild(left);
  pane.appendChild(right);
  sec.appendChild(pane);
  root.appendChild(sec);

  const msg = document.createElement('div');
  msg.style.marginTop = '10px';
  msg.style.fontSize = '13px';
  msg.style.whiteSpace = 'pre-wrap';
  msg.style.color = 'var(--text)';
  msg.textContent = _msg || '';
  root.appendChild(msg);

  return root;
}
