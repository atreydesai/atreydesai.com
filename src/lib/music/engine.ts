// The arcade's band: a few small synth voices and a bar scheduler that
// arranges the songbook (`./songs`) live. It knows nothing about windows,
// timers, or the page; give it any BaseAudioContext (an OfflineAudioContext
// renders it the same way) and call `scheduleUntil` ahead of the clock.
//
// Every note is one oscillator and one gain into a shared instrument bus, so
// notes stay cheap. Buses: keys, bass, lead, arp, drums -> mix -> soft
// limiter -> bus (the fader sfx.ts rides) -> filter -> destination, with a
// short room and a tempo-synced echo returning into the mix. Keys, bass, and
// arp reach the mix through a sidechain pump, idle unless a song pumps.

import { BARS_PER_SONG, barSeconds } from "$lib/arcade/stab-engine.js";
import { SONGS } from "./songs";
import type { KeysVoice, LeadVoice, MusicPhase, Song } from "./songs";
import {
  BEATS_PER_BAR,
  SECTION_BARS,
  STEPS_PER_BAR,
  barSlot,
  bassMidi,
  chordInBar,
  hitBeats,
  midiToHz,
  parseSong,
  pumpShape,
  stepBeat,
} from "./notation";
import type { Hit, MusicForm, ParsedChord } from "./notation";

// --- Mix --------------------------------------------------------------------
//
// Every level in the music lives here. `level` is the peak gain of one note
// (or drum hit) at normal velocity; `phase` trims each instrument per phase so
// the overall loudness holds while the arrangement thins or fills out.

export const MIX = {
  level: {
    keys: 0.14,
    bass: 0.16,
    lead: 0.3,
    arp: 0.18,
    kick: 0.34,
    kickClick: 0.03,
    snare: 0.34,
    snareTick: 0.08,
    rim: 0.24,
    rimNoise: 0.2,
    hat: 0.22,
    open: 0.17,
    shaker: 0.21,
    /** The club kit's kick, deeper and longer than `kick`. */
    clubKick: 0.425,
    /** Each of the clap's three bursts, and the tail after them. */
    clap: 0.4,
    clapTail: 0.3,
  },
  /** What plays the chords, trimmed like the lead voices. */
  keysVoice: {
    rhodes: 1,
    saw: 0.75,
  } satisfies Record<KeysVoice, number>,
  /** Lead voices differ in how loud the same peak sounds. */
  leadVoice: {
    marimba: 1.2,
    glass: 0.72,
    kalimba: 0.97,
    whistle: 0.42,
    vibes: 0.68,
    reed: 0.58,
    square: 0.34,
    pluck: 0.8,
    saw: 0.45,
    acid: 1,
  } satisfies Record<LeadVoice, number>,
  phase: {
    opening: { all: 1.1, keys: 1.1, bass: 1.05, lead: 0.85, arp: 1, drums: 0.7 },
    steady: { all: 0.97, keys: 1, bass: 1, lead: 1, arp: 1, drums: 1 },
    rush: { all: 0.92, keys: 0.95, bass: 1, lead: 1, arp: 1, drums: 1 },
  } satisfies Record<
    MusicPhase,
    { all: number; keys: number; bass: number; lead: number; arp: number; drums: number }
  >,
  /** Where the keys' low-pass sits in each phase (Hz). */
  keysCutoff: { opening: 1_500, steady: 2_400, rush: 3_400 } satisfies Record<MusicPhase, number>,
  /** Pattern velocities: `X`, `x`, `o`. */
  accent: 1.25,
  ghost: 0.33,
  /** Keys play accents (`X`) this much louder. */
  keysAccent: 1.15,
  /** The arp outside "rush", from a section's second lap on. */
  arpRepeat: 0.6,
  /** ± fraction of velocity, from a hash of song, bar, and step. */
  humanize: 0.08,
  sends: { keysReverb: 0.12, leadReverb: 0.18, arpReverb: 0.24, leadDelay: 0.14, arpDelay: 0.2 },
  returns: { reverb: 0.5, delay: 0.55 },
  delayFeedback: 0.25,
  delayTone: 2_000,
  /** Into the limiter. */
  mix: 1,
  /** The limiter is linear up to `knee`, then bends softly toward `ceiling`. */
  limiter: { knee: 0.4, ceiling: 0.46 },
};

// --- Voices -----------------------------------------------------------------

interface Envelope {
  attack: number;
  /** Time constant of the decay toward `sustain`. */
  tau: number;
  /** Fraction of the peak held until the gate closes; 0 rings out. */
  sustain: number;
  release: number;
}

interface Voice {
  harmonics: number[];
  env: Envelope;
  /** Depth (cents) of the shared vibrato on this voice's notes; none when omitted. */
  vibrato?: number;
}

