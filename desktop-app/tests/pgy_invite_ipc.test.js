const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  isAllowedPgyInviteNavigationUrl,
  normalizePgyInviteCreatorUrl,
  normalizePgyInviteFormUrl
} = require('../lib/pgy_invite');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Missing IPC source boundary: ${start}`);
  return source.slice(a, b);
}

// Execute the production handlers/guards, replacing only Electron, page reads and persisted rows.
const ipcSource = [
  section('function currentBrowserAutomationLock()', 'async function syncCollectionInteractionLock('),
  section('function liveBrowserContents(', 'function ensureCollectionTabActive('),
  section('function ensurePgyInviteBrowserTab()', 'function getRecordingsDir()'),
  section("ipcMain.handle('browser:activateTab'", 'async function pgyCheckLogin('),
  section('function beginPgyInviteOperation(', "ipcMain.handle('contacts:checkXhsLogin'")
].join('\n');

const base = 'https://pgy.xiaohongshu.com/solar/pre-trade/';
const creatorA = base + 'blogger-detail/mock-creator-a';
const creatorB = base + 'blogger-detail/mock-creator-b';
const formA = base + 'invite-form?id=mockform_a';
const formB = base + 'invite-form?id=mockform_b';
const point = { x: 10, y: 20 };
const ready = { ok: true, ready: true, finalAction: { point } };
const payload = { runDir: 'mock-run', rowId: 'a', template: {} };

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function until(predicate) {
  for (let i = 0; i < 30; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail('Mock operation did not reach the expected await');
}

function harness(initialUrl = creatorA) {
  const h = { now: Date.now(), calls: [], inputs: [], loads: [], handlers: {}, nextId: 1 };
  const registry = {
    activeId: 'collection',
    has: (id) => c.browserTabViews.has(id),
    add: () => {},
    activate: (id) => { registry.activeId = id; },
    close: (id) => { if (registry.activeId === id) registry.activeId = 'collection'; }
  };
  registry.discard = registry.close;
  function makeView(url) {
    const wc = new EventEmitter();
    Object.assign(wc, {
      id: h.nextId++, url, loading: false, destroyed: false,
      getURL: () => wc.url,
      isDestroyed: () => wc.destroyed,
      isLoadingMainFrame: () => wc.loading,
      stop: () => { wc.loading = false; h.stopped = true; },
      setWindowOpenHandler: (handler) => { wc.windowOpen = handler; },
      loadURL: async (nextUrl) => {
        h.loads.push(nextUrl);
        if (h.onLoad) await h.onLoad(nextUrl);
        h.navigate(nextUrl, { wc });
        if (h.onLoadResolved) h.onLoadResolved(wc);
      },
      executeJavaScript: async (script) => { h.calls.push(script); return h.onScript(script); },
      insertText: async () => {},
      sendInputEvent: (event) => {
        h.inputs.push({ ...event, url: wc.url });
        if (h.onInput) h.onInput(event);
        if (event.type === 'mouseUp' && c.pgyInviteOperation?.kind === 'prepare' && normalizePgyInviteCreatorUrl(wc.url)) {
          h.navigate(formA, { wc, native: true });
        }
      },
      canGoBack: () => true,
      canGoForward: () => true,
      goBack: () => h.navigate(creatorB, { wc }),
      goForward: () => h.navigate(formB, { wc }),
      reload: () => h.navigate(wc.url, { wc }),
      destroy: () => { wc.destroyed = true; wc.emit('destroyed'); }
    });
    return { webContents: wc };
  }
  const c = {
    URL, crypto, setTimeout, clearTimeout, setImmediate, Date: class extends Date { static now() { return h.now; } },
    pgyInviteDocumentProof: null, taskBrowserView: null, mailBrowserView: null, xhsBrowserView: null,
    pgyInvitePreparedDraft: null, pgyInviteOperation: null, pgyInvitePageGeneration: 1,
    pgyCandidateReadRunning: false, pgyCandidateCheckpointSession: null,
    taskRunner: { state: { running: false } }, xhsContactJob: { running: false },
    directPgyExtractionRunning: false, recordingReplayRunning: false, recordingEnabled: false,
    COLLECTION_TAB_ID: 'collection', AUTOMATION_TAB_ID: 'automation', XHS_TAB_ID: 'xhs',
    MAIL_TAB_ID: 'mail', PGY_INVITE_TAB_ID: 'invite', PGY_CANDIDATE_RESULTS_URL: base + 'note/kol',
    browserTabRegistry: registry, browserTabViews: new Map(), mainWindow: { isDestroyed: () => false },
    ipcMain: { handle: (name, handler) => { h.handlers[name] = handler; } },
    BrowserView: class { constructor() { return makeView(''); } },
    resolveInsideRuns: () => 'mock-run',
    getContactPreview: () => ({ rows: [
      { rowId: 'a', creatorName: 'Mock A', creatorUrl: creatorA },
      { rowId: 'b', creatorName: 'Mock B', creatorUrl: creatorB }
    ] }),
    resolveInviteTargetFromRows: (rows, rowId) => rows.find((row) => row.rowId === rowId),
    validatePgyInviteTemplate: (template) => ({ ok: true, template }),
    normalizePgyInviteCreatorUrl, normalizePgyInviteFormUrl, isAllowedPgyInviteNavigationUrl,
    isAllowedTaskUrl: isAllowedPgyInviteNavigationUrl,
    isPgyCandidateResultsUrl: () => false,
    normalizeXhsProfileUrl: () => '',
    sendActiveBrowserUrl: () => {}, sendBrowserTabsSnapshot: () => {}, applyBrowserBounds: () => {},
    getActiveBrowserView: () => c.browserTabViews.get(registry.activeId),
    pgyCheckLogin: async () => { h.calls.push('login'); return h.onLogin(); },
    pgyDetectRiskOnCurrentPage: async () => { h.calls.push('risk'); return h.onRisk(); },
    sleep: async (ms) => { h.now += ms; if (h.onSleep) await h.onSleep(ms); },
    buildPgyInviteEntryInspectScript: () => 'entry', buildPgyInvitePrepareScript: (_template, options) => {
      h.prepareOptions = [...(h.prepareOptions || []), options];
      return 'prepare';
    },
    buildPgyInviteSendScript: () => 'verify', buildPgyInviteOutcomeScript: () => 'outcome'
  };
  h.context = vm.createContext(c);
  vm.runInContext(ipcSource, h.context);
  c.browserView = makeView('about:blank');
  c.browserTabViews.set('collection', c.browserView);
  h.replaceView = (url) => {
    c.pgyInviteBrowserView = makeView(url);
    c.browserTabViews.set('invite', c.pgyInviteBrowserView);
    c.configureBrowserTabView(c.pgyInviteBrowserView, 'invite');
    if (url) c.pgyInviteBrowserView.webContents.emit('did-navigate', {}, url);
    return c.pgyInviteBrowserView.webContents;
  };
  h.replaceView(initialUrl);
  h.wc = () => c.pgyInviteBrowserView.webContents;
  h.navigate = (url, { wc = h.wc(), native = false, inPage = false } = {}) => {
    const event = { prevented: false, preventDefault() { this.prevented = true; } };
    if (native) wc.emit('will-navigate', event, url);
    if (event.prevented) return false;
    wc.loading = true;
    wc.emit('did-start-navigation', {}, url, inPage, true);
    wc.url = url;
    if (inPage) wc.emit('did-navigate-in-page', {}, url, true);
    else wc.emit('did-navigate', {}, url);
    wc.loading = false;
    return true;
  };
  h.onLogin = () => ({ ok: true, loggedIn: true, riskDetected: false });
  h.onRisk = () => ({ ok: true, riskDetected: false, url: h.wc().url });
  h.onScript = (script) => {
    if (script === 'entry') return { ok: true, action: { type: 'open-detail-form', point } };
    if (script === 'prepare') return { ok: true, readyToSend: true, formUrl: h.wc().url };
    if (script === 'verify') return ready;
    if (script === 'outcome') return { ok: true, outcome: 'success-confirmed' };
    throw new Error(`Unexpected mock script: ${script}`);
  };
  h.invoke = (name, data = payload) => h.handlers[name]({}, data);
  h.sendPayload = () => ({ ...payload, token: c.pgyInvitePreparedDraft?.token, fingerprint: c.pgyInvitePreparedDraft?.fingerprint });
  h.seedDraft = () => {
    c.pgyInvitePreparedDraft = {
      ...payload, token: 'mock-token', fingerprint: 'mock-fingerprint', expiresAt: h.now + 60000,
      creatorName: 'Mock A', creatorUrl: creatorA, formUrl: formA,
      webContentsId: h.wc().id, pageGeneration: c.pgyInvitePageGeneration
    };
    return h.sendPayload();
  };
  h.assertReleased = () => assert.equal(c.pgyInviteOperation, null);
  return h;
}

const tests = [];
const test = (name, run) => tests.push({ name, run });

test('destroyed invite contents are retired and recreated without accepting the old draft', async () => {
  const h = harness(formA);
  const oldPayload = h.seedDraft();
  const oldView = h.context.pgyInviteBrowserView;
  const contents = oldView.webContents;
  delete oldView.webContents;
  contents.destroy();
  assert.equal(h.context.pgyInvitePreparedDraft, null);
  assert.equal(h.context.pgyInviteDocumentProof, null);
  assert.equal(h.context.pgyInviteBrowserView, null);
  assert.equal(h.context.browserTabViews.has('invite'), false);
  assert.equal((await h.invoke('invites:openCreator')).ok, true);
  assert.notEqual(h.wc(), contents);
  assert.equal((await h.invoke('invites:sendPrepared', oldPayload)).ok, false);
  assert.equal(h.inputs.length, 0);
});

test('missing contents without a destroyed callback are safely replaced', async () => {
  const h = harness();
  delete h.context.pgyInviteBrowserView.webContents;
  assert.equal((await h.invoke('invites:openCreator')).ok, true);
  assert.ok(h.wc());
});

test('late old-view destruction cannot remove a replacement', () => {
  const h = harness();
  const old = h.wc();
  const replacement = h.replaceView(creatorB);
  old.destroy();
  assert.equal(h.wc(), replacement);
  assert.equal(h.context.browserTabViews.has('invite'), true);
});

test('destruction during preparation revokes the operation, with no automatic send or replacement', async () => {
  const h = harness();
  const entry = deferred();
  h.onScript = () => entry.promise;
  const pending = h.invoke('invites:prepare');
  await until(() => h.calls.includes('entry'));
  const contents = h.wc();
  delete h.context.pgyInviteBrowserView.webContents;
  contents.destroy();
  entry.resolve({ ok: true, action: { point } });
  assert.equal((await pending).ok, false);
  assert.equal(h.context.pgyInviteBrowserView, null);
  assert.equal(h.context.pgyInvitePreparedDraft, null);
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

test('prepare owns the lock before awaits; competing IPC/navigation is blocked but its own form navigation works', async () => {
  const h = harness();
  const entry = deferred();
  const normalScript = h.onScript;
  h.onScript = (script) => script === 'entry' ? entry.promise : normalScript(script);
  const preparing = h.invoke('invites:prepare');
  assert.ok(h.context.currentBrowserAutomationLock());
  await until(() => h.calls.includes('entry'));
  for (const name of ['invites:openCreator', 'invites:prepare', 'invites:openAccount', 'invites:checkLogin', 'invites:sendPrepared']) {
    assert.equal((await h.invoke(name, { ...payload, rowId: 'b' })).code, 'BROWSER_TAB_LOCKED', name);
  }
  for (const action of ['back', 'forward', 'reload']) {
    assert.equal((await h.invoke('browser:nav', action)).code, 'BROWSER_NAV_LOCKED');
  }
  assert.equal((await h.invoke('browser:closeTab', 'invite')).code, 'BROWSER_TAB_LOCKED');
  assert.equal((await h.invoke('browser:activateTab', 'collection')).code, 'BROWSER_TAB_LOCKED');
  assert.equal((await h.invoke('browser:openCollection', creatorB)).code, 'BROWSER_NAV_LOCKED');
  assert.equal(h.context.activateBrowserTab('collection', { force: true }).ok, false);
  assert.equal(h.context.activateBrowserTab('invite', { force: true }).ok, true);
  assert.equal(h.context.rejectBrowserAutomationStart('mock task').code, 'BROWSER_AUTOMATION_BUSY');
  assert.equal(h.navigate(creatorB, { native: true }), false);
  h.wc().windowOpen({ url: formB });
  assert.equal(h.loads.length, 0);
  entry.resolve({ ok: true, action: { type: 'open-detail-form', point } });
  const result = await preparing;
  assert.equal(result.ok, true);
  assert.equal(h.context.pgyInvitePreparedDraft.creatorUrl, creatorA);
  assert.equal(h.context.pgyInvitePreparedDraft.formUrl, formA);
  assert.equal(h.context.pgyInvitePreparedDraft.pageGeneration, h.context.pgyInvitePageGeneration);
  assert.equal(h.context.browserTabRegistry.activeId, 'invite');
  h.assertReleased();
  assert.equal((await h.invoke('browser:activateTab', 'collection')).ok, true);
});

test('openCreator owns the lock during loadURL and releases it without rejecting its own activation', async () => {
  const h = harness(creatorB);
  const load = deferred();
  h.onLoad = () => load.promise;
  const opening = h.invoke('invites:openCreator');
  assert.ok(h.context.pgyInviteOperation);
  assert.equal((await h.invoke('invites:prepare')).code, 'BROWSER_TAB_LOCKED');
  load.resolve();
  assert.equal((await opening).ok, true);
  assert.equal(h.wc().url, creatorA);
  h.assertReleased();
});

for (const name of ['invites:openAccount', 'invites:checkLogin']) {
  test(`${name} owns the lock during initial account navigation`, async () => {
    const h = harness('');
    const load = deferred();
    h.onLoad = () => load.promise;
    const opening = h.invoke(name);
    assert.equal((await h.invoke('invites:openCreator')).code, 'BROWSER_TAB_LOCKED');
    load.resolve();
    assert.equal((await opening).ok, true);
    assert.equal(h.context.browserTabRegistry.activeId, 'invite');
    h.assertReleased();
  });
}

test('the owned entry click may open its form through the production window-open handler', async () => {
  const h = harness();
  h.onInput = (event) => {
    if (event.type === 'mouseUp') h.wc().windowOpen({ url: formA });
  };
  assert.equal((await h.invoke('invites:prepare')).ok, true);
  assert.deepEqual(h.loads, [formA]);
  h.assertReleased();
});

for (const name of ['invites:openAccount', 'invites:checkLogin', 'invites:openCreator']) {
  test(`${name} waits for loading to stop after loadURL resolves at did-finish-load`, async () => {
    const h = harness('');
    const events = [];
    h.onLoadResolved = (wc) => {
      wc.loading = true;
      wc.emit('did-finish-load');
      events.push('finish-while-loading');
    };
    h.onSleep = () => {
      if (!h.wc().loading || !h.context.pgyInviteOperation?.navigationPermit?.settling) return;
      assert.ok(h.context.currentBrowserAutomationLock());
      assert.equal(h.navigate(creatorB, { native: true }), false);
      assert.equal(h.calls.includes('login'), false);
      h.wc().loading = false;
      h.wc().emit('did-stop-loading');
      events.push('stop');
    };
    const result = await h.invoke(name);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(events, ['finish-while-loading', 'stop']);
    assert.equal(h.wc().loading, false);
    assert.equal(h.inputs.length, 0);
    h.assertReleased();
  });
}

for (const initialKind of ['creator', 'form']) {
  test(`owned ${initialKind} bootstrap may finish same-document routing before reads`, async () => {
    const h = harness(creatorB);
    const destination = initialKind === 'creator' ? creatorA : formA;
    let routed = false;
    h.onLoadResolved = (wc) => { wc.loading = true; };
    h.onSleep = () => {
      if (routed || !h.context.pgyInviteOperation?.navigationPermit?.settling) return;
      routed = true;
      const routedUrl = new URL(destination);
      routedUrl.searchParams.set('tracking', 'bootstrap');
      h.navigate(routedUrl.href, { inPage: true });
    };
    const operation = h.context.beginPgyInviteOperation('open-creator', h.context.pgyInviteBrowserView);
    await h.context.loadPgyInviteOperationUrl(operation, destination, initialKind);
    assert.equal(routed, true);
    assert.equal(operation.invalidated, false);
    assert.equal(operation.navigationPermit, null);
    assert.equal(h.inputs.length, 0);
    h.context.endPgyInviteOperation(operation);
  });
}

for (const initial of [base+'note/kol',base+'note/kol?from=account#results',base+'note/kol/']) {
  test(`first creator may leave its captured search page before commit: ${initial}`, async () => {
    const h=harness(initial);
    h.onLoad=()=>h.navigate(base+'note/kol?tracking=cleanup#results',{inPage:true});
    const opened=await h.invoke('invites:openCreator');
    assert.equal(opened.ok,true,JSON.stringify(opened));
    assert.equal(h.wc().url,creatorA); assert.equal(h.inputs.length,0); h.assertReleased();
  });
}
for (const [name,url,inPage] of [
  ['another search route',base+'note/other',true],['login','https://pgy.xiaohongshu.com/login',true],
  ['another creator',creatorB,true],['foreign origin','https://example.test/solar/pre-trade/note/kol',true],
  ['nondefault port','https://pgy.xiaohongshu.com:8443/solar/pre-trade/note/kol',true],
  ['full search reload',base+'note/kol',false]
]) {
  test(`search-source handoff rejects ${name}`,async()=>{
    const h=harness(base+'note/kol'); h.onLoad=()=>h.navigate(url,{inPage});
    assert.equal((await h.invoke('invites:openCreator')).code,'PGY_INVITE_CONTEXT_CHANGED');
    assert.equal(h.inputs.length,0); h.assertReleased();
  });
}
test('search-source permission ends at target commit',async()=>{
  const h=harness(base+'note/kol');
  h.onLoadResolved=()=>h.navigate(base+'note/kol?tracking=late',{inPage:true});
  assert.equal((await h.invoke('invites:openCreator')).code,'PGY_INVITE_CONTEXT_CHANGED');
  assert.equal(h.inputs.length,0); h.assertReleased();
});

test('a stale search event cannot represent a current creator document before commit',async()=>{
  const h=harness(base+'note/kol');
  h.onLoad=()=>{h.wc().url=creatorA;h.wc().emit('did-navigate-in-page',{},base+'note/kol?tracking=late',true);};
  const result=await h.invoke('invites:openCreator');
  assert.equal(result.code,'PGY_INVITE_CONTEXT_CHANGED');
  assert.match(result.error,/phase:before-commit\/source:search/);
  assert.equal(h.inputs.length,0); h.assertReleased();
});
test('search-page query updates during a read do not receive a departing-page exception',async()=>{
  const h=harness(base+'note/kol');
  const operation=h.context.beginPgyInviteOperation('prepare',h.context.pgyInviteBrowserView);
  h.navigate(base+'note/kol?tracking=late',{inPage:true});
  assert.throws(()=>h.context.assertPgyInviteContext(operation),/no-permit\/source:other/);
  assert.equal(h.context.pgyInvitePreparedDraft,null);assert.equal(h.inputs.length,0);
  h.context.endPgyInviteOperation(operation);h.assertReleased();
});

for(const abort of [false,true]) {
  test(`search cleanup without target commit cannot succeed when load ${abort?'aborts':'resolves'}`,async()=>{
    const h=harness(base+'note/kol');
    h.wc().loadURL=async()=>{
      h.wc().emit('did-start-navigation',{},creatorA,false,true);
      h.navigate(base+'note/kol?tracking=one#first',{inPage:true});
      h.navigate(base+'note/kol?tracking=two#second',{inPage:true});
      if(abort)throw Object.assign(new Error('fixture aborted'),{code:'ERR_ABORTED',errno:-3});
    };
    const result=await h.invoke('invites:openCreator');
    assert.equal(result.ok,false); assert.equal(h.inputs.length,0); assert.equal(h.calls.length,0);
    assert.equal(h.context.pgyInvitePreparedDraft,null);h.assertReleased();
  });
}
for(const unreadable of [false,true]) {
  test(`search handoff cannot bypass ${unreadable?'unreadable':'positive'} target risk`,async()=>{
    const h=harness(base+'note/kol');h.onLoad=()=>h.navigate(base+'note/kol?tracking=cleanup',{inPage:true});
    assert.equal((await h.invoke('invites:openCreator')).ok,true);
    h.onRisk=()=>({ok:!unreadable,riskDetected:!unreadable,url:h.wc().url});
    const result=await h.invoke('invites:prepare');
    assert.equal(result.code,unreadable?'PGY_INVITE_SAFETY_CHECK_FAILED':'PGY_INVITE_RISK_DETECTED');
    assert.equal(h.inputs.length,0);assert.equal(h.calls.includes('entry'),false);
    assert.equal(h.context.pgyInvitePreparedDraft,null);h.assertReleased();
  });
}

test('creator handoff accepts only the departing page identity before the new document commits', async () => {
  const h = harness('');
  assert.equal((await h.invoke('invites:openCreator')).ok, true);
  assert.equal((await h.invoke('invites:prepare')).readyToSend, true);
  const firstToken = h.context.pgyInvitePreparedDraft.token;
  h.onLoad = () => h.navigate(formA + '&tracking=late-cleanup', { inPage: true });
  const opened = await h.invoke('invites:openCreator', { ...payload, rowId: 'b' });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(h.wc().url, creatorB);
  assert.equal(h.context.pgyInvitePreparedDraft, null);
  assert.equal((await h.invoke('invites:sendPrepared', { ...payload, token: firstToken })).ok, false);
  h.onLoad = () => h.navigate(creatorB + '?tracking=late-cleanup', { inPage: true });
  assert.equal((await h.invoke('invites:openCreator')).ok, true);
  assert.equal(h.wc().url, creatorA);
  h.assertReleased();
});

for (const [name, change] of [
  ['another creator', (h) => h.navigate(creatorB, { inPage: true })],
  ['another form', (h) => h.navigate(formB, { inPage: true })],
  ['login route', (h) => h.navigate('https://pgy.xiaohongshu.com/login', { inPage: true })],
  ['full reload', (h) => h.navigate(formA)]
]) {
  test(`departing-page handoff still rejects ${name}`, async () => {
    const h = harness(formA);
    h.onLoad = () => change(h);
    const result = await h.invoke('invites:openCreator');
    assert.equal(result.code, 'PGY_INVITE_CONTEXT_CHANGED');
    assert.equal(h.inputs.length, 0);
    h.assertReleased();
  });
}

test('a committed creator cannot return to the departing form during settling', async () => {
  const h = harness(formA);
  h.onLoadResolved = () => h.navigate(formA + '&tracking=late', { inPage: true });
  assert.equal((await h.invoke('invites:openCreator')).code, 'PGY_INVITE_CONTEXT_CHANGED');
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

test('form handoff accepts departing creator cleanup without clearing the pinned form', async () => {
  const h = harness();
  h.onInput = (event) => {
    if (event.type !== 'mouseUp') return;
    h.wc().emit('did-start-navigation', {}, formA, false, true);
    assert.equal(h.context.pgyInviteOperation.navigationPermit.url, formA);
    h.navigate(creatorA + '?tracking=late-cleanup', { inPage: true });
    assert.equal(h.context.pgyInviteOperation.navigationPermit.url, formA);
  };
  const result = await h.invoke('invites:prepare');
  assert.equal(result.readyToSend, true, JSON.stringify(result));
  assert.equal(h.context.pgyInvitePreparedDraft.formUrl, formA);
  h.assertReleased();
});

test('an aborted load cannot succeed from a target URL with no document commit', async () => {
  const h = harness(creatorB);
  h.wc().loadURL = async () => {
    h.navigate(creatorA, { inPage: true });
    throw Object.assign(new Error('aborted'), { code: 'ERR_ABORTED', errno: -3 });
  };
  const result = await h.invoke('invites:openCreator');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ERR_ABORTED');
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

for(const initialLoading of [false,true])test(`a resolved creator load waits for a queued target commit (loading=${initialLoading}) without reloading it`, async () => {
  const h=harness(base+'note/kol');let reloads=0,committed=false;
  const started=h.now;
  h.wc().loadURL=async()=>{
    h.wc().emit('did-start-navigation',{},creatorA,false,true);
    h.wc().loading=initialLoading;
  };
  h.wc().reload=()=>{reloads++;};
  h.onSleep=()=>{if(!committed&&h.now-started>=1000){committed=true;h.navigate(creatorA);}};
  const opened=await h.invoke('invites:openCreator');
  assert.equal(opened.ok,true,JSON.stringify(opened));assert.equal(reloads,0);
  assert.equal(committed,true);assert.equal(h.inputs.length,0);h.assertReleased();
});

test('a resolved creator load without commit recovers once through a real reload before preparation', async () => {
  const h=harness(formA);let reloads=0;
  h.wc().loadURL=async()=>h.navigate(creatorA,{inPage:true});
  h.wc().reload=()=>{reloads++;h.navigate(creatorA);};
  const opened=await h.invoke('invites:openCreator');
  assert.equal(opened.ok,true,JSON.stringify(opened));assert.equal(reloads,1);
  assert.equal(opened.documentReloaded,true);
  assert.equal(h.inputs.length,0);assert.equal(h.calls.filter(c=>c==='risk').length,1);
  const prepared=await h.invoke('invites:prepare');assert.equal(prepared.readyToSend,true);
  assert.equal(reloads,1);h.assertReleased();
});

test('an in-flight creator that never commits times out without reload or inputs',async()=>{
  const h=harness(base+'note/kol');let reloads=0;
  const started=h.now;
  h.wc().loadURL=async()=>{h.wc().emit('did-start-navigation',{},creatorA,false,true);h.wc().loading=true;};
  h.wc().reload=()=>{reloads++;};
  const result=await h.invoke('invites:openCreator');
  assert.equal(result.code,'PGY_INVITE_PAGE_LOAD_TIMEOUT');assert.equal(h.stopped,true);
  assert.equal(reloads,0);assert.equal(h.inputs.length,0);
  assert.ok(h.now-started>=8000&&h.now-started<=8100);h.assertReleased();
});

test('missing commit recovery is bounded and cannot promote an unchanged URL to readiness', async () => {
  const h=harness(formA);let reloads=0;
  h.wc().loadURL=async()=>h.navigate(creatorA,{inPage:true});
  h.wc().reload=()=>{reloads++;};
  const result=await h.invoke('invites:openCreator');
  assert.equal(result.ok,false);assert.equal(reloads,1);assert.equal(h.inputs.length,0);
  assert.equal(h.context.pgyInvitePreparedDraft,null);h.assertReleased();
});

for(const unreadable of [false,true])test(`missing commit recovery stops for ${unreadable?'unreadable':'positive'} risk`,async()=>{
  const h=harness(formA);let reloads=0;
  h.wc().loadURL=async()=>h.navigate(creatorA,{inPage:true});h.wc().reload=()=>{reloads++;};
  h.onRisk=()=>({ok:!unreadable,riskDetected:!unreadable,url:h.wc().url});
  const result=await h.invoke('invites:openCreator');
  assert.equal(result.code,unreadable?'PGY_INVITE_SAFETY_CHECK_FAILED':'PGY_INVITE_RISK_DETECTED');
  assert.equal(reloads,0);assert.equal(h.inputs.length,0);h.assertReleased();
});

for(const abort of [false,true])test(`failed ${abort?'aborted':'resolved'} creator loads cannot bypass document proof on reentry`,async()=>{
  const h=harness(formA);let loads=0,reloads=0;
  h.wc().loadURL=async()=>{loads++;h.navigate(creatorA,{inPage:true});
    if(abort)throw Object.assign(new Error('fixture abort'),{code:'ERR_ABORTED',errno:-3});};
  h.wc().reload=()=>{reloads++;};
  assert.equal((await h.invoke('invites:openCreator')).ok,false);
  assert.equal((await h.invoke('invites:openCreator')).ok,false);
  assert.equal(loads,2);assert.equal(reloads,abort?0:2);
  assert.equal((await h.invoke('invites:prepare')).ok,false);
  assert.equal(h.inputs.length,0);assert.equal(h.context.pgyInvitePreparedDraft,null);
  h.navigate(creatorA);
  assert.equal((await h.invoke('invites:prepare')).readyToSend,true);
  h.assertReleased();
});

test('hanging recovery risk read releases the lock, and late risk cannot reload or publish a draft',async()=>{
  const h=harness(formA), pending=deferred();let reloads=0;
  h.wc().loadURL=async()=>h.navigate(creatorA,{inPage:true});h.wc().reload=()=>{reloads++;};
  h.onRisk=()=>pending.promise;
  h.context.setTimeout=(fn,ms)=>setImmediate(()=>{h.now+=ms;fn();});
  const result=await h.invoke('invites:openCreator');
  assert.equal(result.code,'PGY_INVITE_SAFETY_CHECK_FAILED');h.assertReleased();
  pending.resolve({ok:true,riskDetected:false,url:creatorA});await new Promise(setImmediate);
  assert.equal(reloads,0);assert.equal(h.inputs.length,0);assert.equal(h.context.pgyInvitePreparedDraft,null);
});

for(const elapsed of [8001,25001])test(`risk reply after ${elapsed}ms cannot dispatch recovery`,async()=>{
  const h=harness(formA);let reloads=0;
  h.wc().loadURL=async()=>h.navigate(creatorA,{inPage:true});h.wc().reload=()=>{reloads++;};
  h.onRisk=()=>{h.now+=elapsed;return {ok:true,riskDetected:false,url:creatorA};};
  const result=await h.invoke('invites:openCreator');
  assert.equal(result.code,'PGY_INVITE_SAFETY_CHECK_FAILED');
  assert.equal(reloads,0);assert.equal(h.inputs.length,0);h.assertReleased();
});

test('an expired loading budget does not start recovery or risk reads',async()=>{
  const h=harness(formA);let reloads=0;
  h.wc().loadURL=async()=>{h.navigate(creatorA,{inPage:true});h.now+=25001;};h.wc().reload=()=>{reloads++;};
  const result=await h.invoke('invites:openCreator');assert.equal(result.ok,false);
  assert.equal(reloads,0);assert.equal(h.calls.includes('risk'),false);h.assertReleased();
});

for(const change of ['creator','reload','replace'])test(`recovery risk cannot outlive ${change} context changes`,async()=>{
  const h=harness(formA), pending=deferred();let reloads=0;
  h.wc().loadURL=async()=>h.navigate(creatorA,{inPage:true});h.wc().reload=()=>{reloads++;};
  h.onRisk=()=>pending.promise;
  const opened=h.invoke('invites:openCreator');await until(()=>h.calls.includes('risk'));
  if(change==='creator')h.navigate(creatorB,{inPage:true});
  else if(change==='replace')h.replaceView(creatorA);
  else h.navigate(creatorA);
  pending.resolve({ok:true,riskDetected:false,url:creatorA});
  assert.equal((await opened).ok,false);assert.equal(reloads,0);assert.equal(h.inputs.length,0);h.assertReleased();
});

for (const [name, change] of [
  ['another creator', (h) => h.navigate(creatorB, { inPage: true })],
  ['a different pinned form', (h) => {
    h.wc().emit('did-start-navigation', {}, formA, false, true);
    h.navigate(creatorA + '?tracking=late-cleanup', { inPage: true });
    h.navigate(formB);
  }],
  ['the departed creator after commit', (h) => {
    h.navigate(formA);
    h.navigate(creatorA + '?tracking=late-cleanup', { inPage: true });
  }]
]) {
  test(`form handoff still rejects ${name}`, async () => {
    const h = harness();
    h.onInput = (event) => { if (event.type === 'mouseUp') change(h); };
    const result = await h.invoke('invites:prepare');
    assert.equal(result.code, 'PGY_INVITE_CONTEXT_CHANGED');
    assert.equal(h.context.pgyInvitePreparedDraft, null);
    assert.equal(h.calls.includes('prepare'), false);
    h.assertReleased();
  });
}

test('account settling rejects same-document query changes after loading stops', async () => {
  const h = harness('');
  let elapsed = 0;
  let routed = false;
  h.onLoadResolved = (wc) => { wc.emit('did-stop-loading'); };
  h.onSleep = (ms) => {
    if (routed || !h.context.pgyInviteOperation?.navigationPermit?.settling) return;
    elapsed += ms;
    if (elapsed < 150) return;
    assert.equal(h.wc().loading, false);
    routed = true;
    const routedUrl = new URL(h.wc().url);
    routedUrl.searchParams.set('fixtureInit', 'ready');
    h.navigate(routedUrl.href, { inPage: true });
  };
  const result = await h.invoke('invites:openAccount');
  assert.equal(routed, true);
  assert.equal(result.code, 'PGY_INVITE_CONTEXT_CHANGED');
  assert.ok(result.error.includes('open-account/unexpected-navigation/in-page:same-document'));
  assert.equal(h.context.pgyInvitePreparedDraft, null);
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

test('same-document routing cannot change the owned creator during bootstrap', async () => {
  const h = harness('');
  h.onLoadResolved = (wc) => { wc.loading = true; };
  h.onSleep = () => h.navigate(creatorB, { inPage: true });
  const result = await h.invoke('invites:openCreator');
  assert.equal(result.code, 'PGY_INVITE_CONTEXT_CHANGED');
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

for (const name of ['invites:openAccount', 'invites:openCreator']) {
  test(`${name} fails closed when post-load loading never stops`, async () => {
    const h = harness('');
    const started = h.now;
    h.onLoadResolved = (wc) => { wc.loading = true; };
    const result = await h.invoke(name);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'PGY_INVITE_PAGE_LOAD_TIMEOUT');
    assert.ok(h.now - started >= 3000 && h.now - started <= 3200);
    assert.equal(h.inputs.length, 0);
    h.assertReleased();
  });
}

for (const [name, change] of [
  ['navigation', (h) => h.navigate(creatorB)],
  ['same-URL reload', (h) => h.navigate(h.wc().url)],
  ['replacement', (h) => h.replaceView(h.wc().url)],
  ['destruction', (h) => h.wc().destroy()]
]) {
  test(`post-load settling cannot accept ${name} as readiness`, async () => {
    const h = harness('');
    h.onLoadResolved = (wc) => { wc.loading = true; };
    h.onSleep = () => {
      if (h.context.pgyInviteOperation?.navigationPermit?.settling) change(h);
    };
    const result = await h.invoke('invites:openAccount');
    assert.equal(result.code, 'PGY_INVITE_CONTEXT_CHANGED');
    assert.equal(h.inputs.length, 0);
    h.assertReleased();
  });
}

test('recoverable aborted creator load still waits through owned SPA initialization', async () => {
  const h = harness(creatorB);
  const started = h.now;
  h.wc().loadURL = async (url) => {
    h.navigate(url);
    throw Object.assign(new Error('aborted'), { code: 'ERR_ABORTED', errno: -3 });
  };
  let routed = false;
  h.onSleep = () => {
    if (routed || !h.context.pgyInviteOperation?.navigationPermit?.settling) return;
    routed = true;
    h.navigate(creatorA + '?tracking=late-init', { inPage: true });
  };
  assert.equal((await h.invoke('invites:openCreator')).ok, true);
  assert.equal(routed, true);
  assert.ok(h.now - started >= 800);
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

test('network failures at the expected URL are not promoted to a successful open', async () => {
  const h = harness(creatorB);
  h.wc().loadURL = async (url) => {
    h.navigate(url);
    throw Object.assign(new Error('offline'), { code: 'ERR_INTERNET_DISCONNECTED' });
  };
  assert.equal((await h.invoke('invites:openCreator')).code, 'ERR_INTERNET_DISCONNECTED');
  h.assertReleased();
});

test('a never-resolving load stops at the total deadline and late completion cannot revive its draft', async () => {
  const h = harness(creatorB);
  const load = deferred();
  const started = h.now;
  h.onLoad = () => load.promise;
  const result = await h.invoke('invites:openCreator');
  assert.equal(result.code, 'PGY_INVITE_PAGE_LOAD_TIMEOUT');
  assert.equal(h.now - started, 25000);
  assert.equal(h.stopped, true);
  h.assertReleased();
  load.resolve();
  await until(() => h.wc().url === creatorA);
  assert.equal(h.context.pgyInvitePreparedDraft, null);
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

test('an unpreventable navigation during preparation cannot publish a draft for the wrong creator', async () => {
  const h = harness();
  const entry = deferred();
  h.onScript = () => entry.promise;
  const preparing = h.invoke('invites:prepare');
  await until(() => h.calls.includes('entry'));
  h.navigate(creatorB, { inPage: true });
  entry.resolve({ ok: true, action: { type: 'open-detail-form', point } });
  assert.equal((await preparing).code, 'PGY_INVITE_CONTEXT_CHANGED');
  assert.equal(h.context.pgyInvitePreparedDraft, null);
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

for (const [name, change] of [
  ['different form', (h) => h.navigate(formB)],
  ['same-URL reload', (h) => h.navigate(formA)],
  ['same-URL SPA navigation', (h) => h.navigate(formA, { inPage: true })],
  ['WebContents replacement', (h) => h.replaceView(formA)],
  ['destroyed WebContents', (h) => h.wc().destroy()],
  ['loading page', (h) => { h.wc().loading = true; }]
]) {
  test(`async send verification rejects ${name} before input`, async () => {
    const h = harness(formA);
    const verification = deferred();
    h.onScript = () => verification.promise;
    const sending = h.invoke('invites:sendPrepared', h.seedDraft());
    await until(() => h.calls.includes('verify'));
    change(h);
    verification.resolve(ready);
    assert.equal((await sending).code, 'PGY_INVITE_CONTEXT_CHANGED');
    assert.equal(h.inputs.length, 0);
    h.assertReleased();
  });
}

test('navigation away and back invalidates a prepared token even at the same form URL', async () => {
  const h = harness(formA);
  const sendPayload = h.seedDraft();
  h.navigate(creatorB);
  h.navigate(formA);
  assert.equal((await h.invoke('invites:sendPrepared', sendPayload)).code, 'PGY_INVITE_CONFIRMATION_REQUIRED');
  assert.equal(h.inputs.length, 0);
});

test('a reload during asynchronous form preparation cannot publish stale readback', async () => {
  const h = harness();
  const readback = deferred();
  const normalScript = h.onScript;
  h.onScript = (script) => script === 'prepare' ? readback.promise : normalScript(script);
  const preparing = h.invoke('invites:prepare');
  await until(() => h.calls.includes('prepare'));
  h.navigate(formA);
  readback.resolve({ ok: true, readyToSend: true, formUrl: formA });
  assert.equal((await preparing).code, 'PGY_INVITE_CONTEXT_CHANGED');
  assert.equal(h.context.pgyInvitePreparedDraft, null);
  h.assertReleased();
});

test('confirmation expiring during asynchronous verification cannot dispatch', async () => {
  const h = harness(formA);
  const verification = deferred();
  h.onScript = () => verification.promise;
  const sending = h.invoke('invites:sendPrepared', h.seedDraft());
  await until(() => h.calls.includes('verify'));
  h.now += 60001;
  verification.resolve(ready);
  assert.equal((await sending).code, 'PGY_INVITE_CONFIRMATION_EXPIRED');
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

test('a successful preparation can send exactly once, and concurrent replay cannot consume it again', async () => {
  const h = harness();
  assert.equal((await h.invoke('invites:prepare')).ok, true);
  h.inputs.length = 0;
  const sendPayload = h.sendPayload();
  const verification = deferred();
  const normalScript = h.onScript;
  h.onScript = (script) => script === 'verify' ? verification.promise : normalScript(script);
  const sending = h.invoke('invites:sendPrepared', sendPayload);
  assert.equal(h.context.pgyInvitePreparedDraft, null);
  assert.equal((await h.invoke('invites:sendPrepared', sendPayload)).code, 'BROWSER_TAB_LOCKED');
  await until(() => h.calls.includes('verify'));
  verification.resolve(ready);
  const sent = await sending;
  assert.equal(sent.outcome, 'success-confirmed');
  assert.equal(h.inputs.filter((e) => e.type === 'mouseUp').length, 1);
  assert.equal((await h.invoke('invites:sendPrepared', sendPayload)).code, 'PGY_INVITE_CONFIRMATION_REQUIRED');
  h.assertReleased();
});

for (const phase of ['prepare', 'sendPrepared']) {
  test(`${phase} fails closed on account risk before clicks`, async () => {
    const h = harness(phase === 'prepare' ? creatorA : formA);
    h.onRisk = () => ({ ok: true, riskDetected: true, url: h.wc().url });
    const result = await h.invoke(`invites:${phase}`, phase === 'prepare' ? payload : h.seedDraft());
    assert.equal(result.code, 'PGY_INVITE_RISK_DETECTED');
    assert.equal(h.inputs.length, 0);
    h.assertReleased();
  });
}

for (const phase of ['prepare', 'sendPrepared']) {
  test(`${phase} accepts an approved page without avatar/login-heuristic evidence`, async () => {
    const h = harness(phase === 'prepare' ? creatorA : formA);
    h.onLogin = () => ({ ok: true, loggedIn: false, riskDetected: false });
    const result = await h.invoke(`invites:${phase}`, phase === 'prepare' ? payload : h.seedDraft());
    assert.equal(result.ok, true);
    assert.equal(h.calls.includes('login'), false);
    assert.ok(h.calls.includes('risk'));
    h.assertReleased();
  });
}

test('an explicit login route is stop evidence without consulting the avatar heuristic', async () => {
  const h = harness('https://pgy.xiaohongshu.com/login');
  const operation = h.context.beginPgyInviteOperation('prepare', h.context.pgyInviteBrowserView);
  try {
    await assert.rejects(h.context.checkPgyInviteActionSafety(operation), { code: 'PGY_INVITE_LOGIN_REQUIRED' });
    assert.equal(h.inputs.length, 0);
    assert.equal(h.calls.length, 0);
  } finally {
    h.context.endPgyInviteOperation(operation);
  }
  h.assertReleased();
});

test('a login redirect while the risk read awaits cannot reach send verification or input', async () => {
  const h = harness(formA);
  const risk = deferred();
  h.onRisk = () => risk.promise;
  const sending = h.invoke('invites:sendPrepared', h.seedDraft());
  h.navigate('https://pgy.xiaohongshu.com/login');
  risk.resolve({ ok: true, riskDetected: false, url: formA });
  assert.equal((await sending).code, 'PGY_INVITE_CONTEXT_CHANGED');
  assert.equal(h.calls.includes('verify'), false);
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

test('failed risk inspection cannot silently authorize sending', async () => {
  const h = harness(formA);
  h.onRisk = () => ({ ok: false });
  const result = await h.invoke('invites:sendPrepared', h.seedDraft());
  assert.equal(result.code, 'PGY_INVITE_SAFETY_CHECK_FAILED');
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

for (const [name, setup] of [
  ['outcome script throws', (h) => { h.onScript = (script) => { if (script === 'verify') return ready; throw new Error('mock context destroyed'); }; }],
  ['partial input dispatch throws', (h) => { h.onInput = (event) => { if (event.type === 'mouseUp') throw new Error('mock dispatch failure'); }; }],
  ['first input dispatch throws', (h) => { h.onInput = () => { throw new Error('mock input failure'); }; }],
  ['page destroyed after dispatch', (h) => { h.onSleep = () => h.wc().destroy(); }],
  ['outcome reports risk', (h) => { h.onScript = (script) => script === 'verify' ? ready : { ok: false, riskDetected: true }; }],
  ['outcome page changes during read', (h) => { h.onScript = (script) => { if (script === 'verify') return ready; h.navigate(formB); return { ok: true, outcome: 'success-confirmed' }; }; }]
]) {
  test(`${name} remains submitted-unconfirmed, never a retryable failure`, async () => {
    const h = harness(formA);
    setup(h);
    const result = await h.invoke('invites:sendPrepared', h.seedDraft());
    assert.equal(result.ok, true);
    assert.equal(result.clicked, true);
    assert.equal(result.outcome, 'submitted-unconfirmed');
    assert.equal(result.rowId, 'a');
    assert.ok(h.inputs.length > 0);
    assert.equal(h.context.pgyInvitePreparedDraft, null);
    h.assertReleased();
  });
}

test('invalid click coordinates remain a pre-dispatch failure', async () => {
  const h = harness(formA);
  h.onScript = () => ({ ...ready, finalAction: { point: { x: -1, y: 20 } } });
  const result = await h.invoke('invites:sendPrepared', h.seedDraft());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PGY_INVITE_CLICK_TARGET_INVALID');
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

test('pre-dispatch verification exceptions remain ordinary failures and release the lock', async () => {
  const h = harness(formA);
  h.onScript = () => { throw new Error('mock verification failed'); };
  const result = await h.invoke('invites:sendPrepared', h.seedDraft());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PGY_INVITE_SEND_FAILED');
  assert.equal(h.inputs.length, 0);
  h.assertReleased();
});

test('renderer notification failure on release cannot turn a dispatched send into an IPC rejection', async () => {
  const h = harness(formA);
  h.context.sendBrowserTabsSnapshot = () => { throw new Error('mock renderer gone'); };
  assert.equal((await h.invoke('invites:sendPrepared', h.seedDraft())).outcome, 'success-confirmed');
  h.assertReleased();
});

test('brand result arriving after the old 650ms cutoff is awaited without extra clicks', async () => {
  const h=harness();let reads=0;const original=h.onScript;
  h.onScript=script=>script==='prepare' && ++reads<7
    ? {ok:true,waitingForBrand:true,brandCandidates:[]} : original(script);
  const result=await h.invoke('invites:prepare');
  assert.equal(result.ok,true);
  assert.equal(reads,7);
  assert.ok(h.context.pgyInvitePreparedDraft);
  assert.equal(h.inputs.filter(input=>input.type==='mouseUp').length,1,'Only form-entry click; no send');
});

test('same creator with committed document but ongoing loading waits without collection warm-up or reload',async()=>{
  const h=harness();h.wc().loading=true;const started=h.now;
  h.onSleep=()=>{if(h.now-started>=1000)h.wc().loading=false;};
  const result=await h.invoke('invites:openCreator');
  assert.equal(result.ok,true);
  assert.ok(h.now-started>=1000);
  assert.equal(h.loads.length,0);
  assert.equal(h.inputs.length,0);
});

for(const change of ['target','reload','replace','destroy','timeout']) {
  test(`same-creator idle wait rejects ${change} without any clicks`,async()=>{
    const h=harness();h.wc().loading=true;let changed=false;
    h.onSleep=()=>{
      if(changed)return;changed=true;
      if(change==='target')h.navigate(creatorB);
      if(change==='reload')h.navigate(creatorA);
      if(change==='replace')h.replaceView(creatorA);
      if(change==='destroy'){h.wc().destroyed=true;h.wc().emit('destroyed');}
    };
    const result=await h.invoke('invites:openCreator');
    assert.equal(result.ok,false);
    assert.equal(result.code,change==='timeout'?'PGY_INVITE_PAGE_LOAD_TIMEOUT':'PGY_INVITE_CONTEXT_CHANGED');
    assert.equal(h.loads.length,0);
    assert.equal(h.inputs.length,0);
    h.assertReleased();
  });
}

for(const candidates of [[],[{label:'Example Brand'},{label:'Example Plus'}]]) {
  test(`brand search ending with ${candidates.length} candidates returns a recoverable choice or meaningful no-match`,async()=>{
    const h=harness();const original=h.onScript;
    h.onScript=script=>script==='prepare'?{ok:true,waitingForBrand:true,brandCandidates:candidates}:original(script);
    const result=await h.invoke('invites:prepare');
    assert.equal(result.ok,false);
    assert.equal(result.code,candidates.length?'PGY_INVITE_BRAND_SELECTION_REQUIRED':'PGY_INVITE_BRAND_NOT_FOUND');
    if(candidates.length)assert.equal(result.brandCandidates.length,2);
    assert.equal(h.context.pgyInvitePreparedDraft,null);
    assert.equal(h.inputs.filter(input=>input.type==='mouseUp').length,1);
    h.assertReleased();
  });
}

test('each preparation starts without brand authority and only an actual option click confirms it', async () => {
  const h = harness();
  const original = h.onScript;
  h.onScript = script => {
    if (script !== 'prepare') return original(script);
    if (!h.prepareOptions.at(-1).brandSelectionConfirmed) return { ok: true, action: { type: 'select-brand', point } };
    if (!h.prepareOptions.at(-1).brandSelectionSettled) return { ok: true, action: { type: 'settle-brand', point } };
    return original(script);
  };
  assert.equal((await h.invoke('invites:prepare')).ok, true);
  assert.equal(h.prepareOptions[0].brandSelectionConfirmed, false);
  assert.equal(h.prepareOptions[1].brandSelectionConfirmed, true);
  assert.equal(h.prepareOptions[2].brandSelectionSettled, true);
  assert.equal(h.inputs.filter(event => event.type === 'mouseUp').length, 2);
  assert.ok(h.inputs.some(event => event.type === 'keyDown' && event.keyCode === 'Tab'));
  h.navigate(creatorA);
  const before = h.prepareOptions.length;
  assert.equal((await h.invoke('invites:prepare')).ok, true);
  assert.equal(h.prepareOptions[before].brandSelectionConfirmed, false);
});

test('risk during brand-result wait prevents further selection and token creation',async()=>{
  const h=harness();const original=h.onScript;let riskReads=0;
  h.onScript=script=>script==='prepare'?{ok:true,waitingForBrand:true,brandCandidates:[]}:original(script);
  h.onRisk=()=>({ok:true,riskDetected:++riskReads>3,url:h.wc().url,riskText:'安全验证'});
  const result=await h.invoke('invites:prepare');
  assert.equal(result.ok,false);
  assert.equal(h.context.pgyInvitePreparedDraft,null);
  assert.equal(h.inputs.filter(input=>input.type==='mouseUp').length,1);
  h.assertReleased();
});

for (const handler of ['invites:openAccount', 'invites:checkLogin']) {
  test(`${handler} permits verified public login home during account settling and revokes old readiness`, async () => {
    const h = harness('');
    const old = h.seedDraft(); h.wc().url = '';
    let redirected = false;
    h.onSleep = () => {
      if (redirected || !h.context.pgyInviteOperation?.navigationPermit?.settling) return;
      redirected = true;
      assert.equal(h.navigate('https://pgy.xiaohongshu.com/', { native: true }), true);
    };
    h.onLogin = () => ({ ok: true, loggedIn: false, riskDetected: false });
    const result = await h.invoke(handler);
    assert.equal(result.ok, true);
    assert.equal(redirected, true);
    assert.equal(h.wc().url, 'https://pgy.xiaohongshu.com/');
    assert.equal(h.context.pgyInvitePreparedDraft, null);
    assert.equal((await h.invoke('invites:sendPrepared', old)).ok, false);
    assert.equal(h.inputs.length, 0); h.assertReleased();
  });
}
for (const url of [creatorB, formB, 'https://pgy.xiaohongshu.com/other', 'https://pgy.xiaohongshu.com/?next=other', 'https://pgy.xiaohongshu.com/#/other', 'https://pgy.xiaohongshu.com:444/', 'https://user@pgy.xiaohongshu.com/', 'http://pgy.xiaohongshu.com/', 'https://example.invalid/']) {
  test(`account fallback rejects unverified destination ${url}`, async () => {
    const h = harness(''); let attempted = false;
    h.onSleep = () => {
      if (attempted || !h.context.pgyInviteOperation?.navigationPermit?.settling) return;
      attempted = true;
      assert.equal(h.navigate(url, { native: true }), false);
      h.navigate(url); // Even an unpreventable navigation invalidates the operation.
    };
    const result = await h.invoke('invites:openAccount');
    assert.equal(attempted, true); assert.equal(result.ok, false);
    assert.equal(h.context.pgyInvitePreparedDraft, null);
    assert.equal(h.inputs.length, 0); h.assertReleased();
  });
}
test('already logged-in account entry reuses its view and target without reload', async () => {
  const h = harness(base + 'note/kol'); const wc = h.wc();
  assert.equal((await h.invoke('invites:openAccount')).ok, true);
  assert.equal((await h.invoke('invites:checkLogin')).loggedIn, true);
  assert.equal(h.wc(), wc); assert.equal(h.loads.length, 0); h.assertReleased();
});

(async () => {
  for (const { name, run } of tests) {
    await run();
    console.log(`PASS ${name}`);
  }
  console.log(`pgy_invite_ipc.test.js passed (${tests.length} VM IPC regressions; no Electron or network)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
