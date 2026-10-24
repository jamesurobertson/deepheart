import Decimal from 'break_infinity.js';
import { COMPS, LEGENDS, MODS, TROPHIES, UPGRADES, legendShare, modsFor, type LegendId } from '../../game/data.ts';
import {
  BOSS_TIME, DESCEND_FLOOR, Game, MANUAL_RATE, SAVE_VERSION, STREAK_CAP, TRASH, TUNE, floorHp, newSave, type Buff, type SaveState,
} from '../../game/game.ts';
import { fmt } from '../../game/format.ts';
import { esc, h2, link } from '../kit.ts';
import { spr } from '../sprites.ts';
import type { Page } from '../pages.ts';

const SAVE_KEY = 'deepheart-save';
/** Saves hold big numbers as Decimals; a JSON round trip gives the plain form the game loads from. */
const clone = (s: SaveState): SaveState => JSON.parse(JSON.stringify(s));
const traitIds = (i: number) => UPGRADES.filter((u) => u.req.t === 'owned' && u.req.comp === i);

/** The game's own save, if this browser has one (the wiki shares the game's site). */
function loadSave(): SaveState | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as SaveState | null;
    return s?.v === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

function decodeSave(text: string): SaveState | null {
  try {
    const s = JSON.parse(decodeURIComponent(escape(atob(text.trim())))) as SaveState;
    return s?.v === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

interface Scenario {
  idle: boolean;
  streak: number;
  /** Attacks a second by hand (ignored while idle). */
  rate: number;
  /** 0 none, 1 or 2: the Rampage tier running. */
  rampage: number;
  bloodlust: boolean;
  frenzy: boolean;
  treasure: boolean;
  goldRush: boolean;
  drums: boolean;
  floor: number;
}

/** Seconds, readable from a blink to an age. */
const time = (t: number) => (t === Infinity ? 'Never' : t < 0.1 ? 'under 0.1s' : t < 1000 ? `${+t.toFixed(1)}s` : `${fmt(t)}s`);

const buff = (id: Buff['id'], dps = 1, click = 1, gold = 1): Buff => ({ id, name: id, t: 999, dur: 999, dps, click, gold });

/** A Game built from a save and a scenario, for reading numbers off (never ticked). */
function build(save: SaveState, sc: Scenario) {
  const s = clone(save);
  s.buffs = [];
  const game = new Game(s);
  if (sc.rampage) s.buffs.push(buff('fever', game.feverMult(sc.rampage - 1)));
  if (sc.bloodlust) s.buffs.push(buff('bloodlust', 7));
  if (sc.frenzy) s.buffs.push(buff('heartstorm', 1, 77));
  if (sc.treasure) s.buffs.push(buff('treasure', 1, 1, 3));
  if (sc.goldRush) s.buffs.push(buff('horde', 1, 1, 7));
  if (sc.drums) s.buffs.push(buff('drums'));
  game.sinceAttack = sc.idle ? 9999 : 0;
  game.streak = sc.idle ? 0 : sc.streak;
  game.invalidate();
  return game;
}

interface Fight { hp: Decimal; time: number; timer: number; mods: string[]; win: boolean }

/** A boss on this floor against this game: its health, how long it takes, and the clock. */
function fight(game: Game, sc: Scenario, f: number): Fight {
  const mods = modsFor(f);
  const tough = TUNE.bossHpFrom + (TUNE.bossHp - TUNE.bossHpFrom) * Math.min(1, (f - 1) / TUNE.bossRamp);
  const wither = 1 - 0.5 * legendShare(game.legendLv('wither'));
  const hp = floorHp(f).times(tough * (f < DESCEND_FLOOR ? 0.5 : 1) * (mods.includes('giant') ? 3 : 1) * wither);
  const timer = (BOSS_TIME + game.bossTimeBonus()) * (mods.includes('enraged') ? 0.5 : 1) * (mods.includes('giant') ? 1.5 : 1);
  const hit = game.clickDamage().times(1 + game.critChance() * (game.critMult() - 1));
  const hand = sc.idle ? 0 : sc.rate;
  const boss = game.breakdown().parts.boss;
  const dps = game.dps().times(mods.includes('armored') ? 0.25 : 1).plus(hit.times(hand + game.autoRate())).times(boss);
  const net = dps.minus(mods.includes('regen') ? hp.times(0.03) : 0);
  const time = net.gt(0) ? hp.div(net).toNumber() : Infinity;
  return { hp, time, timer, mods, win: time <= timer };
}

/** The first boss floor this game can't beat in time. */
function wall(game: Game, sc: Scenario) {
  for (let f = 5; f <= 5000; f += 5) if (!fight(game, sc, f).win) return f;
  return Infinity;
}

const delta = (now: Decimal | number, was: Decimal | number) => {
  const a = new Decimal(now);
  const b = new Decimal(was);
  if (b.lte(0) || a.eq(b)) return '';
  const r = a.div(b).toNumber();
  const text = r >= 10 ? `×${fmt(r)}` : `${r > 1 ? '+' : ''}${((r - 1) * 100).toFixed(1)}%`;
  return ` <span class="cx-d ${r > 1 ? 'up' : 'down'}">${text}</span>`;
};

const body = () => `<p class="lede">Try out a build. The calculator starts from your save in this browser, if there is one, and runs the game's own math on whatever you change.</p>
  <div class="cx-src"></div>
  <div class="cx">
    <div class="cx-in"></div>
    <aside class="cx-out"></aside>
  </div>
  <p class="muted">Changes here never touch your save.</p>`;

function mount(root: HTMLElement) {
  const src = root.querySelector<HTMLElement>('.cx-src')!;
  const inputs = root.querySelector<HTMLElement>('.cx-in')!;
  const out = root.querySelector<HTMLElement>('.cx-out')!;
  const found = loadSave();
  let base = found ?? clone(newSave());
  let edit = clone(base);
  const sc: Scenario = { idle: false, streak: 0, rate: MANUAL_RATE, rampage: 0, bloodlust: false, frenzy: false, treasure: false, goldRush: false, drums: false, floor: Math.max(5, Math.ceil((base.maxFloor ?? 1) / 5) * 5) };

  const traitsOwned = (s: SaveState, i: number) => traitIds(i).filter((u) => s.upgrades.includes(u.id)).length;
  const soulsKept = (s: SaveState) => Math.max(0, s.souls - s.spentSouls);

  function showSource() {
    src.innerHTML = `<p>${found ? 'Using your save from this browser.' : 'No save found in this browser: starting from a new game.'}
      <button class="cx-btn" data-act="reset">Back to ${found ? 'my save' : 'a new game'}</button>
      <button class="cx-btn" data-act="clear">Empty party</button></p>
      <details><summary>Load a save code</summary><p>Copy your save from Options → Export in the game and paste it here.</p>
      <textarea class="cx-code" rows="3" spellcheck="false"></textarea><button class="cx-btn" data-act="code">Load</button> <span class="cx-msg"></span></details>`;
  }

  function showInputs() {
    const comp = COMPS.map((c, i) => `<tr><td><span class="who">${spr(c.sprite, 24)}${c.name}</span></td>
      <td><input type="number" min="0" max="100000" step="1" data-comp="${i}" value="${edit.owned[i]}"></td>
      <td><input type="number" min="0" max="${traitIds(i).length}" step="1" data-traits="${i}" value="${traitsOwned(edit, i)}"> <span class="muted">/ ${traitIds(i).length}</span></td>
      <td><input type="number" min="0" max="99" step="1" data-marks="${i}" value="${edit.marks[i]}"></td></tr>`).join('');
    const spirits = LEGENDS.map((d) => `<label class="cx-sp">${spr(d.sprite, 24)}<span>${d.name}</span><input type="number" min="0" max="${d.maxLv ?? 999}" step="1" data-spirit="${d.id}" value="${edit.legends[d.id] ?? 0}"></label>`).join('');
    const check = (k: keyof Scenario, label: string) => `<label class="cx-ck"><input type="checkbox" data-sc="${k}"${sc[k] ? ' checked' : ''}> ${label}</label>`;
    inputs.innerHTML = `
      ${h2('Party')}
      <div class="tbl"><table class="cx-t"><thead><tr><th>Companion</th><th>Level</th><th>Traits</th><th>Heartmarks</th></tr></thead><tbody>${comp}</tbody></table></div>
      <p class="muted">Traits count up from the first: 3 means its first three. A trait needs its level.</p>
      ${h2('Souls and Spirits')}
      <div class="cx-row"><label>Souls kept <input type="number" min="0" step="1" data-kept value="${soulsKept(edit)}"></label>
      <label>Trophies <input type="number" min="0" max="${TROPHIES.length}" step="1" data-trophies value="${edit.trophies.length}"></label></div>
      <div class="cx-sps">${spirits}</div>
      ${h2('Situation')}
      <div class="cx-row">
        <label>Floor <input type="number" min="1" max="5000" step="1" data-sc="floor" value="${sc.floor}"></label>
        <label>Attacks a second <input type="number" min="0" max="${MANUAL_RATE}" step="1" data-sc="rate" value="${sc.rate}"></label>
        <label>Streak <input type="number" min="0" max="${STREAK_CAP}" step="1" data-sc="streak" value="${sc.streak}"></label>
        <label>Rampage <select data-sc="rampage"><option value="0">Off</option><option value="1"${sc.rampage === 1 ? ' selected' : ''}>First tier</option><option value="2"${sc.rampage === 2 ? ' selected' : ''}>Top tier</option></select></label>
      </div>
      <div class="cx-row">${check('idle', 'Idle')}${check('bloodlust', 'Bloodlust')}${check('frenzy', 'Frenzy')}${check('treasure', 'Treasure Sense')}${check('goldRush', 'Gold Rush')}${check('drums', 'War Drums')}</div>`;
    window.dispatchEvent(new Event('wiki:sprites'));
  }

  function showResults() {
    const now = build(edit, sc);
    const was = build(base, sc);
    const nowFight = fight(now, sc, sc.floor);
    const wasWall = wall(was, sc);
    const nowWall = wall(now, sc);
    const hit = now.clickDamage();
    const levels = edit.owned.reduce((a, b) => a + b, 0);
    const pending = Math.floor(levels / TUNE.levelsPerSoul) + (edit.bossSouls ?? 0);
    const party = COMPS.map((c, i) => ({ c, i, dps: now.compDps(i) })).filter((r) => edit.owned[r.i] > 0).sort((a, b) => b.dps.cmp(a.dps));
    const total = now.baseDps();
    const stat = (label: string, value: string, extra = '') => `<div class="cx-stat"><span>${label}</span><b>${value}${extra}</b></div>`;
    out.innerHTML = `
      <div class="cx-stats">
        ${stat('Party damage / sec', fmt(now.dps()), delta(now.dps(), was.dps()))}
        ${stat('Attack damage', fmt(hit), delta(hit, was.clickDamage()))}
        ${stat('Crit', now.critChance() ? `${(now.critChance() * 100).toFixed(0)}% for ×${+now.critMult().toFixed(2)}` : 'Not unlocked')}
        ${stat('Phantom Blade', now.autoRate() ? `${+now.autoRate().toFixed(1)} a second` : 'Not unlocked')}
        ${stat('Gold', `×${fmt(now.goldMult())}`, delta(now.goldMult(), was.goldMult()))}
        ${stat('Boss damage', `×${+now.breakdown().parts.boss.toFixed(2)}`)}
        ${stat('First boss you can\'t beat', nowWall === Infinity ? 'None by 5000' : `Floor ${nowWall}`, nowWall !== wasWall && wasWall !== Infinity ? ` <span class="cx-d ${nowWall > wasWall ? 'up' : 'down'}">was ${wasWall}</span>` : '')}
        ${stat('Souls if you ascended', fmt(pending))}
      </div>
      <h3>Floor ${sc.floor}</h3>
      <div class="cx-stats">
        ${stat('Monster health', fmt(floorHp(sc.floor).times(TRASH)))}
        ${stat('Per monster', now.dps().gt(0) ? time(floorHp(sc.floor).times(TRASH).div(now.dps()).toNumber()) : '—')}
        ${sc.floor % 5 === 0 ? `${stat('Boss health', fmt(nowFight.hp))}
        ${stat('Modifiers', nowFight.mods.length ? nowFight.mods.map((id) => MODS.find((m) => m.id === id)!.name).join(', ') : 'None')}
        ${stat('Boss takes', `${time(nowFight.time)} of ${+nowFight.timer.toFixed(1)}s`, ` <span class="cx-d ${nowFight.win ? 'up' : 'down'}">${nowFight.win ? 'Beaten' : 'Too slow'}</span>`)}` : `<p class="muted">Not a boss floor.</p>`}
      </div>
      <h3>Who does the damage</h3>
      ${party.length ? `<div class="tbl"><table><thead><tr><th>Companion</th><th class="num">Damage / sec</th><th class="num">Share</th></tr></thead><tbody>
        ${party.map((r) => `<tr><td><span class="who">${spr(r.c.sprite, 22)}${esc(r.c.name)}</span></td><td class="num">${fmt(r.dps)}</td><td class="num">${total.gt(0) ? `${(r.dps.div(total).toNumber() * 100).toFixed(1)}%` : '—'}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">No one hired.</p>'}
      <p class="muted">Boss times count your party, the Phantom Blade and your attacks with crits, against the boss's modifiers. See ${link('bosses', 'Bosses')}.</p>`;
    window.dispatchEvent(new Event('wiki:sprites'));
  }

  const num = (el: HTMLInputElement) => Math.max(0, Math.floor(Number(el.value) || 0));

  inputs.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const d = el.dataset;
    if (d.comp) {
      const i = Number(d.comp);
      edit.owned[i] = num(el);
      // Traits past the new level go.
      const allowed = traitIds(i).filter((u) => u.req.t === 'owned' && u.req.n <= edit.owned[i]).length;
      if (traitsOwned(edit, i) > allowed) setTraits(i, allowed);
    } else if (d.traits) setTraits(Number(d.traits), num(el));
    else if (d.marks) edit.marks[Number(d.marks)] = num(el);
    else if (d.spirit) {
      const lv = num(el);
      if (lv) edit.legends[d.spirit as LegendId] = lv;
      else delete edit.legends[d.spirit as LegendId];
    } else if ('kept' in d) edit.souls = edit.spentSouls + num(el);
    else if ('trophies' in d) edit.trophies = TROPHIES.slice(0, Math.min(TROPHIES.length, num(el))).map((t) => t.id);
    else if (d.sc) {
      const k = d.sc as keyof Scenario;
      (sc as unknown as Record<string, number | boolean>)[k] = el.type === 'checkbox' ? el.checked : k === 'floor' ? Math.max(1, num(el)) : num(el);
    }
    showResults();
  });

  function setTraits(i: number, n: number) {
    const all = traitIds(i);
    const allowed = all.filter((u) => u.req.t === 'owned' && u.req.n <= edit.owned[i]).length;
    const keep = all.slice(0, Math.min(n, allowed)).map((u) => u.id);
    edit.upgrades = edit.upgrades.filter((id) => !all.some((u) => u.id === id)).concat(keep);
    const field = inputs.querySelector<HTMLInputElement>(`[data-traits="${i}"]`);
    if (field && Number(field.value) !== keep.length) field.value = String(keep.length);
  }

  src.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'reset') edit = clone(base);
    else if (act === 'clear') {
      edit.owned = edit.owned.map(() => 0);
      edit.upgrades = [];
    } else if (act === 'code') {
      const loaded = decodeSave(src.querySelector<HTMLTextAreaElement>('.cx-code')!.value);
      src.querySelector('.cx-msg')!.textContent = loaded ? 'Loaded.' : 'That code didn\'t work.';
      if (!loaded) return;
      base = loaded;
      edit = clone(base);
    } else return;
    showInputs();
    showResults();
  });

  showSource();
  showInputs();
  showResults();
}

export const CALCULATOR: Page = { id: 'calculator', group: 'Start here', title: 'Calculator', summary: 'Try out a build: levels, traits, Spirits, souls and buffs.', body, mount };
