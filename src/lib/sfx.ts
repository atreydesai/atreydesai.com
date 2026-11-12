// Procedural Web Audio for the boba arcade: asset-free sound effects, keyed
// feedback, and the controls for the soundtrack. The soundtrack itself (the
// songbook, its notation, and the synth that arranges it) lives in
// `$lib/music`; this file only creates it, rides its fader, and keeps it fed
// from a short look-ahead timer.

import { createMusicEngine, type MusicEngine } from "./music/engine";
import { climbingPlaylist, shuffledPlaylist } from "./music/playlist";
import { SONGS, type MusicPhase } from "./music/songs";

const MASTER_LEVEL = 0.48;
const MUTE_KEY = "boba_muted_v2";
const MUSIC_LOOKAHEAD_SECONDS = 0.24;
const MUSIC_TICK_MS = 75;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicEngine: MusicEngine | null = null;
let musicBus: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let muted = false;
let muteLoaded = false;
let musicOn = false;
let musicPaused = false;
let musicPhase: MusicPhase = "opening";
let musicTimer: ReturnType<typeof setTimeout> | null = null;

// Tea minus's engine: one looping noise voice, built on first use and then
// only steered, so a per-frame caller never creates nodes.
const THRUSTER_LEVEL = 0.5;
const THRUSTER_GLIDE = 0.04;
let thrusterGain: GainNode | null = null;
let thrusterBuffer: AudioBuffer | null = null;
let thrusterGoal = 0;

// Order up's pour: built and steered like the thruster. A band-pass sweeps
// up as the cup fills, the way a filling glass rises in pitch, so a player
// can stop on the line by ear. It is a thin trickle, kept under the rumble.
const POUR_LEVEL = 0.22;
// A short glide, so releasing the pour falls silent in about 30ms.
const POUR_GLIDE = 0.01;
const POUR_EMPTY_HZ = 500;
const POUR_FULL_HZ = 1_700;
let pourGain: GainNode | null = null;
let pourFilter: BiquadFilterNode | null = null;
let pourGoal = 0;
let pourPitch = 0;

// While a game holds the clock (see suspendAudio), nothing may wake the
// context: a stray blip would restart the soundtrack under a pause card.
let clockHeld = false;

let currentRoot = 60;
let currentScale = [0, 2, 4, 7, 9];

/** The song that opened the last shuffled run, so the next one opens on another. */
let lastOpener: number | null = null;

let songListener: ((name: string) => void) | null = null;

function loadMutePreference() {
  if (muteLoaded || typeof window === "undefined") return;
  muteLoaded = true;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
}

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  loadMutePreference();

  if (!ctx) {
    const AudioContextConstructor =
      window.AudioContext ||
      (
        window as unknown as {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    ctx = new AudioContextConstructor();
    master = ctx.createGain();
    master.gain.value = muted ? 0.0001 : MASTER_LEVEL;
    master.connect(ctx.destination);
  }

  if (clockHeld) return null;

  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {
      // A later user gesture will retry.
    });
  }

  return ctx;
}

function hold(param: AudioParam, at: number) {
  param.cancelScheduledValues(at);
  param.setValueAtTime(Math.max(0.0001, param.value), at);
}

function panNode(value: number) {
  if (!ctx || typeof ctx.createStereoPanner !== "function") return null;
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, value));
  return panner;
}

function connectVoice(
  source: AudioNode,
  gain: GainNode,
  destination: AudioNode,
  pan = 0,
) {
  const panner = panNode(pan);
  if (panner) source.connect(gain).connect(panner).connect(destination);
  else source.connect(gain).connect(destination);
}

function note(
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.3,
  pan = 0,
  destination: AudioNode | null = master,
) {
  if (!ctx || !destination || frequency <= 0) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.setValueAtTime(volume, start + Math.max(0.01, duration - 0.045));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  connectVoice(oscillator, gain, destination, pan);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.025);
}

function slide(
  fromFrequency: number,
  toFrequency: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.32,
  pan = 0,
) {
  const c = audioContext();
  if (!c || !master) return;
  const start = c.currentTime;
  const oscillator = c.createOscillator();
  const gain = c.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(fromFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(40, toFrequency),
    start + duration,
  );
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  connectVoice(oscillator, gain, master, pan);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.025);
}

function midiFrequency(midi: number) {
  return midi <= 0 ? 0 : 440 * Math.pow(2, (midi - 69) / 12);
}

function ensureMusicGraph() {
  const c = audioContext();
  if (!c || !master) return false;
  if (!musicEngine) {
    try {
      musicEngine = createMusicEngine(c, master);
    } catch {
      // A browser without some node the band needs plays effects only.
      return false;
    }
    musicBus = musicEngine.bus;
    musicFilter = musicEngine.filter;
    musicBus.gain.value = phaseMusicLevel();
    musicEngine.setPhase(musicPhase);
    musicEngine.onSong((song) => {
      currentRoot = song.sfxRoot;
      currentScale = song.sfxScale;
      songListener?.(song.name);
    });
  }
  return true;
}

