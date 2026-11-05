const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'views', 'exports.js'), 'utf8');
const start = source.indexOf('function requestSelectedContactRunSwitch(');
const end = source.indexOf('function getXiaomifengApprovalPayload(', start);
assert.ok(start >= 0 && end > start);

function harness({ runs = [], switched = true } = {}) {
  const scheduled = [];
  const events = [];
  const context = vm.createContext({
    _runs: runs,
    _selectedRunDir: 'old-run',
    _contactRunSwitchTarget: '',
    setTimeout: (callback) => scheduled.push(callback),
    switchSelectedContactRun: async (target) => {
      events.push('switch');
      if (switched) context._selectedRunDir = target;
      return switched;
    },
    refreshRuns: async () => {
      events.push('refresh');
      context._runs = [{ path: 'new-run' }];
    },
    store: { state: { exports: {} }, set: (state) => events.push(state.exports.selectedRunDir) }
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, scheduled, events };
}

test('a new completed run refreshes the selector before publishing the switch', async () => {
  const h = harness();
  h.context.requestSelectedContactRunSwitch('new-run');
  await h.scheduled[0]();
  assert.deepEqual(h.events, ['switch', 'refresh', 'new-run']);
});

test('an existing run does not refresh or change unrelated run data', async () => {
  const h = harness({ runs: [{ path: 'new-run' }] });
  h.context.requestSelectedContactRunSwitch('new-run');
  await h.scheduled[0]();
  assert.deepEqual(h.events, ['switch', 'new-run']);
});

test('failed save/switch preserves the old selection and does not refresh', async () => {
  const h = harness({ switched: false });
  h.context.requestSelectedContactRunSwitch('new-run');
  await h.scheduled[0]();
  assert.deepEqual(h.events, ['switch', 'old-run']);
});

test('unselected results are distinguished from an empty result', () => {
  assert.match(source, /else if \(_contactPreviewRows\.length\) \{\s*setMsg\('蒲公英采集已完成；尚未勾选补采达人/);
});

function patchHarness(save) {
  const row = { wechatId: '', note: 'fixture_note' };
  const context = vm.createContext({ _selectedRunDir: 'run', _contactReviewMap: new Map([['row', row]]),
    _xiaomifengApprovalCheck: {}, resetEmailHandoff() {}, saveContactReviewNow: () => save(row) });
  const first = source.indexOf('async function applyFeishuContactPatch(');
  const last = source.indexOf('function ensureReviewRow(', first);
  assert.ok(first >= 0 && last > first); vm.runInContext(source.slice(first, last), context);
  return { row, apply: context.applyFeishuContactPatch };
}

test('failed local backfill save rolls back its patch before any later batch save', async () => {
  for (const throws of [false, true]) {
    const h = patchHarness(() => { if (throws) throw Error('fixture failure'); return { ok: false }; });
    assert.equal((await h.apply('run', 'row', { wechatId: 'fixture_contact', contactSource: 'fixture' })).ok, false);
    assert.equal(h.row.wechatId, ''); assert.equal(h.row.contactSource, undefined);
  }
});

test('local rollback preserves edits made concurrently and success preserves the patch', async () => {
  const h = patchHarness(row => { row.wechatId = 'manual_fixture'; return { ok: false }; });
  await h.apply('run', 'row', { wechatId: 'fixture_contact' }); assert.equal(h.row.wechatId, 'manual_fixture');
  const ok = patchHarness(() => ({ ok: true }));
  assert.equal((await ok.apply('run', 'row', { wechatId: 'fixture_contact' })).ok, true);
  assert.equal(ok.row.wechatId, 'fixture_contact');
  assert.equal((await ok.apply('other-run', 'row', { wechatId: 'other' })).code, 'FEISHU_LOCAL_CHANGED');
});
