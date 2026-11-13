import assert from "node:assert/strict";
import test from "node:test";

import {
  AFTER_HOURS,
  EVENTS,
  FLOOR,
  IN_PIPE,
  MAX_FRAME,
  MAX_PARTICLES,
  MAX_STARS,
  MIN_SEGMENT,
  MILK,
  PEARL,
  RADIUS,
  ROOMS,
  SETTLE_TIMEOUT,
  SNAP,
  SPILLED,
  STEP,
  STRAW_HALF,
  TEA,
  WIDTH,
  beginStroke,
  blockCorners,
  cleanProgress,
  clearStrokes,
  commitStroke,
  createWorld,
  cupAt,
  describeRoom,
  drawStrokes,
  emptyProgress,
  extendStroke,
  frameSteps,
  judgeCup,
  judgeRoom,
  mirrorRoom,
  mirrorStrokes,
  nextRoom,
  polylineLength,
  pourCountdown,
  pourNow,
  progressSummary,
  progressTotal,
  ratioAccuracy,
  recordRoomResult,
  remix,
  removeStroke,
  roomAt,
  simplify,
  simulate,
  snapToStraws,
  starsFor,
  step,
  strawLeft,
  strokeAt,
  unlockedRooms,
} from "../src/lib/arcade/spill-engine.js";

/**
 * A bare room for testing one thing at a time: a kettle, a cup far away in
 * the corner, and whatever the test adds.
 */
function bareRoom(extra = {}) {
  return {
    id: "test",
    name: "test",
    page: 0,
    idea: "",
    hint: "",
    straw: 200,
    plan: 0,
    kettles: [{ x: 60, y: 60, vx: 0, vy: 50, count: 40, rate: 20, delay: 0 }],
    cups: [{ x: 215, y: 300, w: 40, h: 40, order: { need: 1, full: 10 } }],
    solution: { strokes: [] },
    ...extra,
  };
}

/** @param {ReturnType<typeof createWorld>} world @param {number} seconds */
function run(world, seconds, onStep = () => {}) {
  for (let n = 0; n < Math.round(seconds / STEP); n++) {
    step(world, STEP);
    onStep(world);
  }
}

/** Puts a resting particle by hand. */
function place(world, x, y, kind = TEA) {
  const p = world.p;
  const i = world.count++;
  p.x[i] = p.px[i] = p.qx[i] = x;
  p.y[i] = p.py[i] = p.qy[i] = y;
  p.vx[i] = p.vy[i] = 0;
  p.kind[i] = kind;
  p.flags[i] = 0;
  p.cup[i] = -1;
  p.timer[i] = 0;
  p.fresh[i] = 0;
  p.pipe[i] = -1;
  return i;
}

/** Collects events of every step into a list of names. */
function eventLog(world) {
  /** @type {number[]} */
  const log = [];
  return {
    log,
    collect() {
      for (let e = 0; e < world.events.count; e++) log.push(world.events.type[e]);
    },
  };
}

// --- The simulation -----------------------------------------------------------------

test("droplets fall and come to rest on the floor", () => {
  const world = createWorld(bareRoom());
  run(world, 4);
  assert.equal(world.count, 40);
  for (let i = 0; i < world.count; i++) {
    assert.ok(world.p.y[i] <= FLOOR - RADIUS[TEA] + 1e-9);
    assert.ok(world.p.y[i] > FLOOR - 30, "near the floor");
    assert.ok(Math.abs(world.p.vy[i]) < 40);
  }
  // The puddle counts as spilled, and none of it reached the far cup.
  assert.equal(world.cups[0].count, 0);
  assert.equal(world.stats.spilled, 40);
});

test("a straw sends the stream the way it slopes", () => {
  const landing = (stroke) => {
    const world = createWorld(bareRoom({ kettles: [{ x: 120, y: 40, vx: 0, vy: 50, count: 30, rate: 15, delay: 0 }] }));
    drawStrokes(world, [stroke]);
    run(world, 4);
    let sum = 0;
    for (let i = 0; i < world.count; i++) sum += world.p.x[i];
    return sum / world.count;
  };
  const right = landing([[100, 120], [160, 160]]);
  const left = landing([[140, 120], [80, 160]]);
  assert.ok(right > 150, `right ramp lands at ${right}`);
  assert.ok(left < 90, `left ramp lands at ${left}`);
});

test("a cup fills, then overflows when the pour is more than it holds", () => {
  const room = bareRoom({
    kettles: [{ x: 120, y: 150, vx: 0, vy: 60, count: 160, rate: 30, delay: 0 }],
    cups: [{ x: 120, y: 300, w: 30, h: 26, order: { need: 10, full: 30 } }],
  });
  const world = createWorld(room);
  /** @type {number[]} */
  const counts = [];
  run(world, 8, (w) => counts.push(w.cups[0].count));
  const cup = world.cups[0];
  // It rose steadily while pouring, then stopped at what the cup holds.
  assert.ok(counts[200] > counts[100] && counts[300] > counts[200]);
  assert.ok(cup.count >= 25 && cup.count <= 50, `holds ${cup.count}`);
  assert.ok(world.stats.spilled > 100, "the rest ran over the rim");
  assert.equal(cup.full, true);
  // The heap never sinks through the walls: everything in the cup's span sits above its bottom.
  for (let i = 0; i < world.count; i++) {
    if (Math.abs(world.p.x[i] - 120) < 12) assert.ok(world.p.y[i] < 300 - 1.5 - RADIUS[TEA] + 0.5);
  }
});

