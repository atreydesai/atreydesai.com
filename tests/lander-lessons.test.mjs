import assert from "node:assert/strict";
import test from "node:test";

import { createCoach } from "../src/lib/arcade/core/coach.ts";
import { createControls } from "../src/lib/arcade/core/controls.ts";
import {
  FOOT_DROP,
  MAX_FUEL,
  altitudeOf,
  clearance,
  createPilot,
  groundAt,
  makeSite,
  newShip,
  pilotControls,
  stepShip,
  zoomForClearance,
} from "../src/lib/arcade/lander-engine.js";
import {
  BURN_LEARNED,
  CUP,
  FIRST_SITE_SEED,
  GUIDED_SLIP_H,
  LANDED,
  LESSONS,
  LESSON_START,
  MOVE_PROOF,
  STEER_PROOF,
  TIE,
  TOUCHDOWN_LEAD,
  byReach,
  calloutFor,
  covered,
  landsFromHere,
  createFlightLessons,
  guidedDevice,
  headroomFor,
  cameraFloor,
  leadOn,
  lessonAhead,
  nearestBelow,
  nearestOnPath,
  padBelow,
  placeCallout,
  planApproach,
  planGuide,
  pointAt,
  slipBox,
  teaRows,
  touchdownFault,
} from "../src/lib/arcade/lander-lessons.js";

const H = 1 / 120;
const FRAME = 1 / 60;
const IDLE = Object.freeze({ left: false, right: false, thrust: false });
const SEEDS = Array.from({ length: 16 }, (_, i) => 3 + i * 7919);

/** The world on screen, as the game's camera frames it (without its lag). */
function viewAround(ship, site, viewH, units = 800) {
  const z = 1 + 1.5 * zoomForClearance(clearance(ship, site));
  const f = (z - 1) / 1.5;
  const rest = viewH / 2 - 6;
  const camY = rest + (Math.max(viewH / (2 * z) - 6, groundAt(site, ship.x) + (0.27 * viewH) / z) - rest) * f;
  return { left: ship.x - units / (2 * z), right: ship.x + units / (2 * z), bottom: camY - viewH / (2 * z), top: camY + viewH / (2 * z) };
}

/** The coach that remembers nothing, as a test wants it. */
const freshCoach = () => createCoach("lander", { persist: false });

/**
 * One flight as the game runs it: frames of real time, the coach turning
 * them into game time (none while a lesson holds play), fixed engine steps,
 * and the lessons told about each frame's controls, each step and each
 * frame. `player` picks the keys for a step from what is on screen; while a
 * move lesson holds play still it is asked each frame, as the game reads
 * the keys held, and making the move brings play back. A thing paused for
 * is continued `read` real seconds after it appears (never, for Infinity),
 * and a move frozen for is continued after `skip`.
 */
function fly(site, player, { viewH = 455, coach = freshCoach(), lessons = createFlightLessons(coach), revived = false, seconds = 80, read = 0.8, skip = Infinity, viewOf = (ship) => viewAround(ship, site, viewH) } = {}) {
  const ship = newShip(site, viewH);
  const ceiling = viewH + 30;
  lessons.start({ revived, flight: { ship, site, time: 0 }, ceiling });
  const cues = [];
  let acc = 0;
  let time = 0;
  let real = 0;
  let result = null;
  // The longest stretch one lesson (or none) has held play still.
  let stillSince = -1;
  let stillFor = undefined;
  let longestStill = 0;
  while (real < seconds && !result) {
    real += FRAME;
    const current = coach.current;
    if (current && !coach.leaving && !coach.acting) {
      if (coach.age >= (current.move ? skip : read)) coach.done(current.id);
      else if (current.move) lessons.input(player(ship, coach, lessons, time) ?? IDLE);
    }
    acc += coach.step(FRAME);
    const holding = coach.current?.id ?? null;
    if (coach.scale < 0.01) {
      if (stillSince < 0 || holding !== stillFor) {
        stillSince = real;
        stillFor = holding;
      }
      longestStill = Math.max(longestStill, real - stillSince);
    } else stillSince = -1;
    while (acc >= H && !result) {
      acc -= H;
      const keys = player(ship, coach, lessons, time) ?? IDLE;
      result = stepShip(ship, keys, site, time, H, ceiling);
      if (!result) lessons.step(keys, ship, site, H);
      time += H;
      if (result) lessons.touchdown(result);
    }
    if (result) break;
    lessons.check({ ship, site, time }, viewOf(ship), ceiling);
    const cue = lessons.cue;
    if (cue && cues[cues.length - 1]?.cue !== cue) {
      cues.push({ cue, time, real, altitude: altitudeOf(ship, site), ship: { ...ship }, guide: lessons.guide, along: lessons.along });
    }
  }
  return { result, cues, ship, coach, lessons, real, time, longestStill };
}

/**
 * A newcomer: does nothing until a lesson says what to do, a beat after it
 * appears. Burn: holds it until the fall slows, then keeps falling slowly.
 * Tilt: presses the tilt its ghost leans into first, then flies the
 * ghost's path (the autopilot's) from there on. A touchdown warning: makes
 * the fix it names (burn, or the tilt back upright or against the drift).
 */
function newcomer(site, react = 0.4) {
  let mode = "idle";
  let burnFrom = 0;
  let pilot = null;
  let lean = 0;
  return (ship, coach, lessons, time) => {
    const id = coach.current && !coach.leaving ? coach.current.id : null;
    if (id === "burn" && coach.age >= react && mode === "idle") {
      mode = "burn";
      burnFrom = time;
    }
    if (id === "steer" && coach.age >= react && mode !== "pilot") {
      mode = "pilot";
      const path = lessons.cue.path;
      pilot = createPilot(path.pad, ship);
      lean = Math.sign(path.points.find((p) => Math.abs(p.a) > 0.05)?.a ?? 1);
    }
    if (mode === "burn") {
      if (time - burnFrom >= BURN_LEARNED) mode = "slow";
      return { ...IDLE, thrust: true };
    }
    if (mode === "slow") return { ...IDLE, thrust: ship.vy < -9 };
    if (id === "touchdown" && !coach.acting && coach.age >= react) {
      const fault = lessons.cue?.fault;
      if (fault === "fast") return { ...IDLE, thrust: true };
      const turn = fault === "tilt" ? ship.angle : ship.vx;
      return { ...IDLE, left: turn > 0, right: turn <= 0 };
    }
    if (mode === "pilot") {
      // Frozen for the tilt, the first press is the ghost's lean.
      if (id === "steer" && !coach.acting) return { ...IDLE, left: lean < 0, right: lean > 0 };
      return pilotControls(pilot, ship, site, time);
    }
    return IDLE;
  };
}

test("every lesson fits the arcade's one-line voice", () => {
  for (const lesson of Object.values(LESSONS)) {
    const words = lesson.text.trim().split(/\s+/);
    assert.ok(words.length <= 8, `${lesson.id} runs to ${words.length} words`);
    assert.ok(!/[!·]/.test(lesson.text), `${lesson.id} uses a mark the voice avoids`);
    assert.match(lesson.text, /^[A-Z][^.]*[^.\s]\.$/, `${lesson.id} isn't one full sentence`);
    // Every lesson pauses play, and holds it until the move or Continue.
    assert.equal(lesson.slow, 0, `${lesson.id} slows play to ${lesson.slow} instead of pausing it`);
    assert.equal(lesson.life, Infinity, `${lesson.id} ends by itself after ${lesson.life} s`);
  }
});

test("the cup on the lander drains in four rows from a full tank", () => {
  assert.equal(teaRows(MAX_FUEL), 4);
  assert.equal(teaRows(MAX_FUEL * 0.76), 4);
  assert.equal(teaRows(MAX_FUEL * 0.75), 3);
  assert.equal(teaRows(1), 1);
  assert.equal(teaRows(0), 0);
});

