// Cut a trailer from cuts/<name>.mjs into out/<name>.mp4 (or the path given).
//   node cut.mjs v2
import { cut } from './lib/edit.mjs';
import { closeCards } from './lib/captions.mjs';

const name = process.argv[2];
if (!name) throw new Error('which cut? e.g. node cut.mjs v2');
const { default: parts } = await import(`./cuts/${name}.mjs`);
const out = process.argv[3] ?? new URL(`./out/${name}.mp4`, import.meta.url).pathname;
try {
  await cut(name, parts, out);
} finally {
  await closeCards();
}
