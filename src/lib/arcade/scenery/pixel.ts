import { bayer } from "#lib/arcade/core/dither.ts";

export const WIDTH = 320;
export const HEIGHT = 168;

export class Pixels {
  constructor(readonly ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = false;
  }

  rect(color: string, x: number, y: number, w = 1, h = 1) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  oval(color: string, x: number, y: number, rx: number, ry: number) {
    this.ctx.fillStyle = color;
    x = Math.round(x);
    y = Math.round(y);
    for (let row = -Math.floor(ry); row <= ry; row++) {
      const dx = Math.floor(rx * Math.sqrt(1 - (row / ry) ** 2));
      this.ctx.fillRect(x - dx, y + row, dx * 2 + 1, 1);
    }
  }

  line(color: string, x0: number, y0: number, x1: number, y1: number, size = 1) {
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
      this.ctx.fillRect(x, y, size, size);
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
    const left = Math.round(x - anchorX * width / canvas.width);
    const top = Math.round(y - anchorY * height / canvas.height);
    this.ctx.drawImage(canvas, left, top, width, height);
  }
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
