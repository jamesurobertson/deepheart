import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Atlas, Rect } from './atlas.ts';
import { PixelSprite, blobShadow } from './sprite.ts';
import { Fx, flameTexture, spellTextures } from './fx.ts';
import { GradeShader, tiltShift } from './post.ts';
import { buildStairwell, stairPoint } from './stairwell.ts';
import { COMPS, ZONES, zoneOf, type Attack, type Tiles } from '../game/data.ts';
import type { Game, GameEvent, Monster } from '../game/game.ts';

const WALL_Z = -6;
const STAIRS = new THREE.Vector3(7.5, 0, -4);
/** Where the camera looks: between the party and the monsters. */
const LOOK = new THREE.Vector3(0, 1.1, 0.5);

interface Palette { torch: number; fog: number; hemi: number; wall: [number, number, number]; floor: [number, number, number]; banner: string; goo: number }
/** Lighting per zone, in the same order as ZONES. Tiles with their own colour (jungle, tomb) get a lighter wash. */
const PALETTES: Palette[] = [
  { torch: 0xff9a4a, fog: 0x0a0708, hemi: 0x6a5a78, wall: [0.5, 0.44, 0.46], floor: [1.1, 1.05, 1.02], banner: 'red', goo: 0.005 }, // Upper Halls
  { torch: 0x5ad6c8, fog: 0x04090b, hemi: 0x4a6a78, wall: [0.34, 0.5, 0.56], floor: [1.6, 2.2, 2.45], banner: 'blue', goo: 0 }, // Bone Crypts
  { torch: 0xa6e06a, fog: 0x050904, hemi: 0x55704a, wall: [0.62, 0.7, 0.6], floor: [1.1, 1.2, 1.1], banner: 'green', goo: 0 }, // Overgrown Warrens
  { torch: 0xffb35a, fog: 0x0c0806, hemi: 0x7a6450, wall: [0.62, 0.56, 0.5], floor: [1, 0.95, 0.88], banner: 'yellow', goo: 0 }, // Sunken Tomb
  { torch: 0xb485ff, fog: 0x08060d, hemi: 0x5a4a82, wall: [0.42, 0.38, 0.5], floor: [1.9, 1.8, 2.1], banner: 'green', goo: 0.06 }, // Rotting Deep
  { torch: 0x8af0d8, fog: 0x04070b, hemi: 0x5a70a0, wall: [0.5, 0.58, 0.72], floor: [0.95, 1.05, 1.2], banner: 'blue', goo: 0 }, // Enchanted Grove
  { torch: 0xff5a3a, fog: 0x0b0505, hemi: 0x6a4a52, wall: [0.52, 0.34, 0.34], floor: [1.15, 0.95, 0.9], banner: 'red', goo: 0 }, // Demon Gate
  { torch: 0x9cc0ff, fog: 0x05070c, hemi: 0x5a6a8a, wall: [0.42, 0.6, 0.9], floor: [0.85, 1.15, 1.7], banner: 'blue', goo: 0 }, // Frozen Vault
];

/** Formation slots for companions, front to back. */
const PARTY_SLOTS: [number, number][] = [
  [-3, 0.8], [-3.4, -1.4], [-3.7, 2.6], [-4.4, -0.2], [-4.8, 1.7], [-5, -2.4], [-5.8, 0.8], [-6, 2.8],
  [-6.2, -1.3], [-6.9, 1.9], [-7.2, -0.3], [-7.4, -2.5], [-8, 2.6], [-8.3, 0.8], [-8.8, -1.4], [-9.3, 1.6],
];

interface MonView {
  id: number;
  /** Sprite scale (sized from the art so big and small creatures both read) and resulting height. */
  scale: number;
  height: number;
  /** Spot from the game, before squeezing / spreading for tall screens. */
  spotX: number;
  spotZ: number;
  blood: string;
  body: THREE.Group;
  inner: THREE.Group;
  sprite: PixelSprite;
  idle: Rect[];
  run: Rect[];
  target: THREE.Vector3;
  boss: boolean;
  big: boolean;
  flash: number;
  squash: number;
  knock: number;
  /** Little hop when struck. */
  hopY: number;
  hopV: number;
  /** Dying: seconds since death (-1 while alive). */
  dead: number;
  born: number;
}

interface CompView {
  comp: number;
  body: THREE.Group;
  inner: THREE.Group;
  sprite: PixelSprite;
  idle: Rect[];
  run: Rect[];
  cd: number;
  home: THREE.Vector3;
  /** Formation spot before squeezing / spreading for tall screens. */
  homeX: number;
  homeZ: number;
  base: number;
  /** Squash/stretch: negative = crouched (wind-up), positive = stretched (release). */
  stretch: number;
  act: CompAct | null;
}

/** What a companion is in the middle of doing. Melee: dash → strike → back. Ranged: wind-up → fire. */
interface CompAct {
  kind: Attack;
  phase: 'windup' | 'dash' | 'strike' | 'back';
  t: number;
  target: number;
}

interface Shot {
  mesh: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  target: number;
  t: number;
  dur: number;
  arc: number;
  kind: Attack;
}

interface RaiderView {
  id: number;
  group: THREE.Group;
  sprite: PixelSprite;
  from: -1 | 1;
  light: THREE.PointLight;
  state: 'run' | 'caught' | 'escape';
  t: number;
  sparkle: number;
}

interface Chest {
  group: THREE.Group;
  sprite: PixelSprite;
  life: number;
  opened: boolean;
}

/** Quad builder over the dungeon atlas. */
class Quads {
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

  face(x: number, y: number, z: number, r: Rect, w = 1, h = 1) {
    this.quad([[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]], r, [0, 0, 1]);
  }

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

function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const SHOT_COLOR: Record<Attack, number> = { arrow: 0xffe6b0, bolt: 0x9fe6ff, storm: 0xc9a6ff, slash: 0xffffff, fire: 0xff8a3a, rune: 0x7dffb0, dark: 0xb46aff };
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

const BONE = '#b8ae9e';

/** What each monster bleeds: dark red for most, ooze for slugs and the undead, chips for bones, frost for the frozen. */
function bloodOf(sprite: string): string {
  if (sprite === 'skelet') return BONE;
  if (sprite === 'ice_zombie') return '#6fb0d0';
  if (sprite.includes('slug') || sprite === 'swampy') return '#4c7e1e';
  if (sprite.includes('zombie')) return '#4a6420';
  if (sprite === 'muddy') return '#5a3c20';
  return '#7c0f16';
}

/**
 * The chamber: an HD-2D dungeon room. Your companions hold the left side; monsters pour
 * up the stairs on the right and take their places to be clicked to pieces.
 */
export class Scene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private tiltH: ShaderPass;
  private tiltV: ShaderPass;
  private fx: Fx;
  private atlas: Atlas;
  private container: HTMLElement;
  private glow = glowTexture();

  private room: THREE.Group | null = null;
  private wallMat: THREE.MeshLambertMaterial;
  private floorMat: THREE.MeshLambertMaterial;
  private hemi: THREE.HemisphereLight;
  private key: THREE.DirectionalLight;
  private torchLights: THREE.PointLight[] = [];
  private flames: THREE.Mesh[] = [];
  private flameMat: THREE.MeshBasicMaterial;
  private palette = PALETTES[0];
  private band = -1;
  /** Animated scenery (fountains, eyes in the wall), rebuilt with the room. */
  private props: PixelSprite[] = [];

