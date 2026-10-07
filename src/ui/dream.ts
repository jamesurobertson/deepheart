import type { SfxName } from '../audio/sfx.ts';
import { Binder, type BinderCard, type BinderColor } from './binder.ts';
import { BINDER_MARK, STASHES, BROS_GAME, FOE_SPOTS, KID_START, PARTY_SPOTS, SHELF_SPOTS, MAPS, PLAYSET, HERO_SPOT, STEP, T, blocked, drawSprite, propAt, px, type Dir, type MapDef, type MapId, type NpcDef } from './world.ts';

/**
 * The real world behind the dungeon: it was a kid playing with his figures on the bedroom floor. The live dungeon
 * view pulls back and shrinks into the cardboard playset on the rug, and you're in a handheld-sized world (160×144)
 * you can walk around: the bedroom, downstairs, the town outside. Keep playing at the playset to go back in.
 */

const W = 160;
const H = 144;
const TYPE_MS = 28;
/** How long the dungeon takes to shrink into the playset (the first time is the big reveal), and to zoom back in. */
const PULL_MS = { first: 2600, again: 1100, back: 1100 };
const STEP_S = 0.2;
const NPC_STEP_S = 0.36;
const KID = 'cr_beanie_kid';
const CARD_INKS = ['#c8423f', '#4a78c8', '#5aa050', '#f2c14e', '#8a5ac8', '#e08a3a'];
const KEY_DIRS: Record<string, Dir> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };

export interface DreamOpts {
  /** The whole reveal (first awakening) or a short wake-up. */
  first: boolean;
  /** Just popping into the room from the dungeon: no awakening, and only a word if new cards came in. */
  visit?: boolean;
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
  trade: (who: 'daniel' | 'victor', host: HTMLElement, closed: () => void) => void;
  /** Search a hiding spot: the name of the card in it, or null once it's been taken. */
  stash: (spot: string) => string | null;
  /** Runs as the view pulls back out of the dungeon. */
  cover?: () => void;
  /** Runs just before the view zooms back into the playset: the awakening itself. */
  sleep?: () => void;
  done: () => void;
}

/** What things say when you use them (the bed and the binder do something instead). */
function linesFor(id: string, o: DreamOpts): string[] {
  const lines: Record<string, string[]> = {
    poster: ["Your DEEPHEART poster. The heart almost looks like it's beating."],
    window: ['A sunny morning. Somewhere a bird is very pleased with itself.'],
    toys: ['Your figures. Every one of them has been down the dungeon.'],
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
  private start = performance.now();
  private last = performance.now();
  private raf = 0;
  private advance: (() => void) | null = null;
  private choose: ((by: number) => void) | null = null;
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
      </div>`;
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
      const t = this.promptTarget();
      if (t) this.goUse(t);
    });
    this.raf = requestAnimationFrame(this.loop);
    await this.wait(40);
    this.o.cover?.();
    await this.pullBack(this.o.first ? PULL_MS.first : PULL_MS.again);
    const n = this.o.fresh;
    const line = this.o.first ? `...and the ${this.o.hero.name} saves the day!` : n ? `Playtime break. ${n} new card${n === 1 ? '' : 's'}.` : this.o.visit ? '' : 'Playtime break.';
    if (line) await this.say(line);
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

  private openBinder() {
    this.busy = true;
    this.o.sound('open', { vol: 0.6 });
    const { cards, colors } = this.o.binder();
    // A slot for every card in every color it comes in, and again in gold.
    const slots = cards.flatMap((c) => colors.flatMap((_, l) => (l < c.fromLap ? [] : c.canGold ? [c.n[l], c.gold[l]] : [c.n[l]])));
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
    if (t.id === 'playset') {
      this.busy = true;
      const yes = (await this.ask('Keep playing?', ['Yes', 'No'])) === 0;
      this.busy = false;
      if (yes) void this.sleep();
      return;
    }
    if (t.id === 'binder') return void this.openBinder();
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
    if (!this.roaming || this.busy || e.target !== this.canvas) return;
    const [x, y] = this.tileAt(e);
    // Tapping yourself (feet or head) while standing on a hiding spot; tapping it from afar just walks there.
    const spot = this.stashHere();
    if (spot && x === this.kid.x && (y === this.kid.y || y === this.kid.y - 1)) return void this.search(spot);
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
      if (this.roaming && this.o.hasNew()) {
        const bob = Math.floor(t * 3) % 2;
        const [mx, my] = BINDER_MARK;
        px(ctx, mx, my - bob, 7, 10, '#241a2a');
        px(ctx, mx + 1, my + 1 - bob, 5, 8, '#ff5a7e');
        px(ctx, mx + 3, my + 2 - bob, 1, 4, '#fff');
        px(ctx, mx + 3, my + 7 - bob, 1, 1, '#fff');
      }
    }
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

  /** The "▶ Keep playing" bubble over whatever you could use. */
  private placePrompt() {
    const t = this.promptTarget();
    if (!t) {
      this.prompt.hidden = true;
      return;
    }
    const cam = this.camera();
    // People are a little over a tile tall: the bubble sits just over their heads.
    const [x, y, w] = t.kind === 'npc' ? [t.npc.x, t.npc.y - 0.15, 1] : [t.x, t.y, t.w];
    this.prompt.hidden = false;
    if (this.prompt.textContent !== `▶ ${t.label}`) this.prompt.textContent = `▶ ${t.label}`;
    this.prompt.style.setProperty('--px', `${x * T + (w * T) / 2 - cam.x}`);
    this.prompt.style.setProperty('--py', `${Math.max(10, y * T - cam.y)}`);
  }
}
