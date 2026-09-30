import * as THREE from 'three';
import type { Atlas, Rect } from './atlas.ts';
import type { StageMap } from '../game/stage.ts';
import { seeded } from '../game/stage.ts';

export const WALL_Z = -3;
export const WALL_TOP = 17;
const FAR_Z = -7.5;
const SLAB_BACK = -2.4;
const SLAB_FRONT = 0.55;
const GROUND_BACK = WALL_Z;
const GROUND_FRONT = 1;
const SHADOW_GEO = new THREE.PlaneGeometry(1, 1);
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });

/** Per-chapter dressing so each chapter has its own look beyond the lighting. */
export interface Theme {
  banners: string[];
  fountain: 'red' | 'blue';
  skulls: number; // props per platform
  crates: number;
  goo: number; // chance a wall tile is slimy
}

export const THEMES: Theme[] = [
  { banners: ['red', 'yellow'], fountain: 'blue', skulls: 0.2, crates: 0.8, goo: 0 }, // Sunken Keep
  { banners: ['blue'], fountain: 'blue', skulls: 1.4, crates: 0.1, goo: 0 }, // Bone Crypts
  { banners: ['green'], fountain: 'blue', skulls: 0.4, crates: 1.2, goo: 0.01 }, // Orc Warrens
  { banners: ['green', 'yellow'], fountain: 'red', skulls: 0.6, crates: 0.2, goo: 0.06 }, // Rotting Deep
  { banners: ['red'], fountain: 'red', skulls: 1, crates: 0.2, goo: 0 }, // Demon Gate
  { banners: ['blue'], fountain: 'blue', skulls: 0.5, crates: 0.6, goo: 0 }, // Frozen Vault
];

class Quads {
  pos: number[] = [];
  uv: number[] = [];
  nrm: number[] = [];
  idx: number[] = [];
  private atlas: Atlas;

  constructor(atlas: Atlas) {
    this.atlas = atlas;
  }

  /** Corners: bottom-left, bottom-right, top-right, top-left. */
  quad(c: number[][], r: Rect, n: number[]) {
    const [u0, v0, u1, v1] = this.atlas.uv(r);
    const b = this.pos.length / 3;
    for (const p of c) this.pos.push(...p);
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let i = 0; i < 4; i++) this.nrm.push(...n);
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  /** Vertical tile facing the camera (+z). */
  face(x: number, y: number, z: number, r: Rect, w = 1, h = 1) {
    this.quad([[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]], r, [0, 0, 1]);
  }

  /** Horizontal tile facing up. */
  top(x: number, y: number, z: number, r: Rect) {
    this.quad([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z], [x, y, z]], r, [0, 1, 0]);
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

/** An animated sprite glued to the scenery (fountains). The renderer animates these. */
export interface AnimProp {
  frames: Rect[];
  x: number;
  y: number;
  z: number;
}

export interface StageMesh {
  /** Back wall: drawn dim so the playable platforms stand out. */
  wall: THREE.Mesh;
  /** Distant room seen through alcoves in the back wall (parallax depth). */
  far: THREE.Mesh;
  /** Ground, platforms and props. */
  floor: THREE.Mesh;
  torches: THREE.Vector3[];
  /** Flames glimpsed deep inside the alcoves (no light, just glow). */
  farFlames: THREE.Vector3[];
  anims: AnimProp[];
}

interface Alcove {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A platform map as an HD-2D diorama: a tall brick back wall with alcoves opening
 * onto a dim room behind, banners and fountains, a thick stone ground, and floating
 * flagstone slabs with crates and bones on them.
 */
export function buildStageMesh(atlas: Atlas, map: StageMap, seed: number, chapter: number, mats: { wall: THREE.Material; far: THREE.Material; floor: THREE.Material }): StageMesh {
  const theme = THEMES[(chapter - 1) % THEMES.length];
  const q = new Quads(atlas);
  const farQ = new Quads(atlas);
  const f = new Quads(atlas);
  const r = seeded(seed + 101);
  const floors = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => atlas.rect(`floor_${i}`));
  const floorTile = () => (r() < 0.8 ? floors[0] : floors[1 + Math.floor(r() * 7)]);
  const wall = atlas.rect('wall_mid');
  const lip = atlas.rect('wall_top_mid');
  const banners = theme.banners.map((c) => atlas.rect(`wall_banner_${c}`));
  const holes = [atlas.rect('wall_hole_1'), atlas.rect('wall_hole_2')];
  const goo = atlas.rect('wall_goo');
  const column = atlas.rect('column');
  const torches: THREE.Vector3[] = [];
  const farFlames: THREE.Vector3[] = [];
  const anims: AnimProp[] = [];
  const shadows: StageMap['platforms'] = [];

  // Alcoves: gaps in the back wall at ground level and near the top.
  const alcoves: Alcove[] = [];
  for (let x = 3 + Math.floor(r() * 5); x < map.w - 5; x += 9 + Math.floor(r() * 6)) {
    alcoves.push({ x, y: r() < 0.6 ? 0 : 11, w: 3, h: 3 });
  }
  const inAlcove = (x: number, y: number) => alcoves.some((a) => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h);

