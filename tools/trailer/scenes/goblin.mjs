import { open, settle } from '../lib/browser.mjs';
import { prepare, film, fight } from '../lib/stage.mjs';

// A treasure goblin dashes through and is caught with a click.
export default async function goblin(ctx) {
  await open(ctx, 'slot=tr-goblin');
  await prepare(ctx.page);
  await ctx.page.evaluate(() => {
    const g = window.game;
    const { floor } = window.__small();
    g.goFloor(floor - 1);
    g.s.raids = 0;
    // Only the cursor catches it (not the hero it runs past), and only once it's most of the way across.
    const catchRaid = g.catchRaid.bind(g);
    g.catchRaid = () => window.__letCatch && catchRaid();
    // The gold haul ("Treasure!"), not one of the timed buffs a goblin can also drop.
    g.rollReward = () => 'plunder';
  });
  await settle(ctx, 2);
  let caught = false;
  const room = 888;
  await film(ctx, 'goblin', 11, {
    actions: [{ at: 0.2, run: () => ctx.page.evaluate(() => { window.game.s.raidTimer = 0.05; }) }],
    tick: async (t, cur) => {
      const at = caught ? null : await ctx.page.evaluate(() => window.scene.raiderScreen());
      const from = await ctx.page.evaluate(() => window.game.raid?.from ?? 1);
      const across = at ? (from > 0 ? at.x / room : 1 - at.x / room) : 0;
      if (at && across > 0.4) {
        await cur.release();
        cur.aim(at.x, at.y + 30);
        if (across > 0.56 && Math.hypot(cur.c.x - at.x, cur.c.y - at.y - 30) < 30) {
          caught = true;
          await cur.click();
          // A click takes loot under the cursor first, and the floor is covered in coins.
          await ctx.page.evaluate(() => { window.__letCatch = true; return window.game.raid && window.game.catchRaid(); });
        }
        return;
      }
      await fight(t, cur, ctx.page);
    },
  });
}
