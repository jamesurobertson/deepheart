/**
 * Pacing test: simulates a few kinds of player and fails if the game goes quiet for too long,
 * prestiges pay too little, or replaying a run isn't clearly faster.
 *   node scripts/pace.ts [hours=8]            all profiles in parallel, exit 1 on any failure
 *   node scripts/pace.ts 8 --profile casual   one profile, as JSON (used by the parallel run)
 * TUNE='{"deepHp":1.17}' overrides pacing knobs, SEED=n changes the dice.
 */
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TUNE } from '../src/game/game.ts';
import { COMPS, UPGRADES, relicStars } from '../src/game/data.ts';
import { duration } from '../src/game/format.ts';
import { Sim, seedRandom, type Profile } from './bot.ts';

const PROFILES: Record<string, Profile & { earlyGap?: number }> = {
  // Holding the attack down for the first half hour (then 5 minutes after every prestige); the Phantom Blade after that.
  active: { cps: 5, activeMin: 30, descendRatio: 0, descendGain: 0.5, awakenRatio: 1, stall: 120, catchRate: 0.05 },
  casual: { cps: 5, activeMin: 10, descendRatio: 0, descendGain: 0.5, awakenRatio: 1, stall: 180, catchRate: 0.03 },
  // Barely watching, so a quiet stretch early on matters less.
  idle: { cps: 0, activeMin: 0, descendRatio: 0, descendGain: 0.5, awakenRatio: 1, stall: 300, catchRate: 0.01, earlyGap: 10 * 60 },
};

/** The targets. A gap is time with nothing you've never had before: floor, companion, relic or relic star, upgrade, abyss or Heart power. */
const TARGET = {
  /** Longest gap allowed when it starts in the first hour (before any awakening), and after that. */
  earlyGap: 5 * 60,
  lateGap: 15 * 60,
  /** The first descent on offer (when the first run stalls) should add at least this much damage. */
  firstDescent: 0.5,
  /** The next run should reach the last run's deepest floor in at most this share of the time. */
  replay: 0.5,
  /** Runs checked for the replay target (the onboarding stretch; later runs are reported). */
  replayRuns: 3,
};

/** Companion milestones never end, so 'every upgrade' means everything up to the level-2000 milestone. */
const CORE_UPGRADES = new Set(UPGRADES.filter((u) => u.req.t !== 'owned' || u.req.n <= 2000).map((u) => u.id));

interface Run {
  start: number;
  /** Seconds after the start of the run that each floor was first reached. */
  reached: Record<number, number>;
  best: number;
  /** Damage gained by the descent that ended this run (undefined for awakenings and the last run). */
  gain?: number;
  endedBy?: 'descend' | 'awaken';
}

interface Report {
  name: string;
  hours: number;
  gaps: { from: number; to: number; endedBy: string }[];
  runs: Run[];
  curve: [number, number][];
  allRelicsAt: number | null;
  /** Damage the first descent offered when the first run stalled. */
  firstOffer: number | null;
  /** When the first awakening happened (null if never). */
  firstAwaken: number | null;
  /** After each awakening, seconds until the deepest floor ever was beaten again (null if never). */
  recover: (number | null)[];
  allUpgradesAt: number | null;
  descents: number;
  awakens: number;
}

