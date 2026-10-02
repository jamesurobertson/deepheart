import * as THREE from 'three';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The 0x72 dungeon sheet plus its tile list (`name x y w h` per line).
 * Animations are `${base}_anim_f0..fN`; single frames are just `name`.
 */
export class Atlas {
  readonly texture: THREE.Texture;
  readonly size: { w: number; h: number };
  private rects: Map<string, Rect>;
  readonly url: string;

  private constructor(texture: THREE.Texture, rects: Map<string, Rect>, url: string) {
    this.texture = texture;
    this.rects = rects;
    this.url = url;
    const img = texture.image as HTMLImageElement;
    this.size = { w: img.width, h: img.height };
  }

  static async load(pngUrl: string, listUrl: string): Promise<Atlas> {
    const [texture, list] = await Promise.all([
      new THREE.TextureLoader().loadAsync(pngUrl),
      fetch(listUrl).then((r) => r.text()),
    ]);
    pixelate(texture);
    const rects = new Map<string, Rect>();
    for (const line of list.split('\n')) {
      const [name, x, y, w, h] = line.trim().split(/\s+/);
      if (name && h) rects.set(name, { x: +x, y: +y, w: +w, h: +h });
    }
    return new Atlas(texture, rects, pngUrl);
  }

  rect(name: string): Rect {
    const r = this.rects.get(name);
    if (!r) throw new Error(`atlas: no sprite "${name}"`);
    return r;
  }

  has(name: string): boolean {
    if (this.rects.has(name)) return true;
    const prefix = `${name}_anim_f`;
    for (const k of this.rects.keys()) if (k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length))) return true;
    return false;
  }

  /**
   * Frames for an animation base name, or the single frame if not animated.
   * Frames are gathered by number rather than counted from 0, because the pack's
   * list has quirks (e.g. the zombie's first frame is named `zombie_anim_f10`).
   */
  anim(base: string): Rect[] {
    const prefix = `${base}_anim_f`;
    const frames = [...this.rects.entries()]
      .filter(([k]) => k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length)))
      .map(([k, r]) => [Number(k.slice(prefix.length)) % 10, r] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, r]) => r);
    if (frames.length) return frames;
    if (this.rects.has(base)) return [this.rects.get(base)!];
    throw new Error(`atlas: no animation "${base}"`);
  }

  /** Monster idle/run frames; some monsters only have a single `_anim`. */
  creature(sprite: string): { idle: Rect[]; run: Rect[]; hit?: Rect[] } {
    const idle = this.has(`${sprite}_idle`) ? this.anim(`${sprite}_idle`) : this.anim(sprite);
    const run = this.has(`${sprite}_run`) ? this.anim(`${sprite}_run`) : idle;
    const hit = this.has(`${sprite}_hit`) ? this.anim(`${sprite}_hit`) : undefined;
    return { idle, run, hit };
  }

  private data: ImageData | null = null;
  private pixelCache = new Map<Rect, { x: number; y: number; color: number }[]>();
  private trimCache = new Map<Rect, Rect>();

  private image(): ImageData {
    if (!this.data) {
      const img = this.texture.image as HTMLImageElement;
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      this.data = g.getImageData(0, 0, c.width, c.height);
    }
    return this.data;
  }

  /** A frame shrunk to its visible pixels (0x72's characters sit in tall frames with empty space above). */
  trimmed(r: Rect): Rect {
    const hit = this.trimCache.get(r);
    if (hit) return hit;
    const data = this.image();
    let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      if (data.data[((r.y + y) * data.width + r.x + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const out = x1 < 0 ? r : { x: r.x + x0, y: r.y + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    this.trimCache.set(r, out);
    return out;
  }

  /** Opaque pixels of a frame (every `step`-th), for shatter effects. Cached per frame. */
  pixels(r: Rect, step = 2): { x: number; y: number; color: number }[] {
    const hit = this.pixelCache.get(r);
    if (hit) return hit;
    this.data = this.image();
    const out: { x: number; y: number; color: number }[] = [];
    const d = this.data.data;
    for (let y = 0; y < r.h; y += step) {
      for (let x = 0; x < r.w; x += step) {
        const i = ((r.y + y) * this.data.width + r.x + x) * 4;
        if (d[i + 3] < 128) continue;
        out.push({ x, y, color: (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] });
      }
    }
    this.pixelCache.set(r, out);
    return out;
  }

  /** UVs for a rect, optionally mirrored horizontally. */
  uv(r: Rect, flip = false): [number, number, number, number] {
    const u0 = r.x / this.size.w, u1 = (r.x + r.w) / this.size.w;
    const v0 = 1 - (r.y + r.h) / this.size.h, v1 = 1 - r.y / this.size.h;
    return flip ? [u1, v0, u0, v1] : [u0, v0, u1, v1];
  }
}

export function pixelate(t: THREE.Texture) {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
}
