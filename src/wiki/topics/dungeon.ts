import { CLUTCH_SECONDS, CORRUPTION, MODS, ZONES, modsFor, zoneName, type MonsterDef } from '../../game/data.ts';
import {
  BOSS_RESPAWN, BOSS_TIME, CHAMP_BOSS_CHANCE, CHAMP_BOSS_GOLD, CHAMP_BOSS_HP, CHAMP_CHANCE, CHAMP_FLOOR, CHAMP_GOLD, CHAMP_HP, CLUTCH_GOLD,
  DESCEND_FLOOR, DOWNED_SECONDS, FLOOR_KILLS, GOLD_BOSS_SURE, GOLD_WAIT, MAX_DROPS, MAX_ON, RAID_MAX, RAID_MIN, RAID_STAY, RAINBOW_CHANCE,
  RAINBOW_HAUL, TRASH, TUNE, VAULT_ALL_BONUS, VAULT_CHANCE, VAULT_CHESTS, VAULT_COIN_SHARE, VAULT_COINS, VAULT_GOBLINS, VAULT_PAY,
  bossSouls, floorGold, floorHp,
} from '../../game/game.ts';
import { fmt } from '../../game/format.ts';
import { h2, h3, link, pct, range, secs, splitTables, table, toc } from '../kit.ts';
import { spr } from '../sprites.ts';
import type { Page } from '../pages.ts';

const who = (m: MonsterDef, box = 26) => `<span class="who">${spr(m.sprite, box)}${m.name}</span>`;

/** A boss's health before modifiers and Spirits (bosses below the way up have half). */
function bossHp(f: number) {
  const tough = TUNE.bossHpFrom + (TUNE.bossHp - TUNE.bossHpFrom) * Math.min(1, (f - 1) / TUNE.bossRamp);
  return floorHp(f).times(tough * (f < DESCEND_FLOOR ? 0.5 : 1));
}

const SAMPLE_FLOORS = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 125, 150, 200, 250, 300, 400, 500];

