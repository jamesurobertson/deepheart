/** Controller support. Menus and windows: the d-pad or left stick moves a focus ring, A presses, B backs out. In play:
 *  A attacks (hold it), the d-pad walks, X Y LB RB use abilities 1–4, and Back switches the d-pad to menu mode for
 *  hiring, skills and ascending. Start is Escape. */
const REACH = 'button:not([disabled]), a[href], [tabindex="0"], input:not([disabled])';
const DEAD_ZONE = 0.5;
const REPEAT_MS = 220;
const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const;
type Dir = keyof typeof ARROWS;

const press = (key: string, code: string, down: boolean) =>
  document.body.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, code, bubbles: true, cancelable: true }));

/** The nearest visible control in a direction, by distance along that direction with a penalty for drifting off it. */
function neighbor(from: HTMLElement | null, dir: Dir, scope: ParentNode): HTMLElement | null {
  const items = [...scope.querySelectorAll<HTMLElement>(REACH)].filter((el) => {
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && !el.closest('[hidden]') && !el.matches('canvas');
  });
  if (!from || !items.includes(from)) return items[0] ?? null;
  const origin = from.getBoundingClientRect();
  const [ox, oy] = [origin.left + origin.width / 2, origin.top + origin.height / 2];
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === from) continue;
    const box = el.getBoundingClientRect();
    const dx = box.left + box.width / 2 - ox;
    const dy = box.top + box.height / 2 - oy;
    const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
    const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    if (along <= 1) continue;
    const score = along + across * 2;
    if (score < bestScore) [best, bestScore] = [el, score];
  }
  return best;
}

export function installGamepad() {
  if (!navigator.getGamepads) return;
  let menuMode = false;
  let held = new Set<string>();
  let heldDir: Dir | null = null;
  let walking: Dir | null = null;
  let repeatAt = 0;

  const navigating = () => menuMode || !!document.querySelector('.modal-wrap:not([hidden]), .title-menu');
  const scope = (): ParentNode => document.querySelector('.modal-wrap:not([hidden])') ?? document.querySelector('.title-menu') ?? document;
  const setMenuMode = (on: boolean) => {
    menuMode = on;
    document.body.classList.toggle('pad-nav', on);
    if (!on) (document.activeElement as HTMLElement | null)?.blur();
  };
  const move = (dir: Dir) => {
    const next = neighbor(document.activeElement as HTMLElement | null, dir, scope());
    next?.focus({ preventScroll: false });
  };

  const poll = (now: number) => {
    const pad = [...navigator.getGamepads()].find((p) => p?.connected);
    if (pad) {
      document.body.classList.add('pad-on');
      const down = new Set<string>();
      pad.buttons.forEach((b, i) => b.pressed && down.add(`b${i}`));
      const [x, y] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0];
      const dir: Dir | null = down.has('b12') ? 'up' : down.has('b13') ? 'down' : down.has('b14') ? 'left' : down.has('b15') ? 'right'
        : Math.abs(x) < DEAD_ZONE && Math.abs(y) < DEAD_ZONE ? null : Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
      const fresh = (id: string) => down.has(id) && !held.has(id);
      const nav = navigating();
      const modalOpen = !!document.querySelector('.modal-wrap:not([hidden])');

      if (nav) {
        if (walking) { press(ARROWS[walking], ARROWS[walking], false); walking = null; }
        if (held.has('b0') && !down.has('b0')) press(' ', 'Space', false);
        if (dir && (dir !== heldDir || now >= repeatAt)) {
          move(dir);
          repeatAt = now + REPEAT_MS;
        }
        if (fresh('b0')) (document.activeElement as HTMLElement | null)?.click();
        if (fresh('b1')) modalOpen || !menuMode ? (press('Escape', 'Escape', true), press('Escape', 'Escape', false)) : setMenuMode(false);
      } else {
        if (dir !== walking) {
          if (walking) press(ARROWS[walking], ARROWS[walking], false);
          if (dir) press(ARROWS[dir], ARROWS[dir], true);
          walking = dir;
        }
        if (fresh('b0')) press(' ', 'Space', true);
        if (held.has('b0') && !down.has('b0')) press(' ', 'Space', false);
        ['b2', 'b3', 'b4', 'b5'].forEach((id, i) => fresh(id) && press(String(i + 1), `Digit${i + 1}`, true));
      }
      if (fresh('b8') && !modalOpen) setMenuMode(!menuMode);
      if (fresh('b9')) (press('Escape', 'Escape', true), press('Escape', 'Escape', false));
      heldDir = dir;
      held = down;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
