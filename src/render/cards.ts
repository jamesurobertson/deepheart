import * as THREE from 'three';
import type { Atlas } from './atlas.ts';
import type { CardDef } from '../game/data.ts';

/** Frame colours: ordinary monsters in parchment, mid-bosses blue, zone bosses purple, goblins copper, gold copies gold. */
export const CARD_FRAME: Record<CardDef['kind'] | 'gold', string> = {
  monster: '#c9b8a0',
  mid: '#5fa8ff',
  boss: '#c77dff',
  goblin: '#e8904a',
  gold: '#ffd23a',
};

const portraits = new Map<string, HTMLCanvasElement>();

/** A card's monster at its own pixel size, trimmed and tinted the way it looks in the dungeon. */
export function portrait(atlas: Atlas, card: CardDef): HTMLCanvasElement {
  const hit = portraits.get(card.id);
  if (hit) return hit;
  const r = atlas.trimmed(atlas.creature(card.sprite).idle[0]);
  const c = document.createElement('canvas');
  c.width = r.w;
  c.height = r.h;
  const g = c.getContext('2d')!;
  g.drawImage(atlas.texture.image as HTMLImageElement, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  if (card.tint !== undefined) {
    const img = g.getImageData(0, 0, r.w, r.h);
    const t = [(card.tint >> 16) & 255, (card.tint >> 8) & 255, card.tint & 255];
    for (let i = 0; i < img.data.length; i += 4) for (let k = 0; k < 3; k++) img.data[i + k] = (img.data[i + k] * t[k]) / 255;
    g.putImageData(img, 0, 0);
  }
  portraits.set(card.id, c);
  return c;
}

const urls = new Map<string, string>();
export function portraitUrl(atlas: Atlas, card: CardDef): string {
  let url = urls.get(card.id);
  if (!url) urls.set(card.id, (url = portrait(atlas, card).toDataURL()));
  return url;
}

/** Card size in art pixels (it lies on the floor at the dungeon's pixel scale). */
export const CARD_W = 22;
export const CARD_H = 30;

/** The card as it lies on the floor: a dark face with the monster on it, in a frame of its colour. */
export function cardTexture(atlas: Atlas, card: CardDef, gold: boolean): THREE.CanvasTexture {
  // Drawn at 4× so a portrait that has to shrink to fit still reads as pixels.
  const S = 4;
  const c = document.createElement('canvas');
  c.width = CARD_W * S;
  c.height = CARD_H * S;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const frame = gold ? CARD_FRAME.gold : CARD_FRAME[card.kind];
  g.fillStyle = '#140e18';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = frame;
  g.fillRect(S, S, c.width - 2 * S, c.height - 2 * S);
  g.fillStyle = '#241a2c';
  g.fillRect(3 * S, 3 * S, c.width - 6 * S, c.height - 9 * S);
  // The name plate: a dark bar along the bottom.
  g.fillStyle = '#140e18';
  g.fillRect(3 * S, c.height - 5 * S, c.width - 6 * S, 2 * S);
  const p = portrait(atlas, card);
  const box = { w: CARD_W - 8, h: CARD_H - 13 };
  const k = Math.min(1, box.w / p.width, box.h / p.height) * S;
  const w = Math.round(p.width * k);
  const h = Math.round(p.height * k);
  g.drawImage(p, Math.round((c.width - w) / 2), Math.round(3 * S + (box.h * S + 2 * S - h) / 2), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let back: THREE.CanvasTexture | null = null;

/** The back every card shares: dark, diamond-patterned, with the Deepheart heart in the middle. */
export function cardBackTexture(): THREE.CanvasTexture {
  if (back) return back;
  const S = 4;
  const c = document.createElement('canvas');
  c.width = CARD_W * S;
  c.height = CARD_H * S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#140e18';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#8a6a3a';
  g.fillRect(S, S, c.width - 2 * S, c.height - 2 * S);
  g.fillStyle = '#2a1c3a';
  g.fillRect(2 * S, 2 * S, c.width - 4 * S, c.height - 4 * S);
  g.fillStyle = '#3a2850';
  for (let y = 3; y < CARD_H - 3; y++) for (let x = 3; x < CARD_W - 3; x++) if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) g.fillRect(x * S, y * S, S, S);
  // The heart: the same shape as the UI's heart glyph, with a highlight in its top-left lobe.
  const heart = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  const hx = Math.floor((CARD_W - 7) / 2);
  const hy = Math.floor((CARD_H - 6) / 2);
  heart.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '#') return;
    g.fillStyle = (x === 1 && y === 1) || (x === 2 && y === 0) ? '#ffb3c4' : '#ff5a7e';
    g.fillRect((hx + x) * S, (hy + y) * S, S, S);
  }));
  back = new THREE.CanvasTexture(c);
  back.magFilter = THREE.NearestFilter;
  back.minFilter = THREE.NearestFilter;
  back.colorSpace = THREE.SRGBColorSpace;
  return back;
}
