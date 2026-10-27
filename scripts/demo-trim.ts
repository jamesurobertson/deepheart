/**
 * The demo build's last step (vite.config.ts, with VITE_DEMO=1): takes out what public/ copied in for the full game.
 * The music of the zones past floor 30 and the Keep goes, and the art of the full game's companions, Spirits and
 * monsters is cleared from the sprite sheet (and its names from atlas.txt), unless the demo's code still names it.
 */
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { COMPS, LEGENDS, ZONES } from '../src/game/data.ts';
import { DEMO_COMPANIONS, DEMO_LAST_FLOOR } from '../src/demo.ts';
import { readPng, writePng } from './png.ts';

const FULL_GAME_MUSIC = ['tomb', 'rotting', 'grove', 'demon', 'frozen', 'keep'];

/** Sprites only the full game's data uses (data.ts here is the full game's: there's no __DEMO__ under Node). */
function fullGameSprites() {
  const demoZones = ZONES.slice(0, DEMO_LAST_FLOOR / 10);
  return new Set([
    ...COMPS.slice(DEMO_COMPANIONS).map((c) => c.sprite),
    ...LEGENDS.map((d) => d.sprite),
    ...ZONES.flatMap((z, i) => [...(i < demoZones.length ? [] : [...z.band, z.mid, z.boss]), ...z.lap].map((m) => m.sprite)),
  ]);
}

export const demoTrim = (): Plugin => {
  let config: ResolvedConfig;
  return {
    name: 'demo-trim',
    apply: 'build',
    configResolved(c) {
      config = c;
    },
    closeBundle() {
      const out = config.build.outDir;
      for (const t of FULL_GAME_MUSIC) rmSync(join(out, 'assets/music', `${t}.mp3`), { force: true });

      const code = readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(out, 'assets', f), 'utf8')).join('\n');
      const named = (sprite: string) => new RegExp(`["'\`]${sprite}["'\`]`).test(code);
      const gone = [...fullGameSprites()].filter((sprite) => !named(sprite));
      const frameOf = (line: string) => gone.some((sprite) => line === sprite || new RegExp(`^${sprite}_([a-z]+_)?anim_f\\d+$`).test(line));

      const listPath = join(out, 'assets/sprites/atlas.txt');
      const sheetPath = join(out, 'assets/sprites/atlas.png');
      const lines = readFileSync(listPath, 'utf8').trim().split('\n');
      const sheet = readPng(sheetPath);
      const kept = lines.filter((line) => {
        const [name, x, y, w, h] = line.split(' ');
        if (!frameOf(name)) return true;
        for (let row = +y; row < +y + +h; row++) sheet.data.fill(0, (row * sheet.w + +x) * 4, (row * sheet.w + +x + +w) * 4);
        return false;
      });
      writePng(sheetPath, sheet);
      writeFileSync(listPath, kept.join('\n') + '\n');
      config.logger.info(`demo-trim: ${gone.length} full-game sprites (${lines.length - kept.length} frames) and ${FULL_GAME_MUSIC.length} tracks taken out`);
    },
  };
};
