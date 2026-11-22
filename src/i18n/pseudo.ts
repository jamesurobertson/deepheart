import type { Message, PluralForms } from './types.ts';

/** Only Latin-1 and Latin Extended-A letters, so the pixel fonts' latin and latin-ext subsets draw every one. */
const ACCENTS: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ď', e: 'é', g: 'ğ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', n: 'ñ', o: 'ö', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', w: 'ŵ', y: 'ý', z: 'ž',
  A: 'Á', C: 'Ç', D: 'Ď', E: 'É', G: 'Ğ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', N: 'Ñ', O: 'Ö', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', W: 'Ŵ', Y: 'Ý', Z: 'Ž',
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
