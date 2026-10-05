import Decimal from 'break_infinity.js';
import {
  ABYSS, ABYSS_BY_ID, AWAKEN_FLOOR, CLUTCH_SECONDS, COMPS, HOARDERS, relicPower, relicStars, HEART_BY_ID, RARITY, RELICS, RELIC_BY_ID, TROPHIES, UPGRADES, UPG_BY_ID, bandFor, bossFor, modsFor,
  CARDS, CORRUPTION, GOBLIN_CARD, RAINBOW_CARD, cardId, lapOf,
  type Effect, type ModId, type MonsterDef, type RaidReward, type RelicEffect, type Req, type TrophyReq, type UpgDef,
} from './data.ts';

export const SAVE_VERSION = 2;
const COST_GROWTH = 1.07;
/** Kills needed to clear a normal floor. */
export const FLOOR_KILLS = 25;
/** A boss guards every Nth floor. */
export const BOSS_EVERY = 5;
const BOSS_TIME = 30;
/** Monsters on the field at once (more with upgrades). */
const MAX_ON = 10;
const SPAWN_GAP = 0.12;
/** A party that could wipe the rest of a floor within this many seconds clears it in one sweep. */
const SWEEP_SECONDS = 1;
/** Seconds between swept floors, so a blitz through old floors still reads as one. */
const SWEEP_GAP = 0.6;
/** Ordinary monsters are a fraction of a floor's base health: many small kills. */
const TRASH = 0.4;
/** Every click deals this share of your companions' damage, before upgrades. */
const CLICK_DPS = 0.05;
/** Seconds between treasure goblins: rare enough to be a treat, not the engine of the game. */
const RAID_MIN = 180;
const RAID_MAX = 420;
const RAID_STAY = 10;
/** Attacks by hand (a click, a tap, holding either down, or holding Space) land at most this often; extra clicks
 *  are ignored, so clicking frantically (or with an auto-clicker) gains nothing over holding the button. */
export const MANUAL_RATE = 5;
/** The Phantom Blade attacks on its own this many times a second before upgrades. */
const AUTO_BASE = 1;
/** A new companion is revealed once the gold earned this run reaches this share of their price. */
const REVEAL_AT = 0.7;
const FEVER_TIME = 10;
/** Attacks by hand that fill the Rampage meter (about 12 seconds of holding). */
const FEVER_CLICKS = 60;
/** Attacks by hand during a Rampage that push it to its top tier, and what each tier does: clicks ×5 then ×10
 *  (nothing raises that further), party damage ×2 then ×3 (the Unstoppable upgrade and Blood Drum add to it). */
const RAMPAGE_STEPS = [20];
const RAMPAGE_TIERS = [{ click: 1, dps: 2 }, { click: 2, dps: 3 }];
const RAMPAGE_EXTEND = 3;
/** A clutch kill (boss beaten in its last CLUTCH_SECONDS) is worth this many times its gold. */
const CLUTCH_GOLD = 1.5;
/** Any monster that climbs the stairs has this chance of being a champion: tougher, glowing, and worth as much gold
 *  as ten ordinary monsters. */
const CHAMP_CHANCE = 0.01;
const CHAMP_HP = 6;
const CHAMP_GOLD = 10;
/** A boss on a floor you've beaten before is now and then a champion (so farming a boss floor has a jackpot):
 *  tougher, more gold, and the only source of gold boss cards. */
const CHAMP_BOSS_CHANCE = 1 / 150;
const CHAMP_BOSS_HP = 3;
const CHAMP_BOSS_GOLD = 10;
/** Card drops: 1 in this many kills (Ragnarok's 0.01% for ordinary monsters), and so on. 1% is the best odds anything gets. */
const CARD_ODDS = { monster: 10_000, boss: 2_500, champ: 100, champBoss: 100, goblin: 100, rainbow: 100 };
/** Party damage is shown as numbers in batches this many seconds apart. */
const DPS_SHOWN_EVERY = 0.35;
/** Seconds before the boss of a floor you're farming climbs back up. */
const BOSS_RESPAWN = 2.5;
/** Share of treasure goblins that are rainbow goblins. Catching one opens the Goblin Vault a quarter of the time
 *  (always the first time); otherwise it drops a Rainbow Haul of RAINBOW_HAUL times a goblin's plunder. */
const RAINBOW_CHANCE = 1 / 8;
const VAULT_CHANCE = 0.25;
const RAINBOW_HAUL = 3;
const VAULT_TIME = 20;
const VAULT_ON = 16;
const VAULT_GAP = 0.1;
/** Hoarders fall in this many seconds of party damage each and drop this many times a monster's gold, so a vault is
 *  worth roughly a quarter of an hour of ordinary fighting even without clicking. */
const VAULT_HP = 0.15;
const VAULT_GOLD = 15;
const BASE_CRIT = 0.04;
const BASE_CRIT_MULT = 8;
const OFFLINE_CAP = 72 * 3600;
/** The first time, the way down opens when you reach this floor's boss. */
export const DESCEND_FLOOR = 30;
const SOUL_GROWTH = 1.1;
/**
 * Pacing knobs, in one place (the balance script overrides them to search for good values).
 * - The floor 10 and 20 bosses pay `earlySouls` (enough that the first descent feels like a leap).
 *   Zone bosses pay `bossSouls` souls at floor 30, +10% a floor up to `soulTaper`, then only `soulLate`
 *   a floor: that's the wall. Zone bosses have `zoneBoss`× the health of mid-bosses.
 * - Awakening at floor f pays stoneBase × stoneGrowth^(f − AWAKEN_FLOOR) heartstones.
 * - Heart of Fury multiplies all damage by `fury` per level.
 * - Fury levels cost 2^n, so each floor deeper pays about fury^log2(stoneGrowth) more damage (×1.176 at 1.05).
 *   Keep `deepHp` just above that: higher and every awakening takes longer to recover from, lower and it snowballs.
 */
export const TUNE = { earlySouls: [20, 60], soulTaper: 90, soulLate: 1.04, stoneBase: 5, stoneGrowth: 1.05, fury: 10, deepHp: 1.18, bossSouls: 50, zoneBoss: 2 };

export interface Buff {
  id: RaidReward | 'fever';
  name: string;
  t: number;
  dur: number;
  /** Companion damage multiplier. */
  dps: number;
  /** Click damage multiplier. */
  click: number;
  /** Gold multiplier. */
  gold: number;
}

export interface Settings {
  sfxVol: number;
  musicVol: number;
  muted: boolean;
  music: boolean;
  particles: boolean;
  shake: boolean;
  numbers: boolean;
  notation: 'short' | 'sci';
  buyMode: 1 | 10 | 100 | -1;
  blood: boolean;
  /** Staircase interlude between zones. */
  cinematics: boolean;
  /** Cursor skin id (see CURSORS). */
  cursor: string;
}

export interface SaveState {
  v: number;
  /** Gold, damage and costs outgrow ordinary numbers deep down, so they're Decimals (saved as strings). */
  gold: Decimal;
  runGold: Decimal;
  totalGold: Decimal;
  kills: number;
  bosses: number;
  clicks: number;
  crits: number;
  owned: number[];
  upgrades: string[];
  abyss: string[];
  trophies: string[];
  souls: number;
  spentSouls: number;
  descents: number;
  raids: number;
  /** Treasure goblins that got away. */
  missed: number;
  fevers: number;
  fervor: number;
  buffs: Buff[];
  raidTimer: number;
  floor: number;
  /** Highest floor unlocked this descent (you can go back to any floor up to it). */
  maxFloor: number;
  /** Deepest floor ever reached. */
  bestFloor: number;
  /** Deepest floor ever cleared (floor trophies count these). */
  bestCleared: number;
  /** Souls banked this descent from zone bosses; paid out when you descend. */
  runSouls: number;
  floorKills: number;
  /** Move on as soon as a floor is cleared. */
  auto: boolean;
  /** Damage when a boss last beat you: auto retries once you're 50% stronger. */
  failDps: Decimal;
  revealed: number;
  bestDps: Decimal;
  playTime: number;
  runTime: number;
  startedAt: number;
  lastSave: number;
  /** Relic levels by id (0 / missing = not found yet). */
  relics: Record<string, number>;
  /** Relic ids in your slots. */
  equipped: string[];
  /** Deepest boss floor ever beaten: beating a deeper zone boss always drops a relic. */
  bossBest: number;
  /** Heart power levels by id. */
  heart: Record<string, number>;
  /** Unspent heartstones. */
  stones: number;
  awakens: number;
  /** Bosses beaten in the last seconds, champions slain, Goblin Vaults opened, highest Rampage tier reached. */
  clutches: number;
  champions: number;
  vaults: number;
  /** Rainbow goblins caught (a vault or a Rainbow Haul each), and whether one has ever turned up at all. */
  rainbows: number;
  rainbowSeen: boolean;
  /** The companion you picked as your hero (-1: none): it leaves the formation and follows the mouse, for the fun of it. */
  hero: number;
  /** How far through the hero introduction you are: 0 none, 1 met your hero, 2 shown the star that picks one. */
  heroTips: number;
  rampage: number;
  /** Cards by id: copies per edition (normal, then each corruption; only normal is shown so far), plain and gold, and
   *  the kill (for goblins, the catch) that first dropped each. */
  cards: Record<string, { n: number[]; gold: number[]; at?: number; goldAt?: number }>;
  /** Monsters slain per card id (a swept floor counts the monsters it wipes out). */
  slain: Record<string, number>;
  /** Deepest floor reached since the last awakening (heartstones are paid for it). */
  cycleBest: number;
  settings: Settings;
}

