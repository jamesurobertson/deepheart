/**
 * Everything the game is made of: companions (who fight for you), the monster roster,
 * upgrades, trophies and flavor text. Pure data plus builders.
 */

import { DEMO } from '../demo.ts';

/** A picture for the UI: a sprite from the dungeon sheet, optionally with a badge. */
export interface Icon {
  /** An atlas sprite, or 'soul' for the soul glyph (the Ascend button's). */
  sprite: string;
  /** Small second sprite in the corner (synergies). */
  sub?: string;
  /** Roman-numeral tier badge color index. */
  tier?: number;
}

export type Attack = 'arrow' | 'bolt' | 'storm' | 'slash' | 'fire' | 'rune' | 'dark' | 'knife' | 'spear' | 'bomb' | 'orb' | 'ice' | 'flask' | 'bat' | 'skull' | 'light';

export interface CompDef {
  id: string;
  name: string;
  sprite: string;
  cost: number;
  dps: number;
  attack: Attack;
  flavor: string;
  /** Waits on this floor: hired only once your deepest floor ever has reached it. */
  floor: number;
  big?: boolean;
  /** Needs this many awakenings of the Heart (the late recruits). */
  heart?: number;
}

const c = (id: string, name: string, sprite: string, cost: number, dps: number, attack: Attack, flavor: string, floor = 0, big = false, heart = 0): CompDef =>
  ({ id, name, sprite, cost, dps, attack, flavor, floor, big, heart });

/** Prices go by place in the list, whoever stands there. The first twenty-three come with gold: the first five keep
 *  their snappy opening numbers, then each costs about ×4 the last up to the Archmage. The last nine wait on a floor,
 *  each priced against the gold on its floor, more of it the deeper it waits (150× the floor's gold at 95, rising to
 *  30,000× from 450 on: about a minute and a half of killing at full speed), since a deeper one meets a stronger party. Once levels pass 200, damage per gold grows about gold^0.82 for
 *  everyone (×1.07 a level against ×4 every 25), so damage is set from price on one smooth curve: from the Shieldmaiden
 *  on, damage ÷ price^0.82 is about 8% better than the one before through the first twenty-three and 12% after, counted
 *  as if each had three ×2 traits. So a new face always hits harder than the last, and one whose traits go to the party,
 *  gold or crits instead ends up weaker on its own. Those with more than three (the Archmage and the late ones) keep the
 *  numbers they were tuned at; the Archmage sits just above the Oathbreaker. */
export const COMPS: CompDef[] = [
  // Plain adventurers first; the strange and the enormous come later.
  // The first four are cheap and hit hard, so the party carries the opening and clicking is a bonus.
  c('squire', 'Squire', 'knight_m', 5, 1, 'slash', 'Wants to be a knight so badly.'),
  c('ranger', 'Ranger', 'elf_f', 40, 4, 'arrow', 'Never misses. Well, rarely. Well, sometimes.'),
  c('brawler', 'Dwarf Brawler', 'dwarf_m', 250, 12, 'slash', 'Came for the gold. Stayed for the punching.'),
  c('apprentice', 'Apprentice', 'wizzard_m', 2_000, 50, 'bolt', 'Knows one spell. So far nobody has complained.'),
  c('gingerbread', 'Gingerbread Man', 'cr_gingerbread', 12_000, 150, 'slash', 'Ran from the oven. Somehow ended up down here.'),
  c('shieldmaiden', 'Shieldmaiden', 'ef_elvenknight', 80_000, 1_400, 'slash', 'Her shield has killed more monsters than her sword.'),
  c('hunter', 'Lizard Hunter', 'lizard_m', 3.2e5, 4_700, 'spear', 'Can smell a monster through three floors of solid stone.'),
  c('thief', 'Shadow Thief', 'cr_green_thief', 1.3e6, 16_000, 'knife', 'He carries six daggers. Seven would simply be bragging.'),
  // The demo stops at the Shadow Thief: past him, one silhouette for the full game.
  ...(DEMO ? [c('corsair', '???', 'cr_pirate_captain', 5e6, 87_000, 'bomb', '')] : [
    c('corsair', 'Corsair Captain', 'cr_pirate_captain', 5e6, 52_000, 'bomb', 'Sailed the seven seas. Still confused by stairs.'),
    c('runesmith', 'Runesmith', 'dwarf_f', 2e7, 1.8e5, 'rune', 'Maybe should be in OSRS. But here we are.'),
    c('woodelf', 'Wood Elf', 'ef_elf_f', 7.9e7, 5.9e5, 'arrow', 'Grew up in the Enchanted Grove. Has opinions about what you did to it.'),
    c('stormcaller', 'Stormcaller', 'wizzard_f', 3.1e8, 2e6, 'storm', 'Brings her own weather. Down here, of all places.'),
    c('dancer', 'Blade Dancer', 'elf_m', 1.2e9, 6.4e6, 'slash', 'Fights like it is a performance. Nobody claps.'),
    c('bard', 'Wandering Bard', 'rm_rocker', 4.9e9, 2.2e7, 'orb', 'We\'re not sure how he got in here.'),
    c('venomblade', 'Venomblade', 'lizard_f', 2e10, 7.6e7, 'dark', 'Every blade is poisoned. She has a lot.'),
    c('doctor', 'Plague Doctor', 'doc', 7.7e10, 2.5e8, 'flask', 'Treats monsters with a strict regimen of dying.'),
    c('cleric', 'Cleric', 'ef_normalcleric', 3.1e11, 8.5e8, 'light', 'Here to heal the party. Hasn\'t had to yet, so he hits things.'),
    c('frostimp', 'Frost Imp', 'cr_frost_imp', 1.2e12, 2.8e9, 'ice', 'Came up from the Frozen Vault. Finds the rest of the dungeon too warm.'),
    c('santa', 'Santa', 'cr_santa', 4.8e12, 9.4e9, 'ice', 'Santa? Is that really you?'),
    c('paladin', 'Paladin', 'cr_gold_knight', 1.9e13, 3.2e10, 'slash', 'Swore to purge the deep. Has been purging enthusiastically.'),
    c('hollow', 'Lantern Knight', 'pumpkin_dude', 7.6e13, 1.1e11, 'fire', 'Nobody knows what is inside the pumpkin. Don\'t be the first to ask.'),
    c('oathbreaker', 'Oathbreaker', 'cr_purple_knight', 3e14, 3.6e11, 'dark', 'Has broken every vow but one. Nobody asks which.'),
    c('archmage', 'Archmage', 'cr_wizard', 1.2e15, 4e11, 'orb', 'Older than the dungeon. Insists the dungeon was smaller back then.'),
    c('wraith', 'The Count', 'rm_dracula', 7.4e21, 4.1e17, 'bat', 'We all know who he really is.', 95),
    c('elfqueen', 'Elf Queen', 'ef_highelf_f', 1.1e25, 9.2e19, 'light', 'Left her court for the deep. Still expects a curtsy.', 130),
    c('necro', 'Necromancer', 'necromancer', 1.4e29, 1.2e23, 'skull', 'Used to raise these monsters. Now he lowers them.', 190),
    c('king', 'Exiled King', 'sd_king', 3.5e32, 1.6e26, 'fire', 'Lost his crown, his kingdom and his temper. In that order.', 240),
    c('elflord', 'Elf Lord', 'ef_highelf_m', 1.9e35, 3.2e28, 'slash', 'A thousand years of swordsmanship. Still practicing.', 280),
    c('magus', 'Old Magus', 'ef_wizard', 2.9e46, 2.7e37, 'storm', 'Was down here before the dungeon. Says it followed him.', 450),
    c('angel', 'Fallen Angel', 'angel', 5.1e67, 7.9e54, 'light', 'Fell from somewhere, here to stay.', 800),
    c('ogre', 'Tamed Oni', 'sm_large_oni_blue', 1.6e110, 2.5e90, 'slash', 'Answers to "Pebble." Crushes whatever you point at.', 1500, true),
    c('demon', 'Bound Demon', 'big_demon', 1.7e201, 1.5e164, 'fire', 'The contract is written in blood. Mostly the monsters\'.', 3000, true),
  ]),
];

/** A companion's place in the roster, by id (so lists below don't break if the order changes). */
export const compIndex = (id: string) => {
  const i = COMPS.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`no companion ${id}`);
  return i;
};

// ---------- monsters and zones ----------

export interface MonsterDef {
  sprite: string;
  name: string;
  /** Health multiplier. */
  hp: number;
  big?: boolean;
  /** Color wash for variants (frost trolls and the like), as 0xRRGGBB. */
  tint?: number;
  /** Arrives differently: bursts up through a floor grate, or flies in above the floor. */
  move?: 'emerge' | 'fly';
}

const m = (sprite: string, name: string, hp = 1, tint?: number, move?: MonsterDef['move']): MonsterDef => ({ sprite, name, hp, tint, move });

/** Tile theme a zone is built from (see the renderer). */
export type Tiles = 'halls' | 'crypt' | 'jungle' | 'tomb' | 'sewer';

export interface ZoneDef {
  name: string;
  tiles: Tiles;
  /** Crowd for ordinary floors. */
  band: MonsterDef[];
  /** Guards floor 5 of the zone. */
  mid: MonsterDef;
  /** Guards floor 10: beat it to move on to the next zone. */
  boss: MonsterDef;
  /** Newcomers that join the crowd once the zones come round again (CR+ characters). */
  lap: MonsterDef[];
}

/**
 * Ten floors per zone, each with its own look, crowd and bosses. After the last one the
 * zones come round again, deeper and harder ("The Upper Halls II").
 */
