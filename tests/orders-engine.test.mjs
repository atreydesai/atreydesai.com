import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_PATIENCE_RATE,
  BREW_SECONDS,
  CRITIC,
  CRITIC_AT,
  CUP_CENTER,
  CUP_MOUTH,
  EMPTY_LINE_WAIT,
  FILL_LINE,
  ICE,
  ICE_MAX,
  ICE_CUBES,
  LIVES,
  MAX_TICKETS,
  POUR_MAX,
  REGULARS,
  SAMPLES_PER_SHIFT,
  SAMPLE_BOOST,
  SAMPLE_WORTH,
  SEAL_BAND,
  SEAL_PERIOD,
  SHAKES_NEEDED,
  SHIFT_SECONDS,
  SPECIAL_BONUS,
  SUGARS,
  SUGAR_MAX,
  SUGAR_STEP,
  TANK_CAPACITY,
  TANK_LOW,
  TEAS,
  TOPPINGS,
  CROSS_AT,
  FAST_SERVE,
  GLANCE_AT,
  JAR_BONUS,
  JAR_SIZE,
  RULES,
  SHARE_FACES,
  activePatienceRate,
  cheer,
  comboFor,
  comboProgress,
  criticDue,
  CRITIC_AFTER,
  PACE_KEYS,
  PLAIN_ORDERS,
  RUSH_AT,
  tapFor,
  drawFromTank,
  fillJar,
  gradeDrink,
  gradeWord,
  iceGrade,
  iceState,
  jarPayout,
  judgeScoop,
  keepsStreak,
  ladleAt,
  makeOrder,
  maxTickets,
  mostImpatient,
  nextArrivalIn,
  paceForElapsed,
  patienceFor,
  phaseForElapsed,
  pickRegular,
  pickSpecial,
  pointsForDrink,
  pourGrade,
  pourRate,
  sampleBoost,
  sampleTarget,
  samplesFor,
  scoopGrade,
  scoopQueue,
  scoopResult,
  sealGrade,
  sealNeedle,
  sealResult,
  servedMood,
  shakeGrade,
  stationsFor,
  stepPour,
  sugarGrade,
  sugarPumps,
  sugarState,
  tankState,
  timeRemaining,
  totalScoops,
  waitingMood,
} from "../src/lib/arcade/orders-engine.js";

const SEEDS = [1, 3, 7, 42, 1234, 99999];

