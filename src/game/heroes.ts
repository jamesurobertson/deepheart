/**
 * Playable classes. Each has a basic attack plus skills that unlock as the hero
 * levels. Skills are data: the sim runs the effect, the renderer draws `fx`.
 */
export type HeroId = 'knight' | 'wizard' | 'ranger' | 'dwarf';

export type SkillFx =
  | 'shockwave' | 'charge' | 'warcry' | 'whirlwind'
  | 'meteor' | 'lightning' | 'frost' | 'blizzard'
  | 'rain' | 'pierce' | 'hawkeye' | 'barrage'
  | 'quake' | 'slam' | 'ironskin' | 'avalanche';

export type Effect =
  /** Damage everything within `radius` of the hero, optionally over several ticks. */
  | { type: 'nova'; radius: number; mult: number; ticks?: number; every?: number; heal?: number; slow?: number }
  /** Damage around the densest crowd nearby, after `delay`, optionally in ticks. */
  | { type: 'blast'; radius: number; mult: number; delay: number; ticks?: number; every?: number }
  /** Dash forward, hitting everything in the path. */
  | { type: 'dash'; dist: number; mult: number }
  /** Temporary boosts. */
  | { type: 'buff'; dur: number; dmg?: number; aps?: number; crit?: number; dr?: number }
  /** Fire projectiles at the nearest target; several volleys if `volleys` > 1. */
  | { type: 'shot'; count: number; spread: number; pierce: number; mult: number; speed: number; volleys?: number; every?: number }
  /** Lightning that jumps between enemies. */
  | { type: 'chain'; bounces: number; mult: number };

export interface Skill {
  id: string;
  name: string;
  level: number; // hero level that unlocks it
  cooldown: number; // 0 = passive
  desc: string;
  icon: string; // 0x72 sprite name, or 'sheet:col:row' for a 16×16 icon sheet cell
  fx?: SkillFx;
  effect?: Effect;
  /** Passive bonuses (multipliers). */
  passive?: { damage?: number; hp?: number; guard?: number; critMult?: number; pierce?: number };
}

export interface HeroKit {
  id: HeroId;
  name: string;
  role: string;
  blurb: string;
  sprite: string;
  attack: 'sweep' | 'bolt' | 'arrows';
  /** Sweep radius for melee; firing range for ranged heroes. */
  reach: number;
  aps: number;
  hp: number;
  damage: number;
  guard: number;
  /** Weapon sprite drawn in hand for ranged classes (melee classes show the equipped weapon). */
  heldSprite?: string;
  skills: Skill[];
}

