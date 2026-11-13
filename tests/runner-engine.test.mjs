import assert from "node:assert/strict";
import test from "node:test";

import {
  BOUNCE_SPEED,
  BUFFER_TIME,
  BUMP_SPILL,
  COMBO_WINDOW,
  COYOTE_TIME,
  CRATE_POINTS,
  DELIVERY_BASE,
  DRY_REFILL,
  FULL_CUP,
  FULL_CUP_BONUS,
  GLIDE_FALL,
  GLIDE_TIME,
  GRACE_TIME,
  HOLD_TIME,
  MANTLE,
  MAX_COMBO,
  MAX_LANDING_SPILL,
  MAX_TOP,
  MIN_TOP,
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
  SLAM_SPILL,
  SLIDE_H,
  SLIDE_MAX,
  SLIDE_TIME,
  SPARE_BONUS,
  SPARE_FIRST,
  SPARE_GAP,
  SPARE_RADIUS,
  SPEED_RAMP,
  START_SPEED,
  STEP,
  STUMBLE_SLOW,
  SUGAR_FULL,
  TOP_SPEED,
  breakdown,
  buildCourse,
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
  phaseAt,
  runnerBox,
  speedAt,
  step,
} from "../src/lib/arcade/runner-engine.js";

const H = STEP;
const IDLE = {};
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

// --- Helpers ------------------------------------------------------------------------

/**
 * A hand-built stretch of rooftop with nothing generated after it, for
 * testing one rule at a time. The runner stands on the first roof.
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
      gaps: [],
    },
  ];
  s.course.end = 1e9;
  Object.assign(s.runner, { x: at.x ?? Math.max(roofs[0].x0 + 40, 100), y: at.y ?? roofs[0].top, grounded: at.y === undefined });
  s.startX = s.runner.x;
  return s;
}

const floor = (top = 100) => [{ x0: -2000, x1: 1e6, top }];
const obstacle = (type, x, top, w, h, y0 = top) => ({ type, x0: x, x1: x + w, y0, y1: y0 + h, count: 1, hit: false, broken: false });
const pearl = (x, y) => ({ type: "pearl", x, y, taken: false, group: 1 });
const spare = (x, y) => ({ type: "spare", x, y, taken: false });
const coaster =(x, y) => ({ type: "coaster", x0: x - 12, x1: x + 12, y, customer: true, hard: false, done: null });

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

// --- The reference bot ----------------------------------------------------------------
//
// A competent player that can read the chunk data. It tries a menu of short
// input plans (jump now or a little later, tap or hold, glide, slide, slam)
// against copies of the run, picks the one that keeps the cup safest, and
// hands over to a simple reflex between plans. If it can run thousands of
// units without a life lost, the course is fair at the speeds it appears at.

/** A cheap reflex for after a plan: jump at edges and solids, slide under low things, glide down. */
function reflex(s) {
  const r = s.runner;
  const rush = s.sugar >= SUGAR_FULL && s.rush === 0 && !s.held.rush;
  if (r.cable) return { rush };
  if (!r.grounded) return { jump: r.vy < 0, rush };
  const front = r.x + RUNNER_W / 2;
  const look = r.vx * 0.16;
  let jump = false;
  let down = false;
  let ground = false;
  for (const c of s.chunks) {
    if (c.x1 < r.x - 50 || c.x0 > front + look + 50) continue;
    for (const roof of c.roofs) {
      const ahead = roof.x0 - front;
      if (ahead >= 0 && ahead <= look && roof.top > r.y + MANTLE) jump = true;
      if (roof.x0 <= front + look && roof.x1 >= front + look && roof.top >= r.y - 150 && roof.top <= r.y + MANTLE) ground = true;
    }
    for (const o of c.items) {
      if (o.type === "ledge" && o.x0 <= front + look && o.x1 >= front + look && Math.abs(o.y - r.y) < 0.1) ground = true;
      if (o.hit || o.broken) continue;
      if (o.type === "ac" || o.type === "tank" || o.type === "crate") {
        if (o.x0 <= front + look && o.x1 >= front + look && Math.abs(o.y1 - r.y) < 0.1) ground = true;
        const ahead = o.x0 - front;
        if (ahead >= 0 && ahead <= look && o.y1 > r.y + 0.1 && o.y0 < r.y + RUNNER_H) jump = true;
      } else if (o.type === "clothesline" || o.type === "billboard") {
        const ahead = o.x0 - front;
        if (ahead >= -4 && ahead <= r.vx * 0.08 + 4 && o.y0 < r.y + RUNNER_H && o.y1 > r.y) down = true;
      }
    }
  }
  if (!ground) jump = true;
  if (down) return { down: r.sliding || !s.held.down, rush };
  if (jump) return { jump: !s.held.jump, rush };
  return { rush };
}