/** A repeatable stand-in for Math.random. */
function seeded(seed = 7) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** A random() that plays back fixed values, then repeats the last. */
function scripted(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

const byName = (name) => REGULARS.find((regular) => regular.name === name);
const plain = byName("pip");
const near = (a, b) => Math.abs(a - b) < 1e-9;

// --- The shift --------------------------------------------------------------

test("the shift moves from opening to steady to rush", () => {
  assert.equal(phaseForElapsed(0), "opening");
  assert.equal(phaseForElapsed(29.9), "opening");
  assert.equal(phaseForElapsed(30), "steady");
  assert.equal(phaseForElapsed(79.9), "steady");
  assert.equal(phaseForElapsed(80), "rush");
  assert.equal(phaseForElapsed(SHIFT_SECONDS), "rush");
  assert.equal(timeRemaining(0), SHIFT_SECONDS);
  assert.equal(timeRemaining(10.2), 110);
  assert.equal(timeRemaining(SHIFT_SECONDS + 5), 0);
  assert.equal(SHIFT_SECONDS, 120);
  assert.equal(LIVES, 3);
  assert.equal(MAX_TICKETS, 3);
  assert.equal(SHAKES_NEEDED, 8);
  assert.ok(ACTIVE_PATIENCE_RATE > 0 && ACTIVE_PATIENCE_RATE < 1);
});

test("each phase has its pace, and the pace climbs", () => {
  // Each phase's pace holds in full at its key, the middle of its stretch.
  assert.deepEqual(PACE_KEYS, [15, 55, 100]);
  assert.deepEqual(paceForElapsed(PACE_KEYS[0]), {
    phase: "opening", arrivalEvery: 10, patience: 34, minScoops: 0, maxScoops: 1, swing: 2.4,
  });
  const steady = paceForElapsed(PACE_KEYS[1]);
  assert.equal(steady.phase, "steady");
  assert.equal(steady.arrivalEvery, 8);
  assert.equal(steady.patience, 30);
  assert.ok(near(steady.swing, 3.0));
  assert.deepEqual([steady.minScoops, steady.maxScoops], [1, 2]);
  assert.deepEqual(paceForElapsed(PACE_KEYS[2]), {
    phase: "rush", arrivalEvery: 6.5, patience: 26, minScoops: 2, maxScoops: 3, swing: 3.6,
  });
  // The shift opens and ends where it always did.
  for (const expert of [false, true]) {
    assert.deepEqual(paceForElapsed(0, expert), paceForElapsed(PACE_KEYS[0], expert));
    assert.deepEqual(paceForElapsed(SHIFT_SECONDS, expert), paceForElapsed(PACE_KEYS[2], expert));
  }
  const paces = PACE_KEYS.map((at) => paceForElapsed(at));
  for (let i = 1; i < paces.length; i++) {
    assert.ok(paces[i].arrivalEvery < paces[i - 1].arrivalEvery, "arrivals quicken");
    assert.ok(paces[i].patience < paces[i - 1].patience, "patience shortens");
    assert.ok(paces[i].swing > paces[i - 1].swing, "the ladle speeds up");
    assert.ok(paces[i].maxScoops > paces[i - 1].maxScoops);
  }
});

test("the pace climbs smoothly, never jumping, and never eases off", () => {
  for (const expert of [false, true]) {
    let last = paceForElapsed(0, expert);
    for (let t = 0.1; t <= SHIFT_SECONDS + 1e-9; t += 0.1) {
      const now = paceForElapsed(t, expert);
      // A tenth of a second never moves arrivals or patience by more than a few hundredths of a second.
      assert.ok(Math.abs(now.arrivalEvery - last.arrivalEvery) < 0.01, `arrivals jump at ${t.toFixed(1)}`);
      assert.ok(Math.abs(now.patience - last.patience) < 0.02, `patience jumps at ${t.toFixed(1)}`);
      assert.ok(Math.abs(now.swing - last.swing) < 0.01, `the swing jumps at ${t.toFixed(1)}`);
      assert.ok(now.arrivalEvery <= last.arrivalEvery + 1e-9 && now.patience <= last.patience + 1e-9 && now.swing >= last.swing - 1e-9);
      last = now;
    }
  }
  // Over the shift it asks about what the stepped phases did: the average
  // arrival gap and patience stay within half a second of them.
  const stepped = (t) => (t < 30 ? [10, 34] : t < 80 ? [8, 30] : [6.5, 26]);
  let gap = 0;
  let wait = 0;
  for (let t = 0; t < SHIFT_SECONDS; t += 0.1) {
    const now = paceForElapsed(t);
    gap += (now.arrivalEvery - stepped(t)[0]) * 0.1;
    wait += (now.patience - stepped(t)[1]) * 0.1;
  }
  assert.ok(Math.abs(gap / SHIFT_SECONDS) < 0.5, `arrival gap off by ${(gap / SHIFT_SECONDS).toFixed(2)} s on average`);
  assert.ok(Math.abs(wait / SHIFT_SECONDS) < 0.5, `patience off by ${(wait / SHIFT_SECONDS).toFixed(2)} s on average`);
});

test("guests arrive on the pace, and an empty counter refills quickly", () => {
  const pace = paceForElapsed(0);
  assert.equal(EMPTY_LINE_WAIT, 0.8);
  // Someone waiting: the full interval since the last arrival.
  assert.equal(nextArrivalIn(pace, 1, 0), pace.arrivalEvery);
  assert.ok(near(nextArrivalIn(pace, 2, 3.5), pace.arrivalEvery - 3.5));
  // Nobody waiting: never more than the short wait…
  assert.equal(nextArrivalIn(pace, 0, 0), EMPTY_LINE_WAIT);
  assert.equal(nextArrivalIn(paceForElapsed(80), 0, 1), EMPTY_LINE_WAIT);
  // …but no later than the pace would have sent someone anyway.
  assert.ok(near(nextArrivalIn(pace, 0, pace.arrivalEvery - 0.3), 0.3));
  // Overdue (a full line holding someone at the door) is due now, not negative.
  assert.equal(nextArrivalIn(pace, 3, pace.arrivalEvery + 2), 0);
  assert.equal(nextArrivalIn(pace, 0, pace.arrivalEvery + 2), 0);
});

// --- The cast -------------------------------------------------------------------

test("the cast is 40 unique, lowercase regulars with valid quirks and orders", () => {
  assert.equal(REGULARS.length, 40);
  assert.equal(new Set(REGULARS.map((regular) => regular.name)).size, 40);
  assert.equal(REGULARS[0].name, "mochi");
  assert.equal(REGULARS[39].name, "chai");
  for (const regular of REGULARS) {
    assert.equal(regular.name, regular.name.toLowerCase());
    assert.equal(regular.tag, regular.tag.toLowerCase());
    assert.ok(regular.tag.length > 0);
    if (regular.quirk !== undefined) {
      assert.ok(["hurry", "patient", "tipper"].includes(regular.quirk), regular.name);
    }
    const order = regular.order;
    if (!order) continue;
    if (order.tea !== undefined) assert.ok(TEAS.includes(order.tea), regular.name);
    if (order.ice !== undefined) assert.ok(ICE.includes(order.ice), regular.name);
    if (order.sugar !== undefined) assert.ok(SUGARS.includes(order.sugar), regular.name);
    if (order.toppings !== undefined) {
      for (const line of order.toppings) {
        assert.ok(TOPPINGS.includes(line.kind), regular.name);
        assert.ok(Number.isInteger(line.scoops) && line.scoops >= 1, regular.name);
      }
    }
  }
  assert.equal(byName("tofu").quirk, "hurry");
  assert.equal(byName("mochi").quirk, "patient");
  assert.equal(byName("clementine").quirk, "tipper");
  assert.equal(byName("pip").quirk, undefined);
  assert.deepEqual(byName("basil").order, { tea: "matcha", sugar: 0, toppings: [] });
  assert.deepEqual(byName("biscuit").order, { toppings: [{ kind: "pearls", scoops: 2 }] });
});

test("pickRegular skips anyone excluded, and falls back when everyone is", () => {
  for (const seed of SEEDS) {
    const random = seeded(seed);
    const exclude = REGULARS.slice(0, 38).map((regular) => regular.name);
    for (let i = 0; i < 50; i++) {
      const regular = pickRegular(exclude, random);
      assert.ok(!exclude.includes(regular.name));
      assert.ok(["oats", "chai"].includes(regular.name));
    }
  }
  assert.equal(pickRegular([], scripted(0)).name, "mochi");
  assert.equal(pickRegular([], scripted(0.999)).name, "chai");
  assert.equal(pickRegular(["mochi"], scripted(0)).name, "tofu");
  const everyone = REGULARS.map((regular) => regular.name);
  assert.ok(REGULARS.includes(pickRegular(everyone, seeded(3))));
  assert.equal(pickRegular(everyone, scripted(0)).name, "mochi");
});

// --- Orders -----------------------------------------------------------------------

test("orders stay inside the phase's scoop range, sorted, without repeated kinds", () => {
  for (const seed of SEEDS) {
    const random = seeded(seed);
    for (const elapsed of [0, 30, 80]) {
      const { minScoops, maxScoops } = paceForElapsed(elapsed);
      const seen = new Set();
      for (let i = 0; i < 300; i++) {
        const order = makeOrder(elapsed, null, random);
        assert.ok(TEAS.includes(order.tea));
        assert.ok(ICE.includes(order.ice));
        const scoops = totalScoops(order);
        seen.add(scoops);
        assert.ok(scoops >= minScoops && scoops <= maxScoops);
        assert.ok(order.toppings.length <= 2);
        const kinds = order.toppings.map((line) => line.kind);
        assert.equal(new Set(kinds).size, kinds.length);
        assert.deepEqual(
          [...kinds].sort((a, b) => TOPPINGS.indexOf(a) - TOPPINGS.indexOf(b)),
          kinds,
        );
        assert.ok(order.toppings.every((line) => line.scoops >= 1));
        if (order.toppings.length === 2) {
          assert.deepEqual(
            order.toppings.map((line) => line.scoops).sort((a, b) => a - b),
            [1, scoops - 1],
          );
        }
      }
      // Over 300 draws every total in the range turns up.
      assert.equal(seen.size, maxScoops - minScoops + 1);
    }
  }
});

test("a split order gives the first kind S - 1 scoops and the second 1", () => {
  // tea milk, ice none, S = 3 (rush), first kind jelly, split, second from the
  // rest (pearls, pudding, redbean) at index 0, so pearls.
  // tea, ice, sugar (0.5 of five levels: 50%), then the toppings.
  const order = makeOrder(80, null, scripted(0, 0, 0.5, 0.9, 0.5, 0.1, 0));
  assert.equal(order.tea, "milk");
  assert.equal(order.ice, "none");
  assert.equal(order.sugar, 50);
  assert.deepEqual(order.toppings, [
    { kind: "pearls", scoops: 1 },
    { kind: "jelly", scoops: 2 },
  ]);
  // Same draws, but no split: one kind with all three scoops.
  const single = makeOrder(80, null, scripted(0, 0, 0.5, 0.9, 0.5, 0.9));
  assert.deepEqual(single.toppings, [{ kind: "jelly", scoops: 3 }]);
  // The opening can hand out a plain drink.
  assert.deepEqual(makeOrder(0, null, scripted(0.99, 0.99, 0)).toppings, []);
});

test("a regular's usual order overrides what it names", () => {
  for (const seed of SEEDS) {
    const random = seeded(seed);
    for (const elapsed of [0, 30, 80]) {
      for (let i = 0; i < 40; i++) {
        assert.equal(makeOrder(elapsed, byName("dumpling"), random).tea, "taro");
        assert.equal(makeOrder(elapsed, byName("juniper"), random).ice, "none");
        assert.equal(makeOrder(elapsed, byName("miso"), random).ice, "extra");

        const biscuit = makeOrder(elapsed, byName("biscuit"), random);
        assert.deepEqual(biscuit.toppings, [{ kind: "pearls", scoops: 2 }]);

        const basil = makeOrder(elapsed, byName("basil"), random);
        assert.equal(basil.tea, "matcha");
        assert.deepEqual(basil.toppings, []);

        const kiwi = makeOrder(elapsed, byName("kiwi"), random);
        assert.equal(kiwi.tea, "milk");
        assert.deepEqual(kiwi.toppings, [{ kind: "pudding", scoops: 1 }]);
      }
    }
  }
  // A copy, so changing the order never edits the cast.
  const order = makeOrder(0, byName("biscuit"), seeded(1));
  order.toppings[0].scoops = 9;
  assert.equal(byName("biscuit").order.toppings[0].scoops, 2);
});

test("patience grows with scoops and bends to quirks", () => {
  const order = { tea: "milk", sugar: 50, ice: "less", toppings: [{ kind: "pearls", scoops: 2 }] };
  assert.equal(patienceFor(order, plain, 0), 40);
  // The pace holds each phase's patience at its key (the middle of the phase).
  assert.equal(patienceFor(order, null, PACE_KEYS[2]), 32);
  assert.ok(near(patienceFor(order, byName("tofu"), 0), 40 * 0.7));
  assert.ok(near(patienceFor(order, byName("mochi"), 0), 40 * 1.4));
  assert.equal(patienceFor(order, byName("clementine"), 0), 40);
  assert.equal(patienceFor({ ...order, toppings: [] }, plain, PACE_KEYS[1]), 30);
  assert.ok(near(patienceFor(order, CRITIC, 0), 40 * 0.9));
  assert.ok(near(patienceFor(order, CRITIC, PACE_KEYS[2]), 32 * 0.9));
});

test("stations skip the ladle for a plain drink, and scoops queue one by one", () => {
  const plainDrink = { tea: "taro", sugar: 0, ice: "none", toppings: [] };
  const loaded = {
    tea: "taro",
    sugar: 0,
    ice: "none",
    toppings: [{ kind: "pearls", scoops: 2 }, { kind: "jelly", scoops: 1 }],
  };
  assert.deepEqual(stationsFor(plainDrink), ["pour", "shake", "seal"]);
  assert.deepEqual(stationsFor(loaded), ["pour", "scoop", "shake", "seal"]);
  // Ice comes before the pour whenever the order has any.
  assert.deepEqual(stationsFor({ ...plainDrink, ice: "less" }), ["ice", "pour", "shake", "seal"]);
  assert.deepEqual(stationsFor({ ...loaded, ice: "extra" }), ["ice", "pour", "scoop", "shake", "seal"]);
  assert.deepEqual(scoopQueue(plainDrink), []);
  assert.deepEqual(scoopQueue(loaded), ["pearls", "pearls", "jelly"]);
  assert.equal(totalScoops(loaded), 3);
});

// --- Pour -----------------------------------------------------------------------------

test("the pour speeds up while held and stops at the brim's limit", () => {
  assert.equal(pourRate(0), 0.35);
  assert.ok(near(pourRate(0.75), 0.45));
  assert.ok(near(pourRate(1.5), 0.55));
  assert.ok(near(pourRate(10), 0.55));
  assert.ok(near(stepPour(0.2, 0, 0.1), 0.235));
  assert.equal(stepPour(1.1, 5, 1), POUR_MAX);
  assert.equal(stepPour(POUR_MAX, 5, 0.1), POUR_MAX);
});

test("a steady hold reaches each fill line in a sane time", () => {
  const dt = 1 / 120;
  for (const ice of ICE) {
    let level = 0;
    let held = 0;
    while (level < FILL_LINE[ice]) {
      level = stepPour(level, held, dt);
      held += dt;
    }
    assert.ok(held > 1 && held < 2.5, `${ice} took ${held}s`);
  }
  assert.ok(FILL_LINE.none > FILL_LINE.less && FILL_LINE.less > FILL_LINE.extra);
});

test("the pour is graded by its distance from the line", () => {
  const line = FILL_LINE.less;
  assert.equal(pourGrade(line, "less"), 100);
  assert.equal(pourGrade(line - 0.03, "less"), 100);
  assert.equal(pourGrade(line - 0.05, "less"), 90);
  assert.equal(pourGrade(line - 0.07, "less"), 80);
  assert.equal(pourGrade(line - 0.14, "less"), 50);
  assert.equal(pourGrade(line - 0.245, "less"), 25);
  assert.equal(pourGrade(line - 0.35, "less"), 0);
  assert.equal(pourGrade(0, "less"), 0);

  // Overfill counts 1.3 times as far off.
  assert.equal(pourGrade(line + 0.07 / 1.3, "less"), 80);
  assert.equal(pourGrade(line + 0.14 / 1.3, "less"), 50);
  assert.ok(pourGrade(line + 0.06, "less") < pourGrade(line - 0.06, "less"));
  assert.equal(pourGrade(POUR_MAX, "extra"), 0);

  // Without the spill, short of the line is symmetric across lines.
  for (const ice of ICE) {
    for (const err of [0.02, 0.05, 0.1, 0.2]) {
      assert.equal(pourGrade(FILL_LINE[ice] - err, ice), pourGrade(FILL_LINE.less - err, "less"));
      assert.equal(
        pourGrade(FILL_LINE[ice] + err / 1.3, ice),
        pourGrade(FILL_LINE[ice] - err, ice),
      );
    }
  }
});

// --- Scoop --------------------------------------------------------------------------

test("the ladle swings between -1 and 1 and starts over the cup", () => {
  assert.equal(ladleAt(0, 3.3), 0);
  assert.ok(near(ladleAt(Math.PI / (2 * 2.6), 2.6), 1));
  assert.ok(near(ladleAt(0, 4, Math.PI / 2), 1));
  for (let t = 0; t < 10; t += 0.07) {
    const x = ladleAt(t, 4.0, 0.3);
    assert.ok(x >= -1 && x <= 1);
  }
  // It crosses the centre every half period.
  assert.ok(Math.abs(ladleAt(Math.PI / 3.3, 3.3)) < 1e-9);
});

test("drops are clean, on the rim or missed, by distance from the centre", () => {
  assert.equal(scoopResult(0), "clean");
  assert.equal(scoopResult(CUP_CENTER), "clean");
  assert.equal(scoopResult(-CUP_CENTER), "clean");
  assert.equal(scoopResult(CUP_CENTER + 0.001), "rim");
  assert.equal(scoopResult(-CUP_MOUTH), "rim");
  assert.equal(scoopResult(CUP_MOUTH + 0.001), "miss");
  assert.equal(scoopResult(-1), "miss");
  assert.equal(scoopGrade(0.1), 100);
  assert.equal(scoopGrade(-0.2), 60);
  assert.equal(scoopGrade(0.5), 0);
});

// --- Shake ----------------------------------------------------------------------------

test("a quicker shake grades higher, down to a floor of 30", () => {
  assert.equal(shakeGrade(0), 100);
  assert.equal(shakeGrade(1.4), 100);
  assert.equal(shakeGrade(2.2), 80);
  assert.equal(shakeGrade(3), 60);
  assert.equal(shakeGrade(4), 45);
  assert.equal(shakeGrade(5), 30);
  assert.equal(shakeGrade(60), 30);
  let last = 100;
  for (let s = 0; s <= 8; s += 0.1) {
    const grade = shakeGrade(s);
    assert.ok(grade <= last);
    assert.ok(Number.isInteger(grade));
    last = grade;
  }
});

// --- The receipt ------------------------------------------------------------------------

test("grades get a word", () => {
  assert.equal(gradeWord(100), "spot on");
  assert.equal(gradeWord(95), "spot on");
  assert.equal(gradeWord(94), "good");
  assert.equal(gradeWord(80), "good");
  assert.equal(gradeWord(79), "fine");
  assert.equal(gradeWord(55), "fine");
  assert.equal(gradeWord(54), "sloppy");
  assert.equal(gradeWord(0), "sloppy");
});

const GOOD_SEAL = (SEAL_BAND[0] + SEAL_BAND[1]) / 2;

test("a perfect drink scores 100", () => {
  const order = { tea: "taro", sugar: 50, ice: "less", toppings: [{ kind: "pearls", scoops: 2 }] };
  assert.deepEqual(
    gradeDrink({
      order, tea: "taro", iceCount: 2, level: FILL_LINE.less, drops: [100, 100], shakeSeconds: 1,
      sealValue: GOOD_SEAL, patienceFraction: 0.9,
    }),
    {
      accepted: true, reason: null, ice: 100, sugar: 100, pour: 100, scoop: 100, shake: 100, seal: 100, wait: 100,
      total: 100,
    },
  );
});

test("the wrong ice or a bad seal pulls the total down", () => {
  const order = { tea: "taro", sugar: 50, ice: "less", toppings: [{ kind: "pearls", scoops: 1 }] };
  const drink = {
    order, tea: "taro", iceCount: 2, level: FILL_LINE.less, drops: [100], shakeSeconds: 1,
    sealValue: GOOD_SEAL, patienceFraction: 1,
  };
  const iced = gradeDrink({ ...drink, iceCount: 3 });
  assert.equal(iced.ice, 60);
  // quality = (60 + 5 * 100) / 6 = 93.3; total = 0.8 * 93.3 + 20.
  assert.equal(iced.total, 95);
  assert.equal(gradeDrink({ ...drink, iceCount: 4 }).ice, 25);
  assert.equal(gradeDrink({ ...drink, iceCount: 5 }).ice, 0);

  const scorched = gradeDrink({ ...drink, sealValue: 1 });
  assert.equal(scorched.seal, 40);
  assert.equal(scorched.total, 92);
  assert.equal(gradeDrink({ ...drink, sealValue: SEAL_BAND[1] + 0.05 }).total, 96);

  // Sugar a pump off, or two, pulls it down the same way.
  const sweet = gradeDrink({ ...drink, sugarCount: 3 });
  assert.equal(sweet.sugar, 60);
  assert.equal(sweet.total, 95);
  assert.equal(gradeDrink({ ...drink, sugarCount: 0 }).sugar, 25);
});

test("a drink without toppings averages its five other stations", () => {
  const order = { tea: "milk", sugar: 50, ice: "none", toppings: [] };
  const result = gradeDrink({
    order, tea: "milk", iceCount: 0, level: FILL_LINE.none - 0.07, drops: [], shakeSeconds: 1,
    sealValue: SEAL_BAND[0], patienceFraction: 1,
  });
  assert.equal(result.scoop, null);
  assert.equal(result.ice, 100);
  assert.equal(result.pour, 80);
  assert.equal(result.shake, 100);
  assert.equal(result.seal, 100);
  assert.equal(result.sugar, 100);
  // quality = (100 + 100 + 80 + 100 + 100) / 5 = 96; total = 0.8 * 96 + 0.2 * 100.
  assert.equal(result.total, 97);
});

test("the wrong tea is sent back", () => {
  const order = { tea: "matcha", sugar: 50, ice: "extra", toppings: [] };
  assert.deepEqual(
    gradeDrink({
      order, tea: "milk", iceCount: 2, level: FILL_LINE.extra, drops: [], shakeSeconds: 1,
      sealValue: GOOD_SEAL, patienceFraction: 1,
    }),
    {
      accepted: false, reason: "wrong-tea", ice: 0, sugar: 0, pour: 0, scoop: null, shake: 0, seal: 0, wait: 0, total: 0,
    },
  );
});

test("waiting too long costs the wait grade, and the total mixes 80/20", () => {
  const order = { tea: "milk", sugar: 50, ice: "less", toppings: [{ kind: "jelly", scoops: 3 }] };
  const drink = {
    order, tea: "milk", iceCount: 2, level: FILL_LINE.less, drops: [100, 60, 0], shakeSeconds: 3,
    sealValue: GOOD_SEAL,
  };
  assert.equal(gradeDrink({ ...drink, patienceFraction: 0.5 }).wait, 100);
  assert.equal(gradeDrink({ ...drink, patienceFraction: 0.49 }).wait, 99);
  assert.equal(gradeDrink({ ...drink, patienceFraction: 0.2 }).wait, 70);
  assert.equal(gradeDrink({ ...drink, patienceFraction: 0 }).wait, 50);

  const result = gradeDrink({ ...drink, patienceFraction: 0.2 });
  assert.equal(result.pour, 100);
  assert.equal(result.scoop, 53);
  assert.equal(result.shake, 60);
  const quality = (result.ice + result.sugar + result.pour + result.scoop + result.shake + result.seal) / 6;
  assert.equal(result.total, Math.round(0.8 * quality + 0.2 * result.wait));
  // quality = (100 + 100 + 100 + 53 + 60 + 100) / 6 = 85.5; total = 68.4 + 14.
  assert.equal(result.total, 82);
});

test("points pay a base and a tip, and the tip drops into the jar as coins", () => {
  const none = { specialBonus: 0, criticBonus: 0, multiplier: 1 };
  assert.deepEqual(pointsForDrink(100, plain, 1), { points: 13, base: 10, tip: 3, coins: 3, ...none });
  assert.deepEqual(pointsForDrink(90, plain, 1), { points: 12, base: 9, tip: 3, coins: 3, ...none });
  assert.deepEqual(pointsForDrink(89, plain, 1), { points: 10, base: 9, tip: 1, coins: 1, ...none });
  assert.deepEqual(pointsForDrink(80, null, 1), { points: 9, base: 8, tip: 1, coins: 1, ...none });
  assert.deepEqual(pointsForDrink(79, plain, 1), { points: 8, base: 8, tip: 0, coins: 0, ...none });
  assert.deepEqual(pointsForDrink(0, plain, 0), { points: 1, base: 1, tip: 0, coins: 0, ...none });
  assert.equal(pointsForDrink(4, plain, 0).base, 1);
});

test("tippers double the tip and hurried regulars tip half again, rounded up", () => {
  const tipper = byName("clementine");
  const hurry = byName("tofu");
  assert.equal(pointsForDrink(95, tipper, 1).tip, 6);
  assert.equal(pointsForDrink(85, tipper, 1).tip, 2);
  assert.equal(pointsForDrink(70, tipper, 1).tip, 0);
  assert.equal(pointsForDrink(95, hurry, 1).tip, 5);
  assert.equal(pointsForDrink(85, hurry, 1).tip, 2);
  assert.equal(pointsForDrink(70, hurry, 1).tip, 0);
  assert.equal(pointsForDrink(95, byName("mochi"), 1).tip, 3);
});

test("a streak of good drinks climbs a combo that multiplies the drink", () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 9, 10, 30].map((streak) => comboFor(streak)), [1, 1, 1, 2, 2, 3, 3, 3, 3]);
  assert.deepEqual([0, 2, 3, 6, 9, 10, 30].map((streak) => comboFor(streak, true)), [1, 1, 2, 3, 3, 4, 4]);
  assert.equal(pointsForDrink(85, plain, 2).multiplier, 1);
  assert.equal(pointsForDrink(85, plain, 3).multiplier, 2);
  assert.equal(pointsForDrink(85, plain, 3).points, 2 * (9 + 1));
  assert.equal(pointsForDrink(100, plain, 7).points, 3 * 13);
  assert.equal(pointsForDrink(100, plain, 12, false, true).points, 4 * 13);
  // A drink that breaks the streak is never multiplied, whatever came before.
  assert.equal(pointsForDrink(79, plain, 9).multiplier, 1);
  assert.equal(keepsStreak(80), true);
  assert.equal(keepsStreak(79), false);
  // Only the points are multiplied: the tip and its coins are not.
  assert.equal(pointsForDrink(100, plain, 7).tip, 3);
  assert.equal(pointsForDrink(100, plain, 7).coins, 3);
});