test("counting is exact: each particle in a cup's region counts once, by kind", () => {
  const room = bareRoom({
    kettles: [{ x: 20, y: 20, vx: 0, vy: 0, count: 0, rate: 1, delay: 99 }],
    cups: [
      { x: 60, y: 300, w: 60, h: 40, order: { need: 1, full: 10 } },
      { x: 180, y: 300, w: 60, h: 40, order: { need: 1, full: 10 } },
    ],
  });
  const world = createWorld(room);
  for (let k = 0; k < 7; k++) place(world, 42 + k * 5, 293);
  for (let k = 0; k < 3; k++) place(world, 47 + k * 9, 287, MILK);
  for (let k = 0; k < 4; k++) place(world, 165 + k * 9, 293);
  place(world, 175, 285, PEARL);
  place(world, 120, 296);
  step(world);
  assert.deepEqual([world.cups[0].tea, world.cups[0].milk, world.cups[0].pearls], [7, 3, 0]);
  assert.deepEqual([world.cups[1].tea, world.cups[1].milk, world.cups[1].pearls], [4, 0, 1]);
  assert.equal(world.cups[0].count, 10);
  assert.equal(world.cups[1].count, 4, "pearls are not droplets");
  assert.equal(cupAt(world, 120, 296), -1);
  assert.equal(cupAt(world, 60, 280), 0);
});

test("orders judge the count, the milk share within tolerance, and the pearls", () => {
  const order = { need: 40, full: 60, milk: 0.3, tol: 0.1, pearls: 2 };
  assert.equal(judgeCup({ tea: 35, milk: 15, pearls: 2 }, order).ok, true);
  assert.equal(judgeCup({ tea: 30, milk: 5, pearls: 2 }, order).enough, false);
  assert.equal(judgeCup({ tea: 45, milk: 5, pearls: 2 }, order).ratioOk, false);
  assert.equal(judgeCup({ tea: 28, milk: 12, pearls: 2 }, order).ratioOk, true, "0.3 exactly");
  assert.equal(judgeCup({ tea: 32, milk: 8, pearls: 2 }, order).ratioOk, true, "0.2, at the edge");
  assert.equal(judgeCup({ tea: 35, milk: 15, pearls: 1 }, order).pearlsOk, false);
  assert.equal(judgeCup({ tea: 90, milk: 0, pearls: 0 }, { need: 40, full: 60 }).fill, 1);

  assert.equal(ratioAccuracy(70, 30, order), 1);
  assert.ok(Math.abs(ratioAccuracy(75, 25, order) - 0.5) < 1e-9);
  assert.equal(ratioAccuracy(100, 0, order), 0);
  assert.equal(ratioAccuracy(0, 0, order), 0);
  assert.equal(ratioAccuracy(10, 0, { need: 1, full: 2 }), 1);

  assert.equal(starsFor(1, 0.9, 1), 3);
  assert.equal(starsFor(1, 0.9, 0.2), 2, "a sloppy ratio costs the third star");
  assert.equal(starsFor(0.8, 0.6, 1), 2);
  assert.equal(starsFor(0.5, 0.9, 1), 1);
  assert.equal(starsFor(1, 0.5, 1, [0.45, 0.7]), 2, "rooms can lower the keep marks");
});

test("straw is spent by length, clipped at the budget, and refunded on removal", () => {
  const world = createWorld(bareRoom({ straw: 100 }));
  assert.equal(strawLeft(world), 100);
  assert.ok(beginStroke(world, 100, 150));
  assert.equal(extendStroke(world, 100 + MIN_SEGMENT / 2, 150), false, "too close to keep");
  assert.ok(extendStroke(world, 130, 150));
  assert.ok(extendStroke(world, 140, 150));
  assert.equal(strawLeft(world), 60, "the stroke in progress counts");
  const first = commitStroke(world);
  assert.ok(first > 0);
  assert.equal(world.strokes[0].points.length, 2, "collinear points are simplified away");
  assert.equal(strawLeft(world), 60);

  beginStroke(world, 20, 200);
  extendStroke(world, 20, 290);
  const second = commitStroke(world);
  assert.ok(Math.abs(world.strokes[1].length - 60) < 1e-9, "clipped to what was left");
  assert.equal(strawLeft(world), 0);
  assert.equal(beginStroke(world, 200, 200), false, "no straw, no stroke");

  assert.equal(strokeAt(world, 120, 152), first);
  assert.equal(strokeAt(world, 21, 250), second);
  assert.equal(strokeAt(world, 200, 50), -1);
  assert.ok(removeStroke(world, first));
  assert.equal(strawLeft(world), 40);
  assert.equal(removeStroke(world, first), false);
  assert.ok(removeStroke(world, second));
  assert.equal(strawLeft(world), 100);

  drawStrokes(world, [[[10, 100], [50, 100]], [[10, 150], [50, 150]]]);
  assert.equal(world.strokes.length, 2);
  clearStrokes(world);
  assert.equal(world.strokes.length, 0);
  assert.equal(strawLeft(world), 100);

  // A single click is not a straw.
  beginStroke(world, 100, 100);
  assert.equal(commitStroke(world), -1);
  assert.deepEqual(simplify([[0, 0], [5, 0.2], [10, 0], [10, 10]]), [[0, 0], [10, 0], [10, 10]]);
  assert.equal(polylineLength([[0, 0], [3, 4], [3, 10]]), 11);
});

