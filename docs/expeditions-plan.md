# Expeditions: Plan

**Goal:** send a strong companion to a floor you choose to hunt its cards, on a real-world timer. Cards become
something you go after: by hand they're almost never found (1 in 1,000,000 a kill). See also [awakening-plan.md](awakening-plan.md).

Numbers come from the casual bot on `dev` (`c17e219`, 1 hour of play a day) unless marked as targets.

---

## Why

| Played | Deepest | Kills | Cards (of 550) |
|---|---|---|---|
| 10h | 180 | 2.2M | 9 |
| 21h | 296 | 2.8M | 15 |
| 40h | 401 | 3.3M | 22 |
| 60h | 455 | 3.6M | 24 |

- 550 = 276 plain colors + 274 gold. A monster drops its card 1 in 100,000; champions drop gold 1 in 10,000.
- At 60 hours the collection is 4% done, and trading with Dan (5 cards) or Victor (10) barely happens.
- You can't aim: the card you're missing lives on one floor in one color, and you only pass through it.

## When it opens

- **The first time any companion reaches level 1000.** The bot's first is at about 21h (floor ~296).
- By 30h six companions are past 1000; by 60h, fifteen. Plenty to choose from once it's open.

---

## Design

### 1. Who can go
- **A companion at level 1000 or more in this run.** Levels reset on ascent, so this is a late-run thing: you send
  people when you're deep and the run is slowing down.
- The level when they leave sets how well they hunt (see 4).

### 2. What it costs you
- **They leave the party until they're back.** No damage from them, and no ability if they bring one: send the Dwarf
  Brawler and Rampage goes with them. (Abilities by companion: Squire: Phantom Blade, Flurry; Ranger: Critical Hits;
  Brawler: Rampage; Shieldmaiden: Cleave; Corsair: Treasure Sense; Runesmith: War Drums; Stormcaller: Phantom Legion.)
- **Their row in the list** shows they're away and how long is left. They can't be leveled meanwhile.
- **Ascending calls everyone home.** Each trip ends with what it has found so far (finds are counted by the minute),
  and they're back at level 0 like everyone else.
  - So trips belong to a stalled late run: you send people while you wait, and ascending early cuts the trip short.
  - The ascend confirm says who's away and what they've found so far.
  - Auto-ascend (a wake-up gift) waits for trips to end.
- **Awakening while they're away:** same as ascending.

### 3. Where and how long
- **Any floor you've reached.** The finds are that floor's monsters, in that floor's color (Corrupted, Abyssal and so
  on). A boss floor finds its boss.
- **Open-ended:** they hunt until you call them home or ascend, up to 24 hours of real time, offline included. After
  24h they wait at the table with what they found.
- **Picking a floor:** from the card's tooltip (it already says "Most common on floors…") or from a floor picker at the
  expedition table.

### 4. What they bring back

