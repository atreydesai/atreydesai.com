// The header morphs the wordmark into the monogram without GSAP by playing
// outlines that MorphSVG rewrote ahead of time (scripts/wordmark-morph.mjs).
// If the wordmark changes, those must be regenerated, or the header would
// morph from a letter that is no longer drawn.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { morphSource } from "../scripts/wordmark-morph.mjs";

const NUMBER = /-?\d*\.?\d+(?:e-?\d+)?/g;

test("the precomputed morph matches the current wordmark", async () => {
  const committed = await readFile(new URL("../src/lib/wordmark-morph.ts", import.meta.url), "utf8");
  assert.equal(committed, morphSource(), "run: node scripts/wordmark-morph.mjs");
});

test("each morph pair can be interpolated number by number", async () => {
  const { MORPH_A, MORPH_D } = await import("../src/lib/wordmark-morph.ts");
  for (const [from, to] of [MORPH_A, MORPH_D]) {
    assert.equal(from.replace(NUMBER, "#"), to.replace(NUMBER, "#"));
  }
});
