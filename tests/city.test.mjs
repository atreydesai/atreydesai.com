import assert from "node:assert/strict";
import test from "node:test";

import { citySkyline, stripSkyline } from "../src/lib/arcade/core/city.ts";
import { lerp } from "../src/lib/arcade/core/math.ts";
import { createRng, hash2 } from "../src/lib/arcade/core/rng.ts";

// The skylines as sugar rush and cup stack built them before core/city.ts,
// copied from the components with only their inputs made arguments (the
// layout in px, and the cell), so the core's must match them cell for cell.

/** Sugar rush's `buildStrip`, before the core. */
function oldStrip(strip, { playTop, horizonY, viewH, SC }) {
  const span = Math.max(1, horizonY - playTop);
  const high = Math.ceil((strip.high * span) / SC);
  const low = Math.ceil((strip.low * span) / SC);
  strip.base = high + 8;
  strip.rows = Math.max(strip.base + 8, strip.base + Math.ceil((viewH - horizonY) / SC) + 40);
  const { period, rows, base } = strip;
  const cells = new Uint8Array(period * rows);
  const lit = new Float32Array(period * rows);
  const set = (x, y, value) => {
    const column = ((x % period) + period) % period;
    if (y >= 0 && y < rows) cells[y * period + column] = value;
  };
  const random = createRng(strip.seed);
  let x = 0;
  while (x < period) {
    const w = Math.min(period - x, strip.minW + Math.floor(random() * (strip.maxW - strip.minW + 1)));
    const h = Math.round(lerp(low, high, Math.pow(random(), 1.3)));
    const top = base - h;
    for (let row = top; row < rows; row++) for (let column = x; column < x + w; column++) set(column, row, 1);
    const feature = random();
    if (w >= 8 && feature < 0.3) {
      const inset = 2;
      const tall = 2 + Math.floor(random() * 3);
      for (let row = top - tall; row < top; row++) for (let column = x + inset; column < x + w - inset; column++) set(column, row, 1);
    } else if (w >= 7 && feature < 0.5) {
      const tx = x + 1 + Math.floor(random() * (w - 6));
      set(tx, top - 1, 1);
      set(tx + 4, top - 1, 1);
      for (let column = tx; column < tx + 5; column++) for (let row = top - 5; row < top - 1; row++) set(column, row, 1);
      set(tx + 2, top - 6, 1);
    } else if (feature < 0.7) {
      const ax = x + 1 + Math.floor(random() * Math.max(1, w - 2));
      const ah = 3 + Math.floor(random() * 5);
      for (let row = top - ah; row < top; row++) set(ax, row, 1);
    }
    const rowStep = 2 + Math.floor(random() * 2);
    for (let wy = top + 2; wy < rows; wy += rowStep) {
      for (let wx = x + 1; wx < x + w - 1; wx += 2) {
        const roll = hash2(strip.seed * 31 + wx, wy);
        if (roll < strip.windows) {
          cells[wy * period + wx] = 3;
          lit[wy * period + wx] = hash2(wx, wy * 7 + strip.seed);
        }
      }
    }
    x += w;
  }
  for (let y = 0; y < rows; y++) {
    for (let column = 0; column < period; column++) {
      if (cells[y * period + column] !== 1) continue;
      const above = y > 0 ? cells[(y - 1) * period + column] : 0;
      const left = cells[y * period + ((column - 1 + period) % period)];
      if (above === 0 || left === 0) cells[y * period + column] = 2;
    }
  }
  return { base: strip.base, rows: strip.rows, cells, lit };
}

