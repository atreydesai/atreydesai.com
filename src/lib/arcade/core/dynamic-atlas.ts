// A texture atlas filled as sprites are first needed: one canvas, cells
// handed out on shelves, each painted once through a Painter and blitted
// from then on. For things whose set isn't known up front (the guests who
// walk in today, each face and step, coloured for the hour). When it fills,
// or the light changes, it starts over.

import { Painter } from "./painter.ts";
import { PixelBuffer } from "./pixel-buffer.ts";
import type { AtlasFrame } from "./atlas.ts";

export class DynamicAtlas {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private frames = new Map<string, AtlasFrame>();
  private x = 0;
  private y = 0;
  private shelf = 0;
  /** Bumped on every reset, so callers can tell their frames went stale. */
  generation = 0;

  constructor(
    readonly width = 512,
    readonly height = 256,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d")!;
  }

  reset() {
    this.frames.clear();
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.x = this.y = this.shelf = 0;
    this.generation++;
  }

  /** The frame for `key`, painting it now if it is new. Null only if a sprite is bigger than the atlas. */
  get(key: string, w: number, h: number, ax: number, ay: number, paint: (p: Painter) => void): AtlasFrame | null {
    const hit = this.frames.get(key);
    if (hit) return hit;
    if (w > this.width || h > this.height) return null;
    if (this.x + w > this.width) {
      this.x = 0;
      this.y += this.shelf + 1;
      this.shelf = 0;
    }
    if (this.y + h > this.height) {
      this.reset();
      return this.get(key, w, h, ax, ay, paint);
    }
    const buf = new PixelBuffer(w, h);
    paint(new Painter(buf, w, h));
    this.ctx.putImageData(new ImageData(buf.data, w, h), this.x, this.y);
    const frame = { x: this.x, y: this.y, w, h, ax, ay };
    this.frames.set(key, frame);
    this.x += w + 1;
    this.shelf = Math.max(this.shelf, h);
    return frame;
  }
}

/** A canvas holding a pixel buffer. */
export function bufferCanvas(buf: PixelBuffer, reuse?: HTMLCanvasElement | null) {
  const c = reuse ?? document.createElement("canvas");
  if (c.width !== buf.width) c.width = buf.width;
  if (c.height !== buf.height) c.height = buf.height;
  c.getContext("2d")!.putImageData(new ImageData(buf.data, buf.width, buf.height), 0, 0);
  return c;
}
