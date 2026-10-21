import type { SfxName } from '../audio/sfx.ts';
import { Binder, type BinderCard, type BinderColor } from './binder.ts';
import { spriteFrames } from './px.ts';
import { BINDER_MARK, KOKO, STASHES, BROS_GAME, FOE_SPOTS, KID_START, PARTY_SPOTS, SHELF_SPOTS, MAPS, PLAYSET, HERO_SPOT, STEP, T, blocked, drawSprite, propAt, px, type Dir, type MapDef, type MapId, type NpcDef, type Warp } from './world.ts';

/**
 * The real world behind the dungeon: it was a kid playing with his figures on the bedroom floor. The live dungeon
 * view pulls back and shrinks into the cardboard playset on the rug, and you're in a handheld-sized world (160×144)
 * you can walk around: the bedroom, downstairs, the town outside. Keep playing at the playset to go back in.
 */

const W = 160;
const H = 144;
const TYPE_MS = 28;
/** How long the "!" shows over the brothers when they notice you, before they speak. */
const NOTICE_MS = 700;
/** Dev only (?hitboxes): shade what the pointer can pick, to line it up with the art. */
const SHOW_HITS = !!import.meta.env?.DEV && new URLSearchParams(location.search).has('hitboxes');
/** The prompt bubble's height (pixels): anything nearer the top than this gets it underneath instead. */
const PROMPT_H = 16;
/** Where a person's figure is drawn (as drawSprite places it: centred on their tile, feet near its bottom). */
function figure(n: { x: number; y: number; def: NpcDef }) {
  const f = spriteFrames(n.def.sprite)?.frames[0] ?? { w: 16, h: 16 };
  return { x: n.x * T + 8 - Math.round(f.w / 2), y: n.y * T + 15 - f.h, w: f.w, h: f.h };
}
/** How long the dungeon takes to shrink into the playset on a visit, and to zoom back in. */
const PULL_MS = { again: 1100, back: 1100 };
const STEP_S = 0.2;
const NPC_STEP_S = 0.36;
const KID = 'cr_beanie_kid';
const CARD_INKS = ['#c8423f', '#4a78c8', '#5aa050', '#f2c14e', '#8a5ac8', '#e08a3a'];
const KEY_DIRS: Record<string, Dir> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };

export interface DreamOpts {
  /** The whole reveal (first awakening) or a short wake-up. */
  first: boolean;
  /** Just popping into the room from the dungeon: no awakening. */
  visit?: boolean;
  /** Waking up for real: the awakening's number, on the black screen that fades into the bedroom. */
  awakening?: number;
  found: number;
  /** The binder as it is right now (trades add cards while you're awake). */
  binder: () => { cards: BinderCard[]; colors: BinderColor[] };
  /** You've looked through the binder: nothing's new any more. */
  seen: () => void;
  /** Are there cards in the binder you haven't looked at yet? */
  hasNew: () => boolean;
  /** Cards you have not seen in the binder yet. */
  fresh: number;
  /** Your hero: the figure the kid's playing with. */
  hero: { name: string; sprite: string };
  /** The other figures (sprite names): two more of the party and two monsters on the playset, the rest on the dresser. */
  figures: { party: string[]; foes: string[]; shelf: string[] };
  sound: (name: SfxName, o?: { vol?: number; rate?: number; jitter?: number }) => void;
  /** Talking to a brother opens his trade window over the screen. */
  trade: (who: 'dan' | 'victor', host: HTMLElement, closed: () => void) => void;
  /** Search a hiding spot: the name of the card in it, or null once it's been taken. */
  stash: (spot: string) => string | null;
  /** Dan and Victor have told you how collecting works (they do the first time you look up from your figures). */
  brosMet: boolean;
  meetBros: () => void;
  /** Who has given you their spare card already; `gift` hands one over (its name), once per person. */
  gifts: string[];
  gift: (who: string) => string | null;
  /** You've traded with a brother at least once. */
  traded: () => boolean;
  /** The pause menu's sound switch, and its way out to the title screen. */
  muted: () => boolean;
  toggleSound: () => void;
  mainMenu: () => void;
  /** The brothers you've gone to since they told you about collecting (an arrow hangs over each until you do). */
  talkedTo: string[];
  talkTo: (who: string) => void;
  /** Runs as the view pulls back out of the dungeon. */
  cover?: () => void;
  /** Runs just before the view zooms back into the playset: the awakening itself. */
  sleep?: () => void;
  done: () => void;
}

/** Dan and Victor, the first time you look up from your figures: you overhear their game, then they turn to you. */
const BROS_OVERHEARD = ['Victor: Ha! Lich beats Skeleton. Pay up.', "Dan: That's not how it works!"];
const BROS_MANY = (found: number) => [
  'Dan: Done playing? Come trade with us!',
  `Dan: Whoa, ${found} Deepheart cards? Where'd you get all those?`,
  'Victor: Hmph! How many gold cards do you have, though?',
  "Dan: If you have any doubles, I'll take 'em!",
  "Victor: Forget Dan, I'll trade for gold cards! Only champions drop them.",
];
/** "6 cards", "1 card". */
const cards = (n: number) => `${n} Deepheart card${n === 1 ? '' : 's'}`;

/** What things say when you use them (the bed and the binder do something instead). */
function linesFor(id: string, o: DreamOpts): string[] {
  const lines: Record<string, string[]> = {
    window: ['A sunny morning. Somewhere a bird is very pleased with itself.'],
    kitchen: ['Toast. Cold.'],
    table: ['A bowl of cereal.'],
    sofa: ['Koko loves sitting on the couch.'],
    photo: ["A photo of you in a cardboard knight's helmet."],
    mum: o.traded()
      ? ['Did Victor try to swindle you? He does that.', "Pip's outside if you want someone to play with."]
      : ['Having fun with your figures?', 'Your brothers are upstairs playing Deepheart.', 'Go show them your cards.', "Just don't let Victor talk you out of the good ones."],
    // One of his six went to you.
    friend: [`You've got ${cards(o.found)}? I've only got five.`, 'Nobody at school has filled a whole binder. Not even close.'],
    fisher: ['Nothing bites in this pond.', 'I played Deepheart when I was your age. Never did fill that binder.'],
    friendDoor: ["Pip's house. Nobody's home."],
    shop: ['DEEPHEART CARDS', 'The sign on the door says: CLOSED. New cards soon!'],
    mailbox: ['Nothing today.'],
    sign: ['BRAMBLEFORD'],
    pond: ['Something glints at the bottom. Probably a coin.'],
    brosGame: ["Dan and Victor's game. Victor is winning. Obviously."],
    bed: ['Not tired yet.'],
  };
  return lines[id] ?? [];
}

