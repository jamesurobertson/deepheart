/**
 * The numbers the souls rework is tuned against, for the always-active player:
 *   node scripts/report.ts [hours=12] [--seed n] [--gain 0.5]      TUNE='{"deepGold":1.15}' overrides pacing knobs.
 * --gain: ascend once stalled and the souls on offer grow yours by this share (default +50%, the game's own hint).
 * Every ascent (levels bought, souls paid, which companion was carrying the party), how long new deepest floors take,
 * and what purchases cost in seconds of income: minutes is a decision, under a second is a formality.
 */
import Decimal from 'break_infinity.js';
import { Game, TUNE } from '../src/game/game.ts';
import { COMPS, isTraitId } from '../src/game/data.ts';
import { duration } from '../src/game/format.ts';
import { NONSTOP, Sim, seedRandom } from './bot.ts';

const H = 3600;
const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const hours = Number(args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 12);
if (process.env.TUNE) Object.assign(TUNE, JSON.parse(process.env.TUNE));
seedRandom(flag('--seed', 1));

/** This run's gold earned, sampled each second over the last minute, for the income rate (all-time gold is too big
 *  for a new run's income to show in it). */
const earned: number[] = [];
const incomeRate = () => (earned.length > 1 ? Math.max(1e-9, (earned[earned.length - 1] - earned[0]) / (earned.length - 1)) : 1e-9);

type BuyKind = 'level' | 'trait' | 'upgrade';
const buys: { kind: BuyKind; secs: number; run: number }[] = [];
let sim: Sim;
const record = (kind: BuyKind, spent: Decimal) => {
  if (sim && earned.length > 30) buys.push({ kind, secs: spent.toNumber() / incomeRate(), run: sim.game.s.descents });
};
const buyComp = Game.prototype.buyComp;
Game.prototype.buyComp = function (i: number, count?: number) {
  const before = this.s.gold;
  const ok = buyComp.call(this, i, count);
  if (ok) record('level', before.minus(this.s.gold));
  return ok;
};
const buyUpg = Game.prototype.buyUpg;
Game.prototype.buyUpg = function (id: string) {
  const before = this.s.gold;
  const ok = buyUpg.call(this, id);
  if (ok) record(isTraitId(id) ? 'trait' : 'upgrade', before.minus(this.s.gold));
  return ok;
};

const ascents: string[] = [];
/** At each ascent: how many companions newer than the one dealing the most damage (0: the newest carries the party). */
const carrierAge: number[] = [];
const newFloors: { t: number; secs: number }[] = [];
let best = 1;
let bestAt = 0;
let runStart = 0;
const firstAt: string[] = [];

sim = new Sim({ ...NONSTOP, descendGain: flag('--gain', NONSTOP.descendGain ?? 1) }, {
  descend(souls, { game, t }) {
    const levels = game.s.owned.reduce((a, b) => a + b, 0);
    const hired = COMPS.map((_, i) => i).filter((i) => game.s.owned[i] > 0);
    const carrier = hired.reduce((a, b) => (game.compDps(b).gt(game.compDps(a)) ? b : a), hired[0]);
    const age = hired.filter((i) => i > carrier).length;
    carrierAge.push(age);
    const n = game.s.descents + 1;
    ascents.push(`${String(n).padStart(4)}  ${duration(t).padStart(9)}  ${duration(t - runStart).padStart(8)}  ${String(game.s.maxFloor).padStart(5)}  ${String(levels).padStart(7)}  ${('+' + souls).padStart(9)}  ${String(game.s.souls + souls).padStart(10)}   ${COMPS[carrier].name}${age ? ` (${age} newer)` : ''}`);
    runStart = t;
    earned.length = 0;
  },
  tick({ game, t }) {
    if (Math.floor(t) !== Math.floor(t - 0.1)) {
      earned.push(game.s.runGold.toNumber());
      if (earned.length > 61) earned.shift();
    }
    if (game.s.bestFloor > best) {
      if ([10, 30, 50, 100].includes(game.s.bestFloor)) firstAt.push(`floor ${game.s.bestFloor} ${duration(t)}`);
      newFloors.push({ t, secs: t - bestAt });
      best = game.s.bestFloor;
      bestAt = t;
    }
  },
});
sim.startSession(hours * H);
sim.runUntil(hours * H);

const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)] : NaN);
const secs = (s: number) => (Number.isNaN(s) ? '-' : s < 1 ? '<1s' : s < 120 ? `${s.toFixed(0)}s` : s < 2 * H ? `${(s / 60).toFixed(0)}m` : `${(s / H).toFixed(1)}h`);

console.log(`Always-active player, ${hours} h, seed ${flag('--seed', 1)}${process.env.TUNE ? `, TUNE ${process.env.TUNE}` : ''}`);
console.log(`First reached: ${firstAt.join(' · ')}`);
console.log(`\nAscents (${ascents.length})`);
console.log('   #     played      run  floor   levels      souls       total   carrying the party');
const shown = ascents.length > 14 ? [...ascents.slice(0, 10), '   …', ...ascents.slice(-3)] : ascents;
for (const row of shown) console.log(row);
const older = carrierAge.filter((a) => a > 0).length;
console.log(`An older companion was carrying the party at ${older} of ${carrierAge.length} ascents.`);

console.log('\nNew deepest floors: seconds each took (10th percentile / median)');
const bands = [0, 1, 2, 4, 8, 12, 16, 24].filter((h) => h < hours);
console.log(bands.map((from, k) => {
  const to = bands[k + 1] ?? hours;
  const xs = newFloors.filter((x) => x.t >= from * H && x.t < to * H).map((x) => x.secs);
  return `${from}–${to}h ${secs(pct(xs, 0.1))} / ${secs(pct(xs, 0.5))} (${xs.length})`;
}).join('   '));

console.log('\nPurchases: price in seconds of income (median, share costing 30 s or more, count)');
for (const [label, keep] of [['first run', (r: number) => r === 0], ['runs 2–5', (r: number) => r >= 1 && r <= 4], ['run 6 on', (r: number) => r >= 5]] as const) {
  const cells = (['level', 'trait', 'upgrade'] as BuyKind[]).map((kind) => {
    const xs = buys.filter((b) => b.kind === kind && keep(b.run)).map((b) => b.secs);
    if (!xs.length) return `${kind} -`;
    const slow = xs.filter((x) => x >= 30).length / xs.length;
    return `${kind} ${secs(pct(xs, 0.5))}, ${(slow * 100).toFixed(0)}% ≥30s (${xs.length})`;
  });
  console.log(`  ${label.padEnd(10)} ${cells.join('   ')}`);
}
const g = sim.game;
console.log(`\nAt ${hours} h: deepest floor ${g.s.bestFloor}, souls ${g.s.souls} (${g.soulsFree()} kept: ×${g.soulMult().toFixed(1)} damage)`);
console.log(`  Old Ones: ${Object.entries(g.s.oldOnes).map(([id, lv]) => `${id} ${lv}`).join(', ') || 'none'}`);
console.log(`  Heartmarks: ${COMPS.map((c, i) => (g.s.marks[i] ? `${c.name} ${g.s.marks[i]}` : '')).filter(Boolean).join(', ') || 'none'}`);
