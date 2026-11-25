// Boba catch's lessons: what the shift teaches, and when. Catch is played on
// the page itself, so each lesson sits beside the thing it is about (the
// link about to throw, a cup in the air, the spot where a cup will land, the
// basket) and never up in the tickets, because the eye is on the cups.
//
// Every lesson slows play to under a third of its pace while it explains,
// for as long as the player wants to read it: Continue (Enter, or the
// slip's button) ends it and play eases back to speed. One move is taught,
// the catch itself: its arc is chalked down to the catch line and a ghost
// basket waits where it will land, and play comes back to speed once the
// basket has settled there. Everything else is a thing, named once as it
// first appears (the glowing link, a golden cup, a pair, a lob, a flick),
// and a line about a cup ends by itself when the cup is caught or goes
// past. A lesson about a cup is only ever about the next cup to come down,
// so a player following it never lets an earlier one fall; if that cup is
// too close to read or reach, it waits for the next, and if a cup thrown
// later would land first, the lesson stands down (uncounted) for it. Every
// slow explanation, the catch included, ends after `HOLD` real seconds at
// most. A pearl lost and a bonus point are taught by the component as they
// happen.
//
// DOM-free: the component asks `lessonNow` each frame and hands the answer
// to the shared coach (src/lib/arcade/core/coach.ts), which shows one lesson
// at a time and remembers them per device.

import { PLAYFIELD_EDGE, foldInto, predictLanding } from "../boba-engine.js";

/**
 * @typedef {{
 *   id: string, text: string, name?: string, keys?: string[], touch?: string,
 *   slow?: number, life?: number, minLife?: number, move?: boolean
 * }} Lesson
 */

/** Real seconds a line beside a cup needs before the cup lands, so it is read while the cup is still up. */
export const READ_TIME = 1;
/** The catch isn't taught on a cup closer to landing than this (seconds on shift): too late to get there. */
export const MOVE_LATEST = 0.5;
/** The basket is at the spot once the cup will land this close to its middle (a share of its width)… */
export const ON_SPOT = 0.35;
/** …and the catch is made once it has stayed there this long (real seconds), not on a sweep through. */
export const SETTLE = 0.25;
/** Real seconds of full-speed play between two lines about things. */
export const REST = 1.5;
/** The coach's own floor for how long a line stays up, for a lesson that names none. */
const DEFAULT_MIN_LIFE = 0.9;

/** Play's pace while a lesson explains (slow motion, the whole shift together). */
export const SLOW = 0.3;
/** The longest an explanation holds play slow before it ends by itself (real seconds); the catch, unmade by then, is taken down uncounted. */
export const HOLD = 7;
/** A line beside a cup in flight: it ends when the cup is caught or goes past, if Continue hasn't ended it. */
const aCup = { slow: SLOW, life: HOLD, minLife: 1.4 };
/** A line about something that just happened, beside the basket. */
const anEvent = { slow: SLOW, life: HOLD, minLife: 1.6 };

/** Every lesson: one short full sentence, eight words or fewer. @type {Readonly<Record<string, Lesson>>} */
export const LESSONS = Object.freeze({
  // The glow and the first throw run as one slow beat: the link is still
  // lit while its line is read, and the catch takes over once it has been.
  glow: { id: "glow", text: "A glowing link is about to throw.", slow: SLOW, life: HOLD, minLife: 1.3 },
  catch: { id: "catch", text: "Move the basket under the cup.", slow: SLOW, life: Infinity, minLife: 0.8, move: true },
  miss: { id: "miss", text: "Each missed cup costs a pearl.", ...anEvent },
  perfect: { id: "perfect", text: "Catch in the middle for a bonus point.", ...anEvent },
  golden: { id: "golden", text: "Golden cups are worth three points.", ...aCup },
  comeback: { id: "comeback", text: "Three straight golden cups win a pearl back.", ...aCup },
  volley: { id: "volley", text: "Catch the first to land, then the next.", ...aCup },
  lob: { id: "lob", text: "High lobs drift, so follow them down.", ...aCup },
  flick: { id: "flick", text: "Low flicks land fast, so move early.", ...aCup },
});

/**
 * @typedef {object} CupInFlight
 * A cup in the air, as the component keeps it.
 * @property {number} x Left of the sprite.
 * @property {number} y Top of the sprite.
 * @property {boolean} golden
 * @property {"throw" | "lob" | "flick"} kind
 * @property {number} volley Shared by the cups of one pair or three; 0 for a cup thrown alone.
 * @property {number} landAt When it reaches the catch line, on the shift's clock.
 * @property {number} landCenter Where its centre is then.
 * @property {boolean} [passed] It has gone past the catch line uncaught, and only has to fall off the page.
 */

