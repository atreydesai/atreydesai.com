// Sugar rush's lessons: what the run teaches, when, and where the callout
// sits. Each is taught the first time it matters on this device, beside the
// runner or the thing it is about, never up in the tickets, because the eye
// is on the runner. Every lesson pauses play. A move (jump, hold, slide,
// glide, slam) pauses it at the post, the exact moment to make the move,
// while a ghost of the runner runs the move from there in real time; making
// the move both resumes play and makes it. A move made before it is taught
// is never taught. A thing (pearls, a customer, a spare cup, hazard stripes,
// each set piece) is named as it becomes relevant, a moment before the
// runner meets it rather than as it comes into view, and Continue brings
// play back.
//
// DOM-free: the component asks `lessonAhead` each frame and hands the
// answer to the shared coach (src/lib/arcade/core/coach.ts), which shows
// one lesson at a time and remembers them; `placeCallout` says where the
// callout goes so it never covers the runner, the way ahead, or its thing.

import {
  BARREL_H,
  BARREL_SPEED,
  BARREL_W,
  DRONE_H,
  DRONE_SPEED,
  DRONE_W,
  GRAVITY,
  HOLD_TIME,
  MAX_SPARES,
  PIGEON_WARNING,
  SLAM_DRIFT,
  SLAM_SPEED,
  STEAM_PIPE,
  STEAM_PLUME,
  STEP,
  SUGAR_FULL,
  SWING_H,
  SWING_LEN,
  SWING_LOW,
  TERMINAL_FALL,
  cableY,
  clearRange,
  isLethal,
  jumpPath,
  jumpReach,
  letGo,
  speedAt,
  swingReach,
} from "./runner-engine.js";

/**
 * @typedef {{
 *   id: string, text: string, name?: string, keys?: string[], touch?: string,
 *   slow?: number, life?: number, minLife?: number, move?: boolean, priority?: number
 * }} Lesson
 */

/**
 * The pause is asked for this many seconds before the post: the coach eases
 * play to a stop over about this much game time, so it comes to rest on the
 * post (the game holds it there, never past).
 */
export const MOVE_STOP = 0.05;
/** A move this many seconds off holds the stage: nothing else is taught in its run-up, so its pause comes alone. */
export const MOVE_LEAD = 1.05;
/** A move is still taught this many seconds past its post (a frame's slack); any later, it isn't. */
const MOVE_LATE = 0.02;
/** A thing is named this many seconds before the runner meets it: once it matters, not as it comes into view. */
export const THING_LEAD = 0.6;
/** Nor once the runner is this close to it (seconds): too late to be any use. */
const THING_LATEST = 0.15;
/** Pigeons are named while they still sit, just before they take off. */
const PIGEON_LEAD = PIGEON_WARNING + 0.1;
/** The runner's sprite, in world units above its feet (the box the art fills, a little over the engine's). */
export const RUNNER_ART_H = 26;
const RUNNER_ART_HALF = 10;
/** Head room over the roof that the way ahead keeps clear: the runner and a little over. */
const RUN_BAND = 30;

/** Every lesson pauses play: a move until it is made (or Continue), a thing until Continue. */
const move = { slow: 0, life: Infinity, minLife: 0.5, move: true };
const thing = { slow: 0, life: Infinity, minLife: 1.2 };

/** Every lesson: one short full sentence, eight words or fewer. @type {Readonly<Record<string, Lesson>>} */
export const LESSONS = Object.freeze({
  jump: { id: "jump", text: "Jump when you reach the post.", keys: ["Space"], touch: "tap jump", ...move },
  hold: { id: "hold", text: "Hold jump from the post to go higher.", keys: ["Space"], touch: "hold jump", ...move },
  slide: { id: "slide", text: "Slide under it.", keys: ["↓"], touch: "slide", ...move },
  glide: { id: "glide", text: "Keep holding jump to glide down softly.", keys: ["Space"], touch: "hold jump", ...move },
  slam: { id: "slam", text: "Jump, then press down to slam it open.", keys: ["↓"], touch: "slide", ...move },
  rush: {
    id: "rush",
    name: "sugar rush",
    text: "It smashes through anything that costs a cup.",
    keys: ["X"],
    touch: "rush",
    ...thing,
    minLife: 1.4,
    // X (the rush pad) both resumes play and starts the rush, as a move's own key does.
    move: true,
    // Above a thing, below a move, and below a hazard about to be met (it can't smash one).
    priority: 1.5,
  },
  pearls: { id: "pearls", text: "Pearls fill the sugar meter below.", ...thing },
  customer: { id: "customer", text: "Run past the customer to deliver the tea.", ...thing },
  spill: { id: "spill", text: "Hard landings spill tea, which lowers your pay.", ...thing },
  spare: { id: "spare", text: "Grab the spare cup for an extra life.", ...thing },
  golden: { id: "golden", text: "With both spares held, golden cups pay points.", ...thing },
  hazard: { id: "hazard", text: "Hazard stripes end the run, even with spares.", ...thing },
  awning: { id: "awning", text: "Land on the awning to bounce up.", ...thing },
  vent: { id: "vent", text: "Glide over the vent to ride the updraft.", ...thing },
  cable: { id: "cable", text: "Jump to catch the cable and ride it.", ...thing },
  pigeons: { id: "pigeons", text: "Pigeons are harmless and just scatter.", ...thing },
  barrel: { id: "barrel", text: "Barrels roll at you, so hop them.", ...thing },
  drone: { id: "drone", text: "The drone flies in low, so slide under.", ...thing },
  steam: { id: "steam", text: "Steam blows on a beat, so hop between.", ...thing },
  boards: { id: "boards", text: "Rotten boards give way, so keep running.", ...thing },
  swing: { id: "swing", text: "Slide under the swinging sign, or time it.", ...thing },
});

