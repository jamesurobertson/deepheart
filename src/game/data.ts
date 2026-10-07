/**
 * Everything the game is made of: companions (who fight for you), the monster roster,
 * upgrades, trophies, abyss (prestige) powers and flavour text. Pure data plus builders.
 */

/** A picture for the UI: a sprite from the dungeon sheet, optionally with a badge. */
export interface Icon {
  sprite: string;
  /** Small second sprite in the corner (synergies). */
  sub?: string;
  /** Roman-numeral tier badge colour index. */
  tier?: number;
}

export type Attack = 'arrow' | 'bolt' | 'storm' | 'slash' | 'fire' | 'rune' | 'dark';

export interface CompDef {
  id: string;
  name: string;
  sprite: string;
  cost: number;
  dps: number;
  attack: Attack;
  flavor: string;
  /** Needs this many descents before it can be hired. */
  depth: number;
  big?: boolean;
  /** Needs this many awakenings of the Heart (the late recruits). */
  heart?: number;
}

const c = (id: string, name: string, sprite: string, cost: number, dps: number, attack: Attack, flavor: string, depth = 0, big = false, heart = 0): CompDef =>
  ({ id, name, sprite, cost, dps, attack, flavor, depth, big, heart });

/** Each companion costs more than the last and arrives a few floors deeper: one every 3–5 floors early on, every 6–8
 *  from the Shieldmaiden. Damage grows slower than price (about cost^0.5 between them), so each arrival helps without
 *  carrying the run on its own. */
export const COMPS: CompDef[] = [
  // Plain adventurers first; the strange and the enormous come later, the Heart's recruits last of all.
  // The first four are cheap and hit hard, so the party carries the opening and clicking is a bonus.
  c('squire', 'Squire', 'knight_m', 5, 2, 'slash', 'Wants to be a knight so badly. Practises on everything, monsters included.'),
  c('ranger', 'Ranger', 'elf_f', 30, 10, 'arrow', 'Never misses. Well, rarely. Well, sometimes.'),
  c('brawler', 'Dwarf Brawler', 'dwarf_m', 150, 44, 'slash', 'Came for the gold. Stayed for the punching.'),
  c('apprentice', 'Apprentice', 'wizzard_m', 750, 148, 'bolt', 'Knows exactly one spell. It is lightning. It is enough.'),
  c('hunter', 'Lizard Hunter', 'lizard_m', 7_000, 245, 'arrow', 'Can smell a monster through three floors of stone.'),
  c('shieldmaiden', 'Shieldmaiden', 'ef_elvenknight', 130_000, 2_140, 'slash', 'Her shield has killed more monsters than her sword.'),
  c('thief', 'Shadow Thief', 'cr_green_thief', 4e6, 23_900, 'arrow', 'Throws knives. Takes them back. Takes your purse too, then gives it back.'),
  c('dancer', 'Blade Dancer', 'elf_m', 3e8, 333_000, 'slash', 'Fights like it is a performance. The monsters do not clap.'),
  c('corsair', 'Corsair Captain', 'cr_pirate_captain', 2.2e11, 2.58e7, 'arrow', 'Sailed the underground sea. There is an underground sea. Do not ask.'),
  c('runesmith', 'Runesmith', 'dwarf_f', 3.5e12, 1.72e8, 'rune', 'Carves runes into the floor. The floor explodes.'),
  c('paladin', 'Paladin', 'cr_gold_knight', 3.7e14, 3.53e9, 'slash', 'Swore to purge the deep. Has been purging enthusiastically.'),
  c('stormcaller', 'Stormcaller', 'wizzard_f', 1.2e15, 9.48e9, 'storm', 'Brought her own weather. Down here, of all places.'),
  c('venomblade', 'Venomblade', 'lizard_f', 7e16, 1.38e11, 'dark', 'Every blade is poisoned. Every single one. She has a lot.', 1),
  c('doctor', 'Plague Doctor', 'doc', 1e18, 7.77e11, 'dark', 'Treats monsters with a strict regimen of dying.', 2),
  c('frostimp', 'Frost Imp', 'cr_frost_imp', 1.4e19, 6.73e12, 'storm', 'Followed you home from the Frozen Vault. Will not leave. Brings its own blizzard.', 3),
  c('hollow', 'Hollow Knight', 'pumpkin_dude', 2e20, 5.65e13, 'fire', 'Nobody knows what is inside the pumpkin. Nobody asks.', 4),
  // The Heart's recruits: one more answers every time you awaken it. A gentler curve (×2 damage for ×4 cost),
  // since every awakening already multiplies your power; steeper and the late game snowballs.
  c('oathbreaker', 'Oathbreaker', 'cr_purple_knight', 8e20, 1.13e14, 'dark', 'Broke every vow but one: never stop swinging.', 4, false, 1),
  c('archmage', 'Archmage', 'cr_wizard', 3.2e21, 2.26e14, 'bolt', 'Older than the dungeon. Insists the dungeon was smaller back then.', 4, false, 2),
  c('wraith', 'Bound Wraith', 'cr_crimson_wraith', 1.28e22, 4.52e14, 'dark', 'The Heart sent it. It hums a song nobody taught it.', 4, false, 3),
  c('necro', 'Turncoat Necromancer', 'necromancer', 5.07e22, 9.04e14, 'dark', 'Used to raise these monsters. Now it lowers them.', 4, false, 4),
  c('king', 'Exiled King', 'cr_king', 2e23, 1.81e15, 'fire', 'Lost his crown, his kingdom and his temper, in that order.', 4, false, 5),
  c('angel', 'Fallen Angel', 'angel', 8.13e23, 3.58e15, 'fire', 'Fell from somewhere bright. Landed swinging.', 4, false, 6),
  c('ogre', 'Tamed Ogre', 'ogre', 3.33e24, 7.16e15, 'slash', 'Answers to "Pebble". Crushes whatever you point at.', 4, true, 7),
  c('demon', 'Bound Demon', 'big_demon', 1.31e25, 1.45e16, 'fire', 'The contract is written in blood. Mostly the monsters\'.', 4, true, 8),
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
  /** Colour wash for variants (frost trolls and the like), as 0xRRGGBB. */
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
    lap: [m('cr_crimson_wraith', 'Crimson Wraith'), m('cr_plague_crow', 'Plague Crow', 0.9), m('cr_purple_knight', 'Fallen Knight', 1.2)],
  },
  {
    name: 'The Bone Crypts', tiles: 'crypt',
    band: [m('skelet', 'Skeleton'), m('tiny_zombie', 'Rotling'), m('skelet', 'Bone Archer', 0.9, 0xe8d49a), m('necromancer', 'Grave Priest', 0.9)],
    mid: m('ef_golem', 'Bone Golem', 1, 0xd8d0c0), boss: m('necromancer', 'The Lich', 1, 0xb0a0ff),
    lap: [m('cr_skeleton', 'Grave Walker'), m('cr_blue_wraith', 'Pale Wraith'), m('cr_frost_skeleton', 'Hooded Bones', 0.9, 0xd0c8ff)],
  },
  {
    name: 'The Overgrown Warrens', tiles: 'jungle',
    band: [m('orc_warrior', 'Orc Warrior', 1.2), m('orc_shaman', 'Orc Shaman', 0.9), m('ef_wolf', 'Dire Wolf'), m('ef_smallmushroom', 'Sporeling', 0.8), m('ef_normalmushroom', 'Mushroom Folk')],
    mid: m('ef_largemushroom', 'Elder Shroom'), boss: m('ef_troll', 'Troll Brute'),
    lap: [m('cr_orc_pirate', 'Orc Raider', 1.2), m('cr_slime', 'Moss Slime', 0.8), m('cr_green_thief', 'Warren Thief')],
  },
  {
    name: 'The Sunken Tomb', tiles: 'tomb',
    band: [m('ef_gnollscout', 'Gnoll Scout', 0.9), m('ef_gnollbrute', 'Gnoll Brute', 1.2), m('ef_gnollshaman', 'Gnoll Shaman'), m('masked_orc', 'Tomb Raider')],
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
    mid: m('ogre', 'Hellfire Ogre', 1, 0xff9070), boss: m('big_demon', 'Pit Lord'),
    lap: [m('cr_gold_knight', 'Gilded Zealot', 1.2), m('cr_purple_knight', 'Fallen Knight', 1.2), m('cr_king', 'Damned King', 1.1)],
  },
  {
    name: 'The Frozen Vault', tiles: 'halls',
    band: [m('ice_zombie', 'Frost Husk', 1.2), m('skelet', 'Frozen Skeleton', 1, 0xb0e0ff), m('ef_wolf', 'Frost Wolf', 1, 0xd0f0ff), m('necromancer', 'Rime Witch', 0.9, 0xa0d8ff)],
    mid: m('ef_golem', 'Ice Golem', 1, 0xa8e0ff), boss: m('ef_troll', 'Frost Troll', 1, 0xa8d8ff),
    lap: [m('cr_frost_imp', 'Frost Imp', 0.9), m('cr_snowman', 'Snow Brute', 1.2), m('cr_ice_ghost', 'Rime Ghost'), m('cr_nutcracker', 'Tin Soldier')],
  },
];

