import assert from "node:assert/strict";
import test from "node:test";

import {
  BARS_PER_SONG,
  INTRO_BARS,
  MAX_TIER,
  WINDOWS,
  barAtTime,
  barPosition,
  barSeconds,
  barStart,
  cupBeats,
  isGoldenCup,
  isLate,
  judgeStab,
  nearestCup,
  pointsForStab,
  tierForBar,
} from "../src/lib/arcade/stab-engine.js";
import {
  GROW_AFTER,
  START_WIDTH,
  TRAY_MARGIN,
  dropCup,
  phaseForHeight,
  sliderWidth,
  speedForHeight,
  stepSlide,
  trackFor,
  traySpan,
  widthAfterPerfect,
} from "../src/lib/arcade/stack-engine.js";
import { COUNTDOWN_SECONDS, stepCountdown } from "../src/lib/arcade/countdown.js";

/** A repeatable stand-in for Math.random. */
function seeded(seed = 7) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// --- Straw stab -------------------------------------------------------------

const TEMPOS = [128, 144, 152, 162];

test("stab bars follow the playlist's tempos and loop", () => {
  assert.equal(barStart(TEMPOS, 0), 0);
  assert.equal(barStart(TEMPOS, 1), barSeconds(128));
  const firstSong = BARS_PER_SONG * barSeconds(128);
  assert.ok(Math.abs(barStart(TEMPOS, BARS_PER_SONG) - firstSong) < 1e-9);
  const loop = TEMPOS.reduce((total, bpm) => total + BARS_PER_SONG * barSeconds(bpm), 0);
  assert.ok(Math.abs(barStart(TEMPOS, TEMPOS.length * BARS_PER_SONG) - loop) < 1e-9);
  assert.deepEqual(barPosition(TEMPOS, 9), { loop: 0, song: 1, barInSong: 1, bpm: 144 });
  assert.deepEqual(barPosition(TEMPOS, 33), { loop: 1, song: 0, barInSong: 1, bpm: 128 });
});

test("barAtTime inverts barStart", () => {
  assert.equal(barAtTime(TEMPOS, -1), 0);
  for (let bar = 0; bar < 80; bar++) {
    assert.equal(barAtTime(TEMPOS, barStart(TEMPOS, bar) + 0.001), bar);
  }
});

test("the intro is empty and every cup lands inside its bar", () => {
  const random = seeded();
  for (let bar = 0; bar < INTRO_BARS; bar++) {
    assert.deepEqual(cupBeats(TEMPOS, bar, random), []);
  }
  for (let bar = INTRO_BARS; bar < 200; bar++) {
    const beats = cupBeats(TEMPOS, bar, random);
    assert.ok(beats.length > 0);
    assert.ok(beats.every((beat) => beat >= 0 && beat < 4));
    assert.deepEqual([...beats].sort((a, b) => a - b), beats);
  }
});

test("difficulty climbs by song and by loop, and is capped", () => {
  assert.equal(tierForBar(TEMPOS, 2), 0);
  assert.equal(tierForBar(TEMPOS, 2 * BARS_PER_SONG), 1);
  assert.equal(tierForBar(TEMPOS, 4 * BARS_PER_SONG), 2);
  assert.equal(tierForBar(TEMPOS, 40 * BARS_PER_SONG), MAX_TIER);
});

test("stabs are judged by their distance from the beat", () => {
  assert.equal(judgeStab(0), "perfect");
  assert.equal(judgeStab(-WINDOWS.perfect), "perfect");
  assert.equal(judgeStab(0.08), "good");
  assert.equal(judgeStab(-0.14), "graze");
  assert.equal(judgeStab(0.2), null);
  assert.equal(pointsForStab("perfect", false, 1), 3);
  assert.equal(pointsForStab("graze", false, 1), 1);
  assert.equal(pointsForStab("perfect", true, 1), 6);
  assert.equal(pointsForStab("good", false, 25), 4);
  assert.equal(pointsForStab("good", false, 400), 6);
});

