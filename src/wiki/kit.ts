/** Small builders the wiki's pages are written with. */
import { decimal, percent, t } from '../i18n/index.ts';

export const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** A section: its anchor, which stays English so links and URLs work in every language, and its title. */
export type Section = readonly [id: string, title: string];

export const h2 = ([id, title]: Section) => `<h2 id="${id}">${title}</h2>`;
export const h3 = ([id, title]: Section) => `<h3 id="${id}">${title}</h3>`;

/** A link to a page, or to one of its sections by the section's id. */
export const link = (page: string, text: string, section?: string) => `<a href="#/${page}${section ? `/${section}` : ''}">${text}</a>`;

/** A contents box for a page's sections (pass the same sections given to h2). */
export function toc(page: string, sections: Section[]) {
  return `<nav class="toc"><b>${t('wiki.toc')}</b><ol>${sections.map(([id, title]) => `<li>${link(page, title, id)}</li>`).join('')}</ol></nav>`;
}

/** A column: its heading, and `num` for right-aligned figures or `c` for centered. */
export type Col = string | { h: string; cls?: 'num' | 'c' };

function bareTable(cols: Col[], rows: (string | number)[][]) {
  const heads = cols.map((col) => (typeof col === 'string' ? { h: col } : col));
  const head = heads.map((col) => `<th${col.cls ? ` class="${col.cls}"` : ''}>${col.h}</th>`).join('');
  const body = rows.map((row) => `<tr>${row.map((cell, i) => `<td${heads[i]?.cls ? ` class="${heads[i].cls}"` : ''}>${cell}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export const table = (cols: Col[], rows: (string | number)[][]) => `<div class="tbl">${bareTable(cols, rows)}</div>`;

/** Several tables side by side (level tables split into ranges, like 1–10, 20–100, 200–1000). */
export const splitTables = (cols: Col[], groups: (string | number)[][][]) =>
  `<div class="tbl split">${groups.map((rows) => bareTable(cols, rows)).join('')}</div>`;

export function infobox(art: string, rows: [string, string][], flavor = '') {
  return `<aside class="infobox"><div class="art">${art}</div><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>${flavor ? `<p class="flavor">${t('wiki.flavor', { flavor: esc(flavor) })}</p>` : ''}</aside>`;
}

export const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, k) => from + k * step);

/** Seconds as "30s", "2.5s", "90s". */
export const seconds = (s: number) => t('wiki.secs.s', { n: decimal(s, 1) });

/** Seconds as "8 min", "30s", "1 h 20 min". */
export function secs(s: number) {
  if (s < 60) return seconds(s);
  if (s < 3600) return t('wiki.secs.min', { n: decimal(s / 60, 1) });
  const hours = Math.floor(s / 3600);
  const minutes = Math.round((s % 3600) / 60);
  return minutes ? t('wiki.secs.hmin', { hours, minutes }) : t('wiki.secs.h', { hours });
}

/** A fraction as a percent with up to `digits` decimals: 0.125 → "12.5%". */
export const pct = (n: number, digits = 1) => percent(n, digits, 0);
