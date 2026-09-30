import { ABYSS, COMPS, CURSORS, NEWS, ROMAN, TROPHIES, UPG_BY_ID, zoneName, zoneOf, type Icon, type UpgDef } from '../game/data.ts';
import { duration, fmt, setNotation } from '../game/format.ts';
import { DESCEND_FLOOR, FLOOR_KILLS, type Buff, type Game, type GameEvent, type OfflineSummary } from '../game/game.ts';
import type { Scene } from '../render/scene.ts';
import type { SfxName } from '../audio/sfx.ts';
import { G, sprite, spriteFit } from './px.ts';

export interface UiHooks {
  sound: (name: SfxName, o?: { vol?: number; rate?: number; jitter?: number }) => void;
  save: () => void;
  settings: () => void;
  exportSave: () => string;
  importSave: (text: string) => boolean;
  reset: () => void;
}

const TIER_COLORS = ['#b8a58a', '#7ddb6a', '#5fa8ff', '#c77dff', '#f2c14e', '#ff8a3d', '#ec5a4f', '#ff5ac8', '#9cf0ff', '#ffffff', '#ffe08a'];
const REWARD_TEXT: Record<string, string> = { plunder: 'Treasure!', bloodlust: 'Bloodlust!', heartstorm: 'Frenzy!', horde: 'Gold Rush!', soulstorm: 'Soul Storm!' };
const MAX_POPS = 90;
const MAX_COINS = 24;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function icon(i: Icon, box = 36): string {
  const tier = i.tier !== undefined ? `<b class="tier" style="--tc:${TIER_COLORS[i.tier]}">${ROMAN[i.tier]}</b>` : '';
  const sub = i.sub ? `<span class="sub">${spriteFit(i.sub, 18)}</span>` : '';
  return `<span class="ico">${spriteFit(i.sprite, box)}${sub}${tier}</span>`;
}

const gold = (n: number, cls = '') => `<span class="gold ${cls}">${sprite('coin', 2)}${fmt(n)}</span>`;

