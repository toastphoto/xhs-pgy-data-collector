const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../renderer/views/exports.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(__dirname, '../lib/contact_review_store.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
class Element {
  constructor() { this.handlers = {}; }
  addEventListener(name, callback) { this.handlers[name] = callback; }
}
function harness(save = async () => ({ ok: true })) {
  const timers = new Map(), calls = []; let next = 0;
  const context = vm.createContext({
    document: { createElement: () => new Element(), querySelectorAll: () => [] },
    window: { localStorage: {}, desktopAPI: { exports: {
      saveContactReview: async p => { calls.push(['save', structuredClone(p)]); return save(p); },
      loadContactReview: async p => ({ ok: true, runDir: p.runDir, reviewRows: [], settings: { selectionPolicy: 'manual_opt_in_v1' } }),
      getContactPreview: async () => ({ ok: true, rawFiles: 1, rows: [{ rowId: 'row', creatorUrl: 'https://fixture.invalid/person' }] }),
      exportContactRun: async p => { calls.push(['export', structuredClone(p)]); return { ok: true, outPath: 'fixture.xlsx', creators: 1 }; },
      importContactReviewWorkbook: async () => ({ ok: true, rows: [{ creatorUrl: 'https://fixture.invalid/person', selected: true, note: 'imported fixture' }], stats: { matchedRows: 1 } })
    } } },
    store: { state: { exports: {} }, set() {} },
    createReviewViewportStateRegistry: () => ({}), loadOutreachTemplateLibrary: () => ({}),
    setTimeout: fn => { const id = ++next; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    isPgyInviteBusy: () => false, resetEmailHandoff() {}, getContactSettings: () => ({ selectionPolicy: 'manual_opt_in_v1' }),
    normalizeContactChannel: v => v, normalizeContactUrl: v => v, defaultFollowupStatus: r => r.followupStatus || '',
    formatFollowupStatusCounts: () => ''
  });
  vm.runInContext(section('let _runs = [];', 'function setContactSaveStatus('), context);
  vm.runInContext(section('function setMsg(', 'async function refreshRuns('), context);
  vm.runInContext(section('function getReviewRows(', 'function getContactReviewViewportKey('), context);
  vm.runInContext(section('function ensureReviewRow(', 'function getContactFilteredRows('), context);
  vm.runInContext(section('function resetContactPreviewState(', 'export function renderExports('), context);
  const evaluate = code => vm.runInContext(code, context);
  evaluate(`_selectedRunDir='run-A';_contactLoadedRunDir='run-A';_contactPreviewRunDir='run-A';
    _contactPreviewRows=[{rowId:'row',creatorUrl:'https://fixture.invalid/person'}];
    _contactReviewMap=new Map([['row',{rowId:'row',note:'manual fixture',selected:false}]]);`);
  return { context, calls, timers, evaluate,
    api: context.window.desktopAPI.exports,
    async autosave() { context.scheduleContactReviewSave(); const [id, fn] = [...timers][0]; timers.delete(id); await fn(); },
    exportButton() {
      evaluate(section("  const btnExportContact = document.createElement('button');", "  const composerTabs = document.createElement('div');")
        .replace('const btnExportContact =', 'var btnExportContact ='));
      return evaluate('btnExportContact');
    }
  };
}

test('review enrichment: export uses current raw contact and account provenance', () => {
  const h = harness();
  vm.runInContext(section('function buildExportRowsFromContactRows(', 'function safeSuffixPart('), h.context);
  h.evaluate(`_contactReviewMap.get('row').contactRaw='00123';
    _contactReviewMap.get('row').contactRawSource='team-library';
    _contactReviewMap.get('row').contactRawCollectedAt='2026-10-15T00:00:00Z';
    _contactReviewMap.get('row').feishuAccountNumber='fixture-account';`);
  const rows = h.context.buildExportRowsFromContactRows([{rowId:'row',contactRaw:'stale',pgyInvite:{},emailTemplate:{}}]);
  assert.equal(rows[0].contactRaw,'00123');
  assert.equal(rows[0].contactRawSource,'team-library');
  assert.equal(rows[0].contactRawCollectedAt,'2026-10-15T00:00:00Z');
  assert.equal(rows[0].feishuAccountNumber,'fixture-account');
});

test('review safety: save status updates in place without publishing a page rerender', () => {
  const h=harness(),node={textContent:''};let rerenders=0;
  h.context.document.querySelectorAll=selector=>{assert.equal(selector,'[data-contact-save-status]');return [node];};
  h.context.document.activeElement={closest:()=>({})};
  h.context.store.set=()=>rerenders++;
  h.context.setContactSaveStatus('fixture saved');
  assert.equal(node.textContent,'fixture saved');assert.equal(h.evaluate('_contactSaveStatus'),'fixture saved');
  assert.equal(rerenders,0);
  h.context.document.activeElement=null;
  h.context.setContactSaveStatus('fixture refreshed');assert.equal(rerenders,1);
});

test('review safety: settled failed autosave keeps edits and blocks switching until an explicit successful save', async () => {
  for (const throws of [false, true]) {
    let fail = true;
    const h = harness(async () => { if (fail && throws) throw Error('fixture failure'); return { ok: !fail }; });
    await h.autosave();
    assert.match(h.evaluate('_contactSaveStatus'), /自动保存失败/);
    assert.equal(await h.context.switchSelectedContactRun('run-B'), false);
    assert.equal(h.evaluate('_selectedRunDir'), 'run-A');
    assert.equal(h.evaluate("_contactReviewMap.get('row').note"), 'manual fixture');
    fail = false; await h.context.saveContactReviewNow();
    assert.equal(await h.context.switchSelectedContactRun('run-B'), true);
  }
});

test('review safety: edits made while a switch awaits saving are also flushed before clearing the old run', async () => {
  const gate = deferred(); let n = 0;
  const h = harness(async () => ++n === 1 ? gate.promise : { ok: true });
  h.context.scheduleContactReviewSave();
  const switching = h.context.switchSelectedContactRun('run-B'); await new Promise(setImmediate);
  h.evaluate("_contactReviewMap.get('row').note='newer fixture';scheduleContactReviewSave();");
  gate.resolve({ ok: true });
  assert.equal(await switching, true);
  assert.deepEqual(h.calls.map(c => c[1].reviewRows[0].note), ['manual fixture', 'newer fixture']);
  assert.equal(h.evaluate('_contactPendingSave'), null);
});

test('review safety: obsolete previews cannot replace and save newer rows after ABA or overlapping refresh', async () => {
  for (const switchAway of [true, false]) {
    const h = harness(), old = deferred(); let requests = 0;
    h.api.getContactPreview = async () => ++requests === 1 ? old.promise : {
      ok: true, rows: [{ rowId: 'row' }, { rowId: 'new-row' }]
    };
    const pending = h.context.refreshContactPreview(); await new Promise(setImmediate);
    if (switchAway) {
      assert.equal(await h.context.switchSelectedContactRun('run-B'), true);
      assert.equal(await h.context.switchSelectedContactRun('run-A'), true);
    }
    await h.context.refreshContactPreview();
    h.evaluate("_contactReviewMap.get('new-row').note='new manual edit';");
    await h.context.saveContactReviewNow();
    const saves = h.calls.length;
    old.resolve({ ok: true, rows: [{ rowId: 'row' }] }); await pending;
    assert.equal(h.evaluate('_contactPreviewRows.length'), 2);
    assert.equal(h.evaluate("_contactReviewMap.get('new-row').note"), 'new manual edit');
    assert.equal(h.calls.length, saves);
  }
});

test('review safety: an obsolete same-run review load cannot clear a newer preview or its edits', async () => {
  const h = harness(), old = deferred(); let loads = 0;
  h.evaluate("_contactLoadedRunDir='';");
  h.api.loadContactReview = async p => ++loads === 1 ? old.promise : {
    ok: true, runDir: p.runDir, reviewRows: [], settings: { selectionPolicy: 'manual_opt_in_v1' }
  };
  const pending = h.context.refreshContactPreview(); await new Promise(setImmediate);
  await h.context.refreshContactPreview();
  h.evaluate("_contactReviewMap.get('row').note='newer load edit';");
  await h.context.saveContactReviewNow();
  const saves = h.calls.length;
  old.resolve({ ok: true, runDir: 'run-A', reviewRows: [], settings: {} }); await pending;
  assert.equal(h.evaluate("_contactReviewMap.get('row').note"), 'newer load edit');
  assert.equal(h.calls.length, saves);
  assert.equal(loads, 2);
});

test('review safety: editing while approval is pending cannot restore an old check or erase a newer save failure', async () => {
  for (const failSave of [false, true]) {
    let fail = false;
    const h = harness(async () => ({ ok: !fail })), approval = deferred();
    h.context.buildExportRowsFromContactRows = rows => rows;
    h.context.window.desktopAPI.approvals = { getXiaomifeng: () => approval.promise };
    const pending = h.context.refreshContactPreview(); await new Promise(setImmediate);
    h.evaluate("_contactReviewMap.get('row').note='edited during approval';scheduleContactReviewSave();");
    if (failSave) {
      fail = true;
      const [id, save] = [...h.timers][0]; h.timers.delete(id); await save();
      assert.match(h.evaluate('_contactSaveStatus'), /自动保存失败/);
    }
    const status = h.evaluate('_contactSaveStatus');
    approval.resolve({ ok: true, approval: { fixture: true }, check: { ok: true } }); await pending;
    assert.equal(h.evaluate('_xiaomifengApprovalCheck'), null);
    assert.equal(h.evaluate('_contactSaveStatus'), status);
    assert.equal(h.evaluate("_contactReviewMap.get('row').note"), 'edited during approval');
  }
});

function mockedStore({ bytes = '', exists = true, writeFails = false, renameFails = false } = {}) {
  let value = bytes; const writes = [];
  const fake = {
    mkdirSync() {}, existsSync: () => exists,
    readFileSync() { if (!exists) throw Object.assign(Error('fixture missing'), { code: 'ENOENT' }); return value; },
    writeFileSync(file, data) { writes.push(file); if (writeFails) throw Error('fixture write failed'); if (!file.endsWith('.tmp')) value = data; },
    renameSync() { if (renameFails) throw Error('fixture rename failed'); }, unlinkSync() {}
  };
  const module = { exports: {} };
  new Function('require', 'module', storeSource)(name => name === 'fs' ? fake : require(name), module);
  return { api: module.exports, writes, bytes: () => value };
}

test('review safety: malformed JSON and invalid document shape fail closed, while a missing file is a legitimate empty run', () => {
  for (const bytes of ['{broken fixture', 'null', '[]', '{"reviewRows":"not an array"}', '{"reviewRows":[null]}',
    '{"reviewRows":[{"note":"fixture-private"}]}', '{"reviewRows":[],"settings":[]}']) {
    const s = mockedStore({ bytes });
    assert.throws(() => s.api.loadContactReview('fixture-store', 'run-A'), e => e.code === 'CONTACT_REVIEW_READ_FAILED');
    assert.equal(s.bytes(), bytes); assert.deepEqual(s.writes, []);
  }
  assert.deepEqual(mockedStore({ exists: false }).api.loadContactReview('fixture-store', 'run-A').reviewRows, []);
});

test('review safety F2: a false existence probe cannot bypass EACCES reads even when rename could overwrite', () => {
  let original = JSON.stringify({ reviewRows: [{ rowId: 'row', note: 'old fixture' }], settings: {} });
  const before = original; let reads = 0, writes = 0, renames = 0;
  const fake = { mkdirSync() {}, existsSync: () => false,
    readFileSync() { reads++; throw Object.assign(Error('fixture-private read denial'), { code: 'EACCES' }); },
    writeFileSync() { writes++; }, renameSync() { renames++; original = 'overwritten'; }, unlinkSync() {} };
  const module = { exports: {} };
  new Function('require', 'module', storeSource)(name => name === 'fs' ? fake : require(name), module);
  for (const method of ['loadContactReview', 'saveContactReview']) {
    assert.throws(() => module.exports[method]('fixture-store', 'run-A'), e => {
      assert.equal(e.code, 'CONTACT_REVIEW_READ_FAILED'); assert.doesNotMatch(e.message, /fixture-private/); return true;
    });
  }
  assert.equal(reads, 2); assert.equal(writes, 0); assert.equal(renames, 0); assert.equal(original, before);
});

test('review safety F2: existence-probe failure and every non-ENOENT read error fail closed', () => {
  for (const code of ['EACCES', 'EPERM', 'EIO', undefined]) {
    let reads = 0, probes = 0, writes = 0; const module = { exports: {} };
    const fake = { mkdirSync() {}, existsSync() { probes++; throw Object.assign(Error('fixture probe denied'), { code: 'EACCES' }); },
      readFileSync() { reads++; throw Object.assign(Error('fixture-private read failure'), { code }); },
      writeFileSync() { writes++; }, renameSync() {}, unlinkSync() {} };
    new Function('require', 'module', storeSource)(name => name === 'fs' ? fake : require(name), module);
    for (const method of ['loadContactReview', 'saveContactReview']) {
      assert.throws(() => module.exports[method]('fixture-store', 'run-A'), e => e.code === 'CONTACT_REVIEW_READ_FAILED');
    }
    assert.equal(reads, 2); assert.equal(probes, 0); assert.equal(writes, 0);
  }
});

test('review safety F2: only a direct ENOENT read initializes a missing run and permits its first atomic save', () => {
  let reads = 0, writes = 0, renames = 0; const module = { exports: {} };
  const fake = { mkdirSync() {}, existsSync() { throw Error('must not probe'); },
    readFileSync() { reads++; throw Object.assign(Error('fixture missing'), { code: 'ENOENT' }); },
    writeFileSync(file) { assert.match(file, /\.tmp$/); writes++; }, renameSync() { renames++; } };
  new Function('require', 'module', storeSource)(name => name === 'fs' ? fake : require(name), module);
  assert.deepEqual(module.exports.loadContactReview('fixture-store', 'run-A').reviewRows, []);
  assert.deepEqual(module.exports.saveContactReview('fixture-store', 'run-A').reviewRows, []);
  assert.equal(reads, 2); assert.equal(writes, 1); assert.equal(renames, 1);
});

test('review safety: corrupt persisted review cannot reach preview or any automatic overwrite', async () => {
  const s = mockedStore({ bytes: '{truncated fixture' }), h = harness();
  h.evaluate("_contactLoadedRunDir='';_contactPreviewRunDir='';_contactPreviewRows=[];_contactReviewMap=new Map();");
  h.api.loadContactReview = async p => {
    try { return { ok: true, ...s.api.loadContactReview('fixture-store', p.runDir) }; }
    catch (e) { return { ok: false, code: e.code, error: e.message }; }
  };
  let previews = 0; h.api.getContactPreview = async () => { previews++; return { ok: true, rows: [] }; };
  await h.context.refreshContactPreview();
  assert.equal(previews, 0); assert.equal(h.calls.length, 0); assert.deepEqual(s.writes, []);
  assert.match(h.evaluate('_contactPreviewMeta.error'), /读取失败/);
});

test('review safety: failed IPC reads expose only bounded codes and block cached previews, pending and explicit stale saves', async () => {
  for (const code of ['CONTACT_REVIEW_READ_FAILED', 'CONTACT_REVIEW_RUN_INVALID']) {
    const h = harness(), snapshot = h.context.captureContactReviewSavePayload();
    h.api.loadContactReview = async () => ({ ok: false, code, error: 'fixture-private-content' });
    assert.equal(await h.context.loadContactReviewForRun(true), false);
    await h.context.saveContactReviewNow(snapshot); await h.context.saveContactReviewNow();
    h.context.scheduleContactReviewSave(); await h.context.refreshContactPreview();
    assert.equal(h.calls.length, 0); assert.equal(h.evaluate('_contactPendingSave'), null);
    assert.equal(h.evaluate('_contactPreviewMeta.code'), code);
    assert.doesNotMatch(h.evaluate('_msg'), /fixture-private/);
    assert.equal(h.evaluate("_contactReviewMap.get('row').note"), 'manual fixture');
  }
});

test('review safety: wrong-target successful IPC reads are rejected before replacing manual state or permitting saves', async () => {
  const h = harness(); h.api.loadContactReview = async () => ({ ok: true, runDir: 'run-other', reviewRows: [] });
  assert.equal(await h.context.loadContactReviewForRun(true), false);
  assert.equal(h.context.captureContactReviewSavePayload(), null);
  assert.equal(h.evaluate("_contactReviewMap.get('row').note"), 'manual fixture');
});

test('review safety: explicit successful read retry clears the gate without losing unsaved edits', async () => {
  const h = harness(); let fail = true;
  h.api.loadContactReview = async p => fail ? { ok: false, code: 'CONTACT_REVIEW_READ_FAILED' }
    : { ok: true, runDir: p.runDir, reviewRows: [], settings: { selectionPolicy: 'manual_opt_in_v1' } };
  h.context.scheduleContactReviewSave(); assert.equal(await h.context.loadContactReviewForRun(true), false);
  fail = false; await h.context.refreshContactPreview();
  assert.equal(h.evaluate("_contactReviewMap.get('row').note"), 'manual fixture');
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0][1].reviewRows[0].note, 'manual fixture');
});

