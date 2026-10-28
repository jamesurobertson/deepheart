import { ABILITIES, ABILITY_BY_UPGRADE, COMPS, LEGENDS, LEVEL_BONUS, UPGRADES, levelMult, type CompDef, type UpgDef } from '../../game/data.ts';
import {
  AUTO_BASE, BASE_CRIT, BASE_CRIT_MULT, CLEAVE_BASE, CLICK_DPS, DRUMS_CRIT, FEVER_CLICKS, FEVER_TIME, FLURRY_RATE, IDLE_AFTER, MANUAL_RATE, MARK_POWER,
  RAMPAGE_EXTEND, RAMPAGE_STEPS, RAMPAGE_TIERS, REBUY_GAP, REVEAL_AT, STREAK_CAP, STREAK_GAP, TUNE,
} from '../../game/game.ts';
import { fmt } from '../../game/format.ts';
import { esc, h2, infobox, link, pct, secs, splitTables, table, toc } from '../kit.ts';
import { spr } from '../sprites.ts';
import type { Page } from '../pages.ts';

const traitsOf = (i: number) => UPGRADES.filter((u) => u.req.t === 'owned' && u.req.comp === i);
const traitLevel = (u: UpgDef) => (u.req.t === 'owned' ? u.req.n : 0);
const traitText = (u: UpgDef) => {
  const ability = ABILITY_BY_UPGRADE.get(u.id);
  return ability ? `Unlocks ${link('abilities', ability.name, ability.name)}.` : esc(u.desc);
};
const compId = (c: CompDef) => `companion-${c.id}`;
const joins = (c: CompDef) => (c.floor ? `Floor ${c.floor}` : 'From the start');

const levelCost = (c: CompDef, lv: number) => c.cost * TUNE.costGrowth ** (lv - 1);
const totalCost = (c: CompDef, lv: number) => (c.cost * (TUNE.costGrowth ** lv - 1)) / (TUNE.costGrowth - 1);
const baseDamage = (c: CompDef, lv: number) => c.dps * lv * levelMult(lv);

const LEVELS = [[1, 10, 25, 50, 75, 100, 125, 150], [175, 200, 225, 250, 300, 400, 500, 1000]];

function companionPage(c: CompDef, i: number): Page {
  const traits = traitsOf(i);
  return {
    id: compId(c), parent: 'companions', group: 'Your party', title: c.name, summary: c.flavor,
    body: () => `${infobox(spr(c.sprite, 96), [
      ['Hire', `${fmt(c.cost)} gold`],
      ['Damage', `${fmt(c.dps)} a level`],
      ['Joins', joins(c)],
      ['Attack', c.attack],
      ['Traits', String(traits.length)],
    ], c.flavor)}
      <p class="lede">${esc(c.flavor)}</p>
      ${c.floor ? `<p>Joins once your deepest floor ever reaches ${c.floor}. After that it stays available on every run.</p>` : ''}
      ${h2('Traits')}
      <p>A trait opens when ${c.name} reaches its level, and is bought with gold on ${c.name}'s row. Traits are bought again every run.</p>
      ${table([{ h: 'Level', cls: 'c' }, 'Trait', { h: 'Cost', cls: 'num' }, 'Effect'], traits.map((u) => [`<b>${traitLevel(u)}</b>`, esc(u.name), fmt(u.cost), traitText(u)]))}
      ${h2('Levels')}
      <p>Each level costs ×${TUNE.costGrowth} the last. Damage is ${fmt(c.dps)} × level, ×${LEVEL_BONUS.mult} every ${LEVEL_BONUS.every} levels from ${LEVEL_BONUS.from} (×${LEVEL_BONUS.thousand} at each 1000th level). The table leaves out traits and every other bonus.</p>
      ${splitTables([{ h: 'Lvl', cls: 'c' }, { h: 'Level cost', cls: 'num' }, { h: 'Total', cls: 'num' }, { h: 'Damage', cls: 'num' }],
        LEVELS.map((levels) => levels.map((lv) => [`<b>${lv}</b>`, fmt(levelCost(c, lv)), fmt(totalCost(c, lv)), fmt(baseDamage(c, lv))])))}
      <div class="clear"></div>`,
  };
}

