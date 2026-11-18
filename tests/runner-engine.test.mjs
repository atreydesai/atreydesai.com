import assert from "node:assert/strict";
import test from "node:test";

import {
  BARREL_H,
  BARREL_SPEED,
  BARREL_WARNING,
  BOUNCE_SPEED,
  BUFFER_TIME,
  COMBO_WINDOW,
  COYOTE_TIME,
  CRATE_POINTS,
  CRUMBLE_TIME,
  DELIVERY_BASE,
  DRONE_LOW,
  DRONE_SPEED,
  DRY_REFILL,
  EXPERT,
  FULL_CUP,
  FULL_CUP_BONUS,
  GLIDE_FALL,
  GLIDE_TIME,
  HIT_GRACE,
  HOLD_TIME,
  MANTLE,
  MAX_COMBO,
  MAX_LANDING_SPILL,
  MAX_SPARES,
  MAX_TOP,
  MIN_TOP,
  NORMAL,
  PATTERNS,
  PEARLS_PER_CRATE,
  PIGEON_WARNING,
  RESPAWN_GRACE,
  RESPAWN_TIME,
  RUNNER_H,
  RUNNER_W,
  RUSH_MAGNET,
  RUSH_SPEED,
  RUSH_TIME,
  SAFE_LANDING,
  SKYLIGHT_H,
  SLAM_SPILL,
  SLIDE_H,
  SLIDE_TIME,
  SPARE_BONUS,
  SPARE_RADIUS,
  SPEED_RAMP,
  START_SPEED,
  STEAM_PIPE,
  STEAM_PLUME,
  STEAM_W,
  STEP,
  STUMBLE_SLOW,
  SUGAR_FULL,
  SWING_LEN,
  SWING_LOW,
  TOP_SPEED,
  WIRE_H,
  breakdown,
  buildCourse,
  clearRange,
  cloneRun,
  comboMultiplier,
  createRng,
  deliveryPoints,
  difficultyAt,
  fallReach,
  glideReach,
  jumpReach,
  landingSpill,
  newRun,
  patternMin,
  phaseAt,
  runnerBox,
  shareLines,
  speedAt,
  steamPhase,
  step,
  swingBox,
} from "../src/lib/arcade/runner-engine.js";
import { drive, reflex } from "../src/lib/arcade/runner-bot.js";

const H = STEP;
const IDLE = {};
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

// --- Helpers ------------------------------------------------------------------------

/**
 * A hand-built stretch of rooftop with nothing generated after it, for
 * testing one rule at a time. The runner stands on the first roof, holding
 * the spares given (none unless asked).
 */
function stage(roofs, items = [], at = {}) {
  const s = newRun(1);
  s.chunks = [
    {
      id: 0,
      pattern: "test",
      x0: -2000,
      x1: 1e6,
      difficulty: 0,
      speed: START_SPEED,
      roofs: roofs.map((r) => ({ type: "roof", kind: "roof", style: 0, tower: false, sign: false, seed: 0, ...r })),
      items,
      gaps: at.gaps ?? [],
    },
  ];
  s.course.end = 1e9;
  s.spare = at.spare ?? 0;
  Object.assign(s.runner, { x: at.x ?? Math.max(roofs[0].x0 + 40, 100), y: at.y ?? roofs[0].top, grounded: at.y === undefined });
  s.startX = s.runner.x;
  return s;
}

const floor = (top = 100) => [{ x0: -2000, x1: 1e6, top }];
const obstacle = (type, x, top, w, h, y0 = top) => ({ type, x0: x, x1: x + w, y0, y1: y0 + h, count: 1, hit: false, broken: false, period: 0, phase: 0 });
const pearl = (x, y) => ({ type: "pearl", x, y, taken: false, group: 1 });
const spare = (x, y) => ({ type: "spare", x, y, taken: false });
const coaster = (x, y) => ({ type: "coaster", x0: x - 12, x1: x + 12, y, customer: true, hard: false, done: null });

/** Steps with one input until a predicate or a time limit; returns every event. */
function run(s, input, seconds, until = () => false) {
  const events = [];
  for (let i = 0; i < Math.round(seconds / H); i++) {
    const ev = step(s, typeof input === "function" ? input(s, i) : input, H);
    events.push(...ev);
    if (until(s, ev)) break;
  }
  return events;
}

const kinds = (events, type) => events.filter((e) => e.type === type);
/** A full jump's keys: held for HOLD_TIME from the step it starts. */
const fullJumpFrom = (startX) => {
  let held = 0;
  return (st) => {
    if (held === 0 && st.runner.grounded && st.runner.x >= startX) held = 1;
    else if (held > 0) held += 1;
    return { jump: held > 0 && held <= Math.ceil(HOLD_TIME / H) };
  };
};

/** Peak height of a jump on a flat roof, holding jump for `steps` steps. */
function apexFor(steps) {
  const s = stage(floor());
  let apex = 0;
  run(s, (_, i) => ({ jump: i < steps }), 1.5, (st) => {
    apex = Math.max(apex, st.runner.y - 100);
    return st.runner.grounded && st.runner.y === 100 && st.time > 0.1;
  });
  return apex;
}

/** Seconds of running to reach world x from the start, at the mode's speed. */
function secondsTo(x, expert = false) {
  let at = 0;
  let seconds = 0;
  while (at < x) {
    at += speedAt(at, expert) * H;
    seconds += H;
  }
  return seconds;
}

// --- Curves and scoring -----------------------------------------------------------------

test("a seed always gives the same numbers", () => {
  const a = createRng(9);
  const b = createRng(9);
  for (let i = 0; i < 20; i++) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});

test("speed climbs the whole run, from 180 to a cap of 390 in about two and a half minutes", () => {
  assert.equal(speedAt(0), START_SPEED);
  assert.equal(speedAt(SPEED_RAMP), TOP_SPEED);
  assert.equal(speedAt(SPEED_RAMP * 3), TOP_SPEED);
  let last = 0;
  for (let x = 0; x <= SPEED_RAMP; x += 500) {
    assert.ok(speedAt(x) > last);
    last = speedAt(x);
  }
  const seconds = secondsTo(SPEED_RAMP);
  assert.ok(seconds > 140 && seconds < 175, `${seconds}s to top speed`);
  // Clearly faster later: the climb in time gathers pace.
  const at = (t) => {
    let x = 0;
    for (let i = 0; i < t / H; i++) x += speedAt(x) * H;
    return speedAt(x);
  };
  assert.ok(at(30) > START_SPEED * 1.12, `${at(30)} at 30 s`);
  assert.ok(at(60) > START_SPEED * 1.3, `${at(60)} at 60 s`);
  assert.ok(at(120) > START_SPEED * 1.75, `${at(120)} at 120 s`);
  assert.ok(at(120) - at(90) > at(30) - at(0), "the last half minute adds more than the first");
  assert.equal(difficultyAt(0), 0);
  assert.equal(difficultyAt(1e6), 1);
});

test("expert starts faster, climbs faster, tops out higher, and gets hard sooner", () => {
  for (let x = 0; x <= 60000; x += 1000) assert.ok(speedAt(x, true) > speedAt(x), `at ${x}`);
  assert.equal(speedAt(0, true), EXPERT.startSpeed);
  assert.ok(EXPERT.startSpeed >= NORMAL.startSpeed * 1.15);
  const seconds = secondsTo(EXPERT.speedRamp, true);
  assert.ok(seconds < 110, `${seconds}s to expert top speed`);
  assert.ok(secondsTo(EXPERT.difficultyRamp, true) < secondsTo(NORMAL.difficultyRamp) / 2);
  assert.ok(difficultyAt(8000, true) > 1.7 * difficultyAt(8000));
});

test("the music runs opening, steady, rush by distance", () => {
  assert.equal(phaseAt(0), "opening");
  assert.equal(phaseAt(3000), "steady");
  assert.equal(phaseAt(15000), "rush");
  const s = stage(floor());
  s.startX -= 2995;
  const events = run(s, IDLE, 0.2);
  assert.deepEqual(kinds(events, "phase").map((e) => e.phase), ["steady"]);
});

test("pearl combos step up every five pearls, to x5", () => {
  assert.equal(comboMultiplier(1), 1);
  assert.equal(comboMultiplier(4), 1);
  assert.equal(comboMultiplier(5), 2);
  assert.equal(comboMultiplier(19), 4);
  assert.equal(comboMultiplier(20), MAX_COMBO);
  assert.equal(comboMultiplier(200), MAX_COMBO);
});

test("deliveries pay more for a fuller cup and a longer streak", () => {
  assert.equal(deliveryPoints(1, 0), Math.round(DELIVERY_BASE + FULL_CUP_BONUS));
  for (let tea = 0.1; tea < 0.95; tea += 0.1) assert.ok(deliveryPoints(tea + 0.05, 0) > deliveryPoints(tea, 0));
  for (let streak = 0; streak < 8; streak++) assert.ok(deliveryPoints(0.5, streak + 1) > deliveryPoints(0.5, streak));
  assert.equal(deliveryPoints(0.5, 8), deliveryPoints(0.5, 50), "the streak multiplier is capped");
  assert.ok(deliveryPoints(FULL_CUP, 0) - deliveryPoints(FULL_CUP - 0.01, 0) >= FULL_CUP_BONUS);
});

