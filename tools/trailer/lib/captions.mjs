// Captions, the title and the end card: HTML in the game's fonts, rendered frame-exact (every animation seeked to each
// 60 fps frame) as transparent PNGs to lay over the gameplay. Renders are cached by their HTML, so editing a caption
// re-renders only that one.
import crypto from 'node:crypto';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const FPS = 60;
const BAR = 1.3792;
const BEAT = BAR / 4;
const FONTS = new URL('../../../node_modules/@fontsource', import.meta.url).pathname;
const CACHE = new URL('../out/captions/', import.meta.url).pathname;

/** A pixel heart with an ink outline and a highlight, as crisp SVG rects. */
function heart(px) {
  const rows = ['..XX.XX..', '.XRRXRRX.', 'XRHRRRRRX', 'XRRRRRRRX', '.XRRRRRX.', '..XRRRX..', '...XRX...', '....X....'];
  const fill = { X: '#140a12', R: '#e8455f', H: '#ffb3c4' };
  const rects = rows.flatMap((row, y) => [...row].map((c, x) => (fill[c] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill[c]}"/>` : '')));
  return `<svg class="heart" viewBox="0 0 9 8" width="${9 * px}" height="${8 * px}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

const BASE_CSS = `
@font-face { font-family: 'Jersey 10'; src: url('file://${FONTS}/jersey-10/files/jersey-10-latin-400-normal.woff2'); }
@font-face { font-family: 'Silkscreen'; src: url('file://${FONTS}/silkscreen/files/silkscreen-latin-400-normal.woff2'); }
html, body { margin: 0; width: 1920px; height: 1080px; background: transparent; overflow: hidden; }
* { box-sizing: border-box; }
.gold {
  font-family: 'Jersey 10'; color: transparent; letter-spacing: 3px;
  background: linear-gradient(180deg, #fff6c8 0%, #ffd56a 38%, #f29a2e 70%, #d8641f 100%);
  -webkit-background-clip: text; background-clip: text;
}
/* The ink outline and glow sit on a copy behind the gradient text (shadows don't show through clipped text). */
.stack { position: relative; display: inline-block; }
.stack .ink { position: absolute; inset: 0; color: #140a12; font-family: 'Jersey 10'; letter-spacing: 3px;
  text-shadow: 0 6px 0 #140a12, 6px 0 0 #140a12, -6px 0 0 #140a12, 0 -6px 0 #140a12, 5px 5px 0 #140a12, -5px 5px 0 #140a12, 5px -5px 0 #140a12, -5px -5px 0 #140a12, 0 12px 0 #140a12, 0 0 48px rgba(255, 150, 60, 0.75); }
.stack .gold { position: relative; }
.sub { font-family: 'Jersey 10'; color: #fff0de; letter-spacing: 2px;
  text-shadow: 0 3px 0 #140a12, 3px 0 0 #140a12, -3px 0 0 #140a12, 0 -3px 0 #140a12, 0 5px 0 #140a12; }
.tag { font-family: 'Silkscreen'; color: #f3e2c6; letter-spacing: 8px; text-shadow: 0 3px 0 #140a12, 3px 0 0 #140a12, -3px 0 0 #140a12, 0 -3px 0 #140a12; }
@keyframes slam { 0% { transform: scale(1.7) rotate(-2deg); opacity: 0; } 60% { transform: scale(0.96) rotate(0.4deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes rise { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
@keyframes beat { 0%, 100% { transform: scale(1); } 12% { transform: scale(1.14); } 30% { transform: scale(1); } }
`;

/** A caption over gameplay: a dark band, a slammed gold line and an optional small line, gone by its end. */
function caption({ main, sub = '', seconds, top = false }) {
  const out = Math.max(0, seconds - 0.18);
  const size = main.length > 18 ? 104 : 128;
  return `<style>${BASE_CSS}
    .band { position: absolute; left: 0; right: 0; ${top ? 'top: 0; height: 28%;' : 'bottom: 0; height: 40%;'}
      background: ${top ? 'linear-gradient(0deg, transparent, rgba(8,4,10,0.82))' : 'linear-gradient(180deg, transparent, rgba(8,4,10,0.78))'};
      animation: fadein 0.15s both, fadeout 0.18s ${out}s both; }
    .cap { position: absolute; left: 0; right: 0; ${top ? 'top: 26px;' : 'bottom: 88px;'} text-align: center; animation: fadeout 0.18s ${out}s both; }
    .cap .stack { font-size: ${size}px; line-height: 1; animation: slam 0.26s cubic-bezier(.2,.9,.3,1) both; }
    .cap .ink, .cap .gold { font-size: ${size}px; }
    .cap .sub { display: block; margin-top: ${top ? 4 : 14}px; font-size: ${top ? 42 : 54}px; animation: rise 0.25s 0.16s both; }
    @keyframes fadeout { to { opacity: 0; transform: scale(1.04); } }
  </style>
  <div class="band"></div>
  <div class="cap"><span class="stack"><span class="ink">${main}</span><span class="gold">${main}</span></span>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
}

/** The opening: heart, the name slammed on beat three, the tagline on beat six. */
function title() {
  const beat = BEAT;
  return `<style>${BASE_CSS}
    body { background: radial-gradient(ellipse at 50% 55%, rgba(30, 12, 18, 0.35), rgba(6, 3, 6, 0.9) 70%); }
    .wrap { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; }
    .heart { animation: rise 0.3s both, beat ${beat * 2}s ${beat * 2}s infinite; filter: drop-shadow(0 0 24px rgba(232, 69, 95, 0.6)); }
    .name .stack { font-size: 300px; line-height: 0.9; animation: slam 0.3s ${beat * 2}s cubic-bezier(.2,.9,.3,1) both; }
    .name .ink, .name .gold { font-size: 300px; }
    .tag { font-size: 40px; animation: rise 0.3s ${beat * 5}s both; }
  </style>
  <div class="wrap">${heart(18)}
    <div class="name"><span class="stack"><span class="ink">DEEPHEART</span><span class="gold">DEEPHEART</span></span></div>
    <div class="tag">A DUNGEON CLICKER</div></div>`;
}

/** The close: name, the pitch, and coming soon. */
function end(seconds) {
  const beat = BEAT;
  return `<style>${BASE_CSS}
    body { background: radial-gradient(ellipse at 50% 50%, rgba(30, 12, 18, 0.55), rgba(6, 3, 6, 0.94) 72%); animation: fadein 0.4s both; }
    .wrap { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; text-align: center; }
    .top { display: flex; align-items: center; gap: 28px; animation: rise 0.35s both; }
    .heart { animation: beat ${beat * 2}s ${beat}s infinite; filter: drop-shadow(0 0 24px rgba(232, 69, 95, 0.6)); }
    .name .stack { font-size: 220px; line-height: 0.9; animation: slam 0.3s 0.1s cubic-bezier(.2,.9,.3,1) both; }
    .name .ink, .name .gold { font-size: 220px; }
    .pitch { font-size: 64px; animation: rise 0.3s ${beat * 2}s both; }
    .pitch em { font-style: normal; color: #ff7b5a; }
    .play { margin-top: 10px; padding: 18px 34px; border: 5px solid #f2b44a; background: rgba(20, 10, 14, 0.85); box-shadow: 0 0 0 5px #140a12, 0 0 40px rgba(242, 180, 74, 0.35);
      font-family: 'Silkscreen'; font-size: 54px; letter-spacing: 8px; color: #ffe7b0; animation: rise 0.3s ${beat * 4}s both; }
    .fade { position: absolute; inset: 0; background: #000; animation: fadein 0.45s ${seconds - 0.45}s both; }
  </style>
  <div class="wrap">
    <div class="top">${heart(14)}<div class="name"><span class="stack"><span class="ink">DEEPHEART</span><span class="gold">DEEPHEART</span></span></div></div>
    <div class="sub pitch">Fight monsters. Hire heroes. Go <em>deeper</em>.</div>
    <div class="play">COMING SOON</div>
  </div><div class="fade"></div>`;
}


function html(card, seconds) {
  if (card === 'title') return title();
  if (card === 'end') return end(seconds);
  const c = typeof card.caption === 'string' ? { main: card.caption } : card.caption;
  return caption({ ...c, seconds });
}

let browser;
let page;

/** Renders a card lasting `bars` bars (cached) and returns the folder of its frames. A card is 'title', 'end', or
 *  { caption: 'TEXT' } / { caption: { main, sub, top } }. */
export async function renderCard(card, bars) {
  const seconds = bars * BAR;
  const doc = `<!doctype html><meta charset="utf-8"><body>${html(card, seconds)}</body>`;
  const n = Math.round(seconds * FPS);
  const dir = `${CACHE}${crypto.createHash('sha1').update(`${doc}|${n}`).digest('hex').slice(0, 12)}`;
  if (fs.existsSync(`${dir}/f${String(n - 1).padStart(5, '0')}.png`)) return dir;
  if (!browser) {
    browser = await puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: 'new',
      args: ['--use-angle=metal', '--enable-gpu', '--allow-file-access-from-files', '--hide-scrollbars'],
      defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    });
    page = await browser.newPage();
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/card.html`, doc);
  await page.goto(`file://${dir}/card.html`);
  await page.evaluate(() => document.fonts.ready);
  for (let k = 0; k < n; k++) {
    await page.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), (k * 1000) / FPS);
    await page.screenshot({ path: `${dir}/f${String(k).padStart(5, '0')}.png`, omitBackground: true });
  }
  console.log(`rendered ${typeof card === 'string' ? card : JSON.stringify(card.caption)}: ${n} frames`);
  return dir;
}

export async function closeCards() {
  await browser?.close();
  browser = undefined;
}