/** The control a lesson's own move is made with: pressing it resumes play and makes the move. */
export const LESSON_CONTROL = Object.freeze(
  /** @type {Record<string, "jump" | "down" | "rush">} */ ({ jump: "jump", hold: "jump", glide: "jump", slide: "down", slam: "down", rush: "rush" }),
);

/** @typedef {"jump" | "down" | "rush"} Control */

/**
 * What the run sees of the controls around a lesson's pause. A press
 * dropped while a lesson holds play (any control but the one it asks for)
 * is kept from the run until that control is let go and pressed again, so
 * a dropped key and its repeats stay out of the input until its next
 * fresh press. Other keys mapped to the same control remain independent. A
 * control let go and pressed again while no step ran (play stopped) is
 * shown to the run as the fresh press it is, though the run last saw it
 * held (the rush's X held before the meter filled, then pressed in its
 * lesson).
 */
export function createLessonGate() {
  /** @type {Set<string>} */
  const acceptedKeys = new Set();
  /** @type {Set<Control>} */
  const letGoSinceStep = new Set();
  return {
    /** Whether to pass this physical key press to the held controls. */
    acceptsKey(/** @type {string} */ source, /** @type {boolean} */ repeat, /** @type {boolean} */ drop) {
      if (!repeat) {
        if (drop) acceptedKeys.delete(source);
        else acceptedKeys.add(source);
      }
      return !drop && acceptedKeys.has(source);
    },
    /** @param {string} source */
    keyUp(source) {
      acceptedKeys.delete(source);
    },
    /** Rearm an engine edge after a release or the fresh press that acts on a lesson. @param {Control} control */
    release(control) {
      letGoSinceStep.add(control);
    },
    /**
     * The input one step should see, given what is held (and pressed) now;
     * call once per step, just before it.
     * @param {{ held: Record<Control, boolean> }} state the run
     * @param {Readonly<Record<Control, boolean>>} input
     */
    filter(state, input) {
      for (const control of letGoSinceStep) if (input[control]) letGo(/** @type {any} */ (state), control);
      letGoSinceStep.clear();
      return input;
    },
    /** A fresh run, or everything let go. */
    clear() {
      acceptedKeys.clear();
      letGoSinceStep.clear();
    },
  };
}

/**
 * @typedef {{
 *   kind: "jump" | "hold" | "slide" | "glide" | "slam",
 *   takeoff: number, top: number, air?: boolean, release?: number,
 *   path: Array<{ x: number, y: number, t: number }>
 * }} GhostMove
 * A ghost of the move, in world units: the post where to make it
 * (`takeoff`, on a roof at `top`; for a move made in the air, `air`, the
 * point in the air and `top` where it comes down) and the path the runner
 * then takes, each point `t` seconds after the move is made. A glide lets
 * go of jump `release` seconds in, to come down on the roof below.
 */

/**
 * @typedef {{
 *   lesson: Lesson, x: number, y: number, size: number, ghost: GhostMove | null,
 *   clear: number, near?: number, item?: any, onRunner?: boolean,
 *   box?: { x0: number, y0: number, x1: number, y1: number }
 * }} LessonCue
 * Where the lesson points: a world point and a rough radius (world units)
 * for the brackets around it. `clear` is the world x past which the runner
 * has gone by it (for a move, made it, still on its feet); `near` is where
 * the runner first meets it; `item` is the thing itself when it moves, so
 * the lesson can follow it; `onRunner` says it is about the runner itself
 * (drawn where the runner is drawn); `box` is its real extent, for the
 * spotlight and for keeping the callout off it.
 */

/** @param {any} item */
const isHop = (item) => item.type === "ac" || item.type === "tank" || item.type === "crate";
/** Anything the runner has to act on, or keep clear of, to get past. @param {any} item */
const needsAction = (item) =>
  isHop(item) ||
  item.type === "clothesline" ||
  item.type === "billboard" ||
  item.type === "barrel" ||
  item.type === "drone" ||
  item.type === "steam" ||
  item.type === "swing" ||
  isLethal(item);
/** @param {any} item */
const isUnder = (item) => item.type === "clothesline" || item.type === "billboard";

/**
 * The jump's path from a take-off, as world points timed from the press.
 * @param {number} takeoff @param {number} top @param {number} speed
 * @param {{ hold?: number, glide?: boolean, until?: number }} [options]
 */
function pathFrom(takeoff, top, speed, options = {}) {
  const points = [{ x: takeoff, y: top, t: 0 }];
  const until = (options.until ?? -60) - 0.5;
  const raw = jumpPath(speed, { hold: options.hold ?? HOLD_TIME, glide: options.glide, until, seconds: 2.2 });
  for (let i = 3; i < raw.length; i += 4) points.push({ x: takeoff + raw[i].x, y: top + raw[i].y, t: raw[i].t });
  const last = raw[raw.length - 1];
  if (last && points[points.length - 1].t < last.t) points.push({ x: takeoff + last.x, y: top + last.y, t: last.t });
  return points;
}

