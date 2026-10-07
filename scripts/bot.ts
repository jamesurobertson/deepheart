/**
 * A simulated player for the headless pacing tools: clicks for a while, buys whatever adds the most damage per gold,
 * slots the best relics, and prestiges once it stops making progress.
 */
import Decimal from 'break_infinity.js';
import { COST_GROWTH, Game, MANUAL_RATE, newSave, type GameEvent } from '../src/game/game.ts';
import { ABILITIES, COMPS, HEART, UPG_BY_ID } from '../src/game/data.ts';

export interface Profile {
  /** Attacks by hand per second while the player is active (the game caps it at MANUAL_RATE, i.e. holding the button). */
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
  /** Seconds of active play added after every prestige (default 300; a scheduled player sets 0). */
  resetActive?: number;
  /** Seconds between shop visits while idle (default 1; every second while playing actively). */
  shopEvery?: number;
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

/** Upgrade effects that change what everything else is worth. */
const DAMAGE_EFFECTS = new Set(['comp', 'global', 'syn', 'click', 'clickDps', 'trophy']);

/** Seconds at most between shop checks while saving up for something. */
const SHOP_RECHECK = 10;

/** A player's rough relic preference: raw power first, then the answers to boss modifiers. */
const RELIC_PICK = ['shard', 'oath', 'banner', 'slayer', 'whet', 'glass', 'hilt', 'pick', 'rot', 'drum', 'razor', 'hawk', 'cleaver', 'cage', 'purse', 'bait'];

export class Sim {
  readonly game = new Game(newSave());
  readonly dt: number;
  /** Ticks played; time is counted in whole ticks so it doesn't drift over a long run. */
  private ticks = 0;
  descents = 0;
  awakens = 0;
  private clickAcc = 0;
  private chestAcc = 0;
  /** Damage when last pushed back from a floor (auto went off), to know when to try again. */
  private failDps: Decimal | null = null;
  private activeUntil: number;
  private lastMax = 0;
  private lastProgress = 0;
  private stallSeen = false;

  readonly profile: Profile;
  private hooks: SimHooks;

  constructor(profile: Profile, hooks: SimHooks = {}, dt = 0.1) {
    this.profile = profile;
    this.hooks = hooks;
    this.dt = dt;
    this.activeUntil = profile.activeMin * 60;
  }

  /** Seconds played so far (time away doesn't count). */
  get t() {
    return this.ticks * this.dt;
  }

  /** A session starts: the player attacks by hand and uses abilities for this many seconds. */
  startSession(activeSeconds: number) {
    this.activeUntil = this.t + activeSeconds;
    // Back at the keyboard: have another go at whatever pushed you back.
    if (!this.game.s.auto) this.game.setAuto(true);
  }

  /** The player is away: the game pays it out the way it does for a real player (gold on the floor is banked first). */
  away(seconds: number) {
    const { game } = this;
    game.bankAllDrops();
    game.applyOffline(seconds);
    for (const ev of game.events) this.hooks.event?.(ev, this);
    game.events.length = 0;
    this.shop();
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
    this.runUntil(hours * 3600);
  }