function getNoiseBuffer() {
  if (!ctx) return null;
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 0.5);
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) {
    channel[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// The phases are arrangement, not volume: the engine keeps its loudness level
// across them, so the fader rests at one level.
function phaseMusicLevel() {
  return 0.5;
}

function clearMusicTimer() {
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

function stopScheduledMusic(afterSeconds = 0) {
  if (!ctx) return;
  const stopAt = ctx.currentTime + Math.max(0, afterSeconds);
  musicEngine?.stopSources(stopAt);
}

function runMusicScheduler() {
  clearMusicTimer();
  if (!ctx || !musicEngine || !musicOn || musicPaused) return;
  musicEngine.scheduleUntil(ctx.currentTime + MUSIC_LOOKAHEAD_SECONDS);
  musicTimer = setTimeout(runMusicScheduler, MUSIC_TICK_MS);
}

function duckMusic(durationSeconds: number, floor = 0.4) {
  if (!ctx || !musicBus || !musicOn || musicPaused) return;
  const now = ctx.currentTime;
  const base = phaseMusicLevel();
  hold(musicBus.gain, now);
  musicBus.gain.linearRampToValueAtTime(Math.max(0.0001, base * floor), now + 0.012);
  musicBus.gain.linearRampToValueAtTime(base, now + durationSeconds);
}

function scaleMidi(octave: number, step: number) {
  const normalizedStep = Math.max(0, step);
  const scaleOctaves = Math.floor(normalizedStep / currentScale.length);
  const interval = currentScale[normalizedStep % currentScale.length];
  return currentRoot + (octave + scaleOctaves) * 12 + interval;
}

export function getMuted() {
  loadMutePreference();
  return muted;
}

export function setMuted(nextMuted: boolean) {
  muted = nextMuted;
  muteLoaded = true;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    }
  } catch {
    // Muting still works for the current session.
  }

  const c = audioContext();
  if (!c || !master) return;
  const now = c.currentTime;
  hold(master.gain, now);
  master.gain.exponentialRampToValueAtTime(
    muted ? 0.0001 : MASTER_LEVEL,
    now + 0.055,
  );
}

/** Returns an unsubscribe that only clears the listener if it is still ours. */
export function onSongChange(callback: ((name: string) => void) | null) {
  songListener = callback;
  return () => {
    if (songListener === callback) songListener = null;
  };
}

/** Tempo of each song in `order` (every song, in order, by default). */
export function songTempos(order?: number[]) {
  const indices = order?.length ? order : SONGS.map((_, index) => index);
  return indices.map((index) => SONGS[index].bpm);
}

/** A fresh four for straw stab: one from each tempo band, slowest first. */
export function stabPlaylist(): number[] {
  return climbingPlaylist(SONGS.map((song) => song.bpm));
}

/**
 * The audio time reaching the listener right now, in the same coordinate
 * that notes are scheduled in, or null while the context is not running.
 * A rhythm game draws against this so its visuals line up with what is
 * heard rather than with what was merely scheduled.
 */
export function audioClock(): number | null {
  if (!ctx || ctx.state !== "running") return null;
  const scheduled = ctx.currentTime;
  const stamp =
    typeof ctx.getOutputTimestamp === "function" ? ctx.getOutputTimestamp() : null;
  if (stamp?.contextTime !== undefined && stamp.performanceTime) {
    const heard = stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000;
    // A stale stamp (no output device yet, a device switch) can wander;
    // trust it only while it sits just behind the scheduling clock.
    if (heard <= scheduled + 0.02 && heard >= scheduled - 0.5) return heard;
  }
  return scheduled - (ctx.outputLatency || ctx.baseLatency || 0);
}

/**
 * Freezes the audio clock, soundtrack and all, mid-note. Resuming picks up
 * exactly where it stopped, so a paused rhythm game stays on the beat.
 */
export function suspendAudio() {
  clockHeld = true;
  // Hard stop rather than a fade: the context freezes before a fade could
  // finish, and the tail would play out on resume.
  quietThruster(0);
  quietPour(0);
  quietLoops(0);
  if (ctx?.state === "running") {
    void ctx.suspend().catch(() => {
      // Already suspended or closed.
    });
  }
}

export function resumeAudio() {
  clockHeld = false;
  if (ctx && ctx.state !== "running" && ctx.state !== "closed") {
    void ctx.resume().catch(() => {
      // A later user gesture will retry.
    });
  }
}

export function setMusicPhase(phase: MusicPhase) {
  musicPhase = phase;
  musicEngine?.setPhase(phase);
}

/**
 * Starts the soundtrack. With an `order`, plays those songs eight bars each
 * (the rhythm form); without one, every song in a fresh shuffle, whole
 * songs each, never opening on the song that opened the last such run.
 * Returns the audio time of the first downbeat, or null when there is no
 * audio to start.
 */
export function startMusic(order?: number[]): number | null {
  if (!ensureMusicGraph() || !ctx || !musicEngine || !musicBus || !musicFilter) return null;
  clearMusicTimer();
  stopScheduledMusic();

  musicOn = true;
  musicPaused = false;
  const firstDownbeat = ctx.currentTime + 0.12;
  const given = order?.filter((index) => SONGS[index]);
  let opener: number;
  if (given?.length) {
    opener = given[0];
    musicEngine.start(given, firstDownbeat);
  } else {
    const shuffled = shuffledPlaylist(SONGS.length, lastOpener);
    opener = shuffled[0];
    lastOpener = opener;
    musicEngine.start(shuffled, firstDownbeat, "listening");
  }
  // Keyed to the opening song now; the first bar, scheduled below, keeps
  // the effects on each song as it comes on.
  currentRoot = SONGS[opener].sfxRoot;
  currentScale = SONGS[opener].sfxScale;

  const now = ctx.currentTime;
  hold(musicBus.gain, now);
  musicBus.gain.exponentialRampToValueAtTime(phaseMusicLevel(), now + 0.16);
  musicFilter.frequency.cancelScheduledValues(now);
  musicFilter.frequency.setValueAtTime(Math.max(650, musicFilter.frequency.value), now);
  musicFilter.frequency.exponentialRampToValueAtTime(14_000, now + 0.2);
  runMusicScheduler();
  return firstDownbeat;
}

export function setMusicPaused(paused: boolean) {
  // Before the early return: a game can pause without its music running.
  if (paused) quietThruster();
  if (paused) quietPour();
  if (paused) quietLoops();
  if (!ctx || !musicBus || !musicOn || paused === musicPaused) return;
  musicPaused = paused;
  const now = ctx.currentTime;

  if (paused) {
    clearMusicTimer();
    hold(musicBus.gain, now);
    musicBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    stopScheduledMusic(0.09);
    return;
  }

  stopScheduledMusic();
  musicEngine?.resumeAt(now + 0.12);
  hold(musicBus.gain, now);
  musicBus.gain.exponentialRampToValueAtTime(phaseMusicLevel(), now + 0.12);
  runMusicScheduler();
}

export function finishMusic() {
  quietThruster();
  quietPour();
  quietLoops();
  if (!ctx || !musicBus || !musicFilter) {
    musicOn = false;
    clearMusicTimer();
    return;
  }

  musicOn = false;
  musicPaused = false;
  clearMusicTimer();
  const now = ctx.currentTime;
  hold(musicBus.gain, now);
  musicBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.44);
  musicFilter.frequency.cancelScheduledValues(now);
  musicFilter.frequency.setValueAtTime(Math.max(650, musicFilter.frequency.value), now);
  musicFilter.frequency.exponentialRampToValueAtTime(650, now + 0.34);
  stopScheduledMusic(0.48);
}