/**
 * A glide off a drop: a full jump held on into the glide, let go in time to
 * come down on the roof below rather than float on past it (the latest such
 * moment, so the glide is as long as it safely can be). Null when even the
 * shortest glide would carry past that roof.
 * @param {number} takeoff @param {number} top @param {number} speed
 * @param {{ x0: number, x1: number, top: number }} below the roof the drop comes down on
 * @returns {null | { path: Array<{ x: number, y: number, t: number }>, release: number }}
 */
function glidePath(takeoff, top, speed, below) {
  const dy = below.top - top;
  const raw = jumpPath(speed, { glide: true, until: dy - 0.5, seconds: 3 });
  /** Where letting go after sample k comes down, and the fall's samples. @param {number} k */
  const fallFrom = (k) => {
    let { x, y, vy, t } = raw[k];
    const tail = [];
    for (let n = 1; y > dy - 0.5 && n < 600; n++) {
      vy = Math.max(-TERMINAL_FALL, vy - GRAVITY * STEP);
      x += speed * STEP;
      y += vy * STEP;
      t += STEP;
      tail.push({ x: takeoff + x, y: top + y, t });
    }
    return { land: takeoff + x, tail };
  };
  const onRoof = (/** @type {number} */ x) => x >= below.x0 + 9 && x <= below.x1 - 16;
  // The glide starts once the jump turns down; try letting go from the last sample back to that.
  const first = raw.findIndex((p) => p.vy < 0);
  if (first < 0) return null;
  for (let k = raw.length - 1; k >= first; k--) {
    const { land, tail } = k === raw.length - 1 ? { land: takeoff + raw[k].x, tail: [] } : fallFrom(k);
    if (!onRoof(land)) continue;
    const points = [{ x: takeoff, y: top, t: 0 }];
    for (let i = 3; i <= k; i += 4) points.push({ x: takeoff + raw[i].x, y: top + raw[i].y, t: raw[i].t });
    for (let i = 3; i < tail.length; i += 4) points.push(tail[i]);
    const last = tail.length ? tail[tail.length - 1] : { x: takeoff + raw[k].x, y: top + raw[k].y, t: raw[k].t };
    if (points[points.length - 1].t < last.t) points.push(last);
    return { path: points, release: raw[k].t };
  }
  return null;
}

/** Each drop's glide, worked out once (the speed barely changes over the run-up to it). */
const glides = new WeakMap();

/**
 * The glide off a drop from a take-off, or null if there is no safe one.
 * @param {any} state @param {any} gap @param {number} takeoff @param {number} top @param {number} speed
 */
function glideFor(state, gap, takeoff, top, speed) {
  const known = glides.get(gap);
  if (known && Math.abs(known.speed - speed) < 2 && Math.abs(known.takeoff - takeoff) < 2) return known.glide;
  const below = roofAt(state, gap.x1 + 1);
  const glide = below ? glidePath(takeoff, top, speed, below) : null;
  glides.set(gap, { speed, takeoff, glide });
  return glide;
}

/**
 * A slam's path from a point in the air straight down onto `top`, drifting
 * on at half speed, as the engine plays it.
 * @param {number} x @param {number} y @param {number} top @param {number} speed
 */
export function slamPath(x, y, top, speed) {
  const points = [{ x, y, t: 0 }];
  const fall = Math.max(0, y - top) / SLAM_SPEED;
  const steps = Math.max(2, Math.ceil(fall / (STEP * 2)));
  for (let k = 1; k <= steps; k++) {
    const t = (fall * k) / steps;
    points.push({ x: x + SLAM_DRIFT * speed * t, y: y - SLAM_SPEED * t, t });
  }
  return points;
}

/**
 * The move the runner is coming up to that the device hasn't learned, if
 * any, within MOVE_LEAD of its post: where the post is, and how to build its
 * cue. A move is taught on plain roof (nothing else to get past first), from
 * a roof the runner is on, except the slam, which is taught in the air over
 * the crates, the moment to press down.
 * @param {any} state a run from newRun()
 * @param {(id: string) => boolean} learned
 * @returns {null | { post: number, make: () => LessonCue }}
 */
