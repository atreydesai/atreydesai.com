// Boba catch's lessons: what the shift teaches, when, and where its callout
// goes. Catch is played on the page itself, so each lesson sits beside the
// thing it is about (the link about to throw, a cup in the air, the spot
// where a cup will land, the basket) and never up in the tickets, because
// the eye is on the cups. It never covers the basket, the basket's way
// along its row to where the cup lands, the cup, the cup's way down, or the
// landing: it takes the side away from all that, at its measured size.
//
// Every lesson stops play while it explains: the whole shift stands still
// for as long as the player wants to read it, and Continue (Enter, or the
// slip's button) brings it back. One move is taught, the catch itself: play
// freezes the moment the first cup leaves its link, its way down is chalked
// to the catch line, and a ghost basket runs from the basket to where it
// will land, again and again, in real time. The player's own move brings
// play back: the basket brought under the cup and held there. Moving it
// isn't enough, since a hand on its way to the slip's Continue moves it too
// (and the slip sits beyond the landing, so heading for the landing isn't
// either); a hand passing through the spot isn't holding it there, and one
// near the slip is reaching for Continue. The lesson counts once that cup
// is caught. Everything else is a thing, named
// once as it first matters (the glowing link, a golden cup, a pair, a lob,
// a flick, a lost pearl, the bonus point).
//
// Stopping play must never cost a pearl. A lesson about a cup is only ever
// about the next cup to come down, so a player following it never lets an
// earlier one fall; and play stops for a thing only while a hand that went
// to the slip's button could still get back under the next cup down once
// play goes on (from beside that cup, for a line about it; from anywhere on
// the page, for anything else). If a cup thrown later would land first, the
// lesson stands down (uncounted) for it. Nothing holds play for more than
// `HOLD` real seconds.
//
// DOM-free: the component asks `lessonNow` each frame and hands the answer
// to the shared coach (src/lib/arcade/core/coach.ts), which shows one lesson
// at a time and remembers them per device; it asks the placement helpers
// below where the slip goes.

import { PLAYFIELD_EDGE, foldInto, predictLanding, reachSeconds } from "../boba-engine.js";

/**
 * @typedef {{
 *   id: string, text: string, name?: string, keys?: string[], touch?: string,
 *   slow?: number, life?: number, minLife?: number, move?: boolean
 * }} Lesson
 */

/** The catch isn't taught on a cup closer to landing than this (seconds on shift): too late to get there. */
export const MOVE_LATEST = 0.5;
/** The basket is at the spot once the cup will land this close to its middle (a share of its width)… */
export const ON_SPOT = 0.35;
/** …and it is waiting there once it has stayed this long (real seconds), not on a sweep through… */
export const SETTLE = 0.25;
/** …within this many px of where it stopped, so a hand's tremor still counts and a slow pass doesn't. */
export const SETTLE_PX = 6;
/** A pointer this close to the slip (px) is on its way to Continue, not waiting under the cup. */
export const SLIP_NEAR = 24;
/** The catch's freeze holds at least this long (real seconds) before the basket's move brings play back, so a hand already there still sees it. */
export const FREEZE_MIN = 0.6;
/** Real seconds of full-speed play between two lines about things. */
export const REST = 1.5;
/**
 * Shift seconds that still pass once a lesson asks play to stop (it comes to
 * a stop in a beat, not a jolt), plus a hair for a cup stepped frame by
 * frame coming down before its planned landing.
 */
export const PAUSE_SLACK = 0.12;
/** The longest a lesson holds play stopped before it ends by itself (real seconds); the catch, unmade by then, is taken down uncounted. */
export const HOLD = 7;
/**
 * How far (px) from a cup's left edge the Continue button on a slip about
 * it can be: the slip's widest (19rem), beyond the marks round the cup,
 * and the cup's own width.
 */
export const SLIP_REACH = 304 + 50 + 35;
/** The coach's own floor for how long a line stays up, for a lesson that names none. */
const DEFAULT_MIN_LIFE = 0.9;

