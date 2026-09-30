# Deepheart

A browser clicker set in a pixel-art dungeon rendered in three.js. Monsters pour up the stairs; you click them to pieces, and the gold you loot hires companions who fight for you. Clear floors, beat the boss on every fifth floor, then descend for souls and go deeper.

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build
node scripts/balance.ts 3 5 30 1   # headless pacing sim: hours, clicks/sec, active minutes, descend ratio
```

Handy URL flags: `?slot=name` keeps a separate save, `?speed=10` runs the game faster.

## How it plays

- **Click monsters.** Every click hits whichever monster is nearest the pointer. Crits, cleave upgrades and "clicks deal a % of party damage" upgrades keep clicking worth it all game.
- **Hire companions** with gold. Sixteen of them, each 5–8× stronger than the last. Levels 10/25/50/75/100… unlock ×2 upgrades. Later companions only join after you've descended.
- **Floors:** kill 25 monsters to clear a floor. Every 5th floor is a timed boss. Lose to a boss and your party falls back to farm, then retries once it's 50% stronger (or press Auto).
- **Rampage:** clicking fast fills the meter. When it's full, clicks do ×5 and your party does ×2 for 10 seconds.
- **Treasure goblins** dash across the room now and then. Catch one for gold, Bloodlust (×7 party damage), Frenzy (×77 clicks) or Gold Rush (×7 gold).
- **Descend** (from floor 30): reset for souls (+2% damage each, more for every floor deeper) and spend them on abyss powers such as Phantom Blade (auto-clicks), Deep Stairs (start on floor 10) and more offline time.
- **Trophies:** each gives +1% damage. Trophy upgrades multiply that. Many unlock **cursor skins** (21 weapons), picked in Options. Yes, there are trophies for letting treasure goblins escape.
- Every 10 floors the dungeon changes colour and monster roster.

Keys: Space/Enter clicks the front monster, Esc closes panels. Options can turn off blood, particles, screen shake and damage numbers.

## Code

- `src/game/data.ts`: companions, monsters, upgrades, abyss powers, trophies, flavour text.
- `src/game/game.ts`: all the rules (damage, floors, bosses, gold, buffs, prestige, offline). No DOM.
- `src/render/scene.ts`: the HD-2D chamber: party, monsters, projectiles, treasure goblin, post-processing.
- `src/ui/ui.ts` + `src/style.css`: the HUD, shop, tooltips, numbers, panels.
- `src/main.ts`: boot, save/load, the fixed-step loop, sounds.

The previous prototype (a MapleStory-style idle platformer) is tagged `platformer-v4` in git.

## Credits (all CC0)

[0x72 DungeonTileset II](https://0x72.itch.io/dungeontileset-ii), [Kenney](https://kenney.nl) sound packs, and
[Chiptune Adventures](https://opengameart.org/content/4-chiptunes-adventure) music by Juhani Junkala.
