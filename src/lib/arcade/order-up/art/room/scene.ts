/**
 * Bakes a venue at one light into three things the room canvas blits every
 * frame: an opaque background (the world outside, the floor with its sun
 * patches and lamp pools, the walls with their windows, doors and
 * everything hung on them), an atlas of everything that stands (sorted with
 * the people each frame), and a clear overhead layer (lamps, bunting).
 * Baking is pure: a light and a venue in, pixel buffers out.
 */
import { Painter, noise } from "../../../core/painter.ts";
import { PixelBuffer, packColor } from "../../../core/pixel-buffer.ts";
import { bayer } from "../../../core/dither.ts";
import { project, unproject, isoBox, type IsoGrid } from "../../../core/iso.ts";
import { bakeAtlas, type AtlasEntry, type AtlasFrame } from "../../../core/atlas.ts";
import { mixHex } from "../../../core/color.ts";
import type { Light } from "../../../core/light.ts";
import type { Venue, PropSpec, WallSide, WindowSpec, DoorSpec, WallPlace } from "./types.ts";

export const ROOM_HEIGHT = 270;
export const HW = 24;
export const HH = 12;
export const WALL = 80;
const SLAB = 6;
/** Screen pixels of height per tile of ground distance, for sun patches. */
const PX_PER_TILE = 26;
const INK = "#2b2126";

export interface PlacedSprite {
  key: string;
  /** Screen anchor (the footprint's back corner). */
  x: number;
  y: number;
  depth: number;
  flat?: boolean;
}

export interface BakedRoom {
  width: number;
  height: number;
  grid: IsoGrid;
  light: Light;
  background: PixelBuffer;
  overhead: PixelBuffer;
  atlas: PixelBuffer;
  frames: Map<string, AtlasFrame>;
  sprites: PlacedSprite[];
  /** Screen polygon of the room (walls and floor), for keeping weather outside. */
  silhouette: number[];
  horizon: number;
}

/** Pixel height of a venue's canvas: 270, or taller for a big room (drawn smaller on screen). */
export function roomHeight(v: Venue) {
  const wall = v.wallHeight ?? WALL;
  return Math.max(ROOM_HEIGHT, wall + (v.cols + v.rows) * HH + (v.slabHeight ?? SLAB) + 30);
}

/** Where a venue's room sits on a canvas `width` wide. */
export function roomGrid(v: Venue, width: number): IsoGrid {
  const wall = v.wallHeight ?? WALL;
  const total = wall + (v.cols + v.rows) * HH + (v.slabHeight ?? SLAB);
  const top = Math.round((roomHeight(v) - total) / 2 + 4);
  return { ox: Math.round(width / 2 - ((v.cols - v.rows) * HW) / 2), oy: top + wall, hw: HW, hh: HH };
}

