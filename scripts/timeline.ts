/**
 * The long view: a player for hundreds of hours, checked against the timeline we want.
 *   node scripts/timeline.ts [hours] [--player casual|left-on] [--seed n] [--dt 0.1]
 * - casual: three 20-minute sessions a day (attacking by hand for the first 2 minutes), away 4h, 4h and overnight in
 *   between, paid out by the game's own offline rules. Times are played time; time away doesn't count. 300 h by default.
 * - left-on: the game left running 16 hours a day (10 active minutes every 4 hours), closed overnight. Times are hours
 *   with the game running, shown as days. 70 days by default.
 * Both ascend once stuck, as Clicker Heroes players are told to. TUNE='{"deepHp":1.17}' overrides pacing knobs, and
 * LATE='{"step":1e12,"skip":1}' the pricing of everyone after the gap.
 * Exits 1 if any milestone misses its window.
 */
import { AWAKEN_ON, TUNE } from '../src/game/game.ts';
import { COMPS, CORRUPTION, GAP_SLOT, LATE_PRICING, ZONES, priceLate } from '../src/game/data.ts';
import { duration } from '../src/game/format.ts';
import { Sim, seedRandom, type Profile } from './bot.ts';
import { Novelty, type Gap } from './progress.ts';

const H = 3600;
const DAY_ON = 16 * H;

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string, fallback: number) => Number(option(name) ?? fallback);
const player = option('--player') ?? 'casual';
if (player !== 'casual' && player !== 'left-on') throw new Error(`--player is casual or left-on, not ${player}`);
const leftOn = player === 'left-on';
const hours = Number(args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? (leftOn ? 70 * 16 : 300));
if (process.env.TUNE) Object.assign(TUNE, JSON.parse(process.env.TUNE));
// LATE='{"step":1e12,"skip":1}' reprices everyone after the gap (see priceLate).
if (process.env.LATE) {
  Object.assign(LATE_PRICING, JSON.parse(process.env.LATE));
  priceLate();
}
seedRandom(flag('--seed', Number(process.env.SEED ?? 1)));

// Both play mostly idle, so both buy idle Spirits. Both ascend once stuck whenever it adds a tenth to their souls, and awaken after 3 ascents made while an awakening
// would pay: Clicker Heroes' advice (ascend when you keep failing bosses; transcend after 3–4 ascents that gain).
const CASUAL: Profile = { cps: 5, activeMin: 0, descendRatio: 0, descendGain: 0.1, ascendEager: false, ascendMin: 5, awakenRatio: 0.1, awakenAfter: 3, stall: 180, catchRate: 0.03, resetActive: 0, shopEvery: 5, style: 'idle' };
const LEFT_ON: Profile = CASUAL;

/** The seventeenth companion, in the big gap after the first sixteen (Clicker Heroes' Frostleaf to Dread Knight):
 *  everyone after it is priced like the Rangers. */
const GAP = GAP_SLOT;

/** Windows in seconds of the player's own clock (played time, or time running), from docs/progression-plan.md §4. */
const days = (from: number, to: number): [number, number] => [(from - 1) * DAY_ON, to * DAY_ON];
const hrs = (from: number, to: number): [number, number] => [from * H, to * H];
const TARGETS = leftOn
  ? { firstAscent: days(1, 1), gapMet: days(2, 3), ascentsToAwaken: [15, 30], firstAwaken: days(5, 8), allMet: days(36, 70) }
  : { firstAscent: hrs(2, 4.5), gapMet: hrs(10, 14), ascentsToAwaken: [10, 25], firstAwaken: hrs(25, 40), allMet: hrs(250, 400) };

/** The longest quiet stretch allowed, by when it starts. */
const quietLimit = (start: number) => (start < 10 * H ? 20 * 60 : start < 100 * H ? H : 3 * H);

interface Milestone {
  name: string;
  window: string;
  result: string;
  status: 'PASS' | 'FAIL' | 'REPORT';
}

