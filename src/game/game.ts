import Decimal from 'break_infinity.js';
import {
  ABYSS, ABYSS_BY_ID, CARD_BY_ID, ASCEND_MILESTONES, COST_GROWTH, FURY, SOUL_POWER, CURSES, CURSES_FROM, CURSE_BY_ID, CURSE_FLOORS, AWAKEN_FLOOR, CLUTCH_SECONDS, COMPS, relicPower, relicStars, HEART_BY_ID, RARITY, RELICS, RELIC_BY_ID, TROPHIES, UPGRADES, UPG_BY_ID, bandFor, bossFor, modsFor, pickMonster,
  CARDS, CORRUPTION, GOBLIN_CARD, RAINBOW_CARD, cardId, lapOf, nextMilestone, ABILITY_BY_ID, ABILITY_BY_UPGRADE, abilityUpgrade, isTraitId,
  type AbilityId, type MilestoneId,
  type Effect, type ModId, type MonsterDef, type RaidReward, type RelicEffect, type Req, type TrophyReq, type UpgDef,
} from './data.ts';

export const SAVE_VERSION = 2;
export { COST_GROWTH };
/** COST_GROWTH^k, remembered: level costs ask for the same powers over and over. */
const costPows: Decimal[] = [];
const costPow = (k: number) => (costPows[k] ??= Decimal.pow(COST_GROWTH, k));
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
/** Damage multiplier a pair upgrade gives each partner. */
const SYNERGY_MULT = 2;
/** Seconds a kill's gold lies on the floor before it flies to the bank by itself (your hero or the cursor grabs it sooner). */
const GOLD_WAIT = 6;
/** Most piles of gold on the floor at once: past this the oldest is banked straight away. */
const MAX_DROPS = 40;
/** Base cleave once the Dwarf Brawler's Cleave is unlocked. */
const CLEAVE_BASE = 0.1;
/** Abilities stay unlocked once found (true), or are earned again every run with their traits (false). */
const ABILITIES_KEEP = false;
/** Chance the goblin snare catches a treasure goblin you didn't. */
const SNARE_CHANCE = 0.4;
/** Seconds between the Quartermaster's shopping trips. */
const REBUY_GAP = 0.5;
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
/** Clicks a second the Squire's Flurry makes for you. */
const FLURRY_RATE = 10;
/** Attacks by hand that fill the Rampage meter (about 12 seconds of holding). */
const FEVER_CLICKS = 60;
/** Attacks during a Rampage that push it to its top tier, and each tier's multiplier on all your damage (the
 *  Unstoppable upgrade and the Blood Drum add to both). */
const RAMPAGE_STEPS = [20];
const RAMPAGE_TIERS = [5, 10];
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
/** Card drops: 1 in this many kills (or catches). A 12-hour absence is ~170k kills, so ordinary cards sit at 0.001%;
 *  rainbow goblins are rare enough on their own to keep 1%, the best odds anything gets. */
const CARD_ODDS = { monster: 100_000, boss: 25_000, champ: 10_000, champBoss: 1_000, goblin: 1_000, rainbow: 100 };
/** Party damage is shown as numbers in batches this many seconds apart. */
const DPS_SHOWN_EVERY = 0.35;
/** Seconds before the boss of a floor you're farming climbs back up. */
const BOSS_RESPAWN = 2.5;
/** Share of treasure goblins that are rainbow goblins. Catching one opens the Rainbow Vault a quarter of the time
 *  (always the first time); otherwise it drops a Rainbow Haul of RAINBOW_HAUL times a goblin's plunder. */
const RAINBOW_CHANCE = 1 / 8;
const VAULT_CHANCE = 0.25;
const RAINBOW_HAUL = 3;
/** Chests in the vault (spread down a long hall that scrolls), how many of them are Rainbow Chests (2 or 3), and what a
 *  Rainbow Chest holds next to an ordinary one. There's no clock: you leave through the exit portal when you like. */
const VAULT_CHESTS = 40;
/** How far down the hall the chests go (in the floor's units; the fight's floor is about -9 to 9). */
export const VAULT_LENGTH = 62;
const RAINBOW_CHEST_WEIGHT = 10;
/** Everything in the vault together, in a floor's monster gold: about what its old room of hoarders paid. */
const VAULT_PAY = 800;
/** Opening every chest before time runs out adds this share of the vault's worth. */
const VAULT_ALL_BONUS = 0.2;
/** Loose coins scattered down the vault's hall (run over them), and the share of the vault's worth they hold together. */
const VAULT_COINS = 140;
const VAULT_COIN_SHARE = 0.15;
/** Treasure goblins loose in the vault (and 1 or 2 rainbow ones), worth this much of an ordinary chest each: gold only. */
const VAULT_GOBLINS = 12;
const VAULT_GOBLIN_CHESTS = 0.5;
const VAULT_RAINBOW_GOBLIN_CHESTS = 6;
const BASE_CRIT = 0.03;
const BASE_CRIT_MULT = 2;
const OFFLINE_CAP = 72 * 3600;
/** The way up first opens at this floor's boss. */
export const DESCEND_FLOOR = 30;
/**
 * Pacing knobs, in one place (the balance tools override them to search for good values).
 * - Souls (Part III of the idle-maths series, "lifetime" style): all the souls you've earned since your last awakening
 *   come to (gold earned since then / `soulGold`)^`soulExp` (a little gentler than a cube root), times the soul-gain
 *   bonuses. An ascent pays what's new, so about 12× the gold doubles your souls, and going deeper always pays, the same
 *   depth again only a little. Tuned so the first wall (the floor-30 boss) is worth ascending at.
 * - Heartstones the same way, a level up: (every soul ever earned / `stoneSouls`)^`stoneExp` in all; an awakening pays what's new.
 * - Heart of Fury multiplies all damage by `fury` per level. Zone bosses have `zoneBoss`× the health of mid-bosses.
 * - Up to floor 140 each floor has about `hpBase`× the health of the last, past it `deepHp`×; a monster is worth
 *   1/`goldDiv` of its health in gold. Each soul gives +`soulPower` damage. `abyssGrowth` steepens every Abyss power's
 *   cost curve (1 = as listed in data.ts).
 * - Each awakening needs `awakenStep` more floors than the last; `heartGrowth` steepens Heart power costs like
 *   `abyssGrowth` does Abyss ones.
 */
export const TUNE = { hpBase: 1.55, goldDiv: 15, soulGold: 120, soulExp: 0.28, soulPower: SOUL_POWER, abyssGrowth: 4, stoneSouls: 8, stoneExp: 0.37, fury: FURY, deepHp: 1.55, zoneBoss: 2, heartGrowth: 2, awakenStep: 10, awakenFloor: AWAKEN_FLOOR };

