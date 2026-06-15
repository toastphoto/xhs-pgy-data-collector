const assert = require('assert');
const { buildQualityReport, isFilled } = require('../lib/quality_report');

assert.strictEqual(isFilled('1'), true);
assert.strictEqual(isFilled('--'), false);
assert.strictEqual(isFilled('  '), false);

const report = buildQualityReport({
  creator_summary: {
    creator_name: '测试达人',
    creator_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/abc'
  },
  metrics: { '粉丝数': '1.2万' },
  pages: [{ name: '0_达人详情页', evidence: { screenshot: 'a.png' } }, { name: 'tab_粉丝分析', ok: false, reason: 'not_found' }],
  notes_top10: []
});

assert.strictEqual(report.ok, false);
assert.strictEqual(report.missingCreatorFields.length, 1);
assert.strictEqual(report.missingCreatorFields[0].key, 'xhs_id');
assert.strictEqual(report.missingMetrics.length, 2);
assert.strictEqual(report.failedPages.length, 1);
assert.ok(report.score < 100);

const good = buildQualityReport({
  creator_summary: {
    creator_name: '测试达人',
    xhs_id: 'xhs_001',
    creator_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/abc'
  },
  metrics: { '粉丝数': '1.2万', '图文笔记一口价': '¥3000', '视频笔记一口价': '¥5000' },
  pages: [{ name: '0_达人详情页' }],
  notes_top10: [{ '标题': '笔记' }]
});

assert.strictEqual(good.ok, true);
assert.strictEqual(good.missingCount, 0);

console.log('quality_report.test.js OK');
