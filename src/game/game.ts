import {
  ABYSS, ABYSS_BY_ID, COMPS, TROPHIES, UPGRADES, UPG_BY_ID, bandFor, bossFor,
  type Effect, type MonsterDef, type RaidReward, type Req, type TrophyReq, type UpgDef,
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
const RAID_MIN = 60;
const RAID_MAX = 150;
const RAID_STAY = 10;
const FEVER_TIME = 10;
const FEVER_CLICKS = 60;
const BASE_CRIT = 0.04;
const BASE_CRIT_MULT = 8;
const OFFLINE_CAP = 72 * 3600;
/** Descending needs this floor; it pays SOUL_FIRST souls, growing 10% per floor after. */
export const DESCEND_FLOOR = 30;
const SOUL_FIRST = 10;
const SOUL_GROWTH = 1.1;

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
  /** Cursor skin id (see CURSORS). */
  cursor: string;
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
  /** Deepest floor ever. */
  bestFloor: number;
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
  settings: Settings;
}

export function newSave(): SaveState {
  return {
    v: SAVE_VERSION, gold: 0, runGold: 0, totalGold: 0, kills: 0, bosses: 0, clicks: 0, crits: 0,
    owned: COMPS.map(() => 0), upgrades: [], abyss: [], trophies: [], souls: 0, spentSouls: 0,
    descents: 0, raids: 0, missed: 0, fevers: 0, fervor: 0, buffs: [], raidTimer: 40,
    floor: 1, maxFloor: 1, bestFloor: 1, floorKills: 0, auto: true, failDps: 0, revealed: 0,
    bestDps: 0, playTime: 0, runTime: 0, startedAt: Date.now(), lastSave: Date.now(),
    settings: { sfxVol: 0.8, musicVol: 0.6, muted: false, music: true, particles: true, shake: true, numbers: true, notation: 'short', buyMode: 1, blood: true, cursor: 'auto' },
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
}

export type HitKind = 'click' | 'crit' | 'dps' | 'cleave' | 'auto' | 'fever';

export type GameEvent =
  | { t: 'hit'; id: number; amount: number; kind: HitKind; x?: number; y?: number }
  | { t: 'click'; crit: boolean; x: number; y: number }
  | { t: 'spawn'; id: number }
  | { t: 'kill'; id: number; gold: number; boss: boolean }
  | { t: 'floor'; floor: number; boss: boolean }
  | { t: 'bossFail'; floor: number }
  | { t: 'bossWin'; floor: number }
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
  | { t: 'abyss'; id: string };

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
  return floorHp(140) * 1.145 ** (f - 140);
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
  private cache: { dps: number; perComp: number[]; click: number; crit: number; critMult: number; cleave: number; gold: number } | null = null;
  private trophyTimer = 0;
  private autoClick = 0;
  private sinceClick = 99;
  /** DPS damage waiting to be shown as numbers, per monster. */
  private dpsShown = new Map<number, number>();
  private dpsFlush = 0;
  /** Recent kills per second, smoothed, for the stats. */
  killRate = 0;
  private killAcc = 0;
  private killWindow = 0;

  constructor(s: SaveState) {
    this.s = s;
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
    const mult = COMPS.map(() => 1);
    let click = this.hasAbyss('twin') ? 2 : 1;
    let clickDps = CLICK_DPS;
    let global = 0;
    let gold = 0;
    let crit = BASE_CRIT;
    let critMult = BASE_CRIT_MULT;
    let cleave = 0;
    for (const e of effects) {
      if (e.t === 'comp') mult[e.comp] *= e.mult;
      else if (e.t === 'click') click *= e.mult;
      else if (e.t === 'clickDps') clickDps += e.pct;
      else if (e.t === 'global') global += e.pct;
      else if (e.t === 'gold') gold += e.pct;
      else if (e.t === 'crit') {
        if (e.chance) crit += e.chance;
        if (e.mult) critMult *= e.mult;
      } else if (e.t === 'cleave') cleave += e.pct;
      else if (e.t === 'syn') {
        mult[e.a] *= 1 + 0.05 * s.owned[e.b];
        mult[e.b] *= 1 + 0.01 * s.owned[e.a];
      }
    }
    const all = (1 + global) * this.trophyMult() * this.soulMult();
    const perComp = COMPS.map((c, i) => c.dps * s.owned[i] * mult[i] * all);
    const dps = perComp.reduce((a, b) => a + b, 0);
    this.cache = { dps, perComp, click: click * all + dps * clickDps, crit, critMult, cleave, gold: 1 + gold };
    return this.cache;
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
    return p;
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
    const m: Monster = { id: this.seq++, def, hp, max: hp, boss: false, arrive: 0.7, ...this.spot(false) };
    this.monsters.push(m);
    this.events.push({ t: 'spawn', id: m.id });
  }

  private spawnBoss() {
    const def = bossFor(this.s.floor);
    const hp = floorHp(this.s.floor) * 8;
    const m: Monster = { id: this.seq++, def, hp, max: hp, boss: true, arrive: 1.5, ...this.spot(true) };
    this.monsters.push(m);
    this.bossTimeMax = this.hasAbyss('patience') ? 45 : BOSS_TIME;
    this.bossTime = this.bossTimeMax;
    this.events.push({ t: 'spawn', id: m.id });
  }

  monster(id: number) {
    return this.monsters.find((m) => m.id === id);
  }

  /** Damage a monster; returns overflow past its death. */
  private damage(m: Monster, amount: number, kind: HitKind, x?: number, y?: number): number {
    const dealt = Math.min(m.hp, amount);
    m.hp -= amount;
    if (kind === 'dps') this.dpsShown.set(m.id, (this.dpsShown.get(m.id) ?? 0) + dealt);
    else this.events.push({ t: 'hit', id: m.id, amount, kind, x, y });
    if (m.hp <= 0) {
      this.kill(m);
      return -m.hp;
    }
    return 0;
  }

  private kill(m: Monster) {
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
    this.events.push({ t: 'kill', id: m.id, gold, boss: m.boss });
    if (m.boss) {
      this.s.bosses++;
      this.bossTime = 0;
      this.unlockNext();
      this.events.push({ t: 'bossWin', floor: this.s.floor });
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
      const amount = floorGold(this.s.floor) * this.goldMult() * (40 + Math.random() * 40);
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
    let f = this.hasAbyss('lure') ? 1.25 : 1;
    for (const e of this.effects()) if (e.t === 'raid' && e.freq) f *= e.freq;
    this.s.raidTimer = (RAID_MIN + Math.random() * (RAID_MAX - RAID_MIN)) / f;
  }

  private spawnRaid() {
    const from = Math.random() < 0.5 ? -1 : 1;
    this.raid = { id: this.seq++, from, t: 0, stay: RAID_STAY };
    this.events.push({ t: 'raidSpawn', id: this.raid.id, from });
  }

  // ---------- prestige ----------

  soulsFor(floor: number) {
    return floor < DESCEND_FLOOR ? 0 : Math.floor(SOUL_FIRST * SOUL_GROWTH ** (floor - DESCEND_FLOOR));
  }

  /** Souls a descent would grant right now (based on the deepest floor this descent). */
  pendingSouls() {
    return this.soulsFor(this.s.maxFloor);
  }

  canDescend() {
    return this.pendingSouls() >= 1;
  }

  descend() {
    const gained = this.pendingSouls();
    if (gained < 1) return false;
    const s = this.s;
    s.souls += gained;
    s.descents++;
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
    this.events.push({ t: 'descend', souls: gained });
    return true;
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

  // ---------- trophies ----------

  private trophyMet(r: TrophyReq): boolean {
    const s = this.s;
    switch (r.t) {
      case 'gold': return s.totalGold >= r.n;
      case 'floor': return s.bestFloor >= r.n;
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

    // Phantom Blade.
    const rate = this.hasAbyss('hands2') ? 10 : this.hasAbyss('hands') ? 3 : 0;
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
