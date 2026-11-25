// Cup stack's lessons: what the tower teaches, and when. Each is taught the
// first time it matters on this device, beside the tower, never up in the
// tickets and never over the row the cup slides in, whose edges are what a
// drop is judged by.
//
// What it teaches: the first cup, over a dithered ghost of itself sitting
// exactly where a perfect drop lands; the first slice; the first perfect; a
// streak one perfect short of growing the cup back; and the personal best's
// line as it comes down toward the tower.
//
// In normal, each is an explanation: the game eases into slow motion
// (EXPLAIN_SLOW) while it is up, and holds there until the player presses
// Continue (Enter, or the slip's button) or drops. In expert everything stays
// at full speed: its perfect window is the narrowest the game allows, and its
// board must never get a slower cup. There a line is up just long enough to
// read. In both, the slice the trim line names falls slowly while it is named.
//
// DOM-free: the component asks these after each drop and each frame, and
// hands the answer to the shared coach (src/lib/arcade/core/coach.ts), which
// shows one lesson at a time and remembers them.

import { damp } from "./core/math.ts";
import { NORMAL, widthAfterPerfect } from "./stack-engine.js";

/** @typedef {import("./stack-engine.js").Rules} Rules */
/** @typedef {import("./stack-engine.js").Span} Span */
/** @typedef {import("./stack-engine.js").DropKind} DropKind */
/** @typedef {import("./core/coach.ts").Coach} Coach */
/** @typedef {import("./core/coach.ts").Lesson} Lesson */

/** Normal: the game's speed, as a share, while an explanation is up. */
export const EXPLAIN_SLOW = 0.25;
/** Normal: an explanation holds this long at most (real seconds) without Continue or a drop. */
export const EXPLAIN_SECONDS = 7;

const first = { id: "first", text: "Drop the cup when it covers the ghost.", keys: ["Space"], touch: "tap", minLife: 0.6, move: true };
const trim = { id: "trim", text: "Whatever hangs over the edge is cut off." };
const perfect = { id: "perfect", text: "A perfect drop keeps the cup whole." };
const grow = { id: "grow", text: "One more perfect drop grows the cup back." };
const best = { id: "best", text: "Stack past this line to beat your best." };

/**
 * The best line is due for a cup or two at most (a best of one, only on the
 * first), so it outranks a line about a drop, which comes round again; a
 * move (the first cup) still outranks it, and it waits its turn.
 */
const BEST_PRIORITY = 1.5;

/** Normal: each one slows the game and holds until Continue or a drop. */
const explain = { slow: EXPLAIN_SLOW, life: EXPLAIN_SECONDS, minLife: 1.2 };

/**
 * Normal's lessons: one short full sentence each, eight words or fewer. The
 * regrowth line never runs out on its own in the coach (`life: Infinity`):
 * it is learned only when the promised perfect grows the cup, or on
 * Continue, and its window (`growWindow`) takes it down unlearned.
 * @type {Readonly<Record<string, Lesson>>}
 */
export const LESSONS = Object.freeze({
  first: { ...first, slow: EXPLAIN_SLOW, life: Infinity },
  trim: { ...trim, ...explain },
  perfect: { ...perfect, ...explain },
  grow: { ...grow, ...explain, life: Infinity },
  best: { ...best, ...explain, priority: BEST_PRIORITY },
});

/** Expert: a line at full speed, up just long enough to read. */
const atSpeed = { slow: 1, life: 2.4, minLife: 1.4 };

/** Expert's lessons: the same lines, the same ghost, and never a slower cup. @type {Readonly<Record<string, Lesson>>} */
export const EXPERT_LESSONS = Object.freeze({
  first: { ...first, slow: 1, life: Infinity },
  trim: { ...trim, ...atSpeed },
  perfect: { ...perfect, ...atSpeed },
  grow: { ...grow, ...atSpeed, life: Infinity },
  best: { ...best, slow: 1, life: 3, minLife: 1.6, priority: BEST_PRIORITY },
});

/**
 * The lessons for a mode.
 * @param {Rules} [rules]
 */
export function lessonsFor(rules = NORMAL) {
  return rules.expert ? EXPERT_LESSONS : LESSONS;
}

