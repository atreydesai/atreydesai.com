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
  MAX_TICKETS,
  SHIFT_SECONDS,
  TOPPINGS,
  couldBecome,
  makeOrder,
  paceForElapsed,
  phaseForElapsed,
  pointsForServe,
  sameDrink,
  ticketFor,
  timeRemaining,
  toggleTopping,
} from "../src/lib/arcade/orders-engine.js";
import {
  GROW_AFTER,
  START_WIDTH,
  dropCup,
  phaseForHeight,
  speedForHeight,
  stepSlide,
  trackFor,
  widthAfterPerfect,
} from "../src/lib/arcade/stack-engine.js";

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

// --- Order up -----------------------------------------------------------------

test("the shift speeds up and customers get fussier", () => {
  assert.equal(phaseForElapsed(0), "opening");
  assert.equal(phaseForElapsed(30), "steady");
  assert.equal(phaseForElapsed(SHIFT_SECONDS), "rush");
  const opening = paceForElapsed(0);
  const rush = paceForElapsed(80);
  assert.ok(rush.arrivalEvery < opening.arrivalEvery);
  assert.ok(rush.patience < opening.patience);
  assert.ok(rush.maxToppings > opening.maxToppings);
  assert.ok(MAX_TICKETS >= 3);
});

test("orders stay inside the pace's topping range, without repeats", () => {
  const random = seeded(3);
  for (const elapsed of [0, 30, 80]) {
    const { minToppings, maxToppings } = paceForElapsed(elapsed);
    for (let index = 0; index < 200; index++) {
      const order = makeOrder(elapsed, random);
      assert.ok(order.toppings.length >= minToppings);
      assert.ok(order.toppings.length <= maxToppings);
      assert.equal(new Set(order.toppings).size, order.toppings.length);
      const sorted = [...order.toppings].sort(
        (a, b) => TOPPINGS.indexOf(a) - TOPPINGS.indexOf(b),
      );
      assert.deepEqual(order.toppings, sorted);
    }
  }
});

test("a drink matches only its exact order", () => {
  /** @type {import("../src/lib/arcade/orders-engine.js").Order} */
  const order = { tea: "taro", toppings: ["pearls", "foam"] };
  assert.equal(sameDrink({ tea: "taro", toppings: ["foam", "pearls"] }, order), true);
  assert.equal(sameDrink({ tea: "taro", toppings: ["pearls"] }, order), false);
  assert.equal(sameDrink({ tea: "matcha", toppings: ["pearls", "foam"] }, order), false);
  assert.equal(couldBecome({ tea: null, toppings: ["pearls"] }, order), true);
  assert.equal(couldBecome({ tea: "taro", toppings: ["jelly"] }, order), false);
});

test("a served drink goes to the most impatient matching ticket", () => {
  const cup = { tea: /** @type {const} */ ("milk"), toppings: [] };
  const tickets = [
    { order: { tea: /** @type {const} */ ("milk"), toppings: [] }, patienceLeft: 9 },
    { order: { tea: /** @type {const} */ ("taro"), toppings: [] }, patienceLeft: 1 },
    { order: { tea: /** @type {const} */ ("milk"), toppings: [] }, patienceLeft: 4 },
  ];
  assert.equal(ticketFor(cup, tickets), 2);
  assert.equal(ticketFor({ tea: "matcha", toppings: [] }, tickets), -1);
});

test("fast service earns tips and streaks add up", () => {
  const order = { tea: /** @type {const} */ ("milk"), toppings: /** @type {const} */ (["pearls"]) };
  assert.deepEqual(pointsForServe({ ...order, toppings: [...order.toppings] }, 0.9, 1), { points: 5, tip: 2 });
  assert.deepEqual(pointsForServe({ ...order, toppings: [...order.toppings] }, 0.4, 1), { points: 4, tip: 1 });
  assert.deepEqual(pointsForServe({ ...order, toppings: [...order.toppings] }, 0.1, 8), { points: 5, tip: 0 });
  assert.equal(timeRemaining(0), SHIFT_SECONDS);
  assert.equal(timeRemaining(SHIFT_SECONDS + 5), 0);
});

test("toppings toggle in and out in shelf order", () => {
  let cup = toggleTopping({ tea: null, toppings: [] }, "foam");
  cup = toggleTopping(cup, "pearls");
  assert.deepEqual(cup.toppings, ["pearls", "foam"]);
  cup = toggleTopping(cup, "foam");
  assert.deepEqual(cup.toppings, ["pearls"]);
});

// --- Cup stack ------------------------------------------------------------------

test("a close drop is perfect and keeps the full width", () => {
  const top = { left: -7, width: START_WIDTH };
  const result = dropCup(top, -6.4);
  assert.equal(result.kind, "perfect");
  assert.deepEqual(result.placed, top);
  assert.equal(result.cut, null);
});

test("an offset drop slices off exactly the overhang", () => {
  const top = { left: -7, width: 14 };
  const right = dropCup(top, -3.2);
  assert.equal(right.kind, "cut");
  assert.deepEqual(right.placed, { left: -3, width: 10 });
  assert.deepEqual(right.cut, { left: 7, width: 4 });

  const left = dropCup(top, -9.6);
  assert.deepEqual(left.placed, { left: -7, width: 11 });
  assert.deepEqual(left.cut, { left: -10, width: 3 });
});

test("a drop with no overlap misses", () => {
  const result = dropCup({ left: 0, width: 4 }, 6);
  assert.equal(result.kind, "miss");
  assert.equal(result.placed, null);
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
  assert.equal(speedForHeight(500), 44);
  assert.equal(phaseForHeight(0), "opening");
  assert.equal(phaseForHeight(20), "steady");
  assert.equal(phaseForHeight(40), "rush");
});