  private mons = new Map<number, MonView>();
  private party: CompView[] = [];
  private shots: Shot[] = [];
  private raider: RaiderView | null = null;
  private leaving: RaiderView[] = [];
  private chests: Chest[] = [];
  private shake = 0;
  private time = 0;
  private fever = 0;
  private hitstop = 0;
  /** Screen space covered by UI: the camera frames the fight in what's left. */
  private view = { right: 0, bottom: 0, top: 0 };
  /** Portrait screens pull the battle line together so both sides fit. */
  private squeeze = 1;
  /** …and spreads it out in depth instead, which tall screens have plenty of room for. */
  private deep = 1;
  private look = LOOK.clone();
  private camBase = new THREE.Vector3();
  settings = { particles: true, shake: true, blood: true, cinematics: true };
  /** Zone-change interlude: the party leaves, descends a spiral staircase, arrives somewhere new. */
  private cine: { phase: 'exit' | 'stairs' | 'arrive'; t: number; zone: number; walkers: PixelSprite[]; shadows: THREE.Mesh[]; well: THREE.Group | null; flames: THREE.Mesh[] } | null = null;
  /** Black card in front of the camera for fades. */
  private fade: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** Deepest zone reached this descent: entering a deeper one plays the staircase. */
  private seenZone = 0;
  /** Called when the party arrives in the new zone (the UI shows the title card then). */
  onArrive: (() => void) | null = null;

