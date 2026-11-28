/** What the game can ask of the desktop app: news of a newer release (and its download), its play log, the languages
 *  it could start in (Steam's, then the system's), Steam achievements, and the save file Steam Cloud carries. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deepheart', {
  onUpdate: (callback) => ipcRenderer.on('update', (_e, update) => callback(update)),
  downloadUpdate: () => ipcRenderer.send('update:download'),
  log: (text) => ipcRenderer.send('log:append', text),
  languages: ipcRenderer.sendSync('languages'),
  achieve: (trophyIds) => ipcRenderer.send('steam:achieve', trophyIds),
  readSave: (name) => ipcRenderer.sendSync('save:read', name),
  // (Waits for the file to be written: the last save goes as the window closes.)
  writeSave: (name, text) => ipcRenderer.sendSync('save:write', name, text),
});
