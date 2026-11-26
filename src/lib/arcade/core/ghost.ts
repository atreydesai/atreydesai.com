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

/**
 * Pixel corner brackets round a box: how a pixel scene rings a thing, the
 * same mark the lesson callout draws in the page. Each corner is an arm
 * `arm` long and `bar` thick, on whole pixels; `progress` below 1 grows the
 * arms out from the corners, for a reveal.
 */
export function drawBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  { color = "#e85d4c", arm = 9, bar = 3, progress = 1 }: { color?: string; arm?: number; bar?: number; progress?: number } = {},
) {
  if (progress <= 0 || w <= 0 || h <= 0) return;
  const reach = Math.max(bar, Math.round(Math.min(arm, w / 2, h / 2) * Math.min(1, progress)));
  const left = Math.round(x);
  const top = Math.round(y);
  const right = Math.round(x + w);
  const bottom = Math.round(y + h);
  ctx.fillStyle = color;
  ctx.fillRect(left, top, reach, bar);
  ctx.fillRect(left, top, bar, reach);
  ctx.fillRect(right - reach, top, reach, bar);
  ctx.fillRect(right - bar, top, bar, reach);
  ctx.fillRect(left, bottom - bar, reach, bar);
  ctx.fillRect(left, bottom - reach, bar, reach);
  ctx.fillRect(right - reach, bottom - bar, reach, bar);
  ctx.fillRect(right - bar, bottom - reach, bar, reach);
}

export interface FocusBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The lesson's spotlight: everything outside the `focus` boxes darkens
 * under an even wash of `color`, and each box is lit as a rectangle round
 * it, its edge one band of half the wash. On a pixel scene ("pixel") the
 * rectangles are cut from the art's cell grid with stepped corners, the
 * same shape as the chips and callouts, so the light falls in pixel steps,
 * never an oval, a soft glow, or a screen door over the art; over the page
 * itself ("flat", catch) they are rounded like the page's own cards.
 * `strength` 0..1 eases the wash in and out. Boxes are in canvas units;
 * they may overlap.
 */
export function drawSpotlight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  focus: readonly FocusBox[],
  strength: number,
  {
    color = "#2a2422",
    cell = 4,
    edge = 2,
    wash = 0.34,
    pattern = "pixel",
  }: {
    color?: string;
    cell?: number;
    edge?: number;
    /** How dark the wash is at full strength, 0..1. */
    wash?: number;
    /** "pixel" for a painted pixel scene; "flat" for a game played over the page itself. */
    pattern?: "pixel" | "flat";
  } = {},
) {
  if (strength <= 0.01) return;
  const dim = wash * Math.min(1, strength);
  if (pattern === "flat") {
    flatSpotlight(ctx, width, height, focus, dim, color, edge * cell);
    return;
  }
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  // Each box as a rectangle of whole cells, a cell clear of it all round so
  // the thing itself is never cut, with a stepped corner sized to it.
  let count = 0;
  for (const box of focus) {
    if (box.w <= 0 || box.h <= 0) continue;
    const r = lit[count] ?? (lit[count] = { x0: 0, y0: 0, x1: 0, y1: 0, cut: 1 });
    r.x0 = Math.floor(box.x / cell) - 1;
    r.y0 = Math.floor(box.y / cell) - 1;
    r.x1 = Math.ceil((box.x + box.w) / cell) + 1;
    r.y1 = Math.ceil((box.y + box.h) / cell) + 1;
    r.cut = Math.min(r.x1 - r.x0, r.y1 - r.y0) >= 8 ? 2 : 1;
    count++;
  }
  const band = Math.max(1, Math.round(edge / 2));
  const far = Math.round(255 * dim);
  const near = Math.round(255 * dim * 0.5);
  const layer = spotLayer(cols, rows);
  if (!layer) return;
  const { g, image } = layer;
  const data = image.data;
  const [r, gc, b] = hexRgb(color);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let level = far;
      for (let k = 0; k < count && level > 0; k++) {
        if (inStepped(x, y, lit[k], 0)) level = 0;
        else if (inStepped(x, y, lit[k], band)) level = near;
      }
      const o = (y * cols + x) * 4;
      data[o] = r;
      data[o + 1] = gc;
      data[o + 2] = b;
      data[o + 3] = level;
    }
  }
  g.putImageData(image, 0, 0);
  // Scaled up a cell at a time under whatever transform the game draws with.
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layer.canvas, 0, 0, cols, rows, 0, 0, cols * cell, rows * cell);
  ctx.restore();
}

/** Whether cell (x, y) is inside rectangle `r` grown by `grow` cells, its corners stepped. */
function inStepped(x: number, y: number, r: { x0: number; y0: number; x1: number; y1: number; cut: number }, grow: number) {
  const x0 = r.x0 - grow;
  const y0 = r.y0 - grow;
  const x1 = r.x1 + grow;
  const y1 = r.y1 + grow;
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
  const dx = Math.min(x - x0, x1 - 1 - x);
  const dy = Math.min(y - y0, y1 - 1 - y);
  return dx + dy >= r.cut + grow;
}

/**
 * The flat wash: the page dims evenly and each box is lit as a rounded
 * rectangle round it. Drawn on its own layer, with the lit shapes erased
 * from it, so overlapping shapes stay lit rather than darkening where they
 * cross.
 */
function flatSpotlight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  focus: readonly FocusBox[],
  dim: number,
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
  g.globalAlpha = dim;
  g.fillRect(0, 0, width, height);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "destination-out";
  for (const box of focus) {
    if (box.w <= 0 || box.h <= 0) continue;
    const pad = 6;
    // A half-lit band for the edge, then the box itself fully lit.
    g.globalAlpha = 0.5;
    roundedRect(g, box.x - pad - band, box.y - pad - band, box.w + (pad + band) * 2, box.h + (pad + band) * 2, 14 + band);
    g.globalAlpha = 1;
    roundedRect(g, box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2, 14);
  }
  g.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(washLayer, 0, 0);
  ctx.restore();
}

function roundedRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.min(radius, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
}

let washLayer: HTMLCanvasElement | null = null;

const lit: Array<{ x0: number; y0: number; x1: number; y1: number; cut: number }> = [];
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
