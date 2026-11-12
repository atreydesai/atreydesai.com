// Reading the songbook: the notation in `./songs` turned into numbers the
// engine can schedule, plus the bit of music theory it needs (pitches, chord
// degrees, swing) and where each bar of a run falls. Pure data in, data out:
// no Web Audio here, so all of it runs under `node --test`.

import type { Chord, ChordQuality, Groove, MusicPhase, Section, Song } from "./songs";

export const BEATS_PER_BAR = 4;
export const STEPS_PER_BAR = 16;
export const ARP_STEPS = 8;
/** Bars in a section. */
export const SECTION_BARS = 8;
/** How long the listening form stays on one song: each section twice. */
export const LISTEN_BARS_PER_SONG = 32;

const EPSILON = 1e-6;

// --- Pitch ----------------------------------------------------------------

const LETTERS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** MIDI number of a note name with octave: `c4` is 60, `eb4` 63, `f#5` 78. */
export function parsePitch(name: string): number {
  const match = /^([a-g])(#|b)?(-?\d)$/.exec(name.trim().toLowerCase());
  if (!match) throw new Error(`Not a pitch: "${name}"`);
  const [, letter, accidental, octave] = match;
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return 12 * (Number(octave) + 1) + LETTERS[letter] + shift;
}

export function midiToHz(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Splits `token/beats` (beats 1 when omitted; `.5` reads as 0.5). */
function splitDuration(token: string): [string, number] {
  const slash = token.lastIndexOf("/");
  if (slash < 0) return [token, 1];
  const beats = Number(token.slice(slash + 1));
  if (!Number.isFinite(beats) || beats <= 0) throw new Error(`Bad duration in "${token}"`);
  return [token.slice(0, slash), beats];
}

function tokens(line: string) {
  return line.trim().split(/\s+/).filter(Boolean);
}

// --- Melody ---------------------------------------------------------------

export interface MelodyNote {
  /** Beat within the bar the note starts on. */
  beat: number;
  beats: number;
  /** MIDI number, or null for a rest. */
  midi: number | null;
}

export function parseMelody(line: string): MelodyNote[] {
  let beat = 0;
  return tokens(line).map((token) => {
    const [pitch, beats] = splitDuration(token);
    const note = { beat, beats, midi: pitch === "-" ? null : parsePitch(pitch) };
    beat += beats;
    return note;
  });
}

/** Total beats of a parsed line. */
export function lineBeats(notes: { beats: number }[]) {
  return notes.reduce((total, note) => total + note.beats, 0);
}

// --- Chords ---------------------------------------------------------------

export interface ChordSpan {
  name: string;
  beat: number;
  beats: number;
}

export function parseChordBar(bar: string): ChordSpan[] {
  let beat = 0;
  const spans = tokens(bar).map((token) => {
    const [name, beats] = splitDuration(token);
    const span = { name, beat, beats };
    beat += beats;
    return span;
  });
  // A lone chord fills the bar however it is written.
  if (spans.length === 1) spans[0].beats = BEATS_PER_BAR;
  return spans;
}

/** The chord sounding at `beat` of a parsed chord bar. */
export function chordAt(spans: ChordSpan[], beat: number): ChordSpan {
  let current = spans[0];
  for (const span of spans) {
    if (span.beat <= beat + EPSILON) current = span;
  }
  return current;
}

export interface ParsedChord {
  /** The voicing the keys play, as written. */
  keys: number[];
  /** The note the bass calls its root. */
  root: number;
  quality: ChordQuality;
}

export function parseChord(chord: Chord): ParsedChord {
  return {
    keys: tokens(chord.keys).map(parsePitch),
    root: parsePitch(chord.bass),
    quality: chord.quality,
  };
}

// --- Bass -----------------------------------------------------------------

export type BassDegree = "R" | "3" | "5" | "7" | "8" | ">" | "-";
const BASS_DEGREES = new Set<string>(["R", "3", "5", "7", "8", ">", "-"]);

export interface BassNote {
  beat: number;
  beats: number;
  degree: BassDegree;
}

export function parseBassLine(line: string): BassNote[] {
  let beat = 0;
  return tokens(line).map((token) => {
    const [degree, beats] = splitDuration(token);
    if (!BASS_DEGREES.has(degree)) throw new Error(`Not a bass degree: "${token}"`);
    const note = { beat, beats, degree: degree as BassDegree };
    beat += beats;
    return note;
  });
}

/** Semitones above the root of a chord's own third and seventh. */
export const QUALITY_INTERVALS: Record<ChordQuality, { third: number; seventh: number }> = {
  maj: { third: 4, seventh: 11 },
  min: { third: 3, seventh: 10 },
  dom: { third: 4, seventh: 10 },
  // A sus chord's "third" is its fourth.
  sus: { third: 5, seventh: 10 },
  // A m6 chord's "seventh" is its sixth.
  m6: { third: 3, seventh: 9 },
};

/** A semitone under `nextRoot`, moved to the octave nearest `root`. */
export function approachNote(root: number, nextRoot: number) {
  const target = nextRoot - 1;
  const pitchClass = ((target % 12) + 12) % 12;
  // Nearest note of that pitch class to the current root; ties go down.
  let best = root - 6 + ((((pitchClass - (root - 6)) % 12) + 12) % 12);
  if (best - root > 5) best -= 12;
  return best;
}

/**
 * The MIDI note a bass degree names against `chord`. `nextRoot` is the bass
 * note of the next bar's first chord, for `>`. Null for a rest.
 */
export function bassMidi(degree: BassDegree, chord: ParsedChord, nextRoot: number): number | null {
  const root = chord.root;
  const intervals = QUALITY_INTERVALS[chord.quality];
  switch (degree) {
    case "R":
      return root;
    case "3":
      return root + intervals.third;
    case "5":
      return root + 7;
    case "7":
      return root + intervals.seventh;
    case "8":
      return root + 12;
    case ">":
      return approachNote(root, nextRoot);
    default:
      return null;
  }
}

// --- Patterns -------------------------------------------------------------

/** One step of a pattern: accent, hit, ghost, or nothing. */
export type Hit = "X" | "x" | "o" | null;

export function parsePattern(pattern: string, length = STEPS_PER_BAR): Hit[] {
  if (pattern.length !== length) {
    throw new Error(`Pattern "${pattern}" has ${pattern.length} steps, not ${length}`);
  }
  return [...pattern].map((char) => {
    if (char === "X" || char === "x" || char === "o") return char;
    if (char === ".") return null;
    throw new Error(`Bad pattern step "${char}" in "${pattern}"`);
  });
}

/** Arp steps: an index into the chord's voicing, or null for a rest. */
export function parseArp(arp: string): (number | null)[] {
  if (arp.length !== ARP_STEPS) throw new Error(`Arp "${arp}" is not ${ARP_STEPS} steps`);
  return [...arp].map((char) => {
    if (char === ".") return null;
    if (/^[0-3]$/.test(char)) return Number(char);
    throw new Error(`Bad arp step "${char}" in "${arp}"`);
  });
}

/**
 * Beat within the bar of sixteenth `step`. Even steps (every eighth) stay
 * on the grid; odd ones land `swing` of the way through their eighth.
 */
export function stepBeat(step: number, swing: number) {
  const eighth = Math.floor(step / 2);
  return step % 2 === 0 ? eighth / 2 : (eighth + swing) / 2;
}

/** The beats within the bar that a pattern strikes, in order. */
export function hitBeats(pattern: Hit[] | null, swing: number): number[] {
  if (!pattern) return [];
  return pattern.flatMap((hit, step) => (hit ? [stepBeat(step, swing)] : []));
}

export interface PumpPoint {
  /** Seconds from the bar line. */
  time: number;
  value: number;
}

/**
 * A sidechain pump over one bar, as the breakpoints of a piecewise-linear
 * gain: at each kick (beats in `kicks`) it falls to `1 - depth` over `drop`
 * seconds, then climbs back to 1 over `swell` seconds from the kick. A kick
 * that comes before the climb finishes starts its fall from wherever the
 * climb got to, and the last climb hurries so the bar always ends at 1: a
 * bar never leaves anything ramping across its bar line. Before the first
 * kick the gain rests at 1.
 */
export function pumpShape(
  kicks: number[],
  beat: number,
  barLength: number,
  depth: number,
  drop: number,
  swell: number,
): PumpPoint[] {
  const low = 1 - Math.min(1, Math.max(0, depth));
  const times = kicks.map((b) => b * beat).filter((t) => t >= 0 && t < barLength);
  const points: PumpPoint[] = [];
  let value = 1;
  times.forEach((t, n) => {
    const next = times[n + 1] ?? barLength;
    const bottom = t + Math.min(drop, (next - t) / 2);
    const top = t + Math.max(swell, bottom - t + 1e-4);
    // Pin where the gain is, so the fall starts from there (a cut-short
    // climb already ends on this kick).
    if (points[points.length - 1]?.time !== t) points.push({ time: t, value });
    points.push({ time: bottom, value: low });
    if (top <= next || n === times.length - 1) {
      value = 1;
      points.push({ time: Math.min(top, next), value });
    } else {
      value = low + ((1 - low) * (next - bottom)) / (top - bottom);
      points.push({ time: next, value });
    }
  });
  return points;
}

// --- Whole songs ----------------------------------------------------------

export interface ParsedGroove {
  kick: Hit[] | null;
  snare: Hit[] | null;
  rim: Hit[] | null;
  hat: Hit[] | null;
  open: Hit[] | null;
  shaker: Hit[] | null;
  comp: Hit[];
  bass: BassNote[];
}

export interface ParsedSection {
  chords: ChordSpan[][];
  melody: MelodyNote[][];
}

export interface ParsedSong {
  song: Song;
  chords: Record<string, ParsedChord>;
  sections: ParsedSection[];
  grooves: Record<MusicPhase, ParsedGroove>;
  fill: { kick: Hit[]; snare: Hit[] };
  arp: (number | null)[];
}

function optionalPattern(pattern: string | undefined) {
  return pattern ? parsePattern(pattern) : null;
}

function parseGroove(groove: Groove): ParsedGroove {
  return {
    kick: optionalPattern(groove.kick),
    snare: optionalPattern(groove.snare),
    rim: optionalPattern(groove.rim),
    hat: optionalPattern(groove.hat),
    open: optionalPattern(groove.open),
    shaker: optionalPattern(groove.shaker),
    comp: parsePattern(groove.comp),
    bass: parseBassLine(groove.bass),
  };
}

function parseSection(section: Section): ParsedSection {
  return {
    chords: section.chords.map(parseChordBar),
    melody: section.melody.map(parseMelody),
  };
}

const cache = new WeakMap<Song, ParsedSong>();

/** The whole song in numbers, parsed once and then cached. */
export function parseSong(song: Song): ParsedSong {
  const cached = cache.get(song);
  if (cached) return cached;
  const chords: Record<string, ParsedChord> = {};
  for (const [name, chord] of Object.entries(song.chords)) chords[name] = parseChord(chord);
  const parsed: ParsedSong = {
    song,
    chords,
    sections: song.sections.map(parseSection),
    grooves: {
      opening: parseGroove(song.grooves.opening),
      steady: parseGroove(song.grooves.steady),
      rush: parseGroove(song.grooves.rush),
    },
    fill: { kick: parsePattern(song.fill.kick), snare: parsePattern(song.fill.snare) },
    arp: parseArp(song.arp),
  };
  cache.set(song, parsed);
  return parsed;
}

/** The chord (looked up in the song) sounding at `beat` of a section's bar. */
export function chordInBar(parsed: ParsedSong, section: number, bar: number, beat: number) {
  const span = chordAt(parsed.sections[section].chords[bar], beat);
  const chord = parsed.chords[span.name];
  if (!chord) throw new Error(`${parsed.song.name}: chord "${span.name}" is not defined`);
  return chord;
}

// --- Where each bar falls -------------------------------------------------

export interface BarSlot {
  /** Index into the songbook. */
  song: number;
  section: number;
  /** 0–7 within the section. */
  barInSection: number;
  /** Bars since this song came on. */
  barInSong: number;
  /** How many times this section has already been played this time round. */
  lap: number;
}

/** How a run lays out its songs: short turns for a game's beat, or whole songs. */
export type MusicForm = "rhythm" | "listening";

/**
 * Where bar `bar` (counted from the first downbeat) of a run falls.
 *
 * The rhythm form plays each song in `order` for `barsPerSong` bars and then
 * the next, looping; every time a song comes round it plays its next
 * section. The listening form plays each song in `order` for 32 bars, its
 * sections in turn (A B A B), looping. An empty or missing `order` means
 * every song in index order. `form` defaults to rhythm when an order is
 * given and listening when it is not.
 */
export function barSlot(
  songs: Song[],
  order: number[] | undefined,
  bar: number,
  barsPerSong = SECTION_BARS,
  form?: MusicForm,
): BarSlot {
  const given = order && order.length ? order : undefined;
  const list = given ?? songs.map((_, index) => index);
  if ((form ?? (given ? "rhythm" : "listening")) === "rhythm") {
    const perLoop = list.length * barsPerSong;
    const loop = Math.floor(bar / perLoop);
    const withinLoop = bar - loop * perLoop;
    const position = Math.floor(withinLoop / barsPerSong);
    const song = list[position];
    const barInSong = withinLoop - position * barsPerSong;
    const perLoopVisits = list.filter((index) => index === song).length;
    const earlier = list.slice(0, position).filter((index) => index === song).length;
    const visit = loop * perLoopVisits + earlier;
    const sections = songs[song].sections.length;
    return {
      song,
      section: visit % sections,
      barInSection: barInSong % SECTION_BARS,
      barInSong,
      lap: Math.floor(visit / sections),
    };
  }

  const song = list[Math.floor(bar / LISTEN_BARS_PER_SONG) % list.length];
  const barInSong = bar % LISTEN_BARS_PER_SONG;
  const block = Math.floor(barInSong / SECTION_BARS);
  const sections = songs[song].sections.length;
  return {
    song,
    section: block % sections,
    barInSection: barInSong % SECTION_BARS,
    barInSong,
    lap: Math.floor(block / sections),
  };
}
