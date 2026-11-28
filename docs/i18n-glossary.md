# Deepheart localization glossary

This file decides how every recurring name and term reads in each language. The nine per-language translation drafts follow it, and native reviewers check against it. The plan is in [i18n-plan.md](i18n-plan.md), the rules for writing source text in [i18n-guide.md](i18n-guide.md).

- **Source:** `src/i18n/en/*.ts` (UI) and `src/i18n/en/content.ts` (game content). Keys are quoted as they appear there.
- **Columns:** `zh-CN` Simplified Chinese · `ru` Russian · `es` Spanish (Spain) · `es-419` Latin American Spanish · `pt-BR` · `de` · `fr` · `ja` · `ko`.
- **es-419 is built on es.** An empty `es-419` cell means "same as es". Only differences are filled in.
- **Scope.** The glossary fixes names and terms. Upgrade names (puns), flavor lines, news, trophy names and cursor names are translated freely by each language's translator, but they must use the terms below when they mention a game system ("souls", "Rampage", "the Keep"…).
- **Status.** Every translation is a machine draft until a native speaker has reviewed it (`meta.draft: true`). So is this glossary's non-English text.

---

## 1. Rules for every language

### 1.1 Decisions already made

- **Descriptive names, zone names, currencies and puns are translated and adapted.** A pun becomes a natural pun or wordplay in the target language, not a literal translation. If no pun works, a short funny name beats a flat literal one.
- **Personal names** (Dan, Victor, Koko) are **transliterated** in ru, zh-CN, ja and ko, and kept as-is in the Latin-script languages. Nicknames that are jokes because of their meaning ("Pebble") are translated (see §4.13).
- **"Deepheart"** (title, logo, "Deepheart Wiki", "replace Deepheart" in the updater) stays English in every language, Latin letters, never transliterated.
- The author's name in the credits (`menu.credits.lede`) stays as written.

### 1.2 Placeholders, tags and plurals

- **`{placeholders}` are never translated, renamed or dropped.** Move them wherever the target grammar needs them. `i18n:check` fails if a message has a different set of placeholders than English. (`{count}` may be left out of a plural form only where English also leaves it out.)
- **Inline tags stay the same:** `<b>`, `<em>`, `<small>`, `<br>`, `<code>`, `<sup>`. Keep the same tags, the same number of them, wrapping the equivalent words. Never add new tags or attributes.
- **Plural messages** are objects. Give exactly the categories `Intl.PluralRules` uses for the language (the checker requires all of them):

| Language | Categories to give | Note |
|---|---|---|
| zh-CN, ja, ko | `other` | One form. No plural marking. |
| de | `one`, `other` | |
| es, es-419, pt-BR, fr | `one`, `many`, `other` | `many` is only picked for millions in compact notation. Make it the same as `other`. |
| ru | `one`, `few`, `many`, `other` | `one` 1, 21 (душа) · `few` 2–4 (души) · `many` 5–20 (душ) · `other` fractions (души). |

  French `one` covers 0 and 1 ("0 âme", "1 âme").
- **Names in placeholders are always in their dictionary form** (nominative, no article added by the template). The template must be written so the name works as-is: put it in subject position, after a colon, or in apposition. Never write a template that needs the name to change case, take a contraction or agree in gender.
  - de: not `durch den {name}` but `Freigeschaltet durch: {name}` or `{name} schaltet es frei`.
  - fr: never `de {name}` / `à {name}` (names can start with *Le*, *La*, *Les*: "de Le Dormeur" is wrong). Write `Débloqué par : {name}`.
  - es/pt: never `del {name}` / `do {name}`.
  - ru: never `{name}` in an oblique case. `Призыв: {name}`, not `Призыв {name}а`.
  - ko: a particle after `{name}` depends on the last syllable. Restructure (`{name}: …`) or, as a last resort, write both forms (`{name}(이)가`, `{name}(을)를`).
- **English "the" before a companion** (`Unlocked by the {name}`, `The {name} is your hero`) is dropped. Companion names are used like proper names.

### 1.3 Symbols and numbers inside messages

- `×` (U+00D7) for multipliers stays: `×2`, `×{mult}`, never `x2`. No space between `×` and the number.
- `+` and `−` (U+2212 minus) stay in front of the number: `+50%`, `−3`. Keep the true minus sign where English uses it.
- `–` (en dash) in ranges stays: `81–90`, `×2–×3`. No spaces.
- `·` (middle dot with spaces) is the game's separator. Keep it in every language, CJK included.
- `…` stays one character (zh-CN/ja may use `……` where the sentence calls for it).
- **Percent:** follow what `Intl` prints in that language, so typed numbers match formatted ones: **de, fr, ru, es** write `50 %` with a no-break space (U+00A0) between number and sign; **es-419, pt-BR, zh-CN, ja, ko** write `50%`.
- **Decimals in typed text** (rare, e.g. `0.5`): decimal comma in de, fr, ru, es, pt-BR; decimal point in es-419, zh-CN, ja, ko.
- Numbers passed in placeholders are already formatted in the player's language. Don't touch them.
- **Units:** seconds are `s` in Latin languages (`10 s`, no-break space in de/fr/ru/es, `10s` acceptable in es-419/pt-BR to match English density), `с` in ru (`10 с`), `秒` in zh-CN/ja (`10秒`), `초` in ko (`10초`). "/s", "/sec": `/s` Latin, `/с` ru, `/秒` zh-CN and ja, `/초` ko.

### 1.4 UI copy

- Write the label and the value only: `Cards 140/385`, never a clause that explains how something is counted. If a label needs explaining, it's the wrong label: pick a better word, don't add text.
- Keep the jokes, keep them short. Deadpan flavor stays deadpan: no exclamation marks the English doesn't have, no emoji, no internet slang that will date.
- Exclamations in pop-ups (`CHAMPION!`, `CLUTCH!`, `RAMPAGE ×{mult}!`) stay uppercase in languages with case; uppercase German ß is `SS` or `ẞ` (prefer `SS`).
- Don't translate key names, button glyphs or URLs (Space, Escape, `/`).

---

## 2. Style per language

### zh-CN (Simplified Chinese)

- **Address:** 你 (not 您). Hints are short imperatives: `点击攻击怪物`, `按 {button} 升级`.
- **Register:** plain, punchy game Chinese. Flavor lines deadpan; light 网络 tone is fine, no memes that date.
- **Punctuation:** full-width `，。！？：；（）`, quotation marks `“”` (nested `‘’`), ellipsis `……`. Labels and buttons take no final `。`; sentences that end in "." in English end in `。`.
- **Spacing:** no spaces between Chinese and numbers or Latin text (`第12层`, `+50%伤害`). Keep the space after an icon placeholder (`{icon} {amount}`), and keep ` · ` separators as they are.
- **Numbers:** myriad grouping (万, 亿…), see §3. Durations come from `Intl`.
- **Measure words:** 只 for monsters (`击杀10只怪物`), 张 for cards, 名 or 位 for companions, 次 for times.
- **Plural:** `other` only.
- **Floor:** `第{floor}层`. Ranges `第{from}–{to}层`.

### ja (Japanese)

- **Address:** no pronoun (never あなた). Omit the subject.
- **Register:** UI labels and buttons are short noun/verb forms (`雇う`, `レベルアップ`, `転生`). Hints and tooltips are です・ます (`クリックで攻撃できます`, `{button}で雇えます`). Flavor lines and news are plain form (だ/である or casual) for the deadpan effect.
- **Punctuation:** full-width `、。！？`, quotes `「」` (nested `『』`), ellipsis `……`. No spaces between words. Labels take no `。`.
- **Script:** kanji for system terms, katakana for loanwords the Japanese RPG audience knows (ボス, レベル, クリティカル, ゴーレム). Don't put `・` between katakana words in names unless the name is hard to read without it.
- **Numbers:** myriad grouping (万, 億…), see §3.
- **Counters:** 体 for monsters, 枚 for cards, 回 for times, 人 for companions.
- **Floor:** `{floor}階`. Ranges `{from}–{to}階`.
- **Plural:** `other` only.

### ko (Korean)

- **Address:** no pronoun (avoid 당신). Omit the subject.
- **Register:** labels and buttons in noun form (`고용`, `레벨 업`, `승천`). Hints in 해요체 imperative (`클릭해서 공격하세요`). Effect descriptions in short noun endings or 합니다체 (`모든 동료가 피해 +50%`, `피해를 2배로 줍니다`); be consistent within a file. Flavor lines in plain written style (`-다`).
- **Punctuation:** Korean uses **half-width** punctuation `. , ! ? :` (not full-width), quotes `“ ”`. Normal Korean word spacing (띄어쓰기).
- **Particles after placeholders:** see §1.2 (restructure, or `(이)가` / `(을)를` / `(은)는`).
- **Numbers:** myriad grouping (만, 억…), see §3.
- **Floor:** `{floor}층`.
- **Plural:** `other` only.

### ru (Russian)

- **Address:** **вы** (lowercase). Hints use the -те imperative (`Нажмите`, `Кликните, чтобы атаковать`). Buttons use the infinitive (`Нанять`, `Вознестись`, `Пробудить`). Characters may speak differently (Dan says «ты», see §4.13).
- **Capitalization:** sentence case everywhere. Game proper names capitalized: Сердце, Крепость, Скованные, Метка Сердца, Духи (as the system), zone and Spirit names.
- **Quotes:** «ёлочки», nested „лапки“. Em dash `—` with spaces.
- **ё:** write ё (the font has it).
- **Plurals:** all four forms (see §1.2). Write `other` for fractions: "1,5 души".
- **Gender:** avoid past-tense verbs agreeing with a `{name}` (gender unknown). Use present tense or a noun phrase: `{name} присоединяется к вам`, not `присоединился`.
- **Numbers:** decimal comma, grouping with a no-break space (from `Intl`), `50 %` with a no-break space.
- **Abbreviations:** `ур.` for level, `с` for seconds, `урон/с`.

### de (German)

