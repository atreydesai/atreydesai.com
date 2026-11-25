// Sugar rush's lessons: what the run teaches, and when. Each is taught the
// first time it matters on this device, beside the runner or the thing it
// is about, never up in the tickets, because the eye is on the runner. A
// move (jump, slide, glide, slam) is taught a second before it is needed:
// play eases into slow motion, a ghost of the runner shows the move from
// where to make it, and play comes back to speed the moment it is made. A
// move made before it is taught is never taught. A thing (pearls, a
// customer, a spare cup, hazard stripes) gets one line saying what it is
// for as it comes into view, with only a little slowing so it can be read.
//
// DOM-free: the component asks `lessonAhead` each frame and hands the
// answer to the shared coach (src/lib/arcade/core/coach.ts), which shows
// one lesson at a time and remembers them.

import {
  BARREL_H,
  DRONE_H,
  HOLD_TIME,
  MAX_SPARES,
  STEP,
  SUGAR_FULL,
  clearRange,
  isLethal,
  jumpPath,
  jumpReach,
  speedAt,
} from "./runner-engine.js";

/**
 * @typedef {{
 *   id: string, text: string, name?: string, keys?: string[], touch?: string,
 *   slow?: number, life?: number, minLife?: number, move?: boolean, priority?: number
 * }} Lesson
 */

/** Seconds ahead a move is taught: about one, as in the games that do it well. */
export const MOVE_LEAD = 1.05;
/** A move isn't taught once its take-off is nearer than this (seconds): too late to help. */
const MOVE_LATEST = 0.22;
/** A hazard about to be met: above the power-up and any thing, below a move. */
const URGENT_HAZARD = 1.8;
/** A thing is introduced once it is this far into view (share of the view ahead). */
const THING_IN_VIEW = 0.8;

const move = { slow: 0.15, life: Infinity, minLife: 0.5, move: true };
/** A thing is named at full speed: slowing for every sighting would drag the opening. */
const thing = { slow: 1, life: 2.6, minLife: 1.5 };

