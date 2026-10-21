import { COMPS, zoneName } from '../game/data.ts';
import { duration } from '../game/format.ts';
import type { Game } from '../game/game.ts';
import { DEMO, STEAM_URL } from '../demo.ts';
import { G, spriteFrames } from './px.ts';

export interface MenuHooks {
  /** Into the game: the run there is (Continue, Play the Demo), or the fresh one a New Game made. */
  play: () => void;
  /** Throw the run away and start over (after the menu has asked). */
  newGame: () => void;
  options: () => void;
  /** Only the desktop app can close itself. */
  quit: (() => void) | null;
}

/** Every pack the game's art, sound and music come from (all CC0), as the README credits them. */
const CREDITS: { what: string; items: { name: string; by?: string; url: string }[] }[] = [
  {
    what: 'Art',
    items: [
      { name: 'DungeonTileset II and its Sewers add-on', by: '0x72', url: 'https://0x72.itch.io/dungeontileset-ii' },
      { name: 'Enchanted Forest Characters', by: 'Superdark', url: 'https://superdark.itch.io/enchanted-forest-characters' },
      { name: 'Custom Dungeon tileset', by: 'Omniboy', url: 'https://omniboy.itch.io/custom-dungeon-16x16-tileset' },
      { name: '16x16 Dark Dungeon', by: 'Zoltan Kosina', url: 'https://kosinaz.itch.io/16x16-dark-dungeon-tileset' },
      { name: 'DungeonTileset II Extended', by: 'Niji', url: 'https://nijikokun.itch.io/dungeontileset-ii-extended' },
      { name: 'CR+ TileSet', by: 'AnriTool', url: 'https://anritool.itch.io/cr-tileset' },
      { name: 'Pixel Art Spells', by: 'DevWizard', url: 'https://opengameart.org/content/pixel-art-spells' },
    ],
  },
  {
    what: 'Sound',
    items: [{ name: 'Impact, Interface, RPG Audio and Music Jingles', by: 'Kenney', url: 'https://kenney.nl' }],
  },
  {
    what: 'Music',
    items: [
      { name: 'Chiptune Adventures', by: 'Juhani Junkala', url: 'https://opengameart.org/content/4-chiptunes-adventure' },
      { name: '5 Chiptunes (Action)', by: 'Juhani Junkala', url: 'https://opengameart.org/node/55580' },
      { name: 'Spooky Dungeon', by: 'Memoraphile', url: 'https://opengameart.org/content/spooky-dungeon' },
      { name: 'Desert Theme', by: 'Wolfgang_', url: 'https://opengameart.org/node/124080' },
      { name: 'Void Estate', by: 'Zane Little', url: 'https://opengameart.org/content/haunting-chiptune-loop-void-estate' },
      { name: 'Dark Forest Waltz', by: 'The Art Bros', url: 'https://opengameart.org/content/10-track-modern-chiptune-demo' },
      { name: 'Fields of Ice', by: 'Jonathan So', url: 'https://opengameart.org/content/fields-of-ice' },
    ],
  },
];