test("only a hard landing spills, in proportion, and never a glide or a rush", () => {
  assert.equal(landingSpill(SAFE_LANDING), 0);
  assert.ok(landingSpill(700) > 0);
  assert.ok(landingSpill(800) > landingSpill(700));
  assert.equal(landingSpill(1e5), MAX_LANDING_SPILL);
  assert.equal(landingSpill(900, { gliding: true }), 0);
  assert.equal(landingSpill(900, { rushing: true }), 0);
  assert.equal(landingSpill(100, { slamming: true }), SLAM_SPILL);
});

// --- Movement -----------------------------------------------------------------------------

test("holding jump longer jumps higher, up to HOLD_TIME", () => {
  const tap = apexFor(1);
  const mid = apexFor(Math.round(0.1 / H));
  const full = apexFor(Math.ceil(HOLD_TIME / H));
  const longer = apexFor(Math.round(0.5 / H));
  assert.ok(Math.abs(tap - 50) < 3, `tap ${tap}`);
  assert.ok(tap < mid && mid < full);
  assert.ok(Math.abs(full - 101) < 3, `full ${full}`);
  assert.ok(Math.abs(longer - full) < 0.5, "holding past HOLD_TIME adds nothing");
  assert.ok(jumpReach(200) > jumpReach(200, 0, H));
  assert.ok(jumpReach(300) > jumpReach(200));
  assert.equal(jumpReach(200, 150), 0, "nothing reaches that high");
});

test("a jump still works just after running off an edge, not long after", () => {
  for (const [late, works] of [[COYOTE_TIME * 0.6, true], [COYOTE_TIME * 1.5, false]]) {
    const s = stage([{ x0: -2000, x1: 500, top: 100 }, { x0: 3000, x1: 1e6, top: 100 }], [], { x: 470 });
    run(s, IDLE, 1, (st) => !st.runner.grounded);
    const left = s.time;
    run(s, IDLE, late - H / 2);
    const events = run(s, { jump: true }, H * 2);
    assert.equal(kinds(events, "jump").length, works ? 1 : 0, `jump ${(s.time - left).toFixed(3)}s after the edge`);
    if (works) assert.equal(kinds(events, "jump")[0].coyote, true);
  }
});

test("a jump pressed just before landing happens on landing", () => {
  for (const [early, works] of [[BUFFER_TIME * 0.6, true], [BUFFER_TIME * 1.6, false]]) {
    const s = stage(floor(), [], { y: 160 });
    const probe = cloneRun(s);
    let landingStep = 0;
    run(probe, IDLE, 2, (st, ev) => (landingStep++, kinds(ev, "land").length > 0));
    const pressAt = landingStep - Math.round(early / H);
    const events = run(s, (_, i) => ({ jump: i === pressAt - 1 }), (landingStep + 5) * H);
    const jumps = kinds(events, "jump");
    assert.equal(jumps.length, works ? 1 : 0);
    if (works) assert.equal(jumps[0].buffered, true);
  }
});

test("a glide caps the fall, lasts GLIDE_TIME per airtime, and refills on landing", () => {
  const s = stage(floor(0), [], { y: 2000 });
  const glide = kinds(run(s, { jump: true }, 0.4), "glide");
  assert.equal(glide.length, 1);
  assert.ok(s.runner.gliding);
  assert.ok(Math.abs(s.runner.vy + GLIDE_FALL) < 1);
  run(s, { jump: true }, GLIDE_TIME - 0.4 + 0.05);
  assert.equal(s.runner.gliding, false, "stamina runs out");
  assert.equal(s.runner.glideLeft, 0);
  run(s, { jump: true }, 0.2);
  assert.ok(s.runner.vy < -GLIDE_FALL * 3, "then it falls");
  run(s, IDLE, 5, (st) => st.runner.grounded);
  assert.equal(s.runner.glideLeft, GLIDE_TIME);
});

test("gliding never spills, even into a landing that would", () => {
  const hard = stage(floor(100), [], { y: 260 });
  hard.runner.vy = -800;
  const plain = kinds(run(hard, IDLE, 2, (st) => st.runner.grounded), "spill");
  assert.equal(plain.length, 1);
  const soft = stage(floor(100), [], { y: 260 });
  soft.runner.vy = -800;
  const events = run(soft, { jump: true }, 2, (st) => st.runner.grounded);
  assert.equal(kinds(events, "spill").length, 0);
  assert.equal(soft.tea, 1);
  assert.equal(kinds(events, "land")[0].glide, true);
});

test("a hard landing spills in proportion; a short hop spills nothing", () => {
  const high = stage(floor(), [], { y: 400 });
  const events = run(high, IDLE, 2, (st) => st.runner.grounded);
  const land = kinds(events, "land")[0];
  assert.ok(land.impact > SAFE_LANDING);
  assert.ok(Math.abs(1 - high.tea - landingSpill(land.impact)) < 1e-9);
  assert.equal(kinds(events, "spill")[0].cause, "landing");

  const hop = stage(floor());
  run(hop, (_, i) => ({ jump: i < Math.round(HOLD_TIME / H) }), 2, (st) => st.runner.grounded && st.time > 0.2);
  assert.equal(hop.tea, 1, "a full jump back to the same roof is safe");
});

test("a slide ducks under a billboard that a standing runner runs into", () => {
  const board = () => [obstacle("billboard", 300, 100, 80, 100, 111)];
  const standing = stage(floor(), board(), { x: 100, spare: 1 });
  const hits = kinds(run(standing, IDLE, 2), "hit");
  assert.deepEqual(hits.map((e) => e.what), ["billboard"]);

  const sliding = stage(floor(), board(), { x: 100, spare: 1 });
  const events = run(sliding, (st) => ({ down: st.runner.x > 240 }), 2.5);
  assert.equal(kinds(events, "hit").length, 0);
  assert.ok(sliding.runner.x > 420);
  assert.equal(kinds(events, "slide").length, 1);
  assert.equal(runnerBox({ ...sliding.runner, sliding: true }).y1 - sliding.runner.y, SLIDE_H);
});

test("a tapped slide lasts SLIDE_TIME, a held one lasts as long as down is held, and slides off edges", () => {
  const timeSlide = (input) => {
    const s = stage(floor());
    const events = run(s, input, 2, (st, ev) => kinds(ev, "slideEnd").length > 0);
    assert.equal(kinds(events, "slide").length, 1);
    return s.time;
  };
  assert.ok(Math.abs(timeSlide((_, i) => ({ down: i === 0 })) - SLIDE_TIME) < 2 * H);
  // Held for 3 s, then let go: low the whole time, standing the step after.
  const held = stage(floor());
  const events = run(held, (st) => ({ down: st.time < 3 }), 4, (st, ev) => kinds(ev, "slideEnd").length > 0);
  assert.equal(kinds(events, "slide").length, 1);
  assert.ok(Math.abs(held.time - 3) < 2 * H, `ended at ${held.time}`);

  const s = stage([{ x0: -2000, x1: 140, top: 100 }, { x0: 160, x1: 1e6, top: 60 }], [], { x: 100 });
  run(s, (_, i) => ({ down: i === 0 }), 0.4);
  assert.equal(s.runner.grounded, false);
  assert.equal(s.runner.sliding, true, "still sliding in the air");
});

// --- Cups, hits and lethal things ----------------------------------------------------------

test("a run starts with one spare cup, or none in expert", () => {
  assert.equal(newRun(3).spare, 1);
  assert.equal(newRun(3).spare, NORMAL.startSpares);
  assert.equal(newRun(3, { expert: true }).spare, 0);
  assert.ok(MAX_SPARES >= 2);
});

test("running into something costs a cup, stumbles, breaks the combo, and grants a moment of grace", () => {
  const s = stage(
    floor(),
    [pearl(150, 109), pearl(170, 109), pearl(190, 109), obstacle("ac", 260, 100, 24, 16), obstacle("crate", 300, 100, 20, 18)],
    { x: 100, spare: 2 },
  );
  const before = run(s, IDLE, 1, (st) => st.runner.x > 200);
  assert.equal(kinds(before, "pearl").length, 3);
  assert.equal(s.combo.chain, 3);
  const events = run(s, IDLE, 1, (_, ev) => kinds(ev, "hit").length > 0);
  const hit = kinds(events, "hit")[0];
  assert.equal(hit.what, "ac");
  assert.equal(hit.spare, true);
  assert.deepEqual(kinds(events, "spareUsed").map((e) => [e.cause, e.what, e.left]), [["hit", "ac", 1]]);
  assert.equal(s.spare, 1);
  assert.equal(s.tea, 1, "a hit costs a cup, not tea");
  assert.equal(kinds(events, "comboLost").length, 1);
  assert.equal(s.combo.chain, 0);
  assert.equal(s.runner.grace, HIT_GRACE);
  run(s, IDLE, H);
  assert.ok(s.runner.vx < speedAt(s.runner.x) * (1 - STUMBLE_SLOW * 0.9), "stumbles");
  // The crate right behind it falls inside the grace: one mistake, one cup.
  const after = run(s, IDLE, 0.8);
  assert.equal(kinds(after, "hit").length, 0, "no double hit");
  assert.ok(s.runner.x > 330);
  assert.equal(s.spare, 1);
  assert.equal(s.status, "running");
  assert.ok(Math.abs(s.runner.vx / speedAt(s.runner.x) - 1) < 0.001, "and recovers");
  assert.equal(s.stats.hits, 1);
});

