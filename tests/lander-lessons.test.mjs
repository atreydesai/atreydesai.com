import assert from "node:assert/strict";
import test from "node:test";

import { createCoach } from "../src/lib/arcade/core/coach.ts";
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
  LESSONS,
  LESSON_START,
  MOVE_PATIENCE,
  MOVE_PROOF,
  STEER_PROOF,
  landsFromHere,
  createFlightLessons,
  lessonAhead,
  padBelow,
  planApproach,
  teaRows,
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

/**
 * One flight as the game runs it: frames of real time, the coach turning
 * them into game time (slow while a move is taught), fixed engine steps,
 * and the lessons told about each step and each frame. `player` picks the
 * keys for a step from what is on screen.
 */
function fly(site, player, { viewH = 455, coach = createCoach("lander", { persist: false }), lessons = createFlightLessons(coach), revived = false, seconds = 80 } = {}) {
  lessons.start({ revived });
  const ship = newShip(site, viewH);
  const ceiling = viewH + 30;
  const cues = [];
  let acc = 0;
  let time = 0;
  let real = 0;
  let result = null;
  // The longest stretch one lesson (or none) has held play slow.
  let slowSince = -1;
  let slowFor = undefined;
  let longestSlow = 0;
  while (real < seconds && !result) {
    real += FRAME;
    acc += coach.step(FRAME);
    const holding = coach.current?.id ?? null;
    if (coach.scale < 0.99) {
      if (slowSince < 0 || holding !== slowFor) {
        slowSince = real;
        slowFor = holding;
      }
      longestSlow = Math.max(longestSlow, real - slowSince);
    } else slowSince = -1;
    while (acc >= H && !result) {
      acc -= H;
      const keys = player(ship, coach, lessons, time) ?? IDLE;
      result = stepShip(ship, keys, site, time, H, ceiling);
      if (!result) lessons.step(keys, ship, site, H);
      time += H;
      if (result) lessons.touchdown(result);
    }
    if (result) break;
    lessons.check({ ship, site, time }, viewAround(ship, site, viewH), ceiling);
    const cue = lessons.cue;
    if (cue && cues[cues.length - 1]?.cue !== cue) {
      cues.push({ cue, time, real, altitude: altitudeOf(ship, site), ship: { ...ship } });
    }
  }
  return { result, cues, ship, coach, lessons, real, time, longestSlow };
}

/**
 * A newcomer: does nothing until a lesson says what to do, a beat after it
 * appears. Burn: holds it until the fall slows, then keeps falling slowly.
 * Tilt: flies the ghost's path (the autopilot's) from there on.
 */
function newcomer(site, react = 0.4) {
  let mode = "idle";
  let burned = 0;
  let pilot = null;
  return (ship, coach, lessons, time) => {
    const id = coach.current && !coach.leaving ? coach.current.id : null;
    if (id === "burn" && coach.age >= react && mode === "idle") mode = "burn";
    if (id === "steer" && coach.age >= react && mode !== "pilot") {
      mode = "pilot";
      pilot = createPilot(lessons.cue.path.pad, ship);
    }
    if (mode === "burn") {
      burned += H;
      if (burned >= BURN_LEARNED) mode = "slow";
      return { ...IDLE, thrust: true };
    }
    if (mode === "slow") return { ...IDLE, thrust: ship.vy < -9 };
    if (mode === "pilot") return pilotControls(pilot, ship, site, time);
    return IDLE;
  };
}

test("every lesson fits the arcade's one-line voice", () => {
  for (const lesson of Object.values(LESSONS)) {
    const words = lesson.text.trim().split(/\s+/);
    assert.ok(words.length <= 8, `${lesson.id} runs to ${words.length} words`);
    assert.ok(!/[!·]/.test(lesson.text), `${lesson.id} uses a mark the voice avoids`);
    assert.match(lesson.text, /^[A-Z][^.]*[^.\s]\.$/, `${lesson.id} isn't one full sentence`);
    // Every lesson explains in slow motion, but a flight is steered continuously: not too slow.
    assert.ok(lesson.slow >= 0.25 && lesson.slow <= 0.4, `${lesson.id} slows play to ${lesson.slow}`);
    assert.ok(lesson.move ? lesson.life === Infinity : lesson.life <= 7.5, `${lesson.id} holds for ${lesson.life} s`);
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

test("a move nobody makes never keeps play slow, and is taught again next time", () => {
  const site = makeSite(1, SEEDS[1]);
  // Never presses anything: the burn waits a few seconds, then play is back to speed.
  const idle = fly(site, () => IDLE, { seconds: 60 });
  assert.equal(idle.result?.kind, "crash");
  assert.equal(idle.cues[0]?.cue.lesson.id, "burn");
  // No lesson holds play slow past its time-out (then the coach eases back to speed).
  assert.ok(idle.longestSlow <= MOVE_PATIENCE + 0.2, `play stayed slow for ${idle.longestSlow.toFixed(1)} s`);
  assert.equal(idle.coach.learned("burn"), false, "a burn never made was counted as learned");
  assert.equal(idle.coach.current, null, "the lesson outlived the flight");
  // Timed out, it isn't slowed for again on this run's next lander, only on a later run.
  const next = fly(site, () => IDLE, { coach: idle.coach, lessons: idle.lessons, seconds: 3 });
  assert.equal(next.cues.length, 0, "the timed-out burn came back in the same run");
  idle.lessons.newRun();
  const later = fly(site, () => IDLE, { coach: idle.coach, lessons: idle.lessons, seconds: 2 });
  assert.equal(later.cues[0]?.cue.lesson.id, "burn", "a later run wasn't taught the burn");

  // Burns but never tilts: the tilt lesson lets play go back to speed too.
  const burner = fly(site, (ship) => ({ ...IDLE, thrust: ship.vy < -6 }), { seconds: 40 });
  assert.ok(burner.cues.some((c) => c.cue.lesson.id === "steer"), "the tilt was never taught");
  assert.ok(burner.longestSlow <= MOVE_PATIENCE + 0.2, `play stayed slow for ${burner.longestSlow.toFixed(1)} s`);
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
        assert.deepEqual(path.points[0], { x: ship.x, y: ship.y, a: ship.angle }, `${where}: the path doesn't start at the cup`);
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

  // A warning shown in time, then nothing done: it is withdrawn before the crash, uncounted.
  const coach = createCoach("lander", { persist: false });
  for (const id of ["burn", "coaster", "steer", "wind", "fuel"]) coach.skip(id);
  const lessons = createFlightLessons(coach);
  const site3 = makeSite(3, SEEDS[2]);
  const target = site3.pads[2];
  let pilot = null;
  let warnedOnce = false;
  const flight = fly(site3, (ship, c, l, time) => {
    pilot ??= createPilot(target, ship);
    // Hot: the autopilot holding off its burn on the way down, until warned; then hands off.
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
      keys.right = ship.angle < 0.35;
      keys.left = ship.angle > 0.45;
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
