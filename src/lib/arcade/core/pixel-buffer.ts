// A paint context over a plain pixel buffer: the fast way to bake a scene's
// static layers. `fillRect` writes straight into a Uint32Array (alpha
// blended when `globalAlpha` is under 1), so a whole room's floor, walls
// and light can be painted pixel by pixel in a few milliseconds and handed
// to a canvas with one `putImageData`. It is the same small interface the
// arcade's painters draw through, so the same drawing code bakes here, draws
// straight to a canvas, or runs in a node test.

const parsed = new Map<string, number>();

/** `#rgb`, `#rrggbb` or `#rrggbbaa` to a little-endian ABGR word, cached. */
export function packColor(color: string): number {
  let word = parsed.get(color);
  if (word !== undefined) return word;
  let r = 0,
    g = 0,
    b = 0,
    a = 255;
  if (color[0] === "#") {
    const hex = color.length === 4 ? color.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3") : color;
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
    if (hex.length >= 9) a = parseInt(hex.slice(7, 9), 16);
  }
  word = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  if (parsed.size > 8192) parsed.clear();
  parsed.set(color, word);
  return word;
}

export class PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly words: Uint32Array;
  fillStyle: unknown = "#000000";
  globalAlpha = 1;
  /** Columns and rows outside this box are left alone (a cheap clip). */
  clip: { x0: number; y0: number; x1: number; y1: number } | null = null;

  constructor(width: number, height: number) {
    this.width = Math.max(1, Math.ceil(width));
    this.height = Math.max(1, Math.ceil(height));
    this.data = new Uint8ClampedArray(this.width * this.height * 4);
    this.words = new Uint32Array(this.data.buffer);
  }

  clear() {
    this.words.fill(0);
  }

  fillRect(x: number, y: number, w: number, h: number) {
    let x0 = Math.max(0, x | 0);
    let y0 = Math.max(0, y | 0);
    let x1 = Math.min(this.width, (x + w) | 0);
    let y1 = Math.min(this.height, (y + h) | 0);
    if (this.clip) {
      x0 = Math.max(x0, this.clip.x0);
      y0 = Math.max(y0, this.clip.y0);
      x1 = Math.min(x1, this.clip.x1);
      y1 = Math.min(y1, this.clip.y1);
    }
    if (x1 <= x0 || y1 <= y0) return;
    const word = packColor(String(this.fillStyle));
    const alpha = ((word >>> 24) / 255) * this.globalAlpha;
    if (alpha <= 0) return;
    const words = this.words;
    const width = this.width;
    if (alpha >= 1) {
      for (let row = y0; row < y1; row++) words.fill(word, row * width + x0, row * width + x1);
      return;
    }
    const r = word & 255,
      g = (word >>> 8) & 255,
      b = (word >>> 16) & 255;
    const data = this.data;
    for (let row = y0; row < y1; row++)
      for (let col = x0; col < x1; col++) {
        const o = (row * width + col) * 4;
        const keep = 1 - alpha;
        data[o] = data[o] * keep + r * alpha;
        data[o + 1] = data[o + 1] * keep + g * alpha;
        data[o + 2] = data[o + 2] * keep + b * alpha;
        data[o + 3] = Math.max(data[o + 3], alpha * 255);
      }
  }

  /** One opaque pixel, no clip or alpha: the inner loop of a pixel shader. */
  set(x: number, y: number, word: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.words[y * this.width + x] = word;
  }

  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.words[y * this.width + x];
  }

  /** Copies this buffer onto a canvas context at (x, y). */
  putOn(ctx: { putImageData(image: ImageData, x: number, y: number): void }, x = 0, y = 0) {
    ctx.putImageData(new ImageData(this.data, this.width, this.height), x, y);
  }
}