const met = new Set<number>();
/** When each companion was first hired, on the player's clock. */
const metAt: number[] = [];
let metAtFirstAscent: number | null = null;
/** The first floor of the last corrupted lap: from here every card variant can drop (the card-farming endgame). */
const ALL_CARDS_FLOOR = (CORRUPTION.length - 1) * ZONES.length * 10 + 1;
let allCardsAt: number | null = null;
const novelty = new Novelty();
let firstWall: number | null = null;
let floorAt1h: number | null = null;
let firstAscent: number | null = null;
let firstAwaken: number | null = null;
let ascentsToAwaken: number | null = null;
/** Ascents made before the gap companion arrived (when it arrives before the first awakening). */
let gapAscents: number | null = null;
/** Deepest floor at the end of every 20-hour window, and every 10 hours for the curve. */
const windows: number[] = [];
const curve: [number, number][] = [];
/** The first day in more detail: when the first run (before any ascent) reaches these floors, and the depth each hour. */
const OPENING_FLOORS = [10, 20, 30, 50];
const opening = new Map<number, number>();
/** Every awakening: when, the depth it left, the bound souls it paid, and how long until that depth was reached again. */
const cycles: { at: number; depth: number; bound: number; back: number | null }[] = [];
/** Cards collected (every color, gold included) at the end of each 20-hour window. */
const cardsAt: number[] = [];
const hourly: number[] = [];
/** Ascents and awakenings since the last new companion, and what each companion took to reach. */
let ascentsSince = 0;
let awakensSince = 0;
const took: { comp: number; ascents: number; awakens: number }[] = [];

const sim = new Sim(leftOn ? LEFT_ON : CASUAL, {
  event(ev, { t }) {
    novelty.event(ev, t);
    if (ev.t === 'bossFail') firstWall ??= t;
  },
  descend(_souls, { game, t }) {
    firstAscent ??= t;
    metAtFirstAscent ??= game.s.owned.filter((n) => n > 0).length;
    ascentsSince++;
  },
  awaken(bound, { game, t }) {
    firstAwaken ??= t;
    ascentsToAwaken ??= sim.descents;
    awakensSince++;
    cycles.push({ at: t, depth: Math.max(game.s.cycleBest, game.s.maxFloor), bound, back: null });
  },
  tick({ game, t, dt }) {
    novelty.tick(game, t);
    if (game.s.descents === 0) for (const f of OPENING_FLOORS) if (!opening.has(f) && game.s.bestFloor >= f) opening.set(f, t);
    const crossed = (every: number) => t >= dt && Math.floor(t / every) !== Math.floor((t - dt) / every);
    if (t <= 10 * H && crossed(H)) hourly.push(game.s.bestFloor);
    if (!crossed(60)) return;
    // Once a played minute is plenty for everything slower than a floor.
    if (floorAt1h === null && t >= H) floorAt1h = game.s.bestFloor;
    game.s.owned.forEach((n, i) => {
      if (n > 0 && !met.has(i)) {
        met.add(i);
        metAt[i] = t;
        took.push({ comp: i, ascents: ascentsSince, awakens: awakensSince });
        ascentsSince = 0;
        awakensSince = 0;
        if (i === GAP && firstAwaken === null) gapAscents = sim.descents;
      }
    });
    if (allCardsAt === null && game.s.bestFloor >= ALL_CARDS_FLOOR) allCardsAt = t;
    if (crossed(20 * H)) {
      windows.push(game.s.bestFloor);
      cardsAt.push(game.cardVersions());
    }
    const open = cycles.at(-1);
    if (open && open.back === null && game.s.cycleBest >= open.depth) open.back = t - open.at;
    if (crossed(10 * H)) curve.push([t, game.s.bestFloor]);
  },
}, flag('--dt', 0.1));
const started = Date.now();
const end = hours * H;
let session = 0;
if (leftOn) {
  while (sim.t < end) {
    for (let block = 0; block < 4 && sim.t < end; block++) {
      sim.startSession(10 * 60);
      sim.runUntil(Math.min(end, sim.t + 4 * H));
      session++;
    }
    if (sim.t < end) {
      sim.sendTrips();
      sim.away(8 * H);
    }
  }
} else {
  const AWAY = [4, 4, 15];
  while (sim.t < end) {
    sim.startSession(2 * 60);
    sim.runUntil(Math.min(end, sim.t + 20 * 60));
    if (sim.t < end) {
      sim.sendTrips();
      sim.away(AWAY[session % AWAY.length] * H);
    }
    session++;
  }
}
novelty.fresh(sim.t, 'end of run');
if (floorAt1h === null) floorAt1h = sim.game.s.bestFloor;

