import './style.css';
import * as THREE from 'three';
import { Game, chapterOf, newSave, type GameEvent, type SaveState } from './game/sim.ts';
import { Atlas, pixelate } from './render/atlas.ts';
import { World, type IconSheet } from './render/world.ts';
import { Hud } from './ui/hud.ts';
import { setAtlas } from './ui/px.ts';
import { Sfx, type Track } from './audio/sfx.ts';

const params = new URLSearchParams(location.search);
// ?slot=name keeps a separate save (handy for testing without touching your run).
const SAVE_KEY = 'descent-save-v4' + (params.get('slot') ? `:${params.get('slot')}` : '');
const STEP = 1 / 30;
const OFFLINE_THRESHOLD = 30;
// ?speed=10 runs the sim faster for playtesting.
const SPEED = Math.max(1, Number(params.get('speed')) || 1);

function load(): SaveState | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as SaveState | null;
    return s?.v === 4 ? s : null;
  } catch {
    return null;
  }
}

async function boot() {
  const [atlas, ...sheets] = await Promise.all([
    Atlas.load('/assets/sprites/dungeon.png', '/assets/sprites/dungeon.txt'),
    ...['items', 'weapons-bronze', 'weapons-iron', 'weapons-steel', 'weapons-gold'].map(async (name) => {
      const texture = await new THREE.TextureLoader().loadAsync(`/assets/icons/${name}.png`);
      pixelate(texture);
      const img = texture.image as HTMLImageElement;
      return [name, { texture, size: { w: img.width, h: img.height } }] as const;
    }),
  ]);
  setAtlas(atlas);
  const icons = Object.fromEntries(sheets) as Record<string, IconSheet>;

  const saved = load();
  const game = new Game(saved ?? newSave());
  const sfx = new Sfx('/assets/sfx', '/assets/music');
  sfx.muted = game.s.settings.muted;
  sfx.musicOn = game.s.settings.music !== false;
  const applyAudio = () => sfx.setVolumes(game.s.settings.sfxVol ?? 0.8, game.s.settings.musicVol ?? 0.7);
  applyAudio();
  let resetting = false;

  const save = () => {
    if (resetting) return;
    try {
      game.s.lastSave = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(game.s));
    } catch { /* storage unavailable: play continues unsaved */ }
  };

  const world = new World(
    document.getElementById('stage')!, document.getElementById('overlay')!, document.getElementById('fade')!, atlas, icons,
  );
  const hud = new Hud(document.getElementById('ui')!, game, {
    onChange: () => {
      world.setHero(game);
      save();
    },
    onReset: () => {
      resetting = true;
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch { /* ignore */ }
      location.reload();
    },
    onMute: (m) => {
      sfx.muted = m;
      save();
    },
    onHero: () => world.setHero(game),
    onMusic: (on) => {
      sfx.musicOn = on;
      save();
    },
    onSettings: () => {
      applyAudio();
      save();
    },
    exportSave: () => {
      save();
      return btoa(unescape(encodeURIComponent(JSON.stringify(game.s))));
    },
    onImport: (text) => {
      try {
        const s = JSON.parse(decodeURIComponent(escape(atob(text)))) as SaveState;
        if (s?.v !== 4 || !s.equipped) return false;
        resetting = true;
        localStorage.setItem(SAVE_KEY, JSON.stringify(s));
        location.reload();
        return true;
      } catch {
        return false;
      }
    },
    sfx: (n) => sfx.play(n, { vol: 0.6 }),
  });
  world.onLootLanded = (ev, screen) => hud.lootLanded(ev, screen);
  world.setHero(game);
  world.handle({ t: 'map' }, game);
  if (!saved) hud.showClassPicker();
  if (import.meta.env.DEV) Object.assign(window, { game, hud, world });

  const catchUp = (seconds: number) => {
    const summary = game.applyOffline(seconds);
    world.setHero(game);
    // Short gaps (a reload, a quick tab switch) still pay out, just without the popup.
    if (summary.kills > 0 && seconds > 300) hud.showOffline(summary);
    save();
  };
  if (saved) {
    const away = (Date.now() - saved.lastSave) / 1000;
    if (away > OFFLINE_THRESHOLD) catchUp(away);
  }

  // Sim runs on a timer so it keeps going (throttled) in background tabs; rendering on rAF.
  let lastTick = Date.now();
  let acc = 0;
  /** Hit-stop: while > 0 the sim pauses and rendering slows to a crawl, selling big impacts. */
  let freeze = 0;
  let lastStop = 0;
  setInterval(() => {
    const now = Date.now();
    const gap = (now - lastTick) / 1000;
    lastTick = now;
    if (gap > OFFLINE_THRESHOLD) return catchUp(gap);
    if (freeze > 0 && !document.hidden) return;
    acc += gap * SPEED;
    while (acc >= STEP) {
      game.update(STEP);
      acc -= STEP;
    }
    game.checkDay();
    if (document.hidden) game.events.length = 0;
  }, 50);
  setInterval(save, 10_000);
  addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => document.hidden && save());
  bindControls(game);

  let last = performance.now();
  let hudTimer = 0;
  let stepTimer = 0;
  let lastX = game.hero.x;
  let loggedError = false;
  const frame = (t: number) => {
    // Always queue the next frame first, so one bad frame can't freeze the game.
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
    // rAF timestamps can precede performance.now() taken at boot, so clamp at zero.
    const dt = Math.max(0, Math.min(0.1, (t - last) / 1000));
    last = t;
    let gearChanged = false;
    for (const ev of game.events) {
      world.handle(ev, game);
      hud.handle(ev);
      playSound(sfx, ev);
      if (ev.t === 'equip' || ev.t === 'awaken' || ev.t === 'heroLevel' || ev.t === 'rebirth') gearChanged = true;
    }
    game.events.length = 0;
    if (gearChanged) {
      world.setHero(game);
      save();
    }
    // Footsteps while running along a platform.
    stepTimer -= dt;
    const moved = Math.abs(game.hero.x - lastX) > 0.01;
    lastX = game.hero.x;
    if (moved && game.hero.plat >= 0 && stepTimer <= 0) {
      stepTimer = 0.2;
      sfx.vary('step', { vol: 0.3 });
    }
    sfx.music(trackFor(game));
    if (world.hitstop > 0) {
      if (t - lastStop > 250 && game.s.settings.hitstop !== false) {
        freeze = Math.max(freeze, world.hitstop);
        lastStop = t;
      }
      world.hitstop = 0;
    }
    const slow = freeze > 0 ? 0.08 : 1;
    freeze = Math.max(0, freeze - dt);
    world.update(dt * slow, game);
    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.1;
      hud.update();
    }
  };
  hud.update();
  requestAnimationFrame(frame);
}