interface Walker {
  x: number;
  y: number;
  dir: Dir;
  /** Faces left when drawn (sprites are side-on, so up and down keep the last way they looked). */
  left: boolean;
  move: { fx: number; fy: number; t: number } | null;
}

interface Npc extends Walker {
  def: NpcDef;
  nextAt: number;
}

type Target =
  | { kind: 'prop'; id: string; label: string; x: number; y: number; w: number; h: number; hit: [number, number, number, number] }
  | { kind: 'warp'; warp: Warp; label: string; hit: [number, number, number, number] }
  | { kind: 'npc'; npc: Npc; label: string };

/** Koko, sitting up (14×12): k outline, o fur, d the sheen on her chest, p ears and nose, e eyes, b her bowtie (B the knot). */
const KOKO_ROWS = [
  '.k.......k....',
  'kok.....kok...',
  'kopkkkkkpok...',
  'koooooooook...',
  'kooeoooeook...',
  'koooopooook...',
  '.kobdddbok....',
  'koobbBbbook.kk',
  'koobdddbookkok',
  'kooodddoookkok',
  'kooooooooooook',
  '.kkkkkkkkkkkk.',
];
/** Her tail tip, flicked up now and then. */
const KOKO_FLICK = { 6: '.kobdddbok..kk', 7: 'koobbBbbookkok' } as Record<number, string>;
const KOKO_INK: Record<string, string> = { k: '#100b14', o: '#272030', d: '#3d3349', p: '#d8768e', e: '#8a9e5c', b: '#e8823a', B: '#b5561e' };
/** Seconds Koko purrs for, eyes shut. */
const PURR_S = 2.2;

/** `since`: seconds since she was last petted. */
function drawKoko(ctx: CanvasRenderingContext2D, t: number, since: number) {
  const purring = since < PURR_S;
  const blink = purring || t % 4.3 < 0.14;
  const flick = !purring && t % 2.7 < 0.35;
  KOKO_ROWS.forEach((row, y) => {
    const line = (flick && KOKO_FLICK[y]) || row;
    [...line].forEach((c, x) => {
      if (c === '.') return;
      px(ctx, KOKO.x + x, KOKO.y + y, 1, 1, c === 'e' && blink ? KOKO_INK.k : KOKO_INK[c]);
    });
  });
}

/** A menu's choice follows the mouse: the one pointed at becomes the selected one (one ▶, and Enter picks it). */
function pointedAt(menu: HTMLElement, e: MouseEvent, at: number) {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-k]');
  if (!b) return at;
  const k = Number(b.dataset.k);
  menu.querySelectorAll('[data-k]').forEach((x, i) => x.classList.toggle('on', i === k));
  return k;
}

/** A "!" (7×10): new cards in the binder, or someone noticing you. */
function bang(ctx: CanvasRenderingContext2D, x: number, y: number) {
  px(ctx, x, y, 7, 10, '#241a2a');
  px(ctx, x + 1, y + 1, 5, 8, '#ff5a7e');
  px(ctx, x + 3, y + 2, 1, 4, '#fff');
  px(ctx, x + 3, y + 7, 1, 1, '#fff');
}

/** A little arrow bobbing over someone's head. */
function arrowOver(ctx: CanvasRenderingContext2D, n: Npc, t: number) {
  const x = n.x * T + 8;
  const y = figure(n).y - 8 + (Math.floor(t * 3) % 2);
  px(ctx, x - 4, y, 9, 1, '#241a2a');
  for (let k = 0; k < 4; k++) {
    px(ctx, x - 4 + k, y + 1 + k, 9 - 2 * k, 1, '#241a2a');
    px(ctx, x - 3 + k, y + 1 + k, 7 - 2 * k, 1, '#fff6d8');
  }
  px(ctx, x, y + 5, 1, 1, '#241a2a');
}

/** What the mouse is on: a little arrow bobbing over a person, corner marks around a thing (or a way out). */
function hoverMark(ctx: CanvasRenderingContext2D, target: Target, t: number) {
  const ink = '#241a2a';
  const lit = '#fff6d8';
  const bob = Math.floor(t * 3) % 2;
  if (target.kind === 'npc') return arrowOver(ctx, target.npc, t);
  const [hx, hy, hw, hh] = target.hit;
  const x0 = hx - 2 - bob;
  const y0 = hy - 2 - bob;
  const x1 = hx + hw + 1 + bob;
  const y1 = hy + hh + 1 + bob;
  const arm = 4;
  for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    for (const [ox, oy, color] of [[1, 1, ink], [0, 0, lit]] as const) {
      px(ctx, Math.min(cx, cx + sx * arm) + ox, cy + oy, arm + 1, 1, color);
      px(ctx, cx + ox, Math.min(cy, cy + sy * arm) + oy, 1, arm + 1, color);
    }
  }
}

export function playDream(opts: DreamOpts) {
  new Dream(opts).run();
}

class Dream {
  private o: DreamOpts;
  private el: HTMLElement;
  private screen: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private box: HTMLElement;
  private text: HTMLElement;
  private prompt: HTMLElement;
  private fade: HTMLElement;
  private frame = document.createElement('canvas');
  private bases = new Map<MapId, HTMLCanvasElement>();
  private map: MapDef = MAPS.bedroom;
  private kid: Walker = { x: KID_START.x, y: KID_START.y, dir: KID_START.dir, left: false, move: null };
  private npcs: Npc[] = [];
  /** The kid's holding his hero's figure up, mid-adventure (until you start walking). */
  private holding = true;
  private roaming = false;
  /** Talking, in the binder, changing rooms: the kid stands still. */
  private busy = true;
  private path: [number, number][] = [];
  private then: (() => void) | null = null;
  private held: Dir[] = [];
  private hover: Target | null = null;
  /** Walking with the keys: the bubble names whatever you're facing (with the mouse, only what's under it). */
  private usingKeys = false;
  /** When Koko was last petted (she shuts her eyes while she purrs). */
  private pettedAt = -Infinity;
  /** Closes the poster close-up, while it's open. */
  private closePoster: (() => void) | null = null;
  /** When the brothers noticed you (their "!"). */
  private noticedAt = -Infinity;
  private start = performance.now();
  private last = performance.now();
  private raf = 0;
  private advance: (() => void) | null = null;
  private choose: ((by: number) => void) | null = null;
  /** Shuts the pause menu, while it's open (Escape, or a tap anywhere else). */
  private cancel: (() => void) | null = null;
  /** "Esc Menu", in the black under the screen (a tap on it works too). */
  private escHint!: HTMLButtonElement;
  private typing: number | null = null;
  private binder: Binder | null = null;
  private trading = false;
  private finished = false;

