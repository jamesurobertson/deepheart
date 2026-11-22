import Decimal from 'break_infinity.js';
import { fixed, int, intlLocale, numberWords, percent } from '../i18n/index.ts';

let notation: 'short' | 'sci' = 'short';
export function setNotation(n: 'short' | 'sci') {
  notation = n;
}

/** Past this, a Decimal is shown from its own mantissa and exponent rather than converted to a number. */
const HUGE = 1e300;

/** A Decimal's mantissa isn't exact in binary, so 123456789 can come back as 123456788.99999999: snap it. */
const snap = (n: number) => (Math.abs(n - Math.round(n)) < 1e-6 * Math.max(1, Math.abs(n)) ? Math.round(n) : n);

/** Scientific notation reads the same in every language ("1.23e450"); only the decimal mark is the language's. */
const sci = (mantissa: number, exponent: number, digits: number) => `${fixed(mantissa, digits)}e${exponent}`;
const sciOf = (d: Decimal, digits: number) => sci(d.mantissa, d.exponent, digits);
const sciNumber = (n: number, digits: number) => {
  const [m, e] = n.toExponential(digits).split('e');
  return sci(Number(m), Number(e), digits);
};

/** Human-friendly big number: 1234 -> 1.23K (1.23万 where numbers go by ten thousands), past the suffixes -> 1.23e99. */
export function fmt(value: number | Decimal): string {
  if (value instanceof Decimal) return value.abs().lt(HUGE) ? fmt(snap(value.toNumber())) : (value.lt(0) ? '-' : '') + sciOf(value.abs(), 2);
  const n = value;
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 && n % 1 !== 0 ? fixed(Math.floor(n * 10) / 10, 1) : int(Math.floor(n));
  if (n < 1e6) return int(Math.floor(n));
  const words = numberWords();
  const tier = Math.floor(Math.log10(n) / words.group);
  if (notation === 'short' && tier < words.short.length) {
    const v = n / 10 ** (tier * words.group);
    return fixed(v, v < 10 ? 2 : v < 100 ? 1 : 0) + words.short[tier];
  }
  return sciNumber(n, 2);
}

/** Big number with the unit spelled out, for the main counter: "1.234 million". */
export function fmtLong(value: number | Decimal): { value: string; unit: string } {
  if (value instanceof Decimal) return value.lt(HUGE) ? fmtLong(snap(value.toNumber())) : { value: sciOf(value, 3), unit: '' };
  const n = value;
  if (!Number.isFinite(n)) return { value: '∞', unit: '' };
  if (n < 1e6) return { value: int(Math.floor(n)), unit: '' };
  const words = numberWords();
  const tier = Math.floor(Math.log10(n) / words.group);
  if (notation === 'short' && tier < words.long.length) return { value: fixed(n / 10 ** (tier * words.group), 3), unit: words.long[tier] };
  return { value: sciNumber(n, 3), unit: '' };
}

export function pct(v: number, digits = 0): string {
  return percent(v, digits);
}

/** Intl.DurationFormat isn't in TypeScript's ES2022 library yet. */
type DurationFormatter = { format(parts: Record<string, number>): string };
const DurationFormat = (Intl as unknown as { DurationFormat?: new (locale: string, o: { style: string }) => DurationFormatter }).DurationFormat;
let durationFormat: { locale: string; formatter: DurationFormatter } | null = null;

/** "2d 3h", "5m 12s": the two biggest units, in the language's own short forms. */
export function duration(seconds: number): string {
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const locale = intlLocale();
  if (locale !== 'en' && DurationFormat) {
    if (durationFormat?.locale !== locale) durationFormat = { locale, formatter: new DurationFormat(locale, { style: 'narrow' }) };
    return durationFormat.formatter.format(d > 0 ? { days: d, hours: h } : h > 0 ? { hours: h, minutes: m } : m > 0 ? { minutes: m, seconds: s % 60 } : { seconds: s });
  }
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
