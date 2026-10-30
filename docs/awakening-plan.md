# Awakening: Plan

> As built in v0.7.0. Since v0.11.0 the awakening opens at floor 400, at about 20 played hours; the current numbers are
> in [scaling-analysis.md](scaling-analysis.md).

**Goal:** a second loop above ascending, built on Clicker Heroes' Transcension: a proven structure, with our own
names, numbers and fiction. Ascents carry the game to about floor 300; awakening takes over when they run out, and
every cycle after it goes deeper, faster. See also [expeditions-plan.md](expeditions-plan.md).

Numbers come from the casual bot on `dev` (`c17e219`, 1 hour of play a day) unless marked as targets.

---

## Why now, and why floor 300

| Ascent | Played | Deepest | Souls paid |
|---|---|---|---|
| 1 | 1.9h | 101 | 5 |
| 3 | 5.3h | 121 | 10 |
| 4 | 7.5h | 151 | 21 |
| 5 | 12.3h | 221 | 44 |
| 6 | 18.0h | 271 | 92 |
| 7 | 26.7h | 331 | 187 |

- Each ascent doubles your souls, but the gap between them grows from 2h to 9h.
- In one bot run ascents stopped after the 7th (floor 331, nothing to 60h); in another the 8th came at 39h, floor 401.
- Floor 300 arrives at about 22 played hours, about three weeks at an hour a day. Clicker Heroes opens Transcension at
  zone 300 too.
- The first companion reaches level 1000 at about 21h, so expeditions open in the same stretch (see Open questions).

> **Pacing caveat.** `scripts/timeline.ts` misses 6 of its own windows (every card can drop at 24h against a 5–10h
> goal). The targets date from before bosses became walls. Decide whether the targets or the game moves before tuning.

## The rule it has to follow

> **After an awakening, you're back at your old depth in 30–45 minutes, then you push past it.**

---

## How it maps

| Clicker Heroes | Deepheart |
|---|---|
| Hero souls | Souls |
| Ancients (kept through ascents) | Spirits |
| Transcension (zone 300) | Awakening (floor 300) |
| Ancient Souls | Bound souls |
| Outsiders | The Bound: the 8 zone bosses |
| Transcendent Power | A hidden stat: deeper champions pay more souls |

Our Spirits already line up with their Ancients: the Thinning is Kumawakamaru, the Wither is Bubos, the Hourglass is
Chronos, the Soulcaller is Atman, the Lure is Dora. That's why the Outsiders fit.

---

## Design

### 1. When you can awaken
- **First time:** once you've reached floor 300.
- **After that:** whenever it would pay at least 1 bound soul.
- **Where:** at the Heart, a station in the Keep's empty top-left room.

### 2. What it pays: bound souls
```
bound souls in all = floor(5 × log10(souls earned this cycle))
an awakening pays what's above your best so far
```
- "Souls earned this cycle": every soul ascents paid since the last awakening, spent or not.
- The bot's first cycle earns about 360 souls by floor 300–330: **12 bound souls**.
- Every 10× more souls in a cycle is 5 more. Because it's a log, holding off pays little more.
- **Unspent bound souls do nothing.** You always spend them all, so there's no hoarding decision.

### 3. The hidden stat (Transcendent Power, our version)
- Grows with every bound soul you've ever earned, toward a cap.
- Champion bosses pay more souls the deeper they are, compounding per champion floor:
  ```
  champion souls × (1 + p) ^ ((floor − 100) / 10)        // p from 0 toward a cap (theirs is 25%), set by bound souls ever
  ```
- This is how you rebuild fast: early-cycle ascents pay far more than they did the first time.
- Hidden: no name, no line in Stats.

### 4. What resets and what stays

| Resets | Stays |
|---|---|
| The run (gold, levels, traits, abilities) | Bound souls, the Bound, the hidden stat |
| Souls | Cards, trophies, curse rewards |
| Spirits | Deepest floor ever (companions stay unlocked) |
| Heartmarks | The Keep |

- **Every awakening is a free respec** of the Bound: all bound souls come back to spend.
- Awakening calls expeditions home, like ascending.

### 5. The Bound
The eight zone bosses, beaten and bound in the Heart's room. They stand there like Spirits; walk up and click one.
Costs are level + 1 bound souls (1, 2, 3…) except the Ogre Chieftain. Effects below are starting points to tune.

