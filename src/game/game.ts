import { DEMO, DEMO_COMPANIONS, DEMO_FIRST_CARD, DEMO_LAST_FLOOR } from '../demo.ts';
import { GAME_VERSION } from '../version.ts';
import Decimal from 'break_infinity.js';
import {
  CARD_BY_ID, COST_GROWTH, CURSES, CURSES_FROM, CURSE_BY_ID, CURSE_FLOORS, AWAKEN_FLOOR, CLUTCH_SECONDS, COMPS, relicPower, relicStars, BOUND, BOUND_BY_ID, boundCost, RARITY, RELICS, RELIC_BY_ID, TROPHIES, UPGRADES, UPG_BY_ID, bandFor, bossFor, featuredFor, modsFor, pickMonster,
  CARDS, CORRUPTION, GOBLIN_CARD, RAINBOW_CARD, cardId, lapOf, levelMult, nextMilestone, ABILITY_BY_ID, ABILITY_BY_UPGRADE, abilityUpgrade, isTraitId,
  LEGENDS, LEGEND_BY_ID, OFFER_SIZE, RESPEC_REFUND, legendCost, legendShare, summonCost, rerollCost,
  type AbilityId, type LegendId, type BoundId,
  type Attack, type Effect, type ModId, type MonsterDef, type RaidReward, type RelicEffect, type Req, type TrophyReq, type UpgDef,
} from './data.ts';

export const SAVE_VERSION = 2;
/** A card someone gave you, as its `via` ("gift:Pip"). */
export const giftVia = (who: string) => `gift:${who}`;
export { COST_GROWTH };
/** COST_GROWTH^k, remembered: level costs ask for the same powers over and over. */
const costPows: Decimal[] = [];
const costPow = (k: number) => (costPows[k] ??= Decimal.pow(COST_GROWTH, k));
/** Kills needed to clear a normal floor (fewer with the Thinning). */
export const FLOOR_KILLS = 20;
/** Seconds without attacking by hand before you count as idle (the Sleeper, the Patient), and before a streak breaks
 *  (the Unbroken). */
export const IDLE_AFTER = 60;
export const STREAK_GAP = 2;
/** The Unbroken counts a streak up to this many attacks (about 7 minutes of holding attack). */
export const STREAK_CAP = 2000;
/** Heartmarks: the first time ever you beat each 10th floor past this one's boss, a random companion gets one (+50%
 *  damage each, until you awaken). Moving one to a random companion, or to the one you choose, costs souls. */
export const MARK_FROM = 100;
export const MARK_POWER = 0.5;
export const MARK_REROLL = 1;
export const MARK_MOVE = 10;
/** A boss guards every Nth floor. */
export const BOSS_EVERY = 5;
export const BOSS_TIME = 30;
/** Monsters on the field at once (more with upgrades). */
export const MAX_ON = 10;
export const SPAWN_GAP = 0.12;
/** A party that could wipe the rest of a floor within this many seconds clears it in one sweep. */
export const SWEEP_SECONDS = 1;
/** Seconds between swept floors, so a blitz through old floors still reads as one. */
const SWEEP_GAP = 0.6;
/** Seconds a kill's gold lies on the floor before it flies to the bank by itself (your hero or the cursor grabs it sooner). */
export const GOLD_WAIT = 6;
/** Most piles of gold on the floor at once: past this the oldest is banked straight away. */
export const MAX_DROPS = 40;
/** Base cleave once the Dwarf Brawler's Cleave is unlocked. */
export const CLEAVE_BASE = 0.1;
/** Abilities stay unlocked once found (true), or are earned again every run with their traits (false). */
const ABILITIES_KEEP = false;
/** Seconds between auto-buy's shopping trips. */
export const REBUY_GAP = 0.5;
/** Ordinary monsters are a fraction of a floor's base health: many small kills. */
export const TRASH = 0.4;
/** Every click deals this share of your companions' damage, before upgrades. */
export const CLICK_DPS = 0.05;
/** Seconds between treasure goblins: rare enough to be a treat, not the engine of the game. */
export const RAID_MIN = 180;
export const RAID_MAX = 420;
export const RAID_STAY = 10;
/** Attacks by hand (a click, a tap, holding either down, or holding Space) land at most this often; extra clicks
 *  are ignored, so clicking frantically (or with an auto-clicker) gains nothing over holding the button. */
export const MANUAL_RATE = 5;
/** The Phantom Blade (the Squire's first trait) attacks on its own this many times a second before upgrades. */
export const AUTO_BASE = 1;
/** A new companion is revealed once the gold earned this run reaches this share of their price. */
export const REVEAL_AT = 0.7;
export const FEVER_TIME = 10;
/** Clicks a second the Squire's Flurry makes for you. */
export const FLURRY_RATE = 10;
/** Attacks by hand that fill the Rampage meter (about a minute of holding): a charge you save for a boss, not one
 *  that's back before the last has worn off (at 60 it was up 60% of the time). */
export const FEVER_CLICKS = 300;
/** Attacks during a Rampage that push it to its top tier, and each tier's multiplier on all your damage (the
 *  Unstoppable upgrade and the Blood Drum add to both). */
export const RAMPAGE_STEPS = [20];
export const RAMPAGE_TIERS = [2, 3];
export const DRUMS_CRIT = 0.5;
export const RAMPAGE_EXTEND = 3;
/** A clutch kill (boss beaten in its last CLUTCH_SECONDS) is worth this many times its gold. */
export const CLUTCH_GOLD = 1.5;
/** Any monster that climbs the stairs has this chance of being a champion: tougher, glowing, and worth as much gold
 *  as ten ordinary monsters. */
export const CHAMP_CHANCE = 0.01;
/** Champions start turning up once you reach this floor (and everywhere after it). */
export const CHAMP_FLOOR = 31;
export const CHAMP_HP = 6;
export const CHAMP_GOLD = 10;
/** A boss on a floor you've beaten before is now and then a champion (so farming a boss floor has a jackpot):
 *  tougher, more gold, and the only source of gold boss cards. */
export const CHAMP_BOSS_CHANCE = 1 / 20;
export const CHAMP_BOSS_HP = 3;
export const CHAMP_BOSS_GOLD = 10;
/** Card drops: 1 in this many kills (or catches). A 12-hour absence is ~170k kills, so ordinary cards sit at 0.001%;
 *  rainbow goblins are rare enough on their own to keep 1%, the best odds anything gets. */
/** How many spares each brother wants for one card. */
export const DAN_GIVES = 5;
export const VICTOR_GIVES = 10;
export const CARD_ODDS = { monster: 1_000_000, boss: 250_000, champ: 100_000, champBoss: 10_000, goblin: 10_000, rainbow: 1_000 };
/** Expeditions open the first time a companion reaches this level, and only companions at it can go. */
export const EXPEDITION_LEVEL = 1000;
/** Hours a hunter stays out at most (real time); then it comes home on its own. */
export const TRIP_HOURS = 24;
/** Bosses a hunter can kill a second on a boss floor: they come one at a time. */
const TRIP_BOSS_RATE = 0.5;
/** Hunters roll their kills for cards this often (ms of the expedition clock). */
const TRIP_ROLL_EVERY = 30_000;

/** Party damage is shown as numbers in batches this many seconds apart. */
const DPS_SHOWN_EVERY = 0.35;
/** A companion swings every SWING_GAP to SWING_GAP + SWING_SPREAD seconds, spending the damage it banked since. */
const SWING_GAP = 0.8;
const SWING_SPREAD = 0.9;
/** Seconds from a swing to its blow landing, by how the companion attacks (the scene times its animation to match):
 *  a dash to the target, a wind-up and a shot's flight, or a rune's charge. */
export const HIT_DELAY: Record<Attack, number> = {
  slash: 0.5, arrow: 0.75, fire: 1.3, dark: 1.45, bolt: 0.14, storm: 0.14, rune: 0.7,
  knife: 0.62, spear: 0.75, bomb: 1.4, orb: 1.2, ice: 0.75, flask: 1.4, bat: 1.5, skull: 1.2, light: 0.62,
};
/** Seconds before the boss of a floor you're farming climbs back up. */
export const BOSS_RESPAWN = 2.5;
/** Seconds from the boss timer running out (the party knocked flat, getting up, running for it) to falling back a
 *  floor. */
export const DOWNED_SECONDS = 3.4;
/** And on the floor above, seconds for the party to run back in before its monsters come. */
export const REGROUP_SECONDS = 1.8;
/** Share of treasure goblins that are rainbow goblins. Catching one opens the Rainbow Vault a quarter of the time
 *  (always the first time); otherwise it drops a Rainbow Haul of RAINBOW_HAUL times a goblin's plunder. */
export const RAINBOW_CHANCE = 1 / 8;
export const VAULT_CHANCE = 0.25;
export const RAINBOW_HAUL = 3;
/** Chests in the vault (spread down a long hall that scrolls), how many of them are Rainbow Chests (2 or 3), and what a
 *  Rainbow Chest holds next to an ordinary one. There's no clock: you leave through the exit portal when you like. */
export const VAULT_CHESTS = 40;
/** How far down the hall the chests go (in the floor's units; the fight's floor is about -9 to 9). */
export const VAULT_LENGTH = 62;
const RAINBOW_CHEST_WEIGHT = 10;
/** Everything in the vault together, in a floor's monster gold: about what its old room of hoarders paid. */
export const VAULT_PAY = 800;
/** Opening every chest before time runs out adds this share of the vault's worth. */
export const VAULT_ALL_BONUS = 0.2;
/** Loose coins scattered down the vault's hall (run over them), and the share of the vault's worth they hold together. */
export const VAULT_COINS = 140;
export const VAULT_COIN_SHARE = 0.15;
/** Treasure goblins loose in the vault (and 1 or 2 rainbow ones), worth this much of an ordinary chest each: gold only. */
export const VAULT_GOBLINS = 12;
const VAULT_GOBLIN_CHESTS = 0.5;
const VAULT_RAINBOW_GOBLIN_CHESTS = 6;
export const BASE_CRIT = 0.03;
export const BASE_CRIT_MULT = 2;
/** Relics and cursed descents are set aside while the prestige layers are reworked (their code stays). */
export const RELICS_ON = false;
export const CURSES_ON = false;
export const AWAKEN_ON = true;
/** The Heart shows itself this many floors before it can first be awakened. */
export const AWAKEN_TEASE = 50;
/** The way up first opens at this floor's boss. */
export const DESCEND_FLOOR = 100;
/**
 * Pacing knobs, in one place (the balance tools override them to search for good values).
 * - Souls, as in Clicker Heroes: an ascent pays 1 for every `levelsPerSoul` companion levels bought this run, plus what
 *   the run's gold bosses paid. From floor `goldBossFrom` each boss is gold (a soul boss) on a `goldBossChance` roll the
 *   first time you reach it in a run, and always on GOLD_BOSS_SURE floors; it pays floor(((floor − 75) / 25)^1.3).
 *   Each soul you keep adds `soulPower` (+10%) to all damage; Legends are the other thing to do with them.
 * - Bound souls a level up, as Clicker Heroes' Ancient Souls: floor(5 × log10(souls earned this cycle)) in all; an
 *   awakening pays what's above the best so far. Every bound soul ever earned pulls champion souls up with depth:
 *   ×(1 + p)^((floor − 100) / 10), p rising toward `pullCap` (`pullRate` of the gap left closes per bound soul).
 * - Past floor `wallFrom` every monster has `wall`× the health (Clicker Heroes' wall past zone 500): a run that hasn't
 *   awakened stops there; the Bound and bound souls carry you past it.
 * - The Ogre Chieftain adds `ogre` (×100%) to all damage per level. Zone bosses have `zoneBoss`× the health of mid-bosses.
 * - Up to floor `deepFrom` each floor has about `hpBase`× the health of the last, past it `deepHp`×. A floor's gold
 *   starts at `goldBase` and grows `goldGrowth`× a floor, `deepGold`× past `deepFrom`. Companion damage grows about
 *   gold^0.82 once levels pass 200 (×1.07 a level against ×4 every 25), so past `deepFrom` every floor is about 2%
 *   further out of reach than the last: the gap souls, Legends and Heartmarks close.
 *   A floor's health and gold are shared across its 25 monsters.
 */
export const TUNE = { bossHp: 20, bossHpFrom: 8, bossRamp: 40, bossTrait: 1, hpBase: 1.55, goldBase: 1, goldGrowth: 1.62, deepGold: 1.15, levelsPerSoul: 2000, goldBossFrom: 100, goldBossChance: 0.25, soulPower: 0.1, deepHp: 1.145, deepFrom: 100, zoneBoss: 1, hpCreep: 0.004, awakenFloor: AWAKEN_FLOOR, pullCap: 0.1, pullRate: 0.03, ogre: 1, wallFrom: 400, wall: 1000 };

/** How gold on the floor reached the bank: picked up, left too long, swept up leaving the floor, or flown up when
 *  a rainbow portal opens. */
