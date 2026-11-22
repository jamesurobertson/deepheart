/**
 * Builds the pixel-font packs for languages the game's own fonts can't draw (docs/i18n-plan.md, "Fonts"):
 * - src/i18n/fonts/<code>.woff2 + .css for Chinese, Japanese and Korean: Fusion Pixel 12px (OFL) cut down to the
 *   characters that language's translation uses, so each is tens of kB, not megabytes;
 * - src/i18n/fonts/extras.woff2 + .css, for every language: the language names in the picker (简体中文, 日本語, 한국어) and
 *   the few signs messages use that the game's fonts lack (≈, ², →);
 * - <pack>.chars.txt: every character each language can draw, which i18n:check holds the translations to.
 * Run it after changing a CJK translation. The Fusion Pixel release is downloaded once into node_modules/.cache.
 *   node scripts/i18n-fonts.ts
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
// @ts-expect-error subset-font ships no types
import subsetFont from 'subset-font';
// @ts-expect-error fontverter's types aren't a module
import fontverter from 'fontverter';
import { cjkSizeCss } from './cjk-sizes.ts';

const RELEASE = '2026.11.10';
const ZIP = `fusion-pixel-font-12px-proportional-otf.woff2-v${RELEASE}.zip`;
const CACHE = 'node_modules/.cache/fusion-pixel';
const OUT = 'src/i18n/fonts';
/** Fusion Pixel's regional builds: each draws shared Han characters the way that language writes them. */
const CJK: Record<string, string> = { 'zh-CN': 'zh_hans', ja: 'ja', ko: 'ko' };
const PICKER_NAMES = '简体中文日本語한국어';
/** Scripts the CJK fonts take over from the game's fonts (Latin, digits and Cyrillic stay with those). */
const CJK_RANGE = 'U+1100-11FF,U+2E80-2FDF,U+2FF0-303F,U+3040-30FF,U+3130-318F,U+31F0-31FF,U+3200-33FF,U+3400-4DBF,U+4E00-9FFF,U+A960-A97F,U+AC00-D7AF,U+D7B0-D7FF,U+F900-FAFF,U+FE30-FE4F,U+FF00-FFEF';
/** Fusion Pixel draws on a 12 px grid. Each game face is sized so its most used sizes land on whole pixels:
 *  body text (Jersey Text, 16px) at 24px, Jersey 10 headings (20px) at 24px, Silkscreen labels (12px) at 12px. */
const FACES: [family: string, sizeAdjust: string][] = [['Jersey Text', '150%'], ['Jersey 10', '120%'], ['Silkscreen', '100%']];
/** Glyphs the game's own fonts draw for every language: Jersey 10's and Silkscreen's Latin, Tiny5's Cyrillic. */
const BASE_FONTS = [
  'node_modules/@fontsource/jersey-10/files/jersey-10-latin-400-normal.woff2',
  'node_modules/@fontsource/jersey-10/files/jersey-10-latin-ext-400-normal.woff2',
  'node_modules/@fontsource/tiny5/files/tiny5-cyrillic-400-normal.woff2',
  'node_modules/@fontsource/tiny5/files/tiny5-cyrillic-ext-400-normal.woff2',
];

/** The characters a font maps (its cmap, formats 4 and 12). */
async function charsOf(font: Buffer): Promise<Set<string>> {
  const sfnt = await fontverter.convert(font, 'sfnt');
  const tables = sfnt.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < tables; i++) if (sfnt.toString('latin1', 12 + i * 16, 16 + i * 16) === 'cmap') cmap = sfnt.readUInt32BE(12 + i * 16 + 8);
  const out = new Set<string>();
  const subtables = sfnt.readUInt16BE(cmap + 2);
  for (let i = 0; i < subtables; i++) {
    const at = cmap + sfnt.readUInt32BE(cmap + 4 + i * 8 + 4);
    const format = sfnt.readUInt16BE(at);
    if (format === 4) {
      const segments = sfnt.readUInt16BE(at + 6) / 2;
      for (let s = 0; s < segments; s++) {
        const end = sfnt.readUInt16BE(at + 14 + s * 2);
        const start = sfnt.readUInt16BE(at + 16 + segments * 2 + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) out.add(String.fromCodePoint(c));
      }
    } else if (format === 12) {
      const groups = sfnt.readUInt32BE(at + 12);
      for (let g = 0; g < groups; g++) {
        const start = sfnt.readUInt32BE(at + 16 + g * 12);
        const end = sfnt.readUInt32BE(at + 20 + g * 12);
        for (let c = start; c <= end; c++) out.add(String.fromCodePoint(c));
      }
    }
  }
  return out;
}

function fusionPixel(build: string): Buffer {
  const file = join(CACHE, `fusion-pixel-12px-proportional-${build}.otf.woff2`);
  if (!existsSync(file)) {
    mkdirSync(CACHE, { recursive: true });
    const zip = join(CACHE, ZIP);
    execFileSync('curl', ['-sSfL', '-o', zip, `https://github.com/TakWolf/fusion-pixel-font/releases/download/${RELEASE}/${ZIP}`]);
    execFileSync('unzip', ['-oq', zip, '-d', CACHE]);
  }
  return readFileSync(file);
}

