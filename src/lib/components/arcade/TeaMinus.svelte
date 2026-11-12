<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  import {
    setMusicPaused,
    setMusicPhase,
    setThruster,
    sfxBlip,
    sfxCountdown,
    sfxCrashLanding,
    sfxDescentAlarm,
    sfxLowFuel,
    sfxStart,
    sfxTouchdown,
    startMusic,
    stopMusic,
  } from "$lib/sfx";
  import { COUNTDOWN_SECONDS, stepCountdown } from "$lib/arcade/countdown.js";
  import {
    GRAVITY,
    MAX_FUEL,
    PERIOD,
    SAFE_VX,
    SAFE_VY,
    START_LIVES,
    altitudeOf,
    clearance,
    createRng,
    groundAt,
    makeSite,
    newShip,
    stepShip,
    windAt,
    zoomForClearance,
  } from "$lib/arcade/lander-engine.js";
  import type { CrashReason, Pad, Ship, Site, Touchdown } from "$lib/arcade/lander-engine.js";
  import {
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
    drawLoop,
    drawSprite,
    fitCanvas,
    stepPopups,
    type Popup,
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

  // Tea minus: a lunar lander painted as a pixel-print night. The cup's tea is
  // its fuel, so every burn empties it a little; whatever is left on touchdown
  // is the score. All rules and physics live in lander-engine.js; this file
  // only steps it, draws it, and wires it to the arcade.

  const { exit, toMenu } = arcadeExits(createEventDispatcher<{ close: null; menu: null }>());

  type Held = { left: boolean; right: boolean; thrust: boolean };
  type Mode = "countdown" | "flying" | "landed" | "crashed" | "over";

  const STEP = 1 / 120;
  const HALO = "rgba(253, 248, 243, 0.8)";
  const TEA = "#c79a6b";
  const EMPTY_CUP = "#f6eee2";
  /** Between attempts: how long the result stays up, and when it can be skipped. */
  const RESULT_SECONDS = 2.6;
  const SKIP_AFTER = 0.7;
  const GAME_OVER_SECONDS = 1.6;
  const INTRO_SECONDS = 5;
  /** Below this altitude a fast descent or drift counts as unsafe. */
  const DANGER_ALTITUDE = 150;
  const LOW_FUEL = 110;
  const PATH_SAMPLE = 0.08;
  /** Landing notes: px between lines, and seconds between arrivals. */
  const POPUP_GAP = 24;
  const POPUP_STAGGER = 0.12;

  // --- The scene's palette ---------------------------------------------------
  // Space has no light mode: the scene is painted the same in both site
  // themes, and only the HTML on top of it (tickets, caption, buttons) follows
  // the theme.

  const NIGHT = { top: "#141a2e", mid: "#1f2547", horizon: "#3b2a52" };
  const RANGE = { far: "#2a2748", near: "#3a3157", rim: "#5b4f7a" };
  const CREAM = "#fdf8f3";
  const EARTH = {
    ocean: "#3a6a91",
    oceanLight: "#779bbe",
    land: "#3d7a55",
    landLight: "#7bae8c",
    cloud: CREAM,
    night: "#141a2e",
  };
  /** Regolith, lit to deep, plus a crater's darkest floor. */
  const REGOLITH = ["#e9dfd0", "#d8ccba", "#b9ab98", "#9c8f7e", "#867a6b"];
  const SCENE_INK = "#1a1a1a";
  const ACCENT = "#e85d4c";
  const COASTER_PAPER = "#fbf2e8";
  const LABEL_GOLD = "#704a05";
  /** Flame by heat: core, yellow, gold, red, and the tail at the ragged edge. */
  const FLAME = ["#fff6d8", "#ffd166", "#dba84d", "#e85d4c", "#8a3251"];
  const SMOKE = "#cfc6ba";
  const NOTE_GOLD = "#ffd166";
  const LOOP_COLORS = { ink: CREAM, paper: COASTER_PAPER, slab: ACCENT, muted: CREAM };
  /** The screen-space art cell, in CSS px. World-space art uses CELL units. */
  const SC = 4;
  /** Ordered dithering thresholds, 4 × 4. */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((value) => (value + 0.5) / 16);
  const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

  /** Full-burn flame length in cells, and how fast it retracts on cut-off. */
  const FLAME_FULL = 9;
  const FLAME_RETRACT = FLAME_FULL / 0.12;
  const FLAME_ROWS = 13;
  const FLAME_COLUMNS = 7;
  const POP_SECONDS = 0.034;
  const MAX_PARTICLES = 300;

  // --- Copy ------------------------------------------------------------------

  const INTRO_FIRST = "The moon ordered a milk tea. You're the last mile.";
  const INTRO_SECOND = "Crosswind reported. Yes, on the moon.";
  const INTRO_LATER = [
    "Smaller coasters, less tea. Budget cuts.",
    "The coasters keep shrinking. The order doesn't.",
  ];
  const LANDINGS = [
    "Contact. The tea didn't ripple.",
    "Down and upright. The straw salutes.",
    "Delivered. Someone up here ordered ahead.",
    "Soft enough to keep the foam.",
    "Landed. The pearls barely noticed.",
  ];
  const CRASHES: Record<CrashReason, string[]> = {
    fast: [
      "That was a spill. A fast one.",
      "New crater. It smells faintly of oolong.",
      "The moon has been served, all at once.",
    ],
    hard: ["On the coaster, through the coaster.", "Right place, wrong speed."],
    tilt: ["Lid side down. Tea prefers upright.", "Sideways counts as a pour, not a landing."],
    drift: ["A gentle descent, then a long skid.", "Down softly, but still going somewhere."],
    off: ["A lovely approach to a place with no coaster.", "The coasters are the flat parts."],
  };
  const EMPTY_LINE = "The cup is empty. Gravity has noticed.";

  // --- The lander sprite -------------------------------------------------------

  // One cell is two world units. The bottom row (the foot pads) sits at local
  // y = -FOOT_DROP, so the drawn feet are where the engine's feet are.
  const CELL = 2;
  const LANDER = [
    "......S......",
    "......S......",
    "....OOOOO....",
    "...OlllllO...",
    "..OOOOOOOOO..",
    "...OTTTTTO...",
    "...OTTTTTO...",
    "...OTTTTTO...",
    "...OTbTbTO...",
    "...OOOOOOO...",
    "..O..ONO..O..",
    ".O....N....O.",
    "OOO.......OOO",
  ];
  const LANDER_COLUMNS = 13;
  /** Local y of the sprite's top edge, in world units (bottom edge at -8). */
  const LANDER_TOP = LANDER.length * CELL - 8;
  const TEA_ROWS = [5, 6, 7, 8];
  const LANDER_PALETTE = { O: INK, N: INK, S: STRAW_PINK, l: LID, T: TEA, e: EMPTY_CUP, b: PEARL };
  /** Column ranges the cup breaks into on a crash. */
  const SLICES: Array<[number, number]> = [
    [0, 4],
    [4, 7],
    [7, 10],
    [10, 13],
  ];

  /** The cup with `level` (0–4) rows of tea left; it drains from the top. */
  function landerGrid(level: number) {
    return LANDER.map((row, index) => {
      const teaRow = TEA_ROWS.indexOf(index);
      if (teaRow < 0 || teaRow >= TEA_ROWS.length - level) return row;
      return row.replace(/T/g, "e");
    });
  }
  const LANDER_GRIDS = [0, 1, 2, 3, 4].map(landerGrid);

  function fuelLevel(fuel: number) {
    return Math.max(0, Math.min(4, Math.ceil((fuel / MAX_FUEL) * 4)));
  }

  // --- Types ---------------------------------------------------------------

  interface FlightPath {
    /** Flat [x, y, x, y, …] in world units. */
    points: number[];
    ticks: number[];
    crashed: boolean;
  }

  /**
   * One pooled particle. Dust clusters keep `y` as a height above the ground
   * at `x` (cached in `g`), so they roll along the surface; the rest use
   * world y.
   */
  interface Particle {
    kind: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    life: number;
    /** Where it started along x, for the dust's rolling shape. */
    ox: number;
    /** Ground height under a dust cluster. */
    g: number;
    seed: number;
    size: number;
  }

  interface Slice {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    spin: number;
    from: number;
    to: number;
    level: number;
    grounded: boolean;
  }

  interface Spilled {
    x: number;
    y: number;
    vx: number;
    vy: number;
  }

  interface Caption {
    id: number;
    kicker: string;
    line: string;
    kind: "intro" | "result" | "note";
  }

  // --- State -----------------------------------------------------------------

  let score = 0;
  let lives = START_LIVES;
  let livesPulse = 0;
  let landings = 0;
  let feathers = 0;
  let bestLanding = 0;
  let paused = false;
  let gameOver = false;
  let tipVisible = false;
  let liveMessage = "Tea minus starting";
  let localBest = 0;
  let newBest = false;
  let countdown = COUNTDOWN_SECONDS;
  let countdownElapsed = 0;
  let goVisible = false;
  let caption: Caption | null = null;
  let captionAge = 0;
  let captionCount = 0;

  // HUD readouts, refreshed about ten times a second rather than every frame.
  let siteN = 1;
  let siteName = "";
  let readAltitude = 0;
  let readDrift = 0;
  let readDriftSign = 0;
  let readDescent = 0;
  let readDescentSign = 0;
  let readWind = 0;
  let readWindSign = 0;
  let tooFast = false;
  let drifting = false;
  let fuelFraction = 1;
  let hudClock = 0;

  let canvas: HTMLCanvasElement;
  let playScope: HTMLElement;
  let playfield: HTMLElement;
  let hudRow: HTMLElement;
  let padsEl: HTMLElement | undefined;
  let ctx: CanvasRenderingContext2D | null = null;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;
  let popupFont = '500 13px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';
  let padFont = popupFont;
  let reduceMotion = false;
  let touchUI = false;
  let coarse = false;
  let touchSeen = false;

  // Layout, in CSS pixels unless named in units.
  let viewW = 0;
  let viewH = 0;
  let playTop = 80;
  let playBottom = 0;
  let pmid = 0;
  let viewUnits = 800;
  let viewHUnits = 400;
  let base = 1;
  let ceiling = 430;
  /** Pixels per world unit this frame (base × zoom). */
  let S = 1;

  let seedBase = 0;
  let site: Site = makeSite(1, 7919);
  let ship: Ship = newShip(site, 400);
  let mode: Mode = "countdown";
  let modeTime = 0;
  let flightTime = 0;
  let accumulator = 0;
  let clock = 0;
  let lastBeep = -10;
  let emptyNoted = false;
  let siteIntro = INTRO_FIRST;
  const cam = { x: 100, y: 200, z: 1 };

  // Copy rotates through each list in order from a random start per mission.
  let landingTurn = 0;
  let crashTurns: Record<CrashReason, number> = { fast: 0, hard: 0, tilt: 0, drift: 0, off: 0 };
  let laterTurn = 0;

  let path: FlightPath = { points: [], ticks: [], crashed: false };
  let ghosts: FlightPath[] = [];
  let pathClock = 0;
  let slices: Slice[] = [];
  let spilled: Spilled[] = [];
  let landedLoop: { index: number; age: number } | null = null;
  let popups: Popup[] = [];
  /** Landing notes waiting for their turn; stepped with play, so pause holds them. */
  let pendingPopups: Array<{ delay: number; x: number; y: number; text: string; kind: "perfect" | "plain" | "gold" }> = [];
  let shake = 0;

  const keys: Held = { left: false, right: false, thrust: false };
  let touchHeld: Held = { left: false, right: false, thrust: false };

  let last = 0;
  let raf = 0;
  let active = true;
  const timers = createTimers();

  // The sky is seeded once, so it never reshuffles between attempts.
  const skyRandom = createRng(2107);
  /** Kind 0 is one dim cell, 1 one bright cell, 2 a three-cell plus. */
  const STARS = Array.from({ length: 90 }, (_, index) => {
    const roll = skyRandom();
    return {
      x: skyRandom(),
      y: skyRandom(),
      kind: roll < 0.6 ? 0 : roll < 0.93 ? 1 : 2,
      twinkle: index % 7 === 3,
      speed: 0.45 + skyRandom() * 1.1,
      phase: skyRandom() * Math.PI * 2,
    };
  });
  const WIND_DASHES = Array.from({ length: 7 }, () => ({
    x: skyRandom(),
    y: 0.08 + skyRandom() * 0.5,
    length: 14 + skyRandom() * 22,
    speed: 0.7 + skyRandom() * 0.6,
  }));

  const pad2 = (value: number, width: number) => String(Math.round(value)).padStart(width, "0");
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  /** Snaps a screen coordinate to the scene cell. */
  const snap = (value: number) => Math.round(value / SC) * SC;
  /** A stable 0–1 value per integer, so seeded marks never shimmer. */
  const ihash = (n: number) => {
    let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const hash2 = (a: number, b: number) => ihash(Math.imul(a, 73856093) ^ Math.imul(b, 19349663));
  const smooth = (t: number) => t * t * (3 - 2 * t);
  /** Smooth value noise on an integer lattice. */
  function noise2(a: number, b: number) {
    const ia = Math.floor(a);
    const ib = Math.floor(b);
    const fa = smooth(a - ia);
    const fb = smooth(b - ib);
    const top = lerp(hash2(ia, ib), hash2(ia + 1, ib), fa);
    const bottom = lerp(hash2(ia, ib + 1), hash2(ia + 1, ib + 1), fa);
    return lerp(top, bottom, fb);
  }
  /** Periodic 1D value noise from a table: `u` in table cells, wrapping. */
  function tableNoise(table: number[], u: number) {
    const count = table.length;
    const i = Math.floor(u);
    const f = smooth(u - i);
    const a = table[((i % count) + count) % count];
    const b = table[(((i + 1) % count) + count) % count];
    return a + (b - a) * f;
  }
  const rgb = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const mixRgb = (a: number[], b: number[], t: number) => a.map((value, index) => Math.round(lerp(value, b[index], t)));
  const toHex = (color: number[]) => `#${color.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  function putPixel(data: Uint8ClampedArray, index: number, color: number[]) {
    data[index * 4] = color[0];
    data[index * 4 + 1] = color[1];
    data[index * 4 + 2] = color[2];
    data[index * 4 + 3] = 255;
  }

  const controls = () => ({
    left: keys.left || touchHeld.left,
    right: keys.right || touchHeld.right,
    thrust: keys.thrust || touchHeld.thrust,
  });

  // World to screen. World y points up; screen y points down.
  const sx = (x: number) => viewW / 2 + (x - cam.x) * S;
  const sy = (y: number) => pmid - (y - cam.y) * S;

  // --- Drawing: the sky -------------------------------------------------------

  // Every screen-space layer is painted at one pixel per scene cell into a
  // small canvas and scaled up without smoothing, so it is chunky by
  // construction and cheap to blit.
  let skyCanvas: HTMLCanvasElement | null = null;

  /** Flat bands from the top of the sky to the horizon, joined by dithering. */
  function buildSky() {
    const width = Math.max(1, Math.ceil(viewW / SC));
    const height = Math.max(1, Math.ceil(viewH / SC));
    skyCanvas ??= document.createElement("canvas");
    skyCanvas.width = width;
    skyCanvas.height = height;
    const context = skyCanvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(width, height);
    const top = rgb(NIGHT.top);
    const mid = rgb(NIGHT.mid);
    const low = rgb(NIGHT.horizon);
    const bands = [top, mixRgb(top, mid, 0.5), mid, mixRgb(mid, low, 0.5), low];
    const stops = [0, 0.2, 0.42, 0.62, 0.84].map((f) => (f * playBottom) / SC);
    for (let y = 0; y < height; y++) {
      let segment = 0;
      while (segment < stops.length - 2 && y >= stops[segment + 1]) segment++;
      const t = clamp((y - stops[segment]) / (stops[segment + 1] - stops[segment]), 0, 1);
      // Flat for most of the band, dithered across the middle of the join.
      const blend = clamp((t - 0.3) / 0.4, 0, 1);
      for (let x = 0; x < width; x++) {
        putPixel(image.data, y * width + x, bands[blend > bayer(x, y) ? segment + 1 : segment]);
      }
    }
    context.putImageData(image, 0, 0);
  }

  function drawStars() {
    if (!ctx) return;
    const columns = viewW / SC;
    const rows = (playBottom * 0.78) / SC;
    const twinkling = !reduceMotion;
    const at = (star: (typeof STARS)[number]) => {
      starX = Math.floor(star.x * columns) * SC;
      starY = Math.floor(star.y * rows) * SC;
    };
    ctx.fillStyle = CREAM;
    // Steady stars, batched by brightness.
    for (let kind = 0; kind < 3; kind++) {
      ctx.globalAlpha = kind === 0 ? 0.38 : 1;
      ctx.beginPath();
      for (const star of STARS) {
        if (star.kind !== kind || (twinkling && star.twinkle)) continue;
        at(star);
        ctx.rect(starX, starY, SC, SC);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    for (const star of STARS) {
      if (star.kind !== 2) continue;
      at(star);
      ctx.rect(starX - SC, starY, SC, SC);
      ctx.rect(starX + SC, starY, SC, SC);
      ctx.rect(starX, starY - SC, SC, SC);
      ctx.rect(starX, starY + SC, SC, SC);
    }
    ctx.fill();
    if (twinkling) {
      // A dozen breathe on their own slow sines, in a few printed steps.
      for (const star of STARS) {
        if (!star.twinkle) continue;
        at(star);
        const peak = star.kind === 0 ? 0.6 : 1;
        const level = 0.5 + 0.5 * Math.sin(clock * star.speed + star.phase);
        ctx.globalAlpha = Math.max(0.12, Math.round(level * 4) / 4) * peak;
        ctx.fillRect(starX, starY, SC, SC);
      }
    }
    ctx.globalAlpha = 1;
    drawMeteor();
  }
  let starX = 0;
  let starY = 0;

  // A shooting star every 9–16 seconds, somewhere in the upper sky.
  const meteor = { active: false, x: 0, y: 0, dir: 1, age: 0, wait: 6 };
  const METEOR_SECONDS = 0.6;
  const METEOR_SPEED = 75;

  function stepMeteor(dt: number) {
    if (reduceMotion) {
      meteor.active = false;
      return;
    }
    if (meteor.active) {
      meteor.age += dt;
      if (meteor.age >= METEOR_SECONDS) meteor.active = false;
      return;
    }
    meteor.wait -= dt;
    if (meteor.wait > 0) return;
    meteor.wait = 9 + Math.random() * 7;
    meteor.active = true;
    meteor.age = 0;
    meteor.dir = Math.random() < 0.5 ? -1 : 1;
    meteor.x = viewW * (0.2 + Math.random() * 0.6);
    meteor.y = playTop + (playBottom - playTop) * (0.04 + Math.random() * 0.26);
  }

  function drawMeteor() {
    if (!ctx || !meteor.active) return;
    const t = meteor.age / METEOR_SECONDS;
    // Down a 2:1 pixel slope, so the trail steps like a printed line.
    const travel = Math.floor(meteor.age * METEOR_SPEED);
    const fade = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
    const headX = snap(meteor.x) + meteor.dir * travel * SC;
    const headY = snap(meteor.y) + Math.floor(travel / 2) * SC;
    ctx.fillStyle = CREAM;
    const trail = 7;
    for (let k = trail; k >= 0; k--) {
      const step = travel - k;
      if (step < 0) continue;
      ctx.globalAlpha = fade * (k === 0 ? 1 : 0.75 * (1 - k / (trail + 1)));
      ctx.fillRect(headX - meteor.dir * k * SC, headY - (Math.floor(travel / 2) - Math.floor(step / 2)) * SC, SC, SC);
    }
    ctx.globalAlpha = fade * 0.5;
    ctx.fillRect(headX, headY - SC, SC, SC);
    ctx.fillRect(headX, headY + SC, SC, SC);
    ctx.fillRect(headX + meteor.dir * SC, headY, SC, SC);
    ctx.globalAlpha = 1;
  }

  // --- Drawing: the earth -----------------------------------------------------

  const EARTH_MAP_W = 96;
  const EARTH_MAP_H = 48;
  let earthLand: Uint8Array | null = null;
  let earthCloud: Uint8Array | null = null;
  let earthCanvas: HTMLCanvasElement | null = null;
  let earthImage: ImageData | null = null;
  let earthR = 12;
  let earthDirty = true;
  let earthDrawnAt = -1;
  let earthTurn = 0.62;
  const EARTH_TURN_SECONDS = 90;
  /** Sunlight from the upper right and a little in front. */
  const SUN = (() => {
    const [x, y, z] = [0.68, -0.52, 0.5];
    const length = Math.hypot(x, y, z);
    return { x: x / length, y: y / length, z: z / length };
  })();

  /** Continents and cloud from seeded value noise, wrapped around in longitude. */
  function buildEarthMaps() {
    const random = createRng(1969);
    const table = (columns: number, rows: number) =>
      Array.from({ length: rows }, () => Array.from({ length: columns }, () => random()));
    const sample = (grid: number[][], u: number, v: number) => {
      const columns = grid[0].length;
      const rows = grid.length;
      const x = u * columns;
      const y = v * (rows - 1);
      const ix = Math.floor(x);
      const iy = Math.min(rows - 2, Math.floor(y));
      const fx = smooth(x - ix);
      const fy = smooth(y - iy);
      const a = grid[iy][ix % columns];
      const b = grid[iy][(ix + 1) % columns];
      const c = grid[iy + 1][ix % columns];
      const d = grid[iy + 1][(ix + 1) % columns];
      return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
    };
    const coarse = table(7, 5);
    const fine = table(15, 9);
    const wisps = table(13, 11);
    const streaks = table(5, 13);
    earthLand = new Uint8Array(EARTH_MAP_W * EARTH_MAP_H);
    earthCloud = new Uint8Array(EARTH_MAP_W * EARTH_MAP_H);
    for (let y = 0; y < EARTH_MAP_H; y++) {
      const v = (y + 0.5) / EARTH_MAP_H;
      for (let x = 0; x < EARTH_MAP_W; x++) {
        const u = (x + 0.5) / EARTH_MAP_W;
        const index = y * EARTH_MAP_W + x;
        const land = 0.66 * sample(coarse, u, v) + 0.34 * sample(fine, u, v);
        earthLand[index] = land > 0.56 ? 1 : 0;
        // Ice caps, ragged at the edge.
        const polar = Math.abs(v - 0.5) * 2;
        const cloud = sample(wisps, u, v) * 0.6 + sample(streaks, u, v) * 0.4;
        earthCloud[index] = polar > 0.86 + sample(fine, u, 0.5) * 0.08 || cloud > 0.66 ? 1 : 0;
      }
    }
  }

  /** Paints the globe, one pixel per cell, turned `turn` of the way round. */
  function renderEarth(turn: number) {
    if (!earthLand || !earthCloud) buildEarthMaps();
    if (!earthLand || !earthCloud) return;
    const size = earthR * 2;
    if (!earthCanvas || earthCanvas.width !== size) {
      earthCanvas ??= document.createElement("canvas");
      earthCanvas.width = size;
      earthCanvas.height = size;
      earthImage = null;
    }
    const context = earthCanvas.getContext("2d");
    if (!context) return;
    earthImage ??= context.createImageData(size, size);
    const data = earthImage.data;
    data.fill(0);
    for (let py = 0; py < size; py++) {
      const ny = (py + 0.5 - earthR) / earthR;
      for (let px = 0; px < size; px++) {
        const nx = (px + 0.5 - earthR) / earthR;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        const longitude = Math.atan2(nx, nz) / (Math.PI * 2);
        const v = Math.asin(ny) / Math.PI + 0.5;
        const ty = Math.min(EARTH_MAP_H - 1, Math.floor(v * EARTH_MAP_H));
        const land = earthLand[ty * EARTH_MAP_W + Math.floor((((longitude + turn) % 1) + 1) % 1 * EARTH_MAP_W) % EARTH_MAP_W];
        const cloud =
          earthCloud[ty * EARTH_MAP_W + Math.floor((((longitude + turn * 1.15 + 0.3) % 1) + 1) % 1 * EARTH_MAP_W) % EARTH_MAP_W];
        const lit = nx * SUN.x + ny * SUN.y + nz * SUN.z;
        const index = py * size + px;
        // The night side, with a dithered terminator.
        if (lit < (bayer(px, py) - 0.5) * 0.34 - 0.02) {
          putPixel(data, index, EARTH_RGB.night);
          continue;
        }
        // A lighter limb along the sunlit edge.
        const rim = r2 > 0.6 && (nx * SUN.x + ny * SUN.y) / Math.sqrt(r2) > 0.3 && lit > 0.25;
        if (cloud) putPixel(data, index, EARTH_RGB.cloud);
        else if (land) putPixel(data, index, rim ? EARTH_RGB.landLight : EARTH_RGB.land);
        else putPixel(data, index, rim ? EARTH_RGB.oceanLight : EARTH_RGB.ocean);
      }
    }
    context.putImageData(earthImage, 0, 0);
  }
  const EARTH_RGB = {
    ocean: rgb(EARTH.ocean),
    oceanLight: rgb(EARTH.oceanLight),
    land: rgb(EARTH.land),
    landLight: rgb(EARTH.landLight),
    cloud: rgb(EARTH.cloud),
    night: rgb(EARTH.night),
  };

  /** The earth in the upper right, below the end ticket, drifting a hair against the camera. */
  function drawEarth() {
    if (!ctx) return;
    // A few redraws a second turn it a full circle every 90 seconds.
    if (!reduceMotion && clock - earthDrawnAt >= 0.25) {
      earthTurn = (0.62 + clock / EARTH_TURN_SECONDS) % 1;
      earthDirty = true;
    }
    if (earthDirty) {
      renderEarth(earthTurn);
      earthDirty = false;
      earthDrawnAt = clock;
    }
    if (!earthCanvas) return;
    const r = earthR * SC;
    // Every ship starts at x = 100, so measure from there; tanh keeps it bounded.
    const drift = -16 * Math.tanh((cam.x - 100) / 700);
    const x = snap(viewW - r - Math.max(28, viewW * 0.06) + drift);
    const y = snap(playTop + r + 20);
    ctx.drawImage(earthCanvas, x - r, y - r, r * 2, r * 2);
  }

  // --- Drawing: the mountain ranges -------------------------------------------

  interface Range {
    /** Share of the camera's travel. */
    factor: number;
    /** Cells before the ridge repeats. */
    period: number;
    /** Mean ridge height above the resting horizon, and its swing, as shares of the range scale. */
    rise: number;
    swing: number;
    fill: string;
    rim: string;
    seed: number;
    canvas: HTMLCanvasElement | null;
  }
  const RANGES: Range[] = [
    {
      factor: 0.25,
      period: 360,
      rise: 0.36,
      swing: 0.15,
      fill: RANGE.far,
      rim: toHex(mixRgb(rgb(RANGE.far), rgb(RANGE.rim), 0.6)),
      seed: 31,
      canvas: null,
    },
    { factor: 0.5, period: 300, rise: 0.18, swing: 0.1, fill: RANGE.near, rim: RANGE.rim, seed: 47, canvas: null },
  ];

  /** A periodic, pixel-stepped silhouette with a one-cell rim of light. */
  function buildRange(range: Range) {
    const random = createRng(range.seed);
    const octaves = [
      { table: Array.from({ length: 4 }, random), weight: 0.42, ridged: false },
      { table: Array.from({ length: 9 }, random), weight: 0.3, ridged: true },
      { table: Array.from({ length: 20 }, random), weight: 0.18, ridged: true },
      { table: Array.from({ length: 50 }, random), weight: 0.1, ridged: false },
    ];
    const height = Math.ceil(viewH / SC) + 80;
    // Anchored to where the ground sits at rest (world height 90, unzoomed),
    // and sized by the narrower of the play area and the width, so a phone
    // keeps its ranges near the horizon.
    const horizon = pmid - (90 - (viewHUnits / 2 - 6)) * base;
    const scale = Math.min(playBottom - playTop, viewW * 0.75);
    const tops = new Int32Array(range.period);
    for (let c = 0; c < range.period; c++) {
      let n = 0;
      for (const octave of octaves) {
        const value = tableNoise(octave.table, (c / range.period) * octave.table.length);
        n += octave.weight * (octave.ridged ? 1 - Math.abs(value * 2 - 1) : value);
      }
      const y = horizon - scale * (range.rise + (n - 0.5) * 2 * range.swing);
      tops[c] = clamp(Math.round(y / SC), 1, height - 1);
    }
    range.canvas ??= document.createElement("canvas");
    range.canvas.width = range.period;
    range.canvas.height = height;
    const context = range.canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, range.period, height);
    context.fillStyle = range.fill;
    for (let c = 0; c < range.period; c++) context.fillRect(c, tops[c], 1, height - tops[c]);
    // The rim runs down any step to meet its lower neighbour's top, so the
    // line never breaks.
    context.fillStyle = range.rim;
    for (let c = 0; c < range.period; c++) {
      const left = tops[(c - 1 + range.period) % range.period];
      const right = tops[(c + 1) % range.period];
      const end = Math.max(tops[c], Math.max(left, right) - 1);
      context.fillRect(c, tops[c], 1, end - tops[c] + 1);
    }
  }

  function drawRanges() {
    if (!ctx) return;
    const playH = playBottom - playTop;
    const restY = viewHUnits / 2 - 6;
    for (const range of RANGES) {
      if (!range.canvas) continue;
      const width = range.period * SC;
      const offset = snap((cam.x - 100) * range.factor * base);
      const shift = snap(clamp((cam.y - restY) * base * range.factor, -0.25 * playH, 0.25 * playH));
      let x = -((offset % width) + width) % width;
      for (; x < viewW; x += width) {
        ctx.drawImage(range.canvas, x, shift, width, range.canvas.height * SC);
      }
    }
  }

  /** Cream streaks blowing across the sky, from site 2 on. */
  function drawWind() {
    if (!ctx || !site.wind || reduceMotion) return;
    const direction = Math.sign(windAt(site, flightTime)) || 1;
    ctx.fillStyle = CREAM;
    for (const dash of WIND_DASHES) {
      const cells = Math.max(2, Math.round(dash.length / SC));
      const x = snap(dash.x * (viewW + 80) - 40);
      const y = snap(playTop + dash.y * (playBottom - playTop));
      for (let k = 0; k < cells; k++) {
        ctx.globalAlpha = k === 0 ? 0.34 : 0.22 * (1 - k / cells) + 0.05;
        ctx.fillRect(x - direction * k * SC, y, SC, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  // --- Drawing: flight paths -------------------------------------------------

  /** Chalk on the night: cream dashes, a tick per second, a cross for a crash. */
  function drawPath(flight: FlightPath, alpha: number) {
    if (!ctx || flight.points.length < 2) return;
    const points = flight.points;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = CREAM;
    ctx.fillStyle = CREAM;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(sx(points[0]), sy(points[1]));
    for (let index = 2; index < points.length; index += 2) ctx.lineTo(sx(points[index]), sy(points[index + 1]));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    for (let index = 0; index < flight.ticks.length; index += 2) {
      ctx.rect(Math.round(sx(flight.ticks[index])) - 2, Math.round(sy(flight.ticks[index + 1])) - 2, 4, 4);
    }
    ctx.fill();
    if (flight.crashed) {
      // The flight ends in a chalk cross, backed in night so it reads on the ground too.
      const x = sx(points[points.length - 2]);
      const y = sy(points[points.length - 1]);
      ctx.lineCap = "square";
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 5);
      ctx.lineTo(x + 5, y + 5);
      ctx.moveTo(x + 5, y - 5);
      ctx.lineTo(x - 5, y + 5);
      ctx.strokeStyle = NIGHT.top;
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Drawing: the ground --------------------------------------------------

  /** Which coaster, if any, covers world x (on any repeat of the terrain). */
  function onPad(x: number, margin: number) {
    for (const pad of site.pads) {
      const offset = x - pad.cx - Math.round((x - pad.cx) / PERIOD) * PERIOD;
      if (Math.abs(offset) <= pad.width / 2 + margin) return true;
    }
    return false;
  }

  // The ground's depth shading, craters and specks are baked once per site
  // into a strip one pixel per world cell, covering one period of terrain, and
  // drawn scaled under a clip of the surface. Everything is seeded by world
  // position, so it never shimmers and it scrolls and zooms with the world.
  const STRIP_TOP = 220;
  const STRIP_BOTTOM = -220;
  const STRIP_COLUMNS = PERIOD / CELL;
  const STRIP_ROWS = (STRIP_TOP - STRIP_BOTTOM) / CELL;
  const REGOLITH_RGB = REGOLITH.map(rgb);
  let groundStrip: HTMLCanvasElement | null = null;
  let stripSite: Site | null = null;
  let siteSeed = 0;
  let rocks: Array<{ x: number; w: number; h: number }> = [];

  /** Tone level 0 (lit) to 3 (deep) for a depth below the surface; fractions dither. */
  function depthLevel(depth: number) {
    if (depth < 7) return 0;
    if (depth < 15) return (depth - 7) / 8;
    if (depth < 26) return 1;
    if (depth < 40) return 1 + (depth - 26) / 14;
    if (depth < 60) return 2;
    if (depth < 84) return 2 + (depth - 60) / 24;
    return 3;
  }

  function bakeGround() {
    stripSite = site;
    const random = createRng(siteSeed ^ 0x5eed);
    groundStrip ??= document.createElement("canvas");
    groundStrip.width = STRIP_COLUMNS;
    groundStrip.height = STRIP_ROWS;
    const context = groundStrip.getContext("2d");
    if (!context) return;
    const tones = new Int8Array(STRIP_COLUMNS * STRIP_ROWS).fill(-1);
    const wobble = Array.from({ length: 30 }, random);
    for (let c = 0; c < STRIP_COLUMNS; c++) {
      const x = c * CELL + 1;
      const ground = groundAt(site, x);
      const shift = (tableNoise(wobble, (x / PERIOD) * wobble.length) - 0.5) * 12;
      for (let r = 0; r < STRIP_ROWS; r++) {
        const depth = ground - (STRIP_TOP - r * CELL - 1);
        if (depth < 0) continue;
        const level = depthLevel(depth + (depth > 6 ? shift : 0));
        const floor = Math.floor(level);
        let tone = Math.min(3, floor + (level - floor > bayer(c, r) ? 1 : 0));
        if (depth > 10) {
          const speck = ihash(c * 7919 + r * 104729 + siteSeed);
          if (speck < 0.014) tone = Math.max(0, tone - 1);
          else if (speck > 0.993) tone = Math.min(4, tone + 1);
        }
        tones[r * STRIP_COLUMNS + c] = tone;
      }
    }
    // Craters: a darker bowl, shadowed under its upper rim, with a light lower lip.
    for (let index = 0; index < 26; index++) {
      const cx = random() * PERIOD;
      const width = 10 + random() * 20;
      const below = 8 + random() * 52;
      const rx = width / 2;
      const ry = Math.max(2.6, width * 0.24);
      const cy = groundAt(site, cx) - below - ry;
      const c0 = Math.floor((cx - rx * 1.3) / CELL);
      const c1 = Math.ceil((cx + rx * 1.3) / CELL);
      const r0 = Math.max(0, Math.floor((STRIP_TOP - (cy + ry * 1.8)) / CELL));
      const r1 = Math.min(STRIP_ROWS - 1, Math.ceil((STRIP_TOP - (cy - ry * 1.8)) / CELL));
      for (let cc = c0; cc <= c1; cc++) {
        const c = ((cc % STRIP_COLUMNS) + STRIP_COLUMNS) % STRIP_COLUMNS;
        const dx = (cc * CELL + 1 - cx) / rx;
        for (let r = r0; r <= r1; r++) {
          const at = r * STRIP_COLUMNS + c;
          const tone = tones[at];
          if (tone < 0) continue;
          const dy = (STRIP_TOP - r * CELL - 1 - cy) / ry;
          const d = dx * dx + dy * dy;
          if (d < 1) tones[at] = Math.min(4, tone + (dy > 0.15 && d > 0.4 ? 2 : 1));
          else if (d < 1.75 && dy < -0.3) tones[at] = Math.max(0, tone - 1);
        }
      }
    }
    const image = context.createImageData(STRIP_COLUMNS, STRIP_ROWS);
    for (let index = 0; index < tones.length; index++) {
      if (tones[index] >= 0) putPixel(image.data, index, REGOLITH_RGB[tones[index]]);
    }
    context.putImageData(image, 0, 0);

    // Pixel rocks wherever the surface is flat enough to hold one.
    rocks = [];
    for (let index = 0; index < 40; index++) {
      const x = Math.floor((random() * PERIOD) / CELL) * CELL;
      const w = 1 + Math.floor(random() * 3);
      const h = random() < 0.45 ? 2 : 1;
      if (onPad(x, 10)) continue;
      const slope = Math.abs(groundAt(site, x + w * CELL + 2) - groundAt(site, x - 2)) / (w * CELL + 4);
      if (slope > 0.2) continue;
      rocks.push({ x, w, h });
    }
  }

  const groundPoints: number[] = [];

  function traceGround(dx: number, dy: number) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(groundPoints[0] + dx, groundPoints[1] + dy);
    for (let index = 2; index < groundPoints.length; index += 2) {
      ctx.lineTo(groundPoints[index] + dx, groundPoints[index + 1] + dy);
    }
  }

  function drawGround() {
    if (!ctx) return;
    if (stripSite !== site) bakeGround();
    const half = viewW / 2 / S;
    const left = cam.x - half - 120;
    const right = cam.x + half + 120;
    groundPoints.length = 0;
    for (let k = Math.floor(left / PERIOD); k <= Math.floor(right / PERIOD); k++) {
      for (const [px, py] of site.points) {
        const x = px + k * PERIOD;
        if (x < left || x > right) continue;
        groundPoints.push(sx(x), sy(py));
      }
    }
    if (groundPoints.length < 4) return;
    const bottom = viewH + 40;

    ctx.save();
    // Lit regolith, opaque, so it hides the sky behind it.
    traceGround(0, 0);
    ctx.lineTo(groundPoints[groundPoints.length - 2], bottom);
    ctx.lineTo(groundPoints[0], bottom);
    ctx.closePath();
    ctx.fillStyle = REGOLITH[0];
    ctx.fill();
    ctx.clip();
    if (groundStrip) {
      const top = sy(STRIP_TOP);
      const height = STRIP_ROWS * CELL * S;
      for (let k = Math.floor(left / PERIOD); k <= Math.floor(right / PERIOD); k++) {
        const origin = k * PERIOD;
        const c0 = Math.max(0, Math.floor((left - origin) / CELL));
        const c1 = Math.min(STRIP_COLUMNS, Math.ceil((right - origin) / CELL));
        if (c1 <= c0) continue;
        // Whole-pixel edges, so neighbouring copies meet without a seam.
        const x0 = Math.floor(sx(origin + c0 * CELL));
        const x1 = Math.ceil(sx(origin + c1 * CELL));
        ctx.drawImage(groundStrip, c0, 0, c1 - c0, STRIP_ROWS, x0, top, x1 - x0, height);
      }
      const under = sy(STRIP_BOTTOM);
      if (under < viewH) {
        ctx.fillStyle = REGOLITH[3];
        ctx.fillRect(0, under - 1, viewW, viewH - under + 41);
      }
    }
    ctx.restore();

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.25;
    // The accent plate, printed off register, then the ink line on top.
    traceGround(3, 3);
    ctx.strokeStyle = ACCENT;
    ctx.stroke();
    traceGround(0, 0);
    ctx.strokeStyle = SCENE_INK;
    ctx.stroke();
    ctx.restore();
    drawRocks();
  }

  /** Small pixel rocks on the surface, lit from the right, each with a shadow cell. */
  function drawRocks() {
    if (!ctx || !rocks.length) return;
    const cs = CELL * S;
    const half = viewW / 2 / S + 20;
    for (let k = Math.floor((cam.x - half) / PERIOD); k <= Math.floor((cam.x + half) / PERIOD); k++) {
      for (const rock of rocks) {
        const x = rock.x + k * PERIOD;
        if (x < cam.x - half || x > cam.x + half) continue;
        const baseY = sy(groundAt(site, x + rock.w)) + 1;
        const left = sx(x);
        ctx.fillStyle = REGOLITH[3];
        const shadowX = Math.round(left - cs);
        ctx.fillRect(shadowX, Math.round(baseY - cs * 0.5), Math.round(left) - shadowX, Math.max(1, Math.round(cs * 0.5)));
        for (let b = 0; b < rock.h; b++) {
          for (let a = 0; a < rock.w; a++) {
            if (b > 0 && a === 0 && rock.w > 1) continue;
            const top = b === rock.h - 1;
            ctx.fillStyle = top && a === rock.w - 1 ? REGOLITH[0] : a === 0 || b === 0 ? REGOLITH[2] : REGOLITH[1];
            const x0 = Math.round(left + a * cs);
            const y0 = Math.round(baseY - (b + 1) * cs);
            ctx.fillRect(x0, y0, Math.round(left + (a + 1) * cs) - x0, Math.round(baseY - b * cs) - y0);
          }
        }
      }
    }
  }

  /** Coasters: small riso sheets lying on the ground, with a wind pennant. */
  function drawCoasters() {
    if (!ctx) return;
    const half = viewW / 2 / S + 60;
    const wind = windAt(site, flightTime);
    const stream = Math.min(1, Math.abs(wind) / 4);
    const direction = Math.sign(wind) || 1;
    ctx.save();
    ctx.font = padFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let k = Math.floor((cam.x - half) / PERIOD); k <= Math.floor((cam.x + half) / PERIOD); k++) {
      for (const pad of site.pads) drawCoaster(pad, pad.cx + k * PERIOD, stream, direction);
    }
    ctx.restore();
  }

  function drawCoaster(pad: Pad, cx: number, stream: number, direction: number) {
    if (!ctx) return;
    const left = sx(cx - pad.width / 2);
    const right = sx(cx + pad.width / 2);
    if (right < -40 || left > viewW + 40) return;
    const top = sy(pad.y);
    const width = right - left;
    const thick = 5;
    ctx.fillStyle = ACCENT;
    ctx.fillRect(left + 3, top + 3, width, thick);
    ctx.fillStyle = COASTER_PAPER;
    ctx.fillRect(left, top, width, thick);
    ctx.strokeStyle = SCENE_INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, width, thick);

    // The label sits on the lit ground, so ink reads in either site theme.
    ctx.fillStyle = pad.multiplier === 5 ? LABEL_GOLD : SCENE_INK;
    ctx.fillText(`×${pad.multiplier}`, (left + right) / 2, top + thick + 7);

    // A post just outside the coaster's left end, carrying a pennant that
    // hangs limp in still air and streams downwind.
    const postX = cx - pad.width / 2 - 2.5;
    const foot = groundAt(site, postX);
    const x = sx(postX);
    const footY = sy(foot);
    const head = sy(foot + 14);
    ctx.strokeStyle = SCENE_INK;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, footY);
    ctx.lineTo(x, head);
    ctx.stroke();

    const flutter = reduceMotion ? 0 : Math.sin(clock * 7 + cx * 0.05) * 0.1 * stream;
    // 0 hangs straight down the post; π/2 is straight out to the side.
    const angle = stream * (Math.PI / 2 - 0.12) + flutter;
    const length = (5 + stream * 5) * S;
    const tipX = x + direction * Math.sin(angle) * length;
    const tipY = head + Math.cos(angle) * length;
    const hoist = 4 * S;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.moveTo(x, head);
    ctx.lineTo(tipX, tipY + (hoist / 2) * Math.sin(angle));
    ctx.lineTo(x, head + hoist);
    ctx.closePath();
    ctx.fill();
  }

  // --- Fire ----------------------------------------------------------------------

  // The flame lives on the sprite's own cell grid in the lander's frame:
  // row 0 is the cell just under the nozzle (local y -6 to -8), column 0 is
  // the nozzle's column.
  let flameLen = 0;
  /** How far the plume reached the last time it burned, so a cut-off flame stays above ground. */
  let flameReach = 999;
  let burning = false;
  let popAge = 1;
  let emberClock = 0;
  let smokeClock = 0;
  let dustClock = 0;
  /** Seconds left of the crash's firelight flash, and where it is. */
  let flash = 0;
  const flashAt = { x: 0, y: 0 };
  const FLASH_SECONDS = 0.4;
  const flameGrid = new Int8Array(FLAME_ROWS * FLAME_COLUMNS);
  // Local to world, written into these to keep the hot paths allocation-free.
  let worldX = 0;
  let worldY = 0;

  function toWorld(lx: number, ly: number) {
    const cos = Math.cos(ship.angle);
    const sin = Math.sin(ship.angle);
    worldX = ship.x + lx * cos + ly * sin;
    worldY = ship.y - lx * sin + ly * cos;
  }

  /** How many cells of flame show, clipped where the plume meets the ground. */
  function shownFlame() {
    return Math.min(flameLen, Math.max(0.5, flameReach / CELL));
  }

  const thrustHeld = () => keys.thrust || touchHeld.thrust;

  /** Flame length, ignition and cut-off, embers and smoke, once a frame. */
  function stepFire(dt: number) {
    const now = ship.state === "flying" && thrustHeld() && ship.fuel > 0 && ship.throttle > 0.03;
    if (now && !burning) popAge = 0;
    if (!now && burning && ship.state !== "crashed" && !reduceMotion) {
      // Cut-off: a couple of smoke cells where the tip was.
      for (let index = 0; index < 3; index++) spawnSmoke(0.6);
    }
    burning = now;
    popAge += dt;
    if (burning) {
      flameLen = ship.throttle * FLAME_FULL;
      flameReach = ship.plumeReach;
    } else {
      flameLen = Math.max(0, flameLen - FLAME_RETRACT * dt);
    }
    if (!burning || reduceMotion) return;
    emberClock += dt * ship.throttle * 26;
    while (emberClock >= 1) {
      emberClock -= 1;
      spawnEmber();
    }
    if (ship.throttle < 0.65) {
      smokeClock += dt * (0.65 - ship.throttle) * 16;
      while (smokeClock >= 1) {
        smokeClock -= 1;
        spawnSmoke(1);
      }
    }
  }

  function spawnEmber() {
    const tip = shownFlame() * CELL;
    toWorld((Math.random() - 0.5) * 2.4, -6 - tip);
    const sin = Math.sin(ship.angle);
    const cos = Math.cos(ship.angle);
    const speed = 42 + Math.random() * 38;
    const spread = (Math.random() - 0.5) * 0.55;
    spawn(
      P_EMBER,
      worldX,
      worldY,
      -sin * speed + cos * speed * spread + ship.vx,
      -cos * speed - sin * speed * spread + ship.vy,
      0.32 + Math.random() * 0.14,
    );
  }

  function spawnSmoke(push: number) {
    const tip = shownFlame() * CELL;
    toWorld((Math.random() - 0.5) * 4, -6 - tip);
    const sin = Math.sin(ship.angle);
    const cos = Math.cos(ship.angle);
    const speed = (6 + Math.random() * 10) * push;
    spawn(
      P_SMOKE,
      worldX,
      worldY,
      -sin * speed + (Math.random() - 0.5) * 6 + ship.vx * 0.5,
      -cos * speed + (Math.random() - 0.5) * 4 + ship.vy * 0.5,
      0.8 + Math.random() * 0.5,
    );
  }

  /** Heat at a flame cell, from distance down the plume and off its centre. */
  function drawFlame() {
    if (!ctx) return;
    const popping = popAge < POP_SECONDS && burning;
    if (flameLen <= 0.05 && !popping) return;
    const shown = shownFlame();
    const reachCells = flameReach / CELL;
    const clipped = flameLen > reachCells - 0.5;
    const still = reduceMotion;
    const rows = Math.min(FLAME_ROWS, Math.ceil(shown) + (still ? 0 : 2));
    // The noise field streams away from the nozzle at 40 cells a second.
    const scroll = still ? 0 : clock * 40;
    flameGrid.fill(-1);
    for (let i = 0; i < rows; i++) {
      if (i + 0.4 > reachCells) break;
      const u = i / Math.max(shown, 1);
      let half = 1.5 - u;
      // Flattened against the ground, the last rows spread sideways.
      if (clipped && i >= reachCells - 1.6) half += 1.3;
      for (let j = -3; j <= 3; j++) {
        const a = Math.abs(j);
        const n = still ? 0.5 : noise2((i - scroll) * 0.8, j * 0.9 + 11.3);
        // Tongues lick out sideways in the middle of the plume.
        const tongue = !still && n > 0.72 && u > 0.15 && u < 0.85 ? (n - 0.72) * 3.2 : 0;
        const edge = half + (n - 0.5) * 1.15 + tongue;
        if (a >= edge) continue;
        let heat = 1 - 0.78 * u - (0.3 * a) / Math.max(1, edge) + (n - 0.5) * 0.3;
        if (edge - a < 0.55) heat -= 0.2;
        flameGrid[i * FLAME_COLUMNS + j + 3] = heat > 0.74 ? 0 : heat > 0.56 ? 1 : heat > 0.4 ? 2 : heat > 0.24 ? 3 : 4;
      }
    }
    if (popping) {
      // Ignition: one or two frames of white-hot cells at the nozzle.
      for (let i = 0; i < 2; i++) {
        for (let j = -2 + i; j <= 2 - i; j++) flameGrid[i * FLAME_COLUMNS + j + 3] = 0;
      }
    }
    for (let color = 0; color < FLAME.length; color++) {
      ctx.fillStyle = FLAME[color];
      ctx.beginPath();
      for (let index = 0; index < flameGrid.length; index++) {
        if (flameGrid[index] !== color) continue;
        const i = Math.floor(index / FLAME_COLUMNS);
        const j = (index % FLAME_COLUMNS) - 3;
        const x0 = Math.round((j * CELL - 1) * S);
        const x1 = Math.round((j * CELL + 1) * S);
        const y0 = Math.round((6 + i * CELL) * S);
        const y1 = Math.round((6 + (i + 1) * CELL) * S);
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
      }
      ctx.fill();
    }
  }

  // The one soft-edged effect: a warm radial wash, added light.
  let glowSprite: HTMLCanvasElement | null = null;
  function glow() {
    if (!glowSprite) {
      glowSprite = document.createElement("canvas");
      glowSprite.width = glowSprite.height = 64;
      const context = glowSprite.getContext("2d");
      if (context) {
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, "rgba(255, 209, 102, 0.9)");
        gradient.addColorStop(0.4, "rgba(232, 93, 76, 0.42)");
        gradient.addColorStop(1, "rgba(138, 50, 81, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
      }
    }
    return glowSprite;
  }

  function drawGlow(x: number, y: number, rx: number, ry: number, alpha: number) {
    if (!ctx || alpha <= 0.005) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(glow(), x - rx, y - ry, rx * 2, ry * 2);
    ctx.restore();
  }

  const flicker = () =>
    reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(clock * 29) * Math.sin(clock * 11.3 + 1.7);

  /** Firelight on the ground under a burn, stronger the lower and harder you burn. */
  function drawGroundLight() {
    if (ship.state === "crashed" || flameLen <= 0.05 || flameReach >= 95) return;
    const strength = (flameLen / FLAME_FULL) * (1 - flameReach / 95);
    const sin = Math.sin(ship.angle);
    const x = ship.x - sin * (6 + flameReach);
    const y = groundAt(site, x);
    const r = (30 + 26 * strength) * S;
    drawGlow(sx(x), sy(y), r, r * 0.6, strength * 0.42 * flicker());
  }

  function drawFlash() {
    if (flash <= 0) return;
    const t = flash / FLASH_SECONDS;
    const r = 72 * S;
    drawGlow(sx(flashAt.x), sy(flashAt.y), r, r * 0.75, 0.75 * t * t);
  }

  // --- Particles -----------------------------------------------------------------

  const P_EMBER = 0;
  const P_SMOKE = 1;
  const P_DUST = 2;
  const P_FIRE = 3;
  const P_TEA = 4;
  const pool: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    kind: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 1,
    ox: 0,
    g: 0,
    seed: 0,
    size: 1,
  }));
  let live = 0;

  function spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size = 1) {
    if (live >= MAX_PARTICLES) return null;
    const p = pool[live++];
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.age = 0;
    p.life = life;
    p.ox = x;
    p.g = kind === P_DUST ? groundAt(site, x) : 0;
    p.seed = Math.floor(Math.random() * 4);
    p.size = size;
    return p;
  }

  /**
   * A cluster of regolith cells rolling along the surface away from `x`.
   * Reduced motion leaves a brief still puff instead.
   */
  function spawnDust(x: number, side: number, speed: number, rise: number, life: number) {
    if (reduceMotion) spawn(P_DUST, x, 0.5, 0, 0, 0.35);
    else spawn(P_DUST, x, 0.5, side * speed, rise, life);
  }

  function stepParticles(dt: number) {
    for (let index = live - 1; index >= 0; index--) {
      const p = pool[index];
      p.age += dt;
      let dead = p.age >= p.life;
      if (!dead) {
        switch (p.kind) {
          case P_EMBER: {
            p.vy -= GRAVITY * 0.35 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            const ground = groundAt(site, p.x);
            if (p.y < ground) {
              // Sparks skitter off the ground rather than vanish into it.
              p.y = ground + 0.5;
              p.vy = Math.abs(p.vy) * 0.22;
              p.vx = (p.vx >= 0 ? 1 : -1) * Math.max(Math.abs(p.vx) * 0.7, 20);
            }
            break;
          }
          case P_SMOKE:
            p.vx *= Math.max(0, 1 - 1.4 * dt);
            p.vy = p.vy * Math.max(0, 1 - 1.4 * dt) + 4 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            break;
          case P_DUST:
            p.x += p.vx * dt;
            p.vx *= Math.max(0, 1 - 1.9 * dt);
            p.y += p.vy * dt;
            p.vy *= Math.max(0, 1 - 1.6 * dt);
            p.g = groundAt(site, p.x);
            break;
          case P_FIRE: {
            p.vx *= Math.max(0, 1 - 3 * dt);
            p.vy *= Math.max(0, 1 - 3 * dt);
            if (p.age / p.life > 0.55) p.vy += 9 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            break;
          }
          default:
            p.vy -= GRAVITY * 1.6 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            dead = p.y < groundAt(site, p.x);
        }
      }
      if (dead) {
        pool[index] = pool[live - 1];
        pool[live - 1] = p;
        live--;
      }
    }
  }

  /** Rolling shapes for dust clusters, as [x, y] cell offsets; y points up. */
  const PUFFS = [
    [0, 0, 1, 0, -1, 0, 0, 1],
    [0, 0, 1, 0, 0, 1, 1, 1, -1, 0],
    [0, 0, -1, 0, 0, 1, -1, 1],
    [0, 0, 1, 0, -1, 0, 0, 1, -1, 1],
  ];

  /** Fireball cells by age: core, yellow, gold, red, tail, then smoke. */
  function fireColor(t: number) {
    return t < 0.14 ? 0 : t < 0.3 ? 1 : t < 0.44 ? 2 : t < 0.58 ? 3 : t < 0.68 ? 4 : 5;
  }

  /** Back particles (dust, smoke, embers, tea) under the cup; the fireball in front. */
  function drawParticles(front: boolean) {
    if (!ctx || !live) return;
    const cs = Math.max(1.5, CELL * S);
    for (let index = 0; index < live; index++) {
      const p = pool[index];
      if ((p.kind === P_FIRE) !== front) continue;
      const t = p.age / p.life;
      const x = sx(p.x);
      if (x < -40 || x > viewW + 40) continue;
      switch (p.kind) {
        case P_EMBER:
          ctx.globalAlpha = 1;
          ctx.fillStyle = FLAME[t < 0.34 ? 2 : t < 0.68 ? 3 : 4];
          ctx.fillRect(Math.round(x - cs / 2), Math.round(sy(p.y) - cs / 2), Math.round(cs), Math.round(cs));
          break;
        case P_SMOKE: {
          const size = Math.round(cs * (t > 0.5 ? 2 : 1));
          ctx.globalAlpha = Math.ceil((1 - t) * 4) / 4 * 0.55;
          ctx.fillStyle = SMOKE;
          ctx.fillRect(Math.round(x - size / 2), Math.round(sy(p.y) - size / 2), size, size);
          break;
        }
        case P_DUST: {
          // It rolls: the cluster's shape turns over as it travels.
          const shape = PUFFS[(p.seed + Math.floor(Math.abs(p.x - p.ox) / 3)) & 3];
          const spread = cs * (1 + t * 0.7);
          const baseY = sy(p.g + p.y);
          ctx.globalAlpha = Math.ceil((1 - t) * 4) / 4;
          for (let k = 0; k < shape.length; k += 2) {
            const cell = k / 2;
            ctx.fillStyle = shape[k + 1] > 0 ? REGOLITH[0] : REGOLITH[(cell + p.seed) % 3];
            ctx.fillRect(
              Math.round(x + shape[k] * spread - cs / 2),
              Math.round(baseY - (shape[k + 1] + 1) * spread),
              Math.round(cs),
              Math.round(cs),
            );
          }
          break;
        }
        case P_FIRE: {
          const color = fireColor(t);
          const size = Math.round(cs * p.size * (1 + t * 0.6));
          ctx.globalAlpha = color === 5 ? Math.ceil(((1 - t) / 0.32) * 3) / 3 * 0.7 : 1;
          ctx.fillStyle = color === 5 ? SMOKE : FLAME[color];
          ctx.fillRect(Math.round(x - size / 2), Math.round(sy(p.y) - size / 2), size, size);
          break;
        }
        case P_TEA: {
          const size = Math.max(2, 1.2 * S);
          ctx.globalAlpha = Math.max(0, Math.min(1, (1 - t) * 1.4));
          ctx.fillStyle = TEA;
          ctx.fillRect(x - size / 2, sy(p.y) - size / 2, size, size);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // --- Drawing: the lander and what happens to it ---------------------------

  function spriteScale() {
    const px = Math.max(1, Math.round(CELL * S));
    return { px, k: (CELL * S) / px };
  }

  function drawLander() {
    if (!ctx || ship.state === "crashed") return;
    const { px, k } = spriteScale();
    const level = fuelLevel(ship.fuel);
    const sprite = cachedSprite(`tea-minus-${level}`, LANDER_GRIDS[level], px, LANDER_PALETTE, HALO);
    ctx.save();
    ctx.translate(sx(ship.x), sy(ship.y));
    ctx.rotate(ship.angle);
    drawFlame();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sprite,
      -(LANDER_COLUMNS / 2) * CELL * S - SPRITE_PAD * k,
      -LANDER_TOP * S - SPRITE_PAD * k,
      sprite.width * k,
      sprite.height * k,
    );
    ctx.restore();
    if (flameLen > 0.05) {
      // Firelight on the underside of the cup.
      toWorld(0, -5);
      const r = 15 * S;
      drawGlow(sx(worldX), sy(worldY), r, r * 0.8, (flameLen / FLAME_FULL) * 0.3 * flicker());
    }
  }

  function drawWreck() {
    if (!ctx) return;
    const { px, k } = spriteScale();
    for (const slice of slices) {
      const grid = LANDER_GRIDS[slice.level];
      ctx.save();
      ctx.translate(sx(slice.x), sy(slice.y));
      ctx.rotate(slice.angle);
      ctx.scale(k, k);
      const x = (-(slice.to - slice.from) * px) / 2;
      const y = (-grid.length * px) / 2;
      drawHalo(ctx, grid, x, y, px, HALO, slice.from, slice.to);
      drawSprite(ctx, grid, x, y, px, LANDER_PALETTE, slice.from, slice.to);
      ctx.restore();
    }
    const radius = Math.max(1.6, 1.3 * S);
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = HALO;
    ctx.fillStyle = PEARL;
    for (const pearl of spilled) {
      ctx.beginPath();
      ctx.arc(sx(pearl.x), sy(pearl.y), radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * The pen loop's box around the landed cup, in screen px. A quarter larger
   * than the sprite plus a margin, because the hand-drawn loops sit inside
   * their box and would otherwise cut through the feet and the straw.
   */
  function loopBox() {
    const width = (LANDER_COLUMNS * CELL * S + 34) * 1.25;
    const height = (LANDER.length * CELL * S + 26) * 1.25;
    const centerY = sy(ship.y + (LANDER_TOP - 8) / 2);
    return { x: sx(ship.x) - width / 2, y: centerY - height / 2, width, height };
  }

  function drawLandingLoop() {
    if (!ctx || !landedLoop || ship.state !== "landed") return;
    const box = loopBox();
    const progress = reduceMotion ? 1 : Math.min(1, landedLoop.age / 0.42);
    drawLoop(ctx, landedLoop.index, box.x, box.y, box.width, box.height, LOOP_COLORS, 2, progress);
  }

  /** Landing notes: cream on a night backing, gold for a feather, legible in either theme. */
  function drawNotes() {
    if (!ctx || !popups.length) return;
    ctx.save();
    ctx.font = popupFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const popup of popups) {
      const x = Math.round(popup.x);
      const y = Math.round(popup.y);
      const width = Math.ceil((ctx.measureText(popup.text).width + 14) / SC) * SC;
      ctx.globalAlpha = Math.max(0, Math.min(1, (popup.life / popup.maxLife) * 2));
      ctx.fillStyle = NIGHT.top;
      ctx.fillRect(Math.round(x - width / 2), y - 10, width, 20);
      ctx.fillStyle = popup.kind === "gold" ? NOTE_GOLD : CREAM;
      ctx.fillText(popup.text, x, y + 0.5);
    }
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;
    S = base * cam.z;
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = NIGHT.top;
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.save();
    if (shake > 0 && !reduceMotion) {
      ctx.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 12 * shake);
    }
    if (skyCanvas) ctx.drawImage(skyCanvas, 0, 0, skyCanvas.width * SC, skyCanvas.height * SC);
    drawStars();
    drawEarth();
    drawRanges();
    drawWind();
    for (const ghost of ghosts) drawPath(ghost, 0.3);
    drawPath(path, 0.7);
    drawGround();
    drawCoasters();
    drawGroundLight();
    drawParticles(false);
    drawWreck();
    drawParticles(true);
    drawFlash();
    drawLander();
    drawLandingLoop();
    ctx.restore();
    drawNotes();
  }

  // --- Camera -------------------------------------------------------------------

  /** Zooms in as the ground comes up, following the ship through a dead zone. */
  function updateCamera(dt: number) {
    const target = 1 + 1.5 * (mode === "countdown" ? 0 : zoomForClearance(clearance(ship, site)));
    cam.z += (target - cam.z) * Math.min(1, dt * 2.2);
    const z = cam.z;
    const f = (z - 1) / 1.5;
    const yTarget = lerp(
      viewHUnits / 2 - 6,
      Math.max(viewHUnits / (2 * z) - 6, groundAt(site, ship.x) + (0.27 * viewHUnits) / z),
      f,
    );
    cam.y += (yTarget - cam.y) * Math.min(1, dt * 5);
    const dead = (viewUnits / (2 * z)) * (0.56 - 0.46 * f);
    const xTarget = clamp(cam.x, ship.x - dead, ship.x + dead);
    cam.x += (xTarget - cam.x) * Math.min(1, dt * 7);
  }

  function snapCamera() {
    cam.z = 1;
    cam.y = viewHUnits / 2 - 6;
    cam.x = ship.x;
  }

  // --- Rules in motion ---------------------------------------------------------

  function phaseFor(n: number) {
    return n >= 5 ? "rush" : n >= 2 ? "steady" : "opening";
  }

  function introFor(n: number) {
    if (n === 1) return INTRO_FIRST;
    if (n === 2) return INTRO_SECOND;
    return INTRO_LATER[laterTurn++ % INTRO_LATER.length];
  }

  function showCaption(kind: Caption["kind"], kicker: string, line: string) {
    captionCount += 1;
    caption = { id: captionCount, kind, kicker, line };
    captionAge = 0;
  }

  function showIntro() {
    showCaption("intro", "", siteIntro);
    liveMessage = `Site ${site.n}, ${site.name}. ${siteIntro}`;
  }

  function enterSite(n: number) {
    siteSeed = seedBase + n * 7919;
    site = makeSite(n, siteSeed);
    siteN = n;
    siteName = site.name;
    siteIntro = introFor(n);
    ghosts = [];
  }

  /** A fresh ship at the top of the sky, and a clean sheet around it. */
  function resetAttempt() {
    ship = newShip(site, viewHUnits);
    flightTime = 0;
    accumulator = 0;
    pathClock = 0;
    lastBeep = -10;
    emptyNoted = false;
    path = { points: [ship.x, ship.y], ticks: [], crashed: false };
    live = 0;
    slices = [];
    spilled = [];
    landedLoop = null;
    shake = 0;
    flameLen = 0;
    flameReach = 999;
    burning = false;
    popAge = 1;
    emberClock = smokeClock = dustClock = 0;
    flash = 0;
    snapCamera();
    syncHud();
  }

  function startFlight() {
    mode = "flying";
    modeTime = 0;
    showIntro();
  }

  function nextAttempt() {
    if (mode === "landed") {
      enterSite(site.n + 1);
      setMusicPhase(phaseFor(site.n));
    } else {
      // The same site again: keep the last two tries on the sheet, fainter.
      ghosts = [...ghosts, path].slice(-2);
    }
    resetAttempt();
    startFlight();
  }

  /** A click, tap, or game key moves on once the result has had a moment. */
  function trySkip() {
    if ((mode === "landed" || (mode === "crashed" && lives > 0)) && modeTime >= SKIP_AFTER && !paused) {
      nextAttempt();
    }
  }

  function samplePath() {
    pathClock += STEP;
    if (pathClock >= PATH_SAMPLE) {
      pathClock -= PATH_SAMPLE;
      path.points.push(ship.x, ship.y);
    }
    if (Math.floor(flightTime) !== Math.floor(flightTime - STEP)) path.ticks.push(ship.x, ship.y);
  }

  /**
   * Where the plume reaches the surface, dust billows out both ways along it:
   * more of it the lower and harder the burn.
   */
  function raiseDust() {
    const reach = ship.plumeReach;
    if (reach >= 95) return;
    const strength = (1 - reach / 95) * ship.throttle;
    dustClock += strength * (reduceMotion ? 5 : 30) * STEP;
    if (dustClock < 1) return;
    const x = ship.x - Math.sin(ship.angle) * (6 + reach);
    while (dustClock >= 1) {
      dustClock -= 1;
      const side = Math.random() < 0.5 ? -1 : 1;
      spawnDust(
        x + side * Math.random() * 5,
        side,
        (16 + Math.random() * 38) * (0.55 + strength) + ship.vx * 0.2 * side,
        2 + Math.random() * 7 * strength,
        0.65 + Math.random() * 0.3,
      );
    }
  }

  function land(result: Extract<Touchdown, { kind: "land" }>) {
    setThruster(0);
    score += result.points;
    landings += 1;
    bestLanding = Math.max(bestLanding, result.points);
    if (result.feather) feathers += 1;
    path.points.push(ship.x, ship.y);
    mode = "landed";
    modeTime = 0;
    landedLoop = { index: landings, age: 0 };
    sfxTouchdown(result.feather);
    // A small puff of dust from each foot.
    for (const foot of [-11, 11]) {
      const side = Math.sign(foot);
      for (let index = 0; index < (reduceMotion ? 1 : 3); index++) {
        spawnDust(ship.x + foot + side * index, side * (index === 2 ? -1 : 1), 7 + Math.random() * 14, 1.5 + Math.random() * 3, 0.5 + Math.random() * 0.2);
      }
    }

    // Three notes stacked above the loop, clear of the cup and straw, each
    // arriving a beat after the last so they read one at a time.
    S = base * cam.z;
    const box = loopBox();
    const notes: Array<[string, "perfect" | "plain" | "gold"]> = [
      [`+${result.points}`, "perfect"],
      [`×${result.pad.multiplier} coaster`, "plain"],
    ];
    if (result.feather) notes.push(["feather", "gold"]);
    const lowest = box.y - 12;
    notes.forEach(([text, kind], index) => {
      pendingPopups.push({
        delay: index * POPUP_STAGGER,
        x: box.x + box.width / 2,
        y: lowest - (notes.length - 1 - index) * POPUP_GAP,
        text,
        kind,
      });
    });

    const line = LANDINGS[landingTurn++ % LANDINGS.length];
    showCaption("result", "", line);
    liveMessage = `${line} ${result.points} points${result.feather ? ", a feather landing" : ""}.`;
    syncHud();
  }

  function crash(reason: CrashReason) {
    setThruster(0);
    sfxCrashLanding();
    lives -= 1;
    livesPulse += 1;
    path.points.push(ship.x, ship.y);
    path.crashed = true;
    mode = "crashed";
    modeTime = 0;
    breakCup();

    const list = CRASHES[reason];
    const line = list[crashTurns[reason]++ % list.length];
    const left = lives > 0 ? `${lives} ${lives === 1 ? "lander" : "landers"} left` : "no landers left";
    showCaption("result", "", line);
    liveMessage = `${line} ${left[0].toUpperCase()}${left.slice(1)}.`;
    syncHud();
  }

  /** The cup breaks into slices, spills its pearls, and splashes its tea. */
  function breakCup() {
    const sin = Math.sin(ship.angle);
    const cos = Math.cos(ship.angle);
    const speed = Math.hypot(ship.vx, ship.vy);
    const level = fuelLevel(ship.fuel);
    const centerY = (LANDER_TOP - 8) / 2;
    for (const [from, to] of SLICES) {
      const lx = ((from + to) / 2 - LANDER_COLUMNS / 2) * CELL;
      const x = ship.x + lx * cos + centerY * sin;
      const y = ship.y - lx * sin + centerY * cos;
      const ox = x - ship.x;
      const oy = y - ship.y + 4;
      const distance = Math.hypot(ox, oy) || 1;
      const kick = 12 + Math.random() * 22 + speed * 0.3;
      slices.push({
        x,
        y,
        vx: ship.vx * 0.35 + (ox / distance) * kick + (Math.random() - 0.5) * 14,
        vy: Math.abs(ship.vy) * 0.3 + Math.abs(oy / distance) * kick + 8 + Math.random() * 22,
        angle: ship.angle,
        spin: (Math.random() - 0.5) * 7,
        from,
        to,
        level,
        grounded: false,
      });
    }
    for (let index = 0; index < 7; index++) {
      spilled.push({
        x: ship.x + (Math.random() - 0.5) * 8,
        y: ship.y + 2,
        vx: ship.vx * 0.3 + (Math.random() - 0.5) * 44,
        vy: 12 + Math.random() * 26,
      });
    }
    if (level > 0) {
      for (let index = 0; index < 8 + level * 6; index++) {
        spawn(
          P_TEA,
          ship.x + (Math.random() - 0.5) * 10,
          ship.y + 4,
          ship.vx * 0.2 + (Math.random() - 0.5) * 70,
          10 + Math.random() * 40,
          0.6 + Math.random() * 0.8,
        );
      }
    }
    // A fireball, a flash of firelight, and a rolling ring of dust.
    const ground = groundAt(site, ship.x);
    flashAt.x = ship.x;
    flashAt.y = Math.max(ground, ship.y);
    flash = FLASH_SECONDS;
    const cells = reduceMotion ? 18 : 60;
    for (let index = 0; index < cells; index++) {
      const angle = Math.PI * (0.06 + Math.random() * 0.88) + (Math.random() < 0.2 ? Math.PI : 0);
      const speed = reduceMotion ? 0 : 16 + Math.random() * 62;
      const spreadX = reduceMotion ? (Math.random() - 0.5) * 16 : (Math.random() - 0.5) * 4;
      const spreadY = reduceMotion ? Math.random() * 10 : Math.random() * 3;
      spawn(
        P_FIRE,
        ship.x + spreadX,
        Math.max(ground + 1, ship.y + 2) + spreadY,
        Math.cos(angle) * speed + ship.vx * 0.15,
        Math.sin(angle) * speed,
        reduceMotion ? 0.35 : 0.52 + Math.random() * 0.22,
        1 + Math.floor(Math.random() * 2.6),
      );
    }
    for (let index = 0; index < (reduceMotion ? 6 : 26); index++) {
      const side = index % 2 ? 1 : -1;
      spawnDust(ship.x + side * Math.random() * 6, side, 34 + Math.random() * 60, 3 + Math.random() * 9, 0.8 + Math.random() * 0.3);
    }
    shake = reduceMotion ? 0 : 1;
  }

  function stepEffects(dt: number) {
    stepFire(dt);
    stepParticles(dt);
    flash = Math.max(0, flash - dt);

    // Slices tumble in the low gravity, bounce, and settle lying down.
    for (const slice of slices) {
      slice.vy -= GRAVITY * dt;
      slice.x += slice.vx * dt;
      slice.y += slice.vy * dt;
      slice.angle += slice.spin * dt;
      const floor = groundAt(site, slice.x) + 3.5;
      if (slice.y <= floor) {
        slice.y = floor;
        if (slice.vy < 0) {
          slice.vy = -slice.vy * 0.36;
          slice.vx *= 0.62;
          slice.spin *= 0.55;
          if (Math.abs(slice.vy) < 2.5) slice.vy = 0;
        }
        slice.grounded = slice.vy === 0;
      }
      if (slice.grounded) {
        slice.vx *= Math.max(0, 1 - dt * 3);
        slice.spin *= Math.max(0, 1 - dt * 6);
        const flat = Math.round((slice.angle - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
        slice.angle += (flat - slice.angle) * Math.min(1, dt * 4);
      }
    }

    // Pearls bounce lazily, then roll down to the low ground and stop.
    for (const pearl of spilled) {
      pearl.vy -= GRAVITY * dt;
      pearl.x += pearl.vx * dt;
      pearl.y += pearl.vy * dt;
      const floor = groundAt(site, pearl.x) + 1.3;
      if (pearl.y <= floor) {
        pearl.y = floor;
        if (pearl.vy < 0) pearl.vy = Math.abs(pearl.vy) < 3 ? 0 : -pearl.vy * 0.45;
        if (pearl.vy === 0) {
          const slope = (groundAt(site, pearl.x + 1) - groundAt(site, pearl.x - 1)) / 2;
          pearl.vx += -slope * GRAVITY * 0.7 * dt;
          pearl.vx *= Math.max(0, 1 - dt * 1.4);
          if (Math.abs(pearl.vx) < 0.25 && Math.abs(slope) < 0.08) pearl.vx = 0;
        }
      }
    }

    if (landedLoop) landedLoop.age += dt;
    shake = Math.max(0, shake - dt / 0.4);
    for (let index = pendingPopups.length - 1; index >= 0; index--) {
      const note = pendingPopups[index];
      note.delay -= dt;
      if (note.delay > 0) continue;
      addPopup(popups, note.x, note.y, note.text, note.kind, 1.6);
      pendingPopups.splice(index, 1);
    }
    stepPopups(popups, dt);

    if (!reduceMotion && site.wind) {
      const wind = windAt(site, flightTime);
      for (const dash of WIND_DASHES) {
        dash.x += ((wind * 18 * dash.speed) / (viewW + 80)) * dt;
        dash.x -= Math.floor(dash.x);
      }
    }
  }

  function fly(dt: number) {
    accumulator += dt;
    const held = controls();
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const result = stepShip(ship, held, site, flightTime, STEP, ceiling);
      flightTime += STEP;
      if (result) {
        accumulator = 0;
        if (result.kind === "land") land(result);
        else crash(result.reason);
        return;
      }
      samplePath();
      if (ship.throttle > 0.08) raiseDust();
    }

    setThruster(ship.throttle);

    if (ship.fuel <= 0 && !emptyNoted) {
      emptyNoted = true;
      showCaption("note", "", EMPTY_LINE);
      liveMessage = EMPTY_LINE;
    }

    // Alarms: a falling tone that quickens as the ground nears, else the
    // slower low-tea note.
    const altitude = altitudeOf(ship, site);
    if (altitude < DANGER_ALTITUDE && ship.vy < -SAFE_VY) {
      const gap = 0.16 + (altitude / DANGER_ALTITUDE) * 0.4;
      if (flightTime - lastBeep > gap) {
        lastBeep = flightTime;
        sfxDescentAlarm();
      }
    } else if (ship.fuel > 0 && ship.fuel < LOW_FUEL && flightTime - lastBeep > 1.1) {
      lastBeep = flightTime;
      sfxLowFuel();
    }

    hudClock += dt;
    if (hudClock >= 0.1) {
      hudClock = 0;
      syncHud();
    }
  }

  function syncHud() {
    const altitude = altitudeOf(ship, site);
    const wind = windAt(site, flightTime);
    const landed = ship.state === "landed";
    readAltitude = Math.round(altitude);
    readDrift = landed ? 0 : Math.abs(ship.vx);
    readDriftSign = landed || Math.abs(ship.vx) < 0.5 ? 0 : Math.sign(ship.vx);
    readDescent = landed ? 0 : Math.abs(ship.vy);
    readDescentSign = landed || Math.abs(ship.vy) < 0.5 ? 0 : Math.sign(ship.vy);
    readWind = Math.abs(wind);
    readWindSign = Math.abs(wind) < 0.5 ? 0 : Math.sign(wind);
    const low = ship.state === "flying" && altitude < DANGER_ALTITUDE;
    tooFast = low && ship.vy < -SAFE_VY;
    drifting = low && Math.abs(ship.vx) > SAFE_VX;
    fuelFraction = ship.fuel / MAX_FUEL;
  }

  function frame(timestamp: number) {
    if (!active) return;
    if (!last) last = timestamp;
    const rawDt = (timestamp - last) / 1000;
    last = timestamp;
    const dt = Math.min(rawDt, 0.05);

    if (paused) {
      // Still drawn, so the theme toggle shows through the pause card.
      draw();
      raf = requestAnimationFrame(frame);
      return;
    }
    clock += dt;
    stepMeteor(dt);

    if (mode === "countdown") {
      const step = stepCountdown(countdownElapsed, countdown, Math.min(rawDt, 0.25));
      countdownElapsed = step.elapsed;
      if (step.beep) {
        countdown = step.count;
        sfxCountdown(countdown);
      }
      if (step.done) beginMission();
    } else {
      modeTime += dt;
      if (mode === "flying") fly(dt);
      if (mode === "landed" || (mode === "crashed" && lives > 0)) {
        if (modeTime >= RESULT_SECONDS) nextAttempt();
      } else if (mode === "crashed" && modeTime >= GAME_OVER_SECONDS) {
        void endGame();
      }
      stepEffects(dt);
    }

    if (caption) {
      captionAge += dt;
      if ((caption.kind === "intro" && captionAge >= INTRO_SECONDS) || (caption.kind === "note" && captionAge >= 4)) {
        caption = null;
      }
    }

    updateCamera(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  // --- Input ---------------------------------------------------------------

  const KEY_CONTROLS: Record<string, keyof Held> = {
    ArrowLeft: "left",
    a: "left",
    ArrowRight: "right",
    d: "right",
    ArrowUp: "thrust",
    w: "thrust",
    " ": "thrust",
  };

  function pressed(control: keyof Held) {
    if (control === "thrust" && tipVisible && mode !== "countdown") tipVisible = false;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Tab") {
      onPlayfieldTab(event);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (gameOver || paused) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    // A focused control keeps Space and Enter for itself.
    if ((key === " " || key === "Enter") && isOnControl(event)) return;
    const control = KEY_CONTROLS[key];
    if (key === "Enter") {
      if (!event.repeat) trySkip();
      return;
    }
    if (!control) return;
    // Arrows and Space never scroll the page underneath.
    event.preventDefault();
    if (!event.repeat) trySkip();
    keys[control] = true;
    pressed(control);
  }

  function onKeyUp(event: KeyboardEvent) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const control = KEY_CONTROLS[key];
    if (control) keys[control] = false;
  }

  function releaseAll() {
    keys.left = keys.right = keys.thrust = false;
    if (touchHeld.left || touchHeld.right || touchHeld.thrust) {
      touchHeld = { left: false, right: false, thrust: false };
    }
  }

  function holdPad(control: keyof Held, down: boolean) {
    if (down && (paused || gameOver)) return;
    if (touchHeld[control] === down) return;
    touchHeld = { ...touchHeld, [control]: down };
    if (down) {
      trySkip();
      pressed(control);
    }
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

  function onStagePointer(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    trySkip();
  }

  // --- Pause, restart, and finish -----------------------------------------

  async function pauseGame() {
    if (gameOver || paused) return;
    paused = true;
    releaseAll();
    setThruster(0);
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

  /**
   * Hands focus to the playfield rather than a HUD button, so Space burns
   * straight away instead of pressing whichever button had focus.
   */
  function focusPlayfield() {
    playfield?.focus({ preventScroll: true });
  }

  /**
   * From the playfield, Shift+Tab wraps to the last control in play. The
   * shell's Tab trap lets it through (the playfield is inside the scope but
   * not a stop), and it would otherwise leave the arcade.
   */
  function onPlayfieldTab(event: KeyboardEvent) {
    if (event.key !== "Tab" || !event.shiftKey || document.activeElement !== playfield) return;
    const controls = playScope?.querySelectorAll<HTMLElement>("button:not([disabled])");
    const lastControl = controls?.[controls.length - 1];
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
    mode = "over";
    releaseAll();
    setThruster(0);
    const result = concludeRun("lander", score);
    localBest = result.best;
    newBest = result.newBest;
    liveMessage = `Splashdown. Final score ${score}.`;
    await tick();
    slip?.focus();
  }

  function beginMission() {
    countdown = 0;
    goVisible = true;
    timers.later(() => (goVisible = false), 620);
    setMusicPhase(phaseFor(site.n));
    startMusic();
    sfxStart();
    startFlight();
    // A HUD button clicked during the countdown would otherwise keep Space.
    if (document.activeElement instanceof HTMLButtonElement && playScope?.contains(document.activeElement)) {
      focusPlayfield();
    }
  }

  /** A new mission: fresh seeds, three landers, site 1, and the countdown. */
  function newMission() {
    seedBase = Math.floor(Math.random() * 1_000_000);
    landingTurn = Math.floor(Math.random() * LANDINGS.length);
    crashTurns = {
      fast: Math.floor(Math.random() * 3),
      hard: Math.floor(Math.random() * 2),
      tilt: Math.floor(Math.random() * 2),
      drift: Math.floor(Math.random() * 2),
      off: Math.floor(Math.random() * 2),
    };
    laterTurn = Math.floor(Math.random() * INTRO_LATER.length);
    score = 0;
    lives = START_LIVES;
    livesPulse = 0;
    landings = 0;
    feathers = 0;
    bestLanding = 0;
    newBest = false;
    popups = [];
    pendingPopups = [];
    caption = null;
    enterSite(1);
    resetAttempt();
    mode = "countdown";
    modeTime = 0;
    countdown = COUNTDOWN_SECONDS;
    countdownElapsed = 0;
    goVisible = false;
    last = 0;
  }

  function restart() {
    stopMusic();
    timers.clear();
    releaseAll();
    paused = false;
    gameOver = false;
    newMission();
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
  }

  // --- Sizing and lifecycle ------------------------------------------------

  function sizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    ctx = fitCanvas(canvas, viewW, viewH);
    playTop = hudRow ? hudRow.getBoundingClientRect().bottom : 80;
    // On touch, the play area ends above the thumb buttons, so no coaster
    // ever sits under a thumb.
    const padsTop = touchUI && padsEl ? padsEl.getBoundingClientRect().top : viewH;
    playBottom = Math.max(playTop + 160, Math.min(viewH, padsTop - 8));
    pmid = (playTop + playBottom) / 2;
    const units = viewW >= viewH * 1.05 ? 800 : 440;
    // A switch between landscape and portrait views recentres on the ship
    // rather than leaving it outside the new, narrower dead zone.
    if (units !== viewUnits) cam.x = ship.x;
    viewUnits = units;
    base = viewW / viewUnits;
    viewHUnits = (playBottom - playTop) / base;
    ceiling = viewHUnits + 30;
    if (mode === "countdown") {
      ship = newShip(site, viewHUnits);
      path = { points: [ship.x, ship.y], ticks: [], crashed: false };
      snapCamera();
    }
    S = base * cam.z;
    buildSky();
    for (const range of RANGES) buildRange(range);
    earthR = Math.max(6, Math.round((Math.min(viewW, viewH) * 0.09) / SC));
    earthDirty = true;
    draw();
  }

  async function syncTouchUI() {
    const next = coarse || touchSeen;
    if (next === touchUI) return;
    touchUI = next;
    await tick();
    sizeCanvas();
  }

  onMount(() => {
    popupFont = arcadeFont();
    padFont = arcadeFont(13, 500);
    const unmountShell = mountShell({
      isOver: () => gameOver,
      isPaused: () => paused,
      pause: () => void pauseGame(),
      togglePause,
      playScope: () => playScope,
      onResize: sizeCanvas,
      // The ticket row can change height (a font loading, a phone wrapping
      // the middle ticket to a second row), and the sky starts below it.
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
    // Held keys never outlive the window's focus.
    window.addEventListener("blur", releaseAll);

    newMission();
    tick().then(() => {
      if (!active) return;
      sizeCanvas();
      tipVisible = firstVisit("lander");
      sfxCountdown(COUNTDOWN_SECONDS);
      liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
      raf = requestAnimationFrame(frame);
    });

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      timers.clear();
      setThruster(0);
      stopMusic();
      coarseQuery.removeEventListener("change", onCoarse);
      window.removeEventListener("pointerdown", onFirstTouch, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      unmountShell();
    };
  });

  const arrowX = (sign: number) => (sign > 0 ? "→" : sign < 0 ? "←" : "·");
  const wordX = (sign: number) => (sign > 0 ? "right" : sign < 0 ? "left" : "none");
  const arrowY = (sign: number) => (sign < 0 ? "↓" : sign > 0 ? "↑" : "·");
  const wordY = (sign: number) => (sign < 0 ? "down" : sign > 0 ? "up" : "none");
</script>

<div class="boba-stage tm-stage" on:pointerdown={onStagePointer} aria-hidden="true"></div>
<canvas bind:this={canvas} class="boba-canvas" aria-hidden="true"></canvas>

<div bind:this={playScope} class="tm-play">
  <!-- Where focus rests during flight: not a button, so Space stays the
       burn key. It is clipped to nothing, so its focus ring never shows as a
       box, and tabindex -1 keeps it out of the Tab cycle itself. -->
  <div
    bind:this={playfield}
    class="sr-only"
    tabindex="-1"
    role="group"
    aria-label="Tea minus playfield"
  ></div>
  <header class="boba-hud boba-ui is-bare" aria-label="Tea minus status">
    <div bind:this={hudRow} class="boba-hud-row">
      <div class="boba-ticket boba-ticket-start boba-riso" style="--tilt: -1.1deg">
        <span class="boba-ticket-icon" aria-hidden="true">
          <PixelIcon grid={MENU_ICONS.lander.grid} palette={MENU_ICONS.lander.palette} px={3} />
        </span>
        <span class="boba-big">{String(score).padStart(4, "0")}</span>
        <span class="boba-stack">
          <span class="boba-meta">site {pad2(siteN, 2)}</span>
          <span class="boba-phase tm-site-name">{siteName}</span>
        </span>
      </div>

      <div class="boba-ticket boba-ticket-center boba-riso tm-telemetry" style="--tilt: 0.8deg">
        <span class="tm-readout">
          <span class="boba-meta">altitude</span>
          <span class="tm-value">{pad2(readAltitude, 4)}</span>
        </span>
        <span class="tm-readout" class:is-unsafe={drifting}>
          <span class="boba-meta">{drifting ? "drifting" : "drift"}</span>
          <span class="tm-value">
            {pad2(readDrift, 3)}
            <span aria-hidden="true">{arrowX(readDriftSign)}</span><span class="sr-only">{wordX(readDriftSign)}</span>
          </span>
        </span>
        <span class="tm-readout" class:is-unsafe={tooFast}>
          <span class="boba-meta">{tooFast ? "too fast" : "descent"}</span>
          <span class="tm-value">
            {pad2(readDescent, 3)}
            <span aria-hidden="true">{arrowY(readDescentSign)}</span><span class="sr-only">{wordY(readDescentSign)}</span>
          </span>
        </span>
        {#if siteN >= 2}
          <span class="tm-readout">
            <span class="boba-meta">wind</span>
            <span class="tm-value">
              {pad2(readWind, 2)}
              <span aria-hidden="true">{arrowX(readWindSign)}</span><span class="sr-only">{wordX(readWindSign)}</span>
            </span>
          </span>
        {/if}
      </div>

      <div class="boba-ticket boba-ticket-end boba-riso" style="--tilt: -0.6deg">
        <span class="boba-stack tm-tea">
          <CupTimer fraction={fuelFraction} rush={fuelFraction * MAX_FUEL < LOW_FUEL} />
          <span class="boba-meta tm-tea-label">tea</span>
        </span>
        <Pearls left={lives} total={START_LIVES} pulse={livesPulse} />
        <HudButtons {paused} on:pause={togglePause} />
      </div>
    </div>

    {#if tipVisible && !paused}
      <div class="boba-tip" role="note" aria-label="How to play">
        <span>land upright and slowly on a coaster</span>
        <span class="boba-keys"><kbd>← →</kbd> tilt <kbd>Space</kbd> burn</span>
      </div>
    {/if}

    <!-- The same sentence goes to the live region, so this copy is hidden. -->
    {#if caption}
      {#key caption.id}
        <p class="tm-caption" aria-hidden="true">
          {#if caption.kicker}<span class="tm-caption-kicker">{caption.kicker}</span>{/if}
          <span class="tm-caption-line">{caption.line}</span>
        </p>
      {/key}
    {/if}
  </header>

  {#if touchUI}
    <div bind:this={padsEl} class="tm-pads boba-ui">
      <div class="tm-pad-group">
        <button
          type="button"
          class="tm-pad boba-riso is-small"
          class:is-down={touchHeld.left}
          style="--tilt: -1.4deg"
          aria-label="Tilt left"
          on:pointerdown={(event) => padDown(event, "left")}
          on:pointerup={() => holdPad("left", false)}
          on:pointercancel={() => holdPad("left", false)}
          on:lostpointercapture={() => holdPad("left", false)}
          on:keydown={(event) => padKey(event, "left", true)}
          on:keyup={(event) => padKey(event, "left", false)}
          on:blur={() => holdPad("left", false)}
          on:contextmenu={(event) => event.preventDefault()}
        >
          <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <path d="M25 22 A10 10 0 1 0 9 10" />
            <path d="M5 6 L8.5 11 L14 8.5" />
          </svg>
        </button>
        <button
          type="button"
          class="tm-pad boba-riso is-small"
          class:is-down={touchHeld.right}
          style="--tilt: 1.2deg"
          aria-label="Tilt right"
          on:pointerdown={(event) => padDown(event, "right")}
          on:pointerup={() => holdPad("right", false)}
          on:pointercancel={() => holdPad("right", false)}
          on:lostpointercapture={() => holdPad("right", false)}
          on:keydown={(event) => padKey(event, "right", true)}
          on:keyup={(event) => padKey(event, "right", false)}
          on:blur={() => holdPad("right", false)}
          on:contextmenu={(event) => event.preventDefault()}
        >
          <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <path d="M7 22 A10 10 0 1 1 23 10" />
            <path d="M27 6 L23.5 11 L18 8.5" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        class="tm-pad tm-burn boba-riso is-small"
        class:is-down={touchHeld.thrust}
        style="--tilt: -0.9deg"
        aria-label="Burn"
        on:pointerdown={(event) => padDown(event, "thrust")}
        on:pointerup={() => holdPad("thrust", false)}
        on:pointercancel={() => holdPad("thrust", false)}
        on:lostpointercapture={() => holdPad("thrust", false)}
        on:keydown={(event) => padKey(event, "thrust", true)}
        on:keyup={(event) => padKey(event, "thrust", false)}
        on:blur={() => holdPad("thrust", false)}
        on:contextmenu={(event) => event.preventDefault()}
      >
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <path d="M16 3 C19 9 25 12 25 19 A9 9 0 0 1 7 19 C7 14 10 12 11 8 C13 11 14 12 15 13 C15.5 9 15 6 16 3 Z" />
          <path d="M16 18 C17.5 20 19 21 19 23.5 A3 3 0 0 1 13 23.5 C13 21.5 14.5 20 16 18 Z" />
        </svg>
      </button>
    </div>
  {/if}
</div>

{#if countdown > 0 || goVisible}
  <Countdown value={countdown} caption="tea minus" goCaption="go for landing" />
{/if}

{#if paused && !gameOver}
  <PauseCard
    bind:this={pauseCard}
    deck="Mission clock stopped. The tea is staying warm."
    on:resume={resumeGame}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

{#if gameOver}
  <ResultsSlip
    bind:this={slip}
    game="lander"
    title="splashdown"
    deck={landings === 0
      ? "No tea reached the moon. The moon will manage."
      : `${landings} ${landings === 1 ? "cup" : "cups"} delivered before the pearls ran out.`}
    {score}
    unit="points"
    {newBest}
    stats={[
      { label: "cups delivered", value: landings },
      { label: "sites reached", value: siteN },
      { label: "best landing", value: bestLanding },
      { label: "feather landings", value: feathers },
      { label: "personal best", value: localBest },
    ]}
    on:restart={restart}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>

<style>
  .tm-play {
    display: contents;
  }

  /* Space has no light mode: the stage is the night's top colour in both
     themes, so the site never shows through behind the canvas. */
  .tm-stage {
    background: #141a2e;
  }

  /* No paper wash behind the tickets: they sit straight on the night. The
     shared sheet carries the same rule; this keeps it if that lands later. */
  .boba-hud.is-bare::before {
    content: none;
  }

  .tm-site-name {
    font-family: var(--font-ui);
    font-style: normal;
    font-weight: 500;
  }

  /* --- Telemetry ticket --- */

  .tm-telemetry {
    gap: var(--space-4);
  }

  .tm-readout {
    display: grid;
    gap: var(--space-0-5);
    justify-items: start;
    min-width: 3.75rem;
  }

  .tm-value {
    color: var(--b-strong);
    font-size: 0.95rem;
    font-variant-numeric: lining-nums tabular-nums;
    line-height: 1.2;
    white-space: nowrap;
  }

  /* Unsafe telemetry changes its word as well as its colour. */
  .tm-readout.is-unsafe .boba-meta,
  .tm-readout.is-unsafe .tm-value {
    color: var(--b-accent);
  }

  .tm-readout.is-unsafe .boba-meta {
    font-weight: 500;
  }

  .tm-tea {
    justify-items: center;
    gap: 0;
  }

  /* --- Mission-control caption --- */

  /* A paper chip, the first-run tip's look, so the line reads on the night
     sky in either theme. */
  .tm-caption {
    display: grid;
    justify-items: center;
    gap: var(--space-0-5);
    width: fit-content;
    max-width: min(45ch, calc(100vw - var(--space-8)));
    margin: var(--space-3) auto 0;
    padding: var(--space-2) var(--space-3);
    text-align: center;
    background: var(--b-raised);
    border: 1px solid var(--b-rule);
    border-radius: var(--radius-inline);
    box-shadow: var(--shadow-popover);
    pointer-events: none;
    animation: boba-rise var(--motion-slow) var(--ease-emphasized) both;
  }

  :global(.dark) .tm-caption {
    box-shadow: var(--shadow-popover-dark);
  }

  .tm-caption-kicker {
    color: var(--b-muted);
    font-size: 0.75rem;
    line-height: 1.25;
  }

  .tm-caption-line {
    color: var(--b-strong);
    font-family: var(--font-ui);
    font-size: 0.9375rem;
    font-style: italic;
    font-weight: 400;
    line-height: 1.4;
    text-wrap: balance;
  }

  /* --- Touch controls: tilt pair bottom left, burn bottom right --- */

  .tm-pads {
    position: fixed;
    inset: auto 0 0;
    z-index: calc(var(--layer-overlay) + 3);
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 0 var(--space-5) max(var(--space-5), env(safe-area-inset-bottom));
    pointer-events: none;
  }

  .tm-pad-group {
    display: flex;
    gap: var(--space-3);
  }

  .tm-pad {
    display: grid;
    place-items: center;
    width: 4.5rem;
    height: 4rem;
    padding: 0;
    color: var(--b-strong);
    background: transparent;
    border: 0;
    cursor: pointer;
    font: inherit;
    pointer-events: auto;
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    transition: transform var(--motion-instant) var(--ease-standard);
  }

  .tm-burn {
    width: 6rem;
    height: 5rem;
  }

  .tm-pad svg {
    width: 2rem;
    height: 2rem;
    overflow: visible;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tm-burn svg {
    width: 2.5rem;
    height: 2.5rem;
  }

  /* No slab at rest: the pads sit straight on the sky or the regolith. */
  .tm-pad::before {
    display: none;
  }

  /* Held: the sheet takes the accent plate's ink and sinks a pixel, with a
     heavier outline so the press reads on the night or on the ground. */
  .tm-pad.is-down {
    color: #1a1a1a;
    transform: translateY(1px);
  }

  .tm-pad.is-down::after {
    background: #e85d4c;
    border-color: #1a1a1a;
    border-width: 2.25px;
  }

  :global(.dark) .tm-pad.is-down {
    color: #1a1a1a;
  }

  :global(.dark) .tm-pad.is-down::after {
    background: #f07563;
    border-color: #fdf8f3;
  }

  @media (prefers-reduced-motion: reduce) {
    .tm-caption {
      animation: none;
    }

    .tm-pad {
      transition: none;
    }
  }

  @media (max-width: 640px) {
    .tm-telemetry {
      gap: var(--space-3);
    }

    .tm-readout {
      min-width: 3.25rem;
    }

    /* Room for both tickets on one row: the site name is also in the
       caption, and the cup reads as tea without its label. */
    .tm-site-name,
    .tm-tea-label {
      display: none;
    }
  }
</style>
