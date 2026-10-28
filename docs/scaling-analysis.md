# Deepheart Scaling Analysis

The economy as of v0.10.10 (2026-10-28), for the pacing targets talk. Every number comes from the game's own sims
(`scripts/timeline.ts 300`, `scripts/ascents.ts 60`) or from the constants in `game.ts` and `data.ts`. Commands are in
§5. General theory: `incremental-game/docs/scaling-blueprint.md`.

This replaces the 2026-10-18 notes. Since then the souls formula, the roster, the level bonus and the knobs were all
reworked, and relics and curses were removed. The old retune (`soulExp` 0.35, log-based souls) is gone, and so are the
"all 24 companions" and "trait share" tables built on it.

---

## TL;DR

1. **The first ascent lands on time** (2h 0m at floor 101, target 2–4.5 h) and the first hour is on target (floor 55,
   target 30–60).
2. **The middle is where it breaks.** Ascents 2 and 3 take 14 h and 11 h, because each pays only 5–6 souls
   (+10% damage each). The deepest floor is 101 at 10 h and only 127 at 30 h.
3. **Then it runs away.** Souls grow with levels bought, so they snowball once the party is strong. From ascent 30 on,
   runs are 5–20 minutes and a run gains about 15–30 floors. In the 60 h ascent sim, ascent 62 is at 58 h with
   1.7 billion souls and floor 816.
4. **The roster no longer fits the timeline checks.** There are 32 companions, 23 free and 9 gated by floor, and
   `timeline.ts` still expects 24.
5. **8 of 11 timeline checks fail**, mostly the 20–100 h arc: awakening at 47 h (target 35–45 h), 43 stretches without
   anything new, flat in hours 80–100.

---

## 1. The economy as it stands

| System | Formula / constants | Where |
|---|---|---|
| Floors | 20 kills; a boss every 5 floors, 30 s timer | `FLOOR_KILLS`, `BOSS_EVERY`, `BOSS_TIME` |
| Monster HP | `10·(f−1 + 1.55^(f−1))` to floor 100, then ×**1.145** per floor, steepening by `hpCreep` 0.004 per 100 floors. A wall ramps in ×1000 over floors 300–400, then ×1.04 per floor | `floorHp`, `TUNE` |
| Gold | `1.62^(f−1)` to floor 100, then ×**1.15** per floor | `floorGold`, `TUNE` |
| Companions | 32: 23 free, priced about ×4 the last, then 9 gated by deepest floor ever reached: 95, 130, 190, 240, 280, 450, 800, 1500, 3000. Gated ones cost 150× to 30,000× the gold on their floor | `COMPS` |
| Companion damage | One smooth curve: damage ÷ price^0.82 is about 8% better per face through the first 23, then 12% | `COMPS` comment |
| Level cost | `cost · 1.07^level` | `COST_GROWTH` |
| Level bonus | ×4 every 25 levels from 200 (×10 at every 1000th level), per companion, no end | `LEVEL_BONUS` |
| Traits | 4–7 per companion at levels 10–150. Only five companions have a party trait (+50% each, ×7.6 together); the rest are own traits (×2 to that companion), plus click, gold, boss, crit, blade, cleave, Rampage and skills | `TRAIT_PLAN` |
| Souls | 1 per 2,000 levels bought in a run, plus boss souls from floor 100. Each soul is +10% damage (additive). Ascending opens at floor 100 | `levelsPerSoul`, `soulPower`, `bossSouls` |
| Trophies | +1% each (additive) | `trophyMult` |
| Awakening | On, opens at floor 300 | `AWAKEN_ON`, `AWAKEN_FLOOR` |
| Off | Nothing is parked. Relics and curses were removed | |

### Derived numbers

| Quantity | Value | How |
|---|---|---|
| Damage per gold spent on levels (α) | **0.82**: gold ×10 buys damage ×6.6 | `ln(4)/25 ÷ ln(1.07)` |
| Effective HP growth per floor, after gold's help | **1.044** before floor 100; **1.145 / 1.15^0.82 = 1.021** after, before the creep and the wall | `h / g^α` |
| Floors that ×2 damage buys (past 100) | about **33** at the base rate; far fewer in the wall (floors 300–400) | `ln 2 / ln 1.021` |

The gold-to-damage rate went up from 0.61 to 0.82, so deep floors are cheaper than in the old notes. The wall and the
creep exist to push that back up.

---

## 2. What the sims show today

### Timeline (casual player, `node scripts/timeline.ts 300`)

103 ascents and 5 awakenings in 300 h; 30 of 32 companions met.