test("combo progress fills toward the next step, and is empty at the top", () => {
  assert.deepEqual(comboProgress(0), { multiplier: 1, filled: 0, span: 3 });
  assert.deepEqual(comboProgress(2), { multiplier: 1, filled: 2, span: 3 });
  assert.deepEqual(comboProgress(3), { multiplier: 2, filled: 0, span: 3 });
  assert.deepEqual(comboProgress(5), { multiplier: 2, filled: 2, span: 3 });
  assert.deepEqual(comboProgress(6), { multiplier: 3, filled: 0, span: 0 });
  assert.deepEqual(comboProgress(8, true), { multiplier: 3, filled: 2, span: 4 });
  assert.deepEqual(comboProgress(11, true), { multiplier: 4, filled: 0, span: 0 });
});

test("the tip jar pays out each time it fills, and buys back a lost pearl", () => {
  assert.equal(JAR_SIZE, 12);
  assert.equal(JAR_BONUS, 25);
  assert.deepEqual(fillJar(0, 3), { jar: 3, payouts: 0 });
  assert.deepEqual(fillJar(10, 2), { jar: 0, payouts: 1 });
  assert.deepEqual(fillJar(10, 5), { jar: 3, payouts: 1 });
  assert.deepEqual(fillJar(11, 26), { jar: 1, payouts: 3 });
  assert.deepEqual(fillJar(4, 0), { jar: 4, payouts: 0 });
  assert.deepEqual(fillJar(4, -2), { jar: 4, payouts: 0 });
  assert.deepEqual(jarPayout(1, 2), { points: 25, lives: 3 });
  assert.deepEqual(jarPayout(1, 3), { points: 25, lives: LIVES }, "never more than the pearls you start with");
  assert.deepEqual(jarPayout(2, 1), { points: 50, lives: 3 });
  assert.deepEqual(jarPayout(0, 1), { points: 0, lives: 1 });
  // A run of perfect drinks for a plain regular fills the jar in four.
  let jar = 0;
  let payouts = 0;
  for (let drink = 0; drink < 4; drink++) {
    const filled = fillJar(jar, pointsForDrink(100, plain, drink + 1).coins);
    jar = filled.jar;
    payouts += filled.payouts;
  }
  assert.equal(payouts, 1);
});

