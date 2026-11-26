import assert from "node:assert/strict";
import test from "node:test";

import {
  AFTER_HOURS,
  EVENTS,
  HEIGHT,
  IN_PIPE,
  SPILLED,
  ROOMS,
  STEP,
  WIDTH,
  beginStroke,
  commitStroke,
  createWorld,
  drawStrokes,
  extendStroke,
  mirrorRoom,
  pourCountdown,
  pourNow,
  roomAt,
  simulate,
  step,
  strawLeft,
} from "../src/lib/arcade/spill-engine.js";
import {
  AREA_PER_DROP,
  COVER,
  DIAL_SOON,
  FIXTURES,
  HOLD,
  LESSONS,
  LOW_SHARE,
  NEAR,
  REST,
  aim,
  chooseSide,
  continuable,
  coverCost,
  coverage,
  createHolds,
  createSpot,
  fillLineY,
  fixturesIn,
  follows,
  ghostRoute,
  holds,
  inItsPart,
  introducedIn,
  keepClear,
  knownFrom,
  mayOffer,
  planningLesson,
  resultLesson,
  ROUTE_ROOM,
  roomFrame,
  routeVerdict,
  sidesFor,
  slipRect,
  wordedFor,
  wouldClear,
} from "../src/lib/arcade/spill-lessons.js";

const CUP_WALL = 1.5;
const knows = (...ids) => (id) => ids.includes(id);
const words = (text) => text.trim().split(/\s+/).length;

/** Room 1's reference straw, moved `offset` units across itself and cut to `t0..t1` of its length. */
function routeVariant(room, t0, t1, offset = 0) {
  const [[ax, ay], [bx, by]] = room.solution.strokes[0];
  const length = Math.hypot(bx - ax, by - ay);
  const nx = -(by - ay) / length;
  const ny = (bx - ax) / length;
  const at = (t) => [ax + (bx - ax) * t + nx * offset, ay + (by - ay) * t + ny * offset];
  return [at(t0), at(t1)];
}

test("every lesson is one short full sentence, in every wording", () => {
  for (const lesson of Object.values(LESSONS)) {
    for (const input of ["mouse", "touch", "keys"]) {
      const shown = wordedFor(lesson, input);
      assert.ok(words(shown.text) <= 8, `${lesson.id} (${input}) runs to ${words(shown.text)} words`);
      assert.match(shown.text, /^[A-Z].*\.$/, `${lesson.id} (${input}) is a sentence with a full stop`);
      assert.doesNotMatch(shown.text, /[!·]/, `${lesson.id} (${input}) has no exclamation or dot separator`);
    }
  }
});

test("a lesson worded for keys or touch is the same lesson, built once", () => {
  const keys = wordedFor(LESSONS.route, "keys");
  assert.equal(keys.id, "route");
  assert.equal(keys.move, true);
  assert.deepEqual(keys.keys, ["Space", "←↑↓→"]);
  assert.equal(wordedFor(LESSONS.route, "keys"), keys, "the same object every frame");
  assert.equal(wordedFor(LESSONS.route, "mouse"), LESSONS.route);
  assert.match(wordedFor(LESSONS.takeBack, "touch").text, /^Tap /);
  assert.deepEqual(wordedFor(LESSONS.takeBack, "keys").keys, ["Delete"]);
});

test("each fixture is named in the first room that has one, one new thing per room", () => {
  const firstRooms = {
    ice: "ice-shelf",
    fan: "a-draft",
    updraft: "updraft",
    belt: "the-belt",
    overflow: "overflow",
    jelly: "jelly",
    pipe: "plumbing",
    milk: "milk-tea",
    sponge: "sponges",
    hot: "hot-plate",
    pearls: "pearls",
    scale: "the-scale",
    glass: "the-window",
    rail: "trolley",
    sieve: "strainer",
  };
  assert.deepEqual(FIXTURES.map((fixture) => fixture.id).sort(), Object.keys(firstRooms).sort());
  for (const [id, roomId] of Object.entries(firstRooms)) {
    assert.equal(ROOMS[introducedIn(id)].id, roomId, id);
    // Each is named first (in italic), so its line is about a thing the player can see.
    assert.match(LESSONS[id].name ?? "", /^[a-z ]+$/, `${id} has a name`);
  }
  // Played in order, no room opens on more than one new thing.
  const known = new Set();
  for (const room of ROOMS) {
    const fresh = fixturesIn(room).filter((id) => !known.has(id));
    assert.ok(fresh.length <= 1, `${room.id} brings ${fresh.join(", ")}`);
    for (const id of fresh) known.add(id);
  }
});

test("a fixture's lesson comes at the start of its room's planning, ahead of everything else", () => {
  const world = createWorld(ROOMS[introducedIn("ice")]);
  const cue = planningLesson(world, () => false, { drafting: false });
  assert.equal(cue?.lesson.id, "ice");
  assert.equal(cue?.target.kind, "block");
  // Once it's known, the room teaches nothing new of its own.
  assert.equal(planningLesson(world, (id) => id !== "dial", { drafting: false }), null);
});

test("every lesson about a fixture points inside the room, in every room, mirrored and in expert", () => {
  const spot = createSpot();
  for (let index = 0; index < ROOMS.length; index++) {
    for (const room of [ROOMS[index], roomAt(index, 1, true), mirrorRoom(ROOMS[index])]) {
      const world = createWorld(room);
      for (const fixture of FIXTURES) {
        const at = fixture.find(room);
        if (at < 0) continue;
        assert.ok(aim({ kind: fixture.kind, index: at }, world, spot, { cupWall: CUP_WALL }), `${room.id}: ${fixture.id}`);
        assert.ok(spot.x >= 0 && spot.x <= WIDTH && spot.y >= -8 && spot.y <= HEIGHT, `${room.id}: ${fixture.id} at ${spot.x}, ${spot.y}`);
        assert.ok(spot.ring > 0 && spot.count > 0, `${room.id}: ${fixture.id} is ringed and lit`);
        for (const box of spot.lit.slice(0, spot.count)) {
          assert.ok([box.x, box.y, box.w, box.h].every(Number.isFinite) && box.w > 0 && box.h > 0, `${room.id}: ${fixture.id} box`);
        }
      }
    }
  }
});

