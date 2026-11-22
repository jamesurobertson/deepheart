import { CARDS, CORRUPTION, CURSORS, LEGENDS, TROPHIES, ZONES, type CardDef, type TrophyDef } from '../../game/data.ts';
import { ABILITIES, COMPS, type AbilityId } from '../../game/data.ts';
import { AWAKEN_ON, CARD_ODDS, CHAMP_CHANCE, FIRST_CARD, DAN_GIVES, EXPEDITION_LEVEL, FLOOR_KILLS, GOLD_SET_BONUS, SET_BONUS, TRIP_HOURS, VICTOR_GIVES } from '../../game/game.ts';
import { fixed, int, t, type UiKey } from '../../i18n/index.ts';
import { esc, h2, h3, link, pct, table, toc } from '../kit.ts';
import { spr } from '../sprites.ts';
import { kokoSvg } from '../../ui/koko.ts';
import { skillIcon } from '../../ui/icons.ts';
import type { Page } from '../pages.ts';

const LAP_COLOR = ['#c9b8a0', ...CORRUPTION.slice(1).map((c) => `#${c.tint.toString(16).padStart(6, '0')}`)];
const lapName = (lap: number) => (lap ? CORRUPTION[lap].name : t('wiki.lap.plain'));
const dots = (c: CardDef) => c.laps.map((lap) => `<i title="${lapName(lap)}" style="display:inline-block;width:9px;height:9px;margin-right:3px;background:${LAP_COLOR[lap]};box-shadow:0 0 0 2px #0b0710"></i>`).join('');
const KIND = { monster: 'wiki.cards.kind.monster', mid: 'wiki.cards.kind.mid', boss: 'wiki.cards.kind.boss', goblin: 'wiki.cards.kind.goblin' } as const;
/** The soul glyph the Ascend trophies use (as the game's Ascend button draws it). */
const SOUL = `<svg viewBox="0 0 7 8" width="21" height="24" shape-rendering="crispEdges" fill="#b38cff" aria-hidden="true">${[[3, 0, 1, 1], [2, 1, 3, 1], [1, 2, 5, 3], [2, 5, 3, 1], [1, 6, 1, 1], [3, 6, 1, 1], [5, 6, 1, 1], [0, 7, 1, 1], [2, 7, 1, 1], [4, 7, 1, 1], [6, 7, 1, 1]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}</svg>`;
const collector = LEGENDS.find((d) => d.id === 'collector')!;

const CARDS_SECTIONS = {
  drops: ['drop-chances', t('wiki.cards.h.drops')],
  colors: ['colors', t('wiki.cards.h.colors')],
  gold: ['gold-cards', t('wiki.cards.h.gold')],
  sets: ['sets', t('wiki.cards.h.sets')],
  every: ['every-card', t('wiki.cards.h.every')],
  trading: ['trading', t('wiki.cards.h.trading')],
} as const;

const odds = (n: number) => t('wiki.cards.drops.odds', { odds: int(n) });
const champOdds = (n: number) => t('wiki.cards.drops.odds.champ', { odds: int(n) });

