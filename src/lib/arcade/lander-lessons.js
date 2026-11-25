// Tea minus's lessons: what a flight teaches, and when. Each is taught the
// first time it matters on this device, beside the cup or the thing it is
// about, never up in the tickets, because the eye is on the cup. Every
// lesson eases play into slow motion while it explains, and Continue (Enter,
// or the slip's button) ends it. A move (burn, tilt, a touchdown gone wrong)
// comes a moment before it is needed, with a ghost of the cup flying it, and
// play comes back to speed the moment the player makes it; a move made
// before it is taught is never taught. A thing (a coaster, a pennant, the tea
// draining) gets one line saying what it is for as it comes into view, and
// ends by itself once it has gone from view.
//
// DOM-free: the component hands the shared coach (core/coach.ts) to
// `createFlightLessons`, reports each engine step and each frame, and reads
// `cue` to place the callout and draw the ghost. Every rule the flight
// teaches is the engine's own; nothing here changes how the cup flies.

import {
  BURN,
  FOOT_DROP,
  FOOT_SPAN,
  GRAVITY,
  MAX_FUEL,
  PERIOD,
  THRUST,
  TURN_RATE,
  altitudeOf,
  createPilot,
  pilotControls,
  stepShip,
} from "./lander-engine.js";

/** @typedef {import("./lander-engine.js").Ship} Ship */
/** @typedef {import("./lander-engine.js").Site} Site */
/** @typedef {import("./lander-engine.js").Pad} Pad */
/** @typedef {import("./lander-engine.js").Controls} Controls */
/** @typedef {import("./lander-engine.js").Touchdown} Touchdown */
/** @typedef {import("./core/coach.ts").Coach} Coach */
/**
 * @typedef {{
 *   id: string, text: string, name?: string, keys?: string[], touch?: string,
 *   slow?: number, life?: number, minLife?: number, move?: boolean, priority?: number
 * }} Lesson
 */
/** @typedef {{ left: number, right: number, bottom: number, top: number }} View The world on screen, in world units. */
/** @typedef {"fast" | "tilt" | "drift"} Fault What is wrong with a touchdown about to happen. */
/** @typedef {{ x: number, y: number, a: number }} PathPoint A point of a ghost's flight: where, and its tilt. */
/**
 * @typedef {{ points: PathPoint[], pad: Pad | null, land: { x: number, y: number } | null, relative: boolean }} GhostPath
 * A ghost's flight in world units, sampled every so often. A relative path
 * is measured from the cup and rides along with it; `land` is where the
 * ghost touches down, if it does.
 */
/**
 * @typedef {{
 *   lesson: Lesson, x: number, y: number, size: number, ship: boolean,
 *   pad: Pad | null, fault: Fault | null, path: GhostPath | null
 * }} LessonCue
 * Where the lesson points: a world point (an offset from the cup when `ship`
 * is set) and a radius, in world units, for the pen loop around it (0 for
 * none). A move carries the ghost it flies.
 */

/** Flight seconds before any lesson, while "go" is still on screen. */
export const LESSON_START = 0.62;
/** Flight seconds of burn that have clearly slowed a fall: burning is known. */
export const BURN_LEARNED = 0.5;
/**
 * Drift (units a second) tilted burns have taken off, ending lined up over
 * a coaster: tilting is known. Burning the drift up the wrong way doesn't count.
 */
export const STEER_LEARNED = 6;
/** Flight seconds a touchdown has stayed inside the limits before its lesson is done. */
export const SAFE_LEARNED = 0.6;
/** A lesson about a fall is no use below this height: nothing can stop it now. */
const TOO_LOW = 22;
/** The touchdown lesson comes down if the cup climbs back above this. */
const CLIMBED_AWAY = 160;
/**
 * Real seconds a move lesson waits, slow, for its move; and once the move is
 * made, how long it has to show it worked. Past either, the lesson comes
 * down uncounted and the next lander teaches it, so play is never held slow.
 */
