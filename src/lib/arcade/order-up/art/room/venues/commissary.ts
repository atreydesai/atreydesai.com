/**
 * The Commissary: the chain's central kitchen and warehouse, where every
 * shop's stock is made up and sent out. Poured concrete with yellow safety
 * lines, corrugated metal walls over block, a half-open roll-up door to the
 * dock, pallet racking, wrapped pallets, fluorescent tubes, stainless
 * counters, and the dispatch board with the day's routes drawn on it.
 * Outside, the yard: an asphalt apron, a delivery van pulling up, pallets,
 * a forklift, chain-link fence; warehouses and a water tower beyond.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, project, faceLight, type IsoGrid } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { concrete, corrugated, brick, ground as groundSurface, type Surface } from "../surfaces.ts";
import type { Venue, PropSpec, WallItem, FrontBox } from "../types.ts";
import { displayCup } from "../front.ts";
import type { VenueOptions } from "./index.ts";
import { clock } from "../walls.ts";
import { lampPostProp, SPRITES, litPalette, INK } from "../props.ts";
import { word, bigWord, bigWidth } from "../font.ts";
import { overlay, litOnce, table, tiled, wline, wquad, wdot, wdisc, wword, fpt, fquad, fline, frontWalls, type Box } from "./_frontier-kit.ts";

const METAL = "#9aa39f";
const METAL_L = "#b2bab5";
const METAL_D = "#7a827e";
const YELLOW = "#d9b44a";
const TEAL = "#4f7f86";
const RACK_BLUE = "#3f6f9a";
const RACK_ORANGE = "#d07a3a";
const CARD = "#c49a6a";
const CARD_D = "#a47c50";
const VAN = "#e9e6dc";

/** Corrugated sheet, ribbed, lapped every forty pixels with a row of rivets. */
const metalWall = overlay(corrugated(METAL, METAL_L, METAL_D, 4), [mixHex(METAL_D, INK, 0.2), "#cfd5d1"], (u, z) => {
  const zz = Math.floor(z) % 40;
  if (zz === 0) return 0;
  if (zz === 2 && Math.floor(u) % 12 === 6) return 1;
  return -1;
});

/** Concrete with yellow lines: the keep-clear hatch at the dock door, rack and pallet bays, the drain bay. */
function warehouseFloor(cols: number, rows: number): Surface {
  return overlay(concrete("#a3a49c", "#9c9d95", "#86877f", "#b5b6ae", 72), [YELLOW, "#b89a46", "#8b8c85", "#5f605c", "#3f403d"], (u, v) => {
    const x = u / 24;
    const y = v / 24;
    const wear = noise(Math.floor(u / 2), Math.floor(v / 2), 8) > 0.9;
    // The hatch in front of the roll-up door.
    if (x > 6.2 && x < 8.6 && y < 1.5) {
      if (x < 6.3 || x > 8.5 || y > 1.4) return wear ? 1 : 0;
      return (Math.floor(u + v) % 12) < 4 ? (wear ? 1 : 0) : -1;
    }
    // Rack bay along the left wall, pallet bay at the front.
    const line = (a: number, b: number) => (a > b - 0.05 && a < b + 0.05);
    if ((line(x, 1.15) && y > 2.9 && y < 6.1) || ((line(y, 2.9) || line(y, 6.1)) && x < 1.15)) return wear ? 1 : 0;
    if ((line(x, 5.85) || line(x, 8.15)) && y > 5.85 && y < rows - 0.15) return wear ? 1 : 0;
    if (line(y, 5.85) && x > 5.85 && x < 8.15) return wear ? 1 : 0;
    // The drain bay in the front corner.
    const dx = x - (cols - 0.5);
    const dy = y - (rows - 0.5);
    if (Math.abs(dx) < 0.45 && Math.abs(dy) < 0.45) {
      if (Math.abs(dx) < 0.16 && Math.abs(dy) < 0.16) return Math.floor(u) % 2 ? 4 : 3;
      if (Math.abs(dx) > 0.38 || Math.abs(dy) > 0.38) return 0;
      return (Math.floor(u - v + 48) % 10) < 3 ? 0 : -1;
    }
    // Rubber tracks from the pallet jack, out of the dock door.
    const tx = x - 7.4 + (y - 1.5) * 0.25;
    if (y > 1.5 && y < 5.6 && (Math.abs(tx) < 0.03 || Math.abs(tx - 0.3) < 0.03) && noise(Math.floor(v / 3), 1, 3) > 0.35) return 2;
    return -1;
  });
}

/** Block wall below the sheet, painted grey. */
const blockWainscot = brick("#8e9590", "#878e89", "#6c726e", 12, 6);

// The yard outside.
const asphalt = tiled(groundSurface("#5c5c5e", "#646466", "#77777a", 0.05, 3));
const gravel = tiled(groundSurface("#9c968a", "#a59f93", "#857f74", 0.12, 7));
const scrub = tiled(groundSurface("#a39a6e", "#9a9166", "#b5ad80", 0.1, 9));
/** Oil stains on the apron, baked once into a tile: 1 where there is one. */
const STAINS = (() => {
  const t = new Uint8Array(256 * 256);
  for (let v = 0; v < 256; v++)
    for (let u = 0; u < 256; u++) t[v * 256 + u] = noise(Math.floor(u / 36), Math.floor(v / 36), 12) > 0.85 && noise(Math.floor(u / 2.4), Math.floor(v / 2.4), 13) > 0.55 ? 1 : 0;
  return t;
})();

function yardGround(cols: number, rows: number) {
  return (x: number, y: number) => {
    // Past the fence: dry scrub.
    if (x < -6.6 || y < -7.2) return scrub(x * 24, y * 24);
    // A gravel strip inside the fence.
    if (x < -5.6 || y < -6.2) return gravel(x * 24, y * 24);
    // A concrete apron round the building.
    const out = Math.max(-x, -y, x - cols, y - rows);
    if (out < 1.1) {
      if (out > 1.0) return "#7e7f79";
      return noise(Math.floor(x * 24), Math.floor(y * 24), 4) > 0.96 ? "#8d8e87" : "#a09f98";
    }
    // Parking bays to the right, a yellow lane line to the left.
    if (x > cols + 1.8 && y > -1 && y < rows + 1) {
      const b = (y + 1) / 2.2;
      if (b - Math.floor(b) < 0.03) return "#e6e2d2";
    }
    if (Math.abs(x - cols - 1.6) < 0.05 && y > -4 && y < rows + 4) return YELLOW;
    if (Math.abs(y - rows - 2.2) < 0.05 && x > -4 && x < cols + 1.6) return YELLOW;
    if (STAINS[(Math.floor(y * 24) & 255) * 256 + (Math.floor(x * 24) & 255)]) return "#555557";
    return asphalt(x * 24, y * 24);
  };
}