test('review safety: edits made after a blocked read remain dirty even though no save can be queued', async () => {
  const h = harness(); h.api.loadContactReview = async () => ({ ok: false, code: 'CONTACT_REVIEW_READ_FAILED' });
  assert.equal(await h.context.loadContactReviewForRun(true), false);
  h.evaluate("_contactReviewMap.get('row').note='new blocked edit';scheduleContactReviewSave();");
  assert.equal(h.evaluate('_contactPendingSave'), null); assert.equal(h.calls.length, 0);
  assert.equal(await h.context.switchSelectedContactRun('run-B'), false);
  assert.equal(h.evaluate("_contactReviewMap.get('row').note"), 'new blocked edit');
});

test('review safety: direct saves cannot replace unreadable files and read errors never echo file contents', () => {
  const bytes = '{fixture-private-contact'; const s = mockedStore({ bytes });
  assert.throws(() => s.api.saveContactReview('fixture-store', 'run-A'), e => {
    assert.equal(e.code, 'CONTACT_REVIEW_READ_FAILED'); assert.doesNotMatch(e.message, /fixture-private/); return true;
  });
  assert.equal(s.bytes(), bytes); assert.deepEqual(s.writes, []);
});

test('review safety: failed review writes never truncate an existing valid file', () => {
  const bytes = JSON.stringify({ reviewRows: [{ rowId: 'row', note: 'old fixture' }], settings: {} });
  for (const options of [{ writeFails: true }, { renameFails: true }]) {
    const s = mockedStore({ bytes, ...options });
    assert.throws(() => s.api.saveContactReview('fixture-store', 'run-A', { reviewRows: [] }));
    assert.equal(s.bytes(), bytes);
    assert.ok(s.writes.every(file => file.endsWith('.tmp')));
  }
});

