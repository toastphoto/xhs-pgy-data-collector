const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const rendererPath = path.join(__dirname, '..', 'renderer', 'views', 'exports.js');
const source = fs.readFileSync(rendererPath, 'utf8');
// Execute the actual renderer, replacing only module imports and external boundaries.
const script = new vm.Script(source.slice(source.indexOf('let _runs = [];')).replace(/^export /gm, ''), { filename: rendererPath });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.handlers = {};
    this.style = {};
    this.disabled = false;
  }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(name, callback) { this.handlers[name] = callback; }
  setAttribute(name, value) { this[name] = value; }
  remove() {}
}

function harness(overrides = {}) {
  const calls = [];
  const timers = [];
  const confirmations = [];
  const handlers = {
    checkLogin: async () => ({ ok: true, loggedIn: true }),
    openAccount: async () => ({ ok: true }),
    openCreator: async () => ({ ok: true }),
    prepare: async ({ rowId, template }) => ({ ok: true, creatorName: rowId, template, token: 'fixture-token', fingerprint: 'fixture-fingerprint' }),
    sendPrepared: async ({ rowId }) => ({ ok: true, creatorName: rowId, clicked: true, outcome: 'success-confirmed' }),
    ...overrides
  };
  const api = Object.fromEntries(Object.keys(handlers).map((name) => [name, (...args) => {
    calls.push({ name, args: JSON.parse(JSON.stringify(args)) });
    return handlers[name](...args);
  }]));
  const context = vm.createContext({
    window: { localStorage: {}, confirm: (message) => { confirmations.push(message); return true; }, desktopAPI: { invites: api } },
    document: { querySelectorAll: () => [], createElement: (tag) => new Element(tag) },
    store: { state: {}, set() {} },
    createReviewViewportStateRegistry: () => ({ setActiveRow() {} }),
    loadOutreachTemplateLibrary: () => ({}),
    setTimeout: (callback, ms) => { timers.push({ callback, ms }); return timers.length; },
    clearTimeout() {}
  });
  script.runInContext(context);
  const evaluate = (code) => vm.runInContext(code, context);
  evaluate(`
    _selectedRunDir = 'fixture-run-a';
    _contactPgyBrandName = 'fixture-brand';
    _contactPgyProductName = 'fixture-product';
    _contactPgyContactWay = 'fixture-contact';
    _contactPgyIntro = 'fixture-intro';
    _contactPgyPublishStart = '2026-10-01';
    _contactPgyPublishEnd = '2026-10-02';
    _contactComposerMethod = '\u84b2\u516c\u82f1\u9080\u7ea6';
    _contactPreviewRows = ['A', 'B', 'C'].map(rowId => ({
      rowId, creatorName: rowId, creatorUrl: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/fixture-' + rowId,
      selected: true, contactChannel: '\u84b2\u516c\u82f1\u9080\u7ea6'
    }));
    _contactPreviewRows.forEach(ensureReviewRow);
    scheduleContactReviewSave = () => {};
  `);
  return {
    calls, timers, confirmations, handlers, context, evaluate,
    read: (code) => JSON.parse(evaluate(`JSON.stringify(${code})`)),
    count: (name) => calls.filter((call) => call.name === name).length,
    start: (count = 2) => evaluate(`startPgyInviteBatch(_contactPreviewRows.slice(0, ${count}))`),
    singlePrepare: () => evaluate("preparePgyInviteForRow(_contactPreviewRows[0], 'A')"),
    send: () => evaluate('sendCurrentPgyInviteBatchItem()'),
    stop: () => evaluate('stopPgyInviteBatch()'),
    edit: () => evaluate("_contactPgyIntro = 'edited'; invalidatePgyInviteDrafts()"),
    async flush() { await new Promise(setImmediate); },
    cooldown() {
      assert.equal(timers.length, 1);
      const timer = timers.shift();
      assert.equal(timer.ms, 5000);
      timer.callback();
    }
  };
}

