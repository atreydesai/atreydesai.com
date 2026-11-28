/**
 * The Boardwalk Shack: a driftwood hut on the boardwalk above the beach.
 * Bleached board walls over a sun-faded turquoise wainscot, a thatch fringe
 * along the wall tops, sand blown in over the planks, bamboo counters,
 * surfboards in the corner and shells strung along the walls. Outside, the
 * deck gives way to sand, umbrellas and palms, and the sea runs along the
 * horizon. Ice is the trouble here: chests, tubs and coolers of it, melting.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, isoTile, project, faceLight, type IsoGrid } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { planks, shiplap, ground as groundSurface, type Surface } from "../surfaces.ts";
import type { Venue, PropSpec, WallItem, FrontBox } from "../types.ts";
import { displayCup } from "../front.ts";
import type { VenueOptions } from "./index.ts";
import { menuBoard, clock } from "../walls.ts";
import { lampPostProp, INK } from "../props.ts";
import { word, bigWord, bigWidth } from "../font.ts";
import { overlay, litOnce, table, wpt, wline, wdot, wdisc, wring, fpt, fquad, fline, frontWalls } from "./_frontier-kit.ts";

const DRIFT = "#cdbfa5";
const DRIFT_ALT = "#c3b499";
const DRIFT_SEAM = "#8e806c";
const TURQ = "#6ea7a1";
const TURQ_SEAM = "#4e7f7b";
const STRAW = "#c8a362";
const STRAW_D = "#9a7843";
const STRAW_L = "#dcc07f";
const SAND = "#dfc99b";
const CORAL = "#d9774f";
const CREAM = "#f0e4c8";
const ICE = "#cfe6ea";

/** Bleached driftwood boards, uneven, with grain streaks and the odd dark edge. */
const driftwood: Surface = {
  colors: [DRIFT, DRIFT_ALT, DRIFT_SEAM, "#dacdb5", "#b6a78d"],
  at(u, z) {
    const b = Math.floor(u / 8);
    const x = u - b * 8;
    if (x < 1) return 2;
    if (x > 7 && noise(b, 1, 3) > 0.5) return 4;
    const g = noise(Math.floor(u), Math.floor(z / 4), 7);
    if (g > 0.93) return 3;
    if (g < 0.04) return 4;
    return noise(b, Math.floor(z / 30), 9) > 0.55 ? 1 : 0;
  },
};

/** Turquoise shiplap gone pale in the sun, peeling to the wood in places. */
const wainscot = overlay(shiplap(TURQ, "#79b0aa", TURQ_SEAM, 5), ["#94bfb7", DRIFT], (u, z) => {
  const n = noise(Math.floor(u / 5), Math.floor(z / 3), 17);
  return n > 0.965 ? 1 : n > 0.86 ? 0 : -1;
});

/** Bleached floorboards, sand blown in at the doorway and along the walls, a jute mat, a melt puddle. */
function shackFloor(cols: number, rows: number): Surface {
  const doorX = 6;
  return overlay(planks("#c6af8c", "#bea684", "#8f7b62", "#ae9777", 8, 52), [SAND, "#d4bd8e", "#b8996a", "#9c7c4f", "#8fbcbd", "#a9d0cf"], (u, v) => {
    const x = u / 24;
    const y = v / 24;
    // The melt puddle round the ice tub in the front corner.
    const px = x - (cols - 0.75);
    const py = y - (rows - 0.85);
    const pd = px * px * 1.2 + py * py * 1.6 + noise(Math.floor(u / 3), Math.floor(v / 3), 4) * 0.14;
    if (pd < 0.62) return pd < 0.45 ? 5 : 4;
    // A jute mat inside the doorway.
    if (x > doorX - 0.9 && x < doorX + 0.85 && y > rows - 0.8 && y < rows - 0.12) {
      if (x < doorX - 0.84 || x > doorX + 0.79) return 3;
      return Math.floor(v / 3) % 3 === 0 ? 3 : 2;
    }
    // Sand: thick at the doorway, a little along the walls.
    const dx = x - doorX;
    const dy = y - rows;
    const door = 1 - Math.sqrt(dx * dx * 0.7 + dy * dy) / 2.6;
    const wall = Math.min(x, y) < 0.45 ? 0.35 - Math.min(x, y) * 0.6 : 0;
    const amount = Math.max(door, wall);
    if (amount <= 0) return -1;
    const n = noise(Math.floor(u), Math.floor(v), 5);
    if (n < amount * 0.75) return noise(Math.floor(u / 2), Math.floor(v / 2), 6) > 0.5 ? 0 : 1;
    return -1;
  });
}

// The outside: a deck round the shack, sand, wet sand at the shore, the sea toward the horizon.
const deck = planks("#a98b69", "#b29473", "#76614c", "#9c7f5f", 7, 64);
const sand = groundSurface(SAND, "#d8c191", "#ebdab3", 0.07, 13);
const SHORE = -5.1;

function beachGround(cols: number, rows: number) {
  return (x: number, y: number) => {
    const s = x + y;
    const across = x - y;
    const shore = SHORE + Math.sin(across * 0.8) * 0.22 + Math.sin(across * 2.3) * 0.08;
    if (s < shore) {
      // The sea: foam at the edge, wave crests in broken lines, deeper toward the horizon.
      const d = shore - s;
      if (d < 0.16) return "#e9ece0";
      const w = (d - 0.55) / 0.95;
      const f = w - Math.floor(w);
      if (w > 0 && f < 0.07 && noise(Math.floor(across * 3), Math.floor(w), 3) > 0.3) return "#dfeae2";
      if (d < 0.9) return noise(Math.floor(x * 24), Math.floor(y * 24), 2) > 0.9 ? "#7cbcbb" : "#62a9ad";
      if (d < 1.8) return "#4f97a5";
      return noise(Math.floor(x * 12), Math.floor(y * 24), 8) > 0.92 ? "#4d8fa2" : "#43849a";
    }
    if (s < shore + 0.55) return noise(Math.floor(x * 24), Math.floor(y * 24), 9) > 0.85 ? "#c2a87c" : "#b99e74";
    const onDeck = x > -2.2 && x < cols + 2.2 && y > -2 && y < rows + 3;
    if (onDeck) {
      // The deck's edge board, then the planks.
      if (x < -2.05 || x > cols + 2.05 || y > rows + 2.85 || y < -1.85) return "#6f5a46";
      return deck.colors[deck.at(x * 24, y * 24)];
    }
    // Footprints in the sand down from the deck.
    const k = Math.floor((y - rows - 3) / 0.42);
    const fx = 6.2 + Math.sin(k * 0.7) * 0.3 + (k & 1 ? 0.12 : -0.12);
    const fy = rows + 3 + (k + 0.5) * 0.42;
    if (k >= 0 && (x - fx) ** 2 * 30 + (y - fy) ** 2 * 60 < 0.12) return "#c9b083";
    return sand.colors[sand.at(x * 24, y * 24)];
  };
}