test('review safety: a temporary-name collision never deletes a file not created by this save', () => {
  const deleted = [], paths = [], module = { exports: {} };
  const fake = { mkdirSync() {}, existsSync: () => false,
    readFileSync() { throw Object.assign(Error('fixture missing'), { code: 'ENOENT' }); },
    writeFileSync(file) { paths.push(file); throw Object.assign(Error('fixture collision'), { code: 'EEXIST' }); },
    unlinkSync(file) { deleted.push(file); } };
  new Function('require', 'module', storeSource)(name => name === 'fs' ? fake : require(name), module);
  for (let i = 0; i < 2; i++) assert.throws(() => module.exports.saveContactReview('fixture-store', 'run-A'));
  assert.equal(new Set(paths).size, 2); assert.deepEqual(deleted, []);
});

test('review safety: export cannot dispatch for another run after awaiting the original review save', async () => {
  const gate = deferred(), h = harness(() => gate.promise);
  const exporting = h.exportButton().handlers.click(); await new Promise(setImmediate);
  const switching = h.context.switchSelectedContactRun('run-B'); gate.resolve({ ok: true });
  await Promise.all([exporting, switching]);
  assert.equal(h.calls.filter(c => c[0] === 'export').length, 0);
});

test('review safety: export uses its original immutable review snapshot and rejects obsolete DOM clicks', async () => {
  const gate = deferred(), h = harness(() => gate.promise), button = h.exportButton();
  const exporting = button.handlers.click(); await new Promise(setImmediate);
  h.evaluate("_contactReviewMap.get('row').note='later manual fixture';"); gate.resolve({ ok: true }); await exporting;
  const payload = h.calls.find(c => c[0] === 'export')[1];
  assert.equal(payload.runDir, 'run-A'); assert.equal(payload.reviewRows[0].note, 'manual fixture');
  await h.context.switchSelectedContactRun('run-B'); const count = h.calls.length;
  await button.handlers.click(); assert.equal(h.calls.length, count);
});

