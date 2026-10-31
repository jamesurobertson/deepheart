/** The game's version, the same as the desktop release's tag (bump both together). */
export const GAME_VERSION = '0.11.2';

/** A save last played on an earlier minor version (or before saves were stamped): it starts over. Minor versions are
 *  the ones that change the game enough to; patches carry saves on. */
export function olderVersion(saved: string | undefined) {
  if (!saved) return true;
  const [a, b] = saved.split('.').map(Number);
  const [x, y] = GAME_VERSION.split('.').map(Number);
  return a < x || (a === x && b < y);
}