export const MOVE_PATIENCE = 7;
export const MOVE_PROOF = 4;
/** Stopping a drift and lining up over a coaster takes longer than a burn. */
export const STEER_PROOF = 8;
/** Share of the cup gone before the tea's lesson, if no row has emptied yet. */
const FUEL_DRUNK = 0.2;
/** Seconds the throttle takes to answer, roughly, as the engine eases it. */
const THROTTLE_LAG = 0.2;
/** How a ghost's flight is planned: the longest it may run, and how often it is sampled. */
const PLAN_SECONDS = 24;
const PLAN_SAMPLE = 0.1;
const PLAN_TRIES = 3;
/** Engine step for planning: the game's own. */
const H = 1 / 120;
/** The longest a touchdown's recovery is flown out, in flight seconds. */
const RECOVERY_SECONDS = 10;

/** Moves ease into slow motion; a flight is steered continuously, so not too slow. */
const move = { slow: 0.35, life: Infinity, minLife: 0.6, move: true };
/** A thing is explained in slow motion too, for up to seven seconds, or until Continue. */
const thing = { slow: 0.3, life: 7, minLife: 1.2 };

/** Every lesson: one short full sentence, eight words or fewer. @type {Readonly<Record<string, Lesson>>} */
export const LESSONS = Object.freeze({
  burn: { id: "burn", text: "Hold burn to slow your fall.", keys: ["Space"], touch: "hold burn", ...move },
  coaster: { id: "coaster", text: "Land on a coaster; ×5 pays the most.", ...thing },
  steer: { id: "steer", text: "Tilt and burn to stop over a coaster.", keys: ["←", "→"], touch: "tilt", ...move },
  // A touchdown about to go wrong outranks any other move: it is needed first.
  touchdown: { id: "touchdown", text: "Come down slow, level and still.", keys: ["Space"], touch: "hold burn", ...move, priority: 3 },
  fuel: { id: "fuel", text: "Burn in bursts: leftover tea is your score.", ...thing },
  wind: { id: "wind", text: "Pennants show the wind; tilt against it.", ...thing },
  landers: { id: "landers", text: "Each crash costs one lander.", ...thing },
  feather: { id: "feather", name: "feather", text: "A landing this soft pays a bonus.", ...thing },
});

/**
 * The touchdown lesson with the keys that fix what is wrong: burn for a
 * fall too fast, tilt for a lean or a drift.
 * @type {Readonly<Record<Fault, Lesson>>}
 */
const TOUCHDOWN = Object.freeze({
  fast: LESSONS.touchdown,
  tilt: Object.freeze({ ...LESSONS.touchdown, keys: ["←", "→"], touch: "tilt" }),
  drift: Object.freeze({ ...LESSONS.touchdown, keys: ["←", "→"], touch: "tilt" }),
});

/**
 * Rows of tea the cup on the lander shows, 0 to 4; it drains from the top.
 * @param {number} fuel
 */
export function teaRows(fuel) {
  return Math.max(0, Math.min(4, Math.ceil((fuel / MAX_FUEL) * 4)));
}

/**
 * The copy of a coaster nearest world x, on the wrapped moon.
 * @param {number} cx
 * @param {number} x
 */
const nearestCopy = (cx, x) => cx + Math.round((x - cx) / PERIOD) * PERIOD;

/**
 * Whether a world point is on screen with `margin` units to spare.
 * @param {number} x @param {number} y @param {View} view @param {number} margin
 */
const inView = (x, y, view, margin) =>
  x >= view.left + margin && x <= view.right - margin && y >= view.bottom + margin && y <= view.top - margin;

/**
 * The coaster under the cup (its feet within reach of it), as the copy
 * nearest the cup, or null.
 * @param {Pick<Ship, "x">} ship
 * @param {Site} site
 */
export function padBelow(ship, site) {
  for (const pad of site.pads) {
    const cx = nearestCopy(pad.cx, ship.x);
    if (Math.abs(ship.x - cx) <= pad.width / 2 + FOOT_SPAN) return { pad, cx };
  }
  return null;
}

