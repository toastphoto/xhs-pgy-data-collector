const assert = require('assert');
const {
  MAX_TENCENT_EMAIL_RECIPIENTS,
  TENCENT_MAIL_HOME_URL,
  buildTencentRecipientPrefillScript,
  isAllowedTencentMailUrl,
  normalizeTencentEmailRecipients
} = require('../lib/tencent_email_compose');

const normalized = normalizeTencentEmailRecipients([
  ' Creator@One.Example ',
  'creator@one.example',
  'second@example.com',
  'bad\n@example.com'
]);
assert.strictEqual(normalized.ok, true);
assert.deepStrictEqual(normalized.recipients, ['creator@one.example', 'second@example.com']);
assert.strictEqual(normalized.invalid.length, 1);

const tooMany = normalizeTencentEmailRecipients(
  Array.from({ length: MAX_TENCENT_EMAIL_RECIPIENTS + 1 }, (_, index) => `creator${index}@example.com`)
);
assert.strictEqual(tooMany.ok, false);
assert.strictEqual(tooMany.code, 'EMAIL_RECIPIENT_LIMIT');

assert.strictEqual(isAllowedTencentMailUrl(TENCENT_MAIL_HOME_URL), true);
assert.strictEqual(isAllowedTencentMailUrl('https://exmail.qq.com/login'), true);
assert.strictEqual(isAllowedTencentMailUrl('https://open.work.weixin.qq.com/wwopen/sso/login'), true);
assert.strictEqual(isAllowedTencentMailUrl('http://work.weixin.qq.com/mail/'), false);
assert.strictEqual(isAllowedTencentMailUrl('https://work.weixin.qq.com.evil.example/mail/'), false);
assert.strictEqual(isAllowedTencentMailUrl('https://mail.qq.com/'), false);

const script = buildTencentRecipientPrefillScript(['creator@example.com']);
assert.ok(script.includes('creator@example.com'));
assert.ok(script.includes('recipients_filled'));
assert.ok(script.includes("['写信', '写邮件', '新建邮件']"));
assert.ok(script.includes('login_required'));
assert.ok(!script.includes('发送'));
assert.ok(!script.includes("writeLabels = ['发送'"));
assert.ok(!script.includes("textContent = '发送'"));
assert.ok(!script.includes('ctrlKey: true'));
assert.ok(!script.includes('metaKey: true'));

console.log('tencent_email_compose.test.js passed');