export interface Buff {
  id: RaidReward | 'fever' | AbilityId;
  name: string;
  t: number;
  dur: number;
  /** Companion damage multiplier. */
  dps: number;
  /** Click damage multiplier. */
  click: number;
  /** Gold multiplier. */
  gold: number;
  /** Phantom Blade speed multiplier. */
  blade?: number;
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
  /** Levels per hire: a fixed count, up to the next milestone, or as many as you can afford (-1). */
  buyMode: 1 | 10 | 100 | 'next' | -1;
  blood: boolean;
  /** Staircase interlude between zones. */
  cinematics: boolean;
  /** Cursor skin id (see CURSORS). */
  cursor: string;
  /** Quartermaster: rebuy upgrades you've bought before. */
  autoUpg: boolean;
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
  /** Every upgrade ever bought, across ascents and awakenings (the Quartermaster rebuys these). */
  upgradesKnown: string[];
  /** Seconds left before each ability can be used again (carried across ascents). */
  cooldowns: Record<string, number>;
  /** Abilities ever unlocked (they stay if ABILITIES_KEEP). */
  abilitiesFound: string[];
  /** Levels of each Abyss power. */
  abyssLv: Record<string, number>;
  /** Gold earned since the last awakening: souls are its cube root. */
  cycleGold: Decimal;
  /** Souls earned in earlier awakening cycles: heartstones are the cube root of all souls ever. */
  soulsLifetime: number;
  /** The curse on this descent (null for none), and the reward tier reached under each curse. */
  curse: string | null;
  curseTiers: Record<string, number>;
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
  floorKills: number;
  /** Move on as soon as a floor is cleared. */
  auto: boolean;
  /** Damage when a boss last beat you: auto retries once you're 50% stronger. */
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
  /** Has the first wake-up (the dungeon was a dream) played? */
  dreamSeen: boolean;
  /** Cards found since you last woke up, shown arriving in the binder next time. */
  dreamCards: string[];
  /** Bosses beaten in the last seconds, champions slain, Rainbow Vaults opened, highest Rampage tier reached. */
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
  /** The deepest floor you've already gathered souls from this cycle (0 after an awakening): gold earned at or above it
   *  gives no more souls, so a run pays souls only once it goes deeper. */
  lastAscent: number;
  settings: Settings;
}

export function newSave(): SaveState {
  return {
    v: SAVE_VERSION, gold: new Decimal(0), runGold: new Decimal(0), totalGold: new Decimal(0), kills: 0, bosses: 0, clicks: 0, crits: 0,
    owned: COMPS.map(() => 0), upgrades: [], upgradesKnown: [], cooldowns: {}, abilitiesFound: [], abyssLv: {}, cycleGold: new Decimal(0), soulsLifetime: 0, curse: null, curseTiers: {}, trophies: [], souls: 0, spentSouls: 0,
    descents: 0, raids: 0, missed: 0, fevers: 0, fervor: 0, buffs: [], raidTimer: 40,
    floor: 1, maxFloor: 1, bestFloor: 1, bestCleared: 0, floorKills: 0, auto: true, revealed: 0,
    bestDps: new Decimal(0), playTime: 0, runTime: 0, startedAt: Date.now(), lastSave: Date.now(),
    relics: {}, equipped: [], bossBest: 0, heart: {}, stones: 0, awakens: 0, dreamSeen: false, dreamCards: [], clutches: 0, champions: 0, vaults: 0, rainbows: 0, rainbowSeen: false, hero: 0, heroTips: 0, rampage: 0, cycleBest: 0, lastAscent: 0, cards: {}, slain: {},
    settings: { sfxVol: 0.8, musicVol: 0.6, muted: false, music: true, particles: true, shake: true, numbers: true, notation: 'short', buyMode: 1, blood: true, cinematics: true, cursor: 'auto', autoUpg: true },
  };
}

/** A chest in the Rainbow Vault, where it stands (the same floor space as monsters) and what's in it. */
export interface VaultChest {
  id: number;
  x: number;
  z: number;
  rainbow: boolean;
  gold: Decimal;
  open: boolean;
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
}

export type HitKind = 'click' | 'crit' | 'dps' | 'cleave' | 'auto' | 'autoCrit' | 'fever';

export type GameEvent =
  | { t: 'hit'; id: number; amount: Decimal; kind: HitKind; x?: number; y?: number }
  | { t: 'click'; crit: boolean; x: number; y: number }
  | { t: 'spawn'; id: number }
  | { t: 'kill'; id: number; gold: Decimal; boss: boolean; by: HitKind; champ?: boolean }
  | { t: 'floor'; floor: number; boss: boolean; cleared?: boolean }
  | { t: 'sweep'; floor: number; gold: Decimal }
  | { t: 'bossFail'; floor: number }
  | { t: 'bossWin'; floor: number; first: boolean; clutch?: { left: number; gold: Decimal } }
  | { t: 'retreat'; floor: number }
  | { t: 'buyComp'; comp: number; n: number }
  | { t: 'reveal'; comp: number }
  | { t: 'buyUpg'; id: string }
  | { t: 'ability'; id: AbilityId; unlocked?: boolean }
  /** A kill's gold lands on the floor (`from` is the monster), and later goes to the bank. */
  | { t: 'drop'; id: number; from: number; gold: Decimal; big: boolean }
  | { t: 'bank'; id: number; by: 'hand' | 'time' | 'all' }
  | { t: 'trophy'; id: string }
  | { t: 'raidSpawn'; id: number; from: -1 | 1; rainbow: boolean }
  | { t: 'rampage'; tier: number; click: number }
  | { t: 'vault'; on: boolean; gold: Decimal }
  | { t: 'vaultAll'; gold: Decimal }
  | { t: 'vaultCoin'; id: number; gold: Decimal }
  | { t: 'vaultGoblin'; id: number; gold: Decimal; rainbow: boolean }
  | { t: 'vaultPick' }
  | { t: 'chest'; id: number; gold: Decimal; rainbow: boolean }
  | { t: 'raidCatch'; id: number; reward: RaidReward; amount?: Decimal; buff?: Buff }
  | { t: 'raidEscape'; id: number }
  | { t: 'fever'; on: boolean }
  | { t: 'descend'; souls: number }
  | { t: 'abyss'; id: string; lv: number }
  | { t: 'curse'; id: string; tier: number }
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
  /** Phantom Blade attacks a second before buffs. */
  autoBase: number;
}

export interface Raid {
  id: number;
  from: -1 | 1;
  /** 0..1 across the chamber. */
  t: number;
  stay: number;
  rainbow: boolean;
  /** The goblin snare has had its one try at this goblin. */
  snareTried?: boolean;
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
  if (f <= 140) return new Decimal(10 * (f - 1 + TUNE.hpBase ** (f - 1)));
  return floorHp(140).times(Decimal.pow(TUNE.deepHp, f - 140));
}

