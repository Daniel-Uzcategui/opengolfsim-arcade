const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arcadeAPI', {
  launchGame: (gameName, options) => ipcRenderer.send('launch-game', gameName, options),
  returnToMenu: () => ipcRenderer.send('return-menu'),
  getConnectionStatus: () => ipcRenderer.invoke('get-connection-status'),
  onLaunchMonitorStatus: (callback) => {
    ipcRenderer.on('lm-status-update', (_event, status) => callback(status));
  },
  onShotDispatched: (callback) => {
    ipcRenderer.on('shot-dispatched', (_event, shot) => callback(shot));
  }
});
