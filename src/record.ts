import { COMPS } from './game/data.ts';
import type { Game, GameEvent } from './game/game.ts';
import { GAME_VERSION } from './version.ts';

/**
 * A log of how you play, for tuning the game and the simulator against a real player (scripts/play-report.ts reads
 * it). Only on the dev server (logs/<date>.jsonl in the project) and in the desktop app (logs/ beside its saves):
 * the website records nothing. One JSON line per thing that happened, `at` in ms; a snapshot every minute.
 */
export class PlayRecorder {
  private lines: string[] = [];
  /** This run: when it started (ms), its deepest floor, and when that was reached. */
  private runStart = Date.now();
  private runBest = 0;
  private bestAt = Date.now();
  /** This minute's tallies. */
  private clicks = 0;
  private active = 0;
  private idle = 0;
  private keep = 0;
  private caught = 0;
  private escaped = 0;
  private lastGold: number;
  private lastKills: number;
  private seconds = 0;

  private game: Game;
  private send: (text: string) => void;

  constructor(game: Game, slot: string | null, send: (text: string) => void) {
    this.game = game;
    this.send = send;
    const s = game.s;
    this.runBest = s.maxFloor;
    this.lastGold = Number(s.runGold.log10());
    this.lastKills = s.kills;
    this.log({ e: 'start', version: GAME_VERSION, slot, floor: s.floor, maxFloor: s.maxFloor, bestFloor: s.bestFloor, ascents: s.descents, awakens: s.awakens, souls: s.souls, bound: s.boundEarned, played: Math.round(s.playTime) });
  }

  private log(entry: Record<string, unknown>) {
    this.lines.push(JSON.stringify({ at: Date.now(), ...entry }));
  }

  event(ev: GameEvent) {
    const g = this.game;
    const name = (i: number) => COMPS[i]?.id;
    switch (ev.t) {
      case 'click': this.clicks++; break;
      case 'raidCatch': this.caught++; break;
      case 'raidEscape': this.escaped++; break;
      case 'buyComp': this.log({ e: 'hire', comp: name(ev.comp), n: ev.n, lv: g.s.owned[ev.comp], floor: g.s.floor, ...(ev.auto ? { auto: true } : {}) }); break;
      case 'buyUpg': this.log({ e: 'trait', id: ev.id, floor: g.s.floor, ...(ev.auto ? { auto: true } : {}) }); break;
      case 'legend': this.log({ e: 'spirit', id: ev.id, lv: ev.lv, summoned: ev.summoned, soulsFree: g.soulsFree() }); break;
      case 'bound': this.log({ e: 'bound', id: ev.id, lv: ev.lv }); break;
      case 'mark': this.log({ e: 'mark', comp: name(ev.comp), moved: !!ev.moved }); break;
      case 'ability': if (!ev.unlocked) this.log({ e: 'skill', id: ev.id, floor: g.s.floor }); break;
      case 'floor':
        if (ev.floor > this.runBest) {
          this.runBest = ev.floor;
          this.bestAt = Date.now();
          this.log({ e: 'deeper', floor: ev.floor, runSecs: this.runSecs() });
        }
        break;
      case 'bossWin': this.log({ e: 'bossWin', floor: ev.floor, first: ev.first, ...(ev.clutch ? { clutch: +ev.clutch.left.toFixed(1) } : {}) }); break;
      case 'bossFail': this.log({ e: 'bossFail', floor: ev.floor }); break;
      case 'descend':
        this.log({ e: 'ascend', souls: ev.souls, floor: this.runBest, runSecs: this.runSecs(), stallSecs: Math.round((Date.now() - this.bestAt) / 1000), ascents: g.s.descents });
        this.newRun();
        break;
      case 'awaken':
        this.log({ e: 'awaken', bound: ev.bound, cycleBest: g.s.ascents.at(-1)?.floor, awakens: g.s.awakens });
        this.newRun();
        break;
      case 'tripSend': this.log({ e: 'tripSend', comp: name(ev.comp), floor: ev.floor, lv: g.s.owned[ev.comp] }); break;
      case 'expedition': this.log({ e: 'tripHome', comp: name(ev.comp), floor: ev.floor, kills: ev.kills, cards: ev.cards }); break;
      case 'card': this.log({ e: 'card', id: ev.id, gold: ev.gold, lap: ev.lap, src: ev.src, first: ev.first }); break;
      case 'keep': this.log({ e: 'keep', on: ev.on }); break;
      case 'trophy': this.log({ e: 'trophy', id: ev.id }); break;
      case 'curse': this.log({ e: 'curse', id: ev.id, tier: ev.tier }); break;
    }
  }

  private runSecs() {
    return Math.round((Date.now() - this.runStart) / 1000);
  }

  private newRun() {
    this.runStart = Date.now();
    this.runBest = this.game.s.maxFloor;
    this.bestAt = Date.now();
    this.lastGold = Number(this.game.s.runGold.log10());
  }

  /** Time away (tab hidden or app closed), as the game settled it. */
  away(seconds: number) {
    this.log({ e: 'away', secs: Math.round(seconds) });
  }

  /** Once a second while playing: tallies, a snapshot every minute, and the log sent on every tenth second. */
  second() {
    const g = this.game;
    if (g.s.inKeep) this.keep++;
    else if (g.idle()) this.idle++;
    else this.active++;
    this.seconds++;
    if (this.seconds % 60 === 0) {
      const s = g.s;
      const goldLog = Number(s.runGold.log10());
      this.log({
        e: 'min', floor: s.floor, maxFloor: s.maxFloor, runSecs: this.runSecs(),
        dps: g.dps().toExponential(3), gold: s.gold.toExponential(3),
        // (Run gold's growth this minute, in powers of ten: gold per minute spans too many orders to keep plainly.)
        goldLog10Gain: +(goldLog - this.lastGold).toFixed(3),
        kills: s.kills - this.lastKills, clicks: this.clicks, active: this.active, idle: this.idle, keep: this.keep,
        goblins: this.caught, escaped: this.escaped, souls: s.souls, soulsFree: g.soulsFree(), ascents: s.descents, awakens: s.awakens,
        autoHire: s.settings.autoHire, autoTraits: s.settings.autoUpg, levels: s.owned,
      });
      this.lastGold = goldLog;
      this.lastKills = s.kills;
      this.clicks = this.active = this.idle = this.keep = this.caught = this.escaped = 0;
    }
    if (this.seconds % 10 === 0) this.flush();
  }

  flush() {
    if (!this.lines.length) return;
    this.send(this.lines.join('\n') + '\n');
    this.lines = [];
  }
}