test('startup acquires ownership before login: double-click, single, navigation and run switch are blocked', async () => {
  const gate = deferred();
  const h = harness({ checkLogin: () => gate.promise });
  const started = h.start();
  assert.equal(h.read('_pgyInviteBatchState.status'), 'starting');
  await h.start();
  await h.singlePrepare();
  await h.evaluate("openPgyInviteForRow(_contactPreviewRows[1], 'B')");
  await h.evaluate('updatePgyInviteAccount(false)');
  await h.evaluate('updatePgyInviteAccount(true)');
  assert.equal(await h.evaluate("switchSelectedContactRun('fixture-run-b')"), false);
  assert.equal(h.count('checkLogin'), 1);
  assert.equal(h.count('openCreator'), 0);
  gate.resolve({ ok: true, loggedIn: true });
  await started;
  assert.equal(h.count('openCreator'), 1);
  assert.equal(h.count('prepare'), 1);
  assert.equal(h.count('sendPrepared'), 0);
  assert.equal(h.read('_pgyInviteBatchState.status'), 'awaiting_confirmation');
});

test('single preparation excludes other rows, batch startup and account changes', async () => {
  const gate = deferred();
  const h = harness({ prepare: () => gate.promise });
  const prepared = h.singlePrepare();
  await h.flush();
  await h.start();
  await h.evaluate("preparePgyInviteForRow(_contactPreviewRows[1], 'B')");
  await h.evaluate('updatePgyInviteAccount(false)');
  assert.equal(h.count('checkLogin'), 0);
  assert.equal(h.count('prepare'), 1);
  gate.resolve({ ok: true, token: 'fixture', fingerprint: 'fixture' });
  await prepared;
  assert.equal(h.read('isPgyInviteBusy()'), false);
});

for (const phase of ['openCreator', 'prepare']) {
  for (const change of ['template', 'run', 'recipient']) {
    test(`${change} change during ${phase} cannot restore a stale ready draft`, async () => {
      const gate = deferred();
      const h = harness({ [phase]: () => gate.promise });
      const prepared = h.singlePrepare();
      await h.flush();
      if (change === 'template') h.edit();
      if (change === 'run') h.evaluate("_selectedRunDir = 'fixture-run-b'");
      if (change === 'recipient') h.evaluate("_contactPreviewRows[0].creatorUrl += '-changed'");
      gate.resolve({ ok: true, token: 'obsolete', fingerprint: 'obsolete' });
      const result = await prepared;
      assert.equal(result.code, 'PGY_INVITE_CONTEXT_CHANGED');
      assert.equal(h.read("Array.from(_pgyInviteDraftStates.values()).some(state => state.status === 'ready' || state.status === 'preparing')"), false);
      if (phase === 'openCreator') assert.equal(h.count('prepare'), 0);
      assert.equal(h.read('isPgyInviteBusy()'), false);
    });
  }
}

test('same-value edit still invalidates a pending draft by revision', async () => {
  const gate = deferred();
  const h = harness({ prepare: () => gate.promise });
  const prepared = h.singlePrepare();
  await h.flush();
  h.evaluate('invalidatePgyInviteDrafts()');
  gate.resolve({ ok: true, token: 'obsolete', fingerprint: 'obsolete' });
  await prepared;
  assert.equal(h.read("getPgyInviteDraftState('A')"), null);
});

for (const phase of ['checkLogin', 'openCreator', 'prepare']) {
  test(`stop during ${phase} settles without downstream work and permits restart`, async () => {
    const gate = deferred();
    const h = harness({ [phase]: () => gate.promise });
    const started = h.start();
    await h.flush();
    h.stop();
    assert.equal(h.read('_pgyInviteBatchState.status'), 'stopping');
    await h.start();
    gate.resolve({ ok: true, loggedIn: true, token: 'fixture', fingerprint: 'fixture' });
    await started;
    assert.equal(h.read('_pgyInviteBatchState.status'), 'stopped');
    assert.equal(h.read('isPgyInviteBusy()'), false);
    assert.equal(h.read("getPgyInviteDraftState('A')"), null);
    if (phase !== 'prepare') assert.equal(h.count('prepare'), 0);
    assert.equal(h.count('sendPrepared'), 0);
    await h.start();
    assert.equal(h.read('_pgyInviteBatchState.status'), 'awaiting_confirmation');
  });
}

