import assert from "node:assert/strict";
import test from "node:test";

import { createRng } from "../src/lib/arcade/core/rng.ts";
import {
  BARS_PER_SONG,
  BEATS_PER_BAR,
  CLOCK_SNAP,
  EXPERT,
  EXPERT_MAX_TIER,
  EXPERT_WINDOWS,
  INPUT_GRACE,
  INTRO_BARS,
  MARK,
  MAX_TIER,
  NORMAL,
  PRACTICE_CUPS,
  PRACTICE_STREAK,
  STAB_COOLDOWN,
  TIER_PATTERNS,
  WINDOWS,
  barAtTime,
  barPosition,
  barStart,
  beltX,
  createPractice,
  cupBeats,
  endPractice,
  inputSeconds,
  isGoldenCup,
  isLate,
  isMissed,
  planPracticeCup,
  practiceAt,
  judgeStab,
  markBar,
  nearestCup,
  perfectWindow,
  pointsForStab,
  practiceLearned,
  practiceOn,
  practiceResult,
  presentSeconds,
  shareRows,
  songTime,
  stabMode,
  steadyOffset,
  tierForBar,
  timeAtBar,
} from "../src/lib/arcade/stab-engine.js";

const TEMPOS = [124, 140, 150, 164];
const close = (a, b, epsilon = 1e-9) => Math.abs(a - b) < epsilon;

// --- What is drawn at the notch is what is judged ---------------------------

test("a cup is drawn on the notch exactly at its beat, and moves at the belt's speed", () => {
  const strawX = 384;
  const speed = 420;
  assert.equal(beltX(strawX, speed, 3.5, 3.5), strawX);
  assert.ok(close(beltX(strawX, speed, 3.5, 3.4), strawX + 42));
  assert.ok(close(beltX(strawX, speed, 3.5, 3.6), strawX - 42));
});

test("a stab made when a cup is seen on the notch is judged dead on", () => {
  // The audio heard is 0.25 s ahead of the page clock; the first downbeat
  // was heard at audio time 10.
  const offset = 0.25;
  const origin = 10;
  const cupTime = 2;
  // A 60 Hz frame stamped at t ms is on the screen at t + 16.7 ms. Find the
  // frame that shows the cup on the notch, then a tap at that moment.
  const interval = 1 / 60;
  const frameStamp = (cupTime + origin - offset - interval) * 1000;
  const shown = songTime(presentSeconds(frameStamp, frameStamp + 2, interval), offset, origin);
  assert.ok(close(beltX(300, 400, cupTime, shown), 300, 1e-6));
  // The page is busy, so the handler runs 22 ms after the tap.
  const tap = (cupTime + origin - offset) * 1000;
  const judged = songTime(inputSeconds(tap, tap + 22), offset, origin);
  assert.ok(close(judged - cupTime, 0, 1e-9));
  assert.equal(judgeStab(judged - cupTime), "perfect");
});

test("a stab is timed by its event, not by when it was handled", () => {
  assert.equal(inputSeconds(1000, 1025), 1);
  assert.equal(inputSeconds(1000, 1000), 1);
  // Implausible stamps fall back to the handling time: missing, zero, from
  // the future, or on another time base (epoch milliseconds).
  assert.equal(inputSeconds(Number.NaN, 2000), 2);
  assert.equal(inputSeconds(0, 2000), 2);
  assert.equal(inputSeconds(2050, 2000), 2);
  assert.equal(inputSeconds(1.7e12, 2000), 2);
  assert.equal(inputSeconds(500, 2000), 2);
});

test("frames are drawn for the moment they reach the screen", () => {
  assert.ok(close(presentSeconds(1000, 1003, 1 / 60), 1 + 1 / 60));
  assert.ok(close(presentSeconds(1000, 1001, 1 / 120), 1 + 1 / 120));
  // The lead is held to a sensible frame, whatever the measurement says.
  assert.ok(close(presentSeconds(1000, 1001, 0.5), 1 + 1 / 30));
  assert.ok(close(presentSeconds(1000, 1001, 0), 1 + 1 / 240));
  // A timestamp far from now (a stalled tab) is not trusted.
  assert.ok(close(presentSeconds(1000, 5000, 1 / 60), 5 + 1 / 60));
});

