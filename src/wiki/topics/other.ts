import { DESCEND_FLOOR, FLOOR_KILLS } from '../../game/game.ts';
import { fmt } from '../../game/format.ts';
import { numberWord, numberWords, t } from '../../i18n/index.ts';
import { h2, link, table, toc } from '../kit.ts';
import type { Page } from '../pages.ts';

const BASICS = {
  loop: ['the-loop', t('wiki.basics.h.loop')],
  first: ['your-first-run', t('wiki.basics.h.first')],
  after: ['after-floor-100', t('wiki.basics.h.after')],
  next: ['where-to-look-next', t('wiki.basics.h.next')],
} as const;

const basicsBody = () => `<p class="lede">${t('wiki.basics.lede')}</p>
  ${toc('basics', [BASICS.loop, BASICS.first, BASICS.after, BASICS.next])}
  ${h2(BASICS.loop)}
  <ol>
    <li>${t('wiki.basics.loop.gold')}</li>
    <li>${t('wiki.basics.loop.spend')}</li>
    <li>${t('wiki.basics.loop.deeper')}</li>
    <li>${t('wiki.basics.loop.ascend', { floor: DESCEND_FLOOR })}</li>
  </ol>
  ${h2(BASICS.first)}
  <p>${t('wiki.basics.first', { count: FLOOR_KILLS })}</p>
  <p>${t('wiki.basics.first.upgrades')}</p>
  ${h2(BASICS.after)}
  <p>${t('wiki.basics.after', { floor: DESCEND_FLOOR, spirits: link('spirits', t('wiki.basics.after.spirits')), heartmarks: link('heartmarks', t('wiki.basics.after.heartmarks')) })}</p>
  ${h2(BASICS.next)}
  <p>${link('companions', t('wiki.page.companions'))} · ${link('floors', t('wiki.page.floors'))} · ${link('bosses', t('wiki.page.bosses'))} · ${link('souls', t('wiki.page.souls'))} · ${link('spirits', t('wiki.page.spirits'))} · ${link('calculator', t('wiki.page.calculator'))}</p>`;

const AWAY = {
  happens: ['what-happens-while-you-re-away', t('wiki.away.h.happens')],
  doesnt: ['what-doesn-t', t('wiki.away.h.doesnt')],
  long: ['how-long-counts', t('wiki.away.h.long')],
} as const;

const awayBody = () => `<p class="lede">${t('wiki.away.lede')}</p>
  ${h2(AWAY.happens)}
  <ul>
    <li>${t('wiki.away.farm')}</li>
    <li>${t('wiki.away.gold', { sleeper: link('spirit-sleeper', t('wiki.away.gold.sleeper')), patient: link('spirit-patient', t('wiki.away.gold.patient')) })}</li>
    <li>${t('wiki.away.kills')}</li>
    <li>${t('wiki.away.cards')}</li>
    <li>${t('wiki.away.cooldowns')}</li>
  </ul>
  ${h2(AWAY.doesnt)}
  <p>${t('wiki.away.doesnt')}</p>
  ${h2(AWAY.long)}
  <p>${t('wiki.away.long')}</p>`;

const settingsBody = () => `<p class="lede">${t('wiki.settings.lede')}</p>
  ${table([t('wiki.settings.setting'), t('wiki.settings.does')], [
    [t('wiki.settings.sound'), t('wiki.settings.sound.does')],
    [t('wiki.settings.particles'), t('wiki.settings.particles.does')],
    [t('wiki.settings.flashing'), t('wiki.settings.flashing.does')],
    [t('wiki.settings.shake'), t('wiki.settings.shake.does')],
    [t('wiki.settings.damage'), t('wiki.settings.damage.does')],
    [t('wiki.settings.blood'), t('wiki.settings.blood.does')],
    [t('wiki.settings.intros'), t('wiki.settings.intros.does')],
    [t('wiki.settings.numbers'), t('wiki.settings.numbers.does')],
    [t('wiki.settings.cursor'), t('wiki.settings.cursor.does', { trophies: link('trophies', t('wiki.settings.cursor.trophies'), 'cursors') })],
    [t('wiki.settings.export'), t('wiki.settings.export.does')],
  ])}`;

/** The suffixes and their names in the player's language, from K (10³) up to the last named one. */
const suffixRows = () => {
  const { group, short, long } = numberWords();
  return short.slice(1, long.length).map((suffix, k) => [`<b>${suffix}</b>`, numberWord(k + 1, 2), `10<sup>${(k + 1) * group}</sup>`, fmt(1.23 * 10 ** ((k + 1) * group))]);
};

const numbersBody = () => `<p class="lede">${t('wiki.numbers.lede')}</p>
  ${table([t('wiki.numbers.suffix'), t('wiki.numbers.name'), t('wiki.numbers.value'), t('wiki.numbers.example')], suffixRows())}`;

export const OTHER_PAGES: Page[] = [
  { id: 'basics', group: 'start', title: t('wiki.page.basics'), summary: t('wiki.page.basics.summary'), body: basicsBody },
  { id: 'away', group: 'other', title: t('wiki.page.away'), summary: t('wiki.page.away.summary'), body: awayBody },
  { id: 'settings', group: 'other', title: t('wiki.page.settings'), summary: t('wiki.page.settings.summary'), body: settingsBody },
  { id: 'numbers', group: 'other', title: t('wiki.page.numbers'), summary: t('wiki.page.numbers.summary'), body: numbersBody },
];