/** Cup stack's `buildCity`, before the core, up to its grid (it then painted it). */
function oldCity(layer, { viewW, viewH, baseY, SC }) {
  const columns = Math.ceil(viewW / SC) + 1;
  const highCells = Math.ceil((layer.high * viewH) / SC);
  const lowCells = Math.ceil((layer.low * viewH) / SC);
  const up = highCells + 14;
  const rows = up + Math.ceil((viewH - baseY) / SC) + 2;
  const grid = new Uint8Array(columns * rows);
  const set = (x, y, value) => {
    if (x >= 0 && x < columns && y >= 0 && y < rows) grid[y * columns + x] = value;
  };
  const fill = (x, y, w, h, value) => {
    for (let row = y; row < y + h; row++) for (let column = x; column < x + w; column++) set(column, row, value);
  };
  const at = (x, y) => (x >= 0 && x < columns && y >= 0 && y < rows ? grid[y * columns + x] : 0);
  const random = createRng(layer.seed);
  let signs = 0;
  let x = -Math.floor(random() * 6);
  while (x < columns) {
    const w = layer.minW + Math.floor(random() * (layer.maxW - layer.minW + 1));
    const h = Math.round(lerp(lowCells, highCells, Math.pow(random(), 1.4)));
    const bodyTop = up - h;
    let top = bodyTop;
    fill(x, top, w, rows - top, 1);
    let roofX = x;
    let roofW = w;
    if (w >= 7 && random() < 0.4) {
      const inset = 1 + Math.floor(random() * Math.min(3, (w - 3) / 2));
      const tall = 2 + Math.floor(random() * 4);
      top -= tall;
      roofX = x + inset;
      roofW = w - inset * 2;
      fill(roofX, top, roofW, tall, 1);
    }
    const feature = random();
    if (signs < layer.signs && roofW >= 12 && feature < layer.signP) {
      signs++;
      const sx = roofX + Math.floor((roofW - 12) / 2);
      fill(sx + 2, top - 2, 1, 2, 1);
      fill(sx + 9, top - 2, 1, 2, 1);
      fill(sx, top - 7, 12, 5, 1);
      fill(sx + 1, top - 6, 10, 3, 5);
      fill(sx + 2, top - 6, 3, 2, 6);
      set(sx + 3, top - 4, 6);
      fill(sx + 6, top - 6, 4, 1, 6);
      fill(sx + 6, top - 4, 3, 1, 6);
    } else if (roofW >= layer.tankW + 2 && feature < layer.signP + layer.towerP) {
      const tw = layer.tankW;
      const tx = roofX + 1 + Math.floor(random() * Math.max(1, roofW - tw - 1));
      set(tx, top - 1, 1);
      set(tx + tw - 1, top - 1, 1);
      fill(tx, top - 2, tw, 1, 1);
      fill(tx, top - 5, tw, 3, 1);
      fill(tx + 1, top - 6, tw - 2, 1, 1);
      if (tw % 2 === 1) set(tx + (tw - 1) / 2, top - 7, 1);
    } else if (feature < layer.signP + layer.towerP + layer.antennaP) {
      const ax = roofX + 1 + Math.floor(random() * Math.max(1, roofW - 2));
      const ah = 3 + Math.floor(random() * 6);
      fill(ax, top - ah, 1, ah, 1);
      if (ah >= 5 && random() < 0.5) fill(ax - 1, top - ah + 2, 3, 1, 1);
      if (random() < 0.6) set(ax, top - ah - 1, 4);
    }
    for (let wy = bodyTop + 2; wy < up + 8; wy += layer.rowStep) {
      for (let wx = x + 1; wx < x + w - 1; wx += 2) {
        if (at(wx, wy) !== 1) continue;
        const roll = hash2(layer.seed * 31 + wx, wy);
        if (roll < layer.windows) {
          set(wx, wy, 3);
          if (roll < layer.windows * 0.35 && wx + 1 < x + w - 1) set(wx + 1, wy, 3);
        }
      }
    }
    x += w;
  }
  for (let y = 0; y < rows; y++) {
    for (let column = 0; column < columns; column++) {
      if (grid[y * columns + column] !== 1) continue;
      if (at(column, y - 1) === 0 || at(column - 1, y) === 0) grid[y * columns + column] = 2;
    }
  }
  return { columns, rows, horizon: up, cells: grid };
}

