const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getReviewPath,
  loadContactReview,
  makeRunKey,
  normalizeReviewRows,
  saveContactReview
} = require('../lib/contact_review_store');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ca-contact-review-'));
const runDir = '/tmp/runs/run_2026-06-30T00-00-00-000Z';

assert.strictEqual(makeRunKey(runDir), 'run_2026-06-30T00-00-00-000Z');
assert.ok(getReviewPath(tmp, runDir).endsWith('run_2026-06-30T00-00-00-000Z.json'));

const normalized = normalizeReviewRows([
  { rowId: 'a', selected: false, followupStatus: ' 不建联 ', priority: ' P1 ', excludeReason: ' 报价高 ', note: ' 先不联系 ', email: ' a@example.com ', wechatId: ' wx ', phone: ' 123 ', contactChannel: ' 邮件 ' },
  { rowId: 'a', selected: true },
  { rowId: '' }
]);
assert.strictEqual(normalized.length, 1);
assert.strictEqual(normalized[0].selected, false);
assert.strictEqual(normalized[0].followupStatus, '不建联');
assert.strictEqual(normalized[0].priority, 'P1');
assert.strictEqual(normalized[0].excludeReason, '报价高');
assert.strictEqual(normalized[0].email, 'a@example.com');
assert.strictEqual(normalized[0].wechatId, 'wx');
assert.strictEqual(normalized[0].contactChannel, '邮件建联');

let loaded = loadContactReview(tmp, runDir);
assert.deepStrictEqual(loaded.reviewRows, []);

const saved = saveContactReview(tmp, runDir, {
  reviewRows: normalized,
  settings: { defaultGroupTag: 'FILA', defaultGreeting: 'hello', contactChannel: '' }
});
assert.ok(saved.updatedAt);
assert.strictEqual(saved.settings.defaultGroupTag, 'FILA');
assert.strictEqual(saved.settings.contactChannel, '微信建联');

loaded = loadContactReview(tmp, runDir);
assert.strictEqual(loaded.reviewRows.length, 1);
assert.strictEqual(loaded.reviewRows[0].note, '先不联系');
assert.strictEqual(loaded.reviewRows[0].followupStatus, '不建联');
assert.strictEqual(loaded.settings.defaultGreeting, 'hello');

console.log('contact_review_store.test.js OK');