const floorsBody = () => `<p class="lede">The dungeon is a stack of floors. Each floor needs ${FLOOR_KILLS} kills to clear, every fifth floor is a boss, and every ten floors is a new zone.</p>
  ${toc('floors', ['Clearing floors', 'Zones', 'Laps and corruption', 'Monster health and gold', 'Auto and farming', 'Sweeping'])}
  ${h2('Clearing floors')}
  <p>Kill ${FLOOR_KILLS} monsters on a floor to open the next one (${link('spirit-thinning', 'the Thinning')} lowers this to as few as 10). Up to ${MAX_ON} monsters are on the floor at once, and new ones keep arriving.</p>
  <p>Floors ending in 5 hold a mid-boss and floors ending in 0 a zone boss. A boss comes alone and has to die before its timer runs out. See ${link('bosses', 'Bosses')}.</p>
  <p>Your kills on your deepest floor are kept if you step back to farm, so you pick up where you left off. Kills on any other floor start over.</p>
  ${h2('Zones')}
  <p>Every ten floors is a zone with its own look, crowd and bosses. There are ${ZONES.length} zones; after the last one they come round again, darker.</p>
  ${table([{ h: '#', cls: 'c' }, 'Zone', 'Floors', 'Crowd', 'Mid-boss (floor 5)', 'Zone boss (floor 10)'], ZONES.map((z, i) => [
    i + 1, `<b>${z.name}</b>`, `${i * 10 + 1}–${i * 10 + 10}`,
    z.band.map((m) => spr(m.sprite, 22)).join(' '), who(z.mid), who(z.boss),
  ]))}
  <p>See ${link('monsters', 'Monsters')} for every monster by name.</p>
  ${h2('Laps and corruption')}
  <p>One pass through all ${ZONES.length} zones is a lap of ${ZONES.length * 10} floors. Each new lap brings the zones back washed in a new color, built from a different tileset, with newcomers joining two of the zone's original crowd.</p>
  ${table(['Lap', 'Floors', 'Zone names'], CORRUPTION.map((c, lap) => [
    `<b>${lap ? c.name : 'Plain'}</b>`, `${lap * 80 + 1}–${lap === CORRUPTION.length - 1 ? '…' : (lap + 1) * 80}`, zoneName(lap * 80 + 1),
  ]))}
  <p>Past the ${CORRUPTION[CORRUPTION.length - 1].name} lap the names keep the last color and add a numeral: II, III and so on.</p>
  ${h2('Monster health and gold')}
  <p>Health grows ×${TUNE.hpBase} a floor up to floor ${TUNE.deepFrom}, then ×${TUNE.deepHp} a floor with a slow extra creep. Gold grows ×${TUNE.goldGrowth} a floor to ${TUNE.deepFrom}, then ×${TUNE.deepGold}. An ordinary monster has ${pct(TRASH, 0)} of the floor's health (each kind a little more or less), and a boss pays 20 monsters' worth of gold, a whole floor.</p>
  <code class="formula">floor health (f ≤ 100) = 10 × (f − 1 + ${TUNE.hpBase}^(f − 1))
floor health (f > 100) = floor health(100) × ${TUNE.deepHp}^n × e^(${TUNE.hpCreep} × n² / 200), n = f − 100
floor gold (f ≤ 100)   = ${TUNE.goldGrowth}^(f − 1)
floor gold (f > 100)   = floor gold(100) × ${TUNE.deepGold}^(f − 100)</code>
  ${table([{ h: 'Floor', cls: 'c' }, { h: 'Monster health', cls: 'num' }, { h: 'Boss health', cls: 'num' }, { h: 'Monster gold', cls: 'num' }, { h: 'Boss gold', cls: 'num' }],
    SAMPLE_FLOORS.map((f) => [`<b>${f}</b>`, fmt(floorHp(f).times(TRASH)), fmt(bossHp(f)), fmt(floorGold(f).times(TRASH)), fmt(floorGold(f).times(8))]))}
  <p class="muted">Before gold bonuses, Spirits and boss modifiers. Boss health is shown on every row for comparison; bosses only appear on floors ending in 5 or 0.</p>
  ${h2('Auto and farming')}
  <p>With auto on (the default) you move to the next floor as soon as one is cleared or its boss falls. Turn it off to stay and farm a floor: monsters keep coming, and a beaten boss comes back after ${BOSS_RESPAWN}s. Failing a boss turns auto off. You can jump to any floor you've opened.</p>
  ${h2('Sweeping')}
  <p>When your party is strong enough to kill a whole floor in about a second, it sweeps it: everything on screen dies, the rest of the floor's gold is paid at once, a card is rolled for every kill, and you move on. Sweeping only happens with auto on, on ordinary floors you haven't cleared.</p>`;

const monstersBody = () => {
  const rows = ZONES.flatMap((z, i) => [
    [`<b>${z.name}</b>`, `${i * 10 + 1}–${i * 10 + 10}`, z.band.map((m) => `${who(m, 22)}${m.hp !== 1 ? ` <span class="muted">×${m.hp}</span>` : ''}`).join('<br>'),
      z.lap.map((m) => who(m, 22)).join('<br>'), `${who(z.mid)}<br>${who(z.boss)}`],
  ]);
  return `<p class="lede">Every zone has a crowd of ordinary monsters, a mid-boss and a zone boss. From the second lap, newcomers push in alongside two of the original crowd.</p>
    <p>Half the monsters on an ordinary floor are that floor's featured monster; the rest are anyone from the zone's crowd. A number like ×1.2 is that monster's health against the floor's usual.</p>
    ${table(['Zone', 'Floors', 'Crowd', 'Newcomers (lap 2 on)', 'Mid-boss / zone boss'], rows)}
    ${h2('Champions')}
    <p>From floor ${CHAMP_FLOOR} (or after your first ascent), any monster has a ${pct(CHAMP_CHANCE, 0)} chance to arrive as a gold champion: ×${CHAMP_HP} health and ×${CHAMP_GOLD} gold, and it can drop a gold card. Champion bosses are on the ${link('bosses', 'Bosses', 'Champion bosses')} page.</p>`;
};

const SCHEDULE = range(30, 250, 5).filter((f) => modsFor(f).length);

