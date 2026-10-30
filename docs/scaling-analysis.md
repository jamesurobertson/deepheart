# Deepheart Scaling Analysis

The economy as of v0.11.0 (2026-10-30). Every number comes from the game's own sims (`scripts/timeline.ts 300`,
`scripts/ascents.ts 60`) or from the constants in `game.ts` and `data.ts`. Commands are in §5. General theory:
`incremental-game/docs/scaling-blueprint.md`.

This replaces the v0.10.10 notes. Their diagnosis (a stall after the first ascent, a sprint after it, a roster the
checks didn't fit, awakening at 47 h) was traced to two things. The timeline sim hoarded gold instead of spending it
like auto hire, which hid how fast the game really was (about 11 h to the first awakening once fixed). Monster health
past floor 400 also outgrew everything a player can earn, so every cycle stalled near floor 970. v0.11.0 re-spaced the
companions on Clicker Heroes' curve and fixed the stall.

---

## TL;DR

1. **The first run stops on its own.** Sixteen companions come by floor 94; the next one costs weeks of farming from
   where the run levels off (about floor 120 nonstop, 130–160 for an hour a day). Ascending is the way on: one at floor
   130 pays about 22 souls (+220%).
2. **The first awakening is at floor 400, about 20 played hours** (about three weeks at an hour a day). Across seeds
   it lands at 20–21½ h.
3. **Companions arrive on a widening curve:** 16 in the first 2 h, the other 7 regulars and two late ones across the
   ascents to the awakening, then the last seven at about 29, 37, 43, 59, 85, 115 and 170 h.
4. **Depth keeps rising** through 300 h (about floor 3,950), with no stall.
5. **11 of 13 timeline checks pass.** The two that don't predate v0.11.0: the climb back to your old depth after an
   awakening, and stretches with nothing new.

---

## 1. The economy as it stands

| System | Formula / constants | Where |
|---|---|---|
| Floors | 20 kills; a boss every 5 floors, 30 s timer | `FLOOR_KILLS`, `BOSS_EVERY`, `BOSS_TIME` |
| Monster HP | `10·(f−1 + 1.55^(f−1))` to floor 100, then ×**1.145** per floor, steepening by `hpCreep` 0.0005 per 100 floors. A wall ramps in ×1000 over floors 400–500 and stays | `floorHp`, `TUNE` |
| Gold | `1.62^(f−1)` to floor 100, then ×**1.15** per floor | `floorGold`, `TUNE` |
| Companions | 32. The first 16 cost 5 monsters' gold on the floor they should arrive on (one every ~8 floors past the demo's eight, to the Plague Doctor at 94). The next 7 cost 30,000 monsters' gold on floors 160–305. The last 9 wait on a floor: 335, 370, 950, 1400, 1750, 2300, 2750, 3100, 3650, priced 150× to 30,000× that floor's gold | `COMPS` |
| Companion damage | One smooth curve: damage ÷ price^0.82 is about 8% better per face through the first 23, then 12% | `COMPS` comment |
| Level cost | `cost · 1.07^level` | `COST_GROWTH` |
| Level bonus | ×4 every 25 levels from 200 (×10 at every 1000th level), per companion, no end | `LEVEL_BONUS` |
| Traits | 4–7 per companion at levels 10–150; own (×2), party (+50%), click, gold, boss, crit, blade, cleave, Rampage and skills | `TRAIT_PLAN` |
| Souls | 1 per **500** levels bought in a run, plus champion boss souls from floor 100. Each soul is +10% damage (additive). Ascending opens at floor 100 | `levelsPerSoul`, `soulPower`, `bossSouls` |
| Bound souls | 5 per power of ten of a cycle's souls. They pull champion souls up with depth, toward a **15%** cap (Clicker Heroes' Transcendent Power caps at 25%) | `boundFor`, `pull`, `pullCap` |
| Trophies, cards | +1% a trophy, card sets +a share each (additive); together they move the first awakening by about 20 minutes | `trophyMult`, `SET_BONUS` |
| Awakening | Opens at floor **400** | `AWAKEN_FLOOR` |

### Derived numbers

| Quantity | Value | How |
|---|---|---|
| Damage per gold spent on levels (α) | **0.82**: gold ×10 buys damage ×6.6 | `ln(4)/25 ÷ ln(1.07)` |
| Effective HP growth per floor, after gold's help | **1.044** before floor 100; **1.145 / 1.15^0.82 = 1.021** after, before the creep and the wall | `h / g^α` |
| Most a floor's champion souls can grow with depth | ×1.15^(1/5) = **1.028** a floor at the cap; with gold's 1.1215 that's 1.153 against 1.145 plus the creep, which is why depth keeps rising but slower and slower | `pull`, `floorHp` |

### Why the first run stops