/** Harmonic amplitudes, index 0 the fundamental. */
function partials(map: Record<number, number>) {
  const top = Math.max(...Object.keys(map).map(Number));
  const list = new Array<number>(top).fill(0);
  for (const [partial, amp] of Object.entries(map)) list[Number(partial) - 1] = amp;
  return list;
}

/** `count` harmonics at 1/n, tilted darker by n^-`tilt`. */
function sawtooth(count: number, tilt: number) {
  return Array.from({ length: count }, (_, index) => (1 / (index + 1)) ** (1 + tilt));
}

const VOICES = {
  keys: {
    harmonics: [1, 0.42, 0.12, 0.1, 0.03, 0.02],
    env: { attack: 0.004, tau: 0.12, sustain: 0.45, release: 0.14 },
  },
  bass: {
    // Enough second and third harmonic that the line survives a phone speaker.
    harmonics: [1, 0.55, 0.26, 0.1],
    env: { attack: 0.006, tau: 0.16, sustain: 0.6, release: 0.06 },
  },
  marimba: {
    harmonics: partials({ 1: 1, 4: 0.28, 10: 0.05 }),
    env: { attack: 0.002, tau: 0.11, sustain: 0, release: 0.04 },
  },
  kalimba: {
    harmonics: partials({ 1: 1, 2: 0.1, 5: 0.2, 6: 0.08 }),
    env: { attack: 0.002, tau: 0.16, sustain: 0, release: 0.04 },
  },
  glass: {
    harmonics: partials({ 1: 1, 2: 0.3, 4: 0.12, 6: 0.06 }),
    env: { attack: 0.003, tau: 0.3, sustain: 0.2, release: 0.2 },
  },
  whistle: {
    harmonics: [1, 0.18, 0.05],
    env: { attack: 0.028, tau: 1, sustain: 1, release: 0.09 },
    vibrato: 9,
  },
  // A vibraphone: struck bar partials and a long ring, for the slow tune.
  vibes: {
    harmonics: partials({ 1: 1, 4: 0.2, 10: 0.03 }),
    env: { attack: 0.003, tau: 0.45, sustain: 0, release: 0.05 },
  },
  // A melodica: a reedy, held tone with a little less vibrato than the whistle.
  reed: {
    harmonics: [1, 0.25, 0.4, 0.1, 0.15, 0.05],
    env: { attack: 0.018, tau: 0.1, sustain: 0.9, release: 0.08 },
    vibrato: 6,
  },
  // A soft chiptune square: odd harmonics rolled off, kept round by the lead low-pass.
  square: {
    harmonics: [1, 0, 0.33, 0, 0.2, 0, 0.14, 0, 0.11],
    env: { attack: 0.004, tau: 0.1, sustain: 0.7, release: 0.05 },
  },
  // A twangy surf guitar: bright, plucked, and gone.
  pluck: {
    harmonics: [1, 0.5, 0.33, 0.25, 0.2, 0.12, 0.08, 0.05],
    env: { attack: 0.002, tau: 0.22, sustain: 0, release: 0.05 },
  },
  // A festival lead: a saw, rounded off at the top, that holds its notes.
  saw: {
    harmonics: sawtooth(16, 0.2),
    env: { attack: 0.006, tau: 0.15, sustain: 0.75, release: 0.09 },
  },
  // A nod to a resonant bass synth with no filter to sweep: half saw, half
  // square, with a bump where the resonance would sit, plucked short.
  acid: {
    harmonics: sawtooth(16, 0).map((amp, index) => {
      const h = index + 1;
      const bump = h >= 5 && h <= 9 ? [2, 2.3, 2.5, 2.3, 2][h - 5] : 1;
      return amp * bump * (h % 2 === 0 ? 0.6 : 1);
    }),
    env: { attack: 0.003, tau: 0.07, sustain: 0.25, release: 0.04 },
  },
  // Saw chords for the club songs, in place of the electric piano.
  supersaw: {
    harmonics: sawtooth(24, 0.3),
    env: { attack: 0.012, tau: 0.2, sustain: 0.85, release: 0.12 },
  },
  arp: {
    harmonics: partials({ 1: 1, 2: 0.22, 3: 0.06 }),
    env: { attack: 0.003, tau: 0.09, sustain: 0, release: 0.03 },
  },
} satisfies Record<string, Voice>;

/** What plays the chords, by `song.keys`. */
const KEYS_VOICE = { rhodes: "keys", saw: "supersaw" } as const satisfies Record<KeysVoice, string>;
/** Each chord's notes go alternately sharp and flat by this much. */
const KEYS_DETUNE_CENTS = { rhodes: 3, saw: 9 } satisfies Record<KeysVoice, number>;

