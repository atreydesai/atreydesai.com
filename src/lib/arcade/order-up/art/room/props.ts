/**
 * Things that stand in a room, each drawn at its footprint's back corner
 * (0, 0) on a local grid so it can be baked into the atlas and set down
 * anywhere. Counters carry their tools at fixed spots on their tops, at a
 * size a person could pick up, sorted back to front, so nothing piles up.
 */
import type { Painter, Palette } from "../../../core/painter.ts";
import { isoBox, faceLight, project, type IsoGrid } from "../../../core/iso.ts";
import { mixHex } from "../../../core/color.ts";
import type { Light } from "../../../core/light.ts";
import type { CounterStyle, PropSpec } from "./types.ts";
import { word, wordWidth } from "./font.ts";

export const INK = "#2b2126";
const CREAM = "#fff1dd";

/** A palette lit for an object's top-lit side (sprites carry their own shading). */
export function litPalette(palette: Palette, light: Light, share = 1): Palette {
  const face = faceLight(light, share).top * 0.7;
  const out: Palette = {};
  for (const [k, v] of Object.entries(palette)) out[k] = k === "O" ? v : light.lit(v, face);
  return out;
}

/** A small sprite stood with its bottom-centre on a ground point (u, v tiles) lifted z. */
export function standSprite(p: Painter, g: IsoGrid, light: Light, grid: readonly string[], palette: Palette, u: number, v: number, z: number, share = 1, flip = false) {
  const at = project(g, u, v, z);
  const w = grid[0].length;
  // A soft contact shadow.
  p.alpha(0.28, () => p.rect(INK, at.x - Math.floor(w / 2) + 1, at.y - 1, w - 2, 2));
  p.sprite(grid, litPalette(palette, light, share), at.x - Math.floor(w / 2), at.y - grid.length + 1, flip);
}

/** Points on a box's left (facing +y) or right (facing +x) face: s along it 0..1, t up it 0..1. */
function facePoint(g: IsoGrid, face: "left" | "right", x0: number, y0: number, w: number, d: number, h: number, s: number, t: number) {
  if (face === "left") return project(g, x0 + w * s, y0 + d, h * t);
  return project(g, x0 + w, y0 + d * (1 - s), h * t);
}

function facePanel(p: Painter, g: IsoGrid, face: "left" | "right", box: [number, number, number, number, number], s0: number, s1: number, t0: number, t1: number, color: string) {
  const [x0, y0, w, d, h] = box;
  const a = facePoint(g, face, x0, y0, w, d, h, s0, t0);
  const b = facePoint(g, face, x0, y0, w, d, h, s1, t0);
  const c = facePoint(g, face, x0, y0, w, d, h, s1, t1);
  const e = facePoint(g, face, x0, y0, w, d, h, s0, t1);
  p.line(color, a.x, a.y, b.x, b.y);
  p.line(color, b.x, b.y, c.x, c.y);
  p.line(color, c.x, c.y, e.x, e.y);
  p.line(color, e.x, e.y, a.x, a.y);
}

function faceLine(p: Painter, g: IsoGrid, face: "left" | "right", box: [number, number, number, number, number], s0: number, t0: number, s1: number, t1: number, color: string) {
  const [x0, y0, w, d, h] = box;
  const a = facePoint(g, face, x0, y0, w, d, h, s0, t0);
  const b = facePoint(g, face, x0, y0, w, d, h, s1, t1);
  p.line(color, a.x, a.y, b.x, b.y);
}

