import { open, settle } from '../lib/browser.mjs';
import { prepare, film, fight } from '../lib/stage.mjs';

// A young party on floor 14, and a new companion hired from the panel.
export default async function hire(ctx) {
  await open(ctx, 'slot=tr-hire');
  await prepare(ctx.page);
  await ctx.page.evaluate(() => {
    const g = window.game;
    const D = g.s.gold.constructor;
    Object.assign(g.s, { maxFloor: 9, bestFloor: 9, bestCleared: 8, auto: false, revealed: 4, hero: 0 });
    g.s.owned = g.s.owned.map((_, i) => [24, 17, 11][i] ?? 0);
    window.__tidyUpgrades();
    g.s.gold = D.max(g.s.gold, new D(2600));
    g.invalidate();
    g.goFloor(9);
    window.scene.rebuild(g);
  });
  await settle(ctx, 3);
  const row = await ctx.page.evaluate(() => {
    const el = document.querySelector('.gen[data-comp="3"]');
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width * 0.45, y: r.top + r.height * 0.5 };
  });
  await film(ctx, 'hire', 4.5, {
    tick: async (t, cur) => {
      if (t < 1.1 || t > 2.6) return fight(t, cur, ctx.page);
      await cur.release();
      cur.aim(row.x, row.y);
    },
    actions: [{ at: 1.75, run: (cur) => cur.click() }],
  });
}