export function moveAhead(state, learned) {
  if (state.status !== "running") return null;
  const r = state.runner;
  const v = Math.max(1, r.vx || speedAt(r.x, state.expert));
  const soon = r.x + v * MOVE_LEAD;
  const late = r.x - v * MOVE_LATE;
  /** @type {null | { post: number, make: () => LessonCue }} */
  let found = null;
  /** @param {number} post @param {() => LessonCue} make */
  const offer = (post, make) => {
    if (post < late || post > soon) return;
    if (!found || post < found.post) found = { post, make };
  };
  /**
   * The approach to a take-off is plain roof: no gap opens, and nothing the
   * runner must hop, slide, or keep clear of comes first (a wire walk's live
   * roofs, a crate, a barrel), so the lesson never points past another move.
   */
  const approachClear = (/** @type {number} */ x) =>
    !state.chunks.some(
      (/** @type {any} */ c) =>
        c.gaps.some((/** @type {any} */ g) => g.x1 > r.x && g.x0 < x) ||
        c.items.some((/** @type {any} */ it) => {
          if (!needsAction(it) || it.hit || it.broken) return false;
          const x0 = "x0" in it ? it.x0 : it.x - 10;
          const x1 = "x1" in it ? it.x1 : it.x + 10;
          return x1 > r.x + 2 && x0 < x;
        }),
    );

  for (const chunk of state.chunks) {
    if (chunk.x1 < r.x || chunk.x0 > soon + v) continue;

    for (const gap of chunk.gaps) {
      if (gap.x0 <= r.x || gap.assist === "rail" || !r.grounded) continue;
      const edge = gap.x0;
      const top = topAt(state, edge - 1);
      if (gap.assist === "drop" && learned("jump") && !learned("glide")) {
        const takeoff = edge - 0.12 * v;
        if (!approachClear(takeoff) || takeoff < late || takeoff > soon) continue;
        const glide = glideFor(state, gap, takeoff, top, v);
        if (!glide) continue;
        offer(takeoff, () => ({
          lesson: LESSONS.glide,
          x: takeoff,
          y: top + 30,
          size: 16,
          ghost: { kind: "glide", takeoff, top, path: glide.path, release: glide.release },
          clear: gap.x1 + 8,
          box: { x0: gap.x0, x1: gap.x1, y0: top + (gap.dy ?? 0), y1: top },
        }));
      } else if (!gap.assist) {
        const width = gap.x1 - gap.x0;
        const needsHold = gap.dy > 12 || width > jumpReach(v, gap.dy, STEP) * 0.85;
        const id = !learned("jump") ? "jump" : needsHold && !learned("hold") ? "hold" : null;
        if (!id) continue;
        const takeoff = edge - 0.1 * v;
        if (!approachClear(takeoff)) continue;
        offer(takeoff, () => ({
          lesson: LESSONS[id],
          x: takeoff,
          y: top + 24,
          size: 16,
          ghost: { kind: id, takeoff, top, path: pathFrom(takeoff, top, v, { hold: id === "hold" ? HOLD_TIME : STEP * 4, until: gap.dy }) },
          clear: gap.x1 + 8,
          box: { x0: gap.x0, x1: gap.x1, y0: Math.min(top, top + (gap.dy ?? 0)) - 30, y1: Math.max(top, top + (gap.dy ?? 0)) },
        }));
      }
    }

    for (const item of chunk.items) {
      const it = /** @type {any} */ (item);
      if (!("x0" in it) || it.x0 <= r.x - 20 || it.hit || it.broken) continue;
      const box = { x0: it.x0, x1: it.x1, y0: it.y0 ?? it.y, y1: it.y1 ?? it.y };
      // A slide can be taught in the air (down slams, then slides on landing); a hop only on a roof.
      if (isUnder(item) && !learned("slide")) {
        const takeoff = it.x0 - 0.3 * v;
        if (it.x0 <= r.x || !approachClear(takeoff)) continue;
        offer(takeoff, () => {
          const floor = topAt(state, takeoff);
          // A path in steps, so the ghost slides under rather than jumping to the far side.
          const path = [];
          for (let x = takeoff; x < it.x1 + 8; x += 6) path.push({ x, y: floor, t: (x - takeoff) / v });
          path.push({ x: it.x1 + 8, y: floor, t: (it.x1 + 8 - takeoff) / v });
          return {
            lesson: LESSONS.slide,
            x: (it.x0 + it.x1) / 2,
            y: it.y0 - 1,
            size: Math.max(14, (it.x1 - it.x0) / 2),
            ghost: { kind: "slide", takeoff, top: floor, path },
            clear: it.x1 + 4,
            box,
          };
        });
      } else if (isHop(item)) {
        const roof = topAt(state, it.x0 - 1);
        const height = it.y1 - roof;
        const tall = height > 20;
        const ground = !learned("jump") ? "jump" : tall && !learned("hold") ? "hold" : null;
        if (ground && r.grounded && it.x0 > r.x) {
          const range = clearRange(v, it.x1 - it.x0, height, ground === "jump" && !tall ? STEP * 4 : HOLD_TIME);
          const takeoff = it.x0 - (range ? (range.near + range.far) / 2 : 0.35 * v);
          if (!approachClear(takeoff)) continue;
          offer(takeoff, () => ({
            lesson: LESSONS[ground],
            x: (it.x0 + it.x1) / 2,
            y: it.y1,
            size: Math.max(12, (it.x1 - it.x0) / 2),
            ghost: { kind: ground, takeoff, top: roof, path: pathFrom(takeoff, roof, v, { hold: ground === "hold" || tall ? HOLD_TIME : STEP * 4, until: 0 }) },
            clear: it.x1 + 4,
            box,
          }));
        } else if (!ground && it.type === "crate" && !learned("slam") && !r.grounded && !r.cable && !r.slamming) {
          // Over the crates in a jump: the moment to press down, so the slam
          // comes down on them (it drifts on at half speed as it drops).
          const fall = Math.max(0, r.y - it.y1) / SLAM_SPEED;
          const post = Math.max(it.x0 + 4, (it.x0 + it.x1) / 2 - SLAM_DRIFT * v * fall);
          // Where the runner will be at the post: still well over the crates.
          const dt = Math.max(0, (post - r.x) / v);
          const y = r.y + r.vy * dt - (GRAVITY / 2) * dt * dt;
          if (y < it.y1 + 12 || post + SLAM_DRIFT * v * fall > it.x1 - 2) continue;
          offer(post, () => {
            return {
              lesson: LESSONS.slam,
              x: (it.x0 + it.x1) / 2,
              y: it.y1,
              size: Math.max(12, (it.x1 - it.x0) / 2),
              ghost: { kind: "slam", takeoff: post, top: it.y1, air: true, path: slamPath(post, y, it.y1, v) },
              clear: it.x1 + 4,
              box,
            };
          });
        }
      }
    }
  }
  return found;
}

