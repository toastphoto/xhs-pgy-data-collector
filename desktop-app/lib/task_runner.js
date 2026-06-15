const fs = require('fs');
const path = require('path');
const { safeName } = require('./evidence');

const TASK_PRESETS = {
  standard: {
    key: 'standard',
    label: '标准',
    pageWaitMs: 1200,
    tabWaitMs: 1200,
    // 本次实现（方案一）：不强求 note_url，默认不做“点击补全链接”
    resolveNoteUrlByClick: false,
    resolveLimit: 0
  },
  conservative: {
    key: 'conservative',
    label: '保守',
    pageWaitMs: 2200,
    tabWaitMs: 2000,
    resolveNoteUrlByClick: false,
    resolveLimit: 0
  },
  fast: {
    key: 'fast',
    label: '加速',
    pageWaitMs: 700,
    tabWaitMs: 700,
    resolveNoteUrlByClick: false,
    resolveLimit: 0
  }
};

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeUrlList(urls) {
  const list = Array.isArray(urls) ? urls : [];
  const out = [];
  const seen = new Set();
  for (const x of list) {
    const s = String(x || '').trim();
    if (!s) continue;
    const u = /^https?:\/\//i.test(s) ? s : `https://${s}`;
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
    const url = String(it?.pgy_url || it?.url || '').trim();
    if (!url) continue;
    const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    if (seen.has(u)) continue;
    seen.add(u);
    outItems.push({
      url: u,
      label: String(it?.creator_name || it?.name || it?.label || '').trim()
    });
  }

  // 补充 urls（若未出现在 items 中）
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    outItems.push({ url: u, label: '' });
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
      runId: '',
      runDir: '',
      queue: [],
      currentId: null,
      logs: []
    };

    this._loopPromise = null;
    this._pauseGate = null;
    this._pauseGateResolve = null;
    this._skipAfterCurrent = false;
  }

  _log(level, message, extra) {
    const line = {
      t: Date.now(),
      ts: new Date().toLocaleString('zh-CN', { hour12: false }),
      level,
      message: String(message || ''),
      extra: extra ?? null
    };
    this.state.logs.push(line);
    if (this.state.logs.length > 200) this.state.logs = this.state.logs.slice(-200);
    this._emitState();
  }

  _emitState() {
    try {
      this.deps.sendState(JSON.parse(JSON.stringify(this.state)));
    } catch (_) {
      // ignore
    }
    this._writeTaskState();
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
            items: this.state.queue.map((x) => ({ url: x.url, label: x.label || '' })),
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
    if (!this.state.runDir) return;
    try {
      const queue = Array.isArray(this.state.queue) ? this.state.queue : [];
      const counts = queue.reduce((acc, item) => {
        const key = item?.status || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const payload = {
        runId: this.state.runId,
        runDir: this.state.runDir,
        updatedAt: nowIso(),
        running: Boolean(this.state.running),
        paused: Boolean(this.state.paused),
        pauseReason: this.state.pauseReason || '',
        currentId: this.state.currentId || null,
        presetKey: this.state.presetKey,
        counts,
        queue: queue.map((item) => ({
          id: item.id,
          url: item.url,
          label: item.label || '',
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
      fs.writeFileSync(path.join(this.state.runDir, 'task_state.json'), JSON.stringify(payload, null, 2), 'utf-8');
    } catch (_) {
      // 状态文件是辅助产物，不能影响采集主流程。
    }
  }

  _newPauseGate() {
    this._pauseGate = new Promise((resolve) => {
      this._pauseGateResolve = resolve;
    });
    return this._pauseGate;
  }

  async start(payload) {
    if (this.state.running) return { ok: false, error: '任务正在运行中' };

    const templatePath = String(payload?.templatePath || '').trim();
    if (!templatePath) return { ok: false, error: '未选择模板（请先到「采集模板」里选择/保存一个模板）' };

    const presetKey = String(payload?.presetKey || 'standard').trim();
    const preset = TASK_PRESETS[presetKey] || TASK_PRESETS.standard;
    const items = normalizeItems(payload || {});
    if (!items.length) return { ok: false, error: 'URL 列表为空' };

    const runId = this.deps.makeRunId();
    const runDir = path.join(this.deps.getRunsDir(), runId);
    fs.mkdirSync(runDir, { recursive: true });

    const effectiveOptions = {
      tabWaitMs: preset.tabWaitMs,
      resolveNoteUrlByClick: preset.resolveNoteUrlByClick,
      resolveLimit: preset.resolveLimit,
      // 允许 UI 额外覆盖（但本次 Task 6 先不暴露太多）
      ...(payload?.options || {})
    };

    this.state = {
      ...this.state,
      running: true,
      paused: false,
      pauseReason: '',
      presetKey: preset.key,
      templatePath,
      options: effectiveOptions,
      runId,
      runDir,
      currentId: null,
      queue: items.map((it, i) => ({
        id: `t${i + 1}`,
        url: it.url,
        label: it.label || '',
        status: 'pending', // pending | running | paused | ok | fail | skipped
        startedAt: null,
        finishedAt: null,
        error: '',
        subRunId: '',
        subRunDir: '',
        jsonPath: ''
      })),
      logs: []
    };

    this._skipAfterCurrent = false;
    this._log('info', `任务开始：${items.length} 条，预设=${preset.label}`);
    this._writeMeta();
    this._emitState();

    this._loopPromise = this._runLoop().catch((err) => {
      this._log('error', `任务循环异常：${String(err?.message || err)}`);
      this.state.running = false;
      this.state.paused = false;
      this.state.pauseReason = '';
      this._emitState();
    });

    return { ok: true, runId, runDir };
  }

  async pause(reason = 'user') {
    if (!this.state.running) return { ok: false, error: '当前没有运行中的任务' };
    if (this.state.paused) return { ok: true };
    this.state.paused = true;
    this.state.pauseReason = reason === 'user' ? '用户暂停' : String(reason || '暂停');
    this._log('warn', `已暂停：${this.state.pauseReason}`);
    this._newPauseGate();
    this._emitState();
    return { ok: true };
  }

  async resume() {
    if (!this.state.running) return { ok: false, error: '当前没有运行中的任务' };
    if (!this.state.paused) return { ok: true };
    this.state.paused = false;
    const reason = this.state.pauseReason;
    this.state.pauseReason = '';
    this._log('info', `继续执行（上次暂停原因：${reason || '-'}）`);
    const r = this._pauseGateResolve;
    this._pauseGateResolve = null;
    this._pauseGate = null;
    r?.('resume');
    this._emitState();
    return { ok: true };
  }

  async skipCurrent() {
    if (!this.state.running) return { ok: false, error: '当前没有运行中的任务' };
    if (!this.state.currentId) return { ok: false, error: '当前没有正在处理的任务' };

    // 若在暂停点，直接解锁并跳过；若正在执行中，则标记“结束后跳过”
    if (this.state.paused && this._pauseGateResolve) {
      this._log('warn', `跳过当前（${this.state.currentId}）`);
      const r = this._pauseGateResolve;
      this._pauseGateResolve = null;
      this._pauseGate = null;
      this.state.paused = false;
      this.state.pauseReason = '';
      r('skip');
      this._emitState();
      return { ok: true };
    }

    this._skipAfterCurrent = true;
    this._log('warn', `已标记：当前任务结束后跳过（${this.state.currentId}）`);
    return { ok: true };
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
    if (item) item.status = 'paused';
    this._log('warn', `需要手工介入：${reason}`);
    this._newPauseGate();
    this._emitState();
    const action = await this._waitIfPaused();
    return action;
  }

  async _runLoop() {
    const preset = TASK_PRESETS[this.state.presetKey] || TASK_PRESETS.standard;
    for (let i = 0; i < this.state.queue.length; i++) {
      const item = this.state.queue[i];
      if (item.status !== 'pending') continue;

      this.state.currentId = item.id;
      item.status = 'running';
      item.startedAt = Date.now();
      this._skipAfterCurrent = false;
      this._emitState();

      // 整体暂停点（用户点暂停）
      if (this.state.paused) {
        const action = await this._waitIfPaused();
        if (action === 'skip') {
          item.status = 'skipped';
          item.finishedAt = Date.now();
          this._emitState();
          continue;
        }
      }

      const creatorId = safeName(`${i + 1}_${item.url}`).slice(0, 60);
      const subRunId = `${this.state.runId}/${creatorId}`;

      // 为每个 URL 做“可重试”的 loop：遇到登录态/抽取失败时暂停，resume 后重试
      let done = false;
      while (!done) {
        // 1) 打开 creator_url
        try {
          this._log('info', `打开：${item.url}`);
          await this.deps.openUrl(item.url);
          await sleep(preset.pageWaitMs);
        } catch (err) {
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

          const login = await this.deps.checkLogin();
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
        }

        // 3) 调用抽取（使用当前模板）
        this._log('info', `抽取中：${item.url}`);
        const r = await this.deps.extractCurrentMultiPage(this.state.templatePath, {
          ...this.state.options,
          runId: subRunId
        });

        if (this._skipAfterCurrent) {
          item.status = 'skipped';
          item.finishedAt = Date.now();
          item.error = '用户请求跳过';
          this._skipAfterCurrent = false;
          this._log('warn', `已跳过：${item.url}`);
          done = true;
          this._emitState();
          continue;
        }

        if (!r?.ok) {
          item.error = `抽取失败：${r?.error || 'unknown error'}`;
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
    }

    this.state.running = false;
    this.state.paused = false;
    this.state.pauseReason = '';
    this.state.currentId = null;
    this._log('info', '任务队列已结束');
    this._emitState();
  }
}

module.exports = { TaskRunner, TASK_PRESETS };