/**
 * How long the regrowth line stays up without a drop (real seconds): as long
 * as any explanation in normal, a reading's worth in expert. Past it, it
 * comes down unlearned.
 * @param {Rules} [rules]
 */
export function growWindow(rules = NORMAL) {
  return rules.expert ? 3 : EXPLAIN_SECONDS;
}

/**
 * The first cup's lesson never runs out on its own in the coach either (it
 * is a move: learned when a cup lands). Past this many real seconds without
 * a drop it comes down unlearned, so slow motion is never indefinite.
 */
export const FIRST_SECONDS = EXPLAIN_SECONDS;

/**
 * The first cup's lesson, while the tower is just the tray and the device
 * hasn't yet landed a cup with it: slowed in normal, at speed in expert.
 * @param {number} height cups stacked so far
 * @param {(id: string) => boolean} learned
 * @param {Rules} [rules]
 * @returns {Lesson | null}
 */
export function firstCupLesson(height, learned, rules = NORMAL) {
  return height === 0 && !learned("first") ? lessonsFor(rules).first : null;
}

/**
 * Where the first cup's ghost sits: exactly where a perfect drop lands, the
 * sliding cup centred on what it lands on. Cups and the tray are an even
 * number of units wide, so this is always a whole unit.
 * @param {Span} top the tray (or the tower's top cup)
 * @param {number} width the sliding cup's width
 * @returns {Span}
 */
export function ghostSpan(top, width) {
  return { left: top.left + (top.width - width) / 2, width };
}

/**
 * Whether the next perfect drop would grow the cup back a unit: the streak
 * has reached the rules' count, and the cup is narrower than a fresh one.
 * @param {number} width the tower's top cup's width
 * @param {number} streak perfect drops in a row so far
 * @param {Rules} [rules]
 */
export function nextPerfectGrows(width, streak, rules = NORMAL) {
  return widthAfterPerfect(width, streak + 1, rules) > width;
}

/**
 * What a drop's outcome teaches, if the device still needs it: the first
 * slice, the first perfect, or a streak one perfect short of growing the cup
 * back (only when that perfect really would). At most one per drop.
 * @param {{ kind: DropKind, streak: number, width: number }} drop
 *   `streak`: perfect drops in a row, counting this one; `width`: the
 *   tower's top cup's width after it.
 * @param {(id: string) => boolean} learned
 * @param {Rules} [rules]
 * @returns {Lesson | null}
 */
export function lessonForDrop({ kind, streak, width }, learned, rules = NORMAL) {
  const set = lessonsFor(rules);
  if (kind === "cut") return learned("trim") ? null : set.trim;
  if (kind !== "perfect") return null;
  if (!learned("perfect")) return set.perfect;
  if (!learned("grow") && nextPerfectGrows(width, streak, rules)) return set.grow;
  return null;
}

// --- Where the callouts fit ---------------------------------------------------------
//
// A callout must never cover the rows a drop is judged by: the row the cup
// slides in and the tower's top cup. The coach places its slip a fixed gap
// from the anchor on the side asked for, then clamps it onto the screen, so
// these reckon with the slip as measured (it wraps on a narrow screen, and a
// Continue button can wrap under the line) and with the row wherever the
// camera is taking it.

/** A slip not yet measured is reckoned at most this big (px): two lines and a Continue button. */
export const SLIP_GUESS = Object.freeze({ w: 320, h: 96 });
/** The coach's gap from its anchor with no loop, its screen gutter, and its gap under `top`, px. */
const CALLOUT_GAP = 20;
const SCREEN_GUTTER = 16;
const UNDER_TICKETS = 8;

/**
 * @typedef {{
 *   rowTop: number, settledTop: number, rowH: number, playTop: number,
 *   viewW: number, viewH: number, towerX: number, towerHalf: number,
 *   slipW: number, slipH: number
 * }} Stage
 * The screen around the tower, px: the sliding row's top now and once the
 * camera has caught up, a row's height, the bottom of the tickets, the
 * screen, the tower top's centre and half its width, and the slip's size.
 */
/**
 * @typedef {{
 *   side: "above" | "below" | "left" | "right", x: number, y: number,
 *   width: number, top: number, squeezed: boolean
 * }} Placement
 * The coach's anchor, side and `width` (the gap kept to the side), the
 * `top` it keeps the slip under, and `squeezed` when nothing fitted and the
 * slip goes over the tickets instead.
 */