export function stopMusic() {
  quietThruster();
  quietPour();
  quietLoops();
  musicOn = false;
  musicPaused = false;
  clearMusicTimer();
  if (ctx && musicBus) {
    const now = ctx.currentTime;
    hold(musicBus.gain, now);
    musicBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    stopScheduledMusic(0.07);
  } else {
    stopScheduledMusic();
  }
}

export function sfxCountdown(value: number) {
  const c = audioContext();
  if (!c) return;
  const frequency = value > 1 ? midiFrequency(72) : midiFrequency(79);
  note(frequency, c.currentTime, 0.075, "square", 0.19);
}

export function sfxStart() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  [0, 2, 4, 7].forEach((step, index) => {
    note(
      midiFrequency(currentRoot + 12 + step),
      start + index * 0.055,
      0.095,
      "square",
      0.22,
    );
  });
}

export function sfxCatch(combo = 1, perfect = false, pan = 0) {
  const c = audioContext();
  if (!c) return;
  duckMusic(0.08, 0.42);
  const step = Math.min(Math.max(combo - 1, 0), 4);
  const first = midiFrequency(scaleMidi(1, step));
  const second = midiFrequency(scaleMidi(1, step + (perfect ? 2 : 1)));
  note(first, c.currentTime, 0.065, "triangle", 0.16, pan);
  note(second, c.currentTime + 0.05, perfect ? 0.16 : 0.115, "triangle", 0.18, pan);
}

export function sfxGolden(combo = 1, pan = 0) {
  const c = audioContext();
  if (!c) return;
  duckMusic(0.16, 0.3);
  const start = c.currentTime;
  const comboStep = Math.min(Math.max(combo - 1, 0), 4);
  [0, 1, 2, 4].forEach((step, index) => {
    note(
      midiFrequency(scaleMidi(1, step + comboStep)),
      start + index * 0.052,
      0.13,
      "triangle",
      0.18,
      pan,
    );
  });
}

export function sfxMilestone(pan = 0) {
  const c = audioContext();
  if (!c) return;
  duckMusic(0.19, 0.28);
  const start = c.currentTime;
  [0, 1, 2, 3, 5].forEach((step, index) => {
    note(
      midiFrequency(scaleMidi(1, step)),
      start + index * 0.06,
      index === 4 ? 0.21 : 0.105,
      "triangle",
      0.17,
      pan,
    );
  });
}

export function sfxMiss(pan = 0) {
  audioContext();
  duckMusic(0.2, 0.22);
  slide(440, 90, 0.22, "square", 0.31, pan);
}

export function sfxGameOver(reason: "hearts" | "time" = "hearts") {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;

  if (reason === "time") {
    [0, 4, 7, 12].forEach((interval, index) => {
      note(
        midiFrequency(currentRoot + 12 + interval),
        start + index * 0.09,
        index === 3 ? 0.32 : 0.13,
        "square",
        0.25,
      );
    });
    return;
  }

  [7, 4, 2, 0].forEach((interval, index) => {
    note(
      midiFrequency(currentRoot + interval),
      start + index * (0.13 + index * 0.015),
      index === 3 ? 0.34 : 0.14,
      "square",
      0.25,
    );
  });
  note(midiFrequency(currentRoot - 12), start + 0.56, 0.4, "triangle", 0.29);
}

export function sfxBlip() {
  const c = audioContext();
  if (!c) return;
  note(midiFrequency(currentRoot + 19), c.currentTime, 0.05, "square", 0.2);
}

export function sfxBoba() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  [69, 74, 79].forEach((midi, index) => {
    note(midiFrequency(midi), start + index * 0.05, index === 2 ? 0.09 : 0.05, "square", 0.18);
  });
}

// --- Arcade effects -----------------------------------------------------

function effectNoise(
  start: number,
  duration: number,
  volume: number,
  filterType: BiquadFilterType,
  frequency: number,
  sweepTo = 0,
  pan = 0,
) {
  if (!ctx || !master) return;
  const buffer = getNoiseBuffer();
  if (!buffer) return;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, start);
  if (sweepTo > 0) filter.frequency.exponentialRampToValueAtTime(sweepTo, start + duration);
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  connectVoice(filter, gain, master, pan);
  source.start(start);
  source.stop(start + duration + 0.02);
}

