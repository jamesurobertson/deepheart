import { open, settle } from '../lib/browser.mjs';
import { prepare, film } from '../lib/stage.mjs';

// The Cards tab: every monster's card, scrolled, then the gold ones.
export default async function collection(ctx) {
  await open(ctx, 'state=awaken&slot=tr-collection');
  await prepare(ctx.page);
  // A binder full of cards, but the small party's numbers behind it.
  await ctx.page.evaluate(() => window.__small());
  await settle(ctx, 2);
  await film(ctx, 'collection', 5, {
    start: { x: 1100, y: 700 },
    zoom: { x: 213, y: 60, width: 853, height: 480 },
    actions: [
      { at: 0.15, run: () => ctx.page.evaluate(() => window.ui.openModal('cards')) },
    ],
    tick: async (t) => {
      // A slow drift down the grid.
      if (t > 0.7) await ctx.page.evaluate((dy) => { const m = document.querySelector('.modal-body, .modal .scroll, .modal'); if (m) m.scrollTop += dy; }, 1.3);
    },
  });
}