/**
 * @typedef {object} WaitingThrow
 * A link glowing before it throws.
 * @property {{ x: number, y: number, width: number, height: number } | null} link
 *   The link's centre and size on screen; null when no link is behind the cup.
 */

/**
 * @template {CupInFlight} C
 * @template {WaitingThrow} S
 * @typedef {{ lesson: Lesson, cup: C | null, spawn: S | null }} CatchCue
 * What to teach, and the cup or the waiting throw it is about.
 */

/** What a cup is, for picking one out of the air. */
const SORTS = Object.freeze({
  any: () => true,
  /** @param {CupInFlight} cup */
  lob: (cup) => cup.kind === "lob",
  /** @param {CupInFlight} cup */
  flick: (cup) => cup.kind === "flick",
});

/** How fast the coach eases play into slow motion (its own constant, seconds). */
const EASE_IN = 0.16;

/** A cup stepped frame by frame comes down a hair before its planned landing (seconds on shift). */
const LANDING_SLACK = 0.05;

/**
 * The earliest landing (on the shift's clock) a cup can have and still be
 * taught about: `READ_TIME` of real time at the lesson's pace, plus the
 * shift time that passes while play eases down into it, plus a little for
 * the cup coming down early.
 * @param {number} now @param {Lesson} lesson
 */
const readableAfter = (now, lesson) => {
  const slow = lesson.slow ?? 1;
  return now + READ_TIME * slow + EASE_IN * (1 - slow) + LANDING_SLACK;
};

/**
 * The cup in `cups` still to come down that lands soonest, among those
 * landing no sooner than `after` that `match` accepts.
 * @template {CupInFlight} C
 * @param {C[]} cups @param {number} after @param {(cup: CupInFlight) => boolean} match
 */
function soonest(cups, after, match) {
  /** @type {C | null} */
  let best = null;
  for (const cup of cups) {
    if (cup.passed || cup.landAt < after || !match(cup)) continue;
    if (!best || cup.landAt < best.landAt) best = cup;
  }
  return best;
}

/**
 * The next cup to come down: the one still in the air that lands soonest.
 * @template {CupInFlight} C
 * @param {C[]} cups
 */
export function nextDown(cups) {
  return soonest(cups, -Infinity, SORTS.any);
}

/**
 * Whether a lesson about `cup` still points the player at the right cup:
 * it is still in the air and nothing thrown since lands before it.
 * @param {CupInFlight} cup @param {CupInFlight[]} cups
 */
export function stillNext(cup, cups) {
  return !cup.passed && nextDown(cups) === cup;
}

/**
 * `lesson` about `cup`, if the cup is still far enough off landing for the
 * line to be read at the lesson's pace; otherwise nothing yet.
 * @template {CupInFlight} C
 * @param {Lesson} lesson @param {C} cup @param {number} now
 */
function aboutCup(lesson, cup, now) {
  return cup.landAt >= readableAfter(now, lesson) ? { lesson, cup, spawn: null } : null;
}

/**
 * Whether another cup of `cup`'s pair (or three) is in the air with it.
 * @param {CupInFlight} cup @param {CupInFlight[]} cups
 */
function inVolley(cup, cups) {
  if (!cup.volley) return false;
  for (const other of cups) if (other !== cup && other.volley === cup.volley && !other.passed) return true;
  return false;
}

/**
 * The lesson this moment needs, if the device still needs one: the catch on
 * the next cup to come down (while there is time to get under it; if not,
 * nothing until it has gone past), then the glow on a link about to throw,
 * then what is new about the next cup down. `learned` says what the device
 * already knows.
 * @template {CupInFlight} C
 * @template {WaitingThrow} S
 * @param {{ now: number, cups: C[], waiting: S[], pearlDown: boolean, pearlsComeBack: boolean }} moment
 *   `now` is on the same clock as the cups' `landAt`; `pearlDown` is true
 *   while a pearl is missing; `pearlsComeBack` is false where golden cups
 *   never win one back (expert).
 * @param {(id: string) => boolean} learned
 * @returns {CatchCue<C, S> | null}
 */
