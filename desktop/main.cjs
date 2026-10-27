/**
 * Deepheart as a desktop app. The built web game (../dist, copied into the app as resources/game) is served from a
 * private app:// origin rather than file://, because the game fetches its sprites and sounds and Chromium won't fetch
 * file:// URLs. Saves are plain files in the app's data folder (saves/), where Steam Cloud can pick them up.
 */
const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const steam = require('./steam.cjs');

const RELEASES = 'https://api.github.com/repos/jamesurobertson/deepheart/releases/latest';
/** How often a running game checks for a newer release (it also checks on launch). */
const CHECK_EVERY = 6 * 60 * 60 * 1000;

const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.join(__dirname, '..', 'dist');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
// Music and sounds start without waiting for a click, as a game should.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
steam.prepare();

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
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
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
  // Under Steam, Steam does the updating.
  if (!steam.enabled) {
    win.webContents.once('did-finish-load', () => {
      checkForUpdate(win);
      setInterval(() => checkForUpdate(win), CHECK_EVERY);
    });
  }
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
}

/** "0.1.10" > "0.1.9". */
function newer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

/** This computer's download in a release: the Mac build for its chip, the Windows installer, or the AppImage. */
function assetFor(assets) {
  const want = process.platform === 'darwin' ? `mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}.dmg` : process.platform === 'win32' ? 'windows-setup.exe' : '.AppImage';
  return assets.find((a) => a.name.endsWith(want));
}

let update = null;

/** Ask GitHub for the latest release; if it's newer than this app, tell the game. Offline or rate-limited: try later. */
async function checkForUpdate(win) {
  try {
    const res = await net.fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    const release = await res.json();
    const version = String(release.tag_name).replace(/^v/, '');
    if (!newer(version, app.getVersion())) return;
    const asset = assetFor(release.assets ?? []);
    update = { version, url: asset ? asset.browser_download_url : release.html_url };
    if (!win.isDestroyed()) win.webContents.send('update', update);
  } catch {
    // No connection: the next check will try again.
  }
}

ipcMain.on('update:download', () => {
  if (update) shell.openExternal(update.url);
});

// ---------- saves ----------

const SAVES = path.join(app.getPath('userData'), 'saves');
/** A copy of each save is kept this often, the last BACKUPS of them, in case a save file is ever damaged. */
const BACKUP_EVERY = 10 * 60 * 1000;
const BACKUPS = 3;
const backedUp = new Map();

/** "deepheart-save" → saves/save.json, "deepheart-save:playtest" → saves/save-playtest.json. */
function saveFile(key) {
  const slot = String(key).replace(/^deepheart-save:?/, '').replace(/[^a-z0-9_-]+/gi, '-');
  return path.join(SAVES, slot ? `save-${slot}.json` : 'save.json');
}

const readable = (file) => {
  try {
    const text = fs.readFileSync(file, 'utf8');
    JSON.parse(text);
    return text;
  } catch {
    return null;
  }
};

ipcMain.on('save:read', (e, key) => {
  const file = saveFile(key);
  if (!fs.existsSync(file)) return void (e.returnValue = null);
  // A damaged save falls back to the newest backup that reads.
  let text = readable(file);
  for (let i = 1; !text && i <= BACKUPS; i++) text = readable(`${file}.bak${i}`);
  e.returnValue = text;
});

ipcMain.on('save:write', (e, key, text) => {
  try {
    fs.mkdirSync(SAVES, { recursive: true });
    const file = saveFile(key);
    const now = Date.now();
    if (fs.existsSync(file) && now - (backedUp.get(file) ?? 0) > BACKUP_EVERY) {
      for (let i = BACKUPS; i > 1; i--) if (fs.existsSync(`${file}.bak${i - 1}`)) fs.renameSync(`${file}.bak${i - 1}`, `${file}.bak${i}`);
      fs.copyFileSync(file, `${file}.bak1`);
      backedUp.set(file, now);
    }
    // Written whole and then swapped in, so a crash mid-write never leaves half a save.
    fs.writeFileSync(`${file}.tmp`, text);
    fs.renameSync(`${file}.tmp`, file);
    e.returnValue = true;
  } catch {
    e.returnValue = false;
  }
});

/** New Game: the save goes, and so do its backups (one copy is kept aside, just in case). */
ipcMain.on('save:remove', (e, key) => {
  const file = saveFile(key);
  try {
    if (fs.existsSync(file)) fs.renameSync(file, `${file}.removed`);
    for (let i = 1; i <= BACKUPS; i++) fs.rmSync(`${file}.bak${i}`, { force: true });
  } catch { /* nothing to remove */ }
  e.returnValue = true;
});

ipcMain.on('steam:trophies', (_e, trophies) => steam.unlock(trophies));

/** The play log (src/record.ts): appended to logs/<date>.jsonl in the app's data folder, for testing; a real Steam
 *  release keeps none. */
ipcMain.on('log:append', (_e, text) => {
  if (steam.release) return;
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`), String(text));
  } catch { /* a missed log line is no loss */ }
});

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const file = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url).pathname)));
    if (!file.startsWith(ROOT)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // The Mac keeps its standard menu (Cmd+Q, full screen); elsewhere there's no menu bar at all.
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  steam.start();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
