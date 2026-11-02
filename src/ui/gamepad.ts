/** Controller support, played like a mouse. The left stick moves a cursor (your hero follows it, as it follows the mouse)
 *  and A clicks: a swing over the dungeon, a press over a button. The right stick picks a companion in your party, RT
 *  levels it and X buys its next upgrade; LB and RB change how many levels a buy is. The d-pad and Y use abilities.
 *  B backs out, Menu opens Options and View opens Ascend. In a window or on the title screen the d-pad steps between
 *  buttons; in the Keep it walks. Button names follow the kind of controller (Xbox, PlayStation, Nintendo). */
const REACH = 'button:not([disabled]), a[href], [tabindex="0"], input:not([disabled])';
const DEAD_ZONE = 0.18;
/** Cursor speed at full tilt, in CSS pixels a second, and how much it slows over something you can press. */
const CURSOR_SPEED = 1100;
const STICKY = 0.4;
const REPEAT_MS = 220;
/** How often a held RT buys again. */
const BUY_REPEAT_MS = 160;
const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const;
type Dir = keyof typeof ARROWS;
/** The ability each d-pad direction uses (its number key), and with LT held. Y is Rampage (2). */
const DPAD_ABILITY: Record<Dir, string> = { up: '1', right: '3', down: '4', left: '5' };
const DPAD_ABILITY_LT: Partial<Record<Dir, string>> = { up: '6' };

type Family = 'xbox' | 'ps' | 'nintendo';
/** What each button is called on each kind of controller (standard layout: A bottom, B right, X left, Y top). */
const GLYPHS: Record<Family, Record<string, string>> = {
  xbox: { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', view: 'View', menu: 'Menu' },
  ps: { a: '✕', b: '○', x: '□', y: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', view: 'Create', menu: 'Options' },
  nintendo: { a: 'B', b: 'A', x: 'Y', y: 'X', lb: 'L', rb: 'R', lt: 'ZL', rt: 'ZR', view: '−', menu: '+' },
};

/** Which kind of controller this is, from the id the browser gives it (it carries the maker's USB vendor id). */
function familyOf(pad: Gamepad): Family {
  const id = pad.id.toLowerCase();
  if (/054c|playstation|dualsense|dualshock/.test(id)) return 'ps';
  if (/057e|nintendo|pro controller|joy-con/.test(id)) return 'nintendo';
  return 'xbox';
}

const press = (key: string, code: string, down: boolean) =>
  document.body.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, code, bubbles: true, cancelable: true }));
const tap = (key: string, code = key) => (press(key, code, true), press(key, code, false));

