/** Controller support, played like a mouse. The left stick moves a cursor (your hero follows it, as it follows the mouse)
 *  and A clicks: a swing over the dungeon, a press over a button. The right stick picks a companion in your party, RT
 *  levels it and X buys its next upgrade; LB and RB change how many levels a buy is. The d-pad and Y use abilities.
 *  B backs out, Menu opens Options and View opens Ascend. In a window or on the title screen the d-pad steps between
 *  buttons; in the Keep it walks. Prompts show the controller's own buttons (Kenney's Input Prompts, by kind of pad)
 *  while it's the last thing used; the mouse or keyboard puts the usual words back. */
const REACH = 'button:not([disabled]), a[href], [tabindex="0"], input:not([disabled])';
const DEAD_ZONE = 0.18;
/** The cursor at full tilt crosses the window's height in this many seconds (at the default speed); it starts at
 *  CURSOR_START of that and reaches it after CURSOR_RAMP seconds held, and slows to STICKY over anything you can press. */
const CURSOR_CROSS = 1.4;
const CURSOR_START = 0.35;
const CURSOR_RAMP = 0.4;
const STICKY = 0.45;
const REPEAT_MS = 220;
/** How often a held RT buys again. */
const BUY_REPEAT_MS = 160;
const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const;
type Dir = keyof typeof ARROWS;
/** The ability each d-pad direction uses (its number key), and with LT held. Y is Rampage (2). */
const DPAD_ABILITY: Record<Dir, string> = { up: '1', right: '3', down: '4', left: '5' };
const DPAD_ABILITY_LT: Partial<Record<Dir, string>> = { up: '6' };
/** Each ability's button(s), for its prompt. */
export const ABILITY_PAD: Record<string, string[]> = { flurry: ['up'], cleave: ['right'], treasure: ['down'], drums: ['left'], rampage: ['y'], legion: ['lt', 'up'] };

export type PadFamily = 'xbox' | 'ps' | 'switch';
/** The controller's cursor speed, 0 to 1 (set from Options). */
export const padTuning = { speed: 0.5 };

let family: PadFamily | null = null;
/** The controller in use, while it's the last thing you touched (null with the mouse, keyboard or touch). */
export const padFamily = () => family;

/** A controller button's picture: a, b, x, y, lb, rb, lt, rt, up, down, left, right, ls, rs, menu, view. */
export function padGlyph(key: string, size = 22, cls = ''): string {
  if (!family) return '';
  return `<img class="pad-g ${cls}" src="${import.meta.env.BASE_URL}assets/prompts/${family}/${key}.png" width="${size}" height="${size}" alt="" draggable="false">`;
}