/** Warehouses along the horizon, a water tower, light poles. */
function farYard(p: Painter, light: Light, width: number, horizon: number) {
  // Stood a little below the horizon so they have some height; the fence stands in front.
  const base = horizon + 13;
  let x = -4;
  for (let i = 0; x < width; i++) {
    const w = 34 + Math.floor(noise(i, 1, 5) * 40);
    const h = 12 + Math.floor(noise(i, 2, 5) * 10);
    const tone = ["#9aa3a6", "#a7a59c", "#8f9a9e", "#b0aca0"][i % 4];
    p.rect(light.lit(tone, 0.4), x, base - h, w, h);
    p.rect(light.lit(mixHex(tone, INK, 0.25), 0.2), x, base - h, w, 1);
    p.rect(light.lit(mixHex(tone, INK, 0.15), 0.2), x, base - 4, w, 4);
    for (let k = 4; k < w - 6; k += 9) p.rect(light.lit(mixHex(tone, INK, 0.35), 0.1), x + k, base - 4, 5, 4);
    if (noise(i, 3, 5) > 0.5) p.rect(light.lit("#7d8588", 0.3), x + 6, base - h - 3, 4, 3);
    if (light.night > 0.4 && noise(i, 4, 5) > 0.3) p.rect("#efc77a", x + w - 8, base - 6, 2, 1);
    x += w + 2 + Math.floor(noise(i, 6, 5) * 10);
  }
  // The water tower.
  const tx = Math.round(width * 0.8);
  const leg = light.lit("#6f7476", 0.2);
  p.line(leg, tx - 7, base, tx - 5, base - 14);
  p.line(leg, tx + 7, base, tx + 5, base - 14);
  p.line(leg, tx - 1, base, tx - 1, base - 14);
  p.line(leg, tx - 6, base - 5, tx + 6, base - 5);
  p.line(leg, tx - 6, base - 10, tx + 6, base - 10);
  p.rect(light.lit("#b6bcbd", 0.5), tx - 8, base - 23, 16, 9);
  p.rect(light.lit("#959b9c", 0.2), tx + 3, base - 23, 5, 9);
  p.poly(light.lit("#8a9092", 0.4), [tx - 9, base - 23, tx + 9, base - 23, tx, base - 28]);
  word(p, "TEA", light.lit(TEAL, 0.4), tx - 6, base - 21);
  // Light poles.
  for (const lx of [0.12, 0.4, 0.9]) {
    const px = Math.round(width * lx);
    p.rect(light.lit("#5f6466", 0.2), px, base - 26, 1, 26);
    p.rect(light.night > 0.3 ? "#ffe2a0" : light.lit("#c9ccc8", 0.4), px - 2, base - 27, 5, 1);
  }
}

// Views through the high windows: sky over the warehouse roofs and the water tower; under the roll-up door, the yard.
const VIEW = litOnce([
  ["#9aa3a6", 0.4],
  ["#7d8588", 0.2],
  ["#b6bcbd", 0.5],
  ["#8a9092", 0.3],
  ["#5c5c5e", 0.5],
  [YELLOW, 0.5],
  [VAN, 0.5],
  ["#2f2c2e", 0.1],
  [TEAL, 0.4],
  ["#a09f98", 0.9],
]);
const ROOFS = table(2048, (i) => {
  const b = Math.floor(i / 37);
  return 0.12 + noise(b, 1, 5) * 0.16 + ((i % 37) < 3 ? 0.04 : 0);
});

function yardView(u: number, v: number, light: Light, wall: string, height: number) {
  const c = VIEW(light);
  if (height < 16) {
    // Under the door: the apron, the yellow line, and the van's back wheels when it is in.
    if (v > 0.6 && u > 170 && u < 194) return Math.floor(u) % 10 < 6 ? c[7] : c[6];
    if (v > 0.3 && v < 0.42) return c[5];
    return c[9];
  }
  const [s0, s1, s2] = light.sky;
  const iu = Math.floor(u) & 2047;
  if (height >= 30) {
    // The order window looks straight across the yard: warehouses, the water tower over them.
    const tw = u - 150;
    if (Math.abs(tw) < 9 && v > 0.62 && v < 0.82) return v > 0.78 ? c[3] : tw > 4 ? c[1] : c[2];
    if ((Math.abs(tw - 7) < 0.7 || Math.abs(tw + 7) < 0.7) && v < 0.64) return c[1];
    const roofLine = 0.36 + ROOFS[iu] * 0.9;
    if (v < roofLine) return v > roofLine - 0.03 ? c[1] : (iu % 37) < 3 ? c[1] : v < 0.42 && (iu % 37) > 8 && (iu % 37) < 22 ? c[1] : c[0];
  }
  // The water tower through one window on each wall.
  const tu = wall === "left" ? u - 1118 : u - 236;
  if (Math.abs(tu) < 7 && v > 0.36 && v < 0.62) return v > 0.58 ? c[3] : tu > 3 ? c[1] : c[2];
  if ((Math.abs(tu - 5) < 0.6 || Math.abs(tu + 5) < 0.6) && v < 0.38) return c[1];
  if (v < ROOFS[iu]) return (iu % 37) < 3 ? c[1] : c[0];
  return v < 0.6 ? s2 : v < 0.85 ? s1 : s0;
}

// Things standing in the yard.

/** A delivery van in the chain's colours, pulling up to the dock. */
function vanProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    w: 2.4,
    d: 1.1,
    height: 40,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const body: Box = [0.05, 0.05, 1.8, 1.0];
      isoBox(p, g, light, ...body, 34, { top: "#f3f0e8", left: VAN, right: mixHex(VAN, INK, 0.18) }, 4);
      fquad(p, g, "left", body, 0.05, 0.95, 12, 16, light.lit(TEAL, f.left));
      fquad(p, g, "right", body, 0, 1, 12, 16, light.lit(mixHex(TEAL, INK, 0.2), f.right));
      const w = fpt(g, "left", body, 0.32, 30);
      word(p, "ORDER UP", light.lit(TEAL, f.left), w.x, w.y, 0.5);
      // The cab, toward +x.
      const cab: Box = [1.85, 0.12, 0.55, 0.86];
      isoBox(p, g, light, ...cab, 22, { top: "#f3f0e8", left: VAN, right: mixHex(VAN, INK, 0.18) }, 4);
      fquad(p, g, "right", cab, 0.1, 0.9, 16, 25, light.lit("#3f5560", 0.1));
      fquad(p, g, "left", cab, 0.15, 0.85, 17, 24, light.lit("#3f5560", 0.1));
      fline(p, g, "right", cab, 0.12, 24, 0.5, 18, light.lit("#a8c4cc", 0.5));
      for (const s of [0.15, 0.85]) {
        const h = fpt(g, "right", cab, s, 9);
        p.rect(light.night > 0.3 ? "#fff0c0" : light.lit("#f3ecd6", 0.6), h.x - 1, h.y - 1, 2, 2);
      }
      for (const u of [0.35, 1.55, 2.15]) {
        const q = project(g, u, 1.06, 4);
        p.oval(INK, q.x, q.y, 4, 4);
        p.oval(light.lit("#3a3537", 0.2), q.x, q.y, 3, 3);
        p.rect(light.lit("#9a9da0", f.left), q.x - 1, q.y - 1, 2, 2);
      }
    },
  };
}