/** A counter's body: a box with its front panels detailed. Returns its height. */
export function counterBody(p: Painter, g: IsoGrid, light: Light, style: CounterStyle, share: number, w = 1, d = 1) {
  const h = style.height ?? 15;
  const x0 = 0.06,
    y0 = 0.06;
  const W = w - 0.12,
    D = d - 0.12;
  const f = faceLight(light, share);
  const box: [number, number, number, number, number] = [x0, y0, W, D, h - 3];
  // A plinth tucked in a little, then the body, then the worktop with an overhang.
  isoBox(p, g, light, x0 + 0.04, y0 + 0.04, W - 0.08, D - 0.08, 2, { top: mixHex(style.front, INK, 0.5), ink: "", lip: false }, 0, share);
  isoBox(p, g, light, x0, y0, W, D, h - 3, { top: style.front, left: style.front, right: style.side ?? mixHex(style.front, INK, 0.18), lip: false }, 0, share);
  const line = light.lit(mixHex(style.front, INK, 0.35), f.left * 0.5);
  const lineR = light.lit(mixHex(style.side ?? style.front, INK, 0.4), f.right * 0.5);
  const hi = light.lit(mixHex(style.front, CREAM, 0.25), f.left);
  switch (style.panel ?? "drawers") {
    case "drawers":
      facePanel(p, g, "left", box, 0.1, 0.48, 0.25, 0.8, line);
      facePanel(p, g, "left", box, 0.52, 0.9, 0.25, 0.8, line);
      faceLine(p, g, "left", box, 0.25, 0.62, 0.32, 0.62, hi);
      faceLine(p, g, "left", box, 0.67, 0.62, 0.74, 0.62, hi);
      facePanel(p, g, "right", box, 0.15, 0.85, 0.25, 0.8, lineR);
      break;
    case "slats":
      for (let s = 0.12; s < 0.95; s += 0.14) faceLine(p, g, "left", box, s, 0.12, s, 0.9, line);
      for (let s = 0.12; s < 0.95; s += 0.14) faceLine(p, g, "right", box, s, 0.12, s, 0.9, lineR);
      break;
    case "tile":
      for (let t = 0.3; t < 0.95; t += 0.3) faceLine(p, g, "left", box, 0, t, 1, t, line);
      for (let s = 0.17; s < 1; s += 0.17) faceLine(p, g, "left", box, s, 0, s, 0.92, line);
      for (let t = 0.3; t < 0.95; t += 0.3) faceLine(p, g, "right", box, 0, t, 1, t, lineR);
      break;
    case "steel":
      facePanel(p, g, "left", box, 0.08, 0.92, 0.15, 0.85, line);
      faceLine(p, g, "left", box, 0.3, 0.72, 0.7, 0.72, hi);
      facePanel(p, g, "right", box, 0.08, 0.92, 0.15, 0.85, lineR);
      break;
    case "bamboo":
      for (let s = 0.08; s < 0.98; s += 0.1) faceLine(p, g, "left", box, s, 0.05, s, 0.95, line);
      for (let s = 0.08; s < 0.98; s += 0.1) faceLine(p, g, "right", box, s, 0.05, s, 0.95, lineR);
      faceLine(p, g, "left", box, 0, 0.5, 1, 0.5, hi);
      break;
    case "log":
      for (let t = 0.2; t < 0.95; t += 0.25) {
        faceLine(p, g, "left", box, 0, t, 1, t, line);
        faceLine(p, g, "right", box, 0, t, 1, t, lineR);
      }
      break;
    case "crate":
      facePanel(p, g, "left", box, 0.05, 0.95, 0.08, 0.92, line);
      faceLine(p, g, "left", box, 0.05, 0.08, 0.95, 0.92, line);
      facePanel(p, g, "right", box, 0.05, 0.95, 0.08, 0.92, lineR);
      faceLine(p, g, "right", box, 0.05, 0.92, 0.95, 0.08, lineR);
      break;
    case "console":
      facePanel(p, g, "left", box, 0.1, 0.9, 0.3, 0.75, line);
      for (let s = 0.2; s < 0.85; s += 0.2) faceLine(p, g, "left", box, s, 0.5, s + 0.04, 0.5, ["#8fd0a8", "#e8c27a", "#d98a7a", "#8fb8d8"][Math.round(s * 5) % 4]);
      facePanel(p, g, "right", box, 0.1, 0.9, 0.3, 0.75, lineR);
      break;
  }
  isoBox(p, g, light, x0 - 0.03, y0 - 0.03, W + 0.06, D + 0.06, 3, { top: style.top, left: style.trim, right: mixHex(style.trim, INK, 0.2) }, h - 3, share);
  return h;
}