test("the audio offset eases small wobble and snaps to real jumps", () => {
  assert.equal(steadyOffset(null, 0.31), 0.31);
  const eased = steadyOffset(0.3, 0.31);
  assert.ok(eased > 0.3 && eased < 0.31);
  assert.equal(steadyOffset(0.3, 0.3 + CLOCK_SNAP + 0.001), 0.3 + CLOCK_SNAP + 0.001);
  // Steady readings converge; block-sized jitter around them stays tiny.
  let offset = steadyOffset(null, 0.2);
  for (let frame = 0; frame < 600; frame++) {
    offset = steadyOffset(offset, 0.2 + (frame % 2 ? 0.0027 : -0.0027));
  }
  assert.ok(Math.abs(offset - 0.2) < 0.0003);
});

test("a cup in time is still there for a stab the page handled late", () => {
  const cup = { time: 4, resolved: false };
  const lastMoment = 4 + WINDOWS.graze;
  // The frame loop has moved past the window, but not past the grace.
  assert.equal(isLate(cup, lastMoment + 0.01), true);
  assert.equal(isMissed(cup, lastMoment + 0.01), false);
  assert.equal(isMissed(cup, lastMoment + INPUT_GRACE - 0.001), false);
  assert.equal(isMissed(cup, lastMoment + INPUT_GRACE + 0.001), true);
  // The stab, timed by its event at the window's edge, still takes it.
  assert.equal(nearestCup([cup], lastMoment - 1e-6), 0);
  assert.equal(isMissed(cup, lastMoment + INPUT_GRACE + 0.001, EXPERT), true);
});

test("a stab takes the nearest unjudged cup, the earlier on a tie", () => {
  const cups = [
    { time: 1, resolved: false },
    { time: 1.2, resolved: false },
    { time: 1.4, resolved: false },
  ];
  assert.equal(nearestCup(cups, 1.09), 0);
  assert.equal(nearestCup(cups, 1.11), 1);
  assert.equal(nearestCup(cups, 1.1), 0);
  cups[0].resolved = true;
  assert.equal(nearestCup(cups, 1.05), 1);
  assert.equal(nearestCup(cups, 1.3), 1);
  cups[1].resolved = true;
  assert.equal(nearestCup(cups, 1.3), 2);
  assert.equal(nearestCup(cups, 1.24), -1);
});

// --- Expert ------------------------------------------------------------------

test("expert's windows are far tighter", () => {
  assert.equal(stabMode(false), NORMAL);
  assert.equal(stabMode(true), EXPERT);
  assert.equal(judgeStab(0.04), "perfect");
  assert.equal(judgeStab(0.04, EXPERT), "good");
  assert.equal(judgeStab(0.08, EXPERT), "graze");
  assert.equal(judgeStab(0.12), "graze");
  assert.equal(judgeStab(0.12, EXPERT), null);
  assert.ok(EXPERT.windows.graze <= WINDOWS.graze * 0.6 + 1e-9);
  assert.ok(EXPERT.lives < NORMAL.lives);
  const cup = { time: 2, resolved: false };
  assert.equal(nearestCup([cup], 2.1), 0);
  assert.equal(nearestCup([cup], 2.1, EXPERT), -1);
});

test("expert opens two tiers up, climbs every song, and tops out higher", () => {
  assert.equal(tierForBar(TEMPOS, 0, EXPERT), 2);
  assert.equal(tierForBar(TEMPOS, BARS_PER_SONG, EXPERT), 3);
  assert.equal(tierForBar(TEMPOS, 3 * BARS_PER_SONG, EXPERT), 5);
  assert.equal(tierForBar(TEMPOS, 4 * BARS_PER_SONG, EXPERT), EXPERT_MAX_TIER);
  assert.equal(tierForBar(TEMPOS, 99 * BARS_PER_SONG, EXPERT), EXPERT_MAX_TIER);
  assert.ok(EXPERT_MAX_TIER > MAX_TIER);
  assert.equal(tierForBar(TEMPOS, 99 * BARS_PER_SONG), MAX_TIER);
});

