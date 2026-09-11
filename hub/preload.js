const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('hub-close'),
  minimizeWindow: () => ipcRenderer.send('hub-minimize'),
  maximizeWindow: () => ipcRenderer.send('hub-maximize'),
  unmaximizeWindow: () => ipcRenderer.send('hub-unmaximize'),
  toggleMaximize: () => ipcRenderer.send('hub-toggle-maximize'),
  launchApp: () => ipcRenderer.invoke('hub-launch-tools'),
  selectDirectory: (currentPath) => ipcRenderer.invoke('hub-select-dir', currentPath),
  getSystemInfo: () => ipcRenderer.invoke('hub-system-info'),
  checkGitHubUpdates: () => ipcRenderer.invoke('hub-check-github-updates'),
  downloadAndInstallUpdate: (params) => ipcRenderer.invoke('hub-download-and-install-update', params),
  onDownloadProgress: (callback) => {
    ipcRenderer.removeAllListeners('hub-download-progress');
    ipcRenderer.on('hub-download-progress', (e, data) => callback(data));
  },
  openExternal: (url) => ipcRenderer.invoke('hub-open-external', url)
});