test('review safety: filtered export freezes rows and rejects failed saves and cross-run dispatch', async () => {
  for (const change of ['fail', 'switch', 'edit']) {
    const gate = deferred(), h = harness(() => gate.promise); let click;
    h.context.filteredContactRows = h.evaluate('_contactPreviewRows');
    h.context.buildContactSelectionExportSuffix = () => 'fixture';
    h.context.buildExportRowsFromContactRows = rows => rows.map(r => ({ ...r, ...h.evaluate(`_contactReviewMap.get('${r.rowId}')`) }));
    h.api.exportContactSelection = async p => { h.calls.push(['selection', structuredClone(p)]); return { ok: true }; };
    h.context.filterActions = { appendChild(button) { click = button; } };
    h.context.mkFilterBtn = (label, handler) => ({ click: handler });
    h.evaluate(section('    const selectionExportScope =', "    filterActions.appendChild(mkFilterBtn('清空筛选'"));
    const exporting = click.click(); await new Promise(setImmediate); let switching;
    if (change === 'switch') switching = h.context.switchSelectedContactRun('run-B');
    if (change === 'edit') h.evaluate("_contactReviewMap.get('row').note='later fixture';");
    gate.resolve({ ok: change !== 'fail' }); await exporting; if (switching) await switching;
    const exported = h.calls.filter(c => c[0] === 'selection');
    assert.equal(exported.length, change === 'edit' ? 1 : 0);
    if (change === 'edit') { assert.equal(exported[0][1].runDir, 'run-A'); assert.equal(exported[0][1].rows[0].note, 'manual fixture'); }
  }
});