/** Value noise, bilinear between lattice points: a smooth 0..1 field. */
function smoothNoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const fx = x - x0,
    fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const a = noise(x0, y0, seed),
    b = noise(x0 + 1, y0, seed),
    c = noise(x0, y0 + 1, seed),
    d = noise(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** The ground outside sits a slab below the room's floor. */
export function groundGrid(v: Venue, g: IsoGrid): IsoGrid {
  return { ...g, oy: g.oy + (v.slabHeight ?? SLAB) };
}

/** Lit colours as packed words, cached per light by (colour, sun, glow). */
function litWords(light: Light) {
  const maps = new Map<number, Map<string, number>>();
  return (hex: string, face: number, glow: number) => {
    const k = Math.round(face * 8) * 16 + Math.round(glow * 4);
    let m = maps.get(k);
    if (!m) maps.set(k, (m = new Map()));
    let w = m.get(hex);
    if (w === undefined) {
      w = packColor(light.lit(hex, Math.round(face * 8) / 8, Math.round(glow * 4) / 4));
      m.set(hex, w);
    }
    return w;
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

function inConvex(pts: number[], x: number, y: number) {
  let inside = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2],
      yi = pts[i * 2 + 1],
      xj = pts[j * 2],
      yj = pts[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Convex hull of points (monotone chain), flat x, y list out. */
function hull(points: [number, number][]) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)].flat();
}

/** Where the sun throws a thing's shadow: travel per pixel of height, in tiles. */
export function shadowReach(light: Light) {
  const k = Math.min(6, 1 / Math.tan(Math.max(0.12, light.elevation) * (Math.PI / 2)));
  return { dx: (-light.sunDir[0] * k) / PX_PER_TILE, dy: (-light.sunDir[1] * k) / PX_PER_TILE };
}

/** Shadows on the ground outside: the room's block and every outside prop that stands. */
export function groundShadows(v: Venue, light: Light) {
  const out: { pts?: number[]; cx?: number; cy?: number; r?: number; bx0?: number; bx1?: number; by0?: number; by1?: number }[] = [];
  if (light.sun < 0.06) return out;
  const { dx, dy } = shadowReach(light);
  const box = (x: number, y: number, w: number, d: number, h: number) => {
    const base: [number, number][] = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
    const pts = hull([...base, ...base.map(([a, b]) => [a + dx * h, b + dy * h] as [number, number])]);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    out.push({ pts, bx0: Math.min(...xs), bx1: Math.max(...xs), by0: Math.min(...ys), by1: Math.max(...ys) });
  };
  box(0, 0, v.cols, v.rows, (v.slabHeight ?? SLAB) + (v.wallHeight ?? WALL) * 0.92);
  for (const c of v.casters ?? []) box(c.x, c.y, c.w, c.d, c.h);
  for (const s of v.outside.props ?? []) {
    if (s.shadow === "none") continue;
    if (s.shadow === "round") {
      const h = s.height * 0.62;
      out.push({ cx: s.x + 0.5 + dx * h, cy: s.y + 0.5 + dy * h, r: 0.62 });
      continue;
    }
    const w = s.w ?? 1,
      d = s.d ?? 1;
    box(s.x + w * 0.15, s.y + d * 0.15, w * 0.7, d * 0.7, s.height * 0.8);
  }
  return out;
}

/** Sun patches on the floor, in tile coordinates, each with its strength. */
export function sunPatches(v: Venue, light: Light) {
  const out: { quad: number[]; strength: number }[] = [];
  if (light.sun < 0.05) return out;
  const tx = -light.sunDir[0];
  const ty = -light.sunDir[1];
  const k = Math.min(5, 1 / Math.tan(Math.max(0.12, light.elevation) * (Math.PI / 2)));
  for (const w of v.windows) {
    const s1 = (w.sill / PX_PER_TILE) * k;
    const s2 = (w.top / PX_PER_TILE) * k;
    if (w.wall === "right" && ty > 0.08) {
      const a = w.at,
        b = w.at + w.width;
      out.push({ quad: [a + tx * s1, ty * s1, b + tx * s1, ty * s1, b + tx * s2, ty * s2, a + tx * s2, ty * s2], strength: Math.min(1, ty * 1.6) });
    } else if (w.wall === "left" && tx > 0.08) {
      const a = w.at,
        b = w.at + w.width;
      out.push({ quad: [tx * s1, a + ty * s1, tx * s1, b + ty * s1, tx * s2, b + ty * s2, tx * s2, a + ty * s2], strength: Math.min(1, tx * 1.6) });
    }
  }
  return out;
}

function lampGlow(v: Venue, x: number, y: number) {
  let best = 0;
  for (const l of v.lamps) {
    const r = l.reach ?? 2.2;
    const d = Math.hypot(x - l.x, y - l.y) / r;
    if (d < 1) best = Math.max(best, (1 - d) ** 1.4);
  }
  return best;
}

/** Wall-local coordinates of a window or door test. */
function windowAt(windows: readonly WindowSpec[], wall: WallSide, t: number, z: number) {
  for (const w of windows) {
    if (w.wall !== wall) continue;
    if (t < w.at || t > w.at + w.width || z < w.sill || z > w.top) continue;
    if (w.shape === "round") {
      const cx = w.at + w.width / 2,
        cz = (w.sill + w.top) / 2;
      const rx = (w.width / 2) * HW,
        rz = (w.top - w.sill) / 2;
      if (((t - cx) * HW) ** 2 / rx ** 2 + (z - cz) ** 2 / rz ** 2 > 1) continue;
    }
    if (w.shape === "arch") {
      const rx = (w.width / 2) * HW;
      const cz = w.top - rx * 0.7;
      if (z > cz) {
        const cx = w.at + w.width / 2;
        if (((t - cx) * HW) ** 2 / rx ** 2 + (z - cz) ** 2 / (rx * 0.7) ** 2 > 1) continue;
      }
    }
    return w;
  }
  return null;
}

function doorAt(doors: readonly DoorSpec[], wall: WallSide, t: number, z: number) {
  for (const d of doors) {
    if (d.wall !== wall) continue;
    if (t >= d.at && t <= d.at + (d.width ?? 1) && z <= (d.height ?? 54)) return d;
  }
  return null;
}

/** Bakes the opaque background: outside, floor, walls. */
function bakeBackground(v: Venue, light: Light, outdoor: Light, width: number, g: IsoGrid, behind: readonly PropSpec[]): { buffer: PixelBuffer; horizon: number } {
  const H = roomHeight(v);
  const buf = new PixelBuffer(width, H);
  const p = new Painter(buf, width, H);
  const inLit = litWords(light);
  const outLit = litWords(outdoor);
  const wallH = v.wallHeight ?? WALL;
  const horizon = Math.max(16, g.oy - wallH - 18);
  const covered = !!v.outside.covered;
  const gg = groundGrid(v, g);
  const slabH = v.slabHeight ?? SLAB;

  // Sky above the horizon.
  const [s0, s1, s2] = outdoor.sky;
  for (let y = 0; y < horizon; y++) {
    const t = y / Math.max(1, horizon);
    for (let x = 0; x < width; x++) {
      const b = bayer(x, y);
      const c = t < 0.55 ? (t / 0.55 > b ? s1 : s0) : (t - 0.55) / 0.45 > b ? s2 : s1;
      buf.set(x, y, packColor(c));
    }
  }
  // The ground plane outside, in iso, with the shadows the room and everything outside cast on it.
  const sunFace = covered ? 0 : Math.min(1, outdoor.sun * (0.35 + 0.65 * outdoor.elevation));
  const shadows = covered ? [] : groundShadows(v, outdoor);
  // On a snow day the ground outside lies under snow, thinner in patches, whatever the venue paints.
  const snowing = outdoor.weather === "snow" && !covered && v.outside.noSnow !== true;
  const bare = typeof v.outside.noSnow === "function" ? v.outside.noSnow : null;
  const SNOW = ["#eef1f0", "#e3e8ea", "#d5dcdf"];
  // The room's own footprint (walls, floor and slab) is painted over later: skip it here.
  const roofCorner = project(g, 0, 0, wallH + 4);
  const leftTop = project(g, 0, v.rows, wallH);
  const rightTop = project(g, v.cols, 0, wallH);
  const frontFoot = project(gg, v.cols, v.rows);
  const leftFoot = project(gg, 0, v.rows);
  const rightFoot = project(gg, v.cols, 0);
  const hidden = [roofCorner.x, roofCorner.y, rightTop.x + 3, rightTop.y, rightFoot.x + 3, rightFoot.y, frontFoot.x, frontFoot.y, leftFoot.x - 3, leftFoot.y, leftTop.x - 3, leftTop.y];
  const span = (y: number): [number, number] => {
    const xs: number[] = [];
    const n = hidden.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = hidden[i * 2],
        ay = hidden[i * 2 + 1],
        bx = hidden[((i + 1) % n) * 2],
        by = hidden[((i + 1) % n) * 2 + 1];
      if (ay <= y ? by > y : by <= y) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
    return xs.length >= 2 ? [Math.ceil(Math.min(...xs)) + 1, Math.floor(Math.max(...xs)) - 1] : [1, 0];
  };
  for (let y = horizon; y < H; y++) {
    const [skip0, skip1] = span(y + 0.5);
    for (let x = 0; x < width; x++) {
      if (x >= skip0 && x <= skip1) {
        // Covered later; filled with the ground beside it in case an edge peeks through.
        const fill = x > 0 ? buf.words[y * width + x - 1] : 0;
        buf.words.fill(fill, y * width + x, y * width + skip1 + 1);
        x = skip1;
        continue;
      }
      const q = unproject(gg, x + 0.5, y + 0.5);
      let lit = sunFace;
      for (const sh of shadows)
        if (
          sh.r
            ? (q.x - sh.cx!) ** 2 + (q.y - sh.cy!) ** 2 < sh.r * sh.r
            : q.x >= sh.bx0! && q.x <= sh.bx1! && q.y >= sh.by0! && q.y <= sh.by1! && inConvex(sh.pts!, q.x, q.y)
        ) {
          lit = 0;
          break;
        }
      let hex = v.outside.ground(q.x, q.y, outdoor);
      if (snowing && !(bare && bare(q.x, q.y))) {
        // A smooth field: snow lies thick, worn through in a few soft-edged patches.
        const n = smoothNoise(q.x * 0.9, q.y * 0.9, 77);
        const edge = 0.74;
        if (n < edge - 0.04 || (n < edge + 0.04 && bayer(x, y) < (edge + 0.04 - n) / 0.08)) hex = SNOW[n < 0.3 ? 0 : n < 0.55 ? 1 : 2];
      }
      buf.set(x, y, outLit(hex, lit, 0));
    }
  }
  if (v.outside.far) v.outside.far(p, outdoor, width, horizon);
  // Whatever stands behind the room is part of the backdrop: the walls cover it.
  for (const spec of [...behind].sort((a, b) => a.x + a.y - (b.x + b.y))) {
    const at = project(gg, spec.x, spec.y);
    spec.draw(p, { ox: at.x, oy: at.y, hw: HW, hh: HH }, outdoor);
  }

  // The floor slab's front faces, then the floor.
  const L = project(g, 0, v.rows);
  const F = project(g, v.cols, v.rows);
  const R = project(g, v.cols, 0);
  // Contact shadow on the ground along the slab's foot.
  p.alpha(0.3, () => p.poly(INK, [L.x, L.y + slabH, F.x, F.y + slabH, R.x, R.y + slabH, R.x + 6, R.y + slabH + 3, F.x, F.y + slabH + 4, L.x - 6, L.y + slabH + 3]));
  p.poly(outdoor.lit(v.slab, 0.1), [L.x, L.y, F.x, F.y, F.x, F.y + slabH, L.x, L.y + slabH]);
  p.poly(outdoor.lit(mixHex(v.slab, INK, 0.25), 0), [F.x, F.y, R.x, R.y, R.x, R.y + slabH, F.x, F.y + slabH]);
  p.line(INK, L.x, L.y + slabH, F.x, F.y + slabH);
  p.line(INK, F.x, F.y + slabH, R.x, R.y + slabH);
  p.line(outdoor.lit(mixHex(v.slab, "#fff1dd", 0.3), 0.4), L.x, L.y, F.x, F.y);

  const patches = sunPatches(v, light);
  const floorColors = v.floor.colors;
  const ao = floorColors.map((c) => mixHex(c, INK, 0.28));
  const x0 = Math.floor(L.x),
    x1 = Math.ceil(R.x);
  const y0 = g.oy,
    y1 = Math.ceil(F.y);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const q = unproject(g, x + 0.5, y + 0.5);
      if (q.x < 0 || q.y < 0 || q.x >= v.cols || q.y >= v.rows) continue;
      const slot = v.floor.at(q.x * HW, q.y * HW);
      const edge = Math.min(q.x, q.y);
      const b = bayer(x, y);
      const hex = edge < 0.32 && b < (0.32 - edge) * 2.6 ? ao[slot] : floorColors[slot];
      let sun = 0;
      for (const patch of patches) if (inQuad(patch.quad, q.x, q.y)) sun = Math.max(sun, patch.strength);
      const glow = lampGlow(v, q.x, q.y);
      const level = Math.min(4, Math.floor(glow * 4 + b * 0.999));
      buf.set(x, y, inLit(hex, sun, level / 4));
    }
  for (const item of v.floorItems ?? []) item(p, g, light);

  // Walls, back to front: the left wall (x = 0) runs down-left from the corner, the right (y = 0) down-right.
  const paintWall = (wall: WallSide) => {
    const dir = wall === "right" ? 1 : -1;
    const span = (wall === "right" ? v.cols : v.rows) * HW;
    const tint = wall === "right" ? 0.12 : 0;
    const colors = v.wall.colors.map((c) => (tint ? mixHex(c, INK, tint) : c));
    const wain = v.wainscot;
    const wainColors = wain?.surface.colors.map((c) => (tint ? mixHex(c, INK, tint) : c));
    for (let i = 0; i < span; i++) {
      const sx = wall === "right" ? g.ox + i : g.ox - 1 - i;
      const u = i + 0.5;
      const t = u / HW;
      const edge = g.oy + u * 0.5;
      const yTop = Math.ceil(edge - wallH - 0.5);
      const yBot = Math.ceil(edge - 0.5);
      for (let sy = yTop; sy < yBot; sy++) {
        const z = edge - (sy + 0.5);
        const b = bayer(sx, sy);
        const win = windowAt(v.windows, wall, t, z);
        if (win) {
          const frame = win.frame ?? "#5a463f";
          const along = (t - win.at) * HW;
          const fromSill = z - win.sill;
          const fromTop = win.top - z;
          const widthPx = win.width * HW;
          const bars = win.bars ?? 0;
          const spacing = widthPx / (bars + 1);
          const nearest = Math.round(along / spacing);
          const isFrame =
            along < 1.5 || widthPx - along < 1.5 || fromSill < 1.5 || fromTop < 1.5 ||
            (bars > 0 && nearest >= 1 && nearest <= bars && Math.abs(along - nearest * spacing) < 0.75) ||
            (win.transom !== undefined && Math.abs(fromTop - win.transom) < 0.75);
          if (isFrame && win.shape !== "round") {
            buf.set(sx, sy, inLit(frame, 0.2, 0));
            continue;
          }
          const view = v.outside.view(t * HW + (wall === "left" ? 1000 : 0), fromSill / (win.top - win.sill), outdoor, wall, win.top - win.sill);
          const glare = (along + fromSill * 1.4) % 46;
          const c = glare < 5 && b < 0.5 ? mixHex(view, "#ffffff", 0.22 * (1 - outdoor.night * 0.7)) : view;
          buf.set(sx, sy, packColor(c));
          continue;
        }
        const door = doorAt(v.doors, wall, t, z);
        if (door) {
          const along = (t - door.at) * HW;
          const w = (door.width ?? 1) * HW;
          const h = door.height ?? 54;
          let hex = door.color;
          if (along < 1.5 || w - along < 1.5 || h - z < 1.5) hex = mixHex(door.color, INK, 0.45);
          else if (door.glass && z > h * 0.5 && z < h - 5 && along > 4 && w - along > 4) hex = outdoor.night > 0.5 ? "#e8c27a" : mixHex(outdoor.sky[1], "#3b3440", 0.35);
          else if (Math.abs(along - w / 2) < 0.6) hex = mixHex(door.color, INK, 0.3);
          else if (Math.abs(z - h * 0.45) < 1 && Math.abs(along - (w - 5)) < 1.2) hex = "#e2c27f";
          buf.set(sx, sy, inLit(hex, 0, lampGlowWall(v, wall, t, z)));
          continue;
        }
        let slot: number;
        let hex: string;
        if (wain && z < wain.height) {
          slot = wain.surface.at(u, z);
          hex = wainColors![slot];
        } else if (wain && z < wain.height + 2) {
          hex = tint ? mixHex(wain.rail, INK, tint) : wain.rail;
        } else {
          slot = v.wall.at(u, z);
          hex = colors[slot];
        }
        // A touch darker toward the ceiling and into the corner.
        const shadeTop = z > wallH - 10 && b < (z - (wallH - 10)) / 18;
        const shadeCorner = u < 8 && b < (8 - u) / 14;
        if (shadeTop || shadeCorner) hex = mixHex(hex, INK, 0.2);
        const glow = lampGlowWall(v, wall, t, z);
        const level = Math.min(4, Math.floor(glow * 4 + b * 0.999));
        buf.set(sx, sy, inLit(hex, 0, level / 4));
      }
    }
  };
  paintWall("left");
  paintWall("right");

  // Wall caps: the cut top of each wall and its free end.
  const capC = light.lit(v.cap, 0.4);
  const capD = light.lit(mixHex(v.cap, INK, 0.35), 0.1);
  const top = { x: g.ox, y: g.oy - wallH };
  const rightEnd = { x: g.ox + v.cols * HW, y: g.oy + v.cols * HH - wallH };
  const leftEnd = { x: g.ox - v.rows * HW, y: g.oy + v.rows * HH - wallH };
  p.poly(capC, [top.x, top.y - 3, rightEnd.x + 3, rightEnd.y - 1.5, rightEnd.x, rightEnd.y, top.x, top.y]);
  p.poly(capC, [top.x, top.y - 3, leftEnd.x - 3, leftEnd.y - 1.5, leftEnd.x, leftEnd.y, top.x, top.y]);
  p.line(INK, top.x, top.y - 3, rightEnd.x + 3, rightEnd.y - 1.5);
  p.line(INK, top.x, top.y - 3, leftEnd.x - 3, leftEnd.y - 1.5);
  p.poly(capD, [rightEnd.x, rightEnd.y, rightEnd.x + 3, rightEnd.y - 1.5, rightEnd.x + 3, rightEnd.y + wallH - 1.5, rightEnd.x, rightEnd.y + wallH]);
  p.poly(capD, [leftEnd.x, leftEnd.y, leftEnd.x - 3, leftEnd.y - 1.5, leftEnd.x - 3, leftEnd.y + wallH - 1.5, leftEnd.x, leftEnd.y + wallH]);
  p.line(INK, rightEnd.x + 3, rightEnd.y - 1.5, rightEnd.x + 3, rightEnd.y + wallH - 1.5);
  p.line(INK, leftEnd.x - 3, leftEnd.y - 1.5, leftEnd.x - 3, leftEnd.y + wallH - 1.5);

  // Window sills and the things hung on the walls.
  for (const w of v.windows) {
    if (w.shape === "round") continue;
    const a = wallPoint(g, w.wall, w.at, w.sill);
    const b = wallPoint(g, w.wall, w.at + w.width, w.sill);
    const sill = light.lit(mixHex(w.frame ?? "#5a463f", "#fff1dd", 0.35), 0.3);
    p.line(sill, a.x, a.y + 1, b.x, b.y + 1);
    p.line(light.lit(mixHex(w.frame ?? "#5a463f", INK, 0.3), 0), a.x, a.y + 2, b.x, b.y + 2);
  }
  for (const item of v.wallItems) {
    const at = wallPoint(g, item.wall, item.at, item.z);
    const place: WallPlace = { x: at.x, y: at.y, slope: 0.5, dir: item.wall === "right" ? 1 : -1, wall: item.wall };
    item.draw(p, light, place);
  }
  if (v.backHook) v.backHook(p, g, light, width, H);
  return { buffer: buf, horizon };
}