/** Straw stab: the film pops, then a note that climbs with the combo. */
export function sfxStab(rating: "perfect" | "good" | "graze", combo = 1, pan = 0) {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  duckMusic(0.07, 0.5);
  effectNoise(start, 0.045, rating === "graze" ? 0.09 : 0.15, "highpass", 3_200, 0, pan);
  const step = Math.min(Math.max(combo - 1, 0), 7) + (rating === "perfect" ? 2 : 0);
  note(
    midiFrequency(scaleMidi(1, step)),
    start + 0.012,
    rating === "perfect" ? 0.12 : 0.08,
    "triangle",
    rating === "graze" ? 0.1 : 0.16,
    pan,
  );
}

/** Straw stab: the straw hits the belt instead of a cup. */
export function sfxWhiff(pan = 0) {
  const c = audioContext();
  if (!c) return;
  duckMusic(0.18, 0.3);
  slide(220, 70, 0.16, "square", 0.2, pan);
  effectNoise(c.currentTime, 0.09, 0.14, "lowpass", 600, 0, pan);
}

/** Order up: tea poured into the cup. */
export function sfxPour(step = 0) {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  effectNoise(start, 0.22, 0.07, "bandpass", 500, 1_800);
  note(midiFrequency(scaleMidi(1, step)), start + 0.05, 0.09, "triangle", 0.1);
}

/** Order up: a topping drops in. */
export function sfxPlop(step = 0) {
  audioContext();
  slide(900 - step * 70, 240, 0.1, "sine", 0.24);
}

/** Order up: the cup is emptied. */
export function sfxDump() {
  const c = audioContext();
  if (!c) return;
  effectNoise(c.currentTime, 0.3, 0.12, "lowpass", 2_400, 300);
}

/** Order up: a drink goes out; a tip adds a third note. */
export function sfxServe(tip = false) {
  const c = audioContext();
  if (!c) return;
  duckMusic(0.2, 0.35);
  const start = c.currentTime;
  note(midiFrequency(scaleMidi(2, 0)), start, 0.09, "triangle", 0.18);
  note(midiFrequency(scaleMidi(2, 2)), start + 0.08, tip ? 0.1 : 0.18, "triangle", 0.18);
  if (tip) note(midiFrequency(scaleMidi(2, 4)), start + 0.16, 0.2, "triangle", 0.16);
}

/** Order up: nobody ordered that. */
export function sfxWrong() {
  const c = audioContext();
  if (!c) return;
  duckMusic(0.25, 0.25);
  const start = c.currentTime;
  note(midiFrequency(currentRoot - 1), start, 0.12, "square", 0.15);
  note(midiFrequency(currentRoot - 2), start + 0.13, 0.2, "square", 0.15);
}

/** Order up: a new ticket clips onto the rail. */
export function sfxTicket() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  note(midiFrequency(currentRoot + 31), start, 0.05, "triangle", 0.1);
  note(midiFrequency(currentRoot + 36), start + 0.06, 0.12, "triangle", 0.09);
}

/** Cup stack: a cardboard thunk, pitched up the scale as the tower grows. */
export function sfxPlace(perfect = false, height = 0) {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  duckMusic(0.08, 0.5);
  slide(170, 70, 0.09, "sine", 0.28);
  effectNoise(start, 0.05, 0.1, "lowpass", 900);
  const step = height % 10;
  note(
    midiFrequency(scaleMidi(1, step)),
    start + 0.02,
    perfect ? 0.14 : 0.08,
    "triangle",
    perfect ? 0.17 : 0.11,
  );
  if (perfect) note(midiFrequency(scaleMidi(2, step)), start + 0.08, 0.16, "triangle", 0.12);
}

/** Cup stack: the overhang is sliced away. */
export function sfxSlice() {
  const c = audioContext();
  if (!c) return;
  effectNoise(c.currentTime, 0.12, 0.12, "highpass", 5_200, 1_400);
}

/** Cup stack: the tower's last cup falls. */
export function sfxTopple() {
  audioContext();
  duckMusic(0.4, 0.2);
  slide(300, 50, 0.5, "triangle", 0.26);
}

/** Tea minus: builds the engine voice the first time the throttle opens. */
function ensureThruster() {
  if (thrusterGain) return true;
  const c = audioContext();
  if (!c || !master) return false;
  // Its own two-second buffer: the shared half-second one, looped, repeats
  // often enough to be heard as a flutter under a held throttle.
  if (!thrusterBuffer) {
    const length = Math.floor(c.sampleRate * 2);
    thrusterBuffer = c.createBuffer(1, length, c.sampleRate);
    const channel = thrusterBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  }
  const source = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  source.buffer = thrusterBuffer;
  source.loop = true;
  filter.type = "lowpass";
  filter.frequency.value = 170;
  filter.Q.value = 2.2;
  gain.gain.value = 0;
  source.connect(filter);
  connectVoice(filter, gain, master);
  source.start();
  thrusterGain = gain;
  thrusterGoal = 0;
  return true;
}

/** Fades the engine out (or cuts it, with `glide` 0) without dropping it. */
function quietThruster(glide = 0.02) {
  if (!ctx || !thrusterGain) return;
  const now = ctx.currentTime;
  thrusterGain.gain.cancelScheduledValues(now);
  if (glide > 0) thrusterGain.gain.setTargetAtTime(0, now, glide);
  else thrusterGain.gain.setValueAtTime(0, now);
  thrusterGoal = 0;
}

/**
 * Tea minus: the engine rumble, `level` 0–1, meant to be called every frame.
 * It glides toward each new level instead of jumping, so a tapped throttle
 * puffs rather than clicks. Held silent while the game's audio is paused.
 */
