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
