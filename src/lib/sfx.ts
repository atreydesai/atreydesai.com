// Procedural Web Audio for the boba minigame. The engine is intentionally
// asset-free: small oscillator voices, filtered noise drums, keyed feedback,
// and a short look-ahead scheduler keep it light and responsive.

const MASTER_LEVEL = 0.48;
const MUTE_KEY = "boba_muted_v2";
const MUSIC_LOOKAHEAD_SECONDS = 0.24;
const MUSIC_TICK_MS = 75;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let muted = false;
let muteLoaded = false;
let musicOn = false;
let musicPaused = false;
let musicPhase: MusicPhase = "opening";
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let musicStopTimer: ReturnType<typeof setTimeout> | null = null;
let activeMusicSources = new Set<AudioScheduledSourceNode>();

type MusicPhase = "opening" | "steady" | "rush";
type NoteSeq = [number, number][];

interface Song {
  name: string;
  bpm: number;
  wave: OscillatorType;
  root: number;
  scale: number[];
  lead: NoteSeq;
  bass: NoteSeq;
}

let songIndex = 0;
let barIndex = 0;
let nextBarTime = 0;
let currentRoot = 60;
let currentScale = [0, 2, 4, 7, 9];

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

function trackMusicSource(source: AudioScheduledSourceNode) {
  activeMusicSources.add(source);
  source.addEventListener(
    "ended",
    () => {
      activeMusicSources.delete(source);
    },
    { once: true },
  );
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
  trackAsMusic = false,
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
  if (trackAsMusic) trackMusicSource(oscillator);
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
  if (!musicBus || !musicFilter) {
    musicBus = c.createGain();
    musicFilter = c.createBiquadFilter();
    musicBus.gain.value = phaseMusicLevel();
    musicFilter.type = "lowpass";
    musicFilter.frequency.value = 14_000;
    musicFilter.Q.value = 0.35;
    musicBus.connect(musicFilter).connect(master);
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

function noiseHit(
  start: number,
  duration: number,
  volume: number,
  filterType: BiquadFilterType,
  frequency: number,
) {
  if (!ctx || !musicBus) return;
  const buffer = getNoiseBuffer();
  if (!buffer) return;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(musicBus);
  source.start(start);
  source.stop(start + duration + 0.02);
  trackMusicSource(source);
}

function kick(start: number, volume = 0.16) {
  if (!ctx || !musicBus) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(135, start);
  oscillator.frequency.exponentialRampToValueAtTime(48, start + 0.11);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
  oscillator.connect(gain).connect(musicBus);
  oscillator.start(start);
  oscillator.stop(start + 0.17);
  trackMusicSource(oscillator);
}

function clap(start: number) {
  noiseHit(start, 0.11, 0.085, "bandpass", 1_650);
  noiseHit(start + 0.022, 0.08, 0.045, "bandpass", 2_150);
}

function hat(start: number, strong = false) {
  noiseHit(start, strong ? 0.055 : 0.032, strong ? 0.037 : 0.024, "highpass", 5_800);
}

function phaseMusicLevel() {
  if (musicPhase === "rush") return 0.57;
  if (musicPhase === "steady") return 0.53;
  return 0.49;
}

function scheduleSequenceWindow(
  sequence: NoteSeq,
  windowStartBeat: number,
  windowEndBeat: number,
  barStart: number,
  secondsPerBeat: number,
  wave: OscillatorType,
  volume: number,
) {
  if (!musicBus) return;
  let beat = 0;
  for (const [midi, beats] of sequence) {
    if (beat >= windowStartBeat && beat < windowEndBeat && midi > 0) {
      const localBeat = beat - windowStartBeat;
      note(
        midiFrequency(midi),
        barStart + localBeat * secondsPerBeat,
        Math.max(0.045, beats * secondsPerBeat * 0.88),
        wave,
        volume,
        0,
        musicBus,
        true,
      );
    }
    beat += beats;
  }
}

function scheduleDrums(barStart: number, secondsPerBeat: number) {
  if (musicPhase === "opening") return;

  kick(barStart);
  kick(barStart + 2 * secondsPerBeat, 0.14);
  clap(barStart + secondsPerBeat);
  clap(barStart + 3 * secondsPerBeat);

  const step = musicPhase === "rush" ? 0.25 : 0.5;
  for (let beat = 0; beat < 4; beat += step) {
    hat(barStart + beat * secondsPerBeat, beat % 1 === 0);
  }

  if (musicPhase === "rush") {
    kick(barStart + 1.5 * secondsPerBeat, 0.09);
    kick(barStart + 3.5 * secondsPerBeat, 0.09);
  }
}

function scheduleBar(song: Song, index: number, start: number) {
  const secondsPerBeat = 60 / song.bpm;
  const cycleBar = index % 4;
  const windowStart = cycleBar * 4;

  scheduleSequenceWindow(
    song.lead,
    windowStart,
    windowStart + 4,
    start,
    secondsPerBeat,
    song.wave,
    musicPhase === "rush" ? 0.19 : 0.175,
  );
  scheduleSequenceWindow(
    song.bass,
    0,
    4,
    start,
    secondsPerBeat,
    "triangle",
    0.17,
  );
  scheduleDrums(start, secondsPerBeat);
}

function clearMusicTimer() {
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

function clearMusicStopTimer() {
  if (musicStopTimer) {
    clearTimeout(musicStopTimer);
    musicStopTimer = null;
  }
}

function stopScheduledMusic(afterSeconds = 0) {
  if (!ctx) return;
  const stopAt = ctx.currentTime + Math.max(0, afterSeconds);
  for (const source of activeMusicSources) {
    try {
      source.stop(stopAt);
    } catch {
      // A source may already have ended.
    }
  }
  if (afterSeconds === 0) activeMusicSources.clear();
}

function runMusicScheduler() {
  clearMusicTimer();
  if (!ctx || !musicOn || musicPaused) return;

  const horizon = ctx.currentTime + MUSIC_LOOKAHEAD_SECONDS;
  while (nextBarTime < horizon) {
    const song = SONGS[songIndex];
    if (barIndex === 0) {
      currentRoot = song.root;
      currentScale = song.scale;
      songListener?.(song.name);
    }

    scheduleBar(song, barIndex, nextBarTime);
    nextBarTime += 4 * (60 / song.bpm);
    barIndex += 1;

    if (barIndex >= 8) {
      barIndex = 0;
      songIndex = (songIndex + 1) % SONGS.length;
    }
  }

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

export function onSongChange(callback: ((name: string) => void) | null) {
  songListener = callback;
}

export function setMusicPhase(phase: MusicPhase) {
  musicPhase = phase;
  if (!ctx || !musicBus || musicPaused || !musicOn) return;
  const now = ctx.currentTime;
  hold(musicBus.gain, now);
  musicBus.gain.linearRampToValueAtTime(phaseMusicLevel(), now + 0.2);
}

export function startMusic() {
  if (!ensureMusicGraph() || !ctx || !musicBus || !musicFilter) return;
  clearMusicTimer();
  clearMusicStopTimer();
  stopScheduledMusic();

  musicOn = true;
  musicPaused = false;
  songIndex = 0;
  barIndex = 0;
  currentRoot = SONGS[0].root;
  currentScale = SONGS[0].scale;
  nextBarTime = ctx.currentTime + 0.12;

  const now = ctx.currentTime;
  hold(musicBus.gain, now);
  musicBus.gain.exponentialRampToValueAtTime(phaseMusicLevel(), now + 0.16);
  musicFilter.frequency.cancelScheduledValues(now);
  musicFilter.frequency.setValueAtTime(Math.max(650, musicFilter.frequency.value), now);
  musicFilter.frequency.exponentialRampToValueAtTime(14_000, now + 0.2);
  runMusicScheduler();
}

export function setMusicPaused(paused: boolean) {
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
  nextBarTime = now + 0.12;
  hold(musicBus.gain, now);
  musicBus.gain.exponentialRampToValueAtTime(phaseMusicLevel(), now + 0.12);
  runMusicScheduler();
}

export function finishMusic() {
  if (!ctx || !musicBus || !musicFilter) {
    musicOn = false;
    clearMusicTimer();
    return;
  }

  musicOn = false;
  musicPaused = false;
  clearMusicTimer();
  clearMusicStopTimer();
  const now = ctx.currentTime;
  hold(musicBus.gain, now);
  musicBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.44);
  musicFilter.frequency.cancelScheduledValues(now);
  musicFilter.frequency.setValueAtTime(Math.max(650, musicFilter.frequency.value), now);
  musicFilter.frequency.exponentialRampToValueAtTime(650, now + 0.34);
  stopScheduledMusic(0.48);
  musicStopTimer = setTimeout(() => {
    activeMusicSources.clear();
    musicStopTimer = null;
  }, 520);
}

export function stopMusic() {
  musicOn = false;
  musicPaused = false;
  clearMusicTimer();
  clearMusicStopTimer();
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

export function unlockAudio() {
  audioContext();
}

const SONGS: Song[] = [
  {
    name: "HEYYYYYTEA",
    bpm: 144,
    wave: "square",
    root: 60,
    scale: [0, 2, 4, 7, 9],
    lead: [
      [72, 0.5], [76, 0.5], [79, 0.5], [84, 0.5],
      [83, 0.5], [79, 0.5], [76, 0.5], [79, 0.5],
      [77, 0.5], [74, 0.5], [77, 0.5], [81, 0.5],
      [79, 0.5], [76, 0.5], [72, 0.5], [74, 0.5],
      [76, 0.5], [79, 0.5], [84, 0.5], [86, 0.5],
      [84, 0.5], [81, 0.5], [79, 0.5], [76, 0.5],
      [72, 1], [74, 1], [76, 1], [72, 1],
    ],
    bass: [[36, 1], [43, 1], [41, 1], [43, 1]],
  },
  {
    name: "CHAGEE (자기야)",
    bpm: 128,
    wave: "triangle",
    root: 57,
    scale: [0, 3, 5, 7, 10],
    lead: [
      [76, 0.5], [79, 0.5], [81, 1], [79, 0.5], [76, 0.5], [74, 1],
      [72, 0.5], [74, 0.5], [76, 1], [74, 0.5], [72, 0.5], [69, 1],
      [76, 0.5], [79, 0.5], [81, 0.5], [79, 0.5],
      [76, 0.5], [74, 0.5], [72, 1], [69, 1], [72, 1], [69, 2],
    ],
    bass: [[45, 1.5], [40, 1.5], [43, 1]],
  },
  {
    name: "moge mog",
    bpm: 152,
    wave: "square",
    root: 53,
    scale: [0, 2, 4, 7, 9],
    lead: [
      [65, 0.5], [69, 0.5], [72, 0.5], [69, 0.5],
      [70, 0.5], [69, 0.5], [67, 0.5], [65, 0.5],
      [67, 0.5], [70, 0.5], [74, 0.5], [70, 0.5],
      [72, 0.5], [70, 0.5], [69, 0.5], [67, 0.5],
      [65, 0.5], [72, 0.5], [77, 0.5], [72, 0.5],
      [76, 0.5], [72, 0.5], [69, 0.5], [65, 0.5],
      [67, 1], [65, 1], [69, 1], [65, 1],
    ],
    bass: [[41, 1], [36, 1], [43, 1], [36, 1]],
  },
  {
    name: "ume zoome",
    bpm: 162,
    wave: "sawtooth",
    root: 55,
    scale: [0, 2, 4, 7, 9],
    lead: [
      [67, 0.25], [69, 0.25], [71, 0.25], [72, 0.25],
      [74, 0.25], [76, 0.25], [78, 0.25], [79, 0.25],
      [78, 0.25], [76, 0.25], [74, 0.25], [72, 0.25],
      [71, 0.25], [69, 0.25], [67, 0.25], [69, 0.25],
      [71, 0.25], [72, 0.25], [74, 0.25], [76, 0.25],
      [78, 0.25], [79, 0.25], [81, 0.25], [83, 0.25],
      [81, 0.25], [79, 0.25], [78, 0.25], [76, 0.25],
      [74, 0.25], [72, 0.25], [71, 0.25], [69, 0.25],
      [67, 0.5], [74, 0.5], [79, 0.5], [74, 0.5],
      [71, 0.5], [74, 0.5], [79, 0.5], [83, 0.5],
      [79, 1], [76, 1], [74, 1], [67, 1],
    ],
    bass: [[43, 1], [50, 1], [48, 1], [50, 1]],
  },
];
