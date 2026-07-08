const SEARCH_CRITERIA_FIELDS = [
  { key: 'track', label: '赛道类型', type: 'string' },
  { key: 'followersMinWan', label: '粉丝量下限(万)', type: 'number' },
  { key: 'followersMaxWan', label: '粉丝量上限(万)', type: 'number' },
  { key: 'priceMin', label: '报价下限', type: 'number' },
  { key: 'priceMax', label: '报价上限', type: 'number' },
  { key: 'orders90dMin', label: '近90天商单数下限', type: 'number' },
  { key: 'readUnitPriceMax', label: '阅读单价上限', type: 'number' },
  { key: 'noteUpdate30dMin', label: '近30天笔记更新频次下限', type: 'number' },
  { key: 'readMedian90dMin', label: '近90天阅读中位数下限', type: 'number' },
  { key: 'interactMedian90dMin', label: '近90天互动中位数下限', type: 'number' }
];

const SOURCE_MODES = {
  import: '已有达人表/链接',
  search: '蒲公英搜索发现',
  mixed: '导入 + 搜索'
};

function cleanText(value) {
  return String(value || '').trim();
}

function cleanNumber(value) {
  const s = cleanText(value).replace(/,/g, '');
  if (!s) return '';
  const n = Number(s);
  return Number.isFinite(n) ? n : '';
}

function normalizeSearchCriteria(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const field of SEARCH_CRITERIA_FIELDS) {
    const raw = src[field.key];
    out[field.key] = field.type === 'number' ? cleanNumber(raw) : cleanText(raw);
  }
  return out;
}

function summarizeSearchCriteria(criteria) {
  const normalized = normalizeSearchCriteria(criteria);
  const lines = [];
  for (const field of SEARCH_CRITERIA_FIELDS) {
    const value = normalized[field.key];
    if (value === '' || value === null || value === undefined) continue;
    lines.push(`${field.label}: ${value}`);
  }
  return lines.join('\n');
}

function normalizeChannels(input) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    pgy: src.pgy !== false,
    xhs: Boolean(src.xhs)
  };
}

function normalizeContactPlan(input) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    pgyInvite: Boolean(src.pgyInvite),
    wechat: Boolean(src.wechat),
    email: Boolean(src.email)
  };
}

function normalizeCollectionScope(value) {
  const scope = cleanText(value);
  return ['active', 'selected', 'all'].includes(scope) ? scope : 'active';
}

function normalizeSourceMode(value) {
  const mode = cleanText(value);
  return Object.prototype.hasOwnProperty.call(SOURCE_MODES, mode) ? mode : 'import';
}

function normalizeCandidateUrl(url) {
  const s = cleanText(url);
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function normalizeCandidates(input) {
  const items = Array.isArray(input) ? input : [];
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const src = item && typeof item === 'object' ? item : { pgy_url: item };
    const pgyUrl = normalizeCandidateUrl(src.pgy_url || src.pgyUrl || src.url);
    if (!pgyUrl || seen.has(pgyUrl)) continue;
    seen.add(pgyUrl);
    const status = cleanText(src.status);
    out.push({
      pgy_url: pgyUrl,
      creator_name: cleanText(src.creator_name || src.creatorName || src.name),
      note: cleanText(src.note || src.remark),
      status: ['selected', 'excluded'].includes(status) ? status : 'candidate',
      priority: cleanText(src.priority),
      excludeReason: cleanText(src.excludeReason || src.exclude_reason)
    });
  }
  return out;
}

function normalizeSigningTask(input) {
  const src = input && typeof input === 'object' ? input : {};
  const taskName = cleanText(src.taskName) || '未命名签约任务';
  const searchCriteria = normalizeSearchCriteria(src.searchCriteria);
  return {
    taskName,
    sourceMode: normalizeSourceMode(src.sourceMode || src.inputMode),
    note: cleanText(src.note),
    channels: normalizeChannels(src.channels),
    contactPlan: normalizeContactPlan(src.contactPlan),
    collectionScope: normalizeCollectionScope(src.collectionScope),
    searchCriteria,
    searchCriteriaText: summarizeSearchCriteria(searchCriteria),
    candidates: normalizeCandidates(src.candidates || src.candidateItems || src.items)
  };
}

module.exports = {
  SEARCH_CRITERIA_FIELDS,
  SOURCE_MODES,
  cleanNumber,
  normalizeCandidateUrl,
  normalizeCandidates,
  normalizeCollectionScope,
  normalizeSearchCriteria,
  normalizeSigningTask,
  normalizeSourceMode,
  summarizeSearchCriteria
};