test("a first flight teaches the burn first, just after go, with the fall still easy to stop", () => {
  for (const expert of [false, true]) {
    for (const seed of SEEDS) {
      for (const viewH of [200, 330, 455, 600]) {
        const site = makeSite(1, seed, undefined, { expert });
        const { cues } = fly(site, () => IDLE, { viewH, seconds: 3 });
        const where = `${expert ? "expert" : "normal"} seed ${seed} view ${viewH}`;
        assert.ok(cues.length > 0, `${where}: nothing taught`);
        assert.equal(cues[0].cue.lesson.id, "burn", `${where}: first taught ${cues[0].cue.lesson.id}`);
        assert.ok(cues[0].time >= LESSON_START && cues[0].time < LESSON_START + 0.1, `${where}: burn at ${cues[0].time.toFixed(2)} s`);
        assert.ok(cues[0].altitude > 100, `${where}: burn taught at ${cues[0].altitude.toFixed(0)} up`);
        assert.ok(cues[0].cue.path.points.length > 3, `${where}: the burn's ghost has no path`);
      }
    }
  }
});

test("a player who burns before being told is never taught it", () => {
  const site = makeSite(1, SEEDS[0]);
  const early = (ship, coach, lessons, time) => ({ ...IDLE, thrust: time < BURN_LEARNED + 0.05 });
  const { cues, coach } = fly(site, early, { seconds: 3 });
  assert.ok(!cues.some((c) => c.cue.lesson.id === "burn"));
  assert.ok(coach.learned("burn"));
});

test("a newcomer who does what each lesson says lands on a coaster", () => {
  for (const expert of [false, true]) {
    for (const seed of SEEDS) {
      for (const viewH of [200, 455]) {
        const site = makeSite(1, seed, undefined, { expert });
        const { result, cues } = fly(site, newcomer(site), { viewH });
        const where = `${expert ? "expert" : "normal"} seed ${seed} view ${viewH}`;
        const ids = cues.map((c) => c.cue.lesson.id);
        assert.equal(result?.kind, "land", `${where}: ${result?.kind ?? "still flying"} ${result?.reason ?? ""} after ${ids.join(", ")}`);
        // One new thing at a time, in the order a first descent needs them.
        assert.equal(ids[0], "burn", where);
        assert.ok(ids.includes("steer"), `${where}: never taught to tilt`);
        assert.ok(ids.indexOf("steer") < ids.indexOf("touchdown") || !ids.includes("touchdown"), where);
        assert.equal(new Set(ids).size, ids.length, `${where}: taught something twice in one flight`);
      }
    }
  }
});

test("a move freezes play at its moment until the move is made, and the move brings play back", () => {
  const site = makeSite(1, SEEDS[1]);
  // Nobody presses anything: the burn holds play still, however long it waits.
  const idle = fly(site, () => IDLE, { seconds: 30 });
  assert.equal(idle.result, null, "the flight went on with the burn untaught");
  assert.equal(idle.coach.current?.id, "burn");
  assert.ok(idle.coach.paused, "play isn't held still for the burn");
  assert.ok(idle.time < LESSON_START + 0.1, `play ran on to ${idle.time.toFixed(2)} s`);
  assert.ok(idle.longestStill > 25, `play was held only ${idle.longestStill.toFixed(1)} s`);
  assert.equal(idle.coach.learned("burn"), false);

  // The burn itself, pressed while frozen, brings play back, and burning teaches it.
  idle.lessons.input({ ...IDLE, thrust: true });
  assert.ok(idle.coach.acting, "the burn didn't count as made");
  let scale = 0;
  for (let t = 0; t < 1.5; t += FRAME) scale = idle.coach.step(FRAME, FRAME) / FRAME;
  assert.ok(scale > 0.99, `play came back only to ${scale.toFixed(2)}`);
  // A tilt is not the burn: it leaves play frozen.
  const other = fly(site, () => IDLE, { seconds: 2 });
  other.lessons.input({ ...IDLE, left: true });
  assert.equal(other.coach.acting, false, "a tilt made the burn");

  // Continue counts the burn as known, and play goes on.
  const skipped = fly(site, () => IDLE, { seconds: 3, skip: 1 });
  assert.ok(skipped.coach.learned("burn"), "Continue didn't count the burn");
  assert.ok(skipped.time > idle.time + 0.1, "play didn't go on after Continue");
});

test("a move made without working comes down uncounted, and waits for a later run", () => {
  const site = makeSite(1, SEEDS[1]);
  // Taps burn once while frozen, then never again: the burn never slowed the fall.
  const tap = (ship, coach) => ({ ...IDLE, thrust: coach.current?.id === "burn" && !coach.acting });
  const first = fly(site, tap, { seconds: 60 });
  assert.equal(first.result?.kind, "crash");
  assert.equal(first.cues[0]?.cue.lesson.id, "burn");
  assert.equal(first.coach.learned("burn"), false, "a burn that never worked was counted as learned");
  assert.equal(first.coach.current, null, "the lesson outlived the flight");
  // Play ran on once the burn was made: it was never frozen past the move.
  assert.ok(first.longestStill < 1, `play was held ${first.longestStill.toFixed(1)} s after the move`);
  // Missed, it isn't taught again on this run's next lander, only on a later run.
  const next = fly(site, () => IDLE, { coach: first.coach, lessons: first.lessons, seconds: 3 });
  assert.equal(next.cues.length, 0, "the missed burn came back in the same run");
  first.lessons.newRun();
  const later = fly(site, () => IDLE, { coach: first.coach, lessons: first.lessons, seconds: 2 });
  assert.equal(later.cues[0]?.cue.lesson.id, "burn", "a later run wasn't taught the burn");

  // Burns, taps a tilt once when frozen for it, then never tilts again.
  const tilter = (ship, coach) => ({ ...IDLE, thrust: ship.vy < -6, left: coach.current?.id === "steer" && !coach.acting });
  const burner = fly(site, tilter, { seconds: 40 });
  assert.ok(burner.cues.some((c) => c.cue.lesson.id === "steer"), "the tilt was never taught");
  assert.equal(burner.coach.learned("steer"), false);
});

test("the tilt lesson's ghost is the autopilot landing on a coaster, planned without moving the cup", () => {
  let planned = 0;
  for (const expert of [false, true]) {
    for (const seed of SEEDS.slice(0, 8)) {
      for (const n of [1, 2, 5]) {
        const site = makeSite(n, seed, undefined, { expert });
        const ship = newShip(site, 455);
        // Somewhere along a slow fall, as a newcomer would be.
        for (let t = 0; t < 3; t += H) stepShip(ship, { ...IDLE, thrust: ship.vy < -8 }, site, t, H, 485);
        const before = { ...ship };
        const path = planApproach(ship, site, 3, { ceiling: 485, view: viewAround(ship, site, 455) });
        assert.deepEqual(ship, before, "planning moved the cup");
        if (!path) continue;
        planned++;
        const where = `${site.terrain} n${n} seed ${seed}`;
        assert.ok(path.pad && site.pads.includes(path.pad), where);
        const [x0, y0, a0] = [path.points[0].x, path.points[0].y, path.points[0].a];
        assert.deepEqual([x0, y0, a0], [ship.x, ship.y, ship.angle], `${where}: the path doesn't start at the cup`);
        assert.ok(path.points.length <= 24 / 0.1 + 2, `${where}: ${path.points.length} points`);
        assert.ok(path.land, where);
        assert.ok(Math.abs(path.land.y - (path.pad.y + FOOT_DROP)) < 1e-6, `${where}: the ghost doesn't rest on its coaster`);
        assert.ok(padBelow(path.land, site)?.pad === path.pad, `${where}: the ghost lands off its coaster`);
      }
    }
  }
  assert.ok(planned >= 44, `only ${planned} of 48 flights had a landing in reach`);
});

