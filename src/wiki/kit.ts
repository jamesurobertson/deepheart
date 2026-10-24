/** Small builders the wiki's pages are written with. */

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export const h2 = (title: string) => `<h2 id="${slug(title)}">${title}</h2>`;
export const h3 = (title: string) => `<h3 id="${slug(title)}">${title}</h3>`;

export const link = (page: string, text: string, section?: string) => `<a href="#/${page}${section ? `/${slug(section)}` : ''}">${text}</a>`;

/** A contents box for a page's sections (pass the same titles given to h2). */
export function toc(page: string, titles: string[]) {
  return `<nav class="toc"><b>Contents</b><ol>${titles.map((t) => `<li>${link(page, t, t)}</li>`).join('')}</ol></nav>`;
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
  return `<aside class="infobox"><div class="art">${art}</div><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>${flavor ? `<p class="flavor">“${esc(flavor)}”</p>` : ''}</aside>`;
}

export const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, k) => from + k * step);

/** Seconds as "8 min", "30s", "1 h 20 min". */
export function secs(s: number) {
  if (s < 60) return `${+s.toFixed(1)}s`;
  if (s < 3600) return `${+(s / 60).toFixed(1)} min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const pct = (n: number, digits = 1) => `${+(n * 100).toFixed(digits)}%`;