for (const phase of ['checkLogin', 'openCreator', 'prepare']) {
  for (const stop of [false, true]) {
    test(`${phase} rejection ${stop ? 'after stop' : 'without stop'} releases ownership`, async () => {
      const gate = deferred();
      const h = harness({ [phase]: () => gate.promise });
      const started = h.start();
      await h.flush();
      if (stop) h.stop();
      gate.reject(new Error('synthetic IPC rejection'));
      await started;
      assert.equal(h.read('_pgyInviteOperation'), null);
      assert.equal(h.read('_pgyInviteBatchState.status'), stop || phase === 'checkLogin' ? 'stopped' : 'error');
      h.stop();
      assert.equal(h.read('isPgyInviteBusy()'), false);
    });
  }
}

test('retry after preparation failure is single-flight', async () => {
  const h = harness({ prepare: async () => ({ ok: false, error: 'fixture failure' }) });
  await h.start();
  const gate = deferred();
  h.handlers.prepare = () => gate.promise;
  const retry = h.evaluate('prepareCurrentPgyInviteBatchItem()');
  await h.flush();
  await h.evaluate('prepareCurrentPgyInviteBatchItem()');
  assert.equal(h.count('prepare'), 2);
  gate.resolve({ ok: true, token: 'fixture', fingerprint: 'fixture' });
  await retry;
  assert.equal(h.read('_pgyInviteBatchState.status'), 'awaiting_confirmation');
});

test('canceling send leaves the ready recipient unchanged and sends nothing', async () => {
  const h = harness();
  await h.start();
  h.context.window.confirm = () => false;
  await h.send();
  assert.equal(h.count('sendPrepared'), 0);
  assert.equal(h.read('_pgyInviteBatchState.status'), 'awaiting_confirmation');
  assert.equal(h.read("getPgyInviteDraftState('A').status"), 'ready');
});

test('send double-click and single-send overlap dispatch exactly once', async () => {
  const gate = deferred();
  const h = harness({ sendPrepared: () => gate.promise });
  await h.start(1);
  const sending = h.send();
  await h.send();
  await h.evaluate("sendPreparedPgyInviteForRow(_contactPreviewRows[0], 'A')");
  await h.evaluate('updatePgyInviteAccount(false)');
  assert.equal(h.count('sendPrepared'), 1);
  gate.resolve({ ok: true, outcome: 'success-confirmed' });
  await sending;
  assert.equal(h.read('_pgyInviteBatchState.status'), 'completed');
  assert.equal(h.read('_pgyInviteBatchState.results.length'), 1);
});

for (const outcome of ['success-confirmed', 'submitted-unconfirmed', 'failure', 'rejection']) {
  for (const change of ['stop', 'edit']) {
    test(`${change} during send preserves ${outcome} for A and never advances B`, async () => {
      const gate = deferred();
      const h = harness({ sendPrepared: () => gate.promise });
      await h.start();
      const id = h.read('_pgyInviteBatchState.id');
      const sending = h.send();
      if (change === 'stop') h.stop();
      else h.edit();
      await h.evaluate('startPgyInviteBatch([_contactPreviewRows[1]])');
      assert.equal(h.read('_pgyInviteBatchState.id'), id);
      assert.equal(h.read('_pgyInviteBatchState.status'), 'stopping');
      if (outcome === 'rejection') gate.reject(new Error('synthetic outcome exception'));
      else gate.resolve(outcome === 'failure' ? { ok: false, error: 'not clicked' } : { ok: true, clicked: true, outcome });
      await sending;
      assert.equal(h.read('_pgyInviteBatchState.status'), 'stopped');
      assert.equal(h.read('_pgyInviteOperation'), null);
      assert.equal(h.read("_contactReviewMap.get('B').selected"), true);
      assert.equal(h.count('openCreator'), 1);
      assert.equal(h.timers.length, 0);
      if (outcome === 'success-confirmed') {
        assert.equal(h.read("_contactReviewMap.get('A').selected"), false);
        assert.equal(h.read('_pgyInviteBatchState.results[0].rowId'), 'A');
      }
      if (outcome === 'submitted-unconfirmed' || outcome === 'rejection') {
        assert.equal(h.read("getPgyInviteDraftState('A').status"), 'submitted');
        await h.start();
        await h.singlePrepare();
        assert.equal(h.count('prepare'), 1);
      }
    });
  }
}

