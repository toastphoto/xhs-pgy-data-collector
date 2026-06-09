const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  backend: {
    info: () => ipcRenderer.invoke('backend:info'),
    onStatus: (cb) => ipcRenderer.on('backend:status', (_e, payload) => cb(payload))
  },
  browser: {
    open: (url) => ipcRenderer.invoke('browser:open', url),
    nav: (action) => ipcRenderer.invoke('browser:nav', action),
    getUrl: () => ipcRenderer.invoke('browser:getUrl'),
    setLayout: (payload) => ipcRenderer.invoke('browser:setLayout', payload),
    onUrlChange: (cb) => ipcRenderer.on('browser:url', (_e, payload) => cb(payload))
  },
  pgy: {
    checkLogin: () => ipcRenderer.invoke('pgy:checkLogin'),
    suggestNoteCardSelector: () => ipcRenderer.invoke('pgy:suggestNoteCardSelector'),
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
    pause: () => ipcRenderer.invoke('tasks:pause'),
    resume: () => ipcRenderer.invoke('tasks:resume'),
    skipCurrent: () => ipcRenderer.invoke('tasks:skipCurrent'),
    importExcel: () => ipcRenderer.invoke('tasks:importExcel'),
    openRunDir: () => ipcRenderer.invoke('tasks:openRunDir'),
    openRunsDir: () => ipcRenderer.invoke('tasks:openRunsDir'),
    onState: (cb) => ipcRenderer.on('tasks:state', (_e, payload) => cb(payload))
  },
  exports: {
    listRuns: () => ipcRenderer.invoke('exports:listRuns'),
    exportRun: (payload) => ipcRenderer.invoke('exports:exportRun', payload),
    exportResourceRun: (payload) => ipcRenderer.invoke('exports:exportResourceRun', payload),
    getResourceColumns: () => ipcRenderer.invoke('exports:getResourceColumns'),
    loadColumnPreset: () => ipcRenderer.invoke('exports:loadColumnPreset'),
    saveColumnPreset: (cols) => ipcRenderer.invoke('exports:saveColumnPreset', cols),
    openPath: (p) => ipcRenderer.invoke('exports:openPath', p)
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
