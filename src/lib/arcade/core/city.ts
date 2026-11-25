// City skylines, built cell by cell. A city is a row of blocks of random
// width and height standing on a ground row; each block's roof carries
// what its city puts there (a stepped crown, a water tower, an antenna, a
// shop sign) and its face a few lit windows; then a one-cell rim runs along
// every top and every wall that faces the low sun on the left. Two cities
// are built this way, each with its own roofs and windows:
//
// - `stripSkyline`: sugar rush's far silhouettes, strips that tile sideways
//   forever, their windows coming on one by one as the night deepens.
// - `citySkyline`: cup stack's city at the foot of the tower, as wide as the
//   view, with beacons on its antennas and a lit shop sign on the near layer.
//
// The result is a grid of cell kinds; each game paints it in its own
// colours. Both are seeded, and bit for bit what each game built before the
// core had them (tests compare them on many sizes and seeds), so changing
// a roll here moves buildings in a game.
//
// DOM-free.

import { lerp } from "./math.ts";
import { createRng, hash2 } from "./rng.ts";

/** What a cell is. */
export const EMPTY = 0;
export const BODY = 1;
/** The sunlit edge: a top, or a wall facing the sun on the left. */
export const RIM = 2;
export const WINDOW = 3;
/** The light on an antenna's tip. */
export const BEACON = 4;
export const SIGN = 5;
/** The sign's lettering. */
export const GLYPH = 6;

/** A grid of cell kinds, row by row. A wrapping grid joins its right edge to its left. */
function cellGrid(columns: number, rows: number, wrap: boolean) {
  const cells = new Uint8Array(columns * rows);
  const column = (x: number) => (wrap ? ((x % columns) + columns) % columns : x);
  const at = (x: number, y: number) => {
    const c = column(x);
    return c >= 0 && c < columns && y >= 0 && y < rows ? cells[y * columns + c] : EMPTY;
  };
  const set = (x: number, y: number, value: number) => {
    const c = column(x);
    if (c >= 0 && c < columns && y >= 0 && y < rows) cells[y * columns + c] = value;
  };
  const fill = (x: number, y: number, w: number, h: number, value: number) => {
    for (let row = y; row < y + h; row++) for (let c = x; c < x + w; c++) set(c, row, value);
  };
  return { columns, rows, cells, wrap, at, set, fill };
}

type CellGrid = ReturnType<typeof cellGrid>;

interface Blocks {
  /** The first block starts up to this many cells left of the edge (one roll; 0 rolls nothing). */
  stagger: number;
  minW: number;
  maxW: number;
  /** Heights above the ground row, in cells. */
  low: number;
  high: number;
  /** Above 1, low blocks are likelier: a height is `low..high` at a roll raised to this power. */
  lean: number;
  /** The row the blocks stand on. */
  ground: number;
}

/**
 * Lays blocks left to right across `grid`, each a solid body down to the
 * last row, and hands each to `roof` (its left column, width, and top row)
 * for what stands on it and its windows. On a wrapping grid the last block
 * ends at the seam, so the strip tiles.
 */
function layBlocks(grid: CellGrid, random: () => number, o: Blocks, roof: (x: number, w: number, top: number) => void) {
  let x = o.stagger ? -Math.floor(random() * o.stagger) : 0;
  while (x < grid.columns) {
    let w = o.minW + Math.floor(random() * (o.maxW - o.minW + 1));
    if (grid.wrap) w = Math.min(grid.columns - x, w);
    const h = Math.round(lerp(o.low, o.high, Math.pow(random(), o.lean)));
    const top = o.ground - h;
    grid.fill(x, top, w, grid.rows - top, BODY);
    roof(x, w, top);
    x += w;
  }
}

/** The rim: every body cell open above, or open on the sun's side (the left). */
function addRim(grid: CellGrid) {
  const { columns, rows, cells, at } = grid;
  for (let y = 0; y < rows; y++) {
    for (let column = 0; column < columns; column++) {
      if (cells[y * columns + column] !== BODY) continue;
      if (at(column, y - 1) === EMPTY || at(column - 1, y) === EMPTY) cells[y * columns + column] = RIM;
    }
  }
}

