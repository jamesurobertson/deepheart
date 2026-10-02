import Decimal from 'break_infinity.js';

const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
  'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg',
  'UVg', 'DVg', 'TVg', 'QaVg', 'QiVg', 'SxVg', 'SpVg', 'OcVg', 'NoVg', 'Tg',
];
const NAMES = [
  '', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion',
  'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion',
  'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion', 'vigintillion',
];

let notation: 'short' | 'sci' = 'short';
export function setNotation(n: 'short' | 'sci') {
  notation = n;
}

/** Past this, a Decimal is shown from its own mantissa and exponent rather than converted to a number. */
const HUGE = 1e300;

/** A Decimal's mantissa isn't exact in binary, so 123456789 can come back as 123456788.99999999: snap it. */
const snap = (n: number) => (Math.abs(n - Math.round(n)) < 1e-6 * Math.max(1, Math.abs(n)) ? Math.round(n) : n);

/** "1.23e450" for numbers too big for a plain float. */
const sciOf = (d: Decimal, digits: number) => `${d.mantissa.toFixed(digits)}e${d.exponent}`;

/** Human-friendly big number: 1234 -> 1.23K, past the suffix list -> 1.23e99. */
export function fmt(value: number | Decimal): string {
  if (value instanceof Decimal) return value.abs().lt(HUGE) ? fmt(snap(value.toNumber())) : (value.lt(0) ? '-' : '') + sciOf(value.abs(), 2);
  const n = value;
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 && n % 1 !== 0 ? (Math.floor(n * 10) / 10).toFixed(1) : Math.floor(n).toString();
  if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
  const tier = Math.floor(Math.log10(n) / 3);
  if (notation === 'short' && tier < SUFFIXES.length) {
    const v = n / 10 ** (tier * 3);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + SUFFIXES[tier];
  }
  return n.toExponential(2).replace('e+', 'e');
}

/** Big number with the unit spelled out, for the main counter: "1.234 million". */
export function fmtLong(value: number | Decimal): { value: string; unit: string } {
  if (value instanceof Decimal) return value.lt(HUGE) ? fmtLong(snap(value.toNumber())) : { value: sciOf(value, 3), unit: '' };
  const n = value;
  if (!Number.isFinite(n)) return { value: '∞', unit: '' };
  if (n < 1e6) return { value: Math.floor(n).toLocaleString('en-US'), unit: '' };
  const tier = Math.floor(Math.log10(n) / 3);
  if (notation === 'short' && tier < NAMES.length) return { value: (n / 10 ** (tier * 3)).toFixed(3), unit: NAMES[tier] };
  return { value: n.toExponential(3).replace('e+', 'e'), unit: '' };
}

export function pct(v: number, digits = 0): string {
  return (v * 100).toFixed(digits) + '%';
}

export function duration(seconds: number): string {
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
