import assert from "node:assert/strict";
import test from "node:test";

import { latheSlices, quantizeTurn, stackGrid } from "../src/lib/arcade/core/sprite-stack.ts";

// A small car-like block: 3 slices of 4 x 6, each a different letter so
// every cell can be traced back to its slice.
const slice = (ch) => Array.from({ length: 6 }, (_, y) => (y === 0 ? `${ch}${ch}..` : ch.repeat(4)));
const SLICES = [slice("a"), slice("b"), slice("c")];

/** The stack pasted by hand: each slice one row above the last, later over earlier. */
function pasted(slices) {
  const h = slices[0].length;
  const w = slices[0][0].length;
  const lift = slices.length - 1;
  const rows = Array.from({ length: h + lift }, () => Array(w).fill("."));
  slices.forEach((s, z) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (s[y][x] !== ".") rows[lift - z + y][x] = s[y][x];
  });
  return rows.map((r) => r.join(""));
}

test("straight down and unturned, a stack is exactly the slices pasted one row apart", () => {
  const { grid } = stackGrid(SLICES, { squash: 1, turn: 0 });
  assert.equal(grid[0].length, 4);
  assert.equal(grid.length, 6 + 2);
  assert.deepEqual(grid, pasted(SLICES));
});

test("a slanted camera squashes it, a quarter turn swaps its width for the slice height", () => {
  const flat = stackGrid(SLICES, { squash: 1 });
  const slanted = stackGrid(SLICES, { squash: 0.75 });
  assert.ok(slanted.grid.length < flat.grid.length);
  const turned = stackGrid(SLICES, { squash: 1, turn: Math.PI / 2 });
  assert.equal(turned.grid[0].length, 6);
});

test("more spacing makes it taller; no spacing draws it flat with the top slice over the rest", () => {
  assert.ok(stackGrid(SLICES, { spacing: 2 }).grid.length > stackGrid(SLICES, { spacing: 1 }).grid.length);
  const flat = stackGrid(SLICES, { squash: 1, spacing: 0 });
  assert.equal(flat.grid.length, 6);
  assert.deepEqual(flat.grid, SLICES[2]);
});

test("the outline goes once around the finished stack, never through it", () => {
  const { grid } = stackGrid(SLICES, { squash: 1, outline: "O" });
  assert.equal(grid.length, 8 + 2);
  assert.equal(grid[0].length, 4 + 2);
  for (let y = 1; y < grid.length - 1; y++) {
    const inner = grid[y].slice(1, -1);
    // Inside the body (below the notched top rows) there is no outline.
    if (y > 3) assert.ok(!inner.includes("O"), `row ${y} has an outline inside: ${grid[y]}`);
  }
});

test("a round object is the same from every turn, apart from what isn't round", () => {
  const cup = latheSlices(
    [
      { r: 3, fill: "t" },
      { r: 3.5, fill: "t" },
      { r: 4, fill: "l" },
    ],
    9,
  );
  const a = stackGrid(cup, { turn: 0 }).grid;
  const b = stackGrid(cup, { turn: quantizeTurn(Math.PI / 2) }).grid;
  assert.equal(a.length, b.length);
  assert.equal(a[0].length, b[0].length);
});
