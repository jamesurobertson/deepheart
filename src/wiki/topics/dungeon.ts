import { CLUTCH_SECONDS, COMPS, CORRUPTION, MODS, UPGRADES, ZONES, modsFor, zoneName, type MonsterDef } from '../../game/data.ts';
import {
  BOSS_RESPAWN, BOSS_TIME, CHAMP_BOSS_CHANCE, CHAMP_BOSS_GOLD, CHAMP_BOSS_HP, CHAMP_CHANCE, CHAMP_FLOOR, CHAMP_GOLD, CHAMP_HP, CLUTCH_GOLD,
  DESCEND_FLOOR, DOWNED_SECONDS, FLOOR_KILLS, GOLD_BOSS_SURE, GOLD_WAIT, MAX_DROPS, MAX_ON, RAID_MAX, RAID_MIN, RAID_STAY, RAINBOW_CHANCE,
  RAINBOW_HAUL, TRASH, TUNE, VAULT_ALL_BONUS, VAULT_CHANCE, VAULT_CHESTS, VAULT_COIN_SHARE, VAULT_COINS, VAULT_GOBLINS, VAULT_PAY,
  bossSouls, floorGold, floorHp,
} from '../../game/game.ts';
import { fmt } from '../../game/format.ts';
import { decimal, t } from '../../i18n/index.ts';
import { h2, h3, link, pct, range, secs, splitTables, table, toc } from '../kit.ts';
import { spr } from '../sprites.ts';
import type { Page } from '../pages.ts';

const who = (m: MonsterDef, box = 26) => `<span class="who">${spr(m.sprite, box)}${m.name}</span>`;

/** A boss's health before modifiers and Spirits (bosses below the way up have half). */
function bossHp(f: number) {
  const tough = TUNE.bossHpFrom + (TUNE.bossHp - TUNE.bossHpFrom) * Math.min(1, (f - 1) / TUNE.bossRamp);
  return floorHp(f).times(tough * (f < DESCEND_FLOOR ? 0.5 : 1));
}

/** How much health or gold rises from this floor to the next. */
const hpGrowth = (f: number) => floorHp(f + 1).div(floorHp(f)).toNumber() - 1;
const goldGrowth = (f: number) => floorGold(f + 1).div(floorGold(f)).toNumber() - 1;

const SAMPLE_FLOORS = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 125, 150, 200, 250, 300, 400, 500];

const FLOORS = {
  clearing: ['clearing-floors', t('wiki.floors.h.clearing')],
  zones: ['zones', t('wiki.floors.h.zones')],
  laps: ['laps-and-corruption', t('wiki.floors.h.laps')],
  growth: ['monster-health-and-gold', t('wiki.floors.h.growth')],
  auto: ['auto-and-farming', t('wiki.floors.h.auto')],
  sweeping: ['sweeping', t('wiki.floors.h.sweeping')],
} as const;