type VoiceName = keyof typeof VOICES;

/** How much of a note's length a sustained voice holds before releasing. */
const GATE = { keys: 0.92, bass: 0.9, lead: 0.9 };

const VIBRATO_HZ = 5.5;
/** The sidechain pump's fall (seconds) and its climb back (beats, from the kick). */
const PUMP_DROP = 0.005;
const PUMP_SWELL = 0.6;
const AUTOPAN_HZ = 0.11;
const AUTOPAN_DEPTH = 0.22;
const ARP_PAN = 0.35;
const REVERB_SECONDS = 0.8;
const NOISE_SECONDS = 1;
/** Starting phases each timbre is built in. */
const PHASES = 4;

// --- Public shape -------------------------------------------------------------

export interface MusicEngine {
  /** The fader sfx.ts rides for fades, pauses, and ducking. Everything passes through it. */
  readonly bus: GainNode;
  /** A low-pass after the fader, swept by sfx.ts when music starts and finishes. Rests at 14 kHz, Q 0.35. */
  readonly filter: BiquadFilterNode;
  /**
   * Back to the top of `order` (every song in index order when omitted or
   * empty); first downbeat at `at`. `form` defaults to "rhythm" (8 bars a
   * song) with an order and "listening" (32 bars a song) without one.
   */
  start(order: number[] | undefined, at: number, form?: MusicForm): void;
  /** Schedule every bar that begins before `horizon` (context time). */
  scheduleUntil(horizon: number): void;
  /** After sources were cut (a pause), carry on from the next unplayed bar with its downbeat at `at`. */
  resumeAt(at: number): void;
  /** Takes effect on the next bar scheduled. */
  setPhase(phase: MusicPhase): void;
  /** Stop every scheduled source at `at`; forget them when `at` is now or past. */
  stopSources(at: number): void;
  onSong(listener: ((song: Song) => void) | null): void;
}

// --- Deterministic randomness -------------------------------------------------

