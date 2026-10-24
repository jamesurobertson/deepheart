import '@fontsource/silkscreen/400.css';
import '@fontsource/jersey-10/400.css';
import './wiki.css';
import { PAGES, GROUPS, type Page } from './pages.ts';
import { hydrateSprites, loadSprites } from './sprites.ts';

const BY_ID = new Map(PAGES.map((p) => [p.id, p]));
const app = document.getElementById('wiki')!;

app.innerHTML = `
  <header class="w-top">
    <button class="w-menu" aria-label="Pages">☰</button>
    <a class="w-brand" href="#/home"><span class="w-heart"></span>Deepheart Wiki</a>
    <div class="w-search">
      <input type="search" placeholder="Search the wiki (press /)" aria-label="Search the wiki" autocomplete="off" spellcheck="false">
      <div class="w-results" hidden></div>
    </div>
    <a class="w-play" href="../">Play</a>
  </header>
  <nav class="w-side"></nav>
  <main class="w-main"></main>`;

const side = app.querySelector<HTMLElement>('.w-side')!;
const main = app.querySelector<HTMLElement>('.w-main')!;
const input = app.querySelector<HTMLInputElement>('.w-search input')!;
const results = app.querySelector<HTMLElement>('.w-results')!;

side.innerHTML = GROUPS.map((group) => {
  const links = PAGES.filter((p) => p.group === group && !p.parent)
    .map((p) => `<a href="#/${p.id}" data-page="${p.id}">${p.title}</a>`).join('');
  return `<div class="w-group"><h4>${group}</h4>${links}</div>`;
}).join('');

// ---------- search ----------

interface Entry { page: Page; section: string; heading: string; text: string; lower: string }

const index: Entry[] = [];
const scratch = document.createElement('div');
for (const page of PAGES) {
  scratch.innerHTML = page.body();
  let current: Entry = { page, section: '', heading: page.title, text: '', lower: '' };
  index.push(current);
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child instanceof HTMLElement && /^H[23]$/.test(child.tagName) && child.id) {
        current = { page, section: child.id, heading: child.textContent ?? '', text: '', lower: '' };
        index.push(current);
      } else if (child.nodeType === Node.TEXT_NODE) current.text += `${child.textContent} `;
      else walk(child);
    }
  };
  walk(scratch);
}
for (const entry of index) {
  entry.text = entry.text.replace(/\s+/g, ' ').trim();
  entry.lower = `${entry.page.title} ${entry.heading} ${entry.text}`.toLowerCase();
}

const terms = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function search(q: string) {
  const words = terms(q);
  if (!words.length) return [];
  return index
    .filter((entry) => words.every((w) => entry.lower.includes(w)))
    .map((entry) => {
      let score = 0;
      for (const w of words) {
        if (entry.page.title.toLowerCase().includes(w)) score += entry.section ? 4 : 12;
        if (entry.heading.toLowerCase().includes(w)) score += 6;
        score += Math.min(3, entry.text.toLowerCase().split(w).length - 1);
      }
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 14)
    .map((r) => r.entry);
}

function snippet(text: string, words: string[]) {
  const lower = text.toLowerCase();
  const at = Math.max(0, Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0), text.length) - 50);
  let out = (at > 0 ? '…' : '') + text.slice(at, at + 150) + (at + 150 < text.length ? '…' : '');
  out = out.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]!);
  const re = new RegExp(`(${words.map(escapeRe).join('|')})`, 'gi');
  return out.replace(re, '<mark>$1</mark>');
}

let hits: Entry[] = [];
let picked = 0;

function showResults() {
  const q = input.value.trim();
  hits = search(q);
  picked = 0;
  if (!q) {
    results.hidden = true;
    return;
  }
  const words = terms(q);
  results.innerHTML = hits.length
    ? hits.map((hit, i) => `<a class="w-hit${i === picked ? ' on' : ''}" href="#/${hit.page.id}${hit.section ? `/${hit.section}` : ''}" data-i="${i}">
        <b>${hit.page.title}${hit.section ? ` <span>› ${hit.heading}</span>` : ''}</b>
        <small>${snippet(hit.text || hit.page.summary || '', words)}</small></a>`).join('')
    : '<p class="w-none">Nothing found.</p>';
  results.hidden = false;
}

function pick(i: number) {
  picked = (i + hits.length) % hits.length;
  results.querySelectorAll('.w-hit').forEach((el, k) => el.classList.toggle('on', k === picked));
  results.querySelector('.w-hit.on')?.scrollIntoView({ block: 'nearest' });
}

let highlight: string[] = [];

input.addEventListener('input', showResults);
input.addEventListener('focus', showResults);
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); pick(picked + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); pick(picked - 1); }
  else if (e.key === 'Enter' && hits[picked]) {
    e.preventDefault();
    const hit = hits[picked];
    highlight = terms(input.value);
    location.hash = `#/${hit.page.id}${hit.section ? `/${hit.section}` : ''}`;
    results.hidden = true;
    input.blur();
  } else if (e.key === 'Escape') {
    results.hidden = true;
    input.blur();
  }
});
results.addEventListener('mousedown', (e) => {
  if ((e.target as HTMLElement).closest('.w-hit')) highlight = terms(input.value);
});
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('.w-search')) results.hidden = true;
  if ((e.target as HTMLElement).closest('.w-menu')) app.classList.toggle('nav-open');
  else if ((e.target as HTMLElement).closest('.w-side a')) app.classList.remove('nav-open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== input) {
    e.preventDefault();
    input.focus();
    input.select();
  }
});

/** Mark the searched words in the page's text, and bring the first one into view. */
function markWords(words: string[]) {
  if (!words.length) return null;
  const pattern = `(${words.map(escapeRe).join('|')})`;
  const re = new RegExp(pattern, 'gi');
  const has = new RegExp(pattern, 'i');
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) if (has.test(walker.currentNode.textContent ?? '')) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const span = document.createElement('span');
    span.innerHTML = (node.textContent ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]!).replace(re, '<mark>$1</mark>');
    node.replaceWith(...span.childNodes);
  }
  return main.querySelector('mark');
}

// ---------- pages ----------

function render() {
  const [id = 'home', section] = location.hash.replace(/^#\/?/, '').split('/');
  const page = BY_ID.get(id) ?? BY_ID.get('home')!;
  const parent = page.parent ? BY_ID.get(page.parent) : undefined;
  const crumbs = parent ? `<p class="w-crumbs"><a href="#/${parent.id}">${parent.title}</a> ›</p>` : '';
  main.innerHTML = `<article>${crumbs}<h1>${page.title}</h1>${page.body()}</article>`;
  page.mount?.(main);
  document.title = page.id === 'home' ? 'Deepheart Wiki' : `${page.title} · Deepheart Wiki`;
  side.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.page === (parent?.id ?? page.id)));
  hydrateSprites(main);
  const marked = markWords(highlight);
  highlight = [];
  const target = (section && document.getElementById(section)) || marked;
  if (target) target.scrollIntoView({ block: 'start' });
  else window.scrollTo(0, 0);
}

addEventListener('hashchange', render);
addEventListener('wiki:sprites', () => hydrateSprites(main));
render();
// From /wiki/ the game's public folder is one level up, in dev and on the published site alike.
loadSprites('../').then(() => {
  hydrateSprites(main);
  hydrateSprites(results);
}).catch(() => {});