  // Back wall across the whole map (a little wider so edges never show).
  for (let x = -6; x < map.w + 6; x++) {
    for (let y = -1; y < WALL_TOP; y++) {
      if (inAlcove(x, y)) continue;
      const roll = r();
      const tile = y > 1 && roll < 0.014 ? banners[Math.floor(r() * banners.length)]
        : roll < 0.014 + theme.goo ? goo
        : y > 0 && roll < 0.04 + theme.goo ? holes[Math.floor(r() * 2)] : wall;
      q.face(x, y, WALL_Z, tile);
    }
    if ((x + 4) % 9 === 0) for (const ty of [2.6, 9.6]) if (!inAlcove(x, Math.floor(ty))) torches.push(new THREE.Vector3(x + 0.5, ty, WALL_Z + 0.08));
  }

  // The room behind: a dim far wall, a floor running into it, and columns framing each alcove.
  for (const a of alcoves) {
    for (let x = a.x - 2; x < a.x + a.w + 2; x++) {
      for (let y = a.y - 1; y < a.y + a.h + 1; y++) farQ.face(x, y, FAR_Z, wall);
      for (let z = FAR_Z; z < WALL_Z; z++) farQ.top(x, a.y, z, floorTile());
    }
    f.face(a.x - 0.5, a.y, WALL_Z + 0.06, column, 1, 3);
    f.face(a.x + a.w - 0.5, a.y, WALL_Z + 0.06, column, 1, 3);
    farFlames.push(new THREE.Vector3(a.x + a.w / 2, a.y + 1.6, FAR_Z + 0.1));
  }

  // One wall fountain per map, on the ground floor, away from alcoves.
  for (let tries = 0; tries < 10; tries++) {
    const x = 2 + Math.floor(r() * (map.w - 4));
    if ([0, 1, 2].some((dy) => inAlcove(x, dy))) continue;
    const c = theme.fountain;
    q.face(x, 2, WALL_Z + 0.02, atlas.rect('wall_fountain_top_1'));
    anims.push({ frames: atlas.anim(`wall_fountain_mid_${c}`), x: x + 0.5, y: 1, z: WALL_Z + 0.03 });
    anims.push({ frames: atlas.anim(`wall_fountain_basin_${c}`), x: x + 0.5, y: 0, z: WALL_Z + 0.03 });
    break;
  }

  // Ground: flagstone floor running back to the wall, with a brick front edge.
  for (let x = -6; x < map.w + 6; x++) {
    for (let z = GROUND_BACK; z < GROUND_FRONT; z++) f.top(x, 0, z, floorTile());
    f.face(x, -1, GROUND_FRONT, lip);
    f.face(x, -2, GROUND_FRONT, wall);
  }

  // Props standing toward the back of a surface so they never hide the fight.
  const skull = atlas.rect('skull');
  const crate = atlas.rect('crate');
  const dress = (x0: number, x1: number, y: number, back: number) => {
    const n = Math.floor(theme.skulls * (x1 - x0) / 8 + r());
    for (let i = 0; i < n; i++) f.face(x0 + 0.5 + r() * (x1 - x0 - 1.5), y, back + r() * 0.4, skull, 0.8, 0.8);
    const c = Math.floor(theme.crates * (x1 - x0) / 10 + r() * 0.8);
    for (let i = 0; i < c; i++) f.face(x0 + 0.5 + r() * (x1 - x0 - 1.5), y, back + r() * 0.4, crate, 1, 1.5);
  };
  dress(0, map.w, 0, WALL_Z + 0.3);

  // Floating slabs: flagstone tops with a capstone lip and a brick band underneath.
  for (const p of map.platforms.slice(1)) {
    for (let x = Math.floor(p.x0); x < Math.ceil(p.x1); x++) {
      for (let z = SLAB_BACK; z < SLAB_FRONT; z++) f.top(x, p.y, z, floorTile());
      f.face(x, p.y - 0.35, SLAB_FRONT, lip, 1, 0.35);
      f.face(x, p.y - 1.1, SLAB_FRONT, wall, 1, 0.75);
    }
    dress(p.x0, p.x1, p.y, SLAB_BACK + 0.1);
    shadows.push(p);
  }

  // Soft shadow cast on the back wall under each slab, so they read as floating shelves.
  const floor = new THREE.Mesh(f.build(), mats.floor);
  for (const p of shadows) {
    const m = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
    m.scale.set(p.x1 - p.x0 + 0.6, 1.6, 1);
    m.position.set((p.x0 + p.x1) / 2, p.y - 1.5, WALL_Z + 0.02);
    floor.add(m);
  }
  return { wall: new THREE.Mesh(q.build(), mats.wall), far: new THREE.Mesh(farQ.build(), mats.far), floor, torches, farFlames, anims };
}
