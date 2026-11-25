import assert from "node:assert/strict";
import test from "node:test";

import { clamp, damp, lerp, quantizeUp, smooth, smoothstep, snap } from "../src/lib/arcade/core/math.ts";
import { createRng, hash2, ihash, nextRandom, noise2 } from "../src/lib/arcade/core/rng.ts";
import { hexToRgb, mixHex, mixRgb, rgbToHex } from "../src/lib/arcade/core/color.ts";
import { BAYER_4, bayer, paintBands } from "../src/lib/arcade/core/dither.ts";
import { createPool } from "../src/lib/arcade/core/pool.ts";
import { createRng as landerRng } from "../src/lib/arcade/lander-engine.js";

test("the seeded generator is bit for bit the one the games already used", () => {
  // mulberry32 as the lander engine wrote it, before the core existed.
  for (const seed of [1, 7, 25, 123456, 2 ** 31 - 1]) {
    const a = createRng(seed);
    const b = landerRng(seed);
    for (let i = 0; i < 50; i++) assert.equal(a(), b());
  }
  const gen = { s: 9 };
  const first = nextRandom(gen);
  assert.equal(first, createRng(9)());
  assert.equal(gen.s, (9 + 0x6d2b79f5) | 0);
});

test("hashes are pinned, since every seeded scene depends on them", () => {
  assert.equal(ihash(0), 0.11478774505667388);
  assert.equal(hash2(3, 4), ihash(Math.imul(3, 73856093) ^ Math.imul(4, 19349663)));
  for (let i = 0; i < 100; i++) {
    const n = noise2(i * 0.37, i * 0.71);
    assert.ok(n >= 0 && n < 1);
  }
  assert.equal(noise2(2, 5), hash2(2, 5));
});

test("math helpers", () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(lerp(2, 4, 0.5), 3);
  assert.equal(smooth(0.5), 0.5);
  assert.equal(smoothstep(0, 10, 20), 1);
  assert.equal(snap(9, 4), 8);
  assert.equal(quantizeUp(0.01, 4), 0.25);
  assert.ok(Math.abs(damp(0, 1, 10, 100) - 1) < 1e-9);
});

test("colours mix the way the scenes did", () => {
  assert.deepEqual(hexToRgb("#e85d4c"), [232, 93, 76]);
  assert.equal(rgbToHex([232, 93, 76]), "#e85d4c");
  assert.deepEqual(mixRgb([0, 0, 0], [255, 255, 255], 0.5), [128, 128, 128]);
  assert.equal(mixHex("#000000", "#ffffff", 2), "#ffffff");
});

test("bands dither only across the middle of each join", () => {
  assert.equal(BAYER_4.length, 16);
  assert.ok(bayer(0, 0) > 0 && bayer(3, 3) < 1);
  const width = 8;
  const height = 20;
  const data = new Uint8ClampedArray(width * height * 4);
  paintBands(data, width, height, [[10, 0, 0], [20, 0, 0], [30, 0, 0]], [0, 10, 16]);
  const row = (y) => Array.from({ length: width }, (_, x) => data[(y * width + x) * 4]);
  assert.ok(row(0).every((v) => v === 10));
  assert.ok(row(9).every((v) => v === 20), "the end of a band is the next colour");
  assert.ok(row(19).every((v) => v === 30), "past the last stop is the last band");
  assert.ok(new Set(row(5)).size === 2, "the middle of a join is dithered");
});

test("a pool reuses its items and retires the dead", () => {
  const pool = createPool(3, () => ({ life: 0 }));
  for (let i = 0; i < 5; i++) {
    const p = pool.spawn();
    if (p) p.life = i + 1;
  }
  assert.equal(pool.count, 3);
  pool.step((p) => --p.life > 0);
  assert.equal(pool.count, 2);
});
