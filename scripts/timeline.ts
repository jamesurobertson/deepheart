/**
 * The long view: a casual player for hundreds of played hours, checked against the timeline we want.
 *   node scripts/timeline.ts [hours=300] [--seed n] [--dt 0.1]
 * Three 20-minute sessions a day (attacking by hand for the first 2 minutes), away 4h, 4h and overnight in between,
 * paid out by the game's own offline rules. Times below are played time; time away doesn't count.
 * TUNE='{"deepHp":1.17}' overrides pacing knobs. Exits 1 if any milestone misses its window.
 */
import { AWAKEN_ON, TUNE } from '../src/game/game.ts';
import { COMPS, CORRUPTION, ZONES } from '../src/game/data.ts';
import { duration } from '../src/game/format.ts';
import { Sim, seedRandom, type Profile } from './bot.ts';
import { Novelty, type Gap } from './progress.ts';

const H = 3600;
const SESSION = 20 * 60;
const ACTIVE = 2 * 60;
/** Hours away after each of the day's three sessions. */
const AWAY = [4, 4, 15];

const CASUAL: Profile = { cps: 5, activeMin: 0, descendRatio: 0, descendGain: 1, ascendEager: true, ascendMin: 5, awakenRatio: 0.25, stall: 180, catchRate: 0.03, resetActive: 0, shopEvery: 5 };

/** The longest quiet stretch allowed, by when it starts. */
const quietLimit = (start: number) => (start < 10 * H ? 20 * 60 : start < 100 * H ? H : 3 * H);

interface Milestone {
  name: string;
  window: string;
  result: string;
  status: 'PASS' | 'FAIL' | 'REPORT';
}

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const hours = Number(args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 300);
if (process.env.TUNE) Object.assign(TUNE, JSON.parse(process.env.TUNE));
seedRandom(flag('--seed', Number(process.env.SEED ?? 1)));

const met = new Set<number>();
/** Played time each companion was first hired. */
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
let allMet: number | null = null;
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

const sim = new Sim(CASUAL, {
  event(ev, { t }) {
    novelty.event(ev, t);
    if (ev.t === 'bossFail') firstWall ??= t;
  },
  descend(_souls, { game, t }) {
    firstAscent ??= t;
    metAtFirstAscent ??= game.s.owned.filter((n) => n > 0).length;
  },
  awaken(bound, { game, t }) {
    firstAwaken ??= t;
    ascentsToAwaken ??= sim.descents;
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
      }
    });
    if (allMet === null && met.size === COMPS.length) allMet = t;
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
while (sim.t < end) {
  sim.startSession(ACTIVE);
  sim.runUntil(Math.min(end, sim.t + SESSION));
  if (sim.t < end) {
    sim.sendTrips();
    sim.away(AWAY[session % AWAY.length] * H);
  }
  session++;
}
novelty.fresh(sim.t, 'end of run');
if (floorAt1h === null) floorAt1h = sim.game.s.bestFloor;

