import * as THREE from 'three';
import type { Rect } from './atlas.ts';

/** World units per source pixel: a 16px tile is one unit. */
export const PX = 1 / 16;

/**
 * A lit, pixel-perfect billboard standing on the ground (origin at bottom-center),
 * animated by swapping UVs on a shared texture. Faces the camera along +z.
 */
export class PixelSprite {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  private frames: Rect[];
  private fps: number;
  private t = 0;
  private frame = -1;
  private sheet: { w: number; h: number };
  flip: boolean;
  loop = true;

  constructor(texture: THREE.Texture, sheet: { w: number; h: number }, frames: Rect[], opts: { flip?: boolean; fps?: number; anchor?: 'bottom' | 'center' } = {}) {
    const geo = new THREE.PlaneGeometry(1, 1);
    if ((opts.anchor ?? 'bottom') === 'bottom') geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat);
    this.sheet = sheet;
    this.frames = frames;
    this.fps = opts.fps ?? 8;
    this.flip = opts.flip ?? false;
    this.show(0);
  }

  play(frames: Rect[], fps = this.fps, loop = true) {
    if (frames === this.frames && this.loop === loop) return;
    this.frames = frames;
    this.fps = fps;
    this.loop = loop;
    this.t = 0;
    this.frame = -1;
    this.show(0);
  }

  update(dt: number) {
    this.t += dt;
    const n = this.frames.length;
    const f = Math.floor(this.t * this.fps);
    this.show(this.loop ? ((f % n) + n) % n : Math.max(0, Math.min(f, n - 1)));
  }

  /** The frame on screen right now (for effects that copy the sprite's pixels). */
  get rect(): Rect {
    return this.frames[Math.max(0, this.frame)];
  }

  get done() {
    return !this.loop && Math.floor(this.t * this.fps) >= this.frames.length - 1;
  }

  /** Cast it in gold, for champions: each pixel's brightness read off a gold ramp, lit a little from within so it
   *  reads in the dark rooms. (Values are linear: the shader works after the texture's sRGB decode.) */
  gild() {
    const mat = this.mesh.material;
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          vec3 gold = mix(vec3(0.12, 0.035, 0.0), vec3(0.8, 0.42, 0.03), smoothstep(0.0, 0.3, lum));
          diffuseColor.rgb = mix(gold, vec3(1.0, 0.72, 0.18), smoothstep(0.3, 0.8, lum));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += diffuseColor.rgb * 0.15;`);
    };
    mat.customProgramCacheKey = () => 'gilded';
    mat.needsUpdate = true;
    this.gilded = true;
  }
  private gilded = false;

  /** Ready for a Rampage: pixels marked in `eyes` (a sheet-sized mask) can burn red, and the empty pixels bordering
   *  the sprite can light up as a one-pixel red rim. Both start off; set them with `rage`. */
  enrage(eyes: THREE.Texture) {
    const mat = this.mesh.material;
    const u = {
      rageEyes: { value: 0 }, rageRim: { value: 0 }, rageMask: { value: eyes },
      rageTexel: { value: new THREE.Vector2(1 / this.sheet.w, 1 / this.sheet.h) }, rageFrame: { value: new THREE.Vector4() },
    };
    this.rageUniforms = u;
    this.frame = -1;
    this.show(Math.max(0, Math.floor(this.t * this.fps)) % this.frames.length);
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `uniform float rageEyes, rageRim;
          uniform sampler2D rageMask;
          uniform vec2 rageTexel;
          uniform vec4 rageFrame;
          float rageAlpha(vec2 q) {
            // (Off the frame is empty: past its edge lie the neighbors on the sheet.)
            vec2 lo = min(rageFrame.xy, rageFrame.zw), hi = max(rageFrame.xy, rageFrame.zw);
            return all(greaterThanEqual(q, lo)) && all(lessThanEqual(q, hi)) ? texture2D(map, q).a : 0.0;
          }
          void main() {`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          float eyeGlow = texture2D(rageMask, vMapUv).r * rageEyes;
          float rim = 0.0;
          if (rageRim > 0.0 && diffuseColor.a < 0.5) {
            float near = max(max(rageAlpha(vMapUv + vec2(rageTexel.x, 0.0)), rageAlpha(vMapUv - vec2(rageTexel.x, 0.0))),
              max(rageAlpha(vMapUv + vec2(0.0, rageTexel.y)), rageAlpha(vMapUv - vec2(0.0, rageTexel.y))));
            if (near >= 0.5) { rim = rageRim; diffuseColor = vec4(0.0, 0.0, 0.0, 1.0); }
          }
          // (Lit only from within: the room's warm light on top washes the red out to pink.)
          diffuseColor.rgb *= 1.0 - min(1.0, eyeGlow);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1.1, 0.0, 0.02) * eyeGlow + vec3(0.85, 0.0, 0.03) * rim;`);
    };
    mat.customProgramCacheKey = () => 'enraged';
    mat.needsUpdate = true;
  }
  private rageUniforms: { rageEyes: { value: number }; rageRim: { value: number }; rageFrame: { value: THREE.Vector4 } } | null = null;

  /** How hot the eyes burn (past 1 for a flare) and how bright the rim is: 0 is off. */
  rage(eyes: number, rim: number) {
    if (!this.rageUniforms) return;
    this.rageUniforms.rageEyes.value = eyes;
    this.rageUniforms.rageRim.value = rim;
  }

  /** Silhouette flash (0..1) for hits: white, or a warm glint on gold so a champion under fire stays gold. */
  set flash(v: number) {
    if (this.gilded) this.mesh.material.emissive.setRGB(v * 0.5, v * 0.32, v * 0.05);
    else this.mesh.material.emissive.setScalar(v);
  }

  private show(i: number) {
    if (i === this.frame) return;
    this.frame = i;
    const r = this.frames[i];
    const { w, h } = this.sheet;
    let u0 = r.x / w, u1 = (r.x + r.w) / w;
    const v0 = 1 - (r.y + r.h) / h, v1 = 1 - r.y / h;
    if (this.flip) [u0, u1] = [u1, u0];
    const uv = this.mesh.geometry.attributes.uv as THREE.BufferAttribute;
    uv.setXY(0, u0, v1);
    uv.setXY(1, u1, v1);
    uv.setXY(2, u0, v0);
    uv.setXY(3, u1, v0);
    uv.needsUpdate = true;
    this.rageUniforms?.rageFrame.value.set(u0, v0, u1, v1);
    this.mesh.scale.set(r.w * PX, r.h * PX, 1);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

/** Soft oval contact shadow; grounds sprites without shadow maps. */
export function blobShadow(width: number): THREE.Mesh {
  const m = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(width, width * 0.38, 1);
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}

const SHADOW_GEO = new THREE.CircleGeometry(0.5, 20);
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false });
