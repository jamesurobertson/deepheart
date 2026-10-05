/**
 * Deepheart as a desktop app. The built web game (../dist, copied into the app as resources/game) is served from a
 * private app:// origin rather than file://, because the game fetches its sprites and sounds and Chromium won't fetch
 * file:// URLs. Saves live in the app's own storage, separate from the browser's.
 */
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.join(__dirname, '..', 'dist');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
// Music and sounds start without waiting for a click, as a game should.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Deepheart',
    backgroundColor: '#0a0708',
    autoHideMenuBar: true,
    show: false,
    // An idle game keeps playing when minimised or covered (this also keeps the page "visible" to the game).
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true },
  });
  win.loadURL('app://game/index.html');
  // Out of sight, out of earshot: it keeps playing while minimised or hidden, just silently.
  for (const quiet of ['minimize', 'hide']) win.on(quiet, () => win.webContents.setAudioMuted(true));
  for (const back of ['restore', 'show']) win.on(back, () => win.webContents.setAudioMuted(false));
  win.once('ready-to-show', () => win.show());
  // Links open in the real browser, never inside the game window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const file = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url).pathname)));
    if (!file.startsWith(ROOT)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // The Mac keeps its standard menu (Cmd+Q, full screen); elsewhere there's no menu bar at all.
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => app.quit());
