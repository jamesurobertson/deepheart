import { ABYSS, AWAKEN_FLOOR, COMPS, CURSORS, HEART, HEART_BY_ID, MODS, MOD_BY_ID, NEWS, RARITY, RELICS, RELIC_BY_ID, ROMAN, TROPHIES, UPG_BY_ID, corruptionOf, lapOf, relicStars, relicText, zoneName, zoneOf, type Icon, type ModId, type UpgDef } from '../game/data.ts';
import Decimal from 'break_infinity.js';
import { duration, fmt, setNotation } from '../game/format.ts';
import { DESCEND_FLOOR, FLOOR_KILLS, type Buff, type Game, type GameEvent, type OfflineSummary } from '../game/game.ts';
import type { Scene } from '../render/scene.ts';
import type { SfxName } from '../audio/sfx.ts';
import { G, charFit, sprite, spriteFit } from './px.ts';

export interface UiHooks {
  sound: (name: SfxName, o?: { vol?: number; rate?: number; jitter?: number }) => void;
  save: () => void;
  settings: () => void;
  exportSave: () => string;
  importSave: (text: string) => boolean;
  reset: () => void;
}

const TIER_COLORS = ['#b8a58a', '#7ddb6a', '#5fa8ff', '#c77dff', '#f2c14e', '#ff8a3d', '#ec5a4f', '#ff5ac8', '#9cf0ff', '#ffffff', '#ffe08a'];
const REWARD_TEXT: Record<string, string> = { plunder: 'Treasure!', bloodlust: 'Bloodlust!', heartstorm: 'Frenzy!', horde: 'Gold Rush!', soulstorm: 'Soul Storm!', vault: 'Goblin Vault!', rainbow: 'Rainbow Haul!' };
const MAX_POPS = 90;
const RARITY_COLORS = ['#c9b8a0', '#5fa8ff', '#c77dff', '#ffb13d'];

/** Little coloured labels for boss modifiers. */
const modChips = (mods: ModId[]) => mods.map((id) => `<em class="mod" style="--mc:${MOD_BY_ID.get(id)!.color}">${MOD_BY_ID.get(id)!.name}</em>`).join('');
const MAX_COINS = 24;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function icon(i: Icon, box = 36): string {
  const tier = i.tier !== undefined ? `<b class="tier" style="--tc:${TIER_COLORS[i.tier]}">${ROMAN[i.tier]}</b>` : '';
  const sub = i.sub ? `<span class="sub">${spriteFit(i.sub, 18)}</span>` : '';
  return `<span class="ico">${spriteFit(i.sprite, box)}${sub}${tier}</span>`;
}

const gold = (n: number | Decimal, cls = '') => `<span class="gold ${cls}">${sprite('coin', 2)}${fmt(n)}</span>`;

/** What it takes to meet a companion who hasn't joined yet. */
const meetText = (def: { depth: number; heart?: number }, descents: number) =>
  descents < def.depth ? `Descend ${def.depth}× to meet them` : `Awaken the Heart ${def.heart}× to meet them`;

/** A relic's stars, as little gold glyphs after its name. */
/** A small rate with up to two decimals (1.15, not 1.1); big ones as usual. */
const perSec = (n: number) => (n < 100 ? String(Math.round(n * 100) / 100) : fmt(n));
const starsOf = (lv: number) => (relicStars(lv) ? ` <span class="stars">${'★'.repeat(relicStars(lv))}</span>` : '');

function buffText(b: Buff) {
  if (b.id === 'vault') return 'hoarders everywhere';
  if (b.dps > 1 && b.click > 1) return `×${b.dps} damage`;
  if (b.dps > 1) return `×${b.dps} companion damage`;
  if (b.click > 1) return `×${b.click} click damage`;
  return `×${b.gold} gold`;
}

/**
 * All the DOM: counters, floor tracker, shop, numbers, health bars, toasts and panels.
 * Per-frame bits (numbers, bars, counter) update in `frame`; the shop ~10×/s in `update`.
 */
export class Ui {
  private root: HTMLElement;
  private game: Game;
  private scene: Scene;
  private hooks: UiHooks;
  private el: Record<string, HTMLElement> = {};
  private rows: HTMLElement[] = [];
  private rowCache: string[] = [];
  private upgKey = '';
  private tipKey: string | null = null;
  private tipAnchor: HTMLElement | null = null;
  private pops: HTMLElement[] = [];
  private coins = 0;
  private bars = new Map<number, HTMLElement>();
  /** Gold on the counter, easing toward the real bank. */
  private shown = new Decimal(0);
  private newsT = 0;
  private newsIdx = -1;
  private modal: string | null = null;
  private resetArmed = false;
  private hintState = '';
  /** When the current hint appeared (the hero tips time out). */
  private tourAt = 0;
  /** When a clutch kill's slow motion ends (relic cards wait for it). */
  private cinemaUntil = 0;
  /** Where the mouse is over the battlefield (null when it's off it), and whether Space is held down to attack. */
  private pointer: { x: number; y: number } | null = null;
  /** Where your hero is headed: the last spot the mouse pointed at on the battlefield, or where a finger is held
   *  down (null: let them roam). */
  private heroAim: { x: number; y: number } | null = null;
  private fingerDown = false;
  /** The battlefield's share of the window (left of the party panel / above the phone sheet). */
  private field = { w: innerWidth, h: innerHeight };
  /** Arrow keys / WASD held down, for steering your hero. */
  private keys = new Set<'up' | 'down' | 'left' | 'right'>();
  /** After steering with the keys the hero ignores the mouse until it moves again (and stays put a moment first). */
  private mouseStale = false;
  private keyedAt = 0;
  private spaceHeld = false;
  private descending = false;
  private modalKey = '';
  private bannerTimer = 0;
  private bannerQueued = 0;
  private bannerAt = 0;
  private floorKey = '';
  private bladeSprite = '';
  /** Touch screens: long-press shows a tooltip instead of hover. */
  private touch = matchMedia('(pointer: coarse)').matches;
  private pressTimer = 0;
  private pressed = false;
  private pressAt = { x: 0, y: 0 };
  private hudTop = 0;
  private pendingZone = 0;
  private strip = false;
  /** Relics found since the relic screen was last opened. */
  private newRelics = 0;
  private lootTimer = 0;
  private toldAwaken = false;

  constructor(root: HTMLElement, game: Game, scene: Scene, hooks: UiHooks) {
    this.root = root;
    this.game = game;
    this.scene = scene;
    this.hooks = hooks;
    root.innerHTML = `
      <div class="hud-top">
        <div class="bank"><span class="bank-ico">${sprite('coin', 5)}</span><b class="bank-v">0</b></div>
        <div class="rate"><span><b class="dps-v">0</b> <i class="long">damage/sec</i><i class="short">dps</i></span><span class="sep">·</span><span><b class="click-v">1</b> <i class="long">per click</i><i class="short">/click</i></span></div>
        <div class="floor pnl">
          <button class="btn icon sm" data-act="floorDown" aria-label="Previous floor">${G.left()}</button>
          <div class="floor-mid">
            <div class="floor-name" data-tip="floor"><b class="floor-n">Floor 1</b><span class="floor-sub"></span></div>
            <div class="floor-bar"><i></i><span></span></div>
          </div>
          <button class="btn icon sm" data-act="floorUp" aria-label="Next floor">${G.right()}</button>
          <button class="btn small auto" data-act="auto" data-tip="auto">Auto</button>
        </div>
        <div class="fever" data-tip="fever"><i></i><span>Rampage</span></div>
        <div class="buffs"></div>
      </div>
      <div class="bars"></div>
      <div class="hint" hidden></div>
      <div class="hero-mark" hidden>▼</div>
      <div class="raid-mark" hidden><b>!</b></div>
      <div class="letterbox" aria-hidden="true"></div>
      <div class="banner" hidden><b></b><span></span></div>
      <div class="loot" hidden></div>
      <div class="ticker"><span></span></div>
      <nav class="dock">
        <button class="btn dock-b" data-open="trophies" data-tip="dock:trophies">${G.trophy()}<span>Trophies</span></button>
        <button class="btn dock-b" data-open="relics" data-tip="dock:relics">${G.relic()}<span>Relics</span><em class="badge new" hidden></em></button>
        <button class="btn dock-b" data-open="abyss" data-tip="dock:abyss">${G.abyss()}<span>Descend</span><em class="badge" hidden></em></button>
        <button class="btn dock-b" data-open="stats" data-tip="dock:stats">${G.stats()}<span>Stats</span></button>
        <button class="btn dock-b dock-stat blade-rate" data-tip="dock:blade" tabindex="-1">${spriteFit('weapon_knife', 20, 'glyph')}<span>1/s</span></button>
        <button class="btn dock-b" data-open="settings" data-tip="dock:settings">${G.menu()}<span>Options</span></button>
        <button class="btn icon mute" data-act="mute" data-tip="dock:mute"></button>
      </nav>
      <aside class="shop">
        <header class="shop-head"><h2>Your Party</h2><span class="shop-sub"></span><span class="sheet-grip" aria-hidden="true"></span></header>
        <section class="upgs">
          <div class="upgs-head"><h3>Upgrades</h3><button class="btn small buy-all" data-act="buyAll" hidden>Buy all</button></div>
          <div class="upg-grid"></div>
          <p class="upgs-empty">Upgrades appear as you go deeper.</p>
        </section>
        <div class="modes">
          <span>Hire</span>
          <button class="btn mode" data-mode="1">×1</button><button class="btn mode" data-mode="10">×10</button><button class="btn mode" data-mode="100">×100</button><button class="btn mode" data-mode="-1">Max</button>
        </div>
        <div class="gens"></div>
      </aside>
      <div class="toasts"></div>
      <div class="pops"></div>
      <div class="tip pnl" hidden></div>
      <div class="modal-wrap" hidden><div class="modal pnl"></div></div>
      <div class="curtain" hidden><b></b><span></span></div>
      <div class="blade" hidden><div class="blade-in"></div></div>
    `;
    const q = (sel: string) => root.querySelector(sel) as HTMLElement;
    this.el = {
      bank: q('.bank-v'), bankIco: q('.bank-ico'), dps: q('.dps-v'), click: q('.click-v'), rate: q('.rate'),
      floorN: q('.floor-n'), floorSub: q('.floor-sub'), floorBar: q('.floor-bar i'), floorBarT: q('.floor-bar span'), floorBox: q('.floor'),
      down: q('[data-act=floorDown]'), up: q('[data-act=floorUp]'), auto: q('[data-act=auto]'),
      fever: q('.fever'), feverBar: q('.fever i'), feverLabel: q('.fever span'), buffs: q('.buffs'), bars: q('.bars'), hint: q('.hint'), heroMark: q('.hero-mark'), raid: q('.raid-mark'),
      banner: q('.banner'), ticker: q('.ticker span'), shop: q('.shop'), shopSub: q('.shop-sub'), upgGrid: q('.upg-grid'),
      upgEmpty: q('.upgs-empty'), buyAll: q('.buy-all'), gens: q('.gens'), toasts: q('.toasts'), pops: q('.pops'), tip: q('.tip'),
      blade: q('.blade'), bladeIn: q('.blade-in'), modalWrap: q('.modal-wrap'), modal: q('.modal'), curtain: q('.curtain'), mute: q('.mute'), abyssBadge: q('[data-open=abyss] .badge'),
      relicBadge: q('[data-open=relics] .badge'), loot: q('.loot'), bladeRate: q('.blade-rate'), dock: q('.dock'),
    };

    COMPS.forEach((c, i) => {
      const row = document.createElement('button');
      row.className = 'gen';
      row.dataset.comp = String(i);
      row.dataset.tip = `comp:${i}`;
      row.innerHTML = `
        <span class="gen-ico">${charFit(c.sprite, 40)}</span>
        <span class="gen-mid"><b class="gen-name"></b><span class="gen-cost"></span></span>
        <span class="gen-right"><b class="gen-lv"></b><small class="gen-dps"></small></span>
        <span class="gen-hero" data-hero="${i}" data-tip="hero:${i}">★</span>`;
      this.el.gens.appendChild(row);
      this.rows.push(row);
      this.rowCache.push('');
    });

    this.bind();
    this.bindSheet();
    this.syncMode();
    this.syncMute();
    this.layout();
    addEventListener('resize', () => this.layout());
    setNotation(game.s.settings.notation);
    this.nextNews();
  }

  // ---------- layout ----------

