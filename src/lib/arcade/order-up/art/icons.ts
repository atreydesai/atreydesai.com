/**
 * Pixel icons for the shop's ingredients, tools and marks. Each is a 16 by 16
 * grid in the kitchen icons' ink and paper (see OrderKitchenItem), filled
 * with the thing's own colour. Where the first campaign already drew a thing,
 * `kitchenKind` names its drawing instead, so the two never disagree.
 */
import { mixHex } from "../../core/color.ts";
import { INGREDIENT_BY_ID } from "../content/index.ts";

export type Grid = readonly string[];
export interface Sprite {
  grid: Grid;
  palette: Record<string, string>;
}

export const INK = "#4a322d";
export const CREAM = "#f8dfaa";
const LEAF = "#6f8b62";
const LEAF_DARK = "#4f6a4c";
const WOOD = "#a8784c";
const GLASS = "#d9e0cf";
const SEED = "#3b2a28";

/** Ingredients the first campaign's kitchen icons already draw. */
const KITCHEN_INGREDIENTS = new Set([
  "black", "jasmine", "taro", "milk", "oat", "pearls", "popping", "pudding", "grass-jelly",
  "strawberry", "banana", "mango", "yuzu", "brown-sugar", "honey", "vanilla", "sesame-syrup",
  "bun", "waffle", "banana-scoop", "vanilla-scoop", "seltzer",
]);

export function kitchenKind(id: string) {
  return KITCHEN_INGREDIENTS.has(id) ? id : null;
}

