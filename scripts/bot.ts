/**
 * A simulated player for the headless pacing tools: clicks for a while, buys whatever adds the most damage per gold,
 * slots the best relics, and prestiges once it stops making progress.
 */
import { Game, newSave, type GameEvent } from '../src/game/game.ts';
import { COMPS, HEART } from '../src/game/data.ts';

export interface Profile {
  /** Clicks per second while the player is active. */
  cps: number;
  /** Minutes of active play at the start (and 5 more after every prestige). */
  activeMin: number;
  /** Descend once stalled if the souls on offer are at least this share of the souls already held. */
  descendRatio: number;
  /** Or, when set: descend once stalled if it adds at least this much damage (what the descend panel shows). */
  descendGain?: number;
  /** Awaken once stalled if the heartstones on offer are at least this share of all heartstones earned. */
  awakenRatio: number;
  /** Seconds without a new deepest floor (this descent) before the player gives up on the run. */
  stall: number;
  /** Chance per tick of catching a treasure goblin that's on screen. */
  catchRate: number;
}

export interface SimHooks {
  event?: (ev: GameEvent, sim: Sim) => void;
  /** The run has just stopped making progress (before the player decides what to do). */
  stall?: (sim: Sim) => void;
  descend?: (souls: number, sim: Sim) => void;
  awaken?: (stones: number, sim: Sim) => void;
  tick?: (sim: Sim) => void;
}

/** Deterministic Math.random, so a pacing run gives the same answer twice. */
export function seedRandom(seed: number) {
  let s = seed >>> 0 || 1;
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A player's rough relic preference: raw power first, then the answers to boss modifiers. */
const RELIC_PICK = ['shard', 'oath', 'banner', 'slayer', 'whet', 'glass', 'hilt', 'pick', 'rot', 'drum', 'razor', 'hawk', 'cleaver', 'cage', 'purse', 'bait'];

export class Sim {
  readonly game = new Game(newSave());
  readonly dt = 0.1;
  t = 0;
  descents = 0;
  awakens = 0;
  private clickAcc = 0;
  private activeUntil: number;
  private lastMax = 0;
  private lastProgress = 0;
  private stallSeen = false;

  readonly profile: Profile;
  private hooks: SimHooks;

  constructor(profile: Profile, hooks: SimHooks = {}) {
    this.profile = profile;
    this.hooks = hooks;
    this.activeUntil = profile.activeMin * 60;
  }

  /** Damage a descent right now would add, as a fraction. */
  descentGain() {
    const { game } = this;
    const power = game.soulPower();
    return (power * game.pendingSouls()) / (1 + power * game.s.souls);
  }

  get stalled() {
    return this.t - this.lastProgress > this.profile.stall;
  }

  get active() {
    return this.t < this.activeUntil;
  }

  run(hours: number) {
    while (this.t < hours * 3600) this.step();
  }

  step() {
    const { game, profile, dt } = this;
    if (this.active) {
      this.clickAcc += dt * profile.cps;
      while (this.clickAcc >= 1) {
        this.clickAcc--;
        game.click(null, 0, 0);
      }
    }
    game.update(dt);
    for (const ev of game.events) {
      if (ev.t === 'relic') this.equipRelics();
      this.hooks.event?.(ev, this);
    }
    if (game.raid && Math.random() < profile.catchRate) game.catchRaid();
    // Shopping once a simulated second is how a person plays, and keeps long runs fast.
    if (Math.floor(this.t) !== Math.floor(this.t - dt)) this.shop();
    if (game.s.maxFloor > this.lastMax) {
      this.lastMax = game.s.maxFloor;
      this.lastProgress = this.t;
      this.stallSeen = false;
    }
    const stalled = this.stalled;
    if (stalled && !this.stallSeen) {
      this.stallSeen = true;
      this.hooks.stall?.(this);
    }
    const worthIt = profile.descendGain !== undefined
      ? this.descentGain() >= profile.descendGain
      : profile.descendRatio > 0 && game.pendingSouls() >= Math.max(10, game.s.souls * profile.descendRatio);
    if (stalled && game.canDescend() && worthIt) {
      const souls = game.pendingSouls();
      this.descents++;
      this.hooks.descend?.(souls, this);
      game.descend();
      this.afterReset();
      for (;;) {
        const a = game.abyssList().filter((x) => game.abyssAvailable(x.id)).sort((x, y) => x.cost - y.cost)[0];
        if (!a || !game.buyAbyss(a.id)) break;
      }
    }
    if (stalled && game.canAwaken() && game.pendingStones() >= Math.max(3, this.totalStones() * profile.awakenRatio)) {
      const stones = game.pendingStones();
      this.awakens++;
      this.hooks.awaken?.(stones, this);
      game.awaken();
      this.afterReset();
      for (;;) {
        const h = HEART.filter((x) => !game.heartMaxed(x.id)).sort((x, y) => game.heartCost(x.id) - game.heartCost(y.id))[0];
        if (!h || !game.buyHeart(h.id)) break;
      }
      this.equipRelics();
    }
    this.hooks.tick?.(this);
    game.events.length = 0;
    this.t += dt;
  }

  private afterReset() {
    this.lastProgress = this.t;
    this.lastMax = 0;
    this.stallSeen = false;
    this.activeUntil = Math.max(this.activeUntil, this.t + 300);
  }

  totalStones() {
    const { game } = this;
    return game.s.stones + HEART.reduce((a, h) => {
      let c = 0;
      for (let l = 0; l < game.heartLv(h.id); l++) c += h.cost(l);
      return a + c;
    }, 0);
  }

  private power() {
    const { game } = this;
    return game.baseDps() + game.clickDamage() * (this.active ? this.profile.cps : 0);
  }

  private shop() {
    const { game } = this;
    for (let k = 0; k < 100; k++) {
      let best: { buy: () => boolean; cost: number; score: number } | null = null;
      const p = this.power();
      for (let i = 0; i < COMPS.length; i++) {
        if (!game.compUnlocked(i) || i > game.s.revealed) continue;
        const cost = game.compCost(i);
        const gain = game.compNext(i);
        if (gain <= 0) continue;
        const score = cost / gain;
        if (!best || score < best.score) {
          best = {
            buy: () => {
              const mode = game.s.settings.buyMode;
              game.s.settings.buyMode = 1;
              const ok = game.buyComp(i);
              game.s.settings.buyMode = mode;
              return ok;
            },
            cost, score,
          };
        }
      }
      for (const u of game.shopUpgrades()) {
        const cost = game.upgCost(u);
        const e = u.effect;
        let gain = p * 0.05;
        if (e.t === 'comp') gain = game.compDps(e.comp);
        else if (e.t === 'click') gain = this.active ? game.clickDamage() * this.profile.cps : 0.001;
        else if (e.t === 'global') gain = p * e.pct;
        const score = cost / Math.max(gain, 1e-9);
        if (!best || score < best.score) best = { buy: () => game.buyUpg(u.id), cost, score };
      }
      if (!best || best.cost > game.s.gold) return;
      best.buy();
    }
  }

  private equipRelics() {
    const { game } = this;
    game.s.equipped = RELIC_PICK.filter((id) => game.relicLv(id) > 0).slice(0, game.relicSlots());
    game.invalidate();
  }
}