/** Every character the English messages and game content show. */
async function englishChars(): Promise<Set<string>> {
  const { EN } = await import(pathToFileURL('src/i18n/en/index.ts').href);
  const { CONTENT } = await import(pathToFileURL('src/i18n/en/content.ts').href);
  const texts = [...Object.values(EN), ...Object.values(CONTENT)].flatMap((m) => (typeof m === 'string' ? [m] : Object.values(m as Record<string, string>)));
  return new Set(texts.join('').replace(/<[^>]*>|\{\w+\}/g, ''));
}

/** Every character a translation shows: its messages and its number words. */
async function localeChars(code: string): Promise<Set<string>> {
  const file = `src/i18n/locales/${code}.ts`;
  if (!existsSync(file)) return new Set();
  const { meta, messages } = (await import(pathToFileURL(file).href)).default as { meta: { numbers: { short: string[]; long: (string | Record<string, string>)[] } }; messages: Record<string, string | Record<string, string>> };
  const texts = Object.values(messages).flatMap((m) => (typeof m === 'string' ? [m] : Object.values(m)));
  const words = meta.numbers.long.flatMap((m) => (typeof m === 'string' ? [m] : Object.values(m)));
  return new Set([...texts, ...meta.numbers.short, ...words].join('').replace(/<[^>]*>|\{\w+\}/g, ''));
}

const face = (family: string, url: string, sizeAdjust: string, range: string) =>
  `@font-face {\n  font-family: '${family}';\n  src: url('${url}') format('woff2');\n  font-weight: 100 900;\n  size-adjust: ${sizeAdjust};\n  unicode-range: ${range};\n  font-display: swap;\n}\n`;

const base = new Set<string>();
for (const file of BASE_FONTS) for (const ch of await charsOf(readFileSync(file))) base.add(ch);

const CJK_CHAR = /[\u1100-\u11ff\u2e80-\u2fdf\u2ff0-\u303f\u3040-\u30ff\u3130-\u318f\u31f0-\u31ff\u3200-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7ff\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef]/;
const used = new Set([...(await englishChars()), ...(await Promise.all(readdirSync('src/i18n/locales').map((f) => localeChars(f.replace(/\.ts$/, ''))))).flatMap((chars) => [...chars])]);
const signs = [...used].filter((ch) => ch > '~' && !base.has(ch) && !CJK_CHAR.test(ch));
const extrasFont = fusionPixel('ja');
const extras = await subsetFont(extrasFont, PICKER_NAMES + signs.join(''), { targetFormat: 'woff2' });
writeFileSync(join(OUT, 'extras.woff2'), extras);
const extrasDrawn = await charsOf(extras);
for (const ch of extrasDrawn) base.add(ch);
const extrasRange = [...extrasDrawn].filter((ch) => ch > '~').map((ch) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase()}`).join(',');
writeFileSync(join(OUT, 'extras.css'), `/* Generated by scripts/i18n-fonts.ts: Fusion Pixel 12px proportional (ja), OFL-1.1, cut to the picker's language names and the signs messages use that the game's fonts lack. */\n`
  + FACES.map(([family, size]) => face(family, './extras.woff2', size, extrasRange)).join(''));
writeFileSync(join(OUT, 'base.chars.txt'), [...base].sort().join(''));

for (const [code, build] of Object.entries(CJK)) {
  const wanted = [...(await localeChars(code))].filter((ch) => !base.has(ch) || PICKER_NAMES.includes(ch));
  // The full-width punctuation every CJK text leans on, whatever the translation uses today.
  const text = wanted.join('') + '、。，．・：；？！「」『』（）【】〈〉《》〜ー…—　' + PICKER_NAMES;
  const subset = await subsetFont(fusionPixel(build), text, { targetFormat: 'woff2' });
  writeFileSync(join(OUT, `${code}.woff2`), subset);
  const drawn = await charsOf(subset);
  writeFileSync(join(OUT, `${code}.chars.txt`), [...new Set([...base, ...drawn])].sort().join(''));
  const css = `/* Generated by scripts/i18n-fonts.ts: Fusion Pixel 12px proportional (${build}), OFL-1.1, cut to this translation's characters.\n * The faces under the game's font names catch any text; the rules after them set each size of text at a whole-pixel scale. */\n`
    + FACES.map(([family, size]) => face(family, `./${code}.woff2`, size, CJK_RANGE)).join('') + cjkSizeCss(`./${code}.woff2`, CJK_RANGE);
  writeFileSync(join(OUT, `${code}.css`), css);
  console.log(`${code}: ${drawn.size} characters, ${(subset.length / 1024).toFixed(1)} kB`);
}
console.log(`base: ${base.size} characters; extras.woff2 ${extrasDrawn.size} characters, ${(extras.length / 1024).toFixed(1)} kB`);
