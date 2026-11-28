/**
 * Small helpers the station, harbor and loft builds share: words and rings
 * painted along a wall's slope, rims for arched and round glass (the baker
 * cuts those shapes but frames only straight edges), a per-light palette
 * cache for window views, and a check that a `far` call is the room's own.
 */
import type { Painter } from "../../../../core/painter.ts";
import type { Light } from "../../../../core/light.ts";
import type { IsoGrid } from "../../../../core/iso.ts";
import { mixHex } from "../../../../core/color.ts";
import type { Venue, WallItem, WallPlace, WindowSpec } from "../types.ts";
import { roomGrid, groundGrid, sunPatches, HW } from "../scene.ts";
import { word, wordWidth } from "../font.ts";
import { bayer } from "../../../../core/dither.ts";

export const INK = "#2b2126";
export const CREAM = "#fff1dd";

/** Screen point of (along, up) pixels on a wall from its place. */
export function wallAt(place: WallPlace, along: number, up: number) {
  return { x: place.x + place.dir * along, y: place.y + place.slope * along - up };
}

/** A word on a wall, its left end (as read) `along` pixels in and its top `up` pixels above the place. */
export function wallWord(p: Painter, place: WallPlace, along: number, up: number, text: string, color: string) {
  const w = wordWidth(text);
  const a = place.dir > 0 ? along : along + w - 1;
  const at = wallAt(place, a, up);
  word(p, text, color, at.x, at.y, place.slope * place.dir);
}

/** A run of one-pixel cells along the wall (a line `len` long at height `up`). */
export function wallRun(p: Painter, place: WallPlace, along: number, up: number, len: number, color: string, thick = 1) {
  for (let i = 0; i < len; i++) {
    const at = wallAt(place, along + i, up);
    p.rect(color, at.x, at.y, 1, thick);
  }
}

/** A filled box on the wall, `w` along and `h` up from (along, up). */
export function wallBox(p: Painter, place: WallPlace, along: number, up: number, w: number, h: number, color: string) {
  const d = place.dir;
  const s = place.slope;
  const x0 = place.x + d * along;
  const y0 = place.y + s * along - up;
  p.poly(color, [x0, y0 - h, x0 + d * w, y0 + s * w - h, x0 + d * w, y0 + s * w, x0, y0]);
}

/** Ring cells of an ellipse on the wall centred (ca, cu), from angle a0 to a1 (0 = along, PI/2 = up). */
export function wallArc(p: Painter, place: WallPlace, ca: number, cu: number, ra: number, ru: number, color: string, a0 = 0, a1 = Math.PI * 2, size = 1) {
  const steps = Math.max(12, Math.ceil(Math.max(ra, ru) * (a1 - a0) * 1.4));
  for (let i = 0; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps;
    const at = wallAt(place, ca + Math.cos(t) * ra, cu + Math.sin(t) * ru);
    p.rect(color, Math.round(at.x), Math.round(at.y), size, size);
  }
}

/** The curved frame of an arched window: rim, keystone and a fan of glazing bars. */
export function archRim(win: WindowSpec, iron: string, fan = 3): WallItem {
  return {
    wall: win.wall,
    at: win.at,
    z: win.sill,
    draw(p, light, place) {
      const rx = (win.width / 2) * HW;
      const rz = rx * 0.7;
      const cu = win.top - rz - win.sill;
      const frame = light.lit(iron, 0.2);
      const hi = light.lit(mixHex(iron, CREAM, 0.35), 0.4);
      // The rim, two cells deep, and a lighter inner lip.
      wallArc(p, place, rx, cu, rx - 0.5, rz - 0.5, frame, 0, Math.PI);
      wallArc(p, place, rx, cu, rx - 1.5, rz - 1.5, frame, 0, Math.PI);
      wallArc(p, place, rx, cu, rx + 1, rz + 1, light.lit(mixHex(iron, INK, 0.4), 0), 0.08, Math.PI - 0.08);
      // Fan bars from the springing line's middle.
      for (let k = 1; k <= fan; k++) {
        const t = (Math.PI * k) / (fan + 1);
        for (let r = 3; r < rx - 1; r += 0.5) {
          const at = wallAt(place, rx + Math.cos(t) * r, cu + Math.sin(t) * r * (rz / rx));
          p.rect(frame, Math.round(at.x), Math.round(at.y), 1, 1);
        }
      }
      wallArc(p, place, rx, cu, 3, 2, frame, 0, Math.PI);
      wallRun(p, place, 1, cu, Math.round(rx * 2) - 2, frame);
      // Keystone over the crown.
      wallBox(p, place, rx - 3, win.top - win.sill + 1, 6, 5, light.lit(mixHex(iron, CREAM, 0.6), 0.3));
      wallBox(p, place, rx - 2, win.top - win.sill + 2, 4, 3, hi);
    },
  };
}