function buffText(b: Buff) {
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
  private shown = 0;
  private newsT = 0;
  private newsIdx = -1;
  private modal: string | null = null;
  private resetArmed = false;
  private hintState = '';
  private descending = false;
  private modalKey = '';
  private bannerTimer = 0;
  private floorKey = '';
  private bladeSprite = '';

  constructor(root: HTMLElement, game: Game, scene: Scene, hooks: UiHooks) {
    this.root = root;
    this.game = game;
    this.scene = scene;
    this.hooks = hooks;
    root.innerHTML = `
      <div class="hud-top">
        <div class="bank"><span class="bank-ico">${sprite('coin', 5)}</span><b class="bank-v">0</b></div>
        <div class="rate"><span><b class="dps-v">0</b> damage/sec</span><span class="sep">·</span><span><b class="click-v">1</b> per click</span></div>
        <div class="floor pnl">
          <button class="btn icon sm" data-act="floorDown" aria-label="Previous floor">${G.left()}</button>
          <div class="floor-mid">
            <div class="floor-name"><b class="floor-n">Floor 1</b><span class="floor-sub"></span></div>
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
      <div class="raid-mark" hidden><b>!</b></div>
      <div class="banner" hidden><b></b><span></span></div>
      <div class="ticker"><span></span></div>
      <nav class="dock">
        <button class="btn dock-b" data-open="trophies" data-tip="dock:trophies">${G.trophy()}<span>Trophies</span></button>
        <button class="btn dock-b" data-open="abyss" data-tip="dock:abyss">${G.abyss()}<span>Descend</span><em class="badge" hidden></em></button>
        <button class="btn dock-b" data-open="stats" data-tip="dock:stats">${G.stats()}<span>Stats</span></button>
        <button class="btn dock-b" data-open="settings" data-tip="dock:settings">${G.menu()}<span>Options</span></button>
        <button class="btn icon mute" data-act="mute" data-tip="dock:mute"></button>
      </nav>
      <aside class="shop">
        <header class="shop-head"><h2>Your Party</h2><span class="shop-sub"></span></header>
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
      fever: q('.fever'), feverBar: q('.fever i'), buffs: q('.buffs'), bars: q('.bars'), hint: q('.hint'), raid: q('.raid-mark'),
      banner: q('.banner'), ticker: q('.ticker span'), shop: q('.shop'), shopSub: q('.shop-sub'), upgGrid: q('.upg-grid'),
      upgEmpty: q('.upgs-empty'), buyAll: q('.buy-all'), gens: q('.gens'), toasts: q('.toasts'), pops: q('.pops'), tip: q('.tip'),
      blade: q('.blade'), bladeIn: q('.blade-in'), modalWrap: q('.modal-wrap'), modal: q('.modal'), curtain: q('.curtain'), mute: q('.mute'), abyssBadge: q('[data-open=abyss] .badge'),
    };

    COMPS.forEach((c, i) => {
      const row = document.createElement('button');
      row.className = 'gen';
      row.dataset.comp = String(i);
      row.dataset.tip = `comp:${i}`;
      row.innerHTML = `
        <span class="gen-ico">${spriteFit(c.sprite, 48)}</span>
        <span class="gen-mid"><b class="gen-name"></b><span class="gen-cost"></span></span>
        <span class="gen-right"><b class="gen-lv"></b><small class="gen-dps"></small></span>`;
      this.el.gens.appendChild(row);
      this.rows.push(row);
      this.rowCache.push('');
    });

    this.bind();
    this.syncMode();
    this.syncMute();
    this.layout();
    addEventListener('resize', () => this.layout());
    setNotation(game.s.settings.notation);
    this.nextNews();
  }

  // ---------- layout ----------

  private layout() {
    const phone = innerWidth < 760;
    document.body.classList.toggle('phone', phone);
    const shop = this.el.shop.getBoundingClientRect();
    if (phone) this.scene.setViewport(0, innerHeight - shop.top);
    else this.scene.setViewport(innerWidth - shop.left, 0);
    this.root.style.setProperty('--free-w', phone ? `${innerWidth}px` : `${shop.left}px`);
    this.root.style.setProperty('--free-h', phone ? `${shop.top}px` : `${innerHeight}px`);
  }

  // ---------- input ----------

  private bind() {
    const r = this.root;
    // Clicking the chamber: the treasure goblin first, then whichever monster is nearest.
    addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.modal || this.descending) return;
      const t = e.target as HTMLElement;
      if (t.closest('button, .shop, .pnl, .dock, input, textarea')) return;
      if (this.game.raid && this.scene.hitRaider(e.clientX, e.clientY)) {
        this.game.catchRaid();
        return;
      }
      this.swing(e.clientX, e.clientY);
      const id = this.scene.pick(e.clientX, e.clientY);
      if (id !== null) this.game.click(id, e.clientX, e.clientY);
    });
    addEventListener('pointermove', (e) => {
      const t = e.target as HTMLElement;
      const over = !t.closest('#ui button, #ui .shop, #ui .pnl') && (this.scene.overMonster(e.clientX, e.clientY) || (!!this.game.raid && this.scene.hitRaider(e.clientX, e.clientY)));
      document.body.classList.toggle('grab', over);
      // Over the battlefield, a mouse gets a sword instead of an arrow.
      const field = e.pointerType === 'mouse' && !t.closest('#ui button, #ui .shop, #ui .pnl, #ui .dock, #ui .modal-wrap') && !this.modal;
      this.el.blade.hidden = !field;
      document.body.classList.toggle('blade-on', field);
      if (field) this.el.blade.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    });
    document.addEventListener('pointerleave', () => {
      this.el.blade.hidden = true;
      document.body.classList.remove('blade-on');
    });
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key === 'Escape' && this.modal) this.closeModal();
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !this.modal && !(e.target as HTMLElement).closest('button')) {
        e.preventDefault();
        const f = this.game.focus();
        const s = f && this.scene.screenOf(f.id);
        if (f && s) this.game.click(f.id, s.x, s.y + s.h * 0.4);
      }
    });

    r.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
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
      const aby = t.closest<HTMLElement>('[data-aby]');
      if (aby) {
        if (this.game.buyAbyss(aby.dataset.aby!)) this.renderModal();
        else this.deny(aby);
        return;
      }
      const cur = t.closest<HTMLElement>('[data-cursor]');
      if (cur) {
        if (!this.cursorOpen(cur.dataset.cursor!)) return this.deny(cur);
        this.game.s.settings.cursor = cur.dataset.cursor!;
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
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      if (!t || t === this.tipAnchor) return;
      this.showTip(t);
    });
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
        if (ev.crit && ev.x >= 0) this.swing(ev.x, ev.y, true);
        break;
      case 'hit': {
        if (!g.s.settings.numbers && ev.kind !== 'crit') break;
        const s = this.scene.screenOf(ev.id);
        if (!s) break;
        if (ev.kind === 'dps') this.pop(s.x + (Math.random() - 0.5) * 30, s.y + s.h * 0.2, fmt(ev.amount), 'p-dps');
        else if (ev.kind === 'cleave' || ev.kind === 'auto') this.pop(s.x + (Math.random() - 0.5) * 40, s.y + s.h * 0.3, fmt(ev.amount), 'p-cleave');
        // Pop classes are prefixed so they can't collide with HUD classes (the Rampage meter is .fever).
        else this.pop(ev.x ?? s.x, (ev.y ?? s.y) - 10, fmt(ev.amount), `p-${ev.kind}`);
        break;
      }
      case 'kill': {
        const s = this.scene.screenOf(ev.id);
        if (!s) break;
        this.pop(s.x, s.y + s.h * 0.5, `+${fmt(ev.gold)}`, ev.boss ? 'p-gold p-big' : 'p-gold');
        this.coinFly(s.x, s.y + s.h * 0.6, ev.boss ? 8 : 1);
        break;
      }
      case 'floor':
        // Entering a new zone gets a title card.
        if (ev.floor % 10 === 1 && ev.floor > 1) {
          const z = zoneOf(ev.floor);
          this.banner(zoneName(ev.floor), `Floors ${z * 10 + 1}–${z * 10 + 10}`, 'zone');
        }
        if (ev.boss) {
          const boss = g.monsters.find((m) => m.boss);
          this.banner(`Boss: ${boss?.def.name ?? 'Guardian'}`, `Kill it in ${g.bossTimeMax} seconds`, 'boss');
        }
        break;
      case 'bossWin': this.banner('Victory!', `Floor ${ev.floor} conquered`, 'win'); break;
      case 'bossFail': this.banner('The boss held', 'Your party falls back to grow stronger', 'fail'); break;
      case 'retreat': this.toast(`Floor ${ev.floor} is too tough for now. Falling back.`, 'skull'); break;
      case 'buyComp': this.rowCache[ev.comp] = ''; this.bump(this.rows[ev.comp]); break;
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
        const title = REWARD_TEXT[ev.reward];
        const line = ev.reward === 'plunder' ? `+${fmt(ev.amount ?? 0)} gold` : ev.buff ? `${buffText(ev.buff)} for ${Math.round(ev.buff.dur)}s` : '';
        this.banner(title, line, 'loot');
        break;
      }
      case 'raidEscape': this.toast('The treasure goblin got away…', 'goblin'); break;
      case 'fever': if (ev.on) this.banner('RAMPAGE!', `Clicks ×${g.feverMult()} · Party damage ×2`, 'fever'); break;
      case 'abyss': this.toast(`Abyss power: <b>${esc(ABYSS.find((a) => a.id === ev.id)!.name)}</b>`, 'flask_big_red'); break;
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

  /** The sprite for the chosen cursor; "Your Blade" follows your best click upgrade. */
  private cursorSprite(): string {
    const g = this.game;
    const pick = CURSORS.find((c) => c.id === g.s.settings.cursor);
    if (pick && pick.sprite !== 'auto' && this.cursorOpen(pick.id)) return pick.sprite;
    return ['weapon_anime_sword', 'weapon_knight_sword', 'weapon_lavish_sword', 'weapon_golden_sword', 'weapon_red_gem_sword', 'weapon_regular_sword', 'weapon_rusty_sword', 'weapon_knife']
      .find((_, k, all) => g.hasUpg(`clk${all.length - 1 - k}`)) ?? 'weapon_knife';
  }

  // ---------- per-frame ----------

  frame(dt: number) {
    const g = this.game;
    const bank = g.s.gold;
    this.shown = bank < this.shown || bank - this.shown < 1 ? bank : this.shown + (bank - this.shown) * Math.min(1, dt * 10);
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
        bar.innerHTML = '<i></i>';
        this.el.bars.appendChild(bar);
        this.bars.set(m.id, bar);
      }
      bar.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y - 8)}px)`;
      (bar.firstChild as HTMLElement).style.width = `${Math.max(0, m.hp / m.max) * 100}%`;
    }
    for (const [id, bar] of this.bars) if (!seen.has(id)) {
      bar.remove();
      this.bars.delete(id);
    }

    const rp = g.raid ? this.scene.raiderScreen() : null;
    this.el.raid.hidden = !rp;
    if (rp) this.el.raid.style.transform = `translate(${rp.x}px, ${rp.y}px)`;

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

    this.renderBuffs(g.s.buffs);
    this.renderRows();
    this.renderUpgrades();
    this.el.shopSub.textContent = `${g.s.owned.filter((n) => n > 0).length} companions · ${g.s.upgrades.length} upgrades`;

    const pending = g.pendingSouls();
    const ab = this.el.abyssBadge;
    ab.hidden = pending < 1;
    ab.innerHTML = `${G.soul(1.5)}${fmt(pending)}`;
    ab.classList.toggle('hot', pending >= Math.max(10, g.s.souls));

    this.hints();
    if (this.modal && ['trophies', 'abyss', 'stats'].includes(this.modal) && !this.descending) this.renderModal(true);
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
      this.el.floorSub.textContent = boss ? 'Boss' : zoneName(s.floor);
      this.el.floorBox.classList.toggle('is-boss', boss);
      (this.el.down as HTMLButtonElement).disabled = s.floor <= 1;
      (this.el.up as HTMLButtonElement).disabled = s.floor >= s.maxFloor;
      this.el.auto.classList.toggle('on', s.auto);
      this.el.auto.textContent = s.auto ? 'Auto: on' : 'Auto: off';
    }
    if (boss) {
      const m = g.monsters.find((x) => x.boss);
      const hp = m ? m.hp / m.max : 0;
      this.el.floorBar.style.width = `${Math.max(0, hp) * 100}%`;
      this.el.floorBarT.textContent = `${Math.max(0, g.bossTime).toFixed(1)}s`;
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
        const ico = b.id === 'bloodlust' ? 'flask_big_red' : b.id === 'heartstorm' ? 'weapon_golden_sword' : b.id === 'soulstorm' ? 'chest_mimic_open' : 'coin';
        chip = document.createElement('div');
        chip.className = `buff ${b.id}`;
        chip.dataset.buff = b.id;
        chip.innerHTML = `<span class="buff-ico">${spriteFit(ico, 24)}</span><span class="buff-t"><b>${esc(b.name)}</b><small></small></span><em class="buff-bar"></em>`;
        box.appendChild(chip);
      }
      const text = `${buffText(b)} · ${Math.ceil(b.t)}s`;
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
      const can = !locked && !mystery && g.s.gold >= q.cost;
      row.classList.toggle('can', can);
      row.classList.toggle('mystery', mystery || locked);
      row.style.setProperty('--prog', `${Math.min(1, g.s.gold / q.cost) * 100}%`);
      const lv = g.s.owned[i];
      const key = [mystery, locked, q.n, q.cost, lv, can, g.s.settings.notation, Math.round(Math.log10(g.compDps(i) + 1) * 20)].join('|');
      if (key === this.rowCache[i]) return;
      this.rowCache[i] = key;
      const name = locked || mystery ? '???' : def.name;
      row.querySelector('.gen-name')!.innerHTML = `${name}${q.n > 1 && !locked && !mystery ? ` <small>×${q.n}</small>` : ''}`;
      row.querySelector('.gen-cost')!.innerHTML = locked ? `<span class="need">${G.lock()} Descend ${def.depth}× to meet them</span>` : gold(q.cost, can ? 'ok' : 'no');
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
      const can = g.s.gold >= g.upgCost(UPG_BY_ID.get(b.dataset.upg!)!);
      if (can) affordable++;
      b.classList.toggle('can', can);
    });
    this.el.buyAll.hidden = affordable < 2;
  }

  // ---------- onboarding ----------

  private hints() {
    const g = this.game;
    let state = '';
    if (g.s.clicks < 6) state = 'click';
    else if (g.s.owned.every((n) => n === 0) && g.s.gold >= g.compCost(0)) state = 'hire';
    else if (g.raid && g.s.raids === 0) state = 'raid';
    if (state === 'click') {
      const f = g.focus();
      const s = f && this.scene.screenOf(f.id);
      if (s) this.el.hint.style.transform = `translate(${s.x}px, ${s.y + s.h + 16}px)`;
      // Nothing to point at yet (monsters still coming up the stairs).
      this.el.hint.style.visibility = s ? 'visible' : 'hidden';
    }
    if (state === this.hintState) return;
    this.hintState = state;
    this.el.hint.hidden = state !== 'click';
    this.el.hint.innerHTML = '<b>Click the monsters!</b>';
    this.rows[0].classList.toggle('nudge', state === 'hire');
    this.el.raid.classList.toggle('first', state === 'raid');
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
      if (!g.compUnlocked(i)) return `<div class="tt-h"><b>???</b></div><p class="tt-f">Someone waits deeper down. Descend ${def.depth} time${def.depth > 1 ? 's' : ''} to meet them.</p>`;
      if (i === g.s.revealed && g.s.owned[i] === 0 && i > 0) return `<div class="tt-h"><b>???</b></div><p class="tt-f">A new companion is on their way. Earn more gold to meet them.</p>`;
      const q = g.compQuote(i);
      const next = g.compNext(i) * q.n;
      const share = g.baseDps() > 0 ? g.compDps(i) / g.baseDps() : 0;
      return `<div class="tt-h">${spriteFit(def.sprite, 32)}<b>${def.name}</b><span class="tt-own">level ${g.s.owned[i]}</span></div>
        <div class="tt-cost">${gold(q.cost, g.s.gold >= q.cost ? 'ok' : 'no')}${q.n > 1 ? ` for ${q.n} levels` : ''}</div>
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
        <div class="tt-cost">${gold(cost, g.s.gold >= cost ? 'ok' : 'no')}</div>
        <p class="tt-d">${esc(u.desc)}</p>${this.upgPreview(u)}`;
    }
    if (kind === 'tro') {
      const t = TROPHIES.find((x) => x.id === id)!;
      return `<div class="tt-h">${icon(t.icon, 32)}<b>${esc(t.name)}</b><span class="tt-own">${g.hasTrophy(id) ? 'unlocked' : 'locked'}</span></div><p class="tt-d">${esc(t.desc)}</p><p class="tt-f">Each trophy gives +1% damage.</p>`;
    }
    if (kind === 'aby') {
      const a = ABYSS.find((x) => x.id === id)!;
      const needs = (a.needs ?? []).filter((n) => !g.hasAbyss(n)).map((n) => ABYSS.find((x) => x.id === n)!.name);
      return `<div class="tt-h">${spriteFit(a.icon, 32)}<b>${esc(a.name)}</b><span class="tt-own">${g.hasAbyss(id) ? 'owned' : `${a.cost} souls`}</span></div><p class="tt-d">${esc(a.desc)}</p>${needs.length ? `<p class="tt-f">Requires ${needs.join(', ')}</p>` : ''}`;
    }
    if (kind === 'cur') {
      const c = CURSORS.find((x) => x.id === id)!;
      const tro = c.trophy ? TROPHIES.find((x) => x.id === c.trophy) : undefined;
      const how = c.sprite === 'auto' ? 'Shows the best blade you have bought.' : tro ? `${this.cursorOpen(c.id) ? 'Unlocked by' : 'Unlock with'} the trophy <b>${esc(tro.name)}</b>: ${esc(tro.desc)}` : 'Always available.';
      return `<div class="tt-h"><b>${esc(c.name)}</b><span class="tt-own">${this.cursorOpen(c.id) ? (this.game.s.settings.cursor === c.id ? 'equipped' : 'cursor') : 'locked'}</span></div><p class="tt-d">${how}</p>`;
    }
    if (kind === 'fever') return `<div class="tt-h"><b>Rampage</b></div><p class="tt-d">Click fast to fill this. When it's full, your clicks deal ×${g.feverMult()} damage and your party hits twice as hard for a few seconds.</p>`;
    if (kind === 'auto') return `<div class="tt-h"><b>Auto-advance</b></div><p class="tt-d">${g.s.auto ? 'On: you move to the next floor as soon as one is cleared.' : 'Off: you stay on this floor and farm it. Turns back on by itself once your party is much stronger.'}</p>`;
    if (kind === 'dock') {
      const text: Record<string, string> = {
        trophies: `Trophies: ${g.s.trophies.length}/${TROPHIES.length}. Each gives +1% damage.`,
        abyss: g.canDescend() ? `Descend now for ${fmt(g.pendingSouls())} souls.` : `Reach floor ${DESCEND_FLOOR} to descend for souls.`,
        stats: 'Your numbers.',
        settings: 'Sound, visuals and saves.',
        mute: g.s.settings.muted ? 'Unmute' : 'Mute',
      };
      return `<p class="tt-d">${text[id]}</p>`;
    }
    return '';
  }

  private upgPreview(u: UpgDef): string {
    const g = this.game;
    const e = u.effect;
    let gain = 0;
    if (e.t === 'comp') gain = g.compDps(e.comp);
    else if (e.t === 'global') gain = g.baseDps() * e.pct;
    if (gain <= 0) return '';
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
      html = head('The Abyss', `${G.soul()} ${fmt(g.s.souls)} souls · +${fmt(Math.round(g.s.souls * g.soulPower() * 100))}% damage`) + this.abyssHtml();
    } else if (name === 'stats') {
      const s = g.s;
      const rows: [string, string][] = [
        ['Floor', `${s.floor} (deepest this descent ${s.maxFloor}, ever ${s.bestFloor})`], ['Party damage/sec', fmt(g.dps())], ['Click damage', fmt(g.clickDamage())],
        ['Crit chance', `${Math.round(g.critChance() * 100)}% for ×${g.critMult()}`], ['Kills per second', g.killRate.toFixed(1)],
        ['Gold this descent', fmt(s.runGold)], ['Gold all time', fmt(s.totalGold)], ['Monsters killed', fmt(s.kills)], ['Bosses killed', fmt(s.bosses)],
        ['Clicks', fmt(s.clicks)], ['Critical hits', fmt(s.crits)], ['Treasure goblins', fmt(s.raids)], ['Rampages', fmt(s.fevers)],
        ['Descents', fmt(s.descents)], ['Souls', fmt(s.souls)], ['Trophies', `${s.trophies.length} / ${TROPHIES.length}`],
        ['This descent', duration(s.runTime)], ['Time played', duration(s.playTime)],
      ];
      html = head('Stats') + `<dl class="stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
    } else if (name === 'settings') {
      const s = g.s.settings;
      const tog = (act: string, on: boolean, label: string) => `<button class="btn toggle ${on ? 'on' : ''}" data-act="${act}">${label}: ${on ? 'On' : 'Off'}</button>`;
      html = head('Options') + `
        <div class="set">
          <label>Effects volume <input type="range" min="0" max="100" value="${Math.round(s.sfxVol * 100)}" data-set="sfxVol"></label>
          <label>Music volume <input type="range" min="0" max="100" value="${Math.round(s.musicVol * 100)}" data-set="musicVol"></label>
          <div class="set-row">${tog('music', s.music, 'Music')}${tog('particles', s.particles, 'Particles')}${tog('shake', s.shake, 'Screen shake')}${tog('numbers', s.numbers, 'Damage numbers')}${tog('blood', s.blood, 'Blood')}
          <button class="btn toggle" data-act="notation">Numbers: ${s.notation === 'short' ? '1.23M' : '1.23e6'}</button></div>
          <h3>Cursor <span class="muted">${CURSORS.filter((c) => this.cursorOpen(c.id)).length} / ${CURSORS.length}</span></h3>
          <div class="cursors">${CURSORS.map((c) => {
            const open = this.cursorOpen(c.id);
            const spr = c.sprite === 'auto' ? this.cursorSprite() : c.sprite;
            return `<button class="cur ${open ? '' : 'locked'} ${s.cursor === c.id ? 'on' : ''}" data-cursor="${c.id}" data-tip="cur:${c.id}">${spriteFit(spr, 36)}${open ? '' : `<span class="cur-lock">${G.lock()}</span>`}</button>`;
          }).join('')}</div>
          <h3>Save</h3>
          <p class="muted">The game saves itself every few seconds. Copy your save code to move it to another browser.</p>
          <textarea spellcheck="false" placeholder="Paste a save code here to load it"></textarea>
          <div class="set-row"><button class="btn" data-act="export">Copy save code</button><button class="btn" data-act="import">Load save code</button><button class="btn danger" data-act="reset">Wipe save</button></div>
          <p class="credits muted">Art: 0x72 DungeonTileset II · Sounds: Kenney · Music: Juhani Junkala (all CC0)</p>
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
    const desc = g.canDescend()
      ? `<p>Descending sends you back to the top with nothing but your souls, trophies and abyss powers.</p>
         <button class="btn primary big" data-act="descend">Descend for ${G.soul()} ${fmt(pending)} souls</button>
         <p class="muted">+${fmt(Math.round(pending * g.soulPower() * 100))}% damage forever · each floor deeper earns 10% more souls</p>`
      : `<p>Reach <b>floor ${DESCEND_FLOOR}</b> to descend. Deeper floors earn more souls.</p>
         <div class="bar"><i style="width:${Math.min(100, (g.s.maxFloor / DESCEND_FLOOR) * 100)}%"></i></div>
         <p class="muted">Deepest this descent: floor ${g.s.maxFloor}</p>`;
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

  private renderDescendConfirm() {
    const g = this.game;
    const pending = g.pendingSouls();
    this.modal = 'confirm';
    this.modalKey = 'confirm';
    this.el.modal.className = 'modal pnl m-confirm';
    this.el.modal.innerHTML = `<header class="m-head"><h2>Descend?</h2><button class="btn icon" data-act="close">${G.close()}</button></header>
      <div class="confirm">
        <p>Your gold, companions and upgrades stay behind. You start again from the top.</p>
        <p>You gain <b>${G.soul()} ${fmt(pending)} souls</b>: +${fmt(Math.round(pending * g.soulPower() * 100))}% damage, forever.</p>
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
      this.shown = 0;
      this.rowCache.fill('');
      this.upgKey = '';
      this.floorKey = '';
      this.hooks.save();
    }, 1100);
    setTimeout(() => {
      c.className = 'curtain out';
      this.descending = false;
      this.hooks.sound('drop4', { vol: 0.7 });
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