/** Zone index for a floor (0-based, keeps counting past the last zone). */
export const zoneOf = (floor: number) => Math.floor((floor - 1) / 10);

export const zoneFor = (floor: number) => ZONES[zoneOf(floor) % ZONES.length];

/** "The Sunken Tomb", then "The Corrupted Sunken Tomb" once the zones come round again. */
/** Every lap through the eight zones comes back darker, washed in its own colour. */
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

/** Each lap builds the zones from a different tileset, so a repeat zone is a new place, not a recolour. */
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
  | { t: 'gold'; pct: number }
  | { t: 'crit'; chance?: number; add?: number }
  | { t: 'cleave'; pct: number }
  | { t: 'syn'; a: number; b: number }
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
  | { t: 'owned2'; a: number; b: number; n: number }
  | { t: 'floor'; n: number }
  | { t: 'raids'; n: number }
  | { t: 'trophies'; n: number }
  | { t: 'fevers'; n: number };

/** Companion levels that unlock a ×2 damage upgrade (its traits, bought on its row). There are none past level 100. */
const MILESTONES = [10, 25, 50, 75, 100];
/** Each companion level costs this much more than the last (about 3.9 levels a floor against ×1.55 health). */
export const COST_GROWTH = 1.12;
/** Upgrade cost as a multiple of the companion's hire price. */
const MILESTONE_COST = [16, 190, 5_000, 1.5e5, 5e6];
/** Each companion's milestone upgrades, one per milestone. */
const MILESTONE_NAMES: Record<string, string[]> = {
  squire: ['Practice Swing', 'Eager Beaver', 'Training Wheels', 'Squire Power', 'Overachiever'],
  ranger: ['Near Miss', 'Mostly Accurate', 'Long Shot', 'Quiver Wit', 'Bullseye-ish'],
  brawler: ['Knuckle Down', 'Short Fuse', 'Punch Line', 'Gold Digger', 'Beard Punch'],
  apprentice: ['One Trick', 'Spark of Genius', 'Shock Value', 'Fast Learner', 'Bolt from the Blue'],
  hunter: ['Cold Blooded', 'Keen Nose', 'Scent Trail', 'Tail Gate', 'Scale Up'],
  shieldmaiden: ['Shield Bash', 'Board Meeting', 'Living Wall', 'Best Defense', 'Bash Course'],
  thief: ['Light Fingers', 'Sticky Fingers', 'Pickpocket', 'Knife to Meet You', 'Steal of a Deal'],
  dancer: ['First Position', 'Pirouette', 'Dance Off', 'Cutting a Rug', 'Sword Dance'],
  corsair: ['Sea Legs', 'Plunder Ground', 'Shiver Me Timbers', 'Sunken Treasure', 'Below Deck'],
  runesmith: ['Chisel In', 'Floor Plan', 'Rune for Cover', 'Set in Stone', 'Groundbreaking'],
  paladin: ['Holy Moly', 'Purge Party', 'Smite Club', 'Light Work', 'Holy Order'],
  stormcaller: ['Brainstorm', 'Under the Weather', 'Cloud Cover', 'Storm Front', 'Eye of the Storm'],
  venomblade: ['Toxic Trait', 'Bad Blood', 'Bite Back', 'Poison Pen', 'Forked Tongue'],
  doctor: ['Second Opinion', 'Bedside Manner', 'House Call', "Doctor's Orders", 'Bad Prognosis'],
  frostimp: ['Cold Snap', 'Chill Out', 'Ice Breaker', 'Frostbite', 'Cold Shoulder'],
  hollow: ['Gourd Duty', 'Pumpkin Spice', 'Carved Up', 'Patch Work', 'Squash Them'],
  oathbreaker: ['Promise Ring', 'Broken Vow', 'Fine Print', 'Word Breaker', 'No Take-Backs'],
  archmage: ['Old School', 'Back in My Day', 'Spell Check', 'Arch Rival', 'Senior Moment'],
  wraith: ['Ghost Note', 'Haunting Melody', 'Spirited', 'Dead Ringer', 'Soul Music'],
  necro: ['Change of Heart', 'Grave Mistake', 'Dead Serious', 'Bone to Pick', 'Raise the Stakes'],
  king: ['Royal Pain', 'Throne Away', 'Heavy Is the Head', "King's Ransom", 'Royal Decree'],
  angel: ['Fall Guy', 'Grounded', 'Fallen Grace', 'Wing It', 'Halo Effect'],
  ogre: ['Good Boy', 'Pebble Dash', 'Rock Solid', 'Big Softie', 'Boulder Dash'],
  demon: ['Terms and Conditions', 'Blood Pact', 'Hell to Pay', "Devil's Advocate", 'Hellfire'],
};
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/** The level of a companion's k-th milestone (k from 0). */
export const milestoneAt = (k: number) => MILESTONES[k];

/** The first milestone above this level (null past the last). */
export function nextMilestone(level: number): number | null {
  return MILESTONES.find((m) => m > level) ?? null;
}

/** A line of flavour under each of those upgrades. */
const MILESTONE_FLAVOR: Record<string, string[]> = {
  squire: ['He practises on everything. Mostly monsters.', 'Up before dawn. Swinging before breakfast.', "The training wheels are off. He's never been faster.", 'Small squire. Big swing.', 'Extra credit, paid in monsters.'],
  ranger: ['Closer than last time. That counts.', 'Eight out of ten monsters agree.', 'She hit something two floors down. Probably a monster.', 'Sharp arrows. Sharper comebacks.', "It's the thought that counts. The arrow helps."],
  brawler: ["He's taking this seriously now. Very seriously.", "Don't mention his height. Or anything.", 'He tells the joke. The monster gets the punch.', 'Every hole he digs has gold in it. Or a monster. Both are fine.', 'Nobody knows how. Nobody wants a demonstration.'],
  apprentice: ["It's a good trick.", 'Mostly sparks. Some genius.', 'Monsters find him shocking.', "Learned a second spell. It's also lightning.", 'Also from the red, the green and the ceiling.'],
  hunter: ['Feels nothing. Hits everything.', 'Smells fear. Also lunch.', 'Follows it three floors down and back.', 'Gets too close. On purpose.', 'Grows a little every time something dies.'],
  shieldmaiden: ['Defense is just offense, waiting.', 'The shield meets the face. Meeting adjourned.', "Walls don't usually chase you.", 'Is a good offense. Is also a good shield.', 'She teaches it. Monsters fail it.'],
  thief: ["Your purse feels lighter. That's normal.", 'The knives come back. So does your gold, mostly.', 'Monsters have pockets. Had.', 'He says it every time. Every knife.', "He's very proud of this price. Don't ask why."],
  dancer: ["Also the monster's last position.", 'One spin, three slices.', 'The monsters lost. Badly. Fatally.', 'And everything standing on it.', "Don't stand too close. Don't stand at all."],
  corsair: ['Steady on any floor. Even the wet ones.', "Everything down here is treasure if you're brave enough.", 'The monsters shiver first.', 'Found it. Kept it. Hit things with it.', 'The lower the deck, the bigger the haul.'],
  runesmith: ['Every swing leaves a mark. Some marks explode.', 'The plan: the floor explodes.', "Monsters run. Runes don't care.", "The runes are permanent. The monsters aren't.", 'Literally.'],
  paladin: ['A prayer and a punch.', "Everyone's invited. Nobody leaves.", 'First rule: smite.', 'Purging is easy when you glow.', 'The order is: hit it again.'],
  stormcaller: ['Her best ideas come with lightning.', 'The monsters are. Permanently.', 'Indoors, somehow.', "She's always at the front of it.", 'Calm in the middle. Chaos everywhere else.'],
  venomblade: ["She poisons everything. It's a lot.", 'Theirs, mostly.', 'Monsters bite. She bites back harder.', 'She writes their names on the blades. Then delivers them.', 'Says one thing. Stabs another.'],
  doctor: ['Also: dying.', 'Terrible. Effective.', 'Comes to you. Unfortunately.', 'Rest. Permanently.', 'For them. Always for them.'],
  frostimp: ['Snaps. Things. Cold.', "It won't. Ever.", 'Breaks the ice. And the monster.', 'Bites, too.', 'Monsters get it. Then they get frozen.'],
  hollow: ['Reporting for it.', 'Seasonal. Lethal.', "The pumpkin's smile gets wider every fight.", 'Fresh from the patch. Ready to work.', 'Pun intended.'],
  oathbreaker: ["Doesn't count. Never did.", "Another one. He's keeping count.", 'He read it. Then ignored it.', 'His word means nothing. His sword means everything.', 'Swings first. Never apologises.'],
  archmage: ['The original school. He built it.', 'Monsters were bigger. He was faster.', 'Every spell checked. Every monster checked out.', "He has one. It's the dungeon.", 'Forgot what he was casting. Cast it anyway. Worked.'],
  wraith: ['Heard but not seen. Then felt.', "Monsters can't get it out of their heads.", 'Enthusiastic, for the dead.', 'Sounds like doom. Is doom.', 'Played on monsters.'],
  necro: ['Used to raise them. Now he lowers them.', 'The monsters made it.', 'About the job. About the dead.', 'With every skeleton he ever raised.', 'And then drive them in.'],
  king: ["A pain in every monster's neck.", "He's fine about it. Mostly.", 'Heavy is the fist, too.', "Nobody's paying it. He's taking it.", 'All monsters: begone.'],
  angel: ['Took the fall. Gave back worse.', 'Literally. Angrily.', 'Not so graceful now. Much more punchy.', 'No plan. Lots of wing.', 'Monsters see it. Then they see nothing.'],
  ogre: ["Yes he is. Who's a good boy? Pebble is.", 'Pebble runs. Things break.', 'Pebble is not small. Pebble is never small.', 'To you. Only to you.', 'Pebble got bigger.'],
  demon: ['Nobody reads them. The monsters should have.', "Mostly the monsters' blood.", "And it's collecting.", 'Argues for violence. Wins.', 'Brought from home.'],
};

