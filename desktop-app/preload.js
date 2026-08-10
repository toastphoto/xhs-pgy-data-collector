const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  app: {
    info: () => ipcRenderer.invoke('app:info')
  },
  backend: {
    info: () => ipcRenderer.invoke('backend:info'),
    onStatus: (cb) => ipcRenderer.on('backend:status', (_e, payload) => cb(payload))
  },
  browser: {
    open: (url) => ipcRenderer.invoke('browser:open', url),
    openCollection: (url) => ipcRenderer.invoke('browser:openCollection', url),
    nav: (action) => ipcRenderer.invoke('browser:nav', action),
    getUrl: () => ipcRenderer.invoke('browser:getUrl'),
    getCollectionUrl: () => ipcRenderer.invoke('browser:getCollectionUrl'),
    returnToCollectionResults: () => ipcRenderer.invoke('browser:returnToCollectionResults'),
    listTabs: () => ipcRenderer.invoke('browser:listTabs'),
    activateTab: (tabId) => ipcRenderer.invoke('browser:activateTab', tabId),
    closeTab: (tabId) => ipcRenderer.invoke('browser:closeTab', tabId),
    setLayout: (payload) => ipcRenderer.invoke('browser:setLayout', payload),
    onUrlChange: (cb) => ipcRenderer.on('browser:url', (_e, payload) => cb(payload)),
    onTabsChange: (cb) => ipcRenderer.on('browser:tabs', (_e, payload) => cb(payload))
  },
  pgy: {
    checkLogin: () => ipcRenderer.invoke('pgy:checkLogin'),
    pickElement: (payload) => ipcRenderer.invoke('pgy:pickElement', payload),
    inspectCandidateSearchLayout: (templatePath) =>
      ipcRenderer.invoke('pgy:inspectCandidateSearchLayout', templatePath),
    validateCandidateSearchPagination: (templatePath) =>
      ipcRenderer.invoke('pgy:validateCandidateSearchPagination', templatePath),
    scanPageBlocks: (payload) => ipcRenderer.invoke('pgy:scanPageBlocks', payload),
    clearPageBlockHints: () => ipcRenderer.invoke('pgy:clearPageBlockHints'),
    suggestNoteCardSelector: () => ipcRenderer.invoke('pgy:suggestNoteCardSelector'),
    parseCandidateInstruction: (instruction) => ipcRenderer.invoke('pgy:parseCandidateInstruction', instruction),
    extractSearchCandidates: (options) => ipcRenderer.invoke('pgy:extractSearchCandidates', options),
    continueSearchCandidates: (sessionId) => ipcRenderer.invoke('pgy:continueSearchCandidates', sessionId),
    cancelSearchCandidateCheckpoint: (sessionId) =>
      ipcRenderer.invoke('pgy:cancelSearchCandidateCheckpoint', sessionId),
    extractCurrentMultiPage: (templatePath, options) =>
      ipcRenderer.invoke('pgy:extractCurrentMultiPage', templatePath, options)
  },
  recording: {
    start: () => ipcRenderer.invoke('recording:start'),
    stop: () => ipcRenderer.invoke('recording:stop'),
    list: () => ipcRenderer.invoke('recording:list'),
    replay: (filePath) => ipcRenderer.invoke('recording:replay', filePath),
    delete: (filePath) => ipcRenderer.invoke('recording:delete', filePath),
    rename: (filePath, newName) => ipcRenderer.invoke('recording:rename', filePath, newName),
    openFolder: () => ipcRenderer.invoke('recording:openFolder'),
    onCount: (cb) => ipcRenderer.on('recording:count', (_e, n) => cb(n))
  },
  template: {
    list: () => ipcRenderer.invoke('template:list'),
    load: (filePath) => ipcRenderer.invoke('template:load', filePath),
    save: (filePath, contentJson) => ipcRenderer.invoke('template:save', filePath, contentJson),
    clone: (srcPath, newName) => ipcRenderer.invoke('template:clone', srcPath, newName)
  },
  tasks: {
    start: (payload) => ipcRenderer.invoke('tasks:start', payload),
    recover: (runDir) => ipcRenderer.invoke('tasks:recover', runDir),
    pause: () => ipcRenderer.invoke('tasks:pause'),
    resume: () => ipcRenderer.invoke('tasks:resume'),
    stop: () => ipcRenderer.invoke('tasks:stop'),
    skipCurrent: () => ipcRenderer.invoke('tasks:skipCurrent'),
    importExcel: () => ipcRenderer.invoke('tasks:importExcel'),
    exportCandidateSheet: (payload) => ipcRenderer.invoke('tasks:exportCandidateSheet', payload),
    openRunDir: () => ipcRenderer.invoke('tasks:openRunDir'),
    openRunsDir: () => ipcRenderer.invoke('tasks:openRunsDir'),
    onState: (cb) => ipcRenderer.on('tasks:state', (_e, payload) => cb(payload))
  },
  signingTasks: {
    list: () => ipcRenderer.invoke('signingTasks:list'),
    save: (payload) => ipcRenderer.invoke('signingTasks:save', payload),
    delete: (id) => ipcRenderer.invoke('signingTasks:delete', id),
    executionRecords: () => ipcRenderer.invoke('signingTasks:executionRecords')
  },
  exports: {
    listRuns: () => ipcRenderer.invoke('exports:listRuns'),
    exportRun: (payload) => ipcRenderer.invoke('exports:exportRun', payload),
    exportResourceRun: (payload) => ipcRenderer.invoke('exports:exportResourceRun', payload),
    exportContactRun: (payload) => ipcRenderer.invoke('exports:exportContactRun', payload),
    exportContactSelection: (payload) => ipcRenderer.invoke('exports:exportContactSelection', payload),
    exportXiaomifeng: (payload) => ipcRenderer.invoke('exports:exportXiaomifeng', payload),
    getContactPreview: (payload) => ipcRenderer.invoke('exports:getContactPreview', payload),
    loadContactReview: (payload) => ipcRenderer.invoke('exports:loadContactReview', payload),
    saveContactReview: (payload) => ipcRenderer.invoke('exports:saveContactReview', payload),
    importContactReviewWorkbook: () => ipcRenderer.invoke('exports:importContactReviewWorkbook'),
    getResourceColumns: () => ipcRenderer.invoke('exports:getResourceColumns'),
    loadColumnPreset: () => ipcRenderer.invoke('exports:loadColumnPreset'),
    saveColumnPreset: (cols) => ipcRenderer.invoke('exports:saveColumnPreset', cols),
    openPath: (p) => ipcRenderer.invoke('exports:openPath', p)
  },
  approvals: {
    getXiaomifeng: (payload) => ipcRenderer.invoke('approvals:getXiaomifeng', payload),
    submitXiaomifeng: (payload) => ipcRenderer.invoke('approvals:submitXiaomifeng', payload),
    approveXiaomifeng: (payload) => ipcRenderer.invoke('approvals:approveXiaomifeng', payload)
  },
  contacts: {
    openPgyCreator: (url) => ipcRenderer.invoke('contacts:openPgyCreator', url),
    openXhsLogin: () => ipcRenderer.invoke('contacts:openXhsLogin'),
    checkXhsLogin: () => ipcRenderer.invoke('contacts:checkXhsLogin'),
    enrichXhsBatch: (payload) => ipcRenderer.invoke('contacts:enrichXhsBatch', payload),
    pauseXhsEnrichment: () => ipcRenderer.invoke('contacts:pauseXhsEnrichment'),
    resumeXhsEnrichment: () => ipcRenderer.invoke('contacts:resumeXhsEnrichment'),
    cancelXhsEnrichment: () => ipcRenderer.invoke('contacts:cancelXhsEnrichment'),
    openTencentEmail: () => ipcRenderer.invoke('contacts:openTencentEmail'),
    onXhsProgress: (cb) => ipcRenderer.on('contacts:xhsProgress', (_e, payload) => cb(payload))
  },
  db: {
    stats: () => ipcRenderer.invoke('db:stats'),
    syncRuns: () => ipcRenderer.invoke('db:syncRuns')
  },
  kb: {
    stats: () => ipcRenderer.invoke('kb:stats'),
    rebuild: () => ipcRenderer.invoke('kb:rebuild'),
    search: (payload) => ipcRenderer.invoke('kb:search', payload)
  },
  ai: {
    getConfig: () => ipcRenderer.invoke('ai:getConfig'),
    setConfig: (config) => ipcRenderer.invoke('ai:setConfig', config),
    chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
    listModels: (payload) => ipcRenderer.invoke('ai:listModels', payload),
    exportLastSqlResult: () => ipcRenderer.invoke('ai:exportLastSqlResult')
  }
});
