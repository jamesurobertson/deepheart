import type { Game, GameEvent, OfflineSummary, UpgradeId } from '../game/sim.ts';
import { UPGRADES, chapterOf, isBossStage, stageLabel } from '../game/sim.ts';
import { heroXpToNext, type HeroId } from '../game/heroes.ts';
import { TALENT } from '../game/talents.ts';
import type { DungeonId } from '../game/dailies.ts';
import {
  AFFIXES, RARITY_COLORS, RARITY_NAMES, SLOTS, SLOT_LABEL,
  goldValue, potentialStars, power, xpToNext, type Item, type Slot, type Verdict,
} from '../game/items.ts';
import { duration, fmt, pct } from '../game/format.ts';
import type { SfxName } from '../audio/sfx.ts';
import { G, itemIcon, sheetIcon, sprite, stars } from './px.ts';
import { type HeroTab, classPicker, dailiesPanel, dailiesReady, heroPanel, heroReady, portrait, skillBar, stageAction } from './panels.ts';

const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const HINT_KEY = 'descent-hints';

export interface HudCallbacks {
  onChange: () => void;
  onReset: () => void;
  onMute: (muted: boolean) => void;
  onMusic: (on: boolean) => void;
  onSettings: () => void; // volumes etc. changed
  onImport: (text: string) => boolean;
  exportSave: () => string;
  onHero: () => void; // class changed: re-skin the hero
  sfx: (name: SfxName) => void;
}

const CHAPTERS = ['The Sunken Keep', 'Bone Crypts', 'Orc Warrens', 'The Rotting Deep', 'Demon Gate', 'Frozen Vault'];
const chapterName = (stage: number) => CHAPTERS[(chapterOf(stage) - 1) % CHAPTERS.length];

type Drop = Extract<GameEvent, { t: 'drop' }>;

const KEEP_LABELS = ['All', 'Magic+', 'Rare+', 'Epic+', 'Legend'];
const PANELS = ['.bag', '.forge', '.menu', '.dailies', '.heropanel'];

// ---------- shared item markup ----------

function verdictBlock(v: Verdict, cur: Item): string {
  const ratio = v.now / v.current;
  if (v.kind === 'upgrade') {
    return `<div class="verdict up">${G.up()}<b>Upgrade</b><span>${ratio >= 10 ? `×${fmt(ratio)}` : `+${pct(ratio - 1)}`} power right now</span></div>`;
  }
  if (v.kind === 'potential') {
    return `<div class="verdict pot">${G.star()}<b>Potential</b><span>${pct(1 - ratio)} weaker now · passes yours at Lv ${v.catchUp}</span></div>`;
  }
  return `<div class="verdict bad">${G.down()}<b>Worse</b><span>Never beats your ${esc(cur.name)}</span></div>`;
}

/** Tiny power-over-time chart: your item vs the new one as both keep leveling. */
function curve(item: Item, v: Verdict, cur: Item): string {
  const span = Math.max(12, item.cap - v.startLevel, cur.cap - cur.level);
  const W = 232, H = 64, n = 24;
  const mine: number[] = [], theirs: number[] = [];
  for (let i = 0; i <= n; i++) {
    const k = Math.round((i / n) * span);
    mine.push(power(cur, cur.level + k));
    theirs.push(power(item, v.startLevel + k));
  }
  const lo = Math.log(Math.min(...mine, ...theirs)), hi = Math.log(Math.max(...mine, ...theirs)) + 1e-9;
  const pts = (arr: number[]) => arr.map((p, i) => `${Math.round((i / n) * (W - 4)) + 2},${Math.round(H - 4 - ((Math.log(p) - lo) / (hi - lo)) * (H - 10))}`).join(' ');
  return `
    <div class="curve">
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">
        <polyline points="${pts(mine)}" class="c-mine"/>
        <polyline points="${pts(theirs)}" class="c-new" style="stroke:${RARITY_COLORS[item.rarity]}"/>
      </svg>
      <div class="curve-legend"><span class="c-mine-k">Yours</span><span style="color:${RARITY_COLORS[item.rarity]}">New</span><span class="muted">next ${span} levels</span></div>
    </div>`;
}

function awakeningList(item: Item, level: number): string {
  if (!item.awakenings.length) return `<p class="muted small">No awakenings.</p>`;
  return `<ul class="aw">${item.awakenings.map((a) => {
    const on = a.level <= level;
    return `<li class="${on ? 'on' : ''}"><em>Lv ${a.level}</em><b>${AFFIXES[a.affix].name}</b><span>${AFFIXES[a.affix].desc(a.value)}</span></li>`;
  }).join('')}</ul>`;
}

function itemHead(item: Item): string {
  return `
    <div class="ih" style="--rc:${RARITY_COLORS[item.rarity]}">
      <div class="ih-icon cell r${item.rarity}">${itemIcon(item, 3)}</div>
      <div>
        <div class="ih-name">${esc(item.name)}</div>
        <div class="ih-type">${RARITY_NAMES[item.rarity]} ${SLOT_LABEL[item.slot]} · item level ${item.ilvl}</div>
        ${stars(potentialStars(item))}
      </div>
    </div>`;
}

// ---------- HUD ----------

export class Hud {
  private root: HTMLElement;
  private game: Game;
  private cb: HudCallbacks;
  private binds = new Map<string, { el: HTMLElement; val: string }[]>();
  private selected: number | null = null;
  private sig = { slots: '', bag: '', detail: '', forge: '', filters: '', stage: '', skills: '', dailies: '', hero: '' };
  private heroTab: HeroTab = 'class';
  private hints: Record<string, boolean>;
  private bannerUntil = 0;
  private bannerQueue: string[] = [];
  private shownStreak = 0;

