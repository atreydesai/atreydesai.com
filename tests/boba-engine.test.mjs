import assert from "node:assert/strict";
import test from "node:test";

import {
  CATCH_RULES,
  PLAYFIELD_EDGE,
  bounceHorizontal,
  catchGolden,
  catchRules,
  clampSpawnCenter,
  createLives,
  difficultyAt,
  dropPearl,
  formatShift,
  intensityAt,
  isFairLanding,
  isGoldenSpawn,
  isPerfectCatch,
  phaseForIntensity,
  planThrow,
  pointsForCatch,
  predictLanding,
  reachSeconds,
  shiftCells,
  throwVelocity,
  volleySize,
} from "../src/lib/boba-engine.js";

const normal = CATCH_RULES.normal;
const expert = CATCH_RULES.expert;

/** A small seeded generator, so random throws are repeatable. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("there is no clock: the ramp climbs to a cap and stays there", () => {
  assert.equal(intensityAt(0, normal), 0);
  assert.ok(intensityAt(60, normal) > 0.25 && intensityAt(60, normal) < 0.35);
  assert.equal(intensityAt(210, normal), 1);
  assert.equal(intensityAt(3600, normal), 1);
  assert.deepEqual(difficultyAt(210, normal), difficultyAt(3600, normal));
  // Negative time (before the countdown ends) is the start.
  assert.equal(intensityAt(-5, normal), 0);
});

test("music phases follow the ramp, not a clock", () => {
  assert.equal(phaseForIntensity(0), "opening");
  assert.equal(phaseForIntensity(0.199), "opening");
  assert.equal(phaseForIntensity(0.2), "steady");
  assert.equal(phaseForIntensity(0.549), "steady");
  assert.equal(phaseForIntensity(0.55), "rush");
  assert.equal(difficultyAt(30, normal).phase, "opening");
  assert.equal(difficultyAt(90, normal).phase, "steady");
  assert.equal(difficultyAt(150, normal).phase, "rush");
  assert.equal(difficultyAt(100000, normal).phase, "rush");
});

test("every part of the difficulty only gets harder with time", () => {
  let previous = difficultyAt(0, normal);
  for (let second = 1; second <= 400; second++) {
    const next = difficultyAt(second, normal);
    assert.ok(next.gravity >= previous.gravity, `gravity at ${second}s`);
    assert.ok(next.spawnInterval <= previous.spawnInterval, `interval at ${second}s`);
    assert.ok(next.maxActive >= previous.maxActive, `cups at ${second}s`);
    assert.ok(next.spread >= previous.spread, `spread at ${second}s`);
    assert.ok(next.telegraph <= previous.telegraph, `telegraph at ${second}s`);
    assert.ok(next.volleyChance >= previous.volleyChance, `volleys at ${second}s`);
    assert.ok(next.tripleChance >= previous.tripleChance, `triples at ${second}s`);
    assert.ok(next.lobChance >= previous.lobChance, `lobs at ${second}s`);
    assert.ok(next.flickChance >= previous.flickChance, `flicks at ${second}s`);
    previous = next;
  }
});

test("the opening is calm and the cap is brutal", () => {
  const opening = difficultyAt(0, normal);
  assert.equal(opening.gravity, 500);
  assert.equal(opening.spawnInterval, 1.35);
  assert.equal(opening.maxActive, 3);
  assert.equal(opening.volleyChance, 0);
  assert.equal(opening.lobChance, 0);
  assert.equal(opening.flickChance, 0);

  const cap = difficultyAt(210, normal);
  assert.ok(Math.abs(cap.spawnInterval - 0.3) < 1e-9);
  assert.equal(cap.gravity, 1080);
  assert.equal(cap.maxActive, 9);
  assert.ok(cap.volleyChance >= 0.4);
  assert.ok(cap.tripleChance > 0.3);
  assert.ok(cap.telegraph < opening.telegraph);
});

test("expert starts deep into normal's ramp, climbs faster, and goes past its cap", () => {
  assert.equal(catchRules(true), expert);
  assert.equal(catchRules(false), normal);

  // Expert's first second is normal at a minute and three quarters.
  const expertStart = difficultyAt(0, expert);
  const normalLater = difficultyAt(105, normal);
  assert.equal(expertStart.gravity, normalLater.gravity);
  assert.equal(expertStart.maxActive, normalLater.maxActive);
  assert.ok(expertStart.volleyChance > 0);

  // It reaches normal's cap in well under half the time.
  const toCap = (rules) => {
    let second = 0;
    while (intensityAt(second, rules) < 1) second += 1;
    return second;
  };
  assert.ok(toCap(expert) * 2 < toCap(normal));

  // And keeps going past it.
  const expertCap = difficultyAt(3600, expert);
  const normalCap = difficultyAt(3600, normal);
  assert.ok(expertCap.spawnInterval < normalCap.spawnInterval);
  assert.ok(expertCap.gravity > normalCap.gravity);
  assert.ok(expertCap.maxActive > normalCap.maxActive);
  // Less warning at every moment.
  assert.ok(difficultyAt(60, expert).telegraph < difficultyAt(60, normal).telegraph);
});

test("expert's basket is narrower, its perfect is tighter, and pearls don't come back", () => {
  assert.ok(expert.basketWidth <= normal.basketWidth * 0.7);
  assert.ok(expert.perfectRadius < normal.perfectRadius);
  assert.equal(expert.goldensToRestore, 0);
  assert.equal(expert.lives, normal.lives);

  // A catch 10px off centre is perfect in normal, not in expert.
  assert.equal(isPerfectCatch(149, 100, 78, normal.perfectRadius), true);
  assert.equal(isPerfectCatch(137, 100, 54, expert.perfectRadius), false);
  assert.equal(isPerfectCatch(132, 100, 54, expert.perfectRadius), true);
});

test("volleys only start after the opening, and the cap throws pairs and threes", () => {
  const rand = seeded(7);
  const opening = difficultyAt(20, normal);
  for (let i = 0; i < 500; i++) assert.equal(volleySize(opening, rand), 1);

  const cap = difficultyAt(210, normal);
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 4000; i++) counts[volleySize(cap, rand)] += 1;
  assert.ok(counts[2] > 400, `pairs ${counts[2]}`);
  assert.ok(counts[3] > 300, `threes ${counts[3]}`);
  assert.ok(counts[1] > counts[2], "single throws are still the most common");
});

test("every throw peaks at least 150px above the basket, lobs higher, flicks lower", () => {
  const rand = seeded(11);
  const catchLine = 860;
  const kinds = new Set();
  for (const elapsed of [0, 60, 120, 210]) {
    const difficulty = difficultyAt(elapsed, normal);
    for (let i = 0; i < 400; i++) {
      const spawnBottom = 200 + rand() * 620;
      const launch = throwVelocity(difficulty, { spawnBottom, catchLine }, rand);
      kinds.add(launch.kind);
      const apex = spawnBottom - (launch.vy * launch.vy) / (2 * difficulty.gravity);
      assert.ok(apex <= catchLine - 150 + 1e-6, `apex ${apex} at ${elapsed}s`);
      assert.ok(launch.vy < 0, "every cup goes up first");
      if (launch.kind === "lob") assert.ok(spawnBottom - apex >= 140);
      assert.ok(Math.abs(launch.vx) <= (difficulty.spread * 1.35) / 2 + 1e-9);
    }
  }
  assert.deepEqual([...kinds].sort(), ["flick", "lob", "throw"]);
});

test("a landing prediction matches the cup's real flight, bounces and all", () => {
  const rand = seeded(3);
  const sprite = { width: 35, height: 50 };
  const width = 900;
  const catchLine = 820;
  for (let trial = 0; trial < 40; trial++) {
    const gravity = 500 + rand() * 700;
    const body = { x: 50 + rand() * 700, y: 200 + rand() * 300, vx: (rand() - 0.5) * 900, vy: -200 - rand() * 600 };
    const predicted = predictLanding(body, gravity, catchLine, sprite, width);

    const step = 1 / 2000;
    let time = 0;
    const cup = { ...body };
    while (!(cup.vy > 0 && cup.y + sprite.height >= catchLine)) {
      cup.vy += gravity * step;
      cup.x += cup.vx * step;
      cup.y += cup.vy * step;
      bounceHorizontal(cup, sprite.width, width);
      time += step;
    }
    assert.ok(Math.abs(time - predicted.time) < 0.01, `time ${time} vs ${predicted.time}`);
    assert.ok(Math.abs(cup.x + sprite.width / 2 - predicted.center) < 3, `x ${cup.x} vs ${predicted.center}`);
  }
});

test("a cup is only thrown where the basket can get to it in time", () => {
  const basket = 78;
  const earlier = [{ time: 10, center: 200 }];
  // Close enough to fall in the basket together.
  assert.equal(isFairLanding({ time: 10, center: 230 }, earlier, basket), true);
  // Across the page at the same moment: impossible, so not thrown.
  assert.equal(isFairLanding({ time: 10.05, center: 1100 }, earlier, basket), false);
  // Across the page with time to get there.
  const travel = 1100 - 200 - basket / 4;
  assert.equal(isFairLanding({ time: 10 + reachSeconds(travel) + 0.01, center: 1100 }, earlier, basket), true);
  assert.equal(isFairLanding({ time: 10 - reachSeconds(travel) - 0.01, center: 1100 }, earlier, basket), true);
  // Every other landing counts, not just the nearest.
  const crowded = [...earlier, { time: 10.6, center: 1050 }];
  assert.equal(isFairLanding({ time: 10.3, center: 640 }, crowded, basket), false);
  assert.equal(isFairLanding({ time: 10.3, center: 640 }, [], basket), true);
  // Expert's narrower basket catches fewer pairs together.
  assert.equal(isFairLanding({ time: 10, center: 228 }, earlier, basket), true);
  assert.equal(isFairLanding({ time: 10, center: 228 }, earlier, expert.basketWidth), false);
});

/**
 * Plays the cap for `seconds` with a bot that moves exactly as fast as the
 * fairness rule assumes (and no faster), always heading for the next cup to
 * land. Returns what it caught and missed.
 */
