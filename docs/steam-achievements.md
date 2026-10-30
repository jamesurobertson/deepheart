# Steam achievements

86 of the game's 117 trophies, for the Steamworks partner site (App Admin → Stats & Achievements). Valve's guidance
is to keep a list well under 100, so this keeps every kind of trophy, cuts tiers that sit close together, and keeps the
long tail.

- **API name** is the trophy id in capitals; `desktop/steam.cjs` unlocks it when the trophy is earned.
- **Hidden** ones (awakening, the Bound and Koko past the first pet) show as hidden until unlocked, so the Heart isn't spoiled.
- **Simulated** is when the casual simulated player (three 20-minute sessions a day) first earns it, in played time;
  "past 300h" means it didn't within 300 hours.
- Each achievement needs two 256×256 icons on Steam, a color one (unlocked) and a grey one (locked). They can come from
  the trophy icons.

| API name | Name | Description | Hidden | Simulated |
|---|---|---|---|---|
| `FLOOR_10` | Down the Stairs | Clear floor 10. |  | 6m |
| `FLOOR_50` | The Long Descent | Clear floor 50. |  | 1h |
| `FLOOR_100` | The Underneath | Clear floor 100. |  | 2h |
| `FLOOR_400` | The Bottom? | Clear floor 400. |  | 20h |
| `FLOOR_500` | There Is No Bottom | Clear floor 500. |  | 26h |
| `FLOOR_1000` | A Thousand Down | Clear floor 1,000. |  | 29h |
| `FLOOR_3000` | Root of the World | Clear floor 3,000. |  | 116h |
| `FLOOR_5000` | Where the Heart Beats | Clear floor 5,000. |  | past 300h |
| `LAP0` | Corruption | Reach floor 81, where the zones return corrupted. |  | 2h |
| `LAP1` | The Abyss Stares Back | Reach floor 161, where the zones return abyssal. |  | 9h |
| `LAP2` | Hollowed Out | Reach floor 241, where the zones return hollow. |  | 16h |
| `LAP3` | Eternity | Reach floor 321, where the zones return eternal. |  | 18h |
| `GOLD_E24` | Strongbox | Collect 1 septillion gold in total. |  | 2h |
| `GOLD_E60` | Dragon Hoard | Collect 1 novemdecillion gold in total. |  | 26h |
| `GOLD_E160` | Beyond Counting | Collect 1e160 gold in total. |  | 62h |
| `DPS_E24` | Warlord | Reach 1 septillion damage per second. |  | 13h |
| `DPS_E60` | Apocalypse | Reach 1 novemdecillion damage per second. |  | 28h |
| `DPS_E100` | Googol | Reach a googol damage per second. |  | 36h |
| `DPS_E200` | Big Bang | Reach 1e200 damage per second. |  | 118h |
| `KILL_E6` | Extinction Event | Kill 1,000,000 monsters. |  | 9h |
| `KILL_E7` | The Reaper | Kill 10,000,000 monsters. |  | 66h |
| `KILL_E8` | Nothing Left Alive | Kill 100,000,000 monsters. |  | past 300h |
| `BOSS_100` | Tyrant Killer | Defeat 100 bosses. |  | 10h |
| `BOSS_1000` | Boss Rush | Defeat 1,000 bosses. |  | 27h |
| `BOSS_25000` | Throne of Bones | Defeat 25,000 bosses. |  | 117h |
| `CHAMP_1` | Champion Slayer | Slay a champion. |  | 48m |
| `CHAMP_1000` | Champion of Champions | Slay 1,000 champions. |  | 24h |
| `CHAMP_10000` | Undisputed | Slay 10,000 champions. |  | 57h |
| `CLUTCH_1` | By a Hair | Beat a boss with 3 seconds or less on the clock. |  | 12m |
| `CLUTCH_20` | Nerves of Steel | Beat 20 bosses with 3 seconds or less on the clock. |  | 26h |
| `CLUTCH_100` | Was That Necessary? | Beat 100 bosses with 3 seconds or less on the clock. |  | past 300h |
| `HIRE_ALL` | Full Party | Hire all 32 companions. |  | 187h |
| `LEVEL_1000` | Legendary | Get a companion to level 1,000. |  | 16h |
| `LEVEL_5000` | Immortal | Get a companion to level 5,000. |  | 60h |
| `LEVEL_10000` | Overleveled | Get a companion to level 10,000. |  | past 300h |
| `LEVELALL_1000` | Legendary Company | Get every companion to level 1,000. |  | past 300h |
| `LEVELALL_2500` | Mythic Company | Get every companion to level 2,500. |  | past 300h |
| `CLICKS_10000` | Clicker | Click 10,000 times. |  | 5h |
| `CLICKS_E6` | Carpal Tunnel | Click 1,000,000 times. |  | past 300h |
| `CRIT_100000` | Surgeon | Land 100,000 critical hits. |  | 31h |
| `CRIT_E6` | Critical Condition | Land 1,000,000 critical hits. |  | past 300h |
| `FEV_1` | Rampage! | Go on a Rampage once. |  | 24m |
| `FEV_1000` | Anger Issues | Go on a Rampage 1,000 times. |  | 270h |
| `RAMPAGE0` | Bloodrush | Keep attacking until a Rampage reaches its top tier. |  | 24m |
| `RAID_1` | Finders Keepers | Catch a treasure goblin. |  | 1m |
| `RAID_777` | Jackpot | Catch 777 treasure goblins. |  | 67h |
| `RAID_7777` | Treasure Lord | Catch 7,777 treasure goblins. |  | 277h |
| `MISS_1` | Butterfingers | Let a treasure goblin get away. |  | 36m |
| `MISS_5000` | Goblin Philanthropist | Let 5,000 treasure goblins get away. You are funding their retirement. |  | past 300h |
| `MISS_50000` | The Goblins Thank You | Let 50,000 treasure goblins get away. There is a statue of you in Goblin Town. |  | past 300h |
| `RAINBOW_1` | Double Rainbow | Catch a rainbow goblin. |  | 2h |
| `RAINBOW_500` | End of the Rainbow | Catch 500 rainbow goblins. |  | 178h |
| `VAULT_1` | Over the Rainbow | Open the Rainbow Vault. |  | 5h |
| `VAULT_250` | Goblin Banker | Open the Rainbow Vault 250 times. |  | 278h |
| `DESC_1` | Up for Air | Ascend once. |  | 2h |
| `DESC_50` | Commuter | Ascend 50 times. |  | 56h |
| `DESC_250` | Always Back Down | Ascend 250 times. |  | past 300h |
| `AWK_1` | It Wakes | Awaken the Heart once. | yes | 20h |
| `AWK_5` | Heartbeat | Awaken the Heart 5 times. | yes | 29h |
| `AWK_25` | Snooze Button | Awaken the Heart 25 times. | yes | past 300h |
| `AWK_100` | Pacemaker | Awaken the Heart 100 times. | yes | past 300h |
| `BOUND_ALL` | All Eight | Wake every one of the Bound. | yes | 36h |
| `BOUND_50` | Soul Debt | Earn 50 bound souls in total. | yes | 36h |
| `BOUND_250` | Paid in Full | Earn 250 bound souls in total. | yes | past 300h |
| `TRIP_1` | Gone Hunting | Send a companion on an expedition. |  | 19h |
| `TRIPCARD_25` | Spoils | Find 25 cards on expeditions. |  | 29h |
| `TRIPCARD_250` | Postcards | Find 250 cards on expeditions. |  | 42h |
| `TRIPKILL_10000` | Pest Control | Defeat 10,000 monsters on expeditions. |  | 20h |
| `TRIPKILL_E6` | Hired Muscle | Defeat 1,000,000 monsters on expeditions. |  | 20h |
| `PET_1` | Good Kitty | Pet Koko. |  | past 300h |
| `PET_10` | Cat Person | Pet Koko 10 times. | yes | past 300h |
| `PET_100` | Her Favorite | Pet Koko 100 times. | yes | past 300h |
| `PET_1000` | Koko's Human | Pet Koko 1,000 times. | yes | past 300h |
| `SET_1` | Full Set | Finish a card set. |  | past 300h |
| `SET_5` | Set Collector | Finish 5 card sets. |  | past 300h |
| `SET_10` | Complete Collection | Finish 10 card sets. |  | past 300h |
| `GSET_1` | Gold Set | Finish a gold card set. |  | 153h |
| `GSET_5` | Gilt Edge | Finish 5 gold card sets. |  | past 300h |
| `CARD_1` | Card Carrier | Find a monster card. |  | 16h |
| `CARD_25` | Card Sharp | Find 25 different monster cards. |  | 31h |
| `CARD_ALL` | Bestiary | Find every monster card. |  | past 300h |
| `VERSIONS_250` | Monster Manual | Collect 250 cards. |  | past 300h |
| `VERSIONS_ALL` | Every Last Monster | Collect every card. |  | past 300h |
| `GCARD_1` | Gilded | Find a gold card. |  | 22h |
| `GCARD_25` | Gold Standard | Find 25 different gold cards. |  | 44h |
| `GCARD_ALL` | Midas Deck | Find every gold card. |  | past 300h |

