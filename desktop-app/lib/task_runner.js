const fs = require('fs');
const path = require('path');
const { safeName } = require('./evidence');
const { normalizeSigningTask } = require('./signing_task');

const SAFE_BATCH_LIMIT = 50;
const SAFE_RUN_COOLDOWN_MS = 5 * 60 * 1000;
const SAFE_RUN_COOLDOWN_FILE = '.pgy_task_cooldown.json';
const TASK_STATE_FILE = 'task_state.json';
const TASK_STATE_SCHEMA_VERSION = 2;
const ALLOWED_TASK_HOSTS = Object.freeze(['pgy.xiaohongshu.com']);

const TASK_PRESETS = {
  standard: {
    key: 'standard',
    label: '标准（保守）',
    pageWaitMs: 4500,
    pageWaitJitterMs: 2500,
    tabWaitMs: 2500,
    // 本次实现（方案一）：不强求 note_url，默认不做“点击补全链接”
    resolveNoteUrlByClick: false,
    resolveLimit: 0
  },
  conservative: {
    key: 'conservative',
    label: '更保守',
    pageWaitMs: 8000,
    pageWaitJitterMs: 5000,
    tabWaitMs: 4500,
    resolveNoteUrlByClick: false,
    resolveLimit: 0
  }
};

const LEGACY_PRESET_ALIASES = {
  fast: 'standard'
};

function normalizePresetKey(value) {
  const key = String(value || 'standard').trim();
  return LEGACY_PRESET_ALIASES[key] || key;
}

function nowIso() {
  return new Date().toISOString();
}

function jitteredDelayMs(baseMs, jitterMs = 0) {
  const base = Math.max(0, Number(baseMs || 0));
  const jitter = Math.max(0, Number(jitterMs || 0));
  if (!jitter) return Math.round(base);
  return Math.round(base + Math.random() * jitter);
}

function normalizeTaskUrl(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const withProtocol = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const url = new URL(withProtocol);
    url.protocol = 'https:';
    return url.toString();
  } catch (_) {
    return withProtocol;
  }
}