/**
 * Where the slip lands for a placement, as the coach works it out.
 * @param {Placement} at
 * @param {Stage} g
 */
export function slipBox(at, g) {
  const horizontal = at.side === "left" || at.side === "right";
  const gap = horizontal && at.width > 0 ? at.width + 6 + 14 : CALLOUT_GAP;
  let left = at.x - g.slipW / 2;
  let top = at.y - g.slipH / 2;
  if (at.side === "above") top = at.y - gap - g.slipH;
  if (at.side === "below") top = at.y + gap;
  if (at.side === "left") left = at.x - gap - g.slipW;
  if (at.side === "right") left = at.x + gap;
  const minTop = at.top + UNDER_TICKETS;
  left = Math.max(SCREEN_GUTTER, Math.min(g.viewW - SCREEN_GUTTER - g.slipW, left));
  top = Math.max(minTop, Math.min(g.viewH - SCREEN_GUTTER - g.slipH, top));
  return { left, top, right: left + g.slipW, bottom: top + g.slipH };
}

/**
 * The callout for a lesson about the tower, clear of the judged rows from
 * where the row is now to where it settles: over the sliding row (open
 * sky); else under the tower's top cup; else beside the top cup, under the
 * sliding row; else, on a play area too short for any of them, over the
 * sliding row with the slip allowed up over the tickets (`squeezed`).
 * @param {Stage} g
 * @returns {Placement}
 */
export function towerCallout(g) {
  const hi = Math.min(g.rowTop, g.settledTop);
  const lo = Math.max(g.rowTop, g.settledTop);
  const minTop = g.playTop + UNDER_TICKETS;
  const floor = g.viewH - SCREEN_GUTTER;
  const x = g.towerX;
  if (hi - 2 - CALLOUT_GAP - g.slipH >= minTop) {
    return { side: "above", x, y: g.rowTop - 2, width: 0, top: g.playTop, squeezed: false };
  }
  if (lo + 2 * g.rowH + 2 + CALLOUT_GAP + g.slipH <= floor) {
    return { side: "below", x, y: g.rowTop + 2 * g.rowH + 2, width: 0, top: g.playTop, squeezed: false };
  }
  if (lo + g.rowH + 4 + g.slipH <= floor) {
    const width = g.towerHalf + 4;
    const reach = width + 6 + 14 + g.slipW;
    const y = g.rowTop + g.rowH + 4 + g.slipH / 2;
    if (x + reach <= g.viewW - SCREEN_GUTTER) return { side: "right", x, y, width, top: g.playTop, squeezed: false };
    if (x - reach >= SCREEN_GUTTER) return { side: "left", x, y, width, top: g.playTop, squeezed: false };
  }
  return { side: "above", x, y: g.rowTop - 2, width: 0, top: 0, squeezed: true };
}

/**
 * The best line's callout: on the line, right of the tower (its label is on
 * the left), sitting just above it, while the line is at or above the
 * sliding row and the slip fits under the tickets; otherwise wherever a
 * lesson about the tower goes. Line and row move together with the camera.
 * @param {Stage} g
 * @param {number} line the line's screen y
 * @returns {Placement}
 */
export function bestCallout(g, line) {
  const width = g.towerHalf + 4;
  const fitsAbove = line <= g.rowTop && line - 3 - g.slipH >= g.playTop + UNDER_TICKETS;
  if (fitsAbove && g.towerX + width + 20 + g.slipW <= g.viewW - SCREEN_GUTTER) {
    return { side: "right", x: g.towerX, y: line - 3 - g.slipH / 2, width, top: g.playTop, squeezed: false };
  }
  return towerCallout(g);
}

// --- The slice --------------------------------------------------------------------

/** How a cut-off slice falls, in screen px: thrown up at `lift` px/s, then `gravity` px/s². */
export const SLICE_FALL = Object.freeze({ lift: 80, gravity: 2200 });
/**
 * The slice its line names falls at this share of real speed, in both modes:
 * in expert the game itself keeps its speed, and in normal this is a little
 * slower than the game's slow motion, so on a short screen the slice is still
 * in view once its line has been read.
 */
