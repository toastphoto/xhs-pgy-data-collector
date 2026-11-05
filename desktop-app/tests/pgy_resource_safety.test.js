const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const mainPath = path.join(__dirname, '..', 'main.js');
const source = fs.readFileSync(mainPath, 'utf8');
const start = source.indexOf('async function pgyExtractCurrentMultiPage(');
const end = source.indexOf("ipcMain.handle('pgy:extractCurrentMultiPage'", start);
assert.ok(start >= 0 && end > start);
const creatorUrl = 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/111111111111111111111111';

function extractionHarness(options = {}) {
  const { riskAt = 3, detectorError, deltaError, noteResolution = false } = options;
  const risk = Object.hasOwn(options, 'risk') ? options.risk : { ok: true, riskDetected: false };
  const effects = [], writes = [];
  let checks = 0;
  const context = vm.createContext({
    fs: { existsSync: () => true, mkdirSync: () => {},
      readFileSync: () => JSON.stringify({ tabTexts: [noteResolution ? '\u7b14\u8bb0\u6570\u636e' : 'Fixture tab'], noteCardSelector: '.fixture-note' }),
      writeFileSync: file => writes.push(path.basename(file)) },
    path, resolveInsideTemplates: () => '/fixture/template.json', isAllowedTaskUrl: () => true,
    getRunsDir: () => '/fixture/runs', PGY_MIN_TAB_WAIT_MS: 2500,
    PGY_ALLOW_NOTE_CLICK_RESOLVE: noteResolution, PGY_NOTE_CLICK_RESOLVE_LIMIT: 1,
    pgyDetectRiskOnCurrentPage: async () => {
      effects.push('risk-check');
      if (++checks !== riskAt) return { ok: true, riskDetected: false };
      if (detectorError) throw detectorError;
      return risk;
    },
    extractFromTemplate: async () => { effects.push('extract'); return { creator_summary: {}, notes: [] }; },
    saveEvidence: async () => ({}),
    pgyExtractResourceDelta: async () => { effects.push('resource'); if (deltaError) throw deltaError; return {}; },
    mergePreferNonEmpty: (a, b) => ({ ...a, ...b }), mergeNotesUnique: (a, b) => [...(a || []), ...(b || [])],
    clickTabByText: async () => { effects.push('CLICK_TAB'); return { ok: true }; },
    sleep: async () => {}, safeName: () => 'fixture', applyTransform: value => value,
    buildQualityReport: () => ({}), resolveNoteUrlsByClick: async () => { effects.push('CLICK_NOTE'); return {}; }
  });
  vm.runInContext(source.slice(start, end), context, { filename: mainPath });
  return { effects, writes, run: () => context.pgyExtractCurrentMultiPage('fixture', {
    runId: 'fixture', resolveNoteUrlByClick: noteResolution, resolveLimit: 1
  }, { getURL: () => creatorUrl, isDestroyed: () => false }) };
}

function noSuccess(h) {
  assert.equal(h.writes.includes('raw_result.json'), false);
  assert.equal(h.writes.includes('quality_report.json'), false);
}

for (const risk of [{ ok: false, error: 'fixture read failed' }, null, undefined]) {
  test(`resource safety: unreadable risk (${JSON.stringify(risk)}) stops before any tab click`, async () => {
    const h = extractionHarness({ risk });
    const result = await h.run();
    assert.equal(result.ok, false); assert.equal(result.code, 'PGY_SAFETY_CHECK_FAILED');
    assert.equal(h.effects.includes('CLICK_TAB'), false); noSuccess(h);
  });
}

test('resource safety: known risk at supplemental precheck is not swallowed', async () => {
  const h = extractionHarness({ risk: { ok: true, riskDetected: true, riskText: 'fixture-risk' } });
  const result = await h.run();
  assert.equal(result.ok, false); assert.equal(result.code, 'PGY_RISK_DETECTED');
  assert.equal(result.riskDetected, true); assert.match(result.riskStage, /^before_resource_delta:/);
  assert.equal(h.effects.includes('resource'), false); assert.equal(h.effects.includes('CLICK_TAB'), false); noSuccess(h);
});

for (const detectorError of [new Error('fixture destroyed execution context'),
  Object.assign(new Error('fixture risk'), { code: 'PGY_RISK_DETECTED', riskDetected: true })]) {
  test(`resource safety: thrown detector failure ${detectorError.code || 'generic'} stops before tab click`, async () => {
    const h = extractionHarness({ detectorError }); const result = await h.run();
    assert.equal(result.ok, false);
    assert.equal(result.code, detectorError.code || 'PGY_SAFETY_CHECK_FAILED');
    assert.equal(h.effects.includes('CLICK_TAB'), false); noSuccess(h);
  });
}

