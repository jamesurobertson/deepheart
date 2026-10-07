import { spriteFrames } from './px.ts';

/**
 * The waking world: a few small tile maps (the kid's bedroom, downstairs, the town outside) drawn in code, with
 * walls, props you can use, doors between them and a few people. 16px tiles, seen from above like an old handheld.
 */

export const T = 16;
export type MapId = 'bedroom' | 'house' | 'town';
export type Dir = 'up' | 'down' | 'left' | 'right';
export const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

type Ctx = CanvasRenderingContext2D;

export interface Prop {
  x: number;
  y: number;
  w?: number;
  h?: number;
  /** Something you can walk up to and use (its id picks what happens; the label is its prompt). */
  use?: { id: string; label: string };
  /** Walk-through decoration. */
  flat?: boolean;
}

export interface Warp {
  x: number;
  y: number;
  to: MapId;
  tx: number;
  ty: number;
  dir: Dir;
}

export interface NpcDef {
  id: string;
  name: string;
  sprite: string;
  x: number;
  y: number;
  dir: Dir;
  /** Wanders around inside this box (tiles), or stands still. */
  roam?: [number, number, number, number];
}

export interface MapDef {
  id: MapId;
  w: number;
  h: number;
  /** Top rows that are wall (indoors). */
  wallRows: number;
  props: Prop[];
  warps: Warp[];
  npcs: NpcDef[];
  draw: (ctx: Ctx) => void;
}

const C = {
  ink: '#241a2a', wall: '#efe1bd', stripe: '#e3d1a3', trim: '#a8714a', trimD: '#7a4d33',
  floor: '#c99158', floorD: '#a8733f', sun: '#e2b47a', tile: '#d9cdb4', tileD: '#bfb092',
  rug: '#b5485c', rugD: '#8e3446', rugB: '#e9c46a',
  bed: '#7a4a30', sheet: '#f4efe2', pillow: '#ffffff', blanket: '#5a86d0', blanketD: '#3f66ae', blanketL: '#8fb2ea',
  sky: '#9fd4f5', cloud: '#ffffff', frame: '#7a4d33',
  desk: '#93603b', deskD: '#6d4329', binder: '#c8423f', binderD: '#8f2c2c', gold: '#f2c14e', lamp: '#f6dc78',
  poster: '#3a2850', heart: '#ff5a7e', pot: '#b0603f', leaf: '#5aa050', leafD: '#3e7a3a',
  grass: '#8cc860', grassD: '#6aa848', grassL: '#a8dc78', path: '#e6cf98', pathD: '#cdb47c',
  water: '#5aa8e0', waterL: '#9fd4f5', waterD: '#3a80c0', trunk: '#7a4a30', tree: '#3e8a48', treeL: '#5aa858', treeD: '#2a6a3a',
  roofR: '#c8504a', roofRD: '#9a3434', roofB: '#4a78c8', roofBD: '#34589a', roofP: '#8a5ac8', roofPD: '#65408f',
  house: '#f0e2c0', houseD: '#d4c09a', door: '#7a4d33', glass: '#9fd4f5', fence: '#f4efe2', fenceD: '#bfb092',
  flowerR: '#ff6a7e', flowerY: '#ffe060', flowerW: '#ffffff', counter: '#b9c4cc', counterD: '#8a98a4', stove: '#5a5a66',
  sofa: '#5a86d0', sofaD: '#3f66ae', table: '#a8714a', tableD: '#7a4d33', bowl: '#f4efe2',
};

export function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Draw a sprite standing with its feet at (cx, bottom), optionally facing left, on its walking frames, or shrunk
 *  (`scale` 0.5 makes a companion into a little action figure). */
export function drawSprite(ctx: Ctx, name: string, t: number, cx: number, bottom: number, left = false, walking = false, scale = 1) {
  const anim = (walking && spriteFrames(`${name}_run`)) || spriteFrames(name);
  if (!anim) return;
  const f = anim.frames[Math.floor(t * (walking ? 10 : 4)) % anim.frames.length];
  const w = Math.round(f.w * scale);
  const h = Math.round(f.h * scale);
  const x = Math.round(cx - w / 2);
  const y = Math.round(bottom - h);
  if (left) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(anim.img, f.x, f.y, f.w, f.h, 0, 0, w, h);
    ctx.restore();
  } else ctx.drawImage(anim.img, f.x, f.y, f.w, f.h, x, y, w, h);
}

