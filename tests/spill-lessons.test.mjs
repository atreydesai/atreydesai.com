import assert from "node:assert/strict";
import test from "node:test";

import {
  AFTER_HOURS,
  HEIGHT,
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
  continuable,
  coverage,
  createHolds,
  createSpot,
  fillLineY,
  fixturesIn,
  follows,
  ghostRoute,
  holds,
  introducedIn,
  knownFrom,
  mayOffer,
  planningLesson,
  resultLesson,
  ROUTE_ROOM,
  roomFrame,
  routeVerdict,
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
  assert.equal(holds(LESSONS.fill, up), false, "the pour is live");
  assert.equal(holds(null, up), false);
  // Every lesson that holds and can't be acted on ends by itself within its allowance.
  for (const lesson of Object.values(LESSONS)) {
    if (lesson.hold && !lesson.move) assert.ok((lesson.life ?? 4.5) <= HOLD, `${lesson.id} outlives its hold`);
  }
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
function play(room, strokes, { pourAt = Infinity, pressAtReal = Infinity, holds = [] }) {
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
    const holding = !poured && holds.some(([from, seconds]) => real >= from - 1e-9 && real < from + seconds - 1e-9);
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
