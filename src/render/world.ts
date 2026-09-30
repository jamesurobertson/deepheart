import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GradeShader, tiltShift } from './post.ts';
import type { Game, GameEvent, Enemy, Projectile } from '../game/sim.ts';
import { chapterOf, isBossStage } from '../game/sim.ts';
import { RARITY_COLORS, type Item, type Slot } from '../game/items.ts';
import type { Atlas, Rect } from './atlas.ts';
import { PixelSprite, blobShadow, PX } from './sprite.ts';
import { buildStageMesh } from './stagemesh.ts';
import { Fx, flameTexture } from './fx.ts';
import { Overlay } from './overlay.ts';

/** 0x72 weapon sprite held for each weapon family (melee classes). */
const WEAPON_SPRITE: Record<string, string> = {
  Rapier: 'weapon_duel_sword', Sword: 'weapon_knight_sword', Greatsword: 'weapon_anime_sword', Katana: 'weapon_katana',
  Scimitar: 'weapon_machete', Spear: 'weapon_spear', Staff: 'weapon_red_magic_staff', Morningstar: 'weapon_baton_with_spikes',
  Axe: 'weapon_axe', Club: 'weapon_mace', Knife: 'weapon_knife', Cleaver: 'weapon_cleaver', Scythe: 'weapon_waraxe',
  Sickle: 'weapon_throwing_axe', Flail: 'weapon_baton_with_spikes', Hammer: 'weapon_big_hammer',
};

const GORE: Record<string, string> = {
  goblin: '#7bb34f', imp: '#d9534f', tiny_zombie: '#8fae6b', tiny_slug: '#d8c05a', skelet: '#e6e0cf', masked_orc: '#6f9a4a',
  swampy: '#5f8f4f', muddy: '#8a6a4a', orc_warrior: '#6a9a45', orc_shaman: '#6a9a45', zombie: '#7f9f6b', slug: '#d8c05a',
  necromancer: '#9a6ad0', wogol: '#9a9aaa', chort: '#d0504a', ice_zombie: '#9fd0f0', ogre: '#c08a5a', big_zombie: '#7f9f6b', big_demon: '#e0503a',
};

interface Palette { torch: number; fog: number; sky: number }
interface ChapterLook extends Palette { wall: [number, number, number] }
/** One mood per chapter, in chapter order (see CHAPTERS in the HUD). */
const PALETTES: ChapterLook[] = [
  { torch: 0xff9a4a, fog: 0x0a0708, sky: 0x6a5a78, wall: [0.44, 0.4, 0.42] }, // The Sunken Keep: warm torchlight
  { torch: 0x5ad6c8, fog: 0x04090b, sky: 0x4a6a78, wall: [0.34, 0.4, 0.44] }, // Bone Crypts: cold teal
  { torch: 0xa6e06a, fog: 0x060906, sky: 0x55704a, wall: [0.36, 0.42, 0.34] }, // Orc Warrens: mossy green
  { torch: 0xb485ff, fog: 0x08060d, sky: 0x5a4a82, wall: [0.38, 0.34, 0.44] }, // The Rotting Deep: sickly violet
  { torch: 0xff5a3a, fog: 0x0b0505, sky: 0x6a4a52, wall: [0.48, 0.32, 0.32] }, // Demon Gate: hellish red
  { torch: 0x9cc0ff, fog: 0x05070c, sky: 0x5a6a8a, wall: [0.36, 0.4, 0.5] }, // Frozen Vault: icy blue
];
const MODE_TORCH: Record<string, number> = { worldboss: 0xff3a2a, dungeon_gold: 0xffc84a, dungeon_gear: 0xc77dff, dungeon_xp: 0x7ddb6a };
const TORCH_LIGHTS = 8;
/** The hero always draws in front of the crowd. */
const HERO_Z = 0.55;
const AURA_GEO = new THREE.RingGeometry(0.42, 0.56, 28);

/** Tint per skill visual. */
const SKILL_COLOR: Record<string, string> = {
  shockwave: '#ffd27a', quake: '#d9a060', avalanche: '#d9a060', whirlwind: '#fff0c0', charge: '#ffe0a0', warcry: '#ff6a4a',
  meteor: '#ff7a33', lightning: '#9fe6ff', frost: '#9fd8ff', blizzard: '#bfe8ff', rain: '#ffe6a0', pierce: '#ffe6a0',
  hawkeye: '#8aff8a', barrage: '#ffe6a0', slam: '#d9a060', ironskin: '#ffd23f',
};

interface EnemyView {
  group: THREE.Group;
  sprite: PixelSprite;
  anims: { idle: Rect[]; run: Rect[] };
  lastX: number;
  flash: number;
  squash: number;
  born: number;
  scale: number;
  height: number;
  aura?: THREE.Mesh;
}

/** A killed monster tumbling away before it shatters. */
interface Corpse {
  view: EnemyView;
  vx: number;
  vy: number;
  spin: number;
  t: number;
  color: string;
  big: boolean;
}

interface Pop {
  sprite: PixelSprite;
  t: number;
  ev: Extract<GameEvent, { t: 'drop' }>;
  pos: THREE.Vector3;
  vx: number;
  vy: number;
  floor: number;
  bounces: number;
  restT: number; // seconds resting on the floor so far (-1 while airborne)
}

interface Coin {
  sprite: PixelSprite;
  t: number;
  from: THREE.Vector3;
}

export interface IconSheet {
  texture: THREE.Texture;
  size: { w: number; h: number };
}

export class World {
  readonly overlay: Overlay;
  /** Seconds of hit-stop requested by big impacts; main.ts consumes it. */
  hitstop = 0;
  onLootLanded?: (ev: Extract<GameEvent, { t: 'drop' }>, screen: { x: number; y: number }) => void;

