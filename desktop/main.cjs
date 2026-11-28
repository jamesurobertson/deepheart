/**
 * Deepheart as a desktop app. The built web game (../dist, copied into the app as resources/game) is served from a
 * private app:// origin rather than file://, because the game fetches its sprites and sounds and Chromium won't fetch
 * file:// URLs. Saves live in the app's own storage, separate from the browser's, and in a file Steam Cloud can carry:
 * saves/deepheart-save.json (the demo's deepheart-save-demo.json) in the app's data folder (Steamworks Auto-Cloud roots: WinAppDataRoaming, MacAppSupport and
 * LinuxXdgConfig, each with the path Deepheart/saves and the pattern *.json).
 */
const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const RELEASES = 'https://api.github.com/repos/jamesurobertson/deepheart/releases/latest';
/** How often a running game checks for a newer release (it also checks on launch). */
const CHECK_EVERY = 6 * 60 * 60 * 1000;

/** The Steam client (steamworks.js) when the game was started from Steam, else null. Steam sets SteamAppId for the
 *  games it starts; a steam_appid.txt beside the app does the same in development (480, Spacewar, until ours exists). */
const steam = (() => {
  const appId = Number(process.env.SteamAppId) || undefined;
  if (!appId && !fs.existsSync(path.join(process.cwd(), 'steam_appid.txt'))) return null;
  try {
    const steamworks = require('steamworks.js');
    const client = steamworks.init(appId);
    // The overlay (Shift+Tab, achievement pop-ups) draws into the window only with these switches, set before it opens.
    steamworks.electronEnableSteamOverlay();
    return client;
  } catch {
    // Steam isn't running (or the module isn't there): the game runs without it.
    return null;
  }
})();

/** Steam's game language, an API code such as "schinese" (partner.steamgames.com/doc/store/localization/languages).
 *  --steam-language=<code> or DEEPHEART_STEAM_LANGUAGE stands in for Steam when testing. */
function steamLanguage() {
  const forced = process.argv.find((arg) => arg.startsWith('--steam-language='))?.split('=')[1] ?? process.env.DEEPHEART_STEAM_LANGUAGE;
  if (forced) return forced;
  try {
    return steam?.apps.currentGameLanguage() || null;
  } catch {
    return null;
  }
}

/** A trophy's Steam achievement: "kill-1000" is KILL_1000 (as scripts/achievements.ts names them for Steamworks). */
const achievementName = (trophyId) => String(trophyId).toUpperCase().replace(/[^A-Z0-9]+/g, '_');

/** Unlock these trophies on Steam (the ones already unlocked there are skipped). */
ipcMain.on('steam:achieve', (_e, trophyIds) => {
  if (!steam || !Array.isArray(trophyIds)) return;
  for (const id of trophyIds) {
    const name = achievementName(id);
    try {
      if (!steam.achievement.isActivated(name)) steam.achievement.activate(name);
    } catch { /* not defined in Steamworks yet: nothing to unlock */ }
  }
});

const SAVE_DIR = path.join(app.getPath('userData'), 'saves');
/** The file for a save: "deepheart-save" (or the demo's "deepheart-save-demo"), and nothing else. */
const saveFile = (name) => (/^deepheart-save(-[a-z]+)?$/.test(name) ? path.join(SAVE_DIR, `${name}.json`) : null);

/** The save in the file (what Steam Cloud brought down, if it's newer than this computer's), or null. */
ipcMain.on('save:read', (e, name) => {
  try {
    e.returnValue = fs.readFileSync(saveFile(name), 'utf8');
  } catch {
    e.returnValue = null;
  }
});

/** Keep the file in step with the game's own save. Written whole, then renamed over the old one, so a crash mid-write
 *  never leaves Steam Cloud half a save. */
ipcMain.on('save:write', (e, name, text) => {
  const file = saveFile(name);
  try {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
    if (text === null) fs.rmSync(file, { force: true });
    else {
      fs.writeFileSync(`${file}.tmp`, String(text));
      fs.renameSync(`${file}.tmp`, file);
    }
  } catch { /* the next save tries again */ }
  e.returnValue = true;
});

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
  win.webContents.once('did-finish-load', () => {
    checkForUpdate(win);
    setInterval(() => checkForUpdate(win), CHECK_EVERY);
  });
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

let languages = null;
ipcMain.on('languages', (e) => {
  languages ??= { steam: steamLanguage(), os: app.getLocale() || null };
  e.returnValue = languages;
});

ipcMain.on('update:download', () => {
  if (update) shell.openExternal(update.url);
});

/** The play log (src/record.ts): appended to logs/<date>.jsonl in the app's data folder. */
ipcMain.on('log:append', (_e, text) => {
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
  createWindow();
});

app.on('window-all-closed', () => app.quit());
