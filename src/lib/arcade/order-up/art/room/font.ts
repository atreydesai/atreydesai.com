/**
 * A 3 by 5 pixel face for words painted into scenes (a door's STOCK, a
 * board's prices) at the scene's own pixel size. Each glyph is five rows of
 * three bits.
 */
import type { Painter } from "../../../core/painter.ts";

const G: Record<string, number[]> = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7], "0": [7, 5, 5, 5, 7], "1": [2, 6, 2, 2, 7], "2": [6, 1, 2, 4, 7], "3": [6, 1, 2, 1, 6],
  "4": [5, 5, 7, 1, 1], "5": [7, 4, 6, 1, 6], "6": [3, 4, 7, 5, 7], "7": [7, 1, 2, 2, 2], "8": [7, 5, 7, 5, 7],
  "9": [7, 5, 7, 1, 6], ".": [0, 0, 0, 0, 2], ":": [0, 2, 0, 2, 0], "$": [3, 6, 2, 3, 6], "-": [0, 0, 7, 0, 0],
  "!": [2, 2, 2, 0, 2], "'": [2, 2, 0, 0, 0], "&": [2, 5, 2, 5, 3], "+": [0, 2, 7, 2, 0], "/": [1, 1, 2, 4, 4],
  " ": [0, 0, 0, 0, 0],
};

/** Width in pixels of `text` in the small face. */
export const wordWidth = (text: string) => Math.max(0, text.length * 4 - 1);

/** Paints `text` with its top-left at (x, y); `slope` shears it along a wall (0.5 or -0.5 a column). */
export function word(p: Painter, text: string, color: string, x: number, y: number, slope = 0) {
  let cx = 0;
  for (const ch of text.toUpperCase()) {
    const rows = G[ch] ?? G[" "];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++)
        if (rows[r] & (4 >> c)) p.rect(color, x + cx + c, y + r + Math.sign(slope) * Math.floor((cx + c) * Math.abs(slope)), 1, 1);
    cx += 4;
  }
}

// The signs' larger face: 5 by 7, the same letters the shop's painted signs use.
const BIG: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [31, 4, 4, 4, 4, 4, 31], J: [7, 2, 2, 2, 18, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31], " ": [0, 0, 0, 0, 0, 0, 0], "'": [4, 4, 0, 0, 0, 0, 0], "&": [12, 18, 20, 8, 21, 18, 13],
};

export const bigWidth = (text: string) => Math.max(0, text.length * 6 - 1);

/** Paints `text` in the 5 by 7 face with its top-left at (x, y). */
export function bigWord(p: Painter, text: string, color: string, x: number, y: number) {
  let cx = 0;
  for (const ch of text.toUpperCase()) {
    const rows = BIG[ch] ?? BIG[" "];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (rows[r] & (16 >> c)) p.rect(color, x + cx + c, y + r, 1, 1);
    cx += 6;
  }
}
