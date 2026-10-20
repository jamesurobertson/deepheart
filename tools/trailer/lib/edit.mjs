// Cutting takes into a trailer: every segment a whole number of bars of the music, shots trimmed from their
// recordings (frames stamped with game time), captions laid over, then the music and a few game sounds.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TAKES } from './stage.mjs';
import { renderCard } from './captions.mjs';

export const BAR = 1.3792;
export const BEAT = BAR / 4;
const FIRST_BEAT = 0.196;
const FPS = 60;
const REPO = new URL('../../../', import.meta.url).pathname;
const MUSIC = `${REPO}assets-src/chiptune-adventures/Juhani Junkala [Chiptune Adventures] 3. Boss Fight.ogg`;
const SFX = `${REPO}public/assets/sfx`;

const ffmpeg = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const takeDir = (take) => `${TAKES}${take}`;
const framesOf = (take) => JSON.parse(fs.readFileSync(`${takeDir(take)}/frames.json`, 'utf8'));
const logOf = (take) => JSON.parse(fs.readFileSync(`${takeDir(take)}/log.json`, 'utf8'));

/** A moment in a take, found in its log when the cut is made: when `key` first shows up (`starts`) or goes away after
 *  showing (`ends`), plus `offset` seconds. A shot's `from` or a sound's `at` can be one of these or plain seconds. */
export const starts = (key, offset = 0) => ({ starts: key, offset });
export const ends = (key, offset = 0) => ({ ends: key, offset });

export function timeIn(take, at) {
  if (typeof at === 'number') return at;
  const log = logOf(take);
  let seen = false;
  for (const entry of log) {
    if (at.starts && entry[at.starts]) return entry.t + at.offset;
    seen = seen || entry[at.ends];
    if (at.ends && seen && !entry[at.ends]) return entry.t + at.offset;
  }
  throw new Error(`${take}: ${at.starts ?? at.ends} never ${at.starts ? 'showed' : 'ended'}`);
}

/** `seconds` of a take from `start`, as a constant 60 fps clip. */
function clip(take, start, seconds, out) {
  const frames = framesOf(take);
  const list = `${out}.txt`;
  const lines = [];
  for (let k = 0; k + 1 < frames.length; k++) {
    const [a, b] = [frames[k], frames[k + 1]];
    if (b.t < start || a.t > start + seconds + 0.1) continue;
    lines.push(`file '${takeDir(take)}/${a.file}'`, `duration ${(b.t - a.t).toFixed(6)}`);
  }
  lines.push(`file '${takeDir(take)}/${frames.at(-1).file}'`);
  fs.writeFileSync(list, lines.join('\n') + '\n');
  const first = frames.find((f, k) => frames[k + 1]?.t >= start).t;
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `scale=1920:1080:flags=lanczos,fps=${FPS},trim=start=${(start - first).toFixed(4)}:duration=${seconds.toFixed(4)},setpts=PTS-STARTPTS`,
    '-c:v', 'libx264', '-crf', '10', '-preset', 'medium', '-pix_fmt', 'yuv420p', out]);
}

/** A contact sheet of a take, a frame every `every` seconds (left to right, top to bottom), to pick where a shot
 *  should start. */
export function sheet(take, out, every = 0.5) {
  const picks = [];
  let next = 0;
  for (const f of framesOf(take)) {
    if (f.t >= next) {
      picks.push(f);
      next += every;
    }
  }
  const inputs = picks.flatMap((f) => ['-i', `${takeDir(take)}/${f.file}`]);
  const scaled = picks.map((_, k) => `[${k}:v]scale=480:-1[v${k}];`).join('');
  const layout = picks.map((_, k) => `${(k % 4) * 480}_${Math.floor(k / 4) * 270}`).join('|');
  ffmpeg([...inputs, '-filter_complex', `${scaled}${picks.map((_, k) => `[v${k}]`).join('')}xstack=inputs=${picks.length}:layout=${layout}:fill=black`, '-frames:v', '1', '-q:v', '3', out]);
}

/** One segment: its shots back to back, blurred under a title card or with a caption over it. */
async function segment(work, k, seg) {
  const parts = seg.shots.map((shot, j) => {
    const part = `${work}/s${String(k).padStart(2, '0')}_${j}.mp4`;
    clip(shot.take, timeIn(shot.take, shot.from), shot.bars * BAR, part);
    return part;
  });
  const bars = seg.shots.reduce((sum, shot) => sum + shot.bars, 0);
  const seconds = bars * BAR;
  const inputs = parts.flatMap((p) => ['-i', p]);
  let graph = parts.map((_, j) => `[${j}:v]`).join('') + `concat=n=${parts.length}:v=1[v0];`;
  if (seg.blur) graph += '[v0]boxblur=14:2,eq=brightness=-0.06[v0];';
  const card = seg.card ?? (seg.caption && { caption: seg.caption });
  if (card) {
    inputs.push('-framerate', String(FPS), '-i', `${await renderCard(card, bars)}/f%05d.png`);
    graph += `[v0][${parts.length}:v]overlay=eof_action=pass:format=auto[v1]`;
  } else {
    graph += '[v0]null[v1]';
  }
  const out = `${work}/seg${String(k).padStart(2, '0')}.mp4`;
  ffmpeg([...inputs, '-filter_complex', graph, '-map', '[v1]', '-t', seconds.toFixed(4), '-r', String(FPS),
    '-c:v', 'libx264', '-crf', '10', '-preset', 'medium', '-pix_fmt', 'yuv420p', out]);
  return { out, seconds };
}

/** Cut `segments` (see cuts/) into `out`: video, music from its first downbeat, and the shots' sounds. */
export async function cut(name, segments, out) {
  const work = new URL(`../out/cuts/${name}/`, import.meta.url).pathname;
  fs.mkdirSync(work, { recursive: true });
  const made = [];
  const sounds = [];
  let t = 0;
  for (const [k, seg] of segments.entries()) {
    const { out: file, seconds } = await segment(work, k, seg);
    made.push(file);
    // A sound sits at its moment in the take, wherever the shot landed in the cut.
    let shotAt = t;
    for (const shot of seg.shots) {
      const from = timeIn(shot.take, shot.from);
      for (const s of shot.sounds ?? []) sounds.push({ ...s, at: shotAt + timeIn(shot.take, s.at) - from });
      shotAt += shot.bars * BAR;
    }
    console.log(`segment ${k}: ${seconds.toFixed(2)}s (${seg.shots.map((s) => s.take).join(', ')})`);
    t += seconds;
  }
  const total = t;
  fs.writeFileSync(`${work}/segments.txt`, made.map((f) => `file '${f}'`).join('\n') + '\n');

  const inputs = ['-f', 'concat', '-safe', '0', '-i', `${work}/segments.txt`, '-ss', String(FIRST_BEAT), '-i', MUSIC];
  const mix = [`[1:a]atrim=duration=${total.toFixed(4)},afade=t=out:st=${(total - 1.4).toFixed(3)}:d=1.4,volume=1.0[m]`];
  const labels = ['[m]'];
  sounds.forEach((s, n) => {
    inputs.push('-i', `${SFX}/${s.sfx}.mp3`);
    const delay = Math.round(s.at * 1000);
    mix.push(`[${n + 2}:a]adelay=${delay}|${delay},volume=${s.volume ?? 0.7}[x${n}]`);
    labels.push(`[x${n}]`);
  });
  mix.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  ffmpeg([...inputs, '-filter_complex', mix.join(';'), '-map', '0:v', '-map', '[a]', '-t', total.toFixed(4),
    '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', out]);
  console.log(`${out}: ${total.toFixed(2)}s`);
}