function milestoneName(comp: string, k: number) {
  return MILESTONE_NAMES[comp][k];
}

const CLICK_UPGS: [string, string, number, number][] = [
  // name, icon, floor required, cost
  ['Rusty Knife', 'weapon_knife', 1, 50],
  ['Short Sword', 'weapon_rusty_sword', 3, 400],
  ['Iron Blade', 'weapon_regular_sword', 8, 5_000],
  ['Red Gem Blade', 'weapon_red_gem_sword', 15, 2e5],
  ['Golden Edge', 'weapon_golden_sword', 25, 2e7],
  ['Lavish Saber', 'weapon_lavish_sword', 40, 5e10],
  ['Knightbreaker', 'weapon_knight_sword', 60, 1e15],
  ['Hand of the Deep', 'weapon_anime_sword', 80, 1e20],
];

/** Shop upgrades that speed up the Phantom Blade, a little at a time (it attacks once a second to begin with):
 *  name, floor, cost, attacks a second added. */
const PHANTOM_UPGS: [string, number, number, number][] = [
  ['Restless Blade', 4, 150, 0.1],
  ['Eager Blade', 12, 2e4, 0.2],
  ['Tireless Blade', 25, 2e7, 0.3],
  ['Ceaseless Blade', 45, 5e11, 0.5],
  ['Relentless Blade', 65, 1e16, 0.75],
  ['Endless Blade', 85, 1e21, 1],
];

const DPS_CLICK: [string, string, number, number][] = [
  ['Follow Through', 'weapon_mace', 10, 2_000],
  ['Battle Rhythm', 'weapon_hammer', 20, 5e6],
  ['Heavy Blows', 'weapon_big_hammer', 35, 5e9],
  ['Warlord\'s Arm', 'weapon_waraxe', 55, 5e13],
  ['Hand of Ruin', 'weapon_double_axe', 75, 5e18],
];

/** Shop tonics (flat damage / gold boosts). Not to be confused with boss relics. */
const TONICS: [string, string][] = [
  ['Lucky Coin', 'coin'], ['Blood Vial', 'flask_red'], ['Grave Moss', 'flask_green'], ['Bone Charm', 'skull'],
  ['Crypt Honey', 'flask_big_yellow'], ['Widow Venom', 'flask_big_green'], ['Heartsblood', 'flask_big_red'], ['Drowned Silver', 'flask_blue'],
  ['Moonless Ink', 'flask_big_blue'], ['Kingsgold', 'coin'], ['Screaming Salt', 'flask_red'], ['Starmarrow', 'flask_big_yellow'],
  ['Choir Ash', 'skull'], ['Witchglass', 'flask_big_blue'], ['Liquid Night', 'flask_big_green'], ['Oathbreaker Oil', 'flask_big_red'],
];

const SYNERGIES: [number, number, string][] = ([
  ['ranger', 'hunter', 'Hunting Party'], ['squire', 'shieldmaiden', 'Shield Wall'], ['apprentice', 'stormcaller', 'Twin Storms'], ['brawler', 'runesmith', 'Forge Brothers'],
  ['dancer', 'venomblade', 'Blades in the Dark'], ['doctor', 'necro', 'Plague and Grave'], ['hollow', 'angel', 'Burning Halo'], ['ogre', 'demon', 'Bound Together'],
] as const).map(([a, b, name]) => [compIndex(a), compIndex(b), name]);

/** Crits grow through the sharp-eyed companions' milestones (by milestone index): chance in %, or extra crit damage. */
const CRIT_BONUS: Record<string, Record<number, { chance?: number; add?: number }>> = {
  ranger: { 2: { chance: 2 }, 3: { chance: 2 }, 4: { chance: 3 } },
  hunter: { 2: { add: 1 }, 4: { add: 1 } },
  thief: { 1: { chance: 2 }, 3: { chance: 3 }, 4: { add: 1 } },
  dancer: { 2: { add: 1 }, 4: { add: 1 } },
  venomblade: { 1: { chance: 3 }, 3: { add: 2 }, 4: { chance: 3 } },
};
const critText = (b: { chance?: number; add?: number }) => (b.chance ? ` Crit chance +${b.chance}%.` : ` Crit damage +${b.add}×.`);

const CLEAVES: [string, number, number, number][] = [
  ['Cleave', 12, 2e4, 0.25],
  ['Wide Swings', 30, 1e9, 0.25],
  ['Whirlwind', 50, 1e14, 0.5],
];