export const SLICE_SLOW = 0.15;
/** How quickly the slice eases into that slow fall (per second, for `damp`). */
export const SLICE_EASE = 12;

/**
 * How far (px, down) a named slice falls in `seconds` of real time, stepped
 * exactly as the component steps it.
 * @param {number} seconds
 * @param {number} [dt]
 */
export function sliceFall(seconds, dt = 1 / 60) {
  const slow = SLICE_SLOW;
  const ease = SLICE_EASE;
  let scale = 1;
  let vy = -SLICE_FALL.lift;
  let y = 0;
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    scale = damp(scale, slow, ease, dt);
    const step = dt * scale;
    vy += SLICE_FALL.gravity * step;
    y += vy * step;
  }
  return y;
}

/**
 * Whether a slip `slipH` tall fits under a slice whose bottom is at
 * `sliceBottom` (px), on a screen `viewH` tall, after it has fallen for
 * `seconds` more.
 * @param {number} sliceBottom
 * @param {number} viewH
 * @param {number} slipH
 * @param {number} [seconds]
 */
export function roomUnderSlice(sliceBottom, viewH, slipH, seconds = 0) {
  const fall = seconds > 0 ? sliceFall(seconds) : 0;
  return sliceBottom + fall + 4 + CALLOUT_GAP + slipH + SCREEN_GUTTER <= viewH;
}

// --- In order, around the coach ------------------------------------------------------

/** A line about a drop waits at most this long (real seconds) for the coach to be free, then goes stale. */
export const PENDING_SECONDS = 1.2;

/**
 * The tower's lessons kept in order around the shared coach, which shows
 * one at a time and remembers them:
 *
 * - A run starts with the first cup's lesson, if the device still needs it.
 * - Each lesson is shown at most once a run: one that ran out unlearned (a
 *   time-out, a drop before it was read) waits for a later run, so slow
 *   motion never helps twice in one tower.
 * - `step` ages the lessons in real time and returns the game's seconds:
 *   slowed (normal only) while an explanation is up, eased back after. The
 *   first cup's lesson comes down unlearned after FIRST_SECONDS without a
 *   drop, and the regrowth line after its window.
 * - `proceed` is Continue: the explanation up is learned, and play eases
 *   back to speed. A move skipped this way counts as known.
 * - `afterDrop` retires the first cup's lesson the moment a cup lands
 *   (learned), keeps or takes back the regrowth line, ends any explanation
 *   that was up (learned once it has been up long enough to read), and holds
 *   what this drop teaches until the coach is free. In expert a line runs its
 *   course instead, making way for the next once read. The next drop
 *   replaces what is held, and it goes stale after PENDING_SECONDS.
 * - The regrowth line is learned only when the perfect it promised grows
 *   the cup, or on Continue.
 * - `retire` takes a line down when the thing it names has gone (a slice
 *   off the screen), learned if it was up long enough to read.
 * - `fell` takes everything down uncounted.
 * - The best line is due while the tower hasn't passed it (counted in cups,
 *   so nothing rounds it away) and the component says it can be shown; it
 *   waits its turn, outranks a line about a drop, and is done once passed.
 * @param {Coach} coach
 */
