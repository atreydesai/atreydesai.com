/**
 * Pixel signs for the upgrade trees' nodes, drawn on the kitchen icons' 16 by
 * 16 grid in their ink: the Workshop's bench, the parts it makes and the
 * fixtures and kits they build. Each is the thing itself, side on, in brass,
 * steel and glass, so a tree reads as a set of real parts.
 */
import { INK, type Grid, type Sprite } from "./icons.ts";

const METAL = {
  O: INK,
  S: "#8f9aa0", // steel
  s: "#646d73",
  L: "#d3dadd",
  B: "#d29a3c", // brass
  b: "#9c6a2a",
  Y: "#f1d07e",
  K: "#2f2526", // gasket, rubber
  R: "#c9462f", // red paint
  r: "#8e2f22",
  W: "#a8763f", // wood
  w: "#76512c",
  G: "#a9d6dc", // glass
  g: "#6aa4ae",
  A: "#5b8fc6", // water
  a: "#3d6d9e",
  C: "#f6e6c2", // paper, cup
};

const ART: Record<string, Grid> = {
  // A small vise bolted to a workbench.
  "brew-bench": [
    "................",
    "................",
    "...OOOO..OOOO...",
    "...OSLO..OLSO...",
    "...OSSOOOOSSO...",
    "..OSSSSSSSSSSO..",
    "..OsssssssssSO..",
    "...OOOsSSOOOO...",
    ".....OsSO.OOOO..",
    ".....OsSOOOLLO..",
    ".OOOOOOOOOOOOOO.",
    ".OWWWWWWWWWWWWO.",
    ".OwwwwwwwwwwwwO.",
    "..OwO......OwO..",
    "..OwO......OwO..",
    "..OOO......OOO..",
  ],
  // A brass connector with a dark gasket.
  "brew-coupling": [
    "................",
    "................",
    "................",
    "................",
    ".....OOOOOO.....",
    "....OBYYYYBO....",
    "OOOOBYBKKBYBOOOO",
    "LLLLBBBKKBBBLLLL",
    "SSSSBBBKKBBBSSSS",
    "ssssbBBKKBBbssss",
    "OOOObbbKKbbbOOOO",
    "....ObbbbbbO....",
    ".....OOOOOO.....",
    "................",
    "................",
    "................",
  ],
  // A short pipe with a red valve wheel.
  "brew-valve": [
    "................",
    "...OOOOOOOOO....",
    "..ORRRRRRRRRO...",
    "..ORrOOROOrRO...",
    "..ORRRRRRRRRO...",
    "...OOOOSOOOO....",
    "......OSO.......",
    ".....OOSOO......",
    "....OBBYBBO.....",
    "OOOOBYBBBBBOOOOO",
    "LLLLBBBBBBBOLLLL",
    "SSSSBBBBBBbOSSSS",
    "ssssbBBBBbbOssss",
    "OOOObbbbbbbOOOOO",
    "....OOOOOOO.....",
    "................",
  ],
  // A circular pump head with three impeller blades.
  "brew-pump-head": [
    "................",
    ".....OOOOOO.....",
    "...OOSSSSSSOO...",
    "..OSSLLSSSSSSO..",
    "..OSLOOSSSOSSO..",
    ".OSSSOBOSSOBSSO.",
    ".OSSSSOBOOBOSSO.",
    ".OSSSSSOKKOSSSO.",
    ".OSSSSSOKKOSSSO.",
    ".OSSSSOBOOBOSsO.",
    ".OSSSOBOSSOBSsO.",
    "..OSSOOSSSSOSsO.",
    "..OsSSSSSSSSsO..",
    "...OOssssssOO...",
    ".....OOOOOO.....",
    "................",
  ],
  // A raised water tank with a sight glass.
  "brew-reservoir": [
    "....OOOOOOOO....",
    "...OSLLLLLLSO...",
    "...OSSSSSSSSO...",
    "...OSSOGGOSSO...",
    "...OSSOGgOSSO...",
    "...OSSOAAOSSO...",
    "...OSSOAaOSSO...",
    "...OsSOAAOSsO...",
    "...OssOOOOssO...",
    "....OOOOOOOO....",
    "....OsO..OsO....",
    "....OsO..OsO....",
    "....OsOOOOsO....",
    "....OsO..OsO....",
    "...OOOO..OOOO...",
    "................",
  ],
  // A horizontal brass header with three outlets.
  "brew-manifold": [
    "................",
    "................",
    "................",
    ".OOOOOOOOOOOOOO.",
    "OBYYYYYYYYYYYYBO",
    "OBBBBBBBBBBBBBBO",
    "ObbbbbbbbbbbbbbO",
    ".OOObOOOObOOObO.",
    "...ObO..ObO.ObO.",
    "...ObO..ObO.ObO.",
    "..OSSSO.OSSSOSO.",
    "..OsSsO.OsSsOsO.",
    "...OAO...OAO.O..",
    "....A.....A..A..",
    "....A.....A..A..",
    "................",
  ],
  // A narrow brew head beside a pressure dial.
  "brew-precision": [
    "................",
    ".........OOOOO..",
    "...OOO..OCCCCCO.",
    "..OSSSO.OCROCCO.",
    "..OSLSO.OCCRCCO.",
    "..OSSSO.OCCCCCO.",
    "..OSSSO..OOOOO..",
    "..OSSSO....OsO..",
    "..OSSSOOOOOOsO..",
    "..OsSsOSSSSSsO..",
    "...OsOOOOOOOO...",
    "...OKO..........",
    "....A...........",
    "....A...........",
    "...OOO..........",
    "..OCCCO.........",
  ],
  // An elevated glass bottle feeding a spout.
  "brew-gravity": [
    "......OOO.......",
    ".....OGGGO......",
    "....OGLGGGO.....",
    "....OGAAAGO.....",
    "....OAAAAaO.....",
    "....OAAAAaO.....",
    ".....OAAaO......",
    "......OaO.......",
    ".....OSSSO......",
    ".....OSLSOOOOO..",
    ".....OSSSSSSSSO.",
    ".....OOOOOOOOsO.",
    "............OO..",
    "............A...",
    "...........OOO..",
    "..........OCCCO.",
  ],
};

