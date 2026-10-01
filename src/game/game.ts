import {
  ABYSS, ABYSS_BY_ID, AWAKEN_FLOOR, COMPS, HEART_BY_ID, RARITY, RELICS, RELIC_BY_ID, TROPHIES, UPGRADES, UPG_BY_ID, bandFor, bossFor, modsFor,
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
/** Ordinary monsters are a fraction of a floor's base health: many small kills. */
const TRASH = 0.4;
/** Every click deals this share of your companions' damage, before upgrades. */
const CLICK_DPS = 0.05;
/** Seconds between treasure goblins: rare enough to be a treat, not the engine of the game. */
const RAID_MIN = 180;
const RAID_MAX = 420;
const RAID_STAY = 10;
const FEVER_TIME = 10;
const FEVER_CLICKS = 60;
const BASE_CRIT = 0.04;
const BASE_CRIT_MULT = 8;
const OFFLINE_CAP = 72 * 3600;
/** The first time, the way down opens when you reach this floor's boss. */
export const DESCEND_FLOOR = 30;
const SOUL_GROWTH = 1.1;
/**
 * Pacing knobs, in one place (the balance script overrides them to search for good values).
 * - Zone bosses pay `bossSouls` souls at floor 30, +10% a floor up to `soulTaper`, then only `soulLate`
 *   a floor: that's the wall. Zone bosses have `zoneBoss`× the health of mid-bosses.
 * - Awakening at floor f pays stoneBase × stoneGrowth^(f − AWAKEN_FLOOR) heartstones.
 * - Heart of Fury multiplies all damage by `fury` per level.
 */
export const TUNE = { soulTaper: 90, soulLate: 1.04, stoneBase: 5, stoneGrowth: 1.02, fury: 10, deepHp: 1.16, bossSouls: 20, zoneBoss: 2 };

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
  /** Quartermaster: buy companions and upgrades automatically. */
  autoBuy: boolean;
}

export interface SaveState {
  v: number;
  gold: number;
  runGold: number;
  totalGold: number;
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
  failDps: number;
  revealed: number;
  bestDps: number;
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
  /** Deepest floor cleared since the last awakening (heartstones are paid for it). */
  cycleBest: number;
  settings: Settings;
}

export function newSave(): SaveState {
  return {
    v: SAVE_VERSION, gold: 0, runGold: 0, totalGold: 0, kills: 0, bosses: 0, clicks: 0, crits: 0,
    owned: COMPS.map(() => 0), upgrades: [], abyss: [], trophies: [], souls: 0, spentSouls: 0,
    descents: 0, raids: 0, missed: 0, fevers: 0, fervor: 0, buffs: [], raidTimer: 40,
    floor: 1, maxFloor: 1, bestFloor: 1, bestCleared: 0, runSouls: 0, floorKills: 0, auto: true, failDps: 0, revealed: 0,
    bestDps: 0, playTime: 0, runTime: 0, startedAt: Date.now(), lastSave: Date.now(),
    relics: {}, equipped: [], bossBest: 0, heart: {}, stones: 0, awakens: 0, cycleBest: 0,
    settings: { sfxVol: 0.8, musicVol: 0.6, muted: false, music: true, particles: true, shake: true, numbers: true, notation: 'short', buyMode: 1, blood: true, cinematics: true, cursor: 'auto', autoBuy: true },
  };
}

export interface Monster {
  id: number;
  def: MonsterDef;
  hp: number;
  max: number;
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
}

export type HitKind = 'click' | 'crit' | 'dps' | 'cleave' | 'auto' | 'fever';