export function setThruster(level: number) {
  const throttle = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  // A closed throttle never needs to wake audio just to stay quiet.
  if (!thrusterGain && throttle === 0) return;
  if (!ensureThruster() || !ctx || !thrusterGain) return;
  const goal = muted || clockHeld || musicPaused ? 0 : throttle * THRUSTER_LEVEL;
  // Only steer on a real change, so a held throttle doesn't stack up an
  // automation event per frame.
  if (Math.abs(goal - thrusterGoal) < 0.004 && (goal > 0 || thrusterGoal === 0)) return;
  thrusterGoal = goal;
  thrusterGain.gain.setTargetAtTime(goal, ctx.currentTime, THRUSTER_GLIDE);
}

/** Tea minus: feet down. A feather-light landing rings a third, higher note. */
export function sfxTouchdown(feather = false) {
  const c = audioContext();
  if (!c) return;
  duckMusic(feather ? 0.5 : 0.36, 0.3);
  const start = c.currentTime;
  note(midiFrequency(currentRoot), start, 0.16, "triangle", 0.18);
  note(midiFrequency(currentRoot + 7), start + 0.17, feather ? 0.16 : 0.26, "triangle", 0.18);
  if (feather) note(midiFrequency(currentRoot + 12), start + 0.34, 0.26, "triangle", 0.13);
}

/** Tea minus: the cup comes down too hard. A soft thud, not a bang. */
export function sfxCrashLanding() {
  const c = audioContext();
  if (!c || !master) return;
  duckMusic(0.6, 0.2);
  const start = c.currentTime;
  // Built here rather than with `slide()`, which floors its sweep at 40 Hz;
  // the thump should sink below that.
  const oscillator = c.createOscillator();
  const gain = c.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(90, start);
  oscillator.frequency.exponentialRampToValueAtTime(26, start + 0.6);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.34, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
  connectVoice(oscillator, gain, master);
  oscillator.start(start);
  oscillator.stop(start + 0.62);
  effectNoise(start, 1.1, 0.16, "lowpass", 1_500, 55);
}

/** Tea minus: coming down too fast near the ground. The caller paces it. */
export function sfxDescentAlarm() {
  const c = audioContext();
  if (!c) return;
  note(132, c.currentTime, 0.09, "triangle", 0.2);
}

/** Tea minus: the tank is nearly dry. Lower and longer than the alarm. */
export function sfxLowFuel() {
  const c = audioContext();
  if (!c) return;
  note(98, c.currentTime, 0.14, "triangle", 0.2);
}

/** Order up: builds the pour voice the first time the tap opens. */
function ensurePour() {
  if (pourGain) return true;
  const c = audioContext();
  if (!c || !master) return false;
  // Shares the thruster's long buffer, for the same reason: the short shared
  // one loops often enough to flutter under a held pour.
  if (!thrusterBuffer) {
    const length = Math.floor(c.sampleRate * 2);
    thrusterBuffer = c.createBuffer(1, length, c.sampleRate);
    const channel = thrusterBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  }
  const source = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  source.buffer = thrusterBuffer;
  source.loop = true;
  filter.type = "bandpass";
  filter.frequency.value = POUR_EMPTY_HZ;
  filter.Q.value = 4;
  gain.gain.value = 0;
  source.connect(filter);
  connectVoice(filter, gain, master);
  source.start();
  pourGain = gain;
  pourFilter = filter;
  pourGoal = 0;
  pourPitch = POUR_EMPTY_HZ;
  return true;
}

/** Fades the pour out (or cuts it, with `glide` 0) without dropping it. */
function quietPour(glide = POUR_GLIDE) {
  if (!ctx || !pourGain) return;
  const now = ctx.currentTime;
  pourGain.gain.cancelScheduledValues(now);
  if (glide > 0) pourGain.gain.setTargetAtTime(0, now, glide);
  else pourGain.gain.setValueAtTime(0, now);
  pourGoal = 0;
}

/**
 * Order up: the tea stream, `level` 0–1 loudness and `fill` 0–1 of the cup,
 * meant to be called every frame while the pour is held. The pitch rises
 * evenly (in octaves, not hertz) from empty to full, so every bit of fill
 * sounds like the same step up. Held silent while the game's audio is paused.
 */
export function setPourStream(level: number, fill = 0) {
  const flow = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  // A closed tap never needs to wake audio just to stay quiet.
  if (!pourGain && flow === 0) return;
  if (!ensurePour() || !ctx || !pourGain || !pourFilter) return;
  const now = ctx.currentTime;
  const goal = muted || clockHeld || musicPaused ? 0 : flow * POUR_LEVEL;
  // Only steer on a real change, so a held pour doesn't stack up an
  // automation event per frame.
  if (Math.abs(goal - pourGoal) >= 0.004 || (goal === 0 && pourGoal > 0)) {
    pourGoal = goal;
    pourGain.gain.setTargetAtTime(goal, now, POUR_GLIDE);
  }
  const level01 = Number.isFinite(fill) ? Math.max(0, Math.min(1, fill)) : 0;
  const pitch = POUR_EMPTY_HZ * Math.pow(POUR_FULL_HZ / POUR_EMPTY_HZ, level01);
  // Half a percent is below what anyone hears as a pitch change.
  if (goal > 0 && Math.abs(pitch - pourPitch) / pourPitch > 0.005) {
    pourPitch = pitch;
    pourFilter.frequency.setTargetAtTime(pitch, now, 0.03);
  }
}

/**
 * A pitch drop that starts at a given time. `slide()` always starts now; the
 * order-up sounds need a second part to land a beat after the first.
 */