/** A small seeded generator (mulberry32) for noise and the room's impulse. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A repeatable number in [0, 1) from a few integers. */
function hash(...parts: number[]) {
  let h = 0x811c9dc5;
  for (const part of parts) {
    h ^= part | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Tags so each instrument's humanisation is its own.
const TAG = {
  keys: 1,
  bass: 2,
  lead: 3,
  arp: 4,
  kick: 5,
  snare: 6,
  rim: 7,
  hat: 8,
  open: 9,
  shaker: 10,
};

// --- The engine -----------------------------------------------------------------

export function createMusicEngine(ctx: BaseAudioContext, destination: AudioNode): MusicEngine {
  const sources = new Set<AudioScheduledSourceNode>();

  // Timbres, built once, each in a few starting phases: notes struck
  // together (a chord, the bass under the kick) then start out of step and
  // do not pile their first peaks on top of one another.
  const waves = {} as Record<VoiceName, PeriodicWave[]>;
  for (const name of Object.keys(VOICES) as VoiceName[]) {
    const harmonics = VOICES[name].harmonics;
    waves[name] = Array.from({ length: PHASES }, (_, turn) => {
      const shift = (2 * Math.PI * turn) / PHASES;
      const real = new Float32Array(harmonics.length + 1);
      const imag = new Float32Array(harmonics.length + 1);
      harmonics.forEach((amp, index) => {
        const h = index + 1;
        real[h] = amp * Math.sin(h * shift);
        imag[h] = amp * Math.cos(h * shift);
      });
      return ctx.createPeriodicWave(real, imag);
    });
  }

  // --- Graph ---

  const gain = (value = 1) => {
    const node = ctx.createGain();
    node.gain.value = value;
    return node;
  };
  const biquad = (type: BiquadFilterType, frequency: number, q = 0.707) => {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  };
  const panner = (value: number): AudioNode & { pan?: AudioParam } => {
    if (typeof ctx.createStereoPanner !== "function") return gain();
    const node = ctx.createStereoPanner();
    node.pan.value = value;
    return node;
  };

  const mix = gain(MIX.mix);
  const limiter = ctx.createWaveShaper();
  limiter.curve = limiterCurve(MIX.limiter.knee, MIX.limiter.ceiling);
  limiter.oversample = "none";
  const bus = gain(1);
  const filter = biquad("lowpass", 14_000, 0.35);
  mix.connect(limiter).connect(bus).connect(filter).connect(destination);

  // Sidechain pump: keys, bass, and arp reach the mix through it (their
  // room and echo sends do not). It rests at 1 unless a song asks to pump.
  const pump = gain();
  pump.connect(mix);

  // Keys: phase low-pass, then a slow auto-pan.
  const keysIn = gain();
  const keysFilter = biquad("lowpass", MIX.keysCutoff.opening, 0.5);
  const keysPan = panner(0);
  const keysOut = gain();
  keysIn.connect(keysFilter).connect(keysPan).connect(keysOut).connect(pump);
  if (keysPan.pan) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = AUTOPAN_HZ;
    lfo.connect(gain(AUTOPAN_DEPTH)).connect(keysPan.pan);
    lfo.start(0);
  }

  const bassIn = gain();
  bassIn
    .connect(biquad("highpass", 35, 0.6))
    .connect(biquad("lowpass", 800, 0.6))
    .connect(pump);

  const leadIn = gain();
  const leadOut = gain();
  leadIn
    .connect(biquad("lowpass", 4_000, 0.5))
    .connect(leadOut)
    .connect(mix);

  const arpIn = gain();
  const arpOut = gain();
  arpIn
    .connect(biquad("lowpass", 3_200, 0.5))
    .connect(panner(ARP_PAN))
    .connect(arpOut)
    .connect(pump);

  // Drums: one shared filter per kind of noise; LTI, so sharing is free.
  const drumsIn = gain();
  drumsIn.connect(mix);
  const snareBand = biquad("bandpass", 1_900, 0.8);
  snareBand.connect(drumsIn);
  const rimBand = biquad("bandpass", 2_200, 1.4);
  rimBand.connect(drumsIn);
  const clickBand = biquad("bandpass", 2_600, 0.7);
  clickBand.connect(drumsIn);
  const hatHigh = biquad("highpass", 7_500, 0.7);
  hatHigh.connect(panner(0.18)).connect(drumsIn);
  const shakerBand = biquad("bandpass", 6_000, 1);
  shakerBand.connect(panner(-0.22)).connect(drumsIn);
  const clapBand = biquad("bandpass", 1_500, 1.1);
  clapBand.connect(drumsIn);

  // Room: a short generated impulse, fed lightly by keys, lead, and arp.
  const reverb = ctx.createConvolver();
  reverb.normalize = false;
  reverb.buffer = roomImpulse(ctx);
  reverb.connect(gain(MIX.returns.reverb)).connect(mix);
  keysOut.connect(gain(MIX.sends.keysReverb)).connect(reverb);
  leadOut.connect(gain(MIX.sends.leadReverb)).connect(reverb);
  arpOut.connect(gain(MIX.sends.arpReverb)).connect(reverb);

  // Echo: three quarters of a beat, darkened on every repeat.
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.75 * (60 / SONGS[0].bpm);
  const delayTone = biquad("lowpass", MIX.delayTone, 0.5);
  delay.connect(delayTone);
  delayTone.connect(gain(MIX.delayFeedback)).connect(delay);
  delayTone.connect(gain(MIX.returns.delay)).connect(mix);
  leadOut.connect(gain(MIX.sends.leadDelay)).connect(delay);
  arpOut.connect(gain(MIX.sends.arpDelay)).connect(delay);

  // Vibrato: one LFO, through a depth per voice that has any, wired into
  // each of that voice's notes' detune.
  const vibratoLfo = ctx.createOscillator();
  vibratoLfo.frequency.value = VIBRATO_HZ;
  vibratoLfo.start(0);
  const vibratos: Partial<Record<VoiceName, GainNode>> = {};
  for (const name of Object.keys(VOICES) as VoiceName[]) {
    const voice: Voice = VOICES[name];
    if (!voice.vibrato) continue;
    const depth = gain(voice.vibrato);
    vibratoLfo.connect(depth);
    vibratos[name] = depth;
  }

  const noise = noiseBuffer(ctx);

  // --- State ---

  let order: number[] | undefined;
  let form: MusicForm = "listening";
  let started = false;
  let held = false;
  let cursor = 0;
  let nextBarTime = 0;
  let phase: MusicPhase = "opening";
  let lastPhase: MusicPhase | null = null;
  let lastSong: Song | null = null;
  let keysNoteCount = 0;
  let listener: ((song: Song) => void) | null = null;
  // Bars already scheduled, so a cut can wind back to the first unplayed one.
  let scheduled: { bar: number; start: number }[] = [];
  // The pump's automation, mirrored as breakpoints (a step for a set value,
  // otherwise a linear ramp from the point before) so a cut can hold it
  // exactly where it is. Empty until a song pumps.
  let pumpPoints: { time: number; value: number; step: boolean }[] = [];
  let pumping = false;

  // --- Pump ---

  function pumpValueAt(time: number) {
    let value = 1;
    let from = -Infinity;
    for (const point of pumpPoints) {
      if (point.time <= time) {
        value = point.value;
        from = point.time;
        continue;
      }
      if (point.step || from === -Infinity) return value;
      return value + ((point.value - value) * (time - from)) / (point.time - from);
    }
    return value;
  }
  function pumpSet(value: number, time: number) {
    pump.gain.setValueAtTime(value, time);
    pumpPoints.push({ time, value, step: true });
  }
  function pumpRamp(value: number, time: number) {
    pump.gain.linearRampToValueAtTime(value, time);
    pumpPoints.push({ time, value, step: false });
  }
  /**
   * Drop everything the pump has scheduled from `time` on, holding it where
   * it was headed at `time`: cancelling cuts short a climb in progress, and
   * the ramp put back retraces the same line up to `time`.
   */
  function pumpHold(time: number) {
    const value = pumpValueAt(time);
    pump.gain.cancelScheduledValues(time);
    pumpPoints = pumpPoints.filter((point) => point.time < time);
    // Keep only the last breakpoint more than a few seconds old.
    const old = pumpPoints.filter((point) => point.time < time - 4).length;
    if (old > 1) pumpPoints = pumpPoints.slice(old - 1);
    if (pumpPoints.length) pumpRamp(value, time);
    else pumpSet(value, time);
  }
  /** Back to rest at `time`, for a cut or a restart: nothing stale left ramping. */
  function pumpRest(time: number) {
    if (!pumpPoints.length) return;
    pumpHold(time);
    pumpSet(1, time);
    pumping = false;
  }

  // --- Sources ---

  function track(source: AudioScheduledSourceNode, onEnd?: () => void) {
    sources.add(source);
    source.addEventListener(
      "ended",
      () => {
        sources.delete(source);
        onEnd?.();
      },
      { once: true },
    );
  }

  /**
   * Shapes `param` from silence to `peak` and back to silence: a linear
   * attack, a decay toward `sustain` of the peak, held until `releaseAt`,
   * then a linear release. Returns when it reaches zero.
   */
  function envelope(param: AudioParam, t: number, peak: number, env: Envelope, releaseAt: number) {
    const top = t + env.attack;
    const floor = peak * env.sustain;
    const release = Math.max(releaseAt, top + 0.005);
    const level = floor + (peak - floor) * Math.exp(-(release - top) / env.tau);
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, top);
    param.setTargetAtTime(floor, top, env.tau);
    param.setValueAtTime(level, release);
    param.linearRampToValueAtTime(0, release + env.release);
    return release + env.release;
  }

  function tone(
    voice: VoiceName,
    midi: number,
    t: number,
    peak: number,
    gateEnd: number,
    out: AudioNode,
    detune = 0,
    turn = 0,
  ) {
    if (!(peak > 0)) return;
    const env = VOICES[voice].env;
    // Voices with no sustain ring out on their own, past the written length.
    const releaseAt = env.sustain > 0 ? gateEnd : t + env.attack + env.tau * 4;
    const oscillator = ctx.createOscillator();
    const amp = gain(0);
    oscillator.setPeriodicWave(waves[voice][turn % PHASES]);
    oscillator.frequency.value = midiToHz(midi);
    oscillator.detune.value = detune;
    const end = envelope(amp.gain, t, peak, env, releaseAt);
    oscillator.connect(amp).connect(out);
    const vibrato = vibratos[voice];
    vibrato?.connect(oscillator.detune);
    oscillator.start(t);
    oscillator.stop(end + 0.01);
    track(oscillator, () => {
      amp.disconnect();
      vibrato?.disconnect(oscillator.detune);
    });
  }

  /** A burst of the shared noise through `out`, from a repeatable spot in it. */
  function noiseHit(
    t: number,
    peak: number,
    attack: number,
    tau: number,
    length: number,
    out: AudioNode,
    seed: number,
  ) {
    if (!(peak > 0)) return;
    const source = ctx.createBufferSource();
    const amp = gain(0);
    source.buffer = noise;
    const offset = hash(seed, 0x51) * (NOISE_SECONDS - length - 0.05);
    const release = Math.min(0.02, length / 3);
    const end = envelope(
      amp.gain,
      t,
      peak,
      { attack, tau, sustain: 0, release },
      t + length - release,
    );
    source.connect(amp).connect(out);
    source.start(t, Math.max(0, offset), end - t + 0.01);
    track(source, () => amp.disconnect());
  }

  /** A pitched drum tone: a sine that may fall from `from` to `to`. */
  function drumTone(
    t: number,
    peak: number,
    from: number,
    to: number,
    fall: number,
    tau: number,
    length: number,
    out: AudioNode,
  ) {
    if (!(peak > 0)) return;
    const oscillator = ctx.createOscillator();
    const amp = gain(0);
    oscillator.frequency.setValueAtTime(from, t);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, t + fall);
    const release = 0.03;
    const end = envelope(
      amp.gain,
      t,
      peak,
      { attack: 0.002, tau, sustain: 0, release },
      t + length - release,
    );
    oscillator.connect(amp).connect(out);
    oscillator.start(t);
    oscillator.stop(end + 0.01);
    track(oscillator, () => amp.disconnect());
  }

  // --- Drums ---

  function kick(t: number, v: number, seed: number) {
    drumTone(t, v * MIX.level.kick, 118, 46, 0.07, 0.06, 0.28, drumsIn);
    noiseHit(t, v * MIX.level.kickClick, 0.0005, 0.002, 0.008, clickBand, seed);
  }
  function clubKick(t: number, v: number, seed: number) {
    drumTone(t, v * MIX.level.clubKick, 150, 48, 0.09, 0.09, 0.32, drumsIn);
    noiseHit(t, v * MIX.level.kickClick, 0.0005, 0.002, 0.008, clickBand, seed);
  }
  /** Three quick bursts and a tail; a ghost is one soft burst. */
  function clap(t: number, v: number, seed: number, ghost: boolean) {
    const burst = v * MIX.level.clap;
    for (let n = 0; n < (ghost ? 1 : 3); n++) {
      // The first burst reads the noise where a snare would; the rest, spots no drum uses.
      noiseHit(t + n * 0.01, burst, 0.0005, 0.003, 0.008, clapBand, n ? seed + 4 + n : seed);
    }
    if (!ghost) noiseHit(t + 0.02, v * MIX.level.clapTail, 0.001, 0.035, 0.12, clapBand, seed + 7);
  }
  function snare(t: number, v: number, seed: number) {
    noiseHit(t, v * MIX.level.snare, 0.001, 0.035, 0.14, snareBand, seed);
    drumTone(t, v * MIX.level.snareTick, 185, 185, 0, 0.022, 0.08, drumsIn);
  }
  function rim(t: number, v: number, seed: number) {
    drumTone(t, v * MIX.level.rim, 820, 820, 0, 0.012, 0.05, drumsIn);
    noiseHit(t, v * MIX.level.rimNoise, 0.0005, 0.007, 0.025, rimBand, seed);
  }
  function hat(t: number, v: number, seed: number) {
    noiseHit(t, v * MIX.level.hat, 0.001, 0.012, 0.035, hatHigh, seed);
  }
  function openHat(t: number, v: number, seed: number) {
    noiseHit(t, v * MIX.level.open, 0.002, 0.06, 0.18, hatHigh, seed);
  }
  function shaker(t: number, v: number, seed: number) {
    noiseHit(t, v * MIX.level.shaker, 0.012, 0.02, 0.072, shakerBand, seed);
  }

  // --- One bar ---

  function velocity(hit: Hit) {
    return hit === "X" ? MIX.accent : hit === "o" ? MIX.ghost : hit === "x" ? 1 : 0;
  }

  function scheduleBar(bar: number, start: number) {
    const slot = barSlot(SONGS, order, bar, BARS_PER_SONG, form);
    const song = SONGS[slot.song];
    const parsed = parseSong(song);
    const section = slot.section;
    const index = slot.barInSection;
    const groove = parsed.grooves[phase];
    const trim = MIX.phase[phase];
    const beat = 60 / song.bpm;
    const barEnd = start + barSeconds(song.bpm);
    const at = (b: number) => start + b * beat;
    const human = (tag: number, step: number) =>
      1 + MIX.humanize * (hash(slot.song, bar, step, tag) * 2 - 1);

    if (song !== lastSong) {
      delay.delayTime.setValueAtTime(0.75 * beat, start);
      lastSong = song;
    }
    if (slot.barInSong === 0) listener?.(song);

    // The keys open up as the band fills in, gliding across the bar.
    const cutoff = MIX.keysCutoff[phase];
    if (lastPhase === null) keysFilter.frequency.setValueAtTime(cutoff, start);
    else if (lastPhase !== phase) {
      keysFilter.frequency.setValueAtTime(MIX.keysCutoff[lastPhase], start);
      keysFilter.frequency.exponentialRampToValueAtTime(cutoff, barEnd);
    }
    lastPhase = phase;

    const spans = parsed.sections[section].chords[index];
    const chord = (b: number) => chordInBar(parsed, section, index, b);

    // Keys: strike at each comp hit, and at any chord change the comp
    // pattern leaves unstruck; hold until the next strike or chord change.
    const strikes = new Map<number, number>();
    groove.comp.forEach((hit, step) => {
      if (hit) strikes.set(stepBeat(step, song.swing), hit === "X" ? MIX.keysAccent : 1);
    });
    for (const span of spans) {
      const end = span.beat + span.beats;
      const struck = [...strikes.keys()].some((b) => b >= span.beat - 1e-6 && b < end - 1e-6);
      if (!struck && span.beat > 0) strikes.set(span.beat, 0.85);
    }
    const keysVoice = song.keys ?? "rhodes";
    const strikeBeats = [...strikes.keys()].sort((a, b) => a - b);
    const changes = spans.map((span) => span.beat).filter((b) => b > 0);
    strikeBeats.forEach((b, n) => {
      const until = Math.min(
        strikeBeats[n + 1] ?? BEATS_PER_BAR,
        changes.find((c) => c > b + 1e-6) ?? BEATS_PER_BAR,
      );
      const t = at(b);
      const gateEnd = t + Math.max(0.06, (until - b) * beat * GATE.keys);
      const peak =
        MIX.level.keys *
        trim.all *
        trim.keys *
        (strikes.get(b) ?? 1) *
        human(TAG.keys, Math.round(b * 4)) *
        MIX.keysVoice[keysVoice];
      const cents = KEYS_DETUNE_CENTS[keysVoice];
      chord(b).keys.forEach((midi, voice) => {
        keysNoteCount += 1;
        const detune = keysNoteCount % 2 ? cents : -cents;
        tone(KEYS_VOICE[keysVoice], midi, t, peak, gateEnd, keysIn, detune, voice);
      });
    });

    // Bass, against the chord sounding when each note starts.
    const next = barSlot(SONGS, order, bar + 1, BARS_PER_SONG, form);
    const nextParsed = parseSong(SONGS[next.song]);
    const nextRoot = chordInBar(nextParsed, next.section, next.barInSection, 0).root;
    for (const note of groove.bass) {
      const midi = bassMidi(note.degree, chord(note.beat), nextRoot);
      if (midi === null) continue;
      const t = at(note.beat);
      const onBeat = Math.abs(note.beat - Math.round(note.beat)) < 1e-6;
      const peak =
        MIX.level.bass *
        trim.all *
        trim.bass *
        (onBeat ? 1 : 0.88) *
        human(TAG.bass, Math.round(note.beat * 4));
      tone("bass", midi, t, peak, t + note.beats * beat * GATE.bass, bassIn, 0, 1);
    }

    // Lead: the tune, always.
    const leadLevel = MIX.level.lead * MIX.leadVoice[song.lead] * trim.all * trim.lead;
    for (const note of parsed.sections[section].melody[index]) {
      if (note.midi === null) continue;
      const t = at(note.beat);
      const peak = leadLevel * human(TAG.lead, Math.round(note.beat * 4));
      tone(song.lead, note.midi, t, peak, t + note.beats * beat * GATE.lead, leadIn, 0, 2);
    }

    // Arp: in the rush, and quieter on any repeat, so no lap is a copy.
    const arpLevel = phase === "rush" ? 1 : slot.lap >= 1 ? MIX.arpRepeat : 0;
    if (arpLevel > 0) {
      parsed.arp.forEach((pick, step) => {
        if (pick === null) return;
        const b = step / 2;
        const voicing: ParsedChord["keys"] = chord(b).keys;
        const midi = voicing[pick % voicing.length] + 12;
        const peak = MIX.level.arp * arpLevel * trim.all * trim.arp * human(TAG.arp, step * 2);
        tone("arp", midi, at(b), peak, at(b) + beat / 2, arpIn);
      });
    }

    // Drums.
    const fillBar = index === SECTION_BARS - 1 && groove.snare !== null;
    const kicks = fillBar ? parsed.fill.kick : groove.kick;
    const snares = fillBar ? parsed.fill.snare : groove.snare;

    // The pump ducks under every kick this bar plays. Each bar starts and
    // ends at rest, so anything scheduled past this bar line is stale (a cut,
    // a restart) and goes; a song that does not pump leaves it at rest.
    const depth = song.pump ?? 0;
    if (depth > 0 || pumping) {
      pumpHold(start);
      pumpSet(1, start);
      if (depth > 0) {
        const shape = pumpShape(
          hitBeats(kicks, song.swing),
          beat,
          barEnd - start,
          depth,
          PUMP_DROP,
          PUMP_SWELL * beat,
        );
        for (const point of shape) pumpRamp(point.value, start + point.time);
      }
      pumping = depth > 0;
    }
    const extraOpen = index === 3 && groove.hat !== null;
    const kit = trim.all * trim.drums;
    const club = song.kit === "club";
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      const t = at(stepBeat(step, song.swing));
      const seed = (bar * STEPS_PER_BAR + step) * 16;
      const v = (hit: Hit, tag: number) => velocity(hit) * kit * human(tag, step);
      if (kicks?.[step]) (club ? clubKick : kick)(t, v(kicks[step], TAG.kick), seed);
      if (snares?.[step] && club) clap(t, v(snares[step], TAG.snare), seed + 1, snares[step] === "o");
      else if (snares?.[step]) snare(t, v(snares[step], TAG.snare), seed + 1);
      if (groove.rim?.[step]) rim(t, v(groove.rim[step], TAG.rim), seed + 2);
      const lastEighth = extraOpen && step === STEPS_PER_BAR - 2;
      if (groove.hat?.[step] && !lastEighth) hat(t, v(groove.hat[step], TAG.hat), seed + 3);
      if (groove.open?.[step] && !lastEighth) openHat(t, v(groove.open[step], TAG.open), seed + 4);
      if (lastEighth) openHat(t, v("x", TAG.open), seed + 4);
      if (groove.shaker?.[step]) shaker(t, v(groove.shaker[step], TAG.shaker), seed + 5);
    }
  }

  // --- API ---

  return {
    bus,
    filter,

    start(nextOrder, at, nextForm) {
      order = nextOrder && nextOrder.length ? [...nextOrder] : undefined;
      form = nextForm ?? (order ? "rhythm" : "listening");
      started = true;
      held = false;
      cursor = 0;
      nextBarTime = at;
      lastPhase = null;
      lastSong = null;
      keysNoteCount = 0;
      scheduled = [];
      keysFilter.frequency.cancelScheduledValues(at);
      delay.delayTime.cancelScheduledValues(at);
      pumpRest(at);
    },

    scheduleUntil(horizon) {
      if (!started || held) return;
      while (nextBarTime < horizon) {
        const song = SONGS[barSlot(SONGS, order, cursor, BARS_PER_SONG, form).song];
        scheduleBar(cursor, nextBarTime);
        scheduled.push({ bar: cursor, start: nextBarTime });
        if (scheduled.length > 16) scheduled.shift();
        nextBarTime += barSeconds(song.bpm);
        cursor += 1;
      }
    },

    resumeAt(at) {
      if (!started) return;
      held = false;
      nextBarTime = at;
    },

    setPhase(next) {
      phase = next;
    },

    stopSources(at) {
      for (const source of sources) {
        try {
          source.stop(at);
        } catch {
          // Already stopped.
        }
      }
      if (at <= ctx.currentTime) sources.clear();
      // Everything the pump moves stops at `at`, so it can go back to rest there.
      pumpRest(at);
      // Bars that had not begun by `at` were never heard: play them next.
      const unplayed = scheduled.findIndex((entry) => entry.start >= at);
      if (unplayed >= 0) {
        cursor = scheduled[unplayed].bar;
        scheduled = scheduled.slice(0, unplayed);
      }
      held = true;
    },

    onSong(next) {
      listener = next;
    },
  };
}

