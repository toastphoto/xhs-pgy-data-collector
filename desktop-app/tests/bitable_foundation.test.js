const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { configureBitableRuntime, BITABLE_NAME, BITABLE_APP_ID } = require('../lib/bitable_runtime');
const { createBitableClient } = require('../lib/bitable_client');
const { projectCreator, buildSelectedBatch, creatorPatch } = require('../lib/bitable_sync_plan');
const { parseBitableTarget } = require('../lib/bitable_target');

const pkg = require('../package.json');
const uuid = '00000000-0000-4000-8000-000000000001';
const target = { appToken: 'fixture_base', tableId: 'fixture_table', getAccessToken: async () => 'fixture-credential' };
const ok = data => ({ ok: true, status: 200, json: async () => ({ code: 0, data }) });
const creator = extra => ({ rowId: 'row-a', xhsId: '00123', creatorName: 'Fixture', ...extra });

test('operators can paste a Base link or enter the two IDs; view/tracking is not a data scope', () => {
  const target = parseBitableTarget('https://fixture.feishu.cn/base/fixtureBase?table=tblFixture&view=vewFixture&tracking=fixture');
  assert.deepEqual(target, { kind: 'base', appToken: 'fixtureBase', tableId: 'tblFixture', needsTableSelection: false });
  assert.deepEqual(parseBitableTarget({ appToken: 'fixtureBase', tableId: 'tblFixture' }), target);
  assert.equal(parseBitableTarget('https://fixture.feishu.cn/base/fixtureBase').needsTableSelection, true);
});

test('wiki links require resolution, not guessed Bitable IDs', () => {
  const target = parseBitableTarget('https://fixture.feishu.cn/wiki/fixtureNode?table=tblFixture');
  assert.equal(target.kind, 'wiki');
  assert.equal(target.nodeToken, 'fixtureNode');
  assert.ok(!Object.hasOwn(target, 'appToken'));
});

test('target parsing rejects lookalike hosts, embedded credentials and ambiguous table IDs', () => {
  for (const link of ['https://feishu.cn.evil.invalid/base/fixture', 'https://user:pass@fixture.feishu.cn/base/fixture',
    'http://fixture.feishu.cn/base/fixture', 'https://project.feishu.cn/base/fixture',
    'https://fixture.feishu.cn/base/fixture?table=tblOne&table=tblTwo', 'https://fixture.feishu.cn/docx/fixture']) {
    assert.throws(() => parseBitableTarget(link));
  }
  assert.throws(() => parseBitableTarget('fixtureBase'), { code: 'BITABLE_LINK_REQUIRED' });
});

test('Bitable installation metadata is independent and lockfile agrees', () => {
  const lock = require('../package-lock.json');
  assert.equal(pkg.productVariant, 'feishu-bitable');
  assert.equal(pkg.name, BITABLE_NAME);
  assert.equal(pkg.build.appId, BITABLE_APP_ID);
  assert.equal(pkg.desktopAppId, BITABLE_APP_ID);
  assert.match(pkg.build.nsis.shortcutName, /多维表格/);
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.equal(lock.packages[''].version, pkg.version);
});

test('Bitable runtime isolates profiles, browser sessions and backend roots', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bitable-unit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const assigned = {};
  const app = { getPath: () => root, setName: name => { assigned.name = name; },
    setPath: (name, value) => { assigned[name] = value; }, commandLine: { getSwitchValue: () => '' } };
  const env = { API_PORT: '8010', DATA_DIR: 'original', OUTPUT_DIR: 'original', LOG_DIR: 'original' };
  assert.deepEqual(configureBitableRuntime(app, {}, env), { active: false });
  assert.deepEqual(assigned, {});
  const runtime = configureBitableRuntime(app, pkg, env);
  assert.equal(runtime.port, '28010');
  assert.equal(env.API_PORT, '28010');
  for (const key of ['DATA_DIR', 'OUTPUT_DIR', 'LOG_DIR']) assert.ok(env[key].startsWith(`${assigned.userData}${path.sep}`));
  assert.ok(assigned.sessionData.startsWith(`${assigned.userData}${path.sep}`));
  app.commandLine.getSwitchValue = () => path.join(root, 'production-profile');
  assert.throws(() => configureBitableRuntime(app, pkg, env), /OUTSIDE_ISOLATED_ROOT/);
  assert.throws(() => configureBitableRuntime(app, { ...pkg, buildFlavor: 'coexist-qa' }, env), /EDITION_CONFLICT/);
});

