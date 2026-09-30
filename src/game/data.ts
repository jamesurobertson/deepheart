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
}

const c = (id: string, name: string, sprite: string, cost: number, dps: number, attack: Attack, flavor: string, depth = 0, big = false): CompDef =>
  ({ id, name, sprite, cost, dps, attack, flavor, depth, big });

/** Costs and damage follow the classic clicker curve: each companion ~5–8× the last. */
export const COMPS: CompDef[] = [
  c('squire', 'Squire', 'knight_m', 10, 1, 'slash', 'Carries your bags. Occasionally hits things with them.'),
  c('ranger', 'Ranger', 'elf_f', 60, 5, 'arrow', 'Never misses. Well, rarely. Well, sometimes.'),
  c('brawler', 'Dwarf Brawler', 'dwarf_m', 300, 22, 'slash', 'Came for the gold. Stayed for the punching.'),
  c('apprentice', 'Apprentice', 'wizzard_m', 1_500, 74, 'bolt', 'Knows exactly one spell. It is lightning. It is enough.'),
  c('hunter', 'Lizard Hunter', 'lizard_m', 7_000, 245, 'arrow', 'Can smell a monster through three floors of stone.'),
  c('shieldmaiden', 'Shieldmaiden', 'knight_f', 35_000, 976, 'slash', 'Her shield has killed more monsters than her sword.'),
  c('dancer', 'Blade Dancer', 'elf_m', 180_000, 3_725, 'slash', 'Fights like it is a performance. The monsters do not clap.'),
  c('runesmith', 'Runesmith', 'dwarf_f', 1e6, 10_859, 'rune', 'Carves runes into the floor. The floor explodes.'),
  c('stormcaller', 'Stormcaller', 'wizzard_f', 6e6, 47_143, 'storm', 'Brought her own weather. Down here, of all places.'),
  c('venomblade', 'Venomblade', 'lizard_f', 4e7, 186_000, 'dark', 'Every blade is poisoned. Every single one. She has a lot.'),
  c('doctor', 'Plague Doctor', 'doc', 3e8, 782_000, 'dark', 'Treats monsters with a strict regimen of dying.'),
  c('hollow', 'Hollow Knight', 'pumpkin_dude', 2.5e9, 3.7e6, 'fire', 'Nobody knows what is inside the pumpkin. Nobody asks.'),
  c('angel', 'Fallen Angel', 'angel', 2e10, 1.63e7, 'fire', 'Fell from somewhere bright. Landed swinging.', 1),
  c('necro', 'Turncoat Necromancer', 'necromancer', 1.8e11, 6.98e7, 'dark', 'Used to raise these monsters. Now it lowers them.', 2),
  c('ogre', 'Tamed Ogre', 'ogre', 1.6e12, 4.6e8, 'slash', 'Answers to "Pebble". Crushes whatever you point at.', 3, true),
  c('demon', 'Bound Demon', 'big_demon', 1.5e13, 3e9, 'fire', 'The contract is written in blood. Mostly the monsters\'.', 4, true),
];

// ---------- monsters and zones ----------

export interface MonsterDef {
  sprite: string;
  name: string;
  /** Health multiplier. */
  hp: number;
  big?: boolean;
  /** Colour wash for variants (frost trolls and the like), as 0xRRGGBB. */
  tint?: number;
}

const m = (sprite: string, name: string, hp = 1, tint?: number): MonsterDef => ({ sprite, name, hp, tint });

/** Tile theme a zone is built from (see the renderer). */
export type Tiles = 'halls' | 'crypt' | 'jungle' | 'tomb';

export interface ZoneDef {
  name: string;
  tiles: Tiles;
  /** Crowd for ordinary floors. */
  band: MonsterDef[];
  /** Guards floor 5 of the zone. */
  mid: MonsterDef;
  /** Guards floor 10: beat it to move on to the next zone. */
  boss: MonsterDef;
}

