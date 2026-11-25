// Cup stack rules, kept free of the DOM so they can be tested with node.
//
// Positions and widths are in sprite pixels ("units") measured from the
// tower's center line, so the game plays the same at every screen size; the
// canvas only multiplies by its pixel size.

/** A fresh cup's width in normal mode. */
export const START_WIDTH = 14;
/** How far the tray reaches past a full-width cup on each side, in units. */
export const TRAY_MARGIN = 2;
/** Perfect drops in a row before cups start growing back, in normal mode. */
export const GROW_AFTER = 3;
/** How far either side of the tower a cup slides. */
const TRACK_SPAN = 16;
/**
 * The frame rate a perfect is promised at: at this rate, every pass of the
 * slide shows at least one frame inside the perfect window.
 */
export const FRAME_RATE = 60;
/** Half the coarsest drawn pixel (4 px a unit, on a phone), in units. */
const HALF_PIXEL = 1 / 8;

/** @typedef {{ left: number, width: number }} Span */
/** @typedef {"opening" | "steady" | "rush"} Phase */
/**
 * How a mode plays.
 * - startWidth: a fresh cup, in units (even, so a centred cup sits on the grid).
 * - speed: units a second at the first cup, added per cup, and the cap.
 * - perfect: the perfect window, in seconds either side of centre, eased
 *   from `start` at the first cup to `end` at `by` cups.
 * - growAfter / growEvery: the perfect in a row that first grows the cup
 *   back a unit, and how many more perfects each growth after that takes.
 * - vary: 0 slides alternate sides at the height's speed; above 0, each cup
 *   comes from either side at the height's speed times 1 ± vary.
 * - phases: the heights where the music turns steady, then rushes.
 * @typedef {{
 *   expert: boolean,
 *   startWidth: number,
 *   speed: { start: number, perCup: number, max: number },
 *   perfect: { start: number, end: number, by: number },
 *   growAfter: number,
 *   growEvery: number,
 *   vary: number,
 *   phases: [number, number],
 * }} Rules
 */

/**
 * Normal's perfect window is 32 ms at the first cup, tightening to 15 ms by
 * 24 cups: a touch wider than it was (30 and 14), so normal plays very
 * slightly easier. The slide's speed is unchanged.
 * @type {Rules}
 */
export const NORMAL = {
  expert: false,
  startWidth: START_WIDTH,
  speed: { start: 15, perCup: 0.65, max: 40 },
  perfect: { start: 0.032, end: 0.015, by: 24 },
  growAfter: GROW_AFTER,
  growEvery: 1,
  vary: 0,
  phases: [12, 30],
};

/**
 * Expert's perfect window is the narrowest the game allows: one frame of the
 * slide and half a pixel (`perfectWindow`'s floor), whatever the height.
 * @type {Rules}
 */
export const EXPERT = {
  expert: true,
  startWidth: 10,
  speed: { start: 22, perCup: 1, max: 44 },
  perfect: { start: 0, end: 0, by: 1 },
  growAfter: 4,
  growEvery: 2,
  vary: 0.2,
  phases: [8, 20],
};

/** @param {boolean} [expert] */
export function rulesFor(expert = false) {
  return expert ? EXPERT : NORMAL;
}

/**
 * The slide's base speed in units per second, rising with the tower.
 * @param {number} height cups stacked so far
 * @param {Rules} [rules]
 */
export function speedForHeight(height, rules = NORMAL) {
  const { start, perCup, max } = rules.speed;
  return Math.min(max, start + height * perCup);
}

/**
 * @param {number} height
 * @param {Rules} [rules]
 */
export function phaseForHeight(height, rules = NORMAL) {
  const [steady, rush] = rules.phases;
  /** @type {Phase} */
  const phase = height < steady ? "opening" : height < rush ? "steady" : "rush";
  return phase;
}

/**
 * A stable 0–1 value for a seed and two integers.
 * @param {number} seed
 * @param {number} a
 * @param {number} b
 */