/** Flies the touchdown lesson's fix from a copy: the autopilot's final descent onto the coaster below. */
function flyFix(ship, site, time, pad) {
  const copy = { ...ship };
  const pilot = createPilot(pad, copy);
  pilot.descending = true;
  for (let k = 0; k < 120 * 10; k++) {
    const result = stepShip(copy, pilotControls(pilot, copy, site, time + k * H), site, time + k * H, H);
    if (result) return result;
  }
  return null;
}

test("the touchdown lesson comes only when doing what it says still lands, low tea and late included", () => {
  let cues = 0;
  let lowTea = 0;
  const known = (id) => id !== "touchdown";
  for (const expert of [false, true]) {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const n of [1, 3, 6]) {
        for (const late of [8, 20, 35]) {
          for (const tea of [Infinity, 120, 40]) {
            const site = makeSite(n, seed, undefined, { expert });
            const ship = newShip(site, 455);
            const pad = site.pads[seed % 4];
            const pilot = createPilot(pad, ship);
            // The autopilot, holding off its burn on the way down (a hot
            // approach), and in some runs with little tea left by then.
            for (let t = 0, k = 0; k < 120 * 40; k++, t += H) {
              const keys = pilotControls(pilot, ship, site, t);
              if (pilot.descending && ship.y - FOOT_DROP - pad.y > late) keys.thrust = false;
              if (pilot.descending && ship.fuel > tea) ship.fuel = tea;
              if (stepShip(ship, keys, site, t, H, 485)) break;
              const cue = lessonAhead({ ship, site, time: t + H }, known, viewAround(ship, site, 455));
              if (!cue) continue;
              cues++;
              if (ship.fuel <= 120) lowTea++;
              const where = `${expert ? "expert" : "normal"} ${site.terrain} seed ${seed} n${n} tea ${ship.fuel.toFixed(0)}: ${cue.fault}`;
              assert.equal(cue.lesson.id, "touchdown", where);
              assert.equal(padBelow(ship, site)?.pad, cue.pad, `${where}: not over its coaster`);
              assert.ok(ship.vy < 0, where);
              // At the moment to act, not a second early.
              const lead = touchdownFault(ship, site, ship.y - FOOT_DROP - cue.pad.y)?.lead ?? -1;
              assert.ok(lead >= TOUCHDOWN_LEAD[0] && lead <= TOUCHDOWN_LEAD[1], `${where}: frozen ${lead.toFixed(2)} s before the fix is needed`);
              // Judged by the engine itself: slow, level and still from here lands.
              const outcome = flyFix(ship, site, t + H, cue.pad);
              assert.equal(outcome?.kind, "land", `${where}: the fix ${outcome ? `crashes (${outcome.reason})` : "never lands"}`);
              break;
            }
          }
        }
      }
    }
  }
  assert.ok(cues >= 300, `only ${cues} hot approaches were warned`);
  assert.ok(lowTea >= 40, `only ${lowTea} warnings with little tea left`);
});

test("no warning once a safe landing is out of reach, and one up comes down as the chance goes", () => {
  // Over the first coaster, feet 12 up, falling 15, leaning 0.7 rad, the cup empty: lost.
  const site = makeSite(1, 3);
  const pad = site.pads[0];
  const lost = { ...newShip(site, 455), x: pad.cx, y: pad.y + FOOT_DROP + 12, vx: 0, vy: -15, angle: 0.7, spin: 0, fuel: 0 };
  assert.equal(flyFix(lost, site, 5, pad)?.kind, "crash", "the case isn't lost after all");
  assert.equal(landsFromHere(lost, site, 5), false);
  assert.equal(lessonAhead({ ship: lost, site, time: 5 }, (id) => id !== "touchdown", viewAround(lost, site, 455)), null);

  // A warning shown in time, its fix tapped once and then nothing done: it
  // is withdrawn before the crash, uncounted.
  const coach = createCoach("lander", { persist: false });
  for (const id of ["burn", "coaster", "steer", "wind", "fuel"]) coach.skip(id);
  const lessons = createFlightLessons(coach);
  const site3 = makeSite(3, SEEDS[2]);
  const target = site3.pads[2];
  let pilot = null;
  let warnedOnce = false;
  const flight = fly(site3, (ship, c, l, time) => {
    pilot ??= createPilot(target, ship);
    // Hot: the autopilot holding off its burn on the way down, until warned;
    // then the fix pressed while frozen, and hands off.
    if (c.current?.id === "touchdown" && !c.acting) return { ...IDLE, thrust: true, left: true };
    warnedOnce ||= c.current?.id === "touchdown";
    if (warnedOnce) return IDLE;
    const keys = pilotControls(pilot, ship, site3, time);
    if (pilot.descending && ship.y - FOOT_DROP - target.y > 8) keys.thrust = false;
    return keys;
  }, { coach, lessons, seconds: 90 });
  assert.ok(flight.cues.some((c) => c.cue.lesson.id === "touchdown"), "no warning came");
  assert.equal(flight.result?.kind, "crash");
  assert.equal(coach.learned("touchdown"), false);
  assert.equal(coach.current, null, "the warning stayed up to the crash");
});

test("a touchdown about to go wrong takes over a tilt still waiting, which isn't counted", () => {
  const site = makeSite(3, SEEDS[5]);
  const ship = newShip(site, 455);
  const pad = site.pads[1];
  const pilot = createPilot(pad, ship);
  let time = 0;
  let hot = false;
  // The autopilot, holding off its burn on the way down, until a touchdown warning is due.
  for (let k = 0; k < 120 * 40 && !hot; k++, time += H) {
    const keys = pilotControls(pilot, ship, site, time);
    if (pilot.descending && ship.y - FOOT_DROP - pad.y > 10) keys.thrust = false;
    assert.equal(stepShip(ship, keys, site, time, H, 485), null, "touched down before any warning");
    hot = lessonAhead({ ship, site, time: time + H }, (id) => id !== "touchdown", viewAround(ship, site, 455))?.lesson.id === "touchdown";
  }
  assert.ok(hot);
  const coach = createCoach("lander", { persist: false });
  for (const id of ["burn", "coaster", "wind", "fuel"]) coach.skip(id);
  const lessons = createFlightLessons(coach);
  lessons.start();
  coach.offer(LESSONS.steer);
  for (let t = 0; t < 1; t += FRAME) coach.step(FRAME);
  lessons.check({ ship, site, time }, viewAround(ship, site, 455), 485);
  assert.equal(lessons.cue?.lesson.id, "touchdown");
  assert.equal(coach.learned("steer"), false, "the tilt that gave way was counted");
});

test("a touchdown warning that has been acted on isn't pushed aside by the tilt", () => {
  const site = makeSite(1, SEEDS[4]);
  const ship = { ...newShip(site, 455), y: 200, vx: 29, vy: -4 };
  const coach = createCoach("lander", { persist: false });
  for (const id of ["burn", "coaster"]) coach.skip(id);
  const lessons = createFlightLessons(coach);
  lessons.start();
  const view = viewAround(ship, site, 455);
  // High and drifting, the tilt is what's due next...
  assert.equal(lessonAhead({ ship, site, time: 2 }, coach.learned, view)?.lesson.id, "steer");
  // ...but a touchdown already made and playing out keeps the stage.
  coach.offer(LESSONS.touchdown);
  coach.acted("touchdown");
  lessons.check({ ship, site, time: 2 }, view, 485);
  assert.equal(coach.current?.id, "touchdown");
});

