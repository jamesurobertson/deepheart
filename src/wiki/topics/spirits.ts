import { BOUND, boundName, LEGENDS, OFFER_SIZE, RESPEC_REFUND, SUMMON_COST, legendCost, legendShare, rerollCost, type LegendDef, type LegendId } from '../../game/data.ts';
import { TUNE } from '../../game/game.ts';
import { int, t, type UiKey } from '../../i18n/index.ts';
import { h2, infobox, link, pct, range, splitTables, table, toc } from '../kit.ts';
import { spr } from '../sprites.ts';
import type { Page } from '../pages.ts';

const KIND = { power: 'wiki.spirit.kind.power', utility: 'wiki.spirit.kind.utility', sink: 'wiki.spirit.kind.sink' } as const;

/** The Bound that make a Spirit work harder. */
const BOOSTED_BY: Record<string, string> = { wither: 'troll', soulcaller: 'golem', lure: 'thing', hourglass: 'ent', thinning: 'frost' };

/** Where each Spirit's bonus applies, and the rule behind its number. */
const HOW = {
  sleeper: 'wiki.spirit.how.sleeper',
  fist: 'wiki.spirit.how.fist',
  breaker: 'wiki.spirit.how.breaker',
  needle: 'wiki.spirit.how.needle',
  hoard: 'wiki.spirit.how.hoard',
  patient: 'wiki.spirit.how.patient',
  goblinking: 'wiki.spirit.how.goblinking',
  unbroken: 'wiki.spirit.how.unbroken',
  hourglass: 'wiki.spirit.how.hourglass',
  wither: 'wiki.spirit.how.wither',
  thinning: 'wiki.spirit.how.thinning',
  haggler: 'wiki.spirit.how.haggler',
  restless: 'wiki.spirit.how.restless',
  lingering: 'wiki.spirit.how.lingering',
  whirl: 'wiki.spirit.how.whirl',
  headsman: 'wiki.spirit.how.headsman',
  magpie: 'wiki.spirit.how.magpie',
  drummer: 'wiki.spirit.how.drummer',
  host: 'wiki.spirit.how.host',
  soulcaller: 'wiki.spirit.how.soulcaller',
  lure: 'wiki.spirit.how.lure',
  collector: 'wiki.spirit.how.collector',
  ronin: 'wiki.spirit.how.ronin',
  hungry: 'wiki.spirit.how.hungry',
} as const satisfies Partial<Record<LegendId, UiKey>>;

const CAP = {
  hourglass: 'wiki.spirit.cap.hourglass',
  wither: 'wiki.spirit.cap.wither',
  restless: 'wiki.spirit.cap.restless',
  soulcaller: 'wiki.spirit.cap.soulcaller',
  lure: 'wiki.spirit.cap.lure',
  collector: 'wiki.spirit.cap.collector',
  thinning: 'wiki.spirit.cap.thinning',
} as const satisfies Partial<Record<LegendId, UiKey>>;

const howOf = (d: LegendDef) => (d.id in HOW ? t(HOW[d.id as keyof typeof HOW]) : d.what);
const capOf = (d: LegendDef) => (d.id in CAP ? t(CAP[d.id as keyof typeof CAP]) : '');

/** A Spirit's level prices in words, with the first few as examples. */
const costRule = (d: LegendDef) => {
  if (d.kind === 'sink') return t('wiki.spirit.cost.sink');
  const first = [1, 2, 3, 4].map((lv) => legendCost(d, lv)).join(', ');
  if (d.kind === 'utility') return t('wiki.spirit.cost.utility', { first });
  return d.id === 'unbroken' ? t('wiki.spirit.cost.unbroken', { first }) : t('wiki.spirit.cost.power', { first });
};

/** Souls to take a Spirit from level 1 to `lv` (summoning it is level 1). */
const totalTo = (d: LegendDef, lv: number) => range(1, lv - 1).reduce((sum, l) => sum + legendCost(d, l), 0);

function levelRows(d: LegendDef, levels: number[]) {
  return levels.map((lv) => [`<b>${lv}</b>`, lv === 1 ? t('wiki.spirit.levels.summon') : int(legendCost(d, lv - 1)), int(totalTo(d, lv)), d.value(lv)]);
}

function levelTables(d: LegendDef) {
  const cols = [{ h: t('wiki.spirit.levels.lvl'), cls: 'c' as const }, { h: t('wiki.spirit.levels.cost'), cls: 'num' as const }, { h: t('wiki.spirit.levels.total'), cls: 'num' as const }, t('wiki.spirit.levels.effect')];
  if (d.maxLv) return splitTables(cols, [levelRows(d, range(1, d.maxLv))]);
  if (d.kind === 'utility') return splitTables(cols, [levelRows(d, range(1, 10)), levelRows(d, range(11, 20))]);
  return splitTables(cols, [levelRows(d, range(1, 10)), levelRows(d, range(15, 60, 5)), levelRows(d, range(70, 160, 10))]);
}

const boosted = (d: LegendDef) => {
  const bound = link('awakening', boundName(BOUND.find((b) => b.id === BOOSTED_BY[d.id])!), 'the-bound');
  return d.id === 'thinning' ? t('wiki.spirit.boosted.thinning', { bound }) : t('wiki.spirit.boosted', { bound });
};