function lampGlowWall(v: Venue, wall: WallSide, t: number, z: number) {
  let best = 0;
  for (const l of v.lamps) {
    if (l.kind !== "sconce" && l.kind !== "fire") continue;
    const onWall = wall === "right" ? Math.abs(l.y) < 0.6 : Math.abs(l.x) < 0.6;
    if (!onWall) continue;
    const along = wall === "right" ? l.x : l.y;
    const d = Math.hypot((t - along) * HW, z - l.z) / ((l.reach ?? 2) * 18);
    if (d < 1) best = Math.max(best, (1 - d) ** 1.3);
  }
  return best;
}

/** Screen point of a spot on a wall: `t` tiles along it, `z` pixels up. */
export function wallPoint(g: IsoGrid, wall: WallSide, t: number, z: number) {
  return wall === "right" ? project(g, t, 0, z) : project(g, 0, t, z);
}

/** The cell a prop needs in the atlas, and where its back corner sits in it. */
function propCell(spec: PropSpec) {
  const w = spec.w ?? 1;
  const d = spec.d ?? 1;
  const pad = spec.pad ?? 3;
  return {
    w: Math.ceil((w + d) * HW + pad * 2),
    h: Math.ceil((w + d) * HH + spec.height + pad * 2),
    ax: Math.round(d * HW + pad),
    ay: Math.round(spec.height + pad),
  };
}

