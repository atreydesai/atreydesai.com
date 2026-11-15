// Order up's guests as pixel sprites, kept free of the DOM so the art can be
// checked with node. Each regular has a look written from their line in the
// cast (the one who studies here wears glasses, the one on a call holds a
// phone, the one who can barely see over the counter barely does), and a
// face for every mood: calm, glancing at the clock, cross, and the way they
// take their drink. They stand across the counter from the player, so the
// counter's edge hides them from the waist down.
//
// A figure is a guest from the waist up, 12 cells across and 18 down,
// outlined in ink to 14 by 20; the counter cuts it a few rows from the
// bottom (FIGURE_ABOVE rows show above it).

import { CRITIC, REGULARS } from "./orders-engine.js";

/** @typedef {"calm" | "blink" | "glance" | "glanceAlt" | "cross" | "storm" | "starry" | "wow" | "content" | "meh" | "unimpressed" | "sentBack"} Face */
/** @typedef {"crop" | "side" | "bob" | "long" | "bun" | "buns" | "pigtails" | "spiky" | "mohawk" | "curly" | "afro" | "none"} Hair */
/** @typedef {"glasses" | "shades" | "headphones" | "beanie" | "cap" | "headband" | "bandana" | "bow" | "flower" | "beret" | "phone" | "pencil" | "hood" | "scarf" | "mustache" | "freckles" | "earrings" | "sprout" | "straw" | "sunhat" | "tired" | "tie" | "blush"} Extra */
/** @typedef {{ hair: Hair, hairColor: string, extras: Extra[], color?: string, shirt?: string, drop?: number }} Look */

export const FIGURE_W = 14;
export const FIGURE_H = 20;
/** Rows of the outlined figure that show above the counter's edge. */
export const FIGURE_ABOVE = 17;

/** Every face a figure can make. @type {Face[]} */
export const FACES = [
  "calm", "blink", "glance", "glanceAlt", "cross", "storm",
  "starry", "wow", "content", "meh", "unimpressed", "sentBack",
];

export const INK = "#2b2320";
const SKINS = ["#f3cfae", "#dca47c", "#bb8256", "#93623f"];
const SHIRTS = ["#6aa6e0", "#e76f8e", "#9fd17a", "#f4b942", "#b388e0", "#e8e0d2", "#5f8f8a"];

const BLACK = "#2b1a12";
const BROWN = "#5a3825";
const GINGER = "#c9672f";
const BLONDE = "#e0bd62";
const GREY = "#9a9a9a";
const AUBURN = "#8f3a26";
const PINK = "#f47ba0";
const TEAL = "#3fa99f";
const PLUM = "#6b3a5a";

/**
 * The cast's looks, from their lines. Skin and shirt are seeded from the name
 * unless given, so every regular always looks the same.
 * @type {Record<string, Look>}
 */
