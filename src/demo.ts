/** The demo build (`npm run build:demo`, VITE_DEMO=1): the game up to the floor-30 boss. Beating it and taking the
 *  stairs down ends the demo; the companions after the Blade Dancer stay locked. */
export const DEMO = import.meta.env.VITE_DEMO === '1';
export const DEMO_LAST_FLOOR = 30;
/** Companions from this place in the roster on (the Corsair Captain, after the Blade Dancer) are in the full game. */
export const DEMO_COMPANIONS = 8;
/** The demo's first card is sure to drop, from a monster killed somewhere in this stretch of kills, any one as likely as
 *  the next: anywhere in the demo (25 kills a floor, so it always lands before the floor-30 boss). */
export const DEMO_FIRST_CARD = { from: 1, by: 700 };
/** Where the end screen sends you. A placeholder (a store search) until the Steam app and its page exist. */
export const STEAM_URL = 'https://store.steampowered.com/search/?term=Deepheart';
