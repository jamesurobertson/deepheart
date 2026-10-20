// What every scene shares: the game loaded and tidied for filming, a staged mid-game party, a gliding cursor, and
// film() to record a take with a log of what was on screen.
import fs from 'node:fs';
import { record } from './browser.mjs';

export const TAKES = new URL('../out/takes/', import.meta.url).pathname;

// The floor panel (and its boss timer) stays out of the trailer.
// Upgrades unlocked mid-shot don't pile up on the shelf (two at most show).
const CLEAN_CSS = `.hint, .toasts, .ticker, .tip, .hud-top .floor, .upg-grid .upg:nth-child(n+3) { display: none !important; } body { cursor: none; }`;

// A modest mid-game party for the trailer, so every number on screen stays small (tens of thousands, not UDc).
export const PARTY = [60, 55, 70, 50, 45, 40, 35, 30, 25, 15, 5];

/** Installs window.__small({ look, perMonster }) in the page: the party above, standing on floor `look` (for its
 *  zone's look), with monster health rescaled so one takes the party about `perMonster` seconds, and gold to match
 *  the floor such a party would really be on. */
async function installSmall(page) {
  await page.evaluate((party) => {
    /** Buys out the shop, leaving its `keep` cheapest upgrades on the shelf (with gold enough for them). */
    window.__tidyUpgrades = (keep = 2) => {
      const g = window.game;
      const D = g.s.gold.constructor;
      const gold = g.s.gold;
      g.s.gold = new D('1e30');
      for (let pass = 0; pass < 6; pass++) {
        const shelf = g.shopUpgrades().filter((u) => !/^m\d+_\d+$/.test(u.id));
        if (shelf.length <= keep) break;
        for (const u of shelf.slice(keep)) g.buyUpg(u.id);
      }
      const left = g.shopUpgrades().filter((u) => !/^m\d+_\d+$/.test(u.id)).slice(0, keep);
      g.s.gold = left.reduce((most, u) => D.max(most, new D(g.upgCost(u)).times(1.2)), gold);
      g.invalidate();
    };
    window.__small = ({ look = 7, perMonster = 5, gold = 24000 } = {}) => {
      const g = window.game;
      const { floorHp, floorGold, TUNE } = window.__mod;
      const D = g.s.gold.constructor;
      g.s.owned = g.s.owned.map((_, i) => party[i] ?? 0);
      g.s.gold = new D('1e30');
      // Every trait the party's levels have reached (m<companion>_<k> opens at milestoneAt(k)).
      for (const u of window.__data.UPGRADES) {
        const m = /^m(\d+)_(\d+)$/.exec(u.id);
        if (m && (party[+m[1]] ?? 0) >= window.__data.milestoneAt(+m[2])) g.buyUpg(u.id);
      }
      // Standing on the floor first (some upgrades open by depth), then the shop bought out, then the damage measured.
      Object.assign(g.s, { maxFloor: look, bestFloor: look, bestCleared: look - 1, cycleBest: look, auto: false, revealed: party.length + 1, kills: Math.max(g.s.kills, 500) });
      window.__tidyUpgrades();
      g.s.gold = new D(gold);
      g.invalidate();
      const dps = g.dps().toNumber();
      const hp = dps * perMonster;
      let natural = 1;
      while (floorHp(natural + 1).toNumber() < hp) natural++;
      const coin = floorGold(natural).toNumber();
      Object.assign(TUNE, { deepFrom: 1e6, hpBase: Math.max(1.01, hp / 10 - (look - 1)) ** (1 / (look - 1)), goldGrowth: coin ** (1 / (look - 1)) });
      // Entered afresh even if already there (buying the shop can carry the run down early), so the monsters
      // spawn with the rescaled health.
      g.s.auto = false;
      g.enterFloor(look);
      window.scene.rebuild(g);
      return { dps, floor: look, natural, hp: floorHp(look).toNumber() };
    };
  }, PARTY);
}

/** Shared page helpers, installed after load. */
export async function prepare(page, { clean = true } = {}) {
  await page.evaluate(async (css) => {
    if (css) {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }
    // The very modules the game loaded (after an edit the dev server serves them with a ?t= stamp, a separate copy).
    const loaded = (file) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(file)) ?? file;
    window.__mod = await import(loaded('/src/game/game.ts'));
    window.__data = await import(loaded('/src/game/data.ts'));
    window.__screen = (v) => window.scene.toScreen(v);
    // Where to aim: the monster the party is fighting.
    window.__focus = () => {
      const f = window.game.focus();
      const at = f && window.scene.screenOf(f.id);
      return at ? { x: at.x, y: at.y + at.h * 0.45 } : null;
    };
    window.__landedCard = () => {
      const l = window.scene.loot.find((l) => l.ev.t === 'card' && l.landed && l.fly < 0);
      return l ? window.scene.toScreen(l.group.position.clone().setY(0.6)) : null;
    };
    window.__state = () => {
      const g = window.game;
      return { floor: g.s.floor, boss: g.monsters.some((m) => m.boss), bossTime: g.bossTime, vault: !!g.vault, raid: !!g.raid, card: !!document.querySelector('.card-reveal') };
    };
  }, clean ? CLEAN_CSS : '');
  await installSmall(page);
}

/** A cursor that glides toward its target, a little each frame, and can hold the button down. */
export function cursor(page, start) {
  const c = { x: start.x, y: start.y, tx: start.x, ty: start.y, down: false };
  return {
    c,
    aim(x, y) { c.tx = x; c.ty = y; },
    async frame(dt) {
      const k = 1 - Math.exp(-dt * 14);
      c.x += (c.tx - c.x) * k;
      c.y += (c.ty - c.y) * k;
      await page.mouse.move(c.x, c.y);
    },
    async press() { if (!c.down) { c.down = true; await page.mouse.down(); } },
    async release() { if (c.down) { c.down = false; await page.mouse.up(); } },
    async click() { await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.up(); },
  };
}

/** Record with a gliding cursor; `tick(t, cur)` runs every frame to steer it. The frame log rides along. */
export async function film(ctx, name, seconds, { start = { x: 400, y: 400 }, tick = async () => {}, actions = [], zoom = null, rate = 0.12 } = {}) {
  // A close-up would catch the edge of the dock (its buttons bounce up when something lands in them).
  if (zoom) await ctx.page.addStyleTag({ content: '.dock { display: none !important; }' });
  const cur = cursor(ctx.page, start);
  await ctx.page.mouse.move(start.x, start.y);
  let last = 0;
  const log = [];
  const frames = await record(ctx, {
    dir: `${TAKES}${name}`,
    seconds,
    zoom,
    rate,
    actions: [...actions.map((a) => ({ at: a.at, run: () => a.run(cur) })),
      // Every frame: steer, glide, and note what's on screen.
      ...Array.from({ length: Math.ceil(seconds * 140) }, (_, k) => ({ at: k / 140, run: async () => {
        const t = k / 140;
        await tick(t, cur);
        await cur.frame(t - last);
        last = t;
        log.push({ t, ...(await ctx.page.evaluate(() => window.__state())) });
      } }))],
  });
  fs.writeFileSync(`${TAKES}${name}/log.json`, JSON.stringify(log));
  await cur.release();
  return frames;
}

/** Keep the cursor on the monster being fought, button held. */
export const fight = async (t, cur, page) => {
  const at = await page.evaluate(() => window.__focus());
  if (at) cur.aim(at.x, at.y);
  await cur.press();
};