export const LOOKS = {
  mochi: { hair: "bun", hairColor: BLACK, extras: ["glasses"] },
  tofu: { hair: "crop", hairColor: BROWN, extras: ["cap"], color: "#3f6fb0" },
  pip: { hair: "pigtails", hairColor: GINGER, extras: ["freckles"] },
  bean: { hair: "side", hairColor: GREY, extras: ["mustache", "tie"], color: "#704a05", shirt: "#e8e0d2" },
  juniper: { hair: "bob", hairColor: BROWN, extras: ["beanie"], color: "#2f7d5b" },
  noodle: { hair: "spiky", hairColor: BLACK, extras: ["headphones"], color: "#e85d4c" },
  clementine: { hair: "long", hairColor: GINGER, extras: ["flower", "earrings"], color: PINK },
  biscuit: { hair: "crop", hairColor: BLONDE, extras: ["bandana"], color: "#e85d4c" },
  sesame: { hair: "side", hairColor: BLACK, extras: ["glasses"] },
  dumpling: { hair: "buns", hairColor: BLACK, extras: [], shirt: "#b388e0" },
  yuzu: { hair: "bob", hairColor: BLONDE, extras: ["phone"] },
  pickles: { hair: "curly", hairColor: BROWN, extras: ["straw"] },
  waffles: { hair: "crop", hairColor: BROWN, extras: ["headphones"], color: TEAL },
  miso: { hair: "mohawk", hairColor: BLACK, extras: ["shades"] },
  peaches: { hair: "long", hairColor: BLONDE, extras: ["headband"], color: PINK },
  basil: { hair: "crop", hairColor: BLACK, extras: ["beret"], color: "#5f8a3a", shirt: "#9fd17a" },
  tater: { hair: "bob", hairColor: BROWN, extras: ["shades"] },
  olive: { hair: "long", hairColor: BLACK, extras: ["earrings"], shirt: "#5f8f8a" },
  figgy: { hair: "curly", hairColor: PLUM, extras: ["scarf"], color: "#f4b942" },
  radish: { hair: "crop", hairColor: BLACK, extras: ["cap"], color: "#e85d4c" },
  plum: { hair: "bob", hairColor: PLUM, extras: ["blush"] },
  dill: { hair: "crop", hairColor: GINGER, extras: ["blush", "freckles"] },
  cocoa: { hair: "afro", hairColor: BROWN, extras: ["tired"] },
  nori: { hair: "bob", hairColor: PINK, extras: [], shirt: "#e76f8e" },
  pepper: { hair: "spiky", hairColor: AUBURN, extras: ["beanie"], color: "#3a3f44" },
  maple: { hair: "side", hairColor: GINGER, extras: ["headband"], color: "#e8e0d2" },
  tangerine: { hair: "long", hairColor: BROWN, extras: ["bow"], color: "#e85d4c" },
  bao: { hair: "crop", hairColor: BLACK, extras: ["pencil", "tired"] },
  ginger: { hair: "mohawk", hairColor: GINGER, extras: [] },
  kiwi: { hair: "crop", hairColor: BROWN, extras: ["cap"], color: "#2f7d5b" },
  sprout: { hair: "buns", hairColor: BROWN, extras: ["sprout"], drop: 7 },
  pesto: { hair: "long", hairColor: BROWN, extras: ["beret"], color: "#3a3f44" },
  rye: { hair: "none", hairColor: BROWN, extras: ["hood"], color: "#f2c14e" },
  honey: { hair: "afro", hairColor: BLONDE, extras: ["headphones"], color: "#f4b942" },
  tahini: { hair: "side", hairColor: BLACK, extras: ["glasses", "mustache"] },
  crouton: { hair: "curly", hairColor: BLONDE, extras: ["bandana"], color: "#3f6fb0" },
  pudding: { hair: "bun", hairColor: BLONDE, extras: [], shirt: "#f4b942" },
  lychee: { hair: "long", hairColor: BLACK, extras: ["sunhat"], color: "#f2d8a7" },
  oats: { hair: "mohawk", hairColor: TEAL, extras: ["earrings"] },
  chai: { hair: "bob", hairColor: BROWN, extras: ["scarf"], color: "#b0442f" },
  [CRITIC.name]: { hair: "side", hairColor: GREY, extras: ["glasses", "beret"], color: "#2b2320", shirt: "#3a3f44" },
};