const pixels = (ctx: Ctx, rows: string[], x: number, y: number, color: string) =>
  rows.forEach((row, j) => [...row].forEach((c, i) => c === '#' && px(ctx, x + i, y + j, 1, 1, color)));

// ---------- pieces ----------

function wallpaper(ctx: Ctx, w: number, rows: number) {
  px(ctx, 0, 0, w * T, rows * T, C.wall);
  for (let x = 2; x < w * T; x += 8) px(ctx, x, 0, 2, rows * T - 3, C.stripe);
  px(ctx, 0, rows * T - 3, w * T, 2, C.trim);
  px(ctx, 0, rows * T - 1, w * T, 1, C.trimD);
}

function boards(ctx: Ctx, w: number, h: number, top: number) {
  px(ctx, 0, top, w * T, h * T - top, C.floor);
  for (let y = top + 7; y < h * T; y += 8) px(ctx, 0, y, w * T, 1, C.floorD);
  for (let y = top, row = 0; y < h * T; y += 8, row++) for (let x = (row % 2) * 12 + 6; x < w * T; x += 24) px(ctx, x, y, 1, 7, C.floorD);
}

function windowPane(ctx: Ctx, x: number, y: number) {
  px(ctx, x, y, 32, 24, C.frame);
  px(ctx, x + 2, y + 2, 28, 20, C.sky);
  px(ctx, x + 5, y + 6, 9, 3, C.cloud);
  px(ctx, x + 7, y + 4, 5, 2, C.cloud);
  px(ctx, x + 19, y + 14, 7, 2, C.cloud);
  px(ctx, x + 15, y + 2, 2, 20, C.frame);
  px(ctx, x + 2, y + 11, 28, 2, C.frame);
}

function stairs(ctx: Ctx, x: number, y: number, down: boolean) {
  px(ctx, x, y, 16, 16, C.ink);
  for (let k = 0; k < 4; k++) px(ctx, x + 1, y + 1 + k * 4, 14, 3, down ? ['#8a6040', '#6d4329', '#4a2c1c', '#2a1810'][k] : ['#4a2c1c', '#6d4329', '#8a6040', '#a8714a'][k]);
}

function tree(ctx: Ctx, x: number, y: number) {
  px(ctx, x + 6, y + 11, 4, 5, C.trunk);
  px(ctx, x + 1, y + 1, 14, 11, C.treeD);
  px(ctx, x + 2, y, 12, 11, C.tree);
  px(ctx, x, y + 3, 16, 7, C.tree);
  px(ctx, x + 4, y + 2, 4, 3, C.treeL);
  px(ctx, x + 2, y + 5, 3, 2, C.treeL);
}

function flowers(ctx: Ctx, x: number, y: number, color: string) {
  for (const [dx, dy] of [[3, 3], [10, 5], [5, 10], [12, 12]]) {
    px(ctx, x + dx, y + dy, 2, 2, color);
    px(ctx, x + dx, y + dy + 2, 1, 1, C.grassD);
  }
}

function building(ctx: Ctx, x: number, y: number, w: number, h: number, roof: string, roofD: string, doorAt: number) {
  const X = x * T;
  const Y = y * T;
  // Roof over the top half, walls and windows below, the door on the bottom row.
  px(ctx, X, Y, w * T, h * T, C.ink);
  px(ctx, X + 1, Y + 1, w * T - 2, Math.floor(h * T * 0.5), roof);
  for (let ry = Y + 4; ry < Y + h * T * 0.5; ry += 5) px(ctx, X + 1, ry, w * T - 2, 1, roofD);
  const wy = Y + 1 + Math.floor(h * T * 0.5);
  px(ctx, X + 2, wy, w * T - 4, Y + h * T - wy - 1, C.house);
  px(ctx, X + 2, wy, w * T - 4, 2, C.houseD);
  for (let k = 0; k < w; k++) {
    if (k === doorAt) continue;
    if (k % 2 === 0) {
      px(ctx, X + k * T + 3, wy + 6, 10, 8, C.ink);
      px(ctx, X + k * T + 4, wy + 7, 8, 6, C.glass);
      px(ctx, X + k * T + 7, wy + 7, 1, 6, C.ink);
    }
  }
  const dx = X + doorAt * T + 3;
  px(ctx, dx - 1, Y + h * T - 14, 12, 14, C.ink);
  px(ctx, dx, Y + h * T - 13, 10, 13, C.door);
  px(ctx, dx + 7, Y + h * T - 7, 2, 2, C.gold);
}

