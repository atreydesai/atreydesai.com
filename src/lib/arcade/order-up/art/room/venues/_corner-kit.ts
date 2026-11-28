/**
 * Shared parts for the Corner Counter, Campus Kiosk, Garden Tea Room and
 * Night Market Stall: lit palettes cached per light (for the per-pixel
 * window views), wall drawing helpers that work on either wall, points on a
 * box's front faces, and the small things those rooms have in common: big
 * potted plants, a door mat, a bike rack, a bike, and rows of buildings
 * seen across a street.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, project, faceLight, type IsoGrid } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import { Painter, noise } from "../../../../core/painter.ts";
import type { PropSpec, WallPlace, Venue } from "../types.ts";
import { ground as groundSurface } from "../surfaces.ts";
import { word, wordWidth, bigWord, bigWidth } from "../font.ts";
import { INK, treeProp } from "../props.ts";
import { FRONT_WALL_BIAS } from "../scene.ts";

export { INK };
export const CREAM = "#fff1dd";

/**
 * A palette lit once per light: `[hex, face]` pairs in, lit colours out.
 * The window views run per pixel; this keeps them to an array read.
 */
export function litSet(defs: readonly (readonly [string, number])[]) {
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

/** Screen point `along` pixels along a wall from a wall item's anchor, `up` pixels above it. */
export function wallPt(place: WallPlace, along: number, up: number) {
  return { x: place.x + place.dir * along, y: place.y + place.slope * along - up };
}

/** A line on the wall from (a, upA) to (b, upB). */
export function wallLine(p: Painter, place: WallPlace, a: number, upA: number, b: number, upB: number, color: string) {
  const A = wallPt(place, a, upA);
  const B = wallPt(place, b, upB);
  p.line(color, A.x, A.y, B.x, B.y);
}

/** A parallelogram on the wall: `w` along from `along`, `h` up from `up`. */
export function wallQuad(p: Painter, place: WallPlace, along: number, up: number, w: number, h: number, color: string) {
  const a = wallPt(place, along, up);
  const b = wallPt(place, along + w, up);
  p.poly(color, [a.x, a.y - h, b.x, b.y - h, b.x, b.y, a.x, a.y]);
}

/** The lit cells of a word in the small face, read once by painting it into a recorder. */
const glyphCache = new Map<string, [number, number][]>();
function glyphCells(text: string) {
  let cells = glyphCache.get(text);
  if (cells) return cells;
  const out: [number, number][] = [];
  const recorder = { fillStyle: "" as unknown, globalAlpha: 1, fillRect: (x: number, y: number) => void out.push([x, y]) };
  word(new Painter(recorder, 256, 8), text, "#000000", 0, 0, 0);
  glyphCache.set(text, (cells = out));
  return cells;
}

/**
 * Words on either wall, reading left to right on screen: they span `along`
 * .. `along + width`, top `up` above the anchor. Columns step down the wall
 * in the same pairs on both walls, so a B on the left wall stays a B.
 */
export function wallWord(p: Painter, place: WallPlace, along: number, up: number, text: string, color: string) {
  const w = wordWidth(text);
  const right = place.dir > 0;
  const x0 = right ? place.x + along : place.x - (along + w - 1);
  const y0 = right ? place.y + place.slope * along - up : place.y + place.slope * (along + w - 1) - up;
  for (const [cx, cy] of glyphCells(text)) {
    const step = Math.round(cx * 0.5);
    p.rect(color, x0 + cx, y0 + cy + (right ? step : -step), 1, 1);
  }
}

/** A one-pixel dot on the wall. */
export function wallDot(p: Painter, place: WallPlace, along: number, up: number, color: string, w = 1, h = 1) {
  const a = wallPt(place, along, up);
  p.rect(color, a.x, a.y - h + 1, w, h);
}

export type Face = "x" | "y";

/**
 * A point on the front face of a box at (x, y), w by d: face "y" looks
 * toward +y (lower left on screen), "x" toward +x (lower right). `s` runs
 * 0..1 left to right as the face is seen; `out` pushes the point off the face.
 */
export function facePt(g: IsoGrid, face: Face, x: number, y: number, w: number, d: number, s: number, z: number, out = 0) {
  return face === "y" ? project(g, x + w * s, y + d + out, z) : project(g, x + w + out, y + d * (1 - s), z);
}

/** A patch of a box's front face from s0..s1 and z0..z1 (pushed `out` off it). */
export function faceQuad(p: Painter, g: IsoGrid, face: Face, box: readonly number[], s0: number, s1: number, z0: number, z1: number, color: string, out = 0) {
  const [x, y, w, d] = box;
  const a = facePt(g, face, x, y, w, d, s0, z0, out);
  const b = facePt(g, face, x, y, w, d, s1, z0, out);
  const c = facePt(g, face, x, y, w, d, s1, z1, out);
  const e = facePt(g, face, x, y, w, d, s0, z1, out);
  p.poly(color, [a.x, a.y, b.x, b.y, c.x, c.y, e.x, e.y]);
}

/** A line across a box's front face. */
export function faceLine(p: Painter, g: IsoGrid, face: Face, box: readonly number[], s0: number, z0: number, s1: number, z1: number, color: string, out = 0) {
  const [x, y, w, d] = box;
  const a = facePt(g, face, x, y, w, d, s0, z0, out);
  const b = facePt(g, face, x, y, w, d, s1, z1, out);
  p.line(color, a.x, a.y, b.x, b.y);
}

/** Words painted on a box's front face, centred at s, top at z. */
export function faceWord(p: Painter, g: IsoGrid, face: Face, box: readonly number[], s: number, z: number, text: string, color: string, out = 0) {
  const [x, y, w, d] = box;
  const c = facePt(g, face, x, y, w, d, s, z, out);
  const width = wordWidth(text);
  // Face "y" falls to the right, face "x" rises to the right.
  const slope = face === "y" ? 0.5 : -0.5;
  word(p, text, color, c.x - Math.floor(width / 2), c.y - Math.round((width / 2) * slope), slope);
}

/** Foliage as the trees do it: a dark under-layer, the leaf colour, a dithered lit side. */
export function leafClump(p: Painter, light: Light, x: number, y: number, r: number, leaf: string, seed: number, share = 1) {
  const f = faceLight(light, share);
  p.oval(light.lit(mixHex(leaf, INK, 0.35), f.right * 0.4), x, y + 1, r, r * 0.8);
  p.oval(light.lit(leaf, f.top * 0.8), x - 1, y, r - 1, (r - 1) * 0.8);
  const side = light.azimuth > 0 ? -1 : 1;
  p.dither(light.lit(mixHex(leaf, "#fff3c8", 0.28), Math.min(1, f.top + 0.2)), x - r * 0.7 + side, y - r * 0.7, r, r * 0.6, 0.5, seed);
}

/** A pot on the floor: a box with a rim, soil on top. Returns the soil's centre point. */
export function pot(p: Painter, g: IsoGrid, light: Light, color: string, size = 0.44, h = 9, share = 0.4, cx = 0.5, cy = 0.5) {
  const o = size / 2;
  isoBox(p, g, light, cx - o, cy - o, size, size, h - 2, { top: "#4a3a32", left: color, right: mixHex(color, INK, 0.25), lip: false }, 0, share);
  isoBox(p, g, light, cx - o - 0.03, cy - o - 0.03, size + 0.06, size + 0.06, 2, { top: "#4a3a32", left: mixHex(color, CREAM, 0.15), right: mixHex(color, INK, 0.15), lip: false }, h - 2, share);
  const c = project(g, cx, cy, h);
  p.alpha(0.3, () => p.oval(INK, c.x, project(g, cx, cy, 0).y + 1, 7, 2));
  return c;
}

/** One monstera leaf: a broad heart on a midrib, slits from the edge in. */
function monsteraLeaf(p: Painter, light: Light, cx: number, cy: number, len: number, ang: number, f: { top: number; left: number }, seed: number) {
  const ca = Math.cos(ang),
    sa = Math.sin(ang);
  const wid = len * 0.62;
  const pts: number[] = [];
  const inner: number[] = [];
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2;
    // A heart: fuller toward the stem end.
    const a = Math.cos(t) * len,
      b = Math.sin(t) * wid * (1 + 0.18 * Math.cos(t));
    pts.push(cx + a * ca - b * sa, cy + (a * sa + b * ca) * 0.7);
    inner.push(cx + (a * 0.82) * ca - (b * 0.78) * sa, cy + ((a * 0.82) * sa + (b * 0.78) * ca) * 0.7 - 0.5);
  }
  const leaf = seed % 2 ? "#5e8a55" : "#56804f";
  p.poly(light.lit(mixHex(leaf, INK, 0.45), 0.1), pts);
  p.poly(light.lit(leaf, f.top * 0.8 + 0.05), inner);
  const hi = light.lit(mixHex(leaf, "#fff3c8", 0.3), Math.min(1, f.top + 0.2));
  const rib = light.lit(mixHex(leaf, "#e8f0c8", 0.25), f.top);
  p.line(rib, cx - len * 0.8 * ca, cy - len * 0.8 * sa * 0.7, cx + len * 0.8 * ca, cy + len * 0.8 * sa * 0.7);
  const slit = light.lit(mixHex(leaf, INK, 0.55), 0);
  for (let k = -2; k <= 2; k++) {
    if (k === 0) continue;
    const along = (k / 3) * len;
    for (const side of [-1, 1]) {
      const x0 = cx + along * ca - side * wid * 0.95 * sa,
        y0 = cy + (along * sa + side * wid * 0.95 * ca) * 0.7;
      const x1 = cx + along * 0.9 * ca - side * wid * 0.35 * sa,
        y1 = cy + (along * 0.9 * sa + side * wid * 0.35 * ca) * 0.7;
      p.line(slit, x0, y0, x1, y1);
    }
  }
  p.rect(hi, cx - Math.round(len * 0.3 * ca) - 1, cy - Math.round(wid * 0.4) - 1, 2, 1);
}

