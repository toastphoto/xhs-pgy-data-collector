export const store = {
  state: {
    appInfo: { version: '' },
    backend: { running: null, host: '127.0.0.1', port: '8010', code: '' }, // running: true | false | null(未知)
    browser: {
      url: '',
      activeTabId: 'collection',
      tabs: [],
      locked: false,
      lockReason: ''
    },
    view: 'login', // login | tasks | exports | templates | report | toolbox | recordings
    recording: { isRecording: false, count: 0, files: [] },
    templates: { activeTemplatePath: '', templates: [] },
    tasks: {
      queue: [],
      running: false,
      paused: false,
      pauseReason: '',
      pausePending: false,
      pauseRequestedAt: null,
      stopPending: false,
      stopRequestedAt: null,
      stopReason: '',
      finishReason: '',
      finishedAt: null,
      skipPending: false,
      skipRequestedAt: null,
      current: null,
      runId: '',
      runDir: '',
      presetKey: 'standard',
      templatePath: '',
      options: {},
      logs: []
    },
    exports: { lastRunId: '', lastExcelPath: '', lastReportPath: '' }
  },
  listeners: [],
  set(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  },
  subscribe(fn) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((x) => x !== fn));
  }
};
