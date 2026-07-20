const crypto = require('crypto');

const FEISHU_TABLES = Object.freeze({
  tasks: ['task_id', 'task_name', 'owner', 'status', 'search_criteria', 'updated_at'],
  task_creators: ['task_creator_id', 'task_id', 'creator_id', 'creator_name', 'channel', 'review_status', 'followup_status', 'updated_at'],
  execution_batches: ['batch_id', 'task_id', 'channel', 'recipient_count', 'message_version', 'approval_status', 'execution_status', 'updated_at'],
  approvals: ['approval_id', 'batch_id', 'fingerprint', 'approver', 'approved_at', 'status', 'updated_at'],
  send_events: ['event_id', 'batch_id', 'creator_id', 'channel', 'result', 'external_id', 'error_code', 'occurred_at'],
  reply_events: ['event_id', 'batch_id', 'creator_id', 'channel', 'reply_status', 'reply_summary', 'occurred_at']
});

const FEISHU_SYNC_EVENT_TYPES = Object.freeze([
  'upsert_task',
  'upsert_task_creator',
  'upsert_execution_batch',
  'upsert_approval',
  'append_send_event',
  'append_reply_event'
]);

function cleanStr(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function buildFeishuSyncEnvelope(eventType, payload, options = {}) {
  const type = cleanStr(eventType);
  if (!FEISHU_SYNC_EVENT_TYPES.includes(type)) throw new Error(`不支持的飞书同步事件：${type || '(empty)'}`);
  const body = payload && typeof payload === 'object' ? payload : {};
  const occurredAt = cleanStr(options.occurredAt) || new Date().toISOString();
  const idSource = JSON.stringify({ type, body, occurredAt });
  return {
    schemaVersion: 1,
    eventId: `fs_${crypto.createHash('sha256').update(idSource).digest('hex').slice(0, 20)}`,
    eventType: type,
    occurredAt,
    status: 'pending',
    payload: body
  };
}

function validateFeishuRecord(tableKey, record = {}) {
  const fields = FEISHU_TABLES[tableKey];
  if (!fields) return { ok: false, error: `未知飞书表：${tableKey}` };
  const unknownFields = Object.keys(record).filter((key) => !fields.includes(key));
  return { ok: unknownFields.length === 0, fields, unknownFields };
}

module.exports = {
  FEISHU_SYNC_EVENT_TYPES,
  FEISHU_TABLES,
  buildFeishuSyncEnvelope,
  validateFeishuRecord
};