test('Bitable startup does not instantiate any Project connection or stores', () => {
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const start = source.indexOf('const feishuWorkbench =');
  const end = source.indexOf("for (const method of ['connect', 'status', 'clear', 'lookup'", start);
  const forbidden = () => { throw new Error('Project setup must not run'); };
  const context = { bitableRuntime: { active: true }, createFeishuWorkbench: forbidden,
    createFeishuConnectionStore: forbidden, createFeishuMaintainerStore: forbidden };
  assert.ok(start > 0 && end > start);
  vm.runInNewContext(`${source.slice(start, end)}\nif (feishuWorkbench !== null) throw Error('not disabled');`, context);
});

test('every old Project IPC refuses valid main-renderer calls in Bitable edition', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const start = source.indexOf("for (const method of ['connect', 'status', 'clear', 'lookup'");
  const end = source.indexOf("ipcMain.handle('exports:loadContactReview'", start);
  const handlers = new Map(), frame = {}, sender = { mainFrame: frame };
  const context = { ipcMain: { handle: (key, fn) => handlers.set(key, fn) }, feishuWorkbench: null,
    mainWindow: { isDestroyed: () => false, webContents: sender }, feishuSafeError: () => assert.fail('must return before invocation') };
  vm.runInNewContext(source.slice(start, end), context);
  assert.equal(handlers.size, 18);
  for (const handler of handlers.values()) {
    assert.equal((await handler({ sender, senderFrame: frame }, {})).code, 'FEISHU_PROJECT_DISABLED');
    assert.equal((await handler({ sender: {}, senderFrame: frame }, {})).code, 'FEISHU_SENDER_REJECTED');
  }
});

test('renderer waits for explicit edition before mounting old Project UI', () => {
  const source = fs.readFileSync(path.join(__dirname, '../renderer/views/exports.js'), 'utf8');
  assert.match(source, /if \(state\.appInfo\?\.productVariant === 'feishu-project'\) root\.appendChild\(renderFeishuWorkbench/);
});

test('API targets cannot escape the fixed Feishu Open Platform origin', () => {
  for (const tableId of ['../../records', 'https://invalid.example', 'a?b=c', 'a/b', '']) {
    assert.throws(() => createBitableClient({ ...target, tableId }), { code: 'BITABLE_TARGET_INVALID' });
  }
});

test('field reads consume all pages and never return a partial success', async () => {
  const urls = [];
  const client = createBitableClient({ ...target, fetchImpl: async (url, init) => {
    urls.push(new URL(url));
    assert.equal(init.redirect, 'error');
    assert.equal(init.method, 'GET');
    return ok(urls.length === 1 ? { items: [{ field_id: 'a' }], has_more: true, page_token: 'next' }
      : { items: [{ field_id: 'b' }], has_more: false });
  } });
  assert.equal((await client.listFields()).length, 2);
  assert.equal(urls[0].origin, 'https://open.feishu.cn');
  assert.equal(urls[1].searchParams.get('page_token'), 'next');
  const partial = createBitableClient({ ...target, fetchImpl: async () => ok({ items: [], has_more: true, page_token: 'same' }) });
  await assert.rejects(partial.listFields(), { code: 'BITABLE_PAGINATION_INVALID' });
  await assert.rejects(partial.listFields({ maxPages: 1 }), { code: 'BITABLE_PAGE_LIMIT_EXCEEDED' });
});

test('search POST is a read with exact structured filter and open_id namespace', async () => {
  const filter = { conjunction: 'and', conditions: [{ field_name: 'Fixture ID', operator: 'is', value: ['00123'] }] };
  const client = createBitableClient({ ...target, fetchImpl: async (url, init) => {
    assert.equal(new URL(url).searchParams.get('user_id_type'), 'open_id');
    assert.match(new URL(url).pathname, /records\/search$/);
    assert.deepEqual(JSON.parse(init.body), { filter, automatic_fields: false });
    return ok({ items: [], has_more: false });
  } });
  assert.deepEqual(await client.searchRecords(filter), []);
});

test('batch writes are serialized, snapshot input and preserve supplied idempotency key', async () => {
  let release, calls = 0, active = 0, peak = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const client = createBitableClient({ ...target, fetchImpl: async (url, init) => {
    calls++; active++; peak = Math.max(peak, active);
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('client_token'), uuid);
    assert.equal(parsed.searchParams.get('ignore_consistency_check'), 'false');
    const body = JSON.parse(init.body);
    if (calls === 1) { await gate; assert.equal(body.records[0].fields.name, 'before'); }
    active--;
    return ok({ records: body.records.map((r, i) => ({ ...r, record_id: r.record_id || `fixture_${i}` })) });
  } });
  const rows = [{ fields: { name: 'before' } }];
  const a = client.createRecords(rows, { clientToken: uuid });
  rows[0].fields.name = 'changed';
  const b = client.updateRecords([{ record_id: 'fixture_a', fields: { name: 'new' } }], { clientToken: uuid });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  release();
  await a; await b;
  assert.equal(peak, 1);
});

