/**
 * The four promotions' pixel icons: 16x16 cells with an ink outline and
 * flat fills from the game's palette, drawn as lists of rectangles
 * [x, y, w, h, colour] so they scale to whole multiples on a tile.
 */
const P = {
  ink: "#2b1f20",
  paper: "#fbf2e8",
  paper2: "#e9d4ac",
  line: "#b9a07f",
  red: "#c9462f",
  red2: "#e0664d",
  ochre: "#dba84d",
  teal: "#6e9c95",
  wood: "#b07a52",
  glass: "#cfe3e0",
  tea: "#9a6a4a",
};

export type Cell = readonly [number, number, number, number, string];

export const PROMOTION_ICONS: Record<string, readonly Cell[]> = {
  flyers: [
    [6, 1, 9, 12, P.ink], [7, 2, 7, 10, P.paper2], [9, 4, 4, 1, P.line], [9, 6, 4, 1, P.line],
    [1, 3, 10, 12, P.ink], [2, 4, 8, 10, P.paper], [2, 4, 8, 2, P.red], [3, 7, 6, 1, P.line], [3, 9, 6, 1, P.line], [3, 11, 4, 1, P.line],
  ],
  radio: [
    [8, 0, 1, 1, P.ochre], [9, 1, 1, 1, P.ink], [10, 2, 1, 1, P.ink], [11, 3, 1, 1, P.ink], [4, 4, 8, 1, P.ink],
    [1, 5, 14, 9, P.ink], [2, 6, 12, 7, P.red], [2, 6, 12, 1, P.red2],
    [3, 8, 5, 4, P.ink], [4, 8, 1, 1, P.paper2], [6, 8, 1, 1, P.paper2], [5, 9, 1, 1, P.paper2], [4, 10, 1, 1, P.paper2], [6, 10, 1, 1, P.paper2], [5, 11, 1, 1, P.paper2],
    [9, 8, 4, 2, P.paper], [11, 8, 1, 2, P.red], [9, 11, 1, 1, P.ochre], [12, 11, 1, 1, P.ochre],
  ],
  loyalty: [
    [1, 3, 14, 11, P.ink], [2, 4, 12, 9, P.paper], [2, 4, 12, 2, P.teal],
    [3, 8, 2, 2, P.red], [6, 8, 2, 2, P.red], [9, 8, 2, 2, P.red], [12, 8, 1, 2, P.line], [3, 11, 5, 1, P.line],
  ],
  display: [
    [1, 0, 14, 4, P.ink], [2, 1, 2, 2, P.red], [4, 1, 2, 2, P.paper], [6, 1, 2, 2, P.red], [8, 1, 2, 2, P.paper], [10, 1, 2, 2, P.red], [12, 1, 2, 2, P.paper],
    [2, 4, 1, 1, P.red], [6, 4, 1, 1, P.red], [10, 4, 1, 1, P.red],
    [2, 4, 12, 11, P.ink], [3, 5, 10, 8, P.glass], [4, 6, 1, 3, P.paper], [5, 6, 1, 1, P.paper],
    [8, 5, 1, 2, P.ink], [6, 7, 4, 5, P.ink], [7, 8, 2, 3, P.paper], [7, 8, 2, 1, P.tea],
    [1, 13, 14, 2, P.ink], [2, 13, 12, 1, P.wood],
  ],
};