export function createStackLessons(coach) {
  /** @type {Rules} */
  let rules = NORMAL;
  /** @type {Lesson | null} */
  let pending = null;
  let pendingAge = 0;
  /** The top cup's width when the regrowth line was made: the next perfect must beat it. */
  let promised = 0;
  /** Lessons shown this run. */
  const shown = new Set();
  /** @param {string} id */
  const known = (id) => coach.learned(id) || coach.current?.id === id || shown.has(id);
  /** @param {Lesson} lesson */
  const offer = (lesson) => {
    if (shown.has(lesson.id) && coach.current?.id !== lesson.id) return false;
    if (!coach.offer(lesson)) return false;
    shown.add(lesson.id);
    return true;
  };
  /** An explanation is up and holding the game slowed. */
  const explaining = () => {
    const current = coach.current;
    return !!current && !coach.leaving && !coach.acting && (current.slow ?? 1) < 1;
  };

  return {
    /** A line about the last drop, waiting for the coach to be free. */
    get pending() {
      return pending;
    },
    /** The first cup's lesson is up (and its ghost shows). */
    get firstCup() {
      return coach.current?.id === "first" && !coach.leaving;
    },
    /** An explanation is up and holding the game slowed: Continue ends it. */
    get explaining() {
      return explaining();
    },
    /**
     * A fresh run on `next`'s rules. Returns the first cup's lesson when it is taught.
     * @param {Rules} [next]
     */
    begin(next = NORMAL) {
      rules = next;
      coach.reset();
      pending = null;
      pendingAge = 0;
      shown.clear();
      const lesson = firstCupLesson(0, (id) => coach.learned(id), rules);
      return lesson && offer(lesson) ? lesson : null;
    },
    /** Continue: the explanation up is learned, and play eases back to speed. Returns whether there was one. */
    proceed() {
      if (!explaining()) return false;
      coach.done(coach.current?.id);
      return true;
    },
    /**
     * A cup landed. Returns the lesson this drop holds for the coach, if any.
     * @param {{ kind: DropKind, level: number, streak: number, width: number }} drop
     *   `level`: cups stacked before it; `streak`: perfects in a row, counting
     *   it; `width`: the tower's top cup's width after it.
     */
    afterDrop({ kind, level, streak, width }) {
      if (level === 0) {
        // Learned, and taken down at once: its callout never follows cup two.
        coach.done("first");
        if (coach.current?.id === "first") coach.dismiss();
      }
      if (coach.current?.id === "grow" && !coach.leaving) {
        // The line promised the next perfect would grow the cup: it did, or it is no longer true.
        if (kind === "perfect" && width > promised) coach.done("grow");
        else coach.dismiss();
      }
      const lesson = lessonForDrop({ kind, streak, width }, known, rules);
      const current = coach.current;
      if (current && !coach.leaving && !current.move) {
        const read = coach.age >= (current.minLife ?? 0);
        if ((current.slow ?? 1) < 1) {
          // An explanation holds until Continue or a drop: this drop ends it.
          if (read) coach.done(current.id);
          if (!read || lesson) coach.dismiss();
        } else if (lesson && read) {
          coach.done(current.id);
        }
      }
      pending = lesson;
      pendingAge = 0;
      if (lesson?.id === "grow") promised = width;
      if (pending && offer(pending)) pending = null;
      return lesson;
    },
    /**
     * Takes `id` down now, because what it names has gone: learned if it was
     * up long enough to read. A held line of that id is dropped.
     * @param {string} id
     */
    retire(id) {
      if (pending?.id === id) pending = null;
      const current = coach.current;
      if (current?.id !== id) return;
      if (!coach.leaving && coach.age >= (current.minLife ?? 0)) coach.done(id);
      coach.dismiss();
    },
    /** The tower fell: lessons come down uncounted. */
    fell() {
      coach.dismiss();
      pending = null;
    },
    /**
     * Ages the lessons by real seconds, offers what is waiting, and returns
     * the game's seconds for this frame (slowed while an explanation is up).
     * @param {number} realDt the frame's real seconds, uncapped (lessons hold for real time)
     * @param {number} [frameDt] the game's own capped step for this frame
     * @param {{ remaining: number, ready: boolean }} [best]
     *   cups between the tower's top and the best line (0 when level with
     *   it, below 0 once passed), and whether the line can be shown now
     */
    step(realDt, frameDt = realDt, best = undefined) {
      const gameDt = coach.step(realDt, frameDt);
      const current = coach.current;
      if (current && !coach.leaving) {
        if (current.id === "first" && coach.age >= FIRST_SECONDS) coach.dismiss();
        else if (current.id === "grow" && coach.age >= growWindow(rules)) coach.dismiss();
      }
      if (pending) {
        pendingAge += Math.min(Math.max(0, realDt), 0.25);
        if (offer(pending) || coach.learned(pending.id) || pendingAge > PENDING_SECONDS) pending = null;
      }
      if (best) {
        if (coach.current?.id === "best") {
          if (!coach.leaving && best.remaining < 0) coach.done("best");
        } else if (best.remaining >= 0 && best.ready && !known("best")) {
          offer(lessonsFor(rules).best);
        }
      }
      return gameDt;
    },
  };
}
