import { morph } from './morph.ts';
import { ABILITIES, ABILITY_BY_ID, ABILITY_BY_UPGRADE, CURSE_BY_ID, CURSE_FLOORS, CURSES_FROM, LEVEL_BONUS, levelMult, milestoneAt, milestoneMult, LEGENDS, LEGEND_BY_ID, OFFER_SIZE, RESPEC_REFUND, legendCost, legendShare, type LegendDef, type LegendId, traitLevels, type AbilityId, CARDS, CARD_BY_ID, cardName, COMPS, CORRUPTION, ZONES, CURSORS, BOUND, boundCost, boundName, type BoundDef, type BoundId, MODS, MOD_BY_ID, NEWS, RARITY, RELICS, RELIC_BY_ID, ROMAN, TROPHIES, UPG_BY_ID, nextMilestone, bandFor, bossFor, featuredFor, cardId, corruptionOf, lapOf, relicStars, relicText, zoneName, zoneOf, type Icon, type ModId, type UpgDef } from '../game/data.ts';
import Decimal from 'break_infinity.js';
import { duration, fmt, setNotation } from '../game/format.ts';
import { AWAKEN_ON, AWAKEN_TEASE, GOLD_SET_BONUS, SET_BONUS, CURSES_ON, DAN_GIVES, VICTOR_GIVES, DESCEND_FLOOR, EXPEDITION_LEVEL, MARK_MOVE, MARK_POWER, MARK_REROLL, RELICS_ON, TRIP_HOURS, TUNE, giftVia, isBossFloor, type BankedBy, type Buff, type Game, type GameEvent, type OfflineSummary } from '../game/game.ts';
import type { Drop, Scene } from '../render/scene.ts';
import { KeepView, type KeepStation } from './keep.ts';
import { CARD_FRAME } from '../render/cards.ts';
import type { SfxName } from '../audio/sfx.ts';
import { G, cardArt, charFit, silhouette, sprite, spriteFit, spriteFrames } from './px.ts';
import { DEMO, DEMO_COMPANIONS, STEAM_URL, WIKI_URL } from '../demo.ts';

export interface UiHooks {
  sound: (name: SfxName, o?: { vol?: number; rate?: number; jitter?: number }) => void;
  save: () => void;
  settings: () => void;
  exportSave: () => string;
  importSave: (text: string) => boolean;
  reset: () => void;
  /** Back to the main menu (the run is saved first). */
  mainMenu: () => void;
  /** You're in the kid's room (or back out of it): the dungeon waits. `awayCounts` settles the time spent like time
   *  away (not after an awakening, which starts the run over). */
}

const TIER_COLORS = ['#b8a58a', '#7ddb6a', '#5fa8ff', '#c77dff', '#f2c14e', '#ff8a3d', '#ec5a4f', '#ff5ac8', '#9cf0ff', '#ffffff', '#ffe08a'];
const REWARD_TEXT: Record<string, string> = { plunder: 'Treasure!', bloodlust: 'Bloodlust!', heartstorm: 'Frenzy!', horde: 'Gold Rush!', soulstorm: 'Soul Storm!', vault: 'Rainbow Vault!', rainbow: 'Rainbow Haul!' };
/** Writes text only when it changed: rewriting the same text still costs the page a relayout. */
const setText = (el: Element, text: string) => {
  if (el.textContent !== text) el.textContent = text;
};
const MAX_POPS = 90;
const MAX_POPS_LOW = 30;
const GRAPHICS_NAME = { auto: 'Auto', high: 'High', low: 'Low' } as const;
/** Hits on one monster less than this many seconds apart are a streak; from the ARC_FROM-th hit of a streak on, its
 *  numbers arc out of the monster away from your hero, each landing a little further out, fanning into a rainbow. */
const STREAK_GAP = 0.25;
const ARC_FROM = 3;
const RARITY_COLORS = ['#c9b8a0', '#5fa8ff', '#c77dff', '#ffb13d'];

/** Little colored labels for boss modifiers. */
const modChips = (mods: ModId[]) => mods.map((id) => `<em class="mod" style="--mc:${MOD_BY_ID.get(id)!.color}">${MOD_BY_ID.get(id)!.name}</em>`).join('');
const MAX_COINS = 24;
/** How often a rare ticker line (the hints that it's all a dream) is in the running. */
const RARE_NEWS = 0.15;
/** The star tip waits until the pointer comes back onto a monster at least this long after someone to switch to is hired. */
const STAR_WAIT_MS = 1000;
/** How long your first Heartmark is pointed out. */
const MARK_TIP_MS = 8000;
/** How long Flurry is pointed out once it unlocks (it goes as soon as it's used). */
const FLURRY_TIP_MS = 6000;
/** How close your hero or the cursor has to come to a coin to pick it up (px). */
const COIN_REACH = 52;
/** Coins start leaning toward whoever's collecting from this far out (px). */
const COIN_MAGNET = 110;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** `badge`: the tier's numeral in the corner (left off in tooltips, which sit beside the badged icon already). */
function icon(i: Icon, box = 36, badge = true): string {
  // Two companions (a synergy): side by side, a little overlapped.
  if (i.sub) return `<span class="ico pair">${charFit(i.sprite, box * 0.8)}${charFit(i.sub, box * 0.8)}</span>`;
  const tier = badge && i.tier !== undefined ? `<b class="tier" style="--tc:${TIER_COLORS[i.tier]}">${ROMAN[i.tier]}</b>` : '';
  return `<span class="ico">${spriteFit(i.sprite, box)}${tier}</span>`;
}

/** A monster card as it sits in the collection: one you don't have yet is a dark silhouette. */
function cardFace(card: (typeof CARDS)[number], state: 'locked' | 'got', gilded = false, box = 44, lap = 0): string {
  const frame = gilded ? CARD_FRAME.gold : CARD_FRAME[card.kind];
  const art = cardArt(card, box, state === 'got' && card.id === 'rainbow-goblin' ? 'rainbow' : '', lap);
  return `<span class="mcard ${state}${gilded ? ' gilded' : ''}" style="--fc:${frame}"><span class="mc-art">${art}</span><span class="mc-name">${state === 'locked' ? '???' : esc(card.name)}</span></span>`;
}

const KIND_NAME = { power: 'Power', utility: 'Utility', sink: 'Sink' } as const;

type Trader = 'dan' | 'victor';
/** What Dan and Victor say: one picked at random. */
const TRADER_LINES: Record<Trader, Record<'hello' | 'short' | 'new' | 'dupe', string[]>> = {
  dan: {
    hello: ['Got any doubles?', 'Swap you?'],
    short: ['Come back with five cards.'],
    new: ["That one's new for you!", 'Nice, a new one.'],
    dupe: ['Ah, you had that one.', 'A double. Sorry!'],
  },
  victor: {
    hello: ["Gold isn't cheap.", 'Ten. Not nine.'],
    short: ['Come back with ten.'],
    new: ["Don't get used to it.", 'Shiny, right?'],
    dupe: ['No refunds.', 'You had that one. Not my problem.'],
  },
};
const pickLine = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

/** What a Spirit boosts, a companion skill it names underlined (hover it for what the skill is and does). */
function skillText(what: string) {
  let out = esc(what);
  for (const a of ABILITIES) {
    const phrase = a.id === 'crit' ? 'Critical hit' : a.name;
    if (out.includes(phrase)) out = out.replace(phrase, `<span class="skill-u" data-tip="skill:${a.id}">${phrase}</span>`);
  }
  return out;
}

/** A Legend in full: what it boosts and by how much now (level 1, if not summoned), the next four levels with their
 *  cost, and the rule worth knowing. */
function legendDetail(d: LegendDef, lv: number): string {
  const now = Math.max(1, lv);
  const rows = Array.from({ length: 4 }, (_, k) => now + 1 + k)
    .filter((n) => !d.maxLv || n <= d.maxLv)
    .map((n) => `<tr><td>Level ${n}</td><td>${G.soul(1.2)} ${fmt(legendCost(d, n - 1))}</td><td>${esc(d.value(n))}</td></tr>`).join('');
  return `<p class="od-what">${skillText(d.what)}: <b class="od-now">${esc(d.value(now))}</b>${lv ? '' : ' at level 1'}</p>
    ${rows ? `<table class="od-lv">${rows}</table>` : ''}
    ${d.maxLv ? `<p class="od-max">Max level ${d.maxLv}</p>` : ''}
    ${d.note ? `<p class="od-note">${esc(d.note)}</p>` : ''}`;
}

/** The figures behind a Spirit's pedestal: a few soul wisps, placed by index so a re-render draws the same ones. */
const WISPS = Array.from({ length: 7 }, (_, k) =>
  `<i style="--x:${10 + ((k * 37) % 80)}%;--d:${(2.4 + ((k * 13) % 22) / 10).toFixed(1)}s;--w:${-((k * 29) % 40) / 10}s;--s:${(0.6 + ((k * 7) % 8) / 10).toFixed(1)}"></i>`).join('');

/** One of the Bound in full: what it boosts now, and the next four levels with their price and what each gives. */
function boundDetail(b: BoundDef, lv: number): string {
  const rows = Array.from({ length: 4 }, (_, k) => lv + 1 + k)
    .filter((n) => b.max === undefined || n <= b.max)
    .map((n) => `<tr><td>Level ${n}</td><td>${boundGlyph(1.2)} ${fmt(boundCost(b, n - 1))}</td><td>${esc(b.value(n))}</td></tr>`).join('');
  return `<p class="od-what">${esc(b.what)}: <b class="od-now bnd">${lv ? esc(b.value(lv)) : '—'}</b></p>
    ${rows ? `<table class="od-lv">${rows}</table>` : ''}
    ${b.max !== undefined ? `<p class="od-max">Max level ${b.max}</p>` : ''}`;
}

/** A gold card's dazzle, as champions shed it in the dungeon: a breathing aura, pixel stars twinkling round the card
 *  and motes rising off it, placed by index so every gold card glitters the same way. */
const STAR = '<svg viewBox="0 0 7 7" shape-rendering="crispEdges"><path fill="currentColor" d="M3 0h1v2H3zM2 2h3v1H2zM0 3h7v1H0zM2 4h3v1H2zM3 5h1v2H3z"/></svg>';
const GOLD_DAZZLE = `<span class="cr-dazzle"><i class="cr-aura"></i>${Array.from({ length: 11 }, (_, k) => {
  // Round the card's edge, a little in and out.
  const a = (k / 11) * Math.PI * 2 + 0.4;
  const x = 50 + Math.cos(a) * (46 + ((k * 17) % 14));
  const y = 50 + Math.sin(a) * (44 + ((k * 23) % 12));
  return `<i class="cr-star" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--d:${(1.1 + ((k * 7) % 9) / 10).toFixed(1)}s;--w:${(0.7 + ((k * 13) % 15) / 10).toFixed(1)}s;--s:${(0.7 + ((k * 5) % 7) / 10).toFixed(1)}">${STAR}</i>`;
}).join('')}${Array.from({ length: 22 }, (_, k) =>
  `<i class="cr-mote" style="--x:${8 + ((k * 37) % 84)}%;--d:${(1.6 + ((k * 11) % 12) / 10).toFixed(1)}s;--w:${(0.6 + ((k * 19) % 20) / 10).toFixed(1)}s;--s:${(1 + ((k * 3) % 3) * 0.5).toFixed(1)}"></i>`).join('')}</span>`;

/** The red glitter on each Bound in the awakening: motes rising off it and a few stars twinkling over it. */
const GLINT = `${Array.from({ length: 9 }, (_, k) =>
  `<i class="glint-mote" style="--x:${10 + ((k * 37) % 80)}%;--d:${(1.2 + ((k * 13) % 10) / 10).toFixed(1)}s;--w:${-((k * 29) % 20) / 10}s;--s:${1 + (k % 2)}"></i>`).join('')}${Array.from({ length: 3 }, (_, k) =>
  `<i class="glint-star" style="--x:${[18, 78, 50][k]}%;--y:${[30, 45, 8][k]}%;--d:${(1.1 + k * 0.4).toFixed(1)}s;--w:${(k * 0.5).toFixed(1)}s">${STAR}</i>`).join('')}`;

/** The cursor's badge over something you can use: a little speech bubble. */
const ACT_GLYPH = '<svg viewBox="0 0 9 8" width="27" height="24" shape-rendering="crispEdges" aria-hidden="true"><path fill="#140a12" d="M1 0h7v1H1zM0 1h1v4H0zM8 1h1v4H8zM1 5h2v1H1zM5 5h3v1H5zM2 6h1v2H2zM3 6h2v1H3z"/><path fill="#fff4d6" d="M1 1h7v4H1zM3 5h2v1H3z"/><path fill="#140a12" d="M2 3h1v1H2zM4 3h1v1H4zM6 3h1v1H6z"/></svg>';

/** A mouse with its left button lit: the Keep's use prompt for someone walking with the mouse. */
const MOUSE_GLYPH = '<svg class="k-mouse" viewBox="0 0 9 12" width="18" height="24" shape-rendering="crispEdges" aria-hidden="true"><path fill="#140a12" d="M2 0h5v1H2zM1 1h1v1H1zM7 1h1v1H7zM0 2h1v8H0zM8 2h1v8H8zM1 10h1v1H1zM7 10h1v1H7zM2 11h5v1H2zM4 1h1v4H4zM1 5h7v1H1z"/><path fill="#ffe08a" d="M2 1h2v1H2zM1 2h3v3H1z"/><path fill="#e9d6aa" d="M5 1h2v1H5zM5 2h3v3H5zM1 6h7v4H1zM2 10h5v1H2z"/></svg>';

/** What this many kept souls add to all damage, as a percentage ("+300%"). */
const soulPct = (n: number) => `+${fmt(n * TUNE.soulPower * 100)}%`;

/** The skills you press, in column order: their number keys (passive abilities don't get one). */
const KEYED = ABILITIES.filter((a) => a.kind !== 'passive').map((a) => a.id);
const abilityKey = (id: AbilityId) => KEYED.indexOf(id) + 1;

/** "4:05" for a cooldown. */
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.ceil(s % 60) % 60).padStart(2, '0')}`;

const gold = (n: number | Decimal, cls = '') => `<span class="gold ${cls}">${sprite('coin', 2)}${fmt(n)}</span>`;

/** What it takes to meet a companion who hasn't joined yet. */
const meetText = (def: { floor: number; heart?: number }, cycleBest: number) =>
  DEMO ? 'In the full game'
    : cycleBest < def.floor ? `Reach floor ${fmt(def.floor)} to meet them` : `Awaken the Heart ${def.heart}× to meet them`;

/** A relic's stars, as little gold glyphs after its name. */
/** A small rate with up to two decimals (1.15, not 1.1); big ones as usual. */
const perSec = (n: number) => (n < 100 ? String(Math.round(n * 100) / 100) : fmt(n));
const starsOf = (lv: number) => (relicStars(lv) ? ` <span class="stars">${'★'.repeat(relicStars(lv))}</span>` : '');

function buffText(b: Buff) {
  if (b.id === 'cleave') return 'clicks hit every monster';
  if (b.id === 'flurry') return '10 clicks a second';
  if (b.id === 'drums') return '+50% critical hits';
  if (b.id === 'legion') return 'a blade for every monster';
  if (b.blade && b.blade > 1) return `Phantom Blade ×${b.blade}`;
  if (b.dps > 1 && b.click > 1) return `×${b.dps} damage`;
  if (b.dps > 1) return `×${b.dps} companion damage`;
  if (b.click > 1) return `×${b.click} click damage`;
  return `×${b.gold} gold`;
}

const MAP_ROOMS = 5;

/** A tiny pixel-art icon from rows of '#' (filled) and '.' (empty), drawn in the current text color. */
function pixelIcon(rows: string[]) {
  const cells = rows.flatMap((row, y) => [...row].map((c, x) => (c === '#' ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : '')));
  return `<svg class="pxi" viewBox="0 0 ${rows[0].length} ${rows.length}" style="--w:${rows[0].length}" shape-rendering="crispEdges">${cells.join('')}</svg>`;
}
const SKULL = pixelIcon(['.#####.', '#######', '#..#..#', '#######', '.##.##.', '.#.#.#.']);
const CROWN = pixelIcon(['#..#..#', '##.#.##', '#######', '#######']);

/** The face of a floor on the map (its boss, or the monster it's known for), tinted as it looks on that lap. */
function floorArt(floor: number, box: number) {
  const def = floor % 5 === 0 ? bossFor(floor) : featuredFor(floor);
  const card = CARD_BY_ID.get(cardId(def.name));
  return card ? cardArt(card, box, 'mon', lapOf(floor)) : charFit(def.sprite, box, box, 'mon');
}

/** A bound soul: the soul glyph in the Heart's red. */
const boundGlyph = (scale = 2) => G.soul(scale).replace('g-soul', 'g-soul g-bound');

