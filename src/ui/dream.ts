import type { SfxName } from '../audio/sfx.ts';
import { Binder, type BinderCard } from './binder.ts';
import { G, spriteFrames } from './px.ts';
import { BED_KID, BROS_GAME, CARD_SPOTS, MAPS, STEP, T, blanket, blocked, drawSprite, propAt, px, type Dir, type MapDef, type MapId, type NpcDef } from './world.ts';

/**
 * Waking up: the dungeon was the kid's dream, and the cards are real. A handheld-sized world (160×144) you can walk
 * around: the bedroom, downstairs, the town outside. The first time plays the whole reveal; later awakenings just
 * wake, add the new cards to the binder and let you wander. Getting back into bed is how you go back down.
 */

const W = 160;
const H = 144;
const TYPE_MS = 28;
const DISSOLVE_MS = 1500;
const CARD_GAP_MS = 140;
const STEP_S = 0.2;
const NPC_STEP_S = 0.36;
const KID = 'cr_beanie_kid';
/** Where the kid stands after getting up: beside the bed, facing the room. */
const GET_UP = { x: 3, y: 4, dir: 'down' as Dir };
const CARD_INKS = ['#c8423f', '#4a78c8', '#5aa050', '#f2c14e', '#8a5ac8', '#e08a3a'];
/** A 4×4 ordered-dither threshold map: the dissolve fills in 2×2 blocks in this order, like an old handheld. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const KEY_DIRS: Record<string, Dir> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };

export interface DreamOpts {
  /** The whole reveal (first awakening) or a short wake-up. */
  first: boolean;
  found: number;
  /** The binder as it is right now (trades add cards while you're awake). */
  binder: () => { cards: BinderCard[]; found: number };
  /** You've looked through the binder: nothing's new any more. */
  seen: () => void;
  /** Are there cards in the binder you haven't looked at yet? */
  hasNew: () => boolean;
  /** Cards found since the last time you woke. */
  fresh: number;
  sound: (name: SfxName, o?: { vol?: number; rate?: number; jitter?: number }) => void;
  /** Talking to a brother opens his trade window over the screen. */
  trade: (who: 'daniel' | 'victor', host: HTMLElement, closed: () => void) => void;
  /** Runs once the screen is black on the way in. */
  cover?: () => void;
  /** Runs once the screen is black on the way back down: the awakening itself. */
  sleep?: () => void;
  done: () => void;
}

