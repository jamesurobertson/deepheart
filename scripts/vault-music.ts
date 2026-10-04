/**
 * Renders the Goblin Vault's music: a slow, soft loop (music box over a warm pad) in F major.
 *   node scripts/vault-music.ts  ->  public/assets/music/vault.mp3
 * Two passes of the loop are rendered and the second kept, so echo tails wrap round and it loops seamlessly.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RATE = 44100;
const BPM = 68;
const BEAT = 60 / BPM;
const BARS_PER_CHORD = 2;
// MIDI notes: Fmaj7, Dm9, Bbmaj7, C6.
const CHORDS = [
  { root: 41, tones: [53, 57, 60, 64] },
  { root: 38, tones: [50, 53, 57, 60, 64] },
  { root: 46, tones: [58, 62, 65, 69] },
  { root: 48, tones: [60, 64, 67, 69] },
];
const LOOP = CHORDS.length * BARS_PER_CHORD * 4 * BEAT;
const N = Math.round(LOOP * RATE);
const out = new Float32Array(N * 2);

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Adds one note into the two-loop buffer. */
function note(start: number, len: number, midi: number, vol: number, kind: 'bell' | 'pad' | 'bass') {
  const f = hz(midi);
  const i0 = Math.round(start * RATE);
  const tail = kind === 'bell' ? 2.4 : kind === 'pad' ? 1.6 : 0.8;
  const n = Math.round((len + tail) * RATE);
  for (let k = 0; k < n; k++) {
    const t = k / RATE;
    let env: number;
    let v: number;
    if (kind === 'bell') {
      // Music box: bright attack, long ringing decay, a quiet octave partial for sparkle.
      env = Math.min(1, t / 0.004) * Math.exp(-t * 2.2);
      v = Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 6);
    } else if (kind === 'pad') {
      // Slow swell and release; two slightly detuned sines for a soft chorus.
      const attack = Math.min(1, t / 1.4);
      const release = t > len ? Math.max(0, 1 - (t - len) / tail) : 1;
      env = attack * release;
      v = 0.5 * Math.sin(2 * Math.PI * f * 1.002 * t) + 0.5 * Math.sin(2 * Math.PI * f * 0.998 * t);
    } else {
      env = Math.min(1, t / 0.02) * (t > len ? Math.max(0, 1 - (t - len) / tail) : 1) * Math.exp(-t * 0.6);
      v = Math.sin(2 * Math.PI * f * t);
    }
    const i = (i0 + k) % N;
    const pan = kind === 'bell' ? 0.35 + 0.3 * rand() : 0.5;
    out[i * 2] += v * env * vol * (1 - pan) * 2;
    out[i * 2 + 1] += v * env * vol * pan * 2;
  }
}

const barLen = 4 * BEAT;
CHORDS.forEach((chord, c) => {
  const t0 = c * BARS_PER_CHORD * barLen;
  const len = BARS_PER_CHORD * barLen;
  for (const tone of chord.tones.slice(0, 3)) note(t0, len - 0.3, tone - 12, 0.05, 'pad');
  for (let bar = 0; bar < BARS_PER_CHORD; bar++) {
    note(t0 + bar * barLen, barLen * 0.9, chord.root - 12, 0.09, 'bass');
    note(t0 + bar * barLen + 2 * BEAT, barLen * 0.4, chord.root - 5, 0.05, 'bass');
  }
  // Up-and-down arpeggio in eighths, two octaves up, with the odd note left out so it breathes.
  const arp = [...chord.tones, ...chord.tones.slice(1, -1).reverse()].map((m) => m + 12);
  for (let e = 0; e < BARS_PER_CHORD * 8; e++) {
    if (rand() < 0.12) continue;
    const swing = e % 2 ? 0.03 : 0;
    note(t0 + e * (BEAT / 2) + swing, BEAT / 2, arp[e % arp.length], 0.07 + 0.03 * rand(), 'bell');
  }
  // A high sparkle now and then from the pentatonic scale.
  for (let k = 0; k < 3; k++) if (rand() < 0.6) note(t0 + rand() * len, 0.5, [77, 79, 81, 84, 86][Math.floor(rand() * 5)], 0.035, 'bell');
});

// Dotted-eighth echo, darkened a little each repeat, then a light Schroeder-style room.
function echo(buf: Float32Array, delaySec: number, feedback: number, mix: number) {
  const d = Math.round(delaySec * RATE);
  const wet = new Float32Array(buf.length);
  let lpL = 0;
  let lpR = 0;
  // Two passes round the loop so the echoes settle into a seamless cycle.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < N; i++) {
      const j = (i - d + N) % N;
      lpL += 0.35 * (wet[j * 2] - lpL);
      lpR += 0.35 * (wet[j * 2 + 1] - lpR);
      wet[i * 2] = buf[i * 2] + lpR * feedback;
      wet[i * 2 + 1] = buf[i * 2 + 1] + lpL * feedback;
    }
  }
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] * (1 - mix) + wet[i] * mix;
}
function room(buf: Float32Array, mix: number) {
  const combs = [1557, 1617, 1491, 1422].map((n) => ({ n, line: new Float32Array(n), at: 0 }));
  const wet = new Float32Array(buf.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < N; i++) {
      const x = (buf[i * 2] + buf[i * 2 + 1]) * 0.5;
      let y = 0;
      for (const c of combs) {
        const v = c.line[c.at];
        c.line[c.at] = x + v * 0.8;
        c.at = (c.at + 1) % c.n;
        y += v;
      }
      wet[i * 2] = y * 0.25;
      wet[i * 2 + 1] = y * 0.25;
    }
  }
  for (let i = 0; i < buf.length; i++) buf[i] += wet[i] * mix;
}
echo(out, BEAT * 0.75, 0.38, 0.35);
room(out, 0.18);

let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
// Quieter than the zone tracks: the vault should feel like a breather.
const gain = 0.26 / peak;

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

const wav = join(tmpdir(), 'deepheart-vault.wav');
writeFileSync(wav, pcm);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '128k', 'public/assets/music/vault.mp3']);
unlinkSync(wav);
console.log(`vault.mp3: ${LOOP.toFixed(1)}s loop`);
