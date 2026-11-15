// Straw stab rules, kept free of the DOM so they can be tested with node.
//
// Cups ride a belt and pass under the straw exactly on the soundtrack's
// beats. A run plays the songs slowest first, eight bars each, then loops
// with busier rhythms. The game only needs to know when each bar starts,
// which beats of a bar carry a cup, and how a stab's timing is judged.
//
// Timing. Every time here is song time: seconds from the first downbeat as
// it is heard. The page maps three clocks onto it the same way, through one
// offset between the page clock and the audio clock:
//   - a stab is judged at the moment its key or tap happened (the event's
//     own timestamp), not when the page got round to handling it;
//   - a frame is drawn for the moment it reaches the screen, about a frame
//     after its timestamp, so a cup sits on the notch when its beat is heard;
//   - a cup only counts as missed once a stab that was in time could no
//     longer be waiting to be handled.

export const BARS_PER_SONG = 8;
export const BEATS_PER_BAR = 4;
/** Empty bars before the first cup, so the beat can be felt first. */
export const INTRO_BARS = 2;
export const LIVES = 3;
const GOLDEN_EVERY = 12;

/** Seconds either side of a beat that still count, best rating first. */
export const WINDOWS = Object.freeze({ perfect: 0.05, good: 0.1, graze: 0.15 });
/** Expert's windows: a little over half as wide. */
export const EXPERT_WINDOWS = Object.freeze({ perfect: 0.03, good: 0.06, graze: 0.09 });

/** @typedef {"perfect" | "good" | "graze"} StabRating */
/** @typedef {{ time: number, resolved: boolean }} TimedCup */
/**
 * @typedef {object} StabMode
 * @property {boolean} expert
 * @property {{ perfect: number, good: number, graze: number }} windows
 * @property {number} lives
 * @property {number} firstTier the pattern tier a run opens on
 * @property {boolean} tierPerSong steps a tier every song, not every half loop
 * @property {number} maxTier
 * @property {number} breather tiers the last bar of a song drops back
 * @property {number} offbeat chance a bar's pattern is pushed half a beat late
 */