// Small tools, drawn as sprites with their own light and shade.
export const SPRITES: Record<string, { grid: string[]; palette: Palette }> = {
  kettle: {
    grid: ["...OOO...", "..O...O..", "..OOOOO..", ".OLLBBDO.", "OSLBBBBDO", ".OLBBBBDO", ".OBBBBDDO", "..OOOOOO."],
    palette: { O: INK, L: "#e9e1d0", B: "#b9b2a4", D: "#7f786f", S: "#9a9389" },
  },
  teapot: {
    grid: ["...OO....", "..OLBO...", ".OLBBBO.O", "OOLBBBDOO", "OOBBBBDO.", ".OBBBDDO.", "..OOOOO.."],
    palette: { O: INK, L: "#e48a6a", B: "#b8573f", D: "#7d3a31" },
  },
  burner: {
    grid: [".OOOOOOO.", "OCCCCCCCO", "OCRRRRRCO", ".OOOOOOO."],
    palette: { O: INK, C: "#3b3436", R: "#5d4a46" },
  },
  jar: {
    grid: [".OOO.", "OCCCO", ".OLO.", "OLBDO", "OBBDO", "OBBDO", ".OOO."],
    palette: { O: INK, C: "#d8b98a", L: "#e9d6b4", B: "#6b4a3b", D: "#4a3430" },
  },
  cups: {
    grid: ["OOOOO", "OLLWO", "OLWWO", "OOOOO", "OLLWO", "OLWWO", "OOOOO", "OLLWO", ".OOO."],
    palette: { O: INK, L: "#fdf6ea", W: "#e2d6c3" },
  },
  pot: {
    grid: ["OOOOOOOOO", "OMMMMMMMO", "OLBBBBBDO", "OLBBBBBDO", ".OBBBBDO.", ".OOOOOOO."],
    palette: { O: INK, M: "#3c2b2a", L: "#9aa0a3", B: "#6f7478", D: "#4b5054" },
  },
  board: {
    grid: [".OOOOOOO", "OWWWWWWO", "OWWWWWWO", "OOOOOOO."],
    palette: { O: INK, W: "#c99a66" },
  },
  shaker: {
    grid: [".OO.", "OLLO", "OLDO", "OLDO", "OLDO", ".OO."],
    palette: { O: INK, L: "#d9dcdc", D: "#9aa0a0" },
  },
  register: {
    grid: [".OOOOOOO.", ".OGGGGGO.", ".OGLLLGO.", "OOOOOOOOO", "OBBBBBBBO", "OBKBKBKDO", "OBBBBBBDO", "OOOOOOOOO"],
    palette: { O: INK, G: "#3f5a4e", L: "#a8d9b0", B: "#c9b48e", K: "#7a6650", D: "#8e7b5d" },
  },
  sealer: {
    grid: ["..OOOO..", ".OLLBDO.", ".OLBBDO.", ".OOOOOO.", "OOMMMMOO", "OLBBBBDO", "OBBBBBDO", "OOOOOOOO"],
    palette: { O: INK, L: "#e6e2da", B: "#bdb6aa", D: "#8b857a", M: "#3a3337" },
  },
  bottle: {
    grid: [".O.", ".O.", "OLO", "OBO", "OBO", "OOO"],
    palette: { O: INK, L: "#f3d7a8", B: "#c98a4b" },
  },
  tin: {
    grid: ["OOOO", "OLBO", "OLBO", "OOOO"],
    palette: { O: INK, L: "#d8a05c", B: "#a36a3a" },
  },
  plant: {
    grid: ["....OO....", "...OLGO.O.", ".O.OGGOOGO", "OGOOGGOGGO", "OGGOGOGGO.", ".OGGOGGO..", "..OOGGOO..", "...OPPO...", "...OPPO...", "..OPPPPO..", "..OOOOOO.."],
    palette: { O: INK, L: "#9cc08a", G: "#5f8a56", P: "#b86a4e" },
  },
  monstera: {
    grid: [
      ".....OOO.......",
      "...OOLGGO..OO..",
      "..OLGGOGGOOLGO.",
      ".OGGOGGGOOGGGGO",
      "OGGGOOGGOGGOGGO",
      "OGOGGOGOGGGOOO.",
      ".OOGGGOGGGGO...",
      "...OOGGOGOO....",
      ".....OOGO......",
      "......OGO......",
      ".....OPPPO.....",
      "....OPLPPPO....",
      "....OPPPPDO....",
      ".....OOOOO.....",
    ],
    palette: { O: INK, L: "#a9c995", G: "#5e8a55", P: "#c47c5b", D: "#8d5442" },
  },
  cactus: {
    grid: ["..OO..", ".OLGO.", "OOLGOO", "OGLGGO", ".OLGO.", ".OLGO.", "OPPPPO", "OPPPPO", ".OOOO."],
    palette: { O: INK, L: "#a6c48c", G: "#6c8f5a", P: "#d9a17a" },
  },
  sack: {
    grid: ["..OOO..", ".OLLBO.", "OLLBBBO", "OLBBBDO", "OBBBBDO", ".OOOOO."],
    palette: { O: INK, L: "#e8d7b3", B: "#cdb88f", D: "#a48f6a" },
  },
  extinguisher: {
    grid: [".OO.", "OOOO", "ORRO", "OLRO", "ORRO", "ORRO", "OOOO"],
    palette: { O: INK, R: "#c2493c", L: "#e98a72" },
  },
};

