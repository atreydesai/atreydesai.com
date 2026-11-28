import test from "node:test";
import assert from "node:assert/strict";
import { layoutTree } from "../src/lib/components/arcade/order-up/book/tree-layout.ts";

/** A tree shaped like a survival game's: two roots, a three-way split, a long chain and a node needing two things. */
const SAMPLE = [
  { id: "kettle", requires: [] },
  { id: "batch", requires: ["kettle"] },
  { id: "precise", requires: ["kettle"] },
  { id: "cold", requires: ["kettle"] },
  { id: "urn", requires: ["batch"] },
  { id: "gauge", requires: ["precise"] },
  { id: "gauge-2", requires: ["gauge"] },
  { id: "tap", requires: [] },
  { id: "chiller", requires: ["tap"] },
  { id: "cold-tower", requires: ["cold", "chiller"] },
];

test("no two tiles share a cell, and every tile sits below everything it needs", () => {
  const { placed, cols, rows } = layoutTree(SAMPLE);
  const cells = new Set();
  for (const p of placed.values()) {
    const key = p.col + "," + p.row;
    assert.ok(!cells.has(key), "two tiles at " + key);
    cells.add(key);
    assert.ok(p.col >= 0 && p.col < cols && p.row >= 0 && p.row < rows, p.id + " inside the grid");
  }
  for (const n of SAMPLE) for (const r of n.requires) assert.ok(placed.get(n.id).row > placed.get(r).row, n.id + " below " + r);
});

test("every requirement has a right-angled wire from the foot of the one needed to the top of the one needing it", () => {
  const { placed, wires } = layoutTree(SAMPLE);
  const edges = SAMPLE.flatMap((n) => n.requires.map((r) => r + ">" + n.id)).sort();
  assert.deepEqual(wires.map((w) => w.from + ">" + w.to).sort(), edges, "the sample has no implied needs, so every need is wired");
  for (const w of wires) {
    const from = placed.get(w.from),
      to = placed.get(w.to);
    assert.deepEqual(w.points[0], [from.col + 0.5, from.row + 0.72]);
    assert.deepEqual(w.points.at(-1), [to.col + 0.5, to.row]);
    for (let i = 1; i < w.points.length; i++)
      assert.ok(w.points[i][0] === w.points[i - 1][0] || w.points[i][1] === w.points[i - 1][1], "only straight runs");
  }
  assert.equal(wires.filter((w) => w.to === "cold-tower" && !w.primary).length, 1, "a second need is drawn quieter");
});

test("a parent with one child stands straight over it, and the roots keep their own columns", () => {
  const { placed } = layoutTree(SAMPLE);
  assert.equal(placed.get("gauge").col, placed.get("gauge-2").col);
  const first = SAMPLE.slice(0, 7).map((n) => placed.get(n.id).col);
  const second = ["tap", "chiller"].map((id) => placed.get(id).col);
  assert.ok(Math.max(...first) < Math.min(...second), "the second root's columns come after the first's");
});

test("a cycle in the tree is refused rather than drawn", () => {
  assert.throws(() => layoutTree([{ id: "a", requires: ["b"] }, { id: "b", requires: ["a"] }]), /cycle/);
});

test("a need already implied further up the chain gets no wire, and a node hangs under its deepest need", () => {
  const tree = [
    { id: "bench", requires: [] },
    { id: "coupling", requires: ["bench"] },
    { id: "valve", requires: ["coupling"] },
    { id: "pump", requires: ["coupling"] },
    { id: "kit", requires: ["bench", "valve", "pump"] },
  ];
  const { placed, wires } = layoutTree(tree);
  assert.deepEqual(wires.filter((w) => w.to === "kit").map((w) => w.from).sort(), ["pump", "valve"]);
  assert.ok([placed.get("valve").col, placed.get("pump").col].includes(placed.get("kit").col) || placed.get("kit").row === 3);
});