const bossesBody = () => `<p class="lede">Every fifth floor is a boss fight against the clock. Beat it to go on; run out of time and you're knocked back a floor.</p>
  ${toc('bosses', ['The timer', 'Losing a fight', 'Modifiers', 'Modifier schedule', 'Champion bosses', 'Souls from champion bosses'])}
  ${h2('The timer')}
  <p>Every boss gives you ${BOSS_TIME} seconds, counted from when it appears. ${link('spirit-hourglass', 'The Hourglass')} adds up to 30 more. Giants and Enraged bosses change it (below).</p>
  <p>Beat a boss with ${CLUTCH_SECONDS} seconds or less left and it pays +${pct(CLUTCH_GOLD - 1, 0)} gold: a clutch kill.</p>
  <p>Bosses below floor ${DESCEND_FLOOR} have half health. Mid-bosses and zone bosses have the same health; they differ in their modifiers.</p>
  ${h2('Losing a fight')}
  <p>When the timer runs out your party is downed for ${DOWNED_SECONDS} seconds: nobody can attack and abilities can't be used. Then you drop back a floor and auto turns off, so you can farm until you're stronger.</p>
  ${h2('Modifiers')}
  <p>From floor 30, zone bosses bring modifiers: one from 30, two from 60, three from 120 and four from 200. Mid-bosses join from 55: one from 55, two from 120 and three from 200. A floor always has the same ones.</p>
  ${table(['Modifier', 'Effect'], MODS.map((m) => [`<b style="color:${m.color}">${m.name}</b>`, m.desc]))}
  <p>Armor only stops companion damage: your clicks, the Phantom Blade and Cleave hit Armored bosses in full.</p>
  ${h2('Modifier schedule')}
  ${splitTables([{ h: 'Floor', cls: 'c' }, 'Modifiers'], [SCHEDULE.slice(0, Math.ceil(SCHEDULE.length / 2)), SCHEDULE.slice(Math.ceil(SCHEDULE.length / 2))]
    .map((floors) => floors.map((f) => [`<b>${f}</b>`, modsFor(f).map((id) => { const m = MODS.find((d) => d.id === id)!; return `<span style="color:${m.color}">${m.name}</span>`; }).join(', ')])))}
  ${h2('Champion bosses')}
  <p>Champion bosses are gold, nearly twice the size, and come with a soul tag.</p>
  ${h3('Before floor 100')}
  <p>Once champions have started (floor ${CHAMP_FLOOR} or your first ascent), a boss on a floor you've already passed has a 1 in ${Math.round(1 / CHAMP_BOSS_CHANCE)} chance to come as a champion: ×${CHAMP_BOSS_HP} health, 50% more time and ×${CHAMP_BOSS_GOLD} gold. These drop no souls.</p>
  ${h3('Floor 100 and deeper')}
  <p>From floor ${TUNE.goldBossFrom}, each boss is rolled once per run: ${pct(TUNE.goldBossChance, 0)} of them are champions (${link('spirit-soulcaller', 'the Soulcaller')} raises this), and floors 100, 110, 120, 130 and every 50th floor always are. They have normal health and time, and drop souls the first time you beat them each run. A champion you fail against stays a champion until you beat it.</p>
  ${h2('Souls from champion bosses')}
  <code class="formula">souls = max(1, floor(((floor − 75) / 25)^1.3)), at least 2 on the sure floors</code>
  ${splitTables([{ h: 'Floor', cls: 'c' }, { h: 'Souls', cls: 'num' }], [
    [100, 105, 110, 120, 125, 130, 135, 140, 150, 160].map((f) => [`<b>${f}</b>${GOLD_BOSS_SURE(f) ? ' <span class="muted">sure</span>' : ''}`, bossSouls(f)]),
    [175, 200, 225, 250, 275, 300, 350, 400, 450, 500].map((f) => [`<b>${f}</b>${GOLD_BOSS_SURE(f) ? ' <span class="muted">sure</span>' : ''}`, bossSouls(f)]),
  ])}
  <p>Souls from champion bosses are paid when you ${link('souls', 'ascend')}.</p>`;