test('review safety: import failures retain unsaved edits, never claim persistence, and prevent losing them on switch', async () => {
  for (const throws of [false, true]) {
    const h = harness(async () => { if (throws) throw Error('fixture failure'); return { ok: false }; });
    await h.context.importContactReviewWorkbookNow();
    assert.doesNotMatch(h.evaluate('_contactSaveStatus'), /已导入并保存/);
    assert.match(h.evaluate('_contactSaveStatus'), /保存失败/);
    assert.equal(h.evaluate("_contactReviewMap.get('row').note"), 'imported fixture');
    assert.equal(await h.context.switchSelectedContactRun('run-B'), false);
  }
});

test('review safety: late workbook selection cannot modify a replacement run, including A to B to A', async () => {
  for (const returnToA of [false, true]) {
    const gate = deferred(), h = harness(); h.api.importContactReviewWorkbook = () => gate.promise;
    const importing = h.context.importContactReviewWorkbookNow();
    await h.context.switchSelectedContactRun('run-B');
    if (returnToA) await h.context.switchSelectedContactRun('run-A');
    h.evaluate("_contactReviewMap=new Map([['row',{rowId:'row',note:'replacement fixture'}]]);_contactPreviewRows=[{rowId:'row',creatorUrl:'https://fixture.invalid/person'}];");
    gate.resolve({ ok: true, rows: [{ creatorUrl: 'https://fixture.invalid/person', note: 'old import' }] }); await importing;
    assert.equal(h.evaluate("_contactReviewMap.get('row').note"), 'replacement fixture');
    assert.equal(h.calls.length, 0);
  }
});

