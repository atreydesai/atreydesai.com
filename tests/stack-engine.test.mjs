import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPERT,
  FRAME_RATE,
  NORMAL,
  START_WIDTH,
  dropCup,
  drawnLeft,
  grownSpan,
  perfectWindow,
  phaseForHeight,
  rulesFor,
  shareTower,
  slideFor,
  sliderWidth,
  speedForHeight,
  traySpan,
  widthAfterPerfect,
} from "../src/lib/arcade/stack-engine.js";

/** Screen pixels to a unit: phone and desktop, at one and two device pixels. */
const PIXEL_SCALES = [4, 5, 8, 10];
const MODES = [NORMAL, EXPERT];

/** A cup of `width` centred on a top `topWidth` wide whose left edge is at `topLeft`. */
function centredLeft(topLeft, topWidth, width) {
  return topLeft + (topWidth - width) / 2;
}

// --- The perfect window ---------------------------------------------------------

test("normal's perfect window starts at 32 ms and tightens to 15 ms by 24 cups", () => {
  const start = perfectWindow(0, speedForHeight(0));
  assert.ok(Math.abs(start - 0.48) < 1e-9, `${start}`);
  // As time either side of centre, at the slide's own speed.
  const ms = (height) => (1000 * perfectWindow(height, speedForHeight(height))) / speedForHeight(height);
  assert.ok(Math.abs(ms(0) - 32) < 1e-9);
  assert.ok(Math.abs(ms(24) - 15) < 1e-9);
  assert.ok(Math.abs(ms(80) - 15) < 1e-9);
  for (let height = 1; height <= 24; height++) assert.ok(ms(height) < ms(height - 1), `height ${height}`);
  // The old window was 1.5 units: now well under a third of it.
  assert.ok(start < 0.5);
});

test("normal is very slightly easier than it was: a few percent more perfect window, the same slide", () => {
  assert.deepEqual(NORMAL.perfect, { start: 0.032, end: 0.015, by: 24 });
  assert.deepEqual(NORMAL.speed, { start: 15, perCup: 0.65, max: 40 });
  // Expert is left exactly as it was.
  assert.deepEqual(EXPERT, {
    expert: true,
    startWidth: 10,
    speed: { start: 22, perCup: 1, max: 44 },
    perfect: { start: 0, end: 0, by: 1 },
    growAfter: 4,
    growEvery: 2,
    vary: 0.2,
    phases: [8, 20],
  });
  const before = { ...NORMAL, perfect: { start: 0.03, end: 0.014, by: 24 } };
  for (let height = 0; height <= 120; height++) {
    const speed = speedForHeight(height);
    const now = perfectWindow(height, speed);
    const was = perfectWindow(height, speed, before);
    // Between 5% and 8% wider in time, and so in distance: a hair, not a new game.
    assert.ok(now / was > 1.05 && now / was < 1.08, `height ${height}: ${now} vs ${was}`);
    // Still under a unit, so a drop just outside it is still "a hair off".
    assert.ok(now < 1, `height ${height}: ${now}`);
    // And never narrower than one frame of the slide and half a pixel.
    assert.ok(now >= speed / (2 * FRAME_RATE) + 1 / 8 - 1e-9, `height ${height}`);
  }
});

test("expert's perfect window is the narrowest allowed, and always narrower in time than normal's", () => {
  for (let height = 0; height <= 120; height++) {
    const normalSpeed = speedForHeight(height);
    const expertSpeed = speedForHeight(height, EXPERT);
    const floor = expertSpeed / (2 * FRAME_RATE) + 1 / 8;
    assert.ok(Math.abs(perfectWindow(height, expertSpeed, EXPERT) - floor) < 1e-9, `height ${height}`);
    const normalMs = perfectWindow(height, normalSpeed) / normalSpeed;
    const expertMs = perfectWindow(height, expertSpeed, EXPERT) / expertSpeed;
    assert.ok(expertMs < normalMs, `height ${height}: ${expertMs} vs ${normalMs}`);
  }
  assert.ok(perfectWindow(0, speedForHeight(0, EXPERT), EXPERT) < 0.32);
});

test("at 60 frames a second, every pass of the slide shows a frame inside the perfect window", () => {
  const top = { left: -7, width: 14 };
  const centre = centredLeft(top.left, top.width, 14);
  for (const rules of MODES) {
    for (let height = 0; height <= 120; height += 3) {
      // Expert's slowest and fastest cups at this height, and normal's one pace.
      const base = speedForHeight(height, rules);
      for (const speed of [base * (1 - rules.vary), base, base * (1 + rules.vary)]) {
        const window = perfectWindow(height, speed, rules);
        const step = speed / FRAME_RATE;
        for (const px of PIXEL_SCALES) {
          for (let phase = 0; phase < 1; phase += 0.05) {
            // Frames fall at every phase relative to the centre on a pass.
            let hit = false;
            for (let k = -40; k <= 40 && !hit; k++) {
              const left = centre + (k + phase) * step;
              hit = dropCup(top, left, 14, { window, px }).kind === "perfect";
            }
            assert.ok(hit, `${rules.expert ? "expert" : "normal"} height ${height} speed ${speed} px ${px} phase ${phase}`);
          }
        }
      }
    }
  }
});

