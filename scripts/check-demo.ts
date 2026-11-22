/**
 * Looks through a built demo (npm run build:demo) for anything of the full game's: its companions, zones, monsters,
 * Spirits and Bound by name, a few words for its systems, and the music and art the demo leaves out.
 *   node scripts/check-demo.ts [dist-demo]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ABILITIES, BOUND, COMPS, LEGENDS, UPGRADES, ZONES, boundName } from '../src/game/data.ts';
import { DEMO_COMPANIONS, DEMO_LAST_FLOOR } from '../src/demo.ts';
import { contentSource, demoContentKeys } from './i18n-source.ts';

const dir = process.argv[2] ?? 'dist-demo';
const demoZones = ZONES.slice(0, DEMO_LAST_FLOOR / 10);
const allowed = new Set([
  ...COMPS.slice(0, DEMO_COMPANIONS).map((c) => c.name),
  ...demoZones.flatMap((z) => [z.name, ...z.band.map((m) => m.name), z.mid.name, z.boss.name]),
  ...UPGRADES.filter((u) => u.req.t === 'owned' && u.req.comp < DEMO_COMPANIONS).map((u) => u.name),
]);
const names = [
  ...COMPS.slice(DEMO_COMPANIONS).map((c) => c.name),
  ...ZONES.flatMap((z, i) => [...(i < demoZones.length ? [] : [z.name, ...z.band.map((m) => m.name), z.mid.name, z.boss.name]), ...z.lap.map((m) => m.name)]),
  ...LEGENDS.map((d) => d.name),
  ...BOUND.map(boundName),
  ...ABILITIES.filter((a) => a.comp >= DEMO_COMPANIONS).map((a) => a.name),
];
const words = ['Awaken', 'Expedition', 'Spirit', 'Heartmark', 'Heartmarks', 'Awakening', 'Awakenings', 'The Keep', 'Bound', 'bound soul', 'Dan', 'Victor'];
const forbidden = [...new Set([...names.filter((n) => !allowed.has(n)), ...words])];

const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(d, e.name)) : [join(d, e.name)]));
const all = files(dir);
const text = all.filter((f) => /\.(js|html|css|txt|json)$/.test(f));
let bad = 0;
for (const f of text) {
  const src = readFileSync(f, 'utf8');
  // As words, not inside the code's own names (canAwaken, tradeWithVictor).
  const hits = forbidden.map((w) => [w, src.match(new RegExp(`(?<![\\w$])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`, 'g'))?.length ?? 0] as const).filter(([, n]) => n);
  if (hits.length) {
    bad += hits.length;
    console.log(`${f}: ${hits.map(([w, n]) => `${w} ×${n}`).join(', ')}`);
  }
}
// Every translation is checked by key: no message of the full game's content (a name, a flavor line, a description) may be
// in the demo in any language. (Its words can't be: other languages reuse them in names the demo does have.)
const demoKeys = demoContentKeys();
const fullOnly = [...contentSource().full.keys()].filter((key) => !demoKeys.has(key));
const code = text.filter((f) => f.endsWith('.js')).map((f) => [f, readFileSync(f, 'utf8')] as const);
for (const [f, src] of code) {
  const leaked = fullOnly.filter((key) => src.includes(`${key}\\"`) || src.includes(`"${key}"`));
  if (leaked.length) {
    bad += leaked.length;
    console.log(`${f}: the full game's ${leaked.slice(0, 8).join(', ')}${leaked.length > 8 ? ` (+${leaked.length - 8})` : ''}`);
  }
}
for (const extra of ['wiki', 'assets/music/tomb.mp3', 'assets/music/keep.mp3']) {
  if (existsSync(join(dir, extra))) {
    bad++;
    console.log(`${join(dir, extra)} is in the demo`);
  }
}
console.log(bad ? `\n${bad} things from the full game in ${dir}` : `Nothing from the full game in ${dir} (${forbidden.length} names and words, ${fullOnly.length} content messages in every language checked, ${text.length} files).`);
process.exit(bad ? 1 : 0);