/** A stack of empty pallets. */
function palletStackProp(key: string, x: number, y: number, n: number): PropSpec {
  return {
    key,
    x,
    y,
    height: n * 4 + 4,
    pad: 3,
    shadow: "none",
    draw(p, g, light) {
      for (let i = 0; i < n; i++) {
        const tilt = (i % 2) * 0.04;
        isoBox(p, g, light, 0.1 + tilt, 0.12, 0.8, 0.76, 3, { top: "#b89a72", left: "#9a7c56", right: "#7f6646" }, i * 4);
        const f = faceLight(light, 1);
        fline(p, g, "left", [0.1 + tilt, 0.12, 0.8, 0.76], 0.33, i * 4 + 1, 0.33, i * 4 + 2, light.lit("#4a3a2a", f.left * 0.3));
        fline(p, g, "left", [0.1 + tilt, 0.12, 0.8, 0.76], 0.66, i * 4 + 1, 0.66, i * 4 + 2, light.lit("#4a3a2a", f.left * 0.3));
      }
    },
  };
}

function dumpsterProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    w: 1,
    d: 1.4,
    height: 26,
    pad: 4,
    // Its own contact shadow: a ground-shadow test per pixel costs more than this small thing earns.
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const b: Box = [0.1, 0.1, 0.8, 1.2];
      p.alpha(0.3, () => p.poly(INK, [project(g, 0.05, 0.2).x, project(g, 0.05, 0.2).y, project(g, 1.0, 0.2).x + 2, project(g, 1.0, 0.2).y + 1, project(g, 1.0, 1.4).x + 2, project(g, 1.0, 1.4).y + 2, project(g, 0.05, 1.4).x, project(g, 0.05, 1.4).y + 1]));
      isoBox(p, g, light, ...b, 18, { top: "#3f5a4a", left: "#4f6e5a", right: "#3f5a4a" }, 2);
      isoBox(p, g, light, 0.06, 0.06, 0.88, 1.28, 2, { top: "#2f4438", left: "#3a5244", right: "#2f4438" }, 20);
      for (const s of [0.25, 0.75]) fline(p, g, "right", b, s, 4, s, 18, light.lit("#2f4438", f.right * 0.4));
      for (const u of [0.2, 0.8]) {
        const q = project(g, u, 1.3, 1);
        p.rect(INK, q.x - 1, q.y - 2, 3, 3);
      }
    },
  };
}

/** A small yellow forklift parked with its forks down. */
function forkliftProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    w: 1,
    d: 1.3,
    height: 36,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, 1);
      // Forks out toward -y, the mast, the body, the cage.
      for (const u of [0.3, 0.7]) isoBox(p, g, light, u - 0.05, -0.2, 0.1, 0.5, 1, { top: "#3a3537" }, 1);
      isoBox(p, g, light, 0.2, 0.25, 0.08, 0.08, 32, { top: "#3a3537", ink: "" });
      isoBox(p, g, light, 0.72, 0.25, 0.08, 0.08, 32, { top: "#3a3537", ink: "" });
      isoBox(p, g, light, 0.2, 0.27, 0.6, 0.04, 3, { top: "#4a4448" }, 6);
      const body: Box = [0.12, 0.38, 0.76, 0.85];
      isoBox(p, g, light, ...body, 12, { top: YELLOW, left: "#c9a23e", right: "#a8862f" }, 3);
      isoBox(p, g, light, 0.3, 0.85, 0.42, 0.34, 6, { top: "#3a3537" }, 15);
      for (const [u, v] of [[0.16, 0.5], [0.84, 0.5], [0.16, 1.15], [0.84, 1.15]] as const) {
        const a = project(g, u, v, 15);
        const b = project(g, u, v, 33);
        p.line(light.lit("#3a3537", 0.2), a.x, a.y, b.x, b.y);
      }
      isoBox(p, g, light, 0.12, 0.45, 0.76, 0.75, 1, { top: "#4a4448" }, 33);
      for (const [u, v] of [[0.2, 1.23], [0.8, 1.23]] as const) {
        const q = project(g, u, v, 3);
        p.oval(INK, q.x, q.y, 3, 3);
        p.oval(light.lit("#3a3537", 0.1), q.x, q.y, 2, 2);
      }
      const lamp = project(g, 0.5, 0.45, 34);
      p.rect(light.lit("#e08a3c", 0.5), lamp.x, lamp.y - 2, 2, 2);
      void f;
    },
  };
}

/** A yellow bollard. */
function bollardProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 16,
    pad: 2,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.rect(INK, b.x - 2, b.y - 1, 5, 2));
      p.rect(INK, b.x - 3, b.y - 14, 6, 14);
      p.rect(light.lit(YELLOW, f.left), b.x - 2, b.y - 13, 4, 13);
      p.rect(light.lit("#a8862f", 0), b.x + 1, b.y - 13, 1, 13);
      p.rect(light.lit("#3a3537", 0.2), b.x - 2, b.y - 9, 4, 2);
    },
  };
}

/** A traffic cone. */
function coneProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 12,
    pad: 2,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const b = project(g, 0.5, 0.5, 0);
      p.rect(INK, b.x - 4, b.y - 2, 9, 2);
      for (let r = 0; r < 9; r++) {
        const half = Math.round(r / 3);
        p.rect(light.lit(r > 3 && r < 6 ? "#efe9dc" : "#e0703f", f.left), b.x - half, b.y - 11 + r, half * 2 + 1, 1);
      }
    },
  };
}

