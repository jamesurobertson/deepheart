/**
 * Prints the trophy list as Steam achievements (API name, display name, description, hidden) for pasting into Steamworks.
 *   node scripts/achievements.ts [--csv]
 * --steam writes every language instead, for Steamworks → Achievements → Bulk Import/Export → Import Localization:
 * docs/steam/achievements-localization.csv (api_name, field, then one column per Steam language code) and one
 * docs/steam/achievements.<code>.json per language.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { TROPHIES } from '../src/game/data.ts';

// (The API name is the one the Steam build unlocks: "kill-1000" → "KILL_1000".)
const apiName = (id: string) => id.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;

interface Achievement { api: string; name: string; desc: string; hidden: boolean }

/** The trophies as a language shows them: data.ts loaded in a fresh Node process after that language is. */
function trophiesIn(code: string): { steam: string; achievements: Achievement[] } {
  const url = (file: string) => JSON.stringify(pathToFileURL(file).href);
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
    const { TROPHIES } = await import(${url('src/game/data.ts')});
    process.stdout.write(JSON.stringify({ steam: meta.steam, achievements: TROPHIES.map((trophy) => ({ id: trophy.id, name: trophy.name, desc: trophy.desc, hidden: !!trophy.hidden })) }));`;
  const out = JSON.parse(execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', script], { encoding: 'utf8', maxBuffer: 64 << 20 })) as { steam: string; achievements: (Omit<Achievement, 'api'> & { id: string })[] };
  return { steam: out.steam, achievements: out.achievements.map(({ id, ...rest }) => ({ api: apiName(id), ...rest })) };
}

if (process.argv.includes('--steam')) {
  const codes = ['en', ...readdirSync('src/i18n/locales').filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, '')).sort()];
  const languages = codes.map((code) => ({ code, ...trophiesIn(code) }));
  mkdirSync('docs/steam', { recursive: true });
  const rows = [['api_name', 'field', ...languages.map((language) => language.steam)].join(',')];
  for (const [i, trophy] of TROPHIES.entries()) {
    for (const field of ['name', 'description'] as const) {
      const cells = languages.map((language) => quote(field === 'name' ? language.achievements[i].name : language.achievements[i].desc));
      rows.push([apiName(trophy.id), field, ...cells].join(','));
    }
  }
  writeFileSync('docs/steam/achievements-localization.csv', `${rows.join('\n')}\n`);
  for (const language of languages) writeFileSync(`docs/steam/achievements.${language.code}.json`, `${JSON.stringify(language.achievements, null, 2)}\n`);
  console.error(`${TROPHIES.length} achievements in ${languages.length} languages → docs/steam/`);
} else {
  const rows = TROPHIES.map((trophy) => ({ api: apiName(trophy.id), name: trophy.name, desc: trophy.desc, hidden: trophy.hidden ? 1 : 0 }));
  if (process.argv.includes('--csv')) {
    console.log('api_name,name,description,hidden');
    for (const row of rows) console.log([row.api, quote(row.name), quote(row.desc), row.hidden].join(','));
  } else {
    for (const row of rows) console.log(`${row.api}\t${row.name}\t${row.desc}${row.hidden ? '\thidden' : ''}`);
  }
  console.error(`${rows.length} achievements`);
}