// --- Sugar rush's far strips -----------------------------------------------------------

export interface StripSpec {
  seed: number;
  /** Width in cells: the strip repeats every `period` cells. */
  period: number;
  minW: number;
  maxW: number;
  /** Tallest and lowest block, as shares of the sky above the horizon. */
  high: number;
  low: number;
  /** The share of window cells. */
  windows: number;
}

export interface StripView {
  /** The sky's top and the horizon, and the screen's bottom, in px. */
  top: number;
  horizon: number;
  bottom: number;
  /** The art cell, in px. */
  cell: number;
}

/**
 * A far skyline strip: blocks crowned in steps, or carrying a water tower
 * or an antenna, every one with rows of windows down to the bottom of the
 * screen. `base` is the row it stands on (drawn at the horizon), and each
 * window has its own point in the night (`lit`, 0..1) at which it comes on.
 */
export function stripSkyline(spec: StripSpec, view: StripView) {
  const span = Math.max(1, view.horizon - view.top);
  const high = Math.ceil((spec.high * span) / view.cell);
  const low = Math.ceil((spec.low * span) / view.cell);
  const base = high + 8;
  // Never fewer rows than the skyline itself, even mid-resize on a tiny window.
  const rows = Math.max(base + 8, base + Math.ceil((view.bottom - view.horizon) / view.cell) + 40);
  const { period, seed } = spec;
  const grid = cellGrid(period, rows, true);
  const { cells, set, fill } = grid;
  const lit = new Float32Array(period * rows);
  const random = createRng(seed);
  layBlocks(grid, random, { stagger: 0, minW: spec.minW, maxW: spec.maxW, low, high, lean: 1.3, ground: base }, (x, w, top) => {
    const feature = random();
    if (w >= 8 && feature < 0.3) {
      // A stepped crown.
      const inset = 2;
      const tall = 2 + Math.floor(random() * 3);
      fill(x + inset, top - tall, w - inset * 2, tall, BODY);
    } else if (w >= 7 && feature < 0.5) {
      // A water tower: legs, the tank, a cap.
      const tx = x + 1 + Math.floor(random() * (w - 6));
      set(tx, top - 1, BODY);
      set(tx + 4, top - 1, BODY);
      fill(tx, top - 5, 5, 4, BODY);
      set(tx + 2, top - 6, BODY);
    } else if (feature < 0.7) {
      // An antenna.
      const ax = x + 1 + Math.floor(random() * Math.max(1, w - 2));
      const ah = 3 + Math.floor(random() * 5);
      fill(ax, top - ah, 1, ah, BODY);
    }
    const rowStep = 2 + Math.floor(random() * 2);
    for (let wy = top + 2; wy < rows; wy += rowStep) {
      for (let wx = x + 1; wx < x + w - 1; wx += 2) {
        const roll = hash2(seed * 31 + wx, wy);
        if (roll < spec.windows) {
          cells[wy * period + wx] = WINDOW;
          lit[wy * period + wx] = hash2(wx, wy * 7 + seed);
        }
      }
    }
  });
  addRim(grid);
  return { base, rows, cells, lit };
}

// --- Cup stack's city ------------------------------------------------------------------

export interface CitySpec {
  seed: number;
  /** Lowest and tallest block above the ground line, as shares of the view's height. */
  low: number;
  high: number;
  minW: number;
  maxW: number;
  /** The share of window cells, and rows of cells from one row of windows to the next. */
  windows: number;
  rowStep: number;
  /** Shop signs at most, and the chances of a sign, a water tower and an antenna on a roof. */
  signs: number;
  signP: number;
  towerP: number;
  antennaP: number;
  /** A water tower's tank width, in cells. */
  tankW: number;
}

export interface CityView {
  /** The view's size, and the ground line, in px. */
  width: number;
  height: number;
  ground: number;
  /** The art cell, in px. */
  cell: number;
}

