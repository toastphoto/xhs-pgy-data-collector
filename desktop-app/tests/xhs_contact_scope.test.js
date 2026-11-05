const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const jobId = '11111111-1111-4111-8111-111111111111';
const generatedJobId = '22222222-2222-4222-8222-222222222222';

function harness({ result, throwRead = false, risk = false } = {}) {
  const handlers = new Map(), sent = [];
  const context = vm.createContext({
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    mainWindow: { webContents: { send: (name, payload) => sent.push({ name, payload }) } },
    browserView: {}, pgyCandidateReadRunning: false, pgyCandidateCheckpointSession: null,
    taskRunner: { state: { running: false } }, xhsContactJob: { running: false },
    crypto: { randomUUID: () => generatedJobId }, XHS_CONTACT_BATCH_LIMIT: 50,
    rejectBrowserAutomationStart: () => null,
    ensureCollectionTabActive: () => {}, sendBrowserTabsSnapshot: () => {}, resumeXhsContactJob: () => {},
    ensureXhsBrowserTab: () => ({ webContents: { getURL: () => risk ? 'https://www.xiaohongshu.com/explore' : 'about:blank' } }),
    resolveInsideRuns: value => value === 'run-A' ? value : '',
    normalizeXhsProfileUrl: value => value || '', normalizePgyCreatorUrl: value => value || '',
    isAllowedTaskUrl: value => value === 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/fixture',
    inspectXhsProfilePage: async () => ({ riskDetected: risk }),
    runXhsContactBatch: async rows => {
      if (throwRead) throw Error('fixture read failure');
      return result || { updates: rows.map(row => ({ rowId: row.rowId, email: 'fixture@example.test' })), found: rows.length };
    }
  });
  const emitStart = source.indexOf('function emitXhsContactProgress(');
  const emitEnd = source.indexOf('\nfunction wakeXhsContactControlWaiters', emitStart);
  vm.runInContext(source.slice(emitStart, emitEnd), context);
  const start = source.indexOf("ipcMain.handle('contacts:enrichXhsBatch'");
  const end = source.indexOf("\nipcMain.handle('contacts:pauseXhsEnrichment'", start);
  vm.runInContext(source.slice(start, end), context);
  return { context, sent, start: payload => handlers.get('contacts:enrichXhsBatch')({}, {
    runDir: 'run-A', rows: [{ rowId: 'same-creator', creatorUrl: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/fixture' }],
    ...payload
  }) };
}

test('XHS progress and final response preserve the initiating run and request job identity', async () => {
  const h = harness(); const response = await h.start({ jobId });
  assert.equal(response.ok, true); assert.equal(response.runDir, 'run-A'); assert.equal(response.jobId, jobId);
  assert.equal(h.sent.length, 2);
  for (const event of h.sent) { assert.equal(event.payload.runDir, 'run-A'); assert.equal(event.payload.jobId, jobId); }
});

test('XHS scope cannot be overridden by batch results or progress payloads', async () => {
  const h = harness({ result: { updates: [], runDir: 'run-B', jobId: generatedJobId } });
  const response = await h.start({ jobId });
  assert.equal(response.runDir, 'run-A'); assert.equal(response.jobId, jobId);
  vm.runInContext("emitXhsContactProgress({type:'item_result',runDir:'run-B',jobId:'wrong'})", h.context);
  assert.equal(h.sent.at(-1).payload.runDir, 'run-A'); assert.equal(h.sent.at(-1).payload.jobId, jobId);
});

test('XHS invalid supplied scope is rejected without a job or event', async () => {
  for (const value of ['', 'wrong', null, 12, {}]) {
    const h = harness(); const response = await h.start({ jobId: value });
    assert.equal(response.ok, false); assert.equal(response.code, 'XHS_CONTACT_SCOPE_INVALID');
    assert.equal(h.sent.length, 0); assert.equal(h.context.xhsContactJob.running, false);
  }
});

test('XHS legacy callers get a generated job identity, and failure replies retain scope', async () => {
  const legacy = harness(); assert.equal((await legacy.start()).jobId, generatedJobId);
  for (const options of [{ throwRead: true }, { risk: true }]) {
    const h = harness(options); const response = await h.start({ jobId });
    assert.equal(response.ok, false); assert.equal(response.runDir, 'run-A'); assert.equal(response.jobId, jobId);
    assert.equal(h.context.xhsContactJob.running, false);
    for (const event of h.sent) { assert.equal(event.payload.runDir, 'run-A'); assert.equal(event.payload.jobId, jobId); }
  }
});