function spiritPage(d: LegendDef): Page {
  return {
    id: `spirit-${d.id}`, parent: 'spirits', group: 'souls', title: d.name, summary: d.what,
    body: () => `${infobox(spr(d.sprite, 96), [
      [t('wiki.spirit.type'), `<span class="tag ${d.kind}">${t(KIND[d.kind])}</span>`],
      [t('wiki.spirit.boosts'), d.what],
      [t('wiki.spirit.level1'), d.value(1)],
      [t('wiki.spirit.levelCost'), costRule(d)],
      ...(capOf(d) ? [[t('wiki.spirit.cap'), capOf(d)] as [string, string]] : []),
      ...(d.maxLv ? [[t('wiki.spirit.maxLevel'), String(d.maxLv)] as [string, string]] : []),
    ])}
      <p class="lede">${howOf(d)}</p>
      ${d.note ? `<p class="note">${d.note}</p>` : ''}
      ${BOOSTED_BY[d.id] ? `<p>${boosted(d)}</p>` : ''}
      ${h2(['leveling', t('wiki.spirit.h.leveling', { name: d.name })])}
      <p>${t('wiki.spirit.leveling', { name: d.name, summonCost: link('spirits', t('wiki.spirit.leveling.summonCost'), 'summoning'), cost: costRule(d) })}
      ${d.kind === 'utility' && capOf(d) && d.id !== 'thinning' ? t('wiki.spirit.leveling.cap', { at1: pct(legendShare(1), 0), at10: pct(legendShare(10), 0), at20: pct(legendShare(20), 0) }) : ''}</p>
      <p>${t('wiki.spirit.levels.explain')}</p>
      ${levelTables(d)}
      <div class="clear"></div>`,
  };
}

const SPIRITS = {
  summoning: ['summoning', t('wiki.spirits.h.summoning')],
  leveling: ['leveling', t('wiki.spirits.h.leveling')],
  all: ['all-spirits', t('wiki.spirits.h.all')],
  respec: ['respec', t('wiki.spirits.h.respec')],
  kept: ['kept-souls', t('wiki.spirits.h.kept')],
} as const;

const listBody = () => {
  const row = (d: LegendDef) => [
    `<a class="who" href="#/spirit-${d.id}">${spr(d.sprite, 28)}${d.name}</a>`,
    `<span class="tag ${d.kind}">${t(KIND[d.kind])}</span>`, d.what, d.value(1), costRule(d), capOf(d) || '—',
  ];
  const summonRows = SUMMON_COST.map((cost, owned) => [`<b>${owned + 1}</b>`, int(cost), int(rerollCost(owned))]);
  const totalSummon = SUMMON_COST.slice(0, LEGENDS.length).reduce((a, b) => a + b, 0);
  return `<p class="lede">${t('wiki.spirits.lede')}</p>
    ${toc('spirits', [SPIRITS.summoning, SPIRITS.leveling, SPIRITS.all, SPIRITS.respec, SPIRITS.kept])}
    ${h2(SPIRITS.summoning)}
    <p>${t('wiki.spirits.summoning', { offer: OFFER_SIZE })}</p>
    <p>${t('wiki.spirits.summoning.cost', { count: LEGENDS.length, total: int(totalSummon) })}</p>
    ${splitTables([{ h: t('wiki.spirits.summoning.number'), cls: 'c' }, { h: t('wiki.spirits.summoning.summon'), cls: 'num' }, { h: t('wiki.spirits.summoning.reroll'), cls: 'num' }], [summonRows.slice(0, 9), summonRows.slice(9)])}
    ${h2(SPIRITS.leveling)}
    <p>${t('wiki.spirits.leveling')}</p>
    ${table([t('wiki.spirits.leveling.kind'), t('wiki.spirit.levelCost'), t('wiki.spirits.leveling.grows')], [
      [`<span class="tag power">${t(KIND.power)}</span>`, t('wiki.spirits.leveling.power.cost'), t('wiki.spirits.leveling.power.grows')],
      [`<span class="tag utility">${t(KIND.utility)}</span>`, t('wiki.spirits.leveling.utility.cost'), t('wiki.spirits.leveling.utility.grows')],
      [`<span class="tag sink">${t(KIND.sink)}</span>`, t('wiki.spirits.leveling.sink.cost'), t('wiki.spirits.leveling.sink.grows')],
    ])}
    ${h2(SPIRITS.all)}
    ${table([t('wiki.spirits.all.spirit'), t('wiki.spirit.type'), t('wiki.spirit.boosts'), t('wiki.spirit.level1'), t('wiki.spirit.levelCost'), t('wiki.spirit.cap')], LEGENDS.map(row))}
    ${h2(SPIRITS.respec)}
    <p>${t('wiki.spirits.respec', { refund: pct(RESPEC_REFUND, 0) })}</p>
    ${h2(SPIRITS.kept)}
    <p>${t('wiki.spirits.kept', { power: pct(TUNE.soulPower, 0) })}</p>`;
};

export const SPIRIT_PAGES: Page[] = [
  { id: 'spirits', group: 'souls', title: t('wiki.page.spirits'), summary: t('wiki.page.spirits.summary'), body: listBody },
  ...LEGENDS.map(spiritPage),
];