test("a drop is judged where it was drawn, to the pixel", () => {
  const top = { left: -7, width: 14 };
  const window = 0.45;
  // At 5 px a unit, 0.45 units is 2.25 px: the cup drawn 2 px off is perfect, 3 px off is not.
  assert.equal(drawnLeft(-7 + 0.43, 5), -7 + 0.4);
  assert.equal(dropCup(top, -7 + 0.49, 14, { window, px: 5 }).kind, "perfect");
  assert.equal(dropCup(top, -7 + 0.51, 14, { window, px: 5 }).kind, "close");
  assert.equal(dropCup(top, -7 - 0.49, 14, { window, px: 5 }).kind, "perfect");
  // Every raw position that draws on the same pixel gets the same verdict.
  for (const px of PIXEL_SCALES) {
    for (let pixel = -12; pixel <= 12; pixel++) {
      const verdicts = new Set();
      for (let sub = -0.49; sub <= 0.49; sub += 0.07) {
        verdicts.add(dropCup(top, -7 + (pixel + sub) / px, 14, { window, px }).kind);
      }
      assert.equal(verdicts.size, 1, `px ${px} pixel ${pixel}: ${[...verdicts]}`);
    }
  }
});

test("a near miss lands whole and centred, but is not a perfect", () => {
  const top = { left: -7, width: 14 };
  for (const px of PIXEL_SCALES) {
    for (let off = 0.55; off < 1; off += 0.05) {
      for (const sign of [1, -1]) {
        const result = dropCup(top, -7 + sign * off, 14, { window: 0.45, px });
        // Drawn inside the window, or drawn a whole unit off: not near misses.
        const drawn = Math.abs(drawnLeft(-7 + sign * off, px) + 7);
        if (drawn <= 0.45 || drawn >= 1) continue;
        assert.equal(result.kind, "close", `px ${px} off ${sign * off}`);
        assert.deepEqual(result.placed, top);
        assert.equal(result.cut, null);
      }
    }
  }
  // A unit or more off is cut, never called close.
  assert.equal(dropCup(top, -6, 14, { window: 0.45, px: 5 }).kind, "cut");
  // On the wider tray an off-centre drop that snaps to centre is close too.
  const tray = traySpan();
  assert.equal(dropCup(tray, -7 + 0.8, START_WIDTH, { window: 0.45, px: 5 }).kind, "close");
  assert.equal(dropCup(tray, -7 + 1.2, START_WIDTH, { window: 0.45, px: 5 }).kind, "clean");
});

test("the grid snap never turns a near miss into a perfect, nor a perfect into a cut", () => {
  const top = { left: -6, width: 11 };
  const width = 11;
  for (const rules of MODES) {
    for (const height of [0, 12, 40]) {
      const speed = speedForHeight(height, rules);
      const window = perfectWindow(height, speed, rules);
      for (const px of PIXEL_SCALES) {
        for (let left = -24; left <= 12; left += 0.013) {
          const result = dropCup(top, left, width, { window, px });
          const seen = drawnLeft(left, px) - top.left;
          if (Math.abs(seen) <= window + 1e-9) {
            assert.equal(result.kind, "perfect", `left ${left}`);
            assert.deepEqual(result.placed, top);
          } else {
            assert.notEqual(result.kind, "perfect", `left ${left}`);
          }
          // Never cut more than the eye saw hanging over, as drawn.
          if (result.kind === "cut" && result.cut) {
            assert.ok(result.cut.width <= Math.abs(seen) + 1e-9, `cut ${result.cut.width} of ${seen} at ${left}`);
          }
        }
      }
    }
  }
});

// --- Regrowth -------------------------------------------------------------------

test("normal regrows a unit on the third perfect in a row and every one after", () => {
  const grows = [];
  for (let streak = 1; streak <= 8; streak++) grows.push(widthAfterPerfect(9, streak) > 9);
  assert.deepEqual(grows, [false, false, true, true, true, true, true, true]);
  assert.equal(widthAfterPerfect(START_WIDTH, 12), START_WIDTH);
});