/** Draws a sprite on a counter top at (u, v) in the footprint's tiles. */
function onTop(p: Painter, g: IsoGrid, light: Light, name: string, u: number, v: number, z: number, share: number, recolor?: Palette) {
  const s = SPRITES[name];
  standSprite(p, g, light, s.grid, recolor ? { ...s.palette, ...recolor } : s.palette, u, v, z, share);
}

export const TEA_COLORS: Record<string, Palette> = {
  black: { L: "#e48a6a", B: "#b8573f", D: "#7d3a31" },
  jasmine: { L: "#a9c98c", B: "#6f9a5a", D: "#4c6b40" },
  taro: { L: "#c3a0cf", B: "#8e6a9e", D: "#5e4370" },
};

export type StationId = "brew" | "prep" | "build" | "serve" | "stock";

/**
 * A station's counter with its tools set on its top, back to front. `w`, `d`
 * give a two-tile run where the layout leaves room.
 */
export function stationProp(
  station: StationId,
  x: number,
  y: number,
  style: CounterStyle,
  share: number,
  extras: { sign?: boolean; kit?: string } = {},
): PropSpec {
  if (station === "stock") return shelfProp("station:stock", x, y, style, share);
  const h = style.height ?? 15;
  return {
    key: "station:" + station + (station === "brew" && extras.kit ? ":" + extras.kit : ""),
    x,
    y,
    height: h + 18,
    draw(p, g, light) {
      counterBody(p, g, light, style, share);
      const z = h;
      if (station === "brew") {
        onTop(p, g, light, "burner", 0.32, 0.3, z, share);
        onTop(p, g, light, "kettle", 0.32, 0.3, z + 1, share);
        onTop(p, g, light, "teapot", 0.72, 0.36, z, share, TEA_COLORS.jasmine);
        onTop(p, g, light, "teapot", 0.5, 0.72, z, share, TEA_COLORS.black);
        if (extras.kit) brewKit(p, g, light, extras.kit, z, share);
      } else if (station === "prep") {
        onTop(p, g, light, "pot", 0.32, 0.36, z, share);
        onTop(p, g, light, "board", 0.66, 0.62, z, share);
        onTop(p, g, light, "jar", 0.8, 0.26, z, share);
      } else if (station === "build") {
        onTop(p, g, light, "cups", 0.26, 0.3, z, share);
        onTop(p, g, light, "jar", 0.55, 0.22, z, share);
        onTop(p, g, light, "jar", 0.75, 0.32, z, share, { B: "#c98a4b", D: "#8a5a32", C: "#e2c89a" });
        onTop(p, g, light, "jar", 0.82, 0.55, z, share, { B: "#9e3f4a", D: "#6a2a33", C: "#e2c89a" });
        onTop(p, g, light, "shaker", 0.45, 0.68, z, share);
      } else if (station === "serve") {
        onTop(p, g, light, "register", 0.3, 0.32, z, share);
        onTop(p, g, light, "sealer", 0.74, 0.4, z, share);
        // A pickup tray at the front edge.
        const a = project(g, 0.35, 0.86, z);
        p.rect(light.lit("#3d3135", 0.2), a.x - 5, a.y - 1, 11, 2);
        p.rect(light.lit("#a5654f", faceLight(light, share).top), a.x - 4, a.y - 2, 9, 1);
        void extras;
      }
    },
  };
}

