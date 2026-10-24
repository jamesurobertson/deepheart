import { DESCEND_FLOOR, MARK_FROM, MARK_MOVE, MARK_POWER, MARK_REROLL, TUNE, bossSouls } from '../../game/game.ts';
import { h2, link, pct, table, toc } from '../kit.ts';
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

const marksBody = () => `<p class="lede">Heartmarks are bonus damage that lands on a random companion when you beat a deep zone boss for the first time.</p>
  ${h2('Earning Heartmarks')}
  <p>The first time you beat the boss on each 10th floor past ${MARK_FROM} (110, 120, 130 and so on), a random companion gets a Heartmark. It can land on any companion you've unlocked, hired this run or not. Heartmarks stay through every ascent.</p>
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
];