test("grace wears off: a second hit after HIT_GRACE costs another cup, and with none left the run ends", () => {
  const far = 100 + START_SPEED * (HIT_GRACE + 0.6);
  const s = stage(floor(), [obstacle("ac", 200, 100, 24, 16), obstacle("tank", far, 100, 34, 34)], { x: 100, spare: 1 });
  const events = run(s, IDLE, 5, (st) => st.status !== "running");
  assert.deepEqual(kinds(events, "hit").map((e) => [e.what, e.spare]), [["ac", true], ["tank", false]]);
  assert.equal(kinds(events, "over")[0].cause, "tank");
  assert.equal(s.status, "over");
  assert.equal(s.log.ending, "tank");
  assert.deepEqual(s.log.losses, ["ac"]);
});

test("lethal things end the run with spare cups in hand, grace or a rush", () => {
  const cases = [
    ["wire", obstacle("wire", 300, 100, 40, WIRE_H)],
    ["skylight", obstacle("skylight", 300, 100, 70, SKYLIGHT_H)],
    ["neon", obstacle("neon", 300, 100, 80, 100, 111)],
  ];
  for (const [what, item] of cases) {
    for (const extra of [{}, { grace: true }, { rush: true }]) {
      const s = stage(floor(), [{ ...item }], { x: 100, spare: 2 });
      if (extra.grace) s.runner.grace = 5;
      if (extra.rush) s.rush = RUSH_TIME;
      const events = run(s, IDLE, 3, (st) => st.status !== "running");
      assert.deepEqual(kinds(events, "lethal").map((e) => e.what), [what], `${what} ${JSON.stringify(extra)}`);
      assert.equal(kinds(events, "over")[0].cause, what);
      assert.equal(s.status, "over");
      assert.equal(s.spare, 2, "no cup can save it");
      assert.equal(kinds(events, "spareUsed").length, 0);
    }
  }
});

test("landing on a skylight is the end too", () => {
  const s = stage(floor(), [obstacle("skylight", 300, 100, 70, SKYLIGHT_H)], { x: 100, y: 190, spare: 2 });
  s.runner.x = 310;
  const events = run(s, IDLE, 2, (st) => st.status !== "running");
  assert.deepEqual(kinds(events, "lethal").map((e) => e.what), ["skylight"]);
});

test("a full jump clears a live wire and a skylight; a slide passes a neon sign", () => {
  for (const [item, width] of [[obstacle("wire", 300, 100, 50, WIRE_H), 50], [obstacle("skylight", 300, 100, 70, SKYLIGHT_H), 70]]) {
    const range = clearRange(START_SPEED, width, item.y1 - item.y0);
    assert.ok(range && range.far - range.near > 0.1 * START_SPEED, `${item.type} window`);
    const s = stage(floor(), [item], { x: 100 });
    const takeoff = 300 - (range.near + range.far) / 2;
    const events = run(s, fullJumpFrom(takeoff), 3);
    assert.equal(kinds(events, "lethal").length, 0, item.type);
    assert.ok(s.runner.x > 450 && s.runner.grounded);
  }
  const neon = stage(floor(), [obstacle("neon", 300, 100, 120, 100, 111)], { x: 100 });
  const events = run(neon, (st) => ({ down: st.runner.x > 250 }), 3);
  assert.equal(kinds(events, "lethal").length, 0);
  assert.ok(neon.runner.x > 450);
});

test("falling into the railway is lethal; an ordinary alley only costs a cup", () => {
  const roofs = [{ x0: -2000, x1: 500, top: 100 }, { x0: 700, x1: 1e6, top: 100 }];
  const rail = stage(roofs, [], { x: 400, spare: 2, gaps: [{ x0: 500, x1: 700, dy: 0, speed: START_SPEED, assist: "rail" }] });
  const events = run(rail, IDLE, 3, (st) => st.status !== "running");
  assert.deepEqual(kinds(events, "lethal").map((e) => e.what), ["rail"]);
  assert.equal(rail.status, "over");
  assert.equal(rail.spare, 2);

  const alley = stage(roofs, [], { x: 400, spare: 2, gaps: [{ x0: 500, x1: 700, dy: 0, speed: START_SPEED, assist: null }] });
  const fell = run(alley, IDLE, 3, (st) => st.status !== "running");
  assert.equal(kinds(fell, "fall").length, 1);
  assert.equal(alley.status, "respawning");
  assert.equal(alley.spare, 1);
});

test("standing on top of an obstacle is fine; running off it is too", () => {
  const s = stage(floor(), [obstacle("tank", 300, 100, 34, 34)], { x: 100 });
  const events = run(s, (st) => ({ jump: st.runner.grounded && st.runner.x > 245 && st.runner.x < 257 }), 2);
  assert.equal(kinds(events, "hit").length, 0);
  assert.ok(kinds(events, "land").some((e) => e.y === 134), "landed on the tank");
  assert.equal(s.runner.y, 100, "and stepped off it");
});

test("a slam drops nearly straight down, breaks crates, frees their pearls, and sloshes", () => {
  const crate = { ...obstacle("crate", 300, 100, 20, 36), count: 2 };
  const s = stage(floor(), [crate], { x: 160 });
  let slamX = 0;
  const events = run(s, (st) => {
    if (st.runner.grounded && st.runner.x < 250 && st.runner.x > 230) return { jump: true };
    if (!st.runner.grounded && !slamX && st.runner.x >= 302) {
      slamX = st.runner.x;
      return { down: true, jump: false };
    }
    return { jump: !slamX && !st.runner.grounded };
  }, 2, (st) => st.runner.grounded && slamX > 0);
  assert.equal(kinds(events, "slam").length, 1);
  const smash = kinds(events, "smash")[0];
  assert.equal(smash.cause, "slam");
  assert.equal(smash.points, CRATE_POINTS * 2);
  assert.equal(crate.broken, true);
  assert.equal(s.chunks[0].items.filter((i) => i.type === "pearl").length, 2 * PEARLS_PER_CRATE);
  const land = kinds(events, "land")[0];
  assert.equal(land.slam, true);
  assert.equal(land.y, 100);
  assert.ok(s.runner.x - slamX < 30, "lands close below");
  assert.ok(Math.abs(s.tea - (1 - SLAM_SPILL)) < 1e-9);
  assert.equal(kinds(events, "hit").length, 0);
});

test("down tapped in the air slams and lands standing; held through the landing, it lands sliding", () => {
  const board = () => [obstacle("billboard", 320, 100, 80, 100, 111)];
  /** Hops at once, slams once past x 170, and holds down after it or not. */
  const slamInto = (hold) => {
    const s = stage(floor(), board(), { x: 100, spare: 1 });
    let slammed = false;
    const steps = [];
    for (let i = 0; i < Math.round(2.5 / H); i++) {
      let down = false;
      if (!s.runner.grounded && !slammed && s.runner.x > 170) down = slammed = true;
      else if (slammed && hold) down = true;
      steps.push(step(s, { jump: i < 2, down }, H));
    }
    return { s, steps, events: steps.flat() };
  };

  const tapped = slamInto(false);
  assert.equal(kinds(tapped.events, "slam").length, 1);
  assert.ok(kinds(tapped.events, "land")[0].x < 320, "lands short of the billboard");
  assert.equal(kinds(tapped.events, "slide").length, 0, "a tap lands standing");
  assert.deepEqual(kinds(tapped.events, "hit").map((e) => e.what), ["billboard"]);

  const held = slamInto(true);
  const landing = held.steps.find((ev) => kinds(ev, "land").length > 0);
  assert.deepEqual(
    landing.map((e) => e.type).filter((t) => t === "land" || t === "slide"),
    ["land", "slide"],
    "the slide starts on the step the slam lands",
  );
  assert.equal(kinds(held.events, "slide").length, 1);
  assert.equal(kinds(held.events, "hit").length, 0, "under the billboard it was about to meet");
  assert.ok(held.s.runner.x > 420);

  // Held down through a crate's smash, the freed pearls are still picked up low.
  const crate = { ...obstacle("crate", 300, 100, 20, 36), count: 2 };
  const s = stage(floor(), [crate], { x: 160 });
  let slamming = false;
  const events = run(s, (st) => {
    if (st.runner.grounded && !slamming && st.runner.x > 230 && st.runner.x < 250) return { jump: true };
    if (!st.runner.grounded && st.runner.x >= 302) slamming = true;
    return { jump: !slamming && !st.runner.grounded, down: slamming };
  }, 2);
  assert.equal(crate.broken, true);
  assert.equal(kinds(events, "slide").length, 1);
  const freed = s.chunks[0].items.filter((i) => i.type === "pearl");
  assert.equal(freed.length, 2 * PEARLS_PER_CRATE);
  assert.ok(freed.every((p) => p.taken), "every freed pearl taken while sliding");
});

