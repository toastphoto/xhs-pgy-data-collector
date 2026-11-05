const assert = require('node:assert/strict');
const test = require('node:test');
const { createFeishuMetadataReader, parseMetadataResponse, summarizeRequirements }
  = require('../lib/feishu_project_metadata');

const credential = { kind: 'plugin', token: 'TEST_ONLY_NOT_A_REAL_CREDENTIAL', userKey: 'fixture-user' };
const field = { field_key: 'name', field_name: 'Fixture title', field_type_key: 'text', is_required: 1 };
const success = (data = [field]) => ({ err_code: 0, err: {}, err_msg: '', data });
const json = (body, init = {}) => new Response(JSON.stringify(body), init);
function harness(overrides = {}) {
  const requests = [];
  const reader = createFeishuMetadataReader({
    projectKey: 'fixture-project', workItemTypeKey: 'fixture-type',
    getCredentials: async () => credential,
    fetchImpl: async (url, options) => { requests.push({ url, options }); return json(success()); },
    ...overrides
  });
  return { reader, requests };
}
function errorCode(code) {
  return (error) => {
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  };
}

test('reader only exposes metadata GET to the exact approved origin and target', async () => {
  const { reader, requests } = harness();
  const result = await reader.readMetadata();
  assert.deepEqual(Object.keys(reader), ['readMetadata']);
  assert.ok(Object.isFrozen(reader));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url,
    'https://project.feishu.cn/open_api/fixture-project/work_item/fixture-type/meta');
  const options = requests[0].options;
  assert.equal(options.method, 'GET');
  assert.equal(options.redirect, 'manual');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.body, undefined);
  assert.equal(options.headers['x-auth-mode'], '1');
  assert.equal(options.headers['X-USER-KEY'], credential.userKey);
  assert.equal(options.headers['X-PLUGIN-TOKEN'], credential.token);
  assert.equal(options.headers.Cookie, undefined);
  assert.deepEqual(result.fields, [field]);
  assert.equal(result.requirements[0].requirement, 'required');
  assert.equal(JSON.stringify(result).includes(credential.token), false);
});

test('user credentials do not impersonate a separately supplied user key', async () => {
  const { reader, requests } = harness({ getCredentials: async () => ({ ...credential, kind: 'user' }) });
  await reader.readMetadata();
  assert.equal(requests[0].options.headers['X-USER-KEY'], undefined);
  assert.equal(requests[0].options.headers['x-auth-mode'], undefined);
});

test('credentials are obtained again per call, never embedded or returned', async () => {
  let provided = 0;
  const { reader, requests } = harness({
    getCredentials: async () => ({ ...credential, token: `TEST_ONLY_${++provided}` })
  });
  await reader.readMetadata();
  await reader.readMetadata();
  assert.equal(provided, 2);
  assert.notEqual(requests[0].options.headers['X-PLUGIN-TOKEN'], requests[1].options.headers['X-PLUGIN-TOKEN']);
});

test('invalid targets and configuration are rejected before any request', () => {
  for (const target of ['', '../other', 'space/type', 'space?query', 'https://example.invalid', 'x\ny', null]) {
    assert.throws(() => harness({ projectKey: target }), errorCode('FEISHU_TARGET_INVALID'));
    assert.throws(() => harness({ workItemTypeKey: target }), errorCode('FEISHU_TARGET_INVALID'));
  }
  for (const timeoutMs of [0, -1, 60001, NaN, '10']) {
    assert.throws(() => harness({ timeoutMs }), errorCode('FEISHU_CONFIG_INVALID'));
  }
  assert.throws(() => harness({ getCredentials: null }), errorCode('FEISHU_CONFIG_INVALID'));
});

test('missing credentials and unsafe headers fail closed without a network call', async () => {
  for (const value of [null, {}, { ...credential, kind: 'cookie' },
    { ...credential, token: '' }, { ...credential, token: 'unsafe\r\nHeader:value' },
    { ...credential, userKey: '' }, { ...credential, userKey: 'bad key' }]) {
    const { reader, requests } = harness({ getCredentials: async () => value });
    await assert.rejects(reader.readMetadata(), errorCode('FEISHU_CREDENTIALS_REQUIRED'));
    assert.equal(requests.length, 0);
  }
});

for (const status of [301, 302, 307, 308]) {
  test(`redirect ${status} is rejected without following its destination`, async () => {
    let calls = 0;
    const { reader } = harness({ fetchImpl: async () => {
      calls++;
      return new Response(null, { status, headers: { Location: 'https://example.invalid/' } });
    } });
    await assert.rejects(reader.readMetadata(), errorCode('FEISHU_REDIRECT_REJECTED'));
    assert.equal(calls, 1);
  });
}

for (const status of [401, 403, 429, 500]) {
  test(`HTTP ${status} exposes only status and never retries or returns the response body`, async () => {
    let calls = 0;
    const { reader } = harness({ fetchImpl: async () => {
      calls++;
      return new Response(credential.token, { status });
    } });
    await assert.rejects(reader.readMetadata(), (error) => {
      errorCode('FEISHU_HTTP_ERROR')(error);
      assert.equal(error.status, status);
      assert.equal(JSON.stringify(error).includes(credential.token), false);
      return true;
    });
    assert.equal(calls, 1);
  });
}

