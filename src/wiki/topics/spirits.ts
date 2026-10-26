import { BOUND, boundName, LEGENDS, OFFER_SIZE, RESPEC_REFUND, SUMMON_COST, legendCost, legendShare, rerollCost, type LegendDef } from '../../game/data.ts';
import { TUNE } from '../../game/game.ts';
import { h2, infobox, link, pct, range, splitTables, table, toc } from '../kit.ts';
import { spr } from '../sprites.ts';
import type { Page } from '../pages.ts';

const KIND = { power: 'Power', utility: 'Utility', sink: 'Sink' } as const;

/** The Bound that make a Spirit work harder. */
const BOOSTED_BY: Record<string, string> = { wither: 'troll', soulcaller: 'golem', lure: 'thing', hourglass: 'ent', thinning: 'frost' };

/** Where each Spirit's bonus applies, and the rule behind its number. */
const HOW: Record<string, string> = {
  sleeper: 'Multiplies your party\'s damage by 1 + 0.25 × level while you are idle (no attack by hand for 60 seconds). Time away counts as idle.',
  fist: 'Multiplies your click damage, and with it the Phantom Blade\'s, by 1 + 0.1 × level.',
  needle: 'Adds 0.15 × level to the critical hit multiplier.',
  hoard: 'Multiplies all gold by 1 + 0.05 × level.',
  patient: 'Multiplies gold by 1 + 0.5 × level while you are idle. Time away counts as idle.',
  goblinking: 'Multiplies the gold from treasure goblins and from the Rainbow Vault\'s chests by 1 + 0.5 × level.',
  unbroken: 'Every attack in your current streak adds 0.01% × level to all damage. A streak ends 2 seconds after your last attack and counts up to 2,000 attacks.',
  hourglass: 'Adds seconds to every boss timer, closing in on +30s.',
  wither: 'Takes a share off every boss\'s health, closing in on −50%.',
  thinning: 'Each level takes one kill off the kills a floor needs, down from 20 to 10 at level 10, its last level.',
  haggler: 'Each level makes companion levels 5% cheaper, compounding: the price is multiplied by 0.95 per level.',
  restless: 'Shortens ability cooldowns, closing in on −75%.',
  lingering: 'Each level makes Rampage last 1 second longer.',
  whirl: 'Each level makes Flurry last 2 seconds longer.',
  headsman: 'Each level makes Cleave last 4 seconds longer.',
  magpie: 'Each level makes Treasure Sense last 2 seconds longer.',
  drummer: 'Each level makes War Drums last 2 seconds longer.',
  host: 'Each level makes Phantom Legion last 2 seconds longer.',
  soulcaller: 'Raises the chance a boss is a champion boss, from a base of 25% up toward 100%. Champion bosses start on floor 100.',
  lure: 'Treasure goblins come more often, closing in on +200% (three times as often).',
  collector: 'Raises the chance a kill drops a card, closing in on +200% (three times the chance).',
  ronin: 'A kill that deals N times a monster\'s health has N times the chance to drop its card (gold cards too), up to the cap. Swept floors and time away count.',
  hungry: 'Each soul fed to it adds +11% to all damage, where a kept soul adds +10%. Fed souls only come back with a respec.',
};

const CAP: Record<string, string> = {
  hourglass: '+30s', wither: '−50%', restless: '−75%', soulcaller: '100%', lure: '+200%', collector: '+200%', thinning: '−10 kills',
};

/** A Spirit's level prices in words, with the first few as examples. */
const costRule = (d: LegendDef) => {
  if (d.kind === 'sink') return '1 soul every level';
  const first = [1, 2, 3, 4].map((lv) => legendCost(d, lv)).join(', ');
  const rule = d.kind === 'utility' ? 'double the level before' : d.id === 'unbroken' ? 'a little more each level' : 'one more soul each level';
  return `${rule} (${first}, …)`;
};

/** Souls to take a Spirit from level 1 to `lv` (summoning it is level 1). */
const totalTo = (d: LegendDef, lv: number) => range(1, lv - 1).reduce((sum, l) => sum + legendCost(d, l), 0);

function levelRows(d: LegendDef, levels: number[]) {
  return levels.map((lv) => [`<b>${lv}</b>`, lv === 1 ? 'Summon' : legendCost(d, lv - 1).toLocaleString('en-US'), totalTo(d, lv).toLocaleString('en-US'), d.value(lv)]);
}

function levelTables(d: LegendDef) {
  const cols = [{ h: 'Lvl', cls: 'c' as const }, { h: 'Cost', cls: 'num' as const }, { h: 'Total', cls: 'num' as const }, 'Effect'];
  if (d.maxLv) return splitTables(cols, [levelRows(d, range(1, d.maxLv))]);
  if (d.kind === 'utility') return splitTables(cols, [levelRows(d, range(1, 10)), levelRows(d, range(11, 20))]);
  return splitTables(cols, [levelRows(d, range(1, 10)), levelRows(d, range(15, 60, 5)), levelRows(d, range(70, 160, 10))]);
}