/**
 * What would go wrong if the cup touched down as it is, most urgent first,
 * with how many seconds are left before the player must act on it; null
 * when it would land safely.
 * @param {Ship} ship
 * @param {Site} site
 * @param {number} height feet above the coaster
 * @returns {{ fault: Fault, lead: number } | null}
 */
export function touchdownFault(ship, site, height) {
  const safe = site.safe;
  const fall = -ship.vy;
  if (fall <= 0) return null;
  const contact = height / fall;
  /** @type {{ fault: Fault, lead: number } | null} */
  let worst = null;
  /** @param {Fault} fault @param {number} lead */
  const consider = (fault, lead) => {
    if (!worst || lead < worst.lead) worst = { fault, lead };
  };
  if (fall > safe.vy) {
    // Braking to a safe fall at full burn, standing up first, takes this
    // much height, and this much tea; with less in the cup it can't be saved.
    const stand = Math.abs(ship.angle) / TURN_RATE;
    const seconds = (fall - safe.vy) / (THRUST - GRAVITY) + THROTTLE_LAG + stand;
    if (ship.fuel < BURN * seconds) return null;
    const brake = (fall * fall - safe.vy * safe.vy) / (2 * (THRUST - GRAVITY)) + fall * (THROTTLE_LAG + stand);
    consider("fast", (height - brake) / fall);
  }
  if (Math.abs(ship.angle) > safe.tilt) consider("tilt", contact - Math.abs(ship.angle) / TURN_RATE - 0.15);
  if (Math.abs(ship.vx) > safe.vx) {
    // Leaning against a drift and burning takes about this long.
    const seconds = (Math.abs(ship.vx) - safe.vx) / (THRUST * 0.4) + 0.3;
    if (ship.fuel < BURN * seconds) return null;
    consider("drift", contact - seconds);
  }
  return worst;
}

/**
 * Whether doing what the touchdown lesson says, from here, still lands: the
 * cup flown by the engine's own autopilot in its final descent over the
 * coaster below (slow, level, and still over it), judged by the engine's
 * real touchdown rules. A warning is shown only while this holds.
 * @param {Ship} ship
 * @param {Site} site
 * @param {number} time flight seconds now, for the wind
 */
export function landsFromHere(ship, site, time) {
  const below = padBelow(ship, site);
  if (!below) return false;
  const copy = { ...ship };
  const pilot = createPilot(below.pad, copy);
  pilot.descending = true;
  for (let k = 0; k < Math.round(RECOVERY_SECONDS / H); k++) {
    const t = time + k * H;
    const result = stepShip(copy, pilotControls(pilot, copy, site, t), site, t, H);
    if (result) return result.kind === "land";
  }
  return false;
}

/** Which lesson gives way to which, as the coach ranks them: a thing 1, a move 2. @param {Lesson} lesson */
const priorityOf = (lesson) => lesson.priority ?? (lesson.move ? 2 : 1);

/** Whether a touchdown now would be inside the site's limits. @param {Ship} ship @param {Site} site */
const withinLimits = (ship, site) =>
  -ship.vy <= site.safe.vy && Math.abs(ship.angle) <= site.safe.tilt && Math.abs(ship.vx) <= site.safe.vx;

/**
 * The lesson this moment of the flight needs, if the device still needs
 * one: a move about to be needed, else a thing in view. `learned` says what
 * the device already knows; `revived` is a lander sent after a crash.
 * @param {{ ship: Ship, site: Site, time: number, revived?: boolean }} flight
 * @param {(id: string) => boolean} learned
 * @param {View} view
 * @returns {LessonCue | null}
 */
