# Progression rewrite: Clicker Heroes' shape

Status: plan, nothing built. Written 2026-11-05 against `dev` with the uncommitted UI work in the tree.

## Goal

Past the Cleric the game should stall the way Clicker Heroes does between Frostleaf and the first Transcension:
no new companion for a long stretch, and every few floors won by ascending, spending souls (damage or Spirits),
gathering Heartmarks and pushing again. New companions arrive rarely and only after awakenings. No artificial health
walls: the stall comes from the roster.

Not a copy. We keep our shorter early game (curve switch at floor 100, not 140), our 32 companions, Spirits, the Bound,
cards and expeditions. Where we have a Clicker Heroes system under another name, we match its numbers unless there's a
reason not to.

## 1. What Clicker Heroes does

Sources: the Clicker Heroes wiki (Heroes, Formulas, Hero Souls, Ancients, Gilds, Transcension, Ancient Souls,
Newbie Guide: Pre-Transcendence) and the game's own data file in `tomcur/ClickerHeroesCalculator`
(`ClickerHeroes_v14307.json`), read 2026-11-05.

| System | Clicker Heroes |
|---|---|
| Monster health | ×1.55 a zone to 140, then ×1.145; from 501 the growth rises 0.001 every 500 zones. Bosses 10× |
| Gold | ×1.6 a zone to 140, then ×1.15 |
| Levels | cost ×1.07 a level; damage ×4 every 25 levels from 200 (×10 at each 1000th to 8000) |
| Heroes to Frostleaf | 26, priced ×4 to ×500 apart, each 26% less damage per gold than the last |
| Heroes after Frostleaf | Dread Knight ×4.8e12 over Frostleaf at 2,700× worse damage per gold; then **×1e15 each** (Atlas 1e55, Terra 1e70…), damage ×7.4e12 each (damage ∝ price^0.858) |
| Zones 130–300 | **no new hero.** The guide: Dread Knight "will not have to be hired… never optimal to level" |
| Hero souls | +10% damage each; 1 per 2,000 hero levels; primal bosses floor(((zone − 80) / 25)^1.3), 25% of bosses, sure on 100/110/120/130 and every 100 |
| Ancients | summon 1, 2, 4, 8, 16, 35, 70…; damage Ancients cost n souls for level n (Siyalatas +25% idle damage, Argaiv +2% per gild…); utility Ancients 2^n; Morgulis +11% per soul |
| Gilds | one every 10 zones past 100, +50% each, movable for souls |
| Ascending | "when you start failing bosses consistently", from zone 130 |
| Transcension | opens at zone **300**. Ancient souls = floor(5 × log10(hero souls sacrificed)) |
| Transcendent Power | TP = 25% − 23% × e^(−0.0003 × AS). Primal bosses pay an extra 20 × (1 + 10 × Ponyboy²) × (1 + TP)^(zone / 5 − 20) |
| Outsiders | Phandoryss +100% damage a level, Ponyboy ×(1 + 10 × level²) primal souls, Chor'gorloth −5% Ancient cost… |
| Walls | none in the formula. Before the **first** Transcension only, zones past 501 have about 1,000× the health |

## 2. Where Deepheart stands

| System | Deepheart now | vs Clicker Heroes | Plan |
|---|---|---|---|
| Health curve | ×1.55 to 100, ×1.145 after, `hpCreep` 0.0005 | switch at 100 not 140; creep about 2.5× faster | keep the switch at 100; creep like theirs (§3.2) |
| Gold | ×1.62 to 100, ×1.15 after | same shape | keep |
| Levels | ×1.07, ×4 every 25 from 200 | same | keep |
| Companions to the Doctor | 16, ×6 to ×215 apart (mostly ×47), mostly −45% to −60% damage per gold each (G Man +40%) | same shape, steeper | keep |
| Doctor → Cleric | ×4.9e8 | like Frostleaf → Dread Knight | keep |
| **Cleric → Archmage** | **7 more, ×16–33 apart, floors 160–305** | nothing like it: they'd hire none here | **rewrite (§3.1)** |
| Late companions | 9 locked to floors 335–3,650, priced off the floor's gold | heroes are priced, never floor-locked | **rewrite (§3.1)** |
| Souls | +10%; 1 per 500 levels; champion bosses ((floor − 75) / 25)^1.3 | 4× more from levels; boss formula nearly the same | keep (we have fewer companions and levels) |
| Spirits | the Ancients' summon table, damage n, utility 2^n, Hungry Dark +11% | same | keep |
| Heartmarks | every 10 floors past 100, +50%, movable | gilds | keep |
| Awakening | floor 400 shipped, 300 in the tree | Transcension at 300 | **300** (in the tree) |
| Bound souls | 5 per power of ten of the cycle's souls | Ancient souls | keep |
| Pull | 2% toward a 15% cap, `pullScale` 187 | TP: 2% toward 25%, scale 3,333 | **match TP (§3.3)**: ours ramps about 18× faster, the main cause of the runaway after awakening |
| Champion souls with the pull | base × Pit Lord × (1 + pull)^((floor − 100) / 5) | base plus an additive TP bonus | **match (§3.3)** |
| Walls | ×1000 over 400–500 shipped; ×1000 every 100 from 200 in the tree | only before the first Transcension, past 501 | **drop both (§3.4)** |

