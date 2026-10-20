// A contact sheet of a take, to pick where its shot should start: out/sheets/<take>.jpg, a frame every half second.
//   node sheet.mjs opening [every seconds]
import fs from 'node:fs';
import { sheet } from './lib/edit.mjs';

const [take, every = '0.5'] = process.argv.slice(2);
const dir = new URL('./out/sheets/', import.meta.url).pathname;
fs.mkdirSync(dir, { recursive: true });
sheet(take, `${dir}${take}.jpg`, Number(every));
console.log(`${dir}${take}.jpg`);
