const assert = require('assert');
const {
  cleanNumber,
  normalizeCandidateUrls,
  normalizeCandidates,
  normalizeCollectionScope,
  normalizeSearchCriteria,
  normalizeSigningTask,
  normalizeSourceMode,
  summarizeSearchCriteria
} = require('../lib/signing_task');

assert.strictEqual(cleanNumber('20'), 20);
assert.strictEqual(cleanNumber('1,200'), 1200);
assert.strictEqual(cleanNumber('abc'), '');
assert.strictEqual(cleanNumber(''), '');

const criteria = normalizeSearchCriteria({
  track: ' 中外生活 ',
  followersMinWan: '20',
  followersMaxWan: '30',
  priceMin: '1,000',
  priceMax: '30000',
  orders90dMin: '1',
  readUnitPriceMax: '3'
});

assert.strictEqual(criteria.track, '中外生活');
assert.strictEqual(criteria.followersMinWan, 20);
assert.strictEqual(criteria.priceMin, 1000);
assert.strictEqual(criteria.readUnitPriceMax, 3);

const text = summarizeSearchCriteria(criteria);
assert.ok(text.includes('赛道类型: 中外生活'));
assert.ok(text.includes('粉丝量下限(万): 20'));

const candidates = normalizeCandidates([
  { pgy_url: 'pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a', creator_name: ' 达人A ', status: 'selected', priority: 'P1' },
  { pgy_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a', creator_name: '重复' },
  { url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/b', note: '优先看报价', status: 'excluded', excludeReason: '不匹配' },
  { url: '' }
]);

assert.strictEqual(candidates.length, 2);
assert.strictEqual(candidates[0].pgy_url, 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a');
assert.strictEqual(candidates[0].creator_name, '达人A');
assert.strictEqual(candidates[0].status, 'selected');
assert.strictEqual(candidates[0].priority, 'P1');
assert.strictEqual(candidates[1].note, '优先看报价');
assert.strictEqual(candidates[1].status, 'excluded');
assert.strictEqual(candidates[1].excludeReason, '不匹配');
assert.strictEqual(normalizeCollectionScope('selected'), 'selected');
assert.strictEqual(normalizeCollectionScope('latest_segment'), 'latest_segment');
assert.strictEqual(normalizeCollectionScope('bad'), 'active');
assert.deepStrictEqual(
  normalizeCandidateUrls(['pgy.xiaohongshu.com/a', 'pgy.xiaohongshu.com/a', 'https://pgy.xiaohongshu.com/b']),
  ['https://pgy.xiaohongshu.com/a', 'https://pgy.xiaohongshu.com/b']
);
assert.strictEqual(normalizeSourceMode('search'), 'search');
assert.strictEqual(normalizeSourceMode('bad'), 'import');

const task = normalizeSigningTask({
  taskName: '',
  sourceMode: 'search',
  channels: { pgy: true, xhs: true },
  contactPlan: { pgyInvite: true },
  collectionScope: 'selected',
  latestSegmentUrls: ['pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a'],
  searchCriteria: criteria,
  candidates
});

assert.strictEqual(task.taskName, '未命名签约任务');
assert.strictEqual(task.sourceMode, 'search');
assert.strictEqual(task.channels.pgy, true);
assert.strictEqual(task.channels.xhs, true);
assert.strictEqual(task.contactPlan.pgyInvite, true);
assert.strictEqual(task.collectionScope, 'selected');
assert.deepStrictEqual(task.latestSegmentUrls, ['https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a']);
assert.ok(task.searchCriteriaText.includes('报价上限: 30000'));
assert.strictEqual(task.candidates.length, 2);

console.log('signing_task.test.js OK');
