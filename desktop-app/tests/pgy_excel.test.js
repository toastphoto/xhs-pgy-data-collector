const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { exportCandidateWorkbook } = require('../lib/candidate_sheet');
const { normalizeStatus, parseExcelToPgyItems } = require('../lib/pgy_excel');

assert.strictEqual(normalizeStatus('优先'), 'selected');
assert.strictEqual(normalizeStatus('排除'), 'excluded');
assert.strictEqual(normalizeStatus(''), 'candidate');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pgy-excel-'));
const filePath = path.join(tmp, '候选初筛表.xlsx');

exportCandidateWorkbook(
  {
    taskName: 'FILA 搜索',
    collectionScope: 'active',
    candidates: [
      {
        pgy_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a',
        creator_name: '达人A',
        status: 'selected',
        priority: 'P1',
        note: '先看'
      },
      {
        pgy_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/b',
        creator_name: '达人B',
        status: 'excluded',
        excludeReason: '报价高',
        note: '不跑'
      }
    ]
  },
  filePath
);

const parsed = parseExcelToPgyItems(filePath);
assert.ok(parsed.ok);
assert.strictEqual(parsed.items.length, 2);
assert.strictEqual(parsed.items[0].creator_name, '达人A');
assert.strictEqual(parsed.items[0].status, 'selected');
assert.strictEqual(parsed.items[0].priority, 'P1');
assert.strictEqual(parsed.items[0].note, '先看');
assert.strictEqual(parsed.items[1].status, 'excluded');
assert.strictEqual(parsed.items[1].excludeReason, '报价高');
assert.strictEqual(parsed.items[1].note, '不跑');

console.log('pgy_excel.test.js OK');
