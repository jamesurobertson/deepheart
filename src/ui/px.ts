import type { Atlas, Rect } from '../render/atlas.ts';
import { portrait, portraitUrl } from '../render/cards.ts';
import type { CardDef } from '../game/data.ts';

let atlas: Atlas | null = null;
export function setAtlas(a: Atlas) {
  atlas = a;
}
export const uiAtlas = () => atlas;

function rectFor(name: string): Rect | null {
  if (!atlas) return null;
  for (const n of [name, `${name}_idle`]) {
    if (atlas.has(n)) return atlas.anim(n)[0];
  }
  return null;
}

/** A card's monster as a canvas (trimmed, tinted for its lap), for drawing bigger art. */
export function cardCanvas(card: CardDef, lap = 0): HTMLCanvasElement | null {
  return atlas ? portrait(atlas, card, lap) : null;
}

/** Characters made by recoloring another sprite: Victor is Dan's sprite with brown hair and a blue shirt. */
const VARIANTS: Record<string, { base: string; swap: Record<string, string> }> = {
  victor: { base: 'ef_elf_m', swap: { '#facb3e': '#9a6a3a', '#ee8e2e': '#6a4024', '#c56025': '#3f6aa8', '#62232f': '#263a66' } },
};
const variants = new Map<string, { img: HTMLCanvasElement; frames: Rect[] }>();

/** A variant's frames (`victor`, or `victor_run` for walking), recolored onto their own little sheet. */
function variantFrames(name: string) {
  const run = name.endsWith('_run');
  const v = VARIANTS[run ? name.slice(0, -4) : name];
  if (!v || !atlas) return null;
  const hit = variants.get(name);
  if (hit) return hit;
  const src = spriteFrames(run ? `${v.base}_run` : v.base);
  if (!src) return null;
  const img = document.createElement('canvas');
  img.width = src.frames.reduce((w, f) => w + f.w, 0);
  img.height = Math.max(...src.frames.map((f) => f.h));
  const g = img.getContext('2d')!;
  let x = 0;
  const frames = src.frames.map((f) => {
    g.drawImage(src.img, f.x, f.y, f.w, f.h, x, 0, f.w, f.h);
    const r = { x, y: 0, w: f.w, h: f.h };
    x += f.w;
    return r;
  });
  const swap = new Map(Object.entries(v.swap).map(([from, to]) => [parseInt(from.slice(1), 16), parseInt(to.slice(1), 16)]));
  const data = g.getImageData(0, 0, img.width, img.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const to = swap.get((data.data[i] << 16) | (data.data[i + 1] << 8) | data.data[i + 2]);
    if (to === undefined) continue;
    data.data[i] = to >> 16;
    data.data[i + 1] = (to >> 8) & 255;
    data.data[i + 2] = to & 255;
  }
  g.putImageData(data, 0, 0);
  const out = { img, frames };
  variants.set(name, out);
  return out;
}

/** A sprite's animation frames and the sprite sheet they're cut from, for drawing onto a canvas. */
export function spriteFrames(name: string): { img: CanvasImageSource; frames: Rect[] } | null {
  if (!atlas) return null;
  if (VARIANTS[name.replace(/_run$/, '')]) return variantFrames(name);
  for (const n of [`${name}_idle`, name]) {
    if (atlas.has(n)) return { img: atlas.texture.image as CanvasImageSource, frames: atlas.anim(n) };
  }
  return null;
}

function cell(r: Rect, scale: number, cls = '', style = '') {
  const a = atlas!;
  return `<i class="px ${cls}" style="width:${r.w * scale}px;height:${r.h * scale}px;background:url(${a.url}) -${r.x * scale}px -${r.y * scale}px/${a.size.w * scale}px ${a.size.h * scale}px no-repeat;${style}"></i>`;
}

/** Icons drawn here rather than taken from the sheet (where nothing reads well that small), as rows of palette keys. */
const DRAWN: Record<string, { rows: string[]; palette: Record<string, string> }> = {
  // A flight of stairs going down, for the floor trophies (the sheet's floor_stairs tile is a muddy blur at icon size).
  stairs: {
    rows: [
      '.ooo..........',
      'oTtto.........',
      'o111o.........',
      'o111ooo.......',
      'o222Ttto......',
      'o222r22o......',
      'o222r22ooo....',
      'o333333Ttto...',
      'o333333r33o...',
      'o333333r33ooo.',
      'o444444444Ttto',
      'o444444444r44o',
      'o444444444r44o',
      '.oooooooooooo.',
    ],
    palette: { o: '#140a12', T: '#fff0d4', t: '#e6cda4', r: '#b0907a', 1: '#9a7e6c', 2: '#806758', 3: '#675146', 4: '#4f3d36' },
  },
};

