import type { Atlas, Rect } from '../render/atlas.ts';

let atlas: Atlas | null = null;
export function setAtlas(a: Atlas) {
  atlas = a;
}

function rectFor(name: string): Rect | null {
  if (!atlas) return null;
  for (const n of [name, `${name}_idle`]) {
    if (atlas.has(n)) return atlas.anim(n)[0];
  }
  return null;
}

function cell(r: Rect, scale: number, cls = '', style = '') {
  const a = atlas!;
  return `<i class="px ${cls}" style="width:${r.w * scale}px;height:${r.h * scale}px;background:url(${a.url}) -${r.x * scale}px -${r.y * scale}px/${a.size.w * scale}px ${a.size.h * scale}px no-repeat;${style}"></i>`;
}

/** Any sprite from the dungeon sheet (first frame for animations) at an integer scale. */
export function sprite(name: string, scale = 2, cls = ''): string {
  const r = rectFor(name);
  return r ? cell(r, scale, cls) : '';
}

/** A sprite at the largest integer scale that fits a `box`-pixel square. */
export function spriteFit(name: string, box: number, cls = ''): string {
  const r = rectFor(name);
  if (!r) return '';
  return cell(r, Math.max(1, Math.floor(box / Math.max(r.w, r.h))), cls);
}

/** Small hand-made pixel glyphs (drawn as SVG rects so they stay crisp). */
const glyph = (w: number, h: number, rects: string, cls = '', scale = 2) =>
  `<svg class="glyph ${cls}" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects}</svg>`;

const r = (x: number, y: number, w = 1, h = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;

export const G = {
  close: () => glyph(7, 7, r(0, 0) + r(6, 0) + r(1, 1) + r(5, 1) + r(2, 2) + r(4, 2) + r(3, 3) + r(2, 4) + r(4, 4) + r(1, 5) + r(5, 5) + r(0, 6) + r(6, 6)),
  menu: () => glyph(7, 7, r(0, 1, 7) + r(0, 3, 7) + r(0, 5, 7)),
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
  trophy: () => glyph(7, 7, r(0, 0, 7) + r(0, 1) + r(6, 1) + r(1, 1, 5, 2) + r(2, 3, 3) + r(3, 4) + r(2, 5, 3) + r(1, 6, 5)),
  stats: () => glyph(7, 7, r(0, 4, 2, 3) + r(3, 2, 2, 5) + r(5, 0, 2, 7)),
  /** A cut gem, for relics. */
  relic: (scale = 2) => glyph(7, 6, r(2, 0, 3) + r(1, 1, 5) + r(0, 2, 7) + r(1, 3, 5) + r(2, 4, 3) + r(3, 5), 'g-relic', scale),
  abyss: () => glyph(7, 7, r(0, 0, 7) + r(1, 1, 5) + r(2, 2, 3) + r(3, 3) + r(0, 5, 7) + r(1, 6, 5)),
};