function playTheCap(rules, seconds, seed) {
  const rand = seeded(seed);
  const width = 1280;
  const height = 800;
  const sprite = { width: 35, height: 50 };
  const catchLine = height - 70 + 6;
  const field = { catchLine, sprite, viewportWidth: width, basketWidth: rules.basketWidth };
  const reachSpeed = 1 / (reachSeconds(1) - reachSeconds(0));
  const start = 3600; // long past the top of the ramp
  const dt = 1 / 60;
  let now = 0;
  let spawnTimer = 0;
  let basket = width / 2;
  let caught = 0;
  let missed = 0;
  let thrown = 0;
  const waiting = [];
  const cups = [];
  while (now < seconds) {
    now += dt;
    const difficulty = difficultyAt(start + now, rules);
    spawnTimer += dt;
    const inPlay = cups.length + waiting.length;
    if (spawnTimer >= difficulty.spawnInterval) {
      if (inPlay < difficulty.maxActive) {
        spawnTimer -= difficulty.spawnInterval;
        const size = Math.min(volleySize(difficulty, rand), difficulty.maxActive - inPlay);
        for (let i = 0; i < size; i++) {
          waiting.push({ x: 40 + rand() * (width - 115), y: 180 + rand() * 420, remaining: difficulty.telegraph + i * 0.12, held: 0 });
        }
      } else spawnTimer = difficulty.spawnInterval;
    }
    for (let i = 0; i < waiting.length; i++) {
      const spawn = waiting[i];
      spawn.remaining -= dt;
      if (spawn.remaining > 0) continue;
      const others = cups.filter((cup) => cup.landAt > now).map((cup) => ({ time: cup.landAt, center: cup.landCenter }));
      const plan = planThrow(difficulty, spawn, field, others, now, rand);
      if (!plan) {
        spawn.held += 0.08;
        spawn.remaining = 0.08;
        if (spawn.held > 1.2) waiting.splice(i--, 1);
        continue;
      }
      waiting.splice(i--, 1);
      thrown += 1;
      cups.push({ x: spawn.x, y: spawn.y, vx: plan.vx, vy: plan.vy, gravity: difficulty.gravity, landAt: plan.landAt, landCenter: plan.landCenter });
    }
    // Head for the next landing, no faster than the rule's reach speed.
    const next = cups.filter((cup) => cup.landAt > now - dt).sort((a, b) => a.landAt - b.landAt)[0];
    if (next) {
      const gap = next.landCenter - basket;
      basket += Math.sign(gap) * Math.min(Math.abs(gap), reachSpeed * dt);
    }
    const left = basket - rules.basketWidth / 2;
    for (let i = cups.length - 1; i >= 0; i--) {
      const cup = cups[i];
      cup.vy += cup.gravity * dt;
      cup.x += cup.vx * dt;
      cup.y += cup.vy * dt;
      bounceHorizontal(cup, sprite.width, width);
      const bottom = cup.y + sprite.height;
      const center = cup.x + sprite.width / 2;
      if (cup.vy > 0 && bottom - cup.vy * dt <= catchLine && bottom >= catchLine && center >= left && center <= left + rules.basketWidth) {
        cups.splice(i, 1);
        caught += 1;
      } else if (cup.y > height + 10) {
        cups.splice(i, 1);
        missed += 1;
      }
    }
  }
  return { caught, missed, thrown };
}

