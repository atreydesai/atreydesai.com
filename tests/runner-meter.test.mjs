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
  teaCellLit,
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

/** Whether two boxes in cells share any cell. */
const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const twoRows of [false, true]) {
  test(`the meter's layout holds together (${twoRows ? "two rows" : "one row"})`, () => {
    const layout = meterLayout(twoRows);
    assert.equal(layout.cubes.length, CUBES);
    // Everything inside the chip's padding.
    const inside = (x, y, w, h) =>
      x >= METER_PAD && y >= METER_PAD && x + w <= layout.width - METER_PAD && y + h <= layout.height - METER_PAD;
    assert.ok(inside(layout.cup.x, layout.cup.y, layout.cup.w, layout.cup.h));
    for (const cube of layout.cubes) assert.ok(inside(cube.x, cube.y, CUBE, CUBE));
    // The word fits in the chip beside or over the cubes, clear of the cup; so do the cubes.
    assert.ok(inside(layout.labelBox.x, layout.labelBox.y, layout.labelBox.w, layout.labelBox.h), "the word runs out of the chip");
    assert.ok(!meets(layout.labelBox, layout.cup), "the word sits on the cup");
    for (const cube of layout.cubes) assert.ok(!meets({ ...cube, w: CUBE, h: CUBE }, layout.cup), "a cube sits on the cup");
    // The sugar's box (lit and ringed in its lesson) holds every cube and none of the cup.
    for (const cube of layout.cubes) assert.ok(cube.x >= layout.sugar.x && cube.y >= layout.sugar.y && cube.x + CUBE <= layout.sugar.x + layout.sugar.w && cube.y + CUBE <= layout.sugar.y + layout.sugar.h);
    assert.ok(!meets(layout.sugar, layout.cup), "the sugar's box takes in the cup");
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
  // Fits between a 375 px phone's pads at the scene's 4 px cell, with room either side,
  // and stands no taller than the jump and rush pads stacked beside it.
  assert.ok(touch.width * 4 <= 375 - 20 - 80 - 20 - 104 - 16);
  assert.ok(touch.height * 4 <= 88 + 12 + 56);
});

test("the meter reads at a glance: big cubes and a big cup", () => {
  // At the scene's 4 px cell a cube is 20 px a side and the cup 36 px across.
  assert.ok(CUBE >= 5);
  assert.ok(METER_CUP[0].length >= 9 && METER_CUP.length >= 11);
  // On a wide screen the chip is at least 300 px across, every cube in one row.
  const wide = meterLayout(false);
  assert.ok(wide.width * 4 >= 300);
  assert.equal(new Set(wide.cubes.map((cube) => cube.y)).size, 1);
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

test("any tea at all lights a cell, and each half row above the bottom adds some", () => {
  const lit = (halfRows) => {
    let count = 0;
    METER_CUP.forEach((line, row) => [...line].forEach((_, col) => (count += teaCellLit(halfRows, row, col) ? 1 : 0)));
    return count;
  };
  assert.equal(lit(0), 0);
  assert.ok(lit(1) > 0);
  // The bottom row is a single cell, so its half and its whole are the same;
  // every half row above it adds tea.
  for (let halfRows = 3; halfRows <= 12; halfRows++) {
    assert.ok(lit(halfRows) > lit(halfRows - 1), `half row ${halfRows} adds nothing`);
  }
  const all = METER_CUP.join("").replace(/[^1-6]/g, "").length;
  assert.equal(lit(12), all);
});
