import assert from "node:assert/strict";
import test from "node:test";

import { AFTER_HOURS, ROOMS, createWorld, roomAt } from "../src/lib/arcade/spill-engine.js";
import {
  DIGITS,
  FIGURE_DIGITS,
  GAUGE_ROWS,
  GLYPHS,
  LABEL_ROWS,
  MIN_COLUMNS,
  WORDS,
  figureWidth,
  gaugeFit,
  gaugeLayout,
  gaugeReading,
  topLine,
  tubeColumns,
  wordWidth,
} from "../src/lib/arcade/spill-gauge.js";
import { LOW_SHARE } from "../src/lib/arcade/spill-lessons.js";

const fresh = () => ({ rest: 0, draftTo: 0, marks: [] });

test("every word and figure the gauge prints is in the pixel alphabet, at the alphabet's height", () => {
  for (const word of Object.values(WORDS)) {
    for (const letter of word) assert.ok(GLYPHS[letter], `${word}: ${letter}`);
  }
  for (const [digit, glyph] of Object.entries(DIGITS)) {
    assert.equal(glyph.length, LABEL_ROWS, digit);
    for (const row of glyph) assert.equal(row.length, 3, `${digit} is three cells wide, so figures keep their width`);
  }
});

test("every room's straw, in every mode and after hours, prints in three digits", () => {
  for (const expert of [false, true]) {
    for (let index = 0; index < AFTER_HOURS + 32; index++) {
      const budget = createWorld(roomAt(index, 7, expert)).budget;
      assert.ok(String(Math.round(budget)).length <= FIGURE_DIGITS, `room ${index}: ${budget}`);
    }
  }
});

test("the top line fits across the narrowest chip, low and all", () => {
  const layout = gaugeLayout(MIN_COLUMNS);
  for (const reading of [
    { figure: 999, state: "low" },
    { figure: 0, state: "out" },
    { figure: 120, state: "ok" },
  ]) {
    const line = topLine(reading, layout.right);
    const labelEnd = layout.label.x + wordWidth(WORDS.label);
    for (const entry of line) {
      assert.ok(entry.x >= labelEnd + 1, `${entry.text} clears the label`);
      const width = entry.digits ? figureWidth(entry.text.length) : wordWidth(entry.text);
      assert.ok(entry.x + width <= layout.right, `${entry.text} ends inside the chip`);
    }
  }
  // A narrower box is never laid out narrower than the line needs.
  assert.equal(gaugeLayout(10).width, MIN_COLUMNS);
});

test("the chip takes the biggest cell its box allows, and says when none fits", () => {
  assert.deepEqual(gaugeFit(320, GAUGE_ROWS * 4), { unit: 4, columns: 80 });
  // A box too narrow for four-pixel cells drops to three.
  assert.deepEqual(gaugeFit(MIN_COLUMNS * 4 - 8, GAUGE_ROWS * 4), { unit: 3, columns: Math.floor((MIN_COLUMNS * 4 - 8 + 0.5) / 3) });
  // So does one too short.
  assert.equal(gaugeFit(400, GAUGE_ROWS * 3).unit, 3);
  assert.equal(gaugeFit(MIN_COLUMNS * 3 - 4, GAUGE_ROWS * 4), null);
});

test("the gauge says low under a fifth and out when it is gone, never by colour alone", () => {
  assert.equal(gaugeReading(100, 50, 0, LOW_SHARE).state, "ok");
  assert.equal(gaugeReading(100, 81, 0, LOW_SHARE).state, "low");
  assert.equal(gaugeReading(100, 70, 11, LOW_SHARE).state, "low", "the stroke being drawn counts");
  assert.equal(gaugeReading(100, 99.6, 0, LOW_SHARE).state, "out");
  assert.equal(gaugeReading(100, 120, 0, LOW_SHARE).left, 0);
  // Low prints the word; out prints it in place of the figure.
  assert.ok(topLine({ figure: 12, state: "low" }, 60).some((entry) => entry.text === WORDS.low));
  assert.ok(!topLine({ figure: 50, state: "ok" }, 60).some((entry) => entry.text === WORDS.low));
  assert.deepEqual(
    topLine({ figure: 0, state: "out" }, 60).map((entry) => entry.text),
    [WORDS.out],
  );
});

test("the straw's columns add up: left, the stroke being drawn, then each straw at its cost", () => {
  const out = fresh();
  tubeColumns(40, 100, 50, 10, [25, 15], out);
  assert.equal(out.rest, 20);
  assert.equal(out.draftTo, 24);
  assert.deepEqual(out.marks, [34, 40]);
  // Nothing spent: all straw.
  tubeColumns(40, 100, 100, 0, [], out);
  assert.equal(out.rest, 40);
  assert.equal(out.draftTo, 40);
  assert.deepEqual(out.marks, []);
  // A sliver of straw left still shows, and a sliver of stroke too.
  tubeColumns(40, 100, 0.6, 0.6, [98.8], out);
  assert.equal(out.rest, 1);
  assert.equal(out.draftTo, 2);
  assert.deepEqual(out.marks, [40]);
  // Out: nothing left, the spent part reaches the end.
  tubeColumns(40, 100, 0, 0, [60, 40], out);
  assert.equal(out.rest, 0);
  assert.deepEqual(out.marks, [24, 40]);
  // Marks never run backwards, however small a straw.
  tubeColumns(10, 300, 100, 0, [0.2, 0.1, 199.7], out);
  for (let i = 1; i < out.marks.length; i++) assert.ok(out.marks[i] >= out.marks[i - 1]);
  assert.equal(out.marks.at(-1), 10);
});

test("the straw columns cover a real room's straws exactly", () => {
  for (const room of ROOMS.slice(0, 6)) {
    const budget = createWorld(room).budget;
    const spent = room.solution.strokes.map(([[ax, ay], [bx, by]]) => Math.hypot(bx - ax, by - ay));
    const used = spent.reduce((sum, length) => sum + length, 0);
    const out = fresh();
    tubeColumns(48, budget, Math.max(0, budget - used), 0, spent, out);
    assert.ok(out.rest <= 48 && out.draftTo >= out.rest);
    if (budget - used >= 0.5) assert.equal(out.marks.at(-1), 48, room.id);
  }
});