/**
 * A city layer as wide as the view: blocks with setbacks, water towers on
 * catwalks, antennas (some with a crossbar, most with a beacon), and on a
 * layer that has them a shop sign on legs with a cup and two lines of
 * lettering. A few windows are lit, some in pairs. `horizon` is the row the
 * city stands on (drawn at the ground line).
 */
export function citySkyline(spec: CitySpec, view: CityView) {
  const columns = Math.ceil(view.width / view.cell) + 1;
  const high = Math.ceil((spec.high * view.height) / view.cell);
  const low = Math.ceil((spec.low * view.height) / view.cell);
  const horizon = high + 14;
  const rows = horizon + Math.ceil((view.height - view.ground) / view.cell) + 2;
  const grid = cellGrid(columns, rows, false);
  const { at, set, fill } = grid;
  const random = createRng(spec.seed);
  let signs = 0;
  layBlocks(grid, random, { stagger: 6, minW: spec.minW, maxW: spec.maxW, low, high, lean: 1.4, ground: horizon }, (x, w, bodyTop) => {
    let top = bodyTop;
    let roofX = x;
    let roofW = w;
    if (w >= 7 && random() < 0.4) {
      // A stepped crown.
      const inset = 1 + Math.floor(random() * Math.min(3, (w - 3) / 2));
      const tall = 2 + Math.floor(random() * 4);
      top -= tall;
      roofX = x + inset;
      roofW = w - inset * 2;
      fill(roofX, top, roofW, tall, BODY);
    }
    const feature = random();
    if (signs < spec.signs && roofW >= 12 && feature < spec.signP) {
      // A shop sign on legs: a cup and two lines of lettering, lit.
      signs++;
      const sx = roofX + Math.floor((roofW - 12) / 2);
      fill(sx + 2, top - 2, 1, 2, BODY);
      fill(sx + 9, top - 2, 1, 2, BODY);
      fill(sx, top - 7, 12, 5, BODY);
      fill(sx + 1, top - 6, 10, 3, SIGN);
      fill(sx + 2, top - 6, 3, 2, GLYPH);
      set(sx + 3, top - 4, GLYPH);
      fill(sx + 6, top - 6, 4, 1, GLYPH);
      fill(sx + 6, top - 4, 3, 1, GLYPH);
    } else if (roofW >= spec.tankW + 2 && feature < spec.signP + spec.towerP) {
      // A water tower: legs, a catwalk, the tank, its cone.
      const tw = spec.tankW;
      const tx = roofX + 1 + Math.floor(random() * Math.max(1, roofW - tw - 1));
      set(tx, top - 1, BODY);
      set(tx + tw - 1, top - 1, BODY);
      fill(tx, top - 2, tw, 1, BODY);
      fill(tx, top - 5, tw, 3, BODY);
      fill(tx + 1, top - 6, tw - 2, 1, BODY);
      if (tw % 2 === 1) set(tx + (tw - 1) / 2, top - 7, BODY);
    } else if (feature < spec.signP + spec.towerP + spec.antennaP) {
      // An antenna, perhaps with a crossbar, perhaps with a beacon.
      const ax = roofX + 1 + Math.floor(random() * Math.max(1, roofW - 2));
      const ah = 3 + Math.floor(random() * 6);
      fill(ax, top - ah, 1, ah, BODY);
      if (ah >= 5 && random() < 0.5) fill(ax - 1, top - ah + 2, 3, 1, BODY);
      if (random() < 0.6) set(ax, top - ah - 1, BEACON);
    }
    // A few lit windows, on the building's own grid.
    for (let wy = bodyTop + 2; wy < horizon + 8; wy += spec.rowStep) {
      for (let wx = x + 1; wx < x + w - 1; wx += 2) {
        if (at(wx, wy) !== BODY) continue;
        const roll = hash2(spec.seed * 31 + wx, wy);
        if (roll < spec.windows) {
          set(wx, wy, WINDOW);
          if (roll < spec.windows * 0.35 && wx + 1 < x + w - 1) set(wx + 1, wy, WINDOW);
        }
      }
    }
  });
  addRim(grid);
  return { columns, rows, horizon, cells: grid.cells };
}