function dropAt(
  start: number,
  fromFrequency: number,
  toFrequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  pan = 0,
) {
  if (!ctx || !master) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(fromFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(30, toFrequency),
    start + duration,
  );
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  connectVoice(oscillator, gain, master, pan);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.025);
}

/**
 * Order up: a topping falls from the ladle. A clean drop plops a scale degree
 * higher per scoop in a row; one off the rim ticks first and lands dull; a
 * miss only thuds on the counter.
 */
export function sfxScoop(result: "clean" | "rim" | "miss", step = 0) {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;

  if (result === "miss") {
    dropAt(start, 150, 55, 0.13, "sine", 0.2);
    effectNoise(start, 0.07, 0.07, "lowpass", 420);
    return;
  }

  const degree = Math.min(Math.max(Math.floor(step), 0), 7);
  const top = midiFrequency(scaleMidi(1, degree + 2));
  if (result === "rim") {
    effectNoise(start, 0.014, 0.12, "highpass", 3_800);
    dropAt(start + 0.035, top * 0.75, top * 0.3, 0.07, "sine", 0.17);
    return;
  }
  dropAt(start, top, top * 0.27, 0.11, "sine", 0.24);
}

/**
 * Order up: one shake of a lidded cup of ice. Strokes swing left and right,
 * and each brightens a little toward the eighth, so the mix sounds like it
 * is coming together.
 */
export function sfxShake(step = 0) {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  const count = Math.max(0, Math.floor(step));
  const pan = count % 2 === 0 ? -0.35 : 0.35;
  const progress = Math.min(count, 8) / 8;
  effectNoise(start, 0.045, 0.1 + progress * 0.03, "bandpass", 2_500 + progress * 1_500, 0, pan);
  note(105, start, 0.04, "sine", 0.07, pan);
}

/** Order up: the sealer presses a film lid on, then the film pops taut. */
export function sfxSeal() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  dropAt(start, 420, 140, 0.08, "triangle", 0.18);
  effectNoise(start + 0.09, 0.025, 0.1, "highpass", 3_600);
  note(midiFrequency(scaleMidi(2, 4)), start + 0.09, 0.06, "triangle", 0.11);
}

/**
 * Order up: a customer gives up and leaves. A soft falling pair, quieter and
 * rounder than `sfxWrong`, so it reads as a sigh rather than a buzzer.
 */
export function sfxWalkOut() {
  const c = audioContext();
  if (!c) return;
  duckMusic(0.3, 0.55);
  const start = c.currentTime;
  note(midiFrequency(scaleMidi(1, 2)), start, 0.14, "triangle", 0.12);
  note(midiFrequency(scaleMidi(1, 0)), start + 0.16, 0.28, "triangle", 0.11);
}

export function unlockAudio() {
  audioContext();
}

/** Order up: a scoop of ice clinks into the cup; each scoop a little higher. */
export function sfxIce(step = 0) {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  const lift = Math.min(Math.max(Math.floor(step), 0), 4) * 120;
  effectNoise(start, 0.03, 0.08, "highpass", 4_200 + lift);
  note(1_900 + lift, start + 0.02, 0.05, "sine", 0.07);
  note(2_500 + lift, start + 0.07, 0.04, "sine", 0.05);
}

/** Order up: a tank starts brewing, a low bubbling swell. */
export function sfxBrew() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  effectNoise(start, 0.32, 0.06, "lowpass", 300, 900);
  note(midiFrequency(scaleMidi(0, 0)), start + 0.04, 0.12, "triangle", 0.08);
}

/** Order up: a tank has finished brewing. */
export function sfxBrewed() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  note(midiFrequency(scaleMidi(2, 2)), start, 0.07, "triangle", 0.09);
  note(midiFrequency(scaleMidi(2, 4)), start + 0.07, 0.12, "triangle", 0.08);
}

/** Order up: the sealer was too hot and the film scorches. */
export function sfxScorch() {
  const c = audioContext();
  if (!c) return;
  effectNoise(c.currentTime + 0.08, 0.26, 0.08, "highpass", 2_800, 6_000);
}

/** Order up: a tap runs dry mid-pour and sputters. */
export function sfxSputter() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  effectNoise(start, 0.05, 0.08, "bandpass", 700);
  effectNoise(start + 0.09, 0.04, 0.05, "bandpass", 600);
}

/**
 * Order up's demo: the pour stream while the shift's music is paused under
 * the demo. Same as setPourStream, but heard through that pause, since the
 * demo plays its sounds while the shift waits.
 */
export function setDemoPourStream(level: number, fill = 0) {
  const held = musicPaused;
  musicPaused = false;
  try {
    setPourStream(level, fill);
  } finally {
    musicPaused = held;
  }
}

// --- Sugar rush and spill ---------------------------------------------------

// Two more steered loops, built on first use like the thruster: sugar rush's
// straw rotor and spill's pour. Both read the same long noise buffer, and
// `quietLoops` silences them wherever the thruster and order up's pour are.
const GLIDE_LEVEL = 0.16;
const GLIDE_TIME = 0.04;
const SPILL_POUR_LEVEL = 0.2;
const SPILL_POUR_GLIDE = 0.015;
let glideGain: GainNode | null = null;
let glideGoal = 0;
let spillPourGain: GainNode | null = null;
let spillPourGoal = 0;

function longNoise(c: AudioContext) {
  if (!thrusterBuffer) {
    const length = Math.floor(c.sampleRate * 2);
    thrusterBuffer = c.createBuffer(1, length, c.sampleRate);
    const channel = thrusterBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  }
  return thrusterBuffer;
}

