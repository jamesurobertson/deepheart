# Deepheart Scaling Analysis

Analysis of the economy as of 2026-10-18, based on the souls-only rework (commit `4bef826`): the new roster,
traits, `COST_GROWTH` 1.075, and log-based souls. §0 lists the changes made on top of it. Every number below comes from the game's own sims (`scripts/timeline.ts`,
`scripts/ascents.ts`) or from probes driving `scripts/bot.ts`. Commands to reproduce are in §6. General theory:
`incremental-game/docs/scaling-blueprint.md`.

---

## TL;DR

1. **The prestige loop is about 3× too stingy.** `soulExp: 0.12` means doubling your souls takes about 41 new floors,
   but doubling your damage only buys about 15. Runs stretch from 18 minutes to 17 hours, and progress effectively
   stops after about 10 h. The deepest floor is 440 at 10 h and only 600 at 300 h, with quiet stretches of up to 50 h.
2. **The early game is too fast.** Before floor 140, gold outgrows HP by 3.2% per floor. All 24 companions arrive in
   56 minutes, and the player is on floor 129 after one hour (the target is 30–60).
3. **Three tuning numbers fix both:**
   `TUNE='{"soulExp":0.35,"soulDigits":25.8,"goldGrowth":1.55}'`. The 300-hour timeline goes from **1 of 8 checks
   passing to 6 of 8**. The deepest floor rises every 20 h through 300 h, and the longest quiet stretch drops from 50 h
   to 2 h. The two remaining failures are the awakening (switched off) and three slightly long early quiet stretches.
4. **Structurally, only two systems scale forever:** the level bonus (×3 every 25 levels) and souls. Traits,
   trophies, party bonuses, upgrades and synergies are fixed constants. They fade to under 10% of total damage, and
   all of that content is used up in the first 2 hours.
5. **Recommended path:** apply the three numbers, strip down to a core of floors, companions, levels, souls and
   offline progress, rebuild the curves around the balance rule, then add systems back one at a time with an explicit
   budget (§5).

---

## 0. Implemented on top of the rework

The goal is a great first 8 hours that keeps going afterwards. The final values differ from §4 because gating
companions changed where the first ascent lands.

| Change | Where |
|---|---|
| `soulExp` 0.12 → **0.35**, with the balance rule written into the `TUNE` comment | `game.ts` `TUNE` |
| `goldGrowth` 1.6 → **1.56** (gold barely outpaces HP until the steep curve ends) | `TUNE` |
| New knob `deepFrom` (was a hardcoded 140) → **100**, so ascents happen on the gentle curve | `TUNE`, `floorHp`, `floorGold` |
| `soulDigits` 21.5 → **17**, so the first ascent at floor ~100 pays a handful of souls | `TUNE` |
| Party traits on only **five** companions (Shieldmaiden, Corsair, Stormcaller, Venomblade, Demon), each **+50%** (×7.6 together, down from ×330). The rest became own traits (×2 to that companion) | `data.ts` `TRAIT_PLAN`, `traitEffect` |
| Companions gated by **deepest floor ever reached**: the last six wait at floors 105, 145, 190, 240, 300 and 400. `CompDef.depth` (ascents) became `floor`, and the UI says "Reach floor N to meet them" | `data.ts`, `compUnlocked`, `ui.ts` `meetText` |
| `timeline.ts` checks the 8-hour arc: companions at the first ascent, all 24 by 5–8 h, longest wait for a new companion, floor 321 (every card can drop) by 5–10 h. Awakening is reported as switched off rather than failed | `scripts/timeline.ts` |

**Casual-player timeline** (three 20-minute sessions a day):

| Check | Before | After |
|---|---|---|
| First wall | 5m52s ✅ | 6m32s ✅ |
| Deepest floor at 1 h (30–60) | 129 ❌ | 40 ✅ |
| First ascent (1.5–3 h) | 59 m ❌ | 2h28m ✅ |
| Companions by the first ascent (16–19) | all 24 ❌ | 18 ✅ |
| All 24 companions (5–8 h) | 56 m ❌ | 7h18m ✅ |
| Longest wait for a new companion (< 80 m) | n/a (all met in the first hour) | 1h15m ✅ |
| Every card can drop, floor 321 (5–10 h) | ~4 h | 6h09m ✅ |
| Deepest floor rises every 20 h | flat at 80–100 h ❌ | ✅ through 300 h |
| Never too long without something new | 30 too long, longest 50 h ❌ | 1 slightly long (at 7h45) ❌ |

