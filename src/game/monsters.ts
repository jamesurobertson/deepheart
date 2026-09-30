/**
 * Monster roster by depth band. `sprite` is the 0x72 sprite base name; the renderer
 * looks up `${sprite}_idle_anim` / `${sprite}_run_anim`, falling back to `${sprite}_anim`.
 */
export interface MonsterKind {
  sprite: string;
  name: string;
  hp: number; // multiplier on depth-scaled health
  dmg: number;
  speed: number;
  big?: boolean;
  /** caster: keeps distance and lobs orbs; charger: lunges when close. */
  ai?: 'caster' | 'charger';
}

const M = (sprite: string, name: string, hp: number, dmg: number, speed: number, big = false, ai?: MonsterKind['ai']): MonsterKind => ({ sprite, name, hp, dmg, speed, big, ai });

const BANDS: MonsterKind[][] = [
  [M('goblin', 'Goblin', 0.8, 0.9, 2.6), M('imp', 'Imp', 0.7, 1.1, 3, false, 'charger'), M('tiny_zombie', 'Rotling', 1, 0.8, 1.8), M('tiny_slug', 'Slug', 1.2, 0.6, 1.4)],
  [M('skelet', 'Skeleton', 0.9, 1, 2.4), M('masked_orc', 'Masked Orc', 1.2, 1.1, 2), M('swampy', 'Bog Lurker', 1.3, 0.8, 1.6), M('muddy', 'Mudling', 1.1, 0.9, 1.8)],
  [M('orc_warrior', 'Orc Warrior', 1.3, 1.2, 2), M('orc_shaman', 'Orc Shaman', 0.9, 1.4, 2, false, 'caster'), M('zombie', 'Zombie', 1.4, 0.9, 1.5), M('slug', 'Great Slug', 1.6, 0.8, 1.2)],
  [M('necromancer', 'Necromancer', 1, 1.5, 1.8, false, 'caster'), M('wogol', 'Wogol', 1.2, 1.2, 2.4, false, 'charger'), M('chort', 'Chort', 1.1, 1.3, 2.8, false, 'charger'), M('ice_zombie', 'Frost Husk', 1.5, 1, 1.5)],
];

const BOSSES: MonsterKind[] = [
  M('ogre', 'Ogre Chieftain', 1, 1, 1.4, true),
  M('big_zombie', 'The Rotten King', 1, 1, 1.2, true),
  M('big_demon', 'Pit Lord', 1, 1, 1.6, true),
];

export function bandFor(floor: number): MonsterKind[] {
  const i = Math.floor((floor - 1) / 10);
  // Past the authored bands, mix neighbouring bands so deep floors keep variety.
  return i < BANDS.length ? BANDS[i] : [...BANDS[i % BANDS.length], ...BANDS[(i + 1) % BANDS.length]];
}

export function bossFor(floor: number): MonsterKind {
  return BOSSES[(Math.floor(floor / 10) - 1 + BOSSES.length) % BOSSES.length];
}