test('late completion cannot mutate a replacement batch or its recipient', async () => {
  const gate = deferred();
  const h = harness({ sendPrepared: () => gate.promise });
  await h.start();
  const sending = h.send();
  // Simulate an out-of-band replacement as defense in depth beyond the UI lock.
  h.evaluate("_pgyInviteBatchState = { ..._pgyInviteBatchState, id: 999, batchId: 999, rowIds: ['B'], currentIndex: 0, results: [], status: 'preparing' }");
  gate.resolve({ ok: true, outcome: 'success-confirmed' });
  await sending;
  assert.equal(h.read('_pgyInviteBatchState.id'), 999);
  assert.equal(h.read('_pgyInviteBatchState.status'), 'preparing');
  assert.equal(h.read('_pgyInviteBatchState.results.length'), 0);
  assert.equal(h.read("_contactReviewMap.get('B').selected"), true);
});

for (const outcome of ['submitted-unconfirmed', 'rejection', 'clicked-failure']) {
  test(`${outcome} requires explicit manual review before retry`, async () => {
    const h = harness({ sendPrepared: async () => {
      if (outcome === 'rejection') throw new Error('synthetic outcome exception');
      if (outcome === 'clicked-failure') return { ok: false, clicked: true, error: 'synthetic post-click failure' };
      return { ok: true, clicked: true, outcome };
    } });
    await h.start();
    await h.send();
    assert.equal(h.read('_pgyInviteBatchState.status'), 'checking_result');
    await h.evaluate('prepareCurrentPgyInviteBatchItem()');
    assert.equal(h.count('prepare'), 1);
    h.context.window.confirm = () => false;
    await h.evaluate('reviewPgyInviteOutcome(_contactPreviewRows[0], false)');
    assert.equal(h.read('_pgyInviteBatchState.status'), 'checking_result');
    h.context.window.confirm = () => true;
    await h.evaluate('reviewPgyInviteOutcome(_contactPreviewRows[0], false)');
    assert.equal(h.read('_pgyInviteBatchState.status'), 'error');
    await h.evaluate('prepareCurrentPgyInviteBatchItem()');
    assert.equal(h.count('prepare'), 2);
    assert.equal(h.count('sendPrepared'), 1);
  });
}

test('stopped unknown result can be reviewed after a different batch has completed', async () => {
  const h = harness({ sendPrepared: async () => ({ ok: true, outcome: 'submitted-unconfirmed' }) });
  await h.start(1);
  await h.send();
  h.stop();
  h.edit();
  h.handlers.sendPrepared = async () => ({ ok: true, outcome: 'success-confirmed' });
  await h.evaluate('startPgyInviteBatch([_contactPreviewRows[1]])');
  await h.send();
  await h.evaluate('reviewPgyInviteOutcome(_contactPreviewRows[0], true)');
  assert.equal(h.read("getPgyInviteDraftState('A').status"), 'sent');
  assert.equal(h.read("_contactReviewMap.get('A').selected"), false);
});

test('single confirmed success updates recipient bookkeeping without advancing a batch', async () => {
  const h = harness();
  await h.singlePrepare();
  await h.evaluate("sendPreparedPgyInviteForRow(_contactPreviewRows[0], 'A')");
  assert.equal(h.read("_contactReviewMap.get('A').selected"), false);
  assert.equal(h.read("_contactReviewMap.get('A').followupStatus"), '\u5df2\u5efa\u8054');
  assert.equal(h.read('_pgyInviteBatchState.status'), 'idle');
});