Deepest floor by hour: 1h:40, 2h:71, 3h:111, 4h:151, 5h:210, 6h:291, 7h:380, 8h:440, 10h:601, 100h:3303,
300h:~5900. Across three other seeds: first ascent 2h01–2h20, last companion 6h21–6h42, depth at 8 h 481–506.

**Existing saves:** soul totals are recounted under the new formula, so playtesters get a large payout on their next
ascent. A save that already has a gated companion below its floor keeps that companion's levels until it ascends;
the row shows as locked in the meantime.

## 0.1 Next: overkill for card farming

The endgame should be overkill making card farming fast. Today overkill stops helping once monsters die in one hit:

- **Farming a chosen floor doesn't sweep.** `canSweep` requires `s.auto`, so farming with auto off is capped by the
  spawn rate (`SPAWN_GAP` 0.12 s, about 8 kills a second) however strong you are.
- **Sweeps never roll champions,** so gold cards only come from monsters that actually spawn.
- **Offline kills are capped** at `1 / SPAWN_GAP` × 25%, about 2 a second.

Suggested shape: let a floor be swept whenever the party overkills it (auto on or off), roll champions inside sweeps
at `CHAMP_CHANCE`, and let the sweep rate grow with overkill, for example one extra floor-clear a second per ×10 of
overkill. Offline should use the same rate. The balanced curve already provides the overkill, since 50 floors behind
the deepest is about ×870. This turns that surplus straight into card rolls.

Trophies can stop adding damage at any time (they're worth about ×20–40 in total and aren't part of the balance). If
they do, re-check the first-climb timings.

## 0.2 Goblins: the pace assumes you catch nearly all of them

Casual player on the tuned build, 3 seeds each:

| Goblins | First ascent | Depth at 4 h | Depth at 8 h | Last companion |
|---|---|---|---|---|
| Never caught | 2h41 | ~119 | ~295 | not by 10 h |
| ~50% caught | ~2h20 | ~139 | ~376 | ~8h24 |
| ~94% caught (the bot's default) | ~2h02 | ~180 | ~486 | ~6h46 |

Turning off one reward type at a time (rerolled as plunder) at 8 h:

| Change | Depth at 8 h |
|---|---|
| No rainbow goblins | ~418 (−14%) |
| Every buff replaced by plunder | ~558 (+15%) |
| No Bloodlust | ≈ same |
| No Frenzy | ≈ same |
| No Gold Rush | ~455 (−6%) |

**The gold rewards do the work, and the buffs are the bad rolls.** Plunder pays 10–20× `floorGold`, which is 1–2
floors of kills, no matter how slowly you're killing. At a wall, where a floor takes minutes, a goblin every 3–5
minutes roughly doubles your income. That's why goblins add about +65% depth by 8 h, and why a player who misses them
falls about 40% behind.

Suggested fix:
- **Price plunder from the player's own income** (60–90 s of current gold per second, the way Cookie Clicker caps
  Lucky at 15 minutes of CpS), so a goblin is a nice bump rather than half your income at a wall.
- **Re-tune the pace for a ~60% catch rate,** so the 8-hour arc doesn't rely on catching everything.
- **Make the buffs worth rolling,** or accept that they're flavor.

## 0.3 Companion traits: finite, and front-loaded in `dev`

| Trait | Effect | Total |
|---|---|---|
| Party | 26 traits, each +25% to **every** companion, multiplying together | 1.25^26 ≈ **×330** |
| Own | up to 5 per companion, ×2 each | up to ×32 on that companion |
| Synergy | ×2 to both partners | |
| Trophies, tonics, upgrades | additive bonuses | ×20–40 trophies, ×3 upgrades |

All of it is finite: about 6.4 orders of magnitude combined, and the bonus stops growing once every trait is bought.
The level bonus (×3 every 25 levels) and souls are the only systems that keep growing. On `dev`, damage climbs about
**20 orders of magnitude in the hour from 0.5 h to 1.5 h**:

| Source | Share of those 20 orders |
|---|---|
| Hiring the whole roster (Corsair → Demon base damage) | 11.5 |
| Party traits | 2.4 |
| Levels | 2.2 |
| Own traits | 1.5 |
| Trophies | 1.1 |

