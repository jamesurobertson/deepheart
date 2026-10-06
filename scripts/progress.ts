/**
 * "Something new": the pacing tools' measure of a quiet stretch. A gap is time with nothing you've never had before:
 * a deeper floor, a companion, a relic or relic star, an upgrade, an ability, an Abyss or Heart power level, a curse
 * tier, an ascend milestone, a trophy or a card.
 */
import { ASCEND_MILESTONES, COMPS } from '../src/game/data.ts';
import type { Game, GameEvent } from '../src/game/game.ts';

export interface Gap {
  from: number;
  to: number;
  endedBy: string;
}

export class Novelty {
  readonly gaps: Gap[] = [];
  private last = 0;
  private seen = new Set<string>();
  private best = 0;
  private revealed = 0;
  private relics = 0;
  private descents = 0;

  /** Something new happened at time `t` (in played seconds). */
  fresh(t: number, why: string) {
    this.gaps.push({ from: this.last, to: t, endedBy: why });
    this.last = t;
  }

  private first(t: number, key: string, why: string) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.fresh(t, why);
  }

  /** Purchases and finds, from the game's events. */
  event(ev: GameEvent, t: number) {
    if (ev.t === 'buyUpg') this.first(t, `u:${ev.id}`, 'new upgrade');
    else if (ev.t === 'ability' && ev.unlocked) this.first(t, `ab:${ev.id}`, 'new ability');
    else if (ev.t === 'abyss') this.first(t, `a:${ev.id}:${ev.lv}`, 'new Abyss level');
    else if (ev.t === 'heart') this.first(t, `h:${ev.id}:${ev.lv}`, 'new Heart level');
    else if (ev.t === 'relic' && ev.star) this.first(t, `s:${ev.id}:${ev.star}`, 'relic star');
    else if (ev.t === 'curse') this.first(t, `c:${ev.id}:${ev.tier}`, 'curse tier');
    else if (ev.t === 'trophy') this.first(t, `t:${ev.id}`, 'trophy');
    else if (ev.t === 'card' && ev.first) this.first(t, `k:${ev.id}:${ev.gold}`, 'new card');
  }

  /** Depth, companions and relics, checked every tick (cheap comparisons). */
  tick(game: Game, t: number) {
    if (game.s.descents > this.descents) {
      this.descents = game.s.descents;
      const reached = ASCEND_MILESTONES.find((m) => m.at === this.descents);
      if (reached) this.first(t, `m:${reached.id}`, reached.name);
    }
    if (game.s.bestFloor > this.best) {
      this.best = game.s.bestFloor;
      this.fresh(t, `floor ${this.best}`);
    }
    if (game.s.revealed > this.revealed) {
      this.revealed = game.s.revealed;
      this.fresh(t, COMPS[this.revealed - 1]?.name ?? 'companion');
    }
    if (game.relicsFound() > this.relics) {
      this.relics = game.relicsFound();
      this.fresh(t, `relic #${this.relics}`);
    }
  }

  relicsFound() {
    return this.relics;
  }
}
