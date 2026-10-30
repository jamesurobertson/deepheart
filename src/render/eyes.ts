import * as THREE from 'three';
import type { Atlas, Rect } from './atlas.ts';

type Px = [number, number];

/** Pixels [x, y] across row y. */
const row = (y: number, ...xs: number[]): Px[] => xs.map((x) => [x, y]);
const span = (y: number, from: number, to: number): Px[] => row(y, ...Array.from({ length: to - from + 1 }, (_, k) => from + k));
/** The usual 0x72 face: a two-pixel-wide near eye and a one-pixel far eye, two rows tall. */
const pair = (x: number, y: number, far: number): Px[] => [...row(y, x, x + 1, far), ...row(y + 1, x, x + 1, far)];
/** A knight's grille visor, top-left corner at (x, y): its three slits. */
const grille = (x: number, y: number): Px[] => [2, 3, 4].flatMap((dy) => row(y + dy, x + 2, x + 4, x + 6));

/** What burns red in a Rampage, per companion sprite, on its first idle frame: eyes, or the slots of a visor. */
export const EYES: Record<string, Px[]> = {
  knight_m: grille(6, 14),
  elf_f: pair(6, 17, 11),
  dwarf_m: pair(8, 18, 13),
  wizzard_m: pair(7, 18, 12),
  cr_gingerbread: pair(5, 6, 10),
  ef_elvenknight: [...span(8, 6, 11), ...row(9, 9, 10), ...row(10, 9, 10)],
  lizard_m: [...row(15, 6, 7), ...row(16, 6, 7)],
  cr_green_thief: [[7, 8], [10, 8]],
  cr_pirate_captain: [[11, 7], [11, 8]],
  dwarf_f: pair(8, 18, 13),
  ef_elf_f: pair(7, 6, 12),
  wizzard_f: pair(6, 17, 11),
  elf_m: pair(6, 15, 11),
  rm_rocker: [...span(11, 5, 10), ...row(12, 6, 7, 9, 10), ...row(13, 6, 7, 9, 10)],
  lizard_f: [...row(15, 6, 7), ...row(16, 6, 7)],
  doc: [...row(11, 6, 7, 11, 12), ...row(12, 6, 7, 11, 12)],
  ef_normalcleric: pair(5, 5, 10),
  cr_frost_imp: pair(5, 10, 10),
  cr_santa: pair(7, 12, 12),
  cr_gold_knight: grille(6, 8),
  pumpkin_dude: [...row(9, 5, 6, 7, 12, 13), ...row(10, 5, 6, 7, 8, 11, 12, 13)],
  cr_purple_knight: [...span(11, 7, 11), ...row(12, 9), ...row(13, 9), ...row(14, 9)],
  cr_wizard: pair(7, 11, 12),
  rm_dracula: pair(11, 5, 15),
  ef_highelf_f: pair(7, 6, 12),
  necromancer: pair(7, 14, 11),
  sd_king: pair(6, 9, 11),
  ef_highelf_m: pair(7, 10, 12),
  ef_wizard: pair(8, 14, 13),
  angel: pair(8, 9, 12),
  sm_large_oni_blue: [[11, 9], [15, 9]],
  big_demon: [...row(11, 16, 17, 20), ...row(12, 16, 17, 20)],
};

/** RGBA at a pixel of the sheet (alpha 0 off the edge). */
export type PixelAt = (x: number, y: number) => ArrayLike<number>;

/**
 * The eye pixels on each of a sprite's frames. Frames bob and lean, so each is shifted to line up best with the
 * first idle frame around the head (wings and legs move on their own), counting matching eye pixels far above the rest.
 */