## Not on Steam (31)

Still trophies in the game, with their damage bonus; just not Steam achievements:
Geology Gives Up (Clear floor 750), No Signal (Clear floor 1,500), Two Thousand Fathoms (Clear floor 2,000), Coin Purse (Collect 1 billion gold in total), Treasury (Collect 10 duodecillion gold in total), Kingdom's Ransom (Collect 1e90 gold in total), Sea of Gold (Collect 1e120 gold in total), Fighter (Reach 1 million damage per second), Cataclysm (Reach 10 duodecillion damage per second), World Breaker (Reach 1e80 damage per second), Heat Death (Reach 1e150 damage per second), Slayer (Kill 1,000 monsters), Massacre (Kill 100,000 monsters), Kingsbane (Defeat 10 bosses), Serial Regicide (Defeat 5,000 bosses), Crown Collector (Slay 100 champions), Mythic (Get a companion to level 2,500), Loyal Company (Get every companion to level 500), Tap Tap (Click 100 times), Still Clicking (Click 100,000 times), Critical! (Land 1 critical hit), Sharp Eye (Land 10,000 critical hits), Berserker (Go on a Rampage 100 times), Red-Handed (Catch 77 treasure goblins), No One Escapes (Catch 2,777 treasure goblins), Slippery Little Guys (Let 100 treasure goblins get away), Goblin Enabler (Let 1,000 treasure goblins get away. They are telling their friends), Official Goblin Sponsor (Let 20,000 treasure goblins get away. They have named a tunnel after you), Chasing Rainbows (Catch 50 rainbow goblins), Vault Raider (Open the Rainbow Vault 25 times), Return Ticket (Ascend 10 times).
