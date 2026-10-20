import { open, settle } from '../lib/browser.mjs';
import { prepare, film, fight } from '../lib/stage.mjs';

// A boss against the clock, beaten with seconds to spare.
export default async function boss(ctx) {
  await open(ctx, 'slot=tr-boss');
  await prepare(ctx.page);
  await ctx.page.evaluate(() => {
    const g = window.game;
    // The Ogre Chieftain at the bottom of the first zone, a few seconds of real fighting.
    const { floor: best } = window.__small({ look: 10, perMonster: 1.4 });
    Object.assign(g.s, { maxFloor: best, bestFloor: best, auto: false });
    g.goFloor(best);
  });
  await settle(ctx, 0.2);
  // Once it's badly hurt, its clock is wound down to the wire, so it falls in the last three seconds: a clutch kill.
  await film(ctx, 'boss', 12, {
    tick: async (t, cur) => {
      await ctx.page.evaluate(() => {
        const g = window.game;
        const boss = g.monsters.find((m) => m.boss);
        if (boss && boss.hp.div(boss.max).toNumber() < 0.4 && g.bossTime > 2.4) g.bossTime = 2.4;
      });
      await fight(t, cur, ctx.page);
    },
  });
}