/**
 * The brew kit fitted at the shop, on the brew counter as in the Workshop:
 * the manifold's brass header on two posts along the back with three drops,
 * the precision head's gauge on a post at the front corner, the gravity
 * feed's glass bottle raised on a post at the back.
 */
function brewKit(p: Painter, g: IsoGrid, light: Light, kit: string, z: number, share: number) {
  const f = faceLight(light, share);
  const brass = light.lit("#dba84d", f.top),
    brassDark = light.lit("#9c7a35", f.right),
    steel = light.lit("#8d8f94", f.left),
    ink = light.lit("#2f2427", 0.2);
  const post = (u: number, v: number, h: number, color: string) => {
    const a = project(g, u, v, z),
      b = project(g, u, v, z + h);
    p.rect(ink, a.x - 1, b.y - 1, 3, a.y - b.y + 2);
    p.rect(color, a.x, b.y, 1, a.y - b.y);
  };
  if (kit === "brew-manifold") {
    post(0.08, 0.12, 16, steel);
    post(0.92, 0.12, 16, steel);
    const a = project(g, 0.08, 0.12, z + 15),
      b = project(g, 0.92, 0.12, z + 15);
    const steps = Math.max(1, Math.abs(b.x - a.x));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        x = Math.round(a.x + (b.x - a.x) * t),
        y = Math.round(a.y + (b.y - a.y) * t);
      p.rect(ink, x, y - 2, 1, 4);
      p.rect(brass, x, y - 1, 1, 1);
      p.rect(brassDark, x, y, 1, 1);
    }
    for (const t of [0.25, 0.5, 0.75]) {
      const d = project(g, 0.08 + 0.84 * t, 0.12, z + 14);
      p.rect(brassDark, d.x, d.y, 1, 3);
      p.rect(light.lit("#6a8fb0", 0.6), d.x, d.y + 3, 1, 1);
    }
  } else if (kit === "brew-precision") {
    post(0.88, 0.88, 7, steel);
    const c = project(g, 0.88, 0.88, z + 9);
    p.rect(ink, c.x - 3, c.y - 3, 7, 7);
    p.rect(light.lit("#fbf8f1", f.top), c.x - 2, c.y - 2, 5, 5);
    p.rect(light.lit("#c9462f", 0.8), c.x, c.y - 2, 1, 2);
    p.rect(ink, c.x, c.y, 1, 1);
  } else if (kit === "brew-gravity") {
    post(0.15, 0.15, 11, steel);
    const c = project(g, 0.15, 0.15, z + 11);
    p.rect(ink, c.x - 3, c.y - 8, 7, 9);
    p.rect(light.lit("#cfe3e0", f.top), c.x - 2, c.y - 7, 5, 7);
    p.rect(light.lit("#6a8fb0", f.left), c.x - 2, c.y - 3, 5, 3);
    p.rect(ink, c.x - 1, c.y - 9, 3, 1);
  }
}