/** A run of chain-link fence on posts, standing on the backdrop behind the room. */
function fenceProp(key: string, x: number, y: number, len: number, alongX: boolean): PropSpec {
  return {
    key,
    x,
    y,
    w: alongX ? len : 0.1,
    d: alongX ? 0.1 : len,
    height: 24,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const post = light.lit("#7d8386", f.top);
      const mesh = light.lit("#b9bfc0", f.top);
      const at = (t: number, z: number) => (alongX ? project(g, t, 0, z) : project(g, 0, t, z));
      const a = at(0, 0);
      const b = at(len, 0);
      const x0 = Math.min(a.x, b.x);
      const x1 = Math.max(a.x, b.x);
      for (let sx = Math.ceil(x0); sx < x1; sx++) {
        const t = (sx - a.x) / (b.x - a.x);
        const by = Math.round(a.y + (b.y - a.y) * t);
        for (let z = 1; z < 21; z++) if ((sx + z) % 4 === 0 || (sx - z + 400) % 4 === 0) p.rect(mesh, sx, by - z, 1, 1);
        p.rect(post, sx, by - 21, 1, 1);
      }
      for (let k = 0; k <= len; k++) {
        const q = at(k, 0);
        p.rect(INK, q.x - 1, q.y - 22, 3, 22);
        p.rect(post, q.x, q.y - 22, 1, 22);
      }
    },
  };
}

// Things standing in the warehouse.

/** A section of pallet racking: blue uprights, orange beams, three levels of stock. */
function rackProp(key: string, x: number, y: number, seed: number, share: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 52,
    pad: 4,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const H = 48;
      for (const [u, v] of [[0.08, 0.06], [0.08, 0.9]] as const) isoBox(p, g, light, u, v, 0.06, 0.06, H, { top: RACK_BLUE, ink: INK }, 0, share);
      const levels = [2, 18, 34];
      levels.forEach((z, i) => {
        isoBox(p, g, light, 0.08, 0.06, 0.8, 0.9, 2, { top: "#b0a48e", left: RACK_ORANGE, right: RACK_ORANGE }, z, share);
        const kind = (i + seed) % 3;
        if (kind === 0) {
          // Cartons.
          for (const [v, h] of [[0.1, 11], [0.52, 9]] as const) {
            const b: Box = [0.14, v, 0.62, 0.36];
            isoBox(p, g, light, ...b, h, { top: "#d4ae7c", left: CARD, right: CARD_D }, z + 2, share);
            fline(p, g, "right", b, 0, z + 2 + h - 1, 1, z + 2 + h - 1, light.lit("#e6dccb", f.right));
            const t = fpt(g, "right", b, 0.3, z + 6);
            p.rect(light.lit(TEAL, f.right), t.x, t.y - 1, 3, 2);
          }
        } else if (kind === 1) {
          // Sacks of tapioca.
          for (const v of [0.18, 0.5, 0.78]) {
            const q = project(g, 0.5, v, z + 2);
            const s = SPRITES.sack;
            p.sprite(s.grid, litPalette(s.palette, light, share), q.x - 3, q.y - s.grid.length);
          }
        } else {
          // Crates of bottles.
          for (const v of [0.12, 0.55]) {
            const b: Box = [0.16, v, 0.6, 0.36];
            isoBox(p, g, light, ...b, 7, { top: "#4f7a5a", left: "#5f8a66", right: "#4a6e52" }, z + 2, share);
            for (let k = 0; k < 4; k++) {
              const q = project(g, 0.25 + k * 0.14, v + 0.18, z + 9);
              p.rect(light.lit(["#e8b46a", "#c9e0a8", "#e8a0a8"][k % 3], f.top), q.x, q.y - 2, 1, 2);
            }
          }
        }
      });
      for (const [u, v] of [[0.82, 0.06], [0.82, 0.9]] as const) isoBox(p, g, light, u, v, 0.06, 0.06, H, { top: RACK_BLUE, ink: INK }, 0, share);
      // A bay label on the front beam.
      const lab = fpt(g, "right", [0.08, 0.06, 0.8, 0.9], 0.15, 19);
      p.rect(light.lit("#efe9dc", f.right), lab.x, lab.y - 1, 4, 2);
    },
  };
}

/** A pallet with a shrink-wrapped load: cartons, or sacks with a pallet jack under it. */
function palletProp(key: string, x: number, y: number, sacks: boolean, share: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 34,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, share);
      isoBox(p, g, light, 0.06, 0.06, 0.88, 0.88, 4, { top: "#b89a72", left: "#9a7c56", right: "#7f6646" }, 0, share);
      for (const s of [0.2, 0.5, 0.8]) fquad(p, g, "left", [0.06, 0.06, 0.88, 0.88], s - 0.06, s + 0.06, 1, 3, light.lit("#3a3036", 0));
      if (sacks) {
        for (let layer = 0; layer < 3; layer++)
          for (const [u, v] of [[0.3, 0.3], [0.62, 0.3], [0.3, 0.66], [0.62, 0.66]] as const) {
            if (layer === 2 && u > 0.5 && v > 0.5) continue;
            const q = project(g, u, v, 4 + layer * 6);
            p.oval(INK, q.x, q.y - 3, 7, 4);
            p.oval(light.lit(layer % 2 ? "#e3d2ad" : "#d8c49a", f.top), q.x, q.y - 3, 6, 3);
            p.rect(light.lit("#a48f6a", 0.2), q.x - 3, q.y - 2, 6, 1);
          }
        const lab = project(g, 0.32, 0.86, 9);
        word(p, "BOBA", light.lit("#6a4a3a", 0.3), lab.x - 6, lab.y - 4);
        // The jack's handle.
        const h0 = project(g, 0.5, 0.98, 2);
        p.line(light.lit("#c2493c", 0.4), h0.x, h0.y, h0.x - 6, h0.y - 20);
        p.rect(INK, h0.x - 9, h0.y - 22, 7, 2);
      } else {
        const b: Box = [0.1, 0.1, 0.8, 0.8];
        isoBox(p, g, light, ...b, 26, { top: "#d4ae7c", left: CARD, right: CARD_D }, 4, share);
        for (const z of [12, 20]) {
          fline(p, g, "left", b, 0, z, 1, z, light.lit(CARD_D, f.left * 0.5));
          fline(p, g, "right", b, 0, z, 1, z, light.lit(mixHex(CARD_D, INK, 0.2), f.right * 0.5));
        }
        fline(p, g, "left", b, 0.5, 4, 0.5, 30, light.lit(CARD_D, f.left * 0.5));
        // The wrap's sheen.
        p.alpha(0.5, () => {
          fline(p, g, "left", b, 0.2, 8, 0.35, 28, light.lit("#f3f3ee", 0.8));
          fline(p, g, "right", b, 0.6, 6, 0.7, 26, light.lit("#f3f3ee", 0.6));
        });
        const lab = fpt(g, "left", b, 0.15, 22);
        p.rect(light.lit("#efe9dc", f.left), lab.x, lab.y - 3, 6, 4);
        p.rect(light.lit(TEAL, 0.3), lab.x + 1, lab.y - 2, 4, 1);
      }
    },
  };
}

