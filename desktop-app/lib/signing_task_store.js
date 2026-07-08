const fs = require('fs');
const path = require('path');
const { normalizeSigningTask } = require('./signing_task');

const TASKS_FILE = 'tasks.json';
const RUNS_FILE = 'execution_records.json';

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function makeId(prefix = 'task') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getTasksPath(storeDir) {
  return path.join(storeDir, TASKS_FILE);
}

function getRunsPath(storeDir) {
  return path.join(storeDir, RUNS_FILE);
}

function listSigningTasks(storeDir) {
  const items = readJson(getTasksPath(storeDir), []);
  return Array.isArray(items)
    ? items
        .filter((x) => x && typeof x === 'object')
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    : [];
}

function saveSigningTask(storeDir, taskInput) {
  const now = nowIso();
  const task = normalizeSigningTask(taskInput || {});
  const id = String(taskInput?.id || '').trim() || makeId('signing_task');
  const existing = listSigningTasks(storeDir);
  const prev = existing.find((x) => x.id === id);
  const record = {
    id,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
    ...task
  };
  const next = [record, ...existing.filter((x) => x.id !== id)];
  writeJson(getTasksPath(storeDir), next);
  return record;
}

function deleteSigningTask(storeDir, id) {
  const taskId = String(id || '').trim();
  if (!taskId) return false;
  const existing = listSigningTasks(storeDir);
  const next = existing.filter((x) => x.id !== taskId);
  writeJson(getTasksPath(storeDir), next);
  return next.length !== existing.length;
}

function recordExecution(storeDir, input) {
  const now = nowIso();
  const existing = readJson(getRunsPath(storeDir), []);
  const record = {
    id: makeId('exec'),
    createdAt: now,
    runId: String(input?.runId || '').trim(),
    runDir: String(input?.runDir || '').trim(),
    presetKey: String(input?.presetKey || '').trim(),
    queueCount: Number(input?.queueCount || 0) || 0,
    signingTask: normalizeSigningTask(input?.signingTask || {})
  };
  const next = [record, ...(Array.isArray(existing) ? existing : [])].slice(0, 200);
  writeJson(getRunsPath(storeDir), next);
  return record;
}

function summarizeTaskState(runDir) {
  const statePath = path.join(String(runDir || ''), 'task_state.json');
  const state = readJson(statePath, null);
  if (!state || typeof state !== 'object') return null;
  const counts = state.counts && typeof state.counts === 'object' ? state.counts : {};
  return {
    running: Boolean(state.running),
    paused: Boolean(state.paused),
    pauseReason: String(state.pauseReason || ''),
    updatedAt: String(state.updatedAt || ''),
    currentId: state.currentId || null,
    counts
  };
}

function findQualityReportFiles(runDir) {
  const base = String(runDir || '').trim();
  if (!base) return [];
  const out = [];
  try {
    const direct = path.join(base, 'quality_report.json');
    if (fs.existsSync(direct)) out.push(direct);
    const children = fs.readdirSync(base);
    for (const child of children) {
      const childDir = path.join(base, child);
      let st = null;
      try {
        st = fs.statSync(childDir);
      } catch (_) {
        st = null;
      }
      if (!st?.isDirectory()) continue;
      const fp = path.join(childDir, 'quality_report.json');
      if (fs.existsSync(fp)) out.push(fp);
    }
  } catch (_) {
    return out;
  }
  return out;
}

function summarizeQualityReports(runDir) {
  const files = findQualityReportFiles(runDir);
  const reports = files
    .map((filePath) => ({ filePath, report: readJson(filePath, null) }))
    .filter((x) => x.report && typeof x.report === 'object');

  if (!reports.length) {
    return {
      reportCount: 0,
      okCount: 0,
      issueCount: 0,
      minScore: null,
      avgScore: null,
      missingFieldCount: 0,
      failedPageCount: 0,
      warningCount: 0,
      worstReports: []
    };
  }

  let scoreSum = 0;
  let scoreCount = 0;
  let okCount = 0;
  let missingFieldCount = 0;
  let failedPageCount = 0;
  let warningCount = 0;

  const decorated = reports.map(({ filePath, report }) => {
    const missingCreatorFields = Array.isArray(report.missingCreatorFields) ? report.missingCreatorFields : [];
    const missingMetrics = Array.isArray(report.missingMetrics) ? report.missingMetrics : [];
    const failedPages = Array.isArray(report.failedPages) ? report.failedPages : [];
    const warnings = Array.isArray(report.warnings) ? report.warnings : [];
    const score = Number(report.score);
    if (Number.isFinite(score)) {
      scoreSum += score;
      scoreCount += 1;
    }
    if (report.ok === true) okCount += 1;
    missingFieldCount += missingCreatorFields.length + missingMetrics.length;
    failedPageCount += failedPages.length;
    warningCount += warnings.length;
    return {
      filePath,
      ok: report.ok === true,
      score: Number.isFinite(score) ? score : null,
      missingCount: missingCreatorFields.length + missingMetrics.length,
      failedPageCount: failedPages.length,
      warningCount: warnings.length,
      missingFields: [...missingCreatorFields, ...missingMetrics].slice(0, 8).map((x) => x.label || x.key || ''),
      failedPages: failedPages.slice(0, 5).map((x) => x.name || x.tabText || x.reason || '')
    };
  });

  decorated.sort((a, b) => {
    const scoreA = a.score == null ? -1 : a.score;
    const scoreB = b.score == null ? -1 : b.score;
    if (scoreA !== scoreB) return scoreA - scoreB;
    return (b.missingCount + b.failedPageCount) - (a.missingCount + a.failedPageCount);
  });

  const scores = decorated.map((x) => x.score).filter((x) => x != null);
  return {
    reportCount: reports.length,
    okCount,
    issueCount: reports.length - okCount,
    minScore: scores.length ? Math.min(...scores) : null,
    avgScore: scoreCount ? Math.round(scoreSum / scoreCount) : null,
    missingFieldCount,
    failedPageCount,
    warningCount,
    worstReports: decorated.slice(0, 5)
  };
}

function listExecutionRecords(storeDir) {
  const records = readJson(getRunsPath(storeDir), []);
  return (Array.isArray(records) ? records : []).map((record) => ({
    ...record,
    taskState: summarizeTaskState(record.runDir),
    qualitySummary: summarizeQualityReports(record.runDir)
  }));
}

module.exports = {
  listSigningTasks,
  saveSigningTask,
  deleteSigningTask,
  recordExecution,
  listExecutionRecords,
  findQualityReportFiles,
  summarizeQualityReports
};
