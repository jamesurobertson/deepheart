import { open, settle } from '../lib/browser.mjs';
import { prepare, film, fight } from '../lib/stage.mjs';

// Rampage unleashed, held down to its top tier.
export default async function rampage(ctx) {
  await open(ctx, 'slot=tr-rampage');
  await prepare(ctx.page);
  await ctx.page.evaluate(() => {
    const g = window.game;
    // Tougher monsters here: a Rampage triples the party's damage.
    const { floor } = window.__small({ perMonster: 8 });
    g.goFloor(floor - 1);
    g.s.fervor = 1;
  });
  await settle(ctx, 2);
  await film(ctx, 'rampage', 5, {
    rate: 0.06,
    tick: (t, cur) => fight(t, cur, ctx.page),
    actions: [
      { at: 0.4, run: () => ctx.page.evaluate(() => window.game.unleashRampage()) },
      { at: 1.4, run: () => ctx.page.evaluate(() => { window.game.rampageClicks = 19; }) },
    ],
  });
}
