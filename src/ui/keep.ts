import type { Rect } from '../render/atlas.ts';
import { BOUND, COMPS, LEGENDS, LEGEND_BY_ID, ZONES, boundName, type BoundId, type LegendId } from '../game/data.ts';
import type { Game } from '../game/game.ts';
import { KOKO_EYE, KOKO_FUR, KOKO_ROWS, KOKO_TAIL } from './koko.ts';
import { spriteFrames, uiAtlas } from './px.ts';

/**
 * The Keep, the castle above the dungeon: a top-down map in the dungeon's own tiles. You come up the stairs in the
 * Entrance and walk the rooms with your party trailing behind. Walk up to the shrine, a trader, the treasury's great
 * chest or the stairs and its label lights up with a key to press to use it.
 */

/** A place to use: the stairs, a trader, the expedition ladder, the Heart, a Spirit on offer in the shrine
 *  (`offer:<id>`), one of yours in the Great Hall (`legend:<id>`) or one of the Bound (`bound:<id>`). */
export type KeepStation = 'stairs' | 'dan' | 'victor' | 'trips' | 'heart' | 'koko' | `offer:${LegendId}` | `legend:${LegendId}` | `bound:${BoundId}`;

/** Floor rectangles (x, y, w, h) for the rooms and the halls between them; the walls grow around them. The first room
 *  is the Heart's. */
const ROOMS: [number, number, number, number][] = [[1, 2, 13, 10], [16, 2, 15, 10], [1, 16, 9, 8], [12, 15, 22, 9], [36, 16, 9, 8], [19, 27, 9, 6]];
const HALLS: [number, number, number, number][] = [[22, 12, 3, 3], [10, 19, 2, 2], [34, 19, 2, 2], [5, 12, 2, 4], [22, 24, 2, 3]];
/** How close (in tiles) the hero's middle may come to a wall at its side. */
const SIDE_GAP = 0.45;
/** How far (in tiles) the hero's feet stay from a south wall. */
const SOUTH_GAP = 0.2;
const W = 47;
const H = 35;

/** Things in the rooms: [sprite, x, y, how]: standing on the cell (and in the way), 'flat' on the floor, 'wall' hung
 *  on a wall face, 'soul' a wall piece run soul-purple. */
type Thing = [string, number, number, ('flat' | 'wall' | 'soul')?];
const THINGS: Thing[] = [
  ['wall_banner_blue', 17, 1, 'soul'], ['wall_banner_blue', 20, 1, 'soul'], ['wall_banner_blue', 26, 1, 'soul'], ['wall_banner_blue', 29, 1, 'soul'],
  ...[15, 19, 27, 31].flatMap((x): Thing[] => [['column', x, 17], ['column', x, 22]]),
  ...([[13, 'red'], [17, 'blue'], [28, 'blue'], [32, 'red']] as const).map(([x, c]): Thing => [`wall_banner_${c}`, x, 14, 'wall']),
  ['wall_banner_green', 2, 15, 'wall'], ['wall_banner_green', 8, 15, 'wall'],
  ['flask_big_red', 3, 20], ['flask_big_blue', 2, 21], ['flask_big_green', 4, 21],
  ['chest_full_open', 8, 20],
  ['wall_banner_yellow', 38, 15, 'wall'], ['wall_banner_yellow', 42, 15, 'wall'],
  ['chest_full_open', 40, 19], ['chest_full_open', 37, 22], ['chest_full_open', 43, 22],
  ...[[39, 20], [41, 20], [40, 21], [38, 18], [42, 18], [39, 22], [41, 22]].map(([x, y]): Thing => ['coin', x, y, 'flat']),
  ['doors_frame_left', 21, 26, 'wall'], ['doors_leaf_open', 22, 26, 'wall'], ['doors_frame_right', 24, 26, 'wall'], ['doors_frame_top', 22, 24, 'wall'],
  ['floor_stairs', 22, 30, 'flat'], ['floor_stairs', 23, 30, 'flat'], ['floor_stairs', 24, 30, 'flat'],
  ['wall_banner_red', 3, 1, 'wall'], ['wall_banner_red', 11, 1, 'wall'],
];
/** The ladder hunters climb down on expeditions (shown once expeditions are open). */
const LADDER: [number, number] = [20, 28];
/** The Heart stands on its plinth here; the Bound around the room once you've awakened. */
const HEART: [number, number] = [7, 4];
/** Where each Bound stands: the four that make a Spirit's effect stronger on the Heart's right, the rest on its left. */
const BOUND_AT: Record<BoundId, [number, number]> = {
  ogre: [2, 7], lich: [4, 7], pitlord: [2, 10], frost: [4, 10],
  troll: [10, 7], golem: [12, 7], thing: [10, 10], ent: [12, 10],
};
const PEOPLE: { id: 'dan' | 'victor'; sprite: string; x: number; y: number }[] = [{ id: 'dan', sprite: 'ef_elf_m', x: 3, y: 18 }, { id: 'victor', sprite: 'victor', x: 7, y: 18 }];
/** Koko, the Keep's cat: sitting by the traders' chest, just below Victor. Walk up and pet her. */
const KOKO: [number, number] = [6, 20];
const KOKO_HEART = ['xx.xx', 'xxxxx', '.xxx.', '..x..'];
/** Seconds a pet lasts (her tail swishing), and how long the little heart floats up for. */
const PET_TIME = 2.5;
const HEART_TIME = 1.6;
/** What each station is, where it's used from (cells you stand on), where its label floats, and (spirits, which you
 *  can walk through) the cells of its body that a click picks it by. */