test("a step within MANTLE is climbed; a tall wall stops the runner and drops it", () => {
  const curb = stage([{ x0: -2000, x1: 300, top: 100 }, { x0: 300, x1: 1e6, top: 100 + MANTLE - 2 }]);
  run(curb, IDLE, 2);
  assert.equal(curb.runner.y, 100 + MANTLE - 2);
  assert.equal(curb.status, "running");

  const wall = stage([{ x0: -2000, x1: 300, top: 100 }, { x0: 340, x1: 1e6, top: 160 }]);
  const events = run(wall, IDLE, 3);
  assert.equal(kinds(events, "wall").length, 1);
  assert.equal(kinds(events, "fall").length, 1);
});

// --- Set pieces ----------------------------------------------------------------------------

test("an awning bounces the runner up to a roof it could never jump to", () => {
  const roofs = [{ x0: -2000, x1: 500, top: 100 }, { x0: 620, x1: 1e6, top: 186 }];
  const s = stage(roofs, [{ type: "awning", x0: 500, x1: 552, y: 76 }], { x: 400 });
  const events = run(s, IDLE, 3);
  assert.equal(kinds(events, "bounce").length, 1);
  assert.equal(kinds(events, "fall").length, 0);
  assert.equal(s.runner.y, 186);
  assert.ok(BOUNCE_SPEED > 0);
  const without = stage(roofs, [], { x: 400 });
  assert.equal(kinds(run(without, IDLE, 3), "fall").length, 1);
});

test("a vent's updraft carries the runner over a gap too wide to jump", () => {
  const roofs = [{ x0: -2000, x1: 500, top: 100 }, { x0: 840, x1: 1e6, top: 110 }];
  assert.ok(340 > glideReach(speedAt(500), 10) + RUNNER_W);
  const s = stage(roofs, [{ type: "vent", x0: 516, x1: 822, y0: 0, ceiling: 210 }], { x: 400 });
  const events = run(s, IDLE, 3);
  assert.equal(kinds(events, "vent").length, 1);
  assert.equal(kinds(events, "fall").length, 0);
  assert.equal(s.runner.y, 110);
  const jumped = stage(roofs, [], { x: 400 });
  assert.equal(kinds(run(jumped, (st) => ({ jump: st.runner.x > 495 }), 3), "fall").length, 1, "even with a glide");
});

test("a cable is caught with a hop, ridden down, and let go of with jump", () => {
  const roofs = [{ x0: -2000, x1: 500, top: 150 }, { x0: 760, x1: 1e6, top: 60 }];
  const cable = { type: "cable", x0: 464, y0: 194, x1: 800, y1: 90 };
  const idle = stage(roofs, [cable], { x: 380 });
  assert.equal(kinds(run(idle, IDLE, 3), "fall").length, 1, "running under it drops into the alley");

  const ride = stage(roofs, [cable], { x: 380 });
  const events = run(ride, (st) => ({ jump: st.runner.grounded && st.runner.x > 470 && st.runner.x < 500 }), 3);
  assert.equal(kinds(events, "cableOn").length, 1);
  const off = kinds(events, "cableOff")[0];
  assert.equal(off.jump, false);
  assert.ok(off.x >= 800 - 1);
  assert.equal(kinds(events, "fall").length, 0);
  assert.equal(ride.runner.y, 60);
  assert.equal(ride.tea, 1, "riding spills nothing");

  const early = stage(roofs, [cable], { x: 380 });
  let caught = false;
  const jumpOff = run(early, (st, i) => {
    if (st.runner.cable) caught = true;
    return { jump: (st.runner.grounded && st.runner.x > 470 && st.runner.x < 500) || (caught && st.runner.x > 600 && i % 2 === 0) };
  }, 2, (st, ev) => kinds(ev, "cableOff").length > 0);
  assert.equal(kinds(jumpOff, "cableOff")[0].jump, true);
  assert.ok(early.runner.vy > 0);
});

test("pigeons are harmless underfoot, and jumping into them only scatters them", () => {
  const flock = () => [600, 612, 624].map((x) => ({ type: "pigeon", x, y: 100, vx: 45, vy: 60, delay: 0, state: "sit", t: 0 }));
  const low = stage(floor(), flock(), { x: 300, spare: 1 });
  const events = run(low, IDLE, 3);
  assert.equal(kinds(events, "pigeonsUp").reduce((n, e) => n + e.count, 0), 3);
  assert.equal(kinds(events, "hit").length, 0);
  assert.equal(low.spare, 1);

  // A full jump at the flock flies into the rising birds; a tap stays under them.
  const jumpAt = (lead, steps) => {
    const s = stage(floor(), flock(), { x: 300, spare: 1 });
    let held = 0;
    return run(s, (st) => {
      if (st.runner.x > 600 - lead) held += 1;
      return { jump: held > 0 && held <= steps };
    }, 3);
  };
  assert.ok(PIGEON_WARNING > 0);
  let struck = 0;
  for (let lead = 0; lead <= 160; lead += 20) {
    const full = jumpAt(lead, Math.ceil(HOLD_TIME / H));
    if (kinds(full, "strike").length) struck += 1;
    assert.equal(kinds(full, "hit").length, 0, "no cup for the flock");
    assert.equal(kinds(full, "spareUsed").length, 0);
    assert.equal(kinds(jumpAt(lead, 1), "strike").length, 0, "a tap passes under");
  }
  assert.ok(struck > 0, "some jump into the flock strikes it");
});

test("a barrel waits, rolls at the runner once it is close, and a hop clears it", () => {
  const barrel = () => ({ type: "barrel", x: 700, y: 100, minX: 0, state: "wait", t: 0 });
  const idle = stage(floor(), [barrel()], { x: 300, spare: 1 });
  const events = run(idle, IDLE, 3, (st, ev) => kinds(ev, "hit").length > 0);
  const rolled = kinds(events, "barrel")[0];
  assert.ok(rolled && 700 - idle.runner.x < START_SPEED * BARREL_WARNING + 10, "sets off as the runner comes");
  assert.deepEqual(kinds(events, "hit").map((e) => e.what), ["barrel"]);
  const met = idle.chunks[0].items[0];
  assert.ok(met.x < 700 - 20, "it rolled to meet the runner");
  assert.ok(BARREL_SPEED > 0 && BARREL_H < 20);

  // A tap from a moment before they meet carries over it.
  let cleared = 0;
  for (let lead = 0.1; lead <= 0.3; lead += 0.05) {
    const s = stage(floor(), [barrel()], { x: 300 });
    let went = false;
    const ev = run(s, (st) => {
      const b = st.chunks[0].items[0];
      const jump = !went && st.runner.grounded && b.x - st.runner.x < (st.runner.vx + BARREL_SPEED) * lead + 15;
      if (jump) went = true;
      return { jump };
    }, 3);
    if (!kinds(ev, "hit").length && s.status === "running") cleared += 1;
  }
  assert.ok(cleared >= 3, `${cleared} hop timings clear it`);
});

test("a drone flies in at slide height: a slide passes under, standing costs a cup", () => {
  const drone = () => ({ type: "drone", x: 800, y: 100 + DRONE_LOW, state: "wait", t: 0 });
  assert.ok(DRONE_LOW > SLIDE_H && DRONE_LOW < RUNNER_H);
  const standing = stage(floor(), [drone()], { x: 300, spare: 1 });
  assert.deepEqual(kinds(run(standing, IDLE, 3), "hit").map((e) => e.what), ["drone"]);
  const sliding = stage(floor(), [drone()], { x: 300 });
  const events = run(sliding, (st) => {
    const d = st.chunks[0].items[0];
    return { down: d.state === "fly" && d.x - st.runner.x < (st.runner.vx + DRONE_SPEED) * 0.2 };
  }, 3);
  assert.equal(kinds(events, "drone").length, 1);
  assert.equal(kinds(events, "hit").length, 0);
  assert.ok(sliding.runner.x > 700);
});

test("a swinging sign never comes down to slide height, but a standing runner can meet it", () => {
  let standingHits = 0;
  for (let phase = 0; phase < 1; phase += 0.1) {
    const sign = () => ({ type: "swing", x: 500, y: 100, len: SWING_LEN, amp: 0.7, period: 1.5, phase, hit: false, broken: false });
    for (let t = 0; t < 1.5; t += 0.05) assert.ok(swingBox(sign(), t).y0 >= 100 + SWING_LOW - 1e-9);
    const slide = stage(floor(), [sign()], { x: 300 });
    const events = run(slide, (st) => ({ down: st.runner.x > 380 }), 2);
    assert.equal(kinds(events, "hit").length, 0, `slide at phase ${phase}`);
    assert.ok(slide.runner.x > 600);
    const stand = stage(floor(), [sign()], { x: 300, spare: 1 });
    if (kinds(run(stand, IDLE, 2), "hit").length) standingHits += 1;
  }
  assert.ok(standingHits >= 3 && standingHits <= 9, `${standingHits} of 10 phases hit a standing runner`);
});

