import { spriteFrames } from './px.ts';

/**
 * The kid's binder: pages of 3×3 card pockets, two pages to a spread, every card in its numbered pocket. Tap a card
 * to take it out and look at it properly: the monster on its own dungeon floor, how many you have, where it lives.
 */

const PER_PAGE = 9;
const PER_SPREAD = PER_PAGE * 2;

export interface BinderCard {
  id: string;
  name: string;
  /** "Monster", "Boss", "Zone boss", "Goblin". */
  kind: string;
  color: string;
  got: boolean;
  gold: boolean;
  fresh: boolean;
  /** The pocket's thumbnail (an <img>). */
  thumb: string;
  /** The monster itself, for the big picture. */
  art: HTMLCanvasElement | null;
  /** Floor tile it stands on in the big picture (its zone's floor). */
  floor: string;
  where: string[];
  copies: number;
  goldCopies: number;
  /** Which laps' colours you've found it in. */
  laps: { color: string; got: boolean }[];
  firstKill: number | null;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const no = (i: number) => `#${String(i + 1).padStart(3, '0')}`;

export class Binder {
  readonly el = document.createElement('div');
  private spread = 0;
  private detail: number | null = null;
  private cards: BinderCard[];
  private onClose: () => void;
  private sound: (name: 'open' | 'close' | 'click' | 'card') => void;

  constructor(host: HTMLElement, cards: BinderCard[], sound: (name: 'open' | 'close' | 'click' | 'card') => void, onClose: () => void) {
    this.cards = cards;
    this.sound = sound;
    this.onClose = onClose;
    this.el.className = 'bd';
    // Open on the first new card's spread, if any came in.
    const fresh = cards.findIndex((c) => c.fresh);
    this.spread = fresh >= 0 ? Math.floor(fresh / PER_SPREAD) : 0;
    host.appendChild(this.el);
    this.el.addEventListener('click', this.onClick);
    addEventListener('keydown', this.onKey, true);
    this.render();
  }

  private get spreads() {
    return Math.ceil(this.cards.length / PER_SPREAD);
  }

  close() {
    removeEventListener('keydown', this.onKey, true);
    this.el.remove();
    this.onClose();
  }

  private flip(by: number) {
    const to = Math.max(0, Math.min(this.spreads - 1, this.spread + by));
    if (to === this.spread) return;
    this.spread = to;
    this.sound('click');
    this.render();
  }

  private show(i: number | null) {
    this.detail = i;
    this.sound(i === null ? 'close' : 'card');
    this.render();
  }

  /** Step through the cards you have, from the one on show. */
  private next(by: number) {
    if (this.detail === null) return;
    const got = this.cards.map((c, i) => (c.got ? i : -1)).filter((i) => i >= 0);
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
    const act = t.closest<HTMLElement>('[data-bd]')?.dataset.bd;
    if (act === 'prev') this.flip(-1);
    else if (act === 'next') this.flip(1);
    else if (act === 'close') this.close();
    else if (act === 'back') this.show(null);
    else if (act === 'cprev') this.next(-1);
    else if (act === 'cnext') this.next(1);
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

  private render() {
    if (this.detail !== null) return this.renderCard(this.detail);
    const from = this.spread * PER_SPREAD;
    const page = (start: number) => {
      const pockets = Array.from({ length: PER_PAGE }, (_, k) => {
        const i = start + k;
        const c = this.cards[i];
        if (!c) return '<i class="bd-pocket none"></i>';
        if (!c.got) return `<i class="bd-pocket"><small>${no(i)}</small></i>`;
        return `<button class="bd-pocket got${c.gold ? ' gold' : ''}${c.fresh ? ' fresh' : ''}" data-bd="card" data-i="${i}" style="--fc:${c.color};--d:${k}" aria-label="${esc(c.name)}">${c.thumb}</button>`;
      });
      return `<div class="bd-page">${pockets.join('')}</div>`;
    };
    const last = this.spreads - 1;
    this.el.innerHTML = `
      <div class="bd-spread">${page(from)}<div class="bd-rings"><i></i><i></i><i></i></div>${page(from + PER_PAGE)}</div>
      <div class="bd-nav">
        <button data-bd="prev" ${this.spread ? '' : 'disabled'} aria-label="Previous pages">◀</button>
        <span>${this.spread * 2 + 1}–${this.spread * 2 + 2} / ${last * 2 + 2}</span>
        <button data-bd="next" ${this.spread < last ? '' : 'disabled'} aria-label="Next pages">▶</button>
      </div>
      <button class="bd-x" data-bd="close" aria-label="Close the binder">✕</button>`;
  }

  private renderCard(i: number) {
    const c = this.cards[i];
    const laps = c.laps.map((l) => `<i class="${l.got ? 'on' : ''}" style="--lc:${l.color}"></i>`).join('');
    const where = c.where.length ? c.where.map((w) => `<li>${esc(w)}</li>`).join('') : '<li>Turns up anywhere</li>';
    this.el.innerHTML = `
      <div class="bd-detail">
        <div class="bd-card${c.gold ? ' gold' : ''}" style="--fc:${c.color}">
          <b class="bd-name">${esc(c.name)}</b>
          <canvas class="bd-art" width="64" height="48"></canvas>
          <span class="bd-type">${esc(c.kind)}<em>${no(i)}</em></span>
        </div>
        <div class="bd-info">
          <div><small>You have</small><p class="bd-count">×${c.copies}${c.goldCopies ? ` <span>· ${c.goldCopies} gold</span>` : ''}</p></div>
          <div><small>Colours ${c.laps.filter((l) => l.got).length}/${c.laps.length}</small><div class="bd-laps">${laps}</div></div>
          <div><small>Lives in</small><ul>${where}</ul></div>
          ${c.firstKill ? `<p class="bd-first">First found on kill #${c.firstKill.toLocaleString()}</p>` : ''}
        </div>
      </div>
      <div class="bd-nav">
        <button data-bd="cprev" aria-label="Previous card">◀</button>
        <button data-bd="back" class="bd-back">Back to binder</button>
        <button data-bd="cnext" aria-label="Next card">▶</button>
      </div>`;
    this.paint(this.el.querySelector('canvas')!, c);
  }

  /** The monster standing on a patch of its own dungeon floor. */
  private paint(canvas: HTMLCanvasElement, c: BinderCard) {
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
    const art = c.art;
    if (!art) return;
    const k = Math.max(1, Math.floor(Math.min(56 / art.width, 42 / art.height)));
    const w = art.width * k;
    const h = art.height * k;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(Math.round(32 - w * 0.35), 44, Math.round(w * 0.7), 2);
    ctx.drawImage(art, Math.round(32 - w / 2), 45 - h, w, h);
  }
}
