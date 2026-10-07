import type { SfxName } from '../audio/sfx.ts';
import { CARD_BY_ID, ZONES, type CardDef } from '../game/data.ts';
import { DANIEL_GIVES, VICTOR_GIVES, type Game } from '../game/game.ts';
import { CARD_FRAME } from '../render/cards.ts';
import { G, cardArt, charFit } from './px.ts';

/**
 * Trading with the brothers, on the bedroom rug: your spares go down on your side, his card waits face down on his,
 * and you shake on it. Daniel takes five for one card from the sets you gave him (more of a set, better its odds);
 * Victor takes ten for a gold card.
 */

export type Brother = 'daniel' | 'victor';

const TYPE_MS = 22;

/** What the brothers say. `{set}` and `{card}` fill in. */
const LINES: Record<Brother, Record<'hello' | 'first' | 'ready' | 'new' | 'dupe' | 'short', string[]>> = {
  daniel: {
    hello: ["Five doubles, any sets. I'll pay you back from the same ones.", "Got doubles? I'm trying to finish a page.", "Mix 'em up if you like. I sort them anyway."],
    first: ['Ooh, {set}. Okay.', '{set}? I can work with that.'],
    ready: ['Five. Shake on it?', "That's five. Deal?"],
    new: ["Nice! That one's rare-ish.", 'A new one for the binder!'],
    dupe: ["Oh. You've got that one. Sorry!", 'Doubles happen. Bring it back next time.'],
    short: ['Come back with five doubles.'],
  },
  victor: {
    hello: ['Ten cards for a gold. Final offer.', "You want gold? Prove you've got the cards.", 'Ten spares. One gold. No refunds.'],
    first: ['A {card}? Fine. It counts.', 'Really? A {card}? ...Keep going.'],
    ready: ['Ten. Fine. Deal?', "That's ten. Shake."],
    new: ["Don't get used to it.", "Shiny, isn't it."],
    dupe: ['No refunds. I did say.', 'Two the same? Lucky you. Sort of.'],
    short: ["Ten spares, kid. Come back when you've got them."],
  },
};

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const setName = (zone: number) => ZONES[zone].name.replace(/^The /, '');

export interface TradeOpts {
  who: Brother;
  game: Game;
  host: HTMLElement;
  sound: (name: SfxName, o?: { vol?: number; rate?: number }) => void;
  save: () => void;
  closed: () => void;
}

export class TradeMat {
  private o: TradeOpts;
  private el = document.createElement('div');
  /** Card ids on your side of the rug (an id twice is two copies). */
  private side: string[] = [];
  private result: { id: string; gold: boolean; first: boolean } | null = null;
  private typing: number | null = null;

  constructor(o: TradeOpts) {
    this.o = o;
    this.el.className = 'tm-wrap';
    this.el.addEventListener('pointerup', (e) => e.stopPropagation());
    this.el.addEventListener('click', this.onClick);
    addEventListener('keydown', this.onKey, true);
    const name = o.who === 'daniel' ? 'Daniel' : 'Victor';
    this.el.innerHTML = `
      <div class="tm">
        <button class="tm-x" data-tm="close" aria-label="Close">✕</button>
        <header class="tm-top"><span class="tm-face">${charFit(o.who === 'daniel' ? 'ef_elf_m' : 'victor', 52)}</span><div class="tm-bubble"><b>${name}</b><p class="tm-say"></p></div></header>
        <div class="tm-body"></div>
      </div>`;
    o.host.appendChild(this.el);
    this.render();
    o.sound('open', { vol: 0.5 });
    this.say(pick(this.hand().length ? LINES[o.who].hello : LINES[o.who].short));
  }

  private get need() {
    return this.o.who === 'daniel' ? DANIEL_GIVES : VICTOR_GIVES;
  }

  /** Your spares, less what's already on the rug, by set then by how many you have. */
  private hand() {
    const g = this.o.game;
    return g.tradeable()
      .map((c) => ({ c, n: g.spareCards(c.id) - this.side.filter((id) => id === c.id).length }))
      .filter((h) => h.n > 0)
      .sort((a, b) => a.c.zone - b.c.zone || b.n - a.n);
  }