/**
 * The lesson this moment needs, if the device still needs one: a move at
 * its post, else a hazard, the power-up, or a thing as it becomes relevant.
 * `learned` says what the device already knows; `view` is how many world
 * units of course are on screen ahead of the runner.
 * @param {any} state a run from newRun()
 * @param {(id: string) => boolean} learned
 * @param {{ view: number }} options
 * @returns {LessonCue | null}
 */
export function lessonAhead(state, learned, { view }) {
  if (state.status !== "running") return null;
  const r = state.runner;
  const v = Math.max(1, r.vx || speedAt(r.x, state.expert));
  // A move coming up holds the stage: taught at its post, nothing before it.
  const move = moveAhead(state, learned);
  if (move) return move.post - r.x <= MOVE_STOP * v ? move.make() : null;

  /** @type {{ thing: LessonCue | null, hazard: LessonCue | null, hazardSoon: boolean }} */
  const found = { thing: null, hazard: null, hazardSoon: false };
  /**
   * A thing, by its box (the part of it the brackets go round, never a
   * whole set piece), met at `near` (closing at `closing` units a second)
   * and passed at `clear`. It is named once it is `lead` seconds off, while
   * it is on screen, and not once it is all but met.
   * @param {Lesson} lesson @param {{ x0: number, y0: number, x1: number, y1: number }} box
   * @param {{ near?: number, clear?: number, item?: any, lead?: number, closing?: number }} [extra]
   */
  const offerThing = (lesson, box, extra = {}) => {
    const x = (box.x0 + box.x1) / 2;
    const near = extra.near ?? box.x0;
    const closing = extra.closing ?? v;
    const off = (near - r.x) / closing;
    if (lesson.id === "hazard" && off > 0 && off <= MOVE_LEAD) found.hazardSoon = true;
    if (learned(lesson.id) || off < THING_LATEST || off > (extra.lead ?? THING_LEAD) || x > r.x + view) return;
    /** @type {LessonCue} */
    const cue = {
      lesson,
      x,
      y: (box.y0 + box.y1) / 2,
      size: Math.max(box.x1 - box.x0, box.y1 - box.y0) / 2,
      ghost: null,
      near,
      clear: extra.clear ?? box.x1,
      item: extra.item,
      box,
    };
    if (lesson.id === "hazard") {
      if (!found.hazard || near < (found.hazard.near ?? found.hazard.x)) found.hazard = cue;
    } else if (!found.thing || near < (found.thing.near ?? found.thing.x)) {
      found.thing = cue;
    }
  };
  /** The near end of something long, as much as the brackets go round. @param {number} x0 @param {number} x1 */
  const nearEnd = (x0, x1) => Math.min(x1, x0 + RING_MOST * 2);

  for (const chunk of state.chunks) {
    if (chunk.x1 < r.x || chunk.x0 > r.x + Math.max(view, v * MOVE_LEAD)) continue;
    for (const gap of chunk.gaps) {
      if (gap.assist !== "rail" || gap.x1 <= r.x) continue;
      const top = topAt(state, gap.x0 - 1);
      offerThing(LESSONS.hazard, { x0: gap.x0, x1: nearEnd(gap.x0, gap.x1), y0: top - 40, y1: top }, { clear: gap.x1 });
    }
    for (const item of chunk.items) {
      const it = /** @type {any} */ (item);
      if (isLethal(item)) {
        if ("x0" in it && !it.hit) {
          const y0 = Math.min(it.y0 ?? it.y1, it.y1);
          const y1 = Math.max(it.y0 ?? it.y1, it.y1);
          offerThing(LESSONS.hazard, { x0: it.x0, x1: nearEnd(it.x0, it.x1), y0, y1: Math.max(y1, y0 + 6) }, { clear: it.x1 });
        }
        continue;
      }
      switch (item.type) {
        case "pearl":
          if (!it.taken) offerThing(LESSONS.pearls, { x0: it.x - 6, x1: it.x + 6, y0: it.y - 6, y1: it.y + 6 });
          break;
        case "coaster":
          // The coaster and the customer standing at it.
          if (it.customer && !it.done) offerThing(LESSONS.customer, { x0: it.x0 - 2, x1: it.x1 + 12, y0: it.y, y1: it.y + 34 }, { clear: it.x1 });
          break;
        case "spare":
          if (!it.taken) {
            // Taken off the jump over what it sits at the far end of, so named before that jump.
            const over = state.chunks
              .flatMap((/** @type {any} */ c) => [...c.gaps, ...c.items.filter((/** @type {any} */ o) => isLethal(o) && "x0" in o)])
              .find((/** @type {any} */ o) => o.x0 < it.x && o.x1 > it.x - 60);
            offerThing(state.spare >= MAX_SPARES ? LESSONS.golden : LESSONS.spare, { x0: it.x - 8, x1: it.x + 8, y0: it.y - 9, y1: it.y + 9 }, {
              near: over ? over.x0 - 0.1 * v : it.x - 0.5 * v,
              clear: it.x,
            });
          }
          break;
        case "awning":
          offerThing(LESSONS.awning, { x0: it.x0, x1: it.x1, y0: it.y - 6, y1: it.y + 4 });
          break;
        case "vent":
          // The updraft just past the edge it is jumped from (its ceiling is 110 over that roof).
          offerThing(LESSONS.vent, { x0: it.x0, x1: nearEnd(it.x0, it.x1), y0: it.ceiling - 110, y1: it.ceiling - 40 }, { near: it.x0 - 16, clear: it.x1 });
          break;
        case "cable": {
          // Where the runner catches it, a little past the edge.
          const at = it.x0 + (it.x1 - it.x0) * 0.2;
          const y = cableY(it, at);
          offerThing(LESSONS.cable, { x0: at - 30, x1: at + 30, y0: y - 24, y1: y + 6 }, { near: it.x0, clear: it.x1 });
          break;
        }
        case "pigeon":
          if (it.state === "sit") offerThing(LESSONS.pigeons, { x0: it.x - 6, x1: it.x + 6, y0: it.y, y1: it.y + 8 }, { lead: PIGEON_LEAD, near: it.x });
          break;
        case "barrel":
          // Followed as it rolls, so the line stays on the barrel it named.
          if (it.state === "wait" || it.state === "roll") {
            offerThing(LESSONS.barrel, { x0: it.x - BARREL_W / 2, x1: it.x + BARREL_W / 2, y0: it.y, y1: it.y + BARREL_H }, {
              item: it,
              clear: it.x,
              closing: v + (it.state === "roll" ? BARREL_SPEED : 0),
            });
          }
          break;
        case "drone":
          if (it.state === "wait" || it.state === "fly") {
            offerThing(LESSONS.drone, { x0: it.x - DRONE_W / 2, x1: it.x + DRONE_W / 2, y0: it.y, y1: it.y + DRONE_H }, {
              item: it,
              clear: it.x,
              closing: v + (it.state === "fly" ? DRONE_SPEED : 0),
            });
          }
          break;
        case "steam":
          // The pipe and the plume it blows.
          offerThing(LESSONS.steam, { x0: it.x0 - 3, x1: it.x1 + 3, y0: it.y0, y1: it.y0 + STEAM_PIPE + STEAM_PLUME }, { clear: it.x1 });
          break;
        case "boards":
          if (!it.gone) offerThing(LESSONS.boards, { x0: it.x0, x1: nearEnd(it.x0, it.x1), y0: it.y - 4, y1: it.y + 2 }, { clear: it.x1 });
          break;
        case "swing":
          if (!it.broken) {
            // The sweep of the sign at the height it meets the runner.
            const reach = swingReach(it);
            offerThing(LESSONS.swing, { x0: reach.x0, x1: reach.x1, y0: it.y + SWING_LOW, y1: it.y + SWING_LOW + SWING_H + 12 });
          }
          break;
        default:
          break;
      }
    }
  }
  // A hazard about to be met comes first, then the power-up the moment the
  // meter fills (unless a hazard, which it can't smash, is close), then
  // whatever is about to be met.
  const hazard = found.hazard;
  if (hazard) return { ...hazard, lesson: { ...hazard.lesson, priority: URGENT_HAZARD } };
  if (!learned("rush") && !found.hazardSoon && state.rush === 0 && state.sugar >= SUGAR_FULL && r.grounded) {
    // Named on a plain stretch, so play stops with nothing about to be met.
    const way = wayBetween(state, r.x, r.x + RUSH_CALM * v);
    if (!way.jump && way.low >= r.y - 1 && way.high <= r.y + 1) {
      return { lesson: LESSONS.rush, x: r.x, y: r.y + 10, size: 14, ghost: null, clear: r.x, onRunner: true };
    }
  }
  return found.thing;
}