/** A porthole's brass ring and its bolts. */
export function portholeRim(win: WindowSpec, brass: string): WallItem {
  return {
    wall: win.wall,
    at: win.at,
    z: win.sill,
    draw(p, light, place) {
      const ra = (win.width / 2) * HW;
      const ru = (win.top - win.sill) / 2;
      const dark = light.lit(mixHex(brass, INK, 0.45), 0.1);
      const mid = light.lit(brass, 0.4);
      const hi = light.lit(mixHex(brass, CREAM, 0.45), 0.6);
      wallArc(p, place, ra, ru, ra + 2, ru + 2, dark);
      wallArc(p, place, ra, ru, ra + 1, ru + 1, mid);
      wallArc(p, place, ra, ru, ra, ru, mid);
      wallArc(p, place, ra, ru, ra + 1, ru + 1, hi, Math.PI * 0.55, Math.PI * 0.95);
      wallArc(p, place, ra, ru, ra - 1, ru - 1, dark, Math.PI * 1.1, Math.PI * 1.9);
      for (let k = 0; k < 6; k++) {
        const t = (Math.PI * 2 * k) / 6 + 0.3;
        const at = wallAt(place, ra + Math.cos(t) * (ra + 3), ru + Math.sin(t) * (ru + 3));
        p.rect(hi, Math.round(at.x), Math.round(at.y), 1, 1);
      }
    },
  };
}

/**
 * Colours lit once per light and kept for every pixel of a window view:
 * `defs` are [hex, face, glow]; the list is rebuilt when the light changes.
 */
export function litCache(defs: readonly (readonly [string, number, number])[]) {
  let key = "";
  let out: string[] = [];
  return (light: Light) => {
    if (light.key !== key) {
      key = light.key;
      out = defs.map(([hex, face, glow]) => light.lit(hex, face, glow));
    }
    return out;
  };
}

/** The room's ground grid when `far` is painting the room's own backdrop (not the street view's). */
export function roomGround(v: Venue, width: number, horizon: number): IsoGrid | null {
  const g = roomGrid(v, width);
  const expected = Math.max(16, g.oy - (v.wallHeight ?? 80) - 18);
  return horizon === expected ? groundGrid(v, g) : null;
}

/** A stable 0..1 hash for integer cells, cheap enough for per-pixel shaders. */
export function hash(x: number, y: number, seed = 0) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * A palm or fern frond: a spine from (x0, y0) arching `arch` pixels up on
 * its way to (x0 + ex, y0 + ey), leaflets hanging off both sides.
 */
export function frond(p: Painter, x0: number, y0: number, ex: number, ey: number, arch: number, spine: string, leaf: string, tip: string, leaflet = 4) {
  const n = Math.max(6, Math.round(Math.hypot(ex, ey) / 1.5));
  let px = x0,
    py = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + ex * t);
    const y = Math.round(y0 + ey * t - arch * 4 * t * (1 - t));
    p.line(spine, px, py, x, y);
    if (i > 1 && i % 2 === 0) {
      const len = Math.max(2, Math.round(leaflet * (1 - Math.abs(t - 0.45))));
      const side = ex >= 0 ? 1 : -1;
      p.line(leaf, x, y + 1, x - side * Math.round(len * 0.4), y + len);
      p.line(i % 4 === 0 ? tip : leaf, x, y + 1, x + side * Math.round(len * 0.7), y + len - 1);
    }
    px = x;
    py = y;
  }
}

/**
 * A lamp's pool on the ground outside, lit the way the baker lights the
 * floor indoors: each pixel keeps its own ground colour and takes the lamp
 * in Bayer-dithered steps, strongest at the centre. For `far` hooks only
 * (it reads `ground` per pixel), so keep the pools few and small.
 */
