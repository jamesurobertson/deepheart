import { open, settle } from '../lib/browser.mjs';
import { prepare, film, fight } from '../lib/stage.mjs';

// A Frost Imp's card, at full width: the camera pushes in as it spins out of an imp, holds on the flip, and pulls back
// out as the card flies into the Collection button.
const FULL = { x: 0, y: 0, width: 1280, height: 720 };
const CLOSE = { width: 720, height: 405 };
const PUSH_IN = 0.8;
// The reveal holds 2.3 s, then flies to the dock in 0.5 s (style.css, .card-reveal).
const PULL_OUT_AT = 2.25;
const PULL_OUT = 0.55;

const smooth = (k) => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};
const lerp = (a, b, k) => a + (b - a) * k;

export default async function frostcard(ctx) {
  await open(ctx, 'slot=tr-frostcard&cards=often');
  await prepare(ctx.page);
  const { fieldW, dockTop } = await ctx.page.evaluate(() => {
    const g = window.game;
    const { ZONES, cardId } = window.__data;
    // The Frozen Vault, its room full of the icy monsters from deeper down, mostly imps.
    const frozen = ZONES[7];
    const [imp, brute, ghost] = frozen.lap;
    frozen.band = [imp, imp, imp, brute, ghost];
    window.__small({ look: 74 });
    const impCard = cardId(imp.name);
    // The card drops from an imp, once asked for, found deep into a long run.
    g.cardKill = () => 11207;
    const giveCard = g.giveCard.bind(g);
    g.rollCard = (id, champ, src) => {
      if (!window.__dropNext || id !== impCard || src !== 'kill') return;
      window.__dropNext = false;
      giveCard(id, false, 'kill');
    };
    return { fieldW: window.ui.field.w, dockTop: document.querySelector('.dock').getBoundingClientRect().top };
  });
  await settle(ctx, 1);

  let close = null;
  let dropT = -1;
  let revealT = -1;
  let picked = -1;
  let cam = FULL;
  await film(ctx, 'frostcard', 9, {
    camera: () => cam,
    actions: [{ at: 1, run: () => ctx.page.evaluate(() => { window.__dropNext = true; }) }],
    tick: async (t, cur) => {
      if (!close) {
        // Where the card first shows: the imp it spun out of.
        const at = await ctx.page.evaluate(() => {
          const l = window.scene.loot.find((l) => l.ev.t === 'card');
          return l ? window.scene.toScreen(l.group.position.clone().setY(0.6)) : null;
        });
        if (at) {
          dropT = t;
          // Centred on the imp, kept inside the room (clear of the party panel and the dock below, whose Collection
          // button bounces when the card is picked up), with the reveal in its middle.
          const x = Math.min(Math.max(at.x - CLOSE.width / 2, 0), fieldW - CLOSE.width);
          const y = Math.min(Math.max(at.y - CLOSE.height / 2, 0), dockTop - 8 - CLOSE.height);
          close = { x, y, ...CLOSE };
          await ctx.page.evaluate((mid) => { window.scene.centerScreen = () => mid; }, { x: x + CLOSE.width / 2, y: y + CLOSE.height / 2 });
        }
      }
      if (revealT < 0 && (await ctx.page.evaluate(() => !!document.querySelector('.card-reveal')))) revealT = t;
      const zoomedIn = close ? smooth((t - dropT) / PUSH_IN) : 0;
      const pulledOut = revealT >= 0 ? smooth((t - revealT - PULL_OUT_AT) / PULL_OUT) : 0;
      const k = zoomedIn * (1 - pulledOut);
      const to = close ?? FULL;
      // Whole pixels, 16:9 exactly: anything else comes out a pixel off 1920×1080, which breaks the clip.
      const sixteenths = Math.round(lerp(FULL.width, to.width, k) / 16);
      cam = { x: Math.round(lerp(0, to.x, k)), y: Math.round(lerp(0, to.y, k)), width: sixteenths * 16, height: sixteenths * 9 };

      const card = picked < 0 ? await ctx.page.evaluate(() => window.__landedCard()) : null;
      if (card) {
        await cur.release();
        cur.aim(card.x, card.y);
        if (Math.hypot(cur.c.x - card.x, cur.c.y - card.y) < 12) {
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