test("room 1 opens on the route, drawn from its own reference solution", () => {
  for (const expert of [false, true]) {
    const room = roomAt(0, 1, expert);
    const world = createWorld(room);
    const cue = planningLesson(world, () => false, { drafting: false });
    assert.equal(cue?.lesson.id, "route");
    const ghost = ghostRoute(room);
    assert.deepEqual(
      ghost?.map(({ x, y }) => [x, y]),
      room.solution.strokes[0],
    );
    const spot = createSpot();
    assert.ok(aim(cue.target, world, spot, { cupWall: CUP_WALL }));
    // The loop sits on the ghost's start, where the pen goes down.
    assert.deepEqual([spot.x, spot.y], room.solution.strokes[0][0]);
  }
});

test("following the ghost literally clears room 1, pouring at once or letting the kettle pour", () => {
  for (const expert of [false, true]) {
    const room = roomAt(0, 1, expert);
    const straw = room.solution.strokes[0];
    assert.ok(simulate(room, [straw], { pourAt: 0 }).result.cleared, `${expert ? "expert" : "normal"}: Pour at once`);
    assert.ok(simulate(room, [straw], { pourAt: 1e9 }).result.cleared, `${expert ? "expert" : "normal"}: the kettle pours`);
  }
});

test("how much of the ghost a straw covers doesn't depend on which way it was drawn", () => {
  const ghost = ghostRoute(ROOMS[0]);
  const straw = routeVariant(ROOMS[0], 0, 0.8, 3);
  assert.equal(coverage(ghost, straw), coverage(ghost, [...straw].reverse()));
  assert.equal(coverage(ghost, ROOMS[0].solution.strokes[0]), 1);
  // Half the straw covers half the ghost, and the little within reach of its end.
  const length = Math.hypot(ghost[1].x - ghost[0].x, ghost[1].y - ghost[0].y);
  assert.ok(Math.abs(coverage(ghost, routeVariant(ROOMS[0], 0, 0.5)) - (0.5 + NEAR / length)) < 0.02);
  assert.ok(follows(ghost, [...ROOMS[0].solution.strokes[0]].reverse()));
});

/** Room 1's reference straw turned about its start by `degrees` and stretched by `scale`. */
function turned(room, degrees, scale = 1) {
  const [[ax, ay], [bx, by]] = room.solution.strokes[0];
  const a = (degrees * Math.PI) / 180;
  const dx = (bx - ax) * scale;
  const dy = (by - ay) * scale;
  return [
    [ax, ay],
    [ax + dx * Math.cos(a) - dy * Math.sin(a), ay + dx * Math.sin(a) + dy * Math.cos(a)],
  ];
}

test("the route is learned on what the engine says the straws do, never on covering the ghost alone", () => {
  let checked = 0;
  for (const expert of [false, true]) {
    const room = roomAt(0, 1, expert);
    const straws = [];
    for (const [t0, t1] of [[0, 1], [0.06, 0.9], [0.1, 1.1], [0, 0.7]]) {
      for (const offset of [-NEAR - 1, -3, 0, 3, NEAR + 1]) {
        straws.push(routeVariant(room, t0, t1, offset), routeVariant(room, t1, t0, offset));
      }
    }
    for (const degrees of [-35, -20, -10, -5, 5, 10, 20, 35]) straws.push(turned(room, degrees), turned(room, degrees, 1.15));
    // Covers the ghost by the numbers, but steep enough to throw every drop past the cup.
    straws.push([
      [55, 130],
      [150, 188],
    ]);
    for (const drawn of straws) {
      // Judged as the room lays it down: a straw longer than the room's straw stops short.
      const world = createWorld(room);
      drawStrokes(world, [drawn]);
      if (!world.strokes.length) continue;
      const verdict = routeVerdict(room, world.strokes, world.strokes[0].id);
      const points = world.strokes.map((stroke) => stroke.points);
      const pressed = simulate(room, points, { pourAt: 0 }).result.cleared;
      const waited = simulate(room, points, { pourAt: 1e9 }).result.cleared;
      assert.equal(verdict.learned, pressed, `${expert ? "expert" : "normal"}: ${JSON.stringify(drawn)}`);
      // Learned means following "Pour when the straws are ready" literally clears, or letting the kettle pour.
      if (verdict.learned) assert.ok(waited);
      else assert.equal(verdict.offGhost, world.strokes[0].id, "a straw that doesn't work is where taking one back is taught");
      checked++;
    }
  }
  assert.ok(checked > 100);
  const steep = createWorld(ROOMS[0]);
  drawStrokes(steep, [
    [
      [55, 130],
      [150, 188],
    ],
  ]);
  assert.ok(follows(ghostRoute(ROOMS[0]), steep.strokes[0].points), "it covers the ghost");
  assert.equal(routeVerdict(ROOMS[0], steep.strokes, steep.strokes[0].id).learned, false, "but catches nothing, so it isn't learned");
});

