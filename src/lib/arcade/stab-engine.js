// Straw stab rules, kept free of the DOM so they can be tested with node.
//
// Cups ride a belt and pass under the straw exactly on the soundtrack's
// beats. A run plays the songs slowest first, eight bars each, then loops
// with busier rhythms. The game only needs to know when each bar starts,
// which beats of a bar carry a cup, and how a stab's timing is judged.

export const BARS_PER_SONG = 8;
export const BEATS_PER_BAR = 4;
/** Empty bars before the first cup, so the beat can be felt first. */
export const INTRO_BARS = 2;
export const LIVES = 3;
export const GOLDEN_EVERY = 12;

/** Seconds either side of a beat that still count, best rating first. */
export const WINDOWS = Object.freeze({ perfect: 0.05, good: 0.1, graze: 0.15 });

/** @typedef {"perfect" | "good" | "graze"} StabRating */
/** @typedef {{ time: number, resolved: boolean }} TimedCup */

// Beats of a 4/4 bar that carry a cup, grouped by difficulty tier.
/** @type {number[][][]} */
const PATTERNS = [
  [[0, 2], [0, 2], [0, 1, 2], [0, 2, 3], [0]],
  [[0, 1, 2, 3], [0, 2, 3], [0, 1, 2], [0, 1.5, 2], [0, 2, 2.5]],
  [[0, 1, 2, 3], [0, 0.5, 1, 2, 3], [0, 1, 2, 2.5, 3], [0, 1.5, 2, 3], [0, 1, 1.5, 2, 3]],
  [[0, 0.5, 1, 2, 3], [0, 1, 1.5, 2, 2.5, 3], [0, 0.5, 1, 1.5, 2, 3], [0, 1, 2, 2.5, 3, 3.5]],
  [[0, 0.5, 1, 1.5, 2, 3], [0, 0.5, 1, 2, 2.5, 3, 3.5], [0, 1, 1.5, 2, 2.5, 3, 3.5]],
  [[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], [0, 0.5, 1, 1.5, 2, 3, 3.5], [0, 0.5, 1, 2, 2.5, 3, 3.5]],
];

export const MAX_TIER = PATTERNS.length - 1;

/** @param {number} bpm */
export function barSeconds(bpm) {
  return (BEATS_PER_BAR * 60) / bpm;
}

/** @param {number[]} tempos */
function loopSeconds(tempos) {
  return tempos.reduce((total, bpm) => total + BARS_PER_SONG * barSeconds(bpm), 0);
}

/**
 * Where a bar falls in the looping playlist.
 * @param {number[]} tempos tempo of each song, in playlist order
 * @param {number} bar
 */
export function barPosition(tempos, bar) {
  const perLoop = tempos.length * BARS_PER_SONG;
  const loop = Math.floor(bar / perLoop);
  const withinLoop = bar - loop * perLoop;
  const song = Math.floor(withinLoop / BARS_PER_SONG);
  return {
    loop,
    song,
    barInSong: withinLoop - song * BARS_PER_SONG,
    bpm: tempos[song],
  };
}

/**
 * Seconds from the first downbeat to the start of `bar`.
 * @param {number[]} tempos
 * @param {number} bar
 */
export function barStart(tempos, bar) {
  const { loop, song, barInSong } = barPosition(tempos, bar);
  let seconds = loop * loopSeconds(tempos);
  for (let index = 0; index < song; index++) {
    seconds += BARS_PER_SONG * barSeconds(tempos[index]);
  }
  return seconds + barInSong * barSeconds(tempos[song]);
}

/**
 * The bar playing at `seconds` (bar 0 before the first downbeat).
 * @param {number[]} tempos
 * @param {number} seconds
 */
export function barAtTime(tempos, seconds) {
  if (seconds <= 0) return 0;
  const loops = Math.floor(seconds / loopSeconds(tempos));
  let rest = seconds - loops * loopSeconds(tempos);
  let bar = loops * tempos.length * BARS_PER_SONG;
  for (const bpm of tempos) {
    const songLength = BARS_PER_SONG * barSeconds(bpm);
    if (rest < songLength) {
      return bar + Math.min(BARS_PER_SONG - 1, Math.floor(rest / barSeconds(bpm)));
    }
    rest -= songLength;
    bar += BARS_PER_SONG;
  }
  return bar;
}

/**
 * Difficulty tier: the tempo already climbs within a loop, so tiers only
 * step at the halfway song and at each new loop.
 * @param {number[]} tempos
 * @param {number} bar
 */
export function tierForBar(tempos, bar) {
  const { loop, song } = barPosition(tempos, bar);
  const secondHalf = song >= Math.ceil(tempos.length / 2) ? 1 : 0;
  return Math.min(MAX_TIER, loop * 2 + secondHalf);
}

/**
 * Beats of `bar` that carry a cup.
 * @param {number[]} tempos
 * @param {number} bar
 * @param {() => number} [random]
 * @returns {number[]}
 */
export function cupBeats(tempos, bar, random = Math.random) {
  if (bar < INTRO_BARS) return [];
  const { barInSong } = barPosition(tempos, bar);
  const tier = tierForBar(tempos, bar);
  // The last bar of each song is a breather before the tempo changes.
  const pool =
    barInSong === BARS_PER_SONG - 1 ? PATTERNS[Math.max(0, tier - 2)] : PATTERNS[tier];
  return [...pool[Math.floor(random() * pool.length) % pool.length]];
}

/**
 * @param {number} error signed seconds between the stab and the beat
 * @returns {StabRating | null}
 */
export function judgeStab(error) {
  const size = Math.abs(error);
  if (size <= WINDOWS.perfect) return "perfect";
  if (size <= WINDOWS.good) return "good";
  if (size <= WINDOWS.graze) return "graze";
  return null;
}

/**
 * @param {StabRating} rating
 * @param {boolean} golden
 * @param {number} combo stabs in a row, including this one
 */
export function pointsForStab(rating, golden, combo) {
  const base = rating === "perfect" ? 3 : rating === "good" ? 2 : 1;
  const streak = Math.min(4, Math.floor(combo / 10));
  return (golden ? base * 2 : base) + streak;
}

/**
 * The unresolved cup closest to `time` within the graze window, or -1.
 * @param {TimedCup[]} cups
 * @param {number} time
 */
export function nearestCup(cups, time) {
  let best = -1;
  let bestError = Infinity;
  for (let index = 0; index < cups.length; index++) {
    const cup = cups[index];
    if (cup.resolved) continue;
    const error = Math.abs(time - cup.time);
    if (error <= WINDOWS.graze && error < bestError) {
      best = index;
      bestError = error;
    }
  }
  return best;
}

/**
 * Whether a cup has slipped past the straw unstabbed.
 * @param {TimedCup} cup
 * @param {number} time
 */
export function isLate(cup, time) {
  return !cup.resolved && time - cup.time > WINDOWS.graze;
}

/** @param {number} count cups planned so far, including this one */
export function isGoldenCup(count) {
  return count > 0 && count % GOLDEN_EVERY === 0;
}