/** A hazard about to be met: above the power-up and any thing, below a move. */
const URGENT_HAZARD = 1.8;
/** The power-up is named with this many seconds of plain roof ahead. */
const RUSH_CALM = 0.8;

/**
 * The top of the roof under world x, looking through every chunk built (the
 * roof before a gap can sit in the chunk before it).
 * @param {any} state @param {number} x
 */
function topAt(state, x) {
  let best = null;
  let bestDistance = Infinity;
  for (const chunk of state.chunks) {
    for (const roof of chunk.roofs) {
      if (x >= roof.x0 && x <= roof.x1) return roof.top;
      const distance = Math.min(Math.abs(roof.x0 - x), Math.abs(roof.x1 - x));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = roof;
      }
    }
  }
  return best ? best.top : state.runner.y;
}

/**
 * The roof under world x, if any.
 * @param {any} state @param {number} x
 * @returns {null | { x0: number, x1: number, top: number }}
 */
function roofAt(state, x) {
  for (const chunk of state.chunks) {
    for (const roof of chunk.roofs) if (x >= roof.x0 && x <= roof.x1) return roof;
  }
  return null;
}

/**
 * The lowest and highest roof tops between two world x, and whether the way
 * between needs a jump (a gap, or something to get over).
 * @param {any} state @param {number} x0 @param {number} x1
 */
function wayBetween(state, x0, x1) {
  let low = Infinity;
  let high = -Infinity;
  let jump = false;
  for (const chunk of state.chunks) {
    if (chunk.x1 < x0 || chunk.x0 > x1) continue;
    for (const roof of chunk.roofs) {
      if (roof.x1 < x0 || roof.x0 > x1) continue;
      low = Math.min(low, roof.top);
      high = Math.max(high, roof.top);
    }
    if (chunk.gaps.some((/** @type {any} */ g) => g.x1 > x0 && g.x0 < x1)) jump = true;
    if (chunk.items.some((/** @type {any} */ it) => "x0" in it && !it.hit && !it.broken && (isHop(it) || isLethal(it) || it.type === "steam") && it.x1 > x0 && it.x0 < x1)) jump = true;
  }
  if (low === Infinity) low = high = state.runner.y;
  return { low, high, jump };
}

