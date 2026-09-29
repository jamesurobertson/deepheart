import {
  type AffixId, type Item, type Slot, type VerdictKind, SLOTS, AFFIXES,
  goldValue, potentialStars, power, rollItem, starterItem, verdict, xpToNext,
} from './items.ts';
import { type MonsterKind, bandFor, bossFor } from './monsters.ts';
import { type StageMap, makeStage, route } from './stage.ts';
import { HEROES, heroXpToNext, type HeroId, type HeroKit, type Skill } from './heroes.ts';
import { type Mods, TALENT, available, computeMods, shardsFor, REBIRTH_MIN } from './talents.ts';
import {
  type DailyState, type DungeonId, type TaskId, BOARD_DAYS, RUN_QUOTA, RUN_SECONDS, WB_SECONDS,
  newDaily, rollover, stampReward, tasksDone,
} from './dailies.ts';

// ---------- persistent state ----------

export interface Upgrades {
  inherit: number;
  fortune: number;
  satchel: number;
  stride: number;
}

export interface Settings {
  keepRarity: number;
  salvageWorse: boolean;
  autoEquip: boolean;
  /** Hero fights and moves on its own; any manual input takes over for a moment. */
  auto: boolean;
  /** Attempt the stage Challenge automatically when healthy. */
  autoChallenge: boolean;
  muted: boolean;
  /** Background music on/off (missing in older saves = on). */
  music?: boolean;
  // Optional so older saves load with defaults.
  musicVol?: number; // 0..1, default 0.7
  sfxVol?: number; // 0..1, default 0.8
  shake?: boolean; // default on
  hitstop?: boolean; // default on
  numbers?: 'all' | 'crits' | 'off';
}

export interface Prestige {
  shards: number;
  rebirths: number;
  ranks: Record<string, number>;
  bestStage: number;
}

export interface SaveState {
  v: 4;
  hero: HeroId;
  heroLevel: number;
  heroXp: number;
  stage: number; // stage currently being hunted (1-based: chapter = ceil(stage / 10))
  maxStage: number; // highest stage unlocked this run
  equipped: Record<Slot, Item>;
  bag: Item[];
  gold: number;
  upgrades: Upgrades;
  settings: Settings;
  prestige: Prestige;
  daily: DailyState;
  nextId: number;
  killRate: number;
  totalKills: number;
  lastSave: number;
  playTime?: number; // seconds actually played (not offline)
}

export type UpgradeId = keyof Upgrades;
export const UPGRADES: Record<UpgradeId, { name: string; max: number; cost: (l: number) => number; desc: (l: number) => string }> = {
  inherit: { name: 'Inheritance', max: 10, cost: (l) => 20 * 2.2 ** l, desc: (l) => `New gear starts at ${Math.round(inheritPct(l) * 100)}% of the replaced item's level` },
  fortune: { name: 'Fortune', max: 10, cost: (l) => 30 * 2.4 ** l, desc: (l) => `+${l * 8}% item find, rarer drops` },
  satchel: { name: 'Satchel', max: 4, cost: (l) => 50 * 3 ** l, desc: (l) => `Bag holds ${bagSize(l)} items` },
  stride: { name: 'Stride', max: 5, cost: (l) => 25 * 2.5 ** l, desc: (l) => `+${l * 12}% movement speed` },
};

export const inheritPct = (l: number) => 0.3 + 0.05 * l;
export const bagSize = (satchel: number) => 12 + satchel * 6;
export { REBIRTH_MIN, shardsFor };
export const chapterOf = (stage: number) => Math.ceil(stage / 10);
export const stageLabel = (stage: number) => `${chapterOf(stage)}-${((stage - 1) % 10) + 1}`;
export const isBossStage = (stage: number) => stage % 10 === 0;

// ---------- tuning ----------

const ENEMY_HP = 3;
const ENEMY_HP_SCALE = 1.28; // outpaces gear (ILVL_SCALE 1.15): stages are earned with levels + leveled gear
const ENEMY_DMG = 0.7;
const ENEMY_DMG_SCALE = 1.24;
const GRAVITY = 48;
const JUMP_V = 20;
const MOVE_SPEED = 6.2;
const HUNT_POP = 42;
const HUNT_SOFTNESS = 0.4;
const HUNT_RESPAWN = 12;
const CHALLENGE_WAVES = 45;
const CHALLENGE_BOSS = 30;
const CHALLENGE_QUOTA = 50;
const STREAK_WINDOW = 2;
const MASSACRE_MIN = 15;
const MANUAL_GRACE = 2.5; // seconds of no input before auto takes back over
const OFFLINE_RATE = 0.9;
const OFFLINE_BASE_HOURS = 12;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------- runtime ----------

export type Mode = 'hunt' | 'challenge' | 'dungeon' | 'worldboss';

export interface Enemy {
  id: number;
  kind: MonsterKind;
  x: number;
  y: number;
  plat: number;
  dir: number;
  hp: number;
  maxHp: number;
  dmg: number;
  atkTimer: number;
  elite: boolean;
  boss: boolean;
  /** Big stage guardian (Challenge boss) rendered at double size. */
  giant: boolean;
  aggro: boolean;
  slowT: number;
  /** Caster cooldown / charger lunge cooldown / boss slam cooldown. */
  actT: number;
  /** Seconds left in a charger's lunge. */
  rush: number;
}

/** A slow orb thrown by a caster. Dodge it by jumping or moving. */
export interface EnemyShot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  life: number;
}

/** A telegraphed ground slam: a red zone on a platform that hits hard when the timer runs out. */
export interface Warning {
  id: number;
  x0: number;
  x1: number;
  y: number;
  t: number;
  dur: number;
  dmg: number;
}

export interface Projectile {
  id: number;
  kind: 'bolt' | 'arrow' | 'pierce';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  pierce: number;
  mult: number;
  skill: boolean;
  hit: Set<number>;
}

interface Pending {
  skill: Skill;
  x: number;
  y: number;
  follow: boolean;
  delay: number;
  ticks: number;
  every: number;
  kind: 'nova' | 'blast' | 'volley';
}

interface Buff {
  id: string;
  until: number;
  dmg: number;
  aps: number;
  crit: number;
  dr: number;
}

export interface Run {
  kind: 'challenge' | 'dungeon' | 'worldboss';
  dungeon?: DungeonId;
  floor?: number;
  phase: 'waves' | 'boss';
  timer: number;
  kills: number;
  quota: number;
  bossId?: number;
  dealt: number;
}

export type HitKind = 'normal' | 'crit' | 'mega' | 'reflect';
export type DropOutcome = 'bag' | 'salvaged' | 'equipped';

export type GameEvent =
  | { t: 'swing' }
  | { t: 'shot'; kind: 'bolt' | 'arrow' | 'pierce' }
  | { t: 'hit'; id: number; amount: number; kind: HitKind }
  | { t: 'chain'; from: number; to: number }
  | { t: 'heroHit'; amount: number }
  | { t: 'kill'; id: number; x: number; y: number; boss: boolean; elite: boolean; gold: number }
  | { t: 'drop'; item: Item; verdict: VerdictKind; outcome: DropOutcome; x: number; y: number; gold: number }
  | { t: 'levelUp'; slot: Slot; level: number }
  | { t: 'awaken'; item: Item; affix: AffixId }
  | { t: 'equip'; slot: Slot; auto: boolean }
  | { t: 'heroLevel'; level: number; unlocked: Skill[] }
  | { t: 'skill'; skill: Skill; x: number; y: number; radius: number; phase: 'cast' | 'land' }
  | { t: 'dash'; from: number; to: number; y: number }
  | { t: 'boom'; x: number; y: number; radius: number }
  | { t: 'map' }
  | { t: 'down' }
  | { t: 'jump' }
  | { t: 'boss'; name: string }
  | { t: 'challenge'; phase: 'start' | 'boss' | 'win' | 'fail'; stage: number }
  | { t: 'run'; phase: 'start' | 'win' | 'fail'; kind: 'dungeon' | 'worldboss'; title: string; reward: string }
  | { t: 'daily'; what: 'rollover' | 'stamp'; day?: number }
  | { t: 'massacre'; count: number; gold: number }
  | { t: 'enemyShot' }
  | { t: 'telegraph'; x0: number; x1: number; y: number }
  | { t: 'slam'; x: number; y: number; hit: boolean }
  | { t: 'rebirth'; shards: number };

