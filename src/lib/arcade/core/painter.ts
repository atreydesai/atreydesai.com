// The arcade's pixel painter: flat colour, joins dithered on the Bayer grid,
// sprite grids set down cell by cell. A Painter only needs `fillRect`, so a
// drawing goes to a canvas, into a `PixelBuffer` to be baked once, or into
// a node test the same way. Polygons fill by scanline at pixel centres, so a
// 2:1 isometric edge steps two pixels a row, the way pixel artists draw it.

import { bayer } from "./dither.ts";

export interface PaintContext {
  fillStyle: unknown;
  globalAlpha: number;
  fillRect(x: number, y: number, w: number, h: number): void;
}

export type Palette = Record<string, string>;

/** A flat list of polygon corners: x0, y0, x1, y1, ... */
export type Points = readonly number[];

export class Painter {
  ctx: PaintContext;
  readonly width: number;
  readonly height: number;
  /** Added to every coordinate: lets a drawing be made at its own origin and set down anywhere. */
  ox = 0;
  oy = 0;

  constructor(ctx: PaintContext, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  /** Draws with the origin moved by (x, y), then puts it back. */
  at(x: number, y: number, paint: () => void) {
    const ox = this.ox;
    const oy = this.oy;
    this.ox += x;
    this.oy += y;
    paint();
    this.ox = ox;
    this.oy = oy;
  }

  rect(color: string, x: number, y: number, w = 1, h = 1) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x + this.ox), Math.round(y + this.oy), Math.round(w), Math.round(h));
  }

  /** Cells of `color` over a rectangle wherever the Bayer threshold is under `amount`. */
  dither(color: string, x: number, y: number, w: number, h: number, amount: number, seedX = 0, seedY = 0) {
    if (amount <= 0) return;
    if (amount >= 1) return this.rect(color, x, y, w, h);
    this.ctx.fillStyle = color;
    const left = Math.round(x + this.ox);
    const top = Math.round(y + this.oy);
    for (let row = 0; row < Math.round(h); row++)
      for (let column = 0; column < Math.round(w); column++)
        if (bayer(column + left + seedX, row + top + seedY) < amount) this.ctx.fillRect(left + column, top + row, 1, 1);
  }

  /** A vertical band from `top` to `bottom` that dithers from one colour into the next. */
  fade(from: string, to: string, x: number, y: number, w: number, h: number, seedY = 0) {
    this.rect(from, x, y, w, h);
    for (let row = 0; row < h; row++) this.dither(to, x, y + row, w, 1, (row + 0.5) / h, 0, seedY);
  }

  oval(color: string, x: number, y: number, rx: number, ry: number) {
    this.ctx.fillStyle = color;
    const cx = Math.round(x + this.ox);
    const cy = Math.round(y + this.oy);
    for (let row = -Math.floor(ry); row <= ry; row++) {
      const dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (row / ry) ** 2)));
      this.ctx.fillRect(cx - dx, cy + row, dx * 2 + 1, 1);
    }
  }

  /** A polygon, filled even-odd at pixel centres (convex or not). */
  poly(color: string, pts: Points) {
    const n = pts.length / 2;
    if (n < 3) return;
    this.ctx.fillStyle = color;
    let top = Infinity;
    let bottom = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      top = Math.min(top, pts[i]);
      bottom = Math.max(bottom, pts[i]);
    }
    const xs: number[] = [];
    for (let y = Math.floor(top); y < Math.ceil(bottom); y++) {
      const cy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2],
          ay = pts[i * 2 + 1];
        const bx = pts[((i + 1) % n) * 2],
          by = pts[((i + 1) % n) * 2 + 1];
        if (ay <= cy ? by > cy : by <= cy) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.ceil(xs[k] - 0.5);
        const x1 = Math.ceil(xs[k + 1] - 0.5);
        if (x1 > x0) this.ctx.fillRect(x0 + this.ox, y + this.oy, x1 - x0, 1);
      }
    }
  }

  /** A one-pixel line (Bresenham). */
  line(color: string, x0: number, y0: number, x1: number, y1: number) {
    this.ctx.fillStyle = color;
    let x = Math.round(x0),
      y = Math.round(y0);
    const tx = Math.round(x1),
      ty = Math.round(y1);
    const dx = Math.abs(tx - x),
      dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1,
      sy = y < ty ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 4096; guard++) {
      this.ctx.fillRect(x + this.ox, y + this.oy, 1, 1);
      if (x === tx && y === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** A sprite grid with its top-left at (x, y), one cell a pixel; runs of a colour are one rect. */
  sprite(grid: readonly string[], palette: Palette, x: number, y: number, flip = false) {
    const left = Math.round(x + this.ox);
    const top = Math.round(y + this.oy);
    for (let row = 0; row < grid.length; row++) {
      const line = flip ? [...grid[row]].reverse().join("") : grid[row];
      let start = 0;
      while (start < line.length) {
        const cell = line[start];
        let end = start + 1;
        while (end < line.length && line[end] === cell) end++;
        const color = palette[cell];
        if (cell !== "." && color) {
          this.ctx.fillStyle = color;
          this.ctx.fillRect(left + start, top + row, end - start, 1);
        }
        start = end;
      }
    }
  }

  /** A sprite's silhouette in one colour, for a cast shadow. */
  shadow(grid: readonly string[], color: string, x: number, y: number) {
    this.ctx.fillStyle = color;
    for (let row = 0; row < grid.length; row++)
      for (let column = 0; column < grid[row].length; column++)
        if (grid[row][column] !== ".") this.ctx.fillRect(Math.round(x + this.ox) + column, Math.round(y + this.oy) + row, 1, 1);
  }

  alpha(value: number, paint: () => void) {
    const before = this.ctx.globalAlpha;
    this.ctx.globalAlpha = value;
    paint();
    this.ctx.globalAlpha = before;
  }
}

/** A stable 0..1 value for an integer position, so seeded detail never shimmers. */
export function noise(x: number, y = 0, seed = 0) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * A sprite grid at half size: each 2 by 2 block becomes the colour most of it
 * is (ink only where the block is mostly ink), so a big sprite reads small.
 */
export function halfGrid(grid: readonly string[], ink = "O"): string[] {
  const out: string[] = [];
  for (let y = 0; y < grid.length; y += 2) {
    let row = "";
    for (let x = 0; x < grid[0].length; x += 2) {
      const cells = [grid[y]?.[x], grid[y]?.[x + 1], grid[y + 1]?.[x], grid[y + 1]?.[x + 1]].filter((c): c is string => !!c);
      const solid = cells.filter((c) => c !== ".");
      if (solid.length < 2) {
        row += ".";
        continue;
      }
      const counts = new Map<string, number>();
      for (const c of solid) counts.set(c, (counts.get(c) ?? 0) + (c === ink ? 0.6 : 1));
      row += [...counts].sort((a, b) => b[1] - a[1])[0][0];
    }
    out.push(row);
  }
  return out;
}
