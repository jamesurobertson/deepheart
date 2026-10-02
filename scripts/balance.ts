/**
 * Headless pacing check: a greedy player clicks and buys whatever adds the most damage per gold.
 *   node scripts/balance.ts [hours=3] [clicksPerSec=5] [activeMinutes=30] [descendRatio=0]
 */
import { TUNE } from '../src/game/game.ts';
import { COMPS, UPGRADES } from '../src/game/data.ts';
import { fmt, duration } from '../src/game/format.ts';
import { Sim, seedRandom } from './bot.ts';

const hours = Number(process.argv[2] ?? 3);
const cps = Number(process.argv[3] ?? 5);
const activeMin = Number(process.argv[4] ?? 30);
const descendRatio = Number(process.argv[5] ?? 0);

if (process.env.TUNE) Object.assign(TUNE, JSON.parse(process.env.TUNE));
seedRandom(Number(process.env.SEED ?? 1));

const marks = new Set<string>();
let failsLogged = 0;
let lastHour = -1;
const hired = COMPS.map(() => false);

const sim = new Sim(
  { cps, activeMin, descendRatio, awakenRatio: Number(process.env.AWAKEN ?? 1), stall: Number(process.env.STALL ?? 120), catchRate: 0.05 },
  {
    event(ev, { game, t }) {
      if (ev.t === 'relic' && process.env.RELICS) console.log(`${duration(t).padStart(8)}  relic ${ev.id} lv${ev.lv} (floor ${ev.floor})`);
      if (ev.t === 'retreat' && process.env.FAILS) console.log(`${duration(t).padStart(8)}  retreat floor ${ev.floor}`);
      if (ev.t === 'bossFail' && failsLogged++ < 400 && process.env.FAILS) console.log(`${duration(t).padStart(8)}  boss fail floor ${ev.floor} [${game.bossMods(ev.floor).join(',')}]`);
    },
    descend(souls, { game, t, descents }) {
      console.log(`${duration(t).padStart(8)}  DESCEND #${descents} at floor ${game.s.maxFloor}: +${souls} souls`);
    },
    awaken(stones, { game, t, awakens }) {
      console.log(`${duration(t).padStart(8)}  AWAKEN #${awakens} at floor ${game.s.maxFloor} (best ${game.s.bestFloor}): +${stones} stones`);
    },
    tick({ game, t }) {
      const mark = (k: string) => {
        if (marks.has(k)) return;
        marks.add(k);
        console.log(`${duration(t).padStart(8)}  ${k}  (floor ${game.s.floor}, dps ${fmt(game.dps())}, click ${fmt(game.clickDamage())})`);
      };
      COMPS.forEach((c, i) => {
        if (!hired[i] && game.s.owned[i] > 0) {
          hired[i] = true;
          mark(`hire ${c.name}`);
        }
      });
      for (const f of [10, 20, 30, 40, 50, 60, 75, 100, 125, 150]) if (game.s.maxFloor >= f) mark(`floor ${f}`);
      const h = Math.floor(t / 1800) / 2;
      if (h !== lastHour) {
        lastHour = h;
        console.log(`--- ${h}h: floor ${game.s.floor}/${game.s.maxFloor}, dps ${fmt(game.dps())}, click ${fmt(game.clickDamage())}, gold ${fmt(game.s.gold)}, kills ${game.s.kills}, souls ${game.s.souls}, upg ${game.s.upgrades.length}/${UPGRADES.length}, trophies ${game.s.trophies.length}, relics ${game.relicsFound()} [${game.s.equipped.map((id) => id + game.relicLv(id)).join(' ')}], stones ${game.s.stones}, heart ${JSON.stringify(game.s.heart)}, lv ${game.s.owned.join(',')}`);
      }
    },
  },
);
sim.run(hours);
