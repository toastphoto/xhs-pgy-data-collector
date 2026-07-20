const crypto = require('crypto');

const APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending_approval',
  APPROVED: 'approved',
  INVALIDATED: 'invalidated'
});

function cleanStr(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stableValue(value[key]);
    return out;
  }, {});
}

function normalizeExecutionPayload(input = {}) {
  const recipients = (Array.isArray(input.recipients) ? input.recipients : [])
    .map((row) => ({
      rowId: cleanStr(row?.rowId),
      creatorName: cleanStr(row?.creatorName),
      destination: cleanStr(row?.destination),
      channel: cleanStr(row?.channel || input.channel)
    }))
    .filter((row) => row.rowId && row.destination)
    .sort((a, b) => a.rowId.localeCompare(b.rowId));

  return {
    runKey: cleanStr(input.runKey),
    channel: cleanStr(input.channel),
    recipients,
    message: {
      subject: cleanStr(input.message?.subject),
      body: cleanStr(input.message?.body)
    },
    executor: {
      taskAccount: cleanStr(input.executor?.taskAccount),
      smartRemark: cleanStr(input.executor?.smartRemark),
      tag: cleanStr(input.executor?.tag)
    }
  };
}

function executionFingerprint(input) {
  const payload = normalizeExecutionPayload(input);
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(payload))).digest('hex');
}

function buildXiaomifengApprovalPayload(runKey, rows, settings = {}) {
  const recipients = (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      if (row?.selected === false) return false;
      const channel = cleanStr(row?.contactChannel || settings.contactChannel);
      const hasWechat = Boolean(cleanStr(row?.wechatId || row?.phone));
      if (!hasWechat) return false;
      return /微信|小蜜蜂|wechat|xmf/i.test(channel) || /自动|auto/i.test(channel);
    })
    .map((row) => ({
      rowId: cleanStr(row?.rowId),
      creatorName: cleanStr(row?.creatorName),
      destination: cleanStr(row?.wechatId || row?.phone),
      channel: 'wechat_xiaomifeng'
    }));
  return {
    runKey: cleanStr(runKey),
    channel: 'wechat_xiaomifeng',
    recipients,
    message: { body: cleanStr(settings.defaultGreeting) },
    executor: {
      taskAccount: cleanStr(settings.xiaomifengTaskWechat),
      smartRemark: cleanStr(settings.xiaomifengSmartRemark || '{MMDD}-{昵称}'),
      tag: cleanStr(settings.defaultGroupTag)
    }
  };
}

function createApprovalRequest(input, requestedBy = '') {
  const payload = normalizeExecutionPayload(input);
  if (!payload.channel) throw new Error('审批批次缺少执行渠道');
  if (!payload.recipients.length) throw new Error('审批批次没有可执行收件人');
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    approvalId: `approval_${executionFingerprint(payload).slice(0, 16)}_${Date.now()}`,
    status: APPROVAL_STATUS.PENDING,
    fingerprint: executionFingerprint(payload),
    requestedBy: cleanStr(requestedBy),
    requestedAt: now,
    approvedBy: '',
    approvedAt: '',
    invalidatedAt: '',
    invalidatedReason: '',
    payload
  };
}

function approveRequest(request, approver) {
  const name = cleanStr(approver);
  if (!name) throw new Error('必须填写人工确认人');
  if (!request || request.status !== APPROVAL_STATUS.PENDING) throw new Error('只有待审批批次可以批准');
  return {
    ...request,
    status: APPROVAL_STATUS.APPROVED,
    approvedBy: name,
    approvedAt: new Date().toISOString()
  };
}

function checkApproval(request, currentInput) {
  if (!request) return { ok: false, code: 'APPROVAL_REQUIRED', error: '尚未提交人工审批' };
  if (request.status !== APPROVAL_STATUS.APPROVED) {
    return { ok: false, code: 'APPROVAL_NOT_APPROVED', error: '当前批次尚未人工批准' };
  }
  const currentFingerprint = executionFingerprint(currentInput);
  if (currentFingerprint !== request.fingerprint) {
    return { ok: false, code: 'APPROVAL_STALE', error: '名单、渠道、话术或执行账号已变化，必须重新审批', currentFingerprint };
  }
  return { ok: true, fingerprint: currentFingerprint };
}

function invalidateRequest(request, reason = '执行内容已变化') {
  if (!request) return null;
  return {
    ...request,
    status: APPROVAL_STATUS.INVALIDATED,
    invalidatedAt: new Date().toISOString(),
    invalidatedReason: cleanStr(reason)
  };
}

module.exports = {
  APPROVAL_STATUS,
  approveRequest,
  buildXiaomifengApprovalPayload,
  checkApproval,
  createApprovalRequest,
  executionFingerprint,
  invalidateRequest,
  normalizeExecutionPayload
};
