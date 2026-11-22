import { ABILITIES, ABILITY_BY_ID, ABILITY_BY_UPGRADE, COMPS, LEGENDS, LEVEL_BONUS, UPGRADES, levelMult, type AbilityId, type Attack, type CompDef, type UpgDef } from '../../game/data.ts';
import {
  AUTO_BASE, AUTO_HIRE_ASCENTS, BASE_CRIT, BASE_CRIT_MULT, CLEAVE_BASE, CLICK_DPS, DRUMS_CRIT, FEVER_CLICKS, FEVER_TIME, FLURRY_RATE, IDLE_AFTER, MANUAL_RATE, MARK_POWER,
  RAMPAGE_EXTEND, RAMPAGE_STEPS, RAMPAGE_TIERS, REBUY_GAP, REVEAL_AT, STREAK_CAP, STREAK_GAP, TUNE,
} from '../../game/game.ts';
import { fmt } from '../../game/format.ts';
import { decimal, int, t, type UiKey } from '../../i18n/index.ts';
import { esc, h2, infobox, link, pct, seconds, secs, splitTables, table, toc } from '../kit.ts';
import { spr } from '../sprites.ts';
import type { Page } from '../pages.ts';

const traitsOf = (i: number) => UPGRADES.filter((u) => u.req.t === 'owned' && u.req.comp === i);
const traitLevel = (u: UpgDef) => (u.req.t === 'owned' ? u.req.n : 0);
const traitText = (u: UpgDef) => {
  const ability = ABILITY_BY_UPGRADE.get(u.id);
  return ability ? t('wiki.comp.unlocks', { ability: link('abilities', ability.name, ability.id) }) : esc(u.desc);
};
const compId = (c: CompDef) => `companion-${c.id}`;
const abilityName = (id: AbilityId) => ABILITY_BY_ID.get(id)!.name;

const levelCost = (c: CompDef, lv: number) => c.cost * TUNE.costGrowth ** (lv - 1);
const totalCost = (c: CompDef, lv: number) => (c.cost * (TUNE.costGrowth ** lv - 1)) / (TUNE.costGrowth - 1);
const baseDamage = (c: CompDef, lv: number) => c.dps * lv * levelMult(lv);
const costGrowth = () => decimal(TUNE.costGrowth, 3);

/** A companion's kind of attack, shown on its page. */
const ATTACK = {
  arrow: 'wiki.comp.attack.arrow',
  bolt: 'wiki.comp.attack.bolt',
  storm: 'wiki.comp.attack.storm',
  slash: 'wiki.comp.attack.slash',
  fire: 'wiki.comp.attack.fire',
  rune: 'wiki.comp.attack.rune',
  dark: 'wiki.comp.attack.dark',
  knife: 'wiki.comp.attack.knife',
  spear: 'wiki.comp.attack.spear',
  bomb: 'wiki.comp.attack.bomb',
  orb: 'wiki.comp.attack.orb',
  ice: 'wiki.comp.attack.ice',
  flask: 'wiki.comp.attack.flask',
  bat: 'wiki.comp.attack.bat',
  skull: 'wiki.comp.attack.skull',
  light: 'wiki.comp.attack.light',
} as const satisfies Record<Attack, UiKey>;

const LEVELS = [[1, 10, 25, 50, 75, 100, 125, 150], [175, 200, 225, 250, 300, 400, 500, 1000]];

function companionPage(c: CompDef, i: number): Page {
  const traits = traitsOf(i);
  return {
    id: compId(c), parent: 'companions', group: 'party', title: c.name, summary: c.flavor,
    body: () => `${infobox(spr(c.sprite, 96), [
      [t('wiki.comp.hire'), t('wiki.comp.hire.gold', { gold: fmt(c.cost) })],
      [t('wiki.comp.damage'), t('wiki.comp.damage.level', { damage: fmt(c.dps) })],
      [t('wiki.comp.attack'), t(ATTACK[c.attack])],
      [t('wiki.comp.upgrades'), String(traits.length)],
    ], c.flavor)}
      <p class="lede">${esc(c.flavor)}</p>
      ${h2(['upgrades', t('wiki.comp.h.upgrades')])}
      <p>${t('wiki.comp.upgrades.p', { name: c.name })}</p>
      ${table([{ h: t('wiki.comp.upgrades.level'), cls: 'c' }, t('wiki.comp.upgrades.upgrade'), { h: t('wiki.comp.upgrades.cost'), cls: 'num' }, t('wiki.comp.upgrades.effect')], traits.map((u) => [`<b>${traitLevel(u)}</b>`, esc(u.name), fmt(u.cost), traitText(u)]))}
      ${h2(['levels', t('wiki.comp.h.levels')])}
      <p>${t('wiki.comp.levels', { growth: costGrowth(), damage: fmt(c.dps), mult: LEVEL_BONUS.mult, every: LEVEL_BONUS.every, from: LEVEL_BONUS.from, thousand: LEVEL_BONUS.thousand })}</p>
      ${splitTables([{ h: t('wiki.comp.levels.lvl'), cls: 'c' }, { h: t('wiki.comp.levels.cost'), cls: 'num' }, { h: t('wiki.comp.levels.total'), cls: 'num' }, { h: t('wiki.comp.levels.damage'), cls: 'num' }],
        LEVELS.map((levels) => levels.map((lv) => [`<b>${lv}</b>`, fmt(levelCost(c, lv)), fmt(totalCost(c, lv)), fmt(baseDamage(c, lv))])))}
      <div class="clear"></div>`,
  };
}