  constructor(root: HTMLElement, game: Game, cb: HudCallbacks) {
    this.root = root;
    this.game = game;
    this.cb = cb;
    try {
      this.hints = JSON.parse(localStorage.getItem(HINT_KEY) ?? '{}');
    } catch {
      this.hints = {};
    }

    root.innerHTML = `
      <section class="stagebox pnl">
        <div class="stage-row">
          <button class="btn icon sm" data-action="stage-prev" title="Farm an easier stage">${G.left()}</button>
          <div class="stage-title"><small data-bind="chapter"></small><b data-bind="stage"></b></div>
          <button class="btn icon sm" data-action="stage-next" title="Farm a harder stage">${G.right()}</button>
        </div>
        <div class="stage-action"></div>
      </section>

      <div class="topbar">
        <div class="goldbox pnl">${sprite('coin', 3)}<b data-bind="gold"></b></div>
        <button class="btn icon" data-action="dailies" title="Dailies (J)">${sheetIcon('items', 0, 8, 2)}<span class="ping" data-ping="dailies"></span></button>
        <button class="btn icon" data-action="heropanel" title="Hero: classes, talents, rebirth (T)"><span class="hero-ico"></span><span class="ping" data-ping="hero"></span></button>
        <button class="btn icon" data-action="forge" title="Forge (G)">${sheetIcon('weapons-steel', 21, 10, 2)}<span class="ping" data-ping="forge"></span></button>
        <button class="btn icon" data-action="sound" title="Sound (M)"><span class="snd"></span></button>
        <button class="btn icon" data-action="menu" title="Menu">${G.menu()}</button>
        <section class="menu pnl gold" hidden>
          <header class="pnl-head"><span>Settings</span><button class="btn icon sm" data-action="menu">${G.close()}</button></header>
          <div class="set-grid">
            <label class="set-row"><span>Music</span><input type="range" min="0" max="100" data-set="musicVol"></label>
            <label class="set-row"><span>Effects</span><input type="range" min="0" max="100" data-set="sfxVol"></label>
            <div class="set-row"><span>Screen shake</span><button class="btn chk" data-action="setting" data-id="shake"><i>${G.check()}</i></button></div>
            <div class="set-row"><span>Hit-stop on big hits</span><button class="btn chk" data-action="setting" data-id="hitstop"><i>${G.check()}</i></button></div>
            <div class="set-row"><span>Damage numbers</span><span class="seg nums">${['all', 'crits', 'off'].map((m) => `<button class="btn seg-btn" data-action="numbers" data-id="${m}">${m}</button>`).join('')}</span></div>
            <button class="btn wide music-btn" data-action="music">Music: on</button>
          </div>
          <div class="live-stats"></div>
          <div class="save-io">
            <button class="btn" data-action="export">Export save</button>
            <button class="btn" data-action="import">Import save</button>
            <textarea class="save-text" hidden spellcheck="false"></textarea>
            <button class="btn primary wide" data-action="import-go" hidden>Load this save</button>
          </div>
          <button class="btn wide danger" data-action="reset">Reset all progress</button>
        </section>
      </div>

      <div class="feed"></div>
      <div class="banner"></div>
      <div class="streak" hidden><b></b><small>kills</small></div>

      <footer class="hotbar pnl gold">
        <div class="hb-top">
          <span class="hero-face"></span>
          <span class="hb-name"><b data-bind="heroname"></b> <span class="lv">Lv <b data-bind="herolv"></b></span></span>
          <div class="hp">${sprite('ui_heart_full', 1)}<div class="hp-bar"><i class="hp-fill"></i><span data-bind="hp"></span></div></div>
          <button class="btn chk sm-chk" data-action="auto" title="Auto play (Z). Move with A/D or arrows, jump with W/Space, drop with S, skills 1-5."><i>${G.check()}</i>Auto</button>
        </div>
        <div class="hxp"><i></i></div>
        <div class="gearrow"><div class="slots"></div><div class="skills"></div></div>
      </footer>

      <button class="btn bagbtn" data-action="bag" title="Bag (B)">
        ${sprite('chest_full_open', 3)}<span class="bag-lbl">Bag</span><b data-bind="bagcount"></b><span class="badge" hidden></span>
      </button>
      <div class="coach" hidden></div>
      <div class="tip" hidden><p></p><button class="btn sm-chk" data-action="tip-ok">Got it</button></div>

      <section class="bag pnl gold" hidden>
        <header class="pnl-head"><span>Bag <b data-bind="bagcount2"></b></span><button class="btn icon sm" data-action="bag">${G.close()}</button></header>
        <div class="filters"></div>
        <div class="bag-body">
          <div class="grid"></div>
          <div class="detail"></div>
        </div>
      </section>

      <section class="dailies pnl gold" hidden>
        <header class="pnl-head"><span>Dailies</span><button class="btn icon sm" data-action="dailies">${G.close()}</button></header>
        <div class="dailies-body"></div>
      </section>

      <section class="heropanel pnl gold" hidden>
        <header class="pnl-head"><span>Hero</span><button class="btn icon sm" data-action="heropanel">${G.close()}</button></header>
        <div class="hero-body"></div>
      </section>

      <section class="forge pnl gold" hidden>
        <header class="pnl-head"><span>The Forge</span><button class="btn icon sm" data-action="forge">${G.close()}</button></header>
        <p class="muted small">Spend gold from chests and salvage.</p>
        <div class="upgrades"></div>
      </section>

      <div class="tooltip pnl" hidden></div>
      <div class="modal" hidden></div>
      <div class="flyers"></div>
    `;
    for (const el of root.querySelectorAll<HTMLElement>('[data-bind]')) {
      const k = el.dataset.bind!;
      if (!this.binds.has(k)) this.binds.set(k, []);
      this.binds.get(k)!.push({ el, val: '' });
    }
    // Act on press (like most games): snappier, and immune to the element re-rendering mid-click.
    root.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this.onClick(e);
    });
    root.addEventListener('click', (e) => {
      if (e.detail === 0) this.onClick(e); // keyboard activation (Enter/Space)
    });
    root.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (!el.dataset.set) return;
      (this.game.s.settings as unknown as Record<string, number>)[el.dataset.set] = Number(el.value) / 100;
      this.cb.onSettings();
    });
    root.addEventListener('pointerover', (e) => this.onHover(e, true));
    root.addEventListener('pointerout', (e) => this.onHover(e, false));
    addEventListener('keydown', (e) => this.onKey(e));
    this.renderSound();
  }

  private set(key: string, val: string) {
    for (const b of this.binds.get(key) ?? []) {
      if (b.val !== val) {
        b.val = val;
        b.el.textContent = val;
      }
    }
  }

  private hint(key: string) {
    this.hints[key] = true;
    try {
      localStorage.setItem(HINT_KEY, JSON.stringify(this.hints));
    } catch { /* storage unavailable */ }
  }

  private dirty() {
    for (const k of Object.keys(this.sig) as (keyof Hud['sig'])[]) this.sig[k] = '';
  }

  // ---------- input ----------

  private onClick(e: Event) {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    const g = this.game;
    switch (action) {
      case 'bag': this.toggle('.bag'); break;
      case 'forge': this.toggle('.forge'); break;
      case 'menu': this.toggle('.menu'); break;
      case 'dailies': this.toggle('.dailies'); break;
      case 'music': this.toggleMusic(); break;
      case 'setting': {
        const key = id as 'shake' | 'hitstop';
        g.s.settings[key] = g.s.settings[key] === false;
        this.cb.sfx('toggle');
        this.cb.onSettings();
        break;
      }
      case 'numbers':
        g.s.settings.numbers = id as 'all' | 'crits' | 'off';
        this.cb.sfx('toggle');
        this.cb.onSettings();
        break;
      case 'export': {
        const text = this.cb.exportSave();
        const ta = $(this.root, '.save-text') as HTMLTextAreaElement;
        ta.hidden = false;
        ta.value = text;
        ta.select();
        navigator.clipboard?.writeText(text).then(() => this.feed('<span>Save copied to clipboard</span>', 'good')).catch(() => {});
        $(this.root, '[data-action=import-go]').hidden = true;
        break;
      }
      case 'import': {
        const ta = $(this.root, '.save-text') as HTMLTextAreaElement;
        ta.hidden = false;
        ta.value = '';
        ta.placeholder = 'Paste an exported save here…';
        ta.focus();
        $(this.root, '[data-action=import-go]').hidden = false;
        return;
      }
      case 'import-go':
        if (!this.cb.onImport(($(this.root, '.save-text') as HTMLTextAreaElement).value.trim())) this.feed('<span>That save could not be read</span>', 'bad');
        return;
      case 'tip-ok':
        this.hint(btn.dataset.id!);
        $(this.root, '.tip').hidden = true;
        return;
      case 'heropanel': this.toggle('.heropanel'); break;
      case 'herotab': this.heroTab = id as HeroTab; this.cb.sfx('click'); break;
      case 'challenge':
        if (g.startChallenge()) this.cb.sfx('open');
        this.hint('challenge');
        break;
      case 'autoch':
        g.s.settings.autoChallenge = !g.s.settings.autoChallenge;
        g.challengeCd = Math.min(g.challengeCd, 3);
        this.cb.sfx('toggle');
        break;
      case 'auto':
        g.s.settings.auto = !g.s.settings.auto;
        this.cb.sfx('toggle');
        break;
      case 'stage-prev': g.setStage(g.s.stage - 1); this.cb.sfx('click'); break;
      case 'stage-next': g.setStage(g.s.stage + 1); this.cb.sfx('click'); break;
      case 'cast':
        g.input.cast = Number(id);
        g.idleInput = 0;
        break;
      case 'dungeon':
        if (g.startDungeon(id as DungeonId, Number(btn.dataset.floor))) this.closeAll();
        break;
      case 'sweep': {
        const r = g.sweep(id as DungeonId);
        if (r) {
          this.cb.sfx('coins');
          this.feed(`${sprite('coin', 2)}<span>Swept · <b class="gold-t">${esc(r)}</b></span>`, 'good');
          this.cb.onChange();
        }
        break;
      }
      case 'worldboss':
        if (g.startWorldBoss()) this.closeAll();
        break;
      case 'claim':
        if (g.claimStamp()) this.cb.onChange();
        break;
      case 'talent':
        if (g.buyTalent(id!)) {
          this.cb.sfx('levelup');
          this.cb.onChange();
        } else this.cb.sfx('click');
        break;
      case 'pickclass':
      case 'startclass':
        g.setHero(id as HeroId);
        this.cb.onHero();
        this.cb.onChange();
        if (action === 'startclass') $(this.root, '.modal').hidden = true;
        this.cb.sfx('equip');
        break;
      case 'rebirth':
        if (btn.dataset.armed) {
          const shards = g.rebirth(id as HeroId);
          if (shards) {
            this.closeAll();
            this.cb.onHero();
            this.cb.onChange();
          }
        } else {
          btn.dataset.armed = '1';
          btn.textContent = 'Click again to rebirth';
          setTimeout(() => delete btn.dataset.armed, 3000);
          return;
        }
        break;
      case 'sound':
        g.s.settings.muted = !g.s.settings.muted;
        this.cb.onMute(g.s.settings.muted);
        this.renderSound();
        break;
      case 'select':
        this.select(Number(id));
        this.cb.sfx('click');
        break;
      case 'equip': this.equipSelected(); break;
      case 'salvage': this.salvageSelected(); break;
      case 'salvage-filtered': {
        const r = g.salvageFiltered();
        if (r.count) {
          this.cb.sfx('salvage');
          this.feed(`${sprite('coin', 2)}<span>Salvaged ${r.count} items for <b class="gold-t">${fmt(r.gold)}</b> gold</span>`);
          this.cb.onChange();
        }
        break;
      }
      case 'keep':
        g.s.settings.keepRarity = Number(id);
        this.cb.sfx('toggle');
        this.cb.onChange();
        break;
      case 'opt': {
        const key = id as 'salvageWorse' | 'autoEquip';
        g.s.settings[key] = !g.s.settings[key];
        this.cb.sfx('toggle');
        this.cb.onChange();
        break;
      }
      case 'buy':
        if (g.buyUpgrade(id as UpgradeId)) {
          this.cb.sfx('levelup');
          this.cb.onChange();
        } else this.cb.sfx('click');
        break;
      case 'close-modal':
        $(this.root, '.modal').hidden = true;
        this.cb.sfx('close');
        break;
      case 'reset':
        if (btn.dataset.armed) this.cb.onReset();
        else {
          btn.dataset.armed = '1';
          btn.textContent = 'Click again to wipe';
          setTimeout(() => {
            delete btn.dataset.armed;
            btn.textContent = 'Reset all progress';
          }, 3000);
        }
        break;
    }
    this.dirty();
    this.update();
  }

  private onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const bagOpen = !$(this.root, '.bag').hidden;
    if (k === 'escape') {
      if (!$(this.root, '.modal').hidden) $(this.root, '.modal').hidden = true;
      else this.closeAll();
    } else if (k === 'b' || k === 'i') this.toggle('.bag');
    else if (k === 'g') this.toggle('.forge');
    else if (k === 'j') this.toggle('.dailies');
    else if (k === 'n') this.toggleMusic();
    else if (k === 't') this.toggle('.heropanel');
    else if (k === 'z') {
      this.game.s.settings.auto = !this.game.s.settings.auto;
      this.cb.sfx('toggle');
    } else if (k >= '1' && k <= '5') {
      this.game.input.cast = Number(k) - 1;
      this.game.idleInput = 0;
      return;
    } else if (k === 'm') {
      this.game.s.settings.muted = !this.game.s.settings.muted;
      this.cb.onMute(this.game.s.settings.muted);
      this.renderSound();
    } else if (bagOpen && k === 'e') this.equipSelected();
    else if (bagOpen && k === 'x') this.salvageSelected();
    else if (bagOpen && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
      const bag = this.game.s.bag;
      if (!bag.length) return;
      const i = Math.max(0, bag.findIndex((it) => it.id === this.selected));
      const step = { arrowleft: -1, arrowright: 1, arrowup: -6, arrowdown: 6 }[k]!;
      this.select(bag[Math.min(bag.length - 1, Math.max(0, i + step))].id);
      e.preventDefault();
    } else return;
    this.dirty();
    this.update();
  }

  private onHover(e: PointerEvent, over: boolean) {
    if (e.pointerType === 'touch') return;
    const node = (e.target as HTMLElement).closest<HTMLElement>('.tnode');
    if (node && over) {
      const t = TALENT[node.dataset.id!];
      const r = this.game.s.prestige.ranks[t.id] ?? 0;
      const d = this.root.querySelector('.tdesc');
      if (d) d.innerHTML = `<b>${esc(t.name)}</b> · ${esc(t.desc(Math.max(1, r)))}${r < t.max ? ` <span class="muted">(next rank: ${esc(t.desc(r + 1))})</span>` : ''}`;
    }
    const slot = (e.target as HTMLElement).closest<HTMLElement>('.slot');
    if (!slot) return;
    if ((e.relatedTarget as HTMLElement | null)?.closest('.slot') === slot) return;
    this.showTip(over ? (slot.dataset.slot as Slot) : null, slot);
  }

  private toggle(sel: '.bag' | '.forge' | '.menu' | '.dailies' | '.heropanel') {
    const el = $(this.root, sel);
    const open = el.hidden;
    if (open && sel === '.dailies') this.hint('dailies');
    if (open && sel === '.heropanel') this.hint('rebirth');
    for (const s of PANELS) $(this.root, s).hidden = true;
    el.hidden = !open;
    this.cb.sfx(open ? 'open' : 'close');
    if (sel === '.bag' && open) {
      this.hint('bag');
      if (this.selected === null || !this.game.s.bag.some((i) => i.id === this.selected)) {
        const first = this.game.s.bag.find((i) => i.fresh) ?? this.game.s.bag[0];
        this.select(first?.id ?? null);
      }
    }
    this.showTip(null);
    this.dirty();
    this.update();
  }

  private closeAll() {
    for (const s of PANELS) $(this.root, s).hidden = true;
    this.showTip(null);
  }

  private select(id: number | null) {
    this.selected = id;
    const it = this.game.s.bag.find((i) => i.id === id);
    if (it) it.fresh = false;
  }

  private equipSelected() {
    const g = this.game;
    const idx = g.s.bag.findIndex((i) => i.id === this.selected);
    if (idx < 0) return;
    const item = g.s.bag[idx];
    if (g.equip(item.id)) {
      this.cb.sfx('equip');
      this.cb.onChange();
      // The replaced item lands back in the bag; keep the cursor where it was.
      this.select(g.s.bag[Math.min(idx, g.s.bag.length - 1)]?.id ?? null);
      this.dirty();
      this.update();
    }
  }

  private salvageSelected() {
    const g = this.game;
    const idx = g.s.bag.findIndex((i) => i.id === this.selected);
    if (idx < 0) return;
    const gold = g.salvage(g.s.bag[idx].id);
    this.cb.sfx('salvage');
    this.flyGold($(this.root, '.detail').getBoundingClientRect(), gold);
    this.cb.onChange();
    this.select(g.s.bag[Math.min(idx, g.s.bag.length - 1)]?.id ?? null);
    this.dirty();
    this.update();
  }

  private showTip(slot: Slot | null, anchor?: HTMLElement) {
    const tip = $(this.root, '.tooltip');
    if (!slot || !anchor) {
      tip.hidden = true;
      return;
    }
    const it = this.game.s.equipped[slot];
    tip.innerHTML = `
      ${itemHead(it)}
      <div class="kv"><span>Power</span><b>${fmt(power(it))}</b></div>
      <div class="kv"><span>Level</span><b>${it.level} / ${it.cap}</b></div>
      <div class="xp"><i style="width:${it.level >= it.cap ? 100 : (it.xp / xpToNext(it.level)) * 100}%"></i></div>
      <div class="kv"><span>Growth</span><b>+${((it.growth - 1) * 100).toFixed(1)}% / level</b></div>
      <div class="sep">Awakenings</div>
      ${awakeningList(it, it.level)}`;
    tip.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = tip.offsetWidth;
    tip.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)))}px`;
    tip.style.bottom = `${Math.round(innerHeight - r.top + 10)}px`;
  }

  // ---------- feedback ----------

  handle(ev: GameEvent) {
    switch (ev.t) {
      case 'awaken':
        this.banner(`<div class="b aw" style="--rc:${RARITY_COLORS[ev.item.rarity]}"><small>Awakened</small><b>${AFFIXES[ev.affix].name}</b><span>${esc(ev.item.name)} · Lv ${ev.item.level}</span></div>`);
        this.sig.slots = '';
        break;
      case 'boss':
        this.banner(`<div class="b boss"><small>Guardian</small><b>${esc(ev.name)}</b></div>`);
        break;
      case 'heroLevel':
        this.sig.skills = '';
        if (ev.unlocked.length) {
          const sk = ev.unlocked[0];
          this.banner(`<div class="b aw" style="--rc:#ffe08a"><small>Level ${ev.level} · new ${sk.cooldown ? 'skill' : 'passive'}</small><b>${esc(sk.name)}</b><span>${esc(sk.desc)}</span></div>`, 3200);
        } else this.feed(`${portrait(this.game.s.hero, 1)}<span>Level up! <b>Lv ${ev.level}</b></span>`, 'good');
        break;
      case 'challenge':
        if (ev.phase === 'start') this.banner(`<div class="b depth"><small>Challenge</small><b>Stage ${stageLabel(ev.stage)}</b><span>Slay ${50} monsters, then the guardian</span></div>`, 1800);
        if (ev.phase === 'win') this.banner(`<div class="b aw" style="--rc:#7ddb6a"><small>Stage cleared</small><b>${stageLabel(ev.stage + 1)} unlocked</b><span>${esc(chapterName(ev.stage + 1))}</span></div>`, 2200);
        if (ev.phase === 'fail') this.feed(`${sprite('skull', 2)}<span>Challenge ${stageLabel(ev.stage)} failed · back to farming. Get stronger and retry!</span>`, 'bad');
        this.sig.stage = '';
        break;
      case 'run':
        if (ev.phase === 'start') this.banner(`<div class="b depth"><small>${ev.kind === 'dungeon' ? 'Dungeon' : 'World boss'}</small><b>${esc(ev.title)}</b></div>`, 1600);
        else this.banner(`<div class="b ${ev.phase === 'win' ? 'aw' : 'boss'}" style="--rc:${ev.phase === 'win' ? '#7ddb6a' : '#ec5a4f'}"><small>${ev.phase === 'win' ? 'Cleared' : ev.kind === 'dungeon' ? 'Out of time' : 'Time up'}</small><b>${esc(ev.title)}</b>${ev.reward ? `<span>${esc(ev.reward)}</span>` : ''}</div>`, 2600);
        this.sig.dailies = '';
        break;
      case 'daily':
        if (ev.what === 'stamp') this.banner(`<div class="b aw" style="--rc:#f2c14e"><small>Daily stamp</small><b>Day ${ev.day}</b></div>`, 2000);
        this.sig.dailies = '';
        break;
      case 'down':
        this.feed(`${sprite('skull', 2)}<span>You fell! Back on your feet in a moment…</span>`, 'bad');
        break;
      case 'rebirth':
        this.banner(`<div class="b aw" style="--rc:#5fa8ff"><small>Reborn</small><b>+${ev.shards} soul shards</b><span>Spend them on talents (T)</span></div>`, 3000);
        break;
      case 'levelUp':
        this.sig.slots = '';
        break;
      case 'equip':
        this.sig.slots = '';
        break;
      case 'massacre': {
        this.feed(`${sprite('coin', 2)}<span><b class="gold-t">Massacre ×${ev.count}</b> · +${fmt(ev.gold)} gold</span>`, 'good');
        const el = $(this.root, '.streak');
        el.classList.remove('done');
        void el.offsetWidth;
        el.classList.add('done');
        break;
      }
    }
  }

  /** A dropped item finished its in-world pop: fly its icon to where it went. */
  lootLanded(ev: Drop, from: { x: number; y: number }) {
    const it = ev.item;
    const rc = RARITY_COLORS[it.rarity];
    if (ev.outcome === 'salvaged') {
      this.flyGold(new DOMRect(from.x, from.y, 0, 0), ev.gold);
      return;
    }
    const target = ev.outcome === 'equipped'
      ? this.root.querySelector<HTMLElement>(`.slot[data-slot="${it.slot}"]`)!
      : $(this.root, '.bagbtn');
    this.fly(itemIcon(it, 3), from, target, rc);
    if (ev.outcome === 'equipped') {
      this.feed(`${itemIcon(it, 2)}<span>Equipped <b style="color:${rc}">${esc(it.name)}</b> <span class="up-t">${G.up()} upgrade</span></span>`, 'good');
    } else {
      const tag = ev.verdict === 'upgrade' ? `<span class="up-t">${G.up()} upgrade</span>` : ev.verdict === 'potential' ? `<span class="pot-t">${G.star()} potential</span>` : '';
      this.feed(`${itemIcon(it, 2)}<span><b style="color:${rc}">${esc(it.name)}</b> ${tag}</span>`, ev.verdict === 'upgrade' ? 'good' : '');
      if (!this.hints.bag) this.coach('New loot! Open your bag to compare it', '.bagbtn');
    }
  }

  private fly(html: string, from: { x: number; y: number }, target: HTMLElement, color: string) {
    const el = document.createElement('div');
    el.className = 'flyer';
    el.innerHTML = html;
    el.style.setProperty('--rc', color);
    $(this.root, '.flyers').append(el);
    const t = target.getBoundingClientRect();
    const dx = t.left + t.width / 2 - from.x, dy = t.top + t.height / 2 - from.y;
    el.style.left = `${from.x}px`;
    el.style.top = `${from.y}px`;
    el.animate([
      { transform: 'translate(-50%,-50%) scale(1.2)' },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 80}px)) scale(1.4)`, offset: 0.4 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)` },
    ], { duration: 650, easing: 'cubic-bezier(.5,0,.6,1)' }).finished.then(() => {
      el.remove();
      target.classList.remove('bump');
      void target.offsetWidth;
      target.classList.add('bump');
    });
  }

  private flyGold(from: DOMRect | { x: number; y: number }, amount: number) {
    const p = 'left' in from ? { x: from.left + from.width / 2, y: from.top + from.height / 2 } : from;
    this.fly(`${sprite('coin', 3)}<b class="fly-amt">+${fmt(amount)}</b>`, p, $(this.root, '.goldbox'), '#f2c14e');
  }

  private coach(text: string, anchor: string) {
    const c = $(this.root, '.coach');
    c.textContent = text;
    c.dataset.anchor = anchor;
    c.hidden = false;
  }

  private feed(html: string, cls = '') {
    const box = $(this.root, '.feed');
    const el = document.createElement('div');
    el.className = `feed-line ${cls}`;
    el.innerHTML = html;
    box.append(el);
    setTimeout(() => el.classList.add('out'), 5500);
    setTimeout(() => el.remove(), 6000);
    while (box.children.length > 6) box.firstElementChild!.remove();
  }

  private banner(html: string, ms = 2400) {
    const now = performance.now();
    if (now < this.bannerUntil) {
      if (this.bannerQueue.length < 3) this.bannerQueue.push(html);
      return;
    }
    const el = $(this.root, '.banner');
    el.innerHTML = html;
    el.style.setProperty('--dur', `${ms}ms`);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    this.bannerUntil = now + ms;
    setTimeout(() => {
      const next = this.bannerQueue.shift();
      if (next) {
        this.bannerUntil = 0;
        this.banner(next);
      }
    }, ms + 50);
  }

  showOffline(o: OfflineSummary) {
    const gear = o.levels.filter((l) => l.to > l.from).map((l) => {
      const it = this.game.s.equipped[l.slot];
      return `<div class="off-row"><span class="cell r${it.rarity}" style="--rc:${RARITY_COLORS[it.rarity]}">${itemIcon(it, 2)}</span><span>${SLOT_LABEL[l.slot]}</span><b>Lv ${l.from} → ${l.to}</b></div>`;
    }).join('');
    const kept = o.kept.slice(0, 6).map((it) => `<span class="cell r${it.rarity}" style="--rc:${RARITY_COLORS[it.rarity]}">${itemIcon(it, 2)}</span>`).join('');
    const m = $(this.root, '.modal');
    m.innerHTML = `
      <div class="modal-card pnl gold">
        <small class="kicker">While you were away</small>
        <h2>${duration(o.seconds)}</h2>
        <div class="off-stats">
          <div><b>${fmt(o.kills)}</b><small>Slain</small></div>
          <div><b>${fmt(o.gold)}</b><small>Gold</small></div>
          <div><b>${o.drops}</b><small>Items</small></div>
        </div>
        ${gear}
        ${o.awakened.map((a) => `<div class="off-aw">${G.star()} ${esc(a)}</div>`).join('')}
        ${kept ? `<div class="off-kept"><small>New in your bag</small><div>${kept}</div></div>` : ''}
        ${o.equipped ? `<p class="muted small">${o.equipped} upgrades were equipped automatically.</p>` : ''}
        <button class="btn primary wide" data-action="close-modal">Continue</button>
      </div>`;
    m.hidden = false;
  }

  // ---------- per tick ----------

  update() {
    const g = this.game;
    const st = g.stats();
    const hp = Math.max(0, g.heroHp / st.maxHp);
    $(this.root, '.hp-fill').style.width = pct(hp, 1);
    $(this.root, '.hp').classList.toggle('low', hp < 0.3);
    this.set('hp', `${fmt(Math.max(0, g.heroHp))} / ${fmt(st.maxHp)}`);
    $(this.root, '.hb-top').title = `Damage ${fmt(st.damage)} · Guard ${fmt(st.guard)} · Crit ${pct(st.critChance)} ×${st.critMult.toFixed(1)} · ${st.aps.toFixed(2)} attacks/s`;
    this.set('gold', fmt(g.s.gold));
    const cap = g.bagCapacity();
    this.set('bagcount', `${g.s.bag.length}/${cap}`);
    this.set('bagcount2', `${g.s.bag.length}/${cap}`);

    const fresh = g.s.bag.filter((i) => i.fresh);
    const badge = $(this.root, '.badge');
    const hasUp = fresh.some((i) => g.verdictFor(i).kind === 'upgrade');
    badge.hidden = fresh.length === 0;
    badge.classList.toggle('up', hasUp);
    badge.textContent = hasUp ? '!' : String(fresh.length);
    this.renderStage();
    this.renderHeroLine();
    this.checkTips();
    if (!$(this.root, '.menu').hidden) this.renderSettings();
    this.renderSkills();
    this.root.querySelector('[data-ping=dailies]')!.classList.toggle('on', dailiesReady(g) > 0);
    this.root.querySelector('[data-ping=hero]')!.classList.toggle('on', heroReady(g));
    if (!$(this.root, '.dailies').hidden) this.renderDailies();
    if (!$(this.root, '.heropanel').hidden) this.renderHeroPanel();

    const coach = $(this.root, '.coach');
    if (this.hints.bag) coach.hidden = true;

    this.renderStreak();
    this.renderSlots();
    this.renderForge();
    if (!$(this.root, '.bag').hidden) this.renderBag();
  }

  /** Live kill-streak counter; pops on every increase, lingers briefly when it ends. */
  private renderStreak() {
    const n = this.game.streak;
    const el = $(this.root, '.streak');
    if (n >= 5) {
      el.hidden = false;
      el.classList.remove('done');
      if (n !== this.shownStreak) {
        el.querySelector('b')!.textContent = String(n);
        el.classList.toggle('hot', n >= 15);
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      }
    } else if (!el.classList.contains('done')) el.hidden = true;
    this.shownStreak = n;
  }

  private toggleMusic() {
    const set = this.game.s.settings;
    set.music = set.music === false;
    this.cb.onMusic(set.music);
    this.cb.sfx('toggle');
    this.renderSound();
  }

  private renderSound() {
    $(this.root, '.music-btn').textContent = `Music: ${this.game.s.settings.music === false ? 'off' : 'on'} (N)`;
    const b = $(this.root, '.snd');
    b.innerHTML = this.game.s.settings.muted ? G.mute() : G.sound();
    b.parentElement!.classList.toggle('off', this.game.s.settings.muted);
  }

  private renderSettings() {
    const g = this.game;
    const set = g.s.settings;
    for (const el of this.root.querySelectorAll<HTMLInputElement>('[data-set]')) {
      if (document.activeElement === el) continue;
      el.value = String(Math.round(((set as unknown as Record<string, number | undefined>)[el.dataset.set!] ?? (el.dataset.set === 'musicVol' ? 0.7 : 0.8)) * 100));
    }
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-action=setting]')) b.classList.toggle('on', set[b.dataset.id as 'shake' | 'hitstop'] !== false);
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-action=numbers]')) b.classList.toggle('on', (set.numbers ?? 'all') === b.dataset.id);
    const live = g.liveStats();
    const t = Math.floor(g.s.playTime ?? 0);
    $(this.root, '.live-stats').innerHTML = `
      <div><small>Damage / sec</small><b>${fmt(live.dps)}</b></div>
      <div><small>Kills / min</small><b>${Math.round(live.kpm)}</b></div>
      <div><small>Gold / hour</small><b>${fmt(live.goldPerHour)}</b></div>
      <div><small>Total kills</small><b>${fmt(g.s.totalKills)}</b></div>
      <div><small>Time played</small><b>${Math.floor(t / 3600)}h ${Math.floor((t % 3600) / 60)}m</b></div>
      <div><small>Rebirths</small><b>${g.s.prestige.rebirths}</b></div>`;
  }

  /** One gentle tip at a time, each shown once, when it becomes relevant. */
  private checkTips() {
    const g = this.game;
    const tip = $(this.root, '.tip');
    const busy = PANELS.some((p) => !$(this.root, p).hidden) || !$(this.root, '.modal').hidden;
    if (g.idleInput < 1) this.hint('manual');
    const tips: { id: string; when: boolean; text: string; at: string; below: boolean }[] = [
      { id: 'challenge', when: g.mode === 'hunt' && g.s.maxStage <= 2 && g.s.totalKills >= 25, text: 'Ready for more? Press <b>Challenge</b> to fight your way to the next stage.', at: '.stage-action', below: true },
      { id: 'skills', when: g.s.heroLevel >= 8, text: 'New skill unlocked! Skills fire on their own, or press <b>1–5</b>.', at: '.skills', below: false },
      { id: 'dailies', when: g.s.maxStage >= 4, text: 'Dailies are open: dungeons and a world boss that refresh every day. <b>(J)</b>', at: '[data-action=dailies]', below: true },
      { id: 'manual', when: (g.s.playTime ?? 0) > 180, text: 'Take control any time: <b>A/D</b> move, <b>W</b> jump, <b>S</b> drop.', at: '.hotbar', below: false },
      { id: 'rebirth', when: g.canRebirth(), text: 'You can <b>rebirth</b> now for soul shards and permanent talents. <b>(T)</b>', at: '[data-action=heropanel]', below: true },
    ];
    const next = tips.find((t) => t.when && !this.hints[t.id]);
    if (!next || busy) {
      tip.hidden = true;
      return;
    }
    if (tip.dataset.id !== next.id) {
      tip.dataset.id = next.id;
      tip.querySelector('p')!.innerHTML = next.text;
      tip.querySelector<HTMLElement>('[data-action=tip-ok]')!.dataset.id = next.id;
    }
    tip.hidden = false;
    const r = this.root.querySelector(next.at)?.getBoundingClientRect();
    if (!r) return;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)))}px`;
    tip.style.top = `${Math.round(next.below ? r.bottom + 12 : r.top - h - 12)}px`;
    tip.classList.toggle('below', next.below);
  }

  private renderStage() {
    const g = this.game;
    this.set('chapter', g.mode === 'dungeon' ? 'Dungeon' : g.mode === 'worldboss' ? 'World boss' : `Chapter ${chapterOf(g.s.stage)} · ${chapterName(g.s.stage)}`);
    this.set('stage', g.mode === 'hunt' || g.mode === 'challenge' ? `Stage ${stageLabel(g.s.stage)}` : g.run?.kind === 'dungeon' ? `Floor ${g.run.floor}` : `Lv ${g.s.daily.wbLevel}`);
    $(this.root, '.stagebox').classList.toggle('boss', isBossStage(g.s.stage) && g.mode === 'challenge');
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-action^=stage-]')) b.disabled = g.mode !== 'hunt';
    // Buttons only re-render when their state changes; live run progress re-renders every tick.
    const sig = g.run ? `run${Math.ceil(g.run.timer)}:${g.run.kills}:${g.run.phase}:${Math.round(g.run.dealt)}` : `hunt${g.s.stage}:${g.s.maxStage}:${+g.s.settings.autoChallenge}`;
    if (sig !== this.sig.stage) {
      this.sig.stage = sig;
      $(this.root, '.stage-action').innerHTML = stageAction(g);
    }
  }

  private renderHeroLine() {
    const g = this.game;
    const k = g.kit;
    this.set('heroname', k.name);
    this.set('herolv', String(g.s.heroLevel));
    $(this.root, '.hxp i').style.width = pct(g.s.heroXp / heroXpToNext(g.s.heroLevel), 1);
    const face = $(this.root, '.hero-face');
    if (face.dataset.hero !== g.s.hero) {
      face.dataset.hero = g.s.hero;
      face.innerHTML = portrait(g.s.hero, 1);
      $(this.root, '.hero-ico').innerHTML = portrait(g.s.hero, 1);
    }
    this.root.querySelector('[data-action=auto]')!.classList.toggle('on', g.s.settings.auto);
    $(this.root, '.hotbar').classList.toggle('manual', g.manual);
  }

  private renderSkills() {
    const g = this.game;
    const box = $(this.root, '.skills');
    const sig = `${g.s.hero}:${g.activeSkills().length}:${g.kit.skills.filter((s) => s.level <= g.s.heroLevel).length}`;
    if (sig !== this.sig.skills) {
      this.sig.skills = sig;
      box.innerHTML = skillBar(g);
    }
    for (const b of box.querySelectorAll<HTMLElement>('[data-skill]')) {
      const sk = g.kit.skills.find((s) => s.id === b.dataset.skill)!;
      const left = g.cooldowns[sk.id] ?? 0;
      const frac = left / (sk.cooldown * g.mods().sigCooldown);
      b.querySelector<HTMLElement>('.cd')!.style.height = pct(Math.max(0, frac), 1);
      b.classList.toggle('ready', left <= 0);
    }
  }

  private renderDailies() {
    const g = this.game;
    const d = g.s.daily;
    const sig = JSON.stringify([d.keys, d.best, d.wbAttempts, d.wbLevel, Object.values(d.tasks).map(Math.floor), d.claimed, d.stamps, g.mode]);
    if (sig === this.sig.dailies) return;
    this.sig.dailies = sig;
    $(this.root, '.dailies-body').innerHTML = dailiesPanel(g);
  }

  private renderHeroPanel() {
    const g = this.game;
    const p = g.s.prestige;
    const sig = `${this.heroTab}:${g.s.hero}:${g.s.heroLevel}:${p.shards}:${JSON.stringify(p.ranks)}:${g.canRebirth()}:${g.s.maxStage}`;
    if (sig === this.sig.hero) return;
    this.sig.hero = sig;
    $(this.root, '.hero-body').innerHTML = heroPanel(g, this.heroTab);
  }

  /** First launch: pick a class. */
  showClassPicker() {
    const m = $(this.root, '.modal');
    m.innerHTML = classPicker();
    m.hidden = false;
  }

  private renderSlots() {
    const g = this.game;
    const box = $(this.root, '.slots');
    const sig = SLOTS.map((s) => `${g.s.equipped[s].id}:${g.s.equipped[s].level}`).join();
    if (sig !== this.sig.slots) {
      const prev = this.sig.slots;
      this.sig.slots = sig;
      box.innerHTML = SLOTS.map((s) => {
        const it = g.s.equipped[s];
        const maxed = it.level >= it.cap;
        const leveled = prev && !prev.includes(`${it.id}:${it.level}`);
        const gems = it.awakenings.map((a) => `<i class="${a.level <= it.level ? 'on' : ''}"></i>`).join('');
        return `
          <button class="slot cell r${it.rarity} ${maxed ? 'maxed' : ''} ${leveled ? 'lvup' : ''}" data-slot="${s}" style="--rc:${RARITY_COLORS[it.rarity]}" aria-label="${SLOT_LABEL[s]}">
            ${itemIcon(it, 2)}
            <span class="gems">${gems}</span>
            <span class="lv">${maxed ? 'MAX' : it.level}</span>
            <span class="xp"><i data-xp="${s}"></i></span>
          </button>`;
      }).join('');
    }
    for (const s of SLOTS) {
      const it = g.s.equipped[s];
      const fill = box.querySelector<HTMLElement>(`[data-xp="${s}"]`);
      if (fill) fill.style.width = it.level >= it.cap ? '100%' : pct(it.xp / xpToNext(it.level), 1);
    }
  }

  private renderForge() {
    const g = this.game;
    const ids = Object.keys(UPGRADES) as UpgradeId[];
    const can = ids.some((id) => g.s.upgrades[id] < UPGRADES[id].max && g.s.gold >= UPGRADES[id].cost(g.s.upgrades[id]));
    this.root.querySelector('[data-action=forge] .ping')!.classList.toggle('on', can);
    if ($(this.root, '.forge').hidden) return;
    const sig = ids.map((id) => g.s.upgrades[id]).join() + (can ? 1 : 0);
    const box = $(this.root, '.upgrades');
    if (sig !== this.sig.forge) {
      this.sig.forge = sig;
      box.innerHTML = ids.map((id) => {
        const u = UPGRADES[id];
        const lvl = g.s.upgrades[id];
        const maxed = lvl >= u.max;
        const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
        return `
          <div class="up-row">
            <div class="up-main"><b>${u.name}</b><span class="pips">${pips}</span><p>${u.desc(lvl)}</p></div>
            <button class="btn cost" data-action="buy" data-id="${id}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : `${sprite('coin', 2)}${fmt(u.cost(lvl))}`}</button>
          </div>`;
      }).join('');
    }
    for (const b of box.querySelectorAll<HTMLButtonElement>('[data-action=buy]')) {
      const id = b.dataset.id as UpgradeId;
      b.classList.toggle('afford', g.s.upgrades[id] < UPGRADES[id].max && g.s.gold >= UPGRADES[id].cost(g.s.upgrades[id]));
    }
  }

  private renderBag() {
    const g = this.game;
    const set = g.s.settings;
    const fsig = `${set.keepRarity}${+set.salvageWorse}${+set.autoEquip}`;
    if (fsig !== this.sig.filters) {
      this.sig.filters = fsig;
      $(this.root, '.filters').innerHTML = `
        <div class="seg"><span class="seg-lbl">Keep</span>${KEEP_LABELS.map((l, i) =>
          `<button class="btn seg-btn ${set.keepRarity === i ? 'on' : ''}" data-action="keep" data-id="${i}" style="--rc:${RARITY_COLORS[i]}">${l}</button>`).join('')}</div>
        <div class="opts">
          <button class="btn chk ${set.salvageWorse ? 'on' : ''}" data-action="opt" data-id="salvageWorse"><i>${G.check()}</i>Auto-salvage worse</button>
          <button class="btn chk ${set.autoEquip ? 'on' : ''}" data-action="opt" data-id="autoEquip"><i>${G.check()}</i>Auto-equip upgrades</button>
        </div>`;
    }

    const bag = g.s.bag;
    const cap = g.bagCapacity();
    const sig = bag.map((i) => `${i.id}${i.fresh ? '*' : ''}`).join() + `|${this.selected}|` + SLOTS.map((s) => `${g.s.equipped[s].id}:${g.s.equipped[s].level}`).join() + fsig;
    if (sig !== this.sig.bag) {
      this.sig.bag = sig;
      const cells = [];
      for (let i = 0; i < cap; i++) {
        const it = bag[i];
        if (!it) {
          cells.push(`<div class="cell empty"></div>`);
          continue;
        }
        const v = g.verdictFor(it).kind;
        cells.push(`
          <button class="cell item r${it.rarity} ${this.selected === it.id ? 'sel' : ''} ${it.fresh ? 'fresh' : ''} ${g.filtered(it) ? 'junk' : ''}" data-action="select" data-id="${it.id}" style="--rc:${RARITY_COLORS[it.rarity]}" aria-label="${esc(it.name)}">
            ${itemIcon(it, 3)}
            <span class="vd ${v}">${v === 'upgrade' ? G.up() : v === 'potential' ? G.star() : G.down()}</span>
          </button>`);
      }
      $(this.root, '.grid').innerHTML = cells.join('');
      this.renderDetail();
    }
  }

  private renderDetail() {
    const g = this.game;
    const box = $(this.root, '.detail');
    const it = g.s.bag.find((i) => i.id === this.selected);
    const junk = g.s.bag.filter((i) => g.filtered(i));
    const junkGold = junk.reduce((a, i) => a + goldValue(i), 0);
    const footer = `<button class="btn wide" data-action="salvage-filtered" ${junk.length ? '' : 'disabled'}>Salvage ${junk.length} filtered ${junk.length ? `· ${sprite('coin', 2)}${fmt(junkGold)}` : ''}</button>`;
    if (!it) {
      box.innerHTML = `
        <div class="empty-detail">
          <p><b>Your bag</b></p>
          <p class="muted small">Chests, elites and bosses drop gear. Each item shows a verdict:</p>
          <p class="small"><span class="up-t">${G.up()} Upgrade</span> stronger right now</p>
          <p class="small"><span class="pot-t">${G.star()} Potential</span> weaker now, grows past yours</p>
          <p class="small"><span class="bad-t">${G.down()} Worse</span> never catches up</p>
        </div>${footer}`;
      return;
    }
    const cur = g.s.equipped[it.slot];
    const v = g.verdictFor(it);
    box.innerHTML = `
      <div class="detail-scroll">
      ${itemHead(it)}
      ${verdictBlock(v, cur)}
      ${curve(it, v, cur)}
      <div class="kv"><span>Power if equipped</span><b>${fmt(v.now)} <span class="muted">Lv ${v.startLevel}</span></b></div>
      <div class="kv"><span>Max power</span><b>${fmt(v.peak)} <span class="muted">Lv ${it.cap}</span></b></div>
      <div class="kv"><span>Growth</span><b>+${((it.growth - 1) * 100).toFixed(1)}% / level</b></div>
      <div class="vs"><span class="cell r${cur.rarity}" style="--rc:${RARITY_COLORS[cur.rarity]}">${itemIcon(cur, 2)}</span><span>Wearing <b style="color:${RARITY_COLORS[cur.rarity]}">${esc(cur.name)}</b> · ${fmt(v.current)} · Lv ${cur.level}/${cur.cap}</span></div>
      <div class="sep">Awakenings</div>
      ${awakeningList(it, v.startLevel)}
      </div>
      <div class="actions">
        <button class="btn primary" data-action="equip">Equip <kbd>E</kbd></button>
        <button class="btn" data-action="salvage">Salvage ${sprite('coin', 2)}${fmt(goldValue(it))} <kbd>X</kbd></button>
      </div>
      ${footer}`;
  }
}
