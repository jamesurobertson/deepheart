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
import { CARD_FRAME, CARD_H, CARD_W, cardBackTexture, cardTexture } from './cards.ts';
import { CARD_BY_ID, COMPS, RELIC_BY_ID, ZONES, corruptionOf, tilesFor, zoneOf, type Attack, type CompDef, type Tiles } from '../game/data.ts';
import { VAULT_LENGTH, type Game, type GameEvent, type Monster, type VaultChest } from '../game/game.ts';

const WALL_Z = -6;
const STAIRS = new THREE.Vector3(7.5, 0, -4);
/** Where the camera looks: between the party and the monsters. */
const LOOK = new THREE.Vector3(0, 1.1, 0.5);

interface Palette { torch: number; fog: number; hemi: number; wall: [number, number, number]; floor: [number, number, number]; banner: string; goo: number }
/** Lighting per zone, in the same order as ZONES. Tiles with their own color (jungle, tomb, sewer) get a lighter wash. */
const PALETTES: Palette[] = [
  { torch: 0xff9a4a, fog: 0x0a0708, hemi: 0x6a5a78, wall: [0.66, 0.58, 0.6], floor: [1.1, 1.05, 1.02], banner: 'red', goo: 0 }, // Upper Halls
  { torch: 0x5ad6c8, fog: 0x04090b, hemi: 0x4a6a78, wall: [0.46, 0.62, 0.68], floor: [0.92, 1.08, 1.18], banner: 'blue', goo: 0 }, // Bone Crypts
  { torch: 0xa6e06a, fog: 0x050904, hemi: 0x55704a, wall: [1.6, 1.8, 1.5], floor: [1.6, 1.7, 1.5], banner: 'green', goo: 0 }, // Overgrown Warrens
  { torch: 0xffb35a, fog: 0x0c0806, hemi: 0x7a6450, wall: [0.74, 0.66, 0.58], floor: [0.95, 0.9, 0.84], banner: 'yellow', goo: 0 }, // Sunken Tomb
  { torch: 0x8aff4a, fog: 0x040905, hemi: 0x4a7050, wall: [0.8, 0.9, 0.76], floor: [0.78, 0.88, 0.74], banner: 'green', goo: 0.025 }, // Rotting Deep
  { torch: 0x8af0d8, fog: 0x04070b, hemi: 0x5a70a0, wall: [1.3, 1.55, 1.9], floor: [1.4, 1.55, 1.8], banner: 'blue', goo: 0 }, // Enchanted Grove
  { torch: 0xff5a3a, fog: 0x0b0505, hemi: 0x6a4a52, wall: [0.7, 0.44, 0.44], floor: [1.15, 0.95, 0.9], banner: 'red', goo: 0 }, // Demon Gate
  { torch: 0x9cc0ff, fog: 0x05070c, hemi: 0x5a6a8a, wall: [0.56, 0.72, 1], floor: [0.9, 1.1, 1.45], banner: 'blue', goo: 0 }, // Frozen Vault
];

/** The Rainbow Vault: gilded stone, with torches that cycle through the rainbow (see update). */
const VAULT_PALETTE: Palette = { torch: 0xffd070, fog: 0x0d0616, hemi: 0x9a78b0, wall: [1.3, 1.08, 0.6], floor: [1.4, 1.2, 0.75], banner: 'yellow', goo: 0 };
/** Seconds the party runs toward the portal before the flash, and the fade back in after it. */
/** The walk into a rainbow portal: it opens (seconds), the chosen one sets off walking, pauses on the threshold, steps
 *  through, and the light takes the screen. */
const TRIP_OPEN = 1.1;
const TRIP_WALK_SPEED = 4.2;
const TRIP_PAUSE = 0.35;
const TRIP_STEP_IN = 0.55;
const TRIP_FLASH = 0.5;
const TRIP_ARRIVE = 0.7;

/** A zone's palette on a later lap: torches, light and stone pulled toward the lap's color, the dark a shade deeper. */
function corrupt(p: Palette, lap: number): Palette {
  if (!lap) return p;
  const c = new THREE.Color(corruptionOf(lap).tint);
  const toward = (hex: number, k: number) => new THREE.Color(hex).lerp(c, k).getHex();
  const wash = (v: [number, number, number]): [number, number, number] => [v[0] * (0.3 + 0.7 * c.r), v[1] * (0.3 + 0.7 * c.g), v[2] * (0.3 + 0.7 * c.b)];
  return { ...p, torch: toward(p.torch, 0.85), hemi: toward(p.hemi, 0.75), fog: new THREE.Color(p.fog).lerp(c, 0.12).getHex(), wall: wash(p.wall), floor: wash(p.floor) };
}

/** Your hero's top walking speed (world units a second). */
const HERO_SPEED = 6.5;
/** The rainbow's bands, outside in. */
const RAINBOW = [0xff4a4a, 0xff9a3a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0x6a6aff, 0xc46aff];
/** How close your vault hero has to come to a chest to throw it open (world units). */
const CHEST_REACH = 1.1;
/** A loose coin on the vault floor, as big as the painted ones further off. */
const COIN_SIZE = 1.15;

/** A clutch kill's slow motion: real seconds until the release burst, and until time is back to full speed. */
const CLUTCH_RELEASE = 0.9;
const CLUTCH_END = 1.9;

/** A relic on the floor: its glow in the rarity's color, how long it waits before flying to the party by itself
 *  (shorter while the staircase is waiting on it), and how long that flight takes. */
const LOOT_COLORS = [0xc9b8a0, 0x5fa8ff, 0xc77dff, 0xffb13d];
const LOOT_WAIT = 6;
const LOOT_WAIT_STAIRS = 3.5;
const LOOT_FLY = 0.5;
/** Seconds a relic spends tumbling out of the boss and landing (it can't be walked over until then), and the angle
 *  it lies at, flat on the floor. */
const LOOT_LAND = 0.8;
const LOOT_TILT = Math.PI / 4;

type RelicDrop = Extract<GameEvent, { t: 'relic' }>;
type CardDrop = Extract<GameEvent, { t: 'card' }>;
/** Things that drop on the floor to be picked up: relics and monster cards. */
export type Drop = RelicDrop | CardDrop;

interface LootView {
  ev: Drop;
  group: THREE.Group;
  icon: { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>; dispose(): void };
  /** Height on the floor, in world units, and the angle it lies at. */
  size: number;
  tilt: number;
  /** Seconds in the air before it lands (it can't be walked over until then), and whether it has. */
  air: number;
  landed: boolean;
  color: THREE.Color;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  /** Seconds on the floor, and seconds into the flight to the party (-1: still on the floor). */
  t: number;
  fly: number;
  from: THREE.Vector3;
}

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
  /** Still climbing up through a grate (1 → 0), for monsters that emerge rather than take the stairs. */
  rise: number;
  fly: boolean;
  /** More of the same creature rising around it (The Thing Below's other tentacles): all one monster. */
  extras: PixelSprite[];
  /** Champions pulse gold and shed sparks. */
  glow: 'champ' | null;
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

/** A chest in the Rainbow Vault: pops up, glints while shut, and bursts open in a fountain of coins. */
interface ChestView {
  id: number;
  group: THREE.Group;
  inner: THREE.Group;
  sprite: PixelSprite;
  rainbow: boolean;
  open: boolean;
  /** 0 → 1 as it pops up out of the floor (starts below 0 so they arrive one after another). */
  born: number;
  aura: THREE.Sprite | null;
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

  top(x: number, y: number, z: number, r: Rect, size = 1) {
    this.quad([[x, y, z + size], [x + size, y, z + size], [x + size, y, z], [x, y, z]], r, [0, 1, 0]);
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
  private hatch: THREE.Mesh | null = null;

  private mons = new Map<number, MonView>();
  private party: CompView[] = [];
  /** Screen areas your hero keeps out of (the dock), set by the UI. */
  heroBlocked: DOMRect[] = [];
  /** Steering for your hero, set by the UI each frame: the pointer over the battlefield, and WASD / arrow keys. */
  /** `idle`: no mouse or keys for a while (in the vault, the hero then sees itself out once the chests are done). */
  heroInput: { aim: { x: number; y: number } | null; keys: { x: number; z: number }; stay: boolean; idle: boolean } = { aim: null, keys: { x: 0, z: 0 }, stay: false, idle: false };
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
  /** Relics lying where they dropped, waiting to be picked up (walk over them, click them, or let them fly to you). */
  private loot: LootView[] = [];
  /** Drops that came during a clutch kill's slow motion, set down once it's over. */
  private pendingLoot: { ev: Drop; at: THREE.Vector3 }[] = [];
  private lastBossAt = new THREE.Vector3(3, 0, 0);
  private lastKillAt = new THREE.Vector3(1, 0, 0);
  /** Called when a drop is picked up (the UI announces it then). */
  onLoot: ((ev: Drop) => void) | null = null;
  private shake = 0;
  private time = 0;
  private fever = 0;
  private hitstop = 0;
  /** A clutch kill's slow-motion moment: real seconds since the kill, and where the boss fell. */
  private clutch: { t: number; at: THREE.Vector3; released: boolean } | null = null;
  /** A change of room that came in during the slow motion, made once it's over. */
  private pendingBand: number | null = null;
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
  /** In the Rainbow Vault's treasure room, and the portal trip in or out of it (the game pauses during the run-up). */
  private inVaultRoom = false;
  /** The vault's chests on the floor. */
  private vaultChests = new Map<number, ChestView>();
  /** Treasure goblins loose in the vault: they scurry about and run from your hero. */
  private vaultGoblins = new Map<number, { group: THREE.Group; sprite: PixelSprite; rainbow: boolean; goal: THREE.Vector3; caught: number }>();
  /** The vault's loose coins, spinning on the floor until the hero runs over them. */
  private vaultCoins = new Map<number, { sprite: PixelSprite; mesh: THREE.Object3D; up: number }>();
  /** Rainbows that rise out of opened chests and fade. */
  private arcs: { group: THREE.Group; t: number; life: number }[] = [];
  /** The room's own rainbows, which shimmer while you're in it. */
  private roomArcs: THREE.Mesh[] = [];
  /** A rainbow goblin was caught: the world slows while you choose who goes through the portal. */
  private vaultPick = false;
  /** Who went into the vault (alone; the rest wait outside). */
  private vaultHero = -1;
  /** A Rainbow Chest's short slow-motion beat, in real seconds left. */
  private jackpotT = 0;
  /** The camera's sideways slide down the vault's long hall, following your hero. */
  private pan = 0;
  /** The vault's way out, at the far end of the hall. */
  private exitPortal: THREE.Group | null = null;
  /** Where the last treasure goblin was caught. */
  private caughtAt = new THREE.Vector3();
  /** The huge rainbow that rises from a caught rainbow goblin while you choose (timed in real seconds: the world is slowed). */
  private pickArc: { group: THREE.Group; t: number } | null = null;
  /** `reached`: when the walker got to the doorway (trip seconds), -1 until then. */
  private trip: { into: boolean; phase: 'go' | 'arrive'; t: number; portal: THREE.Group; reached: number } | null = null;
  private sparkleT = 0;
  private cine: { phase: 'exit' | 'stairs' | 'arrive'; t: number; zone: number; walkers: PixelSprite[]; shadows: THREE.Mesh[]; well: THREE.Group | null; flames: THREE.Mesh[] } | null = null;
  /** Black card in front of the camera for fades. */
  private fade: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** The floor we were last on: stepping down into a new zone plays the staircase. */
  private lastFloor = 1;
  /** When a floor was last swept (scene time): blitzing back through old floors skips the staircase. */
  private sweptAt = -99;
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

  /** Space the UI covers on the right (desktop) or bottom (phone), so the fight centers in what's left. */
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
    // Shift the frustum so its center lands in the middle of the free area.
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
    this.roomArcs = [];
  }

