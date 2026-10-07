import type { CardDef } from '../game/data.ts';
import { CARD_FRAME } from '../render/cards.ts';
import { cardArt, cardCanvas, spriteFrames } from './px.ts';

/**
 * The kid's binder: a binder for each color a card comes in (plain, then each lap's tint) and a gold one of each,
 * pages of 3×3 numbered pockets, two pages to a spread. Tap a card to take it out and look at it properly: the
 * monster on its own dungeon floor, how many you have of it in this color, where it lives.
 */

const PER_PAGE = 9;
const PER_SPREAD = PER_PAGE * 2;
/** When new cards start landing after a spread opens, and how far apart. */
const SLAM_FROM_MS = 420;
const SLAM_GAP_MS = 260;
/** The moment in the slam where the card hits the pocket. */
const SLAM_HIT_MS = 250;
/** The pause after a page's cards have landed before turning to the next page (or color) with new ones. */
const TOUR_PAUSE_MS = 650;

type BinderSound = 'open' | 'close' | 'click' | 'card' | 'drop2';

export interface BinderCard {
  def: CardDef;
  /** "Monster", "Boss", "Zone boss", "Goblin". */
  kind: string;
  /** Floor tile it stands on in the big picture (its zone's floor). */
  floor: string;
  where: string[];
  /** Found since you last looked. */
  /** The versions that came in since you last looked, as `lap:gold` ("1:0" is a plain Corrupted copy). */
  fresh: string[];
  /** Copies in each color (by lap), plain and gold. */
  n: number[];
  gold: number[];
  /** The first color it can come in (the later laps' newcomers have no plain copy), and whether it comes in gold. */
  fromLap: number;
  canGold: boolean;
  /** How you got your first one, and your first gold one: "First found on kill #1,930" or "Traded from Dan". */
  first: { plain: string; gold: string };
}

/** A color you can have binders for: its name and tint. */
export interface BinderColor {
  name: string;
  tint: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const no = (i: number) => `#${String(i + 1).padStart(3, '0')}`;

export class Binder {
  readonly el = document.createElement('div');
  private spread = 0;
  private detail: number | null = null;
  private lap = 0;
  private gold = false;
  private cards: BinderCard[];
  private colors: BinderColor[];
  private onClose: () => void;
  private sound: (name: BinderSound) => void;
  /** New cards that have already slammed into their pockets (they keep their NEW tag until the binder closes). */
  private landed = new Set<string>();
  private timers: number[] = [];
  /** Turning to each page with new cards on its own, until you turn a page yourself. */
  private touring = true;

  constructor(host: HTMLElement, cards: BinderCard[], colors: BinderColor[], sound: (name: BinderSound) => void, onClose: () => void) {
    this.cards = cards;
    this.colors = colors;
    this.sound = sound;
    this.onClose = onClose;
    this.el.className = 'bnd';
    // Open on the first page with new cards, in its color's binder.
    const stop = this.nextStop();
    if (stop) this.goTo(stop);
    host.appendChild(this.el);
    this.el.addEventListener('click', this.onClick);
    addEventListener('keydown', this.onKey, true);
    this.render();
  }

  private get spreads() {
    return Math.ceil(this.cards.length / PER_SPREAD);
  }

  /** Can this card come in the color on view? */
  private exists(i: number, lap = this.lap, gold = this.gold) {
    const c = this.cards[i];
    return lap >= c.fromLap && (!gold || c.canGold);
  }

  /** How many of this card you have in the color on view. */
  private count(i: number, lap = this.lap, gold = this.gold) {
    const c = this.cards[i];
    return (gold ? c.gold : c.n)[lap] ?? 0;
  }

  private has(i: number, lap = this.lap, gold = this.gold) {
    return this.count(i, lap, gold) > 0;
  }

  private isFresh(i: number, lap = this.lap, gold = this.gold) {
    return this.cards[i].fresh.includes(`${lap}:${gold ? 1 : 0}`);
  }

  close() {
    for (const t of this.timers) clearTimeout(t);
    removeEventListener('keydown', this.onKey, true);
    this.el.remove();
    this.onClose();
  }

