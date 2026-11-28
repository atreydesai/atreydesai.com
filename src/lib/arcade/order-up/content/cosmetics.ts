import type { Decor } from "./schema.ts";

/**
 * The decor catalogue, made from its pattern rather than written out: ten
 * themes, each with twenty pieces, three paints, prints and aprons, four
 * kinds of keepsake, and the cat's four things. A theme's pieces arrive two
 * days apart and cost twenty more each; later themes start later and cost
 * more. Every entry's seed is the sum of its id's character codes.
 */
const THEMES = [
  ["fern", "#7f9b78"],
  ["pearl", "#c8b394"],
  ["lantern", "#bd7c61"],
  ["cloud", "#9c9faf"],
  ["blossom", "#c9929e"],
  ["ferry", "#718f9e"],
  ["moon", "#a3a2bc"],
  ["sun", "#d0af6d"],
  ["wave", "#81a4a3"],
  ["cat", "#b39785"],
] as const;

const PIECES = [
  "window-plant",
  "wall-print",
  "low-stool",
  "tea-shelf",
  "table-runner",
  "small-vase",
  "cushion",
  "menu-frame",
  "floor-mat",
  "pendant-shade",
  "bunting",
  "clock",
  "tea-tin",
  "curtain",
  "shelf-tray",
  "wall-tile",
  "umbrella-pot",
  "bookend",
  "counter-tile",
  "planter-box",
] as const;

const SHADES = ["soft", "clear", "deep"] as const;
const KEEPSAKES = [
  "postcard",
  "paper charm",
  "tea trophy",
  "little pot",
] as const;
const CAT = [
  "woven collar",
  "moon collar",
  "sun collar",
  "window bed",
] as const;

const seedOf = (id: string) => [...id].reduce((n, c) => n + c.charCodeAt(0), 0);

function entry(
  id: string,
  name: string,
  day: number,
  color: string,
  kind: Decor["kind"],
  comfort: number,
  style: number,
  price: number,
): Decor {
  return {
    id,
    name,
    day,
    art: { kind: "decor", motif: id, color, seed: seedOf(id) },
    kind,
    comfort,
    style,
    price,
  };
}

export const DECOR: readonly Decor[] = [
  ...THEMES.flatMap(([theme, color], t) =>
    PIECES.map((piece, i) =>
      entry(
        `${theme}-${piece}`,
        `${theme} ${piece.replaceAll("-", " ")}`,
        Math.min(120, 3 + 9 * t + 2 * i),
        color,
        "decor",
        (i % 3) + 1,
        (t % 3) + 1,
        140 + 30 * t + 20 * i,
      ),
    ),
  ),
  ...(["paint", "print", "apron"] as const).flatMap((kind) =>
    THEMES.flatMap(([theme, color], t) =>
      SHADES.map((shade, s) =>
        entry(
          `${kind}-${theme}-${shade}`,
          `${shade} ${theme} ${kind}`,
          4 + 8 * t + 11 * s,
          color,
          kind,
          0,
          1,
          120 + 20 * t + 50 * s,
        ),
      ),
    ),
  ),
  ...Array.from({ length: 40 }, (_, i) => {
    const [theme, color] = THEMES[i % THEMES.length];
    return entry(
      `keepsake-${i + 1}`,
      `${theme} ${KEEPSAKES[Math.floor(i / THEMES.length)]}`,
      5 + 2 * i,
      color,
      "keepsake",
      1,
      1,
      0,
    );
  }),
  ...CAT.map((name, i) =>
    entry(`cat-${i}`, name, 35 + 8 * i, "#91a17d", "cat", 2, 1, 350 + 50 * i),
  ),
];