// --- Where the callout goes --------------------------------------------------
//
// The callout (Coach.svelte) is placed beside a point on one of four sides.
// It must never cover the runner, the way the runner is about to go, or the
// thing it names, and it keeps off the meter and the pads. Each lesson
// offers its spots in the order it prefers them; the first whose slip lands
// clear of all of those wins, and failing that, the one that covers least.

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} Box  screen px, y down
 * @typedef {"above" | "below" | "left" | "right"} Side
 * @typedef {{ side: Side, x: number, y: number, ring: number, width: number, height: number }} Spot
 *   asks Coach.svelte for the slip on `side` of the point (x, y), with
 *   brackets round it (none for a ring of 0), stretched round a thing
 *   `width` by `height` px either side of the point, and kept clear of it
 * @typedef {Box & { weight?: number, margin?: number, what?: string }} Keep
 *   something the slip must not cover, how much it matters, and the room kept round it
 */

/** Coach.svelte's margin from the screen's edge, and the accent step printed down and right of its slip. */
const GUTTER = 16;
const STEP_PX = 4;
/** Room kept round everything the slip must not cover (the way ahead keeps none under its roof line). */
const MARGIN = 6;

/** @param {number} v @param {number} lo @param {number} hi */
const clampTo = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.max(lo, v)));

/**
 * The size of the brackets Coach.svelte draws round a spot, and how far its
 * slip keeps from the point, mirrored from its placement.
 * @param {Spot} spot
 */
function reachOf(spot) {
  const { ring, width, height } = spot;
  const loopW = Math.max(ring * 2.3, width > 0 ? (width + 6) * 2 : 0);
  const loopH = Math.max(ring * 1.75, height > 0 ? (height + 4) * 2 : 0);
  const marked = ring > 0 || width > 0;
  const gapX = (marked ? Math.max(ring * 0.8, loopW / 2, width) : 6) + 14;
  const gapY = (marked ? Math.max(ring * 0.8, loopH / 2) : 6) + 14;
  return { loopW, loopH, gapX, gapY };
}

/**
 * Where Coach.svelte puts the slip for a spot, and whether it keeps that
 * side (a slip beside its point that won't fit there is moved elsewhere,
 * so such a spot is never chosen).
 * @param {Spot} spot
 * @param {{ w: number, h: number }} slip its measured size
 * @param {{ w: number, h: number, top: number }} view the screen, and the highest the slip may sit
 */
export function slipBox(spot, slip, view) {
  const { gapX, gapY } = reachOf(spot);
  let left = spot.x - slip.w / 2;
  let top = spot.y - slip.h / 2;
  if (spot.side === "above") top = spot.y - gapY - slip.h;
  if (spot.side === "below") top = spot.y + gapY;
  if (spot.side === "left") left = spot.x - gapX - slip.w;
  if (spot.side === "right") left = spot.x + gapX;
  const keeps =
    spot.side === "left" ? left >= GUTTER : spot.side === "right" ? left + slip.w <= view.w - GUTTER : true;
  left = clampTo(left, GUTTER, view.w - GUTTER - slip.w);
  top = clampTo(top, view.top, view.h - GUTTER - slip.h);
  return { x: Math.round(left), y: Math.round(top), w: slip.w + STEP_PX, h: slip.h + STEP_PX, keeps };
}

/** @param {Box} a @param {Box} b */
function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The first spot whose slip covers none of `keep`, else the one that covers
 * least (by area, weighted).
 * @param {Spot[]} spots in order of preference
 * @param {Keep[]} keep
 * @param {{ w: number, h: number }} slip
 * @param {{ w: number, h: number, top: number }} view
 */
export function chooseSpot(spots, keep, slip, view) {
  /** @type {null | { spot: Spot, box: Box, cost: number }} */
  let best = null;
  for (const spot of spots) {
    const box = slipBox(spot, slip, view);
    if (!box.keeps) continue;
    let cost = 0;
    for (const k of keep) {
      const m = k.margin ?? MARGIN;
      cost += (k.weight ?? 1) * overlap(box, { x: k.x - m, y: k.y - m, w: k.w + m * 2, h: k.h + m * 2 });
    }
    if (cost === 0) return { spot, box, cost };
    if (!best || cost < best.cost) best = { spot, box, cost };
  }
  if (best) return best;
  const spot = spots[spots.length - 1];
  return { spot, box: slipBox(spot, slip, view), cost: Infinity };
}

/**
 * Where the callout for a cue goes, and what it keeps clear of: the runner,
 * the way it is about to go (for a move, the ghost's path from the post to
 * past what it clears; for a thing, the roof from the runner to it), and the
 * thing itself with its brackets, plus anything in `avoid`.
 * @param {LessonCue} cue
 * @param {any} state
 * @param {{ sx: (x: number) => number, sy: (y: number) => number, S: number, runner: { x: number, y: number } }} cam
 *   world to screen px, px per world unit, and where the runner is drawn (world units)
 * @param {{ w: number, h: number }} slip
 * @param {{ w: number, h: number, top: number }} view
 * @param {Box[]} [avoid]
 * @param {Side | null} [side] the side already taken for this lesson: kept while it still fits there
 */
