/**
 * Shared parts for the Boardwalk Shack, Mountain Lodge, Commissary and Lunar
 * Tea Outpost: surfaces with painted regions (so rugs, sand and safety lines
 * still take the sun patches and lamp pools), palettes lit once per light
 * for the per-pixel views, drawing in a wall's own plane or on a box's
 * faces, and textured low front walls.
 */
import { isoBox, project, type IsoGrid } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import type { Surface } from "../surfaces.ts";
import type { PropSpec, WallPlace } from "../types.ts";
import { word, wordWidth } from "../font.ts";

/**
 * A surface with extra colour slots painted over it: `pick` returns an index
 * into `extra`, or -1 where the base shows. Keep `pick` O(1).
 */
export function overlay(base: Surface, extra: readonly string[], pick: (u: number, v: number) => number): Surface {
  const n = base.colors.length;
  return {
    colors: [...base.colors, ...extra],
    at(u, v) {
      const k = pick(u, v);
      return k < 0 ? base.at(u, v) : n + k;
    },
  };
}

/**
 * A noise surface baked once into a square tile of slots, so a per-pixel
 * ground reads an array instead of hashing twice. Only for surfaces with no
 * structure wider than the tile (grain and blotches), or the seams show.
 */
export function tiled(s: Surface, size = 128) {
  const slots = new Uint8Array(size * size);
  for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) slots[v * size + u] = s.at(u, v);
  const mask = size - 1;
  const colors = s.colors;
  return (u: number, v: number) => colors[slots[(Math.floor(v) & mask) * size + (Math.floor(u) & mask)]];
}

/** A palette lit once per light (`[hex, face]` in, lit colours out), for views that run per pixel. */
export function litOnce(defs: readonly (readonly [string, number])[]) {
  let last: Light | null = null;
  let out: string[] = [];
  return (light: Light) => {
    if (light !== last) {
      last = light;
      out = defs.map(([hex, face]) => light.lit(hex, face));
    }
    return out;
  };
}

/** A 0..1 table of `n` values, filled once at module load. */
export function table(n: number, f: (i: number) => number) {
  const t = new Float32Array(n);
  for (let i = 0; i < n; i++) t[i] = f(i);
  return t;
}

// Drawing in a wall's plane: `along` pixels from the item's anchor, `up` pixels above it.

export function wpt(place: WallPlace, along: number, up: number) {
  return { x: place.x + place.dir * along, y: place.y + place.slope * along - up };
}

export function wline(p: Painter, place: WallPlace, a: number, upA: number, b: number, upB: number, color: string) {
  const A = wpt(place, a, upA);
  const B = wpt(place, b, upB);
  p.line(color, A.x, A.y, B.x, B.y);
}

/** A parallelogram on the wall: `w` along from `along`, `h` up from `up`. */
export function wquad(p: Painter, place: WallPlace, along: number, up: number, w: number, h: number, color: string) {
  const a = wpt(place, along, up);
  const b = wpt(place, along + w, up);
  p.poly(color, [a.x, a.y - h, b.x, b.y - h, b.x, b.y, a.x, a.y]);
}

export function wdot(p: Painter, place: WallPlace, along: number, up: number, color: string, w = 1, h = 1) {
  const a = wpt(place, along, up);
  p.rect(color, a.x, a.y - h + 1, w, h);
}

/** A filled disc in the wall's plane (it shears with the wall), centre (ca, cu), radius r. */
export function wdisc(p: Painter, place: WallPlace, ca: number, cu: number, r: number, color: string, ry = r) {
  for (let a = -Math.floor(r); a <= r; a++) {
    const h = ry * Math.sqrt(Math.max(0, 1 - (a / r) ** 2));
    if (h < 0.3) continue;
    const top = wpt(place, ca + a, cu + h);
    p.rect(color, top.x, top.y, 1, Math.max(1, Math.round(h * 2)));
  }
}

/** A ring in the wall's plane. */
export function wring(p: Painter, place: WallPlace, ca: number, cu: number, r: number, color: string, ry = r) {
  const n = Math.ceil((r + ry) * 3.4);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const q = wpt(place, ca + Math.cos(t) * r, cu + Math.sin(t) * ry);
    p.rect(color, q.x, q.y, 1, 1);
  }
}

