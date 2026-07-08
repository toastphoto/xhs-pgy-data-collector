const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  listSigningTasks,
  saveSigningTask,
  deleteSigningTask,
  recordExecution,
  listExecutionRecords,
  summarizeQualityReports
} = require('../lib/signing_task_store');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'signing-task-store-'));

const saved = saveSigningTask(tmp, {
  taskName: 'FILA 搜索',
  channels: { pgy: true, xhs: true },
  collectionScope: 'selected',
  searchCriteria: { track: '中外生活', followersMinWan: '20' },
  candidates: [
    { pgy_url: 'pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a', creator_name: '达人A' }
  ]
});

assert.ok(saved.id);
assert.strictEqual(saved.taskName, 'FILA 搜索');
assert.strictEqual(saved.channels.xhs, true);
assert.strictEqual(saved.collectionScope, 'selected');
assert.strictEqual(saved.searchCriteria.followersMinWan, 20);
assert.strictEqual(saved.candidates.length, 1);
assert.strictEqual(saved.candidates[0].pgy_url, 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/a');
assert.strictEqual(listSigningTasks(tmp).length, 1);

const updated = saveSigningTask(tmp, {
  id: saved.id,
  taskName: 'FILA 搜索更新',
  searchCriteria: { track: '运动', followersMinWan: '30' }
});

assert.strictEqual(updated.id, saved.id);
assert.strictEqual(updated.createdAt, saved.createdAt);
assert.strictEqual(listSigningTasks(tmp).length, 1);
assert.strictEqual(listSigningTasks(tmp)[0].taskName, 'FILA 搜索更新');

const runDir = path.join(tmp, 'run_1');
fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(
  path.join(runDir, 'task_state.json'),
  JSON.stringify({ running: false, counts: { ok: 2, fail: 1 }, updatedAt: '2026-06-29T00:00:00.000Z' }),
  'utf-8'
);
fs.writeFileSync(
  path.join(runDir, 'quality_report.json'),
  JSON.stringify({ ok: true, score: 96, missingCreatorFields: [], missingMetrics: [], failedPages: [], warnings: [] }),
  'utf-8'
);
const childRunDir = path.join(runDir, '1_creator');
fs.mkdirSync(childRunDir, { recursive: true });
fs.writeFileSync(
  path.join(childRunDir, 'quality_report.json'),
  JSON.stringify({
    ok: false,
    score: 64,
    missingCreatorFields: [{ key: 'xhs_id', label: '小红书号' }],
    missingMetrics: [{ key: '视频笔记一口价', label: '视频笔记一口价' }],
    failedPages: [{ name: 'tab_粉丝分析', reason: 'not_found' }],
    warnings: [{ code: 'no_top_notes', message: '没有采到近 10 条笔记数据' }]
  }),
  'utf-8'
);

const exec = recordExecution(tmp, {
  runId: 'run_1',
  runDir,
  presetKey: 'standard',
  queueCount: 3,
  signingTask: updated
});

assert.ok(exec.id);
const records = listExecutionRecords(tmp);
assert.strictEqual(records.length, 1);
assert.strictEqual(records[0].taskState.counts.ok, 2);
assert.strictEqual(records[0].signingTask.taskName, 'FILA 搜索更新');
assert.strictEqual(records[0].qualitySummary.reportCount, 2);
assert.strictEqual(records[0].qualitySummary.okCount, 1);
assert.strictEqual(records[0].qualitySummary.issueCount, 1);
assert.strictEqual(records[0].qualitySummary.minScore, 64);
assert.strictEqual(records[0].qualitySummary.missingFieldCount, 2);
assert.strictEqual(records[0].qualitySummary.failedPageCount, 1);
assert.strictEqual(records[0].qualitySummary.worstReports[0].score, 64);

const quality = summarizeQualityReports(runDir);
assert.strictEqual(quality.avgScore, 80);

assert.strictEqual(deleteSigningTask(tmp, saved.id), true);
assert.strictEqual(listSigningTasks(tmp).length, 0);

console.log('signing_task_store.test.js OK');
