const assert = require('assert');
const {
  PgyCandidateResponseCache,
  extractPgyCandidateSources,
  normalizePgyCandidateRecord
} = require('../lib/pgy_candidate_response_cache');

const creator = (id, name) => ({
  userId: id,
  name,
  fansNum: 310000,
  clickMidNum: 8903,
  mEngagementNum: 239
});

assert.strictEqual(normalizePgyCandidateRecord({ id: 'setting-1', name: '筛选条件' }), null);
assert.strictEqual(
  normalizePgyCandidateRecord(creator('creator0001', '达人A')).pgy_url,
  'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/creator0001'
);

const payload = {
  success: true,
  data: {
    total: 5000,
    list: [creator('creator0001', '达人A'), creator('creator0002', '达人B')]
  }
};
const sources = extractPgyCandidateSources(payload);
assert.strictEqual(sources[0].rows.length, 2);
assert.deepStrictEqual(sources[0].rows.map((row) => row.creator_name), ['达人A', '达人B']);

const cache = new PgyCandidateResponseCache({ maxAgeMs: 5000 });
assert.strictEqual(cache.capture(payload, 1000).captured, 2);
assert.deepStrictEqual(cache.latest(1, 2000).items.map((row) => row.creator_name), ['达人A']);
assert.strictEqual(cache.latest(1, 7000), null);

console.log('pgy_candidate_response_cache.test.js OK');