function isAllowedTaskUrl(value) {
  try {
    const url = new URL(normalizeTaskUrl(value));
    return ALLOWED_TASK_HOSTS.includes(url.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

function isPathInside(parentDir, candidateDir) {
  const parent = path.resolve(String(parentDir || ''));
  const candidate = path.resolve(String(candidateDir || ''));
  const relative = path.relative(parent, candidate);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function isSameTaskPage(expectedValue, currentValue) {
  try {
    const expected = new URL(normalizeTaskUrl(expectedValue));
    const current = new URL(normalizeTaskUrl(currentValue));
    const normalizePath = (value) => String(value || '/').replace(/\/+$/, '') || '/';
    return (
      expected.hostname.toLowerCase() === current.hostname.toLowerCase()
      && normalizePath(expected.pathname) === normalizePath(current.pathname)
    );
  } catch (_) {
    return false;
  }
}

function normalizeUrlList(urls) {
  const list = Array.isArray(urls) ? urls : [];
  const out = [];
  const seen = new Set();
  for (const x of list) {
    const u = normalizeTaskUrl(x);
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function normalizeItems(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const urls = normalizeUrlList(payload?.urls || []);
  const outItems = [];
  const seen = new Set();

  // 优先 items（允许携带 label/nickname）
  for (const it of items) {
    const u = normalizeTaskUrl(it?.pgy_url || it?.url || '');
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    outItems.push({
      url: u,
      label: String(it?.creator_name || it?.name || it?.label || '').trim(),
      note: String(it?.note || '').trim(),
      status: ['selected', 'excluded'].includes(String(it?.status || '').trim()) ? String(it.status).trim() : 'candidate',
      priority: String(it?.priority || '').trim(),
      excludeReason: String(it?.excludeReason || it?.exclude_reason || '').trim()
    });
  }

  // 补充 urls（若未出现在 items 中）
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    outItems.push({ url: u, label: '', note: '', status: 'candidate', priority: '', excludeReason: '' });
  }

  return outItems;
}

class TaskRunner {
  /**
   * @param {{
   *  getRunsDir: ()=>string,
   *  makeRunId: ()=>string,
   *  sendState: (payload:any)=>void,
   *  openUrl: (url:string)=>Promise<void>,
   *  getCurrentUrl: ()=>string,
   *  checkLogin: ()=>Promise<{ok:boolean, loggedIn?:boolean, url?:string, isLoginPage?:boolean, error?:string}>,
   *  extractCurrentMultiPage: (templatePath:string, options:any)=>Promise<any>
   * }} deps
   */
  constructor(deps) {
    this.deps = deps;
    this.state = {
      running: false,
      paused: false,
      pauseReason: '',
      presetKey: 'standard',
      templatePath: '',
      options: {},
      signingTask: null,
      runId: '',
      runDir: '',
      queue: [],
      currentId: null,
      logs: [],
      pausePending: false,
      pauseRequestedAt: null,
      stopPending: false,
      stopRequestedAt: null,
      stopReason: '',
      finishReason: '',
      finishedAt: null,
      skipPending: false,
      skipRequestedAt: null,
      recoveryPending: false,
      recoveredAt: null,
      persistenceError: null
    };

    this._loopPromise = null;
    this._pauseGate = null;
    this._pauseGateResolve = null;
    this._skipRequested = false;
    this._stopRequested = false;
    this._controlWaiters = new Set();
    this._recoveryPending = false;
    this._lastFinishedAt = 0;
  }

  _appendLogLine(level, message, extra) {
    const line = {
      t: Date.now(),
      ts: new Date().toLocaleString('zh-CN', { hour12: false }),
      level,
      message: String(message || ''),
      extra: extra ?? null
    };
    this.state.logs.push(line);
    if (this.state.logs.length > 200) this.state.logs = this.state.logs.slice(-200);
    return line;
  }

  _log(level, message, extra) {
    this._appendLogLine(level, message, extra);
    this._emitState();
  }

  _recordPersistenceFailure(scope, err) {
    const detail = String(err?.message || err || 'unknown error');
    const message = `${scope} 持久化失败：${detail}`;
    this.state.persistenceError = {
      t: Date.now(),
      scope: String(scope || 'unknown'),
      message
    };
    this._appendLogLine('error', message);
    try {
      console.error(`[TaskRunner] ${message}`);
    } catch (_) {
      // Console availability must not decide whether the task can be controlled.
    }
  }

  _emitState() {
    this._writeTaskState();
    try {
      this.deps.sendState(JSON.parse(JSON.stringify(this.state)));
    } catch (err) {
      try {
        console.error(`[TaskRunner] sendState failed: ${String(err?.message || err)}`);
      } catch (_) {
        // No additional reporting channel is available here.
      }
    }
  }

  _writeMeta() {
    if (!this.state.runDir) return;
    try {
      const metaPath = path.join(this.state.runDir, 'meta.json');
      fs.mkdirSync(this.state.runDir, { recursive: true });
      fs.writeFileSync(
        metaPath,
        JSON.stringify(
          {
            runId: this.state.runId,
            createdAt: nowIso(),
            presetKey: this.state.presetKey,
            preset: TASK_PRESETS[this.state.presetKey] || TASK_PRESETS.standard,
            templatePath: this.state.templatePath,
            options: this.state.options,
            signingTask: this.state.signingTask || null,
            items: this.state.queue.map((x) => ({
              url: x.url,
              label: x.label || '',
              note: x.note || '',
              status: x.candidateStatus || 'candidate',
              priority: x.priority || '',
              excludeReason: x.excludeReason || ''
            })),
            urls: this.state.queue.map((x) => x.url)
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch (err) {
      this._log('warn', `写入 meta.json 失败：${String(err?.message || err)}`);
    }
  }

  _writeTaskState() {
    if (!this.state.runDir) return true;
    try {
      const queue = Array.isArray(this.state.queue) ? this.state.queue : [];
      const counts = queue.reduce((acc, item) => {
        const key = item?.status || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const payload = {
        schemaVersion: TASK_STATE_SCHEMA_VERSION,
        runId: this.state.runId,
        runDir: this.state.runDir,
        updatedAt: nowIso(),
        running: Boolean(this.state.running),
        paused: Boolean(this.state.paused),
        pauseReason: this.state.pauseReason || '',
        pausePending: Boolean(this.state.pausePending),
        pauseRequestedAt: this.state.pauseRequestedAt || null,
        stopPending: Boolean(this.state.stopPending),
        stopRequestedAt: this.state.stopRequestedAt || null,
        stopReason: this.state.stopReason || '',
        finishReason: this.state.finishReason || '',
        finishedAt: this.state.finishedAt || null,
        skipPending: Boolean(this.state.skipPending),
        skipRequestedAt: this.state.skipRequestedAt || null,
        recoveryPending: Boolean(this.state.recoveryPending),
        recoveredAt: this.state.recoveredAt || null,
        currentId: this.state.currentId || null,
        presetKey: this.state.presetKey,
        templatePath: this.state.templatePath,
        options: this.state.options || {},
        signingTask: this.state.signingTask || null,
        counts,
        queue: queue.map((item) => ({
          id: item.id,
          url: item.url,
          label: item.label || '',
          note: item.note || '',
          candidateStatus: item.candidateStatus || 'candidate',
          priority: item.priority || '',
          excludeReason: item.excludeReason || '',
          status: item.status,
          startedAt: item.startedAt || null,
          finishedAt: item.finishedAt || null,
          error: item.error || '',
          subRunId: item.subRunId || '',
          subRunDir: item.subRunDir || '',
          jsonPath: item.jsonPath || ''
        })),
        logs: this.state.logs.slice(-80)
      };
      fs.mkdirSync(this.state.runDir, { recursive: true });
      fs.writeFileSync(path.join(this.state.runDir, TASK_STATE_FILE), JSON.stringify(payload, null, 2), 'utf-8');
      return true;
    } catch (err) {
      this._recordPersistenceFailure(TASK_STATE_FILE, err);
      return false;
    }
  }

  _newPauseGate() {
    this._pauseGate = new Promise((resolve) => {
      this._pauseGateResolve = resolve;
    });
    return this._pauseGate;
  }

  _getCooldownPath() {
    try {
      const runsDir = this.deps.getRunsDir();
      fs.mkdirSync(runsDir, { recursive: true });
      return path.join(runsDir, SAFE_RUN_COOLDOWN_FILE);
    } catch (err) {
      this._recordPersistenceFailure(SAFE_RUN_COOLDOWN_FILE, err);
      return '';
    }
  }

  _readCooldownState() {
    const cooldownPath = this._getCooldownPath();
    if (!cooldownPath) return { ok: false, error: '无法访问冷却状态文件' };
    if (!fs.existsSync(cooldownPath)) {
      return {
        ok: true,
        lastFinishedAt: Number(this._lastFinishedAt || 0),
        activeRunId: '',
        activeRunDir: '',
        activeAt: null
      };
    }
    try {
      const payload = JSON.parse(fs.readFileSync(cooldownPath, 'utf-8'));
      const fromFile = Number(payload?.lastFinishedAt || 0);
      if (!Number.isFinite(fromFile) || fromFile < 0) {
        throw new Error('lastFinishedAt 不是合法时间戳');
      }
      const value = Math.max(Number(this._lastFinishedAt || 0), fromFile);
      if (value > 0) this._lastFinishedAt = value;
      return {
        ok: true,
        lastFinishedAt: value,
        activeRunId: String(payload?.activeRunId || '').trim(),
        activeRunDir: String(payload?.activeRunDir || '').trim(),
        activeAt: Number(payload?.activeAt || 0) || null
      };
    } catch (err) {
      this._recordPersistenceFailure(`${SAFE_RUN_COOLDOWN_FILE} 读取`, err);
      return { ok: false, error: String(err?.message || err) };
    }
  }

  _readLastFinishedAt() {
    const result = this._readCooldownState();
    return result.ok ? Number(result.lastFinishedAt || 0) : 0;
  }

  _writeCooldownState(payload) {
    const cooldownPath = this._getCooldownPath();
    if (!cooldownPath) return false;
    try {
      fs.writeFileSync(cooldownPath, JSON.stringify(payload, null, 2), 'utf-8');
      return true;
    } catch (err) {
      this._recordPersistenceFailure(SAFE_RUN_COOLDOWN_FILE, err);
      return false;
    }
  }

  _markRunActive(runId, runDir, lastFinishedAt = 0) {
    return this._writeCooldownState({
      lastFinishedAt: Number(lastFinishedAt || 0),
      lastFinishedAtIso: lastFinishedAt ? new Date(lastFinishedAt).toISOString() : null,
      activeRunId: String(runId || ''),
      activeRunDir: String(runDir || ''),
      activeAt: Date.now(),
      activeAtIso: nowIso()
    });
  }

  _writeLastFinishedAt(ts = Date.now()) {
    const value = Number(ts || Date.now());
    if (!Number.isFinite(value) || value <= 0) return false;
    this._lastFinishedAt = value;
    return this._writeCooldownState({
      lastFinishedAt: value,
      lastFinishedAtIso: new Date(value).toISOString(),
      activeRunId: '',
      activeRunDir: '',
      activeAt: null,
      activeAtIso: null
    });
  }

  _launchLoop() {
    if (this._loopPromise) return this._loopPromise;
    const loopPromise = this._runLoop()
      .catch((err) => {
        this.state.running = false;
        this.state.paused = false;
        this.state.pauseReason = '任务循环异常，需从任务状态恢复';
        this.state.pausePending = false;
        this.state.pauseRequestedAt = null;
        this.state.stopPending = false;
        this.state.stopRequestedAt = null;
        this.state.skipPending = false;
        this.state.skipRequestedAt = null;
        this.state.recoveryPending = true;
        this.state.currentId = null;
        this._skipRequested = false;
        this._stopRequested = false;
        this._recoveryPending = true;
        this._appendLogLine('error', `任务循环异常，活动任务边界保持锁定：${String(err?.message || err)}`);
        this._emitState();
      })
      .finally(() => {
        if (this._loopPromise === loopPromise) this._loopPromise = null;
      });
    this._loopPromise = loopPromise;
    return loopPromise;
  }

  recoverFromTaskState(runDir) {
    if (this.state.running || this._loopPromise) {
      return { ok: false, code: 'PGY_TASK_ALREADY_RUNNING', error: '当前已有运行中或待恢复的任务' };
    }

    let runsDir;
    let resolvedRunDir;
    try {
      runsDir = path.resolve(this.deps.getRunsDir());
      resolvedRunDir = path.resolve(String(runDir || ''));
    } catch (err) {
      return { ok: false, code: 'PGY_TASK_STATE_PATH_INVALID', error: String(err?.message || err) };
    }
    if (!isPathInside(runsDir, resolvedRunDir)) {
      return { ok: false, code: 'PGY_TASK_STATE_PATH_INVALID', error: '恢复目录必须位于本地 runs 目录内' };
    }

    const taskStatePath = path.join(resolvedRunDir, TASK_STATE_FILE);
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(taskStatePath, 'utf-8'));
    } catch (err) {
      this._recordPersistenceFailure(`${TASK_STATE_FILE} 读取`, err);
      return { ok: false, code: 'PGY_TASK_STATE_INVALID', error: `任务状态不可读：${String(err?.message || err)}` };
    }

    const runId = String(payload?.runId || '').trim();
    const templatePath = String(payload?.templatePath || '').trim();
    const rawQueue = Array.isArray(payload?.queue) ? payload.queue : [];
    const allowedStatuses = new Set(['pending', 'running', 'paused', 'ok', 'fail', 'skipped']);
    const ids = new Set();
    const invalidQueue = rawQueue.length < 1
      || rawQueue.length > SAFE_BATCH_LIMIT
      || rawQueue.some((item) => {
        const id = String(item?.id || '').trim();
        const status = String(item?.status || '').trim();
        if (!id || ids.has(id) || !allowedStatuses.has(status) || !isAllowedTaskUrl(item?.url)) return true;
        ids.add(id);
        return false;
      });
    const hasUnfinished = rawQueue.some((item) => ['pending', 'running', 'paused'].includes(String(item?.status || '')));
    if (
      Number(payload?.schemaVersion || 0) < TASK_STATE_SCHEMA_VERSION
      || !runId
      || !templatePath
      || invalidQueue
      || !hasUnfinished
    ) {
      return {
        ok: false,
        code: hasUnfinished ? 'PGY_TASK_STATE_INVALID' : 'PGY_TASK_ALREADY_FINISHED',
        error: hasUnfinished
          ? '任务状态缺少可安全恢复的版本、模板或合法队列信息'
          : '该任务已经结束，没有可恢复的未完成项'
      };
    }

    const cooldownState = this._readCooldownState();
    if (!cooldownState.ok) {
      return { ok: false, code: 'PGY_COOLDOWN_STATE_INVALID', error: '无法确认恢复任务的冷却边界' };
    }
    if (cooldownState.activeRunId && cooldownState.activeRunId !== runId) {
      return {
        ok: false,
        code: 'PGY_UNFINISHED_RUN',
        runId: cooldownState.activeRunId,
        error: `冷却状态指向另一未完成任务 ${cooldownState.activeRunId}`
      };
    }
    if (
      cooldownState.activeRunId
      && cooldownState.activeRunDir
      && path.resolve(cooldownState.activeRunDir) !== resolvedRunDir
    ) {
      return { ok: false, code: 'PGY_TASK_STATE_PATH_INVALID', error: '未完成任务目录与冷却状态不一致' };
    }
    if (!cooldownState.activeRunId && !this._markRunActive(runId, resolvedRunDir, cooldownState.lastFinishedAt)) {
      return { ok: false, code: 'PGY_COOLDOWN_PERSIST_FAILED', error: '无法持久化恢复任务的活动边界' };
    }

    const presetKey = normalizePresetKey(payload?.presetKey || 'standard');
    const preset = TASK_PRESETS[presetKey] || TASK_PRESETS.standard;
    const requestedOptions = payload?.options && typeof payload.options === 'object' ? payload.options : {};
    const requestedTabWaitMs = Number(requestedOptions.tabWaitMs || 0);
    const recoveredAt = Date.now();
    this.state = {
      ...this.state,
      running: true,
      paused: true,
      pauseReason: '检测到未完成任务，等待人工确认后继续',
      pausePending: false,
      pauseRequestedAt: null,
      stopPending: false,
      stopRequestedAt: null,
      stopReason: '',
      finishReason: '',
      finishedAt: null,
      skipPending: false,
      skipRequestedAt: null,
      recoveryPending: true,
      recoveredAt,
      presetKey: preset.key,
      templatePath,
      options: {
        ...requestedOptions,
        tabWaitMs: Number.isFinite(requestedTabWaitMs) && requestedTabWaitMs > 0
          ? Math.max(preset.tabWaitMs, requestedTabWaitMs)
          : preset.tabWaitMs,
        resolveNoteUrlByClick: false,
        resolveLimit: 0
      },
      signingTask: normalizeSigningTask(payload?.signingTask || {}),
      runId,
      runDir: resolvedRunDir,
      currentId: null,
      queue: rawQueue.map((item) => ({
        id: String(item.id),
        url: normalizeTaskUrl(item.url),
        label: String(item.label || ''),
        note: String(item.note || ''),
        candidateStatus: String(item.candidateStatus || 'candidate'),
        priority: String(item.priority || ''),
        excludeReason: String(item.excludeReason || ''),
        status: ['running', 'paused'].includes(String(item.status)) ? 'pending' : String(item.status),
        startedAt: ['running', 'paused'].includes(String(item.status)) ? null : (item.startedAt || null),
        finishedAt: item.finishedAt || null,
        error: ['running', 'paused'].includes(String(item.status)) ? '' : String(item.error || ''),
        subRunId: String(item.subRunId || ''),
        subRunDir: String(item.subRunDir || ''),
        jsonPath: String(item.jsonPath || '')
      })),
      logs: Array.isArray(payload?.logs) ? payload.logs.slice(-79) : [],
      persistenceError: null
    };
    this._skipRequested = false;
    this._stopRequested = false;
    this._recoveryPending = true;
    this._appendLogLine('warn', '已恢复未完成任务；当前保持暂停，需人工确认后继续');
    this._emitState();
    return { ok: true, runId, runDir: resolvedRunDir, recoveryPending: true };
  }

  async start(payload) {
    if (this.state.running) return { ok: false, error: '任务正在运行中' };

    const templatePath = String(payload?.templatePath || '').trim();
    if (!templatePath) return { ok: false, error: '未选择模板（请先到「采集模板」里选择/保存一个模板）' };

    const presetKey = normalizePresetKey(payload?.presetKey || 'standard');
    const preset = TASK_PRESETS[presetKey] || TASK_PRESETS.standard;
    const items = normalizeItems(payload || {});
    if (!items.length) return { ok: false, error: 'URL 列表为空' };
    const invalidItems = items.filter((item) => !isAllowedTaskUrl(item.url));
    if (invalidItems.length) {
      const sample = invalidItems[0]?.url || '';
      return {
        ok: false,
        code: 'PGY_TASK_URL_NOT_ALLOWED',
        error: `为了降低误操作和平台风控风险，批量采集只允许蒲公英链接（${ALLOWED_TASK_HOSTS.join(', ')}）。请移除或修正：${sample}`
      };
    }
    if (items.length > SAFE_BATCH_LIMIT) {
      return {
        ok: false,
        error: `为了降低平台风控风险，单次最多采集 ${SAFE_BATCH_LIMIT} 个达人。请拆成多批，或先导出候选表分批执行。`
      };
    }
    const cooldownState = this._readCooldownState();
    if (!cooldownState.ok) {
      return {
        ok: false,
        code: 'PGY_COOLDOWN_STATE_INVALID',
        error: `无法确认已有冷却边界，已停止新任务：${cooldownState.error || '冷却状态不可读'}`
      };
    }
    if (cooldownState.activeRunId) {
      return {
        ok: false,
        code: 'PGY_UNFINISHED_RUN',
        runId: cooldownState.activeRunId,
        runDir: cooldownState.activeRunDir || '',
        error: `检测到未完成任务 ${cooldownState.activeRunId}。请先恢复并处理该任务，不能通过重启直接开始新批次。`
      };
    }
    const lastFinishedAt = Number(cooldownState.lastFinishedAt || 0);
    const elapsedSinceLastRun = Date.now() - Number(lastFinishedAt || 0);
    if (lastFinishedAt && elapsedSinceLastRun < SAFE_RUN_COOLDOWN_MS) {
      const remainingMs = SAFE_RUN_COOLDOWN_MS - elapsedSinceLastRun;
      const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
      return {
        ok: false,
        code: 'PGY_RUN_COOLDOWN',
        error: `为降低平台风控风险，上一批结束后需要间隔至少 5 分钟再开始下一批。请休息约 ${remainingMin} 分钟后重试。`
      };
    }
    const signingTask = normalizeSigningTask(payload?.signingTask || {});

    const runId = this.deps.makeRunId();
    const runDir = path.join(this.deps.getRunsDir(), runId);
    fs.mkdirSync(runDir, { recursive: true });
    if (!this._markRunActive(runId, runDir, lastFinishedAt)) {
      return {
        ok: false,
        code: 'PGY_COOLDOWN_PERSIST_FAILED',
        error: '无法持久化当前批次的冷却边界，已停止启动，避免崩溃重启后绕过安全间隔。'
      };
    }

    const requestedOptions = payload?.options && typeof payload.options === 'object' ? payload.options : {};
    const requestedTabWaitMs = Number(requestedOptions.tabWaitMs || 0);
    const effectiveOptions = {
      ...requestedOptions,
      tabWaitMs: Number.isFinite(requestedTabWaitMs) && requestedTabWaitMs > 0
        ? Math.max(preset.tabWaitMs, requestedTabWaitMs)
        : preset.tabWaitMs,
      resolveNoteUrlByClick: false,
      resolveLimit: 0
    };

    this.state = {
      ...this.state,
      running: true,
      paused: false,
      pauseReason: '',
      presetKey: preset.key,
      templatePath,
      options: effectiveOptions,
      signingTask,
      runId,
      runDir,
      currentId: null,
      queue: items.map((it, i) => ({
        id: `t${i + 1}`,
        url: it.url,
        label: it.label || '',
        note: it.note || '',
        candidateStatus: it.status || 'candidate',
        priority: it.priority || '',
        excludeReason: it.excludeReason || '',
        status: 'pending', // pending | running | paused | ok | fail | skipped
        startedAt: null,
        finishedAt: null,
        error: '',
        subRunId: '',
        subRunDir: '',
        jsonPath: ''
      })),
      logs: [],
      pausePending: false,
      pauseRequestedAt: null,
      stopPending: false,
      stopRequestedAt: null,
      stopReason: '',
      finishReason: '',
      finishedAt: null,
      skipPending: false,
      skipRequestedAt: null,
      recoveryPending: false,
      recoveredAt: null,
      persistenceError: null
    };

    this._skipRequested = false;
    this._stopRequested = false;
    this._recoveryPending = false;
    this._log('info', `任务开始：${items.length} 条，预设=${preset.label}，签约任务=${signingTask.taskName}`);
    this._writeMeta();
    this._emitState();

    this._launchLoop();

    return { ok: true, runId, runDir };
  }

  async pause(reason = 'user') {
    if (!this.state.running) return { ok: false, error: '当前没有运行中的任务' };
    if (this.state.paused) return { ok: true, pending: false, paused: true };
    if (this.state.pausePending) {
      return { ok: true, pending: true, message: '暂停请求已登记：完成当前达人后暂停' };
    }

    const pauseReason = reason === 'user' ? '用户请求：完成当前达人后暂停' : String(reason || '暂停');
    if (this.state.currentId) {
      this.state.pausePending = true;
      this.state.pauseRequestedAt = Date.now();
      this._log('warn', `已请求暂停：完成当前达人后暂停（${this.state.currentId}）`);
      return { ok: true, pending: true, message: '完成当前达人后暂停' };
    }

    this.state.paused = true;
    this.state.pauseReason = pauseReason;
    this._newPauseGate();
    this._log('warn', `已暂停：${this.state.pauseReason}`);
    return { ok: true, pending: false, paused: true };
  }

  async resume() {
    if (!this.state.running) return { ok: false, error: '当前没有运行中的任务' };
    if (this.state.pausePending && !this.state.paused) {
      this.state.pausePending = false;
      this.state.pauseRequestedAt = null;
      this._log('info', '已取消“完成当前达人后暂停”的请求');
      return { ok: true, cancelledPendingPause: true };
    }
    if (!this.state.paused) return { ok: true };
    this.state.paused = false;
    const reason = this.state.pauseReason;
    this.state.pauseReason = '';
    this.state.pausePending = false;
    this.state.pauseRequestedAt = null;
    if (this._recoveryPending) {
      this._recoveryPending = false;
      this.state.recoveryPending = false;
      this._log('info', `继续恢复任务（暂停原因：${reason || '-'}）`);
      this._launchLoop();
      return { ok: true, recovered: true };
    }
    const r = this._pauseGateResolve;
    this._pauseGateResolve = null;
    this._pauseGate = null;
    r?.('resume');
    this._log('info', `继续执行（上次暂停原因：${reason || '-'}）`);
    return { ok: true };
  }

  async skipCurrent() {
    if (!this.state.running) return { ok: false, error: '当前没有运行中的任务' };
    if (!this.state.currentId) return { ok: false, error: '当前没有正在处理的任务' };

    // 人工介入暂停点已经是安全点，可立即结束当前项。
    if (this.state.paused && this._pauseGateResolve) {
      const r = this._pauseGateResolve;
      this._pauseGateResolve = null;
      this._pauseGate = null;
      this.state.paused = false;
      this.state.pauseReason = '';
      this.state.skipPending = false;
      this.state.skipRequestedAt = null;
      this._skipRequested = false;
      r('skip');
      this._log('warn', `在安全暂停点跳过当前（${this.state.currentId}）`);
      return { ok: true, pending: false };
    }

    if (this._skipRequested) return { ok: true, pending: true };
    this._skipRequested = true;
    this.state.skipPending = true;
    this.state.skipRequestedAt = Date.now();
    this._wakeControlWaiters('skip');
    this._log('warn', `已请求跳过：将在下一个安全点停止当前项（${this.state.currentId}）`);
    return { ok: true, pending: true, message: '将在下一个安全点停止当前项' };
  }

  async stop(reason = 'user') {
    if (!this.state.running) return { ok: false, error: '当前没有运行中的任务' };
    if (this._stopRequested) {
      return { ok: true, pending: true, message: '停止请求已登记，正在等待安全点' };
    }

    this._stopRequested = true;
    this.state.stopPending = true;
    this.state.stopRequestedAt = Date.now();
    this.state.stopReason = reason === 'user' ? '用户停止整批任务' : String(reason || '停止整批任务');
    this.state.pausePending = false;
    this.state.pauseRequestedAt = null;
    this._wakeControlWaiters('stop');
    if (this._pauseGateResolve) {
      const resolve = this._pauseGateResolve;
      this._pauseGateResolve = null;
      this._pauseGate = null;
      this.state.paused = false;
      this.state.pauseReason = '';
      resolve('stop');
    }
    this._log('warn', this.state.currentId
      ? `已请求停止整批任务：将在下一个安全点结束当前达人（${this.state.currentId}）`
      : '已请求停止整批任务：将在启动下一位达人前结束');
    return { ok: true, pending: true, message: '将在下一个安全点停止整批任务' };
  }

  _wakeControlWaiters(action) {
    for (const resolve of Array.from(this._controlWaiters)) resolve(action);
  }

  _waitForSafePoint(ms) {
    if (this._stopRequested) return Promise.resolve('stop');
    if (this._skipRequested) return Promise.resolve('skip');
    const delayMs = Math.max(0, Number(ms || 0));
    if (!delayMs) return Promise.resolve('continue');
    return new Promise((resolve) => {
      let settled = false;
      const finish = (action) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this._controlWaiters.delete(finish);
        resolve(action || 'continue');
      };
      const timer = setTimeout(() => finish('continue'), delayMs);
      this._controlWaiters.add(finish);
    });
  }

  _stopItemIfSkipRequested(item) {
    if (!this._skipRequested) return false;
    item.status = 'skipped';
    item.finishedAt = Date.now();
    item.error = '用户请求跳过；已在安全点停止';
    this._skipRequested = false;
    this.state.skipPending = false;
    this.state.skipRequestedAt = null;
    this._appendLogLine('warn', `已在安全点跳过：${item.url}`);
    this._emitState();
    return true;
  }

  _stopRunIfRequested(item) {
    if (!this._stopRequested) return false;
    const now = Date.now();
    if (item && ['pending', 'running', 'paused'].includes(String(item.status || ''))) {
      item.status = 'skipped';
      item.finishedAt = now;
      item.error = '用户停止整批任务；当前项已在安全点结束';
    }
    for (const queued of this.state.queue) {
      if (queued === item || String(queued.status || '') !== 'pending') continue;
      queued.status = 'skipped';
      queued.finishedAt = now;
      queued.error = '整批任务已停止，未执行';
    }
    this.state.skipPending = false;
    this.state.skipRequestedAt = null;
    this._skipRequested = false;
    this._appendLogLine('warn', '整批任务已在安全点停止，后续达人不会继续执行');
    this._emitState();
    return true;
  }

  _stopItemIfControlRequested(item) {
    return this._stopRunIfRequested(item) || this._stopItemIfSkipRequested(item);
  }

  async _waitIfPaused() {
    if (!this.state.paused) return 'resume';
    if (!this._pauseGate) this._newPauseGate();
    const action = await this._pauseGate;
    return action || 'resume';
  }

  async _pauseForManualIntervention(reason, item) {
    this.state.paused = true;
    this.state.pauseReason = reason;
    this.state.pausePending = false;
    this.state.pauseRequestedAt = null;
    if (item) item.status = 'paused';
    this._newPauseGate();
    this._log('warn', `需要手工介入：${reason}`);
    const action = await this._waitIfPaused();
    return action;
  }

  async _pauseBetweenItemsIfRequested(hasMorePendingItems) {
    if (!this.state.pausePending) return;
    if (!hasMorePendingItems) {
      this.state.pausePending = false;
      this.state.pauseRequestedAt = null;
      return;
    }
    this.state.pausePending = false;
    this.state.pauseRequestedAt = null;
    this.state.paused = true;
    this.state.pauseReason = '用户请求：已完成当前达人，现已暂停';
    this._newPauseGate();
    this._log('warn', '当前达人已完成，任务现已暂停');
    await this._waitIfPaused();
  }

  async _runLoop() {
    const preset = TASK_PRESETS[this.state.presetKey] || TASK_PRESETS.standard;
    for (let i = 0; i < this.state.queue.length; i++) {
      if (this._stopRequested) break;
      const item = this.state.queue[i];
      if (item.status !== 'pending') continue;

      // 任务间暂停不把下一位达人伪装成 running。
      if (this.state.paused) await this._waitIfPaused();
      if (this._stopRequested) break;

      this.state.currentId = item.id;
      item.status = 'running';
      item.startedAt = Date.now();
      this._skipRequested = false;
      this.state.skipPending = false;
      this.state.skipRequestedAt = null;
      this._emitState();

      const creatorId = safeName(`${i + 1}_${item.url}`).slice(0, 60);
      const subRunId = `${this.state.runId}/${creatorId}`;

      // 为每个 URL 做“可重试”的 loop：遇到登录态/抽取失败时暂停，resume 后重试
      let done = false;
      while (!done) {
        if (this._stopItemIfControlRequested(item)) {
          done = true;
          continue;
        }
        // 1) 打开 creator_url
        try {
          this._log('info', `打开：${item.url}`);
          await this.deps.openUrl(item.url);
          // 跳过会立即结束页面等待，但仍需先做一次登录/风控检查。
          await this._waitForSafePoint(jitteredDelayMs(preset.pageWaitMs, preset.pageWaitJitterMs));
        } catch (err) {
          if (this._stopItemIfControlRequested(item)) {
            done = true;
            continue;
          }
          item.error = `打开失败：${String(err?.message || err)}`;
          const action = await this._pauseForManualIntervention(item.error, item);
          if (action === 'skip') {
            item.status = 'skipped';
            item.finishedAt = Date.now();
            done = true;
          } else {
            item.status = 'running';
          }
          this._emitState();
          continue;
        }

        if (this._stopItemIfControlRequested(item)) {
          done = true;
          continue;
        }

        // 2) 登录态检查（URL 命中 /login 或 pgy:checkLogin loggedIn=false）
        try {
          const curUrl = String(this.deps.getCurrentUrl() || '');
          if (/\/login/i.test(curUrl)) {
            const action = await this._pauseForManualIntervention('检测到 /login，请在右侧完成登录后点击“继续”', item);
            if (action === 'skip') {
              item.status = 'skipped';
              item.finishedAt = Date.now();
              done = true;
            } else {
              item.status = 'running';
            }
            this._emitState();
            continue;
          }
          if (!isSameTaskPage(item.url, curUrl)) {
            const action = await this._pauseForManualIntervention(
              '页面已离开当前达人，已停止抽取。请不要在采集运行时导航或切换网页；点击继续后会重新打开当前达人。',
              item
            );
            if (action === 'skip') {
              item.status = 'skipped';
              item.finishedAt = Date.now();
              done = true;
            } else {
              item.status = 'running';
            }
            this._emitState();
            continue;
          }

          const login = await this.deps.checkLogin();
          // 风控结果优先于用户跳过，防止跳过当前项后继续请求下一位。
          if (login?.ok && login?.riskDetected) {
            const action = await this._pauseForManualIntervention(
              `检测到页面可能触发安全验证/风控：${login.riskText || '请在右侧手工确认后继续'}`,
              item
            );
            if (action === 'skip') {
              item.status = 'skipped';
              item.finishedAt = Date.now();
              done = true;
            } else {
              item.status = 'running';
            }
            this._emitState();
            continue;
          }
          if (this._stopItemIfControlRequested(item)) {
            done = true;
            continue;
          }
          if (login?.ok && login?.loggedIn === false) {
            const action = await this._pauseForManualIntervention('检测到未登录（pgy:checkLogin loggedIn=false），请手工介入后继续', item);
            if (action === 'skip') {
              item.status = 'skipped';
              item.finishedAt = Date.now();
              done = true;
            } else {
              item.status = 'running';
            }
            this._emitState();
            continue;
          }
        } catch (_) {
          // best-effort：不阻断
          if (this._stopItemIfControlRequested(item)) {
            done = true;
            continue;
          }
        }

        // 3) 调用抽取（使用当前模板）
        if (this._stopItemIfControlRequested(item)) {
          done = true;
          continue;
        }
        this._log('info', `抽取中：${item.url}`);
        const r = await this.deps.extractCurrentMultiPage(this.state.templatePath, {
          ...this.state.options,
          runId: subRunId,
          expectedCreatorName: item.label || ''
        });

        if (this._stopItemIfControlRequested(item)) {
          done = true;
          continue;
        }

        if (!r?.ok) {
          item.error = r?.riskDetected
            ? `检测到页面可能触发安全验证/风控：${r?.riskText || r?.error || '请在右侧手工确认后继续'}`
            : `抽取失败：${r?.error || 'unknown error'}`;
          if (!r?.riskDetected && this._stopItemIfControlRequested(item)) {
            done = true;
            continue;
          }
          const action = await this._pauseForManualIntervention(item.error, item);
          if (action === 'skip') {
            item.status = 'skipped';
            item.finishedAt = Date.now();
            done = true;
          } else {
            item.status = 'running';
          }
          this._emitState();
          continue;
        }

        if (this._stopItemIfControlRequested(item)) {
          done = true;
          continue;
        }

        item.status = 'ok';
        item.finishedAt = Date.now();
        item.subRunId = subRunId;
        item.subRunDir = r.runDir || '';
        item.jsonPath = r.jsonPath || '';
        item.error = '';
        this._log('info', `完成：${item.url}`);
        this._emitState();
        done = true;
      }

      this.state.currentId = null;
      if (this._stopRequested) break;
      const hasMorePendingItems = this.state.queue.slice(i + 1).some((queued) => queued.status === 'pending');
      await this._pauseBetweenItemsIfRequested(hasMorePendingItems);
    }

    if (this._stopRequested) this._stopRunIfRequested(null);
    const stoppedByUser = this._stopRequested;
    const finishedAt = Date.now();
    this.state.running = false;
    this.state.paused = false;
    this.state.pauseReason = '';
    this.state.pausePending = false;
    this.state.pauseRequestedAt = null;
    this.state.stopPending = false;
    this.state.stopRequestedAt = null;
    this.state.stopReason = stoppedByUser ? (this.state.stopReason || '用户停止整批任务') : '';
    this.state.finishReason = stoppedByUser ? 'stopped_by_user' : 'completed';
    this.state.finishedAt = finishedAt;
    this.state.skipPending = false;
    this.state.skipRequestedAt = null;
    this.state.recoveryPending = false;
    this.state.currentId = null;
    this._skipRequested = false;
    this._stopRequested = false;
    this._recoveryPending = false;
    this._writeLastFinishedAt(finishedAt);
    this._log(stoppedByUser ? 'warn' : 'info', stoppedByUser ? '任务已由用户安全停止' : '任务队列已完成');
  }
}

module.exports = {
  TaskRunner,
  TASK_PRESETS,
  SAFE_BATCH_LIMIT,
  SAFE_RUN_COOLDOWN_MS,
  SAFE_RUN_COOLDOWN_FILE,
  TASK_STATE_FILE,
  TASK_STATE_SCHEMA_VERSION,
  ALLOWED_TASK_HOSTS,
  isAllowedTaskUrl,
  isSameTaskPage,
  jitteredDelayMs,
  normalizePresetKey,
  normalizeTaskUrl
};
