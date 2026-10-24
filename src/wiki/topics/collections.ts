import { CARDS, CORRUPTION, CURSORS, LEGENDS, TROPHIES, ZONES, type CardDef, type TrophyDef } from '../../game/data.ts';
import { AWAKEN_ON, CARD_ODDS, DAN_GIVES, RELICS_ON, VICTOR_GIVES } from '../../game/game.ts';
import { esc, h2, link, table, toc } from '../kit.ts';
import { spr } from '../sprites.ts';
import type { Page } from '../pages.ts';

const LAP_COLOR = ['#c9b8a0', ...CORRUPTION.slice(1).map((c) => `#${c.tint.toString(16).padStart(6, '0')}`)];
const lapName = (lap: number) => (lap ? CORRUPTION[lap].name : 'Plain');
const dots = (c: CardDef) => c.laps.map((lap) => `<i title="${lapName(lap)}" style="display:inline-block;width:9px;height:9px;margin-right:3px;background:${LAP_COLOR[lap]};box-shadow:0 0 0 2px #0b0710"></i>`).join('');
const KIND = { monster: 'Monster', mid: 'Mid-boss', boss: 'Zone boss', goblin: 'Goblin' } as const;
const collector = LEGENDS.find((d) => d.id === 'collector')!;

const cardsBody = () => {
  const versions = CARDS.reduce((n, c) => n + c.laps.length * (c.gold ? 2 : 1), 0);
  const zones = [...ZONES.map((z, i) => ({ name: z.name, zone: i })), { name: 'Treasure goblins', zone: -1 }];
  return `<p class="lede">Every kind of monster has a card. They're a collection: ${CARDS.length} cards, each in the colors of the laps it appears on, plain and gold.</p>
    ${toc('cards', ['Drop chances', 'Colors', 'Gold cards', 'Every card', ...(AWAKEN_ON ? ['Trading'] : [])])}
    ${h2('Drop chances')}
    ${table(['From', 'Chance'], [
      ['A monster', `1 in ${CARD_ODDS.monster.toLocaleString('en-US')}`],
      ['A boss', `1 in ${CARD_ODDS.boss.toLocaleString('en-US')}`],
      ['A champion (gold card)', `1 in ${CARD_ODDS.champ.toLocaleString('en-US')}, then the plain chance`],
      ['A champion boss (gold card)', `1 in ${CARD_ODDS.champBoss.toLocaleString('en-US')}, then the plain chance`],
      ['A treasure goblin', `1 in ${CARD_ODDS.goblin.toLocaleString('en-US')}`],
      ['A rainbow goblin', `1 in ${CARD_ODDS.rainbow.toLocaleString('en-US')}`],
    ])}
    <p>${link(`spirit-${collector.id}`, collector.name)} raises every chance, up to three times. ${link('spirit-ronin', 'The Ronin')} raises it for kills that deal far more than a monster's health. Swept floors roll a card for every kill, and time away rolls them too (plain cards only).</p>
    ${h2('Colors')}
    <p>A card drops in the color of the lap you're on, if that card comes in it: plain on floors 1–80, then ${CORRUPTION.slice(1).map((c) => c.name).join(', ')}. A zone's newcomers only come in the later colors, and only two of its first crowd come back. Goblin cards are plain only.</p>
    ${h2('Gold cards')}
    <p>Only champions drop gold cards: gold monsters and champion bosses. Goblins have no gold card.</p>
    ${h2('Every card')}
    <p>${versions} versions in all, counting each color plain and gold.</p>
    ${zones.map(({ name, zone }) => {
      const cards = CARDS.filter((c) => c.zone === zone);
      return cards.length ? `<h3 id="cards-${zone}">${esc(name)}</h3>${table(['Card', 'Kind', 'Colors', { h: 'Gold', cls: 'c' }], cards.map((c) => [
        `<span class="who">${spr(c.sprite, 26)}${esc(c.name)}</span>`, KIND[c.kind], dots(c), c.gold ? '✓' : '—',
      ]))}` : '';
    }).join('')}
    ${AWAKEN_ON ? `${h2('Trading')}<p>Dan takes ${DAN_GIVES} spare cards for a random card from the zone of one you gave. Victor takes ${VICTOR_GIVES} spares for a random gold card.</p>` : ''}`;
};

/** Trophies that belong to systems that aren't in the game yet stay off the list. */
const live = (t: TrophyDef) => !(['relics', 'stars'].includes(t.req.t) && !RELICS_ON) && !(t.req.t === 'awakens' && !AWAKEN_ON);

const GROUPS: [string, TrophyDef['req']['t'][]][] = [
  ['Floors', ['floor']], ['Gold', ['gold']], ['Kills', ['kills']], ['Bosses', ['bosses', 'clutches', 'champions']],
  ['Companions', ['own']], ['Attacks', ['clicks', 'crits', 'fevers', 'rampage']], ['Damage', ['dps']],
  ['Goblins', ['raids', 'missed', 'rainbows', 'vaults']], ['Ascents', ['descents']], ['Upgrades', ['upgrades']],
  ['Cards', ['cards', 'goldCards']], ['Relics', ['relics', 'stars']], ['Awakening', ['awakens']],
];

const trophiesBody = () => {
  const trophies = TROPHIES.filter(live);
  const cursors = CURSORS.filter((c) => !c.trophy || trophies.some((t) => t.id === c.trophy));
  return `<p class="lede">Trophies mark milestones. Each one you earn adds +1% to all damage, for good.</p>
    <p>There are ${trophies.length} trophies, so +${trophies.length}% in all. Some also unlock a ${link('trophies', 'cursor', 'Cursors')}.</p>
    ${toc('trophies', [...GROUPS.filter(([, kinds]) => trophies.some((t) => kinds.includes(t.req.t))).map(([g]) => g), 'Cursors'])}
    ${GROUPS.map(([group, kinds]) => {
      const list = trophies.filter((t) => kinds.includes(t.req.t));
      return list.length ? `${h2(group)}${table(['Trophy', 'How'], list.map((t) => [`<span class="who">${spr(t.icon.sprite, 22)}<b>${esc(t.name)}</b></span>`, esc(t.desc)]))}` : '';
    }).join('')}
    ${h2('Cursors')}
    <p>Cursor skins, picked in Options.</p>
    ${table(['Cursor', 'Unlocked by'], cursors.map((c) => {
      const t = TROPHIES.find((x) => x.id === c.trophy);
      return [`<span class="who">${spr(c.sprite, 22)}${esc(c.name)}</span>`, t ? `${esc(t.name)}: ${esc(t.desc)}` : 'Always'];
    }))}`;
};

export const COLLECTION_PAGES: Page[] = [
  { id: 'cards', group: 'Collections', title: 'Cards', summary: 'Drop chances, colors, gold cards and every card.', body: cardsBody },
  { id: 'trophies', group: 'Collections', title: 'Trophies', summary: `Every trophy and cursor. Each trophy is +1% damage.`, body: trophiesBody },
];