test('write transport failure is unknown and is never automatically retried', async () => {
  let calls = 0;
  const client = createBitableClient({ ...target, fetchImpl: async () => { calls++; throw new Error('private response'); } });
  await assert.rejects(client.createRecords([{ fields: { name: 'fixture' } }], { clientToken: uuid }), e => {
    assert.equal(e.outcome, 'unknown');
    assert.equal(e.message, 'BITABLE_REQUEST_FAILED');
    return true;
  });
  assert.equal(calls, 1);
});

test('abort after token retrieval and queued stop do not dispatch new writes', async () => {
  const controller = new AbortController();
  const client = createBitableClient({ ...target, getAccessToken: async () => { controller.abort(); return 'fixture'; },
    fetchImpl: async () => assert.fail('must not send') });
  await assert.rejects(client.createRecords([{ fields: { name: 'a' } }], { clientToken: uuid, signal: controller.signal }),
    { code: 'BITABLE_STOPPED', outcome: 'not_sent' });
});

test('invalid batches and missing auth never call transport', async () => {
  const client = createBitableClient({ ...target, fetchImpl: async () => assert.fail('must not send') });
  for (const rows of [[], Array(501).fill({ fields: { name: 'x' } }), [{ fields: {} }], [{ fields: { name: 'x' }, record_id: 'a' }]]) {
    await assert.rejects(client.createRecords(rows, { clientToken: uuid }), { code: 'BITABLE_BATCH_INVALID', outcome: 'not_sent' });
  }
  await assert.rejects(client.createRecords([{ fields: { name: 'a' } }], {}), { code: 'BITABLE_BATCH_INVALID' });
  const unauthorized = createBitableClient({ ...target, getAccessToken: async () => { throw Error('private'); } });
  await assert.rejects(unauthorized.listFields(), { code: 'BITABLE_AUTH_REQUIRED', outcome: 'not_sent' });
});

test('partial success and unrelated update record IDs are not accepted', async () => {
  const client = createBitableClient({ ...target, fetchImpl: async () => ok({ records: [{ record_id: 'other' }] }) });
  await assert.rejects(client.updateRecords([{ record_id: 'wanted', fields: { name: 'x' } }], { clientToken: uuid }),
    { code: 'BITABLE_RESPONSE_INVALID', outcome: 'unknown' });
  await assert.rejects(client.createRecords([{ fields: { name: 'a' } }, { fields: { name: 'b' } }], { clientToken: uuid }),
    { code: 'BITABLE_RESPONSE_INVALID', outcome: 'unknown' });
});

