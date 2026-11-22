/**
 * The demo build's text (vite.config.ts, with VITE_DEMO=1): the demo must not carry the full game's names or words in
 * any language. Each message file is bundled as a placeholder; once the demo's code is bundled, the placeholder is
 * filled with only the messages that code can show: UI keys it names, and content the demo's own data has.
 */
import { pathToFileURL } from 'node:url';
import type { Plugin } from 'vite';
import { demoContentKeys } from './i18n-source.ts';

const MESSAGE_FILE = /\/src\/i18n\/(en\/(?!index|content)[\w-]+|locales\/[\w-]+)\.ts$/;
const PLACEHOLDER = /(["'`])@@i18n:([\w/-]+)@@\1/g;
/** A UI key as it sits in the bundled code. */
const KEY_LITERAL = /["'`]((?:system|ui|menu|keep|game|data|wiki)\.[\w.-]+)["'`]/g;

type Messages = Record<string, unknown>;

export const i18nDemo = (): Plugin => {
  const files = new Map<string, Messages>();
  return {
    name: 'i18n-demo',
    apply: 'build',
    async load(id) {
      const match = id.match(MESSAGE_FILE);
      if (!match) return null;
      const name = match[1];
      const mod = (await import(`${pathToFileURL(id).href}?demo`)) as Record<string, unknown> & { default?: { meta: unknown; messages: Messages } };
      if (name.startsWith('en/')) {
        const [exported, messages] = Object.entries(mod)[0] as [string, Messages];
        files.set(name, messages);
        return `export const ${exported} = JSON.parse("@@i18n:${name}@@");`;
      }
      files.set(name, mod.default!.messages);
      return `export default { meta: ${JSON.stringify(mod.default!.meta)}, messages: JSON.parse("@@i18n:${name}@@") };`;
    },
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
      const named = new Set<string>();
      for (const chunk of chunks) for (const [, key] of chunk.code.matchAll(KEY_LITERAL)) named.add(key);
      const content = demoContentKeys();
      for (const chunk of chunks) {
        chunk.code = chunk.code.replace(PLACEHOLDER, (_all, _quote, name: string) => {
          const messages = files.get(name) ?? {};
          const kept = Object.fromEntries(Object.entries(messages).filter(([key]) => named.has(key) || content.has(key)));
          return JSON.stringify(JSON.stringify(kept));
        });
      }
    },
  };
};