test('review safety: successful import saves once to the captured run and reports truthful completion', async () => {
  const h = harness(); await h.context.importContactReviewWorkbookNow();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0][1].runDir, 'run-A');
  assert.equal(h.calls[0][1].reviewRows[0].note, 'imported fixture');
  assert.match(h.evaluate('_contactSaveStatus'), /已导入并保存/);
});

function xhsHarness(save) {
  const h = harness(save); let listener, sequence = 0; const activations = [];
  h.context.window.crypto = { randomUUID: () => `11111111-1111-4111-8111-${String(++sequence).padStart(12, '0')}` };
  h.context.window.confirm = () => true;
  h.context.document.querySelector = () => null;
  h.context.buildExportRowsFromContactRows = rows => rows.map(row => ({ ...row }));
  h.context.createReviewViewportStateRegistry = () => ({ setActiveRow() {} });
  h.context.activateFixture = rowId => activations.push(rowId);
  h.context.getContactReviewViewportKey = () => 'fixture';
  h.evaluate('_contactReviewViewportStates.setActiveRow=(key,rowId)=>activateFixture(rowId);');
  h.context.window.desktopAPI.contacts = {
    onXhsProgress: fn => { listener = fn; },
    enrichXhsBatch: async p => ({ ok: true, runDir: p.runDir, jobId: p.jobId, updates: [], found: 0, failed: 0 })
  };
  vm.runInContext(section('function applyXhsContactUpdate(', 'function resetEmailHandoff('), h.context);
  h.context.ensureXhsContactProgressListener();
  return { ...h, activations, contacts: h.context.window.desktopAPI.contacts, event: payload => listener(payload),
    start: () => h.context.startXhsContactRows(h.evaluate('_contactPreviewRows'), 'fixture', { confirm: false }) };
}

test('review safety: XHS job UUID is captured before await and only exact scoped events may change state or schedule saves', async () => {
  const h = xhsHarness(), gate = deferred(); let request;
  h.contacts.enrichXhsBatch = p => { request = structuredClone(p); return gate.promise; };
  const running = h.start(); await new Promise(setImmediate);
  assert.match(request.jobId, /^[a-f0-9-]{14}4[a-f0-9-]{21}$/i);
  const before = h.evaluate('JSON.stringify([_contactReviewMap.get("row"),_xhsContactState])');
  for (const scope of [{}, { runDir: 'run-B', jobId: request.jobId }, { runDir: 'run-A', jobId: 'old-job' }]) {
    h.event({ type: 'item_start', ...scope, rowId: 'row' });
    h.event({ type: 'item_result', ...scope, update: { rowId: 'row', wechatId: 'wrong fixture' }, completed: 99 });
    h.event({ type: 'paused', ...scope, paused: true });
    assert.equal(h.evaluate('JSON.stringify([_contactReviewMap.get("row"),_xhsContactState])'), before);
    assert.equal(h.evaluate('_contactPendingSave'), null);
    assert.deepEqual(h.activations, []);
  }
  h.event({ type: 'item_start', runDir: request.runDir, jobId: request.jobId, rowId: 'row' });
  assert.deepEqual(h.activations, ['row']);
  h.event({ type: 'item_result', runDir: request.runDir, jobId: request.jobId, update: { rowId: 'row', wechatId: 'correct fixture' } });
  assert.equal(h.evaluate('_contactPendingSave.payload.runDir'), 'run-A');
  gate.resolve({ ok: true, runDir: request.runDir, jobId: request.jobId, updates: [], found: 1 });
  await running; assert.equal(h.calls.filter(c => c[0] === 'save').length, 1);
});

test('review safety: unmatched XHS final responses never apply results, persist or claim completion', async () => {
  for (const wrong of [{}, { runDir: 'run-B', jobId: 'wrong' }]) {
    const h = xhsHarness();
    h.contacts.enrichXhsBatch = async () => ({ ok: true, ...wrong, updates: [{ rowId: 'row', wechatId: 'wrong fixture' }] });
    const result = await h.start(); assert.equal(result.ok, false);
    assert.equal(h.evaluate("_contactReviewMap.get('row').wechatId"), undefined);
    assert.equal(h.calls.length, 0); assert.doesNotMatch(h.evaluate('_msg'), /补采完成/);
  }
});