const COMPANIONS = {
  roster: ['the-roster', t('wiki.companions.h.roster')],
  hiring: ['hiring-and-leveling', t('wiki.companions.h.hiring')],
  milestones: ['level-milestones', t('wiki.companions.h.milestones')],
  hero: ['your-hero', t('wiki.companions.h.hero')],
  marks: ['heartmarks', t('wiki.companions.h.marks')],
} as const;

const companionsBody = () => `<p class="lede">${t('wiki.companions.lede')}</p>
  ${toc('companions', [COMPANIONS.roster, COMPANIONS.hiring, COMPANIONS.milestones, COMPANIONS.hero, COMPANIONS.marks])}
  ${h2(COMPANIONS.roster)}
  ${table([t('wiki.companions.roster.companion'), { h: t('wiki.companions.roster.hire'), cls: 'num' }, { h: t('wiki.companions.roster.damage'), cls: 'num' }, { h: t('wiki.companions.roster.upgrades'), cls: 'c' }], COMPS.map((c, i) => [
    `<a class="who" href="#/${compId(c)}">${spr(c.sprite, 28)}${c.name}</a>`, fmt(c.cost), fmt(c.dps), traitsOf(i).length,
  ]))}
  ${h2(COMPANIONS.hiring)}
  <p>${t('wiki.companions.hiring', { growth: costGrowth(), reveal: pct(REVEAL_AT, 0) })}</p>
  <p>${t('wiki.companions.buttons')}</p>
  ${table([t('wiki.companions.buttons.button'), t('wiki.companions.buttons.buys')], [
    ['×1, ×10, ×100', t('wiki.companions.buttons.many')],
    [t('wiki.companions.buttons.next'), t('wiki.companions.buttons.next.buys')],
    [t('wiki.companions.buttons.max'), t('wiki.companions.buttons.max.buys')],
  ])}
  ${h2(COMPANIONS.milestones)}
  <p>${t('wiki.companions.milestones', { from: LEVEL_BONUS.from, every: LEVEL_BONUS.every, mult: LEVEL_BONUS.mult, thousand: LEVEL_BONUS.thousand, at250: levelMult(250) })}</p>
  ${splitTables([{ h: t('wiki.companions.milestones.level'), cls: 'c' }, { h: t('wiki.companions.milestones.damage'), cls: 'num' }], [[200, 225, 250, 275, 300, 400, 500].map((lv) => [`<b>${lv}</b>`, fmt(levelMult(lv))]), [750, 1000, 1500, 2000, 3000].map((lv) => [`<b>${lv}</b>`, fmt(levelMult(lv))])])}
  ${h2(COMPANIONS.hero)}
  <p>${t('wiki.companions.hero')}</p>
  ${h2(COMPANIONS.marks)}
  <p>${t('wiki.companions.marks', { power: pct(MARK_POWER, 0), heartmarks: link('heartmarks', t('wiki.companions.marks.link')) })}</p>`;

/** The companions whose traits add to a crit stat, and the total they add. */
function critTraits(stat: 'chance' | 'add') {
  const traits = UPGRADES.filter((u) => u.effect.t === 'crit' && u.effect[stat]);
  const names = COMPS.filter((_, i) => traits.some((u) => u.req.t === 'owned' && u.req.comp === i)).map((c) => c.name).join(', ');
  return { names, total: traits.reduce((sum, u) => sum + (u.effect.t === 'crit' ? u.effect[stat] ?? 0 : 0), 0) };
}
const critChance = critTraits('chance');
const critDamage = critTraits('add');

const ATTACKS = {
  damage: ['attack-damage', t('wiki.attacks.h.damage')],
  crits: ['critical-hits', t('wiki.attacks.h.crits')],
  streaks: ['streaks', t('wiki.attacks.h.streaks')],
  idle: ['idle', t('wiki.attacks.h.idle')],
} as const;

