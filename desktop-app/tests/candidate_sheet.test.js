const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

const {
  buildCandidateSheetRows,
  exportCandidateWorkbook,
  isInCollectionScope
} = require('../lib/candidate_sheet');

const input = {
  taskName: 'FILA 搜索',
  sourceMode: 'search',
  note: '优先看中外生活',
  collectionScope: 'active',
  channels: { pgy: true },
  contactPlan: { wechat: true },
  searchCriteria: { track: '中外生活', followersMinWan: '20' },
  candidates: [
    { pgy_url: 'pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a', creator_name: '达人A', status: 'selected', priority: 'P1' },
    { pgy_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/b', creator_name: '达人B', status: 'candidate' },
    { pgy_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/c', creator_name: '达人C', status: 'excluded', excludeReason: '报价高' }
  ]
};

assert.strictEqual(isInCollectionScope({ status: 'excluded' }, 'active'), false);
assert.strictEqual(isInCollectionScope({ status: 'excluded' }, 'all'), true);
assert.strictEqual(isInCollectionScope({ status: 'candidate' }, 'selected'), false);
assert.strictEqual(isInCollectionScope({ status: 'selected' }, 'selected'), true);
assert.strictEqual(
  isInCollectionScope(
    { pgy_url: 'https://pgy.xiaohongshu.com/a', status: 'candidate' },
    'latest_segment',
    ['https://pgy.xiaohongshu.com/a']
  ),
  true
);
assert.strictEqual(
  isInCollectionScope(
    { pgy_url: 'https://pgy.xiaohongshu.com/b', status: 'candidate' },
    'latest_segment',
    ['https://pgy.xiaohongshu.com/a']
  ),
  false
);

const built = buildCandidateSheetRows(input);
assert.strictEqual(built.summary.total, 3);
assert.strictEqual(built.summary.inScope, 2);
assert.strictEqual(built.summary.selected, 1);
assert.strictEqual(built.summary.excluded, 1);
assert.strictEqual(built.rows[0]['采集范围内'], '是');
assert.strictEqual(built.rows[2]['采集范围内'], '否');
assert.strictEqual(built.rows[2]['排除原因'], '报价高');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-sheet-'));
const outPath = path.join(tmp, '候选初筛表.xlsx');
const exported = exportCandidateWorkbook(input, outPath);
assert.ok(fs.existsSync(outPath));
assert.strictEqual(exported.candidates, 3);
assert.strictEqual(exported.inScope, 2);

const wb = XLSX.readFile(outPath);
assert.ok(wb.SheetNames.includes('候选初筛表'));
assert.ok(wb.SheetNames.includes('筛选条件'));
const rows = XLSX.utils.sheet_to_json(wb.Sheets['候选初筛表']);
assert.strictEqual(rows[0]['达人/备注'], '达人A');
assert.strictEqual(rows[2]['状态'], '排除');
const criteriaRows = XLSX.utils.sheet_to_json(wb.Sheets['筛选条件']);
assert.strictEqual(criteriaRows.find((row) => row['字段'] === '任务来源')['值'], '蒲公英搜索发现');

console.log('candidate_sheet.test.js OK');
