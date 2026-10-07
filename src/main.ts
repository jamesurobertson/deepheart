// Fonts ship with the game (no Google Fonts request), so it also works offline and in the desktop build.
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/jersey-10/400.css';
import './style.css';
import { Game, newSave, SAVE_VERSION, type GameEvent, type SaveState } from './game/game.ts';
import { Atlas } from './render/atlas.ts';
import { Scene } from './render/scene.ts';
import { Ui } from './ui/ui.ts';
import { setAtlas } from './ui/px.ts';
import { Sfx, type Track } from './audio/sfx.ts';
import { CARDS, CORRUPTION, lapOf, zoneOf } from './game/data.ts';

declare global {
  interface Window {
    /** Only in the desktop app (see desktop/preload.cjs). */
    deepheart?: { onUpdate(callback: (update: { version: string }) => void): void; downloadUpdate(): void };
  }
}

const params = new URLSearchParams(location.search);
// ?slot=name keeps a separate save (handy for testing without touching your run).
/** Where the site is served from ('./' in builds), so asset URLs work in a subfolder. */
const BASE = import.meta.env.BASE_URL;
// ?state=awaken (dev only) plays in its own slot, so the test save never touches yours.
const TEST_STATE = import.meta.env.DEV ? params.get('state') : null;
const SLOT = params.get('slot') ?? (TEST_STATE ? `state-${TEST_STATE}` : null);
const SAVE_KEY = 'deepheart-save' + (SLOT ? `:${SLOT}` : '');
const STEP = 1 / 30;
/** Away (tab hidden or closed) longer than this counts as offline: paid at the offline rate, with a summary. Shorter is played out at full speed. */
const OFFLINE_AFTER = 60;
// ?speed=10 runs the sim faster for playtesting (dev build only).
const SPEED = import.meta.env.DEV ? Math.max(1, Number(params.get('speed')) || 1) : 1;

function load(): SaveState | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as SaveState | null;
    return s?.v === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