const attacksBody = () => `<p class="lede">${t('wiki.attacks.lede')}</p>
  ${toc('attacks', [ATTACKS.damage, ATTACKS.crits, ATTACKS.streaks, ATTACKS.idle])}
  ${h2(ATTACKS.damage)}
  <p>${t('wiki.attacks.damage', {
    share: pct(CLICK_DPS, 0), count: UPGRADES.filter((u) => u.effect.t === 'clickDps').length,
    fist: link('spirit-fist', t('wiki.attacks.damage.fist')), goblin: link('goblins', t('wiki.attacks.damage.goblin')),
  })}</p>
  <p>${t('wiki.attacks.rate', { count: MANUAL_RATE })}</p>
  ${h2(ATTACKS.crits)}
  <p>${t('wiki.attacks.crits', { chance: pct(BASE_CRIT, 0), mult: BASE_CRIT_MULT })}</p>
  ${table([t('wiki.attacks.crits.source'), t('wiki.attacks.crits.chance'), t('wiki.attacks.crits.damage')], [
    [t('wiki.attacks.crits.base'), pct(BASE_CRIT, 0), `×${BASE_CRIT_MULT}`],
    [t('wiki.attacks.crits.upgrades', { companions: critChance.names }), t('wiki.attacks.crits.upgrades.chance', { chance: pct(critChance.total, 0) }), ''],
    [t('wiki.attacks.crits.upgrades', { companions: critDamage.names }), '', t('wiki.attacks.crits.upgrades.damage', { add: decimal(critDamage.total, 2) })],
    [abilityName('drums'), t('wiki.attacks.crits.drums', { chance: pct(DRUMS_CRIT, 0) }), ''],
    [link('spirit-needle', t('wiki.attacks.crits.needle')), t('wiki.attacks.crits.needle.chance'), ''],
    [link('spirit-breaker', t('wiki.attacks.crits.breaker')), '', t('wiki.attacks.crits.breaker.damage')],
  ])}
  ${h2(ATTACKS.streaks)}
  <p>${t('wiki.attacks.streaks', { gap: STREAK_GAP, cap: int(STREAK_CAP), unbroken: link('spirit-unbroken', t('wiki.attacks.streaks.unbroken')) })}</p>
  ${h2(ATTACKS.idle)}
  <p>${t('wiki.attacks.idle', { count: IDLE_AFTER, sleeper: link('spirit-sleeper', t('wiki.attacks.idle.sleeper')), patient: link('spirit-patient', t('wiki.attacks.idle.patient')) })}</p>`;

const ABILITY_KIND = { passive: 'wiki.abilities.kind.passive', charge: 'wiki.abilities.kind.charge', button: 'wiki.abilities.kind.button' } as const;

const abilitiesBody = () => {
  const spiritFor = (id: string) => LEGENDS.find((d) => d.lengthens?.ability === id);
  const brawler = COMPS[ABILITY_BY_ID.get('rampage')!.comp];
  return `<p class="lede">${t('wiki.abilities.lede')}</p>
    ${table([t('wiki.abilities.ability'), t('wiki.abilities.unlockedBy'), t('wiki.abilities.kind'), t('wiki.abilities.lasts'), t('wiki.abilities.cooldown'), t('wiki.abilities.longer')], ABILITIES.map((a) => {
      const c = COMPS[a.comp];
      const u = UPGRADES.find((x) => x.id === `m${a.comp}_${a.trait}`)!;
      const spirit = spiritFor(a.id);
      return [`<b id="${a.id}">${a.name}</b>`, `<span class="who">${spr(c.sprite, 22)}${t('wiki.abilities.unlockedBy.cell', { name: c.name, level: traitLevel(u) })}</span>`,
        t(ABILITY_KIND[a.kind]),
        a.id === 'rampage' ? seconds(FEVER_TIME) : a.dur ? seconds(a.dur) : '—', a.cooldown ? secs(a.cooldown) : '—',
        spirit ? t('wiki.abilities.longer.cell', { spirit: link(`spirit-${spirit.id}`, spirit.name), seconds: seconds(spirit.lengthens!.secs) }) : '—'];
    }))}
    ${h2(['what-each-one-does', t('wiki.abilities.h.what')])}
    ${table([t('wiki.abilities.ability'), t('wiki.abilities.effect')], [
      [abilityName('blade'), t('wiki.abilities.blade', { count: AUTO_BASE })],
      [abilityName('flurry'), t('wiki.abilities.flurry', { count: FLURRY_RATE })],
      [abilityName('crit'), t('wiki.abilities.crit', { attacks: link('attacks', t('wiki.abilities.crit.attacks'), 'critical-hits') })],
      [abilityName('rampage'), t('wiki.abilities.rampage')],
      [abilityName('cleave'), t('wiki.abilities.cleave', { share: pct(CLEAVE_BASE, 0) })],
      [abilityName('treasure'), t('wiki.abilities.treasure')],
      [abilityName('drums'), t('wiki.abilities.drums', { chance: pct(DRUMS_CRIT, 0) })],
      [abilityName('legion'), t('wiki.abilities.legion')],
    ])}
    <p>${t('wiki.abilities.restless', { restless: link('spirit-restless', t('wiki.abilities.restless.link')) })}</p>
    ${h2(['rampage', t('wiki.abilities.h.rampage')])}
    <p>${t('wiki.abilities.rampage.meter', { count: FEVER_CLICKS, mult: RAMPAGE_TIERS[0], seconds: FEVER_TIME })}</p>
    <p>${t('wiki.abilities.rampage.climb', { count: RAMPAGE_STEPS[0], mult: RAMPAGE_TIERS[1], seconds: RAMPAGE_EXTEND })}</p>
    ${table([t('wiki.abilities.rampage.upgrade', { name: brawler.name }), t('wiki.abilities.effect')], [
      [t('wiki.abilities.rampage.level', { level: 75 }), t('wiki.abilities.rampage.fills')],
      [t('wiki.abilities.rampage.level', { level: 100 }), t('wiki.abilities.rampage.lasts')],
      [t('wiki.abilities.rampage.level', { level: 125 }), t('wiki.abilities.rampage.both')],
    ])}
    <p>${t('wiki.abilities.lingering', { lingering: link('spirit-lingering', t('wiki.abilities.lingering.link')) })}</p>`;
};