/** The beating pixel heart, as in the title card. */
const HEART = `<svg class="mm-heart" viewBox="0 0 9 8" width="72" height="64" shape-rendering="crispEdges" aria-hidden="true"><path fill="#140a12" d="M2 0h2v1H2zM5 0h2v1H5zM1 1h1v1H1zM4 1h1v1H4zM7 1h1v1H7zM0 2h1v2H0zM8 2h1v2H8zM1 4h1v1H1zM7 4h1v1H7zM2 5h1v1H2zM6 5h1v1H6zM3 6h1v1H3zM5 6h1v1H5zM4 7h1v1H4z"/><path fill="#e8455f" d="M2 1h2v1H2zM5 1h2v1H5zM1 2h1v2H1zM3 2h5v2H3zM2 4h5v1H2zM3 5h3v1H3zM4 6h1v1H4z"/><path fill="#ffb3c4" d="M2 2h1v1H2z"/></svg>`;
const LOGO = '<h1 class="mm-logo"><span class="mm-ink">DEEPHEART</span><span class="mm-gold">DEEPHEART</span></h1>';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * The main menu the game opens on: the menu down the left and, beside it, the party you've gathered standing on a
 * stairway down into the red (drawn from the dungeon's own tiles). Credits too.
 */
export class TitleMenu {
  private el: HTMLElement;
  private stairs: Stairs;
  /** The menu is laid out for a 600 × 760 px space and scaled to fit the real window (a phone's width included). */
  private fit = () => this.el.style.setProperty('--mm-scale', String(Math.min(1.6, Math.max(0.6, Math.min(innerHeight / 760, innerWidth / 600)))));
  private game: Game;
  private hasRun: boolean;
  private hooks: MenuHooks;
  private view: 'main' | 'credits' | 'confirm' = 'main';
  /** Up and down (or W and S) move through the menu, wrapping round; Enter or Space picks; Escape backs out. While the
   *  stairway has focus (it was clicked), the keys walk your hero there instead. No key reaches the game behind the
   *  menu (Space would attack, U buy an upgrade). */
  private keys = (e: KeyboardEvent) => {
    if (document.querySelector('.modal-wrap:not([hidden])')) return;
    e.stopPropagation();
    const k = e.key.toLowerCase();
    if (document.activeElement === this.stairs.canvas) {
      if (k === 'escape') this.el.querySelector<HTMLElement>('.mm-panel button, .mm-panel a')?.focus();
      else if (this.stairs.control(k, true)) e.preventDefault();
      return;
    }
    const step = k === 'arrowdown' || k === 's' ? 1 : k === 'arrowup' || k === 'w' ? -1 : 0;
    if (step) {
      e.preventDefault();
      const items = [...this.el.querySelectorAll<HTMLElement>('.mm-panel button, .mm-panel a')];
      const at = items.indexOf(document.activeElement as HTMLElement);
      items[at < 0 ? 0 : (at + step + items.length) % items.length]?.focus();
    } else if (k === 'escape' && this.view !== 'main') this.show('main');
  };

  private keysUp = (e: KeyboardEvent) => {
    if (document.querySelector('.modal-wrap:not([hidden])')) return;
    e.stopPropagation();
    this.stairs.control(e.key.toLowerCase(), false);
  };

  constructor(root: HTMLElement, game: Game, hasRun: boolean, hooks: MenuHooks) {
    this.game = game;
    this.hasRun = hasRun;
    this.hooks = hooks;
    this.el = document.createElement('div');
    this.el.className = 'title-menu';
    root.appendChild(this.el);
    document.body.classList.add('at-menu');
    const canvas = document.createElement('canvas');
    canvas.className = 'mm-stairs';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'The stairway: arrow keys or WASD to walk and jump, Space to jump, Escape to go back to the menu');
    this.el.appendChild(canvas);
    const hint = document.createElement('p');
    hint.className = 'mm-stairs-hint';
    hint.textContent = 'Walk ← →  ·  Jump ↑ or Space  ·  Menu Esc';
    this.el.appendChild(hint);
    this.stairs = new Stairs(canvas, game);
    const panel = document.createElement('div');
    panel.className = 'mm-panel';
    this.el.appendChild(panel);
    this.el.addEventListener('click', (e) => this.act((e.target as HTMLElement).closest<HTMLElement>('[data-mm]')?.dataset.mm));
    // The game behind the menu takes a press on the battlefield as an attack: none of the menu's get through.
    for (const ev of ['pointerdown', 'pointerup', 'mousedown']) this.el.addEventListener(ev, (e) => e.stopPropagation());
    this.fit();
    addEventListener('resize', this.fit);
    // (Capturing, so the menu sees keys before the game's own listeners do.)
    addEventListener('keydown', this.keys, true);
    addEventListener('keyup', this.keysUp, true);
    this.show('main');
  }

  close() {
    this.stairs.stop();
    removeEventListener('resize', this.fit);
    removeEventListener('keydown', this.keys, true);
    removeEventListener('keyup', this.keysUp, true);
    this.el.remove();
    document.body.classList.remove('at-menu');
  }

  private act(what: string | undefined) {
    if (what === 'play') this.hooks.play();
    else if (what === 'new') this.hasRun ? this.show('confirm') : this.hooks.play();
    else if (what === 'restart') this.hooks.newGame();
    else if (what === 'options') this.hooks.options();
    else if (what === 'quit') this.hooks.quit?.();
    else if (what === 'credits' || what === 'main' || what === 'confirm') this.show(what);
  }

  private show(view: 'main' | 'credits' | 'confirm') {
    this.view = view;
    const panel = this.el.querySelector<HTMLElement>('.mm-panel')!;
    panel.innerHTML = view === 'credits' ? this.credits() : view === 'confirm' ? this.confirm() : this.mainMenu();
    panel.querySelector<HTMLElement>(view === 'credits' ? '[data-mm="main"]' : 'button, a')?.focus({ preventScroll: true });
  }

  /** The demo's is the same, with a DEMO stamp on the logo and Wishlist on Steam as the button that stands out. */
  private mainMenu() {
    const s = this.game.s;
    const run = this.hasRun ? `<p class="mm-run">Floor ${s.floor} · ${esc(zoneName(s.floor))} · ${duration(s.playTime)}</p>` : '';
    const logo = DEMO ? `<div class="mm-stamped">${LOGO}<span class="mm-stamp">DEMO</span></div>` : LOGO;
    const play = this.hasRun ? 'Continue' : DEMO ? 'Play the Demo' : 'New Game';
    return `<div class="mm-head">${HEART}${logo}<p class="mm-tag">AN IDLE DUNGEON CRAWLER</p></div>
      ${DEMO ? `<a class="mm-btn steam" href="${STEAM_URL}" target="_blank" rel="noopener">${G.steam(26)}Wishlist on Steam</a>` : ''}
      <nav class="mm-list">
        <button type="button" data-mm="${this.hasRun || DEMO ? 'play' : 'new'}"><span>▸</span>${play}</button>${run}
        ${this.hasRun ? '<button type="button" data-mm="new"><span>▸</span>New Game</button>' : ''}
        <button type="button" data-mm="options"><span>▸</span>Options</button>
        <button type="button" data-mm="credits"><span>▸</span>Credits</button>
        ${this.hooks.quit ? '<button type="button" data-mm="quit"><span>▸</span>Quit</button>' : ''}
      </nav>`;
  }

  private confirm() {
    return `<div class="mm-head">${HEART}${LOGO}</div>
      <div class="mm-confirm">
        <p>Start a new game? Your run (floor ${this.game.s.floor}, ${duration(this.game.s.playTime)}) will be lost.</p>
        <div class="mm-row">
          <button type="button" class="mm-btn danger" data-mm="restart">Start over</button>
          <button type="button" class="mm-btn" data-mm="main">Keep my run</button>
        </div>
      </div>`;
  }

  private credits() {
    const sections = CREDITS.map((c) => `<section><h3>${c.what}</h3><ul>${c.items.map((i) =>
      `<li><a href="${i.url}" target="_blank" rel="noopener">${esc(i.name)}</a>${i.by ? ` <span>by ${esc(i.by)}</span>` : ''}</li>`).join('')}</ul></section>`).join('');
    return `<div class="mm-credits">
        <h2>Credits</h2>
        <p class="mm-by">Deepheart by James Robertson. All art, sound and music are CC0: thank you to everyone who made them free.</p>
        ${sections}
        <button type="button" class="mm-btn" data-mm="main">Back</button>
      </div>`;
  }
}