type Station = { id: KeepStation; label: string; cells: [number, number][]; tag: [number, number]; body?: [number, number][] };
const STATIONS: Station[] = [
  { id: 'dan', label: 'Dan', cells: [[2, 18], [3, 19], [4, 18], [3, 17]], tag: [3, 19.55], body: [[3, 18], [3, 17]] },
  { id: 'victor', label: 'Victor', cells: [[6, 18], [7, 19], [8, 18], [7, 17]], tag: [7, 19.55], body: [[7, 18], [7, 17]] },
  // The way down works from anywhere round the stairs, not just on them.
  { id: 'stairs', label: 'Way down', cells: [21, 22, 23, 24, 25].flatMap((x) => [29, 30, 31].map((y): [number, number] => [x, y])), tag: [23, 31.6], body: [[22, 30], [23, 30], [24, 30]] },
  { id: 'koko', label: 'Koko', cells: [[5, 19], [6, 19], [5, 20], [7, 20], [5, 21], [6, 21], [7, 21]], tag: [KOKO[0], KOKO[1] + 1.55], body: [KOKO, [KOKO[0], KOKO[1] - 1]] },
  { id: 'heart', label: 'The Heart', cells: [[6, 5], [7, 5], [8, 5], [6, 4], [8, 4]], tag: [7, 6.1], body: [[7, 4], [7, 3]] },
];
const TRIPS: Station = { id: 'trips', label: 'Expeditions', cells: [[20, 28], [19, 28], [21, 28], [20, 29], [19, 29], [21, 29]], tag: [20, 29.55], body: [[20, 28]] };
/** Where you arrive: on the stairs, facing up into the Entrance. */
const ARRIVE: [number, number] = [23, 29];
const SPEED = 5.5;
/** Milliseconds a click is held before the hero starts following the pointer. */
const HOLD_AFTER = 220;
/** The reroll's beat, the same as the Spirits menu's (its vanish and arrive animations): seconds the old offer takes to
 *  warp out, each new spirit to rise in, and between one rising and the next. */
const WARP = 0.38;
const RISE = 0.6;
const STAGGER = 0.14;
/** The menu's arrive easing, cubic-bezier(0.2, 1.5, 0.4, 1): a quick rise that overshoots and settles. */
const overshoot = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
/** The shrine: the Spirits on offer float here as spirits, big, side by side (their feet on these cells). */
const SHRINE: [number, number] = [23, 8];
const SPIRITS: [number, number][] = [[18, 9], [23, 9], [28, 9]];
/** Where the Spirits you've summoned hang out in the Great Hall, in the order they're listed: spread about the room,
 *  clear of the columns and the ways through. */
const GUARDS: [number, number][] = [
  [13, 16], [17, 16], [29, 16], [33, 16], [14, 18], [20, 18], [26, 18], [32, 18], [13, 21],
  [17, 21], [29, 21], [33, 21], [14, 23], [19, 23], [27, 23], [32, 23], [20, 16], [26, 16],
  [16, 20], [30, 20], [21, 21], [25, 21], [30, 23],
];
/** The trail keeps a point every this many cells the hero walks. */
const TRAIL_STEP = 0.08;
/** The way the party winds round the Entrance when you arrive (the hero first). */
const ENTRANCE_WIND: [number, number][] = [[23.5, 29.5], [23.5, 31.6], [19.6, 31.6], [19.6, 32.4], [27.4, 32.4], [27.4, 31], [25.6, 31], [25.6, 28], [27.4, 28], [27.4, 27.4], [19.6, 27.4], [19.6, 29.5], [21.4, 29.5]];
/** Cells along the hero's trail between one follower and the next. */
const GAP = 0.9;

/** Which tile shows where: '.' floor, '#' wall, ' ' nothing. Every wall shows a cap line where it meets the floor;
 *  a wall with floor below it shows a brick face, one beside the floor a thin edge. */
function autotile(cells: string[][]) {
  const at = (x: number, y: number) => cells[y]?.[x] ?? ' ';
  const floor = (x: number, y: number) => at(x, y) === '.';
  const layers: { x: number; y: number; name: string }[][] = [[], [], []];
  const put = (layer: number, x: number, y: number, name: string) => layers[layer].push({ x, y, name });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (floor(x, y)) {
      put(0, x, y, 'floor');
      continue;
    }
    if (at(x, y) !== '#') continue;
    const fb = floor(x, y + 1), fa = floor(x, y - 1), fl = floor(x - 1, y), fr = floor(x + 1, y);
    if (fb) {
      put(1, x, y, fl && !fr ? 'wall_left' : fr && !fl ? 'wall_right' : 'wall_mid');
      put(2, x, y - 1, 'wall_top_mid');
    } else if (fa) {
      // The far side of a room's south wall: its cap along the last floor row, its outer face below.
      put(1, x, y, 'wall_mid');
      put(2, x, y - 1, 'wall_top_mid');
    } else if (fr || floor(x + 1, y + 1) || floor(x + 1, y - 1)) put(2, x, y, 'wall_edge_mid_right');
    else if (fl || floor(x - 1, y + 1) || floor(x - 1, y - 1)) put(2, x, y, 'wall_edge_mid_left');
  }
  return layers;
}

export class KeepView {
  readonly canvas = document.createElement('canvas');
  private g: CanvasRenderingContext2D;
  private game: Game;
  private cells: string[][];
  private tiles: ReturnType<typeof autotile>;
  private blocked = new Set<string>();
  /** Floor squares with a south wall's cap drawn along their bottom. */
  private capped = new Set<string>();
  /** The hero (cell units, feet at the point), the trail it leaves, a path to walk when you click, the camera. */
  private hero = { x: ARRIVE[0] + 0.5, y: ARRIVE[1] + 0.5, left: false, moving: false };
  private trail: { x: number; y: number }[] = [];
  private path: { x: number; y: number }[] = [];
  private cam = { x: 0, y: 0 };
  /** Where each of your party is standing and which way they face (they run to their places, never jump). */
  private party = new Map<number, { idx: number; x: number; y: number; left: boolean; running: boolean; arriving?: { x: number; y: number }[] }>();
  /** Once the party has been placed: anyone joining after that runs in from somewhere out of sight. */
  private partyPlaced = false;
  private zoom = 3;
  private time = 0;
  /** The station your hero is standing at, ready to use. */
  near: KeepStation | null = null;
  /** The offered Spirit picked in the Spirits menu: it stays lit, wherever you stand, until you next move. */
  pinned: KeepStation | null = null;
  /** The station under the pointer, and the one you clicked and are walking to (used when you get there). */
  hover: KeepStation | null = null;
  /** The pointer is over a station's label (it counts as pointing at the station). */
  labelHover: KeepStation | null = null;
  private goal: KeepStation | null = null;
  /** A held click: where the pointer is on screen (the camera moves under it), where it went down, when, and whether
   *  the hero has started following it. */
  private held: { x: number; y: number; x0: number; y0: number; at: number; following: boolean } | null = null;
  /** Moving with the keys (the labels then show which key uses a thing), rather than the mouse. */
  keyed = false;
  /** Called when you reach a station you clicked, or click the one you're at. */
  onUse: (id: KeepStation) => void = () => {};
  private pettedUntil = 0;
  /** A heart floating up for each pet: when it set off, where it started beside her head, and seconds per pixel up. */
  private hearts: { at: number; dx: number; dy: number; pace: number }[] = [];