test("a perfect drink cheers the line: everyone waiting gets patience back", () => {
  assert.ok(near(cheer(10, 40), 16));
  assert.equal(cheer(38, 40), 40);
  assert.ok(near(cheer(10, 40, true), 14), "less in expert");
  assert.ok(RULES.expert.cheer < RULES.normal.cheer);
});

test("the day's special adds a flat bonus and changes nothing else", () => {
  assert.equal(SPECIAL_BONUS, 2);
  for (const regular of [plain, byName("clementine"), byName("tofu"), null]) {
    for (const total of [0, 79, 85, 100]) {
      const usual = pointsForDrink(total, regular, 4);
      const special = pointsForDrink(total, regular, 4, true);
      assert.equal(special.specialBonus, SPECIAL_BONUS);
      // Multiplied by the combo along with the rest of the drink.
      assert.equal(special.points, usual.points + SPECIAL_BONUS * usual.multiplier);
      assert.equal(special.base, usual.base);
      assert.equal(special.tip, usual.tip);
    }
  }
});

test("the critic doubles base and tip, and raves about a 95 or better", () => {
  assert.deepEqual(pointsForDrink(94, CRITIC, 1), {
    points: 24, base: 18, tip: 6, coins: 6, specialBonus: 0, criticBonus: 0, multiplier: 1,
  });
  assert.deepEqual(pointsForDrink(95, CRITIC, 1), {
    points: 31, base: 20, tip: 6, coins: 6, specialBonus: 0, criticBonus: 5, multiplier: 1,
  });
  assert.deepEqual(pointsForDrink(100, CRITIC, 3, true), {
    points: 66, base: 20, tip: 6, coins: 6, specialBonus: 2, criticBonus: 5, multiplier: 2,
  });
  // Even a bad drink for the critic counts double.
  assert.equal(pointsForDrink(0, CRITIC, 0).base, 2);
  assert.equal(pointsForDrink(85, CRITIC, 1).tip, 2);
  // Nobody else gets the rave.
  assert.equal(pointsForDrink(100, plain, 1).criticBonus, 0);
  assert.equal(pointsForDrink(100, byName("clementine"), 1).criticBonus, 0);
});

