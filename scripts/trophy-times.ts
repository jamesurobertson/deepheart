/** When the casual player earns each trophy.  node scripts/trophy-times.ts [hours=150] */
import { TROPHIES } from '../src/game/data.ts';
import { Sim, seedRandom, type Profile } from './bot.ts';

const H = 3600;
const CASUAL: Profile = { cps: 5, activeMin: 0, descendRatio: 0, descendGain: 1, ascendEager: true, ascendMin: 5, awakenRatio: 0.25, stall: 180, catchRate: 0.03, resetActive: 0, shopEvery: 5 };
const AWAY = [4, 4, 15];
seedRandom(1);
const hours = Number(process.argv[2] ?? 150);
const at = new Map<string, number>();
let awaken: number | null = null;
const sim = new Sim(CASUAL, {
  event(ev, { t }) { if (ev.t === 'trophy' && !at.has(ev.id)) at.set(ev.id, t); },
  awaken(_b, { t }) { awaken ??= t; },
}, 0.1);
let session = 0;
while (sim.t < hours * H) {
  sim.startSession(2 * 60);
  sim.runUntil(Math.min(hours * H, sim.t + 20 * 60));
  if (sim.t < hours * H) { sim.sendTrips(); sim.away(AWAY[session % 3] * H); }
  session++;
}
console.log(`first awakening ${awaken === null ? 'never' : (awaken / H).toFixed(1) + 'h'}; trophies ${at.size}/${TROPHIES.length}`);
for (const tr of TROPHIES) {
  const t = at.get(tr.id);
  console.log(`${tr.id.padEnd(9)} ${t === undefined ? '   -  ' : (t / H).toFixed(1).padStart(6)}  ${tr.name} — ${tr.desc}`);
}
const g = sim.game;
console.log(`end: best floor ${g.s.bestFloor}, dps ${g.dps().toExponential(2)}, kills ${g.s.kills}, bosses ${g.s.bosses ?? '?'}, clicks ${g.s.clicks ?? '?'}, ascents ${g.s.descents}, awakens ${g.s.awakens}, max level ${Math.max(...g.s.owned)}, levels ${g.s.owned.join(',')}`);