/** Every lesson: one short full sentence, eight words or fewer. @type {Readonly<Record<string, Lesson>>} */
export const LESSONS = Object.freeze({
  jump: { id: "jump", text: "Jump when you reach the post.", keys: ["Space"], touch: "tap jump", ...move },
  hold: { id: "hold", text: "Hold jump from the post to go higher.", keys: ["Space"], touch: "hold jump", ...move, slow: 0.2 },
  slide: { id: "slide", text: "Slide under it.", keys: ["↓"], touch: "slide", ...move },
  glide: { id: "glide", text: "Keep holding jump to glide down softly.", keys: ["Space"], touch: "hold jump", ...move, slow: 0.25 },
  slam: { id: "slam", text: "Jump, then press down to slam it open.", keys: ["↓"], touch: "slide", ...move, slow: 0.3, life: 3.5 },
  rush: {
    id: "rush",
    name: "sugar rush",
    text: "It smashes through anything that costs a cup.",
    keys: ["X"],
    touch: "rush",
    slow: 0.35,
    life: 6,
    minLife: 1.4,
    move: true,
    // Above a thing, below a move, and below a hazard about to be met (it can't smash one).
    priority: 1.5,
  },
  pearls: { id: "pearls", text: "Pearls fill the sugar meter below.", ...thing },
  customer: { id: "customer", text: "Run past the customer to deliver the tea.", ...thing, life: 3 },
  spill: { id: "spill", text: "Hard landings spill tea, which lowers your pay.", life: 3, minLife: 1.6 },
  spare: { id: "spare", text: "Grab the spare cup for an extra life.", ...thing },
  golden: { id: "golden", text: "With both spares held, golden cups pay points.", ...thing },
  hazard: { id: "hazard", text: "Hazard stripes end the run, even with spares.", ...thing, slow: 0.35, life: 3 },
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

/**
 * @typedef {{
 *   kind: "jump" | "hold" | "slide" | "glide" | "slam",
 *   takeoff: number, top: number, path: Array<{ x: number, y: number }>
 * }} GhostMove
 * A ghost of the move, in world units: where to press (`takeoff`, on a roof
 * at `top`) and the path the runner then takes.
 */

/**
 * @typedef {{ lesson: Lesson, x: number, y: number, size: number, ghost: GhostMove | null, clear: number }} LessonCue
 * Where the lesson points: a world point and a rough radius (world units)
 * for the pen loop around it. For a move, `clear` is the world x past which
 * a runner still on its feet has made it.
 */

/** @param {any} item */
const isHop = (item) => item.type === "ac" || item.type === "tank" || item.type === "crate";
/** @param {any} item */
const isUnder = (item) => item.type === "clothesline" || item.type === "billboard";

/**
 * The jump's path from a take-off, as world points.
 * @param {number} takeoff @param {number} top @param {number} speed
 * @param {{ hold?: number, glide?: boolean, until?: number }} [options]
 */
function pathFrom(takeoff, top, speed, options = {}) {
  const points = [{ x: takeoff, y: top }];
  const until = (options.until ?? -60) - 0.5;
  const raw = jumpPath(speed, { hold: options.hold ?? HOLD_TIME, glide: options.glide, until, seconds: 2.2 });
  for (let i = 3; i < raw.length; i += 4) points.push({ x: takeoff + raw[i].x, y: top + raw[i].y });
  return points;
}

/**
 * The lesson this moment needs, if the device still needs one: a move about
 * a second off, else a thing coming into view. `learned` says what the
 * device already knows; `view` is how many world units of course are on
 * screen ahead of the runner.
 * @param {any} state a run from newRun()
 * @param {(id: string) => boolean} learned
 * @param {{ view: number }} options
 * @returns {LessonCue | null}
 */
export function lessonAhead(state, learned, { view }) {
  if (state.status !== "running") return null;
  const r = state.runner;
  const v = Math.max(1, r.vx || speedAt(r.x, state.expert));
  const soon = r.x + v * MOVE_LEAD;
  const latest = r.x + v * MOVE_LATEST;
  const seen = r.x + view * THING_IN_VIEW;
  // Each candidate move is compared by the same thing, where the player
  // meets it, and only the winner builds its ghost.
  /** @type {{ move: null | { at: number, make: () => LessonCue }, thing: LessonCue | null, hazard: LessonCue | null }} */
  const found = { move: null, thing: null, hazard: null };
  /** @param {number} at @param {() => LessonCue} make */
  const offerMove = (at, make) => {
    if (!found.move || at < found.move.at) found.move = { at, make };
  };
  /**
   * A thing at x (its near edge at `near`, where the runner first meets it).
   * @param {Lesson} lesson @param {number} x @param {number} y @param {number} size @param {number} [near]
   */
  const offerThing = (lesson, x, y, size, near = x) => {
    if (learned(lesson.id) || x < r.x + 0.2 * v || x > seen) return;
    const cue = { lesson, x, y, size, ghost: null, clear: near };
    if (lesson.id === "hazard") {
      if (!found.hazard || near < found.hazard.clear) found.hazard = cue;
    } else if (!found.thing || x < found.thing.x) {
      found.thing = cue;
    }
  };
  /** No gap opens between the runner and x: the approach to a take-off is plain roof. */
  const approachClear = (/** @type {number} */ x) => !state.chunks.some((/** @type {any} */ c) => c.gaps.some((/** @type {any} */ g) => g.x1 > r.x && g.x0 < x));

  for (const chunk of state.chunks) {
    if (chunk.x1 < r.x || chunk.x0 > Math.max(soon, seen)) continue;

    for (const gap of chunk.gaps) {
      if (gap.x0 <= r.x) continue;
      const edge = gap.x0;
      const top = topAt(state, edge - 1);
      if (gap.assist === "rail") {
        offerThing(LESSONS.hazard, (gap.x0 + gap.x1) / 2, top - 20, (gap.x1 - gap.x0) / 2, gap.x0);
        continue;
      }
      if (!r.grounded || edge > soon || edge - 4 < latest) continue;
      if (gap.assist === "drop" && learned("jump") && !learned("glide")) {
        const takeoff = edge - 0.12 * v;
        offerMove(edge, () => ({
          lesson: LESSONS.glide,
          x: takeoff,
          y: top + 30,
          size: 16,
          ghost: { kind: "glide", takeoff, top, path: pathFrom(takeoff, top, v, { glide: true, until: gap.dy }) },
          clear: gap.x1 + 8,
        }));
      } else if (!gap.assist) {
        const width = gap.x1 - gap.x0;
        const needsHold = gap.dy > 12 || width > jumpReach(v, gap.dy, STEP) * 0.85;
        const id = !learned("jump") ? "jump" : needsHold && !learned("hold") ? "hold" : null;
        if (!id) continue;
        const takeoff = edge - 0.1 * v;
        offerMove(edge, () => ({
          lesson: LESSONS[id],
          x: takeoff,
          y: top + 24,
          size: 16,
          ghost: { kind: id, takeoff, top, path: pathFrom(takeoff, top, v, { hold: id === "hold" ? HOLD_TIME : STEP * 4, until: gap.dy }) },
          clear: gap.x1 + 8,
        }));
      }
    }

    for (const item of chunk.items) {
      const it = /** @type {any} */ (item);
      if (isLethal(item)) {
        if ("x0" in it) offerThing(LESSONS.hazard, (it.x0 + it.x1) / 2, it.y1 ?? it.y, Math.max(10, (it.x1 - it.x0) / 2), it.x0);
        continue;
      }
      switch (item.type) {
        case "pearl":
          if (!it.taken) offerThing(LESSONS.pearls, it.x, it.y, 10);
          break;
        case "coaster":
          if (it.customer && !it.done) offerThing(LESSONS.customer, (it.x0 + it.x1) / 2, it.y + 16, 16);
          break;
        case "spare":
          if (!it.taken) offerThing(state.spare >= MAX_SPARES ? LESSONS.golden : LESSONS.spare, it.x, it.y, 10);
          break;
        case "awning":
          offerThing(LESSONS.awning, (it.x0 + it.x1) / 2, it.y, (it.x1 - it.x0) / 2);
          break;
        case "vent":
          offerThing(LESSONS.vent, (it.x0 + it.x1) / 2, it.y0 + 20, (it.x1 - it.x0) / 2);
          break;
        case "cable":
          offerThing(LESSONS.cable, it.x0 + (it.x1 - it.x0) * 0.25, it.y0 - (it.y0 - it.y1) * 0.25, 16);
          break;
        case "pigeon":
          if (it.state === "sit") offerThing(LESSONS.pigeons, it.x, it.y + 4, 14);
          break;
        case "barrel":
          if (it.state === "wait") offerThing(LESSONS.barrel, it.x, it.y + BARREL_H / 2, 12);
          break;
        case "drone":
          if (it.state === "wait") offerThing(LESSONS.drone, it.x, it.y + DRONE_H / 2, 12);
          break;
        case "steam":
          offerThing(LESSONS.steam, (it.x0 + it.x1) / 2, it.y1 + 16, 18);
          break;
        case "boards":
          if (!it.gone) offerThing(LESSONS.boards, (it.x0 + it.x1) / 2, it.y, (it.x1 - it.x0) / 2);
          break;
        case "swing":
          if (!it.broken) offerThing(LESSONS.swing, it.x, it.y - it.len, 16);
          break;
        default:
          break;
      }

      // Moves, a second before the thing that needs one.
      // A slide can be taught in the air (down slams, then slides on landing); a hop only on a roof.
      if (!("x0" in it) || it.x0 <= r.x || it.x0 > soon || it.hit || it.broken) continue;
      if (isUnder(item) && !learned("slide")) {
        const takeoff = Math.max(latest, it.x0 - 0.3 * v);
        if (takeoff <= latest + 1 || !approachClear(takeoff)) continue;
        offerMove(it.x0, () => {
          const floor = topAt(state, takeoff);
          // A path in steps, so the ghost slides under rather than jumping to the far side.
          const path = [];
          for (let x = takeoff; x < it.x1 + 8; x += 6) path.push({ x, y: floor });
          path.push({ x: it.x1 + 8, y: floor });
          return {
            lesson: LESSONS.slide,
            x: (it.x0 + it.x1) / 2,
            y: it.y0 - 1,
            size: Math.max(14, (it.x1 - it.x0) / 2),
            ghost: { kind: "slide", takeoff, top: floor, path },
            clear: it.x1 + 4,
          };
        });
      } else if (isHop(item) && r.grounded) {
        const roof = topAt(state, it.x0 - 1);
        const height = it.y1 - roof;
        const tall = height > 20;
        const id = !learned("jump") ? "jump" : tall && !learned("hold") ? "hold" : it.type === "crate" && !learned("slam") ? "slam" : null;
        if (!id) continue;
        const range = clearRange(v, it.x1 - it.x0, height, id === "jump" && !tall ? STEP * 4 : HOLD_TIME);
        const takeoff = it.x0 - (range ? (range.near + range.far) / 2 : 0.35 * v);
        if (takeoff - 2 < latest || !approachClear(takeoff)) continue;
        offerMove(it.x0, () => {
          let path = pathFrom(takeoff, roof, v, { hold: id === "hold" || tall ? HOLD_TIME : STEP * 4, until: 0 });
          if (id === "slam") {
            // Up to just over the crates, then straight down onto them.
            const over = path.findIndex((p) => p.x >= (it.x0 + it.x1) / 2);
            path = path.slice(0, over > 0 ? over + 1 : path.length);
            const lastPoint = path[path.length - 1];
            for (let y = lastPoint.y - 6; y > it.y1; y -= 6) path.push({ x: lastPoint.x + 2, y });
            path.push({ x: lastPoint.x + 2, y: it.y1 });
          }
          return {
            lesson: LESSONS[id],
            x: (it.x0 + it.x1) / 2,
            y: it.y1,
            size: Math.max(12, (it.x1 - it.x0) / 2),
            ghost: { kind: id, takeoff, top: roof, path },
            clear: it.x1 + 4,
          };
        });
      }
    }
  }
  // A move about to be needed comes first, then a hazard about to be met
  // (before the power-up, which can't smash it), then the power-up the
  // moment the meter fills, then whatever is coming into view.
  if (found.move) return found.move.make();
  const hazard = found.hazard;
  if (hazard && hazard.clear < soon) return { ...hazard, lesson: { ...hazard.lesson, priority: URGENT_HAZARD } };
  if (!learned("rush") && state.rush === 0 && state.sugar >= SUGAR_FULL) {
    return { lesson: LESSONS.rush, x: r.x, y: r.y + 10, size: 14, ghost: null, clear: r.x };
  }
  return hazard ?? found.thing;
}

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