/** Tall shelving, stocked with tins, jars and sacks. */
export function shelfProp(key: string, x: number, y: number, style: CounterStyle, share: number, seed = 0): PropSpec {
  const h = 42;
  return {
    key,
    x,
    y,
    height: h + 6,
    draw(p, g, light) {
      const frame = mixHex(style.trim, INK, 0.2);
      // Two uprights and four boards, open at the front.
      isoBox(p, g, light, 0.1, 0.12, 0.8, 0.06, h, { top: frame, ink: INK }, 0, share);
      for (let i = 0; i < 4; i++) {
        const z = 3 + i * 12;
        isoBox(p, g, light, 0.1, 0.18, 0.8, 0.58, 2, { top: style.top, left: frame, ink: INK }, z, share);
        const items = ["jar", "tin", "sack", "jar", "bottle", "tin"];
        for (let k = 0; k < 3; k++) {
          const name = items[(i * 3 + k + seed) % items.length];
          if (i === 0 && name !== "sack") continue;
          const tint: Palette = ([{}, { B: "#5f7a5a", D: "#425640", L: "#9fbf8a" }, { B: "#8e6a9e", D: "#5e4370", L: "#c3a0cf" }] as Palette[])[(i + k + seed) % 3];
          onTop(p, g, light, name, 0.24 + k * 0.26, 0.42, z + 2, share, tint);
        }
      }
      isoBox(p, g, light, 0.1, 0.76, 0.06, 0.06, h, { top: frame, ink: INK }, 0, share);
      isoBox(p, g, light, 0.84, 0.76, 0.06, 0.06, h, { top: frame, ink: INK }, 0, share);
    },
  };
}

/** A sprite stood on the floor as a prop. */
export function spriteProp(key: string, name: string, x: number, y: number, height: number, recolor?: Palette, share = 0.4): PropSpec {
  return {
    key,
    x,
    y,
    height,
    draw(p, g, light) {
      onTop(p, g, light, name, 0.5, 0.5, 0, share, recolor);
    },
  };
}

/** A round café table with two chairs. */
export function tableProp(key: string, x: number, y: number, wood: string, share = 0.4): PropSpec {
  return {
    key,
    x,
    y,
    height: 22,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const chair = (u: number, v: number) => {
        isoBox(p, g, light, u - 0.12, v - 0.12, 0.24, 0.24, 9, { top: wood }, 0, share);
        isoBox(p, g, light, u - 0.12, v - 0.14, 0.24, 0.04, 16, { top: mixHex(wood, INK, 0.15) }, 0, share);
      };
      chair(0.5, 0.2);
      const c = project(g, 0.5, 0.5, 0);
      p.rect(light.lit(mixHex(wood, INK, 0.4), 0), c.x - 1, c.y - 12, 3, 12);
      p.alpha(0.3, () => p.oval(INK, c.x, c.y, 6, 2));
      p.oval(light.lit(mixHex(wood, INK, 0.3), f.left), c.x, c.y - 12, 10, 5);
      p.oval(light.lit(wood, f.top), c.x, c.y - 13, 10, 5);
      p.rect(light.lit(mixHex(wood, CREAM, 0.3), f.top), c.x - 6, c.y - 16, 5, 1);
      chair(0.8, 0.5);
    },
  };
}