test('single unknown result stays unhandled and cannot be retried after editing', async () => {
  const h = harness({ sendPrepared: async () => ({ ok: true, clicked: true, outcome: 'submitted-unconfirmed' }) });
  await h.singlePrepare();
  await h.evaluate("sendPreparedPgyInviteForRow(_contactPreviewRows[0], 'A')");
  h.edit();
  await h.singlePrepare();
  await h.start();
  assert.equal(h.count('prepare'), 1);
  assert.equal(h.count('checkLogin'), 0);
  assert.equal(h.read("_contactReviewMap.get('A').selected"), true);
  assert.equal(h.read("getPgyInviteDraftState('A').status"), 'submitted');
  await h.evaluate('reviewPgyInviteOutcome(_contactPreviewRows[0], false)');
  await h.singlePrepare();
  assert.equal(h.count('prepare'), 2);
  assert.equal(h.count('sendPrepared'), 1);
});

test('editing during cooldown retains ownership until its timer settles', async () => {
  const h = harness();
  await h.start();
  const next = h.evaluate("advancePgyInviteBatch('manual', 'fixture manual review')");
  h.edit();
  await h.start();
  assert.equal(h.count('checkLogin'), 1);
  assert.equal(h.read('_pgyInviteBatchState.status'), 'stopping');
  h.cooldown();
  await next;
  assert.equal(h.count('prepare'), 1);
  assert.equal(h.read('_pgyInviteBatchState.status'), 'stopped');
  await h.evaluate('startPgyInviteBatch([_contactPreviewRows[1]])');
  assert.equal(h.read('_pgyInviteBatchState.status'), 'awaiting_confirmation');
  assert.equal(h.count('prepare'), 2);
});

test('editing a ready draft removes its authority to dispatch a send', async () => {
  const h = harness();
  await h.singlePrepare();
  h.edit();
  const sent = await h.evaluate("sendPreparedPgyInviteForRow(_contactPreviewRows[0], 'A')");
  assert.equal(sent.code, 'PGY_INVITE_CONFIRMATION_REQUIRED');
  assert.equal(h.count('sendPrepared'), 0);
  assert.equal(h.confirmations.length, 0);
});

test('late single-send outcome never modifies another run or replacement recipient', async () => {
  for (const change of ['run', 'recipient']) {
    const gate = deferred();
    const h = harness({ sendPrepared: () => gate.promise });
    await h.singlePrepare();
    const sent = h.evaluate("sendPreparedPgyInviteForRow(_contactPreviewRows[0], 'A')");
    if (change === 'run') h.evaluate("_selectedRunDir = 'fixture-run-b'");
    else h.evaluate("_contactPreviewRows[0].creatorUrl += '-replacement'");
    h.evaluate("_contactReviewMap = new Map([['A', { selected: true, followupStatus: 'untouched' }]])");
    gate.resolve({ ok: true, outcome: 'success-confirmed' });
    await sent;
    assert.equal(h.read("_contactReviewMap.get('A').followupStatus"), 'untouched');
    assert.equal(h.read("_contactReviewMap.get('A').selected"), true);
  }
});

test('double next cannot skip B and stop during cooldown prevents its preparation', async () => {
  const h = harness();
  await h.start();
  const next = h.evaluate("advancePgyInviteBatch('manual', 'fixture manual review')");
  await h.evaluate("advancePgyInviteBatch('manual', 'duplicate click')");
  assert.equal(h.read('_pgyInviteBatchState.currentIndex'), 1);
  assert.equal(h.read('_pgyInviteBatchState.results.length'), 1);
  assert.equal(h.read("_contactReviewMap.get('B').selected"), true);
  h.stop();
  h.cooldown();
  await next;
  assert.equal(h.read('_pgyInviteBatchState.status'), 'stopped');
  assert.equal(h.count('prepare'), 1);
});

