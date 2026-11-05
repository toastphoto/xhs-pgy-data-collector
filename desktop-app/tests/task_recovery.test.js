const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');
const { TaskRunner, TASK_STATE_FILE, SAFE_RUN_COOLDOWN_FILE, SAFE_RUN_COOLDOWN_MS } = require('../lib/task_runner');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pgy-recovery-'));
  const runDir = path.join(root, 'interrupted');
  fs.mkdirSync(runDir);
  const payload = {
    schemaVersion: 2, runId: 'interrupted', runDir, running: true,
    updatedAt: '2026-10-20T01:00:00.000Z', templatePath: 'fixture.json',
    signingTask: { taskName: 'Interrupted fixture' },
    queue: [
      { id: '1', url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/fixture1', status: 'ok', jsonPath: 'retained.json' },
      { id: '2', url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/fixture2', status: 'running' },
      { id: '3', url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/fixture3', status: 'pending' }
    ]
  };
  fs.writeFileSync(path.join(runDir, TASK_STATE_FILE), JSON.stringify(payload));
  fs.writeFileSync(path.join(root, SAFE_RUN_COOLDOWN_FILE), JSON.stringify({ activeRunId: 'interrupted', activeRunDir: runDir, lastFinishedAt: 0 }));
  const calls = [];
  let currentUrl = '';
  const runner = new TaskRunner({
    getRunsDir: () => root, makeRunId: () => 'next-run', sendState: () => {},
    openUrl: async url => { calls.push('open'); currentUrl = url; },
    getCurrentUrl: () => currentUrl,
    checkLogin: async () => { calls.push('login'); return { ok: true, loggedIn: true }; },
    extractCurrentMultiPage: async () => { calls.push('extract'); return { ok: true }; }
  });
  return { root, runDir, runner, calls, payload };
}

test('recovered task stops without resume or any page access; results survive restart and next start', async () => {
  const { runner, runDir, root, calls, payload } = fixture();
  assert.equal(runner.recoverFromTaskState(runDir).ok, true);
  const stopped = await runner.stop();
  assert.equal(stopped.ok, true);
  assert.equal(stopped.pending, false);
  assert.equal(runner.state.running, false);
  assert.equal(runner.state.recoveryPending, false);
  assert.equal(runner.state.finishReason, 'stopped_by_user');
  assert.deepEqual(calls, []);
  const saved = JSON.parse(fs.readFileSync(path.join(runDir, TASK_STATE_FILE)));
  assert.equal(saved.queue[0].jsonPath, 'retained.json');
  assert.deepEqual(saved.queue.map(x => x.status), ['ok', 'skipped', 'skipped']);
  const cooldown = JSON.parse(fs.readFileSync(path.join(root, SAFE_RUN_COOLDOWN_FILE)));
  assert.equal(cooldown.activeRunId, '');
  assert.ok(cooldown.lastFinishedAt > 0);
  const restarted = new TaskRunner(runner.deps);
  const start = { urls: [payload.queue[0].url], templatePath: 'fixture.json' };
  assert.equal((await restarted.start(start)).code, 'PGY_RUN_COOLDOWN');
  const realNow = Date.now;
  Date.now = () => cooldown.lastFinishedAt + SAFE_RUN_COOLDOWN_MS + 1;
  restarted._waitForSafePoint = async () => 'continue';
  try {
    assert.equal((await restarted.start(start)).ok, true);
    await restarted._loopPromise;
  } finally { Date.now = realNow; }
  assert.equal(restarted.state.finishReason, 'completed');
  assert.equal(calls.filter(x => x === 'open').length, 1);
});

test('unfinished task is discoverable before Start; snapshot does not recover or navigate', () => {
  const { runner, runDir, calls } = fixture();
  const state = runner.getState();
  assert.equal(state.unfinishedRun.runDir, runDir);
  assert.equal(state.unfinishedRun.total, 3);
  assert.equal(state.unfinishedRun.processed, 1);
  assert.equal(state.unfinishedRun.taskName, 'Interrupted fixture');
  assert.equal(runner.state.running, false);
  assert.deepEqual(calls, []);
});

test('restart after a failed finalization can still recover and stop without collecting', async () => {
  const { runner, runDir, calls } = fixture();
  runner.recoverFromTaskState(runDir);
  runner._writeCooldownState = () => false;
  assert.equal((await runner.stop()).ok, false);
  const restarted = new TaskRunner(runner.deps);
  assert.equal(restarted.recoverFromTaskState(runDir).ok, true);
  assert.equal((await restarted.stop()).ok, true);
  assert.deepEqual(calls, []);
  assert.equal(new TaskRunner(runner.deps).recoverFromTaskState(runDir).code, 'PGY_TASK_ALREADY_FINISHED');
});

test('task-state write failure keeps the boundary and does not report a completed stop', async () => {
  const { runner, runDir, root, calls } = fixture();
  runner.recoverFromTaskState(runDir);
  runner._writeTaskState = () => false;
  assert.equal((await runner.stop()).ok, false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, SAFE_RUN_COOLDOWN_FILE))).activeRunId, 'interrupted');
  const restarted = new TaskRunner(runner.deps);
  assert.equal(restarted.recoverFromTaskState(runDir).ok, true);
  assert.equal((await restarted.stop()).ok, true);
  assert.deepEqual(calls, []);
});

test('stopping a restored task keeps the lock if persistence fails and can be retried', async () => {
  const { runner, runDir, root, calls } = fixture();
  runner.recoverFromTaskState(runDir);
  const write = runner._writeCooldownState;
  runner._writeCooldownState = () => false;
  assert.equal((await runner.stop()).ok, false);
  assert.equal(runner.state.paused, true);
  assert.equal(runner.state.stopPending, false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, SAFE_RUN_COOLDOWN_FILE))).activeRunId, 'interrupted');
  runner._writeCooldownState = write;
  assert.equal((await runner.stop()).ok, true);
  assert.equal(runner.state.running, false);
  assert.deepEqual(calls, []);
});
