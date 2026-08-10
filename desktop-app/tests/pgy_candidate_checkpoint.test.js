const assert = require('assert');
const {
  PGY_CANDIDATE_CHECKPOINT_WAIT_MS,
  assessCheckpointWindow,
  buildCheckpointWindow,
  findCheckpointBeforeNextPage,
  findPendingCheckpoint
} = require('../lib/pgy_candidate_checkpoint');

assert.strictEqual(PGY_CANDIDATE_CHECKPOINT_WAIT_MS, 90_000);
assert.strictEqual(findPendingCheckpoint({ available: 39, endRank: 50 }), null);
assert.strictEqual(findPendingCheckpoint({ available: 40, endRank: 50 }), 40);
assert.strictEqual(findPendingCheckpoint({ available: 40, endRank: 40 }), null);
assert.strictEqual(findPendingCheckpoint({ available: 80, endRank: 100, waitedCheckpoints: [40] }), 80);
assert.strictEqual(findPendingCheckpoint({ available: 100, endRank: 100, waitedCheckpoints: [40, 80] }), null);
assert.strictEqual(findCheckpointBeforeNextPage({ available: 20, nextPageSize: 20, endRank: 50 }), null);
assert.strictEqual(findCheckpointBeforeNextPage({ available: 25, nextPageSize: 25, endRank: 50 }), 40);
assert.strictEqual(findCheckpointBeforeNextPage({ available: 30, nextPageSize: 30, endRank: 50 }), 40);
assert.strictEqual(findCheckpointBeforeNextPage({
  available: 25,
  nextPageSize: 25,
  endRank: 50,
  waitedCheckpoints: [40]
}), null);

const window = buildCheckpointWindow(1_000);
assert.deepStrictEqual(window, {
  createdAt: 1_000,
  readyAt: 91_000,
  expiresAt: 301_000
});
assert.strictEqual(assessCheckpointWindow(window, 90_999).code, 'PGY_CANDIDATE_CHECKPOINT_COOLDOWN');
assert.deepStrictEqual(assessCheckpointWindow(window, 91_000), { ok: true, remainingMs: 0 });
assert.strictEqual(assessCheckpointWindow(window, 301_001).code, 'PGY_CANDIDATE_CHECKPOINT_EXPIRED');

console.log('pgy_candidate_checkpoint.test.js passed');