test("a resize plans the tilt's ghost afresh, and a tilt made without working comes down", () => {
  const site = makeSite(1, SEEDS[6]);
  const ship = newShip(site, 455);
  for (let t = 0; t < 2; t += H) stepShip(ship, { ...IDLE, thrust: ship.vy < -8 }, site, t, H, 485);
  const view = viewAround(ship, site, 455);
  const coach = createCoach("lander", { persist: false });
  for (const id of ["burn", "coaster"]) coach.skip(id);
  const lessons = createFlightLessons(coach);
  lessons.start();
  lessons.check({ ship, site, time: 2 }, view, 485);
  const first = lessons.cue;
  assert.equal(first?.lesson.id, "steer");
  assert.ok(first.path?.land);
  lessons.replan();
  assert.equal(coach.current, null);
  assert.equal(coach.learned("steer"), false, "a re-plan counted the tilt");
  lessons.check({ ship, site, time: 2 }, view, 485);
  assert.equal(lessons.cue?.lesson.id, "steer");
  assert.notEqual(lessons.cue.path, first.path, "the ghost wasn't planned again");

  // Tilted, never burned: the move was made but never worked.
  lessons.step({ left: true, right: false, thrust: false }, ship, site, H);
  assert.ok(coach.acting);
  for (let t = 0; t < STEER_PROOF + 0.1; t += FRAME) coach.step(FRAME);
  lessons.check({ ship, site, time: 2.1 }, view, 485);
  assert.equal(coach.current, null);
  assert.equal(coach.learned("steer"), false);
  // Nothing after it is taught on this lander.
  lessons.check({ ship, site, time: 2.2 }, view, 485);
  assert.equal(lessons.cue, null);
});

test("the tilt is learned by braking the drift over a coaster, never by burning it up the wrong way", () => {
  const site = makeSite(1, SEEDS[8]);
  // Leaning with the drift and burning: faster and faster away.
  const wrong = fly(site, (ship, coach, lessons, time) => {
    const keys = { ...IDLE, thrust: ship.vy < -6 || time > 1 };
    if (time > 1) {
      // Frozen for the tilt, it tilts with the drift.
      keys.right = ship.angle < 0.35 || (coach.current?.id === "steer" && !coach.acting);
      keys.left = !keys.right && ship.angle > 0.45;
    }
    return keys;
  }, { seconds: 30 });
  assert.ok(wrong.ship.vx > 40 || wrong.result, "the replay never sped up");
  assert.equal(wrong.coach.learned("steer"), false, "burning the drift up taught the tilt");

  // Braking it on the autopilot's way down onto a coaster teaches it, taught or not.
  const coach = createCoach("lander", { persist: false });
  for (const id of ["burn", "coaster"]) coach.skip(id);
  const lessons = createFlightLessons(coach);
  lessons.start();
  const ship = newShip(site, 455);
  const pilot = createPilot(site.pads[1], ship);
  let learnedAt = null;
  for (let t = 0, k = 0; k < 120 * 40 && learnedAt === null; k++, t += H) {
    const keys = pilotControls(pilot, ship, site, t);
    if (stepShip(ship, keys, site, t, H, 485)) break;
    lessons.step(keys, ship, site, H);
    if (coach.learned("steer")) learnedAt = { vx: ship.vx, below: padBelow(ship, site) };
  }
  assert.ok(learnedAt, "braking onto a coaster never taught the tilt");
  assert.ok(Math.abs(learnedAt.vx) <= site.safe.vx && learnedAt.below, "learned before it was lined up");
});

test("a coaster's explanation ends once the coaster has gone from view", () => {
  const site = makeSite(1, SEEDS[7]);
  const ship = newShip(site, 455);
  for (let t = 0; t < 1; t += H) stepShip(ship, IDLE, site, t, H, 485);
  const coach = createCoach("lander", { persist: false });
  coach.skip("burn");
  const lessons = createFlightLessons(coach);
  lessons.start();
  const view = viewAround(ship, site, 455);
  lessons.check({ ship, site, time: 1 }, view, 485);
  const cue = lessons.cue;
  assert.equal(cue?.lesson.id, "coaster");
  const away = { ...view, left: cue.x + 50, right: cue.x + 500 };
  lessons.check({ ship, site, time: 1.1 }, away, 485);
  assert.ok(coach.learned("coaster"));
  // Fading, or already making way for the tilt that comes next.
  assert.ok(coach.current?.id !== "coaster" || coach.leaving);
});

test("wind is named only where it blows, at a pennant on screen", () => {
  let named = 0;
  for (const expert of [false, true]) {
    for (const seed of SEEDS.slice(0, 8)) {
      for (const n of [1, 2]) {
        const site = makeSite(n, seed, undefined, { expert });
        const { cues } = fly(site, newcomer(site));
        for (const { cue, ship } of cues) {
          if (cue.lesson.id !== "wind") continue;
          named++;
          assert.ok(site.wind !== 0, `seed ${seed} n${n}: wind named on a calm site`);
          const view = viewAround(ship, site, 455);
          assert.ok(cue.x > view.left && cue.x < view.right && cue.y > view.bottom && cue.y < view.top, "the pennant is off screen");
        }
      }
    }
  }
  assert.ok(named > 0, "the wind was never named");
});

test("the tea is named once it has visibly gone, in a calm moment", () => {
  let named = 0;
  for (const seed of SEEDS.slice(0, 8)) {
    for (const n of [1, 3]) {
      const site = makeSite(n, seed);
      const coach = createCoach("lander", { persist: false });
      for (const id of Object.keys(LESSONS)) if (id !== "fuel") coach.skip(id);
      // A pilot who needs no other lesson, flying to the far coaster.
      let pilot = null;
      const { cues } = fly(site, (ship, c, l, time) => pilotControls((pilot ??= createPilot(site.pads[3], ship)), ship, site, time), { coach });
      for (const { cue, ship } of cues) {
        if (cue.lesson.id !== "fuel") continue;
        named++;
        assert.ok(teaRows(ship.fuel) < teaRows(site.fuel) || ship.fuel <= site.fuel * 0.8, "named before the tea visibly went");
        assert.ok(ship.vy > -site.safe.vy && altitudeOf(ship, site) > 60, "named over a fall that needs the player");
      }
    }
  }
  assert.ok(named > 0, "the tea was never named");
});

test("a lander sent after a crash says what the crash cost, once", () => {
  const site = makeSite(1, SEEDS[2]);
  const coach = createCoach("lander", { persist: false });
  for (const id of ["burn", "coaster", "steer", "touchdown", "fuel", "wind"]) coach.skip(id);
  const first = fly(site, () => IDLE, { coach, revived: true, seconds: 4 });
  assert.equal(first.cues[0]?.cue.lesson.id, "landers");
  const calm = fly(site, () => IDLE, { coach, revived: false, seconds: 4 });
  assert.equal(calm.cues.length, 0);
});

test("while the game's own line is read, only a move may come in", () => {
  const site = makeSite(1, SEEDS[3]);
  const ship = newShip(site, 455);
  for (let t = 0; t < 1; t += H) stepShip(ship, IDLE, site, t, H, 485);
  const view = viewAround(ship, site, 455);
  const coach = createCoach("lander", { persist: false });
  const lessons = createFlightLessons(coach);
  lessons.start();
  lessons.check({ ship, site, time: 1 }, view, 485, true);
  assert.equal(lessons.cue?.lesson.id, "burn", "a move waited for the caption");

  const later = createCoach("lander", { persist: false });
  for (const id of ["burn", "steer", "touchdown", "fuel", "wind", "landers"]) later.skip(id);
  const things = createFlightLessons(later);
  things.start();
  things.check({ ship, site, time: 1 }, view, 485, true);
  assert.equal(things.cue, null, "a thing came in over the caption");
  things.check({ ship, site, time: 1 }, view, 485, false);
  assert.equal(things.cue?.lesson.id, "coaster");
});