That's the "damage scaling way too fast" moment. On the tuned build, gating spreads the roster and its party traits
over the first 7 hours. The first climb grows about 12 orders over 1.5 h, which matches the HP it's climbing.

**Done on the branch:** only five companions have a party trait (+50% each, ×7.6 together). Through the first climb,
party traits now add 0.2 orders of magnitude by 2 h, against 2.5 on `dev`. Damage grows about 11 orders from 0.5 h
to 2 h, matching the 11 orders of HP it climbs. `goldGrowth` 1.56 and `soulDigits` 17 make up the lost damage.

---

## 1. The economy as it stands

| System | Formula / constants | Where |
|---|---|---|
| Floors | 25 kills; a boss every 5 floors, 30 s timer | `game.ts` `FLOOR_KILLS`, `BOSS_EVERY` |
| Monster HP | `10·(f−1 + 1.55^(f−1))` to floor 140, then ×**1.145** per floor. Trash monsters have 0.4× floor HP. Bosses have 8× (halved before floor 100, doubled on zone bosses from 100) | `floorHp`, `spawnBoss` |
| Gold | `1.6^(f−1)` to floor 140, then ×**1.15** per floor | `floorGold` |
| Gold/HP drift | **+3.2% per floor** before 140; **+0.44%** after | derived |
| Companions | 24 of them. Each costs about ×7 the last and deals about ×5 the damage, so payback grows only ×1.4 per tier | `COMPS` |
| Level cost | `cost · 1.075^level` | `COST_GROWTH` |
| Level bonus | ×3 every 25 levels from 200, with no end | `LEVEL_BONUS` |
| Traits | 4–7 per companion at levels 10–150 (×2 own, +25% party, click %, gold, boss, crit, skill) | `TRAIT_PLAN` |
| Souls | `(cycleGold / 10^21.5)^0.12 − 1`, counting only gold from new depths. Each soul is +100% damage (additive). Ascending opens at floor 100 | `soulTarget`, `soulMult` |
| Trophies | +1% each (additive), +0.5–3.5% more per trophy from trophy upgrades | `trophyMult` |
| Phantom Blade | Click damage ≈ party DPS × (5% + upgrades), several times a second, can crit | `compute`, `autoRate` |
| Temporary buffs | Rampage ×5/×10, Bloodlust ×7, War Drums ×2, Frenzy ×77 clicks, Treasure ×3 gold. **They multiply together** | `rewardBuff`, abilities |
| Offline | 25% speed, 72 h cap, farms the current floor (never reaches new ones) | `applyOffline` |
| Off | Relics, curses, awakening (the Heart) | `RELICS_ON`, `CURSES_ON`, `AWAKEN_ON` |

### Derived numbers that drive everything

| Quantity | Value | How |
|---|---|---|
| Damage you get per gold spent on levels (α) | **0.61**: ×10 gold buys ×4.1 damage | `ln(3)/25 ÷ ln(1.075)` |
| Effective HP growth per floor, after gold's help | **1.164** before floor 140; **1.052** after | `h / g^α` |
| Floors that ×2 damage buys (past 140) | **13.7** predicted; **~15 measured** (×10 souls = +50 floors) | `ln 2 / ln 1.052`; souls probe |
| Floors needed to double souls (past 140) | **41** | `ln 2 / (0.12 · ln 1.15)` |
| Same, before floor 140 | **12** | `ln 2 / (0.12 · ln 1.6)` |

---

## 2. What the sims show today

### Ascents (casual player, `node scripts/ascents.ts 60`)

| Ascent | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Run length | 59m | 18m | 18m | 21m | 21m | 24m | 40m | 1h | 2.3h | 3.7h | 6.3h | **17h** |
| Deepest floor | 128 | 140 | 165 | 204 | 246 | 281 | 320 | 360 | 403 | 446 | 480 | 510 |

Each ascent gains about 40 floors, because that's what doubling souls costs. The multiplier it pays only covers about
15 of them, so the rest has to be ground out inside the run, and the grind grows geometrically.

### 300-hour timeline (`node scripts/timeline.ts`)

1 of 8 checks pass (the first wall at 5m52s).
- **Early game:** floor 128 at 1 h, first ascent at 59 m, and all 24 companions met by 56 m. All of these are too
  early.
- **Long game:** the deepest floor every 10 h goes 440 → 480 → 510 → 510 → 530 … 600. It's flat from 80 h to 100 h,
  with 30 quiet stretches that run too long (the longest is **50 h 38 m**).

