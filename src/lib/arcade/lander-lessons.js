// Tea minus's lessons: what a flight teaches, and when. Each is taught the
// first time it matters on this device, beside the cup or the thing it is
// about, never up in the tickets, because the eye is on the cup. Every
// lesson pauses play while it is up. A move (burn, tilt, a touchdown gone
// wrong) freezes play at the moment to make it, with a ghost of the cup
// flying it in real time, and the move itself (or Continue) brings play
// back; a move made before it is taught is never taught. A thing (a
// coaster, a pennant, the tea draining) gets one line saying what it is
// for as it comes into view, and Continue (Enter, or the slip's button)
// brings play back.
//
// On a device that has never landed, the whole flight is guided: the path
// the engine's own autopilot would fly from the start to the coaster
// nearest straight below it is drawn the entire way down, and the lessons
// aim at that coaster. Such a device's first site is always the same one
// (FIRST_SITE_SEED), picked for a flat plateau with a wide coaster just
// ahead of the start.
//
// DOM-free: the component hands the shared coach (core/coach.ts) to
// `createFlightLessons`, reports each engine step and each frame, and reads
// `cue` to place the callout and draw the ghost, and `guide` to draw the
// path. Every rule the flight teaches is the engine's own; nothing here
// changes how the cup flies.

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
/** @typedef {{ x: number, y: number, a: number, b?: boolean }} PathPoint A point of a ghost's flight: where, its tilt, and whether it is burning. */
/**
 * @typedef {{
 *   points: PathPoint[], pad: Pad | null, land: { x: number, y: number } | null,
 *   relative: boolean, sample: number
 * }} GhostPath
 * A ghost's flight in world units, a point every `sample` flight seconds. A
 * relative path is measured from the cup and rides along with it; `land` is
 * where the ghost touches down, if it does.
 */
/** @typedef {"above" | "below" | "left" | "right"} Side Where a callout sits beside its thing. */
/** @typedef {{ x: number, y: number, w: number, h: number }} Box A box on screen, in px. */
/**
 * @typedef {{
 *   lesson: Lesson, x: number, y: number, size: number, ship: boolean,
 *   pad: Pad | null, fault: Fault | null, path: GhostPath | null
 * }} LessonCue
 * Where the lesson points: a world point (an offset from the cup when `ship`
 * is set) and a radius, in world units, for the pen loop around it (0 for
 * none). A move carries the ghost it flies.
 */

/**
 * The first site of a device that has never landed: a fixed layout, so the
 * guided first flight is the same for everyone. Built by the engine like any
 * other site (`makeSite(1, FIRST_SITE_SEED, "mare")`), it was picked for a
 * flat plateau under the start with a wide ×2 coaster just ahead of the cup,
 * which the drift carries it over, and the ×5 in view behind the start.
 */
export const FIRST_SITE_SEED = 21320;
/**
 * What the coach also remembers per device, beside its lessons: a landing.
 */
export const LANDED = "landed";
/**
 * The old touchdown lesson could be marked read with Continue. Only a
 * recorded landing ends guidance, including for devices with that flag.
 * @param {Pick<Coach, "learned">} coach
 */
export const guidedDevice = (coach) => !coach.learned(LANDED);
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
 * Real seconds a move has, once made, to show it worked. Past it, the lesson
 * comes down uncounted and a later run teaches it. (Before the move is made
 * play is frozen, so there is no time to run out.)
 */
export const MOVE_PROOF = 4;
/** Stopping a drift and lining up over a coaster takes longer than a burn. */
export const STEER_PROOF = 8;
/** Share of the cup gone before the tea's lesson, if no row has emptied yet. */
const FUEL_DRUNK = 0.2;
/** Seconds the throttle takes to answer, roughly, as the engine eases it. */
const THROTTLE_LAG = 0.2;
/**
 * A touchdown about to go wrong freezes play when this many seconds are left
 * to fix it: the moment to act, with room for the throttle to answer (the
 * fix is made at the instant play froze, however long the player takes).
 */
export const TOUCHDOWN_LEAD = Object.freeze([0.2, 0.5]);
/** Coasters this close to the same distance from the cup count as a tie, which the lower one wins. */
export const TIE = 20;
/** The guide is planned again from the cup once it is this far off it (world units)... */
const STRAY = 40;
/** ...but not more often than this (flight seconds). */
const REPLAN_EVERY = 1.5;
/** How a ghost's flight is planned: the longest it may run, and how often it is sampled. */
const PLAN_SECONDS = 24;
const PLAN_SAMPLE = 0.1;
const PLAN_TRIES = 3;
/** Engine step for planning: the game's own. */
const H = 1 / 120;
/** The longest a touchdown's recovery is flown out, in flight seconds. */
const RECOVERY_SECONDS = 10;

