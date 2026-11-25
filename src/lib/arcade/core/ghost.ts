// Ghosts: the arcade's "hologram", in the house idiom. A lesson can show the
// move it teaches as a ghost of the player's own sprite, drawn through an
// ordered-dither screen door in one flat colour, the way pixel art shows
// anything half there, plus chalk dashes for a path. No glow, no blur.
// Positions are in the canvas's own (world or screen) units; the helpers
// follow whatever transform the context already has.

import { BAYER_4 as BAYER } from "./dither.ts";

let layer: HTMLCanvasElement | null = null;
const masks = new Map<string, HTMLCanvasElement>();

function scratch(width: number, height: number) {
  if (!layer) layer = document.createElement("canvas");
  if (layer.width < width) layer.width = Math.ceil(width);
  if (layer.height < height) layer.height = Math.ceil(height);
  const g = layer.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  g.clearRect(0, 0, layer.width, layer.height);
  return { canvas: layer, g };
}

/** A tile of the dither pattern: cells of `cellPx` device pixels, `density` of them on. */
function maskTile(cellPx: number, density: number) {
  const cell = Math.max(1, Math.round(cellPx));
  const level = Math.max(0, Math.min(16, Math.round(density * 16)));
  const key = `${cell}:${level}`;
  let tile = masks.get(key);
  if (tile) return tile;
  tile = document.createElement("canvas");
  tile.width = tile.height = cell * 4;
  const g = tile.getContext("2d")!;
  g.fillStyle = "#000";
  for (let i = 0; i < 16; i++) if (BAYER[i] < level) g.fillRect((i % 4) * cell, Math.floor(i / 4) * cell, cell, cell);
  masks.set(key, tile);
  return tile;
}

const patterns = new Map<string, CanvasPattern>();

/** The dither tile as a pattern on the scratch layer, made once per cell size and density. */
function maskPattern(g: CanvasRenderingContext2D, cellPx: number, density: number) {
  const key = `${Math.max(1, Math.round(cellPx))}:${Math.max(0, Math.min(16, Math.round(density * 16)))}`;
  let pattern = patterns.get(key);
  if (!pattern) {
    pattern = g.createPattern(maskTile(cellPx, density), "repeat")!;
    patterns.set(key, pattern);
  }
  return pattern;
}

export interface GhostOptions {
  /** One flat colour for the whole ghost; omit to keep the sprite's own colours. */
  color?: string;
  /** Share of cells drawn, 0..1 (0.5 is a checkerboard). */
  density?: number;
  /** The pixel cell in canvas units, so the dither lands on the art's grid. */
  cell?: number;
}

/**
 * Draws whatever `paint` draws, inside `x, y, width, height`, as a dithered
 * ghost. `paint` draws with the same coordinates it would use on `ctx`.
 */