const companionsBody = () => `<p class="lede">Companions fight for you. Hire them with gold, level them up, and buy their traits. Their damage is most of your damage.</p>
  ${toc('companions', ['The roster', 'Hiring and leveling', 'Level milestones', 'Your hero', 'Heartmarks'])}
  ${h2('The roster')}
  ${table(['Companion', { h: 'Hire', cls: 'num' }, { h: 'Damage / level', cls: 'num' }, 'Joins', { h: 'Traits', cls: 'c' }], COMPS.map((c, i) => [
    `<a class="who" href="#/${compId(c)}">${spr(c.sprite, 28)}${c.name}</a>`, fmt(c.cost), fmt(c.dps), joins(c), traitsOf(i).length,
  ]))}
  ${h2('Hiring and leveling')}
  <p>The first level of a companion costs its hire price. Each level after costs ×${TUNE.costGrowth} the one before. The next companion in the roster shows up once you've had ${pct(REVEAL_AT, 0)} of its hire price this run. The last six wait on a floor: they join once your deepest floor ever has reached it, and stay available after that.</p>
  <p>The buy buttons above the roster set how many levels a click buys:</p>
  ${table(['Button', 'Buys'], [
    ['×1, ×10, ×100', 'That many levels'],
    ['Next', 'Up to the next level that brings something: a trait, or a milestone'],
    ['Max', 'As many as you can afford'],
  ])}
  ${h2('Level milestones')}
  <p>From level ${LEVEL_BONUS.from}, every ${LEVEL_BONUS.every} levels multiplies that companion's damage by ${LEVEL_BONUS.mult}, and every 1000th level by ${LEVEL_BONUS.thousand} instead. These stack: level 250 is ×${levelMult(250)}.</p>
  ${splitTables([{ h: 'Level', cls: 'c' }, { h: 'Damage ×', cls: 'num' }], [[200, 225, 250, 275, 300, 400, 500].map((lv) => [`<b>${lv}</b>`, fmt(levelMult(lv))]), [750, 1000, 1500, 2000, 3000].map((lv) => [`<b>${lv}</b>`, fmt(levelMult(lv))])])}
  ${h2('Your hero')}
  <p>One companion is your hero, marked with a star on its row. Click the star on another to switch. Your hero leaves the formation, follows your pointer, attacks what you point at, and picks up gold it walks over. It deals the same damage as it would in line.</p>
  ${h2('Heartmarks')}
  <p>Each Heartmark on a companion adds +${pct(MARK_POWER, 0)} to its damage. See ${link('heartmarks', 'Heartmarks')}.</p>`;

/** The companions whose traits add to a crit stat, and the total they add. */
function critTraits(stat: 'chance' | 'add') {
  const traits = UPGRADES.filter((u) => u.effect.t === 'crit' && u.effect[stat]);
  const names = COMPS.filter((_, i) => traits.some((u) => u.req.t === 'owned' && u.req.comp === i)).map((c) => c.name).join(', ');
  return { names, total: traits.reduce((sum, u) => sum + (u.effect.t === 'crit' ? u.effect[stat] ?? 0 : 0), 0) };
}
const critChance = critTraits('chance');
const critDamage = critTraits('add');