export type PlantKind = "monstera" | "citrus" | "fig" | "palm" | "fern";

/** A big plant in a pot, about a person's height: a monstera, a little citrus tree, a fig, a palm. */
export function plantProp(key: string, x: number, y: number, kind: PlantKind, potColor = "#b8664a", share = 0.4, seed = 1): PropSpec {
  const height = kind === "citrus" ? 40 : kind === "fig" ? 42 : kind === "palm" ? 40 : 32;
  return {
    key,
    x,
    y,
    height,
    pad: 12,
    draw(p, g, light) {
      const c = pot(p, g, light, potColor, kind === "citrus" ? 0.5 : 0.44, kind === "citrus" ? 10 : 9, share);
      const f = faceLight(light, share);
      const stem = light.lit("#4e5b3c", f.left * 0.5);
      if (kind === "monstera") {
        // Big split leaves on long stems, each tilted its own way.
        const leaves: [number, number, number, number][] = [
          [-11, -14, 9, -2.6],
          [10, -16, 9, -0.5],
          [-4, -25, 9, -2.0],
          [7, -27, 8, -1.0],
          [-13, -24, 7, -2.9],
          [1, -18, 8, -1.6],
        ];
        for (const [dx, dy] of leaves) p.line(stem, c.x, c.y - 1, c.x + dx * 0.55, c.y + dy * 0.6);
        leaves.forEach(([dx, dy, len, ang], i) => monsteraLeaf(p, light, c.x + dx, c.y + dy, len, ang, f, i));
      } else if (kind === "citrus" || kind === "fig") {
        const trunk = light.lit("#6a4c3c", f.left);
        p.rect(trunk, c.x - 1, c.y - 14, 2, 14);
        const leaf = kind === "citrus" ? "#5f8a4e" : "#4f7a48";
        const blobs: [number, number, number][] = kind === "citrus" ? [[0, -24, 9], [-6, -20, 6], [6, -19, 6], [-2, -30, 6], [4, -29, 6]] : [[-4, -18, 6], [5, -22, 6], [-2, -29, 6], [4, -33, 5], [-6, -27, 5]];
        blobs.forEach(([dx, dy, r], i) => leafClump(p, light, c.x + dx, c.y + dy, r, leaf, seed + i, share));
        if (kind === "citrus") {
          const fruit = light.lit("#e39a3a", Math.min(1, f.top + 0.3));
          const fruitHi = light.lit("#f6c86a", Math.min(1, f.top + 0.4));
          for (let i = 0; i < 9; i++) {
            const fx = c.x + Math.round((noise(i, seed, 3) - 0.5) * 18);
            const fy = c.y - 18 - Math.round(noise(i, seed, 4) * 14);
            p.rect(fruit, fx, fy, 2, 2);
            p.rect(fruitHi, fx, fy, 1, 1);
          }
        } else {
          // Broad fig leaves catch the light in spots.
          for (let i = 0; i < 7; i++) {
            const fx = c.x + Math.round((noise(i, seed, 5) - 0.5) * 14);
            const fy = c.y - 18 - Math.round(noise(i, seed, 6) * 16);
            p.rect(light.lit("#8fb877", f.top), fx, fy, 2, 1);
          }
        }
      } else if (kind === "palm") {
        // A kentia palm: arching fronds with leaflets hanging off both sides.
        const frond = light.lit("#5f8a4e", f.top * 0.8 + 0.1);
        const hi = light.lit("#86ad6c", Math.min(1, f.top + 0.2));
        const dark = light.lit("#3f5f3a", 0);
        const tips: [number, number][] = [[-16, -14], [15, -16], [-12, -26], [11, -28], [-3, -34], [4, -33], [-17, -22], [17, -22]];
        tips.forEach(([dx, dy], i) => {
          const mx = c.x + dx * 0.35,
            my = c.y + dy * 0.9 - 6;
          p.line(stem, c.x, c.y - 1, mx, my);
          let px = mx,
            py = my;
          for (let k = 1; k <= 6; k++) {
            const t = k / 6;
            const x2 = mx + (c.x + dx - mx) * t;
            const y2 = my + (c.y + dy - my) * t + t * t * 6;
            p.line(i % 3 === 0 ? hi : frond, px, py, x2, y2);
            p.line(dark, x2, y2 + 1, x2 + (dx < 0 ? -1 : 1), y2 + 3);
            p.rect(frond, x2 + (dx < 0 ? 1 : -1), y2 + 1, 1, 2);
            px = x2;
            py = y2;
          }
        });
      } else {
        // A fern: arching fronds.
        const frond = light.lit("#6d9a58", f.top * 0.8);
        const dark = light.lit("#3f5f3a", 0);
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI * (0.1 + (0.8 * i) / 8);
          let px = c.x,
            py = c.y - 1;
          for (let k = 1; k <= 7; k++) {
            const x2 = c.x + Math.cos(a) * k * 2;
            const y2 = c.y - 1 + Math.sin(a) * k * 2 + k * k * 0.18;
            p.line(k > 5 ? dark : frond, px, py, x2, y2);
            if (k > 1) p.rect(frond, x2, y2 + 1, 1, 1);
            px = x2;
            py = y2;
          }
        }
      }
    },
  };
}