test("expert carries more cups, many of them off the beat", () => {
  const count = (mode) => {
    const random = createRng(11);
    let cups = 0;
    let half = 0;
    let noDownbeat = 0;
    for (let bar = INTRO_BARS; bar < 4 * BARS_PER_SONG; bar++) {
      const beats = cupBeats(TEMPOS, bar, random, mode);
      assert.ok(beats.every((beat) => beat >= 0 && beat < 4 && beat * 2 === Math.round(beat * 2)));
      assert.deepEqual([...beats].sort((a, b) => a - b), beats);
      assert.equal(new Set(beats).size, beats.length);
      cups += beats.length;
      half += beats.filter((beat) => beat % 1).length;
      if (!beats.includes(0)) noDownbeat += 1;
    }
    return { cups, half: half / cups, noDownbeat };
  };
  const normal = count(NORMAL);
  const expert = count(EXPERT);
  assert.equal(normal.noDownbeat, 0);
  assert.ok(normal.half < 0.15);
  assert.ok(expert.cups > normal.cups * 1.8, `${expert.cups} vs ${normal.cups}`);
  assert.ok(expert.half > 0.35, `${expert.half} of cups on a half beat`);
  assert.ok(expert.noDownbeat >= 3, `${expert.noDownbeat} bars with no downbeat cup`);
});

// --- Sharing -------------------------------------------------------------------

test("a bar keeps the worst stab it got", () => {
  const marks = [];
  markBar(marks, 3, "perfect");
  assert.equal(marks[3], MARK.perfect);
  markBar(marks, 3, "graze");
  markBar(marks, 3, "good");
  assert.equal(marks[3], MARK.graze);
  markBar(marks, 3, "miss");
  assert.equal(marks[3], MARK.miss);
});

test("the share is a row of bars per song, the last four songs at most", () => {
  const marks = [];
  for (let bar = INTRO_BARS; bar < 12; bar++) markBar(marks, bar, "perfect");
  markBar(marks, 9, "good");
  markBar(marks, 11, "miss");
  assert.deepEqual(shareRows(marks), ["🟩🟩🟩🟩🟩🟩", "🟩🟨🟩🟥"]);

  const long = [];
  for (let bar = INTRO_BARS; bar < 6 * BARS_PER_SONG; bar++) markBar(long, bar, "perfect");
  const rows = shareRows(long);
  assert.equal(rows.length, 4);
  assert.ok(rows[0].startsWith("…"));
  assert.equal(rows[3], "🟩".repeat(8));
  assert.deepEqual(shareRows([]), []);
});

// --- The climb -----------------------------------------------------------------

/** Songs a run has played by `bar`, counting from 0. */
const songOf = (tempos, bar) => {
  const { loop, song } = barPosition(tempos, bar);
  return loop * tempos.length + song;
};

test("normal opens as it did, then reaches tiers 4 and 5 a song sooner", () => {
  // The tier each song of a run plays at, song 0 first. Before: 0 0 1 1 2 2 3 3 4 4 5.
  const tiers = Array.from({ length: 12 }, (_, song) => tierForBar(TEMPOS, song * BARS_PER_SONG + 3));
  assert.deepEqual(tiers, [0, 0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 5]);
  // Every bar of a song is at its song's tier: the time of day changes with the music.
  for (let bar = 0; bar < 12 * BARS_PER_SONG; bar++) {
    assert.equal(tierForBar(TEMPOS, bar), tiers[songOf(TEMPOS, bar)]);
  }
});

test("expert still opens two tiers up and climbs a tier every song", () => {
  const tiers = Array.from({ length: 7 }, (_, song) => tierForBar(TEMPOS, song * BARS_PER_SONG, EXPERT));
  assert.deepEqual(tiers, [2, 3, 4, 5, 6, 6, 6]);
});

/** Mean cups a bar in a tier, and the share of its bars that skip a beat right after an off-beat cup. */
function tierShape(tier) {
  const bars = TIER_PATTERNS[tier];
  const cups = bars.reduce((sum, bar) => sum + bar.length, 0) / bars.length;
  const syncopated = bars.filter((bar) => bar.some((beat) => beat % 1 !== 0 && beat + 0.5 < BEATS_PER_BAR && !bar.includes(beat + 0.5))).length;
  return { cups, syncopated: syncopated / bars.length };
}