/** A tree outside: trunk, a crown of dithered clumps. */
export function treeProp(key: string, x: number, y: number, crown: string, seed: number, height = 62, kind: "round" | "pine" | "palm" | "bare" = "round"): PropSpec {
  const summer = crown;
  return {
    key,
    x,
    y,
    height,
    pad: 14,
    shadow: "round",
    draw(p, g, light) {
      crown = summer;
      const base = project(g, 0.5, 0.5, 0);
      const f = faceLight(light, 1);
      p.alpha(0.3, () => p.oval(INK, base.x, base.y, 4, 1.5));
      const trunk = light.lit("#6a4c3c", f.left);
      if (kind === "pine") {
        p.rect(trunk, base.x - 1, base.y - 10, 3, 10);
        for (let i = 0; i < 4; i++) {
          const y = base.y - 10 - i * 11;
          const w = 13 - i * 3;
          p.poly(light.lit(mixHex(crown, INK, 0.25), f.left * 0.5), [base.x, y - 14, base.x + w, y, base.x - w, y]);
          p.poly(light.lit(crown, f.top), [base.x, y - 14, base.x - w, y, base.x - 2, y - 2]);
          p.line(light.lit(mixHex(crown, CREAM, 0.25), f.top), base.x - 1, y - 13, base.x - w + 2, y - 1);
          if (light.season === "winter") p.line(light.lit("#eef1f0", 0.7), base.x - 1, y - 12, base.x - w + 3, y - 2);
        }
        return;
      }
      if (kind === "palm") {
        for (let i = 0; i < 30; i++) p.rect(trunk, base.x + Math.round(Math.sin(i / 10) * 3), base.y - i, 3, 1);
        const top = { x: base.x + Math.round(Math.sin(3) * 3), y: base.y - 30 };
        for (const [dx, dy] of [[-14, 4], [14, 5], [-9, -6], [10, -6], [0, -8]]) {
          p.line(light.lit(crown, f.top), top.x, top.y, top.x + dx, top.y + dy);
          p.line(light.lit(mixHex(crown, INK, 0.2), 0), top.x, top.y + 1, top.x + dx, top.y + dy + 1);
        }
        return;
      }
      p.rect(trunk, base.x - 1, base.y - 22, 3, 22);
      p.rect(light.lit("#4a3530", 0), base.x + 1, base.y - 22, 1, 22);
      // In winter a broadleaf tree stands bare, snow along its branches.
      if (kind === "bare" || light.season === "winter") {
        const branches: [number, number, number, number][] = [[0, -18, -9, -31], [1, -20, 9, -34], [0, -26, -4, -42], [1, -24, 5, -40], [-5, -26, -12, -33], [6, -29, 12, -38]];
        for (const [x0, y0, x1, y1] of branches) p.line(trunk, base.x + x0, base.y + y0, base.x + x1, base.y + y1);
        if (light.season === "winter") for (const [, , x1, y1] of branches) p.rect(light.lit("#eef1f0", 0.6), base.x + x1 - 1, base.y + y1 - 1, 3, 1);
        return;
      }
      if (light.season === "autumn") crown = ["#b8763e", "#c9924a", "#9c5e3a"][seed % 3];
      const dark = light.lit(mixHex(crown, INK, 0.3), f.right * 0.4);
      const mid = light.lit(crown, f.top * 0.8);
      const lit = light.lit(mixHex(crown, "#fff3c8", 0.25), Math.min(1, f.top + 0.2));
      const blobs: [number, number, number][] = [[0, -36, 13], [-9, -30, 9], [9, -29, 10], [-4, -44, 9], [6, -42, 8]];
      for (const [dx, dy, r] of blobs) p.oval(dark, base.x + dx, base.y + dy + 2, r, r * 0.85);
      for (const [dx, dy, r] of blobs) p.oval(mid, base.x + dx - 1, base.y + dy, r - 2, (r - 2) * 0.85);
      const side = light.azimuth > 0 ? 1 : -1;
      for (const [dx, dy, r] of blobs) p.dither(lit, base.x + dx - r * 0.6 + side * 2, base.y + dy - r * 0.6, r, r * 0.6, 0.5, seed);
    },
  };
}

/** A street lamp post. */
export function lampPostProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 58,
    shadow: "none",
    draw(p, g, light) {
      const b = project(g, 0.5, 0.5, 0);
      const post = light.lit("#3e3a3f", 0);
      p.rect(post, b.x - 1, b.y - 52, 2, 52);
      p.rect(post, b.x - 2, b.y - 3, 4, 3);
      p.rect(post, b.x - 4, b.y - 54, 8, 2);
      const on = light.night > 0.2;
      p.rect(on ? "#ffe2a0" : light.lit("#d6d2c4", 0.4), b.x - 3, b.y - 52, 6, 2);
      if (on) p.alpha(0.18 * light.night, () => p.oval("#ffd890", b.x, b.y - 44, 10, 9));
    },
  };
}