/** The stairway beside the full game's menu: a wall of dungeon bricks, steps going down to the right into a red glow,
 *  torches, and your party standing on the steps in pairs. */
class Stairs {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private t = 0;
  private last = 0;
  private party: { frames: ReturnType<typeof spriteFrames>; run: ReturnType<typeof spriteFrames>; phase: number }[];
  /** Your hero (the party's leader) can be walked about the stairs: to where you click, or with the keys (and made to
   *  jump). Where they stand (sprite pixels: left edge, feet), how fast they're rising or falling, the way they
   *  face, the keys held, and where a click is taking them. Null until you first move them (they stand in the line). */
  private hero: { x: number; y: number; vy: number } | null = null;
  private toX: number | null = null;
  private held = new Set<'left' | 'right' | 'down'>();
  private jumpAsked = false;
  private facing = 1;
  private dt = 0;
  /** The scale, the stairway's span and the canvas's height, from the last frame (a click lands on the steps; the
   *  keys can walk you off the top of the landing). */
  private geo: { S: number; minX: number; maxX: number; H: number } | null = null;

  constructor(canvas: HTMLCanvasElement, game: Game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    // The party you've gathered, your hero leading; a new game has only the Squire, who joins first.
    const owned = COMPS.map((_, i) => i).filter((i) => game.s.owned[i] > 0);
    const hero = game.heroIndex();
    const order = owned.length ? [...owned.filter((i) => i === hero), ...owned.filter((i) => i !== hero)] : [0];
    this.party = order.map((i) => ({ frames: spriteFrames(COMPS[i].sprite), run: spriteFrames(`${COMPS[i].sprite}_run`), phase: Math.random() }));
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.geo) return;
      e.preventDefault();
      canvas.focus({ preventScroll: true });
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) * (devicePixelRatio || 1)) / this.geo.S - 8;
      this.toX = Math.min(this.geo.maxX, Math.max(this.geo.minX, x));
    });
    canvas.addEventListener('blur', () => this.held.clear());
    this.frame(performance.now());
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  /** A key down or up while the stairway has focus; true if it's one of the walking keys. */
  control(key: string, down: boolean) {
    const dir = key === 'arrowleft' || key === 'a' ? 'left' : key === 'arrowright' || key === 'd' ? 'right' : key === 'arrowdown' || key === 's' ? 'down' : null;
    if (dir) {
      if (down) {
        this.held.add(dir);
        if (dir !== 'down') this.toX = null;
      } else this.held.delete(dir);
      return true;
    }
    if (key === ' ' || key === 'arrowup' || key === 'w') {
      if (down) this.jumpAsked = true;
      return true;
    }
    return false;
  }

  private frame = (now: number) => {
    this.dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.t += this.dt;
    this.last = now;
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw() {
    const c = this.canvas;
    const dpr = devicePixelRatio || 1;
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const tiles = spriteFrames('wall_mid');
    const floor = spriteFrames('floor_1');
    if (!tiles || !floor) return;
    // Drawn in sprite pixels at a whole-number scale, so the tiles stay crisp. A portrait screen (a phone) has the menu
    // on top and the stairway below it, scaled to the width.
    const portrait = h > w;
    const S = Math.max(2, portrait ? Math.round(w / 170) : Math.floor(h / 270));
    const W = Math.ceil(w / S);
    const H = Math.ceil(h / S);
    const g = this.ctx;
    g.setTransform(S, 0, 0, S, 0, 0);
    g.imageSmoothingEnabled = false;

    const tile = (src: NonNullable<ReturnType<typeof spriteFrames>>, x: number, y: number, crop = 16) => {
      const f = src.frames[0];
      g.drawImage(src.img, f.x, f.y, f.w, Math.min(f.h, crop), x, y, f.w, Math.min(f.h, crop));
    };

    // The back wall, in shadow.
    for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) tile(tiles, x, y);
    g.fillStyle = 'rgba(10, 5, 6, 0.62)';
    g.fillRect(0, 0, W, H);

    // The stairway: a landing on the left, then steps down to the bottom right corner.
    // (Torches and their light sit high enough to clear the tallest heroes on the landing.)
    // A long flight, whatever the party: even a full roster leaves empty steps below it.
    const run = 30;
    const rise = 12;
    const landX = Math.round(W * (portrait ? 0.08 : 0.45));
    const landY = Math.round(H * (portrait ? 0.68 : 0.42));
    const steps = Math.ceil((W - landX) / run) + 1;
    const stepX = (k: number) => landX + 36 + (k - 1) * run;
    const stepY = (k: number) => landY + k * rise;
    /** Which step a sprite standing at `x` (its left edge) has its feet on. */
    const stepAt = (x: number) => (x + 8 < landX + 36 ? 0 : Math.floor((x + 8 - landX - 36) / run) + 1);
    this.geo = { S, minX: landX, maxX: W - 20, H };
    for (let k = 0; k < steps; k++) {
      const x = k === 0 ? landX : stepX(k);
      const y = stepY(k);
      for (let yy = y; yy < H; yy += 16) for (let xx = x; xx < W; xx += 16) tile(tiles, xx, yy);
      for (let xx = x; xx < W; xx += 16) tile(floor, xx, y, 5);
      g.fillStyle = `rgba(8, 3, 4, ${Math.min(0.82, 0.12 + k * 0.07)})`;
      g.fillRect(x, y + 5, W - x, H - y);
      // The lit lip of each step.
      g.fillStyle = `rgba(255, 210, 160, ${Math.max(0.05, 0.32 - k * 0.025)})`;
      g.fillRect(x, y, W - x, 1);
      // The step above's shadow down this one's face.
      g.fillStyle = 'rgba(0, 0, 0, 0.5)';
      g.fillRect(x, y + 5, 2, rise - 5);
    }

    // Down at the bottom, the red.
    const glow = g.createRadialGradient(W, H, 0, W, H, Math.max(W, H) * 0.65);
    const pulse = 0.5 + 0.08 * Math.sin(this.t * 2.2);
    glow.addColorStop(0, `rgba(255, 70, 45, ${pulse})`);
    glow.addColorStop(0.45, 'rgba(140, 20, 20, 0.22)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';

    // Torches on the wall above the landing (the sheet's one flame is the sewers' green: warmed to torchlight).
    const flame = spriteFrames('sewer_flame');
    if (flame) {
      // (Over the landing and the first steps: further left they'd sit behind the logo on narrower screens.)
      for (const tx of [landX + 30, landX + 112]) {
        const f = flame.frames[Math.floor(this.t * 8 + tx) % flame.frames.length];
        const light = g.createRadialGradient(tx + 8, landY - 50, 0, tx + 8, landY - 50, 46);
        light.addColorStop(0, 'rgba(255, 170, 80, 0.35)');
        light.addColorStop(1, 'rgba(255, 120, 40, 0)');
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = light;
        g.fillRect(tx - 40, landY - 96, 96, 96);
        g.globalCompositeOperation = 'source-over';
        g.filter = 'grayscale(1) sepia(1) saturate(5) hue-rotate(-18deg) brightness(1.2)';
        g.drawImage(flame.img, f.x, f.y, f.w, f.h, tx, landY - 64, f.w, f.h);
        g.filter = 'none';
      }
    }

    // The party on the steps, four to a step (the whole roster fits on screen), the leader lowest; each idles on its
    // own beat. Shadows go down first (one on a step above would otherwise cross the face of someone below), then the
    // heroes from the top step down, so the lower ones stand in front.
    const placed = this.party.flatMap((p, i) => {
      if (!p.frames) return [];
      const k = Math.floor((this.party.length - 1 - i) / 4);
      const side = (this.party.length - 1 - i) % 4;
      const x = (k === 0 ? landX + 6 : stepX(k)) + side * 6;
      if (i === 0 && (this.hero || this.toX !== null || this.held.size || this.jumpAsked)) return this.leader(p, x, landX, stepAt, stepY);
      const f = p.frames.frames[Math.floor((this.t + p.phase) * 6) % p.frames.frames.length];
      return [{ img: p.frames.img, f, k, x, feet: stepY(k), flip: false, shadow: true }];
    });
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (const h of placed) if (h.shadow) g.fillRect(h.x + 2, stepY(h.k), h.f.w - 4, 2);
    for (const h of [...placed].sort((a, b) => a.k - b.k)) {
      const y = h.feet + 1 - h.f.h;
      if (!h.flip) g.drawImage(h.img, h.f.x, h.f.y, h.f.w, h.f.h, h.x, y, h.f.w, h.f.h);
      else {
        g.save();
        g.translate(h.x + h.f.w, 0);
        g.scale(-1, 1);
        g.drawImage(h.img, h.f.x, h.f.y, h.f.w, h.f.h, 0, y, h.f.w, h.f.h);
        g.restore();
      }
    }
  }

  /** Your hero, free on the stairs: walking (keys held, or on the way to a click), stepping up and down the steps,
   *  jumping and falling back to them. Walk off the top of the landing and they fall into the dark, and the next in
   *  line takes over (until nobody's left: they're back next time the menu opens). */
  private leader(p: (typeof this.party)[number], from: number, landX: number, stepAt: (x: number) => number, stepY: (k: number) => number) {
    if (!p.frames) return [];
    const geo = this.geo!;
    const ground = (x: number) => (x + 8 < landX ? Infinity : stepY(stepAt(x)));
    const h = (this.hero ??= { x: from, y: stepY(stepAt(from)), vy: 0 });
    const dt = this.dt;
    let dir = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    if (!dir && this.toX !== null) {
      const gap = this.toX - h.x;
      if (Math.abs(gap) > 0.5) dir = Math.sign(gap);
      else this.toX = null;
    }
    if (dir) {
      this.facing = dir;
      const step = 72 * dt;
      const to = this.toX !== null && !this.held.size ? Math.min(Math.abs(this.toX - h.x), step) : step;
      h.x = Math.min(geo.maxX, Math.max(-24, h.x + dir * to));
    }
    const onGround = h.vy === 0 && h.y >= ground(h.x) - 0.5;
    // A step up is walked straight onto; a step down, a jump's way back, or the drop off the landing is fallen.
    if (onGround && ground(h.x) < h.y) h.y = ground(h.x);
    if (this.jumpAsked && h.vy === 0 && h.y >= ground(h.x) - 0.5) h.vy = -190;
    this.jumpAsked = false;
    if (h.vy !== 0 || h.y < ground(h.x)) {
      h.vy += (this.held.has('down') ? 1600 : 700) * dt;
      h.y += h.vy * dt;
      if (h.y >= ground(h.x) && h.vy > 0) {
        h.y = ground(h.x);
        h.vy = 0;
      }
    }
    if (h.y > geo.H + 40) {
      this.party.shift();
      this.hero = null;
      this.toX = null;
      this.held.clear();
      return [];
    }
    const airborne = h.vy !== 0;
    const anim = (dir || airborne) && p.run ? p.run : p.frames;
    const f = airborne ? anim.frames[2 % anim.frames.length] : anim.frames[Math.floor(this.t * (dir ? 10 : 6)) % anim.frames.length];
    return [{ img: anim.img, f, k: stepAt(h.x), x: Math.round(h.x), feet: Math.round(h.y), flip: this.facing < 0, shadow: !airborne }];
  }
}
