/**
 * Tiny Web Audio sound player. Files live in /assets/sfx (see scripts/build-assets.sh).
 * Sound effects are fetched up front; music tracks are fetched only when first needed
 * (one per zone, so there's no point downloading all of them on a phone).
 */
const NAMES = [
  'hit0', 'hit1', 'hit2', 'hit3', 'hit4', 'crit0', 'crit1', 'crit2', 'crit3', 'crit4',
  'hurt0', 'hurt1', 'hurt2', 'hurt3', 'hurt4', 'step0', 'step1', 'step2', 'step3', 'step4',
  'mega', 'kill', 'chest', 'coins', 'equip', 'salvage', 'click', 'toggle', 'open', 'close',
  'levelup', 'descend', 'death', 'drop1', 'drop2', 'drop3', 'drop4', 'awaken', 'boss', 'bosskill',
] as const;
export type SfxName = (typeof NAMES)[number];

const TRACKS = ['halls', 'crypts', 'warrens', 'tomb', 'rotting', 'grove', 'demon', 'frozen', 'boss', 'boss2', 'vault'] as const;
export type Track = (typeof TRACKS)[number];
const MUSIC_VOL = 0.45;
const FADE = 1.2;

export interface PlayOpts {
  vol?: number;
  /** Random pitch spread, e.g. 0.08 = ±8%. Keeps repeated hits from sounding robotic. */
  jitter?: number;
  rate?: number;
}

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private raw = new Map<SfxName, ArrayBuffer>();
  private buffers = new Map<SfxName, AudioBuffer>();
  private last = new Map<SfxName, number>();
  private _muted = false;
  /** Has the silent unlock sound been played yet (iOS)? */
  private primed = false;
  private musicGain: GainNode | null = null;
  private musicRaw = new Map<Track, ArrayBuffer>();
  private musicBuf = new Map<Track, AudioBuffer>();
  private current: { name: Track; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wanted: Track | null = null;
  private _musicOn = true;
  private sfxVol = 0.8;
  private musicVol = 0.7;

  private musicBase: string | undefined;
  private fetching = new Set<Track>();

  constructor(base: string, musicBase?: string) {
    this.musicBase = musicBase;
    for (const n of NAMES) {
      fetch(`${base}/${n}.mp3`).then((r) => r.arrayBuffer()).then((b) => {
        this.raw.set(n, b);
        if (this.ctx) this.decode(n);
      }).catch(() => { /* missing sound: play() just no-ops */ });
    }
    // Browsers only let audio start inside a user gesture, and iOS only counts some of them
    // (touch *end* / click, not touch start). Listen to all of them, and keep listening:
    // phones can suspend audio again (calls, other apps) and a later tap brings it back.
    const unlock = () => {
      this.start();
      const ctx = this.ctx;
      if (!ctx) return;
      if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {});
      if (!this.primed) {
        // A silent one-sample sound played inside the gesture fully wakes iOS audio.
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
        this.primed = true;
      }
    };
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, { passive: true });
    // Go quiet while the tab is in the background; pick the music back up on return.
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    });
  }

  get muted() {
    return this._muted;
  }

  set muted(m: boolean) {
    this._muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.sfxVol;
    this.applyMusicGain();
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVol = sfx;
    this.musicVol = music;
    if (this.master) this.master.gain.value = this._muted ? 0 : sfx;
    this.applyMusicGain();
  }

  get musicOn() {
    return this._musicOn;
  }

  set musicOn(on: boolean) {
    this._musicOn = on;
    this.applyMusicGain();
  }

  private applyMusicGain() {
    if (!this.musicGain || !this.ctx) return;
    this.musicGain.gain.setTargetAtTime(this._muted || !this._musicOn ? 0 : this.musicVol, this.ctx.currentTime, 0.15);
  }

  /** Download a track the first time it's asked for. */
  private fetchTrack(t: Track) {
    if (!this.musicBase || this.fetching.has(t)) return;
    this.fetching.add(t);
    fetch(`${this.musicBase}/${t}.mp3`).then((r) => r.arrayBuffer()).then((b) => {
      this.musicRaw.set(t, b);
      if (this.ctx) this.decodeTrack(t);
    }).catch(() => this.fetching.delete(t)); // try again next time it's wanted
  }

  private decodeTrack(t: Track) {
    const raw = this.musicRaw.get(t);
    if (!raw || !this.ctx || this.musicBuf.has(t)) return;
    this.ctx.decodeAudioData(raw.slice(0)).then((buf) => {
      this.musicBuf.set(t, buf);
      if (this.wanted === t && this.current?.name !== t) this.music(t);
    }).catch(() => {});
  }

  /** Switch the looping background track, crossfading from whatever is playing. */
  music(name: Track) {
    this.wanted = name;
    // Fetch on first use (not while music is switched off).
    if (this._musicOn && !this.musicRaw.has(name)) this.fetchTrack(name);
    if (!this.ctx || !this.musicGain || this.current?.name === name) return;
    const buf = this.musicBuf.get(name);
    if (!buf) return;
    const now = this.ctx.currentTime;
    if (this.current) {
      const old = this.current;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + FADE);
      old.src.stop(now + FADE + 0.05);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(MUSIC_VOL, now + FADE);
    src.connect(gain).connect(this.musicGain);
    src.start(now);
    this.current = { name, src, gain };
  }

  private start() {
    if (this.ctx) return;
    // iPhones mute web audio when the ring/silent switch is on unless the page says it's media playback.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._muted ? 0 : this.sfxVol;
    // Gentle limiter so a big multi-hit doesn't clip.
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 6;
    comp.connect(this.ctx.destination);
    this.master.connect(comp);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this._muted || !this._musicOn ? 0 : this.musicVol;
    this.musicGain.connect(comp);
    for (const n of this.raw.keys()) this.decode(n);
    for (const t of this.musicRaw.keys()) this.decodeTrack(t);
  }

  private decode(n: SfxName) {
    const raw = this.raw.get(n);
    if (!raw || !this.ctx || this.buffers.has(n)) return;
    this.ctx.decodeAudioData(raw.slice(0)).then((buf) => this.buffers.set(n, buf)).catch(() => {});
  }

  play(name: SfxName, o: PlayOpts = {}) {
    if (!this.ctx || !this.master || this._muted || document.hidden) return;
    const buf = this.buffers.get(name);
    if (!buf) return;
    const now = this.ctx.currentTime;
    if (now - (this.last.get(name) ?? -1) < 0.045) return; // don't stack identical sounds
    this.last.set(name, now);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() * 2 - 1) * (o.jitter ?? 0));
    const g = this.ctx.createGain();
    g.gain.value = o.vol ?? 1;
    src.connect(g).connect(this.master);
    src.start();
  }

  /** One of `${prefix}0..4`, chosen at random. */
  vary(prefix: 'hit' | 'crit' | 'hurt' | 'step', o: PlayOpts = {}) {
    this.play(`${prefix}${Math.floor(Math.random() * 5)}` as SfxName, { jitter: 0.08, ...o });
  }
}