function fence(ctx: Ctx, x: number, y: number, n: number) {
  for (let k = 0; k < n; k++) {
    const X = (x + k) * T;
    const Y = y * T;
    px(ctx, X, Y + 6, 16, 2, C.fenceD);
    px(ctx, X, Y + 11, 16, 2, C.fenceD);
    px(ctx, X + 2, Y + 3, 3, 12, C.fence);
    px(ctx, X + 10, Y + 3, 3, 12, C.fence);
  }
}

// ---------- the bedroom ----------

/** The brothers' game on the rug, between them: each one's deck, the card each has laid out, and the pile they play
 *  onto (top-left corners of 5×7 cards). */
export const BROS_GAME = { danDeck: [78, 84], victorDeck: [93, 84], danLaid: [79, 94], victorLaid: [92, 94], pile: [85, 87] };

/** The playset in the corner by the toy chest: cardboard-box walls around a felt floor. `floor` is where the dungeon
 *  view shrinks to. */
export const PLAYSET = { floor: { x: 104, y: 57, w: 48, h: 21 } };
/** Where the kid kneels beside the playset, and where his hero's figure stands on it (feet) when he's not holding it. */
export const KID_START = { x: 5, y: 4, dir: 'right' as Dir };
export const HERO_SPOT = [112, 76];
/** Real little figures on the playset (feet): two more of the party beside the hero, two monsters facing them. */
export const PARTY_SPOTS = [[121, 73], [129, 77]];
export const FOE_SPOTS = [[142, 74], [150, 77]];
/** Figures lined up along the top of the dresser (feet). */
export const SHELF_SPOTS = [[96, 24], [106, 24], [116, 24], [126, 24], [136, 24], [146, 24]];
/** Where the "!" hangs when the binder on the desk has cards you haven't seen. */
export const BINDER_MARK = [72, 4];
/** Cards hidden around the place: stand on the spot and press (or tap yourself) to find one. Each turns up once. */
export const STASHES: { id: string; map: MapId; x: number; y: number; look: string; found: string }[] = [
  { id: 'floorboard', map: 'bedroom', x: 0, y: 8, look: 'This board is loose...', found: 'under a floorboard' },
  { id: 'backyard', map: 'town', x: 1, y: 1, look: 'Something is wedged behind the house...', found: 'behind a house' },
  { id: 'tallgrass', map: 'town', x: 18, y: 1, look: 'Something in the tall grass...', found: 'in the tall grass' },
  { id: 'roots', map: 'town', x: 7, y: 2, look: 'Something in the roots...', found: 'in the roots of a tree' },
  { id: 'flowers', map: 'town', x: 2, y: 7, look: 'Something among the flowers...', found: 'among the flowers' },
  { id: 'pond', map: 'town', x: 6, y: 11, look: 'Something at the water\'s edge...', found: 'by the pond' },
  { id: 'burrow', map: 'town', x: 1, y: 16, look: 'A rabbit hole...', found: 'down a rabbit hole' },
  { id: 'fence', map: 'town', x: 17, y: 11, look: 'Something behind the fence...', found: 'behind the fence' },
  { id: 'shop', map: 'town', x: 13, y: 11, look: 'Something beside the shop...', found: 'beside the card shop' },
  { id: 'paving', map: 'town', x: 15, y: 8, look: 'This stone wobbles...', found: 'under a paving stone' },
  { id: 'hollow', map: 'town', x: 11, y: 14, look: 'The tree is hollow...', found: 'in a hollow tree' },
];

