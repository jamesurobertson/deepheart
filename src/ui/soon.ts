import { STEAM_URL } from '../demo.ts';
import { HEART, LOGO } from './menu.ts';

/** Phones get a page instead of the game: it's made for a mouse and a big screen. */

// ?phone (dev only): the page in a desktop browser.
const FORCE = import.meta.env.DEV && new URLSearchParams(location.search).has('phone');
// The short side of the largest phones is about 430px; the smallest tablets' is 744px.
const PHONE_SHORT_SIDE = 540;

export const isPhone = () => FORCE || (matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < PHONE_SHORT_SIDE);

export function showComingSoon() {
  document.body.classList.add('soon-page');
  const page = document.createElement('main');
  page.className = 'soon';
  page.innerHTML = `${HEART}${LOGO}
    <p class="soon-line">Coming soon to Steam</p>
    <a class="btn primary soon-steam" href="${STEAM_URL}" target="_blank" rel="noopener">Steam</a>
    <p class="soon-note">Play free on a computer</p>`;
  document.body.appendChild(page);
}