function spiritPage(d: LegendDef): Page {
  return {
    id: `spirit-${d.id}`, parent: 'spirits', group: 'Souls', title: d.name, summary: d.what,
    body: () => `${infobox(spr(d.sprite, 96), [
      ['Type', `<span class="tag ${d.kind}">${KIND[d.kind]}</span>`],
      ['Boosts', d.what],
      ['Level 1', d.value(1)],
      ['Level cost', costRule(d)],
      ...(CAP[d.id] ? [['Cap', CAP[d.id]] as [string, string]] : []),
      ...(d.maxLv ? [['Max level', String(d.maxLv)] as [string, string]] : []),
    ])}
      <p class="lede">${HOW[d.id] ?? d.what}</p>
      ${d.note ? `<p class="note">${d.note}</p>` : ''}
      ${BOOSTED_BY[d.id] ? `<p>${link('awakening', boundName(BOUND.find((b) => b.id === BOOSTED_BY[d.id])!), 'The Bound')} makes it ${d.id === 'thinning' ? 'go further: one more level each, up to 15 kills off' : 'work 25% harder each level'}.</p>` : ''}
      ${h2(`Leveling ${d.name}`)}
      <p>Summoning ${d.name} costs your current ${link('spirits', 'summon cost', 'Summoning')}. After that, each level costs ${costRule(d)}.
      ${d.kind === 'utility' && CAP[d.id] && d.id !== 'thinning' ? `Its effect closes in on its cap: each level closes a tenth of the gap that's left (${pct(legendShare(1), 0)} of the cap at level 1, ${pct(legendShare(10), 0)} at level 10, ${pct(legendShare(20), 0)} at level 20).` : ''}</p>
      <p><b>Cost</b> is the souls for that level; <b>Total</b> is every soul spent past the summon to get there.</p>
      ${levelTables(d)}
      <div class="clear"></div>`,
  };
}

const listBody = () => {
  const row = (d: LegendDef) => [
    `<a class="who" href="#/spirit-${d.id}">${spr(d.sprite, 28)}${d.name}</a>`,
    `<span class="tag ${d.kind}">${KIND[d.kind]}</span>`, d.what, d.value(1), costRule(d), CAP[d.id] ?? '—',
  ];
  const summonRows = SUMMON_COST.map((cost, owned) => [`<b>${owned + 1}</b>`, cost.toLocaleString('en-US'), rerollCost(owned).toLocaleString('en-US')]);
  const totalSummon = SUMMON_COST.slice(0, LEGENDS.length).reduce((a, b) => a + b, 0);
  return `<p class="lede">Spirits are what you spend souls on. Each one boosts one part of the game, and you level them up with more souls. They stay with you through every ascent; awakening sends them all away.</p>
    ${toc('spirits', ['Summoning', 'Leveling', 'All Spirits', 'Respec', 'Kept souls'])}
    ${h2('Summoning')}
    <p>Spirits open after your first ascent. The summoning circle offers ${OFFER_SIZE} Spirits at a time; pick one and pay the summon cost to bring it in at level 1. Every summon rolls a new offer. You can also reroll the offer for a third of the summon cost, rounded up.</p>
    <p>The summon cost depends only on how many Spirits you have. Summoning all ${LEGENDS.length} costs ${totalSummon.toLocaleString('en-US')} souls.</p>
    ${splitTables([{ h: 'Spirit #', cls: 'c' }, { h: 'Summon', cls: 'num' }, { h: 'Reroll', cls: 'num' }], [summonRows.slice(0, 9), summonRows.slice(9)])}
    ${h2('Leveling')}
    <p>Spirits come in three kinds, and each kind levels at its own price:</p>
    ${table(['Kind', 'Level cost', 'How the effect grows'], [
      ['<span class="tag power">Power</span>', 'One more soul each level (the Unbroken: a little more)', 'The same amount every level, with no cap.'],
      ['<span class="tag utility">Utility</span>', 'Double the level before', 'Most close in on a cap: each level closes a tenth of the gap that\'s left. The six that lengthen an ability add the same seconds every level instead.'],
      ['<span class="tag sink">Sink</span>', '1 soul every level', 'The same amount every level, with no cap.'],
    ])}
    ${h2('All Spirits')}
    ${table(['Spirit', 'Type', 'Boosts', 'Level 1', 'Level cost', 'Cap'], LEGENDS.map(row))}
    ${h2('Respec')}
    <p>Respec sends every Spirit away and gives back ${pct(RESPEC_REFUND, 0)} of the souls you spent summoning and leveling them (rerolls don't count). Their levels are lost, and the summon cost starts over from 1.</p>
    ${h2('Kept souls')}
    <p>Every soul you haven't spent adds +${pct(TUNE.soulPower, 0)} to all damage. Souls spent on Spirits don't.</p>`;
};

export const SPIRIT_PAGES: Page[] = [
  { id: 'spirits', group: 'Souls', title: 'Spirits', summary: 'What you spend souls on: summoning, leveling and every Spirit.', body: listBody },
  ...LEGENDS.map(spiritPage),
];