export function newSave(): SaveState {
  return {
    v: SAVE_VERSION, gold: new Decimal(0), runGold: new Decimal(0), totalGold: new Decimal(0), kills: 0, bosses: 0, clicks: 0, crits: 0,
    owned: COMPS.map(() => 0), upgrades: [], abyss: [], trophies: [], souls: 0, spentSouls: 0,
    descents: 0, raids: 0, missed: 0, fevers: 0, fervor: 0, buffs: [], raidTimer: 40,
    floor: 1, maxFloor: 1, bestFloor: 1, bestCleared: 0, runSouls: 0, floorKills: 0, auto: true, failDps: new Decimal(0), revealed: 0,
    bestDps: new Decimal(0), playTime: 0, runTime: 0, startedAt: Date.now(), lastSave: Date.now(),
    relics: {}, equipped: [], bossBest: 0, heart: {}, stones: 0, awakens: 0, clutches: 0, champions: 0, vaults: 0, rainbows: 0, rainbowSeen: false, hero: 0, heroTips: 0, rampage: 0, cycleBest: 0, cards: {}, slain: {},
    settings: { sfxVol: 0.8, musicVol: 0.6, muted: false, music: true, particles: true, shake: true, numbers: true, notation: 'short', buyMode: 1, blood: true, cinematics: true, cursor: 'auto' },
  };
}

export interface Monster {
  id: number;
  def: MonsterDef;
  hp: Decimal;
  max: Decimal;
  boss: boolean;
  /** Where it stands in the chamber (world units). */
  x: number;
  z: number;
  /** Seconds until it reaches its spot; companions only hit monsters that have arrived. */
  arrive: number;
  /** Boss modifiers. */
  mods: ModId[];
  /** One half of a boss that split. */
  half?: boolean;
  /** A champion: tougher, glowing, and full of gold. */
  champ?: boolean;
  /** A hoarder in the Goblin Vault: doesn't count toward the floor. */
  vault?: boolean;
}

export type HitKind = 'click' | 'crit' | 'dps' | 'cleave' | 'auto' | 'fever';

export type GameEvent =
  | { t: 'hit'; id: number; amount: Decimal; kind: HitKind; x?: number; y?: number }
  | { t: 'click'; crit: boolean; x: number; y: number }
  | { t: 'spawn'; id: number }
  | { t: 'kill'; id: number; gold: Decimal; boss: boolean; by: HitKind; champ?: boolean }
  | { t: 'floor'; floor: number; boss: boolean; cleared?: boolean }
  | { t: 'sweep'; floor: number; gold: Decimal }
  | { t: 'bossFail'; floor: number }
  | { t: 'bossWin'; floor: number; first: boolean; clutch?: { left: number; gold: Decimal } }
  | { t: 'souls'; id: number; floor: number; souls: number }
  | { t: 'retreat'; floor: number }
  | { t: 'buyComp'; comp: number; n: number }
  | { t: 'reveal'; comp: number }
  | { t: 'buyUpg'; id: string }
  | { t: 'trophy'; id: string }
  | { t: 'raidSpawn'; id: number; from: -1 | 1; rainbow: boolean }
  | { t: 'rampage'; tier: number; click: number }
  | { t: 'vault'; on: boolean; gold: Decimal }
  | { t: 'raidCatch'; id: number; reward: RaidReward; amount?: Decimal; buff?: Buff }
  | { t: 'raidEscape'; id: number }
  | { t: 'fever'; on: boolean }
  | { t: 'descend'; souls: number }
  | { t: 'abyss'; id: string }
  | { t: 'relic'; id: string; lv: number; floor: number; equipped: boolean; star: number }
  | { t: 'split'; id: number; into: [number, number] }
  | { t: 'heal'; id: number; amount: Decimal }
  | { t: 'awaken'; stones: number }
  | { t: 'heart'; id: string; lv: number }
  /** `src`: dropped by a monster just killed, on a swept floor (no body to drop from), or by a goblin caught. */
  | { t: 'card'; id: string; gold: boolean; count: number; first: boolean; src: 'kill' | 'sweep' | 'raid'; kill: number };

/** Every multiplier behind the damage, crit and gold numbers, kept apart for the stats page. */
export interface Parts {
  /** Per companion: tier upgrades and synergies. */
  tier: number[];
  syn: number[];
  twin: number;
  whet: number;
  blades: number;
  upgrades: number;
  trophies: number;
  souls: number;
  shard: number;
  fury: Decimal;
  banner: number;
  clickDps: number;
  clickDpsUpg: number;
  oath: number;
  critBase: number;
  critUpg: number;
  critRelic: number;
  critMultBase: number;
  critMultUpg: number;
  critMultRelic: number;
  cleaveUpg: number;
  cleaveRelic: number;
  goldUpg: number;
  goldRelic: number;
}

interface Computed {
  dps: Decimal;
  perComp: Decimal[];
  /** Per companion before the all-damage bonuses. */
  baseComp: number[];
  parts: Parts;
  /** Product of the all-damage bonuses (upgrades, trophies, souls, shard, fury). */
  all: Decimal;
  click: Decimal;
  crit: number;
  critMult: number;
  cleave: number;
  gold: number;
}

export interface Raid {
  id: number;
  from: -1 | 1;
  /** 0..1 across the chamber. */
  t: number;
  stay: number;
  rainbow: boolean;
}

export interface OfflineSummary {
  seconds: number;
  gold: Decimal;
  kills: number;
  /** Share of full speed: 1 when the tab stayed open, the offline rate when it was closed. */
  pct: number;
  /** New deepest floor reached while away, if any. */
  floor?: number;
  /** Cards found while away (the same odds as at the keyboard; champions don't turn up, so no gold ones). */
  cards: Extract<GameEvent, { t: 'card' }>[];
}

/** Health of an ordinary monster on a floor (the classic clicker curve). */
export function floorHp(f: number): Decimal {
  if (f <= 140) return new Decimal(10 * (f - 1 + 1.55 ** (f - 1)));
  return floorHp(140).times(Decimal.pow(TUNE.deepHp, f - 140));
}

export function floorGold(f: number): Decimal {
  return Decimal.max(1, floorHp(f).div(15).ceil());
}

export const isBossFloor = (f: number) => f % BOSS_EVERY === 0;

/**
 * The whole game state and rules. Deterministic apart from Math.random (spawns, crits,
 * treasure); the renderer and UI read from it and drain `events` every frame.
 */
export class Game {
  s: SaveState;
  events: GameEvent[] = [];
  monsters: Monster[] = [];
  raid: Raid | null = null;
  /** Seconds left to beat the boss, when one is up. */
  bossTime = 0;
  bossTimeMax = BOSS_TIME;
  private seq = 1;
  private spawnT = 0;
  private sweepT = 0;
  /** Rampage tier (0–2) and clicks landed during this Rampage. */
  rampageTier = 0;
  private rampageClicks = 0;
  /** The floor's monsters wait here while the Goblin Vault is open. */
  private stash: Monster[] = [];
  private vaultOn = false;
  private vaultGold = new Decimal(0);
  /** Seconds since the last kill: too long and your party falls back a floor. */
  private stuckT = 0;
  private owned = new Set<string>();
  private abyssSet = new Set<string>();
  private trophySet = new Set<string>();
  private cache: Computed | null = null;
  private trophyTimer = 0;
  private autoClick = 0;
  /** Seconds until the next attack by hand can land. */
  private manualCd = 0;
  /** Held down on the battlefield (mouse, finger or Space): attack by hand at MANUAL_RATE until let go. */
  hold: { id: number | null; x: number; y: number } | null = null;
  /** Testing only (?relics=always): every boss drops a relic, every time. */
  debugRelics = false;
  /** Testing only (?cards=often): cards drop hundreds of times as often, and champion bosses are common. */
  debugCards = false;
  private sinceClick = 99;
  /** DPS damage waiting to be shown as numbers, per monster. */
  private dpsShown = new Map<number, Decimal>();
  private healShown = new Map<number, Decimal>();
  private dpsFlush = 0;
  /** Recent kills per second, smoothed, for the stats. */
  killRate = 0;
  private killAcc = 0;
  private killWindow = 0;