  constructor(container: HTMLElement, atlas: Atlas) {
    this.container = container;
    this.atlas = atlas;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    // Phones have tiny, dense screens and weaker GPUs: cap the resolution a bit lower there.
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0a0708);
    this.scene.fog = new THREE.Fog(0x0a0708, 22, 44);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.45, 0.85);
    this.composer.addPass(this.bloom);
    this.tiltH = new ShaderPass(tiltShift());
    this.tiltV = new ShaderPass(tiltShift());
    for (const p of [this.tiltH, this.tiltV]) {
      p.uniforms.band.value = 0.3;
      this.composer.addPass(p);
    }
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    this.fx = new Fx(this.scene);
    this.wallMat = new THREE.MeshLambertMaterial({ map: atlas.texture, alphaTest: 0.5 });
    this.floorMat = new THREE.MeshLambertMaterial({ map: atlas.texture, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(1.1, 1.05, 1.02) });
    this.flameMat = new THREE.MeshBasicMaterial({ map: flameTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

    this.hemi = new THREE.HemisphereLight(0x6a5a78, 0x120a0c, 1.5);
    this.key = new THREE.DirectionalLight(0xffe2c0, 1.1);
    this.key.position.set(-4, 10, 12);
    this.scene.add(this.hemi, this.key);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xff9a4a, 5, 11, 1.6);
      this.scene.add(l);
      this.torchLights.push(l);
    }
    this.fade = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    this.fade.position.z = -0.2;
    this.fade.renderOrder = 1000;
    this.fade.visible = false;
    this.camera.add(this.fade);
    this.scene.add(this.camera);
    this.setBand(0);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  /** Space the UI covers on the right (desktop) or bottom (phone), so the fight centres in what's left. */
  setViewport(right: number, bottom: number, top = 0) {
    if (right === this.view.right && bottom === this.view.bottom && top === this.view.top) return;
    this.view = { right, bottom, top };
    this.resize();
  }

  private resize() {
    const w = this.container.clientWidth || innerWidth;
    const h = this.container.clientHeight || innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    const { right, bottom, top } = this.view;
    const freeW = Math.max(160, w - right);
    const freeH = Math.max(140, h - bottom - top);
    // Shift the frustum so its centre lands in the middle of the free area.
    const cx = freeW / 2;
    const cy = top + freeH / 2;
    const fullW = 2 * Math.max(cx, w - cx);
    const fullH = 2 * Math.max(cy, h - cy);
    this.camera.aspect = fullW / fullH;
    this.camera.setViewOffset(fullW, fullH, fullW / 2 - cx, fullH / 2 - cy, w, h);
    this.camera.updateProjectionMatrix();
    // Wide screens show the whole battle line; tall ones squeeze it and zoom in.
    const portrait = freeW < freeH * 1.1;
    this.squeeze = portrait ? 0.72 : 1;
    this.deep = portrait ? 1.7 : 1;
    this.look.set(portrait ? -0.9 : 0, LOOK.y, LOOK.z);
    const across = portrait ? 10 : 17;
    const tall = portrait ? 11 : 8;
    const t = Math.tan(THREE.MathUtils.degToRad(15));
    const dist = Math.max((across * fullH) / (2 * t * freeW), (tall * fullH) / (2 * t * freeH));
    // Tall screens look down more steeply, so depth turns into usable vertical space.
    const tilt = portrait ? 0.62 : 0.26;
    this.camBase.set(this.look.x, this.look.y + dist * tilt, this.look.z + dist);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = dist + 8;
    fog.far = dist + 30;
    this.tiltH.uniforms.step.value.set(1.1 / w, 0);
    this.tiltV.uniforms.step.value.set(0, 1.1 / h);
    this.tiltH.uniforms.focus.value = this.tiltV.uniforms.focus.value = 1 - cy / h;
  }

  // ---------- chamber ----------

  private setBand(band: number) {
    if (band === this.band) return;
    this.band = band;
    this.palette = PALETTES[band % PALETTES.length];
    if (this.room) {
      this.scene.remove(this.room);
      this.room.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
    }
    for (const pr of this.props) pr.dispose();
    this.props = [];
    this.room = this.buildRoom(band);
    this.scene.add(this.room);
    const p = this.palette;
    this.floorMat.color.setRGB(...p.floor);
    (this.scene.background as THREE.Color).setHex(p.fog);
    (this.scene.fog as THREE.Fog).color.setHex(p.fog);
    this.hemi.color.setHex(p.hemi);
    this.wallMat.color.setRGB(...p.wall);
    for (const l of this.torchLights) l.color.setHex(p.torch);
    // Flames burn in the zone's colour: teal in the crypts, green in the jungle, and so on.
    this.flameMat.color.setHex(p.torch).lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(1.4);
  }

  private buildRoom(seed: number): THREE.Group {
    const a = this.atlas;
    const r = seeded(seed * 977 + 5);
    const p = this.palette;
    const theme: Tiles = ZONES[seed % ZONES.length].tiles;
    const wall = new Quads(a);
    const floor = new Quads(a);
    // Tile names for each theme. The jungle and tomb sets come from Omniboy's packs.
    const pre = theme === 'jungle' || theme === 'tomb' ? `${theme}_` : '';
    const floors = theme === 'crypt'
      ? Array.from({ length: 20 }, (_, i) => a.rect(`crypt_floor_${i + 1}`))
      : [1, 2, 3, 4, 5, 6, 7, 8].map((i) => a.rect(`${pre}floor_${i}`));
    const tile = () => (theme === 'crypt' ? floors[Math.floor(r() * floors.length)] : r() < 0.72 ? floors[0] : floors[1 + Math.floor(r() * 7)]);
    const mids = pre ? [a.rect(`${pre}wall_mid`), a.rect(`${pre}wall_mid_2`), a.rect(`${pre}wall_mid_3`)] : [a.rect('wall_mid')];
    const mid = () => mids[r() < 0.8 ? 0 : Math.floor(r() * mids.length)];
    const top = a.rect(pre ? `${pre}wall_top` : 'wall_top_mid');
    const banner = a.rect(`${pre}wall_banner_${p.banner}`);
    const holes = [a.rect(`${pre}wall_hole_1`), a.rect(`${pre}wall_hole_2`)];
    // Leafy walls in the jungle, carved walls in the tomb, goo elsewhere.
    const deco = pre ? [1, 2, 3, 4, 5].map((i) => a.rect(`${pre}wall_deco_${i}`)) : [a.rect('wall_goo')];
    const decoChance = pre ? 0.07 : p.goo;
    // One fountain per room, set into the back wall, and (jungle / tomb) a pair of watching eyes.
    const fountainX = -2;
    const eyes = pre ? [-8 + Math.floor(r() * 3), 7 + Math.floor(r() * 4)] : [];
    const skip = (x: number, y: number) => (x === fountainX && y <= 2) || (eyes.includes(x) && y === 3);

    for (let x = -24; x < 24; x++) {
      for (let y = 0; y < 13; y++) {
        if (skip(x, y)) continue;
        const roll = r();
        const rect = y === 12 ? top
          : y === 5 && (x === -9 || x === 5 || x === 12) ? banner
          : roll < 0.035 ? holes[Math.floor(r() * 2)]
          : roll < 0.035 + decoChance ? deco[Math.floor(r() * deco.length)] : mid();
        wall.face(x, y, WALL_Z, rect);
      }
      for (let z = WALL_Z; z < 16; z++) floor.top(x, 0, z, tile());
    }
    floor.top(Math.floor(STAIRS.x), 0.005, Math.floor(STAIRS.z), a.rect('floor_stairs'));

    // Animated scenery.
    const prop = (frames: Rect[], x: number, y: number, fps = 6) => {
      const sp = new PixelSprite(a.texture, a.size, frames, { fps });
      sp.mesh.material = this.wallMat;
      sp.mesh.position.set(x + 0.5, y, WALL_Z + 0.01);
      this.props.push(sp);
      return sp.mesh;
    };
    const fountain: THREE.Object3D[] = [];
    if (pre) {
      const kind = theme === 'tomb' ? 'lava' : 'water';
      fountain.push(prop([a.rect(`${pre}fountain_top`)], fountainX, 2), prop(a.anim(`${pre}fountain_${kind}`), fountainX, 1), prop(a.anim(`${pre}fountain_${kind}_basin`), fountainX, 0));
      for (const x of eyes) fountain.push(prop(a.anim(`${pre}wall_eyes`), x, 3, 1.5));
    } else {
      const c = seed % 2 ? 'blue' : 'red';
      fountain.push(prop([a.rect('wall_fountain_top_1')], fountainX, 2), prop(a.anim(`wall_fountain_mid_${c}`), fountainX, 1), prop(a.anim(`wall_fountain_basin_${c}`), fountainX, 0));
    }

    // Columns (or statues) along the back wall, in front of the brick.
    const pillars = pre ? [a.rect(`${pre}statue_1`), a.rect(`${pre}statue_2`)] : [a.rect('column')];
    [-13, -5.5, 2, 9.5].forEach((x, i) => {
      const pr = pillars[i % pillars.length];
      floor.face(x - 0.5, 0, WALL_Z + 0.35, pr, pr.w / 16, pre ? pr.h / 16 : 3);
    });
    const skull = a.rect('skull');
    const crate = a.rect('crate');
    for (let i = 0; i < 10; i++) floor.face(-14 + r() * 28, 0, WALL_Z + 0.5 + r() * 0.6, r() < 0.6 ? skull : crate, 0.8, r() < 0.6 ? 0.8 : 1.2);

    const group = new THREE.Group();
    group.add(new THREE.Mesh(wall.build(), this.wallMat), new THREE.Mesh(floor.build(), this.floorMat), ...fountain);
    this.flames = [];
    [-12, -2, 6, 14].forEach((x, i) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), this.flameMat);
      f.position.set(x - 0.5, 4.3, WALL_Z + 0.1);
      group.add(f);
      this.flames.push(f);
      this.torchLights[i].position.set(x - 0.5, 4.3, WALL_Z + 1.2);
    });
    return group;
  }

  // ---------- party ----------

  /** Show one fighter per companion you've hired. */
  syncParty(game: Game, instant = false) {
    for (let i = 0; i < COMPS.length; i++) {
      const has = this.party.find((p) => p.comp === i);
      if (game.s.owned[i] > 0 && !has) this.addComp(i, instant);
      if (game.s.owned[i] === 0 && has) {
        this.scene.remove(has.body);
        has.sprite.dispose();
        this.party.splice(this.party.indexOf(has), 1);
      }
    }
  }

  private addComp(i: number, instant: boolean) {
    const def = COMPS[i];
    const { idle, run } = this.atlas.creature(def.sprite);
    const sprite = new PixelSprite(this.atlas.texture, this.atlas.size, idle, { fps: 6 + Math.random() * 2 });
    const body = new THREE.Group();
    const inner = new THREE.Group();
    const base = def.big ? 1 : 1.25;
    inner.scale.setScalar(base);
    inner.add(sprite.mesh);
    body.add(inner, blobShadow(def.big ? 1.6 : 0.9));
    const [x, z] = PARTY_SLOTS[i % PARTY_SLOTS.length];
    const home = new THREE.Vector3(x, 0, z);
    home.x = x * this.squeeze;
    home.z = z * this.deep;
    body.position.copy(instant ? home : new THREE.Vector3(-16, 0, z));
    this.scene.add(body);
    this.party.push({ comp: i, body, inner, sprite, idle, run, cd: Math.random(), home, homeX: x, homeZ: z, base, stretch: 0, act: null });
    if (!instant) this.fx.light(home.clone().setY(1.5), 0xffd070, 12, 0.5, 6);
  }

  private monsterPos(id: number): THREE.Vector3 | null {
    const v = this.mons.get(id);
    return v && v.dead < 0 ? v.body.position : null;
  }

  private updateParty(dt: number, game: Game) {
    const targets = game.monsters.filter((m) => m.arrive <= 0);
    const focus = targets[0];
    const haste = 1 + this.fever;
    for (const c of this.party) {
      c.home.x = c.homeX * this.squeeze;
      c.home.z = c.homeZ * this.deep;
      const def = COMPS[c.comp];
      const p = c.body.position;
      const a = c.act;
      let moving = false;
      if (!a) {
        // Idle at home (walking back in if just hired), waiting for the next swing.
        const d = c.home.clone().sub(p);
        if (d.length() > 0.05) {
          p.add(d.multiplyScalar(Math.min(1, dt * 3)));
          moving = true;
        }
        c.cd -= dt * haste;
        if (c.cd <= 0 && targets.length && game.dps() > 0) {
          const t = Math.random() < 0.6 && focus ? focus : targets[Math.floor(Math.random() * targets.length)];
          c.act = def.attack === 'slash' ? { kind: 'slash', phase: 'dash', t: 0, target: t.id } : { kind: def.attack, phase: 'windup', t: 0.14, target: t.id };
        }
      } else if (a.phase === 'windup') {
        a.t -= dt * haste;
        c.stretch = -1;
        if (a.t <= 0) {
          c.stretch = 1;
          this.fire(c, a.kind, a.target);
          this.endAct(c);
        }
      } else if (a.phase === 'dash') {
        // Sprint up to the target and stop just in front of it.
        let at = this.monsterPos(a.target);
        if (!at && focus) {
          a.target = focus.id;
          at = this.monsterPos(focus.id);
        }
        if (!at) a.phase = 'back';
        else {
          const dest = at.clone().add(new THREE.Vector3(def.big ? -1.5 : -0.9, 0, 0.05));
          const d = dest.sub(p);
          const len = d.length();
          const step = 15 * haste * dt;
          if (len <= step) {
            p.add(d);
            a.phase = 'strike';
            a.t = 0.18;
            this.strike(c, a.target);
          } else {
            p.add(d.multiplyScalar(step / len));
            c.sprite.flip = d.x < 0;
            moving = true;
            // Kick up dust as they run.
            if (this.settings.particles && Math.random() < dt * 20) this.fx.burst(p.clone().setY(0.1), '#6a5a50', 1, 0.8, 0.06, 4);
          }
        }
      } else if (a.phase === 'strike') {
        a.t -= dt * haste;
        if (a.t <= 0) a.phase = 'back';
      } else if (a.phase === 'back') {
        const d = c.home.clone().sub(p);
        const len = d.length();
        const step = 11 * haste * dt;
        if (len <= step) {
          p.copy(c.home);
          c.sprite.flip = false;
          this.endAct(c);
        } else {
          p.add(d.multiplyScalar(step / len));
          c.sprite.flip = d.x < 0;
          moving = true;
        }
      }
      c.sprite.play(moving ? c.run : c.idle);
      // Squash and stretch ease back to rest.
      c.stretch += (0 - c.stretch) * Math.min(1, dt * (c.stretch < 0 ? 4 : 12));
      const sx = 1 - c.stretch * 0.12;
      const sy = 1 + c.stretch * 0.14;
      c.inner.scale.set(c.base * sx, c.base * sy, c.base);
      // Lean into the swing during a strike.
      c.inner.rotation.z = a?.phase === 'strike' ? -0.25 : c.inner.rotation.z * 0.8;
      c.sprite.update(dt);
    }
  }

  private endAct(c: CompView) {
    c.act = null;
    c.cd = 0.8 + Math.random() * 0.9;
  }

  /** A melee companion's blow landing. */
  private strike(c: CompView, id: number) {
    const v = this.mons.get(id);
    if (!v || v.dead >= 0) return;
    const big = COMPS[c.comp].big;
    const at = v.body.position.clone().setY(v.height * 0.45);
    c.stretch = 1;
    this.fx.swipe(at, 0xfff0d8, big ? 1.5 : 0.95, Math.PI * (0.6 + Math.random() * 0.5));
    this.fx.star(at.clone().setX(at.x - 0.2), 0xffffff, big ? 1.1 : 0.7);
    this.react(v, big ? 0.6 : 0.3);
    this.bleed(v, at, big ? 8 : 4, !!big);
    if (big) {
      this.fx.ring(v.body.position, 0xffd070, 2.2);
      this.addShake(0.1);
    }
    if (this.settings.particles) this.fx.burst(at, '#ffffff', 4, 2.5, 0.06, 8, true);
  }

  /** A ranged companion lets loose. */
  private fire(c: CompView, kind: Attack, id: number) {
    const view = this.mons.get(id);
    if (!view || view.dead >= 0) return;
    const def = COMPS[c.comp];
    const from = c.body.position.clone().add(new THREE.Vector3(0.35, def.big ? 1.6 : 0.95, 0.1));
    const to = view.body.position.clone().setY(view.height * 0.45);
    this.fx.star(from, SHOT_COLOR[kind], 0.5, 0.12);
    if (kind === 'bolt') {
      // Staff crackles as the spell goes up.
      if (this.settings.particles) this.fx.burst(from.clone().setY(from.y + 0.3), '#cfefff', 6, 2, 0.05, -2, true);
      // Lightning is instant: straight to the impact.
      this.impact({ mesh: new THREE.Object3D(), from, to, target: id, t: 1, dur: 0, arc: 0, kind });
      return;
    }
    if (kind === 'storm') {
      // Chain lightning: from the staff to the target, then on to the two monsters nearest it.
      const others = [...this.mons.values()].filter((m) => m.id !== id && m.dead < 0 && m.born >= 1)
        .sort((a, b) => a.body.position.distanceTo(view.body.position) - b.body.position.distanceTo(view.body.position)).slice(0, 2);
      const hops = [view, ...others];
      this.fx.chain([from, ...hops.map((m) => m.body.position.clone().setY(m.height * 0.5))], SHOT_COLOR.storm);
      for (const m of hops) this.react(m, 0.25);
      this.addShake(0.03);
      return;
    }
    if (kind === 'rune') {
      // No projectile: a rune etches itself under the target and erupts.
      if (this.settings.particles) this.fx.burst(from, '#7dffb0', 5, 1.5, 0.05, -1, true);
      const foot = view.body.position.clone();
      this.fx.runeCircle(foot, SHOT_COLOR.rune, () => {
        const v = this.mons.get(id);
        const at = (v && v.dead < 0 ? v.body.position : foot).clone();
        this.impact({ mesh: new THREE.Object3D(), from, to: at.setY(0.6), target: id, t: 1, dur: 0, arc: 0, kind: 'rune' });
      }, view.boss ? 2 : 1.1);
      return;
    }
    let mesh: THREE.Object3D;
    if (kind === 'arrow') {
      const s = new PixelSprite(this.atlas.texture, this.atlas.size, [this.atlas.rect('weapon_arrow')], { anchor: 'center' });
      s.mesh.rotation.z = -Math.PI / 2;
      mesh = new THREE.Group().add(s.mesh);
    } else {
      // Fireball / void orb: a crisp pixel core over a soft glow.
      const tex = spellTextures();
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: kind === 'fire' ? tex.fire : tex.void, color: new THREE.Color(1.25, 1.25, 1.25), transparent: true, depthWrite: false }));
      core.scale.setScalar(kind === 'fire' ? 0.7 : 0.6);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: new THREE.Color(SHOT_COLOR[kind]).multiplyScalar(1.2), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(kind === 'fire' ? 1.2 : 1.2);
      mesh = new THREE.Group().add(halo, core);
    }
    mesh.position.copy(from);
    this.scene.add(mesh);
    const dist = from.distanceTo(to);
    const speed = kind === 'arrow' ? 24 : kind === 'fire' ? 12 : 10;
    this.shots.push({ mesh, from, to, target: id, t: 0, dur: dist / speed, arc: kind === 'arrow' ? 0.7 : kind === 'fire' ? 0.6 : 0.3, kind });
  }

  private updateShots(dt: number) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      // Home in on the target if it's still standing.
      const v = this.mons.get(s.target);
      if (v && v.dead < 0) s.to.set(v.body.position.x, v.height * 0.45, v.body.position.z);
      s.t += dt / s.dur;
      const t = Math.min(1, s.t);
      s.mesh.position.lerpVectors(s.from, s.to, t);
      s.mesh.position.y += Math.sin(t * Math.PI) * s.arc;
      if (s.kind === 'dark') {
        // Dark orbs corkscrew in.
        const r = 0.35 * (1 - t);
        s.mesh.position.y += Math.sin(t * Math.PI * 5) * r;
        s.mesh.position.z += Math.cos(t * Math.PI * 5) * r;
      }
      if (s.kind === 'arrow') s.mesh.rotation.z = Math.atan2(Math.cos(t * Math.PI) * s.arc * Math.PI, s.from.distanceTo(s.to));
      if (s.kind === 'fire' || s.kind === 'dark') {
        // Comet trail of fading copies, plus embers / sparks.
        const tex = spellTextures();
        this.fx.afterimage(s.mesh.position, s.kind === 'fire' ? tex.fire : tex.void, s.kind === 'fire' ? 0xb05a20 : 0x8050c0, s.kind === 'fire' ? 0.55 : 0.5, 0.18);
        (s.mesh.children[1] as THREE.Sprite).material.rotation = this.time * (s.kind === 'fire' ? 8 : -6);
        s.mesh.children[0].scale.setScalar(1.2 * (0.9 + Math.sin(this.time * 30) * 0.12));
      }
      if (this.settings.particles) {
        if (s.kind === 'fire' && Math.random() < 0.6) this.fx.burst(s.mesh.position.clone(), '#ffb040', 1, 1, 0.06, -2, true);
        else if (s.kind === 'dark' && Math.random() < 0.6) {
          // Sparks circling the orb.
          const a = this.time * 14;
          this.fx.burst(s.mesh.position.clone().add(new THREE.Vector3(Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0.1)), '#e0c0ff', 1, 0.3, 0.05, 0, true);
        } else if (s.kind === 'arrow' && Math.random() < 0.5) this.fx.burst(s.mesh.position.clone(), '#fff2d0', 1, 0.2, 0.035, 0, true);
      }
      if (t >= 1) {
        this.impact(s);
        this.scene.remove(s.mesh);
        s.mesh.traverse((o) => {
          if (o instanceof THREE.Sprite) o.material.dispose();
        });
        this.shots.splice(i, 1);
      }
    }
  }

  private impact(s: Shot) {
    const v = this.mons.get(s.target);
    const at = s.to.clone();
    if (v && v.dead < 0) {
      this.react(v, s.kind === 'fire' ? 0.35 : 0.2);
      if (s.kind === 'arrow' || s.kind === 'dark') this.bleed(v, at, 2, false);
    }
    const col = SHOT_COLOR[s.kind];
    const parts = this.settings.particles;
    switch (s.kind) {
      case 'bolt':
        // Called down from above onto the target, not zapped across the room.
        this.fx.lightning(at, col);
        this.addShake(0.04);
        break;
      case 'fire':
        // Burst of flame: bright flash, fiery ring on the floor, embers that fall back down.
        this.fx.star(at, 0xffe0a0, 1.3, 0.18);
        this.fx.ring(at.clone().setY(0), 0xff7a2a, 1.8, 0.35);
        this.fx.light(at, 0xff8a3a, 18, 0.25, 7);
        if (parts) {
          this.fx.burst(at, '#ffcf5a', 10, 3.5, 0.07, 5, true);
          this.fx.burst(at, '#ff5a1a', 12, 2.5, 0.08, 9, true);
        }
        break;
      case 'dark':
        // Collapse inward, then a violet pop.
        this.fx.aura(at, col, 0.9, 0.25);
        this.fx.star(at, 0xe0c0ff, 1, 0.16);
        this.fx.light(at, col, 12, 0.2, 6);
        if (parts) this.fx.burst(at, '#b46aff', 10, 2.8, 0.06, 1, true);
        break;
      case 'rune':
        // Eruption: a column of green light, a shockwave ring and chips of stone.
        this.fx.pillar(at.clone().setY(0), 0x2f8a5a, 2.2, 0.35);
        this.fx.ring(at.clone().setY(0), col, 2.2, 0.4);
        this.fx.light(at, col, 12, 0.25, 7);
        this.addShake(0.05);
        if (parts) {
          this.fx.burst(at.clone().setY(0.2), '#b8f5d2', 10, 4, 0.06, 6, true);
          this.fx.burst(at.clone().setY(0.1), '#8a8078', 12, 4.5, 0.09, 16);
        }
        break;
      default:
        this.fx.star(at, 0xffffff, 0.6);
        if (parts) this.fx.burst(at, hex(col), 4, 2, 0.05, 8, true);
    }
  }

  /** Droplets spraying away from the blow, and sometimes a drip on the floor. */
  private bleed(v: MonView, at: THREE.Vector3, n: number, heavy: boolean) {
    if (!this.settings.blood) return;
    // Thrown away from the party (to the right), landing as little stains.
    this.fx.spray(at.clone().setX(at.x + 0.2), v.blood, n, 1, heavy ? 1.3 : 1);
  }

  /** Visible reaction to being hit: white flash, squash, knocked back, a little hop. */
  private react(v: MonView, force: number) {
    v.flash = Math.max(v.flash, 0.35 + force);
    v.squash = Math.max(v.squash, force * 1.4);
    v.knock = Math.max(v.knock, force * (v.boss ? 0.4 : 0.9));
    if (!v.boss && v.hopY <= 0.001) v.hopV = 2 + force * 4;
  }

  // ---------- monsters ----------

  private addMonster(m: Monster) {
    const { idle, run } = this.atlas.creature(m.def.sprite);
    const sprite = new PixelSprite(this.atlas.texture, this.atlas.size, run, { fps: 9, flip: true });
    const body = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(sprite.mesh);
    body.add(inner, blobShadow(m.boss ? 2.2 : 0.9));
    body.position.copy(STAIRS).add(new THREE.Vector3(Math.random() * 0.6, 0, Math.random() * 0.6));
    body.scale.setScalar(0.01);
    this.scene.add(body);
    // Ordinary monsters ~1.2× (tall ones capped at ~2 units); bosses ~3.4 units tall whatever their art.
    const h = run[0].h / 16;
    const scale = m.boss ? Math.max(1.5, Math.min(2.6, 3.4 / h)) : Math.min(1.2, 2.1 / h);
    inner.scale.setScalar(scale);
    if (m.def.tint !== undefined) sprite.mesh.material.color.setHex(m.def.tint);
    this.mons.set(m.id, { id: m.id, scale, height: h * scale, spotX: m.x, spotZ: m.z, blood: bloodOf(m.def.sprite), body, inner, sprite, idle, run, target: new THREE.Vector3(m.x * this.squeeze, 0, m.z * this.deep), boss: m.boss, big: !!m.def.big || m.boss, flash: 0, squash: 0, knock: 0, hopY: 0, hopV: 0, dead: -1, born: 0 });
    if (this.settings.particles) this.fx.burst(STAIRS.clone().setY(0.4), '#6a5a78', 6, 2, 0.08, 6);
    if (m.boss) {
      this.fx.light(STAIRS.clone().setY(2), 0xff4040, 30, 1, 12);
      this.addShake(0.3);
    }
  }

  private removeView(v: MonView) {
    this.scene.remove(v.body);
    v.sprite.dispose();
    this.mons.delete(v.id);
  }

  private updateMonsters(dt: number, game: Game) {
    const alive = new Set(game.monsters.map((m) => m.id));
    for (const m of game.monsters) if (!this.mons.has(m.id)) this.addMonster(m);
    for (const v of [...this.mons.values()]) {
      if (v.dead >= 0) {
        // Already shattered into pixels; keep the (hidden) view a moment so the UI can place gold on it.
        v.dead += dt;
        if (v.dead > 0.2) this.removeView(v);
        continue;
      }
      if (!alive.has(v.id)) {
        // Gone without dying (floor change): vanish in a puff.
        if (this.settings.particles) this.fx.burst(v.body.position.clone().setY(0.5), '#6a5a78', 8, 2, 0.08, 6);
        this.removeView(v);
        continue;
      }
      v.target.x = v.spotX * this.squeeze;
      v.target.z = v.spotZ * this.deep;
      v.born = Math.min(1, v.born + dt * 3);
      v.body.scale.setScalar(v.born < 1 ? v.born * (1 + Math.sin(v.born * Math.PI) * 0.3) : 1);
      const p = v.body.position;
      const d = v.target.clone().sub(p).setY(0);
      const len = d.length();
      if (len > 0.05) {
        p.add(d.multiplyScalar(Math.min(1, (v.boss ? 2.5 : 6) * dt / len)));
        v.sprite.play(v.run);
      } else v.sprite.play(v.idle);
      v.flash = Math.max(0, v.flash - dt * 9);
      v.squash = Math.max(0, v.squash - dt * 4);
      v.knock = Math.max(0, v.knock - dt * 2.5);
      v.hopV -= 30 * dt;
      v.hopY = Math.max(0, v.hopY + v.hopV * dt);
      if (v.hopY === 0) v.hopV = 0;
      v.sprite.flash = v.flash;
      const base = v.scale;
      v.inner.scale.set(base * (1 + v.squash * 0.25), base * (1 - v.squash * 0.3), base);
      v.inner.position.x = v.knock;
      v.inner.position.y = v.hopY;
      v.sprite.update(dt);
    }
  }

  // ---------- treasure goblin ----------

  private spawnRaider(id: number, from: -1 | 1) {
    const { run } = this.atlas.creature('goblin');
    const s = new PixelSprite(this.atlas.texture, this.atlas.size, run, { fps: 14 });
    s.flip = from > 0;
    s.mesh.material.emissive.setRGB(0.3, 0.22, 0);
    const group = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.setScalar(1.5);
    inner.add(s.mesh);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.6, 0.6), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const light = new THREE.PointLight(0xffd070, 10, 6, 1.5);
    light.position.set(0, 1.4, 0.8);
    group.add(inner, ring, light, blobShadow(0.9));
    group.position.set(from * -14, 0, 4);
    this.scene.add(group);
    this.raider = { id, group, sprite: s, from, light, state: 'run', t: 0, sparkle: 0 };
  }

  private updateRaiders(dt: number, game: Game) {
    const r = this.raider;
    if (r && game.raid && game.raid.id === r.id) {
      const t = game.raid.t;
      // Zig-zags across the front of the chamber, taunting you.
      r.group.position.x = r.from * -14 + r.from * 28 * t;
      r.group.position.y = Math.abs(Math.sin(this.time * 10)) * 0.2;
      r.group.position.z = 3.6 + Math.sin(t * Math.PI * 4) * 0.8;
      r.light.intensity = 9 + Math.sin(this.time * 10) * 3;
      r.sprite.update(dt);
      r.sparkle -= dt;
      if (r.sparkle <= 0 && this.settings.particles) {
        r.sparkle = 0.1;
        this.fx.burst(r.group.position.clone().setY(1.2), '#ffd070', 2, 1.2, 0.06, 1, true);
      }
    }
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const l = this.leaving[i];
      l.t += dt;
      if (l.state === 'caught') {
        l.group.position.y += dt * (3 - l.t * 8);
        l.group.rotation.z += dt * 9 * l.from;
      } else {
        l.group.position.x += l.from * dt * 8;
        l.sprite.update(dt);
      }
      const fade = Math.max(0, 1 - l.t / 0.8);
      l.group.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.Material) {
          o.material.transparent = true;
          o.material.opacity = Math.min(o.material.opacity, fade);
        }
      });
      l.light.intensity *= 0.9;
      if (l.t > 0.8) {
        this.scene.remove(l.group);
        l.sprite.dispose();
        this.leaving.splice(i, 1);
      }
    }
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const c = this.chests[i];
      c.life -= dt;
      if (!c.opened && c.life < 2.4) {
        c.opened = true;
        c.sprite.play(this.atlas.anim('chest_full_open'), 10, false);
        const at = c.group.position.clone();
        if (this.settings.particles) this.fx.burst(at.clone().setY(0.7), '#ffd070', 34, 5.5, 0.09, 9, true);
        this.fx.beam(at.x, at.z, '#ffd070', 4);
        this.fx.light(at.clone().setY(1.5), 0xffd070, 30, 0.6, 9);
      }
      c.sprite.update(dt);
      if (c.life < 0.5) {
        c.sprite.mesh.material.transparent = true;
        c.sprite.mesh.material.opacity = c.life / 0.5;
      }
      if (c.life <= 0) {
        this.scene.remove(c.group);
        c.sprite.dispose();
        this.chests.splice(i, 1);
      }
    }
  }

  raiderScreen(): { x: number; y: number } | null {
    const r = this.raider;
    return r ? this.toScreen(r.group.position.clone().setY(2.6)) : null;
  }

  hitRaider(x: number, y: number): boolean {
    const r = this.raider;
    if (!r) return false;
    const c = this.toScreen(r.group.position.clone().setY(0.9));
    const e = this.toScreen(r.group.position.clone().setY(2));
    return Math.hypot(x - c.x, y - c.y) < Math.max(48, Math.abs(c.y - e.y) * 1.4);
  }

  // ---------- picking and screen positions ----------

  private toScreen(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (p.x * 0.5 + 0.5) * rect.width, y: rect.top + (-p.y * 0.5 + 0.5) * rect.height };
  }

  /** Screen position of a monster's head (for numbers and health bars), and its on-screen height. */
  screenOf(id: number): { x: number; y: number; h: number } | null {
    const v = this.mons.get(id);
    if (!v) return null;
    const height = v.height;
    const foot = this.toScreen(v.body.position);
    const head = this.toScreen(v.body.position.clone().setY(height));
    return { x: head.x, y: head.y, h: foot.y - head.y };
  }

  /** The living monster nearest the pointer, so every click lands on something. */
  pick(x: number, y: number): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const v of this.mons.values()) {
      if (v.dead >= 0 || v.born < 0.5) continue;
      const s = this.screenOf(v.id)!;
      const cy = s.y + s.h * 0.5;
      const dx = Math.max(0, Math.abs(x - s.x) - s.h * 0.35);
      const dy = Math.max(0, Math.abs(y - cy) - s.h * 0.55);
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = v.id;
      }
    }
    return best;
  }

  /** Is the pointer right on top of a monster? (for the cursor) */
  overMonster(x: number, y: number) {
    for (const v of this.mons.values()) {
      if (v.dead >= 0) continue;
      const s = this.screenOf(v.id)!;
      if (Math.abs(x - s.x) < s.h * 0.45 && y > s.y - 6 && y < s.y + s.h + 6) return true;
    }
    return false;
  }

  // ---------- events ----------

  handle(ev: GameEvent, game: Game) {
    switch (ev.t) {
      case 'hit': {
        const v = this.mons.get(ev.id);
        if (!v || v.dead >= 0 || ev.kind === 'dps') break;
        const at = v.body.position.clone().setY(v.height * 0.5);
        const parts = this.settings.particles;
        if (ev.kind === 'cleave') {
          this.fx.swipe(at, 0xffd0c0, v.boss ? 1.2 : 0.6);
          this.react(v, 0.15);
          break;
        }
        if (ev.kind === 'auto') {
          // Phantom Blade: a ghostly blue cut.
          this.fx.swipe(at, 0x9fd8ff, v.boss ? 1.3 : 0.75);
          this.react(v, 0.15);
          break;
        }
        const crit = ev.kind === 'crit';
        const color = crit ? 0xffd070 : ev.kind === 'fever' ? 0xff7a9a : 0xfff0d8;
        const size = (v.boss ? 1.8 : 1) * (crit ? 1.45 : 1);
        const angle = Math.random() * Math.PI * 2;
        this.fx.swipe(at, color, size, angle);
        if (crit) {
          // Crossed double cut, a burst ring and a moment of slow motion.
          this.fx.swipe(at, color, size * 1.05, angle + Math.PI / 2, 0.2);
          this.fx.star(at, 0xffffff, 1.8, 0.2);
          this.fx.ring(v.body.position, 0xffd070, v.boss ? 4 : 2.6, 0.35);
          this.fx.light(at, 0xffd070, 25, 0.25, 8);
          this.addShake(0.15);
          this.hitstop = Math.max(this.hitstop, 0.05);
        } else this.fx.star(at, 0xffffff, 0.8);
        if (parts) {
          if (crit) this.fx.burst(at, '#ffd070', 12, 5, 0.06, 9, true);
          this.bleed(v, at, crit ? 10 : 4, crit);
        }
        this.react(v, crit ? 0.8 : 0.45);
        break;
      }
      case 'kill': {
        const v = this.mons.get(ev.id);
        if (!v || v.dead >= 0) break;
        v.dead = 0;
        v.body.visible = false;
        const scale = v.scale;
        const unit = scale / 16;
        const r = v.sprite.rect;
        const origin = v.body.position.clone().add(new THREE.Vector3(v.knock, v.hopY, 0.05));
        // The monster bursts into its own pixels.
        this.fx.shatter(origin, this.atlas.pixels(r, v.boss ? 1 : 1), r, unit, v.sprite.flip, 1, v.boss ? 1.4 : 1);
        const at = origin.clone().setY(v.height * 0.45);
        this.fx.star(at, 0xffffff, v.boss ? 2.5 : 1.1, 0.18);
        if (this.settings.particles) {
          this.fx.burst(at, '#ffd070', v.boss ? 30 : 5, v.boss ? 6 : 3, 0.06, 12, true);
        }
        if (this.settings.blood) {
          this.fx.spray(at, v.blood, v.boss ? 30 : 10, 1, v.boss ? 1.5 : 1.1);
          if (v.blood !== BONE) this.fx.bloodSplat(v.body.position.clone().setX(v.body.position.x + 0.25), v.blood, v.boss ? 2.2 : 1);
        }
        if (ev.boss) {
          this.fx.shockwave(v.body.position.clone(), 8);
          this.fx.pillar(v.body.position.clone(), 0xffd070, 10, 1.4);
          this.fx.light(at, 0xffd070, 40, 0.8, 14);
          this.addShake(0.45);
          this.hitstop = 0.18;
        }
        break;
      }
      case 'floor': {
        const z = zoneOf(ev.floor);
        // First time into a deeper zone (however you got there): the staircase.
        const deeper = z > this.seenZone;
        this.seenZone = Math.max(this.seenZone, z);
        if (this.cine) this.cine.zone = z;
        else if (deeper && this.settings.cinematics) this.startCinematic(z);
        else this.setBand(z);
        break;
      }
      case 'bossFail':
      case 'retreat':
        this.addShake(0.2);
        break;
      case 'buyComp':
        this.syncParty(game);
        break;
      case 'raidSpawn':
        this.spawnRaider(ev.id, ev.from);
        break;
      case 'raidCatch': {
        const r = this.raider;
        if (!r) break;
        this.raider = null;
        r.state = 'caught';
        r.t = 0;
        this.leaving.push(r);
        const at = r.group.position.clone();
        if (this.settings.particles) this.fx.burst(at.clone().setY(1), '#ffffff', 22, 5, 0.09, 10, true);
        this.fx.light(at.clone().setY(1.2), 0xffd070, 25, 0.4, 8);
        this.addShake(0.15);
        const s = new PixelSprite(this.atlas.texture, this.atlas.size, [this.atlas.anim('chest_full_open')[0]], { fps: 10 });
        const g = new THREE.Group();
        g.scale.setScalar(1.6);
        g.add(s.mesh);
        g.position.set(at.x, 0, at.z);
        this.scene.add(g);
        this.chests.push({ group: g, sprite: s, life: 3, opened: false });
        break;
      }
      case 'raidEscape': {
        const r = this.raider;
        if (!r) break;
        this.raider = null;
        r.state = 'escape';
        r.t = 0;
        this.leaving.push(r);
        break;
      }
      case 'fever':
        if (ev.on) {
          this.fx.shockwave(new THREE.Vector3(3, 0, 0), 10);
          this.addShake(0.3);
          for (const c of this.party) this.fx.aura(c.body.position.clone().setY(0.9), 0xff4060, 1, 0.6);
        }
        break;
      case 'descend':
        for (const v of [...this.mons.values()]) this.removeView(v);
        break;
    }
  }

  /** Rebuild everything from the game state (after loading or descending). */
  rebuild(game: Game) {
    for (const c of this.party) {
      this.scene.remove(c.body);
      c.sprite.dispose();
    }
    this.party = [];
    this.syncParty(game, true);
    this.setBand(zoneOf(game.s.floor));
    this.seenZone = zoneOf(Math.max(game.s.floor, game.s.maxFloor - 1));
  }

  private addShake(v: number) {
    if (this.settings.shake) this.shake = Math.max(this.shake, v);
  }

  /** Hit-stop requested by big impacts (the main loop slows time briefly). */
  takeHitstop() {
    const h = this.hitstop;
    this.hitstop = 0;
    return h;
  }

  // ---------- zone interlude ----------

  /** True while the interlude holds the screen (the game pauses meanwhile). */
  get busy() {
    return !!this.cine && this.cine.phase !== 'arrive';
  }

  private startCinematic(zone: number) {
    this.cine = { phase: 'exit', t: 0, zone, walkers: [], shadows: [], well: null, flames: [] };
  }

  /** Tap to skip: straight to the arrival. */
  skip() {
    if (this.cine && this.cine.phase !== 'arrive') this.arrive();
  }

  private descend() {
    const c = this.cine!;
    c.phase = 'stairs';
    c.t = 0;
    // Dress the stairwell in the new zone's tiles and light.
    const pal = PALETTES[c.zone % PALETTES.length];
    const theme = ZONES[c.zone % ZONES.length].tiles;
    const pre = theme === 'jungle' || theme === 'tomb' ? `${theme}_` : '';
    const a = this.atlas;
    const floors = theme === 'crypt' ? [a.rect('crypt_floor_1'), a.rect('crypt_floor_5')] : [a.rect(`${pre}floor_1`), a.rect(`${pre}floor_2`)];
    // Back wall dim, stairs bright: the flights have to stand out from the tower wall.
    this.wallMat.color.setRGB(...pal.wall).multiplyScalar(0.7);
    this.floorMat.color.setRGB(...pal.floor).multiplyScalar(1.15);
    this.flameMat.color.setHex(pal.torch).lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(1.4);
    for (const l of this.torchLights) l.color.setHex(pal.torch);
    (this.scene.background as THREE.Color).setHex(pal.fog);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(pal.fog);
    fog.near = 20;
    fog.far = 50;
    const well = buildStairwell(a, { wall: a.rect(`${pre}wall_mid`), top: a.rect(pre ? `${pre}wall_top` : 'wall_top_mid'), floor: floors }, { wall: this.wallMat, floor: this.floorMat, flame: this.flameMat });
    c.well = well.group;
    c.flames = well.flames;
    this.scene.add(well.group);
    if (this.room) this.room.visible = false;
    for (const p of this.party) p.body.visible = false;
    // The walkers: up to five of your companions (or a lone squire).
    const who = this.party.length ? this.party.slice(0, 5).map((p) => COMPS[p.comp].sprite) : ['knight_m'];
    for (const sprite of who) {
      const { run } = a.creature(sprite);
      const w = new PixelSprite(a.texture, a.size, run, { fps: 10 });
      w.mesh.scale.multiplyScalar(1.2);
      this.scene.add(w.mesh);
      c.walkers.push(w);
      const sh = blobShadow(0.9);
      this.scene.add(sh);
      c.shadows.push(sh);
    }
  }

  private arrive() {
    const c = this.cine!;
    if (c.well) {
      this.scene.remove(c.well);
      c.well.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    for (const w of c.walkers) {
      this.scene.remove(w.mesh);
      w.dispose();
    }
    for (const sh of c.shadows) this.scene.remove(sh);
    c.walkers = [];
    c.shadows = [];
    this.hemi.intensity = 1.5;
    this.key.intensity = 1.1;
    for (const l of this.torchLights) l.distance = 11;
    c.well = null;
    c.phase = 'arrive';
    c.t = 0;
    this.band = -1;
    this.setBand(c.zone);
    if (this.room) this.room.visible = true;
    // Everyone walks in from the left.
    for (const p of this.party) {
      p.body.visible = true;
      p.act = null;
      p.body.position.set(-16 - Math.random() * 2, 0, p.home.z);
    }
    this.resize();
    this.onArrive?.();
  }

  private updateCinematic(dt: number) {
    const c = this.cine!;
    c.t += dt;
    let fade = 0;
    if (c.phase === 'exit') {
      // March out to the right, toward the stairs.
      for (const p of this.party) {
        p.body.position.x += dt * 9;
        p.sprite.flip = false;
        p.sprite.play(p.run);
        p.sprite.update(dt);
      }
      fade = Math.max(0, (c.t - 0.6) / 0.4);
      if (c.t >= 1) this.descend();
    } else if (c.phase === 'stairs') {
      const dur = 3.6;
      const lead = 1 + c.t * 5.4;
      c.walkers.forEach((w, i) => {
        const at = lead - i * 1.25;
        const p = stairPoint(at);
        w.mesh.position.set(p.x, p.y + Math.abs(Math.sin((c.t + i) * 11)) * 0.05, p.z + i * 0.02);
        w.mesh.rotation.set(0, 0, 0);
        w.flip = stairPoint(at + 0.3).x < p.x;
        c.shadows[i].position.set(p.x, p.y + 0.02, p.z);
        w.update(dt);
      });
      // Straight-on cutaway of the tower, panning down with the party.
      const head = stairPoint(lead - 2);
      const dist = this.camBase.z - this.look.z;
      const y = head.y + 1.2;
      this.camera.position.set(0, y + dist * 0.2, dist);
      this.camera.lookAt(0, y, 0);
      c.flames.forEach((f, i) => f.scale.set(1, 0.85 + Math.sin(this.time * 13 + i) * 0.12, 1));
      this.torchLights[0].position.set(head.x, head.y + 2, 2);
      this.torchLights[1].position.copy(stairPoint(lead + 8)).add(new THREE.Vector3(0, 2, 1));
      this.torchLights[0].intensity = 7;
      this.torchLights[1].intensity = 6;
      this.torchLights[0].distance = this.torchLights[1].distance = 12;
      this.hemi.intensity = 1.7;
      this.key.intensity = 1.4;
      const fog = this.scene.fog as THREE.Fog;
      fog.near = dist + 6;
      fog.far = dist + 30;
      fade = Math.max(0, 1 - c.t / 0.35, (c.t - (dur - 0.35)) / 0.35);
      if (c.t >= dur) this.arrive();
    } else {
      fade = Math.max(0, 1 - c.t / 0.45);
      if (c.t >= 1) this.cine = null;
    }
    this.fade.visible = fade > 0;
    this.fade.material.opacity = Math.min(1, fade);
  }

  // ---------- frame ----------

  update(dt: number, game: Game) {
    this.time += dt;
    const fever = game.s.buffs.some((b) => b.id === 'fever');
    this.fever += ((fever ? 1 : 0) - this.fever) * Math.min(1, dt * 4);

    if (this.cine?.phase !== 'stairs') this.flames.forEach((f, i) => {
      const fl = 0.85 + Math.sin(this.time * 13 + i * 2) * 0.08 + Math.sin(this.time * 7.3 + i) * 0.07;
      f.scale.set(1, fl, 1);
      this.torchLights[i].intensity = 6 * fl * (1 + this.fever * 0.5);
    });

    for (const pr of this.props) pr.update(dt);
    if (this.cine) this.updateCinematic(dt);
    const holding = this.cine && this.cine.phase !== 'arrive';
    this.updateMonsters(dt, game);
    if (!holding) this.updateParty(dt, game);
    this.updateShots(dt);
    this.updateRaiders(dt, game);
    this.fx.update(dt);

    const buffed = game.s.buffs.some((b) => b.id !== 'fever');
    this.bloom.strength = 0.42 + this.fever * 0.3 + (buffed ? 0.12 : 0);
    this.grade.uniforms.warmth.value = 0.06 + this.fever * 0.08;
    this.grade.uniforms.vignette.value = 0.55 + this.fever * 0.25;

    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sh = this.shake * this.shake * 2.2;
    if (this.cine?.phase !== 'stairs') {
      this.camera.position.set(this.camBase.x + (Math.random() - 0.5) * sh, this.camBase.y + (Math.random() - 0.5) * sh, this.camBase.z);
      this.camera.lookAt(this.look);
    }
    this.composer.render(dt);
  }
}