test("a straw that misses where the tea lands, or runs off the ghost, isn't following it", () => {
  const ghost = ghostRoute(ROOMS[0]);
  // Cut short at the start: the stream falls past it (and the room spills).
  const short = routeVariant(ROOMS[0], 0.2, 1);
  assert.equal(follows(ghost, short), false);
  assert.equal(simulate(ROOMS[0], [short], { pourAt: 0 }).result.cleared, false);
  // A straw the wrong way, from under the stream back toward the wall.
  const wrong = [
    [56, 142],
    [22, 186],
  ];
  assert.ok(coverage(ghost, wrong) < COVER);
  assert.equal(follows(ghost, wrong), false);
  assert.equal(wouldClear(ROOMS[0], [{ points: wrong }]), false, "so it is where taking a straw back is taught");
  // A straw of the player's own that works is never taught as one to take back.
  const own = routeVariant(ROOMS[0], 0, 1, 10);
  assert.equal(follows(ghost, own), false);
  assert.equal(wouldClear(ROOMS[0], [{ points: own }]), true);
});

test("a straw along the ghost with another undoing it isn't the route learned", () => {
  const room = ROOMS[0];
  const lay = (...straws) => {
    const world = createWorld(room);
    drawStrokes(world, straws);
    return world.strokes;
  };
  const reference = room.solution.strokes[0];
  assert.deepEqual(routeVerdict(room, lay(reference), 1), { learned: true, offGhost: -1 });
  // A straw above it turning the stream away: taking a straw back is taught on that one.
  const blocked = lay(reference, [
    [60, 100],
    [30, 120],
  ]);
  assert.equal(simulate(room, blocked.map((stroke) => stroke.points), { pourAt: 0 }).result.cleared, false);
  assert.deepEqual(routeVerdict(room, blocked, blocked[0].id), { learned: false, offGhost: blocked[1].id });
  // Taken back, the ghost's straw alone is learned.
  assert.equal(routeVerdict(room, [blocked[0]], -1).learned, true);
  // The player's own way that works is learned.
  const own = lay(routeVariant(room, 0, 1, 10));
  assert.equal(routeVerdict(room, own, own[0].id).learned, true);
});

test("the ghost is room 1's alone: never another room, never a remix", () => {
  assert.equal(ROUTE_ROOM, ROOMS[0].id);
  assert.equal(planningLesson(createWorld(roomAt(0, 1, true)), () => false, { drafting: false })?.lesson.id, "route");
  for (const room of [ROOMS[1], roomAt(AFTER_HOURS, 7), roomAt(AFTER_HOURS, 8, true)]) {
    const world = createWorld(room);
    for (let n = 0; n < 2 / STEP; n++) {
      assert.notEqual(planningLesson(world, (id) => id !== "route", { drafting: false })?.lesson.id, "route", room.id);
      step(world, STEP);
    }
  }
});

test("room 1 teaches the route, then Pour once a straw is down, and nothing breaks into a stroke", () => {
  const world = createWorld(ROOMS[0]);
  assert.equal(planningLesson(world, () => false, { drafting: false })?.lesson.id, "route");
  // Route known, nothing drawn yet: nothing to say.
  assert.equal(planningLesson(world, knows("route"), { drafting: false }), null);
  assert.ok(beginStroke(world, 50, 130));
  assert.ok(extendStroke(world, 90, 150));
  assert.equal(planningLesson(world, knows("route"), { drafting: true }), null, "not while a straw is being drawn");
  extendStroke(world, 130, 170);
  assert.ok(commitStroke(world) >= 0);
  const cue = planningLesson(world, knows("route"), { drafting: false });
  assert.equal(cue?.lesson.id, "pour");
  assert.equal(cue?.target.kind, "pour");
  // The straw is low by now, but Pour comes first; the gauge waits for a room that needs it.
  assert.ok(strawLeft(world) < world.budget * LOW_SHARE);
  assert.equal(planningLesson(world, knows("route", "pour"), { drafting: false })?.lesson.id, "gauge");
  // Planning lessons end with planning.
  pourNow(world);
  step(world, STEP);
  assert.equal(planningLesson(world, () => false, { drafting: false }), null);
});

test("the dial is taught once the kettle is about to pour by itself", () => {
  const world = createWorld(ROOMS[1]);
  const learned = (id) => id !== "dial";
  while (pourCountdown(world) > DIAL_SOON + 0.05) {
    assert.equal(planningLesson(world, learned, { drafting: false }), null);
    step(world, STEP);
  }
  while (pourCountdown(world) > DIAL_SOON - 0.05) step(world, STEP);
  const cue = planningLesson(world, learned, { drafting: false });
  assert.equal(cue?.lesson.id, "dial");
  assert.equal(cue?.target.kind, "dial");
  // Pour need not be known: a player who lets the kettle pour meets the dial all the same.
  assert.equal(planningLesson(world, (id) => id !== "dial" && id !== "pour", { drafting: false })?.lesson.id, "dial");
});

test("a room's end teaches the stars, then the points, and a spill's hint, once each", () => {
  assert.equal(resultLesson(true, () => false)?.lesson.id, "stars");
  assert.equal(resultLesson(true, knows("stars"))?.lesson.id, "bonus");
  assert.equal(resultLesson(true, knows("stars", "bonus")), null);
  assert.equal(resultLesson(false, () => false)?.lesson.id, "retry");
  assert.equal(resultLesson(false, knows("retry")), null);
  assert.equal(resultLesson(true, () => false)?.target.kind, "verdict");
  assert.equal(resultLesson(false, () => false)?.target.kind, "caption");
});

test("a lesson holds while it explains, never once done or its move made, never in expert", () => {
  const up = { leaving: false };
  assert.equal(holds(LESSONS.fan, up), true);
  assert.equal(holds(LESSONS.fan, { leaving: true }), false, "done: play runs on at once");
  assert.equal(holds(LESSONS.route, { leaving: false, acting: true }), false);
  assert.equal(holds(LESSONS.fan, { leaving: false, expert: true }), false, "expert's planning time is the rule");
  assert.equal(holds(LESSONS.fill, up), true, "the pour stops while its line is read");
  assert.equal(holds(null, up), false);
  for (const lesson of Object.values(LESSONS)) {
    // Nothing runs on while a lesson is read: every one holds its part of the room.
    assert.equal(lesson.hold, true, `${lesson.id} holds`);
    // Every lesson that can't be acted on ends by itself within its allowance.
    if (!lesson.move) assert.ok((lesson.life ?? 4.5) <= HOLD, `${lesson.id} outlives its hold`);
  }
});

