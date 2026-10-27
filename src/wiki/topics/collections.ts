import { CARDS, CORRUPTION, CURSORS, LEGENDS, TROPHIES, ZONES, type CardDef, type TrophyDef } from '../../game/data.ts';
import { ABILITIES, COMPS } from '../../game/data.ts';
import { AWAKEN_ON, CARD_ODDS, CHAMP_CHANCE, DAN_GIVES, EXPEDITION_LEVEL, FLOOR_KILLS, GOLD_SET_BONUS, SET_BONUS, TRIP_HOURS, VICTOR_GIVES } from '../../game/game.ts';
import { esc, h2, link, pct, table, toc } from '../kit.ts';
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
    ${toc('cards', ['Drop chances', 'Colors', 'Gold cards', 'Sets', 'Every card', ...(AWAKEN_ON ? ['Trading'] : [])])}
    ${h2('Drop chances')}
    ${table(['From', 'Chance'], [
      ['A monster', `1 in ${CARD_ODDS.monster.toLocaleString('en-US')}`],
      ['A boss', `1 in ${CARD_ODDS.boss.toLocaleString('en-US')}`],
      ['A champion (gold card)', `1 in ${CARD_ODDS.champ.toLocaleString('en-US')}, then the plain chance`],
      ['A champion boss (gold card)', `1 in ${CARD_ODDS.champBoss.toLocaleString('en-US')}, then the plain chance`],
      ['A treasure goblin', `1 in ${CARD_ODDS.goblin.toLocaleString('en-US')}`],
      ['A rainbow goblin', `1 in ${CARD_ODDS.rainbow.toLocaleString('en-US')}`],
    ])}
    <p>${link(`spirit-${collector.id}`, collector.name)} raises every chance, up to three times. ${link('spirit-ronin', 'The Ronin')} raises it for kills that deal far more than a monster's health. Swept floors roll a card for every kill, and time away rolls them too (plain cards only). ${link('expeditions', 'Expeditions')} roll them for every kill a hunter makes.</p>
    ${h2('Colors')}
    <p>A card drops in the color of the lap you're on, if that card comes in it: plain on floors 1–80, then ${CORRUPTION.slice(1).map((c) => c.name).join(', ')}. A zone's newcomers only come in the later colors, and only two of its first crowd come back. Goblin cards are plain only.</p>
    ${h2('Gold cards')}
    <p>Only champions drop gold cards: gold monsters and champion bosses. Goblins have no gold card.</p>
    ${h2('Sets')}
    <p>A zone's cards in one color are a set: its monsters, its mid-boss and its boss (the goblins belong to no set). Each finished set adds +${Math.round(SET_BONUS * 100)}% to all damage, and each finished in gold +${Math.round(GOLD_SET_BONUS * 100)}%. ${ZONES.length * CORRUPTION.length} sets in all, and as many in gold.</p>
    <p>Sets also start your runs deeper. After an ascent or an awakening, a new run begins past every zone, in the order you meet them, whose set in that zone's color you've finished, and pays the gold those floors would have.</p>
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
const live = (t: TrophyDef) => !(['awakens', 'boundAll', 'boundEarned'].includes(t.req.t) && !AWAKEN_ON);

const GROUPS: [string, TrophyDef['req']['t'][]][] = [
  ['Floors', ['floor']], ['Gold', ['gold']], ['Kills', ['kills']], ['Bosses', ['bosses', 'clutches', 'champions']],
  ['Companions', ['level', 'levelAll']], ['Attacks', ['clicks', 'crits', 'fevers', 'rampage']], ['Damage', ['dps']],
  ['Goblins', ['raids', 'missed', 'rainbows', 'vaults']], ['Ascents', ['descents']], ['Expeditions', ['trips', 'tripCards']],
  ['Cards', ['cards', 'versions', 'goldCards']], ['Awakening', ['awakens', 'boundAll', 'boundEarned']],
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

const tripsBody = () => `<p class="lede">Send a companion at level ${EXPEDITION_LEVEL} or more to a floor you've reached to hunt its cards, in real time.</p>
  ${toc('expeditions', ['Opening', 'Sending a hunter', 'What a hunter finds', 'Coming home'])}
  ${h2('Opening')}
  <p>Expeditions open the first time any companion reaches level ${EXPEDITION_LEVEL}. The ladder in the Keep's entrance is where you send them.</p>
  ${h2('Sending a hunter')}
  <p>Any companion at level ${EXPEDITION_LEVEL} or more in this run can go, as many at once as you like. Pick any floor you've reached. While it's away a hunter leaves your party: its damage, its traits and any ability it brings go with it, and it can't be leveled.</p>
  ${table(['Companion', 'Takes'], [...new Set(ABILITIES.map((a) => a.comp))].map((i) => [COMPS[i].name, ABILITIES.filter((a) => a.comp === i).map((a) => a.name).join(', ')]))}
  ${h2('What a hunter finds')}
  <p>A hunter fights at its damage per second from when it left. On a plain floor it kills as fast as its damage allows against the floor's monsters, up to the sweep limit of ${FLOOR_KILLS} kills every 0.6 seconds. On a boss floor it fights the boss, up to one every 2 seconds.</p>
  <p>Every kill rolls for its card at the usual chance (1 in ${CARD_ODDS.monster.toLocaleString('en-US')} for a monster), with ${link('spirit-collector', 'the Collector')} and ${link('spirit-ronin', 'the Ronin')}. ${pct(CHAMP_CHANCE, 0)} of the kills are champions and roll for gold cards, and on a boss floor champion bosses do. Cards come in the floor's color.</p>
  <p>Up to about 100 floors above your deepest, a strong hunter kills at the sweep limit. Near your deepest it slows down a lot.</p>
  ${h2('Coming home')}
  <p>A hunter stays out up to ${TRIP_HOURS} hours, time away included, then comes home on its own. You can call one home sooner from the ladder. Before ascending or awakening you call everyone home yourself. Each hunter brings what it found so far.</p>`;

export const COLLECTION_PAGES: Page[] = [
  { id: 'cards', group: 'Collections', title: 'Cards', summary: 'Drop chances, colors, gold cards and every card.', body: cardsBody },
  { id: 'expeditions', group: 'Collections', title: 'Expeditions', summary: 'Sending companions to hunt cards on a floor you choose.', body: tripsBody },
  { id: 'trophies', group: 'Collections', title: 'Trophies', summary: `Every trophy and cursor. Each trophy is +1% damage.`, body: trophiesBody },
];