/** A move freezes play until it is made (or Continue), however long that takes. */
const move = { slow: 0, life: Infinity, minLife: 0.6, move: true };
/** A thing pauses play until Continue. */
const thing = { slow: 0, life: Infinity, minLife: 1.2 };

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
 * The coaster nearest straight below world x, as its copy nearest x: the
 * easiest to reach from there. Coasters within TIE of the same distance
 * count as a tie, and the lowest-lying of them wins. Null for no coasters.
 * @param {number} x
 * @param {ReadonlyArray<Pad>} pads
 * @returns {{ pad: Pad, cx: number } | null}
 */
export function nearestBelow(x, pads) {
  let nearest = Infinity;
  for (const pad of pads) nearest = Math.min(nearest, Math.abs(nearestCopy(pad.cx, x) - x));
  /** @type {{ pad: Pad, cx: number } | null} */
  let best = null;
  for (const pad of pads) {
    const cx = nearestCopy(pad.cx, x);
    const distance = Math.abs(cx - x);
    if (distance > nearest + TIE) continue;
    if (!best || pad.y < best.pad.y || (pad.y === best.pad.y && distance < Math.abs(best.cx - x))) best = { pad, cx };
  }
  return best;
}

/**
 * Coasters in the order a cup at x would try them, by the same rule: the
 * nearest straight below first, then the nearest of the rest, and so on.
 * @param {number} x
 * @param {ReadonlyArray<Pad>} pads
 */
