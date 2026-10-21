/**
 * The other end from the timeline's casual player: someone who plays nonstop, always holding attack, using Rampage and
 * every skill the moment they're ready. Hours are real hours (no time away).
 *   node scripts/active.ts [hours=12] [--seed n] [--eager] [--idle]
 * --eager ascends as soon as souls would double (otherwise only once stuck); --idle attacks only in the first two
 * minutes, for comparison. TUNE='{"deepGold":1.13}' overrides pacing knobs.
 */
import { TUNE } from '../src/game/game.ts';
import { COMPS } from '../src/game/data.ts';
import { duration } from '../src/game/format.ts';
import { Sim, seedRandom, type Profile } from './bot.ts';

const H = 3600;
const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const hours = Number(args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 12);
const eager = args.includes('--eager');
const idle = args.includes('--idle');
if (process.env.TUNE) Object.assign(TUNE, JSON.parse(process.env.TUNE));
seedRandom(flag('--seed', 1));

const PLAYER: Profile = { cps: 5, activeMin: 0, descendRatio: 0, descendGain: 1, ascendEager: eager, ascendMin: 5, awakenRatio: 1, stall: 180, catchRate: 0.5, resetActive: 0, shopEvery: 1 };

let best = 1;
let bestAt = 0;
let fails = 0;
let ascents = 0;
/** Seconds each new deepest floor took to reach. */
const newFloors: { t: number; secs: number }[] = [];
const lines: string[] = [];
const hired = new Set<number>();
/** log10 of all damage (party, attacks, Phantom Blade, crits) over the party's alone, sampled. */
let boostSum = 0;
let boostN = 0;

const sim = new Sim(PLAYER, {
  event(ev) {
    if (ev.t === 'bossFail') fails++;
  },
  descend(_souls, { game, t }) {
    ascents++;
    if (ascents <= 8) lines.push(`${duration(t)}  ascent ${ascents} from floor ${game.s.bestFloor}`);
  },
  tick({ game, t }) {
    if (game.s.bestFloor > best) {
      newFloors.push({ t, secs: t - bestAt });
      best = game.s.bestFloor;
      bestAt = t;
    }
    game.s.owned.forEach((level, i) => {
      if (level === 0 || hired.has(i)) return;
      hired.add(i);
      if (i % 4 === 3 || COMPS[i].floor) lines.push(`${duration(t)}  ${COMPS[i].name} hired at level ${level}`);
    });
    if (game.baseDps().gt(0) && Math.random() < 0.05) {
      const crit = 1 + game.critChance() * (game.critMult() - 1);
      const hand = sim.active && game.focus() ? 5 : 0;
      boostSum += game.dpsTotal().plus(game.clickTotal().times(hand)).times(crit).div(game.baseDps()).log10();
      boostN++;
    }
  },
});

sim.startSession(idle ? 120 : hours * H);
const depth: string[] = [];
for (const h of [0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24].filter((x) => x <= hours)) {
  sim.runUntil(h * H);
  depth.push(`${h}h:${sim.game.s.bestFloor}`);
}
const median = (from: number, to: number) => {
  const secs = newFloors.filter((x) => x.t >= from * H && x.t < to * H).map((x) => x.secs).sort((a, b) => a - b);
  return secs.length ? `${secs[Math.floor(secs.length / 2)].toFixed(1)}s` : '-';
};

console.log(`${idle ? 'Idle' : 'Always active'}, ${eager ? 'ascends as soon as souls double' : 'ascends once stuck'}, ${hours} hours`);
console.log(`  deepest floor   ${depth.join('  ')}`);
console.log(`  new floor took  0–2h ${median(0, 2)}  2–4h ${median(2, 4)}  4–8h ${median(4, 8)}  8–12h ${median(8, 12)}  (median)`);
console.log(`  all damage ÷ party ×${(10 ** (boostSum / Math.max(1, boostN))).toFixed(1)}   bosses failed ${fails}   ascents ${ascents}   companions ${hired.size}/${COMPS.length}`);
for (const line of lines) console.log(`  ${line}`);