test("expert regrows slower: the fourth perfect in a row, then every second one", () => {
  const grows = [];
  for (let streak = 1; streak <= 9; streak++) grows.push(widthAfterPerfect(6, streak, EXPERT) > 6);
  assert.deepEqual(grows, [false, false, false, true, false, true, false, true, false]);
  assert.equal(widthAfterPerfect(EXPERT.startWidth, 20, EXPERT), EXPERT.startWidth);
});

test("a cup grows back toward the tray's centre line", () => {
  assert.deepEqual(grownSpan({ left: -3, width: 9 }, 3), { left: -4, width: 10 });
  assert.deepEqual(grownSpan({ left: -6, width: 9 }, 3), { left: -6, width: 10 });
  assert.deepEqual(grownSpan({ left: -3, width: 9 }, 2), { left: -3, width: 9 });
});

// --- Expert ---------------------------------------------------------------------

test("expert starts faster, speeds up sooner, and rushes sooner", () => {
  assert.equal(rulesFor(false), NORMAL);
  assert.equal(rulesFor(true), EXPERT);
  assert.ok(speedForHeight(0, EXPERT) >= speedForHeight(0) * 1.4);
  assert.ok(EXPERT.speed.perCup > NORMAL.speed.perCup);
  for (let height = 0; height <= 100; height++) {
    assert.ok(speedForHeight(height, EXPERT) > speedForHeight(height), `height ${height}`);
  }
  const capped = (rules) => (rules.speed.max - rules.speed.start) / rules.speed.perCup;
  assert.ok(capped(EXPERT) < capped(NORMAL) * 0.7);
  assert.equal(phaseForHeight(10, EXPERT), "steady");
  assert.equal(phaseForHeight(10), "opening");
  assert.equal(phaseForHeight(25, EXPERT), "rush");
});

test("expert's cup and tray are narrower, and stay on the grid", () => {
  assert.ok(EXPERT.startWidth < START_WIDTH);
  assert.equal(EXPERT.startWidth % 2, 0);
  const tray = traySpan(EXPERT);
  assert.ok(Number.isInteger(tray.left));
  assert.equal(tray.width, EXPERT.startWidth + 4);
  assert.equal(sliderWidth(tray, EXPERT), EXPERT.startWidth);
  const first = dropCup(tray, -EXPERT.startWidth / 2, EXPERT.startWidth, { window: 0.3, px: 5 });
  assert.equal(first.kind, "perfect");
  assert.deepEqual(first.placed, { left: -EXPERT.startWidth / 2, width: EXPERT.startWidth });
});

test("normal alternates sides at the height's speed; expert varies side and pace by seed", () => {
  for (let height = 0; height < 20; height++) {
    assert.deepEqual(slideFor(height, NORMAL, 99), { fromLeft: height % 2 === 0, speed: speedForHeight(height) });
  }
  const sides = new Set();
  let slower = 0;
  let faster = 0;
  for (let height = 0; height < 200; height++) {
    const slide = slideFor(height, EXPERT, 1234);
    const base = speedForHeight(height, EXPERT);
    assert.ok(slide.speed >= base * (1 - EXPERT.vary) - 1e-9 && slide.speed <= base * (1 + EXPERT.vary) + 1e-9);
    sides.add(slide.fromLeft);
    if (slide.speed < base * 0.93) slower++;
    if (slide.speed > base * 1.07) faster++;
    // The same seed and height always slide the same way.
    assert.deepEqual(slideFor(height, EXPERT, 1234), slide);
  }
  assert.equal(sides.size, 2);
  assert.ok(slower > 30 && faster > 30, `${slower} slower, ${faster} faster`);
  // A different run slides differently.
  const runA = Array.from({ length: 20 }, (_, height) => slideFor(height, EXPERT, 1).fromLeft);
  const runB = Array.from({ length: 20 }, (_, height) => slideFor(height, EXPERT, 2).fromLeft);
  assert.notDeepEqual(runA, runB);
});

// --- Share ----------------------------------------------------------------------

test("a shared run is a little tower: newest row on top, ending on the fall", () => {
  const kinds = ["perfect", "cut", "close", "clean", "perfect", "perfect", "perfect", "cut", "perfect", "perfect", "cut", "miss"];
  assert.deepEqual(shareTower(kinds), ["🟧🟥", "🟨🟧⬜⬜🟨🟨🟨🟧🟨🟨"]);
  assert.deepEqual(shareTower(["miss"]), ["🟥"]);
  const tall = Array.from({ length: 57 }, (_, index) => (index === 56 ? "miss" : index % 3 ? "perfect" : "cut"));
  const lines = shareTower(tall);
  assert.equal(lines.length, 4);
  assert.ok(lines[0].endsWith("🟥"));
  for (const line of lines) assert.ok([...line].length <= 10);
});