function buildUpgrades(): UpgDef[] {
  const out: UpgDef[] = [];
  COMPS.forEach((comp, i) => {
    for (let k = 0; k < MILESTONES.length; k++) {
      const cost = comp.cost * MILESTONE_COST[k];
      const crit = CRIT_BONUS[comp.id]?.[k];
      out.push({
        id: `m${i}_${k}`, name: milestoneName(comp.id, k), flavor: MILESTONE_FLAVOR[comp.id][k],
        desc: `${comp.name} deals ×2 damage.${crit ? critText(crit) : ''}`,
        bonus: crit ? { t: 'crit', chance: (crit.chance ?? 0) / 100, add: crit.add } : undefined,
        cost, icon: { sprite: comp.sprite, tier: Math.min(k, ROMAN.length - 1) },
        effect: { t: 'comp', comp: i, mult: 2 }, req: { t: 'owned', comp: i, n: milestoneAt(k) },
      });
    }
  });
  CLICK_UPGS.forEach(([name, sprite, floor, cost], k) => {
    out.push({ id: `clk${k}`, name, desc: 'Your clicks deal twice as much damage.', cost, icon: { sprite }, effect: { t: 'click', mult: 2 }, req: { t: 'floor', n: floor } });
  });
  DPS_CLICK.forEach(([name, sprite, floor, cost], k) => {
    out.push({ id: `cd${k}`, name, desc: 'Each click also deals +5% of your companions\' damage per second.', cost, icon: { sprite }, effect: { t: 'clickDps', pct: 0.05 }, req: { t: 'floor', n: floor } });
  });
  PHANTOM_UPGS.forEach(([name, floor, cost, add], k) => {
    out.push({ id: `auto${k}`, name, desc: `Your Phantom Blade attacks ${add} more time${add === 1 ? '' : 's'} a second.`, cost, icon: { sprite: 'weapon_knife', tier: k + 1 }, effect: { t: 'auto', add }, req: { t: 'floor', n: floor } });
  });
  // The first step of cleave is the Dwarf Brawler's ability now; ids keep their old numbers so saves line up.
  CLEAVES.forEach(([name, floor, cost, pct], k) => k > 0 && out.push({
    id: `clv${k}`, name, desc: `Cleave +${Math.round(pct * 100)}%.`,
    cost, icon: { sprite: 'weapon_double_axe', tier: k }, effect: { t: 'cleave', pct }, req: { t: 'floor', n: floor }, needs: 'cleave',
  }));
  TONICS.forEach(([name, sprite], k) => {
    const gold = k % 3 === 0;
    const pct = gold ? 0.25 : k < 6 ? 0.1 : 0.25;
    const floor = 6 + k * 6;
    const cost = 1e4 * 10 ** (k * 1.3);
    out.push({
      id: `rel${k}`, name, desc: gold ? `Monsters drop +${Math.round(pct * 100)}% gold.` : `All damage +${Math.round(pct * 100)}%.`,
      cost, icon: { sprite }, effect: gold ? { t: 'gold', pct } : { t: 'global', pct }, req: { t: 'floor', n: floor },
    });
  });
  SYNERGIES.forEach(([a, b, name], k) => {
    out.push({
      id: `syn${k}`, name,
      desc: `${COMPS[a].name} and ${COMPS[b].name} each deal twice as much damage.`,
      cost: Math.max(COMPS[a].cost, COMPS[b].cost) * 500, icon: { sprite: COMPS[a].sprite, sub: COMPS[b].sprite },
      effect: { t: 'syn', a, b }, req: { t: 'owned2', a, b, n: 25 },
    });
  });
  const raid: [string, string, number, number, Effect][] = [
    ['Goblin Bait', 'Treasure goblins show up 30% more often.', 3, 7_777, { t: 'raid', freq: 1.3 }],
    ['Greedy Traps', 'Treasure goblins show up 30% more often.', 17, 7.77e8, { t: 'raid', freq: 1.3 }],
    ['Trophy Heads', 'Treasure rewards last 50% longer.', 47, 7.77e13, { t: 'raid', effect: 1.5 }],
  ];
  raid.forEach(([name, desc, n, cost, effect], k) => out.push({ id: `raid${k}`, name, desc, cost, icon: { sprite: 'chest_full_open' }, effect, req: { t: 'raids', n } }));
  const trophy: [string, number, number][] = [
    ['Trophy Wall', 5, 5_000], ['Gilded Plinths', 15, 5e7], ['Hall of Heads', 30, 5e11], ['Museum of Screams', 50, 5e15],
    ['Gallery of Kings', 75, 5e19], ['The Long Hall', 100, 5e24], ['Hall Without End', 130, 5e29],
  ];
  trophy.forEach(([name, n, cost], k) => out.push({
    id: `tro${k}`, name, desc: `Each trophy boosts damage by a further ${((k + 1) * 0.5).toFixed(1)}%.`, cost,
    icon: { sprite: 'skull', tier: k }, effect: { t: 'trophy', k: (k + 1) * 0.005 }, req: { t: 'trophies', n },
  }));
  const fever: [string, string, number, number, Effect][] = [
    ['Battle Fury', 'Rampage fills 25% faster.', 1, 2_000, { t: 'fever', fill: 1.25 }],
    ['Blood Frenzy', 'Rampage lasts 50% longer.', 5, 5e7, { t: 'fever', dur: 1.5 }],
    ['Unstoppable', 'Rampage +2.', 15, 5e12, { t: 'fever', power: 2 }],
  ];
  fever.forEach(([name, desc, n, cost, effect], k) => out.push({ id: `fev${k}`, name, desc, cost, icon: { sprite: 'flask_big_red', tier: k }, effect, req: { t: 'fevers', n }, needs: 'rampage' }));
  return out;
}

export const UPGRADES = buildUpgrades();

// ---------- abilities ----------

export type AbilityId = 'flurry' | 'crit' | 'rampage' | 'cleave' | 'drums' | 'treasure' | 'legion';

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

/** In the order you're likely to meet them. Each is unlocked by buying one companion trait, and earned again every run. */
export const ABILITIES: AbilityDef[] = [
  { id: 'flurry', name: 'Flurry', desc: 'Clicks for you, 10 times a second, for 30s.', kind: 'button', comp: compIndex('squire'), trait: 1, dur: 30, cooldown: 5 * 60 },
  { id: 'crit', name: 'Critical Hits', desc: 'Your clicks and Phantom Blade can land critical hits: a 3% chance for ×2 damage. Sharp-eyed companions raise both.', kind: 'passive', comp: compIndex('ranger'), trait: 1 },
  { id: 'rampage', name: 'Rampage', desc: 'Attacks charge it. Unleash for ×5 damage for 10s. Keep attacking for ×10.', kind: 'charge', comp: compIndex('brawler'), trait: 2 },
  { id: 'cleave', name: 'Cleave', desc: 'Your clicks also hit every other monster for 10% damage.', kind: 'button', comp: compIndex('shieldmaiden'), trait: 2, dur: 60, cooldown: 10 * 60 },
  { id: 'treasure', name: 'Treasure Sense', desc: 'Monsters drop ×3 gold for 30 seconds.', kind: 'button', comp: compIndex('corsair'), trait: 3, dur: 30, cooldown: 15 * 60 },
  { id: 'drums', name: 'War Drums', desc: 'Your party deals ×2 damage for 30 seconds.', kind: 'button', comp: compIndex('runesmith'), trait: 3, dur: 30, cooldown: 10 * 60 },
  { id: 'legion', name: 'Phantom Legion', desc: 'Your Phantom Blade attacks ten times as fast for 30 seconds.', kind: 'button', comp: compIndex('stormcaller'), trait: 4, dur: 30, cooldown: 15 * 60 },
];
export const ABILITY_BY_ID = new Map(ABILITIES.map((a) => [a.id, a]));
/** The trait upgrade that unlocks an ability. */
export const abilityUpgrade = (a: AbilityDef) => `m${a.comp}_${a.trait}`;
/** The ability a trait upgrade unlocks, if any. */
export const ABILITY_BY_UPGRADE = new Map(ABILITIES.map((a) => [abilityUpgrade(a), a]));
/** Companion traits shown on the companion's own row (levels 10–100); later milestones stay in the Upgrades grid. */
export const TRAITS = 5;
/** A companion's first milestones (`m{comp}_{k}`, k < TRAITS) are its traits, bought on its own row. */
export const isTraitId = (id: string) => {
  const m = /^m\d+_(\d+)$/.exec(id);
  return !!m && Number(m[1]) < TRAITS;
};
export const UPG_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

// ---------- abyss (prestige) ----------

/** An Abyss power: bought with souls, again and again (up to `max`), each level dearer than the last. */
export interface AbyssDef {
  id: string;
  name: string;
  icon: string;
  max: number;
  cost: (lv: number) => number;
  /** What it does at this many levels. */
  desc: (lv: number) => string;
}

const grow = (base: number, rate: number) => (lv: number) => Math.ceil(base * rate ** lv);

export const ABYSS: AbyssDef[] = [
  { id: 'pulse', name: 'Restless Dead', icon: 'skull', max: 5, cost: grow(5, 2), desc: (l) => `While you're away your party fights at ${25 + 15 * l}% speed.` },
  { id: 'twin', name: 'Twin Blades', icon: 'weapon_duel_sword', max: Infinity, cost: grow(10, 1.8), desc: (l) => `Your clicks deal ×${1 + l} damage.` },
  { id: 'hands', name: 'Phantom Fury', icon: 'weapon_knife', max: Infinity, cost: grow(25, 1.8), desc: (l) => `Your Phantom Blade attacks ${l} more time${l === 1 ? '' : 's'} a second.` },
  { id: 'lure', name: 'Scent of Gold', icon: 'coin', max: 10, cost: grow(40, 1.6), desc: (l) => `Treasure goblins show up ${10 * l}% more often.` },
  { id: 'bargain', name: 'Dark Bargain', icon: 'flask_big_red', max: 10, cost: grow(60, 1.8), desc: (l) => `Upgrades cost ${Math.round((1 - 0.95 ** l) * 100)}% less.` },
  { id: 'tithe', name: 'Mercenary Guild', icon: 'coin', max: 10, cost: grow(100, 1.8), desc: (l) => `Companions cost ${Math.round((1 - 0.97 ** l) * 100)}% less.` },
  { id: 'dreams', name: 'Endless Rage', icon: 'flask_big_yellow', max: 10, cost: grow(150, 1.7), desc: (l) => `Rampage fills and lasts ${15 * l}% longer.` },
  { id: 'skip', name: 'Deep Stairs', icon: 'floor_stairs', max: 10, cost: grow(200, 2), desc: (l) => `Start each descent on floor ${1 + 5 * l}.` },
  { id: 'mimic', name: 'Mimic Chests', icon: 'chest_mimic_open', max: 1, cost: () => 400, desc: () => 'Treasure can hold a Soul Storm: damage ×666 for 6 seconds.' },
  { id: 'patience', name: 'Patient Hunter', icon: 'ogre', max: 10, cost: grow(500, 1.7), desc: (l) => `Bosses give you ${3 * l} more seconds.` },
  { id: 'roots', name: 'Deep Roots', icon: 'flask_big_green', max: 10, cost: grow(700, 1.9), desc: (l) => `Each soul gives +${(SOUL_POWER * 100 + 0.2 * l).toFixed(1)}% damage.` },
];
export const ABYSS_BY_ID = new Map(ABYSS.map((a) => [a.id, a]));