test('successful serial batch observes cooldown and separate human confirmation for B', async () => {
  const h = harness();
  await h.start();
  const first = h.send();
  await h.flush();
  assert.equal(h.read('_pgyInviteBatchState.status'), 'cooldown');
  assert.equal(h.count('prepare'), 1);
  h.cooldown();
  await first;
  assert.equal(h.count('prepare'), 2);
  assert.equal(h.count('sendPrepared'), 1);
  assert.equal(h.read('_pgyInviteBatchState.status'), 'awaiting_confirmation');
  await h.send();
  assert.equal(h.count('sendPrepared'), 2);
  assert.equal(h.read('_pgyInviteBatchState.status'), 'completed');
  assert.deepEqual(h.read('_pgyInviteBatchState.results.map(item => item.rowId)'), ['A', 'B']);
  assert.equal(h.confirmations.length, 3);
});

test('one unsent batch prepares A then B without restart, send or contact bookkeeping', async () => {
  const h = harness();
  const before = h.read('Array.from(_contactReviewMap.entries())');
  await h.start();
  const batchId = h.read('_pgyInviteBatchState.id');
  const next = h.evaluate("advancePgyInviteBatch('unsent', 'prepared without sending')");
  await h.evaluate("advancePgyInviteBatch('unsent', 'double click')");
  assert.equal(h.read('_pgyInviteBatchState.status'), 'cooldown');
  assert.equal(h.read("getPgyInviteDraftState('A').status"), 'unsent');
  assert.equal(h.evaluate("getPgyInviteDraftState('A').prepared"), undefined);
  assert.equal((await h.evaluate("sendPreparedPgyInviteForRow(_contactPreviewRows[0], 'A')")).ok, false);
  h.cooldown();
  await next;
  assert.equal(h.read('_pgyInviteBatchState.id'), batchId);
  assert.equal(h.read('_pgyInviteBatchState.currentIndex'), 1);
  assert.equal(h.read('_pgyInviteBatchState.status'), 'awaiting_confirmation');
  assert.equal(h.count('checkLogin'), 1);
  assert.deepEqual(h.calls.filter(c => c.name === 'prepare').map(c => c.args[0].rowId), ['A', 'B']);
  await h.evaluate("advancePgyInviteBatch('unsent', 'prepared without sending')");
  assert.equal(h.read('_pgyInviteBatchState.status'), 'completed');
  assert.deepEqual(h.read('_pgyInviteBatchState.results.map(item => item.status)'), ['unsent', 'unsent']);
  assert.match(h.read('_pgyInviteBatchState.message'), /已准备未发送 2 位/);
  assert.equal(h.count('sendPrepared'), 0);
  assert.equal(h.confirmations.length, 1);
  assert.deepEqual(h.read('Array.from(_contactReviewMap.entries())'), before);
  assert.equal(h.read("getPgyInviteDraftState('B').status"), 'unsent');
  assert.equal(h.evaluate("getPgyInviteDraftState('B').prepared"), undefined);
  const rejected = await h.evaluate("sendPreparedPgyInviteForRow(_contactPreviewRows[1], 'B')");
  assert.equal(rejected.code, 'PGY_INVITE_CONFIRMATION_REQUIRED');
  assert.equal(h.count('sendPrepared'), 0);
  assert.equal(h.confirmations.length, 1);
});

