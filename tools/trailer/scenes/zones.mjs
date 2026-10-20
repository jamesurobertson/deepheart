import { open, settle } from '../lib/browser.mjs';
import { prepare, film, fight } from '../lib/stage.mjs';

// Four corrupted zones, one after another (each filmed once its stairway has played).
export default async function zones(ctx) {
  for (const [k, floor] of [24, 133, 226, 344].entries()) {
    await open(ctx, `slot=tr-zone${k}`);
    await prepare(ctx.page);
    await ctx.page.evaluate((f) => window.__small({ look: f }), floor);
    await ctx.page.waitForFunction(() => !window.scene.busy, { timeout: 60000 });
    await settle(ctx, 9);
    await ctx.page.waitForFunction(() => !window.scene.busy, { timeout: 60000 });
    await film(ctx, `zone${k}`, 2.6, { tick: (t, cur) => fight(t, cur, ctx.page) });
  }
}