/**
 * Ten floors per zone, each with its own look, crowd and bosses. After the last one the
 * zones come round again, deeper and harder ("The Upper Halls II").
 */
export const ZONES: ZoneDef[] = [
  {
    name: 'The Upper Halls', tiles: 'halls',
    band: [m('goblin', 'Goblin', 0.9), m('tiny_zombie', 'Rotling'), m('imp', 'Imp', 0.8), m('tiny_slug', 'Slug', 1.2), m('ef_bandit', 'Bandit')],
    mid: m('ef_bear', 'Cave Bear'), boss: m('ogre', 'Ogre Chieftain'),
  },
  {
    name: 'The Bone Crypts', tiles: 'crypt',
    band: [m('skelet', 'Skeleton'), m('tiny_zombie', 'Rotling'), m('skelet', 'Bone Archer', 0.9), m('necromancer', 'Grave Priest', 0.9)],
    mid: m('ef_golem', 'Bone Golem', 1, 0xd8d0c0), boss: m('necromancer', 'The Lich', 1, 0xb0a0ff),
  },
  {
    name: 'The Overgrown Warrens', tiles: 'jungle',
    band: [m('orc_warrior', 'Orc Warrior', 1.2), m('orc_shaman', 'Orc Shaman', 0.9), m('ef_wolf', 'Dire Wolf'), m('ef_smallmushroom', 'Sporeling', 0.8), m('ef_normalmushroom', 'Mushroom Folk')],
    mid: m('ef_largemushroom', 'Elder Shroom'), boss: m('ef_troll', 'Troll Brute'),
  },
  {
    name: 'The Sunken Tomb', tiles: 'tomb',
    band: [m('ef_gnollscout', 'Gnoll Scout', 0.9), m('ef_gnollbrute', 'Gnoll Brute', 1.2), m('ef_gnollshaman', 'Gnoll Shaman'), m('masked_orc', 'Tomb Raider')],
    mid: m('ef_gnolloverseer', 'Gnoll Overseer'), boss: m('ef_golem', 'Tomb Golem'),
  },
  {
    name: 'The Rotting Deep', tiles: 'crypt',
    band: [m('zombie', 'Zombie', 1.1), m('slug', 'Great Slug', 1.3), m('swampy', 'Bog Lurker', 1.2), m('muddy', 'Mudling', 1.1)],
    mid: m('ogre', 'Bloated Ogre', 1, 0xa0c070), boss: m('big_zombie', 'The Rotten King'),
  },
  {
    name: 'The Enchanted Grove', tiles: 'jungle',
    band: [m('ef_centaur_m', 'Centaur'), m('ef_centaur_f', 'Centaur Archer', 0.9), m('ef_forestguardian', 'Grove Warden', 1.2), m('ef_wolf', 'Moon Wolf', 1, 0xc0c8ff)],
    mid: m('ef_bear', 'Grove Bear', 1, 0xd0ffd0), boss: m('ef_ent', 'The Elder Ent'),
  },
  {
    name: 'The Demon Gate', tiles: 'halls',
    band: [m('chort', 'Chort'), m('wogol', 'Wogol', 1.1), m('imp', 'Imp', 0.8), m('masked_orc', 'Cultist', 1.2)],
    mid: m('ogre', 'Hellfire Ogre', 1, 0xff9070), boss: m('big_demon', 'Pit Lord'),
  },
  {
    name: 'The Frozen Vault', tiles: 'halls',
    band: [m('ice_zombie', 'Frost Husk', 1.2), m('skelet', 'Frozen Skeleton', 1, 0xb0e0ff), m('ef_wolf', 'Frost Wolf', 1, 0xd0f0ff), m('necromancer', 'Rime Witch', 0.9, 0xa0d8ff)],
    mid: m('ef_golem', 'Ice Golem', 1, 0xa8e0ff), boss: m('ef_troll', 'Frost Troll', 1, 0xa8d8ff),
  },
];

