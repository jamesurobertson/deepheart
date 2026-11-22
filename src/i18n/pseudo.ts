import type { Message, PluralForms } from './types.ts';

/** Latin-1 only: the letters every shipped Latin-script language uses, so the pixel fonts draw every one. */
const ACCENTS: Record<string, string> = {
  a: 'á', c: 'ç', e: 'é', i: 'í', n: 'ñ', o: 'ö', u: 'û', y: 'ý',
  A: 'Á', C: 'Ç', E: 'É', I: 'Í', N: 'Ñ', O: 'Ö', U: 'Û', Y: 'Ý',
};
const VOWELS = 'aeiouAEIOU';
/** Placeholders, tags and entities pass through untouched. */
const PROTECTED = /(\{\w+\}|<[^>]*>|&\w+;)/;

/** "Hire" → "[Ĥííŕé]": accented, about 35% longer, bracketed. */
function pseudoText(text: string): string {
  if (!text) return text;
  let letters = 0;
  const body = text.split(PROTECTED).map((part, i) => {
    if (i % 2) return part;
    let out = '';
    for (const ch of part) {
      out += ACCENTS[ch] ?? ch;
      if (/[A-Za-z]/.test(ch) && ++letters % 3 === 0) out += VOWELS.includes(ch) ? ACCENTS[ch] ?? ch : '·';
    }
    return out;
  }).join('');
  return `[${body}]`;
}

export function pseudoMessage(message: Message): Message {
  if (typeof message === 'string') return pseudoText(message);
  const forms: PluralForms = { other: pseudoText(message.other) };
  for (const form of ['zero', 'one', 'two', 'few', 'many'] as const) if (message[form] !== undefined) forms[form] = pseudoText(message[form]);
  return forms;
}

export { pseudoText };