/** What things say when you use them (the bed and the binder do something instead). */
function linesFor(id: string, o: DreamOpts): string[] {
  const lines: Record<string, string[]> = {
    books: ["Monster books. You've read them all twice."],
    poster: ["Your DEEPHEART poster. The heart almost looks like it's beating."],
    window: ['A sunny morning. Somewhere a bird is very pleased with itself.'],
    toys: ['Your old toy box. A wooden sword sits on top.'],
    kitchen: ['Toast. Cold.'],
    table: ['A bowl of cereal. It went soggy while you slept.'],
    sofa: ['The cushions are still in the shape of a fort.'],
    photo: ["A photo of you in a cardboard knight's helmet."],
    mum: ['Morning, sleepyhead.', 'Cards all over your bed again? You must have been dreaming about that game.'],
    friend: [`You've got ${o.found} Deepheart cards? I've only got six.`, 'Nobody at school has filled a whole binder. Not even close.'],
    fisher: ['Nothing bites in this pond.', 'I played Deepheart when I was your age. Never did fill that binder.'],
    friendDoor: ["Pip's house. Nobody's home."],
    shop: ['DEEPHEART CARDS', 'The sign on the door says: CLOSED. New cards soon!'],
    mailbox: ['Nothing today.'],
    sign: ['BRAMBLEFORD'],
    pond: ['Something glints at the bottom. Probably a coin.'],
    brosGame: ["Daniel and Victor's game. Victor is winning. Obviously."],
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

type Target = { kind: 'prop'; id: string; label: string; x: number; y: number; w: number; h: number } | { kind: 'npc'; npc: Npc; label: string };

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
  private mode: 'black' | 'squire' | 'dissolve' | 'world' = 'black';
  private map: MapDef = MAPS.bedroom;
  private kid: Walker = { x: GET_UP.x, y: GET_UP.y, dir: GET_UP.dir, left: false, move: null };
  private npcs: Npc[] = [];
  private inBed = true;
  private roaming = false;
  /** Talking, in the binder, changing rooms: the kid stands still. */
  private busy = true;
  private path: [number, number][] = [];
  private then: (() => void) | null = null;
  private held: Dir[] = [];
  private hover: Target | null = null;
  private dissolveAt = 0;
  private cardsShown = 0;
  private start = performance.now();
  private last = performance.now();
  private raf = 0;
  private advance: (() => void) | null = null;
  private choose: ((by: number) => void) | null = null;
  private typing: number | null = null;
  private squireData: ImageData | null = null;
  private binder: Binder | null = null;
  /** Awake but still in bed, waiting for you to get up. */
  private lazing = false;
  private trading = false;
  private finished = false;

  constructor(o: DreamOpts) {
    this.o = o;
    this.el = document.createElement('div');
    this.el.className = 'dream';
    this.el.innerHTML = `
      <div class="dr-screen">
        <canvas width="${W}" height="${H}"></canvas>
        <button class="dr-prompt" hidden></button>
        <div class="dr-logo" hidden></div>
        <div class="dr-fade"></div>
        <div class="dr-box" hidden><p></p><i class="dr-more">▼</i></div>
        <div class="dr-menu" hidden></div>
      </div>
      ${o.first ? '' : '<button class="dr-skip">Skip ▸▸</button>'}`;
    this.screen = this.el.querySelector('.dr-screen')!;
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
      if (this.lazing) return this.getUp();
      const t = this.promptTarget();
      if (t) this.goUse(t);
    });
    this.el.querySelector('.dr-skip')?.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.sleep();
    });
    this.raf = requestAnimationFrame(this.loop);
    await this.wait(20);
    this.el.classList.add('in');
    await this.wait(700);
    this.o.cover?.();
    if (this.o.first) await this.reveal();
    else await this.wake();
    if (this.finished) return;
    // The kid stays in bed until you move (a key, a click or a tap gets them up).
    this.box.hidden = true;
    this.lazing = true;
  }

  // ---------- the story ----------

  private async reveal() {
    this.mode = 'squire';
    await this.wait(600);
    await this.say('You wake up.');
    this.renderWorld(this.frame.getContext('2d')!, 0);
    this.mode = 'dissolve';
    this.dissolveAt = performance.now();
    this.o.sound('awaken', { vol: 0.5, rate: 1.3 });
    await this.say("The dungeon was a dream. The cards weren't.");
    this.mode = 'world';
    void this.dealCards(Math.min(this.o.found, CARD_SPOTS.length));
    await this.say('Every monster you beat is on your blanket.');
    await this.logo();
  }

  private async wake() {
    this.mode = 'world';
    this.screen.classList.add('fade-in');
    await this.wait(500);
    await this.dealCards(Math.min(this.o.fresh, CARD_SPOTS.length));
    const n = this.o.fresh;
    await this.say(n ? `You wake up. ${n} new card${n === 1 ? '' : 's'}.` : 'You wake up.');
  }

  private getUp() {
    if (this.finished) return;
    this.lazing = false;
    this.inBed = false;
    this.kid = { x: GET_UP.x, y: GET_UP.y, dir: GET_UP.dir, left: false, move: null };
    this.box.hidden = true;
    this.roaming = true;
    this.busy = false;
    this.o.sound('step2', { vol: 0.3 });
  }

  private openBinder() {
    this.busy = true;
    this.o.sound('open', { vol: 0.6 });
    const { cards, found } = this.o.binder();
    void this.say(`Your binder has ${cards.length} slots. You've filled ${found}.`, true);
    return new Promise<void>((resolve) => {
      this.binder = new Binder(this.screen, cards, (n) => this.o.sound(n, { vol: n === 'click' ? 0.3 : n === 'drop2' ? 0.7 : 0.5 }), () => {
        this.binder = null;
        this.box.hidden = true;
        this.o.sound('close', { vol: 0.5 });
        this.o.seen();
        this.busy = !this.roaming;
        resolve();
      });
    });
  }

  /** Back into bed, the screen goes dark, and down you go: the real awakening happens here. */
  private async sleep() {
    if (this.finished) return;
    this.finished = true;
    this.busy = true;
    this.binder?.close();
    this.prompt.hidden = true;
    this.box.hidden = true;
    this.inBed = true;
    if (this.map.id !== 'bedroom') this.enterMap('bedroom');
    this.o.sound('close', { vol: 0.5 });
    this.fade.classList.add('on', 'slow');
    await this.wait(900);
    this.o.sleep?.();
    this.el.classList.add('out');
    removeEventListener('keydown', this.onKey);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('resize', this.fit);
    await this.wait(700);
    cancelAnimationFrame(this.raf);
    this.el.remove();
    document.body.classList.remove('dreaming');
    this.o.done();
  }

  private async logo() {
    const l = this.el.querySelector<HTMLElement>('.dr-logo')!;
    l.innerHTML = `${G.heart(5)}<b>${[...'DEEPHEART'].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</b><i class="dr-more">▼</i>`;
    l.hidden = false;
    this.box.hidden = true;
    this.o.sound('jackpot', { vol: 0.6 });
    await this.wait(1600);
    l.classList.add('ready');
    await new Promise<void>((resolve) => (this.advance = resolve));
    l.hidden = true;
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
    return new Promise<number>((resolve) => {
      const pick = (k: number) => {
        menu.hidden = true;
        menu.onclick = null;
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

  private async dealCards(n: number) {
    for (let k = 0; k < n; k++) {
      this.cardsShown = k + 1;
      this.o.sound('card', { vol: 0.25, rate: 1.2 + k * 0.04 });
      await this.wait(CARD_GAP_MS);
    }
  }

  // ---------- using things ----------

  private async use(t: Target) {
    if (this.busy) return;
    if (t.kind === 'npc') {
      // They turn to face you.
      const n = t.npc;
      n.dir = this.kid.x < n.x ? 'left' : this.kid.x > n.x ? 'right' : this.kid.y < n.y ? 'up' : 'down';
      if (n.dir === 'left' || n.dir === 'right') n.left = n.dir === 'left';
      n.nextAt = performance.now() / 1000 + 4;
      if (n.def.id === 'daniel' || n.def.id === 'victor') {
        this.busy = true;
        this.trading = true;
        return this.o.trade(n.def.id, this.el, () => {
          this.trading = false;
          this.busy = false;
          this.faceBack(n);
        });
      }
      await this.talk(linesFor(n.def.id, this.o));
      return this.faceBack(n);
    }
    if (t.id === 'bed') {
      this.busy = true;
      const yes = (await this.ask('Go back to sleep?', ['Yes', 'No'])) === 0;
      this.busy = false;
      if (yes) void this.sleep();
      return;
    }
    if (t.id === 'binder') return void this.openBinder();
    this.o.sound('click', { vol: 0.25 });
    return this.talk(linesFor(t.id, this.o));
  }

  /** Back to what they were doing (the brothers to their game) once you're done with them. */
  private faceBack(n: Npc) {
    if (n.def.roam) return;
    n.dir = n.def.dir;
    n.left = n.def.dir === 'left';
  }

  /** Walk up to something (if you're not next to it already), face it and use it. */
  private goUse(t: Target) {
    if (this.busy) return;
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
    const out: [number, number][] = [];
    for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) out.push([x, y]);
    return out;
  }

  private targetAt(x: number, y: number): Target | null {
    const npc = this.npcs.find((n) => n.x === x && n.y === y);
    if (npc) return { kind: 'npc', npc, label: npc.def.id === 'daniel' || npc.def.id === 'victor' ? `Trade with ${npc.def.name}` : `Talk to ${npc.def.name}` };
    const p = propAt(this.map, x, y);
    if (p?.use) return { kind: 'prop', id: p.use.id, label: p.use.label, x: p.x, y: p.y, w: p.w ?? 1, h: p.h ?? 1 };
    return null;
  }

  /** What the prompt bubble offers: whatever you're hovering, else whatever you're facing. */
  private promptTarget(): Target | null {
    if (!this.roaming || this.busy) return null;
    if (this.hover) return this.hover;
    if (this.kid.move) return null;
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

  private tileAt(e: PointerEvent | MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    const cam = this.camera();
    return [Math.floor(((e.clientX - r.left) / r.width) * W + cam.x) >> 4, Math.floor(((e.clientY - r.top) / r.height) * H + cam.y) >> 4];
  }

  private onHover = (e: PointerEvent) => {
    if (!this.roaming || e.pointerType !== 'mouse') return;
    const [x, y] = this.tileAt(e);
    this.hover = this.targetAt(x, y);
    this.canvas.style.cursor = this.hover ? 'pointer' : 'default';
  };

  private onTap = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .bnd, .dr-menu, .tm-wrap')) return;
    if (this.advance) {
      const go = this.advance;
      this.advance = null;
      return go();
    }
    // The first click gets the kid out of bed (and on to wherever you clicked).
    if (this.lazing) this.getUp();
    if (!this.roaming || this.busy || e.target !== this.canvas) return;
    const [x, y] = this.tileAt(e);
    const t = this.targetAt(x, y);
    if (t) return this.goUse(t);
    const path = this.route((tx, ty) => tx === x && ty === y);
    if (path) {
      this.path = path;
      this.then = null;
    }
  };

  private onKey = (e: KeyboardEvent) => {
    if (this.binder || this.trading) return;
    const dir = KEY_DIRS[e.key.toLowerCase()];
    const ok = e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'z';
    if (!dir && !ok) return;
    e.preventDefault();
    if (this.choose) {
      if (ok && !e.repeat) this.choose(0);
      else if (dir === 'up' || dir === 'down') this.choose(dir === 'up' ? -1 : 1);
      return;
    }
    if (this.lazing) this.getUp();
    if (dir) {
      if (!this.held.includes(dir)) this.held.push(dir);
      return;
    }
    if (e.repeat) return;
    if (this.advance) {
      const go = this.advance;
      this.advance = null;
      return go();
    }
    const t = this.roaming && !this.busy && !this.kid.move && this.promptTarget();
    if (t) void this.use(t);
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
    if (this.mode === 'world') this.update(dt, now / 1000);
    const ctx = this.ctx;
    if (this.mode === 'black') {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    if (this.mode === 'squire') return this.drawSquire(t);
    this.renderWorld(this.frame.getContext('2d')!, t);
    if (this.mode === 'dissolve') {
      const p = Math.min(1, (now - this.dissolveAt) / DISSOLVE_MS);
      if (p >= 1) this.mode = 'world';
      else return this.dissolve(p);
    }
    ctx.drawImage(this.frame, 0, 0);
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
      if (this.inBed) drawSprite(ctx, KID, t, BED_KID.cx, BED_KID.bottom);
      blanket(ctx);
      for (let k = 0; k < this.cardsShown; k++) {
        const [x, y] = CARD_SPOTS[k];
        px(ctx, x, y, 5, 7, '#241a2a');
        px(ctx, x + 1, y + 1, 3, 5, '#fff');
        px(ctx, x + 1, y + 2, 3, 2, CARD_INKS[k % CARD_INKS.length]);
      }
      // A "!" over the binder on the desk while it has cards you haven't seen.
      if (this.roaming && this.o.hasNew()) {
        const bob = Math.floor(t * 3) % 2;
        px(ctx, 88, 7 - bob, 7, 10, '#241a2a');
        px(ctx, 89, 8 - bob, 5, 8, '#ff5a7e');
        px(ctx, 91, 9 - bob, 1, 4, '#fff');
        px(ctx, 91, 14 - bob, 1, 1, '#fff');
      }
      // Z z: the bed's waiting for you.
      if (!this.inBed && this.roaming) {
        const bob = Math.floor(t * 2) % 2;
        for (const [zx, zy, s] of [[36, 13 - bob, 5], [44, 6 + bob, 4]]) {
          px(ctx, zx - 1, zy - 1, s + 2, s + 2, 'rgba(36, 26, 42, 0.45)');
          px(ctx, zx, zy, s, 1, '#fff');
          for (let d = 1; d < s - 1; d++) px(ctx, zx + s - 1 - d, zy + d, 1, 1, '#fff');
          px(ctx, zx, zy + s - 1, s, 1, '#fff');
        }
      }
    }
    // People, nearest the bottom drawn last.
    const walkers: { w: Walker; sprite: string }[] = this.npcs.map((n) => ({ w: n, sprite: n.def.sprite }));
    if (!this.inBed && this.roaming) walkers.push({ w: this.kid, sprite: KID });
    walkers.sort((a, b) => a.w.y - b.w.y);
    for (const { w, sprite } of walkers) {
      const p = w.move ? Math.min(1, w.move.t) : 1;
      const fx = w.move ? w.move.fx + (w.x - w.move.fx) * p : w.x;
      const fy = w.move ? w.move.fy + (w.y - w.move.fy) * p : w.y;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(Math.round(fx * T + 3), Math.round(fy * T + 13), 10, 3);
      drawSprite(ctx, sprite, t, fx * T + 8, fy * T + 15, w.left, !!w.move);
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
    for (const [x, y] of [g.danielDeck, g.victorDeck]) {
      card(x + 1, y + 1, null);
      card(x, y, null);
    }
    card(g.danielLaid[0], g.danielLaid[1], CARD_INKS[1]);
    card(g.victorLaid[0], g.victorLaid[1], CARD_INKS[4]);
    card(g.pile[0] + 1, g.pile[1] + 1, CARD_INKS[2]);
    card(g.pile[0], g.pile[1], CARD_INKS[0]);
  }

  /** The "▶ Go back to sleep" bubble over whatever you could use. */
  private placePrompt() {
    if (this.lazing) {
      this.prompt.hidden = false;
      if (this.prompt.textContent !== '▶ Get up') this.prompt.textContent = '▶ Get up';
      this.prompt.style.setProperty('--px', `${BED_KID.cx}`);
      this.prompt.style.setProperty('--py', '26');
      return;
    }
    const t = this.promptTarget();
    if (!t) {
      this.prompt.hidden = true;
      return;
    }
    const cam = this.camera();
    const [x, y, w] = t.kind === 'npc' ? [t.npc.x, t.npc.y - 1, 1] : [t.x, t.y, t.w];
    this.prompt.hidden = false;
    if (this.prompt.textContent !== `▶ ${t.label}`) this.prompt.textContent = `▶ ${t.label}`;
    this.prompt.style.setProperty('--px', `${x * T + (w * T) / 2 - cam.x}`);
    this.prompt.style.setProperty('--py', `${Math.max(10, y * T - cam.y)}`);
  }

  private drawSquire(t: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const sq = spriteFrames('knight_m');
    if (sq) {
      const f = sq.frames[Math.floor(t * 6) % sq.frames.length];
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sq.img, f.x, f.y, f.w, f.h, W / 2 - f.w, 18, f.w * 2, f.h * 2);
    }
    this.squireData = ctx.getImageData(0, 0, W, H);
  }

  /** The Squire on black gives way to the bedroom, 2×2 block by block. */
  private dissolve(p: number) {
    const from = this.squireData;
    const to = this.frame.getContext('2d')!.getImageData(0, 0, W, H);
    if (from) {
      const level = p * 16;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (BAYER[((y >> 1) & 3) * 4 + ((x >> 1) & 3)] < level) continue;
          const i = (y * W + x) * 4;
          to.data[i] = from.data[i];
          to.data[i + 1] = from.data[i + 1];
          to.data[i + 2] = from.data[i + 2];
        }
      }
    }
    this.ctx.putImageData(to, 0, 0);
  }
}
