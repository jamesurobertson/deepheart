import type { Item } from '../game/items.ts';
import type { Atlas } from '../render/atlas.ts';

/** Source sheet sizes, so CSS can scale a sprite cell by an integer factor. */
const SHEETS: Record<string, { url: string; w: number; h: number }> = {
  items: { url: '/assets/icons/items.png', w: 96, h: 143 },
  'weapons-bronze': { url: '/assets/icons/weapons-bronze.png', w: 384, h: 320 },
  'weapons-iron': { url: '/assets/icons/weapons-iron.png', w: 384, h: 320 },
  'weapons-steel': { url: '/assets/icons/weapons-steel.png', w: 384, h: 320 },
  'weapons-gold': { url: '/assets/icons/weapons-gold.png', w: 384, h: 320 },
};

let atlas: Atlas | null = null;
export function setAtlas(a: Atlas) {
  atlas = a;
}

function cell(url: string, sw: number, sh: number, x: number, y: number, w: number, h: number, scale: number, cls = '') {
  return `<i class="px ${cls}" style="width:${w * scale}px;height:${h * scale}px;background:url(${url}) -${x * scale}px -${y * scale}px/${sw * scale}px ${sh * scale}px no-repeat"></i>`;
}

/** An item's 16×16 icon at an integer scale. */
export function itemIcon(item: Pick<Item, 'icon'>, scale = 3, cls = ''): string {
  const s = SHEETS[item.icon.sheet];
  return cell(s.url, s.w, s.h, item.icon.col * 16, item.icon.row * 16, 16, 16, scale, cls);
}

export function sheetIcon(sheet: string, col: number, row: number, scale = 2, cls = ''): string {
  const s = SHEETS[sheet];
  return cell(s.url, s.w, s.h, col * 16, row * 16, 16, 16, scale, cls);
}

/** Any named sprite from the 0x72 dungeon sheet (first frame for animations). */
export function sprite(name: string, scale = 2, cls = ''): string {
  if (!atlas) return '';
  const r = atlas.has(name) ? atlas.anim(name)[0] : atlas.rect(name);
  return cell(atlas.url, atlas.size.w, atlas.size.h, r.x, r.y, r.w, r.h, scale, cls);
}

/** Small hand-made pixel glyphs (drawn as SVG rects so they stay crisp). */
const glyph = (w: number, h: number, rects: string, cls = '') =>
  `<svg class="glyph ${cls}" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects}</svg>`;

const r = (x: number, y: number, w = 1, h = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;

export const G = {
  up: () => glyph(7, 7, r(3, 0) + r(2, 1, 3) + r(1, 2, 5) + r(0, 3, 7) + r(2, 4, 3, 3), 'g-up'),
  down: () => glyph(7, 7, r(2, 0, 3, 3) + r(0, 3, 7) + r(1, 4, 5) + r(2, 5, 3) + r(3, 6), 'g-down'),
  star: () => glyph(7, 7, r(3, 0) + r(3, 1) + r(0, 2, 7) + r(1, 3, 5) + r(2, 4, 3) + r(1, 5, 2) + r(4, 5, 2) + r(0, 6) + r(6, 6), 'g-star'),
  close: () => glyph(7, 7, r(0, 0) + r(6, 0) + r(1, 1) + r(5, 1) + r(2, 2) + r(4, 2) + r(3, 3) + r(2, 4) + r(4, 4) + r(1, 5) + r(5, 5) + r(0, 6) + r(6, 6)),
  menu: () => glyph(7, 7, r(0, 1, 7) + r(0, 3, 7) + r(0, 5, 7)),
  sound: () => glyph(9, 7, r(0, 2, 2, 3) + r(2, 1, 1, 5) + r(3, 0, 1, 7) + r(5, 2, 1, 3) + r(7, 1, 1, 5)),
  mute: () => glyph(9, 7, r(0, 2, 2, 3) + r(2, 1, 1, 5) + r(3, 0, 1, 7) + r(5, 1) + r(8, 1) + r(6, 2) + r(7, 2) + r(6, 4) + r(7, 4) + r(5, 5) + r(8, 5) + r(6, 3, 2)),
  speed: () => glyph(7, 7, r(0, 0) + r(1, 1) + r(2, 2) + r(3, 3) + r(2, 4) + r(1, 5) + r(0, 6) + r(3, 0) + r(4, 1) + r(5, 2) + r(6, 3) + r(5, 4) + r(4, 5) + r(3, 6)),
  left: () => glyph(5, 7, r(3, 0) + r(2, 1) + r(1, 2) + r(0, 3) + r(1, 4) + r(2, 5) + r(3, 6) + r(4, 0) + r(3, 1) + r(2, 2) + r(1, 3) + r(2, 4) + r(3, 5) + r(4, 6)),
  right: () => glyph(5, 7, r(1, 0) + r(2, 1) + r(3, 2) + r(4, 3) + r(3, 4) + r(2, 5) + r(1, 6) + r(0, 0) + r(1, 1) + r(2, 2) + r(3, 3) + r(2, 4) + r(1, 5) + r(0, 6)),
  lock: () => glyph(7, 7, r(2, 0, 3) + r(1, 1) + r(5, 1) + r(1, 2) + r(5, 2) + r(0, 3, 7, 4)),
  check: () => glyph(7, 7, r(6, 1) + r(5, 2) + r(4, 3) + r(0, 3) + r(1, 4) + r(3, 4) + r(2, 5)),
};

export function stars(n: number, max = 5): string {
  return `<span class="stars">${Array.from({ length: max }, (_, i) => `<span class="${i < n ? 'on' : ''}">${G.star()}</span>`).join('')}</span>`;
}