test('brand choice resumes the current batch and reuses the canonical name for B', async () => {
  const h = harness({ prepare: async ({template}) => template.brandName === 'Example Brand'
    ? {ok:true,token:'fixture',fingerprint:'fixture',template}
    : {ok:false,code:'PGY_INVITE_BRAND_SELECTION_REQUIRED',brandCandidates:[{label:'Example Brand'},{label:'Example Brand Plus'}]} });
  await h.start();
  const id = h.read('_pgyInviteBatchState.id');
  assert.equal(h.read('_pgyInviteBatchState.status'),'awaiting_brand');
  assert.equal(h.read("getPgyInviteDraftState('A').status"),'brand_selection');
  assert.equal(h.read('isPgyInviteBusy()'),true);
  await h.evaluate(`continuePgyInviteWithBrand(_contactPreviewRows[0], 'A', 'Example Brand', ${id})`);
  assert.equal(h.read('_pgyInviteBatchState.id'),id);
  assert.equal(h.read('_pgyInviteBatchState.currentIndex'),0);
  assert.equal(h.read('_pgyInviteBatchState.status'),'awaiting_confirmation');
  assert.equal(h.read('_contactPgyBrandName'),'Example Brand');
  const next=h.evaluate("advancePgyInviteBatch('unsent', 'not sent')");h.cooldown();await next;
  assert.equal(h.read('_pgyInviteBatchState.currentIndex'),1);
  assert.equal(h.read('_pgyInviteBatchState.status'),'awaiting_confirmation');
  assert.equal(h.calls.filter(call=>call.name==='prepare').at(-1).args[0].template.brandName,'Example Brand');
  assert.equal(h.count('checkLogin'),1);
  assert.equal(h.count('sendPrepared'),0);
  assert.equal(h.read("_contactReviewMap.get('A').selected"),true);
});

for (const change of ['stop','template','run','recipient','unlisted','wrong-row']) {
  test(`stale or invalid brand choice after ${change} cannot resume`, async () => {
    const h=harness({prepare:async()=>({ok:false,code:'PGY_INVITE_BRAND_SELECTION_REQUIRED',brandCandidates:[{label:'Example Brand'}]})});
    await h.start();const id=h.read('_pgyInviteBatchState.id');
    if(change==='stop')h.stop();
    if(change==='template')h.edit();
    if(change==='run')h.evaluate("_selectedRunDir='replacement'");
    if(change==='recipient')h.evaluate("_contactPreviewRows[0].creatorUrl+='-changed'");
    await h.evaluate(`continuePgyInviteWithBrand(_contactPreviewRows[${change==='wrong-row'?1:0}], 'A', '${change==='unlisted'?'Other Brand':'Example Brand'}', ${id})`);
    assert.equal(h.count('prepare'),1);
    assert.equal(h.count('sendPrepared'),0);
  });
}

test('single brand choice still requires fresh preparation and never sends', async () => {
  const h=harness({prepare:async({template})=>template.brandName==='Example Brand'
    ? {ok:true,token:'fresh',fingerprint:'fresh',template}
    : {ok:false,code:'PGY_INVITE_BRAND_SELECTION_REQUIRED',brandCandidates:[{label:'Example Brand'}]}});
  await h.singlePrepare();
  await h.evaluate("continuePgyInviteWithBrand(_contactPreviewRows[0], 'A', 'Example Brand')");
  assert.equal(h.count('prepare'),2);
  assert.equal(h.count('sendPrepared'),0);
  assert.equal(h.read("getPgyInviteDraftState('A').status"),'ready');
  assert.equal(h.read('_pgyInviteBatchState.status'),'idle');
});

test('unsent next cannot discard an unknown send result or advance a failed preparation', async () => {
  for (const status of ['checking_result', 'error', 'sending', 'stopped']) {
    const h = harness();
    await h.start();
    h.evaluate(`_pgyInviteBatchState.status = '${status}'`);
    await h.evaluate("advancePgyInviteBatch('unsent', 'not allowed')");
    assert.equal(h.read('_pgyInviteBatchState.currentIndex'), 0);
    assert.equal(h.read('_pgyInviteBatchState.results.length'), 0);
    assert.equal(h.timers.length, 0);
    assert.equal(h.count('prepare'), 1);
  }
});

for (const change of ['stop', 'template']) {
  test(`${change} during unsent cooldown prevents preparing B without marking A contacted`, async () => {
    const h = harness();
    await h.start();
    const before = h.read('Array.from(_contactReviewMap.entries())');
    const next = h.evaluate("advancePgyInviteBatch('unsent', 'prepared without sending')");
    if (change === 'stop') h.stop(); else h.edit();
    h.cooldown();
    await next;
    assert.equal(h.read('_pgyInviteBatchState.status'), 'stopped');
    assert.equal(h.count('prepare'), 1);
    assert.equal(h.count('sendPrepared'), 0);
    assert.deepEqual(h.read('Array.from(_contactReviewMap.entries())'), before);
  });
}