test("a first feather landing is named beside the cup", () => {
  const coach = createCoach("lander", { persist: false });
  const lessons = createFlightLessons(coach);
  lessons.start();
  const pad = { cx: 0, y: 50, width: 60, multiplier: 3 };
  // A touchdown warning is up when the cup lands, and fades as it counts.
  coach.offer(LESSONS.touchdown);
  lessons.touchdown({ kind: "land", pad, points: 400, feather: true });
  assert.ok(coach.learned("touchdown"));
  assert.equal(lessons.cue?.lesson.id, "feather");
  assert.ok(lessons.cue.ship);
  // Read for long enough, it counts; the next flight starts clean.
  for (let t = 0; t < 2; t += FRAME) coach.step(FRAME);
  lessons.start();
  assert.ok(coach.learned("feather"));
  assert.equal(lessons.cue, null);
});

test("the same inputs land the same at full speed, in a lesson's slow motion, and at 5 frames a second", () => {
  for (const [seed, n, expert] of [[SEEDS[0], 1, false], [SEEDS[3], 4, true], [SEEDS[9], 2, false]]) {
    const site = makeSite(n, seed, undefined, { expert });
    // The inputs, step by step: the autopilot's flight at full speed.
    const recorded = [];
    {
      const ship = newShip(site, 455);
      const pilot = createPilot(site.pads[2], ship);
      for (let k = 0; k < 120 * 40; k++) {
        const keys = pilotControls(pilot, ship, site, k * H);
        recorded.push(keys);
        if (stepShip(ship, keys, site, k * H, H, 485)) break;
      }
    }
    /** Replays the inputs through frames of `frames()` real seconds, at the coach's speed, as the game does. */
    const replay = (frames, slow) => {
      const coach = createCoach("lander", { persist: false });
      if (slow) coach.offer({ id: "hold", text: "Hold.", slow, life: Infinity, move: true });
      const ship = newShip(site, 455);
      let acc = 0;
      let k = 0;
      for (let frame = 0; frame < 200000; frame++) {
        const raw = frames(frame);
        acc += coach.step(raw, Math.min(raw, 0.05));
        while (acc >= H) {
          acc -= H;
          const result = stepShip(ship, recorded[k] ?? IDLE, site, k * H, H, 485);
          k++;
          if (result) {
            return { kind: result.kind, reason: result.kind === "crash" ? result.reason : null, points: result.kind === "land" ? result.points : 0, steps: k, x: ship.x, fuel: ship.fuel };
          }
        }
      }
      return null;
    };
    const full = replay(() => 1 / 60, 0);
    assert.ok(full, `seed ${seed}: never touched down`);
    assert.deepEqual(replay(() => 1 / 60, 0.3), full, `seed ${seed}: slow motion changed the landing`);
    assert.deepEqual(replay(() => 1 / 5, 0), full, `seed ${seed}: 5 fps changed the landing`);
    assert.deepEqual(replay(() => 1 / 5, 0.35), full, `seed ${seed}: 5 fps in slow motion changed the landing`);
    assert.deepEqual(replay((f) => (f % 7 === 0 ? 1 / 5 : 1 / 144), 0.25), full, `seed ${seed}: an uneven frame rate changed the landing`);
  }
});

test("a learned lesson is never taught again", () => {
  const coach = createCoach("lander", { persist: false });
  for (const id of Object.keys(LESSONS)) coach.skip(id);
  for (const expert of [false, true]) {
    for (const seed of SEEDS.slice(0, 4)) {
      const site = makeSite(2, seed, undefined, { expert });
      const { cues } = fly(site, newcomer(site), { coach, revived: true, seconds: 20 });
      assert.equal(cues.length, 0);
    }
  }
});

// --- The guided first flight --------------------------------------------------------

test("the coaster aimed at is the one nearest straight below, a near tie going to the lower one", () => {
  const pad = (cx, y, multiplier = 2) => ({ cx, y, width: 60, multiplier });
  const a = pad(150, 80);
  const b = pad(400, 40, 5);
  const c = pad(-60, 90, 3);
  assert.equal(nearestBelow(100, [a, b, c]).pad, a);
  // Within TIE of the nearest, the lower-lying wins, wherever it is.
  const low = pad(100 - 50 - TIE + 1, 30);
  assert.equal(nearestBelow(100, [a, low]).pad, low);
  const far = pad(100 - 50 - TIE - 1, 30);
  assert.equal(nearestBelow(100, [a, far]).pad, a);
  // On the wrapped moon, the copy nearest the cup counts.
  const behind = pad(1180, 60);
  assert.deepEqual(nearestBelow(100, [b, behind]), { pad: behind, cx: -20 });
  assert.deepEqual(byReach(100, [b, c, a]), [a, c, b]);
  assert.equal(nearestBelow(100, []), null);
});

test("a device that has never landed is guided the whole way down, by the autopilot's path to the coaster below the start", () => {
  let guided = 0;
  for (const expert of [false, true]) {
    for (const seed of [FIRST_SITE_SEED, ...SEEDS.slice(0, 8)]) {
      for (const viewH of [200, 455, 700]) {
        const site = makeSite(1, seed, "mare", { expert });
        const ship = newShip(site, viewH);
        const coach = freshCoach();
        const lessons = createFlightLessons(coach);
        lessons.start({ flight: { ship, site, time: 0 }, ceiling: viewH + 30 });
        const where = `${expert ? "expert" : "normal"} seed ${seed} view ${viewH}`;
        const guide = lessons.guide;
        assert.ok(lessons.guided && guide, `${where}: no guide`);
        guided++;
        assert.equal(guide.pad, nearestBelow(ship.x, site.pads).pad, `${where}: aimed at ×${guide.pad.multiplier}, not the coaster below the start`);
        assert.deepEqual([guide.points[0].x, guide.points[0].y], [ship.x, ship.y], `${where}: the path doesn't start at the cup`);
        assert.ok(Math.abs(guide.land.y - (guide.pad.y + FOOT_DROP)) < 1e-6 && padBelow(guide.land, site)?.pad === guide.pad, `${where}: the path doesn't end on its coaster`);
        // Once the device has landed, no flight is guided.
        coach.skip(LANDED);
        lessons.start({ flight: { ship, site, time: 0 }, ceiling: viewH + 30 });
        assert.equal(lessons.guide, null, `${where}: guided after a landing`);
      }
    }
  }
  assert.equal(guided, 2 * 9 * 3);
});

test("the guide follows the cup the whole way, and is flown again only once the cup has strayed far from it", () => {
  for (const expert of [false, true]) {
    for (const seed of [FIRST_SITE_SEED, ...SEEDS.slice(0, 6)]) {
      const site = makeSite(1, seed, "mare", { expert });
      const coach = freshCoach();
      const lessons = createFlightLessons(coach);
      const plans = new Set();
      let back = 0;
      let last = 0;
      let flying = 0;
      let missing = 0;
      const player = newcomer(site);
      const flight = fly(site, (ship, c, l, time) => {
        const guide = l.guide;
        if (!guide) missing++;
        else if (!plans.has(guide)) {
          plans.add(guide);
          last = 0;
        } else {
          if (l.along < last - 2.01) back++;
          last = l.along;
        }
        flying++;
        return player(ship, c, l, time);
      }, { coach, lessons });
      const where = `${expert ? "expert" : "normal"} seed ${seed}`;
      assert.equal(flight.result?.kind, "land", `${where}: ${flight.result?.kind ?? "still flying"}`);
      assert.equal(missing, 0, `${where}: the guide went missing in flight`);
      assert.equal(back, 0, `${where}: the cup was sent back along the guide`);
      // Planned at the start, again for the tilt, and otherwise only when strayed.
      assert.ok(plans.size >= 2 && plans.size <= 5, `${where}: planned ${plans.size} times`);
      // It stays to the touchdown (for the game to fade), and the next flight is not guided.
      assert.ok(lessons.guide, `${where}: the guide was gone at the touchdown`);
      lessons.start({ flight: { ship: newShip(site, 455), site, time: 0 }, ceiling: 485 });
      assert.equal(lessons.guide, null, `${where}: still guided after a landing`);
    }
  }
});

