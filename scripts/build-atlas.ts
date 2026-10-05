/**
 * Packs every sprite the game uses into one sheet: the 0x72 DungeonTileset II atlas plus
 * the CC0 add-on packs in assets-src (zone tilesets, Enchanted Forest and CR+ creatures, the Sewers, DevWizard's spells).
 *
 *   node scripts/build-atlas.ts
 *
 * Writes public/assets/sprites/atlas.png and atlas.txt ("name x y w h" per line, the same
 * format as the original tile list, so animations stay `${base}_anim_f${n}`).
 * Dependency-free: a tiny PNG reader/writer for 8-bit RGBA images.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync, crc32 } from 'node:zlib';
import { join } from 'node:path';

interface Image { w: number; h: number; data: Uint8Array }

// ---------- PNG ----------

/** Undo PNG row filters for a w×h block starting at `off` in the inflated stream. */
function unfilter(raw: Buffer, off: number, w: number, h: number, bpp: number): { px: Uint8Array; next: number } {
  const stride = w * bpp;
  const px = new Uint8Array(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f = raw[off + y * (stride + 1)];
    const row = off + y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v = raw[row + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { px, next: off + h * (stride + 1) };
}

/** Adam7 interlace passes: x start, y start, x step, y step. */
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

function readPng(path: string): Image {
  const buf = readFileSync(path);
  let pos = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  let interlaced = false;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      type = body[9];
      interlaced = body[12] === 1;
      if (body[8] !== 8 || (type !== 6 && type !== 2)) throw new Error(`${path}: only 8-bit RGB/RGBA PNGs are supported`);
    } else if (kind === 'IDAT') idat.push(body);
    pos += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  let px: Uint8Array;
  if (!interlaced) px = unfilter(raw, 0, w, h, bpp).px;
  else {
    // Each pass is its own small filtered image; scatter its pixels into place.
    px = new Uint8Array(w * h * bpp);
    let off = 0;
    for (const [xs, ys, dx, dy] of ADAM7) {
      const pw = Math.ceil((w - xs) / dx);
      const ph = Math.ceil((h - ys) / dy);
      if (pw <= 0 || ph <= 0) continue;
      const pass = unfilter(raw, off, pw, ph, bpp);
      off = pass.next;
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
        px.set(pass.px.subarray((y * pw + x) * bpp, (y * pw + x + 1) * bpp), ((ys + y * dy) * w + xs + x * dx) * bpp);
      }
    }
  }
  if (bpp === 4) return { w, h, data: px };
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([px[i * 3], px[i * 3 + 1], px[i * 3 + 2], 255], i * 4);
  return { w, h, data };
}

