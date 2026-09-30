import type { Game } from '../game/sim.ts';
import { REBIRTH_MIN, isBossStage, shardsFor, stageLabel } from '../game/sim.ts';
import { HEROES, HERO_IDS, type HeroId, type Skill } from '../game/heroes.ts';
import { BOARD_DAYS, DUNGEONS, TASKS, stampReward, tasksDone, type DungeonId } from '../game/dailies.ts';
import { TALENTS, available } from '../game/talents.ts';
import { fmt } from '../game/format.ts';
import { G, sheetIcon, sprite } from './px.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const bar = (ratio: number, cls = '') => `<div class="pbar ${cls}"><i style="width:${Math.max(0, Math.min(1, ratio)) * 100}%"></i></div>`;
const secs = (t: number) => `${Math.max(0, Math.ceil(t))}s`;

export const portrait = (hero: HeroId, scale = 2) => sprite(`${HEROES[hero].sprite}_idle`, scale);
export function skillIcon(sk: Skill, scale = 2): string {
  const [sheet, col, row] = sk.icon.split(':');
  return col === undefined ? sprite(sk.icon, scale) : sheetIcon(sheet, Number(col), Number(row), scale);
}

// ---------- stage box ----------

/** The bottom half of the stage box: Challenge button, or live progress of whatever run is active. */
export function stageAction(g: Game): string {
  const r = g.run;
  if (!r) {
    const atMax = g.s.stage === g.s.maxStage;
    return `
      <button class="btn primary chal" data-action="challenge" ${atMax ? '' : 'disabled'}>
        ${isBossStage(g.s.stage) ? sprite('skull', 2) : ''}Challenge ${stageLabel(g.s.stage)}
      </button>
      <button class="btn chk ${g.s.settings.autoChallenge ? 'on' : ''}" data-action="autoch" title="Retry the Challenge automatically"><i>${G.check()}</i>Auto</button>
      ${atMax ? '' : `<p class="muted small note">Farming an easier stage · best is ${stageLabel(g.s.maxStage)}</p>`}`;
  }
  if (r.kind === 'challenge') {
    const boss = r.phase === 'boss' ? g.enemies.find((e) => e.id === r.bossId) : null;
    return `
      <div class="runline"><b>${r.phase === 'waves' ? 'Clear the waves' : 'Defeat the guardian'}</b><span class="timer-t ${r.timer < 10 ? 'warn' : ''}">${secs(r.timer)}</span></div>
      ${r.phase === 'waves' ? bar(r.kills / r.quota) + `<small class="muted">${r.kills} / ${r.quota} slain</small>` : bar(boss ? boss.hp / boss.maxHp : 0, 'boss')}`;
  }
  if (r.kind === 'dungeon') {
    const d = DUNGEONS[r.dungeon!];
    return `
      <div class="runline"><b>${d.name} · Floor ${r.floor}</b><span class="timer-t ${r.timer < 10 ? 'warn' : ''}">${secs(r.timer)}</span></div>
      ${bar(r.kills / r.quota)}<small class="muted">${r.kills} / ${r.quota} slain</small>`;
  }
  const boss = g.enemies.find((e) => e.id === r.bossId);
  return `
    <div class="runline"><b>World Boss · Lv ${g.s.daily.wbLevel}</b><span class="timer-t ${r.timer < 10 ? 'warn' : ''}">${secs(r.timer)}</span></div>
    ${bar(boss ? boss.hp / boss.maxHp : 0, 'boss')}<small class="muted">${fmt(r.dealt)} damage dealt</small>`;
}

// ---------- skill bar ----------

export function skillBar(g: Game): string {
  const actives = g.activeSkills();
  return g.kit.skills.map((sk) => {
    const unlocked = sk.level <= g.s.heroLevel;
    if (!unlocked) return `<div class="skill locked" title="${esc(sk.name)}: ${esc(sk.desc)}">${skillIcon(sk)}<span class="lvl">Lv ${sk.level}</span></div>`;
    if (sk.cooldown === 0) return `<div class="skill passive" title="${esc(sk.name)}: ${esc(sk.desc)}">${skillIcon(sk)}<span class="key">P</span></div>`;
    const slot = actives.indexOf(sk);
    return `<button class="skill" data-action="cast" data-id="${slot}" data-skill="${sk.id}" title="${esc(sk.name)} (${slot + 1}): ${esc(sk.desc)}">${skillIcon(sk)}<i class="cd"></i><span class="key">${slot + 1}</span></button>`;
  }).join('');
}

// ---------- dailies ----------

