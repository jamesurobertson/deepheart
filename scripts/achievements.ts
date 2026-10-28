/** Prints the trophy list as Steam achievements (API name, display name, description) for pasting into Steamworks. */
import { TROPHIES } from '../src/game/data.ts';

const asCsv = process.argv.includes('--csv');
const rows = TROPHIES.map((trophy) => ({ api: `TROPHY_${trophy.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`, name: trophy.name, desc: trophy.desc }));
if (asCsv) {
  const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;
  console.log('api_name,name,description');
  for (const row of rows) console.log([row.api, quote(row.name), quote(row.desc)].join(','));
} else {
  for (const row of rows) console.log(`${row.api}\t${row.name}\t${row.desc}`);
}
console.error(`${rows.length} achievements`);
