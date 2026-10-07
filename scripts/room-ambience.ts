/**
 * Renders the kid's room: no music, just the room. A faint warm room tone, the wall clock ticking, and now and then a
 * bird outside the window. A seamless loop, kept very quiet.
 *   node scripts/room-ambience.ts  ->  public/assets/music/room.mp3
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RATE = 44100;
const LOOP = 32;
const N = LOOP * RATE;
const out = new Float32Array(N * 2);
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Adds a mono sound into the loop at `start` seconds, panned (0 left … 1 right), wrapping round the end. */
function add(start: number, samples: Float32Array, pan: number) {
  const i0 = Math.round(start * RATE);
  for (let k = 0; k < samples.length; k++) {
    const i = (i0 + k) % N;
    out[i * 2] += samples[k] * (1 - pan) * 2;
    out[i * 2 + 1] += samples[k] * pan * 2;
  }
}

// Room tone: brown noise, low-passed until it's more felt than heard. The last second is crossfaded into the first so
// the loop has no seam.
const FADE = RATE;
const tone = new Float32Array(N + FADE);
let walk = 0;
let lp = 0;
for (let i = 0; i < tone.length; i++) {
  walk = (walk + (rand() * 2 - 1) * 0.02) * 0.995;
  lp += 0.02 * (walk - lp);
  tone[i] = lp;
}
for (let i = 0; i < N; i++) {
  const v = i < FADE ? tone[i] * (i / FADE) + tone[N + i] * (1 - i / FADE) : tone[i];
  out[i * 2] += v * 0.5;
  out[i * 2 + 1] += v * 0.5;
}

/** The clock on the wall: a short wooden click, the tock a little lower than the tick. */
function tick(pitch: number) {
  const n = Math.round(0.05 * RATE);
  const s = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const t = k / RATE;
    const env = Math.exp(-t * 140);
    s[k] = (Math.sin(2 * Math.PI * pitch * t) * 0.7 + Math.sin(2 * Math.PI * pitch * 1.5 * t) * 0.3 + (rand() * 2 - 1) * 0.25) * env * 0.05;
  }
  return s;
}
for (let sec = 0; sec < LOOP; sec++) add(sec, tick(sec % 2 ? 1900 : 2300), 0.3);

/** A small bird: a quick upward chirp with a flutter. */
function chirp(from: number, to: number, len: number) {
  const n = Math.round(len * RATE);
  const s = new Float32Array(n);
  let phase = 0;
  for (let k = 0; k < n; k++) {
    const t = k / n;
    const f = from + (to - from) * t + Math.sin(k / RATE * 2 * Math.PI * 38) * 120;
    phase += (2 * Math.PI * f) / RATE;
    const env = Math.sin(Math.PI * t) ** 2;
    s[k] = Math.sin(phase) * env * 0.025;
  }
  return s;
}
// A few short songs through the window, at different times round the loop.
for (const at of [3.2, 11.8, 19.5, 27.1]) {
  const notes = 2 + Math.floor(rand() * 3);
  const base = 2600 + rand() * 900;
  for (let k = 0; k < notes; k++) {
    const len = 0.05 + rand() * 0.05;
    add(at + k * (0.11 + rand() * 0.05), chirp(base * (0.9 + rand() * 0.2), base * (1.25 + rand() * 0.25), len), 0.8);
  }
}

let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
// Very quiet: it should be the absence of the dungeon you notice.
const gain = 0.22 / peak;

const pcm = Buffer.alloc(44 + out.length * 2);
pcm.write('RIFF', 0);
pcm.writeUInt32LE(36 + out.length * 2, 4);
pcm.write('WAVEfmt ', 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(RATE, 24);
pcm.writeUInt32LE(RATE * 4, 28);
pcm.writeUInt16LE(4, 32);
pcm.writeUInt16LE(16, 34);
pcm.write('data', 36);
pcm.writeUInt32LE(out.length * 2, 40);
for (let i = 0; i < out.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * gain)) * 32767), 44 + i * 2);

const wav = join(tmpdir(), 'deepheart-room.wav');
writeFileSync(wav, pcm);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '96k', 'public/assets/music/room.mp3']);
unlinkSync(wav);
console.log(`room.mp3: ${LOOP}s loop`);
