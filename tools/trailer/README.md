# Trailer tools

Records gameplay scenes from the dev build in slow motion, frame by frame, and cuts them to the music into a 1920×1080,
60 fps trailer.

```
npm install                 # once, here (and npm install at the repo root for the game)
npm run serve               # the game's dev server on :5199, leave it running
node record.mjs opening     # record a scene into out/takes/
node sheet.mjs opening      # contact sheet of a take, to pick where a shot starts
node cut.mjs v2             # cut cuts/v2.mjs into out/v2.mp4
```

Needs Google Chrome and ffmpeg. Everything under `out/` (takes, renders, cuts) is ignored by git.

## How it fits together

- `scenes/<name>.mjs`: one scene each. It stages the game (party, floor, gold), then films a take with `film()`,
  steering the cursor frame by frame. A take's `log.json` records what was on screen (boss up, goblin running, card
  revealed), so a cut can find moments like "when the boss died" without hand timing.
- `cuts/parts.mjs`: the trailer's building blocks. Each part is a whole number of bars: its shots (take, where to
  start, how many bars, optional sounds) and a caption or title card.
- `cuts/v1.mjs`, `cuts/v2.mjs`...: a cut is a list of parts. A new version can reuse the last one and swap a part.
- `lib/`: the browser and time warp (`browser.mjs`), staging helpers (`stage.mjs`), captions (`captions.mjs`, rendered
  on demand and cached) and the edit (`edit.mjs`).

## Swapping a scene

1. Write `scenes/<new>.mjs` (copy the closest one) and record it: `node record.mjs <new>`.
2. Look at `node sheet.mjs <new>` and add a part for it in `cuts/parts.mjs`.
3. Make a cut that uses it, e.g. `cuts/v3.mjs`: `export default v2.map((part) => (part === p.boss ? p.newBoss : part));`
4. `node cut.mjs v3`. The older cuts still build, so versions can be compared side by side.

Adding a scene is the same, with the part inserted into the list instead of swapped. Captions take the length of
their part, and sounds stay on their moment in the take wherever the part moves.

## Staging notes

- `window.__small({ look, perMonster, gold })` (from `prepare()`) gives the trailer's mid-game party on floor `look`,
  with monster health rescaled so each one takes `perMonster` seconds and every number stays small.
- The floor panel, toasts and tips are hidden, and the upgrade shelf shows two at most.
- Takes run at 0.12× speed (the clock, timers and CSS animations together), so the frame rate is smooth whatever
  the machine.
- The recording viewport is 1280×720 (scaled ×1.5), the game's compact layout with the floor map centred.