export function placeCallout(cue, state, cam, slip, view, avoid = [], side = null) {
  const { sx, sy, S } = cam;
  const rx = cam.runner.x;
  const ry = cam.runner.y;
  const v = Math.max(1, state.runner.vx || speedAt(rx, state.expert));
  /** A world box on screen. @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 */
  const onScreen = (x0, y0, x1, y1) => ({ x: sx(x0), y: sy(y1), w: (x1 - x0) * S, h: (y1 - y0) * S });
  const runner = onScreen(rx - RUNNER_ART_HALF, ry, rx + RUNNER_ART_HALF, ry + RUNNER_ART_H);
  /** @type {Keep[]} */
  const keep = [{ ...runner, weight: 4, what: "runner" }, ...avoid.map((box) => ({ ...box, what: "hud" }))];
  /** @type {Spot[]} */
  let spots;
  const ghost = cue.ghost;
  const thinMark = 1;
  if (ghost) {
    let high = -Infinity;
    let low = ghost.top;
    for (const p of ghost.path) {
      high = Math.max(high, p.y);
      low = Math.min(low, p.y);
    }
    const end = ghost.path[ghost.path.length - 1];
    const x0 = Math.min(ghost.takeoff, rx) - RUNNER_ART_HALF;
    const x1 = Math.max(cue.clear, end.x) + RUNNER_ART_HALF;
    keep.push({ ...onScreen(x0, low - 4, x1, high + RUNNER_ART_H), weight: 2, what: "way" });
    if (cue.box) keep.push({ ...onScreen(cue.box.x0, cue.box.y0, cue.box.x1, cue.box.y1), weight: 3, what: "thing" });
    const mid = ry + RUNNER_ART_H / 2;
    spots = [
      // Behind the runner, where nothing is coming.
      { side: "left", x: sx(rx), y: sy(mid), ring: 0, width: RUNNER_ART_HALF * S + 2, height: 0 },
      // Over the top of the move.
      { side: "above", x: sx(ghost.air ? rx : ghost.takeoff), y: sy(high + RUNNER_ART_H) - MARGIN, ring: 0, width: thinMark, height: 0 },
      // On the building, under the roof.
      { side: "below", x: sx(ghost.air ? cue.x : rx), y: sy(low - 4) + MARGIN, ring: 0, width: thinMark, height: 0 },
      // Past where it lands.
      { side: "right", x: sx(x1), y: sy(mid), ring: 0, width: thinMark, height: 0 },
    ];
  } else {
    // Brackets snug round the thing (or the runner), and the slip clear of them.
    const onRunner = !!cue.onRunner;
    const b = onRunner
      ? { x0: rx - RUNNER_ART_HALF, x1: rx + RUNNER_ART_HALF, y0: ry, y1: ry + RUNNER_ART_H }
      : (cue.box ?? { x0: cue.x - cue.size, x1: cue.x + cue.size, y0: cue.y - cue.size, y1: cue.y + cue.size });
    const thing = onScreen(b.x0, b.y0, b.x1, b.y1);
    const spot = { x: thing.x + thing.w / 2, y: thing.y + thing.h / 2, ring: BRACKET_MIN, width: thing.w / 2 + 2, height: thing.h / 2 + 2 };
    const { loopW, loopH } = reachOf({ ...spot, side: "above" });
    keep.push({ x: spot.x - loopW / 2, y: spot.y - loopH / 2, w: loopW, h: loopH, weight: 3, what: onRunner ? "runner" : "thing" });
    // The way from the runner to where it meets the thing: the roof and the
    // runner's height over it, and a full jump's height where something on
    // the way needs one.
    const far = onRunner ? rx + THING_LEAD * v : Math.max(rx, cue.near ?? b.x0);
    const way = wayBetween(state, rx, far);
    const apex = way.jump ? jumpApex(v) : 0;
    // Down to the roof line and no further (a slip may sit just under it): the building is no part of the way.
    keep.push({ ...onScreen(rx - RUNNER_ART_HALF, way.low, far + RUNNER_ART_HALF, way.high + RUN_BAND + apex), weight: 2, margin: -4, what: "way" });
    /** @type {Side[]} */
    const order = onRunner ? ["left", "above", "below", "right"] : ["below", "above", "right", "left"];
    spots = order.map((side) => ({ ...spot, side }));
  }
  // Coach.svelte is handed whole pixels: decide on what it will be given.
  spots = spots.map((spot) => ({ ...spot, x: Math.round(spot.x), y: Math.round(spot.y), width: Math.round(spot.width), height: Math.round(spot.height) }));
  const kept = side ? spots.find((spot) => spot.side === side) : null;
  if (kept) {
    const box = slipBox(kept, slip, view);
    if (box.keeps) return { spot: kept, box, cost: 0, keep };
  }
  return { ...chooseSpot(spots, keep, slip, view), keep };
}

/** Brackets go round a thing, never round a whole set piece (a wide gap, a vent): at most this far along it (world units). */
const RING_MOST = 36;
/** The smallest brackets Coach.svelte draws round a thing (px). */
const BRACKET_MIN = 14;

/** How high a full jump rises at a speed (world units). @param {number} speed */
function jumpApex(speed) {
  let apex = 0;
  for (const p of jumpPath(speed, { hold: HOLD_TIME, until: 0, seconds: 1.2 })) apex = Math.max(apex, p.y);
  return apex;
}