export interface BakeInput {
  venue: Venue;
  light: Light;
  outdoor: Light;
  width: number;
  /** Extra standing things this shop adds (counters at their places, decor). */
  props: PropSpec[];
}

export function bakeRoom({ venue, light, outdoor, width, props }: BakeInput): BakedRoom {
  const g = roomGrid(venue, width);
  const outside = venue.outside.props ?? [];
  // Behind a back wall: wholly on its far side and within its run.
  const isBehind = (s: PropSpec) => (s.x + (s.w ?? 1) <= 0.05 && s.y < venue.rows) || (s.y + (s.d ?? 1) <= 0.05 && s.x < venue.cols);
  const { buffer, horizon } = bakeBackground(venue, light, outdoor, width, g, outside.filter(isBehind));

  const gg = groundGrid(venue, g);
  const fronts = frontWalls(venue);
  const outsideKeys = new Set(outside.map((s) => s.key));
  const all = [...venue.props, ...props, ...fronts, ...outside.filter((s) => !isBehind(s))];
  const entries: AtlasEntry[] = all.map((spec) => {
    const cell = propCell(spec);
    const local: IsoGrid = { ox: cell.ax, oy: cell.ay, hw: HW, hh: HH };
    return { key: spec.key, w: cell.w, h: cell.h, ax: cell.ax, ay: cell.ay, draw: (p) => spec.draw(p, local, spec.key.startsWith("out:") ? outdoor : light) };
  });
  const { buffer: atlas, frames } = bakeAtlas(entries, 512);
  const sprites: PlacedSprite[] = all.map((spec) => {
    const at = project(outsideKeys.has(spec.key) ? gg : g, spec.x, spec.y);
    const w = spec.w ?? 1;
    const d = spec.d ?? 1;
    return { key: spec.key, x: at.x, y: at.y, depth: spec.flat ? -1e6 + spec.x + spec.y : spec.x + w - 0.5 + (spec.y + d - 0.5), flat: spec.flat };
  });

  const height = roomHeight(venue);
  const overhead = new PixelBuffer(width, height);
  const op = new Painter(overhead, width, height);
  paintLamps(op, venue, g, light);
  if (venue.overhead) venue.overhead(op, g, light, 0);

  const wallH = venue.wallHeight ?? WALL;
  const top = project(g, 0, 0, wallH + 3);
  const re = project(g, venue.cols, 0, wallH);
  const le = project(g, 0, venue.rows, wallH);
  const R = project(g, venue.cols, 0);
  const Fr = project(g, venue.cols, venue.rows);
  const Lf = project(g, 0, venue.rows);
  const sh = venue.slabHeight ?? SLAB;
  const silhouette = [top.x, top.y, re.x + 3, re.y, R.x + 3, R.y + sh, Fr.x, Fr.y + sh, Lf.x - 3, Lf.y + sh, le.x - 3, le.y];
  return { width, height, grid: g, light, background: buffer, overhead, atlas, frames, sprites, silhouette, horizon };
}