const plan = (kind, delay = 0, hold = 0, slamAt = -1) => ({ kind, delay, hold, slamAt });
const PLANS = [plan("reflex")];
for (const d of [0, 0.03, 0.06, 0.1, 0.15, 0.2, 0.27, 0.35, 0.45]) {
  for (const h of [H, 0.07, 0.14, 0.3, Infinity]) PLANS.push(plan("jump", d, h));
}
for (const d of [0, 0.08, 0.16, 0.25]) for (const a of [0.25, 0.4, 0.55]) PLANS.push(plan("jump", d, 0.3, a));
for (const d of [0, 0.1, 0.2]) for (const a of [0.15, 0.3]) PLANS.push(plan("jump", d, H, a));
for (const d of [0, 0.05, 0.1, 0.2, 0.3]) PLANS.push(plan("slam", d));
for (const d of [0, 0.05, 0.1, 0.18, 0.28]) for (const h of [H, 0.8]) PLANS.push(plan("slide", d, h));

function planInput(p, ctx, s) {
  if (p.kind === "reflex" || ctx.done) return reflex(s);
  const { t } = ctx;
  const r = s.runner;
  const rush = s.sugar >= SUGAR_FULL && s.rush === 0 && !s.held.rush;
  let jump = false;
  let down = false;
  let end = p.delay;
  if (p.kind === "jump") {
    jump = p.hold === Infinity ? t >= p.delay && !(r.grounded && t > p.delay + 0.05) : t >= p.delay && t < p.delay + p.hold;
    if (p.slamAt >= 0) down = Math.abs(t - (p.delay + p.slamAt)) < H / 2;
    end = p.delay + Math.max(p.hold === Infinity ? 0.05 : p.hold, p.slamAt) + H;
  } else if (p.kind === "slam") {
    down = Math.abs(t - p.delay) < H / 2;
    end = p.delay + H;
  } else {
    down = t >= p.delay && t < p.delay + p.hold;
    end = p.delay + p.hold;
  }
  if (t > end && (r.grounded || r.cable)) {
    ctx.done = true;
    return reflex(s);
  }
  return { jump, down, rush };
}

/** Plays a plan forward on a copy of the run and scores what happened. */
function evaluate(s0, p, ctx0) {
  const s = cloneRun(s0);
  const ctx = { ...ctx0 };
  let penalty = 0;
  let bonus = 0;
  const n = Math.round(1.3 / H);
  let tail = 0;
  for (let i = 0; i < n + tail; i++) {
    const events = step(s, planInput(p, ctx, s), H);
    ctx.t += H;
    for (const e of events) {
      if (e.type === "fall") penalty += 1e6 - i;
      else if (e.type === "wall") penalty += 5e5;
      else if (e.type === "dry") penalty += 3e5;
      else if (e.type === "bump") penalty += 3000;
      else if (e.type === "spill") penalty += 4000 * e.amount;
      else if (e.type === "miss") penalty += 300;
      else if (e.type === "delivery") bonus += 400 + 400 * e.tea;
      else if (e.type === "pearl") bonus += 15;
      else if (e.type === "smash") bonus += 40;
    }
    if (s.status !== "running") break;
    // A plan that ends in the air is followed down, so a late fall still counts.
    if (i === n - 1 && !s.runner.grounded) tail = Math.round(0.8 / H);
    if (tail && i >= n && s.runner.grounded) break;
  }
  return { penalty, value: bonus - penalty };
}