  constructor(s: SaveState) {
    this.s = s;
    // Saves from before awakening existed: the whole history counts as the first cycle.
    if (s.cycleBest === undefined) s.cycleBest = s.bestFloor ?? 1;
    if (s.bestCleared === undefined) s.bestCleared = (s.bestFloor ?? 1) - 1;
    // Souls used to be paid for depth at descent time; carry what this descent was worth over.
    if (s.runSouls === undefined) s.runSouls = Math.floor(10 * 1.1 ** (Math.min(s.maxFloor ?? 1, 90) - 30) * 1.04 ** Math.max(0, (s.maxFloor ?? 1) - 90));
    // Auto-hire (the Quartermaster Heart power) is gone; whoever bought it gets the heartstones back.
    if (s.heart?.quarter) {
      s.stones = (s.stones ?? 0) + 4;
      delete s.heart.quarter;
    }
    // Before Rainbow Hauls, every rainbow goblin caught opened the vault.
    if (s.rainbows === undefined) s.rainbows = s.vaults ?? 0;
    if (s.rainbowSeen === undefined) s.rainbowSeen = (s.rainbows ?? 0) > 0;
    // Trophies that no longer exist (retired ones) shouldn't keep counting toward the trophy bonus.
    if (s.trophies) s.trophies = s.trophies.filter((id) => TROPHIES.some((t) => t.id === id));
    const fresh = newSave();
    for (const k of Object.keys(fresh) as (keyof SaveState)[]) if (s[k] === undefined) (s as unknown as Record<string, unknown>)[k] = fresh[k];
    s.settings = { ...fresh.settings, ...s.settings };
    // Saved as plain numbers (older saves) or strings (Decimal's JSON form).
    for (const k of ['gold', 'runGold', 'totalGold', 'failDps', 'bestDps'] as const) s[k] = new Decimal(s[k] ?? 0);
    while (s.owned.length < COMPS.length) s.owned.push(0);
    this.owned = new Set(s.upgrades);
    this.abyssSet = new Set(s.abyss);
    this.trophySet = new Set(s.trophies);
    this.enterFloor(s.floor, true);
  }

  // ---------- lookups ----------

  hasUpg(id: string) {
    return this.owned.has(id);
  }

  hasAbyss(id: string) {
    return this.abyssSet.has(id);
  }

  hasTrophy(id: string) {
    return this.trophySet.has(id);
  }

  invalidate() {
    this.cache = null;
  }

  private effects(): Effect[] {
    const out: Effect[] = [];
    for (const id of this.s.upgrades) {
      const u = UPG_BY_ID.get(id);
      if (u) out.push(u.effect);
    }
    return out;
  }

  heartLv(id: string) {
    return this.s.heart[id] ?? 0;
  }

  relicLv(id: string) {
    return this.s.relics[id] ?? 0;
  }

  relicSlots() {
    return 3 + this.heartLv('hoard');
  }

  /** Level of the equipped relic with this effect (0 if none is slotted). */
  relic(e: RelicEffect) {
    let lv = 0;
    for (const id of this.s.equipped) {
      const d = RELIC_BY_ID.get(id);
      if (d && d.effect === e) lv += relicPower(this.relicLv(id));
    }
    return lv;
  }

  /** How much of a boss modifier's bite is left after Warden's Bane (1 → 0.25). */
  modBite() {
    return 1 - 0.25 * this.heartLv('bane');
  }

  soulPower() {
    return this.hasAbyss('crown') ? 0.04 : this.hasAbyss('roots') ? 0.03 : 0.02;
  }

  soulMult() {
    return 1 + this.s.souls * this.soulPower();
  }

  trophyMult() {
    const n = this.s.trophies.length;
    let m = 1 + n * 0.01;
    for (const e of this.effects()) if (e.t === 'trophy') m *= 1 + n * e.k;
    return m;
  }

  private compute() {
    const s = this.s;
    const effects = this.effects();
    const tier = COMPS.map(() => 1);
    const syn = COMPS.map(() => 1);
    const twin = this.hasAbyss('twin') ? 2 : 1;
    const whet = 1 + this.relic('click');
    let blades = 1;
    let clickDpsUpg = 0;
    let global = 0;
    let gold = 0;
    let critUpg = 0;
    let critMultUpg = 1;
    let cleaveUpg = 0;
    for (const e of effects) {
      if (e.t === 'comp') tier[e.comp] *= e.mult;
      else if (e.t === 'click') blades *= e.mult;
      else if (e.t === 'clickDps') clickDpsUpg += e.pct;
      else if (e.t === 'global') global += e.pct;
      else if (e.t === 'gold') gold += e.pct;
      else if (e.t === 'crit') {
        if (e.chance) critUpg += e.chance;
        if (e.mult) critMultUpg *= e.mult;
      } else if (e.t === 'cleave') cleaveUpg += e.pct;
      else if (e.t === 'syn') {
        syn[e.a] *= 1 + 0.05 * s.owned[e.b];
        syn[e.b] *= 1 + 0.01 * s.owned[e.a];
      }
    }
    // Every multiplier, kept apart so the stats page can show where the numbers come from.
    const parts: Parts = {
      tier, syn, twin, whet, blades,
      upgrades: 1 + global,
      trophies: this.trophyMult(),
      souls: this.soulMult(),
      shard: 1 + this.relic('all'),
      fury: Decimal.pow(TUNE.fury, this.heartLv('fury')),
      banner: 1 + 0.5 * this.relic('party'),
      clickDps: CLICK_DPS + clickDpsUpg + 0.1 * this.relic('oath'),
      clickDpsUpg, oath: 0.1 * this.relic('oath'),
      critBase: BASE_CRIT, critUpg, critRelic: Math.min(0.3, 0.02 * this.relic('critChance')),
      critMultBase: BASE_CRIT_MULT, critMultUpg, critMultRelic: 1 + 0.5 * this.relic('critMult'),
      cleaveUpg, cleaveRelic: 0.2 * this.relic('cleave'),
      goldUpg: 1 + gold, goldRelic: 1 + 0.5 * this.relic('gold'),
    };
    const all = parts.fury.times(parts.upgrades * parts.trophies * parts.souls * parts.shard);
    const baseComp = COMPS.map((c, i) => c.dps * s.owned[i] * tier[i] * syn[i]);
    const perComp = baseComp.map((b) => all.times(b * parts.banner));
    const dps = perComp.reduce((a, b) => a.plus(b), new Decimal(0));
    const click = all.times(twin * whet * blades).plus(dps.times(parts.clickDps));
    this.cache = {
      dps, perComp, baseComp, parts, all, click,
      crit: parts.critBase + parts.critUpg + parts.critRelic,
      critMult: parts.critMultBase * parts.critMultUpg * parts.critMultRelic,
      cleave: parts.cleaveUpg + parts.cleaveRelic,
      gold: parts.goldUpg * parts.goldRelic,
    };
    return this.cache;
  }

  /** The pieces behind every number (for the stats page). */
  breakdown() {
    return { ...this.c, buffDps: this.buffMult('dps'), buffClick: this.buffMult('click'), buffGold: this.buffMult('gold') };
  }

  private get c() {
    return this.cache ?? this.compute();
  }

  private buffMult(k: 'dps' | 'click' | 'gold') {
    return this.s.buffs.reduce((m, b) => m * b[k], 1);
  }

  /** Companion damage per second before temporary buffs. */
  baseDps() {
    return this.c.dps;
  }

  dps() {
    return this.c.dps.times(this.buffMult('dps'));
  }

  compDps(i: number) {
    return this.c.perComp[i];
  }

  /** Damage one more level of this companion would add (before buffs). A companion's damage is linear in its own level. */
  compNext(i: number) {
    const c = this.c;
    return c.all.times(COMPS[i].dps * c.parts.tier[i] * c.parts.syn[i] * c.parts.banner);
  }

  clickDamage() {
    return this.c.click.times(this.buffMult('click'));
  }

  critChance() {
    return this.c.crit;
  }

  critMult() {
    return this.c.critMult;
  }

  cleave() {
    return this.c.cleave;
  }

  goldMult() {
    return this.c.gold * this.buffMult('gold');
  }

  feverMult() {
    return 5 * RAMPAGE_TIERS[this.rampageTier].click;
  }

  /** How much harder the party hits during a Rampage on top of its tier: the Unstoppable upgrade and the Blood Drum. */
  rampageParty() {
    let p = 1 + 0.25 * this.relic('rampage');
    for (const e of this.effects()) if (e.t === 'fever' && e.power) p *= e.power;
    return p;
  }

  /** Clicks still needed for the next Rampage tier and the click multiplier it brings (null at the top tier). */
  rampageNext(): { left: number; mult: number } | null {
    if (this.rampageTier >= RAMPAGE_STEPS.length) return null;
    return { left: RAMPAGE_STEPS[this.rampageTier] - this.rampageClicks, mult: 5 * RAMPAGE_TIERS[this.rampageTier + 1].click };
  }