/** Which kind of controller this is, from the id the browser gives it (it carries the maker's USB vendor id). */
function familyOf(pad: Gamepad): PadFamily {
  const id = pad.id.toLowerCase();
  if (/054c|playstation|dualsense|dualshock/.test(id)) return 'ps';
  if (/057e|nintendo|pro controller|joy-con/.test(id)) return 'switch';
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

/** Runs when the controller starts or stops being the thing in use (so prompts can change their words). */
export const padHooks = { change: () => {} };

export function installGamepad() {
  if (!navigator.getGamepads) return;
  const cursor = document.createElement('div');
  cursor.className = 'pad-cursor';
  cursor.hidden = true;
  document.body.appendChild(cursor);
  const bar = document.createElement('div');
  bar.className = 'pad-bar';
  bar.hidden = true;
  document.body.appendChild(bar);

  let connected: PadFamily | null = null;
  let held = new Set<string>();
  let heldDir: Dir | null = null;
  let walking: Dir | null = null;
  let repeatAt = 0;
  let buyAt = 0;
  let last = 0;
  let tiltFor = 0;
  const at = { x: innerWidth * 0.35, y: innerHeight * 0.55 };
  let aiming: 'cursor' | 'focus' = 'cursor';
  let downOn: Element | null = null;
  let picked = 0;
  let stickAt = 0;
  let barKey = '';

  const modalOpen = () => !!document.querySelector('.modal-wrap:not([hidden])');
  const titleOpen = () => !!document.querySelector('.title-menu');
  const inKeep = () => document.body.classList.contains('in-keep');
  const scope = (): ParentNode => document.querySelector('.modal-wrap:not([hidden])') ?? document.querySelector('.title-menu') ?? document;
  const rows = () => [...document.querySelectorAll<HTMLElement>('.gens .gen[data-comp]')].filter((r) => !r.hidden && r.offsetParent);
  const click = (el: Element | null) => el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

  /** The controller becomes (or stops being) the thing in use: its pictures go on (or come off) the abilities and the
   *  buy amounts, and the words elsewhere follow. */
  const use = (f: PadFamily | null) => {
    if (f === family) return;
    family = f;
    document.body.classList.toggle('pad-on', !!f);
    if (f) document.body.dataset.pad = f;
    else delete document.body.dataset.pad;
    document.querySelectorAll('.pad-fixed').forEach((g) => g.remove());
    barKey = '';
    padHooks.change();
  };
  // The mouse, the keyboard or a finger puts the usual words back (only real input: the controller's own events are
  // made up, and don't count).
  addEventListener('pointermove', (e) => e.isTrusted && (e.movementX || e.movementY) && use(null), true);
  addEventListener('pointerdown', (e) => e.isTrusted && use(null), true);
  addEventListener('keydown', (e) => e.isTrusted && use(null), true);

  /** The controller's buttons beside each ability you have (their squares clip, so these sit in a layer of their own),
   *  and LB RB where the buy amounts' label is (put back when the panel redraws). */
  const abilityTags = new Map<string, HTMLElement>();
  const fixGlyphs = () => {
    for (const slot of document.querySelectorAll<HTMLElement>('.ab[data-ability]')) {
      const id = slot.dataset.ability ?? '';
      const keys = ABILITY_PAD[id];
      if (!keys) continue;
      let tag = abilityTags.get(id);
      if (!tag) {
        tag = document.createElement('span');
        tag.className = 'pad-ab';
        document.body.appendChild(tag);
        abilityTags.set(id, tag);
      }
      const box = slot.getBoundingClientRect();
      const show = !!family && !modalOpen() && !titleOpen() && !slot.classList.contains('locked') && box.width > 0;
      tag.hidden = !show;
      if (!show) continue;
      if (tag.dataset.family !== family) {
        tag.innerHTML = keys.map((k) => padGlyph(k, 26)).join('');
        tag.dataset.family = family ?? '';
      }
      tag.style.transform = `translate(${Math.round(box.left - tag.offsetWidth - 6)}px, ${Math.round(box.top + (box.height - tag.offsetHeight) / 2)}px)`;
    }
    const modes = document.querySelector('.modes');
    if (family && modes && !modes.querySelector('.pad-amount')) modes.querySelector('.mode')?.insertAdjacentHTML('beforebegin', `<span class="pad-fixed pad-amount">${padGlyph('lb', 22)}${padGlyph('rb', 22)}</span>`);
  };

  /** The prompt bar: what the buttons do here, in one line. */
  const showBar = () => {
    if (!family) {
      bar.hidden = true;
      return;
    }
    const items: [string[], string][] = modalOpen() ? [[['a'], 'Select'], [['b'], 'Back']]
      : titleOpen() ? [[['a'], 'Select']]
      : inKeep() ? [[['a'], 'Use'], [['rt'], 'Level'], [['x'], 'Upgrade'], [['menu'], 'Options']]
      : [[['a'], 'Attack'], [['rt'], 'Level'], [['x'], 'Upgrade'], [['view'], 'Ascend'], [['menu'], 'Options']];
    const key = family + items.map(([, w]) => w).join();
    if (key !== barKey) {
      barKey = key;
      bar.innerHTML = items.map(([keys, what]) => `<span>${keys.map((k) => padGlyph(k, 26)).join('')}<b>${what}</b></span>`).join('');
    }
    const over = modalOpen() || titleOpen();
    bar.classList.toggle('over', over);
    // (Across the dungeon, not under the party panel.)
    const shop = document.querySelector('.shop')?.getBoundingClientRect();
    bar.style.width = !over && shop && shop.left > 0 ? `${Math.round(shop.left)}px` : '';
    bar.hidden = false;
  };

  /** Your party's picked row, framed (the bar names what RT and X do to it). */
  const showPick = () => {
    const list = rows();
    const show = !!family && !modalOpen() && !titleOpen() && list.length > 0;
    picked = Math.max(0, Math.min(list.length - 1, picked));
    list.forEach((r, i) => r.classList.toggle('pad-pick', show && i === picked));
  };

  const poll = (now: number) => {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    const pad = [...navigator.getGamepads()].find((p) => p?.connected) ?? null;
    if (!pad) {
      connected = null;
      use(null);
      cursor.hidden = true;
      requestAnimationFrame(poll);
      return;
    }
    connected = familyOf(pad);
    const down = new Set<string>();
    pad.buttons.forEach((b, i) => (b.pressed || b.value > 0.5) && down.add(`b${i}`));
    const fresh = (id: string) => down.has(id) && !held.has(id);
    const letGo = (id: string) => held.has(id) && !down.has(id);
    const dpad: Dir | null = down.has('b12') ? 'up' : down.has('b13') ? 'down' : down.has('b14') ? 'left' : down.has('b15') ? 'right' : null;
    const [lx, ly, , ry] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0, pad.axes[2] ?? 0, pad.axes[3] ?? 0];
    const tilt = Math.hypot(lx, ly);
    // Anything on the controller makes it the thing in use.
    if ([...down].some((b) => !held.has(b)) || tilt > DEAD_ZONE || Math.abs(ry) > 0.5) use(connected);
    const modal = modalOpen();
    const title = titleOpen();
    const nav = modal || title;

    // Left stick: the cursor. It starts gently and speeds up as you hold it, and slows over anything you can press.
    if (tilt > DEAD_ZONE) {
      tiltFor += dt;
      const over = document.elementFromPoint(at.x, at.y)?.closest(REACH);
      const top = (innerHeight / CURSOR_CROSS) * 2 ** ((padTuning.speed - 0.5) * 2);
      const ramp = CURSOR_START + (1 - CURSOR_START) * Math.min(1, tiltFor / CURSOR_RAMP);
      const speed = top * ramp * ((tilt - DEAD_ZONE) / (1 - DEAD_ZONE)) ** 2 * (over ? STICKY : 1);
      at.x = Math.max(0, Math.min(innerWidth - 1, at.x + (lx / tilt) * speed * dt));
      at.y = Math.max(0, Math.min(innerHeight - 1, at.y + (ly / tilt) * speed * dt));
      aiming = 'cursor';
      (document.activeElement as HTMLElement | null)?.blur?.();
      pointer('pointermove', at.x, at.y);
    } else tiltFor = 0;
    // The game's own sword shows over the dungeon; elsewhere this arrow does.
    const blade = document.querySelector<HTMLElement>('.blade');
    cursor.hidden = !family || aiming !== 'cursor' || (!!blade && !blade.hidden);
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
    fixGlyphs();
    showPick();
    showBar();

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
