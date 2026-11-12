// Cup stack rules, kept free of the DOM so they can be tested with node.
//
// Positions and widths are in sprite pixels ("units") measured from the
// tower's center line, so the game plays the same at every screen size; the
// canvas only multiplies by its pixel size.

export const START_WIDTH = 14;
/** How far the tray reaches past a full-width cup on each side, in units. */
export const TRAY_MARGIN = 2;
/** How far off (in units) a drop can land and still count as perfect. */
const PERFECT_TOLERANCE = 1.5;
/** Perfect drops in a row before each cup starts growing back. */
export const GROW_AFTER = 3;
/** How far either side of the tower a cup slides. */
const TRACK_SPAN = 16;

/** @typedef {{ left: number, width: number }} Span */
/** @typedef {"opening" | "steady" | "rush"} Phase */

/**
 * Slide speed in units per second, rising with the tower.
 * @param {number} height cups stacked so far
 */
export function speedForHeight(height) {
  return Math.min(40, 15 + height * 0.65);
}

/** @param {number} height */
export function phaseForHeight(height) {
  /** @type {Phase} */
  const phase = height < 12 ? "opening" : height < 30 ? "steady" : "rush";
  return phase;
}

/**
 * The tray the tower stands on: wider than a cup by TRAY_MARGIN each side.
 * This is both what is drawn and what the first drop is judged against.
 * @returns {Span}
 */
export function traySpan() {
  return { left: -START_WIDTH / 2 - TRAY_MARGIN, width: START_WIDTH + TRAY_MARGIN * 2 };
}

/**
 * How wide the next sliding cup is: as wide as what it lands on, but never
 * wider than a fresh cup (the tray is wider than any cup).
 * @param {Span} top
 */
export function sliderWidth(top) {
  return Math.min(top.width, START_WIDTH);
}

/**
 * Where a dropped cup lands on the pixel grid. The slider glides between
 * grid positions, so the landing snaps toward the tower, never away from it:
 * a cup is never cut by more than the eye saw hanging over.
 * @param {Span} top
 * @param {number} left
 * @param {number} [width]
 */
export function snapDrop(top, left, width = sliderWidth(top)) {
  const offset = left + width / 2 - (top.left + top.width / 2);
  return offset > 0 ? Math.floor(left) : Math.ceil(left);
}

/**
 * Drops the sliding cup onto the top of the tower.
 *
 * - "perfect": centred on what it lands on, within the tolerance; snaps to centre.
 * - "clean": not centred, but wholly on what it lands on, so placed whole.
 * - "cut": whatever hangs over is sliced off.
 * - "miss": no overlap at all.
 * @param {Span} top the tower's top cup (or the tray)
 * @param {number} left where the sliding cup's left edge is now
 * @param {number} [width] the sliding cup's width, at most `top.width`
 * @returns {{ kind: "perfect" | "clean" | "cut" | "miss", placed: Span | null, cut: Span | null }}
 */
export function dropCup(top, left, width = sliderWidth(top)) {
  const topRight = top.left + top.width;
  const offset = left + width / 2 - (top.left + top.width / 2);
  if (Math.abs(offset) <= PERFECT_TOLERANCE) {
    const centred = Math.round(top.left + (top.width - width) / 2);
    return { kind: "perfect", placed: { left: centred, width }, cut: null };
  }

  const snapped = snapDrop(top, left, width);
  if (snapped >= top.left && snapped + width <= topRight) {
    return { kind: "clean", placed: { left: snapped, width }, cut: null };
  }

  const from = Math.max(snapped, top.left);
  const to = Math.min(snapped + width, topRight);
  if (to - from <= 0) {
    return { kind: "miss", placed: null, cut: { left: snapped, width } };
  }

  const cut =
    snapped < top.left
      ? { left: snapped, width: top.left - snapped }
      : { left: topRight, width: snapped + width - topRight };
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
 * @param {number} [width] the sliding cup's width
 */
export function trackFor(top, halfScreen, width = sliderWidth(top)) {
  const min = Math.max(top.left - TRACK_SPAN, -halfScreen + 1);
  const max = Math.min(top.left + TRACK_SPAN, halfScreen - width - 1);
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