const T = {
  tin: [
    "................",
    "....OOOOOOOO....",
    "...OCCCCCCCCO...",
    "...OOOOOOOOOO...",
    "...OFLFFFFFDO...",
    "...OFLFFFFFDO...",
    "...OCCCCCCCCO...",
    "...OCCCCGGCCO...",
    "...OCCCGGGGCO...",
    "...OCCGGGGCCO...",
    "...OCCCGHCCCO...",
    "...OFLFFFFFDO...",
    "...OFFFFFFFDO...",
    "...OOOOOOOOOO...",
    "................",
    "................",
  ],
  bottle: [
    "................",
    "......OOOO......",
    "......OCCO......",
    "......OOOO......",
    ".....OCCCCO.....",
    "....OCCCCCCO....",
    "....OCLCCCDO....",
    "....OFFFFFFO....",
    "....OFLFFFDO....",
    "....OFFFFFDO....",
    "....OCLCCCDO....",
    "....OCCCCCDO....",
    "....OCCCCCDO....",
    "....OOOOOOOO....",
    "................",
    "................",
  ],
  carton: [
    "................",
    ".......OO.......",
    "......OCCO......",
    ".....OCCCCO.....",
    "....OOOOOOOO....",
    "....OCLCCCDO....",
    "....OCLCCCDO....",
    "....OFFFFFFO....",
    "....OFLFFFDO....",
    "....OFFFFFFO....",
    "....OCLCCCDO....",
    "....OCCCCCDO....",
    "....OCCCCCDO....",
    "....OOOOOOOO....",
    "................",
    "................",
  ],
  can: [
    "................",
    "................",
    "....OOOOOOOO....",
    "...OCCCCCCCCO...",
    "...OOOOOOOOOO...",
    "...OFLFFFFFDO...",
    "...OFLFFFFFDO...",
    "...OCCCCCCCCO...",
    "...OCLCDDCCDO...",
    "...OCCCCCCCDO...",
    "...OFLFFFFFDO...",
    "...OFFFFFFFDO...",
    "...OOOOOOOOOO...",
    "....OOOOOOOO....",
    "................",
    "................",
  ],
  pot: [
    "................",
    "................",
    "..OOOOOOOOOOOO..",
    "..OCCCCCCCCCCO..",
    "..OOOOOOOOOOOO..",
    "...OFLFFFFFDO...",
    "...OFLFFFFFDO...",
    "...OFFFFFFFDO...",
    "...OCCCCCCCCO...",
    "...OCCCHHCCCO...",
    "....OCCCCCCO....",
    "....OFFFFFDO....",
    ".....OOOOOO.....",
    "................",
    "................",
    "................",
  ],
  jar: [
    "................",
    ".....OOOOOO.....",
    "....OBBBBBBO....",
    "....OOOOOOOO....",
    "...OWWWWWWWWO...",
    "...OW111111WO...",
    "...OW222222WO...",
    "...OW111111WO...",
    "...OW222222WO...",
    "...OW111111WO...",
    "...OW222222WO...",
    "...OWWWWWWWWO...",
    "....OOOOOOOO....",
    "................",
    "................",
    "................",
  ],
  round: [
    "........GG......",
    ".......GG.......",
    ".....OOOOOO.....",
    "....OFLFFFFO....",
    "...OFLLFFFFDO...",
    "...OFLFFFFFDO...",
    "...OFFFFFFFDO...",
    "...OFFFFFFFDO...",
    "...OFFFFFFDDO...",
    "....OFFFFDDO....",
    ".....OOOOOO.....",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  citrus: [
    "................",
    "........GG......",
    ".....OOOOOGO....",
    "....OFLFFFFO....",
    "...OFLFFFFFFO...",
    "...OFFFFFFFDO...",
    "...OOOOOOOOOO...",
    "...OCFCFCFCFO...",
    "...OFCFCFCFCO...",
    "....OCFCFCFO....",
    ".....OOOOOO.....",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  cluster: [
    "........G.......",
    ".......GG.......",
    ".....OOOOOO.....",
    "....OLFOLFFO....",
    "....OFDOFDDO....",
    "...OLFOLFOLFO...",
    "...OFDOFDOFDO...",
    "....OLFOLFFO....",
    "....OFDOFDDO....",
    ".....OLFFO......",
    "......OOO.......",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  slice: [
    "................",
    "................",
    "................",
    "..OOOOOOOOOOOO..",
    "..OFFFFFFFFFFO..",
    "..OFXFFXFFXFFO..",
    "...OFFFFXFFFO...",
    "...OCCCCCCCCO...",
    "....OGGGGGGO....",
    ".....OOOOOO.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  spiky: [
    "....G..G..G.....",
    ".....GGGGG......",
    "......GGG.......",
    ".....OOOOO......",
    "....OFDFDFO.....",
    "....ODFLFDO.....",
    "....OFDFDFO.....",
    "....ODFDFDO.....",
    "....OFDFDFO.....",
    ".....OOOOO......",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  pump: [
    ".....OOOOOOO....",
    ".....OCCCCCO....",
    ".....OOOOOOO....",
    ".......OCO......",
    "......OOOOO.....",
    ".....OCCCCCO....",
    "....OFFFFFFFO...",
    "....OFLFFFFDO...",
    "....OFLFFFFDO...",
    "....OCCCCCCCO...",
    "....OCCDDCCCO...",
    "....OCCCCCCCO...",
    "....OFLFFFFDO...",
    "....OOOOOOOOO...",
    "................",
    "................",
  ],
  cup: [
    "................",
    "................",
    "...OOOOOOOOOO...",
    "...OCCCCCCCCO...",
    "...OOOOOOOOOO...",
    "....OFFFFFFO....",
    "....OFLFFFDO....",
    "....OCCCCCCO....",
    "....OCCDDCCO....",
    "....OCCCCCCO....",
    ".....OFFFFO.....",
    ".....OOOOOO.....",
    "................",
    "................",
    "................",
    "................",
  ],
  // Sides on a plate.
  griddle: [
    "................",
    "................",
    "................",
    "...OOOOOOOOOO...",
    "..OLFLFLFLFLFO..",
    "..OFDFDFDFDFDO..",
    "..OLFLFLFLFLFO..",
    "..OFDFDFDFDFDO..",
    "...OOOOOOOOOO...",
    ".OCCCCCCCCCCCCO.",
    "..OOOOOOOOOOOO..",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  ring: [
    "................",
    "................",
    ".....OOOOOO.....",
    "....OFLOOLFO....",
    "...OFLO..OFDO...",
    "...OFO....ODO...",
    "...OLO....OFO...",
    "...OFDO..OFDO...",
    "....OFDOOFDO....",
    ".....OOOOOO.....",
    ".OCCCCCCCCCCCCO.",
    "..OOOOOOOOOOOO..",
    "................",
    "................",
    "................",
    "................",
  ],
  fish: [
    "................",
    "................",
    "................",
    ".....OOOOOO..OO.",
    "...OOFLFFFFOOFO.",
    "..OXFLFDFDFFFFO.",
    "..OFFFFFDFDFOFO.",
    "...OOFFFFFFOOFO.",
    ".....OOOOOO..OO.",
    ".OCCCCCCCCCCCCO.",
    "..OOOOOOOOOOOO..",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  cake: [
    "................",
    "................",
    "................",
    "....OOOOOOOO....",
    "...OLFFFFFFDO...",
    "...OFDOFFODFO...",
    "...OFFODDOFFO...",
    "...OFDOFFODFO...",
    "...OFFFFFFFDO...",
    "....OOOOOOOO....",
    ".OCCCCCCCCCCCCO.",
    "..OOOOOOOOOOOO..",
    "................",
    "................",
    "................",
    "................",
  ],
  bowl: [
    "................",
    "................",
    "................",
    "................",
    "....OOO.OOO.....",
    "...OLFFOLFFO....",
    "..OOFFDOFFDOO...",
    ".OCCCCCCCCCCCO..",
    ".OCCCCCCCCCCCO..",
    "..OFFFFFFFFFO...",
    "...OFFFFFFFO....",
    "....OOOOOOO.....",
    "................",
    "................",
    "................",
    "................",
  ],
  parcel: [
    "................",
    "................",
    ".......OO.......",
    "......OGGO......",
    ".....OGLGGO.....",
    "....OGLGGGGO....",
    "...OGGGOGGGGO...",
    "..OGLGGOOGGGGO..",
    ".OGGGGGOOOGGGGO.",
    ".OOOOOOOOOOOOOO.",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  root: [
    "................",
    "................",
    "................",
    "......OOO.......",
    ".....OFLFO.OO...",
    "..OOOOFFFOOFLO..",
    ".OFLFFFFFFFFFO..",
    ".OFFFFDFFFDFO...",
    "..OOFFDOOFDO....",
    "....OOO..OO.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  scoop: [
    "................",
    "................",
    ".....OOOOOO.....",
    "....OLLFFFFO....",
    "...OLFFFFFFDO...",
    "...OFFFFFFFDO...",
    "...OOFOFFOFOO...",
    "....OCCCCCCO....",
    ".....OCCCCO.....",
    ".....OCCCCO.....",
    "......OCCO......",
    "......OOOO......",
    "................",
    "................",
    "................",
    "................",
  ],
} satisfies Record<string, Grid>;

/** A jar's contents: two alternating rows drawn into its glass. */
const FILLINGS: Record<string, [string, string]> = {
  balls: ["FDFDFD", "DLFDLF"],
  small: ["FLFLFL", "LFLFLF"],
  cubes: ["FFLFFD", "FDDFDD"],
  beans: ["FDDFDF", "DFFDFD"],
  crumbs: ["FWWFWF", "WWFWFW"],
  layer: ["LLLLLL", "FFFFFF"],
};

const SHAPES: Record<string, keyof typeof T> = {
  // Milks.
  soy: "bottle", almond: "bottle", "coconut-milk": "carton", cream: "carton", "foam-base": "carton",
  "sea-salt-cream": "carton", condensed: "can", yogurt: "cup",
  // Fruit.
  lemon: "citrus", lime: "citrus", grapefruit: "citrus", pomelo: "citrus", kumquat: "round",
  grape: "cluster", "lychee-fruit": "round", watermelon: "slice", "dragon-fruit": "slice",
  pineapple: "spiky", "passion-fruit": "round", peach: "round", avocado: "round", "coconut-fruit": "round",
  persimmon: "round", plum: "round",
  // Sides.
  "egg-waffle": "griddle", "scallion-pancake": "griddle", "mochi-donut": "ring", taiyaki: "fish",
  mooncake: "cake", tangyuan: "bowl", zongzi: "parcel", ginger: "root",
};

const JAR_FILL: Record<string, keyof typeof FILLINGS> = {
  "crystal-boba": "balls", "taro-balls": "balls", "mochi-bits": "cubes", sago: "small", chia: "small",
  "coconut-jelly": "cubes", aloe: "cubes", "lychee-jelly": "cubes", "rainbow-jelly": "cubes",
  "red-bean": "beans", "cookie-crumble": "crumbs", "brulee-crust": "layer",
};

const RAINBOW = ["#d98a7c", "#e4c775", "#a5bb86", "#8fa4c4"];

function jar(fill: keyof typeof FILLINGS): Grid {
  const [a, b] = FILLINGS[fill];
  return T.jar.map((row) => row.replace("111111", a).replace("222222", b));
}

const cache = new Map<string, Sprite>();

function paletteFor(color: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    O: INK, C: CREAM, F: color, D: mixHex(color, INK, 0.32), L: mixHex(color, "#fff8e6", 0.42),
    G: LEAF, H: LEAF_DARK, B: WOOD, W: GLASS, X: SEED, ...extra,
  };
}

/** An ingredient the kitchen icons don't draw; null when they do. */
export function ingredientSprite(id: string): Sprite | null {
  if (kitchenKind(id)) return null;
  const hit = cache.get(id);
  if (hit) return hit;
  const item = INGREDIENT_BY_ID[id];
  const color = item?.cupColor ?? "#b88c6e";
  let grid: Grid;
  let palette = paletteFor(color);
  switch (item?.group) {
    case "tea":
      grid = id === "coffee" ? T.pot : T.tin;
      if (id === "coffee") palette = paletteFor(color, { H: "#2f2220" });
      break;
    case "milk":
      grid = T[SHAPES[id] ?? "bottle"];
      break;
    case "topping":
      grid = jar(JAR_FILL[id] ?? "balls");
      if (id === "rainbow-jelly") palette = { ...palette, F: RAINBOW[0], D: RAINBOW[2], L: RAINBOW[1] };
      break;
    case "fruit":
      grid = T[SHAPES[id] ?? "round"];
      if (id === "dragon-fruit") palette = { ...palette, F: "#f3eee2", X: SEED, C: color, G: LEAF };
      if (id === "watermelon") palette = { ...palette, C: "#f1e4c2" };
      if (id === "avocado") palette = { ...palette, D: "#4f6a4c" };
      break;
    case "syrup":
      grid = T.pump;
      break;
    case "side":
      grid = T[SHAPES[id] ?? "griddle"];
      if (id === "zongzi") palette = paletteFor("#7d9b67", { L: "#a9c08b", G: "#7d9b67" });
      if (id === "scallion-pancake") palette = { ...palette, D: LEAF };
      break;
    default:
      grid = T.scoop;
  }
  const sprite = { grid, palette };
  cache.set(id, sprite);
  return sprite;
}

// --- Tools on the belt ------------------------------------------------------

/** Power-ups the kitchen icons already draw. */
const KITCHEN_POWERS: Record<string, string> = {
  rush: "rush", patience: "patience", quality: "quality", assist: "assist", supplies: "supplies",
  special: "special", quiet: "quiet", "rush-bell": "bell", "ice-avalanche": "ice", "remake-pass": "remake",
  "pearl-express": "prep-pearls", "fresh-batch": "prep-buns", "hot-stamp": "seal",
};

export function powerKitchenKind(id: string) {
  return KITCHEN_POWERS[id] ?? null;
}

const POWER_ART: Record<string, { grid: Grid; palette: Record<string, string> }> = {
  "golden-ladle": {
    grid: [
      "................",
      "..........OO....",
      ".........OYO....",
      "........OYO.....",
      ".......OYO......",
      "......OYO.......",
      "..OOOOOOO.......",
      ".OYLLYYYO.......",
      ".OYYYYYDO.......",
      "..OYYYDO........",
      "...OOOO.........",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, Y: "#e6b85c", L: "#fbe6a6", D: "#a87a3c" },
  },
  "steady-hands": {
    grid: [
      "................",
      "....O.O.O.......",
      "...OSOSOSO......",
      "...OSOSOSO.O....",
      "...OSOSOSOOSO...",
      "...OSSSSSSSSO...",
      "...OSSSSSSSO....",
      "...OSSSSSSO.....",
      "....OSSSSO......",
      "....OCCCCO......",
      "....OCCCCO......",
      "....OOOOOO......",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, S: "#dca47c", C: "#8a9f86" },
  },
  "slow-pour": {
    grid: [
      "................",
      "...OOOOOOOOO....",
      "...OCCCCCCCO....",
      "....OSSSSSO.....",
      ".....OSSSO......",
      "......OSO.......",
      "......OSO.......",
      ".....OCSCO......",
      "....OCCSCCO.....",
      "...OCCSSSCCO....",
      "...OSSSSSSSO....",
      "...OOOOOOOOO....",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, C: CREAM, S: "#c99a5f" },
  },
  "second-hands": {
    grid: [
      "................",
      "..O.O.....O.O...",
      ".OSOSO...OSOSO..",
      ".OSOSOO.OOSOSO..",
      ".OSSSSO.OSSSSO..",
      ".OSSSSO.OSSSSO..",
      "..OSSO...OSSO...",
      "..OCCO...OCCO...",
      "..OOOO...OOOO...",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, S: "#dca47c", C: "#8a9f86" },
  },
  "jukebox-coin": {
    grid: [
      "................",
      ".....OOOOO......",
      "....OYYYYYO.....",
      "...OYLYYYYDO....",
      "...OYYOOOYDO....",
      "...OYYOYYYDO....",
      "...OYYOOOYDO....",
      "...OYYYYOYDO....",
      "...OYYOOOYDO....",
      "....OYYYYDO.....",
      ".....OOOOO......",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, Y: "#e6b85c", L: "#fbe6a6", D: "#a87a3c" },
  },
  "happy-hour": {
    grid: [
      "................",
      ".....OOOOOO.....",
      "....OCCCCCCO....",
      "...OCCCOCCCCO...",
      "...OCCCOCCCCO...",
      "...OCCCOOOCCO...",
      "...OCCCCCCCCO...",
      "...OCCCCCCCCO...",
      "....OCCCCCCO....",
      ".....OOOOOO.....",
      "....OO....OO....",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, C: "#f3c98c" },
  },
  "fortune-cookie": {
    grid: [
      "................",
      "................",
      "......OOOO......",
      "....OOLYYYOO....",
      "...OLYYYYYYDO...",
      "..OLYYOOOOYYDO..",
      "..OYYOCCCCOYDO..",
      "..OYOCCCCCCODO..",
      "...OOOOOOOOOO...",
      "......OCCO......",
      "......OOOO......",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, Y: "#e1b36d", L: "#f7d89a", D: "#a87a3c", C: CREAM },
  },
  "cat-nap": {
    grid: [
      "................",
      "................",
      "..........ZZZ...",
      "...O...O....Z...",
      "..OGO.OGO..Z....",
      "..OGGOGGO.ZZZ...",
      "..OGGGGGGOOOO...",
      ".OGOGGGOGGGGGO..",
      ".OGGGGGGGGGGGGO.",
      "..OOOOOOOOOOOGO.",
      "............OO..",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, G: "#9b8b7a", Z: CREAM },
  },
  "vip-lane": {
    grid: [
      "................",
      "................",
      ".OO..........OO.",
      ".OYO........OYO.",
      ".OYORRRRRRRROYO.",
      ".OYOLRRRRRRLOYO.",
      ".OYO..RRRR..OYO.",
      ".OYO........OYO.",
      ".OYO........OYO.",
      "OOYOO......OOYOO",
      "OYYYO......OYYYO",
      "OOOOO......OOOOO",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, Y: "#d6a367", R: "#b76058", L: "#d98a7c" },
  },
  "rain-check": {
    grid: [
      "................",
      ".......OO.......",
      ".....OOUUOO.....",
      "....OUULUUUO....",
      "...OUULUUUUUO...",
      "..OUUUUUUUUUUO..",
      "..OOOOOOOOOOOO..",
      ".......OO.......",
      ".......OO.......",
      ".......OO.......",
      "....OO.OO.......",
      ".....OOO........",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, U: "#8fa4b4", L: "#c4d1d6" },
  },
  "flow-keeper": {
    grid: [
      "................",
      "................",
      "................",
      "..OO....OO......",
      ".OLLO..OLLO..OO.",
      "OLFFLOOLFFLOOLLO",
      "OFFFFLLFFFFLLFFO",
      "OFDDFFFFDDFFFFDO",
      ".OOOOOOOOOOOOOO.",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, F: "#85a69b", L: "#c4d8cc", D: "#5f7d74" },
  },
};

export function powerSprite(id: string): Sprite | null {
  return POWER_ART[id] ?? null;
}

// --- Skills on the step rail --------------------------------------------------

const KITCHEN_SKILLS: Record<string, string> = {
  steep: "brew", "kettle-heat": "kettle", "pearl-pot": "prep-pearls", "egg-waffle": "prep-waffles",
  "cheese-foam": "foam", shake: "shaker", seal: "sealer", packing: "stock", "fruit-board": "strawberry",
  "topping-ladle": "pearls", "milk-ratio": "milk", pour: "carafe",
};

export function skillKitchenKind(id: string) {
  return KITCHEN_SKILLS[id] ?? null;
}

const SKILL_ART: Record<string, Sprite> = {
  "tiger-stripes": {
    grid: [
      "................",
      "....OOOOOOOO....",
      "....OCCCCCCO....",
      "....OBCCCBCO....",
      "....OCBCBCCO....",
      "....OCCBCCBO....",
      "....OBCCBCCO....",
      "....OCBCCBCO....",
      "....OCCBCCCO....",
      "....OOOOOOOO....",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, C: "#f0d9ab", B: "#8c5235" },
  },
  blender: {
    grid: [
      "................",
      ".....OOOOOO.....",
      ".....OCCCCO.....",
      "....OWWWWWWO....",
      "....OWFFFFWO....",
      "....OWFLFFWO....",
      "....OWFFFFWO....",
      ".....OWOOWO.....",
      "....OOOOOOOO....",
      "....OSSSSSSO....",
      "....OSOSSOSO....",
      "....OOOOOOOO....",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, C: CREAM, W: GLASS, F: "#d7a2b0", L: "#f0cbd2", S: "#8c9a7f" },
  },
  "straw-stab": {
    grid: [
      "..........OO....",
      ".........OPO....",
      "........OPO.....",
      ".......OPO......",
      "...OOOOOOOOOO...",
      "...OCCCCCCCCO...",
      "....OFFFFFFO....",
      "....OFFFFFFO....",
      "....OFFFFFFO....",
      "....OFXFXFFO....",
      ".....OFXFFO.....",
      ".....OOOOOO.....",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, C: CREAM, P: "#e48f88", F: "#d8b98e", X: SEED },
  },
  torch: {
    grid: [
      "......RR........",
      ".....RYYR.......",
      "......RYR.......",
      ".......O........",
      "......OSO.......",
      ".....OSSSO......",
      ".....OSSSOOO....",
      ".....OSSSOBO....",
      ".....OSSSOOO....",
      ".....OSSSO......",
      ".....OOOOO......",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, R: "#d96a4b", Y: "#f3c35f", S: "#8c9a7f", B: "#b76058" },
  },
  "layered-pour": {
    grid: [
      "................",
      "....OOOOOOOO....",
      "....OCCCCCCO....",
      "....OAAAAAAO....",
      "....OAAAAAAO....",
      "....OBBBBBBO....",
      "....OBBBBBBO....",
      "....OCCCCCCO....",
      "....OCCCCCCO....",
      ".....OOOOOO.....",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, C: "#f2e3c3", A: "#bd895c", B: "#b989ba" },
  },
  "colour-change": {
    grid: [
      "................",
      ".......OO.......",
      "......OLLO......",
      "......OLLO......",
      ".......OO.......",
      "....OOOOOOOO....",
      "....OAAAAAAO....",
      "....OAAAABBO....",
      "....OAABBBBO....",
      "....OBBBBBBO....",
      ".....OOOOOO.....",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, A: "#7b84bd", B: "#b783b4", L: "#ded278" },
  },
  "cream-rosette": {
    grid: [
      "................",
      ".....OOOOOO.....",
      "....OCCCCCCO....",
      ".....OCCCCO.....",
      "......OCCO......",
      ".......OO.......",
      "................",
      "....OOOOOO......",
      "...OCCLCCLO.....",
      "..OCLCCCLCCO....",
      "..OCCLCCCLCO....",
      "...OOOOOOOO.....",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { O: INK, C: "#f6ead2", L: "#dcc6a6" },
  },
};

export function skillSprite(id: string): Sprite | null {
  return SKILL_ART[id] ?? null;
}

// --- Marks: small signs in tickets and readouts -----------------------------

export const MARKS: Record<string, Grid> = {
  check: [
    "..........",
    "........OO",
    ".......OO.",
    "OO....OO..",
    ".OO..OO...",
    "..OOOO....",
    "...OO.....",
    "..........",
  ],
  question: [
    "..OOOO..",
    ".OO..OO.",
    ".....OO.",
    "....OO..",
    "...OO...",
    "...OO...",
    "........",
    "...OO...",
  ],
  change: [
    "..OOOO....",
    ".OO..OO...",
    "OO....OO..",
    "OO...OOOOO",
    "OO....OOO.",
    ".OO....O..",
    "..OOO.....",
    "..........",
  ],
  clock: [
    "..OOOO..",
    ".O....O.",
    "O..O...O",
    "O..O...O",
    "O..OOO.O",
    "O......O",
    ".O....O.",
    "..OOOO..",
  ],
  hot: [
    ".O..O..O",
    "O..O..O.",
    ".O..O..O",
    "O..O..O.",
    "........",
    "OOOOOOOO",
    ".OOOOOO.",
    "........",
  ],
  ice: [
    "OOOO....",
    "O..O....",
    "OOOOOOOO",
    "...O...O",
    "...O...O",
    "...OOOOO",
    "........",
    "........",
  ],
  sugar: [
    "OOO.OOO.",
    "OOO.OOO.",
    "OOO.OOO.",
    "........",
    "..OOO...",
    "..OOO...",
    "..OOO...",
    "........",
  ],
  star: [
    "...OO...",
    "...OO...",
    "OOOOOOOO",
    ".OOOOOO.",
    "..OOOO..",
    ".OO..OO.",
    "OO....OO",
    "........",
  ],
  coin: [
    "..OOOO..",
    ".OOOOOO.",
    "OOO..OOO",
    "OO.OO.OO",
    "OO.OO.OO",
    "OOO..OOO",
    ".OOOOOO.",
    "..OOOO..",
  ],
  points: [
    "OOOOOOO.",
    "O.....O.",
    "O.OOO.O.",
    "O.....O.",
    "O.OOO.O.",
    "O.....O.",
    "OOOOOOO.",
    "........",
  ],
};
