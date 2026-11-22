import Decimal from 'break_infinity.js';
import { ABILITY_BY_ID, COMPS, LEGENDS, TROPHIES, UPGRADES, type LegendId } from '../../game/data.ts';
import {
  Game, MANUAL_RATE, SAVE_VERSION, STREAK_CAP, TUNE, newSave, type Buff, type SaveState,
} from '../../game/game.ts';
import { fmt } from '../../game/format.ts';
import { decimal, percent, t } from '../../i18n/index.ts';
import { esc, h2 } from '../kit.ts';
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
}

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

const delta = (now: Decimal | number, was: Decimal | number) => {
  const a = new Decimal(now);
  const b = new Decimal(was);
  if (b.lte(0) || a.eq(b)) return '';
  const r = a.div(b).toNumber();
  const text = r >= 10 ? `×${fmt(r)}` : `${r > 1 ? '+' : ''}${percent(r - 1, 1)}`;
  return ` <span class="cx-d ${r > 1 ? 'up' : 'down'}">${text}</span>`;
};

const body = () => `<p class="lede">${t('wiki.calc.lede')}</p>
  <div class="cx-src"></div>
  <div class="cx">
    <div class="cx-in"></div>
    <aside class="cx-out"></aside>
  </div>
  <p class="muted">${t('wiki.calc.safe')}</p>`;

