/**
 * Synthesizes the card drop sounds: a quick retro "you got something" arpeggio (C6 E6 G6 C7 in square waves), and for
 * gold cards the same arpeggio answered a fifth higher a beat later, with high glints on top. Also the Goblin Vault's
 * chests: a soft pop and a rising sparkle of coin chimes, and for a Rainbow Chest a jackpot shower.
 *   node scripts/card-sound.ts  ->  public/assets/sfx/card.mp3, cardgold.mp3, treasure.mp3, jackpot.mp3
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RATE = 44100;
const TAU = Math.PI * 2;
const ARPEGGIO = [1047, 1319, 1568, 2093];

function square(out: Float32Array, t0: number, f: number, len: number, vol: number) {
  const i0 = Math.round(t0 * RATE);
  for (let k = 0; k < len * RATE && i0 + k < out.length; k++) {
    const t = k / RATE;
    const env = Math.min(1, t / 0.003) * Math.exp(-t * 7);
    out[i0 + k] += (Math.sin(TAU * f * t) > 0 ? 1 : -1) * env * vol * 0.25;
  }
}

/** The four notes, the last one left to ring. `p` shifts the pitch. */
function itemGet(out: Float32Array, t0: number, p: number, vol: number) {
  ARPEGGIO.forEach((f, k) => square(out, t0 + k * 0.055, f * p, k === ARPEGGIO.length - 1 ? 0.5 : 0.08, vol));
}

function ping(out: Float32Array, t0: number, f: number, vol: number) {
  const i0 = Math.round(t0 * RATE);
  for (let k = 0; i0 + k < out.length; k++) {
    const t = k / RATE;
    const env = Math.min(1, t / 0.001) * Math.exp(-t * 9);
    if (env < 1e-4) break;
    out[i0 + k] += Math.sin(TAU * f * t) * env * vol;
  }
}

/** A soft "pop" as a lid flies open: a low thump under a short puff of noise. */
function pop(out: Float32Array, t0: number, vol: number) {
  const i0 = Math.round(t0 * RATE);
  let lp = 0;
  for (let k = 0; k < 0.12 * RATE && i0 + k < out.length; k++) {
    const t = k / RATE;
    lp += ((Math.random() * 2 - 1) - lp) * 0.25;
    out[i0 + k] += (Math.sin(TAU * (190 - t * 600) * t) * Math.exp(-t * 40) + lp * Math.exp(-t * 60) * 0.6) * vol;
  }
}

/** Coin chimes rising: bright sine pings up a major arpeggio, with a few random glints above. */
function sparkle(out: Float32Array, t0: number, p: number, vol: number, glints: number) {
  [1568, 1976, 2349, 3136].forEach((f, k) => ping(out, t0 + k * 0.045, f * p, vol * (0.7 + k * 0.1)));
  for (let k = 0; k < glints; k++) ping(out, t0 + 0.05 + Math.random() * 0.35, 3500 + Math.random() * 3000, vol * 0.25);
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
  room(out, 0.12);
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

render('card', 1.2, (out) => itemGet(out, 0, 1, 1));
render('treasure', 0.9, (out) => {
  pop(out, 0, 0.9);
  sparkle(out, 0.03, 1, 0.5, 5);
});
render('jackpot', 2.2, (out) => {
  pop(out, 0, 1);
  itemGet(out, 0.04, 1, 0.8);
  sparkle(out, 0.2, 1.335, 0.5, 0);
  // A long shower of coin glints.
  for (let k = 0; k < 40; k++) ping(out, 0.3 + Math.random() * 1.4, 2500 + Math.random() * 4000, 0.12);
});
render('cardgold', 1.6, (out) => {
  itemGet(out, 0, 1, 1);
  itemGet(out, 0.14, 1.498, 0.8);
  [2, 2.52, 3, 3.78].forEach((r, k) => ping(out, 0.32 + k * 0.06, 1760 * r, 0.18));
});