test("no-draw zones refuse a stroke that starts in or crosses them", () => {
  const world = createWorld(bareRoom({ noDraw: [{ x: 100, y: 100, w: 40, h: 40 }] }));
  assert.equal(beginStroke(world, 120, 120), false);
  assert.equal(beginStroke(world, 60, 60), false, "the spout keeps itself clear");
  assert.ok(beginStroke(world, 80, 120));
  assert.equal(extendStroke(world, 160, 120), false, "would pass through the zone");
  assert.ok(extendStroke(world, 80, 160));
  assert.ok(commitStroke(world) > 0);
});

// --- Fixtures, one at a time -----------------------------------------------------------

test("an ice block holds droplets up, and what leaves it goes over its ends, never through", () => {
  const world = createWorld(bareRoom({ blocks: [{ type: "ice", x: 60, y: 200, w: 60, h: 20 }], kettles: [{ x: 60, y: 60, vx: 0, vy: 50, count: 20, rate: 20, delay: 0 }] }));
  let most = 0;
  run(world, 4, (w) => {
    let on = 0;
    for (let i = 0; i < w.count; i++) {
      const x = w.p.x[i];
      const y = w.p.y[i];
      if (y < 190) on++;
      // Nothing inside the block, and nothing below its top within its span.
      assert.ok(!(x > 30 && x < 90 && y > 188 && y < 212), `a droplet at ${x.toFixed(1)}, ${y.toFixed(1)}`);
    }
    most = Math.max(most, on);
  });
  assert.ok(most >= 15, `${most} on the ice at once`);
});

test("a fan pushes droplets that pass through it", () => {
  const base = bareRoom({ kettles: [{ x: 60, y: 40, vx: 0, vy: 30, count: 20, rate: 20, delay: 0 }] });
  const still = createWorld(base);
  const windy = createWorld({ ...base, fans: [{ x: 30, y: 100, w: 60, h: 100, fx: 600, fy: 0 }] });
  run(still, 3);
  run(windy, 3);
  const mean = (w) => {
    let sum = 0;
    for (let i = 0; i < w.count; i++) sum += w.p.x[i];
    return sum / w.count;
  };
  assert.ok(mean(windy) > mean(still) + 40, `${mean(windy)} vs ${mean(still)}`);
});

test("a sponge soaks up droplets but not pearls", () => {
  const world = createWorld(
    bareRoom({ blocks: [{ type: "sponge", x: 60, y: 200, w: 60, h: 20 }], hopper: { x: 84, y: 30, count: 2, interval: 0.2 } }),
  );
  const events = eventLog(world);
  run(world, 4, events.collect);
  assert.equal(world.stats.absorbed, 40);
  assert.ok(events.log.includes(EVENTS.ABSORBED));
  let pearls = 0;
  for (let i = 0; i < world.count; i++) if (world.p.kind[i] === PEARL) pearls++;
  assert.equal(pearls, 2);
  assert.equal(judgeRoom(world).absorbed, 40);
});

test("a hot plate boils droplets away", () => {
  const world = createWorld(bareRoom({ blocks: [{ type: "hot", x: 60, y: 200, w: 60, h: 10 }] }));
  const events = eventLog(world);
  run(world, 4, events.collect);
  assert.equal(world.stats.boiled, 40);
  assert.equal(world.count, 0);
  assert.ok(events.log.includes(EVENTS.BOILED));
});

test("jelly throws droplets back up where ice would not", () => {
  const peak = (type) => {
    const world = createWorld(bareRoom({ blocks: [{ type, x: 60, y: 250, w: 60, h: 14 }], kettles: [{ x: 60, y: 60, vx: 0, vy: 0, count: 1, rate: 5, delay: 0 }] }));
    const events = eventLog(world);
    /** @type {number[]} */
    const ys = [];
    run(world, 1.5, (w) => {
      events.collect();
      if (w.count) ys.push(w.p.y[0]);
    });
    // How far it climbs back after the first time it stops falling.
    let low = 1;
    while (low < ys.length && ys[low] >= ys[low - 1]) low++;
    const rebound = ys[low - 1] - Math.min(...ys.slice(low - 1));
    return { rebound, bounced: events.log.includes(EVENTS.BOUNCE) };
  };
  const jelly = peak("jelly");
  const ice = peak("ice");
  assert.ok(jelly.rebound > 50, `jelly rebound ${jelly.rebound}`);
  assert.ok(ice.rebound < 5, `ice rebound ${ice.rebound}`);
  assert.ok(jelly.bounced && !ice.bounced);
});

test("a pipe carries what enters one end out of the other", () => {
  const world = createWorld(
    bareRoom({
      kettles: [{ x: 60, y: 60, vx: 0, vy: 0, count: 5, rate: 10, delay: 0 }],
      pipes: [{ a: { x: 60, y: 150, nx: 0, ny: -1 }, b: { x: 180, y: 100, nx: 1, ny: 0 } }],
    }),
  );
  const events = eventLog(world);
  let sawInside = false;
  run(world, 1.6, (w) => {
    events.collect();
    for (let i = 0; i < w.count; i++) if (w.p.flags[i] & IN_PIPE) sawInside = true;
  });
  assert.ok(sawInside);
  assert.equal(world.stats.piped, 5);
  assert.equal(events.log.filter((t) => t === EVENTS.PIPE).length, 5);
  for (let i = 0; i < world.count; i++) assert.ok(world.p.x[i] > 180, "out of the far end, moving away");
});