  inVault() {
    return this.s.buffs.some((b) => b.id === 'vault');
  }

  monsterGold(m: Monster) {
    const k = m.boss ? 8 * (m.champ ? CHAMP_BOSS_GOLD : 1) : TRASH * (m.champ ? CHAMP_GOLD : m.vault ? VAULT_GOLD : 1);
    return Decimal.max(1, floorGold(this.s.floor).times(k)).times(this.goldMult()).ceil();
  }

  // ---------- costs ----------

  private compBase(i: number) {
    return COMPS[i].cost * (this.hasAbyss('tithe') ? 0.9 : 1);
  }

  compCost(i: number, n = 1) {
    const k = this.s.owned[i];
    return Decimal.pow(COST_GROWTH, k).times(Decimal.pow(COST_GROWTH, n).minus(1)).times(this.compBase(i) / (COST_GROWTH - 1)).ceil();
  }

  compQuote(i: number): { n: number; cost: Decimal } {
    const mode = this.s.settings.buyMode;
    if (mode > 0) return { n: mode, cost: this.compCost(i, mode) };
    const base = Decimal.pow(COST_GROWTH, this.s.owned[i]).times(this.compBase(i));
    // Most levels affordable: solve base × (g^n − 1) / (g − 1) ≤ gold for n.
    const n = Math.max(1, Math.floor(this.s.gold.times(COST_GROWTH - 1).div(base).plus(1).log10() / Math.log10(COST_GROWTH)));
    return { n, cost: this.compCost(i, n) };
  }

  upgCost(u: UpgDef) {
    return u.cost * (this.hasAbyss('bargain') ? 0.9 : 1);
  }

  compUnlocked(i: number) {
    return this.s.descents >= COMPS[i].depth && this.s.awakens >= (COMPS[i].heart ?? 0);
  }

  // ---------- floors and monsters ----------

  /** Move to a floor. `cleared`: because the last one was just cleared (the UI and scene make a moment of it). */
  private enterFloor(f: number, quiet = false, cleared = false, bossDelay = 0) {
    this.s.floor = f;
    this.s.floorKills = 0;
    this.stuckT = 0;
    this.monsters = [];
    this.spawnT = 0.3;
    this.bossTime = 0;
    this.stash = [];
    // During the Goblin Vault the boss waits until the vault closes.
    if (bossDelay) this.spawnT = bossDelay;
    else if (isBossFloor(f) && !this.inVault()) this.spawnBoss();
    if (!quiet) this.events.push({ t: 'floor', floor: f, boss: isBossFloor(f), cleared });
  }

  /** Go to a floor you've unlocked. */
  goFloor(f: number) {
    if (f < 1 || f > this.s.maxFloor || f === this.s.floor) return false;
    this.enterFloor(f);
    return true;
  }

  setAuto(on: boolean) {
    this.s.auto = on;
    if (on && this.s.floor < this.s.maxFloor) this.enterFloor(this.s.maxFloor);
  }

  bossFloor() {
    return isBossFloor(this.s.floor);
  }

  /** Kills still needed on this floor (0 once cleared). */
  floorLeft() {
    if (this.bossFloor()) return this.monsters.length;
    return Math.max(0, FLOOR_KILLS - this.s.floorKills);
  }

