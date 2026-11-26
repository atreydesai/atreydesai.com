import { INK } from "#lib/arcade/art.ts";
import type { SpriteModel } from "./types";

type View = (across: number, up: number) => string;
type Mask = (x: number, y: number, z: number) => boolean;
type Part = (x: number, y: number, z: number) => string;

export const within = (n: number, from: number, to: number) => n >= from && n <= to;

export function chamfer(x: number, y: number, halfWidth: number, halfDepth: number, corner: number) {
  return Math.abs(x) <= halfWidth && Math.abs(y) <= halfDepth && Math.abs(x) + Math.abs(y) <= halfWidth + halfDepth - corner;
}

export function ellipse(x: number, y: number, halfWidth: number, halfDepth: number) {
  return (x / halfWidth) ** 2 + (y / halfDepth) ** 2 <= 1;
}

/**
 * Cut one part from four drawn views. The top faces down the sheet, the left
 * view faces left, and the upright views count their rows up from the ground.
 * A local mask can carve out cavities hidden in the original projections.
 */
export function cut(top: View, left: View, front: View, back: View, keep: Mask = () => true): Part {
  const exists = (x: number, y: number, z: number) =>
    top(x, y) && left(-y, z) && front(-x, z) && back(x, z) && keep(x, y, z);

  return (x, y, z) => {
    if (!exists(x, y, z)) return "";
    if (!exists(x, y, z + 1)) return top(x, y);
    if (!exists(x, y + 1, z)) return front(-x, z);
    if (!exists(x, y - 1, z)) return back(x, z);
    if (!exists(x + 1, y, z) || !exists(x - 1, y, z)) return left(-y, z);
    return top(x, y);
  };
}

/** Four views of a straight-sided part with flat faces. */
export function block(
  x: number, y: number, z: number,
  halfWidth: number, halfDepth: number, height: number,
  colors: readonly [roof: string, front: string, side?: string, back?: string],
  corner = 0,
): Part {
  const [roof, front, side = front, back = side] = colors;
  const rows = (n: number) => within(n, z, z + height - 1);
  return cut(
    (a, b) => chamfer(a - x, b - y, halfWidth, halfDepth, corner) ? roof : "",
    (a, b) => Math.abs(a + y) <= halfDepth && rows(b) ? side : "",
    (a, b) => Math.abs(a + x) <= halfWidth && rows(b) ? front : "",
    (a, b) => Math.abs(a - x) <= halfWidth && rows(b) ? back : "",
  );
}

export function model(width: number, depth: number, height: number, palette: SpriteModel["palette"], parts: Part[]): SpriteModel {
  const slices = Array.from({ length: height }, (_, z) =>
    Array.from({ length: depth }, (_, row) =>
      Array.from({ length: width }, (_, column) => {
        const x = column - Math.floor(width / 2);
        const y = row - Math.floor(depth / 2);
        // Later parts can add trim over a surface or bridge distinct silhouettes.
        for (let i = parts.length - 1; i >= 0; i--) {
          const color = parts[i](x, y, z);
          if (color) return color;
        }
        return ".";
      }).join(""),
    ),
  );
  return { slices, palette: { O: INK, ...palette } };
}
