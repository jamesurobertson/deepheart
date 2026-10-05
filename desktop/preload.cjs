/** The one thing the game can ask of the desktop app: hear about a newer release, and download it. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deepheart', {
  onUpdate: (callback) => ipcRenderer.on('update', (_e, update) => callback(update)),
  downloadUpdate: () => ipcRenderer.send('update:download'),
});
