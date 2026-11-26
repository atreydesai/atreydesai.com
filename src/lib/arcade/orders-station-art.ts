import { latheSlices, stackGrid, type LatheLayer } from "./core/sprite-stack.ts";
import type { CupPrintId } from "./orders-recipe-journal.ts";

type Swatch = readonly [light: string, body: string, shade: string];

export function neighborhoodLight(branch: string, weather: string, shiftFraction: number) {
  if (weather === "rain") return "rain";
  if (branch === "night" || branch === "loft" || weather === "festival" || weather === "candlelight" || shiftFraction >= .72) return "night";
  return "day";
}

const TEA: Record<string, Swatch> = {
  black: ["#efb06f", "#bc7344", "#824b3c"],
  jasmine: ["#dbdb95", "#b3ae63", "#7d854f"],
  taro: ["#e4bad4", "#b989ba", "#805878"],
};
const MILK: Record<string, Swatch> = {
  milk: ["#fff0d9", "#eec49d", "#c99575"],
  oat: ["#f8e4af", "#dcaf6f", "#a37b59"],
};
const MIXIN: Record<string, Swatch> = {
  strawberry: ["#f19a88", "#d86766", "#9e494f"],
  banana: ["#fae296", "#dfb65e", "#a87549"],
  mango: ["#ffcb66", "#eaa048", "#ac603e"],
  yuzu: ["#fce98e", "#d7bc50", "#a58a3b"],
  "brown-sugar": ["#d49061", "#a45e3b", "#703f39"],
  honey: ["#fac760", "#d89243", "#a96338"],
  vanilla: ["#f7dfa2", "#e1be8a", "#b98b69"],
  "sesame-syrup": ["#a3939e", "#756573", "#473744"],
};
const TOPPING: Record<string, string> = {
  pearls: "#523338",
  popping: "#e69a3f",
  pudding: "#f6d77c",
  "grass-jelly": "#393b4d",
};

const EMPTY_CUP: Swatch = ["#fff3d9", "#e6d8b9", "#c0ab97"];
const ICE_CENTERS = [[7, 9], [12, 11], [10, 5]];
const MIXIN_BODY = "KUV";
const MIXIN_RIM = "kuv";
const CUP_SIZE = 21;
const PROFILE = [6, 6.15, 6.38, 6.58, 6.76, 6.96, 7.22, 7.4, 7.64, 7.8, 8.04, 8.2, 8.45, 8.6, 8.8, 9];
const FILM = PROFILE.length;
export const CUP_TURN_FRAMES = 24;
const SEALS: Record<CupPrintId, { ink: string; pixels: readonly string[] }> = {
  house: { ink: "#794849", pixels: ["........", "....x...", "..xxxx..", "........", "........"] },
  plum: { ink: "#a25169", pixels: ["...x....", ".x.x.x..", "..xxx...", "..x.x...", "........"] },
  fern: { ink: "#557257", pixels: [".....x..", "...xxx..", "..xxx...", "..xx....", ".x......"] },
  ferry: { ink: "#405974", pixels: ["....x...", "...xxx..", ".xxxxxx.", "..xxxx..", ".x.xx.x."] },
};

interface CupIngredients {
  tea: string | null;
  accentTea?: string | null;
  milk: string | null;
  mixins: readonly string[];
  toppings: readonly string[];
  ice: number | null;
  sealed: boolean;
  foamed?: boolean;
  scoop?: string | null;
  cupPrint?: CupPrintId;
  sparkling?: boolean;
}

interface CupArtwork {
  translateX: number;
  translateY: number;
  paths: { fill: string; d: string }[];
}

const CUP_CACHE_LIMIT = 96;
const cupCache = new Map<string, CupArtwork>();

/** Coalesce runs of identical cells, keeping one SVG path per ink. */
function pixelPaths(grid: readonly string[], palette: Record<string, string>) {
  const paths = new Map<string, string>();
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    let start = 0;
    while (start < row.length) {
      const cell = row[start];
      let end = start + 1;
      while (end < row.length && row[end] === cell) end += 1;
      const fill = palette[cell];
      const width = end - start;
      if (fill) paths.set(fill, (paths.get(fill) ?? "") + `M${start} ${y}h${width}v1H${start}z`);
      start = end;
    }
  }
  return Array.from(paths, ([fill, d]) => ({ fill, d }));
}

