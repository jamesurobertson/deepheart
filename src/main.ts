// Fonts ship with the game (no Google Fonts request), so it also works offline and in the desktop build.
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/jersey-10/400.css';
import './style.css';
import Decimal from 'break_infinity.js';
import { Game, TUNE, floorHp, newSave, SAVE_VERSION, type GameEvent, type SaveState } from './game/game.ts';
import { Atlas } from './render/atlas.ts';
import { FELL_HIT, Scene, type Quality } from './render/scene.ts';
import { fpsOverlay } from './ui/fps.ts';
import { Ui } from './ui/ui.ts';
import { setAtlas } from './ui/px.ts';
import { Sfx, type Track } from './audio/sfx.ts';
import { CARDS, CORRUPTION, LEGENDS, UPGRADES, lapOf, zoneOf } from './game/data.ts';
import { DEMO, DEMO_LAST_FLOOR } from './demo.ts';
import { TitleMenu } from './ui/menu.ts';
import { PlayRecorder } from './record.ts';
import { olderVersion } from './version.ts';
import { installCrashScreen } from './crash.ts';
import { installGamepad } from './ui/gamepad.ts';

installCrashScreen();
installGamepad();

declare global {
  interface Window {
    /** Only in the desktop app (see desktop/preload.cjs). */
    deepheart?: { onUpdate(callback: (update: { version: string }) => void): void; downloadUpdate(): void; log?(text: string): void };
  }
}

const params = new URLSearchParams(location.search);
// ?tune={"costGrowth":1.08} (dev only) overrides pacing knobs for a try, as TUNE='{...}' does for the simulator.
if (import.meta.env.DEV && params.has('tune')) Object.assign(TUNE, JSON.parse(params.get('tune')!));
// ?slot=name (dev only) keeps a separate save (handy for testing without touching your run).
/** Where the site is served from ('./' in builds), so asset URLs work in a subfolder. */
const BASE = import.meta.env.BASE_URL;
// ?state=awaken (dev only) plays in its own slot, so the test save never touches yours.
const TEST_STATE = import.meta.env.DEV ? params.get('state') : null;
// The playtest site and the demo share an origin with the live game (jamesurobertson.github.io), so each saves to its
// own slot.
const PLAYTEST = location.pathname.startsWith('/dev-deepheart/');
// ?sim=300 (dev only): play from where a nonstop player first reaches floor 300, in its own slot. It's built the first
// time (the pacing bot plays it out, a few seconds); &fresh builds it again.
const SIM_FLOOR = import.meta.env.DEV ? Number(params.get('sim')) || 0 : 0;
// ?quick (dev only): its own save, with a Next floor button (or N) that wins the floor
// you're on for everything it'd pay; &fresh starts it over.
const QUICK = import.meta.env.DEV && params.has('quick');
// ?timeaway=100&floor=50 (dev only): your own save comes back from 100 hours away on floor 50 (or the floor you're on;
// never past your deepest), and keeps it: every refresh pays another 100 hours.
const AWAY_HOURS = import.meta.env.DEV ? Number(params.get('timeaway')) || 0 : 0;
const AWAY_FLOOR = Number(params.get('floor') ?? params.get('level')) || 0;
const SLOT = (import.meta.env.DEV ? params.get('slot') : null) ?? (TEST_STATE ? `state-${TEST_STATE}` : null) ?? (SIM_FLOOR ? `sim-${SIM_FLOOR}` : null) ?? (QUICK ? 'quick' : null) ?? (DEMO ? 'demo' : PLAYTEST ? 'playtest' : null);
const SAVE_KEY = 'deepheart-save' + (SLOT ? `:${SLOT}` : '');
// The game opens on its main menu once a visit: a refresh after you've started playing (or the menu's own New Game,
// which wipes the save and reloads) goes straight back in, as do test runs (?slot=, ?state=) and ?menu=0. Closing the
// tab (or the desktop app) and coming back opens the menu again.
const IN_GAME = 'deepheart-in-game';
const inGame = () => {
  try {
    return sessionStorage.getItem(IN_GAME) === '1';
  } catch {
    return false;
  }
};
const SKIP_MENU = (import.meta.env.DEV && (params.get('menu') === '0' || params.has('slot') || !!TEST_STATE || !!SIM_FLOOR || !!AWAY_HOURS)) || QUICK || inGame();
const STEP = 1 / 30;
/** Away (tab hidden or closed) longer than this is paid in one go, with a summary. Shorter is played out frame by frame. */
const OFFLINE_AFTER = 60;
// ?speed=10 runs the sim faster for playtesting (dev build only).
const SPEED = import.meta.env.DEV ? Math.max(1, Number(params.get('speed')) || 1) : 1;
// ?fps shows frame rate and frame cost in a corner (dev build only).
const SHOW_FPS = import.meta.env.DEV && params.has('fps');