export const ZONES: ZoneDef[] = [
  {
    name: 'The Upper Halls', tiles: 'halls',
    band: [m('goblin', 'Goblin', 0.9), m('tiny_zombie', 'Rotling'), m('imp', 'Imp', 0.8), m('tiny_slug', 'Slug', 1.2), m('ef_bandit', 'Deserter')],
    mid: m('ef_bear', 'Cave Bear'), boss: m('ogre', 'Ogre Chieftain'),
    lap: DEMO ? [] : [m('cr_crimson_wraith', 'Crimson Wraith'), m('cr_plague_crow', 'Plague Crow', 0.9), m('knight_f', 'Fallen Knight', 1.2)],
  },
  {
    name: 'The Bone Crypts', tiles: 'crypt',
    band: [m('skelet', 'Skeleton'), m('tiny_zombie', 'Rotling'), m('skelet', 'Skeleton Archer', 0.9, 0xe8d49a), m('necromancer', 'Grave Priest', 0.9), m('rm_zombie', 'Ghoul', 1.1)],
    mid: m('ef_golem', 'Bone Golem', 1, 0xd8d0c0), boss: m('necromancer', 'The Lich', 1, 0xb0a0ff),
    lap: DEMO ? [] : [m('cr_skeleton', 'Grave Walker'), m('cr_blue_wraith', 'Pale Wraith'), m('cr_frost_skeleton', 'Santa Skeleton', 0.9, 0xd0c8ff)],
  },
  {
    name: 'The Overgrown Warrens', tiles: 'jungle',
    band: [m('orc_warrior', 'Orc Warrior', 1.2), m('orc_shaman', 'Orc Shaman', 0.9), m('ef_wolf', 'Dire Wolf'), m('ef_smallmushroom', 'Sporeling', 0.8), m('ef_normalmushroom', 'Mushroom Folk')],
    mid: m('ef_largemushroom', 'Elder Shroom'), boss: m('ef_troll', 'Troll Brute'),
    lap: DEMO ? [] : [m('cr_orc_pirate', 'Orc Raider', 1.2), m('cr_slime', 'Moss Slime', 0.8), m('cr_green_thief', 'Warren Thief')],
  },
  // The demo ends at floor 30: the zones after it are blanks.
  ...(DEMO ? Array.from({ length: 5 }, (): ZoneDef => ({ name: '???', tiles: 'halls', band: [m('goblin', '???')], mid: m('goblin', '???'), boss: m('goblin', '???'), lap: [] })) : [
    {
      name: 'The Sunken Tomb', tiles: 'tomb',
      band: [m('ef_gnollscout', 'Gnoll Scout', 0.9), m('ef_gnollbrute', 'Gnoll Brute', 1.2), m('ef_gnollshaman', 'Gnoll Shaman'), m('masked_orc', 'Masked Looter')],
      mid: m('ef_gnolloverseer', 'Gnoll Overseer'), boss: m('ef_golem', 'Tomb Golem', 1, 0xe8c888),
      lap: [m('cr_pirate', 'Drowned Pirate'), m('cr_pirate_captain', 'Drowned Captain', 1.2), m('cr_skeleton_pirate', 'Bone Corsair')],
    },
    {
      name: 'The Rotting Deep', tiles: 'sewer',
      band: [m('zombie', 'Zombie', 1.1), m('slug', 'Great Slug', 1.3), m('swampy', 'Bog Lurker', 1.2), m('muddy', 'Mudling', 1.1), m('sw_bat', 'Sewer Bat', 0.8, undefined, 'fly')],
      mid: m('sw_slugbot', 'Sludge Walker'), boss: m('sw_tentacle', 'The Thing Below', 1, undefined, 'emerge'),
      lap: [m('cr_slime', 'Rot Slime', 1, 0xc0a0ff), m('cr_plague_crow', 'Carrion Crow', 1, 0xc8a070), m('cr_gourd', 'Rotten Gourd', 1.1, 0xa8b870), m('big_zombie', 'The Rotten King', 1.4)],
    },
    {
      name: 'The Enchanted Grove', tiles: 'jungle',
      band: [m('ef_centaur_m', 'Centaur'), m('ef_centaur_f', 'Centaur Archer', 0.9), m('ef_forestguardian', 'Grove Warden', 1.2), m('ef_wolf', 'Moon Wolf', 1, 0xb8a8ff)],
      mid: m('ef_bear', 'Grove Bear', 1, 0xb0f0a0), boss: m('ef_ent', 'The Elder Ent'),
      lap: [m('cr_gourd', 'Gourd Knight', 1.1), m('cr_green_thief', 'Grove Bandit', 1, 0xa8c8ff), m('cr_wizard', 'Mad Hermit', 0.9)],
    },
    {
      name: 'The Demon Gate', tiles: 'halls',
      band: [m('chort', 'Chort'), m('wogol', 'Wogol', 1.1), m('imp', 'Imp', 0.8), m('masked_orc', 'Cultist', 1.2, 0xff8a8a)],
      mid: m('ogre', 'Hellfire Ogre', 1, 0xff9070), boss: m('sm_oni_red', 'Pit Lord'),
      lap: [m('sd_knight_elite', 'Gilded Zealot', 1.2), m('knight_f', 'Fallen Knight', 1.2), m('cr_king', 'Damned King', 1.1)],
    },
    {
      name: 'The Frozen Vault', tiles: 'halls',
      band: [m('ice_zombie', 'Frost Husk', 1.2), m('skelet', 'Frozen Skeleton', 1, 0xb0e0ff), m('ef_wolf', 'Frost Wolf', 1, 0xd0f0ff), m('necromancer', 'Rime Witch', 0.9, 0xa0d8ff)],
      mid: m('ef_golem', 'Ice Golem', 1, 0xa8e0ff), boss: m('ef_troll', 'Frost Troll', 1, 0xa8d8ff),
      lap: [m('sm_oni_blue', 'Frost Oni', 0.9), m('cr_snowman', 'Snow Brute', 1.2), m('cr_ice_ghost', 'Rime Ghost'), m('cr_nutcracker', 'Tin Soldier')],
    },
  ] satisfies ZoneDef[]),
];

/** Zone index for a floor (0-based, keeps counting past the last zone). */
export const zoneOf = (floor: number) => Math.floor((floor - 1) / 10);

export const zoneFor = (floor: number) => ZONES[zoneOf(floor) % ZONES.length];

/** "The Sunken Tomb", then "The Corrupted Sunken Tomb" once the zones come round again. */
/** Every lap through the eight zones comes back darker, washed in its own color. */
export const CORRUPTION: { name: string; tint: number }[] = [
  { name: '', tint: 0xffffff },
  { name: 'Corrupted', tint: 0xc89cff },
  { name: 'Abyssal', tint: 0xff8a8a },
  { name: 'Hollow', tint: 0x9cffd2 },
  { name: 'Eternal', tint: 0xffd890 },
];

/** Laps completed through the eight zones by this floor (0 for floors 1–80). */
export function lapOf(floor: number): number {
  return Math.floor(zoneOf(floor) / ZONES.length);
}

export function corruptionOf(lap: number) {
  return CORRUPTION[Math.min(lap, CORRUPTION.length - 1)];
}

export function zoneName(floor: number): string {
  const z = zoneOf(floor);
  const lap = lapOf(floor);
  const base = ZONES[z % ZONES.length].name.replace(/^The /, '');
  if (!lap) return ZONES[z % ZONES.length].name;
  const extra = lap >= CORRUPTION.length ? ` ${['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(lap - CORRUPTION.length, 8)]}` : '';
  return `The ${corruptionOf(lap).name} ${base}${extra}`;
}

/** A zone's crowd: on later laps its newcomers push in alongside two of the originals. */
export function bandFor(floor: number): MonsterDef[] {
  const z = zoneFor(floor);
  return lapOf(floor) ? [...z.lap, ...z.band.slice(0, 2)] : z.band;
}

/** The monster an ordinary floor is known for (its face on the floor map): the first half of a zone shows off the
 *  crowd's first four, the second half the rest. */
export function featuredFor(floor: number): MonsterDef {
  const band = bandFor(floor);
  const k = (floor - 1) % 10;
  return band[(k < 5 ? k : k - 1) % band.length];
}

/** Half of an ordinary floor's crowd is its featured monster; the rest is anyone from the zone. */
export function pickMonster(floor: number): MonsterDef {
  if (Math.random() < 0.5) return featuredFor(floor);
  const band = bandFor(floor);
  return band[Math.floor(Math.random() * band.length)];
}

/** Each lap builds the zones from a different tileset, so a repeat zone is a new place, not a recolor. */
const THEMES: Tiles[] = ['halls', 'crypt', 'jungle', 'tomb', 'sewer'];
/** How far each lap shifts the tileset: the first repeat jumps furthest (dungeon stone ↔ jungle and desert). */
const THEME_SHIFT = [0, 2, 4, 1, 3];
export function tilesFor(zone: number): Tiles {
  const lap = Math.floor(zone / ZONES.length);
  const base = ZONES[zone % ZONES.length].tiles;
  return THEMES[(THEMES.indexOf(base) + THEME_SHIFT[lap % THEME_SHIFT.length]) % THEMES.length];
}


/** Floor 5 of a zone gets its mid-boss, floor 10 its zone boss. */
export function bossFor(floor: number): MonsterDef {
  const z = zoneFor(floor);
  return floor % 10 === 0 ? z.boss : z.mid;
}

// ---------- upgrades ----------

export type Effect =
  | { t: 'comp'; comp: number; mult: number }
  | { t: 'click'; mult: number }
  | { t: 'clickDps'; pct: number }
  | { t: 'auto'; add: number }
  | { t: 'global'; pct: number }
  /** Every companion deals this many times the damage (multiplies with other party traits). */
  | { t: 'party'; mult: number }
  /** Damage to bosses, added up across upgrades. */
  | { t: 'boss'; pct: number }
  /** A trait whose whole effect is the skill it unlocks. */
  | { t: 'skill' }
  | { t: 'gold'; pct: number }
  | { t: 'crit'; chance?: number; add?: number }
  | { t: 'cleave'; pct: number }
  | { t: 'raid'; freq?: number; effect?: number }
  | { t: 'trophy'; k: number }
  | { t: 'fever'; dur?: number; fill?: number; power?: number };

export interface UpgDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  icon: Icon;
  effect: Effect;
  req: Req;
  /** Only on offer once this ability is unlocked (crit upgrades need crits, and so on). */
  needs?: AbilityId;
  /** A funny line under the effect in the tooltip. */
  flavor?: string;
  /** A second effect on top of the main one (some companion upgrades also sharpen crits). */
  bonus?: Effect;
}

export type Req =
  | { t: 'owned'; comp: number; n: number }
  | { t: 'floor'; n: number }
  | { t: 'raids'; n: number }
  | { t: 'trophies'; n: number }
  | { t: 'fevers'; n: number };

/** Companion levels a trait can open at (a companion has 4–7 of them), and each trait's price as a multiple of the
 *  companion's hire price. */
const TRAIT_LEVELS = [10, 25, 50, 75, 100, 125, 150];
const TRAIT_COST = [12, 30, 150, 1_000, 1e4, 6e4, 3e5];
/** From level `from`, every `every` levels multiply a companion's damage by `mult` (by `thousand` instead at each
 *  1000th level), on their own: old companions stay worth leveling, and a cheap one reaching level 1000 can overtake
 *  the newest. (An object so the pacing tools can try other values.) */
