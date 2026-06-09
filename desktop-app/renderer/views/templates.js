import { store } from '../state/store.js';

let _loadedOnce = false;
let _activePath = '';
let _draft = null; // 当前编辑中的模板 JSON
let _msg = '';
let _busy = false;

function fmtTime(ts) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false });
  } catch (_) {
    return String(ts);
  }
}

function setMsg(root, s) {
  _msg = s || '';
  const el = root?.querySelector?.('[data-role="msg"]');
  if (el) el.textContent = _msg;
}

function cloneJson(x) {
  try {
    return JSON.parse(JSON.stringify(x || {}));
  } catch (_) {
    return {};
  }
}

function sanitizeTemplate(data) {
  const d = cloneJson(data);
  d.creator_summary = Array.isArray(d.creator_summary) ? d.creator_summary : [];
  d.note_detail = Array.isArray(d.note_detail) ? d.note_detail : [];

  const fixRow = (r) => {
    const row = { ...(r || {}) };
    // 空字符串尽量转成 null/删除，避免写出脏数据
    if (typeof row.name === 'string') row.name = row.name.trim();
    if (row.name === '') row.name = '';

    if (typeof row.selector === 'string') {
      const s = row.selector.trim();
      row.selector = s ? s : null;
    }
    if (typeof row.attr === 'string') {
      const s = row.attr.trim();
      if (!s) delete row.attr;
      else row.attr = s;
    }
    if (typeof row.transform === 'string') {
      const s = row.transform.trim();
      if (!s) delete row.transform;
      else row.transform = s;
    }
    if (typeof row.value === 'string') {
      // value 允许为空，但空白时写成空字符串
      row.value = row.value;
    }
    return row;
  };

  d.creator_summary = d.creator_summary.map(fixRow);
  d.note_detail = d.note_detail.map(fixRow);
  return d;
}

async function refreshList(root) {
  if (_busy) return;
  _busy = true;
  setMsg(root, '刷新模板列表中...');
  try {
    const r = await window.desktopAPI.template.list();
    if (!r?.ok) {
      setMsg(root, `刷新失败：${r?.error || 'unknown error'}`);
      return;
    }
    store.set({
      templates: { ...store.state.templates, templates: r.files || [] }
    });
    setMsg(root, '');
  } catch (e) {
    setMsg(root, `刷新异常：${e?.message || String(e)}`);
  } finally {
    _busy = false;
  }
}

async function loadTemplate(root, filePath) {
  if (_busy) return;
  _busy = true;
  setMsg(root, '加载模板中...');
  try {
    const r = await window.desktopAPI.template.load(filePath);
    if (!r?.ok) {
      setMsg(root, `加载失败：${r?.error || 'unknown error'}`);
      return;
    }
    _activePath = r.filePath || filePath || '';
    _draft = cloneJson(r.data || {});
    store.set({
      templates: { ...store.state.templates, activeTemplatePath: _activePath }
    });
    setMsg(root, '');
  } catch (e) {
    setMsg(root, `加载异常：${e?.message || String(e)}`);
  } finally {
    _busy = false;
  }
}

function buildInput(value, onChange, placeholder = '') {
  const input = document.createElement('input');
  input.className = 'tpl-input';
  input.placeholder = placeholder;
  input.value = value == null ? '' : String(value);
  input.addEventListener('input', () => onChange(input.value));
  return input;
}