// ---------- ascend milestones ----------

/** Rewards for how many times you've ascended (never lost: the count only goes up). */
export const ASCEND_MILESTONES = [
  { at: 3, id: 'veterans', name: 'Veterans', desc: 'The Squire, Ranger and Dwarf Brawler start every descent at level 25.' },
  { at: 5, id: 'buyall', name: 'Buy all', desc: 'A button that buys every upgrade you can afford.' },
  { at: 10, id: 'quartermaster', name: 'Quartermaster', desc: "Upgrades you've bought before buy themselves again as soon as you can afford them." },
  { at: 20, id: 'snare', name: 'Goblin snare', desc: 'Treasure goblins sometimes get caught without you.' },
] as const;
export type MilestoneId = (typeof ASCEND_MILESTONES)[number]['id'];

// ---------- cursed descents ----------

/** A descent under one rule. Reaching floors 40 / 80 / 120 under it earns its reward tiers, for good. */
export interface CurseDef {
  id: string;
  name: string;
  rule: string;
  /** The reward at tier 1–3. */
  reward: (tier: number) => string;
}

export const CURSE_FLOORS = [40, 80, 120];
/** Cursed descents open after this many ascents, a couple at a time. */
export const CURSES_FROM = 5;

export const CURSES: CurseDef[] = [
  { id: 'silent', name: 'Silent Blades', rule: "You can't attack by hand. The party and the Phantom Blade do everything.", reward: (t) => `Your Phantom Blade gets +${[0, 0.5, 1, 2][t]} attacks a second.` },
  { id: 'iron', name: 'Iron Wardens', rule: 'Every boss is Armored.', reward: (t) => `Armored bosses block ${[0, 20, 40, 60][t]}% less.` },
  { id: 'small', name: 'A Small Party', rule: 'Only six companions may join this descent.', reward: (t) => `Companion traits cost ${10 * t}% less.` },
  { id: 'fuse', name: 'Short Fuse', rule: 'Boss timers are halved.', reward: (t) => `Every boss gives you ${5 * t} more seconds.` },
  { id: 'norampage', name: 'No Rampage', rule: 'The Rampage meter never fills.', reward: (t) => `Rampage fills ${20 * t}% faster.` },
  { id: 'mending', name: 'Mending Dark', rule: 'Every boss regenerates.', reward: (t) => `Regenerating bosses heal ${25 * t}% slower.` },
  { id: 'lean', name: 'Lean Purse', rule: 'No upgrades from the shop: only companions and their traits.', reward: (t) => `Upgrades cost ${10 * t}% less.` },
  { id: 'two', name: 'Two Curses', rule: 'Every boss is Armored and regenerates.', reward: (t) => `Ascending pays ×${[1, 1.25, 1.5, 2][t]} souls.` },
];
export const CURSE_BY_ID = new Map(CURSES.map((c) => [c.id, c]));

// ---------- boss modifiers ----------

export type ModId = 'armored' | 'enraged' | 'regen' | 'split' | 'giant';

export interface ModDef {
  id: ModId;
  name: string;
  desc: string;
  /** Relic that answers it. */
  counter: string;
  color: string;
}

export const MODS: ModDef[] = [
  { id: 'armored', name: 'Armored', desc: 'Companions deal 75% less damage to it. Clicks hit in full.', counter: 'pick', color: '#9fb4c8' },
  { id: 'enraged', name: 'Enraged', desc: 'Only half the time to beat it.', counter: 'glass', color: '#ff6a4a' },
  { id: 'regen', name: 'Regenerating', desc: 'Heals 3% of its health every second.', counter: 'rot', color: '#7ee07a' },
  { id: 'split', name: 'Splitting', desc: 'Splits in two when it falls. Both halves have to die in time.', counter: 'cleaver', color: '#d58aff' },
  { id: 'giant', name: 'Giant', desc: 'Three times the health, and 50% more time.', counter: 'slayer', color: '#ffc24a' },
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

// ---------- relics ----------

export type Rarity = 0 | 1 | 2 | 3;
export const RARITY = ['Common', 'Rare', 'Epic', 'Legendary'] as const;

export type RelicEffect = 'click' | 'party' | 'gold' | 'boss' | 'time' | 'critMult' | 'critChance' | 'pierce' | 'rot' | 'rampage' | 'goblin' | 'souls' | 'phantom' | 'cleave' | 'all' | 'oath';

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  effect: RelicEffect;
  flavor: string;
}

const r = (id: string, name: string, icon: string, rarity: Rarity, effect: RelicEffect, flavor: string): RelicDef => ({ id, name, icon, rarity, effect, flavor });

/** Boss drops. You keep them forever; finding one again raises its level. */
export const RELICS: RelicDef[] = [
  r('whet', 'Whetstone', 'weapon_knife', 0, 'click', 'A little spit, a little stone, a lot of edge.'),
  r('banner', 'Tattered Banner', 'wall_banner_red', 0, 'party', 'Nobody remembers the army. The banner remembers.'),
  r('purse', 'Goblin Purse', 'coin', 0, 'gold', 'Still warm. Still jingling. Still somehow full.'),
  r('slayer', 'Giantslayer', 'weapon_spear', 0, 'boss', 'The bigger they are, the more of them there is to stab.'),
  r('glass', 'Sandglass', 'flask_yellow', 1, 'time', 'The sand falls up if you ask nicely.'),
  r('razor', 'Razor Edge', 'weapon_saw_sword', 1, 'critMult', 'Cuts on the way in. Cuts worse on the way out.'),
  r('hawk', 'Hawk\'s Eye', 'weapon_bow', 1, 'critChance', 'Sees the soft spot. Every monster has one.'),
  r('pick', 'Armor\u00ADbreaker', 'weapon_big_hammer', 1, 'pierce', 'Plate is just a tin you open.'),
  r('rot', 'Festering Blade', 'weapon_machete', 1, 'rot', 'Wounds it makes do not close. Ever.'),
  r('drum', 'Blood Drum', 'flask_big_red', 2, 'rampage', 'Beat it once and the whole party sees red.'),
  r('bait', 'Golden Bait', 'chest_full_open', 2, 'goblin', 'Goblins cannot resist. Goblins have never resisted anything.'),
  r('cage', 'Soul Cage', 'skull', 2, 'souls', 'It hums when you go deeper.'),
  r('hilt', 'Phantom Hilt', 'weapon_katana', 2, 'phantom', 'The sword is gone. The swinging is not.'),
  r('cleaver', 'Headsman\'s Cleaver', 'weapon_cleaver', 2, 'cleave', 'One swing, many necks.'),
  r('shard', 'Deepheart Shard', 'ui_heart_full', 3, 'all', 'A splinter of the thing at the bottom. It beats.'),
  r('oath', 'Oathkeeper', 'weapon_golden_sword', 3, 'oath', 'Your hand, and the strength of everyone behind you.'),
];
export const RELIC_BY_ID = new Map(RELICS.map((x) => [x.id, x]));

/** What a relic does at a level, in words. */
/** Relic levels that earn a star; each star makes the relic a quarter stronger. */
export const RELIC_STARS = [5, 15, 40, 100];
export const relicStars = (lv: number) => RELIC_STARS.filter((n) => lv >= n).length;
/** The level a relic works at: its own level, plus a quarter per star. */
export const relicPower = (lv: number) => lv + Math.floor((lv * relicStars(lv)) / 4);

