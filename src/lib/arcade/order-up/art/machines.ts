/**
 * Every machine's own model, so no two read alike: its silhouette (a kettle
 * is a kettle, a walk-in is a door), its body colour, and on the boxed ones
 * a maker's plate with a mark no other machine at its counter shares. The
 * tier shows in the metal trim (copper, steel, brass). Models live in a
 * 19 x 17 x 21 cell volume (x -9..9, y -8..8 with +y the near face, z 0..20)
 * and are stacked into sprites by `machineSprite` in sprites.ts.
 */
import { block, cut, ellipse, within } from "../../scenery/stacks/orthographic.ts";
import { mixHex } from "../../core/color.ts";

type Part = (x: number, y: number, z: number) => string;

/** The model's volume and how much its depth is squashed when stacked into a sprite. */
export const MODEL_SIZE = [19, 17, 21] as const;
export const SQUASH = 0.65;
// Squashed, the stack draws only some of the depth's rows; these are the rows it draws, unturned.
const DEPTH = MODEL_SIZE[1];
const DRAWN_ROWS = Math.max(1, Math.round(DEPTH * SQUASH));
const DRAWN = new Set(Array.from({ length: DRAWN_ROWS }, (_, oy) => Math.floor(((oy + 0.5) / DRAWN_ROWS) * DEPTH) - Math.floor(DEPTH / 2)));

/**
 * The parts as one, with each row the stack skips folded onto the drawn row
 * behind it, so a face or a thin board on a skipped row still shows.
 */
function folded(parts: readonly Part[]): Part {
  const at = (x: number, y: number, z: number) => {
    for (let i = parts.length - 1; i >= 0; i--) {
      const c = parts[i](x, y, z);
      if (c) return c;
    }
    return "";
  };
  return (x, y, z) => (DRAWN.has(y) && !DRAWN.has(y + 1) ? at(x, y + 1, z) || at(x, y, z) : at(x, y, z));
}

const INK = "#2f2427";
/** Copper, steel and brass, light then dark, by tier. */
const METAL = [
  ["#c08262", "#8a5238"],
  ["#b7c4bf", "#6e8c87"],
  ["#dcbb67", "#9c7a35"],
] as const;
const SHARED = {
  c: "#f3e6cb",
  w: "#fbf8f1",
  e: INK,
  s: "#8d8f94",
  k: "#cfe3e0",
  d: "#8fb8b4",
  h: "#e0664d",
  r: "#c9462f",
  y: "#dba84d",
  v: "#7d9270",
  u: "#6a8fb0",
  p: "#d98f9f",
  t: "#8a5a3c",
};

/** An upright cylinder (an ellipse in plan), with its own roof, near, side and back colours. */
function cyl(x: number, y: number, z: number, rx: number, ry: number, h: number, roof: string, front: string, side = front, back = side): Part {
  return cut(
    (a, b) => (ellipse(a - x, b - y, rx + 0.4, ry + 0.4) ? roof : ""),
    (a, b) => (Math.abs(a + y) <= ry && within(b, z, z + h - 1) ? side : ""),
    (a, b) => (Math.abs(a + x) <= rx && within(b, z, z + h - 1) ? front : ""),
    (a, b) => (Math.abs(a - x) <= rx && within(b, z, z + h - 1) ? back : ""),
  );
}

/** A flat panel painted on the near face at `y`. */
const panel =
  (x0: number, x1: number, z0: number, z1: number, y: number, color: string): Part =>
  (x, yy, z) =>
    yy === y && x >= x0 && x <= x1 && z >= z0 && z <= z1 ? color : "";

/** A mark drawn from rows (top row first) on the near face at `y`, its bottom-left cell at (x0, z0). */
function mark(rows: readonly string[], x0: number, z0: number, y: number, color: string): Part {
  const cells = new Set<string>();
  rows.forEach((row, j) => [...row].forEach((ch, i) => ch === "#" && cells.add(x0 + i + ":" + (z0 + rows.length - 1 - j))));
  return (x, yy, z) => (yy === y && cells.has(x + ":" + z) ? color : "");
}

/** A disc standing upright in the x-z plane at `y` (a blade, a fan, a dial). */
const disc =
  (cx: number, cz: number, r: number, y0: number, y1: number, color: string, hub = ""): Part =>
  (x, y, z) => {
    if (y < y0 || y > y1) return "";
    const d = Math.hypot(x - cx, z - cz);
    return d <= 0.9 && hub ? hub : d <= r ? color : "";
  };

/** A bar along x at height z between x0 and x1 (a rail, a rope sagging by `sag`). */
const rail =
  (x0: number, x1: number, y: number, z: number, color: string, sag = 0): Part =>
  (x, yy, zz) => {
    if (yy !== y || x < x0 || x > x1) return "";
    const t = (x - x0) / Math.max(1, x1 - x0);
    return zz === Math.round(z - sag * Math.sin(t * Math.PI)) ? color : "";
  };