| Check | Target | Result |
|---|---|---|
| First wall | 5m–25m | ✅ 8m 21s |
| Deepest floor at 1 h | 30–60 | ✅ 55 |
| First ascent | 2h–4h30m | ✅ 2h 0m |
| Companions met by the first ascent | 16–19 | ❌ 24 |
| All 24 companions met | 6h–10h | ❌ never (the check predates the 32) |
| Longest wait for a new companion | under 2h | ❌ party not complete |
| Every card can drop (floor 321) | 5h–10h | ❌ 51h 43m |
| First awakening | 35h–45h | ❌ 47h 45m |
| Back to the last depth after awakening | under 45m | ❌ 3h 57m, 2h 59m, 3h 43m, 5h 15m, 46h 55m |
| Never too long without something new | 20m to 10h, 1h to 100h, 3h after | ❌ 43 too long, longest 7h 35m at 18h 30m |
| Deepest floor rises every 20 h | to 300 h | ❌ flat in hours 80–100 |
| Third layer opens | 100h–150h | not built yet |

Deepest floor by hour: 1h:55, 2h:100, then 101 through 10 h. Every 10 h after that: 20h:111, 30h:127, 40h:201,
50h:305, 60h:626, 70h:816, then flat at 816 to 100 h, 866 at 120 h, 911 at 150–210 h, 996 at 290 h.

Cards collected: 2 at 40 h, 75 at 80 h, 100 at 180 h.

### Ascents (`node scripts/ascents.ts 60`)

| Ascent | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ends at | 2h | 16h | 27h | 32h | 34h | 37h | 38h | 40h | 41h | 42h | 43h |
| Run length | 2h | 14h | 11h | 5.3h | 1.9h | 2.6h | 1.8h | 2.0h | 1.0h | 1.1h | 41m |
| Souls gained | 5 | 6 | 6 | 9 | 13 | 20 | 37 | 56 | 76 | 114 | 178 |
| Deepest floor | 101 | 111 | 111 | 121 | 126 | 159 | 201 | 221 | 245 | 279 | 311 |

Past ascent 30 runs are 5–20 minutes and each ascent roughly doubles the souls (ascent 62 holds 1.7 billion). Runs
lengthen again only at ascent 58 and later, at floors 690–816, where the wall is.

---

## 3. Diagnosis

### 3.1 The 5-soul start stalls the second and third ascents (high)

The first ascent pays 5 souls (+50%), the next two pay 6 and 6. Those few percent can't push through the HP the party
met at floor 100, so runs 2 and 3 take 25 h between them. It reads as a long stall right after the first ascent, then
a sudden sprint. The levers are what the first ascents pay (`levelsPerSoul`, boss souls), `soulPower`, and the HP from
floor 100.

### 3.2 Souls are close to linear in levels, so they run away (high)

`levelsPerSoul` ties souls to levels bought, and levels are cheap next to late gold (the cost grows ×1.07 while the
level bonus grows ×4 per 25). A strong party buys more levels per run, so souls grow roughly as fast as damage. That's
the 30+ ascent sprint. The wall (×1000 over floors 300–400, then ×1.04 per floor) is what brings runs back to hours
at ascent 58+. The balance rule is no longer the old `k ≈ (ln h − α·ln g) / ln g`, because souls aren't a power of gold
now. What matters is how many floors one doubling of souls buys against how many it costs.

### 3.3 The roster outgrew the checks (medium)

`timeline.ts` still describes a 24-companion roster. Targets to re-set: companions at the first ascent (now all 23
free ones, so 24 includes the Count at floor 95), an "all companions" check for 32, and the wait between the nine gated
ones. The last two gates (1500 and 3000) aren't reached inside 300 h at the current pace (996 deepest), so those two
never appear in the sim.

### 3.4 Content is spread unevenly across the 100 h middle (medium)

43 stretches are too long, and the pacing has dead spots: floor 101 held from 2 h to about 17 h, then 816 held from 70 h
to 100 h. Awakening at 47 h comes after the sprint, not on a schedule. The first stretch is the one players feel
first.

### 3.5 Only two systems scale forever (structural)

Unchanged from before: the level bonus and souls keep growing, while traits, trophies, party bonuses and upgrades are
fixed constants. Trophies are +1% each, so even 100 of them add at most ×2.

### 3.6 Numbers (low now, critical later)

`s.souls` is a JS `number`. At the current rate it holds 1.7e9 at 58 h. The sim hasn't been run far enough to see
overflow at 1e308, but it needs checking before long idle sessions or a faster economy.

---

## 4. Open questions for the pacing targets talk

- What should ascents 2–5 pay, and how long should the second run take (14 h now)?
- Should the roster check cover 32 companions or only the 23 free ones, and by when?
- Where should the 1500 and 3000 gates land in hours?
- Is awakening at 35–45 h still the target, now that it comes after a sprint?

---

## 5. Reproducing

```bash
node scripts/ascents.ts 60
node scripts/timeline.ts 300
```

Pass `TUNE='{"soulPower":0.2}'` (any `TUNE` key) to try another value. Both sims are seeded; the numbers above are
from one run on `dev` at 1df20dd.