### Where the damage comes from (orders of magnitude, ascent 12, floor 510)

| Level bonus | Companion base | Souls | Levels (linear) | Party traits | Trophies | Own traits | Upgrades | Synergy |
|---|---|---|---|---|---|---|---|---|
| **16.2** | 16.3 | 3.7 | 3.0 | 2.5 | 1.6 | 1.5 | 0.5 | 0.3 |

Two more facts from the probes:
- **The Phantom Blade does about 80% of idle damage.** `dpsTotal()` runs 0.7 orders of magnitude (5×) above `dps()`
  at every depth checked, so the companions, who are the fantasy of the game, deal about a fifth of it.
- **The walls are broken by stacked bursts.** Rampage ×12 × Bloodlust ×7 × War Drums ×2 ≈ ×170, which is about 38
  floors' worth of boss HP at 1.145 per floor. Past the wall, progress happens almost entirely in the 2-minute active
  windows.

---

## 3. Diagnosis

### 3.1 The prestige loop sits below the balance point (critical)

The rule from the blueprint, restated in floors:

> **Balanced when souls double over the same number of floors that doubled damage buys.**
> With souls `∝ gold^k` and gold growing ×g per floor, that means `k ≈ (ln h − α·ln g) / ln g`.

| Region | h | g | Balanced k | Current k | Floors per doubling: needed vs. bought |
|---|---|---|---|---|---|
| Before floor 140 | 1.55 | 1.6 | 0.33 | 0.12 | 12 vs. 4.5: *too generous* at first … |
| After floor 140 | 1.145 | 1.15 | **0.36** | 0.12 | **41 vs. 14: 3× too stingy** |

That is the whole shape of the current game. Ascents 2–6 are quick 18-minute runs (pre-140 souls, cheap), then the
deep game hits the stingy regime and runs blow up. Tying souls to gold is actually a good choice here. It adapts
itself across the floor-140 change, so **one exponent of about 0.35 is close to balanced in both regions.** The
exponent is simply wrong.

**Verified** (60 h of ascents, with `soulDigits` re-fit so the first ascent still pays about 5 souls):

| soulExp | Ascents | Deepest floor | Run lengths |
|---|---|---|---|
| 0.12 (now) | 12 | 530 | 18m → **17h** |
| 0.30 | 86 | 1600 | 12m → 2h40m (slowly drifting) |
| **0.35** | 155 | **2463** | 11m → 40m, about 15 floors per ascent |
| 0.40 | 165 | 2231 | 4m → 45m |

### 3.2 The early game burns through its content (high)

Gold grows ×1.6 per floor against ×1.55 for HP. By floor 140, gold per HP has compounded **×82**, so every early floor
is easier than the last, and the ×7 companion ladder is cleared about one hire every 4 floors. Setting `goldGrowth` to
1.55 (no drift before 140) lands the first-hour targets exactly:

| | Now | goldGrowth 1.55 | goldGrowth 1.56 |
|---|---|---|---|
| Deepest floor at 1 h (target 30–60) | 129 | **40** | **40** |
| First ascent (target 1.5–3 h) | 59 m | **2h20m** | **2h05m** |
| All 24 companions (target 2–5 h) | 56 m | **2h12m** | **2h00m** |

Even tuned, though, **every companion is met before the first ascent** (2h12m vs. 2h20m). The comment above the last
four in `COMPS` says they "wait deeper down," but nothing makes them wait. Their ×11.7 cost steps are only about 5.5
floors apart at ×1.55 gold per floor. The rework also dropped the old `depth` / `heart` gates (the fields are still
on `CompDef`). Companions are the game's best "something new" reward, so they should be spread across the prestige
layers (§5 Step 4), and the timeline targets should change to match.

### 3.3 Only two systems scale forever (structural)

Under the tuned numbers, at ascent 75 (floor 1258), damage is **42.5 orders from the level bonus and 25.2 from
souls**. Traits, trophies, party bonuses, upgrades and synergies add a constant **~6 orders combined**. They matter for
the first couple of hours and then fade. Two consequences:

- **No new decisions late.** Every companion has the same ×3/25 bonus and the same ×1.075 cost, so the best buy is
  always "level everyone evenly." The bot ends with every companion between levels 2,600 and 2,900.
