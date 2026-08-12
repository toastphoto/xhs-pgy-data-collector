const fs = require('fs');
const assert = require('assert');
const os = require('os');
const path = require('path');

const {
  ALLOWED_TASK_HOSTS,
  SAFE_BATCH_LIMIT,
  SAFE_RUN_COOLDOWN_FILE,
  SAFE_RUN_COOLDOWN_MS,
  TASK_STATE_FILE,
  TASK_STATE_SCHEMA_VERSION,
  TASK_PRESETS,
  TaskRunner,
  isAllowedTaskUrl,
  isSameTaskPage,
  jitteredDelayMs,
  normalizePresetKey,
  normalizeTaskUrl
} = require('../lib/task_runner');

const pgyUrl = (id) => `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${id}`;

assert.deepStrictEqual(ALLOWED_TASK_HOSTS, ['pgy.xiaohongshu.com']);
assert.strictEqual(SAFE_BATCH_LIMIT, 50);
assert.strictEqual(SAFE_RUN_COOLDOWN_FILE, '.pgy_task_cooldown.json');
assert.strictEqual(SAFE_RUN_COOLDOWN_MS, 5 * 60 * 1000);
assert.strictEqual(TASK_STATE_FILE, 'task_state.json');
assert.strictEqual(TASK_STATE_SCHEMA_VERSION, 2);
assert.ok(TASK_PRESETS.standard.pageWaitMs >= 3000);
assert.ok(TASK_PRESETS.standard.tabWaitMs >= 1800);
assert.strictEqual(TASK_PRESETS.fast, undefined);
assert.strictEqual(normalizePresetKey('fast'), 'standard');
assert.strictEqual(TASK_PRESETS.standard.resolveNoteUrlByClick, false);
assert.strictEqual(normalizeTaskUrl('pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a'), pgyUrl('a'));
assert.strictEqual(isAllowedTaskUrl(pgyUrl('a')), true);
assert.strictEqual(isAllowedTaskUrl('https://example.com/not-pgy'), false);
assert.strictEqual(isSameTaskPage(`${pgyUrl('a')}?source=list`, `${pgyUrl('a')}#notes`), true);
assert.strictEqual(isSameTaskPage(pgyUrl('a'), pgyUrl('b')), false);
assert.ok(jitteredDelayMs(1000, 500) >= 1000);