test("enough weight on a scale opens its gate", () => {
  const room = bareRoom({
    kettles: [{ x: 60, y: 60, vx: 0, vy: 40, count: 30, rate: 20, delay: 0 }],
    scales: [{ x: 60, y: 200, w: 40, h: 20, need: 10, gate: 0 }],
    gates: [{ x1: 150, y1: 200, x2: 230, y2: 200 }],
  });
  const world = createWorld(room);
  const segments = world.seg.count;
  const events = eventLog(world);
  let openedAt = -1;
  run(world, 3, (w) => {
    events.collect();
    if (openedAt < 0 && w.gates[0].open) openedAt = w.time;
  });
  assert.ok(openedAt > 0);
  assert.ok(world.scales[0].weight >= 10);
  assert.equal(world.seg.count, segments - 1, "the gate is no longer solid");
  assert.equal(events.log.filter((t) => t === EVENTS.GATE_OPEN).length, 1);

  const light = createWorld({ ...room, scales: [{ ...room.scales[0], need: 500 }] });
  run(light, 3);
  assert.equal(light.gates[0].open, false);
});

test("the hopper drops pearls only once the pour starts", () => {
  const world = createWorld(bareRoom({ kettles: [{ x: 60, y: 60, vx: 0, vy: 50, count: 10, rate: 20, delay: 1 }], hopper: { x: 150, y: 30, count: 3, interval: 0.25 } }));
  const events = eventLog(world);
  run(world, 0.9, events.collect);
  assert.equal(world.stats.pearls, 0);
  run(world, 1.5, events.collect);
  assert.equal(world.stats.pearls, 3);
  assert.equal(events.log.filter((t) => t === EVENTS.PEARLS_DROP).length, 1);
});

test("a conveyor slides its cup back and forth, then stops after the pour", () => {
  const world = createWorld(
    bareRoom({
      kettles: [{ x: 20, y: 60, vx: 0, vy: 0, count: 20, rate: 20, delay: 0 }],
      cups: [{ x: 120, y: 300, w: 40, h: 30, order: { need: 1, full: 5 }, conveyor: { range: 50, period: 2 } }],
    }),
  );
  /** @type {number[]} */
  const xs = [];
  run(world, 6, (w) => xs.push(w.cups[0].x));
  assert.ok(Math.abs(xs[59] - 170) < 1, "a quarter period in, at the right end");
  assert.ok(Math.max(...xs) <= 170 + 1e-9 && Math.min(...xs.slice(0, 240)) < 75);
  // The wall segments moved with it.
  const left = world.seg.ax[0];
  assert.ok(Math.abs(left - (world.cups[0].x - 20 + 1.5)) < 1e-9);
  assert.equal(world.beltSpeed, 0);
  assert.equal(xs.at(-1), xs.at(-2), "stopped");
});

test("kettles wait out the planning time, and pour now ends it early, keeping the stagger", () => {
  const room = bareRoom({
    plan: 20,
    kettles: [
      { x: 60, y: 60, vx: 0, vy: 50, count: 10, rate: 20 },
      { x: 120, y: 60, vx: 0, vy: 50, count: 10, rate: 20, delay: 1, kind: "milk" },
    ],
  });
  const waiting = createWorld(room);
  assert.equal(pourCountdown(waiting), 20);
  run(waiting, 19.9);
  assert.equal(waiting.stats.poured, 0);
  assert.equal(waiting.status, "waiting");
  assert.ok(Math.abs(pourCountdown(waiting) - 0.1) < 0.02);
  run(waiting, 0.2);
  assert.ok(waiting.stats.poured > 0);
  assert.equal(waiting.status, "pouring");
  assert.ok(!waiting.kettles[1].started, "the milk keeps its second of stagger");

  const eager = createWorld(room);
  const events = eventLog(eager);
  run(eager, 5);
  assert.ok(pourNow(eager));
  run(eager, 0.1, events.collect);
  assert.ok(events.log.includes(EVENTS.POUR_START));
  assert.ok(eager.kettles[0].started && !eager.kettles[1].started, "the milk still comes a second later");
  // Straws can still be drawn once the tea is coming.
  assert.equal(drawStrokes(eager, [[[150, 200], [200, 220]]]), 1);
  run(eager, 1, events.collect);
  assert.ok(eager.kettles[1].started);
  assert.equal(pourNow(eager), false, "only once");
  run(eager, 4, events.collect);
  assert.equal(events.log.filter((t) => t === EVENTS.POUR_STOP).length, 2);
  assert.ok(Math.abs(judgeRoom(eager).earlySeconds - 15) < 0.02);
});

// --- Liquid that never stalls ------------------------------------------------------------------

/** Where the room was judged, then where everything ended up ten seconds later. */
function verdictThenLater(room, strokes, seconds = 10) {
  const { world, result } = simulate(room, strokes);
  const status = world.status;
  const events = eventLog(world);
  const counts = world.cups.map((cup) => cup.count);
  run(world, seconds, events.collect);
  return { world, result, status, counts, later: world.cups.map((cup) => cup.count), events: events.log };
}

test("the tea keeps moving after the verdict, and the verdict never changes once given", () => {
  const room = ROOMS[0];
  const { world, result, status, events } = verdictThenLater(room, room.solution.strokes);
  assert.equal(status, "cleared");
  assert.equal(world.status, "cleared", "the status is locked");
  assert.equal(world.result, result, "the same result, untouched");
  assert.ok(!events.includes(EVENTS.CLEARED) && !events.includes(EVENTS.FAILED), "judged once");
  // Stepping still moves things: a droplet dropped in after the verdict falls.
  const i = place(world, 120, 40);
  run(world, 0.5);
  assert.ok(world.p.y[i] > 90, `fell to ${world.p.y[i].toFixed(1)}`);
});