Below floor 100 each floor is 4.4% further out of reach; past it, only 2.1%. Without new faces a run would coast to
floor 250 on time away alone (a 4-hour absence farms about 15,000 kills, roughly 750 floors' gold). Clicker Heroes
stops its first run where the heroes run out: Frostleaf is affordable around zone 128, and the next hero costs about
10^13× more. Deepheart does the same after the Plague Doctor. The Cleric's 30,000 monsters' gold at floor 160 is
about 2 million monsters' gold at floor 130, weeks of farming, so only souls get you there.

---

## 2. What the sims show today

### Timeline (casual player, `node scripts/timeline.ts 300`)

Three 20-minute sessions a day, ascending only once stuck. 127 ascents and 10 awakenings in 300 h; all 32 companions
met.

| Check | Target | Result |
|---|---|---|
| First wall | 5m–25m | ✅ 5m 43s |
| Deepest floor at 1 h | 30–60 | ✅ 40 |
| First ascent | 2h–4h30m | ✅ 2h 5m |
| Companions met by the first ascent | 16–19 | ✅ 16 |
| All 23 regular companions met | 14h–22h | ✅ 18h 21m |
| Late companions on schedule | a window each, 16–23 h to 140–200 h | ✅ |
| Longest wait for a new companion | under 12 h to the awakening, 70 h after | ✅ 11h 6m, 67h 2m |
| Every card can drop (floor 321) | 10h–20h | ✅ 18h 21m |
| First awakening | 16h–25h | ✅ 20h 3m |
| Back to the last depth after awakening | under 45m | ❌ 1h 35m to 25h 36m, longer each cycle |
| Never too long without something new | 20m to 10h, 1h to 100h, 3h after | ❌ 38 too long, longest 2h 36m at 13h 23m |
| Deepest floor rises every 20 h | to 300 h | ✅ |
| Third layer opens | 100h–150h | not built yet |

Deepest floor: 1h:40, 2h:95, 5h:110, 10h:165, 20h:395, 30h:1045, 50h:2023, 100h:2895, 150h:3501, 200h:3712,
290h:3955.

Companions met (seed 1): the Plague Doctor at 2h 0m; Cleric 13h, Archmage 18h; Count 18h 40m, Elf Queen 19h 20m;
Necromancer 29h, Exiled King 36h, Elf Lord 44h, Old Magus 62h, Fallen Angel 91h, Tamed Oni 120h, Bound Demon 187h.
Across three seeds the late ones move by 10–20%: they arrive in the jump after an awakening, so their times follow when
the player awakens.

Cards collected: 4 at 20 h, 63 at 40 h, 96 at 80 h, 102 at 260 h.

### How the player ascends matters less than before

| Player | First awakening | Floor at 10 h / 20 h |
|---|---|---|
| Ascends once stuck (the timeline's) | 20 h | 165 / 395 |
| Ascends at every chance | 20 h | 130 / 380 |
| Never ascends | — | 150 / ~300 (a night's farming buys the Cleric at ~13 h) |

Without the gap after the Plague Doctor, the one who ascends once stuck awakened at 12 h and the eager one at 19 h;
the gap evened them out.

### Ascents (`node scripts/ascents.ts 60`, nonstop, ascending at every chance)

| Ascent | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ends at | 2h | 3.6h | 4.7h | 5.8h | 7.1h | 9.1h | 10.7h | 11.8h | 12.8h | 13.1h | 14.1h |
| Souls gained | 12 | 9 | 11 | 17 | 25 | 43 | 65 | 97 | 153 | 217 | 491 |
| Deepest floor | 100 | 100 | 100 | 111 | 140 | 201 | 201 | 251 | 286 | 316 | 396 |

The first awakening is at 14h 43m (floor 435), the second at 20h 51m (floor 511). By 60 h: ascent 174, floor 2256,
4.3e17 souls, runs of about half an hour.

### Builds

The sim spends bound souls on the Pit Lord while a level costs at most half of what's free, a level of each Spirit
booster from 30 bound souls on, and the rest on the Ogre Chieftain. A Clicker Heroes-style build (Frost first as
Borb, most on the Pit Lord as Ponyboy, a share on the Lich as Chor'gorloth) lands within about 5%. All on the Ogre
Chieftain stalls at floor 500–540 for good.

---

## 3. Diagnosis

### 3.1 The gap after the Plague Doctor is long (medium)

About 11 played hours with no new companion, about 11 days at an hour a day. It's what makes the first ascent pay,
and it matches the stretch Clicker Heroes players complain about most (the Dread Knight wall). The Cleric at floor 145
cuts it to 8 h but brings the first awakening down to 17–19 h. Souls, Legends, Spirits, cards and trophies carry it
for now.

### 3.2 All Ogre Chieftain is a dead end (medium)

The Ogre's +100% a level is the obvious buy and stalls at floor ~520. Depth comes from the Pit Lord's
×(1 + 10·level²) on champion souls, compounding with the pull. Nothing in the game says so.

### 3.3 Climbing back after an awakening gets slower each cycle (medium)

1.5 h for the early cycles, 25 h by the tenth. The check wants under 45 minutes; Clicker Heroes players report
passing their old best "in a couple of days" after a Transcension, so the target may be what's off.

### 3.4 Late arrivals come in jumps (low)

Depth jumps right after each awakening, and awakenings space out (20, 29, 47, 65, 102, 147 h). A late companion's
time follows the awakening it lands after, so seeds move them by 10–20%.

### 3.5 Only a few systems scale forever (structural)

The level bonus, souls and the pull keep growing; traits, trophies, cards and party bonuses are fixed. New
companions only add their 8–12% per face, so post-launch ones extend the roster, not the depth curve, which flattens
past about 200 h (floor 3,700 → 3,950 by 290 h).

### 3.6 Numbers (low now)

`s.souls` is a JS `number`. The nonstop sim holds 4.3e17 at 60 h; champion souls are bounded by the pull to about
1.15^((floor − 100)/5), around 1e47 at floor 4,000, well under 1e308.

---

## 4. Open questions

- Is an 11-hour gap after the Plague Doctor right, or should the Cleric come at about floor 145 (8 h)?
- Should the game point players at the Pit Lord?
- What should the climb back after an awakening take?
- What extends the depth curve past 200 h for post-launch content?

---

## 5. Reproducing

```bash
node scripts/ascents.ts 60
node scripts/timeline.ts 300
```

Pass `TUNE='{"levelsPerSoul":1000}'` (any `TUNE` key) or `--seed n` to try another value. Both sims are seeded; the
numbers above are from one run on `dev` at 62d0ca9.
