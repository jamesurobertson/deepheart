/** Everything talents can change. Multipliers start at 1, additive stats at 0. */
export interface Mods {
  damage: number;
  hp: number;
  guard: number;
  aps: number;
  move: number;
  crit: number;
  gold: number;
  xp: number;
  itemFind: number;
  sigCooldown: number;
  hordeSize: number;
  streakDamage: number; // bonus damage per kill in the current streak
  leech: number;
  inherit: number;
  offline: number; // extra hours of offline cap
  startDepth: number;
  heirloom: boolean;
  heroXp: number;
  startLevel: number;
  skillDamage: number;
}

export const baseMods = (): Mods => ({
  damage: 1, hp: 1, guard: 1, aps: 1, move: 1, crit: 0, gold: 1, xp: 1, itemFind: 1, sigCooldown: 1,
  hordeSize: 1, streakDamage: 0, leech: 0, inherit: 0, offline: 0, startDepth: 0, heirloom: false,
  heroXp: 1, startLevel: 1, skillDamage: 1,
});

export interface Talent {
  id: string;
  name: string;
  desc: (rank: number) => string;
  max: number;
  cost: (rank: number) => number;
  requires: string[]; // any one of these must have at least 1 rank
  /** Grid position in the tree view. */
  at: [number, number];
  apply: (m: Mods, rank: number) => void;
  kind?: 'hero' | 'keystone';
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const T = (t: Talent) => t;

export const TALENTS: Talent[] = [
  // Center
  T({ id: 'might', name: 'Might', max: 5, at: [3, 2], requires: [], cost: (r) => 1 + r, desc: (r) => `+${pct(0.3 * r)} damage`, apply: (m, r) => { m.damage *= 1 + 0.3 * r; } }),
  T({ id: 'vigor', name: 'Vigor', max: 5, at: [5, 2], requires: [], cost: (r) => 1 + r, desc: (r) => `+${pct(0.3 * r)} health`, apply: (m, r) => { m.hp *= 1 + 0.3 * r; } }),
  // Offense
  T({ id: 'fury', name: 'Fury', max: 5, at: [2, 3], requires: ['might'], cost: (r) => 2 + r, desc: (r) => `+${pct(0.1 * r)} attack speed`, apply: (m, r) => { m.aps *= 1 + 0.1 * r; } }),
  T({ id: 'deadeye', name: 'Deadeye', max: 3, at: [2, 1], requires: ['might'], cost: (r) => 2 + r * 2, desc: (r) => `+${pct(0.05 * r)} crit chance`, apply: (m, r) => { m.crit += 0.05 * r; } }),
  T({ id: 'bloodlust', name: 'Bloodlust', kind: 'keystone', max: 3, at: [1, 3], requires: ['fury'], cost: (r) => 5 + r * 4, desc: (r) => `Each kill in a streak adds +${(0.5 * r).toFixed(1)}% damage until the streak ends`, apply: (m, r) => { m.streakDamage += 0.005 * r; } }),
  T({ id: 'cataclysm', name: 'Cataclysm', kind: 'keystone', max: 3, at: [2, 4], requires: ['fury'], cost: (r) => 4 + r * 3, desc: (r) => `Skills recharge ${pct(0.2 * r)} faster`, apply: (m, r) => { m.sigCooldown *= 1 - 0.2 * r; } }),
  // Survival
  T({ id: 'bulwark', name: 'Bulwark', max: 5, at: [6, 3], requires: ['vigor'], cost: (r) => 2 + r, desc: (r) => `+${pct(0.4 * r)} guard`, apply: (m, r) => { m.guard *= 1 + 0.4 * r; } }),
  T({ id: 'leech', name: 'Leech', max: 3, at: [6, 1], requires: ['vigor'], cost: (r) => 3 + r * 2, desc: (r) => `Heal for ${(0.5 * r).toFixed(1)}% of damage dealt`, apply: (m, r) => { m.leech += 0.005 * r; } }),
  T({ id: 'swift', name: 'Swift Feet', max: 3, at: [7, 3], requires: ['bulwark'], cost: (r) => 3 + r * 2, desc: (r) => `+${pct(0.2 * r)} movement speed`, apply: (m, r) => { m.move *= 1 + 0.2 * r; } }),
  T({ id: 'horde', name: 'Horde Master', kind: 'keystone', max: 3, at: [6, 4], requires: ['bulwark'], cost: (r) => 5 + r * 4, desc: (r) => `Hordes are ${pct(0.35 * r)} bigger`, apply: (m, r) => { m.hordeSize *= 1 + 0.35 * r; } }),
  // Greed & progression
  T({ id: 'greed', name: 'Greed', max: 5, at: [4, 3], requires: ['might', 'vigor'], cost: (r) => 2 + r, desc: (r) => `+${pct(0.4 * r)} gold`, apply: (m, r) => { m.gold *= 1 + 0.4 * r; } }),
  T({ id: 'treasure', name: 'Treasure Sense', max: 5, at: [4, 4], requires: ['greed'], cost: (r) => 3 + r * 2, desc: (r) => `+${pct(0.2 * r)} item find`, apply: (m, r) => { m.itemFind *= 1 + 0.2 * r; } }),
  T({ id: 'insight', name: 'Insight', max: 3, at: [3, 4], requires: ['greed'], cost: (r) => 3 + r * 2, desc: (r) => `+${pct(0.5 * r)} gear experience`, apply: (m, r) => { m.xp *= 1 + 0.5 * r; } }),
  T({ id: 'legacy', name: 'Legacy', max: 3, at: [3, 5], requires: ['insight'], cost: (r) => 4 + r * 3, desc: (r) => `New gear inherits +${pct(0.1 * r)} more levels`, apply: (m, r) => { m.inherit += 0.1 * r; } }),
  T({ id: 'headstart', name: 'Head Start', max: 4, at: [5, 4], requires: ['greed'], cost: (r) => 4 + r * 4, desc: (r) => `Start each run at stage ${1 + 5 * r}`, apply: (m, r) => { m.startDepth += 5 * r; } }),
  T({ id: 'heirloom', name: 'Heirloom', kind: 'keystone', max: 1, at: [4, 5], requires: ['treasure'], cost: () => 15, desc: () => 'Keep your equipped weapon through rebirth', apply: (m) => { m.heirloom = true; } }),
  T({ id: 'dreams', name: 'Idle Dreams', max: 2, at: [5, 5], requires: ['headstart'], cost: (r) => 6 + r * 6, desc: (r) => `Offline rewards build up for ${12 + 6 * r}h instead of 12h`, apply: (m, r) => { m.offline += 6 * r; } }),
  // Hero growth
  T({ id: 'scholar', name: 'Scholar', max: 3, at: [2, 0], requires: ['deadeye'], cost: (r) => 4 + r * 3, desc: (r) => `+${pct(0.4 * r)} hero experience`, apply: (m, r) => { m.heroXp *= 1 + 0.4 * r; } }),
  T({ id: 'veteran', name: 'Veteran', max: 3, at: [6, 0], requires: ['leech'], cost: (r) => 5 + r * 4, desc: (r) => `Start each run at hero level ${1 + 6 * r}`, apply: (m, r) => { m.startLevel += 6 * r; } }),
  T({ id: 'prodigy', name: 'Prodigy', kind: 'keystone', max: 3, at: [4, 0], requires: ['scholar', 'veteran'], cost: (r) => 8 + r * 6, desc: (r) => `Skills deal +${pct(0.35 * r)} damage`, apply: (m, r) => { m.skillDamage *= 1 + 0.35 * r; } }),
];

export const TALENT = Object.fromEntries(TALENTS.map((t) => [t.id, t])) as Record<string, Talent>;

export function computeMods(ranks: Record<string, number>): Mods {
  const m = baseMods();
  for (const t of TALENTS) {
    const r = ranks[t.id] ?? 0;
    if (r > 0) t.apply(m, r);
  }
  return m;
}

export function available(t: Talent, ranks: Record<string, number>): boolean {
  return t.requires.length === 0 || t.requires.some((id) => (ranks[id] ?? 0) > 0);
}

/** Soul shards earned by rebirthing after unlocking stage `maxStage`. */
export function shardsFor(maxStage: number): number {
  return maxStage < REBIRTH_MIN ? 0 : Math.floor(((maxStage - 10) / 5) ** 1.45);
}

export const REBIRTH_MIN = 21;
