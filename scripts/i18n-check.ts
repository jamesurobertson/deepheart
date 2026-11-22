/**
 * Checks the game's text (docs/i18n-plan.md): every English key used by the code and every key the code uses there;
 * en/content.ts in step with the data; each translation's placeholders, plural forms and tags matching English; no
 * English left hard-coded in the UI files; and every character a language shows in its fonts.
 *   node scripts/i18n-check.ts [--strings]   (--strings: list every hard-coded string found, not just the count per file)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentFileText, contentSource } from './i18n-source.ts';
import type { Message, PluralForms } from '../src/i18n/types.ts';

const problems: string[] = [];
const fail = (text: string) => problems.push(text);
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
const load = async <T>(file: string): Promise<T> => (await import(pathToFileURL(file).href)) as T;

// ---------- English ----------

const NAMESPACES = readdirSync('src/i18n/en').filter((f) => !['index.ts', 'content.ts'].includes(f)).map((f) => f.replace(/\.ts$/, ''));
const EN: Record<string, Message> = {};
for (const ns of NAMESPACES) {
  const mod = await load<Record<string, Record<string, Message>>>(`src/i18n/en/${ns}.ts`);
  for (const [key, message] of Object.entries(Object.values(mod)[0])) {
    if (!key.startsWith(`${ns}.`)) fail(`en/${ns}.ts: "${key}" should start "${ns}."`);
    if (key in EN) fail(`en/${ns}.ts: "${key}" is already in another file`);
    EN[key] = message;
  }
}

const content = contentSource();
if (readFileSync('src/i18n/en/content.ts', 'utf8') !== contentFileText()) fail('en/content.ts is out of date with the game data: npm run i18n:content');
for (const key of content.conflicts) fail(`data: "${key}" is given two different English texts`);
const CONTENT = Object.fromEntries(content.full) as Record<string, string>;

// ---------- keys the code names ----------

const CODE = files('src').filter((f) => f.endsWith('.ts') && !f.startsWith(join('src', 'i18n', 'en')) && !f.startsWith(join('src', 'i18n', 'locales')));
const source = new Map(CODE.map((f) => [f, readFileSync(f, 'utf8')]));
const named = new Set<string>();
for (const text of source.values()) for (const [, key] of text.matchAll(/["'`]((?:system|ui|menu|keep|game|data|wiki)\.[\w.-]+)["'`]/g)) named.add(key);
for (const key of Object.keys(EN)) if (!named.has(key)) fail(`unused: "${key}" (keys must be written out whole in the code)`);
for (const key of named) if (!(key in EN)) fail(`missing: the code names "${key}", which English doesn't have`);
for (const [file, text] of source) {
  for (const [whole] of text.matchAll(/\bt\(\s*`[^`]*\$\{/g)) fail(`${file}: a key built at runtime (${whole}…): write each key out`);
}

// ---------- translations ----------

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const tags = (text: string) => [...text.matchAll(/<\/?([a-z][\w-]*)[^>]*>/gi)].map((m) => `${m[0].startsWith('</') ? '/' : ''}${m[1].toLowerCase()}`).sort();
const forms = (m: Message) => (typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string'));
const union = (m: Message, of: (text: string) => string[]) => [...new Set(forms(m).flatMap(of))].sort();
const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

interface LocaleModule { default: { meta: { code: string; extends?: string; fonts?: string; numbers: { short: string[]; long: string[] } }; messages: Record<string, Message> } }
const LOCALES = existsSync('src/i18n/locales') ? readdirSync('src/i18n/locales').filter((f) => f.endsWith('.ts')) : [];
const allChars = new Map<string, Set<string>>();
for (const file of LOCALES) {
  const { meta, messages } = (await load<LocaleModule>(`src/i18n/locales/${file}`)).default;
  const where = `locales/${file}`;
  if (`${meta.code}.ts` !== file) fail(`${where}: meta.code is "${meta.code}"`);
  const categories = new Intl.PluralRules(meta.code).resolvedOptions().pluralCategories as (keyof PluralForms)[];
  for (const [key, message] of Object.entries(messages)) {
    const english: Message | undefined = EN[key] ?? CONTENT[key];
    if (english === undefined) {
      fail(`${where}: "${key}" isn't an English key`);
      continue;
    }
    if (typeof english === 'string' && typeof message !== 'string') fail(`${where}: "${key}" should be a plain string`);
    if (typeof english !== 'string') {
      if (typeof message === 'string') fail(`${where}: "${key}" needs plural forms (${categories.join(', ')})`);
      else for (const category of categories) if (category !== 'zero' && message[category] === undefined) fail(`${where}: "${key}" has no "${category}" form`);
    }
    const want = union(english, placeholders);
    const got = union(message, placeholders);
    if (!same(want.filter((p) => p !== 'count' || got.includes('count')), got)) fail(`${where}: "${key}" has {${got.join('} {')}}, English has {${want.join('} {')}}`);
    const englishTags = tags(typeof english === 'string' ? english : english.other);
    const messageTags = tags(typeof message === 'string' ? message : message.other);
    if (!same(englishTags, messageTags)) fail(`${where}: "${key}" has tags ${messageTags.join(' ') || 'none'}, English has ${englishTags.join(' ') || 'none'}`);
  }
  const chars = new Set<string>();
  for (const text of [...Object.values(messages).flatMap(forms), ...meta.numbers.short, ...meta.numbers.long]) for (const ch of text.replace(/<[^>]*>|\{\w+\}|&\w+;/g, '')) chars.add(ch);
  allChars.set(meta.fonts ?? 'latin', new Set([...(allChars.get(meta.fonts ?? 'latin') ?? []), ...chars]));
}

// ---------- fonts ----------

for (const [pack, chars] of allChars) {
  const list = `src/i18n/fonts/${pack}.chars.txt`;
  if (!existsSync(list)) {
    if (pack !== 'latin') fail(`fonts: ${list} is missing: npm run i18n:fonts`);
    continue;
  }
  const covered = new Set(readFileSync(list, 'utf8'));
  const tofu = [...chars].filter((ch) => ch.trim() && !covered.has(ch));
  if (tofu.length) fail(`fonts: the ${pack} fonts don't draw ${tofu.slice(0, 40).join('')}${tofu.length > 40 ? ` (+${tofu.length - 40})` : ''}: npm run i18n:fonts`);
}

// ---------- English left in the UI ----------

/** Files whose text the player sees. data.ts is covered by tc(); scripts and the renderer show no words. */
const UI_FILES = [...CODE.filter((f) => /^src\/(ui|wiki)\//.test(f)), 'src/main.ts', 'src/crash.ts', 'src/demo.ts', 'src/game/game.ts'];
/** Words that are the same in every language: the game's name, input names, units of the number system. */
const ALLOWED = /^(Deepheart|DEEPHEART|Jersey|10|Text|Silkscreen|Steam|Escape|Enter|Shift|Space|Tab|Esc|Backspace|Arrow\w+|Key[A-Z]|Digit\d|monospace|ui-monospace|sans-serif|serif)$/;
const listStrings = process.argv.includes('--strings');
let hardCoded = 0;
for (const file of UI_FILES) {
  const lines = source.get(file)!.split('\n');
  const found: string[] = [];
  let ignoring = false;
  lines.forEach((line, i) => {
    if (/i18n-ignore-start/.test(line)) ignoring = true;
    if (/i18n-ignore-end/.test(line)) ignoring = false;
    const code = line.replace(/\/\/.*$/, '').trim();
    if (ignoring || !code || code.startsWith('*') || code.startsWith('/*') || /i18n-ignore/.test(line) || /console\.\w+\(|^import |querySelector|classList|dataset|addEventListener|new Error\(/.test(code)) return;
    for (const [, , body] of code.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
      // What's left of a string once the markup, ${…}, entities and attributes are taken out.
      const text = body.replace(/\$\{[^}]*\}?/g, ' ').replace(/<[^>]*>?/g, ' ').replace(/&\w+;/g, ' ').replace(/[\w-]+="[^"]*"/g, ' ').trim();
      if (!/[A-Za-z]{2}/.test(text) || text.split(/[\s,·]+/).filter(Boolean).every((word) => ALLOWED.test(word))) continue;
      if (/(^|,\s*)[.#[]|\[data-|:not\(|^(button|a|input|textarea|select)(,|$)/.test(text)) continue;
      if (/^[\w.:/#?=&%-]+$/.test(text) && !/^[A-Z][a-z]+$/.test(text)) continue;
      if (/[:;{}]|px\b|\d(s|ms|deg|%)\b|^\.|^\[|^#|^https?:|\.(png|mp3|txt|ts|css|woff2?)\b/.test(text)) continue;
      if (/^[a-z][\w-]*( [a-z][\w-]*)*$/.test(text) && !/ /.test(text)) continue;
      if (/^[a-z][\w-]*( [a-z][\w-]*)*$/.test(text) && /\b(btn|pnl|ico|opt|tab|on|off|mm|tt|row|sub|hp|ab|mc)\b/.test(text)) continue;
      found.push(`${relative('.', file)}:${i + 1}  ${text.slice(0, 80)}`);
    }
  });
  if (found.length) {
    hardCoded += found.length;
    fail(`${relative('.', file)}: ${found.length} strings look like English left in the code${listStrings ? `\n    ${found.join('\n    ')}` : ''}`);
  }
}

if (problems.length) {
  console.log(problems.join('\n'));
  console.log(`\n${problems.length} problems${hardCoded ? ` (${hardCoded} hard-coded strings: --strings lists them)` : ''}`);
  process.exit(1);
}
console.log(`i18n: ${Object.keys(EN).length} UI keys, ${content.full.size} content keys, ${LOCALES.length} translations, all in order.`);