/** A mat or rug on the floor, with a border: drawn into the baked floor. */
export function matItem(x: number, y: number, w: number, d: number, color: string, border: string, text?: string) {
  return (p: Painter, g: IsoGrid, light: Light) => {
    const q = (a: number, b: number, c: number, e: number, col: string) => {
      const A = project(g, a, b),
        B = project(g, c, b),
        C = project(g, c, e),
        D = project(g, a, e);
      p.poly(col, [A.x, A.y, B.x, B.y, C.x, C.y, D.x, D.y]);
    };
    q(x, y, x + w, y + d, light.lit(mixHex(border, INK, 0.25), 0.1));
    q(x + 0.04, y + 0.04, x + w - 0.04, y + d - 0.04, light.lit(border, 0.2));
    q(x + 0.12, y + 0.12, x + w - 0.12, y + d - 0.12, light.lit(color, 0.2));
    if (text) {
      const c = project(g, x + w / 2, y + d / 2);
      const tw = wordWidth(text);
      word(p, text, light.lit(border, 0.3), c.x - Math.floor(tw / 2), c.y - 3);
    }
  };
}

/** A bicycle leaning on its stand, from rear hub (u0, v0) to front hub (u1, v1) on a local grid. */
export function bike(p: Painter, g: IsoGrid, light: Light, u0: number, v0: number, u1: number, v1: number, frame: string, share = 1) {
  const f = faceLight(light, share);
  const A = project(g, u0, v0, 5);
  const B = project(g, u1, v1, 5);
  const tyre = light.lit("#2e2a2d", 0);
  const rim = light.lit("#a9abab", f.top);
  for (const W of [A, B]) {
    p.oval(tyre, W.x, W.y, 4, 4);
    p.oval(light.lit("#6f6c70", 0.2), W.x, W.y, 3, 3);
    p.oval(tyre, W.x, W.y, 2, 2);
    p.rect(rim, W.x, W.y, 1, 1);
  }
  const fc = light.lit(frame, Math.max(f.left, f.right));
  const seat = { x: A.x + (B.x - A.x) * 0.3, y: A.y + (B.y - A.y) * 0.3 - 7 };
  const bar = { x: A.x + (B.x - A.x) * 0.85, y: A.y + (B.y - A.y) * 0.85 - 8 };
  const crank = { x: A.x + (B.x - A.x) * 0.45, y: A.y + (B.y - A.y) * 0.45 };
  p.line(fc, A.x, A.y, seat.x, seat.y);
  p.line(fc, seat.x, seat.y + 1, bar.x, bar.y + 1);
  p.line(fc, crank.x, crank.y, seat.x, seat.y);
  p.line(fc, crank.x, crank.y, bar.x, bar.y + 1);
  p.line(fc, bar.x, bar.y, B.x, B.y);
  p.line(fc, A.x, A.y, crank.x, crank.y);
  p.rect(light.lit("#3a3035", 0), seat.x - 2, seat.y - 1, 4, 1);
  p.rect(light.lit("#3a3035", 0), bar.x - 1, bar.y - 1, 3, 1);
}

