// Sugar rush's tea and sugar, drawn into the scene: a dark chip on the
// scene's own pixel grid, the same family as the lesson callout, holding a
// pixel cup whose tea drains and ten sugar cubes the pearls fill. It sits
// low and under the runner, where the eye already is; on touch, between the
// slide and jump pads, the cubes in two rows of five.
//
// DOM-free, so the layout and the readings can be checked with node; the
// component paints it, in cells of `unit` CSS px.

import { GLYPHS, wordWidth } from "./orders-labels.js";

/** Cells of chip round the contents, on every side. */
export const METER_PAD = 2;
/** The stepped corner, in cells. */
export const METER_CUT = 1;
/** Cells between the cup and the sugar. */
const CUP_GAP = 3;
/** Rows a label stands (the printed alphabet's height). */
export const LABEL_ROWS = 5;
/** A cube's side, and the cells between cubes. */
export const CUBE = 3;
const CUBE_GAP = 1;
export const CUBES = 10;

/**
 * The cup, the arcade's boba icon at seven by ten: O outline, S straw, a
 * digit the tea row it is (1 the bottom, 6 the top), b a pearl sat in the tea.
 */
export const METER_CUP = [
  "....S..",
  "...S...",
  "OOOOOOO",
  ".O666O.",
  ".O555O.",
  ".O444O.",
  ".O333O.",
  ".O2b2O.",
  ".Ob1bO.",
  "..OOO..",
];
const TEA_ROWS = 6;

/** A full sugar cube: h its lit corner, f its face, s its shade. */
export const CUBE_FULL = ["hhf", "hff", "ffs"];
/** An empty cube's place: an outline only, so full and empty differ by more than colour. */
export const CUBE_EMPTY = ["eee", "e.e", "eee"];

/** The X key, printed on a cream keycap with a shaded foot. */
export const KEYCAP_X = ["ccccc", "cxcxc", "ccxcc", "cxcxc", "sssss"];

/**
 * Where everything sits, in cells from the chip's top left. `twoRows` lays
 * the cubes out in two rows of five (touch, between the pads).
 * @param {boolean} twoRows
 */
export function meterLayout(twoRows) {
  const perRow = twoRows ? CUBES / 2 : CUBES;
  const cubesW = perRow * CUBE + (perRow - 1) * CUBE_GAP;
  const labelGap = twoRows ? 1 : 2;
  const cubesTop = LABEL_ROWS + labelGap;
  const rows = twoRows ? 2 : 1;
  const columnH = cubesTop + rows * CUBE + (rows - 1) * CUBE_GAP;
  const cupW = METER_CUP[0].length;
  const cupH = METER_CUP.length;
  const innerH = Math.max(cupH, columnH);
  const sugarX = METER_PAD + cupW + CUP_GAP;
  /** @type {Array<{ x: number, y: number }>} */
  const cubes = [];
  for (let index = 0; index < CUBES; index++) {
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    cubes.push({ x: sugarX + col * (CUBE + CUBE_GAP), y: METER_PAD + (innerH - columnH) + cubesTop + row * (CUBE + CUBE_GAP) });
  }
  return {
    width: sugarX + cubesW + METER_PAD,
    height: METER_PAD * 2 + innerH,
    cup: { x: METER_PAD, y: METER_PAD + innerH - cupH, w: cupW, h: cupH },
    label: { x: sugarX, y: METER_PAD + innerH - columnH },
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