test('run switch rechecks ownership after awaiting old review save', async () => {
  const gate = deferred();
  const h = harness();
  h.context.saveGate = gate.promise;
  h.evaluate('flushContactReviewSaveBeforeRunSwitch = () => saveGate');
  const switching = h.evaluate("switchSelectedContactRun('fixture-run-b')");
  await h.start();
  gate.resolve({ ok: true });
  assert.equal(await switching, false);
  assert.equal(h.read('_selectedRunDir'), 'fixture-run-a');
});

test('rendered row/account controls are disabled while busy; stale handlers also refuse IPC', async () => {
  const gate = deferred();
  const h = harness({ prepare: () => gate.promise });
  const preparing = h.singlePrepare();
  await h.flush();
  const accountSource = source.slice(source.indexOf('  const btnOpenPgyInvite ='), source.indexOf('  const pgyInviteAccountStatus ='));
  const accounts = h.evaluate(`(() => { const reviewTop = document.createElement('div'); ${accountSource}; return reviewTop; })()`);
  assert.equal(accounts.children.length, 2);
  for (const button of accounts.children) {
    assert.equal(button.disabled, true);
    await button.handlers.click();
  }
  const rowSource = source.slice(source.indexOf('          const pgyInviteLink ='), source.indexOf('          if (inviteDraftState?.message)'));
  const controls = h.evaluate(`(() => {
    const row = _contactPreviewRows[1], rowId = row.rowId, contactReviewViewportKey = 'fixture', reviewList = null;
    const creatorBlock = document.createElement('div'); ${rowSource}; return creatorBlock;
  })()`);
  assert.equal(controls.children.length, 2);
  for (const button of controls.children) {
    assert.equal(button.disabled, true);
    await button.handlers.click({ preventDefault() {} });
  }
  assert.equal(h.count('openCreator'), 1);
  assert.equal(h.count('openAccount'), 0);
  assert.equal(h.count('checkLogin'), 0);
  gate.resolve({ ok: true, token: 'fixture', fingerprint: 'fixture' });
  await preparing;
});

test('navigation invalidates existing readiness and rejected navigation releases ownership', async () => {
  const h = harness({ openAccount: async () => { throw new Error('synthetic navigation rejection'); } });
  await h.singlePrepare();
  await h.evaluate('updatePgyInviteAccount(false)');
  assert.equal(h.read("getPgyInviteDraftState('A')"), null);
  assert.equal(h.read('isPgyInviteBusy()'), false);
  await h.singlePrepare();
  await h.evaluate("openPgyInviteForRow(_contactPreviewRows[1], 'B')");
  assert.equal(h.read("getPgyInviteDraftState('A')"), null);
});

test('field mismatch detail is bounded and excludes contact/message payloads', () => {
  const h = harness();
  h.context.fixtureFields = [
    { label: '\u62a5\u5907\u54c1\u724c', expected: 'x'.repeat(200), actual: 'brand-b', found: true, verified: false },
    { label: '\u5f00\u59cb\u65e5\u671f', expected: '2026-10-01', actual: '', found: false, verified: false },
    { label: '\u7ed3\u675f\u65e5\u671f', expected: '2026-10-02', actual: '', found: true, verified: false },
    { label: '\u8054\u7cfb\u65b9\u5f0f', expected: 'private-contact', actual: 'private-actual', found: true, verified: false },
    { label: '\u5408\u4f5c\u5185\u5bb9\u4ecb\u7ecd', expected: 'private-intro', actual: 'private-body', found: true, verified: false }
  ];
  const message = h.evaluate("formatPgyInviteFailure({ error: 'fixture mismatch', fieldResults: fixtureFields })");
  assert.match(message, /brand-b/);
  assert.match(message, /\u672a\u80fd\u8bfb\u53d6/);
  assert.match(message, /\uff08\u7a7a\uff09/);
  assert.doesNotMatch(message, /private-|x{81}/);
});