- **"Natural" growth is invisible.** Damage goes up because a hidden ×3 lands every 25 levels, not because of
  anything the player chose.

### 3.4 The content budget doesn't match the pace (structural)

- **Companions and traits:** all of them in the first 1–2 hours, then nothing new for 298 hours.
- **Depth content:** corruption laps, floor trophies (up to 5,000), and boss modifiers (capped at floor 200) were
  sized for the stalled curve, which tops out around floor 600. With balanced souls the player reaches floor 1,000 at
  about 20 h and 5,000 at about 300 h.
- **Floors per hour:** this is a pacing knob separate from balance. If floors come too fast for the content, raise
  `deepHp` and re-derive k from the rule. For example, `deepHp` 1.17 gives k ≈ 0.52; that one is untested.

### 3.5 Bursts and parallel damage chains distort the walls (medium)

- **Multiplicative buff stacking** (×170) turns walls into "be online with the right buffs" checks. The idle curve and
  the active curve diverge by about 38 floors.
- **The Phantom Blade** is a percentage of party DPS × attack rate × crits, which makes it a constant ×5 on the party.
  It isn't a scaling bug, but it makes the companions feel secondary and makes the stats page hard to read.

### 3.6 Numbers and the parked second layer (low now, critical later)

- **Soul overflow.** `s.souls` is a JS `number`. Balanced souls reach about 1e51 by 60 h and about 1e123 by 300 h,
  and they'd overflow 1e308 around floor 14,000. Values like "+8.2e50 souls" also need to be formatted.