export const LEVEL_BONUS = { from: 200, every: 25, mult: 4, thousand: 10 };
/** The multiplier a companion gets on reaching this level (1 if the level isn't a milestone). */
export const milestoneMult = (level: number) =>
  level < LEVEL_BONUS.from || (level - LEVEL_BONUS.from) % LEVEL_BONUS.every ? 1 : level % 1000 ? LEVEL_BONUS.mult : LEVEL_BONUS.thousand;
export const levelMult = (level: number) => {
  if (level < LEVEL_BONUS.from) return 1;
  const steps = Math.floor((level - LEVEL_BONUS.from) / LEVEL_BONUS.every) + 1;
  const thousands = Math.floor(level / 1000);
  return LEVEL_BONUS.mult ** (steps - thousands) * LEVEL_BONUS.thousand ** thousands;
};

/** Each companion level costs this much more than the last. */
export const COST_GROWTH = 1.07;
/** What each companion's traits do, in order: own (×2 to them), party (+50% to every companion), click (+1% of party
 *  damage per click), gold (+50%), boss (+25% to bosses), blade (Phantom Blade +1/s), crit2/crit3 (+2/3% crit chance),
 *  critx1/critx2 (+1×/+2× crit damage), cleave25/cleave50 (Cleave +25%/+50%), fevfill (Rampage fills 25% faster),
 *  fevdur (Rampage lasts 50% longer), fevpow (Rampage +1 on both tiers), or skill (unlocks the ability listed in
 *  ABILITIES at that trait). Companions and their traits are the whole shop.
 *  Party traits multiply together, so only five companions have one, each a rallying sort (×7.6 in all; one on everyone
 *  was ×330 and most of the opening hour's explosion). */
const TRAIT_PLAN: Record<string, string[]> = {
  squire: ['skill', 'skill', 'own', 'click', 'blade', 'boss', 'click'],
  ranger: ['own', 'skill', 'crit2', 'crit3', 'blade', 'crit3'],
  brawler: ['own', 'own', 'skill', 'fevfill', 'fevdur', 'fevpow'],
  apprentice: ['own', 'own', 'own', 'click'],
  hunter: ['own', 'critx1', 'own', 'critx1', 'own'],
  shieldmaiden: ['own', 'boss', 'skill', 'cleave25', 'boss', 'party'],
  thief: ['own', 'crit2', 'gold', 'crit3', 'gold'],
  gingerbread: ['own', 'own', 'click', 'own'],
  ...(DEMO ? {} : {
    dancer: ['own', 'critx1', 'click', 'critx1', 'own'],
    corsair: ['own', 'gold', 'own', 'skill', 'gold', 'party'],
    runesmith: ['own', 'own', 'own', 'skill', 'blade', 'boss'],
    paladin: ['own', 'boss', 'click', 'own', 'cleave50'],
    stormcaller: ['own', 'own', 'click', 'own', 'skill', 'blade', 'party'],
    venomblade: ['own', 'crit3', 'own', 'critx2', 'crit3', 'party'],
    doctor: ['own', 'own', 'own', 'boss'],
    frostimp: ['own', 'own', 'own', 'click'],
    hollow: ['own', 'boss', 'own', 'own', 'boss'],
    oathbreaker: ['own', 'click', 'own', 'own', 'click'],
    archmage: ['own', 'own', 'own', 'click', 'own', 'own'],
    wraith: ['own', 'blade', 'own', 'own'],
    necro: ['own', 'own', 'own', 'own', 'own'],
    king: ['own', 'gold', 'own', 'own', 'gold', 'own'],
    angel: ['own', 'own', 'own', 'own', 'own'],
    ogre: ['own', 'boss', 'own', 'boss', 'own'],
    demon: ['own', 'own', 'own', 'own', 'own', 'party', 'own'],
    woodelf: ['own', 'crit2', 'own', 'gold', 'own'],
    bard: ['own', 'click', 'own', 'boss', 'own'],
    cleric: ['own', 'own', 'boss', 'own'],
    santa: ['own', 'gold', 'own', 'own', 'gold'],
    elfqueen: ['own', 'own', 'crit3', 'own', 'own'],
    elflord: ['own', 'boss', 'own', 'own', 'own'],
    magus: ['own', 'own', 'click', 'own', 'own', 'own'],
  }),
};
/** A companion's trait levels (as many as it has traits). */
export const traitLevels = (comp: number) => TRAIT_LEVELS.slice(0, TRAIT_PLAN[COMPS[comp].id]?.length ?? 0);
/** Each companion's milestone upgrades, one per milestone. */
const MILESTONE_NAMES: Record<string, string[]> = {
  squire: ['Practice Swing', 'Eager Beaver', 'Training Wheels', 'Squire Power', 'Overachiever', 'Knighthood Pending', 'Sir Squire'],
  ranger: ['Near Miss', 'Mostly Accurate', 'Long Shot', 'Quiver Wit', 'Bullseye-ish', 'Dead Eye'],
  brawler: ['Knuckle Down', 'Short Fuse', 'Punch Line', 'Gold Digger', 'Beard Punch', 'Round Two'],
  apprentice: ['One Trick', 'Spark of Genius', 'Shock Value', 'Fast Learner', 'Bolt from the Blue'],
  hunter: ['Cold Blooded', 'Keen Nose', 'Scent Trail', 'Tail Gate', 'Scale Up'],
  shieldmaiden: ['Shield Bash', 'Board Meeting', 'Living Wall', 'Best Defense', 'Bash Course', 'Hold the Line'],
  thief: ['Light Fingers', 'Sticky Fingers', 'Pickpocket', 'Knife to Meet You', 'Steal of a Deal'],
  gingerbread: ['Fresh Out of the Oven', 'Crumb Trail', 'Hard Crust', 'Extra Icing'],
  ...(DEMO ? {} : {
    dancer: ['First Position', 'Pirouette', 'Dance Off', 'Cutting a Rug', 'Sword Dance'],
    corsair: ['Sea Legs', 'Plunder Ground', 'Shiver Me Timbers', 'Sunken Treasure', 'Below Deck', 'Full Sail'],
    runesmith: ['Chisel In', 'Floor Plan', 'Rune for Cover', 'Set in Stone', 'Groundbreaking', 'Rock Bottom'],
    paladin: ['Holy Moly', 'Purge Party', 'Smite Club', 'Light Work', 'Holy Order'],
    stormcaller: ['Brainstorm', 'Under the Weather', 'Cloud Cover', 'Storm Front', 'Eye of the Storm', 'Lightning Rod', 'Perfect Storm'],
    venomblade: ['Toxic Trait', 'Bad Blood', 'Bite Back', 'Poison Pen', 'Forked Tongue', 'Snake Oil'],
    doctor: ['Second Opinion', 'Bedside Manner', 'House Call', "Doctor's Orders", 'Bad Prognosis'],
    frostimp: ['Cold Snap', 'Chill Out', 'Ice Breaker', 'Frostbite', 'Cold Shoulder'],
    hollow: ['Gourd Duty', 'Pumpkin Spice', 'Carved Up', 'Patch Work', 'Squash Them'],
    oathbreaker: ['Promise Ring', 'Broken Vow', 'Fine Print', 'Word Breaker', 'No Take-Backs'],
    archmage: ['Old School', 'Back in My Day', 'Spell Check', 'Arch Rival', 'Senior Moment', 'Old Magic'],
    wraith: ['First Bite', 'Night Owl', 'Blood Bank', 'Old Blood', 'Count Me In'],
    necro: ['Change of Heart', 'Grave Mistake', 'Dead Serious', 'Bone to Pick', 'Raise the Stakes'],
    king: ['Royal Pain', 'Throne Away', 'Heavy Is the Head', "King's Ransom", 'Royal Tax', 'Crown Jewels'],
    angel: ['Fall Guy', 'Grounded', 'Fallen Grace', 'Wing It', 'Halo Effect'],
    ogre: ['Good Boy', 'Pebble Dash', 'Rock Solid', 'Big Softie', 'Boulder Dash'],
    demon: ['Terms and Conditions', 'Blood Pact', 'Hell to Pay', "Devil's Advocate", 'Hellfire', 'Soul Contract', 'Fire Sale'],
    woodelf: ['Bark Skin', 'Sharp Eyes', 'Deep Roots', 'Forager', 'Old Growth'],
    bard: ['Warm-Up Act', 'Encore', 'Power Chord', 'Headliner', 'Farewell Tour'],
    cleric: ['Morning Prayer', 'Laying On Hands', 'Smite', 'Last Rites'],
    santa: ['Naughty List', 'Stocking Stuffer', 'Down the Chimney', 'Ho Ho Hold On', 'Coal Delivery'],
    elfqueen: ['Royal Decree', 'Starlight', 'Keen Edge', 'Silver Court', 'Long Reign'],
    elflord: ['Ancient Form', 'Old Duel', 'Perfect Stance', 'Thousand Cuts', 'Elder Blade'],
    magus: ['Star Chart', 'Long Beard', 'Deep Magic', 'Hat Trick', 'Ancient Words', 'Final Spell'],
  }),
};
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/** The level of a companion's k-th trait (k from 0). */
export const milestoneAt = (k: number) => TRAIT_LEVELS[k];

/** The next level above this one that brings this companion something: a trait, or past its last trait the ×4 every
 *  25 levels from 200. */
export function nextMilestone(comp: number, level: number): number {
  const trait = traitLevels(comp).find((m) => m > level);
  const { from, every } = LEVEL_BONUS;
  return trait ?? (level < from ? from : from + every * (Math.floor((level - from) / every) + 1));
}