/** Drives a run with the bot until it has gone `distance` further, or for `seconds`. */
function drive(s, { distance = Infinity, seconds = 120, stopX = Infinity } = {}) {
  let p = PLANS[0];
  let ctx = { t: 0, done: false };
  const lost = [];
  const from = s.distance;
  for (let i = 0; i < seconds / H && s.distance - from < distance && s.runner.x < stopX && s.status !== "over"; i++) {
    if (i % 6 === 0) {
      const current = evaluate(s, p, ctx);
      if (current.penalty > 20) {
        let best = current.value;
        for (const candidate of PLANS) {
          const e = evaluate(s, candidate, { t: 0, done: false });
          if (e.value > best + 1) {
            best = e.value;
            p = candidate;
            ctx = { t: 0, done: false };
          }
        }
      }
    }
    for (const e of step(s, planInput(p, ctx, s), H)) {
      if (e.type === "fall" || e.type === "dry") {
        const chunk = s.chunks.find((c) => c.x0 <= e.x && c.x1 >= e.x);
        lost.push(`${e.type} at ${Math.round(e.x)} in ${chunk?.pattern}`);
      }
    }
    ctx.t += H;
  }
  return lost;
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

test("speed climbs smoothly from 150 to 330 over about three minutes", () => {
  assert.equal(speedAt(0), START_SPEED);
  assert.equal(speedAt(SPEED_RAMP), TOP_SPEED);
  assert.equal(speedAt(SPEED_RAMP * 3), TOP_SPEED);
  let last = 0;
  for (let x = 0; x <= SPEED_RAMP; x += 500) {
    assert.ok(speedAt(x) > last);
    last = speedAt(x);
  }
  let x = 0;
  let seconds = 0;
  while (x < SPEED_RAMP) {
    x += speedAt(x) * H;
    seconds += H;
  }
  assert.ok(seconds > 160 && seconds < 200, `${seconds}s to top speed`);
  assert.equal(difficultyAt(0), 0);
  assert.equal(difficultyAt(1e6), 1);
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

test("a slide ducks under a billboard that stops a standing runner", () => {
  const board = () => [obstacle("billboard", 300, 100, 80, 100, 111)];
  const standing = stage(floor(), board(), { x: 100 });
  assert.equal(kinds(run(standing, IDLE, 2), "bump").length, 1);

  const sliding = stage(floor(), board(), { x: 100 });
  const events = run(sliding, (st) => ({ down: st.runner.x > 240 }), 2.5);
  assert.equal(kinds(events, "bump").length, 0);
  assert.ok(sliding.runner.x > 420);
  assert.equal(kinds(events, "slide").length, 1);
  assert.equal(runnerBox({ ...sliding.runner, sliding: true }).y1 - sliding.runner.y, SLIDE_H);
});

test("a slide lasts SLIDE_TIME, stretches to SLIDE_MAX when held, and slides off edges", () => {
  const timeSlide = (input) => {
    const s = stage(floor());
    const events = run(s, input, 2, (st, ev) => kinds(ev, "slideEnd").length > 0);
    assert.equal(kinds(events, "slide").length, 1);
    return s.time;
  };
  assert.ok(Math.abs(timeSlide((_, i) => ({ down: i === 0 })) - SLIDE_TIME) < 2 * H);
  assert.ok(Math.abs(timeSlide({ down: true }) - SLIDE_MAX) < 2 * H);

  const s = stage([{ x0: -2000, x1: 140, top: 100 }, { x0: 160, x1: 1e6, top: 60 }], [], { x: 100 });
  run(s, (_, i) => ({ down: i === 0 }), 0.4);
  assert.equal(s.runner.grounded, false);
  assert.equal(s.runner.sliding, true, "still sliding in the air");
});

test("a bump sloshes tea, stumbles, resets the combo, and grants a grace period", () => {
  const s = stage(
    floor(),
    [pearl(150, 109), pearl(170, 109), pearl(190, 109), obstacle("ac", 260, 100, 24, 16), obstacle("ac", 300, 100, 24, 16)],
    { x: 100 },
  );
  const before = run(s, IDLE, 1, (st) => st.runner.x > 200);
  assert.equal(kinds(before, "pearl").length, 3);
  assert.equal(s.combo.chain, 3);
  const events = run(s, IDLE, 1, (_, ev) => kinds(ev, "bump").length > 0);
  assert.equal(kinds(events, "spill")[0].cause, "bump");
  assert.ok(Math.abs(s.tea - (1 - BUMP_SPILL)) < 1e-9);
  assert.equal(kinds(events, "comboLost").length, 1);
  assert.equal(s.combo.chain, 0);
  assert.equal(s.runner.grace, GRACE_TIME);
  run(s, IDLE, H);
  assert.ok(s.runner.vx < speedAt(s.runner.x) * (1 - STUMBLE_SLOW * 0.9), "stumbles");
  const after = run(s, IDLE, 0.8);
  assert.equal(kinds(after, "bump").length, 0, "the second unit falls in the grace period");
  assert.ok(s.runner.x > 330);
  assert.ok(Math.abs(s.runner.vx / speedAt(s.runner.x) - 1) < 0.001, "and recovers");
  assert.equal(s.stats.bumps, 1);
});

test("a combo lapses after COMBO_WINDOW without a pearl", () => {
  const s = stage(floor(), [pearl(150, 109)], { x: 100 });
  run(s, IDLE, 0.5);
  assert.equal(s.combo.chain, 1);
  const events = run(s, IDLE, COMBO_WINDOW);
  assert.equal(kinds(events, "comboLost").length, 1);
});

test("standing on top of an obstacle is fine; running off it is too", () => {
  const s = stage(floor(), [obstacle("tank", 300, 100, 34, 34)], { x: 100 });
  const events = run(s, (st) => ({ jump: st.runner.grounded && st.runner.x > 268 && st.runner.x < 280 }), 2);
  assert.equal(kinds(events, "bump").length, 0);
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
  assert.equal(kinds(events, "bump").length, 0);
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
  const roofs = [{ x0: -2000, x1: 500, top: 100 }, { x0: 800, x1: 1e6, top: 110 }];
  assert.ok(300 > glideReach(speedAt(500), 10) + RUNNER_W);
  const s = stage(roofs, [{ type: "vent", x0: 516, x1: 782, y0: 0, ceiling: 210 }], { x: 400 });
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

test("pigeons are harmless underfoot but spill tea if jumped into", () => {
  const flock = () => [600, 612, 624].map((x) => ({ type: "pigeon", x, y: 100, vx: 45, vy: 60, delay: 0, state: "sit", t: 0 }));
  const low = stage(floor(), flock(), { x: 300 });
  const events = run(low, IDLE, 3);
  assert.equal(kinds(events, "pigeonsUp").reduce((n, e) => n + e.count, 0), 3);
  assert.equal(kinds(events, "strike").length, 0);
  assert.equal(low.tea, 1);

  // A full jump at the flock flies into the rising birds; a tap stays under them.
  const jumpAt = (lead, steps) => {
    const s = stage(floor(), flock(), { x: 300 });
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
    if (kinds(full, "strike").length) {
      struck += 1;
      assert.equal(kinds(full, "spill")[0].cause, "pigeon");
    }
    assert.equal(kinds(jumpAt(lead, 1), "strike").length, 0, "a tap passes under");
  }
  assert.ok(struck > 0, "some jump into the flock strikes it");
});

// --- Deliveries, sugar, the one cup ----------------------------------------------------

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
});

test("jumping over a coaster misses it and breaks the streak", () => {
  const s = stage(floor(), [coaster(300, 100)], { x: 100 });
  s.streak = 3;
  const events = run(s, (st) => ({ jump: st.runner.x > 240 && st.runner.x < 300 }), 2);
  assert.equal(kinds(events, "delivery").length, 0);
  assert.equal(kinds(events, "miss").length, 1);
  assert.equal(s.streak, 0);
  assert.equal(s.stats.missed, 1);
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
  assert.equal(kinds(during, "bump").length, 0);
  assert.deepEqual(kinds(during, "smash").map((e) => e.what), ["billboard", "ac"]);
  assert.equal(kinds(during, "pearl")[0].magnet, true);
  assert.equal(s.tea, 1);

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
  const s = stage(GAP_ROOFS, [], { x: 400 });
  s.spare = 1;
  s.tea = 0.3;
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
  assert.equal(s.tea, DRY_REFILL);

  // The next fall, with no spare left, is the end.
  const again = run(s, IDLE, 20, (st) => st.status !== "running");
  assert.equal(kinds(again, "over").length, 1);
});

test("a dry cup ends the run; with a spare it is saved the same way", () => {
  const roofs = [{ x0: -2000, x1: 600, top: 100 }, { x0: 620, x1: 1e6, top: 100 }];
  const dry = stage(roofs, [obstacle("ac", 300, 100, 24, 16)], { x: 100 });
  dry.tea = 0.05;
  const ended = run(dry, IDLE, 2, (st) => st.status !== "running");
  assert.equal(kinds(ended, "dry").length, 1);
  assert.equal(kinds(ended, "over")[0].cause, "dry");
  assert.equal(dry.status, "over");

  const saved = stage(roofs, [obstacle("ac", 300, 100, 24, 16)], { x: 100 });
  saved.tea = 0.05;
  saved.spare = 1;
  const events = run(saved, IDLE, 2, (st) => st.status !== "running");
  assert.equal(kinds(events, "dry").length, 1);
  assert.equal(kinds(events, "spareUsed")[0].cause, "dry");
  assert.equal(saved.status, "respawning");
  assert.equal(saved.spare, 0);
  const back = run(saved, IDLE, RESPAWN_TIME + H);
  assert.deepEqual(kinds(back, "respawn").map((e) => [e.x, e.y]), [[636, 100]]);
  assert.equal(saved.tea, DRY_REFILL);
  assert.ok(saved.runner.grace > RESPAWN_GRACE - 0.1);
});

test("a spare cup is kept, at most one, and another is worth points instead", () => {
  const s = stage(floor(), [spare(200, 108), spare(400, 108), pearl(600, 109)], { x: 100 });
  const first = run(s, IDLE, 2, (st) => st.runner.x > 300);
  assert.deepEqual(kinds(first, "spare").map((e) => [e.x, e.y]), [[200, 108]]);
  assert.equal(s.spare, 1);
  const second = run(s, IDLE, 2, (st) => st.runner.x > 500);
  assert.equal(kinds(second, "spare").length, 0);
  assert.deepEqual(kinds(second, "spareBonus").map((e) => e.points), [SPARE_BONUS]);
  assert.equal(s.spare, 1, "still only one");
  assert.equal(s.stats.spares, 2);
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
  const items = [pearl(150, 109), coaster(300, 100), obstacle("ac", 500, 100, 24, 16), spare(700, 108), spare(800, 108)];
  const s = stage(floor(), items, { x: 100 });
  run(s, IDLE, 5);
  const b = breakdown(s);
  assert.equal(b.score, b.distancePoints + b.pearlPoints + b.deliveryPoints + b.smashPoints + b.sparePoints);
  assert.equal(b.pearls, 1);
  assert.equal(b.deliveries, 1);
  assert.equal(b.bumps, 1);
  assert.equal(b.spares, 2);
  assert.equal(b.sparesUsed, 0);
  assert.equal(b.sparePoints, SPARE_BONUS);
  assert.ok(b.distance > 50);
});

// --- The generator ----------------------------------------------------------------------------

const COURSES = SEEDS.map((seed) => buildCourse(seed, 40000));

test("there are at least sixteen patterns and every one turns up", () => {
  assert.ok(PATTERNS.length >= 16);
  assert.equal(new Set(PATTERNS.map((p) => p.id)).size, PATTERNS.length);
  const seen = new Set(COURSES.flat().map((c) => c.pattern));
  for (const p of PATTERNS) assert.ok(seen.has(p.id), `${p.id} never generated`);
});

test("the generator never repeats a pattern back to back and respects each minimum", () => {
  const min = Object.fromEntries(PATTERNS.map((p) => [p.id, p.min]));
  for (const chunks of COURSES) {
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      assert.ok(min[c.pattern] <= c.difficulty, `${c.pattern} at ${c.difficulty}`);
      if (i > 0) {
        assert.notEqual(c.pattern, chunks[i - 1].pattern);
        assert.equal(c.x0, chunks[i - 1].x1, "chunks join up");
      }
    }
  }
});

test("a seed always builds the same course, and seeds differ", () => {
  assert.deepEqual(buildCourse(5, 8000), buildCourse(5, 8000));
  assert.notDeepEqual(buildCourse(5, 8000), buildCourse(6, 8000));
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
      }
    }
  }
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
  assert.ok(early >= 330 && early < 450, `early median ${early}`);
  assert.ok(late > early && late < 700, `late median ${late}`);
});

