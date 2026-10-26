/**
 * A simulated player for the headless pacing tools: clicks for a while, buys whatever adds the most damage per gold,
 * slots the best relics, and prestiges once it stops making progress.
 */
import Decimal from 'break_infinity.js';
import { COST_GROWTH, Game, MANUAL_RATE, MARK_MOVE, newSave, TUNE, type GameEvent, type SaveState } from '../src/game/game.ts';
import { ABILITIES, COMPS, LEGEND_BY_ID, UPG_BY_ID, type BoundId, type LegendId } from '../src/game/data.ts';

export interface Profile {
  /** Attacks by hand per second while the player is active (the game caps it at MANUAL_RATE, i.e. holding the button). */
  cps: number;
  /** Minutes of active play at the start (and 5 more after every prestige). */
  activeMin: number;
  /** Descend once stalled if the souls on offer are at least this share of the souls already held. */
  descendRatio: number;
  /** Or, when set: descend once stalled if it grows the souls held by at least this share (1 soul counts from zero). */
  descendGain?: number;
  /** With descendGain: don't wait to stall (ascend as soon as it pays), and never for fewer than this many souls. */
  ascendEager?: boolean;
  ascendMin?: number;
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
  /** Which Legends it favors: an active player's (attacks, crits, streaks) or an idle one's (the Sleeper, the Patient).
   *  Default: active. */
  style?: 'active' | 'idle';
}

/** Legends in the order each kind of player wants them, and what a level of each power one is worth to them (the
 *  share of all damage it adds, roughly). */
const OLD_PREF: Record<'active' | 'idle', LegendId[]> = {
  active: ['fist', 'unbroken', 'hoard', 'needle', 'thinning', 'hourglass', 'wither', 'soulcaller', 'restless', 'lingering', 'haggler', 'lure', 'goblinking', 'collector', 'ronin', 'hungry', 'sleeper', 'patient', 'whirl', 'headsman', 'magpie', 'drummer', 'host'],
  idle: ['sleeper', 'patient', 'hoard', 'thinning', 'hourglass', 'wither', 'soulcaller', 'haggler', 'lure', 'goblinking', 'restless', 'lingering', 'collector', 'ronin', 'hungry', 'needle', 'fist', 'unbroken', 'whirl', 'headsman', 'magpie', 'drummer', 'host'],
};
const OLD_WORTH: Record<'active' | 'idle', Partial<Record<LegendId, number>>> = {
  active: { fist: 0.075, unbroken: 0.1, needle: 0.08, hoard: 0.04, goblinking: 0.01 },
  idle: { sleeper: 0.25, patient: 0.4, hoard: 0.04, goblinking: 0.01 },
};

export interface SimHooks {
  event?: (ev: GameEvent, sim: Sim) => void;
  /** The run has just stopped making progress (before the player decides what to do). */
  stall?: (sim: Sim) => void;
  descend?: (souls: number, sim: Sim) => void;
  awaken?: (bound: number, sim: Sim) => void;
  tick?: (sim: Sim) => void;
}

/** Someone who plays nonstop: always holding attack, using Rampage and every skill the moment they're ready, and
 *  ascending once stuck. */
export const NONSTOP: Profile = { cps: 5, activeMin: 0, descendRatio: 0, descendGain: 0.5, ascendMin: 5, awakenRatio: 1, stall: 180, catchRate: 0.5, resetActive: 0, shopEvery: 1 };

/** The save of a nonstop player the moment they first reach `floor` (or after `maxHours`), for trying a depth by hand
 *  with what you'd really have there (the dev build's ?sim=). Leaves Math.random as it found it. */
