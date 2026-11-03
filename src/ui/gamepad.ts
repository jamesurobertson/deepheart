/** Controller support, with no cursor: everything has a button. The left stick walks your hero (it catches goblins and
 *  picks up what it walks over, as with the keys) and A attacks the monster nearest them. The d-pad's ▲ ▼ (or the right
 *  stick) pick a companion in your party: RT levels it, X buys its next upgrade, R3 makes it your hero; ◀ ▶ change how
 *  many levels a buy is. LB, RB and Y use abilities, and with LT held three more (LT with ◀ ▶ changes floor). Menu lets
 *  the d-pad step to any button on screen (reading its tooltip; A presses it), View opens Options, B backs out. In a window or on the title screen
 *  the sticks and d-pad step between buttons and LB RB change tabs. Prompts show the controller's own buttons (Kenney's Input Prompts, by kind of pad) while it's the last
 *  thing used; the mouse, keyboard or a finger puts the usual words back. */
const REACH = 'button:not([disabled]), a[href], [tabindex="0"], input:not([disabled])';
/** In a window, or around the screen from Menu, anything with a tooltip can be stepped to as well (a trophy, a card,
 *  an ability), to read it. */
const REACH_WINDOW = `${REACH}, .modal-wrap [data-tip]`;
const REACH_SCREEN = `${REACH}, #ui [data-tip]`;
const DEAD_ZONE = 0.35;
const REPEAT_MS = 220;
/** How often a held RT buys again (after a longer first wait, so one press buys once). */
const BUY_REPEAT_MS = 160;
const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const;
type Dir = keyof typeof ARROWS;
/** The ability (its number key) on LB, RB and Y, and on each with LT held. */
const ABILITY_KEY: Record<string, [string, string]> = { b4: ['1', '4'], b5: ['3', '5'], b3: ['2', '6'] };
/** Each ability's button(s), for its prompt. */
export const ABILITY_PAD: Record<string, string[]> = { flurry: ['lb'], cleave: ['rb'], rampage: ['y'], treasure: ['lt', 'lb'], drums: ['lt', 'rb'], legion: ['lt', 'y'] };

export type PadFamily = 'xbox' | 'ps' | 'switch';

let family: PadFamily | null = null;
/** The controller in use, while it's the last thing you touched (null with the mouse, keyboard or touch). */
export const padFamily = () => family;

/** A controller button's picture: a, b, x, y, lb, rb, lt, rt, up, down, left, right, ls, rs, r3, menu, view. */
export function padGlyph(key: string, size = 22, cls = ''): string {
  if (!family) return '';
  return `<img class="pad-g ${cls}" data-k="${key}" src="${import.meta.env.BASE_URL}assets/prompts/${family}/${key}.png" width="${size}" height="${size}" alt="" draggable="false">`;
}

/** A hint about one companion's row (hire them, buy their upgrade, make them your hero): the right stick's pick moves
 *  there, so the button the hint names does what it says. */
let pickComp: number | null = null;
export const padPick = (comp: number) => {
  pickComp = comp;
};

/** Runs when the controller starts or stops being the thing in use (so prompts can change their words). */
export const padHooks = { change: () => {} };

/** Prompts that move, frame by frame as prompt art does: a stick to move tilts up, right, down and left; a stick to
 *  press goes in and out. */
