const { test } = require('node:test');
const assert = require('node:assert/strict');
const { exchangePluginToken } = require('../lib/feishu_plugin_auth');
const config = { pluginId: 'test-plugin', pluginSecret: 'fixture-only' };
const success = () => new Response(JSON.stringify({
  error: { code: 0 }, data: { token: 'p-fixture-only', expire_time: 7200 }
}));

test('fixed official destination, production token and no credential redirect', async () => {
  const auth = await exchangePluginToken({ ...config, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://project.feishu.cn/open_api/authen/plugin_token');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {
      plugin_id: config.pluginId, plugin_secret: config.pluginSecret, type: 0
    });
    return success();
  } });
  assert.deepEqual(auth, { token: 'p-fixture-only', expiresIn: 7200 });
});

for (const [name, response, code] of [
  ['redirect', () => new Response('', { status: 302 }), 'FEISHU_AUTH_REDIRECT'],
  ['http failure', () => new Response('private', { status: 403 }), 'FEISHU_AUTH_HTTP'],
  ['business error', () => new Response(JSON.stringify({error:{code:17,msg:'private'}})), 'FEISHU_AUTH_API'],
  ['wrong envelope', () => new Response('{"err_code":0}'), 'FEISHU_AUTH_RESPONSE_INVALID'],
  ['invalid json', () => new Response('private'), 'FEISHU_AUTH_RESPONSE_INVALID'],
  ['oversize', () => new Response('a'.repeat(65537)), 'FEISHU_AUTH_RESPONSE_TOO_LARGE'],
  ['virtual token', () => new Response(JSON.stringify({error:{code:0},data:{token:'v-no',expire_time:60}})), 'FEISHU_AUTH_RESPONSE_INVALID'],
  ['expired token', () => new Response(JSON.stringify({error:{code:0},data:{token:'p-no',expire_time:0}})), 'FEISHU_AUTH_RESPONSE_INVALID'],
]) {
  test(name, async () => {
    await assert.rejects(exchangePluginToken({ ...config, fetchImpl: async () => response() }),
      error => error.code === code && !JSON.stringify(error).includes('private'));
  });
}

test('transport exception text is suppressed', async () => {
  await assert.rejects(exchangePluginToken({ ...config, fetchImpl: async () => {
    throw new Error('private secret');
  } }), error => error.message === 'FEISHU_AUTH_REQUEST_FAILED');
});

test('bad configuration never calls transport', async () => {
  await assert.rejects(exchangePluginToken({ ...config, pluginSecret: 'bad\nvalue',
    fetchImpl: () => { assert.fail('must not send'); } }), { code: 'FEISHU_AUTH_CONFIG_INVALID' });
});

test('timeout covers a transport ignoring cancellation', async () => {
  await assert.rejects(exchangePluginToken({ ...config, timeoutMs: 10,
    fetchImpl: () => new Promise(() => {}) }), { code: 'FEISHU_AUTH_TIMEOUT' });
});

test('timeout covers stalled body and cancels reader', async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(exchangePluginToken({ ...config, timeoutMs: 10,
    fetchImpl: async () => new Response(body) }), { code: 'FEISHU_AUTH_TIMEOUT' });
  assert.equal(cancelled, true);
});
