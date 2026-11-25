import assert from "node:assert/strict";
import test from "node:test";

import { HAND_OFF_SECONDS, SHIFT_SECONDS } from "../src/lib/arcade/orders-engine.js";
import { DRINK_CHARS, TURN_FRAMES, TURN_FROM, drinkGrid, drinkSlices, toppingKey, turnIndex, turnShare } from "../src/lib/arcade/orders-drink.js";

test("the drink is round slices of tea, its toppings, a film, and a straw standing above it", () => {
  const plain = drinkSlices("");
  const pearls = drinkSlices(toppingKey([{ kind: "pearls" }]));
  const mixed = drinkSlices(toppingKey([{ kind: "pudding" }, { kind: "jelly" }]));
  for (const slices of [plain, pearls, mixed]) {
    assert.ok(slices.length >= 12);
    for (const slice of slices) for (const row of slice) for (const ch of row) assert.ok(ch === "." || DRINK_CHARS.includes(ch), ch);
    const flat = slices.map((slice) => slice.join(""));
    assert.ok(flat.some((slice) => slice.includes("F")), "a film on top");
    assert.ok(flat.at(-1).includes("S") && !flat.at(-1).includes("t"), "only the straw above the film");
  }
  // Only the toppings the drink has.
  assert.ok(!/[PDJR]/.test(plain[0].join("")), "a plain drink has none");
  assert.ok(pearls[0].join("").includes("P") && !/[DJR]/.test(pearls[0].join("")));
  assert.ok(/D/.test(mixed.slice(0, 3).flat().join("")) && /J/.test(mixed.slice(0, 3).flat().join("")));
});

test("every turn is a whole, outlined sprite that keeps its straw, stands on its foot, and keeps its size", () => {
  const sizes = new Set();
  for (let index = 0; index < TURN_FRAMES; index++) {
    const { grid, anchorX, foot } = drinkGrid(index, "pearls");
    for (const row of grid) for (const ch of row) assert.ok(ch === "." || DRINK_CHARS.includes(ch));
    assert.ok(grid.join("").includes("S"), `the straw shows at turn ${index}`);
    assert.ok(grid.join("").includes("O"), "outlined");
    assert.ok(anchorX > 0 && anchorX < grid[0].length);
    assert.ok(/[^.]/.test(grid[foot]) && grid.slice(foot + 1).every((row) => !/[^.]/.test(row)), "the foot is the last row drawn");
    sizes.add(grid.filter((row) => /[^.]/.test(row)).length);
  }
  // It turns in place: what shows barely changes height as it goes round.
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 3, [...sizes].join(","));
  assert.notDeepEqual(drinkGrid(0).grid, drinkGrid(TURN_FRAMES / 4).grid, "a quarter turn moves the straw");
  assert.equal(drinkGrid(3, "pearls"), drinkGrid(3, "pearls"), "made once");
});

test("the turn fits inside the hand-off, which the drawing never moves", () => {
  // Whatever the mode or Reduce Motion, a drink is served HAND_OFF_SECONDS after its stamp;
  // the turn starts as the sealer lifts and is done exactly then.
  assert.equal(turnShare(0), 0);
  assert.equal(turnShare(TURN_FROM), 0);
  assert.equal(turnShare(HAND_OFF_SECONDS), 1);
  assert.equal(turnShare(HAND_OFF_SECONDS + 1), 1);
  assert.ok(TURN_FROM > 0 && TURN_FROM < HAND_OFF_SECONDS);
  // So a stamp just before the bell is served before it, perfect or not.
  const stamp = SHIFT_SECONDS - 0.75;
  assert.ok(stamp + HAND_OFF_SECONDS < SHIFT_SECONDS);
  assert.equal(turnIndex(0), 0);
  assert.equal(turnIndex(1), 0);
  assert.equal(turnIndex(0.5), TURN_FRAMES / 2);
  assert.equal(turnIndex(-0.25), (TURN_FRAMES * 3) / 4);
});