test("every plain gap is clearable at the speed it appears at", () => {
  let checked = 0;
  for (const chunks of COURSES) {
    for (const c of chunks) {
      for (const g of c.gaps) {
        const speed = speedAt(g.x0);
        const width = g.x1 - g.x0;
        if (g.assist === null) {
          // Taking off with the box's back edge on the roof and landing with
          // its front edge on the next; the generator keeps a full width spare.
          assert.ok(width <= jumpReach(speed, g.dy) - RUNNER_W, `${c.pattern} gap ${width} at ${Math.round(speed)}`);
          checked += 1;
        } else if (g.assist === "drop") {
          assert.ok(g.dy < 0);
          assert.ok(width <= fallReach(speed, -g.dy) + RUNNER_W, `${c.pattern} drop ${width}`);
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 1000);
});

test("every assisted gap (awning, vent, cable) is crossed by the bot from a standing start", () => {
  let checked = 0;
  for (const seed of SEEDS.slice(0, 8)) {
    const chunks = buildCourse(seed, 40000);
    for (let i = 0; i < chunks.length; i++) {
      for (const g of chunks[i].gaps) {
        if (g.assist === null || g.assist === "drop") continue;
        const s = newRun(seed);
        s.chunks = structuredClone(chunks.slice(Math.max(0, i - 1), i + 3));
        s.course.end = 1e9;
        const before = s.chunks.flatMap((c) => c.roofs).find((r) => r.x1 === g.x0);
        const x = Math.max(before.x0 + 10, g.x0 - 0.8 * speedAt(g.x0));
        Object.assign(s.runner, { x, y: before.top, grounded: true });
        s.startX = x;
        const lost = drive(s, { seconds: 5, stopX: g.x1 + 60 });
        assert.deepEqual(lost, [], `${g.assist} gap at ${g.x0} on seed ${seed}`);
        assert.ok(s.runner.x >= g.x1 + 60);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 20);
});

// --- Reaching what the generator places -----------------------------------------------
//
// The reference player makes one input from a standing start on a roof or a
// plank before the target, and the engine flies it on a copy of the run, with
// no rush and so no magnet. It runs on, slides, or jumps holding for one of a
// few times, gliding or not on the way down. A target counts as reachable
// when one input takes all of it from two take-offs REACH_SLACK seconds of
// running apart, with no bump or fall, and a safe touchdown after.

const REACH_SLACK = 0.03;
const REACH_INPUTS = [{ kind: "run" }, { kind: "slide" }];
for (const hold of [H, 0.05, 0.1, 0.15, HOLD_TIME]) {
  for (const glide of [false, true]) REACH_INPUTS.push({ kind: "jump", hold, glide });
}
const BLOCKING = new Set(["ac", "tank", "crate", "clothesline", "billboard"]);

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
function takesAll(seed, slice, target, at, input) {
  const s = newRun(seed);
  s.chunks = structuredClone(slice);
  s.course.end = 1e9;
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
    if (events.some((e) => e.type === "bump" || e.type === "wall" || e.type === "strike" || e.type === "fall" || e.type === "dry")) return false;
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
function reachTarget(seed, chunks, index, target) {
  const slice = chunks.slice(Math.max(0, index - 1), index + 3);
  const first = Math.min(...target.items.map((o) => o.x));
  const v = speedAt(first);
  const stride = REACH_SLACK * v;
  const from = chunks[index].x0 - 0.5 * v;
  const spots = [];
  for (const c of slice) {
    const surfaces = [...c.roofs.map((r) => ({ x0: r.x0, x1: r.x1, y: r.top })), ...c.items.filter((o) => o.type === "ledge").map((o) => ({ x0: o.x0, x1: o.x1, y: o.y }))];
    for (const sf of surfaces) {
      for (let x = Math.min(sf.x1 + RUNNER_W / 2 - 0.5, first + 4); x - stride >= Math.max(sf.x0, from); x -= stride) spots.push({ x, y: sf.y });
    }
  }
  spots.sort((a, b) => b.x - a.x);
  for (const at of spots) {
    for (const input of REACH_INPUTS) {
      if (takesAll(seed, slice, target, at, input) && takesAll(seed, slice, target, { x: at.x - stride, y: at.y }, input)) return true;
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
  assert.ok(spares >= 40, `${spares} spares checked`);
});

test("just running off the roof onto an awning takes its arc, any spare, and the line after", () => {
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
  assert.ok(checked > 60, `${checked} checked`);
});

test("spare cups are rare: none early, then one every 4,000 to 6,000 units or so, on a harder line", () => {
  const hard = new Set(PATTERNS.filter((p) => p.hard).map((p) => p.id));
  assert.deepEqual([...hard].sort(), ["awning", "cable", "split", "vent"]);
  const gaps = [];
  for (const seed of SEEDS) {
    for (const start of [0, 20000]) {
      const chunks = buildCourse(seed, 40000, start);
      const xs = [];
      for (const c of chunks) {
        for (const o of c.items) {
          if (o.type !== "spare") continue;
          assert.ok(hard.has(c.pattern), `a spare in ${c.pattern}`);
          xs.push(o.x);
        }
      }
      assert.ok(xs.length >= 5, `${xs.length} spares on seed ${seed}`);
      assert.ok(xs[0] - start >= SPARE_FIRST, `first spare ${xs[0] - start} in`);
      for (let i = 1; i < xs.length; i++) {
        assert.ok(xs[i] - xs[i - 1] >= SPARE_GAP[0], `spares ${xs[i] - xs[i - 1]} apart`);
        gaps.push(xs[i] - xs[i - 1]);
      }
    }
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  const middle = [gaps[Math.floor(gaps.length / 4)], gaps[Math.floor((gaps.length * 3) / 4)]];
  assert.ok(median >= 4000 && median <= 6000, `median ${median}`);
  assert.ok(middle[0] >= 3500 && middle[1] <= 7000, `middle half ${middle}`);
});

// --- Whole runs ------------------------------------------------------------------------------

test("the same seed and inputs replay to the identical state", () => {
  const inputs = [];
  const random = createRng(77);
  for (let i = 0; i < 4000; i++) inputs.push({ jump: random() < 0.3, down: random() < 0.05, rush: random() < 0.01 });
  const a = newRun(12);
  const b = newRun(12);
  const eventsA = inputs.map((input) => step(a, input, H));
  const eventsB = inputs.map((input) => step(b, input, H));
  assert.deepEqual(a, b);
  assert.deepEqual(eventsA, eventsB);
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

for (const [label, startDistance] of [["the first chunk", 0], ["middling difficulty", 12000], ["full difficulty", 30000]]) {
  test(`a competent bot runs 6,000 units from ${label} on its one cup`, () => {
    for (const seed of SEEDS) {
      const s = newRun(seed, { startDistance });
      const lost = drive(s, { distance: 6000 });
      assert.deepEqual(lost, [], `seed ${seed}`);
      assert.equal(s.status, "running");
      assert.equal(s.stats.sparesUsed, 0);
      assert.ok(s.distance >= 6000);
      assert.ok(s.stats.deliveries > 0);
    }
  });
}