test("a lesson holds only the part of the room it belongs to", () => {
  const planning = { phase: "play", status: "waiting", poured: false };
  const pressed = { phase: "play", status: "waiting", poured: true };
  const pouring = { phase: "play", status: "pouring", poured: true };
  const settling = { phase: "play", status: "settling", poured: true };
  const result = { phase: "result", status: "cleared", poured: true };
  // Planning lessons hold planning, until Pour is pressed.
  assert.equal(inItsPart(LESSONS.fan, planning), true);
  assert.equal(inItsPart(LESSONS.fan, pressed), false);
  assert.equal(inItsPart(LESSONS.dial, pouring), false);
  // The fill line stops the pour where it is, never planning or a result.
  assert.equal(inItsPart(LESSONS.fill, pouring), true);
  assert.equal(inItsPart(LESSONS.fill, settling), true);
  assert.equal(inItsPart(LESSONS.fill, planning), false);
  assert.equal(inItsPart(LESSONS.fill, result), false);
  // Taking a straw back can come up planning or pouring.
  assert.equal(inItsPart(LESSONS.takeBack, planning), true);
  assert.equal(inItsPart(LESSONS.takeBack, pouring), true);
  assert.equal(inItsPart(LESSONS.takeBack, result), false);
  // A result's lessons hold the next room, and nothing else.
  assert.equal(inItsPart(LESSONS.stars, result), true);
  assert.equal(inItsPart(LESSONS.stars, pouring), false);
  assert.equal(inItsPart(LESSONS.route, { phase: "countdown", status: "waiting", poured: false }), false);
  assert.equal(inItsPart(null, planning), false);
});

test("each lesson holds for seven real seconds a visit, however often it is shown", () => {
  const visit = createHolds(false);
  const frame = 1 / 60;
  let held = 0;
  // Up for six seconds, then taken down (a straw to take back) and shown again: it has one second left.
  for (let t = 0; t < 6 - 1e-9; t += frame) if (visit.take(LESSONS.route, { leaving: false }, frame)) held += frame;
  assert.ok(Math.abs(visit.left("route") - 1) < 1e-6);
  for (let t = 0; t < 5; t += frame) if (visit.take(LESSONS.route, { leaving: false }, frame)) held += frame;
  assert.ok(held <= HOLD + frame + 1e-9 && held >= HOLD - 1e-9, `held ${held}`);
  assert.equal(visit.left("route"), 0);
  assert.equal(visit.take(LESSONS.route, { leaving: false }, frame), false, "the room reopened from the level select doesn't reset it");
  // Done, or with the tea already coming, nothing holds and nothing is spent.
  assert.equal(visit.take(LESSONS.pour, { leaving: true }, 1), false);
  assert.equal(visit.take(LESSONS.takeBack, { leaving: false, holdable: false }, 3), false);
  assert.equal(visit.left("pour"), HOLD);
  assert.equal(visit.left("takeBack"), HOLD);
  // A new visit holds again.
  visit.clear();
  assert.equal(visit.take(LESSONS.route, { leaving: false }, frame), true);
  // Expert never holds, and spends nothing.
  const expert = createHolds(true);
  assert.equal(expert.take(LESSONS.route, { leaving: false }, 1), false);
  assert.equal(expert.left("route"), HOLD);
});

test("a lesson holds only while it is read: never while a straw is drawn, and a straw changed ends it", () => {
  const visit = createHolds(false);
  assert.equal(holds(LESSONS.fan, { leaving: false, drafting: true }), false);
  assert.equal(visit.take(LESSONS.fan, { leaving: false, drafting: true }, 1), false, "a straw being drawn holds nothing");
  assert.equal(visit.left("fan"), HOLD, "and spends nothing");
  assert.equal(visit.take(LESSONS.fan, { leaving: false }, 1), true);
  // A pen down, a straw taken back, Clear: the hold is over for the visit.
  visit.end("fan");
  assert.equal(visit.left("fan"), 0);
  assert.equal(visit.take(LESSONS.fan, { leaving: false }, 1 / 60), false);
  assert.equal(visit.take(LESSONS.dial, { leaving: false }, 1 / 60), true, "other lessons still hold while they are read");
});

/** A room's state after a step, everything a held room could get out of step on. */
function snapshot(world) {
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < world.count; i++) {
    sx += world.p.x[i];
    sy += world.p.y[i];
  }
  return [
    world.time,
    world.status,
    world.beltTime,
    world.count,
    sx,
    sy,
    ...world.kettles.flatMap((kettle) => [kettle.x, kettle.startAt, kettle.delay, kettle.left]),
    ...world.cups.flatMap((cup) => [cup.x, cup.tea, cup.milk, cup.pearls]),
    ...world.gates.map((gate) => gate.open),
  ].join(" ");
}

/**
 * A room played as the screen plays it: frames of a sixtieth of a second on
 * `roomFrame`, Pour pressed (between frames) at a planning time or a real
 * time, and lessons holding over the real-time windows in `holds` until Pour
 * is pressed. Returns every step's state and the verdict.
 */
