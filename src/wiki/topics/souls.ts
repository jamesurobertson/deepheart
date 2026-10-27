import { BOUND, ZONES, boundCost, boundName } from '../../game/data.ts';
import { DESCEND_FLOOR, MARK_FROM, MARK_MOVE, MARK_POWER, MARK_REROLL, TUNE, bossSouls } from '../../game/game.ts';
import { h2, link, pct, table, toc } from '../kit.ts';
import { spr } from '../sprites.ts';
import type { Page } from '../pages.ts';

const soulsBody = () => `<p class="lede">Reach floor ${DESCEND_FLOOR} and you can ascend: leave the dungeon, start a new run from floor 1, and take souls with you.</p>
  ${toc('souls', ['Ascending', 'Earning souls', 'What souls do', 'What an ascent keeps'])}
  ${h2('Ascending')}
  <p>The way up opens once you reach floor ${DESCEND_FLOOR}. Ascending ends the run: you're back on floor 1 with no gold and no companions, and the souls you earned this run are paid out. You need at least one soul to ascend.</p>
  ${h2('Earning souls')}
  ${table(['Source', 'Souls'], [
    ['Companion levels', `1 for every ${TUNE.levelsPerSoul.toLocaleString('en-US')} companion levels you bought this run, all companions added together`],
    ['Champion bosses (floor 100 on)', `The first time you beat each one in a run: ${bossSouls(100)} on floor 100, ${bossSouls(150)} on 150, ${bossSouls(200)} on 200, ${bossSouls(300)} on 300. See ${link('bosses', 'Bosses', 'Souls from champion bosses')}.`],
  ])}
  <p>Souls from both sources are counted up as you play and paid when you ascend. Every run pays them again.</p>
  ${h2('What souls do')}
  <p>Every soul you haven't spent adds +${pct(TUNE.soulPower, 0)} to all damage: 10 souls is +100%, 50 souls is +500%. Spend them on ${link('spirits', 'Spirits')} or ${link('heartmarks', 'Heartmarks')}; spent souls stop adding damage.</p>
  ${h2('What an ascent keeps')}
  ${table(['Reset', 'Kept'], [[
    'Gold<br>Companion levels and traits<br>Abilities and their cooldowns<br>Buffs and the Rampage meter<br>Your floor (back to 1)',
    'Souls<br>Spirits<br>Heartmarks<br>Trophies<br>Cards<br>Your deepest floor ever (late companions stay unlocked)<br>Auto-buy\'s list of traits<br>Settings and your hero',
  ]])}`;

const boundTotal = (b: (typeof BOUND)[number], lv: number) => Array.from({ length: lv }, (_, l) => boundCost(b, l)).reduce((a, c) => a + c, 0);

const awakenBody = () => `<p class="lede">Reach floor ${TUNE.awakenFloor} and you can awaken the Heart: give up your souls, Spirits, Heartmarks and the run for bound souls, which buy the Bound.</p>
  ${toc('awakening', ['Awakening', 'Bound souls', 'What awakening keeps', 'The Bound', 'Champion souls'])}
  ${h2('Awakening')}
  <p>The Heart stands in the Keep's top-left room. Each awakening needs floor ${TUNE.awakenFloor} reached since the last one, and has to pay at least one bound soul. Awakening ascends too: the souls your run would pay count toward it, then the run starts over on floor 1.</p>
  ${h2('Bound souls')}
  <p>Count every soul you've earned since you last awakened, spent or not, plus what an ascent would pay now. Bound souls in all are 5 for every power of ten of that count, rounded down. An awakening pays what's above the most you've had before.</p>
  ${table(['Souls this cycle', { h: 'Bound souls in all', cls: 'num' }], [10, 100, 400, 1000, 1e4, 1e5, 1e6].map((n) => [n.toLocaleString('en-US'), Math.floor(5 * Math.log10(n))]))}
  <p>Bound souls you haven't spent do nothing.</p>
  ${h2('What awakening keeps')}
  ${table(['Reset', 'Kept'], [[
    'Everything an ascent resets<br>Souls<br>Spirits<br>Heartmarks<br>Expeditions (everyone comes home with what they found)',
    'Bound souls and the Bound<br>Cards and trophies<br>Your deepest floor ever (companions stay unlocked)<br>Settings and your hero',
  ]])}
  <p>When you awaken you can also respec the Bound: every bound soul spent on them comes back.</p>
  ${h2('The Bound')}
  <p>The eight zone bosses, bound in the Heart's room once you've awakened. Each level of the Ogre Chieftain costs 1 bound soul; every other Bound's next level costs one more than its last (1, 2, 3…).</p>
  ${table(['Bound', 'Boosts', 'Per level', { h: 'Max level', cls: 'num' }, { h: 'Total for level 5', cls: 'num' }], BOUND.map((b) => [
    `<span class="who">${spr(ZONES[b.zone].boss.sprite, 28)}${boundName(b)}</span>`, b.what, b.value(1), b.max ?? '—', b.max !== undefined && b.max < 5 ? '—' : boundTotal(b, 5),
  ]))}
  <p>The Pit Lord multiplies champion souls by 1 + level²: ×2 at level 1, ×5 at 2, ×10 at 3, ×17 at 4. The Troll Brute can't take a boss below 10% of its health, and the Tomb Golem can't take the champion chance past 100%. The Lich's discount works on summoning and leveling Spirits.</p>
  ${h2('Champion souls')}
  <p>Every bound soul you've ever earned makes champion bosses past floor ${TUNE.goldBossFrom} pay a little more, and more the deeper they are: the gain compounds every 10 floors. It grows toward a limit of ${pct(TUNE.pullCap, 0)} per 10 floors.</p>`;

const marksBody = () => `<p class="lede">Heartmarks are bonus damage that lands on a random companion when you beat a deep zone boss for the first time.</p>
  ${h2('Earning Heartmarks')}
  <p>The first time you beat the boss on each 10th floor past ${MARK_FROM} (110, 120, 130 and so on), a random companion gets a Heartmark. It can land on any companion you've unlocked, hired this run or not. Heartmarks stay through every ascent. ${link('awakening', 'Awakening')} takes them all, and they're earned again from floor ${MARK_FROM + 10}.</p>
  ${h2('What they do')}
  <p>Each Heartmark adds +${pct(MARK_POWER, 0)} to that companion's damage. Two is +100%, three is +150%.</p>
  ${h2('Moving them')}
  ${table(['Action', { h: 'Cost', cls: 'num' }, 'What happens'], [
    ['Send one away', `${MARK_REROLL} soul`, 'One of this companion\'s Heartmarks moves to a random other companion'],
    ['Bring one here', `${MARK_MOVE} souls`, 'A Heartmark moves to this companion from a random companion that has one'],
  ])}
  <p>Souls spent moving Heartmarks don't come back with a Spirit respec.</p>`;

export const SOUL_PAGES: Page[] = [
  { id: 'souls', group: 'Souls', title: 'Souls and ascending', summary: 'The way up, how souls are earned, what they do and what an ascent keeps.', body: soulsBody },
  { id: 'heartmarks', group: 'Souls', title: 'Heartmarks', summary: 'Earning, using and moving Heartmarks.', body: marksBody },
  { id: 'awakening', group: 'Souls', title: 'Awakening and the Bound', summary: 'Bound souls, what awakening keeps, the Bound and wake-up gifts.', body: awakenBody },
];