  private disposeGroup(group: THREE.Object3D) {
    group.removeFromParent();
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite)) return;
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    });
  }

  /** A rainbow: seven half-rings, outside in (centered on the group's origin, standing up). */
  private rainbowArc(radius: number, width: number, opacity: number): THREE.Group {
    const group = new THREE.Group();
    RAINBOW.forEach((color, i) => {
      const outer = radius - i * width;
      const band = new THREE.Mesh(
        new THREE.RingGeometry(outer - width, outer, 64, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      band.userData.ownMaterial = true;
      band.userData.opacity = opacity;
      group.add(band);
    });
    return group;
  }

  /** Swap between the zone's room and the Rainbow Vault's treasure room. */
  private setVaultRoom(on: boolean) {
    this.inVaultRoom = on;
    // Only the one you chose goes in; the rest wait on the floor.
    for (const c of this.party) c.body.visible = !on || c.comp === this.vaultHero;
    if (!on) {
      for (const v of this.vaultChests.values()) this.disposeGroup(v.group);
      this.vaultChests.clear();
      for (const c of this.vaultCoins.values()) this.disposeGroup(c.mesh);
      this.vaultCoins.clear();
      for (const g of this.vaultGoblins.values()) this.disposeGroup(g.group);
      this.vaultGoblins.clear();
      if (this.exitPortal) this.disposeGroup(this.exitPortal);
      this.exitPortal = null;
      this.pan = 0;
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
    // The way out: a rainbow portal at the far end of the hall.
    this.exitPortal = this.rainbowPortal((VAULT_LENGTH + 2) * this.squeeze);
    this.scene.add(this.exitPortal);
  }

  private applyPalette() {
    const p = this.palette;
    this.floorMat.color.setRGB(...p.floor);
    (this.scene.background as THREE.Color).setHex(p.fog);
    (this.scene.fog as THREE.Fog).color.setHex(p.fog);
    this.hemi.color.setHex(p.hemi);
    this.wallMat.color.setRGB(...p.wall);
    for (const l of this.torchLights) l.color.setHex(p.torch);
    // Flames burn in the zone's color: teal in the crypts, green in the jungle, and so on.
    this.flameMat.color.setHex(p.torch).lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(1.4);
  }

  private buildRoom(seed: number, loot = false): THREE.Group {
    const a = this.atlas;
    const r = seeded(seed * 977 + 5);
    const p = this.palette;
    const theme: Tiles = tilesFor(seed);
    const wall = new Quads(a);
    const floor = new Quads(a);
    // Tile names for each theme. The jungle and tomb sets come from Omniboy's packs, the sewers from 0x72's.
    const sewer = theme === 'sewer';
    const pre = theme === 'jungle' || theme === 'tomb' ? `${theme}_` : '';
    const floors = sewer ? [] : [1, 2, 3, 4, 5, 6, 7, 8].map((i) => a.rect(`${pre}floor_${i}`));
    const sewerFloor = sewer ? { plain: a.rect('sewer_floor_1'), worn: [a.rect('sewer_floor_2'), a.rect('sewer_floor_3')], odd: [a.rect('sewer_floor_drain'), a.rect('sewer_floor_drain'), a.rect('sewer_floor_grate')] } : null;
    // Crypts: ordinary flagstones with the Dark Dungeon's cracked, older tiles worked in.
    const cracked = Array.from({ length: 20 }, (_, i) => a.rect(`crypt_floor_${i + 1}`));
    // Omniboy's floor_1 carries a leaf / sand tuft and 7-8 are open pits, so their rooms lay the
    // plain floor_2 and only sprinkle the tuft; 3-6 are the cracked variations.
    const plain = pre ? floors[1] : floors[0];
    const worn = pre ? [floors[2], floors[3], floors[4], floors[5]] : floors.slice(1);
    const tile = () => {
      if (sewerFloor) return r() < 0.012 ? sewerFloor.odd[Math.floor(r() * 3)] : r() < 0.85 ? sewerFloor.plain : sewerFloor.worn[Math.floor(r() * 2)];
      if (theme === 'crypt' && r() < 0.3) return cracked[Math.floor(r() * cracked.length)];
      if (pre && r() < 0.03) return floors[0];
      return r() < 0.72 ? plain : worn[Math.floor(r() * worn.length)];
    };
    const mids = sewer ? [a.rect('sewer_wall_mid'), a.rect('sewer_wall_mid_2')] : pre ? [a.rect(`${pre}wall_mid`), a.rect(`${pre}wall_mid_2`), a.rect(`${pre}wall_mid_3`)] : [a.rect('wall_mid')];
    const mid = () => mids[r() < 0.8 ? 0 : Math.floor(r() * mids.length)];
    const top = a.rect(sewer ? 'sewer_wall_top' : pre ? `${pre}wall_top` : 'wall_top_mid');
    const banner = a.rect(`${pre}wall_banner_${p.banner}`);
    // Whole-tile variations: worn bricks in the halls, leafy / carved bricks in the jungle and tomb.
    // (The jungle/tomb "hole" tiles read as missing tiles, so they're not used.)
    // (tomb_wall_deco_3 is blank in the source sheet.)
    const variants = pre ? [1, 2, 4, 5].map((i) => a.rect(`${pre}wall_deco_${i}`)) : [a.rect('wall_hole_1'), a.rect('wall_hole_2')];
    const variantChance = sewer ? 0 : pre ? 0.06 : 0.03;
    // Goo is an overlay (it has see-through parts), so it goes on top of a normal brick.
    const goo = a.rect('wall_goo');
    const fountainX = -2;
    const bannerAt = (x: number, y: number) => !sewer && y === 5 && (x === -9 || x === 5 || x === 12);

    // The vault is a long hall the camera slides down.
    const xEnd = loot ? 24 + Math.ceil(VAULT_LENGTH) + 12 : 24;
    for (let x = -24; x < xEnd; x++) {
      for (let y = 0; y < 13; y++) {
        const rect = y === 12 ? top : bannerAt(x, y) ? banner : x !== fountainX && r() < variantChance ? variants[Math.floor(r() * variants.length)] : mid();
        wall.face(x, y, WALL_Z, rect);
        if (!pre && y > 0 && y < 11 && x !== fountainX && r() < p.goo) wall.face(x, y, WALL_Z + 0.01, goo);
      }
      for (let z = WALL_Z; z < 16; z++) floor.top(x, 0, z, tile());
    }
    floor.top(Math.floor(STAIRS.x), 0.005, Math.floor(STAIRS.z), a.rect(sewer ? 'sewer_floor_stairs' : 'floor_stairs'));

    // Animated scenery: one wall fountain per room, drawn over the brick.
    const prop = (frames: Rect[], x: number, y: number, fps = 6) => {
      const sp = new PixelSprite(a.texture, a.size, frames, { fps });
      sp.mesh.material = this.wallMat;
      sp.mesh.position.set(x + 0.5, y, WALL_Z + 0.02);
      this.props.push(sp);
      return sp.mesh;
    };
    const fountain: THREE.Object3D[] = [];
    if (sewer) {
      fountain.push(prop(a.anim('sewer_sludgefall'), fountainX, 0));
      // Bats asleep on the wall, out of reach of the fighting.
      [-16, -8.5, 4.5, 11].forEach((x, i) => fountain.push(prop([a.rect(`sewer_bat_hanging_${1 + (i % 2)}`)], x, 2.6 + r() * 0.8, 1)));
    } else if (pre) {
      const kind = theme === 'tomb' ? 'lava' : 'water';
      fountain.push(prop([a.rect(`${pre}fountain_top`)], fountainX, 2), prop(a.anim(`${pre}fountain_${kind}`), fountainX, 1), prop(a.anim(`${pre}fountain_${kind}_basin`), fountainX, 0));
    } else {
      const c = seed % 2 ? 'blue' : 'red';
      fountain.push(prop([a.rect('wall_fountain_top_1')], fountainX, 2), prop(a.anim(`wall_fountain_mid_${c}`), fountainX, 1), prop(a.anim(`wall_fountain_basin_${c}`), fountainX, 0));
    }

    // Columns (or statues) along the back wall, in front of the brick.
    const pillars = sewer ? [a.rect('sewer_pillar_1'), a.rect('sewer_pillar_2')] : pre ? [a.rect(`${pre}statue_1`), a.rect(`${pre}statue_2`)] : [a.rect('column')];
    [-13, -5.5, 2, 9.5].forEach((x, i) => {
      const pr = pillars[i % pillars.length];
      floor.face(x - 0.5, 0, WALL_Z + 0.35, pr, pr.w / 16, pre || sewer ? pr.h / 16 : 3);
    });
    // A few bones along the foot of the wall (in the sewers, pots, crates and rubble), clear of the columns and fountain.
    const junk = sewer ? ['sewer_pot_1', 'sewer_pot_2', 'sewer_pot_3', 'sewer_crate', 'sewer_crate_small', 'sewer_rock_1', 'sewer_rock_2', 'skull'].map((n) => a.rect(n)) : [a.rect('skull')];
    for (let i = 0; i < (sewer ? 9 : 6); i++) {
      const x = -14 + r() * 28;
      if ([-13, -5.5, 2, 9.5, fountainX + 0.5].some((c) => Math.abs(c - x) < 1)) continue;
      const j = junk[Math.floor(r() * junk.length)];
      const size = (sewer ? 0.6 : 0.7) / 16;
      floor.face(x, 0, WALL_Z + 0.5 + r() * 0.6, j, j.w * size, j.h * size);
    }
    // The vault is heaped with treasure: coins everywhere the chests aren't (no painted chests: the real ones are on the floor).
    if (loot) {
      const coin = a.anim('coin')[0];
      const flask = a.rect('flask_big_yellow');
      for (let i = 0; i < 140 + VAULT_LENGTH * 4; i++) {
        const x = -20 + r() * (xEnd + 16);
        const z = WALL_Z + 0.4 + r() * 18;
        // (Not where you can walk: those coins are real ones, picked up as you run over them.)
        if (z < 9.5) continue;
        floor.face(x, 0, z, r() < 0.08 ? flask : coin, 0.42, 0.42);
      }
    }

    const group = new THREE.Group();
    group.add(new THREE.Mesh(wall.build(), this.wallMat), new THREE.Mesh(floor.build(), this.floorMat), ...fountain);
    // Rainbows everywhere: a great one across the back wall, a giant faint one behind it, and smaller ones rising from
    // the corners (all shimmer, see updateVaultRoom).
    if (loot) {
      const arcs: [number, number, number, number, number][] = [
        // x, y, radius, band width, opacity
        [-1, 0.6, 9.4, 0.55, 0.5],
        [-1, -2, 17, 0.9, 0.2],
        [-14, 0.4, 5, 0.32, 0.45],
        [12.5, 0.4, 5, 0.32, 0.45],
        [-6.5, 2.4, 3.2, 0.22, 0.35],
        [5.5, 2.4, 3.2, 0.22, 0.35],
      ];
      // Out in the room too: faint arches standing up out of the floor, big and small, all down the hall.
      for (let x = -10; x < xEnd - 8; x += 4 + r() * 4) {
        const standing = this.rainbowArc(1.4 + r() * 2.6, 0.12 + r() * 0.06, 0.15);
        standing.position.set(x, 0, WALL_Z + 2.5 + r() * 7);
        standing.rotation.y = (r() - 0.5) * 0.6;
        group.add(standing);
        standing.children.forEach((b) => this.roomArcs.push(b as THREE.Mesh));
      }
      // The same set again every 30 units down the hall.
      for (let shift = 0; shift < xEnd; shift += 30) {
        for (const [x, y, radius, width, opacity] of arcs) {
          const arc = this.rainbowArc(radius, width, opacity);
          arc.position.set(x + shift, y, WALL_Z + 0.05 + (radius > 10 ? -0.02 : 0.01));
          group.add(arc);
          arc.children.forEach((b) => this.roomArcs.push(b as THREE.Mesh));
        }
      }
    }
    this.flames = [];
    [-12, -2, 6, 14].forEach((x, i) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), this.flameMat);
      f.position.set(x - 0.5, 4.3, WALL_Z + 0.1);
      group.add(f);
      this.flames.push(f);
      this.torchLights[i].position.set(x - 0.5, 4.3, WALL_Z + 1.2);
      // The sewers burn their own green braziers; the plain flame stays (unseen) to drive the flicker.
      if (sewer) {
        f.visible = false;
        group.add(prop(a.anim('sewer_flame'), x - 1, 3.6, 8));
      }
    });
    // The last floor before the sewers: the way down is a manhole (shown on that floor only, see update).
    this.hatch = null;
    if (!loot && !sewer && tilesFor(seed + 1) === 'sewer') {
      const q = new Quads(a);
      q.top(Math.floor(STAIRS.x), 0.01, Math.floor(STAIRS.z), a.rect('sewer_floor_hatch'));
      this.hatch = new THREE.Mesh(q.build(), this.floorMat);
      group.add(this.hatch);
    }
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

  /** A monster bursts into its own pixels (dying, or caught on a floor that's just been cleared). Returns where. */
  private burstApart(v: MonView) {
    v.dead = 0;
    v.body.visible = false;
    const r = v.sprite.rect;
    const origin = v.body.position.clone().add(new THREE.Vector3(v.knock, v.hopY, 0.05));
    this.fx.shatter(origin, this.atlas.pixels(r, 1), r, v.scale / 16, v.sprite.flip, 1, v.boss ? 1.4 : 1);
    const at = origin.clone().setY(v.height * 0.45);
    this.fx.star(at, 0xffffff, v.boss ? 2.5 : 1.1, 0.18);
    if (this.settings.particles) this.fx.burst(at, '#ffd070', v.boss ? 30 : 5, v.boss ? 6 : 3, 0.06, 12, true);
    if (this.settings.blood) {
      this.fx.spray(at, v.blood, v.boss ? 30 : 10, 1, v.boss ? 1.5 : 1.1);
      if (v.blood !== BONE) this.fx.bloodSplat(v.body.position.clone().setX(v.body.position.x + 0.25), v.blood, v.boss ? 2.2 : 1);
    }
    return at;
  }

  // ---------- relics on the floor ----------

  /** Where a drop lands: relics and boss cards where the boss fell, other cards where their monster did (anywhere
   *  on the floor for a swept one), a goblin's card where it was caught. */
  private dropSpot(ev: Drop): THREE.Vector3 {
    if (ev.t === 'relic') return this.lastBossAt.clone();
    if (ev.src === 'raid' && this.raider) return this.raider.group.position.clone().setY(0);
    if (ev.src === 'sweep') return new THREE.Vector3((-1 + Math.random() * 6) * this.squeeze, 0, (-2 + Math.random() * 4) * this.deep);
    return this.lastKillAt.clone();
  }

  /** A relic or card lands, glowing in its color (a relic's rarity, a card's frame). */
  private dropLoot(ev: Drop, at: THREE.Vector3) {
    let icon: LootView['icon'];
    let color: THREE.Color;
    let tier: number;
    let size: number;
    let tilt = LOOT_TILT;
    let air = LOOT_LAND;
    if (ev.t === 'relic') {
      const def = RELIC_BY_ID.get(ev.id);
      if (!def) return;
      tier = def.rarity;
      color = new THREE.Color(LOOT_COLORS[def.rarity]);
      // (Some relic icons are animations, the purse's coin and the bait's chest: they lie there as their first frame.)
      icon = new PixelSprite(this.atlas.texture, this.atlas.size, [this.atlas.anim(def.icon)[0]], { anchor: 'center' });
      size = 1.15;
    } else {
      const def = CARD_BY_ID.get(ev.id);
      if (!def) return;
      tier = ev.gold ? 3 : ['monster', 'mid', 'boss', 'goblin'].indexOf(def.kind);
      color = new THREE.Color(ev.gold ? CARD_FRAME.gold : CARD_FRAME[def.kind]);
      const map = cardTexture(this.atlas, def, ev.gold);
      // Lit by its own picture as well as the room, so the frame keeps its color in the dungeon's warm gloom.
      const face = (tex: THREE.Texture) => new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.6, color: 0x999999 });
      const geo = new THREE.PlaneGeometry(CARD_W / CARD_H, 1);
      const mesh = new THREE.Mesh(geo, face(map));
      // Two-sided: it spins face-down through the air and lands face-up.
      const backSide = new THREE.Mesh(geo, face(cardBackTexture()));
      backSide.rotation.y = Math.PI;
      mesh.add(backSide);
      icon = { mesh, dispose: () => { geo.dispose(); mesh.material.dispose(); backSide.material.dispose(); map.dispose(); } };
      size = 1.55;
      tilt = 0.3;
      air = 1.15;
      if (ev.gold || def.kind !== 'monster') this.fx.pillar(at.clone(), color, 7, 0.7);
    }
    const group = new THREE.Group();
    // Two drops at once land side by side.
    group.position.copy(at).add(new THREE.Vector3(-0.9 * this.loot.length, 0, 0.4 * this.loot.length));
    icon.mesh.scale.setScalar(size);
    if (ev.t === 'relic') icon.mesh.material.emissive.setScalar(0.12);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55 + tier * 0.06, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(ring, icon.mesh);
    this.scene.add(group);
    this.loot.push({ ev, group, icon, size, tilt, air, landed: false, color, ring, t: 0, fly: -1, from: new THREE.Vector3() });
    this.fx.light(group.position.clone().setY(1.2), color, 25 + tier * 10, 0.6, 9);
    if (this.settings.particles) this.fx.burst(group.position.clone().setY(0.5), '#' + color.getHexString(), 12 + tier * 6, 3, 0.07, 8, true);
  }

  /** Where loot flies to: your hero, or the front of the party without one. */
  private lootHome(game: Game | null) {
    const hero = game ? this.party.find((c) => c.comp === game.heroIndex()) : undefined;
    const c = hero ?? this.party[0];
    return c ? c.body.position.clone().setY(0.9) : new THREE.Vector3(-4, 0.9, 1);
  }

  private updateLoot(dt: number, game: Game) {
    const hero = this.party.find((c) => c.comp === game.heroIndex());
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const l = this.loot[i];
      l.t += dt;
      if (l.fly < 0) {
        // Pops up out of the boss and lands, then bobs, pulses and turns while it waits.
        // It tumbles through the air upright, then settles flat on the floor at an angle, in a pool of its own light.
        const land = Math.min(1, l.t / l.air);
        const settle = Math.max(0, (land - 0.7) / 0.3);
        const card = l.ev.t === 'card';
        l.icon.mesh.position.y = land < 1 ? 0.6 * (1 - settle) + 0.05 * settle + Math.sin(land * Math.PI) * (card ? 2.8 : 2.2) : 0.05;
        // A relic tumbles end over end; a card spins face-down and slows to a stop face-up (5π: from its back to its face).
        if (card) l.icon.mesh.rotation.set(-Math.PI / 2 * settle, (1 - (1 - (1 - land) ** 3)) * 5 * Math.PI, -l.tilt, 'YXZ');
        else l.icon.mesh.rotation.set(-Math.PI / 2 * settle, 0, land < 1 ? -land * (Math.PI * 2 + l.tilt) : -l.tilt, 'YXZ');
        if (land >= 1 && !l.landed) {
          l.landed = true;
          if (card) {
            const at = l.group.position.clone().setY(0.3);
            this.fx.light(at, l.color, 30, 0.5, 8);
            if (this.settings.particles) this.fx.burst(at, '#' + l.color.getHexString(), 18, 3.5, 0.07, 9, true);
            this.addShake(0.08);
          }
        }
        l.icon.mesh.scale.setScalar(l.size * (0.4 + 0.6 * Math.min(1, land * 2)));
        l.ring.rotation.z += dt * 1.5;
        if (l.ev.t === 'card' && l.ev.gold && this.settings.particles && Math.random() < dt * 6) this.fx.burst(l.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.15, (Math.random() - 0.5) * 0.8)), '#ffe9a0', 2, 1.2, 0.05, 4, true);
        l.ring.material.opacity = (0.3 + Math.sin(l.t * 3) * 0.1) * Math.min(1, l.t / l.air);
        // Picked up by walking over it, or it flies to you by itself before long (sooner if the staircase is waiting).
        if (land >= 1 && hero && hero.body.position.distanceTo(l.group.position.clone().setY(0)) < 0.9) this.collectLoot(i);
        else if (l.t > (this.hold ? LOOT_WAIT_STAIRS : LOOT_WAIT)) this.startLootFlight(l);
        continue;
      }
      l.fly += dt;
      const k = Math.min(1, l.fly / LOOT_FLY);
      const to = this.lootHome(game);
      l.group.position.lerpVectors(l.from, to.clone().setY(0), k);
      l.icon.mesh.position.y = 0.3 + Math.sin(k * Math.PI) * 1.4;
      l.icon.mesh.rotation.set(0, 0, 0);
      l.group.scale.setScalar(1 - k * 0.4);
      if (k >= 1) this.collectLoot(i);
    }
  }

  private startLootFlight(l: LootView) {
    if (l.fly >= 0) return;
    l.fly = 0;
    l.from.copy(l.group.position);
    l.ring.visible = false;
  }

  /** Picked up: a burst in its color, and the UI shows its card. */
  private collectLoot(i: number) {
    const [l] = this.loot.splice(i, 1);
    const { color } = l;
    const at = l.group.position.clone().setY(0.9);
    this.fx.light(at, color, 35, 0.5, 9);
    if (this.settings.particles) this.fx.burst(at, '#' + color.getHexString(), 22, 4.5, 0.08, 8, true);
    this.scene.remove(l.group);
    l.icon.dispose();
    l.ring.geometry.dispose();
    l.ring.material.dispose();
    // Picking it up while the staircase waits lets the party head down soon after the card.
    if (this.hold && !this.loot.length) this.hold.t = Math.min(this.hold.t, 1.4);
    this.onLoot?.(l.ev);
  }

  /** Everything on the floor flies to the party (leaving the floor); `now` skips the flight (a descent), and
   *  `oldOnly` leaves anything that only just dropped. */
  private collectAllLoot(now = false, oldOnly = false) {
    if (now) {
      while (this.loot.length) this.collectLoot(this.loot.length - 1);
      return;
    }
    for (const l of this.loot) if (!oldOnly || l.t > 0.1) this.startLootFlight(l);
  }

  /** A click or tap on a relic lying on the floor picks it up. */
  pickLoot(x: number, y: number) {
    const i = this.loot.findIndex((l) => l.fly < 0 && l.landed && this.lootNear(l, x, y));
    if (i < 0) return false;
    this.collectLoot(i);
    return true;
  }

  overLoot(x: number, y: number) {
    return this.loot.some((l) => l.fly < 0 && this.lootNear(l, x, y));
  }

  private lootNear(l: LootView, x: number, y: number) {
    const s = this.toScreen(l.group.position.clone().setY(0.6));
    return Math.abs(x - s.x) < 40 && y > s.y - 60 && y < s.y + 40;
  }

  private monsterPos(id: number): THREE.Vector3 | null {
    const v = this.mons.get(id);
    return v && v.dead < 0 ? v.body.position : null;
  }

  private updateParty(dt: number, game: Game) {
    // On a floor you badly outclass, monsters die the moment they arrive, so the party also goes for the ones still
    // walking in: it's seen fighting them down the room instead of standing idle. (Only the look: damage is the sim's.)
    const arrived = game.monsters.filter((m) => m.arrive <= 0);
    const targets = arrived.length ? arrived : game.monsters;
    const focus = targets[0];
    const haste = 1 + this.fever;
    const hero = game.heroIndex();
    for (const c of this.party) {
      c.home.x = c.homeX * this.squeeze;
      c.home.z = c.homeZ * this.deep;
      if (c.comp === hero || !c.body.visible) continue;
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
    if (!v) return;
    const big = COMPS[c.comp].big;
    const at = v.body.position.clone().setY(v.height * 0.45);
    c.stretch = 1;
    this.fx.swipe(at, 0xfff0d8, big ? 1.5 : 0.95, Math.PI * (0.6 + Math.random() * 0.5));
    this.fx.star(at.clone().setX(at.x - 0.2), 0xffffff, big ? 1.1 : 0.7);
    // (The blow still lands on one that died a moment ago, so a swing is never wasted on thin air.)
    if (v.dead < 0) {
      this.react(v, big ? 0.6 : 0.3);
      this.bleed(v, at, big ? 8 : 4, !!big);
    }
    if (big) {
      this.fx.ring(v.body.position, 0xffd070, 2.2);
      this.addShake(0.1);
    }
    if (this.settings.particles) this.fx.burst(at, '#ffffff', 4, 2.5, 0.06, 8, true);
  }

  /** A ranged companion lets loose. */
  private fire(c: CompView, kind: Attack, id: number) {
    let view = this.mons.get(id);
    // Its target died during the wind-up (all the time on floors you badly outclass): shoot at another instead.
    if (!view || view.dead >= 0) {
      view = [...this.mons.values()].find((m) => m.dead < 0);
      if (!view) return;
      id = view.id;
    }
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
    // Halves of a split boss climb out where it fell, and some things burst up through the floor where they'll
    // fight; everything else comes up the stairs.
    const emerge = m.def.move === 'emerge';
    if (m.half || emerge) body.position.set(m.x * this.squeeze, 0, m.z * this.deep);
    else body.position.copy(STAIRS).add(new THREE.Vector3(Math.random() * 0.6, 0, Math.random() * 0.6));
    body.scale.setScalar(0.01);
    this.scene.add(body);
    // Ordinary monsters ~1.2× (tall ones capped at ~2 units); bosses ~3.4 units tall whatever their art.
    const h = run[0].h / 16;
    let scale = m.boss ? Math.max(1.5, Math.min(2.6, 3.4 / h)) : Math.min(1.2, 2.1 / h);
    if (emerge && m.boss && !m.half) scale *= 1.5;
    if (m.mods.includes('giant')) scale *= 1.3;
    if (m.half) scale *= 0.7;
    if (m.champ) scale *= m.boss ? 1.12 : 1.35;
    inner.scale.setScalar(scale);
    const tint = new THREE.Color(m.def.tint ?? 0xffffff);
    // Modifiers show on the body: steel-grey armour, a red rage, a sickly green regrowth.
    if (m.mods.includes('armored')) tint.multiply(new THREE.Color(0xb4c4dc));
    if (m.mods.includes('enraged')) tint.multiply(new THREE.Color(0xff9a88));
    if (m.mods.includes('regen')) tint.multiply(new THREE.Color(0xb8ffb0));
    // Later laps: everything that climbs the stairs wears the corruption's color.
    // (From the floor, not the room: the vault's treasure room has no lap.)
    const lap = Math.floor(zoneOf(this.lastFloor) / ZONES.length);
    if (lap) tint.lerp(tint.clone().multiply(new THREE.Color(corruptionOf(lap).tint)), 0.7);
    sprite.mesh.material.color.copy(tint);
    if (m.half && this.settings.particles) this.fx.burst(body.position.clone().setY(1), '#d58aff', 14, 4, 0.08, 8);
    let ring: MonView['ring'] = null;
    if (m.champ) {
      ring = new THREE.Mesh(m.boss ? new THREE.RingGeometry(1.2, 1.5, 48) : new THREE.RingGeometry(0.55, 0.75, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.5, 0.4), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      body.add(ring);
    }
    // It comes up through the floor, which stays broken open under it. A boss brings more of itself: smaller
    // tentacles out of grates around the great one.
    const extras: PixelSprite[] = [];
    if (emerge) {
      const q = new Quads(this.atlas);
      const hole = (x: number, z: number, size: number, tile: string) => q.top(x - size / 2, 0.012, z - size / 2, this.atlas.rect(tile), size);
      if (m.boss && !m.half) {
        hole(0, 0, 3.2, 'sewer_floor_hole');
        for (const [x, z, size, fps] of [[-1.9, -1.4, 0.5, 7], [2.6, -0.2, 0.6, 10], [1.5, 1.5, 0.45, 12]]) {
          const extra = new PixelSprite(this.atlas.texture, this.atlas.size, run, { fps, flip: x > 0 });
          extra.update(Math.random());
          extra.mesh.material.color.copy(tint);
          const holder = new THREE.Group();
          holder.position.set(x / scale, 0, z / scale);
          holder.scale.setScalar(size);
          holder.add(extra.mesh);
          inner.add(holder);
          extras.push(extra);
          hole(x, z, 1.6 * size * 2, 'sewer_floor_grate');
        }
      } else hole(0, 0, m.boss ? 2 : 1, 'sewer_floor_grate');
      const mesh = new THREE.Mesh(q.build(), this.floorMat);
      mesh.userData.ownGeometry = true;
      body.add(mesh);
      body.scale.setScalar(1);
    }
    this.mons.set(m.id, { id: m.id, scale, height: h * scale, spotX: m.x, spotZ: m.z, blood: bloodOf(m.def.sprite), body, inner, sprite, idle, run, target: new THREE.Vector3(m.x * this.squeeze, 0, m.z * this.deep), boss: m.boss, big: !!m.def.big || m.boss, flash: 0, squash: 0, knock: 0, hopY: 0, hopV: 0, dead: -1, born: emerge ? 1 : 0, rise: emerge ? 1 : 0, fly: m.def.move === 'fly', extras, glow: m.champ ? 'champ' : null, ring });
    const from = emerge ? body.position : STAIRS;
    if (this.settings.particles) {
      if (emerge) this.fx.burst(from.clone().setY(0.3), '#7ad04a', m.boss ? 40 : 14, m.boss ? 5 : 3, 0.1, 10);
      else this.fx.burst(from.clone().setY(0.4), '#6a5a78', 6, 2, 0.08, 6);
    }
    if (m.boss && !m.half) {
      this.fx.light(from.clone().setY(2), emerge ? 0x8aff5a : 0xff4040, 30, 1, 12);
      this.addShake(emerge ? 0.6 : 0.3);
    }
  }

  private removeView(v: MonView) {
    this.scene.remove(v.body);
    for (const o of v.body.children) if (o instanceof THREE.Mesh && o.userData.ownGeometry) o.geometry.dispose();
    v.sprite.dispose();
    for (const extra of v.extras) extra.dispose();
    v.ring?.geometry.dispose();
    v.ring?.material.dispose();
    this.mons.delete(v.id);
  }

  private updateMonsters(dt: number, game: Game) {
    const alive = new Set(game.monsters.map((m) => m.id));
    // (Nothing new climbs into view during a clutch kill's slow motion; it arrives once that's over.)
    if (!this.clutch) for (const m of game.monsters) if (!this.mons.has(m.id)) this.addMonster(m);
    for (const v of [...this.mons.values()]) {
      if (v.dead >= 0) {
        // Already shattered into pixels; keep the (hidden) view a moment so the UI can place gold on it.
        v.dead += dt;
        if (v.dead > 0.2) this.removeView(v);
        continue;
      }
      if (!alive.has(v.id)) {
        // Gone without dying (the floor changed, the vault, a descent): vanish in a puff.
        if (this.settings.particles) this.fx.burst(v.body.position.clone().setY(0.5), v.blood, 8, 2, 0.08, 6);
        this.removeView(v);
        continue;
      }
      // (Whatever is already waiting on the next floor stays out of the stairway.)
      v.body.visible = this.cine?.phase !== 'stairs';
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
      for (const extra of v.extras) extra.flash = v.flash;
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
      // Rising out of the floor (the floor hides what's still below it), or flying a little above it.
      if (v.rise > 0) {
        v.rise = Math.max(0, v.rise - dt * (v.boss ? 0.8 : 1.6));
        v.inner.position.y -= v.height * v.rise * v.rise;
      }
      if (v.fly) v.inner.position.y += 0.7 + Math.sin(this.time * 5 + v.id) * 0.15;
      v.sprite.update(dt);
      for (const extra of v.extras) {
        extra.mesh.material.emissive.copy(v.sprite.mesh.material.emissive);
        extra.update(dt);
      }
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
    if (r) r.group.visible = this.cine?.phase !== 'stairs';
    if (r && game.raid && game.raid.id === r.id) {
      const t = game.raid.t;
      // Zig-zags across the front of the chamber, taunting you.
      r.group.position.x = r.from * -14 + r.from * 28 * t;
      r.group.position.y = Math.abs(Math.sin(this.time * 10)) * 0.2;
      r.group.position.z = 3.6 + Math.sin(t * Math.PI * 4) * 0.8;
      r.light.intensity = 9 + Math.sin(this.time * 10) * 3;
      r.sprite.update(dt);
      // The rainbow goblin cycles through every color, and so does its glow.
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

  /** The middle of the room, between the party and the monsters. */
  centerScreen() {
    return this.toScreen(new THREE.Vector3(0, 2, 0));
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
        if (ev.kind === 'auto' || ev.kind === 'autoCrit') {
          // Phantom Blade: a ghostly blue cut; a crit cuts bigger with a spark (no slow motion: the blade crits often).
          const blade = ev.kind === 'autoCrit';
          this.fx.swipe(at, 0x9fd8ff, (v.boss ? 1.3 : 0.75) * (blade ? 1.4 : 1));
          if (blade) this.fx.star(at, 0xffffff, 1.2, 0.15);
          this.react(v, blade ? 0.3 : 0.15);
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
        if (v.boss) this.lastBossAt.copy(v.body.position).setY(0);
        this.lastKillAt.copy(v.body.position).setY(0);
        const at = this.burstApart(v);
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
      case 'card': {
        if (ev.t === 'relic') this.relicDropped = true;
        const at = this.dropSpot(ev);
        if (this.clutch) this.pendingLoot.push({ ev, at });
        else this.dropLoot(ev, at);
        break;
      }
      case 'sweep':
        this.sweptAt = this.time;
        break;
      case 'floor': {
        // Leaving a floor: any relic still lying there flies to the party (but not one the boss just dropped: the
        // next floor starts the moment a boss dies, and its relic waits on the floor to be picked up there).
        this.collectAllLoot(false, true);
        // A cleared floor: whatever's still standing bursts apart with it.
        if (ev.cleared) {
          let any = false;
          for (const v of this.mons.values()) if (v.dead < 0 && v.born >= 0.5) {
            this.burstApart(v);
            any = true;
          }
          if (any) this.addShake(0.15);
        }
        const z = zoneOf(ev.floor);
        // Going down into a zone you haven't reached this descent: the staircase. Not while blitzing back through old
        // floors after a descent (sweeping them in seconds), where a staircase every ten floors would just stall you.
        const deeper = z > zoneOf(this.lastFloor) && ev.floor >= game.s.maxFloor && this.time - this.sweptAt > 4;
        this.lastFloor = ev.floor;
        if (this.cine) this.cine.zone = z;
        else if (this.hold) this.hold.zone = z;
        // Let the boss's light, gold and sparks settle (longer if a relic dropped) before the party heads for the stairs.
        else if (deeper && this.settings.cinematics) this.hold = { zone: z, t: this.relicDropped ? 2.8 : 1.6 };
        else if (this.clutch) this.pendingBand = z;
        else this.setBand(z);
        this.relicDropped = false;
        break;
      }
      case 'bossFail':
      case 'retreat':
        this.addShake(0.2);
        break;
      case 'buyComp':
      // Old Friends hands you the Squire and Ranger the moment you buy it.
      case 'abyss':
        this.syncParty(game);
        break;
      case 'raidSpawn':
        this.spawnRaider(ev.id, ev.from, ev.rainbow);
        break;
      case 'bossWin':
        // A clutch kill: the world drops into slow motion around the boss (or just holds its breath, cinematics off).
        if (ev.clutch) {
          const boss = [...this.mons.values()].find((v) => v.boss);
          const at = boss ? boss.body.position.clone().setY(0) : new THREE.Vector3(3 * this.squeeze, 0, 0);
          if (this.settings.cinematics) this.clutch = { t: 0, at, released: false };
          else this.hitstop = Math.max(this.hitstop, 0.5);
          this.addShake(0.35);
          this.fx.light(at.clone().setY(2), 0xfff0b0, 40, 0.6, 14);
        }
        break;
      case 'rampage':
        this.addShake(0.25 + ev.tier * 0.15);
        this.fx.light(new THREE.Vector3(1.5 * this.squeeze, 2, 1), 0xff3050, 30 + ev.tier * 20, 0.8, 14);
        break;
      case 'vaultPick': {
        this.vaultPick = true;
        this.addShake(0.3);
        this.fx.light(this.caughtAt.clone().setY(2), 0xff7ad8, 60, 1.2, 22);
        // A huge rainbow arcs up out of the spot where the goblin was caught.
        if (this.pickArc) this.disposeGroup(this.pickArc.group);
        const arc = this.rainbowArc(7, 0.55, 0.75);
        // (Kept to the middle of the floor so the whole arch shows: goblins are often caught near the edge.)
        arc.position.set(Math.max(-5, Math.min(4, this.caughtAt.x)), 0, Math.min(0, this.caughtAt.z));
        arc.scale.setScalar(0.01);
        this.scene.add(arc);
        this.pickArc = { group: arc, t: 0 };
        if (this.settings.particles) for (const color of RAINBOW) this.fx.burst(this.caughtAt.clone().setY(0.6), color, 8, 6, 0.08, 4, true);
        break;
      }
      case 'chest':
        this.openChestView(ev.id, ev.rainbow);
        break;
      case 'vaultGoblin': {
        const g = this.vaultGoblins.get(ev.id);
        if (g) {
          g.caught = 0;
          const at = g.group.position.clone().setY(1);
          if (this.settings.particles) {
            this.fx.burst(at, '#ffd070', ev.rainbow ? 40 : 16, ev.rainbow ? 7 : 5, 0.08, 12, true);
            if (ev.rainbow) for (const color of RAINBOW) this.fx.burst(at, color, 6, 6, 0.07, 6, true);
          }
          this.fx.light(at, ev.rainbow ? 0xff8ae0 : 0xffd070, ev.rainbow ? 40 : 20, 0.4, 8);
          this.addShake(ev.rainbow ? 0.35 : 0.1);
        }
        break;
      }
      case 'vaultCoin': {
        const c = this.vaultCoins.get(ev.id);
        if (c) {
          c.up = 0;
          if (this.settings.particles) this.fx.burst(c.mesh.position.clone().setY(0.3), '#ffe28a', 4, 2, 0.05, 6, true);
        }
        break;
      }
      case 'vault':
        this.vaultPick = false;
        if (ev.on) this.vaultHero = game.vault?.hero ?? game.heroIndex();
        this.collectAllLoot();
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
        this.caughtAt = at.clone();
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
        this.collectAllLoot(true);
        for (const v of [...this.mons.values()]) this.removeView(v);
        break;
    }
  }

  /** Rebuild everything from the game state (after loading or descending). */
  rebuild(game: Game) {
    this.collectAllLoot(true);
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

  /** How fast the world runs this frame: a clutch kill's slow motion, timed in real seconds so it always takes as
   *  long. Starts slow, lets go with a burst, and eases back to full speed. */
  timeScale(realDt: number) {
    // The pick's rainbow grows and lingers in real time, then fades once you've chosen.
    const pa = this.pickArc;
    if (pa) {
      pa.t += realDt;
      const grow = Math.min(1, pa.t / 0.8);
      pa.group.scale.setScalar(Math.max(0.01, 1 - (1 - grow) ** 3));
      if (!this.vaultPick) {
        const fade = Math.max(0, 1 - (pa.t - (pa.group.userData.chosenAt ??= pa.t)) / 0.6);
        pa.group.children.forEach((b) => ((b as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (b.userData.opacity as number) * fade);
        if (fade <= 0) {
          this.disposeGroup(pa.group);
          this.pickArc = null;
        }
      }
    }
    if (this.vaultPick) return 0.12;
    if (this.jackpotT > 0) {
      this.jackpotT -= realDt;
      return 0.3;
    }
    const c = this.clutch;
    if (!c) return 1;
    c.t += realDt;
    if (!c.released && c.t >= CLUTCH_RELEASE) {
      c.released = true;
      this.clutchRelease(c.at);
    }
    if (c.t >= CLUTCH_END) {
      this.clutch = null;
      if (this.pendingBand !== null) this.setBand(this.pendingBand);
      for (const drop of this.pendingLoot.splice(0)) this.dropLoot(drop.ev, drop.at);
      this.pendingBand = null;
      this.grade.uniforms.saturation.value = 1;
      return 1;
    }
    if (c.t < CLUTCH_RELEASE) return 0.16;
    const k = (c.t - CLUTCH_RELEASE) / (CLUTCH_END - CLUTCH_RELEASE);
    return 0.16 + 0.84 * k * k * (3 - 2 * k);
  }

  /** The held breath lets go: a shockwave, gold everywhere, the color flooding back. */
  private clutchRelease(at: THREE.Vector3) {
    this.fx.shockwave(at.clone().setY(0.1), 9);
    this.fx.ring(at.clone().setY(0.1), 0xffd070, 3.5, 0.6);
    this.fx.light(at.clone().setY(2.5), 0xffe6a0, 90, 1.1, 22);
    if (this.settings.particles) {
      this.fx.burst(at.clone().setY(1.2), '#ffd070', 70, 9, 0.11, 10, true);
      this.fx.burst(at.clone().setY(1.2), '#ffffff', 30, 6, 0.08, 6, true);
    }
    this.addShake(0.9);
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
    // (A clutch kill's slow motion holds everything else too: the next boss, the staircase, a change of room.)
    return !!this.hold || (!!this.cine && this.cine.phase !== 'arrive') || this.trip?.phase === 'go' || !!this.clutch;
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
    const pre = theme === 'jungle' || theme === 'tomb' ? `${theme}_` : theme === 'sewer' ? 'sewer_' : '';
    const a = this.atlas;
    const floors = theme === 'crypt' ? [a.rect('crypt_floor_1'), a.rect('crypt_floor_5')] : theme === 'sewer' ? [a.rect('sewer_floor_1'), a.rect('sewer_floor_2')] : [a.rect(`${pre}floor_${pre ? 2 : 1}`), a.rect(`${pre}floor_3`)];
    // Back wall dim, stairs bright: the flights have to stand out from the tower wall.
    this.wallMat.color.setRGB(...pal.wall).multiplyScalar(0.45);
    this.floorMat.color.setRGB(...pal.floor).multiplyScalar(1.45);
    this.flameMat.color.setHex(pal.torch).lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(1.4);
    for (const l of this.torchLights) l.color.setHex(pal.torch);
    (this.scene.background as THREE.Color).setHex(pal.fog);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(pal.fog);
    fog.near = 20;
    fog.far = 50;
    const well = buildStairwell(a, { wall: a.rect(`${pre}wall_mid`), floor: floors }, { wall: this.wallMat, floor: this.floorMat, flame: this.flameMat });
    c.well = well.group;
    c.flames = well.flames;
    this.scene.add(well.group);
    if (this.room) this.room.visible = false;
    for (const p of this.party) p.body.visible = false;
    // The walkers: the whole party, two abreast (or a lone squire), your hero leading the way.
    const leads = (p: CompView) => (p.comp === this.heroComp ? 0 : 1);
    const who = this.party.length ? [...this.party].sort((x, y) => leads(x) - leads(y) || x.comp - y.comp).map((p) => COMPS[p.comp]) : [COMPS[0]];
    who.forEach((def, i) => {
      const { run } = a.creature(def.sprite);
      const w = new PixelSprite(a.texture, a.size, run, { fps: 10 });
      w.mesh.scale.multiplyScalar(this.compScale(def) * 0.96);
      // Each switchback runs under the flight just walked down, which would hide them; draw them over the steps
      // instead, the near one of each pair last.
      w.mesh.material.depthTest = false;
      w.mesh.renderOrder = i % 2 ? 10 : 11;
      this.scene.add(w.mesh);
      c.walkers.push(w);
      const sh = blobShadow(0.9);
      this.scene.add(sh);
      c.shadows.push(sh);
    });
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
    // Everyone walks in from the left, your hero first.
    for (const p of this.party) {
      p.body.visible = true;
      p.act = null;
      p.body.position.set(p.comp === this.heroComp ? -14.5 : -16.5 - Math.random() * 2, 0, p.home.z);
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
      // Pairs file down the stairs; the camera pans slower than they walk, so the whole column passes through view.
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
        c.shadows[i].position.set(p.x, p.y + 0.02, p.z + 0.15 - side * 0.45);
        w.update(dt);
      });
      // Side-on view of the stairway, following the column down.
      const head = stairPoint(Math.min(lead - 2, 1 + c.t * pan + Math.min(tail, 4)));
      const dist = this.camBase.z - this.look.z;
      const y = head.y + 1.2;
      this.camera.position.set(head.x, y + dist * 0.2, dist);
      this.camera.lookAt(head.x, y, 0);
      c.flames.forEach((f, i) => f.scale.set(1, 0.85 + Math.sin(this.time * 13 + i) * 0.12, 1));
      this.torchLights[0].position.set(head.x, head.y + 2, 2);
      this.torchLights[1].position.copy(stairPoint(lead + 8)).add(new THREE.Vector3(0, 2, 1));
      this.torchLights[0].intensity = 7;
      this.torchLights[1].intensity = 6;
      this.torchLights[0].distance = this.torchLights[1].distance = 12;
      this.hemi.intensity = 1.7;
      this.key.intensity = 1.4;
      const fog = this.scene.fog as THREE.Fog;
      fog.near = dist + 1.5;
      fog.far = dist + 7;
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
    if (!c) {
      // No hero (none yet, or you've gone without): the ring comes off, and whoever had it walks back into line.
      this.heroRing?.removeFromParent();
      this.heroComp = -1;
      return;
    }
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
    const views = (list: Monster[]) => list.map((m) => this.mons.get(m.id)).filter((v): v is MonView => !!v && v.dead < 0 && v.born >= 1);
    // As with the party: when everything dies on arrival, the hero goes for what's still walking in.
    const arrivedLive = views(game.monsters.filter((m) => m.arrive <= 0));
    const live = arrivedLive.length ? arrivedLive : views(game.monsters);
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

    // In the vault, the shut chests are what to go for.
    const shut = this.inVaultRoom ? [...this.vaultChests.values()].filter((v) => !v.open && v.born >= 1) : [];
    const nearestChest = shut.reduce<ChestView | null>((best, v) => (!best || v.group.position.distanceToSquared(p) < best.group.position.distanceToSquared(p) ? v : best), null);

    // Where to go: the keys (then a moment standing where they left it), the mouse, or, left alone, the nearest
    // monster (home when the room is clear). Pointing at or near a monster means "go and fight that one".
    const { keys, stay, idle } = this.heroInput;
    // In the vault, a mouse left resting for a long while counts as no one steering.
    const aim = this.inVaultRoom && idle ? null : this.heroInput.aim;
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
      // Left alone, the hero goes for loot on the floor first (a chest, in the vault), then the nearest monster.
      const drop = this.loot.find((l) => l.fly < 0);
      const prey = nearest(p);
      // (With every chest open, the vault's hero sees itself out.)
      const out = this.inVaultRoom && !nearestChest && this.exitPortal ? this.exitPortal.position.clone().setY(0) : null;
      goal = nearestChest ? nearestChest.group.position.clone() : out ?? (drop ? drop.group.position.clone().setY(0) : prey ? besideOf(prey) : c.home.clone());
    }

    // Walk there smoothly: ease in and out, ignore tiny nudges until already walking, settle on arrival.
    const want = new THREE.Vector3();
    if (goal) {
      goal.z = Math.max(WALL_Z + 0.9, goal.z);
      const d = goal.sub(p).setY(0);
      const dist = d.length();
      const walking = this.heroVel.length() > 0.4;
      // In the vault you sprint when you steer; left alone the hero ambles chest to chest (so "every chest" takes you).
      const steered = !!aim || steer.lengthSq() > 0;
      const speed = HERO_SPEED * (1 + this.fever * 0.3) * (this.inVaultRoom ? (steered ? 1.35 : 0.35) : 1);
      if (dist > (walking ? 0.08 : 0.45)) want.copy(d).setLength(speed * Math.min(1, dist / 0.9));
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

    // Goblins the hero runs into are caught.
    if (this.inVaultRoom) for (const [id, g] of this.vaultGoblins) if (g.caught < 0 && g.group.position.distanceTo(p) < 1.6) game.catchVaultGoblin(id);
    // Loose coins under the hero's feet are scooped up.
    if (this.inVaultRoom) for (const [id, coin] of this.vaultCoins) if (coin.up < 0 && coin.mesh.position.distanceTo(p) < 0.85) game.pickCoin(id);
    // Any shut chest the hero runs into flies open; the far portal takes them back out.
    for (const v of shut) if (v.group.position.distanceTo(p) < CHEST_REACH * (v.rainbow ? 1.4 : 1)) game.openChest(v.id);
    if (this.exitPortal && !this.trip && this.exitPortal.position.clone().setY(0).distanceTo(p) < 1.6) game.leaveVault();

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
    const clear = foot.x > rect.left + 48 && foot.x < rect.right - right - 48 && foot.y > rect.top + top + 70 && foot.y < rect.bottom - bottom - 16;
    // Not behind the dock either (feet within reach of its buttons would put the hero's body behind them).
    return clear && !this.heroBlocked.some((b) => foot.x > b.left - 36 && foot.x < b.right + 36 && foot.y > b.top - 14);
  }

  /** Where your hero's head is on screen, for the introduction's marker. */
  heroScreen(game: Game): { x: number; y: number } | null {
    const c = this.party.find((p) => p.comp === game.heroIndex());
    if (!c || !c.body.visible) return null;
    const h = (c.sprite.rect.h / 16) * c.base;
    return this.toScreen(c.body.position.clone().setY(h + 0.15));
  }

  /** Where your hero stands on screen (their feet), or null with no hero on the field. */
  heroFeet(game: Game): { x: number; y: number } | null {
    const c = this.party.find((p) => p.comp === game.heroIndex());
    if (!c || !c.body.visible) return null;
    return this.toScreen(c.body.position.clone().setY(0));
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

  /** The vault's chests: new ones pop up one after another, shut ones glint, Rainbow Chests glow every color. */
  private updateVaultChests(dt: number, game: Game) {
    const list = game.vault?.chests ?? [];
    list.forEach((c, k) => {
      if (!this.vaultChests.has(c.id)) this.addVaultChest(c, -k * 0.05);
    });
    this.updateVaultGoblins(dt, game);
    // Loose coins spin where they lie; a picked one hops up and vanishes.
    for (const c of game.vault?.coins ?? []) {
      if (c.taken || this.vaultCoins.has(c.id)) continue;
      const sprite = new PixelSprite(this.atlas.texture, this.atlas.size, this.atlas.anim('coin'), { fps: 8 });
      sprite.update(Math.random());
      const mesh = new THREE.Group();
      mesh.add(sprite.mesh);
      mesh.scale.setScalar(COIN_SIZE);
      mesh.position.set(c.x * this.squeeze, 0, c.z * this.deep);
      this.scene.add(mesh);
      this.vaultCoins.set(c.id, { sprite, mesh, up: -1 });
    }
    for (const [id, c] of this.vaultCoins) {
      c.sprite.update(dt);
      if (c.up < 0) continue;
      c.up += dt;
      c.mesh.position.y = c.up * 6 - c.up * c.up * 8;
      c.mesh.scale.setScalar(Math.max(0.01, COIN_SIZE * (1 - c.up * 2.5)));
      if (c.up > 0.4) {
        this.disposeGroup(c.mesh);
        this.vaultCoins.delete(id);
      }
    }
    for (const v of this.vaultChests.values()) {
      v.born = Math.min(1, v.born + dt * 3);
      const b = Math.max(0, v.born);
      // A little overshoot as it lands.
      const pop = b < 1 ? 1 + Math.sin(b * Math.PI) * 0.35 : 1;
      v.group.scale.setScalar(Math.max(0.01, b * pop));
      if (v.born > 0 && v.born - dt * 3 <= 0 && this.settings.particles) this.fx.burst(v.group.position.clone().setY(0.2), '#ffe9a8', 6, 2, 0.06, 6, true);
      if (v.aura) {
        v.aura.material.color.setHSL((this.time * 0.5 + v.id * 0.1) % 1, 0.9, 0.6);
        v.aura.material.opacity = v.open ? Math.max(0, v.aura.material.opacity - dt) : 0.55 + Math.sin(this.time * 5) * 0.2;
      }
      if (!v.open && this.settings.particles && Math.random() < dt * (v.rainbow ? 6 : 0.8)) {
        const at = v.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.6, 0.2));
        this.fx.star(at, v.rainbow ? new THREE.Color().setHSL(Math.random(), 1, 0.7) : 0xfff0b0, 0.35, 0.25);
      }
      // Shut chests breathe; an opened one settles after its pop.
      const breathe = v.open ? 0 : Math.sin(this.time * 3 + v.id) * 0.04;
      v.inner.scale.y += ((v.inner.userData.base as number) * (1 + breathe) - v.inner.scale.y) * Math.min(1, dt * 10);
      v.sprite.update(dt);
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.t += dt;
      const k = a.t / a.life;
      a.group.scale.setScalar(Math.min(1, a.t / 0.25));
      a.group.position.y += dt * 0.4;
      a.group.children.forEach((b) => ((b as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (b.userData.opacity as number) * (1 - k * k));
      if (k >= 1) {
        this.disposeGroup(a.group);
        this.arcs.splice(i, 1);
      }
    }
  }

  /** Vault goblins amble between random spots down the hall and scamper off when your hero comes close (slower than a
   *  sprint, so a short chase always catches them). */
  private updateVaultGoblins(dt: number, game: Game) {
    const hero = this.party.find((c) => c.comp === this.vaultHero)?.body.position;
    const minX = -12 * this.squeeze;
    const maxX = (VAULT_LENGTH - 4) * this.squeeze;
    const spot = () => new THREE.Vector3(minX + Math.random() * (maxX - minX), 0, (-2.6 + Math.random() * 5.6) * this.deep);
    for (const g of game.vault?.goblins ?? []) {
      if (g.caught || this.vaultGoblins.has(g.id)) continue;
      const { run } = this.atlas.creature('goblin');
      const sprite = new PixelSprite(this.atlas.texture, this.atlas.size, run, { fps: 14 });
      // (Only a hint of the gold glow: the vault is bright enough to wash them out.)
      sprite.mesh.material.emissive.setRGB(0.06, 0.04, 0);
      const inner = new THREE.Group();
      inner.scale.setScalar(g.rainbow ? 1.7 : 1.3);
      inner.add(sprite.mesh);
      const group = new THREE.Group();
      group.add(inner, blobShadow(0.8));
      group.position.set(g.x * this.squeeze, 0, g.z * this.deep);
      this.scene.add(group);
      this.vaultGoblins.set(g.id, { group, sprite, rainbow: g.rainbow, goal: spot(), caught: -1 });
    }
    for (const [id, v] of this.vaultGoblins) {
      const p = v.group.position;
      if (v.caught >= 0) {
        // Caught: a hop, a spin, gone.
        v.caught += dt;
        p.y = v.caught * 5 - v.caught * v.caught * 12;
        v.group.rotation.y += dt * 20;
        v.group.scale.setScalar(Math.max(0.01, 1 - v.caught * 2.5));
        if (v.caught > 0.4) {
          this.disposeGroup(v.group);
          this.vaultGoblins.delete(id);
        }
        continue;
      }
      let dir = v.goal.clone().sub(p).setY(0);
      let speed = 1.4;
      const away = hero ? p.clone().sub(hero).setY(0) : null;
      if (away && away.length() < 2.6) {
        dir = away;
        speed = v.rainbow ? 3.6 : 3;
      } else if (dir.length() < 0.4) v.goal = spot();
      if (dir.lengthSq() > 1e-6) p.add(dir.setLength(speed * dt));
      p.x = Math.max(minX, Math.min(maxX, p.x));
      p.z = Math.max(WALL_Z + 1, Math.min(3.2 * this.deep, p.z));
      if (Math.abs(dir.x) > 0.05) v.sprite.flip = dir.x < 0;
      if (v.rainbow) v.sprite.mesh.material.color.setHSL((this.time * 0.8 + id * 0.1) % 1, 0.9, 0.65);
      v.sprite.update(dt * (speed / 3));
    }
  }

  /** Is a vault goblin under the cursor? (Clicking one catches it.) */
  hitVaultGoblin(x: number, y: number): number | null {
    for (const [id, v] of this.vaultGoblins) {
      if (v.caught >= 0) continue;
      const c = this.toScreen(v.group.position.clone().setY(0.8));
      if (Math.hypot(x - c.x, y - c.y) < 44) return id;
    }
    return null;
  }

  /** Where a vault goblin is on screen. */
  goblinScreen(id: number): { x: number; y: number } | null {
    const v = this.vaultGoblins.get(id);
    return v ? this.toScreen(v.group.position.clone().setY(0.9)) : null;
  }

  private addVaultChest(c: VaultChest, born: number) {
    const frames = this.atlas.anim('chest_full_open');
    const sprite = new PixelSprite(this.atlas.texture, this.atlas.size, [frames[0]], { fps: 14 });
    const inner = new THREE.Group();
    inner.add(sprite.mesh);
    const base = c.rainbow ? 2 : 1.25;
    inner.scale.setScalar(base);
    inner.userData.base = base;
    const group = new THREE.Group();
    group.add(inner, blobShadow(c.rainbow ? 1.6 : 1));
    let aura: THREE.Sprite | null = null;
    if (c.rainbow) {
      aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      aura.scale.setScalar(4);
      aura.position.y = 1;
      group.add(aura);
      // A Rainbow Chest carries its own little rainbow.
      const arc = this.rainbowArc(1.6, 0.12, 0.55);
      arc.position.set(0, 0.2, -0.1);
      group.add(arc);
    }
    group.position.set(c.x * this.squeeze, 0, c.z * this.deep);
    group.scale.setScalar(0.01);
    this.scene.add(group);
    this.vaultChests.set(c.id, { id: c.id, group, inner, sprite, rainbow: c.rainbow, open: c.open, born, aura });
  }

  /** The lid flies open: a fountain of coins, a rainbow rising out of it, and for a Rainbow Chest a slow-motion jackpot. */
  private openChestView(id: number, rainbow: boolean) {
    const v = this.vaultChests.get(id);
    if (!v || v.open) return;
    v.open = true;
    v.sprite.play(this.atlas.anim('chest_full_open'), 14, false);
    v.inner.scale.y = (v.inner.userData.base as number) * 1.35;
    const at = v.group.position.clone();
    const top = at.clone().setY(rainbow ? 1.4 : 0.8);
    if (this.settings.particles) {
      this.fx.burst(top, '#ffd070', rainbow ? 90 : 28, rainbow ? 9 : 6, 0.1, 14, true);
      for (const color of RAINBOW) this.fx.burst(top, color, rainbow ? 10 : 3, rainbow ? 7 : 4.5, 0.07, 6, true);
    }
    this.fx.light(top, new THREE.Color().setHSL(Math.random(), 0.9, 0.6), rainbow ? 90 : 30, rainbow ? 1 : 0.4, rainbow ? 18 : 8);
    const arc = this.rainbowArc(rainbow ? 3.4 : 1.3, rainbow ? 0.3 : 0.11, 0.7);
    arc.position.copy(at).setY(0.1);
    arc.scale.setScalar(0.01);
    this.scene.add(arc);
    this.arcs.push({ group: arc, t: 0, life: rainbow ? 2.4 : 1.1 });
    this.addShake(rainbow ? 0.7 : 0.12);
    if (rainbow) {
      this.fx.shockwave(at, 6);
      this.fx.beam(at.x, at.z, '#ffffff', 4);
      if (this.settings.cinematics) this.jackpotT = 0.7;
    }
  }

  /** A rainbow oval in the back wall: a shimmering doorway ringed in the rainbow's seven bands. Its foot is on the floor. */
  private rainbowPortal(x: number): THREE.Group {
    const group = new THREE.Group();
    const oval = new THREE.Group();
    oval.scale.set(0.75, 1.2, 1);
    oval.position.y = 1.6;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.name = 'disc';
    oval.add(disc);
    RAINBOW.forEach((color, i) => {
      const r0 = 1.25 + i * 0.1;
      oval.add(new THREE.Mesh(new THREE.RingGeometry(r0, r0 + 0.1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
    });
    group.add(oval);
    group.position.set(x, 0, WALL_Z + 0.12);
    return group;
  }

  /** A portal's swirl: the doorway cycles the rainbow and breathes, throwing off colored sparks. */
  private animatePortal(portal: THREE.Group, dt: number) {
    const disc = portal.getObjectByName('disc') as THREE.Mesh | undefined;
    if (disc) (disc.material as THREE.MeshBasicMaterial).color.setHSL((this.time * 0.6) % 1, 0.9, 0.65);
    const oval = portal.children[0];
    oval.scale.set(0.75 * (1 + Math.sin(this.time * 5) * 0.04), 1.2 * (1 + Math.sin(this.time * 5 + 1) * 0.04), 1);
    if (this.settings.particles && Math.random() < dt * 25) {
      const at = portal.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 0.3 + Math.random() * 3, 0.2));
      this.fx.burst(at, new THREE.Color().setHSL(Math.random(), 0.9, 0.65), 2, 2, 0.07, 2, true);
    }
  }

  /** Where the vault's way out is on screen (for its label), or null outside the vault. */
  exitScreen(): { x: number; y: number } | null {
    return this.exitPortal ? this.toScreen(this.exitPortal.position.clone().setY(0).setZ(WALL_Z + 0.9)) : null;
  }

  /** The cursor sweeps up loose vault coins it passes over (chests still need your hero). */
  sweepVaultCoins(x: number, y: number, game: Game) {
    if (!this.inVaultRoom) return;
    for (const [id, c] of this.vaultCoins) {
      if (c.up >= 0) continue;
      const s = this.toScreen(c.mesh.position.clone().setY(0.2));
      if (Math.hypot(s.x - x, s.y - y) < 36) game.pickCoin(id);
    }
  }

  /** Where a loose vault coin is on screen. */
  coinScreen(id: number): { x: number; y: number } | null {
    const c = this.vaultCoins.get(id);
    return c ? this.toScreen(c.mesh.position.clone().setY(0.3)) : null;
  }

  /** Where a vault chest is on screen (for the coins that fly from it to the bank). */
  chestScreen(id: number): { x: number; y: number } | null {
    const v = this.vaultChests.get(id);
    return v ? this.toScreen(v.group.position.clone().setY(v.rainbow ? 1.2 : 0.7)) : null;
  }

  /** A rainbow oval opens in the back wall behind whoever goes; they walk into it and the flash carries them across. */
  private startTrip(into: boolean) {
    if (this.trip) this.disposeGroup(this.trip.portal);
    const hero = this.party.find((c) => c.comp === this.vaultHero);
    const portal = this.rainbowPortal(hero ? hero.body.position.x : 0);
    portal.scale.setScalar(0.01);
    this.scene.add(portal);
    this.trip = { into, phase: 'go', t: 0, portal, reached: -1 };
    this.fx.light(portal.position.clone().setY(2), 0xff9ae0, 40, TRIP_OPEN, 14);
    this.addShake(0.25);
  }

  private updateTrip(dt: number) {
    const trip = this.trip!;
    trip.t += dt;
    const hue = (this.time * 0.6) % 1;
    let fade = 0;
    if (trip.phase === 'go') {
      const portal = trip.portal;
      // The oval slowly tears open out of the wall (easing out, a slight overshoot), then swirls.
      const open = Math.min(1, trip.t / TRIP_OPEN);
      const eased = 1 - (1 - open) ** 3;
      portal.scale.setScalar(Math.max(0.01, eased * (1 + Math.sin(open * Math.PI) * 0.12)));
      this.animatePortal(portal, dt);
      if (open < 1 && this.settings.particles && Math.random() < dt * 30) this.fx.burst(portal.position.clone().setY(0.2), '#ffe2ff', 3, 3, 0.06, 6, true);
      // Only the one who goes (both ways) walks to it, stops on the threshold, and steps through; the rest wait.
      const door = portal.position.clone().setZ(WALL_Z + 0.95);
      for (const p of this.party) {
        if (p.comp !== this.vaultHero) continue;
        p.act = null;
        const pos = p.body.position;
        const d = door.clone().sub(pos).setY(0);
        const walking = trip.t > TRIP_OPEN * 0.7 && trip.reached < 0;
        if (walking) {
          const step = TRIP_WALK_SPEED * dt;
          if (d.length() > step) pos.add(d.setLength(step));
          else {
            pos.copy(door);
            trip.reached = trip.t;
          }
          if (Math.abs(d.x) > 0.1) p.sprite.flip = d.x < 0;
        }
        // On the threshold for a beat, then shrinking into the light.
        const inT = trip.reached < 0 ? 0 : Math.max(0, trip.t - trip.reached - TRIP_PAUSE) / TRIP_STEP_IN;
        p.body.scale.setScalar(Math.max(0.01, 1 - inT));
        p.body.position.y = inT > 0 ? Math.sin(Math.min(1, inT) * Math.PI) * 0.4 : 0;
        p.sprite.play(walking ? p.run : p.idle);
        p.sprite.update(dt * (walking ? 0.6 : 1));
        if (inT > 0 && inT - dt / TRIP_STEP_IN <= 0) {
          this.fx.light(door.clone().setY(1.6), 0xffffff, 80, 0.6, 16);
          if (this.settings.particles) for (const color of RAINBOW) this.fx.burst(door.clone().setY(1.2), color, 6, 4, 0.08, 4, true);
          this.addShake(0.3);
        }
      }
      const gone = trip.reached < 0 ? Infinity : trip.reached + TRIP_PAUSE + TRIP_STEP_IN;
      fade = Math.max(0, (trip.t - gone) / TRIP_FLASH);
      if (trip.t >= gone + TRIP_FLASH || trip.t > 8) {
        this.setVaultRoom(trip.into);
        this.disposeGroup(portal);
        // The vault's hero tumbles in from the left of the new room (the rest never left the floor).
        for (const p of this.party) {
          if (p.comp !== this.vaultHero) continue;
          p.body.position.set(-15 - Math.random() * 3, 0, p.home.z);
          p.body.scale.setScalar(1);
          p.body.position.y = 0;
        }
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
    if (this.exitPortal) {
      this.animatePortal(this.exitPortal, dt);
      // A steady glow in front of the way out, so it reads as a door rather than another rainbow on the wall.
      if (Math.random() < dt * 3) this.fx.light(this.exitPortal.position.clone().setY(1.6).setZ(WALL_Z + 1.5), new THREE.Color().setHSL((this.time * 0.6) % 1, 0.8, 0.7), 22, 0.5, 9);
    }
    // The torches' light travels down the hall with the camera.
    [-12, -2, 6, 14].forEach((x, i) => (this.torchLights[i].position.x = x - 0.5 + this.pan));
    this.roomArcs.forEach((b, i) => ((b.material as THREE.MeshBasicMaterial).opacity = (b.userData.opacity as number) * (0.7 + 0.3 * Math.sin(this.time * 2.2 + i * 0.6))));
    this.torchLights.forEach((l, i) => l.color.setHSL((hue + i / 4) % 1, 0.85, 0.6));
    this.hemi.color.setHSL((hue + 0.5) % 1, 0.45, 0.55);
    this.flameMat.color.setHSL(hue % 1, 0.9, 0.7).multiplyScalar(1.4);
    if (!this.settings.particles) return;
    this.sparkleT -= dt;
    if (this.sparkleT > 0) return;
    this.sparkleT = 0.12;
    const at = new THREE.Vector3(this.pan - 14 + Math.random() * 28, 0.2 + Math.random() * 0.6, WALL_Z + 0.6 + Math.random() * 12);
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
    // (Still there while the party heads out to it: the game has moved on to the next floor by then.)
    if (this.hatch) this.hatch.visible = this.lastFloor % 10 === 0 || !!this.hold || this.cine?.phase === 'exit';
    // (The staircase waits for any relic on the floor to be picked up.)
    if (this.hold && !this.clutch && !this.loot.length && (this.hold.t -= dt) <= 0) {
      this.startCinematic(this.hold.zone);
      this.hold = null;
    }
    if (this.cine) this.updateCinematic(dt);
    if (this.trip) this.updateTrip(dt);
    if (this.inVaultRoom) this.updateVaultRoom(dt);
    if (this.inVaultRoom || this.arcs.length) this.updateVaultChests(dt, game);
    const holding = (this.cine && this.cine.phase !== 'arrive') || this.trip?.phase === 'go';
    this.updateMonsters(dt, game);
    if (!holding) {
      this.updateParty(dt, game);
      this.updateHero(dt, game);
    }
    this.updateShots(dt);
    this.updateRaiders(dt, game);
    this.updateLoot(dt, game);
    this.fx.update(dt);

    const buffed = game.s.buffs.some((b) => b.id !== 'fever');
    this.bloom.strength = 0.42 + this.fever * 0.3 + (buffed ? 0.12 : 0);
    this.grade.uniforms.warmth.value = 0.06 + this.fever * 0.08;
    this.grade.uniforms.vignette.value = 0.55 + this.fever * 0.25;

    // In the vault the camera slides down the hall after your hero.
    if (this.inVaultRoom) {
      const hero = this.party.find((c) => c.comp === this.vaultHero);
      const end = (VAULT_LENGTH + 2) * this.squeeze - 4;
      const want = hero ? Math.max(0, Math.min(end, hero.body.position.x)) : this.pan;
      this.pan += (want - this.pan) * Math.min(1, dt * 3);
    }
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sh = this.shake * this.shake * 2.2;
    if (this.cine?.phase !== 'stairs') {
      this.camera.position.set(this.camBase.x + this.pan + (Math.random() - 0.5) * sh, this.camBase.y + (Math.random() - 0.5) * sh, this.camBase.z);
      const look = this.look.clone();
      look.x += this.pan;
      // Walking into a rainbow portal: the camera eases in on the doorway.
      const tr = this.trip;
      if (tr?.phase === 'go' && this.settings.cinematics) {
        const k = Math.min(1, tr.t / (TRIP_OPEN + 1));
        const push = k * k * (3 - 2 * k);
        const focus = tr.portal.position.clone().setY(1.6);
        this.camera.position.lerp(focus.clone().add(new THREE.Vector3(0, 3, 9)), push * 0.35);
        look.lerp(focus, push * 0.5);
      }
      // A clutch kill: push in on the fallen boss and drain the color, then let both go with the release.
      const c = this.clutch;
      if (c) {
        const inT = Math.min(1, c.t / 0.35);
        const outT = c.t < CLUTCH_RELEASE + 0.15 ? 0 : Math.min(1, (c.t - CLUTCH_RELEASE - 0.15) / (CLUTCH_END - CLUTCH_RELEASE - 0.15));
        const punch = inT * inT * (3 - 2 * inT) * (1 - outT * outT * (3 - 2 * outT));
        const focus = c.at.clone().setY(1.2);
        this.camera.position.lerp(focus.clone().add(new THREE.Vector3(0, 3.2, 6.5)), punch * 0.45);
        look.lerp(focus, punch * 0.6);
        this.grade.uniforms.saturation.value = c.released ? 1 + 0.35 * (1 - outT) : 1 - 0.75 * inT;
        this.grade.uniforms.vignette.value += punch * 0.35;
      }
      this.camera.lookAt(look);
    }
    this.composer.render(dt);
  }
}
