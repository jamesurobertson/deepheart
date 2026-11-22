import { t } from '../i18n/index.ts';
import { CALCULATOR } from './topics/calculator.ts';
import { COLLECTION_PAGES } from './topics/collections.ts';
import { DUNGEON_PAGES } from './topics/dungeon.ts';
import { OTHER_PAGES } from './topics/other.ts';
import { PARTY_PAGES } from './topics/party.ts';
import { SOUL_PAGES } from './topics/souls.ts';
import { SPIRIT_PAGES } from './topics/spirits.ts';

/** The sidebar's groups, in order. */
export const GROUPS = [
  { id: 'start', label: 'wiki.group.start' },
  { id: 'dungeon', label: 'wiki.group.dungeon' },
  { id: 'party', label: 'wiki.group.party' },
  { id: 'souls', label: 'wiki.group.souls' },
  { id: 'collections', label: 'wiki.group.collections' },
  { id: 'other', label: 'wiki.group.other' },
] as const;
export type GroupId = (typeof GROUPS)[number]['id'];

export interface Page {
  id: string;
  title: string;
  /** Sidebar group (detail pages sit under their parent's). */
  group: GroupId;
  /** A detail page's list page. */
  parent?: string;
  /** One line for search results when the match is in the title. */
  summary?: string;
  body: () => string;
  /** Wires up the page's controls once it's on screen (the calculator). */
  mount?: (root: HTMLElement) => void;
}

const navbox = () => {
  const rows = GROUPS.map((group) => {
    const pages = PAGES.filter((p) => p.group === group.id && !p.parent && p.id !== 'home');
    return pages.length ? `<div><span>${t(group.label)}</span><p>${pages.map((p) => `<a href="#/${p.id}">${p.title}</a>`).join('')}</p></div>` : '';
  }).join('');
  return `<nav class="navbox"><b>Deepheart</b>${rows}</nav>`;
};

const home: Page = {
  id: 'home', group: 'start', title: t('wiki.brand'), summary: t('wiki.home.summary'),
  body: () => `<p class="lede">${t('wiki.home.lede')}</p>${navbox()}`,
};

export const PAGES: Page[] = [home, ...OTHER_PAGES.slice(0, 1), CALCULATOR, ...DUNGEON_PAGES, ...PARTY_PAGES, ...SOUL_PAGES, ...SPIRIT_PAGES, ...COLLECTION_PAGES, ...OTHER_PAGES.slice(1)];
