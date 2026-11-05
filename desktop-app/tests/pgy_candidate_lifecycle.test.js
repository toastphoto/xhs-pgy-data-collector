const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
function section(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(setImmediate);

function fixture(hooks = {}) {
  const handlers = {};
  const events = { capture: 0, validate: 0, reads: 0, windows: [], closing: [], closed: [], navigations: [] };
  const url = 'https://fixture.invalid/search';
  const context = vm.createContext({
    pgyCandidateReadRunning: false,
    pgyCandidateCheckpointSession: null,
    pgyCandidateCommandWindow: null,
    browserView: { webContents: { id: 42, getURL: () => url,
      executeJavaScript: async script => { events.navigations.push(script.page); return { clicked: true }; } } },
    taskRunner: null, xhsContactJob: { running: false },
    directPgyExtractionRunning: false, recordingReplayRunning: false, recordingEnabled: false,
    ipcMain: { handle: (name, handler) => { handlers[name] = handler; } },
    rejectBrowserAutomationStart: () => null,
    ensureCollectionTabActive: () => {}, sendBrowserTabsSnapshot: () => {},
    currentCandidateSourceContext: () => ({ fixture: true }),
    loadCandidateSearchCalibration: () => ({ calibration: {} }),
    parseCandidateInstruction: () => ({}), MAX_CANDIDATE_COUNT: 50, MAX_CANDIDATE_RANK: 200,
    pgyCandidateResponseCache: {
      beginCommandWindow: () => { const window = { id: events.windows.length + 1 }; events.windows.push(window); return window; },
      endCommandWindow: window => { events.closed.push(window); }
    },
    preserveVisibleCandidateSnapshot: async () => {},
    ensurePgyCandidateResponseCapture: async () => { events.capture++; if (hooks.capture) await hooks.capture(context); },
    extractPgySearchCandidates: async () => {
      events.reads++;
      return hooks.read ? hooks.read(context) : { ok: true, items: [], stats: {} };
    },
    readPgyCandidatesFromResponsePages: async () => {
      events.reads++;
      return hooks.read ? hooks.read(context) : { ok: true, items: [], stats: {} };
    },
    validateCandidateCheckpointSession: async sessionId => {
      events.validate++;
      const session = context.pgyCandidateCheckpointSession;
      if (hooks.validate) return hooks.validate(context, session);
      if (hooks.validationWait) await hooks.validationWait.promise;
      return session?.id === sessionId ? { ok: true, session } : { ok: false, code: 'CHECKPOINT_MISSING' };
    },
    pgyDetectRiskOnCurrentPage: async () => hooks.safety ? hooks.safety(context) : { ok: true, riskDetected: false },
    buildSearchPaginationScript: (action, page) => ({ action, page }),
    PGY_MIN_TAB_WAIT_MS: 0, sleep: async () => {}
  });
  vm.runInContext(section('async function closeCandidateCommandWindow(', 'function candidatePageAnchorUrls('), context);
  const close = context.closeCandidateCommandWindow;
  context.closeCandidateCommandWindow = async (window = context.pgyCandidateCommandWindow, options) => {
    events.closing.push(window);
    if (hooks.close) await hooks.close(context, window);
    return close(window, options);
  };
  vm.runInContext(section('async function cancelCandidateCheckpointSession(', 'function createMainWindow('), context);
  vm.runInContext(section("ipcMain.handle('pgy:extractSearchCandidates'", "ipcMain.handle('pgy:parseCandidateInstruction'"), context);
  const checkpoint = () => {
    const window = { id: 'old-window' };
    const session = { id: 'fixture', commandWindow: window, currentPage: 6, startPage: 5,
      webContentsId: 42, url, startRank: 1, endRank: 50, calibration: {} };
    context.pgyCandidateCheckpointSession = session;
    context.pgyCandidateCommandWindow = window;
    return session;
  };
  return { context, events, checkpoint,
    extract: () => handlers['pgy:extractSearchCandidates'](null, {}),
    continue: (id = 'fixture') => handlers['pgy:continueSearchCandidates'](null, id),
    cancel: (id = 'fixture') => handlers['pgy:cancelSearchCandidateCheckpoint'](null, id) };
}

test('startup double click is blocked before response-capture await', async () => {
  const gate = deferred();
  const f = fixture({ capture: () => gate.promise });
  const first = f.extract();
  const secondPending = f.extract();
  gate.resolve();
  await first;
  const second = await secondPending;
  assert.equal(second.code, 'PGY_CANDIDATE_READ_RUNNING');
  assert.equal(f.events.capture, 1);
  assert.equal(f.events.windows.length, 1);
  assert.equal(f.events.reads, 1);
  assert.equal(f.context.pgyCandidateReadRunning, false);
});

test('extract owns the mutex during old-window close and final close', async () => {
  const oldClose = deferred();
  const finalClose = deferred();
  const oldWindow = { id: 'old-window' };
  const f = fixture({ close: (_context, window) => window === oldWindow ? oldClose.promise : finalClose.promise });
  f.context.pgyCandidateCommandWindow = oldWindow;
  const first = f.extract();
  await tick();
  const duringStartupPending = f.extract();
  oldClose.resolve();
  await tick();
  const duringFinalClosePending = f.extract();
  finalClose.resolve();
  await first;
  const duringStartup = await duringStartupPending;
  const duringFinalClose = await duringFinalClosePending;
  assert.equal(duringStartup.code, 'PGY_CANDIDATE_READ_RUNNING');
  assert.equal(duringFinalClose.code, 'PGY_CANDIDATE_READ_RUNNING');
  assert.equal(f.events.windows.length, 1);
  assert.equal(f.context.pgyCandidateReadRunning, false);
});

test('continue validation excludes overlapping continue, cancel and extract', async () => {
  const gate = deferred();
  const f = fixture({ validationWait: gate });
  f.checkpoint();
  const first = f.continue();
  const overlappingPending = [f.continue(), f.cancel(), f.extract()];
  gate.resolve();
  await first;
  const overlapping = await Promise.all(overlappingPending);
  for (const result of overlapping) assert.equal(result.code, 'PGY_CANDIDATE_READ_RUNNING');
  assert.equal(f.events.validate, 1);
  assert.equal(f.events.reads, 1);
  assert.equal(f.context.pgyCandidateReadRunning, false);
});

test('pending cancel blocks new reads until safety and captured-window close both settle', async () => {
  const safety = deferred();
  const close = deferred();
  const f = fixture({ safety: () => safety.promise, close: () => close.promise });
  const session = f.checkpoint();
  const first = f.cancel();
  assert.equal(f.context.pgyCandidateCheckpointSession, null);
  const duringSafetyPending = [f.extract(), f.continue(), f.cancel()];
  safety.resolve({ ok: true, riskDetected: false });
  await tick();
  const duringClosePending = f.extract();
  close.resolve();
  const result = await first;
  const duringSafety = await Promise.all(duringSafetyPending);
  const duringClose = await duringClosePending;
  for (const reply of [...duringSafety, duringClose]) assert.equal(reply.code, 'PGY_CANDIDATE_READ_RUNNING');
  assert.equal(result.restoreSkipped, false);
  assert.deepEqual(f.events.navigations, [5]);
  assert.deepEqual(f.events.closed, [session.commandWindow]);
  assert.equal(f.events.capture, 0);
  assert.equal(f.context.pgyCandidateReadRunning, false);
});

test('cancel closes only its captured old window and preserves a replacement global identity', async () => {
  const safety = deferred();
  const f = fixture({ safety: () => safety.promise });
  const session = f.checkpoint();
  const first = f.cancel();
  const replacement = { id: 'replacement-window' };
  f.context.pgyCandidateCommandWindow = replacement;
  safety.resolve({ ok: true, riskDetected: false });
  await first;
  assert.deepEqual(f.events.closed, [session.commandWindow]);
  assert.equal(f.context.pgyCandidateCommandWindow, replacement);
});

test('stale cancel without a matching session cannot close the global window', async () => {
  const f = fixture();
  const replacement = { id: 'replacement-window' };
  f.context.pgyCandidateCommandWindow = replacement;
  const result = await f.cancel('stale');
  assert.equal(result.canceled, false);
  assert.deepEqual(f.events.closed, []);
  assert.equal(f.context.pgyCandidateCommandWindow, replacement);
  const session = f.checkpoint();
  const mismatch = await f.cancel('wrong-id');
  assert.equal(mismatch.canceled, false);
  assert.equal(f.context.pgyCandidateCheckpointSession, session);
  assert.deepEqual(f.events.closed, []);
});

test('invalidated continuation closes the captured session window, not a replacement global', async () => {
  const replacement = { id: 'replacement-window' };
  const f = fixture({ validate: async context => {
    context.pgyCandidateCheckpointSession = null;
    context.pgyCandidateCommandWindow = replacement;
    return { ok: false, code: 'CHECKPOINT_EXPIRED' };
  } });
  const session = f.checkpoint();
  const result = await f.continue();
  assert.equal(result.code, 'CHECKPOINT_EXPIRED');
  assert.deepEqual(f.events.closed, [session.commandWindow]);
  assert.equal(f.context.pgyCandidateCommandWindow, replacement);
  assert.equal(f.events.reads, 0);
});

test('checkpoint cooldown keeps its session and window while releasing the mutex', async () => {
  const f = fixture({ validate: async () => ({ ok: false, code: 'PGY_CANDIDATE_CHECKPOINT_COOLDOWN' }) });
  const session = f.checkpoint();
  await f.continue();
  assert.equal(f.context.pgyCandidateCheckpointSession, session);
  assert.equal(f.context.pgyCandidateCommandWindow, session.commandWindow);
  assert.deepEqual(f.events.closed, []);
  assert.equal(f.context.pgyCandidateReadRunning, false);
});

test('paused extraction and continuation retain the owned checkpoint window', async () => {
  for (const operation of ['extract', 'continue']) {
    const f = fixture({ read: async context => {
      context.pgyCandidateCheckpointSession = { id: 'next', commandWindow: context.pgyCandidateCommandWindow };
      return { ok: true, paused: true };
    } });
    if (operation === 'continue') f.checkpoint();
    await f[operation]();
    assert.equal(f.context.pgyCandidateCheckpointSession.id, 'next');
    assert.equal(f.context.pgyCandidateCommandWindow, f.context.pgyCandidateCheckpointSession.commandWindow);
    assert.deepEqual(f.events.closed, []);
    assert.equal(f.context.pgyCandidateReadRunning, false);
  }
});

test('startup and validation exceptions always release the mutex', async () => {
  const error = new Error('fixture failure');
  const startup = fixture({ capture: async () => { throw error; } });
  await assert.rejects(startup.extract(), caught => caught === error);
  assert.equal(startup.context.pgyCandidateReadRunning, false);
  const validation = fixture({ validate: async () => { throw error; } });
  const session = validation.checkpoint();
  await assert.rejects(validation.continue(), caught => caught === error);
  assert.equal(validation.context.pgyCandidateReadRunning, false);
  assert.equal(validation.context.pgyCandidateCheckpointSession, session);
});

test('close failures release the mutex for all three candidate entries', async () => {
  for (const operation of ['extract', 'continue', 'cancel']) {
    const error = new Error('fixture close failed');
    const f = fixture({ close: async () => { throw error; } });
    if (operation !== 'extract') f.checkpoint();
    await assert.rejects(f[operation](), caught => caught === error);
    assert.equal(f.context.pgyCandidateReadRunning, false, operation);
  }
});
