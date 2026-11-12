<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  import {
    setMusicPaused,
    setMusicPhase,
    sfxBlip,
    sfxMilestone,
    sfxPlace,
    sfxSlice,
    sfxTopple,
    startMusic,
    stopMusic,
  } from "$lib/sfx";
  import {
    GROW_AFTER,
    START_WIDTH,
    dropCup,
    phaseForHeight,
    sliderWidth,
    snapDrop,
    speedForHeight,
    stepSlide,
    trackFor,
    traySpan,
    widthAfterPerfect,
  } from "$lib/arcade/stack-engine.js";
  import type { Span } from "$lib/arcade/stack-engine.js";
  import {
    DRINKS,
    INK,
    LID,
    MENU_ICONS,
    PEARL,
    SPRITE_PAD,
    STRAW_PINK,
    addPopup,
    arcadeFont,
    cachedSprite,
    drawHalo,
    drawSprite,
    fitCanvas,
    stepPopups,
    type Popup,
  } from "$lib/arcade/art";
  import { firstVisit, readBest } from "$lib/arcade/scores";
  import { arcadeExits, concludeRun, createTimers, isOnControl, mountShell } from "$lib/arcade/shell";
  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";

  // Cup stack: a cup slides back and forth over the tower; drop it, and
  // whatever hangs over the edge is sliced off and falls. The tower is a
  // column of drinks, each a different flavour, so a tall one is a rainbow.
  // It stands on a rooftop table and climbs out of the city, through the
  // clouds and thin high air, into space.

  const { exit, toMenu } = arcadeExits(createEventDispatcher<{ close: null; menu: null }>());

  const CUP_ROWS = 10;
  const HALO = "rgba(253, 248, 243, 0.8)";
  const DROP_KEYS = new Set([" ", "Enter", "ArrowDown"]);
  const PALETTES = DRINKS.map((liquid) => ({ O: INK, l: LID, L: liquid, b: PEARL }));

  /** A cup `width` sprite pixels wide: lid, rim, tapering body, pearls. */
  function cupGrid(width: number) {
    const line = (inset: number, edge: string, fill: string) => {
      const inner = width - inset * 2;
      if (inner <= 0) return ".".repeat(width);
      if (inner === 1) return `${".".repeat(inset)}${edge}${".".repeat(inset)}`;
      return `${".".repeat(inset)}${edge}${fill.repeat(inner - 2)}${edge}${".".repeat(inset)}`;
    };
    const taper = width > 4 ? 1 : 0;
    let pearls = line(taper, "O", "L");
    pearls = [...pearls]
      .map((cell, column) => (cell === "L" && column % 2 === 1 ? "b" : cell))
      .join("");
    return [
      line(taper, "O", "O"),
      line(0, "O", "l"),
      line(0, "O", "O"),
      line(0, "O", "L"),
      line(0, "O", "L"),
      line(0, "O", "L"),
      line(taper, "O", "L"),
      line(taper, "O", "L"),
      pearls,
      line(width > 6 ? 2 : taper, "O", "O"),
    ];
  }

  const grids = new Map<number, string[]>();
  function gridFor(width: number) {
    let grid = grids.get(width);
    if (!grid) {
      grid = cupGrid(width);
      grids.set(width, grid);
    }
    return grid;
  }

  interface Layer extends Span {
    drink: number;
    land: number;
  }

  interface Piece {
    /** Screen position of the piece's center, in px. */
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    spin: number;
    drink: number;
    /** The source cup's width, and the columns of it that broke off. */
    gridWidth: number;
    from: number;
    to: number;
  }

  // --- The scene's palette -----------------------------------------------------
  // The climb is painted the same in both site themes: only the HTML on top
  // of it (tickets, tip, buttons) follows the theme.

  /** The screen-space art cell, in CSS px. */
  const SC = 4;
  const CREAM = "#fdf8f3";
  const NIGHT = "#141a2e";
  /** Ground to space. */
  const SKY = ["#f4d9b0", "#f0c9a0", "#bcd6e6", "#9cc0dc", "#779bbe", "#3a6a91", "#1f4567", "#1f2547", "#141a2e"];
  /** Where each sky colour sits, in cups of camera climb (about cups stacked less eight). */
  const SKY_AT = [0, 6, 14, 21, 28, 35, 42, 49, 56];
  const CITY_FAR = "#8a7f9c";
  const CITY_NEAR = "#5b4f7a";
  const WINDOW_LIT = "#f4c27a";
  const ROOF = "#cfc6ba";
  const ROOF_SHADE = "#b9ab98";
  const ROOF_LIGHT = "#e2dacd";
  const ROOF_JOINT = "#ad9f8b";
  const ROOF_SEAM = "#c2b8aa";
  /** Lit to deep, shared by the rooftop's metal and the moon. */
  const STONE = ["#e9dfd0", "#d8ccba", "#b9ab98", "#9c8f7e", "#867a6b"];
  const TABLE = "#8a5a3c";
  const TABLE_SHADE = "#6f4530";
  const TRAY_PAPER = "#fbf2e8";
  const ACCENT = "#e85d4c";
  const CLOUD_SHADE = "#e3dccf";
  const CLOUD_DUSK = "#f0c9a0";
  const BIRD = "#2b2320";
  const SUN_CORE = "#fff3da";
  const SUN_RIM = "#f9dfb2";
  const EARTH = {
    ocean: "#3a6a91",
    oceanLight: "#779bbe",
    land: "#3d7a55",
    landLight: "#7bae8c",
    cloud: CREAM,
    night: "#141a2e",
  };

  // Parallax: the share of the camera's climb each layer moves. The sky's
  // colour runs a little faster than the far layers so that a good run
  // reaches space; everything else is ordered far to near.
  const SKY_P = 0.5;
  const P_STARS = 0.1;
  const P_MOON = 0.45;
  const P_SATELLITE = 0.3;
  const P_SUN = 0.38;
  const P_CIRRUS = 0.48;
  const P_PLANE = 0.5;
  const P_BIRDS = 0.72;
  const P_BALLOON = 0.8;

  /** Ordered dithering thresholds, 4 × 4. */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((value) => (value + 0.5) / 16);
  const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];
  /** Snaps a screen coordinate to the scene cell. */
  const snap = (value: number) => Math.round(value / SC) * SC;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  const smoothstep = (from: number, to: number, value: number) => {
    const t = clamp((value - from) / (to - from), 0, 1);
    return t * t * (3 - 2 * t);
  };
  /** A stable 0–1 value per integer, so seeded marks never shimmer. */
  const ihash = (n: number) => {
    let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const hash2 = (a: number, b: number) => ihash(Math.imul(a, 73856093) ^ Math.imul(b, 19349663));
  function seeded(seed: number) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rgb = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const mix = (a: string, b: string, t: number) => {
    const from = rgb(a);
    const to = rgb(b);
    return `#${from.map((value, index) => Math.round(lerp(value, to[index], t)).toString(16).padStart(2, "0")).join("")}`;
  };
  function putPixel(data: Uint8ClampedArray, index: number, color: number[]) {
    data[index * 4] = color[0];
    data[index * 4 + 1] = color[1];
    data[index * 4 + 2] = color[2];
    data[index * 4 + 3] = 255;
  }
  const SKY_RGB = SKY.map(rgb);
  const SKY_LUM = SKY_RGB.map(([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255);

  /** A pixel grid painted one canvas pixel per cell, to be drawn scaled by SC. */
  function gridCanvas(grid: string[], palette: Record<string, string>) {
    const columns = grid.reduce((widest, row) => Math.max(widest, row.length), 0);
    const canvas = document.createElement("canvas");
    canvas.width = columns;
    canvas.height = grid.length;
    const context = canvas.getContext("2d");
    if (context) {
      for (let row = 0; row < grid.length; row++) {
        for (let column = 0; column < grid[row].length; column++) {
          const color = palette[grid[row][column]];
          if (!color) continue;
          context.fillStyle = color;
          context.fillRect(column, row, 1, 1);
        }
      }
    }
    return canvas;
  }

  // --- State -----------------------------------------------------------------

  let stacked = 0;
  let streak = 0;
  let bestStreak = 0;
  let perfects = 0;
  let paused = false;
  let gameOver = false;
  let tipVisible = false;
  let liveMessage = "Cup stack starting";
  let localBest = 0;
  let previousBest = 0;
  let newBest = false;

  let canvas: HTMLCanvasElement;
  let hudRow: HTMLElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let hudButtons: HudButtons;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;
  let popupFont = '500 13px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';
  let labelFont = '400 12px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';
  let reduceMotion = false;

  let viewW = 0;
  let viewH = 0;
  let unit = 6;
  let cupH = 48;
  let groundY = 0;
  let playTop = 80;
  let halfScreen = 40;

  // tower[0] is the tray; every other entry is a cup.
  let tower: Layer[] = [];
  let slider = { left: 0, direction: 1 as 1 | -1, width: START_WIDTH, drink: 0 };
  /** The slider as drawn this frame, on the unit grid; reused to keep frames allocation-free. */
  const sliderShown = { left: 0, width: START_WIDTH, drink: 0 };
  let track = { min: 0, max: 0 };
  let pieces: Piece[] = [];
  let flashes: Array<{ level: number; left: number; width: number; age: number }> = [];
  let popups: Popup[] = [];
  let camera = 0;
  let zoom = 1;
  let playing = true;
  let last = 0;
  let raf = 0;
  let active = true;
  let lastDrop = 0;
  const timers = createTimers();

  // Scene state. The background is a function of `camera`, so the fall's
  // pull-back and a restart carry it home with no state of its own.
  /** The scene's ground line on the cell grid. */
  let baseY = 0;
  /** This frame's sky offset, for reading the sky's brightness at a height. */
  let skyOff = 0;
  let sceneClock = 0;
  /** Drift time, running faster as the slide speeds up. */
  let windClock = 0;
  let windFactor = 1;

  const screenX = (units: number) => viewW / 2 + units * unit;
  /** Screen y of the top of cup level `level` (0 = the first cup). */
  const levelTop = (level: number) => groundY - (level + 1) * cupH + camera;
  /** Screen y of something at `alt` px up a layer moving at parallax `p`. */
  const layerY = (alt: number, p: number) => baseY + snap(camera * p) - alt;

  // --- Keeping busy detail away from the tower -----------------------------------
  // Two rectangles: the column behind the top few cups, and the row the
  // sliding cup travels. Drifting things fade as they pass behind either.

  let zoneOn = false;
  let zoneX0 = 0;
  let zoneX1 = 0;
  let zoneY0 = 0;
  let zoneY1 = 0;
  let rowX0 = 0;
  let rowX1 = 0;
  let rowY0 = 0;
  let rowY1 = 0;

  function updateZone() {
    zoneOn = playing;
    const top = levelTop(tower.length - 1);
    const half = (START_WIDTH / 2 + 3) * unit;
    zoneX0 = viewW / 2 - half;
    zoneX1 = viewW / 2 + half;
    zoneY0 = top - cupH;
    zoneY1 = Math.min(groundY + camera, top + cupH * 4);
    rowX0 = screenX(track.min) - 8;
    rowX1 = screenX(track.max + slider.width) + 8;
    rowY0 = top - 8;
    rowY1 = top + cupH + 8;
  }

  /** 1 away from the tower; a quiet 0.28 behind it. */
  function zoneFade(x0: number, y0: number, x1: number, y1: number) {
    if (!zoneOn) return 1;
    const column = Math.max(zoneX0 - x1, x0 - zoneX1, zoneY0 - y1, y0 - zoneY1);
    const row = Math.max(rowX0 - x1, x0 - rowX1, rowY0 - y1, y0 - rowY1);
    return 0.28 + 0.72 * smoothstep(0, 40, Math.max(0, Math.min(column, row)));
  }

  /** A top for something `height` tall in open sky: above the tower's top if there is room, else below. */
  function openSkyY(height: number) {
    const top = playTop + 16;
    const above = zoneY0 - 32 - height;
    if (above - top > 24) return snap(top + Math.random() * (above - top));
    const below = Math.max(zoneY1 + 32, top);
    return snap(below + Math.random() * Math.max(0, viewH * 0.8 - height - below));
  }

  // --- Drawing: the sky --------------------------------------------------------

  // One tall strip, one pixel per scene cell, from the rooftop to space:
  // flat bands joined by Bayer dithering. Each frame blits the window of it
  // the camera's altitude shows, scaled up without smoothing.
  let skyStrip: HTMLCanvasElement | null = null;
  let skyRows = 0;

  function buildSky() {
    const columns = Math.ceil(viewW / SC) + 1;
    const perCup = cupH * SKY_P;
    skyRows = Math.ceil(((SKY_AT[SKY_AT.length - 1] + 2) * perCup) / SC);
    skyStrip ??= document.createElement("canvas");
    skyStrip.width = columns;
    skyStrip.height = skyRows;
    const context = skyStrip.getContext("2d");
    if (!context) return;
    const image = context.createImageData(columns, skyRows);
    for (let k = 0; k < skyRows; k++) {
      const cups = ((k + 0.5) * SC) / perCup;
      let segment = 0;
      while (segment < SKY_AT.length - 2 && cups >= SKY_AT[segment + 1]) segment++;
      const t = clamp((cups - SKY_AT[segment]) / (SKY_AT[segment + 1] - SKY_AT[segment]), 0, 1);
      // Flat for most of the band, dithered across the middle of the join.
      const blend = clamp((t - 0.3) / 0.4, 0, 1);
      const row = skyRows - 1 - k;
      for (let x = 0; x < columns; x++) {
        // Thresholds count from the strip's foot, so the pattern rides with it.
        putPixel(image.data, row * columns + x, SKY_RGB[blend > bayer(x, k) ? segment + 1 : segment]);
      }
    }
    context.putImageData(image, 0, 0);
  }

  function drawSky(c: CanvasRenderingContext2D) {
    skyOff = snap(camera * SKY_P);
    const bottom = baseY + skyOff;
    const top = bottom - skyRows * SC;
    if (top > 0) {
      c.fillStyle = NIGHT;
      c.fillRect(0, 0, viewW, top);
    }
    if (bottom < viewH) {
      c.fillStyle = SKY[0];
      c.fillRect(0, bottom, viewW, viewH - bottom);
    }
    if (!skyStrip) return;
    const r0 = Math.max(0, Math.floor(-top / SC));
    const r1 = Math.min(skyRows, Math.ceil((viewH - top) / SC));
    if (r1 > r0) {
      c.drawImage(skyStrip, 0, r0, skyStrip.width, r1 - r0, 0, top + r0 * SC, skyStrip.width * SC, (r1 - r0) * SC);
    }
  }

  /** The sky's altitude at screen y, in cups of camera climb. */
  const skyCupsAt = (y: number) => (baseY + skyOff - y) / (cupH * SKY_P);

  /** How bright the sky is at screen y, 0 (space) to 1 (dusk). */
  function skyLumAt(y: number) {
    const cups = skyCupsAt(y);
    if (cups <= SKY_AT[0]) return SKY_LUM[0];
    for (let index = 1; index < SKY_AT.length; index++) {
      if (cups < SKY_AT[index]) {
        return lerp(SKY_LUM[index - 1], SKY_LUM[index], (cups - SKY_AT[index - 1]) / (SKY_AT[index] - SKY_AT[index - 1]));
      }
    }
    return SKY_LUM[SKY_LUM.length - 1];
  }

  // --- Drawing: stars, the low sun, the moon --------------------------------------

  /**
   * Stars are hashed from their tile and index, never stored, so they cost
   * nothing until the sky is dark enough to show them and never reshuffle.
   */
  function drawStars(c: CanvasRenderingContext2D, view: number) {
    const show = smoothstep(21, 29, view);
    if (show <= 0) return;
    const off = snap(camera * P_STARS);
    const tile = 400;
    const perTile = Math.max(8, Math.round((viewW * tile) / 9000));
    const columns = Math.floor(viewW / SC);
    const rowsPerTile = tile / SC;
    const k0 = Math.max(0, Math.floor((baseY + off - viewH) / tile));
    const k1 = Math.floor((baseY + off) / tile);
    c.fillStyle = CREAM;
    for (let k = k0; k <= k1; k++) {
      for (let index = 0; index < perTile; index++) {
        const id = k * 1031 + index;
        const y = baseY + off - (k * tile + Math.floor(hash2(id, 7) * rowsPerTile) * SC);
        if (y < 0 || y >= viewH) continue;
        const dark = clamp((skyCupsAt(y) - 42) / 10, 0, 1) * show;
        if (dark <= 0.04) continue;
        const x = Math.floor(hash2(id, 13) * columns) * SC;
        const roll = hash2(id, 29);
        const kind = roll < 0.62 ? 0 : roll < 0.94 ? 1 : 2;
        let alpha = kind === 0 ? 0.4 : 1;
        if (!reduceMotion && hash2(id, 41) < 0.14) {
          // A few breathe on their own slow sines, in printed steps.
          const level = 0.5 + 0.5 * Math.sin(sceneClock * (0.5 + hash2(id, 53)) + hash2(id, 61) * 6.283);
          alpha *= Math.max(0.15, Math.round(level * 4) / 4);
        }
        c.globalAlpha = alpha * dark;
        c.fillRect(x, y, SC, SC);
        if (kind === 2) {
          c.globalAlpha = 0.45 * dark;
          c.fillRect(x - SC, y, SC, SC);
          c.fillRect(x + SC, y, SC, SC);
          c.fillRect(x, y - SC, SC, SC);
          c.fillRect(x, y + SC, SC, SC);
        }
      }
    }
    c.globalAlpha = 1;
  }

  const SUN_R = 6;
  let sunCanvas: HTMLCanvasElement | null = null;

  /** A pale late-afternoon sun with a dithered rim. */
  function buildSun() {
    const size = SUN_R * 2;
    sunCanvas = document.createElement("canvas");
    sunCanvas.width = size;
    sunCanvas.height = size;
    const context = sunCanvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(size, size);
    const core = rgb(SUN_CORE);
    const rim = rgb(SUN_RIM);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - SUN_R, y + 0.5 - SUN_R);
        if (d < SUN_R - 1.3) putPixel(image.data, y * size + x, core);
        else if (d < SUN_R - 0.3) putPixel(image.data, y * size + x, rim);
        else if (d < SUN_R + 0.4 && bayer(x, y) < 0.5) putPixel(image.data, y * size + x, rim);
      }
    }
    context.putImageData(image, 0, 0);
  }

  function drawSun(c: CanvasRenderingContext2D) {
    if (!sunCanvas) return;
    const y = baseY - snap(viewH * 0.2) + snap(camera * P_SUN) - SUN_R * SC;
    if (y > viewH) return;
    c.drawImage(sunCanvas, snap(viewW * 0.2) - SUN_R * SC, y, SUN_R * 2 * SC, SUN_R * 2 * SC);
  }

  let moonCanvas: HTMLCanvasElement | null = null;
  let moonR = 9;
  /** Rows above the moon's disc, for the coaster's pennant. */
  const MOON_HEAD = 5;

  /** A small regolith moon lit from the upper right, with a coaster on top. */
  function buildMoon() {
    moonR = viewW < 640 ? 7 : 9;
    const size = moonR * 2 + 2;
    moonCanvas ??= document.createElement("canvas");
    moonCanvas.width = size;
    moonCanvas.height = size + MOON_HEAD;
    const context = moonCanvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(size, size + MOON_HEAD);
    const tones = STONE.map(rgb);
    const cx = size / 2;
    const cy = MOON_HEAD + size / 2;
    const random = seeded(4242);
    const craters = Array.from({ length: 5 }, () => {
      const angle = random() * Math.PI * 2;
      const distance = random() * moonR * 0.62;
      return { x: cx + Math.cos(angle) * distance, y: cy + Math.sin(angle) * distance, r: 1.3 + random() * moonR * 0.22 };
    });
    for (let y = 0; y < size + MOON_HEAD; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > moonR * moonR) continue;
        const nx = dx / moonR;
        const ny = dy / moonR;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lit = nx * 0.5 - ny * 0.45 + nz * 0.75;
        const level = clamp((1.15 - lit) * 2.2, 0, 3);
        const floor = Math.floor(level);
        let tone = Math.min(3, floor + (level - floor > bayer(x, y) ? 1 : 0));
        for (const crater of craters) {
          const cdx = x + 0.5 - crater.x;
          const cdy = y + 0.5 - crater.y;
          if (cdx * cdx + cdy * cdy < crater.r * crater.r) tone = Math.min(4, tone + (cdy < 0 ? 2 : 1));
        }
        putPixel(image.data, y * size + x, tones[tone]);
      }
    }
    // The coaster: paper on an off-register accent slab, with a pennant.
    const mid = Math.floor(cx);
    const top = MOON_HEAD;
    const paper = rgb(TRAY_PAPER);
    const accent = rgb(ACCENT);
    for (let x = mid - 2; x <= mid + 1; x++) putPixel(image.data, (top - 1) * size + x, paper);
    putPixel(image.data, (top - 1) * size + mid + 2, accent);
    for (let x = mid - 1; x <= mid + 2; x++) putPixel(image.data, top * size + x, accent);
    for (let y = top - 4; y <= top - 1; y++) putPixel(image.data, y * size + mid - 3, tones[0]);
    putPixel(image.data, (top - 4) * size + mid - 2, accent);
    putPixel(image.data, (top - 4) * size + mid - 1, accent);
    putPixel(image.data, (top - 3) * size + mid - 2, accent);
    context.putImageData(image, 0, 0);
  }

  /** The moon comes down into view from far up and sits high on the right around 50 cups. */
  function drawMoon(c: CanvasRenderingContext2D, view: number) {
    if (!moonCanvas || view < 22) return;
    const settled = playTop + 0.24 * (viewH - playTop);
    const cy = snap(settled + (camera - 42 * cupH) * P_MOON);
    const y = cy - (MOON_HEAD + moonR + 1) * SC;
    if (y > viewH || y + moonCanvas.height * SC < 0) return;
    c.drawImage(moonCanvas, snap(viewW * 0.78) - (moonR + 1) * SC, y, moonCanvas.width * SC, moonCanvas.height * SC);
  }

  // --- Drawing: the earth's curve ---------------------------------------------------

  /** Rows of atmosphere above the limb. */
  const EARTH_ATM = 2;
  const EARTH_RGB = {
    ocean: rgb(EARTH.ocean),
    oceanLight: rgb(EARTH.oceanLight),
    land: rgb(EARTH.land),
    landLight: rgb(EARTH.landLight),
    cloud: rgb(EARTH.cloud),
    night: rgb(EARTH.night),
    lights: rgb(WINDOW_LIT),
    dusk: {
      ocean: rgb(mix(EARTH.ocean, EARTH.night, 0.55)),
      land: rgb(mix(EARTH.land, EARTH.night, 0.55)),
      cloud: rgb(mix(EARTH.cloud, EARTH.night, 0.5)),
    },
  };
  let earthCanvas: HTMLCanvasElement | null = null;
  let earthImage: ImageData | null = null;
  let earthCols = 0;
  let earthCap = 0;
  let earthRadius = 0;
  /** When the earth was last painted; below zero means it needs painting. */
  let earthAt = -1;

  /** Smooth value noise on an integer lattice. */
  function noise2(a: number, b: number) {
    const ia = Math.floor(a);
    const ib = Math.floor(b);
    const fa = smoothstep(0, 1, a - ia);
    const fb = smoothstep(0, 1, b - ib);
    const top = lerp(hash2(ia, ib), hash2(ia + 1, ib), fa);
    const bottom = lerp(hash2(ia, ib + 1), hash2(ia + 1, ib + 1), fa);
    return lerp(top, bottom, fb);
  }

  function sizeEarth() {
    earthCols = Math.ceil(viewW / SC) + 1;
    earthCap = Math.ceil((viewH * 0.17) / SC);
    // A wide circle: plenty of curve on a laptop, still some on a phone.
    earthRadius = (1.3 * viewW + 200) / SC;
    earthCanvas ??= document.createElement("canvas");
    earthCanvas.width = earthCols;
    earthCanvas.height = earthCap + EARTH_ATM;
    earthImage = null;
    earthAt = -1;
  }

  /** The top of a very large globe, foreshortened toward the limb, turned `turn` of the way round. */
  function renderEarth(turn: number) {
    if (!earthCanvas) return;
    const context = earthCanvas.getContext("2d");
    if (!context) return;
    const rows = earthCap + EARTH_ATM;
    earthImage ??= context.createImageData(earthCols, rows);
    const data = earthImage.data;
    data.fill(0);
    const cx = earthCols / 2;
    const cy = EARTH_ATM + earthRadius;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < earthCols; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const depth = earthRadius - Math.sqrt(dx * dx + dy * dy);
        const index = y * earthCols + x;
        if (depth < 0) {
          // A thin line of atmosphere, dithered at its outer edge.
          if (depth > -1) putPixel(data, index, EARTH_RGB.oceanLight);
          else if (depth > -EARTH_ATM && bayer(x, y) < 0.5) putPixel(data, index, EARTH_RGB.ocean);
          continue;
        }
        // Surface coordinates: across the arc, and down from the limb,
        // squeezed toward the limb so the ground reads as curving away.
        const su = (dx / earthRadius) * 46 + turn;
        const sv = Math.sqrt(depth / earthCap) * 7;
        const land = 0.62 * noise2(su * 0.32, sv * 0.55 + 7) + 0.38 * noise2(su * 0.9 + 31, sv * 1.4 + 3) > 0.56;
        // Cloud streams along the arc, drifting a little faster than the ground.
        const cu = su + turn * 0.4;
        const cloud = 0.6 * noise2(cu * 0.22 + 50, sv * 1.3) + 0.4 * noise2(cu * 0.8 + 80, sv * 2.6 + 11) > 0.62;
        const rim = depth < 1;
        // Night on the left: a one-step dusk band, then dark ground with city lights.
        const side = x / earthCols + (bayer(x, y) - 0.5) * 0.02;
        if (side < 0.12) {
          const lights = land && !cloud && hash2(Math.floor(su * 2), Math.floor(sv * 3)) < 0.12;
          putPixel(data, index, lights ? EARTH_RGB.lights : EARTH_RGB.night);
          continue;
        }
        if (side < 0.16) {
          putPixel(data, index, cloud ? EARTH_RGB.dusk.cloud : land ? EARTH_RGB.dusk.land : EARTH_RGB.dusk.ocean);
          continue;
        }
        if (cloud) putPixel(data, index, EARTH_RGB.cloud);
        else if (land) putPixel(data, index, rim ? EARTH_RGB.landLight : EARTH_RGB.land);
        else putPixel(data, index, rim ? EARTH_RGB.oceanLight : EARTH_RGB.ocean);
      }
    }
    context.putImageData(earthImage, 0, 0);
  }

  /** The curve rises along the bottom on reaching space, then slowly sinks away. */
  function drawEarth(c: CanvasRenderingContext2D, view: number) {
    const rise = smoothstep(24, 31, view) * (1 - smoothstep(44, 60, view));
    const shown = snap(earthCap * SC * rise);
    if (shown < SC || !earthCanvas) return;
    // A few repaints a second turn it slowly; reduced motion holds it still.
    if (earthAt < 0 || (!reduceMotion && sceneClock - earthAt >= 0.25)) {
      renderEarth(sceneClock * 0.12);
      earthAt = sceneClock;
    }
    const y = snap(viewH) - shown - EARTH_ATM * SC;
    c.drawImage(earthCanvas, 0, y, earthCols * SC, earthCanvas.height * SC);
  }

  // --- Drawing: the city ----------------------------------------------------------

  interface CityLayer {
    p: number;
    seed: number;
    /** Building heights above the ground line, as shares of the view height. */
    low: number;
    high: number;
    minW: number;
    maxW: number;
    windows: number;
    rowStep: number;
    signs: number;
    signP: number;
    towerP: number;
    antennaP: number;
    tankW: number;
    /** Indexed by cell: body, rim, lit window, beacon, sign face, sign glyph. */
    palette: string[];
    canvas: HTMLCanvasElement | null;
    horizon: number;
  }

  const CITY: CityLayer[] = [
    {
      p: 0.42,
      seed: 501,
      low: 0.1,
      high: 0.3,
      minW: 5,
      maxW: 13,
      windows: 0.025,
      rowStep: 4,
      signs: 0,
      signP: 0,
      towerP: 0.16,
      antennaP: 0.34,
      tankW: 4,
      palette: ["", CITY_FAR, mix(CITY_FAR, "#f4d9b0", 0.3), mix(WINDOW_LIT, CITY_FAR, 0.35), mix(ACCENT, CITY_FAR, 0.3), "", ""],
      canvas: null,
      horizon: 0,
    },
    {
      p: 0.56,
      seed: 733,
      low: 0.03,
      high: 0.17,
      minW: 7,
      maxW: 16,
      windows: 0.045,
      rowStep: 3,
      signs: 2,
      signP: 0.32,
      towerP: 0.22,
      antennaP: 0.2,
      tankW: 5,
      palette: [
        "",
        CITY_NEAR,
        mix(CITY_NEAR, "#f0c9a0", 0.32),
        WINDOW_LIT,
        ACCENT,
        mix(CITY_NEAR, WINDOW_LIT, 0.22),
        WINDOW_LIT,
      ],
      canvas: null,
      horizon: 0,
    },
  ];

  /**
   * A roofline of cell-stepped blocks with setbacks, water towers, antennas,
   * and on the near layer a shop sign, lit from the low sun on the left: a
   * one-cell rim along every top and every wall that faces the sun.
   */
  function buildCity(layer: CityLayer) {
    const columns = Math.ceil(viewW / SC) + 1;
    const highCells = Math.ceil((layer.high * viewH) / SC);
    const lowCells = Math.ceil((layer.low * viewH) / SC);
    const up = highCells + 14;
    const rows = up + Math.ceil((viewH - baseY) / SC) + 2;
    layer.horizon = up;
    const grid = new Uint8Array(columns * rows);
    const set = (x: number, y: number, value: number) => {
      if (x >= 0 && x < columns && y >= 0 && y < rows) grid[y * columns + x] = value;
    };
    const fill = (x: number, y: number, w: number, h: number, value: number) => {
      for (let row = y; row < y + h; row++) for (let column = x; column < x + w; column++) set(column, row, value);
    };
    const at = (x: number, y: number) => (x >= 0 && x < columns && y >= 0 && y < rows ? grid[y * columns + x] : 0);
    const random = seeded(layer.seed);
    let signs = 0;
    let x = -Math.floor(random() * 6);
    while (x < columns) {
      const w = layer.minW + Math.floor(random() * (layer.maxW - layer.minW + 1));
      const h = Math.round(lerp(lowCells, highCells, Math.pow(random(), 1.4)));
      const bodyTop = up - h;
      let top = bodyTop;
      fill(x, top, w, rows - top, 1);
      let roofX = x;
      let roofW = w;
      if (w >= 7 && random() < 0.4) {
        // A stepped crown.
        const inset = 1 + Math.floor(random() * Math.min(3, (w - 3) / 2));
        const tall = 2 + Math.floor(random() * 4);
        top -= tall;
        roofX = x + inset;
        roofW = w - inset * 2;
        fill(roofX, top, roofW, tall, 1);
      }
      const feature = random();
      if (signs < layer.signs && roofW >= 12 && feature < layer.signP) {
        // A shop sign on legs: a cup and two lines of lettering, lit.
        signs++;
        const sx = roofX + Math.floor((roofW - 12) / 2);
        fill(sx + 2, top - 2, 1, 2, 1);
        fill(sx + 9, top - 2, 1, 2, 1);
        fill(sx, top - 7, 12, 5, 1);
        fill(sx + 1, top - 6, 10, 3, 5);
        fill(sx + 2, top - 6, 3, 2, 6);
        set(sx + 3, top - 4, 6);
        fill(sx + 6, top - 6, 4, 1, 6);
        fill(sx + 6, top - 4, 3, 1, 6);
      } else if (roofW >= layer.tankW + 2 && feature < layer.signP + layer.towerP) {
        // A water tower: legs, a catwalk, the tank, its cone.
        const tw = layer.tankW;
        const tx = roofX + 1 + Math.floor(random() * Math.max(1, roofW - tw - 1));
        set(tx, top - 1, 1);
        set(tx + tw - 1, top - 1, 1);
        fill(tx, top - 2, tw, 1, 1);
        fill(tx, top - 5, tw, 3, 1);
        fill(tx + 1, top - 6, tw - 2, 1, 1);
        if (tw % 2 === 1) set(tx + (tw - 1) / 2, top - 7, 1);
      } else if (feature < layer.signP + layer.towerP + layer.antennaP) {
        const ax = roofX + 1 + Math.floor(random() * Math.max(1, roofW - 2));
        const ah = 3 + Math.floor(random() * 6);
        fill(ax, top - ah, 1, ah, 1);
        if (ah >= 5 && random() < 0.5) fill(ax - 1, top - ah + 2, 3, 1, 1);
        if (random() < 0.6) set(ax, top - ah - 1, 4);
      }
      // A few lit windows, on the building's own grid.
      for (let wy = bodyTop + 2; wy < up + 8; wy += layer.rowStep) {
        for (let wx = x + 1; wx < x + w - 1; wx += 2) {
          if (at(wx, wy) !== 1) continue;
          const roll = hash2(layer.seed * 31 + wx, wy);
          if (roll < layer.windows) {
            set(wx, wy, 3);
            if (roll < layer.windows * 0.35 && wx + 1 < x + w - 1) set(wx + 1, wy, 3);
          }
        }
      }
      x += w;
    }
    // The rim: every body cell open above, or open on the sun's side.
    for (let y = 0; y < rows; y++) {
      for (let column = 0; column < columns; column++) {
        if (grid[y * columns + column] !== 1) continue;
        if (at(column, y - 1) === 0 || at(column - 1, y) === 0) grid[y * columns + column] = 2;
      }
    }
    layer.canvas ??= document.createElement("canvas");
    layer.canvas.width = columns;
    layer.canvas.height = rows;
    const context = layer.canvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(columns, rows);
    const colors = layer.palette.map((hex) => (hex ? rgb(hex) : null));
    for (let index = 0; index < grid.length; index++) {
      const color = colors[grid[index]];
      if (color) putPixel(image.data, index, color);
    }
    context.putImageData(image, 0, 0);
  }

  function drawCity(c: CanvasRenderingContext2D, layer: CityLayer) {
    if (!layer.canvas) return;
    const y = baseY - layer.horizon * SC + snap(camera * layer.p);
    if (y >= viewH) return;
    c.drawImage(layer.canvas, 0, y, layer.canvas.width * SC, layer.canvas.height * SC);
  }

  // --- Drawing: clouds ------------------------------------------------------------

  interface CloudShape {
    w: number;
    h: number;
    plain: HTMLCanvasElement;
    dusk: HTMLCanvasElement;
  }

  interface CloudLayer {
    p: number;
    /** Altitude between cloud slots, in px of this layer. */
    gap: number;
    minW: number;
    maxW: number;
    /** Drift in px a second, before the wind. */
    speed: number;
    alpha: number;
    density: number;
    seed: number;
    shapes: CloudShape[];
  }

  const CLOUDS: CloudLayer[] = [
    { p: 0.5, gap: 72, minW: 9, maxW: 15, speed: 4, alpha: 0.8, density: 0.6, seed: 11, shapes: [] },
    { p: 0.66, gap: 112, minW: 15, maxW: 23, speed: 7, alpha: 0.94, density: 0.5, seed: 23, shapes: [] },
    { p: 0.86, gap: 190, minW: 22, maxW: 32, speed: 11, alpha: 1, density: 0.42, seed: 37, shapes: [] },
  ];

  /**
   * A pixel cumulus: rounded bumps on a flat base, the biggest in the
   * middle, shaded along the bottom and on the side away from the sun.
   */
  function makeCloud(w: number, random: () => number): CloudShape {
    const h = Math.max(4, Math.round(w * (0.36 + random() * 0.08)));
    const bumps = 2 + Math.floor(w / 8);
    const cx: number[] = [];
    const cy: number[] = [];
    const cr: number[] = [];
    for (let index = 0; index < bumps; index++) {
      const t = index / (bumps - 1);
      const middle = 1 - Math.abs(t - 0.5) * 1.2;
      const r = ((h - 0.4) / 1.7) * (0.62 + 0.38 * middle) * (0.92 + random() * 0.08);
      cr.push(r);
      cx.push(lerp(r, w - r, t) + (random() - 0.5) * 1.4);
      cy.push(h - r * 0.7);
    }
    const cells = new Uint8Array(w * h);
    const baseRows = Math.max(2, Math.round(h * 0.3));
    const baseFrom = Math.round(cx[0] - cr[0] * 0.8);
    const baseTo = Math.round(cx[bumps - 1] + cr[bumps - 1] * 0.8);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let best = -1;
        let bestRel = 0;
        for (let index = 0; index < bumps; index++) {
          const dx = x + 0.5 - cx[index];
          const dy = y + 0.5 - cy[index];
          const inside = 1 - (dx * dx + dy * dy) / (cr[index] * cr[index]);
          if (inside >= 0 && (best < 0 || inside > best)) {
            best = inside;
            bestRel = (dx * 0.45 + dy * 0.9) / cr[index];
          }
        }
        const base = y >= h - baseRows && x >= baseFrom && x < baseTo;
        if (best < 0 && !base) continue;
        cells[y * w + x] = y >= h - 1 || (best >= 0 && bestRel > 0.42) || (best < 0 && base) ? 2 : 1;
      }
    }
    // Round off the base's corners and drop stray single cells.
    const filled = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h && cells[y * w + x] > 0;
    for (let x = 0; x < w; x++) {
      if (filled(x, h - 1) && !filled(x - 1, h - 1)) {
        cells[(h - 1) * w + x] = 0;
        break;
      }
    }
    for (let x = w - 1; x >= 0; x--) {
      if (filled(x, h - 1) && !filled(x + 1, h - 1)) {
        cells[(h - 1) * w + x] = 0;
        break;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!filled(x, y)) continue;
        const neighbours = +filled(x - 1, y) + +filled(x + 1, y) + +filled(x, y - 1) + +filled(x, y + 1);
        if (neighbours < 2) cells[y * w + x] = 0;
      }
    }
    const paint = (shade: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d");
      if (context) {
        const image = context.createImageData(w, h);
        const light = rgb(CREAM);
        const dark = rgb(shade);
        for (let index = 0; index < cells.length; index++) {
          if (cells[index]) putPixel(image.data, index, cells[index] === 2 ? dark : light);
        }
        context.putImageData(image, 0, 0);
      }
      return canvas;
    };
    return { w, h, plain: paint(CLOUD_SHADE), dusk: paint(CLOUD_DUSK) };
  }

  function buildClouds() {
    for (const layer of CLOUDS) {
      const random = seeded(layer.seed * 97);
      layer.shapes = Array.from({ length: 5 }, (_, index) =>
        makeCloud(Math.round(lerp(layer.minW, layer.maxW, index / 4)), random),
      );
    }
  }

  /** How many cloud slots hold a cloud, by the climb at which the slot crosses mid-screen. */
  const cloudDensity = (view: number) => smoothstep(-10, -3, view) * (1 - smoothstep(13, 22, view));

  /**
   * Clouds live in fixed altitude slots per layer, each seeded, so the same
   * cloud is always at the same height; the wind moves them sideways.
   */
  function drawClouds(c: CanvasRenderingContext2D, layer: CloudLayer) {
    const off = snap(camera * layer.p);
    const tallest = layer.shapes.length ? layer.shapes[layer.shapes.length - 1].h * SC : 0;
    // Never in front of the rooftop city before the climb starts.
    const lowest = viewH * 0.3 + 24;
    const j0 = Math.max(1, Math.ceil((baseY + off - viewH - tallest) / layer.gap));
    const j1 = Math.floor((baseY + off) / layer.gap);
    for (let j = j0; j <= j1; j++) {
      const alt = j * layer.gap + Math.floor((hash2(layer.seed, j * 5 + 1) - 0.5) * layer.gap * 0.5);
      if (alt < lowest) continue;
      const midClimb = (alt - baseY + viewH / 2) / layer.p / cupH;
      if (hash2(layer.seed, j * 5) > cloudDensity(midClimb) * layer.density) continue;
      const shape = layer.shapes[Math.floor(hash2(layer.seed, j * 5 + 2) * layer.shapes.length)];
      const width = shape.w * SC;
      const height = shape.h * SC;
      const span = viewW + width + 64;
      const travel = windClock * layer.speed * (0.8 + 0.4 * hash2(layer.seed, j * 5 + 3));
      const x = snap(((((hash2(layer.seed, j * 5 + 4) * span - travel) % span) + span) % span) - width - 32);
      const y = baseY + off - alt - height;
      const lit = smoothstep(0.25, 0.45, skyLumAt(y + height));
      if (lit <= 0) continue;
      c.globalAlpha = layer.alpha * lit * zoneFade(x, y, x + width, y + height);
      // Low clouds catch the dusk on their undersides.
      c.drawImage(midClimb < 8 ? shape.dusk : shape.plain, x, y, width, height);
    }
    c.globalAlpha = 1;
  }

  /** Thin streaks of cirrus in the high air, leaning with the wind. */
  function drawCirrus(c: CanvasRenderingContext2D) {
    const gap = 56;
    const off = snap(camera * P_CIRRUS);
    const j0 = Math.max(1, Math.ceil((baseY + off - viewH) / gap));
    const j1 = Math.floor((baseY + off + 24) / gap);
    c.fillStyle = CREAM;
    for (let j = j0; j <= j1; j++) {
      const midClimb = (j * gap - baseY + viewH / 2) / P_CIRRUS / cupH;
      const density = smoothstep(5, 11, midClimb) * (1 - smoothstep(27, 34, midClimb)) * 0.6;
      if (hash2(97, j) > density) continue;
      const streaks = 2 + Math.floor(hash2(98, j) * 3);
      const longest = 34;
      const span = viewW + longest * SC + 64;
      const travel = windClock * 9 * (0.8 + 0.4 * hash2(99, j));
      const x = snap(((((hash2(100, j) * span - travel) % span) + span) % span) - longest * SC);
      const y = baseY + off - j * gap;
      if (y < -streaks * SC || y > viewH) continue;
      // Cirrus belongs to a lit sky; over dark sky it would read as grey smudges.
      const lit = smoothstep(0.3, 0.5, skyLumAt(y));
      if (lit <= 0) continue;
      c.globalAlpha = 0.5 * lit * zoneFade(x, y, x + longest * SC, y + streaks * SC);
      c.beginPath();
      for (let s = 0; s < streaks; s++) {
        const lead = (s * 3 + Math.floor(hash2(101 + s, j) * 4)) * SC;
        const length = 8 + Math.floor(hash2(110 + s, j) * 20);
        const split = length > 12 ? 4 + Math.floor(hash2(120 + s, j) * (length - 8)) : length;
        c.rect(x + lead, y + s * SC, split * SC, SC);
        if (split < length) c.rect(x + lead + (split + 2) * SC, y + s * SC, (length - split - 2) * SC, SC);
      }
      c.fill();
    }
    c.globalAlpha = 1;
  }

  // --- Drawing: things that cross the sky -----------------------------------------

  /** Two-frame flap, [x, y] cells; the body stays on row 1. */
  const BIRD_BIG = [
    [0, 0, 4, 0, 1, 1, 2, 1, 3, 1],
    [1, 1, 2, 1, 3, 1, 0, 2, 4, 2],
  ];
  const BIRD_SMALL = [
    [0, 0, 2, 0, 1, 1],
    [1, 1, 0, 2, 2, 2],
  ];
  const FLOCK_MAX = 6;
  const flock = {
    on: false,
    x: 0,
    alt: 0,
    dir: 1,
    speed: 40,
    count: 0,
    small: false,
    wait: 4,
    dx: new Float32Array(FLOCK_MAX),
    dy: new Float32Array(FLOCK_MAX),
    phase: new Float32Array(FLOCK_MAX),
  };

  function stepFlock(dt: number, view: number) {
    if (flock.on) {
      flock.x += flock.dir * flock.speed * windFactor * dt;
      const reach = 40 * SC;
      if (flock.x - reach > viewW || flock.x + reach < 0 || layerY(flock.alt, P_BIRDS) - 40 > viewH) flock.on = false;
      return;
    }
    if (!playing || view > 15) return;
    flock.wait -= dt;
    if (flock.wait > 0) return;
    flock.wait = 8 + Math.random() * 7;
    flock.on = true;
    flock.dir = Math.random() < 0.5 ? -1 : 1;
    flock.small = Math.random() < 0.5;
    flock.count = 3 + Math.floor(Math.random() * (FLOCK_MAX - 2));
    flock.speed = flock.small ? 34 : 46;
    flock.x = flock.dir > 0 ? -8 * SC : viewW + 8 * SC;
    flock.alt = baseY + snap(camera * P_BIRDS) - openSkyY(10 * SC);
    for (let index = 0; index < flock.count; index++) {
      // A loose V trailing behind the leader.
      const rank = Math.ceil(index / 2);
      flock.dx[index] = rank * (5 + Math.floor(Math.random() * 3));
      flock.dy[index] = rank * (index % 2 ? -2 : 2) + Math.floor(Math.random() * 2);
      flock.phase[index] = Math.random() * 2;
    }
  }

  function drawFlock(c: CanvasRenderingContext2D) {
    if (!flock.on) return;
    const leadX = snap(flock.x);
    const leadY = layerY(flock.alt, P_BIRDS);
    const reach = 30 * SC;
    c.globalAlpha = zoneFade(
      flock.dir > 0 ? leadX - reach : leadX,
      leadY - 8 * SC,
      flock.dir > 0 ? leadX + 5 * SC : leadX + reach,
      leadY + 10 * SC,
    );
    c.fillStyle = BIRD;
    c.beginPath();
    const frames = flock.small ? BIRD_SMALL : BIRD_BIG;
    for (let index = 0; index < flock.count; index++) {
      const cells = frames[Math.floor(sceneClock * 5 + flock.phase[index]) & 1];
      const bx = leadX - flock.dir * flock.dx[index] * SC;
      const by = leadY + flock.dy[index] * SC;
      for (let k = 0; k < cells.length; k += 2) c.rect(bx + cells[k] * SC, by + cells[k + 1] * SC, SC, SC);
    }
    c.fill();
    c.globalAlpha = 1;
  }

  // A hot-air balloon shaped like a boba cup, with its straw up top.
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
  const BALLOON_W = 11;
  const balloonSprites = new Map<number, HTMLCanvasElement>();
  const balloon = { on: false, done: false, x: 0, alt: 0, dir: 1, drink: 0 };

  function balloonSprite(drink: number) {
    let sprite = balloonSprites.get(drink);
    if (!sprite) {
      const liquid = DRINKS[drink];
      sprite = gridCanvas(BALLOON, {
        S: STRAW_PINK,
        // A softer outline than the cups', so it stays behind them.
        O: mix(liquid, INK, 0.55),
        l: LID,
        L: liquid,
        h: mix(liquid, CREAM, 0.4),
        b: mix(PEARL, liquid, 0.2),
        r: TABLE_SHADE,
        K: TABLE,
        k: TABLE_SHADE,
      });
      balloonSprites.set(drink, sprite);
    }
    return sprite;
  }

  /** Once a run, early in the open sky: it comes down past the tower's side as you climb. */
  function stepBalloon(dt: number, view: number) {
    if (balloon.on) {
      balloon.x += balloon.dir * 5 * windFactor * dt;
      balloon.alt += 3 * dt;
      const y = layerY(balloon.alt, P_BALLOON);
      if (y > viewH || balloon.x > viewW || balloon.x + BALLOON_W * SC < 0) balloon.on = false;
      return;
    }
    if (balloon.done || !playing || view < 2) return;
    balloon.done = true;
    balloon.on = true;
    balloon.drink = Math.floor(Math.random() * DRINKS.length);
    const left = Math.random() < 0.5;
    balloon.dir = left ? -1 : 1;
    const width = BALLOON_W * SC;
    balloon.x = left
      ? viewW * (0.06 + Math.random() * 0.1)
      : viewW * (0.84 - Math.random() * 0.1) - width;
    // Starts just above the top of the screen and comes into view from there.
    balloon.alt = baseY + snap(camera * P_BALLOON) + 8;
  }

  function drawBalloon(c: CanvasRenderingContext2D) {
    if (!balloon.on) return;
    const sprite = balloonSprite(balloon.drink);
    const x = snap(balloon.x);
    const bob = Math.round(Math.sin(sceneClock * 0.9)) * SC;
    const y = layerY(balloon.alt, P_BALLOON) + bob;
    const width = sprite.width * SC;
    const height = sprite.height * SC;
    c.globalAlpha = zoneFade(x, y, x + width, y + height);
    c.drawImage(sprite, x, y, width, height);
    c.globalAlpha = 1;
  }

  const PLANE_RIGHT = ["B......", "BBBBBBB", "..WW..."];
  let planeSprites: HTMLCanvasElement[] = [];
  const TRAIL_MAX = 64;
  const trailX = new Float32Array(TRAIL_MAX);
  const trailAlt = new Float32Array(TRAIL_MAX);
  const trailAge = new Float32Array(TRAIL_MAX);
  let trailCount = 0;
  const TRAIL_SECONDS = 4;
  const plane = { on: false, x: 0, alt: 0, dir: 1, dotAt: 0, wait: 3 };

  /** A tiny plane across the high air, leaving a dotted contrail that fades. */
  function stepPlane(dt: number, view: number) {
    for (let index = trailCount - 1; index >= 0; index--) {
      trailAge[index] += dt;
      if (trailAge[index] >= TRAIL_SECONDS) {
        trailCount--;
        trailX[index] = trailX[trailCount];
        trailAlt[index] = trailAlt[trailCount];
        trailAge[index] = trailAge[trailCount];
      }
    }
    if (plane.on) {
      plane.x += plane.dir * 58 * dt;
      // A dot every second cell, from the tail.
      if (Math.abs(plane.x - plane.dotAt) >= SC * 2 && trailCount < TRAIL_MAX) {
        plane.dotAt = plane.x;
        trailX[trailCount] = plane.dir > 0 ? plane.x - SC : plane.x + 7 * SC;
        trailAlt[trailCount] = plane.alt - SC;
        trailAge[trailCount] = 0;
        trailCount++;
      }
      if (plane.x > viewW + 8 * SC || plane.x < -8 * SC) plane.on = false;
      return;
    }
    if (!playing || view < 10 || view > 30) {
      plane.wait = Math.min(plane.wait, 3);
      return;
    }
    plane.wait -= dt;
    if (plane.wait > 0) return;
    plane.wait = 14 + Math.random() * 8;
    plane.on = true;
    plane.dir = Math.random() < 0.5 ? -1 : 1;
    plane.x = plane.dir > 0 ? -7 * SC : viewW;
    plane.dotAt = plane.x;
    plane.alt = baseY + snap(camera * P_PLANE) - openSkyY(3 * SC);
  }

  function drawPlane(c: CanvasRenderingContext2D) {
    if (trailCount) {
      c.fillStyle = CREAM;
      for (let index = 0; index < trailCount; index++) {
        const x = snap(trailX[index]);
        const y = layerY(trailAlt[index], P_PLANE);
        const fresh = 1 - trailAge[index] / TRAIL_SECONDS;
        c.globalAlpha = (Math.ceil(fresh * 4) / 4) * 0.6 * zoneFade(x, y, x + SC, y + SC);
        c.fillRect(x, y, SC, SC);
      }
    }
    if (plane.on && planeSprites.length) {
      const sprite = planeSprites[plane.dir > 0 ? 0 : 1];
      const x = snap(plane.x);
      const y = layerY(plane.alt, P_PLANE) - 2 * SC;
      c.globalAlpha = zoneFade(x, y, x + 7 * SC, y + 3 * SC);
      c.drawImage(sprite, x, y, sprite.width * SC, sprite.height * SC);
    }
    c.globalAlpha = 1;
  }

  const SATELLITE = [".....A.....", "PpPsBBBsPpP", "pPp.BBB.pPp"];
  let satelliteSprite: HTMLCanvasElement | null = null;
  const satellite = { on: false, x: 0, alt: 0, dir: 1, wait: 4 };

  /** A satellite every so often in space, its light blinking. */
  function stepSatellite(dt: number, view: number) {
    if (satellite.on) {
      satellite.x += satellite.dir * 26 * dt;
      if (satellite.x > viewW + 12 * SC || satellite.x < -12 * SC) satellite.on = false;
      return;
    }
    if (!playing || view < 26) {
      satellite.wait = Math.min(satellite.wait, 4);
      return;
    }
    satellite.wait -= dt;
    if (satellite.wait > 0) return;
    satellite.wait = 16 + Math.random() * 10;
    satellite.on = true;
    satellite.dir = Math.random() < 0.5 ? -1 : 1;
    satellite.x = satellite.dir > 0 ? -11 * SC : viewW;
    satellite.alt = baseY + snap(camera * P_SATELLITE) - openSkyY(4 * SC);
  }

  function drawSatellite(c: CanvasRenderingContext2D) {
    if (!satellite.on || !satelliteSprite) return;
    const x = snap(satellite.x);
    const y = layerY(satellite.alt, P_SATELLITE);
    c.globalAlpha = zoneFade(x, y - SC, x + 11 * SC, y + 3 * SC);
    c.drawImage(satelliteSprite, x, y, satelliteSprite.width * SC, satelliteSprite.height * SC);
    if (sceneClock % 1.2 < 0.18) {
      c.fillStyle = ACCENT;
      c.fillRect(x + 5 * SC, y - SC, SC, SC);
    }
    c.globalAlpha = 1;
  }

  // --- Drawing: the rooftop, table, and tray ----------------------------------------

  /**
   * The roof the tower stands on, in world space so it scales with the
   * pull-back: a parapet with a lit coping, the deck, a vent and an AC unit
   * kept well clear of the tower. Wide and deep enough to fill the view
   * however far it zooms out.
   */
  function drawRooftop(c: CanvasRenderingContext2D, ground: number) {
    const floor = ground + 11 * unit;
    const wall = floor - 7 * SC;
    const scale = Math.min(1, zoom);
    const reach = viewW / (2 * scale) + 8;
    const left = Math.floor(viewW / 2 - reach);
    const width = Math.ceil(reach * 2);
    const deep = (viewH - groundY) / scale + viewH;
    const cx = snap(viewW / 2);
    c.fillStyle = ROOF_SHADE;
    c.fillRect(left, wall, width, floor - wall);
    c.fillStyle = ROOF_LIGHT;
    c.fillRect(left, wall, width, SC);
    // Block joints, staggered by course.
    c.fillStyle = ROOF_JOINT;
    c.beginPath();
    const course = Math.floor((floor - wall - SC) / 2 / SC) * SC;
    for (let k = -Math.ceil(reach / (14 * SC)) - 1; k <= Math.ceil(reach / (14 * SC)) + 1; k++) {
      c.rect(cx + k * 14 * SC, wall + SC, SC, course);
      c.rect(cx + k * 14 * SC + 7 * SC, wall + SC + course, SC, floor - wall - SC - course);
    }
    c.fill();
    c.fillStyle = ROOF;
    c.fillRect(left, floor, width, deep);
    c.fillStyle = ROOF_SHADE;
    c.fillRect(left, floor, width, SC);
    // Seams in the deck, broken here and there.
    c.fillStyle = ROOF_SEAM;
    c.beginPath();
    for (let k = -Math.ceil(reach / (6 * SC)); k <= Math.ceil(reach / (6 * SC)); k++) {
      if (hash2(k, 3) < 0.3) continue;
      c.rect(cx + k * 6 * SC, floor + 4 * SC, 5 * SC, SC);
    }
    c.fill();

    const base = floor + 2 * SC;
    // A mushroom vent, its shadow falling away from the sun.
    const vx = cx - snap(viewW * 0.34);
    c.fillStyle = ROOF_SHADE;
    c.fillRect(vx + 2 * SC, base - SC, 2 * SC, SC);
    c.fillStyle = STONE[1];
    c.fillRect(vx, base - 6 * SC, SC, 6 * SC);
    c.fillStyle = STONE[3];
    c.fillRect(vx + SC, base - 6 * SC, SC, 6 * SC);
    c.fillStyle = STONE[2];
    c.fillRect(vx - SC, base - 7 * SC, 4 * SC, SC);
    c.fillStyle = STONE[1];
    c.fillRect(vx, base - 8 * SC, 2 * SC, SC);
    // An AC unit: fan on the left, grille on the right.
    const ax = cx + snap(viewW * 0.3) - 8 * SC;
    c.fillStyle = ROOF_SHADE;
    c.fillRect(ax + 8 * SC, base - 4 * SC, SC, 4 * SC);
    c.fillStyle = STONE[1];
    c.fillRect(ax, base - 5 * SC, 8 * SC, 5 * SC);
    c.fillStyle = STONE[0];
    c.fillRect(ax, base - 5 * SC, 8 * SC, SC);
    c.fillStyle = STONE[2];
    c.fillRect(ax + 7 * SC, base - 4 * SC, SC, 4 * SC);
    c.fillStyle = STONE[3];
    c.beginPath();
    c.rect(ax + SC, base - 3 * SC, 3 * SC, SC);
    c.rect(ax + 2 * SC, base - 4 * SC, SC, 3 * SC);
    c.rect(ax + 5 * SC, base - 4 * SC, SC, SC);
    c.rect(ax + 5 * SC, base - 2 * SC, SC, SC);
    c.fill();
    c.fillStyle = STONE[4];
    c.fillRect(ax + 2 * SC, base - 3 * SC, SC, SC);
  }

  /**
   * A bistro table on the tower's own grid, and on it the tray, drawn from
   * the same span the first drop is judged against: ink outline, paper
   * face, and the accent slab printed a cell off register.
   */
  function drawTable(c: CanvasRenderingContext2D, ground: number) {
    const u = unit;
    const tray = traySpan();
    const x0 = Math.round(screenX(tray.left));
    const width = tray.width * u;
    const mid = Math.round(screenX(0));
    const floor = ground + 11 * u;
    c.fillStyle = ROOF_SHADE;
    c.fillRect(mid - 6 * u, floor, 12 * u, u);
    c.fillStyle = TABLE;
    c.fillRect(x0 - u, ground + 3 * u, width + 2 * u, u);
    c.fillRect(mid - u, ground + 5 * u, u, 4 * u);
    c.fillRect(mid - 2 * u, ground + 9 * u, 4 * u, u);
    c.fillStyle = TABLE_SHADE;
    c.fillRect(x0, ground + 4 * u, width, u);
    c.fillRect(mid, ground + 5 * u, u, 4 * u);
    c.fillRect(mid - 4 * u, ground + 10 * u, 8 * u, u);
    c.fillStyle = ACCENT;
    c.fillRect(x0 + u, ground + u, width, 3 * u);
    c.fillStyle = INK;
    c.fillRect(x0, ground, width, 3 * u);
    c.fillStyle = TRAY_PAPER;
    c.fillRect(x0 + u, ground + u, width - 2 * u, u);
  }

  // --- Drawing: the tower --------------------------------------------------------

  function drawCup(layer: Span & { drink: number }, top: number, squash = 0) {
    if (!ctx) return;
    const sprite = cachedSprite(
      `stack-${layer.width}-${layer.drink}`,
      gridFor(layer.width),
      unit,
      PALETTES[layer.drink],
      HALO,
    );
    const x = Math.round(screenX(layer.left)) - SPRITE_PAD;
    if (squash <= 0) {
      ctx.drawImage(sprite, x, Math.round(top) - SPRITE_PAD);
      return;
    }
    // A little squash as the cup lands, anchored at its base.
    ctx.save();
    ctx.translate(0, top + cupH);
    ctx.scale(1, 1 - squash * 0.1);
    ctx.drawImage(sprite, x, -cupH - SPRITE_PAD);
    ctx.restore();
  }

  /** Light ink on a dark sky, dark ink on a pale one, each with a backing. */
  function inkFor(y: number) {
    return skyLumAt(y) > 0.5
      ? { fg: "#1a1a1a", back: CREAM, perfect: "#c9462f", gold: "#704a05" }
      : { fg: CREAM, back: NIGHT, perfect: "#f07563", gold: "#ffd166" };
  }

  /**
   * A dashed line at the height of the personal best, in screen space so it
   * spans the view even while zoomed out. Each dash sits on a one-cell
   * backing, and the label on a chip, so both read from dusk to space.
   */
  function drawBestLine(c: CanvasRenderingContext2D) {
    if (previousBest <= 0) return;
    const world = levelTop(previousBest - 1);
    const y = Math.round(groundY + (world - groundY) * zoom);
    if (y < playTop + 8 || y > viewH) return;
    const ink = inkFor(y);
    c.save();
    c.globalAlpha = 0.55;
    c.fillStyle = ink.back;
    c.beginPath();
    for (let x = 16; x < viewW - 16; x += 5 * SC) c.rect(x, y - SC / 2, 3 * SC, SC);
    c.fill();
    c.globalAlpha = 0.9;
    c.fillStyle = ink.fg;
    c.beginPath();
    for (let x = 16; x < viewW - 16; x += 5 * SC) c.rect(x, y - 1, 3 * SC, 2);
    c.fill();
    const label = `your best ${previousBest}`;
    c.font = labelFont;
    const width = Math.ceil((c.measureText(label).width + 12) / SC) * SC;
    c.globalAlpha = 0.9;
    c.fillStyle = ink.back;
    c.fillRect(16, y - 6 - 5 * SC, width, 5 * SC);
    c.globalAlpha = 1;
    c.fillStyle = ink.fg;
    c.textBaseline = "middle";
    c.fillText(label, 22, y - 6 - 2.5 * SC);
    c.restore();
  }

  function drawPiece(piece: Piece) {
    if (!ctx) return;
    const grid = gridFor(piece.gridWidth);
    const width = (piece.to - piece.from) * unit;
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.angle);
    const x = -width / 2;
    const y = -cupH / 2;
    drawHalo(ctx, grid, x, y, unit, HALO, piece.from, piece.to);
    drawSprite(ctx, grid, x, y, unit, PALETTES[piece.drink], piece.from, piece.to);
    ctx.restore();
  }

  /** The perfect-drop outline: accent on an ink edge, so it reads on pale sky and on space. */
  function drawFlashes(c: CanvasRenderingContext2D) {
    for (const flash of flashes) {
      const grow = Math.floor((flash.age * 30) / SC) * SC;
      const alpha = Math.max(0, 1 - flash.age / 0.35);
      const x = Math.round(screenX(flash.left)) - 4 - grow;
      const y = Math.round(levelTop(flash.level)) - 4 - grow;
      const w = flash.width * unit + 8 + grow * 2;
      const h = cupH + 8 + grow * 2;
      c.globalAlpha = alpha * 0.7;
      c.strokeStyle = INK;
      c.lineWidth = 5;
      c.strokeRect(x, y, w, h);
      c.globalAlpha = alpha;
      c.strokeStyle = ACCENT;
      c.lineWidth = 3;
      c.strokeRect(x, y, w, h);
    }
    c.globalAlpha = 1;
  }

  // --- Particles ---------------------------------------------------------------------

  // One pool for the landing crumbs and the perfect-drop sparkles.
  const BIT_MAX = 160;
  const BIT_CRUMB = 0;
  const BIT_SPARK = 1;
  const bits = Array.from({ length: BIT_MAX }, () => ({
    kind: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 1,
    size: 3,
    color: CREAM,
  }));
  let bitCount = 0;

  function spawnBit(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string) {
    if (bitCount >= BIT_MAX) return;
    const bit = bits[bitCount++];
    bit.kind = kind;
    bit.x = x;
    bit.y = y;
    bit.vx = vx;
    bit.vy = vy;
    bit.age = 0;
    bit.life = life;
    bit.size = size;
    bit.color = color;
  }

  /** A ring of sparkle cells thrown out from the cup's edge. */
  function sparkleRing(cx: number, cy: number, width: number, color: string) {
    const count = 12;
    const rx = width / 2 + 6;
    const ry = cupH / 2 + 6;
    const turn = Math.random() * Math.PI;
    for (let index = 0; index < count; index++) {
      const angle = turn + (index / count) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      spawnBit(BIT_SPARK, cx + cos * rx, cy + sin * ry, cos * 80, sin * 80, 0.5, SC, color);
    }
  }

  function stepBits(dt: number) {
    for (let index = bitCount - 1; index >= 0; index--) {
      const bit = bits[index];
      bit.age += dt;
      if (bit.age >= bit.life) {
        bits[index] = bits[bitCount - 1];
        bits[bitCount - 1] = bit;
        bitCount--;
        continue;
      }
      if (bit.kind === BIT_CRUMB) {
        bit.vy += 240 * dt;
      } else {
        const drag = Math.max(0, 1 - 3.2 * dt);
        bit.vx *= drag;
        bit.vy *= drag;
      }
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
    }
  }

  function drawBits(c: CanvasRenderingContext2D) {
    for (let index = 0; index < bitCount; index++) {
      const bit = bits[index];
      const t = bit.age / bit.life;
      c.fillStyle = bit.color;
      if (bit.kind === BIT_CRUMB) {
        c.globalAlpha = 1 - t;
        c.fillRect(Math.round(bit.x), Math.round(bit.y), bit.size, bit.size);
        continue;
      }
      // Sparkles fade in printed steps, a plus while fresh, then one cell.
      const x = snap(bit.x);
      const y = snap(bit.y);
      c.globalAlpha = Math.ceil((1 - t) * 3) / 3;
      c.fillRect(x, y, SC, SC);
      if (t < 0.4) {
        c.globalAlpha *= 0.55;
        c.fillRect(x - SC, y, SC, SC);
        c.fillRect(x + SC, y, SC, SC);
        c.fillRect(x, y - SC, SC, SC);
        c.fillRect(x, y + SC, SC, SC);
      }
    }
    c.globalAlpha = 1;
  }

  /** Canvas popups on a chip of the sky's opposite, legible at any height. */
  function drawNotes(c: CanvasRenderingContext2D) {
    if (!popups.length) return;
    c.save();
    c.font = popupFont;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const popup of popups) {
      const x = Math.round(popup.x);
      const y = Math.round(popup.y);
      const ink = inkFor(y);
      const width = Math.ceil((c.measureText(popup.text).width + 14) / SC) * SC;
      const fade = Math.max(0, popup.life / popup.maxLife);
      c.globalAlpha = fade * 0.92;
      c.fillStyle = ink.back;
      c.fillRect(Math.round(x - width / 2), y - 10, width, 20);
      c.globalAlpha = fade;
      c.fillStyle = popup.kind === "perfect" ? ink.perfect : popup.kind === "gold" ? ink.gold : ink.fg;
      c.fillText(popup.text, x, y + 0.5);
    }
    c.restore();
  }

  // --- Drawing: the frame ------------------------------------------------------

  /** Everything behind the tower, far to near, in screen space from the camera's altitude. */
  function drawScene(c: CanvasRenderingContext2D) {
    const view = camera / cupH;
    drawSky(c);
    drawStars(c, view);
    drawMoon(c, view);
    drawEarth(c, view);
    drawSatellite(c);
    drawSun(c);
    drawCity(c, CITY[0]);
    drawCirrus(c);
    drawClouds(c, CLOUDS[0]);
    drawPlane(c);
    drawCity(c, CITY[1]);
    drawClouds(c, CLOUDS[1]);
    drawFlock(c);
    drawBalloon(c);
    drawClouds(c, CLOUDS[2]);
  }

  function draw() {
    if (!ctx) return;
    const c = ctx;
    c.imageSmoothingEnabled = false;
    // The scene is opaque and never scaled: the pull-back only zooms the world.
    drawScene(c);
    drawBestLine(c);

    c.save();
    if (zoom !== 1) {
      // Pull back to show the whole tower once it has fallen.
      c.translate(viewW / 2, groundY);
      c.scale(zoom, zoom);
      c.translate(-viewW / 2, -groundY);
    }
    const ground = Math.round(groundY + camera);
    drawRooftop(c, ground);
    drawTable(c, ground);
    for (let level = 1; level < tower.length; level++) {
      const layer = tower[level];
      const top = levelTop(level - 1);
      if (top > viewH / zoom + cupH || top < -cupH * 4 - viewH / zoom) continue;
      drawCup(layer, top, layer.land / 0.12);
    }
    drawFlashes(c);
    // The slider glides; a drop then snaps toward the tower (`snapDrop`), so
    // it is never cut by more than was seen hanging over.
    if (playing) {
      sliderShown.left = slider.left;
      sliderShown.width = slider.width;
      sliderShown.drink = slider.drink;
      drawCup(sliderShown, levelTop(tower.length - 1));
    }
    for (const piece of pieces) drawPiece(piece);
    drawBits(c);
    c.restore();
    drawNotes(c);
  }

  // --- Rules in motion ---------------------------------------------------------

  function nextSlider() {
    const top = tower[tower.length - 1];
    const width = sliderWidth(top);
    track = trackFor(top, halfScreen, width);
    // Cups come in from alternating sides.
    const fromLeft = tower.length % 2 === 1;
    slider = {
      left: fromLeft ? track.min : track.max,
      direction: fromLeft ? 1 : -1,
      width,
      drink: tower.length % DRINKS.length,
    };
  }

  function breakOff(cut: Span, snappedLeft: number, level: number, whole: boolean) {
    const from = whole ? 0 : cut.left - snappedLeft;
    const to = whole ? slider.width : from + cut.width;
    const centerUnits = cut.left + cut.width / 2;
    const side = centerUnits < tower[tower.length - 1].left + tower[tower.length - 1].width / 2 ? -1 : 1;
    pieces.push({
      x: screenX(centerUnits),
      y: levelTop(level) + cupH / 2,
      vx: side * (40 + Math.random() * 50),
      vy: -80,
      angle: 0,
      spin: side * (2.5 + Math.random() * 2),
      drink: slider.drink,
      gridWidth: slider.width,
      from,
      to,
    });
  }

  function drop() {
    if (!playing || paused || gameOver) return;
    const now = performance.now();
    if (now - lastDrop < 80) return;
    lastDrop = now;
    tipVisible = false;

    const top = tower[tower.length - 1];
    const level = tower.length - 1;
    const result = dropCup(top, slider.left, slider.width);
    const snapped = snapDrop(top, slider.left, slider.width);

    if (result.kind === "miss" || !result.placed) {
      breakOff({ left: snapped, width: slider.width }, snapped, level, true);
      topple();
      return;
    }

    let placed: Span = result.placed;
    if (result.kind === "perfect") {
      streak += 1;
      perfects += 1;
      bestStreak = Math.max(bestStreak, streak);
      const grown = widthAfterPerfect(placed.width, streak);
      if (grown > placed.width) {
        // Grow back toward the tray's center line.
        const growLeft = placed.left + placed.width / 2 > 0;
        placed = { left: growLeft ? placed.left - 1 : placed.left, width: grown };
      }
      flashes.push({ level, left: placed.left, width: placed.width, age: 0 });
      addPopup(
        popups,
        screenX(placed.left + placed.width / 2),
        levelTop(level) - 14,
        grown > result.placed.width ? `perfect ×${streak}, wider` : streak > 1 ? `perfect ×${streak}` : "perfect",
        "perfect",
      );
    } else {
      streak = 0;
      if (result.cut) {
        breakOff(result.cut, snapped, level, false);
        sfxSlice();
      }
    }

    tower = [...tower, { ...placed, drink: slider.drink, land: reduceMotion ? 0 : 0.12 }];
    stacked = tower.length - 1;
    const x = screenX(placed.left + placed.width / 2);
    for (let i = 0; i < (result.kind === "perfect" ? 10 : 5); i++) {
      const life = 0.38 + Math.random() * 0.22;
      spawnBit(
        BIT_CRUMB,
        x + (Math.random() - 0.5) * placed.width * unit,
        levelTop(level) + cupH,
        (Math.random() - 0.5) * 120,
        -30 - Math.random() * 60,
        life,
        Math.random() > 0.65 ? 4 : 3,
        DRINKS[slider.drink],
      );
    }
    if (result.kind === "perfect" && !reduceMotion) {
      // From the third perfect in a row, the sparkles take the drink's colour.
      const cy = levelTop(level) + cupH / 2;
      const color = streak >= GROW_AFTER ? DRINKS[slider.drink] : skyLumAt(cy) > 0.6 ? "#d9902f" : "#ffd166";
      sparkleRing(x, cy, placed.width * unit, color);
    }

    if (stacked % 10 === 0) {
      sfxMilestone();
      addPopup(popups, x, levelTop(level) - 32, `${stacked} high`, "gold", 1);
      liveMessage = `${stacked} cups high.`;
    } else {
      sfxPlace(result.kind === "perfect", stacked);
      if (result.kind === "perfect") liveMessage = `Perfect. ${stacked} cups.`;
    }
    setMusicPhase(phaseForHeight(stacked));
    nextSlider();
  }

  function topple() {
    playing = false;
    streak = 0;
    sfxTopple();
    liveMessage = `The cup missed. ${stacked} cups high.`;
    // Let the last cup fall and the camera pull back before the slip.
    timers.later(() => void endGame(), reduceMotion ? 300 : 1300);
  }

  /** The sky's moving parts. Reduced motion keeps the scene still at its altitude. */
  function stepScene(dt: number) {
    sceneClock += dt;
    windFactor = 0.75 + (0.25 * speedForHeight(stacked)) / 15;
    if (reduceMotion) {
      flock.on = false;
      balloon.on = false;
      plane.on = false;
      satellite.on = false;
      trailCount = 0;
      return;
    }
    const view = camera / cupH;
    windClock += dt * windFactor;
    stepFlock(dt, view);
    stepBalloon(dt, view);
    stepPlane(dt, view);
    stepSatellite(dt, view);
  }

  function frame(timestamp: number) {
    if (!active) return;
    if (!last) last = timestamp;
    const dt = Math.min((timestamp - last) / 1000, 0.05);
    last = timestamp;

    if (paused) {
      raf = requestAnimationFrame(frame);
      return;
    }

    if (playing) {
      const top = tower[tower.length - 1];
      track = trackFor(top, halfScreen, slider.width);
      const moved = stepSlide(slider.left, slider.direction, speedForHeight(stacked) * dt, track);
      slider.left = moved.position;
      slider.direction = moved.direction;
    }

    // Keep the sliding cup about a third of the way down the play area.
    const desired = playTop + (viewH - playTop) * 0.34;
    const target = playing ? Math.max(0, desired - (groundY - tower.length * cupH)) : 0;
    camera += (target - camera) * Math.min(1, dt * (playing ? 6 : 3));
    if (!playing) {
      const towerHeight = tower.length * cupH + 40;
      const fit = Math.min(1, (groundY - playTop - 24) / towerHeight);
      zoom += (fit - zoom) * Math.min(1, dt * 3);
    }

    for (const layer of tower) layer.land = Math.max(0, layer.land - dt);
    for (let index = flashes.length - 1; index >= 0; index--) {
      flashes[index].age += dt;
      if (flashes[index].age > 0.35) flashes.splice(index, 1);
    }
    for (let index = pieces.length - 1; index >= 0; index--) {
      const piece = pieces[index];
      piece.vy += 2200 * dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.angle += piece.spin * dt;
      if (piece.y > viewH / Math.min(1, zoom) + cupH * 2) pieces.splice(index, 1);
    }
    updateZone();
    stepScene(dt);
    stepBits(dt);
    stepPopups(popups, dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  // --- Pause, restart, and finish -----------------------------------------

  async function pauseGame() {
    if (gameOver || paused || !playing) return;
    paused = true;
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
    hudButtons?.focusPause();
  }

  function togglePause() {
    if (paused) resumeGame();
    else void pauseGame();
  }

  async function endGame() {
    if (gameOver) return;
    gameOver = true;
    const result = concludeRun("stack", stacked);
    localBest = result.best;
    newBest = result.newBest;
    liveMessage = `Timber. ${stacked} cups high.`;
    await tick();
    slip?.focus();
  }

  function begin() {
    tower = [{ ...traySpan(), drink: 0, land: 0 }];
    stacked = 0;
    streak = 0;
    bestStreak = 0;
    perfects = 0;
    pieces = [];
    flashes = [];
    popups = [];
    bitCount = 0;
    camera = 0;
    zoom = 1;
    playing = true;
    paused = false;
    gameOver = false;
    newBest = false;
    previousBest = readBest("stack");
    last = 0;
    // Back on the roof: nothing left crossing the sky from the last climb.
    flock.on = false;
    flock.wait = 4;
    balloon.on = false;
    balloon.done = false;
    plane.on = false;
    plane.wait = 3;
    satellite.on = false;
    satellite.wait = 4;
    trailCount = 0;
    nextSlider();
    setMusicPhase("opening");
    startMusic();
  }

  function restart() {
    stopMusic();
    timers.clear();
    begin();
    liveMessage = "New tower. Drop the first cup.";
  }

  // --- Sizing and lifecycle ------------------------------------------------

  function sizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    ctx = fitCanvas(canvas, viewW, viewH);
    unit = viewW < 640 ? 4 : 5;
    cupH = CUP_ROWS * unit;
    halfScreen = Math.floor(viewW / 2 / unit) - 1;
    playTop = hudRow ? hudRow.getBoundingClientRect().bottom : 80;
    groundY = viewH - Math.max(56, Math.round(viewH * 0.1));
    baseY = snap(groundY);
    if (tower.length) track = trackFor(tower[tower.length - 1], halfScreen, slider.width);
    buildSky();
    for (const layer of CITY) buildCity(layer);
    buildMoon();
    sizeEarth();
    draw();
  }

  function onPointer(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    drop();
  }

  onMount(() => {
    popupFont = arcadeFont();
    labelFont = arcadeFont(12, 400);
    buildClouds();
    buildSun();
    planeSprites = [
      gridCanvas(PLANE_RIGHT, { B: CREAM, W: CLOUD_SHADE }),
      gridCanvas(
        PLANE_RIGHT.map((row) => [...row].reverse().join("")),
        { B: CREAM, W: CLOUD_SHADE },
      ),
    ];
    satelliteSprite = gridCanvas(SATELLITE, {
      A: STONE[3],
      P: EARTH.ocean,
      p: EARTH.oceanLight,
      s: STONE[3],
      B: STONE[0],
    });
    const unmountShell = mountShell({
      isOver: () => gameOver,
      isPaused: () => paused,
      pause: () => void pauseGame(),
      togglePause,
      playScope: () => hudRow.closest(".boba-hud"),
      onKey: (event) => {
        // A focused control keeps Space and Enter for itself.
        if (!DROP_KEYS.has(event.key) || isOnControl(event)) return;
        event.preventDefault();
        drop();
      },
      onResize: sizeCanvas,
      observe: hudRow,
      onReduceMotion: (reduce) => (reduceMotion = reduce),
    });
    sizeCanvas();
    tipVisible = firstVisit("stack");
    begin();
    raf = requestAnimationFrame(frame);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      timers.clear();
      stopMusic();
      unmountShell();
    };
  });