test("a steam pipe is always a hop, its plume only while it blows, and a full jump clears both", () => {
  const pipe = (phase) => ({ ...obstacle("steam", 500, 100, STEAM_W, STEAM_PIPE), period: 1.4, phase });
  const states = new Set();
  for (let t = 0; t < 1.4; t += 0.02) states.add(steamPhase(pipe(0), t).state);
  assert.deepEqual([...states].sort(), ["hiss", "off", "on"]);

  // Standing, it is hit whatever the timer says.
  assert.equal(kinds(run(stage(floor(), [pipe(0)], { x: 300, spare: 1 }), IDLE, 2), "hit").length, 1);

  const plume = clearRange(START_SPEED, STEAM_W + 6, STEAM_PIPE + STEAM_PLUME);
  assert.ok(plume && plume.far - plume.near > 0.15 * START_SPEED, "a full jump has time to clear the plume");
  let tapHit = 0;
  for (let phase = 0; phase < 1; phase += 0.1) {
    const full = stage(floor(), [pipe(phase)], { x: 300 });
    const takeoff = 497 - (plume.near + plume.far) / 2;
    assert.equal(kinds(run(full, fullJumpFrom(takeoff), 2), "hit").length, 0, `full jump at phase ${phase}`);
    // A tap clears the pipe, but not the plume when it blows.
    const tap = stage(floor(), [pipe(phase)], { x: 300, spare: 1 });
    let went = false;
    const ev = run(tap, (st) => {
      const jump = !went && st.runner.grounded && st.runner.x > 500 - 7 - 0.12 * START_SPEED;
      if (jump) went = true;
      return { jump };
    }, 2);
    if (kinds(ev, "hit").length) tapHit += 1;
  }
  assert.ok(tapHit >= 2 && tapHit <= 8, `a tap meets the plume ${tapHit} times in 10`);
});

test("rotten boards hold for a moment after they are stood on, then give way", () => {
  const roofs = [{ x0: -2000, x1: 500, top: 100 }, { x0: 650, x1: 1e6, top: 100 }];
  const boards = () => ({ type: "boards", x0: 500, x1: 650, y: 100, at: -1, gone: false });
  const s = stage(roofs, [boards()], { x: 400, spare: 1 });
  const events = run(s, IDLE, 3, (st) => st.status !== "running");
  const creak = kinds(events, "creak")[0];
  const crumble = kinds(events, "crumble")[0];
  assert.ok(creak && crumble);
  assert.equal(kinds(events, "fall").length, 1, "standing on them is a fall");

  // Off them in time, with a jump, is safe.
  const hop = stage(roofs, [boards()], { x: 400 });
  let boardedAt = -1;
  const ev = run(hop, (st) => {
    if (boardedAt < 0 && st.chunks[0].items[0].at >= 0) boardedAt = st.time;
    return { jump: boardedAt >= 0 && st.time - boardedAt > CRUMBLE_TIME * 0.5 && st.time - boardedAt < CRUMBLE_TIME * 0.5 + HOLD_TIME };
  }, 3);
  assert.equal(kinds(ev, "fall").length, 0);
  assert.ok(hop.runner.x > 700 && hop.runner.y === 100);
});

// --- Deliveries, sugar, spare cups ----------------------------------------------------

test("running across a coaster delivers, pays by tea and streak, and refills the cup", () => {
  const s = stage(floor(), [coaster(300, 100), coaster(700, 100)], { x: 100 });
  s.tea = 0.5;
  s.streak = 2;
  const first = kinds(run(s, IDLE, 1.6, (st) => st.runner.x > 400), "delivery")[0];
  assert.equal(first.points, deliveryPoints(0.5, 2));
  assert.equal(first.full, false);
  assert.equal(first.streak, 3);
  assert.equal(s.tea, 1);
  const second = kinds(run(s, IDLE, 3, (st) => st.runner.x > 800), "delivery")[0];
  assert.equal(second.full, true);
  assert.equal(second.points, deliveryPoints(1, 3));
  assert.equal(s.stats.fullCups, 1);
  assert.equal(s.stats.bestStreak, 4);
  assert.deepEqual(s.log.coasters, ["part", "full"]);
});

test("jumping over a coaster misses it and breaks the streak", () => {
  const s = stage(floor(), [coaster(300, 100)], { x: 100 });
  s.streak = 3;
  const events = run(s, (st) => ({ jump: st.runner.x > 240 && st.runner.x < 300 }), 2);
  assert.equal(kinds(events, "delivery").length, 0);
  assert.equal(kinds(events, "miss").length, 1);
  assert.equal(s.streak, 0);
  assert.equal(s.stats.missed, 1);
  assert.deepEqual(s.log.coasters, ["missed"]);
});

test("pearls fill the sugar; a rush is faster, smashes, saves the tea, pulls pearls in, and ends", () => {
  const items = [pearl(150, 109), obstacle("billboard", 500, 100, 60, 100, 111), obstacle("ac", 700, 100, 24, 16), pearl(900, 109 + RUSH_MAGNET - 10)];
  const s = stage(floor(), items, { x: 100 });
  s.sugar = SUGAR_FULL - 1;
  const ready = run(s, IDLE, 1, (st) => st.runner.x > 200);
  assert.equal(kinds(ready, "rushReady").length, 1);
  assert.equal(s.sugar, SUGAR_FULL);

  const started = run(s, { rush: true }, H);
  assert.equal(kinds(started, "rushStart").length, 1);
  assert.equal(s.sugar, 0);
  assert.ok(Math.abs(s.runner.vx / (speedAt(s.runner.x) * RUSH_SPEED) - 1) < 0.001);

  // A hard landing in a rush spills nothing.
  s.runner.y = 300;
  s.runner.grounded = false;
  const drop = run(s, IDLE, 1, (st) => st.runner.grounded);
  assert.ok(kinds(drop, "land")[0].impact > SAFE_LANDING);
  assert.equal(s.tea, 1);

  const during = run(s, IDLE, 5, (st) => st.runner.x > 950);
  assert.equal(kinds(during, "hit").length, 0);
  assert.deepEqual(kinds(during, "smash").map((e) => e.what), ["billboard", "ac"]);
  assert.equal(kinds(during, "pearl")[0].magnet, true);
  assert.equal(s.tea, 1);
  assert.equal(s.status, "running");

  const end = run(s, IDLE, RUSH_TIME);
  assert.equal(kinds(end, "rushEnd").length, 1);
  assert.equal(s.rush, 0);
  assert.ok(Math.abs(s.runner.vx / speedAt(s.runner.x) - 1) < 0.001);
  assert.equal(s.stats.rushes, 1);
});

test("a rush can't start before the sugar is full", () => {
  const s = stage(floor());
  s.sugar = SUGAR_FULL - 1;
  assert.equal(kinds(run(s, { rush: true }, 0.1), "rushStart").length, 0);
});

const GAP_ROOFS = [
  { x0: -2000, x1: 500, top: 100 },
  { x0: 800, x1: 840, top: 90, kind: "chimney" },
  { x0: 900, x1: 980, top: 90 },
  { x0: 1100, x1: 1500, top: 120 },
];

test("a fall without a spare ends the run at once, and an ended run stands still", () => {
  const s = stage(GAP_ROOFS, [], { x: 400 });
  let fellOn = -1;
  const events = run(s, IDLE, 3, (st, ev) => {
    if (kinds(ev, "fall").length) fellOn = st.time;
    return st.status !== "running";
  });
  assert.equal(kinds(events, "fall").length, 1);
  assert.equal(kinds(events, "fall")[0].spare, false);
  assert.equal(kinds(events, "spareUsed").length, 0);
  assert.equal(kinds(events, "over").length, 1);
  assert.equal(kinds(events, "over")[0].cause, "fall");
  assert.equal(s.status, "over", "no respawn pause");
  assert.equal(s.time, fellOn, "over on the step of the fall");
  const frozen = cloneRun(s);
  assert.deepEqual(step(s, { jump: true }, H), []);
  assert.deepEqual(s, frozen);
});

test("a fall with a spare spends it and comes back on the next proper roof", () => {
  const s = stage(GAP_ROOFS, [], { x: 400, spare: 1 });
  const events = run(s, IDLE, 3, (st) => st.status !== "running");
  assert.equal(kinds(events, "fall").length, 1);
  assert.equal(kinds(events, "fall")[0].spare, true);
  assert.equal(kinds(events, "spareUsed")[0].cause, "fall");
  assert.equal(kinds(events, "over").length, 0);
  assert.equal(s.status, "respawning");
  assert.equal(s.spare, 0);
  assert.equal(s.stats.sparesUsed, 1);
  const back = run(s, IDLE, RESPAWN_TIME + H);
  const respawn = kinds(back, "respawn")[0];
  assert.deepEqual([respawn.x, respawn.y], [1116, 120]);
  assert.equal(s.status, "running");
  assert.equal(s.runner.grounded, true);
  assert.ok(s.runner.grace > RESPAWN_GRACE - 0.1);

  // The next fall, with no spare left, is the end.
  const again = run(s, IDLE, 20, (st) => st.status !== "running");
  assert.equal(kinds(again, "over").length, 1);
  assert.deepEqual(s.log.losses, ["fall"]);
  assert.equal(s.log.ending, "fall");
});