/** Sheffield stands (steel hoops) along x or y, with bikes locked to some. */
export function bikeRackProp(key: string, x: number, y: number, alongX: boolean, bikes: string[], n = 3): PropSpec {
  return {
    key,
    x,
    y,
    w: alongX ? n * 0.6 : 1,
    d: alongX ? 1 : n * 0.6,
    height: 16,
    pad: 6,
    shadow: "none",
    draw(p, g, light) {
      const steel = light.lit("#6f7274", faceLight(light, 1).top);
      const dark = light.lit("#45474a", 0);
      for (let i = 0; i < n; i++) {
        const o = 0.3 + i * 0.6;
        // A hoop's two feet run across the rack.
        const a = alongX ? project(g, o, 0.25, 0) : project(g, 0.25, o, 0);
        const b = alongX ? project(g, o, 0.75, 0) : project(g, 0.75, o, 0);
        p.line(dark, a.x, a.y, a.x, a.y - 10);
        p.line(dark, b.x, b.y, b.x, b.y - 10);
        p.line(steel, a.x, a.y - 11, b.x, b.y - 11);
        p.rect(steel, a.x, a.y - 11, 1, 1);
        p.rect(steel, b.x, b.y - 11, 1, 1);
        const color = bikes[i];
        if (color) {
          if (alongX) bike(p, g, light, o + 0.12, 0.1, o + 0.12, 0.95, color);
          else bike(p, g, light, 0.1, o + 0.12, 0.95, o + 0.12, color);
        }
      }
    },
  };
}

export interface FacadeSeg {
  /** Width along the row in tiles, height in pixels. */
  w: number;
  h: number;
  wall: string;
  trim: string;
  /** Awning stripes (two colours), or none. */
  awning?: [string, string];
  sign?: string;
  signColor?: string;
  /** Glass of the shop window by day. */
  glass?: string;
  door?: string;
  /** A pitched roof over a house, or a flat parapet. */
  roof?: string;
  /** "shop" has a shop window and an awning at the street; "house" has a stoop door and sash windows. */
  kind?: "shop" | "house" | "hall";
}

/**
 * A row of buildings across a street, its fronts facing the room: shops with
 * awnings and sign bands, houses with sash windows and pitched roofs.
 * Face "y" fronts look toward +y, face "x" fronts toward +x.
 */