test("a stab goes to the closest waiting cup, and late cups are missed", () => {
  const cups = [
    { time: 1, resolved: true },
    { time: 1.5, resolved: false },
    { time: 1.75, resolved: false },
  ];
  assert.equal(nearestCup(cups, 1.02), -1);
  assert.equal(nearestCup(cups, 1.6), 1);
  assert.equal(nearestCup(cups, 1.7), 2);
  assert.equal(isLate(cups[1], 1.6), false);
  assert.equal(isLate(cups[1], 1.5 + WINDOWS.graze + 0.01), true);
  assert.equal(isGoldenCup(11), false);
  assert.equal(isGoldenCup(12), true);
});

// --- Cup stack ------------------------------------------------------------------

test("a close drop is perfect and keeps the full width", () => {
  const top = { left: -7, width: START_WIDTH };
  for (const left of [-6.4, -5.6, -8.5]) {
    const result = dropCup(top, left);
    assert.equal(result.kind, "perfect", `left ${left}`);
    assert.deepEqual(result.placed, top);
    assert.equal(result.cut, null);
  }
  assert.equal(dropCup(top, -5.4).kind, "cut");
});

test("the tray is judged exactly as wide as it is drawn", () => {
  const tray = traySpan();
  assert.deepEqual(tray, { left: -START_WIDTH / 2 - TRAY_MARGIN, width: START_WIDTH + TRAY_MARGIN * 2 });
  assert.equal(sliderWidth(tray), START_WIDTH);
});

test("a cup anywhere on the wider tray lands whole, with nothing cut", () => {
  const tray = traySpan();
  for (let left = tray.left; left + START_WIDTH <= tray.left + tray.width; left += 0.25) {
    const result = dropCup(tray, left, START_WIDTH);
    const snapped = Math.round(left);
    if (snapped < tray.left || snapped + START_WIDTH > tray.left + tray.width) continue;
    assert.notEqual(result.kind, "cut", `left ${left}`);
    assert.equal(result.cut, null);
    assert.equal(result.placed?.width, START_WIDTH);
  }
  // Flush against either edge of the tray.
  assert.deepEqual(dropCup(tray, tray.left, START_WIDTH), {
    kind: "clean",
    placed: { left: tray.left, width: START_WIDTH },
    cut: null,
  });
  const right = tray.left + tray.width - START_WIDTH;
  assert.deepEqual(dropCup(tray, right, START_WIDTH).placed, { left: right, width: START_WIDTH });
});

test("on the tray, perfect means centred", () => {
  const tray = traySpan();
  const centre = -START_WIDTH / 2;
  for (const left of [centre, centre + 1.4, centre - 1.5]) {
    const result = dropCup(tray, left, START_WIDTH);
    assert.equal(result.kind, "perfect", `left ${left}`);
    assert.deepEqual(result.placed, { left: centre, width: START_WIDTH });
  }
  const off = dropCup(tray, centre + 2, START_WIDTH);
  assert.equal(off.kind, "clean");
  assert.deepEqual(off.placed, { left: centre + 2, width: START_WIDTH });
});

test("the sliding cup is never wider than a fresh cup", () => {
  assert.equal(sliderWidth(traySpan()), START_WIDTH);
  assert.equal(sliderWidth({ left: -3, width: 9 }), 9);
  assert.equal(sliderWidth({ left: -20, width: 40 }), START_WIDTH);
  // The track keeps the slider's own width on screen, even above the tray.
  const track = trackFor(traySpan(), 12);
  assert.ok(track.max + START_WIDTH <= 12 - 1);
  assert.ok(track.min >= -12 + 1);
});

test("an overhang past the tray is still cut on the right side", () => {
  const tray = traySpan();
  const right = dropCup(tray, tray.left + tray.width - START_WIDTH + 3, START_WIDTH);
  assert.equal(right.kind, "cut");
  assert.deepEqual(right.cut, { left: tray.left + tray.width, width: 3 });
  assert.deepEqual(right.placed, { left: tray.left + tray.width - START_WIDTH + 3, width: START_WIDTH - 3 });

  const left = dropCup(tray, tray.left - 2, START_WIDTH);
  assert.deepEqual(left.cut, { left: tray.left - 2, width: 2 });
  assert.deepEqual(left.placed, { left: tray.left, width: START_WIDTH - 2 });
});