## 3. The new design

### 3.1 Roster

- **Up to the Cleric: unchanged.** The 16 regulars to the Plague Doctor at floor 94, the gap, the Cleric at floor 160.
- **Everyone after the Cleric is priced like the Rangers**, the seven regulars and the nine late ones alike: one rule,
  no floor locks.
  - Each costs `LATE_STEP` × the one before. Clicker Heroes uses 1e15, about **247 floors** of our gold (×1.15 a
    floor). 1e12 would be about 198 floors.
  - Each deals `LATE_STEP^0.858` × the one before (Clicker Heroes' Rangers: ×7.4e12 for ×1e15).
  - Order: Frost Imp, Santa, Paladin, Lantern Knight, Oathbreaker, Archmage, The Count, Elf Queen, Necromancer, Exiled
    King, Elf Lord, Old Magus, Fallen Angel, Tamed Oni, Bound Demon.
- What that gives at 1e15 (the floor where one costs 30,000 monsters' gold, as the Cleric does at 160):

  | Companion | Floor | Companion | Floor |
  |---|---|---|---|
  | Frost Imp | ~405 | Necromancer | ~2,380 |
  | Santa | ~655 | Exiled King | ~2,630 |
  | Paladin | ~900 | Elf Lord | ~2,880 |
  | Lantern Knight | ~1,150 | Old Magus | ~3,125 |
  | Oathbreaker | ~1,395 | Fallen Angel | ~3,370 |
  | Archmage | ~1,640 | Tamed Oni | ~3,620 |
  | The Count | ~1,890 | Bound Demon | ~3,870 |
  | Elf Queen | ~2,135 | | |

  So nobody new between the Cleric (160) and the first awakening (300). Frost Imp is the first prize after it. The
  last one lands about where today's Bound Demon does (3,650).
- **Variant to sim alongside: a skipped step**, as Clicker Heroes' Dread Knight is (bought by nobody). Frost Imp
  costs `LATE_STEP²` over the Cleric instead of `LATE_STEP`, so it lands at ~650 and everyone after moves back ~247
  floors (Bound Demon ~4,115). In Clicker Heroes nothing usable comes from about zone 130 to about 800 (Atlas takes
  over from a gilded Samurai at level 725, about 1e76 gold), then a hero every ~247 zones.
  - Floor 405 is closer to our current pace; 650 is closer to Clicker Heroes'.
  - At 650 the stretch with nobody new covers two or three awakenings, so Heartmarks have to carry it, as gilds on
    Samurai do there.
  - Pick by the sims: how long each player waits, and how many ascents and awakenings each companion takes.
- Traits (`TRAIT_PLAN`) stay as they are. No ability belongs to anyone past the Cleric, so skills are unaffected.
- Optional, from Clicker Heroes: companions after the Cleric get ×5 instead of ×4 per 25 levels between 525 and 725.
  Only if the sims say the Rangers arrive too weak.

### 3.2 Monster health

- Keep `floorHp` to floor 100 and ×1.145 after.
- Replace `hpCreep` with Clicker Heroes' step: growth ×(1.145 + 0.001 × floor((floor − 1) / 500)).
- Remove `wallMult` and the `wallFrom` / `wallStep` / `wall` keys, and the wiki line about the wall.

### 3.3 Souls after awakening (the runaway)

- Pull: `pullCap` 0.25, `pullScale` 3,333 (Clicker Heroes' TP). At 15 bound souls that's 2.1% instead of 3.0%; at 100,
  2.7% instead of 7.4%.
- Champion souls: base × Pit Lord, **plus** 20 × Pit Lord × ((1 + pull)^(floor / 5 − 20) − 1). Today the pull
  multiplies the base, which pays about 5× Clicker Heroes by floor 1,000.
- Pit Lord stays ×(1 + 10 × level²) (Ponyboy).

### 3.4 Walls

- Drop both. With nobody new past the Cleric, a run stalls on its own.
- Clicker Heroes keeps one cap: before the first Transcension, zones past 501 have about 1,000× the health. We
  should add the same (×1000 past 500, only while `awakens === 0`) only if the sims show players pushing past 300
  instead of awakening.

### 3.5 Awakening and the Heart

- Awakening at floor 300; the Heart from floor 200 with its meter. Both already in the tree.

### 3.6 Spirits, Heartmarks, the Bound

- No changes; they already copy Ancients, gilds and Outsiders.
- The bot (`scripts/bot.ts`) needs to spend like a player who follows Clicker Heroes' rule of thumb. Damage Spirits
  should get about half the soul pile's order of magnitude, and the Hungry Dark the rest. Today the bot under-buys
  them, so the sims understate Spirits.

## 4. Pacing targets

To agree on before tuning. Played hours = time with the game running.

| Milestone | Casual (3 × 20 min a day) | Left on (16 h a day, 10 active minutes every 4 h) |
|---|---|---|
| First ascent | 2–4.5 h (as now) | day 1 |
| Cleric | 10–14 h (as now) | day 2–3 |
| Ascents from the Cleric to floor 300 | 10–25 | 15–30 |
| First awakening (floor 300) | 25–40 h | day 5–8 |
| Frost Imp | after the 1st or 2nd awakening | same |
| Each companion after | one every 1–3 awakenings, gaps widening | same |
| All 32 | 250–400 h | weeks 6–10 |
| Depth | rises every 20 played hours to 300 h | rises every day for 10 weeks |

## 5. Building it

In this order, each step simmed before the next.

1. **Commit the UI work first** (wording, keyboard, Spirits window, respec, NEW cards, awakening screen, idle HUD fix)
   so the rewrite is its own commit.
2. **Sim harness.**
   - Move `scripts/_lefton.ts` into `scripts/timeline.ts` as a second player, `--player left-on`.
   - Add "ascents between companions" to the report.
   - Replace the timeline checks with §4's targets.
   - Delete `scripts/_gap.ts` and `scripts/_lefton.ts` when done.
3. **Walls out, health creep like Clicker Heroes** (`src/game/game.ts` `floorHp`, `TUNE`; wiki `dungeon.ts`). Sim.
4. **Roster**: reprice and re-damage everyone after the Cleric in `src/game/data.ts` (`COMPS`), drop their `floor`
   locks, and rewrite the big pricing comment. Sim with `LATE_STEP` at 1e12, 1e13 and 1e15, each with and without the skipped step
   (Frost Imp at ~405 or ~650 for 1e15).
5. **Pull and champion souls** (`pull`, `champSoulMult`, `champSouls`; wiki `souls.ts`). Sim.
6. **Bot spending** (`feedLegends`). Sim again; this moves everything.
7. **Tune to §4** with `LATE_STEP`, `levelsPerSoul` and the pull. Only then consider the pre-awakening cap.
8. **Clean-up**:
   - Trophies and news lines that name floors or companion counts.
   - Wiki pages that quote floors.
   - Rewrite `docs/scaling-analysis.md`.
   - Check that `?state=` and `?sim=` helpers still build sensible saves (`src/main.ts`).
9. **Release** as v0.12.0.

## 6. Risks

- **The Cleric → 300 stretch may feel empty.** Clicker Heroes fills it with Ancients and gilds; we have Spirits,
  Heartmarks, cards, trophies and expeditions. Watch the timeline's "something new" check; if it fails, the fix is
  more Spirit and card content there, not new companions.
- **Idle players may never reach 300.** Clicker Heroes has the same split (idle softcaps lower). The left-on player is
  the check.
- **Late companions become pure gold gates**, so they arrive by depth alone, with no reveal at a set floor. Any story
  beats tied to a floor (the Count at 335, Elf Queen at 370) move.
- **Old saves.** Prices past the Cleric change by up to 1e200×. A save that owns Frost Imp or later keeps its levels
  but can't afford more for a long time.

## 7. Decisions needed

1. Saves: **start fresh** with v0.12.0 (as v0.11.0 did), or carry on with that oddity? Recommend fresh.
2. `LATE_STEP`: start the sims at Clicker Heroes' 1e15 and go lower only if the late game is too slow? Recommend yes.
3. The pre-awakening cap at 500: leave out unless the sims need it? Recommend yes.
4. The §4 targets, especially first awakening at 25–40 casual hours (today 21) and all 32 at 250–400 h.