/** Zone index for a floor (0-based, keeps counting past the last zone). */
export const zoneOf = (floor: number) => Math.floor((floor - 1) / 10);

export const zoneFor = (floor: number) => ZONES[zoneOf(floor) % ZONES.length];

/** "The Sunken Tomb", then "The Upper Halls II" once the zones come round again. */
export function zoneName(floor: number): string {
  const z = zoneOf(floor);
  const lap = Math.floor(z / ZONES.length);
  return ZONES[z % ZONES.length].name + (lap ? ` ${['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(lap - 1, 8)]}` : '');
}

export function bandFor(floor: number): MonsterDef[] {
  return zoneFor(floor).band;
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
  | { t: 'global'; pct: number }
  | { t: 'gold'; pct: number }
  | { t: 'crit'; chance?: number; mult?: number }
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
}

export type Req =
  | { t: 'owned'; comp: number; n: number }
  | { t: 'owned2'; a: number; b: number; n: number }
  | { t: 'floor'; n: number }
  | { t: 'raids'; n: number }
  | { t: 'trophies'; n: number }
  | { t: 'fevers'; n: number };

const TIER_AT = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];
const TIER_COST = [10, 60, 500, 5_000, 5e4, 1e6, 1e8, 1e10, 1e13, 1e17, 1e21];
const TIER_NAMES = ['Sharpened', 'Tempered', 'Veteran', 'Elite', 'Champion', 'Legendary', 'Mythic', 'Godforged', 'Abyssal', 'Eternal', 'Unmade'];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

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

const DPS_CLICK: [string, string, number, number][] = [
  ['Follow Through', 'weapon_mace', 10, 2_000],
  ['Battle Rhythm', 'weapon_hammer', 20, 5e6],
  ['Heavy Blows', 'weapon_big_hammer', 35, 5e9],
  ['Warlord\'s Arm', 'weapon_waraxe', 55, 5e13],
  ['Hand of Ruin', 'weapon_double_axe', 75, 5e18],
];

const RELICS: [string, string][] = [
  ['Lucky Coin', 'coin'], ['Blood Vial', 'flask_red'], ['Grave Moss', 'flask_green'], ['Bone Charm', 'skull'],
  ['Crypt Honey', 'flask_big_yellow'], ['Widow Venom', 'flask_big_green'], ['Heartsblood', 'flask_big_red'], ['Drowned Silver', 'flask_blue'],
  ['Moonless Ink', 'flask_big_blue'], ['Kingsgold', 'coin'], ['Screaming Salt', 'flask_red'], ['Starmarrow', 'flask_big_yellow'],
  ['Choir Ash', 'skull'], ['Witchglass', 'flask_big_blue'], ['Liquid Night', 'flask_big_green'], ['Oathbreaker Oil', 'flask_big_red'],
];

const SYNERGIES: [number, number, string][] = [
  [1, 4, 'Hunting Party'], [0, 5, 'Shield Wall'], [3, 8, 'Twin Storms'], [2, 7, 'Forge Brothers'],
  [6, 9, 'Blades in the Dark'], [10, 13, 'Plague and Grave'], [11, 12, 'Burning Halo'], [14, 15, 'Bound Together'],
];

const CRITS: [string, number, number, Effect][] = [
  ['Keen Eye', 5, 1_000, { t: 'crit', chance: 0.03 }],
  ['Vicious Strikes', 18, 1e6, { t: 'crit', mult: 2 }],
  ['Killer Instinct', 45, 1e12, { t: 'crit', chance: 0.05 }],
  ['Executioner', 70, 1e17, { t: 'crit', mult: 2 }],
];

const CLEAVES: [string, number, number, number][] = [
  ['Cleave', 12, 2e4, 0.25],
  ['Wide Swings', 30, 1e9, 0.25],
  ['Whirlwind', 50, 1e14, 0.5],
];