function play(room, strokes, { pourAt = Infinity, pressAtReal = Infinity, holds = [], pourHolds = [] }) {
  const world = createWorld(room);
  drawStrokes(world, strokes);
  const trace = [];
  const frame = 1 / 60;
  let accumulator = 0;
  let real = 0;
  let poured = false;
  for (let n = 0; n < 60 * 90 && world.status !== "cleared" && world.status !== "failed"; n++) {
    if (!poured && world.status === "waiting" && (world.time >= pourAt - 1e-9 || real >= pressAtReal - 1e-9)) {
      pourNow(world);
      poured = true;
    }
    const within = ([from, seconds]) => real >= from - 1e-9 && real < from + seconds - 1e-9;
    // Planning lessons hold until Pour is pressed; a lesson about the pour holds once the tea is coming.
    const holding = poured && world.status !== "waiting" ? pourHolds.some(within) : !poured && holds.some(within);
    const clock = roomFrame(world, accumulator, frame, holding);
    accumulator = clock.accumulator;
    for (let k = 0; k < clock.steps; k++) {
      step(world, STEP);
      trace.push(snapshot(world));
    }
    real += frame;
  }
  return { trace, result: world.result };
}

test("a hold freezes the room: from the same planning time it plays out step for step as if never held", () => {
  const ids = ["the-belt", "rush-hour", "latte", "milk-tea", "trolley", "two-trolleys", "the-drain"];
  const holdings = [
    [[0, 5]],
    [[1.234, 0.004]],
    [[0.5, 1 / 120]],
    [
      [2, 3],
      [9, 7],
    ],
    [[0.1, 17.3]],
  ];
  for (const id of ids) {
    const room = ROOMS.find((r) => r.id === id);
    assert.ok(room, id);
    // The authored press, the reviewer's 17.625 s (on a step), one between steps, and the kettle by itself.
    for (const pourAt of [room.solution.pourAt ?? 1.5, 17.625, 4.0042, Infinity]) {
      const plain = play(room, room.solution.strokes, { pourAt });
      assert.ok(plain.result, `${id} at ${pourAt} comes to a verdict`);
      for (const holds of holdings) {
        const held = play(room, room.solution.strokes, { pourAt, holds });
        // Before the verdict: the same state after every step, kettles' stagger and all.
        assert.equal(held.trace.length, plain.trace.length, `${id} at ${pourAt}, held ${JSON.stringify(holds)}`);
        for (let i = 0; i < plain.trace.length; i++) {
          if (held.trace[i] !== plain.trace[i]) assert.fail(`${id} at ${pourAt}, held ${JSON.stringify(holds)}: step ${i} differs`);
        }
        // And the verdict: cleared or not, stars, points, early bonus.
        assert.deepEqual(held.result, plain.result);
      }
    }
  }
});

test("a hold during the pour stops the tea where it is, and it plays out step for step as if never held", () => {
  for (const id of ["first-pour", "the-belt", "latte", "trolley"]) {
    const room = ROOMS.find((r) => r.id === id);
    assert.ok(room, id);
    const pourAt = room.solution.pourAt ?? 1.5;
    const plain = play(room, room.solution.strokes, { pourAt });
    for (const pourHolds of [[[pourAt + 0.4, 2]], [[pourAt + 0.05, 1 / 120], [pourAt + 2, 7]]]) {
      const held = play(room, room.solution.strokes, { pourAt, pourHolds });
      assert.equal(held.trace.length, plain.trace.length, `${id}, held ${JSON.stringify(pourHolds)}`);
      for (let i = 0; i < plain.trace.length; i++) {
        if (held.trace[i] !== plain.trace[i]) assert.fail(`${id}, held ${JSON.stringify(pourHolds)}: step ${i} differs`);
      }
      assert.deepEqual(held.result, plain.result);
    }
  }
});

/**
 * A room played as the screen plays it, frame by frame, by a player who
 * reads `lesson` for `read` real seconds while it holds the room, then draws
 * the room's reference straws one after another, each over `seconds` real
 * seconds from pen down to pen up, and presses Pour `pourAfter` real seconds
 * after the last. `fair` plays by the screen's rules: the pen down ends the
 * hold, and nothing holds while a straw is being drawn. Not fair is how it
 * was before: the hold ran on through the drawing. With no lesson nothing
 * holds, and the player starts at once.
 */
function playDrawing(room, { lesson = null, read = 0, seconds, pourAfter, fair = true }) {
  const world = createWorld(room);
  const visit = createHolds(false);
  const frame = 1 / 60;
  const strokes = room.solution.strokes;
  const readFrames = Math.round(read * 60);
  const drawFrames = Math.round(seconds * 60);
  const pourFrame = strokes.length * drawFrames + Math.round(pourAfter * 60);
  const trace = [];
  let accumulator = 0;
  for (let n = 0; n < 60 * 120 && world.status !== "cleared" && world.status !== "failed"; n++) {
    const f = n - readFrames;
    if (f >= 0 && f <= strokes.length * drawFrames) {
      const k = Math.min(strokes.length - 1, Math.floor(f / drawFrames));
      const [[ax, ay], [bx, by]] = strokes[k];
      const along = f / drawFrames - k;
      if (f === k * drawFrames && f < strokes.length * drawFrames) {
        // Pen down.
        if (fair && lesson) visit.end(lesson.id);
        assert.ok(beginStroke(world, ax, ay));
      } else if (f === (k + 1) * drawFrames) {
        extendStroke(world, bx, by);
        assert.ok(commitStroke(world) >= 0);
      } else {
        extendStroke(world, ax + (bx - ax) * along, ay + (by - ay) * along);
      }
      // The next straw's pen down comes on the frame the last one is laid.
      if (f === (k + 1) * drawFrames && k + 1 < strokes.length) {
        if (fair && lesson) visit.end(lesson.id);
        assert.ok(beginStroke(world, strokes[k + 1][0][0], strokes[k + 1][0][1]));
      }
    }
    if (f === pourFrame) pourNow(world);
    const holding =
      !!lesson && visit.take(lesson, { leaving: false, holdable: world.status === "waiting" && f < pourFrame, drafting: fair && !!world.draft }, frame);
    if (fair) assert.ok(!(holding && world.draft), "nothing is drawn while the room stands still");
    const clock = roomFrame(world, accumulator, frame, holding);
    accumulator = clock.accumulator;
    for (let k = 0; k < clock.steps; k++) {
      step(world, STEP);
      trace.push(snapshot(world));
    }
  }
  return { trace, result: world.result };
}