/** The sea's far edge, a headland with a lighthouse, a sail, gulls and a cloud bank. */
function farSea(p: Painter, light: Light, width: number, horizon: number) {
  const deep = light.lit("#3c7a90", 0.3);
  p.rect(deep, 0, horizon - 2, width, 3);
  p.rect(light.lit("#5d9db0", 0.5), 0, horizon - 3, width, 1);
  // A low headland on the left with a lighthouse.
  const land = light.lit("#7d8f6a", 0.3);
  p.poly(land, [0, horizon - 2, 0, horizon - 9, 22, horizon - 11, 46, horizon - 7, 70, horizon - 3, 80, horizon - 2]);
  p.rect(light.lit(CREAM, 0.6), 30, horizon - 20, 3, 10);
  p.rect(light.lit(CORAL, 0.5), 30, horizon - 16, 3, 2);
  p.rect(light.night > 0.4 ? "#ffe2a0" : light.lit("#55585b", 0.2), 30, horizon - 22, 3, 2);
  if (light.night > 0.4) p.alpha(0.35 * light.night, () => p.oval("#ffe2a0", 31, horizon - 21, 6, 3));
  // A sail far out.
  const sx = Math.round(width * 0.68);
  p.poly(light.lit(CREAM, 0.7), [sx, horizon - 3, sx + 5, horizon - 3, sx + 1, horizon - 12]);
  p.poly(light.lit("#d9d0bb", 0.4), [sx - 3, horizon - 3, sx, horizon - 3, sx, horizon - 9]);
  p.rect(light.lit("#6a4e3c", 0.3), sx - 3, horizon - 3, 9, 1);
  // A bank of cloud low over the sea.
  const cloud = light.lit("#f3ede0", 0.6);
  const under = light.lit("#d9d2c6", 0.2);
  for (const [cx, cy, r] of [[0.22, 9, 4], [0.55, 6, 5], [0.88, 10, 3]] as const) {
    const x = Math.round(width * cx);
    p.oval(under, x, cy + 1, r * 3, r * 0.7);
    p.oval(cloud, x - r, cy - 1, r * 1.4, r * 0.8);
    p.oval(cloud, x + r, cy, r * 1.6, r * 0.7);
    p.oval(cloud, x, cy - r * 0.5, r, r * 0.8);
    p.rect(under, x - r * 3, cy + 1, r * 6, 1);
  }
  // Gulls.
  const gull = light.lit("#4a4448", 0.2);
  for (const [gx, gy] of [[0.42, 6], [0.45, 4], [0.78, 7]] as const) {
    const x = Math.round(width * gx);
    p.rect(gull, x - 2, gy, 2, 1);
    p.rect(gull, x + 1, gy, 2, 1);
    p.rect(gull, x, gy + 1, 1, 1);
  }
}

// The window view: sand, a strip of sea with foam, the horizon, sky; a palm on the right, an umbrella on the left.
const VIEW = litOnce([
  [SAND, 0.6],
  ["#c2a87c", 0.4],
  ["#eef0e4", 0.7],
  ["#64abaf", 0.5],
  ["#4c92a2", 0.4],
  ["#3c7a90", 0.3],
  ["#6a4e3c", 0.3],
  ["#5f8a56", 0.4],
  [CORAL, 0.6],
  [CREAM, 0.6],
  ["#7d8f6a", 0.3],
]);
const SWELL = table(2048, (i) => Math.sin(i / 5) * 0.018 + Math.sin(i / 13) * 0.012);

function shackView(u: number, v: number, light: Light) {
  const c = VIEW(light);
  const [s0, s1, s2] = light.sky;
  const iu = Math.floor(u) & 2047;
  // A palm leaning in from the right of the shack, fronds over the sea.
  const pu = u - 165 - v * 10;
  if (u < 400 && v < 0.74 && pu > -1 && pu < 1.5) return c[6];
  const fu = u - 172;
  if (u < 400 && v > 0.66 && v < 0.86 && Math.abs(fu) < 16 && Math.abs(v - 0.76 + Math.abs(fu) * 0.006) < 0.03) return c[7];
  // A beach umbrella on the sand outside the left window.
  const bu = u - 1092;
  if (bu > -12 && bu < 12 && v > 0.2 && v < 0.34 && v < 0.34 - Math.abs(bu) * 0.008) return Math.floor((bu + 12) / 4) & 1 ? c[8] : c[9];
  if (Math.abs(bu) < 0.6 && v < 0.24) return c[9];
  if (v < 0.16) return noise(iu, Math.floor(v * 40), 4) > 0.9 ? c[1] : c[0];
  if (v < 0.19) return c[1];
  const sw = SWELL[iu];
  if (v < 0.22 + sw) return c[2];
  if (v < 0.33 + sw) return noise(iu >> 2, Math.floor(v * 30), 6) > 0.86 ? c[2] : c[3];
  if (v < 0.44) return c[4];
  if (v < 0.46) return c[5];
  if (u > 1000 && u < 1060 && v < 0.5 - (u - 1000) * 0.0007) return c[10];
  return v < 0.7 ? s2 : v < 0.88 ? s1 : s0;
}

// Things standing outside.

function umbrellaProp(key: string, x: number, y: number, a: string, b: string, towel: string): PropSpec {
  return {
    key,
    x,
    y,
    height: 38,
    pad: 16,
    shadow: "round",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const base0 = project(g, 0.5, 0.5, 0);
      if (light.weather === "rain") {
        // Furled for the rain, the towel taken in.
        p.rect(light.lit("#e9dcc2", f.left), base0.x, base0.y - 34, 1, 34);
        for (let r = 0; r < 20; r++) {
          const half = Math.round(1 + (r / 20) * 2.5);
          p.rect(light.lit(Math.floor(r / 4) & 1 ? b : a, f.left), base0.x - half, base0.y - 32 + r, half * 2 + 1, 1);
        }
        return;
      }
      // A towel on the sand beside the pole.
      isoTile(p, g, 0.75, 0.05, 0.5, 0.95, light.lit(towel, f.top));
      const t0 = project(g, 0.75, 0.05);
      const t1 = project(g, 1.25, 0.05);
      p.line(light.lit(mixHex(towel, CREAM, 0.5), f.top), t0.x, t0.y + 2, t1.x, t1.y + 2);
      const base = project(g, 0.5, 0.5, 0);
      p.rect(light.lit("#e9dcc2", f.left), base.x, base.y - 31, 1, 31);
      p.rect(light.lit("#9c8e7a", 0), base.x + 1, base.y - 31, 1, 31);
      const cx = base.x;
      const cy = base.y - 30;
      const rx = 16;
      const ry = 6;
      const top = { x: cx, y: cy - 7 };
      const seg = (i: number) => {
        const a0 = (i / 10) * Math.PI * 2;
        const a1 = ((i + 1) / 10) * Math.PI * 2;
        const lit = Math.sin((a0 + a1) / 2) > 0 ? f.left : f.top;
        p.poly(light.lit(i & 1 ? b : a, lit), [top.x, top.y, cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry]);
      };
      for (let i = 5; i < 10; i++) seg(i);
      for (let i = 0; i < 5; i++) seg(i);
      // Scalloped rim and outline along the front.
      for (let i = 0; i <= 20; i++) {
        const t = (i / 20) * Math.PI;
        const px = cx + Math.cos(t) * rx;
        const py = cy + Math.sin(t) * ry;
        p.rect(INK, px, py + 1, 1, 1);
      }
      p.line(INK, top.x, top.y - 1, top.x, top.y);
      p.rect(light.lit(CREAM, 0.6), top.x, top.y - 2, 1, 1);
    },
  };
}

function lifeguardProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    w: 1,
    d: 1,
    height: 58,
    pad: 6,
    draw(p, g, light) {
      const wood = "#e6dcc6";
      for (const [u, v] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]] as const) isoBox(p, g, light, u - 0.04, v - 0.04, 0.08, 0.08, 30, { top: wood, ink: "" });
      // Cross braces on the near legs.
      const a = project(g, 0.15, 0.85, 4);
      const b = project(g, 0.85, 0.85, 26);
      p.line(light.lit("#a8987e", 0.2), a.x, a.y, b.x, b.y);
      isoBox(p, g, light, 0.05, 0.05, 0.9, 0.9, 2, { top: "#b89a72" }, 30);
      isoBox(p, g, light, 0.15, 0.15, 0.7, 0.7, 14, { top: "#f0e7d4", left: "#e9dfca", right: "#cfc5b0" }, 32);
      const fl = faceLight(light, 1);
      fquad(p, g, "left", [0.15, 0.15, 0.7, 0.7], 0, 1, 38, 41, light.lit("#c9573f", fl.left));
      fquad(p, g, "right", [0.15, 0.15, 0.7, 0.7], 0, 1, 38, 41, light.lit("#a8463a", fl.right));
      fquad(p, g, "left", [0.15, 0.15, 0.7, 0.7], 0.2, 0.8, 42, 45, light.lit("#3b4a55", 0.1));
      isoBox(p, g, light, 0.08, 0.08, 0.84, 0.84, 2, { top: "#c9573f" }, 46);
      // A flag.
      const fp = project(g, 0.5, 0.5, 48);
      p.rect(light.lit("#5a4e44", 0.2), fp.x, fp.y - 10, 1, 10);
      p.poly(light.lit("#c9573f", 0.6), [fp.x + 1, fp.y - 10, fp.x + 7, fp.y - 8, fp.x + 1, fp.y - 6]);
      // A ramp down to the sand.
      const r0 = project(g, 0.5, 0.95, 30);
      const r1 = project(g, 0.5, 1.6, 0);
      p.line(light.lit("#b8a888", 0.3), r0.x - 2, r0.y, r1.x - 2, r1.y);
      p.line(light.lit("#b8a888", 0.3), r0.x + 2, r0.y, r1.x + 2, r1.y);
    },
  };
}

/** A cooler on the deck, lid up, ice inside and a puddle where it sweats. */
function deckCoolerProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 22,
    pad: 6,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      p.alpha(0.6, () => p.oval(light.lit("#8fbcbd", f.top), project(g, 0.62, 0.72).x, project(g, 0.62, 0.72).y + 1, 9, 3));
      isoBox(p, g, light, 0.2, 0.25, 0.6, 0.45, 11, { top: "#3d7f85", left: "#c9573f", right: "#a8463a" });
      // Ice heaped in the open top.
      for (let i = 0; i < 7; i++) {
        const q = project(g, 0.28 + (i % 4) * 0.13, 0.32 + Math.floor(i / 4) * 0.18, 12);
        p.rect(light.lit(i & 1 ? ICE : "#eef6f4", Math.min(1, f.top + 0.2)), q.x - 1, q.y - 2, 3, 2);
      }
      // The lid propped back.
      isoBox(p, g, light, 0.2, 0.2, 0.6, 0.06, 10, { top: "#e9e1cf", left: "#e9e1cf", right: "#cfc5b0" }, 11);
      fline(p, g, "left", [0.2, 0.25, 0.6, 0.45], 0.1, 6, 0.9, 6, light.lit(CREAM, f.left));
    },
  };
}

function signProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 36,
    pad: 8,
    shadow: "none",
    draw(p, g, light) {
      const b = project(g, 0.5, 0.5, 0);
      const f = faceLight(light, 1);
      p.alpha(0.25, () => p.rect(INK, b.x - 3, b.y - 1, 7, 2));
      p.rect(light.lit("#8a7356", f.left), b.x - 1, b.y - 30, 3, 30);
      p.rect(light.lit("#5e4c3a", 0), b.x + 1, b.y - 30, 1, 30);
      // A driftwood plank cut to an arrow, pointing in.
      const plank = light.lit(TURQ, f.left);
      p.poly(plank, [b.x - 14, b.y - 32, b.x + 10, b.y - 32, b.x + 15, b.y - 27, b.x + 10, b.y - 22, b.x - 14, b.y - 22]);
      p.line(INK, b.x - 14, b.y - 21, b.x + 10, b.y - 21);
      p.line(light.lit("#94bfb7", f.left), b.x - 13, b.y - 31, b.x + 9, b.y - 31);
      word(p, "BOBA", light.lit(CREAM, 0.5), b.x - 11, b.y - 30);
      // A shell nailed to the post.
      p.rect(light.lit("#efc2b0", 0.5), b.x - 1, b.y - 16, 3, 2);
    },
  };
}

