import * as THREE from 'three';

interface Particle {
  mesh: THREE.InstancedMesh;
  vel: Float32Array;
  pos: Float32Array;
  life: number;
  size: number;
  gravity: number;
}

interface Beam {
  group: THREE.Group;
  life: number;
  max: number;
}

interface Bolt {
  line: THREE.Line;
  life: number;
}

interface Faller {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  onLand?: () => void;
  /** Leave a trail of sparks while falling (meteors). */
  sparks?: THREE.ColorRepresentation;
  sparkT: number;
}

interface Flash {
  light: THREE.PointLight;
  life: number;
  max: number;
  peak: number;
}

interface Decal {
  mesh: THREE.Mesh;
  life: number;
  max: number;
}

interface Wave {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  grow: number;
}

interface Swipe {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  life: number;
  max: number;
  from: number;
  sweep: number;
}

interface Shard {
  mesh: THREE.InstancedMesh;
  pos: Float32Array;
  vel: Float32Array;
  spin: Float32Array;
  size: number;
  life: number;
}

interface Spray {
  mesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>;
  pos: Float32Array;
  vel: Float32Array;
  size: Float32Array;
  landed: Uint8Array;
  life: number;
}

interface Stain {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  life: number;
  max: number;
}

interface Strike {
  group: THREE.Group;
  target: THREE.Vector3;
  color: THREE.Color;
  height: number;
  life: number;
  max: number;
  /** Time until the bolt re-forks (it flickers between shapes). */
  next: number;
}

/** Small pixel-art textures drawn once in code (crisp when scaled, like the sprites). */
function pixelTexture(size: number, draw: (put: (x: number, y: number, c: string) => void) => void): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw((x, y, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  });
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Concentric pixel ball: `rings` from outside in, e.g. dark orange → orange → yellow → white. */
const ball = (size: number, rings: string[]) => pixelTexture(size, (put) => {
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - c, y - c) / (size / 2);
    if (d > 1) continue;
    put(x, y, rings[Math.min(rings.length - 1, Math.floor((1 - d) * rings.length * 1.15))]);
  }
});

let texCache: { fire: THREE.Texture; void: THREE.Texture; rune: THREE.Texture } | null = null;
/** Fireball, void orb and rune circle textures. */
export function spellTextures() {
  if (texCache) return texCache;
  const fire = ball(12, ['#8a2a0a', '#e0541a', '#ff9a2e', '#ffd46a', '#fff6d0']);
  const voidOrb = pixelTexture(12, (put) => {
    const c = 5.5;
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > 5.8) continue;
      put(x, y, d > 4.6 ? '#d9b3ff' : d > 3.6 ? '#9a4dff' : d > 2.2 ? '#3a0f6a' : '#12031f');
    }
    for (const [x, y] of [[3, 3], [8, 4], [4, 8]]) put(x, y, '#f4e6ff');
  });
  const rune = pixelTexture(32, (put) => {
    const c = 15.5;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - c, y - c);
      if ((d > 13.6 && d < 15) || (d > 9.4 && d < 10.5)) put(x, y, '#ffffff');
    }
    // Six glyph marks between the rings and a diamond in the middle.
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const gx = Math.round(c + Math.cos(a) * 12);
      const gy = Math.round(c + Math.sin(a) * 12);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [k % 2 ? 1 : -1, k % 2 ? 1 : -1]]) put(gx + dx, gy + dy, '#ffffff');
    }
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (Math.abs(dx) + Math.abs(dy) === 4) put(Math.round(c + dx), Math.round(c + dy), '#ffffff');
  });
  texCache = { fire, void: voidOrb, rune };
  return texCache;
}

interface Afterimage {
  sprite: THREE.Sprite;
  life: number;
  max: number;
  size: number;
}

interface RuneCast {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  t: number;
  charge: number;
  erupted: boolean;
  onErupt: () => void;
  color: THREE.Color;
}

interface Chain {
  group: THREE.Group;
  points: THREE.Vector3[];
  color: THREE.Color;
  life: number;
  max: number;
  next: number;
}

const CUBE = new THREE.BoxGeometry(1, 1, 1);
/** Snap to the sprite pixel grid so bolts look drawn, not vector. */
const snap = (v: number) => Math.round(v * 16) / 16;

/** A jagged path from `a` to `b`: mostly vertical steps with sideways kinks. */
function jag(a: THREE.Vector3, b: THREE.Vector3, steps: number, spread: number): THREE.Vector3[] {
  const pts = [a.clone()];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const p = a.clone().lerp(b, t);
    p.x += (Math.random() - 0.5) * spread * Math.sin(t * Math.PI);
    pts.push(new THREE.Vector3(snap(p.x), snap(p.y), p.z));
  }
  pts.push(b.clone());
  return pts;
}

/**
 * Flat ribbon of quads along a polyline (facing the camera), `w` wide. Vertex colours
 * fade from full at `bottom` to black `fade` units above it (invisible, since it's additive).
 */