export function relicText(def: RelicDef, lv: number): string {
  const L = Math.max(1, relicPower(lv));
  switch (def.effect) {
    case 'click': return `Clicks deal ×${1 + L} damage.`;
    case 'party': return `Companions deal ×${fmtN(1 + 0.5 * L)} damage.`;
    case 'gold': return `Monsters drop ×${fmtN(1 + 0.5 * L)} gold.`;
    case 'boss': return `×${1 + L} damage to bosses.`;
    case 'time': return `Bosses give you ${Math.min(30, 3 * L)} more seconds.`;
    case 'critMult': return `Critical hits deal ×${fmtN(1 + 0.5 * L)} damage.`;
    case 'critChance': return `+${Math.min(30, 2 * L)}% critical hit chance.`;
    case 'pierce': return `Armored bosses block ${Math.round(75 * 0.7 ** L)}% of companion damage instead of 75%.`;
    case 'rot': return `Regenerating bosses heal ${fmtN(3 * 0.7 ** L)}% a second instead of 3%.`;
    case 'rampage': return `Rampage +${L}.`;
    case 'goblin': return `Treasure goblins show up ${30 * L}% more often.`;
    case 'souls': return `Ascending earns ${15 * L}% more souls.`;
    case 'phantom': return `Your Phantom Blade attacks ${fmtN(0.5 * L)} more time${0.5 * L === 1 ? '' : 's'} a second.`;
    case 'cleave': return `Clicks also hit every other monster for ${20 * L}% damage.`;
    case 'all': return `All damage ×${1 + L}.`;
    case 'oath': return `Each click also deals ${10 * L}% of your party's damage per second.`;
  }
}

const fmtN = (n: number) => (Math.round(n * 100) / 100).toString();

// ---------- the heart (second prestige) ----------

/** Awakening needs this deepest floor. */
export const AWAKEN_FLOOR = 170;
/** A boss beaten with this many seconds or fewer left is a clutch kill. */
export const CLUTCH_SECONDS = 3;

export interface HeartDef {
  id: string;
  name: string;
  icon: string;
  /** Cost of the next level, given levels owned. */
  cost: (lv: number) => number;
  max: number;
  desc: (lv: number) => string;
}

/** Damage each soul adds (Deep Roots adds 0.2% a level). */
export const SOUL_POWER = 0.01;

/** Heart of Fury's damage multiplier per level. */
export const FURY = 1.5;

export const HEART: HeartDef[] = [
  { id: 'fury', name: 'Heart of Fury', icon: 'ui_heart_full', max: Infinity, cost: (l) => 2 ** l, desc: (l) => `All damage ×${FURY} per level (now ×${fmtBig(FURY ** l)}).` },
  { id: 'siphon', name: 'Soul Siphon', icon: 'skull', max: Infinity, cost: (l) => Math.ceil(3 * 1.6 ** l), desc: (l) => `Ascending earns +100% souls per level (now +${l * 100}%).` },
  { id: 'hoard', name: 'Relic Hoard', icon: 'chest_full_open', max: 2, cost: (l) => [5, 25][l], desc: (l) => `One more relic slot (${3 + l} now).` },
  { id: 'hunter', name: 'Relic Hunter', icon: 'weapon_bow_2', max: 4, cost: (l) => [3, 8, 20, 50][l], desc: (l) => `Bosses drop relics 50% more often per level (now +${l * 50}%).` },
  { id: 'bane', name: 'Warden\'s Bane', icon: 'weapon_red_gem_sword', max: 3, cost: (l) => [4, 15, 60][l], desc: (l) => `Boss modifiers are 25% weaker per level (now ${l * 25}%).` },
  { id: 'echo', name: 'Echoing Abyss', icon: 'flask_big_blue', max: 1, cost: () => 6, desc: () => 'Keep the first level of every Abyss power when you awaken.' },
];
export const HEART_BY_ID = new Map(HEART.map((h) => [h.id, h]));

function fmtBig(n: number) {
  return n >= 1e6 ? n.toExponential(1).replace('e+', 'e') : n >= 100 ? String(Math.round(n)) : String(+n.toFixed(2));
}

// ---------- cards ----------

export type CardKind = 'monster' | 'mid' | 'boss' | 'goblin';

/** One card per kind of monster, Ragnarok style: no bonus, just the collection. */
export interface CardDef {
  id: string;
  name: string;
  sprite: string;
  tint?: number;
  kind: CardKind;
  /** Zone it's listed under (-1: the goblins). */
  zone: number;
  /** Where it turns up, one line per place, with the first floor of that place's zone (a place is only listed once
   *  you've reached its zone). */
  where: { text: string; floor: number }[];
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

function buildCards(): CardDef[] {
  const out = new Map<string, CardDef>();
  const add = (d: MonsterDef, kind: CardKind, zone: number, text: string, floor: number) => {
    const id = cardId(d.name);
    const known = out.get(id);
    if (known) known.where.push({ text, floor });
    else out.set(id, { id, name: d.name, sprite: d.sprite, tint: d.tint, kind, zone, where: [{ text, floor }], floor, gold: true });
  };
  ZONES.forEach((z, i) => {
    const a = i * 10;
    const name = z.name.replace(/^The /, '');
    z.band.forEach((d) => add(d, 'monster', i, `${name}, floors ${a + 1}–${a + 9}`, a + 1));
    z.lap.forEach((d) => add(d, 'monster', i, `${name}, floors ${a + 81}–${a + 89}`, a + 81));
    add(z.mid, 'mid', i, `Floor ${a + 5} boss`, a + 1);
    add(z.boss, 'boss', i, `Floor ${a + 10} boss`, a + 1);
  });
  out.set(GOBLIN_CARD, { id: GOBLIN_CARD, name: 'Treasure Goblin', sprite: 'goblin', tint: 0xffe08a, kind: 'goblin', zone: -1, where: [], floor: 1, gold: false });
  out.set(RAINBOW_CARD, { id: RAINBOW_CARD, name: 'Rainbow Goblin', sprite: 'goblin', kind: 'goblin', zone: -1, where: [], floor: 1, gold: false });
  return [...out.values()];
}

export const CARDS = buildCards();
export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));

// ---------- trophies ----------

export type TrophyReq =
  | { t: 'gold'; n: number }
  | { t: 'floor'; n: number }
  | { t: 'kills'; n: number }
  | { t: 'bosses'; n: number }
  | { t: 'own'; comp: number; n: number }
  | { t: 'clicks'; n: number }
  | { t: 'crits'; n: number }
  | { t: 'raids'; n: number }
  | { t: 'fevers'; n: number }
  | { t: 'descents'; n: number }
  | { t: 'upgrades'; n: number }
  | { t: 'dps'; n: number }
  | { t: 'missed'; n: number }
  | { t: 'relics'; n: number }
  | { t: 'awakens'; n: number }
  | { t: 'clutches'; n: number }
  | { t: 'champions'; n: number }
  | { t: 'vaults'; n: number }
  | { t: 'rainbows'; n: number }
  | { t: 'rampage'; n: number }
  | { t: 'stars'; n: number }
  | { t: 'cards'; n: number }
  | { t: 'goldCards'; n: number };

export interface TrophyDef {
  id: string;
  name: string;
  desc: string;
  icon: Icon;
  req: TrophyReq;
}

const FLOOR_NAMES = ['Into the Dark', 'Down the Stairs', 'Deeper', 'Where Torches Fail', 'Bone Deep', 'The Long Descent', 'Lightless', 'The Underneath', 'Below Below', 'Heartland', 'No Way Back', 'The Bottom?', 'There Is No Bottom', 'Older Than Stone', 'A Thousand Down', 'The Abyss Stares Back', 'Two Thousand Fathoms', 'Root of the World', 'Where the Heart Beats'];
const FLOOR_AT = [5, 10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000];
const GOLD_NAMES = ['Pocket Change', 'Coin Purse', 'Strongbox', 'Treasury', 'Dragon Hoard', 'Kingdom\'s Ransom', 'Empire\'s Gold', 'Gold Mountain', 'Sea of Gold', 'World of Gold', 'Starfall Gold', 'Beyond Counting'];
const OWN_AT = [1, 25, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000];
const OWN_TITLES = ['Hired:', 'Loyal', 'Veteran', 'Legendary', 'Mythic', 'Eternal', 'Ascended', 'Godlike', 'Immortal', 'Transcendent', 'Beyond'];