/** A coconut palm: a ringed trunk that leans and curves, a crown of drooping fronds. */
function palmProp(key: string, x: number, y: number, lean: number, seed: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 76,
    pad: 22,
    shadow: "round",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const base = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, base.x, base.y, 5, 1.5));
      const H = 50;
      const bark = light.lit("#8a6a4c", f.left);
      const barkD = light.lit("#5e4636", 0);
      const ring = light.lit("#6c523e", 0.1);
      let tx = base.x;
      for (let r = 0; r < H; r++) {
        const t = r / H;
        const cx = base.x + lean * t * t * 16;
        const w = t < 0.15 ? 5 : t < 0.6 ? 4 : 3;
        const x0 = Math.round(cx - w / 2);
        p.rect(INK, x0 - 1, base.y - r, w + 2, 1);
        p.rect(r % 4 === 0 ? ring : bark, x0, base.y - r, w, 1);
        p.rect(barkD, x0 + w - 1, base.y - r, 1, 1);
        tx = cx;
      }
      const top = { x: Math.round(tx), y: base.y - H };
      const leaf = light.lit("#5e8a50", f.top);
      const dark = light.lit("#3f6542", 0);
      const pale = light.lit("#93b878", Math.min(1, f.top + 0.2));
      const fronds = 8;
      // Back fronds first, then the front ones over the trunk's top.
      const order = [1, 3, 5, 7, 0, 2, 4, 6];
      for (const i of order) {
        const a = (i / fronds) * Math.PI * 2 + noise(i, seed, 3) * 0.5;
        const L = 19 + noise(i, seed, 5) * 6;
        const dx = Math.cos(a);
        const dy = Math.sin(a) * 0.45;
        let px = top.x;
        let py = top.y;
        for (let s = 1; s <= L; s++) {
          const t = s / L;
          const x = top.x + dx * s;
          const y = top.y + dy * s - Math.sin(t * Math.PI * 0.7) * 6 + t * t * 9;
          p.line(dark, px, py + 1, x, y + 1);
          p.line(leaf, px, py, x, y);
          if (s % 2 === 0 && t > 0.15) {
            p.rect(dark, x, y + 1, 1, 2 + Math.round((1 - t) * 2));
            p.rect(pale, x, y - 1, 1, 1);
          }
          px = x;
          py = y;
        }
      }
      const nut = light.lit("#7a5a36", f.left);
      for (const [dx, dy] of [[-2, 2], [1, 3], [3, 1]] as const) {
        p.rect(INK, top.x + dx - 1, top.y + dy - 1, 4, 4);
        p.rect(nut, top.x + dx, top.y + dy, 2, 2);
      }
    },
  };
}

/** The deck's rail: a post and two rope swags a tile, one sprite repeated along the edge. */
function railProp(key: string, x: number, y: number, alongX: boolean): PropSpec {
  return {
    key,
    x,
    y,
    w: alongX ? 1 : 0.1,
    d: alongX ? 0.1 : 1,
    height: 20,
    pad: 4,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const post = light.lit("#9c8062", alongX ? f.left : f.right);
      const at = (s: number, z: number) => (alongX ? project(g, s, 0.05, z) : project(g, 0.05, s, z));
      const a = at(0, 0);
      p.rect(INK, a.x - 2, a.y - 17, 4, 17);
      p.rect(post, a.x - 1, a.y - 16, 2, 16);
      p.rect(light.lit("#c2a882", f.top), a.x - 1, a.y - 17, 2, 1);
      const rope = light.lit("#c9b48e", f.top * 0.8);
      for (const z of [14, 7]) {
        let prev = at(0, z);
        for (let k = 1; k <= 12; k++) {
          const s = k / 12;
          const q = at(s, z - Math.sin(s * Math.PI) * 3);
          p.line(rope, prev.x, prev.y, q.x, q.y);
          prev = q;
        }
      }
    },
  };
}

// Things standing in the shack.

/** Three surfboards leaning in the back corner. */
function boardsProp(share: number): PropSpec {
  return {
    key: "prop:boards",
    x: 0,
    y: 0,
    height: 64,
    pad: 4,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const boards: [number, number, string, string, number, number][] = [
        [0.3, 0.5, TURQ, CREAM, -0.14, 54],
        [0.52, 0.3, CORAL, "#f3d58a", 0.04, 58],
        [0.72, 0.6, CREAM, TURQ, 0.12, 50],
      ];
      for (const [u, v, body, stripe, lean, len] of boards) {
        const base = project(g, u, v, 0);
        p.alpha(0.3, () => p.rect(INK, base.x - 3, base.y - 1, 7, 2));
        for (let r = 0; r < len; r++) {
          const t = r / len;
          const half = 4.2 * Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2)) * (t > 0.45 ? 1 : 0.9 + t * 0.2);
          if (half < 0.4) continue;
          const cx = base.x + lean * r;
          const y = base.y - r;
          const w = Math.max(1, Math.round(half * 2));
          const x0 = Math.round(cx - w / 2);
          p.rect(INK, x0 - 1, y, w + 2, 1);
          p.rect(light.lit(body, f.left), x0, y, w, 1);
          p.rect(light.lit(mixHex(body, CREAM, 0.35), f.top), x0, y, 1, 1);
          if (t > 0.12 && t < 0.92) p.rect(light.lit(stripe, f.left), Math.round(cx), y, 1, 1);
        }
        const tip = project(g, u, v, len);
        p.rect(INK, Math.round(base.x + lean * len) - 1, tip.y, 2, 1);
      }
    },
  };
}

/** A chest freezer of ice against the back wall. */
function iceChestProp(share: number): PropSpec {
  return {
    key: "prop:icechest",
    x: 7,
    y: 0,
    height: 22,
    pad: 4,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const box = [0.08, 0.12, 0.84, 0.72] as const;
      isoBox(p, g, light, ...box, 14, { top: "#e7e3d8", left: "#e2ddd0", right: "#c4bfb2" }, 0, share);
      fquad(p, g, "left", box, 0, 1, 3, 6, light.lit(TURQ, f.left));
      fquad(p, g, "right", box, 0, 1, 3, 6, light.lit(TURQ_SEAM, f.right));
      const w = fpt(g, "left", box, 0.3, 13);
      word(p, "ICE", light.lit("#3d7f85", f.left), w.x, w.y - 0, 0.5);
      // The lid, frosted, a scoop on it.
      isoBox(p, g, light, 0.06, 0.1, 0.88, 0.76, 2, { top: "#eef3f1", left: "#dfe6e4", right: "#c9d0ce" }, 14, share);
      for (let i = 0; i < 6; i++) {
        const q = project(g, 0.2 + noise(i, 1, 3) * 0.6, 0.2 + noise(i, 2, 3) * 0.55, 16);
        p.rect(light.lit("#ffffff", 0.3), q.x, q.y, 2, 1);
      }
      const s = project(g, 0.5, 0.45, 16);
      p.rect(light.lit("#b9bdbc", 0.5), s.x - 3, s.y - 1, 5, 2);
      p.rect(light.lit("#7f8382", 0.2), s.x + 2, s.y - 1, 3, 1);
      // Drips down the front, a small puddle.
      for (const sx of [0.22, 0.6, 0.85]) {
        const d = fpt(g, "left", box, sx, 2);
        p.rect(light.lit("#a9d0cf", 0.4), d.x, d.y - 3, 1, 3);
      }
      const pd = project(g, 0.5, 0.95);
      p.alpha(0.55, () => p.oval(light.lit("#8fbcbd", 0.3), pd.x, pd.y, 6, 1.5));
    },
  };
}

