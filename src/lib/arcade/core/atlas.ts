// A texture atlas: every sprite a scene uses, painted once into one image
// and blitted from there with `drawImage`. Entries are packed on shelves
// (tallest first), each drawn by its own function through a Painter clipped
// to its cell, so a sprite can't bleed into its neighbour. A scene bakes one
// atlas per light step: the same sprites, coloured for that hour. The
// atlas page in the dev gallery is this image with its keys written on.
// DOM-free until it is put on a canvas.

import { Painter } from "./painter.ts";
import { PixelBuffer } from "./pixel-buffer.ts";

export interface AtlasEntry {
  key: string;
  /** Cell size in pixels. */
  w: number;
  h: number;
  /** The anchor inside the cell (usually the ground point) that `blit` puts on its target. */
  ax: number;
  ay: number;
  draw: (p: Painter) => void;
}

export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

export interface BakedAtlas {
  buffer: PixelBuffer;
  frames: Map<string, AtlasFrame>;
}

const GAP = 1;

/** Packs and paints `entries` into one buffer `width` pixels wide (height grows to fit). */
export function bakeAtlas(entries: readonly AtlasEntry[], width = 512): BakedAtlas {
  const order = [...entries].sort((a, b) => b.h - a.h || b.w - a.w);
  const frames = new Map<string, AtlasFrame>();
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const e of order) {
    if (frames.has(e.key)) continue;
    const w = Math.ceil(e.w);
    const h = Math.ceil(e.h);
    if (x + w > width) {
      x = 0;
      y += shelf + GAP;
      shelf = 0;
    }
    frames.set(e.key, { x, y, w, h, ax: e.ax, ay: e.ay });
    x += w + GAP;
    shelf = Math.max(shelf, h);
  }
  const height = Math.max(1, y + shelf);
  const buffer = new PixelBuffer(width, height);
  const painter = new Painter(buffer, width, height);
  const painted = new Set<string>();
  for (const e of order) {
    // Several placements can share one entry: it is painted once.
    if (painted.has(e.key)) continue;
    painted.add(e.key);
    const f = frames.get(e.key)!;
    buffer.clip = { x0: f.x, y0: f.y, x1: f.x + f.w, y1: f.y + f.h };
    painter.ox = f.x;
    painter.oy = f.y;
    e.draw(painter);
  }
  buffer.clip = null;
  painter.ox = 0;
  painter.oy = 0;
  return { buffer, frames };
}

export interface Blitter {
  drawImage(image: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  globalAlpha: number;
}

/** Draws a frame with its anchor at (x, y); `flip` mirrors it about the anchor. */
export function blit(ctx: Blitter, image: CanvasImageSource, f: AtlasFrame, x: number, y: number, flip = false) {
  const dx = Math.round(x - (flip ? f.w - f.ax : f.ax));
  const dy = Math.round(y - f.ay);
  if (!flip) {
    ctx.drawImage(image, f.x, f.y, f.w, f.h, dx, dy, f.w, f.h);
    return;
  }
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(image, f.x, f.y, f.w, f.h, -dx - f.w, dy, f.w, f.h);
  ctx.restore();
}