const floorsBody = () => `<p class="lede">${t('wiki.floors.lede', { count: FLOOR_KILLS })}</p>
  ${toc('floors', [FLOORS.clearing, FLOORS.zones, FLOORS.laps, FLOORS.growth, FLOORS.auto, FLOORS.sweeping])}
  ${h2(FLOORS.clearing)}
  <p>${t('wiki.floors.clearing', { count: FLOOR_KILLS, max: MAX_ON, thinning: link('spirit-thinning', t('wiki.floors.clearing.thinning')) })}</p>
  <p>${t('wiki.floors.clearing.bosses', { bosses: link('bosses', t('wiki.floors.clearing.bosses.link')) })}</p>
  <p>${t('wiki.floors.clearing.kept')}</p>
  ${h2(FLOORS.zones)}
  <p>${t('wiki.floors.zones', { count: ZONES.length })}</p>
  ${table([{ h: '#', cls: 'c' }, t('wiki.floors.zones.zone'), t('wiki.floors.zones.floors'), t('wiki.floors.zones.crowd'), t('wiki.floors.zones.mid'), t('wiki.floors.zones.boss')], ZONES.map((z, i) => [
    i + 1, `<b>${z.name}</b>`, `${i * 10 + 1}–${i * 10 + 10}`,
    z.band.map((m) => spr(m.sprite, 22)).join(' '), who(z.mid), who(z.boss),
  ]))}
  <p>${t('wiki.floors.zones.monsters', { monsters: link('monsters', t('wiki.floors.zones.monsters.link')) })}</p>
  ${h2(FLOORS.laps)}
  <p>${t('wiki.floors.laps', { count: ZONES.length, floors: ZONES.length * 10 })}</p>
  ${table([t('wiki.floors.laps.lap'), t('wiki.floors.laps.floors'), t('wiki.floors.laps.names')], CORRUPTION.map((c, lap) => [
    `<b>${lap ? c.name : t('wiki.lap.plain')}</b>`, `${lap * 80 + 1}–${lap === CORRUPTION.length - 1 ? '…' : (lap + 1) * 80}`, zoneName(lap * 80 + 1),
  ]))}
  <p>${t('wiki.floors.laps.after', { lap: CORRUPTION[CORRUPTION.length - 1].name })}</p>
  ${h2(FLOORS.growth)}
  <p>${t('wiki.floors.growth.hp', { early: pct(hpGrowth(50), 0), deep: TUNE.deepFrom, deepRate: pct(hpGrowth(101), 1), at501: pct(hpGrowth(501), 1), at1001: pct(hpGrowth(1001), 1) })}</p>
  <p>${t('wiki.floors.growth.gold', { early: pct(goldGrowth(50), 0), deep: TUNE.deepFrom, deepRate: pct(goldGrowth(101), 0), trash: pct(TRASH, 0) })}</p>
  ${table([{ h: t('wiki.floors.growth.floor'), cls: 'c' }, { h: t('wiki.floors.growth.monsterHp'), cls: 'num' }, { h: t('wiki.floors.growth.bossHp'), cls: 'num' }, { h: t('wiki.floors.growth.monsterGold'), cls: 'num' }, { h: t('wiki.floors.growth.bossGold'), cls: 'num' }],
    SAMPLE_FLOORS.map((f) => [`<b>${f}</b>`, fmt(floorHp(f).times(TRASH)), fmt(bossHp(f)), fmt(floorGold(f).times(TRASH)), fmt(floorGold(f).times(8))]))}
  <p class="muted">${t('wiki.floors.growth.note')}</p>
  ${h2(FLOORS.auto)}
  <p>${t('wiki.floors.auto', { respawn: secs(BOSS_RESPAWN) })}</p>
  ${h2(FLOORS.sweeping)}
  <p>${t('wiki.floors.sweeping')}</p>`;

const monstersBody = () => {
  const rows = ZONES.flatMap((z, i) => [
    [`<b>${z.name}</b>`, `${i * 10 + 1}–${i * 10 + 10}`, z.band.map((m) => `${who(m, 22)}${m.hp !== 1 ? ` <span class="muted">×${decimal(m.hp, 2)}</span>` : ''}`).join('<br>'),
      z.lap.map((m) => who(m, 22)).join('<br>'), `${who(z.mid)}<br>${who(z.boss)}`],
  ]);
  return `<p class="lede">${t('wiki.monsters.lede')}</p>
    <p>${t('wiki.monsters.featured')}</p>
    ${table([t('wiki.monsters.zone'), t('wiki.monsters.floors'), t('wiki.monsters.crowd'), t('wiki.monsters.newcomers'), t('wiki.monsters.bosses')], rows)}
    ${h2(['champions', t('wiki.monsters.h.champions')])}
    <p>${t('wiki.monsters.champions', { floor: CHAMP_FLOOR, chance: pct(CHAMP_CHANCE, 0), hp: CHAMP_HP, gold: CHAMP_GOLD, bosses: link('bosses', t('wiki.monsters.champions.bosses'), 'champion-bosses') })}</p>`;
};

const SCHEDULE = range(30, 250, 5).filter((f) => modsFor(f).length);

const BOSSES = {
  timer: ['the-timer', t('wiki.bosses.h.timer')],
  losing: ['losing-a-fight', t('wiki.bosses.h.losing')],
  mods: ['modifiers', t('wiki.bosses.h.mods')],
  schedule: ['modifier-schedule', t('wiki.bosses.h.schedule')],
  champions: ['champion-bosses', t('wiki.bosses.h.champions')],
  souls: ['souls-from-champion-bosses', t('wiki.bosses.h.souls')],
} as const;

const soulRow = (f: number) => [`<b>${f}</b>${GOLD_BOSS_SURE(f) ? ` <span class="muted">${t('wiki.bosses.souls.sure')}</span>` : ''}`, bossSouls(f)];

