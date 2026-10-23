import * as THREE from 'three';

/** Pixel art for the dazzle, drawn once: a 4-point star glint, a square mote, and a soft round glow. */
const STAR = ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'];
let textures: { star: THREE.Texture; mote: THREE.Texture; aura: THREE.Texture } | null = null;

function pixelTexture(rows: string[]) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  rows.forEach((row, y) => [...row].forEach((px, x) => px === '#' && g.fillRect(x, y, 1, 1)));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

function shared() {
  if (textures) return textures;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 214, 110, 0.9)');
  grad.addColorStop(0.45, 'rgba(255, 170, 40, 0.35)');
  grad.addColorStop(1, 'rgba(255, 150, 20, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  textures = { star: pixelTexture(STAR), mote: pixelTexture(['#']), aura: new THREE.CanvasTexture(c) };
  return textures;
}

const glowMat = (map: THREE.Texture, color: number, boost: number) => {
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  mat.color.setHex(color).multiplyScalar(boost);
  return mat;
};

/**
 * A champion's gold dazzle, like the Legends' spirit wisps but in gold and lots of it: a breathing aura behind it, motes
 * rising off its body and pixel stars twinkling over it. Sized in world units to the champion standing at the origin.
 */
export class Dazzle {
  readonly group = new THREE.Group();
  private aura: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private motes: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private stars: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** A champion boss that pays souls also sheds soul wisps, in the Legends' purple. */
  private wisps: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  private wispSeeds = new Float32Array(0);
  /** Per mote: across (−1..1), speed, phase, size. Per star: across, up (0..1), phase, rate. */
  private moteSeeds: Float32Array;
  private starSeeds: Float32Array;
  private place = new THREE.Object3D();
  private width: number;
  private height: number;

  constructor(width: number, height: number, big: boolean, souls = false) {
    this.width = width;
    this.height = height;
    const tex = shared();
    const nMotes = big ? 110 : 60;
    const nStars = big ? 22 : 12;
    this.aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(tex.aura, 0xffc850, 1));
    this.aura.scale.set(width * 2.2, height * 1.5, 1);
    this.aura.position.set(0, height * 0.5, -0.05);
    this.motes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMat(tex.mote, 0xffd36a, 1.8), nMotes);
    this.stars = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMat(tex.star, 0xfff0b0, 2.4), nStars);
    for (const mesh of [this.motes, this.stars]) {
      mesh.frustumCulled = false;
      mesh.position.z = 0.06;
    }
    this.moteSeeds = Float32Array.from({ length: nMotes * 4 }, (_, i) => [Math.random() * 2 - 1, 0.35 + Math.random() * 0.5, Math.random(), 0.05 + Math.random() * 0.06][i % 4]);
    this.starSeeds = Float32Array.from({ length: nStars * 4 }, (_, i) => [Math.random() * 2 - 1, 0.1 + Math.random() * 0.85, Math.random() * 10, 2 + Math.random() * 3][i % 4]);
    this.group.add(this.aura, this.motes, this.stars);
    if (souls) {
      const nWisps = 36;
      this.wisps = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMat(tex.mote, 0xb38cff, 2), nWisps);
      this.wisps.frustumCulled = false;
      this.wisps.position.z = 0.08;
      this.wispSeeds = Float32Array.from({ length: nWisps * 4 }, (_, i) => [Math.random() * 2 - 1, 0.15 + Math.random() * 0.2, Math.random(), 0.09 + Math.random() * 0.07][i % 4]);
      this.group.add(this.wisps);
    }
  }

  update(time: number) {
    const { width: w, height: h, place } = this;
    this.aura.material.opacity = 0.55 + Math.sin(time * 3) * 0.15;
    const motes = this.moteSeeds;
    for (let i = 0; i < motes.length / 4; i++) {
      const [across, speed, phase, size] = [motes[i * 4], motes[i * 4 + 1], motes[i * 4 + 2], motes[i * 4 + 3]];
      const life = (time * speed + phase) % 1;
      place.position.set(across * w * 0.55 + Math.sin(time * 2 + phase * 20) * 0.08, life * h * 1.25, 0);
      place.scale.setScalar(size * (1 - life * 0.8) * (0.6 + 0.4 * Math.sin(time * 18 + phase * 50)));
      place.updateMatrix();
      this.motes.setMatrixAt(i, place.matrix);
    }
    this.motes.instanceMatrix.needsUpdate = true;
    const stars = this.starSeeds;
    for (let i = 0; i < stars.length / 4; i++) {
      const [across, up, phase, rate] = [stars[i * 4], stars[i * 4 + 1], stars[i * 4 + 2], stars[i * 4 + 3]];
      // Sharp twinkles: mostly dark, a quick flare now and then.
      const flare = Math.max(0, Math.sin(time * rate + phase)) ** 8;
      place.position.set(across * w * 0.5, up * h, 0.01);
      place.scale.setScalar(flare * 0.4);
      place.updateMatrix();
      this.stars.setMatrixAt(i, place.matrix);
    }
    this.stars.instanceMatrix.needsUpdate = true;
    if (!this.wisps) return;
    const wisps = this.wispSeeds;
    for (let i = 0; i < wisps.length / 4; i++) {
      const [across, speed, phase, size] = [wisps[i * 4], wisps[i * 4 + 1], wisps[i * 4 + 2], wisps[i * 4 + 3]];
      const life = (time * speed + phase) % 1;
      // Slower and higher than the gold: they rise well clear of the boss, swaying, and fade at the top.
      place.position.set(across * w * 0.6 + Math.sin(time * 1.3 + phase * 12) * 0.2, h * (0.1 + life * 1.6), 0);
      place.scale.setScalar(size * Math.sin(life * Math.PI));
      place.updateMatrix();
      this.wisps.setMatrixAt(i, place.matrix);
    }
    this.wisps.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const mesh of [this.aura, this.motes, this.stars, ...(this.wisps ? [this.wisps] : [])]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