test('review safety: switching blocks active XHS and late results after safe stop cannot affect another run', async () => {
  const h = xhsHarness(), gate = deferred(); let request;
  h.contacts.enrichXhsBatch = p => { request = structuredClone(p); return gate.promise; };
  const running = h.start(); await new Promise(setImmediate);
  assert.equal(await h.context.switchSelectedContactRun('run-B'), false);
  h.event({ type: 'stopped', runDir: request.runDir, jobId: request.jobId, running: false });
  assert.equal(await h.context.switchSelectedContactRun('run-B'), true);
  h.evaluate("_contactLoadedRunDir='run-B';_contactPreviewRunDir='run-B';_contactReviewMap=new Map([['row',{rowId:'row',note:'B fixture'}]]);");
  const before = h.evaluate('JSON.stringify([_xhsContactState,_contactReviewMap.get("row"),_msg])');
  h.event({ type: 'item_start', runDir: request.runDir, jobId: request.jobId, rowId: 'row' });
  h.event({ type: 'item_result', runDir: request.runDir, jobId: request.jobId, update: { rowId: 'row', wechatId: 'wrong fixture' } });
  gate.resolve({ ok: true, runDir: request.runDir, jobId: request.jobId, updates: [{ rowId: 'row', wechatId: 'wrong fixture' }] });
  await running;
  assert.equal(h.evaluate('JSON.stringify([_xhsContactState,_contactReviewMap.get("row"),_msg])'), before);
  assert.equal(h.evaluate('_contactPendingSave'), null); assert.equal(h.calls.length, 0);
});

test('review safety: an old job final response in the same run cannot replace a newer job or clear its scope', async () => {
  const h = xhsHarness(), old = deferred(), fresh = deferred(), requests = [];
  h.contacts.enrichXhsBatch = p => { requests.push(structuredClone(p)); return requests.length === 1 ? old.promise : fresh.promise; };
  const previous = h.start(); await new Promise(setImmediate);
  h.event({ type: 'stopped', ...requests[0], running: false });
  const current = h.start(); await new Promise(setImmediate);
  assert.notEqual(requests[0].jobId, requests[1].jobId);
  const before = h.evaluate('JSON.stringify([_xhsContactState,_contactReviewMap.get("row")])');
  h.event({ type: 'item_start', ...requests[0], rowId: 'row' });
  h.event({ type: 'item_result', ...requests[0], update: { rowId: 'row', wechatId: 'wrong old fixture' } });
  old.resolve({ ok: true, ...requests[0], updates: [{ rowId: 'row', wechatId: 'wrong old fixture' }] });
  await previous;
  assert.equal(h.evaluate('JSON.stringify([_xhsContactState,_contactReviewMap.get("row")])'), before);
  assert.equal(h.evaluate('_xhsContactScope.jobId'), requests[1].jobId); assert.equal(h.evaluate('_contactPendingSave'), null);
  assert.deepEqual(h.activations, []); assert.equal(h.calls.length, 0);
  fresh.resolve({ ok: true, ...requests[1], updates: [{ rowId: 'row', wechatId: 'new fixture' }], found: 1 });
  assert.equal((await current).ok, true); assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][1].reviewRows[0].wechatId, 'new fixture');
});

test('review safety: matching XHS completion cannot report saved success when local persistence fails', async () => {
  const h = xhsHarness(async () => ({ ok: false }));
  h.contacts.enrichXhsBatch = async p => ({ ok: true, runDir: p.runDir, jobId: p.jobId,
    updates: [{ rowId: 'row', wechatId: 'correct fixture' }], found: 1 });
  const result = await h.start(); assert.equal(result.ok, false);
  assert.match(h.evaluate('_msg'), /保存失败/); assert.doesNotMatch(h.evaluate('_msg'), /补采完成/);
  assert.equal(await h.context.switchSelectedContactRun('run-B'), false);
});

test('review safety: XHS unavailable UUID and stale control callbacks fail closed before dispatch or late UI updates', async () => {
  const missing = xhsHarness(); delete missing.context.window.crypto;
  assert.equal((await missing.start()).ok, false); assert.equal(missing.calls.length, 0);
  const h = xhsHarness(), gate = deferred(), control = deferred(); let request, stop;
  h.contacts.enrichXhsBatch = p => { request = structuredClone(p); return gate.promise; };
  let controls = 0; h.contacts.cancelXhsEnrichment = async () => { controls++; return control.promise; };
  const running = h.start(); await new Promise(setImmediate);
  h.context.makeSoftButton = (label, callback) => ({ click: callback });
  h.evaluate(section('  const xhsControlScope =', '  const btnReturnCollection =').replace('const btnCancelXhsContact =', 'var btnCancelXhsContact ='));
  stop = h.evaluate('btnCancelXhsContact'); const stopping = stop.click();
  h.event({ type: 'stopped', ...request, running: false });
  await h.context.switchSelectedContactRun('run-B'); const before = h.evaluate('JSON.stringify(_xhsContactState)');
  control.resolve({ ok: true }); await stopping;
  assert.equal(h.evaluate('JSON.stringify(_xhsContactState)'), before);
  await stop.click(); assert.equal(controls, 1);
  gate.resolve({ ok: true, ...request, updates: [] }); await running;
});

