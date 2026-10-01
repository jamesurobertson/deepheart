import * as THREE from 'three';
import type { Atlas, Rect } from './atlas.ts';

/** Spiral staircase geometry, shared by the builder and the walkers. */
export const STAIR = {
  inner: 1.4,
  outer: 5,
  /** Each step turns this far around the column… */
  turn: Math.PI / 9,
  /** …and drops this far. */
  drop: 0.32,
  steps: 80,
  /** Where walkers put their feet, between column and wall. */
  walk: 3.4,
};

/** A point on the walking line of the staircase, `k` steps down (fractional). */
export function stairPoint(k: number, radius = STAIR.walk): THREE.Vector3 {
  const a = (k + 0.5) * STAIR.turn;
  // Feet on the top of whichever step they're on, so walkers visibly step down.
  return new THREE.Vector3(Math.cos(a) * radius, -Math.floor(Math.max(0, k)) * STAIR.drop, Math.sin(a) * radius);
}

/** Quads with arbitrary corners over the atlas (the stairwell is round, so no axis-aligned helpers). */
class Mesh {
  pos: number[] = [];
  uv: number[] = [];
  nrm: number[] = [];
  idx: number[] = [];
  private atlas: Atlas;
  constructor(atlas: Atlas) {
    this.atlas = atlas;
  }

  quad(c: THREE.Vector3[], r: Rect, n: THREE.Vector3) {
    const [u0, v0, u1, v1] = this.atlas.uv(r);
    const b = this.pos.length / 3;
    for (const p of c) this.pos.push(p.x, p.y, p.z);
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let i = 0; i < 4; i++) this.nrm.push(n.x, n.y, n.z);
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setIndex(this.idx);
    return g;
  }
}

const at = (a: number, r: number, y: number) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);

/**
 * A round stairwell: a curved outer wall with torches and wedge steps spiralling down
 * around an open well. Textured with the destination zone's tiles.
 */
export function buildStairwell(atlas: Atlas, tiles: { wall: Rect; floor: Rect[] }, mats: { wall: THREE.Material; floor: THREE.Material; flame: THREE.Material }) {
  const S = STAIR;
  const walls = new Mesh(atlas);
  const steps = new Mesh(atlas);
  const bottom = -S.steps * S.drop - 4;

  // Central column and outer wall, one tile per row.
  const ring = (radius: number, segments: number, inward: boolean) => {
    for (let s = 0; s < segments; s++) {
      const a0 = (s / segments) * Math.PI * 2;
      const a1 = ((s + 1) / segments) * Math.PI * 2;
      const n = at((a0 + a1) / 2, inward ? -1 : 1, 0);
      for (let y = bottom; y < 5; y++) {
        const [p, q] = inward ? [a1, a0] : [a0, a1];
        walls.quad([at(p, radius, y), at(q, radius, y), at(q, radius, y + 1), at(p, radius, y + 1)], tiles.wall, n);
      }
    }
  };
  // An open well in the middle (the camera looks across it), a curved wall outside.
  ring(S.outer, 32, true);

  // Steps: a floor-tiled wedge on top, a brick riser underneath.
  for (let k = 0; k < S.steps; k++) {
    const a0 = k * S.turn;
    const a1 = (k + 1) * S.turn;
    const y = -k * S.drop;
    const floor = tiles.floor[k % 5 === 0 ? 1 % tiles.floor.length : 0];
    steps.quad([at(a0, S.inner, y), at(a0, S.outer, y), at(a1, S.outer, y), at(a1, S.inner, y)], floor, new THREE.Vector3(0, 1, 0));
    const n = at(a1 + Math.PI / 2, 1, 0);
    steps.quad([at(a1, S.outer, y - S.drop), at(a1, S.inner, y - S.drop), at(a1, S.inner, y), at(a1, S.outer, y)], tiles.wall, n);
    steps.quad([at(a0, S.inner, y - S.drop), at(a1, S.inner, y - S.drop), at(a1, S.inner, y), at(a0, S.inner, y)], tiles.wall, at((a0 + a1) / 2, -1, 0));
  }

  const group = new THREE.Group();
  group.add(new THREE.Mesh(walls.build(), mats.wall), new THREE.Mesh(steps.build(), mats.floor));

  // Torches on the outer wall, spaced down the spiral.
  const flames: THREE.Mesh[] = [];
  for (let k = 4; k < S.steps; k += 7) {
    const a = (k + 0.5) * S.turn;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), mats.flame);
    f.position.copy(at(a, S.outer - 0.08, -k * S.drop + 2.2));
    f.lookAt(0, f.position.y, 0);
    group.add(f);
    flames.push(f);
  }
  return { group, flames };
}