// --- Ice ---------------------------------------------------------------------------------

test("ice is counted in cubes: one press, one cube, one icon on the ticket", () => {
  assert.deepEqual(ICE, ["none", "less", "regular", "extra"]);
  assert.deepEqual(ICE_CUBES, { none: 0, less: 2, regular: 3, extra: 4 });
  assert.equal(ICE_MAX, 6);
  assert.ok(ICE_MAX > ICE_CUBES.extra, "there is room to put in too much");
  for (const ice of ICE) assert.equal(iceGrade(ICE_CUBES[ice], ice), 100);
  assert.equal(iceGrade(1, "less"), 60);
  assert.equal(iceGrade(3, "less"), 60);
  assert.equal(iceGrade(0, "less"), 25);
  assert.equal(iceGrade(1, "none"), 60);
  assert.equal(iceGrade(2, "none"), 25);
  assert.equal(iceGrade(3, "none"), 0);
  assert.equal(iceGrade(5, "extra"), 60);
  assert.equal(iceGrade(1, "extra"), 0);
  assert.equal(iceGrade(3, "regular"), 100);
  // Expert: a cube off costs more, two off is nothing.
  assert.equal(iceGrade(3, "less", true), 40);
  assert.equal(iceGrade(0, "less", true), 0);
  assert.equal(iceGrade(2, "less", true), 100);
});

