# Descent: an idle side-scrolling ARPG

An idle platformer inspired by MapleStory Idle and Diablo. Pick a class and auto-hunt dense, respawning hordes across platform maps. Push stages with timed Challenges, run dailies, and rebirth for permanent talents. You can take manual control at any time.

## Run

```sh
npm install
npm run dev                          # http://localhost:5173
# ?speed=10   fast-forward    ?slot=test   separate save slot
npm run typecheck
node scripts/balance.ts 2 600 knight # headless pacing sim (hours, report interval s, class)
./scripts/build-assets.sh            # rebuild public/assets from assets-src (needs ffmpeg)
```

## Controls

| | |
|---|---|
| Move / jump / drop | A D or ←→, W or ↑ or Space, S or ↓ |
| Skills | 1–5 |
| Auto play on/off | Z (any movement key takes over for a few seconds) |
| Bag · Forge · Dailies · Hero | B · G · J · T |
| In the bag | E equip · X salvage · arrows move |
| Mute · music · close panels | M · N · Esc |

## Game loop

- **Hunt:** farm your best stage. About 40 monsters respawn every 12s. Farming is meant to be fast mass killing.
- **Challenge:** clear 50 monsters in 45s, then beat the guardian in 30s to unlock the next stage. Failing just sends you back to farming. "Auto" retries on its own.
- **Classes:** Knight, Wizard, Ranger, Dwarf. Each has a different basic attack and 6 skills unlocked at levels 1, 8, 15, 25, 40 and 60.
- **Living gear:** items level while equipped and awaken powers. Every drop gets a verdict: Upgrade, Potential or Worse. There's a loot filter and auto-equip.
- **Dailies:** three dungeons (Gold Vault, Gear Trial, Spirit Well) with 3 keys a day. First clears of new floors are free, and a key sweeps your best floor. There's also a world boss that levels up each time it dies, and a checklist that stamps a 28-day board.
- **Prestige:** from stage 3-1 you can rebirth for soul shards and spend them on a talent tree. You can change class when you rebirth.
- **Threats:** casters (Orc Shamans, Necromancers) lob orbs you can dodge, chargers (Imps, Chorts, Wogols) lunge, and guardians and bosses telegraph slams with red floor zones. Auto-play sidesteps them; in manual play you dodge them yourself.
- **Settings (☰):** music and effect volumes, screen shake, hit-stop, damage-number mode, live stats (DPS, kills a minute, gold an hour), and save export/import.

## Layout

- `src/game/`: pure logic that runs headless under Node: `sim.ts` (platformer sim, runs, prestige), `stage.ts` (platform maps and routing), `heroes.ts` (classes and skills), `talents.ts`, `dailies.ts`, `items.ts`, `monsters.ts`.
- `src/render/`: HD-2D three.js scene: `stagemesh.ts` (map geometry), `world.ts`, `fx.ts`, `overlay.ts` (damage numbers and bars), `post.ts`.
- `src/ui/`: pixel HUD (`hud.ts`), panels (`panels.ts`), sprite and icon helpers (`px.ts`).
- `src/audio/sfx.ts`: Web Audio player. Sound choices are in `scripts/build-assets.sh` and `playSound()` in `src/main.ts`.

## Credits

All art and audio are CC0 (public domain). Credit is not required but is given gladly:
[16x16 DungeonTileset II](https://0x72.itch.io/dungeontileset-ii) by 0x72,
[16x16 Weapon RPG Icons](https://opengameart.org/content/16x16-weapon-rpg-icons) by Shade,
[RPG Items](https://opengameart.org/node/109591) by ScratchIO, and
[Kenney](https://kenney.nl) Impact Sounds, RPG Audio, Interface Sounds and Music Jingles, and
[Chiptune Adventures](https://opengameart.org/content/4-chiptunes-adventure) music by Juhani Junkala.
Fonts: Pixelify Sans, Silkscreen, Jersey 10 (Google Fonts, OFL).