/** Pixel words on either wall reading left to right on screen, spanning `along`..`along + width`, top `up`. */
export function wword(p: Painter, place: WallPlace, along: number, up: number, text: string, color: string) {
  const w = wordWidth(text);
  const a = place.dir > 0 ? along : along + w - 1;
  word(p, text, color, place.x + place.dir * a, place.y + place.slope * a - up, place.slope * place.dir);
}

// Points on a box's faces. Face "left" looks toward +y (lower left on screen), "right" toward +x.
// `s` runs 0..1 left to right as the face is seen, `z` is pixels up.

export type Box = readonly [number, number, number, number];

export function fpt(g: IsoGrid, face: "left" | "right", b: Box, s: number, z: number) {
  const [x, y, w, d] = b;
  return face === "left" ? project(g, x + w * s, y + d, z) : project(g, x + w, y + d * (1 - s), z);
}

export function fquad(p: Painter, g: IsoGrid, face: "left" | "right", b: Box, s0: number, s1: number, z0: number, z1: number, color: string) {
  const A = fpt(g, face, b, s0, z0);
  const B = fpt(g, face, b, s1, z0);
  const C = fpt(g, face, b, s1, z1);
  const D = fpt(g, face, b, s0, z1);
  p.poly(color, [A.x, A.y, B.x, B.y, C.x, C.y, D.x, D.y]);
}

export function fline(p: Painter, g: IsoGrid, face: "left" | "right", b: Box, s0: number, z0: number, s1: number, z1: number, color: string) {
  const A = fpt(g, face, b, s0, z0);
  const B = fpt(g, face, b, s1, z1);
  p.line(color, A.x, A.y, B.x, B.y);
}

/** A point on a box's top at (u, v) tiles from its back corner, `z` up. */
export function tpt(g: IsoGrid, b: Box, u: number, v: number, z: number) {
  return project(g, b[0] + u, b[1] + v, z);
}

export interface FrontSpec {
  key: string;
  height: number;
  top: string;
  face: string;
  gapsLeft?: number[];
  gapsRight?: number[];
  /** Thickness in tiles. */
  t?: number;
  /** Detail on the outer face (`face` "left" on the near-left edge, "right" on the near-right). */
  draw?: (p: Painter, g: IsoGrid, light: Light, face: "left" | "right", box: Box, k: number) => void;
  /** Segments whose drawing differs by position need their own atlas cells. */
  vary?: boolean;
}

/**
 * Low cut-away walls on the two near edges, one sprite a tile, like the
 * scene's own `front` but with a textured outer face.
 */
export function frontWalls(cols: number, rows: number, f: FrontSpec): PropSpec[] {
  const t = f.t ?? 0.14;
  const out: PropSpec[] = [];
  for (let k = 0; k < rows; k++) {
    if (f.gapsRight?.includes(k)) continue;
    const box: Box = [0, 0, t, 1];
    out.push({
      key: `${f.key}:r${f.vary ? k : ""}`,
      x: cols - t,
      y: k,
      w: t,
      d: 1,
      height: f.height + 4,
      draw(p, g, light) {
        isoBox(p, g, light, 0, 0, t, 1, f.height, { top: f.top, left: f.face, right: f.face }, 0, 0.6);
        f.draw?.(p, g, light, "right", box, k);
      },
    });
  }
  for (let k = 0; k < cols; k++) {
    if (f.gapsLeft?.includes(k)) continue;
    const box: Box = [0, 0, 1, t];
    out.push({
      key: `${f.key}:l${f.vary ? k : ""}`,
      x: k,
      y: rows - t,
      w: 1,
      d: t,
      height: f.height + 4,
      draw(p, g, light) {
        isoBox(p, g, light, 0, 0, 1, t, f.height, { top: f.top, left: f.face, right: f.face }, 0, 0.6);
        f.draw?.(p, g, light, "left", box, k);
      },
    });
  }
  return out;
}