  private container: HTMLElement;
  private atlas: Atlas;
  private icons: Record<string, IconSheet>;
  private fadeEl: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 150);
  private camDist = 22;
  private cam = new THREE.Vector2(6, 4);
  private shake = 0;
  private time = 0;
  private fx: Fx;
  private hTilt: ShaderPass;
  private vTilt: ShaderPass;
  private bloom: UnrealBloomPass;

  private staticMat: THREE.MeshLambertMaterial;
  private flameMat: THREE.MeshBasicMaterial;
  private flameGeo = new THREE.PlaneGeometry(0.42, 0.62);
  private stage: THREE.Mesh[] = [];
  private wallMat: THREE.MeshLambertMaterial;
  private farMat: THREE.MeshLambertMaterial;
  private wallAnims: PixelSprite[] = [];
  private flames: THREE.Mesh[] = [];
  private torches: THREE.Vector3[] = [];
  private torchLights: THREE.PointLight[] = [];
  private hemi: THREE.HemisphereLight;
  private fill: THREE.DirectionalLight;
  private paletteKey = '';
  private motes!: THREE.Points;
  private mapW = 40;
  private mapBuiltAt = -10;

  private hero = new THREE.Group();
  private heroBody = new THREE.Group();
  private heroSprite: PixelSprite;
  private heroAnims: { idle: Rect[]; run: Rect[]; hit: Rect[] } = { idle: [], run: [], hit: [] };
  private heroSpriteName = '';
  private weaponPivot = new THREE.Group();
  private weapon: PixelSprite;
  private heroLight: THREE.PointLight;
  private buffAura: THREE.Mesh;
  private swingT = 1;
  private hurtT = 0;
  private lastHeroX = 0;
  private lastHeroY = 0;

  private enemies = new Map<number, EnemyView>();
  private corpses: Corpse[] = [];
  private punch = 0;
  private flashEl: HTMLElement;
  private dustT = 0;
  private heroSquash = 0;
  private lunge = 0;
  private shots = new Map<number, THREE.Object3D>();
  private orbs = new Map<number, THREE.Mesh>();
  private zones = new Map<number, THREE.Mesh>();
  private orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc070ff).multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  private orbGeo = new THREE.SphereGeometry(0.22, 12, 8);
  private pops: Pop[] = [];
  private coins: Coin[] = [];
  private boltTex: THREE.Texture;

  constructor(container: HTMLElement, overlayLayer: HTMLElement, fadeEl: HTMLElement, atlas: Atlas, icons: Record<string, IconSheet>) {
    this.container = container;
    this.atlas = atlas;
    this.icons = icons;
    this.fadeEl = fadeEl;
    this.flashEl = document.createElement('div');
    this.flashEl.className = 'screen-flash';
    fadeEl.after(this.flashEl);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0a0708);
    this.scene.fog = new THREE.Fog(0x0a0708, 30, 60);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.5, 0.8);
    this.composer.addPass(this.bloom);
    this.hTilt = new ShaderPass(tiltShift());
    this.vTilt = new ShaderPass(tiltShift());
    this.hTilt.uniforms.band.value = this.vTilt.uniforms.band.value = 0.28;
    this.composer.addPass(this.hTilt);
    this.composer.addPass(this.vTilt);
    this.composer.addPass(new ShaderPass(GradeShader));
    this.composer.addPass(new OutputPass());

    this.overlay = new Overlay(overlayLayer, this.camera);
    this.fx = new Fx(this.scene);
    this.staticMat = new THREE.MeshLambertMaterial({ map: atlas.texture, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(1.25, 1.2, 1.15) });
    this.wallMat = new THREE.MeshLambertMaterial({ map: atlas.texture, alphaTest: 0.5, color: new THREE.Color(0.42, 0.4, 0.44) });
    this.farMat = new THREE.MeshLambertMaterial({ map: atlas.texture, alphaTest: 0.5, color: new THREE.Color(0.2, 0.19, 0.22) });
    this.flameMat = new THREE.MeshBasicMaterial({ map: flameTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.boltTex = flameTexture();

    this.hemi = new THREE.HemisphereLight(0x6a5a78, 0x120a0c, 1.25);
    this.fill = new THREE.DirectionalLight(0xffe2c0, 0.8);
    this.scene.add(this.hemi, this.fill, this.fill.target);
    for (let i = 0; i < TORCH_LIGHTS; i++) {
      const l = new THREE.PointLight(0xff9a4a, 0, 8, 1.6);
      this.scene.add(l);
      this.torchLights.push(l);
    }

    this.heroSprite = new PixelSprite(atlas.texture, atlas.size, atlas.anim('knight_m_idle'), { fps: 7 });
    this.weapon = new PixelSprite(atlas.texture, atlas.size, atlas.anim('weapon_rusty_sword'));
    this.weapon.mesh.position.z = 0.02;
    this.weaponPivot.add(this.weapon.mesh);
    this.weaponPivot.position.set(0.26, 0.5, 0.03);
    this.heroBody.add(this.heroSprite.mesh, this.weaponPivot);
    this.heroLight = new THREE.PointLight(0xffc48a, 3.5, 8, 1.5);
    this.heroLight.position.set(0.6, 1.8, 1.4);
    this.buffAura = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 36), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.buffAura.position.y = 0.9;
    this.hero.add(this.heroBody, blobShadow(0.95), this.heroLight, this.buffAura);
    this.scene.add(this.hero);

    this.buildMotes();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  private resize() {
    const w = this.container.clientWidth || innerWidth;
    const h = this.container.clientHeight || innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // ~22 tiles across on wide screens, ~11 on phones, and always ~12 tall.
    const t = Math.tan(THREE.MathUtils.degToRad(16));
    const wantW = this.camera.aspect >= 1 ? 18 : 10;
    this.camDist = Math.max(wantW / (2 * t * this.camera.aspect), 11 / (2 * t));
    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.camDist + 6;
    fog.far = this.camDist + 30;
    this.hTilt.uniforms.step.value.set(1.2 / w, 0);
    this.vTilt.uniforms.step.value.set(0, 1.2 / h);
  }

  // ---------- hero look ----------

  setHero(game: Game) {
    const kit = game.kit;
    if (kit.sprite !== this.heroSpriteName) {
      this.heroSpriteName = kit.sprite;
      this.heroAnims = { idle: this.atlas.anim(`${kit.sprite}_idle`), run: this.atlas.anim(`${kit.sprite}_run`), hit: this.atlas.anim(`${kit.sprite}_hit`) };
      this.heroSprite.play(this.heroAnims.idle, 7);
    }
    this.setGear(game.s.equipped, kit.heldSprite);
  }

  setGear(equipped: Record<Slot, Item>, held?: string) {
    this.weapon.play(this.atlas.anim(held ?? WEAPON_SPRITE[equipped.weapon.kind] ?? 'weapon_rusty_sword'));
  }

  // ---------- events ----------

  handle(ev: GameEvent, game: Game) {
    const h = this.hero.position;
    switch (ev.t) {
      case 'map':
        this.buildStage(game);
        break;
      case 'swing':
        this.swingT = 0;
        this.lunge = 1;
        this.fx.slash(h.clone().add(new THREE.Vector3(game.hero.facing * 0.9, 0.8, 0.3)), 2.2);
        break;
      case 'shot':
        this.swingT = 0.5;
        break;
      case 'hit': {
        const v = this.enemies.get(ev.id);
        if (!v) break;
        v.flash = 1;
        v.squash = 1;
        const p = v.group.position;
        const mode = game.s.settings.numbers ?? 'all';
        if (mode === 'all' || (mode === 'crits' && ev.kind !== 'normal' && ev.kind !== 'reflect')) {
          this.overlay.number(new THREE.Vector3(p.x, p.y + v.height + 0.25, p.z + 0.5), ev.amount, ev.kind, ev.id);
        }
        if (ev.kind === 'mega') {
          this.shake = Math.max(this.shake, 0.3);
          this.stop(0.05);
          this.fx.light(p.clone().setY(p.y + 0.8), 0xff8a3d, 18, 0.25, 6);
        }
        break;
      }
      case 'chain': {
        const a = this.enemies.get(ev.from), b = this.enemies.get(ev.to);
        if (a && b) this.fx.bolt(a.group.position.clone().add(new THREE.Vector3(0, 0.6, 0.4)), b.group.position.clone().add(new THREE.Vector3(0, 0.6, 0.4)));
        break;
      }
      case 'heroHit':
        this.hurtT = 0.15;
        break;
      case 'kill': {
        const v = this.enemies.get(ev.id);
        const at = new THREE.Vector3(ev.x, ev.y + (ev.boss ? 1.4 : 0.5), (v?.group.position.z ?? 0) + 0.2);
        const color = GORE[(v?.group.userData.sprite as string) ?? ''] ?? '#c34043';
        if (v) {
          // Knock the body away from the hero; it tumbles, flashes and then shatters.
          this.enemies.delete(ev.id);
          const away = Math.sign(ev.x - game.hero.x) || 1;
          v.sprite.mesh.material.transparent = true;
          this.corpses.push({ view: v, vx: away * (2.5 + Math.random() * 3), vy: 3 + Math.random() * 3, spin: away * (6 + Math.random() * 8), t: 0, color, big: ev.boss || ev.elite });
          if (v.aura) v.aura.visible = false;
        } else this.fx.burst(at, color, 8, 3.2, 0.09);
        if (ev.boss) {
          this.fx.burst(at, '#ffd23f', 50, 6, 0.08, 6, true);
          this.fx.light(at, 0xffd23f, 40, 0.8, 14);
          this.shake = 0.7;
          this.punch = 1;
          this.stop(0.18);
          this.screenFlash('#fff2c0', 0.35);
        } else if (ev.elite) {
          this.stop(0.07);
          this.punch = Math.max(this.punch, 0.4);
        }
        if (ev.boss || ev.elite) this.spawnCoins(at, ev.boss ? 10 : 3);
        break;
      }
      case 'drop':
        this.popLoot(ev);
        break;
      case 'skill':
        this.skillFx(ev, game);
        break;
      case 'jump':
        this.heroSquash = -1;
        break;
      case 'slam': {
        const at = new THREE.Vector3(ev.x, ev.y, 0);
        this.fx.shockwave(at, 3);
        this.fx.burst(at.clone().setY(ev.y + 0.3), '#8a6a4a', 26, 6, 0.12, 16);
        this.fx.decal(at, '#1a0c0a', 1.8, 1.5);
        this.fx.light(at.clone().setY(ev.y + 1), 0xff5a3a, 30, 0.35, 9);
        this.shake = Math.max(this.shake, ev.hit ? 0.6 : 0.35);
        if (ev.hit) this.screenFlash('#ff3a2a', 0.22);
        break;
      }
      case 'dash':
        this.fx.trail(new THREE.Vector3(ev.from, ev.y + 0.8, 0.3), new THREE.Vector3(ev.to, ev.y + 0.8, 0.3), '#ffe0a0');
        this.hero.position.x = ev.to;
        break;
      case 'boom':
        this.fx.burst(new THREE.Vector3(ev.x, ev.y + 0.6, 0.4), '#ff8a3d', 14, 4, 0.08, 8, true);
        this.fx.shockwave(new THREE.Vector3(ev.x, ev.y, 0.2), ev.radius);
        this.fx.light(new THREE.Vector3(ev.x, ev.y + 0.8, 0.4), 0xff8a3d, 12, 0.18, 5);
        break;
      case 'awaken':
        this.fx.burst(h.clone().setY(h.y + 1), RARITY_COLORS[ev.item.rarity], 50, 4.5, 0.08, 5, true);
        this.fx.pillar(h.clone(), RARITY_COLORS[ev.item.rarity], 7, 1);
        this.fx.light(h.clone().setY(h.y + 1.5), RARITY_COLORS[ev.item.rarity], 30, 0.8, 10);
        break;
      case 'heroLevel':
        this.fx.pillar(h.clone(), '#ffe08a', 8, ev.unlocked.length ? 1.4 : 0.8);
        this.fx.aura(h.clone().setY(h.y + 0.9).setZ(0.6), '#ffe08a', 1.4, 0.8);
        this.fx.burst(h.clone().setY(h.y + 1), '#ffe08a', 36, 4, 0.07, 4, true);
        this.fx.light(h.clone().setY(h.y + 1.5), 0xffe08a, 30, 0.9, 10);
        if (ev.unlocked.length) this.screenFlash('#ffe08a', 0.25);
        break;
      case 'down':
        this.fx.burst(h.clone().setY(h.y + 0.8), '#ff3030', 40, 5, 0.08, 8);
        break;
      case 'challenge':
        if (ev.phase !== 'boss') this.fade(0.25, 0.45);
        break;
      case 'run':
      case 'rebirth':
        this.fade(0.25, 0.45);
        break;
    }
  }

  private skillFx(ev: Extract<GameEvent, { t: 'skill' }>, game: Game) {
    const fxName = ev.skill.fx ?? '';
    const color = SKILL_COLOR[fxName] ?? '#ffffff';
    const at = new THREE.Vector3(ev.x, ev.y, 0.2);
    const up = (d: number) => at.clone().setY(ev.y + d);
    const heroAt = () => this.hero.position.clone().setY(game.hero.y + 0.9).setZ(0.6);
    const big = ev.radius >= 6;
    switch (fxName) {
      case 'shockwave': case 'quake': case 'avalanche': {
        // Ground slam: ring, cracked-earth decal, rock debris, dust and a flash of light.
        this.fx.shockwave(at, ev.radius);
        this.fx.decal(at, '#1a100c', ev.radius * 0.45, 1.6);
        this.fx.burst(up(0.3), '#8a6a4a', 24, 6, 0.12, 16);
        this.fx.burst(up(0.3), color, 20, 5, 0.07, 8, true);
        this.fx.light(up(1), color, big ? 40 : 24, 0.35, ev.radius + 3);
        this.shake = Math.max(this.shake, big ? 0.55 : 0.35);
        this.punch = Math.max(this.punch, big ? 1 : 0.5);
        if (big) this.stop(0.06);
        break;
      }
      case 'frost':
        this.fx.shockwave(at, ev.radius);
        this.fx.decal(at, '#9fd8ff', ev.radius * 0.55, 2.5, true);
        this.fx.burst(up(0.5), '#dff4ff', 36, 6, 0.09, 6, true);
        this.fx.light(up(1), 0x9fd8ff, 26, 0.5, 10);
        this.shake = Math.max(this.shake, 0.2);
        break;
      case 'whirlwind':
        this.fx.arcs(heroAt(), ev.radius * 0.7, color);
        this.fx.burst(heroAt(), '#fff0c0', 6, 4, 0.06, 2, true);
        break;
      case 'meteor':
        if (ev.phase === 'cast') this.fx.fall(up(0.5), color, 1.3, 0.5, undefined, 0.5, true);
        else {
          this.fx.shockwave(at, ev.radius);
          this.fx.decal(at, '#140a06', ev.radius * 0.5, 2.5);
          this.fx.burst(up(0.5), '#ff7a33', 50, 7, 0.1, 10, true);
          this.fx.burst(up(0.3), '#5a3a2a', 18, 5, 0.12, 16);
          this.fx.light(up(1.2), 0xff7a33, 45, 0.6, 12);
          this.shake = Math.max(this.shake, 0.5);
          this.punch = Math.max(this.punch, 0.8);
          this.stop(0.05);
        }
        break;
      case 'rain': case 'barrage':
        if (ev.phase === 'land') {
          const n = fxName === 'rain' ? 6 : 3;
          for (let i = 0; i < n; i++) {
            const spot = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * ev.radius * 2, 0.2, Math.random() - 0.5));
            this.fx.fall(spot, color, 0.1, 0.16, () => this.fx.burst(spot, '#b09070', 3, 1.5, 0.05, 10), 0.25);
          }
        }
        break;
      case 'blizzard':
        if (ev.phase === 'land') {
          for (let i = 0; i < 5; i++) this.fx.fall(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * ev.radius * 2, 0.3, Math.random() - 0.5)), '#dff4ff', 0.22, 0.25, undefined, 0.35);
          this.fx.decal(at, '#9fd8ff', ev.radius * 0.4, 0.6, true);
        }
        break;
      case 'slam':
        if (ev.phase === 'land') {
          this.fx.shockwave(at, ev.radius);
          this.fx.decal(at, '#1a100c', ev.radius * 0.5, 1.6);
          this.fx.burst(up(0.3), '#8a6a4a', 30, 7, 0.13, 16);
          this.fx.light(up(1), 0xd9a060, 30, 0.35, 9);
          this.shake = Math.max(this.shake, 0.45);
          this.punch = Math.max(this.punch, 0.6);
        }
        break;
      case 'warcry': case 'hawkeye': case 'ironskin':
        this.fx.aura(heroAt(), color, 1.6, 0.7);
        this.fx.pillar(this.hero.position.clone(), color, 4, 0.5);
        this.fx.light(heroAt(), color, 22, 0.5, 7);
        break;
      case 'lightning':
        this.fx.burst(up(0.8), color, 16, 4, 0.06, 4, true);
        this.fx.light(up(1), 0x9fe6ff, 20, 0.25, 8);
        break;
      case 'pierce':
        this.fx.aura(heroAt(), color, 0.8, 0.25);
        this.fx.light(heroAt(), color, 16, 0.2, 6);
        break;
    }
  }

  /** Ask for a short hit-stop; small ones are skipped if one is already running. */
  private stop(sec: number) {
    this.hitstop = Math.max(this.hitstop, sec);
  }

  private screenFlash(color: string, alpha: number) {
    const el = this.flashEl;
    el.style.background = color;
    el.style.transition = 'none';
    el.style.opacity = String(alpha);
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.35s ease-out';
      el.style.opacity = '0';
    });
  }

  private fade(outS: number, inS: number) {
    this.fadeEl.style.transition = `opacity ${outS}s ease-in`;
    this.fadeEl.style.opacity = '1';
    setTimeout(() => {
      this.fadeEl.style.transition = `opacity ${inS}s ease-out`;
      this.fadeEl.style.opacity = '0';
    }, outS * 1000 + 60);
  }

  // ---------- stage ----------

  private buildStage(game: Game) {
    for (const m of this.stage) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    for (const f of this.flames) this.scene.remove(f);
    for (const id of [...this.enemies.keys()]) this.removeEnemy(id);
    for (const [, o] of this.shots) this.scene.remove(o);
    this.shots.clear();
    const seed = game.mode === 'hunt' ? game.s.stage : game.mode === 'challenge' ? game.s.stage * 31 + 5 : 9000;
    for (const a of this.wallAnims) {
      this.scene.remove(a.mesh);
      a.dispose();
    }
    const chapter = game.mode === 'hunt' || game.mode === 'challenge' ? chapterOf(game.s.stage) : game.mode === 'worldboss' ? 5 : 1;
    const built = buildStageMesh(this.atlas, game.map, seed, chapter, { wall: this.wallMat, far: this.farMat, floor: this.staticMat });
    this.stage = [built.wall, built.far, built.floor];
    this.scene.add(built.wall, built.far, built.floor);
    this.torches = built.torches;
    const flame = (p: THREE.Vector3, scale = 1) => {
      const f = new THREE.Mesh(this.flameGeo, this.flameMat);
      f.position.copy(p).add(new THREE.Vector3(0, 0.1, 0.05));
      f.scale.setScalar(scale);
      this.scene.add(f);
      return f;
    };
    this.flames = [...this.torches.map((p) => flame(p)), ...built.farFlames.map((p) => flame(p, 0.8))];
    this.wallAnims = built.anims.map((a) => {
      const sp = new PixelSprite(this.atlas.texture, this.atlas.size, a.frames, { fps: 6 });
      sp.mesh.position.set(a.x, a.y, a.z);
      this.scene.add(sp.mesh);
      return sp;
    });
    this.mapW = game.map.w;
    this.mapBuiltAt = this.time;
    for (const c of this.corpses) this.scene.remove(c.view.group);
    this.corpses = [];
    this.hero.position.set(game.hero.x, game.hero.y, HERO_Z);
    this.cam.set(game.hero.x, this.camTargetY(game.hero.y));
    this.paletteKey = '';
  }

  private syncPalette(game: Game) {
    const key = game.mode === 'dungeon' ? `dungeon_${game.run?.dungeon}` : game.mode === 'worldboss' ? 'worldboss' : `${chapterOf(game.s.stage)}${isBossStage(game.s.stage) && game.mode === 'challenge' ? 'b' : ''}`;
    if (key === this.paletteKey) return;
    this.paletteKey = key;
    const pal = PALETTES[(chapterOf(game.s.stage) - 1) % PALETTES.length];
    const torch = MODE_TORCH[key] ?? (key.endsWith('b') ? 0xff3a2a : pal.torch);
    this.wallMat.color.setRGB(...pal.wall);
    this.farMat.color.setRGB(pal.wall[0] * 0.45, pal.wall[1] * 0.45, pal.wall[2] * 0.45);
    (this.scene.background as THREE.Color).setHex(pal.fog);
    (this.scene.fog as THREE.Fog).color.setHex(pal.fog);
    this.hemi.color.setHex(pal.sky);
    for (const l of this.torchLights) l.color.setHex(torch);
    this.flameMat.color.setHex(torch).multiplyScalar(1.4).lerp(new THREE.Color(1.8, 1.8, 1.6), 0.45);
  }

  // ---------- creatures ----------

  private makeEnemy(e: Enemy): EnemyView {
    let anims: ReturnType<Atlas['creature']>;
    try {
      anims = this.atlas.creature(e.kind.sprite);
    } catch {
      anims = this.atlas.creature('goblin'); // never let one bad sprite stop the game
    }
    const sprite = new PixelSprite(this.atlas.texture, this.atlas.size, anims.idle, { flip: true, fps: 7 });
    const group = new THREE.Group();
    const scale = e.giant ? 2.2 : e.boss ? 1.7 : e.elite ? 1.3 : 1;
    const r = anims.idle[0];
    group.add(sprite.mesh, blobShadow(r.w * PX * 0.95));
    group.scale.setScalar(scale);
    group.position.set(e.x, e.y, e.boss || e.giant ? -0.2 : -0.5 + Math.random() * 0.7);
    group.userData.sprite = e.kind.sprite;
    let aura: THREE.Mesh | undefined;
    if (e.elite || e.giant) {
      aura = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: new THREE.Color(e.giant ? 0xff5a3a : 0xffc24a).multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.02;
      group.add(aura);
    }
    this.scene.add(group);
    // Monsters that arrive mid-fight pop in with a puff of smoke.
    if (this.time - this.mapBuiltAt > 0.5) this.fx.burst(new THREE.Vector3(e.x, e.y + 0.4, group.position.z + 0.2), '#8a7f8f', 10, 1.8, 0.1, -1);
    return { group, sprite, anims, lastX: e.x, flash: 0, squash: 0, born: this.time - this.mapBuiltAt > 0.5 ? 0 : 1, scale, height: r.h * PX * scale, aura };
  }

  private removeEnemy(id: number) {
    const v = this.enemies.get(id);
    if (!v) return;
    this.scene.remove(v.group);
    v.sprite.dispose();
    (v.aura?.material as THREE.Material | undefined)?.dispose();
    this.enemies.delete(id);
  }

  private spawnCoins(at: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const s = new PixelSprite(this.atlas.texture, this.atlas.size, this.atlas.anim('coin'), { fps: 12, anchor: 'center' });
      s.mesh.scale.multiplyScalar(1.4);
      s.mesh.position.copy(at);
      this.scene.add(s.mesh);
      this.coins.push({ sprite: s, t: -i * 0.06, from: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, 0)) });
    }
  }

  private popLoot(ev: Extract<GameEvent, { t: 'drop' }>) {
    const base = new THREE.Vector3(ev.x, ev.y, 0.3);
    if (ev.outcome === 'salvaged') {
      this.spawnCoins(base.clone().setY(ev.y + 0.8), 2);
      this.onLootLanded?.(ev, this.overlay.toScreen(base.clone().setY(ev.y + 0.8)));
      return;
    }
    const sheet = this.icons[ev.item.icon.sheet];
    const sprite = new PixelSprite(sheet.texture, sheet.size, [{ x: ev.item.icon.col * 16, y: ev.item.icon.row * 16, w: 16, h: 16 }], { anchor: 'center' });
    sprite.mesh.material.emissiveMap = sheet.texture;
    sprite.mesh.material.emissive.setScalar(0.7);
    sprite.mesh.scale.multiplyScalar(1.15);
    sprite.mesh.position.copy(base).setY(ev.y + 0.8);
    this.scene.add(sprite.mesh);
    // Loot is flung out of the kill, bounces on the floor, then shows its beam.
    this.pops.push({ sprite, t: 0, ev, pos: base.clone().setY(ev.y + 0.8), vx: (Math.random() - 0.5) * 3, vy: 7, floor: ev.y + 0.45, bounces: 0, restT: -1 });
  }

  // ---------- frame ----------

  update(dt: number, game: Game) {
    this.time += dt;
    this.syncPalette(game);
    this.syncEnemies(dt, game);
    this.syncShots(game);
    this.syncThreats(game);
    this.animateHero(dt, game);
    this.animateLoot(dt);
    this.animateCorpses(dt);
    this.fx.update(dt);

    // Follow the hero across the map and up the tiers, without showing past the map edges.
    const halfW = this.camDist * Math.tan(THREE.MathUtils.degToRad(16)) * this.camera.aspect;
    const lo = Math.min(halfW - 1, this.mapW / 2), hi = Math.max(this.mapW - halfW + 1, this.mapW / 2);
    const tx = THREE.MathUtils.clamp(game.hero.x + game.hero.facing * 1.5, lo, hi);
    const ty = this.camTargetY(game.hero.y);
    // Glide normally; snap after a long gap (e.g. returning to a background tab).
    if (Math.abs(tx - this.cam.x) > 10 || Math.abs(ty - this.cam.y) > 6) this.cam.set(tx, ty);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 3.5);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 2.5);
    const s = game.s.settings.shake === false ? 0 : this.shake;
    this.punch = Math.max(0, this.punch - dt * 3);
    const dist = this.camDist * (1 - this.punch * 0.05);
    this.camera.position.set(this.cam.x + (Math.random() - 0.5) * s, this.cam.y + 5 + (Math.random() - 0.5) * s * 0.5, dist);
    this.camera.lookAt(this.cam.x, this.cam.y, -0.5);
    this.shake = Math.max(0, s - dt * 2.2);
    this.fill.position.set(this.cam.x, this.cam.y + 4, 12);
    this.fill.target.position.set(this.cam.x, this.cam.y, 0);

    this.updateTorches();
    this.updateMotes(dt);
    this.composer.render(dt);

    const bars = [];
    for (const e of game.enemies) {
      const v = this.enemies.get(e.id);
      if (!v || !(e.boss || e.elite || e.giant)) continue;
      bars.push({
        id: e.id,
        pos: new THREE.Vector3(v.group.position.x, e.y + v.height + 0.2, v.group.position.z),
        ratio: e.hp / e.maxHp,
        label: e.boss ? e.kind.name : e.giant ? `Giant ${e.kind.name}` : `Elite ${e.kind.name}`,
        tone: (e.boss || e.giant ? 'boss' : 'elite') as 'boss' | 'elite',
      });
    }
    this.overlay.syncBars(bars, dt);
  }

  /** Frame the hero slightly below center so the ground clears the hotbar. */
  private camTargetY(heroY: number) {
    return THREE.MathUtils.clamp(heroY + 1.8, 1.8, 11.5);
  }

  private updateTorches() {
    for (const a of this.wallAnims) a.update(1 / 60);
    const near = [...this.torches].sort((a, b) => Math.hypot(a.x - this.cam.x, a.y - this.cam.y) - Math.hypot(b.x - this.cam.x, b.y - this.cam.y));
    this.torchLights.forEach((l, i) => {
      const p = near[i];
      if (!p) return void (l.intensity = 0);
      l.position.set(p.x, p.y + 0.2, p.z + 1);
      l.intensity = 9 * (0.85 + Math.sin(this.time * 11 + p.x * 3 + p.y) * 0.06 + Math.sin(this.time * 23 + p.x) * 0.05);
    });
    for (const f of this.flames) {
      const k = 1 + Math.sin(this.time * 14 + f.position.x * 5 + f.position.y) * 0.08;
      f.scale.set(k, 1 / k + Math.sin(this.time * 9 + f.position.x) * 0.06, 1);
    }
  }

  private syncEnemies(dt: number, game: Game) {
    for (const e of game.enemies) {
      let v = this.enemies.get(e.id);
      if (!v) {
        v = this.makeEnemy(e);
        this.enemies.set(e.id, v);
      }
      const dir = e.x - v.lastX;
      const moving = Math.abs(dir) > 0.002;
      v.lastX = e.x;
      v.sprite.play(moving ? v.anims.run : v.anims.idle, moving ? 12 : 6);
      // Face the direction of travel (sprites face right by default).
      if (moving) v.sprite.flip = dir < 0;
      v.sprite.update(dt);
      const g = v.group.position;
      g.x = Math.abs(e.x - g.x) > 3 ? e.x : g.x + (e.x - g.x) * Math.min(1, dt * 16);
      g.y = e.y;
      v.flash = Math.max(0, v.flash - dt * 7);
      v.sprite.flash = v.flash;
      v.born = Math.min(1, v.born + dt * 4);
      v.squash = Math.max(0, v.squash - dt * 8);
      const pop = v.born < 1 ? 0.3 + 0.7 * v.born + Math.sin(v.born * Math.PI) * 0.25 : 1;
      v.group.scale.set(v.scale * pop * (1 + v.squash * 0.18), v.scale * pop * (1 - v.squash * 0.15), v.scale);
      v.sprite.mesh.material.color.setRGB(e.slowT > 0 ? 0.6 : 1, e.slowT > 0 ? 0.85 : 1, 1);
      if (v.aura) {
        const k = 0.5 + Math.sin(this.time * 5) * 0.5;
        (v.aura.material as THREE.MeshBasicMaterial).opacity = 0.35 + k * 0.4;
        v.aura.scale.setScalar(0.9 + k * 0.15);
      }
    }
  }

  private syncShots(game: Game) {
    const live = new Set<number>();
    for (const p of game.projectiles) {
      live.add(p.id);
      let o = this.shots.get(p.id);
      if (!o) {
        o = this.makeShot(p);
        this.shots.set(p.id, o);
        this.scene.add(o);
      }
      o.position.set(p.x, p.y, 0.4);
      o.rotation.z = Math.atan2(p.vy, p.vx) - (p.kind === 'bolt' ? 0 : Math.PI / 2);
    }
    for (const [id, o] of this.shots) {
      if (live.has(id)) continue;
      this.scene.remove(o);
      this.shots.delete(id);
    }
  }

  /** Enemy orbs and slam warning zones, mirrored from the sim each frame. */
  private syncThreats(game: Game) {
    const live = new Set<number>();
    for (const s of game.enemyShots) {
      live.add(s.id);
      let m = this.orbs.get(s.id);
      if (!m) {
        m = new THREE.Mesh(this.orbGeo, this.orbMat);
        this.orbs.set(s.id, m);
        this.scene.add(m);
      }
      m.position.set(s.x, s.y, 0.5);
      m.scale.setScalar(1 + Math.sin(this.time * 18 + s.id) * 0.15);
    }
    for (const [id, m] of this.orbs) if (!live.has(id)) {
      this.scene.remove(m);
      this.orbs.delete(id);
    }
    const zones = new Set<number>();
    for (const w of game.warnings) {
      zones.add(w.id);
      let z = this.zones.get(w.id);
      if (!z) {
        z = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        z.rotation.x = -Math.PI / 2;
        this.zones.set(w.id, z);
        this.scene.add(z);
      }
      const k = 1 - w.t / w.dur; // 0 → 1 as the slam approaches
      z.scale.set(w.x1 - w.x0, 2.6, 1);
      z.position.set((w.x0 + w.x1) / 2, w.y + 0.03, -0.6);
      (z.material as THREE.MeshBasicMaterial).opacity = 0.15 + k * 0.45 + Math.sin(this.time * (10 + k * 30)) * 0.12;
    }
    for (const [id, z] of this.zones) if (!zones.has(id)) {
      this.scene.remove(z);
      z.geometry.dispose();
      (z.material as THREE.Material).dispose();
      this.zones.delete(id);
    }
  }

  private makeShot(p: Projectile): THREE.Object3D {
    if (p.kind === 'bolt') {
      return new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshBasicMaterial({ map: this.boltTex, color: new THREE.Color(2.2, 1.4, 0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    }
    const s = new PixelSprite(this.atlas.texture, this.atlas.size, this.atlas.anim('weapon_arrow'), { anchor: 'center' });
    if (p.kind === 'pierce') {
      s.mesh.scale.multiplyScalar(1.8);
      s.mesh.material.emissive.setRGB(1, 0.9, 0.5);
    }
    return s.mesh;
  }

  private animateHero(dt: number, game: Game) {
    const h = this.hero;
    const gh = game.hero;
    h.position.x = Math.abs(gh.x - h.position.x) > 4 ? gh.x : h.position.x + (gh.x - h.position.x) * Math.min(1, dt * 20);
    h.position.y = gh.y;
    h.position.z = HERO_Z;
    const moving = Math.abs(gh.x - this.lastHeroX) > 0.001 || gh.plat < 0;
    this.lastHeroX = gh.x;
    // Squash & stretch: stretched while jumping up, squashed on landing, springing back to 1.
    this.heroSquash += (0 - this.heroSquash) * Math.min(1, dt * 9);
    this.lunge = Math.max(0, this.lunge - dt * 7);
    const sq = this.heroSquash;
    this.heroBody.scale.set(gh.facing * (1 + sq * 0.12), 1 - sq * 0.14, 1);
    this.heroSprite.mesh.position.x = this.lunge * 0.12;
    this.hurtT = Math.max(0, this.hurtT - dt);
    const down = game.down > 0;
    if (down || this.hurtT > 0) this.heroSprite.play(this.heroAnims.hit, 1);
    else this.heroSprite.play(moving ? this.heroAnims.run : this.heroAnims.idle, moving ? 14 : 6);
    this.heroSprite.update(dt);
    this.heroSprite.flash = this.hurtT > 0 ? 0.5 : 0;
    this.heroBody.rotation.z += ((down ? Math.PI / 2 : 0) - this.heroBody.rotation.z) * Math.min(1, dt * 10);
    // Dust puff on landing from a big drop.
    if (gh.plat >= 0 && this.lastHeroY - gh.y > 0.8) {
      this.fx.burst(h.position.clone().setY(gh.y + 0.1), '#9a8a7a', 10, 2.2, 0.07, 10);
      this.heroSquash = 1;
    }
    // Little puffs of dust while running.
    this.dustT -= dt;
    if (moving && gh.plat >= 0 && this.dustT <= 0) {
      this.dustT = 0.18;
      this.fx.burst(h.position.clone().add(new THREE.Vector3(-gh.facing * 0.3, 0.08, 0.1)), '#6f6259', 3, 0.8, 0.06, 3);
    }
    this.lastHeroY = gh.plat >= 0 ? gh.y : Math.max(this.lastHeroY, gh.y);

    this.swingT = Math.min(1, this.swingT + dt * Math.max(4.2, game.stats().aps * 3.2));
    const t = this.swingT;
    const angle = t < 0.25 ? -0.35 + (t / 0.25) * 1.5 : t < 0.5 ? 1.15 - ((t - 0.25) / 0.25) * 3.1 : -1.95 + ((t - 0.5) / 0.5) * 1.6;
    const ranged = game.kit.attack !== 'sweep';
    this.weaponPivot.rotation.z = ranged ? -0.2 + Math.max(0, 0.5 - t) * 0.4 : moving && t >= 1 ? -0.5 + Math.sin(this.time * 14) * 0.08 : angle;

    // Glow ring while a buff is active.
    const buff = game.buffs[0];
    const mat = this.buffAura.material as THREE.MeshBasicMaterial;
    mat.opacity += ((buff ? 0.6 : 0) - mat.opacity) * Math.min(1, dt * 6);
    if (buff) {
      const sk = game.kit.skills.find((k) => k.id === buff.id);
      mat.color.set(SKILL_COLOR[sk?.fx ?? ''] ?? '#ffffff').multiplyScalar(1.6);
      this.buffAura.rotation.z += dt * 2;
      this.buffAura.scale.setScalar(1 + Math.sin(this.time * 6) * 0.05);
    }
  }

  private animateCorpses(dt: number) {
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.t += dt;
      const g = c.view.group;
      c.vy -= 22 * dt;
      g.position.x += c.vx * dt;
      g.position.y += c.vy * dt;
      g.rotation.z += c.spin * dt;
      c.view.sprite.flash = Math.min(1, c.t * 5);
      const life = c.big ? 0.45 : 0.3;
      (c.view.sprite.mesh.material as THREE.MeshLambertMaterial).opacity = Math.max(0, 1 - c.t / life);
      if (c.t >= life) {
        const at = g.position.clone().setY(g.position.y + 0.3);
        this.fx.burst(at, c.color, c.big ? 26 : 10, c.big ? 4.5 : 3, c.big ? 0.11 : 0.085);
        this.scene.remove(g);
        c.view.sprite.dispose();
        (c.view.aura?.material as THREE.Material | undefined)?.dispose();
        this.corpses.splice(i, 1);
      }
    }
  }

  private animateLoot(dt: number) {
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t += dt;
      const m = p.sprite.mesh;
      if (p.restT < 0) {
        p.vy -= 26 * dt;
        p.pos.x += p.vx * dt;
        p.pos.y += p.vy * dt;
        m.rotation.z += p.vx * dt * 2;
        if (p.pos.y <= p.floor) {
          p.pos.y = p.floor;
          if (++p.bounces >= 3 || Math.abs(p.vy) < 2) {
            p.restT = 0;
            m.rotation.z = 0;
            this.fx.beam(p.pos.x, 0.3, RARITY_COLORS[p.ev.item.rarity], p.ev.item.rarity, p.floor - 0.45);
            this.fx.light(p.pos.clone().setY(p.floor + 0.5), RARITY_COLORS[p.ev.item.rarity], 6 + p.ev.item.rarity * 6, 1.2, 5);
          } else {
            p.vy = -p.vy * 0.45;
            p.vx *= 0.6;
          }
        }
        m.position.copy(p.pos);
      } else {
        p.restT += dt;
        m.position.set(p.pos.x, p.floor + 0.1 + Math.sin(p.restT * 5) * 0.08, p.pos.z);
        if (p.restT > 0.9) {
          this.onLootLanded?.(p.ev, this.overlay.toScreen(m.position));
          this.scene.remove(m);
          p.sprite.dispose();
          this.pops.splice(i, 1);
        }
      }
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.t += dt;
      c.sprite.update(dt);
      if (c.t < 0) continue;
      const k = Math.min(1, c.t / 0.7);
      const to = this.hero.position.clone().add(new THREE.Vector3(0, 1, 0));
      const pos = c.from.clone().lerp(to, k * k);
      pos.y += Math.sin(k * Math.PI) * 1.2;
      c.sprite.mesh.position.copy(pos);
      if (k >= 1) {
        this.scene.remove(c.sprite.mesh);
        c.sprite.dispose();
        this.coins.splice(i, 1);
      }
    }
  }

  private buildMotes() {
    const n = 220;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([Math.random() * 50 - 25, Math.random() * 16, -2.5 + Math.random() * 4], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.04, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(this.motes);
  }

  private updateMotes(dt: number) {
    const a = (this.motes.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < a.length; i += 3) {
      a[i] += Math.sin(this.time * 0.5 + i) * dt * 0.15;
      a[i + 1] += dt * 0.15;
      if (a[i + 1] > 16) a[i + 1] = 0;
      if (a[i] < this.cam.x - 25) a[i] += 50;
      if (a[i] > this.cam.x + 25) a[i] -= 50;
    }
    this.motes.geometry.attributes.position.needsUpdate = true;
  }
}