/** Low cut-away walls along the room's two open edges, one sprite a tile, gaps left open. */
function frontWalls(v: Venue): PropSpec[] {
  const f = v.front;
  if (!f) return [];
  const out: PropSpec[] = [];
  const t = 0.14;
  for (let k = 0; k < v.rows; k++) {
    if (f.gapsRight?.includes(k)) continue;
    out.push({
      key: "front:r",
      x: v.cols - t,
      y: k,
      w: t,
      d: 1,
      height: f.height + 4,
      draw(p, g, light) {
        isoBox(p, g, light, 0, 0, t, 1, f.height, { top: f.cap, left: f.color, right: f.color }, 0, 0.6);
        if (f.stripe) isoBox(p, g, light, t, 0, 0.001, 1, f.stripe[1], { top: f.stripe[0], left: f.stripe[0], right: f.stripe[0], ink: "", lip: false }, f.stripe[2], 0.6);
      },
    });
  }
  for (let k = 0; k < v.cols; k++) {
    if (f.gapsLeft?.includes(k)) continue;
    out.push({
      key: "front:l",
      x: k,
      y: v.rows - t,
      w: 1,
      d: t,
      height: f.height + 4,
      draw(p, g, light) {
        isoBox(p, g, light, 0, 0, 1, t, f.height, { top: f.cap, left: f.color, right: f.color }, 0, 0.6);
        if (f.stripe) isoBox(p, g, light, 0, t, 1, 0.001, f.stripe[1], { top: f.stripe[0], left: f.stripe[0], right: f.stripe[0], ink: "", lip: false }, f.stripe[2], 0.6);
      },
    });
  }
  return out;
}