/** A hand truck leaning by the wall with two cartons on it. */
function handTruckProp(x: number, y: number, share: number): PropSpec {
  return {
    key: "prop:handtruck",
    x,
    y,
    height: 34,
    pad: 4,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const b = project(g, 0.5, 0.45, 0);
      const frame = light.lit("#c2493c", f.left);
      p.line(INK, b.x - 6, b.y - 1, b.x - 4, b.y - 32);
      p.line(frame, b.x - 5, b.y - 1, b.x - 3, b.y - 32);
      p.line(INK, b.x + 6, b.y - 1, b.x + 8, b.y - 32);
      p.line(frame, b.x + 5, b.y - 1, b.x + 7, b.y - 32);
      p.rect(frame, b.x - 6, b.y - 2, 13, 2);
      for (const [y0, h] of [[3, 10], [13, 9]] as const) {
        p.rect(INK, b.x - 6, b.y - y0 - h, 12, h + 1);
        p.rect(light.lit(CARD, f.left), b.x - 5, b.y - y0 - h + 1, 10, h - 1);
        p.rect(light.lit("#e6dccb", f.left), b.x - 5, b.y - y0 - Math.round(h / 2), 10, 1);
      }
      for (const dx of [-6, 6]) {
        p.oval(INK, b.x + dx, b.y - 1, 2, 2);
      }
    },
  };
}

/** Grey staff lockers, a plant on top. */
function lockersProp(rows: number, share: number): PropSpec {
  return {
    key: "prop:lockers",
    x: 0,
    y: rows - 1,
    height: 62,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const b: Box = [0.08, 0.05, 0.6, 0.9];
      isoBox(p, g, light, ...b, 50, { top: "#8fa39b", left: "#7f948c", right: "#6c7f78" }, 0, share);
      for (const s of [1 / 3, 2 / 3]) fline(p, g, "right", b, s, 1, s, 49, light.lit("#4f5f59", f.right * 0.3));
      for (let k = 0; k < 3; k++) {
        const s0 = k / 3 + 0.06;
        for (const z of [42, 40, 38]) fline(p, g, "right", b, s0, z, s0 + 0.2, z, light.lit("#4f5f59", 0.1));
        const h = fpt(g, "right", b, s0 + 0.22, 26);
        p.rect(light.lit("#c9ccc8", 0.5), h.x, h.y - 3, 1, 4);
      }
      const st = fpt(g, "right", b, 0.45, 16);
      p.rect(light.lit("#e0703f", 0.4), st.x, st.y - 3, 3, 3);
      const s = SPRITES.plant;
      const top = project(g, 0.38, 0.5, 50);
      p.sprite(s.grid, litPalette(s.palette, light, share), top.x - 5, top.y - s.grid.length + 1);
    },
  };
}

/** Stacked plastic crates. */
function cratesProp(x: number, y: number, share: number): PropSpec {
  return {
    key: "prop:crates",
    x,
    y,
    height: 28,
    pad: 3,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const cols = ["#4f7f9a", "#5f8a66", "#4f7f9a"];
      cols.forEach((c, i) => {
        const b: Box = [0.15 + (i % 2) * 0.03, 0.18, 0.62, 0.55];
        isoBox(p, g, light, ...b, 8, { top: mixHex(c, "#ffffff", 0.15), left: c, right: mixHex(c, INK, 0.2) }, i * 8, share);
        fquad(p, g, "left", b, 0.3, 0.7, i * 8 + 4, i * 8 + 6, light.lit(mixHex(c, INK, 0.45), f.left * 0.3));
      });
    },
  };
}

// Things on the walls.

/** The dispatch board: the day's routes drawn between the shops, a legend, a clipboard. */
function dispatchBoard(wall: "left" | "right", at: number, z: number): WallItem {
  const W = 58;
  const H = 32;
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wquad(p, place, -2, -2, W + 4, H + 4, light.lit("#7d8588", 0.3));
      wquad(p, place, 0, 0, W, H, light.lit("#eeeee6", 0.3));
      wword(p, place, 3, H - 2, "ROUTES", light.lit("#2f4a5a", 0.2));
      // Shops as pins, the commissary in the middle, a route out to each in its colour.
      const hub = [24, 13] as const;
      const routes: [string, [number, number][]][] = [
        ["#c9573f", [[8, 6], [4, 14], [9, 20]]],
        ["#4f8fa0", [[34, 22], [46, 24], [52, 18]]],
        ["#5f8a56", [[36, 6], [48, 8], [54, 4]]],
        ["#8e6a9e", [[16, 22], [22, 25]]],
      ];
      for (const [col, pts] of routes) {
        let prev: readonly [number, number] = hub;
        for (const q of pts) {
          wline(p, place, prev[0], prev[1], q[0], q[1], light.lit(col, 0.3));
          prev = q;
        }
        for (const q of pts) wdisc(p, place, q[0], q[1], 1.4, light.lit(col, 0.2));
      }
      wdisc(p, place, hub[0], hub[1], 2.4, light.lit("#2f4a5a", 0.2));
      // Magnets and the legend's ticks down the right edge.
      for (const [i, col] of ["#c9573f", "#4f8fa0", "#5f8a56"].entries()) wquad(p, place, W - 8, H - 10 - i * 4, 5, 2, light.lit(col, 0.3));
      wquad(p, place, -2, -4, W + 4, 2, light.lit("#9aa3a6", 0.4));
      wdot(p, place, 10, -3, light.lit("#c2493c", 0.4), 2, 1);
      wdot(p, place, 14, -3, light.lit("#2f4a5a", 0.3), 2, 1);
      // The clipboard beside it.
      wquad(p, place, W + 5, 6, 12, 16, light.lit("#9a7c56", 0.3));
      wquad(p, place, W + 6, 7, 10, 13, light.lit("#efe9dc", 0.3));
      for (let k = 0; k < 4; k++) wline(p, place, W + 8, 17 - k * 3, W + 14, 17 - k * 3, light.lit("#7d8588", 0.2));
      wquad(p, place, W + 8, 21, 6, 2, light.lit("#5f6466", 0.3));
    },
  };
}