  /**
   * Three shapes: desktop (party panel on the right, roomy HUD), landscape phone (narrow
   * panel, compact HUD) and portrait phone (compact HUD, party in a bottom sheet you can
   * collapse). The camera then frames the fight in whatever space is left.
   */
  private layout() {
    const w = innerWidth;
    const h = innerHeight;
    const sheet = w < 760 && h > w;
    const compact = sheet || h < 560 || w < 900;
    const body = document.body.classList;
    body.toggle('phone', sheet);
    body.toggle('compact', compact);
    const shop = this.el.shop.getBoundingClientRect();
    const freeW = sheet ? w : shop.left;
    const freeH = sheet ? shop.top : h;
    this.field = { w: freeW, h: freeH };
    this.root.style.setProperty('--free-w', `${freeW}px`);
    this.root.style.setProperty('--free-h', `${freeH}px`);
    // The news ticker starts where the dock ends (the dock grows as features are added).
    const dock = this.root.querySelector('.dock')!.getBoundingClientRect();
    this.root.style.setProperty('--dock-r', `${Math.round(dock.right + 20)}px`);
    // Frame the fight below the HUD (the floor bar is the last part that always shows).
    const hud = (compact ? this.el.fever.hidden ? this.el.floorBox : this.el.fever : this.el.floorBox).getBoundingClientRect();
    this.hudTop = compact ? Math.round(hud.bottom + 4) : 0;
    this.scene.setViewport(sheet ? 0 : w - shop.left, sheet ? h - shop.top : 0, this.hudTop);
  }

  /** Portrait sheet: folded (header only), half (default) or full height. */
  private setSheet(state: 'min' | 'half' | 'full') {
    const shop = this.el.shop;
    const was = shop.classList.contains('min') ? 'min' : shop.classList.contains('full') ? 'full' : 'half';
    shop.style.height = '';
    shop.classList.toggle('min', state === 'min');
    shop.classList.toggle('full', state === 'full');
    if (state !== was) this.hooks.sound(state === 'min' ? 'close' : 'open', { vol: 0.4 });
    // Re-frame once the sheet has finished sliding (and once more in case the transition is skipped).
    shop.addEventListener('transitionend', () => this.layout(), { once: true });
    setTimeout(() => this.layout(), 400);
  }

