// The arcade's songbook: twelve short tunes written as chord charts, melodies,
// and grooves, which the music engine arranges and plays. Nothing here
// touches Web Audio, so the charts can be read, edited, and tested as data.
//
// Notation
//
// A line (a melody bar) is tokens separated by spaces. Each token is
// `pitch/beats`: a note name with octave (`c4`, `eb4`, `f#5`; middle C is
// `c4`) or `-` for a rest, then how long until the next token, in beats
// (1 when omitted). Every bar adds up to 4 beats.
//
// A chord bar is chord names with the beats each one lasts: `"Dm7"` for the
// whole bar, `"Am7/2 Dm7/2"` for a change on beat 3. Each name is spelled out
// in the song's `chords`: the voicing the keys play (written out, so the
// voice leading is deliberate), the note the bass calls its root, and the
// chord's quality.
//
// A pattern is 16 characters, one per sixteenth of a bar: `X` an accent,
// `x` a hit, `o` a ghost note, `.` nothing.
//
// A bass line is tokens of `degree/beats`, read against whichever chord is
// sounding when the note starts: `R` the root, `3` `5` `7` the chord's own
// third, fifth, and seventh (a sus chord's `3` is its fourth, a m6 chord's
// `7` is its sixth), `8` the root an octave up, `>` a semitone under the
// next bar's root, and `-` a rest.
//
// An arp is eight characters, one per eighth note: `0`–`3` picks a note of
// the sounding chord's voicing (played an octave up), `.` rests.

export type MusicPhase = "opening" | "steady" | "rush";
export type LeadVoice =
  | "marimba"
  | "glass"
  | "kalimba"
  | "whistle"
  | "vibes"
  | "reed"
  | "square"
  | "pluck"
  | "saw"
  | "acid";
/** What plays the chords: an electric piano unless a song asks otherwise. */
export type KeysVoice = "rhodes" | "saw";
/** The drum kit: brushed and soft, or a club kit with a deeper kick and a clap for a snare. */
export type Kit = "soft" | "club";
export type ChordQuality = "maj" | "min" | "dom" | "sus" | "m6";

export interface Chord {
  keys: string;
  bass: string;
  quality: ChordQuality;
}

/** What the rhythm section plays in one phase. */
export interface Groove {
  kick?: string;
  snare?: string;
  rim?: string;
  hat?: string;
  /** Open hat. */
  open?: string;
  shaker?: string;
  /** When the keys strike the chord. */
  comp: string;
  bass: string;
}

/** Eight bars. */
export interface Section {
  chords: string[];
  melody: string[];
}

export interface Song {
  /** Shown on the HUD's flag, so keep it short. */
  name: string;
  bpm: number;
  key: string;
  /** The pentatonic the sound effects play in while this song is on. */
  sfxRoot: number;
  sfxScale: number[];
  lead: LeadVoice;
  keys?: KeysVoice;
  kit?: Kit;
  /**
   * Sidechain pump, 0–1: how far the chords, bass, and arp duck under every
   * kick before swelling back. Absent means none.
   */
  pump?: number;
  /** How late the off sixteenths land: 0.5 is straight. Eighths never swing. */
  swing: number;
  chords: Record<string, Chord>;
  sections: Section[];
  grooves: Record<MusicPhase, Groove>;
  /** Drums for the last bar of a section, once there is a kit to fill on. */
  fill: { kick: string; snare: string };
  arp: string;
}

const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];
const MINOR_PENTATONIC = [0, 3, 5, 7, 10];