/** Every bar each tier could draw before this change, so the additions can be pinned. */
const BEFORE = [
  [[0, 2], [0, 2], [0, 1, 2], [0, 2, 3], [0]],
  [[0, 1, 2, 3], [0, 2, 3], [0, 1, 2], [0, 1.5, 2], [0, 2, 2.5]],
  [[0, 1, 2, 3], [0, 0.5, 1, 2, 3], [0, 1, 2, 2.5, 3], [0, 1.5, 2, 3], [0, 1, 1.5, 2, 3]],
  [[0, 0.5, 1, 2, 3], [0, 1, 1.5, 2, 2.5, 3], [0, 0.5, 1, 1.5, 2, 3], [0, 1, 2, 2.5, 3, 3.5]],
  [[0, 0.5, 1, 1.5, 2, 3], [0, 0.5, 1, 2, 2.5, 3, 3.5], [0, 1, 1.5, 2, 2.5, 3, 3.5]],
  [[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], [0, 0.5, 1, 1.5, 2, 3, 3.5], [0, 0.5, 1, 2, 2.5, 3, 3.5]],
  [[0.5, 1, 1.5, 2.5, 3, 3.5], [0, 0.5, 1.5, 2, 2.5, 3.5], [0, 1, 1.5, 2.5, 3, 3.5], [0.5, 1, 2, 2.5, 3, 3.5], [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]],
];

test("tiers 0 to 2 are as they were; each later tier only gains bars, and every tier gained a syncopated one", () => {
  for (let tier = 0; tier <= 2; tier++) assert.deepEqual(TIER_PATTERNS[tier], BEFORE[tier], `tier ${tier}`);
  const key = (bar) => bar.join(",");
  for (let tier = 3; tier <= EXPERT_MAX_TIER; tier++) {
    const now = TIER_PATTERNS[tier].map(key);
    for (const bar of BEFORE[tier]) assert.ok(now.includes(key(bar)), `tier ${tier} kept ${bar}`);
    const added = TIER_PATTERNS[tier].filter((bar) => !BEFORE[tier].map(key).includes(key(bar)));
    assert.ok(added.length > 0 && tierShape(tier).syncopated > 0, `tier ${tier}`);
  }
  // Cups a bar, tier by tier. Before: 2.2, 3.2, 4.6, 5.75, 6.67, 7.33, 6.4.
  const cups = [0, 1, 2, 3, 4, 5, 6].map((tier) => Math.round(tierShape(tier).cups * 100) / 100);
  assert.deepEqual(cups, [2.2, 3.2, 4.6, 5.8, 6.5, 7.4, 6.5]);
  // Each tier carries more than the one before, up to normal's top (expert's own tier is syncopation, not more cups).
  for (let tier = 1; tier <= MAX_TIER; tier++) assert.ok(tierShape(tier).cups > tierShape(tier - 1).cups, `tier ${tier}`);
});

test("over a run, normal's belt carries a little more from its second minute, the first untouched", () => {
  // Cups a minute, averaged over many runs, in normal's first three minutes
  // on a typical playlist: before this change 98, 184 and 249.
  const tempos = [126, 140, 150, 162];
  const perMinute = [0, 0, 0];
  const runs = 200;
  for (let seed = 1; seed <= runs; seed++) {
    const random = createRng(seed);
    for (let bar = 0; barStart(tempos, bar) < 180; bar++) {
      perMinute[Math.floor(barStart(tempos, bar) / 60)] += cupBeats(tempos, bar, random, NORMAL).length / runs;
    }
  }
  assert.ok(Math.abs(perMinute[0] - 98.4) < 1, `${perMinute[0]}`);
  assert.ok(perMinute[1] > 184 * 1.02 && perMinute[1] < 184 * 1.06, `${perMinute[1]}`);
  assert.ok(perMinute[2] > 249 * 1.02 && perMinute[2] < 249 * 1.06, `${perMinute[2]}`);
});