export function groundPool(p: Painter, g: IsoGrid, v: Venue, light: Light, x: number, y: number, reach: number, strength = 1) {
  const c = { x: g.ox + (x - y) * g.hw, y: g.oy + (x + y) * g.hh };
  const rx = reach * g.hw * 1.42,
    ry = reach * g.hh * 1.42;
  const memo = new Map<string, string>();
  for (let sy = Math.floor(c.y - ry); sy < c.y + ry; sy++)
    for (let sx = Math.floor(c.x - rx); sx < c.x + rx; sx++) {
      const a = (sx + 0.5 - g.ox) / g.hw,
        b = (sy + 0.5 - g.oy) / g.hh;
      const tx = (a + b) / 2,
        ty = (b - a) / 2;
      const d = Math.hypot(tx - x, ty - y) / reach;
      if (d >= 1) continue;
      const level = Math.min(4, Math.floor((1 - d) ** 1.4 * strength * 4 + bayer(sx, sy) * 0.999));
      if (level <= 0) continue;
      const base = v.outside.ground(tx, ty, light);
      const k = base + level;
      let col = memo.get(k);
      if (!col) memo.set(k, (col = light.lit(base, 0, level / 4)));
      p.rect(col, sx, sy, 1, 1);
    }
}

/** Fog or rain haze laid over the backdrop from the horizon down, thinning toward the viewer. */
export function weatherHaze(p: Painter, light: Light, width: number, horizon: number, depth: number) {
  const thick = light.weather === "fog" ? 0.9 : light.weather === "rain" ? 0.4 : light.weather === "snow" ? 0.35 : 0;
  if (!thick) return;
  const veil = light.sky[2];
  p.dither(veil, 0, 0, width, horizon, thick * 0.6);
  for (let k = 0; k < depth; k++) p.dither(veil, 0, horizon + k, width, 1, thick * (1 - k / depth) ** 1.5);
}

/**
 * A flat thing on the floor (a rug, an inlay) painted per pixel and lit the
 * way the baker lights the floor under it: the windows' sun patches and the
 * lamps' pools both fall across it. `color` gives the base colour at a
 * floor position in tiles, or null where the thing isn't. `box` bounds it.
 */
export function floorShader(v: () => Venue, box: [number, number, number, number], color: (x: number, y: number) => string | null) {
  return (p: Painter, g: IsoGrid, light: Light) => {
    const venue = v();
    const patches = sunPatches(venue, light);
    const memo = new Map<string, string>();
    const [x0, y0, x1, y1] = box;
    const left = g.ox + (x0 - y1) * g.hw,
      right = g.ox + (x1 - y0) * g.hw;
    const top = g.oy + (x0 + y0) * g.hh,
      bottom = g.oy + (x1 + y1) * g.hh;
    for (let sy = Math.floor(top); sy < bottom; sy++)
      for (let sx = Math.floor(left); sx < right; sx++) {
        const a = (sx + 0.5 - g.ox) / g.hw,
          b = (sy + 0.5 - g.oy) / g.hh;
        const tx = (a + b) / 2,
          ty = (b - a) / 2;
        if (tx < x0 || tx > x1 || ty < y0 || ty > y1) continue;
        const hex = color(tx, ty);
        if (!hex) continue;
        let sun = 0;
        for (const patch of patches) if (inQuad(patch.quad, tx, ty)) sun = Math.max(sun, patch.strength);
        let glow = 0;
        for (const l of venue.lamps) {
          const d = Math.hypot(tx - l.x, ty - l.y) / (l.reach ?? 2.2);
          if (d < 1) glow = Math.max(glow, (1 - d) ** 1.4);
        }
        const level = Math.min(4, Math.floor(glow * 4 + bayer(sx, sy) * 0.999));
        const face = Math.round(sun * 8) / 8;
        const k = hex + face + "|" + level;
        let c = memo.get(k);
        if (!c) memo.set(k, (c = light.lit(hex, face, level / 4)));
        p.rect(c, sx, sy, 1, 1);
      }
  };
}

function inQuad(q: number[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const xi = q[i * 2],
      yi = q[i * 2 + 1],
      xj = q[j * 2],
      yj = q[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
