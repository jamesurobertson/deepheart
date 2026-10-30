/** Koko, the Keep's cat, as she sits on jamesurobertson.github.io: '#' fur, 'o' eyes. Her tail is drawn on its own. */
export const KOKO_ROWS = ['#...#....', '##.##....', '#####....', '#o#o#....', '#####....', '.###.....', '#####....', '######...', '#######..', '#######..'];
export const KOKO_FUR = '#4e4762';
export const KOKO_EYE = '#f2c14e';
/** Her tail at rest: along the floor from her back, then straight up. */
export const KOKO_TAIL: [number, number][] = [[7, 9], [8, 9], [9, 9], ...Array.from({ length: 8 }, (_, k): [number, number] => [10, 8 - k])];

/** Koko as an icon `box` pixels across at most, in whole pixels. */
export function kokoSvg(box: number): string {
  const scale = Math.max(1, Math.floor(box / 11));
  const fur: [number, number][] = [...KOKO_TAIL], eyes: [number, number][] = [];
  KOKO_ROWS.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' ? fur.push([x, y]) : ch === 'o' && eyes.push([x, y])));
  const path = (px: [number, number][]) => px.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('');
  return `<svg class="glyph" viewBox="0 0 11 10" width="${11 * scale}" height="${10 * scale}" shape-rendering="crispEdges" aria-hidden="true"><path fill="${KOKO_FUR}" d="${path(fur)}"/><path fill="${KOKO_EYE}" d="${path(eyes)}"/></svg>`;
}