- **Address:** **du** (lowercase). Hints use the du-imperative (`Klicke, um anzugreifen`, `Drücke {button}`). Buttons use the infinitive (`Anheuern`, `Aufsteigen`, `Erwecken`).
- **Capitalization:** nouns capitalized; UI labels otherwise sentence case (`Neues Spiel`, `Bildschirm wackeln`). In names, a leading adjective is capitalized (`Verbannter König`, `Die Oberen Hallen`).
- **Names with adjectives** are written in the strong nominative (`Gefallener Engel`, `Uralter Ent` as a bare name). Templates keep them nominative (§1.2).
- **Compounds:** prefer one word (`Gruppenschaden`, `Kritschaden`). Hyphenate with English words, abbreviations and names (`Champion-Boss`, `Auto-Upgrades`, `DPS-Rekord`).
- **Quotes:** „…“, nested ‚…‘.
- **Numbers:** decimal comma, `1.234`, `50 %` with a no-break space. `×2` without a space.
- **Length:** German runs ~30% longer. Use `St.` for Stufe (level) in tight labels.

### fr (French)

- **Address:** **vous**. Hints use the vous-imperative (`Cliquez pour attaquer`, `Appuyez sur {button}`). Buttons use the infinitive (`Recruter`, `Éveiller`) or a noun (`Ascension`).
- **Capitalization:** sentence case. Proper names capitalized by French rules: `le Cœur`, `le Bastion`, `les Liés`, `Les Salles hautes` (noun capitalized, the adjective after it is not).
- **Punctuation:** a no-break space (U+00A0) before `: ; ! ?` and `»`, and after `«`. Use U+00A0, not the narrow U+202F: the pixel font has no U+202F glyph. Quotes « … » (nested “ … ”).
- **Numbers:** decimal comma, `50 %` with a no-break space.
- **Contractions:** never `de {name}` / `à {name}` (§1.2).
- **Ligatures:** œ in `cœur`, `Œil`. Accented capitals are written (`É`, `À`).

### es (Spanish, Spain)

- **Address:** **tú** (never usted, never vosotros for one player). Hints: `Haz clic para atacar`, `Pulsa {button}`. Buttons use the infinitive (`Contratar`, `Ascender`, `Despertar`).
- **Capitalization:** sentence case for labels and for generic names (companions, monsters, abilities, buffs: `Hoja fantasma`, `Sed de sangre`). Proper names (zones, Spirits, the Keep, the Heart, unique bosses) in title case: `La Bóveda Helada`, `El Reloj de Arena`, `el Corazón`.
- **Punctuation:** opening `¡` and `¿` always, also in pop-ups (`¡CAMPEÓN!`). Quotes « » (nested “ ”).
- **Numbers:** decimal comma, `50 %` with a no-break space.
- **Spain vocabulary:** ordenador, pulsar, seta, vale, móvil.

### es-419 (Latin American Spanish)

Built on `es`: copy only what differs.

- **Address:** **tú** (no voseo, no ustedes for one player).
- **Numbers:** decimal point (`1.5`), `50%` with no space (this is what `Intl` prints for es-419).
- **Vocabulary that must change from es:**

| es (Spain) | es-419 |
|---|---|
| ordenador | computadora |
| pulsar (`Pulsa {button}`) | presionar (`Presiona {button}`) |
| seta (mushroom) | hongo |
| vale (OK) | aceptar / está bien |
| Papá Noel | Santa Claus |
| ¡Por los pelos! | ¡Por un pelo! |
| Jugar a la demo | Jugar la demo |
| Añadir a la lista de deseados | Agregar a la lista de deseados |
| coger (to catch) | atrapar (never coger) |
| guay, molar, flipar | genial (avoid Spain slang) |
| guijarro (Pebble) | piedrita |

- Upgrade puns and flavor lines that rely on Spain-only idioms get a LatAm version; neutral Spanish is preferred where one sentence fits both.

### pt-BR (Brazilian Portuguese)

- **Address:** **você**. Hints in the você-imperative (`Clique para atacar`, `Pressione {button}`). Buttons use the infinitive (`Contratar`, `Ascender`, `Despertar`).
- **Capitalization:** names in Title Case (Brazilian game convention: `Lâmina Fantasma`, `Sede de Sangue`, `Os Salões Superiores`); UI labels in sentence case (`Novo jogo`, `Volume da música`).
- **Quotes:** “ ” (nested ‘ ’).
- **Numbers:** decimal comma, `50%` with no space.
- **Brazilian vocabulary:** tela (not ecrã), celular, clicar, mouse.

---

## 3. Number words (`meta.numbers`)

How the code uses them (`src/game/format.ts`):

- `short[tier]` follows a number with 2 or fewer decimals in the HUD and prices: `1.23M`, `1,23M`, `1.23万`.
- `long[tier]` is the unit after a number shown with **exactly three decimals** on the big gold counter: `1,234 Millionen`, `1,234 миллиона`. So the word must fit a fractional number: German, Spanish and Portuguese use the plural, Russian the genitive singular (always right after a decimal fraction), French the plural (right from 2 up, which is most of every tier).
- Past the last entry of either list, the number switches to scientific notation (`1.23e45`). A list may stop early; it may not skip a tier.
- The wiki's "Number suffixes" page lists `short` and `long` side by side.
- Known limit: trophy descriptions reuse `long` after a whole 1, 10 or 100 (`data.trophy.power` "{n} {word}"), so "1 Millionen", "1 миллиона", "1 millones" will read wrong there. That needs a code change (a singular/plural-aware list), not a different word here.

`group` is 3 (each step ×1,000) for the Latin and Cyrillic languages, 4 (each step ×10,000) for zh-CN, ja and ko.

**Short suffixes:** de, fr, es, es-419, pt-BR and ru keep the English idle-game suffixes. They're what idle players know and they fit the HUD. (Native forms exist, like de `Mio.`/`Mrd.`, fr `M`/`Md`, ru `тыс.`/`млн`/`млрд`, but they're longer and don't go past trillions.) Note for German players: `B` means *Milliarde* here, as in every idle game.

```ts
// de, fr, es, es-419, pt-BR, ru: same as English
short: ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg', 'UVg', 'DVg', 'TVg', 'QaVg', 'QiVg', 'SxVg', 'SpVg', 'OcVg', 'NoVg', 'Tg'],
```

### de (long scale)

```ts
numbers: {
  group: 3,
  short: [/* English list above */],
  long: ['', 'Tausend', 'Millionen', 'Milliarden', 'Billionen', 'Billiarden', 'Trillionen', 'Trilliarden', 'Quadrillionen', 'Quadrilliarden', 'Quintillionen', 'Quintilliarden', 'Sextillionen', 'Sextilliarden', 'Septillionen', 'Septilliarden', 'Oktillionen', 'Oktilliarden', 'Nonillionen', 'Nonilliarden', 'Dezillionen', 'Dezilliarden'],
},
```

### fr (long scale)

```ts
numbers: {
  group: 3,
  short: [/* English list above */],
  long: ['', 'mille', 'millions', 'milliards', 'billions', 'billiards', 'trillions', 'trilliards', 'quadrillions', 'quadrilliards', 'quintillions', 'quintilliards', 'sextillions', 'sextilliards', 'septillions', 'septilliards', 'octillions', 'octilliards', 'nonillions', 'nonilliards', 'décillions', 'décilliards'],
},
```

### es and es-419 (long scale, both regions)

Spanish has no everyday word for 10⁹ (*millardo* exists but nobody says it), so every odd tier is "mil …", as newspapers write it. es-419 uses the same list (it needs its own `meta`, so copy it there).

```ts
numbers: {
  group: 3,
  short: [/* English list above */],
  long: ['', 'mil', 'millones', 'mil millones', 'billones', 'mil billones', 'trillones', 'mil trillones', 'cuatrillones', 'mil cuatrillones', 'quintillones', 'mil quintillones', 'sextillones', 'mil sextillones', 'septillones', 'mil septillones', 'octillones', 'mil octillones', 'nonillones', 'mil nonillones', 'decillones', 'mil decillones'],
},
```

### pt-BR (short scale)

```ts
numbers: {
  group: 3,
  short: [/* English list above */],
  long: ['', 'mil', 'milhões', 'bilhões', 'trilhões', 'quatrilhões', 'quintilhões', 'sextilhões', 'septilhões', 'octilhões', 'nonilhões', 'decilhões', 'undecilhões', 'duodecilhões', 'tredecilhões', 'quatuordecilhões', 'quindecilhões', 'sexdecilhões', 'septendecilhões', 'octodecilhões', 'novendecilhões', 'vigintilhões'],
},
```

### ru (short scale, genitive singular)

```ts
numbers: {
  group: 3,
  short: [/* English list above */],
  long: ['', 'тысячи', 'миллиона', 'миллиарда', 'триллиона', 'квадриллиона', 'квинтиллиона', 'секстиллиона', 'септиллиона', 'октиллиона', 'нониллиона', 'дециллиона', 'ундециллиона', 'дуодециллиона', 'тредециллиона', 'кваттуордециллиона', 'квиндециллиона', 'сексдециллиона', 'септендециллиона', 'октодециллиона', 'новемдециллиона', 'вигинтиллиона'],
},
```

### zh-CN, ja, ko (myriads)

Checked against the Fusion Pixel 12px builds the game ships (`node_modules/.cache/fusion-pixel`): **the zh_hans and ja builds have no glyph for 10²⁴** (秭, 𥝱), so Chinese and Japanese stop at 垓 (10²⁰) and switch to scientific notation from 10²⁴. Korean's Hangul words are all in the font and run to 극 (10⁴⁸). The long words are the same as the short ones: the myriad words already are the spelled-out units.

```ts
// zh-CN
numbers: {
  group: 4,
  short: ['', '万', '亿', '兆', '京', '垓'],
  long: ['', '万', '亿', '兆', '京', '垓'],
},

// ja
numbers: {
  group: 4,
  short: ['', '万', '億', '兆', '京', '垓'],
  long: ['', '万', '億', '兆', '京', '垓'],
},

// ko
numbers: {
  group: 4,
  short: ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정', '재', '극'],
  long: ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정', '재', '극'],
},
```

If a 秭 glyph is added to the zh-CN font pack (and 秭 or 𥝱 to ja), the lists can continue: zh-CN `秭 穰 沟 涧 正 载`, ja `秭 穣 溝 澗 正 載 極` (the font has every one of these except 秭/𥝱).

---

## 4. Terms

Notation: `singular / plural` where the plural differs. Lowercase entries are running-text forms; capitalize at the start of a label. Abbreviations in brackets.

### 4.1 Currencies and resources

