/** What the game can ask of the desktop app: its save files, Steam achievements, its play log, and news of a newer
 *  release. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deepheart', {
  onUpdate: (callback) => ipcRenderer.on('update', (_e, update) => callback(update)),
  downloadUpdate: () => ipcRenderer.send('update:download'),
  saves: {
    read: (key) => ipcRenderer.sendSync('save:read', key),
    write: (key, text) => ipcRenderer.sendSync('save:write', key, text),
    remove: (key) => ipcRenderer.sendSync('save:remove', key),
  },
  trophies: (ids) => ipcRenderer.send('steam:trophies', ids),
  log: (text) => ipcRenderer.send('log:append', text),
});