test("only the perfect band tightens, by a tenth, and only in each mode's top two tiers", () => {
  assert.equal(perfectWindow(NORMAL, 0), WINDOWS.perfect);
  assert.equal(perfectWindow(NORMAL, MAX_TIER - 2), WINDOWS.perfect);
  assert.equal(perfectWindow(NORMAL, MAX_TIER - 1), 0.045);
  assert.equal(perfectWindow(NORMAL, MAX_TIER), 0.045);
  assert.equal(perfectWindow(EXPERT, EXPERT_MAX_TIER - 2), EXPERT_WINDOWS.perfect);
  assert.equal(perfectWindow(EXPERT, EXPERT_MAX_TIER), 0.027);
  assert.ok(Math.abs(0.045 / WINDOWS.perfect - 0.9) < 1e-9 && Math.abs(0.027 / EXPERT_WINDOWS.perfect - 0.9) < 1e-9);
  // A 47 ms stab: perfect early on, good at the top.
  assert.equal(judgeStab(0.047), "perfect");
  assert.equal(judgeStab(0.047, NORMAL, MAX_TIER - 2), "perfect");
  assert.equal(judgeStab(-0.047, NORMAL, MAX_TIER), "good");
  assert.equal(judgeStab(0.028, EXPERT, EXPERT_MAX_TIER - 2), "perfect");
  assert.equal(judgeStab(0.028, EXPERT, EXPERT_MAX_TIER), "good");
  // Good and graze are the same in every tier.
  for (const [mode, top] of [[NORMAL, MAX_TIER], [EXPERT, EXPERT_MAX_TIER]]) {
    for (let tier = 0; tier <= top; tier++) {
      assert.equal(judgeStab(mode.windows.good, mode, tier), "good");
      assert.equal(judgeStab(mode.windows.graze, mode, tier), "graze");
      assert.equal(judgeStab(mode.windows.graze + 0.001, mode, tier), null);
    }
  }
});

// --- Every pattern stays playable -------------------------------------------------

test("every bar a tier can draw is on the eighth grid, in order, and normal's always has its downbeat", () => {
  for (const [tier, bars] of TIER_PATTERNS.entries()) {
    for (const bar of bars) {
      assert.ok(bar.length > 0);
      assert.ok(bar.every((beat) => beat >= 0 && beat < BEATS_PER_BAR && beat * 2 === Math.round(beat * 2)), `${tier}: ${bar}`);
      assert.deepEqual([...bar].sort((a, b) => a - b), [...bar]);
      assert.equal(new Set(bar).size, bar.length);
      if (tier <= MAX_TIER) assert.ok(bar.includes(0), `normal tier ${tier}: ${bar}`);
    }
  }
});

/**
 * The cups of a run's first `bars` bars, as the game plans them: each at its
 * beat, with its bar's tier.
 */
function planRun(tempos, bars, mode, seed) {
  const random = createRng(seed);
  const cups = [];
  for (let bar = 0; bar < bars; bar++) {
    const start = barStart(tempos, bar);
    const beatLength = 60 / barPosition(tempos, bar).bpm;
    for (const beat of cupBeats(tempos, bar, random, mode)) {
      cups.push({ time: start + beat * beatLength, bar, tier: tierForBar(tempos, bar, mode), resolved: false });
    }
  }
  return cups;
}

/**
 * A hand that stabs every cup `offset(cup)` seconds off its beat, through the
 * game's own rules (the nearest waiting cup takes a stab, two stabs closer
 * than the cooldown count once, a cup is missed once its window and grace
 * have passed), in time order. Returns the ratings, the misses, and the
 * stabs the cooldown swallowed.
 */
function playThrough(cups, mode, offset) {
  const stabs = cups.map((cup) => ({ at: cup.time + offset(cup), cup })).sort((a, b) => a.at - b.at);
  const ratings = [];
  let missed = 0;
  let swallowed = 0;
  let stolen = 0;
  let lastStab = -Infinity;
  for (const { at, cup: meant } of stabs) {
    for (const cup of cups) {
      if (isMissed(cup, at, mode)) {
        cup.resolved = true;
        missed += 1;
      }
    }
    if (at - lastStab < STAB_COOLDOWN) {
      swallowed += 1;
      continue;
    }
    lastStab = at;
    const index = nearestCup(cups, at, mode);
    if (index < 0) continue;
    const cup = cups[index];
    cup.resolved = true;
    if (cup !== meant) stolen += 1;
    ratings.push(judgeStab(at - cup.time, mode, cup.tier));
  }
  for (const cup of cups) if (!cup.resolved) missed += 1;
  return { ratings, missed, swallowed, stolen };
}

const PLAYLISTS = [
  [124, 138, 150, 164],
  [128, 140, 152, 162],
  // The fastest four, to squeeze every gap.
  [150, 156, 162, 164],
];