export type BankedBy = 'hand' | 'time' | 'all' | 'sweep';

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
  /** Companion attacks without the bright flashes, light bursts and shake. */
  calm: boolean;
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
  /** Auto-buy: rebuy upgrades you've bought before. */
  autoUpg: boolean;
  /** How much of the look to draw: a fixed level, or auto (high, stepping down if frames run long). */
  graphics: 'auto' | 'high' | 'low';
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
  /** Every upgrade ever bought, across ascents and awakenings (auto-buy rebuys these). */
  upgradesKnown: string[];
  /** Seconds left before each ability can be used again (cleared by an ascent, which earns the skills again). */
  cooldowns: Record<string, number>;
  /** Abilities ever unlocked (they stay if ABILITIES_KEEP). */
  abilitiesFound: string[];
  /** Souls this run's gold bosses have paid (they come with the ascent). */
  bossSouls: number;
  /** Gold bosses this run from goldBossFrom on: true while waiting to be beaten, false once beaten (no entry: not gold,
   *  or not reached). */
  goldBosses: Record<number, boolean>;
  /** Souls were recounted under the level-and-boss rules. */
  soulsV2?: boolean;
  /** Legends summoned, by level; the ones on offer; souls spent summoning and leveling them (a respec refunds part). */
  legends: Record<string, number>;
  legendOffer: string[];
  legendSpent: number;
  /** Legend offers come from this seed and a count of rolls, so reloading (or an older save) can't fish for better ones. */
  legendSeed: number;
  legendRolls: number;
  /** This run's seed for gold boss rolls: whether a floor's boss is gold is settled for the run. */
  runSeed: number;
  /** Heartmarks on each companion, and the deepest floor that has given one (this awakening cycle). */
  marks: number[];
  markBest: number;
  /** Souls earned in earlier awakening cycles. */
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
  /** The kills on the deepest floor of this descent (maxFloor, not cleared yet), kept while you're back on an earlier
   *  floor so they're still there when you return. */
  peakKills: number;
  /** Move on as soon as a floor is cleared. */
  auto: boolean;
  /** Damage when a boss last beat you: auto retries once you're 50% stronger. */
  revealed: number;
  bestDps: Decimal;
  playTime: number;
  runTime: number;
  /** Of playTime and runTime, the seconds spent actively playing (not idle, not away). */
  activeTime: number;
  runActive: number;
  startedAt: number;
  lastSave: number;
  /** When you last attacked by hand (0: never), so a reload picks the idle clock up where it was. */
  lastAttack: number;
  /** Relic levels by id (0 / missing = not found yet). */
  relics: Record<string, number>;
  /** Relic ids in your slots. */
  equipped: string[];
  /** Deepest boss floor ever beaten: beating a deeper zone boss always drops a relic. */
  bossBest: number;
  /** The Bound's levels by id, and every bound soul awakening has paid (spent or not). */
  bound: Record<string, number>;
  boundEarned: number;
  awakens: number;
  /** Companions out hunting cards: who, on which floor, their damage when they left, and when (real time, ms). */
  expeditions: Expedition[];
  /** A companion has reached EXPEDITION_LEVEL: expeditions are open for good. */
  tripsOpen: boolean;
  /** Expeditions ever sent, and the cards they've brought home. */
  tripsSent: number;
  tripCards: number;
  /** The Heart has been teased (its button showed up, AWAKEN_TEASE floors before it can wake). */
  heartTeased: boolean;
  /** Has the first wake-up (the dungeon was a dream) played? */
  dreamSeen: boolean;
  /** You've beaten a champion boss for souls (until then, the first one you meet is pointed out). */
  soulBossDone: boolean;
  /** Your first Heartmark has been pointed out. */
  markTipSeen: boolean;
  /** Auto-buy has been pointed out (after your first ascent). */
  autoTipSeen: boolean;
  /** The party is up in the Keep: nothing happens below until they come back down, time away included. */
  inKeep: boolean;
  /** Cards you've got (found, traded or dug up) but not yet seen in the binder, as `id:lap:gold`; they slam in when you look. */
  dreamCards: string[];
  /** Trades made with the brothers. */
  trades: number;
  /** The hidden cards (in your room and around town) you've found. */
  stashes: string[];
  /** The game version this save was last played on (see GAME_VERSION); none before saves were stamped. */
  version?: string;
  /** Every ascent: how long the run took (seconds), the deepest floor it reached and the souls it paid. */
  /** Every ascent, and every awakening (`awakening`: its number, `bound`: the bound souls it paid), oldest first. */
  ascents: { time: number; floor: number; souls: number; awakening?: number; bound?: number }[];
  /** Dan and Victor have told you how collecting works (before your first trade with either). */
  brosMet: boolean;
  /** Who has given you their one spare card: Pip next door, Dan when you had next to none. */
  gifts: string[];
  /** The brothers you've gone to since they told you about collecting. */
  talkedTo: string[];
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
  /** Has the Phantom Blade's unlock been pointed out? */
  bladeSeen: boolean;
  rampage: number;
  /** Cards by id: copies per edition (normal, then each corruption; only normal is shown so far), plain and gold, and
   *  the kill (for goblins, the catch) that first dropped each. */
  /** Copies by lap; the kill your first one (and first gold one) dropped on, or the brother you traded it from. */
  cards: Record<string, { n: number[]; gold: number[]; at?: number; goldAt?: number; via?: string; goldVia?: string }>;
  /** Monsters slain per card id (a swept floor counts the monsters it wipes out). */
  slain: Record<string, number>;
  /** Of those, the ones slain in each later color (by lap; index 0 is unused, plain kills are the rest). */
  slainLaps: Record<string, number[]>;
  /** Champions of each card's monster slain, by color (lap): the ones that can drop its gold card. */
  champSlain: Record<string, number[]>;
  /** Hired the late six at their deep-floor prices (older saves are refunded and start them over). */
  latePrices?: boolean;
  /** Deepest floor reached since the last awakening. */
  cycleBest: number;
  /** The deepest floor you've already gathered souls from this cycle (0 after an awakening): gold earned at or above it
   *  gives no more souls, so a run pays souls only once it goes deeper. */
  lastAscent: number;
  settings: Settings;
}

/** A companion out hunting cards: on which floor, at what damage a second, and since when (ms) at that damage. While
 *  the party is on its floor it fights with them instead (`pausedAt`): its hunt and its clock wait, and when the party
 *  moves on it goes back to hunting at whatever strength it has by then. */
export interface Expedition {
  comp: number;
  floor: number;
  dps: string;
  start: number;
  /** Kills and seconds hunted before `start` (earlier stretches, at other strengths). */
  banked?: number;
  hunted?: number;
  pausedAt?: number;
  /** Kills already rolled for cards, and the cards found so far (handed over when the hunter comes home). */
  rolled?: number;
  found?: { id: string; gold: boolean }[];
}

export function newSave(): SaveState {
  return {
    v: SAVE_VERSION, gold: new Decimal(0), runGold: new Decimal(0), totalGold: new Decimal(0), kills: 0, bosses: 0, clicks: 0, crits: 0,
    owned: COMPS.map(() => 0), upgrades: [], upgradesKnown: [], cooldowns: {}, abilitiesFound: [], bossSouls: 0, goldBosses: {}, legends: {}, legendOffer: [], legendSpent: 0, legendSeed: freshSeed(), legendRolls: 0, runSeed: freshSeed(), marks: COMPS.map(() => 0), markBest: 0, soulsLifetime: 0, curse: null, curseTiers: {}, trophies: [], souls: 0, spentSouls: 0,
    descents: 0, raids: 0, missed: 0, fevers: 0, fervor: 0, buffs: [], raidTimer: 40,
    floor: 1, maxFloor: 1, bestFloor: 1, bestCleared: 0, floorKills: 0, peakKills: 0, auto: true, revealed: 0,
    bestDps: new Decimal(0), playTime: 0, runTime: 0, activeTime: 0, runActive: 0, startedAt: Date.now(), lastSave: Date.now(), lastAttack: 0,
    relics: {}, equipped: [], bossBest: 0, bound: {}, boundEarned: 0, awakens: 0, expeditions: [], tripsOpen: false, tripsSent: 0, tripCards: 0, heartTeased: false, dreamSeen: false, soulBossDone: false, markTipSeen: false, autoTipSeen: false, inKeep: false, dreamCards: [], trades: 0, stashes: [], ascents: [], version: GAME_VERSION, brosMet: false, gifts: [], talkedTo: [], clutches: 0, champions: 0, vaults: 0, rainbows: 0, rainbowSeen: false, hero: 0, heroTips: 0, bladeSeen: false, rampage: 0, cycleBest: 0, lastAscent: 0, cards: {}, slain: {}, slainLaps: {}, champSlain: {}, latePrices: true,
    settings: { sfxVol: 0.8, musicVol: 0.6, muted: false, music: true, particles: true, calm: false, shake: true, numbers: true, notation: 'short', buyMode: 1, blood: true, cinematics: true, cursor: 'auto', autoUpg: true, graphics: 'auto' },
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
  | { t: 'swing'; comp: number; id: number; delay: number }
  | { t: 'keep'; on: boolean }
  | { t: 'click'; crit: boolean; x: number; y: number }
  | { t: 'spawn'; id: number }
  | { t: 'kill'; id: number; gold: Decimal; boss: boolean; by: HitKind; champ?: boolean }
  | { t: 'floor'; floor: number; boss: boolean; cleared?: boolean }
  | { t: 'sweep'; floor: number; gold: Decimal }
  | { t: 'bossFail'; floor: number }
  | { t: 'bossWin'; floor: number; first: boolean; clutch?: { left: number; gold: Decimal }; souls?: number }
  | { t: 'legend'; id: LegendId; lv: number; summoned: boolean }
  | { t: 'mark'; comp: number; from?: number; moved?: boolean }
  | { t: 'buyComp'; comp: number; n: number }
  | { t: 'reveal'; comp: number }
  | { t: 'buyUpg'; id: string }
  | { t: 'ability'; id: AbilityId; unlocked?: boolean }
  /** A kill's gold lands on the floor (`from` is the monster), and later goes to the bank. */
  | { t: 'drop'; id: number; from: number; gold: Decimal; big: boolean }
  | { t: 'bank'; id: number; by: BankedBy }
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
  | { t: 'curse'; id: string; tier: number }
  | { t: 'relic'; id: string; lv: number; floor: number; equipped: boolean; star: number }
  | { t: 'split'; id: number; into: [number, number] }
  | { t: 'heal'; id: number; amount: Decimal }
  | { t: 'awaken'; bound: number }
  | { t: 'bound'; id: BoundId; lv: number }
  | { t: 'expedition'; comp: number; floor: number; kills: number; cards: number; gold: number }
  | { t: 'tripsOpen'; comp: number }
  /** A hunter found cards out on its trip (kept with it until it's home). */
  | { t: 'tripFind'; comp: number; cards: number; gold: number }
  /** A hunter fights with the party on its floor (on), or goes back to hunting (off). */
  | { t: 'hunterHere'; comp: number; on: boolean }
  /** `src`: dropped by a monster just killed, on a swept floor (no body to drop from), or by a goblin caught. */
  /** `first`: your first copy of the card at all; `newColor`: your first in this lap's color (and gold or not). */
  | { t: 'card'; id: string; gold: boolean; lap: number; count: number; first: boolean; newColor: boolean; src: 'kill' | 'sweep' | 'raid' | 'trip'; kill: number; copies?: number };

/** Every multiplier behind the damage, crit and gold numbers, kept apart for the stats page. */
export interface Parts {
  /** Per companion: tier upgrades and synergies. */
  tier: number[];
  whet: number;
  blades: number;
  upgrades: number;
  trophies: number;
  souls: number;
  /** Party traits (+25% each to every companion, multiplying), and boss traits (added up). */
  party: number;
  boss: number;
  shard: number;
  /** The Ogre Chieftain (+100% per level). */
  ogre: number;
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
  /** Each companion's share of the party's damage (0–1). */
  shares: number[];
  /** Per companion before the all-damage bonuses. */
  baseComp: number[];
  parts: Parts;
  /** Product of the all-damage bonuses (upgrades, trophies, souls, shard, the Ogre Chieftain). */
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
}

export interface OfflineSummary {
  seconds: number;
  gold: Decimal;
  kills: number;
  /** New deepest floor reached while away, if any. */
  floor?: number;
  /** Cards found while away (the same odds as at the keyboard; champions don't turn up, so no gold ones). */
  cards: Extract<GameEvent, { t: 'card' }>[];
}

/** Health of an ordinary monster on a floor (the classic clicker curve). */
export function floorHp(f: number): Decimal {
  if (f <= TUNE.deepFrom) return new Decimal(10 * (f - 1 + TUNE.hpBase ** (f - 1)));
  // Past deepFrom each floor's growth creeps up by hpCreep (in natural log) every 100 floors, so walls steepen the
  // deeper you go and runs settle into steady gains instead of snowballing.
  const n = f - TUNE.deepFrom;
  const wall = f > TUNE.wallFrom ? TUNE.wall : 1;
  return floorHp(TUNE.deepFrom).times(Decimal.pow(TUNE.deepHp, n)).times(Decimal.exp((TUNE.hpCreep * n * n) / 200)).times(wall);
}

/** Gold for one ordinary monster's worth of a floor (monsters get a share of it, like their health). */
export function floorGold(f: number): Decimal {
  if (f <= TUNE.deepFrom) return new Decimal(TUNE.goldBase).times(Decimal.pow(TUNE.goldGrowth, f - 1));
  return floorGold(TUNE.deepFrom).times(Decimal.pow(TUNE.deepGold, f - TUNE.deepFrom));
}

export const isBossFloor = (f: number) => f % BOSS_EVERY === 0;

const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

/** A number in [0, 1) fixed by two integers (mulberry32 on their mix): the same draw every time for the same pair. */
/** A Poisson draw: how many of many rare, independent chances (mean `mean`) come up. */
function poisson(mean: number) {
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())));
  const limit = Math.exp(-mean);
  let k = 0;
  for (let p = Math.random(); p > limit; p *= Math.random()) k++;
  return k;
}