test("a path is followed by where on it the cup is, and its ghost leads the cup", () => {
  const points = Array.from({ length: 11 }, (_, i) => ({ x: i * 10, y: 100 - i * 5, a: i * 0.05, b: i > 5 }));
  const path = { points, pad: null, land: null, relative: false, sample: 0.1 };
  assert.deepEqual(pointAt(points, 2.5), { x: 25, y: 87.5, a: 0.125, b: false });
  assert.deepEqual(pointAt(points, 99), points[10]);
  const near = nearestOnPath(points, 31, 87, 0);
  assert.ok(Math.abs(near.s - 3) < 1e-9 && Math.abs(near.distance - Math.hypot(1, 2)) < 1e-9, JSON.stringify(near));
  // Never more than a couple of points back from where the cup was.
  assert.ok(nearestOnPath(points, 0, 100, 8).s >= 6);
  // A second on, and never nearer than its reach.
  assert.equal(leadOn(path, 2, { seconds: 0.3, reach: 0 }), 5);
  const lead = leadOn(path, 2, { seconds: 0, reach: 34 });
  const [a, b] = [pointAt(points, 2), pointAt(points, lead)];
  assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 34) < 1e-6);
  assert.equal(leadOn(path, 9.5), 10);
});

test("a guided device's first site is flat under the start, with a wide coaster just ahead that a newcomer lands on", () => {
  for (const expert of [false, true]) {
    const site = makeSite(1, FIRST_SITE_SEED, "mare", { expert });
    const start = newShip(site, 455);
    const { pad, cx } = nearestBelow(start.x, site.pads);
    const where = expert ? "expert" : "normal";
    assert.equal(pad.multiplier, 2, `${where}: the coaster below the start is ×${pad.multiplier}`);
    assert.equal(pad.width, Math.max(...site.pads.map((p) => p.width)), `${where}: not the widest coaster`);
    // Ahead of the cup, which drifts right: the drift carries it over.
    assert.ok(cx - start.x > 20 && cx - start.x < 80, `${where}: ${(cx - start.x).toFixed(0)} ahead`);
    let low = Infinity;
    let high = -Infinity;
    for (let x = start.x - 60; x <= cx + 80; x += 2) {
      low = Math.min(low, groundAt(site, x));
      high = Math.max(high, groundAt(site, x));
    }
    assert.ok(high - low < 3, `${where}: the ground under the start rises and falls ${(high - low).toFixed(1)}`);
    // The ×5 is in view at the start on a wide screen, so the coaster lesson's ×5 can be seen.
    const five = site.pads.find((p) => p.multiplier === 5);
    const view = viewAround(start, site, 455);
    const fiveX = five.cx + Math.round((start.x - five.cx) / 1200) * 1200;
    assert.ok(fiveX > view.left && fiveX < view.right, `${where}: the ×5 is out of view`);
    for (const viewH of [200, 330, 455, 600, 700]) {
      const { result, ship, cues } = fly(site, newcomer(site), { viewH });
      assert.equal(result?.kind, "land", `${where} view ${viewH}: ${result?.kind ?? "still flying"} ${result?.reason ?? ""}`);
      assert.equal(result.pad, pad, `${where} view ${viewH}: landed on another coaster`);
      assert.ok(ship.fuel >= site.fuel * 0.4, `${where} view ${viewH}: landed with ${ship.fuel.toFixed(0)} of ${site.fuel}`);
      // The coaster named is the one aimed at.
      const named = cues.find((c) => c.cue.lesson.id === "coaster");
      assert.equal(named?.cue.pad, pad, `${where} view ${viewH}: named another coaster`);
    }
  }
});

test("off the guided flight, the coaster named and the tilt's ghost go to the coaster nearest below the cup", () => {
  for (const seed of SEEDS.slice(0, 8)) {
    const site = makeSite(1, seed);
    const coach = freshCoach();
    // A device that has landed before, but never been shown the coaster.
    coach.skip(LANDED);
    coach.skip("burn");
    const { cues } = fly(site, newcomer(site), { coach, seconds: 30 });
    const named = cues.find((c) => c.cue.lesson.id === "coaster");
    assert.ok(named, `seed ${seed}: no coaster named`);
    const view = viewAround(named.ship, site, 455);
    const seen = site.pads.filter((p) => {
      const x = p.cx + Math.round((named.ship.x - p.cx) / 1200) * 1200;
      return x >= view.left + 24 && x <= view.right - 24 && p.y >= view.bottom + 24 && p.y <= view.top - 24;
    });
    assert.equal(named.cue.pad, nearestBelow(named.ship.x, seen).pad, `seed ${seed}: named ×${named.cue.pad.multiplier}`);
    const tilt = cues.find((c) => c.cue.lesson.id === "steer");
    if (tilt) assert.equal(tilt.cue.path.pad, byReach(tilt.ship.x, site.pads).find((p) => p === tilt.cue.path.pad), `seed ${seed}`);
  }
});

// --- Where the callout goes ----------------------------------------------------------

/** Screens to try: desktop and tablet with keys, phones with the touch pads. */
const SCREENS = [
  { name: "desktop", w: 1440, h: 900, top: 84, touch: false },
  { name: "laptop", w: 1280, h: 720, top: 84, touch: false },
  { name: "tablet", w: 1024, h: 768, top: 84, touch: true },
  { name: "phone", w: 390, h: 844, top: 112, touch: true },
  { name: "small phone", w: 375, h: 667, top: 112, touch: true },
  // A phone on its side, the view shorter than the highest start.
  { name: "short phone", w: 844, h: 250, top: 64, touch: true },
];

/**
 * The game's camera over the cup, without its lag, and how it draws the
 * world on this screen: zoomed in by the ground, and never so low that the
 * cup leaves the top (with room for a line above it on a guided phone flight).
 */
function screenFor(ship, site, sc, guided = true) {
  const padsTop = sc.touch ? sc.h - 100 : sc.h;
  const bottom = Math.max(sc.top + 160, Math.min(sc.h, padsTop - 8));
  const units = sc.w >= sc.h * 1.05 ? 800 : 440;
  const base = sc.w / units;
  const viewH = (bottom - sc.top) / base;
  const z = 1 + 1.5 * zoomForClearance(clearance(ship, site));
  const f = (z - 1) / 1.5;
  const rest = viewH / 2 - 6;
  const framed = rest + (Math.max(viewH / (2 * z) - 6, groundAt(site, ship.x) + (0.27 * viewH) / z) - rest) * f;
  const camY = Math.max(framed, cameraFloor(ship.y, { viewHeight: viewH, base, zoom: z, headroom: headroomFor(sc.w, base, guided) }));
  const scale = base * z;
  const mid = (sc.top + bottom) / 2;
  const pads = sc.touch
    ? [
        { x: 20, y: sc.h - 84, w: 156, h: 64 },
        { x: sc.w - 116, y: sc.h - 100, w: 96, h: 80 },
      ]
    : [];
  return {
    viewH,
    base,
    view: { left: ship.x - sc.w / 2 / scale, right: ship.x + sc.w / 2 / scale, top: camY + (mid - sc.top) / scale, bottom: camY - (bottom - mid) / scale },
    toX: (x) => sc.w / 2 + (x - ship.x) * scale,
    toY: (y) => mid - (y - camY) * scale,
    scale,
    screen: { w: sc.w, h: sc.h, top: sc.top + 8, bottom },
    pads,
  };
}

/**
 * The slip's size, as Coach lays it out: its widest, and on a phone a
 * longer line wraps to two, over the Continue key.
 */