export function playTo(floor: number, maxHours = 48): { save: SaveState; hours: number } {
  const random = Math.random;
  seedRandom(1);
  const sim = new Sim(NONSTOP);
  sim.startSession(maxHours * 3600);
  while (sim.game.s.bestFloor < floor && sim.t < maxHours * 3600) sim.runUntil(sim.t + 10);
  Math.random = random;
  sim.game.bankAllDrops();
  return { save: sim.game.saveState(), hours: sim.t / 3600 };
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
const DAMAGE_EFFECTS = new Set(['comp', 'party', 'clickDps']);

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
  /** The depth of the last awakening: the bot awakens again only once it's past it. */
  private lastAwakenDepth = 0;
  /** Played and away time together (ms): the clock expeditions run on. */
  private clock = 0;

  readonly profile: Profile;
  private hooks: SimHooks;

  constructor(profile: Profile, hooks: SimHooks = {}, dt = 0.1) {
    this.profile = profile;
    this.hooks = hooks;
    this.dt = dt;
    this.activeUntil = profile.activeMin * 60;
    this.game.now = () => this.clock;
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
    this.clock += seconds * 1000;
    game.applyOffline(seconds);
    for (const ev of game.events) this.hooks.event?.(ev, this);
    game.events.length = 0;
    this.shop();
  }

  /** How much a descent right now would grow the souls held, as a fraction. */
  descentGain() {
    const { game } = this;
    return game.pendingSouls() / Math.max(1, game.s.souls);
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
    this.clock += dt * 1000;
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
      ? this.descentGain() >= profile.descendGain && game.pendingSouls() >= (profile.ascendMin ?? 1)
      : profile.descendRatio > 0 && game.pendingSouls() >= Math.max(10, game.s.souls * profile.descendRatio);
    if ((stalled || (profile.ascendEager && worthIt)) && game.canDescend() && (worthIt || game.s.curse)) {
      const souls = game.pendingSouls();
      this.descents++;
      this.hooks.descend?.(souls, this);
      this.gatherMarks();
      game.descend(this.pickCurse());
      this.afterReset();
      this.feedLegends();
    }
    // Awaken once stalled with the payout worth a share of what's been earned so far (the first time, as soon as it opens).
    if (stalled && game.canAwaken() && game.s.cycleBest >= this.lastAwakenDepth && game.pendingBound() >= Math.max(1, Math.ceil(game.s.boundEarned * profile.awakenRatio))) {
      this.lastAwakenDepth = game.s.cycleBest;
      const bound = game.pendingBound();
      this.awakens++;
      this.hooks.awaken?.(bound, this);
      game.awaken(true);
      this.afterReset();
      this.buyBound();
      this.equipRelics();
    }
    // Hooks see everything this step did, the bot's own purchases and prestiges included.
    for (const ev of game.events) {
      this.hooks.event?.(ev, this);
      if (ev.t === 'bossFail') this.failDps = game.baseDps();
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

  /** Spend every bound soul, as Clicker Heroes players do early on: the Pit Lord while a level costs at most half of
   *  what's left, the rest on the Ogre Chieftain (raw damage speeds the start of every run). With plenty to spend, a
   *  level in each of the Spirit boosters first. */
  private buyBound() {
    const { game } = this;
    while (game.boundPrice('pitlord') <= game.boundFree() / 2 && game.buyBound('pitlord'));
    if (game.s.boundEarned >= 30) {
      for (const id of ['lich', 'frost', 'golem', 'troll', 'ent', 'thing'] as BoundId[]) {
        while (!game.boundMaxed(id) && game.boundPrice(id) <= game.boundFree() / 8 && game.buyBound(id));
      }
    }
    while (game.buyBound('ogre'));
  }

  /** Before going away: everyone at the expedition level without an ability hunts the deepest floor they can sweep. */
  sendTrips() {
    const { game } = this;
    const skilled = new Set(ABILITIES.map((a) => a.comp));
    COMPS.forEach((_, i) => {
      if (skilled.has(i) || !game.canSend(i)) return;
      const dps = game.compDps(i);
      let floor = game.s.bestFloor;
      while (floor > 1 && (floor % 5 === 0 || game.tripRate(floor, dps) < 30)) floor--;
      game.sendTrip(i, floor);
    });
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
        else if (e.t === 'party') gain = game.baseDps().times(e.mult - 1);
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

  /** Spend souls on Legends: summon what this player favors (rerolling a little for it), level power ones while a
   *  level adds more than the souls it takes would as souls kept, and utility ones while they're cheap. */
  feedLegends() {
    const { game } = this;
    const style = this.profile.style ?? 'active';
    const pref = OLD_PREF[style];
    const worth = OLD_WORTH[style];
    for (let pass = 0; pass < 200; pass++) {
      const free = game.soulsFree();
      const offer = game.legendOffer();
      let did = false;
      if (offer.length && game.summonPrice() <= Math.max(1, free * 0.3)) {
        const best = [...offer].sort((a, b) => pref.indexOf(a) - pref.indexOf(b))[0];
        if (pref.indexOf(best) < 9 || game.rerollPrice() > free * 0.05) did = game.summonLegend(best);
        else did = game.rerollLegends();
      }
      for (const id of pref) {
        const lv = game.legendLv(id);
        if (!lv || game.legendMaxed(id)) continue;
        const def = LEGEND_BY_ID.get(id)!;
        const cost = game.legendLevelCost(id);
        if (cost > game.soulsFree()) continue;
        const p = worth[id];
        const keep = (cost * TUNE.soulPower) / game.soulMult();
        const buy = def.kind === 'power' ? p !== undefined && p / (1 + p * lv) > keep : def.kind === 'utility' && cost <= game.soulsFree() * 0.05;
        if (buy && game.levelLegend(id)) did = true;
      }
      if (!did) break;
    }
  }

  /** Before ascending: bring Heartmarks to whoever is carrying the party, while it costs little of the souls in hand. */
  private gatherMarks() {
    const { game } = this;
    if (!game.marksTotal()) return;
    let carrier = 0;
    for (let i = 1; i < COMPS.length; i++) if (game.compDps(i).gt(game.compDps(carrier))) carrier = i;
    while (game.marksTotal() > game.s.marks[carrier] && game.soulsFree() * 0.2 >= MARK_MOVE && game.moveMarkTo(carrier)) { /* keep going */ }
  }

  private equipRelics() {
    const { game } = this;
    game.s.equipped = RELIC_PICK.filter((id) => game.relicLv(id) > 0).slice(0, game.relicSlots());
    game.invalidate();
  }
}