test("the cap is brutal but fair: a quick enough basket never misses", () => {
  for (const [rules, seed] of [
    [normal, 1],
    [normal, 2],
    [expert, 3],
    [expert, 4],
  ]) {
    const { caught, missed } = playTheCap(rules, 240, seed);
    assert.equal(missed, 0, `${rules.expert ? "expert" : "normal"} seed ${seed} missed ${missed}`);
    // Brutal: around three cups a second, for four minutes straight.
    assert.ok(caught / 240 > 2.5, `only ${(caught / 240).toFixed(2)} cups a second`);
  }
});

test("a planned throw is always fair to the cups already in the air", () => {
  const rand = seeded(5);
  const field = { catchLine: 736, sprite: { width: 35, height: 50 }, viewportWidth: 1280, basketWidth: 78 };
  const difficulty = difficultyAt(600, normal);
  const others = [
    { time: 0.5, center: 200 },
    { time: 1.3, center: 640 },
    { time: 2.6, center: 1000 },
  ];
  let planned = 0;
  for (let i = 0; i < 300; i++) {
    const plan = planThrow(difficulty, { x: 100 + rand() * 1000, y: 200 + rand() * 300 }, field, others, 0, rand);
    if (!plan) continue;
    planned += 1;
    assert.ok(isFairLanding({ time: plan.landAt, center: plan.landCenter }, others, 78));
  }
  assert.ok(planned > 100, "most links find a fair arc");
  // Nowhere fair to land: it waits.
  const wall = Array.from({ length: 40 }, (_, i) => ({ time: 0.3 + i * 0.1, center: (i % 2) * 1200 + 40 }));
  assert.equal(planThrow(difficulty, { x: 600, y: 300 }, field, wall, 0, rand), null);
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
  assert.equal(isGoldenSpawn(20), true);
  assert.equal(pointsForCatch(false, false), 1);
  assert.equal(pointsForCatch(false, true), 2);
  assert.equal(pointsForCatch(true, false), 3);
  assert.equal(pointsForCatch(true, true), 4);
});

