import { pct } from './format.ts';

export type Slot = 'weapon' | 'helm' | 'shield' | 'relic';
export const SLOTS: Slot[] = ['weapon', 'helm', 'shield', 'relic'];
export const SLOT_LABEL: Record<Slot, string> = { weapon: 'Weapon', helm: 'Helm', shield: 'Shield', relic: 'Relic' };

export type AffixId =
  | 'chain' | 'cleave' | 'double' | 'execute' | 'ferocity'
  | 'thorns' | 'regen' | 'fortify' | 'lifesteal'
  | 'luck' | 'wisdom' | 'overcharge' | 'haste';

export interface Awakening {
  level: number;
  affix: AffixId;
  value: number;
}

/** Where an item's 16×16 icon lives. `sheet` is a file in /assets/icons. */
export interface IconRef {
  sheet: string;
  col: number;
  row: number;
}

/**
 * Living gear: power grows with level up to `cap`. Everything about an item is
 * visible up front; the decision is whether its growth beats what you wear.
 */
export interface Item {
  id: number;
  slot: Slot;
  name: string;
  /** Weapon family / base type (drives the hero's in-world weapon sprite). */
  kind: string;
  rarity: number; // 0..4
  ilvl: number;
  base: number;
  growth: number;
  cap: number;
  awakenings: Awakening[];
  level: number;
  xp: number;
  icon: IconRef;
  fresh?: boolean; // not yet looked at in the bag
}

export const RARITY_NAMES = ['Common', 'Magic', 'Rare', 'Epic', 'Legendary'];
export const RARITY_COLORS = ['#c2b8a3', '#5fa8ff', '#ffd23f', '#c77dff', '#ff8a3d'];
const RARITY_WEIGHTS = [55, 28, 12, 4, 1];
const GROWTH_RANGE: [number, number][] = [[0.02, 0.05], [0.03, 0.06], [0.04, 0.075], [0.05, 0.09], [0.065, 0.11]];
const CAP_RANGE: [number, number][] = [[8, 25], [12, 35], [18, 55], [25, 80], [40, 120]];
const BASE_MULT = [1, 1.15, 1.3, 1.5, 1.8];
const SLOT_BASE: Record<Slot, number> = { weapon: 6, helm: 60, shield: 1.6, relic: 10 };

export const ILVL_SCALE = 1.15;
export const AWAKEN_LEVELS = [10, 25, 50, 100];

interface AffixInfo {
  name: string;
  base: number;
  desc: (v: number) => string;
}

export const AFFIXES: Record<AffixId, AffixInfo> = {
  chain: { name: 'Chain Lightning', base: 2, desc: (v) => `Hits arc to ${Math.round(v)} more enemies for 50% damage` },
  cleave: { name: 'Cleave', base: 0.4, desc: (v) => `Deal ${pct(v)} damage to every enemy in reach` },
  double: { name: 'Twin Strike', base: 0.25, desc: (v) => `${pct(v)} chance to strike twice` },
  execute: { name: 'Executioner', base: 0.12, desc: (v) => `Slay enemies below ${pct(v)} health instantly` },
  ferocity: { name: 'Ferocity', base: 0.5, desc: (v) => `+${pct(v)} damage` },
  thorns: { name: 'Thorns', base: 1, desc: (v) => `Reflect ${pct(v)} of weapon damage to attackers` },
  regen: { name: 'Renewal', base: 0.03, desc: (v) => `Regenerate ${pct(v, 1)} of max health per second` },
  fortify: { name: 'Bulwark', base: 0.4, desc: (v) => `+${pct(v)} max health` },
  lifesteal: { name: 'Bloodthirst', base: 0.03, desc: (v) => `Heal for ${pct(v, 1)} of damage dealt` },
  luck: { name: 'Fortune', base: 0.3, desc: (v) => `+${pct(v)} chance to find items` },
  wisdom: { name: 'Wisdom', base: 0.4, desc: (v) => `+${pct(v)} gear experience` },
  overcharge: { name: 'Overcharge', base: 0.25, desc: (v) => `${pct(v)} of crits become MEGA crits (×3)` },
  haste: { name: 'Haste', base: 0.25, desc: (v) => `+${pct(v)} attack speed` },
};