test("a dry cup costs a spare and comes back part full; without one it ends the run", () => {
  const roofs = [{ x0: -2000, x1: 600, top: 100 }, { x0: 620, x1: 1e6, top: 100 }];
  const dry = stage(roofs, [], { x: 100, y: 400 });
  dry.tea = 0.05;
  const ended = run(dry, IDLE, 2, (st) => st.status !== "running");
  assert.equal(kinds(ended, "dry").length, 1);
  assert.equal(kinds(ended, "over")[0].cause, "dry");
  assert.equal(dry.status, "over");

  const saved = stage(roofs, [], { x: 100, y: 400, spare: 1 });
  saved.tea = 0.05;
  const events = run(saved, IDLE, 2, (st, ev) => kinds(ev, "dry").length > 0);
  assert.equal(kinds(events, "spareUsed")[0].cause, "dry");
  assert.equal(saved.status, "running", "it carries on where it is");
  assert.equal(saved.spare, 0);
  assert.equal(saved.tea, DRY_REFILL);
  assert.ok(saved.runner.grace > HIT_GRACE - 0.1);
});

test("spare cups fill the slots up to MAX_SPARES; one more is worth points instead", () => {
  const s = stage(floor(), [spare(200, 108), spare(400, 108), spare(600, 108), pearl(800, 109)], { x: 100 });
  const first = run(s, IDLE, 2, (st) => st.runner.x > 300);
  assert.deepEqual(kinds(first, "spare").map((e) => [e.x, e.y, e.held]), [[200, 108, 1]]);
  assert.equal(s.spare, 1);
  run(s, IDLE, 2, (st) => st.runner.x > 500);
  assert.equal(s.spare, MAX_SPARES);
  const third = run(s, IDLE, 2, (st) => st.runner.x > 700);
  assert.equal(kinds(third, "spare").length, 0);
  assert.deepEqual(kinds(third, "spareBonus").map((e) => e.points), [SPARE_BONUS]);
  assert.equal(s.spare, MAX_SPARES, "still only two");
  assert.equal(s.stats.spares, 3);
  run(s, IDLE, 1);
  assert.equal(s.score, s.points.distance + s.points.pearls + SPARE_BONUS);

  // Taken by a touch of the box, as drawn: just over the lid is a pickup, a
  // little higher is not.
  const touch = (y) => {
    const t = stage(floor(), [spare(200, y)], { x: 100 });
    run(t, IDLE, 1);
    return t.spare;
  };
  assert.equal(touch(100 + RUNNER_H + SPARE_RADIUS - 1), 1);
  assert.equal(touch(100 + RUNNER_H + SPARE_RADIUS + 1), 0);
});

test("the results breakdown adds up to the score", () => {
  const items = [pearl(150, 109), coaster(300, 100), obstacle("ac", 500, 100, 24, 16), spare(700, 108), spare(800, 108), spare(900, 108)];
  const s = stage(floor(), items, { x: 100, spare: 1 });
  run(s, IDLE, 6);
  const b = breakdown(s);
  assert.equal(b.score, b.distancePoints + b.pearlPoints + b.deliveryPoints + b.smashPoints + b.sparePoints);
  assert.equal(b.pearls, 1);
  assert.equal(b.deliveries, 1);
  assert.equal(b.hits, 1);
  assert.equal(b.spares, 3);
  assert.equal(b.sparesUsed, 1);
  assert.equal(b.sparePoints, SPARE_BONUS);
  assert.ok(b.distance > 50);
  assert.equal(b.ending, null);
});

test("a run shares as a few lines: distance, the coasters as cups, and what it cost", () => {
  const s = stage(floor(), [], { x: 100 });
  s.distance = 12345;
  s.log.coasters = ["full", "part", "missed", ...Array.from({ length: 20 }, () => "full")];
  s.log.losses = ["crate", "fall"];
  s.log.ending = "wire";
  const lines = shareLines(s);
  assert.ok(lines.length <= 4);
  assert.equal(lines[0], "🏃 1,234 m");
  assert.ok(lines[1].startsWith("🧋🥤▫️🧋"));
  assert.ok(lines[2].endsWith("…"), "a long run is cut after two rows");
  assert.equal(lines[3], "📦🕳️ then ⚡ a live wire");
  for (const line of lines) assert.ok(!/[·!]/.test(line));

  const short = stage(floor(), [], { x: 100 });
  short.distance = 400;
  short.log.ending = "fall";
  assert.deepEqual(shareLines(short), ["🏃 40 m", "🕳️ a fall"]);
});

// --- The generator ----------------------------------------------------------------------------

const COURSES = SEEDS.map((seed) => buildCourse(seed, 40000));
const EXPERT_COURSES = SEEDS.slice(0, 10).map((seed) => buildCourse(seed, 40000, 0, { expert: true }));

test("there are at least twenty-five patterns and every one turns up", () => {
  assert.ok(PATTERNS.length >= 25);
  assert.equal(new Set(PATTERNS.map((p) => p.id)).size, PATTERNS.length);
  for (const courses of [COURSES, EXPERT_COURSES]) {
    const seen = new Set(courses.flat().map((c) => c.pattern));
    for (const p of PATTERNS) assert.ok(seen.has(p.id), `${p.id} never generated`);
  }
});

test("the generator never repeats a pattern back to back and respects each minimum", () => {
  for (const [courses, expert] of [[COURSES, false], [EXPERT_COURSES, true]]) {
    const min = Object.fromEntries(PATTERNS.map((p) => [p.id, patternMin(p, expert)]));
    for (const chunks of courses) {
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        assert.ok(min[c.pattern] <= c.difficulty, `${c.pattern} at ${c.difficulty}`);
        if (i > 0) {
          assert.notEqual(c.pattern, chunks[i - 1].pattern);
          assert.equal(c.x0, chunks[i - 1].x1, "chunks join up");
        }
      }
    }
  }
});

test("a seed always builds the same course, and seeds differ", () => {
  assert.deepEqual(buildCourse(5, 8000), buildCourse(5, 8000));
  assert.notDeepEqual(buildCourse(5, 8000), buildCourse(6, 8000));
  assert.notDeepEqual(buildCourse(5, 8000), buildCourse(5, 8000, 0, { expert: true }));
});

test("every roof is in bounds and dressed, and the pieces line up", () => {
  for (const chunks of COURSES.slice(0, 6)) {
    for (const c of chunks) {
      for (let i = 0; i < c.roofs.length; i++) {
        const r = c.roofs[i];
        assert.ok(r.top >= MIN_TOP && r.top <= MAX_TOP);
        assert.ok(r.x1 > r.x0);
        assert.ok(Number.isInteger(r.style) && typeof r.tower === "boolean" && typeof r.sign === "boolean");
        if (i > 0) assert.ok(r.x0 >= c.roofs[i - 1].x1);
      }
      for (const g of c.gaps) {
        assert.ok(c.roofs.some((r) => r.x1 === g.x0) || c.x0 === g.x0);
        assert.ok(c.roofs.some((r) => r.x0 === g.x1));
      }
      for (const item of c.items) {
        if (item.type === "coaster") assert.equal(item.customer, true);
        if (item.type === "ledge") assert.ok(c.items.some((o) => o.type === "coaster"), "split routes carry a coaster");
        if (item.type === "boards") assert.ok(c.gaps.some((g) => g.assist === "boards" && g.x0 === item.x0 && g.x1 === item.x1));
      }
    }
  }
});

test("set pieces come faster as the run goes on, and nothing lethal comes first", () => {
  const hazards = new Set(["ac", "tank", "crate", "clothesline", "billboard", "wire", "skylight", "neon", "steam", "barrel", "drone", "swing", "pigeon"]);
  /** Things to hop, slide or dodge per second of running, over a stretch. */
  const perSecond = (courses, from, to, types) => {
    let n = 0;
    let seconds = 0;
    for (const chunks of courses) {
      for (const c of chunks) {
        if (c.x0 < from || c.x0 >= to) continue;
        n += c.items.filter((o) => types.has(o.type)).length;
        seconds += (c.x1 - c.x0) / speedAt((c.x0 + c.x1) / 2);
      }
    }
    return n / seconds;
  };
  const early = perSecond(COURSES, 2000, 10000, hazards);
  const late = perSecond(COURSES, 28000, 38000, hazards);
  assert.ok(late > early * 1.35, `${early.toFixed(2)} then ${late.toFixed(2)} a second`);
  const lethal = new Set(["wire", "skylight", "neon"]);
  assert.equal(perSecond(COURSES, 0, 4000, lethal), 0, "nothing lethal in the first stretch");
});

test("deliveries come every 350 units or so early on, further apart later", () => {
  const spacing = (start) => {
    const gaps = [];
    for (const seed of SEEDS) {
      const coasters = buildCourse(seed, 8000, start).flatMap((c) => c.items.filter((i) => i.type === "coaster"));
      for (let i = 1; i < coasters.length; i++) gaps.push(coasters[i].x0 - coasters[i - 1].x0);
    }
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
  };
  const early = spacing(0);
  const late = spacing(30000);
  assert.ok(early >= 330 && early < 460, `early median ${early}`);
  assert.ok(late > early && late < 750, `late median ${late}`);
});