const attacksBody = () => `<p class="lede">You attack by clicking, tapping, or holding the button down. Your attacks borrow part of your party's damage.</p>
  ${toc('attacks', ['Attack damage', 'Critical hits', 'Streaks', 'Idle'])}
  ${h2('Attack damage')}
  <p>An attack deals ${pct(CLICK_DPS, 0)} of your party's damage per second, plus 1% for each click trait you own (there are ${UPGRADES.filter((u) => u.effect.t === 'clickDps').length}). ${link('spirit-fist', 'The Fist')} multiplies it, and so does Frenzy from a ${link('goblins', 'treasure goblin')}. Rampage and Bloodlust boost the party, not your attacks.</p>
  <p>You can attack up to ${MANUAL_RATE} times a second. Holding the button down attacks at that rate on its own. Flurry and the Phantom Blade aren't limited by it.</p>
  ${h2('Critical hits')}
  <p>Once the Ranger unlocks Critical Hits, your attacks, Flurry and the Phantom Blade can crit: a ${pct(BASE_CRIT, 0)} chance for ×${BASE_CRIT_MULT} damage to start. Companions don't crit.</p>
  ${table(['Source', 'Crit chance', 'Crit damage'], [
    ['Base', pct(BASE_CRIT, 0), `×${BASE_CRIT_MULT}`],
    [`Traits (${critChance.names})`, `+${pct(critChance.total, 0)} in all`, ''],
    [`Traits (${critDamage.names})`, '', `+${critDamage.total}× in all`],
    ['War Drums', `+${pct(DRUMS_CRIT, 0)} for its duration`, ''],
    [link('spirit-needle', 'The Needle'), '', '×(1 + 0.15 a level)'],
  ])}
  ${h2('Streaks')}
  <p>Each attack within ${STREAK_GAP} seconds of the last adds to your streak, up to ${STREAK_CAP.toLocaleString('en-US')}. Stop for ${STREAK_GAP} seconds and it starts over. ${link('spirit-unbroken', 'The Unbroken')} turns your streak into damage.</p>
  ${h2('Idle')}
  <p>You're idle after ${IDLE_AFTER} seconds without attacking by hand. Flurry and the Phantom Blade don't count as attacking. ${link('spirit-sleeper', 'The Sleeper')} and ${link('spirit-patient', 'the Patient')} only work while you're idle, and time away always counts as idle.</p>`;

const abilitiesBody = () => {
  const spiritFor = (id: string) => LEGENDS.find((d) => d.lengthens?.ability === id);
  return `<p class="lede">Abilities come from companion traits. Buying the trait unlocks the ability for the rest of the run. You earn them again after every ascent.</p>
    ${table(['Ability', 'Unlocked by', 'Kind', 'Lasts', 'Cooldown', 'Longer with'], ABILITIES.map((a) => {
      const c = COMPS[a.comp];
      const u = UPGRADES.find((x) => x.id === `m${a.comp}_${a.trait}`)!;
      const spirit = spiritFor(a.id);
      return [`<b id="${a.name.toLowerCase().replace(/[^a-z]+/g, '-')}">${a.name}</b>`, `<span class="who">${spr(c.sprite, 22)}${c.name}, level ${traitLevel(u)}</span>`,
        a.kind === 'passive' ? 'Always on' : a.kind === 'charge' ? 'Charged' : 'Button',
        a.id === 'rampage' ? `${FEVER_TIME}s` : a.dur ? `${a.dur}s` : '—', a.cooldown ? secs(a.cooldown) : '—',
        spirit ? `${link(`spirit-${spirit.id}`, spirit.name)} (+${spirit.lengthens!.secs}s a level)` : '—'];
    }))}
    ${h2('What each one does')}
    ${table(['Ability', 'Effect'], [
      ['Phantom Blade', `Attacks the front monster for you, ${AUTO_BASE} time a second. Each blade trait adds one more (up to 6 a second). Its hits count as attacks for crits and Cleave.`],
      ['Flurry', `Attacks wherever you point, ${FLURRY_RATE} times a second. These count toward Rampage.`],
      ['Critical Hits', `Lets attacks crit. See ${link('attacks', 'Attacks', 'Critical hits')}.`],
      ['Rampage', 'See below.'],
      ['Cleave', `Your attacks also hit every other monster for ${pct(CLEAVE_BASE, 0)} of their damage. Two traits raise it (Shieldmaiden ×1.25, Paladin ×1.5).`],
      ['Treasure Sense', 'Monsters drop ×3 gold.'],
      ['War Drums', `+${pct(DRUMS_CRIT, 0)} crit chance.`],
      ['Phantom Legion', 'Every Phantom Blade attack hits every monster on the floor.'],
    ])}
    <p>${link('spirit-restless', 'The Restless')} shortens every button cooldown. Cooldowns keep counting down while you're away. Ascending resets them.</p>
    ${h2('Rampage')}
    <p>Your attacks charge the Rampage meter: ${FEVER_CLICKS} attacks fill it (about a minute of holding the button). Set it off when it's full and your party deals ×${RAMPAGE_TIERS[0]} damage for ${FEVER_TIME} seconds.</p>
    <p>Keep attacking through it: after ${RAMPAGE_STEPS[0]} more attacks it climbs to ×${RAMPAGE_TIERS[1]} and gains ${RAMPAGE_EXTEND} seconds. The meter doesn't charge while a Rampage runs.</p>
    ${table(['Trait (Dwarf Brawler)', 'Effect'], [['Level 75', 'Rampage fills 25% faster'], ['Level 100', 'Rampage lasts 50% longer'], ['Level 125', '+1 to both multipliers']])}
    <p>${link('spirit-lingering', 'The Lingering')} adds a second a level.</p>`;
};