  constructor(game: Game, host: HTMLElement) {
    this.game = game;
    this.canvas.className = 'keep-view';
    host.prepend(this.canvas);
    this.g = this.canvas.getContext('2d')!;
    this.cells = Array.from({ length: H }, () => Array(W).fill(' '));
    for (const [x0, y0, w, h] of [...ROOMS, ...HALLS]) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.cells[y][x] = '.';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.cells[y][x] === '.') continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.cells[y + dy]?.[x + dx] === '.') this.cells[y][x] = '#';
    }
    this.tiles = autotile(this.cells);
    // A south wall's cap is drawn along the bottom of the room's last floor row.
    for (const t of this.tiles[2]) if (t.name === 'wall_top_mid' && this.cells[t.y]?.[t.x] === '.') this.capped.add(`${t.x},${t.y}`);
    for (const [, x, y, how] of THINGS) if (!how) this.blocked.add(`${x},${y}`);
    // The Heart's plinth stands in the way; spirits don't (you walk right through them).
    // The door's posts are two tiles tall: their lower halves stand on the floor in front of the doorway.
    this.blocked.add('21,27');
    this.blocked.add('24,27');
    this.blocked.add(`${HEART[0]},${HEART[1]}`);
    for (const p of PEOPLE) this.blocked.add(`${p.x},${p.y}`);
    this.blocked.add(`${KOKO[0]},${KOKO[1]}`);
    // Everyone comes up the stairs: the party starts wound round the Entrance behind you, as if they'd walked it.
    // Back from a reload, you stand where you were, the party strung out along the way back to the stairs.
    const spot = game.s.keepSpot;
    const back = spot && this.walkable(spot[0] + 0.5, spot[1] + 0.5) ? this.route(spot[0], spot[1], ARRIVE[0], ARRIVE[1]) : [];
    if (spot && back.length) {
      this.hero.x = spot[0] + 0.5;
      this.hero.y = spot[1] + 0.5;
    }
    const wind: [number, number][] = [...(back.length ? [[this.hero.x, this.hero.y] as [number, number], ...back.map((p): [number, number] => [p.x, p.y])] : []), ...ENTRANCE_WIND];
    for (let k = 0; k < wind.length - 1; k++) {
      const [ax, ay] = wind[k], [bx, by] = wind[k + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / TRAIL_STEP);
      for (let i = 0; i < steps; i++) this.trail.push({ x: ax + ((bx - ax) * i) / steps, y: ay + ((by - ay) * i) / steps });
    }
    this.canvas.addEventListener('pointerdown', this.onPointer);
    this.canvas.addEventListener('pointermove', this.onHover);
    this.canvas.addEventListener('pointerleave', this.onLeave);
    this.canvas.addEventListener('pointerup', this.onRelease);
    this.canvas.addEventListener('pointercancel', this.onRelease);
    this.cam = { x: this.hero.x, y: this.hero.y };
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.onPointer);
    this.canvas.removeEventListener('pointermove', this.onHover);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('pointerup', this.onRelease);
    this.canvas.removeEventListener('pointercancel', this.onRelease);
    this.canvas.remove();
  }

  private walkable(x: number, y: number) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (this.cells[cy]?.[cx] !== '.' || this.blocked.has(`${cx},${cy}`)) return false;
    // Not half over a side wall: the hero (and the party in its footsteps) is a tile wide.
    const fx = x - cx;
    if (fx < SIDE_GAP && this.cells[cy][cx - 1] !== '.') return false;
    if (fx > 1 - SIDE_GAP && this.cells[cy][cx + 1] !== '.') return false;
    // On the last row before a south wall, the feet stay off the cap along its bottom.
    if (y - cy > 1 - SOUTH_GAP && this.capped.has(`${cx},${cy}`)) return false;
    return true;
  }

  /** The Bound and where each stands, once you've awakened. */
  private bound() {
    return this.game.s.awakens ? BOUND.map((b) => ({ b, at: BOUND_AT[b.id] })) : [];
  }

  /** The Spirits you've summoned and where each stands (you can walk through them). */
  private guards() {
    return LEGENDS.filter((d) => this.game.legendLv(d.id) > 0).slice(0, GUARDS.length).map((d, k) => ({ d, at: GUARDS[k] }));
  }
  /** How far each offered spirit has come into its own colors (by sprite), and its flash as it does. */
  private lit = new Map<string, { amt: number; flash: number }>();
  /** The offer last drawn, the one before it (warping out) and when it changed. */
  private offerKey: string | null = null;
  private offerOld: LegendId[] = [];
  private offerAt = -99;

  /** The point under a spot on screen, in cells. */
  private pointAt(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    return [this.cam.x + (e.clientX - r.left - r.width / 2) / (16 * this.zoom), this.cam.y + (e.clientY - r.top - r.height / 2) / (16 * this.zoom)] as const;
  }

  /** The cell under a pointer. */
  private cellAt(e: PointerEvent) {
    const [x, y] = this.pointAt(e);
    return [Math.floor(x), Math.floor(y)] as const;
  }

  /** The station a cell belongs to: a spirit's own body, or something solid with a spot to use it from beside it. */
  private stationAt(tx: number, ty: number) {
    const all = this.stations();
    const body = all.find((s) => s.body?.some(([x, y]) => x === tx && y === ty));
    if (body) return body.id;
    const st = all.find((s) => s.cells.some(([x, y]) => Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1));
    return st && !this.walkable(tx + 0.5, ty + 0.5) ? st.id : null;
  }

  /** Click (or tap) a spot: walk there by the shortest way round. Click a station and you walk up and use it. Hold
   *  the button down and the hero follows the pointer, as in the dungeon. */
  private onPointer = (e: PointerEvent) => {
    this.keyed = false;
    const [tx, ty] = this.cellAt(e);
    const station = this.stationAt(tx, ty);
    if (station) return this.useOrWalk(station);
    this.goal = null;
    this.path = this.route(Math.floor(this.hero.x), Math.floor(this.hero.y), tx, ty);
    this.held = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, at: performance.now(), following: false };
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onHover = (e: PointerEvent) => {
    const [tx, ty] = this.cellAt(e);
    this.hover = this.stationAt(tx, ty) ?? this.labelHover;
    if (!this.held) return;
    this.held.x = e.clientX;
    this.held.y = e.clientY;
    // Dragging away from where you pressed starts following straight off.
    if (Math.hypot(e.clientX - this.held.x0, e.clientY - this.held.y0) > 12) this.held.following = true;
  };

  private onLeave = () => {
    this.hover = null;
  };

  /** Letting go: a quick click keeps walking where you clicked; a hold stops where you are. */
  private onRelease = () => {
    if (this.held?.following) this.path = [];
    this.held = null;
  };

  pet() {
    this.game.petKoko();
    this.pettedUntil = this.time + PET_TIME;
    // Pet her again and again and the hearts stack up, each from a little to one side.
    this.hearts = this.hearts.filter((h) => this.time - h.at < HEART_TIME).slice(-11);
    const first = !this.hearts.length;
    this.hearts.push({ at: this.time, dx: first ? 0 : Math.round(Math.random() * 22 - 11), dy: first ? 0 : Math.round(Math.random() * 9), pace: first ? 0.2 : 0.08 + Math.random() * 0.1 });
  }

  /** Use a station you're at, or walk up to it and use it when you get there. */
  useOrWalk(id: KeepStation) {
    this.keyed = false;
    if (this.near === id) {
      this.goal = null;
      this.path = [];
      this.onUse(id);
      return;
    }
    this.walkTo(id);
    this.goal = id;
  }

  /** Arrive in front of the Heart instead of on the stairs (after an awakening), the party gathered round. */
  arriveAtHeart() {
    this.hero.x = HEART[0] + 0.5;
    this.hero.y = HEART[1] + 2.6;
    this.trail = Array.from({ length: 400 }, (_, k) => ({ x: this.hero.x + Math.sin(k * 0.05) * 1.5, y: this.hero.y + Math.min(3, k * 0.012) }));
    this.path = [];
    this.party.clear();
    this.cam = { x: this.hero.x, y: this.hero.y - 1 };
  }

  /** Walk up to a station, to whichever of its spots is the shortest way. */
  walkTo(id: KeepStation) {
    const st = this.stations().find((s) => s.id === id);
    if (!st) return;
    const from = [Math.floor(this.hero.x), Math.floor(this.hero.y)] as const;
    const routes = st.cells.map(([x, y]) => (x === from[0] && y === from[1] ? [] : this.route(from[0], from[1], x, y))).filter((r, k) => r.length || (st.cells[k][0] === from[0] && st.cells[k][1] === from[1]));
    this.path = routes.sort((a, b) => a.length - b.length)[0] ?? [];
  }

  /** Breadth-first search over the floor, around anything standing in the way. */
  /** The floor square nearest the hero (by walking) that's just outside the view, for a newcomer to run in from. */
  private offscreenCell(w: number, h: number) {
    const half = { x: w / (2 * 16 * this.zoom) + 1, y: h / (2 * 16 * this.zoom) + 1.5 };
    const out = (x: number, y: number) => Math.abs(x + 0.5 - this.cam.x) > half.x || Math.abs(y + 0.5 - this.cam.y) > half.y;
    const sx = Math.floor(this.hero.x), sy = Math.floor(this.hero.y);
    const seen = new Set<string>([`${sx},${sy}`]);
    const queue: [number, number][] = [[sx, sy]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (out(x, y)) return { x, y };
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${x + dx},${y + dy}`;
        if (seen.has(key) || !this.walkable(x + dx + 0.5, y + dy + 0.5)) continue;
        seen.add(key);
        queue.push([x + dx, y + dy]);
      }
    }
    return null;
  }

  private route(sx: number, sy: number, tx: number, ty: number) {
    if (!this.walkable(tx + 0.5, ty + 0.5)) return [];
    const prev = new Map<string, string | null>([[`${sx},${sy}`, null]]);
    const queue: [number, number][] = [[sx, sy]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${x + dx},${y + dy}`;
        if (prev.has(key) || !this.walkable(x + dx + 0.5, y + dy + 0.5)) continue;
        prev.set(key, `${x},${y}`);
        queue.push([x + dx, y + dy]);
      }
    }
    const path: { x: number; y: number }[] = [];
    for (let key: string | null | undefined = `${tx},${ty}`; key && prev.has(key); key = prev.get(key)) {
      const [x, y] = key.split(',').map(Number);
      path.unshift({ x: x + 0.5, y: y + 0.5 });
    }
    return path.slice(1);
  }

  /** One frame: walk (keys first, else the clicked path), drag the trail, use stations, draw. */
  frame(dt: number, keys: { x: number; y: number }, w: number, h: number, zoomW = w) {
    this.time += dt;
    const hero = this.hero;
    let vx = keys.x, vy = keys.y;
    // A press held a moment becomes following, like a drag.
    if (this.held && !this.held.following && performance.now() - this.held.at > HOLD_AFTER) this.held.following = true;
    if (vx || vy) {
      this.path = [];
      this.goal = null;
      this.keyed = true;
    } else if (this.held?.following) {
      this.path = [];
      const [tx, ty] = this.pointAt({ clientX: this.held.x, clientY: this.held.y });
      vx = tx - hero.x;
      vy = ty - hero.y;
      // Close enough: stand still rather than jitter on the spot.
      if (Math.hypot(vx, vy) < 0.3) vx = vy = 0;
    } else if (this.path.length) {
      const next = this.path[0];
      vx = next.x - hero.x;
      vy = next.y - hero.y;
      if (Math.hypot(vx, vy) < 0.12) this.path.shift();
    }
    const len = Math.hypot(vx, vy);
    hero.moving = len > 0.01;
    if (hero.moving) this.pinned = null;
    if (hero.moving) {
      const step = Math.min(len, SPEED * dt) / len;
      const nx = hero.x + vx * step, ny = hero.y + vy * step;
      // Slide along walls: each axis on its own.
      if (this.walkable(nx, hero.y)) hero.x = nx;
      if (this.walkable(hero.x, ny)) hero.y = ny;
      if (vx) hero.left = vx < 0;
      const last = this.trail[0];
      if (Math.hypot(hero.x - last.x, hero.y - last.y) > TRAIL_STEP) {
        this.trail.unshift({ x: hero.x, y: hero.y });
        this.trail.length = Math.min(this.trail.length, 900);
        // Everyone's place along the trail moves back one with it, so they stay where they stand.
        for (const at of this.party.values()) at.idx += 1;
      }
    }
    const cx = Math.floor(hero.x), cy = Math.floor(hero.y);
    const spot = this.game.s.keepSpot;
    if (!spot || spot[0] !== cx || spot[1] !== cy) this.game.s.keepSpot = [cx, cy];
    // Where two stations share a square, the one you're walking to wins, else the smaller one (the ladder by the stairs).
    const here = this.stations().filter((st) => st.cells.some(([x, y]) => x === cx && y === cy));
    this.near = (here.find((st) => st.id === this.goal) ?? here.sort((a, b) => a.cells.length - b.cells.length)[0])?.id ?? null;
    if (this.goal && !this.path.length) {
      const goal = this.goal;
      this.goal = null;
      if (this.near === goal) this.onUse(goal);
    }
    this.draw(dt, w, h, zoomW);
  }

  /** Every station right now: the fixed ones, each Spirit on offer in the shrine and each of yours where it stands
   *  (used from the cells beside and in front of it; named just below it). */
  private stations(): Station[] {
    // A spirit is used from where it stands or right beside it; its body (it stands tall) is what you click.
    const figure = (id: KeepStation, label: string, [x, y]: [number, number], tall: number): Station => ({
      id, label, tag: [x, y + 1.55],
      cells: [[x, y], [x - 1, y], [x + 1, y], [x, y + 1], [x - 1, y + 1], [x + 1, y + 1]],
      body: Array.from({ length: tall }, (_, k) => [x, y - k] as [number, number]),
    });
    const offer = this.game.legendOffer().slice(0, SPIRITS.length).map((id, k) => figure(`offer:${id}`, LEGEND_BY_ID.get(id)!.name, SPIRITS[k], 3));
    const mine = this.guards().map(({ d, at }) => ({ ...figure(`legend:${d.id}`, d.name, at, 2), tag: [at[0], at[1] + 1.3] as [number, number] }));
    const bound = this.bound().map(({ b, at }) => ({ ...figure(`bound:${b.id}`, boundName(b), at, 2), tag: [at[0], at[1] + 1.3] as [number, number] }));
    return [...STATIONS, ...(this.game.tripsOpen() ? [TRIPS] : []), ...offer, ...mine, ...bound];
  }

  /** A point along the trail, `idx` steps back from the hero (in between two points, part of the way). */
  private along(idx: number) {
    if (idx <= 0) return this.hero;
    const head = [this.hero, ...this.trail];
    const i = Math.min(Math.floor(idx), head.length - 2);
    const a = head[i], b = head[i + 1], f = Math.min(1, idx - i);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  /** What using a station does, for its key prompt. */
  private verb(id: KeepStation) {
    if (id === 'stairs') return 'Go down';
    if (id === 'dan' || id === 'victor') return 'Trade';
    if (id === 'trips') return 'Send';
    if (id === 'koko') return 'Pet';
    if (id === 'heart') return this.game.canAwaken() ? 'Awaken' : 'Open';
    if (id.startsWith('offer:')) return 'Summon';
    return 'Open';
  }

  /** Where each station's label goes on screen. */
  /** A Spirit's name hangs just below its feet. Your own Spirits and the traders only show theirs when you're at them or
   *  pointing at them. */
  labels(): { id: KeepStation; label: string; verb: string; x: number; y: number; below: boolean; shown: boolean }[] {
    const r = this.canvas.getBoundingClientRect();
    const s = 16 * this.zoom;
    return this.stations().map((st) => {
      // Spirits and the traders are named under their feet; the stairs' sign hangs over them.
      const below = st.id !== 'stairs';
      const [tx, ty] = below ? [st.tag[0], st.tag[1] - 0.45] : st.tag;
      // Only the stairs and the spirits on offer always show their names; the rest when you point at them or stand there.
      const shown = st.id === 'stairs' || st.id.startsWith('offer:') || (st.id === 'heart' && this.game.canAwaken()) || this.near === st.id || this.hover === st.id;
      return { id: st.id, label: st.label, verb: this.verb(st.id), x: r.left + r.width / 2 + (tx + 0.5 - this.cam.x) * s, y: r.top + r.height / 2 + (ty - this.cam.y) * s, below, shown };
    });
  }

  /** A sprite frame in a monster's tint (as the dungeon colors it), drawn once and kept. */
  private tints = new Map<string, HTMLCanvasElement>();
  private tinted(img: CanvasImageSource, r: Rect, tint: number) {
    const key = `${r.x},${r.y},${tint}`;
    let c = this.tints.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = r.w;
    c.height = r.h;
    const t = c.getContext('2d')!;
    t.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    t.globalCompositeOperation = 'multiply';
    t.fillStyle = `#${tint.toString(16).padStart(6, '0')}`;
    t.fillRect(0, 0, r.w, r.h);
    // Multiply fills the clear pixels too: cut back to the sprite's own shape.
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    this.tints.set(key, c);
    return c;
  }

  /** A sprite frame as a flat shape in one color (for the hover outline), drawn once and kept. */
  private flats = new WeakMap<object, Map<string, HTMLCanvasElement>>();
  private flat(img: CanvasImageSource, r: Rect, color: string) {
    // (Kept per image: a tinted Bound is its own little canvas, its frame always at 0,0.)
    let byFrame = this.flats.get(img);
    if (!byFrame) this.flats.set(img, (byFrame = new Map()));
    const key = `${r.x},${r.y},${r.w},${r.h},${color}`;
    let c = byFrame.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = r.w;
    c.height = r.h;
    const t = c.getContext('2d')!;
    t.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = color;
    t.fillRect(0, 0, r.w, r.h);
    byFrame.set(key, c);
    return c;
  }

  private draw(dt: number, w: number, h: number, zoomW: number) {
    const c = this.canvas;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    // About 20 cells across, in whole pixels.
    this.zoom = Math.max(2, Math.round(zoomW / (20 * 16)));
    const g = this.g;
    const atlas = uiAtlas();
    if (!atlas) return;
    const img = atlas.texture.image as CanvasImageSource;
    const s = 16 * this.zoom;
    // The camera eases after the hero, kept inside the castle.
    const halfW = w / 2 / s, halfH = h / 2 / s;
    // (It can show some dark past the castle's edges: more above, where the gold counter sits.)
    const want = { x: Math.max(halfW - 1.5, Math.min(W + 1.5 - halfW, this.hero.x)), y: Math.max(halfH - 3.5, Math.min(H + 1.5 - halfH, this.hero.y)) };
    if (W + 3 < halfW * 2) want.x = W / 2;
    if (H + 5 < halfH * 2) want.y = H / 2 - 1;
    this.cam.x += (want.x - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (want.y - this.cam.y) * Math.min(1, dt * 6);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#100c0d';
    g.fillRect(0, 0, c.width, c.height);
    // World to screen: one atlas pixel is `zoom` screen pixels; the camera sits in the middle of the view.
    g.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, Math.round(dpr * (w / 2 - this.cam.x * s)), Math.round(dpr * (h / 2 - this.cam.y * s)));
    const rect = (name: string, frame = 0): Rect | null => {
      if (!atlas.has(name)) return null;
      const anim = atlas.anim(name);
      const frames = anim.length ? anim : [atlas.rect(name)];
      return frames[frame % frames.length];
    };
    const tile = (r: Rect | null, x: number, y: number) => r && g.drawImage(img, r.x, r.y, r.w, r.h, x * 16, y * 16, r.w, r.h);
    const stand = (src: CanvasImageSource, r: Rect, x: number, feet: number, left = false) => {
      const px = Math.round(x * 16 - r.w / 2), py = Math.round(feet * 16 - r.h);
      if (left) {
        g.save();
        g.translate(px + r.w, py);
        g.scale(-1, 1);
        g.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        g.restore();
      } else g.drawImage(src, r.x, r.y, r.w, r.h, px, py, r.w, r.h);
    };
    // The one thing under the pointer gets a one-pixel outline, so you can see what a click will use.
    const standLit = (id: KeepStation, src: CanvasImageSource, r: Rect, x: number, feet: number, left = false) => {
      if (this.hover === id && !this.held) {
        const shape = this.flat(src, r, '#fff4d6');
        const box = { x: 0, y: 0, w: r.w, h: r.h } as Rect;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) stand(shape, box, x + dx / 16, feet + dy / 16, left);
      }
      stand(src, r, x, feet, left);
    };
    const tick = Math.floor(this.time * 6);
    const worn = (x: number, y: number) => {
      const f = Math.abs(Math.sin((y * W + x) * 12.9898) * 43758.5453) % 1;
      return f < 0.78 ? 1 : 2 + Math.floor(((f - 0.78) / 0.22) * 7);
    };
    for (const t of this.tiles[0]) tile(atlas.rect(`floor_${worn(t.x, t.y)}`), t.x, t.y);
    for (const t of this.tiles[1]) tile(atlas.rect(t.name), t.x, t.y);
    for (const t of this.tiles[2]) if (!this.capped.has(`${t.x},${t.y}`)) tile(atlas.rect(t.name), t.x, t.y);
    if (this.game.tripsOpen()) tile(rect('floor_ladder'), LADDER[0], LADDER[1]);
    for (const [name, x, y, how] of THINGS) {
      if (how === 'flat') tile(rect(name, tick), x, y);
      else if (how === 'wall' || how === 'soul') {
        if (how === 'soul') g.filter = 'hue-rotate(55deg) saturate(1.4) brightness(1.1)';
        tile(rect(name, tick), x, y);
        g.filter = 'none';
      }
    }
    // Everything standing, back to front: things, Dan and Victor, then your party (the hero leading).
    const standing: { y: number; draw: () => void }[] = [];
    for (const [name, x, y, how] of THINGS) {
      if (how) continue;
      const r = rect(name, name.startsWith('chest') ? 2 : 0);
      if (r) standing.push({ y: y + 1, draw: () => stand(img, r, x + 0.5, y + 1) });
    }
    const shadow = (x: number, y: number, rx: number) => {
      g.fillStyle = 'rgba(0, 0, 0, 0.35)';
      g.beginPath();
      g.ellipse(x * 16, y * 16 - 0.5, rx, rx * 0.4, 0, 0, Math.PI * 2);
      g.fill();
    };
    // A Spirit in spirit form, big and floating over a soft purple shadow (on offer in the shrine, or yours about the Keep).
    // An offered one you're standing at comes into its own colors in a flash, and fades back when you step away.
    const spirit = (sprite: string, [x, y]: [number, number], k: number, scale = 2, id?: KeepStation, fx?: { dy: number; alpha: number; sy: number; flash: number }) => {
      const src = spriteFrames(sprite);
      if (!src) return;
      const r = src.frames[(tick + k) % src.frames.length];
      const bob = Math.sin(this.time * 1.6 + k * 2) * 0.12;
      const lit = this.lit.get(sprite) ?? { amt: 0, flash: 0 };
      const want = id && (this.pinned ?? this.near) === id ? 1 : 0;
      if (want && lit.amt === 0) lit.flash = 1;
      lit.amt = want ? Math.min(1, lit.amt + dt * 5) : Math.max(0, lit.amt - dt * 2.5);
      lit.flash = Math.max(0, lit.flash - dt * 2.5);
      this.lit.set(sprite, lit);
      standing.push({ y: y + 1, draw: () => {
        g.fillStyle = 'rgba(120, 80, 220, 0.3)';
        g.beginPath();
        g.ellipse((x + 0.5) * 16, (y + 1) * 16 - 1, 9, 3.5, 0, 0, Math.PI * 2);
        g.fill();
        g.save();
        const sy = fx?.sy ?? 1;
        g.translate(Math.round((x + 0.5) * 16 - (r.w * scale) / 2), Math.round((y + 0.6 + bob + (fx?.dy ?? 0)) * 16 - r.h * scale * sy));
        g.scale(scale, scale * sy);
        if (lit.amt < 1) {
          g.globalAlpha = 0.86 * (1 - lit.amt) * (fx?.alpha ?? 1);
          g.filter = `grayscale(1) sepia(1) hue-rotate(215deg) saturate(2.6) brightness(${1.15 + (fx?.flash ?? 0) * 1.8}) drop-shadow(0 0 3px rgba(179, 140, 255, 0.9))`;
          g.drawImage(src.img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        }
        if (lit.amt > 0) {
          g.globalAlpha = lit.amt;
          g.filter = `brightness(${1 + lit.flash * 1.6}) drop-shadow(0 0 ${2 + lit.flash * 6}px rgba(255, 240, 255, ${0.4 + lit.flash * 0.6}))`;
          g.drawImage(src.img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        }
        g.restore();
      } });
    };
    // Yours hang out in the Great Hall, as themselves.
    this.guards().forEach(({ d, at }, k) => {
      const src = spriteFrames(d.sprite);
      if (!src) return;
      const r = src.frames[(tick + k) % src.frames.length];
      standing.push({ y: at[1] + 1, draw: () => {
        shadow(at[0] + 0.5, at[1] + 1, 6);
        standLit(`legend:${d.id}`, src.img, r, at[0] + 0.5, at[1] + 1, at[0] > 23);
        // Soul sparkles drifting up around them and in front of them.
        for (let w = 0; w < 7; w++) {
          const t = (this.time * 0.35 + w / 7 + k * 0.17) % 1;
          const big = w % 3 === 0;
          g.fillStyle = big ? '#e2d2ff' : '#b38cff';
          g.globalAlpha = Math.sin(t * Math.PI) * (big ? 0.85 : 0.6);
          g.fillRect(Math.round((at[0] + 0.5) * 16 + ((w * 5) % 15) - 7 + Math.sin(this.time * 1.5 + w + k) * 2), Math.round((at[1] + 1) * 16 + 1 - t * 28), big ? 2 : 1, big ? 2 : 1);
        }
        g.globalAlpha = 1;
      } });
    });
    // A new offer (a reroll, or a summon): the old spirits warp up and away, then the new ones rise in one by one in a
    // column of light, as the menu shows them.
    const offer = this.game.legendOffer();
    const key = offer.join(',');
    if (this.offerKey !== key) {
      if (this.offerKey !== null) {
        this.offerOld = this.offerKey ? this.offerKey.split(',') as LegendId[] : [];
        // (Timed on the real clock, as the menu's animations are, so the two stay in step.)
        this.offerAt = performance.now() / 1000;
      }
      this.offerKey = key;
    }
    const since = performance.now() / 1000 - this.offerAt;
    if (since < WARP) {
      const p = since / WARP;
      const e = p * p;
      this.offerOld.slice(0, SPIRITS.length).forEach((id, k) => spirit(LEGEND_BY_ID.get(id)!.sprite, SPIRITS[k], k, 2, undefined, { dy: -e * 2.9, alpha: 1 - e, sy: 1 + e * 0.4, flash: e }));
    }
    if (offer.length) {
      offer.slice(0, SPIRITS.length).forEach((id, k) => {
        const t = (since - WARP - k * STAGGER) / RISE;
        if (t < 0) return;
        const [x, y] = SPIRITS[k];
        if (t < 1) {
          standing.push({ y: y + 1.01, draw: () => {
            const beam = g.createLinearGradient(0, (y + 1) * 16, 0, (y - 4) * 16);
            beam.addColorStop(0, `rgba(214, 190, 255, ${0.7 * (1 - t)})`);
            beam.addColorStop(1, 'rgba(179, 140, 255, 0)');
            g.fillStyle = beam;
            g.fillRect((x + 0.5) * 16 - 12, (y - 4) * 16, 24, 5 * 16);
          } });
        }
        const fx = t < 1 ? { dy: (1 - overshoot(t)) * 1.6, alpha: Math.min(1, t / 0.6), sy: 0.2 + 0.8 * overshoot(t), flash: Math.max(0, 1 - t * 1.6) } : undefined;
        spirit(LEGEND_BY_ID.get(id)!.sprite, SPIRITS[k], k, 2, `offer:${id}`, fx);
      });
    }
    // Wisps rising across the shrine.
    standing.push({ y: SHRINE[1] + 1.5, draw: () => {
      for (let k = 0; k < 26; k++) {
        const t = (this.time * 0.45 + k / 26) % 1;
        const big = k % 4 === 0;
        g.fillStyle = big ? '#efe4ff' : '#c9a6ff';
        g.globalAlpha = Math.sin(t * Math.PI) * (big ? 0.95 : 0.7);
        g.fillRect(Math.round((16.5 + ((k * 4.7) % 13)) * 16 + Math.sin(this.time * 2 + k) * 2), Math.round((SHRINE[1] + 3.2) * 16 - t * 90), big ? 2 : 1, big ? 2 : 1);
      }
      g.globalAlpha = 1;
    } });
    // The Heart on its plinth: dark until awakening opens, then beating red.
    const ready = this.game.canAwaken();
    const awake = this.game.s.awakens > 0;
    standing.push({ y: HEART[1] + 1, draw: () => {
      const column = atlas.rect('column');
      g.filter = 'sepia(1) hue-rotate(-50deg) saturate(2.4) brightness(0.8)';
      stand(img, column, HEART[0] + 0.5, HEART[1] + 1);
      g.filter = 'none';
      const heart = atlas.rect('ui_heart_full');
      const beat = ready || awake ? 1 + 0.12 * Math.max(0, Math.sin(this.time * (ready ? 6 : 3))) ** 8 : 1;
      const size = 2 * beat;
      g.save();
      g.translate((HEART[0] + 0.5) * 16, (HEART[1] - 1.1) * 16 + Math.sin(this.time * 1.4) * 1.5);
      g.scale(size, size);
      if (!ready && !awake) g.filter = 'grayscale(0.85) brightness(0.55)';
      else g.filter = `drop-shadow(0 0 ${ready ? 3 : 1.5}px rgba(255, 90, 126, 0.9))`;
      g.drawImage(img, heart.x, heart.y, heart.w, heart.h, -heart.w / 2, -heart.h / 2, heart.w, heart.h);
      g.restore();
      g.filter = 'none';
    } });
    // The Bound, as themselves in their own colors, with red sparks rising round them.
    this.bound().forEach(({ b, at }, k) => {
      const boss = ZONES[b.zone].boss;
      const src = spriteFrames(boss.sprite);
      if (!src) return;
      const frame = (tick + k) % src.frames.length;
      const r = src.frames[frame];
      standing.push({ y: at[1] + 1, draw: () => {
        shadow(at[0] + 0.5, at[1] + 1, 7);
        const tinted = boss.tint !== undefined ? this.tinted(src.img, r, boss.tint) : null;
        if (tinted) standLit(`bound:${b.id}`, tinted, { x: 0, y: 0, w: r.w, h: r.h } as Rect, at[0] + 0.5, at[1] + 1, at[0] > HEART[0]);
        else standLit(`bound:${b.id}`, src.img, r, at[0] + 0.5, at[1] + 1, at[0] > HEART[0]);
        for (let w = 0; w < 6; w++) {
          const t = (this.time * 0.3 + w / 6 + k * 0.21) % 1;
          g.fillStyle = w % 3 === 0 ? '#ffb3c4' : '#ff5a7e';
          g.globalAlpha = Math.sin(t * Math.PI) * 0.7;
          g.fillRect(Math.round((at[0] + 0.5) * 16 + ((w * 5) % 15) - 7 + Math.sin(this.time * 1.3 + w + k) * 2), Math.round((at[1] + 1) * 16 + 1 - t * 30), 1, 1);
        }
        g.globalAlpha = 1;
      } });
    });
    standing.push({ y: KOKO[1] + 1, draw: () => {
      const swishing = this.time < this.pettedUntil;
      const blink = this.time % 4.3 < 0.15;
      const px = KOKO[0] * 16 + 3, py = (KOKO[1] + 1) * 16 - KOKO_ROWS.length;
      shadow(KOKO[0] + 0.5, KOKO[1] + 1, 6);
      // Her tip sways (faster just after a pet).
      const tail = KOKO_TAIL.map(([x, y], k): [number, number] => [x + (k > 5 ? Math.round(Math.sin(this.time * (swishing ? 9 : 2) + (k - 3) * 0.6)) : 0), y]);
      const body = (color: string | null, ox: number, oy: number) => {
        KOKO_ROWS.forEach((row, y) => [...row].forEach((ch, x) => {
          if (ch === '.') return;
          g.fillStyle = color ?? (ch === 'o' && !blink ? KOKO_EYE : KOKO_FUR);
          g.fillRect(px + x + ox, py + y + oy, 1, 1);
        }));
        g.fillStyle = color ?? KOKO_FUR;
        for (const [x, y] of tail) g.fillRect(px + x + ox, py + y + oy, 1, 1);
      };
      if (this.hover === 'koko' && !this.held) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) body('#fff4d6', dx, dy);
      body(null, 0, 0);
      g.fillStyle = '#ff5a7e';
      for (const heart of this.hearts) {
        const age = this.time - heart.at;
        if (age >= HEART_TIME) continue;
        KOKO_HEART.forEach((row, y) => [...row].forEach((ch, x) => ch === 'x' && g.fillRect(px + heart.dx + x, py - 7 - heart.dy - Math.floor(age / heart.pace) + y, 1, 1)));
      }
    } });
    for (const p of PEOPLE) {
      const src = spriteFrames(p.sprite);
      if (!src) continue;
      const r = src.frames[tick % src.frames.length];
      standing.push({ y: p.y + 1, draw: () => (shadow(p.x + 0.5, p.y + 1, 6), standLit(p.id, src.img, r, p.x + 0.5, p.y + 1, true)) });
    }
    // Your party: each has a place along your trail (the hero at its head) and runs there along the trail itself, so
    // a new hero runs up the line to the front and the old one drops back into it, never through a wall.
    const g0 = this.game;
    const heroIndex = g0.heroIndex();
    const followers = COMPS.map((_, i) => i).filter((i) => g0.inParty(i) && i !== heroIndex);
    const places = new Map<number, number>(followers.map((i, k) => [i, ((k + 1) * GAP) / TRAIL_STEP]));
    if (heroIndex >= 0) places.set(heroIndex, 0);
    for (const [i, want] of places) {
      let at = this.party.get(i);
      if (!at) {
        this.party.set(i, (at = { idx: want, x: 0, y: 0, left: false, running: false }));
        // Hired up here: in from the nearest spot just out of sight, by the way round through the rooms.
        if (this.partyPlaced) {
          const goal = this.along(want);
          const from = this.offscreenCell(w, h);
          const path = from ? this.route(from.x, from.y, Math.floor(goal.x), Math.floor(goal.y)) : [];
          if (from && path.length) {
            at.x = from.x + 0.5;
            at.y = from.y + 0.5;
            at.arriving = path;
          }
        }
      }
      if (at.arriving) {
        // Running in: along the path, then the last stretch straight to its place in line.
        const next = at.arriving[0] ?? this.along(at.idx);
        const dx = next.x - at.x, dy = next.y - at.y, len = Math.hypot(dx, dy);
        const step = SPEED * 1.6 * dt;
        at.running = true;
        if (Math.abs(dx) > 0.01) at.left = dx < 0;
        if (len <= step) {
          at.x = next.x;
          at.y = next.y;
          if (at.arriving.length) at.arriving.shift();
          else at.arriving = undefined;
        } else {
          at.x += (dx / len) * step;
          at.y += (dy / len) * step;
        }
        continue;
      }
      const gap = want - at.idx;
      at.running = Math.abs(gap) > 0.6;
      // (Running to catch up: quicker the further there is to go.)
      at.idx += Math.sign(gap) * Math.min(Math.abs(gap), ((SPEED * (Math.abs(gap) > 20 ? 1.8 : 1.15)) / TRAIL_STEP) * dt);
      const was = at.x;
      const p = this.along(at.idx);
      at.x = p.x;
      at.y = p.y;
      if (Math.abs(at.x - was) > 0.002) at.left = at.x < was;
    }
    for (const i of this.party.keys()) if (!places.has(i)) this.party.delete(i);
    this.partyPlaced = true;
    for (const [i, at] of this.party) {
      const hero = i === heroIndex;
      const src = (at.running || (hero && this.hero.moving) ? spriteFrames(`${COMPS[i].sprite}_run`) : null) ?? spriteFrames(COMPS[i].sprite);
      if (!src) continue;
      const r = src.frames[(tick + i) % src.frames.length];
      standing.push({ y: at.y, draw: () => {
        if (hero) {
          g.strokeStyle = 'rgba(255, 224, 138, 0.9)';
          g.lineWidth = 1;
          g.beginPath();
          g.ellipse(at.x * 16, at.y * 16 - 0.5, 7, 3, 0, 0, Math.PI * 2);
          g.stroke();
        } else shadow(at.x, at.y, 5);
        stand(src.img, r, at.x, at.y, hero && !at.running ? this.hero.left : at.left);
      } });
    }
    standing.sort((a, b) => a.y - b.y).forEach((s2) => s2.draw());
    // A south wall stands in front of the room: its cap goes over anyone right up against it (feet, rings and all).
    for (const t of this.tiles[2]) if (this.capped.has(`${t.x},${t.y}`)) tile(atlas.rect(t.name), t.x, t.y);
    // The Heart's glow, once it's stirred.
    if (ready || awake) {
      const hx = (HEART[0] + 0.5) * 16, hy = (HEART[1] - 1.1) * 16;
      const red = g.createRadialGradient(hx, hy, 2, hx, hy, 60);
      red.addColorStop(0, `rgba(255, 90, 126, ${(ready ? 0.32 : 0.18) + 0.06 * Math.sin(this.time * 3)})`);
      red.addColorStop(1, 'rgba(255, 90, 126, 0)');
      g.fillStyle = red;
      g.fillRect(hx - 60, hy - 60, 120, 120);
    }
    // The shrine's glow.
    const cx = (SHRINE[0] + 0.5) * 16, cy = (SHRINE[1] - 0.8) * 16;
    const glow = g.createRadialGradient(cx, cy, 2, cx, cy, 70);
    glow.addColorStop(0, `rgba(179, 140, 255, ${0.3 + 0.08 * Math.sin(this.time * 2)})`);
    glow.addColorStop(1, 'rgba(179, 140, 255, 0)');
    g.fillStyle = glow;
    g.fillRect(cx - 70, cy - 70, 140, 140);
  }
}