/** The roll-up door: ribbed slats over a gap of daylight, guide rails, the coil housing, the dock number. */
function rollUpDoor(wall: "left" | "right", at: number, gap: number, tiles: number): WallItem {
  return {
    wall,
    at,
    z: 0,
    draw(p, light, place) {
      const w = tiles * 24;
      const top = 64;
      for (let up = gap; up < top; up++) {
        const rib = (up - gap) % 4;
        const c = rib === 0 ? "#7f8885" : rib === 3 ? "#c6ccc8" : "#a9b0ac";
        wquad(p, place, 0, up, w, 1, light.lit(c, 0.25));
      }
      // The bottom bar in hazard stripes.
      for (let a = 0; a < w; a++) wquad(p, place, a, gap, 1, 3, light.lit(Math.floor((a + 200) / 4) % 2 ? YELLOW : "#3a3537", 0.3));
      wquad(p, place, w / 2 - 4, gap + 6, 8, 2, light.lit("#3a3537", 0.2));
      // Rails and the housing.
      wquad(p, place, -3, 0, 3, top + 2, light.lit("#5f6466", 0.2));
      wquad(p, place, w, 0, 3, top + 2, light.lit("#5f6466", 0.2));
      wquad(p, place, -4, top, w + 8, 8, light.lit("#8a9092", 0.3));
      wline(p, place, -4, top, w + 4, top, light.lit(INK, 0));
      wword(p, place, w / 2 - 12, top + 15, "DOCK 2", light.lit(INK, 0.1));
      // A pull chain.
      for (let up = gap + 10; up < top; up += 2) wdot(p, place, w + 5, up, light.lit("#6f7476", 0.3));
    },
  };
}

/** The walk-in cooler's latch, its plate and a temperature readout. */
function coolerTrim(wall: "left" | "right", at: number, z: number, tiles: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const w = tiles * 24;
      wquad(p, place, w - 8, 22, 4, 12, light.lit("#6f7476", 0.3));
      wquad(p, place, w - 9, 27, 6, 2, light.lit("#d9dcdb", 0.5));
      wquad(p, place, w / 2 - 9, 50, 18, 7, light.lit("#2f4a5a", 0.2));
      wword(p, place, w / 2 - 7, 56, "COLD", light.lit("#e6eef0", 0.4));
      wquad(p, place, w + 4, 40, 11, 7, light.lit("#2f2c2e", 0.1));
      wword(p, place, w + 5, 46, "2C", light.night > 0.2 ? "#8fe0a8" : light.lit("#8fd0a8", 0.4));
      // Plastic strip curtain tails at the bottom.
      for (let a = 3; a < w - 2; a += 4) wquad(p, place, a, 0, 2, 4, light.lit("#c9d6d8", 0.3));
    },
  };
}

/** A punch clock and a rack of time cards. */
function punchClock(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wquad(p, place, 0, 8, 12, 14, light.lit("#c9b78e", 0.3));
      wdisc(p, place, 6, 17, 3, light.lit("#efe9dc", 0.4));
      wdot(p, place, 6, 17, light.lit(INK, 0));
      wquad(p, place, 3, 9, 6, 2, light.lit("#3a3537", 0.2));
      wquad(p, place, 15, 0, 10, 22, light.lit("#7d8588", 0.3));
      for (let k = 0; k < 4; k++) wquad(p, place, 16, 3 + k * 5, 8, 4, light.lit(k === 1 ? "#e8d08a" : "#efe9dc", 0.3));
    },
  };
}

/** Order tickets pegged along a wire. */
function ticketWire(wall: "left" | "right", at: number, z: number, tiles: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const w = tiles * 24;
      wline(p, place, 0, 0, w, 0, light.lit("#5f6466", 0.2));
      for (let a = 4, i = 0; a < w - 4; a += 7, i++) {
        wquad(p, place, a, -9, 5, 9, light.lit(i % 3 === 1 ? "#f3e2a6" : "#efe9dc", 0.35));
        wline(p, place, a + 1, -3, a + 3, -3, light.lit("#9aa3a6", 0.2));
        wline(p, place, a + 1, -5, a + 4, -5, light.lit("#9aa3a6", 0.2));
        wdot(p, place, a + 2, 1, light.lit(["#c9573f", "#4f8fa0", "#5f8a56"][i % 3], 0.3), 1, 2);
      }
    },
  };
}

/** A first aid box. */
function firstAid(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wquad(p, place, 0, 0, 12, 10, light.lit("#efe9dc", 0.35));
      wquad(p, place, 5, 2, 2, 6, light.lit("#4f8a56", 0.3));
      wquad(p, place, 3, 4, 6, 2, light.lit("#4f8a56", 0.3));
    },
  };
}

/** Conduit run along the top of a wall. */
function conduit(wall: "left" | "right", z: number, tiles: number): WallItem {
  return {
    wall,
    at: 0,
    z,
    draw(p, light, place) {
      const w = tiles * 24;
      wquad(p, place, 0, 0, w, 2, light.lit("#7d8588", 0.3));
      wline(p, place, 0, 2, w, 2, light.lit("#c6ccc8", 0.4));
      for (let a = 18; a < w; a += 36) wquad(p, place, a, -1, 2, 4, light.lit("#5f6466", 0.2));
    },
  };
}

/** A wall-mounted extinguisher. */
function extinguisher(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const s = SPRITES.extinguisher;
      p.sprite(s.grid, litPalette(s.palette, light, 0.3), place.x - 2, place.y - s.grid.length);
      wquad(p, place, -3, s.grid.length + 2, 8, 4, light.lit("#c2493c", 0.3));
    },
  };
}

// The commissary from the yard, front on.