function hash3(seed, a, b) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(a + 1, 0xc2b2ae35) ^ Math.imul(b + 7, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * How the cup at `height` slides in: which side it starts from and how fast
 * it goes. Normal alternates sides at the height's speed; expert picks the
 * side and the pace afresh for every cup, from the run's seed.
 * @param {number} height cups stacked so far
 * @param {Rules} [rules]
 * @param {number} [seed]
 * @returns {{ fromLeft: boolean, speed: number }}
 */
export function slideFor(height, rules = NORMAL, seed = 0) {
  const base = speedForHeight(height, rules);
  if (rules.vary <= 0) return { fromLeft: height % 2 === 0, speed: base };
  const fromLeft = hash3(seed, height, 1) < 0.5;
  const pace = 1 - rules.vary + 2 * rules.vary * hash3(seed, height, 2);
  return { fromLeft, speed: base * pace };
}

/**
 * How far off centre, in units, a drop may sit and still be perfect. It is
 * a time window (`rules.perfect`) turned into distance at the slide's speed,
 * so it tightens as the tower climbs, but never narrower than one frame of
 * the slide at FRAME_RATE plus half a drawn pixel: a pass can't skip over it.
 * @param {number} height cups stacked so far
 * @param {number} speed this cup's slide speed, units a second
 * @param {Rules} [rules]
 */
export function perfectWindow(height, speed, rules = NORMAL) {
  const { start, end, by } = rules.perfect;
  const t = Math.min(1, Math.max(0, height / by));
  const seconds = start + (end - start) * t;
  return Math.max(speed * seconds, speed / (2 * FRAME_RATE) + HALF_PIXEL);
}

/**
 * The tray the tower stands on: wider than a fresh cup by TRAY_MARGIN each
 * side. This is both what is drawn and what the first drop is judged against.
 * @param {Rules} [rules]
 * @returns {Span}
 */
export function traySpan(rules = NORMAL) {
  return { left: -rules.startWidth / 2 - TRAY_MARGIN, width: rules.startWidth + TRAY_MARGIN * 2 };
}

/**
 * How wide the next sliding cup is: as wide as what it lands on, but never
 * wider than a fresh cup (the tray is wider than any cup).
 * @param {Span} top
 * @param {Rules} [rules]
 */
export function sliderWidth(top, rules = NORMAL) {
  return Math.min(top.width, rules.startWidth);
}

/**
 * Where the sliding cup is drawn: its left edge on the screen's pixel grid,
 * `px` screen pixels to a unit. Judging reads the same position, so a drop
 * is judged exactly where the eye last saw it. Without `px`, as is.
 * @param {number} left
 * @param {number} [px]
 */
export function drawnLeft(left, px) {
  return px ? Math.round(left * px) / px : left;
}

/**
 * Where a dropped cup lands on the unit grid. The slider glides between
 * grid positions, so the landing snaps toward the tower, never away from it:
 * a cup is never cut by more than the eye saw hanging over.
 * @param {Span} top
 * @param {number} left
 * @param {number} [width]
 */
export function snapDrop(top, left, width = Math.min(top.width, START_WIDTH)) {
  const offset = left + width / 2 - (top.left + top.width / 2);
  return offset > 0 ? Math.floor(left) : Math.ceil(left);
}

/**
 * Drops the sliding cup onto the top of the tower.
 *
 * - "perfect": centred on what it lands on, within the window; placed centred.
 * - "close": outside the window but less than a unit off, so it snaps
 *   onto the centre whole; it looks lined up, but it isn't a perfect.
 * - "clean": not centred, but wholly on what it lands on, so placed whole.
 * - "cut": whatever hangs over is sliced off.
 * - "miss": no overlap at all.
 *
 * `options.window` is the perfect window in units (`perfectWindow`), and
 * `options.px` the screen pixels to a unit, so the drop is judged where the
 * cup was drawn (`drawnLeft`). `offset` is how far off centre it was judged.
 * @param {Span} top the tower's top cup (or the tray)
 * @param {number} left where the sliding cup's left edge is now
 * @param {number} [width] the sliding cup's width, at most `top.width`
 * @param {{ window?: number, px?: number }} [options]
 * @returns {{ kind: "perfect" | "close" | "clean" | "cut" | "miss", placed: Span | null, cut: Span | null, offset: number }}
 */
export function dropCup(top, left, width = Math.min(top.width, START_WIDTH), options = {}) {
  const window = options.window ?? perfectWindow(0, speedForHeight(0));
  const seen = drawnLeft(left, options.px);
  const topRight = top.left + top.width;
  const centred = top.left + (top.width - width) / 2;
  const offset = seen - centred;
  if (Math.abs(offset) <= window + 1e-9) {
    return { kind: "perfect", placed: { left: Math.round(centred), width }, cut: null, offset };
  }

  const snapped = snapDrop(top, seen, width);
  if (snapped >= top.left && snapped + width <= topRight) {
    const kind = snapped === centred ? "close" : "clean";
    return { kind, placed: { left: snapped, width }, cut: null, offset };
  }

  const from = Math.max(snapped, top.left);
  const to = Math.min(snapped + width, topRight);
  if (to - from <= 0) {
    return { kind: "miss", placed: null, cut: { left: snapped, width }, offset };
  }

  const cut =
    snapped < top.left
      ? { left: snapped, width: top.left - snapped }
      : { left: topRight, width: snapped + width - topRight };
  return { kind: "cut", placed: { left: from, width: to - from }, cut, offset };
}

/**
 * Perfect drops in a row grow the cup back a unit: first at `growAfter` in
 * a row, then every `growEvery` perfects more, never past a fresh cup.
 * @param {number} width
 * @param {number} streak perfect drops in a row, including this one
 * @param {Rules} [rules]
 */
export function widthAfterPerfect(width, streak, rules = NORMAL) {
  const grows = streak >= rules.growAfter && (streak - rules.growAfter) % rules.growEvery === 0;
  return grows ? Math.min(rules.startWidth, width + 1) : width;
}

/**
 * What a perfect drop leaves on the tower: the placed cup, grown back a
 * unit toward the tray's centre line when the streak calls for it.
 * @param {Span} placed
 * @param {number} streak perfect drops in a row, including this one
 * @param {Rules} [rules]
 * @returns {Span}
 */
export function grownSpan(placed, streak, rules = NORMAL) {
  const width = widthAfterPerfect(placed.width, streak, rules);
  if (width <= placed.width) return placed;
  const growLeft = placed.left + placed.width / 2 > 0;
  return { left: growLeft ? placed.left - 1 : placed.left, width };
}

/**
 * The range the sliding cup's left edge travels, kept on screen.
 * @param {Span} top
 * @param {number} halfScreen half the screen width, in units
 * @param {number} [width] the sliding cup's width
 */
export function trackFor(top, halfScreen, width = Math.min(top.width, START_WIDTH)) {
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

/** @typedef {"perfect" | "close" | "clean" | "cut" | "miss"} DropKind */

/** How each drop shows in a shared run: gold perfect, white whole, orange trimmed, red fell. */
export const SHARE_MARKS = { perfect: "🟨", close: "⬜", clean: "⬜", cut: "🟧", miss: "🟥" };

/**
 * The run as a little tower for the share text: a square per drop in the
 * order dropped, ten to a row, newest row on top, ending on the cup that
 * fell. A tall tower keeps its top `rows` rows.
 * @param {DropKind[]} kinds
 * @param {number} [width]
 * @param {number} [rows]
 */
export function shareTower(kinds, width = 10, rows = 4) {
  const cells = kinds.map((kind) => SHARE_MARKS[kind]);
  /** @type {string[]} */
  const lines = [];
  for (let index = 0; index < cells.length; index += width) lines.push(cells.slice(index, index + width).join(""));
  return lines.slice(-rows).reverse();
}