const ANIMATED: Record<string, string[]> = { ls: ['ls_up', 'ls_right', 'ls_down', 'ls_left'], rs: ['rs_up', 'rs_right', 'rs_down', 'rs_left'], r3: ['rs', 'r3'] };
const FRAME_MS = 320;
if (typeof window !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  setInterval(() => {
    if (!family) return;
    const tick = Math.floor(performance.now() / FRAME_MS);
    for (const img of document.querySelectorAll<HTMLImageElement>('img.pad-g[data-k]')) {
      const frames = ANIMATED[img.dataset.k ?? ''];
      if (frames) img.src = `${import.meta.env.BASE_URL}assets/prompts/${family}/${frames[tick % frames.length]}.png`;
    }
  }, FRAME_MS);
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
const click = (el: Element | null | undefined) => el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
/** Its tooltip, as pointing at it with the mouse shows it (or takes it away). */
const hover = (el: Element | null | undefined, on: boolean) =>
  el?.dispatchEvent(new PointerEvent(on ? 'pointerover' : 'pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: null }));

const visible = (el: HTMLElement) => {
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && !el.closest('[hidden]');
};

/** The nearest visible control in a direction, by distance along that direction with a penalty for drifting off it. */
function neighbor(from: HTMLElement | null, dir: Dir, scope: ParentNode): HTMLElement | null {
  const reach = !(scope instanceof Element) ? REACH : scope.matches('.modal-wrap') ? REACH_WINDOW : scope.matches('#ui') ? REACH_SCREEN : REACH;
  const items = [...scope.querySelectorAll<HTMLElement>(reach)].filter((el) => !el.parentElement?.closest(reach) || el.matches('button, a, input')).filter((el) => visible(el) && !el.matches('canvas'));
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
  const bar = document.createElement('div');
  bar.className = 'pad-bar';
  bar.hidden = true;
  document.body.appendChild(bar);

  let held = new Set<string>();
  let heldDir: Dir | null = null;
  let heldSide: Dir | null = null;
  let walking = new Set<Dir>();
  let repeatAt = 0;
  let buyAt = 0;
  let picked = 0;
  let pickedRow: HTMLElement | null = null;
  let stickAt = 0;
  let barKey = '';
  /** Menu put the focus on the screen's buttons (starting on the dock): the d-pad steps anywhere (abilities, the floor,
   *  your party, the dock), each shows its tooltip, A presses it, B goes back to playing. */
  let docked = false;
  let focusTip: HTMLElement | null = null;

  const modalOpen = () => !!document.querySelector('.modal-wrap:not([hidden])');
  const titleOpen = () => !!document.querySelector('.title-menu');
  const inKeep = () => document.body.classList.contains('in-keep');
  const scope = (): ParentNode => document.querySelector('.modal-wrap:not([hidden])') ?? document.querySelector('.title-menu') ?? document.getElementById('ui') ?? document;
  const rows = () => [...document.querySelectorAll<HTMLElement>('.gens .gen[data-comp]')].filter(visible);
  const focused = () => (document.activeElement && document.activeElement !== document.body ? document.activeElement as HTMLElement : null);
  /** The d-pad (or a stick) lands on a button: focused, with its tooltip. */
  const land = (el: HTMLElement | null) => {
    if (!el) return;
    // (A trophy or a card isn't a button: it takes the focus all the same, just not from Tab.)
    if (!el.matches(REACH)) el.tabIndex = -1;
    el.focus({ preventScroll: false });
    el.scrollIntoView({ block: 'nearest' });
    hover(focusTip, false);
    focusTip = el.closest<HTMLElement>('[data-tip]');
    hover(focusTip, true);
  };
  const leaveDock = () => {
    docked = false;
    hover(focusTip, false);
    focusTip = null;
    focused()?.blur();
  };

  /** The controller becomes (or stops being) the thing in use: the prompts follow. */
  const use = (f: PadFamily | null) => {
    if (f === family) return;
    family = f;
    document.body.classList.toggle('pad-on', !!f);
    if (f) document.body.dataset.pad = f;
    else {
      delete document.body.dataset.pad;
      if (docked) leaveDock();
    }
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
  const fixGlyphs = (show: boolean) => {
    for (const slot of document.querySelectorAll<HTMLElement>('.ab[data-ability]')) {
      const id = slot.dataset.ability ?? '';
      const keys = ABILITY_PAD[id];
      if (!keys) continue;
      let tag = abilityTags.get(id);
      if (!tag) {
        tag = document.createElement('span');
        tag.className = 'pad-ab';
        // (In the interface's own layer, so tooltips go over them.)
        (document.getElementById('ui') ?? document.body).appendChild(tag);
        abilityTags.set(id, tag);
      }
      const box = slot.getBoundingClientRect();
      const on = show && !slot.classList.contains('locked') && box.width > 0;
      tag.hidden = !on;
      if (!on) continue;
      if (tag.dataset.family !== family) {
        tag.innerHTML = keys.map((k) => padGlyph(k, 26)).join('');
        tag.dataset.family = family ?? '';
      }
      tag.style.transform = `translate(${Math.round(box.left - tag.offsetWidth - 6)}px, ${Math.round(box.top + (box.height - tag.offsetHeight) / 2)}px)`;
    }
    const modes = document.querySelector('.modes');
    if (family && modes && !modes.querySelector('.pad-amount')) modes.querySelector('.mode')?.insertAdjacentHTML('beforebegin', `<span class="pad-fixed pad-amount">${padGlyph('left', 22)}${padGlyph('right', 22)}</span>`);
  };

  /** The prompt bar: what the buttons do here, in one line. */
  const showBar = () => {
    if (!family) {
      bar.hidden = true;
      return;
    }
    const modal = modalOpen();
    const items: [string[], string][] = modal ? [[['a'], 'Select'], [['b'], 'Back']]
      : titleOpen() ? [[['a'], 'Select']]
      : docked ? [[['a'], 'Select'], [['b'], 'Back']]
      : inKeep() ? [[['ls'], 'Walk'], [['a'], 'Use'], [['rt'], 'Level'], [['x'], 'Upgrade'], [['view'], 'Options'], [['menu'], 'Menu']]
      : [[['ls'], 'Move'], [['a'], 'Attack'], [['rt'], 'Level'], [['x'], 'Upgrade'], [['view'], 'Options'], [['menu'], 'Menu']];
    if (modal && document.querySelector('.modal-wrap:not([hidden]) .tabs')) items.splice(1, 0, [['lb', 'rb'], 'Tabs']);
    const key = family + items.map(([, w]) => w).join();
    if (key !== barKey) {
      barKey = key;
      bar.innerHTML = items.map(([keys, what]) => `<span>${keys.map((k) => padGlyph(k, 26)).join('')}<b>${what}</b></span>`).join('');
    }
    const over = modal || titleOpen();
    bar.classList.toggle('over', over);
    // (Across the dungeon, not under the party panel.)
    const shop = document.querySelector('.shop')?.getBoundingClientRect();
    bar.style.width = !over && shop && shop.left > 0 ? `${Math.round(shop.left)}px` : '';
    bar.hidden = false;
  };

  /** Your party's picked row, framed, with its tooltip while you're choosing (the bar names what RT and X do). */
  const showPick = (show: boolean, moved: boolean) => {
    const list = rows();
    if (pickComp !== null) {
      const at = list.findIndex((r) => Number(r.dataset.comp) === pickComp);
      if (at >= 0) picked = at;
      pickComp = null;
    }
    picked = Math.max(0, Math.min(list.length - 1, picked));
    const row = show ? list[picked] ?? null : null;
    list.forEach((r) => r.classList.toggle('pad-pick', r === row));
    if (row !== pickedRow || moved) {
      hover(pickedRow, false);
      if (row && moved) hover(row, true);
      pickedRow = row;
    }
  };

  const poll = (now: number) => {
    const pad = [...navigator.getGamepads()].find((p) => p?.connected) ?? null;
    if (!pad) {
      use(null);
      for (const d of walking) press(ARROWS[d], ARROWS[d], false);
      walking.clear();
      requestAnimationFrame(poll);
      return;
    }
    const down = new Set<string>();
    pad.buttons.forEach((b, i) => (b.pressed || b.value > 0.5) && down.add(`b${i}`));
    const fresh = (id: string) => down.has(id) && !held.has(id);
    const letGo = (id: string) => held.has(id) && !down.has(id);
    const [lx, ly, rx, ry] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0, pad.axes[2] ?? 0, pad.axes[3] ?? 0];
    // The d-pad, or (in a window, on the title screen or along the dock) the left stick: a step in one direction.
    const stickDir: Dir | null = Math.hypot(lx, ly) < 0.5 ? null : Math.abs(lx) > Math.abs(ly) ? (lx < 0 ? 'left' : 'right') : (ly < 0 ? 'up' : 'down');
    const dpad: Dir | null = down.has('b12') ? 'up' : down.has('b13') ? 'down' : down.has('b14') ? 'left' : down.has('b15') ? 'right' : null;
    if ([...down].some((b) => !held.has(b)) || Math.hypot(lx, ly) > DEAD_ZONE || Math.abs(ry) > 0.5 || Math.abs(rx) > 0.5) use(familyOf(pad));
    const modal = modalOpen();
    const title = titleOpen();
    if (docked && (modal || title || !document.getElementById('ui')?.contains(document.activeElement))) {
      if (modal || title) docked = false;
      else leaveDock();
    }
    const nav = modal || title || docked;

    // Walking: the left stick in the dungeon and the Keep, as the arrow keys (two at once on a diagonal).
    const want = new Set<Dir>();
    if (!nav) {
      if (lx < -DEAD_ZONE) want.add('left');
      if (lx > DEAD_ZONE) want.add('right');
      if (ly < -DEAD_ZONE) want.add('up');
      if (ly > DEAD_ZONE) want.add('down');
    }
    for (const d of walking) if (!want.has(d)) press(ARROWS[d], ARROWS[d], false);
    for (const d of want) if (!walking.has(d)) press(ARROWS[d], ARROWS[d], true);
    walking = want;

    if (nav) {
      // Stepping between buttons; A presses, LB RB change a window's tabs.
      const dir = dpad ?? stickDir;
      if (dir && (dir !== heldDir || now >= repeatAt)) {
        land(neighbor(focused(), dir, scope()));
        repeatAt = now + (dir === heldDir ? REPEAT_MS * 0.6 : REPEAT_MS);
      }
      heldDir = dir;
      if (fresh('b0')) {
        click(focused() ?? neighbor(null, 'down', scope()));
      }
      if (modal && (fresh('b4') || fresh('b5'))) {
        const tabs = [...document.querySelectorAll<HTMLElement>('.modal-wrap:not([hidden]) .tabs .tab')].filter(visible);
        const on = Math.max(0, tabs.findIndex((t) => t.classList.contains('on')));
        if (tabs.length > 1) click(tabs[(on + (fresh('b5') ? 1 : tabs.length - 1)) % tabs.length]);
      }
    } else {
      heldDir = dpad;
      // A attacks (hold it to keep swinging); in the Keep it uses what you're at.
      if (fresh('b0')) press(' ', 'Space', true);
      if (letGo('b0')) press(' ', 'Space', false);
      // LB, RB and Y: abilities (with LT held, the other three). LT with the d-pad: the floor (◀ ▶) and Auto (▼).
      if (!inKeep()) {
        const lt = down.has('b6');
        for (const [b, [plain, shifted]] of Object.entries(ABILITY_KEY)) {
          if (!fresh(b)) continue;
          const key = lt ? shifted : plain;
          tap(key, `Digit${key}`);
        }
        if (lt && dpad && dpad !== 'up' && fresh(`b${12 + ['up', 'down', 'left', 'right'].indexOf(dpad)}`)) {
          click(document.querySelector(dpad === 'left' ? '[data-act="floorDown"]' : dpad === 'right' ? '[data-act="floorUp"]' : '[data-act="auto"]'));
        }
      }
    }

    // Your party, always at hand (not under a window): the d-pad's ▲ ▼ or the right stick pick, RT levels, X upgrades,
    // R3 makes them your hero, ◀ ▶ the amount.
    let moved = false;
    if (!modal && !title) {
      const list = rows();
      const lt = down.has('b6');
      const step = !docked && !lt && (dpad === 'up' || dpad === 'down') ? (dpad === 'down' ? 1 : -1) : Math.abs(ry) > 0.5 ? (ry > 0 ? 1 : -1) : 0;
      if (step && now >= stickAt) {
        picked = Math.max(0, Math.min(list.length - 1, picked + step));
        // (Held: a first wait, then quicker steps; the stick pushed all the way goes quicker still.)
        stickAt = now + (stickAt === 0 ? REPEAT_MS * 1.4 : Math.abs(ry) > 0.9 ? 70 : 110);
        list[picked]?.scrollIntoView({ block: 'nearest' });
        moved = true;
      } else if (!step) stickAt = 0;
      const row = list[picked];
      if (row && down.has('b7') && now >= buyAt) {
        click(row);
        buyAt = now + (fresh('b7') ? BUY_REPEAT_MS * 2.5 : BUY_REPEAT_MS);
      }
      if (row && fresh('b2')) click(row.querySelector('.trait[data-trait]'));
      if (row && fresh('b11')) click(row.querySelector('[data-hero]'));
      const side = !docked && !lt && (dpad === 'left' || dpad === 'right') && dpad !== heldSide ? dpad : null;
      if (side) {
        const modes = [...document.querySelectorAll<HTMLElement>('.modes .mode')];
        const on = Math.max(0, modes.findIndex((m) => m.classList.contains('on')));
        click(modes[(on + (side === 'right' ? 1 : modes.length - 1)) % modes.length]);
      }
      heldSide = dpad === 'left' || dpad === 'right' ? dpad : null;
      // (The tooltip goes with anything else you do.)
      if (!moved && (fresh('b0') || Math.hypot(lx, ly) > DEAD_ZONE)) hover(pickedRow, false);
    }
    fixGlyphs(!!family && !modal && !title);
    showPick(!!family && !modal && !title, moved);
    showBar();

    // B backs out; Menu lets the d-pad roam the screen (or stops it); View opens Options (either closes a window).
    if (fresh('b1')) docked ? leaveDock() : tap('Escape');
    if (fresh('b9')) {
      if (modal) tap('Escape');
      else if (docked) leaveDock();
      else if (!title) {
        docked = true;
        land(document.querySelector<HTMLElement>('.dock button') ?? neighbor(null, 'right', document));
      }
    }
    if (fresh('b8') && !title) modal ? tap('Escape') : click(document.querySelector('[data-open="settings"]'));

    held = down;
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
