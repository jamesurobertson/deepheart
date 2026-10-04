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
import { COMPS, ZONES, corruptionOf, tilesFor, zoneOf, type Attack, type CompDef, type Tiles } from '../game/data.ts';
import type { Game, GameEvent, Monster } from '../game/game.ts';

const WALL_Z = -6;
const STAIRS = new THREE.Vector3(7.5, 0, -4);
/** Where the camera looks: between the party and the monsters. */
const LOOK = new THREE.Vector3(0, 1.1, 0.5);

interface Palette { torch: number; fog: number; hemi: number; wall: [number, number, number]; floor: [number, number, number]; banner: string; goo: number }
/** Lighting per zone, in the same order as ZONES. Tiles with their own colour (jungle, tomb) get a lighter wash. */
const PALETTES: Palette[] = [
  { torch: 0xff9a4a, fog: 0x0a0708, hemi: 0x6a5a78, wall: [0.66, 0.58, 0.6], floor: [1.1, 1.05, 1.02], banner: 'red', goo: 0 }, // Upper Halls
  { torch: 0x5ad6c8, fog: 0x04090b, hemi: 0x4a6a78, wall: [0.46, 0.62, 0.68], floor: [0.92, 1.08, 1.18], banner: 'blue', goo: 0 }, // Bone Crypts
  { torch: 0xa6e06a, fog: 0x050904, hemi: 0x55704a, wall: [1.6, 1.8, 1.5], floor: [1.6, 1.7, 1.5], banner: 'green', goo: 0 }, // Overgrown Warrens
  { torch: 0xffb35a, fog: 0x0c0806, hemi: 0x7a6450, wall: [0.74, 0.66, 0.58], floor: [0.95, 0.9, 0.84], banner: 'yellow', goo: 0 }, // Sunken Tomb
  { torch: 0xb485ff, fog: 0x08060d, hemi: 0x5a4a82, wall: [0.56, 0.5, 0.66], floor: [1, 0.94, 1.1], banner: 'green', goo: 0.025 }, // Rotting Deep
  { torch: 0x8af0d8, fog: 0x04070b, hemi: 0x5a70a0, wall: [1.3, 1.55, 1.9], floor: [1.4, 1.55, 1.8], banner: 'blue', goo: 0 }, // Enchanted Grove
  { torch: 0xff5a3a, fog: 0x0b0505, hemi: 0x6a4a52, wall: [0.7, 0.44, 0.44], floor: [1.15, 0.95, 0.9], banner: 'red', goo: 0 }, // Demon Gate
  { torch: 0x9cc0ff, fog: 0x05070c, hemi: 0x5a6a8a, wall: [0.56, 0.72, 1], floor: [0.9, 1.1, 1.45], banner: 'blue', goo: 0 }, // Frozen Vault
];

/** The Goblin Vault: gilded stone, with torches that cycle through the rainbow (see update). */
const VAULT_PALETTE: Palette = { torch: 0xffd070, fog: 0x0d0616, hemi: 0x9a78b0, wall: [1.3, 1.08, 0.6], floor: [1.4, 1.2, 0.75], banner: 'yellow', goo: 0 };
/** Seconds the party runs toward the portal before the flash, and the fade back in after it. */
const TRIP_GO = 0.95;
const TRIP_ARRIVE = 0.55;

/** A zone's palette on a later lap: torches, light and stone pulled toward the lap's colour, the dark a shade deeper. */
function corrupt(p: Palette, lap: number): Palette {
  if (!lap) return p;
  const c = new THREE.Color(corruptionOf(lap).tint);
  const toward = (hex: number, k: number) => new THREE.Color(hex).lerp(c, k).getHex();
  const wash = (v: [number, number, number]): [number, number, number] => [v[0] * (0.3 + 0.7 * c.r), v[1] * (0.3 + 0.7 * c.g), v[2] * (0.3 + 0.7 * c.b)];
  return { ...p, torch: toward(p.torch, 0.85), hemi: toward(p.hemi, 0.75), fog: new THREE.Color(p.fog).lerp(c, 0.12).getHex(), wall: wash(p.wall), floor: wash(p.floor) };
}

/** Your hero's top walking speed (world units a second). */
const HERO_SPEED = 6.5;

/** Ordinary companions are drawn this many art pixels tall, whatever size their sprite is (big ones stay big). */
const COMP_HEIGHT = 20;

