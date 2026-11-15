import assert from "node:assert/strict";
import test from "node:test";

import { CRITIC, REGULARS } from "../src/lib/arcade/orders-engine.js";
import {
  CAST,
  FACES,
  FIGURE_ABOVE,
  FIGURE_H,
  FIGURE_W,
  LOOKS,
  dropFor,
  figure,
  lookFor,
} from "../src/lib/arcade/orders-guests.js";

test("every regular and the critic has a written look", () => {
  assert.equal(CAST.length, REGULARS.length + 1);
  for (const name of CAST) assert.ok(LOOKS[name], name);
  assert.ok(CAST.includes(CRITIC.name));
  // No two regulars look alike: hair, its colour and what they wear differ somewhere.
  const keys = CAST.map((name) => {
    const look = LOOKS[name];
    return `${look.hair}|${look.hairColor}|${[...look.extras].sort().join(",")}|${look.color ?? ""}|${look.shirt ?? ""}`;
  });
  assert.equal(new Set(keys).size, keys.length);
  // Someone who isn't in the cast still gets a look.
  assert.ok(lookFor("a stranger").hair);
});

test("every face is a whole, outlined figure, and the faces differ", () => {
  for (const name of CAST) {
    const grids = new Set();
    for (const face of FACES) {
      const { grid, palette } = figure(name, face);
      assert.equal(grid.length, FIGURE_H, `${name} ${face}`);
      for (const row of grid) assert.equal(row.length, FIGURE_W, `${name} ${face}`);
      for (const cell of grid.join("")) assert.ok(cell === "." || palette[cell], `${name} ${face}: ${cell}`);
      grids.add(grid.join("\n"));
    }
    // Every face reads differently from every other.
    assert.equal(grids.size, FACES.length, name);
  }
});

test("guests stand with most of the figure above the counter", () => {
  assert.ok(FIGURE_ABOVE < FIGURE_H, "the counter hides them from the waist down");
  assert.ok(FIGURE_ABOVE >= 14, "head, shoulders and chest show");
  // The one who can barely see over the counter barely does.
  assert.ok(dropFor("sprout") > 0);
  assert.ok(FIGURE_ABOVE - dropFor("sprout") >= 9, "but their eyes still clear it");
  assert.equal(dropFor("mochi"), 0);
});
