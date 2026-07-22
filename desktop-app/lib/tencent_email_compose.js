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

function buildTencentRecipientPrefillScript(recipients) {
  const safeRecipients = normalizeTencentEmailRecipients(recipients);
  if (!safeRecipients.ok) throw new Error(safeRecipients.error);
  return `
    (async function(){
      const recipients = ${JSON.stringify(safeRecipients.recipients)};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const visible = (el) => {
        try {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        } catch (_) { return false; }
      };
      const documents = [document];
      Array.from(document.querySelectorAll('iframe')).forEach((frame) => {
        try {
          if (frame.contentDocument) documents.push(frame.contentDocument);
        } catch (_) {}
      });
      const pageText = documents.map((doc) => String(doc.body?.innerText || '')).join('\n').slice(0, 30000);
      if (/安全验证|异常登录|账号异常|操作频繁|访问受限|验证码/.test(pageText)) {
        return { ok: false, status: 'risk_detected' };
      }
      const loginLink = documents.flatMap((doc) => Array.from(doc.querySelectorAll('a[href]')))
        .find((el) => /(?:^|\/)login(?:[/?#]|$)/i.test(String(el.getAttribute('href') || '')));
      if (loginLink || /扫码登录|企业微信扫码|微信扫码/.test(pageText) || /\/login/i.test(location.pathname)) {
        return { ok: true, status: 'login_required' };
      }

      const recipientHints = /收件人|recipient|addressee|(^|[_-])to([_-]|$)/i;
      const recipientCandidates = [];
      for (const doc of documents) {
        const nodes = Array.from(doc.querySelectorAll('input, textarea, [contenteditable="true"]'));
        for (const el of nodes) {
          if (!visible(el) || el.disabled || el.readOnly) continue;
          const hint = [
            el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.getAttribute('name'),
            el.id, el.className, el.getAttribute('data-testid'), el.parentElement?.innerText
          ].filter(Boolean).join(' ').slice(0, 500);
          if (!recipientHints.test(hint)) continue;
          recipientCandidates.push({ el, score: /收件人/i.test(hint) ? 100 : 60 });
        }
      }

      recipientCandidates.sort((a, b) => b.score - a.score);
      const target = recipientCandidates[0]?.el;
      if (target) {
        const joined = recipients.join('; ');
        target.focus();
        if (target.isContentEditable) {
          target.textContent = joined;
        } else {
          const proto = target.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(target, joined);
          else target.value = joined;
        }
        target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: joined }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(120);
        return { ok: true, status: 'recipients_filled', recipientCount: recipients.length };
      }

      const writeLabels = ['写信', '写邮件', '新建邮件'];
      const clickable = [];
      for (const doc of documents) {
        const nodes = Array.from(doc.querySelectorAll('button, a, [role="button"]'));
        for (const el of nodes) {
          if (!visible(el)) continue;
          const text = String(el.innerText || el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, '').trim();
          if (writeLabels.includes(text)) clickable.push(el);
        }
      }
      if (clickable[0]) {
        clickable[0].click();
        return { ok: true, status: 'compose_opening' };
      }

      return { ok: true, status: 'mailbox_loading' };
    })()
  `;
}

module.exports = {
  MAX_TENCENT_EMAIL_RECIPIENTS,
  TENCENT_MAIL_HOME_URL,
  buildTencentRecipientPrefillScript,
  isAllowedTencentMailUrl,
  normalizeTencentEmailRecipients
};