  /** Play until this many seconds have been played in total. */
  runUntil(seconds: number) {
    while (this.t < seconds) this.step();
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
    if (game.events.some((ev) => ev.t === 'relic')) this.equipRelics();
    if (game.raid && Math.random() < profile.catchRate) game.catchRaid();
    // The Goblin Vault: send the hero in, and have them run chest to chest (about two a second, as the scene's hero does).
    if (game.vaultPick) game.enterVault(Math.max(0, game.heroIndex()));
    if (game.vault && (this.chestAcc += dt * 2) >= 1) {
      this.chestAcc = 0;
      const shut = game.vault.chests.find((c) => !c.open);
      if (shut) game.openChest(shut.id);
      else game.leaveVault();
    }
    // While playing, abilities (and a full Rampage) go off as soon as they're ready.
    if (this.active) for (const a of ABILITIES) if (a.kind === 'button') game.useAbility(a.id);
    if (this.active) game.unleashRampage();
    // Shopping once a simulated second is how a person plays, and keeps long runs fast.
    const every = this.active ? 1 : (profile.shopEvery ?? 1);
    if (Math.floor(this.t / every) !== Math.floor((this.t - dt) / every)) this.shop();
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
    if (stalled && game.canDescend() && (worthIt || game.s.curse)) {
      const souls = game.pendingSouls();
      this.descents++;
      this.hooks.descend?.(souls, this);
      game.descend(this.pickCurse());
      this.afterReset();
      for (;;) {
        const a = game.abyssList().filter((x) => game.abyssAvailable(x.id)).sort((x, y) => game.abyssCost(x.id) - game.abyssCost(y.id))[0];
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
    // Hooks see everything this step did, the bot's own purchases and prestiges included.
    for (const ev of game.events) {
      this.hooks.event?.(ev, this);
      if (ev.t === 'bossFail' || ev.t === 'retreat') this.failDps = game.baseDps();
    }
    // Pushed back (auto goes off): like a player, turn it on again once clearly stronger.
    if (!game.s.auto && this.failDps && game.baseDps().gte(this.failDps.times(1.5).plus(1))) {
      this.failDps = null;
      game.setAuto(true);
    }
    this.hooks.tick?.(this);
    game.events.length = 0;
    this.ticks++;
  }

  /** Every third ascent, try the least-beaten curse on offer (a player dipping into challenges now and then). */
  private pickCurse() {
    const { game } = this;
    if (this.descents % 3 !== 0) return null;
    const open = game.cursesOpen().filter((c) => game.curseTier(c.id) < 3);
    open.sort((a, b) => game.curseTier(a.id) - game.curseTier(b.id));
    return open[0]?.id ?? null;
  }

  private afterReset() {
    this.saveFor = null;
    this.lastProgress = this.t;
    this.lastMax = 0;
    this.stallSeen = false;
    this.activeUntil = Math.max(this.activeUntil, this.t + (this.profile.resetActive ?? 300));
  }

  totalStones() {
    const { game } = this;
    return game.s.stones + HEART.reduce((a, h) => {
      let c = 0;
      for (let l = 0; l < game.heartLv(h.id); l++) c += game.heartCost(h.id, l);
      return a + c;
    }, 0);
  }

  /** Attacks a second this player makes by hand right now. */
  private hand() {
    return this.active ? Math.min(this.profile.cps, MANUAL_RATE) : 0;
  }

  private power() {
    const { game } = this;
    return game.baseDps().plus(game.clickDamage().times(this.hand() + game.autoRate()));
  }

  /** Saving up: the best buy last time cost this much, so there's nothing to decide until the gold is there (re-checked
   *  every SHOP_RECHECK seconds anyway, and on a new deepest floor, which can bring new upgrades). */
  private saveFor: { gold: Decimal; until: number; floor: number } | null = null;

  private shop() {
    const { game } = this;
    const wait = this.saveFor;
    if (wait && game.s.gold.lt(wait.gold) && this.t < wait.until && game.s.maxFloor === wait.floor) return;
    this.saveFor = null;
    // Like a person, it hires a new face as soon as it can afford one, whatever the numbers say.
    for (let i = 0; i < COMPS.length; i++) {
      if (game.s.owned[i] === 0 && game.compUnlocked(i) && i < game.s.revealed && game.s.gold.gte(game.compCost(i))) game.buyComp(i, 1);
    }
    const step = Math.log10(COST_GROWTH);
    for (let pass = 0; pass < 40; pass++) {
      // Score everything once (log10 of gold per point of damage, so absurd numbers still compare), then buy down the
      // list in order: what a player does with the shop open. Re-score only after buying something.
      const p = this.power();
      const options: { comp?: number; upg?: string; cost: Decimal; score: number }[] = [];
      for (let i = 0; i < COMPS.length; i++) {
        if (!game.compUnlocked(i) || i > game.s.revealed) continue;
        const cost = game.compCost(i);
        const gain = game.compNext(i);
        if (gain.gt(0)) options.push({ comp: i, cost, score: cost.div(gain).log10() });
      }
      for (const u of game.shopUpgrades()) {
        const cost = new Decimal(game.upgCost(u));
        const e = u.effect;
        let gain = p.times(0.05);
        if (e.t === 'comp') gain = game.compDps(e.comp);
        else if (e.t === 'click') gain = game.clickDamage().times(Math.max(0.001, this.hand() + game.autoRate()));
        else if (e.t === 'auto') gain = game.clickDamage().times(e.add);
        else if (e.t === 'global') gain = p.times(e.pct);
        options.push({ upg: u.id, cost, score: cost.div(Decimal.max(gain, 1e-9)).log10() });
      }
      options.sort((a, b) => a.score - b.score);
      let bought = false;
      for (let k = 0; k < options.length; k++) {
        const o = options[k];
        // The best thing left is out of reach: save up for it rather than settle for something worse.
        if (o.cost.gt(game.s.gold)) {
          if (!bought) this.saveFor = { gold: o.cost, until: this.t + SHOP_RECHECK, floor: game.s.maxFloor };
          break;
        }
        if (o.upg) {
          if (!game.buyUpg(o.upg)) continue;
          bought = true;
          // An upgrade that changes damage changes every score after it: look again.
          if (DAMAGE_EFFECTS.has(UPG_BY_ID.get(o.upg)!.effect.t)) break;
          continue;
        }
        // A companion's next level costs ×COST_GROWTH more for the same damage, so it stays ahead of the next option
        // for this many levels: buy them in one go (×10 / Max), capped by the gold.
        const i = o.comp!;
        const next = options[k + 1]?.score ?? Infinity;
        const stays = Number.isFinite(next) ? Math.floor((next - o.score) / step) + 1 : Infinity;
        const first = game.compCost(i);
        const affordable = Math.floor(game.s.gold.times(COST_GROWTH - 1).div(first).plus(1).log10() / step);
        const n = Math.max(1, Math.min(stays, affordable, 1000));
        bought = game.buyComp(i, n) || game.buyComp(i, 1) || bought;
      }
      if (!bought) return;
    }
  }

  private equipRelics() {
    const { game } = this;
    game.s.equipped = RELIC_PICK.filter((id) => game.relicLv(id) > 0).slice(0, game.relicSlots());
    game.invalidate();
  }
}
