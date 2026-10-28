# Steam achievements

75 of the game's 106 trophies, for the Steamworks partner site (App Admin → Stats & Achievements). Valve's guidance
is to keep a list well under 100, so this keeps every kind of trophy, cuts tiers that sit close together, and keeps the
long tail.

- **API name** is the trophy id in capitals; `desktop/steam.cjs` unlocks it when the trophy is earned.
- **Hidden** ones (awakening and the Bound) show as hidden until unlocked, so the Heart isn't spoiled.
- **Simulated** is when the casual simulated player (three 20-minute sessions a day) first earns it, in played time;
  "past 300h" means it didn't within 300 hours.
- Each achievement needs two 256×256 icons on Steam, a color one (unlocked) and a grey one (locked). They can come from
  the trophy icons.

| API name | Name | Description | Hidden | Simulated |
|---|---|---|---|---|
| `FLOOR_10` | Down the Stairs | Clear floor 10. |  | 6m |
| `FLOOR_50` | The Long Descent | Clear floor 50. |  | 48m |
| `FLOOR_100` | The Underneath | Clear floor 100. |  | 2h |
| `FLOOR_400` | The Bottom? | Clear floor 400. |  | 51h |
| `FLOOR_500` | There Is No Bottom | Clear floor 500. |  | 57h |
| `FLOOR_1000` | A Thousand Down | Clear floor 1,000. |  | 92h |
| `FLOOR_3000` | Root of the World | Clear floor 3,000. |  | past 300h |
| `FLOOR_5000` | Where the Heart Beats | Clear floor 5,000. |  | past 300h |
| `LAP0` | Corruption | Reach floor 81, where the zones return corrupted. |  | 1h |
| `LAP1` | The Abyss Stares Back | Reach floor 161, where the zones return abyssal. |  | 12h |
| `LAP2` | Hollowed Out | Reach floor 241, where the zones return hollow. |  | 25h |
| `LAP3` | Eternity | Reach floor 321, where the zones return eternal. |  | 50h |
| `GOLD_E24` | Strongbox | Collect 1 septillion gold in total. |  | 2h |
| `GOLD_E60` | Dragon Hoard | Collect 1 novemdecillion gold in total. |  | 67h |
| `GOLD_E160` | Beyond Counting | Collect 1e160 gold in total. |  | past 300h |
| `DPS_E24` | Warlord | Reach 1 septillion damage per second. |  | 16h |
| `DPS_E60` | Apocalypse | Reach 1 novemdecillion damage per second. |  | 69h |
| `DPS_E100` | Googol | Reach a googol damage per second. |  | past 300h |
| `DPS_E200` | Big Bang | Reach 1e200 damage per second. |  | past 300h |
| `KILL_E6` | Extinction Event | Kill 1,000,000 monsters. |  | 9h |
| `KILL_E7` | The Reaper | Kill 10,000,000 monsters. |  | 64h |
| `KILL_E8` | Nothing Left Alive | Kill 100,000,000 monsters. |  | past 300h |
| `BOSS_100` | Tyrant Killer | Defeat 100 bosses. |  | 12h |
| `BOSS_1000` | Boss Rush | Defeat 1,000 bosses. |  | 51h |
| `BOSS_25000` | Throne of Bones | Defeat 25,000 bosses. |  | past 300h |
| `CHAMP_1` | Champion Slayer | Slay a champion. |  | 24m |
| `CHAMP_1000` | Champion of Champions | Slay 1,000 champions. |  | 43h |
| `CHAMP_10000` | Undisputed | Slay 10,000 champions. |  | past 300h |
| `CLUTCH_1` | By a Hair | Beat a boss with 3 seconds or less on the clock. |  | 6m |
| `CLUTCH_20` | Nerves of Steel | Beat 20 bosses with 3 seconds or less on the clock. |  | 42h |
| `CLUTCH_100` | Was That Necessary? | Beat 100 bosses with 3 seconds or less on the clock. |  | past 300h |
| `HIRE_ALL` | Full Party | Hire all 32 companions. |  | past 300h |
| `LEVEL_1000` | Legendary | Get a companion to level 1,000. |  | 23h |
| `LEVEL_5000` | Immortal | Get a companion to level 5,000. |  | past 300h |
| `LEVEL_10000` | Overleveled | Get a companion to level 10,000. |  | past 300h |
| `LEVELALL_1000` | Legendary Company | Get every companion to level 1,000. |  | 68h |
| `LEVELALL_2500` | Mythic Company | Get every companion to level 2,500. |  | past 300h |
| `CLICKS_10000` | Clicker | Click 10,000 times. |  | 4h |
| `CLICKS_E6` | Carpal Tunnel | Click 1,000,000 times. |  | past 300h |
| `CRIT_100000` | Surgeon | Land 100,000 critical hits. |  | 26h |
| `CRIT_E6` | Critical Condition | Land 1,000,000 critical hits. |  | 225h |
| `FEV_1` | Rampage! | Go on a Rampage once. |  | 42m |
| `FEV_1000` | Anger Issues | Go on a Rampage 1,000 times. |  | 200h |
| `RAMPAGE0` | Bloodrush | Keep attacking until a Rampage reaches its top tier. |  | 42m |
| `RAID_1` | Finders Keepers | Catch a treasure goblin. |  | 0m |
| `RAID_777` | Jackpot | Catch 777 treasure goblins. |  | 57h |
| `RAID_7777` | Treasure Lord | Catch 7,777 treasure goblins. |  | 288h |
| `MISS_1` | Butterfingers | Let a treasure goblin get away. |  | 1h |
| `MISS_5000` | Goblin Philanthropist | Let 5,000 treasure goblins get away. You are funding their retirement. |  | past 300h |
| `MISS_50000` | The Goblins Thank You | Let 50,000 treasure goblins get away. There is a statue of you in Goblin Town. |  | past 300h |
| `RAINBOW_1` | Double Rainbow | Catch a rainbow goblin. |  | 42m |
| `RAINBOW_500` | End of the Rainbow | Catch 500 rainbow goblins. |  | 157h |
| `VAULT_1` | Over the Rainbow | Open the Rainbow Vault. |  | 42m |
| `VAULT_250` | Goblin Banker | Open the Rainbow Vault 250 times. |  | 282h |
| `DESC_1` | Up for Air | Ascend once. |  | 2h |
| `DESC_50` | Commuter | Ascend 50 times. |  | 66h |
| `DESC_250` | Always Back Down | Ascend 250 times. |  | past 300h |
| `AWK_1` | It Wakes | Awaken the Heart once. | yes | 41h |
| `AWK_5` | Heartbeat | Awaken the Heart 5 times. | yes | 77h |
| `AWK_25` | Snooze Button | Awaken the Heart 25 times. | yes | past 300h |
| `AWK_100` | Pacemaker | Awaken the Heart 100 times. | yes | past 300h |
| `BOUND_ALL` | All Eight | Wake every one of the Bound. | yes | past 300h |
| `BOUND_50` | Soul Debt | Earn 50 bound souls in total. | yes | past 300h |
| `BOUND_250` | Paid in Full | Earn 250 bound souls in total. | yes | past 300h |
| `TRIP_1` | Gone Hunting | Send a companion on an expedition. |  | 35h |
| `TRIPCARD_25` | Spoils | Find 25 cards on expeditions. |  | 55h |
| `TRIPCARD_250` | Postcards | Find 250 cards on expeditions. |  | 57h |
| `CARD_1` | Card Carrier | Find a monster card. |  | 9h |
| `CARD_25` | Card Sharp | Find 25 different monster cards. |  | 57h |
| `CARD_ALL` | Bestiary | Find every monster card. |  | past 300h |
| `VERSIONS_250` | Monster Manual | Collect 250 cards. |  | past 300h |
| `VERSIONS_ALL` | Every Last Monster | Collect every card. |  | past 300h |
| `GCARD_1` | Gilded | Find a gold card. |  | 36h |
| `GCARD_25` | Gold Standard | Find 25 different gold cards. |  | 67h |
| `GCARD_ALL` | Midas Deck | Find every gold card. |  | past 300h |