/** A line of flavor under each of those upgrades. */
const MILESTONE_FLAVOR: Record<string, string[]> = {
  squire: ['He practices on everything. Mostly monsters.', 'Up before dawn. Swinging before breakfast.', "The training wheels are off. He's never been faster.", 'Small squire. Big swing.', 'Extra credit, paid in monsters.', 'The paperwork is in. Any day now.', 'Not official. He says it anyway.'],
  ranger: ['Closer than last time. That counts.', 'Eight out of ten monsters agree.', 'She hit something two floors down. Probably a monster.', 'Has a comeback for every monster. Most of them are arrows.', "It's the thought that counts. The arrow helps.", 'Hasn\'t missed in weeks. Don\'t bring it up.'],
  brawler: ["He's taking this seriously now. Very seriously.", "Don't mention his height. Or anything.", 'He tells the joke. The monster gets the punch.', 'Every hole he digs has gold or a monster in it. He\'s happy either way.', 'Nobody knows how. Nobody wants a demonstration.', 'He was only warming up. The monsters were not.'],
  apprentice: ["It's a good trick.", 'Heavy on the sparks.', 'Monsters find him shocking.', "Learned a second spell. It's also lightning.", 'Also from the red, the green and the ceiling.'],
  hunter: ['Hasn\'t blinked since floor one.', 'Smells fear. Also lunch.', 'Follows it three floors down and back.', 'Gets too close. On purpose.', 'Grows a little every time something dies.'],
  shieldmaiden: ['Her idea of defense is getting there first.', 'The shield meets the face. Meeting adjourned.', "Walls don't usually chase you.", 'Is a good offense. She checked.', 'She teaches it. Monsters fail it.', 'Everyone behind her fights braver.'],
  thief: ["Your purse feels lighter. That's normal.", 'Counts his daggers every morning. Still six.', 'Monsters have pockets. Had.', 'He says it every time. Nobody\'s laughed yet.', "He's very proud of this price."],
  gingerbread: ['Still warm, and furious about it.', 'Monsters follow it. Briefly.', 'Stale on purpose. Hits harder.', 'Dressed for battle, in frosting.'],
  ...(DEMO ? {} : {
    dancer: ["Also the monster's last position.", 'One spin, three slices.', 'The monsters lost. It wasn\'t close.', 'And everything standing on it.', "Don't stand too close. Don't stand at all."],
    corsair: ['Steady on any floor. Even the wet ones.', 'Anything not nailed down is treasure. He brought a crowbar.', 'The monsters shiver first.', 'Found a chest at the bottom of the sea. Now he hits things with it.', 'The lower the deck, the bigger the haul.', 'The whole crew hits harder with the wind behind them.'],
    runesmith: ['Every swing leaves a mark. Some marks explode.', 'Step one: carve the floor. Step two: stand back.', "Monsters run. Runes don't care.", "The runes are permanent. The monsters aren't.", 'Ask the floor.', 'Bosses hit the floor. The floor hits back.'],
    paladin: ['A prayer and a punch.', "Everyone's invited. Nobody leaves.", 'Everyone\'s welcome. Monsters get the full ceremony.', 'Purging is easy when you glow.', 'The order is: hit it again.'],
    stormcaller: ['Her best ideas come with lightning.', 'The monsters are. Permanently.', 'Rains indoors. Nobody brought an umbrella.', "She's always at the front of it.", 'The only calm spot is right behind her.', 'The blade keeps getting struck. It likes it.', 'Everyone fights better in her weather.'],
    venomblade: ["Calls it a toxic trait. She's proud of it.", 'Theirs, all over the floor.', 'Monsters bite. She bites back harder.', 'She writes their names on the blades. Then delivers them.', 'Says one thing. Stabs another.', 'She sells it to the party. It works, somehow.'],
    doctor: ['Agrees with the first one. You\'re dying.', 'Terrible. Effective.', 'Comes to you. Unfortunately.', 'Rest. Permanently.', 'For them. Always for them.'],
    frostimp: ['Snaps. Things. Cold.', "It won't. Ever.", 'Breaks the ice. And the monster.', 'Bites, too.', 'Monsters get it. Then they get frozen.'],
    hollow: ['Reporting for it.', 'Seasonal. Lethal.', "The pumpkin's smile gets wider every fight.", 'Fresh from the patch. Ready to work.', 'Pun intended.'],
    oathbreaker: ["Doesn't count. Never did.", "Another one. He's keeping count.", 'He read it. Then ignored it.', 'Don\'t take his word for it.', 'Swings first. Never apologizes.'],
    archmage: ['The original school. He built it.', 'Monsters were bigger. He was faster.', 'Checked every spell twice. The monsters checked out.', "He has one. It's the dungeon.", 'Forgot what he was casting. It worked anyway.', 'The first spell he ever learned. Still the strongest.'],
    wraith: ['Polite about it. Mostly.', 'Sleeps all day. Down here it is always night.', 'Every monster makes a deposit.', 'Younger than the Archmage, and touchy about it.', 'Never misses a fight. Never misses a meal.'],
    necro: ['Switched sides. The skeletons took it personally.', 'The monsters made it.', 'About the job. About the dead.', 'With every skeleton he ever raised.', 'And then drive them in.'],
    king: ["A pain in every monster's neck.", "He's fine about it. Don't bring it up.", 'Heavy is the fist, too.', "Nobody's paying it. He's taking it.", 'Taxes the monsters. Up front.', 'He kept the jewels. They make a decent sling.'],
    angel: ['Took the fall. Gave back worse.', 'Not allowed back up. Takes it out on the monsters.', 'Less grace, more punching.', 'No plan. Lots of wing.', 'Monsters see it. Then they see nothing.'],
    ogre: ["Yes he is. Who's a good boy? Pebble is.", 'Pebble runs. Things break.', 'Pebble is not small. Nobody has told Pebble.', 'To you. Only to you.', 'Pebble got bigger.'],
    demon: ['Nobody reads them. The monsters should have.', 'Signed in blood. Not his.', "And it's collecting.", 'Argues for violence. Wins.', 'Brought from home.', 'Every companion signed. Nobody read it.', 'Everything must burn.'],
    woodelf: ['Tougher than she looks. Woodier, too.', 'Spots the weak point. Then the next one.', 'Stays put. The monsters do not.', 'Turns over every stone. Some have gold under them.', 'Older than she looks. Elves are like that.'],
    bard: ['Goes on first. Nobody survives long enough to heckle.', 'Nobody asked. He played anyway.', 'Three notes. All of them loud.', 'Top of the bill. Bottom of the dungeon.', 'Says it\'s his last. It never is.'],
    cleric: ['Asks for strength. Gets it.', 'Firmly.', 'Holy, and heavy.', 'Reads them to the monster. Briefly.'],
    santa: ['Every monster is on it.', 'Fills every pocket with gold.', 'No chimneys down here. He has not let that stop him.', 'Jolly. Until he isn\'t.', 'Straight to the face.'],
    elfqueen: ['Monsters are to stop existing. They comply.', 'Shines where torches fail.', 'Finds the gap in any armor.', 'Her court followed her down. Armed.', 'She has outlived every enemy so far.'],
    elflord: ['Learned it before the dungeon was dug.', 'Still accepting challengers. None have lasted the afternoon.', 'Hasn\'t moved his feet in a century. Nothing has gotten close enough to make him.', 'Counts them. Every one.', 'Older than the sword. The sword is very old.'],
    magus: ['Reads the sky. From underground.', 'Every hair a spell.', 'The kind of magic that\'s hard to explain. He won\'t try.', 'Pulls more than rabbits out of it.', 'Nobody speaks them anymore. He shouts them.', 'He keeps saying that.'],
  }),
};

function milestoneName(comp: string, k: number) {
  return MILESTONE_NAMES[comp][k];
}

/** What a trait does, in words and in effect (see TRAIT_PLAN). */
function traitEffect(kind: string, comp: number): { effect: Effect; desc: string } {
  const num = Number(kind.replace(/\D+/g, ''));
  if (kind === 'own') return { effect: { t: 'comp', comp, mult: 2 }, desc: `${COMPS[comp].name} deals ×2 damage.` };
  if (kind === 'party') return { effect: { t: 'party', mult: 1.5 }, desc: 'Every companion deals +50% damage.' };
  if (kind === 'click') return { effect: { t: 'clickDps', pct: 0.01 }, desc: "Attacks also deal +1% of your party's damage." };
  if (kind === 'gold') return { effect: { t: 'gold', pct: 0.5 }, desc: 'Monsters drop +50% gold.' };
  if (kind === 'boss') return { effect: { t: 'boss', pct: 0.25 }, desc: '+25% damage to bosses.' };
  if (kind === 'blade') return { effect: { t: 'auto', add: 1 }, desc: 'Phantom Blade +1/s.' };
  if (kind.startsWith('cleave')) return { effect: { t: 'cleave', pct: num / 100 }, desc: `Cleave +${num}%.` };
  if (kind === 'fevfill') return { effect: { t: 'fever', fill: 1.25 }, desc: 'Rampage fills 25% faster.' };
  if (kind === 'fevdur') return { effect: { t: 'fever', dur: 1.5 }, desc: 'Rampage lasts 50% longer.' };
  if (kind === 'fevpow') return { effect: { t: 'fever', power: 1 }, desc: 'Rampage hits harder: +1 to both its multipliers.' };
  if (kind.startsWith('critx')) return { effect: { t: 'crit', add: num }, desc: `Crit damage +${num}×.` };
  if (kind.startsWith('crit')) return { effect: { t: 'crit', chance: num / 100 }, desc: `Crit chance +${num}%.` };
  return { effect: { t: 'skill' }, desc: '' };
}

function buildUpgrades(): UpgDef[] {
  const out: UpgDef[] = [];
  COMPS.forEach((comp, i) => {
    TRAIT_PLAN[comp.id]?.forEach((kind, k) => {
      const { effect, desc } = traitEffect(kind, i);
      out.push({
        id: `m${i}_${k}`, name: milestoneName(comp.id, k), flavor: MILESTONE_FLAVOR[comp.id][k], desc,
        cost: comp.cost * TRAIT_COST[k], icon: { sprite: comp.sprite, tier: Math.min(k, ROMAN.length - 1) },
        effect, req: { t: 'owned', comp: i, n: milestoneAt(k) },
      });
    });
  });
  return out;
}

export const UPGRADES = buildUpgrades();

// ---------- abilities ----------

export type AbilityId = 'blade' | 'flurry' | 'crit' | 'rampage' | 'cleave' | 'drums' | 'treasure' | 'legion';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  desc: string;
  /** Always on once unlocked, a button with a cooldown, or a button that charges as you attack (Rampage). */
  kind: 'passive' | 'button' | 'charge';
  /** The companion whose trait unlocks it, and which trait (0–4: levels 10, 25, 50, 75, 100). */
  comp: number;
  trait: number;
  /** Seconds it lasts and seconds before it can be used again (buttons). */
  dur?: number;
  cooldown?: number;
}

/** In the order you're likely to meet them. Each is unlocked by buying one companion trait, and earned again every run.
 *  Cooldowns are uneven (8, 12, 20, 25 and 30 minutes) so they drift apart: lining them all up costs real waiting. */
