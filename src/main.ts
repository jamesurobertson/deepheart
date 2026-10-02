import './style.css';
import { Game, newSave, SAVE_VERSION, type GameEvent, type SaveState } from './game/game.ts';
import { Atlas } from './render/atlas.ts';
import { Scene } from './render/scene.ts';
import { Ui } from './ui/ui.ts';
import { setAtlas } from './ui/px.ts';
import { Sfx, type Track } from './audio/sfx.ts';
import { zoneOf } from './game/data.ts';

const params = new URLSearchParams(location.search);
// ?slot=name keeps a separate save (handy for testing without touching your run).
/** Where the site is served from ('./' in builds), so asset URLs work in a subfolder. */
const BASE = import.meta.env.BASE_URL;
const SAVE_KEY = 'deepheart-save' + (params.get('slot') ? `:${params.get('slot')}` : '');
const STEP = 1 / 30;
/** Away (tab hidden or closed) longer than this counts as offline: paid at the offline rate, with a summary. Shorter is played out at full speed. */
const OFFLINE_AFTER = 60;
// ?speed=10 runs the sim faster for playtesting.
const SPEED = Math.max(1, Number(params.get('speed')) || 1);

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
      localStorage.setItem(SAVE_KEY, JSON.stringify(game.s));
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
      return btoa(unescape(encodeURIComponent(JSON.stringify(game.s))));
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
  if (import.meta.env.DEV) {
    // step(n, click) advances n frames by hand: handy when the tab is in the background.
    const step = (n: number, click = false) => {
      for (let i = 0; i < n; i++) {
        const f = game.focus();
        const at = f && scene.screenOf(f.id);
        if (click && i % 6 === 0 && f && at) game.click(f.id, at.x, at.y + at.h * 0.4);
        game.update(1 / 60);
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

  /** Time away: short breaks play out at full speed; longer ones pay the offline rate and say so. */
  const catchUp = (seconds: number) => {
    if (seconds <= OFFLINE_AFTER) {
      for (let t = 0; t < seconds; t += 0.2) game.update(0.2);
      game.events.length = 0;
      return;
    }
    const o = game.applyOffline(seconds);
    game.events.length = 0;
    if (o.gold > 0) ui.showOffline(o);
    save();
  };
  if (saved) {
    const gone = (Date.now() - saved.lastSave) / 1000;
    if (gone > 5) catchUp(gone);
  }

  // The sim runs on a fixed-step timer; rendering on rAF.
  let freeze = 0;
  let lastTick = Date.now();
  let acc = 0;
  setInterval(() => {
    const now = Date.now();
    const gap = (now - lastTick) / 1000;
    lastTick = now;
    // Hidden tabs are paused; the time is settled when you come back.
    if (document.hidden) return;
    // A long gap while visible means the computer slept.
    if (gap > OFFLINE_AFTER) return catchUp(gap);
    // The zone interlude pauses the fight (nothing is lost; it just waits).
    if (scene.busy) return;
    acc += gap * SPEED * (freeze > 0 ? 0.1 : 1);
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
      catchUp((Date.now() - hiddenAt) / 1000);
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
    scene.update(dt * slowmo, game);
    ui.frame(dt);
    slow -= dt;
    if (slow <= 0) {
      slow = 0.1;
      ui.update();
    }
    sfx.music(trackFor(game));
  };
  ui.update();
  requestAnimationFrame(frame);
}

/** Each zone has its own track; bosses get the boss themes (the zone boss the bigger one). */
const ZONE_TRACKS: Track[] = ['halls', 'crypts', 'warrens', 'tomb', 'rotting', 'grove', 'demon', 'frozen'];
function trackFor(game: Game): Track {
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
      // Phantom Blade kills stay quiet: at several a second the thud turns into a drone.
      if (ev.by === 'auto' && !ev.boss && !ev.champ) break;
      sfx.play(ev.boss ? 'bosskill' : 'kill', { vol: ev.boss ? 0.9 : 0.3, jitter: 0.15 });
      if (ev.champ) sfx.play('drop3', { vol: 0.7, rate: 1.2 });
      else if (!ev.boss) sfx.play('coins', { vol: 0.12, rate: 1.3, jitter: 0.2 });
      break;
    case 'floor': if (ev.boss) sfx.play('boss', { vol: 0.8 }); break;
    case 'sweep': sfx.play('kill', { vol: 0.6, rate: 1.3, jitter: 0.1 }); break;
    case 'bossWin':
      sfx.play('drop3', { vol: 0.8 });
      if (ev.clutch) sfx.play('mega', { vol: 0.8, rate: 0.8 });
      break;
    case 'rampage': sfx.play('mega', { vol: 0.6, rate: 1 + ev.tier * 0.2 }); break;
    case 'vault': sfx.play(ev.on ? 'drop4' : 'coins', { vol: 0.8 }); break;
    case 'bossFail': sfx.play('death', { vol: 0.6 }); break;
    case 'buyComp': sfx.play('coins', { vol: 0.5, jitter: 0.08 }); break;
    case 'reveal': sfx.play('levelup', { vol: 0.5 }); break;
    case 'buyUpg': sfx.play('equip', { vol: 0.55, jitter: 0.05 }); break;
    case 'trophy': sfx.play('drop2', { vol: 0.55 }); break;
    case 'raidSpawn': sfx.play(ev.rainbow ? 'awaken' : 'drop1', { vol: 0.7, rate: ev.rainbow ? 1.5 : 1.2 }); break;
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