/** Played time in hours and minutes ("292h 4m"), or for the left-on player its day ("day 6, 84h on"). */
const played = (s: number) => (s < H ? duration(s) : `${Math.floor(s / H)}h ${Math.floor((s % H) / 60)}m`);
const when = (s: number) => (leftOn ? `day ${Math.floor(s / DAY_ON) + 1} (${Math.round(s / H)}h on)` : played(s));
const t = (s: number | null) => (s === null ? 'never' : when(s));
const span = ([lo, hi]: [number, number]) => (leftOn ? `day ${Math.round(lo / DAY_ON) + 1}–${Math.round(hi / DAY_ON)}` : `${played(lo)}–${played(hi)}`);
const within = (s: number | null, [lo, hi]: [number, number]) => (s !== null && s >= lo && s <= hi ? 'PASS' : 'FAIL');
/** Not reached yet, and the run ended before the window closed: nothing to judge. */
const unjudged = (s: number | null, [, hi]: [number, number]) => s === null && sim.t < hi;
const judge = (s: number | null, window: [number, number]) => (unjudged(s, window) ? 'REPORT' : within(s, window));

const gap = COMPS[GAP];
const gapAt = metAt[GAP] ?? null;
const cleared = ascentsToAwaken !== null && gapAscents !== null ? ascentsToAwaken - gapAscents : null;
const [ascLo, ascHi] = TARGETS.ascentsToAwaken;
const allAt = met.size === COMPS.length ? Math.max(...metAt) : null;
// Each companion after the gap: the awakenings it took (the first: one or two; then one to three each).
const after = took.filter((x) => x.comp > GAP);
const offPace = after.filter((x, k) => (k === 0 ? x.awakens < 1 || x.awakens > 2 : x.awakens < 1 || x.awakens > 3));
const ms: Milestone[] = [
  { name: 'First wall (a boss you fail)', window: '5m–25m', result: t(firstWall), status: within(firstWall, [5 * 60, 25 * 60]) },
  { name: 'Deepest floor at 1h', window: '30–60', result: String(floorAt1h), status: floorAt1h >= 30 && floorAt1h <= 60 ? 'PASS' : 'FAIL' },
  { name: 'First ascent', window: span(TARGETS.firstAscent as [number, number]), result: t(firstAscent), status: judge(firstAscent, TARGETS.firstAscent as [number, number]) },
  { name: 'Companions met by the first ascent', window: '15–16', result: String(metAtFirstAscent ?? 'no ascent'), status: metAtFirstAscent !== null && metAtFirstAscent >= 15 && metAtFirstAscent <= 16 ? 'PASS' : 'FAIL' },
  { name: `${gap.name} (the gap)`, window: span(TARGETS.gapMet as [number, number]), result: t(gapAt), status: judge(gapAt, TARGETS.gapMet as [number, number]) },
  {
    name: `Ascents from ${gap.name} to awakening`, window: `${ascLo}–${ascHi}`, result: cleared === null ? 'not yet' : String(cleared),
    status: cleared === null ? (firstAwaken === null && sim.t < (TARGETS.firstAwaken as [number, number])[1] ? 'REPORT' : 'FAIL') : cleared >= ascLo && cleared <= ascHi ? 'PASS' : 'FAIL',
  },
  { name: `Every card can drop (floor ${ALL_CARDS_FLOOR})`, window: 'report', result: t(allCardsAt), status: 'REPORT' },
  { name: 'First awakening', window: span(TARGETS.firstAwaken as [number, number]), result: !AWAKEN_ON ? 'switched off' : firstAwaken === null ? t(firstAwaken) : `${t(firstAwaken)} (${ascentsToAwaken} ascents)`, status: !AWAKEN_ON ? 'REPORT' : judge(firstAwaken, TARGETS.firstAwaken as [number, number]) },
  {
    name: 'Awakenings per companion after the gap', window: 'first 1–2, then 1–3 each',
    result: after.length ? (offPace.length ? `off: ${offPace.map((x) => `${COMPS[x.comp].name} ${x.awakens}`).join(', ')}` : 'ok') : 'none yet',
    status: !after.length ? 'REPORT' : offPace.length ? 'FAIL' : 'PASS',
  },
  { name: `All ${COMPS.length} companions met`, window: span(TARGETS.allMet as [number, number]), result: t(allAt), status: judge(allAt, TARGETS.allMet as [number, number]) },
  (() => {
    const done = cycles.filter((c) => c.back !== null);
    const slowest = Math.max(0, ...done.map((c) => c.back!));
    const never = cycles.filter((c, k) => c.back === null && k < cycles.length - 1).length;
    return { name: 'Back to the last depth after awakening', window: 'under 45m', result: cycles.length ? `${done.map((c) => played(c.back!)).join(', ') || 'not yet'}${never ? `, ${never} never` : ''}` : 'no awakening', status: !cycles.length || (!done.length && cycles.length === 1) ? 'REPORT' : slowest <= 45 * 60 && !never ? 'PASS' : 'FAIL' } as Milestone;
  })(),
];

