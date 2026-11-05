const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');

function harness(errorCode = '') {
  const handlers = new Map(), calls = [];
  const operation = kind => (_dir, runDir) => {
    calls.push([kind, runDir]);
    if (errorCode) throw Object.assign(Error('private file content must not be returned'), { code: errorCode });
    return { runDir: 'other-run', reviewRows: [], settings: {} };
  };
  const context = vm.createContext({
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    resolveInsideRuns: value => value === 'run-A' ? value : null,
    listRunDirs: () => [{ path: 'run-first' }], getContactReviewsDir: () => 'fixture-reviews',
    loadContactReview: operation('load'), saveContactReview: operation('save')
  });
  const start = source.indexOf("ipcMain.handle('exports:loadContactReview'");
  const end = source.indexOf("ipcMain.handle('exports:importContactReviewWorkbook'", start);
  vm.runInContext(source.slice(start, end), context);
  return { calls, invoke: (name, runDir) => handlers.get(`exports:${name}ContactReview`)({}, { runDir, reviewRows: [] }) };
}

test('contact review IPC never substitutes the first run for an explicitly invalid target', async () => {
  for (const method of ['load', 'save']) {
    const h = harness(); const response = await h.invoke(method, 'outside-run');
    assert.equal(response.ok, false); assert.equal(response.code, 'CONTACT_REVIEW_RUN_INVALID');
    assert.deepEqual(h.calls, []);
  }
});

test('contact review IPC preserves canonical target in successful reads and writes', async () => {
  for (const method of ['load', 'save']) {
    const h = harness(); const response = await h.invoke(method, 'run-A');
    assert.equal(response.ok, true); assert.equal(response.runDir, 'run-A');
    assert.deepEqual(h.calls, [[method, 'run-A']]);
    const fallback = await h.invoke(method, '');
    assert.equal(fallback.ok, true); assert.equal(fallback.runDir, 'run-first');
  }
});

test('contact review IPC returns bounded failure codes, never private broken file content', async () => {
  for (const method of ['load', 'save']) for (const code of ['CONTACT_REVIEW_READ_FAILED', 'ENOSPC']) {
    const h = harness(code); const response = await h.invoke(method, 'run-A');
    assert.equal(response.ok, false);
    assert.equal(response.code, code === 'CONTACT_REVIEW_READ_FAILED' ? code : `CONTACT_REVIEW_${method === 'load' ? 'READ' : 'SAVE'}_FAILED`);
    assert.doesNotMatch(JSON.stringify(response), /private file content/);
  }
});