test("the ice reads short, right or over against the order", () => {
  assert.equal(iceState(0, "less"), "short");
  assert.equal(iceState(2, "less"), "right");
  assert.equal(iceState(3, "less"), "over");
  assert.equal(iceState(0, "none"), "right");
  assert.equal(iceState(1, "none"), "over");
  assert.equal(iceState(3, "extra"), "short");
});

// --- Choosing the jar -----------------------------------------------------------------------

test("the wrong jar is worth nothing; the right one is graded by the ladle", () => {
  for (const x of [0, 0.2, 0.9]) {
    assert.deepEqual(judgeScoop("pearls", "jelly", x), { result: "wrong", grade: 0 });
  }
  assert.deepEqual(judgeScoop("pearls", "pearls", 0), { result: "clean", grade: 100 });
  assert.deepEqual(judgeScoop("pearls", "pearls", -CUP_CENTER), { result: "clean", grade: 100 });
  assert.deepEqual(judgeScoop("redbean", "redbean", 0.2), { result: "rim", grade: 60 });
  assert.deepEqual(judgeScoop("pudding", "pudding", -0.9), { result: "miss", grade: 0 });
});

// --- Seal -------------------------------------------------------------------------------------

test("the seal needle is a triangle wave from 0 to 1 and back", () => {
  assert.equal(SEAL_PERIOD, 1.1);
  assert.equal(sealNeedle(0), 0);
  assert.ok(near(sealNeedle(SEAL_PERIOD / 2), 1));
  assert.ok(near(sealNeedle(SEAL_PERIOD / 4), 0.5));
  assert.ok(near(sealNeedle(SEAL_PERIOD), 0));
  for (let t = 0; t < 5; t += 0.037) {
    const value = sealNeedle(t);
    assert.ok(value >= 0 && value <= 1);
    // Repeats every period, and falls the way it rose.
    assert.ok(Math.abs(sealNeedle(t + SEAL_PERIOD) - value) < 1e-9);
    assert.ok(Math.abs(sealNeedle(SEAL_PERIOD - t) - value) < 1e-9);
    assert.ok(Math.abs(sealNeedle(SEAL_PERIOD / 2 + t) - sealNeedle(SEAL_PERIOD / 2 - t)) < 1e-9);
  }
  // A straight line: equal steps in time are equal steps on the gauge.
  assert.ok(near(sealNeedle(0.2) - sealNeedle(0.1), sealNeedle(0.3) - sealNeedle(0.2)));
});

test("the seal is loose, sealed or scorched, and graded by its distance from the band", () => {
  const [low, high] = SEAL_BAND;
  assert.deepEqual(SEAL_BAND, [0.68, 0.86]);
  assert.equal(sealResult(low), "sealed");
  assert.equal(sealResult(high), "sealed");
  assert.equal(sealResult(0.77), "sealed");
  assert.equal(sealResult(low - 0.001), "loose");
  assert.equal(sealResult(0), "loose");
  assert.equal(sealResult(high + 0.001), "scorched");
  assert.equal(sealResult(1), "scorched");

  assert.equal(sealGrade(low), 100);
  assert.equal(sealGrade(high), 100);
  assert.equal(sealGrade(low - 0.001), 70);
  assert.equal(sealGrade(high + 0.001), 70);
  assert.equal(sealGrade(low - 0.1), 70);
  assert.equal(sealGrade(high + 0.1), 70);
  assert.equal(sealGrade(low - 0.11), 40);
  assert.equal(sealGrade(high + 0.11), 40);
  assert.equal(sealGrade(0), 40);
  assert.equal(sealGrade(1), 40);
});

// --- Tanks ------------------------------------------------------------------------------------

test("pours drain the tank, never below empty", () => {
  assert.deepEqual(drawFromTank(2, 0.75), { poured: 0.75, tank: 1.25 });
  assert.deepEqual(drawFromTank(0.5, 0.9), { poured: 0.5, tank: 0 });
  assert.deepEqual(drawFromTank(0, 0.6), { poured: 0, tank: 0 });
  assert.deepEqual(drawFromTank(0.9, 0.9), { poured: 0.9, tank: 0 });
  assert.equal(BREW_SECONDS, 5);
});

test("tanks warn when low and stop when empty", () => {
  assert.equal(tankState(TANK_CAPACITY), "ok");
  assert.equal(tankState(TANK_LOW + 0.01), "ok");
  assert.equal(tankState(TANK_LOW), "low");
  assert.equal(tankState(0.002), "low");
  assert.equal(tankState(0.001), "empty");
  assert.equal(tankState(0), "empty");
});

test("a full tank pours three no-ice drinks but not five", () => {
  let tank = TANK_CAPACITY;
  for (let i = 0; i < 3; i++) {
    const draw = drawFromTank(tank, FILL_LINE.none);
    assert.ok(near(draw.poured, FILL_LINE.none));
    tank = draw.tank;
  }
  assert.ok(3 * FILL_LINE.none <= TANK_CAPACITY);
  assert.ok(5 * FILL_LINE.none > TANK_CAPACITY);
  // Lighter drinks stretch it to about four.
  assert.ok(4 * FILL_LINE.less <= TANK_CAPACITY);
});

// --- Samples -----------------------------------------------------------------------------------