/** The kid's playset: boxes for walls and a felt floor (the figures on it are drawn live). */
function playset(ctx: Ctx) {
  const box = (x: number, y: number, w: number, h: number) => {
    px(ctx, x, y, w, h, C.ink);
    px(ctx, x + 1, y + 1, w - 2, h - 2, '#c9a26a');
    px(ctx, x + 1, y + h - 3, w - 2, 2, '#a07c48');
    px(ctx, x + Math.floor(w / 2) - 1, y + 1, 2, h - 4, '#e8d2a0');
  };
  const { x, y, w, h } = PLAYSET.floor;
  px(ctx, x, y, w, h, '#4a5a4a');
  for (let gx = x + 6; gx < x + w; gx += 6) px(ctx, gx, y, 1, h, '#3e4c3e');
  for (let gy = y + 5; gy < y + h; gy += 5) px(ctx, x, gy, w, 1, '#3e4c3e');
  for (let bx = x - 4; bx < x + w; bx += 13) box(bx, y - 11, 13, 12);
  box(x - 8, y - 3, 9, h + 3);
  box(x + w - 1, y - 3, 9, h + 3);
  // Toy blocks on the corners.
  for (const [bx, by, c] of [[x - 6, y - 7, '#c8423f'], [x + w + 1, y - 7, '#4a78c8'], [x + w - 1, y + h - 2, C.gold]] as const) {
    px(ctx, bx, by, 5, 5, C.ink);
    px(ctx, bx + 1, by + 1, 3, 3, c);
  }
}

/** One long dresser along the wall: the binder on one end, the figures lined up along the top (drawn live). */
function dresser(ctx: Ctx) {
  px(ctx, 64, 22, 96, 26, C.ink);
  px(ctx, 65, 23, 94, 4, C.desk);
  px(ctx, 65, 27, 94, 20, C.deskD);
  for (const x of [67, 99, 131]) {
    px(ctx, x, 29, 28, 7, C.desk);
    px(ctx, x, 38, 28, 7, C.desk);
    px(ctx, x + 12, 31, 4, 2, C.gold);
    px(ctx, x + 12, 40, 4, 2, C.gold);
  }
  // The binder.
  px(ctx, 68, 15, 14, 9, C.ink);
  px(ctx, 69, 16, 12, 7, C.binder);
  px(ctx, 69, 22, 12, 1, C.binderD);
  for (const x of [71, 74, 77]) px(ctx, x, 15, 1, 2, C.gold);
}

/** The bed's blanket. */
function blanket(ctx: Ctx) {
  px(ctx, 2, 46, 28, 32, C.blanket);
  for (let y = 52, row = 0; y < 78; y += 6, row++) for (let x = 4 + (row % 2) * 3; x < 28; x += 6) px(ctx, x, y, 2, 2, C.blanketD);
  px(ctx, 2, 46, 28, 3, C.blanketL);
  px(ctx, 2, 49, 28, 1, C.blanketD);
  px(ctx, 1, 46, 1, 32, C.ink);
  px(ctx, 30, 46, 1, 32, C.ink);
}

