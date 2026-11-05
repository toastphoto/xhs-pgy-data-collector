const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const methods = ['connect', 'status', 'clear', 'lookup', 'applyContact', 'listRecords', 'archiveDeletedRecords', 'prepareManualCleanup', 'prepare', 'execute', 'reconcile', 'verifyOwnedAbsence', 'searchMaintainers', 'inspectOperator', 'refreshOperator', 'restoreConnection', 'disconnect', 'forgetConnection'];

test('all Feishu preload methods invoke the exact registered main handlers', async () => {
  const handlers = new Map(), calls = [];
  const frame = {}, sender = { mainFrame: frame };
  const context = { mainWindow: { isDestroyed: () => false, webContents: sender },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    feishuWorkbench: Object.fromEntries(methods.map(method => [method, payload => { calls.push({ method, payload }); return { ok: true }; }])),
    feishuSafeError: () => ({ ok: false, code: 'FEISHU_OPERATION_FAILED' }) };
  const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const start = main.indexOf("for (const method of ['connect', 'status', 'clear', 'lookup'");
  const end = main.indexOf("ipcMain.handle('exports:loadContactReview'", start);
  assert.ok(start > 0 && end > start);
  vm.runInNewContext(main.slice(start, end), context);
  let api;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8'), {
    require: name => {
      assert.equal(name, 'electron');
      return { contextBridge: { exposeInMainWorld: (name, value) => { assert.equal(name, 'desktopAPI'); api = value; } },
        ipcRenderer: { invoke: (name, payload) => handlers.get(name)({ sender, senderFrame: frame }, payload) } };
    }
  });
  assert.deepEqual(Array.from(handlers.keys()).sort(), methods.map(m => `feishu:${m}`).sort());
  for (const method of methods) assert.equal((await api.feishu[method]({ fixture: method })).ok, true);
  assert.deepEqual(calls.map(c => c.method).sort(), [...methods].sort());
  assert.equal(calls.find(c => c.method === 'lookup').payload.fixture, 'lookup');
  assert.equal(calls.find(c => c.method === 'inspectOperator').payload.fixture, 'inspectOperator');
});

test('browser webContents, child frames and destroyed windows cannot access Feishu operations', async () => {
  const handlers = new Map(); let calls = 0;
  const frame = {}, sender = { mainFrame: frame };
  const context = { mainWindow: { isDestroyed: () => false, webContents: sender },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    feishuWorkbench: Object.fromEntries(methods.map(method => [method, () => { calls++; return { ok: true }; }])),
    feishuSafeError: () => ({ ok: false, code: 'FEISHU_OPERATION_FAILED' }) };
  const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const start = main.indexOf("for (const method of ['connect', 'status', 'clear', 'lookup'");
  const end = main.indexOf("ipcMain.handle('exports:loadContactReview'", start);
  vm.runInNewContext(main.slice(start, end), context);
  for (const handler of handlers.values()) {
    for (const event of [{ sender: {}, senderFrame: frame }, { sender, senderFrame: {} }]) {
      assert.equal((await handler(event, {})).code, 'FEISHU_SENDER_REJECTED');
    }
  }
  context.mainWindow.isDestroyed = () => true;
  for (const handler of handlers.values()) assert.equal((await handler({ sender, senderFrame: frame }, {})).code, 'FEISHU_SENDER_REJECTED');
  assert.equal(calls, 0);
});