export function lessonNow(moment, learned) {
  const { now, cups, waiting } = moment;
  // Never about a later cup while an earlier one is still coming down: a
  // player following the lesson would let that one fall.
  const next = nextDown(cups);
  if (!learned("catch") && next) {
    return next.landAt - now >= MOVE_LATEST ? { lesson: LESSONS.catch, cup: next, spawn: null } : null;
  }
  if (!learned("glow")) {
    for (const spawn of waiting) if (spawn.link) return { lesson: LESSONS.glow, cup: null, spawn };
  }
  if (!next) return null;
  // What a golden cup is for: its points, then (while a pearl is down,
  // wherever pearls come back) the pearl it can win back.
  if (next.golden) {
    if (!learned("golden")) return aboutCup(LESSONS.golden, next, now);
    if (moment.pearlDown && moment.pearlsComeBack && !learned("comeback")) return aboutCup(LESSONS.comeback, next, now);
  }
  if (!learned("volley") && inVolley(next, cups)) return aboutCup(LESSONS.volley, next, now);
  for (const kind of /** @type {const} */ (["lob", "flick"])) {
    if (!learned(kind) && SORTS[kind](next)) return aboutCup(LESSONS[kind], next, now);
  }
  return null;
}

/**
 * Whether `next` may take the stage. Nothing is cut off before it has been
 * up long enough to read: the coach would let a move cut in on a line about
 * a thing at once. A move (the catch) may take over once the line up now
 * has been read, or the player has moved on from it, since it is needed
 * now; play is slow under the first glow, so the first cup is still well
 * up when it does. A line about
 * a thing waits until nothing is up and play has run at full speed for
 * `REST`, so lessons never run together into one long slow stretch.
 * Whether the coach then accepts `next` is still the coach's call.
 * @param {Lesson} next
 * @param {Lesson | null} current
 * @param {number} age Real seconds the current lesson has been up.
 * @param {number} [quiet] Real seconds since the last lesson came down (Infinity: none yet this run).
 * @param {boolean} [leaving] The current lesson is on its way out (done, or the player pressed Continue).
 */
export function mayOffer(next, current, age, quiet = Infinity, leaving = false) {
  if (current) return current.id === next.id || (next.move === true && (leaving || age >= (current.minLife ?? DEFAULT_MIN_LIFE)));
  return next.move === true || quiet >= REST;
}

/**
 * Whether a basket centred at `basketCenter` is under a cup landing at
 * `landing`: the catch lesson's move is made, and play comes back to speed.
 * @param {number} basketCenter @param {number} landing @param {number} basketWidth
 */
export function onSpot(basketCenter, landing, basketWidth) {
  return Math.abs(basketCenter - landing) <= basketWidth * ON_SPOT;
}

/**
 * @typedef {{ x: number, y: number, t: number, d: number }} FlightPoint
 * A point on a cup's way down: its bottom centre, `t` seconds on (shift
 * time) from where the path starts, `d` pixels along it.
 */

/**
 * The path a cup's bottom centre takes from where it is now down to the
 * catch line, on the same arc the engine planned it on (wall bounces and
 * all): the chalk that shows the first throw where it will come down. Fills
 * `into`, reusing its points, with a point every `every` seconds of flight
 * or so and the last on the planned landing, and returns it.
 * @param {{ x: number, y: number, vx: number, vy: number }} cup Left/top of the sprite.
 * @param {number} gravity
 * @param {{ catchLine: number, sprite: { width: number, height: number }, viewportWidth: number }} field
 * @param {FlightPoint[]} into
 * @param {number} [every]
 */
export function flightPath(cup, gravity, { catchLine, sprite, viewportWidth }, into, every = 1 / 30) {
  const landing = predictLanding(cup, gravity, catchLine, sprite, viewportWidth);
  const left = PLAYFIELD_EDGE;
  const right = Math.max(left, viewportWidth - PLAYFIELD_EDGE - sprite.width);
  const half = sprite.width / 2;
  const steps = Math.max(1, Math.ceil(landing.time / every));
  let distance = 0;
  for (let i = 0; i <= steps; i++) {
    const last = i === steps;
    const t = last ? landing.time : (landing.time * i) / steps;
    const x = last ? landing.center : foldInto(cup.x + cup.vx * t, left, right) + half;
    const y = last ? catchLine : cup.y + sprite.height + cup.vy * t + 0.5 * gravity * t * t;
    if (i > 0) distance += Math.hypot(x - into[i - 1].x, y - into[i - 1].y);
    const point = (into[i] ??= { x: 0, y: 0, t: 0, d: 0 });
    point.x = x;
    point.y = y;
    point.t = t;
    point.d = distance;
  }
  into.length = steps + 1;
  return into;
}