test("a dead-on hand takes every cup as a perfect, in both modes, at any tempo, through every tier", () => {
  for (const tempos of PLAYLISTS) {
    for (const mode of [NORMAL, EXPERT]) {
      for (let seed = 1; seed <= 30; seed++) {
        // Three loops: every tier, the breathers, and the loop joins.
        const cups = planRun(tempos, 3 * tempos.length * BARS_PER_SONG, mode, seed);
        assert.equal(cups.at(-1).tier, mode.maxTier);
        // No two cups closer than half a beat of the faster song either side,
        // across bar and song joins too: a gap the cooldown can never eat.
        for (let i = 1; i < cups.length; i++) {
          const halfBeat = 30 / Math.max(barPosition(tempos, cups[i - 1].bar).bpm, barPosition(tempos, cups[i].bar).bpm);
          assert.ok(cups[i].time - cups[i - 1].time >= halfBeat - 1e-9, `gap before cup ${i}`);
          assert.ok(cups[i].time - cups[i - 1].time > STAB_COOLDOWN * 2);
        }
        const run = playThrough(cups, mode, () => 0);
        assert.equal(run.missed, 0);
        assert.equal(run.swallowed, 0);
        assert.equal(run.stolen, 0);
        assert.ok(run.ratings.every((rating) => rating === "perfect"));
      }
    }
  }
});

test("a stab anywhere inside a cup's perfect band takes that cup, never a neighbour", () => {
  for (const tempos of PLAYLISTS) {
    for (const mode of [NORMAL, EXPERT]) {
      for (let seed = 1; seed <= 30; seed++) {
        const cups = planRun(tempos, 3 * tempos.length * BARS_PER_SONG, mode, seed);
        // Alternately at the band's early and late edge (just inside it, as float allows).
        let flip = 1;
        const run = playThrough(cups, mode, (cup) => (flip = -flip) * perfectWindow(mode, cup.tier) * 0.999);
        assert.equal(run.missed, 0);
        assert.equal(run.stolen, 0);
        assert.ok(run.ratings.every((rating) => rating === "perfect"));
      }
    }
  }
});

// --- Practice ------------------------------------------------------------------------

/**
 * A first run's opening through the practice rule, applied the way the game
 * applies it: up to the practice's boundary on the song clock, a cup scores
 * nothing and a lost one costs nothing, and neither does a stab at the bare
 * belt. The hand takes the cups in order: each offset is a stab that far off
 * the next cup's beat, null lets that cup go, and "bonk" is a stab at the
 * bare belt a third of a second before the next cup. Returns the points,
 * the pearls lost, and how many cups the practice covered.
 */
function openRun(offsets, { on = true } = {}) {
  const practice = createPractice(on);
  const cups = planRun(TEMPOS, 6, NORMAL, 3).map((cup, index) => ({ ...cup, count: index + 1 }));
  for (const cup of cups) planPracticeCup(practice, cup.count, cup.time, NORMAL);
  let points = 0;
  let lost = 0;
  let combo = 0;
  let practiced = 0;
  let next = 0;
  for (const offset of offsets) {
    if (offset === "bonk") {
      if (practiceAt(practice, cups[next].time - 0.33)) practiceResult(practice, "bonk");
      else lost += 1;
      continue;
    }
    const cup = cups[next++];
    const free = practiceAt(practice, cup.time);
    if (free) practiced += 1;
    if (offset === null) {
      if (free) practiceResult(practice, "miss");
      else lost += 1;
      continue;
    }
    const rating = judgeStab(offset, NORMAL, cup.tier) ?? "graze";
    if (free) {
      practiceResult(practice, rating);
      continue;
    }
    combo += 1;
    points += pointsForStab(rating, isGoldenCup(cup.count), combo);
  }
  return { points, lost, practiced, practice };
}

test("the first four cups of a first run are unscored and cost no pearl", () => {
  assert.equal(PRACTICE_CUPS, 4);
  // A let-go, a bonk, a graze, a let-go, a graze: nothing lost, nothing
  // scored, and the practice is over once its four cups have gone.
  const hand = [null, "bonk", 0.14, null, 0.12, 0.12];
  const sloppy = openRun(hand);
  assert.equal(sloppy.practiced, 4);
  assert.equal(sloppy.lost, 0);
  assert.equal(sloppy.practice.over, true);
  // The fifth cup is the first that counts: a graze, one point.
  assert.equal(sloppy.points, 1);
  assert.equal(practiceLearned(sloppy.practice), false);
  // The same hand without practice loses three pearls and scores all three grazes.
  const real = openRun(hand, { on: false });
  assert.equal(real.lost, 3);
  assert.equal(real.points, 3);
});