function buildUpgrades(): UpgDef[] {
  const out: UpgDef[] = [];
  COMPS.forEach((comp, i) => {
    TIER_AT.forEach((n, k) => {
      out.push({
        id: `c${i}t${k}`, name: `${TIER_NAMES[k]} ${comp.name}`,
        desc: `${comp.name} deals twice as much damage.`,
        cost: comp.cost * TIER_COST[k], icon: { sprite: comp.sprite, tier: k },
        effect: { t: 'comp', comp: i, mult: 2 }, req: { t: 'owned', comp: i, n },
      });
    });
  });
  CLICK_UPGS.forEach(([name, sprite, floor, cost], k) => {
    out.push({ id: `clk${k}`, name, desc: 'Your clicks deal twice as much damage.', cost, icon: { sprite }, effect: { t: 'click', mult: 2 }, req: { t: 'floor', n: floor } });
  });
  DPS_CLICK.forEach(([name, sprite, floor, cost], k) => {
    out.push({ id: `cd${k}`, name, desc: 'Each click also deals +5% of your companions\' damage per second.', cost, icon: { sprite }, effect: { t: 'clickDps', pct: 0.05 }, req: { t: 'floor', n: floor } });
  });
  CRITS.forEach(([name, floor, cost, effect], k) => out.push({
    id: `crit${k}`, name, desc: effect.t === 'crit' && effect.chance ? `+${Math.round(effect.chance * 100)}% chance to land a critical hit.` : 'Critical hits deal twice as much damage.',
    cost, icon: { sprite: 'weapon_katana', tier: k }, effect, req: { t: 'floor', n: floor },
  }));
  CLEAVES.forEach(([name, floor, cost, pct], k) => out.push({
    id: `clv${k}`, name, desc: `Clicks also hit every other monster for ${Math.round(pct * 100)}% damage.`,
    cost, icon: { sprite: 'weapon_double_axe', tier: k }, effect: { t: 'cleave', pct }, req: { t: 'floor', n: floor },
  }));
  RELICS.forEach(([name, sprite], k) => {
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
      desc: `${COMPS[a].name} +5% damage per ${COMPS[b].name} level. ${COMPS[b].name} +1% per ${COMPS[a].name} level.`,
      cost: Math.max(COMPS[a].cost, COMPS[b].cost) * 500, icon: { sprite: COMPS[a].sprite, sub: COMPS[b].sprite },
      effect: { t: 'syn', a, b }, req: { t: 'owned2', a, b, n: 25 },
    });
  });
  const raid: [string, string, number, number, Effect][] = [
    ['Goblin Bait', 'Treasure goblins show up twice as often.', 3, 7_777, { t: 'raid', freq: 2 }],
    ['Greedy Traps', 'Treasure goblins show up twice as often.', 17, 7.77e8, { t: 'raid', freq: 2 }],
    ['Trophy Heads', 'Treasure rewards last twice as long.', 47, 7.77e13, { t: 'raid', effect: 2 }],
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
    ['Unstoppable', 'Rampage makes clicks ×10 instead of ×5.', 15, 5e12, { t: 'fever', power: 2 }],
  ];
  fever.forEach(([name, desc, n, cost, effect], k) => out.push({ id: `fev${k}`, name, desc, cost, icon: { sprite: 'flask_big_red', tier: k }, effect, req: { t: 'fevers', n } }));
  return out;
}

export const UPGRADES = buildUpgrades();
export const UPG_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

// ---------- abyss (prestige) ----------

export interface AbyssDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  icon: string;
  needs?: string[];
}