export const HEROES: Record<HeroId, HeroKit> = {
  knight: {
    id: 'knight', name: 'Knight', role: 'Melee · all-rounder', blurb: 'Carves through crowds and slams the ground.',
    sprite: 'knight_m', attack: 'sweep', reach: 2.3, aps: 2, hp: 1, damage: 1, guard: 1,
    skills: [
      { id: 'shockwave', name: 'Shockwave', level: 1, cooldown: 4, icon: 'weapons-steel:21:12', fx: 'shockwave', desc: 'Slam for 300% damage to everything within 5 tiles.', effect: { type: 'nova', radius: 5, mult: 3 } },
      { id: 'charge', name: 'Charge', level: 8, cooldown: 6, icon: 'weapons-steel:4:3', fx: 'charge', desc: 'Dash 6 tiles forward, dealing 250% to everything in the way.', effect: { type: 'dash', dist: 6, mult: 2.5 } },
      { id: 'warcry', name: 'Battle Cry', level: 15, cooldown: 16, icon: 'wall_banner_red', fx: 'warcry', desc: '+50% damage and +25% attack speed for 6s.', effect: { type: 'buff', dur: 6, dmg: 0.5, aps: 0.25 } },
      { id: 'whirlwind', name: 'Whirlwind', level: 25, cooldown: 9, icon: 'weapons-steel:1:11', fx: 'whirlwind', desc: 'Spin for 2s: 8 hits of 100% around you.', effect: { type: 'nova', radius: 3.2, mult: 1, ticks: 8, every: 0.25 } },
      { id: 'juggernaut', name: 'Juggernaut', level: 40, cooldown: 0, icon: 'ui_heart_full', desc: 'Passive: +40% health and +25% damage.', passive: { hp: 0.4, damage: 0.25 } },
      { id: 'titan', name: 'Titan Slam', level: 60, cooldown: 12, icon: 'skull', fx: 'shockwave', desc: 'A colossal slam: 1200% damage within 8 tiles.', effect: { type: 'nova', radius: 8, mult: 12 } },
    ],
  },
  wizard: {
    id: 'wizard', name: 'Wizard', role: 'Ranged · crowd control', blurb: 'Exploding bolts, meteors and storms.',
    sprite: 'wizzard_m', attack: 'bolt', reach: 7, aps: 1.6, hp: 0.75, damage: 1.2, guard: 0.6, heldSprite: 'weapon_red_magic_staff',
    skills: [
      { id: 'meteor', name: 'Meteor', level: 1, cooldown: 5, icon: 'flask_big_red', fx: 'meteor', desc: 'Drop a meteor on the biggest crowd: 600% damage.', effect: { type: 'blast', radius: 3.4, mult: 6, delay: 0.55 } },
      { id: 'lightning', name: 'Chain Lightning', level: 8, cooldown: 4, icon: 'flask_big_blue', fx: 'lightning', desc: 'Lightning jumps between 8 enemies for 180% each.', effect: { type: 'chain', bounces: 8, mult: 1.8 } },
      { id: 'frost', name: 'Frost Nova', level: 15, cooldown: 8, icon: 'flask_blue', fx: 'frost', desc: '250% damage within 5 tiles and slows enemies for 3s.', effect: { type: 'nova', radius: 5, mult: 2.5, slow: 3 } },
      { id: 'blizzard', name: 'Blizzard', level: 25, cooldown: 12, icon: 'flask_big_green', fx: 'blizzard', desc: 'Ice storm on a crowd: 10 hits of 120%.', effect: { type: 'blast', radius: 4.5, mult: 1.2, delay: 0.3, ticks: 10, every: 0.2 } },
      { id: 'arcane', name: 'Arcane Mastery', level: 40, cooldown: 0, icon: 'flask_big_yellow', desc: 'Passive: +30% damage and +1.0 crit multiplier.', passive: { damage: 0.3, critMult: 1 } },
      { id: 'armageddon', name: 'Armageddon', level: 60, cooldown: 14, icon: 'bomb_f0', fx: 'meteor', desc: 'Five meteors rain down: 5 × 500% damage.', effect: { type: 'blast', radius: 3.6, mult: 5, delay: 0.5, ticks: 5, every: 0.3 } },
    ],
  },
  ranger: {
    id: 'ranger', name: 'Ranger', role: 'Ranged · rapid fire', blurb: 'Piercing volleys from a safe distance.',
    sprite: 'elf_m', attack: 'arrows', reach: 8, aps: 1.8, hp: 0.8, damage: 0.8, guard: 0.8, heldSprite: 'weapon_bow',
    skills: [
      { id: 'rain', name: 'Arrow Rain', level: 1, cooldown: 5, icon: 'items:4:3', fx: 'rain', desc: 'Arrows fall on a crowd: 4 hits of 140%.', effect: { type: 'blast', radius: 3.2, mult: 1.4, delay: 0.3, ticks: 4, every: 0.25 } },
      { id: 'pierce', name: 'Piercing Shot', level: 8, cooldown: 5, icon: 'items:4:6', fx: 'pierce', desc: 'A shot that passes through everything for 400%.', effect: { type: 'shot', count: 1, spread: 0, pierce: 99, mult: 4, speed: 24 } },
      { id: 'hawkeye', name: 'Hawk Eye', level: 15, cooldown: 16, icon: 'flask_green', fx: 'hawkeye', desc: '+25% crit chance and +40% attack speed for 6s.', effect: { type: 'buff', dur: 6, crit: 0.25, aps: 0.4 } },
      { id: 'barrage', name: 'Barrage', level: 25, cooldown: 10, icon: 'items:3:2', fx: 'barrage', desc: 'Loose 12 volleys of 3 arrows in 1.2s.', effect: { type: 'shot', count: 3, spread: 0.2, pierce: 2, mult: 0.9, speed: 20, volleys: 12, every: 0.1 } },
      { id: 'deadly', name: 'Deadly Aim', level: 40, cooldown: 0, icon: 'items:3:6', desc: 'Passive: arrows pierce 4 more enemies; +20% damage.', passive: { pierce: 4, damage: 0.2 } },
      { id: 'storm', name: 'Storm of Arrows', level: 60, cooldown: 12, icon: 'items:4:2', fx: 'rain', desc: 'Blot out the sky: 16 hits of 150% over a wide area.', effect: { type: 'blast', radius: 6, mult: 1.5, delay: 0.3, ticks: 16, every: 0.12 } },
    ],
  },
  dwarf: {
    id: 'dwarf', name: 'Dwarf', role: 'Melee · tank', blurb: 'A walking wall whose quakes heal him.',
    sprite: 'dwarf_m', attack: 'sweep', reach: 2, aps: 1.5, hp: 1.8, damage: 1.05, guard: 1.6,
    skills: [
      { id: 'quake', name: 'Earthquake', level: 1, cooldown: 5, icon: 'weapons-steel:22:14', fx: 'quake', desc: '250% damage within 6.5 tiles; heal 6% health.', effect: { type: 'nova', radius: 6.5, mult: 2.5, heal: 0.06 } },
      { id: 'slam', name: 'Ground Slam', level: 8, cooldown: 6, icon: 'weapons-steel:21:16', fx: 'slam', desc: 'Leap onto the biggest crowd for 500%.', effect: { type: 'blast', radius: 3, mult: 5, delay: 0.35 } },
      { id: 'ironskin', name: 'Iron Skin', level: 15, cooldown: 16, icon: 'flask_big_yellow', fx: 'ironskin', desc: 'Take 60% less damage for 8s.', effect: { type: 'buff', dur: 8, dr: 0.6 } },
      { id: 'avalanche', name: 'Avalanche', level: 25, cooldown: 12, icon: 'weapons-steel:0:12', fx: 'avalanche', desc: 'Three quakes in a row: 3 × 250% within 7 tiles.', effect: { type: 'nova', radius: 7, mult: 2.5, ticks: 3, every: 0.5 } },
      { id: 'mountain', name: 'Mountain Heart', level: 40, cooldown: 0, icon: 'ui_heart_full', desc: 'Passive: +60% health and +40% guard.', passive: { hp: 0.6, guard: 0.4 } },
      { id: 'worldbreaker', name: 'Worldbreaker', level: 60, cooldown: 14, icon: 'skull', fx: 'avalanche', desc: 'Split the earth: 6 × 400% across the whole screen.', effect: { type: 'nova', radius: 11, mult: 4, ticks: 6, every: 0.35 } },
    ],
  },
};

export const HERO_IDS = Object.keys(HEROES) as HeroId[];

/** Hero XP needed to go from `level` to `level + 1`. */
export function heroXpToNext(level: number): number {
  return Math.round(45 * 1.16 ** level);
}
