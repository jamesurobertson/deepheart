import { open, settle } from '../lib/browser.mjs';
import { prepare, film } from '../lib/stage.mjs';

// The very start, at full width: the Squire alone on the first floors, clicked by hand at an unhurried pace, a few hits
// a monster. In the party panel the Ranger is ready to hire (not bought) and the Dwarf Brawler is still a silhouette.
export const CLICK_EVERY = 0.6896; // two beats of the music, so the hits can land on the beat in the cut
export const FIRST_CLICK = 1;

export default async function opening(ctx) {
  await open(ctx, 'slot=tr-opening');
  await prepare(ctx.page);
  await ctx.page.evaluate(() => {
    const g = window.game;
    const D = g.s.gold.constructor;
    Object.assign(g.s, { floor: 2, maxFloor: 2, bestFloor: 2, bestCleared: 1, auto: false, revealed: 2, hero: 0, kills: 9, runGold: new D(60) });
    g.s.owned = g.s.owned.map((_, i) => (i === 0 ? 3 : 0));
    g.s.gold = new D(g.compQuote(1).cost).times(1.25).floor();
    g.invalidate();
    g.enterFloor(2);
    // A couple of clicks a monster (with the Squire's own swings), not the nine the real floor 2 takes.
    for (const m of g.monsters) m.hp = m.max = new D(6);
    window.scene.rebuild(g);
  });
  await settle(ctx, 2.5);
  const aim = async (cur) => {
    const at = await ctx.page.evaluate(() => window.__focus());
    if (at) cur.aim(at.x, at.y);
  };
  await film(ctx, 'opening', FIRST_CLICK + CLICK_EVERY * 7, {
    start: { x: 520, y: 470 },
    tick: (t, cur) => aim(cur),
    actions: Array.from({ length: 7 }, (_, k) => ({ at: FIRST_CLICK + k * CLICK_EVERY, run: (cur) => cur.click() })),
  });
}