export function byReach(x, pads) {
  const rest = [...pads];
  /** @type {Pad[]} */
  const order = [];
  while (rest.length) {
    const next = /** @type {{ pad: Pad }} */ (nearestBelow(x, rest));
    order.push(next.pad);
    rest.splice(rest.indexOf(next.pad), 1);
  }
  return order;
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
 * the device already knows; `revived` is a lander sent after a crash;
 * `target` is the coaster a guided flight aims at.
 * @param {{ ship: Ship, site: Site, time: number, revived?: boolean, target?: Pad | null }} flight
 * @param {(id: string) => boolean} learned
 * @param {View} view
 * @returns {LessonCue | null}
 */
export function lessonAhead({ ship, site, time, revived = false, target = null }, learned, view) {
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

  // A touchdown on a coaster about to go wrong, at the moment the fix is
  // needed: only when the cup is coming down on it, not passing over.
  if (!learned("touchdown") && ship.vy < 0) {
    const below = padBelow(ship, site);
    const height = below ? ship.y - FOOT_DROP - below.pad.y : 0;
    const lands = below && Math.abs(ship.x + (ship.vx * height) / -ship.vy - below.cx) <= below.pad.width / 2;
    if (below && lands && altitude < CLIMBED_AWAY) {
      const fault = touchdownFault(ship, site, height);
      if (fault && fault.lead >= TOUCHDOWN_LEAD[0] && fault.lead <= TOUCHDOWN_LEAD[1] && landsFromHere(ship, site, time)) {
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

  // Where to land: the coaster a guided flight aims at, once it is on
  // screen; otherwise the coaster on screen nearest straight below the cup.
  if (calm && !learned("coaster")) {
    const seen = site.pads.filter((pad) => inView(nearestCopy(pad.cx, ship.x), pad.y, view, 24));
    const pick = target ? (seen.includes(target) ? { pad: target, cx: nearestCopy(target.cx, ship.x) } : null) : nearestBelow(ship.x, seen);
    if (pick) return { ...cue(LESSONS.coaster, pick.cx, pick.pad.y, pick.pad.width / 2 + 4, false), pad: pick.pad };
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
  /** @param {Ship} at @returns {PathPoint} */
  const point = (at) => ({ x: at.x, y: at.y, a: at.angle, b: at.throttle > BURNING });
  /** @type {PathPoint[]} */
  const points = [point(copy)];
  /** @type {Touchdown | null} */
  let result = null;
  const every = Math.max(1, Math.round(sample / H));
  for (let k = 1; k <= Math.round(seconds / H) && !result; k++) {
    const t = time + (k - 1) * H;
    result = stepShip(copy, keys(copy, t), site, t, H, ceiling);
    if (result || k % every === 0) points.push(point(copy));
    if (!result && until(copy, t + H)) break;
  }
  return { copy, points, result };
}

/** A ghost is drawn burning where the cup it follows had its throttle above this. */
const BURNING = 0.25;

/**
 * The autopilot's flight from here to the first of `pads` it lands on, as
 * a ghost's path; null if none of them is reached.
 * @param {Ship} ship
 * @param {Site} site
 * @param {number} time
 * @param {number} ceiling
 * @param {ReadonlyArray<Pad>} pads
 * @returns {GhostPath | null}
 */
function planTo(ship, site, time, ceiling, pads) {
  for (const pad of pads) {
    const pilot = createPilot(pad, ship);
    const flight = flyCopy(ship, site, time, ceiling, (copy, t) => pilotControls(pilot, copy, site, t), () => false, PLAN_SECONDS, PLAN_SAMPLE);
    if (flight.result?.kind === "land" && flight.result.pad === pad) {
      return { points: flight.points, pad, land: { x: flight.copy.x, y: flight.copy.y }, relative: false, sample: PLAN_SAMPLE };
    }
  }
  return null;
}

/**
 * The tilt lesson's ghost: the path the engine's autopilot would fly from
 * here to a coaster, those on screen first, each the nearest straight below
 * the cup first. Only a flight that lands is kept; null if none of the
 * first few does. Run once, when the lesson starts, never per frame.
 * @param {Ship} ship
 * @param {Site} site
 * @param {number} time
 * @param {{ ceiling: number, view: View }} options
 * @returns {GhostPath | null}
 */
export function planApproach(ship, site, time, { ceiling, view }) {
  /** @param {Pad} pad */
  const seen = (pad) => inView(nearestCopy(pad.cx, ship.x), pad.y, view, 20);
  // A stable sort: in reach order within those on screen and those off it.
  const order = byReach(ship.x, site.pads).sort((a, b) => Number(seen(b)) - Number(seen(a)));
  return planTo(ship, site, time, ceiling, order.slice(0, PLAN_TRIES));
}

/**
 * A guided flight's path: the autopilot's flight from here to `pad`, by
 * default the coaster nearest straight below the cup. Should it not land
 * there, the next coasters in reach are tried; null if none of the first few
 * is. Run as the flight starts, and again only when the cup has strayed far
 * from the path, never per frame.
 * @param {Ship} ship
 * @param {Site} site
 * @param {number} time
 * @param {number} ceiling
 * @param {Pad | null} [pad]
 * @returns {GhostPath | null}
 */
export function planGuide(ship, site, time, ceiling, pad = null) {
  const order = byReach(ship.x, site.pads);
  if (pad && order.includes(pad)) order.unshift(...order.splice(order.indexOf(pad), 1));
  return planTo(ship, site, time, ceiling, order.slice(0, PLAN_TRIES));
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
  const sample = 0.05;
  const flight = flyCopy(ship, site, time, ceiling, () => BURN_KEYS, (copy, t) => copy.vy >= 0 && t - start > 0.3, 1.8, sample);
  const points = flight.points.map((p) => ({ x: p.x - ship.x, y: p.y - ship.y, a: p.a, b: true }));
  return { points, pad: null, land: null, relative: true, sample };
}

// --- Following a path -----------------------------------------------------------

/**
 * A point a fractional way along a path's points (2.5 is halfway from the
 * third to the fourth), its tilt eased the short way round.
 * @param {ReadonlyArray<PathPoint>} points
 * @param {number} s
 * @returns {PathPoint}
 */
export function pointAt(points, s) {
  const last = points.length - 1;
  const at = Math.max(0, Math.min(last, s));
  const i = Math.min(Math.max(0, last - 1), Math.floor(at));
  const a = points[i];
  const b = points[Math.min(last, i + 1)];
  const f = at - i;
  let turn = b.a - a.a;
  if (turn > Math.PI) turn -= Math.PI * 2;
  else if (turn < -Math.PI) turn += Math.PI * 2;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, a: a.a + turn * f, b: f < 0.5 ? a.b : b.b };
}

/**
 * Where on a path a cup at x, y is: the nearest point of it, as a
 * fractional index, searched from a little before `from` onward (so a cup
 * that climbs back is never sent back to the start), and how far away it is.
 * @param {ReadonlyArray<PathPoint>} points
 * @param {number} x
 * @param {number} y
 * @param {number} [from]
 */
export function nearestOnPath(points, x, y, from = 0) {
  let best = { s: 0, distance: Infinity };
  if (points.length === 1) return { s: 0, distance: Math.hypot(points[0].x - x, points[0].y - y) };
  for (let i = Math.max(0, Math.floor(from) - 2); i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const f = length > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length)) : 0;
    const distance = Math.hypot(a.x + dx * f - x, a.y + dy * f - y);
    if (distance < best.distance) best = { s: i + f, distance };
  }
  return best;
}

/**
 * Where a lead ghost goes on a path, ahead of the cup at `s`: at least
 * `seconds` of the path's flight on, and at least `reach` units along it, so
 * it never sits on the cup, or the path's end if that comes first.
 * @param {GhostPath} path
 * @param {number} s
 * @param {{ seconds?: number, reach?: number }} [options]
 */
export function leadOn(path, s, { seconds = 1, reach = 34 } = {}) {
  const points = path.points;
  const last = points.length - 1;
  const from = Math.max(0, Math.min(last, s));
  // As far along as `reach` units of the path, between points where it falls.
  let far = last;
  let walked = 0;
  let here = pointAt(points, from);
  for (let i = Math.floor(from) + 1; i <= last; i++) {
    const there = points[i];
    const length = Math.hypot(there.x - here.x, there.y - here.y);
    if (walked + length >= reach) {
      const start = i === Math.floor(from) + 1 ? from : i - 1;
      far = start + (i - start) * (length > 0 ? (reach - walked) / length : 1);
      break;
    }
    walked += length;
    here = there;
  }
  return Math.min(last, Math.max(from + seconds / path.sample, far));
}

// --- Placing the callout -----------------------------------------------------------

/**
 * The cup as drawn, in world units from its centre: half its width, and its
 * lowest and highest points (feet to straw), each with a little room.
 */
export const CUP = Object.freeze({ half: 15, low: -FOOT_DROP - 2, high: 20 });
/** Coach's widest slip, px (19rem). */
export const SLIP_W = 304;
/** The tallest lesson line expected above the cup (two lines and Continue, on a phone), px. */
export const GUIDED_SLIP_H = 104;
/** The least room kept between the cup's straw and the tickets, px. */
const HEADROOM = 10;

/**
 * Room the camera keeps between the cup's straw and the tickets, in px. On
 * a guided flight on a screen too narrow for a lesson's line beside the cup,
 * enough for the line to sit above it; otherwise a little, so the cup is
 * always on screen. Only the camera follows this: the cup starts and flies
 * the same on every flight, guided or not.
 * @param {number} viewW the screen's width, px
 * @param {number} scale px per world unit, at rest
 * @param {boolean} guided
 */
export function headroomFor(viewW, scale, guided) {
  const beside = viewW / 2 - CUP.half * scale - 20 - GUTTER;
  if (!guided || beside >= SLIP_W) return HEADROOM;
  // The callout keeps 8 px under the tickets, and the slip stays 6 px over
  // the cup's marks (4 px to spare).
  return 8 + GUIDED_SLIP_H + 6 + 4;
}

/**
 * The lowest the camera may sit, in world y, for the cup at `cupY` to have
 * `headroom` px between its straw and the top of the play area, which is
 * half the view's height over the camera at zoom `zoom`.
 * @param {number} cupY
 * @param {{ viewHeight: number, base: number, zoom: number, headroom: number }} frame
 *   `viewHeight` in world units at rest, `base` px per unit at rest
 */
export function cameraFloor(cupY, { viewHeight, base, zoom, headroom }) {
  return cupY + CUP.high + (headroom / base - viewHeight / 2) / zoom;
}

/** How far below a coaster's surface its slab and label reach, in px. */
const COASTER_LABEL = 27;
/** Room kept between a slip and a box it must not cover, and round each point of a path, px. */
const MARGIN = 6;
const PATH_ROOM = 10;
const GUTTER = 16;

/**
 * How far the slip stands off its anchor on each axis, as Coach.svelte
 * measures it: clear of its marks, or of the thing they mark.
 * @param {{ ring: number, width: number, height: number }} at
 */
function gaps({ ring, width, height }) {
  const loopW = Math.max(ring * 2.3, width > 0 ? (width + 6) * 2 : 0);
  const loopH = Math.max(ring * 1.75, height > 0 ? (height + 4) * 2 : 0);
  const marked = ring > 0 || width > 0;
  const reachX = Math.max(ring * 0.8, loopW / 2, width);
  const reachY = Math.max(ring * 0.8, loopH / 2);
  return { gx: (marked ? reachX : 6) + 14, gy: (marked ? reachY : 6) + 14 };
}

/**
 * @typedef {{ x: number, y: number, ring: number, width: number, height: number }} Anchor
 * A callout's anchor and its marks, in px, as the game passes them to Coach.
 */
/** @typedef {{ w: number, h: number, top: number, bottom: number }} Screen The viewport, the highest a slip may sit (under the tickets) and the lowest (over the touch pads), px. */

/**
 * The slip on `side` of its anchor, as Coach.svelte lays it out: clear of
 * the marks, then kept on screen.
 * @param {Side} side @param {Anchor} at @param {{ w: number, h: number }} slip @param {Screen} screen
 * @returns {Box}
 */
export function slipBox(side, at, slip, screen) {
  const { gx, gy } = gaps(at);
  let left = at.x - slip.w / 2;
  let top = at.y - slip.h / 2;
  if (side === "above") top = at.y - gy - slip.h;
  if (side === "below") top = at.y + gy;
  if (side === "left") left = at.x - gx - slip.w;
  if (side === "right") left = at.x + gx;
  left = Math.max(GUTTER, Math.min(screen.w - GUTTER - slip.w, left));
  top = Math.max(screen.top, Math.min(screen.h - GUTTER - slip.h, top));
  return { x: left, y: top, w: slip.w, h: slip.h };
}

/**
 * Whether the slip fits on `side`. Beside its thing, by Coach.svelte's own
 * test, since Coach takes the other side when it fails; above or below,
 * where Coach only ever nudges the slip back on screen, whether the nudged
 * slip still stays off the thing's marks, and off the touch pads' row.
 * @param {Side} side @param {Anchor} at @param {{ w: number, h: number }} slip @param {Screen} screen
 */
function fitsOn(side, at, slip, screen) {
  const { gx, gy } = gaps(at);
  if (side === "left") return at.x - gx - slip.w >= GUTTER;
  if (side === "right") return at.x + gx + slip.w <= screen.w - GUTTER;
  const box = slipBox(side, at, slip, screen);
  const reach = gy - 14;
  if (side === "above") return box.y + box.h <= at.y - reach - 2;
  return box.y >= at.y + reach + 2 && box.y + box.h <= screen.bottom;
}

/** @param {Box} a @param {Box} b @param {number} room */
const overlaps = (a, b, room) => a.x < b.x + b.w + room && b.x < a.x + a.w + room && a.y < b.y + b.h + room && b.y < a.y + a.h + room;

/**
 * What a slip would cover: each box it must keep clear of counts heavily,
 * each point of the path about to be flown counts one.
 * @param {Box} box @param {ReadonlyArray<Box>} avoid @param {ReadonlyArray<{ x: number, y: number }>} path
 */
export function covered(box, avoid, path) {
  let cost = 0;
  for (const other of avoid) if (overlaps(box, other, MARGIN)) cost += 100;
  for (const p of path) {
    if (p.x > box.x - PATH_ROOM && p.x < box.x + box.w + PATH_ROOM && p.y > box.y - PATH_ROOM && p.y < box.y + box.h + PATH_ROOM) cost += 1;
  }
  return cost;
}

/**
 * Picks the side of its thing a callout sits on: `prefer` (the side it is
 * already on) while that still fits and covers nothing, else the first of
 * `sides` that does, else the side that fits and covers least. A slip
 * covers nothing when it is clear of every box in `avoid` (the cup, the
 * coaster aimed at, the touch pads) and of the points of `path`.
 * @param {{
 *   at: Anchor, slip: { w: number, h: number }, screen: Screen, sides: Side[],
 *   avoid?: ReadonlyArray<Box>, path?: ReadonlyArray<{ x: number, y: number }>, prefer?: Side | null
 * }} g
 * @returns {{ side: Side, box: Box, clear: boolean }}
 */
export function placeCallout({ at, slip, screen, sides, avoid = [], path = [], prefer = null }) {
  /** @type {{ side: Side, box: Box, cost: number } | null} */
  let best = null;
  for (const side of prefer ? [prefer, ...sides.filter((other) => other !== prefer)] : sides) {
    if (!fitsOn(side, at, slip, screen)) continue;
    const box = slipBox(side, at, slip, screen);
    const cost = covered(box, avoid, path);
    if (cost === 0) return { side, box, clear: true };
    if (!best || cost < best.cost) best = { side, box, cost };
  }
  if (best) return { side: best.side, box: best.box, clear: false };
  return { side: sides[0], box: slipBox(sides[0], at, slip, screen), clear: false };
}

/**
 * Where the callout for `cue` goes on screen: its anchor, its marks, and the
 * side of its thing it sits on, clear of the cup, the path about to be flown
 * (the lesson's own ghost and the guide's way ahead) and the coaster aimed
 * at. Everything comes in as the game draws it this frame.
 * @param {LessonCue} cue
 * @param {{
 *   cup: { x: number, y: number },
 *   guide?: GhostPath | null, along?: number,
 *   toX: (x: number) => number, toY: (y: number) => number, scale: number,
 *   screen: Screen, slip: { w: number, h: number },
 *   avoid?: ReadonlyArray<Box>, loop?: Box | null, prefer?: Side | null
 * }} g `cup` is where the cup is drawn (world); `scale` is px per world
 *   unit; `avoid` holds more boxes to keep clear of (the touch pads); `loop`
 *   is the box round a landed cup, which its notes sit above.
 * @returns {Anchor & { side: Side, clear: boolean }}
 */
export function calloutFor(cue, { cup, guide = null, along = 0, toX, toY, scale, screen, slip, avoid = [], loop = null, prefer = null }) {
  const id = cue.lesson.id;
  /** @param {number} left @param {number} right @param {number} low @param {number} high @returns {Box} */
  const worldBox = (left, right, low, high) => ({ x: toX(left), y: toY(high), w: (right - left) * scale, h: (high - low) * scale });
  const cupBox = worldBox(cup.x - CUP.half, cup.x + CUP.half, cup.y + CUP.low, cup.y + CUP.high);
  /** @type {Box[]} */
  const keep = [...avoid];
  if (id !== "feather") keep.push(cupBox);

  // The coaster aimed at: the lesson's own, or the guide's.
  const pad = cue.pad ?? guide?.pad ?? null;
  /** @type {Box | null} */
  let padBox = null;
  if (pad && id !== "feather") {
    const cx = nearestCopy(pad.cx, cup.x);
    const top = toY(pad.y + 14);
    padBox = { x: toX(cx - pad.width / 2 - 4), y: top, w: (pad.width + 8) * scale, h: toY(pad.y) + COASTER_LABEL - top };
    if (id !== "coaster") keep.push(padBox);
  }

  // The path about to be flown, where its chalk is drawn (at the feet).
  /** @type {Array<{ x: number, y: number }>} */
  const path = [];
  /** @param {GhostPath} ghost @param {number} from */
  const follow = (ghost, from) => {
    const ox = ghost.relative ? cup.x : 0;
    const oy = ghost.relative ? cup.y : 0;
    for (let i = Math.max(0, Math.floor(from)); i < ghost.points.length; i++) {
      path.push({ x: toX(ghost.points[i].x + ox), y: toY(ghost.points[i].y + oy - FOOT_DROP) });
    }
  };
  if (cue.path) follow(cue.path, 0);
  if (guide && guide !== cue.path) follow(guide, along);
  if (id === "touchdown" && cue.pad) {
    // The chalk from the feet to the ghost standing on the coaster, and the ghost.
    const cx = nearestCopy(cue.pad.cx, cup.x);
    const room = Math.max(0, cue.pad.width / 2 - FOOT_SPAN);
    const gx = Math.max(cx - room, Math.min(cx + room, cup.x));
    for (let k = 0; k <= 8; k++) path.push({ x: toX(cup.x + (gx - cup.x) * (k / 8)), y: toY(cup.y - FOOT_DROP + (cue.pad.y - cup.y + FOOT_DROP) * (k / 8)) });
    keep.push(worldBox(gx - CUP.half, gx + CUP.half, cue.pad.y + FOOT_DROP + CUP.low, cue.pad.y + FOOT_DROP + CUP.high));
  }

  /** Which way the path heads from the cup, over its first stretch: -1, 0 or 1. */
  const heading = () => {
    const ahead = path.slice(0, 30);
    if (!ahead.length) return 0;
    const mean = ahead.reduce((sum, p) => sum + p.x, 0) / ahead.length - toX(cup.x);
    return Math.abs(mean) < 4 ? 0 : Math.sign(mean);
  };
  /** @param {number} x @returns {Side[]} the roomier side of x first */
  const roomier = (x) => (x < screen.w / 2 ? ["right", "left"] : ["left", "right"]);

  /** @type {Anchor} */
  let at;
  /** @type {Side[]} */
  let sides;
  if (id === "coaster" && padBox) {
    // Beside the coaster, on the side the path doesn't come down: never over
    // it, where the cup will land.
    at = { x: toX(cue.x), y: padBox.y + padBox.h / 2, ring: 1, width: padBox.w / 2, height: padBox.h / 2 };
    const near = path.filter((p) => p.y > padBox.y - 4 * padBox.h);
    const from = near.length ? near.reduce((sum, p) => sum + p.x, 0) / near.length : toX(cup.x);
    const away = from <= at.x ? "right" : "left";
    sides = [away, away === "right" ? "left" : "right", "above", "below"];
  } else if (!cue.ship) {
    // A pennant: over it, unless that covers the way down.
    const ring = Math.round(Math.max(14, cue.size * scale));
    at = { x: toX(cue.x), y: toY(cue.y), ring, width: 0, height: 0 };
    sides = ["above", ...roomier(at.x), "below"];
  } else if (id === "feather" && loop) {
    // Beside the landing's brackets, clear of the notes stacked over them.
    at = { x: loop.x + loop.w / 2, y: loop.y + loop.h / 2, ring: 0, width: loop.w / 2, height: loop.h / 2 };
    keep.push({ x: loop.x, y: loop.y - 80, w: loop.w, h: 80 });
    sides = [...roomier(at.x), "below", "above"];
  } else {
    // On the cup: on the side away from where it is about to fly, clear of
    // the cup itself.
    const ring = cue.size > 0 ? Math.round(Math.max(14, cue.size * scale)) : 0;
    at = { x: toX(cup.x + cue.x), y: toY(cup.y + cue.y), ring, width: CUP.half * scale, height: ((CUP.high - CUP.low) / 2) * scale };
    const way = heading();
    /** @type {Side[]} */
    const beside = way > 0 ? ["left", "right"] : way < 0 ? ["right", "left"] : roomier(at.x);
    sides = id === "touchdown" ? ["above", ...beside, "below"] : [beside[0], "above", beside[1], "below"];
  }
  const { side, clear } = placeCallout({ at, slip, screen, sides, avoid: keep, path, prefer });
  return { ...at, side, clear };
}

/**
 * One game's lesson keeping for a flight: what the player has shown this
 * flight (a burn held, a tilted burn), which lesson is on screen, when a
 * move has been made, has worked, or has been missed, and on a guided
 * flight the path it follows.
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
  /** Moves made without working this run: not taught again until a later run. */
  const timedOut = new Set();
  /** Lessons held back until a flight second: a tilt with no landing in reach yet. */
  /** @type {Map<string, number>} */
  const held = new Map();
  /** This flight is guided: the device has never landed. */
  let guided = false;
  /** @type {GhostPath | null} */
  let guide = null;
  /** How far along the guide the cup has come, in its points. */
  let along = 0;
  /** When the guide was last planned, in flight seconds. */
  let plannedAt = -Infinity;
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

  /** The move the lesson on screen asks for was made: play comes back while it shows whether it worked. @param {string} id */
  function act(id) {
    if (coach.acting || coach.leaving || coach.current?.id !== id) return;
    coach.acted(id);
    actedAt = coach.age;
  }

  /**
   * Whether `keys` make the move lesson `id` asks for: the burn, a tilt
   * either way, or a touchdown's fix (burn for a fall too fast, a tilt for
   * a lean or a drift).
   * @param {string} id @param {Controls} keys
   */
  function makes(id, keys) {
    if (id === "burn") return keys.thrust;
    if (id === "steer") return keys.left || keys.right;
    if (id === "touchdown" && cue?.lesson.id === "touchdown" && cue.fault) return cue.fault === "fast" ? keys.thrust : keys.left || keys.right;
    return false;
  }

  /**
   * Plans the guide from the cup as it is now, to the coaster it aims at
   * (at first the one nearest straight below), keeping the old path if no
   * flight from here lands.
   * @param {Ship} ship @param {Site} site @param {number} time @param {number} ceiling
   */
  function planFrom(ship, site, time, ceiling) {
    plannedAt = time;
    const next = planGuide(ship, site, time, ceiling, guide?.pad ?? null);
    if (next) {
      guide = next;
      along = 0;
    }
    return next;
  }

  return {
    /** The lesson on screen and where it points, if any. */
    get cue() {
      const current = coach.current;
      return current && cue && cue.lesson.id === current.id ? cue : null;
    },

    /** This flight is guided: the device has never landed. */
    get guided() {
      return guided;
    },

    /** The path a guided flight follows to its coaster, or null. It stays until the next flight starts. */
    get guide() {
      return guided ? guide : null;
    },

    /** How far along the guide the cup has come, in its points (fractional). */
    get along() {
      return along;
    },

    /**
     * A fresh flight; `revived` is a lander sent after a crash. A device
     * that has never landed is guided: with the cup as it starts (`flight`)
     * and the view's `ceiling`, its path is planned now (and again whenever
     * this is called, such as when the countdown's view changes size).
     * @param {{ revived?: boolean, flight?: { ship: Ship, site: Site, time?: number } | null, ceiling?: number }} [options]
     */
    start({ revived: again = false, flight = null, ceiling = Infinity } = {}) {
      settle();
      coach.reset();
      cue = null;
      burnHeld = braked = safeFor = now = actedAt = 0;
      stalled = false;
      revived = again;
      held.clear();
      guided = guidedDevice(coach);
      guide = null;
      along = 0;
      plannedAt = -Infinity;
      if (guided && flight) planFrom(flight.ship, flight.site, flight.time ?? 0, ceiling);
    },

    /**
     * Once a frame, with the controls as they are (presses not yet seen by
     * a step included): while a move lesson holds play still, making the
     * move brings play back, and the latched press then makes it. Returns
     * true while a lesson still holds play stopped after that: any press
     * waiting then (a tap while a thing is explained, a key that isn't the
     * move) is the game's to drop, so it never carries into play.
     * @param {Controls} keys
     */
    input(keys) {
      const current = coach.current;
      if (current?.move && makes(current.id, keys)) act(current.id);
      return coach.paused;
    },

    /**
     * After every engine step, with the keys that step flew and the cup as
     * it now is. Moves are noticed here, made or not, taught or not.
     * @param {Controls} keys @param {Ship} ship @param {Site} site @param {number} h
     */
    step(keys, ship, site, h) {
      const id = coach.current && !coach.leaving ? coach.current.id : null;
      if (id && coach.current?.move && makes(id, keys)) act(id);
      if (keys.thrust && ship.fuel > 0) {
        if (burnHeld < BURN_LEARNED && burnHeld + h >= BURN_LEARNED) coach.done("burn");
        burnHeld += h;
      }
      // A tilted burn against the drift brakes it. Steering is known, taught
      // or not, once enough drift has been braked away and the cup is lined
      // up over a coaster, slow enough sideways to land.
      const push = Math.sin(ship.angle) * THRUST * ship.throttle * h;
      if (Math.abs(ship.angle) > 0.05 && push * ship.vx < 0) braked += Math.abs(push);
      if (braked >= STEER_LEARNED && !coach.learned("steer") && Math.abs(ship.vx) <= site.safe.vx && padBelow(ship, site)) {
        coach.done("steer");
      }
      if (id === "touchdown" && cue?.fault) {
        safeFor = withinLimits(ship, site) ? safeFor + h : 0;
        if (safeFor >= SAFE_LEARNED) coach.done("touchdown");
      }
    },

    /**
     * Once a frame while flying: follows the cup along the guide, takes down
     * a move whose moment has passed, and offers what is due. `ceiling` is
     * the view's, as the game steps it; `reading` says a line of the game's
     * own is still being read, so only a move may come in over it.
     * @param {{ ship: Ship, site: Site, time: number }} flight
     * @param {View} view
     * @param {number} ceiling
     * @param {boolean} [reading]
     */
    check({ ship, site, time }, view, ceiling, reading = false) {
      now = time;
      if (guided && ship.state === "flying") {
        if (!guide) {
          if (time - plannedAt >= REPLAN_EVERY) planFrom(ship, site, time, ceiling);
        } else {
          // Strayed far from it, the path is flown again from the cup.
          const near = nearestOnPath(guide.points, ship.x, ship.y, along);
          along = near.s;
          if (near.distance > STRAY && time - plannedAt >= REPLAN_EVERY) planFrom(ship, site, time, ceiling);
        }
      }
      const current = coach.current;
      const altitude = altitudeOf(ship, site);
      if (current?.move && !coach.leaving && cue?.lesson.id === current.id) {
        // Too low for a burn or a tilt to help, or climbed away from the touchdown.
        const passed = current.id === "touchdown" ? altitude > CLIMBED_AWAY : altitude < TOO_LOW;
        // Made without working: play never waits on it for ever.
        const proof = current.id === "steer" ? STEER_PROOF : MOVE_PROOF;
        const missed = coach.acting && coach.age - actedAt >= proof;
        // A touchdown warning stays only while doing what it says still lands.
        const lost = current.id === "touchdown" && !landsFromHere(ship, site, time);
        if (passed || missed || lost) {
          coach.dismiss();
          cue = null;
          // Missed, it isn't taught again this run, and nothing after it is
          // taught on this lander: never what comes later while it still matters.
          if (missed) {
            stalled = true;
            timedOut.add(current.id);
          }
        }
      }
      // Until the burn is known, nothing else is taught; missed, it waits for a later run.
      if (stalled || (timedOut.has("burn") && !coach.learned("burn"))) return;
      // A coaster or pennant gone from view has been seen: its explanation ends.
      if (current && !current.move && !coach.leaving && cue && !cue.ship && cue.lesson.id === current.id && !inView(cue.x, cue.y, view, 0)) {
        coach.done(current.id);
      }
      // A move being taught holds the stage, unless what is due outranks it
      // (a touchdown about to go wrong) or it has been made and another move
      // is needed now. It gives way uncounted: a move counts only once it works.
      const teaching = coach.current?.move && !coach.leaving ? coach.current : null;
      const target = guided ? (guide?.pad ?? null) : null;
      const next = lessonAhead({ ship, site, time, revived, target }, known, view);
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
        // A guided flight's tilt is its own path, flown again from here, so
        // the ghost starts the move where the cup is.
        next.path = guided ? planFrom(ship, site, time, ceiling) : planApproach(ship, site, time, { ceiling, view });
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
     * touchdown are known, and is the device's landing that ends its guided
     * flights; a move still
     * waiting comes down uncounted, so the next flight teaches it again; a
     * first feather landing is named.
     * @param {Touchdown} result
     */
    touchdown(result) {
      if (result.kind === "land") {
        coach.skip(LANDED);
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
     * on the next check. The guide keeps its path.
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

    /** A new run: a move missed in the last one may be taught again. */
    newRun() {
      timedOut.clear();
    },
  };
}