function load(): SaveState | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as SaveState | null;
    // A save from an earlier minor version starts over.
    if (s && olderVersion(s.version)) return null;
    return s?.v === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

/** The menu waits for the pixel fonts (at most 2 s), so it never shows in a fallback face first. */
const fontsReady = () => Promise.race([
  Promise.all([document.fonts.load("38px 'Jersey 10'"), document.fonts.load('16px Silkscreen')]),
  new Promise((resolve) => setTimeout(resolve, 2000)),
]);

async function boot() {
  // Black until the menu is drawn: no flash of the room or the HUD first.
  if (!SKIP_MENU) document.body.classList.add('at-menu');
  const atlas = await Atlas.load(`${BASE}assets/sprites/atlas.png`, `${BASE}assets/sprites/atlas.txt`);
  setAtlas(atlas);

  if (import.meta.env.DEV && SIM_FLOOR > 1 && (!load() || params.has('fresh'))) {
    const { playTo } = await import('../scripts/bot.ts');
    const { save, hours } = playTo(SIM_FLOOR);
    // (Now, so the time it took isn't paid out as time away.)
    save.lastSave = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    console.info(`?sim: floor ${save.bestFloor} after ${hours.toFixed(1)} h of nonstop play, ${save.descents} ascents`);
  }
  if (QUICK && params.has('fresh')) {
    localStorage.removeItem(SAVE_KEY);
    params.delete('fresh');
    history.replaceState(null, '', `?${params}`);
  }
  const saved = load();
  const game = new Game(saved ?? newSave());
  const sfx = new Sfx(`${BASE}assets/sfx`, `${BASE}assets/music`);
  const scene = new Scene(document.getElementById('stage')!, atlas);
  let resetting = false;

  /** Auto graphics: high to start, a step down each time frames run long (never back up in a session). */
  let autoQuality: Quality = 'high';
  const applySettings = () => {
    const s = game.s.settings;
    sfx.muted = s.muted;
    sfx.musicOn = s.music;
    sfx.setVolumes(s.sfxVol, s.musicVol);
    scene.settings.particles = s.particles;
    scene.settings.calm = s.calm;
    scene.settings.shake = s.shake;
    scene.settings.blood = s.blood;
    scene.settings.cinematics = s.cinematics;
    scene.setQuality(s.graphics === 'auto' ? autoQuality : s.graphics);
  };
  /** Up while the main menu is: the fight waits, and nothing is saved (time away is settled when you play). */
  let atMenu = !SKIP_MENU;
  let recorder: PlayRecorder | null = null;
  const save = () => {
    if (resetting || atMenu) return;
    try {
      game.s.lastSave = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(game.saveState()));
    } catch { /* storage unavailable: play continues unsaved */ }
  };

  const ui = new Ui(document.getElementById('ui')!, game, scene, {
    sound: (n, o) => sfx.play(n, o),
    save,
    settings: () => {
      applySettings();
      save();
    },
    exportSave: () => {
      save();
      return btoa(unescape(encodeURIComponent(JSON.stringify(game.saveState()))));
    },
    importSave: (text) => {
      try {
        const s = JSON.parse(decodeURIComponent(escape(atob(text)))) as SaveState;
        if (s?.v !== SAVE_VERSION || !Array.isArray(s.owned)) return false;
        resetting = true;
        localStorage.setItem(SAVE_KEY, JSON.stringify(s));
        location.reload();
        return true;
      } catch {
        return false;
      }
    },
    mainMenu: () => {
      save();
      try {
        sessionStorage.removeItem(IN_GAME);
      } catch { /* ignore */ }
      location.reload();
    },
    reset: () => {
      resetting = true;
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch { /* ignore */ }
      location.reload();
    },
  });
  applySettings();
  scene.rebuild(game);
  scene.onArrive = () => ui.arrived();
  // The desktop app says when a newer release is out.
  window.deepheart?.onUpdate((update) => ui.showUpdate(update.version, () => window.deepheart?.downloadUpdate()));
  if (import.meta.env.DEV) {
    // ?cards=often makes cards drop hundreds of times as often, and champion bosses common.
    if (params.get('cards') === 'often') game.debugCards = true;
    // ?goblin=rainbow makes every treasure goblin a rainbow goblin that opens the vault, one every few seconds.
    if (params.get('goblin') === 'rainbow') {
      game.debugRainbow = true;
      game.s.raidTimer = Math.min(game.s.raidTimer, 3);
    }
    // ?deepest=40 stands you on floor 40 as the deepest of this descent, with a party that can beat its boss, so the
    // way down into the next zone plays. Use it with ?slot= to leave your own run alone.
    const deepest = Number(params.get('deepest'));
    if (deepest > 1) {
      const s = game.s;
      Object.assign(s, { maxFloor: deepest, bestFloor: Math.max(s.bestFloor, deepest), bestCleared: Math.max(s.bestCleared, deepest - 1), auto: true });
      s.owned = s.owned.map((n) => Math.max(n, 40 + deepest * 4));
      game.invalidate();
      game.goFloor(deepest);
      scene.rebuild(game);
    }
    if (AWAY_HOURS && AWAY_FLOOR) {
      game.goFloor(Math.min(AWAY_FLOOR, game.s.maxFloor));
      scene.rebuild(game);
    }
    // ?state=lv1000: every companion at level 1000 with every trait, on the deepest floor that party clears in about 20s.
    if (TEST_STATE === 'lv1000') {
      const s = game.s;
      s.owned = s.owned.map(() => 1000);
      s.gold = new Decimal('1e300');
      for (const u of UPGRADES) if (/^m\d+_\d+$/.test(u.id)) game.buyUpg(u.id);
      s.gold = new Decimal(0);
      game.invalidate();
      let f = 1;
      while (floorHp(f + 1).times(10).lt(game.dps().times(20))) f++;
      Object.assign(s, { maxFloor: f, bestFloor: Math.max(s.bestFloor, f), bestCleared: Math.max(s.bestCleared, f - 1), auto: false, revealed: s.owned.length });
      game.goFloor(f);
      scene.rebuild(game);
    }
    // ?state=all: every card in every color (gold too, where there is one) and every Legend at level 25 (or its max),
    // a few ascents in at floor 200. Rebuilt on every load.
    if (TEST_STATE === 'all') {
      const s = game.s;
      s.cards = {};
      for (const c of CARDS) {
        const n = CORRUPTION.map((_, lap) => (c.laps.includes(lap) ? 1 : 0));
        s.cards[c.id] = { n, gold: c.gold ? [...n] : CORRUPTION.map(() => 0), at: Date.now() };
      }
      s.legends = Object.fromEntries(LEGENDS.map((d) => [d.id, Math.min(25, d.maxLv ?? 25)]));
      s.legendOffer = [];
      Object.assign(s, { descents: 5, souls: 5000, maxFloor: 200, bestFloor: Math.max(s.bestFloor, 200), bestCleared: Math.max(s.bestCleared, 199), auto: true });
      s.owned = s.owned.map((n) => Math.max(n, 900));
      game.invalidate();
      game.goFloor(200);
      scene.rebuild(game);
      save();
    }
    // ?state=awaken: deep enough to Awaken for the first time, with a binder full of cards (lots of spares to trade,
    // a few gold, a handful new since you last woke), or none with &cards=0. ?state=reawaken: the same, having awakened once already.
    // Rebuilt on every load, so you can Awaken, reload and do it again.
    if (TEST_STATE === 'awaken' || TEST_STATE === 'reawaken') {
      const s = game.s;
      const again = TEST_STATE === 'reawaken';
      Object.assign(s, { awakens: again ? 1 : 0, boundEarned: again ? 12 : 0, bound: {}, souls: again ? 4000 : 400, soulsLifetime: again ? 400 : 0, tripsOpen: true, expeditions: [], inKeep: false });
      const depth = TUNE.awakenFloor + (again ? 40 : 0);
      Object.assign(s, { maxFloor: depth, bestFloor: Math.max(s.bestFloor, depth), cycleBest: depth, bestCleared: depth - 1, auto: true });
      s.owned = s.owned.map((n) => Math.max(n, 40 + depth * 4));
      s.cards = {};
      let seed = 7;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const c of CARDS.filter((x) => x.kind !== 'goblin' && x.floor <= depth)) {
        if (rand() < 0.3) continue;
        const n = CORRUPTION.map(() => 0);
        const gold = CORRUPTION.map(() => 0);
        // Only colors it can come in: the later laps' newcomers have no plain copy.
        const first = c.laps[0];
        n[first] = 1 + Math.floor(rand() * 6);
        if (first === 0 && c.laps.includes(1) && lapOf(depth) > 0 && rand() < 0.2) n[1] = 1;
        if (c.gold && rand() < 0.08) gold[first] = 1;
        s.cards[c.id] = { n, gold, at: 1000 + Math.floor(rand() * 90000) };
      }
      s.dreamCards = Object.keys(s.cards).filter(() => rand() < 0.12).slice(0, 6).map((id) => `${id}:${s.cards[id].n.findIndex((n) => n > 0)}:0`);
      // &cards=0: awaken with an empty binder, as most first awakenings are (Dan gives you your first).
      if (params.get('cards') === '0') {
        s.cards = {};
        s.dreamCards = [];
      }
      game.invalidate();
      game.goFloor(depth);
      scene.rebuild(game);
      save();
    }
    // step(n, click) advances n frames by hand: handy when the tab is in the background.
    const step = (n: number, click = false) => {
      for (let i = 0; i < n; i++) {
        const f = game.focus();
        const at = f && scene.screenOf(f.id);
        if (click && i % 6 === 0 && f && at) game.click(f.id, at.x, at.y + at.h * 0.4);
        if (!scene.busy) game.update(1 / 60);
        for (const ev of game.events.splice(0)) {
          scene.handle(ev, game);
          ui.handle(ev);
          if (ev.t === 'descend' || ev.t === 'awaken') scene.rebuild(game);
        }
        scene.update(1 / 60, game);
        ui.frame(1 / 60);
        if (i % 6 === 0) ui.update();
      }
    };
    Object.assign(window, { game, scene, ui, sfx, step });
  }
  if (QUICK) {
    const next = (floors: number) => {
      for (let k = 0; k < floors && !scene.busy; k++) game.devClearFloor();
    };
    const button = document.createElement('button');
    button.textContent = 'Next floor ▸ (N)';
    button.title = 'Win this floor for everything it pays. Shift: 10 floors.';
    const look = 'padding:6px 10px;font:14px Silkscreen,monospace;background:#2a1d14;color:#ffd27a;border:2px solid #7a5a2a;border-radius:4px;cursor:pointer';
    button.style.cssText = `position:fixed;left:12px;top:132px;z-index:50;${look}`;
    button.addEventListener('pointerdown', (e) => e.stopPropagation());
    button.addEventListener('click', (e) => next(e.shiftKey ? 10 : 1));
    document.body.appendChild(button);
    const SKIP_HOURS = [1, 2, 3, 8, 24];
    const skip = (hours: number) => {
      if (game.s.inKeep || scene.busy) return;
      const o = game.devSkipTime(hours * 3600);
      flushAway();
      ui.showOffline(o);
      save();
    };
    const skips = document.createElement('div');
    skips.style.cssText = 'position:fixed;left:12px;top:168px;z-index:50;display:flex;gap:4px';
    SKIP_HOURS.forEach((hours, k) => {
      const hourButton = document.createElement('button');
      hourButton.textContent = `+${hours}h`;
      hourButton.title = `Farm this floor for ${hours}h (Cmd+${k + 1})`;
      hourButton.style.cssText = look;
      hourButton.addEventListener('pointerdown', (e) => e.stopPropagation());
      hourButton.addEventListener('click', () => skip(hours));
      skips.appendChild(hourButton);
    });
    document.body.appendChild(skips);
    addEventListener('keydown', (e) => {
      if (e.repeat || (e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key.toLowerCase() === 'n') next(e.shiftKey ? 10 : 1);
      const hours = e.metaKey && SKIP_HOURS[Number(e.code.replace('Digit', '')) - 1];
      if (hours) {
        e.preventDefault();
        skip(hours);
      }
    });
  }

  /** Time away: short breaks play out frame by frame; longer ones are paid in one go and say so. */
  /** Drop what happened while away, except gold being banked: coins still lying on screen have to fly up. */
  const flushAway = () => {
    const banked = game.events.filter((ev) => ev.t === 'bank');
    game.events.length = 0;
    for (const ev of banked) ui.handle(ev);
  };
  const catchUp = (seconds: number) => {
    if (game.demoOver() || atMenu) return;
    // Up in the Keep nothing happens below, however long you're gone.
    if (game.s.inKeep) {
      if (seconds > OFFLINE_AFTER) ui.showKeepAway(seconds);
      return;
    }
    if (seconds <= OFFLINE_AFTER) {
      for (let t = 0; t < seconds && !game.demoOver(); t += 0.2) game.update(0.2);
      flushAway();
      // (The last boss fell while you were away: no stairs to watch, straight to the end.)
      if (game.demoOver()) ui.showDemoEnd();
      return;
    }
    game.bankAllDrops();
    const o = game.applyOffline(seconds);
    flushAway();
    if (o.gold.gt(0)) ui.showOffline(o);
    save();
  };
  // The demo ends on the stairs down from its last boss.
  if (DEMO) {
    scene.endBefore = zoneOf(DEMO_LAST_FLOOR + 1);
    scene.onEnd = () => ui.showDemoEnd();
  }
  /** Into the game: the time away settled, and the demo's end straight away if it's already over. */
  const play = () => {
    atMenu = false;
    try {
      sessionStorage.setItem(IN_GAME, '1');
    } catch { /* storage unavailable: the menu just shows on every load */ }
    lastTick = Date.now();
    if (saved) {
      const gone = (Date.now() - saved.lastSave) / 1000;
      if (gone > 5) catchUp(gone);
    }
    if (AWAY_HOURS) catchUp(AWAY_HOURS * 3600);
    if (game.demoOver()) ui.showDemoEnd();
  };

  // The sim runs on a fixed-step timer; rendering on rAF.
  let freeze = 0;
  /** The scene's slow motion (a clutch kill), applied to the fight as well as the drawing. */
  let timeScale = 1;
  let lastTick = Date.now();
  let acc = 0;
  if (atMenu) {
    await fontsReady();
    const menu = new TitleMenu(document.body, game, !!saved && game.s.kills > 0, {
      play: () => {
        menu.close();
        play();
      },
      newGame: () => {
        resetting = true;
        try {
          localStorage.removeItem(SAVE_KEY);
          sessionStorage.setItem(IN_GAME, '1');
        } catch { /* ignore */ }
        location.reload();
      },
      options: () => ui.openModal('settings'),
      quit: window.deepheart ? () => window.close() : null,
    });
  } else play();
  setInterval(() => {
    const now = Date.now();
    const gap = (now - lastTick) / 1000;
    lastTick = now;
    // Hidden tabs (and the dungeon while you're in the room) are paused; the time is settled when you come back.
    // Expeditions aren't: they run on real time wherever you are.
    if (!document.hidden) game.realtime();
    if (document.hidden || game.s.inKeep) return;
    // A long gap while visible means the computer slept.
    if (gap > OFFLINE_AFTER) return catchUp(gap);
    // The zone interlude pauses the fight (nothing is lost; it just waits). The end of the demo stops it for good.
    if (scene.busy || game.demoOver() || atMenu) return game.passTime(gap);
    acc += gap * SPEED * (freeze > 0 ? 0.1 : 1) * timeScale;
    while (acc >= STEP) {
      game.update(STEP);
      acc -= STEP;
    }
  }, 50);
  setInterval(save, 5000);
  addEventListener('beforeunload', save);
  // The play log (see record.ts): your own sessions on the dev server and in the desktop app, never test runs.
  const recording = (import.meta.env.DEV && !navigator.webdriver && !TEST_STATE && !SIM_FLOOR && !QUICK) || !!window.deepheart?.log;
  recorder = recording
    ? new PlayRecorder(game, SLOT, (text) => {
      if (window.deepheart?.log) window.deepheart.log(text);
      else fetch(`${BASE}__log`, { method: 'POST', body: text, keepalive: true }).catch(() => {});
    })
    : null;
  setInterval(() => {
    if (!atMenu && !document.hidden) recorder?.second();
  }, 1000);
  addEventListener('beforeunload', () => recorder?.flush());
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      save();
    } else if (hiddenAt) {
      recorder?.away((Date.now() - hiddenAt) / 1000);
      catchUp((Date.now() - hiddenAt) / 1000);
      hiddenAt = 0;
      lastTick = Date.now();
    }
  });

  let last = performance.now();
  let slow = 0;
  let loggedError = false;
  // Auto graphics watches FRAME_WINDOW seconds of drawn frames (after the first few, while things load) and steps down
  // if they average under SLOW_FPS.
  const FRAME_WINDOW = 4;
  const SLOW_FPS = 45;
  let watchFrom = performance.now() + 5000;
  let watched = 0;
  let watchedTime = 0;
  const watchFrames = (gap: number) => {
    if (game.s.settings.graphics !== 'auto' || autoQuality === 'low' || performance.now() < watchFrom) return;
    // A long gap is a hidden tab or a one-off hitch, not a slow machine.
    if (gap > 1000) return;
    watched++;
    watchedTime += gap;
    if (watchedTime < FRAME_WINDOW * 1000) return;
    if (watched / (watchedTime / 1000) < SLOW_FPS) {
      autoQuality = autoQuality === 'high' ? 'medium' : 'low';
      applySettings();
      // The new level needs a moment to settle before it's judged.
      watchFrom = performance.now() + 2000;
    }
    watched = 0;
    watchedTime = 0;
  };
  const fpsMeter = SHOW_FPS ? fpsOverlay(() => scene.quality) : null;
  const frame = (t: number) => {
    // Queue the next frame first so one bad frame can't freeze the game.
    requestAnimationFrame(frame);
    // At most 60 a second: a 120 or 144 Hz screen would otherwise draw everything twice as often for nothing.
    if (t - last < 1000 / 60 - 2) return;
    watchFrames(t - last);
    const workFrom = performance.now();
    try {
      draw(t);
    } catch (err) {
      if (!loggedError) console.error(err);
      loggedError = true;
      game.events.length = 0;
    }
    fpsMeter?.(t, performance.now() - workFrom);
  };
  const draw = (t: number) => {
    const dt = Math.max(0, Math.min(0.1, (t - last) / 1000));
    last = t;
    const events = game.events;
    game.events = [];
    for (const ev of events) {
      scene.handle(ev, game);
      ui.handle(ev);
      playSound(sfx, ev);
      recorder?.event(ev);
      if (ev.t === 'descend' || ev.t === 'awaken') scene.rebuild(game);
    }
    // Big impacts briefly slow everything down.
    const stop = scene.takeHitstop();
    if (stop > 0 && game.s.settings.shake) freeze = Math.max(freeze, stop);
    const slowmo = freeze > 0 ? 0.1 : 1;
    freeze = Math.max(0, freeze - dt);
    timeScale = scene.timeScale(dt);
    // Each stage on its own: one that throws mustn't skip the rest (a skipped ui.update would leave the Keep showing
    // the dungeon's HUD).
    const stage = (fn: () => void) => {
      try {
        fn();
      } catch (err) {
        if (!loggedError) console.error(err);
        loggedError = true;
      }
    };
    // Up in the Keep the dungeon is hidden and paused: no need to draw it.
    if (!game.s.inKeep) stage(() => scene.update(dt * slowmo * timeScale, game));
    stage(() => ui.frame(dt));
    slow -= dt;
    if (slow <= 0) {
      slow = 0.1;
      stage(() => ui.update());
    }
    // The Keep and the title screen share their own tune; the awakening plays in silence.
    if (ui.cutscene) sfx.hush();
    else sfx.music(game.s.inKeep || atMenu ? 'keep' : trackFor(game));
  };
  ui.update();
  requestAnimationFrame(frame);
}