/** A line about a cup in flight: play stops until Continue, or `HOLD`. */
const aCup = { slow: 0, life: HOLD, minLife: 1.4 };
/** A line about something that just happened, beside the basket. */
const anEvent = { slow: 0, life: HOLD, minLife: 1.6 };

/** Every lesson: one short full sentence, eight words or fewer. @type {Readonly<Record<string, Lesson>>} */
export const LESSONS = Object.freeze({
  // Play stops while the first link to light is still lit; once it has been
  // continued, the link throws and play freezes again for the catch.
  glow: { id: "glow", text: "A glowing link is about to throw.", slow: 0, life: HOLD, minLife: 1.3 },
  catch: { id: "catch", text: "Move the basket under the cup.", slow: 0, life: Infinity, minLife: 0.8, move: true },
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
 * @property {number} [remaining] Shift seconds before it throws.
 */

/**
 * @typedef {object} Moment
 * What the lessons read each frame.
 * @property {number} now On the same clock as the cups' `landAt`.
 * @property {CupInFlight[]} cups
 * @property {WaitingThrow[]} waiting
 * @property {boolean} pearlDown A pearl is missing.
 * @property {boolean} pearlsComeBack False where golden cups never win one back (expert).
 * @property {number} width The page's width (px), which the basket may have to cross.
 */

/**
 * @template {CupInFlight} C
 * @template {WaitingThrow} S
 * @typedef {{ lesson: Lesson, cup: C | null, spawn: S | null }} CatchCue
 * What to teach, and the cup or the waiting throw it is about.
 */

/** What a cup is, for picking one out of the air. */
const SORTS = Object.freeze({
  /** @param {CupInFlight} cup */
  lob: (cup) => cup.kind === "lob",
  /** @param {CupInFlight} cup */
  flick: (cup) => cup.kind === "flick",
});

/** A link this close to throwing isn't pointed at: it would throw as play stops. */
const GLOW_LATEST = 0.1;

/**
 * The next cup to come down: the one still in the air that lands soonest.
 * @template {CupInFlight} C
 * @param {C[]} cups
 */
export function nextDown(cups) {
  /** @type {C | null} */
  let best = null;
  for (const cup of cups) {
    if (cup.passed) continue;
    if (!best || cup.landAt < best.landAt) best = cup;
  }
  return best;
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
 * Whether play may stop now to explain a thing: nothing is in the air, or
 * the next cup down will still be up long enough, once play goes on, for a
 * hand that went to the slip's Continue button to get back under it. For a
 * line `about` that very cup the slip sits beside it, so the way back is at
 * most the slip's reach plus the cup's drift to its landing; for anything
 * else the button could be anywhere on the page. Every later cup was thrown
 * fair from that one's landing.
 * @param {Pick<Moment, "now" | "cups" | "width">} moment
 * @param {CupInFlight | null} [about]
 */
export function mayPause(moment, about = null) {
  const next = nextDown(moment.cups);
  if (!next) return true;
  const back = next === about ? Math.min(moment.width, Math.abs(next.landCenter - next.x) + SLIP_REACH) : moment.width;
  return next.landAt - moment.now >= reachSeconds(back) + PAUSE_SLACK;
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
 * then what is new about the next cup down, each only while play may stop
 * for it. `learned` says what the device already knows.
 * @template {CupInFlight} C
 * @template {WaitingThrow} S
 * @param {Moment & { cups: C[], waiting: S[] }} moment
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
  if (!learned("glow") && mayPause(moment)) {
    for (const spawn of waiting) {
      if (spawn.link && (spawn.remaining ?? Infinity) >= GLOW_LATEST) return { lesson: LESSONS.glow, cup: null, spawn };
    }
  }
  if (!next || !mayPause(moment, next)) return null;
  /** @param {Lesson} lesson */
  const about = (lesson) => ({ lesson, cup: next, spawn: null });
  // What a golden cup is for: its points, then (while a pearl is down,
  // wherever pearls come back) the pearl it can win back.
  if (next.golden) {
    if (!learned("golden")) return about(LESSONS.golden);
    if (moment.pearlDown && moment.pearlsComeBack && !learned("comeback")) return about(LESSONS.comeback);
  }
  if (!learned("volley") && inVolley(next, cups)) return about(LESSONS.volley);
  for (const kind of /** @type {const} */ (["lob", "flick"])) {
    if (!learned(kind) && SORTS[kind](next)) return about(LESSONS[kind]);
  }
  return null;
}

/**
 * Whether `next` may take the stage. Nothing is cut off before it has been
 * up long enough to read: the coach would let a move cut in on a line about
 * a thing at once. A move (the catch) may take over once the line up now
 * has been read, or the player has moved on from it, since it is needed
 * now. A line about a thing waits until nothing is up and play has run at
 * full speed for `REST`, so lessons never run together into one long stop.
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
 * `landing`.
 * @param {number} basketCenter @param {number} landing @param {number} basketWidth
 */
export function onSpot(basketCenter, landing, basketWidth) {
  return Math.abs(basketCenter - landing) <= basketWidth * ON_SPOT;
}

/**
 * Whether the pointer at `x, y` is within `margin` of the slip at `box`:
 * on its way to Continue.
 * @param {Box} box @param {number} x @param {number} y @param {number} [margin]
 */
export function nearSlip(box, x, y, margin = SLIP_NEAR) {
  return x >= box.x0 - margin && x <= box.x1 + margin && y >= box.y0 - margin && y <= box.y1 + margin;
}

/**
 * The basket's wait under the cup, a frame of `dt` real seconds on: it
 * counts while the basket (centred at `at`) is on the spot, has stayed
 * within `SETTLE_PX` of where it came to rest, and the pointer isn't
 * `reaching` for the slip; anything else starts it again from here.
 * Returns the real seconds it has waited.
 * @param {{ for: number, at: number }} wait Carried from frame to frame.
 * @param {number} dt @param {number} at @param {number} spot Where the cup lands.
 * @param {number} basketWidth @param {boolean} [reaching]
 */
export function waitStep(wait, dt, at, spot, basketWidth, reaching = false) {
  if (reaching || !onSpot(at, spot, basketWidth) || Math.abs(at - wait.at) > SETTLE_PX) {
    wait.for = 0;
    wait.at = at;
  } else wait.for += dt;
  return wait.for;
}

/**
 * Whether the player has made the catch's move while play is frozen for
 * it, `age` real seconds in: once the freeze has held `FREEZE_MIN`, the
 * basket has waited under the cup (`waitStep`) for `SETTLE`.
 * @param {number} age @param {number} waited
 */
export function catchMoved(age, waited) {
  return age >= FREEZE_MIN && waited >= SETTLE;
}

/** The ghost basket's run, in px a second: about a hand's speed, so it shows the move as it is made. */
export const GHOST_SPEED = 1000;
/** It waits on the basket this long (seconds) before it sets off, and this long where the cup lands before it runs again. */
const GHOST_WAIT = 0.3;
const GHOST_REST = 0.8;

/**
 * Where the ghost basket's centre is, `seconds` into the catch's freeze: it
 * waits on the basket (`from`), glides to the landing (`to`), waits there,
 * and runs again. `still` (Reduce Motion) keeps it waiting at the landing.
 * @param {number} from @param {number} to @param {number} seconds @param {boolean} [still]
 */
export function ghostAt(from, to, seconds, still = false) {
  if (still) return to;
  const travel = Math.min(0.9, Math.max(0.25, Math.abs(to - from) / GHOST_SPEED));
  const cycle = GHOST_WAIT + travel + GHOST_REST;
  const t = ((seconds % cycle) + cycle) % cycle;
  const p = Math.min(1, Math.max(0, (t - GHOST_WAIT) / travel));
  return from + (to - from) * p * p * (3 - 2 * p);
}

/**
 * @typedef {{ x: number, y: number, t: number, d: number }} FlightPoint
 * A point on a cup's way down: its bottom centre, `t` seconds on (shift
 * time) from where the path starts, `d` pixels along it.
 */

/**
 * The path a cup's bottom centre takes from where it is now down to the
 * catch line, on the same arc the engine planned it on (wall bounces and
 * all): the chalk that shows the first throw where it will come down, and
 * what a slip keeps off. Fills `into`, reusing its points, with a point
 * every `every` seconds of flight or so and the last on the planned
 * landing, and returns it.
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

// --- Where the slip goes ---------------------------------------------------

/**
 * @typedef {{ x0: number, y0: number, x1: number, y1: number }} Box
 * @typedef {Box & { weight: number }} KeepOff A box the slip keeps off; `weight` says how much covering it costs.
 * @typedef {"left" | "right" | "above" | "below"} Side
 * @typedef {object} Place
 * What the Coach is given: the anchor (viewport px), the side, and the
 * marks' half sizes, which also set how far from the anchor the slip sits.
 * @property {number} x
 * @property {number} y
 * @property {Side} side
 * @property {number} [ring]
 * @property {number} [width]
 * @property {number} [height]
 * @typedef {{ w: number, h: number }} Size The slip as measured.
 * @typedef {{ width: number, height: number, top: number }} View The viewport, and the Coach's `top` (the slip stays under the tickets).
 */

/** Px of page the slip keeps clear round each thing. */
export const SLIP_CLEAR = 8;
/** Covering the basket, its way, a cup or its landing costs this much per px² more than crossing a cup's way down. */
const HARD = 1000;
/** The Coach's margin from the page's edge. */
const GUTTER = 16;
/** The slip climbs above the basket's row in steps this tall, when nothing beside it is clear. */
const CLIMB = 40;
const CLIMBS = 9;

/**
 * Where Coach.svelte puts a slip of `size` for `place` on `view`, by its
 * own arithmetic: beside the anchor, clear of its marks, falling back to
 * the other side and then above or below when a side won't fit, and kept on
 * screen. `where` is the side it ends up on.
 * @param {Place} place @param {Size} size @param {View} view
 * @returns {Box & { where: Side }}
 */
export function slipBox(place, size, view) {
  const { x: ax, y: ay, ring = 0, width = 0, height = 0 } = place;
  const { w, h } = size;
  const loopW = Math.max(ring * 2.3, width > 0 ? (width + 6) * 2 : 0);
  const loopH = Math.max(ring * 1.75, height > 0 ? (height + 4) * 2 : 0);
  const marked = ring > 0 || width > 0;
  const gx = (marked ? Math.max(ring * 0.8, loopW / 2, width) : 6) + 14;
  const gy = (marked ? Math.max(ring * 0.8, loopH / 2) : 6) + 14;
  /** @param {Side} where */
  const fits = (where) => {
    if (where === "left") return ax - gx - w >= GUTTER;
    if (where === "right") return ax + gx + w <= view.width - GUTTER;
    if (where === "above") return ay - gy - h >= view.top;
    return ay + gy + h <= view.height - GUTTER;
  };
  let where = place.side;
  if (w > 0 && h > 0 && (where === "left" || where === "right") && !fits(where)) {
    /** @type {Side[]} */
    const order = [where === "left" ? "right" : "left", "above", "below"];
    where = order.find(fits) ?? place.side;
  }
  let left = ax - w / 2;
  let top = ay - h / 2;
  if (where === "above") top = ay - gy - h;
  if (where === "below") top = ay + gy;
  if (where === "left") left = ax - gx - w;
  if (where === "right") left = ax + gx;
  left = Math.max(GUTTER, Math.min(view.width - GUTTER - w, left));
  top = Math.max(view.top, Math.min(view.height - GUTTER - h, top));
  return { x0: left, y0: top, x1: left + w, y1: top + h, where };
}

/** @param {Box} a @param {Box} b */
const overlapArea = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/**
 * What covering `keepOff` costs a slip at `box`: 0 when it covers nothing.
 * @param {Box} box @param {readonly KeepOff[]} keepOff
 */
export function coverCost(box, keepOff) {
  let cost = 0;
  for (const thing of keepOff) cost += overlapArea(box, thing) * thing.weight;
  return cost;
}

/**
 * The first of `places` (best first) whose slip covers nothing in
 * `keepOff` and lands on the side it asks for; if none is clear, the one
 * that covers least, a cup's way down before anything else.
 * @param {readonly Place[]} places @param {readonly KeepOff[]} keepOff @param {Size} size @param {View} view
 */
export function choosePlace(places, keepOff, size, view) {
  let best = places[0];
  let least = Infinity;
  for (const place of places) {
    const box = slipBox(place, size, view);
    if (box.where !== place.side) continue;
    const cost = coverCost(box, keepOff);
    if (cost === 0) return place;
    if (cost < least) {
      least = cost;
      best = place;
    }
  }
  return best;
}

/**
 * @param {KeepOff[]} into @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {number} weight
 */
function keep(into, x0, y0, x1, y1, weight) {
  into.push({ x0: x0 - SLIP_CLEAR, y0: y0 - SLIP_CLEAR, x1: x1 + SLIP_CLEAR, y1: y1 + SLIP_CLEAR, weight });
}

/**
 * @typedef {object} CupMarks
 * A cup the slip keeps off.
 * @property {Box | null} box The cup where it is (null: it has landed).
 * @property {ReadonlyArray<{ x: number, y: number }>} arc Its way down: bottom-centre points, as `flightPath` gives them.
 * @property {Box} landing The basket's box where it lands.
 */

/**
 * Everything a slip keeps off, into `into` (emptied first): the basket; its
 * way along its row to `toward` (where it has to be next), if any; any
 * other `things` (a link); and for each cup, the cup, where it lands, and
 * its way down (`sprite` is its size).
 * @param {{ basket: Box, toward?: Box | null, cups?: readonly CupMarks[], things?: readonly Box[], sprite: { width: number, height: number } }} scene
 * @param {KeepOff[]} [into]
 */
export function keepOff({ basket, toward = null, cups = [], things = [], sprite }, into = []) {
  into.length = 0;
  keep(into, basket.x0, basket.y0, basket.x1, basket.y1, HARD);
  if (toward) keep(into, Math.min(basket.x0, toward.x0), basket.y0, Math.max(basket.x1, toward.x1), basket.y1, HARD);
  for (const thing of things) keep(into, thing.x0, thing.y0, thing.x1, thing.y1, HARD);
  const half = sprite.width / 2;
  for (const cup of cups) {
    if (cup.box) keep(into, cup.box.x0, cup.box.y0, cup.box.x1, cup.box.y1, HARD);
    keep(into, cup.landing.x0, cup.landing.y0, cup.landing.x1, cup.landing.y1, HARD);
    for (const point of cup.arc) keep(into, point.x - half, point.y - sprite.height, point.x + half, point.y, 1);
  }
  return into;
}

/** @param {Side} side @returns {Side} */
const opposite = (side) => (side === "left" ? "right" : side === "right" ? "left" : side === "above" ? "below" : "above");
/** @param {Box} box */
const middle = (box) => (box.x0 + box.x1) / 2;

/**
 * Places above a row (`over`), a step higher each time, centred at each of
 * `xs` in turn: the anchor sits just under the slip, toward the row.
 * @param {Place[]} into @param {number} over @param {number[]} xs
 */
function climbing(into, over, xs) {
  for (let step = 0; step < CLIMBS; step++) {
    // The Coach sets an unmarked slip 20px above its anchor.
    const y = over - SLIP_CLEAR - step * CLIMB + 20;
    for (const x of xs) into.push({ x, y, side: "above" });
  }
  return into;
}

/**
 * Where the catch's slip may go, best first. Beside the ghost basket on
 * its far side from the real one, so the hand's way there stays clear;
 * beside the real basket on its other side, away from the move; then above
 * the row, a step higher each time, over those same two places, over the
 * basket and over the page's middle.
 * @param {Box} basket The basket where it is.
 * @param {Box} ghost The basket where the cup lands.
 * @param {Size} size @param {View} view
 * @returns {Place[]}
 */
export function catchPlaces(basket, ghost, size, view) {
  const row = (basket.y0 + basket.y1) / 2;
  const from = middle(basket);
  const to = middle(ghost);
  /** @type {Side} */
  const far = to > from || (to === from && to < view.width / 2) ? "right" : "left";
  const out = far === "right" ? 1 : -1;
  const ghostEdge = far === "right" ? ghost.x1 + 2 : ghost.x0 - 2;
  const basketEdge = far === "right" ? basket.x0 - 2 : basket.x1 + 2;
  /** @type {Place[]} */
  const places = [
    { x: ghostEdge, y: row, side: far },
    { x: basketEdge, y: row, side: opposite(far) },
  ];
  const reach = size.w / 2 + 20;
  return climbing(places, basket.y0, [ghostEdge + out * reach, basketEdge - out * reach, from, view.width / 2]);
}

/**
 * Where a slip about a cup in the air may go, best first: beside it on the
 * side it is flying away from (its way down is ahead of it), beside it on
 * the other, above it, below it; then, where none of those is clear (a cup
 * near the page's edge, rising), further out on each side and further up,
 * a step at a time. Those further places have no `ring` (the Coach's
 * corners would stretch to the gap): their `width` or `height` alone keeps
 * the slip clear, and the game marks the cup itself.
 * @param {{ x: number, y: number }} cup Its centre.
 * @param {number} vx Its sideways speed.
 * @param {number} ring Half the size of the marks round it.
 * @param {View} view
 * @returns {Place[]}
 */
export function cupPlaces(cup, vx, ring, view) {
  /** @type {Side} */
  const behind = vx > 0 ? "left" : vx < 0 ? "right" : cup.x < view.width / 2 ? "right" : "left";
  const { x, y } = cup;
  /** @type {Place[]} */
  const places = [
    { x, y, side: behind, ring },
    { x, y, side: opposite(behind), ring },
    { x, y, side: "above", ring },
    { x, y, side: "below", ring },
  ];
  for (let step = 1; step <= CLIMBS; step++) {
    const out = ring * 1.15 + step * CLIMB;
    places.push(
      { x, y, side: behind, width: out },
      { x, y, side: opposite(behind), width: out },
      // (A width marks it, so the Coach keeps the slip clear by its height.)
      { x, y, side: "above", width: 1, height: ring + step * CLIMB },
    );
  }
  return places;
}

/**
 * Where a slip about the basket may go, best first: beside it on the side
 * away from `toward` (the centre of where it has to be next; null: toward
 * the page's middle), beside it on the other, then above it, a step higher
 * each time.
 * @param {Box} basket @param {number | null} toward @param {View} view
 * @returns {Place[]}
 */
export function basketPlaces(basket, toward, view) {
  const center = middle(basket);
  const row = (basket.y0 + basket.y1) / 2;
  /** @type {Side} */
  const away = toward === null ? (center < view.width / 2 ? "right" : "left") : toward > center ? "left" : "right";
  const out = away === "right" ? 1 : -1;
  /** @type {Place[]} */
  const places = [
    { x: away === "right" ? basket.x1 + 2 : basket.x0 - 2, y: row, side: away },
    { x: away === "right" ? basket.x0 - 2 : basket.x1 + 2, y: row, side: opposite(away) },
  ];
  const aside = basket.x1 - center + 160;
  return climbing(places, basket.y0, [center, center + out * aside, center - out * aside, view.width / 2, view.width / 4, (view.width * 3) / 4]);
}

/**
 * Where a slip about a link may go, best first: beside it toward the
 * page's middle, beside it on the other side, then above it, then below.
 * @param {{ x: number, y: number }} link Its centre.
 * @param {number} ring @param {number} width Half the link's width.
 * @param {View} view
 * @returns {Place[]}
 */
export function linkPlaces(link, ring, width, view) {
  /** @type {Side} */
  const inward = link.x < view.width / 2 ? "right" : "left";
  return [
    { x: link.x, y: link.y, side: inward, ring, width },
    { x: link.x, y: link.y, side: opposite(inward), ring, width },
    { x: link.x, y: link.y, side: "above", ring, width },
    { x: link.x, y: link.y, side: "below", ring, width },
  ];
}