/** Played time in hours and minutes ("292h 4m"): days would read like calendar time. */
const played = (s: number) => (s < H ? duration(s) : `${Math.floor(s / H)}h ${Math.floor((s % H) / 60)}m`);
const t = (s: number | null) => (s === null ? 'never' : played(s));
const within = (s: number | null, lo: number, hi: number) => (s !== null && s >= lo && s <= hi ? 'PASS' : 'FAIL');
const reach = (s: number | null, hi: number) => s === null && sim.t < hi;
/** Longest stretch without meeting someone new, until the whole party is met. */
const meetTimes = [0, ...metAt.filter((x) => x !== undefined).sort((a, b) => a - b)];
const meetWait = Math.max(...meetTimes.slice(1).map((x, i) => x - meetTimes[i]));
const ms: Milestone[] = [
  { name: 'First wall (a boss you fail)', window: '5m–25m', result: t(firstWall), status: within(firstWall, 5 * 60, 25 * 60) },
  { name: 'Deepest floor at 1h', window: '30–60', result: String(floorAt1h), status: floorAt1h >= 30 && floorAt1h <= 60 ? 'PASS' : 'FAIL' },
  // (Bosses became walls in October 2026, at the cost of a slower first climb: these three windows moved with it.)
  { name: 'First ascent', window: '2h–4h30m', result: t(firstAscent), status: within(firstAscent, 2 * H, 4.5 * H) },
  { name: 'Companions met by the first ascent', window: '16–19', result: String(metAtFirstAscent ?? 'no ascent'), status: metAtFirstAscent !== null && metAtFirstAscent >= 16 && metAtFirstAscent <= 19 ? 'PASS' : 'FAIL' },
  { name: 'All 24 companions met', window: '6h–10h', result: t(allMet), status: reach(allMet, 10 * H) ? 'REPORT' : within(allMet, 6 * H, 10 * H) },
  { name: 'Longest wait for a new companion', window: 'under 2h', result: allMet === null ? 'party not complete' : played(meetWait), status: allMet !== null && meetWait < 2 * H ? 'PASS' : reach(allMet, 10 * H) ? 'REPORT' : 'FAIL' },
  { name: `Every card can drop (floor ${ALL_CARDS_FLOOR})`, window: '5h–10h', result: t(allCardsAt), status: reach(allCardsAt, 10 * H) ? 'REPORT' : within(allCardsAt, 5 * H, 10 * H) },
  { name: 'First awakening', window: '20h–26h', result: !AWAKEN_ON ? 'switched off' : firstAwaken === null ? t(firstAwaken) : `${t(firstAwaken)} (${ascentsToAwaken} ascents)`, status: !AWAKEN_ON || reach(firstAwaken, 26 * H) ? 'REPORT' : within(firstAwaken, 20 * H, 26 * H) },
  (() => {
    const done = cycles.filter((c) => c.back !== null);
    const slowest = Math.max(0, ...done.map((c) => c.back!));
    const never = cycles.filter((c, k) => c.back === null && k < cycles.length - 1).length;
    return { name: 'Back to the last depth after awakening', window: 'under 45m', result: cycles.length ? `${done.map((c) => played(c.back!)).join(', ') || 'not yet'}${never ? `, ${never} never` : ''}` : 'no awakening', status: !cycles.length || (!done.length && cycles.length === 1) ? 'REPORT' : slowest <= 45 * 60 && !never ? 'PASS' : 'FAIL' } as Milestone;
  })(),
  { name: 'Third layer opens', window: '100h–150h', result: 'not built yet', status: 'REPORT' },
];

// Quiet stretches: time with nothing new, judged by when they start.
const quiet = novelty.gaps.filter((g) => g.endedBy !== 'end of run' && g.to - g.from > quietLimit(g.from));
const longest = [...novelty.gaps].sort((a, b) => b.to - b.from - (a.to - a.from)).slice(0, 3);
ms.push({
  name: 'Never too long without something new',
  window: '20m to 10h, 1h to 100h, 3h after',
  result: quiet.length ? `${quiet.length} too long (first at ${played(quiet[0].from)}, longest ${played(longest[0].to - longest[0].from)} at ${played(longest[0].from)})` : 'ok',
  status: quiet.length ? 'FAIL' : 'PASS',
});
const flat = windows.findIndex((f, i) => i > 0 && f <= windows[i - 1]);
ms.push({
  name: 'Deepest floor rises every 20h',
  window: `to ${hours}h`,
  result: flat < 0 ? `ok (${windows.join(' → ')})` : `flat in hours ${flat * 20}–${(flat + 1) * 20}`,
  status: flat < 0 ? 'PASS' : 'FAIL',
});

const gapLine = (g: Gap) => `${played(g.to - g.from)} from ${played(g.from)}, ended by ${g.endedBy}`;
console.log(`\nTimeline: casual player, ${hours} played hours (${session} sessions, ${Math.ceil(session / 3)} days), ${sim.descents} ascents, ${sim.awakens} awakenings, ${met.size}/${COMPS.length} companions met`);
for (const m of ms) console.log(`  ${m.status.padEnd(6)} ${m.name.padEnd(38)} ${m.window.padEnd(34)} ${m.result}`);
console.log(`  info   first run reaches floor ${OPENING_FLOORS.map((f) => `${f} at ${t(opening.get(f) ?? null)}`).join(', ')}`);
console.log(`  info   deepest floor every hour to 10h: ${hourly.map((f, i) => `${i + 1}h:${f}`).join(' ')}`);
console.log(`  info   deepest floor every 10 played hours: ${curve.map(([s, f]) => `${Math.round(s / H)}h:${f}`).join(' ')}`);
console.log(`  info   awakenings: ${cycles.map((c) => `${played(c.at)} at floor ${c.depth} for ${c.bound}`).join('; ') || 'none'}`);
console.log(`  info   cards collected every 20 played hours: ${cardsAt.map((n, i) => `${(i + 1) * 20}h:${n}`).join(' ')}`);
console.log(`  info   longest quiet stretches: ${longest.map(gapLine).join('; ')}`);
console.log(`  (${Math.round((Date.now() - started) / 1000)}s)`);
const failed = ms.filter((m) => m.status === 'FAIL').length;
console.log(failed ? `\n${failed} timeline milestone${failed > 1 ? 's' : ''} missed.` : '\nEvery timeline milestone is on schedule.');
process.exit(failed ? 1 : 0);