/** The warehouse seen across the yard: the loading dock, one door up with the van backed in, the office door up the steps. */
function dockFront(p: Painter, light: Light, box: FrontBox) {
  const lit = (hex: string, f = 0.6, g = 0) => light.lit(hex, f, g);
  const { ground } = box;
  const night = light.night > 0.4;
  const x0 = box.x - 14;
  const x1 = box.x + box.w + 14;
  const roof = box.y + 16;
  const dock = ground - 14;
  p.alpha(0.3, () => p.rect(INK, x0 - 4, ground - 2, x1 - x0 + 8, 4));
  // Corrugated sheet walls, a parapet with rooftop plant.
  p.rect(INK, x0 - 1, roof - 1, x1 - x0 + 2, dock - roof + 1);
  for (let x = x0; x < x1; x++) {
    const r = (x - x0) % 4;
    p.rect(lit(r === 0 ? METAL_L : r === 3 ? METAL_D : METAL, 0.6), x, roof, 1, dock - roof);
  }
  p.rect(lit("#6f7672", 0.6), x0 - 2, roof - 4, x1 - x0 + 4, 4);
  p.rect(lit("#8f9692", 0.8), x0 - 2, roof - 4, x1 - x0 + 4, 1);
  for (const [ux, uw, uh] of [[x0 + 12, 22, 9], [x1 - 40, 16, 7]] as const) {
    p.rect(INK, ux - 1, roof - 5 - uh, uw + 2, uh + 1);
    p.rect(lit("#a9b0ac", 0.7), ux, roof - 4 - uh, uw, uh);
    for (let k = 3; k < uw - 2; k += 3) p.rect(lit("#7f8885", 0.3), ux + k, roof - 2 - uh, 1, uh - 3);
  }
  p.rect(lit("#6f7476", 0.5), x1 - 56, roof - 18, 3, 14);
  // The name across the fascia.
  const name = box.name.toUpperCase();
  const tw = bigWidth(name);
  const mid = Math.round((x0 + x1) / 2);
  p.rect(INK, mid - tw / 2 - 7, roof + 3, tw + 14, 13);
  p.rect(lit(TEAL, 0.6), mid - tw / 2 - 6, roof + 4, tw + 12, 11);
  bigWord(p, name, lit("#eef2ef", 0.7, 0.4), Math.round(mid - tw / 2), roof + 6);
  // The dock: concrete, black bumpers, a yellow and black edge.
  p.rect(INK, x0 - 4, dock - 1, x1 - x0 - 30, ground - dock + 1);
  p.rect(lit("#a3a49c", 0.7), x0 - 3, dock, x1 - x0 - 32, ground - dock);
  for (let x = x0 - 3; x < x1 - 35; x++) p.rect(lit(Math.floor((x + 400) / 4) % 2 ? YELLOW : "#3a3537", 0.6), x, dock, 1, 2);
  // Two roll-up doors: the left one up with the van in, the right one down.
  const doors = [x0 + 14, x0 + 70];
  const dw = 44;
  const dtop = roof + 26;
  doors.forEach((dx, i) => {
    p.rect(INK, dx - 3, dtop - 4, dw + 6, dock - dtop + 4);
    p.rect(lit("#5f6466", 0.4), dx - 2, dtop - 3, dw + 4, 3);
    const up = i === 0 && box.open ? 1 : i === 1 && box.open ? 0.35 : 0;
    const slatsTo = Math.round(dtop + (dock - dtop) * (1 - up));
    for (let y = dtop; y < slatsTo; y++) p.rect(lit((y - dtop) % 4 === 0 ? "#7f8885" : (y - dtop) % 4 === 3 ? "#c6ccc8" : "#a9b0ac", 0.6), dx, y, dw, 1);
    if (slatsTo < dock) {
      p.rect(night ? "#e9d9a8" : lit("#4a4e4c", 0.2), dx, slatsTo, dw, dock - slatsTo);
      // Pallets of stock inside.
      for (let k = 0; k < 3; k++) {
        const px = dx + 3 + k * 14;
        const ph = 8 + (k % 2) * 5;
        if (dock - ph - 2 < slatsTo) continue;
        p.rect(INK, px - 1, dock - ph - 3, 12, ph + 1);
        p.rect(lit(k === 1 ? "#d8c49a" : CARD, 0.4), px, dock - ph - 2, 10, ph - 1);
        p.rect(lit("#9a7c56", 0.3), px, dock - 3, 10, 2);
      }
    }
    for (let x = dx; x < dx + dw; x++) p.rect(lit(Math.floor((x - dx) / 4) % 2 ? YELLOW : "#3a3537", 0.6), x, slatsTo - 2, 1, 2);
    p.rect(lit("#3a3537", 0.3), dx + 2, dock - 1, 4, 3);
    p.rect(lit("#3a3537", 0.3), dx + dw - 6, dock - 1, 4, 3);
    // A dock lamp over it.
    p.rect(INK, dx + dw / 2 - 4, dtop - 9, 9, 4);
    p.rect(light.night > 0.15 ? "#ffe2a0" : lit("#c9ccc8", 0.6), dx + dw / 2 - 3, dtop - 7, 7, 2);
    if (light.night > 0.15) p.alpha(0.25 * light.night, () => p.oval("#ffd890", dx + dw / 2, dtop - 3, 16, 7));
    // The dock's number on a plate by the lamp.
    p.rect(INK, dx + dw - 8, dtop - 11, 9, 9);
    p.rect(lit(YELLOW, 0.7), dx + dw - 7, dtop - 10, 7, 7);
    word(p, String(i + 1), lit(INK, 0.2), dx + dw - 5, dtop - 9);
  });
  // The van backed up to dock 1.
  const vx = doors[0] - 4;
  const vy = ground - 46;
  p.rect(INK, vx - 1, vy - 1, 54, 42);
  p.rect(lit(VAN, 0.7), vx, vy, 52, 40);
  p.rect(lit("#f3f0e8", 0.9), vx, vy, 52, 2);
  p.rect(lit(mixHex(VAN, INK, 0.15), 0.5), vx + 25, vy + 4, 1, 32);
  p.rect(lit(TEAL, 0.6), vx, vy + 24, 52, 4);
  word(p, "ORDER UP", lit(TEAL, 0.5), vx + 10, vy + 10);
  for (const lx of [vx + 2, vx + 46]) p.rect(lit("#c2493c", 0.6, light.night > 0.3 ? 0.6 : 0), lx, vy + 30, 4, 4);
  p.rect(lit("#3a3537", 0.3), vx - 2, vy + 38, 56, 4);
  for (const wx of [vx + 8, vx + 44]) {
    p.oval(INK, wx, ground - 4, 5, 5);
    p.oval(lit("#3a3537", 0.2), wx, ground - 4, 4, 4);
    p.rect(lit("#9a9da0", 0.6), wx - 1, ground - 5, 2, 2);
  }
  // The office: a window with the dispatch board in it, a door up a flight of steps.
  const ox = x1 - 52;
  const oy = roof + 28;
  p.rect(INK, ox - 2, oy - 2, 24, 20);
  p.rect(night ? "#f0dca0" : lit("#cfd6d2", 0.5), ox - 1, oy - 1, 22, 18);
  p.rect(lit("#eeeee6", 0.5), ox + 2, oy + 2, 16, 10);
  p.line(lit("#c9573f", 0.4), ox + 4, oy + 9, ox + 10, oy + 5);
  p.line(lit("#4f8fa0", 0.4), ox + 10, oy + 5, ox + 16, oy + 8);
  p.rect(lit("#9aa3a6", 0.5), ox - 3, oy + 17, 26, 2);
  if (box.display && box.open) displayCup(p, light, box.display, ox + 10, oy + 17);
  const dx = x1 - 24;
  const dy = dock - 34;
  p.rect(INK, dx - 1, dy - 1, 20, dock - dy + 1);
  p.rect(lit("#5f8a86", 0.6), dx, dy, 18, dock - dy);
  p.rect(lit("#cfd6d2", 0.5), dx + 4, dy + 4, 10, 8);
  p.rect(lit("#d6a367", 0.7), dx + 13, dy + 18, 2, 2);
  const tag = box.open ? "OPEN" : "SHUT";
  p.rect(INK, dx, dy + 13, 18, 8);
  p.rect(box.open ? lit("#7f9a72", 0.6, 0.6) : lit("#c4574a", 0.6), dx + 1, dy + 14, 16, 6);
  word(p, tag, lit("#fff1dd", 0.6), dx + 2, dy + 15);
  // Steps down and a rail.
  for (let k = 0; k < 4; k++) {
    p.rect(INK, dx - 2 - k * 3, dock + k * 3.5 - 1, 22, 4);
    p.rect(lit("#a3a49c", 0.7), dx - 1 - k * 3, dock + k * 3.5, 20, 3);
  }
  p.line(lit(YELLOW, 0.6), dx - 12, ground - 16, dx - 2, dock - 16);
  p.rect(lit(YELLOW, 0.6), dx - 12, ground - 16, 1, 14);
  // Bollards and a pallet stack on the yard.
  for (const bx of [x0 - 10, x1 + 8]) {
    p.rect(INK, bx - 1, ground - 17, 6, 17);
    p.rect(lit(YELLOW, 0.6), bx, ground - 16, 4, 16);
    p.rect(lit("#3a3537", 0.3), bx, ground - 11, 4, 2);
  }
}

