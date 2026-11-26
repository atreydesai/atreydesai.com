import assert from "node:assert/strict";
import test from "node:test";

import { HUD_DWELL, LEAVE_GRACE, STILL_FOR, STILL_PX, createPointerGuard } from "../src/lib/arcade/catch-pointer.js";

const FRAME = 1 / 60;
// The tickets along the top of a 1280 × 800 page, the pause button at the end.
const HUD_BOTTOM = 70;
const PAUSE = { x: 1200, y: 34 };
const overTickets = (y) => y < HUD_BOTTOM;

/** Feeds `guard` a pointer path: `points` are [t, x, y], one move each. */
function walk(guard, points) {
  for (const [t, x, y] of points) guard.move(t, x, y, overTickets(y));
}

/** A hand sweeping the basket to and fro along the page, drifting up `rise` px a second, from `from` seconds for `seconds`. */
function sweep(guard, { from = 0, seconds = 2, rise = 0, y0 = 600 } = {}) {
  let t = from;
  for (; t < from + seconds; t += FRAME) {
    const x = 640 + 560 * Math.sin((t - from) * 5);
    guard.move(t, x, Math.max(2, y0 - rise * (t - from)), overTickets(Math.max(2, y0 - rise * (t - from))));
  }
  return t;
}

test("a sweep that drifts up into the tickets can't end in a press on pause", () => {
  const guard = createPointerGuard();
  // The hidden pointer drifts up as the basket is swept, into the tickets…
  const end = sweep(guard, { seconds: 3, rise: 260 });
  // …and a click comes as the sweep goes on: it is not taken.
  assert.equal(guard.pressCounts(end), false);
  // Nor at the end of a sweep, the moment it turns, a beat after coming onto the tickets.
  const turn = createPointerGuard();
  walk(turn, [
    [0, 1100, 200],
    [0.05, 1150, 120],
    [0.1, 1190, 60],
    [0.15, 1200, 40],
  ]);
  assert.equal(turn.pressCounts(0.2), false, "pressed 0.05 s after the pointer stopped");
});

test("a pointer brought to rest on pause takes the press, and a second try always does", () => {
  const guard = createPointerGuard();
  // Up from the basket to the button, a deliberate reach, then still on it.
  const path = [];
  for (let i = 0; i <= 20; i++) path.push([i * FRAME, 640 + (PAUSE.x - 640) * (i / 20), 700 + (PAUSE.y - 700) * (i / 20)]);
  walk(guard, path);
  const arrived = 20 * FRAME;
  // Too soon after reaching the tickets: the click is dropped…
  assert.equal(guard.pressCounts(arrived + 0.05), false);
  // …and the next, with the pointer still on the button, is taken.
  assert.equal(guard.pressCounts(arrived + HUD_DWELL + 0.01), true);
  // A small wobble on the button is still at rest.
  walk(guard, [[arrived + 0.4, PAUSE.x + STILL_PX - 1, PAUSE.y]]);
  assert.equal(guard.pressCounts(arrived + 0.42), true);
  // A bigger one is not, until it settles again.
  walk(guard, [[arrived + 0.5, PAUSE.x - 40, PAUSE.y]]);
  assert.equal(guard.pressCounts(arrived + 0.52), false);
  assert.equal(guard.pressCounts(arrived + 0.5 + STILL_FOR + 0.01), true);
});

test("a pointer that never moved, or that the tickets came up under, has been resting", () => {
  assert.equal(createPointerGuard().pressCounts(0), true);
  const guard = createPointerGuard();
  walk(guard, [[0, 1200, 120]]);
  // The tickets are under it now, though it last moved off them.
  assert.equal(guard.pressCounts(HUD_DWELL + 0.01), true);
  assert.equal(guard.pressCounts(HUD_DWELL - 0.01), false);
});

test("off the page, play holds a beat, then the shift pauses; back in time, play goes on", () => {
  const guard = createPointerGuard();
  assert.equal(guard.status(0), "in");
  guard.leave(1);
  assert.equal(guard.status(1), "held");
  assert.equal(guard.status(1 + LEAVE_GRACE - 0.01), "held");
  // Back on the page within the beat: nothing paused.
  guard.move(1 + LEAVE_GRACE - 0.02, 640, 2, true);
  assert.equal(guard.status(2), "in");
  // Gone for longer: it pauses (and stays gone however long it is away).
  guard.leave(3);
  guard.leave(3.2);
  assert.equal(guard.status(3 + LEAVE_GRACE), "gone");
  assert.equal(guard.status(30), "gone");
  // Resuming forgets it.
  guard.enter();
  assert.equal(guard.status(31), "in");
});

test("leaving the page forgets the time over the tickets: back within the grace, a click at once is not taken", () => {
  // Rested on pause long enough, then off the top of the page and straight back.
  const guard = createPointerGuard();
  walk(guard, [
    [0, PAUSE.x, PAUSE.y],
    [0.5, PAUSE.x + 1, PAUSE.y],
  ]);
  assert.equal(guard.pressCounts(1), true);
  guard.leave(1);
  // While it is away, nothing it presses counts.
  assert.equal(guard.pressCounts(1.1), false);
  walk(guard, [[1 + LEAVE_GRACE - 0.1, PAUSE.x, PAUSE.y]]);
  assert.equal(guard.status(1 + LEAVE_GRACE - 0.09), "in", "back in time: play went on");
  assert.equal(guard.pressCounts(1 + LEAVE_GRACE - 0.09), false, "a click just after coming back counted");
  // Its dwell starts again from its return.
  assert.equal(guard.pressCounts(1 + LEAVE_GRACE - 0.1 + HUD_DWELL + 0.01), true);

  // Back on the page with no move yet (only the page's enter): still from the return.
  const entered = createPointerGuard();
  walk(entered, [[0, PAUSE.x, PAUSE.y]]);
  entered.leave(1);
  entered.enter(1.2);
  assert.equal(entered.pressCounts(1.21), false);
  assert.equal(entered.pressCounts(1.2 + HUD_DWELL + 0.01), true);

  // A pointer that left while play wasn't on (paused) forgets its dwell too, but holds nothing.
  const paused = createPointerGuard();
  walk(paused, [[0, PAUSE.x, PAUSE.y]]);
  paused.leave(1, false);
  assert.equal(paused.status(5), "in");
  walk(paused, [[5, PAUSE.x, PAUSE.y]]);
  assert.equal(paused.pressCounts(5.05), false);
  // Resuming (no time given) doesn't count as coming back.
  const resumed = createPointerGuard();
  walk(resumed, [[0, PAUSE.x, PAUSE.y]]);
  resumed.leave(1);
  resumed.enter();
  assert.equal(resumed.status(3), "in");
  assert.equal(resumed.pressCounts(3), false, "a pointer still off the page pressed");
});
