import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_DROP_WITHIN,
  DEMO_JAR_START,
  DEMO_ORDER,
  DEMO_REGULAR,
  DEMO_SCRIPT,
  DEMO_SEAL_AIM,
  DEMO_SEAL_WITHIN,
  DEMO_START_JAR,
  DEMO_START_TAP,
  demoIceCubes,
  demoSugarPumps,
  demoJarEnd,
  demoLadle,
  demoPourTarget,
  demoSeconds,
  pourSeconds,
  reachedTarget,
} from "../src/lib/arcade/orders-demo.js";
import {
  CUP_CENTER,
  ICE_CUBES,
  JAR_SIZE,
  SEAL_BAND,
  SHAKES_NEEDED,
  TEAS,
  fillJar,
  gradeDrink,
  iceGrade,
  pointsForDrink,
  sugarGrade,
  pourGrade,
  scoopQueue,
  sealGrade,
  stationsFor,
} from "../src/lib/arcade/orders-engine.js";

test("the demo guest is a real regular with a drink that visits every station", () => {
  assert.equal(DEMO_REGULAR.name, "pip");
  assert.deepEqual(stationsFor(DEMO_ORDER), ["ice", "sugar", "pour", "scoop", "shake", "seal"]);
  assert.ok(ICE_CUBES[DEMO_ORDER.ice] > 0, "the demo shows the ice going in");
  assert.ok(demoSugarPumps() > 0, "and the syrup");
});

test("the demo's perfect drink tips the jar over, so the payout shows", () => {
  const { coins } = pointsForDrink(100, DEMO_REGULAR, 1);
  assert.ok(coins > 0);
  assert.ok(DEMO_JAR_START > 0 && DEMO_JAR_START < JAR_SIZE);
  assert.deepEqual(fillJar(DEMO_JAR_START, coins), { jar: 0, payouts: 1 });
});

test("the script runs about twenty to twenty-five seconds", () => {
  const { low, high } = demoSeconds();
  assert.ok(low >= 18, `at least 18s, got ${low.toFixed(1)}`);
  assert.ok(high <= 27, `at most 27s, got ${high.toFixed(1)}`);
});

test("every caption is one short line with no dot separators", () => {
  const captions = DEMO_SCRIPT.flatMap((step) => (step.caption ? [step.caption] : []));
  assert.equal(captions.length, 9);
  for (const caption of captions) {
    assert.doesNotMatch(caption, /[\n·.!]/);
    assert.ok(caption.length <= 52, caption);
    assert.equal(caption, caption.toLowerCase());
  }
});

test("the script makes the drink well: right ice, the line, the right jar, the band", () => {
  assert.equal(iceGrade(demoIceCubes(), DEMO_ORDER.ice), 100);
  assert.equal(sugarGrade(demoSugarPumps(), DEMO_ORDER.sugar), 100);
  assert.equal(pourGrade(demoPourTarget() + 0.02, DEMO_ORDER.ice), 100);
  assert.equal(demoJarEnd(), scoopQueue(DEMO_ORDER)[0]);
  assert.notEqual(DEMO_START_JAR, 0, "the marker visibly moves");
  assert.notEqual(TEAS[DEMO_START_TAP], DEMO_ORDER.tea, "the cup visibly slides");
  assert.equal(sealGrade(DEMO_SEAL_AIM), 100);
  assert.equal(sealGrade(DEMO_SEAL_AIM + DEMO_SEAL_WITHIN), 100);
  assert.ok(DEMO_SEAL_AIM - DEMO_SEAL_WITHIN > SEAL_BAND[0]);
  assert.ok(DEMO_DROP_WITHIN < CUP_CENTER, "a drop within the window is clean");
  // Made that way, with the guest still patient, it is perfect.
  const drink = gradeDrink({
    order: DEMO_ORDER, tea: DEMO_ORDER.tea, iceCount: demoIceCubes(), sugarCount: demoSugarPumps(), level: demoPourTarget() + 0.004,
    drops: [100], shakeSeconds: (SHAKES_NEEDED - 1) * 0.16, sealValue: DEMO_SEAL_AIM, patienceFraction: 0.9,
  });
  assert.equal(drink.total, 100);
});

test("the steps come in station order and end on the end card", () => {
  const order = DEMO_SCRIPT.map((step) => step.act).filter((act, index, list) => list.indexOf(act) === index);
  assert.deepEqual(order, ["arrive", "take", "ice", "sugar", "pour", "jar", "drop", "shake", "seal", "receipt", "end"]);
});

test("a pour to the line takes a human hold, not an instant", () => {
  const seconds = pourSeconds(demoPourTarget());
  assert.ok(seconds > 1 && seconds < 2.5, `${seconds}`);
});

test("reachedTarget catches the window, or a frame that steps over it", () => {
  assert.equal(reachedTarget(0.3, 0.02, 0, 0.05), true);
  assert.equal(reachedTarget(0.08, -0.07, 0, 0.05), true);
  assert.equal(reachedTarget(0.9, 0.5, 0, 0.05), false);
  assert.equal(reachedTarget(0.9, -0.9, 0, 0.05), false, "a wild jump is not a crossing");
});

test("the ladle comes over the cup within a swing", () => {
  let previous = demoLadle(0);
  let found = false;
  for (let t = 1 / 60; t < 3; t += 1 / 60) {
    const now = demoLadle(t);
    if (reachedTarget(previous, now, 0, DEMO_DROP_WITHIN)) {
      found = true;
      break;
    }
    previous = now;
  }
  assert.ok(found);
});