| English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|
| gold | 金币 | золото | oro | | ouro | Gold | or | ゴールド | 골드 |
| soul / souls | 灵魂 | душа / души | alma / almas | | alma / almas | Seele / Seelen | âme / âmes | 魂 | 영혼 |
| bound soul / bound souls | 缚魂 | скованная душа / скованные души | alma encadenada / almas encadenadas | | alma acorrentada / almas acorrentadas | gebundene Seele / gebundene Seelen | âme liée / âmes liées | 束縛の魂 | 속박된 영혼 |
| Heartmark / Heartmarks | 心印 | Метка Сердца / Метки Сердца | Marca del Corazón / Marcas del Corazón | | Marca do Coração / Marcas do Coração | Herzmal / Herzmale | Marque du Cœur / Marques du Cœur | 刻印 | 각인 |
| Marks (short table header) | 心印 | Метки | Marcas | | Marcas | Male | Marques | 刻印 | 각인 |
| card / cards | 卡牌 | карта / карты | carta / cartas | | carta / cartas | Karte / Karten | carte / cartes | カード | 카드 |
| gold card | 金卡 | золотая карта | carta dorada | | carta dourada | Goldkarte | carte dorée | 金カード | 황금 카드 |
| Gold (card variant label) | 金卡 | Золотая | Dorada | | Dourada | Gold | Dorée | 金 | 황금 |
| Normal (not gold) | 普通 | Обычная | Normal | | Normal | Normal | Normale | 通常 | 일반 |
| Plain (first-lap color, `wiki.lap.plain`, `ui.cards.plain`) | 素色 | Простая | Sencilla | | Simples | Schlicht | Simple | 無色 | 무색 |
| card set / set | 卡牌套组 / 套组 | набор карт / набор | set de cartas / set | | conjunto de cartas / conjunto | Kartenset / Set | série de cartes / série | カードセット / セット | 카드 세트 / 세트 |
| gold set | 金卡套组 | золотой набор | set dorado | | conjunto dourado | Goldset | série dorée | 金カードセット | 황금 세트 |
| trophy / trophies | 奖杯 | трофей / трофеи | trofeo / trofeos | | troféu / troféus | Trophäe / Trophäen | trophée / trophées | トロフィー | 트로피 |
| Collection (dock) | 收藏 | Коллекция | Colección | | Coleção | Sammlung | Collection | コレクション | 컬렉션 |
| chest | 宝箱 | сундук | cofre | | baú | Truhe | coffre | 宝箱 | 보물 상자 |

- ja and ko: 刻印 / 각인 ("engraving") is deliberate. カタカナ「ハートマーク」 would read as the ♥ symbol. It also sets up the Spirit *The Engraver* (刻印師 / 각인사).
- Heartmark capitalization follows each language's proper-noun rule (the term is a named game object, like in English).

### 4.2 Systems and verbs