function seeded(a: number, b: number) {
  let t = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Floors whose boss is always gold (from goldBossFrom): the first four zone bosses, so a first ascent pays (as Clicker
 *  Heroes' 100–130 primals), then every 100th. */
export const GOLD_BOSS_SURE = (f: number) => f >= TUNE.goldBossFrom && ((f <= 130 && f % 10 === 0) || f % 100 === 0);

/** Souls a gold boss on this floor pays (Clicker Heroes' primal bosses). */
export const bossSouls = (f: number) => Math.max(GOLD_BOSS_SURE(f) ? 2 : 1, Math.floor(((f - 75) / 25) ** 1.3));

/** What one run down to this floor pays in gold bosses on average: the sure ones and a goldBossChance share of the rest. */
export function expectedBossSouls(floor: number, chance = TUNE.goldBossChance) {
  let sum = 0;
  for (let f = TUNE.goldBossFrom; f <= floor; f += BOSS_EVERY) sum += bossSouls(f) * (GOLD_BOSS_SURE(f) ? 1 : chance);
  return sum;
}

/**
 * The whole game state and rules. Deterministic apart from Math.random (spawns, crits,
 * treasure); the renderer and UI read from it and drain `events` every frame.
 */
export class Game {
  s: SaveState;
  events: GameEvent[] = [];
  monsters: Monster[] = [];
  /** The party's damage dealt so far while there was something to fight, each companion's mark on it at its last
   *  swing, seconds to its next swing, and the blows on their way. */
  private dealt = new Decimal(0);
  private swungAt: Decimal[] = COMPS.map(() => new Decimal(0));
  private swingT: number[] = COMPS.map(() => Math.random() * SWING_SPREAD);
  private blows: { id: number; amount: Decimal; t: number }[] = [];
  /** What your hero is attacking (set by the scene each frame), or null: its blows go to the front monster then. */
  heroTarget: number | null = null;
  raid: Raid | null = null;
  /** Seconds left to beat the boss, when one is up. */
  bossTime = 0;
  bossTimeMax = BOSS_TIME;
  /** Seconds the party has left lying beaten by a boss (it does no damage meanwhile), then it falls back a floor. */
  downed = 0;
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
  private owned = new Set<string>();
  private known = new Set<string>();
  private rebuyT = 0;
  private trophySet = new Set<string>();
  private cache: Computed | null = null;
  private trophyTimer = 0;
  private autoClick = 0;
  /** Seconds until the next attack by hand can land. */
  private manualCd = 0;
  /** Seconds since you last attacked by hand, and attacks in the current streak (the Sleeper, the Patient, the
   *  Unbroken). Picked up from the save's last attack on load. */
  sinceAttack = IDLE_AFTER;
  streak = 0;
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
  /** The clock expeditions run on (ms); the simulator drives its own. */
  now: () => number = () => Date.now();

  private killAcc = 0;
  private killWindow = 0;

  constructor(s: SaveState) {
    this.s = s;
    // Saves from before awakening existed: the whole history counts as the first cycle.
    if (s.cycleBest === undefined) s.cycleBest = s.bestFloor ?? 1;
    if (s.bestCleared === undefined) s.bestCleared = (s.bestFloor ?? 1) - 1;
    s.peakKills ??= 0;
    s.slainLaps ??= {};
    s.champSlain ??= {};
    s.ascents ??= [];
    s.brosMet ??= (s.trades ?? 0) > 0;
    s.gifts ??= [];
    s.talkedTo ??= s.brosMet ? ['dan', 'victor'] : [];
    // The six companions that wait on deep floors used to cost so little there that they arrived at level 150–400.
    // Repriced to the gold at their floor (and stronger to match), they start over, with every gold piece paid back.
    if (!s.latePrices) {
      const OLD_COSTS: Record<string, number> = { wraith: 8e15, necro: 6e16, king: 7e17, angel: 8e18, ogre: 1e20, demon: 1.2e21 };
      COMPS.forEach((c, i) => {
        const level = s.owned?.[i] ?? 0;
        if (!OLD_COSTS[c.id] || !level) return;
        s.gold = new Decimal(s.gold).plus(costPow(level).minus(1).times(OLD_COSTS[c.id] / (COST_GROWTH - 1)));
        s.owned[i] = 0;
      });
      s.latePrices = true;
    }
    // Before Rainbow Hauls, every rainbow goblin caught opened the vault.
    if (s.rainbows === undefined) s.rainbows = s.vaults ?? 0;
    if (s.rainbowSeen === undefined) s.rainbowSeen = (s.rainbows ?? 0) > 0;
    // Anyone past their second ascent has met auto-buy already.
    if (s.autoTipSeen === undefined) s.autoTipSeen = (s.descents ?? 0) > 1;
    if (s.soulBossDone === undefined) s.soulBossDone = (s.descents ?? 0) > 0 || (s.bossSouls ?? 0) > 0;
    // Renamed monsters (a card's id is its name): cards and kills pass to the new name. The Rotting Deep's floor-45
    // boss used to be the Bloated Ogre; the Frozen Vault's Frost Imp became the Frost Oni when the two swapped places.
    for (const [was, now] of [['bloated-ogre', 'sludge-walker'], ['bone-archer', 'skeleton-archer'], ['hooded-bones', 'santa-skeleton'], ['frost-imp', 'frost-oni']]) {
      const old = s.cards?.[was];
      if (old) {
        const card = (s.cards[now] ??= { n: CORRUPTION.map(() => 0), gold: CORRUPTION.map(() => 0) });
        card.n = card.n.map((n, i) => n + (old.n[i] ?? 0));
        card.gold = card.gold.map((n, i) => n + (old.gold[i] ?? 0));
        card.at ??= old.at;
        card.goldAt ??= old.goldAt;
        card.via ??= old.via;
        card.goldVia ??= old.goldVia;
        delete s.cards[was];
      }
      if (s.slain?.[was]) {
        s.slain[now] = (s.slain[now] ?? 0) + s.slain[was];
        delete s.slain[was];
      }
      const laps = s.slainLaps[was];
      if (laps) {
        s.slainLaps[now] = CORRUPTION.map((_, i) => (s.slainLaps[now]?.[i] ?? 0) + (laps[i] ?? 0));
        delete s.slainLaps[was];
      }
      if (s.dreamCards) s.dreamCards = s.dreamCards.map((key) => (key.startsWith(`${was}:`) ? now + key.slice(was.length) : key));
    }
    // Goblin cards used to come in every lap's color; they're plain only now, so later copies move to the plain page.
    for (const id of [GOBLIN_CARD, RAINBOW_CARD]) {
      const card = s.cards?.[id];
      if (!card) continue;
      card.n = card.n.map((_, lap) => (lap ? 0 : card.n.reduce((a, b) => a + b, 0)));
      card.gold = card.gold.map((_, lap) => (lap ? 0 : card.gold.reduce((a, b) => a + b, 0)));
      if (s.dreamCards) s.dreamCards = [...new Set(s.dreamCards.map((key) => (key.startsWith(`${id}:`) ? key.replace(/:\d+:/, ':0:') : key)))];
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
    // Trophies that no longer exist (retired ones) shouldn't keep counting toward the trophy bonus. When some go, the
    // ones the save already qualifies for are granted quietly below (the list was rebuilt in October 2026).
    const trophiesHad = s.trophies?.length ?? 0;
    if (s.trophies) s.trophies = s.trophies.filter((id) => TROPHIES.some((t) => t.id === id));
    const trophiesRetired = (s.trophies?.length ?? 0) < trophiesHad;
    // Awakenings counted under the retired Heart powers aren't awakenings of the Heart as it is now (every one of those
    // pays at least one bound soul): such a save starts the count over, its heartstones and Heart powers gone with them.
    if (s.awakens > 0 && !s.boundEarned) {
      s.awakens = 0;
      delete (s as unknown as { stones?: number }).stones;
      delete (s as unknown as { heart?: unknown }).heart;
    }
    // Saves from before they were stamped count as the oldest version (a fresh save's stamp would say current).
    s.version ??= '0.0.0';
    const fresh = newSave();
    for (const k of Object.keys(fresh) as (keyof SaveState)[]) if (s[k] === undefined) (s as unknown as Record<string, unknown>)[k] = fresh[k];
    s.settings = { ...fresh.settings, ...s.settings };
    // The Abyss is gone: souls are recounted by the new formula, all of them unspent.
    const legacy = s as unknown as { abyss?: string[]; abyssLv?: Record<string, number>; runSouls?: number };
    const fromAbyss = !!(legacy.abyss || legacy.abyssLv);
    delete legacy.abyss;
    delete legacy.abyssLv;
    delete legacy.runSouls;
    // Saved as plain numbers (older saves) or strings (Decimal's JSON form).
    for (const k of ['gold', 'runGold', 'totalGold', 'bestDps'] as const) s[k] = new Decimal(s[k] ?? 0);
    while (s.owned.length < COMPS.length) s.owned.push(0);
    while (s.marks.length < COMPS.length) s.marks.push(0);
    // The Old Ones were renamed Legends.
    const legacyOld = s as unknown as { oldOnes?: Record<string, number>; oldOffer?: string[]; oldSpent?: number };
    if (legacyOld.oldOnes) {
      s.legends = legacyOld.oldOnes;
      s.legendOffer = legacyOld.oldOffer ?? [];
      s.legendSpent = legacyOld.oldSpent ?? 0;
      delete legacyOld.oldOnes;
      delete legacyOld.oldOffer;
      delete legacyOld.oldSpent;
    }
    this.owned = new Set(s.upgrades);
    this.known = new Set(s.upgradesKnown);
    // Souls used to come from gold: recounted as what a run to your deepest floor pays in gold bosses (the sure ones
    // and a quarter of the rest), all of them unspent.
    if (fromAbyss || !s.soulsV2) {
      delete (s as unknown as { cycleGold?: unknown }).cycleGold;
      s.souls = s.descents > 0 || fromAbyss ? Math.round(expectedBossSouls(s.bestFloor)) : 0;
      s.spentSouls = 0;
      s.soulsV2 = true;
    }
    this.trophySet = new Set(s.trophies);
    this.sinceAttack = s.lastAttack ? Math.max(0, (this.now() - s.lastAttack) / 1000) : IDLE_AFTER;
    if (trophiesRetired) this.checkTrophies(true);
    // A vault doesn't survive a reload (its chests aren't saved): you're back on the floor.
    s.buffs = s.buffs.filter((b) => b.id !== 'vault');
    // Pick up where you left off on this floor (its monsters respawn, the kills so far still count).
    const kills = s.floorKills ?? 0;
    this.enterFloor(s.floor, true);
    if (!this.bossFloor()) s.floorKills = Math.min(kills, this.killsNeeded());
  }

  // ---------- lookups ----------

  hasUpg(id: string) {
    return this.owned.has(id);
  }

  // ---------- abilities ----------

  /** Unlocked while its companion trait is owned this run (or for good, if ABILITIES_KEEP and it was ever found). */
  abilityUnlocked(id: AbilityId) {
    const a = ABILITY_BY_ID.get(id)!;
    if (this.away(a.comp)) return false;
    return this.owned.has(abilityUpgrade(a)) || (ABILITIES_KEEP && this.s.abilitiesFound.includes(id));
  }

  abilityCooldown(id: AbilityId) {
    return this.s.cooldowns[id] ?? 0;
  }

  /** Use a button ability: its buff for a while, then its cooldown (Rampage: unleash a full meter). */
  useAbility(id: AbilityId) {
    if (this.downed > 0) return false;
    const a = ABILITY_BY_ID.get(id);
    if (id === 'rampage') return this.unleashRampage();
    if (!a || a.kind !== 'button' || !this.abilityUnlocked(id) || this.abilityCooldown(id) > 0) return false;
    const dur = this.abilityDuration(id);
    const buff: Buff = { id, name: a.name, t: dur, dur, dps: 1, click: 1, gold: 1 };
    if (id === 'treasure') buff.gold = 3;
    this.addBuff(buff);
    this.s.cooldowns[id] = (a.cooldown ?? 0) * (1 - 0.75 * legendShare(this.legendLv('restless')));
    this.events.push({ t: 'ability', id });
    return true;
  }

  /** Share of full speed the party fights at while you're away. */
  /** A reward for how many times you've awakened. */
  /** Auto-buy opens with your first ascent, when there's a whole shop to buy back. */
  autoUpgOpen() {
    return this.s.descents > 0 || this.s.awakens > 0;
  }


  // ---------- cursed descents ----------

  /** This curse's rule is in force (Two Curses brings Iron Wardens and Mending Dark). */
  curseActive(id: string) {
    if (!CURSES_ON) return false;
    const c = this.s.curse;
    return c === id || (c === 'two' && (id === 'iron' || id === 'mending'));
  }

  curseTier(id: string) {
    if (!CURSES_ON) return 0;
    return this.s.curseTiers[id] ?? 0;
  }

  /** Curses on offer: none before CURSES_FROM ascents, then a couple, one more every 5 ascents; Two Curses once every
   *  other curse has been beaten at least once. */
  cursesOpen() {
    const d = this.s.descents;
    if (!CURSES_ON || d < CURSES_FROM) return [];
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
      // An away companion's traits go with it.
      if (isTraitId(id) && this.away(Number(/^m(\d+)_/.exec(id)![1]))) continue;
      const u = UPG_BY_ID.get(id);
      if (u) out.push(u.effect);
      if (u?.bonus) out.push(u.bonus);
    }
    return out;
  }

  boundLv(id: BoundId) {
    return this.s.bound[id] ?? 0;
  }

  relicLv(id: string) {
    return this.s.relics[id] ?? 0;
  }

  relicSlots() {
    return 3;
  }

  /** Level of the equipped relic with this effect (0 if none is slotted). */
  relic(e: RelicEffect) {
    if (!RELICS_ON) return 0;
    let lv = 0;
    for (const id of this.s.equipped) {
      const d = RELIC_BY_ID.get(id);
      if (d && d.effect === e) lv += relicPower(this.relicLv(id));
    }
    return lv;
  }

  /** How much of a boss modifier's bite is left after Warden's Bane (1 → 0.25). */
  modBite() {
    return 1;
  }

  /** +1% damage a trophy, added up (multiplying them compounds with every new trophy and runs away). */
  trophyMult() {
    return 1 + this.s.trophies.length * 0.01;
  }

  private compute() {
    const s = this.s;
    const effects = this.effects();
    const tier = COMPS.map(() => 1);
    const whet = 1 + this.relic('click');
    let blades = 1;
    let clickDpsUpg = 0;
    let global = 0;
    let party = 1;
    let boss = 0;
    let gold = 0;
    let critUpg = 0;
    let critMultUpg = 0;
    let cleaveUpg = 1;
    for (const e of effects) {
      if (e.t === 'comp') tier[e.comp] *= e.mult;
      else if (e.t === 'click') blades *= e.mult;
      else if (e.t === 'clickDps') clickDpsUpg += e.pct;
      else if (e.t === 'global') global += e.pct;
      else if (e.t === 'party') party *= e.mult;
      else if (e.t === 'boss') boss += e.pct * TUNE.bossTrait;
      else if (e.t === 'gold') gold += e.pct;
      else if (e.t === 'crit') {
        if (e.chance) critUpg += e.chance;
        if (e.add) critMultUpg += e.add;
      } else if (e.t === 'cleave') cleaveUpg *= 1 + e.pct;
    }
    // Every multiplier, kept apart so the stats page can show where the numbers come from.
    const parts: Parts = {
      tier, whet, blades,
      upgrades: 1 + global,
      trophies: this.trophyMult(),
      souls: this.soulMult(),
      party, boss: 1 + boss,
      shard: 1 + this.relic('all'),
      ogre: 1 + TUNE.ogre * this.boundLv('ogre'),
      banner: 1 + 0.5 * this.relic('party'),
      clickDps: CLICK_DPS + clickDpsUpg + 0.1 * this.relic('oath'),
      clickDpsUpg, oath: 0.1 * this.relic('oath'),
      critBase: BASE_CRIT, critUpg, critRelic: Math.min(0.3, 0.02 * this.relic('critChance')),
      critMultBase: BASE_CRIT_MULT, critMultUpg, critMultRelic: 1 + 0.5 * this.relic('critMult'),
      cleaveUpg, cleaveRelic: 0.2 * this.relic('cleave'),
      goldUpg: 1 + gold, goldRelic: 1 + 0.5 * this.relic('gold'),
    };
    const all = new Decimal(parts.ogre * parts.upgrades * parts.trophies * parts.souls * parts.shard);
    // A companion away hunting deals nothing here.
    const baseComp = COMPS.map((c, i) => (this.away(i) ? 0 : c.dps * s.owned[i] * levelMult(s.owned[i]) * tier[i] * (1 + MARK_POWER * s.marks[i])));
    const perComp = baseComp.map((b) => all.times(b * parts.party * parts.banner));
    const dps = perComp.reduce((a, b) => a.plus(b), new Decimal(0));
    const shares = perComp.map((d) => (dps.gt(0) ? d.div(dps).toNumber() : 0));
    const click = all.times(whet * blades).plus(dps.times(parts.clickDps)).times(1 + 0.1 * this.legendLv('fist'));
    this.cache = {
      dps, perComp, shares, baseComp, parts, all, click,
      crit: this.abilityUnlocked('crit') ? parts.critBase + parts.critUpg + parts.critRelic : 0,
      critMult: (parts.critMultBase + parts.critMultUpg) * parts.critMultRelic * (1 + 0.15 * this.legendLv('needle')),
      cleave: this.abilityUnlocked('cleave') && this.s.buffs.some((b) => b.id === 'cleave') ? (CLEAVE_BASE + parts.cleaveRelic) * parts.cleaveUpg : 0,
      gold: parts.goldUpg * parts.goldRelic * (1 + 0.05 * this.legendLv('hoard')),
      autoBase: AUTO_BASE + [0, 0.5, 1, 2][this.curseTier('silent')] + 0.5 * this.relic('phantom') + effects.reduce((sum, e) => sum + (e.t === 'auto' ? e.add : 0), 0),
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
    return this.c.dps.times(this.buffMult('dps') * this.liveMult());
  }

  compDps(i: number) {
    return this.c.perComp[i];
  }

  /** Damage one more level of this companion would add (before buffs): linear in its level, with a ×4 every 25 from 200. */
  compNext(i: number) {
    const c = this.c;
    const n = this.s.owned[i];
    return c.all.times(COMPS[i].dps * ((n + 1) * levelMult(n + 1) - n * levelMult(n)) * c.parts.tier[i] * (1 + MARK_POWER * this.s.marks[i]) * c.parts.party * c.parts.banner);
  }

  clickDamage() {
    return this.c.click.times(this.buffMult('click') * (1 + 0.0001 * this.legendLv('unbroken') * this.streak));
  }

  /** One of your clicks right now, as it lands, plus cleave on every other monster in the room. (Rampage is the party's,
   *  not your clicks'.) */
  clickTotal() {
    return this.clickDamage().times(1 + this.cleave() * Math.max(0, this.monsters.length - 1));
  }

  /** Everything that isn't your own clicking, per second: the party and the Phantom Blade (with its cleave). */
  dpsTotal() {
    return this.dps().plus(this.clickTotal().times(this.autoRate() * this.sleeperMult()));
  }

  hasUpgrade(id: string) {
    return this.owned.has(id);
  }

  /** War Drums, while they play, add DRUMS_CRIT to the chance. */
  critChance() {
    return Math.min(1, this.c.crit + (this.s.buffs.some((b) => b.id === 'drums') ? DRUMS_CRIT : 0));
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
    if (id === 'blade') return `Attacks the front monster for you, ${this.c.autoBase === 1 ? 'once' : `${+this.c.autoBase.toFixed(1)} times`} a second.`;
    if (id === 'cleave') return `Your clicks also hit every other monster for ${pct((CLEAVE_BASE + p.cleaveRelic) * p.cleaveUpg)} damage.`;
    if (id === 'rampage') return `Charged by attacking. Your party deals ×${+this.feverMult(0).toFixed(1)} damage for ${Math.round(this.rampageDuration())}s.`;
    return ABILITY_BY_ID.get(id)!.desc;
  }

  goldMult() {
    return this.c.gold * this.buffMult('gold') * (this.idle() ? 1 + 0.5 * this.legendLv('patient') : 1);
  }

  /** A running Rampage's multiplier on your party's damage. */
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
    return COMPS[i].cost * 0.95 ** this.legendLv('haggler');
  }

  compCost(i: number, n = 1) {
    return costPow(this.s.owned[i]).times(costPow(n).minus(1)).times(this.compBase(i) / (COST_GROWTH - 1)).ceil();
  }

  compQuote(i: number): { n: number; cost: Decimal } {
    const mode = this.s.settings.buyMode;
    if (mode === 'next') {
      // Up to the next trait or ×4 level; someone not yet hired is just hired.
      const n = this.s.owned[i] === 0 ? 1 : nextMilestone(i, this.s.owned[i]) - this.s.owned[i];
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
    return u.cost * curse;
  }

  /** Who stands in the party: those hired this run (and the Squire up in the Keep before anyone is). */
  inParty(i: number) {
    return (this.s.owned[i] > 0 && !this.away(i)) || (this.s.inKeep && i === 0 && this.s.owned.every((n) => n === 0));
  }

  compUnlocked(i: number) {
    if (DEMO && i >= DEMO_COMPANIONS) return false;
    // Floor gates count this awakening's depth: an awakening locks them again until you're back down there.
    return this.s.cycleBest >= COMPS[i].floor && this.s.awakens >= (COMPS[i].heart ?? 0);
  }

  // ---------- floors and monsters ----------

  /** Move to a floor. `cleared`: because the last one was just cleared (the UI and scene make a moment of it).
   *  `spawnDelay`: seconds before its first monster (or its boss) comes. */
  private enterFloor(f: number, quiet = false, cleared = false, spawnDelay = 0) {
    this.bankAllDrops();
    const s = this.s;
    // Stepping off the deepest floor keeps its kills, and coming back to it picks them up again (its monsters respawn).
    if (s.floor === s.maxFloor && !isBossFloor(s.floor)) s.peakKills = s.floorKills;
    s.floor = f;
    this.blows = [];
    s.floorKills = f === s.maxFloor && !isBossFloor(f) ? Math.min(s.peakKills, this.killsNeeded()) : 0;
    this.monsters = [];
    this.spawnT = 0.3;
    this.bossTime = 0;
    this.downed = 0;
    this.stash = [];
    // During the Rainbow Vault the boss waits until the vault closes.
    if (spawnDelay) this.spawnT = spawnDelay;
    else if (isBossFloor(f) && !this.inVault()) this.spawnBoss();
    if (!quiet) this.events.push({ t: 'floor', floor: f, boss: isBossFloor(f), cleared });
  }

  /** The demo's last boss is beaten: the game stops here (the stairs play out, then the end screen). */
  demoOver() {
    return DEMO && this.s.bestCleared >= DEMO_LAST_FLOOR;
  }

  /** Up to the Keep, the castle above the dungeon: the floor empties, and nothing happens below until you're back. */
  enterKeep() {
    if (this.s.inKeep || this.vault) return false;
    this.bankAllDrops();
    this.raid = null;
    this.s.inKeep = true;
    this.enterFloor(this.s.floor, true);
    this.monsters = [];
    this.bossTime = 0;
    this.events.push({ t: 'keep', on: true });
    return true;
  }

  /** Back down to the floor you left (on it fresh: its monsters come again, a boss fight starts over). */
  leaveKeep() {
    if (!this.s.inKeep) return false;
    this.s.inKeep = false;
    this.enterFloor(this.s.floor, true);
    this.events.push({ t: 'keep', on: false });
    return true;
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
    return Math.max(0, this.killsNeeded() - this.s.floorKills);
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

  championsOn() {
    return this.s.bestFloor >= CHAMP_FLOOR || this.s.descents > 0 || this.s.awakens > 0;
  }

  private spawn() {
    const def = pickMonster(this.s.floor);
    const champ = this.championsOn() && Math.random() < CHAMP_CHANCE;
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
    const coin = floorGold(this.s.floor).times(TRASH * VAULT_PAY * VAULT_COIN_SHARE * this.goldMult() * this.goblinKing()).div(VAULT_COINS);
    const coins = Array.from({ length: VAULT_COINS }, () => ({ id: this.seq++, x: -12 + Math.random() * (VAULT_LENGTH + 10), z: -3 + Math.random() * 6.5, gold: coin, taken: false }));
    const chest = floorGold(this.s.floor).times(TRASH * VAULT_PAY * this.goldMult() * this.goblinKing()).div(VAULT_CHESTS);
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
    const worth = floorGold(this.s.floor).times(TRASH * VAULT_PAY * this.goldMult() * this.goblinKing()).times(n / VAULT_CHESTS);
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
    const zone = this.s.floor % 10 === 0 && this.s.floor >= DESCEND_FLOOR ? TUNE.zoneBoss : 1;
    const first = this.s.floor <= 10 ? 0.5 : this.s.floor < DESCEND_FLOOR ? 0.5 : 1;
    const champ = this.goldBoss(this.s.floor);
    // Gold bosses from goldBossFrom are soul bosses at their floor's usual strength, so bad luck never walls a push.
    const champHp = champ && this.s.floor < TUNE.goldBossFrom ? CHAMP_BOSS_HP : 1;
    // Bosses toughen over the first floors (from bossHpFrom to bossHp by floor bossRamp): the opening stays gentle, and
    // further down they're the walls you go back and grow stronger for.
    const toughness = TUNE.bossHpFrom + (TUNE.bossHp - TUNE.bossHpFrom) * Math.min(1, (this.s.floor - 1) / TUNE.bossRamp);
    const wither = this.witherMult();
    const hp = floorHp(this.s.floor).times(toughness * zone * first * (giant ? 1 + 2 * bite : 1) * champHp * wither);
    const m: Monster = { id: this.seq++, def, hp, max: hp, boss: true, arrive: 1.5, mods, champ, ...this.spot(true) };
    this.monsters.push(m);
    let time = BOSS_TIME + 5 * this.curseTier('fuse') + Math.min(30, 3 * this.relic('time')) + this.bossTimeBonus();
    if (this.curseActive('fuse')) time *= 0.5;
    if (mods.includes('enraged')) time *= 1 - 0.5 * bite;
    if (giant || champHp > 1) time *= 1.5;
    this.bossTimeMax = time;
    this.bossTime = time;
    this.events.push({ t: 'spawn', id: m.id });
  }

  /** Is this floor's boss gold? From goldBossFrom, each boss floor has a number of its own for the run (from the run's
   *  seed, so a reload can't fish for one) and is gold while that number is under the champion chance: asked every time
   *  the boss comes, so a Soulcaller level bought below a boss can make it gold. Once gold it stays gold until beaten
   *  (a respec can't take it away), and once beaten it pays no more this run. Before goldBossFrom, now and then on a
   *  boss floor you've beaten before, so it never stands in new ground's way. */
  private goldBoss(floor: number) {
    if (!this.championsOn()) return false;
    if (floor < TUNE.goldBossFrom) return floor < this.s.bestFloor && Math.random() < (this.debugCards ? 0.34 : CHAMP_BOSS_CHANCE);
    // (true: gold and waiting to be beaten; false: beaten this run.)
    const known = this.s.goldBosses[floor];
    if (known !== undefined) return known;
    if (!GOLD_BOSS_SURE(floor) && seeded(this.s.runSeed, floor) >= this.goldBossChance()) return false;
    this.s.goldBosses[floor] = true;
    return true;
  }

  /** Souls a champion boss on this floor pays: its own, times the Pit Lord and the pull of every bound soul. */
  champSouls(floor: number) {
    return Math.floor(bossSouls(floor) * this.champSoulMult(floor));
  }

  goldBossChance() {
    return TUNE.goldBossChance + (1 - TUNE.goldBossChance) * Math.min(1, legendShare(this.legendLv('soulcaller')) * this.boundBoost('golem'));
  }

  /** The Hourglass's extra seconds on every boss. */
  bossTimeBonus() {
    return 30 * legendShare(this.legendLv('hourglass')) * this.boundBoost('ent');
  }

  /** The Wither's share of boss health left (a boss always keeps a tenth). */
  witherMult() {
    return Math.max(0.1, 1 - 0.5 * legendShare(this.legendLv('wither')) * this.boundBoost('troll'));
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
    if (this.downed > 0) return new Decimal(0);
    if (m.boss) {
      amount = amount.times(this.c.parts.boss * (1 + this.relic('boss')));
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
      // How many times over this hit killed it (the Ronin's card luck).
      this.kill(m, kind, amount.div(m.max).toNumber());
      return m.hp.neg();
    }
    return new Decimal(0);
  }

  private kill(m: Monster, by: HitKind, overkill = 1) {
    const i = this.monsters.indexOf(m);
    if (i < 0) return;
    this.monsters.splice(i, 1);
    const shown = this.dpsShown.get(m.id);
    if (shown) {
      // A monster the party kills in one tick shows a whole volley's worth, like the numbers on monsters that last.
      this.events.push({ t: 'hit', id: m.id, amount: Decimal.max(shown, this.dps().times(DPS_SHOWN_EVERY)), kind: 'dps' });
      this.dpsShown.delete(m.id);
    }
    // A splitting boss pays nothing until its last half falls, which drops the lot (what the body and both halves are
    // worth).
    const halvesLeft = m.half && this.monsters.some((x) => x.half);
    const pays = !(m.boss && ((m.mods.includes('split') && !m.half) || halvesLeft));
    const gold = pays ? this.monsterGold(m).times(m.half ? 3 : 1) : new Decimal(0);
    if (pays) this.dropGold(gold, m);
    this.s.kills++;
    this.killAcc++;
    if (m.champ && !m.half) this.s.champions++;
    this.events.push({ t: 'kill', id: m.id, gold, boss: m.boss, by, champ: m.champ });
    if (!m.boss) this.rollCard(this.slay(m.def, this.s.floor, !!m.champ), !!m.champ, 'kill', false, overkill);
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
        const bonus = this.monsterGold(m).times(CLUTCH_GOLD - 1);
        this.earn(bonus);
        if (firstWin) this.s.clutches++;
        clutch = { left: this.bossTime, gold: bonus };
      }
      this.bossTime = 0;
      this.unlockNext();
      let souls: number | undefined;
      if (m.champ && this.s.floor >= TUNE.goldBossFrom && this.s.goldBosses[this.s.floor]) {
        souls = this.champSouls(this.s.floor);
        this.s.soulBossDone = true;
        this.s.bossSouls += souls;
        this.s.goldBosses[this.s.floor] = false;
      }
      this.events.push({ t: 'bossWin', floor: this.s.floor, first: firstClear, clutch, souls });
      if (this.s.floor > MARK_FROM && this.s.floor % 10 === 0 && this.s.floor > this.s.markBest) this.giveMark(this.s.floor);
      this.rollCard(this.slay(m.def, this.s.floor, !!m.champ), !!m.champ, 'kill', true, overkill);
      if (firstWin || this.debugRelics) this.rollRelic(this.s.floor);
      // The demo's last boss always leads down the stairs, where it ends.
      if (this.s.auto || this.demoOver()) this.enterFloor(this.s.floor + 1);
      else this.enterFloor(this.s.floor, false, false, BOSS_RESPAWN);
    } else if (!this.bossFloor()) {
      this.s.floorKills++;
      if (this.s.floorKills >= this.killsNeeded()) {
        this.unlockNext();
        if (this.s.auto && this.s.floor + 1 <= this.s.maxFloor) this.enterFloor(this.s.floor + 1, false, true);
      }
    }
  }

  /** Strong enough to clear what's left of this floor at once (the toughest monster type counts for all of them).
   *  Only while auto-advancing: with auto off you're staying to farm the floor. */
  private canSweep() {
    if (!this.s.auto || this.bossFloor() || this.s.floorKills >= this.killsNeeded()) return false;
    const toughest = Math.max(...bandFor(this.s.floor).map((d) => d.hp));
    return this.dps().times(SWEEP_SECONDS).gte(floorHp(this.s.floor).times(this.floorLeft() * toughest * TRASH));
  }

  /** Testing only (the ?quick button, local only): win this floor as if you'd fought it, the
   *  monsters left (or its boss) killed for all they'd pay, and go on to the next. */
  devClearFloor() {
    const s = this.s;
    const floor = s.floor;
    // (Auto on just for this, so the win carries on down; it's put back after.)
    const auto = s.auto;
    this.downed = 0;
    s.auto = true;
    if (!this.bossFloor()) this.sweep();
    else {
      if (!this.monsters.some((m) => m.boss)) this.spawnBoss();
      // (A splitting boss takes a few: each half has to die too.)
      for (let k = 0; k < 8 && s.floor === floor; k++) {
        const boss = this.monsters.find((m) => m.boss);
        if (boss) this.kill(boss, 'dps');
      }
    }
    s.auto = auto;
    this.bankAllDrops();
  }

  /** Clear the floor in one go: monsters on the field die as usual, the rest are paid out as if they had. */
  private sweep() {
    const s = this.s;
    const floor = s.floor;
    this.sweepT = SWEEP_GAP;
    // A sweep is overkill by how many times over the party could clear what's left in SWEEP_SECONDS.
    const left0 = Math.max(1, this.floorLeft());
    const toughest = Math.max(...bandFor(floor).map((d) => d.hp));
    const overkill = this.dps().times(SWEEP_SECONDS).div(floorHp(floor).times(TRASH * toughest * left0)).toNumber();
    for (const m of [...this.monsters]) {
      if (s.floor !== floor) return;
      this.kill(m, 'dps', overkill);
    }
    if (s.floor !== floor || s.floorKills >= this.killsNeeded()) return;
    const left = this.killsNeeded() - s.floorKills;
    for (let k = 0; k < left; k++) this.rollCard(this.slay(pickMonster(floor), floor), false, 'sweep', false, overkill);
    const gold = Decimal.max(1, floorGold(floor).times(TRASH)).times(this.goldMult()).ceil().times(left);
    this.earn(gold);
    s.kills += left;
    this.killAcc += left;
    s.floorKills = this.killsNeeded();
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
      s.peakKills = 0;
      s.bestFloor = Math.max(s.bestFloor, s.maxFloor);
      this.checkCurse();
    }
  }

  /** The party's damage, dealt in blows: while there's a monster to fight, the party's damage piles up, and each
   *  companion swings now and then for its share of what piled up since its last swing (at the front monster mostly; for
   *  your hero, what it's attacking). The blow lands HIT_DELAY later, and what the target doesn't need goes on down
   *  the line, so the party deals exactly its damage per second, in visible hits. */
  private companionsFight(dt: number) {
    const focus = this.focus();
    const dps = this.dps();
    if (focus && dps.gt(0)) {
      this.dealt = this.dealt.plus(dps.times(dt));
      const hero = this.heroIndex();
      const arrived = this.monsters.filter((m) => m.arrive <= 0);
      for (let i = 0; i < COMPS.length; i++) {
        const share = this.c.shares[i];
        if (!share || (this.swingT[i] -= dt) > 0) continue;
        this.swingT[i] = SWING_GAP + Math.random() * SWING_SPREAD;
        // (Capped at a few seconds' worth, for a companion just hired or back from the hero's side.)
        const amount = Decimal.min(this.dealt.minus(this.swungAt[i]), dps.times(SWING_GAP + SWING_SPREAD + 1)).times(share);
        this.swungAt[i] = this.dealt;
        const pointed = i === hero && this.heroTarget !== null ? this.monster(this.heroTarget) : undefined;
        const target = pointed ?? (Math.random() < 0.7 || arrived.length < 2 ? focus : arrived[Math.floor(Math.random() * arrived.length)]);
        const delay = HIT_DELAY[COMPS[i].attack];
        this.blows.push({ id: target.id, amount, t: delay });
        this.events.push({ t: 'swing', comp: i, id: target.id, delay });
      }
    }
    if (!this.blows.length) return;
    for (const blow of this.blows) blow.t -= dt;
    const landed = this.blows.filter((blow) => blow.t <= 0);
    if (!landed.length) return;
    this.blows = this.blows.filter((blow) => blow.t > 0);
    for (const blow of landed) {
      let left = blow.amount;
      let m = this.monster(blow.id) ?? this.focus();
      for (let k = 0; k < 20 && m && left.gt(0); k++) {
        left = this.damage(m, left, 'dps');
        m = this.focus();
      }
    }
  }

  /** The monster your companions are hitting: the one that's been around longest. */
  focus(): Monster | undefined {
    return this.monsters.find((m) => m.arrive <= 0);
  }

  /** Click a monster (or, if it's gone, whatever's in front). `x, y` are screen coords for numbers. */
  click(id: number | null, x: number, y: number, auto = false, flurry = false) {
    const target = (id !== null ? this.monster(id) : undefined) ?? this.focus();
    if (!target || this.downed > 0) return new Decimal(0);
    if (!auto) {
      if (this.curseActive('silent')) return new Decimal(0);
      // Flurry's clicks are on top of your own, so they don't wait for the hand's cooldown.
      if (!flurry) {
        if (this.manualCd > 0) return new Decimal(0);
        this.manualCd = 1 / MANUAL_RATE;
        this.streak = this.sinceAttack <= STREAK_GAP ? Math.min(STREAK_CAP, this.streak + 1) : 1;
        this.sinceAttack = 0;
        this.s.lastAttack = this.now();
      }
    }
    const crit = Math.random() < this.critChance();
    const fever = this.s.buffs.some((b) => b.id === 'fever');
    const amount = this.clickDamage().times((crit ? this.critMult() : 1) * (auto ? this.sleeperMult() : 1));
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
        fill *= 1 + 0.2 * this.curseTier('norampage');
        this.s.fervor = Math.min(1, this.s.fervor + fill);
      }
    }
    return amount;
  }

  /** Your hero: the companion you picked, or the first one you hired if that one's gone. -1 for none (before your
   *  first hire, or when you've chosen to go without). */
  heroIndex() {
    if (this.vault) return this.vault.hero;
    // Up in the Keep someone always walks for you, even fresh from an ascent with nobody hired yet.
    if (this.s.inKeep) return this.s.hero >= 0 && this.inParty(this.s.hero) ? this.s.hero : COMPS.findIndex((_, i) => this.inParty(i));
    if (this.s.hero < 0) return -1;
    // A hero away hunting leaves you without one (not someone else) until it's back.
    if (this.away(this.s.hero)) return -1;
    if (this.s.owned[this.s.hero] > 0) return this.s.hero;
    return this.s.owned.findIndex((n, k) => n > 0 && !this.away(k));
  }

  /** Pick a companion as your hero; picking the one you already have means no hero at all. */
  setHero(i: number) {
    if (this.heroIndex() === i) {
      this.s.hero = -1;
      return true;
    }
    if (this.s.owned[i] === 0 || this.away(i)) return false;
    this.s.hero = i;
    return true;
  }

  /** Phantom Blade attacks a second: none until the Squire's first trait, then a slow start, faster with companion
   *  traits. */
  autoRate() {
    if (!this.abilityUnlocked('blade')) return 0;
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
    return dur + this.spiritSeconds('rampage');
  }

  /** Seconds a button ability lasts. */
  abilityDuration(id: AbilityId) {
    return (ABILITY_BY_ID.get(id)?.dur ?? 0) + this.spiritSeconds(id);
  }

  /** Seconds the Spirit that lengthens this ability adds to it. */
  private spiritSeconds(id: AbilityId) {
    const spirit = LEGENDS.find((d) => d.lengthens?.ability === id);
    return spirit ? spirit.lengthens!.secs * this.legendLv(spirit.id) : 0;
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
    if (!this.compUnlocked(i) || this.away(i)) return false;
    // A Small Party: six companions at most on this descent.
    if (this.curseActive('small') && this.s.owned[i] === 0 && this.s.owned.filter((n) => n > 0).length >= 6) return false;
    const { n, cost } = count ? { n: count, cost: this.compCost(i, count) } : this.compQuote(i);
    if (this.s.gold.lt(cost)) return false;
    this.s.gold = this.s.gold.minus(cost);
    this.s.owned[i] += n;
    if (this.s.owned[i] >= EXPEDITION_LEVEL && !this.s.tripsOpen) {
      this.s.tripsOpen = true;
      this.events.push({ t: 'tripsOpen', comp: i });
    }
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
    if (r.rainbow && (this.debugRainbow || Math.random() < VAULT_CHANCE)) {
      this.events.push({ t: 'raidCatch', id: r.id, reward: 'vault' });
      // The gold on the floor doesn't wait out the slow motion: it all flies up to the bank.
      this.bankAllDrops('sweep');
      // Everything slows while you choose who goes in.
      if (!this.vaultPick) {
        this.vaultPick = true;
        this.events.push({ t: 'vaultPick' });
      }
      this.scheduleRaid();
      return true;
    }
    if (r.rainbow) {
      const amount = floorGold(this.s.floor).times(this.goldMult() * this.goblinKing() * RAINBOW_HAUL * (10 + Math.random() * 10));
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
      const amount = floorGold(this.s.floor).times(this.goldMult() * this.goblinKing() * (10 + Math.random() * 10));
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

  /** The Wish's cut of goblin and vault gold. */
  goblinKing() {
    return 1 + 0.5 * this.legendLv('goblinking');
  }

  private rollReward(): RaidReward {
    const r = Math.random();
    if (r < 0.3) return 'plunder';
    if (r < 0.55) return 'bloodlust';
    if (r < 0.75) return 'heartstorm';
    return 'horde';
  }

  private rewardBuff(reward: RaidReward, effect: number): Buff {
    const b = (id: Buff['id'], name: string, t: number, dps: number, click: number, gold: number): Buff => ({ id, name, t: t * effect, dur: t * effect, dps, click, gold });
    switch (reward) {
      case 'bloodlust': return b('bloodlust', 'Bloodlust', 7, 7, 1, 1);
      case 'heartstorm': return b('heartstorm', 'Frenzy', 7, 1, 77, 1);
      case 'soulstorm': return b('soulstorm', 'Soul Storm', 6, 666, 666, 1);
      default: return b('horde', 'Gold Rush', 30, 1, 1, 7);
    }
  }

  private scheduleRaid() {
    let f = (1 + 0.3 * this.relic('goblin')) * (1 + 2 * legendShare(this.legendLv('lure')) * this.boundBoost('thing'));
    for (const e of this.effects()) if (e.t === 'raid' && e.freq) f *= e.freq;
    this.s.raidTimer = this.debugRainbow ? 5 : (RAID_MIN + Math.random() * (RAID_MAX - RAID_MIN)) / f;
  }

  private spawnRaid() {
    const from = Math.random() < 0.5 ? -1 : 1;
    // Your first goblin is always an ordinary one; rainbows only turn up once you know what to do with a goblin.
    const rainbow = this.debugRainbow || (this.s.raids > 0 && Math.random() < RAINBOW_CHANCE);
    // The first rainbow goblin lingers, so it's caught rather than missed.
    const stay = rainbow && this.s.rainbows === 0 ? RAID_STAY * 1.8 : RAID_STAY;
    this.raid = { id: this.seq++, from, t: 0, stay, rainbow };
    if (rainbow) this.s.rainbowSeen = true;
    this.events.push({ t: 'raidSpawn', id: this.raid.id, from, rainbow });
  }

  // ---------- prestige ----------

  /** Souls a zone boss on this floor pays when beaten (before relics). */
  soulGainMult() {
    return (1 + 0.15 * this.relic('souls')) * [1, 1.25, 1.5, 2][this.curseTier('two')];
  }

  /** Companion levels bought this run. */
  runLevels() {
    return this.s.owned.reduce((a, b) => a + b, 0);
  }

  /** Souls an ascent would pay right now: this run's levels and gold bosses. */
  pendingSouls() {
    return Math.floor((Math.floor(this.runLevels() / TUNE.levelsPerSoul) + this.s.bossSouls) * this.soulGainMult());
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
    this.recallAll();
    const gained = this.pendingSouls();
    this.s.ascents.push({ time: this.s.runTime, floor: this.s.maxFloor, souls: gained });
    this.s.souls += gained;
    this.s.descents++;
    this.s.lastAscent = Math.max(this.s.lastAscent, this.s.maxFloor);
    this.s.bossSouls = 0;
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
    s.cooldowns = {};
    s.fervor = 0;
    this.stash = [];
    this.vaultOn = false;
    this.vault = null;
    this.vaultPick = false;
    this.rampageTier = 0;
    s.revealed = 0;
    s.runTime = 0;
    s.runActive = 0;
    s.auto = true;
    this.owned.clear();
    this.raid = null;
    this.scheduleRaid();
    s.maxFloor = 1;
    s.peakKills = 0;
    s.goldBosses = {};
    s.runSeed = freshSeed();
    this.invalidate();
    this.enterFloor(1, true);
  }

  soulsFree() {
    return this.s.souls - this.s.spentSouls;
  }

  /** Damage from souls: +`soulPower` each. */
  soulMult(free = this.soulsFree()) {
    return 1 + TUNE.soulPower * free + 0.11 * this.legendLv('hungry');
  }

  // ---------- Legends ----------

  legendLv(id: LegendId) {
    return this.s.legends[id] ?? 0;
  }

  legendsOwned() {
    return Object.keys(this.s.legends).length;
  }

  /** Legends open with your first ascent. */
  legendsOpen() {
    return this.s.descents > 0 || this.s.awakens > 0 || this.s.souls > 0;
  }

  summonPrice() {
    return this.lich(summonCost(this.legendsOwned()));
  }

  /** The Lich's discount on Spirit costs. */
  private lich(price: number) {
    const lv = this.boundLv('lich');
    return lv ? Math.max(1, Math.ceil(price * 0.95 ** lv)) : price;
  }

  /** A Spirit's highest level (the Thinning goes further with the Frost Troll). */
  legendMax(id: LegendId) {
    const max = LEGEND_BY_ID.get(id)!.maxLv;
    return max === undefined ? Infinity : max + (id === 'thinning' ? this.boundLv('frost') : 0);
  }

  rerollPrice() {
    return rerollCost(this.legendsOwned());
  }

  /** Three Legends you don't have yet, rolled from the save's seed so a reload can't fish for a better offer. */
  private pickOffer(roll: number): LegendId[] {
    const s = this.s;
    const left = LEGENDS.filter((d) => !(d.id in s.legends)).map((d) => d.id);
    // A reroll shows as many new faces as it can.
    const fresh = left.filter((id) => !s.legendOffer.includes(id));
    const pool = fresh.length >= OFFER_SIZE ? fresh : left;
    const pick: LegendId[] = [];
    for (let k = 0; pick.length < Math.min(OFFER_SIZE, pool.length); k++) {
      const id = pool[Math.floor(seeded(s.legendSeed, roll * 64 + k) * pool.length)];
      if (!pick.includes(id)) pick.push(id);
    }
    return pick;
  }

  private rollOffer() {
    this.s.legendOffer = this.pickOffer(this.s.legendRolls++);
  }

  /** The first offer, before Legends open: what the circle will hold once they do. */
  previewOffer(): LegendId[] {
    return this.s.legendOffer.length ? (this.s.legendOffer as LegendId[]) : this.pickOffer(this.s.legendRolls);
  }

  /** The Legends on offer right now (rolled the first time you look). */
  legendOffer(): LegendId[] {
    if (this.legendsOpen() && !this.s.legendOffer.length && this.legendsOwned() < LEGENDS.length) this.rollOffer();
    return this.s.legendOffer as LegendId[];
  }

  summonLegend(id: LegendId) {
    const price = this.summonPrice();
    if (!this.legendOffer().includes(id) || this.soulsFree() < price) return false;
    this.spendSouls(price, true);
    this.s.legends[id] = 1;
    this.rollOffer();
    this.invalidate();
    this.events.push({ t: 'legend', id, lv: 1, summoned: true });
    return true;
  }

  rerollLegends() {
    const price = this.rerollPrice();
    if (!this.legendsOpen() || this.soulsFree() < price || this.legendsOwned() >= LEGENDS.length - OFFER_SIZE) return false;
    this.spendSouls(price, false);
    this.rollOffer();
    return true;
  }

  legendLevelCost(id: LegendId) {
    return this.lich(legendCost(LEGEND_BY_ID.get(id)!, this.legendLv(id)));
  }

  levelLegend(id: LegendId) {
    const lv = this.legendLv(id);
    if (!lv) return false;
    if (lv >= this.legendMax(id)) return false;
    const price = this.legendLevelCost(id);
    if (this.soulsFree() < price) return false;
    this.spendSouls(price, true);
    this.s.legends[id] = lv + 1;
    this.invalidate();
    this.events.push({ t: 'legend', id, lv: lv + 1, summoned: false });
    return true;
  }

  legendMaxed(id: LegendId) {
    return this.legendLv(id) >= this.legendMax(id);
  }

  /** Every Legend is let go; RESPEC_REFUND of the souls they took comes back. */
  respecLegends() {
    const s = this.s;
    if (!this.legendsOwned()) return false;
    s.spentSouls -= Math.floor(s.legendSpent * RESPEC_REFUND);
    s.legendSpent = 0;
    s.legends = {};
    s.legendOffer = [];
    this.rollOffer();
    this.invalidate();
    return true;
  }

  /** `kept`: spent on a Legend (a respec refunds part of it), or gone for good (a reroll). */
  private spendSouls(n: number, kept: boolean) {
    this.s.spentSouls += n;
    if (kept) this.s.legendSpent += n;
  }

  /** Kills a normal floor needs. */
  killsNeeded() {
    return FLOOR_KILLS - Math.min(10 + this.boundLv('frost'), this.legendLv('thinning'));
  }

  /** No attack by hand for IDLE_AFTER seconds. */
  idle() {
    return this.sinceAttack >= IDLE_AFTER;
  }

  /** The Sleeper's boost while idle: the party and the Phantom Blade alike. */
  sleeperMult() {
    return this.idle() ? 1 + 0.25 * this.legendLv('sleeper') : 1;
  }

  /** Multipliers that change from moment to moment: the Sleeper while idle, the Unbroken with your streak. */
  private liveMult() {
    return this.sleeperMult() * (1 + 0.0001 * this.legendLv('unbroken') * this.streak);
  }

  // ---------- Heartmarks ----------

  /** Companions a Heartmark can land on: everyone you could hire. */
  private markable() {
    return COMPS.map((_, i) => i).filter((i) => this.compUnlocked(i));
  }

  private giveMark(floor: number) {
    this.s.markBest = floor;
    const pool = this.markable();
    const comp = pool[Math.floor(Math.random() * pool.length)];
    this.s.marks[comp]++;
    this.invalidate();
    this.events.push({ t: 'mark', comp });
  }

  marksTotal() {
    return this.s.marks.reduce((a, b) => a + b, 0);
  }

  /** Move one of this companion's Heartmarks to someone else, at random. */
  rerollMark(from: number) {
    const pool = this.markable().filter((i) => i !== from);
    if (!this.s.marks[from] || !pool.length || this.soulsFree() < MARK_REROLL) return false;
    this.spendSouls(MARK_REROLL, false);
    const to = pool[Math.floor(Math.random() * pool.length)];
    this.s.marks[from]--;
    this.s.marks[to]++;
    this.invalidate();
    this.events.push({ t: 'mark', comp: to, from, moved: true });
    return true;
  }

  /** Bring one Heartmark to this companion, taken from someone else's at random. */
  moveMarkTo(to: number) {
    const from = COMPS.map((_, i) => i).filter((i) => i !== to && this.s.marks[i] > 0);
    if (!from.length || !this.compUnlocked(to) || this.soulsFree() < MARK_MOVE) return false;
    this.spendSouls(MARK_MOVE, false);
    const pick = from[Math.floor(Math.random() * from.length)];
    this.s.marks[pick]--;
    this.s.marks[to]++;
    this.invalidate();
    this.events.push({ t: 'mark', comp: to, from: pick, moved: true });
    return true;
  }

  // ---------- relics ----------

  /** Chance a boss on this floor drops a relic (a new deepest zone boss always does). */
  relicChance(floor: number) {
    if (this.debugRelics) return 1;
    if (floor % 10 === 0 && floor > this.s.bossBest) return 1;
    return floor % 10 === 0 ? 0.25 : 0.08;
  }

  private rollRelic(floor: number) {
    if (!RELICS_ON && !this.debugRelics) return;
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

  // ---------- awakening ----------

  /** The first awakening opens at TUNE.awakenFloor; after that, whenever it would pay. */
  canAwaken() {
    if (!AWAKEN_ON) return false;
    if (!this.s.awakens && this.s.cycleBest < TUNE.awakenFloor) return false;
    return this.pendingBound() >= 1;
  }

  /** Souls earned this cycle, the coming ascent's included (an awakening ascends too). */
  cycleSouls() {
    return this.s.souls + this.pendingSouls();
  }

  /** Bound souls in all for a cycle that earned this many souls: 5 for every power of ten. */
  boundFor(souls: number) {
    return souls >= 1 ? Math.floor(5 * Math.log10(souls)) : 0;
  }

  /** Bound souls an awakening would pay: what this cycle's souls are worth above the best before. */
  pendingBound() {
    return Math.max(0, this.boundFor(this.cycleSouls()) - this.s.boundEarned);
  }

  /** Souls this cycle needs for the next bound soul. */
  nextBoundAt() {
    return Math.ceil(10 ** ((Math.max(this.s.boundEarned, this.boundFor(this.cycleSouls())) + 1) / 5));
  }

  /** Give up souls, Spirits, Heartmarks and the run for bound souls; `respec` hands back every one spent on the Bound. */
  awaken(respec = false) {
    if (!this.canAwaken()) return false;
    const s = this.s;
    const gained = this.pendingBound();
    this.recallAll();
    // Gold still on the floor belongs to this cycle.
    this.bankAllDrops();
    s.soulsLifetime += this.cycleSouls();
    s.boundEarned += gained;
    s.awakens++;
    s.ascents.push({ time: s.runTime, floor: s.maxFloor, souls: 0, awakening: s.awakens, bound: gained });
    if (respec) s.bound = {};
    s.cycleBest = 0;
    s.lastAscent = 0;
    s.souls = 0;
    s.spentSouls = 0;
    s.legends = {};
    s.legendOffer = [];
    s.legendSpent = 0;
    s.marks = COMPS.map(() => 0);
    s.markBest = 0;
    s.bossSouls = 0;
    s.curse = null;
    this.resetRun();
    this.events.push({ t: 'awaken', bound: gained });
    return true;
  }

  boundSpent() {
    let spent = 0;
    for (const b of BOUND) for (let l = 0; l < this.boundLv(b.id); l++) spent += boundCost(b, l);
    return spent;
  }

  boundFree() {
    return this.s.boundEarned - this.boundSpent();
  }

  boundPrice(id: BoundId) {
    return boundCost(BOUND_BY_ID.get(id)!, this.boundLv(id));
  }

  boundMaxed(id: BoundId) {
    const max = BOUND_BY_ID.get(id)!.max;
    return max !== undefined && this.boundLv(id) >= max;
  }

  buyBound(id: BoundId) {
    if (!BOUND_BY_ID.has(id) || this.boundMaxed(id) || this.boundFree() < this.boundPrice(id)) return false;
    this.s.bound[id] = this.boundLv(id) + 1;
    this.invalidate();
    this.events.push({ t: 'bound', id, lv: this.s.bound[id] });
    return true;
  }

  /** How hard depth pulls on champion souls: rises toward TUNE.pullCap with every bound soul ever earned. */
  pull() {
    return TUNE.pullCap * (1 - (1 - TUNE.pullRate) ** this.s.boundEarned);
  }

  /** Champion souls on this floor: the Pit Lord's ×(1 + level²), and the pull of every bound soul, compounding with depth. */
  champSoulMult(floor: number) {
    return (1 + this.boundLv('pitlord') ** 2) * (1 + this.pull()) ** Math.max(0, (floor - TUNE.goldBossFrom) / 10);
  }

  /** A Spirit working harder for its Bound: +25% per level. */
  boundBoost(id: BoundId) {
    return 1 + 0.25 * this.boundLv(id);
  }

  // ---------- expeditions ----------

  /** Expeditions open the first time anyone reaches EXPEDITION_LEVEL. */
  tripsOpen() {
    return this.s.tripsOpen;
  }

  /** Out hunting right now (not with the party on its floor). */
  away(i: number) {
    return this.s.expeditions.some((e) => e.comp === i && e.pausedAt === undefined);
  }

  /** The hunter whose floor the party is on fights with them; anyone else whose floor it isn't goes back to hunting. */
  private meetHunters() {
    const now = this.now();
    for (const e of this.s.expeditions) {
      const here = !this.s.inKeep && this.s.floor === e.floor;
      if (here && e.pausedAt === undefined) {
        this.hunt(e);
        e.banked = this.tripKills(e, now);
        e.hunted = this.tripSeconds(e, now);
        e.pausedAt = now;
        this.invalidate();
        this.events.push({ t: 'hunterHere', comp: e.comp, on: true });
      } else if (!here && e.pausedAt !== undefined) {
        // (Its strength now: levels bought while it was here count from here on.)
        const dps = this.compDps(e.comp);
        if (dps.gt(0)) e.dps = dps.toString();
        e.start = now;
        e.pausedAt = undefined;
        this.invalidate();
        this.events.push({ t: 'hunterHere', comp: e.comp, on: false });
      }
    }
  }

  canSend(i: number) {
    return this.s.tripsOpen && this.s.owned[i] >= EXPEDITION_LEVEL && !this.s.expeditions.some((e) => e.comp === i);
  }

  /** Send a companion to hunt a floor you've reached; it leaves the party (and takes its traits) until it's back. */
  sendTrip(i: number, floor: number) {
    floor = Math.floor(floor);
    if (!this.canSend(i) || !(floor >= 1 && floor <= this.s.bestFloor)) return false;
    const dps = this.compDps(i);
    this.s.expeditions.push({ comp: i, floor, dps: dps.toString(), start: this.now() });
    this.s.tripsSent++;
    this.invalidate();
    return true;
  }

  /** Health of a boss on this floor at its plain strength (no modifiers, Spirits or champion bulk). */
  private plainBossHp(f: number) {
    const toughness = TUNE.bossHpFrom + (TUNE.bossHp - TUNE.bossHpFrom) * Math.min(1, (f - 1) / TUNE.bossRamp);
    return floorHp(f).times(toughness * (f % 10 === 0 && f >= DESCEND_FLOOR ? TUNE.zoneBoss : 1));
  }

  /** Health of a monster a hunter fights on this floor: the floor's crowd on average, or its boss. */
  private huntHp(f: number) {
    if (isBossFloor(f)) return this.plainBossHp(f);
    const band = bandFor(f);
    return floorHp(f).times(TRASH * band.reduce((sum, d) => sum + d.hp, 0) / band.length);
  }

  /** Kills a second a hunter with this damage makes on a floor: as fast as it kills, up to the sweep limit (bosses
   *  come one at a time). */
  tripRate(floor: number, dps: Decimal) {
    const cap = isBossFloor(floor) ? TRIP_BOSS_RATE : FLOOR_KILLS / SWEEP_GAP;
    return Math.min(cap, dps.div(this.huntHp(floor)).toNumber());
  }

  /** The deepest floor a companion would hunt at full speed (its suggestion when you send it). */
  tripFloor(i: number) {
    const dps = this.compDps(i);
    let floor = this.s.bestFloor;
    while (floor > 1 && (isBossFloor(floor) || this.tripRate(floor, dps) < FLOOR_KILLS / SWEEP_GAP - 0.01)) floor--;
    return floor;
  }

  /** Card luck on a hunt: the Collector, and the Ronin at the hunt's overkill. */
  private tripLuck(floor: number, dps: Decimal) {
    const rate = this.tripRate(floor, dps);
    const overkill = rate > 0 ? dps.div(this.huntHp(floor).times(rate)).toNumber() : 1;
    return (1 + 2 * legendShare(this.legendLv('collector'))) * this.overkillMult(overkill) * (this.debugCards ? 500 : 1);
  }

  /** Cards a hunter with this damage finds a day on a floor, on average. */
  tripCardsPerDay(floor: number, dps: Decimal) {
    const odds = isBossFloor(floor) ? CARD_ODDS.boss : CARD_ODDS.monster;
    return (this.tripRate(floor, dps) * 86400 * this.tripLuck(floor, dps)) / odds;
  }

  /** Seconds hunted in all (the time the party spent on its floor doesn't count), up to TRIP_HOURS. */
  tripSeconds(e: Expedition, now = this.now()) {
    const stretch = e.pausedAt !== undefined ? 0 : (now - e.start) / 1000;
    return Math.max(0, Math.min(TRIP_HOURS * 3600, (e.hunted ?? 0) + stretch));
  }

  tripKills(e: Expedition, now = this.now()) {
    const stretch = this.tripSeconds(e, now) - (e.hunted ?? 0);
    return (e.banked ?? 0) + Math.floor(this.tripRate(e.floor, new Decimal(e.dps)) * Math.max(0, stretch));
  }

  /** Bring a hunter home with what it found: every kill rolls for its card, as it would in the dungeon. */
  callHome(i: number) {
    const k = this.s.expeditions.findIndex((e) => e.comp === i);
    if (k < 0) return false;
    const [e] = this.s.expeditions.splice(k, 1);
    this.hunt(e, true);
    const kills = this.tripKills(e);
    const before = this.events.length;
    for (const f of e.found ?? []) this.giveCard(f.id, f.gold, 'trip', e.floor);
    const cards = this.events.slice(before).filter((ev): ev is Extract<GameEvent, { t: 'card' }> => ev.t === 'card');
    this.s.tripCards += cards.length;
    this.invalidate();
    this.events.push({ t: 'expedition', comp: i, floor: e.floor, kills, cards: cards.length, gold: cards.filter((c) => c.gold).length });
    this.checkTrophies();
    return true;
  }

  /** Everyone home (an ascent or an awakening). */
  recallAll() {
    for (const e of [...this.s.expeditions]) this.callHome(e.comp);
  }

  /** Roll a hunter's kills since it last rolled: what it finds is kept with the trip (saved, so a reload can't redraw
   *  it) until it comes home. */
  private hunt(e: Expedition, quiet = false) {
    const kills = this.tripKills(e);
    const fresh = kills - (e.rolled ?? 0);
    if (fresh <= 0) return;
    e.rolled = kills;
    const found = (e.found ??= []);
    let cards = 0;
    let gold = 0;
    this.huntFinds(fresh, e.floor, new Decimal(e.dps), (id, isGold) => {
      found.push({ id, gold: isGold });
      cards++;
      if (isGold) gold++;
    });
    // Said as it happens (not on the way home, where the cards themselves come in).
    if (cards && !quiet) this.events.push({ t: 'tripFind', comp: e.comp, cards, gold });
  }

  /** Hunters roll what they've found every so often, and come home on their own once their time is up. */
  private tickTrips() {
    if (!this.s.expeditions.length) return;
    const now = this.now();
    if (now - this.huntedAt < TRIP_ROLL_EVERY) return;
    this.huntedAt = now;
    for (const e of [...this.s.expeditions]) {
      if (this.tripSeconds(e, now) >= TRIP_HOURS * 3600) this.callHome(e.comp);
      else if (e.pausedAt === undefined) this.hunt(e);
    }
  }
  private huntedAt = 0;

  /** A hunt's kills, in bulk: the floor's mix of monsters (or its boss), CHAMP_CHANCE of them champions rolling gold,
   *  every card drawn at once at the dungeon's odds, the Collector and the Ronin included. */
  private huntFinds(kills: number, floor: number, dps: Decimal, find: (id: string, gold: boolean) => void) {
    if (kills <= 0) return;
    const lap = Math.min(lapOf(floor), CORRUPTION.length - 1);
    const luck = this.tripLuck(floor, dps);
    const roll = (id: string, n: number, champs: number, odds: number, goldOdds: number) => {
      this.s.slain[id] = (this.s.slain[id] ?? 0) + n;
      if (lap) (this.s.slainLaps[id] ??= CORRUPTION.map(() => 0))[lap] += n;
      if (champs) (this.s.champSlain[id] ??= CORRUPTION.map(() => 0))[lap] += champs;
      for (let c = poisson((n * luck) / odds); c > 0; c--) find(id, false);
      for (let c = poisson((champs * luck) / goldOdds); c > 0; c--) find(id, true);
    };
    if (isBossFloor(floor)) {
      const champs = this.championsOn() && floor >= TUNE.goldBossFrom ? Math.round(kills * this.goldBossChance()) : 0;
      roll(cardId(bossFor(floor).name), kills, champs, CARD_ODDS.boss, CARD_ODDS.champBoss);
      return;
    }
    const featured = featuredFor(floor);
    const band = bandFor(floor);
    for (const def of new Set([featured, ...band])) {
      const share = (def.name === featured.name ? 0.5 : 0) + (0.5 * band.filter((d) => d.name === def.name).length) / band.length;
      const n = Math.round(kills * share);
      if (n) roll(cardId(def.name), n, this.championsOn() ? Math.round(n * CHAMP_CHANCE) : 0, CARD_ODDS.monster, CARD_ODDS.champ);
    }
  }

  // ---------- cards ----------

  /** Count a kill toward its card's tally; returns the card id. */
  private slay(def: MonsterDef, floor = this.s.floor, champ = false) {
    const id = cardId(def.name);
    this.s.slain[id] = (this.s.slain[id] ?? 0) + 1;
    const lap = Math.min(lapOf(floor), CORRUPTION.length - 1);
    if (lap) (this.s.slainLaps[id] ??= CORRUPTION.map(() => 0))[lap]++;
    if (champ) (this.s.champSlain[id] ??= CORRUPTION.map(() => 0))[lap]++;
    return id;
  }

  /** Champions of this card's monster slain in one color (lap). */
  champsSlainOn(id: string, lap: number) {
    return this.s.champSlain[id]?.[lap] ?? 0;
  }

  /** Monsters of this card slain in one color (lap). */
  slainOn(id: string, lap: number) {
    const laps = this.s.slainLaps[id];
    if (lap) return laps?.[lap] ?? 0;
    return (this.s.slain[id] ?? 0) - (laps ?? []).reduce((a, n) => a + n, 0);
  }

  /** The Ronin: a kill N times over has N× the card chance, up to ×(1 + level). */
  overkillMult(overkill: number) {
    const lv = this.legendLv('ronin');
    return lv ? Math.max(1, Math.min(Math.floor(overkill), 1 + lv)) : 1;
  }

  private cardRoll(odds: number, mult = 1) {
    odds /= (1 + 2 * legendShare(this.legendLv('collector'))) * mult;
    return Math.random() * (this.debugCards ? Math.max(1, odds / 500) : odds) < 1;
  }

  /** A killed monster's chance at its card: champions roll for a gold one first. */
  private rollCard(id: string, champ: boolean, src: 'kill' | 'sweep', boss = false, overkill = 1) {
    // In the demo your first card is sure to turn up early (at normal odds a short session would never see one): each
    // kill in DEMO_FIRST_CARD's stretch has a 1 in (kills left) chance, so the drop lands evenly across it.
    const { from, by } = DEMO_FIRST_CARD;
    if (DEMO && src === 'kill' && this.s.kills >= from && Object.keys(this.s.cards).length === 0 && Math.random() * (by - this.s.kills) < 1) {
      this.giveCard(id, false, src);
      return;
    }
    const mult = this.overkillMult(overkill);
    if (champ && this.cardRoll(boss ? CARD_ODDS.champBoss : CARD_ODDS.champ, mult)) this.giveCard(id, true, src);
    else if (this.cardRoll(boss ? CARD_ODDS.boss : CARD_ODDS.monster, mult)) this.giveCard(id, false, src);
  }

  giveCard(id: string, gold = false, src: 'kill' | 'sweep' | 'raid' | 'trip' = 'kill', floor = this.s.floor) {
    const c = (this.s.cards[id] ??= { n: CORRUPTION.map(() => 0), gold: CORRUPTION.map(() => 0) });
    const first = gold ? !this.hasGoldCard(id) : !this.cardCount(id);
    const kill = this.cardKill(id);
    if (first && gold) c.goldAt = kill;
    else if (first) c.at = kill;
    const laps = CARD_BY_ID.get(id)!.laps;
    const here = Math.min(lapOf(floor), CORRUPTION.length - 1);
    const lap = laps.includes(here) ? here : laps[0];
    const newColor = (gold ? c.gold : c.n)[lap] === 0;
    (gold ? c.gold : c.n)[lap]++;
    this.unseen(id, lap, gold);
    this.events.push({ t: 'card', id, gold, lap, count: this.cardCount(id), first, newColor, src, kill });
  }

  private unseen(id: string, lap: number, gold: boolean) {
    const key = `${id}:${lap}:${gold ? 1 : 0}`;
    if (!this.s.dreamCards.includes(key) && this.s.dreamCards.length < 999) this.s.dreamCards.push(key);
  }

  /** You've looked through the binder: nothing in it is new any more. */
  seeCards() {
    this.s.dreamCards = [];
  }

  wake() {
    this.s.dreamSeen = true;
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

  /** Versions of cards you have, each color plain and gold counted apart; and how many there are to find. */
  cardVersions() {
    return CARDS.reduce((sum, c) => sum + c.laps.filter((lap) => this.s.cards[c.id]?.n[lap]).length + (c.gold ? c.laps.filter((lap) => this.s.cards[c.id]?.gold[lap]).length : 0), 0);
  }

  cardVersionsTotal() {
    return CARDS.reduce((sum, c) => sum + c.laps.length * (c.gold ? 2 : 1), 0);
  }

  // ---------- trading with the brothers ----------

  /** Plain copies beyond the first of each color: the ones you can trade away (gold copies are never traded, and a
   *  trade never takes the last of a color out of the binder). */
  /** Plain copies of a card you could trade (gold ones are never traded). */
  plainCards(id: string) {
    const c = this.s.cards[id];
    return c ? c.n.reduce((a, n) => a + n, 0) : 0;
  }

  /** The cards a trade can hand over: ones from zones you've reached (and their later-lap newcomers once you've been that deep). */
  tradeable(zone?: number) {
    return CARDS.filter((c) => c.kind !== 'goblin' && c.floor <= this.s.bestFloor && (zone === undefined || c.zone === zone));
  }

  /** Dan: five cards from any sets for a random card from those same sets, each set as likely as its share of
   *  what you gave (three Upper Halls and two Bone Crypts: 60% Upper Halls, 40% Bone Crypts). */
  tradeWithDan(give: string[]) {
    if (give.length !== DAN_GIVES || give.some((id) => (CARD_BY_ID.get(id)?.zone ?? -1) < 0)) return null;
    const zone = CARD_BY_ID.get(give[Math.floor(Math.random() * give.length)])!.zone;
    const pool = this.tradeable(zone);
    if (!pool.length || !this.takeCards(give)) return null;
    this.s.trades++;
    return this.receive(pool[Math.floor(Math.random() * pool.length)].id, false, 'Dan');
  }

  /** Victor: ten cards from anywhere for a random gold card. */
  tradeWithVictor(give: string[]) {
    if (give.length !== VICTOR_GIVES || give.some((id) => CARD_BY_ID.get(id)?.kind === 'goblin')) return null;
    const pool = this.tradeable().filter((c) => c.gold);
    if (!pool.length || !this.takeCards(give)) return null;
    this.s.trades++;
    return this.receive(pool[Math.floor(Math.random() * pool.length)].id, true, 'Victor');
  }

  /** Hand over these copies (an id twice means two copies), taken from whichever color you have most of. */
  private takeCards(give: string[]) {
    const want = new Map<string, number>();
    for (const id of give) want.set(id, (want.get(id) ?? 0) + 1);
    for (const [id, n] of want) if (this.plainCards(id) < n) return false;
    for (const [id, n] of want) {
      const c = this.s.cards[id];
      for (let k = 0; k < n; k++) {
        const lap = c.n.indexOf(Math.max(...c.n));
        c.n[lap]--;
      }
    }
    return true;
  }

  /** Someone's one spare card (once each): a plain one from the first two zones, one you don't have if they've got it. */
  giftCard(who: string) {
    if (this.s.gifts.includes(who)) return null;
    const early = CARDS.filter((c) => c.kind === 'monster' && c.zone <= 1 && c.laps.includes(0));
    const missing = early.filter((c) => !this.cardCount(c.id));
    const pool = missing.length ? missing : early;
    this.s.gifts.push(who);
    return this.receive(pool[Math.floor(Math.random() * pool.length)].id, false, giftVia(who));
  }

  private receive(id: string, gold: boolean, from: string) {
    const c = (this.s.cards[id] ??= { n: CORRUPTION.map(() => 0), gold: CORRUPTION.map(() => 0) });
    const first = gold ? !this.hasGoldCard(id) : !this.cardCount(id);
    if (first && gold) c.goldVia = from;
    else if (first) c.via = from;
    // Later-lap newcomers have no plain copy: they arrive in the first color they come in.
    const lap = Math.min(lapOf(CARD_BY_ID.get(id)!.floor), CORRUPTION.length - 1);
    (gold ? c.gold : c.n)[lap]++;
    this.unseen(id, lap, gold);
    this.checkTrophies();
    return { id, gold, lap, first };
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
      case 'level': return s.owned.some((n) => n >= r.n);
      case 'levelAll': return s.owned.every((n) => n >= r.n);
      case 'clicks': return s.clicks >= r.n;
      case 'crits': return s.crits >= r.n;
      case 'raids': return s.raids >= r.n;
      case 'fevers': return s.fevers >= r.n;
      case 'descents': return s.descents >= r.n;
      case 'dps': return this.baseDps().gte(r.n);
      case 'missed': return s.missed >= r.n;
      case 'awakens': return s.awakens >= r.n;
      case 'clutches': return s.clutches >= r.n;
      case 'champions': return s.champions >= r.n;
      case 'vaults': return s.vaults >= r.n;
      case 'rainbows': return s.rainbows >= r.n;
      case 'rampage': return s.rampage >= r.n;
      case 'cards': return this.cardsFound() >= r.n;
      case 'versions': return this.cardVersions() >= r.n;
      case 'boundAll': return BOUND.every((b) => (s.bound[b.id] ?? 0) >= r.n);
      case 'boundEarned': return s.boundEarned >= r.n;
      case 'trips': return s.tripsSent >= r.n;
      case 'tripCards': return s.tripCards >= r.n;
      case 'goldCards': return this.goldCardsFound() >= r.n;
    }
  }

  private checkTrophies(quiet = false) {
    let got = false;
    for (const t of TROPHIES) {
      if (this.trophySet.has(t.id) || !this.trophyMet(t.req)) continue;
      this.trophySet.add(t.id);
      this.s.trophies.push(t.id);
      if (!quiet) this.events.push({ t: 'trophy', id: t.id });
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

  private bankDrop(i: number, by: BankedBy) {
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

  /** Everything on the floor goes to the bank: leaving the floor, ascending ('all'), or a rainbow portal opening
   *  ('sweep', where every coin is seen flying up). */
  bankAllDrops(by: 'all' | 'sweep' = 'all') {
    while (this.drops.length) this.bankDrop(0, by);
  }

  private earn(n: Decimal) {
    this.s.gold = this.s.gold.plus(n);
    this.s.runGold = this.s.runGold.plus(n);
    this.s.totalGold = this.s.totalGold.plus(n);
  }

  /** Expeditions run on real time: they keep going (rolling finds, coming home) while the dungeon is paused, up in
   *  the Keep or at the menu. */
  realtime() {
    if (this.s.expeditions.length) this.meetHunters();
    this.tickTrips();
  }

  update(dt: number) {
    const s = this.s;
    this.realtime();
    if (s.inKeep) return;
    s.playTime += dt;
    this.sinceAttack += dt;
    if (this.sinceAttack > STREAK_GAP) this.streak = 0;
    for (const d of this.drops) d.t += dt;
    while (this.drops.length && this.drops[0].t >= GOLD_WAIT) this.bankDrop(0, 'time');
    for (const id in s.cooldowns) if ((s.cooldowns[id] -= dt) <= 0) delete s.cooldowns[id];
    s.runTime += dt;
    if (!this.idle()) {
      s.activeTime += dt;
      s.runActive += dt;
    }

    const vault = this.inVault();
    if (this.vaultOn && !vault) this.closeVault();
    this.vaultOn = vault;

    // Keep the field full of monsters (bosses come alone; the vault has only its chests).
    if (vault) {
      // (Nothing spawns in the vault.)
    } else if (!this.bossFloor()) {
      this.spawnT -= dt;
      // No more monsters than the floor still needs, so it ends on its last one (farming with auto off: no limit).
      const cap = s.auto && s.floorKills < this.killsNeeded() ? Math.min(MAX_ON, this.floorLeft()) : MAX_ON;
      if (this.spawnT <= 0 && this.monsters.length < cap) {
        this.spawn();
        this.spawnT = SPAWN_GAP;
      }
    } else if (this.monsters.length === 0 && (this.spawnT -= dt) <= 0) this.spawnBoss();

    this.sweepT -= dt;
    if (!vault && this.sweepT <= 0 && this.canSweep()) this.sweep();

    for (const m of this.monsters) m.arrive -= dt;
    this.companionsFight(dt);

    // Boss timer.
    if (!vault && this.bossFloor() && this.bossTime > 0) {
      this.bossTime -= dt;
      if (this.bossTime <= 0) this.bossFailed();
    } else if (this.downed > 0 && (this.downed -= dt) <= 0) this.enterFloor(Math.max(1, s.floor - 1), false, false, REGROUP_SECONDS);

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

    this.autoBuy(dt);

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
      // Phantom Legion: the Blade splits, one for every monster on the floor, each swing hitting them all.
      const legion = s.buffs.some((b) => b.id === 'legion');
      while (this.autoClick >= 1) {
        this.autoClick--;
        if (legion) for (const m of this.monsters.filter((x) => x.arrive <= 0)) this.click(m.id, -1, -1, true);
        else this.click(null, -1, -1, true);
      }
    }

    // Treasure goblins.
    if (this.raid) {
      this.raid.t += dt / this.raid.stay;
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
    this.downed = DOWNED_SECONDS;
  }

  /** Time passing while the fight is paused (the stairs between zones, the title menu): skill cooldowns still run. */
  passTime(seconds: number) {
    for (const id in this.s.cooldowns) if ((this.s.cooldowns[id] -= seconds) <= 0) delete this.s.cooldowns[id];
    this.autoBuy(seconds);
  }

  /** Rebuy what you've bought before (new upgrades stay yours to find). */
  private autoBuy(dt: number) {
    this.rebuyT -= dt;
    if (this.rebuyT > 0) return;
    this.rebuyT = REBUY_GAP;
    if (this.s.settings.autoUpg && this.autoUpgOpen()) this.buyAllUpgs(true);
  }

  /**
   * Catch up after time away: your companions farm the floor you were on.
   * Buffs, bosses and treasure don't happen while you're gone.
   */
  applyOffline(seconds: number): OfflineSummary {
    this.s.buffs = this.s.buffs.filter((b) => (b.t -= seconds) > 0);
    for (const id in this.s.cooldowns) if ((this.s.cooldowns[id] -= seconds) <= 0) delete this.s.cooldowns[id];
    this.invalidate();
    // Away counts as idle: the Sleeper and the Patient work through it.
    const sleeper = 1 + 0.25 * this.legendLv('sleeper');
    const before = this.events.length;
    const f = isBossFloor(this.s.floor) ? Math.max(1, this.s.floor - 1) : this.s.floor;
    const perSec = Math.min(1 / SPAWN_GAP, this.baseDps().times(sleeper).div(floorHp(f).times(TRASH)).toNumber());
    const kills = Math.floor(perSec * seconds);
    const gold = floorGold(f).times(kills * TRASH * this.c.gold * (1 + 0.5 * this.legendLv('patient')));
    this.earn(gold);
    this.s.kills += kills;
    // Kills away count toward the floor you're on: enough of them and it's cleared when you're back.
    if (f === this.s.floor && this.s.floorKills < this.killsNeeded()) {
      this.s.floorKills = Math.min(this.killsNeeded(), this.s.floorKills + kills);
      if (this.s.floorKills >= this.killsNeeded()) this.unlockNext();
    }
    // Every kill counts toward its monster's card, and rolls for it, as it would have at the keyboard.
    // Every kill's overkill while away: the party's damage per kill against one monster's health.
    const overkill = perSec > 0 ? this.baseDps().times(sleeper).div(floorHp(f).times(TRASH * perSec)).toNumber() : 1;
    this.awayKills(kills, f, overkill);
    const cards = this.events.slice(before).filter((e): e is Extract<GameEvent, { t: 'card' }> => e.t === 'card');
    this.s.playTime += seconds;
    this.s.runTime += seconds;
    this.checkTrophies();
    return { seconds, gold, kills, cards };
  }

  /** Kills while away, in bulk: each monster takes its share of the floor's mix (as pickMonster picks them), and its
   *  card drops as often as that many single rolls would give, drawn at once so a month away loads as fast as a minute. */
  private awayKills(kills: number, floor: number, overkill: number) {
    const featured = featuredFor(floor);
    const band = bandFor(floor);
    const lap = Math.min(lapOf(floor), CORRUPTION.length - 1);
    let odds = CARD_ODDS.monster / ((1 + 2 * legendShare(this.legendLv('collector'))) * this.overkillMult(overkill));
    if (this.debugCards) odds = Math.max(1, odds / 500);
    for (const def of new Set([featured, ...band])) {
      const share = (def.name === featured.name ? 0.5 : 0) + (0.5 * band.filter((d) => d.name === def.name).length) / band.length;
      const n = Math.round(kills * share);
      if (!n) continue;
      const id = cardId(def.name);
      this.s.slain[id] = (this.s.slain[id] ?? 0) + n;
      if (lap) (this.s.slainLaps[id] ??= CORRUPTION.map(() => 0))[lap] += n;
      for (let k = poisson(n / odds); k > 0; k--) this.giveCard(id, false, 'sweep');
    }
  }

}