/** A galvanised tub of ice and bottles in the front corner, sweating onto the boards. */
function iceTubProp(cols: number, rows: number, share: number): PropSpec {
  return {
    key: "prop:icetub",
    x: cols - 1,
    y: rows - 1,
    height: 14,
    pad: 4,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const c = project(g, 0.45, 0.4, 0);
      p.oval(light.lit("#7f8a8c", f.left), c.x, c.y - 4, 10, 5);
      p.rect(light.lit("#7f8a8c", f.left), c.x - 10, c.y - 9, 21, 5);
      p.oval(light.lit("#a7b2b3", f.top), c.x, c.y - 9, 10, 5);
      p.oval(light.lit("#cfe6ea", f.top), c.x, c.y - 9, 8, 3.5);
      for (let i = 0; i < 6; i++) p.rect(light.lit("#eef6f4", Math.min(1, f.top + 0.2)), c.x - 7 + i * 3, c.y - 10 + (i % 2), 2, 2);
      const bottles = ["#c98a4b", "#6f9a5a", "#c9573f", "#8e6a9e"];
      bottles.forEach((col, i) => {
        const bx = c.x - 5 + i * 3;
        p.rect(INK, bx - 1, c.y - 17 + (i % 2) * 2, 3, 8);
        p.rect(light.lit(col, f.left), bx, c.y - 16 + (i % 2) * 2, 1, 6);
      });
      for (let k = -10; k <= 10; k += 5) p.rect(light.lit("#5f6a6c", 0.1), c.x + k, c.y - 8, 1, 5);
      p.line(INK, c.x - 10, c.y - 9, c.x - 10, c.y - 4);
      p.line(INK, c.x + 10, c.y - 9, c.x + 10, c.y - 4);
    },
  };
}

/** Folded beach chairs and a furled umbrella stacked against the wall. */
function chairStackProp(rows: number, share: number): PropSpec {
  return {
    key: "prop:chairs",
    x: 0,
    y: rows - 1,
    height: 52,
    pad: 4,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const fabrics: [string, string][] = [[CORAL, CREAM], [TURQ, CREAM], ["#e7b84f", CREAM]];
      fabrics.forEach(([a, b], i) => {
        const base = project(g, 0.25, 0.25 + i * 0.22, 0);
        const lean = 0.22;
        const h = 34;
        for (let r = 0; r < h; r++) {
          const x = Math.round(base.x - 4 + lean * r);
          const y = base.y - r;
          p.rect(INK, x - 1, y, 10, 1);
          p.rect(light.lit("#b48a5e", f.left), x, y, 1, 1);
          p.rect(light.lit("#b48a5e", f.left), x + 7, y, 1, 1);
          if (r > 3 && r < h - 3) for (let k = 1; k < 7; k++) p.rect(light.lit(Math.floor((r + k) / 4) & 1 ? a : b, f.left), x + k, y, 1, 1);
        }
        p.rect(INK, Math.round(base.x - 4 + lean * h) - 1, base.y - h, 10, 1);
      });
      // The furled umbrella.
      const u = project(g, 0.7, 0.7, 0);
      p.rect(light.lit("#e9dcc2", f.left), u.x, u.y - 50, 1, 50);
      for (let r = 0; r < 26; r++) {
        const half = Math.round(1 + (r / 26) * 2.5);
        p.rect(light.lit(Math.floor(r / 5) & 1 ? CORAL : CREAM, f.left), u.x - half, u.y - 48 + r, half * 2 + 1, 1);
      }
      p.line(INK, u.x - 4, u.y - 22, u.x, u.y - 48);
      p.line(INK, u.x + 4, u.y - 22, u.x, u.y - 48);
    },
  };
}

/** A palm in a woven basket by the stock shelf. */
function pottedPalmProp(share: number): PropSpec {
  return {
    key: "prop:palm",
    x: 2.9,
    y: 0.02,
    height: 50,
    pad: 10,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const c = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, c.x, c.y, 7, 2));
      p.rect(INK, c.x - 7, c.y - 12, 15, 12);
      p.rect(light.lit("#b89463", f.left), c.x - 6, c.y - 11, 13, 10);
      for (let k = 0; k < 13; k += 2) p.rect(light.lit("#8f6d44", 0), c.x - 6 + k, c.y - 11 + (k % 4 ? 0 : 1), 1, 10);
      p.rect(light.lit("#d2b27c", f.top), c.x - 6, c.y - 11, 13, 1);
      p.rect(light.lit("#6a4c3c", 0.2), c.x - 1, c.y - 26, 2, 14);
      const fronds: [number, number][] = [[-16, -10], [-12, -20], [-3, -24], [7, -22], [15, -12], [17, -2], [-17, 0]];
      for (const [dx, dy] of fronds) {
        const tx = c.x + dx;
        const ty = c.y - 26 + dy;
        const leaf = light.lit("#5f8a56", f.top);
        const hi = light.lit("#8fb37a", Math.min(1, f.top + 0.2));
        p.line(leaf, c.x, c.y - 26, tx, ty);
        const n = 6;
        for (let i = 1; i < n; i++) {
          const x = c.x + (dx * i) / n;
          const y = c.y - 26 + (dy * i) / n;
          p.rect(leaf, x - 1, y + 1, 1, 2);
          p.rect(hi, x + 1, y + 1, 1, 2);
        }
      }
    },
  };
}

/** A little cooler and a beach ball under the left window. */
function coolerProp(share: number): PropSpec {
  return {
    key: "prop:cooler",
    x: 0,
    y: 2,
    height: 16,
    pad: 4,
    draw(p, g, light) {
      const f = faceLight(light, share);
      isoBox(p, g, light, 0.15, 0.1, 0.55, 0.42, 10, { top: "#e9e1cf", left: "#4f8fa0", right: "#3d7385" }, 0, share);
      isoBox(p, g, light, 0.13, 0.08, 0.59, 0.46, 2, { top: "#f1ead9", left: "#e2d9c4", right: "#c9c0ab" }, 10, share);
      const h = project(g, 0.42, 0.31, 12);
      p.rect(INK, h.x - 3, h.y - 1, 7, 1);
      // The beach ball.
      const b = project(g, 0.55, 0.78, 0);
      const r = 4;
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 4, 1));
      p.oval(INK, b.x, b.y - r, r + 1, r + 1);
      p.oval(light.lit(CREAM, f.top), b.x, b.y - r, r, r);
      p.rect(light.lit(CORAL, f.top), b.x - r, b.y - r - 1, 3, 3);
      p.rect(light.lit("#4f8fa0", f.top), b.x + 1, b.y - r - 3, 2, 3);
      p.rect(light.lit("#e7b84f", f.top), b.x, b.y - r + 1, 3, 2);
    },
  };
}

// Things on the walls.

