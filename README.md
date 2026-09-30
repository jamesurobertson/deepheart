# Deepheart

A browser clicker set in a pixel-art dungeon rendered in three.js. Monsters pour up the stairs; you click them to pieces, and the gold you loot hires companions who fight for you. Clear floors, beat the boss on every fifth floor, then descend for souls and go deeper.

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build
node scripts/balance.ts 8 5 30 0.3 # headless pacing sim: hours, clicks/sec, active minutes, descend ratio
                                   # (env: TUNE='{"deepHp":1.17}' overrides pacing knobs, FAILS=1 / RELICS=1 log more)
```

Handy URL flags: `?slot=name` keeps a separate save, `?speed=10` runs the game faster.

## How it plays

- **Click monsters.** Every click hits whichever monster is nearest the pointer. Crits, cleave upgrades and "clicks deal a % of party damage" upgrades keep clicking worth it all game.
- **Hire companions** with gold. Sixteen of them, each 5–8× stronger than the last. Levels 10/25/50/75/100… unlock ×2 upgrades. Later companions only join after you've descended.
- **Floors:** kill 25 monsters to clear a floor. Every 5th floor is a timed boss. Lose to a boss and your party falls back to farm, then retries once it's 50% stronger (or press Auto).
- **Rampage:** clicking fast fills the meter. When it's full, clicks do ×5 and your party does ×2 for 10 seconds.
- **Treasure goblins** dash across the room now and then. Catch one for gold, Bloodlust (×7 party damage), Frenzy (×77 clicks) or Gold Rush (×7 gold).
- **Descend** (from floor 30): reset for souls (+2% damage each, more for every floor deeper) and spend them on abyss powers such as Phantom Blade (auto-clicks), Deep Stairs (start on floor 10) and more offline time.
- **Boss modifiers** (from floor 30): zone bosses, and later mid-bosses, come Armored, Enraged, Regenerating, Splitting or Giant
  (two at once from floor 100, three from 200). Each one has a relic that answers it.
- **Relics** drop from bosses: 16 of them, common to legendary. A quarter of zone bosses drop one, and the first time you beat a zone
  boss this deep always does. You keep them forever; finding one again levels it up. Three slots (five with Heart powers).
- **Awaken the Heart** (from floor 120): give up your souls and abyss powers for heartstones, paid for the deepest floor you reached
  since the last awakening. Heart powers: Heart of Fury (×10 damage per level, endless), Soul Siphon, more relic slots and drops,
  weaker boss modifiers, keeping cheap abyss powers, and the Quartermaster (buys companions and upgrades for you).
- **Trophies:** each gives +1% damage. Trophy upgrades multiply that. Many unlock **cursor skins** (21 weapons), picked in Options. Yes, there are trophies for letting treasure goblins escape.
- **Zones:** every 10 floors is a new place with its own tiles, lighting, monsters, a mid-boss on floor 5 and a zone boss on floor 10:
  The Upper Halls, The Bone Crypts, The Overgrown Warrens (Troll Brute), The Sunken Tomb (Tomb Golem), The Rotting Deep (The Rotten King),
  The Enchanted Grove (The Elder Ent), The Demon Gate (Pit Lord) and The Frozen Vault (Frost Troll). Then they come round again, harder.
  Beat a zone boss and your party marches down a stair tower into the next zone (can be turned off in Options).

Keys: Space/Enter clicks the front monster, Esc closes panels. Options can turn off blood, particles, screen shake and damage numbers.

## Code

- `src/game/data.ts`: companions, monsters, upgrades, abyss powers, trophies, flavour text.
- `src/game/game.ts`: all the rules (damage, floors, bosses, gold, buffs, prestige, offline). No DOM.
- `src/render/scene.ts`: the HD-2D chamber: party, monsters, projectiles, treasure goblin, post-processing.
- `src/ui/ui.ts` + `src/style.css`: the HUD, shop, tooltips, numbers, panels.
- `src/main.ts`: boot, save/load, the fixed-step loop, sounds.

The previous prototype (a MapleStory-style idle platformer) is tagged `platformer-v4` in git.

## Sprites

`node scripts/build-atlas.ts` packs everything into `public/assets/sprites/atlas.png` + `atlas.txt`: the DungeonTileset II
sheet plus the add-on packs in `assets-src/` (zone tiles and creatures). Re-run it after adding art.

## Credits (all CC0)

Art: [0x72 DungeonTileset II](https://0x72.itch.io/dungeontileset-ii),
[Enchanted Forest Characters](https://superdark.itch.io/enchanted-forest-characters) by Superdark,
[jungle & desert tiles](https://omniboy.itch.io/custom-dungeon-16x16-tileset) by Omniboy,
[Dark Dungeon](https://kosinaz.itch.io/16x16-dark-dungeon-tileset) by Zoltan Kosina,
[DungeonTileset II Extended](https://nijikokun.itch.io/dungeontileset-ii-extended) by Niji.
Sound: [Kenney](https://kenney.nl) sound packs, and
music (one track per zone): Juhani Junkala's [Chiptune Adventures](https://opengameart.org/content/4-chiptunes-adventure) and
[5 Chiptunes (Action)](https://opengameart.org/node/55580), [Spooky Dungeon](https://opengameart.org/content/spooky-dungeon) by Memoraphile,
[Desert Theme](https://opengameart.org/node/124080) by Wolfgang_, [Void Estate](https://opengameart.org/content/haunting-chiptune-loop-void-estate) by Zane Little,
[Dark Forest Waltz](https://opengameart.org/content/10-track-modern-chiptune-demo) by The Art Bros and [Fields of Ice](https://opengameart.org/content/fields-of-ice) by Jonathan So.