export function facadeRow(key: string, x: number, y: number, face: Face, depth: number, segs: readonly FacadeSeg[], seed = 1): PropSpec {
  const length = segs.reduce((a, s) => a + s.w, 0);
  const tallest = Math.max(...segs.map((s) => s.h + (s.roof ? 14 : 4)));
  return {
    key,
    x,
    y,
    w: face === "y" ? length : depth,
    d: face === "y" ? depth : length,
    height: tallest,
    pad: 8,
    draw(p, g, light) {
      const fl = faceLight(light, 1);
      const sun = face === "y" ? fl.left : fl.right;
      const night = light.night > 0.4;
      // Draw from the far end of the row to the near end so nearer buildings overlap.
      let off = 0;
      const placed = segs.map((s) => {
        const at = off;
        off += s.w;
        return { s, at };
      });
      for (const { s, at } of face === "y" ? placed : [...placed].reverse()) {
        const box = face === "y" ? [at, 0, s.w, depth] : [0, length - at - s.w, depth, s.w];
        const wallDark = mixHex(s.wall, INK, 0.28);
        isoBox(p, g, light, box[0], box[1], box[2], box[3], s.h, { top: s.roof ? mixHex(s.wall, INK, 0.35) : mixHex(s.trim, INK, 0.3), left: face === "y" ? s.wall : wallDark, right: face === "x" ? s.wall : wallDark }, 0);
        const trim = light.lit(s.trim, sun);
        const trimDark = light.lit(mixHex(s.trim, INK, 0.35), sun * 0.5);
        // Cornice.
        faceQuad(p, g, face, box, 0, 1, s.h - 3, s.h, trim);
        faceLine(p, g, face, box, 0, s.h - 4, 1, s.h - 4, trimDark);
        if (s.roof) {
          // A pitched roof: the near slope from the eaves up to the ridge.
          const [bx, by, bw, bd] = box;
          const a = facePt(g, face, bx, by, bw, bd, 0, s.h);
          const b = facePt(g, face, bx, by, bw, bd, 1, s.h);
          const back = face === "y" ? -bd * 0.5 : -bw * 0.5;
          const c = facePt(g, face, bx, by, bw, bd, 1, s.h + 12, back);
          const e = facePt(g, face, bx, by, bw, bd, 0, s.h + 12, back);
          p.poly(light.lit(s.roof, fl.top), [a.x, a.y + 1, b.x, b.y + 1, c.x, c.y, e.x, e.y]);
          p.line(light.lit(mixHex(s.roof, INK, 0.4), 0), e.x, e.y, c.x, c.y);
          p.line(light.lit(mixHex(s.roof, CREAM, 0.2), fl.top), a.x, a.y, b.x, b.y);
          // A chimney.
          const ch = facePt(g, face, bx, by, bw, bd, 0.78, s.h + 10, back * 0.6);
          p.rect(light.lit(mixHex(s.wall, INK, 0.1), sun), ch.x - 2, ch.y - 8, 4, 10);
          p.rect(light.lit(INK, 0), ch.x - 2, ch.y - 9, 4, 1);
        }
        const kind = s.kind ?? "shop";
        const glassDay = light.lit(s.glass ?? "#4a5a62", 0.1);
        const lit = "#e9c27c";
        const windowAt = (s0: number, s1: number, z0: number, z1: number, on: boolean) => {
          faceQuad(p, g, face, box, s0 - 0.02, s1 + 0.02, z0 - 1, z1 + 1, trim);
          faceQuad(p, g, face, box, s0, s1, z0, z1, night && on ? lit : glassDay);
          if (!night) faceLine(p, g, face, box, s0 + 0.02, z1 - 1, s0 + (s1 - s0) * 0.5, z1 - 1, light.lit(mixHex(s.glass ?? "#4a5a62", "#dfe8e6", 0.45), 0.3));
        };
        if (kind === "shop") {
          // Shop window, door, sign band, awning.
          windowAt(0.1, 0.6, 3, 18, true);
          faceLine(p, g, face, box, 0.35, 3, 0.35, 18, trim);
          faceQuad(p, g, face, box, 0.68, 0.88, 0, 21, light.lit(s.door ?? mixHex(s.trim, INK, 0.2), sun));
          faceQuad(p, g, face, box, 0.71, 0.85, 11, 18, night ? lit : glassDay);
          faceQuad(p, g, face, box, 0.04, 0.96, 23, 30, light.lit(s.signColor ? mixHex(s.wall, INK, 0.45) : s.trim, sun));
          if (s.sign) faceWord(p, g, face, box, 0.5, 29, s.sign, s.signColor ? (night ? s.signColor : light.lit(s.signColor, sun)) : light.lit(mixHex(s.wall, INK, 0.5), sun));
          if (s.awning) {
            const n = Math.max(4, Math.round(s.w * 5));
            for (let i = 0; i < n; i++) {
              const t0 = 0.06 + (0.88 * i) / n;
              const t1 = 0.06 + (0.88 * (i + 1)) / n;
              const col = light.lit(s.awning[i % 2], fl.top * 0.8);
              const [bx, by, bw, bd] = box;
              const A = facePt(g, face, bx, by, bw, bd, t0, 22),
                B = facePt(g, face, bx, by, bw, bd, t1, 22),
                C = facePt(g, face, bx, by, bw, bd, t1, 16, 0.5),
                D = facePt(g, face, bx, by, bw, bd, t0, 16, 0.5);
              p.poly(col, [A.x, A.y, B.x, B.y, C.x, C.y, D.x, D.y]);
              p.rect(light.lit(s.awning[i % 2], sun), D.x, D.y, Math.max(1, C.x - D.x), 2);
            }
            const [bx, by, bw, bd] = box;
            const L = facePt(g, face, bx, by, bw, bd, 0.06, 14, 0.5);
            const R = facePt(g, face, bx, by, bw, bd, 0.94, 14, 0.5);
            p.line(light.lit(INK, 0), L.x, L.y + 1, R.x, R.y + 1);
          }
        }
        // Upper floors: sash windows in rows.
        const floor0 = kind === "shop" ? 34 : kind === "hall" ? 8 : 6;
        const cols = Math.max(2, Math.round(s.w * (kind === "hall" ? 2.6 : 2)));
        for (let z = floor0; z + 10 < s.h - 3; z += 13) {
          for (let k = 0; k < cols; k++) {
            if (kind === "house" && z === floor0 && k === 0) continue;
            const s0 = (k + 0.28) / cols;
            const s1 = (k + 0.72) / cols;
            windowAt(s0, s1, z, z + 8, noise(k, z, seed) > 0.45);
          }
        }
        if (kind === "house") {
          // The front door up a step.
          faceQuad(p, g, face, box, 0.08, 0.26, 0, 16, light.lit(s.door ?? "#5a6f7a", sun));
          faceQuad(p, g, face, box, 0.06, 0.28, 0, 2, light.lit("#b9b2a4", fl.top));
          faceQuad(p, g, face, box, 0.11, 0.23, 12, 15, night ? lit : glassDay);
        }
      }
    },
  };
}

export interface FrontStyle {
  height: number;
  /** What the outer face is made of. */
  kind: "brick" | "boards" | "panel" | "rail";
  color: string;
  /** Joints, seams or rails. */
  line: string;
  cap: string;
  /** A band along the foot: colour and height. */
  base?: [string, number];
  gapsRight?: number[];
  gapsLeft?: number[];
  /** Posts at the ends of each run and beside every gap. */
  post?: string;
}

/**
 * Low cut-away walls along the two near edges, textured like the walls they
 * stand for (`front` paints them flat), with posts at the doorway.
 */
