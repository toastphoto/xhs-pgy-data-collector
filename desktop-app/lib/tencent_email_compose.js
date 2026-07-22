const TENCENT_MAIL_HOME_URL = 'https://work.weixin.qq.com/mail/';
const MAX_TENCENT_EMAIL_RECIPIENTS = 20;

const EMAIL_RE = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

function normalizeTencentEmailRecipients(values, max = MAX_TENCENT_EMAIL_RECIPIENTS) {
  const recipients = [];
  const invalid = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const email = String(value || '').trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email) || /[\r\n]/.test(email)) {
      invalid.push(String(value || '').trim());
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    recipients.push(email);
  }
  if (recipients.length > max) {
    return {
      ok: false,
      code: 'EMAIL_RECIPIENT_LIMIT',
      error: `为降低误发和邮箱风控风险，单次最多准备 ${max} 位收件人`,
      recipients: [],
      invalid
    };
  }
  if (!recipients.length) {
    return {
      ok: false,
      code: invalid.length ? 'EMAIL_RECIPIENT_INVALID' : 'EMAIL_RECIPIENT_EMPTY',
      error: invalid.length ? '所选达人没有可用的有效邮箱' : '没有选择带邮箱的达人',
      recipients: [],
      invalid
    };
  }
  return { ok: true, recipients, invalid };
}

function isAllowedTencentMailUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'work.weixin.qq.com' || host.endsWith('.work.weixin.qq.com') ||
      host === 'exmail.qq.com' || host.endsWith('.exmail.qq.com');
  } catch (_) {
    return false;
  }
}

module.exports = {
  MAX_TENCENT_EMAIL_RECIPIENTS,
  TENCENT_MAIL_HOME_URL,
  isAllowedTencentMailUrl,
  normalizeTencentEmailRecipients
};
