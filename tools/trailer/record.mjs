// Record scenes from scenes/ into out/takes/ (the game's dev server must be running: npm run serve).
//   node record.mjs opening boss       just these
//   node record.mjs                    every scene
import fs from 'node:fs';
import { launch } from './lib/browser.mjs';

const dir = new URL('./scenes/', import.meta.url).pathname;
const all = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)).sort();
const asked = process.argv.slice(2);
const unknown = asked.filter((name) => !all.includes(name));
if (unknown.length) throw new Error(`no such scene: ${unknown.join(', ')} (scenes: ${all.join(', ')})`);

// 1280 wide keeps the game's compact layout (floor map centred over the room); the frames come out 1920×1080.
const ctx = await launch({ width: 1280, height: 720, dsf: 1.5 });
for (const name of asked.length ? asked : all) {
  console.log(`--- ${name}`);
  const { default: shoot } = await import(`${dir}${name}.mjs`);
  await shoot(ctx);
}
await ctx.browser.close();