export function lessonAhead({ ship, site, time, revived = false }, learned, view) {
  if (ship.state !== "flying" || time < LESSON_START) return null;
  const altitude = altitudeOf(ship, site);
  /**
   * @param {Lesson} lesson @param {number} x @param {number} y @param {number} size @param {boolean} onShip
   * @returns {LessonCue}
   */
  const cue = (lesson, x, y, size, onShip) => ({ lesson, x, y, size, ship: onShip, pad: null, fault: null, path: null });

  // First things first: until the burn is known, it is the only lesson.
  if (!learned("burn")) {
    return ship.vy < -3 && altitude > TOO_LOW * 2 ? cue(LESSONS.burn, 0, 5, 0, true) : null;
  }

  // A touchdown on a coaster about to go wrong, a second before the fix is
  // needed: only when the cup is coming down on it, not passing over.
  if (!learned("touchdown") && ship.vy < 0) {
    const below = padBelow(ship, site);
    const height = below ? ship.y - FOOT_DROP - below.pad.y : 0;
    const lands = below && Math.abs(ship.x + (ship.vx * height) / -ship.vy - below.cx) <= below.pad.width / 2;
    if (below && lands && altitude < CLIMBED_AWAY) {
      const fault = touchdownFault(ship, site, height);
      if (fault && fault.lead >= 0.3 && fault.lead <= 1.3 && landsFromHere(ship, site, time)) {
        return { ...cue(TOUCHDOWN[fault.fault], 0, 5, 0, true), pad: below.pad, fault: fault.fault };
      }
    }
  }

  // A thing is named only in a calm moment: high enough, and not falling
  // faster than a touchdown allows, so it never talks over a fall that needs
  // the player now.
  const calm = altitude > 60 && ship.vy > -site.safe.vy;

  // A fresh lander after a crash: what the crash cost.
  if (calm && revived && !learned("landers") && time < 8) return cue(LESSONS.landers, 0, 5, 15, true);

  // Where to land: the richest coaster on screen, the first time one is.
  if (calm && !learned("coaster")) {
    let best = null;
    let bestCx = 0;
    for (const pad of site.pads) {
      const cx = nearestCopy(pad.cx, ship.x);
      if (!inView(cx, pad.y, view, 24)) continue;
      if (!best || pad.multiplier > best.multiplier || (pad.multiplier === best.multiplier && Math.abs(cx - ship.x) < Math.abs(bestCx - ship.x))) {
        best = pad;
        bestCx = cx;
      }
    }
    if (best) return { ...cue(LESSONS.coaster, bestCx, best.y, best.width / 2 + 4, false), pad: best };
  }

  // How to get there: every flight starts drifting, so tilting comes early.
  if (!learned("steer") && altitude > 45) {
    const below = padBelow(ship, site);
    const settled = below && Math.abs(ship.vx) <= site.safe.vx;
    if (!settled) return cue(LESSONS.steer, 0, 5, 0, true);
  }

  // The first windy site: a pennant in view says which way it blows.
  if (calm && site.wind && !learned("wind")) {
    let best = null;
    for (const pad of site.pads) {
      const cx = nearestCopy(pad.cx, ship.x);
      const post = cx - pad.width / 2 - 2.5;
      if (!inView(post, pad.y + 10, view, 24)) continue;
      if (!best || Math.abs(post - ship.x) < Math.abs(best.x - ship.x)) best = { x: post, y: pad.y + 12 };
    }
    if (best) return cue(LESSONS.wind, best.x + Math.sign(site.wind) * 4, best.y, 9, false);
  }

  // The tea is the fuel: once it has visibly gone (a row off the cup on the
  // lander, or a fifth of it), at the first calm moment.
  const drunk = teaRows(ship.fuel) < teaRows(site.fuel) || ship.fuel <= site.fuel * (1 - FUEL_DRUNK);
  if (calm && !learned("fuel") && drunk) return cue(LESSONS.fuel, 0, 4, 9, true);

  return null;
}

/**
 * Samples a flight on a copy of the cup, stepping the engine's own rules
 * with `keys` until it touches down or `until` says to stop.
 * @param {Ship} ship
 * @param {Site} site
 * @param {number} time flight seconds now, for the wind
 * @param {number} ceiling the view's ceiling, as the game steps it
 * @param {(copy: Ship, t: number) => Controls} keys
 * @param {(copy: Ship, t: number) => boolean} until
 * @param {number} seconds
 * @param {number} sample seconds between points
 */
