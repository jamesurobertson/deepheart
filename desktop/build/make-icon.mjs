// Draws build/icon.png (1024²): the Deepheart pixel heart on a dark tile, inside the macOS icon grid's 824px body.
//   node build/make-icon.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
const S = 1024;
const px = Buffer.alloc(S * S * 4);
const set = (x, y, [r, g, b, a = 255]) => { const i = (y * S + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const body = { x: 100, y: 100, size: 824, radius: 180 };
const inTile = (x, y, inset = 0) => {
  const x0 = body.x + inset, y0 = body.y + inset, x1 = body.x + body.size - inset, y1 = body.y + body.size - inset, r = body.radius - inset;
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  if (!inTile(x, y)) continue;
  // Gold rim, then the dark face with a soft glow behind the heart.
  if (!inTile(x, y, 18)) { set(x, y, hex('#8a6a3a')); continue; }
  const d = Math.hypot(x - 512, y - 500) / 420;
  const glow = Math.max(0, 1 - d) ** 2;
  const base = hex('#1a1020'), warm = hex('#4a1830');
  set(x, y, base.map((v, k) => Math.round(v + (warm[k] - v) * glow)));
}
const heart = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const cell = 80, hx = 512 - (7 * cell) / 2, hy = 500 - (6 * cell) / 2;
heart.forEach((row, cy) => [...row].forEach((ch, cx) => {
  if (ch !== '#') return;
  const color = hex((cx === 1 && cy === 1) || (cx === 2 && cy === 0) ? '#ffb3c4' : '#ff5a7e');
  for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) set(hx + cx * cell + x, hy + cy * cell + y, color);
}));
writeFileSync('build/icon.rgba', px);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${S}x${S}`, '-i', 'build/icon.rgba', 'build/icon.png']);
unlinkSync('build/icon.rgba');
console.log('build/icon.png');
