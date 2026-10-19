/**
 * The first run, floor by floor: what you've earned, what the next companion costs, your damage against the monsters'
 * health, how long each boss held you up, and the multipliers behind the damage.
 *   node scripts/floors.ts [hours=1.5] [--every 1] [--active minutes]
 * Each row is the moment the floor is first reached; damage/s leaves out temporary buffs (Rampage, War Drums,
 * Phantom Legion, goblin rewards) and counts crits at their average. The player clicks and shops the whole time unless --active says
 * otherwise. TUNE='{"goldGrowth":1.55}' overrides pacing knobs.
 */
import Decimal from 'break_infinity.js';
import { TUNE, TRASH, floorHp, isBossFloor, MANUAL_RATE } from '../src/game/game.ts';
import { COMPS } from '../src/game/data.ts';
import { fmt, duration, setNotation } from '../src/game/format.ts';
import { Sim, seedRandom } from './bot.ts';

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const k = args.indexOf(name);
  return k >= 0 ? Number(args[k + 1]) : fallback;
};
const hours = Number(args.find((a, k) => !a.startsWith('--') && !args[k - 1]?.startsWith('--')) ?? 1.5);
const every = flag('--every', 1);
const activeMin = flag('--active', hours * 60);

if (process.env.TUNE) Object.assign(TUNE, JSON.parse(process.env.TUNE));
seedRandom(Number(process.env.SEED ?? 1));
setNotation('sci');

interface Row {
  floor: number;
  t: number;
  earned: Decimal;
  hp: Decimal;
  goldPerKill: Decimal;
  power: Decimal;
  nextHire: number;
  nextHireCost: Decimal | null;
  trophies: number;
  party: number;
  tonics: number;
  souls: number;
  boss: number;
  bossWait?: number;
  bossFails: number;
}

const rows = new Map<number, Row>();
/** A boss can spawn in the same step its floor is first reached, before that floor has a row. */
const bossHp = new Map<number, Decimal>();

const sim = new Sim({ cps: MANUAL_RATE, activeMin, descendRatio: 0, awakenRatio: 1, stall: 120, catchRate: 0.05 }, {
  event(ev, { game }) {
    const boss = ev.t === 'spawn' && game.monsters.find((m) => m.id === ev.id && m.boss);
    if (boss && !bossHp.has(game.s.floor)) bossHp.set(game.s.floor, boss.max);
    const row = ev.t === 'bossFail' && rows.get(ev.floor);
    if (row) row.bossFails++;
  },
  tick({ game, t }) {
    const floor = game.s.maxFloor;
    if (!rows.has(floor)) {
      const { parts, click, autoBase, crit, critMult } = game.breakdown();
      const nextHire = game.s.owned.findIndex((n) => n === 0);
      const clicking = sim.active ? MANUAL_RATE : 0;
      rows.set(floor, {
        floor, t,
        earned: game.s.totalGold,
        hp: floorHp(floor).times(TRASH),
        goldPerKill: game.monsterGold({ boss: false, champ: false } as never),
        power: game.baseDps().plus(click.times((1 + crit * (critMult - 1)) * (clicking + (game.abilityUnlocked('blade') ? autoBase : 0)))),
        nextHire,
        nextHireCost: nextHire >= 0 ? game.compCost(nextHire) : null,
        trophies: parts.trophies, party: parts.party * parts.banner, tonics: parts.upgrades, souls: parts.souls, boss: parts.boss,
        bossFails: 0,
      });
    }
    for (const row of rows.values()) if (isBossFloor(row.floor) && row.bossWait === undefined && floor > row.floor) row.bossWait = t - row.t;
  },
});
sim.run(hours);

const x = (n: number) => `×${n < 100 ? n.toFixed(1) : fmt(n)}`;
const cols: [string, number, (r: Row) => string][] = [
  ['floor', 5, (r) => String(r.floor)],
  ['reached', 8, (r) => duration(r.t)],
  ['gold earned', 11, (r) => fmt(r.earned)],
  ['monster hp', 10, (r) => fmt(r.hp)],
  ['gold/kill', 9, (r) => fmt(r.goldPerKill)],
  ['damage/s', 9, (r) => fmt(r.power)],
  ['kill', 6, (r) => `${fmt(r.hp.div(r.power).toNumber())}s`],
  ['boss hp', 9, (r) => (bossHp.has(r.floor) ? fmt(bossHp.get(r.floor)!) : '')],
  ['boss kill', 9, (r) => (bossHp.has(r.floor) ? `${fmt(bossHp.get(r.floor)!.div(r.power.times(r.boss)).toNumber())}s/30` : '')],
  ['held up', 8, (r) => (r.bossWait !== undefined ? duration(r.bossWait) : '')],
  ['fails', 5, (r) => (r.bossFails ? String(r.bossFails) : '')],
  ['next hire', 18, (r) => (r.nextHire >= 0 ? COMPS[r.nextHire].name : '(all hired)')],
  ['hire cost', 9, (r) => (r.nextHireCost ? fmt(r.nextHireCost) : '')],
  ['= kills', 7, (r) => (r.nextHireCost ? fmt(r.nextHireCost.div(r.goldPerKill).toNumber()) : '')],
  ['trophies', 8, (r) => x(r.trophies)],
  ['party', 7, (r) => x(r.party)],
  ['tonics', 6, (r) => x(r.tonics)],
  ['souls', 6, (r) => x(r.souls)],
  ['vs boss', 7, (r) => x(r.boss)],
];
const line = (cells: string[]) => cells.map((c, k) => (k ? c.padStart(cols[k][1]) : c.padEnd(cols[k][1]))).join('  ');
console.log(line(cols.map(([name]) => name)));
for (const row of [...rows.values()].sort((a, b) => a.floor - b.floor)) {
  if (row.floor % every === 0) console.log(line(cols.map(([, , cell]) => cell(row))));
}
