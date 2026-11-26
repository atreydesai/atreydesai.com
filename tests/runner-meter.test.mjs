import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CUBE,
  CUBES,
  CUBE_EMPTY,
  CUBE_FULL,
  GLYPHS,
  KEYCAP_X,
  LABEL_ROWS,
  METER_CUP,
  METER_PAD,
  meterLayout,
  meterWord,
  sugarReading,
  teaHalfRows,
  wordWidth,
} from "../src/lib/arcade/runner-meter.js";

test("the meter's cup and cubes are whole grids", () => {
  for (const row of METER_CUP) assert.equal(row.length, METER_CUP[0].length);
  for (const grid of [CUBE_FULL, CUBE_EMPTY]) {
    assert.equal(grid.length, CUBE);
    for (const row of grid) assert.equal(row.length, CUBE);
  }
  for (const row of KEYCAP_X) assert.equal(row.length, KEYCAP_X[0].length);
  assert.equal(KEYCAP_X.length, LABEL_ROWS);
  // Six tea rows, each numbered, and pearls at the bottom.
  const digits = new Set(METER_CUP.join("").replace(/[^1-6]/g, ""));
  assert.deepEqual([...digits].sort(), ["1", "2", "3", "4", "5", "6"]);
});

test("every word the meter prints is in the pixel alphabet", () => {
  for (const word of [meterWord(false), meterWord(true)]) {
    for (const letter of word) assert.ok(GLYPHS[letter], `missing glyph ${letter}`);
  }
});

for (const twoRows of [false, true]) {
  test(`the meter's layout holds together (${twoRows ? "two rows" : "one row"})`, () => {
    const layout = meterLayout(twoRows);
    assert.equal(layout.cubes.length, CUBES);
    // Everything inside the chip's padding.
    const inside = (x, y, w, h) =>
      x >= METER_PAD && y >= METER_PAD && x + w <= layout.width - METER_PAD && y + h <= layout.height - METER_PAD;
    assert.ok(inside(layout.cup.x, layout.cup.y, layout.cup.w, layout.cup.h));
    for (const cube of layout.cubes) assert.ok(inside(cube.x, cube.y, CUBE, CUBE));
    // The longest label, with the keycap after it on a wide screen, fits over the cubes.
    const longest = Math.max(wordWidth(meterWord(false)), wordWidth(meterWord(true)) + (twoRows ? 0 : 2 + KEYCAP_X[0].length));
    assert.ok(longest <= layout.sugar.w, `label ${longest} wider than ${layout.sugar.w}`);
    // The label sits clear above the first row of cubes.
    const firstRow = Math.min(...layout.cubes.map((cube) => cube.y));
    assert.ok(layout.label.y + LABEL_ROWS < firstRow);
    // No two cubes overlap.
    for (let a = 0; a < CUBES; a++) {
      for (let b = a + 1; b < CUBES; b++) {
        const A = layout.cubes[a];
        const B = layout.cubes[b];
        assert.ok(Math.abs(A.x - B.x) >= CUBE + 1 || Math.abs(A.y - B.y) >= CUBE + 1);
      }
    }
  });
}

test("between the pads the cubes take two rows, so the chip is narrower", () => {
  const wide = meterLayout(false);
  const touch = meterLayout(true);
  assert.ok(touch.width < wide.width);
  // Fits between a 375 px phone's pads at the scene's 4 px cell, with room either side.
  assert.ok(touch.width * 4 <= 375 - 20 - 80 - 20 - 104 - 16);
});

test("the tea shows in half rows, and only an empty cup shows none", () => {
  assert.equal(teaHalfRows(0), 0);
  assert.equal(teaHalfRows(-1), 0);
  assert.equal(teaHalfRows(1), 12);
  assert.equal(teaHalfRows(0.001), 1);
  assert.equal(teaHalfRows(0.5), 6);
  for (let f = 0.01; f <= 1; f += 0.01) {
    const shown = teaHalfRows(f);
    assert.ok(shown >= 1 && shown <= 12);
    assert.ok(shown >= teaHalfRows(f - 0.01));
  }
});

test("the sugar reads as the HUD did: filled by the pearls, emptied by a rush", () => {
  const full = 100;
  const rushTime = 6;
  assert.deepEqual(sugarReading({ sugar: 0, rush: 0 }, full, rushTime), { cubes: 0, ready: false, rushing: false });
  assert.deepEqual(sugarReading({ sugar: 39, rush: 0 }, full, rushTime), { cubes: 3, ready: false, rushing: false });
  assert.deepEqual(sugarReading({ sugar: 100, rush: 0 }, full, rushTime), { cubes: 10, ready: true, rushing: false });
  assert.deepEqual(sugarReading({ sugar: 0, rush: 6 }, full, rushTime), { cubes: 10, ready: false, rushing: true });
  assert.deepEqual(sugarReading({ sugar: 0, rush: 0.1 }, full, rushTime), { cubes: 1, ready: false, rushing: true });
  assert.equal(meterWord(false), "sugar");
  assert.equal(meterWord(true), "rush");
});
