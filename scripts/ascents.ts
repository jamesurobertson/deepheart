/**
 * Every ascent of a casual player under the current rules: when, how deep, and the souls it paid.
 *   node scripts/ascents.ts [hours=12] [--active]   --active: playing the whole time (clicking, abilities, no time away)
 *   TUNE='{"soulExp":0.2}' overrides pacing knobs.
 */
import { TUNE } from '../src/game/game.ts';
import { duration } from '../src/game/format.ts';
import { Sim, seedRandom, type Profile } from './bot.ts';

const H = 3600;
const AWAY = [4, 4, 15];
if (process.env.TUNE) Object.assign(TUNE, JSON.parse(process.env.TUNE));
seedRandom(Number(process.env.SEED ?? 1));
const ACTIVE = process.argv.includes('--active');
const CASUAL: Profile = { cps: 5, activeMin: 0, descendRatio: 0, descendGain: Number(process.env.GAIN ?? 1), ascendEager: true, ascendMin: 5, awakenRatio: 1, stall: 180, catchRate: 0.03, resetActive: 0, shopEvery: 5 };
const played = (s: number) => (s < H ? duration(s) : `${Math.floor(s / H)}h ${Math.floor((s % H) / 60)}m`);
let runStart = 0;
const sim = new Sim(ACTIVE ? { ...CASUAL, catchRate: 0.3, resetActive: 0, shopEvery: 1 } : CASUAL, {
  descend(souls, { game, t }) {
    console.log(`ascent ${String(game.s.descents + 1).padStart(2)}  ${played(t).padStart(8)}  run ${played(t - runStart).padStart(8)}  floor ${String(game.s.maxFloor).padStart(3)}  +${souls} → ${game.s.souls + souls}`);
    runStart = t;
  },
  awaken(stones, { game, t }) {
    console.log(`AWAKEN at ${played(t)}, floor ${game.s.cycleBest}, +${stones} stones`);
  },
});
const end = Number(process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? 12) * H;
if (ACTIVE) {
  sim.startSession(end);
  sim.runUntil(end);
}
for (let session = 0; sim.t < end; session++) {
  sim.startSession(120);
  sim.runUntil(Math.min(end, sim.t + 20 * 60));
  if (sim.t < end) sim.away(AWAY[session % AWAY.length] * H);
}
const g = sim.game;
console.log(`end ${played(sim.t)}: deepest ${g.s.bestFloor}, souls ${g.s.souls}`);
