/**
 * Synthesizes the card drop sounds: a bright, glassy "tink" (a struck metal bar's inharmonic ring with a shimmer),
 * and a double strike with a high sparkle for gold cards.
 *   node scripts/card-sound.ts  ->  public/assets/sfx/card.mp3, public/assets/sfx/cardgold.mp3
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RATE = 44100;
let seed = 3;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** A struck bar's partials (frequency ratio, loudness, how much faster it dies away than the fundamental). */
const PARTIALS: [number, number, number][] = [[1, 1, 1], [2, 0.3, 1.6], [2.756, 0.45, 2.4], [5.404, 0.22, 4.5], [8.933, 0.08, 8]];

function strike(out: Float32Array, start: number, freq: number, vol: number, decay: number) {
  const i0 = Math.round(start * RATE);
  for (const [ratio, amp, fast] of PARTIALS) {
    const f = freq * ratio;
    // Two copies a hair apart beat against each other: the shimmer in the ring.
    for (const detune of [-1.2, 1.2]) {
      for (let k = 0; i0 + k < out.length; k++) {
        const t = k / RATE;
        const env = Math.min(1, t / 0.0015) * Math.exp(-t * decay * fast);
        if (env < 1e-4 && t > 0.01) break;
        out[i0 + k] += Math.sin(2 * Math.PI * (f + detune * ratio) * t) * env * amp * vol * 0.5;
      }
    }
  }
  // The tap itself: a few milliseconds of bright noise.
  let hp = 0;
  let prev = 0;
  for (let k = 0; k < RATE * 0.004; k++) {
    const x = rand() * 2 - 1;
    hp = 0.6 * (hp + x - prev);
    prev = x;
    out[i0 + k] += hp * vol * 0.35 * (1 - k / (RATE * 0.004));
  }
}

/** A small, bright room: four combs into the dry signal. */
function room(buf: Float32Array, mix: number) {
  const combs = [1557, 1617, 1491, 1422].map((n) => ({ line: new Float32Array(n), at: 0 }));
  for (let i = 0; i < buf.length; i++) {
    let y = 0;
    for (const c of combs) {
      const v = c.line[c.at];
      c.line[c.at] = buf[i] + v * 0.72;
      c.at = (c.at + 1) % c.line.length;
      y += v;
    }
    buf[i] += y * 0.25 * mix;
  }
}

function render(name: string, seconds: number, build: (out: Float32Array) => void) {
  const out = new Float32Array(Math.round(seconds * RATE));
  build(out);
  room(out, 0.22);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const pcm = Buffer.alloc(44 + out.length * 2);
  pcm.write('RIFF', 0);
  pcm.writeUInt32LE(36 + out.length * 2, 4);
  pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(RATE, 24);
  pcm.writeUInt32LE(RATE * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36);
  pcm.writeUInt32LE(out.length * 2, 40);
  for (let i = 0; i < out.length; i++) pcm.writeInt16LE(Math.round((out[i] / peak) * 0.9 * 32767), 44 + i * 2);
  const wav = join(tmpdir(), `deepheart-${name}.wav`);
  writeFileSync(wav, pcm);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-af', 'loudnorm=I=-17:TP=-1.5,aresample=44100', '-ac', '1', '-b:a', '96k', `public/assets/sfx/${name}.mp3`]);
  unlinkSync(wav);
  console.log(`${name}.mp3`);
}

// A6: high and clear, like a coin of something precious hitting stone.
render('card', 1.8, (out) => strike(out, 0, 1760, 1, 3.2));
// Gold: the tink, a higher answer a beat later (E7), and a scatter of sparkle on top.
render('cardgold', 2.4, (out) => {
  strike(out, 0, 1760, 1, 3);
  strike(out, 0.12, 2637, 0.85, 2.6);
  [3136, 3520, 4186].forEach((f, k) => strike(out, 0.3 + k * 0.07, f, 0.25, 6));
});
