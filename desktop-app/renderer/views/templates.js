import { store } from '../state/store.js';
import { createActionRow, createAdvancedSection, createNotice, createPageIntro, createStepCard } from '../ui/components.js';
import { chooseCalibrationSelector, isCandidateCalibrationPassed } from '../state/calibration_selector.mjs';

let _loadedOnce = false;
let _activePath = '';
let _draft = null; // 当前编辑中的模板 JSON
let _msg = '';
let _busy = false;
let _advancedOpen = false;
let _pickerOpen = true;
let _annotationField = 'candidate_row';
let _scanCandidates = [];
let _scanFieldKey = '';
let _candidateCalibrationStarted = false;
let _candidateCalibrationStep = 'candidate_row';
let _candidateCalibrationResult = null;
let _candidatePaginationResult = null;

const ANNOTATION_FIELDS = [
  { key: 'candidate_row', label: '搜索结果中的一整行达人', candidateSearchKey: 'rowSelector', repeatable: true },
  { key: 'candidate_name', label: '搜索结果中的达人昵称', candidateSearchKey: 'nameSelector', repeatable: true },
  { key: 'candidate_pagination', label: '搜索结果分页区域', candidateSearchKey: 'paginationSelector' },
  { key: 'creator_name', label: '达人昵称', groupKey: 'creator_summary', fieldName: 'creator_name', transform: 'text' },
  { key: 'followers', label: '粉丝数', groupKey: 'creator_summary', fieldName: 'followers', transform: 'number' },
  { key: 'note_card', label: '一整张笔记卡片', noteCard: true },
  { key: 'note_title', label: '笔记标题', groupKey: 'note_detail', fieldName: 'note_title', transform: 'text' },
  { key: 'note_url', label: '笔记链接或可点击区域', groupKey: 'note_detail', fieldName: 'note_url', transform: 'url', attr: 'href' }
];

const CANDIDATE_CALIBRATION_STEPS = [
  {
    key: 'candidate_row',
    selectorKey: 'rowSelector',
    title: '标定达人整行',
    action: '点选任意一位达人的整行',
    description: '要包含头像、昵称和数据列。系统会由这一行归纳出本页所有重复达人行。'
  },
  {
    key: 'candidate_name',
    selectorKey: 'nameSelector',
    title: '标定达人昵称',
    action: '点选任意一位达人的昵称文字',
    description: '不需要逐个点第 1、2、3 位；系统会按页面从上到下读取全部昵称顺序。'
  },
  {
    key: 'candidate_pagination',
    selectorKey: 'paginationSelector',
    title: '标定分页区域',
    action: '让系统自动定位页码、上一页和下一页',
    description: '蒲公英常把分页栏放在内部滚动区深处；系统会直接识别整条分页结构，无需手动寻找。'
  }
];

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
  d.candidate_search = d.candidate_search && typeof d.candidate_search === 'object'
    ? { ...d.candidate_search }
    : {};
  for (const key of ['rowSelector', 'nameSelector', 'paginationSelector']) {
    const value = String(d.candidate_search[key] || '').trim();
    d.candidate_search[key] = value || null;
  }

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
    setMsg(root, '');
    store.set({
      templates: { ...store.state.templates, templates: r.files || [] }
    });
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
    const missingStep = CANDIDATE_CALIBRATION_STEPS.find((step) => (
      !String(_draft?.candidate_search?.[step.selectorKey] || '').trim()
    ));
    _candidateCalibrationStep = missingStep?.key || 'candidate_row';
    _candidateCalibrationResult = null;
    _candidatePaginationResult = null;
    setMsg(root, '');
    store.set({
      templates: { ...store.state.templates, activeTemplatePath: _activePath }
    });
  } catch (e) {
    setMsg(root, `加载异常：${e?.message || String(e)}`);
  } finally {
    _busy = false;
  }
}

