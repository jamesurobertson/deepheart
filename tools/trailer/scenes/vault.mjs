import { open } from '../lib/browser.mjs';
import { prepare, film, fight } from '../lib/stage.mjs';

// A rainbow goblin, caught: into the Rainbow Vault, running the hall and bursting chests.
export default (ctx) => shootVault(ctx, 'vault');

/** The vault scene filmed as `take`, its "RAINBOW VAULT!" banner retitled `title` if given. */
export async function shootVault(ctx, take, { title } = {}) {
  await open(ctx, `slot=tr-${take}&goblin=rainbow`);
  await prepare(ctx.page);
  if (title) {
    await ctx.page.evaluate((retitled) => {
      const banner = window.ui.banner.bind(window.ui);
      window.ui.banner = (head, ...rest) => banner(head === 'RAINBOW VAULT!' ? retitled : head, ...rest);
    }, title);
  }
  await ctx.page.evaluate(() => {
    const g = window.game;
    const { floor } = window.__small();
    g.goFloor(floor - 1);
    g.s.raids = 1;
    g.s.vaults = 0;
  });
  // The vault's banner line, chest counter and way-out button stay out of the trailer.
  await ctx.page.addStyleTag({ content: '.banner span, .buff.vault, .vault-leave { display: none !important; }' });
  await ctx.page.waitForFunction(() => window.game.raid, { timeout: 30000 });
  let stage = 'catch';
  await film(ctx, take, 12, {
    tick: async (t, cur) => {
      if (stage === 'catch') {
        const at = await ctx.page.evaluate(() => window.scene.raiderScreen());
        if (!at) return fight(t, cur, ctx.page);
        await cur.release();
        cur.aim(at.x, at.y + 30);
        if (Math.hypot(cur.c.x - at.x, cur.c.y - at.y - 30) < 30) {
          stage = 'pick';
          await cur.click();
          await ctx.page.evaluate(() => window.game.raid && window.game.catchRaid());
        }
        return;
      }
      if (stage === 'pick') {
        const picking = await ctx.page.evaluate(() => window.game.vaultPick);
        if (picking && t > 0) {
          await ctx.page.evaluate(() => window.ui.enterVault(Math.max(0, window.game.heroIndex())));
          stage = 'run';
        }
        return;
      }
      // In the vault: lead the hero from chest to chest, nearest unopened first.
      const next = await ctx.page.evaluate(() => {
        const v = window.game.vault;
        const shut = v && v.chests.filter((c) => !c.open);
        if (!shut || !shut.length) return null;
        const views = window.scene.vaultChests ?? window.scene.chests;
        const view = views && views.get(shut[0].id);
        return view ? window.scene.toScreen(view.group.position.clone().setY(0.4)) : null;
      });
      if (next) cur.aim(next.x, next.y);
    },
  });
}