function simulate(name: string, hours: number): Report {
  if (process.env.TUNE) Object.assign(TUNE, JSON.parse(process.env.TUNE));
  seedRandom(Number(process.env.SEED ?? 1));
  const gaps: Report['gaps'] = [];
  const runs: Run[] = [{ start: 0, reached: {}, best: 0 }];
  const curve: [number, number][] = [];
  let lastNew = 0;
  let bestEver = 0;
  let revealedEver = 0;
  let relicsEver = 0;
  const owned = new Set<string>();
  const firstTime = (t: number, key: string, why: string) => {
    if (owned.has(key)) return;
    owned.add(key);
    fresh(t, why);
  };
  let allRelicsAt: number | null = null;
  let allUpgradesAt: number | null = null;
  let firstOffer: number | null = null;
  let firstAwaken: number | null = null;
  const recover: Report['recover'] = [];
  let awakenedAt = -1;
  let awakenBest = 0;
  const fresh = (t: number, why: string) => {
    gaps.push({ from: lastNew, to: t, endedBy: why });
    lastNew = t;
  };
  const endRun = (t: number, endedBy: Run['endedBy'], gain?: number) => {
    const run = runs[runs.length - 1];
    run.endedBy = endedBy;
    run.gain = gain;
    runs.push({ start: t, reached: {}, best: 0 });
  };
  const sim = new Sim(PROFILES[name], {
    stall({ game }) {
      if (firstOffer === null && game.canDescend()) firstOffer = sim.descentGain();
    },
    descend(souls, { game, t }) {
      const power = game.soulPower();
      endRun(t, 'descend', (1 + power * (game.s.souls + souls)) / (1 + power * game.s.souls) - 1);
    },
    awaken(_stones, { game, t }) {
      endRun(t, 'awaken');
      firstAwaken ??= t;
      if (awakenedAt >= 0) recover.push(null);
      awakenedAt = t;
      awakenBest = game.s.bestFloor;
    },
    tick({ game, t }) {
      const run = runs[runs.length - 1];
      if (game.s.maxFloor > run.best) {
        for (let f = run.best + 1; f <= game.s.maxFloor; f++) run.reached[f] = t - run.start;
        run.best = game.s.maxFloor;
      }
      if (awakenedAt >= 0 && game.s.bestFloor > awakenBest) {
        recover.push(t - awakenedAt);
        awakenedAt = -1;
      }
      if (game.s.bestFloor > bestEver) {
        bestEver = game.s.bestFloor;
        fresh(t, `floor ${bestEver}`);
      }
      if (game.s.revealed > revealedEver) {
        revealedEver = game.s.revealed;
        fresh(t, COMPS[revealedEver - 1]?.name ?? 'companion');
      }
      if (game.relicsFound() > relicsEver) {
        relicsEver = game.relicsFound();
        fresh(t, `relic #${relicsEver}`);
        if (relicsEver === 16) allRelicsAt ??= t;
      }
      for (const id of game.s.upgrades) firstTime(t, `u:${id}`, 'new upgrade');
      for (const id of game.s.abyss) firstTime(t, `a:${id}`, 'new abyss power');
      for (const id of Object.keys(game.s.heart)) firstTime(t, `h:${id}`, 'new Heart power');
      for (const [id, lv] of Object.entries(game.s.relics)) if (relicStars(lv)) firstTime(t, `s:${id}:${relicStars(lv)}`, 'relic star');
      if (game.s.upgrades.filter((id) => CORE_UPGRADES.has(id)).length === CORE_UPGRADES.size) allUpgradesAt ??= t;
      if (Math.floor(t / 900) !== Math.floor((t - sim.dt) / 900)) curve.push([t, game.s.bestFloor]);
    },
  });
  sim.run(hours);
  fresh(sim.t, 'end of run');
  if (awakenedAt >= 0) recover.push(null);
  return { name, hours, gaps: gaps.filter((g) => g.to - g.from > 60), runs, curve, allRelicsAt, allUpgradesAt, firstOffer, firstAwaken, recover, descents: sim.descents, awakens: sim.awakens };
}

interface Check {
  ok: boolean;
  line: string;
}