/** The tubes hang on chains from the roof. */
function tubeChains(p: Painter, g: IsoGrid, light: Light) {
  const chain = light.lit("#5f6466", 0.2);
  for (const [x, y] of TUBES) {
    const at = project(g, x, y, 76);
    for (const dx of [-8, 8]) for (let k = 1; k < 16; k += 2) p.rect(chain, at.x + dx, at.y - 1 - k, 1, 1);
  }
}

const TUBES: [number, number][] = [[2.5, 2.5], [6.2, 2.4], [9.4, 3.6], [3.2, 6.0], [7.0, 6.0]];

export function commissaryVenue(o: VenueOptions): Venue {
  const { cols, rows } = o;
  const share = 0.3;
  const doorAt = 6.2;
  const doorW = 2.4;
  return {
    id: "commissary",
    cols,
    rows,
    floor: warehouseFloor(cols, rows),
    wall: metalWall,
    wainscot: { surface: blockWainscot, height: 24, rail: YELLOW },
    cap: "#6f7672",
    slab: "#8f918b",
    slabHeight: 10,
    windows: [
      { wall: "left", at: 3.2, width: 3.4, sill: 50, top: 72, bars: 5, transom: 11, frame: "#4f5856" },
      { wall: "right", at: 9.1, width: 1.8, sill: 44, top: 70, bars: 2, transom: 13, frame: "#4f5856" },
      // The gap under the half-open roll-up door.
      { wall: "right", at: doorAt + 0.05, width: doorW - 0.1, sill: 0.5, top: 9, frame: "#3f4442" },
    ],
    doors: [{ wall: "right", at: 2.2, width: 1.5, height: 60, color: "#c3c8c6" }],
    lamps: TUBES.map(([x, y]) => ({ kind: "tube" as const, x, y, z: 76, reach: 3 })),
    wallItems: [
      conduit("left", 74, rows),
      conduit("right", 74, cols),
      dispatchBoard("left", 0.45, 24),
      clock("left", rows - 0.5, 60, o.hour),
      firstAid("right", 0.35, 34),
      extinguisher("right", 1.6, 4),
      coolerTrim("right", 2.2, 0, 1.5),
      punchClock("right", 4.0, 26),
      rollUpDoor("right", doorAt, 9, doorW),
      ticketWire("right", 9.0, 34, 1.9),
    ],
    props: [
      rackProp("prop:rack0", 0, 3, 0, share),
      rackProp("prop:rack1", 0, 4, 1, share),
      rackProp("prop:rack2", 0, 5, 2, share),
      palletProp("prop:pallet0", 6, 6, false, share),
      palletProp("prop:sacks", 7, 6, true, share),
      palletProp("prop:sacks", cols - 1, 0, true, share),
      handTruckProp(4.05, 0.05, share),
      lockersProp(rows, share),
      cratesProp(3, rows - 1, share),
      ...frontWalls(cols, rows, {
        key: "front:com",
        height: 16,
        top: YELLOW,
        face: METAL,
        draw(p, g, light, face, box) {
          const f = faceLight(light, 0.6);
          const l = face === "left" ? f.left : f.right;
          for (let s = 1 / 12; s < 1; s += 1 / 6) fline(p, g, face, box, s, 1, s, 15, light.lit(METAL_D, l * 0.5));
          for (let s = 0; s < 1; s += 1 / 6) fline(p, g, face, box, s, 1, s, 15, light.lit(METAL_L, l));
        },
      }),
    ],
    counter: { top: "#d0d5d4", front: "#a9afae", side: "#8f9594", trim: "#c2c7c6", panel: "steel", height: 16 },
    outside: {
      ground: yardGround(cols, rows),
      far: farYard,
      view: yardView,
      props: [
        // Only the runs the frame shows.
        fenceProp("out:fence-l", -6.6, -7.2, 11.5, false),
        fenceProp("out:fence-r", -6.6, -7.2, 13, true),
        vanProp("out:van", 4.6, -6.0),
        palletStackProp("out:pallets0", -4.6, 0.6, 5),
        palletStackProp("out:pallets1", -4.4, 1.8, 3),
        dumpsterProp("out:dumpster", -4.9, 3.6),
        forkliftProp("out:forklift", 4.8, rows + 1.2),
        bollardProp("out:bollard", 1.4, rows + 1.4),
        bollardProp("out:bollard", 2.6, rows + 1.4),
        coneProp("out:cone", cols + 2.4, 2.2),
        coneProp("out:cone", cols + 2.9, 2.6),
        palletStackProp("out:pallets2", cols + 1.8, 4.4, 2),
        lampPostProp("out:lamp", cols + 1.4, -1.4),
      ],
    },
    overhead: tubeChains,
    facade: {
      wall: metalWall,
      trim: "#6f7672",
      sign: { board: TEAL, ink: "#eef2ef" },
      door: "#5f8a86",
      paint: dockFront,
      neighbours: "none",
      queueAt: 0.98,
    },
    entry: [7.4, 0.45],
    queue: [
      [9.5, 2.45],
      [9.4, 3.4],
      [9.3, 4.35],
      [9.2, 5.3],
    ],
    pickup: [8.4, 2.3],
    indoorSun: share,
  };
}
