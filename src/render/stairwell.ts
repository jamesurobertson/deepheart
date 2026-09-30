import * as THREE from 'three';
import type { Atlas, Rect } from './atlas.ts';

/**
 * A stair tower seen as a cutaway: flights zig-zag down the screen, alternating front and
 * back, with a landing at each turn. Walkers follow `stairPoint(s)`, `s` being distance
 * walked in world units.
 */
export const STAIR = {
  /** Steps per flight (each 1 unit wide, `rise` down). */
  steps: 12,
  rise: 0.5,
  landing: 2,
  flights: 5,
  /** x where the first flight starts; flights alternate direction. */
  x0: -7,
  /** Depth of the front and back flights. */
  zFront: 0.7,
  zBack: -0.9,
};

const FLIGHT = STAIR.steps + STAIR.landing;
const DROP = STAIR.steps * STAIR.rise;

/** Where a walker is after walking `s` units from the top (feet on the step top). */
export function stairPoint(s: number): THREE.Vector3 {
  const k = Math.max(0, Math.floor(s / FLIGHT));
  const u = s - k * FLIGHT;
  const dir = k % 2 === 0 ? 1 : -1;
  const xs = k % 2 === 0 ? STAIR.x0 : STAIR.x0 + STAIR.steps + STAIR.landing;
  const top = -k * DROP;
  const z = k % 2 === 0 ? STAIR.zFront : STAIR.zBack;
  if (u < STAIR.steps) return new THREE.Vector3(xs + dir * u, top - (Math.floor(u) + 1) * STAIR.rise, z);
  // On the landing: walk out, then step across to the next flight's depth.
  const l = (u - STAIR.steps) / STAIR.landing;
  const zNext = k % 2 === 0 ? STAIR.zBack : STAIR.zFront;
  return new THREE.Vector3(xs + dir * u, top - DROP, z + (zNext - z) * l);
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

  /** A box face-on to the camera: top (floor tile) and front (wall tile). */
  block(x: number, y: number, z0: number, z1: number, w: number, h: number, top: Rect, front: Rect) {
    for (let i = 0; i < w; i++) {
      for (let z = z0; z < z1; z++) this.quad([[x + i, y, Math.min(z + 1, z1)], [x + i + 1, y, Math.min(z + 1, z1)], [x + i + 1, y, z], [x + i, y, z]], top, [0, 1, 0]);
      this.quad([[x + i, y - h, z1], [x + i + 1, y - h, z1], [x + i + 1, y, z1], [x + i, y, z1]], front, [0, 0, 1]);
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
 * Build the tower in the destination zone's tiles: a back wall, the flights of steps and
 * landings, and a torch above each landing.
 */
export function buildStairwell(atlas: Atlas, tiles: { wall: Rect; top: Rect; floor: Rect[] }, mats: { wall: THREE.Material; floor: THREE.Material; flame: THREE.Material }) {
  const S = STAIR;
  const back = new Mesh(atlas);
  const steps = new Mesh(atlas);
  const bottom = -S.flights * DROP - 8;
  const x1 = S.x0 + S.steps + S.landing;

  // Back wall of the tower.
  for (let x = S.x0 - 10; x < x1 + 10; x++) {
    for (let y = bottom; y < 8; y++) back.quad([[x, y, -2.5], [x + 1, y, -2.5], [x + 1, y + 1, -2.5], [x, y + 1, -2.5]], tiles.wall, [0, 0, 1]);
  }

  const flames: THREE.Mesh[] = [];
  const group = new THREE.Group();
  for (let k = 0; k < S.flights; k++) {
    const dir = k % 2 === 0 ? 1 : -1;
    const xs = k % 2 === 0 ? S.x0 : x1;
    const top = -k * DROP;
    const [z0, z1] = k % 2 === 0 ? [-0.2, 1.6] : [-1.8, 0];
    // Each step is its own block, so the flight has a stepped underside.
    for (let i = 0; i < S.steps; i++) {
      const x = dir > 0 ? xs + i : xs - i - 1;
      const y = top - (i + 1) * S.rise;
      steps.block(x, y, z0, z1, 1, S.rise + 0.35, tiles.floor[(i * 7 + k) % 5 === 0 ? 1 : 0], tiles.wall);
    }
    // The landing spans the full depth so walkers can cross to the next flight.
    const lx = dir > 0 ? xs + S.steps : xs - S.steps - S.landing;
    steps.block(lx, top - DROP, -1.8, 1.6, S.landing, 0.6, tiles.floor[0], tiles.top);
    // A torch on the back wall above each landing.
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), mats.flame);
    f.position.set(lx + S.landing / 2, top - DROP + 2.6, -2.4);
    group.add(f);
    flames.push(f);
  }
  group.add(new THREE.Mesh(back.build(), mats.wall), new THREE.Mesh(steps.build(), mats.floor));
  return { group, flames };
}