/** Background music follows what you're doing: bosses get the boss theme. */
function trackFor(game: Game): Track {
  if (game.mode === 'challenge' || game.mode === 'worldboss') return 'boss';
  if (game.mode === 'dungeon') return 'select';
  return chapterOf(game.s.stage) % 2 ? 'stage1' : 'stage2';
}

/** Map game events to sounds. Volumes are hand-balanced against each other. */
function playSound(sfx: Sfx, ev: GameEvent) {
  switch (ev.t) {
    case 'hit':
      if (ev.kind === 'mega') sfx.play('mega', { vol: 0.8, jitter: 0.05 });
      else if (ev.kind === 'crit') sfx.vary('crit', { vol: 0.5 });
      else if (ev.kind === 'normal') sfx.vary('hit', { vol: 0.35 });
      break;
    case 'heroHit': sfx.vary('hurt', { vol: 0.3 }); break;
    case 'kill': sfx.play(ev.boss ? 'bosskill' : 'kill', { vol: ev.boss ? 0.9 : 0.4, jitter: 0.12 }); break;
    case 'drop':
      if (ev.outcome === 'salvaged') break;
      // Rarer drops get their own jingle, Diablo-style.
      sfx.play(ev.item.rarity >= 4 ? 'drop4' : ev.item.rarity === 3 ? 'drop3' : ev.item.rarity === 2 ? 'drop2' : 'drop1', { vol: 0.75 });
      break;
    case 'equip': if (ev.auto) sfx.play('equip', { vol: 0.5 }); break;
    case 'levelUp': sfx.play('levelup', { vol: 0.25, jitter: 0.04 }); break;
    case 'awaken': sfx.play('awaken', { vol: 0.8 }); break;
    case 'boss': sfx.play('boss', { vol: 0.8 }); break;
    case 'down': sfx.play('death', { vol: 0.7 }); break;
    case 'jump': sfx.vary('step', { vol: 0.5, rate: 1.4 }); break;
    case 'skill':
      if (ev.phase === 'land' && ev.radius >= 3) sfx.play('mega', { vol: 0.5, rate: 0.75, jitter: 0.08 });
      else sfx.play('crit0', { vol: 0.5, rate: 1.2, jitter: 0.1 });
      break;
    case 'shot': sfx.play('click', { vol: 0.25, rate: 1.6, jitter: 0.15 }); break;
    case 'boom': sfx.play('hurt1', { vol: 0.35, rate: 0.8, jitter: 0.1 }); break;
    case 'heroLevel': sfx.play(ev.unlocked.length ? 'awaken' : 'levelup', { vol: 0.7 }); break;
    case 'challenge':
      if (ev.phase === 'start') sfx.play('open', { vol: 0.6 });
      if (ev.phase === 'win') sfx.play('drop3', { vol: 0.8 });
      if (ev.phase === 'fail') sfx.play('death', { vol: 0.6 });
      break;
    case 'run':
      if (ev.phase === 'start') sfx.play('descend', { vol: 0.5 });
      else sfx.play(ev.phase === 'win' ? 'drop3' : 'close', { vol: 0.7 });
      break;
    case 'daily': if (ev.what === 'stamp') sfx.play('drop2', { vol: 0.7 }); break;
    case 'massacre': sfx.play('drop2', { vol: 0.6 }); break;
    case 'rebirth': sfx.play('drop4', { vol: 0.8 }); break;
    case 'enemyShot': sfx.play('click', { vol: 0.2, rate: 0.6, jitter: 0.1 }); break;
    case 'telegraph': sfx.play('open', { vol: 0.45, rate: 0.7 }); break;
    case 'slam': sfx.play('mega', { vol: ev.hit ? 0.8 : 0.5, rate: 0.6 }); break;
  }
}

/** Keyboard control: A/D or arrows move, W/Up/Space jump, S/Down drop through a platform. */
function bindControls(game: Game) {
  const held = new Set<string>();
  const sync = () => {
    game.input.move = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  };
  const keys: Record<string, string> = { a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', w: 'jump', arrowup: 'jump', ' ': 'jump', s: 'drop', arrowdown: 'drop' };
  addEventListener('keydown', (e) => {
    const k = keys[e.key.toLowerCase()];
    // Arrow keys belong to the bag grid while it's open.
    if (!k || e.metaKey || e.ctrlKey || e.defaultPrevented || document.querySelector('.bag:not([hidden])')) return;
    e.preventDefault();
    game.idleInput = 0;
    if (k === 'jump') game.input.jump = true;
    else if (k === 'drop') game.input.drop = true;
    else held.add(k);
    sync();
  });
  addEventListener('keyup', (e) => {
    const k = keys[e.key.toLowerCase()];
    if (!k) return;
    held.delete(k);
    sync();
  });
  addEventListener('blur', () => {
    held.clear();
    sync();
  });
  // Holding a direction keeps manual control alive.
  setInterval(() => {
    if (held.size) game.idleInput = 0;
  }, 200);
}

boot();