test("drawing while a lesson is up costs planning time: the same straws at the same pace score the same, held or not", () => {
  for (const id of ["first-pour", "two-kettles", "the-belt", "a-draft"]) {
    const room = ROOMS.find((r) => r.id === id);
    assert.ok(room, id);
    const lesson = room.id === ROUTE_ROOM ? LESSONS.route : LESSONS.dial;
    const seconds = 1;
    const pourAfter = Math.max(0.25, (room.solution.pourAt ?? 1.5) - room.solution.strokes.length * seconds);
    const plain = playDrawing(room, { seconds, pourAfter });
    assert.ok(plain.result, `${id} comes to a verdict`);
    for (const read of [0.5, 2, 6.5]) {
      const held = playDrawing(room, { lesson, read, seconds, pourAfter });
      assert.deepEqual(held.result, plain.result, `${id}, read for ${read} s`);
      assert.deepEqual(held.trace, plain.trace, `${id}, read for ${read} s: step for step`);
    }
  }
  // As it was, three seconds of drawing under room 1's route lesson were free, and paid early-pour points.
  const room = ROOMS[0];
  const plain = playDrawing(room, { seconds: 3, pourAfter: 0.25 });
  const leaky = playDrawing(room, { lesson: LESSONS.route, read: 1, seconds: 3, pourAfter: 0.25, fair: false });
  const fair = playDrawing(room, { lesson: LESSONS.route, read: 1, seconds: 3, pourAfter: 0.25 });
  assert.ok(plain.result.cleared && plain.result.points > 0);
  assert.ok(leaky.result.points > plain.result.points, `the old way paid ${leaky.result.points} for ${plain.result.points}`);
  assert.equal(fair.result.points, plain.result.points);
});

test("nothing is drawn into a pour stopped for a lesson: a pen down starts the tea again first", () => {
  const room = ROOMS[0];
  // A straw drawn mid-pour, out of the way, over half a second.
  const extra = [
    [200, 60],
    [232, 80],
  ];
  /**
   * The pour, the fill line's lesson holding it from the first tea into the
   * cup, and a pen down `penAfter` real seconds into that hold (or, with
   * `atStep`, the same pen down on that step of the room, nothing holding).
   */
  function run({ penAfter = Infinity, atStep = -1, hold = true }) {
    const world = createWorld(room);
    drawStrokes(world, room.solution.strokes);
    pourNow(world);
    const visit = createHolds(false);
    const frame = 1 / 60;
    let accumulator = 0;
    let upAt = -1;
    let penFrame = -1;
    let steps = 0;
    let penStep = -1;
    for (let n = 0; n < 60 * 60 && world.status !== "cleared" && world.status !== "failed"; n++) {
      const due = atStep >= 0 ? steps === atStep && penFrame < 0 : upAt >= 0 && n === upAt + Math.round(penAfter * 60);
      if (due) {
        visit.end(LESSONS.fill.id);
        assert.ok(beginStroke(world, extra[0][0], extra[0][1]));
        penFrame = n;
        penStep = steps;
      }
      if (penFrame >= 0 && world.draft) {
        const along = Math.min(1, (n - penFrame) / 30);
        extendStroke(world, extra[0][0] + (extra[1][0] - extra[0][0]) * along, extra[0][1] + (extra[1][1] - extra[0][1]) * along);
        if (along >= 1) commitStroke(world);
      }
      const holding =
        hold && upAt >= 0 && visit.take(LESSONS.fill, { leaving: false, holdable: inItsPart(LESSONS.fill, { phase: "play", status: world.status, poured: true }), drafting: !!world.draft }, frame);
      assert.ok(!(holding && world.draft), "never a straw drawn with the tea standing still");
      const clock = roomFrame(world, accumulator, frame, holding);
      accumulator = clock.accumulator;
      for (let k = 0; k < clock.steps; k++) {
        step(world, STEP);
        steps++;
        for (let i = 0; i < world.events.count; i++) if (world.events.type[i] === EVENTS.INTO_CUP && upAt < 0) upAt = n;
      }
    }
    return { result: world.result, penStep, strokes: world.strokes.length };
  }
  const held = run({ penAfter: 1 });
  assert.ok(held.penStep > 0, "the pen went down during the pour");
  assert.equal(held.strokes, 2, "and the straw was drawn");
  // The same straw, drawn from the same moment of the pour with nothing ever holding, ends the same.
  const plain = run({ atStep: held.penStep, hold: false });
  assert.equal(plain.penStep, held.penStep);
  assert.deepEqual(held.result, plain.result);
});

test("Pour pressed while a lesson holds starts the kettle on the next step", () => {
  const room = ROOMS[0];
  const strokes = room.solution.strokes;
  // Held from the start; Pour pressed three real seconds in, with the room still at its first instant.
  const held = play(room, strokes, { pressAtReal: 3, holds: [[0, 100]] });
  const first = held.trace[0].split(" ");
  assert.equal(Number(first[0]), STEP, "the first step comes the frame after the press");
  assert.equal(first[1], "pouring", "and the kettle starts on it");
  // Exactly as pressing Pour at once would have gone.
  const plain = play(room, strokes, { pourAt: 0 });
  assert.deepEqual(held.trace, plain.trace);
  assert.deepEqual(held.result, plain.result);
});

test("Continue is offered while a lesson holds, except Pour, which pouring ends", () => {
  assert.equal(continuable(LESSONS.route, true), true);
  assert.equal(continuable(LESSONS.fan, true), true);
  assert.equal(continuable(LESSONS.pour, true), false);
  assert.equal(continuable(LESSONS.fan, false), false);
});