const bossesBody = () => `<p class="lede">${t('wiki.bosses.lede')}</p>
  ${toc('bosses', [BOSSES.timer, BOSSES.losing, BOSSES.mods, BOSSES.schedule, BOSSES.champions, BOSSES.souls])}
  ${h2(BOSSES.timer)}
  <p>${t('wiki.bosses.timer', { count: BOSS_TIME, hourglass: link('spirit-hourglass', t('wiki.bosses.timer.hourglass')) })}</p>
  <p>${t('wiki.bosses.timer.clutch', { count: CLUTCH_SECONDS, gold: pct(CLUTCH_GOLD - 1, 0) })}</p>
  <p>${t('wiki.bosses.timer.half', { floor: DESCEND_FLOOR })}</p>
  ${h2(BOSSES.losing)}
  <p>${t('wiki.bosses.losing', { seconds: decimal(DOWNED_SECONDS, 2) })}</p>
  ${h2(BOSSES.mods)}
  <p>${t('wiki.bosses.mods')}</p>
  ${table([t('wiki.bosses.mods.modifier'), t('wiki.bosses.mods.effect')], MODS.map((m) => [`<b style="color:${m.color}">${m.name}</b>`, m.desc]))}
  <p>${t('wiki.bosses.mods.armor')}</p>
  ${h2(BOSSES.schedule)}
  ${splitTables([{ h: t('wiki.bosses.schedule.floor'), cls: 'c' }, t('wiki.bosses.schedule.mods')], [SCHEDULE.slice(0, Math.ceil(SCHEDULE.length / 2)), SCHEDULE.slice(Math.ceil(SCHEDULE.length / 2))]
    .map((floors) => floors.map((f) => [`<b>${f}</b>`, modsFor(f).map((id) => { const m = MODS.find((d) => d.id === id)!; return `<span style="color:${m.color}">${m.name}</span>`; }).join(', ')])))}
  ${h2(BOSSES.champions)}
  <p>${t('wiki.bosses.champions')}</p>
  ${h3(['before-floor-100', t('wiki.bosses.h.before')])}
  <p>${t('wiki.bosses.champions.before', { floor: CHAMP_FLOOR, odds: Math.round(1 / CHAMP_BOSS_CHANCE), hp: CHAMP_BOSS_HP, gold: CHAMP_BOSS_GOLD })}</p>
  ${h3(['floor-100-and-deeper', t('wiki.bosses.h.deeper')])}
  <p>${t('wiki.bosses.champions.deeper', { floor: TUNE.goldBossFrom, chance: pct(TUNE.goldBossChance, 0), soulcaller: link('spirit-soulcaller', t('wiki.bosses.champions.soulcaller')) })}</p>
  ${h2(BOSSES.souls)}
  <p>${t('wiki.bosses.souls')}</p>
  ${splitTables([{ h: t('wiki.bosses.souls.floor'), cls: 'c' }, { h: t('wiki.bosses.souls.souls'), cls: 'num' }], [
    [100, 105, 110, 120, 125, 130, 135, 140, 150, 160].map(soulRow),
    [175, 200, 225, 250, 275, 300, 350, 400, 450, 500].map(soulRow),
  ])}
  <p>${t('wiki.bosses.souls.paid', { ascend: link('souls', t('wiki.bosses.souls.ascend')) })}</p>`;

/** Companions with gold traits, in roster order, and how many each has. */
const goldTraits = COMPS.map((c, i) => [c.name, UPGRADES.filter((u) => u.req.t === 'owned' && u.req.comp === i && u.effect.t === 'gold').length] as const).filter(([, n]) => n);

const goldBody = () => `<p class="lede">${t('wiki.gold.lede')}</p>
  ${h2(['picking-it-up', t('wiki.gold.h.pickup')])}
  <p>${t('wiki.gold.pickup', { wait: GOLD_WAIT, max: MAX_DROPS })}</p>
  ${h2(['gold-bonuses', t('wiki.gold.h.bonuses')])}
  ${table([t('wiki.gold.bonus.source'), t('wiki.gold.bonus.bonus')], [
    [t('wiki.gold.bonus.upgrades', { companions: goldTraits.map(([name, n]) => `${name} ×${n}`).join(', ') }), t('wiki.gold.bonus.upgrades.bonus', { max: pct(goldTraits.reduce((sum, [, n]) => sum + 50 * n, 0) / 100, 0) })],
    [link('spirit-hoard', t('wiki.gold.bonus.hoard')), t('wiki.gold.bonus.hoard.bonus')],
    [link('spirit-patient', t('wiki.gold.bonus.patient')), t('wiki.gold.bonus.patient.bonus')],
    [link('abilities', t('wiki.gold.bonus.treasure')), t('wiki.gold.bonus.treasure.bonus')],
    [link('goblins', t('wiki.gold.bonus.rush')), t('wiki.gold.bonus.rush.bonus')],
    [t('wiki.gold.bonus.champions'), t('wiki.gold.bonus.champions.bonus')],
    [t('wiki.gold.bonus.clutch'), t('wiki.gold.bonus.clutch.bonus', { gold: pct(CLUTCH_GOLD - 1, 0) })],
  ])}
  <p>${t('wiki.gold.floors', { floors: link('floors', t('wiki.gold.floors.link'), 'monster-health-and-gold') })}</p>`;