/** Pendant shades, bulbs on a wire, tubes: hung from the ceiling, drawn over everything. */
function paintLamps(p: Painter, v: Venue, g: IsoGrid, light: Light) {
  const wallH = v.wallHeight ?? WALL;
  const on = light.night > 0.15;
  for (const l of v.lamps) {
    const at = project(g, l.x, l.y, l.z);
    const ceiling = project(g, l.x, l.y, wallH + 6);
    const color = l.color ?? "#b8664a";
    if (l.kind === "pendant") {
      p.line(light.lit("#3a2c2c", 0), at.x, Math.max(ceiling.y, at.y - 22), at.x, at.y - 5);
      p.poly(light.lit(color, 0.3), [at.x - 3, at.y - 5, at.x + 3, at.y - 5, at.x + 6, at.y, at.x - 6, at.y]);
      p.line(light.lit(mixHex(color, "#fff1dd", 0.4), 0.5), at.x - 2, at.y - 4, at.x + 1, at.y - 4);
      p.rect(on ? "#ffe6a8" : light.lit("#d8c49a", 0.2), at.x - 4, at.y, 9, 1);
      if (on) {
        p.alpha(0.22 * light.night, () => p.oval("#ffd890", at.x, at.y + 4, 10, 5));
        p.alpha(0.12 * light.night, () => p.oval("#ffd890", at.x, at.y + 6, 16, 8));
      }
    } else if (l.kind === "bulbs" && l.to) {
      const to = project(g, l.to[0], l.to[1], l.to[2]);
      const n = Math.max(2, Math.round(Math.hypot(to.x - at.x, to.y - at.y) / 9));
      let px = at.x,
        py = at.y;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const x = at.x + (to.x - at.x) * t;
        const y = at.y + (to.y - at.y) * t + Math.sin(t * Math.PI) * 6;
        p.line(light.lit("#3a2c2c", 0), px, py, x, y);
        px = x;
        py = y;
        if (i < n) {
          p.rect(on ? ["#ffe08a", "#ffb38a", "#c9e6a0", "#ffe08a"][i % 4] : light.lit("#d9c9a4", 0.3), x, y + 1, 2, 2);
          if (on) p.alpha(0.25 * light.night, () => p.rect("#ffe08a", x - 1, y, 4, 4));
        }
      }
    } else if (l.kind === "tube") {
      p.rect(light.lit("#4a4a50", 0), at.x - 10, at.y - 1, 20, 3);
      p.rect(on || light.indoor ? "#eef4ee" : "#c8ccc8", at.x - 9, at.y + 1, 18, 1);
    } else if (l.kind === "sconce") {
      p.rect(light.lit("#3a2c2c", 0), at.x - 1, at.y - 1, 3, 5);
      p.rect(light.lit(color, 0.4), at.x - 2, at.y - 5, 5, 4);
      p.rect(on ? "#ffe2a0" : light.lit("#e6d3ab", 0.3), at.x - 1, at.y - 4, 3, 2);
      if (on) p.alpha(0.2 * light.night, () => p.oval("#ffd890", at.x, at.y - 3, 8, 7));
    } else if (l.kind === "fire") {
      if (on || light.night > 0) p.alpha(0.16 + 0.14 * light.night, () => p.oval("#ffb060", at.x, at.y - 4, 14, 9));
    } else if (l.kind === "lantern") {
      p.line(light.lit("#3a2c2c", 0), at.x, Math.max(ceiling.y, at.y - 18), at.x, at.y - 6);
      p.rect(light.lit(color, 0.3), at.x - 3, at.y - 6, 6, 7);
      p.rect(on ? "#ffd27a" : light.lit(mixHex(color, "#fff1dd", 0.3), 0.3), at.x - 2, at.y - 5, 4, 5);
      p.rect(light.lit("#3a2c2c", 0), at.x - 3, at.y + 1, 6, 1);
      if (on) p.alpha(0.2 * light.night, () => p.oval("#ffc070", at.x, at.y - 2, 9, 7));
    }
  }
}