// Twelve tunes in twelve styles. A run shuffles them, so no game opens on the
// same one twice running; straw stab draws four, one from each tempo band,
// and plays them slowest first so its tempo climbs. Every song keeps a clear
// pulse on the beat and on the eighths, because cups land on both.
export const SONGS: Song[] = [
  {
    // A bouncing marimba over offbeat keys: the afternoon rush, in a good mood.
    name: "half sweet",
    bpm: 144,
    key: "C major",
    sfxRoot: 60,
    sfxScale: MAJOR_PENTATONIC,
    lead: "marimba",
    swing: 0.56,
    chords: {
      Fmaj7: { keys: "a3 c4 e4 g4", bass: "f2", quality: "maj" },
      G6: { keys: "a3 b3 d4 g4", bass: "g2", quality: "maj" },
      Em7: { keys: "g3 b3 d4 e4", bass: "e2", quality: "min" },
      Am7: { keys: "g3 a3 c4 e4", bass: "a2", quality: "min" },
      Dm7: { keys: "f3 a3 c4 e4", bass: "d3", quality: "min" },
      G7: { keys: "f3 a3 b3 e4", bass: "g2", quality: "dom" },
      Cmaj7: { keys: "e3 g3 b3 d4", bass: "c3", quality: "maj" },
      C7sus: { keys: "f3 g3 bb3 d4", bass: "c3", quality: "sus" },
      D9: { keys: "f#3 a3 c4 e4", bass: "d3", quality: "dom" },
      Gsus: { keys: "f3 a3 c4 d4", bass: "g2", quality: "sus" },
      A7: { keys: "g3 b3 c#4 e4", bass: "a2", quality: "dom" },
      Fm6: { keys: "f3 ab3 c4 d4", bass: "f2", quality: "m6" },
    },
    sections: [
      {
        chords: ["Fmaj7", "G6", "Em7", "Am7", "Dm7", "G7", "Cmaj7", "C7sus"],
        melody: [
          "a5/.5 c6/.5 -/.5 a5/.5 g5 e5",
          "d5/.5 e5/.5 g5 -/.5 e5/.5 d5",
          "g5/.5 b5/.5 -/.5 g5/.5 e5 d5",
          "c5/.5 d5/.5 e5/2 -",
          "f5/.5 a5/.5 -/.5 f5/.5 e5 d5",
          "b4/.5 d5/.5 f5 -/.5 e5/.5 d5",
          "e5/.5 g5/.5 c6/1.5 b5/.5 g5",
          "a5/.5 g5/.5 f5 g5 -",
        ],
      },
      {
        chords: ["Am7", "D9", "Gsus", "Cmaj7/2 A7/2", "Dm7", "Fm6", "Em7/2 A7/2", "Dm7/2 G7/2"],
        melody: [
          "e5/1.5 g5/.5 a5 c6",
          "b5/1.5 a5/.5 f#5 e5",
          "d5 g5/.5 a5/.5 g5/2",
          "e5 g5 c#5/.5 e5/.5 g5",
          "f5/1.5 a5/.5 d6 c6",
          "ab5/1.5 f5/.5 d5 c5",
          "b4/.5 e5/.5 g5 a5/.5 g5/.5 e5",
          "f5/.5 e5/.5 d5 b4 -",
        ],
      },
    ],
    grooves: {
      opening: {
        kick: "x.......x.......",
        rim: "....x.......x...",
        shaker: "o.x.o.x.o.x.o.x.",
        comp: "x.....x.........",
        bass: "R/3 5",
      },
      steady: {
        kick: "x.....x.x.......",
        snare: "....x..o....x..o",
        hat: "X.x.X.x.X.x.X.x.",
        comp: "x.....x.....x...",
        bass: "R 8/.5 R/.5 5 8/.5 >/.5",
      },
      rush: {
        kick: "x.....x.x.....x.",
        snare: "....x..o.o..x..o",
        hat: "X.x.X.x.X.x.X.x.",
        shaker: "xoxoxoxoxoxoxoxo",
        comp: "..x...x...x...x.",
        bass: "R/.5 8/.5 R/.5 8/.5 5/.5 8/.5 7/.5 >/.5",
      },
    },
    fill: { kick: "x.....x.x.......", snare: "....x.....o.xxoX" },
    arp: "02321321",
  },
  {
    // A bossa at walking pace, a glassy lead that takes its time.
    name: "less ice",
    bpm: 128,
    key: "F major",
    sfxRoot: 65,
    sfxScale: MAJOR_PENTATONIC,
    lead: "glass",
    swing: 0.5,
    chords: {
      Fmaj9: { keys: "a3 c4 e4 g4", bass: "f2", quality: "maj" },
      Dm9: { keys: "f3 a3 c4 e4", bass: "d3", quality: "min" },
      Bbmaj7: { keys: "a3 c4 d4 f4", bass: "bb2", quality: "maj" },
      Am7: { keys: "g3 a3 c4 e4", bass: "a2", quality: "min" },
      Gm9: { keys: "f3 a3 bb3 d4", bass: "g2", quality: "min" },
      C9sus: { keys: "g3 bb3 d4 f4", bass: "c3", quality: "sus" },
      A7: { keys: "g3 a3 c#4 e4", bass: "a2", quality: "dom" },
      Cm7: { keys: "g3 bb3 d4 eb4", bass: "c3", quality: "min" },
      F7: { keys: "a3 c4 eb4 g4", bass: "f2", quality: "dom" },
      Bbm6: { keys: "g3 bb3 db4 f4", bass: "bb2", quality: "m6" },
      Dm7: { keys: "a3 c4 d4 f4", bass: "d3", quality: "min" },
      Gm7: { keys: "g3 bb3 d4 f4", bass: "g2", quality: "min" },
      C9: { keys: "e3 g3 bb3 d4", bass: "c3", quality: "dom" },
    },
    sections: [
      {
        chords: ["Fmaj9", "Fmaj9", "Dm9", "Dm9", "Bbmaj7", "Am7", "Gm9", "C9sus"],
        melody: [
          "-/.5 a5/.5 c6 a5/.5 g5/1.5",
          "e5/1.5 f5/.5 a5/2",
          "-/.5 f5/.5 a5 f5/.5 e5/1.5",
          "c5/1.5 d5/.5 f5/2",
          "-/.5 d5/.5 f5/.5 a5/.5 g5 f5",
          "e5 g5/1.5 e5/.5 c5",
          "d5/.5 f5/.5 a5/1.5 g5/.5 f5",
          "g5/2.5 -/1.5",
        ],
      },
      {
        chords: ["Bbmaj7", "A7", "Dm9", "Cm7/2 F7/2", "Bbmaj7", "Bbm6", "Am7/2 Dm7/2", "Gm7/2 C9/2"],
        melody: [
          "d6/1.5 c6/.5 a5 f5",
          "e5 g5/.5 a5/.5 c#6/2",
          "d6/1.5 a5/.5 f5 e5",
          "eb5/.5 g5/.5 bb5 a5/1.5 f5/.5",
          "d5/.5 f5/.5 a5 bb5/.5 a5/.5 f5",
          "db5/.5 f5/.5 g5 bb5/2",
          "c6 a5 f5/.5 a5/.5 d5",
          "f5/.5 g5/.5 bb5 g5/2",
        ],
      },
    ],
    grooves: {
      opening: {
        kick: "x.......x.......",
        rim: "x..x..x...x..x..",
        shaker: "xoxoxoxoxoxoxoxo",
        comp: "x.....x.........",
        bass: "R/2 5/2",
      },
      steady: {
        kick: "x.....x.x.....x.",
        rim: "x..x..x...x..x..",
        shaker: "xoXoxoXoxoXoxoXo",
        comp: "x..x......x..x..",
        bass: "R/1.5 5/.5 5/1.5 R/.5",
      },
      rush: {
        kick: "x.....x.x.....x.",
        snare: "....o.......o...",
        rim: "x..x..x...x..x..",
        hat: "x.x.x.x.x.x.x.x.",
        shaker: "xoXoxoXoxoXoxoXo",
        comp: "x..x..x...x..x..",
        bass: "R R/.5 5/.5 5 8/.5 >/.5",
      },
    },
    fill: { kick: "x.....x.x.......", snare: "....o.....o.o.xx" },
    arp: "01232123",
  },
  {
    // A plucked, syncopated strut in A dorian, with a bass line that pokes.
    name: "extra pearls",
    bpm: 152,
    key: "A dorian",
    sfxRoot: 57,
    sfxScale: MINOR_PENTATONIC,
    lead: "kalimba",
    swing: 0.57,
    chords: {
      Am9: { keys: "g3 b3 c4 e4", bass: "a2", quality: "min" },
      D9: { keys: "f#3 a3 c4 e4", bass: "d3", quality: "dom" },
      Fmaj7: { keys: "a3 c4 e4 g4", bass: "f2", quality: "maj" },
      Em7: { keys: "g3 b3 d4 e4", bass: "e2", quality: "min" },
      Dm7: { keys: "f3 a3 c4 e4", bass: "d3", quality: "min" },
      E7: { keys: "g#3 b3 d4 e4", bass: "e2", quality: "dom" },
      G6: { keys: "a3 b3 d4 g4", bass: "g2", quality: "maj" },
      Am7: { keys: "g3 a3 c4 e4", bass: "a2", quality: "min" },
      Cmaj7: { keys: "g3 b3 c4 e4", bass: "c3", quality: "maj" },
      E7sus: { keys: "a3 b3 d4 e4", bass: "e2", quality: "sus" },
    },
    sections: [
      {
        chords: ["Am9", "Am9", "D9", "D9", "Fmaj7", "Em7", "Dm7", "E7"],
        melody: [
          "a4/.5 c5/.5 e5/.5 -/.5 g5/.5 e5/.5 -",
          "d5/.5 e5/.5 -/.5 c5/.5 a4 -",
          "a4/.5 c5/.5 e5/.5 -/.5 f#5/.5 e5/.5 -",
          "d5/.5 e5/.5 -/.5 f#5/.5 a5/1.5 -/.5",
          "c6/.5 a5/.5 -/.5 e5/.5 f5 a5",
          "b5/.5 g5/.5 -/.5 d5/.5 e5 g5",
          "a5/.5 f5/.5 -/.5 c5/.5 d5/.5 f5/.5 a5",
          "g#5 b5/.5 g#5/.5 e5 -",
        ],
      },
      {
        chords: ["Fmaj7", "G6", "Am7", "Cmaj7", "Fmaj7", "G6", "E7sus", "E7"],
        melody: [
          "e5/1.5 f5/.5 a5 c6",
          "b5/1.5 a5/.5 g5 d5",
          "e5 a5/.5 g5/.5 e5 c5",
          "d5/.5 e5/.5 g5/2 -",
          "a5/1.5 c6/.5 e6 c6",
          "d6/1.5 b5/.5 g5 a5",
          "b5 a5 e5/2",
          "g#5/.5 b5/.5 d6 b5 -",
        ],
      },
    ],
    grooves: {
      opening: {
        kick: "x.........x.....",
        rim: "....x.......x...",
        shaker: "x.x.x.x.x.x.x.x.",
        comp: "x...............",
        bass: "R/1.5 R/.5 -/1 5",
      },
      steady: {
        kick: "x.....x...x.....",
        snare: "....x..o.o..x...",
        hat: "X.x.X.x.X.x.X.x.",
        open: "..............x.",
        comp: "..x..x....x..x..",
        bass: "R/.5 -/.5 R/.5 8/.5 -/.5 7/.5 8/.5 5/.5",
      },
      rush: {
        kick: "x.....x...x...x.",
        snare: "....x..o.o..x..o",
        hat: "XoxoXoxoXoxoXoxo",
        open: "......x.......x.",
        comp: "..x..x..x.x..x..",
        bass: "R/.5 R/.5 8/.5 R/.5 7/.5 8/.5 5/.5 >/.5",
      },
    },
    fill: { kick: "x.....x...x.....", snare: "....x..o.o..xoxX" },
    arp: "3.2.13.2",
  },
  {
    // The fastest one, in D minor: a whistled tune over a kit that leans in.
    name: "rush order",
    bpm: 162,
    key: "D minor",
    sfxRoot: 62,
    sfxScale: MINOR_PENTATONIC,
    lead: "whistle",
    swing: 0.55,
    chords: {
      Dm9: { keys: "f3 a3 c4 e4", bass: "d2", quality: "min" },
      Bbmaj7: { keys: "a3 c4 d4 f4", bass: "bb2", quality: "maj" },
      Gm7: { keys: "g3 bb3 d4 f4", bass: "g2", quality: "min" },
      A7: { keys: "g3 a3 c#4 e4", bass: "a2", quality: "dom" },
      C9: { keys: "e3 g3 bb3 d4", bass: "c3", quality: "dom" },
      A7sus: { keys: "g3 a3 d4 e4", bass: "a2", quality: "sus" },
      C6: { keys: "e3 g3 a3 c4", bass: "c3", quality: "maj" },
      Am7: { keys: "g3 a3 c4 e4", bass: "a2", quality: "min" },
      Dm7: { keys: "a3 c4 d4 f4", bass: "d2", quality: "min" },
      Fmaj7: { keys: "a3 c4 e4 g4", bass: "f2", quality: "maj" },
    },
    sections: [
      {
        chords: ["Dm9", "Bbmaj7", "Gm7", "A7", "Dm9", "Bbmaj7", "C9", "A7sus/2 A7/2"],
        melody: [
          "d5 f5/.5 a5/.5 e5/1.5 d5/.5",
          "f5 a5/.5 d6/.5 c6/1.5 a5/.5",
          "bb5 a5/.5 g5/.5 f5 d5",
          "e5/1.5 c#5/.5 e5 a5",
          "d6 a5/.5 f5/.5 e5/1.5 d5/.5",
          "f5 a5/.5 d6/.5 e6/1.5 d6/.5",
          "e6 d6/.5 bb5/.5 g5 e5",
          "g5 e5 c#6 -",
        ],
      },
      {
        chords: ["Bbmaj7", "C6", "Am7", "Dm7", "Gm7", "C9", "Fmaj7", "A7"],
        melody: [
          "d6/2 c6/.5 bb5/.5 a5",
          "g5/2 e5/.5 g5/.5 c6",
          "c6/1.5 a5/.5 g5 e5",
          "f5 a5 d5/2",
          "bb5/2 a5/.5 g5/.5 f5",
          "e5/2 g5/.5 bb5/.5 d6",
          "c6/1.5 a5/.5 f5 a5",
          "e5 g5 a5 -",
        ],
      },
    ],
    grooves: {
      opening: {
        kick: "x.......x.......",
        rim: "....x.......x...",
        shaker: "o.x.o.x.o.x.o.x.",
        comp: "x.......x.......",
        bass: "R/2 R 5",
      },
      steady: {
        kick: "x.......x.x.....",
        snare: "....x.......x...",
        hat: "X.x.X.x.X.x.X.x.",
        comp: "x.....x.....x...",
        bass: "R R/.5 5/.5 8 5/.5 7/.5",
      },
      rush: {
        kick: "x...x...x...x...",
        snare: "....x.......x..o",
        open: "..x...x...x...x.",
        shaker: "xoxoxoxoxoxoxoxo",
        comp: "x..x..x..x..x.x.",
        bass: "R/.5 R/.5 R/.5 5/.5 8/.5 8/.5 7/.5 >/.5",
      },
    },
    fill: { kick: "x.......x.x.....", snare: "....x.....x.x.xX" },
    arp: "03231323",
  },
  {
    // Disco at an easy strut: four on the floor, octave bass, open hats.
    name: "happy hour",
    bpm: 124,
    key: "G minor",
    sfxRoot: 55,
    sfxScale: MINOR_PENTATONIC,
    lead: "glass",
    swing: 0.5,
    chords: {
      Gm9: { keys: "f3 a3 bb3 d4", bass: "g2", quality: "min" },
      C9: { keys: "e3 g3 bb3 d4", bass: "c3", quality: "dom" },
      Ebmaj7: { keys: "g3 bb3 d4 f4", bass: "eb2", quality: "maj" },
      Dm7: { keys: "f3 a3 c4 d4", bass: "d3", quality: "min" },
      Cm9: { keys: "eb3 g3 bb3 d4", bass: "c3", quality: "min" },
      D7: { keys: "f#3 a3 c4 d4", bass: "d3", quality: "dom" },
      F6: { keys: "a3 c4 d4 f4", bass: "f2", quality: "maj" },
      Gm7: { keys: "f3 g3 bb3 d4", bass: "g2", quality: "min" },
      Bbmaj7: { keys: "a3 bb3 d4 f4", bass: "bb2", quality: "maj" },
      Dsus: { keys: "g3 a3 c4 d4", bass: "d3", quality: "sus" },
    },
    sections: [
      {
        chords: ["Gm9", "Gm9", "C9", "C9", "Ebmaj7", "Dm7", "Cm9", "D7"],
        melody: [
          "d5/.5 f5/.5 g5 -/.5 bb5/.5 a5/.5 g5/.5",
          "f5/1.5 d5/.5 - d5/.5 f5/.5",
          "d5/.5 e5/.5 g5 -/.5 bb5/.5 a5/.5 g5/.5",
          "e5/1.5 g5/.5 - g5/.5 bb5/.5",
          "d6/1.5 bb5/.5 g5 f5",
          "a5/1.5 f5/.5 d5 c5",
          "eb5/.5 g5/.5 bb5 d6/1.5 c6/.5",
          "a5 f#5 d5 -",
        ],
      },
      {
        chords: ["Ebmaj7", "F6", "Gm7", "Bbmaj7", "Ebmaj7", "F6", "Dsus", "D7"],
        melody: [
          "g5/2 bb5/.5 d6/.5 c6",
          "a5/2 c6/.5 a5/.5 f5",
          "bb5/1.5 a5/.5 g5 d5",
          "f5/.5 g5/.5 a5/2 -",
          "g5/2 bb5/.5 d6/.5 eb6",
          "d6/1.5 c6/.5 a5 f5",
          "g5 a5 d6/2",
          "c6/.5 a5/.5 f#5 d5 -",
        ],
      },
    ],
    grooves: {
      opening: {
        kick: "x.......x.......",
        hat: "..x...x...x...x.",
        comp: "x...............",
        bass: "R/2 R 5",
      },
      steady: {
        kick: "x...x...x...x...",
        snare: "....x.......x...",
        open: "..x...x...x...x.",
        comp: "..x...x...x...x.",
        bass: "R/.5 8/.5 R/.5 8/.5 R/.5 8/.5 7/.5 8/.5",
      },
      rush: {
        kick: "x...x...x...x...",
        snare: "....x.......x..o",
        open: "..x...x...x...x.",
        shaker: "xoxoxoxoxoxoxoxo",
        comp: "..x.x.x...x.x.x.",
        bass: "R/.5 8/.5 R/.5 8/.5 5/.5 8/.5 7/.5 >/.5",
      },
    },
    fill: { kick: "x...x...x...x...", snare: "....x.......xxxX" },
    arp: "02132313",
  },
  {
    // Half-time and unhurried: vibes over a head-nod beat, late on purpose.
    name: "second cup",
    bpm: 138,
    key: "Eb major",
    sfxRoot: 63,
    sfxScale: MAJOR_PENTATONIC,
    lead: "vibes",
    swing: 0.6,
    chords: {
      Ebmaj9: { keys: "g3 bb3 d4 f4", bass: "eb2", quality: "maj" },
      Cm9: { keys: "eb3 g3 bb3 d4", bass: "c3", quality: "min" },
      Abmaj7: { keys: "g3 ab3 c4 eb4", bass: "ab2", quality: "maj" },
      Gm7: { keys: "f3 g3 bb3 d4", bass: "g2", quality: "min" },
      Fm9: { keys: "eb3 g3 ab3 c4", bass: "f2", quality: "min" },
      Bb13: { keys: "ab3 c4 d4 g4", bass: "bb2", quality: "dom" },
      Abm6: { keys: "f3 ab3 b3 eb4", bass: "ab2", quality: "m6" },
      C7: { keys: "e3 g3 bb3 d4", bass: "c3", quality: "dom" },
      Bb9sus: { keys: "ab3 c4 eb4 f4", bass: "bb2", quality: "sus" },
    },
    sections: [
      {
        chords: ["Ebmaj9", "Ebmaj9", "Cm9", "Cm9", "Abmaj7", "Gm7", "Fm9", "Bb13"],
        melody: [
          "- g5/.5 bb5/.5 d6/1.5 c6/.5",
          "bb5/2 - g5/.5 f5/.5",
          "- eb5/.5 g5/.5 bb5/1.5 g5/.5",
          "d5/2.5 -/1.5",
          "-/.5 c6/.5 bb5/.5 g5/.5 eb5 g5",
          "f5/1.5 d5/.5 bb4 d5",
          "-/.5 ab5/.5 g5/.5 eb5/.5 c5 eb5",
          "d5/1.5 f5/.5 g5/2",
        ],
      },
      {
        chords: ["Abmaj7", "Abm6", "Gm7", "C7", "Fm9", "Bb13", "Ebmaj9", "Bb9sus"],
        melody: [
          "eb6/1.5 c6/.5 ab5 g5",
          "f5/.5 ab5/.5 b5 eb6/2",
          "d6/1.5 bb5/.5 g5 f5",
          "e5/.5 g5/.5 bb5 c6/2",
          "ab5/1.5 g5/.5 eb5 c5",
          "d5/.5 f5/.5 ab5 g5/2",
          "bb5/1.5 g5/.5 f5 d5",
          "eb5/2 -/2",
        ],
      },
    ],
    grooves: {
      opening: {
        kick: "x.........x.....",
        rim: "........x.......",
        shaker: "o.x.o.x.o.x.o.x.",
        comp: "x...............",
        bass: "R/2.5 R/.5 5",
      },
      steady: {
        kick: "x......x..x.....",
        snare: "........x....o..",
        hat: "X.x.x.x.X.x.x.x.",
        comp: "x.....x.........",
        bass: "R/1.5 R/.5 -/.5 5/.5 8/.5 >/.5",
      },
      rush: {
        kick: "x......x..x...x.",
        snare: "........x....o.o",
        rim: "....x.......x...",
        hat: "X.xoX.xoX.xoX.xo",
        comp: "x.....x...x.....",
        bass: "R R/.5 8/.5 -/.5 5/.5 7/.5 >/.5",
      },
    },
    fill: { kick: "x......x..x.....", snare: "........x...o.xx" },
    arp: "0.12.321",
  },
  {
    // Reggae, with a melodica carrying the tune and the keys on the offbeat.
    name: "no straw",
    bpm: 140,
    key: "G major",
    sfxRoot: 55,
    sfxScale: MAJOR_PENTATONIC,
    lead: "reed",
    swing: 0.5,
    chords: {
      G: { keys: "g3 b3 d4 g4", bass: "g2", quality: "maj" },
      Em7: { keys: "g3 b3 d4 e4", bass: "e2", quality: "min" },
      C: { keys: "g3 c4 e4 g4", bass: "c3", quality: "maj" },
      D: { keys: "f#3 a3 d4 f#4", bass: "d3", quality: "maj" },
      D7: { keys: "f#3 a3 c4 d4", bass: "d3", quality: "dom" },
      Am7: { keys: "g3 a3 c4 e4", bass: "a2", quality: "min" },
    },
    sections: [
      {
        chords: ["G", "G", "Em7", "Em7", "C", "D", "G", "D7"],
        melody: [
          "b5/1.5 d6/.5 b5 a5/.5 g5/.5",
          "a5/.5 b5/.5 g5/2 -",
          "g5/1.5 b5/.5 g5 e5/.5 d5/.5",
          "e5/.5 g5/.5 e5/2 -",
          "e5 g5/.5 c6/.5 b5 g5",
          "a5 f#5/.5 a5/.5 d6/2",
          "b5/.5 d6/.5 b5/.5 g5/.5 a5 b5",
          "a5/2 -/2",
        ],
      },
      {
        chords: ["C", "C", "G", "G", "Am7", "Am7", "C", "D7"],
        melody: [
          "e6/1.5 d6/.5 c6 g5",
          "a5/.5 c6/.5 g5/2 -",
          "d6/1.5 b5/.5 g5 d5",
          "e5/.5 g5/.5 b5/2 -",
          "c6 e6/.5 c6/.5 a5 g5",
          "e5/.5 g5/.5 a5/2 -",
          "g5/.5 a5/.5 c6 e6/.5 d6/.5 c6",
          "a5 c6 d6 -",
        ],
      },
    ],
    grooves: {
      // The one drop: nothing on the one, everything on the three.
      opening: {
        kick: "........x.......",
        rim: "........x.......",
        shaker: "..x...x...x...x.",
        comp: "....x.......x...",
        bass: "- R/1.5 5/.5 R",
      },
      // Rockers: a kick on the one as well, so the bar line can be felt.
      steady: {
        kick: "x.......x.......",
        rim: "........x.......",
        hat: "x.X.x.X.x.X.x.X.",
        comp: "....x.x.....x.x.",
        bass: "R R/.5 5/.5 -/.5 3/.5 5/.5 R/.5",
      },
      // Steppers: the kick walks on every beat.
      rush: {
        kick: "x...x...x...x...",
        snare: "........x.......",
        hat: "x.X.x.X.x.X.x.X.",
        shaker: "xoxoxoxoxoxoxoxo",
        comp: "....x.x.....x.x.",
        bass: "R/.5 R/.5 8/.5 5/.5 -/.5 3/.5 5/.5 >/.5",
      },
    },
    fill: { kick: "x...x...x...x...", snare: "........x...x.xx" },
    arp: ".1.3.2.3",
  },
  {
    // Highlife: a balafon tune that repeats until it is a friend, over a
    // bell pattern and keys that cross the beat in threes.
    name: "lychee jelly",
    bpm: 150,
    key: "A major",
    sfxRoot: 57,
    sfxScale: MAJOR_PENTATONIC,
    lead: "marimba",
    swing: 0.54,
    chords: {
      A6: { keys: "a3 c#4 e4 f#4", bass: "a2", quality: "maj" },
      D: { keys: "f#3 a3 d4 f#4", bass: "d3", quality: "maj" },
      E7: { keys: "g#3 b3 d4 e4", bass: "e2", quality: "dom" },
      "C#m7": { keys: "g#3 b3 c#4 e4", bass: "c#3", quality: "min" },
      "F#m7": { keys: "f#3 a3 c#4 e4", bass: "f#2", quality: "min" },
      Bm7: { keys: "a3 b3 d4 f#4", bass: "b2", quality: "min" },
    },
    sections: [
      {
        chords: ["A6", "D", "A6", "E7", "A6", "D", "E7", "A6"],
        melody: [
          "c#6/.5 e6/.5 c#6/.5 a5/.5 b5 c#6",
          "d6/.5 f#5/.5 a5 -/.5 a5/.5 b5/.5 a5/.5",
          "c#6/.5 e6/.5 c#6/.5 a5/.5 f#5 e5",
          "g#5/.5 b5/.5 e5/2 -",
          "c#6/.5 e6/.5 c#6/.5 a5/.5 b5 c#6",
          "d6/.5 f#5/.5 a5 d6/.5 c#6/.5 b5",
          "g#5/.5 b5/.5 d6 b5/.5 g#5/.5 e5",
          "a5/2 -/2",
        ],
      },
      {
        chords: ["D", "E7", "C#m7", "F#m7", "Bm7", "E7", "A6", "A6"],
        melody: [
          "d6/1.5 a5/.5 f#5 a5",
          "e6/1.5 b5/.5 g#5 b5",
          "c#6/1.5 b5/.5 g#5 e5",
          "f#5/.5 a5/.5 c#6/2 -",
          "d6/1.5 b5/.5 a5 f#5",
          "g#5/.5 b5/.5 d6 e6 -",
          "c#6/.5 e6/.5 c#6/.5 a5/.5 f#5/.5 a5/.5 e5",
          "a5/2.5 -/1.5",
        ],
      },
    ],
    grooves: {
      opening: {
        kick: "x.......x.......",
        rim: "x..x..x...x.x...",
        shaker: "x.x.x.x.x.x.x.x.",
        comp: "x.....x.........",
        bass: "R/1.5 5/.5 R 5",
      },
      steady: {
        kick: "x.......x.....x.",
        snare: "....x..o....x...",
        rim: "x..x..x...x.x...",
        hat: "..x...x...x...x.",
        comp: "..x..x..x..x..x.",
        bass: "R 5/.5 8/.5 -/.5 5/.5 3/.5 5/.5",
      },
      rush: {
        kick: "x...x...x...x.x.",
        snare: "....x..o.o..x..o",
        rim: "x..x..x...x.x...",
        hat: "..x...x...x...x.",
        shaker: "xoxoxoxoxoxoxoxo",
        comp: "..x..x..x..x..x.",
        bass: "R/.5 R/.5 5/.5 8/.5 7/.5 5/.5 3/.5 >/.5",
      },
    },
    fill: { kick: "x.......x.....x.", snare: "....x..o..x.x.xX" },
    arp: "02310231",
  },
  {
    // The arcade one: a soft square lead running eighths, kept round.
    name: "two for one",
    bpm: 156,
    key: "D major",
    sfxRoot: 62,
    sfxScale: MAJOR_PENTATONIC,
    lead: "square",
    swing: 0.5,
    chords: {
      D: { keys: "f#3 a3 d4 f#4", bass: "d3", quality: "maj" },
      A: { keys: "e3 a3 c#4 e4", bass: "a2", quality: "maj" },
      Bm7: { keys: "a3 b3 d4 f#4", bass: "b2", quality: "min" },
      G: { keys: "g3 b3 d4 g4", bass: "g2", quality: "maj" },
      A7sus: { keys: "g3 a3 d4 e4", bass: "a2", quality: "sus" },
      A7: { keys: "g3 a3 c#4 e4", bass: "a2", quality: "dom" },
      "F#m7": { keys: "f#3 a3 c#4 e4", bass: "f#2", quality: "min" },
      Em7: { keys: "g3 b3 d4 e4", bass: "e2", quality: "min" },
    },
    sections: [
      {
        chords: ["D", "A", "Bm7", "G", "D", "A", "G", "A7sus/2 A7/2"],
        melody: [
          "f#5/.5 a5/.5 d6/.5 a5/.5 f#5/.5 a5/.5 d6",
          "c#6/.5 a5/.5 e5/.5 a5/.5 c#6 e6",
          "d6/.5 b5/.5 f#5/.5 b5/.5 d6/1.5 b5/.5",
          "g5/.5 b5/.5 d6/2 -",
          "f#5/.5 a5/.5 d6/.5 a5/.5 f#5/.5 a5/.5 d6",
          "e6/.5 c#6/.5 a5/.5 c#6/.5 e6 a5",
          "b5/.5 d6/.5 g5/.5 b5/.5 d6/.5 b5/.5 g5",
          "a5 d6 c#6 -",
        ],
      },
      {
        chords: ["G", "A", "F#m7", "Bm7", "Em7", "A7", "D", "A7"],
        melody: [
          "b5/1.5 d6/.5 g5/2",
          "c#6/1.5 e6/.5 a5/2",
          "a5/.5 c#6/.5 e6/.5 c#6/.5 a5 f#5",
          "b5/.5 d6/.5 f#5/2 -",
          "g5/.5 b5/.5 e6/.5 b5/.5 g5 e5",
          "a5/.5 c#6/.5 e6 g5/.5 a5/.5 c#6",
          "d6/.5 a5/.5 f#5/.5 a5/.5 d6/2",
          "e6/.5 c#6/.5 a5 g5 -",
        ],
      },
    ],
    grooves: {
      opening: {
        kick: "x.......x.......",
        rim: "....x.......x...",
        shaker: "x.x.x.x.x.x.x.x.",
        comp: "x.......x.......",
        bass: "R/2 5/2",
      },
      steady: {
        kick: "x...x...x...x...",
        snare: "....x.......x...",
        hat: "..x...x...x...x.",
        comp: "x.x.....x.x.....",
        bass: "R/.5 R/.5 8/.5 R/.5 5/.5 5/.5 8/.5 5/.5",
      },
      rush: {
        kick: "x...x...x...x.x.",
        snare: "....x..o....x..o",
        hat: "X.x.X.x.X.x.X.x.",
        open: "..x...x...x...x.",
        comp: "x.x.x...x.x.x...",
        bass: "R/.5 8/.5 R/.5 8/.5 5/.5 8/.5 3/.5 >/.5",
      },
    },
    fill: { kick: "x...x...x...x...", snare: "....x.....x.xxxX" },
    arp: "03130313",
  },
  {
    // Surf: a twangy tune on repeated notes and a snare that says bap-bap.
    name: "last call",
    bpm: 164,
    key: "E minor",
    sfxRoot: 64,
    sfxScale: MINOR_PENTATONIC,
    lead: "pluck",
    swing: 0.5,
    chords: {
      Em: { keys: "e3 g3 b3 e4", bass: "e2", quality: "min" },
      D: { keys: "f#3 a3 d4 f#4", bass: "d3", quality: "maj" },
      C: { keys: "g3 c4 e4 g4", bass: "c3", quality: "maj" },
      B7: { keys: "a3 b3 d#4 f#4", bass: "b2", quality: "dom" },
      Am7: { keys: "g3 a3 c4 e4", bass: "a2", quality: "min" },
      B7sus: { keys: "a3 b3 e4 f#4", bass: "b2", quality: "sus" },
    },
    sections: [
      {
        chords: ["Em", "Em", "D", "D", "C", "C", "B7", "B7"],
        melody: [
          "e5/.5 e5/.5 g5/.5 b5/.5 e6 b5",
          "g5/.5 a5/.5 b5/2 -",
          "d5/.5 d5/.5 f#5/.5 a5/.5 d6 a5",
          "f#5/.5 g5/.5 a5/2 -",
          "c5/.5 c5/.5 e5/.5 g5/.5 c6 g5",
          "e5/.5 g5/.5 c6/.5 e6/.5 d6 c6",
          "b5/1.5 a5/.5 f#5 d#5",
          "f#5/.5 a5/.5 b5/2 -",
        ],
      },
      {
        chords: ["Am7", "Am7", "Em", "Em", "C", "D", "B7sus", "B7"],
        melody: [
          "a5/1.5 c6/.5 e6 c6",
          "a5/.5 g5/.5 e5/2 -",
          "b5/1.5 e6/.5 b5 g5",
          "e5/.5 g5/.5 b5/2 -",
          "c6/1.5 e6/.5 c6 g5",
          "d6/1.5 a5/.5 f#5 a5",
          "b5 e6/1.5 b5/.5 a5",
          "f#5/.5 a5/.5 b5 d#6 -",
        ],
      },
    ],
    grooves: {
      opening: {
        kick: "x.......x.......",
        rim: "....x.x.....x...",
        shaker: "x.x.x.x.x.x.x.x.",
        comp: "x...............",
        bass: "R/2 R 5",
      },
      steady: {
        kick: "x.......x.x.....",
        snare: "....x.x.....x...",
        hat: "X.x.X.x.X.x.X.x.",
        comp: "x...x...x...x...",
        bass: "R/.5 R/.5 R/.5 R/.5 5/.5 5/.5 3/.5 5/.5",
      },
      rush: {
        kick: "x.....x.x.x.....",
        snare: "....x.x.....x..o",
        hat: "X.x.X.x.X.x.X.x.",
        open: "..............x.",
        shaker: "xoxoxoxoxoxoxoxo",
        comp: "x...x.x.x...x.x.",
        bass: "R/.5 R/.5 8/.5 R/.5 5/.5 5/.5 3/.5 >/.5",
      },
    },
    fill: { kick: "x.......x.x.....", snare: "....x.x...xxxxxX" },
    arp: "01230123",
  },
  {
    // Festival house from the 2010s, at boba-shop volume: saw chords pumping
    // under the kick, a lead in threes against the four, a clap on two and four.
    name: "pearl drop",
    bpm: 126,
    key: "A minor",
    sfxRoot: 57,
    sfxScale: MINOR_PENTATONIC,
    lead: "saw",
    keys: "saw",
    kit: "club",
    pump: 0.55,
    swing: 0.5,
    chords: {
      Am: { keys: "e3 a3 c4 e4", bass: "a2", quality: "min" },
      F: { keys: "f3 a3 c4 f4", bass: "f2", quality: "maj" },
      C: { keys: "e3 g3 c4 e4", bass: "c3", quality: "maj" },
      G: { keys: "d3 g3 b3 d4", bass: "g2", quality: "maj" },
    },
    sections: [
      {
        chords: ["Am", "F", "C", "G", "Am", "F", "C", "G"],
        melody: [
          "e5/.75 e5/.75 c5/.5 e5/.75 a5/.75 g5/.5",
          "f5/.75 f5/.75 c5/.5 f5/.75 a5/.75 g5/.5",
          "e5/.75 e5/.75 c5/.5 e5/.75 g5/.75 e5/.5",
          "d5/.75 d5/.75 b4/.5 d5 -",
          "e5/.75 e5/.75 c5/.5 e5/.75 a5/.75 c6/.5",
          "c6/.75 a5/.75 f5/.5 a5/.75 c6/.75 a5/.5",
          "g5/.75 e5/.75 c5/.5 e5/.75 g5/.75 c6/.5",
          "b5/1.5 g5/.5 d5/2",
        ],
      },
      {
        chords: ["F", "G", "Am", "Am", "F", "G", "C", "G"],
        melody: [
          "a5/2 c6 a5",
          "b5/2 d6 b5",
          "c6/1.5 b5/.5 a5/2",
          "e5/.5 a5/.5 c6/.5 e6/.5 -/2",
          "a5/2 c6 f5",
          "b5/2 d6 g5",
          "e6/1.5 d6/.5 c6 g5",
          "d6/.5 b5/.5 g5/.5 b5/.5 d6/2",
        ],
      },
    ],
    grooves: {
      opening: {
        kick: "x...x...x...x...",
        hat: "..x...x...x...x.",
        comp: "x.......x.......",
        bass: "-/.5 R/.5 -/.5 R/.5 -/.5 R/.5 -/.5 R/.5",
      },
      steady: {
        kick: "x...x...x...x...",
        snare: "....x.......x...",
        open: "..x...x...x...x.",
        comp: "x..x..x.x..x..x.",
        bass: "-/.5 R/.5 -/.5 R/.5 -/.5 R/.5 -/.5 R/.5",
      },
      rush: {
        kick: "x...x...x...x...",
        snare: "....x.......x..o",
        open: "..x...x...x...x.",
        shaker: "xoxoxoxoxoxoxoxo",
        comp: "x..x..x.x..x..x.",
        bass: "-/.5 R/.5 -/.5 8/.5 -/.5 R/.5 -/.5 8/.5",
      },
    },
    // A snare roll that tightens into the next eight bars.
    fill: { kick: "x...x...x.x.xxxx", snare: "....x...x.x.xxxX" },
    arp: "01230123",
  },
  {
    // Techno, more or less: one chord for a long time, a bass that rolls
    // around the kick, and a nagging sixteenth-note line that barely moves.
    name: "after hours",
    bpm: 134,
    key: "D minor",
    sfxRoot: 62,
    sfxScale: MINOR_PENTATONIC,
    lead: "acid",
    keys: "saw",
    kit: "club",
    pump: 0.6,
    swing: 0.5,
    chords: {
      Dm7: { keys: "f3 a3 c4 e4", bass: "d2", quality: "min" },
      Bbmaj7: { keys: "f3 a3 bb3 d4", bass: "bb2", quality: "maj" },
      Gm7: { keys: "f3 g3 bb3 d4", bass: "g2", quality: "min" },
      A7sus: { keys: "g3 a3 d4 e4", bass: "a2", quality: "sus" },
      F: { keys: "f3 a3 c4 f4", bass: "f2", quality: "maj" },
      C: { keys: "e3 g3 c4 e4", bass: "c3", quality: "maj" },
    },
    sections: [
      {
        chords: ["Dm7", "Dm7", "Dm7", "Dm7", "Bbmaj7", "Bbmaj7", "Gm7", "A7sus"],
        melody: [
          "d5/.25 -/.25 d5/.25 f5/.25 -/.25 d5/.25 a5/.25 -/.25 d5/.25 -/.25 c5/.25 d5/.25 -/.25 f5/.25 d5/.25 -/.25",
          "d5/.25 -/.25 d5/.25 f5/.25 -/.25 d5/.25 a5/.25 -/.25 g5/.25 -/.25 f5/.25 d5/.25 -/.25 c5/.25 d5/.25 -/.25",
          "d5/.25 -/.25 d5/.25 f5/.25 -/.25 d5/.25 a5/.25 -/.25 d5/.25 -/.25 c5/.25 d5/.25 -/.25 f5/.25 d5/.25 -/.25",
          "d5/.25 -/.25 d5/.25 f5/.25 -/.25 d5/.25 a5/.25 -/.25 c6/.25 -/.25 a5/.25 f5/.25 -/.25 d5/.25 f5/.25 a5/.25",
          "d5/.25 -/.25 d5/.25 f5/.25 -/.25 d5/.25 bb5/.25 -/.25 d5/.25 -/.25 c5/.25 d5/.25 -/.25 f5/.25 d5/.25 -/.25",
          "d5/.25 -/.25 d5/.25 f5/.25 -/.25 d5/.25 bb5/.25 -/.25 a5/.25 -/.25 f5/.25 d5/.25 -/.25 c5/.25 d5/.25 -/.25",
          "d5/.25 -/.25 d5/.25 g5/.25 -/.25 d5/.25 bb5/.25 -/.25 d5/.25 -/.25 c5/.25 d5/.25 -/.25 g5/.25 d5/.25 -/.25",
          "e5/.25 -/.25 e5/.25 g5/.25 -/.25 e5/.25 a5/.25 -/.25 d6/.25 -/.25 a5/.25 g5/.25 -/.25 e5/.25 d5/.25 -/.25",
        ],
      },
      {
        chords: ["Dm7", "Dm7", "F", "F", "Gm7", "Gm7", "Bbmaj7", "C"],
        melody: [
          "a5/1.5 f5/.5 d5 f5",
          "a5/1.5 c6/.5 a5/2",
          "c6/1.5 a5/.5 f5 a5",
          "c6/1.5 d6/.5 c6/2",
          "d6/1.5 bb5/.5 g5 bb5",
          "d6/1.5 c6/.5 bb5/2",
          "a5 f5 d5 f5",
          "e5 g5 c6 e6",
        ],
      },
    ],
    grooves: {
      opening: {
        kick: "x...x...x...x...",
        hat: "..x...x...x...x.",
        comp: "x...............",
        bass: "-/.5 R/.5 -/.5 R/.5 -/.5 R/.5 -/.5 R/.5",
      },
      steady: {
        kick: "x...x...x...x...",
        snare: "....x.......x...",
        rim: "...x..x......x..",
        open: "..x...x...x...x.",
        shaker: "xoxoxoxoxoxoxoxo",
        comp: "x...............",
        bass: "-/.25 R/.25 R/.25 R/.25 -/.25 R/.25 R/.25 R/.25 -/.25 R/.25 R/.25 R/.25 -/.25 R/.25 R/.25 8/.25",
      },
      rush: {
        kick: "x...x...x...x...",
        snare: "....x..o....x..o",
        rim: "...x..x......x..",
        hat: "x.x.x.x.x.x.x.x.",
        open: "..x...x...x...x.",
        shaker: "xoxoxoxoxoxoxoxo",
        comp: "x.....x.....x...",
        bass: "-/.25 R/.25 R/.25 8/.25 -/.25 R/.25 R/.25 R/.25 -/.25 R/.25 8/.25 R/.25 -/.25 R/.25 R/.25 >/.25",
      },
    },
    fill: { kick: "x...x...x...xxxx", snare: "....x.......x.xX" },
    arp: "02.102.1",
  },
];
