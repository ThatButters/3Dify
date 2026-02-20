const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('trayAPI', {
  // State updates from main process
  onStateUpdate: (cb) => ipcRenderer.on('state-update', (_e, data) => cb(data)),

  // Actions from renderer to main
  pauseWorker: () => ipcRenderer.invoke('pause-worker'),
  resumeWorker: () => ipcRenderer.invoke('resume-worker'),
  openAdmin: () => ipcRenderer.invoke('open-admin'),
  openSite: () => ipcRenderer.invoke('open-site'),

  // Local worker management
  startLocalWorker: () => ipcRenderer.invoke('start-local-worker'),
  stopLocalWorker: () => ipcRenderer.invoke('stop-local-worker'),
  getLocalWorkerStatus: () => ipcRenderer.invoke('get-local-worker-status'),

  // Login flow
  login: (serverUrl, username, password) => ipcRenderer.invoke('login', serverUrl, username, password),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
});