export interface HeroStats {
  damage: number;
  maxHp: number;
  guard: number;
  aps: number;
  critChance: number;
  critMult: number;
  pierce: number;
  affix: Record<AffixId, number>;
}

const emptyAffixes = () => Object.fromEntries(Object.keys(AFFIXES).map((k) => [k, 0])) as Record<AffixId, number>;

function starterGear(nextId: number, ilvl: number): Record<Slot, Item> {
  return Object.fromEntries(SLOTS.map((s, i) => [s, starterItem(nextId + i, s, ilvl)])) as Record<Slot, Item>;
}

export function newSave(hero: HeroId = 'knight'): SaveState {
  return {
    v: 4,
    hero,
    heroLevel: 1,
    heroXp: 0,
    stage: 1,
    maxStage: 1,
    equipped: starterGear(1, 1),
    bag: [],
    gold: 0,
    upgrades: { inherit: 0, fortune: 0, satchel: 0, stride: 0 },
    settings: { keepRarity: 1, salvageWorse: true, autoEquip: true, auto: true, autoChallenge: true, muted: false, music: true, musicVol: 0.7, sfxVol: 0.8, shake: true, hitstop: true, numbers: 'all' },
    prestige: { shards: 0, rebirths: 0, ranks: {}, bestStage: 1 },
    daily: newDaily(),
    nextId: SLOTS.length + 1,
    killRate: 0,
    totalKills: 0,
    lastSave: Date.now(),
  };
}

export interface Input {
  move: number; // -1, 0, 1
  jump: boolean;
  drop: boolean;
  cast: number; // skill slot index to fire, or -1
}

export class Game {
  s: SaveState;
  events: GameEvent[] = [];
  mode: Mode = 'hunt';
  map!: StageMap;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  enemyShots: EnemyShot[] = [];
  warnings: Warning[] = [];
  run: Run | null = null;

  hero = { x: 4, y: 0, vy: 0, plat: 0, facing: 1, dropFrom: -1, dropT: 0 };
  heroHp: number;
  down = 0; // seconds until respawn
  streak = 0;
  clock = 0;
  input: Input = { move: 0, jump: false, drop: false, cast: -1 };
  /** Seconds since the last manual input. */
  idleInput = 99;
  buffs: Buff[] = [];
  cooldowns: Record<string, number> = {};
  challengeCd = 20;

  private atkTimer = 0;
  private streakTimer = 0;
  private spawnTimer = 0;
  private pending: Pending[] = [];
  private aiPlat = 0;
  private aiThink = 0;
  private aiGoal = 0;
  private enemyId = 1;
  private shotId = 1;
  private rateAcc = 0;
  private rateKills = 0;
  private cached: HeroStats | null = null;
  private cachedMods: Mods | null = null;
  // Rolling one-second buckets for the live stats readout.
  private dmgBuckets = new Array<number>(10).fill(0);
  private goldBuckets = new Array<number>(60).fill(0);
  private bucketT = 0;
  private lastGold = 0;

  constructor(save: SaveState) {
    this.s = save;
    rollover(this.s.daily);
    this.heroHp = this.stats().maxHp;
    this.enterHunt();
  }

  // ---------- derived ----------

  get kit(): HeroKit {
    return HEROES[this.s.hero];
  }

  get manual(): boolean {
    return !this.s.settings.auto || this.idleInput < MANUAL_GRACE;
  }

  mods(): Mods {
    return (this.cachedMods ??= computeMods(this.s.prestige.ranks));
  }

  invalidate() {
    this.cached = null;
  }

  /** Unlocked active skills in slot order (keys 1..5). */
  activeSkills(): Skill[] {
    return this.kit.skills.filter((k) => k.cooldown > 0 && k.level <= this.s.heroLevel);
  }

  stats(): HeroStats {
    if (this.cached) return this.cached;
    const e = this.s.equipped;
    const m = this.mods();
    const k = this.kit;
    const affix = emptyAffixes();
    for (const slot of SLOTS) for (const a of e[slot].awakenings) if (a.level <= e[slot].level) affix[a.affix] += a.value;
    const passive = { damage: 0, hp: 0, guard: 0, critMult: 0, pierce: 0 };
    for (const sk of k.skills) {
      if (!sk.passive || sk.level > this.s.heroLevel) continue;
      for (const key of Object.keys(sk.passive) as (keyof typeof passive)[]) passive[key] += sk.passive[key] ?? 0;
    }
    const lvl = 1 + 0.04 * (this.s.heroLevel - 1);
    const relic = Math.log2(1 + power(e.relic));
    this.cached = {
      damage: power(e.weapon) * (1 + affix.ferocity) * k.damage * m.damage * lvl * (1 + passive.damage),
      maxHp: power(e.helm) * (1 + affix.fortify) * k.hp * m.hp * lvl * (1 + passive.hp),
      guard: power(e.shield) * k.guard * m.guard * (1 + passive.guard),
      aps: k.aps * (1 + affix.haste) * m.aps,
      critChance: Math.min(0.75, 0.1 + 0.02 * relic + m.crit),
      critMult: 1.5 + 0.25 * relic + passive.critMult,
      pierce: passive.pierce,
      affix,
    };
    return this.cached;
  }

  private buff(key: 'dmg' | 'aps' | 'crit' | 'dr') {
    return this.buffs.reduce((a, b) => a + b[key], 0);
  }

  bagCapacity() {
    return bagSize(this.s.upgrades.satchel);
  }

  inherit() {
    return Math.min(0.95, inheritPct(this.s.upgrades.inherit) + this.mods().inherit);
  }

  verdictFor(item: Item) {
    return verdict(item, this.s.equipped[item.slot], this.inherit());
  }

  private itemFind() {
    return (1 + 0.08 * this.s.upgrades.fortune) * (1 + this.stats().affix.luck) * this.mods().itemFind;
  }

  private luck() {
    return 0.1 * this.s.upgrades.fortune;
  }

  /** Enemy level for the current activity (drives HP/damage/rewards). */
  level(): number {
    if (this.run?.kind === 'dungeon') return this.run.floor! * 2 + 2;
    return this.s.stage;
  }

  xpPerKill() {
    return 0.5 * 1.04 ** this.level() * (1 + this.stats().affix.wisdom) * this.mods().xp;
  }

  heroXpPerKill() {
    return 1.0 * 1.065 ** this.level() * this.mods().heroXp;
  }

  // ---------- items & shop ----------

  equip(itemId: number, auto = false): boolean {
    const idx = this.s.bag.findIndex((i) => i.id === itemId);
    if (idx < 0) return false;
    const item = this.s.bag.splice(idx, 1)[0];
    this.wear(item, auto);
    return true;
  }

  private wear(item: Item, auto: boolean) {
    const old = this.s.equipped[item.slot];
    const hpRatio = this.heroHp / this.stats().maxHp;
    item.level = Math.max(item.level, Math.min(item.cap, Math.floor(old.level * this.inherit())));
    item.xp = 0;
    item.fresh = false;
    this.s.equipped[item.slot] = item;
    this.invalidate();
    this.heroHp = hpRatio * this.stats().maxHp;
    old.fresh = false;
    if (auto && this.filtered(old)) this.addGold(goldValue(old), false);
    else this.stash(old);
    this.events.push({ t: 'equip', slot: item.slot, auto });
  }

  salvage(itemId: number): number {
    const idx = this.s.bag.findIndex((i) => i.id === itemId);
    if (idx < 0) return 0;
    const [item] = this.s.bag.splice(idx, 1);
    const g = goldValue(item);
    this.addGold(g, false);
    this.task('salvage');
    return g;
  }