const goldBody = () => `<p class="lede">Gold buys companion levels and traits. Every kill drops some, bosses drop a floor's worth, and treasure goblins drop a lot.</p>
  ${h2('Picking it up')}
  <p>A kill's gold drops on the floor as a pile. It banks itself after ${GOLD_WAIT} seconds, or straight away when your hero or your cursor passes near it. At most ${MAX_DROPS} piles lie around at once (the oldest banks itself), and leaving a floor or ascending banks everything.</p>
  ${h2('Gold bonuses')}
  ${table(['Source', 'Bonus'], [
    ['Gold traits (Shadow Thief ×2, Corsair Captain ×2, Exiled King ×2)', '+50% each, added together (up to +300%)'],
    [link('spirit-hoard', 'The Hoard'), '+5% a level'],
    [link('spirit-patient', 'The Patient'), '+50% a level while idle'],
    [link('abilities', 'Treasure Sense'), '×3 for 30 seconds'],
    [link('goblins', 'Gold Rush'), '×7 for 30 seconds'],
    ['Champions', '×10 from that monster'],
    ['Clutch boss kill', `+${pct(CLUTCH_GOLD - 1, 0)} from that boss`],
  ])}
  <p>See ${link('floors', 'Floors', 'Monster health and gold')} for how much each floor pays.</p>`;

const goblinsBody = () => `<p class="lede">Now and then a treasure goblin runs across the floor with a sack of loot. Catch it before it gets away.</p>
  ${toc('goblins', ['When they come', 'What a goblin drops', 'Rainbow goblins', 'The Rainbow Vault'])}
  ${h2('When they come')}
  <p>Goblins start once you've made a few kills. After that one comes every ${secs(RAID_MIN)} to ${secs(RAID_MAX)}, and it takes ${RAID_STAY} seconds to cross the floor. ${link('spirit-lure', 'The Lure')} brings them up to three times as often.</p>
  ${h2('What a goblin drops')}
  ${table(['Reward', 'Chance', 'What you get'], [
    ['<b>Plunder</b>', '40%', 'A pile of gold: 10 to 20 times the floor\'s gold (about 25 to 50 kills\' worth)'],
    ['<b>Bloodlust</b>', '25%', 'Your party deals ×7 damage for 7 seconds'],
    ['<b>Frenzy</b>', '20%', 'Your attacks deal ×77 damage for 10 seconds'],
    ['<b>Gold Rush</b>', '15%', 'All gold ×7 for 30 seconds'],
  ])}
  <p>Every goblin you catch can also drop its card. ${link('spirit-goblinking', 'The Wish')} boosts goblin gold.</p>
  ${h2('Rainbow goblins')}
  <p>After your first catch, ${pct(RAINBOW_CHANCE, 1)} of goblins are rainbow goblins. Catching one opens the Rainbow Vault: always the first time, and after that with a ${pct(VAULT_CHANCE, 0)} chance. Otherwise it drops a Rainbow Haul of ${RAINBOW_HAUL * 10} to ${RAINBOW_HAUL * 20} times the floor's gold.</p>
  ${h2('The Rainbow Vault')}
  <p>A hall of treasure away from the fight. Choose which companion goes in; the floor waits for you, and the boss timer stops. There's no timer inside. Leave by the portal at the end.</p>
  ${table(['Inside', 'Worth'], [
    [`${VAULT_CHESTS} chests (2 or 3 of them Rainbow Chests, worth 10 ordinary ones)`, `${VAULT_PAY * TRASH} times the floor's gold, shared out`],
    ['Open every chest', `+${pct(VAULT_ALL_BONUS, 0)} of the chests' gold`],
    [`${VAULT_COINS} loose coins`, `${pct(VAULT_COIN_SHARE, 0)} more on top`],
    [`${VAULT_GOBLINS} goblins and 1 or 2 rainbow goblins`, 'Extra gold each'],
  ])}`;

export const DUNGEON_PAGES: Page[] = [
  { id: 'floors', group: 'The dungeon', title: 'Floors and zones', summary: 'Clearing floors, zones, laps, health and gold by floor.', body: floorsBody },
  { id: 'monsters', group: 'The dungeon', title: 'Monsters', summary: 'Every zone\'s crowd, newcomers and bosses.', body: monstersBody },
  { id: 'bosses', group: 'The dungeon', title: 'Bosses', summary: 'Boss timers, modifiers, champion bosses and their souls.', body: bossesBody },
  { id: 'gold', group: 'The dungeon', title: 'Gold', summary: 'Picking up gold and every gold bonus.', body: goldBody },
  { id: 'goblins', group: 'The dungeon', title: 'Treasure goblins', summary: 'Goblins, their rewards, rainbow goblins and the Rainbow Vault.', body: goblinsBody },
];
