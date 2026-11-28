/**
 * Sprite stacks for the shop's painted scenes, cut slice by slice from their
 * shapes (see `scenery/stacks/orthographic.ts` for the same idea from four
 * views). Each is a model: slices ground first and a palette. Turned,
 * squashed and leaned through `stackGrid`, outlined once, and cached.
 */
import { stackGrid, quantizeTurn } from "../../core/sprite-stack.ts";
import { noise } from "./paint.ts";

type Part = (x: number, y: number, z: number) => string;
export interface Model {
  slices: string[][];
  palette: Record<string, string>;
}

const INK = "#2f2427";

function build(width: number, depth: number, height: number, palette: Record<string, string>, parts: Part[]): Model {
  const slices = Array.from({ length: height }, (_, z) =>
    Array.from({ length: depth }, (_, row) =>
      Array.from({ length: width }, (_, column) => {
        const x = column - Math.floor(width / 2);
        const y = row - Math.floor(depth / 2);
        for (let i = parts.length - 1; i >= 0; i--) {
          const color = parts[i](x, y, z);
          if (color) return color;
        }
        return ".";
      }).join(""),
    ),
  );
  return { slices, palette: { O: INK, ...palette } };
}

const box =
  (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: Part | string): Part =>
  (x, y, z) =>
    x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1 ? (typeof color === "string" ? color : color(x, y, z)) : "";

/** A tube in the bike's own plane (x = 0) from (y0, z0) to (y1, z1). */
function tube(y0: number, z0: number, y1: number, z1: number, color: string, x0 = 0, x1 = 0): Part {
  return (x, y, z) => {
    if (x < x0 || x > x1) return "";
    const dy = y1 - y0;
    const dz = z1 - z0;
    const length = dy * dy + dz * dz;
    const t = Math.max(0, Math.min(1, ((y - y0) * dy + (z - z0) * dz) / length));
    return Math.hypot(y - (y0 + t * dy), z - (z0 + t * dz)) <= 0.62 ? color : "";
  };
}

function wheel(y0: number, r: number): Part {
  return (x, y, z) => {
    if (x !== 0) return "";
    const d = Math.hypot(y - y0, z - r);
    if (d > r + 0.45) return "";
    if (d >= r - 0.85) return "w";
    if (d <= 0.9) return "m";
    return Math.abs(y - y0) < 0.5 || Math.abs(z - r) < 0.5 ? "m" : "";
  };
}

/**
 * The courier's cargo bike, front wheel up the screen: a kraft box of four
 * sealed cups in front of the handlebar, the rider in the shop's apron.
 * `cups` are the four tea colours.
 */
export function cargoBike(cups: readonly string[]): Model {
  const cupAt = [
    [-2, -19],
    [2, -19],
    [-2, -15],
    [2, -15],
  ];
  const parts: Part[] = [
    wheel(12, 4.4),
    wheel(-24, 3.6),
    tube(12, 4.4, 4, 4, "r"),
    tube(4, 4, 6, 11, "r"),
    tube(6, 11, -4, 12, "r"),
    tube(4, 4, -4, 11, "r"),
    tube(-4, 11, -7, 5, "r"),
    tube(-7, 5, -24, 3.6, "r"),
    // The cargo box: kraft walls, a lighter rim, a dark floor.
    box(-5, 5, -22, -12, 4, 9, (x, y, z) => {
      const wall = Math.abs(x) === 5 || y === -22 || y === -12;
      if (!wall) return z === 4 ? "d" : "";
      return z === 9 ? "B" : (x + y + z) % 5 === 0 ? "d" : "b";
    }),
    // The cup carrier inside, each cup sealed with a red straw.
    (x, y, z) => {
      for (const [i, [cx, cy]] of cupAt.entries()) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > 1.6) continue;
        if (z >= 5 && z <= 10) return z === 10 ? "c" : String(i + 1);
        if (z >= 11 && z <= 12 && x === cx && y === cy) return "s";
      }
      return "";
    },
    // The rider: legs to the pedals, apron, arms to the bar, a cap.
    box(-1, 1, 6, 9, 11, 11, "k"),
    tube(7, 10, 3, 4, "p", -2, -2),
    tube(7, 10, 5, 4, "p", 2, 2),
    box(-3, 3, 5, 8, 12, 18, (x, y, z) => (z <= 13 ? "p" : Math.abs(x) <= 1 && y === 5 && z <= 17 ? "A" : "a")),
    box(-4, 4, 6, 7, 17, 18, "a"),
    tube(6, 17, -4, 13, "a", -3, -3),
    tube(6, 17, -4, 13, "a", 3, 3),
    box(-4, 4, -5, -5, 13, 13, "m"),
    box(-5, -4, -5, -5, 13, 13, "f"),
    box(4, 5, -5, -5, 13, 13, "f"),
    tube(-5, 9, -5, 13, "m"),
    (x, y, z) => {
      const d = Math.hypot(x, y - 6, z - 20.5);
      if (d > 2.4) return "";
      if (z >= 21) return y < 5 ? "H" : "h";
      return "f";
    },
    box(-2, 2, 2, 3, 21, 21, "H"),
  ];
  return build(17, 51, 24, {
    w: "#2b2526",
    m: "#9aa29b",
    r: "#b65a4f",
    b: "#c79a68",
    B: "#e5c08a",
    d: "#8f6a4c",
    c: "#f6e5c4",
    s: "#d9534f",
    k: "#3a3133",
    p: "#4f5966",
    a: "#7f9a72",
    A: "#a8bd95",
    f: "#d9a17a",
    h: "#c4574a",
    H: "#e07a63",
    1: cups[0] ?? "#c79562",
    2: cups[1] ?? "#a7b46f",
    3: cups[2] ?? "#b38db3",
    4: cups[3] ?? "#c79562",
  }, parts);
}

