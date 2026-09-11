const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  setAlwaysOnTop: (val) => ipcRenderer.send('window-always-on-top', val),
  setRunInBackground: (val) => ipcRenderer.send('window-run-in-background', val),
  copyImage: (dataUrl) => ipcRenderer.invoke('copy-image', dataUrl),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  onMaximizedStatus: (callback) => ipcRenderer.on('window-maximized-status', (event, status) => callback(status)),
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor)
});
