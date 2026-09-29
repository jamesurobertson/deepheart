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

const CUBE = new THREE.BoxGeometry(1, 1, 1);
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
    for (const f of this.flashes) {
      f.life = Math.max(0, f.life - dt);
      const k = f.life / f.max;
      f.light.intensity = f.peak * k * k;
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= dt;
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.55, (d.life / d.max) * 0.8);
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