  /** Drag the sheet's header to resize it; it snaps to folded / half / full. A tap toggles folded ↔ half. */
  private bindSheet() {
    const head = this.el.shop.querySelector('.shop-head') as HTMLElement;
    let drag: { y: number; h: number; t: number; moved: boolean } | null = null;
    head.addEventListener('pointerdown', (e) => {
      if (!document.body.classList.contains('phone')) return;
      drag = { y: e.clientY, h: this.el.shop.getBoundingClientRect().height, t: performance.now(), moved: false };
      this.el.shop.classList.add('dragging');
      try {
        head.setPointerCapture(e.pointerId);
      } catch { /* pointer already gone: the drag still works while it stays on the header */ }
    });
    head.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (Math.abs(dy) > 6) drag.moved = true;
      if (drag.moved) this.el.shop.style.height = `${Math.max(46, Math.min(innerHeight * 0.85, drag.h - dy))}px`;
    });
    const end = (e: PointerEvent) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      this.el.shop.classList.remove('dragging');
      const shop = this.el.shop;
      const state = shop.classList.contains('min') ? 'min' : shop.classList.contains('full') ? 'full' : 'half';
      if (!d.moved) return this.setSheet(state === 'min' ? 'half' : state === 'full' ? 'half' : 'min');
      // Snap by where it was let go, nudged by a quick flick.
      const h = shop.getBoundingClientRect().height;
      const v = (d.y - e.clientY) / Math.max(1, performance.now() - d.t);
      const target = h + v * 250;
      const stops: [number, 'min' | 'half' | 'full'][] = [[46, 'min'], [innerHeight * 0.38, 'half'], [innerHeight * 0.78, 'full']];
      stops.sort((a, b) => Math.abs(a[0] - target) - Math.abs(b[0] - target));
      this.setSheet(stops[0][1]);
    };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
  }

  // ---------- input ----------

  private bind() {
    const r = this.root;
    // Clicking the chamber: the treasure goblin first, then whichever monster is nearest.
    addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.modal || this.descending) return;
      // Clicks do nothing while the party is on the stairs; the interlude plays out in full.
      if (this.scene.busy) return;
      const t = e.target as HTMLElement;
      if (t.closest('button, .shop, .pnl, .dock, input, textarea')) return;
      if (this.game.raid && this.scene.hitRaider(e.clientX, e.clientY)) {
        this.game.catchRaid();
        return;
      }
      // On a touch screen, a finger held on the battlefield leads your hero (lift it and they fight on their own).
      if (e.pointerType !== 'mouse') {
        this.fingerDown = true;
        this.heroAim = { x: e.clientX, y: e.clientY };
      }
      // Hold to keep attacking (at most MANUAL_RATE a second, so there's nothing to gain from clicking faster).
      const id = this.scene.pick(e.clientX, e.clientY);
      this.game.hold = { id, x: e.clientX, y: e.clientY };
      this.game.click(id, e.clientX, e.clientY);
    });
    const letGo = () => {
      this.game.hold = null;
      this.spaceHeld = false;
      if (this.fingerDown) {
        this.fingerDown = false;
        this.heroAim = null;
      }
    };
    // A clicked button lets go of keyboard focus, so Space goes back to attacking instead of pressing it again.
    addEventListener('pointerup', (e) => {
      if (!this.spaceHeld) this.game.hold = null;
      if (e.pointerType !== 'mouse' && this.fingerDown) {
        this.fingerDown = false;
        this.heroAim = null;
      }
      if (e.pointerType === 'mouse') (document.activeElement as HTMLElement | null)?.closest?.('button')?.blur();
    });
    addEventListener('pointercancel', letGo);
    addEventListener('blur', letGo);
    addEventListener('pointermove', (e) => {
      const t = e.target as HTMLElement;
      const over = !t.closest('#ui button, #ui .shop, #ui .pnl') && (this.scene.overMonster(e.clientX, e.clientY) || (!!this.game.raid && this.scene.hitRaider(e.clientX, e.clientY)));
      document.body.classList.toggle('grab', over);
      // Over the battlefield, a mouse gets a sword instead of an arrow.
      // The whole dock strip counts as the dock, gaps between its buttons included: a normal cursor there, and no steering.
      const dock = this.el.dock.getBoundingClientRect();
      const overDock = e.clientX > dock.left - 10 && e.clientX < dock.right + 10 && e.clientY > dock.top - 10 && e.clientY < dock.bottom + 10;
      const field = e.pointerType === 'mouse' && !overDock && !t.closest('#ui button, #ui .shop, #ui .pnl, #ui .dock, #ui .modal-wrap') && !this.modal;
      this.el.blade.hidden = !field;
      document.body.classList.toggle('blade-on', field);
      this.pointer = field ? { x: e.clientX, y: e.clientY } : null;
      this.mouseStale = false;
      // Your hero follows the mouse anywhere over the battlefield, HUD overlays included. Reaching for a button
      // leaves them heading where you last pointed; over the party panel (or off the window) they fight on their own.
      if (e.pointerType === 'mouse') {
        const inField = e.clientX < this.field.w && e.clientY < this.field.h;
        if (!inField) this.heroAim = null;
        else if (!overDock && !t.closest('#ui button, #ui .shop, #ui .modal-wrap')) {
          this.heroAim = { x: e.clientX, y: e.clientY };
        }
      } else if (this.fingerDown) this.heroAim = { x: e.clientX, y: e.clientY };
      // Holding the attack down follows the cursor onto whichever monster it's over now.
      if (this.game.hold) {
        this.game.hold.x = e.clientX;
        this.game.hold.y = e.clientY;
        this.game.hold.id = this.scene.pick(e.clientX, e.clientY);
      }
      if (field) this.el.blade.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    });
    document.addEventListener('pointerleave', () => {
      this.heroAim = null;
      this.el.blade.hidden = true;
      document.body.classList.remove('blade-on');
    });
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key === 'Escape' && this.modal) this.closeModal();
      // Holding Space attacks just like holding the mouse down.
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !this.modal && !(e.target as HTMLElement).closest('button')) {
        e.preventDefault();
        if (this.scene.busy) return;
        // The sword swings where the cursor is, or at the front monster if the cursor's off the field.
        const f = this.game.focus();
        const s = f && this.scene.screenOf(f.id);
        const at = this.pointer ?? (s ? { x: s.x, y: s.y + s.h * 0.4 } : { x: -1, y: -1 });
        if (e.key === ' ') {
          this.spaceHeld = true;
          this.game.hold = { id: null, ...at };
        }
        this.game.click(null, at.x, at.y);
      }
    });
    addEventListener('keyup', (e) => {
      if (e.key === ' ' && this.spaceHeld) letGo();
    });
    const dirOf = (e: KeyboardEvent) => ({ w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' } as const)[e.key.toLowerCase() as 'w'];
    addEventListener('keydown', (e) => {
      const dir = dirOf(e);
      if (!dir || this.modal || (e.target as HTMLElement).closest('input, textarea')) return;
      this.keys.add(dir);
      this.mouseStale = true;
      if (e.key.startsWith('Arrow')) e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      const dir = dirOf(e);
      if (dir) this.keys.delete(dir);
    });
    addEventListener('blur', () => this.keys.clear());

    r.addEventListener('click', (e) => {
      if (this.pressed) {
        // That was a long-press to read the tooltip, not a purchase.
        this.pressed = false;
        return;
      }
      const t = e.target as HTMLElement;
      const hero = t.closest<HTMLElement>('[data-hero]');
      if (hero) {
        if (this.game.setHero(Number(hero.dataset.hero))) {
          if (this.game.s.heroTips === 1) this.game.s.heroTips = 2;
          this.hooks.sound('toggle', { vol: 0.6 });
          this.refreshTip();
        }
        return;
      }
      const comp = t.closest<HTMLElement>('[data-comp]');
      if (comp) {
        if (this.game.buyComp(Number(comp.dataset.comp))) this.refreshTip();
        else this.deny(comp);
        return;
      }
      const upg = t.closest<HTMLElement>('[data-upg]');
      if (upg) {
        if (this.game.buyUpg(upg.dataset.upg!)) this.hideTip();
        else this.deny(upg);
        return;
      }
      const mode = t.closest<HTMLElement>('[data-mode]');
      if (mode) {
        this.game.s.settings.buyMode = Number(mode.dataset.mode) as 1 | 10 | 100 | -1;
        this.hooks.sound('toggle', { vol: 0.5 });
        this.syncMode();
        this.rowCache.fill('');
        return;
      }
      const open = t.closest<HTMLElement>('[data-open]');
      if (open) {
        this.hooks.sound('open', { vol: 0.5 });
        this.openModal(open.dataset.open!);
        return;
      }
      const rel = t.closest<HTMLElement>('[data-relic]');
      if (rel) {
        if (this.game.toggleRelic(rel.dataset.relic!)) {
          this.hooks.sound('equip', { vol: 0.5 });
          this.renderModal();
          this.refreshTip();
        } else {
          this.deny(rel);
          this.toast('All slots are full. Tap a slotted relic to take it out first.', 'chest_full_open');
        }
        return;
      }
      const heart = t.closest<HTMLElement>('[data-heart]');
      if (heart) {
        if (this.game.buyHeart(heart.dataset.heart!)) {
          this.renderModal();
          this.refreshTip();
        } else this.deny(heart);
        return;
      }
      const aby = t.closest<HTMLElement>('[data-aby]');
      if (aby) {
        if (this.game.buyAbyss(aby.dataset.aby!)) this.renderModal();
        else this.deny(aby);
        return;
      }
      const cur = t.closest<HTMLElement>('[data-cursor]');
      if (cur) {
        if (!this.cursorOpen(cur.dataset.cursor!)) return this.deny(cur);
        // Tapping the one you're wearing takes it off: back to your best bought blade.
        const id = cur.dataset.cursor!;
        this.game.s.settings.cursor = this.game.s.settings.cursor === id ? 'auto' : id;
        this.hooks.sound('equip', { vol: 0.5 });
        this.hooks.settings();
        this.renderModal();
        return;
      }
      const act = t.closest<HTMLElement>('[data-act]');
      if (act) this.action(act.dataset.act!, act);
    });
    this.el.modalWrap.addEventListener('pointerdown', (e) => {
      if (e.target === this.el.modalWrap) this.closeModal();
    });

    r.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      const key = t.dataset.set as 'sfxVol' | 'musicVol' | undefined;
      if (!key) return;
      this.game.s.settings[key] = Number(t.value) / 100;
      this.hooks.settings();
    });

    r.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      if (!t || t === this.tipAnchor) return;
      this.showTip(t);
    });
    // Touch: press and hold anything with a tooltip to read it (the tap that follows won't buy).
    r.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      clearTimeout(this.pressTimer);
      this.hideTip();
      if (!t) return;
      this.pressAt = { x: e.clientX, y: e.clientY };
      this.pressTimer = window.setTimeout(() => {
        this.pressed = true;
        this.showTip(t);
        navigator.vibrate?.(10);
      }, 420);
    });
    // A finger that moves is scrolling, not pressing.
    r.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' && Math.hypot(e.clientX - this.pressAt.x, e.clientY - this.pressAt.y) > 10) clearTimeout(this.pressTimer);
    });
    r.addEventListener('scroll', () => clearTimeout(this.pressTimer), true);
    const release = () => {
      clearTimeout(this.pressTimer);
      if (this.pressed) setTimeout(() => this.hideTip(), 1800);
    };
    r.addEventListener('pointerup', release);
    r.addEventListener('pointercancel', release);
    r.addEventListener('contextmenu', (e) => e.preventDefault());
    r.addEventListener('pointerout', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      const to = (e.relatedTarget as HTMLElement | null)?.closest?.('[data-tip]');
      if (t && t === this.tipAnchor && to !== t) this.hideTip();
    });
  }

  private deny(el: HTMLElement) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    this.hooks.sound('close', { vol: 0.3, rate: 1.4 });
  }

  private action(act: string, el: HTMLElement) {
    const g = this.game;
    const s = g.s.settings;
    switch (act) {
      case 'close': this.closeModal(); break;
      case 'sound':
        s.muted = !s.muted;
        this.syncMute();
        this.hooks.settings();
        this.renderModal();
        break;
      case 'buyAll': if (g.buyAllUpgs()) this.hideTip(); break;
      case 'floorDown':
        if (g.goFloor(g.s.floor - 1)) g.s.auto = false;
        break;
      case 'floorUp': g.goFloor(g.s.floor + 1); break;
      case 'auto':
        g.setAuto(!g.s.auto);
        this.hooks.sound('toggle', { vol: 0.5 });
        break;
      case 'mute':
        s.muted = !s.muted;
        this.syncMute();
        this.hooks.settings();
        break;
      case 'music':
      case 'particles':
      case 'shake':
      case 'numbers':
      case 'blood':
      case 'cinematics':
        s[act] = !s[act];
        this.hooks.settings();
        this.renderModal();
        break;
      case 'notation':
        s.notation = s.notation === 'short' ? 'sci' : 'short';
        setNotation(s.notation);
        this.rowCache.fill('');
        this.upgKey = '';
        this.hooks.settings();
        this.renderModal();
        break;
      case 'export': {
        const ta = this.el.modal.querySelector('textarea') as HTMLTextAreaElement;
        ta.value = this.hooks.exportSave();
        ta.select();
        navigator.clipboard?.writeText(ta.value).then(() => this.toast('Save copied to clipboard', 'check'), () => {});
        break;
      }
      case 'import': {
        const ta = this.el.modal.querySelector('textarea') as HTMLTextAreaElement;
        if (!this.hooks.importSave(ta.value.trim())) this.toast('That save code did not work', 'close');
        break;
      }
      case 'reset':
        if (!this.resetArmed) {
          this.resetArmed = true;
          el.textContent = 'Really wipe everything?';
          setTimeout(() => {
            this.resetArmed = false;
            if (el.isConnected) el.textContent = 'Wipe save';
          }, 3000);
        } else this.hooks.reset();
        break;
      case 'descend': this.renderDescendConfirm(); break;
      case 'awaken': this.renderAwakenConfirm(); break;
      case 'awakenGo': this.doAwaken(); break;
      case 'heartBack': this.modal = 'heart'; this.renderModal(); break;
      case 'descendGo': this.doDescend(); break;
      case 'abyssBack': this.modal = 'abyss'; this.renderModal(); break;
    }
  }

  private syncMode() {
    const m = this.game.s.settings.buyMode;
    this.root.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.classList.toggle('on', Number(b.dataset.mode) === m));
  }

  private syncMute() {
    this.el.mute.innerHTML = this.game.s.settings.muted ? G.mute() : G.sound();
    this.el.mute.classList.toggle('off', this.game.s.settings.muted);
  }

  // ---------- events from the game ----------

  handle(ev: GameEvent) {
    const g = this.game;
    switch (ev.t) {
      case 'click':
        if (ev.x >= 0) this.swing(ev.x, ev.y, ev.crit);
        break;
      case 'hit': {
        if (!g.s.settings.numbers && ev.kind !== 'crit') break;
        const s = this.scene.screenOf(ev.id);
        if (!s) break;
        if (ev.kind === 'dps') this.pop(s.x + (Math.random() - 0.5) * 30, s.y + s.h * 0.2, fmt(ev.amount), 'p-dps');
        else if (ev.kind === 'cleave' || ev.kind === 'auto') this.pop(s.x + (Math.random() - 0.5) * 40, s.y + s.h * 0.3, fmt(ev.amount), 'p-cleave');
        // Pop classes are prefixed so they can't collide with HUD classes (the Rampage meter is .fever).
        // Numbers always rise from the monster that was hit, wherever you tapped.
        else this.pop(s.x + (Math.random() - 0.5) * s.h * 0.5, s.y + s.h * 0.2, fmt(ev.amount), `p-${ev.kind}`);
        break;
      }
      case 'kill': {
        const s = this.scene.screenOf(ev.id);
        if (!s) break;
        this.pop(s.x, s.y + s.h * 0.5, `+${fmt(ev.gold)}`, ev.boss || ev.champ ? 'p-gold p-big' : 'p-gold');
        if (ev.champ) this.pop(s.x, s.y - 10, 'CHAMPION!', 'p-champ');
        this.coinFly(s.x, s.y + s.h * 0.6, ev.boss ? 8 : ev.champ ? 10 : 1);
        break;
      }
      case 'sweep': {
        const at = this.scene.fieldScreen();
        this.pop(at.x, at.y, `Swept! +${fmt(ev.gold)}`, 'p-gold p-sweep');
        this.coinFly(at.x, at.y + 20, 4);
        break;
      }
      case 'floor':
        // A cleared floor: say so in the middle of the field, and give the floor bar a gold flash as it ticks over.
        if (ev.cleared) {
          const mid = this.scene.fieldScreen();
          this.pop(mid.x, mid.y, `Floor ${ev.floor - 1} cleared!`, 'p-floor');
          this.el.floorBox.classList.remove('advance');
          void this.el.floorBox.offsetWidth;
          this.el.floorBox.classList.add('advance');
        }
        // Entering a new zone gets a title card.
        if (ev.floor % 10 === 1 && ev.floor > 1) {
          // During the staircase interlude, the title card waits for the party to arrive.
          if (this.scene.busy) this.pendingZone = ev.floor;
          else this.zoneBanner(ev.floor);
        }
        if (ev.boss) {
          const boss = g.monsters.find((m) => m.boss);
          const mods = g.bossMods(ev.floor).map((id) => MOD_BY_ID.get(id)!.name);
          const time = `Kill it in ${Math.round(g.bossTimeMax)} seconds`;
          this.banner(`Boss: ${boss?.def.name ?? 'Guardian'}`, mods.length ? `${mods.join(' · ')} — ${time.toLowerCase()}` : time, 'boss');
        }
        break;
      case 'bossWin':
        if (ev.clutch) {
          // CLUTCH! slams in as the slow motion starts, with letterbox bars for the length of it.
          const { left, gold } = ev.clutch;
          if (g.s.settings.cinematics) {
            this.cinemaUntil = performance.now() + 1900;
            document.body.classList.add('cinema');
            setTimeout(() => document.body.classList.remove('cinema'), 1650);
          }
          this.banner('CLUTCH!', `${left.toFixed(1)}s to spare · +${fmt(gold)} gold`, 'clutch');
        }
        else this.banner('Victory!', `Floor ${ev.floor} conquered`, 'win');
        break;
      case 'bossFail':
        // The first wall: this is where the game teaches you to descend.
        if (g.s.descents === 0 && ev.floor >= DESCEND_FLOOR && g.canDescend()) this.banner('The way down opens', 'Descend to come back stronger', 'fail');
        else this.banner('The boss held', 'Your party falls back to grow stronger', 'fail');
        break;
      case 'souls': {
        const s = this.scene.screenOf(ev.id);
        if (s) this.pop(s.x, s.y + s.h * 0.1, `+${fmt(ev.souls)} souls`, 'p-soul');
        break;
      }
      case 'retreat': this.toast(`Floor ${ev.floor} is too tough for now. Falling back.`, 'skull'); break;
      case 'buyComp':
        this.rowCache[ev.comp] = '';
        this.bump(this.rows[ev.comp]);
        break;
      case 'reveal': this.toast(`New companion for hire: <b>${COMPS[ev.comp].name}</b>`, COMPS[ev.comp].sprite); break;
      case 'buyUpg': this.upgKey = ''; break;
      case 'trophy': {
        const t = TROPHIES.find((x) => x.id === ev.id)!;
        this.toast(`Trophy: <b>${esc(t.name)}</b><small>${esc(t.desc)} +1% damage</small>`, t.icon.sprite, 'trophy');
        const cur = CURSORS.find((c) => c.trophy === ev.id);
        if (cur) this.toast(`New cursor: <b>${esc(cur.name)}</b><small>Pick it in Options</small>`, cur.sprite, 'trophy');
        break;
      }
      case 'raidCatch': {
        if (ev.reward === 'vault') break;
        const title = REWARD_TEXT[ev.reward];
        const line = ev.reward === 'plunder' || ev.reward === 'rainbow' ? `+${fmt(ev.amount ?? 0)} gold` : ev.buff ? `${buffText(ev.buff)} for ${Math.round(ev.buff.dur)}s` : '';
        this.banner(title, line, ev.reward === 'rainbow' ? 'loot rainbow' : 'loot');
        break;
      }
      case 'raidSpawn':
        if (ev.rainbow && g.s.vaults === 0) {
          this.banner('A RAINBOW GOBLIN!', 'Catch it to open the Goblin Vault!', 'loot rainbow');
          this.hooks.sound('drop4', { vol: 0.7 });
        }
        break;
      case 'raidEscape': this.toast('The treasure goblin got away…', 'goblin'); break;
      case 'fever': if (ev.on) this.banner('RAMPAGE!', `Clicks ×${fmt(g.feverMult())} · party damage ×${fmt(2 * g.rampageParty())} · ${g.rampageNext()?.left ?? 0} attacks to ×${fmt(g.rampageNext()?.mult ?? 0)}`, 'rampage'); break;
      case 'rampage': this.banner(`RAMPAGE ×${fmt(ev.click)}!`, `Unstoppable · party damage ×${fmt(3 * g.rampageParty())}`, `rampage tier${ev.tier}`); break;
      case 'vault':
        if (ev.on) this.banner('GOBLIN VAULT!', 'The room fills with hoarders. Get them all!', 'loot rainbow');
        else this.toast(`The vault closes. Haul: <b>+${fmt(ev.gold)} gold</b>`, 'chest_full_open', 'trophy');
        break;
      case 'abyss': this.toast(`Abyss power: <b>${esc(ABYSS.find((a) => a.id === ev.id)!.name)}</b>`, 'flask_big_red'); break;
      case 'relic': {
        // A relic from a clutch kill waits for the slow motion to finish.
        const wait = this.cinemaUntil - performance.now();
        if (wait > 0) setTimeout(() => this.showLoot(ev.id, ev.lv, ev.equipped, ev.star), wait + 150);
        else this.showLoot(ev.id, ev.lv, ev.equipped, ev.star);
        break;
      }
      case 'heal': {
        if (!g.s.settings.numbers) break;
        const s = this.scene.screenOf(ev.id);
        if (s) this.pop(s.x + (Math.random() - 0.5) * 40, s.y + s.h * 0.25, `+${fmt(ev.amount)}`, 'p-heal');
        break;
      }
      case 'split': {
        const s = this.scene.screenOf(ev.into[0]) ?? this.scene.screenOf(ev.id);
        if (s) this.pop(s.x, s.y + s.h * 0.2, 'Split!', 'p-mod');
        break;
      }
      case 'heart': this.toast(`<b>${esc(HEART_BY_ID.get(ev.id)!.name)}</b> is now level ${ev.lv}`, HEART_BY_ID.get(ev.id)!.icon); break;
    }
  }

  /** Swing the sword cursor and mark the spot. */
  private swing(x: number, y: number, crit = false) {
    const b = this.el.bladeIn;
    b.classList.remove('swing');
    void b.offsetWidth;
    b.classList.add('swing');
    const ring = document.createElement('i');
    ring.className = `click-ring${crit ? ' crit' : ''}`;
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.onanimationend = () => ring.remove();
    this.el.pops.appendChild(ring);
  }

  private zoneBanner(floor: number) {
    const z = zoneOf(floor);
    const lap = lapOf(floor);
    // The first zone of a new lap says what's changed.
    const sub = lap && z % 8 === 0 ? `Everything returns ${corruptionOf(lap).name.toLowerCase()} · floors ${z * 10 + 1}–${z * 10 + 10}` : `Floors ${z * 10 + 1}–${z * 10 + 10}`;
    this.banner(zoneName(floor), sub, `zone lap${Math.min(lap, 4)}`);
  }

  /** The party has come down the stairs into a new zone. */
  arrived() {
    if (this.pendingZone) this.zoneBanner(this.pendingZone);
    this.pendingZone = 0;
  }

  private bump(el: HTMLElement) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  private pop(x: number, y: number, text: string, kind: string) {
    const el = this.pops.length >= MAX_POPS ? this.pops.shift()! : document.createElement('div');
    el.className = `pop ${kind}`;
    el.textContent = text;
    el.style.left = `${x + (kind === 'p-dps' ? 0 : (Math.random() - 0.5) * 20)}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--dx', `${(Math.random() - 0.5) * 50}px`);
    this.el.pops.appendChild(el);
    this.pops.push(el);
    el.onanimationend = () => {
      el.remove();
      const i = this.pops.indexOf(el);
      if (i >= 0) this.pops.splice(i, 1);
    };
  }

  /** Coins arc from a kill up into the gold counter. */
  private coinFly(x: number, y: number, n: number) {
    const target = this.el.bankIco.getBoundingClientRect();
    const tx = target.left + target.width / 2;
    const ty = target.top + target.height / 2;
    for (let i = 0; i < n && this.coins < MAX_COINS; i++) {
      this.coins++;
      const c = document.createElement('i');
      c.className = 'coin-fly';
      c.innerHTML = sprite('coin', 3);
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
      this.el.pops.appendChild(c);
      const mid = { x: x + (Math.random() - 0.5) * 120, y: y - 60 - Math.random() * 60 };
      const anim = c.animate([
        { transform: 'translate(-50%, -50%) scale(0.6)' },
        { transform: `translate(calc(-50% + ${mid.x - x}px), calc(-50% + ${mid.y - y}px)) scale(1.1)`, offset: 0.35 },
        { transform: `translate(calc(-50% + ${tx - x}px), calc(-50% + ${ty - y}px)) scale(0.7)` },
      ], { duration: 650 + Math.random() * 250 + i * 40, easing: 'cubic-bezier(.5,0,.8,.6)' });
      anim.onfinish = () => {
        c.remove();
        this.coins--;
        this.bump(this.el.bankIco);
      };
    }
  }

  toast(html: string, spr: string, cls = '') {
    const el = document.createElement('div');
    el.className = `toast pnl ${cls}`;
    const ico = spr === 'check' ? G.check() : spr === 'close' ? G.close() : spriteFit(spr, 32);
    el.innerHTML = `<span class="toast-ico">${ico}</span><span class="toast-t">${html}</span>`;
    this.el.toasts.prepend(el);
    while (this.el.toasts.children.length > 3) this.el.toasts.lastElementChild!.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }, 4200);
  }

  private banner(title: string, sub: string, cls = '') {
    // Nothing else takes the banner during a clutch kill's slow motion; it waits its turn after the CLUTCH! one.
    const cinema = this.cinemaUntil - performance.now();
    if (cinema > 0 && !/\bclutch\b/.test(cls)) {
      setTimeout(() => this.banner(title, sub, cls), cinema + 1200);
      return;
    }
    // A victory gets its moment before the next boss's introduction takes over the banner.
    const held = Date.now() - this.bannerAt < 1500 && /\b(win|clutch)\b/.test(this.el.banner.className);
    if (held && cls === 'boss') {
      clearTimeout(this.bannerQueued);
      this.bannerQueued = window.setTimeout(() => this.banner(title, sub, cls), 1500 - (Date.now() - this.bannerAt));
      return;
    }
    this.bannerAt = Date.now();
    const b = this.el.banner;
    b.className = `banner ${cls}`;
    b.querySelector('b')!.textContent = title;
    b.querySelector('span')!.textContent = sub;
    b.hidden = false;
    this.bump(b);
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => (b.hidden = true), 2600);
  }

  /** Is this cursor skin unlocked? */
  private cursorOpen(id: string) {
    const c = CURSORS.find((x) => x.id === id);
    return !!c && (!c.trophy || this.game.hasTrophy(c.trophy));
  }

  /** The sprite for the chosen cursor; with none chosen, it follows your best click upgrade. */
  private cursorSprite(): string {
    const pick = CURSORS.find((c) => c.id === this.game.s.settings.cursor);
    if (pick && this.cursorOpen(pick.id)) return pick.sprite;
    return this.bestBlade();
  }

  /** The best blade you've bought (click upgrades), or the starting knife. */
  private bestBlade(): string {
    const g = this.game;
    return ['weapon_anime_sword', 'weapon_knight_sword', 'weapon_lavish_sword', 'weapon_golden_sword', 'weapon_red_gem_sword', 'weapon_regular_sword', 'weapon_rusty_sword', 'weapon_knife']
      .find((_, k, all) => g.hasUpg(`clk${all.length - 1 - k}`)) ?? 'weapon_knife';
  }

  // ---------- per-frame ----------

  frame(dt: number) {
    const g = this.game;
    // The marker over your hero (hero tip) moves every frame, right with them.
    const mark = this.el.heroMark;
    if (!mark.hidden) {
      const at = this.scene.heroScreen(g);
      if (at) mark.style.transform = `translate(${at.x}px, ${at.y}px)`;
      mark.style.visibility = at ? 'visible' : 'hidden';
    }
    if (this.keys.size) this.keyedAt = performance.now();
    this.scene.heroBlocked = [this.el.dock.getBoundingClientRect()];
    const input = this.scene.heroInput;
    input.aim = !this.modal && !this.mouseStale ? this.heroAim : null;
    input.keys = { x: (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0), z: (this.keys.has('down') ? 1 : 0) - (this.keys.has('up') ? 1 : 0) };
    input.stay = this.mouseStale && !this.keys.size && performance.now() - this.keyedAt < 4000;
    const bank = g.s.gold;
    this.shown = bank.lt(this.shown) || bank.minus(this.shown).lt(1) ? bank : this.shown.plus(bank.minus(this.shown).times(Math.min(1, dt * 10)));
    this.el.bank.textContent = fmt(this.shown);

    // Health bars over wounded monsters.
    const seen = new Set<number>();
    for (const m of g.monsters) {
      if (m.hp >= m.max && !m.boss) continue;
      const s = this.scene.screenOf(m.id);
      if (!s) continue;
      seen.add(m.id);
      let bar = this.bars.get(m.id);
      if (!bar) {
        bar = document.createElement('div');
        bar.className = `hp ${m.boss ? 'boss' : ''}`;
        bar.innerHTML = `<i></i>${m.mods.length ? `<span class="hp-mods">${modChips(m.mods)}</span>` : ''}`;
        this.el.bars.appendChild(bar);
        this.bars.set(m.id, bar);
      }
      // Keep bars on screen even when a big monster stands near the edge.
      const half = m.boss ? 62 : 24;
      const x = Math.min(innerWidth - half, Math.max(half, s.x));
      bar.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(4, s.y - 8))}px)`;
      (bar.firstChild as HTMLElement).style.width = `${Math.max(0, m.hp.div(m.max).toNumber()) * 100}%`;
    }
    for (const [id, bar] of this.bars) if (!seen.has(id)) {
      bar.remove();
      this.bars.delete(id);
    }

    const rp = g.raid ? this.scene.raiderScreen() : null;
    this.el.raid.hidden = !rp;
    this.el.raid.classList.toggle('rainbow', !!g.raid?.rainbow);
    if (rp) {
      this.el.raid.style.transform = `translate(${rp.x}px, ${rp.y}px)`;
      // Keep the "catch it" label on screen when the goblin is near an edge.
      this.el.raid.classList.toggle('edge-l', rp.x < 120);
      this.el.raid.classList.toggle('edge-r', rp.x > innerWidth - 120);
    }

    this.newsT -= dt;
    if (this.newsT <= 0) this.nextNews();
  }

  update() {
    const g = this.game;
    const blade = this.cursorSprite();
    if (blade !== this.bladeSprite) {
      this.bladeSprite = blade;
      // The knife is tiny, so it gets drawn a size up.
      this.el.bladeIn.innerHTML = sprite(blade, blade === 'weapon_knife' ? 3 : 2);
    }
    this.el.dps.textContent = fmt(g.dps());
    this.el.click.textContent = fmt(g.clickDamage());
    this.el.rate.classList.toggle('boosted', g.s.buffs.some((b) => b.id !== 'fever'));

    this.renderFloor();

    const fever = g.s.buffs.find((b) => b.id === 'fever');
    this.el.fever.hidden = g.s.clicks < 1 && !fever;
    this.el.fever.classList.toggle('on', !!fever);
    this.el.feverBar.style.width = `${(fever ? fever.t / fever.dur : g.s.fervor) * 100}%`;
    // While it runs, the meter says where the Rampage stands and how far the next step is.
    const next = fever ? g.rampageNext() : null;
    const label = !fever ? 'Rampage' : next ? `×${fmt(g.feverMult())} · ${next.left} more for ×${fmt(next.mult)}` : `×${fmt(g.feverMult())} · max!`;
    if (this.el.feverLabel.textContent !== label) this.el.feverLabel.textContent = label;

    this.renderBuffs(g.s.buffs);
    this.renderRows();
    this.renderUpgrades();
    this.el.shopSub.textContent = `${g.s.owned.filter((n) => n > 0).length} companions · ${g.s.upgrades.length} upgrades`;
    if (document.body.classList.contains('compact')) {
      const hud = (this.el.fever.hidden ? this.el.floorBox : this.el.fever).getBoundingClientRect();
      if (Math.abs(Math.round(hud.bottom + 4) - this.hudTop) > 6) this.layout();
    }

    const pending = g.pendingSouls();
    const ab = this.el.abyssBadge;
    ab.hidden = pending < 1;
    ab.innerHTML = `${G.soul(1.5)}${fmt(pending)}`;
    ab.classList.toggle('hot', pending >= Math.max(10, g.s.souls));

    if (g.canAwaken() && !this.toldAwaken) {
      this.toldAwaken = true;
      if (g.s.awakens === 0) this.toast('<b>The Heart stirs.</b> You can awaken it now: Descend → Awaken.', 'ui_heart_full', 'trophy');
    }
    const rb = this.el.relicBadge;
    rb.hidden = this.newRelics < 1;
    rb.textContent = `+${this.newRelics}`;
    const rate = `${perSec(g.autoRate())}/s`;
    const rateEl = this.el.bladeRate.lastElementChild!;
    if (rateEl.textContent !== rate) rateEl.textContent = rate;

    this.hints();
    if (this.modal && ['trophies', 'abyss', 'heart', 'stats', 'party', 'records', 'relics'].includes(this.modal) && !this.descending) this.renderModal(true);
    this.refreshTip();
  }

  private renderFloor() {
    const g = this.game;
    const s = g.s;
    const boss = g.bossFloor();
    const key = `${s.floor}|${s.maxFloor}|${s.auto}|${boss}`;
    if (key !== this.floorKey) {
      this.floorKey = key;
      this.el.floorN.textContent = `Floor ${s.floor}`;
      const mods = boss ? g.bossMods() : [];
      if (mods.length) this.el.floorSub.innerHTML = `Boss ${modChips(mods)}`;
      else this.el.floorSub.textContent = boss ? 'Boss' : zoneName(s.floor).replace(/^The /, '');
      this.el.floorBox.classList.toggle('is-boss', boss);
      (this.el.down as HTMLButtonElement).disabled = s.floor <= 1;
      (this.el.up as HTMLButtonElement).disabled = s.floor >= s.maxFloor;
      this.el.auto.classList.toggle('on', s.auto);
      this.el.auto.textContent = s.auto ? 'Auto: on' : 'Auto: off';
    }
    if (boss && g.inVault()) {
      // The boss steps aside for the vault; its clock is frozen.
      this.el.floorBar.style.width = `${g.bossTimeMax ? (Math.max(0, g.bossTime) / g.bossTimeMax) * 100 : 100}%`;
      this.el.floorBarT.textContent = 'Boss waits';
      this.el.floorBox.classList.remove('urgent');
    } else if (boss) {
      // The bar is the clock: it drains steadily. (The boss's health is the bar over its head.)
      const left = Math.max(0, g.bossTime);
      this.el.floorBar.style.width = `${(left / g.bossTimeMax) * 100}%`;
      this.el.floorBarT.textContent = `${left.toFixed(1)}s`;
      this.el.floorBox.classList.toggle('urgent', g.bossTime < 8);
    } else {
      const k = Math.min(FLOOR_KILLS, s.floorKills);
      this.el.floorBar.style.width = `${(k / FLOOR_KILLS) * 100}%`;
      this.el.floorBarT.textContent = s.floorKills >= FLOOR_KILLS ? 'Cleared' : `${k} / ${FLOOR_KILLS}`;
      this.el.floorBox.classList.remove('urgent');
    }
  }

  /** One chip per active buff: built once (so its pop-in plays once), then only the timer updates. */
  private renderBuffs(buffs: Buff[]) {
    const active = buffs.filter((b) => b.id !== 'fever');
    const box = this.el.buffs;
    for (const chip of [...box.children] as HTMLElement[]) {
      if (!active.some((b) => b.id === chip.dataset.buff)) chip.remove();
    }
    for (const b of active) {
      let chip = box.querySelector<HTMLElement>(`[data-buff="${b.id}"]`);
      if (!chip) {
        const ico = b.id === 'bloodlust' ? 'flask_big_red' : b.id === 'heartstorm' ? 'weapon_golden_sword' : b.id === 'soulstorm' ? 'chest_mimic_open' : b.id === 'vault' ? 'chest_full_open' : 'coin';
        chip = document.createElement('div');
        chip.className = `buff ${b.id}`;
        chip.dataset.buff = b.id;
        chip.innerHTML = `<span class="buff-ico">${spriteFit(ico, 24)}</span><span class="buff-t"><b>${esc(b.name)}</b><small></small></span><em class="buff-bar"></em>`;
        box.appendChild(chip);
      }
      // Phones only have room for the countdown; the icon says which buff it is.
      const text = document.body.classList.contains('phone') ? `${Math.ceil(b.t)}s` : `${buffText(b)} · ${Math.ceil(b.t)}s`;
      const small = chip.querySelector('small')!;
      if (small.textContent !== text) small.textContent = text;
      (chip.querySelector('.buff-bar') as HTMLElement).style.width = `${(b.t / b.dur) * 100}%`;
    }
  }

  private renderRows() {
    const g = this.game;
    const revealed = g.s.revealed;
    COMPS.forEach((def, i) => {
      const row = this.rows[i];
      if (i > revealed) {
        row.hidden = true;
        return;
      }
      row.hidden = false;
      const mystery = i === revealed && i > 0 && g.s.owned[i] === 0;
      const locked = !g.compUnlocked(i);
      const q = g.compQuote(i);
      const can = !locked && !mystery && g.s.gold.gte(q.cost);
      row.classList.toggle('can', can);
      row.classList.toggle('is-hero', g.heroIndex() === i);
      row.classList.toggle('owned', g.s.owned[i] > 0);
      row.classList.toggle('mystery', mystery || locked);
      row.style.setProperty('--prog', `${Math.min(1, g.s.gold.div(q.cost).toNumber()) * 100}%`);
      const lv = g.s.owned[i];
      const key = [mystery, locked, q.n, q.cost.toString(), lv, can, g.s.settings.notation, Math.round(g.compDps(i).plus(1).log10() * 20)].join('|');
      if (key === this.rowCache[i]) return;
      this.rowCache[i] = key;
      const name = locked || mystery ? '???' : def.name;
      row.querySelector('.gen-name')!.innerHTML = `${name}${q.n > 1 && !locked && !mystery ? ` <small>×${q.n}</small>` : ''}`;
      row.querySelector('.gen-cost')!.innerHTML = locked ? `<span class="need">${G.lock()} ${meetText(def, g.s.descents)}</span>` : gold(q.cost, can ? 'ok' : 'no');
      row.querySelector('.gen-lv')!.textContent = lv ? `Lv ${lv}` : '';
      row.querySelector('.gen-dps')!.textContent = lv ? `${fmt(g.compDps(i))} dps` : '';
    });
  }

  private renderUpgrades() {
    const g = this.game;
    const list = g.shopUpgrades();
    const key = list.map((u) => u.id).join(',') + g.s.settings.notation;
    if (key !== this.upgKey) {
      this.upgKey = key;
      this.el.upgGrid.innerHTML = list.slice(0, 40).map((u) => `<button class="upg" data-upg="${u.id}" data-tip="upg:${u.id}">${icon(u.icon, 32)}</button>`).join('');
      this.el.upgEmpty.hidden = list.length > 0;
    }
    let affordable = 0;
    this.el.upgGrid.querySelectorAll<HTMLElement>('.upg').forEach((b) => {
      const can = g.s.gold.gte(g.upgCost(UPG_BY_ID.get(b.dataset.upg!)!));
      if (can) affordable++;
      b.classList.toggle('can', can);
    });
    this.el.buyAll.hidden = affordable < 2;
    // Folded phone sheet: a strip of just the upgrades you can buy right now (or nothing at all).
    const strip = affordable > 0;
    if (strip !== this.strip) {
      this.strip = strip;
      this.el.shop.classList.toggle('has-strip', strip);
      if (this.el.shop.classList.contains('min')) setTimeout(() => this.layout(), 300);
    }
  }

  // ---------- onboarding ----------

  private hints() {
    const g = this.game;
    let state = '';
    if (g.s.clicks < 6) state = 'click';
    else if (g.s.owned.every((n) => n === 0) && g.s.gold >= g.compCost(0)) state = 'hire';
    else if (g.raid && g.s.raids === 0) state = 'raid';
    else if (g.raid?.rainbow && g.s.vaults === 0) state = 'rainbow';
    // Meeting your hero: first on the field, then (once there's someone to switch to) the star that picks one.
    else if (g.s.heroTips === 0 && g.heroIndex() >= 0) state = 'hero';
    else if (g.s.heroTips === 1 && g.s.owned.filter((n) => n > 0).length >= 2) state = 'star';
    if (state !== this.hintState) this.tourAt = performance.now();
    const shown = performance.now() - this.tourAt;
    // The words stay put at the top of the battlefield (a hero on the move is hard to read beside); a small marker
    // bobs over the hero's head (moved every frame, in frame()).
    this.el.heroMark.hidden = state !== 'hero';
    if (state === 'hero') {
      this.el.hint.style.transform = `translate(${this.field.w / 2}px, ${this.hudTop + (this.hudTop ? 16 : 222)}px)`;
      this.el.hint.style.visibility = 'visible';
      if (shown > 10_000) g.s.heroTips = 1;
    } else if (state === 'star') {
      const star = this.rows[this.starPick()]?.querySelector('.gen-hero')?.getBoundingClientRect();
      const visible = !!star && star.width > 0 && star.top > 0 && star.bottom < innerHeight;
      // Beside the star when there's room to its left (the party panel on the right); above it otherwise (the phone sheet).
      const above = !!star && star.left < 340;
      this.el.hint.classList.toggle('point-right', !above);
      this.el.hint.classList.toggle('point-down', above);
      if (star) this.el.hint.style.transform = above ? `translate(${star.left + star.width / 2}px, ${star.top - 6}px)` : `translate(${star.left - 12}px, ${star.top + star.height / 2}px)`;
      this.el.hint.style.visibility = visible ? 'visible' : 'hidden';
      if (shown > 15_000) g.s.heroTips = 2;
    }
    if (state === 'click') {
      const f = g.focus();
      const s = f && this.scene.screenOf(f.id);
      if (s) this.el.hint.style.transform = `translate(${s.x}px, ${s.y + s.h + 16}px)`;
      // Nothing to point at yet (monsters still coming up the stairs).
      this.el.hint.style.visibility = s ? 'visible' : 'hidden';
    }
    if (state === this.hintState) return;
    this.hintState = state;
    this.el.hint.hidden = !['click', 'hero', 'star'].includes(state);
    if (state !== 'star') this.el.hint.classList.remove('point-right', 'point-down');
    this.el.hint.classList.toggle('still', state === 'hero');
    this.el.shop.classList.toggle('show-stars', state === 'star');
    this.el.hint.innerHTML = state === 'hero'
      ? `<b>This is your hero!<small>The one with the gold ring · ${this.touch ? 'hold a finger down to lead them' : 'they follow your mouse'}</small></b>`
      : state === 'star' ? `<b>Try making the ${esc(COMPS[this.starPick()]?.name ?? 'next one')} your hero<small>Click their ★ to switch</small></b>`
        : `<b>${this.touch ? 'Tap' : 'Click'} the monsters!<small>Hold to keep attacking</small></b>`;
    this.rows[0].classList.toggle('nudge', state === 'hire');
    this.el.raid.classList.toggle('first', state === 'raid' || state === 'rainbow');
    this.el.raid.classList.toggle('rb-first', state === 'rainbow');
  }

  /** Who the star tip suggests trying as your hero: the first companion you have who isn't your hero already. */
  private starPick() {
    const hero = this.game.heroIndex();
    return this.game.s.owned.findIndex((n, i) => n > 0 && i !== hero);
  }

  // ---------- tooltips ----------

  private showTip(anchor: HTMLElement) {
    this.tipAnchor = anchor;
    this.tipKey = anchor.dataset.tip!;
    this.refreshTip(true);
  }

  private hideTip() {
    this.tipAnchor = null;
    this.tipKey = null;
    this.el.tip.hidden = true;
  }

  private refreshTip(place = false) {
    let a = this.tipAnchor;
    if (!a || !this.tipKey) return;
    if (!a.isConnected) {
      // The panel re-rendered under the cursor: follow the new element.
      a = this.root.querySelector<HTMLElement>(`[data-tip="${this.tipKey}"]`);
      if (!a) return this.hideTip();
      this.tipAnchor = a;
    }
    const html = this.tipHtml(this.tipKey);
    if (!html) return this.hideTip();
    const tip = this.el.tip;
    if (tip.innerHTML !== html) tip.innerHTML = html;
    tip.hidden = false;
    if (!place && !this.tipKey.startsWith('comp') && !this.tipKey.startsWith('upg')) return;
    const r = a.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let x: number;
    let y: number;
    if (a.closest('.shop') && !document.body.classList.contains('phone')) {
      x = r.left - tr.width - 10;
      y = Math.min(innerHeight - tr.height - 8, Math.max(8, r.top + r.height / 2 - tr.height / 2));
    } else {
      x = Math.min(innerWidth - tr.width - 8, Math.max(8, r.left + r.width / 2 - tr.width / 2));
      y = r.top - tr.height - 10;
      if (y < 8) y = r.bottom + 10;
    }
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  private tipHtml(key: string): string {
    const g = this.game;
    const [kind, id] = key.split(':');
    if (kind === 'comp') {
      const i = Number(id);
      const def = COMPS[i];
      if (!g.compUnlocked(i)) return `<div class="tt-h"><b>???</b></div><p class="tt-f">Someone waits deeper down. ${meetText(def, g.s.descents)}.</p>`;
      if (i === g.s.revealed && g.s.owned[i] === 0 && i > 0) return `<div class="tt-h"><b>???</b></div><p class="tt-f">A new companion is on their way. Earn more gold to meet them.</p>`;
      const q = g.compQuote(i);
      const next = g.compNext(i).times(q.n);
      const share = g.baseDps().gt(0) ? g.compDps(i).div(g.baseDps()).toNumber() : 0;
      return `<div class="tt-h">${charFit(def.sprite, 30)}<b>${def.name}</b><span class="tt-own">level ${g.s.owned[i]}</span></div>
        <div class="tt-cost">${gold(q.cost, g.s.gold.gte(q.cost) ? 'ok' : 'no')}${q.n > 1 ? ` for ${q.n} levels` : ''}</div>
        <ul class="tt-l">
          ${g.s.owned[i] ? `<li>Deals <b>${fmt(g.compDps(i))}</b> damage/sec (${(share * 100).toFixed(1)}% of your party)</li>` : ''}
          <li>Next ${q.n > 1 ? `${q.n} levels` : 'level'}: <b class="up">+${fmt(next)}</b> damage/sec</li>
          <li>Bonus at levels 10, 25, 50, 75, 100…</li>
        </ul>
        <p class="tt-f">“${esc(def.flavor)}”</p>`;
    }
    if (kind === 'upg') {
      const u = UPG_BY_ID.get(id);
      if (!u) return '';
      const cost = g.upgCost(u);
      return `<div class="tt-h">${icon(u.icon, 32)}<b>${esc(u.name)}</b><span class="tt-own">upgrade</span></div>
        <div class="tt-cost">${gold(cost, g.s.gold.gte(cost) ? 'ok' : 'no')}</div>
        <p class="tt-d">${esc(u.desc)}</p>${this.upgPreview(u)}`;
    }
    if (kind === 'tro') {
      const t = TROPHIES.find((x) => x.id === id)!;
      return `<div class="tt-h">${icon(t.icon, 32)}<b>${esc(t.name)}</b><span class="tt-own">${g.hasTrophy(id) ? 'unlocked' : 'locked'}</span></div><p class="tt-d">${esc(t.desc)}</p>`;
    }
    if (kind === 'aby') {
      const a = ABYSS.find((x) => x.id === id)!;
      const needs = (a.needs ?? []).filter((n) => !g.hasAbyss(n)).map((n) => ABYSS.find((x) => x.id === n)!.name);
      return `<div class="tt-h">${spriteFit(a.icon, 32)}<b>${esc(a.name)}</b><span class="tt-own">${g.hasAbyss(id) ? 'owned' : `${a.cost} souls`}</span></div><p class="tt-d">${esc(a.desc)}</p>${needs.length ? `<p class="tt-f">Requires ${needs.join(', ')}</p>` : ''}`;
    }
    if (kind === 'rel') {
      const d = RELIC_BY_ID.get(id)!;
      const lv = g.relicLv(id);
      const head = `<div class="tt-h">${spriteFit(d.icon, 32)}<b style="color:${RARITY_COLORS[d.rarity]}">${lv ? esc(d.name) : '???'}</b><span class="tt-own">${RARITY[d.rarity]}${lv ? ` · level ${lv}` : ''}</span></div>`;
      if (!lv) return `${head}<p class="tt-f">Not found yet. ${d.rarity === 3 ? 'Legendary relics mostly turn up deep down.' : 'Keep killing bosses.'}</p>`;
      return `${head}<p class="tt-d">${esc(relicText(d, lv))}</p><p class="tt-gain">Next level: ${esc(relicText(d, lv + 1))}</p><p class="tt-f">“${esc(d.flavor)}”</p>`;
    }
    if (kind === 'heart') {
      const h = HEART_BY_ID.get(id)!;
      const lv = g.heartLv(id);
      return `<div class="tt-h">${spriteFit(h.icon, 32)}<b>${esc(h.name)}</b><span class="tt-own">${lv ? `level ${lv}` : 'heart power'}</span></div><p class="tt-d">${esc(h.desc(lv))}</p>${g.heartMaxed(id) ? '<p class="tt-f">Maxed.</p>' : `<p class="tt-f">Next level: ${G.heart(1.5)} ${fmt(g.heartCost(id))} heartstones</p>`}`;
    }
    if (kind === 'floor') {
      const mods = g.bossFloor() ? g.bossMods() : [];
      if (!mods.length) return `<div class="tt-h"><b>Floor ${g.s.floor}</b><span class="tt-own">${esc(zoneName(g.s.floor))}</span></div><p class="tt-d">${g.bossFloor() ? `Beat the boss before the clock runs out.` : `Kill ${FLOOR_KILLS} monsters to clear the floor.`}</p>${g.s.floor < 30 ? '<p class="tt-f">From floor 30, bosses start showing up with modifiers.</p>' : ''}`;
      return `<div class="tt-h"><b>Floor ${g.s.floor} boss</b></div><ul class="tt-l">${mods.map((m) => `<li>${modChips([m])} ${esc(MOD_BY_ID.get(m)!.desc)}</li>`).join('')}</ul>`;
    }
    if (kind === 'cur') {
      const c = CURSORS.find((x) => x.id === id)!;
      const tro = c.trophy ? TROPHIES.find((x) => x.id === c.trophy) : undefined;
      const how = tro ? `${this.cursorOpen(c.id) ? 'Unlocked by' : 'Unlock with'} the trophy <b>${esc(tro.name)}</b>: ${esc(tro.desc)}` : 'Always available.';
      return `<div class="tt-h"><b>${esc(c.name)}</b><span class="tt-own">${this.cursorOpen(c.id) ? (this.game.s.settings.cursor === c.id ? 'equipped' : 'cursor') : 'locked'}</span></div><p class="tt-d">${how}</p>${this.game.s.settings.cursor === c.id ? '<p class="tt-f">Tap again to go back to your best bought blade.</p>' : ''}`;
    }
    if (kind === 'hero') {
      const i = Number(id);
      const now = g.heroIndex() === i;
      return `<div class="tt-h"><b>${now ? 'Your hero' : 'Make hero'}</b></div><p class="tt-d">${now ? `The ${esc(COMPS[i].name)} follows your mouse around the battlefield and fights whatever they reach. Click the ★ again to have no hero.` : `Make the ${esc(COMPS[i].name)} your hero: they'll leave the line and follow your mouse around the battlefield.`}</p>`;
    }
    if (kind === 'fever') return `<div class="tt-h"><b>Rampage</b></div><p class="tt-d">Attack by hand to fill this: click, or just hold the mouse or Space down. When it's full, your attacks deal ×${fmt(g.feverMult())} damage and your party hits ×${fmt(2 * g.rampageParty())} as hard for a few seconds. Keep attacking through it to push the Rampage to ×10; the meter counts down the attacks.</p>`;
    if (kind === 'auto') return `<div class="tt-h"><b>Auto-advance</b></div><p class="tt-d">${g.s.auto ? 'On: you move to the next floor as soon as one is cleared.' : 'Off: you stay on this floor and farm it. Turns back on by itself once your party is much stronger.'}</p>`;
    if (kind === 'dock') {
      const text: Record<string, string> = {
        trophies: `Trophies: ${g.s.trophies.length}/${TROPHIES.length}. Each gives +1% damage.`,
        relics: `Relics: ${g.relicsFound()}/${RELICS.length} found. Bosses drop them.`,
        abyss: (g.canDescend() ? `Descend now for ${fmt(g.pendingSouls())} souls.` : g.descendOpen() ? 'Beat a zone boss to bank souls.' : `The way down opens at the floor ${DESCEND_FLOOR} boss.`) + (g.canAwaken() ? ` Or awaken the Heart for ${fmt(g.pendingStones())} heartstones.` : ''),
        stats: 'Your numbers, and where every bonus comes from.',
        settings: 'Sound, visuals and saves.',
        mute: g.s.settings.muted ? 'Unmute' : 'Mute',
        blade: `Phantom Blade: attacks the front monster for you ${perSec(g.autoRate())} time${g.autoRate() === 1 ? '' : 's'} a second. Shop upgrades, Abyss powers and the Phantom Hilt make it faster.`,
      };
      return `<p class="tt-d">${text[id]}</p>`;
    }
    return '';
  }

  private upgPreview(u: UpgDef): string {
    const g = this.game;
    const e = u.effect;
    let gain = new Decimal(0);
    if (e.t === 'comp') gain = g.compDps(e.comp);
    else if (e.t === 'global') gain = g.baseDps().times(e.pct);
    if (gain.lte(0)) return '';
    return `<p class="tt-gain">≈ +${fmt(gain)} damage/sec</p>`;
  }

  // ---------- news ----------

  private nextNews() {
    const g = this.game;
    const s = { floor: g.s.maxFloor, owned: g.s.owned, depth: g.s.descents, raids: g.s.raids, kills: g.s.kills };
    const pool = NEWS.map((n, i) => [n, i] as const).filter(([n, i]) => i !== this.newsIdx && (!n.when || n.when(s)));
    const specific = pool.filter(([n]) => n.when);
    const from = specific.length && Math.random() < 0.75 ? specific : pool;
    const pick = from[Math.floor(Math.random() * from.length)];
    if (!pick) return;
    this.newsIdx = pick[1];
    const el = this.el.ticker;
    el.classList.remove('in');
    void el.offsetWidth;
    el.textContent = pick[0].text;
    el.classList.add('in');
    this.newsT = 11;
  }

  // ---------- modals ----------

  openModal(name: string) {
    this.modal = name;
    if (name === 'relics') this.newRelics = 0;
    this.el.modalWrap.hidden = false;
    this.renderModal();
  }

  closeModal() {
    this.modal = null;
    this.el.modalWrap.hidden = true;
    this.hideTip();
    this.hooks.sound('close', { vol: 0.4 });
  }

  private renderModal(soft = false) {
    const name = this.modal;
    if (!name) return;
    const g = this.game;
    const head = (title: string, sub = '') => `<header class="m-head"><h2>${title}</h2>${sub ? `<span>${sub}</span>` : ''}<button class="btn icon" data-act="close" aria-label="Close">${G.close()}</button></header>`;
    let html = '';
    if (name === 'trophies') {
      const n = g.s.trophies.length;
      html = head('Trophies', `${n} / ${TROPHIES.length} · +${n}% damage`) + `<div class="tro-grid">${TROPHIES.map((t) => `<span class="tro ${g.hasTrophy(t.id) ? 'got' : ''}" data-tip="tro:${t.id}">${icon(t.icon, 28)}</span>`).join('')}</div>`;
    } else if (name === 'abyss') {
      html = head('The Abyss', `${G.soul()} ${fmt(g.s.souls)} souls · +${fmt(Math.round(g.s.souls * g.soulPower() * 100))}% damage`) + this.tabs('abyss') + this.abyssHtml();
    } else if (name === 'heart') {
      html = head('The Heart', `${G.heart()} ${fmt(g.s.stones)} heartstones · ${g.s.awakens} awakening${g.s.awakens === 1 ? '' : 's'}`) + this.tabs('heart') + this.heartHtml();
    } else if (name === 'relics') {
      html = head('Relics', `${g.relicsFound()} / ${RELICS.length} found · ${g.s.equipped.length} / ${g.relicSlots()} slots`) + this.relicsHtml();
    } else if (name === 'stats' || name === 'party' || name === 'records') {
      html = head('Stats') + this.statTabs(name) + (name === 'stats' ? this.bonusHtml() : name === 'party' ? this.partyHtml() : this.recordsHtml());
    } else if (name === 'settings') {
      const s = g.s.settings;
      const tog = (act: string, on: boolean, label: string) => `<button class="btn toggle ${on ? 'on' : ''}" data-act="${act}">${label}: ${on ? 'On' : 'Off'}</button>`;
      html = head('Options') + `
        <div class="set">
          <label>Effects volume <input type="range" min="0" max="100" value="${Math.round(s.sfxVol * 100)}" data-set="sfxVol"></label>
          <label>Music volume <input type="range" min="0" max="100" value="${Math.round(s.musicVol * 100)}" data-set="musicVol"></label>
          <div class="set-row">${tog('sound', !s.muted, 'Sound')}${tog('music', s.music, 'Music')}${tog('particles', s.particles, 'Particles')}${tog('shake', s.shake, 'Screen shake')}${tog('numbers', s.numbers, 'Damage numbers')}${tog('blood', s.blood, 'Blood')}${tog('cinematics', s.cinematics, 'Zone intros')}
          <button class="btn toggle" data-act="notation">Numbers: ${s.notation === 'short' ? '1.23M' : '1.23e6'}</button></div>
          <h3>Cursor <span class="muted">${CURSORS.filter((c) => this.cursorOpen(c.id)).length} / ${CURSORS.length}</span></h3>
          <div class="cursors">${CURSORS.map((c) => {
            const open = this.cursorOpen(c.id);
            const spr = c.sprite;
            return `<button class="cur ${open ? '' : 'locked'} ${s.cursor === c.id ? 'on' : ''}" data-cursor="${c.id}" data-tip="cur:${c.id}">${spriteFit(spr, 36)}${open ? '' : `<span class="cur-lock">${G.lock()}</span>`}</button>`;
          }).join('')}</div>
          <h3>Save</h3>
          <p class="muted">The game saves itself every few seconds. Copy your save code to move it to another browser.</p>
          <textarea spellcheck="false" placeholder="Paste a save code here to load it"></textarea>
          <div class="set-row"><button class="btn" data-act="export">Copy save code</button><button class="btn" data-act="import">Load save code</button><button class="btn danger" data-act="reset">Wipe save</button></div>
          <p class="credits muted">Art: 0x72 DungeonTileset II, Superdark, Omniboy, Zoltan Kosina, Niji, AnriTool, DevWizard · Sounds: Kenney · Music: Juhani Junkala, Memoraphile, Wolfgang_, Zane Little, The Art Bros, Jonathan So (all CC0)</p>
        </div>`;
    }
    if (soft && html === this.modalKey) return;
    this.modalKey = html;
    this.el.modal.className = `modal pnl m-${name}`;
    this.el.modal.innerHTML = html;
  }

  private abyssHtml(): string {
    const g = this.game;
    const pending = g.pendingSouls();
    const next = g.nextBossSouls();
    // What a descent adds on top of the souls you already have: the number that says whether it's worth it.
    const gain = (pending * g.soulPower()) / (1 + g.s.souls * g.soulPower());
    const advice = gain >= 1 ? `<p class="advice good">A big step. Descending now is a great deal.</p>`
      : gain >= 0.5 ? `<p class="advice good">Worth it: descending now makes you much stronger.</p>`
        : `<p class="advice">Only +${Math.round(gain * 100)}% on top of what you have. Beat another zone boss first for a bigger leap.</p>`;
    const desc = g.canDescend()
      ? `<p>Descending sends you back to the top with your souls, relics, trophies and abyss powers.</p>
         <button class="btn primary big" data-act="descend">Descend for ${G.soul()} ${fmt(pending)} souls</button>
         ${advice}
         <p class="muted">+${fmt(Math.round(pending * g.soulPower() * 100))}% damage forever · banked from the zone bosses you beat this descent · the floor ${next.floor} boss pays ${fmt(next.souls)} more</p>`
      : !g.descendOpen()
        ? `<p>Zone bosses (every 10th floor) pay souls. The way down opens at the <b>floor ${DESCEND_FLOOR}</b> boss.</p>
           <div class="bar"><i style="width:${Math.min(100, (g.s.maxFloor / DESCEND_FLOOR) * 100)}%"></i></div>
           <p class="muted">Deepest this descent: floor ${g.s.maxFloor} · souls banked: ${fmt(pending)}</p>`
        : `<p>Beat a zone boss (every 10th floor) to bank souls for your next descent.</p>
           <p class="muted">The floor ${next.floor} boss pays ${fmt(next.souls)} souls.</p>`;
    const nodes = ABYSS.map((a) => {
      const owned = g.hasAbyss(a.id);
      const avail = g.abyssAvailable(a.id);
      const afford = avail && g.soulsFree() >= a.cost;
      return `<button class="aby ${owned ? 'owned' : avail ? (afford ? 'can' : 'avail') : 'locked'}" data-aby="${a.id}" data-tip="aby:${a.id}" ${owned ? 'disabled' : ''}>
        <span class="aby-ico">${spriteFit(a.icon, 32)}</span><b>${esc(a.name)}</b><small>${owned ? 'Owned' : `${G.soul(1.5)} ${a.cost}`}</small></button>`;
    }).join('');
    return `<div class="descend-box">${desc}</div>
      <h3>Abyss powers <span class="muted">${G.soul(1.5)} ${fmt(g.soulsFree())} to spend</span></h3>
      <div class="aby-grid">${nodes}</div>`;
  }

  private statTabs(on: string) {
    const tab = (id: string, label: string) => `<button class="tab ${on === id ? 'on' : ''}" data-open="${id}">${label}</button>`;
    return `<nav class="tabs">${tab('stats', 'Bonuses')}${tab('party', 'Companions')}${tab('records', 'Records')}</nav>`;
  }

  /** Where every number comes from: each multiplier on its own line, then the total. */
  private bonusHtml(): string {
    const g = this.game;
    const b = g.breakdown();
    const p = b.parts;
    const x = (v: number | Decimal) => (new Decimal(v).gte(1000) ? `×${fmt(v)}` : `×${Math.round(new Decimal(v).toNumber() * 100) / 100}`);
    const pc = (v: number) => `${Math.round(v * 1000) / 10}%`;
    const row = (label: string, value: string, note = '', off = false) => `<tr class="${off ? 'off' : ''}"><th>${label}${note ? `<small>${note}</small>` : ''}</th><td>${value}</td></tr>`;
    const mul = (label: string, v: number | Decimal, note: string, how = '') => {
      const one = new Decimal(v).eq(1);
      return row(label, x(v), one && how ? how : note, one);
    };
    const total = (label: string, value: string) => `<tr class="tot"><th>${label}</th><td>${value}</td></tr>`;
    const table = (title: string, rows: string) => `<section class="bd"><h3>${title}</h3><table>${rows}</table></section>`;
    const relicName = (id: string) => RELIC_BY_ID.get(id)!.name;
    const baseSum = b.baseComp.reduce((a, v) => a + v, 0);
    const buffNames = (k: 'dps' | 'click' | 'gold') => g.s.buffs.filter((u) => u[k] > 1).map((u) => `${u.name} ×${u[k]}`).join(', ');
    const soulsNote = `${fmt(g.s.souls)} souls × ${Math.round(g.soulPower() * 100)}% each`;
    const allRows = (lead: string) =>
      mul(`${lead}Upgrades`, p.upgrades, `+${Math.round((p.upgrades - 1) * 100)}% from tonics in the shop`, 'Tonics in the shop add to this') +
      mul(`${lead}Trophies`, p.trophies, `${g.s.trophies.length} trophies`) +
      mul(`${lead}Souls`, p.souls, soulsNote, 'Descend to earn souls') +
      mul(`${lead}${relicName('shard')}`, p.shard, 'Legendary relic', 'A legendary relic') +
      mul(`${lead}Heart of Fury`, p.fury, `level ${g.heartLv('fury')}`, 'A Heart power (awaken the Heart)');

    const dps = table('Party damage per second',
      row('Companions', fmt(baseSum), 'levels × tier upgrades × synergies (see Companions)') +
      allRows('') +
      mul(relicName('banner'), p.banner, 'Relic', 'A relic') +
      mul('Buffs right now', b.buffDps, buffNames('dps'), 'Rampage, Bloodlust…') +
      total('Damage per second', fmt(g.dps())));

    const click = table('Click damage',
      row('Base', '1') +
      mul('Twin Blades', p.twin, 'Abyss power', 'An abyss power') +
      mul(relicName('whet'), p.whet, 'Relic', 'A relic') +
      mul('Blade upgrades', p.blades, `${g.s.upgrades.filter((id) => id.startsWith('clk')).length} bought`, 'Blades in the shop') +
      row('All-damage bonuses', x(b.all), 'the same upgrades, trophies, souls, shard and fury as above') +
      row('+ Share of party damage', `+${fmt(g.baseDps().times(p.clickDps))}`, `${pc(p.clickDps)} of party damage: 5% base${p.clickDpsUpg ? ` + ${pc(p.clickDpsUpg)} upgrades` : ''}${p.oath ? ` + ${pc(p.oath)} ${relicName('oath')}` : ''}`) +
      mul('Buffs right now', b.buffClick, buffNames('click'), 'Frenzy…') +
      total('Per click', fmt(g.clickDamage())) +
      row('During Rampage', x(g.feverMult()), 'clicks while the Rampage meter is full'));

    const crit = table('Critical hits',
      row('Chance', pc(g.critChance()), `${pc(p.critBase)} base${p.critUpg ? ` + ${pc(p.critUpg)} upgrades` : ''}${p.critRelic ? ` + ${pc(p.critRelic)} ${relicName('hawk')}` : ''}`) +
      row('Damage', x(g.critMult()), `×${p.critMultBase} base${p.critMultUpg > 1 ? ` × ${p.critMultUpg} upgrades` : ''}${p.critMultRelic > 1 ? ` × ${p.critMultRelic} ${relicName('razor')}` : ''}`) +
      row('Cleave', g.cleave() ? pc(g.cleave()) : '—', g.cleave() ? `clicks also hit every other monster${p.cleaveRelic ? ` (${pc(p.cleaveRelic)} from ${relicName('cleaver')})` : ''}` : 'Cleave upgrades and the Headsman\'s Cleaver', !g.cleave()));

    const goldT = table('Gold',
      mul('Upgrades', p.goldUpg, 'tonics in the shop') +
      mul(relicName('purse'), p.goldRelic, 'Relic', 'A relic') +
      mul('Buffs right now', b.buffGold, buffNames('gold'), 'Gold Rush') +
      total('Gold from monsters', x(g.goldMult())));

    const baseTime = g.hasAbyss('patience') ? 45 : 30;
    const glass = Math.min(30, 3 * g.relic('time'));
    const bane = g.heartLv('bane');
    const boss = table('Bosses',
      mul(`Damage to bosses (${relicName('slayer')})`, 1 + g.relic('boss'), 'Relic', 'A relic') +
      row('Time to beat a boss', `${baseTime + glass}s`, `${baseTime}s${g.hasAbyss('patience') ? ' (Patient Hunter)' : ''}${glass ? ` + ${glass}s ${relicName('glass')}` : ''} · Enraged halves it, Giant adds half`) +
      row('Armored blocks', pc(g.armor()), `of companion damage${g.relic('pierce') ? ` (${relicName('pick')} helps)` : ''}`) +
      row('Regenerating heals', `${pc(g.regen())}/s`, g.relic('rot') ? `${relicName('rot')} helps` : 'of its health') +
      row('Modifier strength', pc(g.modBite()), bane ? `Warden's Bane level ${bane}` : 'Warden\'s Bane (a Heart power) weakens them', !bane));

    const next = g.nextBossSouls();
    const offline = g.hasAbyss('night') ? 1 : g.hasAbyss('pulse') ? 0.5 : 0.25;
    const souls = table('Souls and the Heart',
      row('Each soul gives', `+${Math.round(g.soulPower() * 100)}% damage`, g.hasAbyss('crown') ? 'Crown of the Deep' : g.hasAbyss('roots') ? 'Deep Roots' : 'more with Deep Roots / Crown of the Deep') +
      row('Souls', fmt(g.s.souls), `${fmt(g.soulsFree())} unspent`) +
      row('Banked this descent', fmt(g.pendingSouls()), 'paid out when you descend') +
      row(`Next zone boss (floor ${next.floor})`, `+${fmt(next.souls)}`, 'souls when beaten') +
      mul('Soul gain', g.soulGainMult(), `${g.relic('souls') ? `${relicName('cage')} ` : ''}${g.heartLv('siphon') ? `Soul Siphon ${g.heartLv('siphon')}` : ''}`.trim(), 'Soul Cage (relic), Soul Siphon (Heart)') +
      row('Heartstones', fmt(g.s.stones), `${g.s.awakens} awakening${g.s.awakens === 1 ? '' : 's'}`) +
      row('Offline speed', pc(offline), offline < 1 ? 'Restless Dead / Endless Night raise it' : 'Endless Night'));

    return `<div class="bd-grid">${dps}${click}${crit}${goldT}${boss}${souls}</div>`;
  }

  private partyHtml(): string {
    const g = this.game;
    const b = g.breakdown();
    const p = b.parts;
    const total = g.baseDps();
    const x = (v: number | Decimal) => (new Decimal(v).gte(1000) ? `×${fmt(v)}` : `×${Math.round(new Decimal(v).toNumber() * 100) / 100}`);
    const rows = COMPS.map((c, i) => {
      const lv = g.s.owned[i];
      if (!lv) return '';
      return `<tr><th><span class="bd-comp">${charFit(c.sprite, 22)}${esc(c.name)}</span></th><td>${lv}</td><td>${fmt(c.dps)}</td><td>${x(p.tier[i])}</td><td>${x(p.syn[i])}</td><td>${fmt(g.compDps(i))}</td><td>${total.gt(0) ? g.compDps(i).div(total).times(100).toNumber().toFixed(1) : 0}%</td></tr>`;
    }).join('');
    return `<p class="muted bd-help">Each companion: level × base damage × tier upgrades × synergies, then every all-damage bonus (${x(b.all.times(p.banner))} right now) on top.</p>
      <section class="bd wide"><table><thead><tr><th>Companion</th><td>Level</td><td>Base</td><td>Tiers</td><td>Synergy</td><td>Damage/sec</td><td>Share</td></tr></thead>${rows || '<tr><th>Nobody hired yet.</th></tr>'}</table></section>`;
  }

  private recordsHtml(): string {
    const g = this.game;
    const s = g.s;
    const rows: [string, string][] = [
      ['Floor', `${s.floor} (deepest this descent ${s.maxFloor})`], ['Deepest floor cleared', fmt(s.bestCleared)], ['Kills per second', g.killRate.toFixed(1)],
      ['Gold this descent', fmt(s.runGold)], ['Gold all time', fmt(s.totalGold)], ['Monsters killed', fmt(s.kills)], ['Bosses killed', fmt(s.bosses)],
      ['Clicks', fmt(s.clicks)], ['Critical hits', fmt(s.crits)], ['Treasure goblins', fmt(s.raids)], ['Goblin Vaults', fmt(s.vaults)], ['Rampages', fmt(s.fevers)], ['Clutch kills', fmt(s.clutches)], ['Champions slain', fmt(s.champions)],
      ['Descents', fmt(s.descents)], ['Awakenings', fmt(s.awakens)], ['Trophies', `${s.trophies.length} / ${TROPHIES.length}`], ['Relics', `${g.relicsFound()} / ${RELICS.length}`],
      ['This descent', duration(s.runTime)], ['Time played', duration(s.playTime)],
    ];
    return `<dl class="stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  }

  private tabs(on: 'abyss' | 'heart') {
    const g = this.game;
    const hot = g.canAwaken() ? ' hot' : '';
    return `<nav class="tabs">
      <button class="tab ${on === 'abyss' ? 'on' : ''}" data-open="abyss">${G.soul()} Descend</button>
      <button class="tab ${on === 'heart' ? 'on' : ''}${hot}" data-open="heart">${G.heart()} Awaken</button>
    </nav>`;
  }

  private heartHtml(): string {
    const g = this.game;
    const pending = g.pendingStones();
    const best = Math.max(g.s.cycleBest, g.s.maxFloor);
    const box = g.canAwaken()
      ? `<p>Awakening gives up your <b>souls</b> and <b>abyss powers</b> for heartstones. Relics, trophies and companions stay.</p>
         <button class="btn primary big heart-go" data-act="awaken">Awaken for ${G.heart()} ${fmt(pending)} heartstones</button>
         <p class="muted">Paid for your deepest floor since the last awakening (floor ${best}). Every floor deeper pays about 2% more.</p>`
      : `<p>Reach <b>floor ${AWAKEN_FLOOR}</b> to awaken the Heart. The deeper you get first, the more heartstones it pays.</p>
         <div class="bar heart-bar"><i style="width:${Math.min(100, (best / AWAKEN_FLOOR) * 100)}%"></i></div>
         <p class="muted">Deepest since you last awakened: floor ${best}</p>`;
    const nodes = HEART.map((h) => {
      const lv = g.heartLv(h.id);
      const maxed = g.heartMaxed(h.id);
      const cost = maxed ? 0 : g.heartCost(h.id);
      const afford = !maxed && g.s.stones >= cost;
      return `<button class="aby hrt ${maxed ? 'owned' : afford ? 'can' : 'avail'}" data-heart="${h.id}" data-tip="heart:${h.id}" ${maxed ? 'disabled' : ''}>
        <span class="aby-ico">${spriteFit(h.icon, 32)}</span><b>${esc(h.name)}${lv ? ` <i class="lv">${lv}</i>` : ''}</b><small>${maxed ? 'Maxed' : `${G.heart(1.5)} ${fmt(cost)}`}</small></button>`;
    }).join('');
    return `<div class="descend-box heart-box">${box}</div>
      <h3>Heart powers <span class="muted">${G.heart(1.5)} ${fmt(g.s.stones)} to spend</span></h3>
      <div class="aby-grid">${nodes}</div>`;
  }

  private relicsHtml(): string {
    const g = this.game;
    const slots = Array.from({ length: g.relicSlots() }, (_, i) => {
      const id = g.s.equipped[i];
      if (!id) return `<span class="slot empty"><small>Empty</small></span>`;
      const d = RELIC_BY_ID.get(id)!;
      return `<button class="slot" data-relic="${id}" data-tip="rel:${id}" style="--rc:${RARITY_COLORS[d.rarity]}">${spriteFit(d.icon, 40)}<i class="lv">${g.relicLv(id)}</i></button>`;
    }).join('');
    const cards = RELICS.map((d) => {
      const lv = g.relicLv(d.id);
      if (!lv) return `<span class="rel unknown" data-tip="rel:${d.id}" style="--rc:${RARITY_COLORS[d.rarity]}">${spriteFit(d.icon, 32)}<b>???</b><small>${RARITY[d.rarity]}</small></span>`;
      const on = g.s.equipped.includes(d.id);
      return `<button class="rel ${on ? 'on' : ''}" data-relic="${d.id}" data-tip="rel:${d.id}" style="--rc:${RARITY_COLORS[d.rarity]}">
        ${spriteFit(d.icon, 32)}<b>${esc(d.name)}${starsOf(lv)}</b><small>Level ${lv}${on ? ' · equipped' : ''}</small></button>`;
    }).join('');
    const counters = MODS.map((m) => `<li>${modChips([m.id])} ${esc(m.desc)}</li>`).join('');
    return `<div class="slots">${slots}</div>
      <p class="muted rel-help">Bosses drop relics the first time you beat them each run: a quarter of zone bosses, some mid-bosses, and always a zone boss deeper than you've been before. Finding one again levels it up. Tap a relic to slot it in or out.</p>
      <div class="rel-grid">${cards}</div>
      <h3>Boss modifiers</h3>
      <ul class="mods-list">${counters}</ul>`;
  }

  /** The reward card that slides up when a boss drops a relic. */
  private showLoot(id: string, lv: number, equipped: boolean, star = 0) {
    const d = RELIC_BY_ID.get(id)!;
    if (this.modal !== 'relics') this.newRelics++;
    const el = this.el.loot;
    el.hidden = false;
    el.style.setProperty('--rc', RARITY_COLORS[d.rarity]);
    el.className = `loot r${d.rarity}${star ? ' starred' : ''}`;
    const head = star ? `Relic star! ${'★'.repeat(star)} · level ${lv}` : lv === 1 ? `New ${RARITY[d.rarity]} relic` : `${RARITY[d.rarity]} relic · level ${lv}`;
    el.innerHTML = `<span class="loot-ico">${spriteFit(d.icon, 48)}</span><span class="loot-t"><small>${head}</small><b>${esc(d.name)}${starsOf(lv)}</b><em>${esc(relicText(d, lv))}${star ? ' (a quarter stronger)' : ''}${lv === 1 && !equipped ? ' · equip it in Relics' : ''}</em></span>`;
    void el.offsetWidth;
    el.classList.add('in');
    this.hooks.sound(d.rarity >= 2 || star ? 'drop4' : 'drop2', { vol: 0.7 });
    clearTimeout(this.lootTimer);
    this.lootTimer = window.setTimeout(() => {
      el.classList.remove('in');
      this.lootTimer = window.setTimeout(() => (el.hidden = true), 400);
    }, 3600);
  }

  private renderAwakenConfirm() {
    const g = this.game;
    this.modal = 'confirm';
    this.modalKey = 'confirm';
    this.el.modal.className = 'modal pnl m-confirm';
    this.el.modal.innerHTML = `<header class="m-head"><h2>Awaken?</h2><button class="btn icon" data-act="close">${G.close()}</button></header>
      <div class="confirm heart-confirm">
        <p>Your souls (<b>${G.soul()} ${fmt(g.s.souls)}</b>) and abyss powers${g.heartLv('echo') ? ' (except the cheap ones)' : ''} are given to the Heart, along with this descent.</p>
        <p>You gain <b>${G.heart()} ${fmt(g.pendingStones())} heartstones</b> to spend on Heart powers, forever.</p>
        <p class="muted">Relics, trophies, heartstones and the companions you've met all stay.</p>
        ${COMPS.some((c) => c.heart === g.s.awakens + 1) ? `<p class="omen">Someone new will answer the Heart…</p>` : ''}
        <div class="set-row"><button class="btn" data-act="heartBack">Not yet</button><button class="btn primary big" data-act="awakenGo">Awaken</button></div>
      </div>`;
  }

  private doAwaken() {
    const g = this.game;
    this.descending = true;
    this.modal = null;
    this.el.modalWrap.hidden = true;
    const c = this.el.curtain;
    c.hidden = false;
    c.className = 'curtain in heart';
    c.querySelector('b')!.textContent = `Awakening ${g.s.awakens + 1}`;
    c.querySelector('span')!.textContent = 'The Heart beats. Everything starts again, stronger.';
    this.hooks.sound('awaken', { vol: 0.9 });
    setTimeout(() => {
      g.awaken();
      this.shown = new Decimal(0);
      this.rowCache.fill('');
      this.upgKey = '';
      this.floorKey = '';
      this.hooks.save();
    }, 1100);
    setTimeout(() => {
      c.className = 'curtain out heart';
      this.descending = false;
      this.hooks.sound('drop4', { vol: 0.7 });
      // Straight to the shop for the new heartstones.
      this.openModal('heart');
    }, 2600);
    setTimeout(() => (c.hidden = true), 3600);
  }

  private renderDescendConfirm() {
    const g = this.game;
    const pending = g.pendingSouls();
    this.modal = 'confirm';
    this.modalKey = 'confirm';
    this.el.modal.className = 'modal pnl m-confirm';
    this.el.modal.innerHTML = `<header class="m-head"><h2>Descend?</h2><button class="btn icon" data-act="close">${G.close()}</button></header>
      <div class="confirm">
        <p>Your gold, companions and upgrades stay behind. You start again from the top. Relics and trophies come with you.</p>
        <p>You gain the <b>${G.soul()} ${fmt(pending)} souls</b> you banked from bosses: +${fmt(Math.round(pending * g.soulPower() * 100))}% damage, forever.</p>
        ${COMPS.some((c) => c.depth === g.s.descents + 1) ? `<p class="omen">Someone new waits for you down there…</p>` : ''}
        <div class="set-row"><button class="btn" data-act="abyssBack">Not yet</button><button class="btn primary big" data-act="descendGo">Descend</button></div>
      </div>`;
  }

  private doDescend() {
    const g = this.game;
    this.descending = true;
    this.modal = null;
    this.el.modalWrap.hidden = true;
    const c = this.el.curtain;
    c.hidden = false;
    c.className = 'curtain in';
    c.querySelector('b')!.textContent = `Descent ${g.s.descents + 1}`;
    c.querySelector('span')!.textContent = 'You go deeper. It remembers you.';
    this.hooks.sound('descend', { vol: 0.8 });
    setTimeout(() => {
      g.descend();
      this.shown = new Decimal(0);
      this.rowCache.fill('');
      this.upgKey = '';
      this.floorKey = '';
      this.hooks.save();
    }, 1100);
    setTimeout(() => {
      c.className = 'curtain out';
      this.descending = false;
      this.hooks.sound('drop4', { vol: 0.7 });
      // Straight to the shop for the new souls.
      this.openModal('abyss');
    }, 2600);
    setTimeout(() => (c.hidden = true), 3600);
  }

  showOffline(o: OfflineSummary) {
    this.modal = 'offline';
    this.el.modalWrap.hidden = false;
    this.el.modal.className = 'modal pnl m-offline';
    const pace = o.pct < 1 ? ` at ${Math.round(o.pct * 100)}% speed` : '';
    const kills = `${fmt(o.kills)} monster${o.kills === 1 ? '' : 's'}`;
    this.el.modal.innerHTML = `<header class="m-head"><h2>Welcome back</h2></header>
      <div class="offline">
        <p>You were away for <b>${duration(o.seconds)}</b>.</p>
        <p>Your party kept fighting${pace}, killed <b>${kills}</b>${o.floor ? ` and reached <b>floor ${o.floor}</b>` : ''}, and looted</p>
        <div class="offline-v">${sprite('coin', 5)}<b>${fmt(o.gold)}</b></div>
        <p class="muted">gold</p>
        <button class="btn primary big" data-act="close">Collect</button>
      </div>`;
  }

}