(async () => {
  const freshDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  const waitFor = async (predicate, message, timeoutMs = 1500) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.fail(message || 'timed out waiting for condition');
  };
  const safetyDir = freshDir('xhs-pgy-task-runner-safety');
  const persistedCooldownDir = freshDir('xhs-pgy-task-runner-persisted-cooldown');
  const optionsDir = freshDir('xhs-pgy-task-runner-options');
  const riskDir = freshDir('xhs-pgy-task-runner-risk');
  const extractionRiskDir = freshDir('xhs-pgy-task-runner-extraction-risk');
  const pauseDir = freshDir('xhs-pgy-task-runner-pause-pending');
  const skipDir = freshDir('xhs-pgy-task-runner-skip-safe-point');
  const stopDir = freshDir('xhs-pgy-task-runner-stop-safe-point');
  const riskSkipDir = freshDir('xhs-pgy-task-runner-risk-before-skip');
  const recoveryDir = freshDir('xhs-pgy-task-runner-recovery');
  const corruptCooldownDir = freshDir('xhs-pgy-task-runner-corrupt-cooldown');
  const writeFailureDir = freshDir('xhs-pgy-task-runner-write-failure');
  const loopFailureDir = freshDir('xhs-pgy-task-runner-loop-failure');
  const clearQueueDir = freshDir('xhs-pgy-task-runner-clear-queue');

  const runner = new TaskRunner({
    getRunsDir: () => safetyDir,
    makeRunId: () => 'safety-test',
    sendState: () => {},
    openUrl: async () => {},
    getCurrentUrl: () => 'about:blank',
    checkLogin: async () => ({ ok: true, loggedIn: true }),
    extractCurrentMultiPage: async () => ({ ok: true })
  });

  const tooManyUrls = Array.from({ length: SAFE_BATCH_LIMIT + 1 }, (_, i) => pgyUrl(`too-many-${i}`));

  const tooMany = await runner.start({
    urls: tooManyUrls,
    templatePath: '/tmp/template.json',
    presetKey: 'standard'
  });
  assert.strictEqual(tooMany.ok, false);
  assert.match(tooMany.error, /单次最多采集 50 个达人/);

  const bypassTooMany = await runner.start({
    urls: tooManyUrls,
    templatePath: '/tmp/template.json',
    presetKey: 'standard',
    allowLargeBatch: true
  });
  assert.strictEqual(bypassTooMany.ok, false);
  assert.match(bypassTooMany.error, /单次最多采集 50 个达人/);

  const invalidUrl = await runner.start({
    urls: ['https://example.com/not-pgy'],
    templatePath: '/tmp/template.json',
    presetKey: 'standard'
  });
  assert.strictEqual(invalidUrl.ok, false);
  assert.strictEqual(invalidUrl.code, 'PGY_TASK_URL_NOT_ALLOWED');
  assert.match(invalidUrl.error, /只允许蒲公英链接/);

  runner._lastFinishedAt = Date.now();
  const cooldown = await runner.start({
    urls: [pgyUrl('cooldown')],
    templatePath: '/tmp/template.json',
    presetKey: 'standard'
  });
  assert.strictEqual(cooldown.ok, false);
  assert.strictEqual(cooldown.code, 'PGY_RUN_COOLDOWN');
  assert.match(cooldown.error, /至少 5 分钟/);

  fs.writeFileSync(
    path.join(persistedCooldownDir, SAFE_RUN_COOLDOWN_FILE),
    JSON.stringify({ lastFinishedAt: Date.now(), lastFinishedAtIso: new Date().toISOString() }),
    'utf-8'
  );
  const restartedRunner = new TaskRunner({
    getRunsDir: () => persistedCooldownDir,
    makeRunId: () => 'persisted-cooldown-test',
    sendState: () => {},
    openUrl: async () => {},
    getCurrentUrl: () => 'about:blank',
    checkLogin: async () => ({ ok: true, loggedIn: true }),
    extractCurrentMultiPage: async () => ({ ok: true })
  });
  const persistedCooldown = await restartedRunner.start({
    urls: [pgyUrl('persisted-cooldown')],
    templatePath: '/tmp/template.json',
    presetKey: 'standard'
  });
  assert.strictEqual(persistedCooldown.ok, false);
  assert.strictEqual(persistedCooldown.code, 'PGY_RUN_COOLDOWN');

  const clearEvents = [];
  const clearRunner = new TaskRunner({
    getRunsDir: () => clearQueueDir,
    makeRunId: () => 'clear-queue-test',
    sendState: (state) => clearEvents.push(state),
    openUrl: async () => {},
    getCurrentUrl: () => 'about:blank',
    checkLogin: async () => ({ ok: true, loggedIn: true }),
    extractCurrentMultiPage: async () => ({ ok: true })
  });
  const preservedRunDir = path.join(clearQueueDir, 'preserved-run');
  const preservedTaskStatePath = path.join(preservedRunDir, TASK_STATE_FILE);
  const preservedResultPath = path.join(preservedRunDir, 'raw_result.json');
  fs.mkdirSync(preservedRunDir, { recursive: true });
  fs.writeFileSync(preservedTaskStatePath, '{"preserved":true}', 'utf-8');
  fs.writeFileSync(preservedResultPath, '{"rows":[{"id":"kept"}]}', 'utf-8');
  clearRunner.state = {
    ...clearRunner.state,
    runId: 'preserved-run',
    runDir: preservedRunDir,
    signingTask: { taskName: '保留候选池来源' },
    queue: [{ id: 't1', url: pgyUrl('clear-done'), status: 'ok' }],
    currentId: null,
    logs: [{ t: 1, ts: 'test', level: 'info', message: 'completed' }],
    finishReason: 'completed',
    finishedAt: Date.now()
  };
  const preservedTaskState = fs.readFileSync(preservedTaskStatePath, 'utf-8');
  const preservedResult = fs.readFileSync(preservedResultPath, 'utf-8');
  const cleared = clearRunner.clearQueue();
  assert.strictEqual(cleared.ok, true);
  assert.strictEqual(cleared.cleared, true);
  assert.deepStrictEqual(clearRunner.state.queue, []);
  assert.strictEqual(clearRunner.state.currentId, null);
  assert.deepStrictEqual(clearRunner.state.logs, []);
  assert.strictEqual(clearRunner.state.runId, '');
  assert.strictEqual(clearRunner.state.runDir, '');
  assert.strictEqual(clearRunner.state.signingTask, null);
  assert.strictEqual(clearRunner.state.finishReason, '');
  assert.strictEqual(clearRunner.state.finishedAt, null);
  assert.strictEqual(clearEvents.at(-1).runDir, '');
  assert.strictEqual(fs.readFileSync(preservedTaskStatePath, 'utf-8'), preservedTaskState);
  assert.strictEqual(fs.readFileSync(preservedResultPath, 'utf-8'), preservedResult);

  clearRunner.state.running = true;
  clearRunner.state.queue = [{ id: 't2', url: pgyUrl('clear-running'), status: 'running' }];
  const runningClear = clearRunner.clearQueue();
  assert.strictEqual(runningClear.ok, false);
  assert.strictEqual(runningClear.code, 'PGY_TASK_CLEAR_RUNNING');
  assert.strictEqual(clearRunner.state.queue.length, 1);
  clearRunner.state.running = false;
  clearRunner.state.recoveryPending = true;
  const recoveryClear = clearRunner.clearQueue();
  assert.strictEqual(recoveryClear.ok, false);
  assert.strictEqual(recoveryClear.code, 'PGY_TASK_CLEAR_RECOVERY_PENDING');

  const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf-8');
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf-8');
  const taskViewSource = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'views', 'tasks.js'), 'utf-8');
  assert.match(preloadSource, /clearQueue:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('tasks:clearQueue'\)/);
  assert.match(mainSource, /ipcMain\.handle\('tasks:clearQueue'[\s\S]*?taskRunner\.clearQueue\(\)/);
  assert.match(taskViewSource, /确定清空当前采集队列吗/);
  assert.match(taskViewSource, /候选池不会被清空，磁盘中的 run 结果也不会被删除/);
  assert.match(taskViewSource, /暂无本次采集队列。候选池仍会保留/);
  assert.match(taskViewSource, /const queue = Array\.isArray\(state\.tasks\?\.queue\) \? state\.tasks\.queue : \[\]/);

  let optionsSeen = null;
  const optionsRunner = new TaskRunner({
    getRunsDir: () => optionsDir,
    makeRunId: () => 'options-test',
    sendState: () => {},
    openUrl: async () => {},
    getCurrentUrl: () => 'https://pgy.xiaohongshu.com/solar/pre-trade/detail/demo',
    checkLogin: async () => ({ ok: true, loggedIn: true, riskDetected: false }),
    extractCurrentMultiPage: async (_templatePath, options) => {
      optionsSeen = options;
      return { ok: true };
    }
  });

  const optionsStarted = await optionsRunner.start({
    items: [{
      url: 'https://pgy.xiaohongshu.com/solar/pre-trade/detail/demo',
      label: '队列达人'
    }],
    templatePath: '/tmp/template.json',
    presetKey: 'standard',
    options: {
      tabWaitMs: 1,
      resolveNoteUrlByClick: true,
      resolveLimit: 99
    }
  });
  assert.strictEqual(optionsStarted.ok, true);
  await new Promise((resolve) => setTimeout(
    resolve,
    TASK_PRESETS.standard.pageWaitMs + TASK_PRESETS.standard.pageWaitJitterMs + 250
  ));
  assert.ok(optionsSeen);
  assert.strictEqual(optionsSeen.resolveNoteUrlByClick, false);
  assert.strictEqual(optionsSeen.resolveLimit, 0);
  assert.strictEqual(optionsSeen.tabWaitMs, TASK_PRESETS.standard.tabWaitMs);
  assert.strictEqual(optionsSeen.expectedCreatorName, '队列达人');

  let extractCalled = false;
  const riskRunner = new TaskRunner({
    getRunsDir: () => riskDir,
    makeRunId: () => 'risk-test',
    sendState: () => {},
    openUrl: async () => {},
    getCurrentUrl: () => 'https://pgy.xiaohongshu.com/solar/pre-trade/detail/demo',
    checkLogin: async () => ({
      ok: true,
      loggedIn: true,
      riskDetected: true,
      riskText: '安全验证'
    }),
    extractCurrentMultiPage: async () => {
      extractCalled = true;
      return { ok: true };
    }
  });

  const started = await riskRunner.start({
    urls: ['https://pgy.xiaohongshu.com/solar/pre-trade/detail/demo'],
    templatePath: '/tmp/template.json',
    presetKey: 'fast'
  });
  assert.strictEqual(started.ok, true);
  assert.strictEqual(riskRunner.state.presetKey, 'standard');

  await new Promise((resolve) => setTimeout(
    resolve,
    TASK_PRESETS.standard.pageWaitMs + TASK_PRESETS.standard.pageWaitJitterMs + 250
  ));
  assert.strictEqual(riskRunner.state.paused, true);
  assert.match(riskRunner.state.pauseReason, /安全验证/);
  assert.strictEqual(extractCalled, false);

  await riskRunner.skipCurrent();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const extractionRiskRunner = new TaskRunner({
    getRunsDir: () => extractionRiskDir,
    makeRunId: () => 'extraction-risk-test',
    sendState: () => {},
    openUrl: async () => {},
    getCurrentUrl: () => 'https://pgy.xiaohongshu.com/solar/pre-trade/detail/demo',
    checkLogin: async () => ({ ok: true, loggedIn: true, riskDetected: false }),
    extractCurrentMultiPage: async () => ({
      ok: false,
      code: 'PGY_RISK_DETECTED',
      riskDetected: true,
      riskText: '验证码',
      error: '检测到页面可能触发安全验证/风控：验证码'
    })
  });

  const extractionRiskStarted = await extractionRiskRunner.start({
    urls: ['https://pgy.xiaohongshu.com/solar/pre-trade/detail/demo'],
    templatePath: '/tmp/template.json',
    presetKey: 'fast'
  });
  assert.strictEqual(extractionRiskStarted.ok, true);
  assert.strictEqual(extractionRiskRunner.state.presetKey, 'standard');

  await new Promise((resolve) => setTimeout(
    resolve,
    TASK_PRESETS.standard.pageWaitMs + TASK_PRESETS.standard.pageWaitJitterMs + 250
  ));
  assert.strictEqual(extractionRiskRunner.state.paused, true);
  assert.match(extractionRiskRunner.state.pauseReason, /验证码/);
  assert.match(extractionRiskRunner.state.pauseReason, /安全验证|风控/);

  await extractionRiskRunner.skipCurrent();
  await new Promise((resolve) => setTimeout(resolve, 50));

  const pauseEvents = [];
  const pauseOpened = [];
  let pauseCurrentUrl = 'about:blank';
  let firstExtractStarted = false;
  let finishFirstExtract;
  const firstExtractGate = new Promise((resolve) => {
    finishFirstExtract = resolve;
  });
  const pauseRunner = new TaskRunner({
    getRunsDir: () => pauseDir,
    makeRunId: () => 'pause-pending-test',
    sendState: (state) => pauseEvents.push(state),
    openUrl: async (url) => {
      pauseOpened.push(url);
      pauseCurrentUrl = url;
    },
    getCurrentUrl: () => pauseCurrentUrl,
    checkLogin: async () => ({ ok: true, loggedIn: true, riskDetected: false }),
    extractCurrentMultiPage: async () => {
      if (!firstExtractStarted) {
        firstExtractStarted = true;
        await firstExtractGate;
      }
      return { ok: true };
    }
  });
  pauseRunner._waitForSafePoint = async () => 'continue';
  const pauseStart = await pauseRunner.start({
    urls: [pgyUrl('pause-first'), pgyUrl('pause-second')],
    templatePath: '/tmp/template.json',
    presetKey: 'standard'
  });
  assert.strictEqual(pauseStart.ok, true);
  await waitFor(() => firstExtractStarted, 'first extraction did not start');
  const pauseResult = await pauseRunner.pause();
  assert.strictEqual(pauseResult.ok, true);
  assert.strictEqual(pauseResult.pending, true);
  assert.match(pauseResult.message, /完成当前达人后暂停/);
  assert.strictEqual(pauseRunner.state.paused, false);
  assert.strictEqual(pauseRunner.state.pausePending, true);
  assert.ok(pauseRunner.state.pauseRequestedAt > 0);
  assert.ok(pauseEvents.some((state) => state.pausePending === true && state.paused === false));
  finishFirstExtract();
  await waitFor(() => pauseRunner.state.paused === true, 'runner did not pause after completing current creator');
  assert.strictEqual(pauseRunner.state.pausePending, false);
  assert.match(pauseRunner.state.pauseReason, /已完成当前达人/);
  assert.strictEqual(pauseRunner.state.queue[0].status, 'ok');
  assert.strictEqual(pauseRunner.state.queue[1].status, 'pending');
  assert.deepStrictEqual(pauseOpened, [pgyUrl('pause-first')]);
  const pausedOnDisk = JSON.parse(fs.readFileSync(path.join(pauseStart.runDir, TASK_STATE_FILE), 'utf-8'));
  assert.strictEqual(pausedOnDisk.paused, true);
  assert.strictEqual(pausedOnDisk.pausePending, false);
  assert.strictEqual(pausedOnDisk.queue[0].status, 'ok');
  const resumedPause = await pauseRunner.resume();
  assert.strictEqual(resumedPause.ok, true);
  await waitFor(() => pauseRunner.state.running === false, 'paused runner did not finish after resume');
  assert.deepStrictEqual(pauseOpened, [pgyUrl('pause-first'), pgyUrl('pause-second')]);

  const skipEvents = [];
  let skipOpenStarted = false;
  let skipCurrentUrl = 'about:blank';
  let skipExtractCalled = false;
  const skipRunner = new TaskRunner({
    getRunsDir: () => skipDir,
    makeRunId: () => 'skip-safe-point-test',
    sendState: (state) => skipEvents.push(state),
    openUrl: async (url) => {
      skipOpenStarted = true;
      skipCurrentUrl = url;
    },
    getCurrentUrl: () => skipCurrentUrl,
    checkLogin: async () => ({ ok: true, loggedIn: true, riskDetected: false }),
    extractCurrentMultiPage: async () => {
      skipExtractCalled = true;
      return { ok: true };
    }
  });
  const skipStart = await skipRunner.start({
    urls: [pgyUrl('skip-wait')],
    templatePath: '/tmp/template.json',
    presetKey: 'standard'
  });
  assert.strictEqual(skipStart.ok, true);
  await waitFor(() => skipOpenStarted, 'skip test did not open the creator');
  const skipRequestedAt = Date.now();
  const skipResult = await skipRunner.skipCurrent();
  assert.strictEqual(skipResult.ok, true);
  assert.strictEqual(skipResult.pending, true);
  await waitFor(() => skipRunner.state.running === false, 'skip did not stop at the page-wait safe point');
  assert.ok(Date.now() - skipRequestedAt < 1000, 'skip waited for the full conservative page delay');
  assert.strictEqual(skipExtractCalled, false);
  assert.strictEqual(skipRunner.state.queue[0].status, 'skipped');
  assert.match(skipRunner.state.queue[0].error, /安全点停止/);
  assert.ok(skipEvents.some((state) => state.skipPending === true));

  const stopEvents = [];
  const stopOpened = [];
  let stopCurrentUrl = 'about:blank';
  let stopOpenStarted = false;
  let stopExtractCalled = false;
  const stopRunner = new TaskRunner({
    getRunsDir: () => stopDir,
    makeRunId: () => 'stop-safe-point-test',
    sendState: (state) => stopEvents.push(state),
    openUrl: async (url) => {
      stopOpenStarted = true;
      stopOpened.push(url);
      stopCurrentUrl = url;
    },
    getCurrentUrl: () => stopCurrentUrl,
    checkLogin: async () => ({ ok: true, loggedIn: true, riskDetected: false }),
    extractCurrentMultiPage: async () => {
      stopExtractCalled = true;
      return { ok: true };
    }
  });
  const stopStart = await stopRunner.start({
    urls: [pgyUrl('stop-first'), pgyUrl('stop-second')],
    templatePath: '/tmp/template.json',
    presetKey: 'standard'
  });
  assert.strictEqual(stopStart.ok, true);
  await waitFor(() => stopOpenStarted, 'stop test did not open the first creator');
  const stopRequestedAt = Date.now();
  const stopResult = await stopRunner.stop();
  assert.strictEqual(stopResult.ok, true);
  assert.strictEqual(stopResult.pending, true);
  await waitFor(() => stopRunner.state.running === false, 'whole task did not stop at the safe point');
  assert.ok(Date.now() - stopRequestedAt < 1000, 'whole-task stop waited for the full page delay');
  assert.strictEqual(stopExtractCalled, false);
  assert.deepStrictEqual(stopOpened, [pgyUrl('stop-first')]);
  assert.deepStrictEqual(stopRunner.state.queue.map((item) => item.status), ['skipped', 'skipped']);
  assert.match(stopRunner.state.queue[0].error, /当前项已在安全点结束/);
  assert.match(stopRunner.state.queue[1].error, /未执行/);
  assert.strictEqual(stopRunner.state.finishReason, 'stopped_by_user');
  assert.strictEqual(stopRunner.state.stopPending, false);
  assert.ok(stopEvents.some((state) => state.stopPending === true));
  const stoppedOnDisk = JSON.parse(fs.readFileSync(path.join(stopStart.runDir, TASK_STATE_FILE), 'utf-8'));
  assert.strictEqual(stoppedOnDisk.finishReason, 'stopped_by_user');
  assert.strictEqual(stoppedOnDisk.stopPending, false);
  assert.deepStrictEqual(stoppedOnDisk.queue.map((item) => item.status), ['skipped', 'skipped']);

  let riskCheckStarted = false;
  let finishRiskCheck;
  let riskSkipCurrentUrl = 'about:blank';
  let riskSkipExtractCalled = false;
  const riskCheckGate = new Promise((resolve) => {
    finishRiskCheck = resolve;
  });
  const riskSkipRunner = new TaskRunner({
    getRunsDir: () => riskSkipDir,
    makeRunId: () => 'risk-before-skip-test',
    sendState: () => {},
    openUrl: async (url) => {
      riskSkipCurrentUrl = url;
    },
    getCurrentUrl: () => riskSkipCurrentUrl,
    checkLogin: async () => {
      riskCheckStarted = true;
      await riskCheckGate;
      return { ok: true, loggedIn: true, riskDetected: true, riskText: '安全验证' };
    },
    extractCurrentMultiPage: async () => {
      riskSkipExtractCalled = true;
      return { ok: true };
    }
  });
  riskSkipRunner._waitForSafePoint = async () => 'continue';
  const riskSkipStart = await riskSkipRunner.start({
    urls: [pgyUrl('risk-before-skip')],
    templatePath: '/tmp/template.json',
    presetKey: 'standard'
  });
  assert.strictEqual(riskSkipStart.ok, true);
  await waitFor(() => riskCheckStarted, 'risk check did not start');
  await riskSkipRunner.skipCurrent();
  finishRiskCheck();
  await waitFor(() => riskSkipRunner.state.paused === true, 'risk result was bypassed by skip');
  assert.match(riskSkipRunner.state.pauseReason, /安全验证/);
  assert.strictEqual(riskSkipRunner.state.queue[0].status, 'paused');
  assert.strictEqual(riskSkipExtractCalled, false);
  await riskSkipRunner.skipCurrent();
  await waitFor(() => riskSkipRunner.state.running === false, 'risk-paused item did not finish after explicit skip');

  const recoverableRunDir = path.join(recoveryDir, 'recoverable-run');
  fs.mkdirSync(recoverableRunDir, { recursive: true });
  fs.writeFileSync(
    path.join(recoveryDir, SAFE_RUN_COOLDOWN_FILE),
    JSON.stringify({
      lastFinishedAt: 0,
      activeRunId: 'recoverable-run',
      activeRunDir: recoverableRunDir,
      activeAt: Date.now()
    }),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(recoverableRunDir, TASK_STATE_FILE),
    JSON.stringify({
      schemaVersion: TASK_STATE_SCHEMA_VERSION,
      runId: 'recoverable-run',
      runDir: recoverableRunDir,
      updatedAt: new Date().toISOString(),
      running: true,
      paused: false,
      pauseReason: '',
      presetKey: 'standard',
      templatePath: '/tmp/template.json',
      options: { tabWaitMs: 1, resolveNoteUrlByClick: true, resolveLimit: 99 },
      signingTask: {},
      currentId: 't2',
      queue: [
        { id: 't1', url: pgyUrl('recovered-done'), status: 'ok', startedAt: 1, finishedAt: 2 },
        { id: 't2', url: pgyUrl('recovered-running'), status: 'running', startedAt: 3 },
        { id: 't3', url: pgyUrl('recovered-pending'), status: 'pending' }
      ],
      logs: []
    }),
    'utf-8'
  );
  const recoveredOpened = [];
  let recoveredCurrentUrl = 'about:blank';
  const recoveredRunner = new TaskRunner({
    getRunsDir: () => recoveryDir,
    makeRunId: () => 'unused-new-run',
    sendState: () => {},
    openUrl: async (url) => {
      recoveredOpened.push(url);
      recoveredCurrentUrl = url;
    },
    getCurrentUrl: () => recoveredCurrentUrl,
    checkLogin: async () => ({ ok: true, loggedIn: true, riskDetected: false }),
    extractCurrentMultiPage: async () => ({ ok: true })
  });
  recoveredRunner._waitForSafePoint = async () => 'continue';
  const recovered = recoveredRunner.recoverFromTaskState(recoverableRunDir);
  assert.strictEqual(recovered.ok, true);
  assert.strictEqual(recovered.recoveryPending, true);
  assert.strictEqual(recoveredRunner.state.running, true);
  assert.strictEqual(recoveredRunner.state.paused, true);
  assert.strictEqual(recoveredRunner.state.recoveryPending, true);
  assert.strictEqual(recoveredRunner.state.queue[0].status, 'ok');
  assert.strictEqual(recoveredRunner.state.queue[1].status, 'pending');
  assert.strictEqual(recoveredRunner.state.options.tabWaitMs, TASK_PRESETS.standard.tabWaitMs);
  assert.strictEqual(recoveredRunner.state.options.resolveNoteUrlByClick, false);

  const blockedByActiveRun = new TaskRunner({
    getRunsDir: () => recoveryDir,
    makeRunId: () => 'must-not-start',
    sendState: () => {},
    openUrl: async () => {},
    getCurrentUrl: () => 'about:blank',
    checkLogin: async () => ({ ok: true, loggedIn: true }),
    extractCurrentMultiPage: async () => ({ ok: true })
  });
  const activeBlocked = await blockedByActiveRun.start({
    urls: [pgyUrl('must-not-start')],
    templatePath: '/tmp/template.json',
    presetKey: 'standard'
  });
  assert.strictEqual(activeBlocked.ok, false);
  assert.strictEqual(activeBlocked.code, 'PGY_UNFINISHED_RUN');
  const resumeRecovered = await recoveredRunner.resume();
  assert.strictEqual(resumeRecovered.ok, true);
  assert.strictEqual(resumeRecovered.recovered, true);
  await waitFor(() => recoveredRunner.state.running === false, 'recovered queue did not finish');
  assert.deepStrictEqual(recoveredOpened, [pgyUrl('recovered-running'), pgyUrl('recovered-pending')]);
  const cooldownAfterRecovery = JSON.parse(fs.readFileSync(path.join(recoveryDir, SAFE_RUN_COOLDOWN_FILE), 'utf-8'));
  assert.strictEqual(cooldownAfterRecovery.activeRunId, '');
  assert.ok(cooldownAfterRecovery.lastFinishedAt > 0);

  fs.writeFileSync(path.join(corruptCooldownDir, SAFE_RUN_COOLDOWN_FILE), '{not-json', 'utf-8');
  const corruptCooldownRunner = new TaskRunner({
    getRunsDir: () => corruptCooldownDir,
    makeRunId: () => 'corrupt-cooldown-test',
    sendState: () => {},
    openUrl: async () => {},
    getCurrentUrl: () => 'about:blank',
    checkLogin: async () => ({ ok: true, loggedIn: true }),
    extractCurrentMultiPage: async () => ({ ok: true })
  });
  const originalConsoleError = console.error;
  console.error = () => {};
  const corruptCooldown = await corruptCooldownRunner.start({
    urls: [pgyUrl('corrupt-cooldown')],
    templatePath: '/tmp/template.json',
    presetKey: 'standard'
  });
  console.error = originalConsoleError;
  assert.strictEqual(corruptCooldown.ok, false);
  assert.strictEqual(corruptCooldown.code, 'PGY_COOLDOWN_STATE_INVALID');
  assert.ok(corruptCooldownRunner.state.persistenceError);

  const visibleWriteStates = [];
  const writeFailureRunner = new TaskRunner({
    getRunsDir: () => writeFailureDir,
    makeRunId: () => 'write-failure-test',
    sendState: (state) => visibleWriteStates.push(state),
    openUrl: async () => {},
    getCurrentUrl: () => 'about:blank',
    checkLogin: async () => ({ ok: true, loggedIn: true }),
    extractCurrentMultiPage: async () => ({ ok: true })
  });
  const badTaskStateRunDir = path.join(writeFailureDir, 'write-failure-run');
  fs.mkdirSync(path.join(badTaskStateRunDir, TASK_STATE_FILE), { recursive: true });
  writeFailureRunner.state.runId = 'write-failure-run';
  writeFailureRunner.state.runDir = badTaskStateRunDir;
  console.error = () => {};
  writeFailureRunner._emitState();
  console.error = originalConsoleError;
  assert.ok(writeFailureRunner.state.persistenceError);
  assert.strictEqual(writeFailureRunner.state.persistenceError.scope, TASK_STATE_FILE);
  assert.match(writeFailureRunner.state.persistenceError.message, /持久化失败/);
  assert.ok(visibleWriteStates.at(-1).persistenceError);

  const loopFailureRunner = new TaskRunner({
    getRunsDir: () => loopFailureDir,
    makeRunId: () => 'loop-failure-run',
    sendState: () => {},
    openUrl: async () => {},
    getCurrentUrl: () => 'about:blank',
    checkLogin: async () => ({ ok: true, loggedIn: true }),
    extractCurrentMultiPage: async () => ({ ok: true })
  });
  const loopFailureRunDir = path.join(loopFailureDir, 'loop-failure-run');
  fs.mkdirSync(loopFailureRunDir, { recursive: true });
  loopFailureRunner.state.running = true;
  loopFailureRunner.state.runId = 'loop-failure-run';
  loopFailureRunner.state.runDir = loopFailureRunDir;
  loopFailureRunner.state.queue = [{ id: 't1', url: pgyUrl('loop-failure'), status: 'pending' }];
  assert.strictEqual(loopFailureRunner._markRunActive('loop-failure-run', loopFailureRunDir), true);
  loopFailureRunner._runLoop = async () => { throw new Error('simulated loop failure'); };
  loopFailureRunner._launchLoop();
  await waitFor(() => loopFailureRunner.state.recoveryPending === true, 'loop failure was not made recoverable');
  const cooldownAfterLoopFailure = JSON.parse(
    fs.readFileSync(path.join(loopFailureDir, SAFE_RUN_COOLDOWN_FILE), 'utf-8')
  );
  assert.strictEqual(cooldownAfterLoopFailure.activeRunId, 'loop-failure-run');
  assert.strictEqual(cooldownAfterLoopFailure.lastFinishedAt, 0);

  console.log('task_runner_safety.test.js OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
