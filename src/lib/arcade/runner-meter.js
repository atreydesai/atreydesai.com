// Sugar rush's tea and sugar, drawn into the scene: a dark chip on the
// scene's own pixel grid, the same family as the lesson callout, holding a
// pixel cup whose tea drains and ten sugar cubes the pearls fill. It sits
// low and under the runner, where the eye already is, the cup beside its
// word and the cubes in a row. On a phone, between the slide and jump pads,
// it stands taller instead: the word beside the cup and the cubes under
// both, in two rows of five.
//
// DOM-free, so the layout and the readings can be checked with node; the
// component paints it, in cells of `unit` CSS px.

import { GLYPHS, wordWidth } from "./orders-labels.js";

/** Cells of chip round the contents, on every side. */
export const METER_PAD = 2;
/** The stepped corner, in cells. */
export const METER_CUT = 1;
/** Cells between the cup and the sugar beside it, and between the cup and the cubes under it. */
const CUP_GAP = 3;
const STACK_GAP = 2;
/** Rows a label stands (the printed alphabet's height). */
export const LABEL_ROWS = 5;
/** A cube's side, and the cells between cubes. */
export const CUBE = 5;
const CUBE_GAP = 1;
export const CUBES = 10;

/**
 * The cup, the arcade's boba icon at nine by eleven: O outline, S straw
 * (through the lid's dome), a digit the tea row it is (1 the bottom, 6 the
 * top), b a pearl sat in the tea.
 */
export const METER_CUP = [
  "......SS.",
  ".....SS..",
  "..OOSOO..",
  "OOOOOOOOO",
  ".O66666O.",
  ".O55555O.",
  ".O44444O.",
  ".O33333O.",
  ".O22b22O.",
  ".Ob1b1bO.",
  "..OOOOO..",
];
const TEA_ROWS = 6;

/** A full sugar cube: h its lit edges, f its face, s its shaded edges. */
export const CUBE_FULL = ["hhhhf", "hfffs", "hfffs", "hfffs", "fssss"];
/** An empty cube's place: an outline only, so full and empty differ by more than colour. */
export const CUBE_EMPTY = ["eeeee", "e...e", "e...e", "e...e", "eeeee"];

/** The X key, printed on a cream keycap with a shaded foot. */
export const KEYCAP_X = ["ccccc", "cxcxc", "ccxcc", "cxcxc", "sssss"];

/**
 * Where everything sits, in cells from the chip's top left. One row (wide
 * screens): the cup, then the word over a row of ten cubes. `twoRows`
 * stands it up for the room between a phone's pads: the cup with the word
 * beside its foot, and the cubes under both in two rows of five. `sugar` is
 * the word and the cubes together where they make one block clear of the
 * cup, else the cubes alone (`label` is the word's own box).
 * @param {boolean} twoRows
 */
