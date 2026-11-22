/**
 * The game's text in the player's language. English (src/i18n/en) is the source and is always loaded. Another
 * language is loaded once, before the game's modules run (src/main.ts), so tables built at load time are already in
 * it; changing language reloads the page.
 */
import { EN, EN_META } from './en/index.ts';
import { pseudoMessage, pseudoText } from './pseudo.ts';
import type { LocaleMeta, Message, NumberWords, Params, UiKey } from './types.ts';

export type { UiKey, ContentKey, LocaleMeta, Message, Params } from './types.ts';

export const PSEUDO = 'pseudo';

let meta: LocaleMeta = EN_META;
/** Looked up in order; English is always last. */
let chain: Record<string, Message>[] = [EN as Record<string, Message>];
let pseudo = false;
let plurals = new Intl.PluralRules('en');
const numberFormats = new Map<string, Formatter>();

/** Every content key the game data asked for, with its English: what the checker and the demo build go by. */
export const CONTENT_SOURCE = new Map<string, string>();
/** Keys asked for with two different English texts (the checker fails on them). */
export const CONTENT_CONFLICTS = new Set<string>();

export function activate(next: LocaleMeta, dictionaries: Record<string, Message>[], isPseudo = false) {
  meta = next;
  pseudo = isPseudo;
  chain = isPseudo ? [Object.fromEntries(Object.entries(EN as Record<string, Message>).map(([key, m]) => [key, pseudoMessage(m)]))] : [...dictionaries, EN as Record<string, Message>];
  plurals = new Intl.PluralRules(next.code);
  numberFormats.clear();
}

export const localeCode = () => (pseudo ? PSEUDO : meta.code);
/** The language Intl formats numbers and plurals in (the pseudo-locale counts like English). */
export const intlLocale = () => meta.code;
export const numberWords = (): NumberWords => meta.numbers;

/** The spelled-out word for a step of numberWords().long, in the form that goes after `count` shown with `decimals`
 *  ("1 Million", "1,000 Millionen"). */
export function numberWord(step: number, count: number, decimals = 0): string {
  const word = meta.numbers.long[step];
  if (word === undefined || typeof word === 'string') return word ?? '';
  return word[new Intl.PluralRules(meta.code, { minimumFractionDigits: decimals }).select(count)] ?? word.other;
}

function lookup(key: string): Message | undefined {
  for (const dict of chain) {
    const m = dict[key];
    if (m !== undefined) return m;
  }
  return undefined;
}

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (all, name: string) => {
    const v = params[name];
    if (v === undefined) return all;
    return typeof v === 'number' ? int(v) : v;
  });
}

function choose(m: Message, params?: Params): string {
  if (typeof m === 'string') return m;
  const count = params?.count;
  const n = typeof count === 'number' ? count : Number(count ?? NaN);
  const form = Number.isFinite(n) ? plurals.select(n) : 'other';
  return m[form] ?? m.other;
}

/** A UI message: `t('shop.hire')`, `t('ascend.title', { count: 3, souls: '…' })`. A `count` picks the plural form. */
export function t(key: UiKey, params?: Params): string {
  const m = lookup(key);
  return m === undefined ? key : fill(choose(m, params), params);
}

/** Game content (data.ts): its translation, or the English the data was written in. */
export function tc(key: string, english: string, params?: Params): string {
  const known = CONTENT_SOURCE.get(key);
  if (known === undefined) CONTENT_SOURCE.set(key, english);
  else if (known !== english) CONTENT_CONFLICTS.add(key);
  if (pseudo) return fill(pseudoText(english), params);
  for (const dict of chain) {
    if (dict === EN) break;
    const m = dict[key];
    if (typeof m === 'string') return fill(m, params);
  }
  return fill(english, params);
}

type Formatter = { format(n: number): string };

/** French and others group with a narrow no-break space, which the pixel fonts don't have: a plain no-break space stands in. */
function numberFormat(digits: number, minDigits = digits, style: 'decimal' | 'percent' = 'decimal', grouping = true): Formatter {
  const id = `${style}:${minDigits}:${digits}:${grouping}`;
  let f = numberFormats.get(id);
  if (!f) {
    const intl = new Intl.NumberFormat(intlLocale(), { style, minimumFractionDigits: minDigits, maximumFractionDigits: digits, useGrouping: grouping });
    numberFormats.set(id, (f = { format: (n: number) => intl.format(n).replace(/[\u202f\u2009]/g, '\u00a0') }));
  }
  return f;
}

/** A whole number with the language's grouping: "1,234", "1.234", "1 234". */
export const int = (n: number) => numberFormat(0).format(Math.trunc(n));
/** A number with exactly `digits` decimals and no grouping, in the language's style: "1.50", "1,50". Rounded as
 *  toFixed rounds (Intl would take 1.005 up to 1.01), so prices never read differently from one language to the next. */
export const fixed = (n: number, digits: number) => numberFormat(digits, digits, 'decimal', false).format(Number(n.toFixed(digits)));
/** Up to `digits` decimals, trailing zeros dropped: "1.5", "1,5". */
export const decimal = (n: number, digits: number) => numberFormat(digits, 0).format(n);
/** A fraction as a percent: 0.25 → "25%", "25 %". */
export const percent = (v: number, digits = 0, minDigits = digits) => numberFormat(digits, minDigits, 'percent').format(v);

/** "Squire, Ranger and Brawler" in the language's way (English as the game has always written it: no serial comma). */
export const list = (items: string[]) => new Intl.ListFormat(intlLocale() === 'en' ? 'en-GB' : intlLocale(), { type: 'conjunction' }).format(items);