const traitsBody = () => {
  const kinds: [string, string, number][] = [
    ['×2 to that companion', 'Doubles that companion\'s damage.', UPGRADES.filter((u) => u.effect.t === 'comp').length],
    ['Party', 'Every companion deals +50% damage. These multiply together.', UPGRADES.filter((u) => u.effect.t === 'party').length],
    ['Click', 'Attacks deal +1% of your party\'s damage.', UPGRADES.filter((u) => u.effect.t === 'clickDps').length],
    ['Gold', 'Monsters drop +50% gold (added together).', UPGRADES.filter((u) => u.effect.t === 'gold').length],
    ['Boss', '+25% damage to bosses (added together).', UPGRADES.filter((u) => u.effect.t === 'boss').length],
    ['Phantom Blade', '+1 Phantom Blade attack a second.', UPGRADES.filter((u) => u.effect.t === 'auto').length],
    ['Crit chance', '+2% or +3% crit chance.', UPGRADES.filter((u) => u.effect.t === 'crit' && u.effect.chance).length],
    ['Crit damage', '+1× or +2× crit damage.', UPGRADES.filter((u) => u.effect.t === 'crit' && u.effect.add).length],
    ['Cleave', 'Cleave ×1.25 or ×1.5.', UPGRADES.filter((u) => u.effect.t === 'cleave').length],
    ['Rampage', 'Fills faster, lasts longer or hits harder.', UPGRADES.filter((u) => u.effect.t === 'fever').length],
    ['Ability', 'Unlocks an ability.', UPGRADES.filter((u) => u.effect.t === 'skill').length],
  ];
  return `<p class="lede">Traits are the upgrades. Each companion has four to seven, opening at levels 10, 25, 50, 75, 100, 125 and 150.</p>
    ${h2('Kinds of trait')}
    ${table(['Kind', 'Effect', { h: 'How many', cls: 'c' }], kinds.map(([k, e, n]) => [`<b>${k}</b>`, e, n]))}
    <p>Every companion's traits are listed on its page under ${link('companions', 'Companions')}. A trait costs a multiple of its companion's hire price: ×12, ×30, ×150, ×1,000, ×10,000, ×60,000 and ×300,000 for the seven levels.</p>
    ${h2('Auto-buy')}
    <p>After your first ascent, an Auto toggle appears in the shop. With it on, every ${REBUY_GAP} seconds the game buys any trait you've bought before, cheapest first. Traits you've never bought stay yours to find.</p>`;
};

export const PARTY_PAGES: Page[] = [
  { id: 'companions', group: 'Your party', title: 'Companions', summary: 'Every companion, hiring, levels, milestones and your hero.', body: companionsBody },
  { id: 'attacks', group: 'Your party', title: 'Attacks and crits', summary: 'Attack damage, critical hits, streaks and idle.', body: attacksBody },
  { id: 'abilities', group: 'Your party', title: 'Abilities', summary: 'Every ability, its unlock, duration and cooldown, and Rampage.', body: abilitiesBody },
  { id: 'traits', group: 'Your party', title: 'Traits and auto-buy', summary: 'The kinds of trait and how auto-buy works.', body: traitsBody },
  ...COMPS.map(companionPage),
];
