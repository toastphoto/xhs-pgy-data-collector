const assert = require('assert');
const { normalizeBaseUrl } = require('../lib/ai/providers');

assert.strictEqual(normalizeBaseUrl('https://api.openai.com'), 'https://api.openai.com');
assert.strictEqual(normalizeBaseUrl('https://api.openai.com/'), 'https://api.openai.com');
assert.strictEqual(normalizeBaseUrl('https://api.openai.com/v1'), 'https://api.openai.com');
assert.strictEqual(normalizeBaseUrl('https://ai.comfly.chat/v1/'), 'https://ai.comfly.chat');

console.log('providers.test.js OK');

