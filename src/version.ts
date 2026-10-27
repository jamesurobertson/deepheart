/** The game's version, the same as the desktop release's tag (bump both together). */
export const GAME_VERSION = '0.10.0';

/** Saves from before this version start over: 0.10 rebuilt the companions, their prices and the climb past 400. */
export const FRESH_FROM = '0.10.0';

/** A save last played before FRESH_FROM (or before saves were stamped). */
export function beforeFresh(saved: string | undefined) {
  if (!saved) return true;
  const a = saved.split('.').map(Number);
  const b = FRESH_FROM.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}

/** A save last played on an earlier minor version (or before saves were stamped): worth a fresh start. */
export function olderVersion(saved: string | undefined) {
  if (!saved) return true;
  const [a, b] = saved.split('.').map(Number);
  const [x, y] = GAME_VERSION.split('.').map(Number);
  return a < x || (a === x && b < y);
}