/** Each zone has its own track; bosses get the boss themes (the zone boss the bigger one); the Rainbow Vault its own calm one. */
const ZONE_TRACKS: Track[] = ['halls', 'crypts', 'warrens', 'tomb', 'rotting', 'grove', 'demon', 'frozen'];
function trackFor(game: Game): Track {
  if (game.s.buffs.some((b) => b.id === 'vault')) return 'vault';
  if (game.bossFloor()) return game.s.floor % 10 === 0 ? 'boss2' : 'boss';
  return ZONE_TRACKS[zoneOf(game.s.floor) % ZONE_TRACKS.length];
}

/** Map game events to sounds. Volumes are hand-balanced against each other. */
function playSound(sfx: Sfx, ev: GameEvent) {
  switch (ev.t) {
    case 'click':
      if (ev.crit) {
        sfx.vary('crit', { vol: 0.65 });
        sfx.play('mega', { vol: 0.3, rate: 1.4, jitter: 0.05 });
      } else sfx.vary('hit', { vol: 0.4 });
      break;
    case 'kill':
      // Ordinary monsters die quietly: mowing through an easy floor, a sound per kill is just noise.
      if (ev.boss) sfx.play('bosskill', { vol: 0.9, jitter: 0.15 });
      else if (ev.champ) {
        sfx.play('kill', { vol: 0.3, jitter: 0.15 });
        sfx.play('drop3', { vol: 0.7, rate: 1.2 });
      }
      break;
    case 'floor': if (ev.boss) sfx.play('boss', { vol: 0.8 }); break;
    case 'bossWin':
      sfx.play('drop3', { vol: 0.8 });
      if (ev.souls) setTimeout(() => sfx.play('awaken', { vol: 0.45, rate: 1.3 }), 350);
      // A clutch kill: a deep, slowed boom as time drops, then the hit landing as it lets go.
      if (ev.clutch) {
        sfx.play('mega', { vol: 0.9, rate: 0.55 });
        setTimeout(() => sfx.play('bosskill', { vol: 0.9, rate: 0.85 }), 1400);
      }
      break;
    case 'rampage': sfx.play('mega', { vol: 0.6, rate: 1 + ev.tier * 0.2 }); break;
    case 'vault': sfx.play(ev.on ? 'drop4' : 'coins', { vol: 0.8 }); break;
    case 'vaultPick': sfx.play('awaken', { vol: 0.7, rate: 0.8 }); break;
    case 'vaultGoblin': sfx.play('kill', { vol: 0.5, rate: ev.rainbow ? 0.9 : 1.15 }); break;
    case 'chest': sfx.play(ev.rainbow ? 'jackpot' : 'treasure', { vol: ev.rainbow ? 0.9 : 0.6, jitter: ev.rainbow ? 0 : 0.06 }); break;
    // (When the boss's lunge lands.)
    case 'bossFail': setTimeout(() => sfx.play('death', { vol: 0.6 }), FELL_HIT * 1000); break;
    case 'buyComp': sfx.play('coins', { vol: 0.5, jitter: 0.08 }); break;
    case 'reveal': sfx.play('levelup', { vol: 0.5 }); break;
    case 'buyUpg': sfx.play('equip', { vol: 0.55, jitter: 0.05 }); break;
    // A rainbow goblin sounds like any other: it's a surprise.
    case 'raidSpawn': sfx.play('drop1', { vol: 0.7, rate: 1.2 }); break;
    case 'raidCatch':
      sfx.play('kill', { vol: 0.6 });
      sfx.play('chest', { vol: 0.7 });
      setTimeout(() => sfx.play('drop3', { vol: 0.7 }), 550);
      break;
    case 'raidEscape': sfx.play('close', { vol: 0.5, rate: 0.8 }); break;
    case 'fever': if (ev.on) sfx.play('awaken', { vol: 0.8 }); break;
    case 'bound': sfx.play('awaken', { vol: 0.6, rate: 0.8 }); break;
    case 'expedition': sfx.play('jackpot', { vol: 0.5 }); break;
    case 'legend': sfx.play(ev.summoned ? 'awaken' : 'levelup', { vol: ev.summoned ? 0.6 : 0.45, rate: ev.summoned ? 0.7 : 1 }); break;
    case 'mark': sfx.play(ev.moved ? 'equip' : 'jackpot', { vol: 0.5 }); break;
    case 'split': sfx.play('bosskill', { vol: 0.6, rate: 1.3 }); break;
  }
}

boot();
