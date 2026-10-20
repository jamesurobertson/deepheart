// Frame-accurate capture of the game: the page runs in slow motion (its clock, rAF, timers and CSS animations all
// scaled by one rate) while screenshots are taken as fast as Chrome can render, each stamped with game time.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const GAME = 'http://localhost:5199/';

// Injected before any game script: a virtual clock whose speed can change at runtime.
const TIME_WARP = `(() => {
  const realPerf = performance.now.bind(performance);
  const realDateNow = Date.now;
  let rate = 1, realBase = realPerf(), virtBase = realBase;
  const dateOffset = realDateNow() - realBase;
  const vnow = () => virtBase + (realPerf() - realBase) * rate;
  window.__setRate = (r) => { virtBase = vnow(); realBase = realPerf(); rate = r; };
  window.__vnow = vnow;
  performance.now = vnow;
  Date.now = () => Math.floor(dateOffset + vnow());
  const rAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => rAF(() => cb(vnow()));
  const sT = window.setTimeout.bind(window), sI = window.setInterval.bind(window);
  window.setTimeout = (fn, ms = 0, ...a) => sT(fn, ms / rate, ...a);
  window.setInterval = (fn, ms = 0, ...a) => sI(fn, ms / rate, ...a);
})();`;

export async function launch({ width, height, dsf = 1 }) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [...(process.env.GL === 'soft' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']), '--hide-scrollbars', '--mute-audio'],
    defaultViewport: { width, height, deviceScaleFactor: dsf },
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(TIME_WARP);
  const cdp = await page.createCDPSession();
  await cdp.send('Animation.enable');
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  // GPU screenshots come back at layout size whatever the pixel ratio, so the clip's scale asks for full resolution.
  const clip = { x: 0, y: 0, width, height, scale: dsf };
  return { browser, page, cdp, clip };
}

/** Change the page's speed: its clock, timers and every CSS animation together. */
export async function setRate({ page, cdp }, rate) {
  await page.evaluate((r) => window.__setRate(r), rate);
  await cdp.send('Animation.setPlaybackRate', { playbackRate: rate });
}

/** Let the game run at full speed for this much real time (setup that isn't filmed). */
export async function settle(ctx, seconds) {
  await setRate(ctx, 1);
  await new Promise((r) => setTimeout(r, seconds * 1000));
}

/**
 * Film `seconds` of game time into `dir` as JPEGs, running `actions` ({ at: game seconds, run: async (page) => {} })
 * as their time comes. Returns the frame list (file names in `dir`) with game-time stamps.
 */
export async function record(ctx, { dir, seconds, rate = 0.12, actions = [], quality = 94, zoom = null }) {
  const { page, cdp } = ctx;
  // A close-up films part of the page at a higher scale, so the output stays the same size and pixel-sharp.
  const clip = zoom ? { ...zoom, scale: (ctx.clip.width * ctx.clip.scale) / zoom.width } : ctx.clip;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const todo = [...actions].sort((a, b) => a.at - b.at);
  await setRate(ctx, rate);
  const t0 = await page.evaluate(() => window.__vnow());
  const frames = [];
  const started = Date.now();
  for (let k = 0; ; k++) {
    let t = (await page.evaluate(() => window.__vnow()) - t0) / 1000;
    while (todo.length && todo[0].at <= t) await todo.shift().run(page);
    t = (await page.evaluate(() => window.__vnow()) - t0) / 1000;
    if (t > seconds) break;
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, optimizeForSpeed: true, clip });
    const t1 = (await page.evaluate(() => window.__vnow()) - t0) / 1000;
    const file = `f${String(k).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(data, 'base64'));
    frames.push({ file, t: (t + t1) / 2 });
  }
  await setRate(ctx, 1);
  fs.writeFileSync(path.join(dir, 'frames.json'), JSON.stringify(frames));
  const fps = frames.length / seconds;
  console.log(`${path.basename(dir)}: ${frames.length} frames over ${seconds}s of game time (${fps.toFixed(0)} fps) in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  return frames;
}

/** Open the game (dev build) with query parameters, wait for it to be drawing. */
export async function open(ctx, query) {
  await ctx.page.goto(`${GAME}?${query}`, { waitUntil: 'networkidle0', timeout: 120000 });
  await ctx.page.waitForFunction(() => window.game && document.querySelector('canvas'), { timeout: 60000 });
}
