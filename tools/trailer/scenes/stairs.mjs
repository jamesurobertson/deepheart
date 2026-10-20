import { open, settle } from '../lib/browser.mjs';
import { prepare, film } from '../lib/stage.mjs';

// Into the next zone: the party marches down the long stair between zones.
export default async function stairs(ctx) {
  await open(ctx, 'slot=tr-stairs');
  await prepare(ctx.page);
  await ctx.page.evaluate(() => window.__small({ look: 10 }));
  await settle(ctx, 1);
  await ctx.page.evaluate(() => {
    const g = window.game;
    const next = (Math.floor((g.s.floor - 1) / 10) + 1) * 10 + 1;
    Object.assign(g.s, { maxFloor: Math.max(g.s.maxFloor, next), bestFloor: Math.max(g.s.bestFloor, next) });
    g.goFloor(next);
  });
  await film(ctx, 'stairs', 9, { start: { x: 640, y: 380 } });
}