export function drawGhost(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  paint: (g: CanvasRenderingContext2D) => void,
  { color, density = 0.5, cell = 4 }: GhostOptions = {},
) {
  if (width <= 0 || height <= 0 || density <= 0) return;
  const m = ctx.getTransform();
  const sx = Math.hypot(m.a, m.b) || 1;
  const sy = Math.hypot(m.c, m.d) || 1;
  // Snap the box to the dither's repeat, so the pattern sits on the grid.
  const step = cell * 4;
  const x0 = Math.floor(x / step) * step;
  const y0 = Math.floor(y / step) * step;
  const x1 = Math.ceil((x + width) / step) * step;
  const y1 = Math.ceil((y + height) / step) * step;
  const pw = Math.ceil((x1 - x0) * sx);
  const ph = Math.ceil((y1 - y0) * sy);
  const { canvas, g } = scratch(pw, ph);
  g.setTransform(sx, 0, 0, sy, -x0 * sx, -y0 * sy);
  g.imageSmoothingEnabled = false;
  paint(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (color) {
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, pw, ph);
  }
  if (density < 1) {
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = maskPattern(g, cell * sx, density);
    g.fillRect(0, 0, pw, ph);
  }
  g.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, pw, ph, x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

export interface ChalkOptions {
  color?: string;
  /** Size of each chalk square, in canvas units. */
  cell?: number;
  /** Squares on, then off, along the path. */
  dash?: number;
  gap?: number;
  /** Shifts the dashes along the path (animate it to make them march). */
  offset?: number;
  /** Draw only this share of the path, 0..1, for a draw-on reveal. */
  progress?: number;
}

/** Chalk dashes along a polyline, snapped to the pixel grid. */
export function chalkPath(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<{ x: number; y: number }>,
  { color = "#fdf8f3", cell = 4, dash = 2, gap = 2, offset = 0, progress = 1 }: ChalkOptions = {},
) {
  if (points.length < 2 || progress <= 0) return;
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const end = total * Math.min(1, progress);
  const period = (dash + gap) * cell;
  ctx.save();
  ctx.fillStyle = color;
  let walked = 0;
  for (let i = 1; i < points.length && walked < end; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    for (let d = 0; d < length && walked + d < end; d += cell) {
      const along = walked + d + offset;
      if (((along % period) + period) % period >= dash * cell) continue;
      const t = d / length;
      const px = Math.round((a.x + (b.x - a.x) * t) / cell) * cell;
      const py = Math.round((a.y + (b.y - a.y) * t) / cell) * cell;
      ctx.fillRect(px - cell / 2, py - cell / 2, cell, cell);
    }
    walked += length;
  }
  ctx.restore();
}

/**
 * A breathing 0..1 wave for a ghost or ring that should draw the eye
 * without blinking: slow, and steady under Reduce Motion.
 */
export function beckon(seconds: number, reduce = false, period = 1.4) {
  if (reduce) return 1;
  return 0.5 + 0.5 * Math.sin((seconds / period) * Math.PI * 2);
}

export interface FocusBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The lesson's spotlight, in the scenes' own language: everything outside
 * the `focus` boxes darkens through ordered dithering on the art's cell grid
 * (half the cells of `color` far off, a quarter in a band at the edge), and
 * each box is lit as the rounded shape inside it, so the light falls in
 * pixel steps like the dithered skies, never a flat rectangle or a soft
 * glow. `strength` 0..1 eases it in and out through the dither levels.
 * Boxes are in canvas units; they may overlap.
 */
export function drawSpotlight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  focus: readonly FocusBox[],
  strength: number,
  {
    color = "#141a2e",
    cell = 4,
    edge = 2,
    ink = 150,
    pattern = "dither",
  }: {
    color?: string;
    cell?: number;
    edge?: number;
    /** How dark each dithered cell is, 0..255. */
    ink?: number;
    /**
     * "dither" for a painted pixel scene; "flat" for a game played over the
     * page itself (catch), where a screen door over text reads as noise: a
     * soft even wash there, the lit shapes still rounded.
     */
    pattern?: "dither" | "flat";
  } = {},
) {
  if (strength <= 0.01) return;
  if (pattern === "flat") {
    flatSpotlight(ctx, width, height, focus, strength, color, edge * cell);
    return;
  }
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  // Each box as an ellipse in cell units, padded a little so the thing itself is never cut.
  let count = 0;
  for (const box of focus) {
    if (box.w <= 0 || box.h <= 0) continue;
    const e = ellipses[count] ?? (ellipses[count] = { cx: 0, cy: 0, rx: 1, ry: 1 });
    e.cx = (box.x + box.w / 2) / cell;
    e.cy = (box.y + box.h / 2) / cell;
    // An ellipse through the box's corners (√2 × the half-sides) covers the whole box.
    e.rx = Math.max(2, (box.w / 2 / cell) * Math.SQRT2);
    e.ry = Math.max(2, (box.h / 2 / cell) * Math.SQRT2);
    count++;
  }
  const band = 1 + edge / 6;
  const far = Math.round(8 * Math.min(1, strength));
  const near = Math.round(4 * Math.min(1, strength));
  const layer = spotLayer(cols, rows);
  if (!layer) return;
  const { g, image } = layer;
  const data = image.data;
  const [r, gc, b] = hexRgb(color);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // The nearest any ellipse comes: under 1 inside it, under `band` in its edge.
      let d = Infinity;
      for (let k = 0; k < count; k++) {
        const e = ellipses[k];
        const dx = (x + 0.5 - e.cx) / e.rx;
        const dy = (y + 0.5 - e.cy) / e.ry;
        const q = dx * dx + dy * dy;
        if (q < d) d = q;
      }
      const level = d < 1 ? 0 : d < band * band ? near : far;
      const o = (y * cols + x) * 4;
      const on = level > 0 && BAYER[(y & 3) * 4 + (x & 3)] < level;
      data[o] = r;
      data[o + 1] = gc;
      data[o + 2] = b;
      data[o + 3] = on ? ink : 0;
    }
  }
  g.putImageData(image, 0, 0);
  // Scaled up a cell at a time under whatever transform the game draws with.
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer.canvas, 0, 0, cols, rows, 0, 0, cols * cell, rows * cell);
  ctx.restore();
}

/**
 * The flat wash: the page dims evenly and each box is lit as the ellipse
 * round it. Drawn on its own layer, with the lit shapes erased from it, so
 * overlapping shapes stay lit rather than darkening where they cross.
 */
function flatSpotlight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  focus: readonly FocusBox[],
  strength: number,
  color: string,
  band: number,
) {
  const m = ctx.getTransform();
  const pw = Math.max(1, Math.ceil(width * m.a));
  const ph = Math.max(1, Math.ceil(height * m.d));
  if (!washLayer) washLayer = document.createElement("canvas");
  if (washLayer.width !== pw || washLayer.height !== ph) {
    washLayer.width = pw;
    washLayer.height = ph;
  }
  const g = washLayer.getContext("2d");
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, pw, ph);
  g.setTransform(m.a, 0, 0, m.d, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.fillStyle = color;
  g.globalAlpha = 0.28 * strength;
  g.fillRect(0, 0, width, height);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "destination-out";
  for (const box of focus) {
    if (box.w <= 0 || box.h <= 0) continue;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const rx = (box.w / 2) * Math.SQRT2;
    const ry = (box.h / 2) * Math.SQRT2;
    // A half-lit ring for the edge, then the shape itself fully lit.
    g.globalAlpha = 0.5;
    g.beginPath();
    g.ellipse(cx, cy, rx + band, ry + band, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(washLayer, 0, 0);
  ctx.restore();
}

let washLayer: HTMLCanvasElement | null = null;

const ellipses: Array<{ cx: number; cy: number; rx: number; ry: number }> = [];
let spot: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; image: ImageData } | null = null;

/** The cell-sized layer the spotlight is drawn into, reused frame to frame. */
function spotLayer(cols: number, rows: number) {
  if (!spot || spot.canvas.width !== cols || spot.canvas.height !== rows) {
    const canvas = spot?.canvas ?? document.createElement("canvas");
    canvas.width = cols;
    canvas.height = rows;
    const g = canvas.getContext("2d");
    if (!g) return null;
    spot = { canvas, g, image: g.createImageData(cols, rows) };
  }
  return spot;
}

const rgbCache = new Map<string, [number, number, number]>();
function hexRgb(hex: string): [number, number, number] {
  let rgb = rgbCache.get(hex);
  if (!rgb) {
    rgb = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    rgbCache.set(hex, rgb);
  }
  return rgb;
}