| English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|
| Attack (the manual click; verb, button, pad label) | 攻击 | атаковать; Атака (label) | atacar; Atacar | | atacar; Atacar | angreifen; Angriff (label) | attaquer; Attaquer | 攻撃 | 공격 |
| attack damage | 攻击伤害 | урон атаки | daño de ataque | | dano de ataque | Angriffsschaden | dégâts d'attaque | 攻撃ダメージ | 공격 피해 |
| party (everyone together) | 队伍 | отряд | grupo | | grupo | Gruppe | groupe | パーティー | 파티 |
| party damage | 队伍伤害 | урон отряда | daño del grupo | | dano do grupo | Gruppenschaden | dégâts du groupe | パーティーダメージ | 파티 피해 |
| Your Party (shop title) | 你的队伍 | Ваш отряд | Tu grupo | | Seu Grupo | Deine Gruppe | Votre groupe | パーティー | 내 파티 |
| companion / companions | 同伴 | соратник / соратники | compañero / compañeros | | companheiro / companheiros | Gefährte / Gefährten | compagnon / compagnons | 仲間 | 동료 |
| Hire | 雇佣 | Нанять | Contratar | | Contratar | Anheuern | Recruter | 雇う | 고용 |
| level (noun) [abbr.] | 等级 [Lv.] | уровень [ур.] | nivel [Nv.] | | nível [Nv.] | Stufe [St.] | niveau [Niv.] | レベル [Lv] | 레벨 [Lv.] |
| Level up (verb, button) | 升级 | Повысить уровень | Subir de nivel | | Subir de nível | Stufe erhöhen | Monter de niveau | レベルアップ | 레벨 업 |
| Level (pad label, "level them") | 升级 | Уровень | Subir nivel | | Subir nível | Aufwerten | Niveau | レベル | 레벨 |
| upgrade / trait (a companion's bought milestone, `{trait}`) | 强化 | улучшение | mejora | | melhoria | Upgrade / Upgrades | amélioration | 強化 | 강화 |
| milestone (level milestone) | 里程碑 | рубеж | hito | | marco | Meilenstein | palier | マイルストーン | 마일스톤 |
| Ascend (verb, button) | 飞升 | Вознестись | Ascender | | Ascender | Aufsteigen | Ascension (button); s'élever (verb) | 転生 | 승천 |
| ascent / ascents | 飞升 | вознесение / вознесения | ascensión / ascensiones | | ascensão / ascensões | Aufstieg / Aufstiege | ascension / ascensions | 転生 | 승천 |
| Awaken (the Heart) | 唤醒 | Пробудить | Despertar | | Despertar | Erwecken | Éveiller | 覚醒させる; 覚醒 (button) | 각성시키다; 각성 (button) |
| awakening / awakenings | 觉醒 | пробуждение / пробуждения | despertar / despertares | | despertar / despertares | Erweckung / Erweckungen | éveil / éveils | 覚醒 | 각성 |
| the Heart | 心脏 | Сердце | el Corazón | | o Coração | das Herz | le Cœur | 心臓 | 심장 |
| the Keep (home room) | 据点 | Крепость | el Torreón | | a Fortaleza | die Burg | le Bastion | 拠点 | 거점 |
| the Dungeon | 地牢 | Подземелье | la Mazmorra | | a Masmorra | das Verlies | le Donjon | ダンジョン | 던전 |
| expedition / expeditions | 远征 | вылазка / вылазки | expedición / expediciones | | expedição / expedições | Expedition / Expeditionen | expédition / expéditions | 遠征 | 원정 |
| hunter (a companion on an expedition) | 猎手 | охотник | cazador | | caçador | Jäger | chasseur | ハンター | 사냥꾼 |
| Call home | 召回 | Отозвать | Hacer volver | | Chamar de volta | Zurückrufen | Rappeler | 呼び戻す | 귀환 |
| Spirit / Spirits | 英灵 | Дух / Духи | Espíritu / Espíritus | | Espírito / Espíritos | Geist / Geister | Esprit / Esprits | 英霊 | 영령 |
| Summon | 召唤 | Призвать | Invocar | | Invocar | Beschwören | Invoquer | 召喚 | 소환 |
| Reroll | 刷新 | Сменить | Cambiar | | Sortear de novo | Neu würfeln | Relancer | 引き直し | 다시 뽑기 |
| Respec | 重置 | Сброс | Redistribuir | | Redistribuir | Neu verteilen | Réattribuer | 振り直し | 초기화 |
| the Bound (the eight bound zone bosses) | 被缚者 | Скованные | los Encadenados | | os Acorrentados | die Gebundenen | les Liés | 縛られし者 | 속박된 자들 |
| Bound (one of them, table label) | 被缚者 | Скованный | Encadenado | | Acorrentado | Gebundener | Lié | 縛られし者 | 속박된 자 |
| cycle ("souls this cycle") | 本轮 | цикл | ciclo | | ciclo | Zyklus | cycle | サイクル | 주기 |
| run / descent (one climb between ascents) | 本局 | забег / спуск | descenso | | descida | Durchlauf / Abstieg | partie / descente | 周回 | 이번 회차 / 하강 |
| hero (the companion you move) | 主角 | герой | héroe | | herói | Held | héros | 主人公 | 주인공 |
| cursor | 指针 | курсор | cursor | | cursor | Cursor | curseur | カーソル | 커서 |
| Auto | 自动 | Авто | Auto | | Auto | Auto | Auto | オート | 자동 |
| Auto-advance | 自动推进 | Автопереход | Avance automático | | Avanço automático | Auto-Vorrücken | Avance auto | オート進行 | 자동 진행 |
| Auto levels | 自动升级 | Автоуровни | Niveles automáticos | | Níveis Automáticos | Auto-Stufen | Niveaux auto | オートレベル | 자동 레벨 |
| Auto upgrades | 自动强化 | Автоулучшения | Mejoras automáticas | | Melhorias Automáticas | Auto-Upgrades | Améliorations auto | オート強化 | 자동 강화 |
| idle (not attacking) | 挂机 | без дела (label: Простой) | en reposo (label: Inactivo) | | ocioso (label: Ocioso) | im Leerlauf (label: Leerlauf) | au repos (label: Inactif) | 放置 | 방치 |
| active (attacking, records) | 操作 | Активно | Activo | | Ativo | Aktiv | Actif | アクティブ | 활동 |
| Stats (dock, screen) | 统计 | Статистика | Estadísticas | | Estatísticas | Statistik | Statistiques | 統計 | 통계 |
| Bonuses / Companions / Records / Ascents (stats tabs) | 加成 / 同伴 / 记录 / 飞升 | Бонусы / Соратники / Рекорды / Вознесения | Bonificaciones / Compañeros / Récords / Ascensiones | | Bônus / Companheiros / Recordes / Ascensões | Boni / Gefährten / Rekorde / Aufstiege | Bonus / Compagnons / Records / Ascensions | ボーナス / 仲間 / 記録 / 転生 | 보너스 / 동료 / 기록 / 승천 |
| Shortcuts | 快捷键 | Горячие клавиши | Atajos | | Atalhos | Tastenkürzel | Raccourcis | ショートカット | 단축키 |
| Trade | 交易 | Обмен; Обменять (button) | Intercambiar | | Trocar | Tauschen | Échanger | 交換 | 교환 |

- **zh-CN 飞升** is the established prestige word for Chinese idle and xianxia players; **ja 転生** is what Japanese idle games call this reset (a literal 昇天 reads as "dying"); **ko 승천** is literal and in use in Korean idle games.
- **de "Aufstieg" is the ascent.** Leveling uses *Stufe* (`Stufe erhöhen`, `St. 12`), so the two never collide.
- **fr "le Bastion"**: the literal word for a castle keep, *donjon*, is the French gamer's word for *dungeon* (Donjons et Dragons), so the Dungeon is *le Donjon* and the Keep is *le Bastion*.
- **Bound Demon** (a companion) deliberately avoids the word for *the Bound* in every language (§4.12).

### 4.3 Combat terms

| English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|
| damage | 伤害 | урон | daño | | dano | Schaden | dégâts | ダメージ | 피해 |
| damage per second / DPS | 每秒伤害 / DPS | урон в секунду / урон/с | daño por segundo / DPS | | dano por segundo / DPS | Schaden pro Sekunde / DPS | dégâts par seconde / DPS | 秒間ダメージ / DPS | 초당 피해 / DPS |
| damage/sec, party/s (HUD) | 伤害/秒, 队伍/秒 | урон/с, отряд/с | daño/s, grupo/s | | dano/s, grupo/s | Schaden/s, Gruppe/s | dégâts/s, groupe/s | ダメージ/秒, パーティー/秒 | 피해/초, 파티/초 |
| critical hit / crit | 暴击 | критический удар / крит | golpe crítico / crítico | | acerto crítico / crítico | kritischer Treffer / Krit | coup critique / critique | クリティカル | 치명타 |
| crit chance | 暴击率 | шанс крита | probabilidad de crítico | | chance de crítico | Kritchance | chances de critique | クリティカル率 | 치명타 확률 |
| crit damage | 暴击伤害 | урон крита | daño crítico | | dano crítico | Kritschaden | dégâts critiques | クリティカルダメージ | 치명타 피해 |
| cleave (the stat, see the ability in §4.4) | 顺劈斩 | рассечение | tajo | | golpe amplo | Spalten | fauchage | なぎ払い | 광역 베기 |
| monster / monsters | 怪物 | монстр / монстры | monstruo / monstruos | | monstro / monstros | Monster / Monster | monstre / monstres | モンスター | 몬스터 |
| kill / kills | 击杀 | убийство / убийства | baja / bajas | | abate / abates | Kill / Kills | élimination / éliminations | 撃破 | 처치 |
| floor (dungeon level) | 层 (第{floor}层) | этаж | piso | | andar | Ebene | étage | 階 ({floor}階) | 층 ({floor}층) |
| zone | 区域 | зона | zona | | zona | Zone | zone | エリア | 구역 |
| lap (one pass through all zones) | 周目 | круг | vuelta | | volta | Runde | tour | 周回 | 회차 |
| corruption (laps' theme) | 腐化 | скверна | corrupción | | corrupção | Verderbnis | corruption | 穢れ | 타락 |
| boss | 首领 | босс | jefe | | chefe | Boss | boss | ボス | 보스 |
| mid-boss (floors ending in 5) | 小首领 | мини-босс | jefe intermedio | | subchefe | Zwischenboss | mini-boss | 中ボス | 중간 보스 |
| zone boss (floors ending in 0) | 区域首领 | босс зоны | jefe de zona | | chefe da zona | Zonenboss | boss de zone | エリアボス | 구역 보스 |
| Champion (a tougher, richer boss) | 精英 | чемпион | campeón | | campeão | Champion | champion | チャンピオン | 챔피언 |
| champion boss | 精英首领 | босс-чемпион | jefe campeón | | chefe campeão | Champion-Boss | boss champion | チャンピオンボス | 챔피언 보스 |
| CHAMPION! (pop) | 精英！ | ЧЕМПИОН! | ¡CAMPEÓN! | | CAMPEÃO! | CHAMPION! | CHAMPION ! | チャンピオン！ | 챔피언! |
| Guardian (boss banner) | 守护者 | Страж | Guardián | | Guardião | Wächter | Gardien | 守護者 | 수호자 |
| modifier (boss modifier) | 词缀 | модификатор | modificador | | modificador | Modifikator | modificateur | 特性 | 특성 |
| streak (`legend.unbroken.term`) | 连击 | серия | racha | | sequência | Serie | combo | コンボ | 연속 공격 |
| CLUTCH! (boss beaten with ≤3 s left) | 绝杀！ | НА ВОЛОСКЕ! | ¡POR LOS PELOS! | ¡POR UN PELO! | NO LIMITE! | KNAPP! | IN EXTREMIS ! | ギリギリ！ | 아슬아슬! |
| clutch kill (records) | 绝杀 | победа на волоске | victoria por los pelos | victoria por un pelo | vitória no limite | knapper Sieg | victoire in extremis | ギリギリ撃破 | 아슬아슬한 처치 |
| overkill (`legend.ronin.term`) | 过量击杀 | избыточный урон | daño excedente | | dano excedente | Overkill | overkill | オーバーキル | 오버킬 |
| sweep / Swept! (a floor killed in a second) | 横扫 / 横扫！ | зачистка / Зачищено! | barrido / ¡Barrido! | | varredura / Varrido! | Fegen / Weggefegt! | nettoyage / Nettoyé ! | 一掃 / 一掃！ | 싹쓸이 / 싹쓸이! |
| ability / abilities (also "skill" in the UI) | 技能 | способность / способности | habilidad / habilidades | | habilidade / habilidades | Fähigkeit / Fähigkeiten | compétence / compétences | アビリティ | 능력 |
| cooldown | 冷却 | перезарядка | enfriamiento | | recarga | Abklingzeit | temps de recharge | クールダウン | 쿨타임 |
| buff / buffs | 增益 | усиление / усиления | potenciador / potenciadores | | buff / buffs | Buff / Buffs | buff / buffs | バフ | 버프 |

- Words chosen so the near-synonyms never share a word inside one language: *cleave / sweep / streak / Flurry* (zh 顺劈斩 / 横扫 / 连击 / 乱舞; fr fauchage / nettoyage / combo / Rafale; ko 광역 베기 / 싹쓸이 / 연속 공격 / 난타).
- **de, fr, ru, es:** the Spirits are *Geister / Esprits / Духи / Espíritus*, so ghostly monsters never use those words (Wraith = *Gespenst / spectre / призрак / espectro*, §4.9).

### 4.4 Abilities (`ability.*.name`)

| id | English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| blade | Phantom Blade | 幻影之刃 | Призрачный клинок | Hoja fantasma | | Lâmina Fantasma | Phantomklinge | Lame fantôme | 幻影の刃 | 환영검 |
| crit | Critical Hits | 暴击 | Критические удары | Golpes críticos | | Golpes Críticos | Kritische Treffer | Coups critiques | クリティカル | 치명타 |
| cleave | Cleave | 顺劈斩 | Рассечение | Tajo | | Golpe Amplo | Spalten | Fauchage | なぎ払い | 광역 베기 |
| rampage | Rampage | 狂暴 | Буйство | Furia | | Fúria | Raserei | Carnage | 暴走 | 폭주 |
| drums | War Drums | 战鼓 | Боевые барабаны | Tambores de guerra | | Tambores de Guerra | Kriegstrommeln | Tambours de guerre | 戦太鼓 | 전쟁의 북 |
| flurry | Flurry | 乱舞 | Шквал | Ráfaga | | Rajada | Schlaghagel | Rafale | 乱れ打ち | 난타 |
| legion | Phantom Legion | 幻影军团 | Призрачный легион | Legión fantasma | | Legião Fantasma | Phantomlegion | Légion fantôme | 幻影の軍勢 | 환영 군단 |
| treasure | Treasure Sense | 寻宝直觉 | Чутьё на сокровища | Olfato para el tesoro | | Faro para Tesouros | Schatzgespür | Flair du trésor | お宝センサー | 보물 감지 |

- **Rampage** is also the bar, the pop-up (`RAMPAGE ×{mult}!` → `狂暴 ×{mult}！`, `БУЙСТВО ×{mult}!`, `¡FURIA ×{mult}!`, `FÚRIA ×{mult}!`, `RASEREI ×{mult}!`, `CARNAGE ×{mult} !`, `暴走 ×{mult}！`, `폭주 ×{mult}!`) and the verb in trophies ("Go on a Rampage" → *entrar en furia*, *in Raserei geraten*, *déclencher un carnage*, *впасть в буйство*…).
- Ability names are proper names: capitalized as such in running text.

### 4.5 Buffs and rewards (`game.buff.*`, `ui.reward.*`, goblin rewards)

| id | English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| bloodlust | Bloodlust | 嗜血 | Жажда крови | Sed de sangre | | Sede de Sangue | Blutdurst | Soif de sang | 血の渇き | 피의 갈망 |
| heartstorm | Frenzy | 癫狂 | Исступление | Frenesí | | Frenesi | Furor | Frénésie | 狂乱 | 광란 |
| soulstorm | Soul Storm | 灵魂风暴 | Буря душ | Tormenta de almas | | Tempestade de Almas | Seelensturm | Tempête d'âmes | 魂の嵐 | 영혼 폭풍 |
| deadeye | Deadeye | 鹰眼 | Зоркий глаз | Ojo certero | | Olho Certeiro | Adlerauge | Œil de lynx | 鷹の目 | 매의 눈 |
| brutal | Brutality | 残暴 | Свирепость | Brutalidad | | Brutalidade | Brutalität | Brutalité | 残虐 | 잔혹 |
| horde | Gold Rush | 淘金热 | Золотая лихорадка | Fiebre del oro | | Febre do Ouro | Goldrausch | Ruée vers l'or | ゴールドラッシュ | 골드 러시 |
| vault | Rainbow Vault | 彩虹宝库 | Радужная сокровищница | Cámara Arcoíris | | Cofre Arco-Íris | Regenbogentresor | Caveau arc-en-ciel | 虹の宝物庫 | 무지개 금고 |
| fever | Rampage | 狂暴 | Буйство | Furia | | Fúria | Raserei | Carnage | 暴走 | 폭주 |
| plunder | Treasure! (pop) | 财宝！ | Сокровище! | ¡Tesoro! | | Tesouro! | Schatz! | Trésor ! | お宝！ | 보물! |
| | Plunder (wiki name of that reward) | 财宝 | Добыча | Botín | | Saque | Beute | Butin | お宝 | 전리품 |
| rainbow | Rainbow Haul | 彩虹战利品 | Радужный улов | Botín arcoíris | | Saque Arco-Íris | Regenbogenbeute | Butin arc-en-ciel | 虹色の戦利品 | 무지개 전리품 |
| | Rainbow chest | 彩虹宝箱 | радужный сундук | cofre arcoíris | | baú arco-íris | Regenbogentruhe | coffre arc-en-ciel | 虹色の宝箱 | 무지개 상자 |

- The pop-ups (`ui.reward.*`) are the same names with the language's exclamation (`¡Sed de sangre!`, `Blutdurst!`, `Soif de sang !`, `嗜血！`).
- *Rainbow Vault* is both the buff and the place (§4.9). Its word differs from the *Frozen Vault* zone's in every language except fr, where both are *caveau* (the adjectives tell them apart).

### 4.6 Boss modifiers (`mod.*.name`)

Adjectives describe the boss (masculine where the language needs a gender: *босс*, *jefe*, *chefe*, *boss*).

| id | English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| armored | Armored | 铁甲 | Бронированный | Acorazado | | Blindado | Gepanzert | Blindé | 装甲 | 중장갑 |
| enraged | Enraged | 狂怒 | Разъярённый | Enfurecido | | Enfurecido | Erzürnt | Enragé | 激怒 | 격노 |
| regen | Regenerating | 再生 | Регенерирующий | Regenerador | | Regenerador | Regenerierend | Régénérant | 再生 | 재생 |
| split | Splitting | 分裂 | Делящийся | Divisible | | Divisível | Teilend | Divisible | 分裂 | 분열 |
| giant | Giant | 巨型 | Гигантский | Gigante | | Gigante | Riesig | Géant | 巨大 | 거대 |
| | Split! (pop) | 分裂！ | Деление! | ¡División! | | Dividiu! | Geteilt! | Division ! | 分裂！ | 분열! |

- de *Teilend*, not *Spaltend*: *Spalten* is Cleave.

### 4.7 Spirits (`legend.*.name`)

Spirits are titles, so they keep their article where the language has one (like English "The Sleeper"). Templates treat the whole name as a nominative label (§1.2).

| id | English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| sleeper | The Sleeper | 沉眠者 | Спящий | El Durmiente | | O Adormecido | Der Schläfer | Le Dormeur | 眠れる者 | 잠든 자 |
| fist | The Fist | 铁拳 | Кулак | El Puño | | O Punho | Die Faust | Le Poing | 鉄拳 | 철권 |
| breaker | The Breaker | 粉碎者 | Сокрушитель | El Quebrantador | | O Esmagador | Der Brecher | Le Briseur | 砕く者 | 파괴자 |
| needle | The Needle | 银针 | Игла | La Aguja | | A Agulha | Die Nadel | L'Aiguille | 針 | 바늘 |
| engraver | The Engraver | 铭刻者 | Гравёр | El Grabador | | O Entalhador | Der Graveur | Le Graveur | 刻印師 | 각인사 |
| hoard | The Hoard | 聚宝盆 | Клад | La Fortuna | | A Fortuna | Der Hort | Le Magot | 宝の山 | 보물더미 |
| patient | The Patient | 静候者 | Терпеливый | El Paciente | | O Paciente | Der Geduldige | Le Patient | 待つ者 | 인내하는 자 |
| goblinking | The Wish | 心愿 | Желание | El Deseo | | O Desejo | Der Wunsch | Le Vœu | 願い | 소원 |
| unbroken | The Unbroken | 不屈者 | Несломленный | El Inquebrantable | | O Inquebrável | Der Ungebrochene | L'Inébranlable | 不屈の者 | 꺾이지 않는 자 |
| hourglass | The Hourglass | 沙漏 | Песочные часы | El Reloj de Arena | | A Ampulheta | Die Sanduhr | Le Sablier | 砂時計 | 모래시계 |
| wither | The Wither | 凋零 | Увядание | La Marchitez | | O Definhamento | Das Siechen | Le Flétrissement | 衰え | 쇠약 |
| thinning | The Thinning | 减员 | Прореживание | La Poda | | O Desbaste | Die Ausdünnung | L'Éclaircie | 間引き | 솎아내기 |
| haggler | The Haggler | 砍价者 | Торгаш | El Regateador | | O Pechincheiro | Der Feilscher | Le Marchandeur | 値切り屋 | 흥정꾼 |
| restless | The Restless | 躁动者 | Неугомонный | El Inquieto | | O Inquieto | Der Rastlose | L'Agité | せっかち | 쉬지 않는 자 |
| soulcaller | The Soulcaller | 唤魂者 | Призыватель душ | El Convocador de Almas | | O Chamador de Almas | Der Seelenrufer | L'Appeleur d'âmes | 魂呼び | 영혼 소환사 |
| lure | The Lure | 诱饵 | Приманка | El Señuelo | | A Isca | Der Köder | L'Appât | おとり | 미끼 |
| collector | The Collector | 收藏家 | Собирательница | La Coleccionista | | A Colecionadora | Die Sammlerin | La Collectionneuse | 蒐集家 | 수집가 |
| ronin | The Ronin | 浪人 | Ронин | El Ronin | | O Ronin | Der Ronin | Le Rônin | 浪人 | 낭인 |
| lingering | The Lingering | 余韵 | Отзвук | La Persistente | | A Persistente | Die Verweilende | La Persistante | 名残 | 여운 |
| whirl | The Whirl | 旋风 | Вихрь | El Remolino | | O Redemoinho | Der Wirbel | Le Tourbillon | 旋風 | 회오리 |
| headsman | The Headsman | 刽子手 | Палач | El Verdugo | | O Carrasco | Der Henker | Le Bourreau | 処刑人 | 처형인 |
| magpie | The Magpie | 喜鹊 | Сорока | La Urraca | | A Gralha | Die Elster | La Pie | カササギ | 까치 |
| drummer | The Drummer | 鼓手 | Барабанщик | El Tamborilero | | O Tamborileiro | Der Trommler | Le Tambour | 鼓手 | 고수 |
| host | The Host | 万军 | Воинство | La Hueste | | A Hoste | Die Heerschar | La Horde | 軍勢 | 만군 |
| hungry | The Hungry Dark | 饥饿之暗 | Голодная тьма | La Oscuridad Hambrienta | | A Escuridão Faminta | Die Hungrige Finsternis | Les Ténèbres affamées | 飢えたる闇 | 굶주린 어둠 |

Spirit kinds (`ui.spirit.kind.*`):

| English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|
| Power | 力量 | Мощь | Poder | | Poder | Kraft | Puissance | パワー | 힘 |
| Utility | 辅助 | Польза | Utilidad | | Utilidade | Nutzen | Utilité | 補助 | 보조 |
| Sink | 无底 | Поглощение | Sumidero | | Sorvedouro | Schlund | Gouffre | 底なし | 무한 |

- Gender follows the sprite where the language marks it: the Collector is a princess, the Lingering a geisha (feminine forms in ru/es/pt/de/fr). The rest take the grammatical gender of their noun.
- The Host: an army ("heavenly host") that lengthens Phantom Legion. fr *La Horde* because *l'Ost* is too archaic.
- The Wish (id `goblinking`) is a fairy granting goblin gold.
- es: *La Poda* (pruning) and fr *L'Éclaircie* (forest thinning, and "a sunny spell") keep the double meaning of thinning a crowd.
- `legend.*.what` (what each boosts) is translated freely, but must use the §4 terms ("Each Heartmark" → *Cada Marca del Corazón*, *Jedes Herzmal*, *每个心印*).

### 4.8 The Bound: the eight zone bosses

These are the zone bosses' monster names. The same string shows on the boss banner, the monster card, the wiki and the Heart's room. Unique bosses whose English starts with "The" keep an article where the language has one.

| Bound id | Zone | English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ogre | 1 Upper Halls | Ogre Chieftain | 食人魔酋长 | Вождь огров | Jefe ogro | | Chefe Ogro | Ogerhäuptling | Chef ogre | オーガの族長 | 오우거 족장 |
| lich | 2 Bone Crypts | The Lich | 巫妖 | Лич | El Liche | | O Lich | Der Lich | La Liche | リッチ | 리치 |
| troll | 3 Overgrown Warrens | Troll Brute | 巨魔蛮兵 | Тролль-громила | Trol bruto | | Troll Brutamontes | Trollrohling | Troll cogneur | 荒くれトロール | 흉포한 트롤 |
| golem | 4 Sunken Tomb | Tomb Golem | 古墓魔像 | Гробничный голем | Gólem de la tumba | | Golem da Tumba | Grabgolem | Golem du tombeau | 墳墓のゴーレム | 무덤 골렘 |
| thing | 5 Rotting Deep | The Thing Below | 地底之物 | Нечто снизу | La Cosa de Abajo | | A Coisa Lá de Baixo | Das Ding von unten | La Chose d'en bas | 地の底のモノ | 아래의 그것 |
| ent | 6 Enchanted Grove | The Elder Ent | 远古树人 | Древний энт | El Ent Anciano | | O Ent Ancião | Der Uralte Ent | L'Ent ancestral | 古きエント | 고대 엔트 |
| pitlord | 7 Demon Gate | Pit Lord | 炼狱领主 | Владыка преисподней | Señor del foso | | Senhor do Fosso | Grubenlord | Seigneur des fosses | ピットロード | 구덩이 군주 |
| frost | 8 Frozen Vault | Frost Troll | 冰霜巨魔 | Ледяной тролль | Trol de escarcha | | Troll Gélido | Frosttroll | Troll des glaces | 氷のトロール | 서리 트롤 |

- **Pit Lord** avoids the Abyssal lap's word in zh-CN and ru (*深渊领主*, *Повелитель Бездны* would become "深渊深渊领主" on the second lap).
- ru *Нечто* is the Russian title of *The Thing*; ko *그것* is the Korean title of Stephen King's *It*: the same unnamed horror.
- `bound.*.what` ("The Lure's effect", "Spirit costs") is a whole content string, not a template, so the Spirit name inside it may be inflected normally (`Эффект Приманки`, `Wirkung des Köders`, `Effet de l'Appât`).

### 4.9 Other recurring monsters and creature words

Monster names that recur in UI and wiki text, the mid-bosses, and the base creature words every other monster name is built from. The other 50-odd monster names are translated by each translator, built from these words.

| English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|
| Treasure Goblin (card; "treasure goblin" in text) | 宝藏哥布林 | гоблин-сокровищник | goblin del tesoro | | goblin do tesouro | Schatzgoblin | gobelin aux trésors | トレジャーゴブリン | 보물 고블린 |
| Rainbow Goblin | 彩虹哥布林 | радужный гоблин | goblin arcoíris | | goblin arco-íris | Regenbogengoblin | gobelin arc-en-ciel | 虹色ゴブリン | 무지개 고블린 |
| Rainbow Vault (the place) | 彩虹宝库 | Радужная сокровищница | Cámara Arcoíris | | Cofre Arco-Íris | Regenbogentresor | Caveau arc-en-ciel | 虹の宝物庫 | 무지개 금고 |
| The Rotten King (lap 2, Rotting Deep) | 腐烂之王 | Гнилой король | El Rey Podrido | | O Rei Podre | Der Verfaulte König | Le Roi pourri | 腐れの王 | 썩은 왕 |
| Cave Bear (mid-boss 1) | 洞穴熊 | Пещерный медведь | Oso de las cavernas | | Urso das Cavernas | Höhlenbär | Ours des cavernes | 洞窟グマ | 동굴 곰 |
| Bone Golem (mid-boss 2) | 白骨魔像 | Костяной голем | Gólem de hueso | | Golem de Ossos | Knochengolem | Golem d'os | 骨のゴーレム | 뼈 골렘 |
| Elder Shroom (mid-boss 3) | 蘑菇长老 | Гриб-старейшина | Seta anciana | Hongo anciano | Cogumelo Ancião | Pilzältester | Vieux champignon | キノコ長老 | 장로 버섯 |
| Gnoll Overseer (mid-boss 4) | 豺狼人监工 | Гнолл-надсмотрщик | Capataz gnoll | | Capataz Gnoll | Gnollaufseher | Contremaître gnoll | ノールの監督 | 놀 감독관 |
| Sludge Walker (mid-boss 5) | 污泥行者 | Шламоход | Caminante de lodo | | Andarilho do Lodo | Schlammläufer | Marcheur de boue | ヘドロウォーカー | 오물 보행자 |
| Grove Bear (mid-boss 6) | 林地熊 | Медведь рощи | Oso de la arboleda | | Urso do Bosque | Hainbär | Ours du bosquet | 木立のクマ | 숲 곰 |
| Hellfire Ogre (mid-boss 7) | 狱火食人魔 | Огр адского пламени | Ogro del fuego infernal | | Ogro do Fogo Infernal | Höllenfeueroger | Ogre des flammes infernales | ヘルファイアオーガ | 지옥불 오우거 |
| Ice Golem (mid-boss 8) | 寒冰魔像 | Ледяной голем | Gólem de hielo | | Golem de Gelo | Eisgolem | Golem de glace | 氷のゴーレム | 얼음 골렘 |
| goblin | 哥布林 | гоблин | goblin | | goblin | Goblin | gobelin | ゴブリン | 고블린 |
| skeleton | 骷髅 | скелет | esqueleto | | esqueleto | Skelett | squelette | スケルトン | 해골 |
| zombie | 僵尸 | зомби | zombi | | zumbi | Zombie | zombie | ゾンビ | 좀비 |
| imp | 小鬼 | бесёнок | diablillo | | diabrete | Wichtel | diablotin | インプ | 임프 |
| oni | 鬼 | они | oni | | oni | Oni | oni | 鬼 | 오니 |
| ogre | 食人魔 | огр | ogro | | ogro | Oger | ogre | オーガ | 오우거 |
| troll | 巨魔 | тролль | trol | | troll | Troll | troll | トロール | 트롤 |
| golem | 魔像 | голем | gólem | | golem | Golem | golem | ゴーレム | 골렘 |
| lich | 巫妖 | лич | liche | | lich | Lich | liche | リッチ | 리치 |
| ent | 树人 | энт | ent | | ent | Ent | ent | エント | 엔트 |
| gnoll | 豺狼人 | гнолл | gnoll | | gnoll | Gnoll | gnoll | ノール | 놀 |
| orc | 兽人 | орк | orco | | orc | Ork | orc | オーク | 오크 |
| wraith | 怨灵 | призрак | espectro | | espectro | Gespenst | spectre | レイス | 망령 |
| ghost | 幽灵 | привидение | fantasma | | fantasma | Gespenst | fantôme | ゴースト | 유령 |
| slime | 史莱姆 | слизень | limo | | gosma | Schleim | slime | スライム | 슬라임 |
| mushroom / shroom | 蘑菇 | гриб | seta | hongo | cogumelo | Pilz | champignon | キノコ | 버섯 |

- es vs es-419: *seta* (Spain) vs *hongo* (Latin America) for every mushroom monster (Elder Shroom, Mushroom Folk, Sporeling's description).
- Monster names other than unique bosses take no article (`Esqueleto del Abismo`, not `El esqueleto…`).
- Card titles (`ui.card.name` "{name} Card", `ui.tip.card.goldName` "Gold {name} Card") put the bare name after a colon in the inflecting languages, because names contain spaces and articles: zh-CN `{name}卡牌`, ru `Карта: {name}`, es and pt-BR `Carta: {name}`, de `Karte: {name}`, fr `Carte : {name}`, ja `{name}のカード`, ko `{name} 카드`.

### 4.10 Zones (`zone.*.name`)

Zone names keep their article where English has one and the language uses one for place names. They appear as titles (zone intro, map, main menu "Floor {floor} · {zone}") and inside the lap template (§4.11).

| id | English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| upper-halls | The Upper Halls | 上层大厅 | Верхние залы | Las Salas Superiores | | Os Salões Superiores | Die Oberen Hallen | Les Salles hautes | 上層の大広間 | 상층 회랑 |
| bone-crypts | The Bone Crypts | 白骨墓穴 | Костяные склепы | Las Criptas de Hueso | | As Criptas de Ossos | Die Knochengrüfte | Les Cryptes d'os | 骨の地下墓所 | 뼈의 지하묘지 |
| overgrown-warrens | The Overgrown Warrens | 蔓生巢穴 | Заросшие норы | Las Madrigueras Frondosas | | As Tocas Selvagens | Die Überwucherten Gänge | Les Terriers broussailleux | 草むす巣穴 | 우거진 굴 |
| sunken-tomb | The Sunken Tomb | 沉没古墓 | Затонувшая гробница | La Tumba Hundida | | A Tumba Submersa | Das Versunkene Grab | Le Tombeau englouti | 沈みし墳墓 | 가라앉은 무덤 |
| rotting-deep | The Rotting Deep | 腐烂深渠 | Гниющие глубины | Las Profundidades Podridas | | As Profundezas Pútridas | Die Faulende Tiefe | Les Profondeurs putrides | 腐りゆく深層 | 썩어가는 심층 |
| enchanted-grove | The Enchanted Grove | 魔法树林 | Зачарованная роща | La Arboleda Encantada | | O Bosque Encantado | Der Verzauberte Hain | Le Bosquet enchanté | 魔法の木立 | 마법의 숲 |
| demon-gate | The Demon Gate | 恶魔之门 | Демонические врата | La Puerta Demoníaca | | O Portão Demoníaco | Das Dämonentor | La Porte démoniaque | 魔界の門 | 악마의 문 |
| frozen-vault | The Frozen Vault | 冰封地宫 | Ледяные своды | La Bóveda Helada | | A Abóbada Gelada | Das Eisgewölbe | Le Caveau gelé | 凍てつく地下宮殿 | 얼어붙은 지하궁 |

- *The Rotting Deep* is the sewer zone: zh 深渠 (deep channel) and ko/ja 심층/深層 keep it clear of the Abyssal lap's 深渊/深淵/심연.
- Flavor lines mention zones ("Came up from the Frozen Vault", "Grew up in the Enchanted Grove"): there the translator may inflect the name inside the sentence (`aus dem Eisgewölbe`, `du Caveau gelé`, `из Ледяных сводов`). Only placeholders must stay in dictionary form.

### 4.11 Laps and colored names (`lap.*`, `data.zone.colored`, `data.card.colored`)

From floor 81 the zones come round again in a new color, and monster and zone names take the lap's word. Each lap has three strings:

- `lap.N.name`: the lap's label on its own ("Corrupted" in the wiki table, "Past the {lap} lap…").
- `lap.N.word`: what goes into `{color}` in the name templates.
- `lap.N.state`: what goes into `{corruption}` in `ui.banner.zoneLap`: "Everything returns {corruption} · floors {from}–{to}".

**How the inflecting languages avoid gender agreement:** ru, de, fr, es and pt-BR use an **invariable genitive phrase** after the name, with the order `{name} {color}` / `{zone} {color}`. "Скелет Бездны", "Skelett des Abgrunds", "Squelette des Abysses", "Esqueleto del Abismo", "Esqueleto do Abismo". The lap label (`name`) is the bare noun. zh-CN, ja and ko put an attributive word before the name, which needs no agreement.

| Lap | English (name = word; state) | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 name | Corrupted | 腐化 | Скверна | Corrupción | | Corrupção | Verderbnis | Corruption | 穢れ | 타락 |
| 1 word | Corrupted | 腐化 | Скверны | de la Corrupción | | da Corrupção | der Verderbnis | de la Corruption | 穢れし | 타락한 |
| 1 state | corrupted | 腐化 | осквернённым | corrompido | | corrompido | verderbt | corrompu | 穢れて | 타락하여 |
| 2 name | Abyssal | 深渊 | Бездна | Abismo | | Abismo | Abgrund | Abysses | 深淵 | 심연 |
| 2 word | Abyssal | 深渊 | Бездны | del Abismo | | do Abismo | des Abgrunds | des Abysses | 深淵の | 심연의 |
| 2 state | abyssal | 堕入深渊 | из Бездны | abisal | | abissal | abgründig | abyssal | 深淵に染まって | 심연에 물들어 |
| 3 name | Hollow | 虚空 | Пустота | Vacío | | Vazio | Leere | Néant | 虚ろ | 공허 |
| 3 word | Hollow | 虚空 | Пустоты | del Vacío | | do Vazio | der Leere | du Néant | 虚ろなる | 공허한 |
| 3 state | hollow | 化为虚空 | опустошённым | vacío | | vazio | ausgehöhlt | creux | 虚ろになって | 공허해져 |
| 4 name | Eternal | 永恒 | Вечность | Eternidad | | Eternidade | Ewigkeit | Éternité | 永劫 | 영원 |
| 4 word | Eternal | 永恒 | Вечности | de la Eternidad | | da Eternidade | der Ewigkeit | de l'Éternité | 永劫の | 영원한 |
| 4 state | eternal | 归于永恒 | вечным | eterno | | eterno | ewig | éternel | 永劫をまとって | 영원을 입고 |
| `wiki.lap.plain` | Plain | 素色 | Простая | Sencilla | | Simples | Schlicht | Simple | 無色 | 무색 |

The templates in `src/i18n/en/data.ts` (`.the` only fires for English names starting with "The ", but every locale must still have it; make it the same as the plain one):

| Key | English | zh-CN | ru, de, fr, es, pt-BR | ja | ko |
|---|---|---|---|---|---|
| `data.card.colored` | `{color} {name}` | `{color}{name}` | `{name} {color}` | `{color}{name}` | `{color} {name}` |
| `data.card.colored.the` | `The {color} {name}` | `{color}{name}` | `{name} {color}` | `{color}{name}` | `{color} {name}` |
| `data.zone.colored` | `The {color} {zone}` | `{color}{zone}` | `{zone} {color}` | `{color}{zone}` | `{color} {zone}` |
| `data.zone.numbered` | `{zone} {numeral}` | `{zone} {numeral}` | `{zone} {numeral}` | `{zone} {numeral}` | `{zone} {numeral}` |

Results:

| | zh-CN | ru | es | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|
| card | 深渊骷髅 | Скелет Бездны | Esqueleto del Abismo | Esqueleto do Abismo | Skelett des Abgrunds | Squelette des Abysses | 深淵のスケルトン | 심연의 해골 |
| unique boss | 腐化巫妖 | Лич Скверны | El Liche de la Corrupción | O Lich da Corrupção | Der Lich der Verderbnis | La Liche de la Corruption | 穢れしリッチ | 타락한 리치 |
| zone | 永恒上层大厅 II | Верхние залы Вечности II | Las Salas Superiores de la Eternidad II | Os Salões Superiores da Eternidade II | Die Oberen Hallen der Ewigkeit II | Les Salles hautes de l'Éternité II | 永劫の上層の大広間 II | 영원한 상층 회랑 II |

`ui.banner.zoneLap` per language, with the `state` forms above:

| Language | Template |
|---|---|
| zh-CN | `万物重临，皆已{corruption} · 第{from}–{to}层` |
| ru | `Всё возвращается {corruption} · этажи {from}–{to}` |
| es | `Todo vuelve {corruption} · pisos {from}–{to}` |
| pt-BR | `Tudo volta {corruption} · andares {from}–{to}` |
| de | `Alles kehrt {corruption} zurück · Ebenen {from}–{to}` |
| fr | `Tout revient {corruption} · étages {from}–{to}` |
| ja | `すべてが{corruption}還ってくる · {from}–{to}階` |
| ko | `모든 것이 {corruption} 돌아옵니다 · {from}–{to}층` |

- The `state` forms agree with the language's word for "everything" (ru *всё*: neuter instrumental; es *todo*, pt *tudo*, fr *tout*: masculine singular; de: uninflected adverbial adjective).
- Trophy names that echo the laps ("Corruption", "The Abyss Stares Back", "Hollowed Out", "Eternity") should echo these lap words.

### 4.12 Companions (`comp.*.name`)

Companion names are role names used like proper names: no article (except The Count), capitalized at the start, and templates never add "the" (§1.2). The gender column is the character's, from the sprite and the English pronouns. Gendered languages use that gender's form where one exists.

| id | English | Gender | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|---|
| squire | Squire | m | 侍从 | Оруженосец | Escudero | | Escudeiro | Knappe | Écuyer | 見習い騎士 | 견습 기사 |
| ranger | Ranger | f | 游侠 | Следопытка | Exploradora | | Patrulheira | Waldläuferin | Rôdeuse | レンジャー | 레인저 |
| brawler | Dwarf Brawler | m | 矮人斗士 | Гном-драчун | Enano pendenciero | | Anão Brigão | Zwergenraufbold | Nain bagarreur | ドワーフの喧嘩屋 | 드워프 싸움꾼 |
| apprentice | Apprentice | m | 学徒 | Подмастерье | Aprendiz | | Aprendiz | Lehrling | Apprenti | 見習い魔術師 | 수습 마법사 |
| shieldmaiden | Shieldmaiden | f | 盾女 | Дева щита | Doncella escudera | | Donzela do Escudo | Schildmaid | Vierge au bouclier | 盾の乙女 | 방패 여전사 |
| hunter | Lizard Hunter | f | 蜥蜴猎手 | Охотница-ящерица | Cazadora lagarto | | Caçadora Lagarto | Echsenjägerin | Chasseuse lézard | トカゲの狩人 | 도마뱀 사냥꾼 |
| thief | Shadow Thief | m | 暗影盗贼 | Теневой вор | Ladrón de las sombras | | Ladrão das Sombras | Schattendieb | Voleur des ombres | 影の盗賊 | 그림자 도둑 |
| corsair | Corsair Captain | m | 私掠船长 | Капитан корсаров | Capitán corsario | | Capitão Corsário | Korsarenkapitän | Capitaine corsaire | 海賊船長 | 해적 선장 |
| runesmith | Runesmith | f | 符文匠 | Рунный кузнец | Herrera de runas | | Ferreira Rúnica | Runenschmiedin | Forgeronne de runes | ルーン鍛冶 | 룬 대장장이 |
| woodelf | Wood Elf | f | 木精灵 | Лесная эльфийка | Elfa del bosque | | Elfa da Floresta | Waldelfe | Elfe sylvestre | ウッドエルフ | 우드 엘프 |
| stormcaller | Stormcaller | f | 唤雷者 | Призывательница бурь | Invocadora de tormentas | | Invocadora de Tempestades | Sturmruferin | Invocatrice d'orages | 嵐呼び | 폭풍술사 |
| dancer | Blade Dancer | m | 剑舞者 | Танцор с клинками | Danzante de espadas | | Dançarino das Lâminas | Klingentänzer | Danseur de lames | 剣舞士 | 검무사 |
| bard | Rocker | m | 摇滚歌手 | Рокер | Rockero | | Roqueiro | Rocker | Rockeur | ロッカー | 로커 |
| venomblade | Venomblade | f | 毒刃 | Ядовитый клинок | Hoja venenosa | | Lâmina Venenosa | Giftklinge | Lame venimeuse | 毒刃 | 독검사 |
| doctor | Plague Doctor | m | 瘟疫医生 | Чумной доктор | Médico de la peste | | Médico da Peste | Pestdoktor | Médecin de peste | ペスト医師 | 역병 의사 |
| cleric | Cleric | m | 牧师 | Жрец | Clérigo | | Clérigo | Kleriker | Clerc | 僧侶 | 성직자 |
| frostimp | Frost Imp | m | 霜冻小鬼 | Ледяной бесёнок | Diablillo de escarcha | | Diabrete Gélido | Frostwichtel | Diablotin du givre | フロストインプ | 서리 임프 |
| gingerbread | G Man | m | 姜饼人 | Пряня | Don Jengibre | | Biscoito | Herr Lebkuchen | Ti-Biscuit | ジンジャーマン | 진저맨 |
| santa | Santa | m | 圣诞老人 | Санта | Papá Noel | Santa Claus | Papai Noel | Weihnachtsmann | Père Noël | サンタ | 산타 |
| paladin | Paladin | m | 圣骑士 | Паладин | Paladín | | Paladino | Paladin | Paladin | 聖騎士 | 성기사 |
| hollow | Lantern Knight | m | 南瓜灯骑士 | Фонарный рыцарь | Caballero linterna | | Cavaleiro Lanterna | Laternenritter | Chevalier lanterne | ランタン騎士 | 랜턴 기사 |
| oathbreaker | Oathbreaker | m | 背誓者 | Клятвопреступник | Rompejuramentos | | Quebrador de Juramentos | Eidbrecher | Parjure | 誓約破り | 맹세 파기자 |
| archmage | Archmage | m | 大法师 | Архимаг | Archimago | | Arquimago | Erzmagier | Archimage | 大魔導士 | 대마법사 |
| wraith | The Count | m | 伯爵 | Граф | El Conde | | O Conde | Der Graf | Le Comte | 伯爵 | 백작 |
| elfqueen | Elf Queen | f | 精灵女王 | Королева эльфов | Reina elfa | | Rainha Elfa | Elfenkönigin | Reine elfe | エルフの女王 | 엘프 여왕 |
| necro | Necromancer | m | 死灵法师 | Некромант | Nigromante | | Necromante | Nekromant | Nécromancien | 死霊術師 | 강령술사 |
| king | Exiled King | m | 流亡之王 | Король в изгнании | Rey exiliado | | Rei Exilado | Verbannter König | Roi en exil | 追放された王 | 추방된 왕 |
| elflord | Elf Lord | m | 精灵领主 | Эльфийский лорд | Señor elfo | | Lorde Elfo | Elfenfürst | Seigneur elfe | エルフの君主 | 엘프 군주 |
| magus | Old Magus | m | 老术士 | Старый волхв | Viejo mago | | Velho Mago | Alter Magus | Vieux mage | 老魔術師 | 늙은 마도사 |
| angel | Fallen Angel | n ("it") | 堕天使 | Падший ангел | Ángel caído | | Anjo Caído | Gefallener Engel | Ange déchu | 堕天使 | 타락 천사 |
| ogre | Tamed Oni | m | 驯服恶鬼 | Ручной они | Oni domado | | Oni Domado | Gezähmter Oni | Oni apprivoisé | 手なずけた鬼 | 길들인 오니 |
| demon | Bound Demon | m | 契约恶魔 | Демон-контрактник | Demonio pactado | | Demônio do Pacto | Gebannter Dämon | Démon sous contrat | 契約の悪魔 | 계약의 악마 |

- **G Man** is a Gingerbread Man pun with no equivalent. Each language uses its own *Shrek* name for the character where one is known (ru *Пряня*, fr *Ti-Biscuit*, pt-BR *Biscoito*) or a friendly title (es *Don Jengibre*, de *Herr Lebkuchen*).
- **The Count** is Dracula (sprite `rm_dracula`, "We all know who he really is"): the word must be the plain "count" so the joke survives.
- **Bound Demon** is under contract ("The contract is written in blood"), and its name stays away from the word for *the Bound*: zh 契约, ru *контрактник* (a contract soldier), es *pactado*, de *gebannt*, fr *sous contrat*.
- **Tamed Oni** answers to "Pebble" (§4.13). ru *Ручной* ("pet, hand-tame") makes the joke land.
- **Runesmith**: "Maybe should be in OSRS" refers to Old School RuneScape. Keep "OSRS" as is.
- ru: profession nouns with no natural feminine stay masculine (*Рунный кузнец*, *Ядовитый клинок* as an epithet). The news lines about her still use «она».
- Lantern Knight has a pumpkin head: zh 南瓜灯 is the jack-o'-lantern word.

### 4.13 Personal names and characters

| English | Who | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| Dan | trader in the Keep (5 cards → 1 random card) | 丹 | Дэн | Dan | | Dan | Dan | Dan | ダン | 댄 |
| Victor | trader in the Keep (10 cards → 1 gold card) | 维克多 | Виктор | Victor | | Victor | Victor | Victor | ヴィクター | 빅터 |
| Koko | the Keep's cat (female: "Her Favorite") | 可可 | Коко | Koko | | Koko | Koko | Koko | ココ | 코코 |
| "Pebble" | the Tamed Oni's nickname (a huge oni called something tiny) | 小石子 | «Камешек» | «Guijarro» | «Piedrita» | “Pedrinha” | „Kieselchen“ | « Caillou » | 「コイシ」 | ‘조약돌’ |
| Deepheart | the game | Deepheart | Deepheart | Deepheart | | Deepheart | Deepheart | Deepheart | Deepheart | Deepheart |

- **"Pebble"** is a nickname that is funny for its meaning, so it is translated, not transliterated. The quotes shown are each language's own.
- **Voices.** Dan is friendly and eager ("Got any doubles?", "A double. Sorry!"); Victor is curt and mercenary ("Ten. Not nine.", "No refunds."). Keep the contrast:
  - ru: Dan says «ты»; Victor says «вы», coldly.
  - de: both say *du* (a trader saying *Sie* sounds off in a fantasy game); Victor's lines stay clipped.
  - fr: Dan says *tu*; Victor says *vous*.
  - es / pt-BR: both use *tú* / *você*; Victor drops niceties.
  - ja: Dan friendly タメ口 (〜だよ, 〜じゃん); Victor terse (〜だ, 返品不可).
  - ko: Dan friendly 반말 (〜야, 〜지?); Victor curt 반말 (〜다, 환불 없음).
  - zh-CN: Dan chatty (～吗？～哦); Victor clipped (十张。不是九张。).

### 4.14 Keep, menu and settings labels

| English | zh-CN | ru | es | es-419 | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|
| The Dungeon (Keep station) | 地牢 | Подземелье | La Mazmorra | | A Masmorra | Das Verlies | Le Donjon | ダンジョン | 던전 |
| The Heart (Keep station, dock) | 心脏 | Сердце | El Corazón | | O Coração | Das Herz | Le Cœur | 心臓 | 심장 |
| Expeditions (Keep station, screen) | 远征 | Вылазки | Expediciones | | Expedições | Expeditionen | Expéditions | 遠征 | 원정 |
| Go down | 深入 | Спуститься | Bajar | | Descer | Hinabsteigen | Descendre | 降りる | 내려가기 |
| Send | 派遣 | Отправить | Enviar | | Enviar | Schicken | Envoyer | 派遣 | 파견 |
| Pet (Koko) | 摸摸 | Погладить | Acariciar | | Fazer carinho | Streicheln | Caresser | なでる | 쓰다듬기 |
| Open / View | 打开 / 查看 | Открыть / Смотреть | Abrir / Ver | | Abrir / Ver | Öffnen / Ansehen | Ouvrir / Voir | 開く / 見る | 열기 / 보기 |
| Continue | 继续游戏 | Продолжить | Continuar | | Continuar | Fortsetzen | Continuer | つづきから | 이어하기 |
| New Game | 新游戏 | Новая игра | Nueva partida | | Novo jogo | Neues Spiel | Nouvelle partie | はじめから | 새 게임 |
| Play the Demo | 开始试玩 | Играть в демо | Jugar a la demo | Jugar la demo | Jogar a demo | Demo spielen | Jouer à la démo | 体験版をプレイ | 체험판 플레이 |
| DEMO (logo badge) | 试玩版 | ДЕМО | DEMO | | DEMO | DEMO | DÉMO | 体験版 | 체험판 |
| AN IDLE DUNGEON CRAWLER (tagline) | 放置类地牢探险 | ИДЛ-КРАУЛЕР ПО ПОДЗЕМЕЛЬЯМ | UN DUNGEON CRAWLER IDLE | | UM DUNGEON CRAWLER IDLE | EIN IDLE-DUNGEON-CRAWLER | UN DUNGEON CRAWLER IDLE | 放置系ダンジョンRPG | 방치형 던전 크롤러 |
| Wishlist on Steam (Steam's own wording) | 添加至 Steam 愿望单 | Добавить в желаемое в Steam | Añadir a la lista de deseados de Steam | Agregar a la lista de deseados de Steam | Adicionar à lista de desejos da Steam | Auf die Steam-Wunschliste | Ajouter à la liste de souhaits Steam | Steamのウィッシュリストに追加 | Steam 찜 목록에 추가 |
| Options (menu, dock, settings title) | 选项 | Настройки | Opciones | | Opções | Optionen | Options | オプション | 설정 |
| Wiki | 百科 | Вики | Wiki | | Wiki | Wiki | Wiki | Wiki | 위키 |
| Credits | 制作人员 | Авторы | Créditos | | Créditos | Mitwirkende | Crédits | クレジット | 크레딧 |
| Quit | 退出 | Выйти | Salir | | Sair | Beenden | Quitter | 終了 | 종료 |
| Main menu | 主菜单 | Главное меню | Menú principal | | Menu principal | Hauptmenü | Menu principal | メインメニュー | 메인 메뉴 |
| Back | 返回 | Назад | Volver | | Voltar | Zurück | Retour | 戻る | 뒤로 |
| Close | 关闭 | Закрыть | Cerrar | | Fechar | Schließen | Fermer | 閉じる | 닫기 |
| Okay | 好的 | Хорошо | Vale | Aceptar | OK | Okay | OK | OK | 확인 |
| On / Off | 开 / 关 | Вкл. / Выкл. | Sí / No | | Ligado / Desligado | An / Aus | Activé / Désactivé | オン / オフ | 켬 / 끔 |
| Settings tabs: Sound · Display · Cursor · Game · Save | 声音 · 显示 · 指针 · 游戏 · 存档 | Звук · Экран · Курсор · Игра · Сохранение | Sonido · Pantalla · Cursor · Juego · Guardado | | Som · Tela · Cursor · Jogo · Salvamento | Ton · Anzeige · Cursor · Spiel · Spielstand | Son · Affichage · Curseur · Jeu · Sauvegarde | サウンド · 表示 · カーソル · ゲーム · セーブ | 사운드 · 화면 · 커서 · 게임 · 저장 |
| Language / Automatic | 语言 / 自动 | Язык / Автоматически | Idioma / Automático | | Idioma / Automático | Sprache / Automatisch | Langue / Automatique | 言語 / 自動 | 언어 / 자동 |
| Sound / Music | 声音 / 音乐 | Звук / Музыка | Sonido / Música | | Som / Música | Ton / Musik | Son / Musique | サウンド / BGM | 사운드 / 음악 |
| Effects volume / Music volume | 音效音量 / 音乐音量 | Громкость эффектов / Громкость музыки | Volumen de efectos / Volumen de música | | Volume dos efeitos / Volume da música | Effektlautstärke / Musiklautstärke | Volume des effets / Volume de la musique | 効果音の音量 / BGMの音量 | 효과음 음량 / 음악 음량 |
| Particles | 粒子效果 | Частицы | Partículas | | Partículas | Partikel | Particules | パーティクル | 파티클 |
| Reduce flashing | 减少闪烁 | Меньше вспышек | Reducir destellos | | Reduzir clarões | Blitzen reduzieren | Réduire les flashs | 点滅を抑える | 깜빡임 줄이기 |
| Screen shake | 屏幕震动 | Тряска экрана | Vibración de pantalla | | Tremor de tela | Bildschirmwackeln | Tremblement de l'écran | 画面の揺れ | 화면 흔들림 |
| Damage numbers | 伤害数字 | Числа урона | Números de daño | | Números de dano | Schadenszahlen | Chiffres de dégâts | ダメージ表示 | 피해 숫자 |
| Blood | 血液 | Кровь | Sangre | | Sangue | Blut | Sang | 流血表現 | 피 효과 |
| Zone intros | 区域开场 | Заставки зон | Presentación de zonas | | Abertura das Zonas | Zonen-Intros | Intros de zone | エリア紹介 | 구역 인트로 |
| Numbers (notation setting) | 数字显示 | Числа | Números | | Números | Zahlen | Nombres | 数値表記 | 숫자 표기 |
| save code / Copy save code / Load save code | 存档代码 / 复制存档代码 / 读取存档代码 | код сохранения / Скопировать код / Загрузить код | código de guardado / Copiar código / Cargar código | | código do save / Copiar código / Carregar código | Spielstand-Code / Code kopieren / Code laden | code de sauvegarde / Copier le code / Charger un code | セーブコード / コピー / 読み込む | 저장 코드 / 복사 / 불러오기 |
| Wipe save | 删除存档 | Стереть сохранение | Borrar partida | | Apagar save | Spielstand löschen | Effacer la sauvegarde | セーブ削除 | 저장 삭제 |

- Wishlist wording is Steam's own in each language; check it against the Steam store in that language before release.
- ja *つづきから / はじめから* are the classic Japanese title-screen labels.

---

## 5. For reviewers

These translations are **machine drafts**. Nobody fluent has checked them yet. Please review in this order:

1. **Names.** Read §4 for your language first: companions, Spirits, zones, the Bound, abilities, buffs, currencies. A wrong or awkward name repeats hundreds of times, so it's the cheapest fix with the biggest effect. If you change a name, change it here too, and the translator will carry it through.
2. **Terms used consistently.** The same system must have the same word everywhere: in the HUD, tooltips, the wiki and the trophies (e.g. *ascend* is always 飞升 / вознестись / ascender / aufsteigen / 転生 / 승천, never a synonym).
3. **Tone.** The game is light and deadpan: short jokes, puns in upgrade names, flavor lines that undercut themselves. Check that puns were adapted into real wordplay (not literal), and that nothing reads stiff, formal or machine-like. The register in §2 (du / vous / вы / tú / você, です・ます hints, 해요체 hints) should be consistent.
4. **Plural forms and grammar around placeholders.** Read messages with numbers filled in, especially ru (1, 2, 5, 21, 1,5), and messages with names filled in (no broken articles, cases, contractions or Korean particles).
5. **Overflow and line breaks.** Play the HUD, the shop rows, the boss banner, buttons and tooltips. German and Russian run ~30% longer; CJK lines wrap anywhere. Report text that is clipped or wraps badly, with a screenshot: shorter wording is usually better than a CSS change.
6. **Numbers.** The HUD suffixes (K, M, B… or 万, 亿…), the big gold counter's spelled-out word (§3), decimal marks and the percent sign spacing.
7. **Fonts.** In zh-CN, ja and ko, a missing glyph shows as a box (tofu). Report the character.

When the review is done, set `meta.draft` to `false` in that language's file.