test('business errors inside HTTP 200 do not become successful metadata', async () => {
  const { reader } = harness({ fetchImpl: async () => json({
    err_code: 10001, err_msg: credential.token, data: [field]
  }) });
  await assert.rejects(reader.readMetadata(), (error) => {
    errorCode('FEISHU_API_ERROR')(error);
    assert.equal(error.apiCode, 10001);
    assert.equal(JSON.stringify(error).includes(credential.token), false);
    return true;
  });
});

test('token envelopes, inconsistent errors and malformed metadata are rejected', () => {
  for (const body of [{ data: [field] }, { error: { code: 0 }, data: { token: 'TEST_ONLY' } },
    { ...success(), err_code: '0' }, { ...success(), err: { code: 10001 } },
    { ...success(), err_msg: 'not success' }, success({}), null]) {
    assert.throws(() => parseMetadataResponse(body), errorCode('FEISHU_RESPONSE_INVALID'));
  }
  for (const data of [[field, field], [{}], [{ ...field, field_name: '' }], [null]]) {
    assert.throws(() => parseMetadataResponse(success(data)), errorCode('FEISHU_METADATA_INVALID'));
  }
  assert.deepEqual(parseMetadataResponse(success([])), []);
});

test('unknown and conditional required states never silently become optional', () => {
  const flags = [1, 2, 3, 0, 4, undefined, null, true, '2'];
  assert.deepEqual(summarizeRequirements(flags.map(is_required => ({ ...field, is_required })))
    .map(f => f.requirement), ['required', 'optional', 'conditional',
      'unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown']);
});

test('metadata defaults and structured option values survive without application or coercion', async () => {
  const data = [{ ...field, default_value: { value: 0 }, options: [{ label: 'Zero', value: 0 }] }];
  const { reader } = harness({ fetchImpl: async () => json(success(data)) });
  const result = await reader.readMetadata();
  assert.deepEqual(result.fields, data);
});

test('malformed JSON and transport/provider errors never expose sensitive error strings', async () => {
  for (const [overrides, code] of [
    [{ fetchImpl: async () => new Response('<html>sign in</html>') }, 'FEISHU_RESPONSE_INVALID'],
    [{ fetchImpl: async () => { throw new Error(credential.token); } }, 'FEISHU_REQUEST_FAILED'],
    [{ getCredentials: async () => { throw new Error(credential.token); } }, 'FEISHU_CREDENTIALS_REQUIRED']
  ]) {
    await assert.rejects(harness(overrides).reader.readMetadata(), errorCode(code));
  }
});

test('advertised and streamed oversized responses are rejected', async () => {
  for (const response of [
    new Response('{}', { headers: { 'Content-Length': String(3 * 1024 * 1024) } }),
    new Response('x'.repeat(2 * 1024 * 1024 + 1))
  ]) {
    const { reader } = harness({ fetchImpl: async () => response });
    await assert.rejects(reader.readMetadata(), errorCode('FEISHU_RESPONSE_TOO_LARGE'));
  }
});

test('timeout covers credential lookup; late credentials cannot trigger a request', async () => {
  let resolveCredentials;
  const { reader, requests } = harness({ timeoutMs: 15,
    getCredentials: () => new Promise(resolve => { resolveCredentials = resolve; }) });
  await assert.rejects(reader.readMetadata(), errorCode('FEISHU_REQUEST_TIMEOUT'));
  resolveCredentials(credential);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 0);
});

test('unresponsive transport is bounded even when it ignores AbortSignal', async () => {
  const { reader } = harness({ timeoutMs: 15, fetchImpl: () => new Promise(() => {}) });
  await assert.rejects(reader.readMetadata(), errorCode('FEISHU_REQUEST_TIMEOUT'));
});

test('stalled response body times out and is canceled', async () => {
  let canceled = false;
  const stream = new ReadableStream({ cancel() { canceled = true; } });
  const { reader } = harness({ timeoutMs: 15, fetchImpl: async () => new Response(stream) });
  await assert.rejects(reader.readMetadata(), errorCode('FEISHU_REQUEST_TIMEOUT'));
  assert.equal(canceled, true);
});

test('already aborted requests never fetch credentials or send', async () => {
  const controller = new AbortController();
  controller.abort();
  let provided = false;
  const { reader, requests } = harness({ getCredentials: async () => { provided = true; return credential; } });
  await assert.rejects(reader.readMetadata({ signal: controller.signal }), errorCode('FEISHU_REQUEST_ABORTED'));
  assert.equal(provided, false);
  assert.equal(requests.length, 0);
});

test('operator cancellation stays distinct from timeout', async () => {
  const controller = new AbortController();
  let resolveFetch;
  const started = new Promise(resolve => { resolveFetch = resolve; });
  const { reader } = harness({ fetchImpl: async () => { resolveFetch(); return new Promise(() => {}); } });
  const pending = reader.readMetadata({ signal: controller.signal });
  await started;
  controller.abort();
  await assert.rejects(pending, errorCode('FEISHU_REQUEST_ABORTED'));
});