test("the verdict waits for the tea: every room's cups hold the same ten seconds after it, with its solution and with nothing", () => {
  for (const room of ROOMS) {
    for (const strokes of [room.solution.strokes, []]) {
      const { result, counts, later } = verdictThenLater(room, strokes, 8);
      assert.deepEqual(later, counts, `${room.name}: ${counts} then ${later}`);
      assert.deepEqual(result.cups.map((cup) => cup.count), counts);
    }
  }
});

test("the verdict comes early once all the tea is at rest in the cup or spilled", () => {
  const world = createWorld(
    bareRoom({
      kettles: [{ x: 120, y: 200, vx: 0, vy: 20, count: 20, rate: 40, delay: 0 }],
      cups: [{ x: 120, y: 300, w: 44, h: 46, order: { need: 10, full: 30 } }],
    }),
  );
  let judgedAt = -1;
  run(world, 6, (w) => {
    if (judgedAt < 0 && w.result) judgedAt = w.time;
  });
  assert.equal(world.status, "cleared");
  assert.ok(judgedAt - world.pourEndedAt < 1.6, `judged ${(judgedAt - world.pourEndedAt).toFixed(2)}s after the pour`);
  assert.equal(world.result?.cups[0].count, world.cups[0].count, "and nothing changed after");
});

test("a room that never settles is still judged, SETTLE_TIMEOUT after the last pour", () => {
  // Both mouths of the pipe face up, one above the other: what comes out of
  // the lower falls straight back in, round and round for ever (one droplet,
  // so nothing knocks it out of the loop).
  const world = createWorld(
    bareRoom({
      kettles: [{ x: 60, y: 100, vx: 0, vy: 0, count: 1, rate: 10, delay: 0 }],
      pipes: [{ a: { x: 60, y: 150, nx: 0, ny: -1 }, b: { x: 60, y: 250, nx: 0, ny: -1 } }],
    }),
  );
  let judgedAt = -1;
  run(world, SETTLE_TIMEOUT + 3, (w) => {
    if (judgedAt < 0 && w.result) judgedAt = w.time;
  });
  assert.ok(world.stats.piped > 20, "still going round");
  assert.ok(Math.abs(judgedAt - world.pourEndedAt - SETTLE_TIMEOUT) < 2 * STEP, `judged ${(judgedAt - world.pourEndedAt).toFixed(2)}s after the pour`);
  assert.equal(world.status, "failed");
});

test("a droplet rolls off a block's corner instead of hanging on it", () => {
  const block = { type: "ice", x: 120, y: 200, w: 60, h: 10, angle: 0.3 };
  const world = createWorld(bareRoom({ blocks: [block], kettles: [{ x: 20, y: 20, vx: 0, vy: 0, count: 0, rate: 1, delay: 99 }] }));
  // Its lower top corner, and a droplet resting on the face just above it.
  const [, corner] = blockCorners(block);
  const dir = [Math.cos(0.3), Math.sin(0.3)];
  const up = [Math.sin(0.3), -Math.cos(0.3)];
  const reach = RADIUS[TEA] + 0.5;
  const i = place(world, corner[0] - dir[0] * 6 + up[0] * reach, corner[1] - dir[1] * 6 + up[1] * reach);
  run(world, 1);
  assert.ok(world.p.y[i] > corner[1] + 30, `still at ${world.p.x[i].toFixed(1)}, ${world.p.y[i].toFixed(1)}`);
});

test("a droplet slides off the free end of a shallow straw instead of hanging from its tip", () => {
  const world = createWorld(bareRoom({ kettles: [{ x: 20, y: 20, vx: 0, vy: 0, count: 0, rate: 1, delay: 99 }] }));
  drawStrokes(world, [[[100, 150], [160, 156]]]);
  const i = place(world, 110, 151 - RADIUS[TEA] - STRAW_HALF);
  run(world, 3);
  assert.ok(world.p.y[i] > 200, `still at ${world.p.x[i].toFixed(1)}, ${world.p.y[i].toFixed(1)}`);
});

test("a straw started or ended by another joins it, and tea runs across the joint", () => {
  const world = createWorld(bareRoom({ straw: 600, kettles: [{ x: 40, y: 40, vx: 0, vy: 30, count: 40, rate: 15, delay: 0 }] }));
  const a1 = [30 + Math.cos(0.21) * 70, 100 + Math.sin(0.21) * 70];
  drawStrokes(world, [[[30, 100], a1]]);
  // Started a hair above the first straw's tip: that start cap would be a lip.
  assert.ok(beginStroke(world, a1[0] + 2, a1[1] - 3));
  assert.deepEqual(world.draft?.[0], a1, "starts at the tip");
  extendStroke(world, a1[0] + 70, a1[1] + 10);
  commitStroke(world);
  // Ending just short of another straw's middle line lands on it.
  beginStroke(world, 200, 60);
  extendStroke(world, 150, 80);
  extendStroke(world, 120, 94);
  commitStroke(world);
  const end = world.strokes[2].points.at(-1);
  const near = snapToStraws(world, 120, 94);
  assert.ok(near && Math.hypot(end[0] - 120, end[1] - 94) < SNAP);
  assert.equal(snapToStraws(world, 120, 20), null, "nothing to join far away");
  clearStrokes(world);
  // Tea poured down the first straw crosses onto the second.
  drawStrokes(world, [[[30, 100], a1], [[a1[0] + 2, a1[1] - 3], [a1[0] + 70, a1[1] + 10]]]);
  run(world, 8);
  let held = 0;
  for (let k = 0; k < world.count; k++) if (world.p.y[k] < 260 && !(world.p.flags[k] & SPILLED)) held++;
  assert.equal(held, 0, `${held} droplets held at the joint`);
});