// Quiet stretches: time with nothing new, judged by when they start.
const quiet = novelty.gaps.filter((g) => g.endedBy !== 'end of run' && g.to - g.from > quietLimit(g.from));
const longest = [...novelty.gaps].sort((a, b) => b.to - b.from - (a.to - a.from)).slice(0, 3);
ms.push({
  name: 'Never too long without something new',
  window: '20m to 10h, 1h to 100h, 3h after',
  result: quiet.length ? `${quiet.length} too long (first at ${when(quiet[0].from)}, longest ${played(longest[0].to - longest[0].from)} at ${when(longest[0].from)})` : 'ok',
  status: quiet.length ? 'FAIL' : 'PASS',
});
const flat = windows.findIndex((f, i) => i > 0 && f <= windows[i - 1]);
ms.push({
  name: 'Deepest floor rises every 20h',
  window: `to ${hours}h`,
  result: flat < 0 ? `ok (${windows.join(' → ')})` : `flat in hours ${flat * 20}–${(flat + 1) * 20}`,
  status: flat < 0 ? 'PASS' : 'FAIL',
});

const gapLine = (g: Gap) => `${played(g.to - g.from)} from ${when(g.from)}, ended by ${g.endedBy}`;
const clock = leftOn ? `${Math.ceil(sim.t / DAY_ON)} days, ${Math.round(sim.t / H)}h running` : `${hours} played hours (${session} sessions, ${Math.ceil(session / 3)} days)`;
console.log(`\nTimeline: ${player} player, ${clock}, ${sim.descents} ascents, ${sim.awakens} awakenings, ${met.size}/${COMPS.length} companions met`);
for (const m of ms) console.log(`  ${m.status.padEnd(6)} ${m.name.padEnd(42)} ${m.window.padEnd(34)} ${m.result}`);
console.log(`  info   first run reaches floor ${OPENING_FLOORS.map((f) => `${f} at ${t(opening.get(f) ?? null)}`).join(', ')}`);
console.log(`  info   deepest floor every hour to 10h: ${hourly.map((f, i) => `${i + 1}h:${f}`).join(' ')}`);
console.log(`  info   deepest floor every 10 hours: ${curve.map(([s, f]) => `${Math.round(s / H)}h:${f}`).join(' ')}`);
console.log(`  info   companions from the ${COMPS[GAP - 2].name} on, with the ascents (and ★ awakenings) each took: ${took.filter((x) => x.comp >= GAP - 2).map((x) => `${COMPS[x.comp].name} ${when(metAt[x.comp])} +${x.ascents}${x.awakens ? `/${x.awakens}★` : ''}`).join(' · ')}`);
console.log(`  info   awakenings: ${cycles.map((c) => `${when(c.at)} at floor ${c.depth} for ${c.bound}`).join('; ') || 'none'}`);
console.log(`  info   cards collected every 20 hours: ${cardsAt.map((n, i) => `${(i + 1) * 20}h:${n}`).join(' ')}`);
console.log(`  info   longest quiet stretches: ${longest.map(gapLine).join('; ')}`);
console.log(`  (${Math.round((Date.now() - started) / 1000)}s)`);
const failed = ms.filter((m) => m.status === 'FAIL').length;
console.log(failed ? `\n${failed} timeline milestone${failed > 1 ? 's' : ''} missed.` : '\nEvery timeline milestone is on schedule.');
process.exit(failed ? 1 : 0);