export function dailiesPanel(g: Game): string {
  const d = g.s.daily;
  const busy = g.mode !== 'hunt';
  const dungeons = (Object.keys(DUNGEONS) as DungeonId[]).map((id) => {
    const info = DUNGEONS[id];
    const best = d.best[id];
    return `
      <div class="dcard">
        <div class="dcard-head">${sprite(info.icon, 2)}<div><b>${info.name}</b><small>${info.blurb}</small></div></div>
        <div class="dcard-meta"><span>Best floor <b>${best}</b></span><span class="keys">${Array.from({ length: 3 }, (_, i) => `<i class="${i < d.keys[id] ? 'on' : ''}">${G.check()}</i>`).join('')}</span></div>
        <div class="dcard-actions">
          <button class="btn primary" data-action="dungeon" data-id="${id}" data-floor="${best + 1}" ${busy ? 'disabled' : ''}>Floor ${best + 1} <small>free</small></button>
          <button class="btn" data-action="sweep" data-id="${id}" ${d.keys[id] > 0 && best > 0 ? '' : 'disabled'}>Sweep ${best || ''} <small>key</small></button>
        </div>
      </div>`;
  }).join('');
  const stamp = stampReward(d.stamps + 1);
  const done = tasksDone(d);
  const board = Array.from({ length: BOARD_DAYS }, (_, i) => {
    const n = i + 1;
    const r = stampReward(n);
    return `<i class="stamp ${n <= d.stamps ? 'got' : ''} ${r.item ? 'big' : ''} ${n === BOARD_DAYS ? 'final' : ''}" title="Day ${n}: ${r.item ? `${r.item} item` : 'gold'}${r.shards ? ` + ${r.shards} shards` : ''}">${n <= d.stamps ? G.check() : n}</i>`;
  }).join('');
  return `
    <div class="dsec">
      <h3>Dungeons <small class="muted">New floors are free · replays and sweeps use a key · keys refill daily</small></h3>
      <div class="dgrid">${dungeons}</div>
    </div>
    <div class="dsec two">
      <div class="dcard wb">
        <div class="dcard-head">${sprite('big_demon_idle', 1)}<div><b>World Boss · Lv ${d.wbLevel}</b><small>45s to deal as much damage as you can. Kill it to level it up for bigger rewards and a soul shard.</small></div></div>
        <div class="dcard-actions"><button class="btn primary" data-action="worldboss" ${d.wbAttempts > 0 && !busy ? '' : 'disabled'}>Fight <small>${d.wbAttempts} left today</small></button></div>
      </div>
      <div class="dcard">
        <h3>Daily checklist</h3>
        <ul class="tasks">${TASKS.map((t) => {
          const v = Math.min(t.goal, Math.floor(d.tasks[t.id]));
          return `<li class="${v >= t.goal ? 'done' : ''}"><i>${v >= t.goal ? G.check() : ''}</i><span>${t.name}</span><small>${fmt(v)}/${fmt(t.goal)}</small></li>`;
        }).join('')}</ul>
        <button class="btn ${done && !d.claimed ? 'primary' : ''} wide" data-action="claim" ${done && !d.claimed ? '' : 'disabled'}>
          ${d.claimed ? 'Stamped today · come back tomorrow' : `Stamp day ${d.stamps + 1}${stamp.item ? ` · ${stamp.item} item` : ''}${stamp.shards ? ` · ${stamp.shards} shards` : ''}`}
        </button>
        <div class="board">${board}</div>
      </div>
    </div>`;
}

export function dailiesReady(g: Game): number {
  const d = g.s.daily;
  let n = 0;
  for (const id of Object.keys(DUNGEONS) as DungeonId[]) if (d.keys[id] > 0) n++;
  if (d.wbAttempts > 0) n++;
  if (tasksDone(d) && !d.claimed) n++;
  return n;
}

// ---------- hero panel ----------

export type HeroTab = 'class' | 'talents' | 'rebirth';

function classCard(g: Game, id: HeroId, pick: 'switch' | 'rebirth' | 'none'): string {
  const k = HEROES[id];
  const current = g.s.hero === id;
  return `
    <div class="ccard ${current ? 'current' : ''}">
      <div class="ccard-head">${portrait(id, 3)}<div><b>${k.name}</b><small>${k.role}</small><p>${k.blurb}</p></div></div>
      <ul class="cskills">${k.skills.map((sk) => `<li class="${current && sk.level <= g.s.heroLevel ? 'on' : ''}">${skillIcon(sk, 2)}<div><b>${sk.name}</b> <em>Lv ${sk.level}${sk.cooldown === 0 ? ' · passive' : ''}</em><span>${sk.desc}</span></div></li>`).join('')}</ul>
      ${pick === 'switch' && !current ? `<button class="btn wide" data-action="pickclass" data-id="${id}">Play as ${k.name}</button>` : ''}
      ${pick === 'rebirth' ? `<button class="btn wide ${current ? '' : 'primary'}" data-action="rebirth" data-id="${id}">Rebirth as ${k.name}</button>` : ''}
      ${current && pick !== 'rebirth' ? '<p class="muted small center">Your current class</p>' : ''}
    </div>`;
}