function flyCopy(ship, site, time, ceiling, keys, until, seconds, sample) {
  const copy = { ...ship };
  /** @type {PathPoint[]} */
  const points = [{ x: copy.x, y: copy.y, a: copy.angle }];
  /** @type {Touchdown | null} */
  let result = null;
  const every = Math.max(1, Math.round(sample / H));
  for (let k = 1; k <= Math.round(seconds / H) && !result; k++) {
    const t = time + (k - 1) * H;
    result = stepShip(copy, keys(copy, t), site, t, H, ceiling);
    if (result || k % every === 0) points.push({ x: copy.x, y: copy.y, a: copy.angle });
    if (!result && until(copy, t + H)) break;
  }
  return { copy, points, result };
}

/**
 * The tilt lesson's ghost: the path the engine's autopilot would fly from
 * here to the best coaster, the richest on screen first, then the nearest.
 * Only a flight that lands is kept; null if none of the first few does.
 * Run once, when the lesson starts, never per frame.
 * @param {Ship} ship
 * @param {Site} site
 * @param {number} time
 * @param {{ ceiling: number, view: View }} options
 * @returns {GhostPath | null}
 */
export function planApproach(ship, site, time, { ceiling, view }) {
  const options = site.pads.map((pad) => {
    const cx = nearestCopy(pad.cx, ship.x);
    return { pad, seen: inView(cx, pad.y, view, 20), distance: Math.abs(cx - ship.x) };
  });
  options.sort((a, b) =>
    a.seen !== b.seen ? (a.seen ? -1 : 1) : a.seen && a.pad.multiplier !== b.pad.multiplier ? b.pad.multiplier - a.pad.multiplier : a.distance - b.distance,
  );
  for (const { pad } of options.slice(0, PLAN_TRIES)) {
    const pilot = createPilot(pad, ship);
    const flight = flyCopy(ship, site, time, ceiling, (copy, t) => pilotControls(pilot, copy, site, t), () => false, PLAN_SECONDS, PLAN_SAMPLE);
    if (flight.result?.kind === "land") {
      return { points: flight.points, pad, land: { x: flight.copy.x, y: flight.copy.y }, relative: false };
    }
  }
  return null;
}

const BURN_KEYS = Object.freeze({ left: false, right: false, thrust: true });

/**
 * The burn lesson's ghost: the cup holding burn from here until its fall
 * has stopped, as offsets from the cup, so it rides along with it.
 * @param {Ship} ship
 * @param {Site} site
 * @param {number} time
 * @param {number} ceiling
 * @returns {GhostPath}
 */
export function planBurn(ship, site, time, ceiling) {
  const start = time;
  const flight = flyCopy(ship, site, time, ceiling, () => BURN_KEYS, (copy, t) => copy.vy >= 0 && t - start > 0.3, 1.8, 0.05);
  const points = flight.points.map((p) => ({ x: p.x - ship.x, y: p.y - ship.y, a: p.a }));
  return { points, pad: null, land: null, relative: true };
}

/**
 * One game's lesson keeping for a flight: what the player has shown this
 * flight (a burn held, a tilted burn), which lesson is on screen, and when a
 * move has worked, been missed, or its moment has passed.
 * @param {Coach} coach
 */