export function meterLayout(twoRows) {
  const perRow = twoRows ? CUBES / 2 : CUBES;
  const cubesW = perRow * CUBE + (perRow - 1) * CUBE_GAP;
  const rows = twoRows ? 2 : 1;
  const cubesH = rows * CUBE + (rows - 1) * CUBE_GAP;
  const cupW = METER_CUP[0].length;
  const cupH = METER_CUP.length;
  const labelW = Math.max(wordWidth("sugar"), wordWidth("rush"));
  /** @type {Array<{ x: number, y: number }>} */
  const cubes = [];
  /** @param {number} x0 @param {number} y0 */
  const lay = (x0, y0) => {
    for (let index = 0; index < CUBES; index++) {
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      cubes.push({ x: x0 + col * (CUBE + CUBE_GAP), y: y0 + row * (CUBE + CUBE_GAP) });
    }
  };
  if (twoRows) {
    // The word sits beside the cup's foot, flush with the cubes' right edge.
    const innerW = Math.max(cubesW, cupW + 1 + labelW);
    const cubesY = METER_PAD + cupH + STACK_GAP;
    const label = { x: METER_PAD + innerW - labelW, y: METER_PAD + cupH - LABEL_ROWS };
    lay(METER_PAD, cubesY);
    const cubeBox = { x: METER_PAD, y: cubesY, w: cubesW, h: cubesH };
    return {
      width: METER_PAD * 2 + innerW,
      height: METER_PAD * 2 + cupH + STACK_GAP + cubesH,
      cup: { x: METER_PAD, y: METER_PAD, w: cupW, h: cupH },
      label,
      labelBox: { x: label.x, y: label.y, w: labelW, h: LABEL_ROWS },
      sugar: cubeBox,
      cubes,
    };
  }
  const labelGap = 2;
  const cubesTop = LABEL_ROWS + labelGap;
  const columnH = cubesTop + cubesH;
  const innerH = Math.max(cupH, columnH);
  const sugarX = METER_PAD + cupW + CUP_GAP;
  const label = { x: sugarX, y: METER_PAD + innerH - columnH };
  lay(sugarX, METER_PAD + (innerH - columnH) + cubesTop);
  return {
    width: sugarX + cubesW + METER_PAD,
    height: METER_PAD * 2 + innerH,
    cup: { x: METER_PAD, y: METER_PAD + innerH - cupH, w: cupW, h: cupH },
    label,
    labelBox: { x: label.x, y: label.y, w: labelW, h: LABEL_ROWS },
    sugar: { x: sugarX, y: METER_PAD + innerH - columnH, w: cubesW, h: columnH },
    cubes,
  };
}

/**
 * The tea shown, in half rows (0..12): an odd count dithers the top row. Any
 * tea at all shows at least a half row, so the cup is only ever empty when
 * the tea is.
 * @param {number} fraction 0..1
 */
export function teaHalfRows(fraction) {
  if (!(fraction > 0)) return 0;
  return Math.max(1, Math.min(TEA_ROWS * 2, Math.ceil(fraction * TEA_ROWS * 2 - 1e-9)));
}

/**
 * Each tea cell's place along its own row, counted from the row's first tea
 * cell (pearls and the outline skipped), so a half row can light every other.
 * @type {number[][]}
 */
const TEA_INDEX = METER_CUP.map((line) => {
  let seen = 0;
  return [...line].map((ch) => (/[1-6]/.test(ch) ? seen++ : -1));
});

/**
 * Whether the tea cell at `row`, `col` of the cup is tea with `halfRows`
 * shown: whole rows up to the level, and in a half row every other cell
 * from its first, so even the one-cell bottom row shows any tea at all.
 * @param {number} halfRows from teaHalfRows
 * @param {number} row
 * @param {number} col
 */
export function teaCellLit(halfRows, row, col) {
  const level = Number(METER_CUP[row]?.[col]);
  if (!(level >= 1)) return false;
  const rows = halfRows >> 1;
  if (level <= rows) return true;
  return level === rows + 1 && halfRows % 2 === 1 && TEA_INDEX[row][col] % 2 === 0;
}

/**
 * What the sugar reads: how many cubes are full, and whether a rush is
 * ready or running. A rush empties the cubes as it runs.
 * @param {{ sugar: number, rush: number }} state
 * @param {number} full the sugar a rush needs
 * @param {number} rushTime a rush's seconds
 */
export function sugarReading(state, full, rushTime) {
  const rushing = state.rush > 0;
  const ready = !rushing && state.sugar >= full;
  const cubes = rushing
    ? Math.min(CUBES, Math.ceil((state.rush / rushTime) * CUBES))
    : Math.min(CUBES, Math.floor((state.sugar / full) * CUBES + 1e-9));
  return { cubes, ready, rushing };
}

/**
 * The label over the cubes: "sugar", or "rush" when a rush is ready or running.
 * @param {boolean} rushy
 */
export function meterWord(rushy) {
  return rushy ? "rush" : "sugar";
}

export { GLYPHS, wordWidth };