export const ABILITIES: AbilityDef[] = [
  { id: 'blade', name: 'Phantom Blade', desc: 'Attacks for you, once a second.', kind: 'passive', comp: compIndex('squire'), trait: 0 },
  { id: 'flurry', name: 'Flurry', desc: 'Clicks for you, 10 times a second.', kind: 'button', comp: compIndex('squire'), trait: 1, dur: 30, cooldown: 8 * 60 },
  { id: 'crit', name: 'Critical Hits', desc: 'Clicks and Phantom Blade have a 3% chance for ×2 damage.', kind: 'passive', comp: compIndex('ranger'), trait: 1 },
  { id: 'rampage', name: 'Rampage', desc: 'Builds as you attack. Your party deals ×2 damage for 10s.', kind: 'charge', comp: compIndex('brawler'), trait: 2 },
  { id: 'cleave', name: 'Cleave', desc: 'Your clicks also hit every other monster for 10% damage.', kind: 'button', comp: compIndex('shieldmaiden'), trait: 2, dur: 60, cooldown: 12 * 60 },
  ...(DEMO ? [] : [
    { id: 'treasure', name: 'Treasure Sense', desc: 'Monsters drop ×3 gold.', kind: 'button', comp: compIndex('corsair'), trait: 3, dur: 30, cooldown: 25 * 60 },
    { id: 'drums', name: 'War Drums', desc: '+50% crit chance.', kind: 'button', comp: compIndex('runesmith'), trait: 3, dur: 30, cooldown: 20 * 60 },
    { id: 'legion', name: 'Phantom Legion', desc: 'A Phantom Blade for every monster.', kind: 'button', comp: compIndex('stormcaller'), trait: 4, dur: 30, cooldown: 30 * 60 },
  ] satisfies AbilityDef[]),
];
export const ABILITY_BY_ID = new Map(ABILITIES.map((a) => [a.id, a]));
/** The trait upgrade that unlocks an ability. */
export const abilityUpgrade = (a: AbilityDef) => `m${a.comp}_${a.trait}`;
/** The ability a trait upgrade unlocks, if any. */
export const ABILITY_BY_UPGRADE = new Map(ABILITIES.map((a) => [abilityUpgrade(a), a]));
/** A companion's milestones (`m{comp}_{k}`) are its traits, bought on its own row. */
export const isTraitId = (id: string) => /^m\d+_\d+$/.test(id);
export const UPG_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));


// ---------- boss modifiers ----------

export type ModId = 'armored' | 'enraged' | 'regen' | 'split' | 'giant';

export interface ModDef {
  id: ModId;
  name: string;
  desc: string;
  color: string;
}

export const MODS: ModDef[] = [
  { id: 'armored', name: 'Armored', desc: 'Companions deal 75% less damage to it.', color: '#9fb4c8' },
  { id: 'enraged', name: 'Enraged', desc: 'Only half the time to beat it.', color: '#ff6a4a' },
  { id: 'regen', name: 'Regenerating', desc: 'Heals 3% of its health every second.', color: '#7ee07a' },
  { id: 'split', name: 'Splitting', desc: 'Splits in two when it dies.', color: '#d58aff' },
  { id: 'giant', name: 'Giant', desc: 'Three times the health, and 50% more time.', color: '#ffc24a' },
];
export const MOD_BY_ID = new Map(MODS.map((d) => [d.id, d]));

/** Modifiers come round in this order, so each zone boss brings a different one. */
const MOD_ORDER: ModId[] = ['giant', 'armored', 'split', 'regen', 'enraged'];

/**
 * Zone bosses pick up modifiers from floor 30: two from 60, three from 120, four from 200. The
 * mid-bosses on floor 5 of each zone join in from 55 (two from 120, three from 200). Always the
 * same for a floor.
 */
export function modsFor(floor: number): ModId[] {
  if (floor % 5 !== 0) return [];
  const zone = floor % 10 === 0;
  const n = zone ? (floor >= 200 ? 4 : floor >= 120 ? 3 : floor >= 60 ? 2 : floor >= 30 ? 1 : 0) : floor >= 200 ? 3 : floor >= 120 ? 2 : floor >= 55 ? 1 : 0;
  const k = zone ? floor / 10 - 3 : (floor - 55) / 10 + 3;
  // Steps of 2 through a list of 5 visit every modifier before repeating one.
  return Array.from({ length: n }, (_, j) => MOD_ORDER[(k + j * 2) % MOD_ORDER.length]);
}

// ---------- Legends (spending souls) ----------

export type LegendId =
  | 'sleeper' | 'fist' | 'needle' | 'hoard' | 'patient' | 'goblinking' | 'unbroken'
  | 'hourglass' | 'wither' | 'thinning' | 'haggler' | 'restless' | 'soulcaller' | 'lure' | 'collector' | 'ronin'
  | 'lingering' | 'whirl' | 'headsman' | 'magpie' | 'drummer' | 'host'
  | 'hungry';

/** Power grows steadily (level n costs n souls), utility steeply (2^n; most close in on a cap), the sink costs 1. */
export type LegendKind = 'power' | 'utility' | 'sink';

export interface LegendDef {
  id: LegendId;
  name: string;
  kind: LegendKind;
  sprite: string;
  /** What it boosts, in a few words. */
  what: string;
  /** Its bonus at a level ("+75%", "−3 kills"). */
  value: (lv: number) => string;
  /** The rule a player needs to know (what counts as idle, when a streak ends), if any. */
  note?: string;
  /** The level that ends it (only the Thinning has one). */
  maxLv?: number;
  /** The ability it makes last longer, by this many seconds a level. */
  lengthens?: { ability: AbilityId; secs: number };
}

/** Utility effects close in on their cap: this share of it at level L is 1 − 0.9^L. */
export const legendShare = (lv: number) => 1 - 0.9 ** lv;

/** Souls to raise a Legend from `lv` to lv + 1. */
export function legendCost(def: LegendDef, lv: number) {
  if (def.kind === 'sink') return 1;
  if (def.kind === 'utility') return 2 ** (lv + 1);
  return def.id === 'unbroken' ? Math.ceil((lv + 1) ** 1.5) : lv + 1;
}

/** Souls to summon your next Legend, by how many you have; a reroll of the offer costs a third of it. */
export const SUMMON_COST = [1, 2, 4, 8, 16, 35, 70, 125, 250, 500, 800, 1200, 1700, 2200, 2750, 3400, 4100, 5000, 6000, 7500, 10_000, 12_500, 16_000];
export const summonCost = (owned: number) => SUMMON_COST[Math.min(owned, SUMMON_COST.length - 1)];
export const rerollCost = (owned: number) => Math.ceil(summonCost(owned) / 3);
/** Legends offered at a time, and the share of souls a respec gives back. */
export const OFFER_SIZE = 3;
export const RESPEC_REFUND = 0.75;

const pct = (n: number) => `${+(n * 100).toFixed(1)}%`;
const per = (k: number) => (lv: number) => `+${Math.round(k * lv * 100)}%`;
const share = (cap: number, show: (n: number) => string) => (lv: number) => show(cap * legendShare(lv));
const o = (d: LegendDef) => d;
const longer = (ability: AbilityId, secs: number) => ({ lengthens: { ability, secs }, value: (lv: number) => `+${secs * lv}s` });

export const LEGENDS: LegendDef[] = DEMO ? [] : [
  o({ id: 'sleeper', name: 'The Sleeper', kind: 'power', sprite: 'sm_oldman', what: 'Damage while idle', value: per(0.25) }),
  o({ id: 'fist', name: 'The Fist', kind: 'power', sprite: 'sm_large_oni_red', what: 'Your attacks and the Phantom Blade', value: per(0.1) }),
  o({ id: 'needle', name: 'The Needle', kind: 'power', sprite: 'sd_executioner', what: 'Critical hit damage', value: per(0.15) }),
  o({ id: 'hoard', name: 'The Hoard', kind: 'power', sprite: 'sd_mountain_king', what: 'All gold', value: per(0.05) }),
  o({ id: 'patient', name: 'The Patient', kind: 'power', sprite: 'sm_sohei', what: 'Gold while idle', value: per(0.5) }),
  o({ id: 'goblinking', name: 'The Wish', kind: 'power', sprite: 'ef_fairy', what: 'Gold from treasure goblins and the Rainbow Vault', value: per(0.5) }),
  o({ id: 'unbroken', name: 'The Unbroken', kind: 'power', sprite: 'sm_large_samurai', what: 'All damage, for each attack in your streak', value: (lv) => `+${+(0.01 * lv).toFixed(2)}% per attack`, note: 'A streak ends 2 seconds after your last attack, and counts up to 2,000 attacks.' }),
  o({ id: 'hourglass', name: 'The Hourglass', kind: 'utility', sprite: 'sd_magic_shopkeeper', what: 'Time to beat a boss', value: share(30, (n) => `+${+n.toFixed(1)}s`) }),
  o({ id: 'wither', name: 'The Wither', kind: 'utility', sprite: 'sd_bishop', what: 'Boss health', value: share(0.5, (n) => `−${pct(n)}`) }),
  o({ id: 'thinning', name: 'The Thinning', kind: 'utility', sprite: 'sd_butcher', what: 'Kills to clear a floor', value: (lv) => `−${lv}`, maxLv: 10 }),
  o({ id: 'haggler', name: 'The Haggler', kind: 'utility', sprite: 'sm_merchant', what: 'Companion level costs', value: (lv) => `−${pct(1 - 0.95 ** lv)}` }),
  o({ id: 'restless', name: 'The Restless', kind: 'utility', sprite: 'sm_kabuki', what: 'Ability cooldowns', value: share(0.75, (n) => `−${pct(n)}`) }),
  o({ id: 'soulcaller', name: 'The Soulcaller', kind: 'utility', sprite: 'sm_tengu', what: 'Increased chance a boss is a champion (starting on floor 100)', value: share(0.75, (n) => pct(0.25 + n)) }),
  o({ id: 'lure', name: 'The Lure', kind: 'utility', sprite: 'chest_mimic_open', what: 'How often treasure goblins come', value: share(2, (n) => `+${pct(n)}`) }),
  o({ id: 'collector', name: 'The Collector', kind: 'utility', sprite: 'sd_princess', what: 'Card drop chance', value: share(1.5, (n) => `+${pct(n)}`) }),
  o({ id: 'ronin', name: 'The Ronin', kind: 'utility', sprite: 'sm_samurai', what: 'Card chance from overkill', value: (lv) => `up to ×${+(1 + lv / 4).toFixed(2)}`, note: "A kill that deals N× a monster's health has N× the chance to drop its card." }),
  o({ id: 'lingering', name: 'The Lingering', kind: 'utility', sprite: 'sm_geisha', what: 'How long Rampage lasts', ...longer('rampage', 1) }),
  o({ id: 'whirl', name: 'The Whirl', kind: 'utility', sprite: 'ef_ranger', what: 'How long Flurry lasts', ...longer('flurry', 2) }),
  o({ id: 'headsman', name: 'The Headsman', kind: 'utility', sprite: 'sd_knight_heavy', what: 'How long Cleave lasts', ...longer('cleave', 4) }),
  o({ id: 'magpie', name: 'The Magpie', kind: 'utility', sprite: 'sd_merchant', what: 'How long Treasure Sense lasts', ...longer('treasure', 2) }),
  o({ id: 'drummer', name: 'The Drummer', kind: 'utility', sprite: 'cr_nutcracker', what: 'How long War Drums last', ...longer('drums', 2) }),
  o({ id: 'host', name: 'The Host', kind: 'utility', sprite: 'ef_tallcleric', what: 'How long Phantom Legion lasts', ...longer('legion', 2) }),
  o({ id: 'hungry', name: 'The Hungry Dark', kind: 'sink', sprite: 'sm_oni_king', what: 'All damage, for every soul fed to it', value: (lv) => `+${lv * 11}%`, note: 'A soul you keep gives +10%. One fed here gives +11%, but you can only get it back with a respec.' }),
];
export const LEGEND_BY_ID = new Map(LEGENDS.map((d) => [d.id, d]));