  constructor(o: DreamOpts) {
    this.o = o;
    this.el = document.createElement('div');
    this.el.className = 'dream in';
    this.el.innerHTML = `
      <div class="dr-screen">
        <canvas width="${W}" height="${H}"></canvas>
        <button class="dr-prompt" hidden></button>
        <div class="dr-fade"></div>
        <div class="dr-box" hidden><p></p><i class="dr-more">▼</i></div>
        <div class="dr-menu" hidden></div>
        <div class="dr-menu dr-start" hidden></div>
        <button class="dr-esc" hidden><kbd>Esc</kbd> Menu</button>
      </div>`;
    this.screen = this.el.querySelector('.dr-screen')!;
    this.escHint = this.el.querySelector('.dr-esc')!;
    this.escHint.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openMenu();
    });
    this.canvas = this.el.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.box = this.el.querySelector('.dr-box')!;
    this.text = this.box.querySelector('p')!;
    this.prompt = this.el.querySelector('.dr-prompt')!;
    this.fade = this.el.querySelector('.dr-fade')!;
    this.frame.width = W;
    this.frame.height = H;
    this.enterMap('bedroom');
    if (import.meta.env.DEV) Object.assign(window, { dream: this });
  }

  async run() {
    document.body.appendChild(this.el);
    document.body.classList.add('dreaming');
    this.fit();
    addEventListener('resize', this.fit);
    addEventListener('keydown', this.onKey);
    addEventListener('keyup', this.onKeyUp);
    this.el.addEventListener('pointerup', this.onTap);
    this.canvas.addEventListener('pointermove', this.onHover);
    this.canvas.addEventListener('pointerleave', () => (this.hover = null));
    this.prompt.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = this.promptTarget();
      if (t) this.goUse(t);
    });
    this.raf = requestAnimationFrame(this.loop);
    await this.wait(40);
    this.o.cover?.();
    if (this.o.awakening) await this.curtain(this.o.awakening);
    else await this.pullBack(PULL_MS.again);
    const n = this.o.fresh;
    await this.say(`...and the ${this.o.hero.name} saves the day!${n ? ` ${n} new card${n === 1 ? '' : 's'}!` : ''}`);
    if (!this.o.brosMet && this.map.id === 'bedroom') await this.brosTalk();
    this.box.hidden = true;
    this.holding = false;
    this.roaming = true;
    this.busy = false;
  }


  // ---------- in and out of the playset ----------

  /** The playset's floor on screen: where the dungeon shrinks to, and zooms back in from. */
  private floorRect() {
    const c = this.canvas.getBoundingClientRect();
    const s = c.width / W;
    const f = PLAYSET.floor;
    return { x: c.left + f.x * s, y: c.top + f.y * s, w: f.w * s, h: f.h * s };
  }

  /** The Awakening screen fades in over the dungeon, then away to the kid in his room. */
  private async curtain(n: number) {
    const c = document.createElement('div');
    c.className = 'curtain in heart';
    c.innerHTML = `<b>Awakening ${n}</b><span>The Heart beats. Everything starts again, stronger.</span>`;
    this.el.classList.add('waking');
    this.el.appendChild(c);
    await this.wait(1100);
    this.el.classList.remove('waking');
    await this.wait(1500);
    c.className = 'curtain out heart';
    await this.wait(1000);
    c.remove();
  }

  /** The live dungeon view, scaled and cropped down to the playset's floor (and its full-screen self). */
  private stageFrames() {
    const r = this.floorRect();
    const k = Math.max(r.w / innerWidth, r.h / innerHeight);
    const tx = r.x + (r.w - innerWidth * k) / 2;
    const ty = r.y + (r.h - innerHeight * k) / 2;
    const left = (r.x - tx) / k;
    const top = (r.y - ty) / k;
    const small = { transform: `translate(${tx}px, ${ty}px) scale(${k})`, clipPath: `inset(${top}px ${innerWidth - left - r.w / k}px ${innerHeight - top - r.h / k}px ${left}px)` };
    const full = { transform: 'translate(0px, 0px) scale(1)', clipPath: 'inset(0px 0px 0px 0px)' };
    return { small, full };
  }

  /** The dungeon fight shrinks into the boxes on the rug while the bedroom appears around it, then fades into the playset. */
  private async pullBack(ms: number) {
    const stage = document.getElementById('stage');
    if (!stage) return;
    const { small, full } = this.stageFrames();
    stage.style.zIndex = '2001';
    stage.style.transformOrigin = '0 0';
    await stage.animate([full, small], { duration: ms, easing: 'cubic-bezier(0.65, 0, 0.25, 1)', fill: 'forwards' }).finished;
    await stage.animate([{ ...small, opacity: 1 }, { ...small, opacity: 0 }], { duration: 400, fill: 'forwards' }).finished;
    for (const a of stage.getAnimations()) a.cancel();
    stage.style.zIndex = '';
  }

  /** Back into the boxes: the playset becomes the live dungeon again and grows to fill the screen. */
  private async zoomIn(ms: number) {
    const stage = document.getElementById('stage');
    if (!stage) return;
    const { small, full } = this.stageFrames();
    stage.style.zIndex = '2001';
    stage.style.transformOrigin = '0 0';
    await stage.animate([{ ...small, opacity: 0 }, { ...small, opacity: 1 }], { duration: 300, fill: 'forwards' }).finished;
    await stage.animate([small, full], { duration: ms, easing: 'cubic-bezier(0.65, 0, 0.25, 1)', fill: 'forwards' }).finished;
  }

  /** The DEEPHEART poster up close: the Squire under the heart. */
  private showPoster() {
    this.busy = true;
    this.o.sound('open', { vol: 0.4 });
    const wrap = document.createElement('div');
    wrap.className = 'dr-poster';
    const art = document.createElement('canvas');
    art.width = 64;
    art.height = 96;
    const ctx = art.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    px(ctx, 0, 0, 64, 96, '#241a2a');
    px(ctx, 2, 2, 60, 92, '#3a2850');
    ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'].forEach((row, y) => [...row].forEach((c, x) => c === '#' && px(ctx, 25 + x * 2, 6 + y * 2, 2, 2, '#ff5a7e')));
    px(ctx, 14, 86, 36, 1, '#f2c14e');
    px(ctx, 18, 89, 28, 1, '#f2c14e');
    drawSprite(ctx, 'knight_m', 0, 32, 84, false, false, 2);
    wrap.innerHTML = '<p><b>DEEPHEART</b><small>Collect every card!</small></p>';
    wrap.prepend(art);
    this.screen.appendChild(wrap);
    this.closePoster = () => {
      this.closePoster = null;
      wrap.remove();
      this.o.sound('close', { vol: 0.4 });
      this.busy = false;
    };
  }

  private openBinder() {
    this.busy = true;
    this.o.sound('open', { vol: 0.6 });
    const { cards, colors } = this.o.binder();
    // A slot for every card in every color it comes in, and again in gold.
    const slots = cards.flatMap((c) => colors.flatMap((_, l) => (!c.laps.includes(l) ? [] : c.canGold ? [c.n[l], c.gold[l]] : [c.n[l]])));
    void this.say(`Your binders have ${slots.length} slots. You've filled ${slots.filter((n) => n > 0).length}.`, true);
    return new Promise<void>((resolve) => {
      this.binder = new Binder(this.screen, cards, colors, (n) => this.o.sound(n, { vol: n === 'click' ? 0.3 : n === 'drop2' ? 0.7 : 0.5 }), () => {
        this.binder = null;
        this.box.hidden = true;
        this.o.sound('close', { vol: 0.5 });
        this.o.seen();
        this.busy = !this.roaming;
        resolve();
      });
    });
  }

  /** Keep playing: the run starts over (the awakening itself) and the view zooms back into the playset. */
  private async sleep() {
    if (this.finished) return;
    this.finished = true;
    this.busy = true;
    this.binder?.close();
    this.prompt.hidden = true;
    this.box.hidden = true;
    if (this.map.id !== 'bedroom') this.enterMap('bedroom');
    this.o.sleep?.();
    // A moment for the dungeon to rebuild at the top before it fills the screen.
    await this.wait(250);
    this.o.sound('descend', { vol: 0.5 });
    await this.zoomIn(PULL_MS.back);
    removeEventListener('keydown', this.onKey);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('resize', this.fit);
    cancelAnimationFrame(this.raf);
    this.el.remove();
    const stage = document.getElementById('stage');
    if (stage) {
      for (const a of stage.getAnimations()) a.cancel();
      stage.style.zIndex = '';
    }
    document.body.classList.remove('dreaming');
    this.o.done();
  }

  // ---------- talking ----------

  /** Types a line into the box; resolves when it's read (a tap once it's all out). `stay` leaves it up and resolves once typed. */
  private say(line: string, stay = false) {
    this.box.hidden = false;
    this.box.classList.remove('done', 'last');
    this.text.textContent = '';
    return new Promise<void>((resolve) => {
      let i = 0;
      const out = () => {
        if (this.typing !== null) clearInterval(this.typing);
        this.typing = null;
        this.text.textContent = line;
        this.box.classList.add('done');
        if (stay) {
          this.box.classList.add('last');
          this.advance = null;
          resolve();
        } else this.advance = resolve;
      };
      if (this.typing !== null) clearInterval(this.typing);
      this.typing = window.setInterval(() => {
        i++;
        this.text.textContent = line.slice(0, i);
        if (i % 2 && line[i - 1] !== ' ') this.o.sound('click', { vol: 0.12, rate: 1.6, jitter: 0.05 });
        if (i >= line.length) out();
      }, TYPE_MS);
      // A tap mid-line prints the rest at once.
      this.advance = out;
    });
  }

  private async talk(lines: string[]) {
    this.busy = true;
    for (const line of lines) await this.say(line);
    this.box.hidden = true;
    this.busy = false;
  }

  /** A question with a little menu of answers, like the old handhelds: arrows and Enter, or tap one. */
  private ask(question: string, answers: string[]) {
    void this.say(question, true);
    const menu = this.el.querySelector<HTMLElement>('.dr-menu')!;
    let at = 0;
    const draw = () => (menu.innerHTML = answers.map((a, k) => `<button data-k="${k}"${k === at ? ' class="on"' : ''}>${a}</button>`).join(''));
    draw();
    menu.hidden = false;
    menu.onmouseover = (e) => {
      at = pointedAt(menu, e, at);
    };
    return new Promise<number>((resolve) => {
      const pick = (k: number) => {
        menu.hidden = true;
        menu.onclick = null;
        menu.onmouseover = null;
        this.choose = null;
        this.box.hidden = true;
        this.o.sound('click', { vol: 0.3 });
        resolve(k);
      };
      menu.onclick = (e) => {
        e.stopPropagation();
        const b = (e.target as HTMLElement).closest<HTMLElement>('[data-k]');
        if (b) pick(Number(b.dataset.k));
      };
      this.choose = (by) => {
        if (by === 0) return pick(at);
        at = (at + by + answers.length) % answers.length;
        draw();
        this.o.sound('click', { vol: 0.15 });
      };
    });
  }


  /** The pause menu, down the right like the old handhelds' Start menu: Escape (or a tap on the hint under the screen). */
  private openMenu() {
    if (!this.roaming || this.busy || this.finished) return;
    this.busy = true;
    this.path = [];
    this.then = null;
    this.o.sound('open', { vol: 0.3 });
    const menu = this.el.querySelector<HTMLElement>('.dr-start')!;
    const items = () => [
      ['binder', 'Binder'],
      ['play', 'Keep playing'],
      ['sound', `Sound: ${this.o.muted() ? 'off' : 'on'}`],
      ['menu', 'Main menu'],
      ['close', 'Close'],
    ];
    let at = 0;
    const draw = () => (menu.innerHTML = items().map(([, label], k) => `<button data-k="${k}"${k === at ? ' class="on"' : ''}>${label}</button>`).join(''));
    const close = () => {
      menu.hidden = true;
      menu.onclick = null;
      menu.onmouseover = null;
      this.choose = null;
      this.cancel = null;
      this.busy = false;
    };
    const pick = (k: number) => {
      const id = items()[k][0];
      this.o.sound('click', { vol: 0.3 });
      if (id === 'sound') {
        this.o.toggleSound();
        return draw();
      }
      close();
      if (id === 'binder') void this.openBinder();
      else if (id === 'play') void this.sleep();
      else if (id === 'menu') this.o.mainMenu();
    };
    draw();
    menu.hidden = false;
    menu.onmouseover = (e) => {
      at = pointedAt(menu, e, at);
    };
    menu.onclick = (e) => {
      e.stopPropagation();
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-k]');
      if (b) pick(Number(b.dataset.k));
    };
    this.choose = (by) => {
      if (by === 0) return pick(at);
      at = (at + by + items().length) % items().length;
      draw();
      this.o.sound('click', { vol: 0.15 });
    };
    this.cancel = () => {
      this.o.sound('close', { vol: 0.3 });
      close();
    };
  }

  // ---------- using things ----------

  private async use(t: Target) {
    if (this.busy) return;
    if (t.kind === 'npc') {
      const n = t.npc;
      this.faceKid(n);
      if (n.def.id === 'dan' || n.def.id === 'victor') {
        if (!this.o.talkedTo.includes(n.def.id)) {
          this.o.talkedTo.push(n.def.id);
          this.o.talkTo(n.def.id);
        }
        this.busy = true;
        this.trading = true;
        return this.o.trade(n.def.id, this.el, () => {
          this.trading = false;
          this.busy = false;
          this.faceBack(n);
        });
      }
      if (n.def.id === 'friend' && !this.o.gifts.includes('Pip')) {
        await this.talk([`You've got ${cards(this.o.found)}? I've only got six.`, "Here, have one of my doubles. Everybody's got to start somewhere."]);
        await this.giveCard('Pip');
        return this.faceBack(n);
      }
      await this.talk(linesFor(n.def.id, this.o));
      return this.faceBack(n);
    }
    if (t.kind === 'warp') return;
    if (t.id === 'playset') {
      this.busy = true;
      const yes = (await this.ask('Keep playing?', ['Yes', 'No'])) === 0;
      this.busy = false;
      if (yes) void this.sleep();
      return;
    }
    if (t.id === 'binder') return void this.openBinder();
    if (t.id === 'poster') return this.showPoster();
    if (t.id === 'koko') {
      this.pettedAt = performance.now();
      return this.talk(['Koko: Prrrrrr...']);
    }
    this.o.sound('click', { vol: 0.25 });
    return this.talk(linesFor(t.id, this.o));
  }

  private stashHere() {
    if (this.kid.move) return null;
    return STASHES.find((s) => s.map === this.map.id && s.x === this.kid.x && s.y === this.kid.y) ?? null;
  }

  private async search(spot: (typeof STASHES)[number]) {
    const name = this.o.stash(spot.id);
    if (!name) return this.talk(['Nothing else here.']);
    this.o.sound('jackpot', { vol: 0.35 });
    await this.talk([spot.look, `A card! ${name}.`]);
  }

  /** The brothers on the rug, the first time you look up from your figures: you overhear their game, then they notice
   *  you (a "!" over each, as on the old handhelds) and turn to you. With next to no cards yet, Dan gives you one. */
  private async brosTalk() {
    const bros = this.npcs.filter((n) => n.def.id === 'dan' || n.def.id === 'victor');
    await this.talk(BROS_OVERHEARD);
    for (const n of bros) this.faceKid(n);
    this.noticedAt = performance.now();
    this.o.sound('click', { vol: 0.4, rate: 1.8 });
    await this.wait(NOTICE_MS);
    if (this.o.found >= 2) await this.talk(BROS_MANY(this.o.found));
    else {
      await this.talk(['Dan: Done playing? Come trade with us!', this.o.found ? "Dan: Oh, you've only got one card? Here, take this one." : "Dan: Oh, you don't have any cards yet? Here, take this one."]);
      await this.giveCard('Dan');
      await this.talk(["Dan: Come back when you have more and I'll trade you!", 'Victor: Ha! Better come to me for gold cards!']);
    }
    for (const n of bros) this.faceBack(n);
    this.o.brosMet = true;
    this.o.meetBros();
  }

  /** Someone turns to face you. */
  private faceKid(n: Npc) {
    n.dir = this.kid.x < n.x ? 'left' : this.kid.x > n.x ? 'right' : this.kid.y < n.y ? 'up' : 'down';
    if (n.dir === 'left' || n.dir === 'right') n.left = n.dir === 'left';
    n.nextAt = performance.now() / 1000 + 4;
  }

  /** Someone's one spare card. */
  private async giveCard(who: string) {
    const name = this.o.gift(who);
    this.o.gifts.push(who);
    if (!name) return;
    this.o.found++;
    this.o.sound('jackpot', { vol: 0.35 });
    await this.talk([`${who} gave you a card! ${name}.`]);
  }

  /** Back to what they were doing (the brothers to their game) once you're done with them. */
  private faceBack(n: Npc) {
    if (n.def.roam) return;
    n.dir = n.def.dir;
    n.left = n.def.dir === 'left';
  }

  /** Walk up to something (if you're not next to it already), face it and use it. The poster, over the bed, you just
   *  look at from where you are. */
  private goUse(t: Target) {
    if (this.busy) return;
    if (t.kind === 'prop' && t.id === 'poster') return void this.use(t);
    if (t.kind === 'warp') {
      // Any tile of the same way out (the doormat is two wide): the nearest.
      const path = this.route((x, y) => this.map.warps.some((w) => w.to === t.warp.to && w.x === x && w.y === y));
      if (path) {
        this.path = path;
        this.then = null;
      }
      return;
    }
    const tiles = this.targetTiles(t);
    const near = (x: number, y: number) => tiles.some(([tx, ty]) => Math.abs(tx - x) + Math.abs(ty - y) === 1);
    const face = () => {
      const dist = (p: [number, number]) => Math.abs(p[0] - this.kid.x) + Math.abs(p[1] - this.kid.y);
      const [tx, ty] = tiles.reduce((a, b) => (dist(b) < dist(a) ? b : a));
      this.turn(tx > this.kid.x ? 'right' : tx < this.kid.x ? 'left' : ty < this.kid.y ? 'up' : 'down');
      void this.use(t);
    };
    if (near(this.kid.x, this.kid.y) && !this.kid.move) return face();
    const goals = new Set<string>();
    for (const [tx, ty] of tiles) for (const [dx, dy] of Object.values(STEP)) if (!this.solid(tx + dx, ty + dy)) goals.add(`${tx + dx},${ty + dy}`);
    const path = this.route((x, y) => goals.has(`${x},${y}`));
    if (!path) return;
    this.path = path;
    this.then = face;
  }

  private targetTiles(t: Target): [number, number][] {
    if (t.kind === 'npc') return [[t.npc.x, t.npc.y]];
    if (t.kind === 'warp') return [[t.warp.x, t.warp.y]];
    const out: [number, number][] = [];
    for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) out.push([x, y]);
    return out;
  }

  private targetAt(x: number, y: number): Target | null {
    const npc = this.npcs.find((n) => n.x === x && n.y === y);
    if (npc) return this.npcTarget(npc);
    const p = propAt(this.map, x, y);
    if (p?.use) return this.propTarget(p);
    return null;
  }

  private propTarget(p: MapDef['props'][number]): Target {
    const use = p.use!;
    return { kind: 'prop', id: use.id, label: use.label, x: p.x, y: p.y, w: p.w ?? 1, h: p.h ?? 1, hit: use.hit };
  }

  private npcTarget(npc: Npc): Target {
    return { kind: 'npc', npc, label: npc.def.id === 'dan' || npc.def.id === 'victor' ? `Trade with ${npc.def.name}` : `Talk to ${npc.def.name}` };
  }

  /** What's drawn at this point of the world: a person anywhere on their figure (the front one first), else a thing
   *  you can use, where it's drawn. */
  private targetAtPoint(x: number, y: number): Target | null {
    const npc = [...this.npcs].sort((a, b) => b.y - a.y).find((n) => {
      const f = figure(n);
      return x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h;
    });
    if (npc) return this.npcTarget(npc);
    const p = this.map.props.find((q) => {
      if (!q.use) return false;
      const [hx, hy, hw, hh] = q.use.hit;
      // The binder's "!" (new cards) counts as the binder.
      const top = q.use.id === 'binder' && this.o.hasNew() ? BINDER_MARK[1] - 1 : hy;
      return x >= hx && x < hx + hw && y >= top && y < hy + hh;
    });
    if (p) return this.propTarget(p);
    const w = this.map.warps.find(({ hit: [hx, hy, hw, hh] }) => x >= hx && x < hx + hw && y >= hy && y < hy + hh);
    return w ? { kind: 'warp', warp: w, label: w.label, hit: w.hit } : null;
  }

  /** What the prompt bubble offers: whatever you're hovering, else whatever you're facing. */
  private promptTarget(): Target | null {
    if (!this.roaming || this.busy) return null;
    if (this.hover) return this.hover;
    if (!this.usingKeys || this.kid.move) return null;
    const [dx, dy] = STEP[this.kid.dir];
    return this.targetAt(this.kid.x + dx, this.kid.y + dy);
  }

  // ---------- walking ----------

  private enterMap(id: MapId) {
    this.map = MAPS[id];
    if (!this.bases.has(id)) {
      const c = document.createElement('canvas');
      c.width = this.map.w * T;
      c.height = this.map.h * T;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      this.map.draw(ctx);
      this.bases.set(id, c);
    }
    this.npcs = this.map.npcs.map((def) => ({ def, x: def.x, y: def.y, dir: def.dir, left: def.dir === 'left', move: null, nextAt: performance.now() / 1000 + 1 + Math.random() * 2 }));
    this.hover = null;
  }

  private solid(x: number, y: number) {
    return blocked(this.map, x, y) || this.npcs.some((n) => n.x === x && n.y === y);
  }

  private warpAt(x: number, y: number) {
    return this.map.warps.find((w) => w.x === x && w.y === y);
  }

  /** Shortest walk to a tile that passes `goal` (doors count only as the last step). */
  private route(goal: (x: number, y: number) => boolean): [number, number][] | null {
    const from = `${this.kid.x},${this.kid.y}`;
    const prev = new Map<string, string>([[from, '']]);
    const queue: [number, number][] = [[this.kid.x, this.kid.y]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      const key = `${x},${y}`;
      if (key !== from && goal(x, y)) {
        const out: [number, number][] = [];
        for (let k = key; k !== from; k = prev.get(k)!) out.unshift(k.split(',').map(Number) as [number, number]);
        return out;
      }
      if (key !== from && this.warpAt(x, y)) continue;
      for (const [dx, dy] of Object.values(STEP)) {
        const nx = x + dx;
        const ny = y + dy;
        const k = `${nx},${ny}`;
        if (prev.has(k)) continue;
        if (this.solid(nx, ny) && !(this.warpAt(nx, ny) && goal(nx, ny))) continue;
        prev.set(k, key);
        queue.push([nx, ny]);
      }
    }
    return null;
  }

  /** The walk that gets closest to a tile you can't stand on (furniture, a wall): the reachable tile nearest it, by the
   *  shortest way there. Null if that's where you are. */
  private routeNear(x: number, y: number): [number, number][] | null {
    const dist = (tx: number, ty: number) => Math.abs(tx - x) + Math.abs(ty - y);
    let best = dist(this.kid.x, this.kid.y);
    let goal: string | null = null;
    const seen = new Set<string>([`${this.kid.x},${this.kid.y}`]);
    const queue: [number, number][] = [[this.kid.x, this.kid.y]];
    while (queue.length) {
      const [cx, cy] = queue.shift()!;
      for (const [dx, dy] of Object.values(STEP)) {
        const nx = cx + dx;
        const ny = cy + dy;
        const k = `${nx},${ny}`;
        if (seen.has(k) || this.solid(nx, ny) || this.warpAt(nx, ny)) continue;
        seen.add(k);
        queue.push([nx, ny]);
        if (dist(nx, ny) < best) {
          best = dist(nx, ny);
          goal = k;
        }
      }
    }
    return goal ? this.route((tx, ty) => `${tx},${ty}` === goal) : null;
  }

  private turn(dir: Dir) {
    this.kid.dir = dir;
    if (dir === 'left' || dir === 'right') this.kid.left = dir === 'left';
  }

  /** One step: into a doorway, onto a free tile, or just turning to face a wall. */
  private step(dir: Dir) {
    this.turn(dir);
    const [dx, dy] = STEP[dir];
    const nx = this.kid.x + dx;
    const ny = this.kid.y + dy;
    if (this.solid(nx, ny) && !this.warpAt(nx, ny)) return false;
    this.kid.move = { fx: this.kid.x, fy: this.kid.y, t: 0 };
    this.kid.x = nx;
    this.kid.y = ny;
    return true;
  }

  private arrive() {
    const w = this.warpAt(this.kid.x, this.kid.y);
    if (w) return void this.warp(w.to, w.tx, w.ty, w.dir);
    if ((this.kid.x + this.kid.y) % 2 === 0) this.o.sound(`step${(this.kid.x * 3 + this.kid.y) % 5}` as SfxName, { vol: 0.08, rate: 1.3 });
    this.walkOn();
  }

  /** Take the next step along the path, or do whatever the walk was for. */
  private walkOn() {
    const next = this.path.shift();
    if (next) {
      const dir: Dir = next[0] > this.kid.x ? 'right' : next[0] < this.kid.x ? 'left' : next[1] > this.kid.y ? 'down' : 'up';
      if (!this.step(dir)) {
        this.path = [];
        this.then = null;
      }
      return;
    }
    const then = this.then;
    this.then = null;
    then?.();
  }

  private async warp(to: MapId, x: number, y: number, dir: Dir) {
    this.busy = true;
    this.path = [];
    this.then = null;
    this.o.sound('open', { vol: 0.35, rate: 1.2 });
    this.fade.classList.add('on');
    await this.wait(220);
    this.enterMap(to);
    this.kid = { x, y, dir, left: dir === 'left', move: null };
    this.fade.classList.remove('on');
    await this.wait(160);
    this.busy = false;
  }

  private update(dt: number, now: number) {
    const k = this.kid;
    if (k.move) {
      k.move.t += dt / STEP_S;
      if (k.move.t >= 1) {
        k.move = null;
        this.arrive();
      }
    } else if (!this.busy && this.roaming) {
      const held = this.held[this.held.length - 1];
      if (held) {
        this.path = [];
        this.then = null;
        this.step(held);
      } else if (this.path.length) this.walkOn();
    }
    for (const n of this.npcs) {
      if (n.move) {
        n.move.t += dt / NPC_STEP_S;
        if (n.move.t >= 1) n.move = null;
        continue;
      }
      if (!n.def.roam || this.busy || now < n.nextAt) continue;
      n.nextAt = now + 1.2 + Math.random() * 2.5;
      const dir = (['up', 'down', 'left', 'right'] as Dir[])[Math.floor(Math.random() * 4)];
      const [dx, dy] = STEP[dir];
      const [x0, y0, x1, y1] = n.def.roam;
      const nx = n.x + dx;
      const ny = n.y + dy;
      n.dir = dir;
      if (dir === 'left' || dir === 'right') n.left = dir === 'left';
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || blocked(this.map, nx, ny) || (nx === k.x && ny === k.y) || this.path.some(([pathX, pathY]) => pathX === nx && pathY === ny)) continue;
      n.move = { fx: n.x, fy: n.y, t: 0 };
      n.x = nx;
      n.y = ny;
    }
  }

  // ---------- input ----------

  /** The point of the world under the pointer (pixels). */
  private worldAt(e: PointerEvent | MouseEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    const cam = this.camera();
    return [((e.clientX - r.left) / r.width) * W + cam.x, ((e.clientY - r.top) / r.height) * H + cam.y];
  }

  private onHover = (e: PointerEvent) => {
    if (!this.roaming || e.pointerType !== 'mouse') return;
    this.usingKeys = false;
    this.hover = this.targetAtPoint(...this.worldAt(e));
    this.canvas.style.cursor = this.hover ? 'pointer' : 'default';
  };

  private onTap = (e: PointerEvent) => {
    if (this.closePoster) return this.closePoster();
    if ((e.target as HTMLElement).closest('button, .bnd, .dr-menu, .tm-wrap')) return;
    if (this.cancel) return this.cancel();
    if (this.advance) {
      const go = this.advance;
      this.advance = null;
      return go();
    }
    if (!this.roaming || this.busy || e.target !== this.canvas) return;
    const [wx, wy] = this.worldAt(e);
    const x = Math.floor(wx / T);
    const y = Math.floor(wy / T);
    // Tapping yourself (feet or head) while standing on a hiding spot; tapping it from afar just walks there.
    const spot = this.stashHere();
    if (spot && x === this.kid.x && (y === this.kid.y || y === this.kid.y - 1)) return void this.search(spot);
    const t = this.targetAtPoint(wx, wy);
    if (t) return this.goUse(t);
    const path = this.route((tx, ty) => tx === x && ty === y) ?? this.routeNear(x, y);
    if (path) {
      this.path = path;
      this.then = null;
    }
  };

  private onKey = (e: KeyboardEvent) => {
    if (this.binder || this.trading) return;
    if (this.closePoster) {
      if (['Escape', 'Enter', ' ', 'e', 'z'].includes(e.key)) {
        e.preventDefault();
        this.closePoster();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.cancel) this.cancel();
      else if (!this.choose) this.openMenu();
      return;
    }
    const dir = KEY_DIRS[e.key.toLowerCase()];
    const ok = e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'z';
    if (!dir && !ok) return;
    e.preventDefault();
    if (this.choose) {
      if (ok && !e.repeat) this.choose(0);
      else if (dir === 'up' || dir === 'down') this.choose(dir === 'up' ? -1 : 1);
      return;
    }
    if (dir) {
      this.usingKeys = true;
      this.hover = null;
      if (!this.held.includes(dir)) this.held.push(dir);
      return;
    }
    if (e.repeat) return;
    if (this.advance) {
      const go = this.advance;
      this.advance = null;
      return go();
    }
    if (!this.roaming || this.busy || this.kid.move) return;
    const t = this.promptTarget();
    if (t) void this.use(t);
    else if (this.stashHere()) void this.search(this.stashHere()!);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const dir = KEY_DIRS[e.key.toLowerCase()];
    if (dir) this.held = this.held.filter((d) => d !== dir);
  };

  private fit = () => {
    const s = Math.min((innerWidth - 24) / W, (innerHeight - 72) / H, 5);
    this.screen.style.setProperty('--s', `${s}`);
  };

  private wait(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }

  // ---------- drawing ----------

  private camera() {
    const k = this.kid;
    const p = k.move ? Math.min(1, k.move.t) : 1;
    const fx = k.move ? k.move.fx + (k.x - k.move.fx) * p : k.x;
    const fy = k.move ? k.move.fy + (k.y - k.move.fy) * p : k.y;
    const cx = Math.round(fx * T + 8 - W / 2);
    const cy = Math.round(fy * T + 8 - H / 2);
    return { x: Math.max(0, Math.min(this.map.w * T - W, cx)), y: Math.max(0, Math.min(this.map.h * T - H, cy)) };
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = (now - this.start) / 1000;
    this.update(dt, now / 1000);
    this.renderWorld(this.frame.getContext('2d')!, t);
    this.ctx.drawImage(this.frame, 0, 0);
    this.placePrompt();
  };

  private renderWorld(ctx: CanvasRenderingContext2D, t: number) {
    ctx.imageSmoothingEnabled = false;
    const cam = this.camera();
    ctx.drawImage(this.bases.get(this.map.id)!, cam.x, cam.y, W, H, 0, 0, W, H);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    if (this.map.id === 'bedroom') {
      this.drawBrosGame(ctx);
      // Little figures of the real thing: the party lined up on the dresser, a fight going on in the playset.
      const fig = (sprite: string, [x, y]: number[], left = false) => drawSprite(ctx, sprite, 0, x, y, left, false, 0.5);
      this.o.figures.shelf.forEach((sprite, k) => SHELF_SPOTS[k] && fig(sprite, SHELF_SPOTS[k]));
      this.o.figures.party.forEach((sprite, k) => PARTY_SPOTS[k] && fig(sprite, PARTY_SPOTS[k]));
      this.o.figures.foes.forEach((sprite, k) => FOE_SPOTS[k] && fig(sprite, FOE_SPOTS[k], true));
      // The hero's figure: held up in the kid's hand mid-adventure, or back on the playset.
      if (!this.holding) fig(this.o.hero.sprite, HERO_SPOT);
      // A "!" over the binder on the desk while it has cards you haven't seen.
      if (this.roaming && this.o.hasNew()) bang(ctx, BINDER_MARK[0], BINDER_MARK[1] - (Math.floor(t * 3) % 2));
    }
    if (this.map.id === 'house') drawKoko(ctx, t, (performance.now() - this.pettedAt) / 1000);
    // People, nearest the bottom drawn last.
    const walkers: { w: Walker; sprite: string }[] = this.npcs.map((n) => ({ w: n, sprite: n.def.sprite }));
    walkers.push({ w: this.kid, sprite: KID });
    walkers.sort((a, b) => a.w.y - b.w.y);
    for (const { w, sprite } of walkers) {
      const p = w.move ? Math.min(1, w.move.t) : 1;
      const fx = w.move ? w.move.fx + (w.x - w.move.fx) * p : w.x;
      const fy = w.move ? w.move.fy + (w.y - w.move.fy) * p : w.y;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(Math.round(fx * T + 3), Math.round(fy * T + 13), 10, 3);
      drawSprite(ctx, sprite, t, fx * T + 8, fy * T + 15, w.left, !!w.move);
    }
    if (this.holding) drawSprite(ctx, this.o.hero.sprite, 0, this.kid.x * T + 15, this.kid.y * T + 4 - (Math.floor(t * 4) % 2), false, false, 0.5);
    if (performance.now() - this.noticedAt < NOTICE_MS * 2) {
      for (const n of this.npcs) if (n.def.id === 'dan' || n.def.id === 'victor') bang(ctx, n.x * T + 5, figure(n).y - 12);
    }
    if (this.roaming && this.o.brosMet) {
      for (const n of this.npcs) if ((n.def.id === 'dan' || n.def.id === 'victor') && !this.o.talkedTo.includes(n.def.id)) arrowOver(ctx, n, t);
    }
    if (this.hover && this.roaming && !this.busy) hoverMark(ctx, this.hover, t);
    if (SHOW_HITS) {
      ctx.fillStyle = 'rgba(255, 0, 200, 0.35)';
      for (const p of this.map.props) if (p.use) ctx.fillRect(...p.use.hit);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.35)';
      for (const n of this.npcs) {
        const f = figure(n);
        ctx.fillRect(f.x, f.y, f.w, f.h);
      }
    }
    ctx.restore();
  }

  /** The brothers' card game on the rug: a deck by each of them, a card each laid out, and the pile between. */
  private drawBrosGame(ctx: CanvasRenderingContext2D) {
    const card = (x: number, y: number, face: string | null) => {
      px(ctx, x, y, 5, 7, '#241a2a');
      if (face) {
        px(ctx, x + 1, y + 1, 3, 5, '#fff');
        px(ctx, x + 1, y + 2, 3, 2, face);
      } else {
        px(ctx, x + 1, y + 1, 3, 5, '#3a2850');
        px(ctx, x + 2, y + 3, 1, 1, '#ff5a7e');
      }
    };
    const g = BROS_GAME;
    for (const [x, y] of [g.danDeck, g.victorDeck]) {
      card(x + 1, y + 1, null);
      card(x, y, null);
    }
    card(g.danLaid[0], g.danLaid[1], CARD_INKS[1]);
    card(g.victorLaid[0], g.victorLaid[1], CARD_INKS[4]);
    card(g.pile[0] + 1, g.pile[1] + 1, CARD_INKS[2]);
    card(g.pile[0], g.pile[1], CARD_INKS[0]);
  }

  /** The "▶ Keep playing" bubble over whatever you could use. */
  private placePrompt() {
    this.escHint.hidden = !this.roaming || this.finished;
    const t = this.promptTarget();
    if (!t) {
      this.prompt.hidden = true;
      return;
    }
    const cam = this.camera();
    // Just over what it names (a person's head, a thing as it's drawn), or under it when that's up against the top.
    // (Over a person, it clears the hover arrow over their head.)
    const f = t.kind === 'npc' ? { ...figure(t.npc), y: figure(t.npc).y - 8 } : { x: t.hit[0], y: t.hit[1], w: t.hit[2], h: t.hit[3] };
    const below = f.y - cam.y < PROMPT_H;
    this.prompt.hidden = false;
    if (this.prompt.textContent !== `▶ ${t.label}`) this.prompt.textContent = `▶ ${t.label}`;
    this.prompt.classList.toggle('below', below);
    this.prompt.style.setProperty('--px', `${f.x + f.w / 2 - cam.x}`);
    this.prompt.style.setProperty('--py', `${(below ? f.y + f.h : f.y) - cam.y}`);
  }
}
