// Cup stack rules, kept free of the DOM so they can be tested with node.
//
// Positions and widths are in sprite pixels ("units") measured from the
// tower's center line, so the game plays the same at every screen size; the
// canvas only multiplies by its pixel size.

export const START_WIDTH = 14;
/** How far off (in units) a drop can land and still count as perfect. */
export const PERFECT_TOLERANCE = 0.75;
/** Perfect drops in a row before each cup starts growing back. */
export const GROW_AFTER = 3;
/** How far either side of the tower a cup slides. */
export const TRACK_SPAN = 16;

/** @typedef {{ left: number, width: number }} Span */
/** @typedef {"opening" | "steady" | "rush"} Phase */

/**
 * Slide speed in units per second, rising with the tower.
 * @param {number} height cups stacked so far
 */
export function speedForHeight(height) {
  return Math.min(44, 16 + height * 0.8);
}

/** @param {number} height */
export function phaseForHeight(height) {
  /** @type {Phase} */
  const phase = height < 12 ? "opening" : height < 30 ? "steady" : "rush";
  return phase;
}

/**
 * Drops the sliding cup onto the top of the tower.
 * @param {Span} top the tower's top cup
 * @param {number} left where the sliding cup's left edge is now
 * @returns {{ kind: "perfect" | "cut" | "miss", placed: Span | null, cut: Span | null }}
 */
export function dropCup(top, left) {
  const width = top.width;
  if (Math.abs(left - top.left) <= PERFECT_TOLERANCE) {
    return { kind: "perfect", placed: { left: top.left, width }, cut: null };
  }

  // Snap to the pixel grid so every cup stays crisp.
  const snapped = Math.round(left);
  const from = Math.max(snapped, top.left);
  const to = Math.min(snapped + width, top.left + top.width);
  if (to - from <= 0) {
    return { kind: "miss", placed: null, cut: { left: snapped, width } };
  }

  const cut =
    snapped < top.left
      ? { left: snapped, width: top.left - snapped }
      : { left: top.left + top.width, width: snapped + width - (top.left + top.width) };
  return { kind: "cut", placed: { left: from, width: to - from }, cut };
}

/**
 * After enough perfect drops in a row, each cup grows back a unit.
 * @param {number} width
 * @param {number} streak perfect drops in a row, including this one
 */
export function widthAfterPerfect(width, streak) {
  return streak >= GROW_AFTER ? Math.min(START_WIDTH, width + 1) : width;
}

/**
 * The range the sliding cup's left edge travels, kept on screen.
 * @param {Span} top
 * @param {number} halfScreen half the screen width, in units
 */
export function trackFor(top, halfScreen) {
  const min = Math.max(top.left - TRACK_SPAN, -halfScreen + 1);
  const max = Math.min(top.left + TRACK_SPAN, halfScreen - top.width - 1);
  return max > min ? { min, max } : { min: top.left, max: top.left };
}

/**
 * Advances a ping-pong slide.
 * @param {number} position
 * @param {1 | -1} direction
 * @param {number} distance units to travel this step
 * @param {{ min: number, max: number }} track
 * @returns {{ position: number, direction: 1 | -1 }}
 */
export function stepSlide(position, direction, distance, track) {
  let next = position + direction * distance;
  /** @type {1 | -1} */
  let heading = direction;
  const span = track.max - track.min;
  if (span <= 0) return { position: track.min, direction: heading };
  // Fold any overshoot back into the track, however large the step.
  while (next > track.max || next < track.min) {
    if (next > track.max) {
      next = track.max - (next - track.max);
      heading = -1;
    } else {
      next = track.min + (track.min - next);
      heading = 1;
    }
  }
  return { position: next, direction: heading };
}
