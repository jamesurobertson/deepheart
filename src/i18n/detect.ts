/** Steam's API language codes (partner.steamgames.com/doc/store/localization/languages) as BCP-47. */
export const STEAM_LANGUAGES: Record<string, string> = {
  arabic: 'ar', bulgarian: 'bg', schinese: 'zh-CN', tchinese: 'zh-TW', czech: 'cs', danish: 'da', dutch: 'nl', english: 'en',
  finnish: 'fi', french: 'fr', german: 'de', greek: 'el', hungarian: 'hu', indonesian: 'id', italian: 'it', japanese: 'ja',
  koreana: 'ko', malay: 'ms', norwegian: 'no', polish: 'pl', portuguese: 'pt', brazilian: 'pt-BR', romanian: 'ro', russian: 'ru',
  spanish: 'es', latam: 'es-419', swedish: 'sv', thai: 'th', turkish: 'tr', ukrainian: 'uk', vietnamese: 'vi',
};

/** Where a BCP-47 tag lands among the languages we ship: exact, then by region family, then by language. */
export function matchLocale(tag: string, shipped: readonly string[]): string | null {
  if (!tag) return null;
  const want = tag.replace('_', '-');
  const exact = shipped.find((code) => code.toLowerCase() === want.toLowerCase());
  if (exact) return exact;
  let parts: { language: string; region?: string; script?: string };
  try {
    const loc = new Intl.Locale(want).maximize();
    parts = { language: loc.language, region: loc.region, script: loc.script };
  } catch {
    return null;
  }
  // Spain's Spanish is `es`; everywhere else's (Mexico, Argentina, the US…) is Latin American.
  if (parts.language === 'es') return shipped.includes(parts.region === 'ES' ? 'es' : 'es-419') ? (parts.region === 'ES' ? 'es' : 'es-419') : null;
  // Traditional Chinese (Taiwan, Hong Kong) isn't shipped: it falls through to English rather than to Simplified.
  if (parts.language === 'zh') return parts.script === 'Hans' && shipped.includes('zh-CN') ? 'zh-CN' : null;
  return shipped.find((code) => code.split('-')[0] === parts.language) ?? null;
}

/** The first of these (in order of preference) that we ship, else English. */
export function pickLocale(candidates: (string | null | undefined)[], shipped: readonly string[]): string {
  for (const tag of candidates) {
    const hit = tag ? matchLocale(tag, shipped) : null;
    if (hit) return hit;
  }
  return 'en';
}

/** A Steam API language code ("schinese") as BCP-47, or null for one Steam doesn't have. */
export const fromSteam = (code: string | null | undefined) => (code ? STEAM_LANGUAGES[code.toLowerCase()] ?? null : null);

/** Each shipped language in itself, for the picker (another falls back to what Intl calls it). */
const NATIVE_NAMES: Record<string, string> = {
  en: 'English', 'zh-CN': '简体中文', ru: 'Русский', es: 'Español (España)', 'es-419': 'Español (Latinoamérica)', 'pt-BR': 'Português (Brasil)',
  de: 'Deutsch', fr: 'Français', ja: '日本語', ko: '한국어',
};

export function nativeName(code: string): string {
  if (NATIVE_NAMES[code]) return NATIVE_NAMES[code];
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return code;
  }
}