for (const deltaError of [Object.assign(new Error('fixture risk'), { code: 'PGY_RISK_DETECTED' }),
  Object.assign(new Error('fixture risk flag'), { riskDetected: true }),
  Object.assign(new Error('fixture unreadable risk'), { code: 'PGY_SAFETY_CHECK_FAILED' })]) {
  test(`resource safety: supplemental reader propagates ${deltaError.code || 'risk flag'}`, async () => {
    const h = extractionHarness({ deltaError }); const result = await h.run();
    assert.equal(result.ok, false); assert.equal(h.effects.includes('CLICK_TAB'), false); noSuccess(h);
  });
}

test('resource safety: note-resolution safety-check failure stops before note clicks or success output', async () => {
  const h = extractionHarness({ noteResolution: true, riskAt: 7, risk: { ok: false } });
  const result = await h.run();
  assert.equal(result.ok, false); assert.equal(result.code, 'PGY_SAFETY_CHECK_FAILED');
  assert.equal(h.effects.filter(x => x === 'CLICK_TAB').length, 1);
  assert.equal(h.effects.includes('CLICK_NOTE'), false); noSuccess(h);
});

test('resource safety: clean page and ordinary optional-delta failure retain existing behavior', async () => {
  for (const deltaError of [undefined, new Error('fixture optional metric unavailable')]) {
    const h = extractionHarness({ deltaError }); const result = await h.run();
    assert.equal(result.ok, true); assert.equal(h.effects.filter(x => x === 'CLICK_TAB').length, 1);
    assert.equal(h.writes.includes('raw_result.json'), true);
  }
});

function blankHarness(name, next, variable, tabId) {
  let rejectBlank, attached = false;
  const errors = [];
  const blank = new Promise((_, reject) => { rejectBlank = reject; });
  const originalCatch = blank.catch.bind(blank);
  blank.catch = handler => { attached = true; return originalCatch(handler); };
  const targetError = Object.assign(new Error('fixture target ERR_FAILED'), { code: 'ERR_FAILED' });
  class BrowserView {
    constructor() {
      this.webContents = { isDestroyed: () => false,
        loadURL: url => url === 'about:blank' ? blank : Promise.reject(targetError) };
    }
  }
  const context = vm.createContext({ [variable]: null, [tabId]: 'fixture', BrowserView,
    browserTabRegistry: { add() {} }, browserTabViews: new Map(), configureBrowserTabView() {},
    sendBrowserTabsSnapshot() {}, console: { error: (...args) => errors.push(args) } });
  const collection = name === 'collection';
  const begin = source.indexOf(collection ? "  browserView.webContents.loadURL('about:blank')" : `function ${name}(`);
  const finish = source.indexOf(collection ? '  let uiWidth;' : `function ${next}(`, begin);
  assert.ok(begin >= 0 && finish > begin);
  if (collection) context.browserView = new BrowserView();
  vm.runInContext(source.slice(source.indexOf('function liveBrowserContents('), source.indexOf('function configureBrowserTabView(')), context);
  vm.runInContext(source.slice(begin, finish), context, { filename: mainPath });
  return { view: collection ? context.browserView : context[name](), errors, rejectBlank, attached: () => attached, targetError };
}

for (const [name, next, variable, id] of [
  ['ensureTaskBrowserTab', 'ensureMailBrowserTab', 'taskBrowserView', 'AUTOMATION_TAB_ID'],
  ['ensureMailBrowserTab', 'ensureXhsBrowserTab', 'mailBrowserView', 'MAIL_TAB_ID'],
  ['ensureXhsBrowserTab', 'ensurePgyInviteBrowserTab', 'xhsBrowserView', 'XHS_TAB_ID'],
  ['collection', '', 'browserView', 'COLLECTION_TAB_ID']
]) {
  test(`blank initialization: ${name} handles only its own cancellation and does not swallow target failure`, async () => {
    const h = blankHarness(name, next, variable, id);
    assert.equal(h.attached(), true, 'initial blank navigation needs a rejection handler');
    h.rejectBlank(Object.assign(new Error('fixture blank canceled'), { code: 'ERR_ABORTED', errno: -3 }));
    await new Promise(setImmediate); assert.equal(h.errors.length, 0);
    await assert.rejects(h.view.webContents.loadURL(creatorUrl), error => error === h.targetError);
  });
  test(`blank initialization: ${name} reports non-cancel initialization failures`, async () => {
    const h = blankHarness(name, next, variable, id);
    assert.equal(h.attached(), true);
    h.rejectBlank(Object.assign(new Error('fixture blank failed'), { code: 'ERR_FAILED' }));
    await new Promise(setImmediate); assert.equal(h.errors.length, 1);
  });
}