/** Shells strung in swags along a wall, nail to nail. */
function shellGarland(wall: "left" | "right", at: number, z: number, tiles: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const len = tiles * 24;
      const swag = 30;
      const shells = ["#efc2b0", CREAM, "#e7cfa4", "#c9a0a8"];
      for (let a = 0; a < len; a += swag) {
        const b = Math.min(len, a + swag);
        let prev = wpt(place, a, 0);
        for (let s = a + 1; s <= b; s++) {
          const t = (s - a) / (b - a);
          const q = wpt(place, s, -Math.sin(t * Math.PI) * 6);
          p.line(light.lit("#8a7356", 0.2), prev.x, prev.y, q.x, q.y);
          prev = q;
          if ((s - a) % 5 === 0 && s < b) {
            const k = Math.floor(s / 5) % shells.length;
            p.rect(light.lit(shells[k], 0.4), q.x - 1, q.y + 1, 3, 2);
            p.rect(light.lit(mixHex(shells[k], INK, 0.3), 0.2), q.x, q.y + 2, 1, 1);
          }
        }
        wdot(p, place, a, 1, light.lit(INK, 0), 1, 2);
      }
      // A starfish at one end.
      const st = wpt(place, len - 6, 6);
      const star = light.lit(CORAL, 0.4);
      p.rect(star, st.x - 1, st.y - 3, 3, 7);
      p.rect(star, st.x - 3, st.y - 1, 7, 2);
      p.rect(star, st.x - 3, st.y + 2, 2, 2);
      p.rect(star, st.x + 2, st.y + 2, 2, 2);
    },
  };
}

/** A red and white life ring on a rope. */
function lifeRing(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const c = 8;
      wdisc(p, place, c, c, 9, light.lit(INK, 0));
      wdisc(p, place, c, c, 8, light.lit("#d4583f", 0.4));
      for (const a of [0.4, 2.0, 3.6, 5.2]) wdisc(p, place, c + Math.cos(a) * 6, c + Math.sin(a) * 6, 2.2, light.lit(CREAM, 0.5));
      wdisc(p, place, c, c, 4, light.lit(TURQ, 0.1));
      wdisc(p, place, c, c, 3.2, light.lit(mixHex(DRIFT, INK, 0.12), 0));
      wring(p, place, c, c, 4.2, light.lit(INK, 0));
      wline(p, place, c - 6, 13, c, 20, light.lit("#b48a5e", 0.2));
      wline(p, place, c + 6, 13, c, 20, light.lit("#b48a5e", 0.2));
      wdot(p, place, c, 20, light.lit(INK, 0));
    },
  };
}

/** A top-hinged board shutter propped open over a window. */
function shutter(wall: "left" | "right", at: number, z: number, tiles: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const w = tiles * 24;
      for (let a = 0; a <= w; a++) {
        const top = wpt(place, a, 0);
        const c = a % 7 === 0 ? DRIFT_SEAM : a % 7 < 3 ? TURQ : "#79b0aa";
        p.rect(light.lit(c, 0.3), top.x, top.y - 1, 1, 7);
        p.rect(light.lit(TURQ_SEAM, 0), top.x, top.y + 6, 1, 1);
      }
      for (const a of [4, w - 4]) {
        const s = wpt(place, a, 0);
        p.line(light.lit("#6a5642", 0.1), s.x, s.y + 6, s.x - place.dir * 2, s.y + 14);
      }
    },
  };
}

/** A strip of thatch along the top of each back wall, its fringe ragged. */
function thatch(cols: number, rows: number, wallH: number) {
  return (p: Painter, g: IsoGrid, light: Light) => {
    const base = light.lit(STRAW, 0.35);
    const dark = light.lit(STRAW_D, 0.1);
    const pale = light.lit(STRAW_L, 0.5);
    for (const wall of ["left", "right"] as const) {
      const n = (wall === "right" ? cols : rows) * 24;
      for (let i = -2; i <= n + 2; i++) {
        const t = i / 24;
        const q = wall === "right" ? project(g, t, 0, wallH) : project(g, 0, t, wallH);
        const len = 9 + Math.floor(noise(i, wall === "right" ? 1 : 2, 5) * 5) + (noise(i >> 1, 4, 5) > 0.7 ? 3 : 0);
        const n2 = noise(i, 3, 9);
        p.rect(n2 > 0.72 ? pale : n2 < 0.22 ? dark : base, q.x, q.y - 5, 1, len + 5);
        p.rect(dark, q.x, q.y + len, 1, 1);
      }
      // The binding cord along the bundle.
      for (let i = 0; i <= n; i++) {
        const t = i / 24;
        const q = wall === "right" ? project(g, t, 0, wallH) : project(g, 0, t, wallH);
        p.rect(dark, q.x, q.y + 1, 1, 1);
      }
      const end = wall === "right" ? project(g, cols, 0, wallH) : project(g, 0, rows, wallH);
      p.rect(INK, end.x + (wall === "right" ? 2 : -3), end.y - 5, 1, 18);
    }
    const top = project(g, 0, 0, wallH);
    p.line(INK, top.x, top.y - 6, top.x + cols * 24 + 2, top.y - 6 + cols * 12 + 1);
    p.line(INK, top.x, top.y - 6, top.x - rows * 24 - 2, top.y - 6 + rows * 12 + 1);
  };
}

// The shack from the boardwalk, front on.

