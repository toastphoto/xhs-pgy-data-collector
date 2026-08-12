import { store } from '../state/store.js';
import { buildCandidateMergePatch } from '../state/candidate_merge.mjs';
import { createAdvancedSection, createStatusPill, createStepCard } from '../ui/components.js';

const PRESETS = [
  { key: 'standard', label: '标准（保守）' },
  { key: 'conservative', label: '更保守（更慢）' }
];

const PGY_DISCOVERY_URL = 'https://pgy.xiaohongshu.com/solar/pre-trade/note/kol';
const SAFE_BATCH_LIMIT = 50;
const MAX_CANDIDATE_RANK = 100;
const RECOMMENDED_BATCH_TEXT = '建议 10-30 人/批，上限 50 人/批，批次间隔至少 5 分钟';
const CANDIDATE_DRAFT_STORAGE_KEY = 'xhs-pgy:candidate-draft:v1';

const SOURCE_MODE_OPTIONS = [
  ['import', '已有达人表/链接'],
  ['search', '蒲公英搜索发现'],
  ['mixed', '导入 + 搜索']
];

let _draftText = '';
let _draftUrls = [];
let _draftItems = []; // {pgy_url, creator_name}[]
let _candidateQuery = '';
let _candidateStatusFilter = 'all';
let _collectionScope = 'active';
let _latestSegmentUrls = [];
let _presetKey = 'standard';
let _selectedTemplatePath = '';
let _importPreview = null; // {stats, items, filePath} | null
let _signingDataLoaded = false;
let _savedSigningTasks = [];
let _executionRecords = [];
let _selectedSigningTaskId = '';
let _lastPgyLoginCheck = null;
let _lastSearchSnapshot = null;
let _candidateInstruction = '将当前页面前30位达人加入候选';
let _candidateInstructionStatus = '';
let _candidateReadRunning = false;
let _candidateCheckpoint = null;
let _candidateCheckpointTimer = null;
let _autoContactRunDir = '';
const _forwardedContactRuns = new Set();
let _candidateDirty = false;
let _taskSetupOpen = false;
let _searchAdvancedOpen = false;
let _candidateBulkOpen = false;

function persistCandidateDraft() {
  try {
    window.localStorage.setItem(CANDIDATE_DRAFT_STORAGE_KEY, JSON.stringify({
      draftText: _draftText,
      draftUrls: _draftUrls.slice(0, 500),
      draftItems: _draftItems.slice(0, 500),
      latestSegmentUrls: _latestSegmentUrls.slice(0, SAFE_BATCH_LIMIT),
      collectionScope: _collectionScope,
      dirty: Boolean(_candidateDirty)
    }));
  } catch (_) {}
}

function restoreCandidateDraft() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(CANDIDATE_DRAFT_STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return;
    const urls = parseUrls((Array.isArray(saved.draftUrls) ? saved.draftUrls : []).join('\n')).slice(0, 500);
    const urlSet = new Set(urls.map(normalizeDraftUrl));
    _draftUrls = urls;
    _draftItems = (Array.isArray(saved.draftItems) ? saved.draftItems : [])
      .filter((item) => urlSet.has(normalizeDraftUrl(item?.pgy_url)))
      .slice(0, 500);
    _draftText = String(saved.draftText || urls.join('\n'));
    _latestSegmentUrls = parseUrls(
      (Array.isArray(saved.latestSegmentUrls) ? saved.latestSegmentUrls : []).join('\n')
    ).filter((url) => urlSet.has(normalizeDraftUrl(url))).slice(0, SAFE_BATCH_LIMIT);
    _collectionScope = ['latest_segment', 'active', 'selected', 'all'].includes(saved.collectionScope)
      ? saved.collectionScope
      : 'active';
    _candidateDirty = Boolean(saved.dirty && urls.length);
  } catch (_) {}
}

restoreCandidateDraft();
window.addEventListener('beforeunload', persistCandidateDraft);
let _signingTaskDraft = {
  taskName: '',
  sourceMode: 'import',
  note: '',
  channels: { pgy: true, xhs: false },
  contactPlan: { pgyInvite: false, wechat: false, email: false },
  searchCriteria: {
    track: '',
    followersMinWan: '',
    followersMaxWan: '',
    priceMin: '',
    priceMax: '',
    orders90dMin: '',
    readUnitPriceMax: '',
    noteUpdate30dMin: '',
    readMedian90dMin: '',
    interactMedian90dMin: ''
  }
};

const CRITERIA_FIELDS = [
  ['track', '赛道类型', '中外生活'],
  ['followersMinWan', '粉丝量下限(万)', '20'],
  ['followersMaxWan', '粉丝量上限(万)', '30'],
  ['priceMin', '报价下限', '1000'],
  ['priceMax', '报价上限', '30000'],
  ['orders90dMin', '近90天商单数下限', '1'],
  ['readUnitPriceMax', '阅读单价上限', '3'],
  ['noteUpdate30dMin', '近30天笔记更新频次下限', '3'],
  ['readMedian90dMin', '近90天阅读中位数下限', '300'],
  ['interactMedian90dMin', '近90天互动中位数下限', '100']
];

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

function addDraftUrls(urls) {
  const normalized = parseUrls((Array.isArray(urls) ? urls : [urls]).filter(Boolean).join('\n'));
  if (!normalized.length) return 0;
  const before = _draftUrls.length;
  _draftUrls = parseUrls([..._draftUrls, ...normalized].join('\n'));
  _draftText = _draftUrls.join('\n');
  const added = _draftUrls.length - before;
  if (added) _candidateDirty = true;
  if (added) persistCandidateDraft();
  return added;
}

function normalizeDraftUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function syncDraftText() {
  _draftText = _draftUrls.join('\n');
  persistCandidateDraft();
}

function getDraftItem(url) {
  const normalized = normalizeDraftUrl(url);
  return _draftItems.find((item) => normalizeDraftUrl(item?.pgy_url) === normalized) || null;
}

function setDraftItemLabel(url, label) {
  const normalized = normalizeDraftUrl(url);
  if (!normalized) return;
  let item = getDraftItem(normalized);
  if (!item) {
    item = { pgy_url: normalized, creator_name: '' };
    _draftItems.push(item);
  }
  item.pgy_url = normalized;
  item.creator_name = String(label || '').trim();
  _candidateDirty = true;
  persistCandidateDraft();
}

function updateDraftItem(url, patch = {}) {
  const normalized = normalizeDraftUrl(url);
  if (!normalized) return;
  let item = getDraftItem(normalized);
  if (!item) {
    item = { pgy_url: normalized, creator_name: '' };
    _draftItems.push(item);
  }
  item.pgy_url = normalized;
  if (Object.prototype.hasOwnProperty.call(patch, 'creator_name')) item.creator_name = String(patch.creator_name || '').trim();
  if (Object.prototype.hasOwnProperty.call(patch, 'note')) item.note = String(patch.note || '').trim();
  if (Object.prototype.hasOwnProperty.call(patch, 'priority')) item.priority = String(patch.priority || '').trim();
  if (Object.prototype.hasOwnProperty.call(patch, 'excludeReason')) item.excludeReason = String(patch.excludeReason || '').trim();
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    const status = String(patch.status || '').trim();
    item.status = ['selected', 'excluded'].includes(status) ? status : 'candidate';
  }
  _candidateDirty = true;
  persistCandidateDraft();
}

function removeDraftUrl(url) {
  const normalized = normalizeDraftUrl(url);
  _draftUrls = _draftUrls.filter((u) => normalizeDraftUrl(u) !== normalized);
  _draftItems = _draftItems.filter((item) => normalizeDraftUrl(item?.pgy_url) !== normalized);
  syncDraftText();
  _candidateDirty = true;
}

function getFilteredDraftUrls() {
  const query = String(_candidateQuery || '').trim().toLowerCase();
  const statusFilter = String(_candidateStatusFilter || 'all');
  return _draftUrls.filter((url) => {
    const item = getDraftItem(url);
    const status = String(item?.status || 'candidate').trim() || 'candidate';
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    if (!query) return true;
    const hay = [url, item?.creator_name, item?.note, item?.priority, item?.excludeReason, item?.status].map((x) => String(x || '').toLowerCase()).join(' ');
    return hay.includes(query);
  });
}

function markDraftUrls(urls, patch = {}) {
  const list = Array.isArray(urls) ? urls : [];
  list.forEach((url) => updateDraftItem(url, patch));
}