const cardsBody = () => {
  const versions = CARDS.reduce((n, c) => n + c.laps.length * (c.gold ? 2 : 1), 0);
  const zones = [...ZONES.map((z, i) => ({ name: z.name, zone: i })), { name: t('wiki.cards.goblins'), zone: -1 }];
  const sections = [CARDS_SECTIONS.drops, CARDS_SECTIONS.colors, CARDS_SECTIONS.gold, CARDS_SECTIONS.sets, CARDS_SECTIONS.every, ...(AWAKEN_ON ? [CARDS_SECTIONS.trading] : [])];
  return `<p class="lede">${t('wiki.cards.lede', { count: CARDS.length })}</p>
    ${toc('cards', sections)}
    ${h2(CARDS_SECTIONS.drops)}
    ${table([t('wiki.cards.drops.from'), t('wiki.cards.drops.chance')], [
      [t('wiki.cards.drops.monster'), odds(CARD_ODDS.monster)],
      [t('wiki.cards.drops.boss'), odds(CARD_ODDS.boss)],
      [t('wiki.cards.drops.champ'), champOdds(CARD_ODDS.champ)],
      [t('wiki.cards.drops.champBoss'), champOdds(CARD_ODDS.champBoss)],
      [t('wiki.cards.drops.goblin'), odds(CARD_ODDS.goblin)],
      [t('wiki.cards.drops.rainbow'), odds(CARD_ODDS.rainbow)],
    ])}
    <p>${t('wiki.cards.drops.first', { from: int(FIRST_CARD.from), by: int(FIRST_CARD.by), fromFloor: FIRST_CARD.from / FLOOR_KILLS, byFloor: FIRST_CARD.by / FLOOR_KILLS })}</p>
    <p>${t('wiki.cards.drops.raise', {
      collector: link(`spirit-${collector.id}`, collector.name), ronin: link('spirit-ronin', t('wiki.cards.drops.ronin')), expeditions: link('expeditions', t('wiki.cards.drops.expeditions')),
    })}</p>
    ${h2(CARDS_SECTIONS.colors)}
    <p>${t('wiki.cards.colors', { colors: CORRUPTION.slice(1).map((c) => c.name).join(', ') })}</p>
    ${h2(CARDS_SECTIONS.gold)}
    <p>${t('wiki.cards.gold')}</p>
    ${h2(CARDS_SECTIONS.sets)}
    <p>${t('wiki.cards.sets', { set: pct(SET_BONUS, 0), gold: pct(GOLD_SET_BONUS, 0), count: ZONES.length * CORRUPTION.length })}</p>
    <p>${t('wiki.cards.sets.start')}</p>
    ${h2(CARDS_SECTIONS.every)}
    <p>${t('wiki.cards.every', { count: versions })}</p>
    ${zones.map(({ name, zone }) => {
      const cards = CARDS.filter((c) => c.zone === zone);
      return cards.length ? `${h3([`cards-${zone}`, esc(name)])}${table([t('wiki.cards.every.card'), t('wiki.cards.every.kind'), t('wiki.cards.every.colors'), { h: t('wiki.cards.every.gold'), cls: 'c' }], cards.map((c) => [
        `<span class="who">${spr(c.sprite, 26)}${esc(c.name)}</span>`, t(KIND[c.kind]), dots(c), c.gold ? '✓' : '—',
      ]))}` : '';
    }).join('')}
    ${AWAKEN_ON ? `${h2(CARDS_SECTIONS.trading)}<p>${t('wiki.cards.trading', { dan: DAN_GIVES, victor: VICTOR_GIVES })}</p>` : ''}`;
};

/** Trophies that belong to systems that aren't in the game yet stay off the list. */
const live = (trophy: TrophyDef) => !(['awakens', 'boundAll', 'boundEarned'].includes(trophy.req.t) && !AWAKEN_ON);
/** Hidden trophies stay off the wiki's lists too. */
const listed = (trophy: TrophyDef) => live(trophy) && !trophy.hidden;

const TROPHY_GROUPS: { id: string; label: UiKey; kinds: TrophyDef['req']['t'][] }[] = [
  { id: 'floors', label: 'wiki.trophies.group.floors', kinds: ['floor'] },
  { id: 'gold', label: 'wiki.trophies.group.gold', kinds: ['gold'] },
  { id: 'kills', label: 'wiki.trophies.group.kills', kinds: ['kills'] },
  { id: 'bosses', label: 'wiki.trophies.group.bosses', kinds: ['bosses', 'clutches', 'champions'] },
  { id: 'companions', label: 'wiki.trophies.group.companions', kinds: ['level', 'levelAll'] },
  { id: 'attacks', label: 'wiki.trophies.group.attacks', kinds: ['clicks', 'crits', 'fevers', 'rampage'] },
  { id: 'damage', label: 'wiki.trophies.group.damage', kinds: ['dps'] },
  { id: 'goblins', label: 'wiki.trophies.group.goblins', kinds: ['raids', 'missed', 'rainbows', 'vaults'] },
  { id: 'ascents', label: 'wiki.trophies.group.ascents', kinds: ['descents'] },
  { id: 'expeditions', label: 'wiki.trophies.group.expeditions', kinds: ['trips', 'tripCards', 'tripKills'] },
  { id: 'cards', label: 'wiki.trophies.group.cards', kinds: ['cards', 'versions', 'goldCards'] },
  { id: 'awakening', label: 'wiki.trophies.group.awakening', kinds: ['awakens', 'boundAll', 'boundEarned'] },
  { id: 'the-keep', label: 'wiki.trophies.group.keep', kinds: ['pets'] },
];

