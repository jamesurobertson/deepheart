# Writing text for Deepheart

The game's text is translated. Use this guide whenever you add or change anything a player can read. The design is in [i18n-plan.md](i18n-plan.md).

## UI text: `t()`

```ts
import { t } from '../i18n/index.ts';

button.textContent = t('ui.shop.hire');
html = `<h2>${t('ui.ascend.title', { souls: G.soul() + fmt(pending) })}</h2>`;
label = t('ui.trips.out', { count: out });            // plural: picks the form by count
```

English lives in `src/i18n/en/<area>.ts`, one file per part of the game. Every key in a file starts with that file's name: `ui.`, `menu.`, `keep.`, `game.`, `data.`, `system.`, `wiki.`.

```ts
'ui.shop.hire': 'Hire',
'ui.ascend.title': 'Ascend for {souls}?',
'ui.trips.out': { one: '{count} out', other: '{count} out' },
'ui.offline.kills': { one: '{count} monster slain', other: '{count} monsters slain' },
```

Rules:
- **Write every key out whole** in the code: `t('ui.tab.sound')`, never `` t(`ui.tab.${id}`) ``. For a family of keys, use a table of whole keys: `const TAB_LABEL = { sound: 'ui.tab.sound', ... } as const`, then `t(TAB_LABEL[id])`. The unused-key check and the demo build both find keys by their literal text.
- **One message per sentence or label, with named placeholders.** Never glue translated fragments into a sentence (`t('a') + name + t('b')`): word order differs between languages. Put the whole sentence in one message: `'{name} deals ×2 damage.'`.
- **Placeholders take values that are already formatted**: `fmt(n)`, icons, names. A number passed as a value is formatted as a whole number in the player's language. A message that counts something takes `{count}` and plural forms (`one`/`other` in English; the translations add `few`/`many` where their language needs them).
- Markup may stay inside a message when it is part of the sentence (`<b>`, `<em>`, `<small>`, `<br>`). Attributes and icons go in through placeholders. Escape player-provided text as before; messages are trusted.
- UI copy is the label and the value only (`~/.claude/CLAUDE.md`). Don't add explanations to messages.
- Glyphs that are not words (`×`, `▶`, `+`, `%`, `/`, `·`, `—`) can stay in code when they sit between translated parts. Anything readable as a word goes through `t()`.
- Never derive IDs, save keys, CSS classes or comparisons from translated text. Compare IDs.
- Text built once at module load is fine. The language is set before the game's modules load, and changing it reloads the page.
- A string that must stay English (a proper name in the credits, a URL, a key name) gets `// i18n-ignore` on its line, or `// i18n-ignore-start` / `// i18n-ignore-end` around a block.

## Game content: `tc()`

Names, flavor and descriptions in `src/game/data.ts` stay written in English there. Each one goes through `tc(key, english)` when the data is built, so the tables already hold the player's language:

```ts
const c = (id: string, name: string, …) => ({ id, name: tc(`comp.${id}.name`, name), … });
```

- Content keys are built from IDs: `comp.<id>.name`, `monster.<cardId>.name`, `upgrade.<id>.name`… The English is what `npm run i18n:content` writes into `src/i18n/en/content.ts`, the file translations are typed against.
- `tc()` must run while `data.ts` loads, not later inside a function. The generator only sees what loading registers.
- IDs come from the English source, never from a `tc()` result. `cardId()` takes the English name.
- Text that `data.ts` assembles in code (trait descriptions, "The Abyssal Lich") is a template in `src/i18n/en/data.ts` and goes through `t()`.

## Numbers

`fmt`, `fmtLong`, `pct` and `duration` (src/game/format.ts) are in the player's language already. Use `int(n)` (src/i18n) instead of `n.toLocaleString('en-US')`, and `decimal(n, digits)` / `fixed(n, digits)` instead of `toFixed` for anything shown.

## Checks

- `npm run typecheck`: a translation missing a key or having an extra one doesn't compile.
- `npm run i18n:check`: unused or unknown keys, stale `en/content.ts`, placeholders, plurals and tags that differ from English, English left in the UI files (`--strings` lists them), characters a language's font can't draw.
- `?lang=pseudo` (or Options → Game → Language → Pseudo in dev): every translated string is accented, ~35% longer and bracketed. Plain English on screen is a string that was missed. A cut-off bracket is an overflow.