test("a line about a thing waits for quiet; a move takes over one on its way out", () => {
  assert.equal(mayOffer(LESSONS.fan, null, 0, 0), false);
  assert.equal(mayOffer(LESSONS.fan, null, 0, REST), true);
  assert.equal(mayOffer(LESSONS.pour, null, 0, 0), true);
  assert.equal(mayOffer(LESSONS.pour, LESSONS.route, 0.1, 0, true), true);
  assert.equal(mayOffer(LESSONS.fan, LESSONS.route, 5, 0, true), false);
});

test("a device that has cleared rooms already knows what they teach", () => {
  const throughScale = new Set(Array.from({ length: introducedIn("scale") + 1 }, (_, i) => i));
  const known = new Set(knownFrom((index) => throughScale.has(index)));
  for (const id of ["route", "pour", "fill", "stars", "gauge", "dial", "bonus", "ice", "fan", "belt", "milk", "pearls", "scale"]) {
    assert.ok(known.has(id), id);
  }
  for (const id of ["glass", "rail", "sieve", "takeBack", "retry"]) assert.ok(!known.has(id), id);
  assert.deepEqual(knownFrom(() => false), []);
});

test("a cup's fill line sits inside the cup, where its order's need is drawn", () => {
  for (const room of ROOMS) {
    for (const cup of createWorld(room).cups) {
      const y = fillLineY(cup, CUP_WALL);
      assert.ok(y > cup.y - cup.h && y < cup.y, `${room.id}: line at ${y}`);
      const inner = cup.w - CUP_WALL * 4;
      assert.equal(y, Math.max(Math.round(cup.y - cup.h) + 2, Math.round(cup.y - CUP_WALL * 2 - (cup.order.need * AREA_PER_DROP) / inner)));
    }
  }
});

test("a straw lesson points at that straw, and says so when it's gone", () => {
  const world = createWorld(ROOMS[0]);
  drawStrokes(world, [
    [
      [56, 142],
      [22, 186],
    ],
  ]);
  const id = world.strokes[0].id;
  const spot = createSpot();
  assert.ok(aim({ kind: "straw", index: id }, world, spot, { cupWall: CUP_WALL }));
  assert.ok(Math.abs(spot.x - 39) < 1 && Math.abs(spot.y - 164) < 1, "at its middle");
  // The loop reaches round the whole straw, so the slip sits clear of all of it, even a tall one.
  assert.ok(spot.ring * 0.875 >= (186 - 142) / 2);
  const tall = createWorld(ROOMS[0]);
  drawStrokes(tall, [
    [
      [60, 110],
      [52, 230],
    ],
  ]);
  assert.ok(aim({ kind: "straw", index: tall.strokes[0].id }, tall, spot, { cupWall: CUP_WALL }));
  const [top, bottom] = [Math.min(...tall.strokes[0].points.map((p) => p[1])), Math.max(...tall.strokes[0].points.map((p) => p[1]))];
  assert.ok(spot.y - spot.ring * 0.875 <= top && spot.y + spot.ring * 0.875 >= bottom);
  world.strokes.length = 0;
  assert.equal(aim({ kind: "straw", index: id }, world, spot, { cupWall: CUP_WALL }), false);
});

// --- Where the callout goes ----------------------------------------------------------

/**
 * Two screens as the game lays them out (measured in a browser): room units
 * to CSS px, the tickets' bottom, the controls along the foot, and a slip of
 * the size the callout measures there.
 */
const SCREENS = {
  desktop: {
    w: 1280,
    h: 800,
    S: 1.75,
    rx: 430,
    ry: 159,
    top: 80,
    slip: { w: 300, h: 76 },
    bar: [
      { x: 452, y: 728, w: 96, h: 48 },
      { x: 560, y: 724, w: 320, h: 56 },
      { x: 892, y: 728, w: 88, h: 48 },
    ],
  },
  phone: {
    w: 375,
    h: 812,
    S: 1.4375,
    rx: 15,
    ry: 192,
    top: 118,
    slip: { w: 300, h: 84 },
    bar: [
      { x: 12, y: 713, w: 80, h: 48 },
      { x: 100, y: 716, w: 174, h: 42 },
      { x: 283, y: 713, w: 80, h: 48 },
    ],
  },
};

/** A phone on its side: the room in the screen's height, the controls in a cabinet beside it. */
const LANDSCAPE = {
  w: 667,
  h: 375,
  S: 0.8125,
  rx: 112,
  ry: 92,
  top: 72,
  slip: { w: 300, h: 70 },
  bar: [
    { x: 439, y: 307, w: 100, h: 48 },
    { x: 439, y: 243, w: 208, h: 56 },
    { x: 547, y: 307, w: 100, h: 48 },
  ],
};

/** A room box on `screen`, in CSS px. */
const px = (screen, box) => ({ x: screen.rx + box.x * screen.S, y: screen.ry + box.y * screen.S, w: box.w * screen.S, h: box.h * screen.S, weight: box.weight ?? 1 });

const overlaps = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;

/** Where the callout about `target` goes on `screen`, as the component chooses it. */
function placeOn(screen, target, world) {
  const spot = createSpot();
  assert.ok(aim(target, world, spot, { cupWall: CUP_WALL }), `${target.kind} is in the room`);
  const anchor = { x: screen.rx + spot.x * screen.S, y: screen.ry + spot.y * screen.S, ring: spot.ring * screen.S, width: spot.wide * screen.S, height: spot.tall * screen.S };
  const avoid = [...keepClear(world, spot, target).map((box) => px(screen, box)), ...screen.bar.map((box) => ({ ...box, weight: 0.25 }))];
  const view = { w: screen.w, h: screen.h, top: screen.top };
  const side = chooseSide(anchor, screen.slip, view, avoid, sidesFor(target, spot, world.room));
  return { side, rect: slipRect(side, anchor, screen.slip, view), spot, anchor, view, avoid };
}