| Bound | Like | Effect per level |
|---|---|---|
| Ogre Chieftain ✓ | Phandoryss | +100% all damage. Always costs 1 |
| The Lich ✓ | Chor'gorloth | Spirits cost 5% less, compounding; max level 20 (−64%) |
| Pit Lord ✓ | Ponyboy | Champion souls ×(1 + level²): ×2, ×5, ×10, ×17… |
| Frost Troll ✓ | Borb | The Thinning can take 1 more kill off a floor (−10 → up to −15 of 20); max 5 |
| Troll Brute ✓ | K'Ariqua | The Wither works 25% better (boss health never below 10%) |
| The Elder Ent ✓ | Orphalas | The Hourglass works 25% better |
| Tomb Golem ✓ | Rhageist | The Soulcaller works 25% better (champion chance tops out at 100%) |
| The Thing Below ✓ | Sen-Akhan | The Lure works 25% better |

- "Works better" multiplies that Spirit's effect; the Spirit's own limits still hold (the Soulcaller can't pass 100%).
- Xyliqil (idle bonuses) has no Bound. Clicker Heroes' own wiki calls it practically useless.
- **The old Heart powers** (Heart of Fury, Soul Siphon) and **heartstones** are retired. Awakening is off on `main`, so
  no save has any: no migration.

### 7. The moment itself
- The first awakening is the arc's payoff: the Heart's room lights up and the eight bosses appear in it, bound.
- Later ones: the Heart pulses, the cycle starts, and the first floors fly by.

---

## Phases

### Phase 1: rules (`game.ts`, `data.ts`)
- `AWAKEN_ON` → true. `canAwaken`: floor 300, then only when it pays. `pendingBound` from the formula above.
- `SaveState`: `soulsThisCycle`, `boundBest`, `boundEver`, `bound` (levels).
- `awaken()`: reset souls, Spirits, Heartmarks and the run; respec the Bound; call expeditions home.
- `BOUND` replaces `HEART`; Spirits read their Bound multiplier; champion souls read the hidden stat.

### Phase 2: the Keep
- The top-left room becomes the Heart's room: the Heart station, the eight Bound on pedestals (hidden before the first
  awakening).
- Awaken confirm: what resets, what stays, the bound souls it pays.

### Phase 3: bot and timeline
- Bot: awaken once stalled past the floor and the payout has stopped growing; buy the Bound by a simple priority.
- Timeline checks: first awakening 20h–26h; **back to the previous depth within 45 min**; a new best every cycle.
- Tune the hidden stat's cap, the Bound's numbers and costs on 3 seeds.

### Phase 4: wiki
- Awakening page, the Bound table, bound souls in the souls page.

---

## Decided (2026-10-25)
- Mirror Clicker Heroes' Transcension structure; our own names, numbers and fiction.
- Awakening **resets Spirits**.
- The currency is **bound souls**.
- The Bound are **the 8 zone bosses**, each mirroring an Outsider (Xyliqil dropped); all eight effects approved.

- First awakening at **floor 300**.
- The champion-souls stat stays **hidden**: no name, no Stats line.
- No wake-up gifts (2026-10-26): Buy all is gone (auto-buy covers it), and no auto-ascend.

---

## Built (2026-10-25, uncommitted on `dev`)
- Rules, the Bound, the Heart's room in the Keep, the Heart panel (the Bound as cards like the Spirits', shadows before
  the first awakening) and awaken confirm (with "Respec the Bound"), the bot, timeline checks, wiki page.
- The Ogre's per-level bonus is `TUNE.ogre` (1 = +100%, Phandoryss's size). At +1,000% the rebuild is ~95 min.
- Heartstones, Heart of Fury and Soul Siphon are gone. Old saves keep harmless leftover fields.
- **Tuning found (3 seeds, casual bot):**
  - First awakening at 18h–23h.
  - Back to the last depth: 2.5h–6h played, not 45 min. A new cycle's first run starts from zero souls, like a new
    game. What helps most is spending early bound souls on the Ogre Chieftain (the bot does: the Pit Lord while a level
    costs at most half of what's left, the rest on the Ogre), which is Clicker Heroes' answer too (Phandoryss).
  - Depth climbs fast after the first awakenings (300 → ~950 by 40h), then levels off around 1,200–1,250.
- Open: whether 45 min is the right target; whether the climb past 400 (where the content ends) is too fast.
