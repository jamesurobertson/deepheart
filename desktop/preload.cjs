/** What the game can ask of the desktop app: news of a newer release (and its download), and its play log. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deepheart', {
  onUpdate: (callback) => ipcRenderer.on('update', (_e, update) => callback(update)),
  downloadUpdate: () => ipcRenderer.send('update:download'),
  log: (text) => ipcRenderer.send('log:append', text),
});