/** The shack seen across the boardwalk: thatch, driftwood, the serving hatch propped open, boards against the wall. */
function shackFront(p: Painter, light: Light, box: FrontBox) {
  const lit = (hex: string, f = 0.6, g = 0) => light.lit(hex, f, g);
  const { ground } = box;
  const x0 = box.x + 4;
  const x1 = box.x + box.w - 4;
  const eave = box.y + 22;
  const night = light.night > 0.4;
  // Shadow on the planks under the front.
  p.alpha(0.3, () => p.rect(INK, x0 - 4, ground - 2, x1 - x0 + 10, 4));
  // Driftwood walls, the turquoise band low down.
  p.rect(INK, x0 - 1, eave, x1 - x0 + 2, ground - eave);
  for (let x = x0; x < x1; x++) {
    const b = Math.floor((x - x0) / 7);
    const seam = (x - x0) % 7 === 0;
    const tone = seam ? DRIFT_SEAM : noise(b, 0, 33) > 0.55 ? DRIFT_ALT : DRIFT;
    p.rect(lit(tone), x, eave, 1, ground - 26 - eave);
    p.rect(lit(seam ? TURQ_SEAM : (x - x0) % 7 < 3 ? TURQ : "#79b0aa"), x, ground - 26, 1, 24);
  }
  p.rect(lit("#e2d6bc", 0.7), x0, ground - 27, x1 - x0, 2);
  p.rect(lit(mixHex(TURQ, INK, 0.3), 0.3), x0, ground - 3, x1 - x0, 3);
  // The serving hatch: open with the shack lit inside, or the shutter down.
  const hx = x0 + 10;
  const hw = 74;
  const hy = eave + 26;
  const hh = 30;
  p.rect(INK, hx - 2, hy - 2, hw + 4, hh + 4);
  p.rect(lit("#e6dcc6", 0.6), hx - 1, hy - 1, hw + 2, hh + 2);
  if (box.open) {
    p.rect(night ? "#e9c98c" : lit("#b9a888", 0.3), hx, hy, hw, hh);
    p.rect(night ? "#d9b276" : lit("#a89878", 0.2), hx, hy, hw, 5);
    // A shelf of jars and the festoon inside.
    p.rect(lit("#8a7356", 0.3), hx + 4, hy + 12, hw - 8, 2);
    for (let i = 0; i < 7; i++) {
      const c = ["#c98a4b", "#6f9a5a", CORAL, "#e7b84f", TURQ, "#8e6a9e", "#c98a4b"][i];
      p.rect(INK, hx + 7 + i * 9, hy + 5, 5, 7);
      p.rect(lit(c, 0.4), hx + 8 + i * 9, hy + 6, 3, 6);
    }
    // The shutter propped out over it on two sticks.
    p.poly(lit(TURQ, 0.8), [hx - 4, hy - 4, hx + hw + 4, hy - 4, hx + hw + 8, hy - 12, hx - 8, hy - 12]);
    for (let x = hx - 6; x < hx + hw + 6; x += 6) p.line(lit(TURQ_SEAM, 0.4), x, hy - 11, x + 1, hy - 5);
    p.line(INK, hx - 8, hy - 12, hx + hw + 8, hy - 12);
    p.line(lit("#6a5642", 0.3), hx + 2, hy + 4, hx - 4, hy - 4);
    p.line(lit("#6a5642", 0.3), hx + hw - 2, hy + 4, hx + hw + 4, hy - 4);
  } else {
    for (let y = hy; y < hy + hh; y++) p.rect(lit((y - hy) % 5 === 0 ? TURQ_SEAM : TURQ, 0.6), hx, y, hw, 1);
  }
  // The bamboo ledge, the drink of the day on it.
  p.rect(INK, hx - 4, hy + hh, hw + 8, 5);
  for (let x = hx - 3; x < hx + hw + 4; x++) p.rect(lit((x - hx) % 6 === 0 ? "#9d8347" : "#d8c48e", 0.8), x, hy + hh + 1, 1, 3);
  if (box.display && box.open) displayCup(p, light, box.display, hx + hw - 12, hy + hh + 1);
  // Ice in a tub on the ledge's end: the trouble here.
  p.rect(INK, hx + 4, hy + hh - 6, 14, 7);
  p.rect(lit("#a7b2b3", 0.7), hx + 5, hy + hh - 5, 12, 5);
  for (let i = 0; i < 4; i++) p.rect(lit("#eef6f4", 0.9), hx + 6 + i * 3, hy + hh - 7 + (i % 2), 2, 2);
  // The screen door on the right.
  const dx = hx + hw + 12;
  const dw = 22;
  const dy = eave + 22;
  p.rect(INK, dx - 1, dy - 1, dw + 2, ground - 3 - dy + 1);
  p.rect(lit("#e6dcc6", 0.6), dx, dy, dw, ground - 3 - dy);
  p.rect(box.open && night ? "#d9b276" : lit("#4a5654", 0.2), dx + 3, dy + 3, dw - 6, 22);
  p.rect(box.open && night ? "#d9b276" : lit("#4a5654", 0.2), dx + 3, dy + 29, dw - 6, ground - 3 - dy - 32);
  for (let y = dy + 3; y < ground - 6; y += 2) p.alpha(0.25, () => p.rect(lit("#c9d2cf", 0.5), dx + 3, y, dw - 6, 1));
  p.rect(lit("#d6a367", 0.7), dx + dw - 6, dy + 27, 2, 3);
  const tag = box.open ? "OPEN" : "SHUT";
  p.rect(INK, dx + 2, dy + 8, 18, 8);
  p.rect(box.open ? lit("#7f9a72", 0.6, 0.6) : lit("#c4574a", 0.6), dx + 3, dy + 9, 16, 6);
  word(p, tag, lit(CREAM, 0.6), dx + 4, dy + 10);
  // Two boards leaning by the door.
  for (const [bx, c, s] of [[x1 - 9, CORAL, "#f3d58a"], [x1 - 3, CREAM, TURQ]] as const) {
    for (let r = 0; r < 58; r++) {
      const t = r / 58;
      const half = Math.max(1, Math.round(3.6 * Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2))));
      const cx = bx + Math.round(t * 4);
      p.rect(INK, cx - half - 1, ground - 2 - r, half * 2 + 3, 1);
      p.rect(lit(c, 0.6), cx - half, ground - 2 - r, half * 2 + 1, 1);
      if (t > 0.1 && t < 0.92) p.rect(lit(s, 0.6), cx, ground - 2 - r, 1, 1);
    }
  }
  // The thatch, wider than the walls, its fringe ragged.
  const roofTop = box.y + 4;
  p.poly(INK, [x0 - 14, eave + 4, x0 + 10, roofTop - 1, x1 - 10, roofTop - 1, x1 + 14, eave + 4]);
  p.poly(lit(STRAW, 0.8), [x0 - 12, eave + 3, x0 + 11, roofTop, x1 - 11, roofTop, x1 + 12, eave + 3]);
  for (let x = x0 - 12; x < x1 + 12; x++) {
    const n = noise(x, 3, 9);
    const len = 4 + Math.floor(noise(x, 1, 5) * 5);
    p.rect(lit(n > 0.7 ? STRAW_L : n < 0.25 ? STRAW_D : STRAW, 0.7), x, eave, 1, len + 3);
    p.rect(lit(STRAW_D, 0.3), x, eave + 3 + len, 1, 1);
    if (x % 3 === 0) p.rect(lit(STRAW_D, 0.4), x, roofTop + 2 + (x % 7), 1, eave - roofTop - 4);
  }
  p.rect(lit(STRAW_D, 0.4), x0 - 10, eave - 1, x1 - x0 + 20, 1);
  // The name on a driftwood plank across the thatch.
  const name = box.name.toUpperCase();
  const tw = bigWidth(name);
  const sw = tw + 12;
  const sx = Math.round((x0 + x1 - sw) / 2);
  const sy = roofTop + 3;
  p.rect(INK, sx - 1, sy - 1, sw + 2, 13);
  p.rect(lit(DRIFT, 0.7), sx, sy, sw, 11);
  p.rect(lit("#dacdb5", 0.9), sx, sy, sw, 1);
  bigWord(p, name, lit("#2f4a4c", 0.4), sx + 6, sy + 2);
  // Festoon bulbs along the fringe.
  const on = light.night > 0.15;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = Math.round(x0 - 8 + t * (x1 - x0 + 16));
    const y = eave + 9 + Math.round(Math.sin(t * Math.PI * 4) * 2);
    p.rect(lit("#3a2c2c", 0), x, y - 1, 2, 1);
    if (i % 2 === 0) {
      p.rect(on ? ["#ffe08a", "#ffb38a", "#c9e6a0"][i % 3] : lit("#d9c9a4", 0.4), x, y, 2, 2);
      if (on) p.alpha(0.3 * light.night, () => p.rect("#ffe08a", x - 1, y - 1, 4, 4));
    }
  }
  // A palm beside the shack, a cooler on the boards.
  const px = x1 + 26;
  for (let r = 0; r < 70; r++) {
    const cx = px + Math.round((r / 70) ** 2 * 10);
    p.rect(INK, cx - 2, ground - r, 5, 1);
    p.rect(lit(r % 4 === 0 ? "#6c523e" : "#8a6a4c", 0.6), cx - 1, ground - r, 3, 1);
  }
  const top = { x: px + 10, y: ground - 70 };
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    let lx = top.x;
    let ly = top.y;
    for (let s = 1; s <= 22; s++) {
      const t = s / 22;
      const x = top.x + Math.cos(a) * s * 1.1;
      const y = top.y + Math.sin(a) * s * 0.45 + t * t * 10;
      p.line(lit("#3f6542", 0.2), lx, ly + 1, x, y + 1);
      p.line(lit("#5e8a50", 0.8), lx, ly, x, y);
      lx = x;
      ly = y;
    }
  }
  const cx = x0 - 22;
  p.rect(INK, cx - 1, ground - 15, 18, 14);
  p.rect(lit(CORAL, 0.6), cx, ground - 14, 16, 12);
  p.rect(lit("#e9e1cf", 0.8), cx, ground - 15, 16, 3);
  p.rect(lit("#a8463a", 0.3), cx + 12, ground - 12, 4, 10);
}