test("a sample gives back a share of patience, up to full", () => {
  assert.equal(SAMPLES_PER_SHIFT, 3);
  assert.equal(SAMPLE_BOOST, 0.4);
  assert.ok(near(sampleBoost(5, 30), 17));
  assert.ok(near(sampleBoost(0, 40), 16));
  assert.equal(sampleBoost(25, 30), 30);
  assert.equal(sampleBoost(30, 30), 30);
});

test("the most impatient guest is chosen by share of patience, not seconds", () => {
  const guests = [
    { id: "a", left: 8, patience: 40 }, // 0.2
    { id: "b", left: 6, patience: 12 }, // 0.5: fewer seconds, but calmer
    { id: "c", left: 15, patience: 30 }, // 0.5
  ];
  assert.equal(mostImpatient(guests), 0);
  assert.equal(mostImpatient(guests, "a"), 1);
  assert.equal(mostImpatient(guests, "zzz"), 0);
  assert.equal(mostImpatient([]), -1);
  assert.equal(mostImpatient([{ id: 7, left: 1, patience: 10 }], 7), -1);
  // Ids can be numbers, and 0 is a real id.
  assert.equal(mostImpatient([{ id: 0, left: 1, patience: 10 }, { id: 1, left: 9, patience: 10 }], 0), 1);
});

// --- The critic and the special ----------------------------------------------------------------

test("the critic is due once, from forty seconds in", () => {
  assert.equal(CRITIC_AT, 40);
  assert.equal(CRITIC.quirk, "critic");
  assert.equal(CRITIC.name, "the critic");
  assert.ok(!REGULARS.includes(CRITIC));
  assert.equal(criticDue(39.9, false), false);
  assert.equal(criticDue(40, false), true);
  assert.equal(criticDue(100, false), true);
  assert.equal(criticDue(100, true), false);
  // Never before the counter is going: three drinks served first.
  assert.equal(CRITIC_AFTER, 3);
  assert.equal(criticDue(60, 0, false, 2), false);
  assert.equal(criticDue(60, 0, false, 3), true);
  assert.equal(criticDue(110, 1, true, 2), false);
  assert.equal(criticDue(110, 1, true, 5), true);
});

test("the first two orders of a normal shift come with no toppings", () => {
  assert.equal(PLAIN_ORDERS, 2);
  for (const seed of SEEDS) {
    const random = seeded(seed);
    for (let number = 0; number < 40; number++) {
      for (const regular of [null, byName("biscuit"), byName("kiwi")]) {
        const order = makeOrder(0, regular, random, false, number);
        if (number < PLAIN_ORDERS) assert.deepEqual(order.toppings, [], `order ${number}`);
      }
    }
  }
  // Regulars keep the rest of their usual; expert opens loaded as ever.
  assert.equal(makeOrder(0, byName("biscuit"), seeded(1), false, 0).toppings.length, 0);
  assert.equal(makeOrder(0, byName("biscuit"), seeded(1), false, 2).toppings[0].scoops, 2);
  assert.ok(totalScoops(makeOrder(0, null, seeded(1), true, 0)) >= 1);
});

test("a guest about to leave reads in steps: glancing, cross and leaving, then rushing", () => {
  assert.ok(GLANCE_AT > CROSS_AT && CROSS_AT > RUSH_AT && RUSH_AT > 0);
});

test("the cup goes under its tea's tap", () => {
  for (const tea of TEAS) assert.equal(TEAS[tapFor({ tea, sugar: 0, ice: "none", toppings: [] })], tea);
});

test("the critic always orders the phase's most toppings", () => {
  for (const seed of SEEDS) {
    const random = seeded(seed);
    for (const elapsed of [0, 30, 80]) {
      const { maxScoops } = paceForElapsed(elapsed);
      for (let i = 0; i < 50; i++) {
        const order = makeOrder(elapsed, CRITIC, random);
        assert.equal(totalScoops(order), maxScoops);
        assert.ok(TEAS.includes(order.tea));
        assert.ok(ICE.includes(order.ice));
      }
    }
  }
});

test("the special is one of the teas, and every tea gets a turn", () => {
  for (const seed of SEEDS) {
    const random = seeded(seed);
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(pickSpecial(random));
    assert.deepEqual([...seen].sort(), [...TEAS].sort());
  }
  assert.equal(pickSpecial(scripted(0)), TEAS[0]);
  assert.equal(pickSpecial(scripted(0.999)), TEAS[3]);
});

test("a sample only goes to a guest below SAMPLE_WORTH of their patience", () => {
  assert.equal(SAMPLE_WORTH, 0.85);
  assert.equal(sampleTarget([{ id: 1, left: 9.9, patience: 10 }]), -1, "99% patient: nobody needs one");
  assert.equal(sampleTarget([{ id: 1, left: 8.5, patience: 10 }]), -1, "exactly at the line: not yet");
  assert.equal(sampleTarget([{ id: 1, left: 8, patience: 10 }]), 0);
  assert.equal(
    sampleTarget([{ id: 1, left: 2, patience: 10 }, { id: 2, left: 9.9, patience: 10 }], 1),
    -1,
    "the guest being made is skipped, and the other is fine",
  );
  assert.equal(sampleTarget([{ id: 1, left: 2, patience: 10 }, { id: 2, left: 5, patience: 10 }], 1), 1);
  assert.equal(sampleTarget([]), -1);
});

// --- Faces -------------------------------------------------------------------------------------

test("a waiting guest is calm, then glances at the clock, then turns cross", () => {
  assert.equal(GLANCE_AT, 0.6);
  assert.equal(CROSS_AT, 0.3);
  assert.equal(waitingMood(1), "calm");
  assert.equal(waitingMood(0.61), "calm");
  assert.equal(waitingMood(0.6), "glance");
  assert.equal(waitingMood(0.31), "glance");
  assert.equal(waitingMood(0.3), "cross");
  assert.equal(waitingMood(0), "cross");
});

test("a served guest reacts to the grade, and to a good drink that came fast", () => {
  assert.equal(FAST_SERVE, 0.8);
  assert.equal(servedMood(100, 0.1), "starry");
  assert.equal(servedMood(95, 1), "starry", "perfect beats fast");
  assert.equal(servedMood(94, 0.8), "wow");
  assert.equal(servedMood(80, 0.95), "wow");
  assert.equal(servedMood(94, 0.79), "content");
  assert.equal(servedMood(80, 0.2), "content");
  assert.equal(servedMood(79, 1), "meh", "a fine drink doesn't impress however fast");
  assert.equal(servedMood(55, 0.5), "meh");
  assert.equal(servedMood(54, 0.5), "unimpressed");
  assert.equal(servedMood(0, 1), "unimpressed");
});

test("every way of leaving has its own share face", () => {
  const reactions = ["starry", "wow", "content", "meh", "unimpressed", "storm", "sentBack"];
  assert.deepEqual(Object.keys(SHARE_FACES).sort(), [...reactions].sort());
  assert.equal(new Set(Object.values(SHARE_FACES)).size, reactions.length);
  for (const face of Object.values(SHARE_FACES)) assert.ok(face.length > 0 && !/[a-z]/i.test(face));
});