export type GameEvent =
  | { t: 'hit'; id: number; amount: number; kind: HitKind; x?: number; y?: number }
  | { t: 'click'; crit: boolean; x: number; y: number }
  | { t: 'spawn'; id: number }
  | { t: 'kill'; id: number; gold: number; boss: boolean; by: HitKind }
  | { t: 'floor'; floor: number; boss: boolean }
  | { t: 'bossFail'; floor: number }
  | { t: 'bossWin'; floor: number }
  | { t: 'souls'; id: number; floor: number; souls: number }
  | { t: 'retreat'; floor: number }
  | { t: 'buyComp'; comp: number; n: number }
  | { t: 'reveal'; comp: number }
  | { t: 'buyUpg'; id: string }
  | { t: 'trophy'; id: string }
  | { t: 'raidSpawn'; id: number; from: -1 | 1 }
  | { t: 'raidCatch'; id: number; reward: RaidReward; amount?: number; buff?: Buff }
  | { t: 'raidEscape'; id: number }
  | { t: 'fever'; on: boolean }
  | { t: 'descend'; souls: number }
  | { t: 'abyss'; id: string }
  | { t: 'relic'; id: string; lv: number; floor: number; equipped: boolean }
  | { t: 'split'; id: number; into: [number, number] }
  | { t: 'heal'; id: number; amount: number }
  | { t: 'awaken'; stones: number }
  | { t: 'heart'; id: string; lv: number };

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
  fury: number;
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
  dps: number;
  perComp: number[];
  /** Per companion before the all-damage bonuses. */
  baseComp: number[];
  parts: Parts;
  /** Product of the all-damage bonuses (upgrades, trophies, souls, shard, fury). */
  all: number;
  click: number;
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
}

export interface OfflineSummary {
  seconds: number;
  gold: number;
  kills: number;
  /** Share of full speed: 1 when the tab stayed open, the offline rate when it was closed. */
  pct: number;
  /** New deepest floor reached while away, if any. */
  floor?: number;
}

/** Health of an ordinary monster on a floor (the classic clicker curve). */
export function floorHp(f: number): number {
  if (f <= 140) return 10 * (f - 1 + 1.55 ** (f - 1));
  return floorHp(140) * TUNE.deepHp ** (f - 140);
}

