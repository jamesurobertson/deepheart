import { DESCEND_FLOOR, FLOOR_KILLS } from '../../game/game.ts';
import { fmt } from '../../game/format.ts';
import { h2, link, table, toc } from '../kit.ts';
import type { Page } from '../pages.ts';

const basicsBody = () => `<p class="lede">Deepheart is an idle dungeon crawler. Your companions fight on their own; you hire more, level them up, and push deeper.</p>
  ${toc('basics', ['The loop', 'Your first run', 'After floor 100', 'Where to look next'])}
  ${h2('The loop')}
  <ol>
    <li>Monsters drop gold when they die.</li>
    <li>Spend gold on companions and their traits.</li>
    <li>Your party kills faster, so you clear floors faster and go deeper.</li>
    <li>At floor ${DESCEND_FLOOR}, ascend for souls, which make every run after stronger.</li>
  </ol>
  ${h2('Your first run')}
  <p>Each floor needs ${FLOOR_KILLS} kills. Every fifth floor is a boss with a 30-second timer; if it beats you, you drop back a floor to farm. Click or hold to attack, and catch treasure goblins when they run by.</p>
  <p>Companions open traits at levels 10, 25, 50, 75 and up. Some traits unlock abilities like the Phantom Blade, Flurry and Rampage.</p>
  ${h2('After floor 100')}
  <p>Floor ${DESCEND_FLOOR} opens the way up. Ascending starts a new run with souls: each soul you keep is +10% damage, or spend them on ${link('spirits', 'Spirits')}. Deeper bosses can be champions that drop more souls, and zone bosses past floor 100 hand out ${link('heartmarks', 'Heartmarks')}.</p>
  ${h2('Where to look next')}
  <p>${link('companions', 'Companions')} · ${link('floors', 'Floors and zones')} · ${link('bosses', 'Bosses')} · ${link('souls', 'Souls and ascending')} · ${link('spirits', 'Spirits')} · ${link('calculator', 'Calculator')}</p>`;

const awayBody = () => `<p class="lede">Close the game and your party keeps farming. Come back to gold and kills.</p>
  ${h2('What happens while you\'re away')}
  <ul>
    <li>Your party farms the floor you left on (the floor before it, if you left on a boss), at its full damage per second.</li>
    <li>Gold comes in at the floor's rate, with your gold bonuses. ${link('spirit-sleeper', 'The Sleeper')} and ${link('spirit-patient', 'the Patient')} always count, because time away is idle.</li>
    <li>Kills count toward the floor you're on. If you reach its quota the next floor opens, but you stay where you are.</li>
    <li>Cards drop as they would from those kills (plain cards only).</li>
    <li>Ability cooldowns and buffs count down.</li>
  </ul>
  ${h2('What doesn\'t')}
  <p>No bosses, treasure goblins, champions, Rampage, abilities, Heartmarks or souls. Buffs run out without working.</p>
  ${h2('How long counts')}
  <p>There's no limit and nothing is cut: a week away pays a week. A hidden browser tab counts as away too.</p>`;

const settingsBody = () => `<p class="lede">Everything in Options.</p>
  ${table(['Setting', 'What it does'], [
    ['Sound, music, volume', 'Sound effects and music, each with its own volume'],
    ['Particles', 'Hit sparks and other particles'],
    ['Reduce flashing', 'Companion attacks without bright flashes, light bursts or screen shake'],
    ['Screen shake', 'Shake on big hits'],
    ['Damage numbers', 'Numbers over monsters (crits still show when off)'],
    ['Blood', 'Blood on hits'],
    ['Zone intros', 'The title card when you enter a new zone'],
    ['Numbers', 'Short (1.23M) or scientific (1.23e6)'],
    ['Cursor', `A cursor skin, unlocked by ${link('trophies', 'trophies', 'Cursors')}`],
    ['Export / import', 'Copy your save as text, or load one'],
  ])}`;

const SUFFIX = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
const WORD = ['thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion', 'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion', 'vigintillion'];

const numbersBody = () => `<p class="lede">Big numbers are shortened with a suffix. Past the last one, they switch to scientific notation (1.23e99).</p>
  ${table(['Suffix', 'Name', 'Value', 'Example'], SUFFIX.map((s, k) => [`<b>${s}</b>`, WORD[k], `10<sup>${(k + 1) * 3}</sup>`, fmt(1.23 * 10 ** ((k + 1) * 3))]))}`;

export const OTHER_PAGES: Page[] = [
  { id: 'basics', group: 'Start here', title: 'How to play', summary: 'The loop, your first run and what opens after floor 100.', body: basicsBody },
  { id: 'away', group: 'Other', title: 'Time away', summary: 'What your party does while the game is closed.', body: awayBody },
  { id: 'settings', group: 'Other', title: 'Settings', summary: 'Every option.', body: settingsBody },
  { id: 'numbers', group: 'Other', title: 'Number suffixes', summary: 'K, M, B, T, Qa, Qi and the rest.', body: numbersBody },
];