/** @param {string} name */
export function nameHash(name) {
  let h = 2166136261;
  for (let index = 0; index < name.length; index++) {
    h ^= name.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A look for anyone: the cast's own, or one seeded from the name.
 * @param {string} name
 * @returns {Look}
 */
export function lookFor(name) {
  const known = LOOKS[name];
  if (known) return known;
  const h = nameHash(name);
  /** @type {Hair[]} */
  const styles = ["crop", "side", "bob", "long", "curly"];
  return { hair: styles[h % styles.length], hairColor: [BLACK, BROWN, GINGER, BLONDE][(h >>> 4) % 4], extras: [] };
}

// --- Layers -----------------------------------------------------------------------
// Each layer is a sparse map of row -> 12 characters, "." for nothing.

/** @typedef {Record<number, string>} Layer */

/** @type {string[]} */
const BASE = [
  "............",
  "............",
  "............",
  "...SSSSSS...",
  "..SSSSSSSS..",
  "..SSSSSSSS..",
  "..SSSSSSSS..",
  ".SSSSSSSSSS.",
  "..SSSSSSSS..",
  "..SSSSSSSS..",
  "...SSSSSS...",
  "....ssss....",
  "..CCCCCCCC..",
  ".CCCCCCCCCC.",
  ".CCCCCCCCCC.",
  "CCCCCCCCCCCC",
  "CCCCCCCCCCCC",
  "SCCCCCCCCCCS",
];

/** @type {Record<Hair, Layer>} */
const HAIR = {
  none: {},
  crop: { 2: "...HHHHHH...", 3: "..HHHHHHHH..", 4: "..HH....HH.." },
  side: { 2: "...HHHHHH...", 3: "..HHHHHHHH..", 4: "..HHHHH..H..", 5: "..H......H.." },
  bob: {
    2: "...HHHHHH...", 3: "..HHHHHHHH..", 4: ".HHHHHHHHHH.", 5: ".HH......HH.",
    6: ".H........H.", 7: ".H........H.", 8: ".H........H.", 9: ".HH......HH.",
  },
  long: {
    2: "...HHHHHH...", 3: "..HHHHHHHH..", 4: ".HHHH..HHHH.", 5: ".HH......HH.",
    6: ".H........H.", 7: ".H........H.", 8: ".H........H.", 9: ".H........H.",
    10: ".HH......HH.", 11: ".HH......HH.", 12: ".HH......HH.", 13: ".H........H.",
  },
  bun: { 0: ".....HH.....", 1: "....HHHH....", 2: "...HHHHHH...", 3: "..HHHHHHHH..", 4: "..HH....HH.." },
  buns: { 0: "..HH....HH..", 1: "..HHH..HHH..", 2: "...HHHHHH...", 3: "..HHHHHHHH..", 4: "..H......H.." },
  pigtails: {
    2: "...HHHHHH...", 3: "..HHHHHHHH..", 4: ".HHH....HHH.", 5: "HH........HH",
    6: "HH........HH", 7: "H..........H",
  },
  spiky: { 1: "...H.HH.H...", 2: "..HHHHHHHH..", 3: "..HHHHHHHH..", 4: "..H.H..H.H.." },
  mohawk: { 0: ".....HH.....", 1: ".....HH.....", 2: "....HHHH....", 3: "....HHHH...." },
  curly: {
    1: "...H.HH.H...", 2: "..HHHHHHHH..", 3: ".HHHHHHHHHH.", 4: ".HH.H..H.HH.",
    5: ".H........H.", 6: ".H........H.",
  },
  afro: {
    0: "...HHHHHH...", 1: "..HHHHHHHH..", 2: ".HHHHHHHHHH.", 3: ".HHHHHHHHHH.",
    4: ".HHH....HHH.", 5: ".HH......HH.", 6: ".H........H.",
  },
};

/** Extras that sit under the face (the face is drawn over them). */
const UNDER = new Set(["glasses"]);

/** @type {Record<Extra, Layer>} */
const EXTRAS = {
  glasses: { 5: "..GGG..GGG..", 6: "..LLLGGLLL..", 7: "..LLL..LLL.." },
  shades: { 2: "..wDD..wDD..", 3: "..DDDDDDDD.." },
  headphones: {
    1: "...AAAAAA...", 2: "..A......A..", 3: ".A........A.", 4: ".A........A.",
    5: ".A........A.", 6: "AA........AA", 7: "AA........AA", 8: "AA........AA",
  },
  beanie: { 0: ".....aa.....", 1: "...AAAAAA...", 2: "..AAAAAAAA..", 3: "..AAAAAAAA..", 4: "..aaaaaaaa.." },
  cap: { 1: "....AAAA....", 2: "..AAAAAAAA..", 3: "..AAAAAAAA..", 4: "..aaaaaaaaaa" },
  headband: { 4: "..AAAAAAAA.." },
  bandana: { 2: "...AAAAAA...", 3: "..AAAAAAAAa.", 4: "..aaaaaaaaAA", 5: "..........aA" },
  bow: { 1: ".......AA.AA", 2: ".......AAaAA", 3: ".......AA.AA" },
  flower: { 3: ".........P..", 4: "........PYP.", 5: ".........P.." },
  beret: { 0: ".....A......", 1: "...AAAAAA...", 2: "..AAAAAAAAA.", 3: ".AAAAAAAAAA." },
  phone: { 5: "..........DD", 6: "..........DD", 7: "..........DD", 8: "..........DD", 9: ".........SSS" },
  pencil: { 3: "..........P.", 4: "..........Y.", 5: "..........Y.", 6: "..........Y." },
  hood: {
    1: "....AAAA....", 2: "..AAAAAAAA..", 3: ".AAAAAAAAAA.", 4: ".AAa....aAA.",
    5: ".AA......AA.", 6: ".AA......AA.", 7: ".AA......AA.", 8: ".AA......AA.",
    9: ".AAA....AAA.", 10: "..AA....AA..", 11: "..AAAAAAAA..",
  },
  scarf: { 11: "...AAAAAA...", 12: "..AAAAAAAA..", 13: "...a........" },
  mustache: { 8: "....HHHH...." },
  freckles: { 8: "..f.f..f.f.." },
  earrings: { 8: ".Y........Y." },
  sprout: { 0: ".....aA.....", 1: "......A.....", 2: "......A....." },
  straw: { 10: ".......PP...", 11: ".........PP." },
  sunhat: { 0: "....AAAA....", 1: "...AAAAAA...", 2: "...aaaaaa...", 3: "AAAAAAAAAAAA" },
  tired: { 8: "...b....b..." },
  tie: { 12: "....wAAw....", 13: ".....AA....." },
  blush: { 8: "..R......R.." },
};

/** The features of each face: brows, eyes, cheeks and mouth. @type {Record<Face, Layer>} */
const FEATURES = {
  calm: { 6: "...E....E...", 7: "...E....E...", 9: ".....EE....." },
  blink: { 7: "...EE..EE...", 9: ".....EE....." },
  // Eyes up and to the side, at the clock; a bead of sweat at the temple.
  glance: { 5: "..W.........", 6: "....E....E..", 9: ".....EEE...." },
  // Then down, at a watch.
  glanceAlt: { 5: "..W.........", 7: "..E....E....", 9: "....EEE....." },
  cross: { 5: "..E......E..", 6: "...EE..EE...", 7: "...E....E...", 9: ".....EE.....", 10: "....E..E...." },
  storm: { 5: "..E......E..", 6: "...EE..EE...", 7: "...E....E...", 9: "....EEEE....", 10: "....E..E...." },
  // Handed the wrong tea: cross, and open-mouthed about it.
  sentBack: { 5: "..E......E..", 6: "...EE..EE...", 7: "...E....E...", 9: "....ETTE....", 10: "....EEEE...." },
  starry: {
    5: "...Y....Y...", 6: "..YYY..YYY..", 7: "...Y....Y...",
    8: "..R......R..", 9: "....ETTE....", 10: ".....EE.....",
  },
  wow: { 6: "...wE..wE...", 7: "...EE..EE...", 9: ".....EE.....", 10: ".....EE....." },
  content: {
    6: "...E....E...", 7: "..E.E..E.E..", 8: "..R......R..",
    9: "....E..E....", 10: ".....EE.....",
  },
  meh: { 7: "...EE..EE...", 9: "......EE...." },
  unimpressed: { 7: "...EE..EE...", 9: ".....EE.....", 10: "....E..E...." },
};

/** How far each face flushes the skin toward red. @type {Partial<Record<Face, number>>} */
const FLUSH = { cross: 0.22, storm: 0.42, sentBack: 0.36 };
const RED = "#e0604c";

/**
 * @param {string} hex
 * @param {string} toward
 * @param {number} t
 */
export function mixHex(hex, toward, t) {
  const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(toward.slice(i, i + 2), 16));
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * @param {string[]} rows
 * @param {Layer} layer
 */
function lay(rows, layer) {
  for (const [key, line] of Object.entries(layer)) {
    const y = Number(key);
    const row = [...rows[y]];
    [...line].forEach((cell, x) => {
      if (cell !== ".") row[x] = cell;
    });
    rows[y] = row.join("");
  }
}

/** Pads a grid by a cell and outlines every empty cell that touches the drawing. @param {string[]} rows */
export function outline(rows) {
  const width = rows[0].length + 2;
  const padded = [".".repeat(width), ...rows.map((row) => `.${row}.`), ".".repeat(width)];
  const filled = (/** @type {number} */ y, /** @type {number} */ x) => (padded[y]?.[x] ?? ".") !== ".";
  return padded.map((row, y) =>
    [...row]
      .map((cell, x) =>
        cell === "." && (filled(y - 1, x) || filled(y + 1, x) || filled(y, x - 1) || filled(y, x + 1)) ? "O" : cell,
      )
      .join(""),
  );
}

const grids = new Map();
const palettes = new Map();

/**
 * A guest's figure making a face: the grid (FIGURE_W by FIGURE_H, outlined)
 * and its palette. Cached, so it is built once per name and face.
 * @param {string} name
 * @param {Face} face
 * @returns {{ grid: string[], palette: Record<string, string> }}
 */
export function figure(name, face) {
  const key = `${name}|${face}`;
  let grid = grids.get(key);
  if (!grid) {
    const look = lookFor(name);
    const rows = [...BASE];
    lay(rows, HAIR[look.hair]);
    for (const extra of look.extras) if (UNDER.has(extra)) lay(rows, EXTRAS[extra]);
    lay(rows, FEATURES[face]);
    for (const extra of look.extras) if (!UNDER.has(extra)) lay(rows, EXTRAS[extra]);
    grid = outline(rows);
    grids.set(key, grid);
  }
  return { grid, palette: paletteFor(name, face) };
}

/**
 * @param {string} name
 * @param {Face} face
 */
function paletteFor(name, face) {
  const key = `${name}|${FLUSH[face] ?? 0}`;
  const cached = palettes.get(key);
  if (cached) return cached;
  const look = lookFor(name);
  const h = nameHash(name);
  const skin = mixHex(SKINS[h % SKINS.length], RED, FLUSH[face] ?? 0);
  const accent = look.color ?? SHIRTS[(h >>> 7) % SHIRTS.length];
  const palette = {
    S: skin,
    s: mixHex(skin, INK, 0.18),
    f: mixHex(skin, INK, 0.3),
    b: mixHex(skin, "#6b4f7a", 0.45),
    H: look.hairColor,
    C: look.shirt ?? SHIRTS[(h >>> 12) % SHIRTS.length],
    A: accent,
    a: mixHex(accent, INK, 0.3),
    E: INK,
    G: INK,
    L: "#d6ecf2",
    D: "#3a3f44",
    Y: "#f4c542",
    R: "#f0907e",
    T: "#a8323a",
    W: "#7fc4e8",
    P: "#ff5277",
    w: "#ffffff",
    O: INK,
  };
  palettes.set(key, palette);
  return palette;
}

/** Cells a look sits lower than everyone else: the one who can barely see over the counter. @param {string} name */
export function dropFor(name) {
  return lookFor(name).drop ?? 0;
}

// --- Emotes, the drink, and the tip jar -------------------------------------------------

/** Little marks over a guest's head. */
export const EMOTES = {
  /** A speech bubble with a clock in it: they're watching the time. */
  clock: {
    grid: [
      ".OOOOOOO.",
      "OwwwwwwwO",
      "OwwOOOwwO",
      "OwOwEwOwO",
      "OwOwEEOwO",
      "OwOwwwOwO",
      "OwwOOOwwO",
      "OwwwwwwwO",
      ".OOwOOOO.",
      "...OO....",
    ],
    palette: { O: INK, w: "#fdf8f3", E: "#e85d4c" },
  },
  /** The cross mark of a temper. */
  anger: {
    grid: [".R.R.", "RR.RR", ".....", "RR.RR", ".R.R."],
    palette: { R: "#e0473a" },
  },
  heart: {
    grid: [".OO.OO.", "ORROwRO", "ORRRRRO", ".ORRRO.", "..ORO..", "...O..."],
    palette: { O: INK, R: "#e85d6c", w: "#ffffff" },
  },
  star: {
    grid: ["...O...", "..OYO..", "OOOYOOO", ".OYYYO.", "..OYO..", ".OO.OO."],
    palette: { O: INK, Y: "#f4c542" },
  },
  /** A puff of steam for someone storming out. */
  puff: {
    grid: [".www.", "wwwww", "wwwww", ".www."],
    palette: { w: "#f3ece4" },
  },
  /** A drop of sweat for an unimpressed shrug. */
  drop: {
    grid: [".O.", "OWO", "OWO", ".O."],
    palette: { O: INK, W: "#7fc4e8" },
  },
};

/** The drink a served guest carries off, held up in front of them. */
export const TAKEAWAY = {
  grid: [
    "....P.",
    "...P..",
    "OOOOOO",
    "OLLLLO",
    "OTTTTO",
    ".OTTO.",
    ".OOOO.",
  ],
  palette: { O: INK, P: "#ff5277", L: "#ece3d6" },
};

/** A coin in flight to the tip jar. */
export const COIN = {
  grid: [".OO.", "OYyO", "OyYO", ".OO."],
  palette: { O: "#704a05", Y: "#f4c542", y: "#fbe08a" },
};

/** The tip jar: glass, a cork lid, and a paper label; coins fill from the bottom. */
export const JAR = {
  /** Inside the glass: columns and rows the coins fill, bottom up. */
  inside: { left: 1, width: 7, top: 3, rows: 8 },
  grid: [
    "..KKKKK..",
    "..OOOOO..",
    ".O.....O.",
    "O.......O",
    "O.......O",
    "O.......O",
    "O.......O",
    "O.......O",
    "O.......O",
    "O.......O",
    "O.......O",
    ".OOOOOOO.",
  ],
  palette: { O: INK, K: "#a8784c" },
};
export const JAR_W = 9;
export const JAR_H = 12;

/** Everyone who can come in: the regulars and the critic. */
export const CAST = [...REGULARS.map((regular) => regular.name), CRITIC.name];
