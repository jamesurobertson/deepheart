/**
 * The long view: a casual player for hundreds of played hours, checked against the timeline we want.
 *   node scripts/timeline.ts [hours=300] [--seed n] [--dt 0.1]
 * Three 20-minute sessions a day (attacking by hand for the first 2 minutes), away 4h, 4h and overnight in between,
 * paid out by the game's own offline rules. Times below are played time; time away doesn't count.
 * TUNE='{"deepHp":1.17}' overrides pacing knobs. Exits 1 if any milestone misses its window.
 */
import { TUNE } from '../src/game/game.ts';
import { ABYSS, COMPS } from '../src/game/data.ts';
import { duration } from '../src/game/format.ts';
import { Sim, seedRandom, type Profile } from './bot.ts';
import { Novelty, type Gap } from './progress.ts';

const H = 3600;
const SESSION = 20 * 60;
const ACTIVE = 2 * 60;
/** Hours away after each of the day's three sessions. */
const AWAY = [4, 4, 15];

const CASUAL: Profile = { cps: 5, activeMin: 0, descendRatio: 0, descendGain: 0.5, awakenRatio: 1, stall: 180, catchRate: 0.03, resetActive: 0, shopEvery: 5 };

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

const firstRun = COMPS.map((c, i) => [c, i] as const).filter(([c]) => !c.depth && !c.heart).map(([, i]) => i);
const met = new Set<number>();
const novelty = new Novelty();
let firstWall: number | null = null;
let floorAt1h: number | null = null;
let firstAscent: number | null = null;
let firstAwaken: number | null = null;
let firstRunMet: number | null = null;
let abyssDone: number | null = null;
let allMet: number | null = null;
/** Deepest floor at the end of every 20-hour window, and every 10 hours for the curve. */
const windows: number[] = [];
const curve: [number, number][] = [];
/** The first day in more detail: when the first run (before any ascent) reaches these floors, and the depth each hour. */
const OPENING_FLOORS = [10, 20, 30, 50];
const opening = new Map<number, number>();
const hourly: number[] = [];

const sim = new Sim(CASUAL, {
  event(ev, { t }) {
    novelty.event(ev, t);
    if (ev.t === 'bossFail') firstWall ??= t;
  },
  descend(_souls, { t }) {
    firstAscent ??= t;
  },
  awaken(_stones, { t }) {
    firstAwaken ??= t;
  },
  tick({ game, t, dt }) {
    novelty.tick(game, t);
    if (game.s.descents === 0) for (const f of OPENING_FLOORS) if (!opening.has(f) && game.s.bestFloor >= f) opening.set(f, t);
    const crossed = (every: number) => t >= dt && Math.floor(t / every) !== Math.floor((t - dt) / every);
    if (t <= 10 * H && crossed(H)) hourly.push(game.s.bestFloor);
    if (!crossed(60)) return;
    // Once a played minute is plenty for everything slower than a floor.
    if (floorAt1h === null && t >= H) floorAt1h = game.s.bestFloor;
    game.s.owned.forEach((n, i) => n > 0 && met.add(i));
    if (firstRunMet === null && firstRun.every((i) => met.has(i))) firstRunMet = t;
    if (allMet === null && met.size === COMPS.length) allMet = t;
    // The core of the Abyss tree: every power at level 10 (or its cap, if lower).
    if (abyssDone === null && ABYSS.every((a) => game.abyssLv(a.id) >= Math.min(a.max, 10))) abyssDone = t;
    if (crossed(20 * H)) windows.push(game.s.bestFloor);
    if (crossed(10 * H)) curve.push([t, game.s.bestFloor]);
  },
}, flag('--dt', 0.1));

const started = Date.now();
const end = hours * H;
let session = 0;
while (sim.t < end) {
  sim.startSession(ACTIVE);
  sim.runUntil(Math.min(end, sim.t + SESSION));
  if (sim.t < end) sim.away(AWAY[session % AWAY.length] * H);
  session++;
}
novelty.fresh(sim.t, 'end of run');
if (floorAt1h === null) floorAt1h = sim.game.s.bestFloor;

/** Played time in hours and minutes ("292h 4m"): days would read like calendar time. */
const played = (s: number) => (s < H ? duration(s) : `${Math.floor(s / H)}h ${Math.floor((s % H) / 60)}m`);
const t = (s: number | null) => (s === null ? 'never' : played(s));
const within = (s: number | null, lo: number, hi: number) => (s !== null && s >= lo && s <= hi ? 'PASS' : 'FAIL');
const reach = (s: number | null, hi: number) => s === null && sim.t < hi;
const ms: Milestone[] = [
  { name: 'First wall (a boss you fail)', window: '10m–25m', result: t(firstWall), status: within(firstWall, 10 * 60, 25 * 60) },
  { name: 'Deepest floor at 1h', window: '40–60', result: String(floorAt1h), status: floorAt1h >= 40 && floorAt1h <= 60 ? 'PASS' : 'FAIL' },
  { name: 'First ascent', window: '1h–3h', result: t(firstAscent), status: within(firstAscent, H, 3 * H) },
  { name: 'All 12 first-run companions met', window: '4h–8h', result: t(firstRunMet), status: within(firstRunMet, 4 * H, 8 * H) },
  { name: 'First awakening', window: '15h–40h', result: t(firstAwaken), status: reach(firstAwaken, 40 * H) ? 'REPORT' : within(firstAwaken, 15 * H, 40 * H) },
  { name: 'Abyss powers all at level 10', window: '40h–100h', result: t(abyssDone), status: reach(abyssDone, 100 * H) ? 'REPORT' : within(abyssDone, 40 * H, 100 * H) },
  { name: 'All 24 companions met', window: '80h–150h', result: t(allMet), status: reach(allMet, 150 * H) ? 'REPORT' : within(allMet, 80 * H, 150 * H) },
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
console.log(`  info   longest quiet stretches: ${longest.map(gapLine).join('; ')}`);
console.log(`  (${Math.round((Date.now() - started) / 1000)}s)`);
const failed = ms.filter((m) => m.status === 'FAIL').length;
console.log(failed ? `\n${failed} timeline milestone${failed > 1 ? 's' : ''} missed.` : '\nEvery timeline milestone is on schedule.');
process.exit(failed ? 1 : 0);
