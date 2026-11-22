import { BOUND, ZONES, boundCost, boundName } from '../../game/data.ts';
import { DESCEND_FLOOR, MARK_FROM, MARK_MOVE, MARK_POWER, MARK_REROLL, TUNE, bossSouls } from '../../game/game.ts';
import { int, t } from '../../i18n/index.ts';
import { h2, link, pct, table, toc } from '../kit.ts';
import { spr } from '../sprites.ts';
import type { Page } from '../pages.ts';

const SOULS = {
  ascending: ['ascending', t('wiki.souls.h.ascending')],
  earning: ['earning-souls', t('wiki.souls.h.earning')],
  what: ['what-souls-do', t('wiki.souls.h.what')],
  keeps: ['what-an-ascent-keeps', t('wiki.souls.h.keeps')],
} as const;

const soulsBody = () => `<p class="lede">${t('wiki.souls.lede', { floor: DESCEND_FLOOR })}</p>
  ${toc('souls', [SOULS.ascending, SOULS.earning, SOULS.what, SOULS.keeps])}
  ${h2(SOULS.ascending)}
  <p>${t('wiki.souls.ascending', { floor: DESCEND_FLOOR })}</p>
  ${h2(SOULS.earning)}
  ${table([t('wiki.souls.earning.source'), t('wiki.souls.earning.souls')], [
    [t('wiki.souls.earning.levels'), t('wiki.souls.earning.levels.souls', { levels: int(TUNE.levelsPerSoul) })],
    [t('wiki.souls.earning.champions'), t('wiki.souls.earning.champions.souls', {
      at100: bossSouls(100), at150: bossSouls(150), at200: bossSouls(200), at300: bossSouls(300),
      bosses: link('bosses', t('wiki.souls.earning.champions.bosses'), 'souls-from-champion-bosses'),
    })],
  ])}
  <p>${t('wiki.souls.earning.paid')}</p>
  ${h2(SOULS.what)}
  <p>${t('wiki.souls.what', { power: pct(TUNE.soulPower, 0), spirits: link('spirits', t('wiki.souls.what.spirits')), heartmarks: link('heartmarks', t('wiki.souls.what.heartmarks')) })}</p>
  ${h2(SOULS.keeps)}
  ${table([t('wiki.reset'), t('wiki.kept')], [[t('wiki.souls.keeps.reset'), t('wiki.souls.keeps.kept')]])}`;

const boundTotal = (b: (typeof BOUND)[number], lv: number) => Array.from({ length: lv }, (_, l) => boundCost(b, l)).reduce((a, c) => a + c, 0);

const AWAKEN = {
  awakening: ['awakening', t('wiki.awaken.h.awakening')],
  bound: ['bound-souls', t('wiki.awaken.h.bound')],
  keeps: ['what-awakening-keeps', t('wiki.awaken.h.keeps')],
  theBound: ['the-bound', t('wiki.awaken.h.theBound')],
  champions: ['champion-souls', t('wiki.awaken.h.champions')],
} as const;

const awakenBody = () => `<p class="lede">${t('wiki.awaken.lede', { floor: TUNE.awakenFloor })}</p>
  ${toc('awakening', [AWAKEN.awakening, AWAKEN.bound, AWAKEN.keeps, AWAKEN.theBound, AWAKEN.champions])}
  ${h2(AWAKEN.awakening)}
  <p>${t('wiki.awaken.awakening', { floor: TUNE.awakenFloor })}</p>
  ${h2(AWAKEN.bound)}
  <p>${t('wiki.awaken.bound')}</p>
  ${table([t('wiki.awaken.bound.souls'), { h: t('wiki.awaken.bound.total'), cls: 'num' }], [10, 100, 400, 1000, 1e4, 1e5, 1e6].map((n) => [int(n), Math.floor(5 * Math.log10(n))]))}
  <p>${t('wiki.awaken.bound.unspent')}</p>
  ${h2(AWAKEN.keeps)}
  ${table([t('wiki.reset'), t('wiki.kept')], [[t('wiki.awaken.keeps.reset'), t('wiki.awaken.keeps.kept')]])}
  <p>${t('wiki.awaken.keeps.respec')}</p>
  ${h2(AWAKEN.theBound)}
  <p>${t('wiki.awaken.theBound')}</p>
  ${table([t('wiki.awaken.theBound.bound'), t('wiki.awaken.theBound.boosts'), t('wiki.awaken.theBound.per'), { h: t('wiki.awaken.theBound.max'), cls: 'num' }, { h: t('wiki.awaken.theBound.total5'), cls: 'num' }], BOUND.map((b) => [
    `<span class="who">${spr(ZONES[b.zone].boss.sprite, 28)}${boundName(b)}</span>`, b.what, b.value(1), b.max ?? '—', b.max !== undefined && b.max < 5 ? '—' : boundTotal(b, 5),
  ]))}
  <p>${t('wiki.awaken.theBound.notes')}</p>
  ${h2(AWAKEN.champions)}
  <p>${t('wiki.awaken.champions', { floor: TUNE.goldBossFrom, from: pct(TUNE.pullFloor, 0), cap: pct(TUNE.pullCap, 0) })}</p>`;

const MARKS = {
  earning: ['earning-heartmarks', t('wiki.marks.h.earning')],
  what: ['what-they-do', t('wiki.marks.h.what')],
  moving: ['moving-them', t('wiki.marks.h.moving')],
} as const;

const marksBody = () => `<p class="lede">${t('wiki.marks.lede')}</p>
  ${h2(MARKS.earning)}
  <p>${t('wiki.marks.earning', { from: MARK_FROM, again: MARK_FROM + 10, awakening: link('awakening', t('wiki.marks.earning.awakening')) })}</p>
  ${h2(MARKS.what)}
  <p>${t('wiki.marks.what', { power: pct(MARK_POWER, 0) })}</p>
  ${h2(MARKS.moving)}
  ${table([t('wiki.marks.moving.action'), { h: t('wiki.marks.moving.cost'), cls: 'num' }, t('wiki.marks.moving.happens')], [
    [t('wiki.marks.moving.away'), t('wiki.marks.moving.souls', { count: MARK_REROLL }), t('wiki.marks.moving.away.happens')],
    [t('wiki.marks.moving.here'), t('wiki.marks.moving.souls', { count: MARK_MOVE }), t('wiki.marks.moving.here.happens')],
  ])}
  <p>${t('wiki.marks.moving.respec')}</p>`;

export const SOUL_PAGES: Page[] = [
  { id: 'souls', group: 'souls', title: t('wiki.page.souls'), summary: t('wiki.page.souls.summary'), body: soulsBody },
  { id: 'heartmarks', group: 'souls', title: t('wiki.page.heartmarks'), summary: t('wiki.page.heartmarks.summary'), body: marksBody },
  { id: 'awakening', group: 'souls', title: t('wiki.page.awakening'), summary: t('wiki.page.awakening.summary'), body: awakenBody },
];