/** Rail posts along the deck's near edges, where the frame shows them. */
function railing(cols: number, rows: number): PropSpec[] {
  const out: PropSpec[] = [];
  for (let x = -2; x < cols - 1; x++) out.push(railProp("out:rail-l", x, rows + 2.92, true));
  for (let y = -2; y < rows; y++) out.push(railProp("out:rail-r", cols + 2.1, y, false));
  return out;
}

export function boardwalkVenue(o: VenueOptions): Venue {
  const { cols, rows } = o;
  const share = 0.6;
  const wallH = 80;
  return {
    id: "boardwalk",
    cols,
    rows,
    floor: shackFloor(cols, rows),
    wall: driftwood,
    wainscot: { surface: wainscot, height: 22, rail: "#e2d6bc" },
    cap: STRAW,
    slab: "#8b7259",
    slabHeight: 6,
    wallHeight: wallH,
    windows: [
      { wall: "right", at: 5.2, width: 2.4, sill: 28, top: 58, bars: 2, frame: "#e6dcc6" },
      { wall: "left", at: 2.9, width: 1.9, sill: 28, top: 58, bars: 1, frame: "#e6dcc6" },
    ],
    doors: [],
    lamps: [
      // Festoon bulbs along both walls under the thatch, a woven shade over the middle.
      { kind: "bulbs", x: 0.05, y: rows - 0.3, z: 68, to: [0.05, 0.05, 71], reach: 2.2 },
      { kind: "bulbs", x: 0.05, y: 0.05, z: 71, to: [cols - 0.2, 0.05, 68], reach: 2.2 },
      { kind: "pendant", x: 3.4, y: 2.2, z: 60, color: "#b9925a", reach: 3.4 },
    ],
    wallItems: [
      lifeRing("left", 1.3, 30),
      shellGarland("left", 0.9, 58, 1.9),
      shutter("left", 2.9, 60, 1.9),
      menuBoard("right", 1.3, 28, { w: 40, h: 20, title: "ICED", board: "#2f4a4c", frame: "#b7a585" }),
      shellGarland("right", 1.1, 58, 3.9),
      clock("right", 4.5, 56, o.hour, "#6a5642"),
      shutter("right", 5.2, 60, 2.4),
    ],
    props: [
      boardsProp(share),
      pottedPalmProp(share),
      iceChestProp(share),
      coolerProp(share),
      chairStackProp(rows, share),
      iceTubProp(cols, rows, share),
      ...frontWalls(cols, rows, {
        key: "front:bw",
        height: 14,
        top: "#dccfb4",
        face: TURQ,
        gapsLeft: [5, 6],
        draw(p, g, light, face, box) {
          const f = faceLight(light, 0.6);
          const shade = light.lit(TURQ_SEAM, face === "left" ? f.left * 0.5 : f.right * 0.5);
          for (let s = 0.2; s < 1; s += 0.2) fline(p, g, face, box, s, 1, s, 13, shade);
          fline(p, g, face, box, 0, 4, 1, 4, light.lit("#94bfb7", face === "left" ? f.left : f.right));
        },
      }),
    ],
    counter: { top: "#dcc893", front: "#c4a862", side: "#9d8347", trim: "#b49253", panel: "bamboo", height: 15 },
    outside: {
      ground: beachGround(cols, rows),
      // Snow settles on the sand and the deck, never on the sea.
      noSnow: (x: number, y: number) => x + y < SHORE + 0.6,
      far: farSea,
      view: shackView,
      props: [
        palmProp("out:palm1", -3.6, 3.4, -0.6, 3),
        palmProp("out:palm2", 5.2, -5.0, 0.7, 7),
        palmProp("out:palm3", 3.4, 10.1, 0.4, 11),
        lampPostProp("out:lamp", 9.5, 1.2),
        ...railing(cols, rows),
        umbrellaProp("out:umb1", -4.3, 0.5, CORAL, CREAM, "#e7b84f"),
        umbrellaProp("out:umb2", 1.2, -5.2, TURQ, CREAM, CORAL),
        lifeguardProp("out:guard", 2.4, -7.2),
        deckCoolerProp("out:cooler", 8.6, 3.4),
        signProp("out:sign", 3.7, 7.3),
      ],
    },
    entry: [6.0, rows + 2.6],
    // Up from the deck through the doorway to the serve counter; a long line waits out on the deck.
    queue: [
      [6.5, 2.45],
      [6.4, 3.4],
      [6.3, 4.35],
      [6.0, 5.3],
      [5.8, 6.5],
      [5.6, 7.4],
    ],
    pickup: [5.5, 2.2],
    indoorSun: share,
    backHook: thatch(cols, rows, wallH),
    facade: {
      wall: driftwood,
      trim: "#e6dcc6",
      sign: { board: DRIFT, ink: "#2f4a4c" },
      door: "#e6dcc6",
      paint: shackFront,
      neighbours: "none",
      queueAt: 0.7,
    },
  };
}