export function frontWallProps(prefix: string, cols: number, rows: number, s: FrontStyle): PropSpec[] {
  const t = 0.14;
  const out: PropSpec[] = [];
  const seg = (face: Face) => (p: Painter, g: IsoGrid, light: Light) => {
    const w = face === "x" ? t : 1;
    const d = face === "x" ? 1 : t;
    const box = [0, 0, w, d];
    const f = faceLight(light, 0.6);
    const sun = face === "x" ? f.right : f.left;
    if (s.kind === "rail") {
      // Two posts and a top rail with balusters between.
      isoBox(p, g, light, 0, 0, w, d, 2, { top: s.cap, left: s.color, right: s.color }, s.height - 2, 0.6);
      for (let i = 0; i < 4; i++) {
        const sx = (i + 0.5) / 4;
        const a = facePt(g, face, 0, 0, w, d, sx, 0);
        p.line(light.lit(s.line, sun), a.x, a.y, a.x, a.y - s.height + 2);
      }
      return;
    }
    isoBox(p, g, light, 0, 0, w, d, s.height, { top: s.cap, left: s.color, right: s.color }, 0, 0.6);
    const line = light.lit(s.line, sun);
    const b0 = s.base ? s.base[1] : 0;
    if (s.base) {
      faceQuad(p, g, face, box, 0, 1, 0, b0, light.lit(s.base[0], sun));
      faceLine(p, g, face, box, 0, b0, 1, b0, light.lit(mixHex(s.base[0], INK, 0.35), sun * 0.5));
      for (let i = 1; i < 4; i++) faceLine(p, g, face, box, i / 4, 1, i / 4, b0 - 1, light.lit(mixHex(s.base[0], CREAM, 0.3), sun));
    }
    if (s.kind === "brick") {
      let c = 0;
      for (let z = b0 + 4; z < s.height - 1; z += 4, c++) faceLine(p, g, face, box, 0, z, 1, z, line);
      c = 0;
      for (let z = b0; z < s.height - 2; z += 4, c++)
        for (let i = 0; i < 3; i++) {
          const sx = (i + (c & 1 ? 0.5 : 1)) / 3;
          if (sx > 0.02 && sx < 0.98) faceLine(p, g, face, box, sx, z + 1, sx, Math.min(s.height - 1, z + 3), line);
        }
    } else if (s.kind === "boards") {
      for (let z = b0 + 4; z < s.height - 1; z += 4) faceLine(p, g, face, box, 0, z, 1, z, line);
    } else {
      faceQuad(p, g, face, box, 0.1, 0.9, b0 + 2, s.height - 3, light.lit(mixHex(s.color, INK, 0.1), sun));
      faceLine(p, g, face, box, 0.1, s.height - 3, 0.9, s.height - 3, line);
      faceLine(p, g, face, box, 0.1, b0 + 2, 0.1, s.height - 3, line);
    }
  };
  const postAt = (key: string, x: number, y: number): PropSpec => ({
    key,
    x: x - 0.12,
    y: y - 0.12,
    w: 0.24,
    d: 0.24,
    height: s.height + 6,
    depthBias: FRONT_WALL_BIAS,
    draw(p, g, light) {
      isoBox(p, g, light, 0.02, 0.02, 0.2, 0.2, s.height + 3, { top: s.cap, left: s.post ?? s.color, right: mixHex(s.post ?? s.color, INK, 0.2) }, 0, 0.6);
    },
  });
  for (let k = 0; k < rows; k++) {
    if (s.gapsRight?.includes(k)) continue;
    out.push({ key: prefix + ":fr", x: cols - t, y: k, w: t, d: 1, height: s.height + 4, depthBias: FRONT_WALL_BIAS, draw: seg("x") });
  }
  for (let k = 0; k < cols; k++) {
    if (s.gapsLeft?.includes(k)) continue;
    out.push({ key: prefix + ":fl", x: k, y: rows - t, w: 1, d: t, height: s.height + 4, depthBias: FRONT_WALL_BIAS, draw: seg("y") });
  }
  if (s.post) {
    const posts = new Set<string>();
    const add = (x: number, y: number) => posts.add(x + "," + y);
    add(cols, rows);
    add(cols, 0);
    add(0, rows);
    for (const k of s.gapsRight ?? []) {
      add(cols, k);
      add(cols, k + 1);
    }
    for (const k of s.gapsLeft ?? []) {
      add(k, rows);
      add(k + 1, rows);
    }
    for (const at of posts) {
      const [x, y] = at.split(",").map(Number);
      out.push(postAt(prefix + ":post", x, y));
    }
  }
  return out;
}

/**
 * How guests use a shop whose door is the gap at the near corner of its
 * right front wall, with the serve counter at (cols - 2, 2) at the end of a
 * line of counters along the back: in through the gap, up a line straight
 * down from the counter (spilling out of the door when the room is short),
 * pickup in front of the counter beside it, and out past the line.
 */
export function cornerDoorRoute(cols: number, rows: number): Pick<Venue, "doorway" | "entry" | "way" | "queue" | "pickup" | "out"> {
  const x = cols - 1.5;
  const queue: [number, number][] = [];
  for (let y = 3.4; y <= rows - 0.6 + 1e-9 && queue.length < 5; y += 0.75) queue.push([x, y]);
  // The last place indoors is in the doorway itself, then the pavement.
  queue.push([cols - 0.65, rows - 0.55]);
  for (let k = 0; queue.length < 6; k++) queue.push([cols + 0.75 + 0.8 * k, rows - 0.5]);
  const outside = queue[queue.length - 1][0] > cols;
  return {
    doorway: { wall: "front-right", from: rows - 1, to: rows },
    entry: [cols + 2.4, rows - 0.5],
    way: outside ? [] : [[cols + 0.7, rows - 0.5]],
    queue,
    pickup: [cols - 2.25, 3.5],
    out: [
      [cols - 2.25, rows - 0.95],
      [cols - 0.7, rows - 0.5],
      [cols + 0.7, rows - 0.5],
    ],
  };
}

/**
 * A street or park tree that keeps the season: green in spring and summer,
 * russet in autumn, bare branches in winter (with snow on them in snow).
 */
export function seasonTreeProp(key: string, x: number, y: number, crown: string, seed: number, height = 62): PropSpec {
  const green = treeProp(key, x, y, crown, seed, height);
  const autumn = treeProp(key, x, y, seed % 2 ? "#c47a3e" : "#b5653c", seed, height);
  return {
    ...green,
    draw(p, g, light) {
      if (light.season === "autumn") return autumn.draw(p, g, light);
      if (light.season !== "winter") return green.draw(p, g, light);
      const base = project(g, 0.5, 0.5, 0);
      const f = faceLight(light, 1);
      p.alpha(0.3, () => p.oval(INK, base.x, base.y, 4, 1.5));
      const bark = light.lit("#6a4c3c", f.left);
      const dark = light.lit("#4a3530", 0);
      p.rect(bark, base.x - 1, base.y - 24, 3, 24);
      p.rect(dark, base.x + 1, base.y - 24, 1, 24);
      const snow = light.weather === "snow" ? light.lit("#eef0ee", Math.min(1, f.top + 0.3)) : "";
      const limbs: [number, number, number, number][] = [
        [0, -22, -11, -38],
        [1, -20, 12, -40],
        [0, -24, -2, -46],
        [-6, -30, -14, -33],
        [7, -32, 15, -34],
        [-1, -36, 5, -48],
        [-5, -31, -7, -44],
      ];
      limbs.forEach(([x0, y0, x1, y1], i) => {
        p.line(i < 3 ? bark : dark, base.x + x0, base.y + y0, base.x + x1, base.y + y1);
        p.line(dark, base.x + x1, base.y + y1, base.x + x1 + (i % 2 ? 2 : -2), base.y + y1 - 3);
        if (snow) p.rect(snow, base.x + Math.round((x0 + x1) / 2), base.y + Math.round((y0 + y1) / 2) - 1, 2, 1);
      });
      void seed;
    },
  };
}