test('review safety: real Chrome 100-row edit disclosure and caret survive autosave with run/row isolation', {
  skip: !process.env.CHROME_PATH, timeout: 30000
}, async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    const context = await browser.newContext(); let requests = 0;
    await context.route('**/*', r => { requests++; return r.abort(); });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<!doctype html><meta charset="utf-8"><div id="mount"></div>');
    await page.evaluate(() => Object.defineProperty(window, 'localStorage', { value: {} }));
    const reading = source.includes('function bindContactReviewReading(')
      ? section('function bindContactReviewReading(', 'function resetContactPreviewState(') : '';
    await page.addScriptTag({ content: `
      const store={state:{exports:{}},set(){window.renderFixture();}};
      const createReviewViewportStateRegistry=()=>({});const loadOutreachTemplateLibrary=()=>({});
      const isPgyInviteBusy=()=>false;const resetEmailHandoff=()=>{};const getContactSettings=()=>({});
      const normalizeContactChannel=v=>v;const defaultFollowupStatus=r=>r.followupStatus||'';
      window.desktopAPI={exports:{saveContactReview:async()=>({ok:true})}};
      ${section('let _runs = [];', 'function setContactSaveStatus(')}
      ${section('function setMsg(', 'async function refreshRuns(')}
      ${section('function getReviewRows(', 'function getContactReviewViewportKey(')}
      ${section('function captureContactReviewSavePayload(', 'function getXiaomifengApprovalPayload(')}
      ${section('function scheduleContactReviewSave(', 'async function refreshContactPreview(')}
      ${reading}
      _selectedRunDir='run-A';_contactLoadedRunDir='run-A';_contactPreviewRunDir='run-A';
      for(let i=0;i<100;i++)_contactReviewMap.set('row-'+i,{rowId:'row-'+i,note:'',contactChannel:'微信建联'});
      function renderCard(rowId){const review=_contactReviewMap.get(rowId);
        ${section("      const fields = document.createElement('div');", '      card.appendChild(main);')}
        detail.dataset.rowId=rowId;return detail;
      }
      window.renderFixture=()=>document.getElementById('mount').replaceChildren(...Array.from(_contactReviewMap.keys()).map(renderCard));
      window.renderFixture();
    ` });
    assert.deepEqual(errors, []);
    const detail = page.locator('details[data-row-id="row-99"]');
    await detail.locator('summary').click(); const note = detail.getByLabel('备注', { exact: true });
    await note.fill('fictional note'); await note.evaluate(e => { e.focus(); e.setSelectionRange(3, 7); e.dispatchEvent(new Event('select')); });
    await page.waitForFunction(() => _contactSaveStatus.startsWith('已保存'));
    assert.equal(await detail.evaluate(e => e.open), true);
    assert.deepEqual(await note.evaluate(e => [e === document.activeElement, e.selectionStart, e.selectionEnd]), [true, 3, 7]);
    await page.evaluate(() => { window.desktopAPI.exports.saveContactReview=async()=>({ok:false}); });
    await note.fill('fictional failed note'); await note.focus();
    await page.waitForFunction(() => _contactSaveStatus.startsWith('自动保存失败'));
    assert.equal(await detail.evaluate(e => e.open), true);
    assert.equal(await note.evaluate(e => e === document.activeElement), true);
    const other = page.locator('details[data-row-id="row-98"]'); assert.equal(await other.evaluate(e => e.open), false);
    await detail.locator('summary').click(); await page.evaluate(() => window.renderFixture());
    assert.equal(await detail.evaluate(e => e.open), false);
    await detail.locator('summary').click();
    await page.evaluate(() => { window.oldDetail=document.querySelector('details[data-row-id="row-99"]');
      _selectedRunDir='run-B';window.renderFixture(); });
    assert.equal(await detail.evaluate(e => e.open), false);
    await page.evaluate(() => { window.oldDetail.open=false;window.oldDetail.dispatchEvent(new Event('toggle'));
      _selectedRunDir='run-A';window.renderFixture(); });
    assert.equal(await detail.evaluate(e => e.open), true);
    assert.equal(await note.evaluate(e => e === document.activeElement), false, 'reading state must not restore focus across runs');
    assert.equal(requests, 0); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