export const ABYSS: AbyssDef[] = [
  { id: 'pulse', name: 'Restless Dead', desc: 'Offline progress 25% → 50%.', cost: 5, icon: 'skull' },
  { id: 'twin', name: 'Twin Blades', desc: 'Clicks deal twice as much damage.', cost: 10, icon: 'weapon_duel_sword' },
  { id: 'heirloom', name: 'Old Friends', desc: 'Start each descent with Squire and Ranger at level 10.', cost: 15, icon: 'knight_m', needs: ['pulse'] },
  { id: 'hands', name: 'Phantom Blade', desc: 'A ghostly blade clicks for you 3 times a second.', cost: 25, icon: 'weapon_knife', needs: ['twin'] },
  { id: 'lure', name: 'Scent of Gold', desc: 'Treasure goblins show up 25% more often.', cost: 40, icon: 'coin', needs: ['twin'] },
  { id: 'bargain', name: 'Dark Bargain', desc: 'Upgrades cost 10% less.', cost: 60, icon: 'flask_big_red', needs: ['heirloom'] },
  { id: 'tithe', name: 'Mercenary Guild', desc: 'Companions cost 10% less.', cost: 100, icon: 'coin', needs: ['heirloom'] },
  { id: 'dreams', name: 'Endless Rage', desc: 'Rampage fills 50% faster and lasts 50% longer.', cost: 150, icon: 'flask_big_yellow', needs: ['hands'] },
  { id: 'skip', name: 'Deep Stairs', desc: 'Start each descent on floor 10.', cost: 200, icon: 'floor_stairs', needs: ['heirloom'] },
  { id: 'night', name: 'Endless Night', desc: 'Offline progress 50% → 100%.', cost: 250, icon: 'flask_big_blue', needs: ['pulse', 'bargain'] },
  { id: 'mimic', name: 'Mimic Chests', desc: 'Treasure can hold a Soul Storm: damage ×666 for 6 seconds.', cost: 400, icon: 'chest_mimic_open', needs: ['lure'] },
  { id: 'patience', name: 'Patient Hunter', desc: 'Bosses give you 45 seconds instead of 30.', cost: 500, icon: 'ogre', needs: ['skip'] },
  { id: 'roots', name: 'Deep Roots', desc: 'Each soul gives +3% damage instead of +2%.', cost: 700, icon: 'flask_big_green', needs: ['tithe', 'night'] },
  { id: 'hands2', name: 'Blade Storm', desc: 'Phantom Blade clicks 10 times a second.', cost: 1500, icon: 'weapon_golden_sword', needs: ['dreams', 'roots'] },
  { id: 'crown', name: 'Crown of the Deep', desc: 'Each soul gives +4% damage instead of +3%.', cost: 5000, icon: 'weapon_red_gem_sword', needs: ['hands2', 'mimic', 'patience'] },
];
export const ABYSS_BY_ID = new Map(ABYSS.map((a) => [a.id, a]));

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
  | { t: 'missed'; n: number };

export interface TrophyDef {
  id: string;
  name: string;
  desc: string;
  icon: Icon;
  req: TrophyReq;
}

const FLOOR_NAMES = ['Into the Dark', 'Down the Stairs', 'Deeper', 'Where Torches Fail', 'Bone Deep', 'The Long Descent', 'Lightless', 'The Underneath', 'Below Below', 'Heartland', 'No Way Back', 'The Bottom?', 'There Is No Bottom'];
const FLOOR_AT = [5, 10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500];
const GOLD_NAMES = ['Pocket Change', 'Coin Purse', 'Strongbox', 'Treasury', 'Dragon Hoard', 'Kingdom\'s Ransom', 'Empire\'s Gold', 'Gold Mountain', 'Sea of Gold', 'World of Gold', 'Starfall Gold', 'Beyond Counting'];
const OWN_AT = [1, 25, 100, 200, 300, 500];
const OWN_TITLES = ['Hired:', 'Loyal', 'Veteran', 'Legendary', 'Mythic', 'Eternal'];