export interface Actor {
  sprite: { grid: readonly string[]; palette: Record<string, string> };
  /** Feet position in tiles. */
  x: number;
  y: number;
  /** Standing on the ground outside rather than the room's floor. */
  outside?: boolean;
  flip?: boolean;
  /** Something carried, drawn at the hand. */
  carry?: { grid: readonly string[]; palette: Record<string, string> };
  key?: string;
}

/** Screen position of an actor's feet. */
export function actorPoint(baked: BakedRoom, v: Venue, a: { x: number; y: number; outside?: boolean }) {
  return project(a.outside ? groundGrid(v, baked.grid) : baked.grid, a.x, a.y);
}

function blitBuffer(dst: PixelBuffer, src: PixelBuffer, sx: number, sy: number, w: number, h: number, dx: number, dy: number) {
  for (let row = 0; row < h; row++) {
    const ty = dy + row;
    if (ty < 0 || ty >= dst.height) continue;
    for (let col = 0; col < w; col++) {
      const tx = dx + col;
      if (tx < 0 || tx >= dst.width) continue;
      const word = src.words[(sy + row) * src.width + sx + col];
      const a = word >>> 24;
      if (a === 0) continue;
      if (a === 255) {
        dst.words[ty * dst.width + tx] = word;
        continue;
      }
      const o = (ty * dst.width + tx) * 4;
      const k = a / 255;
      dst.data[o] = dst.data[o] * (1 - k) + (word & 255) * k;
      dst.data[o + 1] = dst.data[o + 1] * (1 - k) + ((word >>> 8) & 255) * k;
      dst.data[o + 2] = dst.data[o + 2] * (1 - k) + ((word >>> 16) & 255) * k;
    }
  }
}

