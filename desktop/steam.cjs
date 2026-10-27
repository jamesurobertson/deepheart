/**
 * Steam, when the game runs under it: achievements and the overlay, through steamworks.js. Steam sets SteamAppId when
 * it launches the game; DEEPHEART_STEAM_APPID=480 tries it against Valve's test app (Spacewar) from `npm start`.
 * Without Steam running (or outside Steam) every call does nothing, so the same app still runs on its own.
 */
const APP_ID = Number(process.env.DEEPHEART_STEAM_APPID || process.env.SteamAppId || 0);
/** Spacewar has four test achievements of its own: a few trophies stand in for them, to see the pipe work. */
const SPACEWAR = { 'floor-10': 'ACH_WIN_ONE_GAME', 'kill-1000': 'ACH_WIN_100_GAMES', 'desc-1': 'ACH_TRAVEL_FAR_ACCUM', 'raid-1': 'ACH_TRAVEL_FAR_SINGLE' };

let client = null;
const unlocked = new Set();

/** Before the app is ready: the overlay needs its command-line switches set early. */
function prepare() {
  if (!APP_ID) return;
  try {
    require('steamworks.js').electronEnableSteamOverlay();
  } catch (e) {
    console.warn('Steam overlay unavailable:', e.message);
  }
}

function start() {
  if (!APP_ID) return false;
  try {
    client = require('steamworks.js').init(APP_ID);
    console.info(`Steam: signed in as ${client.localplayer.getName()} (app ${APP_ID})`);
  } catch (e) {
    // Steam not running, or not signed in: carry on without it.
    console.warn('Steam unavailable:', e.message);
    client = null;
  }
  return !!client;
}

/** "kill-1000" → "KILL_1000": a trophy's achievement name in the Steamworks settings. */
function achievementFor(trophy) {
  if (APP_ID === 480) return SPACEWAR[trophy] ?? null;
  return trophy.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

/** Every trophy earned so far (it's sent again now and then): the ones Steam doesn't have yet get unlocked. */
function unlock(trophies) {
  if (!client) return;
  let changed = false;
  for (const id of trophies) {
    if (unlocked.has(id)) continue;
    unlocked.add(id);
    const name = achievementFor(id);
    if (!name) continue;
    try {
      if (!client.achievement.isActivated(name)) changed = client.achievement.activate(name) || changed;
    } catch (e) {
      console.warn(`Steam achievement ${name}:`, e.message);
    }
  }
  // Steam keeps (and pops up) an unlock only once stats are stored.
  if (changed) client.stats.store();
}

module.exports = { enabled: APP_ID > 0, prepare, start, unlock };