// ---------- awakening ----------

/** Awakening first opens at this deepest floor. */
export const AWAKEN_FLOOR = 300;
/** A boss beaten with this many seconds or fewer left is a clutch kill. */
export const CLUTCH_SECONDS = 3;

export type BoundId = 'ogre' | 'lich' | 'troll' | 'golem' | 'thing' | 'ent' | 'pitlord' | 'frost';

/** The zone bosses, bound in the Heart's room once you've awakened: each makes one thing you have work harder. Bought
 *  with bound souls; all but the Ogre Chieftain cost one more each level. */
export interface BoundDef {
  id: BoundId;
  /** The zone whose boss it is (its name and look). */
  zone: number;
  what: string;
  value: (lv: number) => string;
  max?: number;
  /** The Spirit it makes work harder (its `what` names it). */
  spirit?: LegendId;
}

const pct25 = (lv: number) => `+${lv * 25}%`;
export const BOUND: BoundDef[] = DEMO ? [] : [
  { id: 'ogre', zone: 0, what: 'All damage', value: (lv) => `+${lv * 100}%` },
  { id: 'pitlord', zone: 6, what: 'Souls from champion bosses', value: (lv) => `×${1 + 10 * lv * lv}` },
  { id: 'lich', zone: 1, what: 'Spirit costs', value: (lv) => `−${Math.round((1 - 0.95 ** lv) * 100)}%`, max: 20 },
  { id: 'frost', zone: 7, what: 'The Thinning\'s cap', value: (lv) => `−${10 + lv} kills`, max: 5, spirit: 'thinning' },
  { id: 'troll', zone: 2, what: 'The Wither\'s effect', value: pct25, spirit: 'wither' },
  { id: 'golem', zone: 3, what: 'The Soulcaller\'s effect', value: pct25, spirit: 'soulcaller' },
  { id: 'thing', zone: 4, what: 'The Lure\'s effect', value: pct25, spirit: 'lure' },
  { id: 'ent', zone: 5, what: 'The Hourglass\'s effect', value: pct25, spirit: 'hourglass' },
];
export const BOUND_BY_ID = new Map(BOUND.map((b) => [b.id, b]));
export const boundName = (b: BoundDef) => ZONES[b.zone].boss.name;
export const boundCost = (b: BoundDef, lv: number) => (b.id === 'ogre' ? 1 : lv + 1);

// ---------- cards ----------

export type CardKind = 'monster' | 'mid' | 'boss' | 'goblin';

/** One card per kind of monster. A zone's cards in one color are a set, which adds to all damage (see SET_BONUS). */
export interface CardDef {
  id: string;
  name: string;
  sprite: string;
  tint?: number;
  kind: CardKind;
  /** Zone it's listed under (-1: the goblins). */
  zone: number;
  /** Where it turns up in each color (by lap), one line per place, with the first floor you see that place on (a
   *  place is only listed once you've been that deep). */
  where: CardPlace[][];
  /** The colors (laps) it comes in: a zone's newcomers only from Corrupted on, and only two of its first crowd come back. */
  laps: number[];
  /** First floor of the first zone it turns up in: the card shows in the collection once you've reached that zone. */
  floor: number;
  /** Champions of this kind can drop a gold copy (every card but the goblins'). */
  gold: boolean;
}

const cardIds = new Map<string, string>();
/** "Ogre Chieftain" → "ogre-chieftain". */
export function cardId(name: string): string {
  let id = cardIds.get(name);
  if (!id) cardIds.set(name, (id = name.toLowerCase().replace(/[^a-z]+/g, '-')));
  return id;
}

export const GOBLIN_CARD = 'treasure-goblin';
export const RAINBOW_CARD = 'rainbow-goblin';

/** Where a card's monster turns up: a zone and its floors (a boss: its one floor), the floors where it's the one the
 *  floor is known for (half the crowd), and the first floor you have to have seen for this place to be listed. */
export interface CardPlace {
  zone: string;
  from: number;
  to: number;
  boss: boolean;
  common: number[];
  floor: number;
}

/** The floors in a zone (from its first) where this monster is the one the floor is known for. */
function commonOn(d: MonsterDef, first: number) {
  return Array.from({ length: 9 }, (_, k) => first + k).filter((f) => f % 5 && featuredFor(f).name === d.name);
}

function buildCards(): CardDef[] {
  const out = new Map<string, CardDef>();
  const add = (d: MonsterDef, kind: CardKind, zone: number, lap: number, place: Omit<CardPlace, 'floor'>, floor: number) => {
    const id = cardId(d.name);
    const card = out.get(id) ?? { id, name: d.name, sprite: d.sprite, tint: d.tint, kind, zone, where: CORRUPTION.map(() => []), laps: [], floor, gold: true };
    out.set(id, card);
    card.where[lap].push({ ...place, floor });
    if (!card.laps.includes(lap)) card.laps.push(lap);
    card.floor = Math.min(card.floor, floor);
  };
  ZONES.forEach((z, i) => {
    CORRUPTION.forEach((_, lap) => {
      const a = i * 10 + lap * ZONES.length * 10;
      // Places are listed once you've seen them on any lap: a zone from its plain floors, its newcomers from their first.
      const seen = i * 10 + (lap ? 1 : 0) * ZONES.length * 10 + 1;
      const zone = zoneName(a + 1).replace(/^The /, '');
      bandFor(a + 1).forEach((d) => add(d, 'monster', i, lap, { zone, from: a + 1, to: a + 9, boss: false, common: commonOn(d, a + 1) }, seen));
      add(z.mid, 'mid', i, lap, { zone, from: a + 5, to: a + 5, boss: true, common: [] }, i * 10 + 1);
      add(z.boss, 'boss', i, lap, { zone, from: a + 10, to: a + 10, boss: true, common: [] }, i * 10 + 1);
    });
  });
  // The goblins come in one color only: their cards live on the plain page, whatever lap they're caught on.
  out.set(GOBLIN_CARD, { id: GOBLIN_CARD, name: 'Treasure Goblin', sprite: 'goblin', tint: 0xffe08a, kind: 'goblin', zone: -1, where: CORRUPTION.map(() => []), laps: [0], floor: 1, gold: false });
  out.set(RAINBOW_CARD, { id: RAINBOW_CARD, name: 'Rainbow Goblin', sprite: 'goblin', kind: 'goblin', zone: -1, where: CORRUPTION.map(() => []), laps: [0], floor: 1, gold: false });
  return [...out.values()];
}

/** "Abyssal Skeleton", "The Abyssal Lich": a card's name in a lap's color. */
export function cardName(name: string, lap: number) {
  const color = lap ? CORRUPTION[lap].name : '';
  if (!color) return name;
  return name.startsWith('The ') ? `The ${color} ${name.slice(4)}` : `${color} ${name}`;
}

export const CARDS = buildCards();
export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));

// ---------- trophies ----------

export type TrophyReq =
  | { t: 'gold'; n: number }
  | { t: 'floor'; n: number }
  | { t: 'kills'; n: number }
  | { t: 'bosses'; n: number }
  | { t: 'level'; n: number }
  | { t: 'levelAll'; n: number }
  | { t: 'clicks'; n: number }
  | { t: 'crits'; n: number }
  | { t: 'raids'; n: number }
  | { t: 'fevers'; n: number }
  | { t: 'descents'; n: number }
  | { t: 'dps'; n: number }
  | { t: 'missed'; n: number }
  | { t: 'awakens'; n: number }
  | { t: 'boundAll'; n: number }
  | { t: 'boundEarned'; n: number }
  | { t: 'trips'; n: number }
  | { t: 'tripCards'; n: number }
  | { t: 'tripKills'; n: number }
  | { t: 'pets'; n: number }
  | { t: 'clutches'; n: number }
  | { t: 'champions'; n: number }
  | { t: 'vaults'; n: number }
  | { t: 'rainbows'; n: number }
  | { t: 'rampage'; n: number }
  | { t: 'cards'; n: number }
  | { t: 'versions'; n: number }
  | { t: 'goldCards'; n: number }
  | { t: 'sets'; n: number }
  | { t: 'goldSets'; n: number };

export interface TrophyDef {
  id: string;
  name: string;
  desc: string;
  icon: Icon;
  req: TrophyReq;
  /** Kept a secret (no name, no how) until you have it. */
  hidden?: boolean;
}

/** A round power of ten in words for trophy text ("1 sextillion"), falling back to 1e80 past the named ones. */
const POWER_WORDS: Record<number, string> = { 6: 'million', 9: 'billion', 12: 'trillion', 15: 'quadrillion', 18: 'quintillion', 21: 'sextillion', 24: 'septillion', 27: 'octillion', 30: 'nonillion', 33: 'decillion', 36: 'undecillion', 39: 'duodecillion', 42: 'tredecillion', 45: 'quattuordecillion', 60: 'novemdecillion' };
function bigWords(n: number): string {
  const e = Math.round(Math.log10(n));
  if (e < 6) return n.toLocaleString('en-US');
  if (e === 100) return 'a googol';
  const w = POWER_WORDS[e - (e % 3)];
  return w ? `${10 ** (e % 3)} ${w}` : `1e${e}`;
}

const count = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const times = (n: number) => (n === 1 ? 'once' : `${count(n)} times`);