// ---- The street view: the shop seen front on across the pavement. ----

/** How squarely a street front meets the sun. */
export const frontFace = (light: Light) => Math.min(1, light.sun * 0.55);

/** Running-bond brick drawn front on: a base, alternate bricks, mortar courses from the ground up. */
export function brickFront(p: Painter, light: Light, x: number, y: number, w: number, h: number, base: string, alt: string, mortar: string, seed = 1) {
  const f = frontFace(light);
  p.rect(light.lit(base, f), x, y, w, h);
  const a = light.lit(alt, f);
  const m = light.lit(mortar, f * 0.8);
  for (let r = 0; r * 4 < h; r++) {
    const yy = y + h - 1 - r * 4;
    const y0 = Math.max(y, yy - 3);
    p.rect(m, x, yy, w, 1);
    const off = (r & 1) * 4;
    for (let xx = x - off; xx < x + w; xx += 8) {
      if (xx >= x) p.rect(m, xx, y0, 1, yy - y0);
      if (noise(xx, r, seed) > 0.7) {
        const x0 = Math.max(x, xx + 1),
          x1 = Math.min(x + w, xx + 8);
        if (x1 > x0) p.rect(a, x0, y0, x1 - x0, yy - y0);
      }
    }
  }
}

/** Dressed stone blocks front on. */
export function ashlarFront(p: Painter, light: Light, x: number, y: number, w: number, h: number, base: string, alt: string, joint: string, seed = 1) {
  const f = frontFace(light);
  p.rect(light.lit(base, f), x, y, w, h);
  const a = light.lit(alt, f);
  const j = light.lit(joint, f * 0.8);
  for (let r = 0; r * 8 < h; r++) {
    const yy = y + h - 1 - r * 8;
    const y0 = Math.max(y, yy - 7);
    p.rect(j, x, yy, w, 1);
    const off = (r & 1) * 8;
    for (let xx = x - off; xx < x + w; xx += 16) {
      if (xx >= x) p.rect(j, xx, y0, 1, yy - y0);
      if (noise(xx, r, seed) > 0.66) {
        const x0 = Math.max(x, xx + 1),
          x1 = Math.min(x + w, xx + 16);
        if (x1 > x0) p.rect(a, x0, y0, x1 - x0, yy - y0);
      }
    }
  }
}

/** Window glass from the street: the sky's reflection by day, warm light inside after dark if open. */
export function glassFront(p: Painter, light: Light, x: number, y: number, w: number, h: number, open: boolean, warm = "#f0cf8a") {
  if (light.night > 0.4 && open) {
    p.rect(warm, x, y, w, h);
    p.rect(mixHex(warm, "#fff6dc", 0.4), x, y, w, 1);
    p.dither(mixHex(warm, "#b07a4a", 0.35), x, y + h - 5, w, 5, 0.5);
    return;
  }
  const deep = light.lit(mixHex(light.sky[1], "#3b3440", 0.5), 0.4);
  const refl = light.lit(mixHex(light.sky[2], "#5a5466", 0.25), 0.6);
  p.rect(deep, x, y, w, h);
  const band = Math.max(2, Math.round(h * 0.3));
  p.rect(refl, x, y, w, band);
  p.dither(refl, x, y + band, w, 3, 0.5);
  if (open && h > 12) {
    // A glimpse of the shop inside: a lit shelf line and a row of tins.
    const sy = y + Math.round(h * 0.55);
    p.rect(light.lit("#8a6a50", 0.3, 0.5), x, sy, w, 1);
    for (let i = 3; i < w - 3; i += 5) p.rect(light.lit(["#b8573f", "#d8a05c", "#5f7a5a", "#8e6a9e"][(i >> 2) % 4], 0.3, 0.4), x + i, sy - 3, 3, 3);
  }
  const g = light.lit("#f4f0e4", 0.8);
  for (let k = 0; k < 2; k++) {
    const gx = x + 3 + k * Math.round(w * 0.45);
    for (let s = 0; s < Math.min(6, h - 2); s++) if (gx + s < x + w) p.rect(g, gx + s, y + 1 + Math.min(6, h - 2) - s, 1, 1);
  }
}

/** A sign board with a name on it: the big face when it fits, the small one when not. */
export function signFront(p: Painter, light: Light, text: string, cx: number, y: number, board: string, ink: string, maxW: number, glow = 0.5) {
  const t = text.toUpperCase();
  const big = bigWidth(t) <= maxW - 10;
  const tw = big ? bigWidth(t) : wordWidth(t);
  const h = big ? 11 : 9;
  const w = tw + (big ? 10 : 8);
  const x = Math.round(cx - w / 2);
  p.rect(light.lit(INK, 0), x - 1, y - 1, w + 2, h + 2);
  p.rect(light.lit(board, 0.5), x, y, w, h);
  p.rect(light.lit(mixHex(board, CREAM, 0.25), 0.7), x, y, w, 1);
  p.rect(light.lit(mixHex(board, INK, 0.3), 0.3), x, y + h - 1, w, 1);
  const inkC = light.lit(ink, 0.6, glow);
  if (big) bigWord(p, t, inkC, x + 5, y + 2);
  else word(p, t, inkC, x + 4, y + 2);
  return { x, w, h };
}