function firstNonEmptyCandidateField(item, keys) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(item || {}, key)) continue;
    const value = String(item?.[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function normalizeImportedCandidateItem(item) {
  const creatorName = firstNonEmptyCandidateField(item, ['creator_name', 'creatorName', 'name']);
  const note = firstNonEmptyCandidateField(item, ['note']);
  const priority = firstNonEmptyCandidateField(item, ['priority']);
  const excludeReason = firstNonEmptyCandidateField(item, ['excludeReason', 'exclude_reason']);
  const rawStatus = firstNonEmptyCandidateField(item, ['status']);
  const status = ['candidate', 'selected', 'excluded'].includes(rawStatus) ? rawStatus : '';
  return {
    record: {
      pgy_url: normalizeDraftUrl(item?.pgy_url || item?.url || ''),
      creator_name: creatorName,
      note,
      status: status || 'candidate',
      priority,
      excludeReason
    },
    // Merge only fields the new source actually supplied. Search responses omit
    // review fields, so an existing operator decision cannot be reset by defaults.
    mergePatch: {
      ...(creatorName ? { creator_name: creatorName } : {}),
      ...(note ? { note } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(excludeReason ? { excludeReason } : {})
    }
  };
}

function summarizeSearchFilters(filters) {
  const groups = Array.isArray(filters?.groups) ? filters.groups : [];
  const selected = Array.isArray(filters?.selected) ? filters.selected : [];
  const lines = [];
  if (selected.length) lines.push(`已选：${selected.slice(0, 12).join('、')}`);
  groups.slice(0, 8).forEach((group) => {
    const options = Array.isArray(group?.options) ? group.options : [];
    if (!options.length) return;
    lines.push(`${group.group || '筛选'}：${options.slice(0, 18).join('、')}${options.length > 18 ? ` 等 ${options.length} 项` : ''}`);
  });
  return lines.join('\n');
}

function applyImportedCandidateItems(items, {
  merge = false,
  preserveManualReview = false
} = {}) {
  const imported = (Array.isArray(items) ? items : [])
    .map(normalizeImportedCandidateItem)
    .filter((item) => item.record.pgy_url);
  if (!merge) {
    _draftUrls = parseUrls(imported.map((x) => x.record.pgy_url).join('\n'));
    _draftItems = imported.map((x) => x.record);
    syncDraftText();
    _candidateDirty = true;
    return { imported: imported.length, added: imported.length, updated: 0 };
  }

  let added = 0;
  let updated = 0;
  imported.forEach((item) => {
    const exists = getDraftItem(item.record.pgy_url);
    if (!exists) {
      added += 1;
      updateDraftItem(item.record.pgy_url, item.record);
      return;
    }
    const changedPatch = buildCandidateMergePatch(exists, item.mergePatch, {
      preserveManualReview
    });
    if (!Object.keys(changedPatch).length) return;
    updated += 1;
    updateDraftItem(item.record.pgy_url, changedPatch);
  });
  _draftUrls = parseUrls([..._draftUrls, ...imported.map((x) => x.record.pgy_url)].join('\n'));
  syncDraftText();
  if (added || updated) _candidateDirty = true;
  persistCandidateDraft();
  return { imported: imported.length, added, updated };
}

function stopCandidateCheckpointTimer() {
  if (_candidateCheckpointTimer) window.clearInterval(_candidateCheckpointTimer);
  _candidateCheckpointTimer = null;
}

function candidateCheckpointCountdown() {
  if (!_candidateCheckpoint) return '';
  const remainingSeconds = Math.max(
    0,
    Math.ceil((Number(_candidateCheckpoint.readyAt || 0) - Date.now()) / 1000)
  );
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = String(remainingSeconds % 60).padStart(2, '0');
  return remainingSeconds > 0 ? `${minutes}:${seconds}` : '可继续';
}

function startCandidateCheckpointTimer() {
  stopCandidateCheckpointTimer();
  _candidateCheckpointTimer = window.setInterval(() => {
    if (!_candidateCheckpoint) {
      stopCandidateCheckpointTimer();
      return;
    }
    store.set({ tasks: { ...store.state.tasks } });
  }, 1000);
}

function setCandidateCheckpoint(command, result) {
  _candidateCheckpoint = {
    ...(result?.checkpoint || {}),
    command
  };
  _candidateInstructionStatus = result?.message
    || `已定位到第 ${_candidateCheckpoint.rank} 位，安全暂停后继续。`;
  startCandidateCheckpointTimer();
}

function completeCandidateSearchRead(command, result) {
  const items = (Array.isArray(result.items) ? result.items : []).slice(0, command.requestedCount);
  const mergeResult = applyImportedCandidateItems(items, {
    merge: true,
    preserveManualReview: true
  });
  _latestSegmentUrls = items
    .map((item) => normalizeDraftUrl(item?.pgy_url || item?.url || ''))
    .filter(Boolean)
    .slice(0, SAFE_BATCH_LIMIT);
  if (_latestSegmentUrls.length) _collectionScope = 'latest_segment';
  persistCandidateDraft();
  const rangeLabel = command.startRank === 1
    ? `前 ${command.endRank} 位`
    : `第 ${command.startRank}-${command.endRank} 位`;
  _lastSearchSnapshot = {
    url: result.url || '',
    filters: result.filters || null,
    stats: result.stats || {},
    capturedAt: Date.now()
  };
  _importPreview = {
    filePath: '当前蒲公英搜索页',
    stats: {
      ...(result.stats || {}),
      mode: 'search-page',
      imported: mergeResult.imported,
      added: mergeResult.added,
      updated: mergeResult.updated,
      filterGroups: Array.isArray(result.filters?.groups) ? result.filters.groups.length : 0
    },
    filters: result.filters || null,
    items: items.slice(0, 10)
  };
  _candidateInstructionStatus = items.length
    ? `已完整读取${rangeLabel}中的 ${items.length} 位；本次采集已切到最近加入的一段`
    : '未读取到达人，请确认右侧停留在蒲公英筛选结果页。';
  const filterText = summarizeSearchFilters(result.filters);
  alert([
    result.message || '读取完成。',
    `指令范围：${rangeLabel}；本次读取 ${items.length} 位，新增 ${mergeResult.added}，更新 ${mergeResult.updated}。`,
    items.length ? '采集范围已自动切换为“最近加入的一段”，开始采集时不会重复带上前一批候选。' : '',
    filterText ? `\n已记录当前筛选结构：\n${filterText.slice(0, 500)}` : ''
  ].filter(Boolean).join('\n'));
}

function handleCandidateSearchResult(command, result) {
  if (!result?.ok) {
    if (result?.code !== 'PGY_CANDIDATE_CHECKPOINT_COOLDOWN') {
      stopCandidateCheckpointTimer();
      _candidateCheckpoint = null;
    }
    _candidateInstructionStatus = result?.error || '读取失败';
    alert(`读取失败：${result?.error || 'unknown error'}`);
    return false;
  }
  if (result.paused && result.checkpoint) {
    setCandidateCheckpoint(command, result);
    return false;
  }
  stopCandidateCheckpointTimer();
  _candidateCheckpoint = null;
  completeCandidateSearchRead(command, result);
  return true;
}

function countDraftItemsWithLabel() {
  return _draftUrls.filter((url) => String(getDraftItem(url)?.creator_name || '').trim()).length;
}

function candidateDecisionStats() {
  return _draftUrls.reduce((acc, url) => {
    const status = String(getDraftItem(url)?.status || 'candidate').trim();
    if (status === 'selected') acc.selected += 1;
    else if (status === 'excluded') acc.excluded += 1;
    else acc.candidate += 1;
    return acc;
  }, { candidate: 0, selected: 0, excluded: 0 });
}

function buildCandidateItems() {
  return _draftUrls.map((url) => {
    const item = getDraftItem(url);
    return {
      pgy_url: normalizeDraftUrl(url),
      creator_name: String(item?.creator_name || '').trim(),
      note: String(item?.note || '').trim(),
      status: ['selected', 'excluded'].includes(String(item?.status || '').trim()) ? String(item.status).trim() : 'candidate',
      priority: String(item?.priority || '').trim(),
      excludeReason: String(item?.excludeReason || '').trim()
    };
  });
}

function getCollectionUrls() {
  const urls = _draftUrls.length ? _draftUrls : parseUrls(_draftText);
  if (!_draftUrls.length) return urls;
  const latestSegment = new Set(_latestSegmentUrls.map(normalizeDraftUrl));
  return urls.filter((url) => {
    const status = String(getDraftItem(url)?.status || 'candidate').trim() || 'candidate';
    if (_collectionScope === 'latest_segment') {
      return latestSegment.has(normalizeDraftUrl(url)) && status !== 'excluded';
    }
    if (_collectionScope === 'selected') return status === 'selected';
    if (_collectionScope === 'all') return true;
    return status !== 'excluded';
  });
}

function collectionScopeLabel() {
  const map = {
    latest_segment: '最近加入的一段',
    active: '优先 + 待复核',
    selected: '只采优先',
    all: '全部候选'
  };
  return map[_collectionScope] || map.active;
}

function looksLikePgyCreatorUrl(url) {
  const text = String(url || '').trim();
  if (!/^https?:\/\/pgy\.xiaohongshu\.com\//i.test(text)) return false;
  return /blogger|kol|creator|note\/kol|pre-trade/i.test(text);
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

function goToExportRun(runDir) {
  if (!runDir) return;
  store.set({
    view: 'exports',
    exports: {
      ...(store.state.exports || {}),
      selectedRunDir: runDir,
      _loadedOnce: false,
      _t: Date.now()
    }
  });
}

function buildSigningTaskPayload() {
  return {
    id: _selectedSigningTaskId || undefined,
    ...JSON.parse(JSON.stringify(_signingTaskDraft)),
    collectionScope: _collectionScope,
    latestSegmentUrls: [..._latestSegmentUrls],
    candidates: buildCandidateItems()
  };
}

function buildCriteriaText() {
  const lines = [];
  CRITERIA_FIELDS.forEach(([key, label]) => {
    const value = String(_signingTaskDraft.searchCriteria?.[key] ?? '').trim();
    if (value) lines.push(`${label}: ${value}`);
  });
  return lines.join('\n');
}

function buildPreRunSummary({ loginCheck } = {}) {
  const criteriaCount = buildCriteriaText().split('\n').filter(Boolean).length;
  const withLabel = countDraftItemsWithLabel();
  const decisionStats = candidateDecisionStats();
  const collectionCount = getCollectionUrls().length;
  const login = loginCheck || _lastPgyLoginCheck;
  const loginText = login
    ? (login.ok ? (login.loggedIn ? '已登录' : '未确认登录') : `检查失败: ${login.error || 'unknown error'}`)
    : '未检查';
  return [
    `任务来源: ${SOURCE_MODE_OPTIONS.find(([value]) => value === (_signingTaskDraft.sourceMode || 'import'))?.[1] || '已有达人表/链接'}`,
    `候选达人: ${_draftUrls.length}`,
    `候选判断: 优先 ${decisionStats.selected} / 排除 ${decisionStats.excluded} / 待复核 ${decisionStats.candidate}`,
    `采集范围: ${collectionScopeLabel()}（${collectionCount} 条）`,
    `已填达人/备注: ${withLabel}/${_draftUrls.length}`,
    `采集模板: ${_selectedTemplatePath ? '已选择' : '未选择'}`,
    `筛选条件: ${criteriaCount ? `${criteriaCount} 项` : '未填写'}`,
    `蒲公英登录态: ${loginText}`,
    `采集模式: ${PRESETS.find((p) => p.key === _presetKey)?.label || _presetKey}`
  ].join('\n');
}

async function runPgyLoginCheck() {
  try {
    const r = await window.desktopAPI.pgy.checkLogin();
    _lastPgyLoginCheck = r || { ok: false, error: 'empty response' };
    return _lastPgyLoginCheck;
  } catch (e) {
    _lastPgyLoginCheck = { ok: false, error: e?.message || String(e) };
    return _lastPgyLoginCheck;
  }
}

function checkbox(label, checked, onChange) {
  const wrap = document.createElement('label');
  wrap.className = 'inline-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(checked);
  input.addEventListener('change', () => onChange(input.checked));
  const span = document.createElement('span');
  span.textContent = label;
  wrap.appendChild(input);
  wrap.appendChild(span);
  return wrap;
}

function applySigningTask(task) {
  if (!task) return;
  _selectedSigningTaskId = String(task.id || '');
  const candidates = Array.isArray(task.candidates) ? task.candidates : [];
  _draftUrls = parseUrls(candidates.map((x) => x?.pgy_url || x?.url || '').filter(Boolean).join('\n'));
  _draftItems = candidates
    .map((x) => ({
      pgy_url: normalizeDraftUrl(x?.pgy_url || x?.url || ''),
      creator_name: String(x?.creator_name || x?.creatorName || x?.name || '').trim(),
      note: String(x?.note || '').trim(),
      status: ['selected', 'excluded'].includes(String(x?.status || '').trim()) ? String(x.status).trim() : 'candidate',
      priority: String(x?.priority || '').trim(),
      excludeReason: String(x?.excludeReason || x?.exclude_reason || '').trim()
    }))
    .filter((x) => x.pgy_url);
  _candidateQuery = '';
  _candidateStatusFilter = 'all';
  _collectionScope = ['latest_segment', 'active', 'selected', 'all'].includes(String(task.collectionScope || ''))
    ? task.collectionScope
    : 'active';
  const candidateUrlSet = new Set(_draftUrls.map(normalizeDraftUrl));
  const savedLatestSegmentUrls = Array.isArray(task.latestSegmentUrls) ? task.latestSegmentUrls : [];
  _latestSegmentUrls = parseUrls(savedLatestSegmentUrls.join('\n'))
    .filter((url) => candidateUrlSet.has(normalizeDraftUrl(url)))
    .slice(0, SAFE_BATCH_LIMIT);
  _importPreview = null;
  _candidateDirty = false;
  syncDraftText();
  _signingTaskDraft = {
    taskName: task.taskName || '',
    sourceMode: ['search', 'mixed'].includes(String(task.sourceMode || '')) ? String(task.sourceMode) : 'import',
    note: task.note || '',
    channels: {
      pgy: task.channels?.pgy !== false,
      xhs: Boolean(task.channels?.xhs)
    },
    contactPlan: {
      pgyInvite: Boolean(task.contactPlan?.pgyInvite),
      wechat: Boolean(task.contactPlan?.wechat),
      email: Boolean(task.contactPlan?.email)
    },
    searchCriteria: {
      ..._signingTaskDraft.searchCriteria,
      ...(task.searchCriteria || {})
    }
  };
}

async function refreshSigningData() {
  try {
    const [tasks, records] = await Promise.all([
      window.desktopAPI.signingTasks.list(),
      window.desktopAPI.signingTasks.executionRecords()
    ]);
    if (tasks?.ok) _savedSigningTasks = tasks.items || [];
    if (records?.ok) _executionRecords = records.records || [];
    _signingDataLoaded = true;
    store.set({ tasks: { ...store.state.tasks } });
  } catch (_) {
    _signingDataLoaded = true;
  }
}

function renderExecutionRecords(root) {
  const label = document.createElement('div');
  label.className = 'section-label';
  label.textContent = '执行记录';
  root.appendChild(label);

  const table = document.createElement('table');
  table.className = 'task-table execution-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 150px;">时间</th>
        <th>任务</th>
        <th style="width: 100px;">队列</th>
        <th style="width: 150px;">结果</th>
        <th style="width: 150px;">质量</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  const records = (_executionRecords || []).slice(0, 8);
  if (!records.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="empty-row">暂无执行记录。保存任务并启动采集后会自动记录。</td>`;
    tbody.appendChild(tr);
  } else {
    records.forEach((record) => {
      const counts = record.taskState?.counts || {};
      const quality = record.qualitySummary || {};
      const result = [
        counts.ok != null ? `成功 ${counts.ok}` : '',
        counts.fail != null ? `失败 ${counts.fail}` : '',
        counts.skipped != null ? `跳过 ${counts.skipped}` : '',
        record.taskState?.running ? '运行中' : ''
      ].filter(Boolean).join(' / ') || '-';
      const qualityText = quality.reportCount
        ? `报告 ${quality.reportCount} / 问题 ${quality.issueCount || 0} / 最低分 ${quality.minScore ?? '-'}`
        : '暂无质量报告';
      const issues = [];
      if (quality.missingFieldCount) issues.push(`缺字段 ${quality.missingFieldCount}`);
      if (quality.failedPageCount) issues.push(`失败页面 ${quality.failedPageCount}`);
      if (quality.warningCount) issues.push(`提示 ${quality.warningCount}`);

      const tr = document.createElement('tr');
      const timeTd = document.createElement('td');
      timeTd.textContent = String(record.createdAt || '').replace('T', ' ').slice(0, 16);

      const taskTd = document.createElement('td');
      taskTd.textContent = record.signingTask?.taskName || '未命名签约任务';
      const runLine = document.createElement('div');
      runLine.className = 'muted-line';
      runLine.textContent = record.runId || '';
      taskTd.appendChild(runLine);
      if (record.runDir) {
        const reviewBtn = document.createElement('button');
        reviewBtn.className = 'mini-link-btn';
        reviewBtn.textContent = '复核导出';
        reviewBtn.addEventListener('click', () => goToExportRun(record.runDir));
        taskTd.appendChild(reviewBtn);

        const openBtn = document.createElement('button');
        openBtn.className = 'mini-link-btn';
        openBtn.textContent = '打开目录';
        openBtn.addEventListener('click', async () => {
          const r = await window.desktopAPI.exports.openPath(record.runDir);
          if (!r?.ok) alert(`打开失败：${r?.error || 'unknown error'}`);
        });
        taskTd.appendChild(openBtn);
      }

      const queueTd = document.createElement('td');
      queueTd.textContent = `${record.queueCount || 0} 条`;

      const resultTd = document.createElement('td');
      resultTd.textContent = result;

      const qualityTd = document.createElement('td');
      qualityTd.textContent = qualityText;
      if (issues.length) {
        const issueLine = document.createElement('div');
        issueLine.className = 'quality-issues';
        issueLine.textContent = issues.join(' / ');
        qualityTd.appendChild(issueLine);
      }

      tr.appendChild(timeTd);
      tr.appendChild(taskTd);
      tr.appendChild(queueTd);
      tr.appendChild(resultTd);
      tr.appendChild(qualityTd);
      tbody.appendChild(tr);

      const worst = Array.isArray(quality.worstReports) ? quality.worstReports.filter((x) => x && x.ok === false) : [];
      if (worst.length) {
        const detailTr = document.createElement('tr');
        const detailTd = document.createElement('td');
        detailTd.colSpan = 5;
        detailTd.className = 'quality-detail-cell';
        const lines = [];
        worst.slice(0, 3).forEach((item, idx) => {
          const fields = Array.isArray(item.missingFields) ? item.missingFields.filter(Boolean).join('、') : '';
          const pages = Array.isArray(item.failedPages) ? item.failedPages.filter(Boolean).join('、') : '';
          lines.push(`${idx + 1}. 分数 ${item.score ?? '-'}；缺字段：${fields || '无'}；失败页面：${pages || '无'}`);
        });
        detailTd.textContent = lines.join('\n');
        detailTr.appendChild(detailTd);
        tbody.appendChild(detailTr);
      }
    });
  }
  root.appendChild(table);
}

export function renderTasks(state) {
  const completedRunDir = String(state.tasks?.runDir || '');
  const completionQueue = Array.isArray(state.tasks?.queue) ? state.tasks.queue : [];
  const queueFinished = completionQueue.length > 0 && completionQueue.every((item) => ['ok', 'fail', 'skipped'].includes(String(item?.status || '')));
  if (
    _autoContactRunDir &&
    completedRunDir === _autoContactRunDir &&
    !state.tasks?.running &&
    state.tasks?.finishReason !== 'stopped_by_user' &&
    queueFinished &&
    !_forwardedContactRuns.has(completedRunDir)
  ) {
    _forwardedContactRuns.add(completedRunDir);
    _autoContactRunDir = '';
    setTimeout(() => {
      store.set({
        view: 'exports',
        exports: {
          ...(store.state.exports || {}),
          selectedRunDir: completedRunDir,
          autoEnrichRunDir: completedRunDir,
          _t: Date.now()
        }
      });
    }, 0);
  }
  if (!_signingDataLoaded && window.desktopAPI?.signingTasks) {
    refreshSigningData();
  }

  const root = document.createElement('div');
  root.className = 'view';

  const runDir = state.tasks?.runDir || '';
  const queue = Array.isArray(state.tasks?.queue) ? state.tasks.queue : [];
  const stats = queueStats(queue);
  const currentIndex = queue.findIndex((item) => item.id === state.tasks?.currentId);
  const processedCount = queue.filter((item) => ['ok', 'fail', 'skipped'].includes(String(item?.status || ''))).length;
  const statusInfo = state.tasks?.running
    ? state.tasks?.stopPending
      ? { label: '正在安全停止', tone: 'warn', detail: '停止请求已收到；当前安全操作结束后不会再处理下一位达人。' }
      : state.tasks?.paused
        ? { label: '已暂停', tone: 'warn', detail: state.tasks?.pauseReason || '任务已经暂停，不会继续访问下一位达人。' }
        : state.tasks?.pausePending
          ? { label: '等待暂停', tone: 'warn', detail: '暂停请求已收到；完成当前达人后进入暂停。' }
          : state.tasks?.skipPending
            ? { label: '正在跳过当前', tone: 'warn', detail: '将在下一个安全点结束当前达人，然后继续队列。' }
            : { label: '采集中', tone: 'live', detail: currentIndex >= 0 ? `正在处理第 ${currentIndex + 1}/${queue.length} 位达人。` : '任务已启动，正在准备下一位达人。' }
    : state.tasks?.finishReason === 'stopped_by_user'
      ? { label: '已停止', tone: 'warn', detail: '整批任务已由用户停止，未执行的达人不会在后台继续。' }
      : state.tasks?.finishReason === 'completed'
        ? { label: '已完成', tone: 'good', detail: `本批次已结束，共处理 ${processedCount}/${queue.length} 位达人。` }
        : { label: '未运行', tone: 'neutral', detail: '尚未启动采集任务。' };

  const hero = document.createElement('section');
  hero.className = 'task-hero';
  const heroMain = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = '找达人';
  const desc = document.createElement('p');
  desc.textContent = '从已有名单导入，或在蒲公英搜索后把合适达人加入候选。确认候选后再开始采集。';
  heroMain.appendChild(title);
  heroMain.appendChild(desc);

  const heroMeta = document.createElement('div');
  heroMeta.className = 'run-meta';
  const statusLine = document.createElement('div');
  statusLine.appendChild(document.createTextNode('当前状态：'));
  statusLine.appendChild(createStatusPill(statusInfo.label, statusInfo.tone));
  heroMeta.appendChild(statusLine);
  const resultLine = document.createElement('div');
  resultLine.title = runDir || '';
  resultLine.innerHTML = `本次结果：<b>${runDir ? '已有结果，可进入复核' : '还没有开始采集'}</b>`;
  heroMeta.appendChild(resultLine);

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

  const btnReturnCollection = document.createElement('button');
  btnReturnCollection.className = 'btn';
  btnReturnCollection.textContent = '返回筛选结果';
  btnReturnCollection.disabled = !!state.tasks?.running;
  btnReturnCollection.title = state.tasks?.running
    ? '采集运行时浏览器标签已锁定，请先暂停后停止或等待完成'
    : '切回固定的蒲公英采集页，保留原筛选条件、页码和滚动位置';
  btnReturnCollection.addEventListener('click', async () => {
    const result = await window.desktopAPI.browser.returnToCollectionResults();
    if (!result?.ok) return alert(`返回筛选结果失败：${result?.error || 'unknown error'}`);
    if (result.warning) alert(result.warning);
  });

  btnRow.appendChild(btnReturnCollection);
  btnRow.appendChild(btnOpenRun);
  btnRow.appendChild(btnOpenRuns);
  if (runDir) {
    const btnReviewExport = document.createElement('button');
    btnReviewExport.className = 'btn primary';
    btnReviewExport.textContent = '去复核建联';
    btnReviewExport.addEventListener('click', () => goToExportRun(runDir));
    btnRow.appendChild(btnReviewExport);
  }
  heroMeta.appendChild(btnRow);
  hero.appendChild(heroMain);
  hero.appendChild(heroMeta);
  root.appendChild(hero);

  const taskStatusPanel = document.createElement('section');
  taskStatusPanel.className = `task-run-status ${statusInfo.tone}`;
  taskStatusPanel.setAttribute('role', 'status');
  taskStatusPanel.setAttribute('aria-live', 'polite');
  const taskStatusCopy = document.createElement('div');
  taskStatusCopy.className = 'task-run-status-copy';
  taskStatusCopy.innerHTML = `<b>${statusInfo.label}</b><span>${statusInfo.detail}</span>`;
  const taskStatusProgress = document.createElement('div');
  taskStatusProgress.className = 'task-run-status-progress';
  taskStatusProgress.textContent = queue.length ? `${processedCount}/${queue.length}` : '0/0';
  taskStatusPanel.appendChild(taskStatusCopy);
  taskStatusPanel.appendChild(taskStatusProgress);
  root.appendChild(taskStatusPanel);

  const decisionStatsForSteps = candidateDecisionStats();
  const collectionCountForSteps = getCollectionUrls().length;
  const steps = document.createElement('div');
  steps.className = 'workflow-steps';
  steps.appendChild(createStepCard({
    index: '1',
    title: '选择来源',
    description: '导入 Excel、粘贴链接，或在蒲公英搜索后加入当前达人。',
    meta: (_signingTaskDraft.sourceMode || 'import') === 'search' ? '当前：蒲公英搜索发现' : '当前：已有名单/链接',
    active: !_draftUrls.length
  }));
  steps.appendChild(createStepCard({
    index: '2',
    title: '整理候选',
    description: '只保留值得采集的人，标优先、待复核或排除。',
    meta: `候选 ${_draftUrls.length}，优先 ${decisionStatsForSteps.selected}，排除 ${decisionStatsForSteps.excluded}`,
    active: _draftUrls.length > 0 && !state.tasks?.running,
    done: collectionCountForSteps > 0
  }));
  steps.appendChild(createStepCard({
    index: '3',
    title: '开始采集',
    description: '确认登录、采集范围和规则状态，然后串行采集。',
    meta: `本次采集 ${collectionCountForSteps} 人`,
    active: collectionCountForSteps > 0 && !state.tasks?.running,
    done: Boolean(runDir)
  }));
  root.appendChild(steps);

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
  btnTplRefresh.textContent = '刷新规则';
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
  const setupDetails = createAdvancedSection({
    title: `采集设置：${templates.length ? '已选择规则' : '未选择规则'} · ${PRESETS.find((p) => p.key === _presetKey)?.label || '标准'}`,
    open: _taskSetupOpen,
    onToggle: (open) => { _taskSetupOpen = open; },
    children: [header]
  });
  setupDetails.classList.add('task-advanced-section');
  root.appendChild(setupDetails);

  if (templates.length === 0) {
  const tip = document.createElement('div');
    tip.className = 'task-note';
    tip.textContent = '还没有可用的采集校准规则。请先到「采集校准」页点选一次，或点击上方“刷新规则”。';
    root.appendChild(tip);
  }

  const signingPanel = document.createElement('div');
  signingPanel.className = 'task-panel signing-panel';

  const signingHead = document.createElement('div');
  signingHead.className = 'panel-title-row';
  const signingTitle = document.createElement('div');
  signingTitle.className = 'section-label compact';
  signingTitle.textContent = '从当前结果加入候选';
  signingHead.appendChild(signingTitle);
  signingPanel.appendChild(signingHead);
  const discoveryRow = document.createElement('div');
  discoveryRow.className = 'task-actions discovery-actions';

  const openPgyBtn = document.createElement('button');
  openPgyBtn.className = 'btn';
  openPgyBtn.textContent = '打开蒲公英搜索';
  openPgyBtn.addEventListener('click', async () => {
    try {
      const r = await window.desktopAPI.browser.openCollection(PGY_DISCOVERY_URL);
      if (!r?.ok) alert(`打开失败：${r?.error || 'unknown error'}`);
    } catch (e) {
      alert(`打开异常：${e?.message || String(e)}`);
    }
  });

  const readSearchBtn = document.createElement('button');
  readSearchBtn.className = 'btn primary';
  readSearchBtn.textContent = '执行指令';
  readSearchBtn.disabled = !!state.tasks?.running || _candidateReadRunning || Boolean(_candidateCheckpoint);
  readSearchBtn.addEventListener('click', async () => {
    try {
      _candidateReadRunning = true;
      _candidateInstructionStatus = '正在读取右侧蒲公英结果...';
      store.set({ tasks: { ...store.state.tasks } });
      const command = await window.desktopAPI.pgy.parseCandidateInstruction(_candidateInstruction);
      if (!command?.ok) {
        _candidateInstructionStatus = command?.error || '指令无法识别';
        alert(_candidateInstructionStatus);
        store.set({ tasks: { ...store.state.tasks } });
        return;
      }
      const r = await window.desktopAPI.pgy.extractSearchCandidates({
        requestedCount: command.requestedCount,
        startRank: command.startRank,
        endRank: command.endRank,
        templatePath: _selectedTemplatePath || state.templates?.activeTemplatePath || ''
      });
      handleCandidateSearchResult(command, r);
    } catch (e) {
      _candidateInstructionStatus = e?.message || String(e);
      alert(`读取当前搜索结果异常：${e?.message || String(e)}`);
    } finally {
      _candidateReadRunning = false;
      store.set({ tasks: { ...store.state.tasks } });
    }
  });

  const commandWrap = document.createElement('div');
  commandWrap.className = 'candidate-command';
  const commandLabel = document.createElement('label');
  commandLabel.className = 'candidate-command-label';
  commandLabel.textContent = '告诉工具要取哪些达人';
  const commandInputRow = document.createElement('div');
  commandInputRow.className = 'candidate-command-input-row';
  const commandInput = document.createElement('input');
  commandInput.className = 'tpl-input candidate-command-input';
  commandInput.placeholder = '例如：前30位，或第42位到第50位达人加入候选';
  commandInput.value = _candidateInstruction;
  commandInput.disabled = !!state.tasks?.running || _candidateReadRunning || Boolean(_candidateCheckpoint);
  commandInput.addEventListener('input', () => {
    _candidateInstruction = commandInput.value;
    _candidateInstructionStatus = '';
  });
  commandInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    readSearchBtn.click();
  });
  commandInputRow.appendChild(commandInput);
  commandInputRow.appendChild(readSearchBtn);
  commandWrap.appendChild(commandLabel);
  commandWrap.appendChild(commandInputRow);
  const commandStatus = document.createElement('div');
  commandStatus.className = 'muted-line candidate-command-status';
  commandStatus.textContent = _candidateInstructionStatus
    || `支持前 N 位或第 A-B 位；单次最多 ${SAFE_BATCH_LIMIT} 位，可定位到第 ${MAX_CANDIDATE_RANK} 位`;
  commandWrap.appendChild(commandStatus);
  if (_candidateCheckpoint) {
    const checkpointRow = document.createElement('div');
    checkpointRow.className = 'candidate-checkpoint-row';
    const checkpointText = document.createElement('div');
    checkpointText.className = 'candidate-checkpoint-text';
    checkpointText.textContent = [
      `已暂存到第 ${_candidateCheckpoint.rank} 位`,
      `安全暂停 ${candidateCheckpointCountdown()}`,
      `尚未加入候选池`
    ].join(' · ');
    checkpointRow.appendChild(checkpointText);

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn primary';
    continueBtn.textContent = `继续读取 ${_candidateCheckpoint.nextRank}-${_candidateCheckpoint.endRank}`;
    continueBtn.disabled = _candidateReadRunning || Date.now() < Number(_candidateCheckpoint.readyAt || 0);
    continueBtn.addEventListener('click', async () => {
      const checkpoint = _candidateCheckpoint;
      if (!checkpoint) return;
      try {
        _candidateReadRunning = true;
        _candidateInstructionStatus = `正在重新检查页面并继续读取第 ${checkpoint.nextRank}-${checkpoint.endRank} 位...`;
        store.set({ tasks: { ...store.state.tasks } });
        const result = await window.desktopAPI.pgy.continueSearchCandidates(checkpoint.sessionId);
        handleCandidateSearchResult(checkpoint.command, result);
      } catch (error) {
        _candidateInstructionStatus = error?.message || String(error);
        alert(`继续读取异常：${_candidateInstructionStatus}`);
      } finally {
        _candidateReadRunning = false;
        store.set({ tasks: { ...store.state.tasks } });
      }
    });
    checkpointRow.appendChild(continueBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = '结束本次';
    cancelBtn.disabled = _candidateReadRunning;
    cancelBtn.addEventListener('click', async () => {
      const checkpoint = _candidateCheckpoint;
      if (!checkpoint) return;
      try {
        const result = await window.desktopAPI.pgy.cancelSearchCandidateCheckpoint(checkpoint.sessionId);
        if (!result?.ok) {
          alert(result?.error || '结束本次读取失败');
          return;
        }
        stopCandidateCheckpointTimer();
        _candidateCheckpoint = null;
        _candidateInstructionStatus = '本次读取已结束，暂存结果未加入候选池。';
        store.set({ tasks: { ...store.state.tasks } });
      } catch (error) {
        alert(`结束本次读取异常：${error?.message || String(error)}`);
      }
    });
    checkpointRow.appendChild(cancelBtn);
    commandWrap.appendChild(checkpointRow);

    const checkpointNote = document.createElement('div');
    checkpointNote.className = 'task-note';
    checkpointNote.textContent = '90 秒是保守工程默认值，不是平台官方安全值，也不能保证不会触发风控。继续前会重新检查页面、排名锚点和安全提示。';
    commandWrap.appendChild(checkpointNote);
  }

  const addCurrentBtn = document.createElement('button');
  addCurrentBtn.className = 'btn';
  addCurrentBtn.textContent = '加入当前达人';
  addCurrentBtn.disabled = !!state.tasks?.running;
  addCurrentBtn.addEventListener('click', async () => {
    try {
      const current = await window.desktopAPI.browser.getCollectionUrl();
      if (!current?.ok) {
        alert(`读取当前页面失败：${current?.error || 'unknown error'}`);
        return;
      }
      const currentUrl = current.url || '';
      if (!looksLikePgyCreatorUrl(currentUrl)) {
        alert('当前右侧浏览器不是蒲公英达人相关页面。请先打开候选达人详情页。');
        return;
      }
      const added = addDraftUrls([currentUrl]);
      store.set({ tasks: { ...store.state.tasks } });
      if (!added) alert('当前页面已在候选队列中。');
    } catch (e) {
      alert(`加入候选异常：${e?.message || String(e)}`);
    }
  });

  const discoveryHint = document.createElement('div');
  discoveryHint.className = 'muted-line discovery-hint';
  discoveryHint.textContent = '筛选条件仍由用户在右侧蒲公英中设置；候选可分段累计，实际采集仍按单批最多 50 位执行。';

  discoveryRow.appendChild(openPgyBtn);
  discoveryRow.appendChild(commandWrap);
  discoveryRow.appendChild(addCurrentBtn);
  discoveryRow.appendChild(discoveryHint);
  signingPanel.appendChild(discoveryRow);

  const savedRow = document.createElement('div');
  savedRow.className = 'saved-task-row';
  const savedSel = document.createElement('select');
  savedSel.className = 'tpl-input';
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '选择历史任务';
  savedSel.appendChild(emptyOpt);
  _savedSigningTasks.forEach((task) => {
    const opt = document.createElement('option');
    opt.value = task.id;
    const candidateCount = Array.isArray(task.candidates) ? task.candidates.length : 0;
    opt.textContent = `${task.taskName || '未命名签约任务'}${candidateCount ? ` · ${candidateCount} 个候选` : ''}`;
    if (task.id === _selectedSigningTaskId) opt.selected = true;
    savedSel.appendChild(opt);
  });
  savedSel.addEventListener('change', () => {
    const id = savedSel.value;
    const task = _savedSigningTasks.find((x) => x.id === id);
    if (task) {
      applySigningTask(task);
      store.set({ tasks: { ...store.state.tasks } });
    } else {
      _selectedSigningTaskId = '';
    }
  });

  const saveTaskBtn = document.createElement('button');
  saveTaskBtn.className = 'btn';
  saveTaskBtn.textContent = '保存当前任务';
  saveTaskBtn.addEventListener('click', async () => {
    try {
      const r = await window.desktopAPI.signingTasks.save(buildSigningTaskPayload());
      if (!r?.ok) {
        alert(`保存失败：${r?.error || 'unknown error'}`);
        return;
      }
      _savedSigningTasks = r.items || [];
      _selectedSigningTaskId = r.item?.id || _selectedSigningTaskId;
      applySigningTask(r.item);
      _candidateDirty = false;
      persistCandidateDraft();
      store.set({ tasks: { ...store.state.tasks } });
    } catch (e) {
      alert(`保存异常：${e?.message || String(e)}`);
    }
  });

  const deleteTaskBtn = document.createElement('button');
  deleteTaskBtn.className = 'btn ghost';
  deleteTaskBtn.textContent = '删除';
  deleteTaskBtn.disabled = !_selectedSigningTaskId;
  deleteTaskBtn.addEventListener('click', async () => {
    if (!_selectedSigningTaskId) return;
    if (!window.confirm('确定删除当前保存的签约任务吗？不会删除历史运行结果。')) return;
    const r = await window.desktopAPI.signingTasks.delete(_selectedSigningTaskId);
    if (!r?.ok) {
      alert(`删除失败：${r?.error || 'unknown error'}`);
      return;
    }
    _savedSigningTasks = r.items || [];
    _selectedSigningTaskId = '';
    store.set({ tasks: { ...store.state.tasks } });
  });

  const refreshTaskBtn = document.createElement('button');
  refreshTaskBtn.className = 'btn';
  refreshTaskBtn.textContent = '刷新';
  refreshTaskBtn.addEventListener('click', refreshSigningData);

  savedRow.appendChild(savedSel);
  savedRow.appendChild(saveTaskBtn);
  savedRow.appendChild(deleteTaskBtn);
  savedRow.appendChild(refreshTaskBtn);

  const advancedSearchChildren = [savedRow];
  if (_candidateDirty) {
    const dirtyHint = document.createElement('div');
    dirtyHint.className = 'task-note';
    dirtyHint.textContent = '当前候选名单有未保存改动；需要长期保留时请点击“保存当前任务”。';
    advancedSearchChildren.push(dirtyHint);
  }

  const taskName = document.createElement('input');
  taskName.className = 'tpl-input';
  taskName.placeholder = '任务名称，例如：FILA 中外生活 20-30w 蒲公英搜索';
  taskName.value = _signingTaskDraft.taskName;
  taskName.addEventListener('input', () => {
    _signingTaskDraft.taskName = taskName.value;
  });
  advancedSearchChildren.push(taskName);

  const sourceRow = document.createElement('label');
  sourceRow.className = 'criteria-field';
  const sourceLabel = document.createElement('span');
  sourceLabel.textContent = '达人来源';
  const sourceSelect = document.createElement('select');
  sourceSelect.className = 'tpl-input';
  SOURCE_MODE_OPTIONS.forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if ((_signingTaskDraft.sourceMode || 'import') === value) opt.selected = true;
    sourceSelect.appendChild(opt);
  });
  sourceSelect.addEventListener('change', () => {
    _signingTaskDraft.sourceMode = sourceSelect.value;
  });
  sourceRow.appendChild(sourceLabel);
  sourceRow.appendChild(sourceSelect);
  advancedSearchChildren.push(sourceRow);

  const channelRow = document.createElement('div');
  channelRow.className = 'check-row';
  channelRow.appendChild(checkbox('蒲公英搜索', _signingTaskDraft.channels.pgy, (v) => { _signingTaskDraft.channels.pgy = v; }));
  channelRow.appendChild(checkbox('小红书站内搜索', _signingTaskDraft.channels.xhs, (v) => { _signingTaskDraft.channels.xhs = v; }));
  channelRow.appendChild(checkbox('蒲公英邀约', _signingTaskDraft.contactPlan.pgyInvite, (v) => { _signingTaskDraft.contactPlan.pgyInvite = v; }));
  channelRow.appendChild(checkbox('微信建联', _signingTaskDraft.contactPlan.wechat, (v) => { _signingTaskDraft.contactPlan.wechat = v; }));
  channelRow.appendChild(checkbox('邮件建联', _signingTaskDraft.contactPlan.email, (v) => { _signingTaskDraft.contactPlan.email = v; }));
  advancedSearchChildren.push(channelRow);

  const criteriaGrid = document.createElement('div');
  criteriaGrid.className = 'criteria-grid';
  CRITERIA_FIELDS.forEach(([key, label, placeholder]) => {
    const field = document.createElement('label');
    field.className = 'criteria-field';
    const span = document.createElement('span');
    span.textContent = label;
    const input = document.createElement('input');
    input.className = 'tpl-input';
    input.placeholder = placeholder || '';
    input.value = _signingTaskDraft.searchCriteria[key] ?? '';
    input.addEventListener('input', () => {
      _signingTaskDraft.searchCriteria[key] = input.value;
    });
    field.appendChild(span);
    field.appendChild(input);
    criteriaGrid.appendChild(field);
  });
  advancedSearchChildren.push(criteriaGrid);

  const taskNote = document.createElement('textarea');
  taskNote.className = 'tpl-input task-note-input';
  taskNote.placeholder = '任务备注，可记录品牌、产品、排除规则或建联口径';
  taskNote.value = _signingTaskDraft.note;
  taskNote.addEventListener('input', () => {
    _signingTaskDraft.note = taskNote.value;
  });
  advancedSearchChildren.push(taskNote);

  const advancedSearch = createAdvancedSection({
    title: '不常用：历史任务、详细筛选和建联口径',
    open: _searchAdvancedOpen,
    onToggle: (open) => { _searchAdvancedOpen = open; },
    children: advancedSearchChildren
  });
  advancedSearch.classList.add('task-advanced-section');
  signingPanel.appendChild(advancedSearch);

  root.appendChild(signingPanel);

  // 手工介入提示
  if (state.tasks?.paused) {
    const banner = document.createElement('div');
    banner.className = 'task-banner warn';
    banner.textContent =
      `队列已暂停：${state.tasks.pauseReason || '需要手工介入'}\n请在右侧浏览器完成登录/处理风控/切到正确页面后，点击“继续”；或点击“跳过当前”。`;
    root.appendChild(banner);
  } else if (state.tasks?.pausePending) {
    const banner = document.createElement('div');
    banner.className = 'task-banner warn';
    banner.textContent = '已登记暂停请求：当前达人仍在安全执行，完成后才会暂停。可点击“取消待暂停”撤销。';
    root.appendChild(banner);
  }
  if (state.tasks?.stopPending) {
    const banner = document.createElement('div');
    banner.className = 'task-banner warn';
    banner.textContent = '停止请求已收到：程序正在等当前读写动作到达安全点；随后会结束当前达人并停止整批，不会继续下一位。';
    root.appendChild(banner);
  }
  if (state.tasks?.persistenceError) {
    const banner = document.createElement('div');
    banner.className = 'task-banner bad';
    banner.textContent = `任务状态保存异常：${state.tasks.persistenceError.message || '无法写入任务状态'}。请停止新增操作并保留当前窗口，避免恢复信息丢失。`;
    root.appendChild(banner);
  }

  // URL 输入
  const inputWrap = document.createElement('div');
  inputWrap.className = 'task-panel';
  const inputHead = document.createElement('div');
  inputHead.className = 'panel-title-row';
  const inputTitle = document.createElement('div');
  inputTitle.className = 'section-label compact';
  inputTitle.textContent = '导入或粘贴达人链接';
  const inputHint = document.createElement('div');
  inputHint.className = 'muted-line';
  inputHint.textContent = '已有达人表、手工粘贴和蒲公英搜索结果，都会先进入候选池再采集。';
  inputHead.appendChild(inputTitle);
  inputHead.appendChild(inputHint);

  const textarea = document.createElement('textarea');
  textarea.className = 'tpl-input';
  textarea.style.height = '110px';
  textarea.style.padding = '10px 10px';
  textarea.style.resize = 'vertical';
  textarea.placeholder = '每行一个蒲公英达人链接，也可以直接粘贴 Excel 里复制出来的一列。';
  textarea.value = _draftText;
  textarea.addEventListener('input', () => {
    _draftText = textarea.value;
    persistCandidateDraft();
  });

  const inputBtns = document.createElement('div');
  inputBtns.className = 'task-actions';

  const btnParse = document.createElement('button');
  btnParse.className = 'btn';
  btnParse.textContent = '加入候选';
  btnParse.disabled = !!state.tasks?.running;
  btnParse.addEventListener('click', () => {
    const urls = parseUrls(_draftText);
    const merged = [..._draftUrls, ...urls];
    _draftUrls = parseUrls(merged.join('\n')); // 去重
    _draftText = _draftUrls.join('\n');
    textarea.value = _draftText;
    if (urls.length) _candidateDirty = true;
    persistCandidateDraft();
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
      persistCandidateDraft();
    } catch (e) {
      const next = window.prompt('无法直接读取剪贴板，请手工粘贴：');
      if (next) {
        _draftText = next;
        textarea.value = _draftText;
        persistCandidateDraft();
      }
    }
  });

  const btnImportExcel = document.createElement('button');
  btnImportExcel.className = 'btn';
  btnImportExcel.textContent = '导入 Excel';
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
      const mergeResult = applyImportedCandidateItems(items, { merge: false });
      textarea.value = _draftText;
      _importPreview = { filePath: r.filePath || '', stats: { ...(r.stats || {}), mode: 'replace', ...mergeResult }, items: items.slice(0, 10) };
      store.set({ tasks: { ...store.state.tasks } });
    } catch (e) {
      alert(`导入异常：${e?.message || String(e)}`);
    }
  });

  const btnMergeExcel = document.createElement('button');
  btnMergeExcel.className = 'btn';
  btnMergeExcel.textContent = '合并 Excel';
  btnMergeExcel.disabled = !!state.tasks?.running;
  btnMergeExcel.addEventListener('click', async () => {
    try {
      const r = await window.desktopAPI.tasks.importExcel();
      if (r?.canceled) return;
      if (!r?.ok) {
        alert(`导入失败：${r?.error || 'unknown error'}`);
        return;
      }
      const items = Array.isArray(r.items) ? r.items : [];
      const mergeResult = applyImportedCandidateItems(items, { merge: true });
      textarea.value = _draftText;
      _importPreview = { filePath: r.filePath || '', stats: { ...(r.stats || {}), mode: 'merge', ...mergeResult }, items: items.slice(0, 10) };
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
    _candidateDirty = true;
    textarea.value = '';
    store.set({ tasks: { ...store.state.tasks } });
  });

  inputBtns.appendChild(btnParse);
  inputBtns.appendChild(btnPaste);
  inputBtns.appendChild(btnImportExcel);
  inputBtns.appendChild(btnMergeExcel);
  inputBtns.appendChild(btnClear);

  inputWrap.appendChild(inputHead);
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
    if (s.mode) {
      const modeLabel = s.mode === 'merge' ? '合并' : (s.mode === 'search-page' ? '蒲公英搜索页读取' : '替换');
      lines.push(`模式：${modeLabel}，本次导入=${s.imported ?? '-'}，新增=${s.added ?? '-'}，更新=${s.updated ?? '-'}`);
    }
    const filterText = summarizeSearchFilters(_importPreview.filters);
    if (filterText) {
      lines.push('');
      lines.push('当前筛选快照：');
      lines.push(filterText);
    }
    lines.push('');
    lines.push('预览（前10条）：');
    (_importPreview.items || []).forEach((it, idx) => {
      const name = (it?.creator_name || '').trim() || '(无昵称)';
      const url = it?.pgy_url || '';
      const status = String(it?.status || 'candidate');
      const statusLabel = status === 'selected' ? '优先' : (status === 'excluded' ? '排除' : '待复核');
      const meta = [
        statusLabel,
        it?.priority ? `优先级 ${it.priority}` : '',
        it?.excludeReason ? `排除原因 ${it.excludeReason}` : ''
      ].filter(Boolean).join(' / ');
      lines.push(`${idx + 1}. ${name}  ${meta}  ${url}`);
    });
    box.textContent = lines.join('\n');
    root.appendChild(box);
  }

  if (_draftUrls.length) {
    const candidatePanel = document.createElement('div');
    candidatePanel.className = 'task-panel candidate-panel';

    const candidateHead = document.createElement('div');
    candidateHead.className = 'panel-title-row';
    const candidateTitle = document.createElement('div');
    candidateTitle.className = 'section-label compact';
    const filteredDraftUrls = getFilteredDraftUrls();
    const decisionStats = candidateDecisionStats();
    candidateTitle.textContent = `候选达人队列（${filteredDraftUrls.length}/${_draftUrls.length}） · 优先 ${decisionStats.selected} / 排除 ${decisionStats.excluded}`;

    const candidateFilters = document.createElement('div');
    candidateFilters.className = 'candidate-filters';

    const statusFilter = document.createElement('select');
    statusFilter.className = 'tpl-input';
    statusFilter.style.maxWidth = '120px';
    statusFilter.style.height = '34px';
    [
      ['all', '全部状态'],
      ['candidate', '待复核'],
      ['selected', '优先'],
      ['excluded', '排除']
    ].forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (_candidateStatusFilter === value) opt.selected = true;
      statusFilter.appendChild(opt);
    });
    statusFilter.addEventListener('change', () => {
      _candidateStatusFilter = statusFilter.value;
      store.set({ tasks: { ...store.state.tasks } });
    });

    const candidateSearch = document.createElement('input');
    candidateSearch.className = 'tpl-input';
    candidateSearch.placeholder = '搜索 URL / 达人备注 / 原因';
    candidateSearch.style.maxWidth = '260px';
    candidateSearch.value = _candidateQuery;
    candidateSearch.addEventListener('input', () => {
      _candidateQuery = candidateSearch.value;
      store.set({ tasks: { ...store.state.tasks } });
    });

    const clearAllCandidates = document.createElement('button');
    clearAllCandidates.className = 'btn candidate-clear-all';
    clearAllCandidates.title = '清空全部候选，开始新一轮筛选';
    clearAllCandidates.setAttribute('aria-label', `清空全部 ${_draftUrls.length} 位候选`);
    clearAllCandidates.disabled = !!state.tasks?.running || !_draftUrls.length;
    const clearAllIcon = document.createElement('span');
    clearAllIcon.className = 'candidate-clear-all-icon';
    clearAllIcon.setAttribute('aria-hidden', 'true');
    clearAllIcon.textContent = '×';
    const clearAllText = document.createElement('span');
    clearAllText.textContent = '清空全部候选';
    clearAllCandidates.appendChild(clearAllIcon);
    clearAllCandidates.appendChild(clearAllText);
    clearAllCandidates.addEventListener('click', () => {
      const total = _draftUrls.length;
      const confirmed = window.confirm([
        `确定清空全部 ${total} 位候选吗？`,
        '',
        '这会清空候选列表中的优先、待复核和排除记录，方便开始新一轮筛选。',
        '已经完成的采集结果和导出文件不会被删除。'
      ].join('\n'));
      if (!confirmed) return;
      _draftUrls = [];
      _draftItems = [];
      _latestSegmentUrls = [];
      _collectionScope = 'active';
      _candidateQuery = '';
      _candidateStatusFilter = 'all';
      _importPreview = null;
      _lastSearchSnapshot = null;
      _candidateInstructionStatus = '候选列表已清空，可以开始新一轮筛选。';
      syncDraftText();
      textarea.value = '';
      _candidateDirty = true;
      persistCandidateDraft();
      store.set({ tasks: { ...store.state.tasks } });
    });

    candidateFilters.appendChild(statusFilter);
    candidateFilters.appendChild(candidateSearch);
    candidateFilters.appendChild(clearAllCandidates);
    candidateHead.appendChild(candidateTitle);
    candidateHead.appendChild(candidateFilters);
    candidatePanel.appendChild(candidateHead);

    const candidateTools = document.createElement('div');
    candidateTools.className = 'task-actions';

    const copyCandidates = document.createElement('button');
    copyCandidates.className = 'btn';
    copyCandidates.textContent = '复制全部URL';
    copyCandidates.addEventListener('click', async () => {
      const text = _draftUrls.join('\n');
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {
        window.prompt('复制失败，请手工复制：', text);
      }
    });

    const copyFilteredCandidates = document.createElement('button');
    copyFilteredCandidates.className = 'btn';
    copyFilteredCandidates.textContent = '复制当前筛选URL';
    copyFilteredCandidates.disabled = !filteredDraftUrls.length;
    copyFilteredCandidates.addEventListener('click', async () => {
      const text = filteredDraftUrls.join('\n');
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {
        window.prompt('复制失败，请手工复制：', text);
      }
    });

    const exportCandidateSheet = document.createElement('button');
    exportCandidateSheet.className = 'btn';
    exportCandidateSheet.textContent = '导出候选表';
    exportCandidateSheet.disabled = !_draftUrls.length;
    exportCandidateSheet.addEventListener('click', async () => {
      try {
        const r = await window.desktopAPI.tasks.exportCandidateSheet(buildSigningTaskPayload());
        if (r?.canceled) return;
        if (!r?.ok) {
          alert(`导出失败：${r?.error || 'unknown error'}`);
          return;
        }
        alert(`导出成功：\n${r.outPath}\n\n统计：候选 ${r.candidates}，本次采集范围 ${r.inScope}，优先 ${r.selected}，排除 ${r.excluded}`);
      } catch (e) {
        alert(`导出异常：${e?.message || String(e)}`);
      }
    });

    const markSelected = document.createElement('button');
    markSelected.className = 'btn';
    markSelected.textContent = '当前筛选设为优先';
    markSelected.disabled = !!state.tasks?.running || !filteredDraftUrls.length;
    markSelected.addEventListener('click', () => {
      markDraftUrls(filteredDraftUrls, { status: 'selected' });
      store.set({ tasks: { ...store.state.tasks } });
    });

    const markCandidate = document.createElement('button');
    markCandidate.className = 'btn';
    markCandidate.textContent = '当前筛选设为待复核';
    markCandidate.disabled = !!state.tasks?.running || !filteredDraftUrls.length;
    markCandidate.addEventListener('click', () => {
      markDraftUrls(filteredDraftUrls, { status: 'candidate' });
      store.set({ tasks: { ...store.state.tasks } });
    });

    const markExcluded = document.createElement('button');
    markExcluded.className = 'btn ghost';
    markExcluded.textContent = '当前筛选设为排除';
    markExcluded.disabled = !!state.tasks?.running || !filteredDraftUrls.length;
    markExcluded.addEventListener('click', () => {
      const reason = window.prompt(`给当前 ${filteredDraftUrls.length} 条候选填写排除原因（可留空）：`, '');
      if (reason === null) return;
      markDraftUrls(filteredDraftUrls, { status: 'excluded', excludeReason: reason });
      store.set({ tasks: { ...store.state.tasks } });
    });

    const clearFiltered = document.createElement('button');
    clearFiltered.className = 'btn ghost';
    clearFiltered.textContent = '移除当前筛选';
    clearFiltered.disabled = !!state.tasks?.running || !filteredDraftUrls.length;
    clearFiltered.addEventListener('click', () => {
      if (!window.confirm(`确定只移除当前筛选中的 ${filteredDraftUrls.length} 条候选吗？整批中的其余候选会保留。`)) return;
      filteredDraftUrls.forEach((url) => removeDraftUrl(url));
      textarea.value = _draftText;
      store.set({ tasks: { ...store.state.tasks } });
    });

    candidateTools.appendChild(copyCandidates);
    candidateTools.appendChild(copyFilteredCandidates);
    candidateTools.appendChild(exportCandidateSheet);
    candidateTools.appendChild(markSelected);
    candidateTools.appendChild(markCandidate);
    candidateTools.appendChild(markExcluded);
    candidateTools.appendChild(clearFiltered);
    const candidateBulk = createAdvancedSection({
      title: `批量处理当前筛选（${filteredDraftUrls.length} 人）`,
      open: _candidateBulkOpen,
      onToggle: (open) => { _candidateBulkOpen = open; },
      children: [candidateTools]
    });
    candidateBulk.classList.add('task-advanced-section');
    candidatePanel.appendChild(candidateBulk);

    const candidateList = document.createElement('div');
    candidateList.className = 'candidate-list';
    if (!filteredDraftUrls.length) {
      const empty = document.createElement('div');
      empty.className = 'contact-review-empty';
      empty.textContent = '当前搜索下没有候选达人。';
      candidateList.appendChild(empty);
    } else {
      filteredDraftUrls.forEach((url) => {
        const originalIndex = _draftUrls.findIndex((u) => normalizeDraftUrl(u) === normalizeDraftUrl(url));
        const item = getDraftItem(url);
        const card = document.createElement('div');
        card.className = `candidate-card candidate-${item?.status || 'candidate'}`;

        const cardMain = document.createElement('div');
        cardMain.className = 'candidate-card-main';

        const rank = document.createElement('div');
        rank.className = 'candidate-rank';
        rank.textContent = String(originalIndex + 1);

        const info = document.createElement('div');
        info.className = 'candidate-info';
        const name = document.createElement('div');
        name.className = 'candidate-name';
        name.textContent = item?.creator_name || '待命名达人';
        const link = document.createElement('div');
        link.className = 'candidate-url';
        link.textContent = url;
        info.appendChild(name);
        info.appendChild(link);

        const quick = document.createElement('div');
        quick.className = 'candidate-quick';
        const statusLabel = {
          selected: '优先',
          candidate: '待复核',
          excluded: '排除'
        }[item?.status || 'candidate'] || '待复核';
        const statusChip = document.createElement('span');
        statusChip.className = `contact-chip ${item?.status === 'selected' ? 'good' : item?.status === 'excluded' ? 'warn' : ''}`.trim();
        statusChip.textContent = statusLabel;
        quick.appendChild(statusChip);
        if (item?.priority) {
          const priorityChip = document.createElement('span');
          priorityChip.className = 'contact-chip strong';
          priorityChip.textContent = `优先级：${item.priority}`;
          quick.appendChild(priorityChip);
        }
        if (item?.excludeReason) {
          const excludeChip = document.createElement('span');
          excludeChip.className = 'contact-chip warn';
          excludeChip.textContent = `排除：${item.excludeReason}`;
          quick.appendChild(excludeChip);
        }

        cardMain.appendChild(rank);
        cardMain.appendChild(info);
        cardMain.appendChild(quick);
        card.appendChild(cardMain);

        const details = document.createElement('details');
        details.className = 'candidate-detail';
        const summary = document.createElement('summary');
        summary.textContent = '编辑候选信息';
        details.appendChild(summary);

        const fields = document.createElement('div');
        fields.className = 'candidate-fields';

        const statusField = document.createElement('label');
        statusField.className = 'field-label compact';
        statusField.textContent = '状态';
        const statusSel = document.createElement('select');
        statusSel.className = 'tpl-input';
        statusSel.style.height = '30px';
        [
          ['candidate', '待复核'],
          ['selected', '优先'],
          ['excluded', '排除']
        ].forEach(([value, label]) => {
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = label;
          if ((item?.status || 'candidate') === value) opt.selected = true;
          statusSel.appendChild(opt);
        });
        statusSel.disabled = !!state.tasks?.running;
        statusSel.addEventListener('change', () => {
          updateDraftItem(url, { status: statusSel.value });
          store.set({ tasks: { ...store.state.tasks } });
        });
        statusField.appendChild(statusSel);

        const noteField = document.createElement('label');
        noteField.className = 'field-label compact wide';
        noteField.textContent = '达人/备注';
        const noteInput = document.createElement('input');
        noteInput.className = 'tpl-input';
        noteInput.style.height = '30px';
        noteInput.placeholder = '达人昵称或备注';
        noteInput.value = item?.creator_name || '';
        noteInput.disabled = !!state.tasks?.running;
        noteInput.addEventListener('input', () => {
          setDraftItemLabel(url, noteInput.value);
        });
        noteField.appendChild(noteInput);

        const priorityField = document.createElement('label');
        priorityField.className = 'field-label compact';
        priorityField.textContent = '优先级';
        const priorityInput = document.createElement('input');
        priorityInput.className = 'tpl-input';
        priorityInput.style.height = '30px';
        priorityInput.placeholder = 'P1/P2';
        priorityInput.value = item?.priority || '';
        priorityInput.disabled = !!state.tasks?.running;
        priorityInput.addEventListener('input', () => {
          updateDraftItem(url, { priority: priorityInput.value });
        });
        priorityField.appendChild(priorityInput);

        const excludeField = document.createElement('label');
        excludeField.className = 'field-label compact wide';
        excludeField.textContent = '排除原因';
        const excludeInput = document.createElement('input');
        excludeInput.className = 'tpl-input';
        excludeInput.style.height = '30px';
        excludeInput.placeholder = '不匹配/报价高';
        excludeInput.value = item?.excludeReason || '';
        excludeInput.disabled = !!state.tasks?.running;
        excludeInput.addEventListener('input', () => {
          updateDraftItem(url, { excludeReason: excludeInput.value });
        });
        excludeField.appendChild(excludeInput);

        const actionField = document.createElement('div');
        actionField.className = 'candidate-card-actions';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn ghost';
        removeBtn.style.height = '30px';
        removeBtn.textContent = '删除';
        removeBtn.disabled = !!state.tasks?.running;
        removeBtn.addEventListener('click', () => {
          removeDraftUrl(url);
          textarea.value = _draftText;
          store.set({ tasks: { ...store.state.tasks } });
        });
        actionField.appendChild(removeBtn);

        fields.appendChild(statusField);
        fields.appendChild(noteField);
        fields.appendChild(priorityField);
        fields.appendChild(excludeField);
        fields.appendChild(actionField);
        details.appendChild(fields);
        card.appendChild(details);
        candidateList.appendChild(card);
      });
    }
    candidatePanel.appendChild(candidateList);
    root.appendChild(candidatePanel);
  }

  const preRunPanel = document.createElement('div');
  preRunPanel.className = 'task-panel pre-run-panel';
  const preRunHead = document.createElement('div');
  preRunHead.className = 'panel-title-row';
  const preRunTitle = document.createElement('div');
  preRunTitle.className = 'section-label compact';
  preRunTitle.textContent = '开始采集前';
  const checkLoginBtn = document.createElement('button');
  checkLoginBtn.className = 'btn';
  checkLoginBtn.textContent = '检查蒲公英登录';
  checkLoginBtn.addEventListener('click', async () => {
    await runPgyLoginCheck();
    store.set({ tasks: { ...store.state.tasks } });
  });
  preRunHead.appendChild(preRunTitle);
  preRunHead.appendChild(checkLoginBtn);
  preRunPanel.appendChild(preRunHead);

  const scopeRow = document.createElement('div');
  scopeRow.className = 'task-actions';
  const scopeLabel = document.createElement('span');
  scopeLabel.className = 'muted-line';
  scopeLabel.textContent = '采集范围';
  const scopeSel = document.createElement('select');
  scopeSel.className = 'tpl-input';
  scopeSel.style.width = '180px';
  scopeSel.style.height = '34px';
  [
    ['latest_segment', '最近加入的一段'],
    ['active', '优先 + 待复核'],
    ['selected', '只采优先'],
    ['all', '全部候选']
  ].forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (_collectionScope === value) opt.selected = true;
    scopeSel.appendChild(opt);
  });
  scopeSel.disabled = !!state.tasks?.running;
  scopeSel.addEventListener('change', () => {
    _collectionScope = scopeSel.value;
    _candidateDirty = true;
    persistCandidateDraft();
    store.set({ tasks: { ...store.state.tasks } });
  });
  const scopeHint = document.createElement('span');
  scopeHint.className = 'muted-line';
  scopeHint.textContent = '默认不采集已排除达人。';
  scopeRow.appendChild(scopeLabel);
  scopeRow.appendChild(scopeSel);
  scopeRow.appendChild(scopeHint);
  preRunPanel.appendChild(scopeRow);

  const safetyNotice = document.createElement('div');
  safetyNotice.className = 'task-safety-notice';
  safetyNotice.innerHTML = [
    '<b>安全运行提示：</b>',
    RECOMMENDED_BATCH_TEXT,
    '；系统会串行采集并加入随机等待。',
    '如果页面出现登录、验证码、安全验证、人机验证、访问异常或操作频繁提示，队列会暂停，必须人工处理后再继续。'
  ].join('');
  preRunPanel.appendChild(safetyNotice);

  const preRunGrid = document.createElement('div');
  preRunGrid.className = 'pre-run-grid';
  const criteriaCount = buildCriteriaText().split('\n').filter(Boolean).length;
  const withLabel = countDraftItemsWithLabel();
  const decisionStats = candidateDecisionStats();
  const collectionCount = getCollectionUrls().length;
  const loginLabel = _lastPgyLoginCheck
    ? (_lastPgyLoginCheck.ok ? (_lastPgyLoginCheck.loggedIn ? '已登录' : '未确认') : '检查失败')
    : '未检查';
  preRunGrid.appendChild(statCard('候选达人', _draftUrls.length));
  preRunGrid.appendChild(statCard('本次采集', collectionCount, collectionCount ? 'ok' : 'bad'));
  preRunGrid.appendChild(statCard('优先/排除', `${decisionStats.selected}/${decisionStats.excluded}`, decisionStats.selected || decisionStats.excluded ? 'ok' : 'warn'));
  preRunGrid.appendChild(statCard('备注覆盖', `${withLabel}/${_draftUrls.length}`, withLabel === _draftUrls.length && _draftUrls.length ? 'ok' : 'warn'));
  preRunGrid.appendChild(statCard('筛选条件', criteriaCount, criteriaCount ? 'ok' : 'warn'));
  preRunGrid.appendChild(statCard('登录态', loginLabel, _lastPgyLoginCheck?.loggedIn ? 'ok' : 'warn'));
  preRunGrid.appendChild(statCard('安全上限', `${collectionCount}/${SAFE_BATCH_LIMIT}`, collectionCount <= SAFE_BATCH_LIMIT ? 'ok' : 'bad'));
  preRunPanel.appendChild(preRunGrid);

  const preRunHint = document.createElement('div');
  preRunHint.className = 'muted-line';
  preRunHint.textContent = _selectedTemplatePath
    ? '启动前会再次汇总候选、模板、筛选条件和登录态。'
    : '尚未选择采集模板，请先选择模板。';
  preRunPanel.appendChild(preRunHint);
  root.appendChild(preRunPanel);

  // 控制按钮
  const ctrl = document.createElement('div');
  ctrl.className = 'task-actions main-actions';

  const btnStart = document.createElement('button');
  btnStart.className = 'btn primary';
  btnStart.textContent = '开始采集';
  btnStart.disabled = !!state.tasks?.running;
  btnStart.addEventListener('click', async () => {
    const urls = getCollectionUrls();
    if (!urls.length) {
      alert('当前采集范围内没有可采集的 URL。请调整候选状态或采集范围。');
      return;
    }
    if (urls.length > SAFE_BATCH_LIMIT) {
      alert(`为了降低平台风控风险，单次最多采集 ${SAFE_BATCH_LIMIT} 个达人。请拆成多批执行。`);
      return;
    }
    if (!_selectedTemplatePath) {
      alert('还没有选择采集校准规则。请先到「采集校准」里点选或保存一份规则。');
      return;
    }
    try {
      const loginCheck = await runPgyLoginCheck();
      const summary = buildPreRunSummary({ loginCheck });
      const warnings = [];
      if (!loginCheck?.loggedIn) warnings.push('蒲公英登录态未确认，采集可能暂停等待人工处理。');
      if (!buildCriteriaText()) warnings.push('当前签约任务没有填写筛选条件。');
      if (countDraftItemsWithLabel() < urls.length) warnings.push('部分候选没有填写达人/备注。');
      if (_collectionScope !== 'all' && candidateDecisionStats().excluded) warnings.push('已排除达人不会进入本次采集，但会保留在任务和建联判断里。');
      if (_candidateDirty) warnings.push('候选队列或采集范围有未保存改动；本次采集会使用当前页面状态，但下次打开历史任务前请先保存任务和候选。');
      const ok = window.confirm([
        '确认开始采集？',
        '',
        summary,
        '\n采集完成后，工具会继续低频访问这批达人的小红书公开主页，补采邮箱、微信号或手机号。如需登录或安全验证会自动暂停，等待人工处理。',
        '本流程只采集和生成建联表，不会自动发送邀约、邮件或微信申请。',
        warnings.length ? `\n提醒:\n${warnings.map((x) => `- ${x}`).join('\n')}` : ''
      ].join('\n'));
      if (!ok) return;

      // 如果是从 Excel 导入的，并且 items 覆盖了这些 url，则优先传 items（便于队列显示昵称/导出元信息）
      const items =
        buildCandidateItems().filter((x) => urls.includes(normalizeDraftUrl(x.pgy_url)));
      const r = await window.desktopAPI.tasks.start({
        urls,
        items,
        templatePath: _selectedTemplatePath,
        presetKey: _presetKey,
        signingTask: buildSigningTaskPayload()
      });
      if (!r?.ok) {
        if (r?.code === 'PGY_UNFINISHED_RUN' && r?.runDir) {
          const recover = window.confirm([
            '检测到上次异常中断的采集任务。',
            '为避免重复采集和绕过冷却，本次新任务没有启动。',
            '是否恢复旧任务？恢复后会保持暂停，确认队列后再点“继续”。'
          ].join('\n'));
          if (recover) {
            const recovered = await window.desktopAPI.tasks.recover(r.runDir);
            if (!recovered?.ok) alert(`恢复失败：${recovered?.error || 'unknown error'}`);
            return;
          }
        }
        alert(`启动失败：${r?.error || 'unknown error'}`);
        return;
      }
      _autoContactRunDir = r.runDir || '';
      // 启动后，队列状态由 tasks:state 推送覆盖，这里只保留草稿
      _draftText = _draftUrls.join('\n');
      textarea.value = _draftText;
    } catch (e) {
      alert(`启动异常：${e?.message || String(e)}`);
    }
  });

  const btnPause = document.createElement('button');
  btnPause.className = 'btn ghost';
  btnPause.textContent = state.tasks?.pausePending
    ? '取消待暂停'
    : (state.tasks?.currentId ? '完成当前后暂停' : '暂停');
  btnPause.disabled = !state.tasks?.running || !!state.tasks?.paused;
  btnPause.addEventListener('click', async () => {
    try {
      const r = state.tasks?.pausePending
        ? await window.desktopAPI.tasks.resume()
        : await window.desktopAPI.tasks.pause();
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
  btnSkip.textContent = state.tasks?.skipPending ? '等待安全点跳过' : '跳过当前';
  btnSkip.disabled = !state.tasks?.running || !state.tasks?.currentId || !!state.tasks?.skipPending;
  btnSkip.addEventListener('click', async () => {
    const ok = window.confirm('确定跳过当前达人吗？系统会在下一个安全点停止；若页面已出现登录或风控提示，会优先暂停而不会继续下一位。');
    if (!ok) return;
    try {
      const r = await window.desktopAPI.tasks.skipCurrent();
      if (!r?.ok) alert(`跳过失败：${r?.error || 'unknown error'}`);
    } catch (e) {
      alert(`跳过异常：${e?.message || String(e)}`);
    }
  });

  const btnStop = document.createElement('button');
  btnStop.className = 'btn danger';
  btnStop.textContent = state.tasks?.stopPending ? '正在安全停止' : '停止整批';
  btnStop.disabled = !state.tasks?.running || !!state.tasks?.stopPending;
  btnStop.addEventListener('click', async () => {
    const ok = window.confirm('确定停止整批任务吗？\n\n程序会在下一个安全点结束当前达人，后续未处理达人不会继续。已经完成的结果会保留。');
    if (!ok) return;
    try {
      const result = await window.desktopAPI.tasks.stop();
      if (!result?.ok) alert(`停止失败：${result?.error || 'unknown error'}`);
    } catch (error) {
      alert(`停止异常：${error?.message || String(error)}`);
    }
  });

  ctrl.appendChild(btnStart);
  ctrl.appendChild(btnPause);
  ctrl.appendChild(btnResume);
  ctrl.appendChild(btnSkip);
  ctrl.appendChild(btnStop);

  root.appendChild(ctrl);

  // 队列表格
  const tableHeader = document.createElement('div');
  tableHeader.className = 'task-toolbar';
  const tableTitle = document.createElement('div');
  tableTitle.className = 'section-label';
  tableTitle.textContent = '采集队列';
  tableTitle.classList.add('compact');
  const hasQueueSession = Boolean(
    queue.length
    || state.tasks?.runId
    || state.tasks?.runDir
    || state.tasks?.logs?.length
    || state.tasks?.finishReason
    || state.tasks?.finishedAt
  );
  const btnClearQueue = document.createElement('button');
  btnClearQueue.className = 'btn ghost';
  btnClearQueue.textContent = '清空采集队列';
  btnClearQueue.disabled = Boolean(
    state.tasks?.running
    || state.tasks?.recoveryPending
    || !hasQueueSession
  );
  btnClearQueue.title = state.tasks?.running
    ? '采集运行中不可清空，请先安全停止或等待完成'
    : state.tasks?.recoveryPending
      ? '待恢复任务必须先处理，不能直接清空'
      : '只清空当前采集队列显示，不影响候选池和磁盘结果';
  btnClearQueue.addEventListener('click', async () => {
    const confirmed = window.confirm([
      '确定清空当前采集队列吗？',
      '',
      '只会重置本页当前队列、处理进度、运行日志和本次结果引用。',
      '候选池不会被清空，磁盘中的 run 结果也不会被删除。'
    ].join('\n'));
    if (!confirmed) return;
    try {
      const result = await window.desktopAPI.tasks.clearQueue();
      if (!result?.ok) {
        alert(`清空失败：${result?.error || 'unknown error'}`);
        return;
      }
      _autoContactRunDir = '';
    } catch (error) {
      alert(`清空异常：${error?.message || String(error)}`);
    }
  });
  tableHeader.appendChild(tableTitle);
  tableHeader.appendChild(btnClearQueue);
  root.appendChild(tableHeader);

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
    tr.innerHTML = `<td colspan="3" class="empty-row">暂无本次采集队列。候选池仍会保留；确认采集范围后可开始下一批。</td>`;
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

  renderExecutionRecords(root);

  // 日志
  const logTitle = document.createElement('div');
  logTitle.className = 'section-label';
  logTitle.textContent = '运行日志';
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