The same math as the dungeon, at full speed:
```
kills per second = min(their DPS ÷ monster health on that floor, 33)   // 33: the sweep limit, 20 kills every 0.6s
kills            = kills per second × seconds away (up to 24h)
cards            = each kill rolls the drop chance (1 in 1,000,000 for a monster), with the Collector and the Ronin
```
- **Their DPS is fixed when they leave.**
- **Gold:** 1% of kills on a plain floor are champions and roll gold at champion odds, as in the dungeon. Boss floors:
  one boss at a time, at DPS ÷ boss health; champion bosses (the Soulcaller's chance) roll gold at champion-boss odds.
- **What it gives** (a level-1000 companion, deepest floor ~350, 24h away):

  | Floor | Kills/s | Plain odds | Ronin 5 | Ronin 5 + Collector 7 |
  |---|---|---|---|---|
  | Up to ~286 | 33 (the cap) | ~2.9 a day | ~17 | ~35 |
  | 306 | 3 | ~0.3 | ~1.6 | ~3 |
  | 336 | 0.05 | ~0 | ~0 | ~0 |

- Up to about 100 floors above your deepest, everyone hunts at full speed. Near your deepest it's a crawl. Old floors
  fast or the newest colors slowly.
- **The Ronin applies in full:** old floors are overkilled so hard it's always at its max, ×(1 + its level). With the
  Collector it's the engine: plain odds alone bring about 3 cards a day per companion.
- Five companions out all day with Ronin 5 + Collector 7: ~170 cards a day. Every plain color reachable at full speed
  (139 of 274 at deepest 350) in under a week; the rest come from going deeper.
- Charts and math: [Deepheart card odds](https://claude.ai/artifact/957RJQpoN3vwQBYJzDYaTv) (made at 1 in 100,000 and a 25%
  rate: multiply its trip numbers by 0.4).

### 5. How many at once
- **Anyone at level 1000+ can go.** The only limit is how much of the party you're willing to lose.
- That makes it a real trade while you're stalled: everyone you send is damage and gold you're not earning, and offline
  progress you're not making overnight. Send everyone and the run stands still while the collection grows.

### 6. In the Keep
- **The expedition table**, a new station in the hall: pick a companion and a floor.
- Companions who are away aren't in the Keep. When they're back, they're standing by the table with what they found;
  walk up to collect, and the cards fly into the collection.
- Collecting outside the Keep: a toast when a trip ends, with a button to collect.

### 7. What it doesn't do
- No failure, no danger, no events mid-trip. It's a timer and a reward.
- It doesn't push floors or earn gold or souls.

---

## Phases

### Phase 1: rules
- `SaveState.expeditions`: `{ comp, floor, dps, start }[]`, with real timestamps; kills come from elapsed time,
  capped at 24h.
- `inParty` treats away companions as absent; abilities check `inParty`; hire and level buttons are locked.
- `sendExpedition`, `collectExpedition`; cards rolled on collect from the kill count (binomial, not one roll per kill).
- Ascent and awakening end trips early and pay what's found so far.

### Phase 2: UI
- The table in the Keep, the floor picker, the away state in the companion list, the return toast, the collect moment.
- Card tooltip: "Hunt here" for a card you're missing, pre-filling the table.

### Phase 3: bot and timeline
- Bot: once stalled, send companions without an ability before going offline; call them home before ascending.
- Timeline: cards collected by 60h, 150h, 300h; check the collection pace against the targets.

---

## Decided (2026-10-25)
- Level 1000 **in this run**; they leave the party; **abilities go with them**.
- **Ascending calls them home** with what they've found so far.
- **Real-time** timer, offline included.
- **Open-ended** trips, up to 24h.
- **No slot limit:** anyone at level 1000+ can go.

- **Finds come from the companion's DPS on that floor**, with the dungeon's own sweep limit, at full speed (no rate cut).
- **The Ronin applies in full** on trips.
- **Every drop chance 10× rarer**, dungeon and trips alike: monster 1 in 1,000,000, boss 1 in 250,000, champion 1 in
  100,000, champion boss 1 in 10,000, goblin 1 in 10,000, rainbow goblin 1 in 1,000. Cards become an expedition and
  Spirit reward; by hand you find about 3 before 21h.
  - Ships with expeditions, not before: alone it would all but end card drops on the live game.
  - Check before shipping: card trophies and the demo's first-card guarantee (`DEMO_FIRST_CARD`) still make sense.

## Open questions
- None right now.

---

## Built (2026-10-25, uncommitted on `dev`)
- Rules (real-time clock the simulator can drive), card odds ×10 rarer, the ladder in the Keep's entrance, the
  Expeditions panel (suggested floor: the deepest one the hunter sweeps at full speed; kills/s and cards a day shown),
  away companions in the party list, the "Back from an expedition" screen, wiki page "Expeditions".
- Decided while building: a hunter out 24h comes home on its own with its cards (instead of waiting at the ladder).
- Bot: before going away, sends everyone at level 1000 without an ability to its full-speed floor.
- Cards collected by the casual bot: 106–133 by 60h (24 before expeditions and the rarer odds).
- Not built: a "Hunt here" button on a card's tooltip.
