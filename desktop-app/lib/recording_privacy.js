const SENSITIVE_AUTOCOMPLETE = new Set([
  'current-password',
  'new-password',
  'one-time-code',
  'username',
  'email',
  'tel'
]);
const SENSITIVE_HINT = /password|passwd|passcode|one.?time|otp|captcha|verification|verify|sms.?code|phone|mobile|e-?mail|user.?name|验证码|校验码|动态码|密码|手机号|手机号码|邮箱|账号/i;

function isSensitiveInputDescriptor(descriptor = {}) {
  const type = String(descriptor.type || '').trim().toLowerCase();
  if (['password', 'tel', 'email'].includes(type)) return true;

  const autocomplete = String(descriptor.autocomplete || '').trim().toLowerCase();
  if (SENSITIVE_AUTOCOMPLETE.has(autocomplete)) return true;

  return [
    descriptor.name,
    descriptor.id,
    descriptor.ariaLabel,
    descriptor.placeholder
  ].some((value) => SENSITIVE_HINT.test(String(value || '')));
}

function isSensitiveInputElement(element) {
  if (!element || typeof element.getAttribute !== 'function') return false;
  return isSensitiveInputDescriptor({
    type: element.getAttribute('type'),
    autocomplete: element.getAttribute('autocomplete'),
    name: element.getAttribute('name'),
    id: element.id,
    ariaLabel: element.getAttribute('aria-label'),
    placeholder: element.getAttribute('placeholder')
  });
}

module.exports = {
  isSensitiveInputDescriptor,
  isSensitiveInputElement
};