test("the run ends with the last pearl, and three goldens in a row win one back", () => {
  let lives = createLives(normal);
  assert.deepEqual(lives, { left: 3, max: 3, goldens: 0 });

  // At full pearls a golden cup is only points.
  let result = catchGolden(lives, normal);
  assert.equal(result.restored, false);
  assert.equal(result.lives.goldens, 0);

  lives = dropPearl(lives);
  assert.equal(lives.left, 2);
  result = catchGolden(lives, normal);
  assert.equal(result.toGo, 2);
  result = catchGolden(result.lives, normal);
  assert.equal(result.toGo, 1);
  // A miss in between breaks the run.
  lives = dropPearl(result.lives);
  assert.equal(lives.left, 1);
  assert.equal(lives.goldens, 0);

  result = catchGolden(lives, normal);
  result = catchGolden(result.lives, normal);
  result = catchGolden(result.lives, normal);
  assert.equal(result.restored, true);
  assert.equal(result.lives.left, 2);
  assert.equal(result.lives.goldens, 0);

  // Never more than the run started with.
  lives = { left: 3, max: 3, goldens: 2 };
  assert.equal(catchGolden(lives, normal).lives.left, 3);

  // Expert never wins one back.
  lives = dropPearl(createLives(expert));
  for (let i = 0; i < 6; i++) {
    result = catchGolden(lives, expert);
    assert.equal(result.restored, false);
    lives = result.lives;
  }
  assert.equal(lives.left, 2);

  lives = dropPearl(dropPearl(dropPearl(createLives(normal))));
  assert.equal(lives.left, 0);
  assert.equal(dropPearl(lives).left, 0);
});

test("time on shift reads as minutes and seconds", () => {
  assert.equal(formatShift(0), "0:00");
  assert.equal(formatShift(9.9), "0:09");
  assert.equal(formatShift(75), "1:15");
  assert.equal(formatShift(3725), "62:05");
  assert.equal(formatShift(-3), "0:00");
});

test("the shared strip is one square per fifteen seconds, showing its biggest moment", () => {
  const cells = shiftCells(
    [
      { time: 20, kind: "golden" },
      { time: 40, kind: "drop" },
      { time: 41, kind: "golden" },
      { time: 70, kind: "golden" },
      { time: 72, kind: "back" },
      { time: 100, kind: "drop" },
    ],
    100,
  );
  assert.deepEqual(cells, ["🧋", "🌟", "💥", "🧋", "⚫", "🧋", "💥"]);
  // A drop at the very end lands in the last square.
  assert.deepEqual(shiftCells([{ time: 30, kind: "drop" }], 30), ["🧋", "💥"]);
  assert.deepEqual(shiftCells([], 0), ["🧋"]);
  // A long run stretches the squares so it never needs more than thirty.
  assert.ok(shiftCells([], 1800).length <= 30);
  assert.ok(shiftCells([], 420).length === 28);
});