  /** What his card could be: Victor's from every gold card; Daniel's from the sets on your side, each as likely as
   *  its share of them. `fresh` is the chance it's one you don't have. */
  private odds() {
    const g = this.o.game;
    if (this.o.who === 'victor') {
      const pool = g.tradeable().filter((c) => c.gold);
      return { split: [], fresh: pool.length ? pool.filter((c) => !g.hasGoldCard(c.id)).length / pool.length : 0 };
    }
    const count = new Map<number, number>();
    for (const id of this.side) {
      const z = CARD_BY_ID.get(id)!.zone;
      count.set(z, (count.get(z) ?? 0) + 1);
    }
    const split = [...count].map(([zone, n]) => ({ zone, share: n / this.side.length })).sort((a, b) => b.share - a.share);
    const fresh = split.reduce((sum, { zone, share }) => {
      const pool = g.tradeable(zone);
      return sum + (pool.length ? (share * pool.filter((c) => !g.cardCount(c.id)).length) / pool.length : 0);
    }, 0);
    return { split, fresh };
  }

  private canPlace() {
    return this.side.length < this.need;
  }

  private place(id: string) {
    const c = CARD_BY_ID.get(id)!;
    if (!this.canPlace()) return;
    // Putting a card down after a trade starts the next one.
    this.result = null;
    const firstDown = !this.side.length;
    this.side.push(id);
    this.o.sound('card', { vol: 0.35, rate: 1.1 + this.side.length * 0.03 });
    if (this.side.length === this.need) this.say(pick(LINES[this.o.who].ready));
    else if (firstDown) this.say(pick(LINES[this.o.who].first).replace('{set}', setName(c.zone)).replace('{card}', c.name));
  }

  /** Fill your side with the spares you have most of. */
  private autofill() {
    while (this.side.length < this.need) {
      const h = this.hand().sort((a, b) => b.n - a.n)[0];
      if (!h) break;
      this.place(h.c.id);
    }
    if (this.side.length < this.need) this.say(pick(LINES[this.o.who].short));
  }

  private deal() {
    const g = this.o.game;
    if (this.side.length !== this.need) return;
    const got = this.o.who === 'daniel' ? g.tradeWithDaniel(this.side) : g.tradeWithVictor(this.side);
    if (!got) return;
    this.result = got;
    this.side = [];
    this.o.save();
    this.o.sound('drop3', { vol: 0.6 });
    setTimeout(() => {
      this.o.sound(got.gold ? 'cardgold' : 'card', { vol: 0.8 });
      if (got.first) this.o.sound('jackpot', { vol: 0.35 });
      this.say(pick(LINES[this.o.who][got.first ? 'new' : 'dupe']));
    }, 520);
  }

  private again() {
    this.result = null;
    this.say(pick(this.hand().length ? LINES[this.o.who].hello : LINES[this.o.who].short));
  }

  close() {
    if (this.typing !== null) clearInterval(this.typing);
    removeEventListener('keydown', this.onKey, true);
    this.el.remove();
    this.o.sound('close', { vol: 0.4 });
    this.o.closed();
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    this.close();
  };

  private onClick = (e: MouseEvent) => {
    e.stopPropagation();
    const t = e.target as HTMLElement;
    if (t === this.el) return this.close();
    const act = t.closest<HTMLElement>('[data-tm]')?.dataset.tm;
    const id = t.closest<HTMLElement>('[data-id]')?.dataset.id;
    if (act === 'close') return this.close();
    if (act === 'put' && id) this.place(id);
    else if (act === 'take' && id) {
      this.side.splice(this.side.lastIndexOf(id), 1);
      this.o.sound('click', { vol: 0.3 });
    } else if (act === 'auto') this.autofill();
    else if (act === 'clear') this.side = [];
    else if (act === 'deal') this.deal();
    else if (act === 'again') this.again();
    else return;
    this.render();
  };