  salvageFiltered(): { count: number; gold: number } {
    const doomed = this.s.bag.filter((i) => this.filtered(i));
    const gold = doomed.reduce((a, i) => a + this.salvage(i.id), 0);
    return { count: doomed.length, gold };
  }

  buyUpgrade(id: UpgradeId): boolean {
    const u = UPGRADES[id];
    const lvl = this.s.upgrades[id];
    const cost = u.cost(lvl);
    if (lvl >= u.max || this.s.gold < cost) return false;
    this.s.gold -= cost;
    this.s.upgrades[id]++;
    this.invalidate();
    return true;
  }

  filtered(item: Item): boolean {
    const set = this.s.settings;
    return item.rarity < set.keepRarity || (set.salvageWorse && this.verdictFor(item).kind === 'worse');
  }

  private addGold(base: number, scaled = true) {
    this.s.gold += Math.ceil(base * (scaled ? this.mods().gold : 1));
  }

  // ---------- prestige ----------

  canRebirth() {
    return this.s.maxStage >= REBIRTH_MIN && this.mode === 'hunt';
  }

  buyTalent(id: string): boolean {
    const t = TALENT[id];
    const p = this.s.prestige;
    const rank = p.ranks[id] ?? 0;
    if (!t || rank >= t.max || !available(t, p.ranks)) return false;
    const cost = t.cost(rank);
    if (p.shards < cost) return false;
    p.shards -= cost;
    p.ranks[id] = rank + 1;
    this.cachedMods = null;
    this.invalidate();
    return true;
  }

  rebirth(hero: HeroId): number {
    if (!this.canRebirth()) return 0;
    const p = this.s.prestige;
    const shards = shardsFor(this.s.maxStage);
    p.shards += shards;
    p.rebirths++;
    p.bestStage = Math.max(p.bestStage, this.s.maxStage);
    const m = this.mods();
    const keep = m.heirloom ? this.s.equipped.weapon : null;
    const start = 1 + m.startDepth;
    this.s.hero = hero;
    this.s.heroLevel = m.startLevel;
    this.s.heroXp = 0;
    this.s.equipped = starterGear(this.s.nextId, start);
    this.s.nextId += SLOTS.length;
    if (keep) this.s.equipped.weapon = keep;
    this.s.bag = [];
    this.s.gold = 0;
    this.s.upgrades = { inherit: 0, fortune: 0, satchel: 0, stride: 0 };
    this.s.stage = start;
    this.s.maxStage = start;
    this.cooldowns = {};
    this.buffs = [];
    this.invalidate();
    this.heroHp = this.stats().maxHp;
    this.events.push({ t: 'rebirth', shards });
    this.enterHunt();
    return shards;
  }

  /** Change class without prestige (only at the very start of a run). */
  setHero(hero: HeroId) {
    this.s.hero = hero;
    this.cooldowns = {};
    this.invalidate();
    this.heroHp = this.stats().maxHp;
  }

  // ---------- dailies ----------

  checkDay() {
    if (rollover(this.s.daily)) this.events.push({ t: 'daily', what: 'rollover' });
  }

  private task(id: TaskId, n = 1) {
    this.s.daily.tasks[id] += n;
  }

  claimStamp(): boolean {
    const d = this.s.daily;
    if (d.claimed || !tasksDone(d)) return false;
    d.claimed = true;
    d.stamps = Math.min(BOARD_DAYS, d.stamps + 1);
    const r = stampReward(d.stamps);
    this.addGold(r.gold * 1.05 ** this.s.maxStage);
    if (r.shards) this.s.prestige.shards += r.shards;
    if (r.item) this.handleDrop(rollItem(this.s.nextId++, this.s.maxStage, { minRarity: r.item === 'legendary' ? 4 : 3 }), this.hero);
    this.events.push({ t: 'daily', what: 'stamp', day: d.stamps });
    return true;
  }

  /** Rewards for clearing (or sweeping) a dungeon floor. */
  private dungeonReward(id: DungeonId, floor: number): string {
    const lvl = floor * 2 + 2;
    if (id === 'gold') {
      const g = Math.ceil(80 * 1.07 ** lvl * this.mods().gold);
      this.s.gold += g;
      return `+${g} gold`;
    }
    if (id === 'gear') {
      const item = rollItem(this.s.nextId++, lvl, { minRarity: 2, luck: 0.5 + 0.05 * floor + this.luck() });
      this.handleDrop(item, this.hero);
      return item.name;
    }
    const xp = 1.2 * 1.07 ** lvl * 160 * this.mods().heroXp;
    this.gainHeroXp(xp);
    this.gainXp(0.5 * 1.04 ** lvl * 160 * this.mods().xp);
    return `+${Math.round(xp)} experience`;
  }

  startDungeon(id: DungeonId, floor: number): boolean {
    const d = this.s.daily;
    if (this.mode !== 'hunt' || floor > d.best[id] + 1 || floor < 1) return false;
    // New floors are free; replays cost a key.
    if (floor <= d.best[id] && d.keys[id] <= 0) return false;
    this.run = { kind: 'dungeon', dungeon: id, floor, phase: 'waves', timer: RUN_SECONDS, kills: 0, quota: RUN_QUOTA, dealt: 0 };
    this.enterMap('dungeon', makeStage(9000 + floor, 'arena'));
    this.events.push({ t: 'run', phase: 'start', kind: 'dungeon', title: `Floor ${floor}`, reward: '' });
    return true;
  }

  sweep(id: DungeonId): string | null {
    const d = this.s.daily;
    if (d.keys[id] <= 0 || d.best[id] <= 0) return null;
    d.keys[id]--;
    this.task('dungeons');
    return this.dungeonReward(id, d.best[id]);
  }

  startWorldBoss(): boolean {
    const d = this.s.daily;
    if (this.mode !== 'hunt' || d.wbAttempts <= 0) return false;
    d.wbAttempts--;
    this.task('worldboss');
    this.run = { kind: 'worldboss', phase: 'boss', timer: WB_SECONDS, kills: 0, quota: 0, dealt: 0 };
    this.enterMap('worldboss', makeStage(7777, 'arena'));
    const b = this.spawnAt(0, this.map.w / 2 + 3, false, 'worldboss');
    this.run.bossId = b.id;
    this.events.push({ t: 'run', phase: 'start', kind: 'worldboss', title: `World Boss · Lv ${d.wbLevel}`, reward: '' });
    return true;
  }

  // ---------- stages & challenges ----------

  startChallenge(): boolean {
    if (this.mode !== 'hunt' || this.down > 0) return false;
    this.task('challenge');
    this.run = { kind: 'challenge', phase: 'waves', timer: CHALLENGE_WAVES, kills: 0, quota: CHALLENGE_QUOTA, dealt: 0 };
    this.enterMap('challenge', makeStage(this.s.stage * 31 + 5));
    this.events.push({ t: 'challenge', phase: 'start', stage: this.s.stage });
    return true;
  }

  /** Farm any unlocked stage (lower stages are safer; higher ones pay more). */
  setStage(stage: number) {
    if (this.mode !== 'hunt') return;
    this.s.stage = clamp(stage, 1, this.s.maxStage);
    this.enterHunt();
  }

  private enterHunt() {
    this.run = null;
    this.enterMap('hunt', makeStage(this.s.stage));
  }

  private enterMap(mode: Mode, map: StageMap) {
    this.mode = mode;
    this.map = map;
    this.enemies = [];
    this.projectiles = [];
    this.enemyShots = [];
    this.warnings = [];
    this.pending = [];
    this.hero = { x: 4, y: 0, vy: 0, plat: 0, facing: 1, dropFrom: -1, dropT: 0 };
    this.spawnTimer = 0;
    this.down = 0;
    if (mode !== 'worldboss') this.fillPopulation(mode === 'dungeon' ? 40 : 34);
    this.events.push({ t: 'map' });
  }

  private population() {
    return Math.round((this.mode === 'dungeon' ? 40 : HUNT_POP) * this.mods().hordeSize);
  }