const GOBLINS = {
  when: ['when-they-come', t('wiki.goblins.h.when')],
  drops: ['what-a-goblin-drops', t('wiki.goblins.h.drops')],
  rainbow: ['rainbow-goblins', t('wiki.goblins.h.rainbow')],
  vault: ['the-rainbow-vault', t('wiki.goblins.h.vault')],
} as const;

const goblinsBody = () => `<p class="lede">${t('wiki.goblins.lede')}</p>
  ${toc('goblins', [GOBLINS.when, GOBLINS.drops, GOBLINS.rainbow, GOBLINS.vault])}
  ${h2(GOBLINS.when)}
  <p>${t('wiki.goblins.when', { min: secs(RAID_MIN), max: secs(RAID_MAX), stay: RAID_STAY, lure: link('spirit-lure', t('wiki.goblins.when.lure')) })}</p>
  ${h2(GOBLINS.drops)}
  ${table([t('wiki.goblins.drops.reward'), t('wiki.goblins.drops.chance'), t('wiki.goblins.drops.crits', { crits: link('abilities', t('wiki.goblins.drops.crits.link')) }), t('wiki.goblins.drops.get')], [
    [`<b>${t('wiki.goblins.plunder')}</b>`, pct(0.35, 0), pct(0.3, 0), t('wiki.goblins.plunder.get')],
    [`<b>${t('wiki.goblins.rush')}</b>`, pct(0.3, 0), pct(0.25, 0), t('wiki.goblins.rush.get')],
    [`<b>${t('wiki.goblins.bloodlust')}</b>`, pct(0.25, 0), pct(0.15, 0), t('wiki.goblins.bloodlust.get')],
    [`<b>${t('wiki.goblins.deadeye')}</b>`, '', pct(0.11, 0), t('wiki.goblins.deadeye.get')],
    [`<b>${t('wiki.goblins.brutality')}</b>`, '', pct(0.11, 0), t('wiki.goblins.brutality.get')],
    [`<b>${t('wiki.goblins.frenzy')}</b>`, pct(0.1, 0), pct(0.08, 0), t('wiki.goblins.frenzy.get')],
  ])}
  <p>${t('wiki.goblins.drops.card', { wish: link('spirit-goblinking', t('wiki.goblins.drops.wish')) })}</p>
  ${h2(GOBLINS.rainbow)}
  <p>${t('wiki.goblins.rainbow', { chance: pct(RAINBOW_CHANCE, 1), vault: pct(VAULT_CHANCE, 0), from: RAINBOW_HAUL * 10, to: RAINBOW_HAUL * 20 })}</p>
  ${h2(GOBLINS.vault)}
  <p>${t('wiki.goblins.vault')}</p>
  ${table([t('wiki.goblins.vault.inside'), t('wiki.goblins.vault.worth')], [
    [t('wiki.goblins.vault.chests', { count: VAULT_CHESTS }), t('wiki.goblins.vault.chests.worth', { times: VAULT_PAY * TRASH })],
    [t('wiki.goblins.vault.all'), t('wiki.goblins.vault.all.worth', { bonus: pct(VAULT_ALL_BONUS, 0) })],
    [t('wiki.goblins.vault.coins', { count: VAULT_COINS }), t('wiki.goblins.vault.coins.worth', { share: pct(VAULT_COIN_SHARE, 0) })],
    [t('wiki.goblins.vault.goblins', { count: VAULT_GOBLINS }), t('wiki.goblins.vault.goblins.worth')],
  ])}`;

export const DUNGEON_PAGES: Page[] = [
  { id: 'floors', group: 'dungeon', title: t('wiki.page.floors'), summary: t('wiki.page.floors.summary'), body: floorsBody },
  { id: 'monsters', group: 'dungeon', title: t('wiki.page.monsters'), summary: t('wiki.page.monsters.summary'), body: monstersBody },
  { id: 'bosses', group: 'dungeon', title: t('wiki.page.bosses'), summary: t('wiki.page.bosses.summary'), body: bossesBody },
  { id: 'gold', group: 'dungeon', title: t('wiki.page.gold'), summary: t('wiki.page.gold.summary'), body: goldBody },
  { id: 'goblins', group: 'dungeon', title: t('wiki.page.goblins'), summary: t('wiki.page.goblins.summary'), body: goblinsBody },
];