/** A round power of ten in words for trophy text ("1 sextillion"), falling back to 1e80 past the named ones. */
const POWER_WORDS: Record<number, string> = { 6: 'million', 9: 'billion', 12: 'trillion', 15: 'quadrillion', 18: 'quintillion', 21: 'sextillion', 24: 'septillion', 27: 'octillion', 30: 'nonillion', 33: 'decillion', 36: 'undecillion', 39: 'duodecillion', 42: 'tredecillion', 45: 'quattuordecillion', 60: 'novemdecillion' };
function bigWords(n: number): string {
  const e = Math.round(Math.log10(n));
  if (e < 6) return n.toLocaleString('en-US');
  if (e === 100) return 'a googol';
  const w = POWER_WORDS[e - (e % 3)];
  return w ? `${10 ** (e % 3)} ${w}` : `1e${e}`;
}

function buildTrophies(): TrophyDef[] {
  const out: TrophyDef[] = [];
  FLOOR_AT.forEach((n, k) => out.push({ id: `fl${k}`, name: FLOOR_NAMES[k], desc: `Clear floor ${n}.`, icon: { sprite: 'floor_stairs', tier: Math.min(k, 10) }, req: { t: 'floor', n } }));
  GOLD_NAMES.forEach((name, k) => {
    const n = 10 ** (2 + k * 4);
    out.push({ id: `gold${k}`, name, desc: `Collect ${bigWords(n)} gold in total.`, icon: { sprite: 'coin', tier: Math.min(k, 10) }, req: { t: 'gold', n } });
  });
  [100, 1000, 10_000, 100_000, 1e6, 1e7].forEach((n, k) => out.push({ id: `kill${k}`, name: ['Monster Hunter', 'Slayer', 'Butcher', 'Massacre', 'Extinction Event', 'The Reaper'][k], desc: `Kill ${n.toLocaleString('en-US')} monsters.`, icon: { sprite: 'skull', tier: k }, req: { t: 'kills', n } }));
  [1, 10, 50, 200, 1000].forEach((n, k) => out.push({ id: `boss${k}`, name: ['Giant Slayer', 'Kingsbane', 'Tyrant Killer', 'Boss Rush', 'Nothing Stands'][k], desc: `Defeat ${n} boss${n > 1 ? 'es' : ''}.`, icon: { sprite: 'ogre', tier: k }, req: { t: 'bosses', n } }));
  COMPS.forEach((comp, i) => OWN_AT.forEach((n, k) => {
    out.push({ id: `own${i}_${k}`, name: n === 1 ? `Hired: ${comp.name}` : `${OWN_TITLES[k]} ${comp.name}`, desc: n === 1 ? `Hire the ${comp.name}.` : `Get the ${comp.name} to level ${n}.`, icon: { sprite: comp.sprite, tier: k }, req: { t: 'own', comp: i, n } });
  }));
  [1, 100, 1_000, 10_000, 100_000].forEach((n, k) => out.push({ id: `clicks${k}`, name: ['First Blood', 'Tap Tap', 'Clicker', 'Relentless', 'Carpal Tunnel'][k], desc: `Click ${n.toLocaleString('en-US')} time${n > 1 ? 's' : ''}.`, icon: { sprite: 'weapon_knife', tier: k }, req: { t: 'clicks', n } }));
  [1, 100, 1_000, 10_000].forEach((n, k) => out.push({ id: `crit${k}`, name: ['Critical!', 'Sharp Eye', 'Surgeon', 'Every Hit Counts'][k], desc: `Land ${n.toLocaleString('en-US')} critical hit${n > 1 ? 's' : ''}.`, icon: { sprite: 'weapon_katana', tier: k }, req: { t: 'crits', n } }));
  [1, 7, 27, 77, 277, 777].forEach((n, k) => out.push({ id: `raid${k}`, name: ['Finders Keepers', 'Goblin Catcher', 'Head Hunter', 'Goblin Bane', 'No One Escapes', 'Treasure Lord'][k], desc: `Catch ${n} treasure goblin${n > 1 ? 's' : ''}.`, icon: { sprite: 'goblin', tier: k }, req: { t: 'raids', n } }));
  [1, 10, 50, 200].forEach((n, k) => out.push({ id: `fev${k}`, name: ['Rampage!', 'Hot Blooded', 'Berserker', 'Endless Fury'][k], desc: `Go on a Rampage ${n} time${n > 1 ? 's' : ''}.`, icon: { sprite: 'flask_big_red', tier: k }, req: { t: 'fevers', n } }));
  [1, 3, 10, 25, 50].forEach((n, k) => out.push({ id: `desc${k}`, name: ['Up for Air', 'It Lets You Go', 'Return Ticket', 'The Deep Knows You', 'Always Back Down'][k], desc: `Ascend ${n} time${n > 1 ? 's' : ''}.`, icon: { sprite: 'floor_ladder', tier: k }, req: { t: 'descents', n } }));
  [10, 50, 100, 150].forEach((n, k) => out.push({ id: `upg${k}`, name: ['Tinkerer', 'Improver', 'Perfectionist', 'Nothing Left to Buy'][k], desc: `Own ${n} upgrades at once.`, icon: { sprite: 'flask_big_yellow', tier: k }, req: { t: 'upgrades', n } }));
  const missed: [number, string, string][] = [
    [1, 'Butterfingers', 'Let a treasure goblin get away.'],
    [5, 'Slippery Little Guys', 'Let 5 treasure goblins get away.'],
    [15, 'Goblin Enabler', 'Let 15 treasure goblins get away. They are telling their friends.'],
    [40, 'Goblin Philanthropist', 'Let 40 treasure goblins get away. You are funding their retirement.'],
    [100, 'Official Goblin Sponsor', 'Let 100 treasure goblins get away. They have named a tunnel after you.'],
    [250, 'The Goblins Thank You', 'Let 250 treasure goblins get away. There is a statue of you in Goblin Town.'],
  ];
  missed.forEach(([n, name, desc], k) => out.push({ id: `miss${k}`, name, desc, icon: { sprite: 'goblin', tier: k }, req: { t: 'missed', n } }));
  [1, 4, 8, 12, 16].forEach((n, k) => out.push({ id: `rel${k}`, name: ['Finder', 'Collector', 'Curator', 'Reliquary', 'Every Last One'][k], desc: n === 1 ? 'Find a relic.' : n === 16 ? 'Find every relic.' : `Find ${n} different relics.`, icon: { sprite: 'chest_full_open', tier: k }, req: { t: 'relics', n } }));
  [1, 10, 50].forEach((n, k) => out.push({ id: `clutch${k}`, name: ['By a Hair', 'Nerves of Steel', 'Living on the Edge'][k], desc: `Beat ${n === 1 ? 'a boss' : `${n} bosses`} with ${CLUTCH_SECONDS} seconds or less on the clock.`, icon: { sprite: 'flask_yellow', tier: k }, req: { t: 'clutches', n } }));
  [1, 25, 100].forEach((n, k) => out.push({ id: `champ${k}`, name: ['Champion Slayer', 'Crown Breaker', 'Champion of Champions'][k], desc: `Slay ${n === 1 ? 'a champion' : `${n} champions`}.`, icon: { sprite: 'weapon_red_gem_sword', tier: k }, req: { t: 'champions', n } }));
  [1, 3, 10].forEach((n, k) => out.push({ id: `vault${k}`, name: ['Over the Rainbow', 'Vault Raider', 'Goblin Banker'][k], desc: `Open the Rainbow Vault ${n === 1 ? 'once' : `${n} times`} (a rainbow goblin's jackpot).`, icon: { sprite: 'chest_full_open', tier: k }, req: { t: 'vaults', n } }));
  [1, 5, 15, 40].forEach((n, k) => out.push({ id: `rainbow${k}`, name: ['Double Rainbow', 'Rainbow Wrangler', 'Chasing Rainbows', 'End of the Rainbow'][k], desc: `Catch ${n === 1 ? 'a rainbow goblin' : `${n} rainbow goblins`}.`, icon: { sprite: 'goblin', tier: k + 2 }, req: { t: 'rainbows', n } }));
  [1, 2, 3, 4].forEach((n, k) => out.push({ id: `star${k}`, name: ['Polished', 'Gleaming', 'Radiant', 'Mythic'][k], desc: `Raise a relic to ${'★'.repeat(n)} (level ${RELIC_STARS[k]}).`, icon: { sprite: 'chest_full_open', tier: k + 1 }, req: { t: 'stars', n } }));
  [1, 2, 3, 4].forEach((n, k) => out.push({ id: `lap${k}`, name: ['Corruption', 'The Abyss Looks Back', 'Hollowed Out', 'Eternity'][k], desc: `Reach floor ${n * 80 + 1}, where the zones return ${CORRUPTION[n].name.toLowerCase()}.`, icon: { sprite: 'skull', tier: k + 1 }, req: { t: 'floor', n: n * 80 } }));
  out.push({ id: 'rampage0', name: 'Bloodrush', desc: 'Keep attacking until a Rampage reaches its top tier.', icon: { sprite: 'flask_big_red', tier: 1 }, req: { t: 'rampage', n: 1 } });
  [1, 3, 10, 25].forEach((n, k) => out.push({ id: `awk${k}`, name: ['It Wakes', 'Heartbeat', 'Drumming Deep', 'The Heart Remembers'][k], desc: `Awaken the Heart ${n} time${n > 1 ? 's' : ''}.`, icon: { sprite: 'ui_heart_full', tier: k }, req: { t: 'awakens', n } }));
  const dpsNames = ['Scrapper', 'Fighter', 'Warrior', 'Warlord', 'Army', 'Legion', 'Cataclysm', 'Apocalypse', 'Extinction', 'World Breaker', 'Star Eater', 'Galaxy Killer', 'Heat Death', 'Big Bang', 'Googol'];
  [10, 1e3, 1e6, 1e9, 1e12, 1e15, 1e18, 1e21, 1e24, 1e30, 1e36, 1e45, 1e60, 1e80, 1e100].forEach((n, k) => out.push({ id: `dps${k}`, name: dpsNames[k], desc: `Reach ${bigWords(n)} damage per second.`, icon: { sprite: 'weapon_waraxe', tier: Math.min(k, 10) }, req: { t: 'dps', n } }));
  [1, 10, 25, 50, CARDS.length].forEach((n, k) => out.push({ id: `card${k}`, name: ['Card Carrier', 'Card Sharp', 'Monster Manual', 'Bestiary', 'Every Last Monster'][k], desc: n === 1 ? 'Find a monster card.' : n === CARDS.length ? 'Find every monster card.' : `Find ${n} different monster cards.`, icon: { sprite: 'imp', tier: k }, req: { t: 'cards', n } }));
  [1, 5, 20].forEach((n, k) => out.push({ id: `gcard${k}`, name: ['Gilded', 'Golden Touch', 'Midas Deck'][k], desc: n === 1 ? 'Find a gold card (champions drop them).' : `Find ${n} different gold cards.`, icon: { sprite: 'big_demon', tier: k + 2 }, req: { t: 'goldCards', n } }));
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
export const CURSORS: CursorDef[] = [
  { id: 'rusty', name: 'Rusty Sword', sprite: 'weapon_rusty_sword' },
  { id: 'machete', name: 'Machete', sprite: 'weapon_machete', trophy: 'kill0' },
  { id: 'mace', name: 'Mace', sprite: 'weapon_mace', trophy: 'clicks2' },
  { id: 'axe', name: 'Axe', sprite: 'weapon_axe', trophy: 'kill1' },
  { id: 'throwing', name: 'Goblin Catcher', sprite: 'weapon_throwing_axe', trophy: 'raid1' },
  { id: 'spiked', name: 'Consolation Club', sprite: 'weapon_baton_with_spikes', trophy: 'miss1' },
  { id: 'hammer', name: 'War Hammer', sprite: 'weapon_hammer', trophy: 'boss1' },
  { id: 'katana', name: 'Katana', sprite: 'weapon_katana', trophy: 'crit2' },
  { id: 'spear', name: 'Spear', sprite: 'weapon_spear', trophy: 'fl2' },
  { id: 'cleaver', name: 'Cleaver', sprite: 'weapon_cleaver', trophy: 'kill2' },
  { id: 'redstaff', name: 'Blood Staff', sprite: 'weapon_red_magic_staff', trophy: 'fev1' },
  { id: 'greenstaff', name: 'Goblin Scepter', sprite: 'weapon_green_magic_staff', trophy: 'miss3' },
  { id: 'duel', name: 'Duelist', sprite: 'weapon_duel_sword', trophy: 'desc0' },
  { id: 'waraxe', name: 'War Axe', sprite: 'weapon_waraxe', trophy: 'fl4' },
  { id: 'saw', name: 'Saw Blade', sprite: 'weapon_saw_sword', trophy: 'kill3' },
  { id: 'bighammer', name: 'Maul', sprite: 'weapon_big_hammer', trophy: 'boss2' },
  { id: 'doubleaxe', name: 'Twin Axe', sprite: 'weapon_double_axe', trophy: 'desc1' },
  { id: 'gem', name: 'Red Gem Blade', sprite: 'weapon_red_gem_sword', trophy: 'gold4' },
  { id: 'lavish', name: 'Lavish Saber', sprite: 'weapon_lavish_sword', trophy: 'fl6' },
  { id: 'anime', name: 'Hand of the Deep', sprite: 'weapon_anime_sword', trophy: 'desc2' },
  { id: 'golden', name: 'Golden Sword', sprite: 'weapon_golden_sword', trophy: 'raid3' },
];

// ---------- news ticker ----------

export interface News {
  text: string;
  when?: (s: { floor: number; owned: number[]; depth: number; raids: number; kills: number }) => boolean;
}

export const NEWS: News[] = [
  { text: 'The stairs go down. They always go down.', when: (s) => s.floor < 5 },
  { text: 'Somewhere far below, something is beating like a drum.', when: (s) => s.floor < 20 },
  { text: 'Your Squire asks if the dungeon has a bottom. You do not answer.', when: (s) => s.owned[compIndex('squire')] > 0 },
  { text: 'The Ranger has started keeping a tally on the wall. The wall is full.', when: (s) => s.owned[compIndex('ranger')] > 10 },
  { text: 'The dwarf insists on punching the bosses personally.', when: (s) => s.owned[compIndex('brawler')] > 0 },
  { text: 'The Apprentice set his own beard on fire again. It still counts as damage.', when: (s) => s.owned[compIndex('apprentice')] > 0 },
  { text: 'The Lizard Hunter claims she can hear the dungeon breathing.', when: (s) => s.owned[compIndex('hunter')] > 0 },
  { text: 'Shieldmaiden reports the shield is "fine". It is mostly dents now.', when: (s) => s.owned[compIndex('shieldmaiden')] > 0 },
  { text: 'Stormcaller forecasts: lightning, with a chance of more lightning.', when: (s) => s.owned[compIndex('stormcaller')] > 0 },
  { text: 'The Plague Doctor keeps taking notes on the monsters. And on you.', when: (s) => s.owned[compIndex('doctor')] > 0 },
  { text: 'The Hollow Knight has not spoken once. Its pumpkin grinned wider today.', when: (s) => s.owned[compIndex('hollow')] > 0 },
  { text: 'The angel will not say what it fell from. Only what it fell toward.', when: (s) => s.owned[compIndex('angel')] > 0 },
  { text: 'The Turncoat Necromancer apologises to each monster before it dies.', when: (s) => s.owned[compIndex('necro')] > 0 },
  { text: 'Pebble the ogre has adopted a slug. Nobody has the heart to tell him.', when: (s) => s.owned[compIndex('ogre')] > 0 },
  { text: 'The demon keeps asking to renegotiate the contract.', when: (s) => s.owned[compIndex('demon')] > 0 },
  { text: 'A goblin was seen running off with a sack bigger than itself.', when: (s) => s.raids > 0 },
  { text: 'The goblins have started a union. It meets at the bottom of the dungeon.', when: (s) => s.raids > 10 },
  { text: 'Bards in the town above sing about you. The songs are getting darker.', when: (s) => s.kills > 1000 },
  { text: 'The monsters have begun leaving the stairs to you. Out of respect, or fear.', when: (s) => s.kills > 10000 },
  { text: 'Scratched into the wall, in your own handwriting: "Go deeper."', when: (s) => s.depth > 0 },
  { text: 'You could swear you have walked these floors before.', when: (s) => s.depth > 1 },
  { text: 'The drumbeat below is louder now. It sounds like a heart.', when: (s) => s.floor > 40 },
  { text: 'The walls are warm here. They pulse, very slightly.', when: (s) => s.floor > 70 },
  { text: 'Every boss you kill, the heartbeat below skips once.', when: (s) => s.floor > 100 },
  { text: 'Reminder: the dungeon is not a metaphor. Probably.' },
  { text: 'The torches flicker with every heartbeat below.' },
  { text: 'Your companions have started a betting pool on the next boss.' },
  { text: 'A monster surrendered today. It was killed anyway. Rules are rules.' },
];

export type RaidReward = 'plunder' | 'bloodlust' | 'heartstorm' | 'horde' | 'soulstorm' | 'vault' | 'rainbow';