test("a droplet squeezed out of a block keeps its slide along the face", () => {
  const world = createWorld(bareRoom({ blocks: [{ type: "ice", x: 120, y: 200, w: 60, h: 20 }], kettles: [{ x: 20, y: 20, vx: 0, vy: 0, count: 0, rate: 1, delay: 99 }] }));
  const i = place(world, 120, 192);
  world.p.vx[i] = 60;
  step(world);
  assert.ok(world.p.y[i] < 190 - RADIUS[TEA] + 0.6, `out on top, at ${world.p.y[i].toFixed(2)}`);
  assert.ok(world.p.vx[i] > 30, `still sliding at ${world.p.vx[i].toFixed(1)}`);
});

test("the screen's frame clock catches up at most MAX_FRAME, never runs backwards, and draws between steps", () => {
  let clock = frameSteps(0, 1 / 60);
  assert.equal(clock.steps, 2);
  assert.ok(clock.alpha >= 0 && clock.alpha < 1);
  // A slow frame or a tab back from hiding: a few steps, not a backlog.
  clock = frameSteps(clock.accumulator, 30);
  assert.equal(clock.steps, Math.floor(MAX_FRAME / STEP + 1e-6));
  for (const bad of [-1, Number.NaN, Infinity, undefined]) {
    const next = frameSteps(STEP / 2, /** @type {number} */ (bad));
    assert.ok(next.steps <= Math.ceil(MAX_FRAME / STEP));
    assert.ok(next.alpha >= 0 && next.alpha <= 1);
  }
  // A second's worth of 120 Hz frames is exactly a second of steps.
  let acc = 0;
  let total = 0;
  for (let k = 0; k < 120; k++) {
    const next = frameSteps(acc, 1 / 120);
    acc = next.accumulator;
    total += next.steps;
  }
  assert.equal(total, 120);
});

// --- Determinism and cost --------------------------------------------------------------------

test("the same room, straws and timing always end the same way", () => {
  const room = ROOMS[11];
  const a = simulate(room, room.solution.strokes, { pourAt: 1 });
  const b = simulate(room, room.solution.strokes, { pourAt: 1 });
  assert.equal(a.world.time, b.world.time);
  assert.deepEqual(a.result, b.result);
  assert.equal(a.world.count, b.world.count);
  assert.deepEqual(a.world.p.x.slice(0, a.world.count), b.world.p.x.slice(0, b.world.count));
  assert.deepEqual(a.world.p.y.slice(0, a.world.count), b.world.p.y.slice(0, b.world.count));
});

test("stepping reuses its buffers rather than growing anything", () => {
  const world = createWorld(ROOMS[0]);
  drawStrokes(world, ROOMS[0].solution.strokes);
  const buffers = Object.values(world.p);
  const events = Object.values(world.events).filter((v) => typeof v === "object");
  const segments = world.seg.ax;
  const strokes = world.strokes.length;
  run(world, 8);
  assert.deepEqual(Object.values(world.p), buffers);
  for (const buffer of buffers) assert.equal(buffer.length, MAX_PARTICLES);
  assert.deepEqual(Object.values(world.events).filter((v) => typeof v === "object"), events);
  assert.equal(world.seg.ax, segments);
  assert.equal(world.strokes.length, strokes);
});

test("400 droplets step 120 times well inside 50ms", () => {
  let best = Infinity;
  for (let round = 0; round < 3; round++) {
    const world = createWorld(
      bareRoom({
        kettles: [{ x: 20, y: 20, vx: 0, vy: 0, count: 0, rate: 1, delay: 99 }],
        cups: [{ x: 120, y: 300, w: 120, h: 60, order: { need: 1, full: 2 } }],
        blocks: [{ type: "ice", x: 60, y: 150, w: 60, h: 10, angle: 0.3 }],
      }),
    );
    drawStrokes(world, [[[220, 100], [150, 140]], [[20, 200], [60, 230], [80, 250]]]);
    for (let i = 0; i < 400; i++) place(world, 30 + (i % 40) * 4.5, 40 + Math.floor(i / 40) * 4.5, i % 5 ? TEA : MILK);
    const start = performance.now();
    run(world, 1);
    best = Math.min(best, performance.now() - start);
    assert.ok(world.count > 380, `${world.count} still live`);
  }
  assert.ok(best < 50, `${best.toFixed(1)}ms`);
});

// --- Rooms --------------------------------------------------------------------------------------

test("eighteen rooms in six pages of three, each with a name, a hint and a budget", () => {
  assert.equal(ROOMS.length, 18);
  assert.equal(new Set(ROOMS.map((room) => room.id)).size, 18);
  for (let page = 1; page <= 6; page++) assert.equal(ROOMS.filter((room) => room.page === page).length, 3);
  ROOMS.forEach((room, i) => {
    assert.equal(room.page, Math.floor(i / 3) + 1);
    assert.equal(room.name, room.name.toLowerCase());
    assert.ok(room.hint.length > 10 && !room.hint.includes("!"));
    assert.ok(room.straw > 0);
  });
});

