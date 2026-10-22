/**
 * Where the always-active player's damage comes from, and what the shop's upgrades cost them, stage by stage.
 *   node scripts/audit.ts [hours=12]
 * Damage sources are log10 shares of total party damage. "Income" prices each upgrade bought in seconds of the gold
 * the player was earning at the time: minutes is a decision, under a second is a formality.
 */
import Decimal from 'break_infinity.js';
import { Game, floorHp } from '../src/game/game.ts';
import { COMPS, UPG_BY_ID, isTraitId, levelMult } from '../src/game/data.ts';
import { Sim, seedRandom, type Profile } from './bot.ts';

const H = 3600;
const hours = Number(process.argv[2] ?? 12);
seedRandom(1);
const PLAYER: Profile = { cps: 5, activeMin: 0, descendRatio: 0, descendGain: 1, ascendMin: 5, awakenRatio: 1, stall: 180, catchRate: 0.5, resetActive: 0, shopEvery: 1 };

/** Gold earned over the last minute, sampled each second, for the income rate. */
const earned: number[] = [];
let sim: Sim;
const buys: { t: number; floor: number; kind: string; secs: number; later: boolean }[] = [];
const kindOf = (id: string) =>
  isTraitId(id) ? 'trait' : id.startsWith('rel') ? 'tonic' : id.startsWith('clk') ? 'click' : id.startsWith('cd') ? 'clickDps' : id.startsWith('auto') ? 'blade' : id.startsWith('syn') ? 'synergy' : id.startsWith('tro') ? 'trophy' : id.startsWith('raid') ? 'goblin' : id.startsWith('fev') ? 'rampage' : id.startsWith('clv') ? 'cleave' : 'other';
const rate = () => (earned.length > 1 ? Math.max(1e-9, (earned[earned.length - 1] - earned[0]) / (earned.length - 1)) : 1e-9);
const buyUpg = Game.prototype.buyUpg;
Game.prototype.buyUpg = function (id: string) {
  const cost = this.upgCost(UPG_BY_ID.get(id)!);
  const ok = buyUpg.call(this, id);
  if (ok && sim && earned.length > 30) buys.push({ t: sim.t, floor: this.s.maxFloor, kind: kindOf(id), secs: cost / rate(), later: this.s.descents > 0 });
  return ok;
};

/** log10 of each damage source, at a moment. */
function sources(game: Game) {
  game.invalidate();
  const c = (game as unknown as { c: { parts: { tier: number[]; syn: number[]; party: number; upgrades: number; trophies: number; souls: number } } }).c;
  const p = c.parts;
  const raw = COMPS.reduce((sum, comp, i) => sum + comp.dps * game.s.owned[i], 0);
  const lv = COMPS.reduce((sum, comp, i) => sum + comp.dps * game.s.owned[i] * levelMult(game.s.owned[i]), 0);
  const traits = COMPS.reduce((sum, comp, i) => sum + comp.dps * game.s.owned[i] * levelMult(game.s.owned[i]) * p.tier[i], 0);
  const l = Math.log10;
  return { levels: l(raw), bonus: l(lv / raw), traits: l(traits / lv), party: l(p.party), shop: l(p.upgrades), trophies: l(p.trophies), souls: l(p.souls) };
}

const rows: string[] = [];
let mark = 0;
const MARKS = [20, 40, 60, 80, 100, 150, 200, 300, 400, 500, 700];
sim = new Sim(PLAYER, {
  tick({ game, t }) {
    if (Math.floor(t) !== Math.floor(t - 0.1)) {
      earned.push(game.s.totalGold.toNumber());
      if (earned.length > 61) earned.shift();
    }
    if (mark < MARKS.length && game.s.bestFloor >= MARKS[mark]) {
      const src = sources(game);
      const kill = floorHp(game.s.bestFloor).div(game.dps()).toNumber();
      const f = (x: number) => x.toFixed(1).padStart(5);
      rows.push(`${String(MARKS[mark]).padStart(4)}  ${(t / H).toFixed(1).padStart(5)}h  ${f(src.levels)} ${f(src.bonus)} ${f(src.traits)} ${f(src.party)} ${f(src.shop)} ${f(src.trophies)} ${f(src.souls)}   ${kill < 0.01 ? '<0.01' : kill.toFixed(2)}s`);
      mark++;
    }
  },
});
sim.startSession(hours * H);
sim.runUntil(hours * H);

console.log(`Damage sources at each new deepest floor (log10, i.e. 1.0 = ×10), always-active player, ${hours} h`);
console.log(' floor   time levels bonus traits party  shop troph souls   seconds to kill a normal monster there');
for (const r of rows) console.log(r);
for (const later of [false, true]) {
  console.log(`\nShop upgrades, ${later ? 'every run after the first ascent' : 'first run'}: price in seconds of income when bought (median, count)`);
  const mine = buys.filter((b) => b.later === later);
  const bands = later ? [[1, 9999]] : [[1, 30], [31, 60], [61, 100], [101, 9999]];
  console.log(`${'kind'.padEnd(10)}${bands.map(([a, b]) => `${a}-${b === 9999 ? '' : b}`.padStart(12)).join('')}`);
  for (const k of [...new Set(mine.map((b) => b.kind))]) {
    const cells = bands.map(([a, b]) => {
      const s = mine.filter((x) => x.kind === k && x.floor >= a && x.floor <= b).map((x) => x.secs).sort((p, q) => p - q);
      if (!s.length) return '-'.padStart(12);
      const m = s[Math.floor(s.length / 2)];
      return `${m < 1 ? '<1s' : m < 120 ? `${m.toFixed(0)}s` : `${(m / 60).toFixed(0)}m`} (${s.length})`.padStart(12);
    });
    console.log(`${k.padEnd(10)}${cells.join('')}`);
  }
}
void Decimal;