  private fillPopulation(target: number) {
    const free = this.map.spawns.filter((sp) => Math.abs(sp.x - this.hero.x) > 5 || this.map.platforms[sp.p].y > 0);
    for (let i = this.enemies.length; i < target && free.length; i++) {
      const sp = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      this.spawnAt(sp.p, sp.x + rand(-0.4, 0.4), Math.random() < (this.mode === 'dungeon' ? 0.08 : 0.04));
    }
  }

  private spawnAt(plat: number, x: number, elite: boolean, special?: 'giant' | 'boss' | 'worldboss'): Enemy {
    const lvl = special === 'worldboss' ? 5 + this.s.daily.wbLevel * 4 : this.level();
    const band = bandFor(Math.max(1, special === 'worldboss' ? 30 : lvl));
    const kind = special === 'boss' || special === 'worldboss' ? bossFor(special === 'worldboss' ? 30 : lvl) : band[Math.floor(Math.random() * band.length)];
    const mult = special === 'worldboss' ? 180 : special === 'boss' ? 45 : special === 'giant' ? 25 : elite ? 7 : 1;
    // Farming is meant to be a massacre; Challenges are the real test of strength.
    const soft = this.mode === 'hunt' ? HUNT_SOFTNESS : 1;
    const hp = ENEMY_HP * ENEMY_HP_SCALE ** lvl * kind.hp * mult * soft * rand(0.9, 1.1);
    const e: Enemy = {
      id: this.enemyId++, kind, x, y: this.map.platforms[plat].y, plat, dir: Math.random() < 0.5 ? -1 : 1,
      hp, maxHp: hp,
      dmg: ENEMY_DMG * ENEMY_DMG_SCALE ** lvl * kind.dmg * (special === 'worldboss' ? 5 : special ? 5 : elite ? 2 : 1) * soft,
      atkTimer: 0.6, elite, boss: special === 'boss' || special === 'worldboss', giant: special === 'giant', aggro: !!special, slowT: 0,
      actT: 1.5 + Math.random() * 2, rush: 0,
    };
    this.enemies.push(e);
    return e;
  }

  // ---------- main update ----------

  update(dt: number) {
    this.clock += dt;
    this.s.playTime = (this.s.playTime ?? 0) + dt;
    this.bucketT += dt;
    if (this.bucketT >= 1) {
      this.bucketT -= 1;
      this.dmgBuckets.unshift(0);
      this.dmgBuckets.length = 10;
      this.goldBuckets.unshift(Math.max(0, this.s.gold - this.lastGold));
      this.goldBuckets.length = 60;
      this.lastGold = this.s.gold;
    }
    this.idleInput += dt;
    if (this.idleInput < MANUAL_GRACE && this.input.move !== 0) this.task('manual', dt);
    const st = this.stats();
    this.trackRate(dt);
    this.tickStreak(dt);
    this.buffs = this.buffs.filter((b) => b.until > this.clock);
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);

    if (this.down > 0) {
      this.down -= dt;
      this.heroHp = Math.min(st.maxHp, this.heroHp + st.maxHp * 0.5 * dt);
      if (this.down <= 0) this.heroHp = st.maxHp;
      this.updateEnemies(dt, st, false);
      return;
    }
    this.heroHp = Math.min(st.maxHp, this.heroHp + st.maxHp * (0.03 + st.affix.regen) * dt);

