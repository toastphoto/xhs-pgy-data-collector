const assert = require('assert');

const {
  approveRequest,
  buildXiaomifengApprovalPayload,
  checkApproval,
  createApprovalRequest,
  executionFingerprint
} = require('../lib/execution_approval');

const payload = {
  runKey: 'run_demo',
  channel: 'wechat_xiaomifeng',
  recipients: [
    { rowId: 'b', creatorName: '达人B', destination: 'wx_b', channel: 'wechat_xiaomifeng' },
    { rowId: 'a', creatorName: '达人A', destination: 'wx_a', channel: 'wechat_xiaomifeng' }
  ],
  message: { body: '您好，想沟通合作。' },
  executor: { taskAccount: '', smartRemark: '{MMDD}-{昵称}', tag: '品牌A' }
};

const reordered = { ...payload, recipients: [...payload.recipients].reverse() };
assert.strictEqual(executionFingerprint(payload), executionFingerprint(reordered));

const pending = createApprovalRequest(payload, '提交人');
assert.strictEqual(pending.status, 'pending_approval');
assert.strictEqual(checkApproval(pending, payload).ok, false);

const approved = approveRequest(pending, '审批人');
assert.strictEqual(approved.status, 'approved');
assert.strictEqual(checkApproval(approved, payload).ok, true);

const changedMessage = { ...payload, message: { body: '已修改的话术' } };
assert.strictEqual(checkApproval(approved, changedMessage).code, 'APPROVAL_STALE');
const changedRecipients = { ...payload, recipients: payload.recipients.slice(0, 1) };
assert.strictEqual(checkApproval(approved, changedRecipients).code, 'APPROVAL_STALE');

assert.throws(() => approveRequest(pending, ''), /确认人/);
assert.throws(() => createApprovalRequest({ channel: 'wechat_xiaomifeng', recipients: [] }), /收件人/);

const xmfPayload = buildXiaomifengApprovalPayload('run_demo', [
  { rowId: 'wx', selected: true, creatorName: '微信达人', contactChannel: '微信建联', wechatId: 'wx_demo' },
  { rowId: 'auto', selected: true, creatorName: '自动达人', contactChannel: '自动分流', phone: '13800000000' },
  { rowId: 'mail', selected: true, creatorName: '邮件达人', contactChannel: '邮件建联', wechatId: 'wx_mail' },
  { rowId: 'excluded', selected: false, creatorName: '排除达人', contactChannel: '微信建联', wechatId: 'wx_excluded' }
], { defaultGreeting: '你好', defaultGroupTag: '品牌A' });
assert.deepStrictEqual(xmfPayload.recipients.map((row) => row.rowId), ['wx', 'auto']);
assert.strictEqual(xmfPayload.message.body, '你好');
assert.strictEqual(xmfPayload.executor.smartRemark, '{MMDD}-{昵称}');

console.log('execution_approval.test.js OK');