const bedroom: MapDef = {
  id: 'bedroom', w: 10, h: 9, wallRows: 2,
  props: [
    { x: 0, y: 2, w: 2, h: 3, use: { id: 'bed', label: 'Bed' } },
    { x: 6, y: 3, w: 4, h: 2, use: { id: 'playset', label: 'Keep playing' } },
    { x: 4, y: 2, w: 2, use: { id: 'binder', label: 'Binder' } },
    { x: 6, y: 2, w: 4, use: { id: 'toys', label: 'Figures' } },
    { x: 0, y: 1, use: { id: 'poster', label: 'Poster' } },
    { x: 2, y: 1, w: 2, use: { id: 'window', label: 'Window' } },
    { x: 0, y: 7 },
    { x: 5, y: 5, use: { id: 'brosGame', label: 'Their game' } },
  ],
  warps: [{ x: 9, y: 7, to: 'house', tx: 8, ty: 2, dir: 'left' }],
  // The older brothers, on the rug, facing each other over a game of cards.
  npcs: [
    { id: 'dan', name: 'Dan', sprite: 'ef_elf_m', x: 4, y: 5, dir: 'right' },
    { id: 'victor', name: 'Victor', sprite: 'victor', x: 6, y: 5, dir: 'left' },
  ],
  draw(ctx) {
    wallpaper(ctx, 10, 2);
    boards(ctx, 10, 9, 32);
    // Morning sun from the window across the boards.
    for (let y = 32; y < 112; y++) px(ctx, 30 + Math.floor((y - 32) * 0.45), y, 34, 1, C.sun);
    for (let y = 39; y < 112; y += 8) px(ctx, 0, y, 160, 1, C.floorD);
    windowPane(ctx, 32, 4);
    px(ctx, 30, 28, 36, 3, C.trim);
    // The DEEPHEART poster, over the bed.
    px(ctx, 7, 2, 18, 22, C.ink);
    px(ctx, 8, 3, 16, 20, C.poster);
    pixels(ctx, ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], 12, 5, C.heart);
    px(ctx, 10, 14, 12, 1, C.gold);
    px(ctx, 11, 17, 10, 1, C.gold);
    px(ctx, 12, 20, 8, 1, C.gold);
    // Bed against the wall, in the corner.
    px(ctx, 0, 24, 32, 56, C.ink);
    px(ctx, 1, 25, 30, 8, C.bed);
    px(ctx, 2, 33, 28, 45, C.sheet);
    px(ctx, 5, 35, 22, 9, C.ink);
    px(ctx, 6, 36, 20, 7, C.pillow);
    px(ctx, 1, 78, 30, 2, C.bed);
    blanket(ctx);
    // Rug, where the brothers play.
    px(ctx, 52, 82, 56, 30, C.rugB);
    px(ctx, 54, 84, 52, 26, C.rug);
    for (let x = 57; x < 104; x += 6) px(ctx, x, 86, 3, 22, C.rugD);
    // The dresser along the wall, and the playset on the floor in front of it.
    dresser(ctx);
    playset(ctx);
    // A plant in the far corner, and the stairs down.
    px(ctx, 3, 118, 10, 9, C.pot);
    px(ctx, 2, 117, 12, 2, C.trimD);
    px(ctx, 5, 108, 6, 10, C.leaf);
    px(ctx, 1, 111, 5, 6, C.leafD);
    px(ctx, 10, 110, 5, 6, C.leafD);
    stairs(ctx, 144, 112, true);
  },
};

// ---------- downstairs ----------