test('API errors expose only safe numeric diagnostics', async () => {
  const client = createBitableClient({ ...target, fetchImpl: async () => ({ ok: false, status: 403,
    json: async () => ({ code: 99991672, msg: 'sensitive-message' }) }) });
  await assert.rejects(client.createRecords([{ fields: { name: 'a' } }], { clientToken: uuid }), e => {
    assert.equal(e.message, 'BITABLE_API_ERROR');
    assert.equal(e.outcome, 'rejected');
    assert.equal(e.apiCode, 99991672);
    assert.ok(!JSON.stringify(e).includes('sensitive-message'));
    return true;
  });
});

test('sync selection is independent of invitation selection and preserves requested order', () => {
  const rows = [creator({ rowId: 'a', selected: true }), creator({ rowId: 'b', xhsId: 'other', selected: false })];
  const before = JSON.stringify(rows);
  const batch = buildSelectedBatch(rows, ['b']);
  assert.deepEqual(batch.map(r => r.rowId), ['b']);
  assert.equal(batch[0].status, 'pending');
  assert.equal(JSON.stringify(rows), before);
  assert.deepEqual(buildSelectedBatch(rows, []), []);
  assert.throws(() => buildSelectedBatch(rows, ['missing']), { code: 'BITABLE_SELECTION_STALE' });
});

test('unknown contacts are preserved; empty contacts do not block; unquoted is zero, unread is missing', () => {
  const projected = projectCreator(creator({ contactRaw: 'fixture-value', imagePrice: '暂未报价', videoPrice: '' }));
  assert.equal(projected.fields.imagePrice, 0);
  assert.ok(!Object.hasOwn(projected.fields, 'videoPrice'));
  assert.equal(projected.fields.contactRaw, 'fixture-value');
  assert.ok(!Object.hasOwn(projected.fields, 'wechatId'));
  assert.equal(projected.fields.xhsId, '00123');
  assert.equal(projectCreator(creator()).identity, 'xhs-account:00123');
  assert.throws(() => projectCreator(creator({ xhsId: 123 })), { code: 'BITABLE_ACCOUNT_TEXT_REQUIRED' });
  assert.throws(() => projectCreator(creator({ imagePrice: 'failed-read' })), { code: 'BITABLE_QUOTE_INVALID' });
});

test('same nickname is not identity and legacy guessed XHS profile is not uploaded', () => {
  assert.throws(() => projectCreator(creator({ xhsId: '' })), { code: 'BITABLE_IDENTITY_REQUIRED' });
  const creatorUrl = 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/fixture-pgy';
  const xhsProfileUrl = 'https://www.xiaohongshu.com/user/profile/fixture-xhs';
  const unproven = projectCreator(creator({ creatorUrl, xhsProfileUrl }));
  assert.ok(!unproven.fields.xhsProfileUrl);
  assert.deepEqual(unproven.warnings, ['BITABLE_PROFILE_PROVENANCE_PENDING']);
  const proven = projectCreator(creator({ creatorUrl, xhsProfileUrl, xhsProfileSourceCreatorUrl: creatorUrl }));
  assert.equal(proven.fields.xhsProfileUrl, xhsProfileUrl);
});

test('repeated selected identities are surfaced, not scheduled as two creates', () => {
  const result = buildSelectedBatch([creator(), creator({ rowId: 'row-b' })], ['row-a', 'row-b']);
  assert.equal(result[0].status, 'conflict');
  assert.equal(result[1].status, 'conflict');
  assert.equal(result[1].code, 'BITABLE_DUPLICATE_SELECTION');
});

test('supplementation leaves cloud contacts and manual followup alone', () => {
  const patch = creatorPatch({ email: '', phone: 'new', imagePrice: 0, note: 'overwrite', followupStatus: 'sent' },
    { email: 'existing', phone: 'old', imagePrice: 100, note: 'manual' }, { imagePrice: 100, phone: 'old' });
  assert.deepEqual(patch.fields, { imagePrice: 0 });
  assert.deepEqual(patch.conflicts, ['phone']);
  assert.deepEqual(creatorPatch({ imagePrice: 300 }, { imagePrice: 200 }, { imagePrice: 100 }),
    { fields: {}, conflicts: ['imagePrice'] });
  assert.deepEqual(creatorPatch({ email: 'new' }, {}, {}), { fields: { email: 'new' }, conflicts: [] });
});