/** A bench (park or platform). */
export function benchProp(key: string, x: number, y: number, wood: string, alongX = true): PropSpec {
  return {
    key,
    x,
    y,
    w: alongX ? 2 : 1,
    d: alongX ? 1 : 2,
    height: 18,
    draw(p, g, light) {
      const w = alongX ? 1.6 : 0.3;
      const d = alongX ? 0.3 : 1.6;
      isoBox(p, g, light, 0.2, 0.35, 0.08, 0.08, 8, { top: "#3e3a3f", ink: "" }, 0);
      isoBox(p, g, light, 0.2 + (alongX ? 1.5 : 0), 0.35 + (alongX ? 0 : 1.5), 0.08, 0.08, 8, { top: "#3e3a3f", ink: "" }, 0);
      isoBox(p, g, light, 0.2, 0.3, w, d, 2, { top: wood }, 7);
      isoBox(p, g, light, 0.2, 0.25, alongX ? w : 0.06, alongX ? 0.06 : d, 9, { top: mixHex(wood, INK, 0.15) }, 8);
    },
  };
}

/** A picnic table with its benches. */
export function picnicProp(key: string, x: number, y: number, wood: string): PropSpec {
  return {
    key,
    x,
    y,
    w: 2,
    d: 1,
    height: 18,
    draw(p, g, light) {
      isoBox(p, g, light, 0.15, 0.05, 1.7, 0.18, 6, { top: wood }, 0);
      isoBox(p, g, light, 0.15, 0.77, 1.7, 0.18, 6, { top: wood }, 0);
      for (const u of [0.3, 1.6]) isoBox(p, g, light, u, 0.3, 0.1, 0.4, 11, { top: mixHex(wood, INK, 0.3), ink: "" }, 0);
      isoBox(p, g, light, 0.1, 0.25, 1.8, 0.5, 2, { top: wood }, 11);
      const c = project(g, 1.2, 0.5, 13);
      p.alpha(0.9, () => p.rect(light.lit("#c9573f", 0.5), c.x - 3, c.y - 6, 5, 6));
    },
  };
}

/** An A-frame chalkboard on the pavement. */
export function aFrameProp(key: string, x: number, y: number, text: string): PropSpec {
  return {
    key,
    x,
    y,
    height: 26,
    draw(p, g, light) {
      const b = project(g, 0.5, 0.5, 0);
      const f = faceLight(light, 1);
      p.alpha(0.25, () => p.rect(INK, b.x - 8, b.y - 1, 16, 2));
      p.poly(light.lit("#7a5a45", f.left), [b.x - 9, b.y, b.x - 6, b.y - 22, b.x + 6, b.y - 22, b.x + 9, b.y]);
      p.poly(light.lit("#2f3a36", 0.1), [b.x - 7, b.y - 3, b.x - 5, b.y - 20, b.x + 5, b.y - 20, b.x + 7, b.y - 3]);
      word(p, text.slice(0, 3), light.lit("#f1e6cf", 0.3), b.x - 5, b.y - 17);
      p.rect(light.lit("#e8b48a", 0.3), b.x - 4, b.y - 10, 7, 1);
      p.rect(light.lit("#a9c98c", 0.3), b.x - 4, b.y - 7, 5, 1);
    },
  };
}

/** A fridge or chiller with a glass door. */
export function fridgeProp(key: string, x: number, y: number, body: string, share: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 44,
    draw(p, g, light) {
      const box = isoBox(p, g, light, 0.1, 0.12, 0.8, 0.72, 40, { top: body, left: body }, 0, share);
      // The glass door on the left face, bottles inside.
      const a = project(g, 0.18, 0.84, 6);
      const b = project(g, 0.82, 0.84, 6);
      for (let row = 0; row < 28; row++) {
        const t = row / 28;
        p.line(light.lit(row % 9 === 0 ? "#9fb7b6" : "#3d4a4c", 0.1), a.x, a.y - row, b.x, b.y - row);
        void t;
      }
      for (let k = 0; k < 3; k++)
        for (let i = 0; i < 5; i++) {
          const u = 0.24 + i * 0.12;
          const q = project(g, u, 0.84, 9 + k * 9);
          p.rect(light.lit(["#e8b46a", "#c9e0a8", "#e8a0a8"][(i + k) % 3], 0.3), q.x, q.y - 5, 2, 5);
        }
      p.line(light.lit("#d8dcd8", 0.4), a.x, a.y - 28, b.x, b.y - 28);
      void box;
    },
  };
}
