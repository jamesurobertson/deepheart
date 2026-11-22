# Localization plan

Deepheart ships on Steam in English plus nine more languages. This is how the text, numbers, fonts and Steam pieces fit together.

## Research

- **Claude Code skills/plugins.** The ones listed (`i18n-localization`, `localization-toolkit`/`i18n-expert`, the `i18n Sync` plugin) are guides and checkers for i18next / next-intl / vue-i18n projects: JSON catalogs, React hooks. None fit a no-framework Vite + three.js game whose text is built in template strings, that needs a demo build which mustn't leak full-game names, and that needs Steam language detection. So we build a small typed module of our own. We take the usual practices from those guides: a pseudo-locale, a CI check for missing/unused keys, and placeholder parity.
- **Libraries.** i18next and FormatJS add 30–60 kB and a runtime ICU parser for features we don't need. `Intl.PluralRules`, `Intl.NumberFormat` and `Intl.DurationFormat` (Chromium 129+, so Electron 44 and current browsers) do the hard parts.
- **Steam.** `ISteamApps::GetCurrentGameLanguage` is the only reliable source of the game language: Steam doesn't put it in the launch environment. steamworks.js wraps it as `client.apps.currentGameLanguage()`. It's a Node-API module, so it runs in Electron's main process and works across Electron versions.
- **Achievements.** Steamworks takes localized achievement text as a CSV from *Achievements → Bulk Import/Export*: an `api_name` column, a `field` column (`name` / `description`) and one column per language. It's not a VDF.

## Module (`src/i18n/`)

| File | What it is |
|---|---|
| `index.ts` | `t(key, params)`, `tc(key, english)` for game content, `setLocale`, `locale()`, number/percent/duration helpers |
| `en/*.ts` | English, the source. One file per area (`ui`, `menu`, `keep`, `game`, `wiki`…), merged in `en/index.ts` |
| `en/content.ts` | Generated from `src/game/data.ts` by `npm run i18n:content`. English names and descriptions of companions, monsters, zones, upgrades, Spirits… Used only for its types and by the checker. |
| `locales/<code>.ts` | One file per language: its metadata (name, Steam code, number words, font pack) and every message. Typed with `satisfies LocaleFile`, so a missing or extra key is a compile error. |
| `locales.ts` | The list of shipped languages, each loaded lazily with `import()` |
| `pseudo.ts` | The pseudo-locale, generated from English at runtime |
| `detect.ts` | Steam → BCP-47 mapping, and the order of preference: saved choice → Steam → OS → browser → English |
| `fonts/` | Per-script font faces, loaded only when that language is active |

Adding a language means adding `locales/<code>.ts` and listing it in `locales.ts` (plus a font pack if it uses a new script).

### Messages

- Flat dotted keys, `area.thing[.part]`: `hud.gold`, `settings.sound`, `shop.hire`, `wiki.souls.lede`.
- Game content keys follow the data's IDs: `comp.<id>.name`, `comp.<id>.flavor`, `monster.<cardId>`, `zone.<n>.name`, `upgrade.<id>.name|flavor`, `ability.<id>.name|desc`, `trophy.<id>.name|desc`, `spirit.<id>.name|desc`, `mod.<id>`, `news.<n>`, `cursor.<id>`…
- Placeholders are named: `'Ascend for {souls}?'`. Values can be HTML (icons). Messages may contain a few inline tags (`<b>`, `<em>`, `<small>`, `<br>`). The checker makes sure every locale uses the same placeholders and tags as English.
- Plurals are objects keyed by `Intl.PluralRules` categories, picked with `{count}`: `{ one: '{count} soul', other: '{count} souls' }`. Russian and Polish add `few` and `many`, Japanese and Chinese need only `other`.
- A missing key falls back to English. In a locale built on another one (`es-419` on `es`), it falls back to that locale first.

### Game content

`data.ts` keeps its English text, because the balance scripts, `check-demo` and the save IDs all depend on it. Display fields become getters that look up `tc('comp.squire.name', 'Squire')`, so the UI, the Keep and the wiki get the current language without touching every `.name`. **IDs never come from display text.** `cardId()` and the save's `cards`/`slain` keys keep using the English source name. Text that was built in code (trait descriptions, lap and zone names such as "The Abyssal Lich") becomes a template message with `{name}`. Languages that inflect adjectives use a genitive form ("Скелет Бездны") so no grammatical gender is needed.

### Saves

Saves hold only IDs, as now. Active buffs carry a `name` from before this change: it stays in the save so old saves load, but the UI shows buffs by `id`. The language choice is stored in `localStorage['deepheart-language']`, **not inside the save**. That means switching language leaves save data byte-identical, a New Game or an imported save code keeps your language, and the wiki can read it. It sits on the Options screen with the other settings. Switching saves the run and reloads straight back into the same Options page (under a second, nothing lost). That's simpler and safer than re-rendering every cached view in place.

### Numbers

`format.ts` asks the active locale:
- Decimal and grouping separators come from `Intl.NumberFormat`: `1,23M` in German, `1 234` in French and Russian.
- **Short suffixes** stay `K M B T Qa Qi…` in Latin and Cyrillic languages. It's the idle-game convention and it fits the HUD. Each locale may override them.
- **Myriad grouping** for Chinese, Japanese and Korean: `1.23万`, `4.56亿` / `億`, `7.8억`, stepping by 10⁴ (万 亿 兆 京 垓 / 万 億 兆 京 垓 / 만 억 조 경 해). Past the last word, scientific notation.
- **Long names** for the big gold counter come per locale ("1.234 million", "1,234 Milliarden", "1,234 миллиарда", "1.234 億"), following each language's own scale (long scale in German, French and Spanish, short scale in pt-BR and Russian).
- Scientific notation (`1.23e45`) is the same everywhere. Durations use `Intl.DurationFormat` (narrow), with the current English output as the fallback.