function buildSmallBtn(text, onClick) {
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.height = '30px';
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

function renderFieldTable(root, title, key) {
  const section = document.createElement('div');
  section.style.marginTop = '14px';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '10px';

  const h3 = document.createElement('h3');
  h3.textContent = title;
  h3.style.margin = '0 0 8px 0';
  h3.style.fontSize = '14px';
  h3.style.fontWeight = '700';

  const addBtn = buildSmallBtn('新增字段', () => {
    if (!_draft) return;
    _draft[key] = Array.isArray(_draft[key]) ? _draft[key] : [];
    _draft[key].push({ name: '', selector: '', attr: '', transform: '', value: '' });
    // 触发重新渲染
    store.set({ templates: { ...store.state.templates } });
  });
  addBtn.style.height = '28px';

  header.appendChild(h3);
  header.appendChild(addBtn);
  section.appendChild(header);

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.fontSize = '13px';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th style="text-align:left; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.08); width: 130px;">name</th>
      <th style="text-align:left; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.08);">selector</th>
      <th style="text-align:left; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.08); width: 90px;">attr</th>
      <th style="text-align:left; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.08); width: 110px;">transform</th>
      <th style="text-align:left; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.08); width: 130px;">value</th>
      <th style="text-align:left; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.08); width: 84px;">操作</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const rows = Array.isArray(_draft?.[key]) ? _draft[key] : [];
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="6" style="padding:10px 6px; color: rgba(230,237,243,0.7);">
        暂无字段。点击“新增字段”添加一行。
      </td>
    `;
    tbody.appendChild(tr);
  } else {
    rows.forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.06)';

      const tdName = document.createElement('td');
      tdName.style.padding = '6px';
      tdName.appendChild(
        buildInput(row?.name || '', (v) => {
          _draft[key][idx].name = v;
        }, '字段名')
      );

      const tdSel = document.createElement('td');
      tdSel.style.padding = '6px';
      tdSel.appendChild(
        buildInput(row?.selector ?? '', (v) => {
          _draft[key][idx].selector = v;
        }, 'CSS selector（可为空）')
      );

      const tdAttr = document.createElement('td');
      tdAttr.style.padding = '6px';
      tdAttr.appendChild(
        buildInput(row?.attr ?? '', (v) => {
          _draft[key][idx].attr = v;
        }, 'href 等')
      );

      const tdTf = document.createElement('td');
      tdTf.style.padding = '6px';
      tdTf.appendChild(
        buildInput(row?.transform ?? '', (v) => {
          _draft[key][idx].transform = v;
        }, 'text/number/url')
      );

      const tdVal = document.createElement('td');
      tdVal.style.padding = '6px';
      tdVal.appendChild(
        buildInput(row?.value ?? '', (v) => {
          _draft[key][idx].value = v;
        }, '常量（可空）')
      );

      const tdOps = document.createElement('td');
      tdOps.style.padding = '6px';
      const delBtn = buildSmallBtn('删除', () => {
        if (!_draft) return;
        _draft[key].splice(idx, 1);
        store.set({ templates: { ...store.state.templates } });
      });
      delBtn.style.height = '28px';
      tdOps.appendChild(delBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdSel);
      tr.appendChild(tdAttr);
      tr.appendChild(tdTf);
      tr.appendChild(tdVal);
      tr.appendChild(tdOps);
      tbody.appendChild(tr);
    });
  }

  table.appendChild(tbody);
  section.appendChild(table);
  return section;
}

export function renderTemplates(state) {
  const root = document.createElement('div');
  root.className = 'view';

  const title = document.createElement('h2');
  title.textContent = '采集模板';
  root.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = '管理本地 templates/*.json，并编辑 creator_summary / note_detail 两张表的字段映射。';
  root.appendChild(desc);

  const toolbar = document.createElement('div');
  toolbar.style.display = 'flex';
  toolbar.style.gap = '10px';
  toolbar.style.flexWrap = 'wrap';
  toolbar.style.alignItems = 'center';

  const btnRefresh = document.createElement('button');
  btnRefresh.className = 'btn';
  btnRefresh.textContent = '刷新列表';
  btnRefresh.addEventListener('click', () => refreshList(root));

  const btnSave = document.createElement('button');
  btnSave.className = 'btn';
  btnSave.textContent = '保存';
  btnSave.disabled = !_draft;
  btnSave.addEventListener('click', async () => {
    if (!_draft) return;
    setMsg(root, '保存中...');
    try {
      const payload = sanitizeTemplate(_draft);
      const r = await window.desktopAPI.template.save(_activePath || state.templates.activeTemplatePath, payload);
      if (!r?.ok) {
        setMsg(root, `保存失败：${r?.error || 'unknown error'}`);
        return;
      }
      _activePath = r.filePath || _activePath;
      store.set({ templates: { ...store.state.templates, activeTemplatePath: _activePath } });
      await refreshList(root);
      setMsg(root, `已保存：${r.name || r.filePath || ''}`);
    } catch (e) {
      setMsg(root, `保存异常：${e?.message || String(e)}`);
    }
  });

  const btnClone = document.createElement('button');
  btnClone.className = 'btn';
  btnClone.textContent = '克隆为新模板';
  btnClone.disabled = !_draft || !_activePath;
  btnClone.addEventListener('click', async () => {
    if (!_activePath) return;
    const nextName = window.prompt('输入新模板文件名（可不含 .json）', '');
    if (nextName == null) return;
    setMsg(root, '克隆中...');
    try {
      const r = await window.desktopAPI.template.clone(_activePath, nextName);
      if (!r?.ok) {
        setMsg(root, `克隆失败：${r?.error || 'unknown error'}`);
        return;
      }
      await refreshList(root);
      await loadTemplate(root, r.filePath);
      setMsg(root, `已克隆：${r.name || r.filePath || ''}`);
    } catch (e) {
      setMsg(root, `克隆异常：${e?.message || String(e)}`);
    }
  });

  const btnSuggestCard = document.createElement('button');
  btnSuggestCard.className = 'btn';
  btnSuggestCard.textContent = '自动识别笔记卡片';
  btnSuggestCard.disabled = !_draft;
  btnSuggestCard.addEventListener('click', async () => {
    if (_busy) return;
    if (!_draft) return;
    _busy = true;
    setMsg(root, '正在从右侧页面推断 noteCardSelector...（请确保右侧已打开「笔记数据」tab，并能看到多条笔记卡片）');
    try {
      const r = await window.desktopAPI.pgy.suggestNoteCardSelector();
      if (!r?.ok) {
        setMsg(root, `推断失败：${r?.error || 'unknown error'}\nanchors: ${r?.anchors ?? ''}`);
        return;
      }
      _draft.noteCardSelector = r.noteCardSelector || null;
      setMsg(root, `已填入 noteCardSelector：${_draft.noteCardSelector}\nconfidence: ${r.confidence || ''}\nanchors: ${r.anchors || ''}\ncardCount: ${r.cardCount || ''}\n\n你可以继续点击「从当前达人页测试提取（多页）」验证 notes_count 是否 > 0。`);
      // 触发重新渲染（让输入框显示最新值）
      store.set({ templates: { ...store.state.templates } });
    } catch (e) {
      setMsg(root, `推断异常：${e?.message || String(e)}`);
    } finally {
      _busy = false;
    }
  });

  const btnTestMulti = document.createElement('button');
  btnTestMulti.className = 'btn';
  btnTestMulti.textContent = '从当前达人页测试提取（多页）';
  btnTestMulti.disabled = !_draft || !(_activePath || state.templates.activeTemplatePath);
  btnTestMulti.addEventListener('click', async () => {
    if (_busy) return;
    const p = _activePath || state.templates.activeTemplatePath;
    if (!p) return;
    _busy = true;
    setMsg(root, '多页提取中...（会依次尝试点击 tab：数据概览 / 笔记数据 / 粉丝分析）');
    try {
      const r = await window.desktopAPI.pgy.extractCurrentMultiPage(p, {
        tabTexts: Array.isArray(_draft?.tabTexts) ? _draft.tabTexts : undefined
      });
      if (!r?.ok) {
        setMsg(root, `提取失败：${r?.error || 'unknown error'}\nrunId: ${r?.runId || ''}\nrunDir: ${r?.runDir || ''}`);
        return;
      }
      const preview = r?.preview || {};
      const debug = r?.debug || {};
      const lines = [];
      lines.push('提取完成（多页合并）。');
      lines.push(`raw_result.json: ${r.jsonPath}`);
      lines.push(`evidence: ${r.evidenceDir}`);
      if (debug && (debug.noteUrlResolved !== undefined || debug.noteUrlClipboardSample)) {
        lines.push('');
        lines.push(`debug.noteUrlResolved: ${debug.noteUrlResolved ?? ''}`);
        if (debug.noteUrlClipboardSample) {
          lines.push(`debug.noteUrlClipboardSample: ${debug.noteUrlClipboardSample}`);
        }
      }
      lines.push('');
      lines.push('preview.creator_summary:');
      lines.push(JSON.stringify(preview.creator_summary || {}, null, 2));
      lines.push('');
      lines.push(`notes_count: ${preview.notes_count || 0}`);
      if (Array.isArray(preview.notes_sample) && preview.notes_sample.length) {
        lines.push('notes_sample:');
        lines.push(JSON.stringify(preview.notes_sample, null, 2));
      }
      setMsg(root, lines.join('\n'));
    } catch (e) {
      setMsg(root, `提取异常：${e?.message || String(e)}`);
    } finally {
      _busy = false;
    }
  });

  toolbar.appendChild(btnRefresh);
  toolbar.appendChild(btnSave);
  toolbar.appendChild(btnClone);
  toolbar.appendChild(btnSuggestCard);
  toolbar.appendChild(btnTestMulti);
  root.appendChild(toolbar);

  const msg = document.createElement('div');
  msg.dataset.role = 'msg';
  msg.style.margin = '10px 0 12px 0';
  msg.style.fontSize = '13px';
  msg.style.whiteSpace = 'pre-wrap';
  msg.style.color = 'rgba(230, 237, 243, 0.85)';
  msg.textContent = _msg || '';
  root.appendChild(msg);

  // 主体区域：左列表 + 右编辑器
  const layout = document.createElement('div');
  layout.style.display = 'grid';
  layout.style.gridTemplateColumns = '260px 1fr';
  layout.style.gap = '12px';
  layout.style.alignItems = 'start';

  const left = document.createElement('div');
  left.style.border = '1px solid rgba(255,255,255,0.08)';
  left.style.borderRadius = '12px';
  left.style.padding = '10px';
  left.style.background = 'rgba(255,255,255,0.03)';

  const right = document.createElement('div');
  right.style.border = '1px solid rgba(255,255,255,0.08)';
  right.style.borderRadius = '12px';
  right.style.padding = '10px';
  right.style.background = 'rgba(255,255,255,0.03)';

  const listTitle = document.createElement('div');
  listTitle.textContent = '模板列表';
  listTitle.style.fontWeight = '700';
  listTitle.style.marginBottom = '8px';
  left.appendChild(listTitle);

  const select = document.createElement('select');
  select.size = 12;
  select.style.width = '100%';
  select.style.background = 'rgba(0,0,0,0.25)';
  select.style.color = '#e6edf3';
  select.style.border = '1px solid rgba(255,255,255,0.12)';
  select.style.borderRadius = '10px';
  select.style.padding = '6px';

  const files = state.templates.templates || [];
  files.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f.path;
    const meta = [f.platform, f.version].filter(Boolean).join(' / ');
    opt.textContent = meta ? `${f.name}  (${meta})` : f.name;
    if (f.path === (state.templates.activeTemplatePath || _activePath)) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    const p = select.value;
    if (!p) return;
    loadTemplate(root, p);
  });

  left.appendChild(select);

  const fileHint = document.createElement('div');
  fileHint.style.marginTop = '8px';
  fileHint.style.fontSize = '12px';
  fileHint.style.color = 'rgba(230, 237, 243, 0.7)';
  const activeFile = files.find((x) => x.path === (state.templates.activeTemplatePath || _activePath));
  fileHint.textContent = activeFile ? `mtime: ${fmtTime(activeFile.mtime)}` : '选择左侧模板后即可编辑';
  left.appendChild(fileHint);

  // 右侧：编辑器
  const editorTitle = document.createElement('div');
  editorTitle.textContent = '模板编辑';
  editorTitle.style.fontWeight = '700';
  editorTitle.style.marginBottom = '10px';
  right.appendChild(editorTitle);

  if (!_draft) {
    const empty = document.createElement('div');
    empty.style.color = 'rgba(230, 237, 243, 0.7)';
    empty.style.fontSize = '13px';
    empty.textContent = files.length ? '请从左侧选择一个模板加载。' : '当前 templates 目录为空（首次运行会自动生成默认模板，若未出现请点击“刷新列表”）。';
    right.appendChild(empty);
  } else {
    // meta 表单
    const metaGrid = document.createElement('div');
    metaGrid.style.display = 'grid';
    metaGrid.style.gridTemplateColumns = '120px 1fr';
    metaGrid.style.gap = '8px 10px';
    metaGrid.style.alignItems = 'center';

    const addMetaRow = (label, inputEl) => {
      const l = document.createElement('div');
      l.textContent = label;
      l.style.fontSize = '13px';
      l.style.color = 'rgba(230, 237, 243, 0.85)';
      metaGrid.appendChild(l);
      metaGrid.appendChild(inputEl);
    };

    addMetaRow(
      'version',
      buildInput(_draft.version || '', (v) => {
        _draft.version = v;
      }, '例如 pgy_v1_default')
    );
    addMetaRow(
      'platform',
      buildInput(_draft.platform || '', (v) => {
        _draft.platform = v;
      }, '例如 pgy')
    );
    addMetaRow(
      'mode',
      buildInput(_draft.mode || '', (v) => {
        _draft.mode = v;
      }, '例如 safe_dom')
    );

    addMetaRow(
      'noteCardSelector',
      buildInput(_draft.noteCardSelector ?? '', (v) => {
        const s = String(v ?? '').trim();
        _draft.noteCardSelector = s ? s : null;
      }, '笔记卡片的 CSS selector（用于 notes 列表）')
    );

    addMetaRow(
      'tabTexts',
      buildInput(Array.isArray(_draft.tabTexts) ? _draft.tabTexts.join(',') : '', (v) => {
        const parts = String(v ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        _draft.tabTexts = parts;
      }, '例如 数据概览,笔记数据,粉丝分析')
    );

    right.appendChild(metaGrid);
    right.appendChild(renderFieldTable(root, 'creator_summary（达人信息）', 'creator_summary'));
    right.appendChild(renderFieldTable(root, 'note_detail（笔记明细字段）', 'note_detail'));
  }

  layout.appendChild(left);
  layout.appendChild(right);
  root.appendChild(layout);

  // 首次进入页面：刷新一次列表，并尝试自动加载第一份模板
  if (!_loadedOnce) {
    _loadedOnce = true;
    setTimeout(async () => {
      await refreshList(root);
      const st = store.state;
      const list = st.templates.templates || [];
      const pick = st.templates.activeTemplatePath || list?.[0]?.path || '';
      if (pick) await loadTemplate(root, pick);
    }, 0);
  }

  return root;
}