  private flip(by: number) {
    this.touring = false;
    const to = Math.max(0, Math.min(this.spreads - 1, this.spread + by));
    if (to === this.spread) return;
    this.spread = to;
    this.sound('click');
    this.render();
  }

  private show(i: number | null) {
    this.touring = false;
    this.detail = i;
    this.sound(i === null ? 'close' : 'card');
    this.render();
  }

  /** Switch to another color's binder (or the gold one), staying on the same card or spread. */
  private view(lap: number, gold: boolean) {
    this.touring = false;
    this.lap = lap;
    this.gold = gold;
    this.sound('click');
    this.render();
  }

  /** Step through the cards you have in this color, from the one on show. */
  private next(by: number) {
    if (this.detail === null) return;
    const got = this.cards.map((_, i) => (this.has(i) || i === this.detail ? i : -1)).filter((i) => i >= 0);
    const at = got.indexOf(this.detail);
    const to = got[(at + by + got.length) % got.length];
    this.detail = to;
    this.spread = Math.floor(to / PER_SPREAD);
    this.sound('click');
    this.render();
  }

  private onClick = (e: MouseEvent) => {
    e.stopPropagation();
    const t = e.target as HTMLElement;
    const btn = t.closest<HTMLElement>('[data-bd]');
    const act = btn?.dataset.bd;
    if (act === 'prev') this.flip(-1);
    else if (act === 'next') this.flip(1);
    else if (act === 'close') this.close();
    else if (act === 'back') this.show(null);
    else if (act === 'cprev') this.next(-1);
    else if (act === 'cnext') this.next(1);
    else if (act === 'lap') this.view(Number(btn!.dataset.l), this.gold);
    else if (act === 'gold') this.view(this.lap, !this.gold);
    else if (act === 'card') this.show(Number(t.closest<HTMLElement>('[data-i]')!.dataset.i));
  };

