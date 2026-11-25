// Colour as the scenes mix it: hex strings in, `[r, g, b]` triples between.

export type RGB = [number, number, number];

/** `#rrggbb` to `[r, g, b]`. */
export function hexToRgb(hex: string): RGB {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** `[r, g, b]` (0..255, rounded) to `#rrggbb`. */
export function rgbToHex(color: ArrayLike<number>) {
  let out = "#";
  for (let i = 0; i < 3; i++) out += Math.round(color[i]).toString(16).padStart(2, "0");
  return out;
}

/** The colour `t` of the way from `a` to `b`, each channel rounded. */
export function mixRgb(a: ArrayLike<number>, b: ArrayLike<number>, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Two hex colours mixed, `t` (clamped to 0..1) of the way from `a` to `b`. */
export function mixHex(a: string, b: string, t: number) {
  return rgbToHex(mixRgb(hexToRgb(a), hexToRgb(b), t < 0 ? 0 : t > 1 ? 1 : t));
}
