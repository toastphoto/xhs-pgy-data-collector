const fs = require('fs');
const assert = require('assert');
const os = require('os');
const path = require('path');

const {
  ALLOWED_TASK_HOSTS,
  SAFE_BATCH_LIMIT,
  SAFE_RUN_COOLDOWN_FILE,
  SAFE_RUN_COOLDOWN_MS,
  TASK_PRESETS,
  TaskRunner,
  isAllowedTaskUrl,
  jitteredDelayMs,
  normalizePresetKey,
  normalizeTaskUrl
} = require('../lib/task_runner');

const pgyUrl = (id) => `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${id}`;

assert.deepStrictEqual(ALLOWED_TASK_HOSTS, ['pgy.xiaohongshu.com']);
assert.strictEqual(SAFE_BATCH_LIMIT, 50);
assert.strictEqual(SAFE_RUN_COOLDOWN_FILE, '.pgy_task_cooldown.json');
assert.strictEqual(SAFE_RUN_COOLDOWN_MS, 5 * 60 * 1000);
assert.ok(TASK_PRESETS.standard.pageWaitMs >= 3000);
assert.ok(TASK_PRESETS.standard.tabWaitMs >= 1800);
assert.strictEqual(TASK_PRESETS.fast, undefined);
assert.strictEqual(normalizePresetKey('fast'), 'standard');
assert.strictEqual(TASK_PRESETS.standard.resolveNoteUrlByClick, false);
assert.strictEqual(normalizeTaskUrl('pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a'), pgyUrl('a'));
assert.strictEqual(isAllowedTaskUrl(pgyUrl('a')), true);
assert.strictEqual(isAllowedTaskUrl('https://example.com/not-pgy'), false);
assert.ok(jitteredDelayMs(1000, 500) >= 1000);

(async () => {
  const freshDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  const safetyDir = freshDir('xhs-pgy-task-runner-safety');
  const persistedCooldownDir = freshDir('xhs-pgy-task-runner-persisted-cooldown');
  const optionsDir = freshDir('xhs-pgy-task-runner-options');
  const riskDir = freshDir('xhs-pgy-task-runner-risk');
  const extractionRiskDir = freshDir('xhs-pgy-task-runner-extraction-risk');

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
    urls: ['https://pgy.xiaohongshu.com/solar/pre-trade/detail/demo'],
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

  console.log('task_runner_safety.test.js OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