// --- Drawn from a few shared shapes -----------------------------------------------

const PALETTE = {
  ...METAL,
  V: "#7d9a5c", // leaf
  v: "#4f6b3f",
  P: "#f2a774", // peach
  p: "#c46e45",
  N: "#5f7fa6", // apron
  n: "#3e5878",
  T: "#b98a57", // tea stain, cardboard
  t: "#8a6238",
  H: "#e8b04a", // honey, sign
  D: "#3a3133", // dark paint
};

interface Pen {
  /** A filled rectangle outlined in ink. */
  box(x: number, y: number, w: number, h: number, c: string): void;
  rect(x: number, y: number, w: number, h: number, c: string): void;
  px(x: number, y: number, c: string): void;
}

function paint(draw: (d: Pen) => void): Grid {
  const g = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => "."));
  const px = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = c;
  };
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
  };
  const box = (x: number, y: number, w: number, h: number, c: string) => {
    rect(x, y, w, h, "O");
    rect(x + 1, y + 1, w - 2, h - 2, c);
  };
  draw({ box, rect, px });
  return g.map((r) => r.join(""));
}

/** A card with ruled lines, a corner to put a mark on. */
const card = (d: Pen, x: number, y: number, w = 9, h = 11) => {
  d.box(x, y, w, h, "C");
  for (let j = y + 3; j < y + h - 2; j += 2) d.rect(x + 2, j, w - 4, 1, "T");
};
/** An apron on a hook, its badge drawn by the caller at (7..9, 8..10). */
const apron = (d: Pen) => {
  d.rect(6, 1, 4, 1, "O");
  d.px(5, 2, "O");
  d.px(10, 2, "O");
  d.rect(5, 3, 6, 1, "O");
  d.box(4, 3, 8, 12, "N");
  d.rect(4, 7, 1, 1, "O");
  d.rect(11, 7, 1, 1, "O");
  d.rect(5, 12, 6, 1, "n");
};
/** A floor plan on cream paper with its walls in ink. */
const plan = (d: Pen) => {
  d.box(1, 2, 14, 12, "C");
  d.rect(3, 4, 10, 1, "D");
  d.rect(3, 4, 1, 8, "D");
  d.rect(12, 4, 1, 8, "D");
  d.rect(3, 11, 4, 1, "D");
  d.rect(9, 11, 4, 1, "D");
};
/** A calendar page with its red top and two rings. */
const calendar = (d: Pen) => {
  d.box(2, 2, 12, 13, "C");
  d.rect(3, 3, 10, 3, "R");
  d.px(5, 1, "O");
  d.px(10, 1, "O");
  d.px(5, 2, "S");
  d.px(10, 2, "S");
};
/** A slatted wooden crate. */
const crate = (d: Pen, x = 2, y = 6, w = 12, h = 8) => {
  d.box(x, y, w, h, "W");
  for (let j = y + 2; j < y + h - 1; j += 2) d.rect(x + 1, j, w - 2, 1, "w");
};
/** A tea tin. */
const tin = (d: Pen, x: number, y: number, c = "R") => {
  d.box(x, y, 6, 2, "S");
  d.box(x, y + 1, 6, 8, c);
  d.rect(x + 1, y + 4, 4, 2, "C");
};
const cup = (d: Pen, x: number, y: number, c = "C") => {
  d.box(x, y, 4, 5, c);
  d.px(x + 1, y - 1, "O");
};
const clock = (d: Pen, x: number, y: number) => {
  d.box(x, y, 6, 6, "C");
  d.px(x + 3, y + 2, "O");
  d.px(x + 3, y + 3, "O");
  d.px(x + 4, y + 3, "R");
};
const leaf = (d: Pen, x: number, y: number) => {
  d.px(x, y, "V");
  d.px(x + 1, y, "V");
  d.px(x + 1, y - 1, "v");
};