function judge(r: Report): Check[] {
  const checks: Check[] = [];
  const m = (s: number) => duration(s);

  const early = Math.min(3600, r.firstAwaken ?? Infinity);
  const limit = (g: Report['gaps'][number]) => (g.from < early ? PROFILES[r.name].earlyGap ?? TARGET.earlyGap : TARGET.lateGap);
  const bad = r.gaps.filter((g) => g.endedBy !== 'end of run' && g.to - g.from > limit(g));
  const longest = [...r.gaps].sort((a, b) => b.to - b.from - (a.to - a.from))[0];
  checks.push({
    ok: bad.length === 0,
    line: `quiet stretches: ${bad.length ? `${bad.length} too long` : 'none too long'} (longest ${m(longest.to - longest.from)} at ${m(longest.from)})` +
      bad.slice(0, 6).map((g) => `\n      ${m(g.from)} -> ${m(g.to)}  ${m(g.to - g.from)} (limit ${m(limit(g))}), ended by ${g.endedBy}`).join(''),
  });

  const descents = r.runs.filter((x) => x.endedBy === 'descend');
  const offer = r.firstOffer ?? 0;
  checks.push({
    ok: offer >= TARGET.firstDescent,
    line: `first descent offers +${Math.round(offer * 100)}% damage (needs +${TARGET.firstDescent * 100}%); payouts taken: ${descents.slice(0, 6).map((x) => `+${Math.round((x.gain ?? 0) * 100)}%`).join(' ')}${descents.length > 6 ? ' …' : ''}`,
  });

  const ratios: string[] = [];
  let replayBad = 0;
  for (let i = 0; i + 1 < r.runs.length - 1; i++) {
    const [prev, next] = [r.runs[i], r.runs[i + 1]];
    if (prev.endedBy !== 'descend') continue;
    const target = prev.best;
    const then = prev.reached[target];
    const now = next.reached[target];
    const ratio = now === undefined ? Infinity : now / then;
    if (i < TARGET.replayRuns && ratio > TARGET.replay) replayBad++;
    if (ratios.length < 8) ratios.push(`${Number.isFinite(ratio) ? ratio.toFixed(2) : 'never'}`);
  }
  checks.push({ ok: replayBad === 0, line: `replay speed (next run's time to the last run's best, first ${TARGET.replayRuns} must be ≤ ${TARGET.replay}): ${ratios.join(' ') || 'no descents'}` });
  return checks;
}

function print(r: Report, checks: Check[]) {
  const p = PROFILES[r.name];
  console.log(`\n== ${r.name}: ${p.activeMin ? `holds the attack for ${p.activeMin} min` : 'never attacks by hand'}, ${r.hours}h, ${r.descents} descents, ${r.awakens} awakenings`);
  for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.line}`);
  const content = [
    r.allRelicsAt === null ? 'relics not all found' : `all relics by ${duration(r.allRelicsAt)}`,
    r.allUpgradesAt === null ? 'upgrades (to the level-2000 milestones) never all bought in one run' : `all upgrades to the level-2000 milestones by ${duration(r.allUpgradesAt)}`,
  ];
  console.log(`  info  ${content.join(', ')}`);
  console.log(`  info  after each awakening, back past the old deepest floor in: ${r.recover.map((x) => (x === null ? 'never' : duration(x))).join(', ') || 'no awakenings'}`);
  const first = r.runs[0].reached;
  console.log(`  info  first run reaches floor ${[10, 20, 30, 50].map((f) => `${f} at ${first[f] === undefined ? 'never' : duration(first[f])}`).join(', ')}`);
  console.log(`  info  deepest floor every hour: ${r.curve.filter(([t]) => Math.round(t) % 3600 === 0).map(([t, f]) => `${Math.round(t / 3600)}h:${f}`).join(' ')}`);
}

const args = process.argv.slice(2);
const hours = Number(args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--profile') ?? 8);
const only = args.includes('--profile') ? args[args.indexOf('--profile') + 1] : null;

if (only) {
  console.log(JSON.stringify(simulate(only, hours)));
} else {
  const self = fileURLToPath(import.meta.url);
  const reports = await Promise.all(Object.keys(PROFILES).map((name) => new Promise<Report>((resolve, reject) => {
    execFile(process.execPath, [self, String(hours), '--profile', name], { maxBuffer: 64 << 20, env: process.env }, (err, out) => (err ? reject(err) : resolve(JSON.parse(out))));
  })));
  let failed = 0;
  for (const r of reports) {
    const checks = judge(r);
    failed += checks.filter((c) => !c.ok).length;
    print(r, checks);
  }
  console.log(failed ? `\n${failed} pacing check${failed > 1 ? 's' : ''} failed.` : '\nAll pacing checks passed.');
  process.exit(failed ? 1 : 0);
}