function buildTrophies(): TrophyDef[] {
  const out: TrophyDef[] = [];
  FLOOR_AT.forEach((n, k) => out.push({ id: `fl${k}`, name: FLOOR_NAMES[k], desc: `Reach floor ${n}.`, icon: { sprite: 'floor_stairs', tier: Math.min(k, 10) }, req: { t: 'floor', n } }));
  GOLD_NAMES.forEach((name, k) => {
    const n = 10 ** (2 + k * 4);
    out.push({ id: `gold${k}`, name, desc: `Collect ${n.toLocaleString('en-US')} gold in total.`, icon: { sprite: 'coin', tier: Math.min(k, 10) }, req: { t: 'gold', n } });
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
  [1, 3, 10, 25, 50].forEach((n, k) => out.push({ id: `desc${k}`, name: ['Going Down', 'Deeper Still', 'Bottomless', 'Where Light Ends', 'The Deep'][k], desc: `Descend ${n} time${n > 1 ? 's' : ''}.`, icon: { sprite: 'floor_ladder', tier: k }, req: { t: 'descents', n } }));
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
  [10, 1e3, 1e6, 1e9, 1e12, 1e15, 1e18, 1e21].forEach((n, k) => out.push({ id: `dps${k}`, name: ['Scrapper', 'Fighter', 'Warrior', 'Warlord', 'Army', 'Legion', 'Cataclysm', 'Apocalypse'][k], desc: `Reach ${n.toLocaleString('en-US')} damage per second.`, icon: { sprite: 'weapon_waraxe', tier: k }, req: { t: 'dps', n } }));
  return out;
}

export const TROPHIES = buildTrophies();

// ---------- cursors ----------

export interface CursorDef {
  id: string;
  name: string;
  /** Sprite to draw; 'auto' follows your best click upgrade. */
  sprite: string;
  /** Trophy that unlocks it (none = always available). */
  trophy?: string;
}

/** Cursor skins, each unlocked by a trophy. Changed in Options. */
export const CURSORS: CursorDef[] = [
  { id: 'auto', name: 'Your Blade', sprite: 'auto' },
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
  { text: 'Your Squire asks if the dungeon has a bottom. You do not answer.', when: (s) => s.owned[0] > 0 },
  { text: 'The Ranger has started keeping a tally on the wall. The wall is full.', when: (s) => s.owned[1] > 10 },
  { text: 'The dwarf insists on punching the bosses personally.', when: (s) => s.owned[2] > 0 },
  { text: 'The Apprentice set his own beard on fire again. It still counts as damage.', when: (s) => s.owned[3] > 0 },
  { text: 'The Lizard Hunter claims she can hear the dungeon breathing.', when: (s) => s.owned[4] > 0 },
  { text: 'Shieldmaiden reports the shield is "fine". It is mostly dents now.', when: (s) => s.owned[5] > 0 },
  { text: 'Stormcaller forecasts: lightning, with a chance of more lightning.', when: (s) => s.owned[8] > 0 },
  { text: 'The Plague Doctor keeps taking notes on the monsters. And on you.', when: (s) => s.owned[10] > 0 },
  { text: 'The Hollow Knight has not spoken once. Its pumpkin grinned wider today.', when: (s) => s.owned[11] > 0 },
  { text: 'The angel will not say what it fell from. Only what it fell toward.', when: (s) => s.owned[12] > 0 },
  { text: 'The Turncoat Necromancer apologises to each monster before it dies.', when: (s) => s.owned[13] > 0 },
  { text: 'Pebble the ogre has adopted a slug. Nobody has the heart to tell him.', when: (s) => s.owned[14] > 0 },
  { text: 'The demon keeps asking to renegotiate the contract.', when: (s) => s.owned[15] > 0 },
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
  { text: 'The torches flicker in time with something.' },
  { text: 'Your companions have started a betting pool on the next boss.' },
  { text: 'A monster surrendered today. It was killed anyway. Rules are rules.' },
];

export type RaidReward = 'plunder' | 'bloodlust' | 'heartstorm' | 'horde' | 'soulstorm';