/** Paints a lit person sprite with its feet at (x, y) on the screen. */
export function paintPerson(p: Painter, light: Light, a: Actor, x: number, y: number, share = 0.5) {
  const lit: Record<string, string> = {};
  const face = Math.round(faceLightTop(light, share) * 8) / 8;
  for (const [k, c] of Object.entries(a.sprite.palette)) lit[k] = light.lit(c, face);
  const w = a.sprite.grid[0].length;
  const h = a.sprite.grid.length;
  p.alpha(0.3, () => p.oval(INK, x, y, 5, 1.5));
  p.sprite(a.sprite.grid, lit, x - Math.floor(w / 2), y - h + 1, a.flip);
  if (a.carry) {
    const cl: Record<string, string> = {};
    for (const [k, c] of Object.entries(a.carry.palette)) cl[k] = light.lit(c, face);
    p.sprite(a.carry.grid, cl, x + (a.flip ? -9 : 3), y - 12);
  }
}

function faceLightTop(light: Light, share: number) {
  const s = light.sun * share;
  return Math.min(1, s * (0.35 + 0.65 * light.elevation));
}

/** The whole frame into a pixel buffer: background, props and people in depth order, overhead. */
export function composeRoom(baked: BakedRoom, v: Venue, actors: readonly Actor[] = []): PixelBuffer {
  const out = new PixelBuffer(baked.width, baked.height);
  out.words.set(baked.background.words);
  const p = new Painter(out, baked.width, baked.height);
  const items: { depth: number; draw: () => void }[] = [];
  for (const s of baked.sprites) {
    const f = baked.frames.get(s.key);
    if (!f) continue;
    items.push({ depth: s.depth, draw: () => blitBuffer(out, baked.atlas, f.x, f.y, f.w, f.h, Math.round(s.x - f.ax), Math.round(s.y - f.ay)) });
  }
  for (const a of actors) {
    const at = actorPoint(baked, v, a);
    items.push({ depth: a.x + a.y, draw: () => paintPerson(p, a.outside ? baked.light : baked.light, a, at.x, at.y, a.outside ? 1 : v.indoorSun ?? 0.4) });
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const item of items) item.draw();
  blitBuffer(out, baked.overhead, 0, 0, baked.width, baked.height, 0, 0);
  return out;
}