export function eyesOnFrames(px: PixelAt, first: Rect, frames: Rect[], eyes: Px[]): Px[][] {
  const same = (a: ArrayLike<number>, b: ArrayLike<number>) => a[3] >= 128 && b[3] >= 128 && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  // Each eye: the touching pixels, as indexes into `eyes`.
  const clusters: number[][] = [];
  eyes.forEach(([x, y], k) => {
    const touching = clusters.filter((eye) => eye.some((j) => Math.abs(eyes[j][0] - x) <= 1 && Math.abs(eyes[j][1] - y) <= 1));
    const merged = [k, ...touching.flat()];
    for (const eye of touching) clusters.splice(clusters.indexOf(eye), 1);
    clusters.push(merged);
  });
  const xs = eyes.map(([x]) => x), ys = eyes.map(([, y]) => y);
  const head = { x0: Math.max(0, Math.min(...xs) - 4), x1: Math.min(first.w - 1, Math.max(...xs) + 4), y0: Math.max(0, Math.min(...ys) - 4), y1: Math.min(first.h - 1, Math.max(...ys) + 4) };
  return frames.map((r) => {
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < r.w && y < r.h;
    let best = { dx: 0, dy: 0, score: -1 };
    for (let dy = -6; dy <= 6; dy++) for (let dx = -3; dx <= 3; dx++) {
      let score = 0;
      for (let y = head.y0; y <= head.y1; y++) for (let x = head.x0; x <= head.x1; x++) {
        if (inside(x + dx, y + dy) && same(px(first.x + x, first.y + y), px(r.x + x + dx, r.y + y + dy))) score++;
      }
      for (const [x, y] of eyes) if (inside(x + dx, y + dy) && same(px(first.x + x, first.y + y), px(r.x + x + dx, r.y + y + dy))) score += 1000;
      if (score > best.score) best = { dx, dy, score };
    }
    // Then each eye on its own, a pixel either way, for heads that squash wider.
    const out = eyes.map(([x, y]) => [x + best.dx, y + best.dy] as Px);
    for (const eye of clusters) {
      const fits = (nx: number, ny: number) => eye.filter((k) => {
        const [x, y] = out[k];
        return inside(x + nx, y + ny) && same(px(first.x + eyes[k][0], first.y + eyes[k][1]), px(r.x + x + nx, r.y + y + ny));
      }).length;
      let nudge = { nx: 0, ny: 0, n: fits(0, 0) };
      for (const [nx, ny] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (fits(nx, ny) > nudge.n) nudge = { nx, ny, n: fits(nx, ny) };
      for (const k of eye) out[k] = [out[k][0] + nudge.nx, out[k][1] + nudge.ny];
    }
    // A squashed or stretched head makes its eyes taller: follow each one up and down through its own color.
    // (Not for black eyes, which would run into the outline.)
    const seen = new Set(out.map((p) => p.join(',')));
    eyes.forEach(([x, y], k) => {
      const color = px(first.x + x, first.y + y);
      if (color[0] + color[1] + color[2] < 120) return;
      for (const step of [-1, 1]) for (let ey = out[k][1] + step, n = 0; n < 3 && inside(out[k][0], ey) && same(color, px(r.x + out[k][0], r.y + ey)); ey += step, n++) {
        if (!seen.has(`${out[k][0]},${ey}`)) out.push([out[k][0], ey]), seen.add(`${out[k][0]},${ey}`);
      }
    });
    return out;
  });
}

/** A sheet-sized mask, white on every companion's eye pixels in every idle and run frame, sampled with the sprite's
 *  own UVs (so a flipped sprite's eyes flip with it). */
export function eyeMask(atlas: Atlas, sprites: string[]): THREE.DataTexture {
  const sheet = atlas.image();
  const { width, height } = sheet;
  const px: PixelAt = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? [0, 0, 0, 0] : sheet.data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4));
  const data = new Uint8Array(width * height);
  for (const sprite of new Set(sprites)) {
    const eyes = EYES[sprite];
    if (!eyes) continue;
    const { idle, run } = atlas.creature(sprite);
    const frames = [...new Set([...idle, ...run])];
    eyesOnFrames(px, idle[0], frames, eyes).forEach((pixels, k) => {
      // (Rows go bottom-up: a data texture isn't flipped on upload the way the loaded sheet is.)
      for (const [x, y] of pixels) data[(height - 1 - (frames[k].y + y)) * width + frames[k].x + x] = 255;
    });
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RedFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
