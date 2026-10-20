import { open, settle } from '../lib/browser.mjs';
import { prepare, film, fight } from '../lib/stage.mjs';

// Early on: you and your first two companions on floor 6, close up, clicked by hand.
export default async function fresh(ctx) {
  await open(ctx, 'slot=tr-fresh');
  await prepare(ctx.page);
  await ctx.page.evaluate(() => {
    const g = window.game;
    Object.assign(g.s, { maxFloor: 6, bestFloor: 6, bestCleared: 5, auto: false, revealed: 2, hero: 0 });
    g.s.owned = g.s.owned.map((_, i) => [14, 6][i] ?? 0);
    g.invalidate();
    g.goFloor(6);
    window.scene.rebuild(g);
  });
  await settle(ctx, 3);
  await film(ctx, 'fresh', 4.5, { tick: (t, cur) => fight(t, cur, ctx.page), zoom: { x: 200, y: 205, width: 640, height: 360 } });
}
