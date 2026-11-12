// The order up demo: one drink made by a script on the real bench, so a new
// player sees every station once before their shift. This file is the
// script and its timings, kept free of the DOM so the numbers are easy to
// adjust and can be checked with node; the component plays it by calling the
// same functions the player's own input calls.

import {
  FILL_LINE,
  ICE_SCOOPS,
  REGULARS,
  SEAL_BAND,
  SEAL_PERIOD,
  SHAKES_NEEDED,
  TOPPINGS,
  ladleAt,
  paceForElapsed,
  stepPour,
} from "./orders-engine.js";

/** @typedef {import("./orders-engine.js").Order} Order */
/** @typedef {import("./orders-engine.js").Regular} Regular */

/**
 * One beat of the script. `wait` is the pause before it starts, in seconds;
 * `caption`, when given, replaces the caption as it starts.
 * - arrive: the guest clips onto the rail.
 * - take: their ticket is pressed.
 * - ice: the ice button is pressed `ICE_SCOOPS[order.ice]` times, `every` apart.
 * - pour: the tap is held until the tea reaches the order's line.
 * - jar: the jar marker moves one jar in `dir`.
 * - drop: the hand is pressed once the ladle is over the middle of the cup.
 * - shake: the hand is pressed `count` times, `every` apart.
 * - seal: the hand is pressed once the needle is in the middle of the band.
 * - receipt: waits for the receipt, then holds it for `hold` seconds.
 * - end: the end card.
 * @typedef {{
 *   act: "arrive" | "take" | "ice" | "pour" | "jar" | "drop" | "shake" | "seal" | "receipt" | "end",
 *   wait: number,
 *   caption?: string,
 *   tap?: number,
 *   dir?: number,
 *   count?: number,
 *   every?: number,
 *   hold?: number,
 * }} DemoStep
 */

/** The demo's guest: a regular, so the card looks like the real thing. */
export const DEMO_REGULAR = /** @type {Regular} */ (REGULARS.find((regular) => regular.name === "pip") ?? REGULARS[0]);

/** @type {Order} */
export const DEMO_ORDER = { tea: "milk", ice: "light", toppings: [{ kind: "pearls", scoops: 1 }] };

/** Long enough that the guest never gets restless and the wait grades well. */
export const DEMO_PATIENCE = 40;

/** The cup and the jar marker start away from where they are needed, so the moves show. */
export const DEMO_START_TAP = 2;
export const DEMO_START_JAR = 2;

/** How long a tapped control shows as pressed. */
export const DEMO_PRESS_SECONDS = 0.2;

/** How close to centre the ladle is when the demo drops, from -1 to 1. */
export const DEMO_DROP_WITHIN = 0.06;

/** How close to the middle of the band the needle is when the demo stamps. */
export const DEMO_SEAL_WITHIN = 0.04;

/** The pour lets go this far below the line, since the stream runs on a frame. */
export const DEMO_POUR_LEAD = 0.008;

/** @type {DemoStep[]} */
export const DEMO_SCRIPT = [
  { act: "arrive", wait: 0.6, caption: "take a ticket" },
  { act: "take", wait: 2.2 },
  { act: "ice", wait: 1.6, caption: "add ice to match the ticket", every: 0.5 },
  { act: "pour", wait: 2.0, caption: "hold the tea's tap, let go at the line", tap: 0 },
  { act: "jar", wait: 1.6, caption: "pick the jar, drop when the ladle is over the cup", dir: -1 },
  { act: "jar", wait: 0.6, dir: -1 },
  { act: "drop", wait: 0.8 },
  { act: "shake", wait: 1.5, caption: "shake", count: SHAKES_NEEDED, every: 0.16 },
  { act: "seal", wait: 1.6, caption: "stamp when the needle is in the band" },
  { act: "receipt", wait: 0, caption: "every step is graded", hold: 2.5 },
  { act: "end", wait: 0.4 },
];

/** The topping the demo's jar steps end on. */
export function demoJarEnd(start = DEMO_START_JAR, script = DEMO_SCRIPT) {
  let index = start;
  for (const step of script) {
    if (step.act === "jar") index = Math.max(0, Math.min(TOPPINGS.length - 1, index + (step.dir ?? 0)));
  }
  return TOPPINGS[index];
}

/** Scoops of ice the demo adds: whatever its order asks for. */
export function demoIceScoops(order = DEMO_ORDER) {
  return ICE_SCOOPS[order.ice];
}

/** Where the demo lets go of the tap. */
export function demoPourTarget(order = DEMO_ORDER) {
  return FILL_LINE[order.ice] - DEMO_POUR_LEAD;
}

/** The middle of the seal band, where the demo stamps. */
export const DEMO_SEAL_AIM = (SEAL_BAND[0] + SEAL_BAND[1]) / 2;

/**
 * Whether a moving value is at its target this frame: within `within` of it,
 * or past it since the last frame (a slow frame can step right over a narrow
 * window).
 * @param {number} previous
 * @param {number} now
 * @param {number} target
 * @param {number} within
 */
export function reachedTarget(previous, now, target, within) {
  if (Math.abs(now - target) <= within) return true;
  return (previous - target) * (now - target) < 0 && Math.abs(now - previous) < 4 * within;
}

/**
 * Roughly how long the script runs, in seconds, with the waits for the ladle
 * and the needle taken at their worst. For checking the timings stay about
 * 20–25 seconds when they are tuned.
 * @param {DemoStep[]} [script]
 * @param {Order} [order]
 */
export function demoSeconds(script = DEMO_SCRIPT, order = DEMO_ORDER) {
  const swing = paceForElapsed(0).swing;
  let low = 0;
  let high = 0;
  for (const step of script) {
    low += step.wait;
    high += step.wait;
    if (step.act === "ice") {
      const span = Math.max(0, demoIceScoops(order) - 1) * (step.every ?? 0);
      low += span;
      high += span;
    } else if (step.act === "pour") {
      const seconds = pourSeconds(demoPourTarget(order));
      low += seconds;
      high += seconds;
    } else if (step.act === "drop") {
      // Up to a full swing before the ladle is back over the cup.
      high += (2 * Math.PI) / swing;
    } else if (step.act === "shake") {
      const span = Math.max(0, (step.count ?? 0) - 1) * (step.every ?? 0);
      low += span;
      high += span;
    } else if (step.act === "seal") {
      high += SEAL_PERIOD;
    } else if (step.act === "receipt") {
      // The serve: the press lands, the straw pops, and the cup hops off.
      low += 0.7 + (step.hold ?? 0);
      high += 0.7 + (step.hold ?? 0);
    }
  }
  return { low, high };
}

/**
 * Seconds of holding the tap to reach `target`, stepped like the game.
 * @param {number} target
 */
export function pourSeconds(target, dt = 1 / 60) {
  let level = 0;
  let held = 0;
  while (level < target && held < 10) {
    held += dt;
    level = stepPour(level, held, dt);
  }
  return held;
}

/**
 * Where the ladle will be for the demo's swing, so a test can check that the
 * drop condition is ever met. Same call the bench makes.
 * @param {number} time
 */
export function demoLadle(time) {
  return ladleAt(time, paceForElapsed(0).swing, Math.PI / 2);
}