export function heroPanel(g: Game, tab: HeroTab): string {
  const tabs = `<div class="tabs">${(['class', 'talents', 'rebirth'] as HeroTab[]).map((t) =>
    `<button class="btn tab ${tab === t ? 'on' : ''}" data-action="herotab" data-id="${t}">${t === 'class' ? 'Classes' : t === 'talents' ? 'Talents' : 'Rebirth'}</button>`).join('')}
    <span class="shards">${sprite('flask_big_blue', 2)}<b>${g.s.prestige.shards}</b> soul shards</span></div>`;
  if (tab === 'class') {
    const fresh = g.s.prestige.rebirths === 0 && g.s.maxStage <= 1 && g.s.heroLevel <= 2;
    return `${tabs}
      <p class="muted small">${fresh ? 'Pick any class now. Later, you can change class when you rebirth.' : 'You can change class whenever you rebirth.'}</p>
      <div class="cgrid">${HERO_IDS.map((id) => classCard(g, id, fresh ? 'switch' : 'none')).join('')}</div>`;
  }
  if (tab === 'talents') {
    const ranks = g.s.prestige.ranks;
    const nodes = TALENTS.map((t) => {
      const r = ranks[t.id] ?? 0;
      const open = available(t, ranks);
      const maxed = r >= t.max;
      const cost = t.cost(r);
      const can = open && !maxed && g.s.prestige.shards >= cost;
      return `
        <button class="tnode ${t.kind ?? ''} ${r > 0 ? 'owned' : ''} ${open ? '' : 'locked'} ${can ? 'can' : ''}" data-action="talent" data-id="${t.id}"
          style="grid-column:${t.at[0] + 1};grid-row:${t.at[1] + 1}" title="${esc(t.name)}: ${esc(t.desc(Math.max(1, r)))}">
          <b>${t.name}</b><span class="rank">${r}/${t.max}</span>${maxed ? '' : `<span class="cost">${sprite('flask_big_blue', 1)}${cost}</span>`}
        </button>`;
    }).join('');
    return `${tabs}
      <p class="muted small">Talents are permanent. Earn soul shards by rebirthing, killing the world boss, and the daily stamp board. Hover a talent for details.</p>
      <div class="tgrid">${nodes}</div>
      <p class="tdesc small"></p>`;
  }
  const can = g.canRebirth();
  const shards = shardsFor(g.s.maxStage);
  return `${tabs}
    <div class="rebirth-info">
      <p>Rebirth sends you back to stage 1 with fresh gear, but you keep your <b>talents</b>, <b>soul shards</b>, and daily progress. Each rebirth makes the next run faster and deeper.</p>
      <div class="rb-stats">
        <div><small>Best stage this run</small><b>${stageLabel(g.s.maxStage)}</b></div>
        <div><small>Soul shards you'd earn</small><b class="shard-t">${can ? `+${shards}` : '—'}</b></div>
        <div><small>Rebirths</small><b>${g.s.prestige.rebirths}</b></div>
      </div>
      ${can ? '<p class="small">Choose your class for the next run:</p>' : `<p class="warn-t">Reach stage ${stageLabel(REBIRTH_MIN)} to rebirth (and finish any run in progress).</p>`}
    </div>
    ${can ? `<div class="cgrid">${HERO_IDS.map((id) => classCard(g, id, 'rebirth')).join('')}</div>` : ''}`;
}

export function heroReady(g: Game): boolean {
  const ranks = g.s.prestige.ranks;
  return g.canRebirth() || TALENTS.some((t) => (ranks[t.id] ?? 0) < t.max && available(t, ranks) && g.s.prestige.shards >= t.cost(ranks[t.id] ?? 0));
}

export function classPicker(): string {
  return `
    <div class="modal-card pnl gold wide-card">
      <small class="kicker">Choose your hero</small>
      <h2>Descent</h2>
      <p class="muted small">Each class fights differently and unlocks its own skills as it levels. You can switch whenever you rebirth.</p>
      <div class="cgrid">${HERO_IDS.map((id) => {
        const k = HEROES[id];
        return `
          <button class="ccard pick" data-action="startclass" data-id="${id}">
            <div class="ccard-head">${portrait(id, 3)}<div><b>${k.name}</b><small>${k.role}</small><p>${k.blurb}</p></div></div>
            <ul class="cskills mini">${k.skills.filter((s) => s.cooldown > 0).slice(0, 3).map((sk) => `<li>${skillIcon(sk, 2)}<div><b>${sk.name}</b> <em>Lv ${sk.level}</em></div></li>`).join('')}</ul>
          </button>`;
      }).join('')}</div>
    </div>`;
}