const slipFor = (lesson, sc) => ({ w: 304, h: sc.w < 500 && lesson.text.length > 30 ? GUIDED_SLIP_H : 80 });

test("the callout never covers the cup, the path it is about to fly, or the coaster it aims at", () => {
  let placed = 0;
  for (const expert of [false, true]) {
    const site = makeSite(1, FIRST_SITE_SEED, "mare", { expert });
    for (const sc of SCREENS) {
      const { viewH: units } = screenFor(newShip(site, 455), site, sc);
      const { cues, result } = fly(site, newcomer(site), { viewH: units, viewOf: (ship) => screenFor(ship, site, sc).view });
      // On the short phone the cup lands before most lessons find a calm moment.
      assert.ok(cues.length >= (sc.h < 300 ? 1 : 3), `${sc.name}: only ${cues.map((c) => c.cue.lesson.id)}`);
      assert.equal(result?.kind, "land", `${sc.name}: ${result?.kind ?? "still flying"}`);
      for (const { cue, ship, guide, along } of cues) {
        const g = screenFor(ship, site, sc);
        const slip = slipFor(cue.lesson, sc);
        const at = calloutFor(cue, { cup: ship, guide, along, toX: g.toX, toY: g.toY, scale: g.scale, screen: g.screen, slip, avoid: g.pads });
        const box = slipBox(at.side, at, slip, g.screen);
        const where = `${expert ? "expert" : "normal"} ${sc.name} ${cue.lesson.id}: ${at.side}`;
        if (process.env.TM_PLACES) console.log(where, at.clear, JSON.stringify(box));
        placed++;
        // The cup is on screen whenever a lesson stops play: under the tickets, over the pads.
        const cupTop = g.toY(ship.y + CUP.high);
        const cupBottom = g.toY(ship.y + CUP.low);
        assert.ok(cupTop >= sc.top && cupBottom <= g.screen.bottom, `${where}: the cup is at ${cupTop.toFixed(0)} to ${cupBottom.toFixed(0)} px, off the play area`);
        // A phone is too narrow for the slip beside a coaster or its
        // pennant, and too short below them: there, their line sits over the
        // last of the way down, never over the cup or the coaster itself.
        const phone = sc.w < 500;
        const pad = cue.pad ?? guide.pad;
        const cx = pad.cx + Math.round((ship.x - pad.cx) / 1200) * 1200;
        const padBox = { x: g.toX(cx - pad.width / 2 - 4), y: g.toY(pad.y + 14), w: (pad.width + 8) * g.scale, h: g.toY(pad.y) + 27 - g.toY(pad.y + 14) };
        const cupBox = { x: g.toX(ship.x - CUP.half), y: g.toY(ship.y + CUP.high), w: CUP.half * 2 * g.scale, h: (CUP.high - CUP.low) * g.scale };
        const touches = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        if (sc.h < 300) {
          // A play area 160 px tall can't keep the usual margin round
          // everything: the slip still never overlaps the cup, the coaster
          // aimed at or the pads.
          for (const other of [cupBox, padBox, ...g.pads]) assert.ok(!touches(box, other), `${where} overlaps ${JSON.stringify(other)}`);
        } else if (phone && !cue.ship) {
          assert.equal(covered(box, [cupBox, ...g.pads], []), 0, `${where} covers the cup or the pads`);
          assert.ok(box.y + box.h < g.toY(guide.pad.y + 14), `${where} covers the coaster`);
        } else {
          assert.ok(at.clear, `${where} covers something`);
        }
        // Kept on screen, under the tickets and over the touch pads.
        assert.ok(box.y >= g.screen.top && box.y + box.h <= g.screen.bottom && box.x >= 16 && box.x + box.w <= sc.w - 16, `${where}: off the play area`);
      }
    }
  }
  assert.ok(placed >= 30, `only ${placed} callouts placed`);
});

test("a callout keeps its side while it still fits, and takes the clear side when it must", () => {
  const screen = { w: 800, h: 600, top: 80, bottom: 600 };
  const slip = { w: 200, h: 60 };
  const at = { x: 400, y: 300, ring: 0, width: 15, height: 15 };
  const cup = { x: 385, y: 285, w: 30, h: 30 };
  // A path heading right: the left is clear, the right isn't.
  const path = Array.from({ length: 20 }, (_, i) => ({ x: 420 + i * 10, y: 300 + i }));
  assert.equal(placeCallout({ at, slip, screen, sides: ["right", "left", "above"], avoid: [cup], path }).side, "left");
  assert.equal(placeCallout({ at, slip, screen, sides: ["right", "left", "above"], avoid: [cup], path, prefer: "above" }).side, "above");
  // Too little room beside: above, where nothing is in the way.
  const narrow = { ...screen, w: 420 };
  const tight = placeCallout({ at: { ...at, x: 210 }, slip, screen: narrow, sides: ["left", "right", "above", "below"], avoid: [{ ...cup, x: 195 }] });
  assert.equal(tight.side, "above");
  assert.equal(covered(tight.box, [{ ...cup, x: 195 }], []), 0);
});

test("play held still for a lesson and brought back lands exactly as it would have", () => {
  for (const [seed, n, expert] of [[SEEDS[0], 1, false], [FIRST_SITE_SEED, 1, true], [SEEDS[9], 2, false]]) {
    const site = makeSite(n, seed, undefined, { expert });
    const recorded = [];
    {
      const ship = newShip(site, 455);
      const pilot = createPilot(site.pads[2], ship);
      for (let k = 0; k < 120 * 40; k++) {
        const keys = pilotControls(pilot, ship, site, k * H);
        recorded.push(keys);
        if (stepShip(ship, keys, site, k * H, H, 485)) break;
      }
    }
    /** Replays the inputs, a lesson holding play still from `at` real seconds for `hold`. */
    const replay = (at, hold) => {
      const coach = freshCoach();
      const ship = newShip(site, 455);
      let acc = 0;
      let k = 0;
      for (let frame = 0, real = 0; frame < 200000; frame++, real += FRAME) {
        if (real >= at && !coach.current && real < at + hold) coach.offer({ id: "hold", text: "Hold.", slow: 0, life: Infinity, move: true });
        if (coach.current && real >= at + hold) coach.acted("hold");
        acc += coach.step(FRAME, FRAME);
        while (acc >= H) {
          acc -= H;
          const result = stepShip(ship, recorded[k] ?? IDLE, site, k * H, H, 485);
          k++;
          if (result) return { kind: result.kind, points: result.kind === "land" ? result.points : 0, steps: k, x: ship.x, fuel: ship.fuel };
        }
      }
      return null;
    };
    const straight = replay(Infinity, 0);
    assert.equal(straight?.kind, "land", `seed ${seed}`);
    assert.deepEqual(replay(1, 5), straight, `seed ${seed}: a pause changed the landing`);
    assert.deepEqual(replay(3.3, 0.4), straight, `seed ${seed}: a short pause changed the landing`);
  }
});

// --- Review fixes: fair starts, the cup in view, guidance until a landing, no carried taps ---