for (const [index, room] of ROOMS.entries()) {
  test(`room ${index + 1}, ${room.name}: its solution clears with two stars or more, and nothing drawn fails`, () => {
    const solution = room.solution.strokes;
    const length = solution.reduce((sum, line) => sum + polylineLength(line), 0);
    assert.ok(length <= room.straw, "the solution fits the budget");

    const world = createWorld(room);
    assert.equal(drawStrokes(world, solution), solution.length);
    assert.ok(Math.abs(world.budget - strawLeft(world) - length) < 0.5, "drawn in full, not clipped");

    const { result } = simulate(room, solution);
    assert.equal(result.cleared, true);
    assert.ok(result.stars >= 2, `${result.stars} stars`);
    assert.equal(simulate(room, []).result.cleared, false);

    // The budget is what makes it a puzzle: 60% of it can't buy this route.
    assert.ok(length > room.straw * 0.6, `uses ${(length / room.straw).toFixed(2)} of the straw`);
    const squeezed = simulate({ ...room, straw: room.straw * 0.6 }, solution).result;
    assert.ok(!squeezed.cleared || squeezed.points < result.points);
  });

  test(`room ${index + 1}, ${room.name}: low remixes still clear with the solution moved to match`, () => {
    const seen = new Set();
    for (let seed = 1; seed <= 12 && seen.size < 2; seed++) {
      const remixed = remix(room, 1, seed);
      if (seen.has(remixed.remix.mirrored)) continue;
      seen.add(remixed.remix.mirrored);
      const { result } = simulate(remixed, remixed.solution.strokes);
      assert.equal(result.cleared, true, `mirrored ${remixed.remix.mirrored}`);
    }
    assert.equal(seen.size, 2, "saw both a mirrored and an unmirrored remix");
  });
}

test("remixes squeeze harder as difficulty grows", () => {
  const room = ROOMS[6];
  const easy = remix(room, 1, 5);
  const hard = remix(room, 6, 5);
  assert.ok(easy.straw < room.straw);
  assert.ok(hard.straw < easy.straw);
  assert.ok(hard.straw >= Math.round(room.straw * 0.55));
  assert.deepEqual(remix(room, 2, 9), remix(room, 2, 9));
  assert.equal(easy.remix.of, room.id);
  for (let seed = 1; seed < 40; seed++) {
    const r = remix(room, 8, seed);
    assert.ok(r.cups[0].order.need >= room.cups[0].order.need);
    assert.ok(r.cups[0].order.need <= Math.round(r.cups[0].order.full * 0.9));
  }
});

test("mirroring flips everything left to right", () => {
  const room = ROOMS[17];
  const m = mirrorRoom(room);
  assert.equal(m.kettles[0].x, WIDTH - room.kettles[0].x);
  assert.equal(m.kettles[0].vx, -room.kettles[0].vx);
  assert.equal(m.scales?.[0].x, WIDTH - (room.scales?.[0].x ?? 0));
  assert.deepEqual(mirrorStrokes(mirrorStrokes(room.solution.strokes)), room.solution.strokes);
  const belt = mirrorRoom(ROOMS[6]);
  assert.equal(belt.cups[0].conveyor?.range, -(ROOMS[6].cups[0].conveyor?.range ?? 0));
  const fans = mirrorRoom(ROOMS[3]);
  assert.equal(fans.fans?.[0].fx, -(ROOMS[3].fans?.[0].fx ?? 0));
  assert.equal((fans.fans?.[0].x ?? 0) + (fans.fans?.[0].w ?? 0), WIDTH - (ROOMS[3].fans?.[0].x ?? 0));
});

test("after the authored rooms, after hours carries on with remixes", () => {
  assert.equal(AFTER_HOURS, ROOMS.length);
  assert.equal(roomAt(0), ROOMS[0]);
  assert.equal(roomAt(17), ROOMS[17]);
  const next = roomAt(AFTER_HOURS, 3);
  assert.equal(next.remix?.of, ROOMS[0].id);
  assert.equal(next.remix?.difficulty, 1);
  assert.equal(roomAt(18 + 6 * 3, 3).remix?.difficulty, 4);
  assert.deepEqual(roomAt(25, 3), roomAt(25, 3));
});

// --- Progress ---------------------------------------------------------------------------------------

/** A result as the engine reports one, with only what progress reads. */
const cleared = (stars, points) => ({ cleared: true, stars, points });
const failed = { cleared: false, stars: 0, points: 0 };

test("room 1 is always open, and clearing a room opens the next", () => {
  const fresh = emptyProgress();
  assert.equal(fresh.stars.length, ROOMS.length);
  assert.deepEqual(unlockedRooms(fresh), ROOMS.map((_, i) => i === 0));
  let progress = recordRoomResult(fresh, 0, failed);
  assert.deepEqual(unlockedRooms(progress), unlockedRooms(fresh), "a failure opens nothing");
  progress = recordRoomResult(progress, 0, cleared(1, 140));
  assert.deepEqual(unlockedRooms(progress).slice(0, 3), [true, true, false]);
  progress = recordRoomResult(progress, 1, cleared(2, 230));
  assert.deepEqual(unlockedRooms(progress).slice(0, 4), [true, true, true, false]);
  assert.equal(fresh.stars[0], 0, "the old progress is left as it was");
});

test("a room keeps its best stars and points, never lowering either", () => {
  let progress = recordRoomResult(emptyProgress(), 4, cleared(2, 260));
  progress = recordRoomResult(progress, 4, cleared(1, 300));
  assert.equal(progress.stars[4], 2, "the better stars stay");
  assert.equal(progress.points[4], 300, "the better points come in");
  progress = recordRoomResult(progress, 4, cleared(3, 120));
  assert.equal(progress.stars[4], 3);
  assert.equal(progress.points[4], 300);
  progress = recordRoomResult(progress, 4, failed);
  assert.deepEqual([progress.stars[4], progress.points[4]], [3, 300], "a failure takes nothing away");
  // After hours is not an authored room: it never touches the bests.
  assert.deepEqual(recordRoomResult(progress, AFTER_HOURS + 2, cleared(3, 999)), progress);
});