const trophyIcon = (trophy: TrophyDef) => {
  const { sprite } = trophy.icon;
  if (sprite === 'soul') return SOUL;
  if (sprite === 'koko') return kokoSvg(22);
  return sprite.startsWith('skill:') ? skillIcon(sprite.slice(6) as AbilityId, 22) : spr(sprite, 22);
};

const trophiesBody = () => {
  const trophies = TROPHIES.filter(live);
  const cursors = CURSORS.filter((c) => !c.trophy || trophies.some((trophy) => trophy.id === c.trophy));
  const groups = TROPHY_GROUPS.map((group) => ({ section: [group.id, t(group.label)] as const, list: trophies.filter((trophy) => group.kinds.includes(trophy.req.t)) }));
  const cursorSection = ['cursors', t('wiki.trophies.h.cursors')] as const;
  return `<p class="lede">${t('wiki.trophies.lede')}</p>
    <p>${t('wiki.trophies.count', { count: trophies.length, total: pct(trophies.length / 100, 0), cursor: link('trophies', t('wiki.trophies.count.cursor'), 'cursors') })}</p>
    ${toc('trophies', [...groups.filter((group) => group.list.length).map((group) => group.section), cursorSection])}
    ${groups.map(({ section, list }) => {
      const shown = list.filter(listed);
      return shown.length ? `${h2(section)}${table([t('wiki.trophies.trophy'), t('wiki.trophies.how')], shown.map((trophy) => [`<span class="who">${trophyIcon(trophy)}<b>${esc(trophy.name)}</b></span>`, esc(trophy.desc)]))}` : '';
    }).join('')}
    ${h2(cursorSection)}
    <p>${t('wiki.trophies.cursors')}</p>
    ${table([t('wiki.trophies.cursors.cursor'), t('wiki.trophies.cursors.by')], cursors.map((c) => {
      const trophy = TROPHIES.find((x) => x.id === c.trophy);
      return [`<span class="who">${spr(c.sprite, 22)}${esc(c.name)}</span>`, trophy ? t('wiki.trophies.cursors.trophy', { trophy: esc(trophy.name), how: esc(trophy.desc) }) : t('wiki.trophies.cursors.always')];
    }))}`;
};

const TRIPS = {
  opening: ['opening', t('wiki.trips.h.opening')],
  sending: ['sending-a-hunter', t('wiki.trips.h.sending')],
  finds: ['what-a-hunter-finds', t('wiki.trips.h.finds')],
  home: ['coming-home', t('wiki.trips.h.home')],
} as const;

/** Levels are written without grouping: "level 1000". */
const tripLevel = () => fixed(EXPEDITION_LEVEL, 0);

const tripsBody = () => `<p class="lede">${t('wiki.trips.lede', { level: tripLevel() })}</p>
  ${toc('expeditions', [TRIPS.opening, TRIPS.sending, TRIPS.finds, TRIPS.home])}
  ${h2(TRIPS.opening)}
  <p>${t('wiki.trips.opening', { level: tripLevel() })}</p>
  ${h2(TRIPS.sending)}
  <p>${t('wiki.trips.sending', { level: tripLevel() })}</p>
  ${table([t('wiki.trips.sending.companion'), t('wiki.trips.sending.takes')], [...new Set(ABILITIES.map((a) => a.comp))].map((i) => [COMPS[i].name, ABILITIES.filter((a) => a.comp === i).map((a) => a.name).join(', ')]))}
  ${h2(TRIPS.finds)}
  <p>${t('wiki.trips.finds', { count: FLOOR_KILLS })}</p>
  <p>${t('wiki.trips.finds.cards', { odds: int(CARD_ODDS.monster), collector: link('spirit-collector', t('wiki.trips.finds.collector')), chance: pct(CHAMP_CHANCE, 0) })}</p>
  <p>${t('wiki.trips.finds.deep')}</p>
  ${h2(TRIPS.home)}
  <p>${t('wiki.trips.home', { count: TRIP_HOURS })}</p>`;

export const COLLECTION_PAGES: Page[] = [
  { id: 'cards', group: 'collections', title: t('wiki.page.cards'), summary: t('wiki.page.cards.summary'), body: cardsBody },
  { id: 'expeditions', group: 'collections', title: t('wiki.page.expeditions'), summary: t('wiki.page.expeditions.summary'), body: tripsBody },
  { id: 'trophies', group: 'collections', title: t('wiki.page.trophies'), summary: t('wiki.page.trophies.summary'), body: trophiesBody },
];
