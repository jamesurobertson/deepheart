/**
 * Packs every sprite the game uses into one sheet: the 0x72 DungeonTileset II atlas plus
 * the CC0 add-on packs in assets-src (zone tilesets, Enchanted Forest and CR+ creatures, the Sewers, DevWizard's spells,
 * Superdark's Samurai and Fantasy RPG characters, RancidMilk's Homage).
 *
 *   node scripts/build-atlas.ts
 *
 * Writes public/assets/sprites/atlas.png and atlas.txt ("name x y w h" per line, the same
 * format as the original tile list, so animations stay `${base}_anim_f${n}`).
 * Dependency-free (PNGs through scripts/png.ts).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Image, readPng, writePng } from './png.ts';

/** Tight box around the opaque pixels of a region (from `alpha` up). */
function bbox(img: Image, x0 = 0, y0 = 0, w = img.w, h = img.h, alpha = 1) {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (img.data[(y * img.w + x) * 4 + 3] >= alpha) {
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
  // Tall statues: what's drawn in their columns, down to the foot of the statue (the sheet has a floor tile under one
  // and a soft shadow under the other, which made them look like they float).
  for (const [k, col] of [[1, 6], [2, 7]]) {
    const b = bbox(img, col * 16, 0, 16, 34, 128);
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

/** Union of the drawn pixels of several frames (each a w×h cell at its own x), so a character stands still as it animates. */
function unionBox(cells: { img: Image; x: number; y: number; w: number; h: number }[]) {
  let box: { x: number; y: number; x2: number; y2: number } | null = null;
  for (const c of cells) {
    const b = bbox(c.img, c.x, c.y, c.w, c.h);
    if (!b) continue;
    const bx = b.x - c.x, by = b.y - c.y;
    box = box ? { x: Math.min(box.x, bx), y: Math.min(box.y, by), x2: Math.max(box.x2, bx + b.w), y2: Math.max(box.y2, by + b.h) } : { x: bx, y: by, x2: bx + b.w, y2: by + b.h };
  }
  return box;
}
/** A character from separate frame images or strip cells: `slug_idle_anim_f*` and `slug_run_anim_f*`. */
function character(slug: string, anims: [string, { img: Image; x: number; y: number; w: number; h: number }[]][]) {
  const box = unionBox(anims.flatMap(([, cells]) => cells));
  if (!box) throw new Error(`${slug}: no pixels`);
  for (const [anim, cells] of anims) cells.forEach((c, k) => add(`${slug}_${anim}_anim_f${k}`, c.img, c.x + box.x, c.y + box.y, box.x2 - box.x, box.y2 - box.y));
}
const whole = (img: Image) => ({ img, x: 0, y: 0, w: img.w, h: img.h });
const byNumber = (a: string, b: string) => Number(a.match(/(\d+)\.png$/)![1]) - Number(b.match(/(\d+)\.png$/)![1]);

// Superdark's Fantasy Samurai (bought) and Fantasy RPG Characters, and RancidMilk's Homage to 0x72: CC0 add-ons in
// 0x72's style. Only the characters the game uses: Legends, companions, monsters and Pip.
{
  // Bought, so like the Sewers it's kept out of git: unzip it into assets-src/samurai by hand on a new machine.
  const dir = join(SRC, 'samurai/Final');
  if (!existsSync(dir)) throw new Error(`${dir} is missing: unzip the Fantasy Samurai pack there (it's kept out of git)`);
  const files = readdirSync(dir);
  for (const name of ['oldman', 'large_oni_red', 'sohei', 'large_samurai', 'merchant', 'kabuki', 'geisha', 'tengu', 'oni_king', 'samurai', 'oni_blue', 'large_oni_blue', 'oni_red']) {
    const frames = (anim: string) => files.filter((f) => f.startsWith(`${name}_${anim}_`)).sort(byNumber).map((f) => whole(readPng(join(dir, f))));
    character(`sm_${name}`, [['idle', frames('idle')], ['run', frames('walk')]]);
  }
}
{
  const dir = join(SRC, 'fantasy-npcs/Fantasy RPG NPCs - Individuel Frames');
  for (const folder of ['Executioner', 'Mountain King', 'Merchant', 'Magic Shopkeeper', 'Bishop', 'Butcher', 'Princess', 'King', 'Knight - Elite', 'Knight - Heavy']) {
    const files = readdirSync(join(dir, folder)).filter((f) => f.endsWith('.png')).sort(byNumber);
    const read = (re: RegExp) => files.filter((f) => re.test(f)).map((f) => whole(readPng(join(dir, folder, f))));
    const both = read(/_Idle \+ Walk_/);
    const slug = 'sd_' + folder.toLowerCase().replace(/[^a-z]+/g, '_');
    character(slug, both.length ? [['idle', both], ['run', both]] : [['idle', read(/_Idle_/)], ['run', read(/_Walk_/)]]);
  }
}
{
  const dir = join(SRC, 'homage/SpriteSheets');
  const strip = (file: string) => {
    const img = readPng(join(dir, file));
    return Array.from({ length: img.w / 28 }, (_, k) => ({ img, x: k * 28, y: 0, w: 28, h: img.h }));
  };
  character('rm_dracula', [['idle', strip('DraculaIdle.png')], ['run', strip('DraculaRun.png')]]);
  character('rm_zombie', [['idle', strip('ZombieIdle1.png')], ['run', strip('ZombieRun.png')]]);
  character('rm_rocker', [['idle', strip('TShirtDudeIdle.png')], ['run', strip('TShirtDudeRun.png')]]);
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
