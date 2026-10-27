/**
 * How a real person played, from the play log (src/record.ts), in the simulator's terms.
 *   node scripts/play-report.ts [logs/2026-10-27.jsonl ...]   (default: every file in logs/)
 */
import { readdirSync, readFileSync } from 'node:fs';

type Line = { at: number; e: string; [k: string]: unknown };

const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync('logs').filter((f) => f.endsWith('.jsonl')).sort().map((f) => `logs/${f}`);
const lines: Line[] = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Line)).sort((a, b) => a.at - b.at);
if (!lines.length) {
  console.log('No play log yet: play on the dev server for a few minutes.');
  process.exit(0);
}
const of = (e: string) => lines.filter((l) => l.e === e);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
const time = (s: number) => (s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`);

const minutes = of('min');
const active = sum(minutes.map((m) => m.active as number));
const idle = sum(minutes.map((m) => m.idle as number));
const keep = sum(minutes.map((m) => m.keep as number));
const clicks = sum(minutes.map((m) => m.clicks as number));
const played = active + idle + keep;
console.log(`${files.length} log file(s), ${of('start').length} session(s), ${time(played)} played (${minutes.length} minute snapshots)`);
if (played) console.log(`Active ${Math.round((active / played) * 100)}% · idle ${Math.round((idle / played) * 100)}% · in the Keep ${Math.round((keep / played) * 100)}%   clicks/s while active ${active ? (clicks / active).toFixed(1) : '-'}`);
const away = of('away').map((l) => l.secs as number);
if (away.length) console.log(`Time away: ${away.length} breaks, median ${time(median(away))}, longest ${time(Math.max(...away))}`);

const ascents = of('ascend');
if (ascents.length) {
  console.log(`\nAscents (${ascents.length}): run time, deepest floor, how long since it last went deeper, souls`);
  for (const a of ascents) console.log(`  #${a.ascents}  ${time(a.runSecs as number).padStart(5)}  floor ${String(a.floor).padStart(4)}  stalled ${time(a.stallSecs as number).padStart(5)}  ${a.souls} souls`);
  console.log(`  median: run ${time(median(ascents.map((a) => a.runSecs as number)))}, stalled ${time(median(ascents.map((a) => a.stallSecs as number)))} before ascending`);
}
for (const a of of('awaken')) console.log(`Awakening #${a.awakens}: +${a.bound} bound souls from a cycle that reached floor ${a.cycleBest}`);

const hires = of('hire');
const traits = of('trait');
console.log(`\nPurchases: ${hires.length} hires (${hires.filter((h) => !h.auto).length} by hand), ${traits.length} traits (${traits.filter((t) => !t.auto).length} by hand), ${of('spirit').length} Spirit levels, ${of('bound').length} Bound levels, ${of('mark').length} Heartmark moves`);
const skills = new Map<string, number>();
for (const s of of('skill')) skills.set(s.id as string, (skills.get(s.id as string) ?? 0) + 1);
if (skills.size) console.log(`Skills used: ${[...skills].map(([id, n]) => `${id} ${n}`).join(', ')}`);
const goblins = sum(minutes.map((m) => m.goblins as number)), escaped = sum(minutes.map((m) => m.escaped as number));
if (goblins + escaped) console.log(`Treasure goblins: caught ${goblins}, got away ${escaped} (${Math.round((goblins / (goblins + escaped)) * 100)}% caught)`);
const fails = of('bossFail').length, wins = of('bossWin').length;
console.log(`Bosses: ${wins} won, ${fails} failed, ${of('bossWin').filter((b) => b.clutch !== undefined).length} clutches`);
const trips = of('tripSend');
if (trips.length) console.log(`Expeditions: ${trips.length} sent, ${of('tripHome').length} home, ${sum(of('tripHome').map((t) => t.cards as number))} cards`);
console.log(`Cards: ${of('card').length} found (${of('card').filter((c) => c.gold).length} gold)`);

// Pace: floors gained per played minute, run by run (from the minute snapshots).
const runs: Line[][] = [];
for (const m of minutes) {
  const last = runs.at(-1)?.at(-1);
  if (!last || (m.runSecs as number) < (last.runSecs as number)) runs.push([m]);
  else runs.at(-1)!.push(m);
}
const paced = runs.filter((r) => r.length > 2);
if (paced.length) {
  console.log('\nRuns: minutes played, floors from → to');
  for (const r of paced.slice(-10)) console.log(`  ${String(r.length).padStart(3)}m  ${r[0].maxFloor} → ${r.at(-1)!.maxFloor}`);
}

console.log('\nFor the simulator (scripts/bot.ts Profile):');
console.log(`  cps ${active ? (clicks / active).toFixed(1) : '?'}, active share ${played ? (active / played).toFixed(2) : '?'}, catchRate ~${goblins + escaped ? (goblins / (goblins + escaped)).toFixed(2) : '?'}, stall before ascending ~${ascents.length ? Math.round(median(ascents.map((a) => a.stallSecs as number))) : '?'}s`);