// Each game's layers as the components define them, then the same with other seeds.
const STRIPS = [
  { seed: 31, period: 420, minW: 6, maxW: 14, high: 0.36, low: 0.12, windows: 0.32 },
  { seed: 57, period: 360, minW: 8, maxW: 18, high: 0.26, low: 0.06, windows: 0.42 },
];
const CITY = [
  { seed: 501, low: 0.1, high: 0.3, minW: 5, maxW: 13, windows: 0.025, rowStep: 4, signs: 0, signP: 0, towerP: 0.16, antennaP: 0.34, tankW: 4 },
  { seed: 733, low: 0.03, high: 0.17, minW: 7, maxW: 16, windows: 0.045, rowStep: 3, signs: 2, signP: 0.32, towerP: 0.22, antennaP: 0.2, tankW: 5 },
];
const SEEDS = [1, 2, 7, 99, 4096, 123457];
/** Phone, tablet and desktop sizes, a tiny window mid-resize, and a big screen; fractional edges as layout gives them. */
const VIEWS = [
  [375, 667],
  [390, 844],
  [667, 375],
  [768, 1024],
  [1280, 800],
  [1440, 900.5],
  [2560, 1440],
  [120, 90],
];

function sameArray(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: size`);
  for (let i = 0; i < expected.length; i++) {
    if (!Object.is(actual[i], expected[i])) assert.fail(`${label}: cell ${i} is ${actual[i]}, was ${expected[i]}`);
  }
}

test("sugar rush's strips are built cell for cell, and lit window for window, as before", () => {
  let windows = 0;
  for (const base of STRIPS) {
    for (const seed of [base.seed, ...SEEDS]) {
      const strip = { ...base, seed };
      for (const [viewW, viewH] of VIEWS) {
        // The sky runs from under the HUD to the horizon, about two thirds down the play area.
        const playTop = viewW < 500 ? 96.5 : 80;
        const playBottom = Math.max(playTop + 180, viewH - (viewW < 700 ? 104 : 8));
        const horizonY = playTop + (playBottom - playTop) * 0.68;
        const label = `strip ${seed} at ${viewW}×${viewH}`;
        const old = oldStrip({ ...strip }, { playTop, horizonY, viewH, SC: 4 });
        const now = stripSkyline(strip, { top: playTop, horizon: horizonY, bottom: viewH, cell: 4 });
        assert.equal(now.base, old.base, `${label}: base`);
        assert.equal(now.rows, old.rows, `${label}: rows`);
        sameArray(now.cells, old.cells, `${label}: cells`);
        sameArray(now.lit, old.lit, `${label}: lit`);
        windows += old.cells.filter((cell) => cell === 3).length;
      }
    }
  }
  assert.ok(windows > 1000, "the strips have windows to compare");
});

test("cup stack's city is built cell for cell as before, signs, beacons and all", () => {
  const seen = new Set();
  for (const base of CITY) {
    for (const seed of [base.seed, ...SEEDS]) {
      const layer = { ...base, seed };
      for (const [viewW, viewH] of VIEWS) {
        for (const ground of [0.8, 0.92]) {
          const baseY = Math.round((viewH * ground) / 4) * 4;
          const label = `city ${seed} at ${viewW}×${viewH}, ground ${baseY}`;
          const old = oldCity(layer, { viewW, viewH, baseY, SC: 4 });
          const now = citySkyline(layer, { width: viewW, height: viewH, ground: baseY, cell: 4 });
          assert.equal(now.columns, old.columns, `${label}: columns`);
          assert.equal(now.rows, old.rows, `${label}: rows`);
          assert.equal(now.horizon, old.horizon, `${label}: horizon`);
          sameArray(now.cells, old.cells, `${label}: cells`);
          for (const cell of old.cells) seen.add(cell);
        }
      }
    }
  }
  // Every kind of cell was compared: body, rim, window, beacon, sign, lettering.
  for (const kind of [1, 2, 3, 4, 5, 6]) assert.ok(seen.has(kind), `cell kind ${kind} appears`);
});
