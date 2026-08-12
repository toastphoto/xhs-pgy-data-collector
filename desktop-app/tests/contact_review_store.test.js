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
  { rowId: 'a', selected: false, followupStatus: ' 不建联 ', priority: ' P1 ', excludeReason: ' 报价高 ', note: ' 先不联系 ', email: ' a@example.com ', wechatId: ' wx ', phone: ' 123 ', xhsProfileUrl: ' https://www.xiaohongshu.com/user/profile/demo ', xhsProfileSourceCreatorUrl: ' https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/pgy-demo ', contactSource: ' xiaohongshu_public_profile ', contactCollectedAt: ' 2026-07-20T00:00:00.000Z ', contactCollectionStatus: ' profile_unavailable ', contactCollectionCode: ' XHS_PROFILE_NOT_READY ', contactCollectionError: ' 主页未加载完整 ', contactChannel: ' 邮件 ' },
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
assert.strictEqual(normalized[0].xhsProfileUrl, 'https://www.xiaohongshu.com/user/profile/demo');
assert.strictEqual(normalized[0].xhsProfileSourceCreatorUrl, 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/pgy-demo');
assert.strictEqual(normalized[0].contactSource, 'xiaohongshu_public_profile');
assert.strictEqual(normalized[0].contactCollectionStatus, 'profile_unavailable');
assert.strictEqual(normalized[0].contactCollectionCode, 'XHS_PROFILE_NOT_READY');
assert.strictEqual(normalized[0].contactCollectionError, '主页未加载完整');
assert.strictEqual(normalized[0].contactChannel, '邮件建联');
assert.strictEqual(normalizeReviewRows([{ rowId: 'new-row' }])[0].selected, false);

let loaded = loadContactReview(tmp, runDir);
assert.deepStrictEqual(loaded.reviewRows, []);

const saved = saveContactReview(tmp, runDir, {
  reviewRows: normalized,
  settings: { defaultGroupTag: 'FILA', defaultGreeting: 'hello', contactChannel: '', xiaomifengSmartRemark: '{YYMMDD}-{昵称}', xiaomifengTaskWechat: '运营微信A', selectionPolicy: 'manual_opt_in_v1' }
});
assert.ok(saved.updatedAt);
assert.strictEqual(saved.settings.defaultGroupTag, 'FILA');
assert.strictEqual(saved.settings.contactChannel, '微信建联');
assert.strictEqual(saved.settings.xiaomifengSmartRemark, '{YYMMDD}-{昵称}');
assert.strictEqual(saved.settings.xiaomifengTaskWechat, '运营微信A');
assert.strictEqual(saved.settings.selectionPolicy, 'manual_opt_in_v1');

loaded = loadContactReview(tmp, runDir);
assert.strictEqual(loaded.reviewRows.length, 1);
assert.strictEqual(loaded.reviewRows[0].note, '先不联系');
assert.strictEqual(loaded.reviewRows[0].followupStatus, '不建联');
assert.strictEqual(loaded.settings.defaultGreeting, 'hello');

console.log('contact_review_store.test.js OK');
