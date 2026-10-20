import { open, settle } from '../lib/browser.mjs';
import { prepare, film } from '../lib/stage.mjs';

// The whole party deep down, sweeping floor after floor.
export default async function sweep(ctx) {
  await open(ctx, 'slot=tr-sweep');
  await prepare(ctx.page);
  await ctx.page.evaluate(() => {
    const g = window.game;
    const { floor } = window.__small({ look: 9 });
    g.goFloor(floor - 1);
    g.s.auto = true;
  });
  await settle(ctx, 1.5);
  await film(ctx, 'sweep', 5, { start: { x: 560, y: 420 } });
}
