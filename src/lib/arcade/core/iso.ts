// Isometric rooms on a 2:1 grid. A tile's x runs down to the right and its
// y down to the left, so the room's back corner is at the top and its two
// back walls run down-left (x = 0) and down-right (y = 0). Anything that
// stands is set down by its ground point and drawn in order of that point,
// back to front, so a counter covers the chef behind it and the chef covers
// the counter behind him. Boxes are lit per face from a `Light`: the top by
// how high the sun is, the left and right faces by which side it is on.
// DOM-free.

import type { Painter, Points } from "./painter.ts";
import type { Light } from "./light.ts";
import { mixHex } from "./color.ts";

export interface IsoGrid {
  /** Screen position of tile (0, 0)'s back corner. */
  ox: number;
  oy: number;
  /** Half a tile's width and height on screen (2:1, so hw = 2 · hh). */
  hw: number;
  hh: number;
}

/** Screen point of a ground position in tiles, lifted `z` pixels. */
export function project(g: IsoGrid, x: number, y: number, z = 0) {
  return { x: g.ox + (x - y) * g.hw, y: g.oy + (x + y) * g.hh - z };
}

/** Ground position in tiles under a screen point (z = 0). */
export function unproject(g: IsoGrid, sx: number, sy: number) {
  const a = (sx - g.ox) / g.hw;
  const b = (sy - g.oy) / g.hh;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Draw order for something standing at ground (x, y): further back first; `lift` breaks ties upward. */
export const depthOf = (x: number, y: number, lift = 0) => (x + y) * 1000 + lift;

/** How squarely each face of a box meets the light: 0 shade .. 1 full sun. */
export function faceLight(light: Light, indoorShare = 1) {
  const s = light.sun * indoorShare;
  const [sx, sy] = light.sunDir;
  // Walls catch low sun best; tops catch high sun.
  const side = 1 - light.elevation * 0.45;
  const top = s * (0.4 + 0.6 * light.elevation);
  const left = s * Math.max(0, sy) * side;
  const right = s * Math.max(0, sx) * side;
  const q = (n: number) => Math.round(Math.min(1, n) * 8) / 8;
  return { top: q(top), left: q(left), right: q(right) };
}

export interface BoxStyle {
  /** Base colours; side faces darken from `top` unless given. */
  top: string;
  left?: string;
  right?: string;
  /** Outline colour along the silhouette ("" for none). */
  ink?: string;
  /** A one-pixel light lip along the top's front edges. */
  lip?: string | false;
}

/**
 * A box on the ground: `w` tiles along x, `d` along y, `h` pixels high,
 * its back corner at ground (x, y) lifted `z` pixels. Faces lit by `light`.
 * Returns the faces' corner lists for detailing.
 */
export function isoBox(p: Painter, g: IsoGrid, light: Light | null, x: number, y: number, w: number, d: number, h: number, style: BoxStyle, z = 0, share = 1) {
  const P0 = project(g, x, y, z);
  const P1 = project(g, x + w, y, z);
  const P2 = project(g, x + w, y + d, z);
  const P3 = project(g, x, y + d, z);
  const top: Points = [P0.x, P0.y - h, P1.x, P1.y - h, P2.x, P2.y - h, P3.x, P3.y - h];
  const left: Points = [P3.x, P3.y - h, P2.x, P2.y - h, P2.x, P2.y, P3.x, P3.y];
  const right: Points = [P2.x, P2.y - h, P1.x, P1.y - h, P1.x, P1.y, P2.x, P2.y];
  const f = light ? faceLight(light, share) : { top: 0.6, left: 0.3, right: 0.1 };
  const lit = (hex: string, face: number) => (light ? light.lit(hex, face) : hex);
  const leftBase = style.left ?? mixHex(style.top, "#2a2024", 0.22);
  const rightBase = style.right ?? mixHex(style.top, "#2a2024", 0.38);
  if (h > 0) {
    p.poly(lit(leftBase, f.left), left);
    p.poly(lit(rightBase, f.right), right);
  }
  p.poly(lit(style.top, f.top), top);
  const ink = style.ink ?? "#2b2126";
  if (ink) {
    p.line(ink, P3.x, P3.y, P2.x, P2.y);
    p.line(ink, P2.x, P2.y, P1.x, P1.y);
    p.line(ink, P3.x, P3.y - h, P3.x, P3.y);
    p.line(ink, P1.x, P1.y - h, P1.x, P1.y);
    p.line(ink, P3.x, P3.y - h, P0.x, P0.y - h);
    p.line(ink, P0.x, P0.y - h, P1.x, P1.y - h);
  }
  if (style.lip !== false) {
    const lip = lit(style.lip ?? mixHex(style.top, "#fff4dc", 0.35), Math.min(1, f.top + 0.25));
    p.line(lip, P3.x + 1, P3.y - h, P2.x, P2.y - h);
    p.line(lip, P2.x, P2.y - h, P1.x - 1, P1.y - h);
  }
  if (ink && h > 0) p.line(mixHex(ink, leftBase, 0.35), P2.x, P2.y - h + 1, P2.x, P2.y - 1);
  return { P0, P1, P2, P3, top, left, right, h };
}

/** A flat diamond on the ground or on a surface (a rug, a shadow, a tray). */
export function isoTile(p: Painter, g: IsoGrid, x: number, y: number, w: number, d: number, color: string, z = 0) {
  const A = project(g, x, y, z);
  const B = project(g, x + w, y, z);
  const C = project(g, x + w, y + d, z);
  const D = project(g, x, y + d, z);
  p.poly(color, [A.x, A.y, B.x, B.y, C.x, C.y, D.x, D.y]);
}