/** A mouse event at the cursor, sent to whatever is under it (the game listens for these as it does for a mouse). */
function pointer(type: 'pointermove' | 'pointerdown' | 'pointerup', x: number, y: number) {
  const target = document.elementFromPoint(x, y) ?? document.body;
  target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  return target;
}

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
  const cursor = document.createElement('div');
  cursor.className = 'pad-cursor';
  cursor.hidden = true;
  document.body.appendChild(cursor);
  const prompt = document.createElement('div');
  prompt.className = 'pad-prompt';
  prompt.hidden = true;
  document.body.appendChild(prompt);

  let family: Family | null = null;
  let held = new Set<string>();
  let heldDir: Dir | null = null;
  let walking: Dir | null = null;
  let repeatAt = 0;
  let buyAt = 0;
  let last = 0;
  const at = { x: innerWidth * 0.35, y: innerHeight * 0.55 };
  let aiming: 'cursor' | 'focus' = 'cursor';
  let downOn: Element | null = null;
  let picked = 0;
  let stickAt = 0;

  const modalOpen = () => !!document.querySelector('.modal-wrap:not([hidden])');
  const titleOpen = () => !!document.querySelector('.title-menu');
  const inKeep = () => document.body.classList.contains('in-keep');
  const scope = (): ParentNode => document.querySelector('.modal-wrap:not([hidden])') ?? document.querySelector('.title-menu') ?? document;
  const rows = () => [...document.querySelectorAll<HTMLElement>('.gens .gen[data-comp]')].filter((r) => !r.hidden && r.offsetParent);
  const click = (el: Element | null) => el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

  const setFamily = (f: Family | null) => {
    if (f === family) return;
    family = f;
    document.body.classList.toggle('pad-on', !!f);
    if (f) {
      document.body.dataset.pad = f;
      // Glyphs for the CSS badges (ability squares, the hire modes, the dock, a window's close).
      for (const [k, v] of Object.entries(GLYPHS[f])) document.body.style.setProperty(`--pad-${k}`, `"${v}"`);
    } else delete document.body.dataset.pad;
  };

  /** Your party's picked row: outlined, kept in view, with its buttons beside it. */
  const showPick = () => {
    const list = rows();
    document.querySelectorAll('.gen.pad-pick').forEach((r) => r.classList.remove('pad-pick'));
    const show = !!family && !modalOpen() && !titleOpen() && list.length > 0;
    prompt.hidden = !show;
    if (!show || !family) return;
    picked = Math.max(0, Math.min(list.length - 1, picked));
    const row = list[picked];
    row.classList.add('pad-pick');
    const box = row.getBoundingClientRect();
    const g = GLYPHS[family];
    const html = `<span><kbd>${g.rt}</kbd>Level</span><span><kbd>${g.x}</kbd>Upgrade</span>`;
    if (prompt.innerHTML !== html) prompt.innerHTML = html;
    // (Just left of the row, over the dungeon's edge, so it covers no other row.)
    prompt.style.transform = `translate(${Math.round(box.left - prompt.offsetWidth - 8)}px, ${Math.round(box.top + (box.height - prompt.offsetHeight) / 2)}px)`;
  };

  const poll = (now: number) => {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    const pad = [...navigator.getGamepads()].find((p) => p?.connected) ?? null;
    if (!pad) {
      setFamily(null);
      cursor.hidden = true;
      prompt.hidden = true;
      requestAnimationFrame(poll);
      return;
    }
    setFamily(familyOf(pad));
    const down = new Set<string>();
    pad.buttons.forEach((b, i) => (b.pressed || b.value > 0.5) && down.add(`b${i}`));
    const fresh = (id: string) => down.has(id) && !held.has(id);
    const letGo = (id: string) => held.has(id) && !down.has(id);
    const dpad: Dir | null = down.has('b12') ? 'up' : down.has('b13') ? 'down' : down.has('b14') ? 'left' : down.has('b15') ? 'right' : null;
    const [lx, ly, , ry] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0, pad.axes[2] ?? 0, pad.axes[3] ?? 0];
    const modal = modalOpen();
    const title = titleOpen();
    const nav = modal || title;

    // Left stick: the cursor. A little slower over anything you can press, so it's easy to land on.
    const tilt = Math.hypot(lx, ly);
    if (tilt > DEAD_ZONE) {
      const over = document.elementFromPoint(at.x, at.y)?.closest(REACH);
      const speed = CURSOR_SPEED * ((tilt - DEAD_ZONE) / (1 - DEAD_ZONE)) ** 1.6 * (over ? STICKY : 1);
      at.x = Math.max(0, Math.min(innerWidth - 1, at.x + (lx / tilt) * speed * dt));
      at.y = Math.max(0, Math.min(innerHeight - 1, at.y + (ly / tilt) * speed * dt));
      aiming = 'cursor';
      (document.activeElement as HTMLElement | null)?.blur?.();
      pointer('pointermove', at.x, at.y);
    }
    // The game's own sword shows over the dungeon; elsewhere this arrow does.
    const blade = document.querySelector<HTMLElement>('.blade');
    cursor.hidden = aiming !== 'cursor' || (!!blade && !blade.hidden);
    cursor.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;

    // A: a click, at the cursor or on the button the d-pad picked.
    if (fresh('b0')) {
      const focused = document.activeElement as HTMLElement | null;
      if (aiming === 'focus' && focused && focused !== document.body) click(focused);
      else if (inKeep() && !nav && !document.elementFromPoint(at.x, at.y)?.closest('#ui button, #ui .shop, #ui .dock, .keep-label')) press(' ', 'Space', true);
      else downOn = pointer('pointerdown', at.x, at.y);
    }
    if (letGo('b0')) {
      if (downOn) {
        const upOn = pointer('pointerup', at.x, at.y);
        if (upOn === downOn || downOn.contains(upOn)) click(upOn);
        downOn = null;
      }
      press(' ', 'Space', false);
    }

    // D-pad: steps between buttons in a window or on the title screen; walks in the Keep; uses abilities in the dungeon.
    if (walking && (nav || !inKeep() || dpad !== walking)) {
      press(ARROWS[walking], ARROWS[walking], false);
      walking = null;
    }
    if (nav) {
      if (dpad && (dpad !== heldDir || now >= repeatAt)) {
        neighbor(document.activeElement as HTMLElement | null, dpad, scope())?.focus({ preventScroll: false });
        aiming = 'focus';
        repeatAt = now + REPEAT_MS;
      }
    } else if (inKeep()) {
      if (dpad && dpad !== walking) {
        press(ARROWS[dpad], ARROWS[dpad], true);
        walking = dpad;
      }
    } else if (dpad && dpad !== heldDir) {
      const key = down.has('b6') ? DPAD_ABILITY_LT[dpad] : DPAD_ABILITY[dpad];
      if (key) tap(key, `Digit${key}`);
    }
    if (!nav && !inKeep() && fresh('b3')) tap('2', 'Digit2');

    // Your party, always at hand (not under a window): the right stick picks, RT levels, X upgrades, LB and RB the amount.
    if (!nav) {
      const list = rows();
      if (Math.abs(ry) > 0.5 && now >= stickAt) {
        picked += ry > 0 ? 1 : -1;
        stickAt = now + (Math.abs(ry) > 0.9 ? 90 : 170);
        picked = Math.max(0, Math.min(list.length - 1, picked));
        list[picked]?.scrollIntoView({ block: 'nearest' });
      } else if (Math.abs(ry) <= 0.5) stickAt = 0;
      const row = list[picked];
      if (row && down.has('b7') && now >= buyAt) {
        click(row);
        buyAt = now + (fresh('b7') ? BUY_REPEAT_MS * 2.5 : BUY_REPEAT_MS);
      }
      if (row && fresh('b2')) click(row.querySelector('.trait[data-trait]'));
      if (fresh('b4') || fresh('b5')) {
        const modes = [...document.querySelectorAll<HTMLElement>('.modes .mode')];
        const on = Math.max(0, modes.findIndex((m) => m.classList.contains('on')));
        click(modes[(on + (fresh('b5') ? 1 : modes.length - 1)) % modes.length]);
      }
    }
    showPick();

    // B backs out; Menu opens Options; View opens Ascend (either closes the window it opened).
    if (fresh('b1')) tap('Escape');
    if (fresh('b9')) modal ? tap('Escape') : click(document.querySelector('[data-open="settings"]'));
    if (fresh('b8')) modal ? tap('Escape') : click(document.querySelector('[data-open="abyss"]'));

    heldDir = dpad;
    held = down;
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