const UPGRADE_KINDS = [
  ['wiki.upgrades.kind.comp', 'wiki.upgrades.kind.comp.effect', (u: UpgDef) => u.effect.t === 'comp'],
  ['wiki.upgrades.kind.party', 'wiki.upgrades.kind.party.effect', (u: UpgDef) => u.effect.t === 'party'],
  ['wiki.upgrades.kind.click', 'wiki.upgrades.kind.click.effect', (u: UpgDef) => u.effect.t === 'clickDps'],
  ['wiki.upgrades.kind.gold', 'wiki.upgrades.kind.gold.effect', (u: UpgDef) => u.effect.t === 'gold'],
  ['wiki.upgrades.kind.boss', 'wiki.upgrades.kind.boss.effect', (u: UpgDef) => u.effect.t === 'boss'],
  ['wiki.upgrades.kind.blade', 'wiki.upgrades.kind.blade.effect', (u: UpgDef) => u.effect.t === 'auto'],
  ['wiki.upgrades.kind.critChance', 'wiki.upgrades.kind.critChance.effect', (u: UpgDef) => u.effect.t === 'crit' && !!u.effect.chance],
  ['wiki.upgrades.kind.critDamage', 'wiki.upgrades.kind.critDamage.effect', (u: UpgDef) => u.effect.t === 'crit' && !!u.effect.add],
  ['wiki.upgrades.kind.cleave', 'wiki.upgrades.kind.cleave.effect', (u: UpgDef) => u.effect.t === 'cleave'],
  ['wiki.upgrades.kind.rampage', 'wiki.upgrades.kind.rampage.effect', (u: UpgDef) => u.effect.t === 'fever'],
  ['wiki.upgrades.kind.ability', 'wiki.upgrades.kind.ability.effect', (u: UpgDef) => u.effect.t === 'skill'],
] as const;

const traitsBody = () => `<p class="lede">${t('wiki.upgrades.lede')}</p>
    ${h2(['kinds-of-upgrade', t('wiki.upgrades.h.kinds')])}
    ${table([t('wiki.upgrades.kind'), t('wiki.upgrades.effect'), { h: t('wiki.upgrades.count'), cls: 'c' }], UPGRADE_KINDS.map(([kind, effect, is]) => [`<b>${t(kind)}</b>`, t(effect), UPGRADES.filter(is).length]))}
    <p>${t('wiki.upgrades.costs', { companions: link('companions', t('wiki.upgrades.costs.companions')) })}</p>
    ${h2(['auto-buy', t('wiki.upgrades.h.auto')])}
    <p>${t('wiki.upgrades.auto', { gap: decimal(REBUY_GAP, 2) })}</p>
    <p>${t('wiki.upgrades.autoLevels', { ascents: AUTO_HIRE_ASCENTS })}</p>`;

export const PARTY_PAGES: Page[] = [
  { id: 'companions', group: 'party', title: t('wiki.page.companions'), summary: t('wiki.page.companions.summary'), body: companionsBody },
  { id: 'attacks', group: 'party', title: t('wiki.page.attacks'), summary: t('wiki.page.attacks.summary'), body: attacksBody },
  { id: 'abilities', group: 'party', title: t('wiki.page.abilities'), summary: t('wiki.page.abilities.summary'), body: abilitiesBody },
  { id: 'upgrades', group: 'party', title: t('wiki.page.upgrades'), summary: t('wiki.page.upgrades.summary'), body: traitsBody },
  ...COMPS.map(companionPage),
];
