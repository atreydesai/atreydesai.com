// Spill's straw gauge, drawn into the kitchen: a dark chip on the scene's
// own pixel grid, the same family as the lesson callout and sugar rush's
// tea-and-sugar meter, set into the counter between the Pour and Clear keys.
// It holds a pixel straw, pink and cream stripes, that shortens from the
// right as straw is spent: what is left, then the straw being drawn now
// (dithered, since it is not down yet), then each straw down at what it
// cost, as a faint outline. Over the straw it prints "straw" and the figure
// left in the arcade's pixel alphabet; under a fifth it says "low" as well
// (and the straw goes coral), and "out" in place of the figure once none is
// left, so the state is never colour alone.
//
// DOM-free, so the layout and the reading can be checked with node; the
// component paints it, in cells of `unit` CSS px.

import { GLYPHS, wordWidth } from "./orders-labels.js";

/** Cells of chip round the contents, on every side. */
export const GAUGE_PAD = 2;
/** The stepped corner, in cells. */
export const GAUGE_CUT = 1;
/** Rows a word or a figure stands. */
export const LABEL_ROWS = 5;
/** Rows between the words and the straw. */
const TEXT_GAP = 2;
/** Rows the straw stands. */
export const TUBE_ROWS = 3;
/** Rows the whole chip stands. */
export const GAUGE_ROWS = GAUGE_PAD * 2 + LABEL_ROWS + TEXT_GAP + TUBE_ROWS;

/**
 * Figures, three cells wide so a changing number keeps its width (the
 * arcade's numbers are tabular), five rows tall like the alphabet's tallest
 * letters.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const DIGITS = Object.freeze({
  0: [".#.", "#.#", "#.#", "#.#", ".#."],
  1: [".#.", "##.", ".#.", ".#.", "###"],
  2: ["##.", "..#", ".#.", "#..", "###"],
  3: ["##.", "..#", ".#.", "..#", "##."],
  4: ["#.#", "#.#", "###", "..#", "..#"],
  5: ["###", "#..", "##.", "..#", "##."],
  6: [".##", "#..", "##.", "#.#", ".#."],
  7: ["###", "..#", ".#.", ".#.", ".#."],
  8: [".#.", "#.#", ".#.", "#.#", ".#."],
  9: [".#.", "#.#", ".##", "..#", "##."],
});

/** Room budgets stay under a thousand units, so the figure is at most three digits. */
export const FIGURE_DIGITS = 3;

/** Cells a figure of `digits` digits takes across, a cell between them. @param {number} digits */
export const figureWidth = (digits) => Math.max(0, digits * 4 - 1);

/** The words the gauge prints. */
export const WORDS = Object.freeze({ label: "straw", low: "low", out: "out" });

/** Cells between the words on the top line. */
const WORD_GAP = 2;

/**
 * The narrowest chip, in cells, that still fits the whole top line:
 * "straw", then "low" and the widest figure (or "out") at the right.
 */
export const MIN_COLUMNS =
  GAUGE_PAD * 2 +
  wordWidth(WORDS.label) +
  WORD_GAP +
  wordWidth(WORDS.low) +
  WORD_GAP +
  Math.max(figureWidth(FIGURE_DIGITS), wordWidth(WORDS.out));

/**
 * Where everything sits in a chip `columns` cells wide, in cells from its
 * top left: the label at the left of the top line, the figure ending at
 * `right`, and the straw across the bottom.
 * @param {number} columns
 */
export function gaugeLayout(columns) {
  const width = Math.max(MIN_COLUMNS, Math.floor(columns));
  return {
    width,
    height: GAUGE_ROWS,
    label: { x: GAUGE_PAD, y: GAUGE_PAD },
    right: width - GAUGE_PAD,
    tube: { x: GAUGE_PAD, y: GAUGE_PAD + LABEL_ROWS + TEXT_GAP, w: width - GAUGE_PAD * 2, h: TUBE_ROWS },
  };
}

/**
 * The cell size, and how many columns, a chip gets in a box `width` × `height`
 * CSS px: as big as the box's height allows, from `largest` down, but never
 * so big that the top line no longer fits across. Null when even the
 * smallest cell won't fit.
 * @param {number} width
 * @param {number} height
 * @param {readonly number[]} [units] cell sizes to try, largest first
 */
export function gaugeFit(width, height, units = [4, 3]) {
  for (const unit of units) {
    if (GAUGE_ROWS * unit > height + 0.5) continue;
    const columns = Math.floor((width + 0.5) / unit);
    if (columns >= MIN_COLUMNS) return { unit, columns };
  }
  return null;
}

/**
 * What the gauge reads: straw left (the stroke being drawn already counted
 * against it), the figure it prints, and its state: "low" under `lowShare`
 * of the room's straw, "out" once less than half a unit is left.
 * @param {number} budget the room's straw
 * @param {number} used straw in the straws down
 * @param {number} draft straw in the stroke being drawn
 * @param {number} lowShare
 */
export function gaugeReading(budget, used, draft, lowShare) {
  const left = Math.max(0, budget - used - draft);
  const share = budget > 0 ? Math.min(1, left / budget) : 0;
  const state = left < 0.5 ? "out" : share < lowShare ? "low" : "ok";
  return { left, share, figure: Math.round(left), state };
}

/**
 * The straw's columns: `rest` columns of straw left from the start, the
 * stroke being drawn up to `draftTo`, then each straw down (most recent
 * first) ending at its mark, the last at `length`. Any straw left at all
 * shows at least one column, so the straw is only ever empty when it is out.
 * Fills and returns `out`, so a frame never allocates.
 * @param {number} length columns in the straw
 * @param {number} budget
 * @param {number} left straw left, the draft already taken off
 * @param {number} draft
 * @param {readonly number[]} spent each straw down, most recent first
 * @param {{ rest: number, draftTo: number, marks: number[] }} out
 */
export function tubeColumns(length, budget, left, draft, spent, out) {
  /** @param {number} share */
  const at = (share) => Math.max(0, Math.min(length, Math.round(share * length)));
  const scale = budget > 0 ? 1 / budget : 0;
  let rest = at(left * scale);
  if (left >= 0.5 && rest === 0 && length > 0) rest = 1;
  let draftTo = Math.max(rest, at((left + draft) * scale));
  if (draft >= 0.5 && draftTo === rest && rest < length) draftTo = rest + 1;
  out.rest = rest;
  out.draftTo = draftTo;
  out.marks.length = 0;
  let sum = left + draft;
  let previous = draftTo;
  for (const cost of spent) {
    sum += cost;
    const mark = Math.max(previous, at(sum * scale));
    out.marks.push(mark);
    previous = mark;
  }
  return out;
}

/**
 * The text across the top line, right to left from `right`: the figure (or
 * "out"), and "low" before it while low. Each entry is a word or figure and
 * the cell it starts at.
 * @param {{ figure: number, state: string }} reading
 * @param {number} right the cell the line ends at
 * @returns {Array<{ text: string, x: number, digits: boolean }>}
 */
export function topLine(reading, right) {
  if (reading.state === "out") return [{ text: WORDS.out, x: right - wordWidth(WORDS.out), digits: false }];
  const figure = String(Math.min(999, Math.max(0, reading.figure)));
  const figureX = right - figureWidth(figure.length);
  const line = [{ text: figure, x: figureX, digits: true }];
  if (reading.state === "low") line.push({ text: WORDS.low, x: figureX - WORD_GAP - wordWidth(WORDS.low), digits: false });
  return line;
}

export { GLYPHS, wordWidth };
