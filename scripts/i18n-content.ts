/**
 * Writes src/i18n/en/content.ts: every piece of game content's English (names, flavor, descriptions) under its key, as
 * src/game/data.ts asks for it through tc(). Translations are typed against it.
 *   node scripts/i18n-content.ts
 */
import { writeFileSync } from 'node:fs';
import { contentFileText, contentSource } from './i18n-source.ts';

writeFileSync('src/i18n/en/content.ts', contentFileText());
console.log(`src/i18n/en/content.ts: ${contentSource().full.size} keys`);
