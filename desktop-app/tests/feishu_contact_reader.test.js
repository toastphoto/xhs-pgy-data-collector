const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFeishuContactReader } = require('../lib/feishu_contact_reader');
const credentials = { kind: 'plugin', token: 'fixture-token', userKey: 'fixture-user' };
function input() { return {
  mapping: { identityConfirmed: true, platformOptionConfirmed: true, identityKind: 'xhs_account_number',
    platformOptionId: 'option', identityField: 'account', platformField: 'platform', contactField: 'contact' },
  fields: [{ key: 'account', type: 'text' }, { key: 'platform', type: 'select' }, { key: 'contact', type: 'text' }],
  identityKind: 'xhs_account_number', identityValue: '001234', existing: {}
}; }
function envelope() { return { err_code: 0, data: [{ id: 1, project_key: 'project', work_item_type_key: 'creator',
  fields: [{ field_key: 'account', field_value: '001234' }, { field_key: 'platform', field_value: {label:'小红书',value:'option'} },
    { field_key: 'contact', field_value: 'fixture@example.com' }] }],
  pagination: { page_num: 1, page_size: 50, total: 1 } }; }
function make(overrides = {}) { return createFeishuContactReader({ projectKey: 'project', workItemTypeKey: 'creator',
  getCredentials: async () => credentials, fetchImpl: async () => Response.json(envelope()), ...overrides }); }

test('one exact official POST, leading zeros preserved, reviewed proposal only', async () => {
  let calls = 0;
  const result = await make({ fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://project.feishu.cn/open_api/project/work_item/creator/search/params');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers['x-auth-mode'], '1');
    const body = JSON.parse(options.body);
    assert.equal(body.search_group.search_params[1].value, '001234');
    assert.deepEqual(body.fields, ['account', 'platform', 'contact']);
    return Response.json(envelope());
  } }).preview(input());
  assert.equal(calls, 1);
  assert.equal(result.status, 'ready_for_review');
  assert.equal(result.proposals[0].requiresConfirmation, true);
  assert.equal(result.data, undefined);
});
test('invalid mapping and internal profile ID never acquire credentials', async () => {
  let calls = 0;
  const reader = make({ getCredentials: async () => { calls++; return credentials; } });
  const a = input(); a.mapping.platformOptionConfirmed = false;
  await assert.rejects(reader.preview(a));
  const b = input(); b.mapping.identityKind = b.identityKind = 'xhs_profile_id';
  await assert.rejects(reader.preview(b), { code: 'FEISHU_IDENTITY_INVALID' });
  assert.equal(calls, 0);
});
test('snapshot protects response review from caller mutation while awaiting credentials', async () => {
  const value = input();
  const result = await make({ getCredentials: async () => {
    value.mapping.platformOptionId = 'changed'; value.existing.email = 'changed';
    value.fields[0].type = 'number'; return credentials;
  } }).preview(value);
  assert.equal(result.status, 'ready_for_review');
});
test('timeout covers credential provider and no late request is dispatched', async () => {
  let resolve; let calls = 0;
  const promise = make({ timeoutMs: 10, getCredentials: () => new Promise(r => { resolve = r; }),
    fetchImpl: async () => { calls++; } }).preview(input());
  await assert.rejects(promise, { code: 'FEISHU_REQUEST_TIMEOUT' });
  resolve(credentials);
  await new Promise(r => setImmediate(r));
  assert.equal(calls, 0);
});
test('pre-abort and in-flight abort stop the operation', async () => {
  const pre = new AbortController(); pre.abort();
  await assert.rejects(make().preview({ ...input(), signal: pre.signal }), { code: 'FEISHU_REQUEST_ABORTED' });
  const active = new AbortController();
  await assert.rejects(make({ fetchImpl: async () => { active.abort(); return new Promise(() => {}); } })
    .preview({ ...input(), signal: active.signal }), { code: 'FEISHU_REQUEST_ABORTED' });
});
test('redirect, HTTP and remote business errors fail closed without retry', async () => {
  for (const [response, code] of [[new Response('', { status: 302 }), 'FEISHU_REDIRECT_REJECTED'],
    [new Response('private error', { status: 429 }), 'FEISHU_HTTP_ERROR'],
    [Response.json({ err_code: 99, err_msg: 'private error' }), 'FEISHU_API_ERROR']]) {
    let calls = 0;
    await assert.rejects(make({ fetchImpl: async () => { calls++; return response; } }).preview(input()), { code });
    assert.equal(calls, 1);
  }
});
test('transport and credential exceptions never expose original messages', async () => {
  await assert.rejects(make({ fetchImpl: async () => { throw new Error('private detail'); } }).preview(input()),
    { message: 'FEISHU_REQUEST_FAILED' });
  await assert.rejects(make({ getCredentials: async () => { throw new Error('private detail'); } }).preview(input()),
    { message: 'FEISHU_CREDENTIALS_REQUIRED' });
});
test('bounded bodies and malformed JSON are rejected', async () => {
  for (const response of [new Response('x', { headers: { 'content-length': '2097153' } }),
    new Response('x'.repeat(2097153))]) {
    await assert.rejects(make({ fetchImpl: async () => response }).preview(input()), { code: 'FEISHU_RESPONSE_TOO_LARGE' });
  }
  await assert.rejects(make({ fetchImpl: async () => new Response('not json') }).preview(input()),
    { code: 'FEISHU_RESPONSE_INVALID' });
});
test('body timeout cancels the stream', async () => {
  let canceled = false;
  const response = new Response(new ReadableStream({ cancel() { canceled = true; } }));
  await assert.rejects(make({ timeoutMs: 10, fetchImpl: async () => response }).preview(input()),
    { code: 'FEISHU_REQUEST_TIMEOUT' });
  assert.equal(canceled, true);
});
test('incomplete results never trigger pagination or proposals', async () => {
  const body = envelope(); body.pagination.total = 51;
  let calls = 0;
  const result = await make({ fetchImpl: async () => { calls++; return Response.json(body); } }).preview(input());
  assert.equal(calls, 1);
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.proposals, []);
});