/** Fades both loops out (or cuts them, with `glide` 0) without dropping them. */
function quietLoops(glide = 0.015) {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const gain of [glideGain, spillPourGain]) {
    if (!gain) continue;
    gain.gain.cancelScheduledValues(now);
    if (glide > 0) gain.gain.setTargetAtTime(0, now, glide);
    else gain.gain.setValueAtTime(0, now);
  }
  glideGoal = 0;
  spillPourGoal = 0;
}

/**
 * A looping noise voice through a band-pass, with a slow sine wobbling
 * either its loudness (`wobble: "gain"`, a rotor's chop) or its centre
 * (`wobble: "pitch"`, a stream's warble). Returns its outer gain, at zero.
 */
function buildLoop(
  c: AudioContext,
  frequency: number,
  q: number,
  wobble: "gain" | "pitch",
  rate: number,
  depth: number,
) {
  if (!master) return null;
  const source = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const shaper = c.createGain();
  const gain = c.createGain();
  const lfo = c.createOscillator();
  const lfoDepth = c.createGain();
  source.buffer = longNoise(c);
  source.loop = true;
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = q;
  shaper.gain.value = wobble === "gain" ? 1 - depth : 1;
  gain.gain.value = 0;
  lfo.frequency.value = rate;
  lfoDepth.gain.value = depth;
  lfo.connect(lfoDepth).connect(wobble === "gain" ? shaper.gain : filter.frequency);
  source.connect(filter).connect(shaper);
  connectVoice(shaper, gain, master);
  source.start();
  lfo.start();
  return gain;
}

/** Steers a loop toward `goal`, only on a real change. Returns the new goal. */
function steerLoop(gain: GainNode, current: number, goal: number, glide: number) {
  if (!ctx) return current;
  if (Math.abs(goal - current) < 0.004 && (goal > 0 || current === 0)) return current;
  gain.gain.setTargetAtTime(goal, ctx.currentTime, glide);
  return goal;
}

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/**
 * Sugar rush: the straw rotor's soft whirr while gliding, `level` 0–1, meant
 * to be called every frame. Held silent while the game's audio is paused.
 */
export function setRunGlide(level: number) {
  const spin = clamp01(level);
  // A still rotor never needs to wake audio just to stay quiet.
  if (!glideGain && spin === 0) return;
  if (!glideGain) {
    const c = audioContext();
    if (!c) return;
    glideGain = buildLoop(c, 1_100, 2.5, "gain", 17, 0.4);
    glideGoal = 0;
  }
  if (!ctx || !glideGain) return;
  const goal = muted || clockHeld || musicPaused ? 0 : spin * GLIDE_LEVEL;
  glideGoal = steerLoop(glideGain, glideGoal, goal, GLIDE_TIME);
}

/** Sugar rush: feet leave the roof. */
export function sfxRunJump() {
  const c = audioContext();
  if (!c) return;
  dropAt(c.currentTime, 260, 560, 0.09, "triangle", 0.13);
  effectNoise(c.currentTime, 0.04, 0.04, "highpass", 2_600);
}

/** Sugar rush: feet back down, a soft pad; a hard landing adds a low thud. */
export function sfxRunLand(hard = false) {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  effectNoise(start, 0.05, 0.08, "lowpass", 700);
  if (hard) {
    duckMusic(0.12, 0.55);
    dropAt(start, 120, 45, 0.14, "sine", 0.22);
  }
}

/** Sugar rush: a short filtered swish under a low beam. */
export function sfxRunSlide() {
  const c = audioContext();
  if (!c) return;
  effectNoise(c.currentTime, 0.2, 0.08, "bandpass", 2_600, 700);
}

/** Sugar rush: a pearl picked up, a pluck that climbs the scale with the combo. */
export function sfxRunPearl(combo = 1) {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  const step = Math.min(Math.max(Math.floor(combo) - 1, 0), 7);
  effectNoise(start, 0.015, 0.05, "highpass", 4_000);
  note(midiFrequency(scaleMidi(2, step)), start, 0.07, "triangle", 0.12);
}

/** Sugar rush: tea sloshes out of the cup; `amount` 0–1 sets how wet. */
export function sfxRunSpill(amount = 0.2) {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  const wet = clamp01(amount);
  effectNoise(start, 0.12 + wet * 0.12, 0.05 + wet * 0.1, "bandpass", 1_300, 400);
  dropAt(start + 0.02, 700, 240, 0.06, "sine", 0.06 + wet * 0.08);
}

/** Sugar rush: ran into a crate. */
export function sfxRunBump() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  duckMusic(0.14, 0.5);
  dropAt(start, 200, 85, 0.1, "sine", 0.2);
  effectNoise(start, 0.06, 0.08, "lowpass", 500);
}

/** Sugar rush: a crate broken through during a rush. */
export function sfxRunSmash() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  duckMusic(0.12, 0.5);
  effectNoise(start, 0.18, 0.13, "bandpass", 1_700, 500);
  effectNoise(start + 0.03, 0.08, 0.08, "lowpass", 800);
  dropAt(start, 170, 65, 0.1, "sine", 0.16);
}

/** Sugar rush: bounced off an awning. */
export function sfxRunBounce() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  dropAt(start, 170, 480, 0.1, "sine", 0.18);
  dropAt(start + 0.09, 480, 360, 0.1, "sine", 0.1);
}

/** Sugar rush: off the edge of a roof, a long sinking slide. */
export function sfxRunFall() {
  const c = audioContext();
  if (!c) return;
  duckMusic(0.5, 0.3);
  dropAt(c.currentTime, midiFrequency(scaleMidi(2, 0)), 110, 0.55, "triangle", 0.18);
}