// --- Expert ------------------------------------------------------------------------------------

test("expert sends more guests, faster, with less patience and bigger orders", () => {
  assert.equal(maxTickets(), MAX_TICKETS);
  assert.equal(maxTickets(true), 4);
  assert.equal(samplesFor(), SAMPLES_PER_SHIFT);
  assert.equal(samplesFor(true), 2);
  for (const elapsed of [0, 30, 80]) {
    const normal = paceForElapsed(elapsed);
    const expert = paceForElapsed(elapsed, true);
    assert.equal(expert.phase, normal.phase);
    assert.ok(expert.arrivalEvery <= normal.arrivalEvery * 0.8, "arrivals at least a fifth quicker");
    assert.ok(expert.patience <= normal.patience * 0.72, "under three quarters of the patience");
    assert.ok(expert.swing >= normal.swing * 1.25, "the ladle a quarter faster");
    assert.ok(expert.minScoops > normal.minScoops && expert.maxScoops > normal.maxScoops);
  }
  const order = { tea: "milk", sugar: 50, ice: "less", toppings: [{ kind: "pearls", scoops: 2 }] };
  assert.equal(patienceFor(order, plain, 0, true), 30);
  assert.ok(patienceFor(order, plain, 80, true) < patienceFor(order, plain, 80));
  assert.ok(activePatienceRate(true) > activePatienceRate());
  for (const seed of SEEDS) {
    const random = seeded(seed);
    for (const elapsed of [0, 30, 80]) {
      const { minScoops, maxScoops } = paceForElapsed(elapsed, true);
      for (let i = 0; i < 100; i++) {
        const scoops = totalScoops(makeOrder(elapsed, null, random, true));
        assert.ok(scoops >= minScoops && scoops <= maxScoops);
      }
    }
  }
});

test("expert grades tighter at every station", () => {
  // The ladle: a narrower clean centre and mouth.
  assert.equal(scoopResult(0.12), "clean");
  assert.equal(scoopResult(0.12, true), "rim");
  assert.equal(scoopResult(0.3), "rim");
  assert.equal(scoopResult(0.3, true), "miss");
  assert.deepEqual(judgeScoop("pearls", "pearls", 0.12, true), { result: "rim", grade: 60 });
  assert.equal(scoopGrade(0.05, true), 100);
  // The pour: a smaller window for spot on.
  const line = FILL_LINE.less;
  assert.equal(pourGrade(line - 0.03, "less"), 100);
  assert.ok(pourGrade(line - 0.03, "less", true) < 100);
  assert.equal(pourGrade(line - 0.02, "less", true), 100);
  assert.equal(pourGrade(line - 0.25, "less", true), 0);
  // The shake: quicker for full marks.
  assert.equal(shakeGrade(1.4), 100);
  assert.ok(shakeGrade(1.4, true) < 100);
  assert.equal(shakeGrade(1.1, true), 100);
  // The seal: a quicker needle and a narrower band.
  assert.ok(RULES.expert.sealPeriod < SEAL_PERIOD);
  assert.ok(near(sealNeedle(RULES.expert.sealPeriod / 2, true), 1));
  assert.ok(near(sealNeedle(RULES.expert.sealPeriod, true), 0));
  assert.equal(sealResult(0.69), "sealed");
  assert.equal(sealResult(0.69, true), "loose");
  assert.equal(sealResult(0.85, true), "scorched");
  assert.equal(sealGrade(0.77, true), 100);
  assert.equal(sealGrade(0.69, true), 70);
  assert.equal(sealGrade(0.62, true), 40);
  // The whole drink: the same hands score lower in expert.
  const order = { tea: "taro", sugar: 50, ice: "less", toppings: [{ kind: "pearls", scoops: 1 }] };
  const drink = {
    order, tea: "taro", iceCount: 2, level: line - 0.03, drops: [100], shakeSeconds: 1.4,
    sealValue: 0.7, patienceFraction: 1,
  };
  assert.equal(gradeDrink(drink).total, 100);
  assert.ok(gradeDrink({ ...drink, expert: true }).total < 95);
});

test("the critic comes once, or twice in expert", () => {
  assert.equal(criticDue(39.9, 0), false);
  assert.equal(criticDue(40, 0), true);
  assert.equal(criticDue(100, 1), false);
  assert.equal(criticDue(34.9, 0, true), false);
  assert.equal(criticDue(35, 0, true), true);
  assert.equal(criticDue(60, 1, true), false);
  assert.equal(criticDue(85, 1, true), true);
  assert.equal(criticDue(110, 2, true), false);
  assert.equal(criticDue(110, true, true), true, "true counts as once");
});

// --- Sugar --------------------------------------------------------------------------------------

test("sugar comes in five levels, one pump a quarter", () => {
  assert.deepEqual(SUGARS, [0, 25, 50, 75, 100]);
  assert.equal(SUGAR_STEP, 25);
  assert.deepEqual(SUGARS.map(sugarPumps), [0, 1, 2, 3, 4]);
  assert.ok(SUGAR_MAX > sugarPumps(100), "there is room to pump too much");
  for (const sugar of SUGARS) assert.equal(sugarGrade(sugarPumps(sugar), sugar), 100);
  assert.equal(sugarGrade(3, 50), 60);
  assert.equal(sugarGrade(1, 50), 60);
  assert.equal(sugarGrade(4, 50), 25);
  assert.equal(sugarGrade(3, 0), 0);
  // Expert: exact amounts matter more.
  assert.equal(sugarGrade(3, 50, true), 40);
  assert.equal(sugarGrade(4, 50, true), 0);
  assert.equal(sugarState(1, 50), "short");
  assert.equal(sugarState(2, 50), "right");
  assert.equal(sugarState(3, 50), "over");
});

test("every order has a sugar level, and the syrup station only when there is some", () => {
  for (const seed of SEEDS) {
    const random = seeded(seed);
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const order = makeOrder(30, null, random);
      assert.ok(SUGARS.includes(order.sugar));
      seen.add(order.sugar);
      assert.equal(stationsFor(order).includes("sugar"), order.sugar > 0);
    }
    assert.equal(seen.size, SUGARS.length);
  }
  // The syrup first, at the bottle; then the ice and the pour, both under the tea's tap.
  assert.deepEqual(stationsFor({ tea: "milk", sugar: 75, ice: "regular", toppings: [] }), ["sugar", "ice", "pour", "shake", "seal"]);
  assert.deepEqual(stationsFor({ tea: "milk", sugar: 0, ice: "none", toppings: [] }), ["pour", "shake", "seal"]);
  // Regulars keep their sweet tooth.
  assert.equal(makeOrder(0, byName("basil"), seeded(2)).sugar, 0);
  assert.equal(makeOrder(0, byName("cocoa"), seeded(2)).sugar, 100);
  assert.equal(makeOrder(0, byName("peaches"), seeded(2)).sugar, 25);
});
