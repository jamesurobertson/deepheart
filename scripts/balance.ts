/**
 * Headless pacing check: a greedy player clicks and buys whatever adds the most damage per gold.
 *   node scripts/balance.ts [hours=3] [clicksPerSec=5] [activeMinutes=30] [descendRatio=0]
 */
import { Game, newSave } from '../src/game/game.ts';
import { COMPS, UPGRADES } from '../src/game/data.ts';
import { fmt, duration } from '../src/game/format.ts';

const hours = Number(process.argv[2] ?? 3);
const cps = Number(process.argv[3] ?? 5);
const activeMin = Number(process.argv[4] ?? 30);
const descendRatio = Number(process.argv[5] ?? 0);

const game = new Game(newSave());
const DT = 0.1;
let t = 0;
let clickAcc = 0;
let activeUntil = activeMin * 60;
const marks = new Set<string>();
const mark = (k: string) => { if (!marks.has(k)) { marks.add(k); console.log(`${duration(t).padStart(8)}  ${k}  (floor ${game.s.floor}, dps ${fmt(game.dps())}, click ${fmt(game.clickDamage())})`); } };

function power() {
  return game.baseDps() + game.clickDamage() * (t < activeUntil ? cps : 0);
}

function shop() {
  for (let k = 0; k < 30; k++) {
    let best: { buy: () => boolean; cost: number; score: number } | null = null;
    const p = power();
    for (let i = 0; i < COMPS.length; i++) {
      if (!game.compUnlocked(i) || i > game.s.revealed) continue;
      const cost = game.compCost(i);
      const gain = game.compNext(i);
      if (gain <= 0) continue;
      const score = cost / gain;
      if (!best || score < best.score) best = { buy: () => { const m = game.s.settings.buyMode; game.s.settings.buyMode = 1; const ok = game.buyComp(i); game.s.settings.buyMode = m; if (ok) mark(`hire ${COMPS[i].name}`); return ok; }, cost, score };
    }
    for (const u of game.shopUpgrades()) {
      const cost = game.upgCost(u);
      const e = u.effect;
      let gain = p * 0.05;
      if (e.t === 'comp') gain = game.compDps(e.comp);
      else if (e.t === 'click') gain = t < activeUntil ? game.clickDamage() * cps : 0.001;
      else if (e.t === 'global') gain = p * e.pct;
      const score = cost / Math.max(gain, 1e-9);
      if (!best || score < best.score) best = { buy: () => game.buyUpg(u.id), cost, score };
    }
    if (!best || best.cost > game.s.gold) return;
    best.buy();
  }
}

let descents = 0;
let lastHour = -1;
while (t < hours * 3600) {
  if (t < activeUntil) {
    clickAcc += DT * cps;
    while (clickAcc >= 1) { clickAcc--; game.click(null, 0, 0); }
  }
  game.update(DT);
  if (game.raid && Math.random() < 0.05) game.catchRaid();
  shop();
  for (const f of [10, 20, 30, 40, 50, 60, 75, 100, 125, 150]) if (game.s.maxFloor >= f) mark(`floor ${f}`);
  if (descendRatio && game.pendingSouls() >= Math.max(10, game.s.souls * descendRatio)) {
    console.log(`${duration(t).padStart(8)}  DESCEND #${++descents} at floor ${game.s.maxFloor}: +${game.pendingSouls()} souls`);
    game.descend();
    activeUntil = t + 300;
    for (;;) { const a = game.abyssList().filter((x) => game.abyssAvailable(x.id)).sort((x, y) => x.cost - y.cost)[0]; if (!a || !game.buyAbyss(a.id)) break; }
  }
  const h = Math.floor(t / 1800) / 2;
  if (h !== lastHour) { lastHour = h; console.log(`--- ${h}h: floor ${game.s.floor}/${game.s.maxFloor}, dps ${fmt(game.dps())}, click ${fmt(game.clickDamage())}, gold ${fmt(game.s.gold)}, kills ${game.s.kills}, souls ${game.s.souls}, upg ${game.s.upgrades.length}/${UPGRADES.length}, trophies ${game.s.trophies.length}, lv ${game.s.owned.join(',')}`); }
  game.events.length = 0;
  t += DT;
}