/** A striped awning seen from across the street: the lit slope, a scalloped valance, its shade below. */
export function awningFront(p: Painter, light: Light, x: number, y: number, w: number, a: string, b: string, drop = 9) {
  p.alpha(0.22, () => p.rect(INK, x, y + drop + 2, w, 4));
  for (let xx = x; xx < x + w; xx++) {
    const k = Math.floor((xx - x) / 7) % 2;
    const c = k ? b : a;
    p.rect(light.lit(c, 0.75), xx, y, 1, drop);
    p.rect(light.lit(mixHex(c, INK, 0.22), 0.3), xx, y + drop, 1, k ? 2 : 3);
  }
  p.rect(light.lit(INK, 0), x - 1, y - 1, w + 2, 1);
  p.rect(light.lit(mixHex(a, CREAM, 0.4), 0.9), x, y, w, 1);
}

/** A lantern hung from (x, y): a cap, a glowing body, lit after dark. */
export function lanternFront(p: Painter, light: Light, x: number, y: number, color: string) {
  const on = light.night > 0.15;
  p.rect(light.lit("#3a2c2c", 0), x, y, 1, 3);
  if (on) {
    p.alpha(0.18 * light.night, () => p.oval("#ffc070", x, y + 8, 12, 10));
    p.alpha(0.25 * light.night, () => p.oval("#ffd890", x, y + 8, 6, 6));
  }
  p.rect(light.lit(mixHex(color, INK, 0.4), 0.2), x - 2, y + 3, 5, 1);
  p.rect(light.lit(color, 0.5), x - 3, y + 4, 7, 8);
  p.rect(on ? "#ffd27a" : light.lit(mixHex(color, CREAM, 0.35), 0.6), x - 2, y + 5, 5, 6);
  p.rect(light.lit(color, 0.5), x - 3, y + 7, 7, 1);
  p.rect(light.lit(mixHex(color, INK, 0.4), 0.2), x - 2, y + 12, 5, 1);
}

/** A string of bulbs sagging from one point to another. */
export function bulbsFront(p: Painter, light: Light, x0: number, y0: number, x1: number, y1: number, sag = 6, spacing = 7) {
  const on = light.night > 0.15;
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / spacing));
  let px = x0,
    py = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    p.line(light.lit("#3a2c2c", 0), px, py, x, y);
    px = x;
    py = y;
    if (i < n) {
      const c = ["#ffe08a", "#ffb38a", "#c9e6a0", "#ff9a8a"][i % 4];
      p.rect(on ? c : light.lit("#d9c9a4", 0.4), x, y + 1, 2, 2);
      if (on) p.alpha(0.3 * light.night, () => p.rect(c, x - 1, y, 4, 4));
    }
  }
}

/** A street lamp on the pavement. */
export function lampFront(p: Painter, light: Light, x: number, ground: number, h = 54) {
  const post = light.lit("#3e3a3f", 0.2);
  p.rect(post, x - 1, ground - h, 3, h);
  p.rect(post, x - 2, ground - 4, 5, 4);
  p.rect(post, x - 4, ground - h - 2, 9, 2);
  const on = light.night > 0.2;
  p.rect(on ? "#ffe2a0" : light.lit("#d6d2c4", 0.5), x - 3, ground - h, 7, 3);
  if (on) p.alpha(0.2 * light.night, () => p.oval("#ffd890", x, ground - h + 6, 12, 10));
}

/** A clipped shrub or hedge front on, `w` wide and `h` tall, its foot on `ground`. */
export function shrubFront(p: Painter, light: Light, x: number, ground: number, w: number, h: number, leaf: string, seed = 1, round = false) {
  const f = Math.min(1, light.sun * 0.6);
  const dark = light.lit(mixHex(leaf, INK, 0.35), f * 0.4);
  const mid = light.lit(leaf, f);
  const hi = light.lit(mixHex(leaf, "#fff3c8", 0.25), Math.min(1, f + 0.2));
  if (round) {
    const cx = x + w / 2,
      cy = ground - h / 2;
    p.oval(dark, cx, cy + 1, w / 2, h / 2);
    p.oval(mid, cx - 1, cy, w / 2 - 1, h / 2 - 1);
    p.dither(hi, cx - w / 2 + 1, cy - h / 2 + 1, w * 0.6, h * 0.5, 0.45, seed);
    return;
  }
  p.rect(dark, x, ground - h, w, h);
  p.rect(mid, x + 1, ground - h + 1, w - 2, h - 3);
  for (let i = 0; i < w; i += 3) p.rect(dark, x + i, ground - h + 4 + Math.floor(noise(i, seed, 2) * (h - 6)), 2, 1);
  p.dither(hi, x + 1, ground - h + 1, w - 2, 3, 0.5, seed);
}

// Lawns that keep the season: green, then straw and fallen leaves, then dull winter grass.
const LAWN_GREEN = [groundSurface("#7f9a62", "#86a368", "#9bb67a", 0.06, 5), groundSurface("#8aa56b", "#91ad71", "#a3bd80", 0.06, 6)];
const LAWN_AUTUMN = [groundSurface("#8f9a5e", "#97a163", "#b0a86a", 0.06, 5), groundSurface("#99a266", "#a1a96b", "#b8ae72", 0.06, 6)];
const LAWN_WINTER = [groundSurface("#7c8a6a", "#82906e", "#96a080", 0.06, 5), groundSurface("#849170", "#8a9774", "#9ca684", 0.06, 6)];

/** The lawn at a ground point, mown in stripes `stripe` 0 or 1, in the light's season. */
export function lawnAt(x: number, y: number, light: Light | undefined, stripe: number) {
  const season = light?.season;
  if (season === "autumn" && noise(Math.floor(x * 12), Math.floor(y * 12), 79) > 0.975) return noise(Math.floor(x * 12), Math.floor(y * 12), 80) > 0.5 ? "#c47a3e" : "#d9a055";
  const s = (season === "autumn" ? LAWN_AUTUMN : season === "winter" ? LAWN_WINTER : LAWN_GREEN)[stripe & 1];
  return s.colors[s.at(x * 24, y * 24)];
}
