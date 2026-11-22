import type { EN } from './en/index.ts';
import type { CONTENT } from './en/content.ts';

/** A message with a count: one form per `Intl.PluralRules` category the language uses (`other` always). */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | PluralForms;
export type Params = Record<string, string | number>;

export type UiKey = keyof typeof EN;
export type ContentKey = keyof typeof CONTENT;

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : PluralForms };
/** Every message a full translation has: the same keys as English, each a string or plural forms as English's is. */
export type Messages = Shape<typeof EN> & Shape<typeof CONTENT>;

export interface LocaleMeta {
  /** BCP-47, as `<html lang>` and `Intl` take it. */
  code: string;
  /** The language in itself, for the picker: "Deutsch". */
  name: string;
  /** Steam's API language code (`ISteamApps::GetCurrentGameLanguage`). */
  steam: string;
  /** Missing messages are looked up here before English (es-419 → es). */
  extends?: string;
  /** Extra pixel-font faces this language's script needs (src/i18n/fonts). */
  fonts?: FontPack;
  /** A machine translation nobody fluent has checked yet. */
  draft?: boolean;
  numbers: NumberWords;
}

export type FontPack = 'cyrillic' | 'zh-CN' | 'ja' | 'ko';

export interface NumberWords {
  /** How many digits a step up the suffixes is: 3 (K, M, B…) or 4 (万, 亿…). */
  group: 3 | 4;
  /** Short suffix per step ("" first), for the HUD and prices. Past the last one, scientific notation. */
  short: string[];
  /** The same steps spelled out for the big gold counter ("" first). */
  long: string[];
}

export interface LocaleFile {
  meta: LocaleMeta;
  messages: Messages;
}

/** A locale built on another (`meta.extends`): only what differs. */
export interface LocaleOverride {
  meta: LocaleMeta & { extends: string };
  messages: Partial<Messages>;
}