// Beats of a 4/4 bar that carry a cup, grouped by difficulty tier. Every
// cup sits on the straight eighth-note grid, which the songs' swing leaves
// alone, so a cup always lands on something the drums play.
/** @type {number[][][]} */
const PATTERNS = [
  [[0, 2], [0, 2], [0, 1, 2], [0, 2, 3], [0]],
  [[0, 1, 2, 3], [0, 2, 3], [0, 1, 2], [0, 1.5, 2], [0, 2, 2.5]],
  [[0, 1, 2, 3], [0, 0.5, 1, 2, 3], [0, 1, 2, 2.5, 3], [0, 1.5, 2, 3], [0, 1, 1.5, 2, 3]],
  [[0, 0.5, 1, 2, 3], [0, 1, 1.5, 2, 2.5, 3], [0, 0.5, 1, 1.5, 2, 3], [0, 1, 2, 2.5, 3, 3.5]],
  [[0, 0.5, 1, 1.5, 2, 3], [0, 0.5, 1, 2, 2.5, 3, 3.5], [0, 1, 1.5, 2, 2.5, 3, 3.5]],
  [[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], [0, 0.5, 1, 1.5, 2, 3, 3.5], [0, 0.5, 1, 2, 2.5, 3, 3.5]],
  // Expert only: syncopated, with gaps where the hand expects a cup.
  [
    [0.5, 1, 1.5, 2.5, 3, 3.5],
    [0, 0.5, 1.5, 2, 2.5, 3.5],
    [0, 1, 1.5, 2.5, 3, 3.5],
    [0.5, 1, 2, 2.5, 3, 3.5],
    [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
  ],
];

/** The top tier in normal mode; expert has one more. */
export const MAX_TIER = 5;
export const EXPERT_MAX_TIER = PATTERNS.length - 1;

/** @type {Readonly<StabMode>} */
export const NORMAL = Object.freeze({
  expert: false,
  windows: WINDOWS,
  lives: LIVES,
  firstTier: 0,
  tierPerSong: false,
  maxTier: MAX_TIER,
  breather: 2,
  offbeat: 0,
});

/**
 * Expert: windows a little over half as wide, two pearls, opening two tiers
 * up and climbing a tier every song into a syncopated tier of its own, a
 * shorter breather, and a third of bars pushed half a beat off the beat.
 * @type {Readonly<StabMode>}
 */
export const EXPERT = Object.freeze({
  expert: true,
  windows: EXPERT_WINDOWS,
  lives: 2,
  firstTier: 2,
  tierPerSong: true,
  maxTier: EXPERT_MAX_TIER,
  breather: 1,
  offbeat: 0.35,
});

/** @param {boolean} expert */
export function stabMode(expert) {
  return expert ? EXPERT : NORMAL;
}

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
 * Song time at a fractional bar (2.5 is halfway through bar 2).
 * @param {number[]} tempos
 * @param {number} bars
 */
export function timeAtBar(tempos, bars) {
  const bar = Math.floor(bars);
  return barStart(tempos, bar) + (bars - bar) * barSeconds(barPosition(tempos, bar).bpm);
}

/**
 * Difficulty tier. Normal: the tempo already climbs within a loop, so tiers
 * only step at the halfway song and at each new loop. Expert opens higher
 * and steps every song.
 * @param {number[]} tempos
 * @param {number} bar
 * @param {StabMode} [mode]
 */
export function tierForBar(tempos, bar, mode = NORMAL) {
  const { loop, song } = barPosition(tempos, bar);
  if (mode.tierPerSong) {
    return Math.min(mode.maxTier, mode.firstTier + loop * tempos.length + song);
  }
  const secondHalf = song >= Math.ceil(tempos.length / 2) ? 1 : 0;
  return Math.min(mode.maxTier, mode.firstTier + loop * 2 + secondHalf);
}

/**
 * Beats of `bar` that carry a cup.
 * @param {number[]} tempos
 * @param {number} bar
 * @param {() => number} [random]
 * @param {StabMode} [mode]
 * @returns {number[]}
 */
export function cupBeats(tempos, bar, random = Math.random, mode = NORMAL) {
  if (bar < INTRO_BARS) return [];
  const { barInSong } = barPosition(tempos, bar);
  const tier = tierForBar(tempos, bar, mode);
  // The last bar of each song is a breather before the tempo changes.
  const pool =
    barInSong === BARS_PER_SONG - 1 ? PATTERNS[Math.max(0, tier - mode.breather)] : PATTERNS[tier];
  const beats = [...pool[Math.floor(random() * pool.length) % pool.length]];
  if (!mode.offbeat || random() >= mode.offbeat) return beats;
  // Pushed half a beat late: the cups fall between the drums' downbeats.
  const pushed = beats.map((beat) => (beat + 0.5) % BEATS_PER_BAR);
  return [...new Set(pushed)].sort((a, b) => a - b);
}

/**
 * @param {number} error signed seconds between the stab and the beat
 * @param {StabMode} [mode]
 * @returns {StabRating | null}
 */
export function judgeStab(error, mode = NORMAL) {
  const size = Math.abs(error);
  const { windows } = mode;
  if (size <= windows.perfect) return "perfect";
  if (size <= windows.good) return "good";
  if (size <= windows.graze) return "graze";
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
 * The unresolved cup closest to `time` within the graze window, or -1. On
 * a tie the earlier cup wins, so a stab never skips a cup that is due.
 * @param {TimedCup[]} cups in time order
 * @param {number} time
 * @param {StabMode} [mode]
 */
export function nearestCup(cups, time, mode = NORMAL) {
  let best = -1;
  let bestError = Infinity;
  for (let index = 0; index < cups.length; index++) {
    const cup = cups[index];
    if (cup.resolved) continue;
    const error = Math.abs(time - cup.time);
    if (error <= mode.windows.graze && error < bestError - 1e-9) {
      best = index;
      bestError = error;
    }
  }
  return best;
}

/**
 * Whether a cup is past the last moment a stab could take it.
 * @param {TimedCup} cup
 * @param {number} time
 * @param {StabMode} [mode]
 */
export function isLate(cup, time, mode = NORMAL) {
  return !cup.resolved && time - cup.time > mode.windows.graze;
}

/** @param {number} count cups planned so far, including this one */
export function isGoldenCup(count) {
  return count > 0 && count % GOLDEN_EVERY === 0;
}

// --- Timing ----------------------------------------------------------------

/**
 * How long a key or tap may plausibly wait for the page to handle it, in
 * seconds. A cup is only called missed this long after its window closes,
 * so a stab that was in time but handled late still finds its cup.
 */
export const INPUT_GRACE = 0.06;
/** Two stabs closer than this are one press bouncing, and count once. */
export const STAB_COOLDOWN = 0.06;
/** The page-to-audio offset snaps to a reading this far off, and eases toward a nearer one. */
export const CLOCK_SNAP = 0.03;
export const CLOCK_EASE = 0.05;
/** The frame lead is kept between 240 Hz and 30 Hz frames. */
const MIN_FRAME = 1 / 240;
const MAX_FRAME = 1 / 30;

/**
 * Whether the frame loop should call a cup missed at `now`: its window has
 * closed and any stab made inside it has had time to be handled.
 * @param {TimedCup} cup
 * @param {number} now song time as heard right now
 * @param {StabMode} [mode]
 */
export function isMissed(cup, now, mode = NORMAL) {
  return isLate(cup, now - INPUT_GRACE, mode);
}

/**
 * When an input happened on the page clock, in seconds: the event's own
 * timestamp, which is when the key went down or the finger landed, unless
 * it is implausible (missing, in the future, or from another time base),
 * in which case the moment it is handled. Handlers run late whenever the
 * page is busy drawing, and judging their time would mark stabs late.
 * @param {number} stamp event.timeStamp, in ms
 * @param {number} now performance.now() as the handler runs, in ms
 */
export function inputSeconds(stamp, now) {
  const plausible = Number.isFinite(stamp) && stamp > 0 && stamp <= now + 1 && now - stamp < 1000;
  return (plausible ? stamp : now) / 1000;
}

/**
 * The moment a frame reaches the screen, on the page clock in seconds: one
 * frame interval after the frame's own timestamp, since what is drawn now
 * shows at the next refresh. Drawing for that moment puts a cup on the notch
 * when its beat is heard, not a frame after.
 * @param {number} frameStamp the requestAnimationFrame timestamp, in ms
 * @param {number} now performance.now(), in ms
 * @param {number} interval the measured frame interval, in seconds
 */
export function presentSeconds(frameStamp, now, interval) {
  const base = Number.isFinite(frameStamp) && Math.abs(now - frameStamp) < 100 ? frameStamp : now;
  const lead = Number.isFinite(interval) ? Math.min(MAX_FRAME, Math.max(MIN_FRAME, interval)) : 1 / 60;
  return base / 1000 + lead;
}

/**
 * The offset from the page clock to the heard audio clock, kept steady: a
 * reading close to the last is eased in (the audio clock ticks in blocks),
 * a far one (the first, a resume, a new output device) is taken at once.
 * @param {number | null} offset the current offset, or null before the first reading
 * @param {number} reading heard audio time minus page time, in seconds
 */
export function steadyOffset(offset, reading) {
  if (offset === null || Math.abs(reading - offset) > CLOCK_SNAP) return reading;
  return offset + (reading - offset) * CLOCK_EASE;
}

/**
 * Song time at a page-clock moment.
 * @param {number} pageSeconds
 * @param {number} offset page-to-audio offset, in seconds
 * @param {number} origin audio time of the first downbeat
 */
export function songTime(pageSeconds, offset, origin) {
  return pageSeconds + offset - origin;
}

/**
 * Where a cup's centre is drawn, in px: on the straw's notch exactly at its
 * beat, ahead of it (to the right) before, behind it after.
 * @param {number} strawX the notch, in px
 * @param {number} speed belt speed, in px a second
 * @param {number} cupTime the cup's beat, in song time
 * @param {number} at the song time being drawn
 */
export function beltX(strawX, speed, cupTime, at) {
  return strawX + (cupTime - at) * speed;
}

// --- Sharing ---------------------------------------------------------------

/** Marks a bar can carry, worst last; a bar keeps the worst it got. */
export const MARK = Object.freeze({ none: 0, perfect: 1, good: 2, graze: 3, miss: 4 });
const SQUARES = ["", "🟩", "🟨", "🟧", "🟥"];

/**
 * Records a stab's result (or a miss) against its bar.
 * @param {number[]} marks one per bar, MARK values
 * @param {number} bar
 * @param {StabRating | "miss"} result
 */
export function markBar(marks, bar, result) {
  const value = MARK[result];
  if (!((marks[bar] ?? 0) >= value)) marks[bar] = value;
}

/**
 * The run as emoji lines: one row per song, one square per bar that had a
 * cup, coloured by the worst stab in that bar. A long run shares its last
 * songs, the first row led by an ellipsis.
 * @param {number[]} marks
 * @param {number} [maxRows]
 */
export function shareRows(marks, maxRows = 4) {
  /** @type {string[]} */
  const rows = [];
  for (let start = 0; start < marks.length; start += BARS_PER_SONG) {
    let row = "";
    for (let bar = start; bar < Math.min(marks.length, start + BARS_PER_SONG); bar++) {
      row += SQUARES[marks[bar] ?? 0] ?? "";
    }
    if (row) rows.push(row);
  }
  if (rows.length <= maxRows) return rows;
  const kept = rows.slice(-maxRows);
  kept[0] = `…${kept[0]}`;
  return kept;
}

// --- The demo --------------------------------------------------------------

/**
 * The demo, in bars of song time: what its caption says from each point on,
 * and when it is over. Each slip below lands while its caption is up.
 */
export const DEMO_CAPTIONS = Object.freeze([
  { bar: 0, text: "Every notch on the belt is a beat of the song." },
  { bar: 1.5, text: "Stab each cup as it reaches the red notch." },
  { bar: 4.5, text: "Close to the notch still counts, for fewer points." },
  { bar: 6.5, text: "Let a cup go by and you lose a pearl." },
  { bar: 8, text: "Each new song runs a little faster." },
  { bar: 10, text: "Lose all your pearls and it’s last call." },
]);
export const DEMO_END_BAR = 12;
/** Bars from which the demo's first cup is stabbed off the beat, or let go (null). */
export const DEMO_SLIPS = Object.freeze([
  { bar: 5, offset: 0.075 },
  { bar: 6, offset: -0.125 },
  { bar: 7, offset: null },
]);
export const DEMO_SEED = 4242;

/**
 * The demo's caption at a fractional bar.
 * @param {number} bars
 */
export function demoCaption(bars) {
  let text = "";
  for (const line of DEMO_CAPTIONS) if (bars >= line.bar) text = line.text;
  return text;
}

/**
 * The demo's autopilot. Given each planned cup's bar in order, says when to
 * stab it: seconds off its beat (0 is dead on), or null to let it go by.
 */
export function createAutopilot() {
  let slip = 0;
  /** @param {number} bar */
  return (bar) => {
    const next = DEMO_SLIPS[slip];
    if (next && bar >= next.bar) {
      slip += 1;
      return next.offset;
    }
    return 0;
  };
}

/**
 * A small seeded generator, so the demo plays the same cups every time.
 * @param {number} seed
 */
export function seededRandom(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
