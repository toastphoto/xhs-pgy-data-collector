const assert = require('assert');

const {
  FEISHU_TABLES,
  buildFeishuSyncEnvelope,
  validateFeishuRecord
} = require('../lib/feishu_contracts');

assert.deepStrictEqual(Object.keys(FEISHU_TABLES), [
  'tasks',
  'task_creators',
  'execution_batches',
  'approvals',
  'send_events',
  'reply_events'
]);

const valid = validateFeishuRecord('approvals', {
  approval_id: 'a1',
  batch_id: 'b1',
  fingerprint: 'fp',
  approver: '用户',
  approved_at: '2026-07-15T00:00:00Z',
  status: 'approved',
  updated_at: '2026-07-15T00:00:00Z'
});
assert.strictEqual(valid.ok, true);
assert.strictEqual(validateFeishuRecord('approvals', { unexpected: true }).ok, false);

const envelope = buildFeishuSyncEnvelope('append_send_event', { event_id: 'e1' }, { occurredAt: '2026-07-15T00:00:00Z' });
assert.strictEqual(envelope.eventType, 'append_send_event');
assert.strictEqual(envelope.status, 'pending');
assert.throws(() => buildFeishuSyncEnvelope('send_now', {}), /不支持/);

console.log('feishu_contracts.test.js OK');
