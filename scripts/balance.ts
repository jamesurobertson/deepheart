// Headless pacing check: `node scripts/balance.ts [hours] [reportEverySeconds] [hero]`
// Auto-play with auto-challenge on; checks the bag and buys upgrades every minute.
import { Game, newSave, UPGRADES, stageLabel, type UpgradeId } from '../src/game/sim.ts';
import { SLOTS, RARITY_NAMES, potentialStars } from '../src/game/items.ts';
import type { HeroId } from '../src/game/heroes.ts';

const hours = Number(process.argv[2] ?? 2);
const reportEvery = Number(process.argv[3] ?? 600);
const game = new Game(newSave((process.argv[4] as HeroId) ?? 'knight'));
const dt = 1 / 30;
let wins = 0, fails = 0, downs = 0, bagged = 0, auto = 0, junk = 0;

for (let t = 0, nextCheck = 60, nextReport = reportEvery; t < hours * 3600; t += dt) {
  game.update(dt);
  for (const e of game.events) {
    if (e.t === 'challenge' && e.phase === 'win') wins++;
    if (e.t === 'challenge' && e.phase === 'fail') fails++;
    if (e.t === 'down') downs++;
    if (e.t === 'drop') e.outcome === 'bag' ? bagged++ : e.outcome === 'salvaged' ? junk++ : auto++;
  }
  game.events.length = 0;
  if (t >= nextCheck) {
    nextCheck += 60;
    for (const item of [...game.s.bag]) {
      const v = game.verdictFor(item);
      if (v.kind === 'upgrade' || (v.kind === 'potential' && potentialStars(item) > potentialStars(game.s.equipped[item.slot]))) game.equip(item.id);
    }
    game.salvageFiltered();
    const ids = (Object.keys(UPGRADES) as UpgradeId[]).sort((a, b) => UPGRADES[a].cost(game.s.upgrades[a]) - UPGRADES[b].cost(game.s.upgrades[b]));
    for (const id of ids) game.buyUpgrade(id);
  }
  if (t >= nextReport) {
    nextReport += reportEvery;
    const m = t / 60;
    const gear = SLOTS.map((s) => `${s[0]}:${RARITY_NAMES[game.s.equipped[s].rarity][0]}${game.s.equipped[s].level}`).join(' ');
    console.log(`${m.toFixed(0).padStart(4)}m stage ${stageLabel(game.s.maxStage).padStart(5)} hero L${String(game.s.heroLevel).padStart(2)} ` +
      `kpm ${(game.s.killRate * 60).toFixed(0).padStart(3)} ch ${wins}/${wins + fails} down ${downs} | items/min bag ${(bagged / m).toFixed(2)} auto ${(auto / m).toFixed(2)} junk ${(junk / m).toFixed(2)} | ${gear}`);
  }
}
