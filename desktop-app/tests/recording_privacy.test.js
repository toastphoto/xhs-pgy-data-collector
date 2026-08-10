const assert = require('assert');
const { isSensitiveInputDescriptor } = require('../lib/recording_privacy');

assert.strictEqual(isSensitiveInputDescriptor({ type: 'password' }), true);
assert.strictEqual(isSensitiveInputDescriptor({ autocomplete: 'one-time-code' }), true);
assert.strictEqual(isSensitiveInputDescriptor({ placeholder: '请输入短信验证码' }), true);
assert.strictEqual(isSensitiveInputDescriptor({ name: 'accountEmail' }), true);
assert.strictEqual(isSensitiveInputDescriptor({ type: 'tel' }), true);
assert.strictEqual(isSensitiveInputDescriptor({ name: 'keyword', placeholder: '搜索达人' }), false);
assert.strictEqual(isSensitiveInputDescriptor({ name: 'budget', type: 'number' }), false);

console.log('recording_privacy.test.js OK');