test("every plain gap is clearable at the speed it appears at, and a railway gap with room to spare", () => {
  let checked = 0;
  let rails = 0;
  for (const [courses, expert] of [[COURSES, false], [EXPERT_COURSES, true]]) {
    for (const chunks of courses) {
      for (const c of chunks) {
        for (const g of c.gaps) {
          const speed = speedAt(g.x0, expert);
          const width = g.x1 - g.x0;
          if (g.assist === null || g.assist === "rail") {
            // Taking off with the box's back edge on the roof and landing with
            // its front edge on the next; the generator keeps a full width spare.
            const reach = jumpReach(speed, g.dy) - RUNNER_W;
            assert.ok(width <= reach, `${c.pattern} gap ${width} at ${Math.round(speed)}`);
            if (g.assist === "rail") {
              assert.ok(width <= reach * 0.62, `rail gap ${width} of ${Math.round(reach)}`);
              rails += 1;
            }
            checked += 1;
          } else if (g.assist === "drop") {
            assert.ok(g.dy < 0);
            assert.ok(width <= fallReach(speed, -g.dy) + RUNNER_W, `${c.pattern} drop ${width}`);
            checked += 1;
          }
        }
      }
    }
  }
  assert.ok(checked > 1000);
  assert.ok(rails > 20, `${rails} railway gaps`);
});