test("a guided flight starts where any other does and scores the same for the same flying", () => {
  for (const expert of [false, true]) {
    const site = makeSite(1, FIRST_SITE_SEED, "mare", { expert });
    for (const viewH of [200, 330, 508, 700]) {
      // The keys, step by step: a pilot onto the coaster below, as any player might fly it.
      const recorded = [];
      {
        const ship = newShip(site, viewH);
        const pilot = createPilot(nearestBelow(ship.x, site.pads).pad, ship);
        for (let k = 0; k < 120 * 40; k++) {
          const keys = pilotControls(pilot, ship, site, k * H);
          recorded.push(keys);
          if (stepShip(ship, keys, site, k * H, H, viewH + 30)) break;
        }
      }
      const player = (ship, coach, lessons, time) => recorded[Math.round(time / H)] ?? IDLE;
      // Planning the guide never moves the cup.
      const ship = newShip(site, viewH);
      const before = { ...ship };
      createFlightLessons(freshCoach()).start({ flight: { ship, site, time: 0 }, ceiling: viewH + 30 });
      assert.deepEqual(ship, before, "planning the guide moved the cup");
      // A fresh device, stopped by every lesson, against a seasoned one taught nothing.
      const seasoned = freshCoach();
      seasoned.skip(LANDED);
      for (const id of Object.keys(LESSONS)) seasoned.skip(id);
      const guided = fly(site, player, { viewH, skip: 0.3 });
      const plain = fly(site, player, { viewH, coach: seasoned });
      const where = `${expert ? "expert" : "normal"} view ${viewH}`;
      assert.ok(guided.cues.length > 0 && plain.cues.length === 0, where);
      assert.equal(guided.result?.kind, "land", `${where}: ${guided.result?.kind}`);
      assert.deepEqual(guided.result, plain.result, `${where}: the guided flight scored differently`);
      assert.deepEqual(guided.ship, plain.ship, `${where}: the guided flight ended differently`);
    }
  }
});

test("the camera keeps the cup on screen however short the view, with room for a line above it on a guided phone flight", () => {
  const site = makeSite(1, FIRST_SITE_SEED, "mare");
  for (const sc of [...SCREENS, { name: "tiny", w: 640, h: 230, top: 64, touch: true }, { name: "tall phone", w: 430, h: 932, top: 160, touch: true }]) {
    for (const guided of [true, false]) {
      const { viewH } = screenFor(newShip(site, 455), site, sc, guided);
      const ship = newShip(site, viewH);
      const g = screenFor(ship, site, sc, guided);
      const room = g.toY(ship.y + CUP.high) - sc.top;
      const want = headroomFor(sc.w, g.base, guided);
      assert.ok(room >= Math.min(want, 10) - 1e-6, `${sc.name}${guided ? " guided" : ""}: the cup's straw is ${room.toFixed(0)} px under the tickets`);
      // On a guided phone flight there's room for a two-line slip above the cup; elsewhere it sits beside.
      if (guided && sc.w < 500) assert.ok(room >= 8 + GUIDED_SLIP_H, `${sc.name}: only ${room.toFixed(0)} px above the cup`);
      if (sc.w >= 708) assert.equal(want, 10, `${sc.name}: kept room above a cup it could sit beside`);
    }
  }
});

test("guidance lasts until the device's first landing: Continue on the touchdown warning doesn't end it", () => {
  const site = makeSite(1, FIRST_SITE_SEED, "mare");
  const coach = freshCoach();
  const lessons = createFlightLessons(coach);
  const start = () => lessons.start({ flight: { ship: newShip(site, 455), site, time: 0 }, ceiling: 485 });
  start();
  assert.ok(lessons.guide);
  // The touchdown warning up and continued: it counts as known, but nothing has landed.
  coach.offer(LESSONS.touchdown);
  coach.done("touchdown");
  assert.ok(coach.learned("touchdown"));
  lessons.touchdown({ kind: "crash", reason: "fast" });
  start();
  assert.ok(lessons.guided && lessons.guide, "a crash after Continue ended the guidance");
  // The first landing ends it, for good.
  lessons.touchdown({ kind: "land", pad: site.pads[0], points: 100, feather: false });
  assert.ok(coach.learned(LANDED));
  start();
  assert.equal(lessons.guide, null);
  assert.equal(guidedDevice(coach), false);
  // An older save's touchdown flag might only mean the player pressed Continue.
  const old = freshCoach();
  old.skip("touchdown");
  assert.equal(guidedDevice(old), true);

  // In flight: a hot approach warned, Continue pressed, then the crash; the next lander is still guided.
  const flown = freshCoach();
  for (const id of ["burn", "coaster", "steer", "wind", "fuel", "landers"]) flown.skip(id);
  const flight = createFlightLessons(flown);
  let pilot = null;
  const hot = (ship, c, l, time) => {
    pilot ??= createPilot(site.pads[0], ship);
    const keys = pilotControls(pilot, ship, site, time);
    if (pilot.descending) keys.thrust = false;
    return keys;
  };
  const first = fly(site, hot, { coach: flown, lessons: flight, skip: 0.3 });
  assert.ok(first.cues.some((c) => c.cue.lesson.id === "touchdown"), "no warning came");
  assert.equal(first.result?.kind, "crash");
  assert.ok(flown.learned("touchdown"), "Continue didn't count the warning");
  pilot = null;
  const next = fly(site, () => IDLE, { coach: flown, lessons: flight, seconds: 1 });
  assert.ok(next.lessons.guide, "the next lander lost its guide");
});

test("a press while a lesson holds play stopped never carries into play, unless it makes the move", () => {
  const site = makeSite(1, FIRST_SITE_SEED, "mare");
  const keys = { " ": "thrust", ArrowLeft: "left", ArrowRight: "right" };
  const setup = (skips) => {
    const controls = createControls({ names: ["left", "right", "thrust"], keys, enabled: () => true });
    const coach = freshCoach();
    for (const id of skips) coach.skip(id);
    const lessons = createFlightLessons(coach);
    lessons.start({ flight: { ship: newShip(site, 455), site, time: 0 }, ceiling: 485 });
    /** One frame as the game runs it: the keys read (and a press dropped while play is held), then its steps' keys. */
    const frame = () => {
      if (lessons.input(controls.read())) controls.clearPresses();
      let acc = coach.step(FRAME);
      const seen = [];
      while (acc >= H) {
        acc -= H;
        seen.push({ ...controls.read() });
        controls.clearPresses();
      }
      return seen;
    };
    /** Continue, as the game does it. */
    const proceed = () => {
      if (coach.paused) controls.clearPresses();
      coach.done(coach.current.id);
    };
    const hold = (lesson) => {
      coach.offer(lesson);
      for (let t = 0; t < 1 && !coach.paused; t += FRAME) frame();
      assert.ok(coach.paused, `${lesson.id} didn't stop play`);
    };
    return { controls, coach, lessons, frame, proceed, hold };
  };
  const tap = (controls, key) => {
    controls.keyDown(key, true);
    controls.keyUp(key);
  };

  // A tap of burn while the coaster is explained, then Continue: play resumes without a burn.
  {
    const { controls, frame, proceed, hold } = setup(["burn"]);
    hold(LESSONS.coaster);
    tap(controls, " ");
    assert.equal(controls.read().thrust, true, "the tap wasn't latched to begin with");
    frame();
    proceed();
    const steps = [];
    for (let f = 0; f < 30; f++) steps.push(...frame());
    assert.ok(steps.length > 0, "play didn't come back");
    assert.ok(steps.every((k) => !k.thrust), "the tap made while play was stopped burned");
  }
  // The same tap and Continue before the game has drawn a frame between them.
  {
    const { controls, frame, proceed, hold } = setup(["burn"]);
    hold(LESSONS.coaster);
    tap(controls, " ");
    proceed();
    const steps = [];
    for (let f = 0; f < 30; f++) steps.push(...frame());
    assert.ok(steps.every((k) => !k.thrust), "the tap carried through Continue");
  }
  // Frozen for the burn: a tilt is dropped, the burn itself resumes play and burns at once.
  {
    const { controls, coach, frame, hold } = setup([]);
    hold(LESSONS.burn);
    tap(controls, "ArrowLeft");
    frame();
    assert.ok(coach.paused, "a tilt made the burn");
    tap(controls, " ");
    let steps = [];
    for (let f = 0; f < 30 && !steps.length; f++) steps = frame();
    assert.ok(coach.acting, "the burn didn't count as made");
    assert.equal(steps[0]?.thrust, true, "the burn's own press was lost");
    assert.equal(steps[0]?.left, false, "the tilt tapped while frozen carried into play");
  }
});