/** The box round a polyline of {x, y} points, padded. */
function boxRound(points, pad) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
}

test("Coach's sums: a slip beside its thing fits or says so; above or below is nudged on screen", () => {
  const view = { w: 400, h: 600, top: 80 };
  const slip = { w: 200, h: 60 };
  const anchor = { x: 200, y: 300, ring: 10 };
  const above = slipRect("above", anchor, slip, view);
  assert.ok(above.fits && above.y + above.h <= anchor.y - anchor.ring * 0.8);
  assert.equal(slipRect("right", anchor, slip, view).fits, false, "no room for 200 px on the right of the middle");
  const high = slipRect("above", { x: 200, y: 120, ring: 10 }, slip, view);
  assert.equal(high.fits, false);
  assert.equal(high.y, view.top, "kept under the tickets");
  // A side beside the thing that doesn't fit is never chosen: Coach would move it.
  assert.notEqual(chooseSide(anchor, slip, view, [], ["right", "above"]), "right");
  // The side that covers less wins over the one asked for first.
  const cup = { x: 120, y: 160, w: 160, h: 100, weight: 1.5 };
  assert.equal(chooseSide(anchor, slip, view, [cup], ["above", "below"]), "below");
  assert.ok(coverCost("above", anchor, slip, view, [cup]) > 0);
  assert.equal(coverCost("below", anchor, slip, view, [cup]), 0);
});

test("room 1's route lesson keeps clear of the ghost, the cup and the kettle, on a phone and a desktop", () => {
  const world = createWorld(ROOMS[0]);
  const route = ghostRoute(world.room);
  for (const [name, screen] of Object.entries(SCREENS)) {
    const { rect, side } = placeOn(screen, { kind: "route", index: 0 }, world);
    assert.ok(!overlaps(rect, px(screen, boxRound(route, 3))), `${name}: the slip (${side}) is off the ghost`);
    for (const cup of world.cups) assert.ok(!overlaps(rect, px(screen, { x: cup.x - cup.w / 2, y: cup.y - cup.h, w: cup.w, h: cup.h })), `${name}: off the cup`);
    for (const kettle of world.kettles) assert.ok(!overlaps(rect, px(screen, { x: kettle.x - 30, y: kettle.y - 30, w: 34, h: 40 })), `${name}: off the kettle`);
  }
  // Where the room has the width, it goes out over the kitchen wall, covering nothing at all.
  const desktop = placeOn(SCREENS.desktop, { kind: "route", index: 0 }, world);
  assert.equal(coverCost(desktop.side, desktop.anchor, SCREENS.desktop.slip, desktop.view, desktop.avoid), 0);
  // On a phone on its side the room is small: the slip may have to cover the
  // kettle for a moment, but never the ghost or the cup.
  const { rect, side } = placeOn(LANDSCAPE, { kind: "route", index: 0 }, world);
  assert.ok(!overlaps(rect, px(LANDSCAPE, boxRound(route, 3))), `landscape: the slip (${side}) is off the ghost`);
  for (const cup of world.cups) assert.ok(!overlaps(rect, px(LANDSCAPE, { x: cup.x - cup.w / 2, y: cup.y - cup.h, w: cup.w, h: cup.h })), "landscape: off the cup");
});

test("the fill line's lesson stops the pour clear of the cup and of the tea coming in", () => {
  const room = ROOMS[0];
  const world = createWorld(room);
  drawStrokes(world, room.solution.strokes);
  pourNow(world);
  let into = -1;
  for (let n = 0; n < 120 * 20 && into < 0; n++) {
    step(world, STEP);
    for (let i = 0; i < world.events.count; i++) if (world.events.type[i] === EVENTS.INTO_CUP) into = world.events.a[i];
  }
  assert.ok(into >= 0, "the tea reaches the cup");
  const tea = [];
  for (let i = 0; i < world.count; i++) {
    if (world.p.cup[i] >= 0 || world.p.flags[i] & (IN_PIPE | SPILLED)) continue;
    tea.push({ x: world.p.x[i] - 2, y: world.p.y[i] - 2, w: 4, h: 4 });
  }
  assert.ok(tea.length > 0, "tea is on its way");
  for (const [name, screen] of Object.entries(SCREENS)) {
    const { rect, side } = placeOn(screen, { kind: "line", index: into }, world);
    const cup = world.cups[into];
    assert.ok(!overlaps(rect, px(screen, { x: cup.x - cup.w / 2, y: cup.y - cup.h, w: cup.w, h: cup.h })), `${name}: the slip (${side}) is off the cup`);
    for (const drop of tea) assert.ok(!overlaps(rect, px(screen, drop)), `${name}: off the tea at ${Math.round(drop.x)}, ${Math.round(drop.y)}`);
  }
});

test("a fixture's callout never covers the fixture, in its first room, on a phone and a desktop", () => {
  for (const fixture of FIXTURES) {
    const index = introducedIn(fixture.id);
    const world = createWorld(ROOMS[index]);
    const cue = planningLesson(world, (id) => id !== fixture.id, { drafting: false });
    assert.equal(cue?.lesson.id, fixture.id, `${fixture.id} is taught in room ${index + 1}`);
    for (const [name, screen] of Object.entries(SCREENS)) {
      const { rect, side, spot } = placeOn(screen, cue.target, world);
      assert.ok(!overlaps(rect, rect.loop), `${fixture.id} on a ${name}: the slip (${side}) is off its brackets`);
      // The thing itself: what the spotlight keeps lit, less its margin.
      const lit = spot.lit[0];
      const thing = { x: lit.x + 4, y: lit.y + 4, w: lit.w - 8, h: lit.h - 8 };
      assert.ok(!overlaps(rect, px(screen, thing)), `${fixture.id} on a ${name}: the slip (${side}) is off the thing`);
    }
  }
});