function writePng(path: string, img: Image) {
  const chunk = (kind: string, body: Buffer) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(kind, 4, 'ascii');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(img.h * (img.w * 4 + 1));
  for (let y = 0; y < img.h; y++) Buffer.from(img.data.buffer, img.data.byteOffset + y * img.w * 4, img.w * 4).copy(raw, y * (img.w * 4 + 1) + 1);
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

/** Tight box around the opaque pixels of a region. */
function bbox(img: Image, x0 = 0, y0 = 0, w = img.w, h = img.h) {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (img.data[(y * img.w + x) * 4 + 3] > 0) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// ---------- gather ----------

interface Piece { name: string; img: Image; x: number; y: number; w: number; h: number }
const pieces: Piece[] = [];
const add = (name: string, img: Image, x: number, y: number, w = 16, h = 16) => pieces.push({ name, img, x, y, w, h });

const SRC = 'assets-src';

// Zone tilesets. The Omniboy jungle and desert sheets share the classic 0x72 layout (16px cells).
const cell = (c: number, r: number): [number, number] => [c * 16, r * 16];
const ZONE_TILES: [string, [number, number]][] = [
  ['wall_top', cell(1, 0)], ['wall_mid', cell(1, 1)], ['wall_mid_2', cell(0, 1)], ['wall_mid_3', cell(2, 1)],
  ['wall_hole_1', cell(2, 2)], ['wall_hole_2', cell(2, 3)],
  ['wall_banner_red', cell(0, 2)], ['wall_banner_blue', cell(1, 2)], ['wall_banner_green', cell(0, 3)], ['wall_banner_yellow', cell(1, 3)],
  ['wall_deco_1', cell(8, 1)], ['wall_deco_2', cell(9, 1)], ['wall_deco_3', cell(8, 2)], ['wall_deco_4', cell(4, 5)], ['wall_deco_5', cell(5, 5)],
  ['wall_eyes_anim_f0', cell(6, 3)], ['wall_eyes_anim_f1', cell(7, 3)],
  ['floor_1', cell(3, 6)], ['floor_2', cell(0, 4)], ['floor_3', cell(1, 4)], ['floor_4', cell(2, 4)], ['floor_5', cell(0, 5)],
  ['floor_6', cell(1, 5)], ['floor_7', cell(0, 6)], ['floor_8', cell(1, 6)], ['floor_trapdoor', cell(2, 6)],
  ['fountain_top', cell(3, 0)],
  ['fountain_lava_anim_f0', cell(3, 1)], ['fountain_lava_anim_f1', cell(4, 1)], ['fountain_lava_anim_f2', cell(5, 1)],
  ['fountain_lava_basin_anim_f0', cell(3, 2)], ['fountain_lava_basin_anim_f1', cell(4, 2)], ['fountain_lava_basin_anim_f2', cell(5, 2)],
  ['fountain_water_anim_f0', cell(3, 3)], ['fountain_water_anim_f1', cell(4, 3)], ['fountain_water_anim_f2', cell(5, 3)],
  ['fountain_water_basin_anim_f0', cell(3, 4)], ['fountain_water_basin_anim_f1', cell(4, 4)], ['fountain_water_basin_anim_f2', cell(5, 4)],
];
for (const [zone, file] of [['jungle', 'omnibo_jungledungeon - copia.png'], ['tomb', 'omnibo_dessert_dungeon.png']] as const) {
  const img = readPng(join(SRC, 'omniboy/custom-dungeon-tileset', file));
  for (const [name, [x, y]] of ZONE_TILES) add(`${zone}_${name}`, img, x, y);
  // Tall statues: take whatever is drawn in their columns.
  for (const [k, col] of [[1, 6], [2, 7]]) {
    const b = bbox(img, col * 16, 0, 16, 48);
    if (b) add(`${zone}_statue_${k}`, img, b.x, b.y, b.w, b.h);
  }
}

// Dark Dungeon: its cracked, older floors (a 4×5 block of 16px tiles).
{
  const img = readPng(join(SRC, 'DarkDungeon.png'));
  let n = 1;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) add(`crypt_floor_${n++}`, img, 16 + c * 16, 112 + r * 16);
}

// Enchanted Forest creatures: every frame cropped to the union box of that creature's
// frames, so the feet stay put while it animates.
{
  const dir = join(SRC, 'enchanted-forest/Enchanted Forest - Individual Frames/All');
  const groups = new Map<string, { anim: string; n: number; img: Image }[]>();
  for (const f of readdirSync(dir)) {
    const m = f.match(/^(.*)_(Idle \+ Walk|Idle|Walk|walk)_(\d+)\.png$/);
    if (!m) continue;
    const slug = 'ef_' + m[1].toLowerCase().replace(/[^a-z]+/g, '_');
    const list = groups.get(slug) ?? [];
    list.push({ anim: m[2].toLowerCase(), n: Number(m[3]), img: readPng(join(dir, f)) });
    groups.set(slug, list);
  }
  for (const [slug, frames] of groups) {
    let box: { x: number; y: number; x2: number; y2: number } | null = null;
    for (const f of frames) {
      const b = bbox(f.img);
      if (!b) continue;
      box = box ? { x: Math.min(box.x, b.x), y: Math.min(box.y, b.y), x2: Math.max(box.x2, b.x + b.w), y2: Math.max(box.y2, b.y + b.h) } : { x: b.x, y: b.y, x2: b.x + b.w, y2: b.y + b.h };
    }
    if (!box) continue;
    frames.sort((a, b) => a.n - b.n);
    for (const f of frames) {
      const kinds = f.anim === 'idle + walk' ? ['idle', 'run'] : f.anim === 'idle' ? ['idle'] : ['run'];
      for (const k of kinds) add(`${slug}_${k}_anim_f${f.n - 1}`, f.img, box.x, box.y, box.x2 - box.x, box.y2 - box.y);
    }
  }
}

// CR+ characters (AnriTool, CC0): three groups of 16px-wide cells (castle, sea, snow), one character per row,
// frames Idle1–4, Run1–4, Fall. Each character is cropped to the union of its frames so it stands still.
{
  const img = readPng(join(SRC, 'cr-tileset/Characters.png'));
  const rows: [number, number][] = [[36, 64], [77, 96], [105, 128], [133, 160], [167, 192], [198, 224], [237, 256], [265, 288], [296, 320]];
  const groups: [number, string[]][] = [
    [0, ['purple_knight', 'crimson_wraith', 'plague_crow', 'gold_knight', 'king', 'gourd', 'skeleton', 'blue_wraith', 'wizard']],
    [160, ['green_thief', 'pirate', 'pirate_captain', 'deckhand', 'skeleton_pirate', 'orc_pirate', 'slime']],
    [320, ['beanie_kid', 'elf', 'frost_skeleton', 'frost_imp', 'santa', 'nutcracker', 'gingerbread', 'snowman', 'ice_ghost']],
  ];
  for (const [gx, names] of groups) {
    names.forEach((name, r) => {
      const [y0, y1] = rows[r];
      let box: { x: number; y: number; x2: number; y2: number } | null = null;
      for (let k = 0; k < 8; k++) {
        const b = bbox(img, gx + k * 16, y0, 16, y1 - y0);
        if (!b) continue;
        const bx = b.x - (gx + k * 16);
        box = box ? { x: Math.min(box.x, bx), y: Math.min(box.y, b.y), x2: Math.max(box.x2, bx + b.w), y2: Math.max(box.y2, b.y + b.h) } : { x: bx, y: b.y, x2: bx + b.w, y2: b.y + b.h };
      }
      if (!box) return;
      for (let k = 0; k < 8; k++) add(`cr_${name}_${k < 4 ? 'idle' : 'run'}_anim_f${k % 4}`, img, gx + k * 16 + box.x, box.y, box.x2 - box.x, box.y2 - box.y);
    });
  }
}

// DungeonTileset II Sewers (0x72, bought): room tiles become `sewer_*`; the three creatures `sw_*`, each cropped to
// its frames' union. Its folder is gitignored, so on a new machine it has to be unzipped into assets-src by hand.
{
  const dir = join(SRC, '0x72_DungeonTilesetII_sewers_v0.3');
  if (!existsSync(dir)) throw new Error(`${dir} is missing: unzip the Sewers pack there (it's kept out of git)`);
  const high = readPng(join(dir, 'atlas_walls_high-16x32.png'));
  add('sewer_wall_mid', high, 27, 80);
  add('sewer_wall_mid_2', high, 37, 80);
  add('sewer_wall_top', high, 27, 107);
  const floor = readPng(join(dir, 'floor.png'));
  const tiles: [string, number, number][] = [
    ['floor_1', 0, 0], ['floor_2', 3, 4], ['floor_3', 4, 4], ['floor_drain', 5, 0], ['floor_grate', 1, 4],
    ['floor_spikes', 1, 0], ['floor_hatch', 2, 4], ['floor_stairs', 0, 4], ['floor_hole', 4, 2],
  ];
  for (const [name, c, r] of tiles) add(`sewer_${name}`, floor, c * 16, r * 16);
  const items = readPng(join(dir, 'items.png'));
  for (let k = 0; k < 3; k++) add(`sewer_sludgefall_anim_f${k}`, items, 176 + k * 16, 99, 16, 27);
  for (let k = 0; k < 5; k++) add(`sewer_flame_anim_f${k}`, items, 144 + k * 16, 35, 16, 28);
  add('sewer_pillar_1', items, 0, 144, 16, 48);
  add('sewer_pillar_2', items, 16, 144, 16, 48);
  add('sewer_bat_hanging_1', items, 0, 128, 16, 14);
  add('sewer_bat_hanging_2', items, 16, 128, 16, 14);
  add('sewer_pot_1', items, 38, 167, 20, 25);
  add('sewer_pot_2', items, 69, 167, 20, 25);
  add('sewer_pot_3', items, 101, 167, 20, 25);
  add('sewer_crate', items, 37, 132, 21, 28);
  add('sewer_crate_small', items, 65, 140, 14, 20);
  add('sewer_rock_1', items, 149, 2, 21, 12);
  add('sewer_rock_2', items, 180, 5, 21, 9);

  const creature = (slug: string, anims: [string, string[]][]) => {
    const all = anims.flatMap(([, files]) => files.map((f) => readPng(join(dir, 'frames', f))));
    let box: { x: number; y: number; x2: number; y2: number } | null = null;
    for (const img of all) {
      const b = bbox(img);
      if (!b) continue;
      box = box ? { x: Math.min(box.x, b.x), y: Math.min(box.y, b.y), x2: Math.max(box.x2, b.x + b.w), y2: Math.max(box.y2, b.y + b.h) } : { x: b.x, y: b.y, x2: b.x + b.w, y2: b.y + b.h };
    }
    let i = 0;
    for (const [anim, files] of anims) files.forEach((_, k) => add(`${slug}_${anim}_anim_f${k}`, all[i++], box!.x, box!.y, box!.x2 - box!.x, box!.y2 - box!.y));
  };
  const frames = (base: string, n: number, sep = '_f') => Array.from({ length: n }, (_, k) => `${base}${sep}${k + 1}.png`);
  creature('sw_bat', [['idle', frames('bat', 4)]]);
  creature('sw_slugbot', [['idle', frames('slugbot_idle', 4)], ['run', frames('slugbot_walk', 8)]]);
  creature('sw_tentacle', [['idle', frames('tentacle', 8, '-f')]]);
}

// Pixel Art Spells (DevWizard, CC0): horizontal strips of 16px frames.
{
  const dir = join(SRC, 'pixelart-spells/Pixelart Spells/PNG Files');
  for (const [file, name] of [['Fireball.png', 'fireball'], ['Darkness Bolt.png', 'darkness_bolt'], ['Magic Orb.png', 'magic_orb'], ['Ice Lance.png', 'ice_lance'], ['Light Bolt.png', 'light_bolt']]) {
    const img = readPng(join(dir, file));
    for (let k = 0; k < img.w / 16; k++) add(`spell_${name}_anim_f${k}`, img, k * 16, 0);
  }
}

// ---------- pack ----------

const base = readPng('assets-src/0x72_DungeonTilesetII_v1.7/0x72_DungeonTilesetII_v1.7/0x72_DungeonTilesetII_v1.7.png');
const baseList = readFileSync('assets-src/0x72_DungeonTilesetII_v1.7/0x72_DungeonTilesetII_v1.7/tile_list_v1.7', 'utf8').trim().split('\n');
const W = 512;
const PAD = 1;
// Shelf packing below the base sheet, tallest first. Identical source regions share a slot.
const placed: { p: Piece; x: number; y: number }[] = [];
let sx = 0;
let sy = base.h + PAD;
let shelf = 0;
for (const p of [...pieces].sort((a, b) => b.h - a.h || b.w - a.w)) {
  const same = placed.find((q) => q.p.img === p.img && q.p.x === p.x && q.p.y === p.y && q.p.w === p.w && q.p.h === p.h);
  if (same) {
    placed.push({ p, x: same.x, y: same.y });
    continue;
  }
  if (sx + p.w > W) {
    sx = 0;
    sy += shelf + PAD;
    shelf = 0;
  }
  placed.push({ p, x: sx, y: sy });
  sx += p.w + PAD;
  shelf = Math.max(shelf, p.h);
}
const H = Math.ceil((sy + shelf + PAD) / 16) * 16;
const out: Image = { w: W, h: H, data: new Uint8Array(W * H * 4) };
for (let y = 0; y < base.h; y++) out.data.set(base.data.subarray(y * base.w * 4, (y + 1) * base.w * 4), y * W * 4);
for (const { p, x, y } of placed) {
  for (let r = 0; r < p.h; r++) {
    const src = ((p.y + r) * p.img.w + p.x) * 4;
    out.data.set(p.img.data.subarray(src, src + p.w * 4), ((y + r) * W + x) * 4);
  }
}
writePng('public/assets/sprites/atlas.png', out);
const lines = [...baseList, ...placed.map(({ p, x, y }) => `${p.name} ${x} ${y} ${p.w} ${p.h}`)];
writeFileSync('public/assets/sprites/atlas.txt', lines.join('\n') + '\n');
console.log(`atlas ${W}×${H}: ${baseList.length} base sprites + ${placed.length} new`);