export function floorGold(f: number): number {
  return Math.max(1, Math.ceil(floorHp(f) / 15));
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
  /** Seconds since the last kill: too long and your party falls back a floor. */
  private stuckT = 0;
  private owned = new Set<string>();
  private abyssSet = new Set<string>();
  private trophySet = new Set<string>();
  private cache: Computed | null = null;
  private trophyTimer = 0;
  private autoClick = 0;
  private sinceClick = 99;
  /** DPS damage waiting to be shown as numbers, per monster. */
  private dpsShown = new Map<number, number>();
  private healShown = new Map<number, number>();
  private shopT = 0;
  private dpsFlush = 0;
  /** Recent kills per second, smoothed, for the stats. */
  killRate = 0;
  private killAcc = 0;
  private killWindow = 0;

  constructor(s: SaveState) {
    this.s = s;
    // Saves from before awakening existed: the whole history counts as the first cycle.
    if (s.cycleBest === undefined) s.cycleBest = (s.bestFloor ?? 1) - 1;
    if (s.bestCleared === undefined) s.bestCleared = (s.bestFloor ?? 1) - 1;
    // Souls used to be paid for depth at descent time; carry what this descent was worth over.
    if (s.runSouls === undefined) s.runSouls = Math.floor(10 * 1.1 ** (Math.min(s.maxFloor ?? 1, 90) - 30) * 1.04 ** Math.max(0, (s.maxFloor ?? 1) - 90));
    const fresh = newSave();
    for (const k of Object.keys(fresh) as (keyof SaveState)[]) if (s[k] === undefined) (s as unknown as Record<string, unknown>)[k] = fresh[k];
    s.settings = { ...fresh.settings, ...s.settings };
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
      if (d && d.effect === e) lv += this.relicLv(id);
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
      fury: TUNE.fury ** this.heartLv('fury'),
      banner: 1 + 0.5 * this.relic('party'),
      clickDps: CLICK_DPS + clickDpsUpg + 0.1 * this.relic('oath'),
      clickDpsUpg, oath: 0.1 * this.relic('oath'),
      critBase: BASE_CRIT, critUpg, critRelic: Math.min(0.3, 0.02 * this.relic('critChance')),
      critMultBase: BASE_CRIT_MULT, critMultUpg, critMultRelic: 1 + 0.5 * this.relic('critMult'),
      cleaveUpg, cleaveRelic: 0.2 * this.relic('cleave'),
      goldUpg: 1 + gold, goldRelic: 1 + 0.5 * this.relic('gold'),
    };
    const all = parts.upgrades * parts.trophies * parts.souls * parts.shard * parts.fury;
    const baseComp = COMPS.map((c, i) => c.dps * s.owned[i] * tier[i] * syn[i]);
    const perComp = baseComp.map((b) => b * all * parts.banner);
    const dps = perComp.reduce((a, b) => a + b, 0);
    const click = twin * whet * blades * all + dps * parts.clickDps;
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
    return this.c.dps * this.buffMult('dps');
  }

  compDps(i: number) {
    return this.c.perComp[i];
  }

  /** Damage one more level of this companion would add (before buffs). */
  compNext(i: number) {
    this.s.owned[i]++;
    this.cache = null;
    const v = this.compute().perComp[i];
    this.s.owned[i]--;
    this.cache = null;
    return v - this.compDps(i);
  }

  clickDamage() {
    return this.c.click * this.buffMult('click');
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
    let p = 5;
    for (const e of this.effects()) if (e.t === 'fever' && e.power) p *= e.power;
    return p * (1 + 0.5 * this.relic('rampage'));
  }

  monsterGold(m: Monster) {
    return Math.ceil(Math.max(1, floorGold(this.s.floor) * (m.boss ? 8 : TRASH)) * this.goldMult());
  }

  // ---------- costs ----------

  private compBase(i: number) {
    return COMPS[i].cost * (this.hasAbyss('tithe') ? 0.9 : 1);
  }

  compCost(i: number, n = 1) {
    const k = this.s.owned[i];
    return Math.ceil(this.compBase(i) * COST_GROWTH ** k * (COST_GROWTH ** n - 1) / (COST_GROWTH - 1));
  }

  compQuote(i: number): { n: number; cost: number } {
    const mode = this.s.settings.buyMode;
    if (mode > 0) return { n: mode, cost: this.compCost(i, mode) };
    const base = this.compBase(i) * COST_GROWTH ** this.s.owned[i];
    const n = Math.max(1, Math.floor(Math.log(this.s.gold * (COST_GROWTH - 1) / base + 1) / Math.log(COST_GROWTH)));
    return { n, cost: this.compCost(i, n) };
  }

  upgCost(u: UpgDef) {
    return u.cost * (this.hasAbyss('bargain') ? 0.9 : 1);
  }

  compUnlocked(i: number) {
    return this.s.descents >= COMPS[i].depth;
  }

  // ---------- floors and monsters ----------

  private enterFloor(f: number, quiet = false) {
    this.s.floor = f;
    this.s.floorKills = 0;
    this.stuckT = 0;
    this.monsters = [];
    this.spawnT = 0.3;
    this.bossTime = 0;
    if (isBossFloor(f)) this.spawnBoss();
    if (!quiet) this.events.push({ t: 'floor', floor: f, boss: isBossFloor(f) });
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
    const hp = floorHp(this.s.floor) * def.hp * TRASH;
    const m: Monster = { id: this.seq++, def, hp, max: hp, boss: false, arrive: 0.7, mods: [], ...this.spot(false) };
    this.monsters.push(m);
    this.events.push({ t: 'spawn', id: m.id });
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
    const hp = floorHp(this.s.floor) * 8 * zone * (giant ? 1 + 2 * bite : 1);
    const m: Monster = { id: this.seq++, def, hp, max: hp, boss: true, arrive: 1.5, mods, ...this.spot(true) };
    this.monsters.push(m);
    let time = (this.hasAbyss('patience') ? 45 : BOSS_TIME) + Math.min(30, 3 * this.relic('time'));
    if (mods.includes('enraged')) time *= 1 - 0.5 * bite;
    if (giant) time *= 1.5;
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
  private damage(m: Monster, amount: number, kind: HitKind, x?: number, y?: number): number {
    if (m.boss) {
      amount *= 1 + this.relic('boss');
      if (kind === 'dps' && m.mods.includes('armored')) {
        // Overkill passed on from a dead monster keeps its full value; only the boss's share is cut.
        amount *= 1 - this.armor();
      }
    }
    const dealt = Math.min(m.hp, amount);
    m.hp -= amount;
    if (kind === 'dps') this.dpsShown.set(m.id, (this.dpsShown.get(m.id) ?? 0) + dealt);
    else this.events.push({ t: 'hit', id: m.id, amount, kind, x, y });
    if (m.hp <= 0) {
      this.kill(m, kind);
      return -m.hp;
    }
    return 0;
  }

  private kill(m: Monster, by: HitKind) {
    const i = this.monsters.indexOf(m);
    if (i < 0) return;
    this.monsters.splice(i, 1);
    const shown = this.dpsShown.get(m.id);
    if (shown) {
      this.events.push({ t: 'hit', id: m.id, amount: shown, kind: 'dps' });
      this.dpsShown.delete(m.id);
    }
    const gold = this.monsterGold(m);
    this.earn(gold);
    this.s.kills++;
    this.killAcc++;
    this.stuckT = 0;
    this.events.push({ t: 'kill', id: m.id, gold, boss: m.boss, by });
    if (m.boss && m.mods.includes('split') && !m.half) {
      // Two halves climb out of the body; the clock keeps running.
      const frac = 0.5 * this.modBite() + 0.25 * (1 - this.modBite());
      const mods = m.mods.filter((x) => x !== 'split');
      const halves = [-1, 1].map((side): Monster => ({
        id: this.seq++, def: m.def, hp: m.max * frac, max: m.max * frac, boss: true, half: true, arrive: 0.4, mods,
        x: m.x + side * 1.1, z: m.z - side * 1,
      }));
      this.monsters.push(...halves);
      this.events.push({ t: 'split', id: m.id, into: [halves[0].id, halves[1].id] });
      for (const h of halves) this.events.push({ t: 'spawn', id: h.id });
      return;
    }
    if (m.boss && this.monsters.some((x) => x.boss)) return;
    if (m.boss) {
      this.s.bosses++;
      this.bossTime = 0;
      this.unlockNext();
      this.events.push({ t: 'bossWin', floor: this.s.floor });
      const souls = this.bossSouls(this.s.floor);
      if (souls > 0) {
        this.s.runSouls += souls;
        this.events.push({ t: 'souls', id: m.id, floor: this.s.floor, souls });
      }
      this.rollRelic(this.s.floor);
      if (this.s.auto) this.enterFloor(this.s.floor + 1);
      else this.enterFloor(this.s.floor);
    } else if (!this.bossFloor()) {
      this.s.floorKills++;
      if (this.s.floorKills >= FLOOR_KILLS) {
        this.unlockNext();
        if (this.s.auto && this.s.floor + 1 <= this.s.maxFloor) this.enterFloor(this.s.floor + 1);
      }
    }
  }

  private unlockNext() {
    const s = this.s;
    s.bestCleared = Math.max(s.bestCleared, s.floor);
    s.cycleBest = Math.max(s.cycleBest, s.floor);
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
    if (!target) return 0;
    const crit = !auto && Math.random() < this.critChance();
    const fever = this.s.buffs.some((b) => b.id === 'fever');
    let amount = this.clickDamage() * (crit ? this.critMult() : 1);
    if (fever) amount *= this.feverMult();
    const others = this.cleave() > 0 ? this.monsters.filter((m) => m !== target) : [];
    this.damage(target, amount, auto ? 'auto' : crit ? 'crit' : fever ? 'fever' : 'click', x, y);
    for (const m of others) if (this.monsters.includes(m)) this.damage(m, amount * this.cleave(), 'cleave');
    if (!auto) {
      this.s.clicks++;
      if (crit) this.s.crits++;
      this.sinceClick = 0;
      this.events.push({ t: 'click', crit, x, y });
      if (!fever) {
        let fill = 1 / FEVER_CLICKS;
        for (const e of this.effects()) if (e.t === 'fever' && e.fill) fill *= e.fill;
        if (this.hasAbyss('dreams')) fill *= 1.5;
        this.s.fervor = Math.min(1, this.s.fervor + fill);
        if (this.s.fervor >= 1) this.startFever();
      }
    }
    return amount;
  }

  private startFever() {
    let dur = FEVER_TIME;
    for (const e of this.effects()) if (e.t === 'fever' && e.dur) dur *= e.dur;
    if (this.hasAbyss('dreams')) dur *= 1.5;
    this.s.fevers++;
    this.addBuff({ id: 'fever', name: 'Rampage', t: dur, dur, dps: 2, click: 1, gold: 1 });
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
    if (this.s.gold < cost) return false;
    this.s.gold -= cost;
    this.s.owned[i] += n;
    this.invalidate();
    this.events.push({ t: 'buyComp', comp: i, n });
    return true;
  }

  buyUpg(id: string) {
    const u = UPG_BY_ID.get(id);
    if (!u || this.owned.has(id)) return false;
    const cost = this.upgCost(u);
    if (this.s.gold < cost) return false;
    this.s.gold -= cost;
    this.s.upgrades.push(id);
    this.owned.add(id);
    this.invalidate();
    this.events.push({ t: 'buyUpg', id });
    return true;
  }

  buyAllUpgs() {
    let n = 0;
    for (const u of this.shopUpgrades()) if (this.buyUpg(u.id)) n++;
    return n;
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
    const reward = this.rollReward();
    let effect = 1;
    for (const e of this.effects()) if (e.t === 'raid' && e.effect) effect *= e.effect;
    const ev: GameEvent = { t: 'raidCatch', id: r.id, reward };
    if (reward === 'plunder') {
      // One to two floors' worth of kills: a nice haul, not a reason to stop playing and wait for goblins.
      const amount = floorGold(this.s.floor) * this.goldMult() * (10 + Math.random() * 10);
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
      case 'bloodlust': return b('bloodlust', 'Bloodlust', 60, 7, 1, 1);
      case 'heartstorm': return b('heartstorm', 'Frenzy', 15, 1, 77, 1);
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
    this.raid = { id: this.seq++, from, t: 0, stay: RAID_STAY };
    this.events.push({ t: 'raidSpawn', id: this.raid.id, from });
  }

  // ---------- prestige ----------

  /** Souls a zone boss on this floor pays when beaten (before relics and Heart powers). */
  baseBossSouls(floor: number) {
    if (floor % 10 !== 0) return 0;
    if (floor < DESCEND_FLOOR) return [0, 5, 10][floor / 10];
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
    s.gold = 0;
    s.runGold = 0;
    s.owned = COMPS.map(() => 0);
    s.upgrades = [];
    s.buffs = [];
    s.fervor = 0;
    s.revealed = 0;
    s.runTime = 0;
    s.failDps = 0;
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
    let equipped = this.s.equipped.includes(id);
    if (!equipped && lv === 1 && this.s.equipped.length < this.relicSlots()) {
      this.s.equipped.push(id);
      equipped = true;
    }
    this.invalidate();
    this.events.push({ t: 'relic', id, lv, floor, equipped });
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

  /** Quartermaster: spend gold the way a sensible player would (best damage per gold first). */
  private autoShop() {
    this.buyAllUpgs();
    const mode = this.s.settings.buyMode;
    this.s.settings.buyMode = 1;
    for (let k = 0; k < 60; k++) {
      let best = -1;
      let bestScore = Infinity;
      for (let i = 0; i < COMPS.length; i++) {
        if (!this.compUnlocked(i) || i > this.s.revealed) continue;
        const gain = this.compNext(i);
        if (gain <= 0) continue;
        const score = this.compCost(i) / gain;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best < 0 || this.compCost(best) > this.s.gold || !this.buyComp(best)) break;
    }
    this.s.settings.buyMode = mode;
  }

  // ---------- trophies ----------

  private trophyMet(r: TrophyReq): boolean {
    const s = this.s;
    switch (r.t) {
      case 'gold': return s.totalGold >= r.n;
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
      case 'dps': return this.baseDps() >= r.n;
      case 'missed': return s.missed >= r.n;
      case 'relics': return this.relicsFound() >= r.n;
      case 'awakens': return s.awakens >= r.n;
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

  private earn(n: number) {
    this.s.gold += n;
    this.s.runGold += n;
    this.s.totalGold += n;
  }

  update(dt: number) {
    const s = this.s;
    s.playTime += dt;
    s.runTime += dt;

    // Keep the field full of monsters (bosses come alone).
    if (!this.bossFloor()) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.monsters.length < MAX_ON) {
        this.spawn();
        this.spawnT = SPAWN_GAP;
      }
    } else if (this.monsters.length === 0) this.spawnBoss();

    // Companions chew through monsters front to back; overkill carries over.
    for (const m of this.monsters) m.arrive -= dt;
    let dmg = this.dps() * dt;
    for (let k = 0; k < 20 && dmg > 0; k++) {
      const m = this.focus();
      if (!m) break;
      dmg = this.damage(m, dmg, 'dps');
    }

    // Too slow here: fall back to a floor you can farm, and push again once stronger.
    this.stuckT += dt;
    if (!this.bossFloor() && this.stuckT > 20 && s.floor > 1) {
      this.stuckT = 0;
      s.auto = false;
      s.failDps = this.dps();
      this.events.push({ t: 'retreat', floor: s.floor });
      this.enterFloor(s.floor - 1);
    }

    // Boss timer.
    if (this.bossFloor() && this.bossTime > 0) {
      this.bossTime -= dt;
      if (this.bossTime <= 0) this.bossFailed();
    }
    // Retry a boss on your own once you're clearly stronger.
    if (!s.auto && s.failDps > 0 && this.dps() >= s.failDps * 1.5 + 1) {
      s.failDps = 0;
      this.setAuto(true);
    }

    // Buffs.
    let expired = false;
    for (const b of s.buffs) b.t -= dt;
    for (const b of s.buffs.filter((x) => x.t <= 0)) {
      if (b.id === 'fever') {
        s.fervor = 0;
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
      if (!m.mods.includes('regen') || m.hp >= m.max) continue;
      const heal = Math.min(m.max - m.hp, m.max * this.regen() * dt);
      m.hp += heal;
      this.healShown.set(m.id, (this.healShown.get(m.id) ?? 0) + heal);
    }

    // Quartermaster.
    if (this.heartLv('quarter') && s.settings.autoBuy) {
      this.shopT -= dt;
      if (this.shopT <= 0) {
        this.shopT = 0.5;
        this.autoShop();
      }
    }

    // Phantom Blade.
    const rate = (this.hasAbyss('hands2') ? 10 : this.hasAbyss('hands') ? 3 : 0) + 2 * this.relic('phantom');
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

    // Reveal companions as you get close to affording them.
    for (let i = s.revealed; i < COMPS.length; i++) {
      if (!this.compUnlocked(i)) break;
      if (s.owned[i] > 0 || s.runGold >= COMPS[i].cost * 0.3) {
        s.revealed = i + 1;
        if (i > 0) this.events.push({ t: 'reveal', comp: i });
      } else break;
    }

    // Show companion damage as numbers a few times a second, not every tick.
    this.dpsFlush -= dt;
    if (this.dpsFlush <= 0) {
      this.dpsFlush = 0.35;
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

    s.bestDps = Math.max(s.bestDps, this.baseDps());
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
    const perSec = Math.min(1 / SPAWN_GAP, this.baseDps() / (floorHp(f) * TRASH));
    const kills = Math.floor(perSec * secs * pct);
    const gold = kills * floorGold(f) * TRASH * this.c.gold;
    this.earn(gold);
    this.s.kills += kills;
    this.s.playTime += secs;
    this.s.runTime += secs;
    this.checkTrophies();
    return { seconds: secs, gold, kills, pct };
  }

  abyssList() {
    return ABYSS;
  }
}
