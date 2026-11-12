import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_DROP_WITHIN,
  DEMO_ORDER,
  DEMO_REGULAR,
  DEMO_SCRIPT,
  DEMO_SEAL_AIM,
  DEMO_SEAL_WITHIN,
  DEMO_START_JAR,
  DEMO_START_TAP,
  demoIceScoops,
  demoJarEnd,
  demoLadle,
  demoPourTarget,
  demoSeconds,
  pourSeconds,
  reachedTarget,
} from "../src/lib/arcade/orders-demo.js";
import {
  CUP_CENTER,
  ICE_SCOOPS,
  SEAL_BAND,
  TEAS,
  iceGrade,
  pourGrade,
  scoopQueue,
  sealGrade,
  stationsFor,
} from "../src/lib/arcade/orders-engine.js";

test("the demo guest is a real regular with a drink that visits every station", () => {
  assert.equal(DEMO_REGULAR.name, "pip");
  assert.deepEqual(stationsFor(DEMO_ORDER), ["pour", "scoop", "shake", "seal"]);
  assert.ok(ICE_SCOOPS[DEMO_ORDER.ice] > 0, "the demo shows the ice going in");
});

test("the script runs about twenty to twenty-five seconds", () => {
  const { low, high } = demoSeconds();
  assert.ok(low >= 18, `at least 18s, got ${low.toFixed(1)}`);
  assert.ok(high <= 27, `at most 27s, got ${high.toFixed(1)}`);
});

test("every caption is one short line with no dot separators", () => {
  const captions = DEMO_SCRIPT.flatMap((step) => (step.caption ? [step.caption] : []));
  assert.equal(captions.length, 7);
  for (const caption of captions) {
    assert.doesNotMatch(caption, /[\n·.!]/);
    assert.ok(caption.length <= 52, caption);
    assert.equal(caption, caption.toLowerCase());
  }
});

test("the script makes the drink well: right ice, the line, the right jar, the band", () => {
  assert.equal(iceGrade(demoIceScoops(), DEMO_ORDER.ice), 100);
  assert.equal(pourGrade(demoPourTarget() + 0.02, DEMO_ORDER.ice), 100);
  assert.equal(demoJarEnd(), scoopQueue(DEMO_ORDER)[0]);
  assert.notEqual(DEMO_START_JAR, 0, "the marker visibly moves");
  assert.notEqual(TEAS[DEMO_START_TAP], DEMO_ORDER.tea, "the cup visibly slides");
  assert.equal(sealGrade(DEMO_SEAL_AIM), 100);
  assert.equal(sealGrade(DEMO_SEAL_AIM + DEMO_SEAL_WITHIN), 100);
  assert.ok(DEMO_SEAL_AIM - DEMO_SEAL_WITHIN > SEAL_BAND[0]);
  assert.ok(DEMO_DROP_WITHIN < CUP_CENTER, "a drop within the window is clean");
});

test("the steps come in station order and end on the end card", () => {
  const order = DEMO_SCRIPT.map((step) => step.act).filter((act, index, list) => list.indexOf(act) === index);
  assert.deepEqual(order, ["arrive", "take", "ice", "pour", "jar", "drop", "shake", "seal", "receipt", "end"]);
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