async function saveDraftTemplate(root, state, successText = '已保存。') {
  if (!_draft) return { ok: false, error: '没有可保存的规则' };
  const payload = sanitizeTemplate(_draft);
  const r = await window.desktopAPI.template.save(_activePath || state.templates.activeTemplatePath, payload);
  if (!r?.ok) return { ok: false, error: r?.error || 'unknown error' };
  _activePath = r.filePath || _activePath;
  setMsg(root, successText);
  store.set({ templates: { ...store.state.templates, activeTemplatePath: _activePath } });
  await refreshList(root);
  return { ok: true, filePath: _activePath, name: r.name || r.filePath || '' };
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

function upsertTemplateField(groupKey, fieldName, patch) {
  if (!_draft) return;
  _draft[groupKey] = Array.isArray(_draft[groupKey]) ? _draft[groupKey] : [];
  const idx = _draft[groupKey].findIndex((x) => x?.name === fieldName);
  const next = { name: fieldName, ...(patch || {}) };
  if (idx >= 0) _draft[groupKey][idx] = { ..._draft[groupKey][idx], ...next };
  else _draft[groupKey].push(next);
}

function selectorSummary(result) {
  const text = String(result?.text || '').trim();
  const bits = [];
  if (text) bits.push(`内容：“${text.slice(0, 48)}${text.length > 48 ? '...' : ''}”`);
  if (result?.fieldCount) bits.push(`页面上找到 ${result.fieldCount} 个同类字段`);
  if (result?.count) bits.push(`页面上找到 ${result.count} 个相似位置`);
  if (result?.repeatCount) bits.push(`自动归纳出 ${result.repeatCount} 个重复位置`);
  return bits.join('\n');
}

async function saveAnnotationResult(root, state, field, result, sourceLabel = '') {
  if (!_draft) return { ok: false, error: '没有可保存的规则' };
  const selector = chooseCalibrationSelector(field, result);
  if (field.noteCard) {
    _draft.noteCardSelector = selector;
  } else if (field.candidateSearchKey) {
    _draft.candidate_search = _draft.candidate_search && typeof _draft.candidate_search === 'object'
      ? _draft.candidate_search
      : {};
    _draft.candidate_search[field.candidateSearchKey] = selector;
    _candidateCalibrationResult = null;
    _candidatePaginationResult = null;
  } else {
    upsertTemplateField(field.groupKey, field.fieldName, {
      selector,
      attr: field.attr || undefined,
      transform: field.transform || 'text'
    });
  }
  const summary = selectorSummary(result);
  const nextAdvice = field.candidateSearchKey
    ? '继续完成搜索结果校准，最后运行“验证校准”。'
    : '建议点“测试当前达人页”确认一次。';
  const save = await saveDraftTemplate(
    root,
    state,
    `${field.label} 已记住${sourceLabel ? `（${sourceLabel}）` : ''}。\n${summary ? `${summary}\n` : ''}\n之后批量采集会自动按这个位置读取。${nextAdvice}`
  );
  if (!save?.ok) {
    setMsg(root, `${field.label} 已点选，但保存失败：${save?.error || 'unknown error'}\n请点击“不常用”里的保存。`);
    return save;
  }
  store.set({ templates: { ...store.state.templates } });
  return save;
}

async function inspectCandidateSearchLayout(root, state) {
  const templatePath = _activePath || state.templates.activeTemplatePath;
  if (!templatePath) return { ok: false, error: '尚未选择校准记录' };
  setMsg(root, '正在验证右侧搜索结果：达人行、昵称顺序和分页区...');
  const result = await window.desktopAPI.pgy.inspectCandidateSearchLayout(templatePath);
  if (!result?.ok) {
    _candidateCalibrationResult = result || null;
    setMsg(root, `搜索结果校准失败：${result?.error || 'unknown error'}`);
    return result;
  }
  const page = result.pagination || {};
  const pageLabel = page.currentPageKnown ? `第 ${page.currentPage || '?'} 页` : '页码未知';
  const visiblePages = Array.isArray(page.pageNumbers) && page.pageNumbers.length
    ? page.pageNumbers.join('、')
    : '未识别';
  const names = Array.isArray(result.names) ? result.names : [];
  const warnings = [];
  if (Number(result.rowCount || 0) < 2) warnings.push('达人整行没有匹配出重复列表');
  if (Number(result.nameCount || 0) < 2) warnings.push('达人昵称没有形成可验证顺序');
  if (Number(result.rowCount || 0) && Number(result.nameCount || 0)
      && Number(result.rowCount || 0) !== Number(result.nameCount || 0)) {
    warnings.push('达人行数与昵称数不一致');
  }
  const rowSelector = String(result?.selectors?.rowSelector || '').trim();
  const nameSelector = String(result?.selectors?.nameSelector || '').trim();
  if (rowSelector && nameSelector && rowSelector === nameSelector) {
    warnings.push('达人昵称位置与达人整行相同，昵称校准过宽');
  }
  if (!page.currentPageKnown) warnings.push('分页区域没有确认当前页');
  setMsg(root, [
    warnings.length ? '校准尚未通过。' : '校准通过，可以按排名跨页累计。',
    `当前页：${pageLabel}；可见页码：${visiblePages}`,
    `识别达人行：${result.rowCount || 0}；识别昵称：${result.nameCount || 0}`,
    names.length ? `本页顺序：${names.slice(0, 8).join(' → ')}${names.length > 8 ? ' → ...' : ''}` : '',
    warnings.length ? `需要重做：${warnings.join('；')}` : '正式采集会用这份昵称顺序核对接口响应，再点击下一页并去重累计。'
  ].filter(Boolean).join('\n'));
  const checked = { ...result, passed: warnings.length === 0, warnings };
  _candidateCalibrationResult = checked;
  store.set({ templates: { ...store.state.templates } });
  return checked;
}

function candidatePreviewText(candidate) {
  const text = String(candidate?.text || '').trim();
  if (text) return text.length > 70 ? `${text.slice(0, 70)}...` : text;
  const href = String(candidate?.href || '').trim();
  if (href) return href.length > 70 ? `${href.slice(0, 70)}...` : href;
  return candidate?.tag ? `<${candidate.tag}>` : '页面块';
}

function renderFieldTable(root, title, key) {
  const section = document.createElement('div');
  section.className = 'template-field-section';

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

  const list = document.createElement('div');
  list.className = 'template-field-list';
  const rows = Array.isArray(_draft?.[key]) ? _draft[key] : [];
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'contact-review-empty';
    empty.textContent = '暂无字段。点击“新增字段”添加一行。';
    list.appendChild(empty);
  } else {
    rows.forEach((row, idx) => {
      const card = document.createElement('div');
      card.className = 'template-field-card';

      const head = document.createElement('div');
      head.className = 'template-field-card-head';
      const name = document.createElement('div');
      name.className = 'template-field-name';
      name.textContent = row?.name || `未命名字段 ${idx + 1}`;
      const chips = document.createElement('div');
      chips.className = 'candidate-quick';
      if (row?.transform) {
        const chip = document.createElement('span');
        chip.className = 'contact-chip strong';
        chip.textContent = `整理：${row.transform}`;
        chips.appendChild(chip);
      }
      if (row?.attr) {
        const chip = document.createElement('span');
        chip.className = 'contact-chip';
        chip.textContent = `读取：${row.attr}`;
        chips.appendChild(chip);
      }
      head.appendChild(name);
      head.appendChild(chips);
      card.appendChild(head);

      const selectorPreview = document.createElement('div');
      selectorPreview.className = 'template-selector-preview';
      selectorPreview.textContent = row?.selector || row?.value || '系统还没有记住这个字段的位置';
      card.appendChild(selectorPreview);

      const detail = document.createElement('details');
      detail.className = 'template-field-detail';
      const summary = document.createElement('summary');
      summary.textContent = '编辑字段';
      detail.appendChild(summary);

      const form = document.createElement('div');
      form.className = 'template-field-form';
      const addField = (label, inputEl, wide = false) => {
        const wrap = document.createElement('label');
        wrap.className = `field-label compact ${wide ? 'wide' : ''}`.trim();
        wrap.textContent = label;
        wrap.appendChild(inputEl);
        form.appendChild(wrap);
      };

      addField('字段名', buildInput(row?.name || '', (v) => {
        _draft[key][idx].name = v;
      }, '字段名'));

      addField('系统定位（不建议手改）', buildInput(row?.selector ?? '', (v) => {
        _draft[key][idx].selector = v;
      }, '系统会自动填写'), true);

      addField('读取属性', buildInput(row?.attr ?? '', (v) => {
        _draft[key][idx].attr = v;
      }, '链接字段等'));

      addField('整理方式', buildInput(row?.transform ?? '', (v) => {
        _draft[key][idx].transform = v;
      }, '文字/数字/链接'));

      addField('固定值', buildInput(row?.value ?? '', (v) => {
        _draft[key][idx].value = v;
      }, '常量（可空）'), true);

      const ops = document.createElement('div');
      ops.className = 'candidate-card-actions';
      const delBtn = buildSmallBtn('删除', () => {
        if (!_draft) return;
        _draft[key].splice(idx, 1);
        store.set({ templates: { ...store.state.templates } });
      });
      delBtn.style.height = '28px';
      ops.appendChild(delBtn);
      form.appendChild(ops);

      detail.appendChild(form);
      card.appendChild(detail);
      list.appendChild(card);
    });
  }

  section.appendChild(list);
  return section;
}

