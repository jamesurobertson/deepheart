import { open, settle } from '../lib/browser.mjs';
import { prepare, film, fight } from '../lib/stage.mjs';

// A card spins out of a monster, lands face-up, and is picked up: the flip into the collection.
export default async function card(ctx) {
  await open(ctx, 'slot=tr-card&cards=often');
  await prepare(ctx.page);
  await ctx.page.evaluate(() => {
    const g = window.game;
    // In the Demon Gate, and the card that drops is its Chort (the red horned demon reads best at a glance).
    window.__small({ look: 64 });
    const giveCard = g.giveCard.bind(g);
    g.giveCard = (id, gold, src) => giveCard('chort', gold, src);
    // Found deep into a long run, not on kill #3.
    g.cardKill = () => 8214;
    g.cardRoll = () => {
      if (!window.__dropNext) return false;
      window.__dropNext = false;
      return true;
    };
    // The reveal centred in the open room, clear of the floor bar above and the party panel.
    const mid = { x: 444, y: 400 };
    window.scene.centerScreen = () => mid;
  });
  await settle(ctx, 1);
  let picked = -1;
  await film(ctx, 'card', 12, {
    zoom: { x: 28, y: 166, width: 832, height: 468 },
    actions: [{ at: 1, run: () => ctx.page.evaluate(() => { window.__dropNext = true; }) }],
    tick: async (t, cur) => {
      const card = picked < 0 ? await ctx.page.evaluate(() => window.__landedCard()) : null;
      if (card && t > 1.2) {
        await cur.release();
        cur.aim(card.x, card.y);
        const near = Math.hypot(cur.c.x - card.x, cur.c.y - card.y) < 12;
        if (near) {
          picked = t;
          await cur.click();
        }
        return;
      }
      if (picked >= 0 && t - picked < 3.5) return;
      await fight(t, cur, ctx.page);
    },
  });
}