const house: MapDef = {
  id: 'house', w: 10, h: 9, wallRows: 2,
  props: [
    { x: 0, y: 2, w: 4, use: { id: 'kitchen', label: 'Kitchen' } },
    { x: 4, y: 4, w: 2, h: 2, use: { id: 'table', label: 'Table' } },
    { x: 7, y: 5, w: 2, use: { id: 'sofa', label: 'Sofa' } },
    { x: 6, y: 1, use: { id: 'photo', label: 'Photo' } },
  ],
  warps: [
    { x: 9, y: 2, to: 'bedroom', tx: 8, ty: 7, dir: 'left' },
    { x: 4, y: 8, to: 'town', tx: 4, ty: 6, dir: 'down' },
    { x: 5, y: 8, to: 'town', tx: 4, ty: 6, dir: 'down' },
  ],
  npcs: [{ id: 'mum', name: 'Mum', sprite: 'ef_highelf_f', x: 2, y: 3, dir: 'down' }],
  draw(ctx) {
    wallpaper(ctx, 10, 2);
    // Kitchen tiles on the left, boards on the right.
    px(ctx, 0, 32, 160, 112, C.floor);
    boards(ctx, 10, 9, 32);
    for (let y = 32; y < 80; y += 8) for (let x = 0; x < 64; x += 8) px(ctx, x, y, 8, 8, ((x + y) / 8) % 2 ? C.tile : C.tileD);
    windowPane(ctx, 112, 4);
    // Family photo.
    px(ctx, 99, 6, 14, 14, C.ink);
    px(ctx, 100, 7, 12, 12, C.gold);
    px(ctx, 102, 9, 8, 8, C.sky);
    px(ctx, 104, 12, 4, 5, '#d8a070');
    px(ctx, 103, 10, 6, 3, '#9fb8c8');
    // Counter with a sink and a stove.
    px(ctx, 0, 22, 64, 26, C.ink);
    px(ctx, 0, 23, 63, 7, C.counter);
    px(ctx, 0, 30, 63, 17, C.counterD);
    px(ctx, 8, 24, 14, 5, C.waterD);
    px(ctx, 36, 24, 18, 5, C.stove);
    for (const x of [39, 47]) px(ctx, x, 25, 4, 3, '#ff8a3d');
    for (let x = 4; x < 60; x += 14) px(ctx, x, 34, 10, 2, C.counter);
    // Table with a bowl and two chairs.
    px(ctx, 62, 72, 4, 14, C.tableD);
    px(ctx, 94, 72, 4, 14, C.tableD);
    px(ctx, 64, 62, 32, 28, C.ink);
    px(ctx, 65, 63, 30, 22, C.table);
    px(ctx, 65, 85, 30, 4, C.tableD);
    px(ctx, 74, 70, 10, 5, C.bowl);
    px(ctx, 75, 70, 8, 2, C.gold);
    // Sofa: a back, two cushions, arms, and a rumpled blanket.
    px(ctx, 111, 74, 34, 22, C.ink);
    px(ctx, 112, 75, 32, 8, C.sofaD);
    px(ctx, 112, 83, 32, 11, C.sofa);
    px(ctx, 127, 84, 1, 9, C.sofaD);
    px(ctx, 112, 75, 5, 19, C.sofaD);
    px(ctx, 139, 75, 5, 19, C.sofaD);
    px(ctx, 113, 76, 3, 2, C.blanketL);
    px(ctx, 140, 76, 3, 2, C.blanketL);
    px(ctx, 118, 86, 8, 5, C.rugB);
    px(ctx, 119, 87, 6, 1, C.rug);
    // Stairs up, and the doormat by the front door.
    stairs(ctx, 144, 32, false);
    px(ctx, 64, 128, 32, 16, C.rugD);
    px(ctx, 66, 130, 28, 12, C.rug);
  },
};

// ---------- the town ----------

const TREES: [number, number][] = [];
for (let x = 0; x < 20; x++) TREES.push([x, 0], [x, 17]);
for (let y = 1; y < 17; y++) TREES.push([0, y], [19, y]);
TREES.push([17, 12], [16, 15], [11, 15], [14, 14], [8, 2], [9, 3], [18, 7]);