/** A small car parked along the curb, nose up the screen. */
export function car(body: string, trim: string): Model {
  const parts: Part[] = [
    // Wheels under the corners.
    (x, y, z) => (Math.abs(x) === 7 && Math.abs(Math.abs(y) - 8) <= 2 && z <= 2 ? "w" : ""),
    // The body, its corners cut.
    (x, y, z) => {
      if (z < 1 || z > 4 || Math.abs(x) > 7 || Math.abs(y) > 13 || Math.abs(x) + Math.abs(y) > 18) return "";
      if (y === -13 && z === 3 && Math.abs(x) >= 4 && Math.abs(x) <= 5) return "y";
      if (y === 13 && z === 3 && Math.abs(x) >= 4 && Math.abs(x) <= 5) return "r";
      return z === 4 ? "C" : z === 1 ? "t" : "c";
    },
    // The cabin: glass all round, the roof in the body colour.
    (x, y, z) => {
      if (z < 5 || z > 8 || Math.abs(x) > 6 || y < -4 || y > 7) return "";
      if (z === 8) return Math.abs(x) <= 5 && y >= -3 && y <= 6 ? "C" : "";
      return Math.abs(x) === 6 || y === -4 || y === 7 ? "g" : "";
    },
  ];
  return build(15, 27, 9, { C: body, c: trim, t: "#3d3437", w: "#2b2526", g: "#9fb5b8", y: "#f4dc93", r: "#c4574a" }, parts);
}

/** A street tree: a trunk and a lumpy crown, lighter on top. */
export function tree(seed: number, crown = "#6f8b62"): Model {
  const parts: Part[] = [
    box(0, 0, 0, 0, 0, 7, "t"),
    (x, y, z) => {
      if (z < 5) return "";
      const h = (z - 5) / 11;
      const r = 6.2 * Math.sin(Math.PI * Math.min(1, h)) + 0.8;
      const wobble = (noise(x + 7, y + 7, seed + z) - 0.5) * 1.6;
      if (Math.hypot(x, y) > r + wobble || h > 1) return "";
      return h > 0.7 ? "L" : h > 0.35 ? "G" : "D";
    },
  ];
  return build(17, 17, 17, { t: "#6e4d3f", L: "#a7bb8a", G: crown, D: "#4f6a4c" }, parts);
}

/** A street lamp; its head hangs over the road side. */
export function lamp(side: 1 | -1): Model {
  return build(9, 5, 21, { m: "#575257", y: "#f6dc98", M: "#857c80" }, [
    box(0, 0, 0, 0, 0, 19, "m"),
    box(-1, 1, -1, 1, 0, 0, "M"),
    box(side > 0 ? 0 : -3, side > 0 ? 3 : 0, 0, 0, 19, 19, "m"),
    box(side > 0 ? 2 : -3, side > 0 ? 3 : -2, -1, 1, 18, 18, "y"),
  ]);
}

/** A wooden planter of herbs by a door. */
export function planter(flower: string): Model {
  return build(9, 7, 7, { b: "#9c6b4c", B: "#c89667", g: "#6f8b62", G: "#9fb17f", f: flower }, [
    box(-4, 4, -3, 3, 0, 3, (x, y, z) => (z === 3 ? "B" : "b")),
    (x, y, z) => {
      if (z < 4 || Math.abs(x) > 3 || Math.abs(y) > 2) return "";
      const n = noise(x, y, z);
      return n < 0.18 && z >= 5 ? "f" : n < 0.6 + (z === 4 ? 0.3 : 0) ? (z === 6 ? "G" : "g") : "";
    },
  ]);
}

const modelCache = new Map<string, Model>();
const stackCache = new Map<string, ReturnType<typeof stackGrid>>();

/** The model stacked for a camera looking down at `squash`, turned and leaned. */
export function stacked(
  key: string,
  model: () => Model,
  { turn = 0, squash = 0.62, shear = 0, spacing = 1 }: { turn?: number; squash?: number; shear?: number; spacing?: number } = {},
) {
  const angle = quantizeTurn(turn);
  const lean = Math.round(shear * 20) / 20;
  const id = `${key}|${angle.toFixed(3)}|${squash}|${lean}|${spacing}`;
  let hit = stackCache.get(id);
  if (!hit) {
    const made = modelCache.get(key) ?? model();
    modelCache.set(key, made);
    hit = stackGrid(made.slices, { turn: angle, squash, shear: lean, spacing, outline: "O" });
    stackCache.set(id, hit);
    if (stackCache.size > 400) stackCache.delete(stackCache.keys().next().value!);
  }
  return { ...hit, palette: modelCache.get(key)!.palette };
}