function ribbon(pts: THREE.Vector3[], w: number, bottom: number, fade: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const shade = (y: number) => Math.max(0, Math.min(1, 1 - (y - bottom) / fade)) ** 1.5;
  const idx: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular in screen plane, plus a little overlap so joints don't gap.
    const nx = (-dy / len) * w / 2;
    const ny = (dx / len) * w / 2;
    const ox = (dx / len) * w * 0.3;
    const oy = (dy / len) * w * 0.3;
    const base = pos.length / 3;
    pos.push(a.x - nx - ox, a.y - ny - oy, a.z, a.x + nx - ox, a.y + ny - oy, a.z, b.x + nx + ox, b.y + ny + oy, b.z, b.x - nx + ox, b.y - ny + oy, b.z);
    const ka = shade(a.y);
    const kb = shade(b.y);
    col.push(ka, ka, ka, ka, ka, ka, kb, kb, kb, kb, kb, kb);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
const MAX_SHATTERS = 10;
const MAX_SPRAYS = 40;
const MAX_STAINS = 50;
const SPRAY_LIFE = 4;
const STAIN_LIFE = 9;

/**
 * Pixel-art splat shapes, drawn once: a lumpy core, a few satellite droplets and a
 * couple of streaks, in two tones (tinted per monster by the material colour).
 */
const SPLATS: THREE.Texture[] = (() => {
  const out: THREE.Texture[] = [];
  for (let v = 0; v < 6; v++) {
    const n = 20;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d')!;
    let seed = v * 7919 + 17;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cells = new Map<string, number>();
    const put = (x: number, y: number, tone: number) => {
      if (x < 0 || y < 0 || x >= n || y >= n) return;
      const k = `${x},${y}`;
      cells.set(k, Math.max(cells.get(k) ?? 0, tone));
    };
    // Core: a few overlapping rough discs.
    for (let b = 0; b < 4; b++) {
      const cx = 10 + (rnd() - 0.5) * 5;
      const cy = 10 + (rnd() - 0.5) * 4;
      const r = 2.2 + rnd() * 2.2;
      for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
        if (x * x + y * y * 1.3 <= r * r + rnd() * 2) put(Math.round(cx + x), Math.round(cy + y), 1);
      }
    }
    // Satellite droplets and streaks flung outward.
    for (let d = 0; d < 7; d++) {
      const a = rnd() * Math.PI * 2;
      const dist = 5 + rnd() * 4;
      const x = Math.round(10 + Math.cos(a) * dist);
      const y = Math.round(10 + Math.sin(a) * dist * 0.8);
      put(x, y, 1);
      if (rnd() < 0.5) put(x + 1, y, 1);
      if (rnd() < 0.4) for (let t = 1; t < 3; t++) put(Math.round(10 + Math.cos(a) * (dist - t)), Math.round(10 + Math.sin(a) * (dist - t) * 0.8), 1);
    }
    // Wet highlights inside the core.
    for (const [k] of cells) {
      const [x, y] = k.split(',').map(Number);
      if (Math.hypot(x - 10, y - 10) < 3 && rnd() < 0.35) cells.set(k, 2);
    }
    for (const [k, tone] of cells) {
      const [x, y] = k.split(',').map(Number);
      g.fillStyle = tone === 2 ? '#ffffff' : '#c4c4c4';
      g.fillRect(x, y, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    out.push(t);
  }
  return out;
})();
const SPLAT_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** A crescent whose colour runs from dark (tail) to bright (head): additive, so the tail vanishes. */
function crescent(size: number, arc: number): THREE.BufferGeometry {
  const n = 22;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * arc;
    const thick = size * 0.38 * (0.15 + 0.85 * Math.sin(Math.PI * Math.min(1, t * 1.1)));
    const r1 = size;
    const r0 = size - thick;
    pos.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
    const k = t ** 1.6;
    col.push(k, k, k, k, k, k);
    if (i < n) {
      const b = i * 2;
      idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

const STAR = (() => {
  const g = new THREE.PlaneGeometry(1, 0.14);
  const h = g.clone().rotateZ(Math.PI / 2);
  const d1 = new THREE.PlaneGeometry(0.55, 0.1).rotateZ(Math.PI / 4);
  const d2 = d1.clone().rotateZ(Math.PI / 2);
  const merged = new THREE.BufferGeometry();
  const parts = [g, h, d1, d2];
  const pos: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const p of parts) {
    const a = p.attributes.position.array;
    for (let i = 0; i < a.length; i++) pos.push(a[i]);
    const ix = p.index!.array;
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base);
    base += a.length / 3;
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setIndex(idx);
  return merged;
})();
const dummy = new THREE.Object3D();

/** Short-lived world effects: chunky pixel bursts, loot beams, lightning. */
export class Fx {
  private scene: THREE.Scene;
  private parts: Particle[] = [];
  private beams: Beam[] = [];
  private bolts: Bolt[] = [];
  private waves: Wave[] = [];
  private fallers: Faller[] = [];
  private flashes: Flash[] = [];
  private decals: Decal[] = [];
  private swipes: Swipe[] = [];
  private stars: Wave[] = [];
  private shards: Shard[] = [];
  private strikes: Strike[] = [];
  private ghosts: Afterimage[] = [];
  private runes: RuneCast[] = [];
  private chains: Chain[] = [];
  private sprays: Spray[] = [];
  private stains: Stain[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // A small pool of lights for impacts; reusing them avoids shader recompiles.
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 9, 1.6);
      scene.add(light);
      this.flashes.push({ light, life: 0, max: 1, peak: 0 });
    }
  }

  /** Brief burst of real light (explosions, crits, level-ups): lights up walls and monsters. */
  light(at: THREE.Vector3, color: THREE.ColorRepresentation, intensity = 25, dur = 0.35, distance = 9) {
    const f = this.flashes.reduce((a, b) => (a.life < b.life ? a : b));
    f.light.position.copy(at).setZ(at.z + 1);
    f.light.color.set(color);
    f.light.distance = distance;
    f.life = f.max = dur;
    f.peak = intensity;
  }

  /** Mark left on the floor (scorch, frost, crack) that fades over a couple of seconds. */
  decal(at: THREE.Vector3, color: THREE.ColorRepresentation, radius: number, dur = 2, additive = false) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: additive ? 0.5 : 0.55, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(at).setY(at.y + 0.015);
    mesh.scale.set(1, 0.6, 1);
    mesh.renderOrder = 1;
    this.scene.add(mesh);
    this.decals.push({ mesh, life: dur, max: dur });
  }

  /**
   * Blood (or ooze, or bone chips): chunky pixel droplets thrown away from a blow along
   * `dirX`. They arc down, land, flatten into little stains on the floor and fade later.
   */
  spray(at: THREE.Vector3, color: THREE.ColorRepresentation, n: number, dirX = 1, power = 1) {
    while (this.sprays.length >= MAX_SPRAYS) this.dropSpray(0);
    const mesh = new THREE.InstancedMesh(CUBE, new THREE.MeshLambertMaterial({ color, transparent: true }), n);
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const shade = new THREE.Color();
    for (let i = 0; i < n; i++) {
      pos[i * 3] = at.x + (Math.random() - 0.5) * 0.15;
      pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * 0.15;
      pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * 0.15;
      vel[i * 3] = dirX * (1 + Math.random() * 3) * power + (Math.random() - 0.5) * 1.2;
      vel[i * 3 + 1] = (0.8 + Math.random() * 2.8) * power;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 2;
      // Pixel-sized: one or two sprite pixels across.
      size[i] = (Math.random() < 0.7 ? 1 : 2) / 16 * 1.2;
      // A little tonal variety so it doesn't read as flat paint.
      mesh.setColorAt(i, shade.setScalar(0.75 + Math.random() * 0.35));
    }
    mesh.instanceColor!.needsUpdate = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.sprays.push({ mesh, pos, vel, size, landed: new Uint8Array(n), life: SPRAY_LIFE });
  }

  /** A pixel-art splat on the floor, tinted `color`, that fades out slowly. */
  bloodSplat(at: THREE.Vector3, color: THREE.ColorRepresentation, size = 0.9) {
    while (this.stains.length >= MAX_STAINS) this.dropStain(0);
    const mesh = new THREE.Mesh(SPLAT_GEO, new THREE.MeshLambertMaterial({
      map: SPLATS[Math.floor(Math.random() * SPLATS.length)], color, transparent: true, depthWrite: false, alphaTest: 0.1,
      polygonOffset: true, polygonOffsetFactor: -2,
    }));
    // Snap to the floor's pixel grid so it sits in the tiles like it belongs there.
    const px = size / 20;
    mesh.position.set(Math.round(at.x / px) * px, 0.011 + Math.random() * 0.002, Math.round(at.z / px) * px);
    mesh.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
    mesh.scale.set(size, 1, size);
    mesh.renderOrder = 1;
    this.scene.add(mesh);
    this.stains.push({ mesh, life: STAIN_LIFE, max: STAIN_LIFE });
  }

  private dropSpray(i: number) {
    const s = this.sprays[i];
    this.scene.remove(s.mesh);
    s.mesh.material.dispose();
    s.mesh.dispose();
    this.sprays.splice(i, 1);
  }

  private dropStain(i: number) {
    const s = this.stains[i];
    this.scene.remove(s.mesh);
    s.mesh.material.dispose();
    this.stains.splice(i, 1);
  }

  /** Column of light (level-ups, awakenings). */
  pillar(at: THREE.Vector3, color: THREE.ColorRepresentation, height = 6, dur = 0.9) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, height, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.position.copy(at).setY(at.y + height / 2);
    this.scene.add(mesh);
    this.waves.push({ mesh, life: dur, max: dur, grow: 0 });
  }

  /** Several slash crescents spinning around a point (whirlwind). */
  arcs(at: THREE.Vector3, radius: number, color: THREE.ColorRepresentation) {
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(radius * 0.7, radius, 20, 1, i * 2.1, 1.3),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      mesh.position.copy(at);
      mesh.rotation.x = -Math.PI / 2.4;
      this.scene.add(mesh);
      this.waves.push({ mesh, life: 0.22, max: 0.22, grow: 0.25 });
    }
  }

  /**
   * A sword swipe: a bright crescent that sweeps through `at`, head leading, tail fading.
   * `angle` is where the sweep starts (radians); crits pass `size` bigger.
   */
  swipe(at: THREE.Vector3, color: THREE.ColorRepresentation, size = 1.1, angle = Math.random() * Math.PI * 2, dur = 0.16) {
    const arc = 2.3;
    const mesh = new THREE.Mesh(
      crescent(size, arc),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.position.copy(at);
    mesh.position.z += 0.5;
    // Centre the arc on the target: rotate so the middle of the swing passes through it.
    mesh.rotation.z = angle - arc / 2;
    mesh.renderOrder = 5;
    this.scene.add(mesh);
    this.swipes.push({ mesh, life: dur, max: dur, from: mesh.rotation.z - 0.9, sweep: 1.3 });
  }

  /**
   * Lightning striking down onto `target` from above: a pixel-jagged bolt with a white
   * core and a coloured glow, a couple of branches, flickering between shapes, plus a
   * flash of light and a scorch ring where it lands.
   */
  lightning(target: THREE.Vector3, color: THREE.ColorRepresentation = 0x9fe6ff, height = 5, dur = 0.24) {
    const group = new THREE.Group();
    this.scene.add(group);
    const strike: Strike = { group, target: target.clone(), color: new THREE.Color(color), height, life: dur, max: dur, next: 0 };
    this.forkStrike(strike);
    this.strikes.push(strike);
    this.light(target.clone().setY(target.y + 1), color, 30, dur + 0.1, 9);
    this.ring(target.clone().setY(0), color, 1.6, 0.3);
    this.star(target, 0xffffff, 1.3, 0.16);
    this.burst(target, '#cfefff', 10, 3.5, 0.06, 6, true);
  }

  /** (Re)build the bolt's shape: called a few times per strike so it crackles. */
  private forkStrike(s: Strike) {
    for (const c of [...s.group.children]) {
      s.group.remove(c);
      const m = c as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    const end = s.target.clone().setZ(s.target.z + 0.35);
    const top = end.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, s.height, 0));
    const main = jag(top, end, 9, 1.1);
    const paths = [main];
    // Two short branches peeling off the main bolt.
    for (let b = 0; b < 2; b++) {
      const from = main[2 + Math.floor(Math.random() * 5)];
      const to = from.clone().add(new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.8), -(0.8 + Math.random() * 1.2), 0));
      paths.push(jag(from, to, 4, 0.5));
    }
    paths.forEach((pts, i) => {
      const w = i === 0 ? 1 : 0.6;
      const bottom = s.target.y;
      const fade = s.height * 0.95;
      const glow = new THREE.Mesh(ribbon(pts, 0.34 * w, bottom, fade), new THREE.MeshBasicMaterial({ vertexColors: true, color: s.color.clone().multiplyScalar(1.2), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const core = new THREE.Mesh(ribbon(pts, 0.1 * w, bottom, fade), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.6, 2.6, 2.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      glow.renderOrder = 6;
      core.renderOrder = 7;
      s.group.add(glow, core);
    });
    s.next = 0.06;
  }

  /** A fading copy of a projectile left behind it (comet trails). */
  afterimage(at: THREE.Vector3, map: THREE.Texture, color: THREE.ColorRepresentation, size: number, life = 0.2) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: new THREE.Color(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.position.copy(at);
    sprite.scale.setScalar(size);
    this.scene.add(sprite);
    this.ghosts.push({ sprite, life, max: life, size });
  }

  /**
   * A rune circle etches itself onto the floor, spins up and brightens, then erupts:
   * `onErupt` fires at that moment (the caller adds the hit).
   */
  runeCircle(at: THREE.Vector3, color: THREE.ColorRepresentation, onErupt: () => void, radius = 1.1, charge = 0.35) {
    const col = new THREE.Color(color);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: spellTextures().rune, color: col.clone().multiplyScalar(1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(at).setY(0.05);
    mesh.scale.setScalar(0.2);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    this.runes.push({ mesh, t: 0, charge, erupted: false, onErupt, color: col });
  }

  /** Lightning that jumps from point to point (chain lightning), flickering between shapes. */
  chain(points: THREE.Vector3[], color: THREE.ColorRepresentation, dur = 0.26) {
    const group = new THREE.Group();
    this.scene.add(group);
    const c: Chain = { group, points: points.map((p) => p.clone()), color: new THREE.Color(color), life: dur, max: dur, next: 0 };
    this.forkChain(c);
    this.chains.push(c);
    for (const p of points.slice(1)) {
      this.star(p, 0xffffff, 0.9, 0.14);
      this.burst(p, '#e6d4ff', 5, 2.5, 0.05, 6, true);
    }
    this.light(points[Math.floor(points.length / 2)], color, 22, dur + 0.05, 9);
  }

  private forkChain(c: Chain) {
    for (const o of [...c.group.children]) {
      c.group.remove(o);
      (o as THREE.Mesh).geometry.dispose();
      ((o as THREE.Mesh).material as THREE.Material).dispose();
    }
    for (let i = 0; i < c.points.length - 1; i++) {
      const a = c.points[i];
      const b = c.points[i + 1];
      const pts = jag(a, b, 7, 0.7);
      const glow = new THREE.Mesh(ribbon(pts, 0.28, -99, 999), new THREE.MeshBasicMaterial({ vertexColors: true, color: c.color.clone().multiplyScalar(1.3), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const core = new THREE.Mesh(ribbon(pts, 0.08, -99, 999), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.6, 2.5, 2.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      glow.renderOrder = 6;
      core.renderOrder = 7;
      c.group.add(glow, core);
    }
    c.next = 0.05;
  }

  /** A four-point twinkle at an impact point. */
  star(at: THREE.Vector3, color: THREE.ColorRepresentation, size = 0.9, dur = 0.16) {
    const mesh = new THREE.Mesh(STAR, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.copy(at);
    mesh.position.z += 0.6;
    mesh.rotation.z = Math.random() * 0.6 - 0.3;
    mesh.renderOrder = 6;
    this.scene.add(mesh);
    this.stars.push({ mesh, life: dur, max: dur, grow: size });
  }

  /** A flat ring expanding across the floor. */
  ring(at: THREE.Vector3, color: THREE.ColorRepresentation, radius: number, dur = 0.35) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.position.copy(at).setY(0.04);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(0.4);
    this.scene.add(mesh);
    this.waves.push({ mesh, life: dur, max: dur, grow: radius });
  }

  /**
   * Burst a sprite into its own pixels: each opaque pixel becomes a little cube that
   * flies off (biased along `push`), bounces on the floor and fades.
   */
  shatter(origin: THREE.Vector3, pixels: { x: number; y: number; color: number }[], frame: { w: number; h: number }, unit: number, flip: boolean, push: number, power = 1) {
    if (!pixels.length) return;
    while (this.shards.length >= MAX_SHATTERS) this.dropShard(0);
    const n = pixels.length;
    // Lit like the sprites, so white pixels (bones) don't blow out in the bloom.
    const mesh = new THREE.InstancedMesh(CUBE, new THREE.MeshLambertMaterial({ transparent: true }), n);
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const spin = new Float32Array(n);
    const c = new THREE.Color();
    pixels.forEach((p, i) => {
      const lx = (flip ? frame.w - p.x : p.x) - frame.w / 2;
      const ly = frame.h - p.y;
      pos[i * 3] = origin.x + lx * unit;
      pos[i * 3 + 1] = origin.y + ly * unit;
      pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.2;
      // Fly outward from the sprite's middle, mostly up and away from the blow.
      const ox = lx / frame.w;
      const oy = (ly - frame.h / 2) / frame.h;
      vel[i * 3] = (ox * 4 + push * (1.5 + Math.random() * 2.5)) * power;
      vel[i * 3 + 1] = (2.5 + oy * 3 + Math.random() * 3.5) * power;
      vel[i * 3 + 2] = (Math.random() - 0.3) * 3 * power;
      spin[i] = (Math.random() - 0.5) * 20;
      mesh.setColorAt(i, c.setHex(p.color));
    });
    mesh.instanceColor!.needsUpdate = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.shards.push({ mesh, pos, vel, spin, size: unit * 1.05, life: 1.3 });
  }

  private dropShard(i: number) {
    const s = this.shards[i];
    this.scene.remove(s.mesh);
    (s.mesh.material as THREE.Material).dispose();
    s.mesh.dispose();
    this.shards.splice(i, 1);
  }

  /** Square "pixel" debris, the way sprites shatter in pixel games. */
  burst(at: THREE.Vector3, color: THREE.ColorRepresentation, n = 14, speed = 3.2, size = 0.09, gravity = 12, glow = false) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    if (glow) (mat.color as THREE.Color).multiplyScalar(2.2);
    const mesh = new THREE.InstancedMesh(CUBE, mat, n);
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([at.x, at.y, at.z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const up = 0.3 + Math.random() * 0.9;
      const s = speed * (0.35 + Math.random() * 0.65);
      vel.set([Math.cos(a) * s * 0.8, up * s, Math.sin(a) * s * 0.35], i * 3);
    }
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.parts.push({ mesh, vel, pos, life: 1, size, gravity });
  }

  /** A column of light over dropped loot; brighter and taller with rarity. */
  beam(x: number, z: number, color: string, rarity: number, y = 0) {
    const group = new THREE.Group();
    const c = new THREE.Color(color).multiplyScalar(0.8 + rarity * 0.18);
    const h = 2.5 + rarity * 1.2;
    const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03 + rarity * 0.01, 0.14 + rarity * 0.03, h, 12, 1, true), mat);
    shaft.position.y = h / 2;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.34 + rarity * 0.06, 24),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(shaft, ring);
    group.position.set(x, y, z);
    this.scene.add(group);
    const life = 1.6 + rarity * 0.35;
    this.beams.push({ group, life, max: life });
  }

  bolt(a: THREE.Vector3, b: THREE.Vector3) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const j = i === 0 || i === 8 ? 0 : 0.28;
      pts.push(new THREE.Vector3(
        a.x + (b.x - a.x) * t + (Math.random() - 0.5) * j,
        a.y + (b.y - a.y) * t + (Math.random() - 0.5) * j,
        a.z + (b.z - a.z) * t,
      ));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: new THREE.Color(0x9fe6ff).multiplyScalar(2.5), transparent: true }),
    );
    this.scene.add(line);
    this.bolts.push({ line, life: 0.22 });
    // A couple of short forks off the main bolt.
    for (let f = 0; f < 2; f++) {
      const base = pts[2 + Math.floor(Math.random() * 4)];
      const tip = base.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.3) * 1, 0));
      const fork = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([base, base.clone().lerp(tip, 0.5).add(new THREE.Vector3(0.15, 0, 0)), tip]),
        new THREE.LineBasicMaterial({ color: new THREE.Color(0x9fe6ff).multiplyScalar(1.8), transparent: true }),
      );
      this.scene.add(fork);
      this.bolts.push({ line: fork, life: 0.16 });
    }
    this.light(a.clone().lerp(b, 0.5), 0x9fe6ff, 14, 0.2, 6);
  }

  /** A bright crescent in front of the hero for each swing. */
  slash(at: THREE.Vector3, reach: number) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(reach * 0.55, reach * 0.8, 20, 1, -1.1, 2.2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.6, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.position.copy(at);
    mesh.rotation.x = -Math.PI / 2.6;
    this.scene.add(mesh);
    this.waves.push({ mesh, life: 0.16, max: 0.16, grow: 0.6 });
  }

  /** Expanding ground ring for the shockwave slam. */
  shockwave(at: THREE.Vector3, radius: number) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.3, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.position.copy(at).setY(0.05);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(0.4);
    this.scene.add(mesh);
    this.waves.push({ mesh, life: 0.35, max: 0.35, grow: radius });
    this.burst(at.clone().setY(0.3), '#ffd27a', 26, 6, 0.07, 10, true);
  }

  /** Something dropping from the sky onto `to` (meteors, arrows, ice). */
  fall(to: THREE.Vector3, color: THREE.ColorRepresentation, size: number, dur: number, onLand?: () => void, slant = 0.6, sparks = false) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size * 2.4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const from = to.clone().add(new THREE.Vector3(-slant * 9, 9, 0));
    mesh.position.copy(from);
    mesh.rotation.z = Math.atan2(9, slant * 9) - Math.PI / 2;
    this.scene.add(mesh);
    this.fallers.push({ mesh, from, to: to.clone(), t: 0, dur, onLand, sparks: sparks ? color : undefined, sparkT: 0 });
  }

  /** A ring standing up around the hero (buffs, whirlwind). */
  aura(at: THREE.Vector3, color: THREE.ColorRepresentation, radius: number, life = 0.5) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.8, radius, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.waves.push({ mesh, life, max: life, grow: 0.5 });
  }

  /** Thin streak left behind by a dash: bright at the destination, fading back to the start. */
  trail(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation) {
    const len = from.distanceTo(to);
    if (len < 0.2) return;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 0.14),
      new THREE.MeshBasicMaterial({ map: streakTexture(), color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    mesh.position.copy(from).lerp(to, 0.5);
    if (to.x < from.x) mesh.scale.x = -1;
    this.scene.add(mesh);
    this.waves.push({ mesh, life: 0.18, max: 0.18, grow: 0 });
    for (let i = 1; i <= 4; i++) this.burst(from.clone().lerp(to, i / 5), color, 4, 1.5, 0.06, 6, true);
  }

  update(dt: number) {
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.life -= dt;
      const k = Math.max(0, g.life / g.max);
      g.sprite.material.opacity = k * 0.7;
      g.sprite.scale.setScalar(g.size * (0.4 + 0.6 * k));
      if (g.life <= 0) {
        this.scene.remove(g.sprite);
        g.sprite.material.dispose();
        this.ghosts.splice(i, 1);
      }
    }
    for (let i = this.runes.length - 1; i >= 0; i--) {
      const r = this.runes[i];
      r.t += dt;
      if (!r.erupted) {
        // Etch in, spin up, brighten.
        const k = Math.min(1, r.t / r.charge);
        r.mesh.scale.setScalar(0.2 + 0.8 * (1 - (1 - k) ** 3));
        r.mesh.rotation.z += dt * (2 + k * 10);
        r.mesh.material.color.copy(r.color).multiplyScalar(0.8 + k * 1.6);
        if (k >= 1) {
          r.erupted = true;
          r.t = 0;
          r.onErupt();
        }
      } else {
        // After the eruption the circle flares out and fades.
        const k = Math.min(1, r.t / 0.35);
        r.mesh.scale.setScalar(1 + k * 0.5);
        r.mesh.rotation.z += dt * 4;
        r.mesh.material.opacity = 1 - k;
        if (k >= 1) {
          this.scene.remove(r.mesh);
          r.mesh.geometry.dispose();
          r.mesh.material.dispose();
          this.runes.splice(i, 1);
        }
      }
    }
    for (let i = this.chains.length - 1; i >= 0; i--) {
      const c = this.chains[i];
      c.life -= dt;
      c.next -= dt;
      if (c.next <= 0 && c.life > 0.05) this.forkChain(c);
      const k = Math.max(0, c.life / c.max);
      c.group.children.forEach((o, j) => (((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (j % 2 === 0 ? 0.6 : 1) * Math.min(1, k * 2)));
      if (c.life <= 0) {
        for (const o of c.group.children) {
          (o as THREE.Mesh).geometry.dispose();
          ((o as THREE.Mesh).material as THREE.Material).dispose();
        }
        this.scene.remove(c.group);
        this.chains.splice(i, 1);
      }
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const st = this.strikes[i];
      st.life -= dt;
      st.next -= dt;
      if (st.next <= 0 && st.life > 0.05) this.forkStrike(st);
      const k = Math.max(0, st.life / st.max);
      st.group.children.forEach((c, j) => {
        const mat = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = (j % 2 === 0 ? 0.55 : 1) * Math.min(1, k * 2.2);
      });
      if (st.life <= 0) {
        for (const c of st.group.children) {
          (c as THREE.Mesh).geometry.dispose();
          ((c as THREE.Mesh).material as THREE.Material).dispose();
        }
        this.scene.remove(st.group);
        this.strikes.splice(i, 1);
      }
    }
    for (let i = this.swipes.length - 1; i >= 0; i--) {
      const w = this.swipes[i];
      w.life -= dt;
      const k = 1 - Math.max(0, w.life) / w.max;
      // Fast out, eased: the swing snaps through, then the trail lingers and fades.
      const e = 1 - (1 - k) ** 3;
      w.mesh.rotation.z = w.from + w.sweep * e;
      w.mesh.scale.setScalar(0.85 + 0.3 * e);
      w.mesh.material.opacity = k < 0.45 ? 1 : Math.max(0, 1 - (k - 0.45) / 0.55);
      if (w.life <= 0) {
        this.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        w.mesh.material.dispose();
        this.swipes.splice(i, 1);
      }
    }
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const st = this.stars[i];
      st.life -= dt;
      const k = 1 - Math.max(0, st.life) / st.max;
      st.mesh.scale.setScalar(st.grow * Math.sin(Math.PI * Math.min(1, k * 1.2)));
      st.mesh.rotation.z += dt * 3;
      if (st.life <= 0) {
        this.scene.remove(st.mesh);
        (st.mesh.material as THREE.Material).dispose();
        this.stars.splice(i, 1);
      }
    }
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];
      sh.life -= dt;
      const n = sh.mesh.count;
      const fade = Math.min(1, sh.life / 0.45);
      for (let k = 0; k < n; k++) {
        const o = k * 3;
        sh.vel[o + 1] -= 22 * dt;
        sh.pos[o] += sh.vel[o] * dt;
        sh.pos[o + 1] += sh.vel[o + 1] * dt;
        sh.pos[o + 2] += sh.vel[o + 2] * dt;
        if (sh.pos[o + 1] < sh.size / 2) {
          // Bounce and skid along the floor.
          sh.pos[o + 1] = sh.size / 2;
          sh.vel[o + 1] *= -0.35;
          sh.vel[o] *= 0.7;
          sh.vel[o + 2] *= 0.7;
          sh.spin[k] *= 0.6;
        }
        dummy.position.set(sh.pos[o], sh.pos[o + 1], sh.pos[o + 2]);
        dummy.rotation.set(0, 0, sh.spin[k] * (1.3 - sh.life));
        dummy.scale.setScalar(sh.size * Math.max(0.05, fade));
        dummy.updateMatrix();
        sh.mesh.setMatrixAt(k, dummy.matrix);
      }
      sh.mesh.instanceMatrix.needsUpdate = true;
      if (sh.life <= 0) this.dropShard(i);
    }
    for (let i = this.sprays.length - 1; i >= 0; i--) {
      const sp = this.sprays[i];
      sp.life -= dt;
      const n = sp.mesh.count;
      for (let k = 0; k < n; k++) {
        const o = k * 3;
        const sz = sp.size[k];
        if (!sp.landed[k]) {
          sp.vel[o + 1] -= 20 * dt;
          sp.pos[o] += sp.vel[o] * dt;
          sp.pos[o + 1] += sp.vel[o + 1] * dt;
          sp.pos[o + 2] += sp.vel[o + 2] * dt;
          if (sp.pos[o + 1] <= 0.012) {
            // Land and stay: a flat pixel stain.
            sp.pos[o + 1] = 0.012;
            sp.landed[k] = 1;
          }
        }
        dummy.position.set(sp.pos[o], sp.pos[o + 1], sp.pos[o + 2]);
        dummy.rotation.set(0, 0, 0);
        if (sp.landed[k]) dummy.scale.set(sz * 1.3, 0.004, sz * 1.1);
        else dummy.scale.setScalar(sz);
        dummy.updateMatrix();
        sp.mesh.setMatrixAt(k, dummy.matrix);
      }
      sp.mesh.instanceMatrix.needsUpdate = true;
      sp.mesh.material.opacity = Math.min(1, sp.life / 1.2);
      if (sp.life <= 0) this.dropSpray(i);
    }
    for (let i = this.stains.length - 1; i >= 0; i--) {
      const st = this.stains[i];
      st.life -= dt;
      st.mesh.material.opacity = Math.min(0.92, st.life / 2.5);
      if (st.life <= 0) this.dropStain(i);
    }
    for (const f of this.flashes) {
      f.life = Math.max(0, f.life - dt);
      const k = f.life / f.max;
      f.light.intensity = f.peak * k * k;
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= dt;
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.7, (d.life / d.max) * 2);
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        (d.mesh.material as THREE.Material).dispose();
        this.decals.splice(i, 1);
      }
    }
    for (let i = this.fallers.length - 1; i >= 0; i--) {
      const f = this.fallers[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      f.mesh.position.lerpVectors(f.from, f.to, k * k);
      if (f.sparks !== undefined && (f.sparkT -= dt) <= 0) {
        f.sparkT = 0.03;
        this.burst(f.mesh.position.clone(), f.sparks, 3, 1.2, 0.07, 2, true);
      }
      if (k >= 1) {
        f.onLand?.();
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        (f.mesh.material as THREE.Material).dispose();
        this.fallers.splice(i, 1);
      }
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.life -= dt;
      const k = 1 - w.life / w.max;
      if (w.grow > 1) w.mesh.scale.setScalar(0.4 + k * (w.grow - 0.4));
      else w.mesh.scale.setScalar(1 + k * w.grow);
      (w.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k);
      if (w.life <= 0) {
        this.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        (w.mesh.material as THREE.Material).dispose();
        this.waves.splice(i, 1);
      }
    }

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt * 1.5;
      const n = p.mesh.count;
      for (let k = 0; k < n; k++) {
        const o = k * 3;
        p.vel[o + 1] -= p.gravity * dt;
        p.pos[o] += p.vel[o] * dt;
        p.pos[o + 1] += p.vel[o + 1] * dt;
        p.pos[o + 2] += p.vel[o + 2] * dt;
        if (p.pos[o + 1] < 0.05) {
          p.pos[o + 1] = 0.05;
          p.vel[o + 1] *= -0.3;
          p.vel[o] *= 0.6;
        }
        dummy.position.set(p.pos[o], p.pos[o + 1], p.pos[o + 2]);
        dummy.scale.setScalar(p.size * Math.max(0.2, p.life));
        dummy.updateMatrix();
        p.mesh.setMatrixAt(k, dummy.matrix);
      }
      p.mesh.instanceMatrix.needsUpdate = true;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, p.life * 1.6);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        p.mesh.dispose();
        this.parts.splice(i, 1);
      }
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      const k = b.life / b.max;
      b.group.scale.set(1, Math.min(1, (1 - k) * 6), 1);
      b.group.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.material as THREE.MeshBasicMaterial).opacity = Math.min(0.45, k * 1.2);
      });
      if (b.life <= 0) {
        this.scene.remove(b.group);
        b.group.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
        this.beams.splice(i, 1);
      }
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      (b.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, b.life / 0.22);
      if (b.life <= 0) {
        this.scene.remove(b.line);
        b.line.geometry.dispose();
        (b.line.material as THREE.Material).dispose();
        this.bolts.splice(i, 1);
      }
    }
  }
}

/** Flickering torch flame: additive pixel-ish sprite drawn on a tiny canvas. */
export function flameTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 12;
  const g = c.getContext('2d')!;
  const rows = [
    '...11...',
    '..1221..',
    '..1221..',
    '.122221.',
    '.123321.',
    '12333321',
    '12344321',
    '12344321',
    '.123321.',
    '..1221..',
    '...11...',
    '........',
  ];
  const col: Record<string, string> = { '1': '#b83a16', '2': '#f07a1e', '3': '#ffc23d', '4': '#fff4c2' };
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (col[ch]) {
      g.fillStyle = col[ch];
      g.fillRect(x, y, 1, 1);
    }
  }));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let streak: THREE.Texture | null = null;
/** Horizontal alpha gradient (transparent → opaque), shared by all dash trails. */
function streakTexture(): THREE.Texture {
  if (streak) return streak;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 4;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 4);
  streak = new THREE.CanvasTexture(c);
  return streak;
}