  private onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'a', 'd', 'Escape', 'Backspace', 'x'].includes(k)) return;
    e.preventDefault();
    e.stopPropagation();
    if (k === 'Escape' || k === 'Backspace' || k === 'x') {
      if (this.detail !== null) this.show(null);
      else this.close();
      return;
    }
    const by = k === 'ArrowLeft' || k === 'a' ? -1 : 1;
    if (this.detail !== null) this.next(by);
    else this.flip(by);
  };

  /** The color tabs across the top, each with how much of that binder you've filled, and the gold toggle. */
  private tabs() {
    const filled = (lap: number) => {
      const can = this.cards.filter((c) => lap >= c.fromLap && (!this.gold || c.canGold));
      const got = can.filter((c) => ((this.gold ? c.gold : c.n)[lap] ?? 0) > 0);
      return `${got.length}/${can.length}`;
    };
    const anyNew = (lap: number, gold: boolean) => this.cards.some((_, i) => this.isFresh(i, lap, gold));
    const tabs = this.colors.map((c, l) => `<button class="bnd-tab${l === this.lap ? ' on' : ''}${anyNew(l, this.gold) ? ' new' : ''}" data-bd="lap" data-l="${l}" style="--lc:${c.tint}"><i></i>${esc(c.name)} <em>${filled(l)}</em></button>`).join('');
    return `<div class="bnd-tabs">${tabs}${this.goldSwitch(anyNew(this.lap, !this.gold))}</div>`;
  }

  private goldSwitch(otherNew = false) {
    return `<button class="bnd-gold${this.gold ? ' on' : ''}${otherNew ? ' new' : ''}" data-bd="gold" role="switch" aria-checked="${this.gold}">Gold<i></i></button>`;
  }

  private thumb(c: BinderCard) {
    return cardArt(c.def, 64, c.def.id === 'rainbow-goblin' ? 'rainbow' : '', this.lap);
  }

  private render() {
    if (this.detail !== null) return this.renderCard(this.detail);
    const from = this.spread * PER_SPREAD;
    const page = (start: number) => {
      const pockets = Array.from({ length: PER_PAGE }, (_, k) => {
        const i = start + k;
        const c = this.cards[i];
        if (!c) return '<i class="bnd-pocket none"></i>';
        if (!this.exists(i)) return this.elsewhere(c);
        if (!this.has(i)) return `<i class="bnd-pocket"><small>${no(i)}</small></i>`;
        const key = this.key(i);
        const fresh = this.isFresh(i);
        const slam = fresh && !this.landed.has(key);
        const cls = `bnd-pocket got${this.gold ? ' gold' : ''}${fresh ? ' fresh' : ''}${slam ? ' slam' : ''}`;
        const style = `--fc:${this.gold ? CARD_FRAME.gold : CARD_FRAME[c.def.kind]}${slam ? `;--wait:${this.slamAt(i)}ms` : ''}`;
        return `<button class="${cls}" style="${style}" data-bd="card" data-i="${i}" aria-label="${esc(c.def.name)}">${this.thumb(c)}${fresh ? '<em class="bnd-new">NEW</em>' : ''}</button>`;
      });
      return `<div class="bnd-page">${pockets.join('')}</div>`;
    };
    const last = this.spreads - 1;
    this.landNew(from);
    this.el.innerHTML = `
      ${this.tabs()}
      <div class="bnd-spread">${page(from)}<div class="bnd-rings"><i></i><i></i><i></i></div>${page(from + PER_PAGE)}</div>
      <div class="bnd-nav">
        <button data-bd="prev" ${this.spread ? '' : 'disabled'} aria-label="Previous pages">◀</button>
        <span>${this.spread * 2 + 1}–${this.spread * 2 + 2} / ${last * 2 + 2}</span>
        <button data-bd="next" ${this.spread < last ? '' : 'disabled'} aria-label="Next pages">▶</button>
      </div>
      <button class="bnd-x" data-bd="close" aria-label="Close the binder">✕</button>`;
  }

  /** A slot for a card that doesn't come in this binder's color: says where it does (without naming colors you haven't reached). */
  private elsewhere(c: BinderCard) {
    if (this.gold && !c.canGold) return '<i class="bnd-pocket none"><small>No gold</small></i>';
    const from = this.colors[c.fromLap];
    return from ? `<i class="bnd-pocket none" style="--lc:${from.tint}"><i></i><small>From ${esc(from.name)}</small></i>` : '<i class="bnd-pocket none"><small>Found deeper</small></i>';
  }

  /** A card in the binder on view: the same card lands separately in each color's binder. */
  private key(i: number, lap = this.lap, gold = this.gold) {
    return `${i}:${lap}:${gold ? 1 : 0}`;
  }

  /** New cards on a spread waiting to land, in order. */
  private queue(from: number, lap = this.lap, gold = this.gold) {
    return this.cards
      .slice(from, from + PER_SPREAD)
      .map((_, k) => from + k)
      .filter((i) => this.isFresh(i, lap, gold) && this.exists(i, lap, gold) && this.has(i, lap, gold) && !this.landed.has(this.key(i, lap, gold)));
  }

  private goTo(stop: { lap: number; gold: boolean; spread: number }) {
    this.lap = stop.lap;
    this.gold = stop.gold;
    this.spread = stop.spread;
  }

  /** The next page with new cards still to land: colors in order, plain before gold. */
  private nextStop() {
    for (const gold of [false, true]) {
      for (let lap = 0; lap < this.colors.length; lap++) {
        for (let spread = 0; spread < this.spreads; spread++) if (this.queue(spread * PER_SPREAD, lap, gold).length) return { lap, gold, spread };
      }
    }
    return null;
  }

  /** Where in the line of new cards on this spread a card lands. */
  private slamAt(i: number) {
    return SLAM_FROM_MS + this.queue(this.spread * PER_SPREAD).indexOf(i) * SLAM_GAP_MS;
  }

  /** New cards on this spread slam into their pockets one by one: a thud and a jolt of the page as each lands. */
  private landNew(from: number) {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.queue(from).forEach((i, n) => {
      const key = this.key(i);
      this.timers.push(window.setTimeout(() => {
        this.landed.add(key);
        this.sound('drop2');
        const spread = this.el.querySelector<HTMLElement>('.bnd-spread');
        spread?.classList.remove('thud');
        void spread?.offsetWidth;
        spread?.classList.add('thud');
      }, SLAM_FROM_MS + n * SLAM_GAP_MS + SLAM_HIT_MS));
    });
    const lands = this.queue(from).length;
    if (!lands) return;
    this.timers.push(window.setTimeout(() => {
      const stop = this.touring && this.detail === null ? this.nextStop() : null;
      if (!stop) return;
      this.goTo(stop);
      this.sound('click');
      this.render();
    }, SLAM_FROM_MS + (lands - 1) * SLAM_GAP_MS + SLAM_HIT_MS + TOUR_PAUSE_MS));
  }

  private renderCard(i: number) {
    const c = this.cards[i];
    const n = this.count(i);
    const frame = this.gold ? CARD_FRAME.gold : CARD_FRAME[c.def.kind];
    // One dot per color: filled if you have it (in gold, on the gold binder); tap one to see that version.
    const dots = this.colors.map((col, l) => {
      const owned = ((this.gold ? c.gold : c.n)[l] ?? 0) > 0;
      const can = l >= c.fromLap && (!this.gold || c.canGold);
      return `<button class="${owned ? 'on' : ''}${l === this.lap ? ' at' : ''}" data-bd="lap" data-l="${l}" style="--lc:${col.tint}" ${can ? '' : 'disabled'} aria-label="${esc(col.name)}"></button>`;
    }).join('');
    const colorsFound = this.colors.filter((_, l) => ((this.gold ? c.gold : c.n)[l] ?? 0) > 0).length;
    const where = c.where.length ? c.where.map((w) => `<li>${esc(w)}</li>`).join('') : '<li>Turns up anywhere</li>';
    const title = `${this.gold ? 'Gold ' : ''}${this.lap ? `${this.colors[this.lap].name} ` : ''}${c.def.name}`;
    this.el.innerHTML = `
      <div class="bnd-detail">
        <div class="bnd-card${this.gold && n ? ' gold' : ''}${n ? '' : ' missing'}" style="--fc:${frame}">
          <b class="bnd-name">${esc(title)}</b>
          <canvas class="bnd-art" width="64" height="48"></canvas>
          <span class="bnd-type">${esc(c.kind)}<em>${no(i)}</em></span>
        </div>
        ${c.canGold ? this.goldSwitch() : ''}
        <div class="bnd-info">
          <small>You have <b class="bnd-count">${n ? `×${n}` : 'none yet'}</b></small>
          <div><small>Colors ${colorsFound}/${this.colors.length}</small><div class="bnd-laps">${dots}</div></div>
          <div><small>Lives in</small><ul>${where}</ul></div>
          ${n && !this.lap && (this.gold ? c.first.gold : c.first.plain) ? `<p class="bnd-first">${esc(this.gold ? c.first.gold : c.first.plain)}</p>` : ''}
        </div>
      </div>
      <div class="bnd-nav">
        <button data-bd="cprev" aria-label="Previous card">◀</button>
        <button data-bd="back" class="bnd-back">Back to binder</button>
        <button data-bd="cnext" aria-label="Next card">▶</button>
      </div>`;
    this.paint(this.el.querySelector('canvas')!, c, n > 0);
  }

  /** The monster standing on a patch of its own dungeon floor (a dark shape until you have this version). */
  private paint(canvas: HTMLCanvasElement, c: BinderCard, owned: boolean) {
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const tile = spriteFrames(c.floor);
    if (tile) {
      const f = tile.frames[0];
      for (let y = 0; y < canvas.height; y += f.h) for (let x = 0; x < canvas.width; x += f.w) ctx.drawImage(tile.img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
    } else {
      ctx.fillStyle = '#2a2030';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // A soft pool of light under the monster.
    const g = ctx.createRadialGradient(32, 34, 2, 32, 34, 30);
    g.addColorStop(0, 'rgba(255, 230, 170, 0.35)');
    g.addColorStop(1, 'rgba(10, 6, 14, 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const art = cardCanvas(c.def, this.lap);
    if (!art) return;
    const k = Math.max(1, Math.floor(Math.min(56 / art.width, 42 / art.height)));
    const w = art.width * k;
    const h = art.height * k;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(Math.round(32 - w * 0.35), 44, Math.round(w * 0.7), 2);
    if (!owned) ctx.filter = 'brightness(0) opacity(0.75)';
    ctx.drawImage(art, Math.round(32 - w / 2), 45 - h, w, h);
    ctx.filter = 'none';
  }
}