const town: MapDef = {
  id: 'town', w: 20, h: 18, wallRows: 0,
  // Doors come before the houses they're set in: the first prop on a tile is the one you use.
  props: [
    { x: 14, y: 5, use: { id: 'friendDoor', label: 'Door' } },
    { x: 9, y: 12, use: { id: 'shop', label: 'Card shop' } },
    { x: 7, y: 5, use: { id: 'mailbox', label: 'Mailbox' } },
    { x: 9, y: 7, use: { id: 'sign', label: 'Sign' } },
    { x: 2, y: 11, w: 4, h: 4, use: { id: 'pond', label: 'Pond' } },
    { x: 2, y: 2, w: 5, h: 4 },
    { x: 12, y: 2, w: 5, h: 4 },
    { x: 7, y: 9, w: 6, h: 4 },
    { x: 14, y: 10, w: 4 },
    ...TREES.map(([x, y]) => ({ x, y })),
  ],
  warps: [{ x: 4, y: 5, to: 'house', tx: 4, ty: 7, dir: 'up' }],
  npcs: [
    { id: 'friend', name: 'Pip', sprite: 'cr_elf', x: 13, y: 7, dir: 'down', roam: [11, 6, 17, 7] },
    { id: 'fisher', name: 'Old Bram', sprite: 'ef_fatcleric', x: 6, y: 13, dir: 'left' },
  ],
  draw(ctx) {
    px(ctx, 0, 0, 320, 288, C.grass);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) if ((x * 7 + y * 13) % 5 === 0) {
      px(ctx, x * T + 4, y * T + 6, 1, 2, C.grassD);
      px(ctx, x * T + 6, y * T + 5, 1, 3, C.grassD);
      px(ctx, x * T + 11, y * T + 11, 1, 2, C.grassL);
    }
    // Paths: from the front door down to the shop, across town, and up to Pip's.
    const path = (x: number, y: number, w: number, h: number) => {
      px(ctx, x * T, y * T, w * T, h * T, C.path);
      px(ctx, x * T, y * T, w * T, 1, C.pathD);
      px(ctx, x * T, (y + h) * T - 1, w * T, 1, C.pathD);
    };
    path(4, 6, 1, 3);
    path(1, 8, 18, 1);
    path(14, 6, 1, 2);
    path(9, 8, 1, 4);
    for (const [x, y, c] of [[2, 7, C.flowerR], [6, 7, C.flowerY], [11, 6, C.flowerW], [17, 9, C.flowerR], [13, 13, C.flowerY], [6, 15, C.flowerW], [3, 16, C.flowerR], [16, 11, C.flowerW]] as const) flowers(ctx, x * T, y * T, c);
    // Pond.
    px(ctx, 2 * T + 2, 11 * T, 4 * T - 4, 4 * T, C.ink);
    px(ctx, 2 * T, 11 * T + 2, 4 * T, 4 * T - 4, C.ink);
    px(ctx, 2 * T + 3, 11 * T + 1, 4 * T - 6, 4 * T - 2, C.water);
    px(ctx, 2 * T + 1, 11 * T + 3, 4 * T - 2, 4 * T - 6, C.water);
    for (const [x, y] of [[44, 186], [64, 200], [50, 214], [76, 222]]) px(ctx, x, y, 6, 1, C.waterL);
    px(ctx, 70, 180, 3, 3, C.waterD);
    building(ctx, 2, 2, 5, 4, C.roofR, C.roofRD, 2);
    building(ctx, 12, 2, 5, 4, C.roofB, C.roofBD, 2);
    // The card shop, with its heart on the sign.
    building(ctx, 7, 9, 6, 4, C.roofP, C.roofPD, 2);
    px(ctx, 7 * T + 22, 9 * T + 4, 52, 13, C.ink);
    px(ctx, 7 * T + 23, 9 * T + 5, 50, 11, C.poster);
    pixels(ctx, ['.##.##.', '#######', '.#####.', '..###..', '...#...'], 7 * T + 27, 9 * T + 8, C.heart);
    for (let k = 0; k < 6; k++) px(ctx, 7 * T + 38 + k * 6, 9 * T + 10, 4, 1, C.gold);
    // Mailbox and the town sign.
    px(ctx, 7 * T + 6, 5 * T + 6, 3, 10, C.trimD);
    px(ctx, 7 * T + 3, 5 * T + 1, 10, 6, C.ink);
    px(ctx, 7 * T + 4, 5 * T + 2, 8, 4, C.roofB);
    px(ctx, 9 * T + 7, 7 * T + 9, 2, 7, C.trimD);
    px(ctx, 9 * T + 1, 7 * T + 2, 14, 8, C.ink);
    px(ctx, 9 * T + 2, 7 * T + 3, 12, 6, '#d8b070');
    for (let k = 0; k < 3; k++) px(ctx, 9 * T + 4, 7 * T + 4 + k * 2, 8, 1, C.trimD);
    fence(ctx, 14, 10, 4);
    for (const [x, y] of TREES) tree(ctx, x * T, y * T);
  },
};

export const MAPS: Record<MapId, MapDef> = { bedroom, house, town };

/** What stands on a tile: a prop, if any. */
export function propAt(map: MapDef, x: number, y: number) {
  return map.props.find((p) => x >= p.x && x < p.x + (p.w ?? 1) && y >= p.y && y < p.y + (p.h ?? 1));
}

export function blocked(map: MapDef, x: number, y: number) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h || y < map.wallRows) return true;
  const p = propAt(map, x, y);
  return !!p && !p.flat;
}