async function boot() {
  const atlas = await Atlas.load(`${BASE}assets/sprites/atlas.png`, `${BASE}assets/sprites/atlas.txt`);
  setAtlas(atlas);

  const saved = load();
  const game = new Game(saved ?? newSave());
  const sfx = new Sfx(`${BASE}assets/sfx`, `${BASE}assets/music`);
  const scene = new Scene(document.getElementById('stage')!, atlas);
  let resetting = false;

  const applySettings = () => {
    const s = game.s.settings;
    sfx.muted = s.muted;
    sfx.musicOn = s.music;
    sfx.setVolumes(s.sfxVol, s.musicVol);
    scene.settings.particles = s.particles;
    scene.settings.shake = s.shake;
    scene.settings.blood = s.blood;
    scene.settings.cinematics = s.cinematics;
  };
  const save = () => {
    if (resetting) return;
    try {
      game.s.lastSave = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(game.saveState()));
    } catch { /* storage unavailable: play continues unsaved */ }
  };

  const ui = new Ui(document.getElementById('ui')!, game, scene, {
    sound: (n, o) => sfx.play(n, o),
    save,
    leftRoom: (away) => {
      // Time in the kid's room counts as time away: the dungeon waits, then catches up when you come back.
      lastTick = Date.now();
      if (away) catchUp(away);
    },
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
    // ?relics=always makes every boss drop a relic.
    if (params.get('relics') === 'always') game.debugRelics = true;
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
    // ?state=awaken: deep enough to Awaken for the first time, with a binder full of cards (lots of spares to trade,
    // a few gold, a handful new since you last woke). ?state=reawaken: the same, having awakened once already.
    // Rebuilt on every load, so you can Awaken, reload and do it again.
    if (TEST_STATE === 'awaken' || TEST_STATE === 'reawaken') {
      const s = game.s;
      const again = TEST_STATE === 'reawaken';
      Object.assign(s, { awakens: again ? 1 : 0, dreamSeen: again, stones: again ? 1 : 0, souls: again ? 2e6 : 5e4, soulsLifetime: again ? 5e5 : 0 });
      const depth = game.awakenFloor();
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
        const first = lapOf(c.floor);
        n[first] = 1 + Math.floor(rand() * 6);
        if (first === 0 && lapOf(depth) > 0 && rand() < 0.2) n[1] = 1;
        if (c.gold && rand() < 0.08) gold[first] = 1;
        s.cards[c.id] = { n, gold, at: 1000 + Math.floor(rand() * 90000) };
      }
      s.dreamCards = Object.keys(s.cards).filter(() => rand() < 0.12).slice(0, 6).map((id) => `${id}:${s.cards[id].n.findIndex((n) => n > 0)}:0`);
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
  // Waking up: ?dream=first plays the whole reveal, ?dream=wake the short one (dev only). Saves that awakened before
  // the reveal existed see it at their next awakening.
  const dream = import.meta.env.DEV ? params.get('dream') : null;
  if (game.s.room) ui.resumeRoom();
  else if (dream) ui.playDream(dream === 'first');

  /** Time away: short breaks play out at full speed; longer ones pay the offline rate and say so. */
  const catchUp = (seconds: number) => {
    if (seconds <= OFFLINE_AFTER) {
      for (let t = 0; t < seconds; t += 0.2) game.update(0.2);
      game.events.length = 0;
      return;
    }
    const o = game.applyOffline(seconds);
    game.events.length = 0;
    if (o.gold.gt(0)) ui.showOffline(o);
    save();
  };
  // Closed in the kid's room: that time is settled on the way back into the dungeon.
  if (saved && !game.s.room) {
    const gone = (Date.now() - saved.lastSave) / 1000;
    if (gone > 5) catchUp(gone);
  }

  // The sim runs on a fixed-step timer; rendering on rAF.
  let freeze = 0;
  /** The scene's slow motion (a clutch kill), applied to the fight as well as the drawing. */
  let timeScale = 1;
  let lastTick = Date.now();
  let acc = 0;
  setInterval(() => {
    const now = Date.now();
    const gap = (now - lastTick) / 1000;
    lastTick = now;
    // Hidden tabs (and the dungeon while you're in the room) are paused; the time is settled when you come back.
    if (document.hidden || game.s.room) return;
    // A long gap while visible means the computer slept.
    if (gap > OFFLINE_AFTER) return catchUp(gap);
    // The zone interlude pauses the fight (nothing is lost; it just waits).
    if (scene.busy) return;
    acc += gap * SPEED * (freeze > 0 ? 0.1 : 1) * timeScale;
    while (acc >= STEP) {
      game.update(STEP);
      acc -= STEP;
    }
  }, 50);
  setInterval(save, 5000);
  addEventListener('beforeunload', save);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      save();
    } else if (hiddenAt) {
      // Hidden while in the room: leaving the room settles that time.
      if (!game.s.room) catchUp((Date.now() - hiddenAt) / 1000);
      hiddenAt = 0;
      lastTick = Date.now();
    }
  });

  let last = performance.now();
  let slow = 0;
  let loggedError = false;
  const frame = (t: number) => {
    // Queue the next frame first so one bad frame can't freeze the game.
    requestAnimationFrame(frame);
    try {
      draw(t);
    } catch (err) {
      if (!loggedError) console.error(err);
      loggedError = true;
      game.events.length = 0;
    }
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
      if (ev.t === 'descend' || ev.t === 'awaken') scene.rebuild(game);
    }
    // Big impacts briefly slow everything down.
    const stop = scene.takeHitstop();
    if (stop > 0 && game.s.settings.shake) freeze = Math.max(freeze, stop);
    const slowmo = freeze > 0 ? 0.1 : 1;
    freeze = Math.max(0, freeze - dt);
    timeScale = scene.timeScale(dt);
    scene.update(dt * slowmo * timeScale, game);
    ui.frame(dt);
    slow -= dt;
    if (slow <= 0) {
      slow = 0.1;
      ui.update();
    }
    // The kid's room has its own tune.
    sfx.music(game.s.room ? 'room' : trackFor(game));
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
      // A clutch kill: a deep, slowed boom as time drops, then the hit landing as it lets go.
      if (ev.clutch) {
        sfx.play('mega', { vol: 0.9, rate: 0.55 });
        setTimeout(() => sfx.play('bosskill', { vol: 0.9, rate: 0.85 }), 900);
      }
      break;
    case 'rampage': sfx.play('mega', { vol: 0.6, rate: 1 + ev.tier * 0.2 }); break;
    case 'vault': sfx.play(ev.on ? 'drop4' : 'coins', { vol: 0.8 }); break;
    case 'vaultPick': sfx.play('awaken', { vol: 0.7, rate: 0.8 }); break;
    case 'vaultGoblin': sfx.play('kill', { vol: 0.5, rate: ev.rainbow ? 0.9 : 1.15 }); break;
    case 'chest': sfx.play(ev.rainbow ? 'jackpot' : 'treasure', { vol: ev.rainbow ? 0.9 : 0.6, jitter: ev.rainbow ? 0 : 0.06 }); break;
    case 'bossFail': sfx.play('death', { vol: 0.6 }); break;
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
    case 'abyss': sfx.play('awaken', { vol: 0.6 }); break;
    case 'heart': sfx.play('awaken', { vol: 0.6, rate: 0.8 }); break;
    case 'split': sfx.play('bosskill', { vol: 0.6, rate: 1.3 }); break;
  }
}

boot();