const DRAWN: Record<string, Grid> = {
  "machine-garden-calibration": paint((d) => {
    d.box(1, 2, 8, 8, "C");
    d.px(4, 5, "O");
    d.px(5, 4, "R");
    d.px(6, 3, "R");
    card(d, 8, 5, 7, 10);
    d.box(10, 8, 3, 3, "P");
  }),
  "prep-batch-pot": paint((d) => {
    d.box(1, 6, 12, 7, "S");
    d.rect(2, 7, 10, 1, "L");
    d.px(0, 8, "O");
    d.px(13, 8, "O");
    d.box(11, 2, 5, 4, "H");
    d.px(12, 6, "O");
  }),
  "prep-hold-bath": paint((d) => {
    d.box(0, 8, 16, 7, "A");
    d.rect(1, 9, 14, 1, "G");
    d.box(3, 4, 10, 7, "S");
    d.rect(4, 5, 8, 1, "L");
  }),
  "prep-portion-tray": paint((d) => {
    d.box(0, 9, 16, 4, "W");
    for (const [i, c] of ["P", "V", "H", "C"].entries()) cup(d, 1 + i * 4 - (i ? 0 : 0), 5, c);
  }),
  "build-dosing-rail": paint((d) => {
    d.rect(1, 2, 14, 2, "S");
    d.rect(1, 2, 14, 1, "L");
    d.box(3, 4, 4, 8, "G");
    d.box(9, 4, 4, 8, "H");
    d.px(4, 12, "O");
    d.px(10, 12, "O");
  }),
  "build-fixed-doser": paint((d) => {
    d.box(1, 1, 14, 4, "S");
    d.box(3, 5, 3, 3, "s");
    d.box(10, 5, 3, 3, "s");
    d.px(4, 8, "A");
    d.px(11, 8, "A");
    cup(d, 2, 10);
    cup(d, 9, 10);
  }),
  "build-flex-nozzle": paint((d) => {
    d.box(1, 1, 6, 3, "S");
    d.rect(6, 2, 5, 1, "O");
    d.box(9, 3, 3, 4, "s");
    d.px(10, 7, "A");
    cup(d, 8, 9);
    d.px(9, 11, "R");
    d.px(10, 11, "R");
  }),
  "serve-handoff-rack": paint((d) => {
    d.box(0, 4, 16, 10, "W");
    for (let i = 0; i < 3; i++) {
      d.box(1 + i * 5, 6, 4, 6, "D");
      cup(d, 1 + i * 5, 7, "C");
    }
  }),
  "serve-locker-bank": paint((d) => {
    d.box(1, 1, 14, 14, "S");
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      d.box(2 + i * 6, 2 + j * 6, 6, 6, "L");
      d.px(6 + i * 6, 5 + j * 6, "O");
    }
  }),
  "serve-finish-bench": paint((d) => {
    cup(d, 2, 5, "C");
    d.px(3, 4, "V");
    d.box(7, 10, 8, 4, "W");
    d.px(8, 9, "V");
    d.px(10, 9, "P");
    d.px(12, 9, "R");
    d.rect(0, 14, 16, 1, "w");
  }),
  "front-greeting-post": paint((d) => {
    d.box(4, 2, 8, 4, "W");
    d.rect(5, 3, 6, 1, "C");
    d.box(7, 6, 2, 7, "w");
    d.box(4, 13, 8, 2, "W");
  }),
  "front-express-rail": paint((d) => {
    d.box(3, 0, 10, 4, "H");
    d.rect(5, 1, 6, 1, "O");
    d.px(4, 4, "O");
    d.px(11, 4, "O");
    d.rect(0, 10, 16, 1, "S");
    d.box(1, 9, 2, 6, "s");
    d.box(13, 9, 2, 6, "s");
  }),
  "front-host-stand": paint((d) => {
    d.box(3, 5, 10, 10, "W");
    d.box(2, 3, 12, 3, "w");
    d.box(5, 1, 7, 4, "C");
    d.rect(6, 2, 5, 1, "R");
  }),
  "back-service-rack": paint((d) => {
    d.box(1, 1, 2, 14, "S");
    d.box(13, 1, 2, 14, "S");
    d.rect(1, 5, 14, 1, "O");
    d.rect(1, 10, 14, 1, "O");
    d.px(7, 11, "s");
    d.px(7, 12, "s");
    d.px(6, 13, "s");
    d.px(8, 13, "s");
  }),
  "back-spares-bin": paint((d) => {
    d.box(1, 7, 14, 8, "R");
    d.rect(2, 8, 12, 1, "r");
    d.box(3, 4, 4, 4, "K");
    d.box(8, 3, 4, 4, "B");
    d.px(10, 5, "O");
  }),
  "back-wash-station": paint((d) => {
    d.box(0, 8, 16, 7, "S");
    d.box(2, 9, 12, 3, "A");
    d.box(10, 1, 2, 7, "s");
    d.rect(6, 1, 5, 1, "s");
    d.px(6, 2, "A");
    cup(d, 4, 4, "C");
  }),
  "furniture-fit-kit": paint((d) => {
    d.box(1, 2, 3, 12, "W");
    d.box(1, 2, 10, 3, "W");
    d.box(7, 7, 8, 7, "H");
    d.box(9, 9, 4, 3, "D");
    d.rect(12, 13, 3, 1, "H");
  }),
  "furniture-communal": paint((d) => {
    d.box(0, 3, 8, 3, "W");
    d.box(8, 3, 8, 3, "W");
    d.box(1, 6, 2, 5, "w");
    d.box(13, 6, 2, 5, "w");
    d.box(0, 11, 16, 2, "t");
  }),
  "furniture-foldaway": paint((d) => {
    d.box(12, 0, 3, 16, "D");
    d.box(8, 2, 4, 12, "W");
    d.rect(9, 4, 2, 1, "w");
    d.px(11, 8, "S");
  }),
  "furniture-acoustic": paint((d) => {
    for (let i = 0; i < 5; i++) d.box(1 + i * 3, 1, 3, 12, i % 2 ? "W" : "w");
    d.box(2, 13, 2, 2, "D");
    d.box(12, 13, 2, 2, "D");
  }),
  "decor-display-rails": paint((d) => {
    d.rect(0, 3, 16, 2, "B");
    d.rect(0, 4, 16, 1, "b");
    d.px(4, 5, "O");
    d.px(4, 6, "O");
    d.px(5, 7, "O");
    d.px(11, 5, "O");
    d.px(11, 6, "O");
    d.px(12, 7, "O");
  }),
  "decor-menu-window": paint((d) => {
    d.box(6, 0, 10, 12, "G");
    d.rect(10, 1, 1, 10, "O");
    d.box(0, 5, 7, 7, "C");
    d.rect(1, 7, 5, 1, "T");
    d.rect(1, 9, 5, 1, "T");
    d.box(2, 12, 3, 3, "W");
  }),
  "decor-regular-shelf": paint((d) => {
    d.rect(0, 11, 16, 2, "W");
    d.rect(0, 12, 16, 1, "w");
    d.box(2, 4, 5, 7, "C");
    d.rect(3, 6, 3, 2, "A");
    d.box(8, 5, 6, 6, "P");
    d.rect(9, 7, 4, 1, "C");
  }),
  "guest-check-in": paint((d) => {
    d.box(1, 0, 12, 7, "C");
    d.px(4, 7, "O");
    d.px(4, 8, "O");
    d.rect(3, 2, 2, 2, "O");
    d.rect(6, 2, 2, 2, "O");
    d.rect(9, 2, 2, 2, "O");
    d.box(5, 9, 10, 6, "H");
    d.rect(8, 11, 4, 2, "O");
  }),
  "guest-usual-notes": paint((d) => {
    card(d, 1, 2, 9, 12);
    d.box(11, 3, 2, 10, "H");
    d.px(11, 13, "O");
    d.px(12, 14, "D");
    cup(d, 11, 10, "P");
  }),
  "guest-wait-estimate": paint((d) => {
    card(d, 1, 4, 7, 10);
    clock(d, 9, 2);
    d.rect(3, 6, 3, 1, "R");
  }),
  "guest-garden-offer": paint((d) => {
    d.box(0, 11, 16, 2, "W");
    d.box(1, 7, 7, 4, "P");
    d.rect(2, 8, 5, 1, "p");
    cup(d, 8, 5, "V");
    d.px(10, 3, "V");
  }),
  "crew-shadow": paint((d) => {
    d.rect(0, 1, 16, 1, "W");
    d.px(4, 2, "O");
    d.px(11, 2, "O");
    d.box(1, 3, 6, 11, "N");
    d.box(9, 3, 6, 11, "V");
  }),
  "crew-station-lead": paint((d) => {
    apron(d);
    d.box(6, 7, 4, 4, "R");
    d.px(8, 6, "O");
  }),
  "crew-floater": paint((d) => {
    apron(d);
    d.px(1, 9, "H");
    d.px(2, 8, "H");
    d.px(2, 10, "H");
    d.px(14, 9, "H");
    d.px(13, 8, "H");
    d.px(13, 10, "H");
  }),
  "crew-garden-service": paint((d) => {
    apron(d);
    d.box(6, 7, 3, 3, "P");
    leaf(d, 8, 7);
  }),
  "crew-hospitality": paint((d) => {
    apron(d);
    d.box(6, 6, 5, 6, "C");
    d.rect(7, 6, 3, 1, "S");
    d.rect(7, 8, 3, 1, "T");
    d.rect(7, 10, 3, 1, "T");
  }),
  "tea-lot-label": paint((d) => {
    tin(d, 2, 3);
    d.rect(8, 4, 3, 1, "O");
    d.box(10, 5, 5, 6, "C");
    d.px(12, 6, "O");
    d.rect(11, 8, 3, 1, "T");
  }),
  "tea-garden-oolong": paint((d) => {
    d.box(3, 9, 9, 6, "p");
    d.rect(4, 10, 7, 1, "P");
    d.rect(7, 3, 1, 6, "v");
    leaf(d, 8, 4);
    leaf(d, 5, 6);
    leaf(d, 8, 7);
    d.box(11, 2, 4, 4, "C");
    d.px(10, 4, "O");
  }),
  "tea-service-lot": paint((d) => {
    tin(d, 1, 2, "V");
    d.box(8, 9, 7, 4, "S");
    d.rect(9, 10, 5, 1, "t");
    d.rect(14, 12, 2, 1, "O");
    d.px(7, 8, "t");
  }),
  "menu-base-card": paint((d) => {
    card(d, 3, 2, 10, 12);
    d.box(8, 9, 4, 4, "T");
    d.rect(9, 10, 2, 2, "C");
  }),
  "menu-garden-oolong": paint((d) => {
    d.box(0, 6, 5, 8, "G");
    d.rect(1, 9, 3, 4, "P");
    d.box(5, 6, 5, 8, "G");
    d.rect(6, 9, 3, 4, "V");
    card(d, 10, 3, 6, 11);
    d.px(12, 6, "R");
  }),
  "menu-batch-base": paint((d) => {
    d.box(5, 0, 6, 7, "G");
    d.rect(6, 3, 4, 3, "T");
    d.px(11, 2, "O");
    for (let i = 0; i < 3; i++) cup(d, 1 + i * 5, 10, "T");
  }),
  "menu-tasting-card": paint((d) => {
    cup(d, 1, 8, "T");
    card(d, 6, 2, 9, 12);
    d.px(8, 5, "R");
    d.px(9, 6, "R");
  }),
  "menu-swap-card": paint((d) => {
    card(d, 2, 3, 10, 11);
    d.box(11, 4, 4, 4, "P");
    d.box(11, 9, 4, 4, "V");
  }),
  "pantry-shelf-labels": paint((d) => {
    crate(d, 1, 5, 14, 9);
    d.box(5, 2, 6, 5, "C");
    d.rect(6, 4, 4, 1, "R");
  }),
  "pantry-night-freight": paint((d) => {
    crate(d, 1, 4, 14, 10);
    d.rect(5, 4, 1, 10, "D");
    d.rect(10, 4, 1, 10, "D");
    d.box(6, 6, 4, 4, "C");
    d.px(7, 7, "D");
    d.px(8, 8, "D");
  }),
  "pantry-orchard-crate": paint((d) => {
    crate(d, 1, 6, 14, 8);
    d.box(3, 3, 4, 4, "P");
    d.box(8, 3, 4, 4, "P");
    leaf(d, 12, 4);
  }),
  "pantry-market-call": paint((d) => {
    d.box(1, 4, 8, 11, "T");
    d.rect(2, 5, 6, 1, "t");
    d.px(3, 3, "V");
    d.px(5, 2, "V");
    d.box(10, 2, 5, 9, "D");
    d.rect(11, 3, 3, 5, "G");
  }),
  "room-survey": paint((d) => {
    plan(d);
    d.rect(12, 2, 1, 1, "H");
    d.box(11, 0, 3, 7, "H");
    d.px(12, 7, "O");
  }),
  "room-garden-feature": paint((d) => {
    d.box(0, 1, 10, 13, "G");
    d.rect(5, 2, 1, 11, "O");
    d.px(2, 10, "V");
    d.px(3, 9, "V");
    d.px(7, 10, "V");
    d.box(9, 6, 7, 9, "C");
    d.px(11, 8, "P");
    d.rect(11, 10, 3, 1, "T");
  }),
  "room-throughput": paint((d) => {
    plan(d);
    d.rect(5, 6, 6, 2, "W");
    d.rect(5, 9, 6, 1, "R");
  }),
  "room-lounge": paint((d) => {
    plan(d);
    d.rect(4, 6, 3, 4, "p");
    d.rect(8, 7, 3, 2, "W");
  }),
  "room-utility": paint((d) => {
    plan(d);
    d.rect(4, 5, 2, 6, "S");
    d.rect(7, 11, 2, 1, "R");
  }),
  "promo-local-board": paint((d) => {
    d.box(3, 1, 10, 10, "D");
    d.box(5, 3, 6, 6, "C");
    d.rect(4, 11, 1, 4, "W");
    d.rect(11, 11, 1, 4, "W");
  }),
  "promo-radio-window": paint((d) => {
    d.box(0, 5, 10, 8, "R");
    d.box(1, 7, 4, 4, "D");
    d.rect(6, 7, 3, 1, "C");
    d.rect(3, 3, 1, 2, "S");
    clock(d, 10, 4);
  }),
  "promo-loyalty-stamp": paint((d) => {
    d.box(0, 3, 16, 10, "C");
    for (let i = 0; i < 4; i++) d.box(1 + i * 4 - (i ? 0 : 0), 6, 3, 3, i === 0 ? "R" : "C");
  }),
  "promo-tasting-flight": paint((d) => {
    d.box(1, 1, 14, 14, "C");
    for (let i = 0; i < 3; i++) cup(d, 2 + i * 4, 6, ["T", "P", "V"][i]);
  }),
  "contract-board": paint((d) => {
    d.box(2, 2, 12, 13, "W");
    d.box(5, 1, 6, 3, "S");
    card(d, 4, 4, 8, 10);
  }),
  "contract-bulk-route": paint((d) => {
    d.box(0, 6, 13, 7, "S");
    d.rect(1, 7, 11, 1, "L");
    d.rect(4, 8, 5, 1, "R");
    d.box(11, 2, 5, 5, "C");
    d.px(12, 7, "O");
  }),
  "contract-tasting-panel": paint((d) => {
    d.box(0, 10, 16, 4, "W");
    for (let i = 0; i < 3; i++) {
      cup(d, 1 + i * 5, 5, "T");
      d.px(2 + i * 5, 3, i === 0 ? "V" : i === 1 ? "H" : "R");
    }
  }),
  "contract-neighbor-supply": paint((d) => {
    d.box(0, 4, 5, 10, "R");
    d.box(11, 4, 5, 10, "A");
    d.rect(1, 3, 3, 1, "O");
    d.rect(12, 3, 3, 1, "O");
    d.box(5, 7, 6, 5, "C");
    d.rect(6, 9, 4, 1, "T");
  }),
  "event-forecast": paint((d) => {
    calendar(d);
    d.box(6, 8, 6, 5, "A");
    d.px(8, 7, "H");
    d.px(9, 7, "H");
  }),
  "event-outage-plan": paint((d) => {
    d.box(1, 5, 6, 6, "D");
    d.rect(2, 3, 1, 2, "D");
    d.rect(5, 3, 1, 2, "D");
    d.rect(3, 11, 2, 4, "D");
    d.box(9, 1, 6, 9, "G");
    d.rect(10, 5, 4, 4, "A");
    d.rect(11, 10, 2, 5, "S");
  }),
  "event-rush-plan": paint((d) => {
    calendar(d);
    for (let i = 0; i < 4; i++) d.rect(4 + i * 2, 9, 1, 4, "N");
  }),
  "event-quiet-plan": paint((d) => {
    calendar(d);
    d.box(4, 8, 4, 5, "C");
    d.box(8, 8, 4, 5, "C");
  }),
};

export function upgradeSprite(id: string): Sprite | null {
  if (ART[id]) return { grid: ART[id], palette: METAL };
  return DRAWN[id] ? { grid: DRAWN[id], palette: PALETTE } : null;
}

export const UPGRADE_ICON_IDS = [...Object.keys(ART), ...Object.keys(DRAWN)];