/** A Bound standing on its plinth: the boss's first frame, tinted as the dungeon colors it, drawn once and kept. */
const bossFigs = new Map<string, string>();
function bossFig(b: BoundDef, height: number, maxW: number) {
  const boss = ZONES[b.zone].boss;
  if (boss.tint === undefined) return charFit(boss.sprite, height, maxW);
  let url = bossFigs.get(b.id);
  const src = spriteFrames(boss.sprite);
  if (!src) return '';
  const f = src.frames[0];
  if (!url) {
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    const t = c.getContext('2d')!;
    t.drawImage(src.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    t.globalCompositeOperation = 'multiply';
    t.fillStyle = `#${boss.tint.toString(16).padStart(6, '0')}`;
    t.fillRect(0, 0, f.w, f.h);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(src.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    bossFigs.set(b.id, (url = c.toDataURL()));
  }
  const k = Math.min(height / f.h, maxW / f.w);
  return `<img class="px" src="${url}" width="${Math.round(f.w * k)}" height="${Math.round(f.h * k)}" alt="">`;
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
  private floorMaps: HTMLElement[] = [];
  private rows: HTMLElement[] = [];
  private rowCache: string[] = [];
  private tipKey: string | null = null;
  private tipAnchor: HTMLElement | null = null;
  private pops: HTMLElement[] = [];
  /** Per monster: when it was last hit and how many hits its streak has run to. */
  private streaks = new Map<number, { at: number; n: number }>();
  private bars = new Map<number, HTMLElement>();
  /** Gold on the counter, easing toward the real bank. */
  private shown = new Decimal(0);
  /** Coins on their way up to the counter: the gold each carries and when it lands. Kept by the clock, not by the
   *  animation finishing, which a hidden tab can skip, leaving gold counted as in the air for good. */
  private flights: { share: Decimal; lands: number }[] = [];
  private newsT = 0;
  private newsIdx = -1;
  private modal: string | null = null;
  private resetArmed = false;
  private hintState = '';
  /** When the current hint appeared (the hero tips time out). */
  private tourAt = 0;
  /** When the pointer was last on a monster, and when switching heroes first became possible: the star tip waits
   *  until you're back in the fight after hiring someone to switch to. */
  private onMonsterAt = 0;
  private starFrom = 0;
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
  /** The five floors the map is paged to (null: the ones you're on). */
  private mapPage: number | null = null;
  private mapFloor = 0;
  /** Deepest floor the map last showed, so a newly opened room can light up. */
  private mapMax = 0;
  private mapSlide: 'prev' | 'next' | '' = '';
  private bladeSprite = '';
  /** Touch screens: long-press shows a tooltip instead of hover. */
  private touch = matchMedia('(pointer: coarse)').matches;
  private pressTimer = 0;
  private pressed = false;
  private pressAt = { x: 0, y: 0 };
  private hudTop = 0;
  private pendingZone = 0;
  /** Relics found for the first time since the relic screen was last opened. */
  private newRelics = 0;
  /** Relics that levelled up since the relic screen was last closed: their level glows once when it opens. */
  private levelledRelics = new Set<string>();
  private newCards = 0;
  /** The card collection being looked at: which lap's cards, and the gold copies or the ordinary ones. */
  private cardLap = 0;
  private cardGold = false;
  /** Cards found while away, revealed once the welcome-back panel is collected. */
  private offlineCards: Extract<Drop, { t: 'card' }>[] = [];
  /** Boss floors whose boss has been announced this session (it's only announced on a floor never beaten). */
  private bossAnnounced = new Set<number>();
  private lootTimer = 0;
  private toldAwaken = false;

  constructor(root: HTMLElement, game: Game, scene: Scene, hooks: UiHooks) {
    this.root = root;
    this.game = game;
    this.scene = scene;
    this.hooks = hooks;
    root.innerHTML = `
      <div class="hud-top">
        <div class="bank" data-tip="idle:patient"><span class="bank-ico">${sprite('coin', 5)}</span><b class="bank-v">0</b></div>
        <div class="rate"><span class="dps-w" data-tip="idle:sleeper"><b class="dps-v">0</b> <i class="long">damage/sec</i><i class="short">dps</i></span><span class="sep">·</span><span><b class="click-v">1</b> <i class="long">per click</i><i class="short">/click</i></span></div>
        <div class="streak"><i>Streak</i> <b class="streak-v">0</b> <span class="sep">·</span> <b class="streak-b"></b></div>
        <div class="floor pnl">
          <button class="btn icon sm" data-act="floorDown" aria-label="Previous floor">${G.left()}</button>
          <div class="floor-mid">
            <div class="floor-name" data-tip="floor"><b class="floor-n">Floor 1</b><span class="floor-sub"></span></div>
            <div class="floor-map"></div>
            <div class="floor-bar"><i></i><span></span></div>
          </div>
          <button class="btn icon sm" data-act="floorUp" aria-label="Next floor">${G.right()}</button>
          <button class="btn small auto" data-act="auto" data-tip="auto">Auto</button>
        </div>
        <div class="fever on" hidden><i></i><span></span><b class="fever-face">${charFit(COMPS[ABILITY_BY_ID.get('rampage')!.comp].sprite, 26)}</b></div>
        <div class="buffs"></div>
      </div>
      <div class="zone-map pnl"><button class="btn icon sm" data-act="zonePrev" aria-label="Earlier floors">${G.left()}</button><div class="floor-map"></div><button class="btn icon sm" data-act="zoneNext" aria-label="Later floors">${G.right()}</button></div>
      <div class="bars"></div>
      <div class="hint" hidden></div>
      <button class="btn vault-leave" data-act="leaveVault" hidden>Leave the vault</button>
      <div class="vault-pick" hidden><b>A rainbow portal has appeared!</b><span>Choose a companion to send in</span><div class="vp-faces"></div></div>
      <div class="hero-mark" hidden>▼</div>
      <div class="raid-mark" hidden><b>!</b></div>
      <div class="exit-mark" hidden><i>▲</i><b>Way out</b></div>
      <div class="keep-labels"></div>
      <div class="letterbox" aria-hidden="true"></div>
      <div class="banner" hidden><b></b><span></span></div>
      <div class="loot" hidden></div>
      <div class="ticker"><span></span></div>
      <nav class="dock">
        <button class="btn dock-b" data-open="trophies" data-tip="dock:trophies">${G.trophy(3)}<span>Collection</span><em class="badge new" hidden></em></button>
        <button class="btn dock-b" data-open="relics" data-tip="dock:relics"${RELICS_ON ? '' : ' hidden'}>${G.relic(3)}<span>Relics</span><em class="badge new" hidden></em></button>
        <button class="btn dock-b" data-open="abyss" data-tip="dock:abyss">${G.soul(3)}<span>Ascend</span><em class="badge" hidden></em></button>
        <button class="btn dock-b dock-heart" data-open="heart" data-tip="dock:heart" hidden>${G.heart(3)}<span>The Heart</span><em class="badge bound" hidden></em></button>
        <button class="btn dock-b dock-keep" data-act="keep" data-tip="dock:keep" hidden></button>
        <button class="btn dock-b" data-open="stats" data-tip="dock:stats">${G.stats(3)}<span>Stats</span></button>
        <button class="btn dock-b dock-stat blade-rate" data-tip="dock:blade" tabindex="-1">${spriteFit('weapon_knife', 20, 'glyph')}<span>1/s</span></button>
        <button class="btn dock-b" data-open="settings" data-tip="dock:settings">${G.menu(3)}<span>Options</span></button>
        <button class="btn icon mute" data-act="mute" data-tip="dock:mute" hidden></button>
      </nav>
      <nav class="abilities" aria-label="Abilities"></nav>
      <div class="drops"></div>
      <aside class="shop">
        <header class="shop-head"><h2>Your Party</h2><span class="shop-autos"><button class="btn small auto-upg" data-act="autoUpg" data-tip="shop:auto" hidden></button><button class="btn small auto-upg auto-hire" data-act="autoHire" data-tip="shop:hire" hidden></button></span><span class="sheet-grip" aria-hidden="true"></span></header>
        <div class="modes">
          <span>Hire</span>
          <button class="btn mode" data-mode="1">×1</button><button class="btn mode" data-mode="10">×10</button><button class="btn mode" data-mode="100">×100</button><button class="btn mode" data-mode="next" data-tip="shop:next">Next</button><button class="btn mode" data-mode="-1">Max</button>
        </div>
        <div class="gens"></div>
      </aside>
      <div class="toasts"></div>
      <div class="pops"></div>
      <div class="tip pnl" hidden></div>
      <div class="modal-wrap" hidden><div class="modal pnl"></div></div>
      <div class="curtain" hidden><b></b><span></span></div>
      <div class="blade" hidden><div class="blade-in"></div><i class="blade-act">${ACT_GLYPH}</i></div>
    `;
    const q = (sel: string) => root.querySelector(sel) as HTMLElement;
    this.floorMaps = [...root.querySelectorAll<HTMLElement>('.floor-map')];
    this.el = {
      bank: q('.bank-v'), bankIco: q('.bank-ico'), dps: q('.dps-v'), click: q('.click-v'), rate: q('.rate'), streak: q('.streak'), streakV: q('.streak-v'), streakB: q('.streak-b'), dpsWrap: q('.dps-w'), bankWrap: q('.bank'),
      floorN: q('.floor-n'), floorSub: q('.floor-sub'), floorBar: q('.floor-bar i'), floorBarT: q('.floor-bar span'), floorBox: q('.floor'),
      zonePrev: q('[data-act=zonePrev]'), zoneNext: q('[data-act=zoneNext]'), down: q('[data-act=floorDown]'), up: q('[data-act=floorUp]'), auto: q('[data-act=auto]'),
      fever: q('.fever'), feverBar: q('.fever > i'), feverLabel: q('.fever > span'), buffs: q('.buffs'), bars: q('.bars'), hint: q('.hint'), vaultPick: q('.vault-pick'), vaultLeave: q('.vault-leave'), vaultFaces: q('.vp-faces'), heroMark: q('.hero-mark'), raid: q('.raid-mark'), exitMark: q('.exit-mark'),
      banner: q('.banner'), ticker: q('.ticker span'), shop: q('.shop'),
      autoUpg: q('.auto-upg:not(.auto-hire)'), autoHire: q('.auto-hire'), gens: q('.gens'), toasts: q('.toasts'), pops: q('.pops'), tip: q('.tip'),
      blade: q('.blade'), bladeIn: q('.blade-in'), modalWrap: q('.modal-wrap'), modal: q('.modal'), curtain: q('.curtain'), mute: q('.mute'), abyssBadge: q('[data-open=abyss] .badge'), heartBtn: q('.dock-heart'), heartBadge: q('.dock-heart .badge'), keepBtn: q('[data-act=keep]'), keepLabels: q('.keep-labels'),
      relicBadge: q('[data-open=relics] .badge'), cardBadge: q('[data-open=trophies] .badge'), loot: q('.loot'), bladeRate: q('.blade-rate'), dock: q('.dock'), abilities: q('.abilities'), drops: q('.drops'),
    };

    COMPS.forEach((c, i) => {
      const row = document.createElement('button');
      row.className = 'gen';
      row.dataset.comp = String(i);
      row.dataset.tip = `comp:${i}`;
      row.innerHTML = `
        <span class="gen-ico">${charFit(c.sprite, 40)}</span>
        <span class="gen-mid"><b class="gen-name"></b><span class="gen-cost"></span><span class="traits"></span></span>
        <span class="gen-right"><b class="gen-lv"></b><small class="gen-dps"></small></span>
        <span class="gen-hero" data-hero="${i}" data-tip="hero:${i}">${G.heroStar()}</span>`;
      this.el.gens.appendChild(row);
      this.rows.push(row);
      this.rowCache.push('');
    });

    // Skills you press first (top to bottom matches keys 1–9), then the always-on ones after a gap. The Phantom Blade
    // shows in the dock instead.
    const column = [...ABILITIES.filter((a) => a.kind !== 'passive'), ...ABILITIES.filter((a) => a.kind === 'passive' && a.id !== 'blade')];
    for (const a of column) {
      const slot = document.createElement('button');
      slot.className = 'ab locked';
      slot.dataset.ability = a.id;
      if (a.kind === 'passive' && a === column.find((x) => x.kind === 'passive')) slot.dataset.gap = '';
      slot.dataset.tip = `ab:${a.id}`;
      slot.innerHTML = `${charFit(COMPS[a.comp].sprite, 30)}<span class="ab-fill"></span><span class="ab-time"></span><span class="ab-lock">${G.lock()}</span>${a.kind === 'passive' ? '' : `<span class="ab-key">${abilityKey(a.id)}</span>`}`;
      this.el.abilities.appendChild(slot);
    }

    this.bind();
    // A relic's card shows when it's picked up off the floor (the scene sets it down and tells us).
    this.scene.onLoot = (ev) => (ev.t === 'relic' ? this.showLoot(ev.id, ev.lv, ev.equipped, ev.star) : this.showCard(ev));
    this.bindSheet();
    this.syncMode();
    this.syncMute();
    this.layout();
    addEventListener('resize', () => {
      this.layout();
      this.fitFloorSub();
    });
    // Measured in the pixel font, so measure again once it's in.
    document.fonts.ready.then(() => this.fitFloorSub());
    // The dock grows as buttons unlock (the Room one appears after the first awakening): keep the ticker clear of it.
    new ResizeObserver(() => this.layout()).observe(this.root.querySelector('.dock')!);
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
    // The ability column stands between the fight and the party panel (on a phone it's a row along the bottom instead).
    const column = sheet ? 0 : this.el.abilities.getBoundingClientRect().width;
    const freeW = sheet ? w : shop.left - column;
    const freeH = sheet ? shop.top : h;
    this.field = { w: freeW, h: freeH };
    this.root.style.setProperty('--free-w', `${freeW}px`);
    // The floor map sits in the top-left corner only when the gold counter, centered over the fight, can't reach it.
    body.toggle('map-in-bar', compact || freeW < 980);
    this.root.style.setProperty('--free-h', `${freeH}px`);
    // The news ticker starts where the dock ends (the dock grows as features are added).
    const dock = this.root.querySelector('.dock')!.getBoundingClientRect();
    this.root.style.setProperty('--dock-r', `${Math.round(dock.right + 20)}px`);
    // Frame the fight below the HUD (the floor bar is the last part that always shows).
    const hud = this.el.floorBox.getBoundingClientRect();
    this.hudTop = compact ? Math.round(hud.bottom + 4) : 0;
    this.scene.setViewport(sheet ? 0 : w - shop.left + column, sheet ? h - shop.top : 0, this.hudTop);
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
      if (this.scene.pickLoot(e.clientX, e.clientY)) return;
      if (this.game.raid && this.scene.hitRaider(e.clientX, e.clientY)) {
        this.game.catchRaid();
        return;
      }
      const goblin = this.game.vault ? this.scene.hitVaultGoblin(e.clientX, e.clientY) : null;
      if (goblin !== null) {
        this.game.catchVaultGoblin(goblin);
        return;
      }
      // On a touch screen, a finger held on the battlefield leads your hero (lift it and they fight on their own).
      if (e.pointerType !== 'mouse') {
        this.fingerDown = true;
        this.heroAim = { x: e.clientX, y: e.clientY };
      }
      if (this.scene.overMonster(e.clientX, e.clientY)) this.onMonsterAt = performance.now();
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
      if (e.pointerType !== 'mouse') this.coinPointer = null;
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
      const over = !t.closest('#ui button, #ui .shop, #ui .pnl') && (this.scene.overMonster(e.clientX, e.clientY) || this.scene.overLoot(e.clientX, e.clientY) || (!!this.game.raid && this.scene.hitRaider(e.clientX, e.clientY)) || (!!this.game.vault && this.scene.hitVaultGoblin(e.clientX, e.clientY) !== null));
      document.body.classList.toggle('grab', over);
      // Over the battlefield, a mouse gets a sword instead of an arrow.
      // The whole dock strip counts as the dock, gaps between its buttons included: a normal cursor there, and no steering.
      const dock = this.el.dock.getBoundingClientRect();
      const overDock = e.clientX > dock.left - 10 && e.clientX < dock.right + 10 && e.clientY > dock.top - 10 && e.clientY < dock.bottom + 10;
      const field = e.pointerType === 'mouse' && !overDock && !t.closest('#ui button, #ui .shop, #ui .pnl, #ui .dock, #ui .modal-wrap') && !this.modal;
      // A mouse gets the sprite cursor over the game, the dock and the Keep; the companion list and open panels keep a
      // plain cursor. Touch has none.
      const mouse = e.pointerType === 'mouse';
      const sprite = mouse && !t.closest('#ui .shop, #ui .modal-wrap');
      this.el.blade.hidden = !sprite;
      document.body.classList.toggle('blade-on', sprite);
      this.pointer = field ? { x: e.clientX, y: e.clientY } : null;
      if (field && this.scene.overMonster(e.clientX, e.clientY)) this.onMonsterAt = performance.now();
      this.coinPointer = { x: e.clientX, y: e.clientY };
      this.inputAt = performance.now();
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
      // Holding the attack down follows the cursor onto whichever monster it's over now; off the battlefield it goes back
      // to the front monster (x -1: the swing shows on whoever is hit, never over the panels).
      if (this.game.hold) {
        this.game.hold.x = field ? e.clientX : -1;
        this.game.hold.y = field ? e.clientY : -1;
        this.game.hold.id = field ? this.scene.pick(e.clientX, e.clientY) : null;
      }
      if (sprite) this.el.blade.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    });
    document.addEventListener('pointerleave', () => {
      this.coinPointer = null;
      this.heroAim = null;
      this.el.blade.hidden = true;
      document.body.classList.remove('blade-on');
    });
    // In the Keep, Space, Enter or E uses whatever you're standing at.
    addEventListener('keydown', (e) => {
      const near = this.keepView?.near;
      if (!near || this.modal || e.repeat || !['Space', 'Enter', 'KeyE'].includes(e.code)) return;
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.station(near);
    }, true);
    addEventListener('keydown', (e) => {
      this.inputAt = performance.now();
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key === 'Escape' && this.modal) this.closeModal();
      // U buys the cheapest companion trait you can afford.
      if (e.key.toLowerCase() === 'u' && !e.repeat && !this.modal) {
        const next = this.game.shopUpgrades().find((u) => this.game.s.gold.gte(this.game.upgCost(u)));
        if (next && this.game.buyUpg(next.id)) this.hideTip();
      }
      // 1–9 use the abilities in the column, in order.
      if (/^[1-9]$/.test(e.key) && !e.repeat && !this.modal) {
        const id = KEYED[Number(e.key) - 1];
        const slot = id && this.el.abilities.querySelector<HTMLElement>(`[data-ability="${id}"]`);
        if (slot) {
          // Cooling down, still charging or not unlocked yet: the same "no" as clicking it.
          if (this.game.useAbility(id)) this.refreshTip();
          else this.deny(slot);
        }
      }
      // Holding Space attacks just like holding the mouse down; its repeats would otherwise scroll the party panel.
      if (e.key === ' ' && e.repeat && this.spaceHeld) e.preventDefault();
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !this.modal && !(e.target as HTMLElement).closest('button')) {
        e.preventDefault();
        if (this.scene.busy) return;
        // The sword swings at the monster under the cursor, or at the front one if the cursor's off the field.
        const at = this.pointer ?? { x: -1, y: -1 };
        const id = this.pointer ? this.scene.pick(at.x, at.y) : null;
        if (e.key === ' ') {
          this.spaceHeld = true;
          this.game.hold = { id, ...at };
        }
        this.game.click(id, at.x, at.y);
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
      if (t.closest('.floor-n')) return this.jumpFloor();
      const hero = t.closest<HTMLElement>('[data-hero]');
      if (hero) {
        if (this.game.setHero(Number(hero.dataset.hero))) {
          if (this.game.s.heroTips === 1) this.game.s.heroTips = 2;
          this.hooks.sound('toggle', { vol: 0.6 });
          this.refreshTip();
        } else this.deny(hero);
        return;
      }
      const pick = t.closest<HTMLElement>('[data-vault-hero]');
      if (pick) {
        this.enterVault(Number(pick.dataset.vaultHero));
        return;
      }
      const ability = t.closest<HTMLElement>('[data-ability]');
      if (ability) {
        if (this.game.useAbility(ability.dataset.ability as AbilityId)) this.refreshTip();
        else this.deny(ability);
        return;
      }
      // A trait square never falls through to the row (that would level the companion instead).
      const trait = t.closest<HTMLElement>('.trait');
      if (trait) {
        if (trait.classList.contains('got')) return;
        if (trait.dataset.trait && this.game.buyUpg(trait.dataset.trait)) this.refreshTip();
        else this.deny(trait);
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
      const cardView = t.closest<HTMLElement>('[data-card-lap], [data-card-gold]');
      if (cardView) {
        if (cardView.dataset.cardLap) this.cardLap = Number(cardView.dataset.cardLap);
        if (cardView.dataset.cardGold) this.cardGold = cardView.dataset.cardGold === '1';
        this.hooks.sound('toggle', { vol: 0.5 });
        this.renderModal();
        return;
      }
      const mode = t.closest<HTMLElement>('[data-mode]');
      if (mode) {
        this.game.s.settings.buyMode = mode.dataset.mode === 'next' ? 'next' : (Number(mode.dataset.mode) as 1 | 10 | 100 | -1);
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
      const bound = t.closest<HTMLElement>('[data-bound]');
      if (bound) {
        const id = bound.dataset.bound as BoundId;
        if (this.game.buyBound(id)) {
          this.renderModal();
          this.refreshTip();
          this.flareLegend(id);
        } else this.deny(bound);
        return;
      }
      const old = t.closest<HTMLElement>('[data-legend]');
      if (old) {
        const id = old.dataset.legend as LegendId;
        if (this.game.levelLegend(id)) {
          this.renderModal();
          this.refreshTip();
          this.flareLegend(id);
        } else this.deny(old);
        return;
      }
      const put = t.closest<HTMLElement>('[data-put]');
      if (put && (this.modal === 'dan' || this.modal === 'victor')) {
        if (this.tradeBusy) return;
        this.tradePut(this.modal, put.dataset.put!);
        this.renderModal();
        return;
      }
      const take = t.closest<HTMLElement>('[data-take]');
      if (take) {
        if (this.tradeBusy) return;
        this.trade.side.splice(this.trade.side.lastIndexOf(take.dataset.take!), 1);
        this.hooks.sound('click', { vol: 0.3 });
        this.renderModal();
        return;
      }
      const pickEl = t.closest<HTMLElement>('[data-pick]');
      if (pickEl) {
        if (pickEl.classList.contains('on')) return;
        this.legendPick = pickEl.dataset.pick as LegendId;
        this.hooks.sound('toggle', { vol: 0.4 });
        this.renderModal();
        this.el.modal.querySelector(`[data-pick="${this.legendPick}"]`)?.classList.add('materialize');
        return;
      }
      const away = t.closest<HTMLElement>('[data-mark-away]');
      if (away) {
        if (this.game.rerollMark(Number(away.dataset.markAway))) this.renderModal();
        else this.deny(away);
        return;
      }
      const here = t.closest<HTMLElement>('[data-mark-here]');
      if (here) {
        if (this.game.moveMarkTo(Number(here.dataset.markHere))) this.renderModal();
        else this.deny(here);
        return;
      }
      const curse = t.closest<HTMLElement>('[data-curse]');
      if (curse) {
        this.curseChoice = this.curseChoice === curse.dataset.curse ? null : curse.dataset.curse!;
        this.hooks.sound('toggle', { vol: 0.5 });
        this.renderModal();
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
      const go = t.closest<HTMLElement>('[data-goto]');
      if (go) {
        // Going back to an earlier floor stays there to farm it (Auto off), like the back arrow.
        const f = Number(go.dataset.goto);
        if (this.game.goFloor(f) && f < this.game.s.maxFloor) this.game.s.auto = false;
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
      if (t.dataset.trip) {
        const floor = Math.floor(Number(t.value));
        if (floor >= 1 && floor <= this.game.s.bestFloor) {
          this.tripPick[Number(t.dataset.trip)] = floor;
          this.renderModal(true);
        }
        return;
      }
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
      case 'autoUpg':
        g.s.settings.autoUpg = !g.s.settings.autoUpg;
        g.s.autoTipSeen = true;
        this.refreshTip();
        break;
      case 'autoHire':
        g.s.settings.autoHire = !g.s.settings.autoHire;
        this.refreshTip();
        break;
      case 'sound':
        s.muted = !s.muted;
        this.syncMute();
        this.hooks.settings();
        this.renderModal();
        break;
      case 'floorDown':
        if (g.goFloor(g.s.floor - 1)) g.s.auto = false;
        break;
      case 'floorUp': g.goFloor(g.s.floor + 1); break;
      case 'zonePrev':
      case 'zoneNext':
        this.mapPage = Math.max(0, (this.mapPage ?? Math.floor((g.s.floor - 1) / MAP_ROOMS)) + (act === 'zonePrev' ? -1 : 1));
        this.mapSlide = act === 'zonePrev' ? 'prev' : 'next';
        this.renderFloor();
        break;
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
      case 'calm':
      case 'shake':
      case 'numbers':
      case 'blood':
      case 'cinematics':
        s[act] = !s[act];
        this.hooks.settings();
        this.renderModal();
        break;
      case 'graphics':
        s.graphics = s.graphics === 'auto' ? 'high' : s.graphics === 'high' ? 'low' : 'auto';
        this.hooks.settings();
        this.renderModal();
        break;
      case 'notation':
        s.notation = s.notation === 'short' ? 'sci' : 'short';
        setNotation(s.notation);
        this.rowCache.fill('');
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
      case 'mainMenu':
        this.hooks.mainMenu();
        break;
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
      case 'summon': {
        const id = this.legendPick;
        if (id && this.game.summonLegend(id)) {
          this.renderModal();
          this.flareLegend(id);
        } else this.deny(el);
        break;
      }
      case 'tradeAuto':
      case 'tradeClear':
      case 'tradeGo':
      case 'tradeAgain': {
        const who = this.modal as Trader;
        // A trade plays out before anything else on the table can be touched.
        if (this.tradeBusy) break;
        if (act === 'tradeGo') {
          this.tradeGo(who);
          break;
        }
        if (act === 'tradeClear') this.trade.side = [];
        else if (act === 'tradeAgain') this.trade = { side: [], got: null, line: pickLine(TRADER_LINES[who][this.tradeHand().length ? 'hello' : 'short']) };
        else {
          // Auto-fill only uses doubles: never your last copy.
          while (this.trade.side.length < this.tradeNeed(who)) {
            const most = this.tradeHand().filter((h) => h.n > 1).sort((a, b) => b.n - a.n)[0];
            if (!most) break;
            this.tradePut(who, most.c.id);
          }
          if (this.trade.side.length < this.tradeNeed(who)) this.trade.line = pickLine(TRADER_LINES[who].short);
        }
        this.renderModal();
        break;
      }
      case 'reroll':
        if (this.game.rerollLegends()) this.rerollFx();
        else this.deny(el);
        break;
      case 'respec':
        if (!this.respecArmed) {
          this.respecArmed = true;
          el.textContent = 'Really respec?';
          setTimeout(() => {
            this.respecArmed = false;
            if (el.isConnected) this.renderModal();
          }, 3000);
        } else {
          this.respecArmed = false;
          this.game.respecLegends();
          this.renderModal();
        }
        break;
      case 'awaken': this.renderAwakenConfirm(); break;
      case 'keep': this.toggleKeep(); break;
      case 'awakenGo': this.doAwaken(); break;
      case 'recallAll':
        this.game.recallAll();
        this.closeModal();
        break;
      case 'heartBack': this.modal = 'heart'; this.renderModal(); break;
      case 'descendGo': this.doDescend(); break;
      case 'leaveVault': this.game.leaveVault(); break;
      case 'abyssBack': this.modal = 'abyss'; this.renderModal(); break;
      case 'tripGo': {
        const i = Number(el.closest<HTMLElement>('[data-hunter]')!.dataset.hunter);
        if (this.game.sendTrip(i, this.tripPick[i] ?? this.game.tripFloor(i))) {
          this.hooks.sound('descend', { vol: 0.4 });
          this.rowCache[i] = '';
          this.renderModal();
        } else this.deny(el);
        break;
      }
      case 'tripsBackDone':
        this.tripsBackDone();
        this.renderModal();
        break;
      case 'tripHome': {
        const i = Number(el.closest<HTMLElement>('[data-hunter]')!.dataset.hunter);
        if (this.game.callHome(i)) this.renderModal();
        break;
      }
    }
  }

  private syncMode() {
    const m = this.game.s.settings.buyMode;
    this.root.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === String(m)));
  }

  private syncMute() {
    this.el.mute.innerHTML = this.game.s.settings.muted ? G.mute() : G.sound();
    this.el.mute.classList.toggle('off', this.game.s.settings.muted);
  }

  // ---------- events from the game ----------

  handle(ev: GameEvent) {
    const g = this.game;
    switch (ev.t) {
      case 'keep':
        // Up to the Keep or back: no numbers, bars or sparks left over from the floor.
        for (const el of this.pops.splice(0)) el.remove();
        for (const bar of this.bars.values()) bar.remove();
        this.bars.clear();
        this.el.drops.querySelectorAll('.sparks').forEach((el) => el.remove());
        break;
      case 'click': {
        if (ev.x >= 0) {
          this.swing(ev.x, ev.y, ev.crit);
          break;
        }
        const f = g.focus();
        const s = f && this.scene.screenOf(f.id);
        if (s) this.swing(s.x, s.y + s.h * 0.4, ev.crit);
        break;
      }
      case 'hit': {
        if (!g.s.settings.numbers && ev.kind !== 'crit' && ev.kind !== 'autoCrit') break;
        const s = this.scene.screenOf(ev.id);
        if (!s) break;
        const streak = ev.kind === 'dps' ? 0 : this.streak(ev.id);
        if (streak >= ARC_FROM) {
          const hero = this.scene.heroScreen(g);
          const kind = ev.kind === 'autoCrit' ? 'crit' : ev.kind === 'auto' ? 'cleave' : ev.kind;
          this.arcPop(s.x, s.y + s.h * 0.25, fmt(ev.amount), `p-${kind}`, hero && hero.x > s.x ? -1 : 1, streak - ARC_FROM);
        } else if (ev.kind === 'dps') this.pop(s.x + (Math.random() - 0.5) * 30, s.y + s.h * 0.2, fmt(ev.amount), 'p-dps');
        else if (ev.kind === 'cleave' || ev.kind === 'auto') this.pop(s.x + (Math.random() - 0.5) * 40, s.y + s.h * 0.3, fmt(ev.amount), 'p-cleave');
        else if (ev.kind === 'autoCrit') this.pop(s.x + (Math.random() - 0.5) * 40, s.y + s.h * 0.25, fmt(ev.amount), 'p-crit');
        // Pop classes are prefixed so they can't collide with HUD classes (the Rampage meter is .fever).
        // Numbers always rise from the monster that was hit, wherever you tapped.
        else this.pop(s.x + (Math.random() - 0.5) * s.h * 0.5, s.y + s.h * 0.2, fmt(ev.amount), `p-${ev.kind}`);
        break;
      }
      case 'kill': {
        const s = this.scene.screenOf(ev.id);
        // (A splitting boss's body and first half pay nothing: the gold comes with the last half.)
        if (!s || ev.gold.lte(0)) break;
        this.pop(s.x, s.y + s.h * 0.5, `+${fmt(ev.gold)}`, ev.boss || ev.champ ? 'p-gold p-big' : 'p-gold');
        if (ev.champ) this.pop(s.x, s.y - 10, 'CHAMPION!', 'p-champ');
        break;
      }
      case 'drop': this.dropCoins(ev.id, ev.from, ev.big, ev.gold); break;
      case 'bank': this.bankCoins(ev.id, ev.by); break;
      case 'ability': {
        const a = ABILITY_BY_ID.get(ev.id)!;
        if (ev.unlocked) {
          this.toast(`<b>Ability unlocked: ${esc(a.name)}</b><small>${esc(g.abilityText(a.id))}</small>`, 'flask_big_yellow', 'trophy');
          this.hooks.sound('levelup', { vol: 0.6 });
        } else this.hooks.sound('awaken', { vol: 0.5 });
        break;
      }
      case 'sweep': {
        const at = this.scene.fieldScreen();
        this.pop(at.x, at.y, `Swept! +${fmt(ev.gold)}`, 'p-gold p-sweep');
        this.coinFly(at.x, at.y + 20, 4, ev.gold);
        break;
      }
      case 'floor':
        // A cleared floor: say so in the middle of the field, and give the floor bar a gold flash as it ticks over.
        if (ev.cleared) {
          const mid = this.scene.fieldScreen();
          this.pop(mid.x, mid.y, `Floor ${fmt(ev.floor - 1)} cleared!`, 'p-floor');
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
        // A boss is announced on a floor you've never beaten, once (not every retry, nor while you farm it).
        if (ev.boss && ev.floor > g.s.bestCleared && !this.bossAnnounced.has(ev.floor)) {
          this.bossAnnounced.add(ev.floor);
          const boss = g.monsters.find((m) => m.boss);
          const mods = g.bossMods(ev.floor).map((id) => MOD_BY_ID.get(id)!.name);
          const time = `Kill it in ${Math.round(g.bossTimeMax)} seconds`;
          const souls = boss?.champ && ev.floor >= TUNE.goldBossFrom ? ` · ${g.champSouls(ev.floor)} souls` : '';
          this.banner(`${souls ? 'Champion boss' : 'Boss'}: ${boss?.def.name ?? 'Guardian'}`, (mods.length ? `${mods.join(' · ')} — ${time.toLowerCase()}` : time) + souls, 'boss');
        } else if (ev.boss && ev.floor >= TUNE.goldBossFrom && g.monsters.some((m) => m.boss && m.champ)) {
          this.banner('Champion boss!', `Beat it for ${g.champSouls(ev.floor)} soul${g.champSouls(ev.floor) === 1 ? '' : 's'}`, 'boss');
        }
        break;
      case 'bossWin':
        if (ev.clutch) {
          // CLUTCH! slams in as the slow motion starts, with letterbox bars for the length of it.
          const { left, gold } = ev.clutch;
          this.clutchHold = { left, max: g.bossTimeMax, until: performance.now() + 2400 };
          if (g.s.settings.cinematics) {
            this.cinemaUntil = performance.now() + 2400;
            document.body.classList.add('cinema');
            setTimeout(() => document.body.classList.remove('cinema'), 2150);
          }
          this.banner('CLUTCH!', `${left.toFixed(1)}s to spare · +${fmt(gold)} gold${ev.souls ? ` · +${ev.souls} souls` : ''}`, 'clutch');
        }
        else if (ev.first) this.banner('Victory!', `Floor ${fmt(ev.floor)} conquered${ev.souls ? ` · +${ev.souls} soul${ev.souls === 1 ? '' : 's'}` : ''}`, 'win');
        else if (ev.souls) this.banner('Champion boss down!', `+${ev.souls} soul${ev.souls === 1 ? '' : 's'}`, 'win');
        break;
      case 'bossFail':
        // The first wall: this is where the game teaches you to descend.
        if (g.s.descents === 0 && ev.floor >= DESCEND_FLOOR && g.canDescend()) this.banner('The way up opens', 'Ascend to come back stronger', 'fail');
        else this.banner('The boss held', 'Your party falls back to grow stronger', 'fail');
        break;
      case 'buyComp':
        this.rowCache[ev.comp] = '';
        this.bump(this.rows[ev.comp]);
        break;
      case 'reveal': this.toast(`New companion for hire: <b>${COMPS[ev.comp].name}</b>`, COMPS[ev.comp].sprite); break;
      case 'trophy': {
        // A card trophy waits for its card: the card is collected when you've seen it, not when it drops.
        const req = TROPHIES.find((x) => x.id === ev.id)!.req.t;
        if ((req === 'cards' || req === 'versions' || req === 'goldCards' || req === 'tripCards') && (this.cardsComing > 0 || this.cardQueue.length)) {
          this.heldTrophies.push(ev.id);
          clearTimeout(this.heldTimer);
          // (In case a card never gets picked up and shown.)
          this.heldTimer = window.setTimeout(() => this.releaseTrophies(), 20000);
        } else this.trophyToast(ev.id);
        break;
      }
      case 'raidCatch': {
        if (ev.reward === 'vault') break;
        const title = REWARD_TEXT[ev.reward];
        const line = ev.reward === 'plunder' || ev.reward === 'rainbow' ? `+${fmt(ev.amount ?? 0)} gold` : ev.buff ? `${buffText(ev.buff)} for ${Math.round(ev.buff.dur)}s` : '';
        this.banner(title, line, ev.reward === 'rainbow' ? 'loot rainbow' : 'loot');
        break;
      }
      case 'spawn': {
        const m = g.monster(ev.id);
        if (m?.boss && m.champ && !m.half) {
          this.banner('CHAMPION BOSS!', `${m.def.name} · tougher, richer, and it might drop a gold card`, 'loot');
          this.hooks.sound('drop4', { vol: 0.6 });
        }
        break;
      }
      // The tink: something rare just dropped.
      case 'card':
        // A hunter's cards come home with it, all at once (see 'expedition').
        if (ev.src === 'trip') {
          this.tripCards.push(ev);
          break;
        }
        this.cardsComing++;
        this.hooks.sound(ev.gold ? 'cardgold' : 'card', { vol: 0.9 });
        break;
      case 'raidEscape': this.toast('The treasure goblin got away…', 'goblin'); break;
      case 'fever': if (ev.on) this.banner(`RAMPAGE ×${fmt(g.feverMult())}!`, `Keep attacking for ×${fmt(g.rampageNext()?.mult ?? g.feverMult())}`, 'rampage'); break;
      case 'rampage': this.banner(`RAMPAGE ×${fmt(ev.click)}!`, 'Full power', `rampage tier${ev.tier}`); break;
      case 'vaultPick': this.showVaultPick(); break;
      case 'vault':
        this.closeVaultPick();
        this.el.vaultLeave.hidden = !ev.on;
        // The floor's tracker means nothing in the vault.
        document.body.classList.toggle('in-vault', ev.on);
        if (ev.on) this.banner('RAINBOW VAULT!', 'Open every chest!', 'loot rainbow');
        else this.toast(`You leave the vault. Haul: <b>+${fmt(ev.gold)} gold</b>`, 'chest_full_open', 'trophy');
        break;
      case 'vaultAll': this.banner('EVERY CHEST!', `+${fmt(ev.gold)} gold bonus`, 'loot rainbow'); break;
      case 'chest': this.chestOpened(ev.id, ev.gold, ev.rainbow); break;
      case 'vaultGoblin': {
        const at = this.scene.goblinScreen(ev.id);
        this.hooks.sound('coins', { vol: ev.rainbow ? 0.7 : 0.45, rate: ev.rainbow ? 0.9 : 1.1 });
        if (at) {
          this.pop(at.x, at.y - 20, `+${fmt(ev.gold)}`, ev.rainbow ? 'p-pick p-big' : 'p-pick');
          this.sparkle(at.x, at.y, ev.rainbow ? 14 : 8);
          this.coinFly(at.x, at.y, ev.rainbow ? 16 : 5, ev.gold);
        }
        break;
      }
      case 'vaultCoin': {
        // A tick that climbs as you sweep a run of them.
        const at = this.scene.coinScreen(ev.id);
        const now = performance.now();
        this.coinRun = now - this.coinRunAt < 500 ? Math.min(this.coinRun + 1, 20) : 0;
        this.coinRunAt = now;
        this.hooks.sound('coins', { vol: 0.18, rate: 1.3 + this.coinRun * 0.03 });
        if (at) {
          this.pop(at.x, at.y - 14, `+${fmt(ev.gold)}`, 'p-pick');
          this.coinFly(at.x, at.y, 1, ev.gold);
        }
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
      default:
        this.handleFull(ev);
    }
  }

  /** Events from the full game's systems: the demo has none of them. */
  private handleFull(ev: GameEvent) {
    if (DEMO) return;
    const g = this.game;
    switch (ev.t) {
      case 'curse': {
        const c = CURSE_BY_ID.get(ev.id)!;
        this.toast(`<b>${esc(c.name)}: tier ${ev.tier} broken</b><small>${esc(c.reward(ev.tier))}</small>`, 'skull', 'trophy');
        this.hooks.sound('levelup', { vol: 0.6 });
        break;
      }
      case 'expedition':
        this.rowCache[ev.comp] = '';
        this.tripsBack.push({ comp: ev.comp, floor: ev.floor, kills: ev.kills, cards: this.tripCards.splice(0) });
        break;
      // Gathered for a moment, so a catch-up after time away is one toast, not one per hunter.
      case 'tripFind': {
        const had = this.tripFinds.get(ev.comp) ?? { cards: 0, gold: 0 };
        this.tripFinds.set(ev.comp, { cards: had.cards + ev.cards, gold: had.gold + ev.gold });
        break;
      }
      case 'hunterHere':
        this.rowCache[ev.comp] = '';
        if (ev.on) this.toast(`<b>${esc(COMPS[ev.comp].name)}</b> fights with you on floor ${fmt(g.s.floor)}`, COMPS[ev.comp].sprite);
        break;
      case 'tripsOpen': this.toast('<b>Expeditions</b> are open: the ladder in the Keep', COMPS[ev.comp].sprite, 'trophy'); break;
      case 'setStart': this.toast(`Card sets: <b>floor ${fmt(ev.floor)}</b> · +${fmt(ev.gold)} gold`, 'imp', 'trophy'); break;
      case 'autoHireOpen': this.toast('<b>Auto hire</b> is open: the toggle above your party', 'knight_m', 'trophy'); break;
      case 'tripReady': this.toast(`<b>${esc(COMPS[ev.comp].name)}</b> can go on expeditions`, COMPS[ev.comp].sprite); break;
      case 'legend': if (ev.summoned) this.toast(`<b>${esc(LEGEND_BY_ID.get(ev.id)!.name)}</b> joins you`, LEGEND_BY_ID.get(ev.id)!.sprite); break;
      case 'mark':
        this.rowCache[ev.comp] = '';
        if (ev.from !== undefined) this.rowCache[ev.from] = '';
        if (ev.moved) this.toast(`A Heartmark moves to the <b>${esc(COMPS[ev.comp].name)}</b>`, COMPS[ev.comp].sprite);
        else this.toast(`<b>Heartmark!</b> The ${esc(COMPS[ev.comp].name)} deals +${MARK_POWER * 100}% damage`, COMPS[ev.comp].sprite, 'trophy');
        break;
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

  /** Counts a hit into its monster's streak and returns the streak's length so far. */
  private streak(id: number) {
    const now = performance.now() / 1000;
    const last = this.streaks.get(id);
    const n = last && now - last.at < STREAK_GAP ? last.n + 1 : 1;
    this.streaks.set(id, { at: now, n });
    if (this.streaks.size > 40) for (const [k, v] of this.streaks) if (now - v.at > STREAK_GAP) this.streaks.delete(k);
    return n;
  }

  /** A pop element, new or the oldest one recycled (stopping any arc it was flying). */
  private takePop() {
    const el = this.pops.length >= (this.scene.quality === 'low' ? MAX_POPS_LOW : MAX_POPS) ? this.pops.shift()! : document.createElement('div');
    el.getAnimations().forEach((a) => a.cancel());
    return el;
  }

  private pop(x: number, y: number, text: string, kind: string) {
    const el = this.takePop();
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

  /** A number thrown out of a monster in a high arc (up, over and down past where it started), toward `dir` (±1). The
   *  `k`-th number of a streak lands a little further out than the one before, so a fast streak fans out. */
  private arcPop(x: number, y: number, text: string, kind: string, dir: number, k: number) {
    const el = this.takePop();
    el.className = `pop ${kind} p-arc`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.el.pops.appendChild(el);
    this.pops.push(el);
    const reach = dir * (46 + (k % 6) * 20 + Math.random() * 10);
    const rise = 74 + (k % 3) * 14;
    const fall = 46;
    const frames = Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      const scale = t < 0.1 ? 0.5 + t * 6.5 : 1.15 - Math.min(1, t) * 0.3;
      return {
        transform: `translate(calc(-50% + ${reach * t}px), calc(-50% + ${-4 * rise * t * (1 - t) + fall * t * t}px)) scale(${scale})`,
        opacity: t < 0.08 ? t / 0.08 : t > 0.75 ? (1 - t) / 0.25 : 1,
      };
    });
    el.animate(frames, { duration: 850, fill: 'forwards' }).onfinish = () => {
      el.remove();
      const i = this.pops.indexOf(el);
      if (i >= 0) this.pops.splice(i, 1);
    };
  }

  /** Coins arc from a kill up into the gold counter. */
  /** Coins fly up to the bank: a little hop, then a spinning arc that speeds up into the counter. `value` is the gold they
   *  carry: the counter counts it as each one lands, so the number goes up when the coins arrive, not before. */
  private coinFly(x: number, y: number, n: number, value?: Decimal) {
    const target = this.el.bankIco.getBoundingClientRect();
    const tx = target.left + target.width / 2;
    const ty = target.top + target.height / 2;
    const share = value ? value.div(n) : new Decimal(0);
    for (let i = 0; i < n; i++) {
      // Too many in the air already: this one's gold just counts.
      if (this.flights.length >= MAX_COINS) continue;
      const c = document.createElement('i');
      c.className = 'coin-fly';
      c.innerHTML = sprite('coin', 3);
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
      this.el.pops.appendChild(c);
      const duration = 720 + Math.random() * 160;
      const hop = { x: (Math.random() - 0.5) * 30, y: -22 - Math.random() * 14 };
      const bend = { x: x + (tx - x) * 0.35 + (Math.random() - 0.5) * 140, y: y + (ty - y) * 0.35 - 40 - Math.random() * 50 };
      const anim = c.animate([
        { transform: 'translate(-50%, -50%) scale(1)' },
        { transform: `translate(calc(-50% + ${hop.x}px), calc(-50% + ${hop.y}px)) scale(1.35)`, offset: 0.16, easing: 'cubic-bezier(.3,0,.6,1)' },
        { transform: `translate(calc(-50% + ${bend.x - x}px), calc(-50% + ${bend.y - y}px)) scale(1.1)`, offset: 0.5, easing: 'cubic-bezier(.5,0,1,.7)' },
        { transform: `translate(calc(-50% + ${tx - x}px), calc(-50% + ${ty - y}px)) scale(0.55)` },
      ], { duration, delay: i * 55, easing: 'linear', fill: 'backwards' });
      this.flights.push({ share, lands: performance.now() + i * 55 + duration });
      anim.onfinish = () => {
        c.remove();
        this.coinArrived(tx, ty);
      };
    }
  }

  /** A coin reaches the bank: the coin bumps, the number flashes, a couple of sparks. */
  private coinArrived(x: number, y: number) {
    this.bump(this.el.bankIco);
    this.bump(this.el.bank);
    const now = performance.now();
    if (now - this.arrivedAt > 90) {
      this.arrivedAt = now;
      this.sparkle(x, y, 4);
    }
  }
  private arrivedAt = 0;

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
    if (!DEMO && g.s.inKeep && !this.keepView) {
      this.keepView = new KeepView(g, this.root);
      this.keepView.onUse = (id) => this.station(id);
      if (this.arriveAtHeart) this.keepView.arriveAtHeart();
      this.arriveAtHeart = false;
    } else if (!g.s.inKeep && this.keepView) {
      this.keepView.destroy();
      this.keepView = null;
    }
    if (this.keepView) {
      const keys = this.modal ? { x: 0, y: 0 } : { x: (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0), y: (this.keys.has('down') ? 1 : 0) - (this.keys.has('up') ? 1 : 0) };
      // The Legend picked in the menu is the one lit in the shrine behind it.
      if (this.modal === 'abyss' && this.legendPick) this.keepView.pinned = `offer:${this.legendPick}`;
      this.keepView.frame(dt, keys, this.field.w, this.field.h);
    }
    this.keepLabelsFrame();
    // A held attack keeps to whatever is under the cursor, which changes as monsters move and die even when the mouse
    // doesn't.
    if (g.hold && g.hold.x >= 0) g.hold.id = this.scene.pick(g.hold.x, g.hold.y);
    // The marker over your hero (hero tip) moves every frame, right with them.
    const mark = this.el.heroMark;
    if (!mark.hidden) {
      const at = this.scene.heroScreen(g);
      if (at) mark.style.transform = `translate(${at.x}px, ${at.y}px)`;
      mark.style.visibility = at ? 'visible' : 'hidden';
    }
    // Flurry clicks wherever you point, like holding the attack down.
    const flurry = g.s.buffs.some((b) => b.id === 'flurry');
    g.aim = flurry && this.pointer && !this.modal ? { id: this.scene.pick(this.pointer.x, this.pointer.y), ...this.pointer } : null;
    const feet = this.scene.heroFeet(g);
    this.sweepCoins([feet, this.coinPointer].filter((p) => p !== null));
    if (g.vault && this.coinPointer && !this.modal) this.scene.sweepVaultCoins(this.coinPointer.x, this.coinPointer.y, g);
    if (this.keys.size) this.keyedAt = performance.now();
    const input = this.scene.heroInput;
    // (Up in the Keep the keys and pointer walk you round its map instead.)
    input.aim = !this.modal && !this.mouseStale && !g.s.inKeep ? this.heroAim : null;
    input.keys = g.s.inKeep ? { x: 0, z: 0 } : { x: (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0), z: (this.keys.has('down') ? 1 : 0) - (this.keys.has('up') ? 1 : 0) };
    input.stay = this.mouseStale && !this.keys.size && performance.now() - this.keyedAt < 4000;
    input.idle = performance.now() - this.inputAt > 20_000;
    // Gold still flying up to the bank isn't counted until its coin lands.
    const now = performance.now();
    if (this.flights.length) this.flights = this.flights.filter((flight) => flight.lands > now);
    const inFlight = this.flights.reduce((sum, flight) => sum.plus(flight.share), new Decimal(0));
    const bank = Decimal.max(0, g.s.gold.minus(inFlight));
    this.shown = bank.lt(this.shown) || bank.minus(this.shown).lt(1) ? bank : this.shown.plus(bank.minus(this.shown).times(Math.min(1, dt * 10)));
    setText(this.el.bank, fmt(this.shown));

    // Health bars over bosses, and over monsters once they've been hit (none up in the Keep).
    const seen = new Set<number>();
    for (const m of g.s.inKeep ? [] : g.monsters) {
      let bar = this.bars.get(m.id);
      if (!m.boss && (m.arrive > 0 || (!bar && m.hp.gte(m.max)))) continue;
      const s = this.scene.screenOf(m.id);
      if (!s) continue;
      seen.add(m.id);
      if (!bar) {
        bar = document.createElement('div');
        bar.className = `hp ${m.boss ? 'boss' : ''}`;
        const souls = m.boss && m.champ && g.s.floor >= TUNE.goldBossFrom && g.s.goldBosses[g.s.floor] ? g.champSouls(g.s.floor) : 0;
        const chips = (souls ? `<em class="mod soul-chip" style="--mc:var(--soul)">${G.soul(1)} ${souls} soul${souls === 1 ? '' : 's'}</em>` : '') + modChips(m.mods);
        bar.innerHTML = `<i></i>${chips ? `<span class="hp-mods">${chips}</span>` : ''}`;
        this.el.bars.appendChild(bar);
        this.bars.set(m.id, bar);
      }
      // Keep bars on screen even when a big monster stands near the edge.
      const half = m.boss ? 79 : 24;
      const x = Math.min(innerWidth - half, Math.max(half, s.x));
      bar.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(4, s.y - 8))}px)`;
      const left = Math.max(0, m.hp.div(m.max).toNumber());
      const fill = bar.firstChild as HTMLElement;
      fill.style.width = `${left * 100}%`;
      // Green at full health, through yellow at half, to red.
      const hue = Math.round(120 * Math.min(1, left));
      fill.style.background = `linear-gradient(hsl(${hue} 80% 66%), hsl(${hue} 70% 40%))`;
    }
    for (const [id, bar] of this.bars) if (!seen.has(id)) {
      bar.remove();
      this.bars.delete(id);
    }

    // The vault's way out wears a label (it's on the wall among the rainbows).
    const exit = g.vault ? this.scene.exitScreen() : null;
    this.el.exitMark.hidden = !exit || exit.x > this.field.w + 40;
    if (exit) this.el.exitMark.style.transform = `translate(${Math.round(exit.x)}px, ${Math.round(exit.y)}px)`;

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
    // Measured here, not every frame: reading layout each frame makes the browser redo it.
    this.scene.heroBlocked = [this.el.dock.getBoundingClientRect()];
    setText(this.el.dps, fmt(g.dpsTotal()));
    setText(this.el.click, fmt(g.clickTotal()));
    this.el.rate.classList.toggle('boosted', g.s.buffs.some((b) => b.id !== 'fever'));
    // The streak only matters with the Unbroken: shown while one runs, fading out once it breaks.
    const unbroken = g.legendLv('unbroken');
    this.el.streak.classList.toggle('on', unbroken > 0 && g.streak > 1);
    if (unbroken > 0 && g.streak > 1) {
      setText(this.el.streakV, fmt(g.streak));
      setText(this.el.streakB, `+${+(0.01 * unbroken * g.streak).toFixed(1)}%`);
    }
    // Spirit colors on the numbers the Sleeper and the Patient are raising right now.
    const idle = g.idle();
    this.el.dpsWrap.classList.toggle('spirit-on', idle && g.legendLv('sleeper') > 0);
    this.el.bankWrap.classList.toggle('spirit-on', idle && g.legendLv('patient') > 0);

    this.renderFloor();

    // A running Rampage shows under the floor: time left, and how far to the next step.
    const fever = g.s.buffs.find((b) => b.id === 'fever');
    this.el.fever.hidden = !fever;
    if (fever) {
      this.el.feverBar.style.width = `${(fever.t / fever.dur) * 100}%`;
      const next = g.rampageNext();
      const label = next ? `×${fmt(g.feverMult())} · keep attacking!` : `×${fmt(g.feverMult())}!`;
      if (this.el.feverLabel.textContent !== label) this.el.feverLabel.textContent = label;
    }

    this.renderBuffs(g.s.buffs);
    this.renderAbilities();
    this.renderRows();
    this.renderShopActs();
    if (document.body.classList.contains('compact')) {
      const hud = this.el.floorBox.getBoundingClientRect();
      if (Math.abs(Math.round(hud.bottom + 4) - this.hudTop) > 6) this.layout();
    }

    const pending = g.pendingSouls();
    const ab = this.el.abyssBadge;
    ab.hidden = DEMO || pending < 1;
    setText(ab, fmt(pending));
    // Worth it at +50% souls: the genre's rule of thumb for a reset.
    ab.classList.toggle('hot', g.canDescend() && pending >= g.s.souls / 2);

    if (g.canAwaken() && !this.toldAwaken) {
      this.toldAwaken = true;
      if (g.s.awakens === 0) this.toast('<b>The Heart stirs</b>', 'ui_heart_full', 'trophy');
    }
    // The Heart's button shows up AWAKEN_TEASE floors before it can first wake (its panel shows the way to it); its badge
    // is what an awakening would pay now.
    const teased = g.s.awakens > 0 || g.s.cycleBest >= TUNE.awakenFloor - AWAKEN_TEASE;
    this.el.heartBtn.hidden = !AWAKEN_ON || !teased;
    if (AWAKEN_ON && teased && !g.s.heartTeased) {
      g.s.heartTeased = true;
      if (!g.s.awakens) this.toast(`<b>Something beats below</b> Floor ${fmt(TUNE.awakenFloor)}`, 'ui_heart_full', 'trophy');
    }
    const bound = g.canAwaken() ? g.pendingBound() : 0;
    this.el.heartBadge.hidden = bound < 1;
    setText(this.el.heartBadge, fmt(bound));
    this.el.heartBadge.classList.toggle('hot', bound > 0 && (!g.s.awakens || bound >= g.s.boundEarned / 4));
    const rb = this.el.relicBadge;
    rb.hidden = this.newRelics < 1;
    // The Keep opens with your first ascent; from then on it's a button away (and the way back down, while you're there).
    this.el.keepBtn.hidden = !g.legendsOpen() || g.inVault() || !!g.raid;
    // Up in the Keep it's the way back down: steps instead of the door.
    const keepText = DEMO ? '' : g.s.inKeep ? 'Way down' : 'The Keep';
    if (this.keepBtnText !== keepText) {
      this.keepBtnText = keepText;
      this.el.keepBtn.innerHTML = `${g.s.inKeep ? G.steps(3) : G.door(3)}<span>${keepText}</span>`;
    }
    document.body.classList.toggle('in-keep', g.s.inKeep);
    setText(rb, `+${this.newRelics}`);
    const cb = this.el.cardBadge;
    cb.hidden = this.newCards < 1;
    setText(cb, `+${this.newCards}`);
    this.el.bladeRate.hidden = !g.abilityUnlocked('blade');
    const rate = `${perSec(g.autoRate())}/s`;
    const rateEl = this.el.bladeRate.lastElementChild!;
    if (rateEl.textContent !== rate) rateEl.textContent = rate;

    this.hints();
    if (this.modal && ['trophies', 'cards', 'abyss', 'marks', 'heart', 'trips', 'stats', 'party', 'records', 'ascents', 'relics'].includes(this.modal) && !this.descending) this.renderModal(true);
    if (this.tripsBack.length && (!this.modal || this.modal === 'trips') && !this.descending && !this.keepFading) this.showTripsBack(this.modal === 'trips');
    this.tellTripFinds();
    this.refreshTip();
  }

  /** The zone name always shows whole: tighter letters, then a size smaller, then (rarely) a second line. */
  private fitFloorSub() {
    const sub = this.el.floorSub;
    sub.classList.remove('tight', 'tighter', 'wrap');
    for (const step of ['tight', 'tighter', 'wrap']) {
      if (sub.scrollWidth <= sub.clientWidth) return;
      sub.classList.add(step);
    }
  }

  private renderFloor() {
    const g = this.game;
    const s = g.s;
    const boss = g.bossFloor();
    if (s.floor !== this.mapFloor) {
      this.mapFloor = s.floor;
      this.mapPage = null;
    }
    const page = this.mapPage ?? Math.floor((s.floor - 1) / MAP_ROOMS);
    const owned = g.heroIndex() >= 0 ? g.heroIndex() : Math.max(0, s.owned.findIndex((n) => n > 0));
    const key = `${s.floor}|${s.maxFloor}|${s.auto}|${boss}|${page}|${owned}`;
    if (key !== this.floorKey) {
      this.floorKey = key;
      setText(this.el.floorN, `Floor ${fmt(s.floor)}`);
      const mods = boss ? g.bossMods() : [];
      // Two tags fit; the rest show as a count (hover for them all).
      if (mods.length) this.el.floorSub.innerHTML = `Boss <span class="chips">${modChips(mods.slice(0, mods.length > 2 ? 1 : 2))}${mods.length > 2 ? `<em class="mod more" style="--mc:var(--dim)">+${mods.length - 1}</em>` : ''}</span>`;
      else setText(this.el.floorSub, boss ? 'Boss' : zoneName(s.floor).replace(/^The /, ''));
      this.fitFloorSub();
      this.el.floorBox.classList.toggle('is-boss', boss);
      (this.el.down as HTMLButtonElement).disabled = s.floor <= 1;
      (this.el.up as HTMLButtonElement).disabled = s.floor >= s.maxFloor;
      this.el.auto.classList.toggle('on', s.auto);
      setText(this.el.auto, s.auto ? 'Auto: on' : 'Auto: off');
      // Five rooms on a winding corridor, each page ending on a boss. Drawn twice: an island in the corner on wide
      // screens, inside the floor box on narrow ones (CSS picks).
      const first = page * MAP_ROOMS + 1;
      const fresh = this.mapMax && s.maxFloor > this.mapMax ? s.maxFloor : 0;
      this.mapMax = s.maxFloor;
      const spots = Array.from({ length: MAP_ROOMS }, (_, k) => [10 + k * 20, k % 2 ? 72 : 42]);
      const rooms = spots.map(([x, y], k) => {
        const f = first + k;
        const state = f === s.floor ? 'now' : f <= s.maxFloor ? 'reached' : 'locked';
        const kind = f % 10 === 0 ? ' zone' : f % 5 === 0 ? ' boss' : '';
        const badge = kind ? (f % 10 === 0 ? CROWN : SKULL) : '';
        const pin = state === 'now' ? `<b class="pin">${charFit(COMPS[owned].sprite, 14)}</b>` : '';
        return `<button class="fm ${state}${kind}${f === fresh ? ' fresh' : ''}" style="--x:${x}%;--y:${y}%" data-goto="${f}" data-tip="fm:${f}"${state === 'locked' ? ' disabled' : ''}>${floorArt(f, kind ? 26 : 20)}${badge}<span class="num">${fmt(f)}</span>${pin}</button>`;
      }).join('');
      // The corridor runs in from the page before and on to the next; stretches you've walked are lit.
      const path = [[0, 57], ...spots, [100, 57]];
      const steps = path.slice(1).map(([x, y], k) => {
        const lit = first + k > 1 && first + k <= s.maxFloor;
        return `<line class="${lit ? 'lit' : ''}" x1="${path[k][0]}" y1="${path[k][1]}" x2="${x}" y2="${y}"/>`;
      }).join('');
      const html = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${path.join(' ')}"/>${steps}</svg>${rooms}`;
      for (const map of this.floorMaps) {
        map.dataset.slide = this.mapSlide;
        map.innerHTML = html;
      }
      this.mapSlide = '';
      const home = Math.floor((s.floor - 1) / MAP_ROOMS);
      (this.el.zonePrev as HTMLButtonElement).disabled = page <= 0;
      (this.el.zoneNext as HTMLButtonElement).disabled = first + MAP_ROOMS > s.maxFloor;
      this.el.zonePrev.classList.toggle('home', home < page);
      this.el.zoneNext.classList.toggle('home', home > page);
    }
    if (this.clutchHold && performance.now() < this.clutchHold.until) {
      // A clutch kill: the clock stops where the boss fell, for the slow motion to show it.
      const { left, max } = this.clutchHold;
      this.el.floorBar.style.width = `${max ? (left / max) * 100 : 0}%`;
      setText(this.el.floorBarT, `${left.toFixed(1)}s`);
      this.el.floorBox.classList.add('urgent');
    } else if (boss && g.inVault()) {
      // The boss steps aside for the vault; its clock is frozen.
      this.el.floorBar.style.width = `${g.bossTimeMax ? (Math.max(0, g.bossTime) / g.bossTimeMax) * 100 : 100}%`;
      setText(this.el.floorBarT, 'Boss waits');
      this.el.floorBox.classList.remove('urgent');
    } else if (boss && !g.monsters.some((m) => m.boss)) {
      // Farming a boss floor: the next one is on its way up.
      this.el.floorBar.style.width = '0%';
      setText(this.el.floorBarT, 'Next boss coming…');
      this.el.floorBox.classList.remove('urgent');
    } else if (boss) {
      // The bar is the clock: it drains steadily. (The boss's health is the bar over its head.)
      const left = Math.max(0, g.bossTime);
      this.el.floorBar.style.width = `${(left / g.bossTimeMax) * 100}%`;
      setText(this.el.floorBarT, `${left.toFixed(1)}s`);
      this.el.floorBox.classList.toggle('urgent', g.bossTime < 8);
    } else {
      const need = g.killsNeeded();
      const k = Math.min(need, s.floorKills);
      this.el.floorBar.style.width = `${(k / need) * 100}%`;
      setText(this.el.floorBarT, s.floorKills >= need ? 'Cleared' : `${k} / ${need}`);
      this.el.floorBox.classList.remove('urgent');
    }
  }

  /** One chip per active buff: built once (so its pop-in plays once), then only the timer updates. */
  private renderBuffs(buffs: Buff[]) {
    // Skills count down on their own squares (and Rampage on its bar), so only the rest get a chip here.
    const active = buffs.filter((b) => b.id !== 'fever' && !ABILITY_BY_ID.has(b.id as AbilityId));
    const box = this.el.buffs;
    for (const chip of [...box.children] as HTMLElement[]) {
      if (!active.some((b) => b.id === chip.dataset.buff)) chip.remove();
    }
    for (const b of active) {
      let chip = box.querySelector<HTMLElement>(`[data-buff="${b.id}"]`);
      if (!chip) {
        const ability = ABILITY_BY_ID.get(b.id as AbilityId);
        const ico = b.id === 'bloodlust' ? 'flask_big_red' : b.id === 'heartstorm' ? 'weapon_golden_sword' : b.id === 'soulstorm' ? 'chest_mimic_open' : b.id === 'vault' ? 'chest_full_open' : 'coin';
        chip = document.createElement('div');
        chip.className = `buff ${b.id}`;
        chip.dataset.buff = b.id;
        chip.innerHTML = `<span class="buff-ico">${ability ? charFit(COMPS[ability.comp].sprite, 24) : spriteFit(ico, 24)}</span><span class="buff-t"><b>${esc(b.name)}</b><small></small></span><em class="buff-bar"></em>`;
        box.appendChild(chip);
      }
      // Phones only have room for the countdown; the icon says which buff it is.
      const vault = b.id === 'vault' ? this.game.vault : null;
      const what = vault ? `${vault.chests.filter((c) => c.open).length}/${vault.chests.length} chests` : buffText(b);
      const time = Number.isFinite(b.t) ? `${Math.ceil(b.t)}s` : '';
      const text = document.body.classList.contains('phone') ? time || what : [what, time].filter(Boolean).join(' · ');
      const small = chip.querySelector('small')!;
      if (small.textContent !== text) small.textContent = text;
      (chip.querySelector('.buff-bar') as HTMLElement).style.width = Number.isFinite(b.t) ? `${(b.t / b.dur) * 100}%` : '100%';
    }
  }

  private renderRows() {
    const g = this.game;
    const revealed = g.s.revealed;
    const offer = new Set(g.shopUpgrades().map((u) => u.id));
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
      const trip = g.s.expeditions.find((e) => e.comp === i && e.pausedAt === undefined);
      const can = !locked && !mystery && !trip && g.s.gold.gte(q.cost);
      row.classList.toggle('can', can);
      row.classList.toggle('away', !!trip);
      row.classList.toggle('is-hero', g.heroIndex() === i);
      row.classList.toggle('owned', g.s.owned[i] > 0);
      row.classList.toggle('mystery', mystery || locked);
      row.style.setProperty('--prog', locked ? '0%' : `${Math.min(1, g.s.gold.div(q.cost).toNumber()) * 100}%`);
      const lv = g.s.owned[i];
      const traits = lv > 0 && !locked && !mystery ? this.traitStates(i, offer) : [];
      const marks = g.s.marks[i];
      const key = [mystery, locked, q.n, q.cost.toString(), lv, can, marks, g.s.settings.notation, Math.round(g.compDps(i).plus(1).log10() * 20), traits.join(''), trip?.floor].join('|');
      if (key === this.rowCache[i]) return;
      this.rowCache[i] = key;
      const name = locked || mystery ? '???' : def.name;
      row.querySelector('.gen-name')!.innerHTML = `${name}${marks && !locked && !mystery ? ` <span class="marks" data-tip="mark:${i}">${G.heart(1.5)}${marks}</span>` : ''}${q.n > 1 && !locked && !mystery ? ` <small>×${q.n}</small>` : ''}`;
      row.querySelector('.gen-cost')!.innerHTML = !DEMO && trip ? `<span class="need trip-tag">Expedition · floor ${fmt(trip.floor)}</span>` : locked ? `<span class="need">${G.lock()} ${meetText(def, g.s.cycleBest)}</span>` : gold(q.cost, can ? 'ok' : 'no');
      row.querySelector('.gen-lv')!.textContent = lv ? `Lv ${lv}` : '';
      row.querySelector('.gen-dps')!.textContent = trip ? '' : lv ? `${fmt(g.compDps(i))} dps` : '';
      // Owned traits and the next one only: the rest show up as you buy your way along. Past the last trait, the next
      // automatic level bonus.
      const shown = traits.findIndex((st) => st !== 'got');
      const auto = lv > 0 && traits.length && shown < 0 ? `<span class="trait ${levelMult(lv) > 1 ? 'got' : 'later'} auto" data-tip="lvl:${i}">×${milestoneMult(nextMilestone(i, lv))}<small>${nextMilestone(i, lv)}</small></span>` : '';
      row.querySelector('.traits')!.innerHTML = traits.slice(0, shown < 0 ? traits.length : shown + 1).map((state, k) => {
        const id = `m${i}_${k}`;
        // A star for every trait that isn't ×2 to this companion (skills, party, clicks, gold, bosses, crits, the blade);
        // it stays on traits still to come.
        const ability = UPG_BY_ID.get(id)?.effect.t !== 'comp';
        const inner = ability ? '✦' : state === 'later' ? '' : '×2';
        const label = state === 'later' ? `<small>${milestoneAt(k)}</small>` : '';
        return `<span class="trait ${state}${ability ? ' ability' : ''}" data-tip="upg:${id}"${state === 'buy' || state === 'reached' ? ` data-trait="${id}"` : ''}>${inner}${label}</span>`;
      }).join('') + auto;
    });
  }

  /** Each of a companion's traits: owned, affordable now, reached but too dear, or a level still to come. */
  private traitStates(i: number, offer: Set<string>) {
    const g = this.game;
    return traitLevels(i).map((_, k) => {
      const id = `m${i}_${k}`;
      if (g.hasUpgrade(id)) return 'got';
      if (!offer.has(id)) return 'later';
      return g.s.gold.gte(g.upgCost(UPG_BY_ID.get(id)!)) ? 'buy' : 'reached';
    });
  }

  /** The ability column: locked, always on, ready, running (time left), cooling down, or charging (Rampage). */
  private renderAbilities() {
    const g = this.game;
    for (const slot of this.el.abilities.children as HTMLCollectionOf<HTMLElement>) {
      const id = slot.dataset.ability as AbilityId;
      const a = ABILITY_BY_ID.get(id)!;
      // Rampage runs as the 'fever' buff, and charges instead of cooling down.
      const buff = g.s.buffs.find((b) => b.id === (id === 'rampage' ? 'fever' : id));
      const cd = g.abilityCooldown(id);
      const charging = a.kind === 'charge' && !buff && g.s.fervor < 1;
      const state = !g.abilityUnlocked(id) ? 'locked' : a.kind === 'passive' ? 'passive' : buff ? 'active' : charging ? 'charging' : cd > 0 ? 'cooling' : 'ready';
      if (slot.dataset.state !== state) {
        slot.dataset.state = state;
        slot.className = `ab ${state}`;
      }
      const fill = buff && state === 'active' ? 1 - buff.t / buff.dur : state === 'cooling' ? cd / (a.cooldown ?? 1) : state === 'charging' ? g.s.fervor : 0;
      slot.style.setProperty('--cd', `${fill * 100}%`);
      const time = buff && state === 'active' ? `${Math.ceil(buff.t)}s` : state === 'cooling' ? clock(cd) : state === 'charging' ? `${Math.floor(g.s.fervor * 100)}%` : '';
      const label = slot.querySelector('.ab-time')!;
      if (label.textContent !== time) label.textContent = time;
    }
  }

  /** A kill's gold: it bursts out of the monster, bounces to a stop and glints on the floor until it's swept up (or flies
   *  to the bank by itself). Bosses and champions spray a handful of coins; picking up any of them takes the pile. */
  private coinPiles = new Map<number, { coins: { el: HTMLElement; x: number; y: number }[]; gold: Decimal; landsAt: number }>();
  private pickCombo = 0;
  private pickAt = 0;

  private dropCoins(id: number, from: number, big: boolean, value: Decimal) {
    const at = this.scene.screenOf(from);
    if (!at) return;
    const sx = at.x;
    const sy = at.y + at.h * 0.4;
    const coins = Array.from({ length: big ? 5 : 1 }, (_, k) => {
      const angle = big ? (k / 5) * Math.PI * 2 + Math.random() * 0.6 : Math.random() * Math.PI * 2;
      const reach = big ? 50 + Math.random() * 40 : 20 + Math.random() * 30;
      const x = sx + Math.cos(angle) * reach;
      const y = at.y + at.h * 0.9 + Math.sin(angle) * reach * 0.35;
      const el = document.createElement('i');
      el.className = 'drop spinning';
      el.innerHTML = sprite('coin', 3);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      this.el.drops.appendChild(el);
      // Out of the monster in an arc, a hard landing, one small bounce, then it settles and glints.
      const dx = sx - x;
      const dy = sy - y;
      const peak = 60 + Math.random() * 40;
      const anim = el.animate([
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5) rotate(0deg)` },
        { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - peak}px)) scale(1.15) rotate(200deg)`, offset: 0.45 },
        { transform: 'translate(-50%, -50%) scale(1) rotate(360deg)', offset: 0.75 },
        { transform: 'translate(-50%, calc(-50% - 9px)) scale(1)', offset: 0.87 },
        { transform: 'translate(-50%, -50%) scale(1)' },
      ], { duration: 620 + Math.random() * 160, easing: 'cubic-bezier(.3,.6,.5,1)' });
      anim.onfinish = () => {
        el.classList.remove('spinning');
        el.classList.add('landed');
      };
      return { el, x, y };
    });
    this.coinPiles.set(id, { coins, gold: value, landsAt: performance.now() + 300 });
  }

  /** When the mouse or keys were last used (the vault's hero sees itself out after a long while without). */
  private inputAt = performance.now();

  /** Where the cursor (or a finger still on the screen) is, for picking up gold. */
  private coinPointer: { x: number; y: number } | null = null;

  /** Your hero and the cursor (or a finger) sweep up any gold close to them: no pixel hunting. */
  private sweepCoins(collectors: { x: number; y: number }[]) {
    if (this.modal || !collectors.length) return;
    const now = performance.now();
    for (const [id, pile] of this.coinPiles) {
      if (now < pile.landsAt) continue;
      let take = false;
      for (const c of pile.coins) {
        // Each coin answers to whichever collector is nearest.
        let near = collectors[0];
        for (const p of collectors) if (Math.hypot(c.x - p.x, c.y - p.y) < Math.hypot(c.x - near.x, c.y - near.y)) near = p;
        const { x, y } = near;
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < COIN_REACH) take = true;
        // Within the magnet's pull, coins lean toward the collector, more the closer it is.
        const pull = d < COIN_MAGNET ? 0.4 * (1 - d / COIN_MAGNET) : 0;
        c.el.style.translate = pull ? `${(x - c.x) * pull}px ${(y - c.y) * pull}px` : '';
      }
      if (take) this.game.collectGold(id);
    }
  }

  // ---------- goblin vault ----------

  private vaultPickTimer = 0;
  private coinRun = 0;
  private coinRunAt = 0;

  /** Everything slows: your companions' faces come up, and you pick who goes through the portal. */
  private showVaultPick() {
    const g = this.game;
    const hero = Math.max(0, g.heroIndex());
    // Each face rises in after the one before it (the rainbow goes up first, see the CSS delays).
    const party = COMPS.map((c, i) => [c, i] as const).filter(([, i]) => g.s.owned[i] > 0);
    this.el.vaultFaces.innerHTML = party.map(([c, i], k) => `<button class="vp-face${i === hero ? ' hero' : ''}" data-vault-hero="${i}" style="--k:${k}">${charFit(c.sprite, 44)}<small>${esc(c.name)}</small></button>`).join('');
    this.el.vaultPick.hidden = false;
    this.hideTip();
    // Left alone, your hero goes.
    clearTimeout(this.vaultPickTimer);
    this.vaultPickTimer = window.setTimeout(() => this.enterVault(hero), 10_000);
  }

  private enterVault(comp: number) {
    this.closeVaultPick();
    this.game.enterVault(comp);
  }

  private closeVaultPick() {
    clearTimeout(this.vaultPickTimer);
    this.el.vaultPick.hidden = true;
  }

  /** A chest bursts: its coins pour up out of it and stream into the bank, the pitch climbing as you chain them. */
  private chestOpened(id: number, gold: Decimal, rainbow: boolean) {
    const at = this.scene.chestScreen(id);
    const now = performance.now();
    this.pickCombo = now - this.pickAt < 900 ? Math.min(this.pickCombo + 1, 14) : 0;
    this.pickAt = now;
    // (The chest's own sound plays from the game event; this is the coins, climbing as you chain chests.)
    this.hooks.sound('coins', { vol: 0.3, rate: 1 + this.pickCombo * 0.05 });
    if (rainbow) this.banner('RAINBOW CHEST!', `+${fmt(gold)} gold`, 'loot rainbow');
    if (!at) {
      this.coinFly(this.field.w / 2, this.field.h / 2, rainbow ? 30 : 8, gold);
      return;
    }
    this.pop(at.x, at.y - 24, `+${fmt(gold)}`, rainbow ? 'p-pick p-big' : 'p-pick');
    this.sparkle(at.x, at.y, rainbow ? 16 : 9);
    this.coinFly(at.x, at.y, rainbow ? 30 : 8, gold);
  }

  private bankCoins(id: number, by: BankedBy) {
    const pile = this.coinPiles.get(id);
    if (!pile) return;
    this.coinPiles.delete(id);
    if (by === 'hand') {
      // A quick run of pickups climbs in pitch.
      const now = performance.now();
      this.pickCombo = now - this.pickAt < 700 ? Math.min(this.pickCombo + 1, 12) : 0;
      this.pickAt = now;
      this.hooks.sound('coins', { vol: 0.35, rate: 1 + this.pickCombo * 0.06 });
    }
    if (by === 'hand' || by === 'time') {
      const first = pile.coins[0];
      this.pop(first.x, first.y - 18, `+${fmt(pile.gold)}`, 'p-pick');
    }
    for (const c of pile.coins) {
      const r = c.el.getBoundingClientRect();
      c.el.remove();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (by === 'hand') this.sparkle(cx, cy);
      // Leaving a floor banks everything at once: a few coins make the trip, not all of them.
      if (by !== 'all' || this.flights.length < 6) this.coinFly(cx, cy, 1, pile.gold.div(pile.coins.length));
    }
  }

  /** A little burst of gold sparks where a coin was picked up. */
  private sparkle(x: number, y: number, n = 7) {
    const burst = document.createElement('i');
    burst.className = 'sparks';
    burst.style.left = `${x}px`;
    burst.style.top = `${y}px`;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = 18 + Math.random() * 16;
      const spark = document.createElement('b');
      spark.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      spark.style.setProperty('--dy', `${Math.sin(a) * d}px`);
      burst.appendChild(spark);
    }
    this.el.drops.appendChild(burst);
    setTimeout(() => burst.remove(), 500);
  }

  /** Auto-buy for companion traits, beside the hire modes. */
  private renderShopActs() {
    const g = this.game;
    const auto = g.autoUpgOpen();
    this.el.autoUpg.hidden = !auto;
    if (auto) {
      if (this.el.autoUpg.textContent !== 'Auto traits') this.el.autoUpg.textContent = 'Auto traits';
      this.el.autoUpg.classList.toggle('on', g.s.settings.autoUpg);
      this.el.autoUpg.classList.toggle('busy', g.s.settings.autoUpg && g.autoUpgLeft() > 0);
    }
    const hire = g.autoHireOpen();
    this.el.autoHire.hidden = !hire;
    if (hire) {
      if (this.el.autoHire.textContent !== 'Auto hire') this.el.autoHire.textContent = 'Auto hire';
      this.el.autoHire.classList.toggle('on', g.s.settings.autoHire);
      this.el.autoHire.classList.toggle('busy', g.s.settings.autoHire && g.autoHireLeft() > 0);
    }
  }

  // ---------- onboarding ----------

  private hints() {
    const g = this.game;
    let state = '';
    const firstRun = g.s.descents === 0 && g.s.awakens === 0;
    const noUpgrades = g.s.upgradesKnown.length === 0;
    const upgradeRow = noUpgrades ? this.rows.findIndex((row) => row.querySelector('.trait.buy')) : -1;
    const starOpen = g.s.heroTips === 1 && g.s.owned.filter((n) => n > 0).length >= 2;
    this.starFrom = starOpen ? this.starFrom || performance.now() : 0;
    if (g.s.clicks < 6) state = 'click';
    else if (g.s.owned.every((n) => n === 0) && g.s.gold.gte(g.compCost(0))) state = firstRun ? 'hire' : 'nudge';
    else if (g.abilityUnlocked('blade') && !g.s.bladeSeen) state = 'blade';
    else if (g.abilityUnlocked('flurry') && !g.s.flurrySeen) state = 'flurry';
    // The first champion: pointed out until one is slain.
    else if (g.s.champions === 0 && g.monsters.some((m) => m.champ)) state = 'champ';
    // The first champion boss that pays souls, too: by then you've usually met a champion, but not this.
    else if (!g.s.soulBossDone && g.s.floor >= TUNE.goldBossFrom && g.monsters.some((m) => m.champ && m.boss)) state = 'champ';
    // Your first Heartmark: pointed out on its companion's row for a few seconds.
    else if (!g.s.markTipSeen && g.marksTotal() > 0) state = 'mark';
    // After your first ascent: the Auto button that buys back the traits you had.
    else if (!g.s.autoTipSeen && g.autoUpgOpen() && !this.el.autoUpg.hidden) state = 'auto';
    else if (g.raid && g.s.raids === 0) state = 'raid';
    // Meeting your hero: first on the field, then (once there's someone to switch to) the star that picks one.
    else if (g.s.heroTips === 0 && g.heroIndex() >= 0) state = 'hero';
    else if (upgradeRow >= 0) state = 'upgrade';
    else if (firstRun && noUpgrades && g.s.owned[0] === 1 && g.s.gold.gte(g.compCost(0))) state = 'level';
    else if (g.s.fevers === 0 && g.rampageReady()) state = 'rampage';
    else if (starOpen && this.onMonsterAt > this.starFrom + STAR_WAIT_MS) state = 'star';
    // Hints point at the battlefield and shop, so they wait while a panel covers them.
    if (this.modal || g.s.inKeep) state = '';
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
      this.pointAt(this.rows[this.starPick()]?.querySelector('.gen-hero'));
      if (shown > 15_000) g.s.heroTips = 2;
    } else if (state === 'hire' || state === 'level') {
      this.pointAt(this.rows[0]);
    } else if (state === 'blade') {
      this.pointAt(this.el.bladeRate);
      if (shown > 8_000) g.s.bladeSeen = true;
    } else if (state === 'rampage') {
      this.pointAt(this.el.abilities.querySelector('[data-ability="rampage"]'));
    } else if (state === 'flurry') {
      this.pointAt(this.el.abilities.querySelector('[data-ability="flurry"]'));
      if (g.abilityCooldown('flurry') > 0 || (this.hintState === 'flurry' && performance.now() - this.tourAt > FLURRY_TIP_MS)) g.s.flurrySeen = true;
    } else if (state === 'auto') {
      this.pointAt(this.el.autoUpg);
      if (this.hintState === 'auto' && performance.now() - this.tourAt > MARK_TIP_MS) g.s.autoTipSeen = true;
    } else if (state === 'mark') {
      const row = this.rows[this.markRow()];
      this.pointAt(row?.querySelector('.marks') ?? row);
      if (this.hintState === 'mark' && performance.now() - this.tourAt > MARK_TIP_MS) g.s.markTipSeen = true;
    } else if (state === 'upgrade') {
      this.pointAt(this.rows[upgradeRow].querySelector('.trait.buy'));
    }
    if (state === 'champ') {
      const champ = g.monsters.find((m) => m.champ && m.boss) ?? g.monsters.find((m) => m.champ);
      const s = champ && this.scene.screenOf(champ.id);
      // (A champion boss can stand taller than the screen: keep the hint on it.)
      if (s) this.el.hint.style.transform = `translate(${s.x}px, ${Math.min(s.y + s.h + 16, innerHeight - 120)}px)`;
      this.el.hint.style.visibility = s ? 'visible' : 'hidden';
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
    const pointing = ['star', 'hire', 'level', 'upgrade', 'shop', 'rampage', 'flurry', 'blade', 'mark', 'auto'].includes(state);
    this.el.hint.hidden = !pointing && state !== 'click' && state !== 'hero' && state !== 'champ';
    if (!pointing) this.el.hint.classList.remove('point-right', 'point-down');
    this.el.hint.classList.toggle('still', state === 'hero');
    this.el.shop.classList.toggle('show-stars', state === 'star');
    this.el.hint.innerHTML = state === 'hero'
      ? `<b>This is your hero!<small>The one with the gold ring · ${this.touch ? 'hold a finger down to lead them' : 'they follow your mouse'}</small></b>`
      : state === 'star' ? `<b>Try making the ${esc(COMPS[this.starPick()]?.name ?? 'next one')} your hero<small>Click their ${G.star()} to switch</small></b>`
        : state === 'hire' ? `<b>Hire the ${esc(COMPS[0].name)}!<small>Companions fight for you, even while you're away</small></b>`
          : state === 'level' ? `<b>Keep ${this.touch ? 'tapping' : 'clicking'} to level up<small>At level 10 the ${esc(COMPS[0].name)} gets an upgrade</small></b>`
            : state === 'blade' ? `<b>Phantom Blade unlocked!<small>It attacks for you, once a second</small></b>`
            : state === 'flurry' ? `<b>Flurry is ready!<small>${this.touch ? 'Tap it' : `Click it or press ${abilityKey('flurry')}`} to use it</small></b>`
            : state === 'rampage' ? `<b>Rampage is ready!<small>${this.touch ? 'Tap it' : `Click it or press ${abilityKey('rampage')}`} to unleash it</small></b>`
            : state === 'upgrade' ? `<b>Your first upgrade!<small>${this.firstUpgradeHint(upgradeRow)}</small></b>`
            : state === 'shop' ? `<b>An upgrade is ready!<small>${this.touch ? 'Tap it to buy it' : 'Click it to buy it, or press U'}</small></b>`
              : state === 'champ' ? this.champHint()
              : state === 'auto' ? `<b>Auto-buy<small>Traits you've bought before buy themselves</small></b>`
              : !DEMO && state === 'mark' ? `<b>A Heartmark!<small>The ${esc(COMPS[this.markRow()].name)} deals +${MARK_POWER * 100}% damage</small></b>`
              : `<b>${this.touch ? 'Tap' : 'Click'} the monsters!<small>Hold to keep attacking</small></b>`;
    this.rows.forEach((row, i) => row.classList.toggle('nudge', (i === 0 && ['hire', 'nudge', 'level'].includes(state)) || (state === 'upgrade' && i === upgradeRow)));
    this.el.raid.classList.toggle('first', state === 'raid');
  }

  /** What the first trait on offer does, in the words of the hint that points at it. */
  private firstUpgradeHint(row: number) {
    const id = `m${row}_0`;
    const skill = ABILITY_BY_UPGRADE.get(id);
    const press = this.touch ? 'Tap' : 'Click';
    if (skill) return `${press} the ✦ to unlock the ${esc(skill.name)}`;
    const u = UPG_BY_ID.get(id);
    return u?.effect.t === 'comp' ? `${press} the ×2 to double ${esc(COMPS[row].name)}'s damage` : `${press} the ✦: ${esc(u?.desc ?? '')}`;
  }

  /** Moves the hint's arrow onto something in the party panel: beside it when there's room to its left (the panel on the
   *  right), above it otherwise (the phone sheet). Hidden while it's scrolled out of view. */
  private pointAt(target: Element | null | undefined) {
    const rect = target?.getBoundingClientRect();
    const visible = !!rect && rect.width > 0 && rect.top > 0 && rect.bottom < innerHeight;
    const above = !!rect && rect.left < 340;
    this.el.hint.classList.toggle('point-right', !above);
    this.el.hint.classList.toggle('point-down', above);
    if (rect) this.el.hint.style.transform = above ? `translate(${rect.left + rect.width / 2}px, ${rect.top - 6}px)` : `translate(${rect.left - 12}px, ${rect.top + rect.height / 2}px)`;
    this.el.hint.style.visibility = visible ? 'visible' : 'hidden';
  }

  /** The companion holding the most Heartmarks (where the first one is pointed out). */
  private markRow() {
    const marks = this.game.s.marks;
    return marks.indexOf(Math.max(...marks));
  }

  /** The first champion's hint: a champion boss from floor 100 also pays souls. */
  private champHint() {
    const g = this.game;
    const champ = g.monsters.find((m) => m.champ && m.boss) ?? g.monsters.find((m) => m.champ);
    if (champ?.boss && g.s.floor >= TUNE.goldBossFrom) {
      const n = g.champSouls(g.s.floor);
      return `<b>A champion boss!<small>Beat it for ${n} soul${n === 1 ? '' : 's'}. It might drop a gold card.</small></b>`;
    }
    return champ?.boss ? '<b>A champion boss!<small>Tougher, and it might drop a gold card</small></b>' : '<b>A champion!<small>Tougher and drops gold cards!</small></b>';
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
      if (DEMO && i >= DEMO_COMPANIONS) return '<div class="tt-h"><b>???</b></div><p class="tt-f">More companions join you in the full game.</p>';
      if (!g.compUnlocked(i)) return `<div class="tt-h"><b>???</b></div><p class="tt-f">Someone waits deeper down. ${meetText(def, g.s.cycleBest)}.</p>`;
      if (i === g.s.revealed && g.s.owned[i] === 0 && i > 0) return `<div class="tt-h"><b>???</b></div><p class="tt-f">A new companion is on their way. Earn more gold to meet them.</p>`;
      // Away hunting: the trip, not the hire.
      const trip = g.s.expeditions.find((e) => e.comp === i && e.pausedAt === undefined);
      if (!DEMO && trip) {
        return `<div class="tt-h">${charFit(def.sprite, 30)}<b>${def.name}</b><span class="tt-own">expedition</span></div>
          <dl class="tt-trip"><div><dt>Floor</dt><dd>${trip.floor}</dd></div><div><dt>Kills</dt><dd>${fmt(g.tripKills(trip))}</dd></div>
          <div><dt>Cards found</dt><dd>${fmt(trip.found?.length ?? 0)}</dd></div>
          <div><dt>Back in</dt><dd>${duration(Math.max(0, TRIP_HOURS * 3600 - g.tripSeconds(trip)))}</dd></div></dl>`;
      }
      const q = g.compQuote(i);
      const next = g.compNext(i).times(q.n);
      const share = g.baseDps().gt(0) ? g.compDps(i).div(g.baseDps()).toNumber() : 0;
      return `<div class="tt-h">${charFit(def.sprite, 30)}<b>${def.name}</b><span class="tt-own">level ${g.s.owned[i]}</span></div>
        <div class="tt-cost">${gold(q.cost, g.s.gold.gte(q.cost) ? 'ok' : 'no')}${q.n > 1 ? ` for ${q.n} levels` : ''}</div>
        <ul class="tt-l">
          ${g.s.owned[i] ? `<li>Deals <b>${fmt(g.compDps(i))}</b> damage/sec (${(share * 100).toFixed(1)}% of your party)</li>` : ''}
          <li>Next ${q.n > 1 ? `${q.n} levels` : 'level'}: <b class="up">+${fmt(next)}</b> damage/sec</li>
          <li>${traitLevels(i).includes(nextMilestone(i, g.s.owned[i])) ? 'Next trait' : `×${milestoneMult(nextMilestone(i, g.s.owned[i]))} damage`} at level ${nextMilestone(i, g.s.owned[i])}</li>
        </ul>
        <p class="tt-f">“${esc(def.flavor)}”</p>`;
    }
    if (kind === 'shop') {
      const text = id === 'next'
        ? 'Hire up to each companion\'s next milestone, where a damage upgrade unlocks.'
        : id === 'hire'
          ? `Rehire companions up to their best levels: ${g.s.settings.autoHire ? 'On' : 'Off'}.`
          : `Auto-buy traits you've bought before: ${g.s.settings.autoUpg ? 'On' : 'Off'}.`;
      return `<p class="tt-d">${text}</p>`;
    }
    if (kind === 'lvl') {
      const i = Number(id);
      const lv = g.s.owned[i];
      const now = levelMult(lv);
      return `<div class="tt-h"><b>Level bonus</b><span class="tt-own">automatic</span></div>
        <p class="tt-d">${esc(COMPS[i].name)} deals ×${milestoneMult(nextMilestone(i, lv))} damage at level ${nextMilestone(i, lv)}, and again every ${LEVEL_BONUS.every} levels (×${LEVEL_BONUS.thousand} at every 1,000th).</p>
        ${now > 1 ? `<p class="tt-gain">Now ×${fmt(now)} from levels.</p>` : ''}`;
    }
    if (kind === 'upg') {
      const u = UPG_BY_ID.get(id);
      if (!u) return '';
      const cost = g.upgCost(u);
      const forSkill = u.needs ? `${ABILITY_BY_ID.get(u.needs)!.name} upgrade` : 'upgrade';
      return `<div class="tt-h">${icon(u.icon, 32, false)}<b>${esc(u.name)}</b><span class="tt-own">${forSkill}</span></div>
        <div class="tt-cost">${gold(cost, g.s.gold.gte(cost) ? 'ok' : 'no')}</div>
        ${ABILITY_BY_UPGRADE.has(u.id) ? `<p class="tt-gain">Unlocks ${esc(ABILITY_BY_UPGRADE.get(u.id)!.name)}</p>` : ''}
        <p class="tt-d">${esc(u.desc)}</p>${this.upgPreview(u)}${u.flavor ? `<p class="tt-flavor">${esc(u.flavor)}</p>` : ''}`;
    }
    if (kind === 'ab') {
      const a = ABILITY_BY_ID.get(id as AbilityId)!;
      const comp = COMPS[a.comp];
      const cd = g.abilityCooldown(a.id);
      const key = this.touch ? '' : ` (or press ${abilityKey(a.id)})`;
      const fever = a.id === 'rampage' ? g.s.buffs.find((b) => b.id === 'fever') : undefined;
      const next = fever ? g.rampageNext() : null;
      const status = !DEMO && g.away(a.comp)
        ? `The ${comp.name} is on an expedition.`
        : !g.abilityUnlocked(a.id)
        ? `Unlocked by the ${comp.name}.`
        : a.kind === 'passive' ? 'Always on.'
          : fever ? (next ? `×${fmt(g.feverMult())}. Keep attacking for ×${fmt(next.mult)}.` : `×${fmt(g.feverMult())}. Full power.`)
            : a.kind === 'charge' && g.s.fervor < 1 ? `${Math.floor(g.s.fervor * 100)}% charged.`
              : cd > 0 ? `Ready again in ${duration(cd)}.` : `Ready. Click to use it${key}.`;
      const timing = a.kind === 'button' ? `<ul class="tt-l"><li>Lasts ${+g.abilityDuration(a.id).toFixed(1)}s · cooldown ${duration(a.cooldown ?? 0)}</li></ul>` : '';
      return `<div class="tt-h"><b>${esc(a.name)}</b><span class="tt-own">${a.kind === 'passive' ? 'always on' : this.touch ? 'ability' : `key ${abilityKey(a.id)}`}</span></div>
        <p class="tt-d">${esc(g.abilityText(a.id))}</p>${timing}<p class="tt-f">${status}</p>`;
    }
    if (kind === 'tro') {
      const t = TROPHIES.find((x) => x.id === id)!;
      return `<div class="tt-h">${icon(t.icon, 32, false)}<b>${esc(t.name)}</b><span class="tt-own">${g.hasTrophy(id) ? 'unlocked' : 'locked'}</span></div><p class="tt-d">${esc(t.desc)}</p>`;
    }
    if (kind === 'card') {
      const c = CARD_BY_ID.get(id)!;
      const n = g.cardCount(id);
      const gilded = g.hasGoldCard(id);
      // In the Cards panel you're looking at one color (a lap's tint, plain or gold): where, how many and how many slain
      // are that color's. Elsewhere, where it turns up on the lap you're on.
      const inPanel = this.modal === 'cards';
      const view = Math.min(this.cardLap, lapOf(g.s.bestFloor), CORRUPTION.length - 1);
      const onLap = Math.min(lapOf(g.s.floor), CORRUPTION.length - 1);
      const lap = inPanel ? view : c.laps.includes(onLap) ? onLap : c.laps[0];
      const goldView = inPanel && this.cardGold;
      const places = c.where[lap].filter((w) => w.floor <= g.s.bestFloor);
      const lines = places.map((w) => `<li>${esc(w.zone)} · ${w.boss ? `floor ${fmt(w.from)} boss` : `floors ${w.from}–${w.to}`}</li>`).join('');
      const common = places.flatMap((w) => w.common);
      const commonLine = common.length ? `<p class="tt-d">Most common on floor${common.length > 1 ? 's' : ''} ${common.length > 1 ? `${common.slice(0, -1).join(', ')} and ${common.at(-1)}` : common[0]}</p>` : '';
      // Until you've killed one, only where to find it: not its name.
      if (!n && !g.cardMet(id)) return `<div class="tt-h"><b>???</b></div><ul class="tt-l">${lines}</ul>`;
      const what = { monster: 'monster card', mid: 'boss card', boss: 'boss card', goblin: 'goblin card' }[c.kind];
      const own = g.s.cards[id];
      const here = inPanel ? ((goldView ? own?.gold : own?.n)?.[view] ?? 0) : n;
      const gilt = inPanel ? goldView : gilded;
      const head = `<div class="tt-h"><b style="color:${gilt && here ? CARD_FRAME.gold : CARD_FRAME[c.kind]}">${goldView ? 'Gold ' : ''}${esc(cardName(c.name, inPanel ? view : 0))} Card</b><span class="tt-own">${here ? `×${here}` : what}</span></div>`;
      const unit = c.kind === 'goblin' ? 'catch' : 'kill';
      // When the copy you're looking at was first found: the kill it dropped on, or where it came from.
      const found = (at?: number, via?: string) => (at ? `Found on ${unit} #${fmt(at)}` : via ? this.viaLine(via) : '');
      const first = goldView ? found(own?.goldAt, own?.goldVia) : here && (!inPanel || view === 0) ? found(own?.at, own?.via) : '';
      const caught = id === 'rainbow-goblin' ? g.s.rainbows : g.s.raids - g.s.rainbows;
      const tally = c.kind === 'goblin' ? `Caught ${fmt(caught)}`
        : goldView ? `Champions slain ${fmt(g.champsSlainOn(id, view))}`
          : `Slain ${fmt(inPanel ? g.slainOn(id, view) : g.s.slain[id] ?? 0)}`;
      return `${head}<ul class="tt-l">${lines}</ul>${commonLine}${goldView ? '<p class="tt-d">Drops from champions</p>' : ''}${first ? `<p class="tt-got">${first}</p>` : ''}<p class="tt-f">${tally}</p>`;
    }
    if (kind === 'rel') {
      const d = RELIC_BY_ID.get(id)!;
      const lv = g.relicLv(id);
      const head = `<div class="tt-h">${spriteFit(d.icon, 32)}<b style="color:${RARITY_COLORS[d.rarity]}">${lv ? esc(d.name) : '???'}</b><span class="tt-own">${RARITY[d.rarity]}${lv ? ` · level ${lv}` : ''}</span></div>`;
      if (!lv) return `${head}<p class="tt-f">Not found yet. ${d.rarity === 3 ? 'Legendary relics mostly turn up deep down.' : 'Keep killing bosses.'}</p>`;
      return `${head}<p class="tt-d">${esc(relicText(d, lv))}</p><p class="tt-gain">Next level: ${esc(relicText(d, lv + 1))}</p><p class="tt-f">“${esc(d.flavor)}”</p>`;
    }
    if (kind === 'note') return `<p class="tt-d">${esc(key.slice(5))}</p>`;
    if (!DEMO) {
      if (kind === 'souls') {
        return `<div class="tt-h"><b>How souls work</b></div>
          <p class="tt-d">You get them when you ascend:</p>
          <ul class="tt-l"><li>1 soul for every ${fmt(TUNE.levelsPerSoul)} companion levels you bought this run.</li>
          <li>Champion bosses (from floor ${fmt(TUNE.goldBossFrom)}) drop souls the first time you beat them each run, more the deeper they are.</li></ul>
          <p class="tt-d">Each soul you keep adds ${soulPct(1)} damage. Or spend them on Spirits.</p>`;
      }
      if (kind === 'respec') {
        const back = Math.floor(g.s.legendSpent * RESPEC_REFUND);
        return `<div class="tt-h"><b>Respec</b></div><p class="tt-d">Every Spirit leaves. You get back ${RESPEC_REFUND * 100}% of the souls spent on them.</p>
          <p class="tt-f">Spent ${G.soul(1.2)} ${fmt(g.s.legendSpent)} · back ${G.soul(1.2)} ${fmt(back)}</p>`;
      }
      if (kind === 'bound') {
        const b = BOUND.find((x) => x.id === id)!;
        const lv = g.boundLv(b.id);
        return `<div class="tt-h">${bossFig(b, 30, 36)}<b>${esc(boundName(b))}</b><span class="tt-own">${lv ? `level ${lv}` : 'Bound'}</span></div>${boundDetail(b, lv)}`;
      }
      if (kind === 'skill') {
        const a = ABILITY_BY_ID.get(id as AbilityId)!;
        const comp = COMPS[a.comp];
        const lasts = a.id === 'rampage' ? g.rampageDuration() : g.abilityDuration(a.id);
        const timing = a.kind === 'button' ? `Lasts ${duration(lasts)} · every ${duration(a.cooldown ?? 0)}` : a.kind === 'charge' ? `Lasts ${duration(lasts)}` : 'Always on';
        return `<div class="tt-h">${charFit(comp.sprite, 30)}<b>${esc(a.name)}</b><span class="tt-own">skill</span></div>
          <p class="tt-d">${esc(a.desc)}</p>
          <p class="tt-f">${esc(comp.name)} · level ${traitLevels(a.comp)[a.trait]}<br>${timing}</p>`;
      }
      if (kind === 'idle') {
        const d = LEGEND_BY_ID.get(id as LegendId)!;
        const lv = g.legendLv(d.id);
        return `<div class="tt-h">${charFit(d.sprite, 30)}<b>${esc(d.name)}</b><span class="tt-own">Spirit · level ${lv}</span></div><p class="tt-d">${esc(d.what)}: ${esc(d.value(lv))}</p>`;
      }
      if (kind === 'spirit') {
        const d = LEGEND_BY_ID.get(id as LegendId)!;
        const lv = g.legendLv(d.id);
        const b = BOUND.find((x) => x.spirit === d.id)!;
        const blv = g.boundLv(b.id);
        // The Spirit's effect at its level (or level 1, not yet summoned) for its Bound's level now and the next three.
        const shown = Math.max(1, lv);
        const rows = Array.from({ length: 4 }, (_, k) => blv + k).map((L) => {
          const boost = 1 + 0.25 * L;
          const share = legendShare(shown);
          const v = d.id === 'wither' ? `−${Math.round(Math.min(0.9, 0.5 * share * boost) * 100)}%`
            : d.id === 'soulcaller' ? `${Math.round((0.25 + 0.75 * Math.min(1, share * boost)) * 100)}%`
            : d.id === 'hourglass' ? `+${+(30 * share * boost).toFixed(1)}s`
            : d.id === 'lure' ? `+${Math.round(200 * share * boost)}%`
            : `−${Math.min(10 + L, shown)} kills, up to −${10 + L}`;
          return `<tr${L === blv ? ' class="on"' : ''}><td>${esc(boundName(b))} ${L}</td><td>${v}</td></tr>`;
        }).join('');
        return `<div class="tt-h">${charFit(d.sprite, 30)}<b>${esc(d.name)}</b><span class="tt-own">${lv ? `Spirit · level ${lv}` : 'Spirit · not summoned'}</span></div>
          <p class="od-what">${esc(d.what)} at level ${shown}</p>
          <table class="od-lv sp-lv">${rows}</table>`;
      }
      if (kind === 'legend') {
        const d = LEGEND_BY_ID.get(id as LegendId)!;
        const lv = g.legendLv(d.id);
        return `<div class="tt-h">${charFit(d.sprite, 30)}<b>${esc(d.name)}</b><span class="tt-own">${lv ? `level ${lv}` : KIND_NAME[d.kind]}</span></div>${legendDetail(d, lv)}`;
      }
      if (kind === 'mark') {
        const i = Number(id);
        const n = g.s.marks[i];
        return `<div class="tt-h"><b>${n} Heartmark${n === 1 ? '' : 's'}</b></div><p class="tt-d">The ${esc(COMPS[i].name)} deals +${n * MARK_POWER * 100}% damage.</p>`;
      }
    }
    if (kind === 'floor') {
      const mods = g.bossFloor() ? g.bossMods() : [];
      const champ = g.bossFloor() && g.s.floor >= TUNE.goldBossFrom && g.monsters.some((m) => m.boss && m.champ) ? g.champSouls(g.s.floor) : 0;
      const souls = champ ? `<li><em class="mod soul-chip" style="--mc:var(--soul)">${G.soul(1)} ${champ} soul${champ === 1 ? '' : 's'}</em> Champion boss</li>` : '';
      if (souls) return `<div class="tt-h"><b>Floor ${fmt(g.s.floor)} boss</b></div><ul class="tt-l">${souls}${mods.map((m) => `<li>${modChips([m])} ${esc(MOD_BY_ID.get(m)!.desc)}</li>`).join('')}</ul>`;
      if (!mods.length) return `<div class="tt-h"><b>Floor ${fmt(g.s.floor)}</b><span class="tt-own">${esc(zoneName(g.s.floor))}</span></div><p class="tt-d">${g.bossFloor() ? `Beat the boss before the clock runs out.` : `Kill ${g.killsNeeded()} monsters to clear the floor.`}</p>${g.s.floor < 30 ? '<p class="tt-f">From floor 30, bosses start showing up with modifiers.</p>' : ''}<p class="tt-f">Click the floor number to jump to a floor.</p>`;
      return `<div class="tt-h"><b>Floor ${fmt(g.s.floor)} boss</b></div><ul class="tt-l">${mods.map((m) => `<li>${modChips([m])} ${esc(MOD_BY_ID.get(m)!.desc)}</li>`).join('')}</ul>`;
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
      return now
        ? `<div class="tt-h"><b>The ${esc(COMPS[i].name)} is your hero</b></div><p class="tt-d">Click the ${G.star()} again to have no hero.</p>`
        : `<div class="tt-h"><b>Make the ${esc(COMPS[i].name)} your hero</b></div>`;
    }
    if (kind === 'fm') {
      const f = Number(id);
      const reached = f <= g.s.maxFloor;
      const what = f % 10 === 0 ? 'Zone boss' : f % 5 === 0 ? 'Boss' : zoneName(f).replace(/^The /, '');
      const face = f % 5 === 0 ? bossFor(f) : featuredFor(f);
      const where = f === g.s.floor ? 'You are here' : reached ? 'Click to go there' : 'Not reached yet';
      return `<div class="tt-h">${reached ? floorArt(f, 30) : ''}<b>Floor ${fmt(f)}</b><span class="tt-own">${what}</span></div><p class="tt-d">${reached ? esc(face.name) : '???'}</p><p class="tt-f">${where}</p>`;
    }
    if (kind === 'auto') return `<div class="tt-h"><b>Auto-advance</b></div><p class="tt-d">${g.s.auto ? 'On: you move to the next floor as soon as one is cleared.' : 'Off: you stay on this floor and farm it.'}</p>`;
    if (kind === 'dock') {
      const text: Record<string, string> = {
        trophies: `Trophies ${g.s.trophies.length}/${TROPHIES.length}. Cards ${g.cardVersions()}/${g.cardVersionsTotal()}.`,
        relics: `Relics: ${g.relicsFound()}/${RELICS.length} found. Bosses drop them.`,
        abyss: DEMO ? `The way up opens at floor ${fmt(g.ascendFloor())}.`
          : g.canDescend() ? `Ascend now for ${fmt(g.pendingSouls())} souls: ${soulPct(g.pendingSouls())} damage.` : g.descendOpen() ? 'Level companions and beat champion bosses for souls.' : `The way up opens at floor ${fmt(g.ascendFloor())}.`,
        ...(DEMO ? {} : {
          heart: g.canAwaken() ? `Awaken for ${fmt(g.pendingBound())} bound souls` : `Bound souls ${fmt(g.boundFree())}`,
          keep: g.s.inKeep ? `Back to floor ${fmt(g.s.floor)}` : 'The Keep',
        }),
        stats: 'Your numbers, and where every bonus comes from.',
        settings: 'Sound, visuals and saves.',
        mute: g.s.settings.muted ? 'Unmute' : 'Mute',
        blade: `Phantom Blade: ${perSec(g.autoRate())} attack${g.autoRate() === 1 ? '' : 's'} a second.`,
      };
      return `<p class="tt-d">${text[id]}</p>`;
    }
    return '';
  }

  private upgPreview(u: UpgDef): string {
    const g = this.game;
    const e = u.effect;
    let gain = new Decimal(0);
    if (e.t === 'global') gain = g.baseDps().times(e.pct);
    if (gain.lte(0)) return '';
    return `<p class="tt-gain">≈ +${fmt(gain)} damage/sec</p>`;
  }

  // ---------- news ----------

  private nextNews() {
    const g = this.game;
    const s = { floor: g.s.maxFloor, owned: g.s.owned, depth: g.s.descents, raids: g.s.raids, kills: g.s.kills, awakens: g.s.awakens };
    const pool = NEWS.map((n, i) => [n, i] as const).filter(([n, i]) => i !== this.newsIdx && (!n.when || n.when(s)) && (!n.rare || Math.random() < RARE_NEWS));
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
    if (name === 'cards') this.newCards = 0;
    this.el.modalWrap.hidden = false;
    this.renderModal();
    // Every menu (and tab) opens at the top, not wherever the last one was scrolled to.
    this.el.modal.scrollTop = 0;
  }

  closeModal() {
    this.tripsBackDone();
    if (this.modal === 'offline') for (const card of this.offlineCards.splice(0)) this.showCard(card);
    if (this.modal === 'relics') this.levelledRelics.clear();
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
      html = head('Trophies', `${n} / ${TROPHIES.length} · +${n}% damage`) + this.troTabs('trophies') + `<div class="tro-grid">${TROPHIES.map((t) => `<span class="tro ${g.hasTrophy(t.id) ? 'got' : ''}" data-tip="tro:${t.id}">${icon(t.icon, 28)}</span>`).join('')}</div>`;
    } else if (name === 'cards') {
      html = head('Cards') + this.troTabs('cards') + this.cardsHtml();

    } else if (DEMO && name === 'abyss') {
      html = head('Ascend') + this.ascendHtml();
    } else if (!DEMO && (name === 'abyss' || name === 'marks')) {
      const sub = `${G.soul()} ${fmt(g.soulsFree())} souls · ${soulPct(g.soulsFree())} damage`;
      html = head('Ascend', sub) + this.ascendHtml() + this.tabs(name) + (name === 'abyss' ? this.legendsHtml() : this.marksHtml());
    } else if (!DEMO && name === 'bound' && this.boundFocus) {
      const b = BOUND.find((x) => x.id === this.boundFocus)!;
      html = head(esc(boundName(b)), `${boundGlyph()} ${fmt(g.boundFree())} bound souls`) + `<div class="lcards one">${this.boundCard(b)}</div>
        <div class="legend-panel">${boundDetail(b, g.boundLv(b.id))}</div>`;
    } else if (!DEMO && name === 'legend' && this.legendFocus) {
      const d = LEGEND_BY_ID.get(this.legendFocus)!;
      html = head(esc(d.name), `${G.soul()} ${fmt(g.soulsFree())} souls`) + `<div class="lcards one">${this.legendCard(d)}</div>
        <div class="legend-panel">${legendDetail(d, g.legendLv(d.id))}</div>`;
    } else if (!DEMO && name === 'trips') {
      const out = g.s.expeditions.length;
      html = head('Expeditions', out ? `${out} out` : '') + this.tripsHtml();
    } else if (!DEMO && name === 'heart') {
      html = head('The Heart', g.s.awakens ? `${boundGlyph()} ${fmt(g.boundFree())} bound souls · ${g.s.awakens} awakening${g.s.awakens === 1 ? '' : 's'}` : '') + this.heartHtml();
    } else if (name === 'relics') {
      html = head('Relics', `${g.relicsFound()} / ${RELICS.length} found · ${g.s.equipped.length} / ${g.relicSlots()} slots`) + this.relicsHtml();
    } else if (name === 'stats' || name === 'party' || name === 'records' || name === 'ascents') {
      html = head('Stats') + this.statTabs(name) + (name === 'stats' ? this.bonusHtml() : name === 'party' ? this.partyHtml() : name === 'ascents' ? this.ascentsHtml() : this.recordsHtml());
    } else if (!DEMO && (name === 'dan' || name === 'victor')) {
      const who = name as Trader;
      html = head(`${charFit(who === 'dan' ? 'ef_elf_m' : 'victor', 26)} ${who === 'dan' ? 'Dan' : 'Victor'}`, who === 'dan' ? `Trade ${DAN_GIVES} cards for a random card` : `Trade ${VICTOR_GIVES} cards for 1 gold card`) + this.tradeHtml(who);
    } else if (name === 'settings') {
      const s = g.s.settings;
      const tog = (act: string, on: boolean, label: string) => `<button class="btn toggle ${on ? 'on' : ''}" data-act="${act}">${label}: ${on ? 'On' : 'Off'}</button>`;
      html = head('Options') + `
        <div class="set">
          <label>Effects volume <input type="range" min="0" max="100" value="${Math.round(s.sfxVol * 100)}" data-set="sfxVol"></label>
          <label>Music volume <input type="range" min="0" max="100" value="${Math.round(s.musicVol * 100)}" data-set="musicVol"></label>
          <div class="set-row">${tog('sound', !s.muted, 'Sound')}${tog('music', s.music, 'Music')}${tog('particles', s.particles, 'Particles')}${tog('calm', s.calm, 'Reduce flashing')}${tog('shake', s.shake, 'Screen shake')}${tog('numbers', s.numbers, 'Damage numbers')}${tog('blood', s.blood, 'Blood')}${tog('cinematics', s.cinematics, 'Zone intros')}
          <button class="btn toggle" data-act="notation">Numbers: ${s.notation === 'short' ? '1.23M' : '1.23e6'}</button>
          <button class="btn toggle" data-act="graphics">Graphics: ${GRAPHICS_NAME[s.graphics]}</button></div>
          <h3>Cursor <span class="muted">${CURSORS.filter((c) => this.cursorOpen(c.id)).length} / ${CURSORS.length}</span></h3>
          <div class="cursors">${CURSORS.map((c) => {
            const open = this.cursorOpen(c.id);
            const spr = c.sprite;
            return `<button class="cur ${open ? '' : 'locked'} ${s.cursor === c.id ? 'on' : ''}" data-cursor="${c.id}" data-tip="cur:${c.id}">${spriteFit(spr, 36)}${open ? '' : `<span class="cur-lock">${G.lock()}</span>`}</button>`;
          }).join('')}</div>
          <h3>Save</h3>
          <p class="muted">Copy your save code to move it to another browser.</p>
          <textarea spellcheck="false" placeholder="Paste a save code here to load it"></textarea>
          <div class="set-row"><button class="btn" data-act="export">Copy save code</button><button class="btn" data-act="import">Load save code</button><button class="btn danger" data-act="reset">Wipe save</button></div>
          <div class="set-row">${DEMO ? '' : `<a class="btn" href="${WIKI_URL}" target="_blank" rel="noopener">Wiki</a>`}${document.body.classList.contains('at-menu') ? '' : '<button class="btn" data-act="mainMenu">Main menu</button>'}</div>
        </div>`;
    }
    if (soft && (html === this.modalKey || performance.now() < this.modalHold)) return;
    this.modalKey = html;
    this.el.modal.className = `modal pnl m-${name}`;
    // A tick's refresh changes only what moved; a click (or a new panel) builds it fresh.
    if (soft) morph(this.el.modal, html);
    else this.el.modal.innerHTML = html;
  }

  /** The Ascend strip atop the window: where this run's souls come from (companion levels, with the way to the next
   *  soul, and champion bosses), and either the way up's progress or the Ascend button. */
  private ascendHtml(): string {
    const g = this.game;
    const locked = `<div class="as-go locked"><small>The way up opens at floor ${fmt(g.ascendFloor())}</small>
        <span class="as-floor">Floor ${fmt(g.s.maxFloor)} / ${g.ascendFloor()}</span>
        <div class="bar"><i style="width:${Math.min(100, (g.s.maxFloor / g.ascendFloor()) * 100)}%"></i></div></div>`;
    // The demo shows there's a way up, and nothing past it.
    if (DEMO) return `<div class="ascend">${locked}</div>`;
    const help = '<span class="soul-help" data-tip="souls:" tabindex="0" aria-label="How souls work">?</span>';
    const active = g.s.curse ? CURSE_BY_ID.get(g.s.curse) : undefined;
    const activeLine = active
      ? `<p class="curse-now"><b>This descent is cursed: ${esc(active.name)}.</b> ${esc(active.rule)}${g.curseTier(active.id) < CURSE_FLOORS.length ? ` Reach floor ${fmt(CURSE_FLOORS[g.curseTier(active.id)])} for tier ${g.curseTier(active.id) + 1}.` : ' Every tier broken.'}</p>`
      : '';
    const levels = g.runLevels();
    const per = TUNE.levelsPerSoul;
    const mult = g.soulGainMult();
    const rows = `<div class="as-rows">
        <div class="as-h">Souls this run ${help}</div>
        <div class="as-row"><span>Companion levels <em>${fmt(levels)}</em></span><b>${G.soul()} ${fmt(Math.floor(levels / per))}</b>
          <div class="as-bar"><i style="width:${((levels % per) / per) * 100}%"></i></div><small>${fmt(levels % per)} / ${fmt(per)}</small></div>
        <div class="as-row"><span>Champion bosses</span><b>${G.soul()} ${fmt(g.s.bossSouls)}</b></div>
        ${mult > 1 ? `<div class="as-row"><span>Soul bonus</span><b>×${+mult.toFixed(2)}</b></div>` : ''}
      </div>`;
    if (!g.descendOpen()) {
      return `${activeLine}<div class="ascend">${rows}${locked}</div>`;
    }
    const pending = g.pendingSouls();
    const curse = this.curseChoice ? CURSE_BY_ID.get(this.curseChoice) : undefined;
    const go = `<button class="btn primary${g.s.descents ? '' : ' big'}" data-act="descend" ${g.canDescend() ? '' : 'disabled'}>Ascend${curse ? ` cursed: ${esc(curse.name)}` : ''}</button>`;
    const total = g.canDescend() && pending < 1
      ? '<small>The curse can be lifted: ascend to leave this descent. No new souls yet.</small>'
      : `<span class="as-total">${G.soul(2.4)} ${fmt(pending)}</span>`;
    return `${activeLine}<div class="ascend">${rows}<div class="as-go">${total}${go}</div></div>${this.cursesHtml()}`;
  }

  /** The soul shop. Before your first ascent: three Legends asleep as silhouettes (spirits once the way up opens). After:
   *  the offer as spirits, the picked one in full color with its details, a reroll, your Legends as cards, and a respec. */
  private legendsHtml(): string {
    if (DEMO) return '';
    const g = this.game;
    const offer = g.legendOffer();
    if (!g.legendsOpen()) {
      const stirring = g.canDescend();
      // No offer is rolled until Legends open: show the one that will be.
      const peds = g.previewOffer().map((id) => {
        const d = LEGEND_BY_ID.get(id)!;
        const fig = stirring ? charFit(d.sprite, 84, 92) : silhouette(d.sprite, 84, '#0b0710');
        return `<div class="pedestal shade${stirring ? ' stirring' : ''}"><span class="spirit">${WISPS}</span><span class="ped-fig">${fig}</span><span class="ped-stone"></span></div>`;
      }).join('');
      return `<div class="legend-await"><div class="pedestals">${peds}</div><p>Spirits await after you ascend</p></div>`;
    }
    const free = g.soulsFree();
    const price = g.summonPrice();
    if (!offer.includes(this.legendPick as LegendId)) this.legendPick = offer[0] ?? null;
    const pick = this.legendPick ? LEGEND_BY_ID.get(this.legendPick)! : null;
    const pedestals = offer.map((id) => {
      const d = LEGEND_BY_ID.get(id)!;
      return `<button class="pedestal ${id === this.legendPick ? 'on' : 'ghost'}" data-pick="${id}"><span class="spirit">${WISPS}</span><span class="ped-fig">${charFit(d.sprite, 72, 96)}</span><span class="ped-stone"></span><b>${esc(d.name)}</b></button>`;
    }).join('');
    const summon = pick
      ? `<p class="legend-warn">Summon a Spirit for <b>${G.soul(2)} ${fmt(price)} soul${price === 1 ? '' : 's'}</b>. Every soul you spend gives up ${soulPct(1)} damage.</p>
        <div class="pedestals">${pedestals}</div>
        ${LEGENDS.length - g.legendsOwned() > OFFER_SIZE ? `<div class="legend-reroll"><button class="btn" data-act="reroll" ${free >= g.rerollPrice() ? '' : 'disabled'}>Reroll all three · ${G.soul(1.5)} ${fmt(g.rerollPrice())}</button></div>` : ''}
        <div class="legend-panel">
          <div class="tt-h"><b>${esc(pick.name)}</b><span class="tt-own">${KIND_NAME[pick.kind]}</span></div>
          ${legendDetail(pick, 0)}
          <div class="set-row"><button class="btn primary" data-act="summon" ${free >= price ? '' : 'disabled'}>Summon ${esc(pick.name)}</button></div>
        </div>`
      : '<p class="muted">Every Spirit has joined you.</p>';
    const owned = LEGENDS.filter((d) => g.legendLv(d.id) > 0);
    const cards = owned.map((d) => this.legendCard(d)).join('');
    const respec = `<button class="btn small lc-respec" data-act="respec" data-tip="respec">Respec · ${G.soul(1.2)} +${fmt(Math.floor(g.s.legendSpent * RESPEC_REFUND))}</button>`;
    return `${summon}
      ${owned.length ? `<div class="lc-head"><h3>Your Spirits</h3><small>${owned.length}</small>${respec}</div><div class="lcards">${cards}</div>` : ''}`;
  }

  /** Until then, ticks leave the open panel alone, so an animation in it plays out. */
  private modalHold = 0;

  /** A reroll: the three spirits burst away, then the new ones rise off their stones, one after another. */
  private rerollFx() {
    const peds = this.el.modal.querySelector('.pedestals');
    if (!peds || matchMedia('(prefers-reduced-motion: reduce)').matches) return this.renderModal();
    this.hooks.sound('descend', { vol: 0.35, rate: 1.4 });
    // (The last reroll's arrive outranks the vanish: clear it, or every reroll after the first skips the warp.)
    peds.classList.remove('arrive');
    peds.classList.add('vanish');
    this.modalHold = performance.now() + 1400;
    setTimeout(() => {
      this.renderModal();
      this.el.modal.querySelector('.pedestals')?.classList.add('arrive');
      this.hooks.sound('card', { vol: 0.45 });
    }, 380);
  }

  /** One of your Spirits as a card: its figure, level, what it gives now and next, and its Level up button. */
  private legendCard(d: LegendDef) {
    if (DEMO) return '';
    const g = this.game;
    const lv = g.legendLv(d.id);
    const cost = g.legendLevelCost(d.id);
    const next = g.legendMaxed(d.id)
      ? `<span class="lc-max" data-tip="legend:${d.id}">Max level</span>`
      : `<span>Next: ${esc(d.value(lv + 1))}</span><span class="lc-up" data-tip="legend:${d.id}" data-legend="${d.id}"><button class="btn primary" ${g.soulsFree() >= cost ? '' : 'disabled'}>Level up · ${G.soul(1.5)} ${fmt(cost)}</button></span>`;
    return `<div class="lcard" data-card="${d.id}">
      <div class="lc-fig"><span class="spirit">${WISPS}</span><span class="ped-fig">${charFit(d.sprite, 88, 96)}</span><span class="ped-stone"></span></div>
      <div class="lc-nm"><b>${esc(d.name)}</b><span class="lc-lv">Level<span>${lv}</span></span></div>
      <div class="lc-val">${esc(d.value(lv))}</div>
      <div class="lc-what">${skillText(d.what)}</div>
      <div class="lc-next">${next}</div>
    </div>`;
  }

  /** The Spirit whose own panel is open (walked up to in the Keep). */
  private legendFocus: LegendId | null = null;
  /** The Bound whose own panel is open (walked up to in the Keep). */
  private boundFocus: BoundId | null = null;

  /** A Spirit just summoned or levelled: jump its card into view, then let it flare. */
  private flareLegend(id: string) {
    const card = this.el.modal.querySelector<HTMLElement>(`[data-card="${id}"]`);
    if (!card) return;
    const box = card.getBoundingClientRect();
    const view = this.el.modal.getBoundingClientRect();
    // Only the panel scrolls (scrollIntoView would also shift the game's own clipped layers sideways). Not smoothly:
    // a flare during a smooth scroll can leave the card painted where it was.
    if (box.top < view.top) this.el.modal.scrollTop += box.top - view.top - 12;
    else if (box.bottom > view.bottom) this.el.modal.scrollTop += box.bottom - view.bottom + 12;
    this.flare(card);
  }

  private flare(card: HTMLElement) {
    card.classList.remove('flaring');
    void card.offsetWidth;
    card.classList.add('flaring');
    const sparks = document.createElement('div');
    sparks.className = 'sparks';
    for (let k = 0; k < 14; k++) {
      const spark = document.createElement('i');
      const angle = (k / 14) * Math.PI * 2;
      spark.style.setProperty('--dx', `${Math.cos(angle) * (40 + Math.random() * 30)}px`);
      spark.style.setProperty('--dy', `${Math.sin(angle) * (40 + Math.random() * 30)}px`);
      sparks.appendChild(spark);
    }
    card.appendChild(sparks);
    setTimeout(() => sparks.remove(), 800);
  }

  /** Heartmarks: who has them, and moving them around for souls. */
  private marksHtml(): string {
    if (DEMO) return '';
    const g = this.game;
    const free = g.soulsFree();
    const total = g.marksTotal();
    const rows = COMPS.map((c, i) => {
      const n = g.s.marks[i];
      if (!n && !g.s.owned[i]) return '';
      const others = total - n > 0;
      return `<tr><th><span class="bd-comp">${charFit(c.sprite, 22)}${esc(c.name)}</span></th><td>${n ? `${G.heart(1.5)} ${n}` : ''}</td><td>${n ? `+${n * MARK_POWER * 100}%` : ''}</td>
        <td>${n ? `<button class="btn small" data-mark-away="${i}" ${free >= MARK_REROLL ? '' : 'disabled'}>Send one away · ${G.soul(1.2)} ${MARK_REROLL}</button>` : ''}</td>
        <td>${others ? `<button class="btn small" data-mark-here="${i}" ${free >= MARK_MOVE ? '' : 'disabled'}>Bring one here · ${G.soul(1.2)} ${MARK_MOVE}</button>` : ''}</td></tr>`;
    }).join('');
    return `<p class="muted bd-help">The first time you beat each 10th floor past ${100}, a random companion gets a Heartmark: +${MARK_POWER * 100}% damage each, until you awaken. Send one to someone at random, or bring one from someone else to the companion you choose.</p>
      <section class="bd wide bd-marks"><table><thead><tr><th>Companion</th><td>Marks</td><td>Damage</td><td></td><td></td></tr></thead>${rows}</table></section>`;
  }

  /** The curse chosen for the next ascent (null: an ordinary descent). */
  private curseChoice: string | null = null;
  private respecArmed = false;
  /** The Legend picked on the summon pedestals. */
  private legendPick: LegendId | null = null;

  /** Cursed descents on offer: pick one before ascending. Each shows its rule, its tiers so far and the next reward. */
  private cursesHtml(): string {
    if (DEMO) return '';
    const g = this.game;
    const open = g.cursesOpen();
    if (!CURSES_ON) return '';
    if (!open.length) {
      const left = CURSES_FROM - g.s.descents;
      return g.s.descents ? `<h3>Cursed descents <span class="muted">open after ${CURSES_FROM} ascents (${left} to go)</span></h3>` : '';
    }
    if (this.curseChoice && !open.some((c) => c.id === this.curseChoice)) this.curseChoice = null;
    const cards = open.map((c) => {
      const tier = g.curseTier(c.id);
      const done = tier >= CURSE_FLOORS.length;
      const pips = CURSE_FLOORS.map((_, k) => (k < tier ? '★' : '☆')).join('');
      return `<button class="curse${this.curseChoice === c.id ? ' on' : ''}${done ? ' done' : ''}" data-curse="${c.id}">
        <b>${esc(c.name)} <span class="stars">${pips}</span></b>
        <small>${esc(c.rule)}</small>
        <em>${done ? `Beaten: ${esc(c.reward(tier))}` : `Floor ${fmt(CURSE_FLOORS[tier])}: ${esc(c.reward(tier + 1))}`}</em>
      </button>`;
    }).join('');
    return `<h3>Cursed descents <span class="muted">pick one, then ascend</span></h3><div class="curse-grid">${cards}</div>`;
  }

  private troTabs(on: 'trophies' | 'cards') {
    const tab = (id: string, label: string) => `<button class="tab ${on === id ? 'on' : ''}" data-open="${id}">${label}</button>`;
    return `<nav class="tabs">${tab('trophies', `${G.trophy()} Trophies`)}${tab('cards', `Cards${this.newCards ? ` <em class="tab-new">+${this.newCards}</em>` : ''}`)}</nav>`;
  }

  /** Trading with Dan or Victor: the spares you've put down, the card you got last, and what he just said. */
  private trade: { side: string[]; got: { id: string; gold: boolean; lap: number; first: boolean } | null; line: string; reveal?: boolean } = { side: [], got: null, line: '' };
  /** A trade is playing out (your cards flying over, his card shaking and turning over). */
  private tradeBusy = false;

  private openTrade(who: Trader) {
    if (DEMO) return;
    this.trade = { side: [], got: null, line: pickLine(TRADER_LINES[who][this.tradeHand().length ? 'hello' : 'short']) };
    this.openModal(who);
  }

  private tradeNeed = (who: Trader) => (who === 'dan' ? DAN_GIVES : VICTOR_GIVES);

  /** Your plain cards, less the ones already put down, by set and then by how many. */
  private tradeHand() {
    const g = this.game;
    return g.tradeable()
      .map((c) => ({ c, n: g.plainCards(c.id) - this.trade.side.filter((id) => id === c.id).length }))
      .filter((h) => h.n > 0)
      .sort((a, b) => a.c.zone - b.c.zone || b.n - a.n);
  }

  /** What his card could be, and the chance it's one you don't have: Dan's from the sets you put down (each as likely as
   *  its share of them), Victor's from every gold card. */
  private tradeOdds(who: Trader) {
    const g = this.game;
    if (who === 'victor') {
      const pool = g.tradeable().filter((c) => c.gold);
      return { split: [] as { zone: number; share: number }[], fresh: pool.length ? pool.filter((c) => !g.hasGoldCard(c.id)).length / pool.length : 0 };
    }
    const side = this.trade.side;
    const count = new Map<number, number>();
    for (const id of side) count.set(CARD_BY_ID.get(id)!.zone, (count.get(CARD_BY_ID.get(id)!.zone) ?? 0) + 1);
    const split = [...count].map(([zone, n]) => ({ zone, share: n / side.length })).sort((a, b) => b.share - a.share);
    const fresh = split.reduce((sum, { zone, share }) => {
      const pool = g.tradeable(zone);
      return sum + (pool.length ? (share * pool.filter((c) => !g.cardCount(c.id)).length) / pool.length : 0);
    }, 0);
    return { split, fresh };
  }

  private tradeHtml(who: Trader): string {
    if (DEMO) return '';
    const need = this.tradeNeed(who);
    const name = who === 'dan' ? 'Dan' : 'Victor';
    const { side, got, line } = this.trade;
    const face = (id: string, attrs: string, extra = '', last = false) => {
      const c = CARD_BY_ID.get(id)!;
      return `<button class="tr-card${last ? ' last' : ''}" ${attrs}>${cardFace(c, 'got', false, 40, c.laps[0])}${extra}</button>`;
    };
    const g = this.game;
    // A put-down card that's your last copy keeps its tag on the table.
    const isLast = (id: string, k: number) => side.slice(0, k + 1).filter((x) => x === id).length === g.plainCards(id);
    const slots = Array.from({ length: need }, (_, k) => (side[k] ? face(side[k], `data-take="${side[k]}"`, isLast(side[k], k) ? '<i class="tr-last">Last</i>' : '', isLast(side[k], k)) : '<span class="tr-slot"></span>')).join('');
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const odds = this.tradeOdds(who);
    const setName = (zone: number) => ZONES[zone].name.replace(/^The /, '');
    const his = got
      ? `<div class="tr-got${this.trade.reveal ? ' reveal' : ''}${got.gold ? ' gold' : ''}" style="--rc:${got.gold ? CARD_FRAME.gold : CARD_FRAME[CARD_BY_ID.get(got.id)!.kind]}">
          ${this.trade.reveal ? '<i class="tr-rays"></i>' : ''}${got.gold ? GOLD_DAZZLE : ''}
          <div class="tr-flip"><div class="tr-fback">${G.heart(3)}</div><div class="tr-ffront">${cardFace(CARD_BY_ID.get(got.id)!, 'got', got.gold, 56, got.lap)}</div></div>
          ${got.first ? '<em class="tr-new">New</em>' : ''}</div>`
      : `<div class="tr-back">${G.heart(3)}</div>`;
    const from = got ? '' : who === 'victor'
      ? '<p class="tr-from">Any gold card</p>'
      : odds.split.length ? `<ul class="tr-from">${odds.split.map(({ zone, share }) => `<li><b>${pct(share)}</b> ${esc(setName(zone))}</li>`).join('')}</ul>` : '<p class="tr-from">From the sets you give</p>';
    const fresh = got || (who === 'dan' && !odds.split.length) ? '' : `<p class="tr-odds">${odds.fresh ? `${pct(odds.fresh)} chance it's new` : 'You have them all'}</p>`;
    const hand = this.tradeHand();
    const full = side.length >= need;
    // Your last copy of a card can go too, marked so it's never given away by accident.
    const cards = hand.length
      ? hand.map((h) => face(h.c.id, `data-put="${h.c.id}"${full ? ' disabled' : ''}`, h.n === 1 ? '<i class="tr-last">Last</i>' : `<i class="tr-n">×${h.n}</i>`, h.n === 1)).join('')
      : '<p class="muted">No cards.</p>';
    const buttons = got
      ? '<button class="btn" data-act="tradeAgain">Trade again</button><button class="btn primary" data-act="close">Done</button>'
      : `<button class="btn" data-act="${side.length ? 'tradeClear' : 'tradeAuto'}">${side.length ? 'Clear' : 'Auto-fill'}</button><button class="btn primary" data-act="tradeGo" ${full ? '' : 'disabled'}>Trade</button>`;
    return `<p class="tr-say">${esc(line)}</p>
      <div class="tr-table">
        <div class="tr-side"><h3>Yours <span class="muted">${side.length} / ${need}</span></h3><div class="tr-slots">${slots}</div></div>
        <span class="tr-swap">⇄</span>
        <div class="tr-side his"><h3>${name}'s</h3>${his}${from}${fresh}</div>
      </div>
      <h3>Your cards</h3>
      <div class="tr-hand">${cards}</div>
      <div class="set-row tr-foot">${buttons}</div>`;
  }

  /** Put a spare down, or the most common ones until the trade is full. */
  private tradePut(who: Trader, id: string) {
    if (this.trade.side.length >= this.tradeNeed(who)) return;
    this.trade.got = null;
    this.trade.side.push(id);
    this.hooks.sound('card', { vol: 0.35, rate: 1.1 + this.trade.side.length * 0.03 });
  }

  /** The trade as a little scene: your cards fly over into his face-down card, it shakes and glows, then turns over in
   *  a burst (a gold one glittering, a new one stamped New). */
  private tradeGo(who: Trader) {
    const g = this.game;
    const got = who === 'dan' ? g.tradeWithDan(this.trade.side) : g.tradeWithVictor(this.trade.side);
    if (!got) return;
    this.hooks.save();
    const modal = this.el.modal;
    const back = modal.querySelector<HTMLElement>('.tr-back');
    const cards = [...modal.querySelectorAll<HTMLElement>('.tr-slots .tr-card')];
    const reveal = () => {
      this.trade = { side: [], got, line: pickLine(TRADER_LINES[who][got.first ? 'new' : 'dupe']), reveal: true };
      this.tradeBusy = false;
      this.renderModal();
      this.hooks.sound(got.gold ? 'cardgold' : 'card', { vol: 0.9 });
      if (got.first) setTimeout(() => this.hooks.sound('jackpot', { vol: 0.45 }), 450);
      const turned = modal.querySelector<HTMLElement>('.tr-got');
      if (turned) setTimeout(() => this.flare(turned), 300);
      // (Only this once: later redraws show it face up and still.)
      setTimeout(() => (this.trade.reveal = false), 1500);
    };
    if (!back || !cards.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return reveal();
    this.tradeBusy = true;
    modal.querySelector('.tr-table')?.classList.add('dealing');
    const to = back.getBoundingClientRect();
    cards.forEach((card, k) => {
      const from = card.getBoundingClientRect();
      card.style.setProperty('--dx', `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
      card.style.setProperty('--dy', `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);
      card.style.setProperty('--dl', `${k * 0.07}s`);
      card.classList.add('fly');
      setTimeout(() => this.hooks.sound('card', { vol: 0.25, rate: 1.3 + k * 0.05 }), k * 70 + 250);
    });
    const flown = cards.length * 70 + 500;
    setTimeout(() => {
      back.classList.add('shake');
      if (got.gold) back.classList.add('gold');
      this.hooks.sound('chest', { vol: 0.45 });
    }, flown);
    setTimeout(reveal, flown + 750);
  }

  /** Every monster's card, zone by zone: a dark silhouette until the card turns up. A zone's row
   *  (and the monsters that only come on later laps) appear once you've been that deep, the goblins once you've met one. */
  private cardsHtml(): string {
    const g = this.game;
    const goblinSeen = (id: string) => (id === 'rainbow-goblin' ? g.s.rainbowSeen : g.s.raids + g.s.missed > 0);
    const seen = (c: (typeof CARDS)[number]) => g.cardCount(c.id) > 0 || (c.kind === 'goblin' ? goblinSeen(c.id) : c.floor <= g.s.bestFloor);
    // One collection per lap you've reached, each in ordinary and gold copies.
    const lapsReached = Math.min(lapOf(g.s.bestFloor), CORRUPTION.length - 1);
    const view = Math.min(this.cardLap, lapsReached);
    const gold = this.cardGold;
    const inView = (c: (typeof CARDS)[number], lap = view) => seen(c) && (c.laps.includes(lap) || owned(c, lap)) && (!gold || c.gold);
    const owned = (c: (typeof CARDS)[number], lap = view) => ((gold ? g.s.cards[c.id]?.gold : g.s.cards[c.id]?.n)?.[lap] ?? 0) > 0;
    // Where you are: a marker on your zone's row, and a dot on the cards that can drop on this floor.
    const floor = g.s.floor;
    const lap = lapOf(floor);
    const hereLap = Math.min(lap, CORRUPTION.length - 1) === view;
    const hereZone = zoneOf(floor) % ZONES.length;
    const hereCards = new Set(hereLap ? (isBossFloor(floor) ? [bossFor(floor)] : bandFor(floor)).map((d) => cardId(d.name)) : []);
    const face = (c: (typeof CARDS)[number]) => {
      const got = owned(c);
      return `<span class="mc-cell${hereCards.has(c.id) ? ' here' : ''}" data-tip="card:${c.id}">${cardFace(c, got ? 'got' : 'locked', gold && got, 44, view)}</span>`;
    };
    const section = (title: string, all: typeof CARDS, here = false, zone = -1) => {
      const cards = all.filter((c) => inView(c));
      if (!cards.length) return '';
      const got = cards.filter((c) => owned(c)).length;
      const marker = here && hereLap ? ` <em class="here-mark">▸ Floor ${fmt(floor)}</em>` : '';
      // A finished set says what it's worth instead of its count.
      const done = zone >= 0 && g.setDone(zone, view, gold);
      const count = done ? `<span class="set-done">Set +${Math.round((gold ? GOLD_SET_BONUS : SET_BONUS) * 100)}% damage</span>` : `<span class="muted">${got} / ${cards.length}</span>`;
      return `<h3${here && hereLap ? ' class="here-zone"' : ''}><span>${esc(title)}${marker}</span> ${count}</h3><div class="card-grid">${cards.map(face).join('')}</div>`;
    };
    const tally = (l: number) => {
      const cards = CARDS.filter((c) => inView(c, l));
      return `${cards.filter((c) => owned(c, l)).length}/${cards.length}`;
    };
    const lapTab = (l: number) => {
      const c = corruptionOf(l);
      const color = `#${(l ? c.tint : 0xc9b8a0).toString(16).padStart(6, '0')}`;
      const here = l === Math.min(lap, CORRUPTION.length - 1);
      return `<button class="sub${l === view ? ' on' : ''}${here ? ' here' : ''}" data-card-lap="${l}">${here ? '<em class="sub-here"></em>' : ''}<span class="sub-dot" style="--lc:${color}"></span>${l ? c.name : 'Plain'} <i>${tally(l)}</i></button>`;
    };
    const bar = `<nav class="subbar">${Array.from({ length: lapsReached + 1 }, (_, l) => lapTab(l)).join('')}
      <span class="sub-toggle"><button class="sub ${gold ? '' : 'on'}" data-card-gold="0">Normal</button><button class="sub gold-tab ${gold ? 'on' : ''}" data-card-gold="1">★ Gold</button></span></nav>`;
    const more = CARDS.some((c) => !seen(c)) ? '<p class="cards-more">More cards wait deeper down.</p>' : '';
    return bar + ZONES.map((z, i) => section(z.name, CARDS.filter((c) => c.zone === i), i === hereZone, i)).join('')
      + section('Treasure goblins', CARDS.filter((c) => c.zone < 0)) + more;
  }

  private statTabs(on: string) {
    const tab = (id: string, label: string) => `<button class="tab ${on === id ? 'on' : ''}" data-open="${id}">${label}</button>`;
    return `<nav class="tabs">${tab('stats', 'Bonuses')}${tab('party', 'Companions')}${tab('records', 'Records')}${DEMO ? '' : tab('ascents', 'Ascents')}</nav>`;
  }

  /** Every ascent so far: its run time, the deepest floor reached and the souls it paid. */
  private ascentsHtml(): string {
    if (DEMO) return '';
    const list = this.game.s.ascents;
    const clock = (t: number) => [Math.floor(t / 3600), Math.floor((t % 3600) / 60), Math.floor(t % 60)].map((n, i) => (i ? String(n).padStart(2, '0') : String(n))).join(':');
    let ascent = 0;
    const rows = list.map((a) => a.awakening
      ? `<tr class="asc-awaken"><th>Awakening ${a.awakening}</th><td>${clock(a.time)}</td><td>${fmt(a.floor)}</td><td>${boundGlyph(1.2)} ${fmt(a.bound ?? 0)}</td></tr>`
      : `<tr><th>${++ascent}</th><td>${clock(a.time)}</td><td>${fmt(a.floor)}</td><td>${G.soul(1.2)} ${fmt(a.souls)}</td></tr>`).reverse().join('');
    return `<section class="bd wide bd-ascents"><table><thead><tr><th>Ascent</th><td>Time</td><td>Deepest floor</td><td>Souls</td></tr></thead>${rows || '<tr><th>No ascents yet.</th></tr>'}</table></section>`;
  }

  /** Where every number comes from: each multiplier on its own line, then the total. */
  private bonusHtml(): string {
    const g = this.game;
    const b = g.breakdown();
    const p = b.parts;
    const x = (v: number | Decimal) => (new Decimal(v).gte(1000) ? `×${fmt(v)}` : `×${Math.round(new Decimal(v).toNumber() * 100) / 100}`);
    const pc = (v: number) => `${Math.round(v * 1000) / 10}%`;
    // A row is a label and a value; how it's made up shows on hover. Sources doing nothing yet (×1, or locked) gather
    // in one faint line under their panel.
    type Row = { label: string; value: string; note?: string; off?: boolean };
    const row = (label: string, value: string, note = '', off = false): Row => ({ label, value, note, off });
    const mul = (label: string, v: number | Decimal, note: string, how = ''): Row => {
      const one = new Decimal(v).eq(1);
      return row(label, x(v), one && how ? how : note, one);
    };
    const panel = (title: string, big: string, unit: string, rows: (Row | null)[], bigNote = '') => {
      const live = rows.filter((r): r is Row => !!r && !r.off);
      const idle = rows.filter((r): r is Row => !!r && !!r.off);
      const tr = (r: Row) => `<tr${r.note ? ` data-tip="note:${esc(r.note)}"` : ''}><th>${r.label}</th><td>${r.value}</td></tr>`;
      return `<section class="st"><header><h3>${title}</h3><b${bigNote ? ` data-tip="note:${esc(bigNote)}"` : ''}>${big}${unit ? `<small>${unit}</small>` : ''}</b></header>
        <table>${live.map(tr).join('')}</table>
        ${idle.length ? `<p class="st-off">Not active: ${idle.map((r) => `<span${r.note ? ` data-tip="note:${esc(r.note)}"` : ''}>${r.label}</span>`).join(' · ')}</p>` : ''}</section>`;
    };
    const relicName = (id: string) => RELIC_BY_ID.get(id)!.name;
    const relicMul = (label: string, v: number | Decimal, note: string, how = '') => (RELICS_ON ? mul(label, v, note, how) : null);
    const baseSum = b.baseComp.reduce((a, v) => a + v, 0);
    const buffNames = (k: 'dps' | 'click' | 'gold') => g.s.buffs.filter((u) => u[k] > 1).map((u) => `${u.name} ×${u[k]}`).join(', ');
    const allRows = [
      mul('Trophies', p.trophies, `${g.s.trophies.length} trophies`),
      mul('Card sets', p.cards, `${g.setsDone(false)} sets · ${g.setsDone(true)} gold sets`, 'Every card of a zone in one color'),
      ...(DEMO ? [] : [mul('Souls', p.souls, `${fmt(g.soulsFree())} kept, ${soulPct(1)} each${g.legendLv('hungry') ? ` + the Hungry Dark ${g.legendLv('hungry')}` : ''}`, 'Ascend to earn souls')]),
      relicMul(relicName('shard'), p.shard, 'Legendary relic', 'A legendary relic'),
      ...(!DEMO && g.s.awakens ? [mul('Ogre Chieftain', p.ogre, `level ${g.boundLv('ogre')}`, 'Bound in the Heart')] : []),
    ];

    const dps = panel('Party damage', fmt(g.dps()), '/sec', [
      row('Companions', fmt(baseSum), DEMO ? 'levels × traits' : 'levels × traits × Heartmarks'),
      ...allRows,
      relicMul(relicName('banner'), p.banner, 'Relic', 'A relic'),
      mul('Party traits', p.party, 'companion traits that lift everyone', 'Some companion traits lift everyone'),
      mul('Buffs', b.buffDps, buffNames('dps'), 'Rampage, Bloodlust'),
    ]);

    const click = panel('Click damage', fmt(g.clickDamage()), '/click', [
      row('Base', '1'),
      relicMul(relicName('whet'), p.whet, 'Relic', 'A relic'),
      row('All-damage bonuses', x(b.all), 'trophies, souls and fury'),
      row('Share of party damage', `+${fmt(g.baseDps().times(p.clickDps))}`, `${pc(p.clickDps)} of party damage: 5% base${p.clickDpsUpg ? ` + ${pc(p.clickDpsUpg)} companion traits` : ''}${p.oath ? ` + ${pc(p.oath)} ${relicName('oath')}` : ''}`),
      ...(DEMO ? [] : [mul('The Fist', 1 + 0.1 * g.legendLv('fist'), `level ${g.legendLv('fist')}`, 'A Spirit')]),
      mul('Buffs', b.buffClick, buffNames('click'), 'Frenzy'),
      row('During Rampage', x(g.feverMult())),
    ]);

    const critNote = g.abilityUnlocked('crit') ? `${pc(p.critBase)} base${p.critUpg ? ` + ${pc(p.critUpg)} companions` : ''}${p.critRelic ? ` + ${pc(p.critRelic)} ${relicName('hawk')}` : ''}` : `Unlocked by the ${COMPS[ABILITY_BY_ID.get('crit')!.comp].name}`;
    const crit = panel('Critical hits', g.abilityUnlocked('crit') ? pc(g.critChance()) : '—', g.abilityUnlocked('crit') ? 'chance' : '', [
      row('Damage', x(g.critMult()), `×${p.critMultBase} base${p.critMultUpg ? ` + ${p.critMultUpg} companions` : ''}${p.critMultRelic > 1 ? ` × ${p.critMultRelic} ${relicName('razor')}` : ''}`),
      row('Cleave', g.cleave() ? pc(g.cleave()) : '—', g.cleave() ? `10% base${p.cleaveRelic ? ` + ${pc(p.cleaveRelic)} ${relicName('cleaver')}` : ''}${p.cleaveUpg > 1 ? `, ${x(p.cleaveUpg)} from upgrades` : ''}` : g.abilityUnlocked('cleave') ? 'While the Cleave skill runs' : `Unlocked by the ${COMPS[ABILITY_BY_ID.get('cleave')!.comp].name}`, !g.cleave()),
    ], critNote);

    const goldT = panel('Gold', x(g.goldMult()), '', [
      mul('Companion traits', p.goldUpg, 'gold traits', 'Some companion traits add gold'),
      ...(DEMO ? [] : [mul('The Hoard', 1 + 0.05 * g.legendLv('hoard'), `level ${g.legendLv('hoard')}`, 'A Spirit')]),
      relicMul(relicName('purse'), p.goldRelic, 'Relic', 'A relic'),
      mul('Buffs', b.buffGold, buffNames('gold'), 'Gold Rush'),
    ]);

    const baseTime = 30;
    const glass = Math.min(30, 3 * g.relic('time')) + Math.round(g.bossTimeBonus());
    const boss = panel('Bosses', `${baseTime + glass}s`, 'timer', [
      mul('Damage to bosses', p.boss, 'companion traits', 'Some companion traits hit bosses harder'),
      relicMul(`Damage to bosses (${relicName('slayer')})`, 1 + g.relic('boss'), 'Relic', 'A relic'),
      row('Armored blocks', pc(g.armor()), `of companion damage${g.relic('pierce') ? ` (${relicName('pick')} helps)` : ''}`),
      row('Regenerating heals', `${pc(g.regen())}/s`, g.relic('rot') ? `${relicName('rot')} helps` : 'of its health'),
      row('Modifier strength', pc(g.modBite()), 'how hard Armored and Regenerating bite'),
    ]);

    const souls = DEMO ? '' : panel('Souls', fmt(g.s.souls), '', [
      row('Unspent', fmt(g.soulsFree())),
      row('An ascent now pays', fmt(g.pendingSouls()), `${fmt(Math.floor(g.runLevels() / TUNE.levelsPerSoul))} from levels, ${fmt(g.s.bossSouls)} from champion bosses`),
      ...(RELICS_ON ? [mul('Soul gain', g.soulGainMult(), g.relic('souls') ? relicName('cage') : '', relicName('cage'))] : []),
      ...(!DEMO && g.s.awakens ? [mul('Champion souls', g.champSoulMult(g.s.maxFloor), `on floor ${fmt(g.s.maxFloor)}`), row('Bound souls', fmt(g.s.boundEarned), `${g.s.awakens} awakening${g.s.awakens === 1 ? '' : 's'}`)] : []),
    ]);
    return `<div class="st-grid">${dps}${click}${crit}${goldT}${boss}${souls}</div>`;
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
      return `<tr><th><span class="bd-comp">${charFit(c.sprite, 22)}${esc(c.name)}</span></th><td>${lv}</td><td>${fmt(c.dps)}</td><td>${x(levelMult(lv))}</td><td>${x(p.tier[i])}</td>${DEMO ? '' : `<td>${g.s.marks[i] ? `${G.heart(1.2)} ${g.s.marks[i]}` : ''}</td>`}<td>${fmt(g.compDps(i))}</td><td>${total.gt(0) ? g.compDps(i).div(total).times(100).toNumber().toFixed(1) : 0}%</td></tr>`;
    }).join('');
    return `<p class="muted bd-help">Each companion: level × base damage × milestones × traits${DEMO ? '' : ' × Heartmarks'}, then every all-damage bonus (${x(b.all.times(p.banner * p.party))} right now) on top.</p>
      <section class="bd wide"><table><thead><tr><th>Companion</th><td>Level</td><td>Base</td><td>Milestones</td><td>Traits</td>${DEMO ? '' : '<td>Marks</td>'}<td>Damage/sec</td><td>Share</td></tr></thead>${rows || '<tr><th>Nobody hired yet.</th></tr>'}</table></section>`;
  }

  private recordsHtml(): string {
    const g = this.game;
    const s = g.s;
    const rows: [string, string, boolean?][] = [
      ['Floor', `${fmt(s.floor)} (deepest this descent ${fmt(s.maxFloor)})`], ['Deepest floor cleared', fmt(s.bestCleared)], ['Kills per second', g.killRate.toFixed(1)],
      ['Gold this descent', fmt(s.runGold)], ['Gold all time', fmt(s.totalGold)], ['Monsters killed', fmt(s.kills)], ['Bosses beaten', fmt(s.bosses)],
      ['Clicks', fmt(s.clicks)], ['Critical hits', fmt(s.crits)], ['Treasure goblins', fmt(s.raids)], ['Rainbow Vaults', fmt(s.vaults)], ['Rampages', fmt(s.fevers)], ['Clutch kills', fmt(s.clutches)], ['Champions slain', fmt(s.champions)],
      ...(DEMO ? [] : [['Ascents', fmt(s.descents)], ['Awakenings', fmt(s.awakens)]] as [string, string][]), ['Trophies', `${s.trophies.length} / ${TROPHIES.length}`], ...(RELICS_ON ? [['Relics', `${g.relicsFound()} / ${RELICS.length}`] as [string, string]] : []), ['Cards found', fmt(g.cardsFound())],
      ['This descent', duration(s.runTime)], ['Active', duration(s.runActive), true], ['Idle', duration(Math.max(0, s.runTime - s.runActive)), true],
      ['Time played', duration(s.playTime)], ['Active', duration(s.activeTime), true], ['Idle', duration(Math.max(0, s.playTime - s.activeTime)), true],
    ];
    return `<dl class="stats">${rows.map(([k, v, sub]) => `<div${sub ? ' class="sub"' : ''}><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  }

  private tabs(on: 'abyss' | 'marks') {
    if (DEMO) return '';
    const g = this.game;
    if (!g.marksTotal()) return '';
    return `<nav class="tabs">
      <button class="tab ${on === 'abyss' ? 'on' : ''}" data-open="abyss">Spirits</button>
      ${g.marksTotal() ? `<button class="tab ${on === 'marks' ? 'on' : ''}" data-open="marks">${G.heart()} Heartmarks ${g.marksTotal()}</button>` : ''}
    </nav>`;
  }

  /** The floor picked for each companion in the Expeditions panel (until sent; otherwise its suggestion). */
  private tripPick: Record<number, number> = {};

  private tripsHtml(): string {
    if (DEMO) return '';
    const g = this.game;
    const rate = (r: number) => (r >= 10 ? fmt(Math.round(r)) : r.toFixed(r >= 1 ? 1 : 2));
    const rows = COMPS.map((c, i) => {
      const trip = g.s.expeditions.find((e) => e.comp === i);
      if (trip) {
        const left = TRIP_HOURS * 3600 - g.tripSeconds(trip);
        const time = trip.pausedAt !== undefined ? 'With you' : `${duration(Math.max(0, left))} left`;
        return `<div class="trip away" data-hunter="${i}"><span class="trip-ico">${charFit(c.sprite, 34)}</span>
          <span class="trip-mid"><b>${esc(c.name)}</b><small class="trip-stats"><span>Floor ${fmt(trip.floor)}</span><span>${fmt(g.tripKills(trip))} kills</span><span>${fmt(trip.found?.length ?? 0)} cards</span><span>${time}</span></small></span>
          <button class="btn small" data-act="tripHome">Call home</button></div>`;
      }
      if (g.s.owned[i] < EXPEDITION_LEVEL) return '';
      const floor = Math.min(g.s.bestFloor, this.tripPick[i] ?? g.tripFloor(i));
      const dps = g.compDps(i);
      return `<div class="trip" data-hunter="${i}"><span class="trip-ico">${charFit(c.sprite, 34)}</span>
        <span class="trip-mid"><b>${esc(c.name)} <small>Lv ${g.s.owned[i]}</small></b>
        <small>${rate(g.tripRate(floor, dps))} kills/s</small></span>
        <label class="trip-floor">Floor <input type="number" id="trip-floor-${i}" min="1" max="${g.s.bestFloor}" value="${floor}" data-trip="${i}"></label>
        <button class="btn small primary" data-act="tripGo">Send</button></div>`;
    }).join('');
    return `<div class="trips">${rows || `<p class="muted">Companions at level ${EXPEDITION_LEVEL} can go</p>`}</div>`;
  }

  private heartHtml(): string {
    if (DEMO) return '';
    const g = this.game;
    const cycle = g.cycleSouls();
    let bar: string;
    if (g.canAwaken()) {
      bar = `<button class="btn primary big" data-act="awaken">Awaken for ${boundGlyph()} ${fmt(g.pendingBound())}</button>`;
    } else if (Math.max(g.s.cycleBest, g.s.maxFloor) < TUNE.awakenFloor) {
      const best = Math.max(g.s.cycleBest, g.s.maxFloor);
      bar = `<p>Deepest floor <b>${fmt(best)} / ${fmt(TUNE.awakenFloor)}</b></p><div class="bar heart-bar"><i style="width:${Math.min(100, (best / TUNE.awakenFloor) * 100)}%"></i></div>`;
    } else {
      const at = g.nextBoundAt();
      bar = `<p>Souls this cycle <b>${fmt(cycle)} / ${fmt(at)}</b></p><div class="bar heart-bar"><i style="width:${Math.min(100, (Math.log10(Math.max(1, cycle)) / Math.log10(at)) * 100)}%"></i></div>`;
    }
    // Before the first awakening the Bound wait as shadows, as the Spirits do before the first ascent.
    if (!g.s.awakens) {
      const shades = BOUND.map((b) => `<span class="bshade">${silhouette(ZONES[b.zone].boss.sprite, 56, '#0b0710')}</span>`).join('');
      return `<div class="heart-bar-box">${bar}</div><div class="bshades">${shades}</div><p class="bshades-note">The Bound await after you awaken</p>`;
    }
    return `<div class="heart-bar-box">${bar}</div>
      <div class="lc-head"><h3>The Bound</h3><small>${boundGlyph(1.2)} ${fmt(g.boundFree())} to spend</small></div>
      <div class="lcards">${BOUND.map((b) => this.boundCard(b)).join('')}</div>`;
  }

  /** One of the Bound as a card: its figure, level, what it gives now and next, and its Level up button. */
  private boundCard(b: BoundDef) {
    if (DEMO) return '';
    const g = this.game;
    const lv = g.boundLv(b.id);
    const cost = g.boundPrice(b.id);
    const next = g.boundMaxed(b.id)
      ? `<span class="lc-max" data-tip="bound:${b.id}">Max level</span>`
      : `<span>Next: ${esc(b.value(lv + 1))}</span><span class="lc-up" data-tip="bound:${b.id}" data-bound="${b.id}"><button class="btn primary" ${g.boundFree() >= cost ? '' : 'disabled'}>Level up · ${boundGlyph(1.5)} ${fmt(cost)}</button></span>`;
    return `<div class="lcard bcard${lv ? '' : ' unbought'}" data-card="${b.id}">
      <div class="lc-fig"><span class="bsparks">${WISPS}</span><span class="ped-fig">${bossFig(b, 80, 96)}</span><span class="ped-stone"></span></div>
      <div class="lc-nm"><b>${esc(boundName(b))}</b><span class="lc-lv">Level<span>${lv}</span></span></div>
      <div class="lc-val">${lv ? esc(b.value(lv)) : '—'}</div>
      <div class="lc-what">${this.boundWhat(b)}</div>
      <div class="lc-next">${next}</div>
    </div>`;
  }

  /** What a Bound boosts, the Spirit it works through underlined (hover it for what that Spirit does). */
  private boundWhat(b: BoundDef) {
    if (DEMO) return '';
    if (!b.spirit) return esc(b.what);
    const name = LEGEND_BY_ID.get(b.spirit)!.name;
    return esc(b.what).replace(esc(name), `<span class="spirit-u" data-tip="spirit:${b.spirit}">${esc(name)}</span>`);
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
        ${spriteFit(d.icon, 32)}<b>${esc(d.name)}${starsOf(lv)}</b><small><span${this.levelledRelics.has(d.id) ? ' class="lv-up"' : ''}>Level ${lv}</span>${on ? ' · equipped' : ''}</small></button>`;
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
    if (this.modal !== 'relics') {
      if (lv === 1) this.newRelics++;
      else this.levelledRelics.add(id);
    }
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

  /** A card picked up: it slides up like a relic, and a gold one gets a banner. */
  /** Cards picked up and waiting their turn to be shown (they're shown one at a time). */
  private cardQueue: Extract<Drop, { t: 'card' }>[] = [];
  /** Cards dropped in play and not yet shown, and the card trophies waiting on them. */
  private cardsComing = 0;
  private heldTrophies: string[] = [];
  private heldTimer = 0;

  private trophyToast(id: string) {
    const t = TROPHIES.find((x) => x.id === id)!;
    this.hooks.sound('drop2', { vol: 0.55 });
    this.toast(`Trophy: <b>${esc(t.name)}</b><small>${esc(t.desc)} +1% damage</small>`, t.icon.sprite, 'trophy');
    const cur = CURSORS.find((c) => c.trophy === id);
    if (cur) this.toast(`New cursor: <b>${esc(cur.name)}</b><small>Pick it in Options</small>`, cur.sprite, 'trophy');
  }

  private releaseTrophies() {
    clearTimeout(this.heldTimer);
    this.cardsComing = 0;
    for (const id of this.heldTrophies.splice(0)) this.trophyToast(id);
  }

  private showCard(ev: Extract<Drop, { t: 'card' }>) {
    if (this.modal !== 'cards' && ev.newColor) this.newCards++;
    this.cardQueue.push(ev);
    if (this.cardQueue.length === 1) this.revealCard();
  }

  /** The card turns up big over the room face-down and flips over in a burst of light; clicked, it flies into the
   *  Collection button. */
  private revealCard() {
    const ev = this.cardQueue[0];
    // (The Keep's labels step aside while a card waits: they'd show through its words.)
    document.body.classList.toggle('card-up', !!ev);
    if (!ev) return;
    const d = CARD_BY_ID.get(ev.id)!;
    const el = document.createElement('div');
    el.className = `card-reveal${ev.gold ? ' gold' : ''}${ev.newColor || ev.gold ? '' : ' dupe'}`;
    el.style.setProperty('--rc', ev.gold ? CARD_FRAME.gold : CARD_FRAME[d.kind]);
    // (Up in the Keep the dungeon isn't drawn, so its middle isn't anywhere: the field's middle stands in.)
    const mid = this.game.s.inKeep ? { x: this.field.w / 2, y: this.field.h * 0.45 } : this.scene.centerScreen();
    el.style.left = `${mid.x}px`;
    el.style.top = `${mid.y}px`;
    const dock = this.el.cardBadge.parentElement!;
    const to = dock.getBoundingClientRect();
    el.style.setProperty('--tx', `${to.left + to.width / 2 - mid.x}px`);
    el.style.setProperty('--ty', `${to.top + to.height / 2 - mid.y}px`);
    const head = ev.gold ? (ev.newColor ? 'New gold card!' : 'Gold card!') : ev.newColor ? 'New card!' : 'Card';
    const line = ev.first ? `<em>Found on ${d.kind === 'goblin' ? 'catch' : 'kill'} #${fmt(ev.kill)}</em>` : '';
    el.innerHTML = `<i class="cr-rays"></i>
      <div class="cr-card">${ev.gold ? GOLD_DAZZLE : ''}<div class="cr-flip"><div class="cr-back">${G.heart(7)}<b class="cr-logo">DEEPHEART</b></div><div class="cr-front">${cardFace(d, 'got', ev.gold, 96, ev.lap)}</div></div></div>
      <div class="cr-text"><small>${head}</small><b>${esc(cardName(d.name, ev.lap))} Card${(ev.copies ?? 1) > 1 ? ` ×${ev.copies}` : ''}</b>${line}<span class="cr-tap">${this.touch ? 'Tap' : 'Click'} to collect</span></div>`;
    this.el.loot.parentElement!.appendChild(el);
    // The sound lands with the flip.
    setTimeout(() => this.hooks.sound(ev.gold || d.kind !== 'monster' ? 'drop4' : 'drop3', { vol: 0.8 }), 380);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.remove();
      this.bump(dock);
      this.cardQueue.shift();
      this.cardsComing = Math.max(0, this.cardsComing - 1);
      if (!this.cardQueue.length && !this.cardsComing) this.releaseTrophies();
      this.revealCard();
    };
    // It waits, face up, for a click (so a card found while you're away is still there when you're back); the click
    // isn't an attack on whatever is behind it.
    const card = el.querySelector<HTMLElement>('.cr-card')!;
    card.addEventListener('pointerdown', (e) => e.stopPropagation());
    card.addEventListener('click', () => {
      if (el.classList.contains('go')) return;
      el.classList.add('go');
      this.hooks.sound('card', { vol: 0.6 });
      // In case the flight never plays (reduced motion, a hidden tab).
      setTimeout(finish, 900);
    });
    card.addEventListener('animationend', (e) => {
      if ((e as AnimationEvent).animationName === 'cr-fly') finish();
    });
  }

  private renderAwakenConfirm() {
    if (DEMO) return;
    const g = this.game;
    this.modal = 'confirm';
    this.modalKey = 'confirm';
    this.el.modal.className = 'modal pnl m-confirm m-awaken';
    const first = !g.s.awakens;
    const gain = g.pendingBound();
    const away = g.s.expeditions.length;
    const faces = BOUND.map((b) => {
      const lv = g.boundLv(b.id);
      return `<span class="aw-face">${first ? silhouette(ZONES[b.zone].boss.sprite, 40, '#0b0710') : bossFig(b, 40, 48)}${lv ? `<i>${lv}</i>` : ''}</span>`;
    }).join('');
    const row = (k: string, v: string) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    this.el.modal.innerHTML = `<header class="m-head"><h2>Awaken the Heart</h2><button class="btn icon" data-act="close">${G.close()}</button></header>
      <div class="confirm aw-confirm">
        <div class="aw-cols">
          <section class="aw-gain"><h4>Gain</h4>
            <div class="aw-big">${boundGlyph(3)}<b>${fmt(gain)}</b></div>
            <small>bound souls${first ? '' : ` · ${fmt(g.s.boundEarned + gain)} in all`}</small>
            <h5>${first ? 'The Bound wake' : 'The Bound'}</h5>
            <div class="aw-faces${first ? ' shade' : ''}">${faces}</div>
          </section>
          <section class="aw-lose"><h4>Lose</h4>
            <dl class="stats">${row(`${G.soul(1.5)} Souls`, fmt(g.cycleSouls()))}${row('Spirits', fmt(g.legendsOwned()))}${row(`${G.heart(1.5)} Heartmarks`, fmt(g.marksTotal()))}${row('This run', `floor ${fmt(g.s.maxFloor)}`)}</dl>
          </section>
        </div>
        <p class="aw-kept">Kept: cards, trophies, companions</p>
        ${away ? `<p class="aw-away">On expeditions: ${away}</p>` : ''}
        ${!first && g.boundSpent() ? `<label class="set-check"><input type="checkbox" id="awaken-respec" checked> Respec the Bound</label>` : ''}
        <div class="set-row"><button class="btn" data-act="heartBack">Not yet</button>${away ? '<button class="btn primary big" data-act="recallAll">Call everyone home</button>' : '<button class="btn primary big" data-act="awakenGo">Awaken</button>'}</div>
      </div>`;
  }

  private doAwaken() {
    if (DEMO) return;
    const respec = !!this.el.modal.querySelector<HTMLInputElement>('#awaken-respec')?.checked;
    this.playAwakening(respec);
  }

  /** Arriving in the Keep after an awakening: in front of the Heart, not on the stairs. */
  private arriveAtHeart = false;
  /** A scene is playing (the music hushes for it). */
  cutscene = false;

  /**
   * The awakening as a scene: the room goes dark, the Heart beats faster and faster as your souls stream into it, bursts,
   * the bound souls count up and the Bound rise round it (out of the dark, the first time). A click skips ahead; the
   * end is the Heart's room in the Keep, with the Bound open.
   */
  private playAwakening(respec: boolean) {
    if (DEMO) return;
    const g = this.game;
    if (!g.canAwaken() || this.descending) return;
    const first = !g.s.awakens;
    const gain = g.pendingBound();
    const title = first ? 'The Heart awakens' : `Awakening ${g.s.awakens + 1}`;
    this.descending = true;
    this.cutscene = true;
    this.modal = null;
    this.el.modalWrap.hidden = true;
    this.hideTip();
    // Red sparks fill the dark: drifting up all through, bursting out from the Heart when it wakes.
    const embers = Array.from({ length: 140 }, (_, k) =>
      `<i style="--x:${(k * 37) % 100}%;--d:${(2.6 + ((k * 13) % 40) / 10).toFixed(1)}s;--w:${-((k * 29) % 70) / 10}s;--s:${1 + ((k * 7) % 4)};--dx:${((k * 23) % 80) - 40}px"></i>`).join('');
    const sparks = Array.from({ length: 48 }, (_, k) => {
      const a = (k / 48) * 360 + ((k * 31) % 17);
      return `<i style="--a:${a}deg;--r:${30 + ((k * 41) % 45)}vmin;--t:${(0.8 + ((k * 7) % 9) / 10).toFixed(1)}s;--s:${1 + ((k * 3) % 3)}"></i>`;
    }).join('');
    const souls = Array.from({ length: 40 }, (_, k) => {
      const angle = (k / 40) * 360 + ((k * 47) % 23);
      return `<i style="--a:${angle}deg;--r:${55 + ((k * 29) % 30)}vmin;--d:${(0.9 + ((k * 37) % 230) / 100).toFixed(2)}s;--t:${(0.9 + ((k * 13) % 7) / 10).toFixed(1)}s;--s:${1 + ((k * 5) % 3)}"></i>`;
    }).join('');
    const ring = BOUND.map((b, k) => {
      const angle = (k / BOUND.length) * Math.PI * 2 - Math.PI / 2;
      const lv = g.boundLv(b.id);
      return `<span class="awk-bound" style="--x:${(Math.cos(angle) * 34).toFixed(1)}vmin;--y:${(Math.sin(angle) * 30).toFixed(1)}vmin;--k:${k}">
        <span class="awk-glint">${GLINT}</span><span class="awk-fig">${bossFig(b, 72, 84)}</span>
        <b>${esc(boundName(b))}</b>${!first && lv && !respec ? `<i>${lv}</i>` : ''}</span>`;
    }).join('');
    const el = document.createElement('div');
    el.className = `awk${first ? ' first' : ''}`;
    el.innerHTML = `<div class="awk-embers">${embers}</div><div class="awk-souls">${souls}</div><div class="awk-sparks">${sparks}</div><div class="awk-ring">${ring}</div>
      <div class="awk-heart">${G.heart(18)}<i class="awk-wave"></i></div><div class="awk-flash"></div>
      <div class="awk-text"><b>${esc(title)}</b><span class="awk-gain">${boundGlyph(3)}<em>0</em><small>bound souls</small></span></div>
      <span class="awk-tap">${this.touch ? 'Tap' : 'Click'} to continue</span>`;
    this.root.appendChild(el);
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    let awoken = false;
    const awaken = () => {
      if (awoken) return;
      awoken = true;
      g.awaken(respec);
      this.shown = new Decimal(0);
      this.rowCache.fill('');
      this.floorKey = '';
      this.hooks.save();
    };
    // Once the dark has closed over wherever you were, up to the Keep behind it: the dungeon stops (no fighting under
    // the scene), and you come out in front of the Heart.
    let moved = false;
    const toKeep = () => {
      if (moved) return;
      moved = true;
      // (Already up there: just step over to the Heart.)
      if (g.s.inKeep) this.keepView?.arriveAtHeart();
      else {
        this.arriveAtHeart = true;
        g.enterKeep();
      }
    };
    at(750, toKeep);
    // The Heart beats faster and faster as the souls pour in.
    this.hooks.sound('descend', { vol: 0.6, rate: 0.7 });
    [900, 1700, 2350, 2850, 3200, 3450, 3650].forEach((ms, k) => at(ms, () => {
      el.classList.remove('thump');
      void el.offsetWidth;
      el.classList.add('thump');
      this.hooks.sound('boss', { vol: 0.25 + k * 0.06, rate: 0.55 + k * 0.03 });
    }));
    at(3900, () => {
      awaken();
      el.classList.add('burst');
      this.hooks.sound('awaken', { vol: 1 });
      this.hooks.sound('drop4', { vol: 0.8, rate: 0.7 });
    });
    at(4500, () => {
      el.classList.add('told');
      const num = el.querySelector('.awk-gain em')!;
      const t0 = performance.now();
      const count = () => {
        const p = Math.min(1, (performance.now() - t0) / 900);
        num.textContent = fmt(Math.round(gain * (1 - (1 - p) ** 3)));
        if (p < 1 && el.isConnected) requestAnimationFrame(count);
      };
      count();
    });
    at(5600, () => {
      el.classList.add('rise');
      // A chime as each one rises (the first time, as each comes into its colors).
      BOUND.forEach((_, k) => at((first ? 1500 : 0) + k * 180, () => this.hooks.sound('card', { vol: 0.35, rate: 0.8 + k * 0.05 })));
    });
    at(first ? 8900 : 7400, () => el.classList.add('done'));
    let ending = false;
    const end = () => {
      if (ending) return;
      ending = true;
      timers.forEach(clearTimeout);
      toKeep();
      awaken();
      el.classList.add('out');
      setTimeout(() => {
        el.remove();
        this.descending = false;
        this.cutscene = false;
        this.hooks.sound('drop4', { vol: 0.6 });
        this.openModal('heart');
      }, 700);
    };
    // A click before the end skips to it; once everything's shown, it carries on.
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', end);
  }

  /** The floor number turns into a box: type any floor you've reached and go there (going back turns Auto off). */
  private jumpFloor() {
    const g = this.game;
    const label = this.el.floorN;
    if (label.hidden) return;
    const input = document.createElement('input');
    Object.assign(input, { type: 'number', inputMode: 'numeric', min: '1', max: String(g.s.maxFloor), value: String(g.s.floor), className: 'floor-jump' });
    input.setAttribute('aria-label', `Go to floor (1 to ${g.s.maxFloor})`);
    label.hidden = true;
    label.after(input);
    this.hideTip();
    input.focus();
    input.select();
    let done = false;
    const finish = (go: boolean) => {
      if (done) return;
      done = true;
      const f = Math.round(Number(input.value));
      input.remove();
      label.hidden = false;
      if (go && f >= 1) {
        const to = Math.min(f, g.s.maxFloor);
        if (g.goFloor(to) && to < g.s.maxFloor) g.s.auto = false;
      }
      this.floorKey = '';
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(false));
  }

  private viaLine(via: string) {
    return via.startsWith(giftVia('')) ? `A gift from ${via.slice(giftVia('').length)}` : `Traded from ${via}`;
  }


  private renderDescendConfirm() {
    if (DEMO) return;
    const g = this.game;
    const pending = g.pendingSouls();
    const away = g.s.expeditions.length;
    this.modal = 'confirm';
    this.modalKey = 'confirm';
    this.el.modal.className = 'modal pnl m-confirm';
    this.el.modal.innerHTML = `<header class="m-head"><h2>Ascend for ${G.soul()} ${fmt(pending)} soul${pending === 1 ? '' : 's'}?</h2><button class="btn icon" data-act="close">${G.close()}</button></header>
      <div class="confirm">
        <p>${soulPct(pending)} damage. Gold, companions and floor reset.</p>
        ${this.curseChoice ? `<p class="omen">The next descent is cursed: ${esc(CURSE_BY_ID.get(this.curseChoice)!.name)}. ${esc(CURSE_BY_ID.get(this.curseChoice)!.rule)}</p>` : ''}
        ${away ? `<p class="aw-away">On expeditions: ${away}</p>` : ''}
        <div class="set-row"><button class="btn" data-act="abyssBack">Not yet</button>${away ? '<button class="btn primary big" data-act="recallAll">Call everyone home</button>' : '<button class="btn primary big" data-act="descendGo">Ascend</button>'}</div>
      </div>`;
  }

  private doDescend() {
    if (DEMO) return;
    const g = this.game;
    this.descending = true;
    this.modal = null;
    this.el.modalWrap.hidden = true;
    const c = this.el.curtain;
    c.hidden = false;
    c.className = 'curtain in';
    c.querySelector('b')!.textContent = `Ascent ${g.s.descents + 1}`;
    c.querySelector('span')!.textContent = 'The Keep';
    this.hooks.sound('descend', { vol: 0.8 });
    setTimeout(() => {
      g.descend(this.curseChoice);
      g.enterKeep();
      this.curseChoice = null;
      this.shown = new Decimal(0);
      this.rowCache.fill('');
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

  /** Desktop app only: a newer release is out. One click downloads it; it can be dismissed until next launch. */
  showUpdate(version: string, download: () => void) {
    let el = this.el.loot.parentElement!.querySelector<HTMLElement>('.update-pill');
    if (!el) {
      el = document.createElement('div');
      el.className = 'update-pill pnl';
      this.el.loot.parentElement!.appendChild(el);
    }
    el.innerHTML = `<span><b>Update available</b> v${esc(version)}</span><button class="btn small primary" data-update="now">Update now</button><button class="btn icon small" data-update="later" aria-label="Dismiss">${G.close()}</button>`;
    const pill = el;
    pill.onclick = (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-update]')?.dataset.update;
      if (act === 'later') pill.remove();
      if (act === 'now') {
        download();
        pill.innerHTML = `<span><b>Downloading v${esc(version)}</b> Open it and replace Deepheart; your save stays.</span><button class="btn icon small" data-update="later" aria-label="Dismiss">${G.close()}</button>`;
      }
    };
  }

  /** The end of the demo, over the black the stairs faded to: the next hero still a silhouette (no more than that: how
   *  many are left stays a surprise, as it is in the game), what you found, and the way to Steam. */
  showDemoEnd() {
    if (this.root.querySelector('.demo-end')) return;
    const g = this.game;
    this.hideTip();
    if (this.modal) this.closeModal();
    document.body.classList.add('demo-over');
    const heroes = g.s.owned.filter((n) => n > 0).length;
    const cards = Object.values(g.s.cards).reduce((n, c) => n + c.n.reduce((a, b) => a + (b > 0 ? 1 : 0), 0) + c.gold.reduce((a, b) => a + (b > 0 ? 1 : 0), 0), 0);
    const el = document.createElement('div');
    el.className = 'demo-end';
    el.innerHTML = `<div class="de-in">
      <div class="de-heart">${G.heart(8)}</div>
      <h1>DEEPHEART</h1>
      <p class="de-lead">Thanks for playing the demo!</p>
      <div class="de-next">${silhouette(COMPS[DEMO_COMPANIONS].sprite, 96, '#2c2233')}<b>???</b></div>
      <p class="de-more">More heroes wait deeper down.</p>
      <p class="de-run">You met ${heroes} hero${heroes === 1 ? '' : 'es'} and found ${cards} card${cards === 1 ? '' : 's'}.</p>
      <a class="mm-btn steam" href="${STEAM_URL}" target="_blank" rel="noopener">${G.steam(26)}Wishlist on Steam</a>
      <button type="button" class="mm-btn de-menu">Main menu</button>
    </div>`;
    el.querySelector('.de-menu')!.addEventListener('click', () => this.hooks.mainMenu());
    this.root.appendChild(el);
  }

  /** The Keep's labels over each thing you can use, clickable (walking up to it works too). */
  private keepLabelsFrame() {
    if (DEMO) return;
    const host = this.el.keepLabels;
    const labels = this.keepView?.labels() ?? null;
    if (!labels) {
      if (host.childElementCount) host.innerHTML = '';
      delete host.dataset.ids;
      document.body.classList.remove('over-act');
      return;
    }
    const ids = labels.map((l) => `${l.id}:${l.verb}`).join(' ');
    if (host.dataset.ids !== ids) {
      host.dataset.ids = ids;
      host.innerHTML = labels.map((l) => `<button class="keep-label${l.id === 'heart' || l.id.startsWith('bound:') ? ' heart' : l.id.includes(':') ? ' soul' : ''}${l.below ? ' below' : ''}" data-station="${l.id}">${l.below ? '<i>▲</i>' : ''}<b>${esc(l.label)}</b><em class="kp"><kbd>E</kbd>${MOUSE_GLYPH}<span>${esc(l.verb)}</span></em>${l.below ? '' : '<i>▼</i>'}</button>`).join('');
      // Clicking a label walks you over and uses it when you get there.
      host.querySelectorAll<HTMLElement>('[data-station]').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.keepView?.useOrWalk(b.dataset.station as KeepStation);
        });
        // Pointing at a label is pointing at its station: its figure lights up and its prompt shows.
        b.addEventListener('pointerenter', () => {
          if (this.keepView) this.keepView.hover = this.keepView.labelHover = b.dataset.station as KeepStation;
        });
        b.addEventListener('pointerleave', () => {
          if (this.keepView) this.keepView.hover = this.keepView.labelHover = null;
        });
      });
    }
    labels.forEach((l, i) => {
      const el = host.children[i] as HTMLElement;
      el.style.transform = `translate(${Math.round(l.x)}px, ${Math.round(l.y)}px)`;
      el.hidden = !l.shown || l.x < -60 || l.x > this.field.w + 60;
      el.classList.toggle('near', this.keepView?.near === l.id);
      el.classList.toggle('keyed', !!this.keepView?.keyed);
      el.classList.toggle('hover', this.keepView?.hover === l.id);
    });
    // Over something you can use, the cursor says so (a speech bubble on the blade).
    document.body.classList.toggle('over-act', !!this.keepView?.hover);
  }

  /** Back after time away with the party up in the Keep: nothing happened below. */
  showKeepAway(seconds: number) {
    if (DEMO) return;
    this.modal = 'offline';
    this.el.modalWrap.hidden = false;
    this.el.modal.className = 'modal pnl m-offline';
    this.el.modal.innerHTML = `<header class="m-head"><h2>Welcome back</h2></header>
      <div class="offline">
        <p>You were away for <b>${duration(seconds)}</b>.</p>
        <p>Your party was in the Keep.</p>
        <button class="btn primary big" data-act="close">Okay</button>
      </div>`;
  }

  /** Up to the Keep, or back down to the dungeon: a fade through the dark hallway between them. */
  private toggleKeep() {
    if (DEMO) return;
    const g = this.game;
    if (this.keepFading || this.descending) return;
    const up = !g.s.inKeep;
    if (up && (!g.legendsOpen() || g.inVault() || g.raid)) return;
    this.keepFading = true;
    this.closeModal();
    const c = this.el.curtain;
    c.hidden = false;
    c.className = 'curtain in';
    c.querySelector('b')!.textContent = up ? 'The Keep' : `Floor ${fmt(g.s.floor)}`;
    c.querySelector('span')!.textContent = '';
    this.hooks.sound('descend', { vol: 0.5 });
    setTimeout(() => {
      if (up) g.enterKeep();
      else g.leaveKeep();
      this.floorKey = '';
      this.hooks.save();
    }, 700);
    setTimeout(() => {
      c.className = 'curtain out';
      this.keepFading = false;
    }, 1300);
    setTimeout(() => (c.hidden = true), 2200);
  }
  private keepFading = false;
  /** A clutch kill's time left, held on the boss clock through the slow motion. */
  private clutchHold: { left: number; max: number; until: number } | null = null;
  /** What the Keep button says now (it swaps its icon when this changes). */
  private keepBtnText = '';
  /** The Keep's top-down map, while you're up there. */
  private keepView: KeepView | null = null;

  /** Your hero walked up to something in the Keep. */
  private station(id: KeepStation) {
    if (DEMO) return;
    if (this.modal || this.keepFading) return;
    this.hooks.sound('open', { vol: 0.4 });
    if (id.startsWith('offer:')) {
      // The one you're standing at is the one picked, ready to summon.
      this.legendPick = id.slice(6) as LegendId;
      this.openModal('abyss');
    } else if (id.startsWith('legend:')) {
      this.legendFocus = id.slice(7) as LegendId;
      this.openModal('legend');
    } else if (id === 'stairs') this.toggleKeep();
    else if (id === 'dan' || id === 'victor') this.openTrade(id);
    else if (id === 'trips') this.openModal('trips');
    else if (id === 'heart') this.openModal('heart');
    else if (id.startsWith('bound:')) {
      this.boundFocus = id.slice(6) as BoundId;
      this.openModal('bound');
    }
  }

  /** Hunters' finds out on their trips, not yet told (one toast for them all, from update). */
  private tripFinds = new Map<number, { cards: number; gold: number }>();

  /** "Squire found 2 cards · Ranger found a gold card". */
  private tellTripFinds() {
    if (DEMO) return;
    if (!this.tripFinds.size) return;
    const parts = [...this.tripFinds].map(([comp, f]) => {
      const plain = f.cards - f.gold;
      const what = [plain ? (plain === 1 ? 'a card' : `${fmt(plain)} cards`) : '', f.gold ? (f.gold === 1 ? 'a gold card' : `${fmt(f.gold)} gold cards`) : ''].filter(Boolean).join(' and ');
      return `<b>${esc(COMPS[comp].name)}</b> found ${what}`;
    });
    const first = [...this.tripFinds.keys()][0];
    this.tripFinds.clear();
    this.toast(parts.join(' · '), COMPS[first].sprite);
    this.hooks.sound('card', { vol: 0.35, rate: 1.2 });
  }

  /** Cards from a hunt as they come in, and the hunters home but not yet shown. */
  private tripCards: Extract<GameEvent, { t: 'card' }>[] = [];
  private tripsBack: { comp: number; floor: number; kills: number; cards: Extract<GameEvent, { t: 'card' }>[] }[] = [];

  /** Hunters home: who, from where, and what they found (collecting spins the cards, as after time away). */
  /** Hunters home: what they found. Called home from the Expeditions window, it shows over that window, which stays
   *  open behind it (and behind the cards) for the next one. */
  private showTripsBack(over = false) {
    if (DEMO) return;
    const back = this.tripsBack.splice(0);
    const cards = back.flatMap((b) => b.cards);
    const who = back.map((b) => `<p>${charFit(COMPS[b.comp].sprite, 22)} <b>${esc(COMPS[b.comp].name)}</b> · floor ${fmt(b.floor)} · ${fmt(b.kills)} kills</p>`).join('');
    const html = `<header class="m-head"><h2>Back from ${back.length === 1 ? 'an expedition' : 'expeditions'}</h2></header>
      <div class="offline">
        ${who}
        ${cards.length ? `<p>Cards <b>${fmt(cards.length)}</b></p><div class="offline-cards">${this.offlineCardsHtml(cards)}</div>` : '<p class="muted">No cards</p>'}
        <button class="btn primary big" data-act="${over ? 'tripsBackDone' : 'close'}">${cards.length ? 'Collect' : 'Okay'}</button>
      </div>`;
    if (over) {
      this.tripsBackDone();
      this.tripsBackEl = document.createElement('div');
      this.tripsBackEl.className = 'modal pnl m-offline trips-back';
      this.tripsBackEl.innerHTML = html;
      this.el.modalWrap.appendChild(this.tripsBackEl);
      this.tripsBackCards = this.groupCards(cards);
      return;
    }
    this.modal = 'offline';
    this.el.modalWrap.hidden = false;
    this.el.modal.className = 'modal pnl m-offline';
    this.el.modal.innerHTML = html;
    this.offlineCards = this.groupCards(cards);
  }

  /** The return summary over the Expeditions window and its cards; collected, its cards are shown. */
  private tripsBackEl: HTMLElement | null = null;
  private tripsBackCards: Extract<Drop, { t: 'card' }>[] = [];
  private tripsBackDone() {
    for (const card of this.tripsBackCards.splice(0)) this.showCard(card);
    this.tripsBackEl?.remove();
    this.tripsBackEl = null;
  }

  showOffline(o: OfflineSummary) {
    this.modal = 'offline';
    this.el.modalWrap.hidden = false;
    this.el.modal.className = 'modal pnl m-offline';
    const kills = `${fmt(o.kills)} monster${o.kills === 1 ? '' : 's'}`;
    this.el.modal.innerHTML = `<header class="m-head"><h2>Welcome back</h2></header>
      <div class="offline">
        <p>You were away for <b>${duration(o.seconds)}</b>.</p>
        <p>Your party kept fighting, killed <b>${kills}</b>${o.floor ? ` and reached <b>floor ${fmt(o.floor)}</b>` : ''}, and looted</p>
        <div class="offline-v">${sprite('coin', 5)}<b>${fmt(o.gold)}</b></div>
        <p class="muted">gold</p>
        ${o.cards.length ? `<p>and found <b>${o.cards.length === 1 ? 'a card' : `${o.cards.length} cards`}</b></p><div class="offline-cards">${this.offlineCardsHtml(o.cards)}</div>` : ''}
        <button class="btn primary big" data-act="close">Collect</button>
      </div>`;
    // Collecting spins each card once, with how many came.
    this.offlineCards = this.groupCards(o.cards);
  }

  /** Cards found while away as one per card, color and gold-or-not, carrying how many came; new ones first. */
  private groupCards(cards: Extract<Drop, { t: 'card' }>[]) {
    const groups = new Map<string, (typeof cards)[number]>();
    for (const card of cards) {
      const key = `${card.id}:${card.lap}:${card.gold}`;
      const group = groups.get(key);
      if (!group) groups.set(key, { ...card, copies: 1 });
      else {
        group.copies = (group.copies ?? 1) + 1;
        group.first ||= card.first;
        group.newColor ||= card.newColor;
        group.kill = Math.min(group.kill, card.kill);
      }
    }
    return [...groups.values()].sort((a, b) => Number(b.newColor) - Number(a.newColor));
  }

  private offlineCardsHtml(cards: Extract<Drop, { t: 'card' }>[]) {
    return this.groupCards(cards).map((card) => {
      const n = card.copies ?? 1;
      return `<span class="oc${card.newColor ? ' new' : ''}">${cardFace(CARD_BY_ID.get(card.id)!, 'got', card.gold, 32, card.lap)}${n > 1 ? `<b class="oc-n">×${n}</b>` : ''}${card.newColor ? '<em class="oc-new">New</em>' : ''}</span>`;
    }).join('');
  }

}