function buildTrophies(): TrophyDef[] {
  const out: TrophyDef[] = [];
  // Ids carry their threshold ("kill-1000"), so a retired tier never lines up with a new one in an old save.
  const tag = (n: number) => (n >= 1e6 ? `e${Math.round(Math.log10(n))}` : String(n));
  const tiers = (prefix: string, list: [number, string][], desc: (n: number) => string, sprite: string, req: (n: number) => TrophyReq, tierFrom = 0) =>
    list.forEach(([n, name], k) => out.push({ id: `${prefix}-${tag(n)}`, name, desc: desc(n), icon: { sprite, tier: Math.min(10, k + tierFrom) }, req: req(n) }));

  tiers('floor', [[10, 'Down the Stairs'], [50, 'The Long Descent'], [100, 'The Underneath'], [400, 'The Bottom?'], [500, 'There Is No Bottom'], [750, 'Geology Gives Up'], [1000, 'A Thousand Down'], [1500, 'No Signal'], [2000, 'Two Thousand Fathoms'], [3000, 'Root of the World'], [5000, 'Where the Heart Beats']],
    (n) => `Clear floor ${count(n)}.`, 'stairs', (n) => ({ t: 'floor', n }));
  if (!DEMO) {
    [1, 2, 3, 4].forEach((n, k) => out.push({ id: `lap${k}`, name: ['Corruption', 'The Abyss Stares Back', 'Hollowed Out', 'Eternity'][k], desc: `Reach floor ${n * 80 + 1}, where the zones return ${CORRUPTION[n].name.toLowerCase()}.`, icon: { sprite: 'skull', tier: k + 1 }, req: { t: 'floor', n: n * 80 } }));
  }
  tiers('gold', [[1e9, 'Coin Purse'], [1e24, 'Strongbox'], [1e40, 'Treasury'], [1e60, 'Dragon Hoard'], [1e90, 'Kingdom\'s Ransom'], [1e120, 'Sea of Gold'], [1e160, 'Beyond Counting']],
    (n) => `Collect ${bigWords(n)} gold in total.`, 'coin', (n) => ({ t: 'gold', n }));
  tiers('dps', [[1e6, 'Fighter'], [1e24, 'Warlord'], [1e40, 'Cataclysm'], [1e60, 'Apocalypse'], [1e80, 'World Breaker'], [1e100, 'Googol'], [1e150, 'Heat Death'], [1e200, 'Big Bang']],
    (n) => `Reach ${bigWords(n)} damage per second.`, 'weapon_waraxe', (n) => ({ t: 'dps', n }));
  tiers('kill', [[1000, 'Slayer'], [100_000, 'Massacre'], [1e6, 'Extinction Event'], [1e7, 'The Reaper'], [1e8, 'Nothing Left Alive']],
    (n) => `Kill ${count(n)} monsters.`, 'skull', (n) => ({ t: 'kills', n }));
  tiers('boss', [[10, 'Kingsbane'], [100, 'Tyrant Killer'], [1000, 'Boss Rush'], [5000, 'Serial Regicide'], [25_000, 'Throne of Bones']],
    (n) => `Defeat ${count(n)} bosses.`, 'ogre', (n) => ({ t: 'bosses', n }));
  tiers('champ', [[1, 'Champion Slayer'], [100, 'Crown Collector'], [1000, 'Champion of Champions'], [10_000, 'Undisputed']],
    (n) => `Slay ${n === 1 ? 'a champion' : `${count(n)} champions`}.`, 'weapon_red_gem_sword', (n) => ({ t: 'champions', n }));
  tiers('clutch', [[1, 'By a Hair'], [20, 'Nerves of Steel'], [100, 'Was That Necessary?']],
    (n) => `Beat ${n === 1 ? 'a boss' : `${n} bosses`} with ${CLUTCH_SECONDS} seconds or less on the clock.`, 'flask_yellow', (n) => ({ t: 'clutches', n }));
  if (!DEMO) {
    out.push({ id: 'hire-all', name: 'Full Party', desc: `Hire all ${COMPS.length} companions.`, icon: { sprite: COMPS[0].sprite, tier: 0 }, req: { t: 'levelAll', n: 1 } });
  }
  tiers('level', [[1000, 'Legendary'], [2500, 'Mythic'], [5000, 'Immortal'], [10_000, 'Overleveled']],
    (n) => `Get a companion to level ${count(n)}.`, COMPS[COMPS.length - 1].sprite, (n) => ({ t: 'level', n }), 1);
  tiers('levelall', [[500, 'Loyal Company'], [1000, 'Legendary Company'], [2500, 'Mythic Company']],
    (n) => `Get every companion to level ${count(n)}.`, COMPS[0].sprite, (n) => ({ t: 'levelAll', n }), 1);
  tiers('clicks', [[100, 'Tap Tap'], [10_000, 'Clicker'], [100_000, 'Still Clicking'], [1e6, 'Carpal Tunnel']],
    (n) => `Click ${count(n)} times.`, 'weapon_knife', (n) => ({ t: 'clicks', n }));
  tiers('crit', [[1, 'Critical!'], [10_000, 'Sharp Eye'], [100_000, 'Surgeon'], [1e6, 'Critical Condition']],
    (n) => `Land ${count(n)} critical ${plural(n, 'hit')}.`, 'weapon_katana', (n) => ({ t: 'crits', n }));
  tiers('fev', [[1, 'Rampage!'], [100, 'Berserker'], [1000, 'Anger Issues']],
    (n) => `Go on a Rampage ${times(n)}.`, 'flask_big_red', (n) => ({ t: 'fevers', n }));
  out.push({ id: 'rampage0', name: 'Bloodrush', desc: 'Keep attacking until a Rampage reaches its top tier.', icon: { sprite: 'flask_big_red', tier: 1 }, req: { t: 'rampage', n: 1 } });
  tiers('raid', [[1, 'Finders Keepers'], [77, 'Red-Handed'], [777, 'Jackpot'], [2777, 'No One Escapes'], [7777, 'Treasure Lord']],
    (n) => `Catch ${n === 1 ? 'a treasure goblin' : `${count(n)} treasure goblins`}.`, 'goblin', (n) => ({ t: 'raids', n }));
  const missed: [number, string, string][] = [
    [1, 'Butterfingers', ''],
    [100, 'Slippery Little Guys', ''],
    [1000, 'Goblin Enabler', ' They are telling their friends.'],
    [5000, 'Goblin Philanthropist', ' You are funding their retirement.'],
    [20_000, 'Official Goblin Sponsor', ' They have named a tunnel after you.'],
    [50_000, 'The Goblins Thank You', ' There is a statue of you in Goblin Town.'],
  ];
  missed.forEach(([n, name, joke], k) => out.push({ id: `miss-${n}`, name, desc: `Let ${n === 1 ? 'a treasure goblin' : `${count(n)} treasure goblins`} get away.${joke}`, icon: { sprite: 'goblin', tier: k }, req: { t: 'missed', n } }));
  tiers('rainbow', [[1, 'Double Rainbow'], [50, 'Chasing Rainbows'], [500, 'End of the Rainbow']],
    (n) => `Catch ${n === 1 ? 'a rainbow goblin' : `${count(n)} rainbow goblins`}.`, 'goblin', (n) => ({ t: 'rainbows', n }), 2);
  tiers('vault', [[1, 'Over the Rainbow'], [25, 'Vault Raider'], [250, 'Goblin Banker']],
    (n) => (n === 1 ? 'Open the Rainbow Vault.' : `Open the Rainbow Vault ${count(n)} times.`), 'chest_full_open', (n) => ({ t: 'vaults', n }));
  tiers('desc', [[1, 'Up for Air'], [10, 'Return Ticket'], [50, 'Commuter'], [250, 'Always Back Down']],
    (n) => `Ascend ${times(n)}.`, 'soul', (n) => ({ t: 'descents', n }));
  if (!DEMO) {
    const heartFrom = out.length;
    tiers('awk', [[1, 'It Wakes'], [5, 'Heartbeat'], [25, 'Snooze Button'], [100, 'Pacemaker']],
      (n) => `Awaken the Heart ${times(n)}.`, 'ui_heart_full', (n) => ({ t: 'awakens', n }));
    out.push({ id: 'bound-all', name: 'All Eight', desc: 'Wake every one of the Bound.', icon: { sprite: ZONES[ZONES.length - 1].boss.sprite, tier: 1 }, req: { t: 'boundAll', n: 1 } });
    tiers('bound', [[50, 'Soul Debt'], [250, 'Paid in Full']],
      (n) => `Earn ${count(n)} bound souls in total.`, ZONES[0].boss.sprite, (n) => ({ t: 'boundEarned', n }), 2);
    // The Heart's trophies stay secret until earned, so they don't spoil it.
    for (const trophy of out.slice(heartFrom)) trophy.hidden = true;
    out.push({ id: 'trip-1', name: 'Gone Hunting', desc: 'Send a companion on an expedition.', icon: { sprite: 'floor_ladder', tier: 1 }, req: { t: 'trips', n: 1 } });
    tiers('tripcard', [[25, 'Spoils'], [250, 'Postcards']],
      (n) => `Find ${count(n)} cards on expeditions.`, 'floor_ladder', (n) => ({ t: 'tripCards', n }), 2);
    tiers('tripkill', [[1e4, 'Pest Control'], [1e6, 'Hired Muscle']],
      (n) => `Defeat ${count(n)} monsters on expeditions.`, 'floor_ladder', (n) => ({ t: 'tripKills', n }), 2);
    out.push({ id: 'pet-1', name: 'Good Kitty', desc: 'Pet Koko.', icon: { sprite: 'koko', tier: 0 }, req: { t: 'pets', n: 1 } });
    ([[10, 'Cat Person'], [100, 'Her Favorite'], [1000, "Koko's Human"]] as const).forEach(([n, name], k) =>
      out.push({ id: `pet-${n}`, name, desc: `Pet Koko ${count(n)} times.`, icon: { sprite: 'koko', tier: k + 1 }, req: { t: 'pets', n }, hidden: true }));
  }
  if (!DEMO) {
    tiers('set', [[1, 'Full Set'], [5, 'Set Collector'], [10, 'Complete Collection']],
      (n) => `Finish ${n === 1 ? 'a card set' : `${n} card sets`}.`, 'imp', (n) => ({ t: 'sets', n }), 1);
    tiers('gset', [[1, 'Gold Set'], [5, 'Gilt Edge']],
      (n) => `Finish ${n === 1 ? 'a gold card set' : `${n} gold card sets`}.`, 'big_demon', (n) => ({ t: 'goldSets', n }), 3);
  }
  const versions = CARDS.reduce((sum, c) => sum + c.laps.length * (c.gold ? 2 : 1), 0);
  out.push(
    { id: 'card-1', name: 'Card Carrier', desc: 'Find a monster card.', icon: { sprite: 'imp', tier: 0 }, req: { t: 'cards', n: 1 } },
    { id: 'card-25', name: 'Card Sharp', desc: 'Find 25 different monster cards.', icon: { sprite: 'imp', tier: 1 }, req: { t: 'cards', n: 25 } },
    { id: 'card-all', name: 'Bestiary', desc: 'Find every monster card.', icon: { sprite: 'imp', tier: 2 }, req: { t: 'cards', n: CARDS.length } },
    { id: 'versions-250', name: 'Monster Manual', desc: 'Collect 250 cards.', icon: { sprite: 'imp', tier: 3 }, req: { t: 'versions', n: 250 } },
    { id: 'versions-all', name: 'Every Last Monster', desc: 'Collect every card.', icon: { sprite: 'imp', tier: 4 }, req: { t: 'versions', n: versions } },
    { id: 'gcard-1', name: 'Gilded', desc: 'Find a gold card.', icon: { sprite: 'big_demon', tier: 2 }, req: { t: 'goldCards', n: 1 } },
    { id: 'gcard-25', name: 'Gold Standard', desc: 'Find 25 different gold cards.', icon: { sprite: 'big_demon', tier: 3 }, req: { t: 'goldCards', n: 25 } },
    { id: 'gcard-all', name: 'Midas Deck', desc: 'Find every gold card.', icon: { sprite: 'big_demon', tier: 4 }, req: { t: 'goldCards', n: CARDS.filter((c) => c.gold).length } },
  );
  return out;
}