test("every live wire and skylight leaves a tenth of a second or more of take-off that clears it", () => {
  let checked = 0;
  for (const [courses, expert] of [[COURSES, false], [EXPERT_COURSES, true]]) {
    for (const chunks of courses) {
      for (const c of chunks) {
        for (const o of c.items) {
          if (o.type !== "wire" && o.type !== "skylight") continue;
          const speed = speedAt(o.x0, expert);
          const range = clearRange(speed, o.x1 - o.x0, o.y1 - o.y0);
          assert.ok(range && range.far - range.near >= 0.1 * speed, `${o.type} ${o.x1 - o.x0} wide at ${Math.round(speed)}`);
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 60, `${checked} checked`);
});

test("every assisted gap (awning, vent, cable, boards) is crossed by the bot from a standing start", () => {
  let checked = 0;
  const seen = new Set();
  for (const seed of SEEDS.slice(0, 8)) {
    const chunks = buildCourse(seed, 40000);
    for (let i = 0; i < chunks.length; i++) {
      for (const g of chunks[i].gaps) {
        if (g.assist === null || g.assist === "drop" || g.assist === "rail") continue;
        const s = newRun(seed);
        s.spare = 0;
        s.chunks = structuredClone(chunks.slice(Math.max(0, i - 1), i + 3));
        s.course.end = 1e9;
        const before = s.chunks.flatMap((c) => c.roofs).find((r) => r.x1 === g.x0);
        const x = Math.max(before.x0 + 10, g.x0 - 0.8 * speedAt(g.x0));
        Object.assign(s.runner, { x, y: before.top, grounded: true });
        s.startX = x;
        const lost = drive(s, { seconds: 5, stopX: g.x1 + 60 });
        assert.deepEqual(lost, [], `${g.assist} gap at ${g.x0} on seed ${seed}`);
        assert.ok(s.runner.x >= g.x1 + 60);
        seen.add(g.assist);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 20);
  assert.deepEqual([...seen].sort(), ["awning", "boards", "cable", "vent"]);
});

// --- Reaching what the generator places -----------------------------------------------
//
// The reference player makes one input from a standing start on a roof or a
// plank before the target, and the engine flies it on a copy of the run, with
// no rush and so no magnet. It runs on, slides, or jumps holding for one of a
// few times, gliding or not on the way down. A target counts as reachable
// when one input takes all of it from two take-offs REACH_SLACK seconds of
// running apart, with no hit or fall, and a safe touchdown after.

const REACH_SLACK = 0.03;
const REACH_INPUTS = [{ kind: "run" }, { kind: "slide" }];
for (const hold of [H, 0.05, 0.1, 0.15, HOLD_TIME]) {
  for (const glide of [false, true]) REACH_INPUTS.push({ kind: "jump", hold, glide });
}
const BLOCKING = new Set(["ac", "tank", "crate", "clothesline", "billboard", "wire", "skylight", "neon", "steam"]);
const FAILS = new Set(["hit", "wall", "fall", "dry", "lethal", "over"]);

/** Each pearl group (an arc or line placed together, or a lone pearl), and each spare on its own. */
function targetsIn(chunk) {
  const groups = new Map();
  for (const o of chunk.items) {
    const key = o.type === "pearl" ? `pearls ${o.group}` : o.type === "spare" ? `spare ${o.x}` : null;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, items }));
}

/** Plays one input from a standing start and says whether it took every item of the target. */
function takesAll(seed, slice, target, at, input, expert = false) {
  const s = newRun(seed, { expert });
  s.chunks = structuredClone(slice);
  s.course.end = 1e9;
  s.spare = 0;
  const live = s.chunks.flatMap((c) => c.items);
  if (live.some((o) => BLOCKING.has(o.type) && at.x + RUNNER_W / 2 > o.x0 && at.x - RUNNER_W / 2 < o.x1 && at.y + RUNNER_H > o.y0 && at.y < o.y1)) return false;
  Object.assign(s.runner, { x: at.x, y: at.y, grounded: true });
  s.startX = at.x;
  const items = live.filter((o) => target.items.some((t) => t.type === o.type && t.x === o.x && t.y === o.y && t.group === o.group));
  let t = 0;
  let taken = false;
  for (let i = 0; i < 4 / H; i++) {
    const r = s.runner;
    let keys = IDLE;
    if (input.kind === "slide") keys = { down: true };
    else if (input.kind === "jump") keys = { jump: t < input.hold - 1e-9 || (input.glide && !r.grounded && r.vy <= 0) };
    const events = step(s, keys, H);
    t += H;
    if (events.some((e) => FAILS.has(e.type))) return false;
    if (taken) {
      if (r.grounded || r.cable) return true;
    } else if (items.every((o) => o.taken)) {
      taken = true;
    } else if (items.some((o) => !o.taken && r.x - RUNNER_W / 2 > o.x + SPARE_RADIUS)) {
      return false; // run past one it can no longer reach
    }
  }
  return false;
}

/** Searches take-offs from just before the target backward, nearest first. */
function reachTarget(seed, chunks, index, target, expert = false) {
  const slice = chunks.slice(Math.max(0, index - 1), index + 3);
  const first = Math.min(...target.items.map((o) => o.x));
  const v = speedAt(first, expert);
  const stride = REACH_SLACK * v;
  const from = chunks[index].x0 - 0.5 * v;
  const spots = [];
  for (const c of slice) {
    const surfaces = [
      ...c.roofs.map((r) => ({ x0: r.x0, x1: r.x1, y: r.top })),
      ...c.items.filter((o) => o.type === "ledge" || o.type === "boards").map((o) => ({ x0: o.x0, x1: o.x1, y: o.y })),
    ];
    for (const sf of surfaces) {
      for (let x = Math.min(sf.x1 + RUNNER_W / 2 - 0.5, first + 4); x - stride >= Math.max(sf.x0, from); x -= stride) spots.push({ x, y: sf.y });
    }
  }
  spots.sort((a, b) => b.x - a.x);
  for (const at of spots) {
    for (const input of REACH_INPUTS) {
      if (takesAll(seed, slice, target, at, input, expert) && takesAll(seed, slice, target, { x: at.x - stride, y: at.y }, input, expert)) return true;
    }
  }
  return false;
}

test("every pearl group, lone pearl and spare cup can be taken whole by one input, with a little slack", () => {
  let checked = 0;
  let spares = 0;
  const failed = [];
  for (const seed of SEEDS) {
    for (const start of [0, 8000, 16000, 24000, 32000, 40000]) {
      const chunks = buildCourse(seed, 5000, start);
      chunks.forEach((chunk, index) => {
        for (const target of targetsIn(chunk)) {
          checked += 1;
          if (target.key.startsWith("spare")) spares += 1;
          if (!reachTarget(seed, chunks, index, target)) failed.push(`${target.key} (${target.items.length}) in ${chunk.pattern} at ${target.items[0].x} on seed ${seed}`);
        }
      });
    }
  }
  assert.deepEqual(failed, []);
  assert.ok(checked > 1000, `${checked} checked`);

  // Spares come too rarely for those stretches: check every one on long courses.
  for (const [seed, expert] of [...SEEDS.map((seed) => [seed, false]), ...SEEDS.slice(0, 6).map((seed) => [seed, true])]) {
    const chunks = buildCourse(seed, 90000, 0, { expert });
    chunks.forEach((chunk, index) => {
      for (const target of targetsIn(chunk)) {
        if (!target.key.startsWith("spare")) continue;
        spares += 1;
        if (!reachTarget(seed, chunks, index, target, expert)) failed.push(`${target.key} in ${chunk.pattern} on seed ${seed}${expert ? " (expert)" : ""}`);
      }
    });
  }
  assert.deepEqual(failed, []);
  assert.ok(spares >= 60, `${spares} spares checked`);
});

test("just running off the roof onto an awning takes its arc and the line after", () => {
  let checked = 0;
  for (const seed of SEEDS) {
    for (const start of [6000, 20000, 40000]) {
      const chunks = buildCourse(seed, 12000, start);
      chunks.forEach((chunk, index) => {
        if (chunk.pattern !== "awning") return;
        const roof = chunk.roofs[0];
        const at = { x: Math.max(roof.x0 + 4, roof.x1 - 0.6 * speedAt(roof.x1)), y: roof.top };
        const slice = chunks.slice(Math.max(0, index - 1), index + 3);
        for (const target of targetsIn(chunk)) {
          assert.ok(takesAll(seed, slice, target, at, { kind: "run" }), `${target.key} at ${target.items[0].x} on seed ${seed}`);
          checked += 1;
        }
      });
    }
  }
  assert.ok(checked > 20, `${checked} checked`);
});

/** Every spare on the courses given, with the chunk it sits in. */
function sparesIn(courses) {
  const found = [];
  courses.forEach((chunks, k) => chunks.forEach((c, index) => {
    for (const o of c.items) if (o.type === "spare") found.push({ course: k, chunks, index, chunk: c, spare: o });
  }));
  return found;
}

test("spare cups are rare: none early, then one every fourteen thousand units or so, only over something lethal", () => {
  const hard = new Set(PATTERNS.filter((p) => p.hard).map((p) => p.id));
  assert.deepEqual([...hard].sort(), ["railGap", "skylight"]);
  for (const id of hard) assert.ok(PATTERNS.find((p) => p.id === id).lethal, `${id} is lethal`);
  const gaps = [];
  for (const seed of SEEDS) {
    for (const start of [0, 20000]) {
      const chunks = buildCourse(seed, 80000, start);
      const xs = [];
      for (const c of chunks) {
        for (const o of c.items) {
          if (o.type !== "spare") continue;
          assert.ok(hard.has(c.pattern), `a spare in ${c.pattern}`);
          xs.push(o.x);
        }
      }
      assert.ok(xs.length >= 3, `${xs.length} spares on seed ${seed}`);
      assert.ok(xs[0] - start >= NORMAL.spareFirst, `first spare ${xs[0] - start} in`);
      for (let i = 1; i < xs.length; i++) {
        assert.ok(xs[i] - xs[i - 1] >= NORMAL.spareGap[0], `spares ${xs[i] - xs[i - 1]} apart`);
        gaps.push(xs[i] - xs[i - 1]);
      }
    }
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  // The old rate was about one every five thousand.
  assert.ok(median >= 15000 && median <= 24000, `median ${median}`);
});

test("every spare hangs low over something lethal, and the line that takes it lands a moment from the end", () => {
  const found = sparesIn(SEEDS.map((seed) => buildCourse(seed, 60000, 0)));
  assert.ok(found.length >= 40, `${found.length} spares`);
  for (const { chunk, spare: o } of found) {
    const v = speedAt(o.x);
    // Its end: the far edge of the glass, or of the railway.
    let end = 0;
    let level = 0;
    if (chunk.pattern === "skylight") {
      const glass = chunk.items.find((i) => i.type === "skylight");
      end = glass.x1;
      level = glass.y1;
    } else {
      const gap = chunk.gaps.find((g) => g.assist === "rail");
      end = gap.x1;
      level = chunk.roofs.find((r) => r.x0 === gap.x1).top;
    }
    assert.ok(o.x > end - 20 && o.x < end + 0.15 * v, `${Math.round(o.x - end)} past the end in ${chunk.pattern}`);
    assert.ok(o.y - level < 30, `${o.y - level} high in ${chunk.pattern}`);
  }
  // A full jump that takes it, made a tenth of a second earlier, is the end.
  let risky = 0;
  for (const { chunks, index, chunk, spare: o } of found.slice(0, 16)) {
    const slice = chunks.slice(Math.max(0, index - 1), index + 3);
    const v = speedAt(o.x);
    const roof = chunk.roofs.find((r) => r.x0 <= o.x - 0.5 * v && r.x1 > o.x - 0.5 * v);
    let earliest = Infinity;
    for (let x = Math.max(roof.x0 + 10, o.x - 1.1 * v); x < Math.min(o.x, roof.x1 + RUNNER_W / 2); x += 1) {
      if (takesAll(1, slice, { items: [o] }, { x, y: roof.top }, { kind: "jump", hold: HOLD_TIME, glide: false })) {
        earliest = x;
        break;
      }
    }
    assert.ok(earliest < Infinity, `spare at ${o.x} taken by a full jump`);
    const s = newRun(1);
    s.chunks = structuredClone(slice);
    s.course.end = 1e9;
    s.spare = 2;
    Object.assign(s.runner, { x: earliest - 0.1 * v, y: roof.top, grounded: true });
    const events = run(s, (_, i) => ({ jump: i < Math.ceil(HOLD_TIME / H) }), 2, (st) => st.status !== "running");
    if (kinds(events, "lethal").length) risky += 1;
  }
  assert.equal(risky, Math.min(16, found.length));
});

test("the safe line never takes a spare: a plain full jump at the natural moment passes over each one", () => {
  // The bot's reflex alone: no lookahead, no interest in spares, a full jump
  // over anything lethal as it comes into reach.
  let passed = 0;
  for (const { chunks, index, chunk } of sparesIn(SEEDS.map((seed) => buildCourse(seed, 60000, 0)))) {
    const s = newRun(1);
    s.chunks = structuredClone(chunks.slice(index - 1, index + 3));
    s.course.end = 1e9;
    s.spare = 0;
    const first = chunk.roofs[0];
    Object.assign(s.runner, { x: first.x0 + 10, y: first.top, grounded: true });
    s.startX = s.runner.x;
    const mem = { t: 0, done: false, high: false };
    const events = run(s, (st) => reflex(st, mem), 6, (st) => st.runner.x > chunk.x1 - 20 || st.status !== "running");
    const lost = events.filter((e) => FAILS.has(e.type)).map((e) => e.type);
    assert.deepEqual(lost, [], `${chunk.pattern} at ${chunk.x0}`);
    assert.equal(s.stats.spares, 0, `${chunk.pattern} at ${chunk.x0}: the safe line took the spare`);
    passed += 1;
  }
  assert.ok(passed >= 40, `${passed} checked`);
});

test("expert: no spare to start, spares several times rarer still, and lethal pieces earlier and more often", () => {
  assert.equal(EXPERT.startSpares, 0);
  assert.ok(EXPERT.spareFirst >= 3 * NORMAL.spareFirst);
  assert.ok(EXPERT.spareGap[0] >= 2.5 * NORMAL.spareGap[0]);
  const long = (expert) => SEEDS.slice(0, 10).map((seed) => buildCourse(seed, 150000, 0, { expert }));
  const normalSpares = sparesIn(long(false)).length / 10;
  const expertSpares = sparesIn(long(true)).length / 10;
  assert.ok(expertSpares * 2.5 <= normalSpares, `${expertSpares} against ${normalSpares} in 150,000 units`);

  const lethal = new Set(PATTERNS.filter((p) => p.lethal).map((p) => p.id));
  const firstLethal = (chunks) => chunks.find((c) => lethal.has(c.pattern))?.x0 ?? Infinity;
  const share = (courses, upTo) => {
    let all = 0;
    let deadly = 0;
    for (const chunks of courses) for (const c of chunks) if (c.x0 < upTo) (all += 1), (deadly += lethal.has(c.pattern) ? 1 : 0);
    return deadly / all;
  };
  const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const normalFirst = median(COURSES.map(firstLethal));
  const expertFirst = median(EXPERT_COURSES.map(firstLethal));
  assert.ok(expertFirst * 2.5 < normalFirst, `first lethal piece at ${expertFirst} in expert, ${normalFirst} in normal`);
  assert.ok(share(EXPERT_COURSES, 10000) > 2 * share(COURSES, 10000), "far more of the first stretch can kill");
  assert.ok(share(EXPERT_COURSES, 30000) > 1.5 * share(COURSES, 30000), "and more of the rest");
});

// --- Whole runs ------------------------------------------------------------------------------

test("the same seed and inputs replay to the identical state", () => {
  const inputs = [];
  const random = createRng(77);
  for (let i = 0; i < 4000; i++) inputs.push({ jump: random() < 0.3, down: random() < 0.05, rush: random() < 0.01 });
  for (const expert of [false, true]) {
    const a = newRun(12, { expert });
    const b = newRun(12, { expert });
    const eventsA = inputs.map((input) => step(a, input, H));
    const eventsB = inputs.map((input) => step(b, input, H));
    assert.deepEqual(a, b);
    assert.deepEqual(eventsA, eventsB);
  }
  assert.notDeepEqual(newRun(12).chunks, newRun(13).chunks);
});

test("doing nothing ends the run", () => {
  for (const seed of SEEDS) {
    const s = newRun(seed);
    const events = run(s, IDLE, 180, (st) => st.status === "over");
    assert.equal(s.status, "over", `seed ${seed}`);
    assert.equal(kinds(events, "over").length, 1);
  }
});

for (const [label, startDistance, expert, seeds] of [
  ["the first chunk", 0, false, SEEDS],
  ["middling difficulty", 12000, false, SEEDS],
  ["full difficulty and top speed", 42000, false, SEEDS],
  ["the start of an expert run", 0, true, SEEDS.slice(0, 10)],
  ["expert at full difficulty", 20000, true, SEEDS.slice(0, 10)],
]) {
  test(`a competent bot runs 6,000 units from ${label} without losing a cup`, () => {
    for (const seed of seeds) {
      const s = newRun(seed, { startDistance, expert });
      const lost = drive(s, { distance: 6000 });
      assert.deepEqual(lost, [], `seed ${seed}`);
      assert.equal(s.status, "running");
      assert.equal(s.stats.sparesUsed, 0);
      assert.ok(s.distance >= 6000);
      assert.ok(s.stats.deliveries > 0);
    }
  });
}