test("two good stabs in a row end the practice early, and the rest of the belt counts", () => {
  assert.equal(PRACTICE_STREAK, 2);
  const quick = openRun([0, -0.06, 0, null]);
  assert.equal(quick.practiced, 2);
  assert.equal(quick.practice.over, true);
  assert.equal(practiceLearned(quick.practice), true);
  // The third cup was planned as a practice cup but scores; the fourth, let go, costs a pearl.
  assert.equal(quick.points, 3);
  assert.equal(quick.lost, 1);
  // A graze or a bonk between two goods breaks the streak.
  const broken = openRun([0, 0.14, 0, "bonk", 0, 0]);
  assert.equal(broken.practiced, 4);
  assert.equal(broken.lost, 0);
  assert.equal(practiceLearned(broken.practice), true);
});

test("a device that knows the stab gets no practice, and Continue ends one at once", () => {
  const none = createPractice(false);
  assert.equal(practiceOn(none), false);
  assert.equal(practiceAt(none, 0), false);
  const skipped = createPractice(true);
  assert.equal(practiceAt(skipped, 5), true);
  endPractice(skipped);
  assert.equal(practiceOn(skipped), false);
  assert.equal(practiceAt(skipped, 5), false);
  assert.equal(practiceResult(skipped, "perfect"), false);
});

test("the practice ends at one moment on the song clock, for scoring and for the bare belt alike", () => {
  // Expert at 128 bpm: cup 5 comes half a beat (234.4 ms) after cup 4.
  const practice = createPractice(true);
  const halfBeat = 30 / 128;
  const cups = [1, 2, 3, 4, 5].map((count) => ({ count, time: 4 + (count - 1) * halfBeat, resolved: count < 4 }));
  for (const cup of cups) planPracticeCup(practice, cup.count, cup.time, EXPERT);
  // The first three were grazed.
  for (let i = 0; i < 3; i++) practiceResult(practice, "graze");
  const [cup4, cup5] = cups.slice(3);
  assert.equal(practice.until, cup4.time + EXPERT.windows.graze);
  // Cup 4 goes by; cup 5 is stabbed 89 ms early, while cup 4 is still in its grace.
  const at = cup5.time - 0.089;
  assert.equal(isMissed(cup4, at, EXPERT), false);
  assert.equal(nearestCup(cups, at, EXPERT), 4);
  assert.equal(practiceAt(practice, cup5.time), false, "cup 5 scores");
  assert.equal(practiceAt(practice, at), false, "and the bare belt costs from the same moment");
  assert.equal(practiceOn(practice), true, "though the practice's last cup isn't judged yet");
  // A stab for cup 4 made in its window but handled late still finds it, as practice.
  const late = cup4.time + 0.08;
  assert.equal(nearestCup(cups, late, EXPERT), 3);
  assert.equal(practiceAt(practice, late), true);
  assert.equal(practiceAt(practice, cup4.time), true);
  // Once cup 4 is called missed, the practice is over.
  cup4.resolved = true;
  assert.equal(practiceResult(practice, "miss"), true);
  assert.equal(practiceOn(practice), false);
});

test("no cup's window crosses the practice's boundary, at any opening tempo, in either mode", () => {
  for (const opener of [124, 128, 134, 140, 150, 156, 162, 164]) {
    const tempos = [opener, 150, 156, 164];
    for (const mode of [NORMAL, EXPERT]) {
      for (let seed = 1; seed <= 200; seed++) {
        const practice = createPractice(true);
        const cups = planRun(tempos, 8, mode, seed);
        cups.forEach((cup, index) => planPracticeCup(practice, index + 1, cup.time, mode));
        // The last practice cup's window ends at the boundary; the first
        // scored cup's opens after it, so a stab can only ever take a cup on
        // its own side.
        assert.ok(cups[PRACTICE_CUPS].time - mode.windows.graze > practice.until, `${opener} bpm, seed ${seed}`);
        for (const cup of cups.slice(0, PRACTICE_CUPS)) assert.ok(practiceAt(practice, cup.time + mode.windows.graze));
        assert.equal(practiceAt(practice, cups[PRACTICE_CUPS].time - mode.windows.graze), false);
      }
    }
  }
});

test("bars and song time agree", () => {
  assert.ok(close(timeAtBar(TEMPOS, 2.5), barStart(TEMPOS, 2) + 0.5 * (240 / 124)));
  assert.equal(barAtTime(TEMPOS, timeAtBar(TEMPOS, 9.5)), 9);
});
