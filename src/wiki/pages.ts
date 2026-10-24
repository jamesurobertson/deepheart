import { CALCULATOR } from './topics/calculator.ts';
import { COLLECTION_PAGES } from './topics/collections.ts';
import { DUNGEON_PAGES } from './topics/dungeon.ts';
import { OTHER_PAGES } from './topics/other.ts';
import { PARTY_PAGES } from './topics/party.ts';
import { SOUL_PAGES } from './topics/souls.ts';
import { SPIRIT_PAGES } from './topics/spirits.ts';

export interface Page {
  id: string;
  title: string;
  /** Sidebar group (detail pages sit under their parent's). */
  group: string;
  /** A detail page's list page. */
  parent?: string;
  /** One line for search results when the match is in the title. */
  summary?: string;
  body: () => string;
  /** Wires up the page's controls once it's on screen (the calculator). */
  mount?: (root: HTMLElement) => void;
}

export const GROUPS = ['Start here', 'The dungeon', 'Your party', 'Souls', 'Collections', 'Other'];

const navbox = () => {
  const rows = GROUPS.map((group) => {
    const pages = PAGES.filter((p) => p.group === group && !p.parent && p.id !== 'home');
    return pages.length ? `<div><span>${group}</span><p>${pages.map((p) => `<a href="#/${p.id}">${p.title}</a>`).join('')}</p></div>` : '';
  }).join('');
  return `<nav class="navbox"><b>Deepheart</b>${rows}</nav>`;
};

const home: Page = {
  id: 'home', group: 'Start here', title: 'Deepheart Wiki', summary: 'Every system in Deepheart, with the numbers behind it.',
  body: () => `<p class="lede">Everything in Deepheart and the numbers behind it. Search with the box at the top, or press <code>/</code>.</p>${navbox()}`,
};

export const PAGES: Page[] = [home, ...OTHER_PAGES.slice(0, 1), CALCULATOR, ...DUNGEON_PAGES, ...PARTY_PAGES, ...SOUL_PAGES, ...SPIRIT_PAGES, ...COLLECTION_PAGES, ...OTHER_PAGES.slice(1)];