</script>

<div class="boba-stage cs-stage" on:pointerdown={onPointer} aria-hidden="true"></div>
<canvas bind:this={canvas} class="boba-canvas" aria-hidden="true"></canvas>

<header class="boba-hud boba-ui is-bare" aria-label="Cup stack status">
  <div bind:this={hudRow} class="boba-hud-row">
    <div class="boba-ticket boba-ticket-start boba-riso" style="--tilt: -1.3deg">
      <span class="boba-ticket-icon" aria-hidden="true">
        <PixelIcon grid={MENU_ICONS.stack.grid} palette={MENU_ICONS.stack.palette} px={3} />
      </span>
      <span class="boba-big">{String(stacked).padStart(2, "0")}</span>
      <span class="boba-stack">
        <span class="boba-meta">cups high</span>
        {#key streak}
          <span class="boba-combo" class:active={streak > 1}>
            {streak > 1 ? `×${streak} perfect` : streak === 1 ? "perfect" : "line them up"}
          </span>
        {/key}
      </span>
    </div>

    <div class="boba-ticket boba-ticket-end boba-riso" style="--tilt: -0.6deg">
      <span class="boba-stack">
        <span class="boba-meta">best</span>
        <span class="boba-phase">{previousBest ? `${previousBest} high` : "none yet"}</span>
      </span>
      <HudButtons bind:this={hudButtons} {paused} disabled={!playing} on:pause={togglePause} />
    </div>
  </div>

  {#if tipVisible && !paused}
    <div class="boba-tip" role="note" aria-label="How to play">
      <span>drop each cup onto the last</span>
      <span class="boba-keys"><kbd>Space</kbd> drop</span>
    </div>
  {/if}
</header>

{#if paused && !gameOver}
  <PauseCard
    bind:this={pauseCard}
    deck="The tower is holding still for you. Mostly."
    on:resume={resumeGame}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

{#if gameOver}
  <ResultsSlip
    bind:this={slip}
    game="stack"
    title="timber"
    deck={stacked === 0
      ? "Not one cup landed. The tray is very clean."
      : `${stacked} ${stacked === 1 ? "cup" : "cups"} high before gravity won.`}
    score={stacked}
    unit="cups"
    {newBest}
    stats={[
      { label: "cups stacked", value: stacked },
      { label: "perfect drops", value: perfects },
      { label: "best streak", value: `×${bestStreak}` },
      { label: "personal best", value: localBest },
    ]}
    on:restart={restart}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>

<style>
  /* The climb is painted the same in both themes and is opaque: the stage
     takes the rooftop's dusk so the site never shows through behind it. */
  .cs-stage {
    background: #f0c9a0;
  }
</style>