function mount(root: HTMLElement) {
  const src = root.querySelector<HTMLElement>('.cx-src')!;
  const inputs = root.querySelector<HTMLElement>('.cx-in')!;
  const out = root.querySelector<HTMLElement>('.cx-out')!;
  const found = loadSave();
  let base = found ?? clone(newSave());
  let edit = clone(base);
  const sc: Scenario = { idle: false, streak: 0, rate: MANUAL_RATE, rampage: 0, bloodlust: false, frenzy: false, treasure: false, goldRush: false, drums: false };

  const traitsOwned = (s: SaveState, i: number) => traitIds(i).filter((u) => s.upgrades.includes(u.id)).length;
  const soulsKept = (s: SaveState) => Math.max(0, s.souls - s.spentSouls);

  type Start = 'save' | 'new' | 'code';
  let start: Start = found ? 'save' : 'new';
  let codeSave: SaveState | null = null;

  function showSource() {
    const opt = (k: Start, label: string, off = false) => `<button class="cx-seg${start === k ? ' on' : ''}" data-start="${k}"${off ? ' disabled' : ''}>${label}</button>`;
    src.innerHTML = `<div class="cx-start"><span>${t('wiki.calc.start')}</span>
        ${opt('save', t('wiki.calc.start.save'), !found)}${opt('new', t('wiki.calc.start.new'))}${opt('code', t('wiki.calc.start.code'))}
        <button class="cx-btn" data-act="reset">${t('wiki.calc.undo')}</button></div>
      ${start === 'code' ? `<div class="cx-paste"><p>${t('wiki.calc.paste')}</p>
        <textarea class="cx-code" rows="3" spellcheck="false"></textarea><button class="cx-btn" data-act="code">${t('wiki.calc.load')}</button> <span class="cx-msg">${codeSave ? t('wiki.calc.loaded') : ''}</span></div>` : ''}
      ${found ? '' : `<p class="muted">${t('wiki.calc.noSave')}</p>`}
      <p class="muted">${t('wiki.calc.deltas')}</p>`;
  }

  function startFrom(k: Start) {
    start = k;
    base = k === 'save' && found ? found : k === 'code' && codeSave ? codeSave : clone(newSave());
    edit = clone(base);
  }

  function showInputs() {
    const comp = COMPS.map((c, i) => `<tr><td><span class="who">${spr(c.sprite, 24)}${c.name}</span></td>
      <td><input type="number" min="0" max="100000" step="1" data-comp="${i}" value="${edit.owned[i]}"></td>
      <td><input type="number" min="0" max="${traitIds(i).length}" step="1" data-traits="${i}" value="${traitsOwned(edit, i)}"> <span class="muted">/ ${traitIds(i).length}</span></td>
      <td><input type="number" min="0" max="99" step="1" data-marks="${i}" value="${edit.marks[i]}"></td></tr>`).join('');
    const spirits = LEGENDS.map((d) => `<label class="cx-sp">${spr(d.sprite, 24)}<span>${d.name}</span><input type="number" min="0" max="${d.maxLv ?? 999}" step="1" data-spirit="${d.id}" value="${edit.legends[d.id] ?? 0}"></label>`).join('');
    const check = (k: keyof Scenario, label: string) => `<label class="cx-ck"><input type="checkbox" data-sc="${k}"${sc[k] ? ' checked' : ''}> ${label}</label>`;
    inputs.innerHTML = `
      ${h2(['party', t('wiki.calc.h.party')])}
      <div class="tbl"><table class="cx-t"><thead><tr><th>${t('wiki.calc.party.companion')}</th><th>${t('wiki.calc.party.level')}</th><th>${t('wiki.calc.party.upgrades')}</th><th>${t('wiki.calc.party.marks')}</th></tr></thead><tbody>${comp}</tbody></table></div>
      <p class="muted">${t('wiki.calc.party.note')}</p>
      ${h2(['souls-and-spirits', t('wiki.calc.h.souls')])}
      <div class="cx-row"><label>${t('wiki.calc.souls.kept')} <input type="number" min="0" step="1" data-kept value="${soulsKept(edit)}"></label>
      <label>${t('wiki.calc.souls.trophies')} <input type="number" min="0" max="${TROPHIES.length}" step="1" data-trophies value="${edit.trophies.length}"></label></div>
      <div class="cx-sps">${spirits}</div>
      ${h2(['situation', t('wiki.calc.h.situation')])}
      <div class="cx-row">
        <label>${t('wiki.calc.situation.rate')} <input type="number" min="0" max="${MANUAL_RATE}" step="1" data-sc="rate" value="${sc.rate}"></label>
        <label>${t('wiki.calc.situation.streak')} <input type="number" min="0" max="${STREAK_CAP}" step="1" data-sc="streak" value="${sc.streak}"></label>
        <label>${t('wiki.calc.situation.rampage')} <select data-sc="rampage"><option value="0">${t('wiki.calc.situation.rampage.off')}</option><option value="1"${sc.rampage === 1 ? ' selected' : ''}>${t('wiki.calc.situation.rampage.first')}</option><option value="2"${sc.rampage === 2 ? ' selected' : ''}>${t('wiki.calc.situation.rampage.top')}</option></select></label>
      </div>
      <div class="cx-row">${check('idle', t('wiki.calc.situation.idle'))}${check('bloodlust', t('wiki.goblins.bloodlust'))}${check('frenzy', t('wiki.goblins.frenzy'))}${check('treasure', ABILITY_BY_ID.get('treasure')!.name)}${check('goldRush', t('wiki.goblins.rush'))}${check('drums', ABILITY_BY_ID.get('drums')!.name)}</div>`;
    window.dispatchEvent(new Event('wiki:sprites'));
  }

  function showResults() {
    const now = build(edit, sc);
    const was = build(base, sc);
    const hit = now.clickDamage();
    const levels = edit.owned.reduce((a, b) => a + b, 0);
    const pending = Math.floor(levels / TUNE.levelsPerSoul) + (edit.bossSouls ?? 0);
    const party = COMPS.map((c, i) => ({ c, i, dps: now.compDps(i) })).filter((r) => edit.owned[r.i] > 0).sort((a, b) => b.dps.cmp(a.dps));
    const total = now.baseDps();
    const stat = (label: string, value: string, extra = '') => `<div class="cx-stat"><span>${label}</span><b>${value}${extra}</b></div>`;
    out.innerHTML = `
      <div class="cx-stats">
        ${stat(t('wiki.calc.out.dps'), fmt(now.dps()), delta(now.dps(), was.dps()))}
        ${stat(t('wiki.calc.out.attack'), fmt(hit), delta(hit, was.clickDamage()))}
        ${stat(t('wiki.calc.out.crit'), now.critChance() ? t('wiki.calc.out.crit.value', { chance: percent(now.critChance(), 0), mult: decimal(now.critMult(), 2) }) : t('wiki.calc.out.locked'))}
        ${stat(ABILITY_BY_ID.get('blade')!.name, now.autoRate() ? t('wiki.calc.out.blade.value', { rate: decimal(now.autoRate(), 1) }) : t('wiki.calc.out.locked'))}
        ${stat(t('wiki.calc.out.gold'), `×${fmt(now.goldMult())}`, delta(now.goldMult(), was.goldMult()))}
        ${stat(t('wiki.calc.out.boss'), `×${decimal(now.breakdown().parts.boss, 2)}`)}
        ${stat(t('wiki.calc.out.souls'), fmt(pending))}
      </div>
      <h3>${t('wiki.calc.out.who')}</h3>
      ${party.length ? `<div class="tbl"><table><thead><tr><th>${t('wiki.calc.out.who.companion')}</th><th class="num">${t('wiki.calc.out.who.dps')}</th><th class="num">${t('wiki.calc.out.who.share')}</th></tr></thead><tbody>
        ${party.map((r) => `<tr><td><span class="who">${spr(r.c.sprite, 22)}${esc(r.c.name)}</span></td><td class="num">${fmt(r.dps)}</td><td class="num">${total.gt(0) ? percent(r.dps.div(total).toNumber(), 1) : '—'}</td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted">${t('wiki.calc.out.none')}</p>`}
`;
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
    else if ('trophies' in d) edit.trophies = TROPHIES.slice(0, Math.min(TROPHIES.length, num(el))).map((trophy) => trophy.id);
    else if (d.sc) {
      const k = d.sc as keyof Scenario;
      (sc as unknown as Record<string, number | boolean>)[k] = el.type === 'checkbox' ? el.checked : num(el);
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
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-start], [data-act]');
    if (!el) return;
    if (el.dataset.start) startFrom(el.dataset.start as Start);
    else if (el.dataset.act === 'reset') edit = clone(base);
    else if (el.dataset.act === 'code') {
      const loaded = decodeSave(src.querySelector<HTMLTextAreaElement>('.cx-code')!.value);
      if (!loaded) {
        src.querySelector('.cx-msg')!.textContent = t('wiki.calc.badCode');
        return;
      }
      codeSave = loaded;
      startFrom('code');
    }
    showSource();
    showInputs();
    showResults();
  });

  showSource();
  showInputs();
  showResults();
}

export const CALCULATOR: Page = { id: 'calculator', group: 'start', title: t('wiki.page.calculator'), summary: t('wiki.page.calculator.summary'), body, mount };