export function floorGold(f: number): Decimal {
  return Decimal.max(1, floorHp(f).div(TUNE.goldDiv).ceil());
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
  private flurryAcc = 0;
  /** The floor's monsters wait here while the Rainbow Vault is open. */
  private stash: Monster[] = [];
  private vaultOn = false;
  /** The open Rainbow Vault: its chests, who went in, and what it's paid so far. */
  vault: {
    chests: VaultChest[];
    coins: { id: number; x: number; z: number; gold: Decimal; taken: boolean }[];
    goblins: { id: number; x: number; z: number; rainbow: boolean; gold: Decimal; caught: boolean }[];
    hero: number;
    gold: Decimal;
  } | null = null;
  /** A rainbow goblin was just caught: waiting for you to pick who goes through the portal. */
  vaultPick = false;
  /** Seconds since the last kill: too long and your party falls back a floor. */
  private stuckT = 0;
  private owned = new Set<string>();
  private known = new Set<string>();
  private rebuyT = 0;
  private trophySet = new Set<string>();
  private cache: Computed | null = null;
  private trophyTimer = 0;
  private autoClick = 0;
  /** Seconds until the next attack by hand can land. */
  private manualCd = 0;
  /** Held down on the battlefield (mouse, finger or Space): attack by hand at MANUAL_RATE until let go. */
  hold: { id: number | null; x: number; y: number } | null = null;
  /** Where the cursor is over the battlefield (set by the UI while Flurry runs): Flurry hits what you point at. */
  aim: { id: number | null; x: number; y: number } | null = null;
  /** Testing only (?relics=always): every boss drops a relic, every time. */
  debugRelics = false;
  /** Testing only (?cards=often): cards drop hundreds of times as often, and champion bosses are common. */
  debugCards = false;
  /** Testing only (?goblin=rainbow): every treasure goblin is a rainbow goblin that opens the vault, and they come often. */
  debugRainbow = false;
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
    // Auto-hire (the Quartermaster Heart power) is gone; whoever bought it gets the heartstones back.
    if (s.heart?.quarter) {
      s.stones = (s.stones ?? 0) + 4;
      delete s.heart.quarter;
    }
    // Before Rainbow Hauls, every rainbow goblin caught opened the vault.
    if (s.rainbows === undefined) s.rainbows = s.vaults ?? 0;
    if (s.rainbowSeen === undefined) s.rainbowSeen = (s.rainbows ?? 0) > 0;
    // The Rotting Deep's floor-45 boss used to be the Bloated Ogre: its cards and kills pass to the Sludge Walker.
    const ogre = s.cards?.['bloated-ogre'];
    if (ogre) {
      const walker = (s.cards['sludge-walker'] ??= { n: CORRUPTION.map(() => 0), gold: CORRUPTION.map(() => 0) });
      walker.n = walker.n.map((n, i) => n + (ogre.n[i] ?? 0));
      walker.gold = walker.gold.map((n, i) => n + (ogre.gold[i] ?? 0));
      walker.at ??= ogre.at;
      walker.goldAt ??= ogre.goldAt;
      delete s.cards['bloated-ogre'];
    }
    if (s.slain?.['bloated-ogre']) {
      s.slain['sludge-walker'] = (s.slain['sludge-walker'] ?? 0) + s.slain['bloated-ogre'];
      delete s.slain['bloated-ogre'];
    }
    // Companion milestone upgrades were renumbered (new levels, no end). The levels both lists share carry over;
    // the old 150/250/300/400 ones are gone.
    if (s.upgrades) {
      const OLD_TO_NEW: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 6: 5, 10: 6 };
      s.upgrades = s.upgrades.flatMap((id) => {
        const old = /^c(\d+)t(\d+)$/.exec(id);
        if (!old) return [id];
        const tier = OLD_TO_NEW[Number(old[2])];
        return tier === undefined ? [] : [`m${old[1]}_${tier}`];
      });
    }
    s.upgradesKnown ??= [...(s.upgrades ?? [])];
    // Retired upgrades (the old crit-only ones) drop out.
    s.upgrades = (s.upgrades ?? []).filter((id) => UPG_BY_ID.has(id));
    s.upgradesKnown = s.upgradesKnown.filter((id) => UPG_BY_ID.has(id));
    // Trophies that no longer exist (retired ones) shouldn't keep counting toward the trophy bonus.
    if (s.trophies) s.trophies = s.trophies.filter((id) => TROPHIES.some((t) => t.id === id));
    const fresh = newSave();
    for (const k of Object.keys(fresh) as (keyof SaveState)[]) if (s[k] === undefined) (s as unknown as Record<string, unknown>)[k] = fresh[k];
    s.settings = { ...fresh.settings, ...s.settings };
    // Abyss powers became levelled: every soul spent on the old one-off powers comes back to spend again.
    const legacy = s as unknown as { abyss?: string[]; runSouls?: number };
    if (legacy.abyss) {
      s.spentSouls = 0;
      s.abyssLv = {};
      delete legacy.abyss;
    }
    delete legacy.runSouls;
    // Saved as plain numbers (older saves) or strings (Decimal's JSON form).
    for (const k of ['gold', 'runGold', 'totalGold', 'bestDps', 'cycleGold'] as const) s[k] = new Decimal(s[k] ?? 0);
    while (s.owned.length < COMPS.length) s.owned.push(0);
    this.owned = new Set(s.upgrades);
    this.known = new Set(s.upgradesKnown);
    // Saves from before the soul formula: pick up where their souls already are (nothing owed, nothing lost).
    if (s.cycleGold.eq(0) && s.souls > 0) s.cycleGold = new Decimal(TUNE.soulGold).times(Decimal.pow(s.souls / this.soulGainMult(), 1 / TUNE.soulExp));
    if (!s.soulsLifetime && this.stonesEarned() > 0) s.soulsLifetime = Math.max(0, TUNE.stoneSouls * this.stonesEarned() ** (1 / TUNE.stoneExp) - s.souls);
    this.trophySet = new Set(s.trophies);
    // A vault doesn't survive a reload (its chests aren't saved): you're back on the floor.
    s.buffs = s.buffs.filter((b) => b.id !== 'vault');
    // Pick up where you left off on this floor (its monsters respawn, the kills so far still count).
    const kills = s.floorKills ?? 0;
    this.enterFloor(s.floor, true);
    if (!this.bossFloor()) s.floorKills = Math.min(kills, FLOOR_KILLS);
  }

  // ---------- lookups ----------

  hasUpg(id: string) {
    return this.owned.has(id);
  }

  // ---------- abilities ----------

  /** Unlocked while its companion trait is owned this run (or for good, if ABILITIES_KEEP and it was ever found). */
  abilityUnlocked(id: AbilityId) {
    const a = ABILITY_BY_ID.get(id)!;
    return this.owned.has(abilityUpgrade(a)) || (ABILITIES_KEEP && this.s.abilitiesFound.includes(id));
  }

  abilityCooldown(id: AbilityId) {
    return this.s.cooldowns[id] ?? 0;
  }

  /** Use a button ability: its buff for a while, then its cooldown (Rampage: unleash a full meter). */
  useAbility(id: AbilityId) {
    const a = ABILITY_BY_ID.get(id);
    if (id === 'rampage') return this.unleashRampage();
    if (!a || a.kind !== 'button' || !this.abilityUnlocked(id) || this.abilityCooldown(id) > 0) return false;
    const dur = a.dur ?? 0;
    const buff: Buff = { id, name: a.name, t: dur, dur, dps: 1, click: 1, gold: 1 };
    if (id === 'drums') buff.dps = 2;
    else if (id === 'treasure') buff.gold = 3;
    else if (id === 'legion') buff.blade = 10;
    this.addBuff(buff);
    this.s.cooldowns[id] = a.cooldown ?? 0;
    this.events.push({ t: 'ability', id });
    return true;
  }

  /** Share of full speed the party fights at while you're away. */
  offlineSpeed() {
    return Math.min(1, 0.25 + 0.15 * this.abyssLv('pulse'));
  }

  abyssLv(id: string) {
    return this.s.abyssLv[id] ?? 0;
  }

  hasAbyss(id: string) {
    return this.abyssLv(id) > 0;
  }

  /** A reward for how many times you've ascended. */
  milestone(id: MilestoneId) {
    return this.s.descents >= ASCEND_MILESTONES.find((m) => m.id === id)!.at;
  }

  // ---------- cursed descents ----------

  /** This curse's rule is in force (Two Curses brings Iron Wardens and Mending Dark). */
  curseActive(id: string) {
    const c = this.s.curse;
    return c === id || (c === 'two' && (id === 'iron' || id === 'mending'));
  }

  curseTier(id: string) {
    return this.s.curseTiers[id] ?? 0;
  }

  /** Curses on offer: none before CURSES_FROM ascents, then a couple, one more every 5 ascents; Two Curses once every
   *  other curse has been beaten at least once. */
  cursesOpen() {
    const d = this.s.descents;
    if (d < CURSES_FROM) return [];
    const plain = CURSES.filter((c) => c.id !== 'two');
    const open = plain.slice(0, Math.min(plain.length, 2 + Math.floor((d - CURSES_FROM) / 5)));
    if (plain.every((c) => this.curseTier(c.id) > 0)) open.push(CURSE_BY_ID.get('two')!);
    return open;
  }

  /** A cursed descent reaching its next reward floor earns that tier for good. */
  private checkCurse() {
    const id = this.s.curse;
    if (!id) return;
    const tier = this.curseTier(id);
    if (tier >= CURSE_FLOORS.length || this.s.maxFloor < CURSE_FLOORS[tier]) return;
    this.s.curseTiers[id] = tier + 1;
    this.invalidate();
    this.events.push({ t: 'curse', id, tier: tier + 1 });
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
      if (u?.bonus) out.push(u.bonus);
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
    return TUNE.soulPower + 0.002 * this.abyssLv('roots');
  }

  soulMult() {
    return 1 + this.s.souls * this.soulPower();
  }

  trophyMult() {
    // Trophy upgrades add to what each trophy gives (multiplying them compounds with every new trophy and runs away).
    let perTrophy = 0.01;
    for (const e of this.effects()) if (e.t === 'trophy') perTrophy += e.k;
    return 1 + this.s.trophies.length * perTrophy;
  }

  private compute() {
    const s = this.s;
    const effects = this.effects();
    const tier = COMPS.map(() => 1);
    const syn = COMPS.map(() => 1);
    const twin = 1 + this.abyssLv('twin');
    const whet = 1 + this.relic('click');
    let blades = 1;
    let clickDpsUpg = 0;
    let global = 0;
    let gold = 0;
    let critUpg = 0;
    let critMultUpg = 0;
    let cleaveUpg = 1;
    for (const e of effects) {
      if (e.t === 'comp') tier[e.comp] *= e.mult;
      else if (e.t === 'click') blades *= e.mult;
      else if (e.t === 'clickDps') clickDpsUpg += e.pct;
      else if (e.t === 'global') global += e.pct;
      else if (e.t === 'gold') gold += e.pct;
      else if (e.t === 'crit') {
        if (e.chance) critUpg += e.chance;
        if (e.add) critMultUpg += e.add;
      } else if (e.t === 'cleave') cleaveUpg *= 1 + e.pct;
      else if (e.t === 'syn') {
        // Flat, so a pair never outgrows the pricier companions above it.
        syn[e.a] *= SYNERGY_MULT;
        syn[e.b] *= SYNERGY_MULT;
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
      crit: this.abilityUnlocked('crit') ? parts.critBase + parts.critUpg + parts.critRelic : 0,
      critMult: (parts.critMultBase + parts.critMultUpg) * parts.critMultRelic,
      cleave: this.abilityUnlocked('cleave') && this.s.buffs.some((b) => b.id === 'cleave') ? (CLEAVE_BASE + parts.cleaveRelic) * parts.cleaveUpg : 0,
      gold: parts.goldUpg * parts.goldRelic,
      autoBase: AUTO_BASE + this.abyssLv('hands') + [0, 0.5, 1, 2][this.curseTier('silent')] + 0.5 * this.relic('phantom') + effects.reduce((sum, e) => sum + (e.t === 'auto' ? e.add : 0), 0),
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

  /** One of your clicks right now, as it lands: Rampage included, plus cleave on every other monster in the room. */
  clickTotal() {
    const fever = this.s.buffs.some((b) => b.id === 'fever') ? this.feverMult() : 1;
    return this.clickDamage().times(fever * (1 + this.cleave() * Math.max(0, this.monsters.length - 1)));
  }

  /** Everything that isn't your own clicking, per second: the party and the Phantom Blade (with its cleave). */
  dpsTotal() {
    return this.dps().plus(this.clickTotal().times(this.autoRate()));
  }

  hasUpgrade(id: string) {
    return this.owned.has(id);
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

  /** What an ability does right now, with your upgrades and relics counted (whether or not it's unlocked or running). */
  abilityText(id: AbilityId): string {
    const p = this.c.parts;
    const pct = (n: number) => `${+(n * 100).toFixed(1)}%`;
    if (id === 'crit') return `Your clicks and Phantom Blade can land critical hits: a ${pct(p.critBase + p.critUpg + p.critRelic)} chance for ×${+((p.critMultBase + p.critMultUpg) * p.critMultRelic).toFixed(2)} damage.`;
    if (id === 'cleave') return `Your clicks also hit every other monster for ${pct((CLEAVE_BASE + p.cleaveRelic) * p.cleaveUpg)} damage.`;
    if (id === 'rampage') return `Attacks charge it. Unleash for ×${+this.feverMult(0).toFixed(1)} damage for ${Math.round(this.rampageDuration())}s. Keep attacking for ×${+this.feverMult(1).toFixed(1)}.`;
    return ABILITY_BY_ID.get(id)!.desc;
  }

  goldMult() {
    return this.c.gold * this.buffMult('gold');
  }

  /** A running Rampage's multiplier on all your damage. */
  feverMult(tier = this.rampageTier) {
    return RAMPAGE_TIERS[tier] + this.rampageBonus();
  }

  /** Added to the Rampage multiplier: the Unstoppable upgrade and the Blood Drum. */
  private rampageBonus() {
    let bonus = this.relic('rampage');
    for (const e of this.effects()) if (e.t === 'fever' && e.power) bonus += e.power;
    return bonus;
  }

  /** Attacks still needed for the next Rampage tier and the multiplier it brings (null at the top tier). */
  rampageNext(): { left: number; mult: number } | null {
    if (this.rampageTier >= RAMPAGE_STEPS.length) return null;
    return { left: RAMPAGE_STEPS[this.rampageTier] - this.rampageClicks, mult: this.feverMult(this.rampageTier + 1) };
  }

  inVault() {
    return this.s.buffs.some((b) => b.id === 'vault');
  }

  monsterGold(m: Monster) {
    const k = m.boss ? 8 * (m.champ ? CHAMP_BOSS_GOLD : 1) : TRASH * (m.champ ? CHAMP_GOLD : 1);
    return Decimal.max(1, floorGold(this.s.floor).times(k)).times(this.goldMult()).ceil();
  }

  // ---------- costs ----------

  private compBase(i: number) {
    return COMPS[i].cost * 0.97 ** this.abyssLv('tithe');
  }

  compCost(i: number, n = 1) {
    return costPow(this.s.owned[i]).times(costPow(n).minus(1)).times(this.compBase(i) / (COST_GROWTH - 1)).ceil();
  }

  compQuote(i: number): { n: number; cost: Decimal } {
    const mode = this.s.settings.buyMode;
    if (mode === 'next') {
      // Up to the next milestone (one level at a time past the last).
      const next = nextMilestone(this.s.owned[i]);
      const n = next === null ? 1 : next - this.s.owned[i];
      return { n, cost: this.compCost(i, n) };
    }
    if (mode > 0) return { n: mode, cost: this.compCost(i, mode) };
    const base = Decimal.pow(COST_GROWTH, this.s.owned[i]).times(this.compBase(i));
    // Most levels affordable: solve base × (g^n − 1) / (g − 1) ≤ gold for n.
    const n = Math.max(1, Math.floor(this.s.gold.times(COST_GROWTH - 1).div(base).plus(1).log10() / Math.log10(COST_GROWTH)));
    return { n, cost: this.compCost(i, n) };
  }

  upgCost(u: UpgDef) {
    // Traits get cheaper by beating A Small Party, everything else by beating Lean Purse.
    const curse = isTraitId(u.id) ? 1 - 0.1 * this.curseTier('small') : 1 - 0.1 * this.curseTier('lean');
    return u.cost * 0.95 ** this.abyssLv('bargain') * curse;
  }

  compUnlocked(i: number) {
    return this.s.descents >= COMPS[i].depth && this.s.awakens >= (COMPS[i].heart ?? 0);
  }

  // ---------- floors and monsters ----------

  /** Move to a floor. `cleared`: because the last one was just cleared (the UI and scene make a moment of it). */
  private enterFloor(f: number, quiet = false, cleared = false, bossDelay = 0) {
    this.bankAllDrops();
    this.s.floor = f;
    this.s.floorKills = 0;
    this.stuckT = 0;
    this.monsters = [];
    this.spawnT = 0.3;
    this.bossTime = 0;
    this.stash = [];
    // During the Rainbow Vault the boss waits until the vault closes.
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
    const def = pickMonster(this.s.floor);
    const champ = Math.random() < CHAMP_CHANCE;
    const hp = floorHp(this.s.floor).times(def.hp * TRASH * (champ ? CHAMP_HP : 1));
    const m: Monster = { id: this.seq++, def, hp, max: hp, boss: false, arrive: 0.7, mods: [], champ, ...this.spot(false) };
    this.monsters.push(m);
    this.events.push({ t: 'spawn', id: m.id });
  }

  /** Who goes through the portal (any companion you have; your hero if the choice is left). */
  enterVault(comp: number) {
    if (!this.vaultPick) return false;
    this.vaultPick = false;
    this.openVault(this.s.owned[comp] > 0 ? comp : Math.max(0, this.heroIndex()));
    return true;
  }

  /** The rainbow goblin's prize: the floor steps aside for a room full of treasure chests. */
  private openVault(hero: number) {
    this.s.vaults++;
    this.stash = this.monsters;
    this.monsters = [];
    const coin = floorGold(this.s.floor).times(TRASH * VAULT_PAY * VAULT_COIN_SHARE * this.goldMult()).div(VAULT_COINS);
    const coins = Array.from({ length: VAULT_COINS }, () => ({ id: this.seq++, x: -12 + Math.random() * (VAULT_LENGTH + 10), z: -3 + Math.random() * 6.5, gold: coin, taken: false }));
    const chest = floorGold(this.s.floor).times(TRASH * VAULT_PAY * this.goldMult()).div(VAULT_CHESTS);
    const rainbows = Math.random() < 0.5 ? 2 : 1;
    const goblins = Array.from({ length: VAULT_GOBLINS + rainbows }, (_, k) => {
      const rainbow = k < rainbows;
      return { id: this.seq++, x: -6 + Math.random() * (VAULT_LENGTH - 12), z: -2.5 + Math.random() * 5, rainbow, gold: chest.times(rainbow ? VAULT_RAINBOW_GOBLIN_CHESTS : VAULT_GOBLIN_CHESTS), caught: false };
    });
    this.vault = { chests: this.makeChests(VAULT_CHESTS, Math.random() < 0.5 ? 3 : 2), coins, goblins, hero, gold: new Decimal(0) };
    this.addBuff({ id: 'vault', name: 'Rainbow Vault', t: Infinity, dur: Infinity, dps: 1, click: 1, gold: 1 });
    this.vaultOn = true;
    this.events.push({ t: 'vault', on: true, gold: new Decimal(0) });
  }

  /** Chests spread over the floor, kept apart from each other; the vault's worth shared out (a Rainbow Chest counts many). */
  private makeChests(n: number, rainbows: number): VaultChest[] {
    const worth = floorGold(this.s.floor).times(TRASH * VAULT_PAY * this.goldMult()).times(n / VAULT_CHESTS);
    const each = worth.div(n - rainbows + rainbows * RAINBOW_CHEST_WEIGHT);
    const out: VaultChest[] = [];
    for (let k = 0; k < n; k++) {
      let best = { x: 0, z: 0 };
      let bestD = -1;
      for (let tries = 0; tries < 16; tries++) {
        // (The last stretch of the hall is left clear, in front of the way out.)
        const p = { x: -8.5 + Math.random() * (VAULT_LENGTH - 10), z: -2.7 + Math.random() * 5.4 };
        const d = Math.min(99, ...out.map((c) => Math.hypot(c.x - p.x, (c.z - p.z) * 1.6)));
        if (d > bestD) {
          bestD = d;
          best = p;
        }
      }
      const rainbow = k < rainbows;
      out.push({ id: this.seq++, ...best, rainbow, gold: each.times(rainbow ? RAINBOW_CHEST_WEIGHT : 1), open: false });
    }
    return out;
  }

  /** Your vault hero reached a chest: it bursts open and pays out. Opening the last one pays a bonus on top. */
  openChest(id: number) {
    const v = this.vault;
    const c = v?.chests.find((x) => x.id === id);
    if (!v || !c || c.open) return false;
    c.open = true;
    this.earn(c.gold);
    v.gold = v.gold.plus(c.gold);
    this.events.push({ t: 'chest', id, gold: c.gold, rainbow: c.rainbow });
    if (v.chests.every((x) => x.open)) {
      const bonus = v.chests.reduce((sum, x) => sum.plus(x.gold), new Decimal(0)).times(VAULT_ALL_BONUS);
      this.earn(bonus);
      v.gold = v.gold.plus(bonus);
      this.events.push({ t: 'vaultAll', gold: bonus });
    }
    return true;
  }

  /** A loose coin on the vault floor, scooped up in passing. */
  pickCoin(id: number) {
    const v = this.vault;
    const c = v?.coins.find((x) => x.id === id);
    if (!v || !c || c.taken) return false;
    c.taken = true;
    this.earn(c.gold);
    v.gold = v.gold.plus(c.gold);
    this.events.push({ t: 'vaultCoin', id, gold: c.gold });
    return true;
  }

  /** A goblin caught in the vault: gold only (they don't count as catches, and there's no prize to roll). */
  catchVaultGoblin(id: number) {
    const v = this.vault;
    const g = v?.goblins.find((x) => x.id === id);
    if (!v || !g || g.caught) return false;
    g.caught = true;
    this.earn(g.gold);
    v.gold = v.gold.plus(g.gold);
    this.events.push({ t: 'vaultGoblin', id, gold: g.gold, rainbow: g.rainbow });
    return true;
  }

  /** Out through the exit portal (whenever you like). */
  leaveVault() {
    if (!this.vault) return false;
    this.closeVault();
    return true;
  }

  private closeVault() {
    this.vaultOn = false;
    this.s.buffs = this.s.buffs.filter((b) => b.id !== 'vault');
    this.invalidate();
    // The floor's own monsters climb back up the stairs.
    this.monsters = this.stash.map((m) => ({ ...m, arrive: m.boss ? 1.5 : 0.7 }));
    this.stash = [];
    this.spawnT = 0.3;
    this.events.push({ t: 'vault', on: false, gold: this.vault?.gold ?? new Decimal(0) });
    this.vault = null;
  }

  /** Modifiers on this floor's boss. */
  bossMods(floor = this.s.floor) {
    return modsFor(floor);
  }

  private spawnBoss() {
    const def = bossFor(this.s.floor);
    const mods = [...this.bossMods()];
    if (this.curseActive('iron') && !mods.includes('armored')) mods.push('armored');
    if (this.curseActive('mending') && !mods.includes('regen')) mods.push('regen');
    const bite = this.modBite();
    const giant = mods.includes('giant');
    // Zone bosses from floor 30 on are the walls; the first two just teach you what a boss is, and the rest before the
    // floor-30 boss are a little softer so the first wall is that one.
    const zone = this.s.floor % 10 === 0 && this.s.floor >= DESCEND_FLOOR ? TUNE.zoneBoss : 1;
    const first = this.s.floor <= 10 ? 0.5 : this.s.floor < DESCEND_FLOOR ? 0.5 : 1;
    // Only on a boss floor you've beaten before, so a champion never stands in the way of new ground.
    const champ = this.s.floor < this.s.bestFloor && Math.random() < (this.debugCards ? 0.34 : CHAMP_BOSS_CHANCE);
    const hp = floorHp(this.s.floor).times(8 * zone * first * (giant ? 1 + 2 * bite : 1) * (champ ? CHAMP_BOSS_HP : 1));
    const m: Monster = { id: this.seq++, def, hp, max: hp, boss: true, arrive: 1.5, mods, champ, ...this.spot(true) };
    this.monsters.push(m);
    let time = BOSS_TIME + 3 * this.abyssLv('patience') + 5 * this.curseTier('fuse') + Math.min(30, 3 * this.relic('time'));
    if (this.curseActive('fuse')) time *= 0.5;
    if (mods.includes('enraged')) time *= 1 - 0.5 * bite;
    if (giant || champ) time *= 1.5;
    this.bossTimeMax = time;
    this.bossTime = time;
    this.events.push({ t: 'spawn', id: m.id });
  }

  /** Share of companion damage an armored boss shrugs off. */
  armor() {
    return 0.75 * 0.7 ** this.relic('pierce') * this.modBite() * (1 - 0.2 * this.curseTier('iron'));
  }

  /** Share of its health a regenerating boss heals per second. */
  regen() {
    return 0.03 * 0.7 ** this.relic('rot') * this.modBite() * (1 - 0.25 * this.curseTier('mending'));
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
    this.dropGold(gold, m);
    this.s.kills++;
    this.killAcc++;
    this.stuckT = 0;
    if (m.champ && !m.half) this.s.champions++;
    this.events.push({ t: 'kill', id: m.id, gold, boss: m.boss, by, champ: m.champ });
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
   *  Only while auto-advancing: with auto off you're staying to farm the floor. */
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
    for (let k = 0; k < left; k++) this.rollCard(this.slay(pickMonster(floor)), false, 'sweep');
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
      this.checkCurse();
    }
  }

  /** The monster your companions are hitting: the one that's been around longest. */
  focus(): Monster | undefined {
    return this.monsters.find((m) => m.arrive <= 0);
  }

  /** Click a monster (or, if it's gone, whatever's in front). `x, y` are screen coords for numbers. */
  click(id: number | null, x: number, y: number, auto = false, flurry = false) {
    const target = (id !== null ? this.monster(id) : undefined) ?? this.focus();
    if (!target) return new Decimal(0);
    if (!auto) {
      if (this.curseActive('silent')) return new Decimal(0);
      // Flurry's clicks are on top of your own, so they don't wait for the hand's cooldown.
      if (!flurry) {
        if (this.manualCd > 0) return new Decimal(0);
        this.manualCd = 1 / MANUAL_RATE;
      }
    }
    const crit = Math.random() < this.critChance();
    const fever = this.s.buffs.some((b) => b.id === 'fever');
    let amount = this.clickDamage().times(crit ? this.critMult() : 1);
    if (fever) amount = amount.times(this.feverMult());
    const others = this.cleave() > 0 ? this.monsters.filter((m) => m !== target) : [];
    this.damage(target, amount, auto ? (crit ? 'autoCrit' : 'auto') : crit ? 'crit' : fever ? 'fever' : 'click', x, y);
    for (const m of others) if (this.monsters.includes(m)) this.damage(m, amount.times(this.cleave()), 'cleave');
    if (crit) this.s.crits++;
    if (!auto) {
      this.s.clicks++;
      this.events.push({ t: 'click', crit, x, y });
      if (fever) this.pushRampage();
      else if (this.rampageUnlocked() && !this.curseActive('norampage')) {
        let fill = 1 / FEVER_CLICKS;
        for (const e of this.effects()) if (e.t === 'fever' && e.fill) fill *= e.fill;
        fill *= (1 + 0.15 * this.abyssLv('dreams')) * (1 + 0.2 * this.curseTier('norampage'));
        this.s.fervor = Math.min(1, this.s.fervor + fill);
      }
    }
    return amount;
  }

  /** Your hero: the companion you picked, or the first one you hired if that one's gone. -1 for none (before your
   *  first hire, or when you've chosen to go without). */
  heroIndex() {
    if (this.vault) return this.vault.hero;
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
    let rate = this.c.autoBase;
    for (const b of this.s.buffs) rate *= b.blade ?? 1;
    return rate;
  }

  /** Keep attacking through a Rampage and it climbs to its top tier, with a little more time. */
  private pushRampage() {
    if (this.rampageTier >= RAMPAGE_STEPS.length) return;
    if (++this.rampageClicks < RAMPAGE_STEPS[this.rampageTier]) return;
    this.rampageTier++;
    const b = this.s.buffs.find((x) => x.id === 'fever');
    if (b) {
      b.dps = this.feverMult();
      b.t += RAMPAGE_EXTEND;
      b.dur += RAMPAGE_EXTEND;
    }
    this.s.rampage = Math.max(this.s.rampage, this.rampageTier);
    this.invalidate();
    this.events.push({ t: 'rampage', tier: this.rampageTier, click: this.feverMult() });
  }

  rampageUnlocked() {
    return this.abilityUnlocked('rampage');
  }

  /** The meter is full and waiting to be unleashed. */
  rampageReady() {
    return this.rampageUnlocked() && this.s.fervor >= 1 && !this.s.buffs.some((b) => b.id === 'fever');
  }

  /** Unleash a full Rampage meter (the player's call: save it for a boss, or spend it now). */
  unleashRampage() {
    if (!this.rampageReady()) return false;
    this.startFever();
    return true;
  }

  /** Seconds a Rampage lasts (before attacking through it adds a little). */
  rampageDuration() {
    let dur = FEVER_TIME;
    for (const e of this.effects()) if (e.t === 'fever' && e.dur) dur *= e.dur;
    return dur * (1 + 0.15 * this.abyssLv('dreams'));
  }

  private startFever() {
    this.rampageTier = 0;
    this.rampageClicks = 0;
    const dur = this.rampageDuration();
    this.s.fevers++;
    this.addBuff({ id: 'fever', name: 'Rampage', t: dur, dur, dps: this.feverMult(0), click: 1, gold: 1 });
    this.events.push({ t: 'fever', on: true });
  }

  private addBuff(b: Buff) {
    const old = this.s.buffs.findIndex((x) => x.id === b.id);
    if (old >= 0) this.s.buffs.splice(old, 1);
    this.s.buffs.push(b);
    this.invalidate();
  }

  // ---------- shop ----------

  /** Hire levels of a companion: as many as the buy mode says, or exactly `count`. */
  buyComp(i: number, count?: number) {
    if (!this.compUnlocked(i)) return false;
    // A Small Party: six companions at most on this descent.
    if (this.curseActive('small') && this.s.owned[i] === 0 && this.s.owned.filter((n) => n > 0).length >= 6) return false;
    const { n, cost } = count ? { n: count, cost: this.compCost(i, count) } : this.compQuote(i);
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
    if (this.curseActive('lean') && !isTraitId(id)) return false;
    const cost = this.upgCost(u);
    if (this.s.gold.lt(cost)) return false;
    this.s.gold = this.s.gold.minus(cost);
    this.s.upgrades.push(id);
    this.owned.add(id);
    if (!this.known.has(id)) {
      this.known.add(id);
      this.s.upgradesKnown.push(id);
    }
    const ability = ABILITY_BY_UPGRADE.get(id);
    if (ability) {
      if (!this.s.abilitiesFound.includes(ability.id)) this.s.abilitiesFound.push(ability.id);
      this.events.push({ t: 'ability', id: ability.id, unlocked: true });
    }
    this.invalidate();
    this.events.push({ t: 'buyUpg', id });
    return true;
  }

  /** Purser's Buy all: every affordable upgrade, cheapest first. */
  buyAllUpgs(onlyKnown = false) {
    let n = 0;
    for (const u of this.shopUpgrades()) {
      if (onlyKnown && !this.known.has(u.id)) continue;
      if (this.s.gold.lt(this.upgCost(u))) break;
      if (this.buyUpg(u.id)) n++;
    }
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
    const lean = this.curseActive('lean');
    return UPGRADES.filter((u) => !this.owned.has(u.id) && this.reqMet(u.req) && (!u.needs || this.abilityUnlocked(u.needs)) && (!lean || isTraitId(u.id))).sort((a, b) => a.cost - b.cost);
  }

  // ---------- treasure goblins ----------

  catchRaid(): boolean {
    const r = this.raid;
    if (!r) return false;
    this.raid = null;
    this.s.raids++;
    if (r.rainbow) this.s.rainbows++;
    if (this.cardRoll(r.rainbow ? CARD_ODDS.rainbow : CARD_ODDS.goblin)) this.giveCard(r.rainbow ? RAINBOW_CARD : GOBLIN_CARD, false, 'raid');
    if (r.rainbow && (this.s.vaults === 0 || this.debugRainbow || Math.random() < VAULT_CHANCE)) {
      this.events.push({ t: 'raidCatch', id: r.id, reward: 'vault' });
      // Everything slows while you choose who goes in.
      if (!this.vaultPick) {
        this.vaultPick = true;
        this.events.push({ t: 'vaultPick' });
      }
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
    let f = (1 + 0.1 * this.abyssLv('lure')) * (1 + 0.3 * this.relic('goblin'));
    for (const e of this.effects()) if (e.t === 'raid' && e.freq) f *= e.freq;
    this.s.raidTimer = this.debugRainbow ? 5 : (RAID_MIN + Math.random() * (RAID_MAX - RAID_MIN)) / f;
  }

  private spawnRaid() {
    const from = Math.random() < 0.5 ? -1 : 1;
    // Your first goblin is always an ordinary one; rainbows only turn up once you know what to do with a goblin.
    const rainbow = this.debugRainbow || (this.s.raids > 0 && Math.random() < RAINBOW_CHANCE);
    // The first rainbow goblin lingers, so it's caught (and the vault seen) rather than missed.
    const stay = rainbow && this.s.vaults === 0 ? RAID_STAY * 1.8 : RAID_STAY;
    this.raid = { id: this.seq++, from, t: 0, stay, rainbow };
    if (rainbow) this.s.rainbowSeen = true;
    this.events.push({ t: 'raidSpawn', id: this.raid.id, from, rainbow });
  }

  // ---------- prestige ----------

  /** Souls a zone boss on this floor pays when beaten (before relics and Heart powers). */
  soulGainMult() {
    return (1 + 0.15 * this.relic('souls')) * (1 + this.heartLv('siphon')) * [1, 1.25, 1.5, 2][this.curseTier('two')];
  }

  /** All the souls this awakening cycle has earned so far: the cube root of its gold (see TUNE). */
  soulTarget() {
    const roots = this.s.cycleGold.div(TUNE.soulGold).pow(TUNE.soulExp).toNumber();
    return Math.floor(roots * this.soulGainMult());
  }

  /** Souls a descent would pay right now: everything banked from bosses this descent. */
  pendingSouls() {
    return Math.max(0, this.soulTarget() - this.s.souls);
  }

  /** The boss floor a run has to reach before the way up opens. (After that, an ascent needs new souls, which only
   *  come from floors deeper than you've gathered from before.) */
  ascendFloor() {
    return DESCEND_FLOOR;
  }

  descendOpen() {
    return this.s.maxFloor >= this.ascendFloor();
  }

  canDescend() {
    return this.descendOpen() && (this.pendingSouls() >= 1 || this.s.curse !== null);
  }

  /** Ascend, optionally into a cursed descent (one of `cursesOpen()`). */
  descend(curse: string | null = null) {
    if (!this.canDescend()) return false;
    const gained = this.pendingSouls();
    this.s.souls += gained;
    this.s.descents++;
    this.s.lastAscent = Math.max(this.s.lastAscent, this.s.maxFloor);
    this.s.curse = curse && this.cursesOpen().some((c) => c.id === curse) ? curse : null;
    this.resetRun();
    this.events.push({ t: 'descend', souls: gained });
    return true;
  }

  /** Back to the top: gold, companions and upgrades go; souls, relics and trophies stay. */
  private resetRun() {
    const s = this.s;
    this.bankAllDrops();
    s.gold = new Decimal(0);
    s.runGold = new Decimal(0);
    s.owned = COMPS.map(() => 0);
    s.upgrades = [];
    s.buffs = [];
    s.fervor = 0;
    this.stash = [];
    this.vaultOn = false;
    this.vault = null;
    this.vaultPick = false;
    this.rampageTier = 0;
    s.revealed = 0;
    s.runTime = 0;
    s.auto = true;
    this.owned.clear();
    this.raid = null;
    this.scheduleRaid();
    const start = 1 + 5 * this.abyssLv('skip');
    s.maxFloor = start;
    this.applyStartingParty();
    this.invalidate();
    this.enterFloor(start, true);
  }

  private applyStartingParty() {
    if (!this.milestone('veterans')) return;
    for (const i of [0, 1, 2]) this.s.owned[i] = Math.max(this.s.owned[i], 25);
  }

  soulsFree() {
    return this.s.souls - this.s.spentSouls;
  }

  /** Another level of this Abyss power is on offer (it isn't maxed). */
  abyssAvailable(id: string) {
    const a = ABYSS_BY_ID.get(id);
    return !!a && this.abyssLv(id) < a.max;
  }

  abyssCost(id: string) {
    const a = ABYSS_BY_ID.get(id)!;
    const base = a.cost(0);
    return Math.ceil(base * (a.cost(this.abyssLv(id)) / base) ** TUNE.abyssGrowth);
  }

  buyAbyss(id: string) {
    if (!this.abyssAvailable(id) || this.soulsFree() < this.abyssCost(id)) return false;
    this.s.spentSouls += this.abyssCost(id);
    this.s.abyssLv[id] = this.abyssLv(id) + 1;
    this.invalidate();
    this.events.push({ t: 'abyss', id, lv: this.s.abyssLv[id] });
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
    return this.s.cycleBest >= this.awakenFloor() && this.pendingStones() >= 1;
  }

  /** The depth this cycle has to reach before the Heart can be awakened: deeper each time (`awakenStep` more floors). */
  awakenFloor() {
    return TUNE.awakenFloor + TUNE.awakenStep * this.s.awakens;
  }

  /** Heartstones an awakening would pay: grows with the deepest floor since the last one. */
  /** Every heartstone earned: the ones in hand and the ones spent on Heart powers. */
  stonesEarned() {
    let spent = 0;
    for (const id in this.s.heart) {
      const h = HEART_BY_ID.get(id);
      if (h) for (let l = 0; l < this.s.heart[id]; l++) spent += h.cost(l);
    }
    return this.s.stones + spent;
  }

  /** Heartstones an awakening would pay: the cube root of every soul ever earned, less what's already been paid. */
  pendingStones() {
    const total = Math.floor(((this.s.soulsLifetime + this.s.souls) / TUNE.stoneSouls) ** TUNE.stoneExp);
    return Math.max(0, total - this.stonesEarned());
  }

  awaken() {
    if (!this.canAwaken()) return false;
    const gained = this.pendingStones();
    const s = this.s;
    s.stones += gained;
    s.awakens++;
    s.cycleBest = 0;
    s.lastAscent = 0;
    s.soulsLifetime += s.souls;
    s.souls = 0;
    s.spentSouls = 0;
    s.cycleGold = new Decimal(0);
    s.curse = null;
    // Echoing Abyss keeps the first level of every power, free.
    const keep = this.heartLv('echo') > 0;
    s.abyssLv = keep ? Object.fromEntries(Object.entries(s.abyssLv).map(([id, lv]) => [id, Math.min(lv, 1)])) : {};
    this.resetRun();
    this.events.push({ t: 'awaken', stones: gained });
    return true;
  }

  heartCost(id: string, lv = this.heartLv(id)) {
    const h = HEART_BY_ID.get(id)!;
    const base = h.cost(0);
    return Math.ceil(base * (h.cost(lv) / base) ** TUNE.heartGrowth);
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
    if (this.s.dreamCards.length < 999) this.s.dreamCards.push(id);
    this.events.push({ t: 'card', id, gold, count: this.cardCount(id), first, src, kill });
  }

  /** Waking up: the cards found while you slept go into the binder. */
  wake() {
    const found = this.s.dreamCards;
    this.s.dreamCards = [];
    this.s.dreamSeen = true;
    return found;
  }

  /** Which kill of this monster it is (for the goblins, which catch). */
  cardKill(id: string) {
    return id === GOBLIN_CARD ? this.s.raids - this.s.rainbows : id === RAINBOW_CARD ? this.s.rainbows : this.s.slain[id] ?? 0;
  }

  /** Have you killed one of this card's monster (for the goblins, caught one)? Until then its card is a mystery. */
  /** You've met a monster once you've killed one or been as deep as it lives (goblins: once you've caught one). */
  cardMet(id: string) {
    if (id === GOBLIN_CARD) return this.s.raids - this.s.rainbows > 0;
    if (id === RAINBOW_CARD) return this.s.rainbows > 0;
    const card = CARD_BY_ID.get(id);
    return (this.s.slain[id] ?? 0) > 0 || (!!card && card.floor <= this.s.bestFloor);
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

  /** Gold on the floor, oldest first: each pile goes to the bank after GOLD_WAIT seconds, or sooner when picked up. */
  drops: { id: number; gold: Decimal; t: number }[] = [];
  private dropSeq = 0;

  private dropGold(gold: Decimal, from: Monster) {
    const id = ++this.dropSeq;
    this.drops.push({ id, gold, t: 0 });
    this.events.push({ t: 'drop', id, from: from.id, gold, big: from.boss || !!from.champ });
    if (this.drops.length > MAX_DROPS) this.bankDrop(0, 'time');
  }

  private bankDrop(i: number, by: 'hand' | 'time' | 'all') {
    const [d] = this.drops.splice(i, 1);
    this.earn(d.gold);
    this.events.push({ t: 'bank', id: d.id, by });
  }

  /** Hovering a pile of gold picks it up. */
  collectGold(id: number) {
    const i = this.drops.findIndex((d) => d.id === id);
    if (i >= 0) this.bankDrop(i, 'hand');
  }

  /** The save as it would be with the gold on the floor already banked (a save never loses it). */
  saveState(): SaveState {
    const lying = this.drops.reduce((sum, d) => sum.plus(d.gold), new Decimal(0));
    if (lying.eq(0)) return this.s;
    return { ...this.s, gold: this.s.gold.plus(lying), runGold: this.s.runGold.plus(lying), totalGold: this.s.totalGold.plus(lying) };
  }

  /** Everything on the floor goes to the bank: leaving the floor, ascending. */
  bankAllDrops() {
    while (this.drops.length) this.bankDrop(0, 'all');
  }

  private earn(n: Decimal) {
    // Souls come only from new depths: floors already gathered from (this cycle) add none.
    if (this.s.floor > this.s.lastAscent) this.s.cycleGold = this.s.cycleGold.plus(n);
    this.s.gold = this.s.gold.plus(n);
    this.s.runGold = this.s.runGold.plus(n);
    this.s.totalGold = this.s.totalGold.plus(n);
  }

  update(dt: number) {
    const s = this.s;
    s.playTime += dt;
    for (const d of this.drops) d.t += dt;
    while (this.drops.length && this.drops[0].t >= GOLD_WAIT) this.bankDrop(0, 'time');
    for (const id in s.cooldowns) if ((s.cooldowns[id] -= dt) <= 0) delete s.cooldowns[id];
    s.runTime += dt;

    const vault = this.inVault();
    if (this.vaultOn && !vault) this.closeVault();
    this.vaultOn = vault;

    // Keep the field full of monsters (bosses come alone; the vault has only its chests).
    if (vault) {
      // (Nothing spawns in the vault.)
    } else if (!this.bossFloor()) {
      this.spawnT -= dt;
      // No more monsters than the floor still needs, so it ends on its last one (farming with auto off: no limit).
      const cap = s.auto && s.floorKills < FLOOR_KILLS ? Math.min(MAX_ON, this.floorLeft()) : MAX_ON;
      if (this.spawnT <= 0 && this.monsters.length < cap) {
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
      this.events.push({ t: 'retreat', floor: s.floor });
      this.enterFloor(s.floor - 1);
    }

    // Boss timer.
    if (!vault && this.bossFloor() && this.bossTime > 0) {
      this.bossTime -= dt;
      if (this.bossTime <= 0) this.bossFailed();
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


    // Regenerating bosses.
    for (const m of this.monsters) {
      if (!m.mods.includes('regen') || m.hp.gte(m.max)) continue;
      const heal = Decimal.min(m.max.minus(m.hp), m.max.times(this.regen() * dt));
      m.hp = m.hp.plus(heal);
      this.healShown.set(m.id, (this.healShown.get(m.id) ?? new Decimal(0)).plus(heal));
    }

    // Quartermaster: rebuy what you've bought before (new upgrades stay yours to find).
    this.rebuyT -= dt;
    if (this.rebuyT <= 0) {
      this.rebuyT = REBUY_GAP;
      if (s.settings.autoUpg && this.milestone('quartermaster')) this.buyAllUpgs(true);
    }

    // Phantom Blade.
    // Attacking by hand while held down, then the Phantom Blade on its own.
    this.manualCd = Math.max(0, this.manualCd - dt);
    if (this.hold && this.manualCd <= 0) this.click(this.hold.id, this.hold.x, this.hold.y);
    if (s.buffs.some((b) => b.id === 'flurry')) {
      this.flurryAcc += dt * FLURRY_RATE;
      const at = this.aim ?? { id: null, x: -1, y: -1 };
      for (; this.flurryAcc >= 1; this.flurryAcc--) this.click(at.id, at.x, at.y, false, true);
    } else this.flurryAcc = 0;
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
      // The goblin snare (an ascent milestone) gets one try at each goblin, halfway across.
      if (this.milestone('snare') && !this.raid.snareTried && this.raid.t > 0.5) {
        this.raid.snareTried = true;
        if (Math.random() < SNARE_CHANCE) this.catchRaid();
      }
    }
    if (this.raid) {
      if (this.raid.t >= 1) {
        this.events.push({ t: 'raidEscape', id: this.raid.id });
        this.raid = null;
        s.missed++;
        this.scheduleRaid();
      }
    } else if (s.kills > 15 && !this.vault && !this.vaultPick) {
      // (None turn up while the vault is open: it has its own goblins.)
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
    this.events.push({ t: 'bossFail', floor: f });
    this.enterFloor(Math.max(1, f - 1));
  }

  /**
   * Catch up after time away: your companions farm the floor you were on.
   * Buffs, bosses and treasure don't happen while you're gone.
   */
  applyOffline(seconds: number): OfflineSummary {
    const secs = Math.min(seconds, OFFLINE_CAP);
    const pct = this.offlineSpeed();
    this.s.buffs = this.s.buffs.filter((b) => (b.t -= secs) > 0);
    for (const id in this.s.cooldowns) if ((this.s.cooldowns[id] -= secs) <= 0) delete this.s.cooldowns[id];
    this.invalidate();
    const f = isBossFloor(this.s.floor) ? Math.max(1, this.s.floor - 1) : this.s.floor;
    const perSec = Math.min(1 / SPAWN_GAP, this.baseDps().div(floorHp(f).times(TRASH)).toNumber());
    const kills = Math.floor(perSec * secs * pct);
    const gold = floorGold(f).times(kills * TRASH * this.c.gold);
    this.earn(gold);
    this.s.kills += kills;
    // Every kill counts toward its monster's card, and rolls for it, as it would have at the keyboard.
    const before = this.events.length;
    for (let k = 0; k < kills; k++) this.rollCard(this.slay(pickMonster(f)), false, 'sweep');
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