- **Awakening will run away.** Heartstones are `souls^0.37`. Once souls grow exponentially with depth (which they
  must, to match HP), any power of souls is still exponential. When awakening comes back, base it on a **log**
  (e.g. `c · log10(lifetime souls)`, as Clicker Heroes' Ancient Souls do) or on fixed depth milestones.

---

## 4. Results of the three-number retune

`TUNE='{"soulExp":0.35,"soulDigits":25.8,"goldGrowth":1.55}' node scripts/timeline.ts 300`

| Check | Now | Tuned |
|---|---|---|
| First wall | ✅ 5m52s | ✅ 6m32s |
| Deepest floor at 1 h | ❌ 129 | ✅ 40 |
| First ascent | ❌ 59m | ✅ 2h20m |
| First 20 companions | ❌ 53m | ✅ 2h00m |
| All 24 companions | ❌ 56m | ✅ 2h12m |
| First awakening | ❌ never | ❌ never (switched off) |
| Never too long without something new | ❌ 30 too long, longest 50h38m | ❌ 3 slightly long, longest 1h59m |
| Deepest floor rises every 20 h | ❌ flat 80–100 h | ✅ 905 → 1650 → … → 5020 |

In code that's three edits to `TUNE` in `game.ts`: `soulExp: 0.35`, `soulDigits: 25.8`, `goldGrowth: 1.55`. Existing
saves will see their soul totals recounted under the new formula on the next ascent.

---

## 5. Recommended path

### Step 1: apply the retune (hours)

Apply the three numbers above. Add the balance rule to the `TUNE` comment, so any future change to `deepHp`,
`deepGold`, `COST_GROWTH` or `LEVEL_BONUS` re-derives `soulExp`:

```
k ≈ (ln deepHp − α·ln deepGold) / ln deepGold,   α = (ln LEVEL_BONUS.mult / LEVEL_BONUS.every) / ln COST_GROWTH
```

Go about 0–10% above k; more than that and runs start collapsing.

### Step 2: strip down to the core and re-baseline (a day)

Core: **floors and bosses, the 24 companions with levels, the level bonus and own/party traits, souls, offline.**
Park everything else behind flags, the way `RELICS_ON` already works:

| Park | Why |
|---|---|
| Trophy damage bonus (keep trophies as collectibles) | constant that fades; adds noise to tuning |
| Shop tonics / global % / synergies | constants that fade |
| Crit, cleave, Phantom Blade speed-ups | parallel damage chain worth ×5 on top of the party |
| Rampage, Bloodlust, War Drums, Frenzy multipliers | multiplicative bursts (×170) turn walls into burst checks |
| Treasure goblins: keep, as gold only | gold is harmless; damage buffs aren't |
| Cards, waking world | no economy impact, so keep as-is |

Re-run `timeline.ts`. That output becomes the baseline every later system is measured against.

### Step 3: make the core curves one knob each (a day)

- **Gold as an exchange rate:** `gold(f) = HP(f) × 1.00x^f`, so gold per HP is a single explicit drift knob instead
  of two independent curves with a regime switch at 140. The early drift should be close to 0 (see §3.2).
- **Souls:** keep them gold-based, which adapts across HP regimes on its own, with k from the rule. If readable soul
  counts matter more, switch to depth-based souls (a few souls per new floor, each ×1.05 compounding). That only stays
  balanced with a single HP growth rate, so it pairs with removing the floor-140 switch.
- **Floors per hour:** set it with `deepHp` to match the depth content you intend to build, then re-derive k.

### Step 4: budget the content across depth (ongoing)

- **Spread companions across the prestige layers.** Don't let the first climb meet everyone. A shape that gives every
  layer a new face:

  | Companions | Arrive | Gate | At the tuned pace |
  |---|---|---|---|
  | 1–10 | first climb | price only | 0–2 h |
  | 11–18 | one per ascent band | `depth` (ascents) at 1, 3, 6, 10, 20, 35, 60, 100 | about 2.5 h → 28 h |
  | 19–24 | one per awakening | `heart` 1–6 | layer 2, once rebuilt (Step 6) |

  Gating by `depth` reuses the existing `compUnlocked` check. The alternative is pricing late companions off the
  floor they should arrive at (`cost = floorGold(F) × c`, damage ∝ cost^0.85), which makes them arrive "naturally"
  without a lock. With either approach, a late arrival levels to parity almost immediately, because level costs are
  cheap next to late-game gold. The bump the player feels comes from its traits, especially the +25% party trait, so
  every gated companion should have a party trait early in its plan.
- **Update `timeline.ts` to match.** Replace "First 20 companions met 1.5–3 h" / "All 24 met 2–5 h" with something like
  "8–12 companions at the first ascent", "18 by 30 h", and "a new companion at least every ~10 h until the roster is
  done."
- **Vary the level bonus per companion** (×3 every 25 for some, ×10 every 75 for others, ×2 every 10 for a few), so
  the best buy shifts over time instead of "level everyone."
- **Re-space depth content** (boss modifiers, corruption laps, floor trophies) to the new depth curve.

### Step 5: add systems back with a budget (per system)

Before re-enabling a system, give it a ceiling on how many orders of magnitude it can add, then check the timeline:

- **Bursts:** additive, or one at a time, capped at about ×5. Keep active play at 1.5–3× idle, not ×170.
- **Phantom Blade:** keep it as a percentage of party damage, but small (×1.5, not ×5).
- **Trophies:** around ×2–3 total; collectors' flavor, not an engine.
- **Relics** (already off): bring them back as answers to boss modifiers rather than raw multipliers.

### Step 6: rebuild awakening on a log (when the core is stable)

`stones = c · log10(lifetime souls)`, or a fixed payout per depth milestone, keeping the deeper-each-time requirement.
Then each awakening adds a predictable amount of power that a pure power of souls can't run away from. Plan its
pacing the same way: a few awakenings before the third layer at 100–150 h.

### Step 7: move souls to `Decimal`

Do this before anyone can reach floor ~14,000, and format soul counts with the same suffixes as gold.

---

## 6. Reproducing

```bash
# Current state
node scripts/ascents.ts 60
node scripts/timeline.ts 300

# Retuned
TUNE='{"soulExp":0.35,"soulDigits":25.8,"goldGrowth":1.55}' node scripts/ascents.ts 60
TUNE='{"soulExp":0.35,"soulDigits":25.8,"goldGrowth":1.55}' node scripts/timeline.ts 300

# Exponent sweep (soulDigits re-fit so the first ascent pays about 5 souls: D = 28 − log10(6)/k)
TUNE='{"soulExp":0.30,"soulDigits":25.4}' node scripts/ascents.ts 60
TUNE='{"soulExp":0.40,"soulDigits":26.05}' node scripts/ascents.ts 60
```

The souls-per-floor and damage-breakdown numbers came from small throwaway probes built on `scripts/bot.ts`'s `Sim`:
- **Fixed-soul runs:** set `game.s.souls` on a fresh run, play idle for 1 h and 4 h, and record `maxFloor`.
- **Breakdown snapshots:** log `game.breakdown().parts` at each ascent.

Both are worth adding to `scripts/` if this tuning work continues.