test("the total is the sum of best points, and the summary counts rooms, stars and three-star rooms", () => {
  let progress = emptyProgress();
  progress = recordRoomResult(progress, 0, cleared(3, 340));
  progress = recordRoomResult(progress, 1, cleared(2, 250));
  progress = recordRoomResult(progress, 2, cleared(3, 312));
  assert.equal(progressTotal(progress), 902);
  assert.equal(MAX_STARS, 54);
  assert.deepEqual(progressSummary(progress), { rooms: 18, cleared: 3, stars: 8, maxStars: 54, threeStar: 2, total: 902 });
  assert.equal(progressTotal(emptyProgress()), 0);
});

test("clearing the last room opens after hours, and the next room to play follows progress", () => {
  let progress = emptyProgress();
  assert.equal(nextRoom(progress), 0);
  for (let i = 0; i < ROOMS.length - 1; i++) progress = recordRoomResult(progress, i, cleared(1, 100));
  assert.equal(progress.afterHours, false);
  assert.equal(nextRoom(progress), ROOMS.length - 1);
  progress = recordRoomResult(progress, ROOMS.length - 1, cleared(2, 210));
  assert.equal(progress.afterHours, true);
  assert.equal(nextRoom(progress), AFTER_HOURS);
});

test("stored progress is checked field by field, so junk or an old shape never breaks the game", () => {
  assert.deepEqual(cleanProgress(null), emptyProgress());
  assert.deepEqual(cleanProgress("nonsense"), emptyProgress());
  assert.deepEqual(cleanProgress({ stars: "3" }), emptyProgress());
  const cleaned = cleanProgress({ stars: [3, 9, -1, 1.7, "2", null], points: [300, 410, 50, 120.6, 200, 80], afterHours: "yes" });
  assert.deepEqual(cleaned.stars.slice(0, 6), [3, 3, 0, 1, 2, 0]);
  assert.deepEqual(cleaned.points.slice(0, 6), [300, 410, 0, 120, 200, 0], "no points without a clear");
  assert.equal(cleaned.stars.length, ROOMS.length);
  assert.equal(cleaned.afterHours, false);
  // A migrated reach (rooms before it cleared with one star) may run past the authored rooms.
  const migrated = cleanProgress({ stars: Array(25).fill(1), points: Array(25).fill(100) });
  assert.equal(migrated.stars.length, ROOMS.length);
  assert.equal(migrated.afterHours, true, "the last room cleared means after hours is open");
  assert.equal(progressTotal(migrated), 1800);
  assert.deepEqual(cleanProgress(JSON.parse(JSON.stringify(migrated))), migrated, "round-trips through JSON");
});

test("a room's points add straw left over and an early pour, scaled by the planning time given back", () => {
  const room = ROOMS[0];
  const plan = room.plan ?? 20;
  const late = simulate(room, room.solution.strokes).result;
  const half = simulate(room, room.solution.strokes, { pourAt: plan / 2 }).result;
  const early = simulate(room, room.solution.strokes, { pourAt: 0.5 }).result;
  assert.equal(late.earlyBonus, 0);
  assert.ok(Math.abs(half.earlyBonus - 20) <= 1, `half the time left earns ${half.earlyBonus}`);
  assert.equal(early.earlyBonus, Math.round((40 * (plan - 0.5)) / plan));
  assert.ok(late.strawBonus > 0);
  assert.equal(late.points, late.stars * 100 + late.strawBonus + late.earlyBonus);
  assert.ok(early.points <= 400);
});

test("every room plans for a while, longer as the game goes on", () => {
  for (const room of ROOMS) assert.ok((room.plan ?? 20) >= 10 && (room.plan ?? 20) <= 30);
  assert.ok((ROOMS[0].plan ?? 20) < (ROOMS[17].plan ?? 20));
  assert.equal(createWorld({ ...ROOMS[3], plan: undefined }).plan, 20);
});

test("a room reports its events from pour to finish", () => {
  const room = ROOMS[0];
  const world = createWorld(room);
  drawStrokes(world, room.solution.strokes);
  const events = eventLog(world);
  run(world, 20, events.collect);
  for (const type of [EVENTS.POUR_START, EVENTS.POUR_STOP, EVENTS.INTO_CUP, EVENTS.CUP_FULL, EVENTS.CLEARED]) {
    assert.ok(events.log.includes(type), `missing ${type}`);
  }
  assert.ok(!events.log.includes(EVENTS.FAILED));
  assert.equal(world.status, "cleared");
  assert.equal(world.result?.cleared, true);

  const spill = createWorld(room);
  const spills = eventLog(spill);
  run(spill, 20, spills.collect);
  assert.ok(spills.log.includes(EVENTS.SPLASH));
  assert.ok(spills.log.includes(EVENTS.FAILED));
  assert.equal(spill.status, "failed");
});

test("rooms describe themselves for screen readers", () => {
  const text = describeRoom(ROOMS[17]);
  assert.match(text, /^the works\./);
  assert.match(text, /milk jug/i);
  assert.match(text, /30% milk/);
  assert.match(text, /scale/);
  assert.match(text, /hopper/);
  assert.match(text, /300 units of straw, and 30 seconds to plan/);
  assert.match(describeRoom(ROOMS[6]), /sliding back and forth/);
  for (const room of ROOMS) assert.ok(!describeRoom(room).includes("undefined"));
});