/** Sugar rush: a doorbell at the delivery; a full cup rings a third, brighter note. */
export function sfxRunDeliver(full = false) {
  const c = audioContext();
  if (!c) return;
  duckMusic(full ? 0.4 : 0.3, 0.35);
  const start = c.currentTime;
  note(midiFrequency(scaleMidi(2, 2)), start, 0.14, "triangle", 0.17);
  note(midiFrequency(scaleMidi(2, 0)), start + 0.15, full ? 0.14 : 0.26, "triangle", 0.16);
  if (full) note(midiFrequency(scaleMidi(3, 0)), start + 0.3, 0.24, "triangle", 0.14);
}

/** Sugar rush: a sugar rush kicks in, a quick climb. */
export function sfxRushStart() {
  const c = audioContext();
  if (!c) return;
  duckMusic(0.25, 0.4);
  const start = c.currentTime;
  effectNoise(start, 0.2, 0.05, "bandpass", 800, 4_000);
  [0, 1, 2, 4].forEach((step, index) => {
    note(midiFrequency(scaleMidi(1, step)), start + index * 0.045, 0.08, "triangle", 0.14);
  });
}

/** Sugar rush: the rush wears off, two notes settling down. */
export function sfxRushEnd() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  note(midiFrequency(scaleMidi(1, 4)), start, 0.09, "triangle", 0.11);
  note(midiFrequency(scaleMidi(1, 2)), start + 0.1, 0.16, "triangle", 0.1);
}

/**
 * Spill: the poured stream, `level` 0–1, meant to be called every frame. A
 * soft band of noise with a slight warble. Held silent while the game's
 * audio is paused.
 */
export function setPour(level: number) {
  const flow = clamp01(level);
  // A closed tap never needs to wake audio just to stay quiet.
  if (!spillPourGain && flow === 0) return;
  if (!spillPourGain) {
    const c = audioContext();
    if (!c) return;
    spillPourGain = buildLoop(c, 900, 2.5, "pitch", 5, 110);
    spillPourGoal = 0;
  }
  if (!ctx || !spillPourGain) return;
  const goal = muted || clockHeld || musicPaused ? 0 : flow * SPILL_POUR_LEVEL;
  spillPourGoal = steerLoop(spillPourGain, spillPourGoal, goal, SPILL_POUR_GLIDE);
}

/** Spill: one droplet lands in the cup; `pitch` 0–1 rises as the cup fills. */
export function sfxDrop(pitch = 0) {
  const c = audioContext();
  if (!c) return;
  const top = midiFrequency(scaleMidi(2, Math.round(clamp01(pitch) * 7)));
  dropAt(c.currentTime, top * 0.7, top, 0.05, "sine", 0.08);
}

/** Spill: tea on the floor. */
export function sfxSplash() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  effectNoise(start, 0.2, 0.1, "bandpass", 1_800, 450);
  dropAt(start, 150, 70, 0.08, "sine", 0.1);
}

/** Spill: boiled off on a hot plate. */
export function sfxSizzle() {
  const c = audioContext();
  if (!c) return;
  effectNoise(c.currentTime, 0.32, 0.06, "highpass", 4_000, 7_000);
}

/** Spill: soaked up by a sponge. */
export function sfxSponge() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  effectNoise(start, 0.18, 0.07, "lowpass", 900, 250);
  dropAt(start, 220, 120, 0.09, "sine", 0.08);
}

/** Spill: off a jelly block. */
export function sfxBoing() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  dropAt(start, 140, 380, 0.08, "sine", 0.17);
  dropAt(start + 0.08, 380, 260, 0.14, "sine", 0.1);
}

/** Spill: through a pipe, a hollow gulp. */
export function sfxPipe() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  effectNoise(start, 0.15, 0.06, "bandpass", 500, 1_100);
  dropAt(start, 200, 320, 0.12, "sine", 0.12);
}

/** Spill: a gate swings open. */
export function sfxGate() {
  const c = audioContext();
  if (!c) return;
  const start = c.currentTime;
  effectNoise(start, 0.02, 0.06, "highpass", 3_000);
  note(midiFrequency(scaleMidi(1, 0)), start, 0.07, "triangle", 0.12);
  note(midiFrequency(scaleMidi(1, 2)), start + 0.07, 0.12, "triangle", 0.12);
}

/** Spill: a soft pencil tick as a stroke grows. The caller paces it. */
export function sfxDraw() {
  const c = audioContext();
  if (!c) return;
  effectNoise(c.currentTime, 0.02, 0.035, "highpass", 2_800 + Math.random() * 1_200);
}

/** Spill: a straw rubbed out. */
export function sfxErase() {
  const c = audioContext();
  if (!c) return;
  effectNoise(c.currentTime, 0.12, 0.07, "bandpass", 1_500, 3_500);
}

/** Spill: the room is cleared, one bright note per star, climbing. */
export function sfxRoomClear(stars = 1) {
  const c = audioContext();
  if (!c) return;
  const count = Math.min(Math.max(Math.floor(stars), 1), 3);
  duckMusic(0.2 + count * 0.12, 0.3);
  const start = c.currentTime;
  for (let index = 0; index < count; index++) {
    note(
      midiFrequency(scaleMidi(2, index * 2)),
      start + index * 0.12,
      index === count - 1 ? 0.24 : 0.11,
      "triangle",
      0.16,
    );
  }
}

/** Spill: the room failed, a short, gentle falling pair. */
export function sfxRoomFail() {
  const c = audioContext();
  if (!c) return;
  duckMusic(0.3, 0.5);
  const start = c.currentTime;
  note(midiFrequency(scaleMidi(1, 2)), start, 0.13, "triangle", 0.12);
  note(midiFrequency(scaleMidi(1, 0)), start + 0.15, 0.26, "triangle", 0.11);
}