// --- Buffers and curves ------------------------------------------------------

/** Linear to `knee`, then a tanh bend that approaches `ceiling`. */
function limiterCurve(knee: number, ceiling: number) {
  const size = 4097;
  const curve = new Float32Array(size);
  const room = ceiling - knee;
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    const magnitude = Math.abs(x);
    const y = magnitude <= knee ? magnitude : knee + room * Math.tanh((magnitude - knee) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

function noiseBuffer(ctx: BaseAudioContext) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate);
  const random = seeded(0xb0ba);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = random() * 2 - 1;
  return buffer;
}

/** About 0.8 s of exponentially decaying, darkening stereo noise. */
function roomImpulse(ctx: BaseAudioContext) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * REVERB_SECONDS);
  const buffer = ctx.createBuffer(2, length, rate);
  // -60 dB by the end.
  const tau = REVERB_SECONDS / 6.9;
  for (let channel = 0; channel < 2; channel++) {
    const random = seeded(0x7ea + channel * 977);
    const data = buffer.getChannelData(channel);
    let smooth = 0;
    let energy = 0;
    for (let i = 0; i < length; i++) {
      const time = i / rate;
      // The low-pass closes from about 5 kHz to 1.5 kHz as the room decays.
      const cutoff = 5_000 - 3_500 * (time / REVERB_SECONDS);
      const coefficient = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
      smooth += coefficient * (random() * 2 - 1 - smooth);
      // A few milliseconds' fade-in so the room never clicks on.
      const onset = Math.min(1, time / 0.004);
      data[i] = smooth * Math.exp(-time / tau) * onset;
      energy += data[i] * data[i];
    }
    const scale = 1 / Math.sqrt(energy || 1);
    for (let i = 0; i < length; i++) data[i] *= scale;
  }
  return buffer;
}
