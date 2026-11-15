// The cup stack demo: a short tower built by a script on the real rules
// (normal mode), so a new player sees a perfect, a trim, a cup growing back,
// and the fall. This file is the script and the autopilot's one decision,
// when to drop, kept free of the DOM so a node test can play it through.
// The component calls the same drop the player's own input calls.

/** @typedef {import("./stack-engine.js").DropKind} DropKind */

/**
 * One cup of the script.
 * - aim: how far off centre (in units) the autopilot means to drop it; a
 *   miss has none (see `demoAim`).
 * - expect: what that drop should come out as; the autopilot waits for a
 *   pass where it does, as a player would, and settles after two more.
 * - pass: the pass over the tower it waits for, from 1, so the caption
 *   has time to be read.
 * - caption: replaces the caption as this cup starts sliding.
 * @typedef {{ aim?: number, expect: DropKind, pass: number, caption?: string }} DemoCup
 */

/** @type {DemoCup[]} */
export const DEMO_SCRIPT = [
  { aim: 0, expect: "perfect", pass: 2, caption: "drop each cup on the last" },
  { aim: 1.6, expect: "cut", pass: 1, caption: "whatever hangs over is sliced off" },
  { aim: -2.4, expect: "cut", pass: 1 },
  { aim: 0, expect: "perfect", pass: 2, caption: "drop it dead centre for a perfect" },
  { aim: 0, expect: "perfect", pass: 1 },
  { aim: 0, expect: "perfect", pass: 1 },
  { aim: 0, expect: "perfect", pass: 2, caption: "perfects in a row grow the cup back" },
  { aim: 0.75, expect: "close", pass: 2, caption: "a hair off lands whole but ends the streak" },
  { aim: -1.5, expect: "cut", pass: 1 },
  { aim: 0, expect: "perfect", pass: 1 },
  { aim: 0, expect: "perfect", pass: 2, caption: "the slide speeds up as the tower climbs" },
  { aim: 2.3, expect: "cut", pass: 1 },
  { aim: 0, expect: "perfect", pass: 1 },
  { expect: "miss", pass: 2, caption: "miss the tower and it falls" },
];

/** Passes past the scripted one before the autopilot takes whatever it gets. */
export const DEMO_PATIENCE = 2;

/** A miss aims past the cup's own width, this far, on the side it can reach. */
const MISS_CLEARANCE = 1.5;

/**
 * Where the autopilot aims this cup, in units off centre. A miss aims just
 * past the cup's width on the side the cup started from, so it can always
 * get there.
 * @param {DemoCup} cup
 * @param {number} width the sliding cup's width
 * @param {boolean} fromLeft
 */
export function demoAim(cup, width, fromLeft) {
  if (cup.expect !== "miss") return cup.aim ?? 0;
  const reach = width + MISS_CLEARANCE;
  return fromLeft ? -reach : reach;
}

/**
 * Whether the autopilot drops on this frame: the cup is at the frame
 * nearest its aim, on the pass the script waits for or later, and the drop
 * would come out as the script expects (or it has waited long enough).
 * @param {DemoCup} cup
 * @param {{ offset: number, aim: number, step: number, pass: number, kind: DropKind }} now
 *   `offset`: where the cup really is, off centre (not rounded to the
 *   pixel, which could step over the aim); `step`: units moved this frame;
 *   `pass`: which pass over the tower this is, from 1; `kind`: the verdict
 *   a drop here would get.
 */
export function demoDropsNow(cup, now) {
  if (now.pass < cup.pass) return false;
  if (Math.abs(now.offset - now.aim) > now.step / 2 + 1e-9) return false;
  return now.kind === cup.expect || now.pass >= cup.pass + DEMO_PATIENCE;
}
