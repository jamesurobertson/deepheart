/**
 * Keeps Chinese, Japanese and Korean pixel-crisp. Fusion Pixel draws on a 12 px grid, so a glyph is only sharp at 12,
 * 24, 36… px, but the game sets text at every size from 9 to 68 px. For each rule in the stylesheets that sets a font
 * size, this picks the whole-pixel CJK size that reads closest to the Latin around it, and writes the rule again with a
 * CJK-only face of exactly that scale in front of the rule's own fonts. Latin text, sizes and layout don't change.
 * Used by scripts/i18n-fonts.ts.
 */
import { readFileSync } from 'node:fs';

/** How big an ideograph should be next to each game font at the same font-size (its em ÷ the font-size), by eye. */
const CJK_SCALE: Record<Family, number> = { text: 0.8, jersey: 0.62, silkscreen: 0.75 };
const FAMILY_STACK: Record<Family, string> = { text: "var(--f-text)", jersey: "'Jersey 10'", silkscreen: "'Silkscreen'" };
type Family = 'text' | 'jersey' | 'silkscreen';

interface SizedRule { media: string | null; selector: string; size: number; family: Family }

function familyOf(declarations: string): Family | null {
  const font = declarations.match(/(?:^|;)\s*font(?:-family)?\s*:([^;]*)/);
  if (!font) return null;
  if (/Silkscreen/.test(font[1])) return 'silkscreen';
  if (/'Jersey 10'/.test(font[1]) && !/Jersey Text|--f-text/.test(font[1].split(',')[0])) return 'jersey';
  if (/Jersey Text|--f-text/.test(font[1])) return 'text';
  return null;
}

function sizeOf(declarations: string): number | null {
  const size = declarations.match(/(?:^|;)\s*font-size\s*:\s*([\d.]+)px/) ?? declarations.match(/(?:^|;)\s*font\s*:[^;]*?([\d.]+)px/);
  return size ? Number(size[1]) : null;
}

/** Rules (and the @media they sit in) that set a font size in px, outside @font-face and @keyframes. */
function sizedRules(css: string): SizedRule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: SizedRule[] = [];
  const walk = (block: string, media: string | null) => {
    let i = 0;
    while (i < block.length) {
      const open = block.indexOf('{', i);
      if (open < 0) break;
      const head = block.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < block.length && depth) depth += block[j] === '{' ? 1 : block[j] === '}' ? -1 : 0, j++;
      const body = block.slice(open + 1, j - 1);
      if (head.startsWith('@media') || head.startsWith('@supports')) walk(body, head);
      else if (!head.startsWith('@')) {
        const size = sizeOf(body);
        if (size) out.push({ media, selector: head, size, family: familyOf(body) ?? 'text' });
      }
      i = j;
    }
  };
  walk(text, null);
  return out;
}

/** The CJK scale (size-adjust) for text of this size in this font: a whole number of 12 px pixels per em. */
function scaleFor(size: number, family: Family) {
  const em = Math.max(12, 12 * Math.round((size * CJK_SCALE[family]) / 12));
  return em / size;
}

/** The faces and rules for one CJK font file, for the game's and the wiki's stylesheets. */
export function cjkSizeCss(fontUrl: string, range: string): string {
  const sheets: [file: string, scope: string][] = [['src/style.css', ':root:not(:has(#wiki))'], ['src/wiki/wiki.css', ':root:has(#wiki)']];
  const faces = new Map<string, number>();
  const rules: string[] = [];
  for (const [file, scope] of sheets) {
    for (const rule of sizedRules(readFileSync(file, 'utf8'))) {
      const scale = scaleFor(rule.size, rule.family);
      const alias = `DH CJK ${Math.round(scale * 10000)}`;
      faces.set(alias, scale);
      const selector = rule.selector.split(',').map((part) => `${scope} ${part.trim()}`).join(', ');
      const line = `${selector} { font-family: '${alias}', ${FAMILY_STACK[rule.family]}, monospace; }`;
      rules.push(rule.media ? `${rule.media} { ${line} }` : line);
    }
  }
  const faceCss = [...faces].map(([alias, scale]) => `@font-face { font-family: '${alias}'; src: url('${fontUrl}') format('woff2'); font-weight: 100 900; size-adjust: ${+(scale * 100).toFixed(4)}%; unicode-range: ${range}; font-display: swap; }`);
  return `${faceCss.join('\n')}\n${rules.join('\n')}\n`;
}
