<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  import {
    setMusicPaused,
    setMusicPhase,
    setRunGlide,
    sfxBlip,
    sfxCountdown,
    sfxRunBounce,
    sfxRunBump,
    sfxRunDeliver,
    sfxRunFall,
    sfxRunJump,
    sfxRunLand,
    sfxRunPearl,
    sfxRunSlide,
    sfxRunSmash,
    sfxRunSpill,
    sfxRushEnd,
    sfxRushStart,
    sfxStart,
    startMusic,
    stopMusic,
  } from "$lib/sfx";
  import { COUNTDOWN_SECONDS, stepCountdown } from "$lib/arcade/countdown.js";
  import {
    RESPAWN_GRACE,
    RUSH_TIME,
    START_LIVES,
    STEP,
    SUGAR_FULL,
    breakdown,
    cableY,
    comboMultiplier,
    createRng,
    newRun,
    pigeonPosition,
    respawnPoint,
    speedAt,
    step as stepRun,
  } from "$lib/arcade/runner-engine.js";
  import {
    DRINKS,
    INK,
    LID,
    MENU_ICONS,
    PEARL,
    SPRITE_PAD,
    STRAW_PINK,
    arcadeFont,
    cachedSprite,
    clearSpriteCache,
    fitCanvas,
  } from "$lib/arcade/art";
  import { firstVisit } from "$lib/arcade/scores";
  import { arcadeExits, concludeRun, createTimers, isOnControl, mountShell } from "$lib/arcade/shell";
  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import Countdown from "./Countdown.svelte";
  import CupTimer from "./CupTimer.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import Pearls from "./Pearls.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";

  // Sugar rush: a delivery cup of milk tea on legs runs the rooftops from dusk
  // into the night. The tea in the cup is its health and its pay. Every rule
  // lives in runner-engine.js; this file steps it at 120 Hz, paints the city
  // around it, and answers each event with a sound and a mark.

  const { exit, toMenu } = arcadeExits(createEventDispatcher<{ close: null; menu: null }>());

  type RunState = ReturnType<typeof newRun>;
  type Roof = RunState["chunks"][number]["roofs"][number];
  type Held = { jump: boolean; down: boolean; rush: boolean };
  type Mode = "countdown" | "running" | "over";
  type TeachKind = "slide" | "glide" | "rush";

  // --- Scale and timing ------------------------------------------------------

  /** World units per sprite cell. */
  const CELL = 2;
  /** The screen-space art cell, in CSS px. */
  const SC = 4;
  /** Distance run, in world units, by which dusk has become full night. */
  const NIGHT_AT = 15000;
  /** Colour steps for the sky and skylines, and for the roofs. */
  const SKY_STEPS = 40;
  const ROOF_STEPS = 10;
  /** Seconds of course always in view ahead of the runner. */
  const LOOK_AHEAD = 1.1;
  /** World units of street the camera may show under the sidewalk. */
  const STREET_SHOW = 16;
  /** The foreground hedge's top, in world y: a fall disappears behind it. */
  const HEDGE_TOP = 3;
  const OVER_SECONDS = 1.4;
  const TEACH_SECONDS = 2.4;
  const MAX_BITS = 420;

  // --- Palette ---------------------------------------------------------------
  // The city is painted the same in both site themes; only the HTML on top
  // follows the theme.

  const HALO = "rgba(253, 248, 243, 0.8)";
  const CREAM = "#fdf8f3";
  const TEA = "#c79a6b";
  const EMPTY_CUP = "#f6eee2";
  const ACCENT = "#e85d4c";
  const NOTE_BACK = "#141a2e";
  const NOTE_GOLD = "#ffd166";
  const NOTE_DIM = "#b9b3c9";
  const SKY_DUSK = ["#2a2748", "#5a3a6a", "#b85a5a", "#e8915a", "#f4c27a"];
  const SKY_TWILIGHT = ["#1d1f3d", "#2a2748", "#4a3462", "#7a4262", "#a8545e"];
  const SKY_NIGHT = ["#141a2e", "#1a2040", "#1f2547", "#2c2a52", "#3b2a52"];
  const SKY_STOPS = [0, 0.24, 0.48, 0.7, 0.9];
  const SUN = "#fde9b8";
  const SUN_RIM = "#f9d29a";
  const MOON = "#f3ead9";
  const MOON_SHADE = "#cfc6ba";
  const WINDOW_LIT = "#f4c27a";
  const WINDOW_WARM = "#e8915a";
  const WALL_NIGHT = "#1c1d38";
  const COPING = "#efe6d6";
  const COPING_SHADE = "#b9ab98";
  const COPING_NIGHT = "#bdb8d0";
  const GLASS = "#2b2440";
  const GLASS_DUSK = "#7a4a6a";
  const STREET = { walk: "#8a8296", curb: "#c8c0d0", road: "#2b2440", dash: "#c8c0d0" };
  const HEDGE = ["#1a2a2a", "#10161e"];
  const STEAM = "#ece6f2";
  const DUST = ["#efe6d6", "#d8ccba", "#b9ab98"];
  const FEATHERS = ["#e3e6ec", "#9aa0ad"];
  const SPARKS = ["#fff3c4", "#ffd166"];
  const PLANKS = ["#c08a52", "#8a5a3c"];

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((value) => (value + 0.5) / 16);
  const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

  // --- Copy ------------------------------------------------------------------

  const TEACH_TEXT: Record<TeachKind, string> = {
    slide: "slide under it",
    glide: "hold jump to glide",
    rush: "rush",
  };
  const TEACH_KEYS: Record<TeachKind, string> = {
    slide: "boba_teach_runner_slide",
    glide: "boba_teach_runner_glide",
    rush: "boba_teach_runner_rush",
  };

  // --- Small helpers -----------------------------------------------------------

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const clamp = (value: number, low: number, high: number) => (value < low ? low : value > high ? high : value);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const snap = (value: number) => Math.round(value / SC) * SC;
  const quarters = (t: number) => Math.ceil(clamp(t, 0, 1) * 4) / 4;
  /** A stable 0–1 value per integer, so seeded marks never shimmer. */
  const ihash = (n: number) => {
    let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const hash2 = (a: number, b: number) => ihash(Math.imul(a, 73856093) ^ Math.imul(b, 19349663));
  const rgb = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const mixRgb = (a: number[], b: number[], t: number) => a.map((value, index) => Math.round(lerp(value, b[index], t)));
  const toHex = (color: number[]) => `#${color.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  const mixHex = (a: string, b: string, t: number) => toHex(mixRgb(rgb(a), rgb(b), clamp(t, 0, 1)));

  // --- The runner's sprite ------------------------------------------------------
  //
  // One cell is two world units. The bottom row is the feet, at runner.y. Tea
  // cells are numbered in the order they fill (1 at the bottom); a frame is
  // built for a tea level by turning cells at or under it to tea and the rest
  // to the empty cup, so the cup drains as the HUD's does. The surface row's
  // numbering leans one way or the other with the slosh.

  // The courier is dressed for the job, so it never reads as tea minus's
  // lander: a red cap with its brim forward (C), a delivery bag on its back
  // (g), red trainers (k), and a bendy straw swept back by the run.
  const BAG = "#7bae8c";
  const RUNNER_PAL = { O: INK, S: STRAW_PINK, l: LID, T: TEA, e: EMPTY_CUP, b: PEARL, C: ACCENT, k: ACCENT, g: BAG };
  const RUSH_PAL = { O: ACCENT, S: STRAW_PINK, l: "#fff3da", T: "#e0b07c", e: "#fff6ea", b: PEARL, C: "#fff3da", k: ACCENT, g: "#fff3da" };
  const GHOST_PAL = { O: STRAW_PINK, S: STRAW_PINK, l: STRAW_PINK, T: STRAW_PINK, e: STRAW_PINK, b: STRAW_PINK, C: STRAW_PINK, k: STRAW_PINK, g: STRAW_PINK };
  const TEA_CELLS = 7;

  const HEADS: Record<string, string[]> = {
    straw: ["..SSS....", "....S...."],
    rotor0: ["SSSSSSSSS", "....S...."],
    rotor1: [".SSSSSSS.", "....S...."],
    rotor2: ["...SSS...", "....S...."],
    hook: ["....SSS..", "....S.S.."],
  };
  const LID_ROWS = ["..CCCCC..", ".CCCCCCCC", ".OOOOOOO."];
  /** The two upper tea rows, by lean: -1 tea pushed left, 1 pushed right. */
  const UPPER = { "-1": ["567", "234"], "0": ["657", "324"], "1": ["765", "432"] } as Record<string, string[]>;
  const LEGS: Record<string, string[]> = {
    stand: ["..O...O..", ".k.....k."],
    run0: ["..O...O..", ".k.....kk"],
    run1: ["...O.O...", "...O.O...", "...k..kk."],
    run2: ["..O...O..", "kk.....k."],
    run3: ["...O.O...", "...O.O...", "..kk.k..."],
    tuck: ["..kk.kk.."],
    fall: ["..O...O..", "..k...k.."],
    slam: ["...O.O...", "...k.k..."],
    hang: ["..O...O..", "..O...O..", "..k...k.."],
    glide: [".O.....O.", "k.......k"],
  };
  /** Lying back for a slide, legs out in front; tea fills from the cup's foot. */
  const SLIDE_ROWS = [
    ".OCOOOOO....",
    ".OCO52bO....",
    "SOCO741OO...",
    "..OCO63bOOO.",
    "..OCOOOOO.kk",
  ];

  const runnerGrids = new Map<string, string[]>();

  function fillTea(rows: string[], level: number) {
    return rows.map((row) => row.replace(/[1-7]/g, (digit) => (Number(digit) <= level ? "T" : "e")));
  }

  /**
   * A runner frame. `head` and `legs` name the parts; `arm` reaches forward
   * for a hand-off; `lean` shifts the upper body forward for a stumble.
   */
  function runnerGrid(key: string, head: string, legs: string, slosh: number, level: number, arm: boolean, lean: boolean) {
    let grid = runnerGrids.get(key);
    if (grid) return grid;
    if (legs === "slide") {
      grid = fillTea(SLIDE_ROWS, level);
    } else {
      const [row5, row6] = UPPER[String(slosh)];
      const rows = [
        ...HEADS[head],
        ...LID_ROWS,
        `ggO${row5}O..`,
        `ggO${row6}O..`,
        "ggOb1bO..",
        "..OOOOO..",
        ...LEGS[legs],
      ];
      if (arm) {
        rows[4] = ".OOOOOOOO";
        rows[5] = `${rows[5].slice(0, 7)}O.`;
      }
      if (lean) {
        for (let index = 0; index < rows.length; index++) {
          rows[index] = index < 7 ? `.${rows[index]}` : `${rows[index]}.`;
        }
      }
      grid = fillTea(rows, level);
    }
    runnerGrids.set(key, grid);
    return grid;
  }

  // --- Grids for everything on the roofs ---------------------------------------

  /** One palette for every object grid; letters keep their meaning throughout. */
  const ITEM_PAL: Record<string, string> = {
    O: INK,
    t: "#efe6d6",
    a: "#aab6c2",
    A: "#7e8b99",
    g: "#566273",
    f: "#3b4254",
    m: "#7f97ab",
    M: "#5f7689",
    H: "#a9bccb",
    w: "#c08a52",
    W: "#8a5a3c",
    k: "#ecd3a8",
    R: ACCENT,
    c: "#f3ead9",
    u: "#bcd6e6",
    y: "#f4d9b0",
    p: "#6a6472",
    P: "#3b3540",
    r: "#d8ccba",
    q: "#f3ead9",
    Q: "#9fc9c3",
    z: "#f2c0b0",
    T: TEA,
    l: LID,
    S: STRAW_PINK,
    b: PEARL,
    h: "#7a5a4c",
    G: "#dba84d",
    v: "#4a3f5c",
  };

  function blank(width: number, height: number) {
    return Array.from({ length: height }, () => new Array<string>(width).fill("."));
  }
  function rect(grid: string[][], x: number, y: number, width: number, height: number, ch: string) {
    for (let row = Math.max(0, y); row < Math.min(grid.length, y + height); row++) {
      for (let column = Math.max(0, x); column < Math.min(grid[row].length, x + width); column++) grid[row][column] = ch;
    }
  }
  function dot(grid: string[][], x: number, y: number, ch: string) {
    if (y >= 0 && y < grid.length && x >= 0 && x < grid[y].length) grid[y][x] = ch;
  }
  const joined = (grid: string[][]) => grid.map((row) => row.join(""));

  /** An air conditioner: cream lid to land on, a grille, and a fan. */
  function acGrid(width: number, height: number) {
    const g = blank(width, height);
    rect(g, 0, 0, width, height, "O");
    rect(g, 1, 1, width - 2, 1, "t");
    rect(g, 1, 2, width - 2, height - 3, "a");
    rect(g, 1, height - 2, width - 2, 1, "A");
    rect(g, width - 2, 2, 1, height - 3, "A");
    const grille = Math.floor((width - 2) * 0.42);
    for (let x = 2; x < 1 + grille; x += 2) rect(g, x, 3, 1, height - 5, "g");
    const cx = 1 + grille + (width - 3 - grille) / 2;
    const cy = 2 + (height - 4) / 2;
    const radius = Math.min((height - 4) / 2, (width - grille - 4) / 2);
    for (let y = 2; y < height - 1; y++) {
      for (let x = grille + 1; x < width - 2; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= radius) g[y][x] = d < radius * 0.35 ? "a" : (x + y) % 2 ? "f" : "g";
      }
    }
    dot(g, 0, 0, ".");
    dot(g, width - 1, 0, ".");
    return joined(g);
  }

  /** A squat water drum on a plinth, hooped, with a cream lid. */
  function tankGrid(width: number, height: number) {
    const g = blank(width, height);
    rect(g, 0, 1, width, height - 1, "O");
    rect(g, 2, 0, width - 4, 1, "O");
    rect(g, 2, 1, width - 4, 1, "t");
    rect(g, 1, 2, width - 2, 1, "t");
    rect(g, 1, 3, width - 2, height - 5, "m");
    for (let y = 6; y < height - 3; y += 4) rect(g, 1, y, width - 2, 1, "M");
    rect(g, 3, 3, 1, height - 5, "H");
    rect(g, width - 3, 3, 2, height - 5, "M");
    rect(g, 1, height - 2, width - 2, 1, "P");
    // A short ladder up the side.
    for (let y = 4; y < height - 3; y += 2) dot(g, width - 5, y, "P");
    return joined(g);
  }

  /** Stacked crates, braced; the top one's plank is pale, to land on. */
  function crateGrid(count: number) {
    const g = blank(10, 9 * count);
    for (let k = 0; k < count; k++) {
      const y = k * 9;
      rect(g, 0, y, 10, 9, "O");
      rect(g, 1, y + 1, 8, 7, "w");
      rect(g, 1, y + 4, 8, 1, "W");
      for (let d = 0; d < 7; d++) dot(g, 1 + d + (d > 2 ? 1 : 0), y + 1 + d, "W");
      if (k === 0) rect(g, 1, y + 1, 8, 1, "k");
    }
    return joined(g);
  }

  const BROKEN_CRATE = [
    "...W.....k..",
    "..ww...WWW..",
    "WWWwW.kwwwW.",
  ];

  /**
   * A clothesline between two poles. The laundry's red hems mark the height
   * to get under, as every low thing's red does.
   */
  function clotheslineGrid(width: number, seed: number) {
    const g = blank(width, 11);
    rect(g, 0, 0, 1, 11, "P");
    rect(g, width - 1, 0, 1, 11, "P");
    rect(g, 1, 1, width - 2, 1, "r");
    const random = createRng(seed);
    const cloths = ["c", "u", "y", "c"];
    let x = 2;
    while (x < width - 3) {
      const roll = random();
      const cloth = cloths[Math.floor(random() * cloths.length)];
      if (roll < 0.4 && x + 5 < width - 2) {
        rect(g, x, 2, 5, 1, cloth);
        rect(g, x + 1, 3, 3, 1, cloth);
        rect(g, x + 1, 4, 3, 1, "R");
        dot(g, x, 1, "O");
        dot(g, x + 4, 1, "O");
        x += 6 + Math.floor(random() * 2);
      } else if (roll < 0.75 && x + 3 < width - 2) {
        const w = 3 + Math.floor(random() * 2);
        rect(g, x, 2, w, 2, cloth);
        rect(g, x, 4, w, 1, "R");
        dot(g, x, 1, "O");
        dot(g, x + w - 1, 1, "O");
        x += w + 1 + Math.floor(random() * 2);
      } else {
        rect(g, x, 2, 1, 2, cloth);
        dot(g, x, 4, "R");
        dot(g, x, 1, "O");
        x += 2 + Math.floor(random() * 2);
      }
    }
    return joined(g);
  }

  /** A billboard on legs: an ad for tea, and red and cream stripes underneath. */
  function billboardGrid(width: number, height: number, seed: number) {
    const g = blank(width, height);
    const face = ["q", "Q", "z"][seed % 3];
    const board = height - 6;
    const posts = width > 52 ? [Math.floor(width * 0.18), Math.floor(width / 2) - 1, Math.floor(width * 0.82) - 2] : [Math.floor(width * 0.22), Math.floor(width * 0.78) - 2];
    for (const x of posts) {
      rect(g, x, board, 2, 6, "p");
      rect(g, x + 1, board, 1, 6, "P");
    }
    rect(g, 0, 0, width, board, "O");
    rect(g, 1, 1, width - 2, board - 5, face);
    rect(g, 1, board - 4, width - 2, 1, "O");
    for (let x = 1; x < width - 1; x++) {
      const stripe = Math.floor((x - 1) / 3) % 2 ? "c" : "R";
      rect(g, x, board - 3, 1, 2, stripe);
    }
    // The ad: a big cup of tea on the left, lettering on the right.
    const cup = [
      "......SS......",
      "......SS......",
      "....SSSS......",
      "..OOOOOOOOOO..",
      ".OllllllllllO.",
      "OOOOOOOOOOOOOO",
      ".OTTTTTTTTTTO.",
      ".OTTTTTTTTTTO.",
      ".OTTTTTTTTTTO.",
      ".OTTTTTTTTTTO.",
      "..OTbTTTbTTO..",
      "..OTTTbTTTTO..",
      "..ObTTTTbTTO..",
      "...OTTbTTTO...",
      "...OOOOOOOO...",
    ];
    const cupX = 3;
    const cupY = Math.max(12, Math.floor((board - 5 - cup.length) / 2) + 4);
    cup.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) if (row[dx] !== ".") dot(g, cupX + dx, cupY + dy, row[dx]);
    });
    // A headline across the top, and a row of bulbs over it.
    for (let x = 3; x < width - 3; x += 4) dot(g, x, 2, "G");
    rect(g, 3, 4, Math.floor((width - 6) * 0.8), 3, "O");
    rect(g, 3, 8, Math.floor((width - 6) * 0.5), 2, "R");
    const textX = cupX + 17;
    const room = width - 3 - textX;
    if (room >= 8) {
      const random = createRng(seed);
      rect(g, textX, cupY + 1, Math.max(6, Math.floor(room * (0.7 + random() * 0.3))), 3, "O");
      rect(g, textX, cupY + 6, Math.max(5, Math.floor(room * (0.45 + random() * 0.3))), 2, "O");
      rect(g, textX, cupY + 10, Math.max(4, Math.floor(room * 0.6)), 2, "O");
      rect(g, textX, cupY + 15, Math.max(4, Math.floor(room * 0.35)), 3, "R");
    }
    return joined(g);
  }

  /** A striped shop awning; squashed, it gives a cell. */
  function awningGrid(width: number, squashed: boolean) {
    const g = blank(width, 7);
    const top = squashed ? 1 : 0;
    rect(g, 0, top, width, 1, "O");
    const stripeRows = squashed ? 1 : 2;
    for (let x = 0; x < width; x++) {
      const stripe = Math.floor(x / 3) % 2 ? "c" : "R";
      rect(g, x, top + 1, 1, stripeRows, stripe);
      const valance = top + 1 + stripeRows;
      if (x % 3 !== 1 || squashed) dot(g, x, valance, stripe);
    }
    dot(g, 0, 6, "P");
    dot(g, 1, 5, "P");
    dot(g, 2, 4, "P");
    return joined(g);
  }

  /** A scaffold plank: a pale top to land on. */
  function ledgeGrid(width: number) {
    const g = blank(width, 3);
    rect(g, 0, 0, width, 3, "O");
    rect(g, 1, 0, width - 2, 1, "k");
    rect(g, 1, 1, width - 2, 1, "w");
    for (let x = 12; x < width - 4; x += 14) dot(g, x, 1, "W");
    return joined(g);
  }

  const PEARL_GRID = [".bb.", "bhbb", "bbbb", ".bb."];
  const COASTER_GRID = [".cccccccccc.", "RRRRRRRRRRRR"];
  const COASTER_HARD = [".cccccccccc.", "GGGGGGGGGGGG"];
  const SMALL_CUP = ["..S.", "OOOO", "OTTO", "OTTO", ".OO."];

  const PIGEON_PAL = { h: "#4a4f5c", n: "#5b7f6a", b: "#9aa0ad", w: "#c3c8d2", t: "#4a4f5c", k: "#e8915a" };
  const PIGEON: Record<string, string[]> = {
    sit0: [".hh...", "khnbb.", ".bbwbt", "..k.k."],
    sit1: ["......", ".hh...", "khnbbt", "..k.k."],
    fly0: ["..ww..", ".ww.w.", "hnbbbt", "......"],
    fly1: ["......", "hnbbbt", ".ww...", "..ww.."],
  };

  // --- Customers ---------------------------------------------------------------------

  const SKINS = ["#f1c7a5", "#d9a27a", "#a86f4c", "#6f4a33"];
  const HAIRS = ["#2b2320", "#6f4530", "#c99a4a", "#8a3251"];
  const PANTS = ["#3b4254", "#5a3826", "#2b2440", "#556b4a"];
  const CAPS = [ACCENT, "#3f8a86", "#f4b942"];
  const customerPalettes: Array<Record<string, string>> = [];

  function customerPalette(variant: number) {
    let palette = customerPalettes[variant];
    if (!palette) {
      palette = {
        h: HAIRS[(variant >> 2) % 4],
        f: SKINS[variant % 4],
        s: DRINKS[(variant * 5 + 3) % DRINKS.length],
        p: PANTS[(variant >> 1) % 4],
        k: INK,
        c: CAPS[variant % 3],
        C: LID,
        T: TEA,
        O: INK,
      };
      customerPalettes[variant] = palette;
    }
    return palette;
  }

  const PERSON_BODY = [
    "..hhh..",
    ".hhhhh.",
    ".ffhhh.",
    ".fffhh.",
    "..ff...",
    ".sssss.",
    ".sssss.",
    ".sssss.",
    ".sssss.",
    ".ppppp.",
    ".pp.pp.",
    ".pp.pp.",
    ".pp.pp.",
    ".kk.kk.",
  ];
  const customerGrids = new Map<string, string[]>();

  /**
   * A customer, 7 by 16 cells with two rows of headroom for a raised cup.
   * Poses: wave0/wave1 (an arm up, waiting), catch (both up, cup held high),
   * sip, idle, slump. Styles: 0 short hair, 1 a bun, 2 a cap.
   */
  function customerGrid(pose: string, style: number) {
    const key = `${pose}-${style}`;
    let grid = customerGrids.get(key);
    if (grid) return grid;
    const g = blank(7, 16);
    PERSON_BODY.forEach((row, y) => {
      for (let x = 0; x < 7; x++) if (row[x] !== ".") g[y + 2][x] = row[x];
    });
    if (style === 1) {
      dot(g, 4, 1, "h");
      dot(g, 5, 1, "h");
      dot(g, 5, 2, "h");
    } else if (style === 2) {
      rect(g, 1, 2, 5, 2, "c");
      dot(g, 2, 2, "c");
      dot(g, 0, 4, "c");
      dot(g, 1, 3, "c");
    }
    const sleeve = (x: number, from: number, to: number) => rect(g, x, from, 1, to - from + 1, "s");
    if (pose === "slump") {
      // Head down and forward, shoulders dropped.
      for (let y = 8; y >= 0; y--) for (let x = 0; x < 7; x++) g[y + 1][x] = g[y][x];
      rect(g, 0, 0, 7, 1, ".");
      sleeve(0, 9, 11);
      sleeve(6, 9, 11);
      dot(g, 0, 12, "f");
      dot(g, 6, 12, "f");
    } else if (pose === "catch") {
      sleeve(0, 3, 7);
      sleeve(6, 4, 7);
      dot(g, 0, 2, "f");
      dot(g, 6, 3, "f");
      rect(g, 0, 0, 2, 1, "C");
      rect(g, 0, 1, 2, 1, "T");
    } else if (pose === "sip") {
      sleeve(0, 7, 8);
      dot(g, 0, 6, "f");
      rect(g, 0, 4, 1, 2, "T");
      sleeve(6, 7, 10);
      dot(g, 6, 11, "f");
    } else if (pose === "wave0" || pose === "wave1") {
      const reach = pose === "wave0" ? 3 : 4;
      sleeve(0, reach + 1, 7);
      dot(g, 0, reach, "f");
      sleeve(6, 7, 10);
      dot(g, 6, 11, "f");
    } else {
      sleeve(0, 7, 10);
      sleeve(6, 7, 10);
      dot(g, 0, 11, "f");
      dot(g, 6, 11, "f");
    }
    grid = joined(g);
    customerGrids.set(key, grid);
    return grid;
  }

  // --- The boba-cup balloon (as in cup stack) -----------------------------------------

  const BALLOON = [
    ".....S.....",
    ".....S.....",
    "...OOSOO...",
    "..OlllllO..",
    ".OlllllllO.",
    "OOOOOOOOOOO",
    "OhLLLLLLLLO",
    "OhLLLLLLLLO",
    "OhLLLLLLLLO",
    ".OLLLLLLLO.",
    ".OLbLLLbLO.",
    ".OLLLbLLLO.",
    "..ObLLLbO..",
    "..OLLbLLO..",
    "...OOOOO...",
    "...r...r...",
    "....r.r....",
    "....KKK....",
    "....kkk....",
  ];

  // --- State -----------------------------------------------------------------

  let state: RunState = newRun(1);
  let mode: Mode = "countdown";
  let paused = false;
  let gameOver = false;
  let tipVisible = false;
  let liveMessage = "Sugar rush starting";
  let localBest = 0;
  let newBest = false;
  let countdown = COUNTDOWN_SECONDS;
  let countdownElapsed = 0;
  let goVisible = false;
  let teach: TeachKind | null = null;
  let teachAge = 0;
  const taught: Record<TeachKind, boolean> = { slide: false, glide: false, rush: false };

  // HUD readouts, refreshed about ten times a second.
  let score = 0;
  let combo = 1;
  let streak = 0;
  let sugarPips = 0;
  let rushReady = false;
  let rushing = false;
  let teaShown = 1;
  let lives = START_LIVES;
  let livesPulse = 0;
  let hudClock = 0;
  let finalStats = breakdown(state);

  let canvas: HTMLCanvasElement;
  let playScope: HTMLElement;
  let playfield: HTMLElement;
  let hudRow: HTMLElement;
  let padsRow: HTMLElement | undefined;
  let ctx: CanvasRenderingContext2D | null = null;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;
  let noteFont = '500 13px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';
  let stampFont = noteFont;
  let reduceMotion = false;
  let touchUI = false;
  let coarse = false;
  let touchSeen = false;

  // Layout, in CSS px unless named otherwise.
  let viewW = 0;
  let viewH = 0;
  let playTop = 80;
  let playBottom = 600;
  /** Where camY sits on screen. */
  let focusY = 400;
  let horizonY = 400;
  /** The runner's share of the width from the left edge. */
  let lead = 0.28;
  /** Pixels per world unit: the resting scale, and this frame's. */
  let baseS = 2;
  let S = 2;
  /** World x at the screen's left edge, and the world y drawn at focusY. */
  let camLeft = 0;
  let camY = 140;
  let camRunX = 0;
  /** The height the camera holds to while the runner is in the air. */
  let anchorY = 120;

  let accumulator = 0;
  /** Scene clock: drives every animation, and stops when paused. */
  let clock = 0;
  let overAt = 0;
  let night = 0;
  let shake = 0;
  let displayTea = 1;
  /** Tea refills ease up from here after a delivery. */
  let refillFrom = 1;
  let refillAt = -10;
  let slosh = 0;
  let sloshV = 0;
  let lastVy = 0;
  let respawnAt = -10;
  let fallAt = -10;
  let handoffAt = -10;
  let rushFlashAt = -10;
  let lastPearlSound = -1;
  let lastSpillSound = -1;
  let lastLandSound = -1;
  let lastCombo = 1;
  let draftClock = 0;
  let sparkClock = 0;
  let slideDustClock = 0;
  let firstChunk = 0;

  const keys: Held = { jump: false, down: false, rush: false };
  let touchHeld: Held = { jump: false, down: false, rush: false };
  const input: Held = { jump: false, down: false, rush: false };

  let last = 0;
  let raf = 0;
  let active = true;
  const timers = createTimers();

  // World to screen. World y points up; screen y points down.
  const sx = (x: number) => (x - camLeft) * S;
  const sy = (y: number) => focusY - (y - camY) * S;

  // --- Reading the course ---------------------------------------------------------

  /** The top of the roof under world x, or -1 over a gap. */
  function roofTopAt(x: number) {
    for (const chunk of state.chunks) {
      if (chunk.x1 < x || chunk.x0 > x) continue;
      for (const roof of chunk.roofs) if (x >= roof.x0 && x <= roof.x1) return roof.top;
    }
    return -1;
  }

  /** The average height of the roofs coming up, for the camera to lean toward. */
  function aheadTop(x: number, speed: number) {
    let sum = 0;
    let count = 0;
    for (let k = 1; k <= 3; k++) {
      const top = roofTopAt(x + speed * 0.4 * k);
      if (top >= 0) {
        sum += top;
        count++;
      }
    }
    return count ? sum / count : anchorY;
  }

  // --- The sky ------------------------------------------------------------------------

  const DUSK_RGB = SKY_DUSK.map(rgb);
  const TWILIGHT_RGB = SKY_TWILIGHT.map(rgb);
  const NIGHT_RGB = SKY_NIGHT.map(rgb);
  const skyBand = (index: number, n: number) =>
    n <= 0.5
      ? mixRgb(DUSK_RGB[index], TWILIGHT_RGB[index], n / 0.5)
      : mixRgb(TWILIGHT_RGB[index], NIGHT_RGB[index], (n - 0.5) / 0.5);

  let skyCanvas: HTMLCanvasElement | null = null;
  let skyStep = -1;
  let sunCanvas: HTMLCanvasElement | null = null;
  let moonCanvas: HTMLCanvasElement | null = null;
  let sunR = 8;
  let moonR = 5;

  /** Flat bands down to the horizon, joined by ordered dithering; haze below. */
  function paintSky(n: number) {
    const width = Math.max(1, Math.ceil(viewW / SC));
    const height = Math.max(1, Math.ceil(viewH / SC));
    skyCanvas ??= document.createElement("canvas");
    skyCanvas.width = width;
    skyCanvas.height = height;
    const context = skyCanvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(width, height);
    const data = image.data;
    const bands = [0, 1, 2, 3, 4].map((index) => skyBand(index, n));
    const stops = SKY_STOPS.map((f) => (f * horizonY) / SC);
    for (let y = 0; y < height; y++) {
      let segment = 0;
      while (segment < stops.length - 2 && y >= stops[segment + 1]) segment++;
      const t = clamp((y - stops[segment]) / (stops[segment + 1] - stops[segment]), 0, 1);
      const blend = clamp((t - 0.3) / 0.4, 0, 1);
      const below = y >= stops[4];
      for (let x = 0; x < width; x++) {
        const color = below ? bands[4] : bands[blend > bayer(x, y) ? segment + 1 : segment];
        const o = (y * width + x) * 4;
        data[o] = color[0];
        data[o + 1] = color[1];
        data[o + 2] = color[2];
        data[o + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }

  /** A pixel disc with a one-cell rim; the moon gets a shaded crescent. */
  function paintDisc(radius: number, fill: string, rim: string, crescent: boolean) {
    const size = radius * 2 + 1;
    const disc = document.createElement("canvas");
    disc.width = size;
    disc.height = size;
    const context = disc.getContext("2d");
    if (!context) return disc;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - radius, y - radius);
        if (d > radius + 0.35) continue;
        let color = d > radius - 0.65 ? rim : fill;
        if (crescent && Math.hypot(x - radius + radius * 0.55, y - radius - radius * 0.2) < radius * 0.95) color = rim;
        if (crescent && hash2(x, y + 11) < 0.12 && d < radius - 1) color = rim;
        context.fillStyle = color;
        context.fillRect(x, y, 1, 1);
      }
    }
    return disc;
  }

  function drawSunAndMoon() {
    if (!ctx) return;
    if (night < 0.46 && sunCanvas) {
      const sink = snap(smooth(night / 0.45) * (sunR * 2 + 4) * SC);
      const size = sunCanvas.width * SC;
      ctx.drawImage(sunCanvas, snap(viewW * 0.14) - sunR * SC, snap(horizonY - sunR * SC * 0.7) + sink, size, size);
    }
    if (night > 0.6 && moonCanvas) {
      const rise = smooth(clamp((night - 0.6) / 0.4, 0, 1));
      const y = snap(lerp(horizonY + moonR * SC, playTop + (horizonY - playTop) * 0.22, rise));
      const size = moonCanvas.width * SC;
      ctx.drawImage(moonCanvas, snap(viewW * 0.8), y, size, size);
    }
  }

  /** Kind 0 is one dim cell, 1 one bright cell, 2 a bright cell with soft arms. */
  const STARS = (() => {
    const random = createRng(4411);
    return Array.from({ length: 96 }, (_, index) => {
      const roll = random();
      return {
        x: random(),
        y: random(),
        kind: roll < 0.62 ? 0 : roll < 0.93 ? 1 : 2,
        twinkle: index % 7 === 3,
        speed: 0.7 + random() * 1.3,
        phase: random() * Math.PI * 2,
        wake: random(),
      };
    });
  })();
  const starLevel = new Uint8Array(STARS.length);

  /** Stars come out from the top down as night falls; a few twinkle. */
  function drawStars() {
    if (!ctx || night < 0.28) return;
    const columns = Math.floor(viewW / SC);
    const rows = Math.max(1, (horizonY * 0.9) / SC);
    for (let index = 0; index < STARS.length; index++) {
      const star = STARS[index];
      let alpha = quarters((night - (0.3 + 0.42 * star.y + 0.14 * star.wake)) / 0.12);
      if (star.kind === 0) alpha *= 0.5;
      if (!reduceMotion && star.twinkle && alpha > 0) {
        alpha *= Math.max(0.25, quarters(0.5 + 0.5 * Math.sin(clock * star.speed + star.phase)));
      }
      starLevel[index] = Math.round(alpha * 8);
    }
    ctx.fillStyle = CREAM;
    for (let level = 1; level <= 8; level++) {
      ctx.globalAlpha = level / 8;
      ctx.beginPath();
      for (let index = 0; index < STARS.length; index++) {
        if (starLevel[index] !== level) continue;
        const star = STARS[index];
        ctx.rect(Math.floor(star.x * columns) * SC, Math.floor(star.y * rows) * SC, SC, SC);
      }
      ctx.fill();
    }
    for (let index = 0; index < STARS.length; index++) {
      const star = STARS[index];
      if (star.kind !== 2 || !starLevel[index]) continue;
      const x = Math.floor(star.x * columns) * SC;
      const y = Math.floor(star.y * rows) * SC;
      ctx.globalAlpha = (starLevel[index] / 8) * 0.45;
      ctx.fillRect(x - SC, y, SC, SC);
      ctx.fillRect(x + SC, y, SC, SC);
      ctx.fillRect(x, y - SC, SC, SC);
      ctx.fillRect(x, y + SC, SC, SC);
    }
    ctx.globalAlpha = 1;
  }

  // --- Skylines ---------------------------------------------------------------------------
  //
  // Two periodic silhouettes behind the roofs, built cell by cell once per
  // resize and repainted once per colour step. Their windows come on one by
  // one as the night deepens.

  interface Strip {
    /** Horizontal and vertical parallax against the run. */
    p: number;
    vp: number;
    seed: number;
    period: number;
    rows: number;
    /** The row the skyline stands on. */
    base: number;
    minW: number;
    maxW: number;
    high: number;
    low: number;
    windows: number;
    dusk: string;
    night: string;
    rim: string;
    cells: Uint8Array;
    lit: Float32Array;
    canvas: HTMLCanvasElement | null;
  }

  const STRIPS: Strip[] = [
    {
      p: 0.05,
      vp: 0.04,
      seed: 31,
      period: 420,
      rows: 0,
      base: 0,
      minW: 6,
      maxW: 14,
      high: 0.36,
      low: 0.12,
      windows: 0.32,
      dusk: "#5a4570",
      night: "#1f2042",
      rim: "#8a5a7a",
      cells: new Uint8Array(0),
      lit: new Float32Array(0),
      canvas: null,
    },
    {
      p: 0.14,
      vp: 0.1,
      seed: 57,
      period: 360,
      rows: 0,
      base: 0,
      minW: 8,
      maxW: 18,
      high: 0.26,
      low: 0.06,
      windows: 0.42,
      dusk: "#43345a",
      night: "#161731",
      rim: "#a0606a",
      cells: new Uint8Array(0),
      lit: new Float32Array(0),
      canvas: null,
    },
  ];

  function buildStrip(strip: Strip) {
    const span = Math.max(1, horizonY - playTop);
    const high = Math.ceil((strip.high * span) / SC);
    const low = Math.ceil((strip.low * span) / SC);
    strip.base = high + 8;
    strip.rows = strip.base + Math.ceil((viewH - horizonY) / SC) + 40;
    const { period, rows, base } = strip;
    const cells = new Uint8Array(period * rows);
    const lit = new Float32Array(period * rows);
    const set = (x: number, y: number, value: number) => {
      const column = ((x % period) + period) % period;
      if (y >= 0 && y < rows) cells[y * period + column] = value;
    };
    const random = createRng(strip.seed);
    let x = 0;
    while (x < period) {
      const w = Math.min(period - x, strip.minW + Math.floor(random() * (strip.maxW - strip.minW + 1)));
      const h = Math.round(lerp(low, high, Math.pow(random(), 1.3)));
      const top = base - h;
      for (let row = top; row < rows; row++) for (let column = x; column < x + w; column++) set(column, row, 1);
      const feature = random();
      if (w >= 8 && feature < 0.3) {
        // A stepped crown.
        const inset = 2;
        const tall = 2 + Math.floor(random() * 3);
        for (let row = top - tall; row < top; row++) for (let column = x + inset; column < x + w - inset; column++) set(column, row, 1);
      } else if (w >= 7 && feature < 0.5) {
        // A water tower.
        const tx = x + 1 + Math.floor(random() * (w - 6));
        set(tx, top - 1, 1);
        set(tx + 4, top - 1, 1);
        for (let column = tx; column < tx + 5; column++) for (let row = top - 5; row < top - 1; row++) set(column, row, 1);
        set(tx + 2, top - 6, 1);
      } else if (feature < 0.7) {
        const ax = x + 1 + Math.floor(random() * Math.max(1, w - 2));
        const ah = 3 + Math.floor(random() * 5);
        for (let row = top - ah; row < top; row++) set(ax, row, 1);
      }
      const rowStep = 2 + Math.floor(random() * 2);
      for (let wy = top + 2; wy < rows; wy += rowStep) {
        for (let wx = x + 1; wx < x + w - 1; wx += 2) {
          const roll = hash2(strip.seed * 31 + wx, wy);
          if (roll < strip.windows) {
            cells[wy * period + wx] = 3;
            lit[wy * period + wx] = hash2(wx, wy * 7 + strip.seed);
          }
        }
      }
      x += w;
    }
    // A rim on every top and on every wall facing the low sun on the left.
    for (let y = 0; y < rows; y++) {
      for (let column = 0; column < period; column++) {
        if (cells[y * period + column] !== 1) continue;
        const above = y > 0 ? cells[(y - 1) * period + column] : 0;
        const left = cells[y * period + ((column - 1 + period) % period)];
        if (above === 0 || left === 0) cells[y * period + column] = 2;
      }
    }
    strip.cells = cells;
    strip.lit = lit;
    strip.canvas ??= document.createElement("canvas");
    strip.canvas.width = period;
    strip.canvas.height = rows;
  }

  function paintStrip(strip: Strip, n: number) {
    const context = strip.canvas?.getContext("2d");
    if (!context || !strip.canvas) return;
    const { period, rows, cells, lit } = strip;
    const body = rgb(mixHex(strip.dusk, strip.night, n));
    const rim = rgb(mixHex(mixHex(strip.dusk, strip.rim, 0.6), mixHex(strip.night, "#2c2a52", 0.5), n));
    const warm = rgb(WINDOW_LIT);
    const amber = rgb(WINDOW_WARM);
    const share = 0.04 + 0.7 * smooth(n);
    const image = context.createImageData(period, rows);
    const data = image.data;
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      if (!cell) continue;
      let color = cell === 2 ? rim : body;
      if (cell === 3 && lit[index] < share) color = lit[index] < share * 0.3 ? amber : warm;
      const o = index * 4;
      data[o] = color[0];
      data[o + 1] = color[1];
      data[o + 2] = color[2];
      data[o + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }

  /** The reference scale the backdrops scroll by, so zooming never slides them. */
  let stripS = 2;
  const CAM_Y_REST = 150;

  function drawStrip(strip: Strip) {
    if (!ctx || !strip.canvas) return;
    const width = strip.period * SC;
    let offset = -((camLeft * stripS * strip.p) % width);
    if (offset > 0) offset -= width;
    offset = snap(offset);
    const y = snap(horizonY - strip.base * SC + (camY - CAM_Y_REST) * stripS * strip.vp);
    for (let x = offset; x < viewW; x += width) ctx.drawImage(strip.canvas, x, y, width, strip.rows * SC);
  }

  // The boba-cup balloon from cup stack, now and then, far off.
  const balloon = { on: false, x: 0, y: 0, drink: 0, wait: 25 };

  function stepBalloon(dt: number) {
    if (reduceMotion || mode !== "running") return;
    if (balloon.on) {
      // It hangs in the far sky, so the city slides past it slowly.
      balloon.x -= speedAt(state.runner.x) * stripS * 0.06 * dt - 4 * dt;
      if (balloon.x < -BALLOON[0].length * SC - 8) balloon.on = false;
      return;
    }
    balloon.wait -= dt;
    if (balloon.wait > 0) return;
    balloon.wait = 40 + Math.random() * 35;
    balloon.on = true;
    balloon.x = viewW + 8;
    balloon.y = playTop + (horizonY - playTop) * (0.18 + Math.random() * 0.3);
    balloon.drink = Math.floor(Math.random() * DRINKS.length);
  }

  function drawBalloon() {
    if (!ctx || !balloon.on) return;
    const liquid = DRINKS[balloon.drink];
    const sprite = cachedSprite(`sr-balloon-${balloon.drink}`, BALLOON, 1, {
      S: STRAW_PINK,
      O: mixHex(liquid, INK, 0.55),
      l: LID,
      L: liquid,
      h: mixHex(liquid, CREAM, 0.4),
      b: mixHex(PEARL, liquid, 0.2),
      r: "#6f4530",
      K: "#8a5a3c",
      k: "#6f4530",
    });
    const bob = Math.round(Math.sin(clock * 0.9)) * SC;
    ctx.globalAlpha = 0.9 - 0.3 * night;
    ctx.drawImage(sprite, snap(balloon.x), snap(balloon.y) + bob, sprite.width * SC, sprite.height * SC);
    ctx.globalAlpha = 1;
  }

  // --- The roofs you run on ------------------------------------------------------------
  //
  // Each roof is painted once, one pixel per cell, into its own small canvas
  // (and again at each of a few colour steps as night falls), then scaled up
  // without smoothing. Canvases are kept by chunk and dropped with the chunk.

  interface Look {
    wall: string;
    shade: string;
    light: string;
    /** 0 brick, 1 stucco, 2 concrete bands, 3 tile, 4 siding. */
    tex: number;
  }
  const STYLES: Look[] = [
    { wall: "#8a4a3c", shade: "#6f3a30", light: "#a55f4c", tex: 0 },
    { wall: "#a98466", shade: "#8c6a50", light: "#c09a7a", tex: 1 },
    { wall: "#77748a", shade: "#615e73", light: "#8d8aa0", tex: 2 },
    { wall: "#3f6f6c", shade: "#325a58", light: "#4f8682", tex: 3 },
    { wall: "#6a4a6a", shade: "#553b56", light: "#80597f", tex: 0 },
    { wall: "#a0703a", shade: "#835a2d", light: "#b8854a", tex: 0 },
    { wall: "#4a5266", shade: "#3b4254", light: "#5d667c", tex: 4 },
    { wall: "#6f8a6a", shade: "#5a7356", light: "#84a07e", tex: 3 },
  ];
  const SIGN_PANELS = [ACCENT, "#3f8a86", "#8a3251", "#c99a4a"];

  interface RoofArt {
    step: number;
    canvas: HTMLCanvasElement;
  }
  const roofArt = new Map<number, RoofArt[]>();

  /** Cells of sky kept above a roof for what stands on it. */
  const roofHead = (roof: Roof) => (roof.tower ? 26 : 12);

  function paintRoof(roof: Roof, step: number, canvas: HTMLCanvasElement) {
    const n = step / ROOF_STEPS;
    const head = roofHead(roof);
    const cols = Math.max(4, Math.round((roof.x1 - roof.x0) / CELL));
    const rows = head + Math.ceil(roof.top / CELL) + 2;
    canvas.width = cols;
    canvas.height = rows;
    const c = canvas.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, cols, rows);
    const fill = (x: number, y: number, w: number, h: number, color: string) => {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    };
    const look = STYLES[roof.style % STYLES.length];
    const chimney = roof.kind === "chimney";
    const dim = 0.6 * n;
    const wall = mixHex(look.wall, WALL_NIGHT, dim);
    const shade = mixHex(look.shade, WALL_NIGHT, dim);
    const light = mixHex(look.light, WALL_NIGHT, dim * 0.9);
    const mortar = mixHex(wall, shade, 0.75);
    const random = createRng(roof.seed);
    const seed = roof.seed;
    const wallTop = head + 2;
    const streetRow = head + Math.round(roof.top / CELL);
    const inner = cols - 2;

    // The wall, set one cell in from the coping so the coping reads as a lip.
    fill(1, wallTop, inner, rows - wallTop, wall);

    // Texture, by style. Chimneys are always brick.
    const tex = chimney ? 0 : look.tex;
    c.fillStyle = mortar;
    for (let y = wallTop + 1; y < rows; y++) {
      const course = Math.floor((y - wallTop) / 3);
      const within = (y - wallTop) % 3;
      for (let x = 2; x < cols - 2; x++) {
        let mark = false;
        if (tex === 0) {
          mark = within === 0 ? (x + y) % 2 === 0 : within === 1 && (x + (course % 2) * 2) % 4 === 0;
        } else if (tex === 1) {
          mark = hash2(x + seed, y) < 0.05;
        } else if (tex === 2) {
          mark = x % 9 === 0 && hash2(x, seed) < 0.6;
        } else if (tex === 3) {
          mark = x % 3 === 0 && y % 3 === 0;
        } else {
          mark = (y - wallTop) % 3 === 0;
        }
        if (mark) c.fillRect(x, y, 1, 1);
      }
    }
    if (tex === 1 || tex === 3) {
      c.fillStyle = light;
      for (let y = wallTop + 1; y < rows; y++) {
        for (let x = 2; x < cols - 2; x++) {
          if (tex === 1 ? hash2(y + seed, x) < 0.035 : x % 3 === 1 && y % 3 === 1 && hash2(x, y + seed) < 0.5) c.fillRect(x, y, 1, 1);
        }
      }
    }

    // Lit from the low sun on the left: a light edge, a shaded one, and the
    // coping's shadow along the top of the wall.
    fill(1, wallTop, 1, rows - wallTop, light);
    fill(cols - 2, wallTop, 1, rows - wallTop, shade);
    fill(1, wallTop, inner, 1, shade);

    const share = 0.08 + 0.7 * smooth(n);
    const glass = mixHex(GLASS, GLASS_DUSK, 0.55 * (1 - n));
    const glassTop = mixHex(GLASS, "#c47a6a", 0.6 * (1 - n));

    if (chimney) {
      // A soot-dark band under the cap and a metal strap lower down.
      fill(1, wallTop, inner, 2, mixHex(shade, "#1a1a1a", 0.35));
      fill(1, wallTop + 6, inner, 1, mixHex("#3b3540", WALL_NIGHT, dim));
      fill(1, wallTop + 7, inner, 1, mixHex("#6a6472", WALL_NIGHT, dim));
    } else {
      const shop = roof.top >= 64;
      const sign = roof.sign && roof.top >= 70 && cols >= 16;
      const shopTop = shop ? streetRow - 11 : streetRow;
      const floorH = 7 + (seed % 2);
      const winW = 2 + ((seed >> 1) % 2);
      const winH = 3 + ((seed >> 2) % 2);
      const gap = 2 + ((seed >> 3) % 2);
      const left = sign ? 9 : 3;
      let index = 0;
      for (let y = wallTop + 3; y + winH < shopTop - 1; y += floorH) {
        if (tex === 2) fill(2, y + winH + 1, inner - 2, 1, light);
        for (let x = left; x + winW <= cols - 3; x += winW + gap) {
          index++;
          const roll = hash2(seed, index);
          if (roll < share) {
            fill(x, y, winW, winH, roll < share * 0.3 ? WINDOW_WARM : WINDOW_LIT);
            if (hash2(index, seed) < 0.3) fill(x, y, winW, 1, mixHex(WINDOW_WARM, wall, 0.4));
          } else {
            fill(x, y, winW, winH, glass);
            fill(x, y, winW, 1, glassTop);
          }
          fill(x, y + winH, winW, 1, light);
        }
      }
      if (shop) {
        // A shop at street level: a canopy, a window that glows at night, a door.
        const canopy = mixHex(DRINKS[seed % DRINKS.length], WALL_NIGHT, 0.25 + dim * 0.6);
        fill(1, shopTop, inner, 2, canopy);
        for (let x = 1; x < cols - 1; x += 2) fill(x, shopTop + 2, 1, 1, canopy);
        const glow = mixHex(mixHex(GLASS, WINDOW_LIT, 0.45), WINDOW_LIT, n);
        const doorX = cols - 7;
        fill(3, shopTop + 4, Math.max(2, doorX - 5), 6, glow);
        fill(3, shopTop + 4, Math.max(2, doorX - 5), 1, mixHex(glow, wall, 0.5));
        fill(doorX, shopTop + 4, 3, 7, mixHex("#2b2320", WALL_NIGHT, dim));
        fill(doorX + 2, shopTop + 7, 1, 1, light);
      }
      if (sign) {
        // A blade sign on the facade: a cup and three letters, lit at night.
        const panel = mixHex(SIGN_PANELS[seed % SIGN_PANELS.length], WALL_NIGHT, dim * 0.5);
        const letters = n > 0.3 ? "#ffe9a8" : mixHex("#e9dfd0", panel, 0.15);
        const x = 3;
        const y = wallTop + 3;
        fill(x - 1, y - 1, 7, 18, mixHex("#2b2320", WALL_NIGHT, dim));
        fill(x, y, 5, 16, panel);
        fill(x + 1, y + 1, 3, 1, letters);
        fill(x + 1, y + 2, 3, 3, n > 0.3 ? "#f4c27a" : mixHex(TEA, panel, 0.2));
        for (let k = 0; k < 3; k++) {
          fill(x + 1, y + 7 + k * 3, 3, 2, letters);
          if (hash2(seed, k) < 0.5) fill(x + 2, y + 7 + k * 3, 1, 1, panel);
        }
      }
    }

    // The coping you run along: a pale lip and its shaded underside.
    const coping = mixHex(COPING, COPING_NIGHT, 0.45 * n);
    fill(0, head, cols, 1, coping);
    fill(0, head + 1, cols, 1, mixHex(COPING_SHADE, WALL_NIGHT, dim * 0.6));
    if (chimney) {
      fill(0, head, 1, 2, mixHex(COPING_SHADE, WALL_NIGHT, dim * 0.6));
      fill(cols - 1, head, 1, 2, mixHex(COPING_SHADE, WALL_NIGHT, dim * 0.6));
    }

    // What stands on the roof, behind the running line, in muted colours.
    const far = mixHex("#4a3f5c", WALL_NIGHT, n * 0.7);
    const farLight = mixHex("#6f6080", WALL_NIGHT, n * 0.6);
    if (roof.tower) {
      const tx = Math.min(cols - 12, Math.floor(cols * (0.55 + 0.3 * random())));
      const wood = mixHex("#6f4530", WALL_NIGHT, 0.3 + n * 0.5);
      const woodLight = mixHex("#8a5a3c", WALL_NIGHT, 0.25 + n * 0.5);
      fill(tx + 1, head - 8, 1, 8, far);
      fill(tx + 8, head - 8, 1, 8, far);
      for (let d = 0; d < 6; d++) fill(tx + 2 + d, head - 2 - d, 1, 1, far);
      fill(tx, head - 9, 10, 1, far);
      fill(tx + 1, head - 19, 8, 10, wood);
      fill(tx + 1, head - 19, 1, 10, woodLight);
      fill(tx + 1, head - 12, 8, 1, far);
      fill(tx + 1, head - 16, 8, 1, far);
      fill(tx, head - 20, 10, 1, wood);
      fill(tx + 1, head - 21, 8, 1, wood);
      fill(tx + 3, head - 22, 4, 1, wood);
      fill(tx + 4, head - 23, 2, 1, far);
    } else if (!chimney && cols >= 30 && random() < 0.5) {
      const ax = 4 + Math.floor(random() * (cols - 8));
      const ah = 6 + Math.floor(random() * 5);
      fill(ax, head - ah, 1, ah, far);
      fill(ax - 1, head - ah + 2, 3, 1, far);
      if (random() < 0.6) {
        fill(ax + 3, head - 3, 1, 3, far);
        fill(ax + 2, head - 5, 3, 2, farLight);
      }
      if (n > 0.35) fill(ax, head - ah - 1, 1, 1, ACCENT);
    }
  }

  /** The canvas for a roof at the current colour step, painting it if needed. */
  function roofCanvas(chunkId: number, index: number, roof: Roof, step: number) {
    let list = roofArt.get(chunkId);
    if (!list) {
      list = [];
      roofArt.set(chunkId, list);
    }
    let art = list[index];
    if (!art) {
      art = { step: -1, canvas: document.createElement("canvas") };
      list[index] = art;
    }
    if (art.step !== step) {
      art.step = step;
      paintRoof(roof, step, art.canvas);
    }
    return art.canvas;
  }

  /** Forget the art of chunks the engine has dropped. */
  function pruneArt() {
    const first = state.chunks[0]?.id ?? 0;
    if (first === firstChunk) return;
    firstChunk = first;
    for (const id of roofArt.keys()) if (id < first) roofArt.delete(id);
  }

  // --- The street and the hedge in front ------------------------------------------------

  /** A dark hedge, railings and lamp posts in the foreground: a fall drops behind it. */
  interface Hedge {
    period: number;
    rows: number;
    cells: Uint8Array;
    canvas: HTMLCanvasElement | null;
    step: number;
  }
  const hedge: Hedge = { period: 300, rows: 40, cells: new Uint8Array(0), canvas: null, step: -1 };
  const HEDGE_LAMP_ROWS = 9;

  function buildHedge() {
    const { period } = hedge;
    const rows = HEDGE_LAMP_ROWS + 4 + 24;
    hedge.rows = rows;
    const cells = new Uint8Array(period * rows);
    const random = createRng(97);
    const top = HEDGE_LAMP_ROWS;
    let x = 0;
    while (x < period) {
      const w = Math.min(period - x, 20 + Math.floor(random() * 30));
      const railing = random() < 0.35;
      for (let column = x; column < x + w; column++) {
        let start = top;
        if (railing) start = top + 2;
        else start = top + Math.round(1.5 + Math.sin(column * 0.7) + hash2(column, 3) * 1.5);
        for (let row = start; row < rows; row++) cells[row * period + column] = 1;
        if (railing && column % 2 === 0) for (let row = top - 1; row < start; row++) cells[row * period + column] = 1;
        if (railing) cells[(top - 1) * period + column] = 1;
      }
      x += w;
    }
    for (let lamp = 12; lamp < period; lamp += 70 + Math.floor(random() * 50)) {
      for (let row = 2; row < top + 2; row++) cells[row * period + lamp] = 1;
      cells[1 * period + lamp - 1] = 2;
      cells[1 * period + lamp] = 2;
      cells[1 * period + lamp + 1] = 2;
      cells[0 * period + lamp] = 1;
      cells[0 * period + lamp - 1] = 1;
      cells[0 * period + lamp + 1] = 1;
    }
    hedge.cells = cells;
    hedge.canvas ??= document.createElement("canvas");
    hedge.canvas.width = period;
    hedge.canvas.height = rows;
    hedge.step = -1;
  }

  function paintHedge(n: number) {
    const context = hedge.canvas?.getContext("2d");
    if (!context) return;
    const body = rgb(mixHex(HEDGE[0], HEDGE[1], n));
    const lamp = rgb(n > 0.3 ? "#ffe9a8" : "#8a8296");
    const image = context.createImageData(hedge.period, hedge.rows);
    for (let index = 0; index < hedge.cells.length; index++) {
      const cell = hedge.cells[index];
      if (!cell) continue;
      const color = cell === 2 ? lamp : body;
      image.data[index * 4] = color[0];
      image.data[index * 4 + 1] = color[1];
      image.data[index * 4 + 2] = color[2];
      image.data[index * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }

  function drawStreet() {
    if (!ctx) return;
    const top = Math.round(sy(0));
    if (top > viewH) return;
    const n = night;
    ctx.fillStyle = mixHexCached(STREET.walk, 0, n);
    ctx.fillRect(0, top, viewW, Math.ceil(4 * S));
    ctx.fillStyle = mixHexCached(STREET.curb, 1, n);
    ctx.fillRect(0, top, viewW, Math.max(2, Math.round(S)));
    ctx.fillStyle = mixHexCached(STREET.road, 2, n);
    ctx.fillRect(0, top + Math.ceil(4 * S), viewW, viewH - top);
    // Lane dashes, fixed to the street.
    ctx.fillStyle = mixHexCached(STREET.dash, 3, n);
    const dashY = Math.round(sy(-14));
    const first = Math.floor(camLeft / 40) * 40;
    for (let x = first; x < camLeft + viewW / S + 40; x += 40) {
      ctx.fillRect(Math.round(sx(x)), dashY, Math.round(16 * S), Math.max(2, Math.round(S)));
    }
  }

  function drawHedge() {
    if (!ctx || !hedge.canvas) return;
    const cell = Math.max(SC, Math.round(CELL * S * 1.25));
    const topY = Math.round(sy(HEDGE_TOP)) - HEDGE_LAMP_ROWS * cell;
    if (topY > viewH) return;
    const width = hedge.period * cell;
    let offset = -((camLeft * S * 1.25) % width);
    if (offset > 0) offset -= width;
    offset = Math.round(offset);
    for (let x = offset; x < viewW; x += width) ctx.drawImage(hedge.canvas, x, topY, width, hedge.rows * cell);
    // Anything below the canvas is hedge too.
    const bottom = topY + hedge.rows * cell;
    if (bottom < viewH) {
      ctx.fillStyle = mixHexCached(HEDGE[0], 4, night);
      ctx.fillRect(0, bottom, viewW, viewH - bottom);
    }
  }

  /** mixHex toward night, cached per colour step so the draw loop never builds strings. */
  const nightMixes: Array<{ step: number; color: string }> = [];
  const NIGHT_TARGETS = [WALL_NIGHT, WALL_NIGHT, "#141526", "#5a5470", HEDGE[1]];
  function mixHexCached(color: string, slot: number, n: number) {
    const step = Math.round(n * SKY_STEPS);
    let entry = nightMixes[slot];
    if (!entry || entry.step !== step) {
      entry = { step, color: mixHex(color, NIGHT_TARGETS[slot], slot === 4 ? n : (step / SKY_STEPS) * 0.55) };
      nightMixes[slot] = entry;
    }
    return entry.color;
  }

  // --- Drawing things on the course ------------------------------------------------------
  //
  // Everything you can touch is a pixel grid drawn at the sprite scale with a
  // paper halo: solid things you hop or stand on have a cream top; low things
  // you slide under carry red and cream on their underside.

  /** Sprite cell in px this frame, and the factor from it to the exact scale. */
  let px = 4;
  let pk = 1;

  interface ItemArt {
    v: number;
    key: string;
    grid: string[];
  }
  const itemArt = new WeakMap<object, ItemArt>();

  function artFor(item: any, v: number): ItemArt {
    let art = itemArt.get(item);
    if (art && art.v === v) return art;
    const w = Math.max(2, Math.round((item.x1 - item.x0) / CELL));
    let key = "";
    let grid: string[] = [];
    switch (item.type) {
      case "ac": {
        const h = Math.max(5, Math.round((item.y1 - item.y0) / CELL));
        key = `sr-ac-${w}-${h}`;
        grid = acGrid(w, h);
        break;
      }
      case "tank": {
        const h = Math.max(8, Math.round((item.y1 - item.y0) / CELL));
        key = `sr-tank-${w}-${h}`;
        grid = tankGrid(w, h);
        break;
      }
      case "crate":
        key = v === 2 ? "sr-crate-broken" : `sr-crate-${item.count}`;
        grid = v === 2 ? BROKEN_CRATE : crateGrid(item.count);
        break;
      case "clothesline": {
        const seed = item.x0 % 6;
        key = `sr-line-${w}-${seed}`;
        grid = clotheslineGrid(w, seed + 3);
        break;
      }
      case "billboard": {
        const h = Math.round((item.y1 - (item.y0 - 11)) / CELL);
        const seed = Math.abs(item.x0) % 7;
        key = `sr-board-${w}-${h}-${seed}`;
        grid = billboardGrid(w, h, seed);
        break;
      }
      case "awning":
        key = `sr-awning-${w}-${v}`;
        grid = awningGrid(w, v === 3);
        break;
      case "ledge":
        key = `sr-ledge-${w}`;
        grid = ledgeGrid(w);
        break;
    }
    art = { v, key, grid };
    itemArt.set(item, art);
    return art;
  }

  /** Draws a grid with its left edge at world x and its top at world y. */
  function blit(key: string, grid: string[], palette: Record<string, string>, x: number, top: number, halo = true) {
    if (!ctx) return;
    const sprite = cachedSprite(key, grid, px, palette, halo ? HALO : "");
    ctx.drawImage(
      sprite,
      Math.round(sx(x) - SPRITE_PAD * pk),
      Math.round(sy(top) - SPRITE_PAD * pk),
      Math.round(sprite.width * pk),
      Math.round(sprite.height * pk),
    );
  }

  /** Awnings remember when they last bounced someone, to squash for a moment. */
  const squashed = new WeakMap<object, number>();

  interface Patron {
    state: "wait" | "expect" | "catch" | "sip" | "slump" | "idle";
    at: number;
  }
  const patrons = new WeakMap<object, Patron>();

  function patronOf(coaster: object) {
    let patron = patrons.get(coaster);
    if (!patron) {
      patron = { state: "wait", at: clock };
      patrons.set(coaster, patron);
    }
    return patron;
  }

  /** Where a customer stands: a step past the coaster, facing the runner. */
  const patronX = (coaster: any) => coaster.x1 - 4;

  function drawCustomer(coaster: any) {
    const patron = patronOf(coaster);
    const variant = Math.floor(ihash(Math.round(coaster.x0)) * 48);
    const style = variant % 3;
    let pose = "idle";
    const since = clock - patron.at;
    if (patron.state === "wait" || patron.state === "expect") {
      pose = reduceMotion ? "wave0" : Math.floor((clock + variant * 0.13) / 0.32) % 2 ? "wave1" : "wave0";
    } else if (patron.state === "catch") {
      pose = since < 1.1 ? "catch" : "sip";
    } else if (patron.state === "sip") {
      pose = "sip";
    } else if (patron.state === "slump") {
      pose = since < 1.4 ? "slump" : "idle";
    }
    // A small hop of joy when the cup lands.
    const hop = patron.state === "catch" && !reduceMotion && since < 0.4 ? Math.round(Math.sin((since / 0.4) * Math.PI) * 2) * CELL : 0;
    const grid = customerGrid(pose, style);
    blit(`sr-patron-${pose}-${style}-${variant}`, grid, customerPalette(variant), patronX(coaster), coaster.y + grid.length * CELL + hop);
  }

  function drawCourse() {
    if (!ctx) return;
    const left = camLeft - 160;
    const right = camLeft + viewW / S + 40;
    const step = Math.round(night * ROOF_STEPS);
    const bob = reduceMotion ? 0 : 1;

    // Steam first: it rises out of the alley between the roofs.
    for (const chunk of state.chunks) {
      if (chunk.x1 < left || chunk.x0 > right) continue;
      for (const item of chunk.items) if (item.type === "vent" && item.x1 > left && item.x0 < right) drawVent(item);
    }

    // The roofs.
    for (const chunk of state.chunks) {
      if (chunk.x1 < left || chunk.x0 > right) continue;
      for (let index = 0; index < chunk.roofs.length; index++) {
        const roof = chunk.roofs[index];
        if (roof.x1 < left || roof.x0 > right) continue;
        const art = roofCanvas(chunk.id, index, roof, step);
        const head = roofHead(roof);
        const x = Math.round(sx(roof.x0));
        const y = Math.round(sy(roof.top + head * CELL));
        ctx.drawImage(art, x, y, Math.round(sx(roof.x0 + art.width * CELL)) - x, Math.round(art.height * CELL * S));
      }
    }

    // Poles, cables and the ropes of scaffold planks, behind what stands on the roofs.
    for (const chunk of state.chunks) {
      if (chunk.x1 < left || chunk.x0 > right + 200) continue;
      for (const item of chunk.items) {
        if (item.type === "cable" && item.x1 > left && item.x0 < right) drawCable(item);
        else if (item.type === "ledge" && item.x1 > left && item.x0 < right) drawLedgeRopes(item);
      }
    }

    // What stands on the roofs, then the customers, then pigeons and pearls on top.
    for (const chunk of state.chunks) {
      if (chunk.x1 < left || chunk.x0 > right) continue;
      for (const item of chunk.items) {
        const o = item as any;
        if (o.x1 !== undefined && (o.x1 < left || o.x0 > right)) continue;
        switch (item.type) {
          case "ac":
          case "tank":
          case "crate":
          case "clothesline":
          case "billboard": {
            if (item.broken && item.type !== "crate") break;
            const v = item.broken ? 2 : 0;
            const art = artFor(item, v);
            if (item.hit && !item.broken) ctx.globalAlpha = 0.45;
            if (item.type === "clothesline") blit(art.key, art.grid, ITEM_PAL, item.x0, item.y0 + 11);
            else if (item.type === "billboard") blit(art.key, art.grid, ITEM_PAL, item.x0, item.y1);
            else if (v === 2) blit(art.key, art.grid, ITEM_PAL, item.x0 - 2, item.y0 + BROKEN_CRATE.length * CELL);
            else blit(art.key, art.grid, ITEM_PAL, item.x0, item.y1);
            ctx.globalAlpha = 1;
            break;
          }
          case "awning": {
            const bounced = squashed.get(item);
            const v = bounced !== undefined && clock - bounced < 0.22 ? 3 : 0;
            const art = artFor(item, v);
            blit(art.key, art.grid, ITEM_PAL, item.x0, item.y);
            break;
          }
          case "ledge": {
            const art = artFor(item, 0);
            blit(art.key, art.grid, ITEM_PAL, item.x0, item.y);
            break;
          }
          case "coaster": {
            blit(item.hard ? "sr-coaster-hard" : "sr-coaster", item.hard ? COASTER_HARD : COASTER_GRID, ITEM_PAL, item.x0, item.y + 2 * CELL);
            if (item.customer) drawCustomer(item);
            break;
          }
        }
      }
    }
    for (const chunk of state.chunks) {
      if (chunk.x1 < left || chunk.x0 > right) continue;
      for (const item of chunk.items) {
        if (item.type === "pigeon") {
          if (item.state === "struck") continue;
          const p = pigeonPosition(item);
          if (p.x < left || p.x > right) continue;
          let frame = "sit0";
          if (item.state === "fly") frame = Math.floor(clock * 14 + item.x) % 2 ? "fly0" : "fly1";
          else if (!reduceMotion && Math.floor(clock * 1.6 + item.x * 0.37) % 3 === 0) frame = "sit1";
          blit(`sr-pigeon-${frame}`, PIGEON[frame], PIGEON_PAL, p.x - 6, p.y + 4 * CELL);
        } else if (item.type === "pearl") {
          if (item.taken || item.x < left || item.x > right) continue;
          const lift = bob ? Math.round(Math.sin(clock * 3.2 + item.x * 0.05) * 1.5) : 0;
          blit("sr-pearl", PEARL_GRID, ITEM_PAL, item.x - 4, item.y + 4 + lift);
        }
      }
    }
  }

  function drawVent(vent: any) {
    if (!ctx) return;
    // The exhaust grate down at the street.
    const gx = Math.round(sx(vent.x0 + 6));
    const gw = Math.round((vent.x1 - vent.x0 - 12) * S);
    const gy = Math.round(sy(6));
    ctx.fillStyle = INK;
    ctx.fillRect(gx, gy, gw, Math.round(6 * S));
    ctx.fillStyle = "#6a6472";
    for (let x = vent.x0 + 9; x < vent.x1 - 8; x += 5) ctx.fillRect(Math.round(sx(x)), gy + Math.round(S), Math.max(2, Math.round(2 * S)), Math.round(4 * S));
    // Columns of steam cells rising to the ceiling, thinning as they go.
    const height = vent.ceiling + 24;
    const cell = CELL * S;
    const t = reduceMotion ? 0 : clock;
    ctx.fillStyle = STEAM;
    let column = 0;
    for (let x = vent.x0 + 7; x < vent.x1 - 5; x += 8) {
      column++;
      const seed = ihash(column * 31 + Math.round(vent.x0));
      const speed = 70 + seed * 40;
      for (let k = 0; k < 12; k++) {
        const rise = (t * speed + (k / 12) * height + seed * height) % height;
        const f = rise / height;
        const sway = reduceMotion ? 0 : Math.sin(t * 2 + k + seed * 6) * 3 * f;
        const size = Math.round(cell * (1 + f * 1.6));
        ctx.globalAlpha = quarters(1 - f * 0.85) * 0.75;
        ctx.fillRect(Math.round(sx(x + sway) - size / 2), Math.round(sy(6 + rise) - size / 2), size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawCable(cable: any) {
    if (!ctx) return;
    const pole = (x: number, top: number) => {
      const base = roofTopAt(x);
      const foot = base < 0 ? 0 : base;
      const x0 = Math.round(sx(x - 1.5));
      const y0 = Math.round(sy(top + 6));
      ctx!.fillStyle = "#3b3540";
      ctx!.fillRect(x0, y0, Math.max(3, Math.round(3 * S)), Math.round(sy(foot)) - y0);
      ctx!.fillStyle = "#6a6472";
      ctx!.fillRect(x0 - Math.round(3 * S), y0, Math.round(9 * S), Math.max(2, Math.round(2 * S)));
      ctx!.fillStyle = "#dba84d";
      ctx!.fillRect(x0, y0 - Math.round(2 * S), Math.max(3, Math.round(3 * S)), Math.round(2 * S));
    };
    pole(cable.x0, cable.y0);
    pole(cable.x1, cable.y1);
    // Stepped, a cell at a time, with a pale underline so it reads at night.
    const h = Math.max(2, Math.round(1.2 * S));
    for (let x = cable.x0; x < cable.x1; x += CELL) {
      const y = Math.round(sy(cableY(cable, x)));
      const x0 = Math.round(sx(x));
      const w = Math.round(sx(x + CELL)) - x0;
      ctx.fillStyle = HALO;
      ctx.fillRect(x0, y + h, w, 1);
      ctx.fillStyle = INK;
      ctx.fillRect(x0, y, w, h);
    }
  }

  function drawLedgeRopes(ledge: any) {
    if (!ctx) return;
    ctx.fillStyle = "#8a8296";
    const w = Math.max(1, Math.round(S * 0.8));
    for (const x of [ledge.x0 + 4, ledge.x1 - 4]) {
      const top = Math.round(sy(ledge.y + 90));
      ctx.fillRect(Math.round(sx(x)), top, w, Math.round(sy(ledge.y)) - top);
    }
  }

  // --- The runner -----------------------------------------------------------------------------

  interface Ghost {
    x: number;
    y: number;
    key: string;
    grid: string[];
    lift: number;
    anchor: number;
  }
  const ghosts: Ghost[] = [];
  let ghostClock = 0;
  const pose = { key: "", grid: [] as string[], lift: 0, anchor: 4.5, rotor: false };

  /** Picks this frame's runner grid. */
  function choosePose() {
    const r = state.runner;
    let head = "straw";
    let legs = "stand";
    let lift = 0;
    let anchor = 4.5;
    let lean = false;
    const arm = clock - handoffAt < 0.28;
    pose.rotor = false;
    if (mode === "countdown") {
      legs = "stand";
    } else if (r.cable) {
      head = "hook";
      legs = "hang";
      lift = -1;
    } else if (r.sliding) {
      legs = "slide";
      anchor = 5;
    } else if (r.slamming) {
      legs = "slam";
    } else if (!r.grounded) {
      if (r.gliding) {
        pose.rotor = true;
        head = `rotor${reduceMotion ? 0 : Math.floor(clock * 36) % 3}`;
        legs = "glide";
      } else if (r.vy > 60) {
        legs = "tuck";
        lift = 1;
      } else {
        legs = "fall";
      }
    } else if (r.stumble > 0) {
      lean = true;
      legs = "run0";
      anchor = 5;
    } else {
      legs = `run${Math.floor(r.x / 10) % 4}`;
    }
    let level = Math.round(displayTea * TEA_CELLS);
    if (displayTea > 0.01 && level === 0) level = 1;
    const tilt = reduceMotion ? 0 : slosh > 0.3 ? 1 : slosh < -0.3 ? -1 : 0;
    const key = `sr-${head}-${legs}-${tilt}-${level}-${arm ? 1 : 0}-${lean ? 1 : 0}`;
    pose.key = key;
    pose.grid = runnerGrid(key, head, legs, tilt, level, arm, lean);
    pose.lift = lift;
    pose.anchor = anchor;
  }

  function drawSpriteAt(key: string, grid: string[], palette: Record<string, string>, x: number, y: number, lift: number, anchor: number, halo: boolean) {
    if (!ctx) return;
    const sprite = cachedSprite(key, grid, px, palette, halo ? HALO : "");
    const left = sx(x - anchor * CELL) - SPRITE_PAD * pk;
    const top = sy(y + lift * CELL + grid.length * CELL) - SPRITE_PAD * pk;
    ctx.drawImage(sprite, Math.round(left), Math.round(top), Math.round(sprite.width * pk), Math.round(sprite.height * pk));
  }

  function drawRunner() {
    if (!ctx || state.status !== "running") return;
    choosePose();
    const r = state.runner;
    const since = clock - respawnAt;
    let alpha = 1;
    if (since < RESPAWN_GRACE) {
      if (reduceMotion) alpha = 0.55;
      else if (Math.floor(since * 10) % 2 === 1) alpha = 0.25;
    }
    // Afterimages in a rush.
    if (state.rush > 0 && !reduceMotion) {
      for (let index = ghosts.length - 1; index >= 0; index--) {
        const ghost = ghosts[index];
        ctx.globalAlpha = 0.34 * (1 - index / ghosts.length);
        drawSpriteAt(`${ghost.key}-ghost`, ghost.grid, GHOST_PAL, ghost.x, ghost.y, ghost.lift, ghost.anchor, false);
      }
    }
    ctx.globalAlpha = alpha;
    const flashing = state.rush > 0 && (reduceMotion || Math.floor(clock * 12) % 2 === 0);
    const palette = flashing ? RUSH_PAL : RUNNER_PAL;
    drawSpriteAt(`${pose.key}${flashing ? "-rush" : ""}`, pose.grid, palette, r.x, r.y, pose.lift, pose.anchor, true);
    ctx.globalAlpha = 1;
    // The cable's trolley over the hook.
    if (r.cable) {
      const cx = Math.round(sx(r.x + CELL));
      const cy = Math.round(sy(cableY(r.cable, r.x + CELL)));
      ctx.fillStyle = "#dba84d";
      ctx.fillRect(cx - Math.round(2 * S), cy - Math.round(3 * S), Math.round(5 * S), Math.round(3 * S));
    }
  }

  function stepGhosts(dt: number) {
    if (state.rush <= 0 || state.status !== "running") {
      ghosts.length = 0;
      return;
    }
    ghostClock += dt;
    if (ghostClock < 0.035) return;
    ghostClock = 0;
    const r = state.runner;
    const ghost = ghosts.length >= 6 ? ghosts.pop()! : ({} as Ghost);
    ghost.x = r.x;
    ghost.y = r.y;
    ghost.key = pose.key;
    ghost.grid = pose.grid;
    ghost.lift = pose.lift;
    ghost.anchor = pose.anchor;
    ghosts.unshift(ghost);
  }

  // --- Particles ------------------------------------------------------------------------------

  const B_DUST = 0;
  const B_TEA = 1;
  const B_FEATHER = 2;
  const B_SPARK = 3;
  const B_PLANK = 4;
  const B_POP = 5;
  const B_FLY = 6;
  const B_DRAFT = 7;
  const B_STEAM = 8;
  const B_CONFETTI = 9;

  interface Bit {
    kind: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    life: number;
    size: number;
    color: string;
    seed: number;
    ox: number;
    oy: number;
    front: boolean;
  }
  const bits: Bit[] = Array.from({ length: MAX_BITS }, () => ({
    kind: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 1,
    size: 1,
    color: CREAM,
    seed: 0,
    ox: 0,
    oy: 0,
    front: false,
  }));
  let liveBits = 0;

  function spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, front = true) {
    if (liveBits >= MAX_BITS) return null;
    const bit = bits[liveBits++];
    bit.kind = kind;
    bit.x = x;
    bit.y = y;
    bit.vx = vx;
    bit.vy = vy;
    bit.age = 0;
    bit.life = life;
    bit.size = size;
    bit.color = color;
    bit.seed = Math.random();
    bit.ox = x;
    bit.oy = y;
    bit.front = front;
    return bit;
  }

  /** Under Reduce Motion, effects become brief still marks. */
  function still(kind: number, x: number, y: number, size: number, color: string, life = 0.25) {
    spawn(kind, x, y, 0, 0, life, size, color);
  }

  function dustBurst(x: number, y: number, count: number, force: number) {
    if (reduceMotion) {
      still(B_DUST, x - 6, y + 1, 1, DUST[1], 0.2);
      still(B_DUST, x + 6, y + 1, 1, DUST[1], 0.2);
      return;
    }
    for (let k = 0; k < count; k++) {
      const side = k % 2 ? 1 : -1;
      spawn(B_DUST, x + side * (2 + Math.random() * 5), y + 1, side * (20 + Math.random() * 60) * force, 8 + Math.random() * 24 * force, 0.32 + Math.random() * 0.3, Math.random() < 0.3 ? 2 : 1, DUST[k % 3], false);
    }
  }

  /** Tea sloshing out of the lid, in proportion to what was lost. */
  function teaSplash(x: number, y: number, amount: number) {
    const top = y + 18;
    if (reduceMotion) {
      still(B_TEA, x - 5, top, 1, TEA, 0.3);
      still(B_TEA, x + 5, top + 2, 1, TEA, 0.3);
      return;
    }
    const count = Math.min(40, 3 + Math.round(amount * 90));
    for (let k = 0; k < count; k++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      spawn(B_TEA, x + side * Math.random() * 6, top, side * (30 + Math.random() * 110), 90 + Math.random() * 170, 0.5 + Math.random() * 0.4, Math.random() < 0.25 ? 1.5 : 1, TEA);
    }
  }

  function feathers(x: number, y: number, count: number) {
    for (let k = 0; k < count; k++) {
      if (reduceMotion) still(B_FEATHER, x + (k - count / 2) * 3, y + 4, 1, FEATHERS[k % 2], 0.3);
      else spawn(B_FEATHER, x + (Math.random() - 0.5) * 10, y + 4 + Math.random() * 6, (Math.random() - 0.5) * 60, 20 + Math.random() * 40, 0.9 + Math.random() * 0.6, 1, FEATHERS[k % 2]);
    }
  }

  function sparks(x: number, y: number, count: number) {
    for (let k = 0; k < count; k++) {
      if (reduceMotion) {
        still(B_SPARK, x, y, 1, SPARKS[0], 0.12);
        return;
      }
      spawn(B_SPARK, x, y, -40 - Math.random() * 120, 30 + Math.random() * 90, 0.18 + Math.random() * 0.2, 1, SPARKS[k % 2]);
    }
  }

  function planks(x: number, y: number, count: number) {
    for (let k = 0; k < count; k++) {
      if (reduceMotion) still(B_PLANK, x + (k - count / 2) * 5, y - 6, 1, PLANKS[k % 2], 0.35);
      else spawn(B_PLANK, x + (Math.random() - 0.5) * 16, y - Math.random() * 14, 60 + Math.random() * 160, 140 + Math.random() * 220, 1.1, 1, PLANKS[k % 2]);
    }
  }

  function confetti(x: number, y: number, color: string) {
    for (let k = 0; k < 14; k++) {
      if (reduceMotion) {
        if (k < 4) still(B_CONFETTI, x + (k - 1.5) * 6, y + 6 + (k % 2) * 4, 1, k % 2 ? color : CREAM, 0.4);
        continue;
      }
      const angle = (k / 14) * Math.PI * 2;
      spawn(B_CONFETTI, x, y, Math.cos(angle) * (50 + Math.random() * 50), 80 + Math.sin(angle) * 60 + Math.random() * 60, 0.6 + Math.random() * 0.3, 1, k % 3 ? color : CREAM);
    }
  }

  function stepBits(dt: number) {
    const r = state.runner;
    for (let index = liveBits - 1; index >= 0; index--) {
      const bit = bits[index];
      bit.age += dt;
      let dead = bit.age >= bit.life;
      if (!dead && (bit.vx !== 0 || bit.vy !== 0 || bit.kind === B_FLY)) {
        switch (bit.kind) {
          case B_DUST:
            bit.vx *= Math.max(0, 1 - 4 * dt);
            bit.vy *= Math.max(0, 1 - 3 * dt);
            break;
          case B_TEA:
            bit.vy -= 900 * dt;
            break;
          case B_FEATHER:
            bit.vy = Math.max(bit.vy - 140 * dt, -26);
            bit.vx = bit.vx * Math.max(0, 1 - 2 * dt) + Math.sin(bit.age * 7 + bit.seed * 6) * 50 * dt;
            break;
          case B_SPARK:
          case B_CONFETTI:
            bit.vy -= 600 * dt;
            break;
          case B_PLANK:
            bit.vy -= 1100 * dt;
            break;
          case B_STEAM:
          case B_DRAFT:
            bit.vx *= Math.max(0, 1 - 3 * dt);
            break;
          case B_FLY: {
            // Pulled into the cup.
            const t = smooth(Math.min(1, bit.age / bit.life));
            bit.x = lerp(bit.ox, r.x, t);
            bit.y = lerp(bit.oy, r.y + 10, t);
            continue;
          }
        }
        bit.x += bit.vx * dt;
        bit.y += bit.vy * dt;
      }
      if (dead) {
        bits[index] = bits[liveBits - 1];
        bits[liveBits - 1] = bit;
        liveBits--;
      }
    }
  }

  function drawBits(front: boolean) {
    if (!ctx || !liveBits) return;
    const cell = CELL * S;
    for (let index = 0; index < liveBits; index++) {
      const bit = bits[index];
      if (bit.front !== front) continue;
      const t = bit.age / bit.life;
      const x = sx(bit.x);
      const y = sy(bit.y);
      if (x < -40 || x > viewW + 40) continue;
      let size = Math.max(2, Math.round(cell * bit.size));
      ctx.fillStyle = bit.color;
      switch (bit.kind) {
        case B_DUST:
        case B_STEAM:
          size = Math.round(size * (1 + t * 0.8));
          ctx.globalAlpha = quarters(1 - t) * (bit.kind === B_STEAM ? 0.6 : 0.9);
          break;
        case B_PLANK: {
          // A short plank that turns end over end.
          ctx.globalAlpha = 1;
          const flat = Math.floor(bit.age * 12 + bit.seed * 4) % 2 === 0;
          const long = size * 3;
          ctx.fillRect(Math.round(x - (flat ? long : size) / 2), Math.round(y - (flat ? size : long) / 2), flat ? long : size, flat ? size : long);
          continue;
        }
        case B_POP: {
          // A ring of four cells opening out.
          ctx.globalAlpha = quarters(1 - t);
          const reach = Math.round(cell * (1 + t * 3));
          const s = Math.max(2, Math.round(cell * 0.8));
          ctx.fillRect(Math.round(x - s / 2 - reach), Math.round(y - s / 2), s, s);
          ctx.fillRect(Math.round(x - s / 2 + reach), Math.round(y - s / 2), s, s);
          ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2 - reach), s, s);
          ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2 + reach), s, s);
          continue;
        }
        case B_FLY: {
          ctx.globalAlpha = 1;
          const s = Math.round(cell * 2);
          ctx.fillStyle = HALO;
          ctx.fillRect(Math.round(x - s / 2) - 2, Math.round(y - s / 2) - 2, s + 4, s + 4);
          ctx.fillStyle = PEARL;
          ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
          continue;
        }
        default:
          ctx.globalAlpha = t > 0.7 ? quarters((1 - t) / 0.3) : 1;
      }
      ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    }
    ctx.globalAlpha = 1;
  }

  // --- Hand-offs, notes and stamps ------------------------------------------------------------

  interface Throw {
    on: boolean;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    t: number;
    coaster: object | null;
    full: boolean;
    points: number;
    streak: number;
    color: string;
  }
  const throws: Throw[] = Array.from({ length: 4 }, () => ({
    on: false,
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
    t: 0,
    coaster: null,
    full: false,
    points: 0,
    streak: 0,
    color: TEA,
  }));
  const THROW_SECONDS = 0.34;

  interface Note {
    on: boolean;
    x: number;
    y: number;
    text: string;
    color: string;
    age: number;
    life: number;
    delay: number;
  }
  const notes: Note[] = Array.from({ length: 12 }, () => ({ on: false, x: 0, y: 0, text: "", color: CREAM, age: 0, life: 1, delay: 0 }));

  /** A note in world space, cream (or gold, or dim) on a night backing. */
  function addNote(x: number, y: number, text: string, color: string, life = 1.1, delay = 0) {
    let slot = notes.find((n) => !n.on);
    if (!slot) slot = notes.reduce((oldest, n) => (n.age > oldest.age ? n : oldest));
    slot.on = true;
    slot.x = x;
    slot.y = y;
    slot.text = text;
    slot.color = color;
    slot.age = 0;
    slot.life = life;
    slot.delay = delay;
  }

  interface Stamp {
    on: boolean;
    x: number;
    y: number;
    age: number;
  }
  const stamps: Stamp[] = Array.from({ length: 3 }, () => ({ on: false, x: 0, y: 0, age: 0 }));

  function addStamp(x: number, y: number) {
    const slot = stamps.find((s) => !s.on) ?? stamps[0];
    slot.on = true;
    slot.x = x;
    slot.y = y;
    slot.age = 0;
  }

  function stepMarks(dt: number) {
    for (const thrown of throws) {
      if (!thrown.on) continue;
      thrown.t += dt / THROW_SECONDS;
      if (thrown.t >= 1) {
        thrown.on = false;
        landCup(thrown);
      }
    }
    for (const n of notes) {
      if (!n.on) continue;
      if (n.delay > 0) {
        n.delay -= dt;
        continue;
      }
      n.age += dt;
      if (n.age >= n.life) n.on = false;
    }
    for (const s of stamps) {
      if (!s.on) continue;
      s.age += dt;
      if (s.age >= 1.5) s.on = false;
    }
  }

  function drawThrows() {
    for (const thrown of throws) {
      if (!thrown.on) continue;
      const t = thrown.t;
      const x = lerp(thrown.x0, thrown.x1, t);
      const y = lerp(thrown.y0, thrown.y1, t) + 26 * 4 * t * (1 - t);
      blit("sr-small-cup", SMALL_CUP, ITEM_PAL, x - 4, y + SMALL_CUP.length * CELL);
    }
  }

  /** Draws one note at screen (x, y): cream type on a dark backing. */
  function note(x: number, y: number, text: string, color: string, alpha: number) {
    if (!ctx) return;
    ctx.font = noteFont;
    const width = Math.ceil((ctx.measureText(text).width + 14) / SC) * SC;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = NOTE_BACK;
    ctx.fillRect(Math.round(x - width / 2), Math.round(y) - 10, width, 20);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, Math.round(x), Math.round(y) + 0.5);
    ctx.globalAlpha = 1;
  }

  function drawNotes() {
    for (const n of notes) {
      if (!n.on || n.delay > 0) continue;
      const t = n.age / n.life;
      const rise = reduceMotion ? 0 : t * 18;
      const alpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      note(sx(n.x), sy(n.y) - rise, n.text, n.color, alpha);
    }
  }

  /** "Full cup": a rubber stamp on a paper tag, thumped down. */
  function drawStamps() {
    if (!ctx) return;
    for (const s of stamps) {
      if (!s.on) continue;
      const t = s.age;
      const scale = reduceMotion ? 1 : t < 0.12 ? 1.5 - (t / 0.12) * 0.5 : 1;
      const alpha = t > 1.2 ? (1.5 - t) / 0.3 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(Math.round(sx(s.x)), Math.round(sy(s.y)));
      ctx.rotate(-0.14);
      ctx.scale(scale, scale);
      ctx.font = stampFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const width = Math.ceil(ctx.measureText("FULL CUP").width) + 18;
      ctx.fillStyle = "#fbf2e8";
      ctx.fillRect(-width / 2, -13, width, 26);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.strokeRect(-width / 2 + 3, -10, width - 6, 20);
      ctx.fillStyle = ACCENT;
      ctx.fillText("FULL CUP", 0, 1);
      ctx.restore();
    }
  }

  // --- Rush speed lines (screen space) ------------------------------------------------------

  const LINES = Array.from({ length: 14 }, (_, index) => ({
    x: Math.random(),
    y: (index + 0.5) / 14,
    length: 40 + Math.random() * 90,
    speed: 1.4 + Math.random() * 1.2,
  }));

  function stepLines(dt: number) {
    if (state.rush <= 0 || reduceMotion) return;
    for (const line of LINES) {
      line.x -= line.speed * dt;
      if (line.x < -0.2) {
        line.x = 1 + Math.random() * 0.2;
        line.length = 40 + Math.random() * 90;
      }
    }
  }

  function drawLines() {
    if (!ctx || state.rush <= 0 || reduceMotion) return;
    const fade = Math.min(1, state.rush / 0.5);
    ctx.fillStyle = CREAM;
    for (const line of LINES) {
      const y = snap(playTop + line.y * (playBottom - playTop));
      ctx.globalAlpha = 0.28 * fade;
      ctx.fillRect(snap(line.x * viewW), y, snap(line.length), SC / 2);
    }
    ctx.globalAlpha = 1;
  }

  // --- The frame ---------------------------------------------------------------------------

  function draw() {
    if (!ctx) return;
    night = clamp(state.distance / NIGHT_AT, 0, 1);
    px = Math.max(1, Math.round(CELL * S));
    pk = (CELL * S) / px;
    const step = Math.round(night * SKY_STEPS);
    if (step !== skyStep) {
      skyStep = step;
      const n = step / SKY_STEPS;
      paintSky(n);
      for (const strip of STRIPS) paintStrip(strip, n);
      paintHedge(n);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = SKY_NIGHT[0];
    ctx.fillRect(0, 0, viewW, viewH);
    if (skyCanvas) ctx.drawImage(skyCanvas, 0, 0, skyCanvas.width * SC, skyCanvas.height * SC);
    drawStars();
    drawSunAndMoon();
    drawBalloon();
    drawStrip(STRIPS[0]);
    drawStrip(STRIPS[1]);

    ctx.save();
    if (shake > 0 && !reduceMotion) {
      ctx.translate(Math.round((Math.random() - 0.5) * 10 * shake), Math.round((Math.random() - 0.5) * 10 * shake));
    }
    drawStreet();
    drawCourse();
    drawBits(false);
    drawThrows();
    drawRunner();
    drawBits(true);
    drawHedge();
    drawStamps();
    ctx.restore();
    drawLines();
    drawNotes();
    pruneArt();
  }

  // --- Camera -------------------------------------------------------------------------------

  /**
   * The scale that keeps LOOK_AHEAD seconds of course in view ahead of the
   * runner at this speed, never closer than the resting scale.
   */
  function scaleFor(speed: number) {
    return Math.min(baseS, (viewW * (1 - lead)) / (speed * LOOK_AHEAD + 24));
  }

  function updateCamera(dt: number, snapNow = false) {
    if (!viewW) return;
    const r = state.runner;
    const speed = speedAt(r.x) * (state.rush > 0 ? 1.2 : 1);
    const target = scaleFor(speed);
    S = snapNow ? target : S + (target - S) * (1 - Math.exp(-dt * 1.6));

    // Locked to the runner across; during a fall's beat it pans ahead to
    // where the runner will come back.
    if (state.status === "respawning") {
      if (clock - fallAt > 0.35) camRunX += (respawnPoint(state).x - camRunX) * (1 - Math.exp(-dt * 7));
    } else {
      camRunX = r.x;
    }
    camLeft = camRunX - (lead * viewW) / S;

    // Up and down it follows the ground, not the jump, and leans toward the
    // roofs coming up so a drop or a climb is in frame before it arrives.
    if (state.status === "running") {
      if (r.grounded || r.cable) anchorY = r.y;
      else if (r.y < anchorY - 24) anchorY = r.y + 24;
      else if (r.y > anchorY + 80) anchorY = r.y - 80;
    }
    const goal = anchorY * 0.55 + aheadTop(r.x, speed) * 0.45 + 12;
    camY = snapNow ? goal : camY + (goal - camY) * (1 - Math.exp(-dt * 3));
    // Never further down than a strip of street under the sidewalk.
    const lowest = -STREET_SHOW + (playBottom - focusY) / S;
    if (camY < lowest) camY = lowest;
  }

  function snapCamera() {
    camRunX = state.runner.x;
    anchorY = state.runner.y;
    updateCamera(0, true);
  }

  // --- Events ---------------------------------------------------------------------------------

  function findCoaster(x: number, y: number) {
    for (const chunk of state.chunks) {
      if (chunk.x1 < x - 30 || chunk.x0 > x + 30) continue;
      for (const item of chunk.items) {
        if (item.type === "coaster" && Math.abs((item.x0 + item.x1) / 2 - x) < 0.5 && Math.abs(item.y - y) < 0.5) return item;
      }
    }
    return null;
  }

  function kick(amount: number) {
    if (!reduceMotion) shake = Math.max(shake, amount);
  }

  function onEvents(events: Array<{ type: string; [key: string]: any }>) {
    for (let index = 0; index < events.length; index++) {
      const ev = events[index];
      switch (ev.type) {
        case "jump":
          sfxRunJump();
          dustBurst(ev.x, ev.y, 4, 0.7);
          if (tipVisible) tipVisible = false;
          break;
        case "slide":
          sfxRunSlide();
          dustBurst(ev.x + 6, ev.y, 3, 0.6);
          if (teach === "slide") teach = null;
          break;
        case "glide":
          if (teach === "glide") teach = null;
          break;
        case "land": {
          const hard = ev.slam || ev.impact > 600;
          if (clock - lastLandSound > 0.08) {
            lastLandSound = clock;
            sfxRunLand(hard);
          }
          const count = ev.slam ? 12 : Math.min(10, 2 + Math.round(ev.impact / 130));
          dustBurst(ev.x, ev.y, count, ev.slam ? 1.6 : Math.max(0.4, ev.impact / 520));
          if (ev.slam) kick(0.6);
          sloshV += Math.min(9, ev.impact / 90) * (Math.random() < 0.5 ? -1 : 1);
          break;
        }
        case "bounce": {
          sfxRunBounce();
          for (const chunk of state.chunks) {
            for (const item of chunk.items) {
              if (item.type === "awning" && ev.x >= item.x0 - 8 && ev.x <= item.x1 + 8 && Math.abs(item.y - ev.y) < 1) squashed.set(item, clock);
            }
          }
          dustBurst(ev.x, ev.y, 4, 0.8);
          sloshV += 6;
          break;
        }
        case "wall":
          sfxRunBump();
          kick(0.45);
          break;
        case "spill":
          if (clock - lastSpillSound > 0.12) {
            lastSpillSound = clock;
            sfxRunSpill(Math.min(1, ev.amount * 3));
          }
          teaSplash(ev.x, ev.y, ev.amount);
          sloshV += 8 * (Math.random() < 0.5 ? -1 : 1);
          displayTea = Math.min(displayTea, state.tea);
          refillAt = -10;
          break;
        case "bump":
          sfxRunBump();
          kick(0.5);
          break;
        case "smash":
          sfxRunSmash();
          planks(ev.x, ev.y, ev.what === "crate" ? 8 : 5);
          addNote(ev.x, ev.y + 24, `+${ev.points}`, CREAM, 0.9);
          kick(0.3);
          break;
        case "strike":
          feathers(ev.x, ev.y, 10);
          kick(0.25);
          break;
        case "pigeonsUp":
          for (const chunk of state.chunks) {
            for (const item of chunk.items) {
              if (item.type === "pigeon" && item.state === "fly" && item.t < STEP * 1.5) feathers(item.x, item.y, 2);
            }
          }
          break;
        case "pearl": {
          if (clock - lastPearlSound > 0.035) {
            lastPearlSound = clock;
            sfxRunPearl(ev.combo);
          }
          if (ev.magnet && !reduceMotion) spawn(B_FLY, ev.x, ev.y, 0, 0, 0.16, 1, PEARL);
          else if (reduceMotion) still(B_POP, ev.x, ev.y, 1, CREAM, 0.15);
          else spawn(B_POP, ev.x, ev.y, 0, 0, 0.26, 1, CREAM);
          if (ev.combo > lastCombo) addNote(ev.x, ev.y + 16, `pearls ×${ev.combo}`, NOTE_GOLD, 0.9);
          lastCombo = ev.combo;
          break;
        }
        case "comboLost":
          lastCombo = 1;
          break;
        case "rushStart":
          sfxRushStart();
          rushFlashAt = clock;
          liveMessage = "Sugar rush.";
          if (teach === "rush") teach = null;
          dustBurst(ev.x, ev.y, 10, 1.4);
          break;
        case "rushEnd":
          sfxRushEnd();
          break;
        case "delivery":
          delivered(ev);
          break;
        case "miss": {
          const coaster = findCoaster(ev.x, ev.y);
          if (coaster) {
            const patron = patronOf(coaster);
            patron.state = "slump";
            patron.at = clock;
          }
          addNote(ev.x + 4, ev.y + 34, "missed", NOTE_DIM, 0.9);
          break;
        }
        case "cableOn":
          sparks(ev.x, ev.y + 18, 6);
          break;
        case "cableOff":
          if (ev.jump) sfxRunJump();
          break;
        case "vent":
          for (let k = 0; k < 10; k++) {
            if (reduceMotion) break;
            spawn(B_STEAM, ev.x + (Math.random() - 0.5) * 20, ev.y + Math.random() * 10, (Math.random() - 0.5) * 30, 40 + Math.random() * 50, 0.6 + Math.random() * 0.3, 1.5, STEAM, false);
          }
          break;
        case "fall":
          sfxRunFall();
          setRunGlide(0);
          fallAt = clock;
          lives = state.lives;
          livesPulse += 1;
          liveMessage = state.lives > 0 ? `Fell off the roofs. ${pearlsLeft(state.lives)}` : "Fell off the roofs.";
          break;
        case "dry":
          sfxRunSpill(1);
          lives = state.lives;
          livesPulse += 1;
          addNote(ev.x, ev.y + 34, "dry", NOTE_DIM, 1);
          refillFrom = 0;
          refillAt = clock;
          liveMessage = state.lives > 0 ? `The cup ran dry. ${pearlsLeft(state.lives)}` : "The cup ran dry.";
          break;
        case "respawn":
          respawnAt = clock;
          anchorY = state.runner.y;
          displayTea = state.tea;
          break;
        case "over":
          setRunGlide(0);
          overAt = clock;
          mode = "over";
          break;
        case "phase":
          setMusicPhase(ev.phase);
          break;
      }
    }
  }

  const pearlsLeft = (n: number) => `${n} ${n === 1 ? "pearl" : "pearls"} left.`;

  /** The heartbeat: a cup handed off, caught, and paid for. */
  function delivered(ev: { [key: string]: any }) {
    const r = state.runner;
    const coaster = findCoaster(ev.x, ev.y);
    sfxRunDeliver(ev.full);
    handoffAt = clock;
    refillFrom = Math.min(displayTea, ev.tea);
    refillAt = clock;
    liveMessage = `Delivered${ev.full ? " a full cup" : ""} for ${ev.points} points.`;
    const thrown = throws.find((t) => !t.on) ?? throws[0];
    thrown.on = true;
    thrown.t = 0;
    thrown.x0 = r.x + 6;
    thrown.y0 = r.y + 12;
    thrown.coaster = coaster;
    thrown.x1 = coaster ? patronX(coaster) + 1 : ev.x + 8;
    thrown.y1 = ev.y + 28;
    thrown.full = ev.full;
    thrown.points = ev.points;
    thrown.streak = ev.streak;
    thrown.color = DRINKS[Math.floor(Math.random() * DRINKS.length)];
    if (coaster) {
      const patron = patronOf(coaster);
      patron.state = "expect";
      patron.at = clock;
    }
    // A short pour into the cup as it refills.
    if (!reduceMotion) {
      for (let k = 0; k < 8; k++) spawn(B_TEA, r.x + (Math.random() - 0.5) * 4, r.y + 30 + k * 4, 0, -220, 0.12 + k * 0.02, 1, TEA);
    }
  }

  function landCup(thrown: Throw) {
    const coaster = thrown.coaster as any;
    const x = thrown.x1 + 6;
    const y = coaster ? coaster.y : thrown.y1 - 28;
    if (coaster) {
      const patron = patronOf(coaster);
      patron.state = "catch";
      patron.at = clock;
    }
    confetti(thrown.x1 + 3, thrown.y1 + 4, thrown.color);
    addNote(x, y + 44, `+${thrown.points}`, thrown.full ? NOTE_GOLD : CREAM, 1.2);
    if (thrown.streak >= 2) addNote(x, y + 58, `streak ${thrown.streak}`, CREAM, 1.2, 0.12);
    if (thrown.full) addStamp(x + 32, y + 30);
  }

  // --- Teaching, once per device ------------------------------------------------------------

  function readTaught() {
    for (const kind of ["slide", "glide", "rush"] as TeachKind[]) {
      try {
        taught[kind] = window.localStorage.getItem(TEACH_KEYS[kind]) === "1";
      } catch {
        taught[kind] = false;
      }
    }
  }

  function showTeach(kind: TeachKind) {
    teach = kind;
    teachAge = 0;
    taught[kind] = true;
    try {
      window.localStorage.setItem(TEACH_KEYS[kind], "1");
    } catch {
      // Without storage it may show again next visit; that is all.
    }
  }

  /** The first time each move is about to matter, one caption says so. */
  function checkTeach() {
    if (teach || tipVisible || state.status !== "running") return;
    const r = state.runner;
    const reach = r.vx * 1.3;
    if (!taught.rush && state.sugar >= SUGAR_FULL && state.rush === 0) {
      showTeach("rush");
      return;
    }
    if (taught.slide && taught.glide) return;
    for (const chunk of state.chunks) {
      if (chunk.x1 < r.x || chunk.x0 > r.x + reach) continue;
      if (!taught.slide && r.grounded) {
        for (const item of chunk.items) {
          if ((item.type === "clothesline" || item.type === "billboard") && !item.hit && item.x0 > r.x && item.x0 - r.x < reach) {
            showTeach("slide");
            return;
          }
        }
      }
      if (!taught.glide) {
        for (const gap of chunk.gaps) {
          if (gap.assist === "drop" && gap.x0 > r.x && gap.x0 - r.x < r.vx * 0.9) {
            showTeach("glide");
            return;
          }
        }
      }
    }
  }

  // --- Running -------------------------------------------------------------------------------

  function controls() {
    input.jump = keys.jump || touchHeld.jump;
    input.down = keys.down || touchHeld.down;
    input.rush = keys.rush || touchHeld.rush;
    return input;
  }

  function run(dt: number) {
    accumulator += dt;
    const held = controls();
    while (accumulator >= STEP && state.status !== "over") {
      accumulator -= STEP;
      const events = stepRun(state, held, STEP);
      if (events.length) onEvents(events);
    }
    if (state.status === "over") accumulator = 0;
  }

  /** Everything that moves with the run but isn't a rule: tea, slosh, effects. */
  function stepScene(dt: number) {
    const r = state.runner;
    // The cup's tea: drops at once, refills over a moment.
    if (refillAt > 0 && clock - refillAt < 0.45) {
      displayTea = lerp(refillFrom, state.tea, smooth((clock - refillAt) / 0.45));
    } else {
      displayTea = state.tea;
    }
    // A spring for the slosh, driven by how hard the cup is shoved up and down.
    const accel = (r.vy - lastVy) / Math.max(dt, 1e-3);
    lastVy = r.vy;
    if (Math.abs(accel) > 2500 && r.grounded) sloshV += clamp(accel / 3000, -4, 4);
    sloshV += (-slosh * 60 - sloshV * 5) * dt;
    slosh += sloshV * dt;
    if (!r.grounded && !r.cable) slosh += (clamp(-r.vy / 600, -1, 1) - slosh) * Math.min(1, dt * 6);

    if (state.status === "running") {
      if (r.gliding && !reduceMotion) {
        draftClock += dt;
        if (draftClock > 0.05) {
          draftClock = 0;
          spawn(B_DRAFT, r.x - 7 + Math.random() * 2, r.y + 18, -10, -110, 0.22, 1, CREAM, false);
          spawn(B_DRAFT, r.x + 7 - Math.random() * 2, r.y + 18, 10, -110, 0.22, 1, CREAM, false);
        }
      }
      if (r.cable) {
        sparkClock += dt;
        if (sparkClock > 0.06) {
          sparkClock = 0;
          sparks(r.x + CELL, cableY(r.cable, r.x + CELL), reduceMotion ? 1 : 3);
        }
      }
      if (r.sliding && !reduceMotion) {
        slideDustClock += dt;
        if (slideDustClock > 0.05) {
          slideDustClock = 0;
          spawn(B_DUST, r.x - 4, r.y + 1, -40, 10, 0.3, 1, DUST[1], false);
        }
      }
      if (r.venting && !reduceMotion && Math.random() < dt * 30) {
        spawn(B_STEAM, r.x + (Math.random() - 0.5) * 18, r.y + Math.random() * 6, (Math.random() - 0.5) * 20, 60, 0.5, 1.5, STEAM, false);
      }
    }
    setRunGlide(state.status === "running" && r.gliding ? 1 : 0);
    stepBits(dt);
    stepMarks(dt);
    stepGhosts(dt);
    stepLines(dt);
    stepBalloon(dt);
    shake = Math.max(0, shake - dt / 0.35);
    if (teach) {
      teachAge += dt;
      if (teachAge >= TEACH_SECONDS) teach = null;
    }
  }

  function syncHud() {
    score = state.score;
    combo = state.combo.chain > 0 ? comboMultiplier(state.combo.chain) : 1;
    streak = state.streak;
    rushing = state.rush > 0;
    rushReady = !rushing && state.sugar >= SUGAR_FULL;
    sugarPips = rushing ? Math.ceil((state.rush / RUSH_TIME) * 10) : Math.floor((state.sugar / SUGAR_FULL) * 10);
    teaShown = displayTea;
    lives = state.lives;
  }

  function frame(timestamp: number) {
    if (!active) return;
    if (!last) last = timestamp;
    const rawDt = (timestamp - last) / 1000;
    last = timestamp;
    const dt = Math.min(rawDt, 0.05);
    if (paused) {
      draw();
      raf = requestAnimationFrame(frame);
      return;
    }
    advance(dt, rawDt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function advance(dt: number, rawDt = dt) {
    clock += dt;
    if (mode === "countdown") {
      const step = stepCountdown(countdownElapsed, countdown, Math.min(rawDt, 0.25));
      countdownElapsed = step.elapsed;
      if (step.beep) {
        countdown = step.count;
        sfxCountdown(countdown);
      }
      if (step.done) begin();
    } else if (mode === "running") {
      run(dt);
      checkTeach();
    } else if (mode === "over" && !gameOver && clock - overAt >= OVER_SECONDS) {
      void endGame();
    }
    stepScene(dt);
    updateCamera(dt);
    hudClock += dt;
    if (hudClock >= 0.1) {
      hudClock = 0;
      syncHud();
    }
  }

  // --- Input ---------------------------------------------------------------------------

  const KEY_CONTROLS: Record<string, keyof Held> = {
    " ": "jump",
    ArrowUp: "jump",
    w: "jump",
    ArrowDown: "down",
    s: "down",
    x: "rush",
    Shift: "rush",
  };

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Tab") {
      onPlayfieldTab(event);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (gameOver || paused) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if ((key === " " || key === "Enter") && isOnControl(event)) return;
    const control = KEY_CONTROLS[key];
    if (!control) return;
    event.preventDefault();
    keys[control] = true;
  }

  function onKeyUp(event: KeyboardEvent) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const control = KEY_CONTROLS[key];
    if (control) keys[control] = false;
  }

  function releaseAll() {
    keys.jump = keys.down = keys.rush = false;
    if (touchHeld.jump || touchHeld.down || touchHeld.rush) touchHeld = { jump: false, down: false, rush: false };
  }

  function holdPad(control: keyof Held, down: boolean) {
    if (down && (paused || gameOver)) return;
    if (touchHeld[control] === down) return;
    touchHeld = { ...touchHeld, [control]: down };
  }

  function padDown(event: PointerEvent, control: keyof Held) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety; the up and cancel handlers still release.
    }
    holdPad(control, true);
  }

  function padKey(event: KeyboardEvent, control: keyof Held, down: boolean) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (down && event.repeat) return;
    holdPad(control, down);
  }

  // --- Pause, restart, and finish --------------------------------------------------------

  async function pauseGame() {
    if (gameOver || paused) return;
    paused = true;
    releaseAll();
    setRunGlide(0);
    setMusicPaused(true);
    liveMessage = "Game paused";
    await tick();
    pauseCard?.focus();
  }

  function resumeGame() {
    if (gameOver || !paused) return;
    paused = false;
    last = 0;
    setMusicPaused(false);
    sfxBlip();
    liveMessage = "Game resumed";
    focusPlayfield();
  }

  function focusPlayfield() {
    playfield?.focus({ preventScroll: true });
  }

  function onPlayfieldTab(event: KeyboardEvent) {
    if (event.key !== "Tab" || !event.shiftKey || document.activeElement !== playfield) return;
    const buttons = playScope?.querySelectorAll<HTMLElement>("button:not([disabled])");
    const lastControl = buttons?.[buttons.length - 1];
    if (!lastControl) return;
    event.preventDefault();
    lastControl.focus();
  }

  function togglePause() {
    if (paused) resumeGame();
    else void pauseGame();
  }

  async function endGame() {
    if (gameOver) return;
    gameOver = true;
    releaseAll();
    setRunGlide(0);
    syncHud();
    finalStats = breakdown(state);
    const result = concludeRun("runner", state.score);
    localBest = result.best;
    newBest = result.newBest;
    liveMessage = `Clocked out. Final score ${state.score}.`;
    await tick();
    slip?.focus();
  }

  function begin() {
    countdown = 0;
    goVisible = true;
    timers.later(() => (goVisible = false), 620);
    mode = "running";
    setMusicPhase(state.phase);
    startMusic();
    sfxStart();
    if (document.activeElement instanceof HTMLButtonElement && playScope?.contains(document.activeElement)) focusPlayfield();
  }

  function newShift() {
    state = newRun(Math.floor(Math.random() * 2 ** 31));
    mode = "countdown";
    accumulator = 0;
    countdown = COUNTDOWN_SECONDS;
    countdownElapsed = 0;
    goVisible = false;
    newBest = false;
    teach = null;
    displayTea = 1;
    refillAt = -10;
    respawnAt = -10;
    fallAt = -10;
    handoffAt = -10;
    slosh = 0;
    sloshV = 0;
    lastVy = 0;
    lastCombo = 1;
    liveBits = 0;
    ghosts.length = 0;
    for (const thrown of throws) thrown.on = false;
    for (const n of notes) n.on = false;
    for (const s of stamps) s.on = false;
    roofArt.clear();
    firstChunk = 0;
    balloon.on = false;
    balloon.wait = 20 + Math.random() * 20;
    livesPulse = 0;
    last = 0;
    snapCamera();
    syncHud();
  }

  function restart() {
    stopMusic();
    timers.clear();
    releaseAll();
    setRunGlide(0);
    paused = false;
    gameOver = false;
    newShift();
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
  }

  // --- Sizing and lifecycle --------------------------------------------------------------

  function sizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    ctx = fitCanvas(canvas, viewW, viewH);
    playTop = hudRow ? hudRow.getBoundingClientRect().bottom : 80;
    // On touch the course stays above the thumb buttons.
    const padsTop = touchUI && padsRow ? padsRow.getBoundingClientRect().top : viewH;
    playBottom = Math.max(playTop + 180, Math.min(viewH, padsTop - 8));
    focusY = playTop + (playBottom - playTop) * 0.6;
    horizonY = playTop + (playBottom - playTop) * 0.68;
    const wide = viewW >= viewH * 1.05;
    lead = wide ? 0.28 : 0.2;
    baseS = Math.min(viewW / (wide ? 560 : 300), (playBottom - playTop) / 230);
    stripS = baseS;
    sunR = Math.max(5, Math.round((Math.min(viewW, viewH) * 0.07) / SC));
    moonR = Math.max(4, Math.round((Math.min(viewW, viewH) * 0.04) / SC));
    sunCanvas = paintDisc(sunR, SUN, SUN_RIM, false);
    moonCanvas = paintDisc(moonR, MOON, MOON_SHADE, true);
    for (const strip of STRIPS) buildStrip(strip);
    buildHedge();
    skyStep = -1;
    snapCamera();
    draw();
  }

  /**
   * Repaints every cached canvas. A browser may drop the pixels of offscreen
   * canvases while the page is hidden, so this runs when it comes back.
   */
  function repaintCaches() {
    clearSpriteCache();
    roofArt.clear();
    skyStep = -1;
    sunCanvas = paintDisc(sunR, SUN, SUN_RIM, false);
    moonCanvas = paintDisc(moonR, MOON, MOON_SHADE, true);
  }

  function onVisible() {
    if (!document.hidden) repaintCaches();
  }

  async function syncTouchUI() {
    const next = coarse || touchSeen;
    if (next === touchUI) return;
    touchUI = next;
    await tick();
    sizeCanvas();
  }

  onMount(() => {
    noteFont = arcadeFont(13, 500);
    stampFont = arcadeFont(12, 500);
    readTaught();
    const unmountShell = mountShell({
      isOver: () => gameOver,
      isPaused: () => paused,
      pause: () => void pauseGame(),
      togglePause,
      playScope: () => playScope,
      onResize: sizeCanvas,
      observe: hudRow,
      onReduceMotion: (reduce) => (reduceMotion = reduce),
    });

    const coarseQuery = window.matchMedia("(hover: none) and (pointer: coarse)");
    const onCoarse = () => {
      coarse = coarseQuery.matches;
      void syncTouchUI();
    };
    const onFirstTouch = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || touchSeen) return;
      touchSeen = true;
      void syncTouchUI();
    };
    coarse = coarseQuery.matches;
    touchUI = coarse;
    coarseQuery.addEventListener("change", onCoarse);
    window.addEventListener("pointerdown", onFirstTouch, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", onVisible);

    newShift();
    tick().then(() => {
      if (!active) return;
      sizeCanvas();
      tipVisible = firstVisit("runner");
      sfxCountdown(COUNTDOWN_SECONDS);
      liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
      raf = requestAnimationFrame(frame);
    });

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      timers.clear();
      setRunGlide(0);
      stopMusic();
      coarseQuery.removeEventListener("change", onCoarse);
      window.removeEventListener("pointerdown", onFirstTouch, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onVisible);
      unmountShell();
    };
  });

  $: deliveries = finalStats.deliveries;
</script>

<div class="boba-stage sr-stage" aria-hidden="true"></div>
<canvas bind:this={canvas} class="boba-canvas" aria-hidden="true"></canvas>

<div bind:this={playScope} class="sr-play">
  <!-- Where focus rests during the run: not a button, so Space stays the
       jump key. -->
  <div bind:this={playfield} class="sr-only" tabindex="-1" role="group" aria-label="Sugar rush playfield"></div>
  <header class="boba-hud boba-ui is-bare" aria-label="Sugar rush status">
    <div bind:this={hudRow} class="boba-hud-row">
      <div class="boba-ticket boba-ticket-start boba-riso" style="--tilt: -1.1deg">
        <span class="boba-ticket-icon" aria-hidden="true">
          <PixelIcon grid={MENU_ICONS.runner.grid} palette={MENU_ICONS.runner.palette} px={3} />
        </span>
        <span class="boba-stack sr-score">
          <span class="boba-big">{String(score).padStart(5, "0")}</span>
          {#if combo > 1}
            {#key combo}
              <span class="boba-combo active">pearls ×{combo}</span>
            {/key}
          {/if}
        </span>
      </div>

      <div
        class="boba-ticket boba-ticket-center boba-riso sr-middle"
        class:has-slab={rushReady}
        style="--tilt: 0.8deg"
      >
        <span class="sr-readout">
          <span class="boba-meta">streak</span>
          <span class="sr-value">{streak}</span>
        </span>
        <span
          class="sr-sugar"
          class:is-ready={rushReady}
          class:is-rushing={rushing}
          role="img"
          aria-label={rushing ? "Sugar rush running" : rushReady ? "Sugar rush ready" : `Sugar ${sugarPips} of 10`}
        >
          <span class="sr-sugar-label" aria-hidden="true">
            {#if rushReady}
              <span class="boba-phase">rush</span>
              <span class="boba-keys"><kbd>X</kbd></span>
            {:else}
              <span class="boba-meta">{rushing ? "rushing" : "sugar"}</span>
            {/if}
          </span>
          <span class="sr-pips" aria-hidden="true">
            {#each Array(10) as _, index}
              <span class="sr-pip" class:is-full={index < sugarPips}></span>
            {/each}
          </span>
        </span>
      </div>

      <div class="boba-ticket boba-ticket-end boba-riso" style="--tilt: -0.6deg">
        <span class="boba-stack sr-tea">
          <CupTimer fraction={teaShown} rush={teaShown < 0.25} />
          <span class="boba-meta sr-tea-label">tea</span>
        </span>
        <Pearls left={lives} total={START_LIVES} pulse={livesPulse} />
        <HudButtons {paused} on:pause={togglePause} />
      </div>
    </div>

    {#if tipVisible && !paused}
      <div class="boba-tip" role="note" aria-label="How to play">
        <span>jump the gaps and deliver the tea</span>
        <span class="boba-keys"><kbd>Space</kbd></span>
      </div>
    {:else if teach && !paused}
      {#key teach}
        <p class="boba-tip sr-teach" role="note">
          <span>{TEACH_TEXT[teach]}</span>
          {#if teach === "slide"}
            <span class="boba-keys"><kbd>↓</kbd></span>
          {:else if teach === "rush"}
            <span class="boba-keys"><kbd>X</kbd></span>
          {/if}
        </p>
      {/key}
    {/if}
  </header>

  {#if touchUI}
    <div class="sr-pads boba-ui">
      <div bind:this={padsRow} class="sr-pads-row">
        <button
          type="button"
          class="sr-pad boba-riso is-small"
          class:is-down={touchHeld.down}
          style="--tilt: -1.2deg"
          on:pointerdown={(event) => padDown(event, "down")}
          on:pointerup={() => holdPad("down", false)}
          on:pointercancel={() => holdPad("down", false)}
          on:lostpointercapture={() => holdPad("down", false)}
          on:keydown={(event) => padKey(event, "down", true)}
          on:keyup={(event) => padKey(event, "down", false)}
          on:blur={() => holdPad("down", false)}
          on:contextmenu={(event) => event.preventDefault()}
        >
          <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <path d="M8 11 L16 19 L24 11" />
            <path d="M6 25 H26" />
          </svg>
          <span>slide</span>
        </button>
        <div class="sr-pad-stack">
          <button
            type="button"
            class="sr-pad sr-rush boba-riso is-small"
            class:is-down={touchHeld.rush}
            class:is-hidden={!rushReady}
            tabindex={rushReady ? 0 : -1}
            aria-hidden={!rushReady}
            style="--tilt: 1.4deg"
            on:pointerdown={(event) => padDown(event, "rush")}
            on:pointerup={() => holdPad("rush", false)}
            on:pointercancel={() => holdPad("rush", false)}
            on:lostpointercapture={() => holdPad("rush", false)}
            on:keydown={(event) => padKey(event, "rush", true)}
            on:keyup={(event) => padKey(event, "rush", false)}
            on:blur={() => holdPad("rush", false)}
            on:contextmenu={(event) => event.preventDefault()}
          >
            <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
              <path d="M18 3 L8 18 H16 L13 29 L24 13 H16 Z" />
            </svg>
            <span>rush</span>
          </button>
          <button
            type="button"
            class="sr-pad sr-jump boba-riso is-small"
            class:is-down={touchHeld.jump}
            style="--tilt: -0.9deg"
            on:pointerdown={(event) => padDown(event, "jump")}
            on:pointerup={() => holdPad("jump", false)}
            on:pointercancel={() => holdPad("jump", false)}
            on:lostpointercapture={() => holdPad("jump", false)}
            on:keydown={(event) => padKey(event, "jump", true)}
            on:keyup={(event) => padKey(event, "jump", false)}
            on:blur={() => holdPad("jump", false)}
            on:contextmenu={(event) => event.preventDefault()}
          >
            <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
              <path d="M8 20 L16 12 L24 20" />
              <path d="M8 27 L16 19 L24 27" />
            </svg>
            <span>jump</span>
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if countdown > 0 || goVisible}
  <Countdown value={countdown} caption="out for delivery" goCaption="run" />
{/if}

{#if paused && !gameOver}
  <PauseCard
    bind:this={pauseCard}
    deck="The tea is holding still. The customer is not."
    on:resume={resumeGame}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

{#if gameOver}
  <ResultsSlip
    bind:this={slip}
    game="runner"
    title="clocked out"
    deck={deliveries === 0
      ? "The tea never arrived."
      : `${deliveries} ${deliveries === 1 ? "delivery" : "deliveries"} before the pearls ran out.`}
    score={finalStats.score}
    unit="points"
    {newBest}
    stats={[
      { label: "deliveries", value: finalStats.deliveries },
      { label: "full cups", value: finalStats.fullCups },
      { label: "best streak", value: finalStats.bestStreak },
      { label: "distance", value: `${finalStats.distance} m` },
      { label: "personal best", value: localBest },
    ]}
    on:restart={restart}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>

<style>
  .sr-play {
    display: contents;
  }

  /* The city has no light mode: the stage is the dusk's top colour in both
     themes, so the site never shows through behind the canvas. */
  .sr-stage {
    background: #2a2748;
  }

  .boba-hud.is-bare::before {
    content: none;
  }

  .sr-score {
    gap: 0;
  }

  /* --- Middle ticket: the streak and the sugar meter --- */

  .sr-middle {
    gap: var(--space-4);
  }

  .sr-readout {
    display: grid;
    gap: var(--space-0-5);
    justify-items: start;
    min-width: 2.5rem;
  }

  .sr-value {
    color: var(--b-strong);
    font-size: 0.95rem;
    font-variant-numeric: lining-nums tabular-nums;
    line-height: 1.2;
  }

  .sr-sugar {
    display: grid;
    gap: var(--space-1);
    justify-items: start;
  }

  .sr-sugar-label {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-1-5);
    min-height: 1.1rem;
  }

  .sr-sugar-label .boba-keys kbd {
    padding-block: 0;
  }

  .sr-pips {
    display: inline-flex;
    gap: 3px;
  }

  /* Sugar cubes: an empty one is a dashed outline; a full one is printed in
     the accent with a pale face, so full and empty differ by more than colour. */
  .sr-pip {
    width: 0.625rem;
    height: 0.625rem;
    border: 1.5px dashed var(--b-muted);
    border-radius: 2px;
    opacity: 0.7;
  }

  .sr-pip.is-full {
    border: 1.5px solid var(--b-line);
    background: linear-gradient(135deg, var(--b-raised) 0 35%, var(--b-slab) 35% 100%);
    opacity: 1;
  }

  .sr-sugar.is-ready .sr-pips {
    animation: sr-pulse 1.2s var(--ease-standard) infinite;
    transform-origin: left center;
  }

  .sr-sugar.is-ready .boba-phase,
  .sr-sugar.is-rushing .boba-meta {
    color: var(--b-accent);
  }

  @keyframes sr-pulse {
    50% {
      transform: scale(1.06);
    }
  }

  .sr-tea {
    justify-items: center;
    gap: 0;
  }

  .sr-teach {
    margin-top: var(--space-3);
  }

  /* --- Touch controls: slide bottom left, jump bottom right, rush above jump --- */

  .sr-pads {
    position: fixed;
    inset: auto 0 0;
    z-index: calc(var(--layer-overlay) + 3);
    padding: 0 max(var(--space-5), env(safe-area-inset-right)) max(var(--space-5), env(safe-area-inset-bottom))
      max(var(--space-5), env(safe-area-inset-left));
    pointer-events: none;
  }

  .sr-pads-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }

  .sr-pad-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-3);
  }

  .sr-pad {
    display: grid;
    place-items: center;
    gap: var(--space-0-5);
    width: 5rem;
    height: 4.25rem;
    padding: 0;
    color: var(--b-strong);
    background: transparent;
    border: 0;
    cursor: pointer;
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1;
    pointer-events: auto;
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    transition: transform var(--motion-instant) var(--ease-standard);
  }

  .sr-jump {
    width: 6.5rem;
    height: 5.5rem;
  }

  .sr-rush {
    width: 5.5rem;
    height: 3.5rem;
  }

  /* Kept in the layout so the course is always laid out above it. */
  .sr-rush.is-hidden {
    visibility: hidden;
  }

  .sr-pad svg {
    width: 1.75rem;
    height: 1.75rem;
    overflow: visible;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.25;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .sr-rush svg {
    width: 1.375rem;
    height: 1.375rem;
  }

  /* No slab at rest: the pads sit straight on the scene. */
  .sr-pad::before {
    display: none;
  }

  /* Held: the sheet takes the accent and sinks a pixel. */
  .sr-pad.is-down {
    color: #1a1a1a;
    transform: translateY(1px);
  }

  .sr-pad.is-down::after {
    background: #e85d4c;
    border-color: #1a1a1a;
    border-width: 2.25px;
  }

  :global(.dark) .sr-pad.is-down::after {
    background: #f07563;
    border-color: #fdf8f3;
  }

  /* Short screens (a phone on its side): rush moves beside jump. */
  @media (max-height: 500px) {
    .sr-pad-stack {
      flex-direction: row;
      align-items: flex-end;
    }

    .sr-pad {
      height: 3.75rem;
    }

    .sr-jump {
      height: 4.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sr-sugar.is-ready .sr-pips {
      animation: none;
    }

    .sr-pad {
      transition: none;
    }
  }

  @media (max-width: 640px) {
    .sr-middle {
      gap: var(--space-3);
    }

    .sr-tea-label {
      display: none;
    }

    .sr-pip {
      width: 0.5625rem;
      height: 0.5625rem;
    }
  }
</style>
