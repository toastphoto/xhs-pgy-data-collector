const XLSX = require('xlsx');
const { SOURCE_MODES, normalizeSigningTask, normalizeCollectionScope } = require('./signing_task');

const CANDIDATE_COLUMNS = [
  '序号',
  '采集范围内',
  '状态',
  '优先级',
  '达人/备注',
  '排除原因',
  '备注',
  '蒲公英链接'
];

const CRITERIA_COLUMNS = ['字段', '值'];

const STATUS_LABELS = {
  candidate: '待复核',
  selected: '优先',
  excluded: '排除'
};

const SCOPE_LABELS = {
  latest_segment: '最近加入的一段',
  active: '优先 + 待复核',
  selected: '只采优先',
  all: '全部候选'
};

function cleanStr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function isInCollectionScope(candidate, collectionScope, latestSegmentUrls = []) {
  const scope = normalizeCollectionScope(collectionScope);
  const status = cleanStr(candidate?.status) || 'candidate';
  if (scope === 'latest_segment') {
    const latest = new Set(latestSegmentUrls.map(cleanStr).filter(Boolean));
    return latest.has(cleanStr(candidate?.pgy_url)) && status !== 'excluded';
  }
  if (scope === 'selected') return status === 'selected';
  if (scope === 'all') return true;
  return status !== 'excluded';
}

function buildCandidateSheetRows(input = {}) {
  const task = normalizeSigningTask(input);
  const collectionScope = normalizeCollectionScope(input.collectionScope || task.collectionScope);
  const latestSegmentUrls = task.latestSegmentUrls || [];
  const rows = task.candidates.map((candidate, index) => {
    const status = candidate.status || 'candidate';
    return {
      '序号': index + 1,
      '采集范围内': isInCollectionScope(candidate, collectionScope, latestSegmentUrls) ? '是' : '否',
      '状态': STATUS_LABELS[status] || STATUS_LABELS.candidate,
      '优先级': candidate.priority || '',
      '达人/备注': candidate.creator_name || '',
      '排除原因': candidate.excludeReason || '',
      '备注': candidate.note || '',
      '蒲公英链接': candidate.pgy_url || ''
    };
  });
  return {
    task,
    collectionScope,
    rows,
    summary: rows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row['采集范围内'] === '是') acc.inScope += 1;
        if (row['状态'] === STATUS_LABELS.selected) acc.selected += 1;
        else if (row['状态'] === STATUS_LABELS.excluded) acc.excluded += 1;
        else acc.candidate += 1;
        return acc;
      },
      { total: 0, inScope: 0, selected: 0, candidate: 0, excluded: 0 }
    )
  };
}

function buildCriteriaRows(task, collectionScope) {
  const rows = [
    { '字段': '任务名称', '值': task.taskName || '' },
    { '字段': '任务来源', '值': SOURCE_MODES[task.sourceMode] || SOURCE_MODES.import },
    { '字段': '任务备注', '值': task.note || '' },
    { '字段': '采集范围', '值': SCOPE_LABELS[collectionScope] || SCOPE_LABELS.active },
    { '字段': '蒲公英搜索', '值': task.channels?.pgy ? '是' : '否' },
    { '字段': '小红书站内搜索', '值': task.channels?.xhs ? '是' : '否' },
    { '字段': '蒲公英邀约', '值': task.contactPlan?.pgyInvite ? '是' : '否' },
    { '字段': '微信建联', '值': task.contactPlan?.wechat ? '是' : '否' },
    { '字段': '邮件建联', '值': task.contactPlan?.email ? '是' : '否' }
  ];

  const labels = [
    ['track', '赛道类型'],
    ['followersMinWan', '粉丝量下限(万)'],
    ['followersMaxWan', '粉丝量上限(万)'],
    ['priceMin', '报价下限'],
    ['priceMax', '报价上限'],
    ['orders90dMin', '近90天商单数下限'],
    ['readUnitPriceMax', '阅读单价上限'],
    ['noteUpdate30dMin', '近30天笔记更新频次下限'],
    ['readMedian90dMin', '近90天阅读中位数下限'],
    ['interactMedian90dMin', '近90天互动中位数下限']
  ];
  labels.forEach(([key, label]) => {
    const value = task.searchCriteria?.[key];
    if (value !== '' && value !== undefined && value !== null) rows.push({ '字段': label, '值': value });
  });
  return rows;
}

function sheetFromRows(rows, columns) {
  return XLSX.utils.json_to_sheet(rows, { header: columns });
}

function buildCandidateWorkbook(input = {}) {
  const { task, collectionScope, rows, summary } = buildCandidateSheetRows(input);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromRows(rows, CANDIDATE_COLUMNS), '候选初筛表');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(buildCriteriaRows(task, collectionScope), CRITERIA_COLUMNS), '筛选条件');
  return { workbook: wb, rows, summary, collectionScope, task };
}

function exportCandidateWorkbook(input = {}, outPath) {
  const result = buildCandidateWorkbook(input);
  XLSX.writeFile(result.workbook, outPath);
  return {
    outPath,
    candidates: result.summary.total,
    inScope: result.summary.inScope,
    selected: result.summary.selected,
    excluded: result.summary.excluded,
    collectionScope: result.collectionScope,
    sheets: ['候选初筛表', '筛选条件']
  };
}

module.exports = {
  CANDIDATE_COLUMNS,
  buildCandidateSheetRows,
  buildCandidateWorkbook,
  exportCandidateWorkbook,
  isInCollectionScope
};
