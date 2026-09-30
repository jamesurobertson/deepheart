/**
 * Side-view platform maps. The ground spans the whole map; one-way platforms sit
 * on fixed tiers above it. Everything can be reached by jumping up one tier where
 * platforms overlap, or by dropping down through a platform.
 */

export interface Platform {
  x0: number;
  x1: number;
  y: number;
}

export interface StageMap {
  w: number;
  platforms: Platform[]; // [0] is always the ground
  /** Monster spawn spots: platform index + x. */
  spawns: { p: number; x: number }[];
}

export const TIER = 3.5;

/** Small seeded PRNG so a stage always has the same layout. */
export function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeStage(seed: number, kind: 'field' | 'arena' = 'field'): StageMap {
  const r = seeded(seed * 7919 + 13);
  const w = kind === 'arena' ? 28 : 38;
  const platforms: Platform[] = [{ x0: 0, x1: w, y: 0 }];
  const tiers = kind === 'arena' ? 2 : 3;
  for (let t = 1; t <= tiers; t++) {
    const below = platforms.filter((p) => Math.abs(p.y - (t - 1) * TIER) < 0.01);
    let x = 1.5 + r() * 4;
    while (x < w - 7) {
      const len = Math.round(6 + r() * (kind === 'arena' ? 6 : 8));
      const seg = { x0: Math.round(x), x1: Math.min(w - 1, Math.round(x + len)), y: t * TIER };
      // Only keep platforms you can jump onto from the tier below.
      if (below.some((b) => overlap(b, seg) >= 3)) platforms.push(seg);
      x += len + 3 + r() * 5;
    }
  }
  const spawns: StageMap['spawns'] = [];
  platforms.forEach((p, i) => {
    for (let x = p.x0 + 1.2; x <= p.x1 - 1.2; x += 2.1) spawns.push({ p: i, x });
  });
  return { w, platforms, spawns };
}

export function overlap(a: Platform, b: Platform): number {
  return Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
}

/** Platforms reachable in one move: jump up a tier (needs room to stand under) or drop down one. */
function neighbors(m: StageMap, i: number): number[] {
  const a = m.platforms[i];
  const out: number[] = [];
  m.platforms.forEach((b, j) => {
    if (j === i) return;
    const dy = b.y - a.y;
    if (Math.abs(dy - TIER) < 0.01 && overlap(a, b) >= 2) out.push(j);
    else if (Math.abs(dy + TIER) < 0.01 && overlap(a, b) >= 1) out.push(j);
  });
  if (i !== 0 && a.y > TIER + 0.01) out.push(0); // you can always fall to the ground eventually
  return out;
}

/** Shortest sequence of platforms from `from` to `to` (inclusive), or null. */
export function route(m: StageMap, from: number, to: number): number[] | null {
  if (from === to) return [from];
  const prev = new Map<number, number>([[from, -1]]);
  const q = [from];
  while (q.length) {
    const i = q.shift()!;
    for (const j of neighbors(m, i)) {
      if (prev.has(j)) continue;
      prev.set(j, i);
      if (j === to) {
        const path = [to];
        for (let k = i; k !== -1; k = prev.get(k)!) path.unshift(k);
        return path;
      }
      q.push(j);
    }
  }
  return null;
}

/** The platform a body at (x, y) is standing on, if any. */
export function standingOn(m: StageMap, x: number, y: number): number {
  return m.platforms.findIndex((p) => Math.abs(p.y - y) < 0.02 && x >= p.x0 && x <= p.x1);
}