function drawn(icon: (typeof DRAWN)[string], scale: number, cls: string) {
  const rects = icon.rows.flatMap((row, y) => [...row].map((key, x) => (icon.palette[key] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${icon.palette[key]}"/>` : '')));
  const w = icon.rows[0].length;
  const h = icon.rows.length;
  return `<svg class="px ${cls}" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
}

/** Any sprite from the dungeon sheet (first frame for animations) at an integer scale. */
export function sprite(name: string, scale = 2, cls = ''): string {
  const r = rectFor(name);
  return r ? cell(r, scale, cls) : '';
}

/** A sprite's visible pixels at the largest integer scale that fits a `box`-pixel square, so every icon fills its box alike. */
export function spriteFit(name: string, box: number, cls = ''): string {
  const own = DRAWN[name];
  if (own) return drawn(own, Math.max(1, Math.floor(box / Math.max(own.rows.length, own.rows[0].length))), cls);
  const full = rectFor(name);
  if (!full) return '';
  const r = atlas!.trimmed(full);
  return cell(r, Math.max(1, Math.floor(box / Math.max(r.w, r.h))), cls);
}

/** A character as a flat silhouette in `color`, at a fixed on-screen height. Cut on each pixel's opacity, so a sprite's
 *  faint glow doesn't turn into a dark box (as a CSS brightness(0) filter would make it). */
export function silhouette(name: string, height: number, color: string): string {
  const key = `${name}|${height}|${color}`;
  return silhouettes.get(key) ?? silhouettes.set(key, cutSilhouette(name, height, color)).get(key)!;
}
// Open panels rebuild their HTML every tick; the cut (a canvas and a data URL) is too slow to redo each time.
const silhouettes = new Map<string, string>();

function cutSilhouette(name: string, height: number, color: string): string {
  const src = spriteFrames(name);
  const f = src && atlas!.trimmed(src.frames[0]);
  if (!src || !f) return '';
  const c = document.createElement('canvas');
  c.width = f.w;
  c.height = f.h;
  const g = c.getContext('2d')!;
  g.drawImage(src.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  const data = g.getImageData(0, 0, f.w, f.h);
  for (let i = 3; i < data.data.length; i += 4) data.data[i] = data.data[i] >= 128 ? 255 : 0;
  g.putImageData(data, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, f.w, f.h);
  const k = height / f.h;
  return `<img class="px" src="${c.toDataURL()}" width="${Math.round(f.w * k)}" height="${Math.round(f.h * k)}" alt="">`;
}

/** A character at a fixed on-screen height (fractional scale), so a roster of differently sized sprites lines up. */
export function charFit(name: string, height: number, maxW = height * 1.2, cls = ''): string {
  const v = VARIANTS[name] && variantFrames(name);
  if (v) {
    // A recolored character lives on its own canvas: show its first frame as an image.
    const f = v.frames[0];
    const one = document.createElement('canvas');
    one.width = f.w;
    one.height = f.h;
    one.getContext('2d')!.drawImage(v.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    const k = Math.min(height / f.h, maxW / f.w);
    return `<img class="px ${cls}" src="${one.toDataURL()}" width="${Math.round(f.w * k)}" height="${Math.round(f.h * k)}" alt="">`;
  }
  const full = rectFor(name);
  if (!full) return '';
  const r = atlas!.trimmed(full);
  return cell(r, Math.min(height / r.h, maxW / r.w), cls);
}

/** A card's monster, tinted as it looks in the dungeon (on that lap), at the largest integer scale that fits `box` (never below 1). */
export function cardArt(card: CardDef, box: number, cls = '', lap = 0): string {
  if (!atlas) return '';
  const p = portrait(atlas, card, lap);
  const k = Math.max(1, Math.floor(box / Math.max(p.width, p.height)));
  return `<img class="px ${cls}" src="${portraitUrl(atlas, card, lap)}" width="${p.width * k}" height="${p.height * k}" alt="">`;
}

/** Small hand-made pixel glyphs (drawn as SVG rects so they stay crisp). */
const glyph = (w: number, h: number, rects: string, cls = '', scale = 2) =>
  `<svg class="glyph ${cls}" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects}</svg>`;

const r = (x: number, y: number, w = 1, h = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;

export const G = {
  close: () => glyph(7, 7, r(0, 0) + r(6, 0) + r(1, 1) + r(5, 1) + r(2, 2) + r(4, 2) + r(3, 3) + r(2, 4) + r(4, 4) + r(1, 5) + r(5, 5) + r(0, 6) + r(6, 6)),
  menu: (scale = 2) => glyph(7, 7, r(0, 1, 7) + r(0, 3, 7) + r(0, 5, 7), '', scale),
  sound: () => glyph(9, 7, r(0, 2, 2, 3) + r(2, 1, 1, 5) + r(3, 0, 1, 7) + r(5, 2, 1, 3) + r(7, 1, 1, 5)),
  mute: () => glyph(9, 7, r(0, 2, 2, 3) + r(2, 1, 1, 5) + r(3, 0, 1, 7) + r(5, 1) + r(8, 1) + r(6, 2) + r(7, 2) + r(6, 4) + r(7, 4) + r(5, 5) + r(8, 5) + r(6, 3, 2)),
  lock: () => glyph(7, 7, r(2, 0, 3) + r(1, 1) + r(5, 1) + r(1, 2) + r(5, 2) + r(0, 3, 7, 4)),
  check: () => glyph(7, 7, r(6, 1) + r(5, 2) + r(4, 3) + r(0, 3) + r(1, 4) + r(3, 4) + r(2, 5)),
  left: () => glyph(5, 7, r(3, 0) + r(2, 1) + r(1, 2) + r(0, 3) + r(1, 4) + r(2, 5) + r(3, 6) + r(4, 0) + r(3, 1) + r(2, 2) + r(1, 3) + r(2, 4) + r(3, 5) + r(4, 6)),
  right: () => glyph(5, 7, r(1, 0) + r(2, 1) + r(3, 2) + r(4, 3) + r(3, 4) + r(2, 5) + r(1, 6) + r(0, 0) + r(1, 1) + r(2, 2) + r(3, 3) + r(2, 4) + r(1, 5) + r(0, 6)),
  down: () => glyph(7, 7, r(2, 0, 3, 3) + r(0, 3, 7) + r(1, 4, 5) + r(2, 5, 3) + r(3, 6), 'g-down'),
  /** The essence drop: a little heart. */
  heart: (scale = 2) => glyph(7, 6, r(1, 0, 2) + r(4, 0, 2) + r(0, 1, 7, 2) + r(1, 3, 5) + r(2, 4, 3) + r(3, 5), 'g-heart', scale),
  soul: (scale = 2) => glyph(7, 8, r(3, 0) + r(2, 1, 3) + r(1, 2, 5, 3) + r(2, 5, 3) + r(1, 6) + r(3, 6) + r(5, 6) + r(0, 7) + r(2, 7) + r(4, 7) + r(6, 7), 'g-soul', scale),
  trophy: (scale = 2) => glyph(7, 7, r(0, 0, 7) + r(0, 1) + r(6, 1) + r(1, 1, 5, 2) + r(2, 3, 3) + r(3, 4) + r(2, 5, 3) + r(1, 6, 5), '', scale),
  stats: (scale = 2) => glyph(8, 7, r(0, 4, 2, 3) + r(3, 2, 2, 5) + r(6, 0, 2, 7), '', scale),
  /** Picks your hero on a companion's row. */
  /** The party panel's hero star: the same star drawn on an 11-pixel grid, a touch bigger and still crisp. */
  heroStar: () => glyph(11, 11, r(5, 0, 1, 2) + r(4, 2, 3) + r(0, 3, 11) + r(1, 4, 9) + r(2, 5, 7) + r(3, 6, 5) + r(2, 7, 3) + r(6, 7, 3) + r(2, 8, 2) + r(7, 8, 2) + r(1, 9, 2) + r(8, 9, 2) + r(1, 10) + r(9, 10), 'g-star', 1),
  star: (scale = 1) => glyph(9, 9, r(4, 0, 1, 2) + r(3, 2, 3) + r(0, 3, 9) + r(1, 4, 7) + r(2, 5, 5, 2) + r(1, 7, 2) + r(6, 7, 2) + r(1, 8) + r(7, 8), 'g-star', scale),
  /** The Steam logo (Simple Icons, CC0), for Wishlist on Steam buttons. */
  steam: (size = 24) => `<svg class="glyph g-steam" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/></svg>`,
  /** A cut gem, for relics. */
  relic: (scale = 2) => glyph(7, 6, r(2, 0, 3) + r(1, 1, 5) + r(0, 2, 7) + r(1, 3, 5) + r(2, 4, 3) + r(3, 5), 'g-relic', scale),
};