### Pseudo-locale

`?lang=pseudo` (and in the picker on dev builds): every message is accented (`Ĥîŕé`), stretched ~35% and wrapped `⟦…⟧`, with placeholders and tags left alone. Any English left on screen is a hard-coded string. Any clipped bracket is an overflow.

### Checks: `npm run i18n:check`

Fails on:
- a key in English that no code uses as a literal. Keys must appear whole in the code (no `t(\`a.${b}\`)`), so the demo strip and the unused-key check can both see them. Content keys are exempt: they come from the data.
- `en/content.ts` being out of date with `data.ts`
- placeholders, plural shape or inline tags differing from English in any locale
- string literals that look like English UI text left in the UI files (a heuristic list with an allow-comment for the rare exception)
- characters in a CJK/Cyrillic locale that its font pack lacks, which would show as tofu

Type errors (missing or extra keys) are caught by `npm run typecheck`.

### The demo

The demo must not contain the full game's names in any language. In the demo build (`VITE_DEMO=1`) a Vite plugin replaces each locale module with a placeholder. After bundling it keeps only:
- UI keys that appear as literals in the demo's own bundled code. Strings in the full game's `if (!DEMO)` branches are dead code there.
- content keys whose entity exists in the demo's data with the same English text. `data.ts` is evaluated with `__DEMO__ = true` in a child process. The Runesmith's `???` stays `???`.

`check-demo` also checks the translated names of the full game's content in every locale.

## Fonts

The pixel fonts stay. For other scripts, extra `@font-face` rules are added **under the same family names** (`Jersey 10`, `Jersey Text`, `Silkscreen`) with a `unicode-range`. The browser then picks each glyph from the right file, and none of the 1,750 lines of CSS change.

| Script | Languages | Font | License |
|---|---|---|---|
| Latin + Latin-Ext | en de fr es es-419 pt-BR | Jersey 10, Silkscreen (latin + latin-ext subsets from `@fontsource`) | OFL 1.1 |
| Cyrillic | ru | Jersey 10 and Silkscreen have no Cyrillic. Picked by side-by-side render from: Fusion Pixel (its Cyrillic from Ark Pixel), Pixelify Sans, Tiny5 | OFL 1.1 |
| CJK | zh-CN ja ko | Fusion Pixel 12px proportional, the zh_hans / ja / ko builds (regional glyph forms) | OFL 1.1 |

- CJK fonts are **subset to the characters our translations use**: `npm run i18n:fonts`, using fonttools. Each file is then tens of kB, not 3–5 MB. A sidecar list of covered characters lets `i18n:check` fail on tofu.
- Each script's faces load only when that language is active (a lazily imported CSS chunk). So English players and the demo download nothing extra.
- Crispness: Fusion Pixel draws on a 12 px grid. Its `size-adjust` is picked so the game's most common text sizes land on whole pixels. Then we check by screenshot at 1× and 2×.
- Layout: German and Russian run about 30% longer, and CJK has no spaces. Fixes go in CSS: `overflow-wrap: anywhere` / `word-break` for CJK (`:lang(ja)` etc.), and wrapping or shrinking where labels are fixed-width. Everything found with the pseudo-locale.

## Steam

- `desktop/main.cjs` loads steamworks.js lazily and asks `apps.currentGameLanguage()`. With no Steam client, no app ID or no module, it uses `app.getLocale()`. `--steam-language=<api code>` or `DEEPHEART_STEAM_LANGUAGE` simulates Steam for testing. Both values reach the page through `preload.cjs` (`window.deepheart.languages`).
- Order of preference: the player's own choice → Steam's game language → OS locale (desktop) or `navigator.languages` (web) → English.
- Steam API codes → BCP-47: `english en`, `schinese zh-CN`, `tchinese zh-TW`, `japanese ja`, `koreana ko`, `russian ru`, `german de`, `french fr`, `spanish es`, `latam es-419`, `brazilian pt-BR`, `portuguese pt`, `polish pl`, …. Unshipped languages fall to the nearest one we ship (`tchinese` → English until zh-TW exists, `portuguese` → pt-BR).
- Achievements: `npm run achievements -- --steam` writes `docs/steam/achievements-localization.csv` (`api_name,field,english,schinese,…`) ready for Bulk Import, plus one JSON per language.
- Store page: `docs/steam-languages.md` holds the Supported Languages table (interface ✓, full audio –, subtitles –: the game has no voice).

## Languages

| Code | Language | Steam |
|---|---|---|
| en | English (source) | english |
| zh-CN | 简体中文 | schinese |
| ru | Русский | russian |
| es | Español (España) | spanish |
| es-419 | Español (Latinoamérica), built on `es` | latam |
| pt-BR | Português (Brasil) | brazilian |
| de | Deutsch | german |
| fr | Français | french |
| ja | 日本語 | japanese |
| ko | 한국어 | koreana |

Every translation is a **machine draft for native review** and is marked so at the top of its file. Names follow `docs/i18n-glossary.md`. Descriptive names, zones, currencies and puns are translated and adapted. Personal names (Dan, Victor, Koko…) are transliterated where the script differs and kept as-is in Latin-script languages. "Deepheart" and its logo stay English.

## Phases

1. Worktree, research, this plan.
2. Core module, pseudo-locale, check script, language detection and picker, number formatting.
3. Extract every string: UI, game data, demo/crash, wiki. Then a pseudo-locale sweep.
4. Fonts and layout fixes.
5. Draft translations, glossary, achievement export, Steam languages table, screenshots.