const AFFIX_POOL: Record<Slot, AffixId[]> = {
  weapon: ['chain', 'cleave', 'double', 'execute', 'ferocity'],
  helm: ['fortify', 'regen', 'wisdom'],
  shield: ['thorns', 'lifesteal', 'fortify'],
  relic: ['luck', 'overcharge', 'haste'],
};

// ---------- icons & names ----------

/** Shade's weapon sheets: 16 families in 3×10 blocks (top half, then bottom half). */
export const WEAPON_KINDS = [
  'Rapier', 'Sword', 'Greatsword', 'Katana', 'Scimitar', 'Spear', 'Staff', 'Morningstar',
  'Axe', 'Club', 'Knife', 'Cleaver', 'Scythe', 'Sickle', 'Flail', 'Hammer',
];
const METALS = ['bronze', 'iron', 'steel', 'gold'];
/** ScratchIO item sheet: rows 0-6 are material tiers (wood, iron, red, blue, green, cyan, gold). */
const TIER_NAMES = ['Oaken', 'Iron', 'Crimson', 'Azure', 'Verdant', 'Glacial', 'Gilded'];
const HELM_NAMES = ['Helm', 'Visor', 'Greathelm', 'Barbute'];
const SHIELD_NAMES = ['Shield', 'Kite Shield', 'Buckler', 'Aegis'];
const RELICS: { name: string; col: number }[] = [
  { name: 'Cane', col: 0 }, { name: 'Crook', col: 1 }, { name: 'Wand', col: 2 },
  { name: 'Scepter', col: 3 }, { name: 'Rod', col: 4 }, { name: 'Orb', col: 5 },
];
const PREFIXES = [
  ['Worn', 'Plain', 'Dented', 'Simple'],
  ['Keen', 'Humming', 'Etched', 'Tempered'],
  ['Grim', 'Stormbound', 'Hollow', 'Runed'],
  ['Voidforged', 'Starlit', 'Sovereign', 'Eclipsed'],
  ['Worldrender', 'Godfall', 'Everburning', 'Oathbreaker'],
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** Deeper items are made of better materials, so the icons themselves show progress. */
const metalFor = (ilvl: number) => METALS[ilvl < 20 ? 0 : ilvl < 45 ? 1 : ilvl < 90 ? 2 : 3];
const tierFor = (ilvl: number) => Math.min(6, Math.floor(ilvl / 12));

function rollLook(slot: Slot, ilvl: number): { name: string; kind: string; icon: IconRef } {
  if (slot === 'weapon') {
    const k = randInt(0, WEAPON_KINDS.length - 1);
    const kind = WEAPON_KINDS[k];
    return {
      name: kind,
      kind,
      icon: { sheet: `weapons-${metalFor(ilvl)}`, col: (k % 8) * 3 + randInt(0, 2), row: (k < 8 ? 0 : 10) + randInt(0, 9) },
    };
  }
  const tier = tierFor(ilvl);
  if (slot === 'helm') return { name: `${TIER_NAMES[tier]} ${pick(HELM_NAMES)}`, kind: 'Helm', icon: { sheet: 'items', col: 5, row: tier } };
  if (slot === 'shield') return { name: `${TIER_NAMES[tier]} ${pick(SHIELD_NAMES)}`, kind: 'Shield', icon: { sheet: 'items', col: 2, row: tier } };
  const r = pick(RELICS);
  return { name: r.name, kind: r.name, icon: { sheet: 'items', col: r.col, row: 7 } };
}

function rollRarity(luck: number): number {
  const w = RARITY_WEIGHTS.map((x, i) => (i === 0 ? x : x * (1 + luck * i)));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return 0;
}

function rollAwakenings(slot: Slot, rarity: number, cap: number): Awakening[] {
  return AWAKEN_LEVELS.filter((lv) => lv <= cap).map((level, i) => {
    const affix = pick(AFFIX_POOL[slot]);
    const scale = (1 + 0.2 * rarity) * (1 + 0.25 * i);
    const value = affix === 'chain' ? Math.max(1, Math.round(AFFIXES.chain.base + rarity / 2 + i)) : AFFIXES[affix].base * scale;
    return { level, affix, value };
  });
}

export function rollItem(id: number, ilvl: number, opts: { slot?: Slot; luck?: number; minRarity?: number } = {}): Item {
  const slot = opts.slot ?? pick(SLOTS);
  const rarity = Math.max(opts.minRarity ?? 0, rollRarity(opts.luck ?? 0));
  const [g0, g1] = GROWTH_RANGE[rarity];
  const [c0, c1] = CAP_RANGE[rarity];
  const cap = randInt(c0, c1);
  const look = rollLook(slot, ilvl);
  return {
    id,
    slot,
    name: rarity === 0 ? look.name : `${pick(PREFIXES[rarity])} ${look.name}`,
    kind: look.kind,
    rarity,
    ilvl,
    base: SLOT_BASE[slot] * ILVL_SCALE ** ilvl * BASE_MULT[rarity] * rand(0.85, 1.15),
    growth: 1 + rand(g0, g1),
    cap,
    awakenings: rollAwakenings(slot, rarity, cap),
    level: 1,
    xp: 0,
    icon: look.icon,
  };
}

/** Plain gear to start a run with; `ilvl` scales it for runs that begin deeper. */
export function starterItem(id: number, slot: Slot, ilvl = 1): Item {
  const look = rollLook(slot, ilvl);
  const cap = 15;
  return {
    id, slot, name: `Worn ${look.name}`, kind: look.kind, rarity: 0, ilvl,
    base: SLOT_BASE[slot] * ILVL_SCALE ** ilvl, growth: 1.045, cap,
    awakenings: rollAwakenings(slot, 0, cap), level: 1, xp: 0, icon: look.icon,
  };
}

export function power(item: Item, level = item.level): number {
  return item.base * item.growth ** (Math.min(level, item.cap) - 1);
}

export function xpToNext(level: number): number {
  return 20 * 1.09 ** level;
}

/** 1..5 stars: how far this item can grow over its lifetime. */
export function potentialStars(item: Item): number {
  const p = Math.log10(item.growth) * (item.cap - 1);
  return p < 0.3 ? 1 : p < 0.7 ? 2 : p < 1.3 ? 3 : p < 2.2 ? 4 : 5;
}

export function goldValue(item: Item): number {
  return Math.ceil((1 + item.rarity * 1.5) * 1.05 ** item.ilvl * (1 + 0.05 * item.level));
}

// ---------- the one question players ask: "is this better?" ----------

export type VerdictKind = 'upgrade' | 'potential' | 'worse';

export interface Verdict {
  kind: VerdictKind;
  startLevel: number;
  now: number; // this item's power the moment you equip it
  current: number; // what you're wearing now
  peak: number; // this item at its cap
  currentPeak: number;
  /** For 'potential': the level where it overtakes what you wear today. */
  catchUp?: number;
}

export function startLevel(item: Item, current: Item, inherit: number): number {
  return Math.max(item.level, Math.min(item.cap, Math.floor(current.level * inherit)));
}

export function verdict(item: Item, current: Item, inherit: number): Verdict {
  const start = startLevel(item, current, inherit);
  const v: Verdict = {
    kind: 'worse',
    startLevel: start,
    now: power(item, start),
    current: power(current),
    peak: power(item, item.cap),
    currentPeak: power(current, current.cap),
  };
  if (v.now >= v.current * 1.001) v.kind = 'upgrade';
  else if (v.peak > v.currentPeak * 1.05 && v.peak > v.current) {
    v.kind = 'potential';
    for (let lv = start; lv <= item.cap; lv++) {
      if (power(item, lv) >= v.current) {
        v.catchUp = lv;
        break;
      }
    }
  }
  return v;
}
