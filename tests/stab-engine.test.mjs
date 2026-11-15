import assert from "node:assert/strict";
import test from "node:test";

import {
  BARS_PER_SONG,
  CLOCK_SNAP,
  DEMO_CAPTIONS,
  DEMO_END_BAR,
  DEMO_SEED,
  DEMO_SLIPS,
  EXPERT,
  EXPERT_MAX_TIER,
  INPUT_GRACE,
  INTRO_BARS,
  MARK,
  MAX_TIER,
  NORMAL,
  WINDOWS,
  barAtTime,
  barStart,
  beltX,
  createAutopilot,
  cupBeats,
  demoCaption,
  inputSeconds,
  isLate,
  isMissed,
  judgeStab,
  markBar,
  nearestCup,
  presentSeconds,
  seededRandom,
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
    const random = seededRandom(11);
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

// --- The demo ------------------------------------------------------------------

test("the demo's autopilot slips once each, as its captions say", () => {
  const aim = createAutopilot();
  const random = seededRandom(DEMO_SEED);
  const taken = [];
  for (let bar = 0; bar < DEMO_END_BAR; bar++) {
    for (const beat of cupBeats(TEMPOS, bar, random)) {
      taken.push({ bar, beat, offset: aim(bar) });
    }
  }
  const slips = taken.filter((cup) => cup.offset !== 0);
  assert.equal(slips.length, DEMO_SLIPS.length);
  assert.equal(judgeStab(slips[0].offset), "good");
  assert.equal(judgeStab(slips[1].offset), "graze");
  assert.equal(slips[2].offset, null);
  // Each slip lands while the caption that explains it is showing.
  assert.equal(demoCaption(slips[0].bar + slips[0].beat / 4), DEMO_CAPTIONS[2].text);
  assert.equal(demoCaption(slips[1].bar + slips[1].beat / 4), DEMO_CAPTIONS[2].text);
  assert.equal(demoCaption(slips[2].bar + slips[2].beat / 4), DEMO_CAPTIONS[3].text);
  for (const line of DEMO_CAPTIONS) {
    assert.ok(!/[!·]/.test(line.text));
  }
});

test("the demo runs about twenty seconds on any playlist", () => {
  for (const tempos of [
    [124, 138, 150, 164],
    [134, 152, 156, 162],
  ]) {
    const seconds = barStart(tempos, DEMO_END_BAR);
    assert.ok(seconds >= 15 && seconds <= 30, `${seconds} s`);
  }
  assert.ok(close(timeAtBar(TEMPOS, 2.5), barStart(TEMPOS, 2) + 0.5 * (240 / 124)));
  assert.equal(barAtTime(TEMPOS, timeAtBar(TEMPOS, 9.5)), 9);
});

test("the seeded generator repeats itself", () => {
  const a = seededRandom(DEMO_SEED);
  const b = seededRandom(DEMO_SEED);
  for (let i = 0; i < 20; i++) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});
