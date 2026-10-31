import type { AbilityId } from '../game/data.ts';
import { spriteFit } from './px.ts';

/** The skill icons: 9×9 pixel art (one letter per color, '.' empty), drawn with a dark outline around it. */
const INK = '#1a0f0c';
const PALETTES: Record<string, Record<string, string>> = {
  steel: { a: '#b8c4cc', b: '#f4f8fa', d: '#9a5f30' },
  purple: { a: '#b98cff', b: '#f1e6ff', c: '#7048c8', d: '#4a2f8a', g: '#c9b0ff', h: '#9a72e6' },
  flame: { a: '#e8433a', b: '#ff9a2a', c: '#ffe08a' },
  teal: { a: '#5ad8e6', c: '#2a9ab0' },
  trail: { b: '#ffffff', g: '#b8b0a8', c: '#6e6460', k: '#1a0f0c' },
  chest: { a: '#6a3e1e', b: '#b07040', c: '#f2c14e', e: '#fff2a8' },
  drum: { a: '#c8432a', b: '#f4e0c0', c: '#9a5f30', d: '#f2c14e' },
};
const ART: Record<Exclude<AbilityId, 'crit' | 'rampage'>, [string, string[]]> = {
  blade: ['purple', ['.......bb', '......bab', '.....bab.', '....bab..', '.c.bab...', '..cab....', '..cc.....', '.c..c....', 'c........']],
  // Two Phantom Blades crossed, the one behind a shade darker.
  legion: ['purple', ['gg.....bb', 'ghg...bab', '.ghg.bab.', '..ghbab..', '.c.bab.d.', '..cabhd..', '..cc.dd..', '.c..c..d.', 'c.......d']],
  // A cursor and two fading copies behind it, like an old mouse trail.
  flurry: ['trail', ['c.g.b....', 'ckgkbb...', 'ckgkbbb..', 'ckgkbbbb.', 'ckgkbbbbb', 'ckgkbbb..', 'c.gkbkbb.', '...c.g.b.']],
  cleave: ['steel', ['b...d...b', 'ba..d..ab', 'baaadaaab', 'baaadaaab', 'ba..d..ab', 'b...d...b', '....d....', '....d....', '....d....']],
  treasure: ['chest', ['.aaaaaaa.', 'abbbbbbba', 'abbbbbbba', 'ccccecccc', 'aaaaeaaaa', 'abbbbbbba', 'abbbbbbba', 'aaaaaaaaa']],
  drums: ['drum', ['c.......c', '.c.....c.', '..aaaaa..', '.abbbbba.', '.adadada.', '.aadadaa.', '.aaaaaaa.', '..aaaaa..']],
};

const drawn = new Map<string, string>();
/** Skills drawn with a sprite from the sheet instead (the same as their trophies). */
const SPRITE_SKILLS: Partial<Record<AbilityId, string>> = { crit: 'weapon_katana', rampage: 'flask_big_red' };

/** A skill's icon as crisp SVG, `size` pixels square (22 is 2×, 33 is 3×). */
export function skillIcon(id: AbilityId, size = 22, cls = ''): string {
  const sprite = SPRITE_SKILLS[id];
  if (sprite) return spriteFit(sprite, size, `icon ${cls}`);
  const key = `${id}|${size}|${cls}`;
  const hit = drawn.get(key);
  if (hit) return hit;
  const [palette, rows] = ART[id as keyof typeof ART];
  const colors = PALETTES[palette];
  const w = Math.max(...rows.map((row) => row.length));
  const ox = 1 + Math.floor((9 - w) / 2), oy = 1 + Math.floor((9 - rows.length) / 2);
  const grid: (string | null)[][] = Array.from({ length: 11 }, () => Array(11).fill(null));
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (colors[ch]) grid[oy + y][ox + x] = colors[ch]; }));
  let rects = '';
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
    const fill = grid[y][x] ?? ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy]?.[x + dx]) ? INK : null);
    if (fill) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
  }
  const svg = `<svg class="icon ${cls}" viewBox="0 0 11 11" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  drawn.set(key, svg);
  return svg;
}