export function renderTemplates(state) {
  const root = document.createElement('div');
  root.className = 'view';

  root.appendChild(createPageIntro({
    title: '点选采集内容',
    description: '右侧打开搜索结果页或达人页后，直接点选要识别的达人行、昵称、分页区域或详情字段。系统会把点选结果保存成规则。'
  }));
  root.appendChild(createNotice({
    html: '<b>普通使用建议：</b>页面结构没变时保持默认即可。字段抓不到时，打开右侧达人页，用下面的点选按钮重新校准。'
  }));

  const toolbarItems = [];

  const btnRefresh = document.createElement('button');
  btnRefresh.className = 'btn ghost';
  btnRefresh.textContent = '刷新规则';
  btnRefresh.addEventListener('click', () => refreshList(root));

  const btnSave = document.createElement('button');
  btnSave.className = 'btn primary';
  btnSave.textContent = '保存';
  btnSave.disabled = !_draft;
  btnSave.addEventListener('click', async () => {
    if (!_draft) return;
    setMsg(root, '保存中...');
    try {
      const r = await saveDraftTemplate(root, state, '已保存校准结果。之后采集会使用这份规则。');
      if (!r?.ok) setMsg(root, `保存失败：${r?.error || 'unknown error'}`);
    } catch (e) {
      setMsg(root, `保存异常：${e?.message || String(e)}`);
    }
  });

  const btnClone = document.createElement('button');
  btnClone.className = 'btn ghost';
  btnClone.textContent = '复制一份规则';
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
  btnSuggestCard.className = 'btn ghost';
  btnSuggestCard.textContent = '自动识别笔记卡片';
  btnSuggestCard.disabled = !_draft;
  btnSuggestCard.addEventListener('click', async () => {
    if (_busy) return;
    if (!_draft) return;
    _busy = true;
    setMsg(root, '正在识别笔记卡片位置...（请确保右侧已打开「笔记数据」tab，并能看到多条笔记卡片）');
    try {
      const r = await window.desktopAPI.pgy.suggestNoteCardSelector();
      if (!r?.ok) {
      setMsg(root, `识别失败：${r?.error || 'unknown error'}\n排查信息：${r?.anchors ?? ''}`);
        return;
      }
      _draft.noteCardSelector = r.noteCardSelector || null;
      setMsg(root, `已记住笔记卡片位置。\n可信度：${r.confidence || ''}\n参考信息：${r.anchors || ''}\n识别到的卡片数：${r.cardCount || ''}\n\n建议继续点击「测试当前达人页」确认能读到笔记。`);
      // 触发重新渲染（让输入框显示最新值）
      store.set({ templates: { ...store.state.templates } });
    } catch (e) {
      setMsg(root, `推断异常：${e?.message || String(e)}`);
    } finally {
      _busy = false;
    }
  });

  const btnTestMulti = document.createElement('button');
  btnTestMulti.className = 'btn ghost';
  btnTestMulti.textContent = '测试当前达人页';
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
        setMsg(root, `测试失败：${r?.error || 'unknown error'}\n运行编号：${r?.runId || ''}\n结果目录：${r?.runDir || ''}`);
        return;
      }
      const preview = r?.preview || {};
      const debug = r?.debug || {};
      const lines = [];
      lines.push('提取完成（多页合并）。');
      lines.push(`结果文件: ${r.jsonPath}`);
      lines.push(`截图证据: ${r.evidenceDir}`);
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

  const btnInspectCandidateLayout = document.createElement('button');
  btnInspectCandidateLayout.className = 'btn ghost';
  btnInspectCandidateLayout.textContent = '验证搜索结果校准';
  btnInspectCandidateLayout.disabled = !_draft || !(_activePath || state.templates.activeTemplatePath);
  btnInspectCandidateLayout.addEventListener('click', async () => {
    if (_busy) return;
    _busy = true;
    try {
      await inspectCandidateSearchLayout(root, state);
    } catch (error) {
      setMsg(root, `搜索结果布局检查异常：${error?.message || String(error)}`);
    } finally {
      _busy = false;
    }
  });

  const pickField = async (field) => {
    const { label } = field;
    if (!_draft) {
      setMsg(root, '请先刷新并加载一份默认规则。');
      return { ok: false, error: '没有可保存的规则' };
    }
    if (_busy) return { ok: false, error: '正在执行其他校准操作' };
    _busy = true;
    setMsg(root, `右侧网页已进入标注模式。移动鼠标到“${label}”所在区域，蓝框会跟随当前区域；点击保存，Esc 取消。`);
    try {
      const r = await window.desktopAPI.pgy.pickElement({ fieldKey: field.key, label });
      if (r?.canceled) {
        setMsg(root, '已取消点选。');
        return { ok: false, canceled: true };
      }
      if (!r?.ok) {
        setMsg(root, `点选失败：${r?.error || 'unknown error'}`);
        return r;
      }
      const saved = await saveAnnotationResult(root, state, field, r);
      return saved?.ok ? { ...r, saved: true } : saved;
    } catch (e) {
      setMsg(root, `点选异常：${e?.message || String(e)}`);
      return { ok: false, error: e?.message || String(e) };
    } finally {
      _busy = false;
    }
  };

  const scanCurrentPage = async (field) => {
    if (!_draft) {
      setMsg(root, '请先刷新并加载一份默认规则。');
      return;
    }
    if (_busy) return;
    _busy = true;
    _scanCandidates = [];
    _scanFieldKey = field.key;
    setMsg(root, `正在扫描右侧网页，寻找“${field.label}”可能所在的页面块...`);
    try {
      const r = await window.desktopAPI.pgy.scanPageBlocks({ fieldKey: field.key, label: field.label });
      if (!r?.ok) {
        setMsg(root, `扫描失败：${r?.error || 'unknown error'}`);
        return;
      }
      _scanCandidates = Array.isArray(r.candidates) ? r.candidates : [];
      setMsg(root, _scanCandidates.length
        ? `右侧已标出 ${_scanCandidates.length} 个候选块。请从下方列表选择最准确的一个保存。`
        : '没有扫描到足够像的页面块。可以换到更典型的达人页，或使用“手动精确点选”。');
      store.set({ templates: { ...store.state.templates } });
    } catch (e) {
      setMsg(root, `扫描异常：${e?.message || String(e)}`);
    } finally {
      _busy = false;
    }
  };

  const annotateCurrentPage = async (field) => {
    if (!_draft) {
      setMsg(root, '请先刷新并加载一份默认规则。');
      return;
    }
    if (_busy) return;
    _busy = true;
    _scanCandidates = [];
    _scanFieldKey = '';
    setMsg(root, `右侧网页已进入标注模式。移动鼠标到“${field.label}”所在区域，蓝框只会跟随当前区域；点击保存，Esc 取消。`);
    try {
      const r = await window.desktopAPI.pgy.pickElement({
        fieldKey: field.key,
        label: field.label,
        timeoutMs: 60000
      });
      if (r?.canceled) {
        setMsg(root, '已取消网页标注。');
        return;
      }
      if (!r?.ok) {
        setMsg(root, `网页标注失败：${r?.error || 'unknown error'}\n如果页面元素太细碎，可以点“只看候选列表”让系统先标出可能区域。`);
        return;
      }
      await saveAnnotationResult(root, state, field, r, '网页标注');
    } catch (e) {
      setMsg(root, `网页标注异常：${e?.message || String(e)}`);
    } finally {
      _busy = false;
    }
  };

  toolbarItems.push(btnRefresh, btnInspectCandidateLayout, btnSuggestCard, btnTestMulti);
  const toolbar = createActionRow(toolbarItems);
  toolbar.classList.add('rule-quick-actions');

  const msg = document.createElement('div');
  msg.dataset.role = 'msg';
  msg.style.margin = '10px 0 12px 0';
  msg.style.fontSize = '13px';
  msg.style.whiteSpace = 'pre-wrap';
  msg.style.color = 'var(--text)';
  msg.textContent = _msg || '';
  root.appendChild(msg);

  const files = state.templates.templates || [];
  const activeFile = files.find((x) => x.path === (state.templates.activeTemplatePath || _activePath));
  const summary = document.createElement('div');
  summary.className = 'rule-summary-card';
  const savedCandidateSelectors = _draft?.candidate_search || {};
  const savedCandidateCount = CANDIDATE_CALIBRATION_STEPS.filter((step) => (
    Boolean(String(savedCandidateSelectors?.[step.selectorKey] || '').trim())
  )).length;
  const ruleStatus = !_draft
    ? '未加载'
    : savedCandidateCount === 0
      ? '未校准'
      : savedCandidateCount < CANDIDATE_CALIBRATION_STEPS.length
        ? `校准中 ${savedCandidateCount}/3`
        : (_candidatePaginationResult?.passed
          ? '跨页可用'
          : (_candidateCalibrationResult?.passed ? '本页已验证' : '待验证'));
  summary.innerHTML = `
    <div>
      <div class="rule-summary-title">当前校准记录</div>
      <div class="rule-summary-name">${activeFile ? (activeFile.name || '默认规则') : '尚未选择规则'}</div>
      <div class="rule-summary-meta">${activeFile ? `更新时间：${fmtTime(activeFile.mtime)}` : '点击“刷新规则”后会自动加载默认规则'}</div>
    </div>
    <div class="rule-summary-status">${ruleStatus}</div>
  `;
  root.appendChild(summary);

  const candidateWizard = document.createElement('section');
  candidateWizard.className = 'candidate-calibration-panel';
  const candidateWizardHead = document.createElement('div');
  candidateWizardHead.className = 'candidate-calibration-head';
  const candidateWizardCopy = document.createElement('div');
  const candidateWizardTitle = document.createElement('h3');
  candidateWizardTitle.textContent = '搜索结果校准';
  const candidateWizardSubtitle = document.createElement('p');
  candidateWizardSubtitle.textContent = '只标三个结构一次，系统会自动展开本页全部达人并按页累计排名。';
  candidateWizardCopy.appendChild(candidateWizardTitle);
  candidateWizardCopy.appendChild(candidateWizardSubtitle);
  const startCalibrationBtn = document.createElement('button');
  startCalibrationBtn.className = 'btn primary';
  const calibratedSelectors = _draft?.candidate_search || {};
  const completedCalibrationSteps = CANDIDATE_CALIBRATION_STEPS.filter((step) => (
    Boolean(String(calibratedSelectors?.[step.selectorKey] || '').trim())
  ));
  startCalibrationBtn.textContent = completedCalibrationSteps.length ? '重新校准' : '开始校准';
  startCalibrationBtn.disabled = !_draft;
  startCalibrationBtn.addEventListener('click', async () => {
    const returned = await window.desktopAPI.browser.returnToCollectionResults();
    if (!returned?.ok) {
      setMsg(root, `无法开始校准：${returned?.error || '请先结束正在运行的任务'}`);
      return;
    }
    if (returned.warning) setMsg(root, returned.warning);
    _candidateCalibrationStarted = true;
    _candidateCalibrationStep = CANDIDATE_CALIBRATION_STEPS.find((step) => (
      !String(_draft?.candidate_search?.[step.selectorKey] || '').trim()
    ))?.key || 'candidate_row';
    _candidateCalibrationResult = null;
    _candidatePaginationResult = null;
    store.set({ templates: { ...store.state.templates } });
  });
  const returnToResultsBtn = document.createElement('button');
  returnToResultsBtn.className = 'btn ghost';
  returnToResultsBtn.textContent = '返回筛选结果';
  returnToResultsBtn.addEventListener('click', async () => {
    const result = await window.desktopAPI.browser.returnToCollectionResults();
    if (!result?.ok) return setMsg(root, `返回筛选结果失败：${result?.error || 'unknown error'}`);
    setMsg(root, result.warning || '右侧已回到最近的蒲公英筛选结果页，可以开始校准。');
  });
  const candidateWizardActions = document.createElement('div');
  candidateWizardActions.className = 'candidate-calibration-head-actions';
  candidateWizardActions.appendChild(returnToResultsBtn);
  candidateWizardActions.appendChild(startCalibrationBtn);
  candidateWizardHead.appendChild(candidateWizardCopy);
  candidateWizardHead.appendChild(candidateWizardActions);
  candidateWizard.appendChild(candidateWizardHead);

  const currentCalibrationStep = CANDIDATE_CALIBRATION_STEPS.find((step) => step.key === _candidateCalibrationStep);
  const nextAction = document.createElement('div');
  nextAction.className = 'candidate-calibration-next';
  const nextActionLabel = document.createElement('b');
  nextActionLabel.textContent = '当前下一步';
  const nextActionText = document.createElement('span');
  nextActionText.textContent = !_candidateCalibrationStarted
    ? '先确认右侧是蒲公英筛选结果页，再点击“开始校准”。'
    : completedCalibrationSteps.length === CANDIDATE_CALIBRATION_STEPS.length
      ? '三项位置已保存。先验证本页，再验证跨页；两项都通过才用于前 50 位采集。'
      : `${currentCalibrationStep?.title || '继续校准'}：${currentCalibrationStep?.action || '按当前高亮步骤操作'}`;
  nextAction.appendChild(nextActionLabel);
  nextAction.appendChild(nextActionText);
  candidateWizard.appendChild(nextAction);

  const candidateStepList = document.createElement('div');
  candidateStepList.className = 'candidate-calibration-steps';
  CANDIDATE_CALIBRATION_STEPS.forEach((step, index) => {
    const field = ANNOTATION_FIELDS.find((item) => item.key === step.key);
    const isSaved = Boolean(String(calibratedSelectors?.[step.selectorKey] || '').trim());
    const isCurrent = _candidateCalibrationStarted && _candidateCalibrationStep === step.key;
    const row = document.createElement('div');
    row.className = `candidate-calibration-step${isCurrent ? ' current' : ''}${isSaved ? ' done' : ''}`;
    const number = document.createElement('span');
    number.className = 'candidate-calibration-number';
    number.textContent = isSaved ? 'OK' : String(index + 1);
    const copy = document.createElement('div');
    copy.className = 'candidate-calibration-copy';
    const title = document.createElement('b');
    title.textContent = step.title;
    const action = document.createElement('span');
    action.textContent = step.action;
    const description = document.createElement('small');
    description.textContent = step.description;
    copy.appendChild(title);
    copy.appendChild(action);
    copy.appendChild(description);
    const button = document.createElement('button');
    button.className = isCurrent ? 'btn primary' : 'btn ghost';
    button.textContent = step.key === 'candidate_pagination'
      ? (isSaved ? '重新定位' : '自动定位')
      : (isSaved ? '重新标定' : '开始这一步');
    button.disabled = !_draft || !_candidateCalibrationStarted;
    button.addEventListener('click', async () => {
      if (_busy) return;
      _candidateCalibrationStep = step.key;
      _candidateCalibrationResult = null;
      _candidatePaginationResult = null;
      let result = null;
      if (step.key === 'candidate_pagination') {
        const templatePath = _activePath || state.templates.activeTemplatePath;
        if (!templatePath) return;
        _busy = true;
        setMsg(root, '正在自动定位右侧蒲公英分页区域...');
        try {
          const inspected = await window.desktopAPI.pgy.inspectCandidateSearchLayout(templatePath);
          const selector = String(inspected?.pagination?.selector || '').trim();
          if (!inspected?.ok || !selector) {
            setMsg(root, `自动定位分页失败：${inspected?.error || inspected?.pagination?.error || '未找到完整分页栏'}`);
            return;
          }
          const saved = await saveAnnotationResult(root, state, field, {
            ok: true,
            selector,
            count: Number(inspected?.pagination?.controlCount || 0),
            text: Array.isArray(inspected?.pagination?.pageNumbers)
              ? `页码 ${inspected.pagination.pageNumbers.join('、')}`
              : '分页区域'
          }, '自动定位');
          result = saved?.ok ? { ok: true, selector } : saved;
        } catch (error) {
          setMsg(root, `自动定位分页异常：${error?.message || String(error)}`);
          return;
        } finally {
          _busy = false;
        }
      } else {
        result = await pickField(field);
      }
      if (!result?.ok) return;
      const next = CANDIDATE_CALIBRATION_STEPS[index + 1];
      _candidateCalibrationStep = next?.key || step.key;
      if (!next) {
        try {
          _busy = true;
          await inspectCandidateSearchLayout(root, state);
        } catch (error) {
          setMsg(root, `自动验证异常：${error?.message || String(error)}`);
        } finally {
          _busy = false;
        }
      }
      store.set({ templates: { ...store.state.templates } });
    });
    row.appendChild(number);
    row.appendChild(copy);
    row.appendChild(button);
    candidateStepList.appendChild(row);
  });
  candidateWizard.appendChild(candidateStepList);

  const candidateVerifyRow = document.createElement('div');
  candidateVerifyRow.className = 'candidate-calibration-verify';
  const candidateVerifyCopy = document.createElement('div');
  candidateVerifyCopy.textContent = completedCalibrationSteps.length === CANDIDATE_CALIBRATION_STEPS.length
    ? '三项已标定。验证通过后，正式采集才有完整的页面顺序和翻页锚点。'
    : `已完成 ${completedCalibrationSteps.length}/3 项；请按顺序完成后验证。`;
  const verifyCalibrationBtn = document.createElement('button');
  verifyCalibrationBtn.className = 'btn primary';
  verifyCalibrationBtn.textContent = '验证校准';
  verifyCalibrationBtn.disabled = completedCalibrationSteps.length !== CANDIDATE_CALIBRATION_STEPS.length;
  verifyCalibrationBtn.addEventListener('click', async () => {
    const returned = await window.desktopAPI.browser.returnToCollectionResults();
    if (!returned?.ok) return setMsg(root, `无法验证校准：${returned?.error || '请先结束正在运行的任务'}`);
    if (returned.warning) setMsg(root, returned.warning);
    btnInspectCandidateLayout.click();
  });
  const verifyPaginationBtn = document.createElement('button');
  verifyPaginationBtn.className = 'btn ghost';
  verifyPaginationBtn.textContent = '验证跨页';
  verifyPaginationBtn.disabled = completedCalibrationSteps.length !== CANDIDATE_CALIBRATION_STEPS.length;
  verifyPaginationBtn.addEventListener('click', async () => {
    if (_busy) return;
    const returned = await window.desktopAPI.browser.returnToCollectionResults();
    if (!returned?.ok) return setMsg(root, `无法验证跨页：${returned?.error || '请先结束正在运行的任务'}`);
    const templatePath = _activePath || state.templates.activeTemplatePath;
    if (!templatePath) return;
    _busy = true;
    setMsg(root, '正在验证跨页：将短暂进入第 2 页，核对名单变化后自动返回第 1 页...');
    try {
      const result = await window.desktopAPI.pgy.validateCandidateSearchPagination(templatePath);
      _candidatePaginationResult = result || null;
      if (!result?.ok) {
        setMsg(root, `跨页验证失败：${result?.error || 'unknown error'}`);
      } else {
        setMsg(root, [
          '跨页验证通过，已自动返回第 1 页。',
          `第 1 页 ${result.firstPageCount} 位；第 2 页 ${result.secondPageCount} 位。`,
          `第 1 页样例：${(result.firstNames || []).join(' → ')}`,
          `第 2 页样例：${(result.secondNames || []).join(' → ')}`,
          '现在可以执行“前 50 位”；程序会逐页核验、去重，并在第 40 位安全边界暂停。'
        ].join('\n'));
      }
      store.set({ templates: { ...store.state.templates } });
    } catch (error) {
      setMsg(root, `跨页验证异常：${error?.message || String(error)}`);
    } finally {
      _busy = false;
    }
  });
  candidateVerifyRow.appendChild(candidateVerifyCopy);
  candidateVerifyRow.appendChild(verifyCalibrationBtn);
  candidateVerifyRow.appendChild(verifyPaginationBtn);
  candidateWizard.appendChild(candidateVerifyRow);

  if (_candidateCalibrationResult?.ok) {
    const result = _candidateCalibrationResult;
    const page = result.pagination || {};
    const passed = isCandidateCalibrationPassed(result);
    const resultPanel = document.createElement('div');
    resultPanel.className = `candidate-calibration-result ${passed ? 'ok' : 'bad'}`;
    resultPanel.textContent = passed
      ? `验证通过：第 ${page.currentPage || '?'} 页识别 ${result.rowCount} 位达人，昵称顺序和分页区均可核验。`
      : `验证未通过：${Array.isArray(result.warnings) && result.warnings.length
        ? result.warnings.join('；')
        : `达人行 ${result.rowCount || 0}、昵称 ${result.nameCount || 0}、当前页${page.currentPageKnown ? '已确认' : '未确认'}`}。请重做对应步骤。`;
    candidateWizard.appendChild(resultPanel);
  }

  const rangeStrategy = document.createElement('div');
  rangeStrategy.className = 'candidate-range-strategy';
  rangeStrategy.innerHTML = '<b>“前 50 位”执行规则</b><span>从第 1 页按昵称顺序读取并去重，逐页核验后累计；到第 40 位安全暂停 90 秒，人工继续后读取第 41-50 位。任何一页的页码或昵称顺序无法核验，整批不加入候选。</span>';
  candidateWizard.appendChild(rangeStrategy);
  root.appendChild(candidateWizard);

  const pickerPanel = createAdvancedSection({
    title: '详情页字段和高级点选',
    open: _pickerOpen,
    onToggle: (open) => { _pickerOpen = open; },
    children: []
  });
  pickerPanel.classList.add('picker-section');
  const pickerIntro = document.createElement('div');
  pickerIntro.className = 'muted-line';
  pickerIntro.textContent = '这里用于补救达人详情、粉丝数、笔记卡片等字段；搜索结果排名请使用上方三步校准。';

  const annotationSteps = document.createElement('div');
  annotationSteps.className = 'annotation-steps';
  annotationSteps.appendChild(createStepCard({
    index: '1',
    title: '打开对应页面',
    description: '候选问题停在搜索结果页；详情字段问题停在真实达人页。'
  }));
  annotationSteps.appendChild(createStepCard({
    index: '2',
    title: '选择要教的内容',
    description: '例如搜索结果达人行、达人昵称、分页区域或详情字段。'
  }));
  annotationSteps.appendChild(createStepCard({
    index: '3',
    title: '移动鼠标并点击',
    description: '蓝框跟随当前区域，点中后系统会保存位置。'
  }));

  const annotationRow = document.createElement('div');
  annotationRow.className = 'annotation-row';
  const annotationSelect = document.createElement('select');
  annotationSelect.className = 'tpl-input';
  ANNOTATION_FIELDS.forEach((field) => {
    const opt = document.createElement('option');
    opt.value = field.key;
    opt.textContent = field.label;
    if (_annotationField === field.key) opt.selected = true;
    annotationSelect.appendChild(opt);
  });
  annotationSelect.addEventListener('change', () => {
    _annotationField = annotationSelect.value;
    _scanCandidates = [];
    _scanFieldKey = '';
  });
  const annotateBtn = document.createElement('button');
  annotateBtn.className = 'btn ghost';
  annotateBtn.textContent = '快速点选';
  annotateBtn.disabled = !_draft;
  annotateBtn.addEventListener('click', () => {
    const field = ANNOTATION_FIELDS.find((x) => x.key === _annotationField) || ANNOTATION_FIELDS[0];
    pickField(field);
  });
  const scanBtn = document.createElement('button');
  scanBtn.className = 'btn primary';
  scanBtn.textContent = '进入网页标注';
  scanBtn.disabled = !_draft;
  scanBtn.addEventListener('click', () => {
    const field = ANNOTATION_FIELDS.find((x) => x.key === _annotationField) || ANNOTATION_FIELDS[0];
    annotateCurrentPage(field);
  });
  const listScanBtn = document.createElement('button');
  listScanBtn.className = 'btn ghost';
  listScanBtn.textContent = '只看候选列表';
  listScanBtn.disabled = !_draft;
  listScanBtn.addEventListener('click', () => {
    const field = ANNOTATION_FIELDS.find((x) => x.key === _annotationField) || ANNOTATION_FIELDS[0];
    scanCurrentPage(field);
  });
  annotationRow.appendChild(annotationSelect);
  annotationRow.appendChild(scanBtn);
  annotationRow.appendChild(listScanBtn);
  annotationRow.appendChild(annotateBtn);

  const scanPanel = document.createElement('div');
  scanPanel.className = 'annotation-scan-panel';
  if (_scanCandidates.length) {
    const activeScanField = ANNOTATION_FIELDS.find((x) => x.key === _scanFieldKey) || ANNOTATION_FIELDS[0];
    const scanHead = document.createElement('div');
    scanHead.className = 'annotation-scan-head';
    scanHead.innerHTML = `
        <div>
          <div class="annotation-scan-title">候选页面块</div>
        <div class="annotation-scan-subtitle">这是备用方式：右侧蓝色编号与下方列表对应。正常建议用“进入网页标注”，让蓝框跟随鼠标点击保存。</div>
        </div>
    `;
    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn ghost';
    clearBtn.textContent = '清除标记';
    clearBtn.addEventListener('click', async () => {
      _scanCandidates = [];
      _scanFieldKey = '';
      try { await window.desktopAPI.pgy.clearPageBlockHints(); } catch (_) {}
      store.set({ templates: { ...store.state.templates } });
    });
    scanHead.appendChild(clearBtn);
    scanPanel.appendChild(scanHead);
    const list = document.createElement('div');
    list.className = 'annotation-candidate-list';
    _scanCandidates.forEach((candidate, index) => {
      const item = document.createElement('div');
      item.className = 'annotation-candidate-item';
      const info = document.createElement('div');
      info.className = 'annotation-candidate-info';
      const badge = document.createElement('span');
      badge.className = 'annotation-candidate-badge';
      badge.textContent = String(index + 1);
      const textWrap = document.createElement('span');
      const title = document.createElement('b');
      title.textContent = candidatePreviewText(candidate);
      const meta = document.createElement('small');
      const repeated = candidate.repeatCount
        ? ` · 重复位置 ${candidate.repeatCount}`
        : ` · 相似位置 ${candidate.count || 0}`;
      meta.textContent = `${candidate.tag || 'block'}${repeated} · 可信度 ${Math.round(candidate.score || 0)}`;
      textWrap.appendChild(title);
      textWrap.appendChild(meta);
      info.appendChild(badge);
      info.appendChild(textWrap);
      const useBtn = document.createElement('button');
      useBtn.className = 'btn primary';
      useBtn.textContent = '使用这个';
      useBtn.addEventListener('click', async () => {
        if (_busy) return;
        _busy = true;
        try {
          await saveAnnotationResult(root, state, activeScanField, candidate, `候选 ${index + 1}`);
          try { await window.desktopAPI.pgy.clearPageBlockHints(); } catch (_) {}
          _scanCandidates = [];
          _scanFieldKey = '';
        } catch (e) {
          setMsg(root, `保存候选异常：${e?.message || String(e)}`);
        } finally {
          _busy = false;
        }
      });
      item.appendChild(info);
      item.appendChild(useBtn);
      list.appendChild(item);
    });
    scanPanel.appendChild(list);
  }

  const pickerGrid = document.createElement('div');
  pickerGrid.className = 'picker-grid';
  ANNOTATION_FIELDS.forEach((field) => {
    const btn = document.createElement('button');
    btn.className = field.key === 'candidate_row' ? 'btn primary' : 'btn ghost';
    btn.textContent = `标注${field.label}`;
    btn.disabled = !_draft;
    btn.addEventListener('click', () => pickField(field));
    pickerGrid.appendChild(btn);
  });
  const fallbackHint = document.createElement('div');
  fallbackHint.className = 'muted-line';
  fallbackHint.textContent = '这里保留逐项点选按钮，适合一个字段一个字段补救。一般直接用上方“进入网页标注”即可。';
  const fallbackPickers = createAdvancedSection({
    title: '其他方式：逐项手动点选',
    open: false,
    children: [fallbackHint, pickerGrid]
  });
  fallbackPickers.classList.add('annotation-fallback');
  pickerPanel.appendChild(pickerIntro);
  pickerPanel.appendChild(annotationSteps);
  pickerPanel.appendChild(annotationRow);
  if (_scanCandidates.length) pickerPanel.appendChild(scanPanel);
  pickerPanel.appendChild(fallbackPickers);
  root.appendChild(pickerPanel);

  root.appendChild(toolbar);

  const advancedToolbar = document.createElement('div');
  advancedToolbar.className = 'tool-strip compact';
  advancedToolbar.appendChild(btnSave);
  advancedToolbar.appendChild(btnClone);

  // 主体区域：左列表 + 右编辑器
  const layout = document.createElement('div');
  layout.style.display = 'grid';
  layout.className = 'template-layout';
  layout.style.gridTemplateColumns = '';
  layout.style.gap = '12px';
  layout.style.alignItems = 'start';

  const left = document.createElement('div');
  left.className = 'template-side-card';

  const right = document.createElement('div');
  right.className = 'template-editor-card';

  const listTitle = document.createElement('div');
  listTitle.textContent = '校准记录';
  listTitle.style.fontWeight = '700';
  listTitle.style.marginBottom = '8px';
  left.appendChild(listTitle);

  const select = document.createElement('select');
  select.size = 12;
  select.style.width = '100%';
  select.style.background = '#fff';
  select.style.color = 'var(--text)';
  select.style.border = '1px solid var(--line)';
  select.style.borderRadius = '10px';
  select.style.padding = '6px';

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
  fileHint.style.color = 'var(--muted)';
  fileHint.textContent = activeFile ? `更新时间：${fmtTime(activeFile.mtime)}` : '选择左侧记录后即可编辑';
  left.appendChild(fileHint);

  // 右侧：编辑器
  const editorTitle = document.createElement('div');
  editorTitle.textContent = '维护编辑';
  editorTitle.style.fontWeight = '700';
  editorTitle.style.marginBottom = '10px';
  right.appendChild(editorTitle);

  if (!_draft) {
    const empty = document.createElement('div');
    empty.style.color = 'var(--muted)';
    empty.style.fontSize = '13px';
    empty.textContent = files.length ? '请从左侧选择一份校准记录加载。' : '当前没有采集校准记录。点击“刷新规则”试试。';
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
      l.style.color = 'var(--muted)';
      metaGrid.appendChild(l);
      metaGrid.appendChild(inputEl);
    };

    addMetaRow(
      '规则版本',
      buildInput(_draft.version || '', (v) => {
        _draft.version = v;
      }, '例如 pgy_v1_default')
    );
    addMetaRow(
      '平台',
      buildInput(_draft.platform || '', (v) => {
        _draft.platform = v;
      }, '例如 pgy')
    );
    addMetaRow(
      '采集方式',
      buildInput(_draft.mode || '', (v) => {
        _draft.mode = v;
      }, '例如 safe_dom')
    );

    addMetaRow(
      '笔记卡片位置',
      buildInput(_draft.noteCardSelector ?? '', (v) => {
        const s = String(v ?? '').trim();
        _draft.noteCardSelector = s ? s : null;
      }, '系统会自动填写')
    );

    addMetaRow(
      '页面栏目',
      buildInput(Array.isArray(_draft.tabTexts) ? _draft.tabTexts.join(',') : '', (v) => {
        const parts = String(v ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        _draft.tabTexts = parts;
      }, '例如 数据概览,笔记数据,粉丝分析')
    );

    right.appendChild(metaGrid);
    right.appendChild(renderFieldTable(root, '达人信息', 'creator_summary'));
    right.appendChild(renderFieldTable(root, '笔记明细', 'note_detail'));
  }

  layout.appendChild(left);
  layout.appendChild(right);
  const advanced = createAdvancedSection({
    title: '不常用：查看或修改规则文件',
    open: _advancedOpen,
    onToggle: (open) => { _advancedOpen = open; },
    children: [advancedToolbar, layout]
  });
  root.appendChild(advanced);

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
