/**
 * Saves are the same in every language: in each one (a fresh Node process with that language loaded before the game),
 * the pacing bot plays the same seeded run to floor 150 and an English save from before translation (with a buff that
 * still carries its old English name) is loaded and saved again. Every language must produce byte-identical saves.
 *   node scripts/i18n-saves.ts
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const url = (file: string) => JSON.stringify(pathToFileURL(file).href);

async function savesIn(code: string): Promise<string> {
  const script = `
    const i18n = await import(${url('src/i18n/index.ts')});
    const { EN_META } = await import(${url('src/i18n/en/index.ts')});
    const chain = [];
    let meta = EN_META;
    for (let code = ${JSON.stringify(code)}; code && code !== 'en';) {
      const file = (await import(${url('src/i18n/locales/')} + code + '.ts')).default;
      if (!chain.length) meta = file.meta;
      chain.push(file.messages);
      code = file.meta.extends;
    }
    i18n.activate(meta, chain);
    const { playTo } = await import(${url('scripts/bot.ts')});
    const { Game } = await import(${url('src/game/game.ts')});
    // Wall-clock times (when the run started, when it was saved) differ from one process to the next.
    const timeless = (value) => JSON.stringify(value, (_key, v) => (typeof v === 'number' && v > 1e12 && v < 1e13 ? 0 : v));
    const { save } = playTo(150);
    const played = timeless(save);
    const old = JSON.parse(played);
    old.buffs = [{ id: 'fever', name: 'Rampage', t: 5, dur: 10, dps: 2, click: 1, gold: 1 }];
    process.stdout.write(played + '\\n' + timeless(new Game(old).saveState()));`;
  const { stdout } = await run(process.execPath, ['--no-warnings', '--input-type=module', '-e', script], { maxBuffer: 64 << 20 });
  return stdout;
}

const codes = ['en', ...readdirSync('src/i18n/locales').filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, '')).sort()];
const results = await Promise.all(codes.map(async (code) => ({ code, out: await savesIn(code) })));
const english = results[0].out;
const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12);
const different = results.filter((r) => r.out !== english);
for (const r of results) console.log(`${r.code.padEnd(6)} ${hash(r.out)}${r.out === english ? '' : '  DIFFERS FROM ENGLISH'}`);
if (different.length) {
  console.log(`\nSaves differ in ${different.map((r) => r.code).join(', ')}: the game stores or decides something by displayed text.`);
  process.exit(1);
}
console.log(`\nSaves are byte-identical in all ${codes.length} languages.`);
