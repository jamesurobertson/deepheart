# Steam: supported languages

The table for Steamworks → *Store Page Admin → Basic Info → Languages*. Fill it in to match the build that ships.

Deepheart has no voice acting (music and sound effects only) and no spoken dialogue. So only **Interface** applies. "Full audio" means recorded voice-over in that language, and "Subtitles" means subtitles for spoken lines. Neither exists, so those boxes stay empty in every row, English included.

| Language (Steamworks name) | API code | Interface | Full audio | Subtitles | In the build |
|---|---|:---:|:---:|:---:|---|
| English | `english` | ✓ | | | source |
| Simplified Chinese | `schinese` | ✓ | | | `src/i18n/locales/zh-CN.ts` |
| Russian | `russian` | ✓ | | | `src/i18n/locales/ru.ts` |
| Spanish - Spain | `spanish` | ✓ | | | `src/i18n/locales/es.ts` |
| Spanish - Latin America | `latam` | ✓ | | | `src/i18n/locales/es-419.ts` (on top of `es`) |
| Portuguese - Brazil | `brazilian` | ✓ | | | `src/i18n/locales/pt-BR.ts` |
| German | `german` | ✓ | | | `src/i18n/locales/de.ts` |
| French | `french` | ✓ | | | `src/i18n/locales/fr.ts` |
| Japanese | `japanese` | ✓ | | | `src/i18n/locales/ja.ts` |
| Korean | `koreana` | ✓ | | | `src/i18n/locales/ko.ts` |

**Before ticking a language on the store page:** every translation is a machine draft (`meta.draft: true` in its file) until someone fluent has reviewed it. Steam shows these checkmarks to buyers and reviewers hold games to them. Tick a language when its review is done, and set `draft` to false then.

## Where else languages show up in Steamworks

- **Depots / launch options**: nothing per language. Every build ships all languages and picks one at runtime (Steam's game language → the player's choice in Options → Language).
- **Achievements**: `npm run achievements -- --steam` writes `docs/steam/achievements-localization.csv` for *Achievements → Bulk Import/Export → Import Localization*. Its columns are the API codes above. If Steam's export names the columns differently, rename the header to match.
- **Store page text** (description, short description, capsule text) is entered per language in Steamworks and isn't part of the build.
- **Testing a language**: in Steam, *Properties → Language* on the game. Outside Steam: `Deepheart --steam-language=schinese` (or `DEEPHEART_STEAM_LANGUAGE=schinese`), or `--lang=de` to fake the system language.
