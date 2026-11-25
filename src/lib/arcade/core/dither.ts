// Ordered (Bayer 4 × 4) dithering, the way every scene joins two flat
// colours, and the dithered band sky four of them paint. Pixel buffers here
// are one pixel per art cell, scaled up when drawn.

import type { RGB } from "./color.ts";

/** The 4 × 4 Bayer matrix, 0..15. */
export const BAYER_4 = Object.freeze([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);
const THRESHOLDS = BAYER_4.map((value) => (value + 0.5) / 16);

/** The dither threshold at cell (x, y), in (0, 1): a cell takes the next colour when its blend is above it. */
export const bayer = (x: number, y: number) => THRESHOLDS[(y & 3) * 4 + (x & 3)];

/** An offscreen canvas of `width × height` cells, with its context and a blank image to fill. */
export function cellLayer(canvas: HTMLCanvasElement | null, width: number, height: number) {
  const layer = canvas ?? document.createElement("canvas");
  layer.width = Math.max(1, Math.ceil(width));
  layer.height = Math.max(1, Math.ceil(height));
  const context = layer.getContext("2d");
  const image = context ? context.createImageData(layer.width, layer.height) : null;
  return { canvas: layer, context, image };
}

/**
 * Flat bands down a cell buffer, each joined to the next by ordered
 * dithering across the middle two fifths of its stretch. `stops` are the
 * rows where each band starts (one per band); rows past the last stop take
 * the last band.
 */
export function paintBands(data: Uint8ClampedArray, width: number, height: number, bands: ReadonlyArray<RGB | number[]>, stops: readonly number[]) {
  const last = stops.length - 1;
  for (let y = 0; y < height; y++) {
    let segment = 0;
    while (segment < last - 1 && y >= stops[segment + 1]) segment++;
    const span = stops[segment + 1] - stops[segment];
    const t = span > 0 ? Math.min(1, Math.max(0, (y - stops[segment]) / span)) : 1;
    const blend = Math.min(1, Math.max(0, (t - 0.3) / 0.4));
    const below = y >= stops[last];
    for (let x = 0; x < width; x++) {
      const color = below ? bands[last] : bands[blend > bayer(x, y) ? segment + 1 : segment];
      const o = (y * width + x) * 4;
      data[o] = color[0];
      data[o + 1] = color[1];
      data[o + 2] = color[2];
      data[o + 3] = 255;
    }
  }
}