export const TROPHIES = buildTrophies();

// ---------- cursors ----------

export interface CursorDef {
  id: string;
  name: string;
  /** Sprite to draw. (With no cursor chosen, the setting is 'auto': your best click upgrade.) */
  sprite: string;
  /** Trophy that unlocks it (none = always available). */
  trophy?: string;
}

/** Cursor skins, each unlocked by a trophy. Changed in Options. */
/** Cursors, from the one you start with to the endgame's: each unlocked by a trophy, in about the order you'd earn
 *  them. */
export const CURSORS: CursorDef[] = [
  { id: 'rusty', name: 'Rusty Sword', sprite: 'weapon_rusty_sword' },
  { id: 'machete', name: 'Machete', sprite: 'weapon_machete', trophy: 'kill-e6' },
  { id: 'mace', name: 'Mace', sprite: 'weapon_mace', trophy: 'clicks-10000' },
  { id: 'axe', name: 'Axe', sprite: 'weapon_axe', trophy: 'lap1' },
  { id: 'throwing', name: 'Goblin Catcher', sprite: 'weapon_throwing_axe', trophy: 'raid-77' },
  { id: 'spiked', name: 'Consolation Club', sprite: 'weapon_baton_with_spikes', trophy: 'miss-100' },
  { id: 'hammer', name: 'War Hammer', sprite: 'weapon_hammer', trophy: 'boss-1000' },
  { id: 'katana', name: 'Katana', sprite: 'weapon_katana', trophy: 'crit-100000' },
  { id: 'cleaver', name: 'Cleaver', sprite: 'weapon_cleaver', trophy: 'boss-5000' },
  { id: 'spear', name: 'Spear', sprite: 'weapon_spear', trophy: 'floor-500' },
  { id: 'redstaff', name: 'Blood Staff', sprite: 'weapon_red_magic_staff', trophy: 'fev-100' },
  { id: 'duel', name: 'Dueling Sword', sprite: 'weapon_duel_sword', trophy: 'desc-50' },
  { id: 'greenstaff', name: 'Goblin Scepter', sprite: 'weapon_green_magic_staff', trophy: 'raid-777' },
  { id: 'waraxe', name: 'War Axe', sprite: 'weapon_waraxe', trophy: 'floor-1000' },
  { id: 'knight', name: 'Knight\'s Oath', sprite: 'weapon_knight_sword', trophy: 'clutch-20' },
  { id: 'saw', name: 'Saw Blade', sprite: 'weapon_saw_sword', trophy: 'kill-e7' },
  { id: 'bighammer', name: 'Maul', sprite: 'weapon_big_hammer', trophy: 'boss-25000' },
  { id: 'bow', name: 'Rainbow Bow', sprite: 'weapon_bow', trophy: 'rainbow-500' },
  { id: 'bow2', name: 'Vault Bow', sprite: 'weapon_bow_2', trophy: 'vault-250' },
  { id: 'doubleaxe', name: 'Twin Axe', sprite: 'weapon_double_axe', trophy: 'desc-250' },
  { id: 'gem', name: 'Red Gem Blade', sprite: 'weapon_red_gem_sword', trophy: 'champ-10000' },
  { id: 'arrow', name: 'The Last Arrow', sprite: 'weapon_arrow', trophy: 'clicks-e6' },
  { id: 'lavish', name: 'Lavish Saber', sprite: 'weapon_lavish_sword', trophy: 'floor-2000' },
  { id: 'fireball', name: 'Fireball', sprite: 'spell_fireball', trophy: 'tripcard-250' },
  { id: 'icelance', name: 'Ice Lance', sprite: 'spell_ice_lance', trophy: 'versions-250' },
  { id: 'anime', name: 'Hand of the Deep', sprite: 'weapon_anime_sword', trophy: 'awk-1' },
  { id: 'golden', name: 'Golden Sword', sprite: 'weapon_golden_sword', trophy: 'raid-7777' },
  { id: 'lightbolt', name: 'Light Bolt', sprite: 'spell_light_bolt', trophy: 'awk-25' },
  { id: 'darkbolt', name: 'Dark Bolt', sprite: 'spell_darkness_bolt', trophy: 'floor-5000' },
  { id: 'orb', name: 'Magic Orb', sprite: 'spell_magic_orb', trophy: 'versions-all' },
  // (The demo has fewer trophies: their cursors go with them.)
].filter((cursor) => !cursor.trophy || TROPHIES.some((t) => t.id === cursor.trophy));

// ---------- news ticker ----------

export interface News {
  text: string;
  when?: (s: { floor: number; owned: number[]; depth: number; raids: number; kills: number; awakens: number }) => boolean;
  /** Only now and then in the running. */
  rare?: boolean;
}

export const NEWS: News[] = [
  // Hints, before the first awakening, that the dungeon is a dream.
  { text: 'Every monster down here has a card. Nobody remembers printing them.', when: (s) => !s.awakens, rare: true },
  { text: 'The stairs go down. They always go down.', when: (s) => s.floor < 5 },
  { text: 'Your Squire asks if the dungeon has a bottom. You do not answer.', when: (s) => s.owned[compIndex('squire')] > 0 },
  { text: 'The Ranger keeps a tally of her kills on the wall. She has run out of wall.', when: (s) => s.owned[compIndex('ranger')] > 10 },
  { text: 'The dwarf insists on punching the bosses personally.', when: (s) => s.owned[compIndex('brawler')] > 0 },
  { text: 'The Apprentice set his beard on fire again. It still counts as damage.', when: (s) => s.owned[compIndex('apprentice')] > 0 },
  { text: 'The Lizard Hunter claims she can hear the dungeon breathing.', when: (s) => s.owned[compIndex('hunter')] > 0 },
  { text: 'The Shieldmaiden says the shield is "fine." It is more dent than shield.', when: (s) => s.owned[compIndex('shieldmaiden')] > 0 },
  ...(DEMO ? [] : [
    { text: "The Stormcaller's forecast: lightning, with a chance of more lightning.", when: (s) => s.owned[compIndex('stormcaller')] > 0 },
    { text: 'The Plague Doctor keeps taking notes on the monsters. And on you.', when: (s) => s.owned[compIndex('doctor')] > 0 },
    { text: 'The Lantern Knight has not spoken once. He did grin wider today.', when: (s) => s.owned[compIndex('hollow')] > 0 },
    { text: 'The angel will not say what it fell from.', when: (s) => s.owned[compIndex('angel')] > 0 },
    { text: 'The Necromancer apologizes to each monster before it dies.', when: (s) => s.owned[compIndex('necro')] > 0 },
    { text: 'The Tamed Oni has adopted a slug. Nobody has told him we kill those.', when: (s) => s.owned[compIndex('ogre')] > 0 },
    { text: 'The demon keeps asking to renegotiate the contract.', when: (s) => s.owned[compIndex('demon')] > 0 },
  ] satisfies News[]),
  { text: 'A goblin was seen running off.', when: (s) => s.raids > 0 },
  { text: 'The goblins have started a union. It meets at the bottom of the dungeon.', when: (s) => s.raids > 10 },
  { text: 'Someone up top has written a song about you. The verses keep getting darker.', when: (s) => s.kills > 1000 },
  { text: 'The monsters below have heard about you. Several have asked for transfers.', when: (s) => s.kills > 10000 },
  { text: 'Someone has scratched "Go deeper" into the wall. The handwriting looks like yours.', when: (s) => s.depth > 0 },
  { text: 'You could swear you have walked these floors before.', when: (s) => s.depth > 1 },
  { text: 'The walls have a pulse. Everyone has agreed not to mention it.', when: (s) => s.floor > 70 },
  { text: 'The heart below is waiting for you.', when: (s) => s.floor > 100 },
  ...(DEMO ? [] : [
    { text: 'The floor numbers stopped meaning anything a while ago.', when: (s) => s.floor > 200 },
    { text: 'A signpost says "Floor 1." Someone has crossed it out twice.', when: (s) => s.floor > 300 },
    { text: 'The monsters here have never seen the sun. They are not curious.', when: (s) => s.floor > 500 },
    { text: 'Your shadow has started lagging behind. It looks tired.', when: (s) => s.floor > 800 },
    { text: 'The stairs have begun to count your steps back to you.', when: (s) => s.floor > 1200 },
    { text: 'The echoes down here arrive a few seconds late.', when: (s) => s.floor > 2000 },
    { text: 'The heart skipped a beat and did not mention it.', when: (s) => s.floor > 3000 },
  ] satisfies News[]),
  { text: 'Reminder: the dungeon is not a metaphor. Probably.' },
  { text: 'The torches all lean toward the stairs down.' },
  { text: 'A monster tried to surrender today. It was killed anyway. Rules are rules.' },
];

export type RaidReward = 'plunder' | 'bloodlust' | 'heartstorm' | 'horde' | 'soulstorm' | 'vault' | 'rainbow';
