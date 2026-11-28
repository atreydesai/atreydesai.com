import { bayer } from "#lib/arcade/core/dither.ts";

export const WIDTH = 320;
export const HEIGHT = 168;

export class Pixels {
  /**
   * `grain` is how many canvas pixels make one art pixel. Art keeps its whole
   * art-pixel sizes, but positions snap to the finer grid, so something
   * drifting slowly moves a screen pixel at a time rather than a whole cell.
   */
  constructor(readonly ctx: CanvasRenderingContext2D, readonly grain = 1) {
    ctx.setTransform(grain, 0, 0, grain, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  /** A position on the finest grid this canvas can show. */
  at(n: number) {
    return Math.round(n * this.grain) / this.grain;
  }

  rect(color: string, x: number, y: number, w = 1, h = 1) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.at(x), this.at(y), Math.round(w), Math.round(h));
  }

  oval(color: string, x: number, y: number, rx: number, ry: number) {
    this.ctx.fillStyle = color;
    x = this.at(x);
    y = this.at(y);
    for (let row = -Math.floor(ry); row <= ry; row++) {
      const dx = Math.floor(rx * Math.sqrt(1 - (row / ry) ** 2));
      this.ctx.fillRect(x - dx, y + row, dx * 2 + 1, 1);
    }
  }

  line(color: string, x0: number, y0: number, x1: number, y1: number, size = 1) {
    // The steps are whole art pixels, offset by where the line starts.
    const fx = this.at(x0) - Math.round(x0);
    const fy = this.at(y0) - Math.round(y0);
    let x = Math.round(x0);
    let y = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x);
    const dy = -Math.abs(y1 - y);
    const sx = x < x1 ? 1 : -1;
    const sy = y < y1 ? 1 : -1;
    let error = dx + dy;
    this.ctx.fillStyle = color;
    while (true) {
      this.ctx.fillRect(x + fx, y + fy, size, size);
      if (x === x1 && y === y1) break;
      const next = error * 2;
      if (next >= dy) { error += dy; x += sx; }
      if (next <= dx) { error += dx; y += sy; }
    }
  }

  bands(top: string, middle: string, bottom: string, seam: number, spread = 16) {
    this.rect(top, 0, 0, WIDTH, HEIGHT);
    this.rect(middle, 0, seam, WIDTH, HEIGHT - seam);
    this.rect(bottom, 0, seam + spread * 2, WIDTH, HEIGHT - seam - spread * 2);
    const join = (from: number, to: number, color: string) => {
      for (let y = from; y < to; y++) {
        const mix = (y - from + 0.5) / (to - from);
        for (let x = 0; x < WIDTH; x++) {
          if (bayer(x, y) < mix) this.rect(color, x, y);
        }
      }
    };
    join(seam - spread / 2, seam + spread / 2, middle);
    join(seam + spread * 1.5, seam + spread * 2.5, bottom);
  }

  clip(x: number, y: number, w: number, h: number, paint: () => void) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
    paint();
    this.ctx.restore();
  }

  image(canvas: HTMLCanvasElement, x: number, y: number, scale = 1, anchorX = 0, anchorY = 0) {
    const width = Math.max(1, Math.round(canvas.width * scale));
    const height = Math.max(1, Math.round(canvas.height * scale));
    const left = this.at(x - anchorX * width / canvas.width);
    const top = this.at(y - anchorY * height / canvas.height);
    // On a finer grid, shrink to art pixels first so a scaled prop keeps the
    // same chunky pixels as everything beside it.
    const art = this.grain > 1 && (width !== canvas.width || height !== canvas.height)
      ? resized(canvas, width, height)
      : canvas;
    this.ctx.drawImage(art, left, top, width, height);
  }
}

const resizes = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
function resized(canvas: HTMLCanvasElement, width: number, height: number) {
  let sizes = resizes.get(canvas);
  if (!sizes) resizes.set(canvas, sizes = new Map());
  const key = width + "x" + height;
  let art = sizes.get(key);
  if (!art) {
    art = document.createElement("canvas");
    art.width = width;
    art.height = height;
    const ctx = art.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, width, height);
    sizes.set(key, art);
  }
  return art;
}

export function raster(width: number, height: number, paint: (p: Pixels) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(new Pixels(canvas.getContext("2d")!));
  return canvas;
}

export function hash(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export const wrap = (value: number, limit: number) => ((value % limit) + limit) % limit;

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
