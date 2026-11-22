/** Picks and loads the player's language in the page (the game's and the wiki's). Not for Node: it globs the locale files. */
import { EN_META } from './en/index.ts';
import { activate, PSEUDO } from './index.ts';
import { fromSteam, pickLocale } from './detect.ts';
import type { FontPack, LocaleFile, LocaleOverride, Message } from './types.ts';

declare global {
  interface Window {
    /** Only in the desktop app (see desktop/preload.cjs). */
    deepheart?: {
      onUpdate(callback: (update: { version: string }) => void): void;
      downloadUpdate(): void;
      log?(text: string): void;
      /** Steam's game language (an API code such as "schinese") when Steam is running, and the OS locale. */
      languages?: { steam: string | null; os: string | null };
    };
  }
}

const LOADERS = import.meta.glob<{ default: LocaleFile | LocaleOverride }>('./locales/*.ts');
const FONTS: Record<FontPack, () => Promise<unknown>> = {
  'zh-CN': () => import('./fonts/zh-CN.css'),
  ja: () => import('./fonts/ja.css'),
  ko: () => import('./fonts/ko.css'),
};

/** Every language we ship, English first. */
export const SHIPPED: string[] = ['en', ...Object.keys(LOADERS).map((path) => path.match(/([\w-]+)\.ts$/)![1]).sort()];

/** The player's own pick (empty: follow Steam or the system). Kept beside the save, not in it. */
const CHOICE_KEY = 'deepheart-language';

export function chosenLanguage(): string {
  try {
    return localStorage.getItem(CHOICE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function chooseLanguage(code: string) {
  try {
    if (code) localStorage.setItem(CHOICE_KEY, code);
    else localStorage.removeItem(CHOICE_KEY);
  } catch { /* storage unavailable: the choice lasts this visit */ }
}

/** What "Automatic" means here: Steam's game language, else the system's or the browser's. */
export function automaticLanguage(): string {
  const desktop = window.deepheart?.languages;
  return pickLocale([fromSteam(desktop?.steam), desktop?.os, ...(navigator.languages ?? [navigator.language])], SHIPPED);
}

function wantedLanguage(): string {
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked === PSEUDO || (!asked && chosenLanguage() === PSEUDO)) return PSEUDO;
  const choice = asked || chosenLanguage();
  if (choice && SHIPPED.includes(choice)) return choice;
  return automaticLanguage();
}

async function loadFile(code: string): Promise<LocaleFile | LocaleOverride | null> {
  const load = LOADERS[`./locales/${code}.ts`];
  return load ? (await load()).default : null;
}

/** Loads the language to play in (and its fonts) and makes it the one `t()` speaks. */
export async function initI18n(): Promise<string> {
  const code = wantedLanguage();
  if (code === PSEUDO) {
    activate(EN_META, [], true);
    document.documentElement.lang = 'en';
    return code;
  }
  const dictionaries: Record<string, Message>[] = [];
  let file = code === 'en' ? null : await loadFile(code).catch(() => null);
  const meta = file?.meta ?? EN_META;
  while (file) {
    dictionaries.push(file.messages as Record<string, Message>);
    file = file.meta.extends ? await loadFile(file.meta.extends).catch(() => null) : null;
  }
  activate(meta, dictionaries);
  document.documentElement.lang = meta.code;
  if (meta.fonts) await FONTS[meta.fonts]().catch(() => {});
  return meta.code;
}
