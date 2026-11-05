const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { _electron } = require('playwright');
const output = process.env.PGY_TEST_OUTPUT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'pgy-recovery-evidence-'));
fs.mkdirSync(output, { recursive: true });
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pgy-recovery-native-'));
const runs = path.join(root, 'runs');
const runDir = path.join(runs, 'interrupted-fixture');
fs.mkdirSync(runDir, { recursive: true });
const url = 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/LOCAL_RECOVERY_FIXTURE';
fs.writeFileSync(path.join(runDir, 'task_state.json'), JSON.stringify({
  schemaVersion: 2, runId: 'interrupted-fixture', runDir, running: true, updatedAt: '2026-10-20T01:00:00Z',
  templatePath: path.join(root, 'templates', 'default_pgy_v1.json'),
  signingTask: { taskName: '旧任务恢复验收' },
  queue: [{ id: '1', url, label: '已完成测试项', status: 'ok', jsonPath: 'retained-result.json' },
    { id: '2', url: url + '_2', label: '中断测试项', status: 'running' }]
}));
fs.writeFileSync(path.join(runs, '.pgy_task_cooldown.json'), JSON.stringify({ activeRunId: 'interrupted-fixture', activeRunDir: runDir, lastFinishedAt: 0 }));
fs.writeFileSync(path.join(runDir, 'retained-result.json'), '{"fixture":"must-survive"}');
let app;
const evidence = { version: '', checks: [], profile: root };
const errors = [];
async function state(page) { return page.evaluate(async () => (await window.desktopAPI.tasks.getState()).state); }
async function waitUntil(fn, message) {
  const until = Date.now() + 12000;
  while (Date.now() < until) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error(message);
}
async function launchFixture() {
  const executablePath = process.env.PGY_APP_EXE;
  assert.ok(executablePath && process.env.PGY_EXPECT_VERSION, 'Packaged executable and expected version are required');
  const env = { ...process.env, ELECTRON_START_BACKEND: 'false' };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await _electron.launch({ executablePath, args: [`--user-data-dir=${root}`, '--host-resolver-rules=MAP * ~NOTFOUND'], env, timeout: 30000 });
  const info = await app.evaluate(({ app }) => ({ profile: app.getPath('userData'), version: app.getVersion() }));
  assert.equal(path.resolve(info.profile), path.resolve(root));
  assert.equal(info.version, process.env.PGY_EXPECT_VERSION);
  evidence.version = info.version;
  await app.evaluate(({ app, session }) => {
    globalThis.fixturePageRequests = [];
    session.fromPartition('persist:pgy_default').protocol.interceptStringProtocol('https', (request, callback) => {
      globalThis.fixturePageRequests.push(request.url);
      callback({ mimeType: 'text/html', data: '<!doctype html><meta charset="utf-8"><title>Local fixture</title><p>本地队列验收页</p>' });
    });
  });
  let page;
  await waitUntil(async () => { page = app.windows().find(p => p.url().includes('/renderer/index.html')); return !!page; }, 'renderer missing');
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  return page;
}
(async () => {
  let page = await launchFixture();
  await page.locator('.nav-item').filter({ hasText: '找达人' }).click();
  const panel = page.locator('#taskRecoveryPanel');
  await panel.waitFor();
  assert.match(await panel.textContent(), /旧任务恢复验收/);
  assert.match(await panel.textContent(), /1\/2/);
  assert.equal(await panel.evaluate(el => el === el.parentElement.firstElementChild), true);
  const checkLayout = async () => {
    const issues = await panel.evaluate(el => Array.from(el.children).filter(child => {
      const a = child.getBoundingClientRect(), b = el.getBoundingClientRect();
      return a.left < b.left || a.right > b.right || (child.tagName === 'B' && a.height > 48);
    }).map(child => child.tagName));
    assert.deepEqual(issues, [], 'recovery panel has no clipped or vertical text');
    assert.equal(await panel.locator('button').evaluate(el => el.scrollHeight <= el.clientHeight + 2), true);
  };
  await checkLayout();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1080, 800));
  await checkLayout();
  await page.screenshot({ path: path.join(output, 'native-pending-narrow.png') });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1384, 860));
  evidence.checks.push('old task visible at top before starting or choosing a template');
  evidence.checks.push('1080 and 1384 wide windows: title and controls fit');
  await page.screenshot({ path: path.join(output, 'native-pending.png') });
  await panel.getByRole('button', { name: '恢复旧任务（保持暂停）', exact: true }).click();
  await panel.getByText('旧任务已恢复，当前暂停', { exact: true }).waitFor();
  assert.equal((await state(page)).paused, true);
  await panel.getByRole('button', { name: '查看采集队列', exact: true }).click();
  await page.locator('#collectionQueue').waitFor();
  await panel.getByRole('button', { name: '停止旧任务', exact: true }).click();
  await waitUntil(async () => (await state(page)).finishReason === 'stopped_by_user', 'recovered stop did not finish');
  assert.equal((await state(page)).running, false);
  assert.equal(await panel.count(), 0);
  assert.deepEqual(await app.evaluate(() => globalThis.fixturePageRequests), []);
  assert.equal(fs.readFileSync(path.join(runDir, 'retained-result.json'), 'utf8'), '{"fixture":"must-survive"}');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runDir, 'task_state.json'))).queue.map(x => x.status), ['ok', 'skipped']);
  evidence.checks.push('restore -> view queue -> Stop uses native UI/IPC, no Continue and zero page requests; completed result retained');
  await page.locator('.nav-item').filter({ hasText: '找达人' }).click();
  await page.locator('.task-banner').filter({ hasText: '新采集可在' }).waitFor();
  await page.evaluate(() => document.querySelector('#content')?.scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, 'native-stopped.png') });
  await app.close();
  app = null;
  page = await launchFixture();
  await page.locator('.nav-item').filter({ hasText: '找达人' }).click();
  await waitUntil(async () => (await state(page)).unfinishedRun === null, 'old lock returned after reload');
  evidence.checks.push('full process restart rehydrates ended status without re-blocking new work');
  // Advance only the isolated test process clock; production cooldown and files remain untouched.
  await app.evaluate(() => { const now = Date.now; Date.now = () => now() + 301000; });
  const input = page.getByPlaceholder('每行一个蒲公英达人链接，也可以直接粘贴 Excel 里复制出来的一列。');
  await input.fill(url + '_NEW');
  await page.getByRole('button', { name: '加入候选', exact: true }).click();
  await page.getByRole('button', { name: '开始采集', exact: true }).click();
  await waitUntil(async () => { const s = await state(page); return s.running && s.runId !== 'interrupted-fixture'; }, 'new queue did not start');
  await waitUntil(async () => (await app.evaluate(() => globalThis.fixturePageRequests)).some(x => x.endsWith('_NEW')), 'new task did not open its own target');
  await page.getByRole('button', { name: '停止整批', exact: true }).click();
  await waitUntil(async () => !(await state(page)).running, 'new queue stop did not finish');
  evidence.checks.push('after normal cooldown, a new batch starts from the UI and opens its own target; normal stop works');
  assert.deepEqual(errors, []);
  evidence.checks.push('no renderer exceptions');
  evidence.ok = true;
  console.log(JSON.stringify(evidence, null, 2));
})().catch(error => { evidence.ok = false; evidence.error = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(output, 'native-result.json'), JSON.stringify(evidence, null, 2));
  if (app) await app.close();
});