  /** The brother's line, typed out a letter at a time. */
  private say(line: string) {
    const p = this.el.querySelector<HTMLElement>('.tm-say');
    if (!p) return;
    if (this.typing !== null) clearInterval(this.typing);
    let i = 0;
    p.textContent = '';
    this.typing = window.setInterval(() => {
      i++;
      p.textContent = line.slice(0, i);
      if (i % 3 === 1 && line[i - 1] !== ' ') this.o.sound('click', { vol: 0.08, rate: this.o.who === 'victor' ? 1.1 : 1.5 });
      if (i >= line.length && this.typing !== null) {
        clearInterval(this.typing);
        this.typing = null;
      }
    }, TYPE_MS);
  }

  private mini(c: CardDef, attrs: string, extra = '') {
    return `<button class="tm-card" style="--fc:${CARD_FRAME[c.kind]}" ${attrs} aria-label="${esc(c.name)}">${cardArt(c, 40)}${extra}</button>`;
  }

  /** Redraw the rug, your spares and the buttons (the brother's bubble stays, so his line keeps typing). */
  private render() {
    const who = this.o.who;
    const name = who === 'daniel' ? 'Daniel' : 'Victor';
    const need = this.need;
    const slots = Array.from({ length: need }, (_, k) => {
      const id = this.side[k];
      return id ? this.mini(CARD_BY_ID.get(id)!, `data-tm="take" data-id="${id}"`) : '<i class="tm-slot"></i>';
    }).join('');
    const odds = this.odds();
    const r = this.result;
    const his = r
      ? `<div class="tm-flip${r.gold ? ' gold' : ''}"><div class="tm-big" style="--fc:${r.gold ? CARD_FRAME.gold : CARD_FRAME[CARD_BY_ID.get(r.id)!.kind]}">${cardArt(CARD_BY_ID.get(r.id)!, 64)}<b>${esc(CARD_BY_ID.get(r.id)!.name)}</b></div>${r.first ? '<em class="tm-stamp">NEW!</em>' : ''}</div>`
      : `<div class="tm-back">${G.heart(3)}<span>DEEPHEART</span></div>`;
    // Where his card comes from: the sets on your side and their shares (Daniel), or any gold card (Victor).
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const from = who === 'victor'
      ? '<div class="tm-target"><span>A gold card</span></div>'
      : odds.split.length
        ? `<ul class="tm-split">${odds.split.map(({ zone, share }) => `<li><b>${pct(share)}</b> ${esc(setName(zone))}</li>`).join('')}</ul>`
        : '<p class="tm-odds">From the sets you give</p>';
    const oddsLine = r || (who === 'daniel' && !odds.split.length) ? '' : `<p class="tm-odds">${odds.fresh ? `${pct(odds.fresh)} chance it's new` : 'You have them all'}</p>`;
    const hand = this.hand();
    const cards = hand.length
      ? hand.map((h) => this.mini(h.c, `data-tm="put" data-id="${h.c.id}"${this.canPlace() ? '' : ' disabled'}`, `<i class="tm-n">×${h.n}</i>`)).join('')
      : '<p class="tm-none">No spares left. Doubles from the dungeon end up here.</p>';
    const buttons = r
      ? '<button class="tm-btn" data-tm="again">Trade again</button><button class="tm-btn go" data-tm="close">Done</button>'
      : `<button class="tm-btn" data-tm="${this.side.length ? 'clear' : 'auto'}">${this.side.length ? 'Clear' : 'Auto-fill'}</button><button class="tm-btn go" data-tm="deal" ${this.side.length === need ? '' : 'disabled'}>Deal!</button>`;
    this.el.querySelector('.tm-body')!.innerHTML = `
        <div class="tm-rug">
          <div class="tm-side"><small>Your side · ${this.side.length}/${need}</small><div class="tm-slots${need > 5 ? ' two' : ''}">${slots}</div></div>
          <div class="tm-swap">⇄</div>
          <div class="tm-side his"><small>${name}'s side</small>${his}${r ? '' : from}${oddsLine}</div>
        </div>
        <div class="tm-hand"><small>Your spares</small><div class="tm-cards">${cards}</div></div>
        <footer class="tm-foot">${buttons}</footer>`;
  }
}
