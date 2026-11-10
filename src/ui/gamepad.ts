/** Controller support, with no cursor: everything has a button. The left stick walks your hero (it catches goblins and
 *  picks up what it walks over, as with the keys) and A attacks the monster nearest them. The d-pad's ▲ ▼ (or the right
 *  stick) pick a companion in your party: RT levels it, X buys its next upgrade, R3 makes it your hero; ◀ ▶ change how
 *  many levels a buy is. LB, RB and Y use abilities, and with LT held three more (LT with ◀ ▶ changes floor). View lets
 *  the d-pad step to any button on screen (reading its tooltip; A presses it), Menu opens Options, B backs out. A
 *  number to type (a floor) steps instead: ◀ ▶ by 1, ▲ ▼ by 10, LB RB by 100. In a window or on the title screen
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
/** Buttons pressed together (LT + LB). */
export const padCombo = (keys: string[], size: number) => keys.map((k) => padGlyph(k, size)).join('<span class="pad-plus">+</span>');

export type PadFamily = 'xbox' | 'ps' | 'switch';

let family: PadFamily | null = null;
const INPUT_KEY = 'deepheart-input';
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
const KEYS = ['data-act', 'data-open', 'data-set', 'data-pick', 'data-settab', 'data-cursor', 'data-tip', 'data-trip', 'data-card-lap', 'data-card-gold'];
/** A selector for what an element does, to find the same button again once its window has been redrawn. */
export const keyOf = (el: HTMLElement) => KEYS.map((a) => (el.getAttribute(a) ? `[${a}="${CSS.escape(el.getAttribute(a)!)}"]` : '')).join('');

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
export const hover = (el: Element | null | undefined, on: boolean) =>
  el?.dispatchEvent(new PointerEvent(on ? 'pointerover' : 'pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: null }));

const visible = (el: HTMLElement) => {
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && !el.closest('[hidden]');
};

/** The nearest visible control in a direction. ▲ ▼ go a row at a time (the next row's closest, as reading goes);
 *  ◀ ▶ stay on the same line (nothing there, nothing happens). */
export function neighbor(from: HTMLElement | null, dir: Dir, scope: ParentNode): HTMLElement | null {
  const reach = !(scope instanceof Element) ? REACH : scope.matches('.modal-wrap') ? REACH_WINDOW : scope.matches('#ui') ? REACH_SCREEN : REACH;
  const items = [...scope.querySelectorAll<HTMLElement>(reach)].filter((el) => !el.parentElement?.closest(reach) || el.matches('button, a, input')).filter((el) => visible(el) && !el.matches('canvas'));
  if (!from || !items.includes(from)) return items[0] ?? null;
  const origin = from.getBoundingClientRect();
  const [ox, oy] = [origin.left + origin.width / 2, origin.top + origin.height / 2];
  if (dir === 'up' || dir === 'down') {
    const ahead = items.filter((el) => el !== from).map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => (dir === 'down' ? box.top + box.height / 2 - oy : oy - box.top - box.height / 2) > 1);
    const gap = ({ box }: { box: DOMRect }) => Math.max(0, dir === 'down' ? box.top - origin.bottom : origin.top - box.bottom);
    const nearest = Math.min(...ahead.map(gap));
    // (Within a few pixels counts as the same row: a row's buttons rarely line up exactly.)
    const row = ahead.filter((c) => gap(c) <= nearest + 8);
    const off = ({ box }: { box: DOMRect }) => Math.max(0, box.left - origin.right, origin.left - box.right) * 1000 + Math.abs(box.left + box.width / 2 - ox);
    return row.sort((a, b) => off(a) - off(b))[0]?.el ?? null;
  }
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === from) continue;
    const box = el.getBoundingClientRect();
    const dx = box.left + box.width / 2 - ox;
    const dy = box.top + box.height / 2 - oy;
    const along = dir === 'left' ? -dx : dx;
    if (along <= 1 || box.bottom < origin.top - 8 || box.top > origin.bottom + 8) continue;
    const score = along + Math.abs(dy) * 2;
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
  /** A went to a window, a card or the Heart: held on after, it doesn't start levelling. */
  let aSpent = false;
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
  /** A number box with the focus (the floor to go to, an expedition's floor): the d-pad steps it. */
  const numberBox = () => {
    const el = focused();
    return el instanceof HTMLInputElement && el.type === 'number' ? el : null;
  };
  const step = (box: HTMLInputElement, by: number) => {
    const lo = Number(box.min || 1), hi = Number(box.max || Infinity);
    box.value = String(Math.max(lo, Math.min(hi, Math.round(Number(box.value) || lo) + by)));
    box.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const keyOn = (el: HTMLElement, key: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
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
  /** Press a setting's row and stay on it (the window redraws, so find it again by what it does). */
  let lastRow = '';
  /** Press something in a window and stay on it: the window often redraws (a Spirit picked, a setting changed), so it's
   *  found again by what it is. (If it's gone, or a new window opened, the focus starts afresh there.) */
  const pressKeeping = (el: HTMLElement) => {
    const key = keyOf(el);
    if (el.matches('.opt')) lastRow = key;
    click(el);
    if (!key) return;
    setTimeout(() => {
      if (el.isConnected && document.activeElement === el) return;
      land(document.querySelector<HTMLElement>(`.modal-wrap:not([hidden]) ${el.tagName.toLowerCase()}${key}`));
    }, 0);
  };
  /** A window opened from the dock: closing it goes back to the button that opened it, still roaming. */
  let dockReturn = '';
  let windowSeen = '';
  /** A window that just opened starts on its main button (or its first setting, or the first thing in it), never the ✕:
   *  B already closes it. */
  const landFirst = () => {
    const wrap = document.querySelector<HTMLElement>('.modal-wrap:not([hidden])');
    if (!wrap || wrap.contains(document.activeElement)) return;
    const all = [...wrap.querySelectorAll<HTMLElement>(REACH_WINDOW)].filter((el) => visible(el) && !el.closest('.m-head') && !el.matches('.tab'));
    land(all.find((el) => el.matches('.btn.primary, .btn.soul, .btn.bound')) ?? all.find((el) => el.matches('.opts .opt')) ?? all[0] ?? null);
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
      document.querySelectorAll<HTMLElement>('.ab[data-ability]').forEach((slot) => (slot.style.order = ''));
    }
    document.querySelectorAll('.pad-fixed').forEach((g) => g.remove());
    barKey = '';
    try {
      if (f) localStorage.setItem(INPUT_KEY, f);
      else localStorage.removeItem(INPUT_KEY);
    } catch { /* storage off: it starts on the mouse */ }
    padHooks.change();
  };
  // Back on the controller you last played with (after a wipe, a reload, the next launch): the browser won't say a
  // controller is there until one of its buttons is pressed.
  try {
    const last = localStorage.getItem(INPUT_KEY);
    if (last === 'xbox' || last === 'ps' || last === 'switch') use(last);
  } catch { /* storage off */ }
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
      // On a controller the column follows the buttons (LB RB Y, then with LT), always-on skills last.
      slot.style.order = family ? String(keys ? Object.keys(ABILITY_PAD).indexOf(id) : 99) : '';
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
        tag.innerHTML = padCombo(keys, 26);
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
    const items: [string[], string][] = numberBox() ? [[['left', 'right'], '±1'], [['up', 'down'], '±10'], [['lb', 'rb'], '±100'], [['a'], 'Go'], [['b'], 'Cancel']]
      : modal ? [[['a'], 'Select'], [['b'], 'Back']]
      : titleOpen() ? [[['a'], 'Select']]
      : docked ? [[['a'], 'Select'], [['b'], 'Back']]
      : inKeep() ? [[['ls'], 'Walk'], [['y'], 'Use'], [['a'], 'Level'], [['x'], 'Upgrade'], [['menu'], 'Options'], [['view'], 'Browse']]
      : [[['ls'], 'Move'], [['rt'], 'Attack'], [['a'], 'Level'], [['x'], 'Upgrade'], [['menu'], 'Options'], [['view'], 'Browse']];
    if (!numberBox() && modal && document.querySelector('.modal-wrap:not([hidden]) .tabs')) items.splice(1, 0, [['lb', 'rb'], 'Tabs']);
    if (!numberBox() && modal && document.querySelector('.modal-wrap:not([hidden]) .opts .opt:not(.opt-go)')) items.splice(1, 0, [['left', 'right'], 'Change']);
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

  let seen = false;
  const poll = (now: number) => {
    const pad = [...navigator.getGamepads()].find((p) => p?.connected) ?? null;
    if (!pad) {
      // (Unplugged: the mouse's words come back. Not yet seen since loading, it keeps the remembered controller.)
      if (seen) use(null);
      else if (family) {
        const shown = !modalOpen() && !titleOpen();
        fixGlyphs(shown);
        showPick(shown, false);
        showBar();
      }
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
    seen = true;
    if ([...down].some((b) => !held.has(b)) || Math.hypot(lx, ly) > DEAD_ZONE || Math.abs(ry) > 0.5 || Math.abs(rx) > 0.5) use(familyOf(pad));
    const modal = modalOpen();
    const title = titleOpen();
    if (docked && (modal || title || !document.getElementById('ui')?.contains(document.activeElement))) {
      if (modal || title) docked = false;
      else leaveDock();
    }
    // A window opening (or one turning into another) gets its first focus; the last one closing hands the focus back.
    const windowNow = modal ? `${document.querySelector('.modal-wrap .modal')?.className} ${document.querySelector('.modal-wrap h2')?.textContent}` : '';
    if (windowNow !== windowSeen) {
      if (family && modal) landFirst();
      else if (!modal && dockReturn) {
        const back = document.querySelector<HTMLElement>(`#ui ${dockReturn}`);
        if (family && back && visible(back)) {
          docked = true;
          land(back);
        }
      }
      if (!modal) dockReturn = '';
      windowSeen = windowNow;
    }
    // Playing, nothing keeps the focus box (a button pressed before, a window's opener).
    const stray = focused();
    if (family && !modal && !title && !docked && stray && !(stray instanceof HTMLInputElement) && document.getElementById('ui')?.contains(stray)) {
      hover(focusTip, false);
      focusTip = null;
      stray.blur();
    }
    const nav = modal || title || docked;
    if (!down.has('b0')) aSpent = false;
    else if (nav) aSpent = true;

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

    const box = numberBox();
    if (nav && box) {
      const dir = dpad ?? stickDir;
      if (dir && (dir !== heldDir || now >= repeatAt)) {
        step(box, dir === 'right' ? 1 : dir === 'left' ? -1 : dir === 'up' ? 10 : -10);
        repeatAt = now + (dir === heldDir ? 80 : REPEAT_MS * 1.4);
      }
      heldDir = dir;
      if (fresh('b4')) step(box, -100);
      if (fresh('b5')) step(box, 100);
      // A goes (the floor box takes Enter; an expedition's just keeps its number), B leaves it as it was.
      if (fresh('b0')) {
        keyOn(box, 'Enter');
        if (box.isConnected) land(box.closest('.trip')?.querySelector<HTMLElement>('[data-act="tripGo"]') ?? null);
      }
      if (fresh('b1')) {
        keyOn(box, 'Escape');
        if (box.isConnected) box.blur();
      }
    } else if (nav) {
      // Stepping between buttons; A presses, LB RB change a window's tabs. On a setting's row (Options), ◀ ▶ change
      // its value instead: a toggle flips, a choice steps, a volume moves a tenth.
      const dir = dpad ?? stickDir;
      if (dir && (dir !== heldDir || now >= repeatAt)) {
        const opt = focused()?.closest<HTMLElement>('.opt');
        if (opt && (dir === 'left' || dir === 'right')) {
          const range = opt.querySelector<HTMLInputElement>('input[type=range]');
          if (range) {
            range.value = String(Math.max(0, Math.min(100, Number(range.value) + (dir === 'right' ? 10 : -10))));
            range.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (!opt.classList.contains('opt-go')) pressKeeping(opt);
        } else land(neighbor(focused(), dir, scope()));
        repeatAt = now + (dir === heldDir ? REPEAT_MS * 0.6 : REPEAT_MS);
      }
      heldDir = dir;
      if (fresh('b0')) {
        const el = focused() ?? (modal ? null : neighbor(null, 'down', scope()));
        if (!el && modal) landFirst();
        else if (el && modal) pressKeeping(el);
        else {
          if (el && docked) dockReturn = keyOf(el);
          click(el);
        }
      }
      if (modal && (fresh('b4') || fresh('b5'))) {
        const tabs = [...document.querySelectorAll<HTMLElement>('.modal-wrap:not([hidden]) .tabs .tab')].filter(visible);
        const on = Math.max(0, tabs.findIndex((t) => t.classList.contains('on')));
        if (tabs.length > 1) {
          click(tabs[(on + (fresh('b5') ? 1 : tabs.length - 1)) % tabs.length]);
          // (A new page of rows: start on its first.)
          setTimeout(() => land(document.querySelector<HTMLElement>('.modal-wrap:not([hidden]) .opts .opt')), 0);
        }
      }
    } else {
      heldDir = dpad;
      // RT attacks (hold it to keep swinging); in the Keep, Y uses what you're at.
      if (inKeep()) {
        if (fresh('b3')) tap(' ', 'Space');
      } else {
        if (fresh('b7')) press(' ', 'Space', true);
        if (letGo('b7')) press(' ', 'Space', false);
      }
      // A card face up, or the Heart waking: A takes it (instead of levelling).
      const waiting = document.querySelector<HTMLElement>('.card-reveal:not(.go) .cr-card, .awk:not(.out)');
      if (waiting && fresh('b0')) {
        click(waiting);
        aSpent = true;
      }
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

    // Your party, always at hand (not under a window): the d-pad's ▲ ▼ or the right stick pick, A levels, X upgrades,
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
      if (row && !aSpent && down.has('b0') && now >= buyAt) {
        click(row);
        buyAt = now + (fresh('b0') ? BUY_REPEAT_MS * 2.5 : BUY_REPEAT_MS);
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
      if (!moved && (fresh('b7') || Math.hypot(lx, ly) > DEAD_ZONE)) hover(pickedRow, false);
    }
    fixGlyphs(!!family && !modal && !title);
    showPick(!!family && !modal && !title, moved);
    showBar();

    // B backs out; View lets the d-pad roam the screen (or stops it); Menu opens Options (either closes a window).
    if (fresh('b1') && !box) {
      if (docked) leaveDock();
      else {
        tap('Escape');
        // (Back in the window it came from, Options: on the row that opened it.)
        if (lastRow) setTimeout(() => land(document.querySelector<HTMLElement>(`.modal-wrap:not([hidden]) .opt${lastRow}`)), 0);
      }
    }
    if (fresh('b8') && !box) {
      if (modal) tap('Escape');
      else if (docked) leaveDock();
      else if (!title) {
        docked = true;
        land(document.querySelector<HTMLElement>('.dock button') ?? neighbor(null, 'right', document));
      }
    }
    if (fresh('b9') && !title && !box) modal ? tap('Escape') : click(document.querySelector('[data-open="settings"]'));

    held = down;
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}