export function stationCup(ingredients: CupIngredients, frame: number): CupArtwork {
  const { tea, accentTea = null, milk, mixins, toppings, ice, sealed, foamed = false, scoop = null, cupPrint = "house",
    sparkling = false } = ingredients;
  const mark = SEALS[cupPrint];
  const distinctMixins = [...new Set(mixins)].filter((name) => Object.hasOwn(MIXIN, name)).slice(0, 3);
  const toppingKinds = [...new Set(toppings)].filter((name) => Object.hasOwn(TOPPING, name)).slice(0, 3);
  const toppingDensity = Math.min(toppings.length, 4);
  const iceCenters = ICE_CENTERS.slice(0, ice ?? 0);
  const upperTea = tea && accentTea && accentTea !== tea && Object.hasOwn(TEA, accentTea) ? TEA[accentTea] : null;
  const key = JSON.stringify([tea, upperTea ? accentTea : null, milk, distinctMixins, toppingKinds, toppingDensity, iceCenters.length, sealed, foamed, scoop, cupPrint, sparkling, frame]);
  const cached = cupCache.get(key);
  if (cached) return cached;

  const teaColor = TEA[tea ?? ""] ?? EMPTY_CUP;
  const milkColor = MILK[milk ?? ""];
  const mixinColors = distinctMixins.map((name) => MIXIN[name]);
  const mixinDepth = mixinColors.length ? 2 + mixinColors.length * 2 : 0;

  const palette: Record<string, string> = {
    O: "#3f2b2a", H: teaColor[0], T: teaColor[1], D: teaColor[2],
    M: milkColor?.[1] ?? EMPTY_CUP[1], m: milkColor?.[2] ?? EMPTY_CUP[2],
    F: "#f3dba9", f: "#aa765d", S: "#f8e3ad", s: "#b45348",
    W: "#fff2d9", L: "#eed3a4", X: mark.ink, G: "#e5efcf", g: "#a9bcb0",
    P: "#fff5d7", p: "#e8cba0", E: "#fff3bd", e: "#ffd595",
    Q: scoop === "banana-scoop" ? "#ffe4a3" : "#fff3d8",
    q: scoop === "banana-scoop" ? "#daa356" : "#d6bb98",
  };
  if (upperTea) [palette.J, palette.A, palette.a] = upperTea;
  for (const [index, [, body, shade]] of mixinColors.entries()) {
    palette[MIXIN_BODY[index]] = body;
    palette[MIXIN_RIM[index]] = shade;
  }
  for (const [index, name] of toppingKinds.entries()) palette["abc"[index]] = TOPPING[name];

  const layers: LatheLayer[] = PROFILE.map((r, z) => {
    if (z < mixinDepth) {
      const index = Math.max(0, Math.floor((z - 2) / 2));
      return { r, fill: MIXIN_BODY[index], rim: MIXIN_RIM[index] };
    }
    if (foamed && z >= FILM - 3) return { r, fill: "P", rim: "p" };
    if (upperTea && z >= FILM - (foamed ? 6 : 4)) {
      return z === FILM - 1 ? { r, fill: "J", rim: "a" } : { r, fill: "A", rim: "a" };
    }
    if (milkColor && z >= Math.max(5, mixinDepth) && z < 12) return { r, fill: "M", rim: "m" };
    if (z === FILM - 1) return { r, fill: "H", rim: "D" };
    return { r, fill: "T", rim: "D" };
  });
  layers.push({ r: sealed ? 9.35 : 9.2, fill: "F", rim: "f" });
  const scoopRadii = [6.2, 6.5, 6.1, 5.5, 4.7, 3.8, 2.4];
  const extraLayers = scoop ? scoopRadii.length - 1 : sealed ? 6 : 0;
  for (let index = 0; index < extraLayers; index += 1) layers.push({ r: -1, fill: "." });

  const slices = latheSlices(layers, CUP_SIZE, (z, x, y, cell) => {
    if (sealed && z >= FILM && x >= 13 && x <= 14 && y >= 7 && y <= 8) {
      return z === FILM + 6 || (z + y) % 3 === 0 ? "S" : "s";
    }
    if (scoop && z >= FILM) {
      const height = z - FILM;
      const radius = scoopRadii[height];
      const distance = Math.hypot(x - 8, y - 10);
      if (distance <= radius + ((x * 3 + y) % 7 === 0 ? .36 : 0)) {
        return distance >= radius - 1.1 || (height < 3 && y >= 12) ? "q" : "Q";
      }
    }
    if (cell === ".") return cell;
    if (z === FILM && !sealed && x > 3 && x < 17 && Math.hypot(x - 10, y - 10) < 8) {
      if (foamed) return (x * 5 + y * 3) % 13 < 2 ? "p" : "P";
      const cube = iceCenters.find(([cx, cy]) => Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1);
      if (cube) return x > cube[0] || y > cube[1] ? "g" : "G";
      if (!tea) return (x + y) % 5 === 0 ? "W" : "D";
      return (x * 3 + y) % 11 === 0 ? "W" : upperTea ? "J" : "H";
    }

    const rim = cell === "D" || cell === "a" || cell === "m" || MIXIN_RIM.includes(cell);
    if (!rim) return cell;
    if (z < 5 && toppingKinds.length && (x * 5 + y * 3 + z * 7) % 13 < 2 + toppingDensity) {
      const kind = (x * 2 + y + Math.floor(z / 2)) % toppingKinds.length;
      return "abc"[kind];
    }
    if (!foamed && z === 14 && iceCenters.length && (x * 3 + y * 2) % 17 < iceCenters.length) return "g";
    // A narrow reflection and a paper shop seal are painted on the cylinder.
    if (z >= 7 && z <= 11 && x >= 6 && x <= 13 && y >= 16) {
      return mark.pixels[11 - z][x - 6] === "x" ? "X" : "L";
    }
    if (sparkling && z >= 3 && z < 15 && (x * 11 + y * 13 + z * 3 + frame) % 17 === 0) return z % 2 ? "E" : "e";
    if (x <= 5 && y >= 9 && y <= 14 && z > 3 && z < 15) return z % 5 ? "W" : cell === "a" ? "J" : "H";
    return cell;
  });

  const { grid, anchorX } = stackGrid(slices, {
    turn: (frame / CUP_TURN_FRAMES) * Math.PI * 2,
    squash: 0.52,
    spacing: 1.28,
    outline: "O",
  });
  const foot = grid.findLastIndex((row) => /[^.]/.test(row));
  const artwork = { translateX: -anchorX, translateY: -foot - 1, paths: pixelPaths(grid, palette) };
  if (cupCache.size >= CUP_CACHE_LIMIT) {
    const oldest = cupCache.keys().next();
    if (!oldest.done) cupCache.delete(oldest.value);
  }
  cupCache.set(key, artwork);
  return artwork;
}
