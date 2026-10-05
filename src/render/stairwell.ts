import * as THREE from 'three';
import type { Atlas, Rect } from './atlas.ts';

/**
 * A long stairway seen side-on: flights of steps running down to the right, a landing with a torch between each.
 * Walkers follow `stairPoint(s)`, `s` being distance walked in world units.
 */
export const STAIR = {
  /** Steps per flight (each 1 unit wide, `rise` down). */
  steps: 9,
  rise: 0.5,
  landing: 3,
  flights: 6,
  /** x where the first flight starts. */
  x0: -7,
  /** Depth the walkers keep to (the stairs run from `zBack` to `zFront`). */
  z: 0.7,
  zBack: -0.2,
  zFront: 1.6,
};

const FLIGHT = STAIR.steps + STAIR.landing;
const DROP = STAIR.steps * STAIR.rise;
/** How far each step and landing reaches down: deep enough that the stairs read as one solid run of stone. */
const BODY = 2;

/** Where a walker is after walking `s` units from the top (feet on the step top). */
export function stairPoint(s: number): THREE.Vector3 {
  // The back of a long column is still on the floor above, waiting its turn.
  if (s < 0) return new THREE.Vector3(STAIR.x0 + s, 0, STAIR.z);
  const k = Math.max(0, Math.floor(s / FLIGHT));
  const u = s - k * FLIGHT;
  const y = -k * DROP - (u < STAIR.steps ? Math.floor(u) + 1 : STAIR.steps) * STAIR.rise;
  return new THREE.Vector3(STAIR.x0 + s, y, STAIR.z);
}

/** Quads with arbitrary corners over the atlas. */
class Mesh {
  pos: number[] = [];
  uv: number[] = [];
  nrm: number[] = [];
  idx: number[] = [];
  private atlas: Atlas;
  constructor(atlas: Atlas) {
    this.atlas = atlas;
  }

  quad(c: number[][], r: Rect, n: number[]) {
    const [u0, v0, u1, v1] = this.atlas.uv(r);
    const b = this.pos.length / 3;
    for (const p of c) this.pos.push(...p);
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let i = 0; i < 4; i++) this.nrm.push(...n);
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  /** A box face-on to the camera: top (floor tile) and front (wall tile, `h` whole tiles deep). */
  block(x: number, y: number, z0: number, z1: number, w: number, h: number, top: Rect, front: Rect) {
    for (let i = 0; i < w; i++) {
      for (let z = z0; z < z1; z++) this.quad([[x + i, y, Math.min(z + 1, z1)], [x + i + 1, y, Math.min(z + 1, z1)], [x + i + 1, y, z], [x + i, y, z]], top, [0, 1, 0]);
      // Whole tiles down the front, so the brick isn't stretched.
      for (let j = 0; j < h; j++) this.quad([[x + i, y - j - 1, z1], [x + i + 1, y - j - 1, z1], [x + i + 1, y - j, z1], [x + i, y - j, z1]], front, [0, 0, 1]);
    }
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

/**
 * Build the stairway in the destination zone's tiles: a back wall, the flights of steps and
 * landings, and a torch above each landing.
 */
export function buildStairwell(atlas: Atlas, tiles: { wall: Rect; floor: Rect[] }, mats: { wall: THREE.Material; floor: THREE.Material; flame: THREE.Material }) {
  const S = STAIR;
  const back = new Mesh(atlas);
  const steps = new Mesh(atlas);
  const bottom = -S.flights * DROP - 8;
  const x1 = S.x0 + S.flights * FLIGHT;

  // Back wall.
  for (let x = S.x0 - 14; x < x1 + 14; x++) {
    for (let y = bottom; y < 8; y++) back.quad([[x, y, -2.5], [x + 1, y, -2.5], [x + 1, y + 1, -2.5], [x, y + 1, -2.5]], tiles.wall, [0, 0, 1]);
  }

  const flames: THREE.Mesh[] = [];
  const group = new THREE.Group();
  // The stretch of floor you set off from, then each flight and its landing.
  steps.block(S.x0 - 14, 0, S.zBack, S.zFront, 14, BODY, tiles.floor[0], tiles.wall);
  for (let k = 0; k < S.flights; k++) {
    const xs = S.x0 + k * FLIGHT;
    const top = -k * DROP;
    for (let i = 0; i < S.steps; i++) steps.block(xs + i, top - (i + 1) * S.rise, S.zBack, S.zFront, 1, BODY, tiles.floor[(i * 7 + k) % 5 === 0 ? 1 : 0], tiles.wall);
    const lx = xs + S.steps;
    steps.block(lx, top - DROP, S.zBack, S.zFront, S.landing, BODY, tiles.floor[0], tiles.wall);
    // A torch on the back wall above each landing.
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), mats.flame);
    f.position.set(lx + S.landing / 2, top - DROP + 2.6, -2.4);
    group.add(f);
    flames.push(f);
  }
  group.add(new THREE.Mesh(back.build(), mats.wall), new THREE.Mesh(steps.build(), mats.floor));
  return { group, flames };
}