export function createFlightLessons(coach) {
  /** @type {LessonCue | null} */
  let cue = null;
  let burnHeld = 0;
  /** Drift taken off by tilted burns this flight. */
  let braked = 0;
  let safeFor = 0;
  let revived = false;
  let now = 0;
  /** The lesson's age when its move was made. */
  let actedAt = 0;
  /** A move was missed on this lander: it teaches nothing more. */
  let stalled = false;
  /** Moves that timed out this run: not slowed for again until a later run. */
  const timedOut = new Set();
  /** Lessons held back until a flight second: a tilt with no landing in reach yet. */
  /** @type {Map<string, number>} */
  const held = new Map();
  /** @param {string} id */
  const known = (id) => coach.learned(id) || timedOut.has(id) || (held.get(id) ?? -Infinity) > now;

  /** A thing up long enough to read counts as seen; anything else comes down uncounted. */
  function settle() {
    const current = coach.current;
    if (!current || coach.leaving) return;
    if (!current.move && coach.age >= (current.minLife ?? 0.9)) coach.done(current.id);
    else coach.dismiss();
  }

  /** @param {LessonCue} next */
  function show(next) {
    if (coach.offer(next.lesson)) cue = next;
  }

  /** The move the lesson on screen asks for was made: play comes back to speed while it shows whether it worked. @param {string} id */
  function act(id) {
    if (coach.acting || coach.current?.id !== id) return;
    coach.acted(id);
    actedAt = coach.age;
  }

  return {
    /** The lesson on screen and where it points, if any. */
    get cue() {
      const current = coach.current;
      return current && cue && cue.lesson.id === current.id ? cue : null;
    },

    /** A fresh flight; `revived` is a lander sent after a crash. */
    start({ revived: again = false } = {}) {
      settle();
      coach.reset();
      cue = null;
      burnHeld = braked = safeFor = now = actedAt = 0;
      stalled = false;
      revived = again;
      held.clear();
    },

    /**
     * After every engine step, with the keys that step flew and the cup as
     * it now is. Moves are noticed here, made or not, taught or not.
     * @param {Controls} keys @param {Ship} ship @param {Site} site @param {number} h
     */
    step(keys, ship, site, h) {
      const id = coach.current && !coach.leaving ? coach.current.id : null;
      if (keys.thrust && ship.fuel > 0) {
        if (id === "burn") act("burn");
        if (burnHeld < BURN_LEARNED && burnHeld + h >= BURN_LEARNED) coach.done("burn");
        burnHeld += h;
      }
      if ((keys.left || keys.right) && id === "steer") act("steer");
      // A tilted burn against the drift brakes it. Steering is known, taught
      // or not, once enough drift has been braked away and the cup is lined
      // up over a coaster, slow enough sideways to land.
      const push = Math.sin(ship.angle) * THRUST * ship.throttle * h;
      if (Math.abs(ship.angle) > 0.05 && push * ship.vx < 0) braked += Math.abs(push);
      if (braked >= STEER_LEARNED && !coach.learned("steer") && Math.abs(ship.vx) <= site.safe.vx && padBelow(ship, site)) {
        coach.done("steer");
      }
      if (id === "touchdown" && cue?.fault) {
        if (cue.fault === "fast" ? keys.thrust : keys.left || keys.right) act("touchdown");
        safeFor = withinLimits(ship, site) ? safeFor + h : 0;
        if (safeFor >= SAFE_LEARNED) coach.done("touchdown");
      }
    },

    /**
     * Once a frame while flying: takes down a move whose moment has passed,
     * and offers what is due. `ceiling` is the view's, as the game steps it;
     * `reading` says a line of the game's own is still being read, so only a
     * move may come in over it.
     * @param {{ ship: Ship, site: Site, time: number }} flight
     * @param {View} view
     * @param {number} ceiling
     * @param {boolean} [reading]
     */
    check({ ship, site, time }, view, ceiling, reading = false) {
      now = time;
      const current = coach.current;
      const altitude = altitudeOf(ship, site);
      if (current?.move && !coach.leaving && cue?.lesson.id === current.id) {
        // Too low for a burn or a tilt to help, or climbed away from the touchdown.
        const passed = current.id === "touchdown" ? altitude > CLIMBED_AWAY : altitude < TOO_LOW;
        // Not made in time, or made without working: play never waits on it for ever.
        const proof = current.id === "steer" ? STEER_PROOF : MOVE_PROOF;
        const missed = coach.acting ? coach.age - actedAt >= proof : coach.age >= MOVE_PATIENCE;
        // A touchdown warning stays only while doing what it says still lands.
        const lost = current.id === "touchdown" && !landsFromHere(ship, site, time);
        if (passed || missed || lost) {
          coach.dismiss();
          cue = null;
          // Missed, it isn't slowed for again this run, and nothing after it
          // is taught on this lander: never what comes later while it still matters.
          if (missed) {
            stalled = true;
            timedOut.add(current.id);
          }
        }
      }
      // Until the burn is known, nothing else is taught; timed out, it waits for a later run.
      if (stalled || (timedOut.has("burn") && !coach.learned("burn"))) return;
      // A coaster or pennant gone from view has been seen: its explanation ends.
      if (current && !current.move && !coach.leaving && cue && !cue.ship && cue.lesson.id === current.id && !inView(cue.x, cue.y, view, 0)) {
        coach.done(current.id);
      }
      // A move being taught holds the stage, unless what is due outranks it
      // (a touchdown about to go wrong) or it has been made and another move
      // is needed now. It gives way uncounted: a move counts only once it works.
      const teaching = coach.current?.move && !coach.leaving ? coach.current : null;
      const next = lessonAhead({ ship, site, time, revived }, known, view);
      if (!next || coach.current?.id === next.lesson.id) return;
      if (teaching) {
        const rank = priorityOf(next.lesson);
        const outranks = rank > priorityOf(teaching);
        // Made and still playing out, it gives way only to a move as needed as it is.
        const after = coach.acting && next.lesson.move && rank >= priorityOf(teaching);
        if (!outranks && !after) return;
        coach.dismiss();
      }
      // The tilt is held back for want of a landing in reach: nothing that
      // comes after it is named meanwhile.
      if (!next.lesson.move && !coach.learned("steer") && (held.get("steer") ?? -Infinity) > now) return;
      // Only a move may take over from a thing on screen, or from a line
      // being read; and only a fall about to go wrong (a burn, a touchdown)
      // cuts a thing short before it has been read.
      const showing = coach.current && !coach.leaving ? coach.current : null;
      if ((reading || showing) && !next.lesson.move) return;
      const urgent = next.lesson.id === "burn" || next.lesson.id === "touchdown";
      if (showing && !urgent && coach.age < (showing.minLife ?? 0.9)) return;
      if (next.lesson.id === "steer") {
        next.path = planApproach(ship, site, time, { ceiling, view });
        if (!next.path) {
          // Nowhere to land from here yet: look again in a moment.
          held.set("steer", time + 1.5);
          return;
        }
        next.pad = next.path.pad;
      } else if (next.lesson.id === "burn") {
        next.path = planBurn(ship, site, time, ceiling);
      }
      show(next);
    },

    /**
     * The flight touched down. A safe landing shows the coaster and the
     * touchdown are known; a move still waiting comes down uncounted, so the
     * next flight teaches it again; a first feather landing is named.
     * @param {Touchdown} result
     */
    touchdown(result) {
      if (result.kind === "land") {
        coach.done("touchdown");
        coach.done("coaster");
      }
      settle();
      if (result.kind === "land" && result.feather && !coach.learned("feather")) {
        // A warning still fading gives way, so the feather is named now.
        if (coach.leaving) coach.dismiss();
        show({ lesson: LESSONS.feather, x: 0, y: 5, size: 0, ship: true, pad: result.pad, fault: null, path: null });
      }
    },

    /**
     * The view changed size: a move's ghost was planned for the old one (its
     * ceiling, what was on screen), so it comes down and is planned afresh
     * on the next check.
     */
    replan() {
      if (coach.current?.move && !coach.leaving && !coach.acting && cue?.path) {
        coach.dismiss();
        cue = null;
      }
    },

    /** The run is over: nothing stays on screen. */
    end() {
      coach.dismiss();
      cue = null;
    },

    /** A new run: a move that timed out in the last one may be taught again. */
    newRun() {
      timedOut.clear();
    },
  };
}