## Not on Steam (31)

Still trophies in the game, with their damage bonus; just not Steam achievements:
Geology Gives Up (Clear floor 750), No Signal (Clear floor 1,500), Two Thousand Fathoms (Clear floor 2,000), Coin Purse (Collect 1 billion gold in total), Treasury (Collect 10 duodecillion gold in total), Kingdom's Ransom (Collect 1e90 gold in total), Sea of Gold (Collect 1e120 gold in total), Fighter (Reach 1 million damage per second), Cataclysm (Reach 10 duodecillion damage per second), World Breaker (Reach 1e80 damage per second), Heat Death (Reach 1e150 damage per second), Slayer (Kill 1,000 monsters), Massacre (Kill 100,000 monsters), Kingsbane (Defeat 10 bosses), Serial Regicide (Defeat 5,000 bosses), Crown Collector (Slay 100 champions), Mythic (Get a companion to level 2,500), Loyal Company (Get every companion to level 500), Tap Tap (Click 100 times), Still Clicking (Click 100,000 times), Critical! (Land 1 critical hit), Sharp Eye (Land 10,000 critical hits), Berserker (Go on a Rampage 100 times), Red-Handed (Catch 77 treasure goblins), No One Escapes (Catch 2,777 treasure goblins), Slippery Little Guys (Let 100 treasure goblins get away), Goblin Enabler (Let 1,000 treasure goblins get away. They are telling their friends), Official Goblin Sponsor (Let 20,000 treasure goblins get away. They have named a tunnel after you), Chasing Rainbows (Catch 50 rainbow goblins), Vault Raider (Open the Rainbow Vault 25 times), Return Ticket (Ascend 10 times).