  private spot(big: boolean): { x: number; z: number } {
    let best = { x: 3, z: 0 };
    let bestD = -1;
    for (let k = 0; k < 12; k++) {
      const p = big ? { x: 2.5 + Math.random() * 1.5, z: -0.5 + Math.random() } : { x: -1 + Math.random() * 7.5, z: -2.8 + Math.random() * 5.6 };
      const d = Math.min(99, ...this.monsters.map((m) => Math.hypot(m.x - p.x, (m.z - p.z) * 1.4)));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private spawn() {
    const band = bandFor(this.s.floor);
    const def = band[Math.floor(Math.random() * band.length)];
    const champ = Math.random() < CHAMP_CHANCE;
    const hp = floorHp(this.s.floor).times(def.hp * TRASH * (champ ? CHAMP_HP : 1));
    const m: Monster = { id: this.seq++, def, hp, max: hp, boss: false, arrive: 0.7, mods: [], champ, ...this.spot(false) };
    this.monsters.push(m);
    this.events.push({ t: 'spawn', id: m.id });
  }

  private spawnHoarder() {
    // Health from your own strength only, so a vault pays out in full even on a floor you're stuck on.
    const hp = Decimal.max(this.dps().times(VAULT_HP), this.clickDamage());
    const def = HOARDERS[Math.floor(Math.random() * HOARDERS.length)];
    const m: Monster = { id: this.seq++, def, hp, max: hp, boss: false, arrive: 0.4, mods: [], vault: true, ...this.spot(false) };
    this.monsters.push(m);
    this.events.push({ t: 'spawn', id: m.id });
  }

  /** The rainbow goblin's prize: the floor steps aside and the room fills with hoarders. */
  private openVault() {
    this.s.vaults++;
    // Another rainbow goblin while the vault is open keeps it open longer.
    const open = this.s.buffs.find((b) => b.id === 'vault');
    if (open) {
      open.t += VAULT_TIME;
      open.dur += VAULT_TIME;
      return;
    }
    this.vaultGold = new Decimal(0);
    this.stash = this.monsters;
    this.monsters = [];
    this.spawnT = 0;
    this.addBuff({ id: 'vault', name: 'Goblin Vault', t: VAULT_TIME, dur: VAULT_TIME, dps: 1, click: 1, gold: 1 });
    this.vaultOn = true;
    this.events.push({ t: 'vault', on: true, gold: new Decimal(0) });
  }

  private closeVault() {
    this.vaultOn = false;
    // Hoarders still standing slip away; the floor's own monsters climb back up the stairs.
    this.monsters = this.stash.filter((m) => !m.vault).map((m) => ({ ...m, arrive: m.boss ? 1.5 : 0.7 }));
    this.stash = [];
    this.spawnT = 0.3;
    this.events.push({ t: 'vault', on: false, gold: this.vaultGold });
  }

  /** Modifiers on this floor's boss. */
  bossMods(floor = this.s.floor) {
    return modsFor(floor);
  }

  private spawnBoss() {
    const def = bossFor(this.s.floor);
    const mods = this.bossMods();
    const bite = this.modBite();
    const giant = mods.includes('giant');
    // Zone bosses from floor 30 on are the walls; the first two just teach you what a boss is.
    const zone = this.s.floor % 10 === 0 && this.s.floor >= DESCEND_FLOOR ? TUNE.zoneBoss : 1;
    const first = this.s.floor <= 10 ? 0.5 : 1;
    // Only on a boss floor you've beaten before, so a champion never stands in the way of new ground.
    const champ = this.s.floor < this.s.bestFloor && Math.random() < (this.debugCards ? 0.34 : CHAMP_BOSS_CHANCE);
    const hp = floorHp(this.s.floor).times(8 * zone * first * (giant ? 1 + 2 * bite : 1) * (champ ? CHAMP_BOSS_HP : 1));
    const m: Monster = { id: this.seq++, def, hp, max: hp, boss: true, arrive: 1.5, mods, champ, ...this.spot(true) };
    this.monsters.push(m);
    let time = (this.hasAbyss('patience') ? 45 : BOSS_TIME) + Math.min(30, 3 * this.relic('time'));
    if (mods.includes('enraged')) time *= 1 - 0.5 * bite;
    if (giant || champ) time *= 1.5;
    this.bossTimeMax = time;
    this.bossTime = time;
    this.events.push({ t: 'spawn', id: m.id });
  }

  /** Share of companion damage an armored boss shrugs off. */
  armor() {
    return 0.75 * 0.7 ** this.relic('pierce') * this.modBite();
  }

  /** Share of its health a regenerating boss heals per second. */
  regen() {
    return 0.03 * 0.7 ** this.relic('rot') * this.modBite();
  }

  monster(id: number) {
    return this.monsters.find((m) => m.id === id);
  }

  /** Damage a monster; returns overflow past its death. */
  private damage(m: Monster, amount: Decimal, kind: HitKind, x?: number, y?: number): Decimal {
    if (m.boss) {
      amount = amount.times(1 + this.relic('boss'));
      if (kind === 'dps' && m.mods.includes('armored')) {
        // Overkill passed on from a dead monster keeps its full value; only the boss's share is cut.
        amount = amount.times(1 - this.armor());
      }
    }
    m.hp = m.hp.minus(amount);
    // The number shown is the whole hit, overkill included: one-shotting a weak monster should look like it.
    if (kind === 'dps') this.dpsShown.set(m.id, (this.dpsShown.get(m.id) ?? new Decimal(0)).plus(amount));
    else this.events.push({ t: 'hit', id: m.id, amount, kind, x, y });
    if (m.hp.lte(0)) {
      this.kill(m, kind);
      return m.hp.neg();
    }
    return new Decimal(0);
  }

  private kill(m: Monster, by: HitKind) {
    const i = this.monsters.indexOf(m);
    if (i < 0) return;
    this.monsters.splice(i, 1);
    const shown = this.dpsShown.get(m.id);
    if (shown) {
      // A monster the party kills in one tick shows a whole volley's worth, like the numbers on monsters that last.
      this.events.push({ t: 'hit', id: m.id, amount: Decimal.max(shown, this.dps().times(DPS_SHOWN_EVERY)), kind: 'dps' });
      this.dpsShown.delete(m.id);
    }
    const gold = this.monsterGold(m);
    this.earn(gold);
    this.s.kills++;
    this.killAcc++;
    this.stuckT = 0;
    if (m.champ && !m.half) this.s.champions++;
    this.events.push({ t: 'kill', id: m.id, gold, boss: m.boss, by, champ: m.champ });
    if (m.vault) {
      this.vaultGold = this.vaultGold.plus(gold);
      return;
    }
    if (!m.boss) this.rollCard(this.slay(m.def), !!m.champ, 'kill');
    if (m.boss && m.mods.includes('split') && !m.half) {
      // Two halves climb out of the body; the clock keeps running.
      const frac = 0.5 * this.modBite() + 0.25 * (1 - this.modBite());
      const mods = m.mods.filter((x) => x !== 'split');
      const halves = [-1, 1].map((side): Monster => ({
        id: this.seq++, def: m.def, hp: m.max.times(frac), max: m.max.times(frac), boss: true, half: true, arrive: 0.4, mods, champ: m.champ,
        x: m.x + side * 1.1, z: m.z - side * 1,
      }));
      this.monsters.push(...halves);
      this.events.push({ t: 'split', id: m.id, into: [halves[0].id, halves[1].id] });
      for (const h of halves) this.events.push({ t: 'spawn', id: h.id });
      return;
    }
    if (m.boss && this.monsters.some((x) => x.boss)) return;
    if (m.boss) {
      // Only a boss beaten for the first time this run drops a relic, pays souls or counts toward trophies, so going
      // back to farm one doesn't.
      const firstWin = this.s.floor >= this.s.maxFloor;
      if (firstWin) this.s.bosses++;
      const firstClear = this.s.floor > this.s.bestCleared;
      let clutch: { left: number; gold: Decimal } | undefined;
      if (this.bossTime > 0 && this.bossTime <= CLUTCH_SECONDS) {
        const bonus = gold.times(CLUTCH_GOLD - 1);
        this.earn(bonus);
        if (firstWin) this.s.clutches++;
        clutch = { left: this.bossTime, gold: bonus };
      }
      this.bossTime = 0;
      this.unlockNext();
      this.events.push({ t: 'bossWin', floor: this.s.floor, first: firstClear, clutch });
      this.rollCard(this.slay(m.def), !!m.champ, 'kill', true);
      // Each boss pays its souls once a descent: farming its floor afterwards doesn't.
      const souls = firstWin ? this.bossSouls(this.s.floor) : 0;
      if (souls > 0) {
        this.s.runSouls += souls;
        this.events.push({ t: 'souls', id: m.id, floor: this.s.floor, souls });
      }
      if (firstWin || this.debugRelics) this.rollRelic(this.s.floor);
      if (this.s.auto) this.enterFloor(this.s.floor + 1);
      else this.enterFloor(this.s.floor, false, false, BOSS_RESPAWN);
    } else if (!this.bossFloor()) {
      this.s.floorKills++;
      if (this.s.floorKills >= FLOOR_KILLS) {
        this.unlockNext();
        if (this.s.auto && this.s.floor + 1 <= this.s.maxFloor) this.enterFloor(this.s.floor + 1, false, true);
      }
    }
  }

  /** Strong enough to clear what's left of this floor at once (the toughest monster type counts for all of them).
   *  Only while auto-advancing: with auto off you're staying to farm the floor (and a reload, which restarts its kill
   *  count, shouldn't sweep it again for free). */
  private canSweep() {
    if (!this.s.auto || this.bossFloor() || this.s.floorKills >= FLOOR_KILLS) return false;
    const toughest = Math.max(...bandFor(this.s.floor).map((d) => d.hp));
    return this.dps().times(SWEEP_SECONDS).gte(floorHp(this.s.floor).times(this.floorLeft() * toughest * TRASH));
  }

  /** Clear the floor in one go: monsters on the field die as usual, the rest are paid out as if they had. */
  private sweep() {
    const s = this.s;
    const floor = s.floor;
    this.sweepT = SWEEP_GAP;
    for (const m of [...this.monsters]) {
      if (s.floor !== floor) return;
      this.kill(m, 'dps');
    }
    if (s.floor !== floor || s.floorKills >= FLOOR_KILLS) return;
    const left = FLOOR_KILLS - s.floorKills;
    const band = bandFor(floor);
    for (let k = 0; k < left; k++) this.rollCard(this.slay(band[Math.floor(Math.random() * band.length)]), false, 'sweep');
    const gold = Decimal.max(1, floorGold(floor).times(TRASH)).times(this.goldMult()).ceil().times(left);
    this.earn(gold);
    s.kills += left;
    this.killAcc += left;
    s.floorKills = FLOOR_KILLS;
    this.events.push({ t: 'sweep', floor, gold });
    this.unlockNext();
    // (A sweep announces itself, so it doesn't count as a 'cleared' floor change.)
    if (s.auto && floor + 1 <= s.maxFloor) this.enterFloor(floor + 1);
  }

  private unlockNext() {
    const s = this.s;
    s.bestCleared = Math.max(s.bestCleared, s.floor);
    s.cycleBest = Math.max(s.cycleBest, s.floor + 1);
    if (s.floor + 1 > s.maxFloor) {
      s.maxFloor = s.floor + 1;
      s.bestFloor = Math.max(s.bestFloor, s.maxFloor);
    }
  }

  /** The monster your companions are hitting: the one that's been around longest. */
  focus(): Monster | undefined {
    return this.monsters.find((m) => m.arrive <= 0);
  }

  /** Click a monster (or, if it's gone, whatever's in front). `x, y` are screen coords for numbers. */
  click(id: number | null, x: number, y: number, auto = false) {
    const target = (id !== null ? this.monster(id) : undefined) ?? this.focus();
    if (!target) return new Decimal(0);
    if (!auto) {
      if (this.manualCd > 0) return new Decimal(0);
      this.manualCd = 1 / MANUAL_RATE;
    }
    const crit = !auto && Math.random() < this.critChance();
    const fever = this.s.buffs.some((b) => b.id === 'fever');
    let amount = this.clickDamage().times(crit ? this.critMult() : 1);
    if (fever) amount = amount.times(this.feverMult());
    const others = this.cleave() > 0 ? this.monsters.filter((m) => m !== target) : [];
    this.damage(target, amount, auto ? 'auto' : crit ? 'crit' : fever ? 'fever' : 'click', x, y);
    for (const m of others) if (this.monsters.includes(m)) this.damage(m, amount.times(this.cleave()), 'cleave');
    if (!auto) {
      this.s.clicks++;
      if (crit) this.s.crits++;
      this.sinceClick = 0;
      this.events.push({ t: 'click', crit, x, y });
      if (fever) this.pushRampage();
      else {
        let fill = 1 / FEVER_CLICKS;
        for (const e of this.effects()) if (e.t === 'fever' && e.fill) fill *= e.fill;
        if (this.hasAbyss('dreams')) fill *= 1.5;
        this.s.fervor = Math.min(1, this.s.fervor + fill);
        if (this.s.fervor >= 1) this.startFever();
      }
    }
    return amount;
  }

  /** Your hero: the companion you picked, or the first one you hired if that one's gone. -1 for none (before your
   *  first hire, or when you've chosen to go without). */
  heroIndex() {
    if (this.s.hero < 0) return -1;
    if (this.s.owned[this.s.hero] > 0) return this.s.hero;
    return this.s.owned.findIndex((n) => n > 0);
  }

  /** Pick a companion as your hero; picking the one you already have means no hero at all. */
  setHero(i: number) {
    if (this.heroIndex() === i) {
      this.s.hero = -1;
      return true;
    }
    if (this.s.owned[i] === 0) return false;
    this.s.hero = i;
    return true;
  }

  /** Phantom Blade attacks a second: a slow start, faster with shop upgrades, Abyss powers and the Phantom Hilt. */
  autoRate() {
    let rate = AUTO_BASE + (this.hasAbyss('hands') ? 1 : 0) + (this.hasAbyss('hands2') ? 3 : 0) + 0.5 * this.relic('phantom');
    for (const e of this.effects()) if (e.t === 'auto') rate += e.add;
    return rate;
  }

  /** Keep attacking through a Rampage and it climbs from ×5 clicks to ×10, with more party damage and a little more time. */
  private pushRampage() {
    if (this.rampageTier >= RAMPAGE_STEPS.length) return;
    if (++this.rampageClicks < RAMPAGE_STEPS[this.rampageTier]) return;
    this.rampageTier++;
    const b = this.s.buffs.find((x) => x.id === 'fever');
    if (b) {
      b.dps = RAMPAGE_TIERS[this.rampageTier].dps * this.rampageParty();
      b.t += RAMPAGE_EXTEND;
      b.dur += RAMPAGE_EXTEND;
    }
    this.s.rampage = Math.max(this.s.rampage, this.rampageTier);
    this.invalidate();
    this.events.push({ t: 'rampage', tier: this.rampageTier, click: this.feverMult() });
  }

  private startFever() {
    this.rampageTier = 0;
    this.rampageClicks = 0;
    let dur = FEVER_TIME;
    for (const e of this.effects()) if (e.t === 'fever' && e.dur) dur *= e.dur;
    if (this.hasAbyss('dreams')) dur *= 1.5;
    this.s.fevers++;
    this.addBuff({ id: 'fever', name: 'Rampage', t: dur, dur, dps: RAMPAGE_TIERS[0].dps * this.rampageParty(), click: 1, gold: 1 });
    this.events.push({ t: 'fever', on: true });
  }

  private addBuff(b: Buff) {
    const old = this.s.buffs.findIndex((x) => x.id === b.id);
    if (old >= 0) this.s.buffs.splice(old, 1);
    this.s.buffs.push(b);
    this.invalidate();
  }

  // ---------- shop ----------

  buyComp(i: number) {
    if (!this.compUnlocked(i)) return false;
    const { n, cost } = this.compQuote(i);
    if (this.s.gold.lt(cost)) return false;
    this.s.gold = this.s.gold.minus(cost);
    this.s.owned[i] += n;
    this.invalidate();
    this.events.push({ t: 'buyComp', comp: i, n });
    return true;
  }

  buyUpg(id: string) {
    const u = UPG_BY_ID.get(id);
    if (!u || this.owned.has(id)) return false;
    const cost = this.upgCost(u);
    if (this.s.gold.lt(cost)) return false;
    this.s.gold = this.s.gold.minus(cost);
    this.s.upgrades.push(id);
    this.owned.add(id);
    this.invalidate();
    this.events.push({ t: 'buyUpg', id });
    return true;
  }

  private reqMet(r: Req): boolean {
    const s = this.s;
    switch (r.t) {
      case 'owned': return s.owned[r.comp] >= r.n;
      case 'owned2': return s.owned[r.a] >= r.n && s.owned[r.b] >= r.n;
      case 'floor': return s.maxFloor >= r.n;
      case 'raids': return s.raids >= r.n;
      case 'trophies': return s.trophies.length >= r.n;
      case 'fevers': return s.fevers >= r.n;
    }
  }

  shopUpgrades(): UpgDef[] {
    return UPGRADES.filter((u) => !this.owned.has(u.id) && this.reqMet(u.req)).sort((a, b) => a.cost - b.cost);
  }

  // ---------- treasure goblins ----------

  catchRaid(): boolean {
    const r = this.raid;
    if (!r) return false;
    this.raid = null;
    this.s.raids++;
    if (r.rainbow) this.s.rainbows++;
    if (this.cardRoll(r.rainbow ? CARD_ODDS.rainbow : CARD_ODDS.goblin)) this.giveCard(r.rainbow ? RAINBOW_CARD : GOBLIN_CARD, false, 'raid');
    if (r.rainbow && (this.s.vaults === 0 || Math.random() < VAULT_CHANCE)) {
      this.events.push({ t: 'raidCatch', id: r.id, reward: 'vault' });
      this.openVault();
      this.scheduleRaid();
      return true;
    }
    if (r.rainbow) {
      const amount = floorGold(this.s.floor).times(this.goldMult() * RAINBOW_HAUL * (10 + Math.random() * 10));
      this.earn(amount);
      this.events.push({ t: 'raidCatch', id: r.id, reward: 'rainbow', amount });
      this.scheduleRaid();
      return true;
    }
    const reward = this.rollReward();
    let effect = 1;
    for (const e of this.effects()) if (e.t === 'raid' && e.effect) effect *= e.effect;
    const ev: GameEvent = { t: 'raidCatch', id: r.id, reward };
    if (reward === 'plunder') {
      // One to two floors' worth of kills: a nice haul, not a reason to stop playing and wait for goblins.
      const amount = floorGold(this.s.floor).times(this.goldMult() * (10 + Math.random() * 10));
      this.earn(amount);
      ev.amount = amount;
    } else {
      const b = this.rewardBuff(reward, effect);
      this.addBuff(b);
      ev.buff = b;
    }
    this.events.push(ev);
    this.scheduleRaid();
    return true;
  }

  private rollReward(): RaidReward {
    if (this.hasAbyss('mimic') && Math.random() < 0.06) return 'soulstorm';
    const r = Math.random();
    if (r < 0.4) return 'plunder';
    if (r < 0.65) return 'bloodlust';
    if (r < 0.85) return 'heartstorm';
    return 'horde';
  }

  private rewardBuff(reward: RaidReward, effect: number): Buff {
    const b = (id: Buff['id'], name: string, t: number, dps: number, click: number, gold: number): Buff => ({ id, name, t: t * effect, dur: t * effect, dps, click, gold });
    switch (reward) {
      case 'bloodlust': return b('bloodlust', 'Bloodlust', 30, 7, 1, 1);
      case 'heartstorm': return b('heartstorm', 'Frenzy', 10, 1, 77, 1);
      case 'soulstorm': return b('soulstorm', 'Soul Storm', 6, 666, 666, 1);
      default: return b('horde', 'Gold Rush', 30, 1, 1, 7);
    }
  }

  private scheduleRaid() {
    let f = (this.hasAbyss('lure') ? 1.25 : 1) * (1 + 0.3 * this.relic('goblin'));
    for (const e of this.effects()) if (e.t === 'raid' && e.freq) f *= e.freq;
    this.s.raidTimer = (RAID_MIN + Math.random() * (RAID_MAX - RAID_MIN)) / f;
  }

  private spawnRaid() {
    const from = Math.random() < 0.5 ? -1 : 1;
    // Your first goblin is always an ordinary one; rainbows only turn up once you know what to do with a goblin.
    const rainbow = this.s.raids > 0 && Math.random() < RAINBOW_CHANCE;
    // The first rainbow goblin lingers, so it's caught (and the vault seen) rather than missed.
    const stay = rainbow && this.s.vaults === 0 ? RAID_STAY * 1.8 : RAID_STAY;
    this.raid = { id: this.seq++, from, t: 0, stay, rainbow };
    if (rainbow) this.s.rainbowSeen = true;
    this.events.push({ t: 'raidSpawn', id: this.raid.id, from, rainbow });
  }

  // ---------- prestige ----------

  /** Souls a zone boss on this floor pays when beaten (before relics and Heart powers). */
  baseBossSouls(floor: number) {
    if (floor % 10 !== 0) return 0;
    if (floor < DESCEND_FLOOR) return floor === 0 ? 0 : TUNE.earlySouls[floor / 10 - 1];
    const early = Math.min(floor, TUNE.soulTaper) - DESCEND_FLOOR;
    const late = Math.max(0, floor - TUNE.soulTaper);
    return Math.floor(TUNE.bossSouls * SOUL_GROWTH ** early * TUNE.soulLate ** late);
  }

  soulGainMult() {
    return (1 + 0.15 * this.relic('souls')) * (1 + this.heartLv('siphon'));
  }

  bossSouls(floor: number) {
    return Math.floor(this.baseBossSouls(floor) * this.soulGainMult());
  }

  /** Souls a descent would pay right now: everything banked from bosses this descent. */
  pendingSouls() {
    return this.s.runSouls;
  }

  /** The way down opens at the floor 30 boss the first time; after that you can always go. */
  descendOpen() {
    return this.s.descents > 0 || this.s.maxFloor >= DESCEND_FLOOR;
  }

  /** The next zone boss you haven't beaten this descent, and what it pays. */
  nextBossSouls() {
    const floor = Math.max(10, Math.ceil(this.s.maxFloor / 10) * 10);
    return { floor, souls: this.bossSouls(floor) };
  }

  canDescend() {
    return this.descendOpen() && this.pendingSouls() >= 1;
  }

  descend() {
    if (!this.canDescend()) return false;
    const gained = this.pendingSouls();
    this.s.souls += gained;
    this.s.runSouls = 0;
    this.s.descents++;
    this.resetRun();
    this.events.push({ t: 'descend', souls: gained });
    return true;
  }

  /** Back to the top: gold, companions and upgrades go; souls, relics and trophies stay. */
  private resetRun() {
    const s = this.s;
    s.gold = new Decimal(0);
    s.runGold = new Decimal(0);
    s.owned = COMPS.map(() => 0);
    s.upgrades = [];
    s.buffs = [];
    s.fervor = 0;
    this.stash = [];
    this.vaultOn = false;
    this.rampageTier = 0;
    s.revealed = 0;
    s.runTime = 0;
    s.failDps = new Decimal(0);
    s.auto = true;
    this.owned.clear();
    this.raid = null;
    this.scheduleRaid();
    const start = this.hasAbyss('skip') ? 10 : 1;
    s.maxFloor = start;
    this.applyStartingParty();
    this.invalidate();
    this.enterFloor(start, true);
  }

  private applyStartingParty() {
    if (!this.hasAbyss('heirloom')) return;
    this.s.owned[0] = Math.max(this.s.owned[0], 10);
    this.s.owned[1] = Math.max(this.s.owned[1], 10);
  }

  soulsFree() {
    return this.s.souls - this.s.spentSouls;
  }

  abyssAvailable(id: string) {
    const a = ABYSS_BY_ID.get(id);
    return !!a && !this.abyssSet.has(id) && (a.needs ?? []).every((n) => this.abyssSet.has(n));
  }

  buyAbyss(id: string) {
    const a = ABYSS_BY_ID.get(id);
    if (!a || !this.abyssAvailable(id) || this.soulsFree() < a.cost) return false;
    this.s.spentSouls += a.cost;
    this.s.abyss.push(id);
    this.abyssSet.add(id);
    if (id === 'heirloom') this.applyStartingParty();
    this.invalidate();
    this.events.push({ t: 'abyss', id });
    return true;
  }

  // ---------- relics ----------

  /** Chance a boss on this floor drops a relic (a new deepest zone boss always does). */
  relicChance(floor: number) {
    if (this.debugRelics) return 1;
    if (floor % 10 === 0 && floor > this.s.bossBest) return 1;
    return Math.min(1, (floor % 10 === 0 ? 0.25 : 0.08) * (1 + 0.5 * this.heartLv('hunter')));
  }

  private rollRelic(floor: number) {
    const chance = this.relicChance(floor);
    this.s.bossBest = Math.max(this.s.bossBest, floor);
    if (Math.random() >= chance) return;
    // Rarer relics get likelier the deeper you are.
    const w = [55, 28, 13 + floor / 20, 3 + floor / 25];
    let roll = Math.random() * w.reduce((a, b) => a + b, 0);
    let rar = 0;
    while (rar < 3 && roll >= w[rar]) roll -= w[rar++];
    const pool = RELICS.filter((x) => x.rarity === rar);
    const def = pool[Math.floor(Math.random() * pool.length)];
    this.giveRelic(def.id, floor);
  }

  giveRelic(id: string, floor = this.s.floor) {
    const lv = this.relicLv(id) + 1;
    this.s.relics[id] = lv;
    const equipped = this.s.equipped.includes(id);
    this.invalidate();
    // A new star on this level up (0 if none).
    const star = relicStars(lv) > relicStars(lv - 1) ? relicStars(lv) : 0;
    this.events.push({ t: 'relic', id, lv, floor, equipped, star });
  }

  /** Put a relic in a slot or take it out. Returns false when all slots are full. */
  toggleRelic(id: string) {
    const s = this.s;
    const i = s.equipped.indexOf(id);
    if (i >= 0) s.equipped.splice(i, 1);
    else if (this.relicLv(id) > 0 && s.equipped.length < this.relicSlots()) s.equipped.push(id);
    else return false;
    this.invalidate();
    return true;
  }

  relicsFound() {
    return RELICS.filter((x) => this.relicLv(x.id) > 0).length;
  }

  rarityName(id: string) {
    return RARITY[RELIC_BY_ID.get(id)!.rarity];
  }

  // ---------- the heart ----------

  canAwaken() {
    return this.pendingStones() >= 1;
  }

  /** Heartstones an awakening would pay: grows with the deepest floor since the last one. */
  stonesFor(floor: number) {
    return floor < AWAKEN_FLOOR ? 0 : Math.floor(TUNE.stoneBase * TUNE.stoneGrowth ** (floor - AWAKEN_FLOOR));
  }

  pendingStones() {
    return this.stonesFor(this.s.cycleBest);
  }

  awaken() {
    if (!this.canAwaken()) return false;
    const gained = this.pendingStones();
    const s = this.s;
    s.stones += gained;
    s.awakens++;
    s.cycleBest = 0;
    s.runSouls = 0;
    s.souls = 0;
    s.spentSouls = 0;
    // Echoing Abyss keeps the cheap powers, free.
    s.abyss = this.heartLv('echo') ? s.abyss.filter((id) => ABYSS_BY_ID.get(id)!.cost <= 100) : [];
    this.abyssSet = new Set(s.abyss);
    this.resetRun();
    this.events.push({ t: 'awaken', stones: gained });
    return true;
  }

  heartCost(id: string) {
    const h = HEART_BY_ID.get(id)!;
    return h.cost(this.heartLv(id));
  }

  heartMaxed(id: string) {
    return this.heartLv(id) >= HEART_BY_ID.get(id)!.max;
  }

  buyHeart(id: string) {
    const h = HEART_BY_ID.get(id);
    if (!h || this.heartMaxed(id)) return false;
    const cost = this.heartCost(id);
    if (this.s.stones < cost) return false;
    this.s.stones -= cost;
    this.s.heart[id] = this.heartLv(id) + 1;
    this.invalidate();
    this.events.push({ t: 'heart', id, lv: this.s.heart[id] });
    return true;
  }

  // ---------- cards ----------

  /** Count a kill toward its card's tally; returns the card id. */
  private slay(def: MonsterDef) {
    const id = cardId(def.name);
    this.s.slain[id] = (this.s.slain[id] ?? 0) + 1;
    return id;
  }

  private cardRoll(odds: number) {
    return Math.random() * (this.debugCards ? Math.max(1, odds / 500) : odds) < 1;
  }

  /** A killed monster's chance at its card: champions roll for a gold one first. */
  private rollCard(id: string, champ: boolean, src: 'kill' | 'sweep', boss = false) {
    if (champ && this.cardRoll(boss ? CARD_ODDS.champBoss : CARD_ODDS.champ)) this.giveCard(id, true, src);
    else if (this.cardRoll(boss ? CARD_ODDS.boss : CARD_ODDS.monster)) this.giveCard(id, false, src);
  }

  giveCard(id: string, gold = false, src: 'kill' | 'sweep' | 'raid' = 'kill') {
    const c = (this.s.cards[id] ??= { n: CORRUPTION.map(() => 0), gold: CORRUPTION.map(() => 0) });
    const first = gold ? !this.hasGoldCard(id) : !this.cardCount(id);
    const kill = this.cardKill(id);
    if (first && gold) c.goldAt = kill;
    else if (first) c.at = kill;
    (gold ? c.gold : c.n)[Math.min(lapOf(this.s.floor), CORRUPTION.length - 1)]++;
    this.events.push({ t: 'card', id, gold, count: this.cardCount(id), first, src, kill });
  }

  /** Which kill of this monster it is (for the goblins, which catch). */
  cardKill(id: string) {
    return id === GOBLIN_CARD ? this.s.raids - this.s.rainbows : id === RAINBOW_CARD ? this.s.rainbows : this.s.slain[id] ?? 0;
  }

  /** Have you killed one of this card's monster (for the goblins, caught one)? Until then its card is a mystery. */
  cardMet(id: string) {
    if (id === GOBLIN_CARD) return this.s.raids - this.s.rainbows > 0;
    if (id === RAINBOW_CARD) return this.s.rainbows > 0;
    return (this.s.slain[id] ?? 0) > 0;
  }

  /** Copies of a card owned, plain and gold together. */
  cardCount(id: string) {
    const c = this.s.cards[id];
    return c ? c.n.reduce((a, b) => a + b, 0) + c.gold.reduce((a, b) => a + b, 0) : 0;
  }

  hasGoldCard(id: string) {
    return !!this.s.cards[id]?.gold.some((n) => n > 0);
  }

  cardsFound() {
    return CARDS.filter((c) => this.cardCount(c.id) > 0).length;
  }

  goldCardsFound() {
    return CARDS.filter((c) => this.hasGoldCard(c.id)).length;
  }

  // ---------- trophies ----------

  private trophyMet(r: TrophyReq): boolean {
    const s = this.s;
    switch (r.t) {
      case 'gold': return s.totalGold.gte(r.n);
      case 'floor': return s.bestCleared >= r.n;
      case 'kills': return s.kills >= r.n;
      case 'bosses': return s.bosses >= r.n;
      case 'own': return s.owned[r.comp] >= r.n;
      case 'clicks': return s.clicks >= r.n;
      case 'crits': return s.crits >= r.n;
      case 'raids': return s.raids >= r.n;
      case 'fevers': return s.fevers >= r.n;
      case 'descents': return s.descents >= r.n;
      case 'upgrades': return s.upgrades.length >= r.n;
      case 'dps': return this.baseDps().gte(r.n);
      case 'missed': return s.missed >= r.n;
      case 'relics': return this.relicsFound() >= r.n;
      case 'awakens': return s.awakens >= r.n;
      case 'clutches': return s.clutches >= r.n;
      case 'champions': return s.champions >= r.n;
      case 'vaults': return s.vaults >= r.n;
      case 'rainbows': return s.rainbows >= r.n;
      case 'rampage': return s.rampage >= r.n;
      case 'stars': return Object.values(s.relics).some((lv) => relicStars(lv) >= r.n);
      case 'cards': return this.cardsFound() >= r.n;
      case 'goldCards': return this.goldCardsFound() >= r.n;
    }
  }

  private checkTrophies() {
    let got = false;
    for (const t of TROPHIES) {
      if (this.trophySet.has(t.id) || !this.trophyMet(t.req)) continue;
      this.trophySet.add(t.id);
      this.s.trophies.push(t.id);
      this.events.push({ t: 'trophy', id: t.id });
      got = true;
    }
    if (got) this.invalidate();
  }

  // ---------- time ----------

  private earn(n: Decimal) {
    this.s.gold = this.s.gold.plus(n);
    this.s.runGold = this.s.runGold.plus(n);
    this.s.totalGold = this.s.totalGold.plus(n);
  }

  update(dt: number) {
    const s = this.s;
    s.playTime += dt;
    s.runTime += dt;

    const vault = this.inVault();
    if (this.vaultOn && !vault) this.closeVault();
    this.vaultOn = vault;

    // Keep the field full of monsters (bosses come alone).
    if (vault) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.monsters.length < VAULT_ON) {
        this.spawnHoarder();
        this.spawnT = VAULT_GAP;
      }
    } else if (!this.bossFloor()) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.monsters.length < MAX_ON) {
        this.spawn();
        this.spawnT = SPAWN_GAP;
      }
    } else if (this.monsters.length === 0 && (this.spawnT -= dt) <= 0) this.spawnBoss();

    this.sweepT -= dt;
    if (!vault && this.sweepT <= 0 && this.canSweep()) this.sweep();

    // Companions chew through monsters front to back; overkill carries over.
    for (const m of this.monsters) m.arrive -= dt;
    let dmg = this.dps().times(dt);
    for (let k = 0; k < 20 && dmg.gt(0); k++) {
      const m = this.focus();
      if (!m) break;
      dmg = this.damage(m, dmg, 'dps');
    }

    // Too slow here: fall back to a floor you can farm, and push again once stronger.
    this.stuckT += dt;
    if (!vault && !this.bossFloor() && this.stuckT > 20 && s.floor > 1) {
      this.stuckT = 0;
      s.auto = false;
      s.failDps = this.dps();
      this.events.push({ t: 'retreat', floor: s.floor });
      this.enterFloor(s.floor - 1);
    }

    // Boss timer.
    if (!vault && this.bossFloor() && this.bossTime > 0) {
      this.bossTime -= dt;
      if (this.bossTime <= 0) this.bossFailed();
    }
    // Retry a boss on your own once you're clearly stronger.
    if (!s.auto && s.failDps.gt(0) && this.dps().gte(s.failDps.times(1.5).plus(1))) {
      s.failDps = new Decimal(0);
      this.setAuto(true);
    }

    // Buffs.
    let expired = false;
    for (const b of s.buffs) b.t -= dt;
    for (const b of s.buffs.filter((x) => x.t <= 0)) {
      if (b.id === 'fever') {
        s.fervor = 0;
        this.rampageTier = 0;
        this.rampageClicks = 0;
        this.events.push({ t: 'fever', on: false });
      }
      expired = true;
    }
    if (expired) {
      s.buffs = s.buffs.filter((x) => x.t > 0);
      this.invalidate();
    }

    this.sinceClick += dt;
    if (this.sinceClick > 0.6 && !s.buffs.some((b) => b.id === 'fever')) s.fervor = Math.max(0, s.fervor - dt * 0.12);

    // Regenerating bosses.
    for (const m of this.monsters) {
      if (!m.mods.includes('regen') || m.hp.gte(m.max)) continue;
      const heal = Decimal.min(m.max.minus(m.hp), m.max.times(this.regen() * dt));
      m.hp = m.hp.plus(heal);
      this.healShown.set(m.id, (this.healShown.get(m.id) ?? new Decimal(0)).plus(heal));
    }

    // Phantom Blade.
    // Attacking by hand while held down, then the Phantom Blade on its own.
    this.manualCd = Math.max(0, this.manualCd - dt);
    if (this.hold && this.manualCd <= 0) this.click(this.hold.id, this.hold.x, this.hold.y);
    const rate = this.autoRate();
    if (rate) {
      this.autoClick += dt * rate;
      while (this.autoClick >= 1) {
        this.autoClick--;
        this.click(null, -1, -1, true);
      }
    }

    // Treasure goblins.
    if (this.raid) {
      this.raid.t += dt / this.raid.stay;
      if (this.raid.t >= 1) {
        this.events.push({ t: 'raidEscape', id: this.raid.id });
        this.raid = null;
        s.missed++;
        this.scheduleRaid();
      }
    } else if (s.kills > 15) {
      s.raidTimer -= dt;
      if (s.raidTimer <= 0) this.spawnRaid();
    }

    // Reveal companions as you get close to affording them (once this run's gold reaches REVEAL_AT of their price).
    for (let i = s.revealed; i < COMPS.length; i++) {
      if (!this.compUnlocked(i)) break;
      if (s.owned[i] > 0 || s.runGold.gte(COMPS[i].cost * REVEAL_AT)) {
        s.revealed = i + 1;
        if (i > 0) this.events.push({ t: 'reveal', comp: i });
      } else break;
    }

    // Show companion damage as numbers a few times a second, not every tick.
    this.dpsFlush -= dt;
    if (this.dpsFlush <= 0) {
      this.dpsFlush = DPS_SHOWN_EVERY;
      for (const [id, amount] of this.dpsShown) if (this.monster(id)) this.events.push({ t: 'hit', id, amount, kind: 'dps' });
      this.dpsShown.clear();
      for (const [id, amount] of this.healShown) if (this.monster(id)) this.events.push({ t: 'heal', id, amount });
      this.healShown.clear();
    }

    this.killWindow += dt;
    if (this.killWindow >= 2) {
      this.killRate = this.killRate * 0.5 + (this.killAcc / this.killWindow) * 0.5;
      this.killAcc = 0;
      this.killWindow = 0;
    }

    s.bestDps = Decimal.max(s.bestDps, this.baseDps());
    this.trophyTimer -= dt;
    if (this.trophyTimer <= 0) {
      this.trophyTimer = 0.5;
      this.checkTrophies();
    }
  }

  private bossFailed() {
    const f = this.s.floor;
    this.s.auto = false;
    this.s.failDps = this.dps();
    this.events.push({ t: 'bossFail', floor: f });
    this.enterFloor(Math.max(1, f - 1));
  }

  /**
   * Catch up after time away: your companions farm the floor you were on.
   * Buffs, bosses and treasure don't happen while you're gone.
   */
  applyOffline(seconds: number): OfflineSummary {
    const secs = Math.min(seconds, OFFLINE_CAP);
    const pct = this.hasAbyss('night') ? 1 : this.hasAbyss('pulse') ? 0.5 : 0.25;
    this.s.buffs = this.s.buffs.filter((b) => (b.t -= secs) > 0);
    this.invalidate();
    const f = isBossFloor(this.s.floor) ? Math.max(1, this.s.floor - 1) : this.s.floor;
    const perSec = Math.min(1 / SPAWN_GAP, this.baseDps().div(floorHp(f).times(TRASH)).toNumber());
    const kills = Math.floor(perSec * secs * pct);
    const gold = floorGold(f).times(kills * TRASH * this.c.gold);
    this.earn(gold);
    this.s.kills += kills;
    // Every kill counts toward its monster's card, and rolls for it, as it would have at the keyboard.
    const band = bandFor(f);
    const before = this.events.length;
    for (let k = 0; k < kills; k++) this.rollCard(this.slay(band[Math.floor(Math.random() * band.length)]), false, 'sweep');
    const cards = this.events.slice(before).filter((e): e is Extract<GameEvent, { t: 'card' }> => e.t === 'card');
    this.s.playTime += secs;
    this.s.runTime += secs;
    this.checkTrophies();
    return { seconds: secs, gold, kills, pct, cards };
  }

  abyssList() {
    return ABYSS;
  }
}