/** Formation slots for companions, front to back. */
const PARTY_SLOTS: [number, number][] = [
  [-3, 0.8], [-3.4, -1.4], [-3.7, 2.6], [-4.4, -0.2], [-4.8, 1.7], [-5, -2.4], [-5.8, 0.8], [-6, 2.8],
  [-6.2, -1.3], [-6.9, 1.9], [-7.2, -0.3], [-7.4, -2.5], [-8, 2.6], [-8.3, 0.8], [-8.8, -1.4], [-9.3, 1.6],
  // The Heart's recruits fill the gaps.
  [-4.1, 3.7], [-5.5, -3.5], [-6.5, 0.1], [-7.7, 1.3], [-5.2, 3.8], [-8.5, -2.9], [-6.6, -3.6], [-9, 0.2],
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
  /** Champions pulse gold and shed sparks; Goblin Vault hoarders glow softly. */
  glow: 'champ' | 'hoard' | null;
  /** A champion's gold ring at its feet. */
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null;
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
  rainbow: boolean;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
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
  /** Steering for your hero, set by the UI each frame: the pointer over the battlefield, and WASD / arrow keys. */
  heroInput: { aim: { x: number; y: number } | null; keys: { x: number; z: number }; stay: boolean } = { aim: null, keys: { x: 0, z: 0 }, stay: false };
  private heroRing: THREE.Mesh | null = null;
  private heroVel = new THREE.Vector3();
  /** Seconds the hero keeps facing what it just attacked before turning back to where it's walking. */
  private heroFace = 0;
  private heroComp = -1;
  private raycaster = new THREE.Raycaster();
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
  /** A pause (the loot card is up) before the staircase starts. */
  private hold: { zone: number; t: number } | null = null;
  private relicDropped = false;
  /** In the Goblin Vault's treasure room, and the portal trip in or out of it (the game pauses during the run-up). */
  private inVaultRoom = false;
  private trip: { into: boolean; phase: 'go' | 'arrive'; t: number; portal: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> } | null = null;
  private sparkleT = 0;
  private cine: { phase: 'exit' | 'stairs' | 'arrive'; t: number; zone: number; walkers: PixelSprite[]; shadows: THREE.Mesh[]; well: THREE.Group | null; flames: THREE.Mesh[] } | null = null;
  /** Black card in front of the camera for fades. */
  private fade: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** The floor we were last on: stepping down into a new zone plays the staircase. */
  private lastFloor = 1;
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
    // One camera everywhere: looking down steeply, the battle spread in depth rather than in a long line.
    // Wider screens pull back a little further to show more of the room around the fight.
    this.squeeze = 0.72;
    this.deep = 1.7;
    this.look.set(-0.9, LOOK.y, LOOK.z);
    const t = Math.tan(THREE.MathUtils.degToRad(15));
    // Short screens (landscape phones) frame the fight tighter so it doesn't shrink to specks.
    const roomy = freeW >= freeH && freeH >= 600 ? 1.15 : 1;
    const tall = freeH < 500 ? 8 : 11;
    const dist = Math.max((10 * fullH) / (2 * t * freeW), (tall * fullH) / (2 * t * freeH)) * roomy;
    const tilt = 0.62;
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
    this.palette = corrupt(PALETTES[band % PALETTES.length], Math.floor(band / ZONES.length));
    this.clearRoom();
    this.room = this.buildRoom(band);
    this.scene.add(this.room);
    this.applyPalette();
  }

  private clearRoom() {
    if (this.room) {
      this.scene.remove(this.room);
      this.room.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        if (o.userData.ownMaterial) o.material.dispose();
      });
    }
    for (const pr of this.props) pr.dispose();
    this.props = [];
  }

  /** Swap between the zone's room and the Goblin Vault's treasure room. */
  private setVaultRoom(on: boolean) {
    this.inVaultRoom = on;
    if (!on) {
      this.band = -1;
      this.setBand(zoneOf(this.lastFloor));
      return;
    }
    this.band = -2;
    this.palette = VAULT_PALETTE;
    this.clearRoom();
    this.room = this.buildRoom(0, true);
    this.scene.add(this.room);
    this.applyPalette();
  }

  private applyPalette() {
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

  private buildRoom(seed: number, loot = false): THREE.Group {
    const a = this.atlas;
    const r = seeded(seed * 977 + 5);
    const p = this.palette;
    const theme: Tiles = tilesFor(seed);
    const wall = new Quads(a);
    const floor = new Quads(a);
    // Tile names for each theme. The jungle and tomb sets come from Omniboy's packs.
    const pre = theme === 'jungle' || theme === 'tomb' ? `${theme}_` : '';
    const floors = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => a.rect(`${pre}floor_${i}`));
    // Crypts: ordinary flagstones with the Dark Dungeon's cracked, older tiles worked in.
    const cracked = Array.from({ length: 20 }, (_, i) => a.rect(`crypt_floor_${i + 1}`));
    // Omniboy's floor_1 carries a leaf / sand tuft and 7-8 are open pits, so their rooms lay the
    // plain floor_2 and only sprinkle the tuft; 3-6 are the cracked variations.
    const plain = pre ? floors[1] : floors[0];
    const worn = pre ? [floors[2], floors[3], floors[4], floors[5]] : floors.slice(1);
    const tile = () => {
      if (theme === 'crypt' && r() < 0.3) return cracked[Math.floor(r() * cracked.length)];
      if (pre && r() < 0.03) return floors[0];
      return r() < 0.72 ? plain : worn[Math.floor(r() * worn.length)];
    };
    const mids = pre ? [a.rect(`${pre}wall_mid`), a.rect(`${pre}wall_mid_2`), a.rect(`${pre}wall_mid_3`)] : [a.rect('wall_mid')];
    const mid = () => mids[r() < 0.8 ? 0 : Math.floor(r() * mids.length)];
    const top = a.rect(pre ? `${pre}wall_top` : 'wall_top_mid');
    const banner = a.rect(`${pre}wall_banner_${p.banner}`);
    // Whole-tile variations: worn bricks in the halls, leafy / carved bricks in the jungle and tomb.
    // (The jungle/tomb "hole" tiles read as missing tiles, so they're not used.)
    // (tomb_wall_deco_3 is blank in the source sheet.)
    const variants = pre ? [1, 2, 4, 5].map((i) => a.rect(`${pre}wall_deco_${i}`)) : [a.rect('wall_hole_1'), a.rect('wall_hole_2')];
    const variantChance = pre ? 0.06 : 0.03;
    // Goo is an overlay (it has see-through parts), so it goes on top of a normal brick.
    const goo = a.rect('wall_goo');
    const fountainX = -2;
    const bannerAt = (x: number, y: number) => y === 5 && (x === -9 || x === 5 || x === 12);

    for (let x = -24; x < 24; x++) {
      for (let y = 0; y < 13; y++) {
        const rect = y === 12 ? top : bannerAt(x, y) ? banner : x !== fountainX && r() < variantChance ? variants[Math.floor(r() * variants.length)] : mid();
        wall.face(x, y, WALL_Z, rect);
        if (!pre && y > 0 && y < 11 && x !== fountainX && r() < p.goo) wall.face(x, y, WALL_Z + 0.01, goo);
      }
      for (let z = WALL_Z; z < 16; z++) floor.top(x, 0, z, tile());
    }
    floor.top(Math.floor(STAIRS.x), 0.005, Math.floor(STAIRS.z), a.rect('floor_stairs'));

    // Animated scenery: one wall fountain per room, drawn over the brick.
    const prop = (frames: Rect[], x: number, y: number, fps = 6) => {
      const sp = new PixelSprite(a.texture, a.size, frames, { fps });
      sp.mesh.material = this.wallMat;
      sp.mesh.position.set(x + 0.5, y, WALL_Z + 0.02);
      this.props.push(sp);
      return sp.mesh;
    };
    const fountain: THREE.Object3D[] = [];
    if (pre) {
      const kind = theme === 'tomb' ? 'lava' : 'water';
      fountain.push(prop([a.rect(`${pre}fountain_top`)], fountainX, 2), prop(a.anim(`${pre}fountain_${kind}`), fountainX, 1), prop(a.anim(`${pre}fountain_${kind}_basin`), fountainX, 0));
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
    // A few bones along the foot of the wall, kept clear of the columns and fountain.
    const skull = a.rect('skull');
    for (let i = 0; i < 6; i++) {
      const x = -14 + r() * 28;
      if ([-13, -5.5, 2, 9.5, fountainX + 0.5].some((c) => Math.abs(c - x) < 1)) continue;
      floor.face(x, 0, WALL_Z + 0.5 + r() * 0.6, skull, 0.7, 0.7);
    }
    // The vault is heaped with treasure: open chests along the wall, coins everywhere the fight isn't.
    if (loot) {
      const chest = a.anim('chest_full_open')[2];
      const coin = a.anim('coin')[0];
      const flask = a.rect('flask_big_yellow');
      [-15, -10.5, -8, 4, 6.5, 12].forEach((x) => floor.face(x, 0, WALL_Z + 0.6 + r() * 0.4, chest, 1.1, 1.1));
      for (let i = 0; i < 140; i++) {
        const x = -20 + r() * 40;
        const z = WALL_Z + 0.4 + r() * 18;
        if (x > -9 && x < 8 && z > -3.5 && z < 6.5) continue;
        floor.face(x, 0, z, r() < 0.08 ? flask : coin, 0.42, 0.42);
      }
    }

    const group = new THREE.Group();
    group.add(new THREE.Mesh(wall.build(), this.wallMat), new THREE.Mesh(floor.build(), this.floorMat), ...fountain);
    // A great rainbow arched across the vault's back wall.
    if (loot) {
      const bands = [0xff4a4a, 0xff9a3a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0x6a6aff, 0xc46aff];
      bands.forEach((color, i) => {
        const outer = 9.4 - i * 0.55;
        const band = new THREE.Mesh(new THREE.RingGeometry(outer - 0.55, outer, 64, 1, 0, Math.PI), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
        band.position.set(-1, 0.6, WALL_Z + 0.05);
        band.userData.ownMaterial = true;
        group.add(band);
      });
    }
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

  /** World scale for a companion: every ordinary one stands the same height, the big ones keep their bulk. */
  private compScale(def: CompDef) {
    if (def.big) return 1;
    const h = Math.max(...this.atlas.creature(def.sprite).idle.map((f) => this.atlas.trimmed(f).h));
    return 1.25 * (COMP_HEIGHT / h);
  }

  private addComp(i: number, instant: boolean) {
    const def = COMPS[i];
    const { idle, run } = this.atlas.creature(def.sprite);
    const sprite = new PixelSprite(this.atlas.texture, this.atlas.size, idle, { fps: 6 + Math.random() * 2 });
    const body = new THREE.Group();
    const inner = new THREE.Group();
    const base = this.compScale(def);
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
    const hero = game.heroIndex();
    for (const c of this.party) {
      c.home.x = c.homeX * this.squeeze;
      c.home.z = c.homeZ * this.deep;
      if (c.comp === hero) continue;
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
        if (c.cd <= 0 && targets.length && game.dps().gt(0)) {
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
    const from = c.body.position.clone().add(new THREE.Vector3(c.sprite.flip ? -0.35 : 0.35, def.big ? 1.6 : 0.95, 0.1));
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
      // Fireball / darkness bolt: DevWizard's animated pixel spell over a soft glow.
      const spell = new PixelSprite(this.atlas.texture, this.atlas.size, this.atlas.anim(kind === 'fire' ? 'spell_fireball' : 'spell_darkness_bolt'), { fps: 14, anchor: 'center' });
      spell.mesh.scale.setScalar(kind === 'fire' ? 1.1 : 1);
      spell.mesh.material.emissive.setScalar(0.6);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: new THREE.Color(SHOT_COLOR[kind]).multiplyScalar(1.2), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(1.2);
      mesh = new THREE.Group().add(halo, spell.mesh);
      mesh.userData.spell = spell;
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
        (s.mesh.userData.spell as PixelSprite | undefined)?.update(dt);
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
        (s.mesh.userData.spell as PixelSprite | undefined)?.dispose();
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
    // Halves of a split boss climb out where it fell; everything else comes up the stairs.
    if (m.half) body.position.set(m.x * this.squeeze, 0, m.z * this.deep);
    else body.position.copy(STAIRS).add(new THREE.Vector3(Math.random() * 0.6, 0, Math.random() * 0.6));
    body.scale.setScalar(0.01);
    this.scene.add(body);
    // Ordinary monsters ~1.2× (tall ones capped at ~2 units); bosses ~3.4 units tall whatever their art.
    const h = run[0].h / 16;
    let scale = m.boss ? Math.max(1.5, Math.min(2.6, 3.4 / h)) : Math.min(1.2, 2.1 / h);
    if (m.mods.includes('giant')) scale *= 1.3;
    if (m.half) scale *= 0.7;
    if (m.champ) scale *= 1.35;
    inner.scale.setScalar(scale);
    const tint = new THREE.Color(m.def.tint ?? 0xffffff);
    // Modifiers show on the body: steel-grey armour, a red rage, a sickly green regrowth.
    if (m.mods.includes('armored')) tint.multiply(new THREE.Color(0xb4c4dc));
    if (m.mods.includes('enraged')) tint.multiply(new THREE.Color(0xff9a88));
    if (m.mods.includes('regen')) tint.multiply(new THREE.Color(0xb8ffb0));
    // Later laps: everything that climbs the stairs wears the corruption's colour.
    // (From the floor, not the room: the vault's treasure room has no lap.)
    const lap = Math.floor(zoneOf(this.lastFloor) / ZONES.length);
    if (lap && !m.vault) tint.lerp(tint.clone().multiply(new THREE.Color(corruptionOf(lap).tint)), 0.7);
    sprite.mesh.material.color.copy(tint);
    if (m.half && this.settings.particles) this.fx.burst(body.position.clone().setY(1), '#d58aff', 14, 4, 0.08, 8);
    let ring: MonView['ring'] = null;
    if (m.champ) {
      ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.5, 0.4), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      body.add(ring);
    }
    this.mons.set(m.id, { id: m.id, scale, height: h * scale, spotX: m.x, spotZ: m.z, blood: bloodOf(m.def.sprite), body, inner, sprite, idle, run, target: new THREE.Vector3(m.x * this.squeeze, 0, m.z * this.deep), boss: m.boss, big: !!m.def.big || m.boss, flash: 0, squash: 0, knock: 0, hopY: 0, hopV: 0, dead: -1, born: 0, glow: m.champ ? 'champ' : m.vault ? 'hoard' : null, ring });
    if (this.settings.particles) this.fx.burst(STAIRS.clone().setY(0.4), '#6a5a78', 6, 2, 0.08, 6);
    if (m.boss && !m.half) {
      this.fx.light(STAIRS.clone().setY(2), 0xff4040, 30, 1, 12);
      this.addShake(0.3);
    }
  }

  private removeView(v: MonView) {
    this.scene.remove(v.body);
    v.sprite.dispose();
    v.ring?.geometry.dispose();
    v.ring?.material.dispose();
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
      if (v.glow) {
        const g = v.glow === 'champ' ? 0.22 + Math.sin(this.time * 7 + v.id) * 0.12 : 0.08;
        if (v.ring) {
          v.ring.material.opacity = 0.6 + g;
          v.ring.scale.setScalar(1 + Math.sin(this.time * 7 + v.id) * 0.08);
        }
        v.sprite.mesh.material.emissive.setRGB(v.flash + g, v.flash + g * 0.75, v.flash + g * 0.2);
        if (v.glow === 'champ' && this.settings.particles && Math.random() < dt * 8) {
          this.fx.burst(p.clone().setY(v.height * (0.3 + Math.random() * 0.6)), '#ffd070', 1, 1.5, 0.06, 2, true);
        }
      }
      const base = v.scale;
      v.inner.scale.set(base * (1 + v.squash * 0.25), base * (1 - v.squash * 0.3), base);
      v.inner.position.x = v.knock;
      v.inner.position.y = v.hopY;
      v.sprite.update(dt);
    }
  }

  // ---------- treasure goblin ----------

  private spawnRaider(id: number, from: -1 | 1, rainbow = false) {
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
    if (rainbow) inner.scale.setScalar(1.8);
    this.raider = { id, group, sprite: s, from, light, state: 'run', t: 0, sparkle: 0, rainbow, ring };
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
      // The rainbow goblin cycles through every colour, and so does its glow.
      const hue = (this.time * 0.9) % 1;
      if (r.rainbow) {
        r.sprite.mesh.material.color.setHSL(hue, 1, 0.7);
        r.sprite.mesh.material.emissive.setHSL(hue, 1, 0.25);
        r.light.color.setHSL(hue, 1, 0.6);
        r.ring.material.color.setHSL(hue, 1, 0.6).multiplyScalar(2);
      }
      r.sparkle -= dt;
      if (r.sparkle <= 0 && this.settings.particles) {
        r.sparkle = r.rainbow ? 0.05 : 0.1;
        const spark = r.rainbow ? `#${new THREE.Color().setHSL((hue + Math.random() * 0.3) % 1, 1, 0.6).getHexString()}` : '#ffd070';
        this.fx.burst(r.group.position.clone().setY(1.2), spark, 2, 1.2, 0.06, 1, true);
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
  /** Middle of the monster field on screen, for news about the whole floor. */
  fieldScreen() {
    return this.toScreen(new THREE.Vector3(3 * this.squeeze, 1.6, 0));
  }

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
        if (ev.champ) {
          this.fx.light(at, 0xffd070, 30, 0.6, 10);
          if (this.settings.particles) this.fx.burst(at, '#ffd070', 26, 5, 0.08, 10, true);
          this.addShake(0.2);
          this.hitstop = Math.max(this.hitstop, 0.08);
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
      case 'relic':
        this.relicDropped = true;
        break;
      case 'floor': {
        const z = zoneOf(ev.floor);
        // Going down into a zone you've never reached: the staircase.
        const deeper = z > zoneOf(this.lastFloor);
        this.lastFloor = ev.floor;
        if (this.cine) this.cine.zone = z;
        else if (this.hold) this.hold.zone = z;
        // Let the boss's light, gold and sparks settle (longer if a relic dropped) before the party heads for the stairs.
        // Only for new depths: sweeping back through zones you've seen just changes the room.
        else if (deeper && this.settings.cinematics && game.s.bestFloor <= ev.floor) this.hold = { zone: z, t: this.relicDropped ? 2.8 : 1.6 };
        else this.setBand(z);
        this.relicDropped = false;
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
        this.spawnRaider(ev.id, ev.from, ev.rainbow);
        break;
      case 'bossWin':
        // A clutch kill: the world holds its breath for a moment.
        if (ev.clutch) {
          this.hitstop = Math.max(this.hitstop, 0.5);
          this.addShake(0.6);
          this.fx.light(new THREE.Vector3(3 * this.squeeze, 2, 0), 0xfff0b0, 60, 1, 18);
        }
        break;
      case 'rampage':
        this.addShake(0.25 + ev.tier * 0.15);
        this.fx.light(new THREE.Vector3(1.5 * this.squeeze, 2, 1), 0xff3050, 30 + ev.tier * 20, 0.8, 14);
        break;
      case 'vault':
        if (ev.on) {
          this.fx.light(STAIRS.clone().setY(2), 0xffd070, 60, 1.5, 20);
          if (this.settings.particles) this.fx.burst(STAIRS.clone().setY(1), '#ffd070', 60, 7, 0.1, 14, true);
          this.addShake(0.4);
        }
        // Mid-staircase there's no room to run from; just change the room.
        if (this.cine || this.hold || !this.settings.cinematics) this.setVaultRoom(ev.on);
        else this.startTrip(ev.on);
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
    this.hold = null;
    for (const c of this.party) {
      this.scene.remove(c.body);
      c.sprite.dispose();
    }
    this.party = [];
    this.syncParty(game, true);
    this.lastFloor = game.s.floor;
    this.band = -1;
    this.setVaultRoom(game.s.buffs.some((b) => b.id === 'vault'));
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
    return !!this.hold || (!!this.cine && this.cine.phase !== 'arrive') || this.trip?.phase === 'go';
  }

  private startCinematic(zone: number) {
    this.cine = { phase: 'exit', t: 0, zone, walkers: [], shadows: [], well: null, flames: [] };
  }

  private descend() {
    const c = this.cine!;
    c.phase = 'stairs';
    c.t = 0;
    // Dress the stairwell in the new zone's tiles and light.
    const pal = corrupt(PALETTES[c.zone % PALETTES.length], Math.floor(c.zone / ZONES.length));
    const theme = tilesFor(c.zone);
    const pre = theme === 'jungle' || theme === 'tomb' ? `${theme}_` : '';
    const a = this.atlas;
    const floors = theme === 'crypt' ? [a.rect('crypt_floor_1'), a.rect('crypt_floor_5')] : [a.rect(`${pre}floor_${pre ? 2 : 1}`), a.rect(`${pre}floor_3`)];
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
    // The walkers: the whole party, two abreast (or a lone squire).
    const who = this.party.length ? [...this.party].sort((x, y) => x.comp - y.comp).map((p) => COMPS[p.comp]) : [COMPS[0]];
    for (const def of who) {
      const { run } = a.creature(def.sprite);
      const w = new PixelSprite(a.texture, a.size, run, { fps: 10 });
      w.mesh.scale.multiplyScalar(this.compScale(def) * 0.96);
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
    this.fade.material.color.setHex(0x000000);
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
      // Pairs file down the tower; the camera pans slower than they walk, so the whole column passes through view.
      const pairs = Math.ceil(c.walkers.length / 2);
      const gap = 1.05;
      const walk = 5.4;
      const pan = 3.2;
      const tail = (pairs - 1) * gap;
      const dur = Math.max(3.6, (tail + 3) / (walk - pan) + 0.6);
      const lead = 1 + c.t * walk;
      c.walkers.forEach((w, i) => {
        const side = i % 2;
        const at = lead - Math.floor(i / 2) * gap - side * 0.4;
        const p = stairPoint(at);
        w.mesh.position.set(p.x, p.y + Math.abs(Math.sin((c.t + i) * 11)) * 0.05, p.z + 0.15 - side * 0.45);
        w.mesh.rotation.set(0, 0, 0);
        w.flip = stairPoint(at + 0.3).x < p.x;
        c.shadows[i].position.set(p.x, p.y + 0.02, p.z + 0.15 - side * 0.45);
        w.update(dt);
      });
      // Straight-on cutaway of the tower, panning down with the column.
      const head = stairPoint(Math.min(lead - 2, 1 + c.t * pan + Math.min(tail, 4)));
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

  // ---------- your hero ----------

  /** Where a point on screen lands on the floor. */
  private floorAt(x: number, y: number): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const ray = this.raycaster.ray;
    if (ray.direction.y >= -1e-4) return null;
    return ray.origin.clone().addScaledVector(ray.direction, -ray.origin.y / ray.direction.y);
  }

  /** Your hero leaves the formation: it walks after the mouse (or the keys), or roams to the nearest monster, and
   *  attacks whatever it reaches at the same pace as the rest of the party (its damage counts with theirs). */
  private updateHero(dt: number, game: Game) {
    const idx = game.heroIndex();
    const c = this.party.find((p) => p.comp === idx);
    if (!c) return;
    if (this.heroComp !== c.comp) this.heroVel.set(0, 0, 0);
    this.markHero(c);
    const def = COMPS[c.comp];
    const p = c.body.position;
    const melee = def.attack === 'slash';
    // Everything is measured from a monster's edge, so a giant is fought from as far off as a rat is close up.
    const radius = (v: MonView) => Math.min(1.6, Math.max(0.35, v.height * 0.28));
    const standOff = (v: MonView) => radius(v) + (melee ? (def.big ? 1.1 : 0.7) : 2.6);
    // Ranged heroes hit anything in the room; melee ones have to get close.
    const inReach = (v: MonView) => !melee || v.body.position.distanceTo(p) <= radius(v) + (def.big ? 1.6 : 1.15);
    const live = game.monsters.filter((m) => m.arrive <= 0).map((m) => this.mons.get(m.id)).filter((v): v is MonView => !!v && v.dead < 0 && v.born >= 1);
    const nearest = (from: THREE.Vector3) => live.reduce<MonView | null>((best, v) => (!best || v.body.position.distanceToSquared(from) < best.body.position.distanceToSquared(from) ? v : best), null);
    /** Beside a monster rather than on top of it, on the side the hero is coming from. */
    const besideOf = (v: MonView) => {
      const away = p.clone().sub(v.body.position).setY(0);
      if (away.lengthSq() < 1e-4) away.set(-1, 0, 0);
      return v.body.position.clone().add(away.setLength(standOff(v))).setY(0);
    };
    /** The monster the cursor is on, judged by what's drawn on screen (a tall monster's head is far from its feet). */
    const pointedAt = (x: number, y: number) => live.find((v) => {
      const s = this.screenOf(v.id);
      return !!s && Math.abs(x - s.x) < Math.max(18, s.h * 0.5) && y > s.y - 8 && y < s.y + s.h + 10;
    });

    // Where to go: the keys (then a moment standing where they left it), the mouse, or, left alone, the nearest
    // monster (home when the room is clear). Pointing at or near a monster means "go and fight that one".
    const { aim, keys, stay } = this.heroInput;
    let goal: THREE.Vector3 | null = null;
    const steer = new THREE.Vector3(keys.x, 0, keys.z);
    if (steer.lengthSq() > 0) goal = p.clone().add(steer.normalize().multiplyScalar(3));
    else if (stay) goal = null;
    else if (aim) {
      const spot = this.floorAt(aim.x, aim.y);
      const near = spot && nearest(spot);
      const on = pointedAt(aim.x, aim.y) ?? (near && near.body.position.distanceTo(spot) < radius(near) + 0.8 ? near : null);
      goal = on ? besideOf(on) : spot;
    } else {
      const prey = nearest(p);
      goal = prey ? besideOf(prey) : c.home.clone();
    }

    // Walk there smoothly: ease in and out, ignore tiny nudges until already walking, settle on arrival.
    const want = new THREE.Vector3();
    if (goal) {
      goal.z = Math.max(WALL_Z + 0.9, goal.z);
      const d = goal.sub(p).setY(0);
      const dist = d.length();
      const walking = this.heroVel.length() > 0.4;
      if (dist > (walking ? 0.08 : 0.45)) want.copy(d).setLength(HERO_SPEED * (1 + this.fever * 0.3) * Math.min(1, dist / 0.9));
    }
    this.heroVel.lerp(want, Math.min(1, dt * 12));
    if (want.lengthSq() === 0 && this.heroVel.length() < 0.15) this.heroVel.set(0, 0, 0);
    // Anywhere on the floor you can see: a step that would take them off screen (or into the back wall) isn't taken.
    // (A hero still walking in from off screen, newly hired or arriving in a new zone, is let through.)
    const was = p.clone();
    const inView = this.onScreen(was);
    const allowed = (at: THREE.Vector3) => (!inView || this.onScreen(at)) && at.z >= WALL_Z + 0.9;
    const step = this.heroVel.clone().multiplyScalar(dt);
    // Blocked going diagonally into an edge: slide along it instead.
    const tries = [step, new THREE.Vector3(step.x, 0, 0), new THREE.Vector3(0, 0, step.z)];
    const ok = tries.find((t) => allowed(was.clone().add(t)));
    if (ok) {
      p.copy(was).add(ok);
      if (ok !== step) this.heroVel.set(ok.x / dt || 0, 0, ok.z / dt || 0);
    } else this.heroVel.set(0, 0, 0);
    // Never stand inside a monster.
    for (const v of live) {
      const away = p.clone().sub(v.body.position).setY(0);
      const min = radius(v) + (def.big ? 0.8 : 0.3);
      const len = away.length();
      if (len < min) p.add(len > 1e-4 ? away.setLength(min - len) : new THREE.Vector3(-(min - len), 0, 0));
    }
    const speed = this.heroVel.length();
    const moving = speed > 0.35;

    // Attack whatever's in reach, on the move or standing, each in their own style: blades up close; arrows,
    // fireballs, dark orbs, lightning, chain lightning or runes from range.
    this.heroFace = Math.max(0, this.heroFace - dt);
    // The monster you're pointing at first, if it's in reach; otherwise the nearest one that is.
    const pointed = aim ? pointedAt(aim.x, aim.y) : undefined;
    const target = pointed && inReach(pointed) ? pointed : live.filter(inReach).sort((a, b) => a.body.position.distanceTo(p) - b.body.position.distanceTo(p))[0];
    c.cd -= dt * (1 + this.fever);
    if (target && c.cd <= 0 && game.dps().gt(0)) {
      c.cd = 0.8 + Math.random() * 0.9;
      const left = target.body.position.x < p.x;
      c.sprite.flip = left;
      this.heroFace = 0.35;
      if (melee) {
        c.inner.position.x = (left ? -1 : 1) * 0.25;
        this.strike(c, target.id);
      } else {
        c.stretch = 0.6;
        this.fire(c, def.attack, target.id);
      }
    }
    // Face the way they're walking, except just after an attack, when they keep facing what they hit.
    if (this.heroFace <= 0 && Math.abs(this.heroVel.x) > 0.5) c.sprite.flip = this.heroVel.x < 0;

    // A little bob and some dust while running; ease the lunge and the squash back to rest.
    c.inner.position.x *= Math.max(0, 1 - dt * 12);
    c.inner.position.y = moving ? Math.abs(Math.sin(this.time * 14)) * 0.08 * Math.min(1, speed / HERO_SPEED) : c.inner.position.y * Math.max(0, 1 - dt * 14);
    if (moving && this.settings.particles && Math.random() < dt * 12) this.fx.burst(p.clone().setY(0.1), '#6a5a50', 1, 0.8, 0.06, 4);
    c.stretch *= Math.max(0, 1 - dt * 10);
    c.inner.scale.set(c.base * (1 - c.stretch * 0.1), c.base * (1 + c.stretch * 0.15), c.base);
    c.inner.rotation.z = 0;

    // Treasure goblins don't get past you.
    const r = this.raider;
    if (r && r.state === 'run' && game.raid && r.group.position.distanceTo(p) < 1.3) game.catchRaid();

    c.sprite.play(moving ? c.run : c.idle);
    c.sprite.update(dt * (moving ? 0.6 + 0.6 * Math.min(1, speed / HERO_SPEED) : 1));
  }

  /** Is a spot on the floor inside the visible battlefield (clear of the screen edges, the HUD and the panels)? */
  private onScreen(at: THREE.Vector3) {
    const foot = this.toScreen(at);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const { right, bottom, top } = this.view;
    return foot.x > rect.left + 48 && foot.x < rect.right - right - 48 && foot.y > rect.top + top + 70 && foot.y < rect.bottom - bottom - 16;
  }

  /** Where your hero stands on screen (feet), for the introduction's callout. */
  heroScreen(game: Game): { x: number; y: number } | null {
    const c = this.party.find((p) => p.comp === game.heroIndex());
    return c && c.body.visible ? this.toScreen(c.body.position) : null;
  }

  /** A gold ring under whoever is your hero. */
  private markHero(c: CompView) {
    if (this.heroComp === c.comp && this.heroRing) return;
    if (!this.heroRing) {
      this.heroRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.heroRing.rotation.x = -Math.PI / 2;
      this.heroRing.position.y = 0.03;
    }
    c.body.add(this.heroRing);
    this.heroComp = c.comp;
  }

  // ---------- goblin vault ----------

  /** A rainbow portal opens; the party runs into it and the flash carries them to the other room. */
  private startTrip(into: boolean) {
    if (this.trip) {
      this.scene.remove(this.trip.portal);
      this.trip.portal.geometry.dispose();
    }
    const portal = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    portal.position.set(9 * this.squeeze, 1.6, 0.5 * this.deep);
    portal.scale.setScalar(0.01);
    this.scene.add(portal);
    this.trip = { into, phase: 'go', t: 0, portal };
  }

  private updateTrip(dt: number) {
    const trip = this.trip!;
    trip.t += dt;
    const hue = (this.time * 0.6) % 1;
    let fade = 0;
    if (trip.phase === 'go') {
      const portal = trip.portal;
      portal.scale.setScalar(Math.min(1, trip.t / 0.3) * (1 + Math.sin(this.time * 9) * 0.06));
      portal.rotation.z += dt * 3;
      portal.material.color.setHSL(hue, 0.9, 0.6);
      if (this.settings.particles && Math.random() < 0.6) {
        this.fx.burst(portal.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0)), new THREE.Color().setHSL(Math.random(), 0.9, 0.65), 3, 2.5, 0.08, 2, true);
      }
      for (const p of this.party) {
        p.act = null;
        if (trip.t > 0.2) p.body.position.x += dt * 11;
        p.sprite.flip = false;
        p.sprite.play(p.run);
        p.sprite.update(dt);
      }
      fade = Math.max(0, (trip.t - 0.55) / (TRIP_GO - 0.55));
      if (trip.t >= TRIP_GO) {
        this.setVaultRoom(trip.into);
        this.scene.remove(portal);
        portal.geometry.dispose();
        portal.material.dispose();
        // Everyone tumbles in from the left of the new room.
        for (const p of this.party) p.body.position.set(-15 - Math.random() * 3, 0, p.home.z);
        trip.phase = 'arrive';
        trip.t = 0;
        this.addShake(0.3);
      }
    } else {
      fade = Math.max(0, 1 - trip.t / TRIP_ARRIVE);
      if (trip.t >= TRIP_ARRIVE) this.trip = null;
    }
    this.fade.material.color.setHSL(hue, 0.7, 0.85);
    this.fade.visible = fade > 0;
    this.fade.material.opacity = Math.min(1, fade);
  }

  /** The treasure room shimmers: torches cycle the rainbow and coins glint across the floor. */
  private updateVaultRoom(dt: number) {
    const hue = this.time * 0.15;
    this.torchLights.forEach((l, i) => l.color.setHSL((hue + i / 4) % 1, 0.85, 0.6));
    this.hemi.color.setHSL((hue + 0.5) % 1, 0.45, 0.55);
    this.flameMat.color.setHSL(hue % 1, 0.9, 0.7).multiplyScalar(1.4);
    if (!this.settings.particles) return;
    this.sparkleT -= dt;
    if (this.sparkleT > 0) return;
    this.sparkleT = 0.12;
    const at = new THREE.Vector3(-14 + Math.random() * 28, 0.2 + Math.random() * 0.6, WALL_Z + 0.6 + Math.random() * 12);
    this.fx.burst(at, new THREE.Color().setHSL(Math.random(), 0.9, 0.7), 4, 1.6, 0.06, 3, true);
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
    if (this.hold && (this.hold.t -= dt) <= 0) {
      this.startCinematic(this.hold.zone);
      this.hold = null;
    }
    if (this.cine) this.updateCinematic(dt);
    if (this.trip) this.updateTrip(dt);
    if (this.inVaultRoom) this.updateVaultRoom(dt);
    const holding = (this.cine && this.cine.phase !== 'arrive') || this.trip?.phase === 'go';
    this.updateMonsters(dt, game);
    if (!holding) {
      this.updateParty(dt, game);
      this.updateHero(dt, game);
    }
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
