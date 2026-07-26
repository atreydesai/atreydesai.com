import assert from "node:assert/strict";
import test from "node:test";

import {
  GAME_DURATION_SECONDS,
  PLAYFIELD_EDGE,
  bounceHorizontal,
  clampSpawnCenter,
  difficultyForElapsed,
  isGoldenSpawn,
  isPerfectCatch,
  phaseForElapsed,
  pointsForCatch,
  timeRemaining,
} from "../src/lib/boba-engine.js";

test("the sixty-second run has stable phase boundaries", () => {
  assert.equal(phaseForElapsed(0), "opening");
  assert.equal(phaseForElapsed(14.999), "opening");
  assert.equal(phaseForElapsed(15), "steady");
  assert.equal(phaseForElapsed(44.999), "steady");
  assert.equal(phaseForElapsed(45), "rush");
  assert.equal(phaseForElapsed(GAME_DURATION_SECONDS), "rush");
});

test("difficulty rises while spawn intervals shrink", () => {
  const opening = difficultyForElapsed(0);
  const steady = difficultyForElapsed(30);
  const rush = difficultyForElapsed(60);

  assert.ok(opening.gravity < steady.gravity);
  assert.ok(steady.gravity < rush.gravity);
  assert.ok(opening.spawnInterval > steady.spawnInterval);
  assert.ok(steady.spawnInterval > rush.spawnInterval);
  assert.deepEqual(
    [opening.maxActive, steady.maxActive, rush.maxActive],
    [3, 5, 7],
  );
});

test("spawn centers and horizontal bounces remain inside the playfield", () => {
  const width = 800;
  const spriteWidth = 35;
  const leftCenter = clampSpawnCenter(-100, width, spriteWidth);
  const rightCenter = clampSpawnCenter(900, width, spriteWidth);

  assert.equal(leftCenter, PLAYFIELD_EDGE + spriteWidth / 2);
  assert.equal(rightCenter, width - PLAYFIELD_EDGE - spriteWidth / 2);

  const leftBody = bounceHorizontal({ x: -20, vx: -60 }, spriteWidth, width);
  const rightBody = bounceHorizontal({ x: 900, vx: 60 }, spriteWidth, width);
  assert.equal(leftBody.x, PLAYFIELD_EDGE);
  assert.ok(leftBody.vx > 0);
  assert.equal(rightBody.x, width - PLAYFIELD_EDGE - spriteWidth);
  assert.ok(rightBody.vx < 0);
});

test("perfect and golden catches award the intended points", () => {
  assert.equal(isPerfectCatch(139, 100, 78), true);
  assert.equal(isPerfectCatch(152, 100, 78), false);
  assert.equal(isGoldenSpawn(9), false);
  assert.equal(isGoldenSpawn(10), true);
  assert.equal(pointsForCatch(false, false), 1);
  assert.equal(pointsForCatch(false, true), 2);
  assert.equal(pointsForCatch(true, false), 3);
  assert.equal(pointsForCatch(true, true), 4);
});

test("the visible timer counts down and never becomes negative", () => {
  assert.equal(timeRemaining(0), 60);
  assert.equal(timeRemaining(0.2), 60);
  assert.equal(timeRemaining(59.2), 1);
  assert.equal(timeRemaining(60), 0);
  assert.equal(timeRemaining(120), 0);
});