    this.updateSpawns(dt);
    this.controlHero(dt, st);
    this.updateEnemies(dt, st, true);
    if (this.heroHp <= 0) return this.heroDied();
    this.heroAttack(dt, st);
    this.updateThreats(dt, st);
    if (this.heroHp <= 0) return this.heroDied();
    this.updateProjectiles(dt, st);
    this.updatePending(dt, st);
    this.reap();
    this.updateRun(dt);
    if (this.mode === 'hunt' && this.s.settings.autoChallenge && this.s.stage === this.s.maxStage) {
      this.challengeCd -= dt;
      if (this.challengeCd <= 0 && this.heroHp > st.maxHp * 0.8) this.startChallenge();
    }
  }

  private updateSpawns(dt: number) {
    if (this.mode === 'worldboss' || (this.run?.phase === 'boss' && this.mode === 'challenge')) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = this.mode === 'hunt' ? HUNT_RESPAWN : this.mode === 'challenge' ? 5 : 3;
    this.fillPopulation(this.mode === 'hunt' ? this.population() : this.population() + 6);
  }

  private trackRate(dt: number) {
    this.rateAcc += dt;
    if (this.rateAcc >= 10) {
      if (this.mode === 'hunt') {
        const r = this.rateKills / this.rateAcc;
        this.s.killRate = this.s.killRate === 0 ? r : this.s.killRate * 0.85 + r * 0.15;
      }
      this.rateAcc = 0;
      this.rateKills = 0;
    }
  }

  private tickStreak(dt: number) {
    if (this.streakTimer <= 0) return;
    this.streakTimer -= dt;
    if (this.streakTimer > 0) return;
    if (this.streak >= MASSACRE_MIN) {
      const gold = Math.ceil(this.streak * 0.2 * 1.05 ** this.level() * this.mods().gold);
      this.s.gold += gold;
      this.events.push({ t: 'massacre', count: this.streak, gold });
    }
    this.streak = 0;
  }

  // ---------- hero movement ----------

  private controlHero(dt: number, st: HeroStats) {
    let move = 0, jump = false, drop = false;
    if (this.manual) {
      move = this.input.move;
      jump = this.input.jump;
      drop = this.input.drop;
      if (this.input.cast >= 0) {
        const sk = this.activeSkills()[this.input.cast];
        if (sk && (this.cooldowns[sk.id] ?? 0) <= 0) this.castSkill(sk, st, true);
      }
    } else {
      [move, jump, drop] = this.think(dt);
      for (const sk of [...this.activeSkills()].reverse()) {
        if ((this.cooldowns[sk.id] ?? 0) <= 0 && this.castSkill(sk, st, false)) break;
      }
    }
    this.input.jump = false;
    this.input.drop = false;
    this.input.cast = -1;
    this.physics(dt, move, jump, drop);
  }

  private physics(dt: number, move: number, jump: boolean, drop: boolean) {
    const h = this.hero;
    const m = this.map;
    const speed = MOVE_SPEED * (1 + 0.12 * this.s.upgrades.stride) * this.mods().move;
    if (move) h.facing = Math.sign(move);
    h.x = clamp(h.x + move * speed * dt, 0.4, m.w - 0.4);
    if (h.plat >= 0) {
      const p = m.platforms[h.plat];
      if (h.x < p.x0 || h.x > p.x1) h.plat = -1; // walked off the edge
      else if (jump) {
        h.vy = JUMP_V;
        h.plat = -1;
        this.events.push({ t: 'jump' });
      } else if (drop && h.plat !== 0) {
        h.dropFrom = h.plat;
        h.dropT = 0.3;
        h.plat = -1;
        h.vy = -2;
      }
    }
    if (h.plat < 0) {
      const y0 = h.y;
      h.vy -= GRAVITY * dt;
      h.y += h.vy * dt;
      h.dropT -= dt;
      if (h.vy <= 0) {
        // Land on the highest one-way platform we just fell through.
        let land = -1;
        m.platforms.forEach((p, i) => {
          if (h.x < p.x0 || h.x > p.x1 || y0 < p.y - 0.001 || h.y > p.y) return;
          if (i === h.dropFrom && h.dropT > 0) return;
          if (land < 0 || p.y > m.platforms[land].y) land = i;
        });
        if (land >= 0) {
          h.y = m.platforms[land].y;
          h.vy = 0;
          h.plat = land;
        }
      }
    }
  }

  /** Auto-play: go where the monsters are, plant feet and fight. */
  private think(dt: number): [number, boolean, boolean] {
    const h = this.hero;
    const m = this.map;
    // Step out of a telegraphed slam before it lands (auto-play only; manual players dodge themselves).
    const danger = this.dangerDir();
    if (danger !== 2) return danger === 0 ? [0, true, false] : [danger, false, false];
    if (this.inRange()) return [0, false, false];

    this.aiThink -= dt;
    if (this.aiThink <= 0) {
      this.aiThink = 0.5;
      let best = -1, score = 0;
      m.platforms.forEach((p, i) => {
        const on = this.enemies.filter((e) => e.plat === i && e.hp > 0);
        if (!on.length) return;
        const cx = on.reduce((a, e) => a + e.x, 0) / on.length;
        const s = on.length / (1 + Math.abs(cx - h.x) * 0.05 + Math.abs(p.y - h.y) * 0.15) * (on.some((e) => e.boss || e.giant) ? 3 : 1);
        if (s > score) {
          score = s;
          best = i;
        }
      });
      this.aiPlat = best < 0 ? 0 : best;
    }

    if (h.plat < 0) return [this.aiGoal > h.x + 0.2 ? 1 : this.aiGoal < h.x - 0.2 ? -1 : 0, false, false];
    const target = this.aiPlat;
    if (h.plat === target) {
      const near = this.enemies.filter((e) => e.plat === target && e.hp > 0).sort((a, b) => Math.abs(a.x - h.x) - Math.abs(b.x - h.x))[0];
      this.aiGoal = near ? near.x : m.w / 2;
      return [Math.sign(this.aiGoal - h.x) * (Math.abs(this.aiGoal - h.x) > 0.5 ? 1 : 0), false, false];
    }
    const path = route(m, h.plat, target);
    if (!path || path.length < 2) return [0, false, false];
    const cur = m.platforms[h.plat], next = m.platforms[path[1]];
    const lo = Math.max(cur.x0, next.x0) + 0.8, hi = Math.min(cur.x1, next.x1) - 0.8;
    this.aiGoal = lo <= hi ? clamp(h.x, lo, hi) : (lo + hi) / 2;
    if (next.y < cur.y && path[1] === 0) this.aiGoal = h.x; // falling to the ground: drop right here
    const d = this.aiGoal - h.x;
    if (Math.abs(d) > 0.25) return [Math.sign(d), false, false];
    return next.y > cur.y ? [0, true, false] : [0, false, true];
  }

  // ---------- combat ----------

  private hits(e: Enemy, reach: number): boolean {
    return e.hp > 0 && Math.abs(e.x - this.hero.x) <= reach + (e.boss || e.giant ? 1 : 0.3) && Math.abs(e.y - this.hero.y) < 1.8;
  }

  private near(e: Enemy, x: number, y: number, r: number): boolean {
    return e.hp > 0 && Math.hypot(e.x - x, (e.y - y) * 1.1) <= r + (e.boss || e.giant ? 1 : 0.3);
  }

  private inRange(): boolean {
    const k = this.kit;
    return this.enemies.some((e) => (k.attack === 'sweep' ? this.hits(e, k.reach) : this.near(e, this.hero.x, this.hero.y, k.reach * 0.85)));
  }

  private target(range: number): Enemy | null {
    let best: Enemy | null = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - this.hero.x, (e.y - this.hero.y) * 1.3);
      if (d <= range && d < bd) {
        best = e;
        bd = d;
      }
    }
    return best;
  }

  private densest(r: number, range = 10): Enemy | null {
    let best: Enemy | null = null, n = 0;
    for (const e of this.enemies) {
      if (e.hp <= 0 || Math.hypot(e.x - this.hero.x, e.y - this.hero.y) > range) continue;
      const c = this.enemies.reduce((k, o) => k + (this.near(o, e.x, e.y, r) ? 1 : 0), 0) + (e.boss || e.giant ? 6 : 0);
      if (c > n) {
        n = c;
        best = e;
      }
    }
    return best;
  }

  private heroAttack(dt: number, st: HeroStats) {
    this.atkTimer -= dt;
    if (this.atkTimer > 0) return;
    const k = this.kit;
    const reach = k.attack === 'sweep' ? k.reach * (1 + st.affix.cleave * 0.5) : k.reach;
    const target = k.attack === 'sweep'
      ? this.enemies.filter((e) => this.hits(e, reach)).sort((a, b) => Math.abs(a.x - this.hero.x) - Math.abs(b.x - this.hero.x))[0]
      : this.target(reach);
    if (!target) return;
    this.atkTimer = 1 / (st.aps * (1 + this.buff('aps')));
    if (Math.abs(target.x - this.hero.x) > 0.05) this.hero.facing = Math.sign(target.x - this.hero.x);
    const volleys = Math.random() < st.affix.double ? 2 : 1;
    for (let v = 0; v < volleys; v++) {
      if (k.attack === 'sweep') {
        this.events.push({ t: 'swing' });
        const dealt = this.strike(target, 1, st, false);
        for (const e of this.enemies) if (e !== target && this.hits(e, reach)) this.strike(e, 0.7 + st.affix.cleave, st, false);
        this.chainFrom(target, Math.round(st.affix.chain), 0.5, st, false);
        this.heal(dealt * st.affix.lifesteal);
      } else {
        this.fire(target, k.attack === 'arrows' ? 3 : 1, k.attack === 'arrows' ? 0.15 : 0, k.attack === 'arrows' ? 2 + st.pierce + Math.round(st.affix.cleave * 3) : 0, 1, k.attack === 'arrows' ? 18 : 13, false);
      }
    }
  }

  private fire(target: Enemy, count: number, spread: number, pierce: number, mult: number, speed: number, skill: boolean, kind?: 'pierce') {
    const h = this.hero;
    const a0 = Math.atan2(target.y + 0.5 - (h.y + 0.9), target.x - h.x);
    for (let i = 0; i < count; i++) {
      const a = a0 + (count > 1 ? (i / (count - 1) - 0.5) * 2 * spread : 0);
      this.projectiles.push({
        id: this.shotId++, kind: kind ?? (this.kit.attack === 'bolt' ? 'bolt' : 'arrow'),
        x: h.x + h.facing * 0.4, y: h.y + 0.9, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: (this.kit.reach + 4) / speed, pierce, mult, skill, hit: new Set(),
      });
    }
    this.events.push({ t: 'shot', kind: kind ?? (this.kit.attack === 'bolt' ? 'bolt' : 'arrow') });
  }

  private updateProjectiles(dt: number, st: HeroStats) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      let done = p.life <= 0 || p.x < 0 || p.x > this.map.w;
      for (const e of this.enemies) {
        if (done || e.hp <= 0 || p.hit.has(e.id)) continue;
        if (Math.abs(e.x - p.x) > (e.boss || e.giant ? 1.2 : 0.5) || Math.abs(e.y + 0.5 - p.y) > (e.boss || e.giant ? 1.8 : 0.8)) continue;
        p.hit.add(e.id);
        if (p.kind === 'bolt') {
          const r = 1.7 * (1 + st.affix.cleave);
          this.events.push({ t: 'boom', x: p.x, y: e.y, radius: r });
          const dealt = this.strike(e, p.mult, st, p.skill);
          for (const o of this.enemies) if (o !== e && this.near(o, p.x, e.y, r)) this.strike(o, p.mult * 0.6, st, p.skill);
          this.chainFrom(e, Math.round(st.affix.chain), 0.5, st, false);
          this.heal(dealt * st.affix.lifesteal);
          done = true;
        } else {
          this.heal(this.strike(e, p.mult, st, p.skill) * st.affix.lifesteal * 0.3);
          if (p.hit.size === 1) this.chainFrom(e, Math.round(st.affix.chain), 0.5, st, false);
          if (p.pierce-- <= 0) done = true;
        }
      }
      if (done) this.projectiles.splice(i, 1);
    }
  }

  /** Try to use a skill. Auto-cast only fires when it will hit something. */
  private castSkill(sk: Skill, st: HeroStats, forced: boolean): boolean {
    const ef = sk.effect;
    if (!ef) return false;
    const h = this.hero;
    const cd = () => { this.cooldowns[sk.id] = sk.cooldown * this.mods().sigCooldown; };
    switch (ef.type) {
      case 'nova': {
        const caught = this.enemies.filter((e) => this.near(e, h.x, h.y, ef.radius));
        if (!caught.length && !forced) return false;
        cd();
        this.events.push({ t: 'skill', skill: sk, x: h.x, y: h.y, radius: ef.radius, phase: 'land' });
        this.pending.push({ skill: sk, x: h.x, y: h.y, follow: true, delay: 0, ticks: ef.ticks ?? 1, every: ef.every ?? 0, kind: 'nova' });
        return true;
      }
      case 'blast': {
        const t = this.densest(ef.radius);
        if (!t && !forced) return false;
        cd();
        const x = t ? t.x : h.x + h.facing * 4, y = t ? t.y : h.y;
        this.events.push({ t: 'skill', skill: sk, x, y, radius: ef.radius, phase: 'cast' });
        this.pending.push({ skill: sk, x, y, follow: false, delay: ef.delay, ticks: ef.ticks ?? 1, every: ef.every ?? 0, kind: 'blast' });
        return true;
      }
      case 'dash': {
        const dir = h.facing;
        const ahead = this.enemies.filter((e) => e.hp > 0 && (e.x - h.x) * dir > -0.3 && Math.abs(e.x - h.x) <= ef.dist && Math.abs(e.y - h.y) < 1.8);
        if (!ahead.length && !forced) return false;
        cd();
        const from = h.x;
        const p = h.plat >= 0 ? this.map.platforms[h.plat] : { x0: 0.4, x1: this.map.w - 0.4 };
        h.x = clamp(h.x + dir * ef.dist, p.x0 + 0.2, p.x1 - 0.2);
        this.events.push({ t: 'dash', from, to: h.x, y: h.y });
        this.events.push({ t: 'skill', skill: sk, x: h.x, y: h.y, radius: 1, phase: 'land' });
        for (const e of ahead) this.strike(e, ef.mult, st, true);
        return true;
      }
      case 'buff': {
        if (!forced && !this.enemies.some((e) => this.near(e, h.x, h.y, 6))) return false;
        cd();
        this.buffs.push({ id: sk.id, until: this.clock + ef.dur, dmg: ef.dmg ?? 0, aps: ef.aps ?? 0, crit: ef.crit ?? 0, dr: ef.dr ?? 0 });
        this.events.push({ t: 'skill', skill: sk, x: h.x, y: h.y, radius: 1, phase: 'land' });
        return true;
      }
      case 'shot': {
        const t = this.target(this.kit.reach + 2);
        if (!t && !forced) return false;
        cd();
        this.events.push({ t: 'skill', skill: sk, x: h.x, y: h.y, radius: 1, phase: 'cast' });
        this.pending.push({ skill: sk, x: h.x, y: h.y, follow: true, delay: 0, ticks: ef.volleys ?? 1, every: ef.every ?? 0, kind: 'volley' });
        return true;
      }
      case 'chain': {
        const t = this.target(this.kit.reach + 2);
        if (!t) return false;
        cd();
        this.events.push({ t: 'skill', skill: sk, x: t.x, y: t.y, radius: 1, phase: 'land' });
        this.strike(t, ef.mult, st, true);
        this.chainFrom(t, ef.bounces, ef.mult, st, true, 7);
        return true;
      }
      default:
        return false;
    }
  }

  private updatePending(dt: number, st: HeroStats) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.delay -= dt;
      if (p.delay > 0) continue;
      const ef = p.skill.effect!;
      if (p.follow) {
        p.x = this.hero.x;
        p.y = this.hero.y;
      }
      if (p.kind === 'volley' && ef.type === 'shot') {
        const t = this.target(this.kit.reach + 2);
        if (t) this.fire(t, ef.count, ef.spread, ef.pierce + st.pierce, ef.mult, ef.speed, true, ef.pierce > 50 ? 'pierce' : undefined);
      } else if (ef.type === 'nova' || ef.type === 'blast') {
        if (p.ticks > 1 || p.kind === 'blast') this.events.push({ t: 'skill', skill: p.skill, x: p.x, y: p.y, radius: ef.radius, phase: 'land' });
        for (const e of this.enemies) if (this.near(e, p.x, p.y, ef.radius)) this.strike(e, ef.mult, st, true);
        if (ef.type === 'nova' && ef.heal) this.heal(st.maxHp * ef.heal);
        if (ef.type === 'nova' && ef.slow) for (const e of this.enemies) if (this.near(e, p.x, p.y, ef.radius)) e.slowT = ef.slow;
      }
      if (--p.ticks <= 0) this.pending.splice(i, 1);
      else p.delay = p.every;
    }
  }

  private chainFrom(target: Enemy, bounces: number, mult: number, st: HeroStats, skill: boolean, range = 5) {
    let from = target;
    const hit = new Set([target.id]);
    for (let c = 0; c < bounces; c++) {
      let next: Enemy | null = null, bd = range;
      for (const e of this.enemies) {
        if (e.hp <= 0 || hit.has(e.id)) continue;
        const d = Math.hypot(e.x - from.x, e.y - from.y);
        if (d < bd) {
          bd = d;
          next = e;
        }
      }
      if (!next) break;
      hit.add(next.id);
      this.events.push({ t: 'chain', from: from.id, to: next.id });
      this.strike(next, mult, st, skill);
      from = next;
    }
  }

  private heal(amount: number) {
    this.heroHp = Math.min(this.stats().maxHp, this.heroHp + amount);
  }

  private strike(e: Enemy, mult: number, st: HeroStats, skill: boolean): number {
    const m = this.mods();
    let amount = st.damage * mult * (1 + this.buff('dmg')) * (1 + m.streakDamage * this.streak) * (skill ? m.skillDamage : 1) * rand(0.9, 1.1);
    let kind: HitKind = 'normal';
    if (Math.random() < st.critChance + this.buff('crit')) {
      amount *= st.critMult;
      kind = 'crit';
      if (Math.random() < st.affix.overcharge) {
        amount *= 3;
        kind = 'mega';
      }
    }
    this.damage(e, amount, kind, st);
    if (m.leech > 0) this.heal(amount * m.leech);
    return amount;
  }

  private damage(e: Enemy, amount: number, kind: HitKind, st: HeroStats) {
    if (e.hp <= 0) return;
    e.aggro = true;
    e.hp -= amount;
    if (this.run) this.run.dealt += amount;
    this.dmgBuckets[0] += amount;
    this.events.push({ t: 'hit', id: e.id, amount, kind });
    if (e.hp > 0 && !e.boss && !e.giant && e.hp / e.maxHp < st.affix.execute) e.hp = 0;
    // A little knockback away from the hero.
    if (!e.boss && !e.giant) {
      const p = this.map.platforms[e.plat];
      e.x = clamp(e.x + Math.sign(e.x - this.hero.x || 1) * 0.12, p.x0 + 0.2, p.x1 - 0.2);
    }
  }

  private updateEnemies(dt: number, st: HeroStats, canHit: boolean) {
    const h = this.hero;
    for (const e of this.enemies) {
      const p = this.map.platforms[e.plat];
      e.slowT = Math.max(0, e.slowT - dt);
      const sameTier = Math.abs(e.y - h.y) < 1.2 && h.plat >= 0;
      if (!e.aggro && sameTier && Math.abs(e.x - h.x) < 9) e.aggro = true;
      const slow = e.slowT > 0 ? 0.4 : 1;
      const dx = h.x - e.x;
      e.actT -= dt;
      e.rush = Math.max(0, e.rush - dt);
      if (e.aggro && this.down <= 0 && e.kind.ai === 'caster' && !e.boss && !e.giant) {
        // Casters hang back and lob orbs at the hero.
        const want = Math.abs(dx) < 4 ? -Math.sign(dx) : Math.abs(dx) > 6 ? Math.sign(dx) : 0;
        e.x = clamp(e.x + want * e.kind.speed * 0.8 * slow * dt, p.x0 + 0.2, p.x1 - 0.2);
        e.dir = Math.sign(dx) || e.dir;
        if (e.actT <= 0 && Math.abs(dx) < 9 && Math.abs(e.y - h.y) < 4) {
          e.actT = 2.4 + Math.random() * 1.2;
          const tx = h.x - e.x, ty = h.y + 0.9 - (e.y + 0.8);
          const d = Math.hypot(tx, ty) || 1;
          this.enemyShots.push({ id: this.shotId++, x: e.x, y: e.y + 0.8, vx: (tx / d) * 5.5, vy: (ty / d) * 5.5, dmg: e.dmg * 1.3, life: 3 });
          this.events.push({ t: 'enemyShot' });
        }
      } else if (e.aggro && this.down <= 0) {
        // Chargers lunge when they get close.
        if (e.kind.ai === 'charger' && e.actT <= 0 && Math.abs(dx) > 1.5 && Math.abs(dx) < 5 && Math.abs(e.y - h.y) < 1.2) {
          e.actT = 3 + Math.random() * 2;
          e.rush = 0.35;
        }
        const speed = e.kind.speed * 1.5 * slow * (e.rush > 0 ? 4 : 1);
        if (Math.abs(dx) > 0.75) e.x += Math.sign(dx) * Math.min(Math.abs(dx) - 0.7, speed * dt);
        if (!e.boss && !e.giant) e.x = clamp(e.x, p.x0 + 0.2, p.x1 - 0.2);
        e.dir = Math.sign(dx) || e.dir;
      } else {
        e.x += e.dir * e.kind.speed * 0.4 * slow * dt;
        if (e.x < p.x0 + 0.4 || e.x > p.x1 - 0.4) e.dir *= -1;
        e.x = clamp(e.x, p.x0 + 0.3, p.x1 - 0.3);
      }
      if (!canHit || Math.abs(dx) > (e.boss || e.giant ? 1.8 : 0.95) || Math.abs(e.y - h.y) > 1.2) continue;
      e.atkTimer -= dt;
      if (e.atkTimer > 0) continue;
      e.atkTimer = e.boss || e.giant ? 1.6 : 1.4;
      const taken = Math.max(e.dmg * 0.2, e.dmg - st.guard) * (1 - Math.min(0.9, this.buff('dr')));
      this.heroHp -= taken;
      this.events.push({ t: 'heroHit', amount: taken });
      if (st.affix.thorns > 0) this.damage(e, st.damage * st.affix.thorns, 'reflect', st);
    }
    // Loose crowd spacing along each platform.
    const byPlat = new Map<number, Enemy[]>();
    for (const e of this.enemies) (byPlat.get(e.plat) ?? byPlat.set(e.plat, []).get(e.plat)!).push(e);
    for (const list of byPlat.values()) {
      list.sort((a, b) => a.x - b.x);
      for (let i = 1; i < list.length; i++) {
        const min = (list[i].boss || list[i].giant || list[i - 1].boss || list[i - 1].giant ? 1.2 : 0.38);
        if (list[i].x - list[i - 1].x < min) list[i].x = Math.min(list[i - 1].x + min, this.map.platforms[list[i].plat].x1 - 0.2);
      }
    }
  }

  /** Caster orbs, and telegraphed slams from guardians and bosses. */
  private updateThreats(dt: number, st: HeroStats) {
    const h = this.hero;
    const hurt = (dmg: number) => {
      const taken = Math.max(dmg * 0.2, dmg - st.guard) * (1 - Math.min(0.9, this.buff('dr')));
      this.heroHp -= taken;
      this.events.push({ t: 'heroHit', amount: taken });
    };
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const s = this.enemyShots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (Math.abs(s.x - h.x) < 0.45 && s.y > h.y + 0.1 && s.y < h.y + 1.7) {
        hurt(s.dmg);
        this.enemyShots.splice(i, 1);
      } else if (s.life <= 0) this.enemyShots.splice(i, 1);
    }
    // Guardians and bosses wind up a slam where the hero is standing.
    for (const e of this.enemies) {
      if (!(e.boss || e.giant) || !e.aggro || e.actT > 0 || Math.abs(e.x - h.x) > 9 || h.plat < 0) continue;
      e.actT = e.boss ? 4 : 5;
      const p = this.map.platforms[h.plat];
      const half = e.boss ? 3 : 2.5;
      const w: Warning = { id: this.shotId++, x0: Math.max(p.x0, h.x - half), x1: Math.min(p.x1, h.x + half), y: p.y, t: 1.2, dur: 1.2, dmg: e.dmg * 2.5 };
      this.warnings.push(w);
      this.events.push({ t: 'telegraph', x0: w.x0, x1: w.x1, y: w.y });
    }
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      w.t -= dt;
      if (w.t > 0) continue;
      const hit = h.x >= w.x0 && h.x <= w.x1 && Math.abs(h.y - w.y) < 0.6;
      if (hit) hurt(w.dmg);
      this.events.push({ t: 'slam', x: (w.x0 + w.x1) / 2, y: w.y, hit });
      this.warnings.splice(i, 1);
    }
  }

  /** Is the hero standing in a slam zone that's about to go off? Returns which way to step. */
  private dangerDir(): number {
    const h = this.hero;
    for (const w of this.warnings) {
      if (h.x >= w.x0 - 0.3 && h.x <= w.x1 + 0.3 && Math.abs(h.y - w.y) < 0.6) {
        const p = h.plat >= 0 ? this.map.platforms[h.plat] : null;
        const left = h.x - w.x0, right = w.x1 - h.x;
        const canLeft = !p || w.x0 - 0.5 > p.x0, canRight = !p || w.x1 + 0.5 < p.x1;
        if (canLeft && (left < right || !canRight)) return -1;
        if (canRight) return 1;
        return 0; // boxed in: jump instead
      }
    }
    return 2; // safe
  }

  private reap() {
    const dead = this.enemies.filter((e) => e.hp <= 0);
    if (!dead.length) return;
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    for (const e of dead) this.onKill(e);
  }

  private onKill(e: Enemy) {
    const lvl = this.level();
    const m = this.mods();
    this.s.totalKills++;
    this.rateKills++;
    this.streak++;
    this.streakTimer = STREAK_WINDOW;
    this.task('kills');
    const big = e.boss || e.giant;
    const gold = Math.ceil(0.12 * 1.05 ** lvl * (big ? 60 : e.elite ? 6 : 1) * m.gold);
    this.s.gold += gold;
    this.events.push({ t: 'kill', id: e.id, x: e.x, y: e.y, boss: big, elite: e.elite, gold });
    this.gainXp(this.xpPerKill() * (big ? 10 : e.elite ? 3 : 1));
    this.gainHeroXp(this.heroXpPerKill() * (big ? 10 : e.elite ? 3 : 1));
    if (this.run) this.run.kills++;
    if (this.run?.kind === 'worldboss') return;

    const chance = big ? 1 : e.elite ? 0.06 * this.itemFind() : 0.0006 * this.itemFind();
    if (Math.random() < chance) {
      const item = rollItem(this.s.nextId++, lvl, { luck: this.luck() + (big ? 1.5 : e.elite ? 0.5 : 0), minRarity: big ? (isBossStage(this.s.stage) ? 2 : 1) : 0 });
      this.handleDrop(item, e);
    }
  }

  private handleDrop(item: Item, at: { x: number; y: number }) {
    const v = this.verdictFor(item).kind;
    const base = { item, verdict: v, x: at.x, y: at.y };
    if (this.s.settings.autoEquip && v === 'upgrade') {
      this.wear(item, true);
      this.events.push({ t: 'drop', ...base, outcome: 'equipped', gold: 0 });
      return;
    }
    if (this.filtered(item)) {
      const g = goldValue(item);
      this.s.gold += g;
      this.events.push({ t: 'drop', ...base, outcome: 'salvaged', gold: g });
      return;
    }
    item.fresh = true;
    this.stash(item);
    this.events.push({ t: 'drop', ...base, outcome: 'bag', gold: 0 });
  }

  private stash(item: Item) {
    this.s.bag.push(item);
    if (this.s.bag.length <= this.bagCapacity()) return;
    const score = (i: Item) => i.rarity * 10 + potentialStars(i);
    const worst = this.s.bag.reduce((w, i) => (score(i) < score(w) ? i : w));
    this.salvage(worst.id);
  }

  gainXp(amount: number): string[] {
    const awakened: string[] = [];
    for (const slot of SLOTS) {
      const it = this.s.equipped[slot];
      if (it.level >= it.cap) continue;
      it.xp += amount;
      while (it.level < it.cap && it.xp >= xpToNext(it.level)) {
        it.xp -= xpToNext(it.level);
        it.level++;
        this.invalidate();
        this.events.push({ t: 'levelUp', slot, level: it.level });
        for (const a of it.awakenings) {
          if (a.level === it.level) {
            this.events.push({ t: 'awaken', item: it, affix: a.affix });
            awakened.push(`${it.name}: ${AFFIXES[a.affix].name}`);
          }
        }
      }
      if (it.level >= it.cap) it.xp = 0;
    }
    return awakened;
  }

  gainHeroXp(amount: number): number {
    const before = this.s.heroLevel;
    this.s.heroXp += amount;
    while (this.s.heroXp >= heroXpToNext(this.s.heroLevel)) {
      this.s.heroXp -= heroXpToNext(this.s.heroLevel);
      this.s.heroLevel++;
      const unlocked = this.kit.skills.filter((k) => k.level === this.s.heroLevel);
      this.events.push({ t: 'heroLevel', level: this.s.heroLevel, unlocked });
    }
    if (this.s.heroLevel !== before) {
      this.invalidate();
      this.heal(this.stats().maxHp);
    }
    return this.s.heroLevel - before;
  }

  // ---------- runs (challenge, dungeon, world boss) ----------

  private updateRun(dt: number) {
    const r = this.run;
    if (!r) return;
    r.timer -= dt;
    if (r.kind === 'challenge') {
      if (r.phase === 'waves' && r.kills >= r.quota) {
        r.phase = 'boss';
        r.timer = CHALLENGE_BOSS;
        const boss = this.spawnAt(0, clamp(this.hero.x + 8, 3, this.map.w - 3), false, isBossStage(this.s.stage) ? 'boss' : 'giant');
        r.bossId = boss.id;
        this.events.push({ t: 'boss', name: isBossStage(this.s.stage) ? boss.kind.name : `Giant ${boss.kind.name}` });
        this.events.push({ t: 'challenge', phase: 'boss', stage: this.s.stage });
      } else if (r.phase === 'boss' && !this.enemies.some((e) => e.id === r.bossId)) {
        return this.finishChallenge(true);
      }
      if (r.timer <= 0) return this.finishChallenge(false);
    } else if (r.kind === 'dungeon') {
      if (r.kills >= r.quota) return this.finishDungeon(true);
      if (r.timer <= 0) return this.finishDungeon(false);
    } else if (r.kind === 'worldboss') {
      const alive = this.enemies.some((e) => e.id === r.bossId);
      if (!alive || r.timer <= 0) this.finishWorldBoss(!alive);
    }
  }

  private finishChallenge(win: boolean) {
    const stage = this.s.stage;
    if (win) {
      this.addGold(30 * 1.06 ** stage);
      this.s.maxStage = Math.max(this.s.maxStage, stage + 1);
      this.s.prestige.bestStage = Math.max(this.s.prestige.bestStage, this.s.maxStage);
      this.s.stage = stage + 1;
      this.challengeCd = 8;
    } else this.challengeCd = 120;
    this.events.push({ t: 'challenge', phase: win ? 'win' : 'fail', stage });
    this.enterHunt();
  }

  private finishDungeon(win: boolean) {
    const r = this.run!;
    const id = r.dungeon!, floor = r.floor!;
    const d = this.s.daily;
    let reward = '';
    if (win) {
      if (floor > d.best[id]) d.best[id] = floor; // first clear of a floor is free
      else d.keys[id] = Math.max(0, d.keys[id] - 1);
      this.task('dungeons');
      reward = this.dungeonReward(id, floor);
    }
    this.events.push({ t: 'run', phase: win ? 'win' : 'fail', kind: 'dungeon', title: `Floor ${floor}`, reward });
    this.enterHunt();
  }

  private finishWorldBoss(killed: boolean) {
    const d = this.s.daily;
    const boss = this.enemies.find((e) => e.id === this.run!.bossId);
    const frac = killed ? 1 : boss ? 1 - boss.hp / boss.maxHp : 1;
    const g = Math.ceil(150 * 1.25 ** d.wbLevel * (0.25 + frac) * this.mods().gold);
    this.s.gold += g;
    let reward = `+${g} gold`;
    if (killed) {
      d.wbLevel++;
      this.s.prestige.shards += 1;
      const item = rollItem(this.s.nextId++, Math.max(this.s.maxStage, d.wbLevel * 4), { minRarity: 3 });
      this.handleDrop(item, this.hero);
      reward += ` · +1 soul shard · ${item.name}`;
    }
    this.events.push({ t: 'run', phase: killed ? 'win' : 'fail', kind: 'worldboss', title: killed ? 'World boss slain!' : `${Math.round(frac * 100)}% damage dealt`, reward });
    this.enterHunt();
  }

  private heroDied() {
    if (this.run?.kind === 'challenge') return this.finishChallenge(false);
    if (this.run?.kind === 'dungeon') return this.finishDungeon(false);
    if (this.run?.kind === 'worldboss') return this.finishWorldBoss(false);
    this.heroHp = 0;
    this.down = 2.5;
    this.projectiles = [];
    this.pending = [];
    for (const e of this.enemies) e.aggro = false;
    this.events.push({ t: 'down' });
  }

  /** Live numbers for the stats readout. */
  liveStats() {
    return {
      dps: this.dmgBuckets.slice(1).reduce((a, b) => a + b, 0) / 9,
      kpm: this.s.killRate * 60,
      goldPerHour: (this.goldBuckets.slice(1).reduce((a, b) => a + b, 0) / 59) * 3600,
    };
  }

  // ---------- offline ----------

  offlineCapHours() {
    return OFFLINE_BASE_HOURS + this.mods().offline;
  }

  applyOffline(seconds: number) {
    seconds = Math.min(seconds, this.offlineCapHours() * 3600);
    const kills = Math.floor(this.s.killRate * seconds * OFFLINE_RATE);
    const before = Object.fromEntries(SLOTS.map((s) => [s, this.s.equipped[s].level])) as Record<Slot, number>;
    const heroBefore = this.s.heroLevel;
    const goldBefore = this.s.gold;
    const awakened = this.gainXp(this.xpPerKill() * kills);
    this.gainHeroXp(this.heroXpPerKill() * kills);
    this.s.gold += Math.ceil(kills * 0.12 * 1.05 ** this.level() * 1.3 * this.mods().gold);
    this.s.daily.tasks.kills += kills;
    const drops = Math.min(150, Math.round(kills * (0.04 * 0.12 + 0.0008) * this.itemFind()));
    const kept: Item[] = [];
    let equipped = 0;
    for (let i = 0; i < drops; i++) {
      const item = rollItem(this.s.nextId++, this.level(), { luck: this.luck() });
      this.handleDrop(item, this.hero);
      const ev = this.events[this.events.length - 1];
      if (ev?.t === 'drop' && ev.outcome === 'bag') kept.push(item);
      if (ev?.t === 'drop' && ev.outcome === 'equipped') equipped++;
    }
    this.s.totalKills += kills;
    this.events = [{ t: 'map' }];
    this.heroHp = this.stats().maxHp;
    return {
      seconds, kills, drops, equipped,
      kept: kept.filter((i) => this.s.bag.includes(i)),
      gold: this.s.gold - goldBefore,
      heroLevels: [heroBefore, this.s.heroLevel] as [number, number],
      levels: SLOTS.map((s) => ({ slot: s, from: before[s], to: this.s.equipped[s].level })),
      awakened,
    };
  }
}

export type OfflineSummary = ReturnType<Game['applyOffline']>;