test("an offset drop snaps toward the tower and never cuts more than was seen", () => {
  const top = { left: -7, width: 14 };
  // 3.8 units hang over on the right: the drop snaps in and loses 3.
  const right = dropCup(top, -3.2);
  assert.equal(right.kind, "cut");
  assert.deepEqual(right.placed, { left: -4, width: 11 });
  assert.deepEqual(right.cut, { left: 7, width: 3 });

  // 2.6 units hang over on the left: it loses 2.
  const left = dropCup(top, -9.6);
  assert.deepEqual(left.placed, { left: -7, width: 12 });
  assert.deepEqual(left.cut, { left: -9, width: 2 });

  for (let position = -20; position <= 6; position += 0.13) {
    const result = dropCup(top, position);
    if (result.kind !== "cut" || !result.cut) continue;
    const seen = Math.max(top.left - position, position + 14 - (top.left + top.width));
    assert.ok(result.cut.width <= seen + 1e-9, `cut ${result.cut.width} of ${seen} at ${position}`);
  }
});

test("a drop with no overlap misses", () => {
  const result = dropCup({ left: 0, width: 4 }, 6);
  assert.equal(result.kind, "miss");
  assert.equal(result.placed, null);
  assert.deepEqual(result.cut, { left: 6, width: 4 });
  assert.equal(dropCup({ left: 0, width: 4 }, -4.2).kind, "miss");
  const tray = traySpan();
  assert.equal(dropCup(tray, tray.left + tray.width, START_WIDTH).kind, "miss");
});

test("perfect streaks grow the cup back, never past the start", () => {
  assert.equal(widthAfterPerfect(9, GROW_AFTER - 1), 9);
  assert.equal(widthAfterPerfect(9, GROW_AFTER), 10);
  assert.equal(widthAfterPerfect(START_WIDTH, 12), START_WIDTH);
});

test("the slide ping-pongs inside its track and stays on screen", () => {
  const track = trackFor({ left: -7, width: 14 }, 40);
  assert.deepEqual(track, { min: -23, max: 9 });
  assert.deepEqual(stepSlide(8, 1, 3, track), { position: 7, direction: -1 });
  assert.deepEqual(stepSlide(-22, -1, 3, track), { position: -21, direction: 1 });
  const huge = stepSlide(0, 1, 500, track);
  assert.ok(huge.position >= track.min && huge.position <= track.max);

  // On a narrow screen the whole cup stays a unit inside either edge.
  const narrow = trackFor({ left: -7, width: 14 }, 12);
  assert.ok(narrow.min >= -12 + 1);
  assert.ok(narrow.max + 14 <= 12 - 1);
});

test("the stack speeds up and its music builds", () => {
  assert.ok(speedForHeight(10) > speedForHeight(0));
  assert.equal(speedForHeight(0), 15);
  assert.equal(speedForHeight(20), 28);
  assert.equal(speedForHeight(500), 40);
  assert.equal(phaseForHeight(0), "opening");
  assert.equal(phaseForHeight(20), "steady");
  assert.equal(phaseForHeight(40), "rush");
});

// --- Countdown --------------------------------------------------------------

/** Runs the countdown at a fixed frame length; returns the numbers it beeps. */
function runCountdown(dt) {
  let state = { elapsed: 0, count: COUNTDOWN_SECONDS, done: false };
  const beeps = [];
  let frames = 0;
  while (!state.done) {
    state = stepCountdown(state.elapsed, state.count, dt);
    if (state.beep) beeps.push(state.count);
    frames += 1;
  }
  return { beeps, frames, elapsed: state.elapsed };
}

test("the countdown beeps each number once, then finishes", () => {
  const smooth = runCountdown(1 / 60);
  assert.deepEqual(smooth.beeps, [2, 1]);
  assert.ok(smooth.elapsed >= COUNTDOWN_SECONDS);
  assert.ok(smooth.elapsed < COUNTDOWN_SECONDS + 1 / 60);

  // A long stall skips straight to the right number rather than replaying.
  assert.deepEqual(runCountdown(0.25 * 9).beeps, [1]);
  // A frame that crosses the end begins the run with no last beep.
  const last = stepCountdown(2.9, 1, 0.2);
  assert.equal(last.done, true);
  assert.equal(last.beep, false);
  assert.equal(last.count, 1);
});