/** The makers' marks: each machine at a counter gets a different one. */
const MARKS: readonly (readonly string[])[] = [
  [".#.", "###", ".#."],
  [".#.", "#.#", ".#."],
  ["###", "#.#", "###"],
  ["#.#", ".#.", "#.#"],
  ["#..", "##.", "###"],
  ["###", ".#.", ".#."],
  ["..#", "#.#", ".#."],
  [".#.", "###", "###"],
  ["#.#", "...", "#.#"],
  ["##.", "#..", "#.."],
  ["###", "...", "###"],
  [".#.", ".#.", "###"],
  ["#..", "#..", "###"],
  ["#.#", "#.#", ".#."],
  [".##", "##.", ".#."],
  ["###", "#..", "###"],
  ["#.#", "###", "#.#"],
  [".#.", "##.", "###"],
  ["##.", "...", ".##"],
  ["#.#", "#.#", "###"],
];

interface Design {
  /** Body colour and its accent; the logo plate's mark colour. */
  body: string;
  accent: string;
  logo: string;
  /** Where the maker's plate goes: [centre x, near-face y, bottom z], or null for none. */
  plate: readonly [number, number, number] | null;
  parts: Part[];
}

/** Each machine's model. Its parts may use a (body), b (body shade), g (accent), m/n (tier metal) and the shared colours. */
const DESIGNS: Record<string, () => Design> = {
  // --- Brew ---
  "auto-tea": () => ({
    body: "#7d5c50", accent: "#c9462f", logo: "c", plate: [0, 2, 8],
    parts: [block(0, 1, 0, 6, 5, 1, ["n", "n"]), block(0, -1, 1, 5, 3, 13, ["g", "a", "b"]), block(0, 3, 5, 1, 1, 2, ["e", "e"]), block(0, 3, 1, 3, 2, 1, ["s", "s"]), cyl(0, 3, 2, 1, 1, 3, "t", "w")],
  }),
  "auto-milk": () => ({
    body: "#e9dcc4", accent: "#6a8fb0", logo: "u", plate: [0, 2, 6],
    parts: [block(0, 1, 0, 6, 5, 1, ["n", "n"]), block(0, -1, 1, 5, 3, 10, ["a", "a", "b"]), cyl(0, -1, 11, 3, 2, 4, "w", "g"), block(0, 3, 5, 1, 1, 1, ["e", "e"]), block(0, 3, 1, 3, 2, 1, ["s", "s"]), cyl(0, 3, 2, 1, 1, 2, "w", "w")],
  }),
  "tea-carafe": () => ({
    body: "#8a5a3c", accent: "#cfe3e0", logo: "e", plate: null,
    parts: [block(0, 0, 0, 5, 4, 2, ["m", "n"]), cyl(0, 0, 2, 3, 3, 8, "a", "k", "d"), panel(-2, 2, 3, 6, 3, "a"), cyl(0, 0, 10, 2, 2, 2, "m", "m", "n"), block(4, 0, 4, 1, 0, 6, ["e", "e"])],
  }),
  "stovetop-kettle": () => ({
    body: "#c9462f", accent: "#e0664d", logo: "c", plate: null,
    parts: [block(0, 0, 0, 5, 5, 2, ["e", "s"]), block(0, 0, 2, 4, 4, 0, ["h", "h"]), cyl(0, 0, 3, 4, 4, 6, "a", "a", "b"), cyl(0, 0, 9, 2, 2, 1, "m", "m"), block(0, 0, 10, 0, 0, 1, ["e", "e"]), block(5, 0, 6, 1, 1, 1, ["a", "b"]), block(7, 0, 7, 0, 0, 1, ["a", "b"]), block(0, 0, 11, 3, 0, 1, ["e", "e"])],
  }),
  "preset-kettle": () => ({
    body: "#f3e6cb", accent: "#6a8fb0", logo: "u", plate: null,
    parts: [cyl(0, 0, 0, 4, 4, 1, "e", "e"), block(0, 0, 1, 3, 3, 10, ["g", "a", "b"]), panel(-1, 1, 3, 8, 3, "k"), block(0, 4, 0, 1, 0, 0, ["h", "h"]), block(-4, 0, 3, 1, 1, 7, ["e", "e"]), block(4, 0, 9, 1, 1, 1, ["a", "b"])],
  }),
  "triple-urn": () => ({
    body: "#a9bab4", accent: "#9c7a35", logo: "e", plate: null,
    parts: [block(0, 0, 0, 8, 3, 1, ["n", "n"]), cyl(-5, 0, 1, 2, 2, 11, "m", "a", "b"), cyl(0, 0, 1, 2, 2, 13, "m", "a", "b"), cyl(5, 0, 1, 2, 2, 11, "m", "a", "b"), block(-5, 3, 3, 0, 1, 1, ["e", "e"]), block(0, 3, 3, 0, 1, 1, ["e", "e"]), block(5, 3, 3, 0, 1, 1, ["e", "e"])],
  }),
  "cold-brew-tower": () => ({
    body: "#8a5a3c", accent: "#cfe3e0", logo: "e", plate: null,
    parts: [block(0, 0, 0, 5, 3, 1, ["b", "b"]), block(-4, 0, 1, 0, 0, 17, ["a", "a"]), block(4, 0, 1, 0, 0, 17, ["a", "a"]), block(0, 0, 18, 5, 1, 0, ["a", "a"]), cyl(0, 0, 14, 3, 2, 3, "d", "k"), block(0, 0, 8, 0, 0, 5, ["k", "d"]), cyl(0, 0, 1, 3, 2, 5, "t", "k", "d")],
  }),
  "water-filter": () => ({
    body: "#6a8fb0", accent: "#fbf8f1", logo: "w", plate: [0, 3, 6],
    parts: [cyl(0, 0, 0, 3, 3, 14, "s", "a", "b"), cyl(0, 0, 14, 2, 2, 1, "m", "m"), block(5, 0, 11, 2, 0, 0, ["s", "s"]), block(7, 0, 3, 0, 0, 8, ["s", "s"]), block(0, 4, 10, 0, 0, 0, ["g", "g"])],
  }),
  "matcha-stand": () => ({
    body: "#8a5a3c", accent: "#7d9270", logo: "c", plate: null,
    parts: [block(0, 0, 0, 6, 4, 2, ["a", "b"]), cyl(-3, 0, 2, 2, 2, 2, "g", "w"), cyl(3, 0, 2, 1, 1, 4, "y", "y"), block(3, 0, 6, 0, 0, 3, ["t", "t"]), block(0, 3, 2, 1, 0, 0, ["g", "g"])],
  }),
  "steam-wand": () => ({
    body: "#2f2427", accent: "#c08262", logo: "y", plate: [-1, 2, 6],
    parts: [block(0, -1, 0, 5, 3, 11, ["m", "a", "b"]), block(4, 3, 3, 0, 0, 6, ["m", "m"]), block(3, 3, 9, 1, 0, 0, ["m", "m"]), cyl(4, 4, 0, 1, 1, 3, "m", "m", "n")],
  }),
  // --- Prep ---
  "pearl-cooker": () => ({
    body: "#7d5c50", accent: "#2f2427", logo: "c", plate: null,
    parts: [block(0, 0, 0, 5, 5, 3, ["e", "s"]), cyl(0, 0, 3, 5, 4, 6, "g", "m", "n"), block(-6, 0, 7, 0, 0, 1, ["e", "e"]), block(6, 0, 7, 0, 0, 1, ["e", "e"])],
  }),
  "auto-cooker": () => ({
    body: "#c9462f", accent: "#8d8f94", logo: "w", plate: [0, 4, 3],
    parts: [cyl(0, 0, 0, 4, 4, 9, "g", "a", "b"), cyl(0, 0, 9, 3, 3, 2, "s", "s"), block(0, 0, 11, 0, 0, 2, ["h", "h"]), block(-5, 0, 6, 0, 0, 1, ["e", "e"])],
  }),
  "bun-oven": () => ({
    body: "#b07a52", accent: "#e0664d", logo: "c", plate: [4, 5, 7],
    parts: [block(0, 0, 0, 6, 5, 10, ["b", "a", "b"]), panel(-5, 2, 2, 7, 5, "e"), panel(-4, 1, 3, 6, 5, "h"), block(-2, 5, 4, 1, 0, 0, ["y", "y"]), block(0, 0, 10, 4, 3, 1, ["s", "s"])],
  }),
  "waffle-iron": () => ({
    body: "#8d8f94", accent: "#dba84d", logo: "e", plate: null,
    parts: [block(0, 0, 0, 5, 4, 3, ["e", "a", "b"]), block(0, 1, 3, 4, 2, 0, ["g", "g"]), block(0, -3, 3, 4, 1, 7, ["a", "b"]), block(0, -4, 10, 2, 0, 1, ["e", "e"]), mark(["#.#.#", ".#.#.", "#.#.#"], -2, 3, -2, "y")],
  }),
  "fruit-fridge": () => ({
    body: "#fbf8f1", accent: "#7d9270", logo: "v", plate: null,
    parts: [block(0, 0, 0, 5, 4, 16, ["a", "a", "s"]), panel(-4, 3, 2, 14, 4, "k"), mark(["r.y.", ".v.p", "y.r.", ".p.v"].map((r) => r.replace(/[a-z]/g, "#")), -3, 4, 4, "r"), mark(["..#.", "#...", "....", "#.#."], -3, 9, 4, "y"), block(4, 4, 7, 0, 0, 4, ["s", "s"])],
  }),
  slicer: () => ({
    body: "#b7c4bf", accent: "#c9462f", logo: "r", plate: null,
    parts: [block(0, 0, 0, 6, 4, 2, ["a", "b"]), disc(0, 7, 5, 0, 0, "m", "e"), block(0, 1, 2, 5, 0, 1, ["s", "s"]), block(-5, 0, 2, 0, 0, 5, ["a", "b"]), block(6, 0, 3, 0, 1, 1, ["g", "g"])],
  }),
  "citrus-press": () => ({
    body: "#dba84d", accent: "#e0664d", logo: "e", plate: null,
    parts: [block(0, 0, 0, 4, 4, 2, ["a", "b"]), block(-3, 0, 2, 1, 1, 11, ["s", "s"]), block(0, 0, 13, 4, 1, 1, ["s", "s"]), block(4, 0, 9, 0, 0, 4, ["e", "e"]), cyl(1, 0, 2, 2, 2, 3, "g", "a")],
  }),
  "foam-whipper": () => ({
    body: "#fbf8f1", accent: "#8d8f94", logo: "u", plate: [0, 3, 4],
    parts: [cyl(0, 0, 0, 3, 3, 11, "m", "a", "s"), cyl(0, 0, 11, 2, 2, 2, "e", "e"), block(0, 0, 13, 0, 0, 2, ["s", "s"]), block(3, 0, 12, 1, 0, 0, ["e", "e"])],
  }),
  "jelly-chiller": () => ({
    body: "#6a8fb0", accent: "#cfe3e0", logo: "w", plate: [0, 4, 1],
    parts: [block(0, 0, 0, 6, 4, 5, ["g", "a", "b"]), block(-3, 0, 5, 2, 2, 1, ["v", "v"]), block(3, 0, 5, 2, 2, 1, ["p", "p"]), block(0, -3, 5, 6, 0, 1, ["k", "k"])],
  }),
  "taro-roller": () => ({
    body: "#9d7bb0", accent: "#8d8f94", logo: "c", plate: [0, 4, 1],
    parts: [block(0, 0, 0, 6, 4, 4, ["a", "a", "b"]), (x, y, z) => (Math.abs(x) <= 5 && (Math.hypot(y + 1, z - 6) <= 1.6 || Math.hypot(y - 2, z - 6) <= 1.6) ? "g" : ""), block(0, 0, 9, 5, 0, 0, ["p", "p"])],
  }),
  // --- Build ---
  "auto-toppings": () => ({
    body: "#7d5c50", accent: "#cfe3e0", logo: "c", plate: [0, 4, 2],
    parts: [block(0, 0, 0, 7, 4, 7, ["b", "a", "b"]), cyl(-5, 0, 7, 2, 2, 6, "e", "k", "d"), cyl(0, 0, 7, 2, 2, 7, "r", "k", "d"), cyl(5, 0, 7, 2, 2, 6, "v", "k", "d")],
  }),
  "auto-extras": () => ({
    body: "#e9dcc4", accent: "#d98f9f", logo: "r", plate: [-3, 4, 2],
    parts: [block(0, 0, 0, 6, 4, 6, ["a", "a", "b"]), cyl(-3, 0, 6, 2, 2, 8, "w", "k", "d"), cyl(3, 0, 6, 2, 2, 5, "g", "k", "d"), block(3, 4, 4, 1, 0, 0, ["e", "e"])],
  }),
  "fructose-pump": () => ({
    body: "#dba84d", accent: "#fbf8f1", logo: "e", plate: [0, 3, 4],
    parts: [block(0, 0, 0, 4, 3, 1, ["s", "s"]), cyl(0, 0, 1, 3, 3, 9, "a", "a", "b"), block(0, 0, 10, 1, 1, 3, ["g", "g"]), block(2, 0, 13, 2, 0, 0, ["g", "g"])],
  }),
  "ice-machine": () => ({
    body: "#fbf8f1", accent: "#6a8fb0", logo: "u", plate: [3, 5, 9],
    parts: [block(0, 0, 0, 6, 5, 12, ["s", "a", "s"]), panel(-5, 1, 1, 7, 5, "k"), panel(-4, 0, 2, 6, 5, "d"), mark(["#.#.#", "....."], -3, 13, 0, "g")],
  }),
  "ice-crusher": () => ({
    body: "#8d8f94", accent: "#cfe3e0", logo: "e", plate: [0, 4, 2],
    parts: [block(0, 0, 0, 4, 4, 8, ["s", "a", "b"]), cyl(0, 0, 8, 4, 4, 4, "g", "k", "d"), block(5, 0, 9, 1, 0, 0, ["e", "e"]), block(6, 0, 9, 0, 0, 3, ["e", "e"])],
  }),
  blender: () => ({
    body: "#2f2427", accent: "#d98f9f", logo: "w", plate: [0, 3, 0],
    parts: [block(0, 0, 0, 4, 3, 4, ["e", "a", "b"]), cyl(0, 0, 4, 3, 3, 10, "g", "k", "d"), cyl(0, 0, 14, 3, 3, 1, "e", "e")],
  }),
  "syrup-rail": () => ({
    body: "#9c7a35", accent: "#c9462f", logo: "c", plate: null,
    parts: [block(0, 0, 0, 7, 2, 2, ["m", "n"]), cyl(-5, 0, 2, 1, 1, 7, "e", "r"), cyl(-2, 0, 2, 1, 1, 8, "e", "y"), cyl(2, 0, 2, 1, 1, 7, "e", "p"), cyl(5, 0, 2, 1, 1, 8, "e", "v")],
  }),
  // --- Serve ---
  "auto-sealer": () => ({
    body: "#c9462f", accent: "#8d8f94", logo: "w", plate: [0, -1, 6],
    parts: [block(0, 0, 0, 5, 4, 3, ["g", "a", "b"]), block(0, -3, 3, 4, 1, 10, ["a", "a", "b"]), block(0, 0, 11, 3, 3, 2, ["g", "g"]), cyl(0, 1, 3, 2, 2, 4, "w", "w")],
  }),
  "shaking-machine": () => ({
    body: "#6a8fb0", accent: "#b7c4bf", logo: "w", plate: [0, 4, 1],
    parts: [block(0, 0, 0, 5, 4, 3, ["e", "a", "b"]), block(0, 0, 9, 4, 1, 1, ["m", "n"]), cyl(-3, 0, 3, 1, 1, 7, "m", "g"), cyl(3, 0, 3, 1, 1, 7, "m", "g")],
  }),
  "straw-dispenser": () => ({
    body: "#cfe3e0", accent: "#c9462f", logo: "e", plate: null,
    parts: [block(0, 0, 0, 3, 3, 2, ["s", "s"]), cyl(0, 0, 2, 3, 3, 11, "a", "k", "d"), mark(["#.#.#", "#.#.#", "#.#.#", "#.#.#", "#.#.#"], -2, 5, 3, "r"), block(0, 4, 3, 1, 0, 0, ["e", "e"])],
  }),
  "sleeve-printer": () => ({
    body: "#8d8f94", accent: "#dba84d", logo: "e", plate: [4, 4, 2],
    parts: [block(0, 0, 0, 6, 4, 6, ["s", "a", "b"]), block(0, -2, 6, 4, 0, 0, ["e", "e"]), block(0, 5, 4, 3, 1, 0, ["w", "w"]), mark(["###"], -1, 4, 6, "g")],
  }),
  "pickup-lockers": () => ({
    body: "#7d9270", accent: "#dba84d", logo: "c", plate: null,
    parts: [block(0, 0, 0, 7, 3, 14, ["b", "a", "b"]), mark(["##.##.##", "##.##.##", "........", "##.##.##", "##.##.##", "........", "##.##.##", "##.##.##"].map((r) => r), -5, 2, 3, "c"), mark(["#..#..#.", "........", "........", "#..#..#.", "........", "........", "#..#..#."], -5, 3, 3, "g")],
  }),
  conveyor: () => ({
    body: "#2f2427", accent: "#8d8f94", logo: "c", plate: null,
    parts: [block(0, 0, 0, 8, 3, 3, ["e", "s", "s"]), mark(["#.#.#.#.#.#.#.#.#"], -8, 2, 3, "g"), cyl(-4, 0, 3, 1, 1, 3, "t", "w"), cyl(2, 0, 3, 1, 1, 3, "t", "w")],
  }),
  // --- Front ---
  "order-kiosk": () => ({
    body: "#c9462f", accent: "#6a8fb0", logo: "w", plate: [0, 2, 3],
    parts: [block(0, 0, 0, 3, 3, 1, ["e", "e"]), block(0, 0, 1, 2, 2, 10, ["a", "a", "b"]), block(0, 1, 11, 5, 1, 6, ["e", "e", "e"]), panel(-4, 4, 12, 16, 2, "g"), panel(-3, 0, 14, 15, 2, "k")],
  }),
  "mobile-printer": () => ({
    body: "#6a8fb0", accent: "#fbf8f1", logo: "w", plate: [0, 3, 1],
    parts: [block(0, 0, 0, 4, 3, 5, ["a", "a", "b"]), block(0, 0, 5, 2, 0, 5, ["g", "g"]), mark(["###", "...", "###"], -1, 7, 1, "s")],
  }),
  jukebox: () => ({
    body: "#d98f9f", accent: "#dba84d", logo: "c", plate: null,
    parts: [block(0, 0, 0, 5, 3, 11, ["a", "a", "b"]), cyl(0, 0, 11, 5, 3, 3, "g", "g"), panel(-4, 4, 2, 4, 3, "e"), mark(["#####"], -2, 8, 3, "r"), mark(["#####"], -2, 6, 3, "y"), mark(["#####"], -2, 10, 3, "u")],
  }),
  "heaters-fans": () => ({
    body: "#8d8f94", accent: "#cfe3e0", logo: "e", plate: null,
    parts: [cyl(0, 0, 0, 3, 3, 1, "s", "s"), block(0, 0, 1, 0, 0, 9, ["s", "s"]), disc(0, 14, 5, 0, 1, "g", "e"), (x, y, z) => (y === 2 && Math.abs(Math.hypot(x, z - 14) - 5) < 0.6 ? "a" : "")],
  }),
  "umbrella-stand": () => ({
    body: "#c9462f", accent: "#fbf8f1", logo: "c", plate: null,
    parts: [cyl(0, 0, 0, 2, 2, 1, "s", "s"), block(0, 0, 1, 0, 0, 13, ["e", "e"]), (x, y, z) => (z === 14 && ellipse(x, y, 7.4, 6.4) ? ((Math.floor(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 2 ? "a" : "g") : z === 15 && ellipse(x, y, 4.4, 3.4) ? "a" : "")],
  }),
  "queue-rope": () => ({
    body: "#9c7a35", accent: "#c9462f", logo: "c", plate: null,
    parts: [cyl(-6, 0, 0, 2, 2, 1, "n", "n"), cyl(6, 0, 0, 2, 2, 1, "n", "n"), cyl(-6, 0, 1, 0, 0, 9, "m", "m"), cyl(6, 0, 1, 0, 0, 9, "m", "m"), rail(-5, 5, 0, 8, "g", 3)],
  }),
  // --- Back of house ---
  "cozy-seats": () => ({
    body: "#b07a52", accent: "#7d9270", logo: "c", plate: null,
    parts: [block(0, 0, 0, 5, 4, 4, ["g", "a", "b"]), block(0, -4, 4, 5, 1, 7, ["a", "a", "b"]), block(-5, 0, 4, 1, 4, 3, ["a", "b"]), block(5, 0, 4, 1, 4, 3, ["a", "b"])],
  }),
  "better-recipe": () => ({
    body: "#8a5a3c", accent: "#c9462f", logo: "c", plate: null,
    parts: [block(0, 0, 0, 4, 3, 3, ["a", "b"]), block(0, 0, 3, 5, 3, 1, ["w", "w"]), block(0, 0, 4, 0, 3, 0, ["e", "e"]), mark(["##.##"], -2, 4, 3, "g")],
  }),
  "street-sign": () => ({
    body: "#2f2427", accent: "#fbf8f1", logo: "c", plate: null,
    parts: [block(-4, 0, 0, 0, 1, 3, ["t", "t"]), block(4, 0, 0, 0, 1, 3, ["t", "t"]), block(0, 0, 3, 5, 1, 12, ["t", "a", "t"]), mark([".###.", ".....", "####.", ".....", ".###."], -2, 7, 1, "g")],
  }),
  "batch-timers": () => ({
    body: "#8d8f94", accent: "#e0664d", logo: "e", plate: null,
    parts: [block(0, 0, 0, 6, 3, 3, ["a", "b"]), cyl(-4, 0, 3, 1, 1, 3, "w", "h"), cyl(0, 0, 3, 1, 1, 3, "w", "y"), cyl(4, 0, 3, 1, 1, 3, "w", "v")],
  }),
  "warm-shelf": () => ({
    body: "#8a5a3c", accent: "#e0664d", logo: "c", plate: null,
    parts: [block(-6, 0, 0, 0, 3, 15, ["a", "b"]), block(6, 0, 0, 0, 3, 15, ["a", "b"]), block(0, 0, 3, 6, 3, 0, ["a", "b"]), block(0, 0, 9, 6, 3, 0, ["a", "b"]), block(0, 0, 15, 6, 3, 1, ["g", "h"]), block(-2, 0, 4, 1, 1, 1, ["y", "y"]), block(2, 0, 10, 1, 1, 1, ["y", "y"])],
  }),
  "supplier-ledger": () => ({
    body: "#7d9270", accent: "#fbf8f1", logo: "e", plate: [0, 4, 0],
    parts: [block(0, 0, 0, 5, 4, 3, ["a", "a", "g"]), block(0, 0, 3, 5, 4, 0, ["b", "b"])],
  }),
  "menu-easel": () => ({
    body: "#8a5a3c", accent: "#2f2427", logo: "w", plate: null,
    parts: [block(-4, 0, 0, 0, 0, 14, ["a", "a"]), block(4, 0, 0, 0, 0, 14, ["a", "a"]), block(0, -3, 0, 0, 0, 12, ["b", "b"]), block(0, 1, 4, 5, 0, 10, ["g", "g"]), mark(["####.", ".....", "###..", ".....", "#####", ".....", "##..."], -3, 6, 1, "w")],
  }),
  "wall-calendar": () => ({
    body: "#fbf8f1", accent: "#c9462f", logo: "e", plate: null,
    parts: [block(0, 0, 0, 5, 0, 14, ["a", "a"]), block(0, 0, 12, 5, 0, 2, ["g", "g"]), mark(["#.#.#.#", ".......", "#.#.#.#", ".......", "#.#.#.#"], -3, 3, 0, "e")],
  }),
  "takeout-rack": () => ({
    body: "#8d8f94", accent: "#c8a26a", logo: "e", plate: null,
    parts: [block(-6, 0, 0, 0, 3, 14, ["a", "b"]), block(6, 0, 0, 0, 3, 14, ["a", "b"]), block(0, 0, 1, 6, 3, 0, ["a", "b"]), block(0, 0, 8, 6, 3, 0, ["a", "b"]), block(-3, 0, 2, 2, 2, 4, ["g", "g", "t"]), block(3, 0, 9, 2, 2, 4, ["g", "g", "t"]), block(3, 0, 2, 2, 2, 3, ["g", "g", "t"])],
  }),
  "opening-key": () => ({
    body: "#8a5a3c", accent: "#dba84d", logo: "e", plate: null,
    parts: [block(0, -2, 0, 4, 1, 13, ["a", "a", "b"]), (x, y, z) => (y === 0 && Math.abs(Math.hypot(x, z - 10) - 2) < 0.7 ? "g" : y === 0 && x === 0 && z >= 3 && z <= 8 ? "g" : y === 0 && z <= 4 && z >= 3 && x === 1 ? "g" : "")],
  }),
  "tip-jar": () => ({
    body: "#cfe3e0", accent: "#dba84d", logo: "e", plate: null,
    parts: [cyl(0, 0, 0, 3, 3, 8, "g", "a", "d"), mark(["#.#", ".#.", "#.#", ".##"], -1, 1, 3, "y"), cyl(0, 0, 8, 2, 2, 1, "s", "s")],
  }),
  "cold-storage": () => ({
    body: "#fbf8f1", accent: "#6a8fb0", logo: "u", plate: [-3, 4, 12],
    parts: [block(0, 0, 0, 6, 4, 16, ["s", "a", "s"]), panel(0, 0, 1, 15, 4, "s"), block(-1, 4, 6, 0, 0, 4, ["g", "g"]), block(1, 4, 6, 0, 0, 4, ["g", "g"])],
  }),
  "cold-tray": () => ({
    body: "#6a8fb0", accent: "#cfe3e0", logo: "w", plate: null,
    parts: [block(0, 0, 0, 7, 4, 3, ["g", "a", "b"]), cyl(-3, 0, 3, 1, 1, 3, "w", "w"), cyl(0, 0, 3, 1, 1, 3, "p", "w"), cyl(3, 0, 3, 1, 1, 3, "t", "w")],
  }),
  "pickup-counter": () => ({
    body: "#8a5a3c", accent: "#dba84d", logo: "c", plate: [-3, 3, 3],
    parts: [block(0, 0, 0, 7, 3, 8, ["c", "a", "b"]), cyl(4, 0, 8, 1, 1, 2, "g", "g"), block(4, 0, 10, 0, 0, 0, ["e", "e"])],
  }),
  "ticket-rack": () => ({
    body: "#9c7a35", accent: "#fbf8f1", logo: "e", plate: null,
    parts: [block(-7, 0, 0, 0, 0, 15, ["a", "b"]), block(7, 0, 0, 0, 0, 15, ["a", "b"]), block(0, 0, 14, 7, 0, 1, ["m", "n"]), block(-4, 0, 8, 1, 0, 5, ["g", "g"]), block(0, 0, 9, 1, 0, 4, ["g", "g"]), block(4, 0, 7, 1, 0, 6, ["g", "g"]), mark(["#", ".", "#"], -4, 10, 0, "r")],
  }),
  "pantry-shelves": () => ({
    body: "#8a5a3c", accent: "#dba84d", logo: "c", plate: null,
    parts: [block(-6, 0, 0, 0, 3, 18, ["a", "b"]), block(6, 0, 0, 0, 3, 18, ["a", "b"]), block(0, 0, 0, 6, 3, 0, ["a", "b"]), block(0, 0, 6, 6, 3, 0, ["a", "b"]), block(0, 0, 12, 6, 3, 0, ["a", "b"]), block(0, 0, 18, 6, 3, 0, ["a", "b"]), cyl(-3, 0, 1, 1, 1, 4, "w", "g"), cyl(1, 0, 1, 1, 1, 3, "w", "r"), cyl(-1, 0, 7, 1, 1, 4, "w", "v"), cyl(3, 0, 7, 1, 1, 4, "w", "p"), cyl(0, 0, 13, 1, 1, 4, "w", "u")],
  }),
  "walk-in": () => ({
    body: "#b7c4bf", accent: "#6a8fb0", logo: "u", plate: [4, 2, 14],
    parts: [block(0, 0, 0, 7, 2, 18, ["s", "a", "s"]), (x, y, z) => (y === 2 && Math.hypot(x + 1, z - 13) <= 2.2 ? "g" : ""), block(4, 2, 7, 0, 0, 4, ["e", "e"]), panel(-7, 7, 0, 0, 2, "s")],
  }),
  dishwasher: () => ({
    body: "#e9dcc4", accent: "#8d8f94", logo: "e", plate: [4, 4, 7],
    parts: [block(0, 0, 0, 6, 4, 10, ["g", "a", "s"]), block(0, 4, 8, 4, 0, 0, ["e", "e"]), panel(-5, 5, 1, 6, 4, "s"), disc(-4, 8, 1, 4, 4, "h", "e")],
  }),
  compost: () => ({
    body: "#7d9270", accent: "#55311f", logo: "c", plate: [0, 4, 3],
    parts: [block(0, 0, 0, 4, 4, 10, ["b", "a", "b"]), block(0, 0, 10, 5, 5, 1, ["g", "g"]), block(0, -1, 11, 1, 1, 0, ["g", "g"])],
  }),
};

/** A plain cabinet for any machine without its own model. */
const FALLBACK = (): Design => ({
  body: "#aa7d68", accent: "#be755e", logo: "c", plate: [0, 4, 3],
  parts: [block(0, 0, 0, 6, 4, 9, ["b", "a", "b"])],
});

/** The machine's parts and palette at `tier`, with its maker's plate. `index` picks its mark among its counter's machines. */
/**
 * A brew kit's rig, stood beside any brew machine so it reads on all of them:
 * the parallel manifold's brass header on two posts behind, the precision
 * head's gauge on a post in front, the gravity feed's glass bottle raised
 * behind on the left.
 */
const KITS: Record<string, () => Part[]> = {
  "brew-manifold": () => [
    block(-8, -6, 0, 0, 0, 17, ["m", "n"]),
    block(8, -6, 0, 0, 0, 17, ["m", "n"]),
    block(0, -6, 15, 8, 1, 2, ["y", "y", "t"]),
    ...[-5, 0, 5].flatMap((x) => [block(x, -6, 12, 0, 0, 3, ["y", "t"]), block(x, -6, 11, 0, 0, 1, ["u", "u"])]),
  ],
  "brew-precision": () => [block(7, 4, 0, 0, 0, 7, ["s", "s"]), disc(7, 9, 2.4, 4, 5, "w", "e"), block(8, 5, 9, 0, 0, 1, ["r", "r"])],
  "brew-gravity": () => [
    block(-7, -5, 0, 0, 0, 11, ["s", "s"]),
    cyl(-7, -5, 11, 2, 2, 6, "k", "k", "d"),
    cyl(-7, -5, 11, 2, 2, 3, "u", "u", "u"),
    block(-7, -5, 17, 0, 0, 1, ["e", "e"]),
  ],
};

export function machineDesign(id: string, tier: number, index: number, kit = "") {
  const d = (DESIGNS[id] ?? FALLBACK)();
  const [m, n] = METAL[Math.max(0, Math.min(2, tier - 1))];
  const palette: Record<string, string> = {
    ...SHARED,
    a: d.body,
    b: mixHex(d.body, INK, 0.3),
    g: d.accent,
    m,
    n,
  };
  const parts = [...d.parts];
  if (d.plate) {
    const [x, y, z] = d.plate;
    // A cream plate on the near face, the maker's mark on it in the machine's logo colour.
    parts.push(panel(x - 2, x + 2, z, z + 4, y, "c"), mark(MARKS[index % MARKS.length], x - 1, z + 1, y, d.logo));
  }
  if (KITS[kit]) parts.push(...KITS[kit]());
  return { parts: [folded(parts)], palette };
}

export const MACHINE_IDS_WITH_MODELS = Object.keys(DESIGNS);
