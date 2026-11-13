<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  import {
    setMusicPaused,
    setMusicPhase,
    setPour,
    sfxBlip,
    sfxBoing,
    sfxCountdown,
    sfxDraw,
    sfxDrop,
    sfxErase,
    sfxGate,
    sfxPipe,
    sfxPlop,
    sfxRoomClear,
    sfxRoomFail,
    sfxSizzle,
    sfxSplash,
    sfxSponge,
    sfxStart,
    startMusic,
    stopMusic,
  } from "$lib/sfx";
  import { COUNTDOWN_SECONDS, stepCountdown } from "$lib/arcade/countdown.js";
  import {
    CUP_WALL,
    EVENTS,
    HEIGHT,
    IN_PIPE,
    MILK,
    MIN_SEGMENT,
    PEARL as PEARL_KIND,
    PIPE_MOUTH,
    SPILLED,
    START_LIVES,
    STEP,
    WIDTH,
    availableCheckpoints,
    beginStroke,
    cancelStroke,
    clearStrokes,
    commitStroke,
    createWorld,
    currentRoom,
    cupWalls,
    describeRoom,
    extendStroke,
    judgeRoom,
    newRun,
    pourNow,
    recordResult,
    removeStroke,
    step,
    strawLeft,
    strokeAt,
  } from "$lib/arcade/spill-engine.js";
  import type { Room, RoomResult, Run, World } from "$lib/arcade/spill-engine.js";
  import { MENU_ICONS, fitCanvas, arcadeFont } from "$lib/arcade/art";
  import { firstVisit, readSpillReach, recordSpillReach } from "$lib/arcade/scores";
  import { arcadeExits, concludeRun, createTimers, isOnControl, mountShell } from "$lib/arcade/shell";
  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import Countdown from "./Countdown.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import Pearls from "./Pearls.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";

  // Spill: a kettle pours, and the player draws straws to steer the tea into
  // the cup. Every rule and the fluid itself live in spill-engine.js; this
  // file paints the shop's back kitchen around the room, draws what the engine
  // simulates, and turns pointer and keys into strokes.

  const { exit, toMenu } = arcadeExits(createEventDispatcher<{ close: null; menu: null }>());

  type Phase = "start" | "countdown" | "play" | "result" | "over";
  type Kettle = World["kettles"][number];
  type Cup = World["cups"][number];
  type Block = World["blocks"][number];

  // --- Geometry ------------------------------------------------------------------
  // The room is painted one pixel per world unit into buffers a little larger
  // than the room, so the steel trim, the drip tray and the belts below the
  // floor sit in the same pixel grid. The liquid is a coarser grid on top.

  const MX = 8;
  const MT = 8;
  const MB = 18;
  const RW = WIDTH + MX * 2;
  const RH = HEIGHT + MT + MB;
  /** Liquid cell, in world units. */
  const LC = 2;
  const GW = WIDTH / LC;
  const GH = HEIGHT / LC;
  /** The kitchen around the room: a 4px screen cell. */
  const SC = 4;
  /** Room for the caption chip (up to two balanced lines) between the tickets and the room. */
  const CAPTION_SPACE = 64;
  /** Roughly how much cup a settled droplet fills, measured from the authored rooms. */
  const AREA_PER_DROP = 18.6;
  /** How far a kettle tips while it pours. */
  const TILT = 0.5;
  const PIPE_TRANSIT = 0.3;

  // --- Timing ------------------------------------------------------------------

  const CLEAR_SECONDS = 2.1;
  const FAIL_SECONDS = 2.8;
  const SKIP_AFTER = 0.6;
  const GAME_OVER_SECONDS = 2;
  const INTRO_SECONDS = 4;
  const NOTE_SECONDS = 2.4;
  const STAR_STAGGER = 0.12;

  // --- Colour ---------------------------------------------------------------------
  // The kitchen has no light mode: it is painted the same in both themes, and
  // only the HTML on top (tickets, chips, buttons) follows the theme.

  const hexRgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const pack = (r: number, g: number, b: number, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  const c32 = (hex: string) => {
    const [r, g, b] = hexRgb(hex);
    return pack(r, g, b);
  };
  const mixHex = (a: string, b: string, t: number) => {
    const x = hexRgb(a);
    const y = hexRgb(b);
    return `#${x.map((value, i) => Math.round(value + (y[i] - value) * t).toString(16).padStart(2, "0")).join("")}`;
  };
  const mix32 = (a: string, b: string, t: number) => c32(mixHex(a, b, t));

  const INK_HEX = "#2b2320";
  const INK = c32(INK_HEX);
  const CREAM = c32("#fdf8f3");
  const PAPER = c32("#fbf2e8");
  const CORAL = c32("#e85d4c");
  const WHITE = c32("#ffffff");
  const STEEL = c32("#9aa3a8");
  const STEEL_LIGHT = c32("#c9d0d4");
  const STEEL_DARK = c32("#6f777c");
  const STEEL_DEEP = c32("#3a3f44");
  const PINK = c32("#ff5277");
  const PINK_DEEP = c32("#c93a5e");
  const STRIPE_WHITE = c32("#fdf8f3");
  const PEARL_DARK = c32("#2b1a12");
  const PEARL_SHINE = c32("#8a6a5a");
  const LID = c32("#ece3d6");
  const GOLD = c32("#dba84d");
  const OPENING = c32("#3a3f44");
  const TEA_HEX = "#b9854f";
  const MILK_HEX = "#fbf3e6";

  /** Tea, two milk-tea steps, milk: the liquid's four quantised shares. */
  const LIQ_HEX = [TEA_HEX, mixHex(TEA_HEX, MILK_HEX, 0.36), mixHex(TEA_HEX, MILK_HEX, 0.68), MILK_HEX];
  const LIQ_BASE = Uint32Array.from(LIQ_HEX.map((hex) => c32(hex)));
  const LIQ_TOP = Uint32Array.from(LIQ_HEX.map((hex, i) => (i === 3 ? WHITE : mix32(hex, "#ffffff", 0.32))));
  /** A one-unit outline where the liquid meets the tiles, dark enough to part milk from any tile. */
  const LIQ_EDGE = Uint32Array.from(LIQ_HEX.map((hex) => mix32(hex, "#3a2414", 0.55)));
  /** The underside of a body of liquid, a step darker than the base. */
  const LIQ_SHADE = Uint32Array.from(LIQ_HEX.map((hex, i) => mix32(hex, i === 3 ? "#a8916c" : "#4a2e18", i === 3 ? 0.3 : 0.22)));
  const LIQ_DULL = Uint32Array.from(LIQ_HEX.map((hex) => mix32(hex, "#857b70", 0.42)));
  const LIQ_DULL_TOP = Uint32Array.from(LIQ_HEX.map((hex) => mix32(hex, "#b4aca2", 0.4)));
  const LIQ_DULL_EDGE = Uint32Array.from(LIQ_HEX.map((hex) => mix32(mixHex(hex, "#857b70", 0.42), "#3a2414", 0.45)));

  /** Six quiet tile colours, one per page of rooms, so progress is felt. */
  const TILE_TINTS = ["#a9bcb2", "#a7b9c9", "#b6b0c4", "#c2aca7", "#b7a9b8", "#9aa7b5"];
  /** The kitchen's back wall, from OrderUp's family but a step dimmer. */
  const WALL_HEX = "#a68f77";
  const WAINSCOT_HEX = "#7b604f";
  const SOFFIT_HEX = "#3a2a26";
  const BEAM_HEX = "#4f3a33";
  const WOOD_HEX = "#5e3d2a";
  const FLOOR_HEX = ["#4a3c35", "#56473e"];
  /** The window slit: the time of day by page, then night after hours. */
  const SKIES = [
    { top: "#cfe3ea", low: "#f5e6d3", sun: "#fff6d8", night: false },
    { top: "#8fb9de", low: "#cfe3ea", sun: "#fff6d8", night: false },
    { top: "#a9c4d9", low: "#f5e6d3", sun: "#ffd166", night: false },
    { top: "#c68098", low: "#ffd166", sun: "#ffd166", night: false },
    { top: "#3b2a52", low: "#c86a5a", sun: "#e85d4c", night: false },
    { top: "#141a2e", low: "#3b2a52", sun: "#fdf8f3", night: true },
  ];

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((value) => (value + 0.5) / 16);
  const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];
  const ihash = (n: number) => {
    let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const hash2 = (a: number, b: number) => ihash(Math.imul(a, 73856093) ^ Math.imul(b, 19349663));
  const clamp = (value: number, low: number, high: number) => (value < low ? low : value > high ? high : value);
  const pad2 = (value: number) => String(value).padStart(2, "0");

  // --- Sprites ---------------------------------------------------------------------
  // The kettle and the milk jug are built once as code grids, then sampled
  // through a rotation each frame so they tip as they pour, pivoting on the
  // spout, which is exactly where the engine's stream leaves.

  /** Codes: 1 ink, 2 body, 3 light, 4 shade, 5 lid, 6 knob, 7 handle, 8 sight glass, 9 band. */
  interface Sprite {
    w: number;
    h: number;
    /** The spout tip, the pivot, in grid units. */
    px: number;
    py: number;
    code: Uint8Array;
    glassTop: number;
    glassBottom: number;
    /** Where the hanging chain meets the handle. */
    hx: number;
    hy: number;
  }

  function outline(code: Uint8Array, w: number, h: number) {
    const add: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (code[y * w + x]) continue;
        const filled = (dx: number, dy: number) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;
          const v = code[ny * w + nx];
          return v > 1;
        };
        if (filled(1, 0) || filled(-1, 0) || filled(0, 1) || filled(0, -1)) add.push(y * w + x);
      }
    }
    for (const index of add) code[index] = 1;
  }

  function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
    const dx = bx - ax;
    const dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  }

  function buildKettle(): Sprite {
    const w = 32;
    const h = 25;
    const code = new Uint8Array(w * h);
    const set = (x: number, y: number, v: number) => {
      const gx = x + 1;
      const gy = y + 1;
      if (gx >= 0 && gy >= 0 && gx < w && gy < h) code[gy * w + gx] = v;
    };
    const get = (x: number, y: number) => code[(y + 1) * w + x + 1];
    const cx = 11;
    const half: Record<number, number> = { 8: 5, 9: 7, 10: 8, 19: 8, 20: 7 };
    for (let y = 8; y <= 20; y++) {
      const hw = half[y] ?? 9;
      for (let x = cx - hw; x <= cx + hw; x++) set(x, y, x > cx + 5 ? 4 : x < cx - 6 || y <= 9 ? 3 : 2);
    }
    for (let x = cx - 6; x <= cx + 6; x++) set(x, 21, 1);
    for (let x = cx - 4; x <= cx + 4; x++) set(x, 7, 5);
    for (let x = cx - 3; x <= cx + 3; x++) set(x, 6, 5);
    set(cx - 1, 5, 6);
    set(cx, 5, 6);
    set(cx + 1, 5, 6);
    set(cx, 4, 6);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 24; x++) {
        const d = Math.hypot(x + 0.5 - (cx + 0.5), y + 0.5 - 9.5);
        if (Math.abs(d - 8.4) < 0.75 && !get(x, y)) set(x, y, 7);
      }
    }
    for (let y = 2; y < 20; y++) {
      for (let x = cx + 7; x < 30; x++) {
        if (segDist(x + 0.5, y + 0.5, cx + 8.5, 15.5, 28.5, 5.5) < 1.55 && !get(x, y)) set(x, y, y > 12 ? 4 : 2);
      }
    }
    for (let y = 11; y <= 18; y++) {
      set(cx - 5, y, 8);
      set(cx - 4, y, 8);
    }
    outline(code, w, h);
    return { w, h, px: 29.5, py: 6.5, code, glassTop: 12, glassBottom: 19, hx: cx + 1.5, hy: 1 };
  }

  function buildJug(): Sprite {
    const w = 27;
    const h = 26;
    const code = new Uint8Array(w * h);
    const set = (x: number, y: number, v: number) => {
      const gx = x + 1;
      const gy = y + 1;
      if (gx >= 0 && gy >= 0 && gx < w && gy < h) code[gy * w + gx] = v;
    };
    const cx = 11;
    for (let y = 6; y <= 21; y++) {
      const hw = y <= 7 || y >= 20 ? 6 : 7;
      for (let x = cx - hw; x <= cx + hw; x++) {
        const v = y >= 10 && y <= 12 ? 9 : x > cx + 4 ? 4 : x < cx - 5 ? 3 : 2;
        set(x, y, y === 6 ? 3 : v);
      }
    }
    // The lip, drawn out into a pouring spout at the top right.
    for (let x = cx + 6; x <= cx + 8; x++) set(x, 6, 2);
    for (let x = cx + 7; x <= cx + 9; x++) set(x, 5, 3);
    for (let x = cx + 8; x <= cx + 10; x++) set(x, 4, 3);
    // A loop handle on the back.
    for (let y = 8; y <= 19; y++) {
      for (let x = 0; x < cx - 6; x++) {
        const d = Math.hypot(x + 0.5 - (cx - 7.5), y + 0.5 - 13.5);
        if (Math.abs(d - 4.4) < 0.8) set(x, y, 7);
      }
    }
    for (let y = 14; y <= 19; y++) {
      set(cx - 3, y, 8);
      set(cx - 2, y, 8);
    }
    outline(code, w, h);
    return { w, h, px: cx + 11.5 + 1, py: 4.5, code, glassTop: 15, glassBottom: 20, hx: cx + 1.5, hy: 5 };
  }

  const KETTLE_SPRITE = buildKettle();
  const JUG_SPRITE = buildJug();
  const KETTLE_PAL = Uint32Array.from(
    ["#000000", INK_HEX, "#d9604c", "#f08c74", "#a8473a", "#ece3d6", INK_HEX, WOOD_HEX, "#efe9df", "#d9604c"].map((hex, i) =>
      i === 0 ? 0 : c32(hex),
    ),
  );
  const JUG_PAL = Uint32Array.from(
    ["#000000", INK_HEX, "#f6eee2", "#ffffff", "#d8ccba", "#fbf3e6", INK_HEX, "#d8ccba", "#e8e0d2", "#6aa6e0"].map((hex, i) =>
      i === 0 ? 0 : c32(hex),
    ),
  );

  /** A pixel star for the HUD pips and the result: outline O, fill f. */
  const STAR = [
    "....O....",
    "...OfO...",
    "...OfO...",
    "OOOOfOOOO",
    ".OfffffO.",
    "..OfffO..",
    "..OfOfO..",
    ".OfO.OfO.",
    ".OO...OO.",
  ];
  const STAR_ON = { O: "currentColor", f: "#dba84d" };
  const STAR_OFF = { O: "currentColor" };

  const PEARL_GRID = ["..ppp..", ".ppppp.", "pphpppp", "phhpppp", "ppppppp", ".ppppp.", "..ppp.."];
  const CHECK_GRID = ["......O", ".....OO", "O...OO.", "OO.OO..", ".OOO...", "..O...."];

  // --- State -------------------------------------------------------------------

  let phase: Phase = "countdown";
  let score = 0;
  let lives = START_LIVES;
  let livesPulse = 0;
  let paused = false;
  let gameOver = false;
  let tipVisible = false;
  let liveMessage = "Spill starting";
  let localBest = 0;
  let newBest = false;
  let countdown = COUNTDOWN_SECONDS;
  let countdownElapsed = 0;
  let goVisible = false;
  let checkpoints: number[] = [0];
  let reached = 0;

  // HUD readouts, refreshed about ten times a second.
  let roomLabel = "room 01";
  let roomName = "";
  let previewStars = 0;
  let strawNow = 0;
  let strawBudget = 1;
  let strawPulse = 0;
  let canPour = false;
  let canUndo = false;

  let caption: { id: number; line: string } | null = null;
  let captionAge = 0;
  let captionLife = INTRO_SECONDS;
  let captionCount = 0;
  let verdict: { id: number; stars: number; points: number } | null = null;
  let verdictCount = 0;

  // Run stats for the slip.
  let roomsCleared = 0;
  let starsTotal = 0;
  let threeStarRooms = 0;
  let teaSpilled = 0;

  let run: Run = newRun();
  let room: Room = currentRoom(run);
  let world: World = createWorld(room);
  let resultAge = 0;
  let lastCleared = false;
  let accumulator = 0;
  let alpha = 1;
  let clock = 0;
  let hudClock = 0;
  let pourAnnounced = false;
  let shake = 0;

  let canvas: HTMLCanvasElement;
  let stage: HTMLElement;
  let playScope: HTMLElement;
  let playfield: HTMLElement;
  let hudRow: HTMLElement;
  let barEl: HTMLElement;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;
  let startCard: HTMLElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let reduceMotion = false;
  let dialFont = '700 11px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';
  let chipFont = '500 12px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';

  // Layout, in CSS px.
  let viewW = 0;
  let viewH = 0;
  let dpr = 1;
  /** Pixels per world unit. */
  let S = 2;
  /** The room buffers' top-left, and the room's own origin, on screen. */
  let ox = 0;
  let oy = 0;
  let rx = 0;
  let ry = 0;
  let captionTop = 80;
  let hudBottomPx = 72;
  let verdictTop = 200;
  let roomCenterX = 0;

  let last = 0;
  let raf = 0;
  let active = true;
  const timers = createTimers();

  // --- Offscreen layers ----------------------------------------------------------

  const makeCanvas = (w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  let kitchenCanvas: HTMLCanvasElement | null = null;
  let kitchenCols = 0;
  let kitchenRows = 0;
  let roomCanvas: HTMLCanvasElement | null = null;
  let roomImage: ImageData | null = null;
  let dynCanvas: HTMLCanvasElement | null = null;
  let dynCtx: CanvasRenderingContext2D | null = null;
  let dynImage: ImageData | null = null;
  /** The per-frame layer, one Uint32 per pixel. */
  let D = new Uint32Array(RW * RH);
  let R32 = new Uint32Array(RW * RH);

  // The pixel painter writes into whichever buffer is the current target,
  // in world units (the target's offset puts world 0,0 at the room's corner).
  let T: Uint32Array = D;
  let TW = RW;
  let TH = RH;
  let TOX = MX;
  let TOY = MT;
  function target(buffer: Uint32Array, w: number, h: number, offsetX: number, offsetY: number) {
    T = buffer;
    TW = w;
    TH = h;
    TOX = offsetX;
    TOY = offsetY;
  }
  function put(x: number, y: number, c: number) {
    const ix = Math.floor(x) + TOX;
    const iy = Math.floor(y) + TOY;
    if (ix < 0 || iy < 0 || ix >= TW || iy >= TH) return;
    T[iy * TW + ix] = c;
  }
  /** Lays `c` over what is there at `a` (0–1). */
  function blend(x: number, y: number, c: number, a: number) {
    const ix = Math.floor(x) + TOX;
    const iy = Math.floor(y) + TOY;
    if (ix < 0 || iy < 0 || ix >= TW || iy >= TH) return;
    const i = iy * TW + ix;
    const d = T[i];
    if (d >>> 24 === 0) {
      T[i] = ((Math.round(a * 255) << 24) | (c & 0xffffff)) >>> 0;
      return;
    }
    const r = (d & 255) + ((c & 255) - (d & 255)) * a;
    const g = ((d >>> 8) & 255) + (((c >>> 8) & 255) - ((d >>> 8) & 255)) * a;
    const b = ((d >>> 16) & 255) + (((c >>> 16) & 255) - ((d >>> 16) & 255)) * a;
    T[i] = pack(r | 0, g | 0, b | 0, d >>> 24);
  }
  function rect(x: number, y: number, w: number, h: number, c: number) {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = Math.round(x + w);
    const y1 = Math.round(y + h);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) put(xx, yy, c);
  }
  function dither(x: number, y: number, w: number, h: number, c: number, density: number) {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    for (let yy = y0; yy < y0 + Math.round(h); yy++) {
      for (let xx = x0; xx < x0 + Math.round(w); xx++) if (bayer(xx + 64, yy + 64) < density) put(xx, yy, c);
    }
  }
  function disc(cx: number, cy: number, r: number, c: number) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) put(x, y, c);
      }
    }
  }
  function ring(cx: number, cy: number, r0: number, r1: number, c: number) {
    for (let y = Math.floor(cy - r1); y <= Math.ceil(cy + r1); y++) {
      for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r0 && d <= r1) put(x, y, c);
      }
    }
  }
  /** A pixel line; `dash` > 0 draws `dash` on, `dash` off, shifted by `phase`. */
  function line(x0: number, y0: number, x1: number, y1: number, c: number, dash = 0, phase = 0, a = 1) {
    let x = Math.floor(x0);
    let y = Math.floor(y0);
    const tx = Math.floor(x1);
    const ty = Math.floor(y1);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    let n = 0;
    for (let guard = 0; guard < 2000; guard++) {
      if (!dash || Math.floor((n + phase) / dash) % 2 === 0) {
        if (a >= 1) put(x, y, c);
        else blend(x, y, c, a);
      }
      n++;
      if (x === tx && y === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  function grid(rows: string[], x: number, y: number, palette: Record<string, number>) {
    for (let row = 0; row < rows.length; row++) {
      const text = rows[row];
      for (let col = 0; col < text.length; col++) {
        const c = palette[text[col]];
        if (c) put(x + col, y + row, c);
      }
    }
  }

  // --- The kitchen around the room ---------------------------------------------------

  function pageIndex() {
    return clamp((room.page ?? 1) - 1, 0, TILE_TINTS.length - 1);
  }

  /** Paints the back kitchen in 4px cells around wherever the room sits. */
  function bakeKitchen() {
    const cols = Math.ceil(viewW / SC) + 1;
    const rows = Math.ceil(viewH / SC) + 1;
    if (cols < 2 || rows < 2) return;
    const buffer = new Uint32Array(cols * rows);
    target(buffer, cols, rows, 0, 0);
    const left = Math.floor(ox / SC);
    const right = Math.ceil((ox + RW * S) / SC);
    const top = Math.floor(oy / SC);
    const bottom = Math.ceil((oy + RH * S) / SC);
    const floorRow = Math.min(rows - 1, bottom - 2);
    const soffit = 5;
    const wall = c32(WALL_HEX);
    const wainscotRow = Math.round(top + (floorRow - top) * 0.62);

    // Plaster, a darker wainscot of planks, the soffit and its beam.
    rect(0, 0, cols, rows, wall);
    dither(0, soffit + 2, cols, 4, c32(mixHex(WALL_HEX, SOFFIT_HEX, 0.2)), 0.5);
    rect(0, wainscotRow, cols, floorRow - wainscotRow, c32(WAINSCOT_HEX));
    rect(0, wainscotRow, cols, 1, c32(mixHex(WAINSCOT_HEX, "#ffffff", 0.18)));
    for (let x = 3; x < cols; x += 7) rect(x, wainscotRow + 1, 1, floorRow - wainscotRow - 1, c32(mixHex(WAINSCOT_HEX, SOFFIT_HEX, 0.35)));
    rect(0, 0, cols, soffit, c32(SOFFIT_HEX));
    rect(0, soffit - 1, cols, 1, c32(BEAM_HEX));

    // The floor: dark quarry tiles in a checker, a skirting line above.
    for (let y = floorRow; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tile = (Math.floor(x / 4) + Math.floor((y - floorRow) / 3)) & 1;
        put(x, y, c32(FLOOR_HEX[tile]));
      }
    }
    rect(0, floorRow, cols, 1, c32(SOFFIT_HEX));

    // A copper pipe run under the soffit, with collars, a drop and a valve.
    const pipeY = soffit + 1;
    const copper = c32("#b0603e");
    rect(0, pipeY, cols, 2, copper);
    rect(0, pipeY, cols, 1, c32("#d98a5f"));
    rect(0, pipeY + 2, cols, 1, c32("#7a3f2a"));
    for (let x = 9; x < cols; x += 26) {
      rect(x, pipeY - 1, 2, 4, c32("#7a3f2a"));
      put(x, pipeY - 1, c32("#d98a5f"));
    }
    const dropX = left > 8 ? 3 : right < cols - 8 ? cols - 5 : -1;
    if (dropX >= 0) {
      rect(dropX, pipeY + 2, 2, floorRow - pipeY - 2, copper);
      rect(dropX, pipeY + 2, 1, floorRow - pipeY - 2, c32("#d98a5f"));
      const valveY = Math.round(pipeY + (floorRow - pipeY) * 0.45);
      rect(dropX - 2, valveY, 6, 1, c32("#b0442f"));
      rect(dropX, valveY - 2, 2, 5, c32("#b0442f"));
      put(dropX, valveY, c32("#e85d4c"));
    }

    // The room panel's shadow on the wall, dithered, down and to the right.
    const shade = c32(mixHex(WALL_HEX, SOFFIT_HEX, 0.55));
    for (let y = top + 2; y <= bottom; y++) {
      for (let x = left + 2; x <= right; x++) {
        if (x < right - 1 && y < bottom - 1) continue;
        if (bayer(x, y) < 0.5) put(x, y, shade);
      }
    }

    const below = Math.max(soffit + 6, Math.ceil(hudBottomPx / SC) + 3);
    const leftSpace = left - 2;
    const rightStart = right + 2;
    const rightSpace = cols - rightStart - 2;
    if (leftSpace >= 12) paintShelves(2, leftSpace, below, wainscotRow, 0);
    if (rightSpace >= 12) {
      const slitW = Math.min(30, rightSpace - 2);
      paintWindow(rightStart + Math.round((rightSpace - slitW) / 2), below + 1, slitW, 5);
      paintLadles(rightStart, rightSpace, below + 10);
      if (wainscotRow - (below + 28) > 10) paintShelves(rightStart, rightSpace, below + 28, wainscotRow, 1);
    }

    kitchenCols = cols;
    kitchenRows = rows;
    kitchenCanvas ??= document.createElement("canvas");
    kitchenCanvas.width = cols;
    kitchenCanvas.height = rows;
    kitchenCanvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(buffer.buffer), cols, rows), 0, 0);
  }

  /** Planks of jars and tins, seeded so they never reshuffle. */
  function paintShelves(x0: number, width: number, y0: number, y1: number, seed: number) {
    const plank = c32(WOOD_HEX);
    const plankLight = c32("#8a5a3a");
    const tints = ["#c79a6b", "#8bbf5a", "#b388e0", "#f47ba0", "#f4b942", "#8f8f8f", "#b0442f", "#3f6f6a", "#dceef4"];
    let row = 0;
    for (let shelfY = y0 + 9; shelfY < y1 - 2 && row < 4; shelfY += 10, row++) {
      rect(x0, shelfY, width, 1, plankLight);
      rect(x0, shelfY + 1, width, 1, plank);
      put(x0 + 1, shelfY + 2, plank);
      put(x0 + width - 2, shelfY + 2, plank);
      for (let x = x0 + 1, index = 0; x < x0 + width - 4; index++) {
        const roll = hash2(seed * 97 + row, index);
        const kind = Math.floor(roll * 3);
        const tint = tints[Math.floor(hash2(seed * 31 + row, index + 7) * tints.length)];
        const body = c32(mixHex(tint, WALL_HEX, 0.28));
        const dark = c32(mixHex(tint, SOFFIT_HEX, 0.35));
        if (kind === 0) {
          // A jar: glass with a coloured fill and a lid.
          const h = 5 + Math.floor(hash2(row, index + 3) * 3);
          rect(x, shelfY - h, 4, h, c32(mixHex("#dceef4", WALL_HEX, 0.3)));
          rect(x, shelfY - Math.ceil(h * 0.6), 4, Math.ceil(h * 0.6), body);
          rect(x, shelfY - h - 1, 4, 1, dark);
          x += 6;
        } else if (kind === 1) {
          // A tin with a label band.
          const h = 4 + Math.floor(hash2(row, index + 5) * 2);
          rect(x, shelfY - h, 3, h, c32(mixHex("#9aa3a8", WALL_HEX, 0.2)));
          rect(x, shelfY - h + 1, 3, 2, body);
          x += 4;
        } else {
          // A stack of bowls.
          rect(x, shelfY - 2, 5, 2, c32(mixHex("#f6eee2", WALL_HEX, 0.25)));
          rect(x + 1, shelfY - 3, 3, 1, c32(mixHex("#f6eee2", WALL_HEX, 0.25)));
          rect(x, shelfY - 1, 5, 1, dark);
          x += 6;
        }
        x += Math.floor(hash2(row + 11, index) * 2);
      }
    }
  }

  /** A narrow window high on the wall: the time of day by page. */
  function paintWindow(x: number, y: number, w: number, h: number) {
    const remix = !!room.remix;
    const sky = SKIES[remix ? SKIES.length - 1 : pageIndex()];
    const frame = c32(WOOD_HEX);
    rect(x - 1, y - 1, w + 2, h + 2, frame);
    const top = c32(sky.top);
    const low = c32(sky.low);
    for (let yy = 0; yy < h; yy++) {
      const t = yy / Math.max(1, h - 1);
      for (let xx = 0; xx < w; xx++) put(x + xx, y + yy, t > bayer(xx, yy) * 0.6 + 0.3 ? low : top);
    }
    const sunX = x + Math.round(w * (0.25 + pageIndex() * 0.1));
    const sunY = y + 1 + Math.min(h - 2, Math.floor(pageIndex() / 2));
    if (sky.night) {
      for (let i = 0; i < 6; i++) put(x + 1 + Math.floor(hash2(i, 5) * (w - 2)), y + Math.floor(hash2(i, 9) * (h - 1)), CREAM);
      put(sunX, y + 1, CREAM);
      put(sunX + 1, y + 1, CREAM);
      put(sunX, y + 2, CREAM);
    } else {
      put(sunX, sunY, c32(sky.sun));
      put(sunX + 1, sunY, c32(sky.sun));
      put(sunX, sunY + 1, c32(sky.sun));
      put(sunX + 1, sunY + 1, c32(sky.sun));
    }
    rect(x + Math.round(w / 2), y, 1, h, frame);
    rect(x - 2, y + h + 1, w + 4, 1, c32("#8a5a3a"));
  }

  /** A rail of hanging ladles and a whisk. */
  function paintLadles(x0: number, width: number, y: number) {
    const rail = c32("#6f777c");
    const steel = c32("#c9d0d4");
    const dark = c32("#3a3f44");
    const span = Math.min(width - 4, 28);
    const start = x0 + Math.round((width - span) / 2);
    rect(start, y, span, 1, rail);
    put(start - 1, y - 1, rail);
    put(start + span, y - 1, rail);
    for (let i = 0, x = start + 2; x < start + span - 3; i++, x += 6) {
      const length = 5 + Math.floor(hash2(i, 41) * 4);
      put(x, y + 1, dark);
      rect(x, y + 2, 1, length, steel);
      if (i % 3 === 2) {
        // A whisk: a loop of wires.
        rect(x - 1, y + 2 + length, 3, 3, dark);
        put(x, y + 3 + length, steel);
      } else {
        rect(x - 1, y + 2 + length, 3, 2, steel);
        rect(x - 1, y + 4 + length, 3, 1, dark);
      }
    }
  }

  // --- The room's static layer -------------------------------------------------------

  /** Everything in the room that doesn't move, painted once per room. */
  function bakeRoom() {
    R32.fill(0);
    target(R32, RW, RH, MX, MT);
    const tint = TILE_TINTS[pageIndex()];
    const base = room.remix ? mixHex(tint, "#3b3550", 0.22) : tint;
    const tones = [c32(base), c32(mixHex(base, "#ffffff", 0.05))];
    const grout = c32(mixHex(base, INK_HEX, 0.14));
    const glaze = c32(mixHex(base, "#ffffff", 0.16));
    const under = c32(mixHex(base, INK_HEX, 0.06));
    const low = c32(mixHex(base, INK_HEX, 0.07));
    const TILE = 12;

    // Square tiles in a calm grid, a soft band lower down joined by dithering.
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const tx = x % TILE;
        const ty = y % TILE;
        let c = tones[hash2(Math.floor(x / TILE), Math.floor(y / TILE)) < 0.35 ? 1 : 0];
        const band = clamp((y - HEIGHT * 0.58) / (HEIGHT * 0.2), 0, 1);
        if (band > bayer(x, y)) c = low;
        if (tx === 0 || ty === 0) c = grout;
        else if (tx === 1 && ty > 1 && ty < 5) c = glaze;
        else if (ty === TILE - 1) c = under;
        put(x, y, c);
      }
    }

    // Steel trim on three sides and a drip tray for a floor.
    rect(-5, -MT, 5, HEIGHT + MT + 4, STEEL);
    rect(WIDTH, -MT, 5, HEIGHT + MT + 4, STEEL);
    rect(-5, -MT, WIDTH + 10, MT - 2, STEEL);
    rect(-4, -MT + 1, 1, HEIGHT + MT, STEEL_LIGHT);
    rect(WIDTH + 1, -MT + 1, 1, HEIGHT + MT, STEEL_LIGHT);
    rect(-4, -MT + 1, WIDTH + 8, 1, STEEL_LIGHT);
    rect(-6, -MT - 1, 1, HEIGHT + MT + 5, INK);
    rect(WIDTH + 5, -MT - 1, 1, HEIGHT + MT + 5, INK);
    rect(-6, -MT - 1, WIDTH + 12, 1, INK);
    rect(0, -3, WIDTH, 1, INK);
    rect(-1, -2, 1, HEIGHT + 2, INK);
    rect(WIDTH, -2, 1, HEIGHT + 2, INK);
    rect(-6, HEIGHT, WIDTH + 12, 2, STEEL_LIGHT);
    rect(-6, HEIGHT + 2, WIDTH + 12, 1, INK);
    rect(-6, HEIGHT + 3, WIDTH + 12, MB - 5, STEEL_DARK);
    rect(-6, HEIGHT + MB - 2, WIDTH + 12, 1, INK);
    for (let x = 8; x < WIDTH; x += 24) {
      put(x, HEIGHT + 6, STEEL_LIGHT);
      put(x, HEIGHT + 12, STEEL_LIGHT);
    }

    paintFanRegions();
    for (const zone of room.noDraw ?? []) hatch(zone.x, zone.y, zone.w, zone.h, INK, 0.22);
    paintPipes();
    paintBelts(true);
    paintScalesStatic();
    world.blocks.forEach((block, index) => {
      if (block.type === "ice") paintBlock(block, index);
    });
    paintFanHousings();

    roomCanvas ??= makeCanvas(RW, RH);
    roomImage ??= new ImageData(RW, RH);
    new Uint32Array(roomImage.data.buffer).set(R32);
    roomCanvas.getContext("2d")?.putImageData(roomImage, 0, 0);
  }

  function hatch(x: number, y: number, w: number, h: number, c: number, a: number) {
    for (let yy = Math.floor(y); yy < y + h; yy++) {
      for (let xx = Math.floor(x); xx < x + w; xx++) if (((xx + yy) & 3) === 0) blend(xx, yy, c, a);
    }
  }

  // --- Fans ------------------------------------------------------------------------

  /** Which edge a fan blows from, its unit direction, and its strength. */
  function fanFrame(fan: World["fans"][number]) {
    const strength = Math.hypot(fan.fx, fan.fy) || 1;
    const dx = fan.fx / strength;
    const dy = fan.fy / strength;
    let ex: number;
    let ey: number;
    if (Math.abs(fan.fx) >= Math.abs(fan.fy)) {
      ex = fan.fx > 0 ? fan.x : fan.x + fan.w;
      ey = fan.y + fan.h / 2;
    } else {
      ey = fan.fy < 0 ? fan.y + fan.h : fan.y;
      ex = fan.x + fan.w / 2;
    }
    const cx = clamp(ex - Math.sign(Math.abs(fan.fx) >= Math.abs(fan.fy) ? dx : 0) * 7, 8, WIDTH - 8);
    const cy = clamp(ey - Math.sign(Math.abs(fan.fx) >= Math.abs(fan.fy) ? 0 : dy) * 7, 8, HEIGHT - 8);
    return { dx, dy, strength, cx, cy };
  }

  function paintFanRegions() {
    for (const fan of world.fans) {
      const { dx, dy, strength } = fanFrame(fan);
      dither(fan.x, fan.y, fan.w, fan.h, c32("#e8f2f2"), 0.09);
      // Corner brackets mark the region the wind fills.
      const corner = (x: number, y: number, sx: number, sy: number) => {
        for (let i = 0; i < 4; i++) {
          blend(x + sx * i, y, INK, 0.35);
          blend(x, y + sy * i, INK, 0.35);
        }
      };
      corner(fan.x, fan.y, 1, 1);
      corner(fan.x + fan.w - 1, fan.y, -1, 1);
      corner(fan.x, fan.y + fan.h - 1, 1, -1);
      corner(fan.x + fan.w - 1, fan.y + fan.h - 1, -1, -1);
      if (reduceMotion) {
        // Still arrows instead of drifting wind, longer for a stronger fan.
        const size = 2 + Math.round(clamp(strength / 700, 0.5, 1.6) * 2);
        for (let y = fan.y + 12; y < fan.y + fan.h - 6; y += 20) {
          for (let x = fan.x + 12; x < fan.x + fan.w - 6; x += 22) chevron(x, y, dx, dy, size, 0.5);
        }
      }
    }
  }

  function chevron(x: number, y: number, dx: number, dy: number, size: number, a: number) {
    const px = -dy;
    const py = dx;
    for (let i = 0; i <= size; i++) {
      blend(x + dx * (size - i) + px * i, y + dy * (size - i) + py * i, CREAM, a);
      blend(x + dx * (size - i) - px * i, y + dy * (size - i) - py * i, CREAM, a);
    }
  }

  function paintFanHousings() {
    for (const fan of world.fans) {
      const { cx, cy } = fanFrame(fan);
      rect(cx - 8, cy - 8, 16, 16, INK);
      rect(cx - 7, cy - 7, 14, 14, STEEL_DARK);
      rect(cx - 7, cy - 7, 14, 1, STEEL);
      disc(cx, cy, 6, STEEL_DEEP);
      put(cx - 7, cy + 7, INK);
      put(cx + 6, cy + 7, INK);
    }
  }

  // --- Pipes ---------------------------------------------------------------------

  function pipePath(pipe: World["pipes"][number]): Array<[number, number]> {
    return pipe.path && pipe.path.length >= 2
      ? pipe.path
      : [
          [pipe.a.x, pipe.a.y],
          [pipe.b.x, pipe.b.y],
        ];
  }

  /** Each pipe's path with running lengths, for blips that travel through it. */
  let pipeRuns: Array<{ pts: Array<[number, number]>; acc: number[]; length: number }> = [];

  function paintPipes() {
    pipeRuns = world.pipes.map((pipe) => {
      const pts = pipePath(pipe);
      const acc = [0];
      for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return { pts, acc, length: acc[acc.length - 1] };
    });
    const glass = c32("#e6f3f7");
    const rim = c32("#d0e6ec");
    for (const pipe of world.pipes) {
      const pts = pipePath(pipe);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [x, y] of pts) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      for (let y = Math.floor(y0 - 6); y <= y1 + 6; y++) {
        for (let x = Math.floor(x0 - 6); x <= x1 + 6; x++) {
          let d = Infinity;
          for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(x + 0.5, y + 0.5, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
          if (d > 4.6) continue;
          if (d > 3.6) put(x, y, INK);
          else if (d > 2.8) blend(x, y, rim, 0.8);
          else if (d < 0.8) blend(x, y, WHITE, 0.45);
          else blend(x, y, glass, 0.45);
        }
      }
      for (const end of [pipe.a, pipe.b]) {
        for (let y = Math.floor(end.y - 9); y <= end.y + 9; y++) {
          for (let x = Math.floor(end.x - 9); x <= end.x + 9; x++) {
            const d = Math.hypot(x + 0.5 - end.x, y + 0.5 - end.y);
            if (d > PIPE_MOUTH + 1) continue;
            if (d > PIPE_MOUTH) put(x, y, INK);
            else if (d > PIPE_MOUTH - 2) put(x, y, d > PIPE_MOUTH - 1 ? STEEL_LIGHT : STEEL);
            else put(x, y, OPENING);
          }
        }
        // A lip on the side the tea leaves from.
        const len = Math.hypot(end.nx, end.ny) || 1;
        const nx = end.nx / len;
        const ny = end.ny / len;
        for (let i = -2; i <= 2; i++) put(end.x + nx * 3 - ny * i, end.y + ny * 3 + nx * i, c32("#5b6a70"));
      }
    }
  }

  // Blips: tea travelling through a pipe, so a transit is visible.
  const MAX_BLIPS = 48;
  const blipPipe = new Int8Array(MAX_BLIPS);
  const blipEnd = new Uint8Array(MAX_BLIPS);
  const blipAge = new Float32Array(MAX_BLIPS);
  let blipCount = 0;

  function addBlip(pipe: number, end: number) {
    if (blipCount >= MAX_BLIPS) return;
    blipPipe[blipCount] = pipe;
    blipEnd[blipCount] = end;
    blipAge[blipCount] = 0;
    blipCount++;
  }

  function stepBlips(dt: number) {
    for (let i = blipCount - 1; i >= 0; i--) {
      blipAge[i] += dt;
      if (blipAge[i] < PIPE_TRANSIT) continue;
      blipCount--;
      blipPipe[i] = blipPipe[blipCount];
      blipEnd[i] = blipEnd[blipCount];
      blipAge[i] = blipAge[blipCount];
    }
  }

  function paintBlips() {
    for (let i = 0; i < blipCount; i++) {
      const runInfo = pipeRuns[blipPipe[i]];
      if (!runInfo) continue;
      const t = clamp(blipAge[i] / PIPE_TRANSIT, 0, 1);
      const s = (blipEnd[i] === 0 ? t : 1 - t) * runInfo.length;
      let k = 1;
      while (k < runInfo.acc.length - 1 && runInfo.acc[k] < s) k++;
      const seg = runInfo.acc[k] - runInfo.acc[k - 1] || 1;
      const f = (s - runInfo.acc[k - 1]) / seg;
      const [ax, ay] = runInfo.pts[k - 1];
      const [bx, by] = runInfo.pts[k];
      const x = ax + (bx - ax) * f;
      const y = ay + (by - ay) * f;
      rect(x - 1, y - 1, 3, 3, LIQ_BASE[0]);
      put(x - 1, y - 1, LIQ_TOP[0]);
    }
  }

  // --- Belts, scales, gates --------------------------------------------------------

  function beltSpan(cup: Cup) {
    const range = Math.abs(cup.conveyor?.range ?? 0);
    return { x0: Math.round(cup.baseX - range - cup.w / 2 - 6), x1: Math.round(cup.baseX + range + cup.w / 2 + 6) };
  }

  /** The housing is static; the belt's face and its rollers turn with the cup. */
  function paintBelts(isStatic: boolean) {
    for (const cup of world.cups) {
      if (!cup.conveyor) continue;
      const { x0, x1 } = beltSpan(cup);
      const y = cup.y;
      if (isStatic) {
        rect(x0 - 1, y - 1, x1 - x0 + 2, 14, INK);
        rect(x0, y, x1 - x0, 12, STEEL_DEEP);
        continue;
      }
      const offset = cup.x - cup.baseX;
      rect(x0, y, x1 - x0, 2, INK);
      for (let x = x0; x < x1; x++) {
        if ((((Math.floor(x - offset) % 6) + 6) % 6) === 0) put(x, y, STEEL_DARK);
      }
      for (let rx0 = x0 + 5; rx0 < x1 - 3; rx0 += 10) {
        disc(rx0, y + 7, 3.4, INK);
        disc(rx0, y + 7, 2.6, STEEL);
        const a = offset / 3;
        const ca = Math.cos(a) * 2.2;
        const sa = Math.sin(a) * 2.2;
        line(rx0 - ca, y + 7 - sa, rx0 + ca, y + 7 + sa, STEEL_DEEP);
        put(rx0, y + 7, INK);
      }
    }
  }

  function dialCentre(scale: World["scales"][number]) {
    return { x: scale.x, y: scale.y + 9 };
  }

  function paintScalesStatic() {
    for (const scale of world.scales) {
      for (const [ax, ay, bx, by] of cupWalls(scale)) {
        for (let y = Math.floor(Math.min(ay, by) - 2); y <= Math.max(ay, by) + 2; y++) {
          for (let x = Math.floor(Math.min(ax, bx) - 2); x <= Math.max(ax, bx) + 2; x++) {
            const d = segDist(x + 0.5, y + 0.5, ax, ay, bx, by);
            if (d <= CUP_WALL + 0.6) put(x, y, d > CUP_WALL - 0.4 ? INK : STEEL_LIGHT);
          }
        }
      }
      const dial = dialCentre(scale);
      rect(scale.x - 1, scale.y, 2, dial.y - scale.y - 5, STEEL_DARK);
    }
  }

  /**
   * The gate's hinge: the end away from its scale, so the opened gate stands
   * up clear of the scale and of the cup's mouth.
   */
  function gateHinge(gateIndex: number) {
    const gate = world.gates[gateIndex];
    const scale = world.scales.find((s) => s.gate === gateIndex);
    const sx = scale ? scale.x : gate.x2;
    const nearFirst = Math.abs(gate.x1 - sx) + Math.abs(gate.y1 - (scale?.y ?? 0)) < Math.abs(gate.x2 - sx) + Math.abs(gate.y2 - (scale?.y ?? 0));
    return nearFirst
      ? { hx: gate.x2, hy: gate.y2, fx: gate.x1, fy: gate.y1 }
      : { hx: gate.x1, hy: gate.y1, fx: gate.x2, fy: gate.y2 };
  }

  function paintScalesDynamic() {
    world.scales.forEach((scale, k) => {
      const dial = dialCentre(scale);
      const gateIndex = scale.gate;
      const gate = world.gates[gateIndex];
      // The linkage: a dashed rod from the dial down to the gate's hinge.
      if (gate) {
        const { hx, hy } = gateHinge(gateIndex);
        const lit = linkFlash[k] > 0 && !reduceMotion;
        const color = scale.tripped ? CORAL : INK;
        const shift = lit ? Math.floor(clock * 24) : 0;
        line(dial.x, dial.y + 6, dial.x, hy - 3, color, 2, shift, 0.7);
        line(dial.x, hy - 3, hx, hy - 3, color, 2, shift, 0.7);
      }
      disc(dial.x, dial.y, 6.4, INK);
      disc(dial.x, dial.y, 5.4, CREAM);
      put(dial.x + 4, dial.y - 1, CORAL);
      put(dial.x + 4, dial.y, CORAL);
      put(dial.x - 5, dial.y, INK);
      const f = clamp(scale.weight / scale.need, 0, 1);
      const a = -Math.PI / 2 + Math.PI * f;
      line(dial.x, dial.y, dial.x + Math.sin(a) * 4.4, dial.y - Math.cos(a) * 4.4, scale.tripped ? CORAL : INK);
      put(dial.x, dial.y, INK);
    });
  }

  function paintGates() {
    world.gates.forEach((gate, g) => {
      const { hx, hy, fx, fy } = gateHinge(g);
      const t = gate.open ? (reduceMotion ? 1 : easeOut(clamp(gateAge[g] / 0.38, 0, 1))) : 0;
      const vx = fx - hx;
      const vy = fy - hy;
      const angle = (vx < 0 ? 1 : -1) * (Math.PI / 2) * t;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const ex = hx + vx * ca - vy * sa;
      const ey = hy + vx * sa + vy * ca;
      const length = Math.hypot(ex - hx, ey - hy) || 1;
      for (let y = Math.floor(Math.min(hy, ey) - 4); y <= Math.max(hy, ey) + 4; y++) {
        for (let x = Math.floor(Math.min(hx, ex) - 4); x <= Math.max(hx, ex) + 4; x++) {
          const d = segDist(x + 0.5, y + 0.5, hx, hy, ex, ey);
          if (d > 2.6) continue;
          if (d > 1.6) put(x, y, INK);
          else {
            const along = ((x + 0.5 - hx) * (ex - hx) + (y + 0.5 - hy) * (ey - hy)) / length;
            put(x, y, Math.floor(along / 5) % 2 === 0 ? c32("#f4b942") : STEEL_DEEP);
          }
        }
      }
      disc(hx, hy, 2.6, INK);
      disc(hx, hy, 1.4, STEEL);
    });
  }

  const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

  // --- Blocks -----------------------------------------------------------------------

  function paintBlock(block: Block, index: number) {
    const angle = block.angle ?? 0;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    let hw = block.w / 2;
    let hh = block.h / 2;
    let cxB = block.x;
    let cyB = block.y;
    if (block.type === "jelly" && !reduceMotion && wobble[index] > 0.01) {
      const w = wobble[index] * Math.sin(wobbleAge[index] * 34);
      hw *= 1 + 0.08 * w;
      hh *= 1 - 0.2 * w;
      // Squash toward its own base, along its tilt.
      const drop = (block.h / 2 - hh) * 1;
      cxB -= s * drop;
      cyB += c * drop;
    }
    const soak = block.type === "sponge" ? clamp(soaked[index] / 26, 0, 1) : 0;
    const sponge = c32(mixHex("#f2c14e", "#8a6a2a", soak));
    const spongePore = c32(mixHex("#c99a2e", "#5e4518", soak));
    const spongeLight = c32(mixHex("#f8d77e", "#a48448", soak));
    const coilPulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(clock * 3.2);
    const coil = coilPulse > 0.66 ? c32("#ffd166") : coilPulse > 0.33 ? c32("#f4a259") : CORAL;
    const reach = Math.ceil(Math.hypot(hw, hh)) + 1;
    for (let y = Math.floor(cyB - reach); y <= cyB + reach; y++) {
      for (let x = Math.floor(cxB - reach); x <= cxB + reach; x++) {
        const dx = x + 0.5 - cxB;
        const dy = y + 0.5 - cyB;
        const u = dx * c + dy * s;
        const v = -dx * s + dy * c;
        const au = Math.abs(u);
        const av = Math.abs(v);
        if (au > hw || av > hh) continue;
        const edge = Math.min(hw - au, hh - av);
        let color: number;
        if (edge < 1) color = INK;
        else if (block.type === "ice") {
          if (v < -hh + 2.6) color = c32("#f7fcfd");
          else if (v > hh - 2.2 || u > hw - 2.2) color = c32("#b5d2dc");
          else if ((((u * 0.7 - v + 200) % 15) + 15) % 15 < 1.1) color = c32("#f2fafc");
          else color = c32("#dceef4");
        } else if (block.type === "jelly") {
          if (v < -hh + 2.4) color = c32("#c9eaa8");
          else if (v > hh - 2) color = c32("#6fa84d");
          else if (hash2(Math.floor(u + 99), Math.floor(v + 99)) < 0.05) color = c32("#c9eaa8");
          else color = c32("#9fd17a");
        } else if (block.type === "sponge") {
          if (v < -hh + 2) color = spongeLight;
          else if (hash2(Math.floor(u / 2 + 99), Math.floor(v / 2 + 99)) < 0.22 && edge > 1.6) color = spongePore;
          else color = sponge;
        } else {
          // The hot plate: a dark slab with a glowing coil.
          if (v < -hh + 1.6) color = STEEL_DARK;
          else if (au < hw - 3 && Math.abs(v - Math.sin(u * 0.85) * Math.min(1.6, hh - 2.6)) < 0.8) color = coil;
          else color = STEEL_DEEP;
        }
        put(x, y, color);
      }
    }
  }

  // --- Cups ---------------------------------------------------------------------

  function cupBox(cup: Cup) {
    const left = Math.round(cup.x - cup.w / 2);
    return { left, right: left + Math.round(cup.w) - 1, top: Math.round(cup.y - cup.h), bottom: Math.round(cup.y) - 1 };
  }

  function paintCupBack(cup: Cup) {
    const { left, right, top, bottom } = cupBox(cup);
    for (let y = top; y < bottom - 2; y++) {
      for (let x = left + 3; x <= right - 3; x++) if (bayer(x, y) < 0.22) blend(x, y, WHITE, 0.4);
    }
  }

  function paintCupFront(cup: Cup, index: number) {
    const { left, right, top, bottom } = cupBox(cup);
    const jiggle = !reduceMotion && rattle[index] > 0 ? (Math.floor(clock * 40) % 2 ? 1 : 0) : 0;
    const l = left + jiggle;
    const r = right + jiggle;
    // Glass walls: an ink edge and a pale pane, and a lip at the rim.
    for (let y = top; y <= bottom; y++) {
      put(l, y, INK);
      put(r, y, INK);
      blend(l + 1, y, WHITE, 0.55);
      blend(l + 2, y, WHITE, 0.3);
      blend(r - 1, y, WHITE, 0.55);
      blend(r - 2, y, WHITE, 0.3);
    }
    for (let x = l; x <= r; x++) {
      put(x, bottom, INK);
      blend(x, bottom - 1, WHITE, 0.5);
      blend(x, bottom - 2, WHITE, 0.25);
    }
    put(l - 1, top, INK);
    put(l + 1, top, INK);
    put(r + 1, top, INK);
    put(r - 1, top, INK);
    // A sheen down the glass.
    for (let y = top + 3; y < bottom - 5; y++) blend(l + 4, y, WHITE, 0.35);
    for (let y = top + 5; y < top + 12 && y < bottom - 5; y++) blend(l + 5, y, WHITE, 0.25);

    const order = cup.order;
    const inner = cup.w - CUP_WALL * 4;
    const bandRight = cup.x < WIDTH / 2;

    // The fill line at the amount needed, with a notch outside the wall.
    const needY = Math.round(cup.y - CUP_WALL * 2 - (order.need * AREA_PER_DROP) / inner);
    const lineY = Math.max(top + 2, needY);
    for (let x = l + 3; x <= r - 3; x++) if ((x - l) % 4 < 2) blend(x, lineY, INK, 0.75);
    const notchX = bandRight && order.milk !== undefined ? l - 1 : r + 1;
    const dir = notchX < l ? -1 : 1;
    put(notchX, lineY, INK);
    put(notchX + dir, lineY, INK);
    put(notchX + dir * 2, lineY, INK);
    put(notchX + dir * 2, lineY - 1, INK);
    put(notchX + dir * 2, lineY + 1, INK);

    // A two-tone band for a milk ratio: target split, tolerance notches, and a
    // pointer at the live share that fills in once it is within tolerance.
    if (order.milk !== undefined) {
      const bx = bandRight ? r + 3 : l - 6;
      const by0 = top + 2;
      const by1 = bottom;
      const span = by1 - by0;
      const split = Math.round(by0 + span * order.milk);
      rect(bx, by0, 4, span + 1, INK);
      for (let y = by0 + 1; y < by1; y++) {
        const c = y < split ? LIQ_BASE[3] : LIQ_BASE[0];
        put(bx + 1, y, c);
        put(bx + 2, y, c);
      }
      const tol = order.tol ?? 0.1;
      const t0 = Math.round(by0 + span * (order.milk - tol));
      const t1 = Math.round(by0 + span * (order.milk + tol));
      const outer = bandRight ? bx + 4 : bx - 1;
      put(outer, t0, INK);
      put(outer, t1, INK);
      const count = cup.tea + cup.milk;
      if (count > 0) {
        const share = cup.milk / count;
        const py = Math.round(by0 + span * share);
        const within = Math.abs(share - order.milk) <= tol + 1e-9;
        const tip = bandRight ? bx + 5 : bx - 2;
        const step = bandRight ? 1 : -1;
        for (let i = 0; i < 3; i++) {
          put(tip + step * i, py - i, INK);
          put(tip + step * i, py + i, INK);
          if (within) for (let j = -i + 1; j < i; j++) put(tip + step * i, py + j, CORAL);
        }
        put(tip + step * 3, py - 2, INK);
        put(tip + step * 3, py + 2, INK);
        for (let j = -2; j <= 2; j++) put(tip + step * 3, py + j, INK);
      }
    }

    // Pearl slots on a sticker near the rim.
    const pearlsWanted = order.pearls ?? 0;
    if (pearlsWanted > 0) {
      const width = pearlsWanted * 6 + 1;
      const sx = Math.round(cup.x - width / 2) + jiggle;
      const sy = top + 3;
      rect(sx - 1, sy - 1, width + 2, 8, INK);
      rect(sx, sy, width, 6, PAPER);
      for (let i = 0; i < pearlsWanted; i++) {
        const px = sx + 1 + i * 6;
        if (i < cup.pearls) {
          rect(px + 1, sy + 1, 3, 4, PEARL_DARK);
          rect(px, sy + 2, 5, 2, PEARL_DARK);
          put(px + 1, sy + 2, PEARL_SHINE);
        } else {
          put(px + 1, sy + 1, INK);
          put(px + 3, sy + 1, INK);
          put(px + 1, sy + 4, INK);
          put(px + 3, sy + 4, INK);
          put(px, sy + 2, INK);
          put(px, sy + 3, INK);
          put(px + 4, sy + 2, INK);
          put(px + 4, sy + 3, INK);
        }
      }
    }

    // An order met: a tick on a label, and a lid once the room is done.
    if (cupOk[index]) {
      const lx = l + 3;
      const ly = top + (pearlsWanted > 0 ? 12 : 3);
      rect(lx - 1, ly - 1, 11, 9, INK);
      rect(lx, ly, 9, 7, PAPER);
      grid(CHECK_GRID, lx + 1, ly + 1, { O: INK });
      if (world.status === "cleared") {
        const dome = Math.round(cup.w / 2) + 1;
        for (let i = 0; i < 4; i++) {
          const halfW = dome - [6, 3, 1, 0][i];
          rect(cup.x - halfW, top - 4 + i, halfW * 2, 1, i === 0 ? INK : LID);
          put(cup.x - halfW - 1, top - 4 + i, INK);
          put(cup.x + halfW, top - 4 + i, INK);
        }
        rect(cup.x - dome - 1, top, dome * 2 + 2, 1, INK);
        // A straw through the lid.
        for (let i = 0; i < 14; i++) {
          const x = cup.x + 4 + i * 0.4;
          const y = top - 4 - i;
          put(x - 1, y, INK);
          put(x, y, Math.floor(i / 3) % 2 ? STRIPE_WHITE : PINK);
          put(x + 1, y, Math.floor(i / 3) % 2 ? STRIPE_WHITE : PINK);
          put(x + 2, y, INK);
        }
      }
    }
  }

  // --- The liquid -----------------------------------------------------------------
  // Each frame the interpolated droplets are splatted onto a 2-unit grid; a
  // cell over the threshold is liquid. Tea and milk keep separate fields, so a
  // shared cell takes a quantised milk-tea blend; exposed tops get a lighter
  // surface line and puddles on the floor a duller tone.

  const fieldT = new Float32Array(GW * GH);
  const fieldM = new Float32Array(GW * GH);
  const fieldS = new Float32Array(GW * GH);
  const cellMask = new Uint8Array(GW * GH);
  const SPLAT_R = 2.8;
  const SPLAT_R2 = SPLAT_R * SPLAT_R;
  const THRESHOLD = 0.5;

  function splat(x: number, y: number, w0: number, milk: boolean, spilled: boolean) {
    const c0 = Math.max(0, Math.floor((x - SPLAT_R) / LC));
    const c1 = Math.min(GW - 1, Math.floor((x + SPLAT_R) / LC));
    const r0 = Math.max(0, Math.floor((y - SPLAT_R) / LC));
    const r1 = Math.min(GH - 1, Math.floor((y + SPLAT_R) / LC));
    for (let r = r0; r <= r1; r++) {
      const dy = (r + 0.5) * LC - y;
      for (let c = c0; c <= c1; c++) {
        const dx = (c + 0.5) * LC - x;
        const d2 = dx * dx + dy * dy;
        if (d2 >= SPLAT_R2) continue;
        const w = (1 - d2 / SPLAT_R2) * w0;
        const i = r * GW + c;
        if (milk) fieldM[i] += w;
        else fieldT[i] += w;
        if (spilled) fieldS[i] += w;
      }
    }
  }

  function paintLiquid() {
    fieldT.fill(0);
    fieldM.fill(0);
    fieldS.fill(0);
    const p = world.p;
    const n = world.count;
    const a = alpha;
    for (let i = 0; i < n; i++) {
      const flags = p.flags[i];
      if (flags & IN_PIPE) continue;
      const kind = p.kind[i];
      if (kind === PEARL_KIND) continue;
      const x = p.px[i] + (p.x[i] - p.px[i]) * a;
      const y = p.py[i] + (p.y[i] - p.py[i]) * a;
      const milk = kind === MILK;
      const spilled = (flags & SPILLED) !== 0;
      splat(x, y, 1, milk, spilled);
      // A fast droplet leaves a short streak, so a stream reads as a stream.
      const vx = p.vx[i];
      const vy = p.vy[i];
      if (vx * vx + vy * vy > 140 * 140) splat(x - vx * 0.012, y - vy * 0.012, 0.75, milk, spilled);
    }
    for (let i = 0; i < GW * GH; i++) {
      const total = fieldT[i] + fieldM[i];
      if (total < THRESHOLD) {
        cellMask[i] = 0;
        continue;
      }
      const share = fieldM[i] / total;
      const stepIndex = share < 0.17 ? 0 : share < 0.5 ? 1 : share < 0.83 ? 2 : 3;
      cellMask[i] = 1 + stepIndex + (fieldS[i] / total > 0.5 ? 4 : 0);
    }
    // Each cell is 2 × 2 room pixels: a lighter top row where it meets air
    // above, and a one-pixel outline on any side that meets the tiles, so
    // milk reads on pale tiles and a stream keeps its edges.
    const buf = D;
    for (let r = 0; r < GH; r++) {
      const row = r * GW;
      const y0 = r * LC + MT;
      for (let c = 0; c < GW; c++) {
        const m = cellMask[row + c];
        if (!m) continue;
        const k = (m - 1) & 3;
        const dull = m > 4;
        const up = r > 0 && cellMask[row + c - GW] !== 0;
        const down = r < GH - 1 && cellMask[row + c + GW] !== 0;
        const left = c > 0 && cellMask[row + c - 1] !== 0;
        const right = c < GW - 1 && cellMask[row + c + 1] !== 0;
        const base = dull ? LIQ_DULL[k] : LIQ_BASE[k];
        const edge = dull ? LIQ_DULL_EDGE[k] : LIQ_EDGE[k];
        const top = dull ? LIQ_DULL_TOP[k] : LIQ_TOP[k];
        let tl = base;
        let tr = base;
        let bl = base;
        let br = base;
        if (!down) {
          bl = edge;
          br = edge;
        } else if (!up) {
          bl = LIQ_SHADE[k];
          br = LIQ_SHADE[k];
        }
        // A one-cell column (a falling stream) keeps its colour on the left.
        if (!right) {
          tr = edge;
          br = edge;
        } else if (!left) {
          tl = edge;
          bl = edge;
        }
        if (!up) {
          tl = left || right ? top : base;
          tr = right ? top : tr;
        }
        const index = y0 * RW + c * LC + MX;
        buf[index] = tl;
        buf[index + 1] = tr;
        buf[index + RW] = bl;
        buf[index + RW + 1] = br;
      }
    }
    // Pearls: dark discs with a highlight.
    const pearlPal = { p: PEARL_DARK, h: PEARL_SHINE };
    for (let i = 0; i < n; i++) {
      if (p.kind[i] !== PEARL_KIND || p.flags[i] & IN_PIPE) continue;
      const x = p.px[i] + (p.x[i] - p.px[i]) * a;
      const y = p.py[i] + (p.y[i] - p.py[i]) * a;
      grid(PEARL_GRID, Math.round(x) - 3, Math.round(y) - 3, pearlPal);
    }
  }

  /** The first liquid row at or below `y` in a column, for ripples. */
  function surfaceAt(x: number, y: number, bottom: number) {
    const c = clamp(Math.floor(x / LC), 0, GW - 1);
    for (let r = clamp(Math.floor(y / LC), 0, GH - 1); r < Math.min(GH, bottom / LC); r++) {
      if (cellMask[r * GW + c]) return r * LC;
    }
    return -1;
  }

  // --- Straws ---------------------------------------------------------------------
  // A straw is rasterised once when it lands: an ink outline round a striped
  // pink-and-white body, with bellows where it bends. The draft is the same,
  // translucent, every frame.

  const strawDist = new Float32Array(RW * RH).fill(Infinity);
  const strawArc = new Float32Array(RW * RH);
  const strawBend = new Uint8Array(RW * RH);
  const touched: number[] = [];
  let strawIdx = new Int32Array(0);
  let strawCol = new Uint32Array(0);
  let strawOwner = new Int32Array(0);
  let strawEdge = new Uint8Array(0);
  let strawVersion = 0;
  let strawBuilt = -1;
  const STRAW_OUTER = 2.3;
  const STRAW_INNER = 1.3;

  /** Rasterises a polyline into `touched`, keeping the nearest segment per pixel. */
  function rasterLine(points: Array<[number, number]>) {
    let arc = 0;
    const bends: number[] = [];
    for (let i = 1; i < points.length - 1; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      const [cx, cy] = points[i + 1];
      const turn = Math.abs(Math.atan2(cy - by, cx - bx) - Math.atan2(by - ay, bx - ax));
      const wrapped = turn > Math.PI ? Math.PI * 2 - turn : turn;
      if (wrapped > 0.35) bends.push(i);
    }
    const arcs = [0];
    for (let i = 1; i < points.length; i++) arcs.push(arcs[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      const len = Math.sqrt(len2);
      const x0 = Math.floor(Math.min(ax, bx) - 3);
      const x1 = Math.ceil(Math.max(ax, bx) + 3);
      const y0 = Math.floor(Math.min(ay, by) - 3);
      const y1 = Math.ceil(Math.max(ay, by) + 3);
      for (let y = y0; y <= y1; y++) {
        const iy = y + MT;
        if (iy < 0 || iy >= RH) continue;
        for (let x = x0; x <= x1; x++) {
          const ix = x + MX;
          if (ix < 0 || ix >= RW) continue;
          const t = clamp(((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / len2, 0, 1);
          const d = Math.hypot(x + 0.5 - ax - t * dx, y + 0.5 - ay - t * dy);
          if (d > STRAW_OUTER) continue;
          const index = iy * RW + ix;
          if (strawDist[index] === Infinity) touched.push(index);
          if (d < strawDist[index]) {
            strawDist[index] = d;
            const s = arcs[i - 1] + t * len;
            strawArc[index] = s;
            let bend = 0;
            for (const b of bends) if (Math.abs(s - arcs[b]) < 3.5) bend = 1;
            strawBend[index] = bend;
          }
        }
      }
    }
    arc += arcs[arcs.length - 1];
    return arc;
  }

  function strawColor(index: number) {
    const d = strawDist[index];
    if (d > STRAW_INNER) return INK;
    const s = strawArc[index];
    if (strawBend[index]) return Math.floor(s * 1.2) % 2 ? PINK_DEEP : STRIPE_WHITE;
    return Math.floor(s / 3.5) % 2 ? STRIPE_WHITE : PINK;
  }

  function rebuildStraws() {
    const idx: number[] = [];
    const col: number[] = [];
    const own: number[] = [];
    const edge: number[] = [];
    for (const stroke of world.strokes) {
      touched.length = 0;
      rasterLine(stroke.points);
      for (const index of touched) {
        idx.push(index);
        col.push(strawColor(index));
        own.push(stroke.id);
        edge.push(strawDist[index] > STRAW_INNER ? 1 : 0);
        strawDist[index] = Infinity;
      }
    }
    strawIdx = Int32Array.from(idx);
    strawCol = Uint32Array.from(col);
    strawOwner = Int32Array.from(own);
    strawEdge = Uint8Array.from(edge);
    strawBuilt = strawVersion;
  }

  function paintStraws() {
    if (strawBuilt !== strawVersion) rebuildStraws();
    const hover = hoverId;
    for (let i = 0; i < strawIdx.length; i++) {
      D[strawIdx[i]] = hover >= 0 && strawOwner[i] === hover && strawEdge[i] ? CORAL : strawCol[i];
    }
  }

  function paintDraft() {
    const draft = world.draft;
    if (!draft || draft.length < 2) return;
    touched.length = 0;
    rasterLine(draft);
    target(D, RW, RH, 0, 0);
    for (const index of touched) {
      blend(index % RW, Math.floor(index / RW), strawColor(index), 0.62);
      strawDist[index] = Infinity;
    }
    target(D, RW, RH, MX, MT);
  }

  // --- Kettles and the hopper ---------------------------------------------------------

  function kettleSprite(kettle: Kettle) {
    return kettle.kind === MILK ? JUG_SPRITE : KETTLE_SPRITE;
  }

  /** Where a sprite-local point lands in the world, given the kettle's tip and tilt. */
  function spriteToWorld(sp: Sprite, kettle: Kettle, angle: number, lx: number, ly: number) {
    const mirror = kettle.vx < 0 ? -1 : 1;
    const ux = (lx - sp.px) * mirror;
    const uy = ly - sp.py;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    return { x: kettle.x + ux * ca - uy * sa, y: kettle.y + ux * sa + uy * ca };
  }

  function paintKettle(kettle: Kettle, k: number) {
    const sp = kettleSprite(kettle);
    const pal = kettle.kind === MILK ? JUG_PAL : KETTLE_PAL;
    const mirror = kettle.vx < 0;
    const angle = (mirror ? -1 : 1) * tilt[k];
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const level = kettle.count ? kettle.left / kettle.count : 0;
    const fillColor = kettle.kind === MILK ? LIQ_BASE[3] : LIQ_BASE[0];
    const glassRows = sp.glassBottom - sp.glassTop + 1;
    const filledFrom = sp.glassBottom + 1 - Math.round(level * glassRows);

    // The chain it hangs from, with the planning timer threaded on it.
    const handle = spriteToWorld(sp, kettle, angle, sp.hx, sp.hy);
    const waiting = !kettle.started && world.status === "waiting";
    const dialY = handle.y - 12;
    const chainTop = -MT + 2;
    for (let y = Math.floor(chainTop); y < handle.y; y++) {
      if (waiting && y > dialY - 8 && y < dialY + 8) continue;
      put(handle.x, y, (y & 1) === 0 ? STEEL_DARK : STEEL_LIGHT);
    }

    const reach = Math.ceil(Math.hypot(Math.max(sp.px, sp.w - sp.px), Math.max(sp.py, sp.h - sp.py))) + 1;
    const kx = Math.floor(kettle.x);
    const ky = Math.floor(kettle.y);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const ux = kx + dx + 0.5 - kettle.x;
        const uy = ky + dy + 0.5 - kettle.y;
        let lx = ux * ca + uy * sa;
        const ly = -ux * sa + uy * ca;
        if (mirror) lx = -lx;
        const gx = Math.floor(lx + sp.px);
        const gy = Math.floor(ly + sp.py);
        if (gx < 0 || gy < 0 || gx >= sp.w || gy >= sp.h) continue;
        const code = sp.code[gy * sp.w + gx];
        if (!code) continue;
        put(kx + dx, ky + dy, code === 8 ? (gy >= filledFrom ? fillColor : pal[8]) : pal[code]);
      }
    }

    if (waiting) {
      // A kitchen timer: a cream face whose coral wedge is the planning time left.
      const total = Math.max(0.001, kettle.delay);
      const frac = clamp((kettle.startAt - world.time) / total, 0, 1);
      const cx = handle.x;
      const cy = dialY;
      dialSpots[k] = { x: cx, y: cy, seconds: Math.max(0, Math.ceil(kettle.startAt - world.time - 1e-6)) };
      for (let y = Math.floor(cy - 8); y <= cy + 8; y++) {
        for (let x = Math.floor(cx - 8); x <= cx + 8; x++) {
          const ddx = x + 0.5 - cx;
          const ddy = y + 0.5 - cy;
          const d = Math.hypot(ddx, ddy);
          if (d > 7.6) continue;
          if (d > 6.5) {
            put(x, y, INK);
            continue;
          }
          let a = Math.atan2(ddx, -ddy);
          if (a < 0) a += Math.PI * 2;
          put(x, y, a <= frac * Math.PI * 2 ? CORAL : CREAM);
        }
      }
      rect(cx - 1, cy - 10, 3, 2, INK);
    } else {
      dialSpots[k] = null;
    }
  }

  function paintHopper() {
    const hopper = world.hopper;
    if (!hopper) return;
    const x = hopper.x;
    const y = hopper.y;
    for (let yy = Math.floor(-MT + 2); yy < y - 19; yy++) put(x, yy, (yy & 1) === 0 ? STEEL_DARK : STEEL_LIGHT);
    // A glass jar on a funnel, its lid, and the pearls it still holds.
    rect(x - 8, y - 18, 17, 13, INK);
    rect(x - 7, y - 17, 15, 11, c32("#e6f3f7"));
    rect(x - 9, y - 20, 19, 3, INK);
    rect(x - 8, y - 19, 17, 1, GOLD);
    for (let i = 0; i < 4; i++) {
      rect(x - 6 + i, y - 5 + i, 13 - i * 2, 1, INK);
    }
    rect(x - 5, y - 5, 11, 1, c32("#e6f3f7"));
    for (let i = 0; i < hopper.left; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const px = x - 6 + col * 4;
      const py = y - 9 - row * 4;
      rect(px, py, 3, 3, PEARL_DARK);
      put(px, py, PEARL_SHINE);
    }
    blend(x - 6, y - 16, WHITE, 0.6);
    blend(x - 6, y - 15, WHITE, 0.6);
    // The flap under the mouth swings down when the pour starts.
    const open = hopperOpen > 0 ? (reduceMotion ? 1 : easeOut(clamp(hopperOpen / 0.3, 0, 1))) : 0;
    const angle = open * 1.35;
    const fx = x - 3 + Math.cos(angle) * 6;
    const fy = y - 1 + Math.sin(angle) * 6;
    line(x - 3, y - 1, fx, fy, INK);
    line(x - 3, y, fx, fy + 1, STEEL);
  }

  // --- Effects ----------------------------------------------------------------------

  const MAX_FX = 420;
  const fxX = new Float32Array(MAX_FX);
  const fxY = new Float32Array(MAX_FX);
  const fxVX = new Float32Array(MAX_FX);
  const fxVY = new Float32Array(MAX_FX);
  const fxLife = new Float32Array(MAX_FX);
  const fxMax = new Float32Array(MAX_FX);
  const fxKind = new Uint8Array(MAX_FX);
  const fxCol = new Uint32Array(MAX_FX);
  let fxCount = 0;
  const FX_DROP = 0;
  const FX_STEAM = 1;
  const FX_RIPPLE = 2;
  const FX_SPARKLE = 3;
  const FX_DUST = 4;

  function spawnFx(kind: number, x: number, y: number, vx: number, vy: number, life: number, color: number) {
    if (fxCount >= MAX_FX) return;
    const i = fxCount++;
    fxKind[i] = kind;
    fxX[i] = x;
    fxY[i] = y;
    fxVX[i] = vx;
    fxVY[i] = vy;
    fxLife[i] = life;
    fxMax[i] = life;
    fxCol[i] = color;
  }

  function stepFx(dt: number) {
    for (let i = fxCount - 1; i >= 0; i--) {
      fxLife[i] -= dt;
      if (fxLife[i] <= 0) {
        const j = --fxCount;
        fxKind[i] = fxKind[j];
        fxX[i] = fxX[j];
        fxY[i] = fxY[j];
        fxVX[i] = fxVX[j];
        fxVY[i] = fxVY[j];
        fxLife[i] = fxLife[j];
        fxMax[i] = fxMax[j];
        fxCol[i] = fxCol[j];
        continue;
      }
      const kind = fxKind[i];
      if (kind === FX_DROP) fxVY[i] += 520 * dt;
      else if (kind === FX_STEAM) {
        fxVX[i] += Math.sin((fxY[i] + i) * 0.3) * 20 * dt;
      } else if (kind === FX_DUST) fxVY[i] += 30 * dt;
      fxX[i] += fxVX[i] * dt;
      fxY[i] += fxVY[i] * dt;
      if (kind === FX_DROP && fxY[i] > HEIGHT - 0.5) {
        fxY[i] = HEIGHT - 0.5;
        fxVY[i] = 0;
        fxVX[i] *= 0.5;
      }
    }
  }

  function paintFx() {
    for (let i = 0; i < fxCount; i++) {
      const kind = fxKind[i];
      const x = fxX[i];
      const y = fxY[i];
      const t = fxLife[i] / fxMax[i];
      if (kind === FX_DROP) put(x, y, fxCol[i]);
      else if (kind === FX_STEAM || kind === FX_DUST) {
        const r = 1 + 2.2 * (1 - t);
        for (let yy = Math.floor(y - r); yy <= y + r; yy++) {
          for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
            const dx = xx + 0.5 - x;
            const dy = yy + 0.5 - y;
            if (dx * dx + dy * dy > r * r) continue;
            if (bayer(xx + 64, yy + 64) < t * 0.9) blend(xx, yy, fxCol[i], 0.75);
          }
        }
      } else if (kind === FX_RIPPLE) {
        const r = Math.round(1 + 5 * (1 - t));
        blend(x - r, y, WHITE, 0.8 * t);
        blend(x + r, y, WHITE, 0.8 * t);
        blend(x - r + 1, y, WHITE, 0.5 * t);
        blend(x + r - 1, y, WHITE, 0.5 * t);
      } else if (kind === FX_SPARKLE) {
        const arm = t > 0.5 ? 2 : 1;
        put(x, y, fxCol[i]);
        for (let k = 1; k <= arm; k++) {
          put(x + k, y, fxCol[i]);
          put(x - k, y, fxCol[i]);
          put(x, y + k, fxCol[i]);
          put(x, y - k, fxCol[i]);
        }
      }
    }
  }

  // Wind: cells drifting through each fan's region, faster and longer for a stronger fan.
  const WIND_MAX = 160;
  const windX = new Float32Array(WIND_MAX);
  const windY = new Float32Array(WIND_MAX);
  const windFan = new Int8Array(WIND_MAX);
  let windCount = 0;

  function seedWind() {
    windCount = 0;
    world.fans.forEach((fan, f) => {
      const count = clamp(Math.round((fan.w * fan.h) / 260), 6, 48);
      for (let i = 0; i < count && windCount < WIND_MAX; i++) {
        windX[windCount] = fan.x + hash2(f * 13 + 1, i) * fan.w;
        windY[windCount] = fan.y + hash2(f * 13 + 2, i) * fan.h;
        windFan[windCount] = f;
        windCount++;
      }
    });
  }

  function stepWind(dt: number) {
    for (let i = 0; i < windCount; i++) {
      const fan = world.fans[windFan[i]];
      const strength = Math.hypot(fan.fx, fan.fy) || 1;
      const speed = 30 + (strength / 700) * 60;
      windX[i] += (fan.fx / strength) * speed * dt;
      windY[i] += (fan.fy / strength) * speed * dt;
      if (windX[i] < fan.x) windX[i] += fan.w;
      if (windX[i] > fan.x + fan.w) windX[i] -= fan.w;
      if (windY[i] < fan.y) windY[i] += fan.h;
      if (windY[i] > fan.y + fan.h) windY[i] -= fan.h;
    }
  }

  function paintWind() {
    if (reduceMotion) return;
    for (let i = 0; i < windCount; i++) {
      const fan = world.fans[windFan[i]];
      const strength = Math.hypot(fan.fx, fan.fy) || 1;
      const dx = fan.fx / strength;
      const dy = fan.fy / strength;
      const length = 2 + Math.round(clamp(strength / 700, 0.4, 1.6) * 4);
      for (let k = 0; k < length; k++) blend(windX[i] - dx * k, windY[i] - dy * k, CREAM, 0.55 * (1 - k / (length + 1)));
    }
  }

  function paintFanBlades() {
    world.fans.forEach((fan, f) => {
      const { cx, cy, strength } = fanFrame(fan);
      const spin = reduceMotion ? 0.4 : clock * (6 + strength / 120) + f;
      for (let y = Math.floor(cy - 6); y <= cy + 6; y++) {
        for (let x = Math.floor(cx - 6); x <= cx + 6; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.hypot(dx, dy);
          if (d > 6) continue;
          if (d > 5.2) {
            put(x, y, INK);
            continue;
          }
          let a = Math.atan2(dy, dx) - spin;
          a = ((a % (Math.PI * 2 / 3)) + Math.PI * 2) % (Math.PI * 2 / 3);
          if (d < 1.6) put(x, y, INK);
          else if (a < 0.75) put(x, y, d > 3.4 ? STEEL_LIGHT : STEEL);
        }
      }
      // A grille: two bars across the face.
      for (let i = -5; i <= 5; i += 2) {
        blend(cx + i, cy - 3, INK, 0.35);
        blend(cx + i, cy + 2, INK, 0.35);
      }
    });
  }

  function paintNoDrawFlash() {
    world.noDraw.forEach((zone, i) => {
      const f = noDrawFlash[i] ?? 0;
      if (f <= 0) return;
      hatch(zone.x, zone.y, zone.w, zone.h, CORAL, 0.75 * clamp(f / 0.5, 0, 1));
    });
  }

  // --- Per-room visual state -----------------------------------------------------------

  let tilt: number[] = [];
  let wobble: number[] = [];
  let wobbleAge: number[] = [];
  let soaked: number[] = [];
  let gateAge: number[] = [];
  let linkFlash: number[] = [];
  let rattle: number[] = [];
  let cupOk: boolean[] = [];
  let noDrawFlash: number[] = [];
  let dialSpots: Array<{ x: number; y: number; seconds: number } | null> = [];
  let hopperOpen = 0;
  let steamClock = 0;
  let lastSfx: Record<string, number> = {};

  function resetRoomVisuals() {
    tilt = world.kettles.map(() => 0);
    wobble = world.blocks.map(() => 0);
    wobbleAge = world.blocks.map(() => 0);
    soaked = world.blocks.map(() => 0);
    gateAge = world.gates.map(() => 0);
    linkFlash = world.scales.map(() => 0);
    rattle = world.cups.map(() => 0);
    cupOk = world.cups.map(() => false);
    noDrawFlash = world.noDraw.map(() => 0);
    dialSpots = world.kettles.map(() => null);
    hopperOpen = 0;
    fxCount = 0;
    blipCount = 0;
    lastSfx = {};
    hoverId = -1;
    strawVersion++;
    seedWind();
  }

  /** A sound at most every `gap` seconds of play, keyed by name. */
  function paced(name: string, gap: number) {
    const at = lastSfx[name] ?? -10;
    if (clock - at < gap) return false;
    lastSfx[name] = clock;
    return true;
  }

  function stepVisuals(dt: number) {
    const ease = reduceMotion ? 1 : Math.min(1, dt * 7);
    world.kettles.forEach((kettle, k) => {
      const pouring = kettle.started && kettle.left > 0;
      tilt[k] += ((pouring ? TILT : 0) - tilt[k]) * ease;
    });
    for (let b = 0; b < wobble.length; b++) {
      wobble[b] *= Math.exp(-dt * 5);
      wobbleAge[b] += dt;
    }
    for (let g = 0; g < gateAge.length; g++) if (world.gates[g].open) gateAge[g] += dt;
    for (let k = 0; k < linkFlash.length; k++) linkFlash[k] = Math.max(0, linkFlash[k] - dt);
    for (let c = 0; c < rattle.length; c++) rattle[c] = Math.max(0, rattle[c] - dt);
    for (let i = 0; i < noDrawFlash.length; i++) noDrawFlash[i] = Math.max(0, noDrawFlash[i] - dt);
    if (hopperOpen > 0) hopperOpen += dt;
    stepFx(dt);
    stepBlips(dt);
    if (!reduceMotion) {
      stepWind(dt);
      // The kettle's on: a wisp from each lid while it waits.
      steamClock += dt;
      if (steamClock > 0.55) {
        steamClock = 0;
        world.kettles.forEach((kettle, k) => {
          if (kettle.kind === MILK || kettle.left <= 0) return;
          const sp = kettleSprite(kettle);
          const angle = (kettle.vx < 0 ? -1 : 1) * tilt[k];
          const lid = spriteToWorld(sp, kettle, angle, 12.5, 6);
          spawnFx(FX_STEAM, lid.x, lid.y - 2, (Math.random() - 0.5) * 6, -16, 0.9, CREAM);
        });
      }
    }
    shake = Math.max(0, shake - dt / 0.35);
  }

  // --- Events from the engine ------------------------------------------------------------

  function handleEvents() {
    const e = world.events;
    for (let i = 0; i < e.count; i++) {
      const type = e.type[i];
      const x = e.x[i];
      const y = e.y[i];
      const a = e.a[i];
      const b = e.b[i];
      if (type === EVENTS.POUR_START) {
        if (!pourAnnounced) {
          pourAnnounced = true;
          liveMessage = "The kettle is pouring.";
          if (caption && captionLife === INTRO_SECONDS) caption = null;
        }
        syncHud();
      } else if (type === EVENTS.INTO_CUP) {
        const cup = world.cups[a];
        if (cup && paced("drop", 0.07)) sfxDrop(clamp(b / cup.order.full, 0, 1));
        if (cup && !reduceMotion) {
          const surface = surfaceAt(x, cup.y - cup.h, cup.y);
          if (surface >= 0) spawnFx(FX_RIPPLE, x, surface, 0, 0, 0.32, WHITE);
        }
      } else if (type === EVENTS.SPLASH) {
        if (paced("splash", 0.16)) sfxSplash();
        const color = b === MILK ? LIQ_BASE[3] : b === PEARL_KIND ? PEARL_DARK : LIQ_BASE[0];
        const count = reduceMotion ? 2 : 5;
        for (let k = 0; k < count; k++) {
          spawnFx(FX_DROP, x, HEIGHT - 1, (Math.random() - 0.5) * 90, -50 - Math.random() * 80, 0.45 + Math.random() * 0.2, color);
        }
      } else if (type === EVENTS.ABSORBED) {
        if (a >= 0) soaked[a] = (soaked[a] ?? 0) + 1;
        if (paced("sponge", 0.18)) sfxSponge();
      } else if (type === EVENTS.BOILED) {
        if (paced("sizzle", 0.2)) sfxSizzle();
        if (!reduceMotion) {
          spawnFx(FX_STEAM, x, y - 3, (Math.random() - 0.5) * 10, -22, 0.8, CREAM);
          spawnFx(FX_STEAM, x + 2, y - 5, (Math.random() - 0.5) * 10, -16, 1, CREAM);
        }
      } else if (type === EVENTS.BOUNCE) {
        if (paced("boing", 0.12)) sfxBoing();
        let best = -1;
        let bestD = Infinity;
        world.blocks.forEach((block, index) => {
          if (block.type !== "jelly") return;
          const d = Math.hypot(block.x - x, block.y - y);
          if (d < bestD) {
            bestD = d;
            best = index;
          }
        });
        if (best >= 0) {
          wobble[best] = Math.min(1, wobble[best] + 0.6);
          wobbleAge[best] = 0;
        }
      } else if (type === EVENTS.PIPE) {
        addBlip(a, b);
        if (paced("pipe", 0.14)) sfxPipe();
      } else if (type === EVENTS.GATE_OPEN) {
        sfxGate();
        if (a >= 0) gateAge[a] = 0;
        if (b >= 0) linkFlash[b] = 1.2;
        if (!reduceMotion) {
          for (let k = 0; k < 6; k++) spawnFx(FX_DUST, x + (Math.random() - 0.5) * 30, y, (Math.random() - 0.5) * 20, -10, 0.6, STEEL_LIGHT);
          shake = Math.max(shake, 0.35);
        }
        liveMessage = "The scale tipped and the gate opened.";
      } else if (type === EVENTS.PEARL_IN_CUP) {
        if (paced("pearl", 0.06)) sfxPlop(b);
        if (a >= 0) rattle[a] = 0.16;
      } else if (type === EVENTS.PEARLS_DROP) {
        hopperOpen = 0.0001;
      }
    }
  }

  // --- The room, start to finish -------------------------------------------------------

  function phaseFor(r: Room) {
    if (r.remix) return "rush";
    return r.page >= 5 ? "rush" : r.page >= 3 ? "steady" : "opening";
  }

  function labelFor(index: number, r: Room) {
    return r.remix ? `after hours ${index + 1}` : `room ${pad2(index + 1)}`;
  }

  function showCaption(line: string, life: number) {
    captionCount += 1;
    caption = { id: captionCount, line };
    captionAge = 0;
    captionLife = life;
  }

  /** A fresh world for the run's current room: straws cleared, kettles full. */
  function enterRoom() {
    const previousPage = room ? pageIndex() : -1;
    const wasRemix = !!room?.remix;
    room = currentRoom(run);
    world = createWorld(room);
    accumulator = 0;
    alpha = 1;
    pourAnnounced = false;
    verdict = null;
    resetRoomVisuals();
    cancelGesture();
    penDrawing = false;
    roomLabel = labelFor(run.index, room);
    roomName = room.name;
    bakeRoom();
    if (previousPage !== pageIndex() || wasRemix !== !!room.remix) bakeKitchen();
    syncHud();
  }

  function announceRoom() {
    if (!tipVisible) showCaption(room.name, INTRO_SECONDS);
    liveMessage = describeRoom(room);
  }

  function settleRoom(result: RoomResult) {
    phase = "result";
    resultAge = 0;
    accumulator = 0;
    cancelGesture();
    penDrawing = false;
    setPour(0);
    lastCleared = result.cleared;
    teaSpilled += result.spilled;
    recordResult(run, result);
    score = run.total;
    syncHud();
    if (result.cleared) {
      roomsCleared += 1;
      starsTotal += result.stars;
      if (result.stars === 3) threeStarRooms += 1;
      recordSpillReach(run.reached);
      verdictCount += 1;
      verdict = { id: verdictCount, stars: result.stars, points: result.points };
      sfxRoomClear(result.stars);
      if (result.stars === 3 && !reduceMotion) {
        for (const cup of world.cups) {
          for (let k = 0; k < 10; k++) {
            spawnFx(FX_SPARKLE, cup.x + (Math.random() - 0.5) * (cup.w + 16), cup.y - cup.h - 4 + (Math.random() - 0.5) * 22, 0, -6, 0.5 + Math.random() * 0.4, CREAM);
          }
        }
      }
      caption = null;
      liveMessage = `Room cleared with ${result.stars} ${result.stars === 1 ? "star" : "stars"}, ${result.points} points.`;
    } else {
      lives = run.lives;
      livesPulse += 1;
      sfxRoomFail();
      if (!reduceMotion) shake = 1;
      showCaption(room.hint, Infinity);
      const left = run.lives > 0 ? `${run.lives} ${run.lives === 1 ? "pearl" : "pearls"} left` : "no pearls left";
      liveMessage = `Spilled, and a pearl lost, ${left}. Hint: ${room.hint}.`;
    }
  }

  function advance() {
    if (lastCleared) setMusicPhase(phaseFor(currentRoom(run)));
    const keepHint = !lastCleared ? caption : null;
    enterRoom();
    phase = "play";
    syncHud();
    if (keepHint) {
      // A retry keeps the hint up until the pour starts.
      caption = keepHint;
      liveMessage = `Try again: ${room.name}.`;
    } else announceRoom();
    focusPlayfieldIfIdle();
  }

  function trySkip() {
    if (phase !== "result" || run.over || paused || resultAge < SKIP_AFTER) return;
    advance();
  }

  /** Whether the engine has judged the room (read fresh, never narrowed). */
  function settled(): boolean {
    const status: string = world.status;
    return status === "cleared" || status === "failed";
  }

  /** Steps the simulation on a fixed clock and catches the room settling. */
  function simulate(dt: number) {
    if (settled()) return;
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      step(world, STEP);
      if (world.events.count) handleEvents();
      if (settled()) {
        alpha = 1;
        settleRoom(world.result ?? judgeRoom(world));
        return;
      }
    }
    alpha = accumulator / STEP;
    let flowing = 0;
    for (const kettle of world.kettles) if (kettle.started && kettle.left > 0) flowing++;
    setPour(Math.min(1, flowing * 0.6));
  }

  function syncHud() {
    strawNow = Math.round(strawLeft(world));
    strawBudget = world.budget;
    const live = phase === "play" && world.status !== "cleared" && world.status !== "failed";
    canPour = live && world.status === "waiting";
    canUndo = live && world.strokes.length > 0;
    const judged = judgeRoom(world);
    previewStars = world.status === "waiting" ? 0 : judged.stars;
    cupOk = judged.cups.map((cup) => cup.ok);
  }

  // --- Drawing a frame -------------------------------------------------------------

  function paintDynamic() {
    D.fill(0);
    target(D, RW, RH, MX, MT);
    paintWind();
    paintBelts(false);
    world.blocks.forEach((block, index) => {
      if (block.type !== "ice") paintBlock(block, index);
    });
    paintBlips();
    paintScalesDynamic();
    paintGates();
    paintFanBlades();
    for (const cup of world.cups) paintCupBack(cup);
    paintLiquid();
    world.cups.forEach((cup, index) => paintCupFront(cup, index));
    paintStraws();
    paintDraft();
    paintHopper();
    world.kettles.forEach((kettle, k) => paintKettle(kettle, k));
    paintFx();
    paintNoDrawFlash();
  }

  function draw() {
    if (!ctx || !roomCanvas) return;
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = WALL_HEX;
    ctx.fillRect(0, 0, viewW, viewH);
    if (kitchenCanvas) ctx.drawImage(kitchenCanvas, 0, 0, kitchenCols * SC, kitchenRows * SC);
    const jolt = shake > 0 && !reduceMotion ? Math.round((Math.random() - 0.5) * 6 * shake) : 0;
    const x = ox + jolt;
    const y = oy;
    ctx.drawImage(roomCanvas, x, y, RW * S, RH * S);
    paintDynamic();
    if (dynCtx && dynImage && dynCanvas) {
      new Uint32Array(dynImage.data.buffer).set(D);
      dynCtx.putImageData(dynImage, 0, 0);
      ctx.drawImage(dynCanvas, x, y, RW * S, RH * S);
    }
    drawGlow(x + MX * S, y + MT * S);
    drawOverlays(x + MX * S, y + MT * S);
  }

  /** The arcade's one soft effect: the hot plate's coil lights the tiles above it. */
  function drawGlow(left: number, top: number) {
    if (!ctx) return;
    const hot = world.blocks.filter((block) => block.type === "hot");
    if (!hot.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(clock * 3.2);
    for (const block of hot) {
      const cx = left + block.x * S;
      const cy = top + block.y * S;
      const radius = (block.w * 0.55 + 10) * S;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(255, 128, 64, ${0.07 + 0.04 * pulse})`);
      gradient.addColorStop(1, "rgba(255, 128, 64, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  }

  /** Screen-space marks: timer figures, the keyboard pen, the straw-left chip. */
  function drawOverlays(left: number, top: number) {
    if (!ctx) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = dialFont;
    ctx.fillStyle = "#1a1a1a";
    for (const spot of dialSpots) {
      if (!spot) continue;
      ctx.fillText(String(spot.seconds), Math.round(left + spot.x * S), Math.round(top + spot.y * S) + 0.5);
    }

    const drawing = !!world.draft && (gesture?.drawing || penDrawing);
    if (penVisible && phase === "play") {
      const px = Math.round(left + pen.x * S);
      const py = Math.round(top + pen.y * S);
      const blocked = penBlocked > 0;
      for (const [color, width] of [
        ["#fdf8f3", 4],
        [blocked ? "#c9462f" : "#1a1a1a", 2],
      ] as const) {
        ctx.fillStyle = color;
        const w = width;
        ctx.fillRect(px - 10, py - w / 2, 6, w);
        ctx.fillRect(px + 4, py - w / 2, 6, w);
        ctx.fillRect(px - w / 2, py - 10, w, 6);
        ctx.fillRect(px - w / 2, py + 4, w, 6);
      }
    }

    if (drawing && world.draft) {
      const end = world.draft[world.draft.length - 1];
      const ex = left + end[0] * S;
      const ey = top + end[1] * S;
      const out = strawLeft(world) < 0.5;
      // Where the pen is now; a dashed ghost if the straw stopped short of it.
      let anchorX = ex;
      let anchorY = ey;
      if (gesture && gesture.drawing) {
        anchorX = gesture.x;
        anchorY = gesture.y;
      } else if (penDrawing) {
        anchorX = left + pen.x * S;
        anchorY = top + pen.y * S;
      }
      if (out && Math.hypot(anchorX - ex, anchorY - ey) > 6) {
        ctx.strokeStyle = "rgba(201, 70, 47, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(anchorX, anchorY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const touch = gesture?.touch ?? false;
      if (touch || out) {
        // The finger hides the draft's end, so a ring marks it.
        ctx.strokeStyle = "#fdf8f3";
        ctx.lineWidth = 4;
        ctx.strokeRect(Math.round(ex) - 6, Math.round(ey) - 6, 12, 12);
        ctx.strokeStyle = out ? "#c9462f" : "#1a1a1a";
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(ex) - 6, Math.round(ey) - 6, 12, 12);
      }
      const text = String(Math.round(strawLeft(world)));
      ctx.font = chipFont;
      const width = Math.max(28, Math.ceil(ctx.measureText(text).width + 14));
      const cx = touch ? anchorX : anchorX + 14 + width / 2;
      const cy = touch ? anchorY - 64 : anchorY - 22;
      const boxX = Math.round(clamp(cx - width / 2, 4, viewW - width - 4));
      const boxY = Math.round(clamp(cy - 11, 4, viewH - 26));
      ctx.fillStyle = "#2b2320";
      ctx.fillRect(boxX, boxY, width, 22);
      if (touch) ctx.fillRect(Math.round(clamp(cx, boxX + 4, boxX + width - 6)) - 1, boxY + 22, 2, 8);
      ctx.fillStyle = out ? "#f18272" : "#fdf8f3";
      ctx.fillText(text, boxX + width / 2, boxY + 11.5);
    }
    ctx.restore();
  }

  // --- Input: pointer -----------------------------------------------------------------

  interface Gesture {
    id: number;
    touch: boolean;
    sx: number;
    sy: number;
    x: number;
    y: number;
    over: number;
    drawing: boolean;
    moved: boolean;
  }
  let gesture: Gesture | null = null;
  let hoverId = -1;
  let overRoom = false;
  let lastTick = 0;
  let tickLength = 0;

  const worldX = (clientX: number) => (clientX - rx) / S;
  const worldY = (clientY: number) => (clientY - ry) / S;

  function playable() {
    return phase === "play" && !paused && !gameOver && world.status !== "cleared" && world.status !== "failed";
  }

  function flashNoDraw(x: number, y: number) {
    let best = -1;
    let bestD = Infinity;
    world.noDraw.forEach((zone, i) => {
      const dx = Math.max(zone.x - x, 0, x - zone.x - zone.w);
      const dy = Math.max(zone.y - y, 0, y - zone.y - zone.h);
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0 && bestD < 24) noDrawFlash[best] = 0.6;
  }

  function outOfStraw() {
    strawPulse += 1;
    if (paced("empty", 1.2)) {
      liveMessage = "Out of straw.";
      showCaption("out of straw", NOTE_SECONDS);
    }
  }

  /** Starts a straw at a world point; says why if it can't. */
  function startDraft(x: number, y: number) {
    if (beginStroke(world, x, y)) {
      lastTick = clock;
      tickLength = 0;
      return true;
    }
    if (strawLeft(world) < MIN_SEGMENT) outOfStraw();
    else flashNoDraw(x, y);
    return false;
  }

  function extendTo(x: number, y: number) {
    const draft = world.draft;
    if (!draft) return;
    const [lx, ly] = draft[draft.length - 1];
    const before = world.draftLength;
    if (extendStroke(world, x, y)) {
      tickLength += world.draftLength - before;
      if (tickLength >= 8 && clock - lastTick > 0.045) {
        tickLength = 0;
        lastTick = clock;
        sfxDraw();
      }
      return;
    }
    const cx = clamp(x, 0, WIDTH);
    const cy = clamp(y, 0, HEIGHT);
    if (Math.hypot(cx - lx, cy - ly) < MIN_SEGMENT) return;
    if (strawLeft(world) < 0.5) {
      if (paced("stopped", 0.8)) strawPulse += 1;
    } else flashNoDraw(cx, cy);
  }

  /**
   * Lays the straw down. The engine only takes points MIN_SEGMENT apart, so
   * a release just short of that would lose the last few units under the
   * finger; it is carried on to a full segment toward the release instead.
   */
  function finishDraft(x?: number, y?: number) {
    const draft = world.draft;
    if (!draft) return;
    if (x !== undefined && y !== undefined) {
      const [lx, ly] = draft[draft.length - 1];
      const cx = clamp(x, 0, WIDTH);
      const cy = clamp(y, 0, HEIGHT);
      const d = Math.hypot(cx - lx, cy - ly);
      if (d >= MIN_SEGMENT) extendTo(cx, cy);
      else if (d >= MIN_SEGMENT / 2) {
        // A hair over, so rounding never leaves it just short of a segment.
        const reach = MIN_SEGMENT + 0.01;
        extendStroke(world, lx + ((cx - lx) / d) * reach, ly + ((cy - ly) / d) * reach);
      }
    }
    if (commitStroke(world) >= 0) {
      strawVersion++;
      tipVisible = false;
      syncHud();
    }
  }

  function crumbs(points: Array<[number, number]>) {
    if (reduceMotion) return;
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 6);
      for (let k = 0; k < n; k++) {
        const t = k / n;
        spawnFx(FX_DROP, ax + (bx - ax) * t, ay + (by - ay) * t, (Math.random() - 0.5) * 30, -20 - Math.random() * 30, 0.4, k % 2 ? PINK : STRIPE_WHITE);
      }
    }
  }

  function removeById(id: number) {
    const stroke = world.strokes.find((s) => s.id === id);
    if (!stroke || !removeStroke(world, id)) return false;
    crumbs(stroke.points);
    sfxErase();
    strawVersion++;
    if (hoverId === id) hoverId = -1;
    syncHud();
    return true;
  }

  function cancelGesture() {
    if (gesture?.drawing) cancelStroke(world);
    gesture = null;
  }

  function onStageDown(event: PointerEvent) {
    if (phase === "result") {
      if (event.button === 0 || event.pointerType !== "mouse") {
        event.preventDefault();
        trySkip();
      }
      return;
    }
    if (!playable()) return;
    const x = worldX(event.clientX);
    const y = worldY(event.clientY);
    if (x < -12 || x > WIDTH + 12 || y < -12 || y > HEIGHT + 12) return;
    event.preventDefault();
    penVisible = false;
    const touch = event.pointerType !== "mouse";
    if (event.button === 2) {
      const id = strokeAt(world, x, y, 10);
      if (id >= 0) removeById(id);
      return;
    }
    if (!touch && event.button !== 0) return;
    if (gesture || penDrawing) return;
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety; up and cancel still end the stroke.
    }
    const over = strokeAt(world, x, y, touch ? 11 : 7);
    gesture = { id: event.pointerId, touch, sx: event.clientX, sy: event.clientY, x: event.clientX, y: event.clientY, over, drawing: false, moved: false };
    if (over < 0) gesture.drawing = startDraft(x, y);
  }

  function onStageMove(event: PointerEvent) {
    if (!gesture) {
      if (event.pointerType !== "mouse" || !playable()) {
        overRoom = false;
        return;
      }
      const x = worldX(event.clientX);
      const y = worldY(event.clientY);
      overRoom = x >= 0 && x <= WIDTH && y >= 0 && y <= HEIGHT;
      hoverId = overRoom ? strokeAt(world, x, y, 7) : -1;
      return;
    }
    if (event.pointerId !== gesture.id) return;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    if (!gesture.moved && Math.hypot(event.clientX - gesture.sx, event.clientY - gesture.sy) > 8) gesture.moved = true;
    if (!playable()) return;
    if (!gesture.drawing && gesture.over >= 0 && gesture.moved) {
      // A drag that started on a straw draws a new one from there.
      gesture.drawing = startDraft(worldX(gesture.sx), worldY(gesture.sy));
      gesture.over = -1;
    }
    if (!gesture.drawing) return;
    const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    if (samples.length) for (const sample of samples) extendTo(worldX(sample.clientX), worldY(sample.clientY));
    else extendTo(worldX(event.clientX), worldY(event.clientY));
  }

  function onStageUp(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const g = gesture;
    gesture = null;
    try {
      stage.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
    if (!playable()) {
      cancelStroke(world);
      return;
    }
    if (g.drawing) finishDraft(worldX(event.clientX), worldY(event.clientY));
    else if (g.over >= 0 && !g.moved) removeById(g.over);
  }

  function onStageCancel(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.id) return;
    cancelGesture();
  }

  function onStageLeave() {
    if (!gesture) {
      hoverId = -1;
      overRoom = false;
    }
  }

  // --- Input: keys -------------------------------------------------------------------

  const held = { left: false, right: false, up: false, down: false };
  const pen = { x: WIDTH / 2, y: HEIGHT / 2 };
  let penVisible = false;
  let penDrawing = false;
  let penBlocked = 0;
  let heldFor = 0;

  const ARROWS: Record<string, keyof typeof held> = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
  };

  function onKey(event: KeyboardEvent) {
    if (gameOver || paused || phase === "start") return;
    const key = event.key;
    if ((key === " " || key === "Enter") && isOnControl(event)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (phase === "result") {
      if (key === " " || key === "Enter" || ARROWS[key]) event.preventDefault();
      trySkip();
      return;
    }
    const arrow = ARROWS[key];
    if (arrow) {
      event.preventDefault();
      held[arrow] = true;
      penVisible = true;
      return;
    }
    if (key === " ") {
      event.preventDefault();
      penVisible = true;
      if (!playable() || gesture || penDrawing) return;
      penDrawing = startDraft(pen.x, pen.y);
      if (!penDrawing) penBlocked = 0.4;
      return;
    }
    if (key === "Enter") {
      event.preventDefault();
      pour();
      return;
    }
    const lower = key.toLowerCase();
    if (lower === "z" || key === "Backspace") {
      event.preventDefault();
      undo();
    } else if (lower === "c") clearAll();
    else if (key === "Delete") {
      event.preventDefault();
      penVisible = true;
      const id = strokeAt(world, pen.x, pen.y, 8);
      if (id >= 0 && playable()) removeById(id);
      else penBlocked = 0.4;
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    const arrow = ARROWS[event.key];
    if (arrow) held[arrow] = false;
    if (event.key === " " && penDrawing) {
      penDrawing = false;
      if (playable()) finishDraft(pen.x, pen.y);
      else cancelStroke(world);
    }
  }

  /** The keyboard pen: arrows move a crosshair, faster the longer they are held. */
  function stepPen(dt: number) {
    penBlocked = Math.max(0, penBlocked - dt);
    const dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    if (!dx && !dy) {
      heldFor = 0;
      return;
    }
    heldFor += dt;
    const speed = 45 + 200 * Math.min(1, heldFor / 0.7);
    const norm = dx && dy ? Math.SQRT1_2 : 1;
    pen.x = clamp(pen.x + dx * speed * norm * dt, 0, WIDTH);
    pen.y = clamp(pen.y + dy * speed * norm * dt, 0, HEIGHT);
    hoverId = strokeAt(world, pen.x, pen.y, 8);
    if (penDrawing && playable()) extendTo(pen.x, pen.y);
  }

  function releaseAll() {
    held.left = held.right = held.up = held.down = false;
    if (penDrawing) {
      penDrawing = false;
      cancelStroke(world);
    }
    cancelGesture();
  }

  // --- Actions -----------------------------------------------------------------------

  function pour() {
    if (!playable() || world.status !== "waiting") return;
    if (pourNow(world)) {
      liveMessage = "Pouring early.";
      syncHud();
    }
  }

  function undo() {
    if (!playable()) return;
    if (world.draft) {
      cancelGesture();
      penDrawing = false;
      cancelStroke(world);
      return;
    }
    const last = world.strokes[world.strokes.length - 1];
    if (last) removeById(last.id);
  }

  function clearAll() {
    if (!playable() || !world.strokes.length) return;
    for (const stroke of world.strokes) crumbs(stroke.points);
    clearStrokes(world);
    sfxErase();
    strawVersion++;
    syncHud();
  }

  /** Bar buttons keep focus for keyboard users, and hand it back after a click. */
  function barAction(event: MouseEvent, action: () => void) {
    action();
    if (event.detail > 0) focusPlayfield();
  }

  // --- Pause, the start card, and the end -------------------------------------------------

  async function pauseGame() {
    if (gameOver || paused || phase === "start") return;
    paused = true;
    releaseAll();
    setPour(0);
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

  function togglePause() {
    if (paused) resumeGame();
    else void pauseGame();
  }

  function focusPlayfield() {
    playfield?.focus({ preventScroll: true });
  }

  function focusPlayfieldIfIdle() {
    if (document.activeElement instanceof HTMLButtonElement && playScope?.contains(document.activeElement)) return;
    focusPlayfield();
  }

  function onPlayfieldTab(event: KeyboardEvent) {
    if (event.key !== "Tab" || !event.shiftKey || document.activeElement !== playfield) return;
    const controls = playScope?.querySelectorAll<HTMLElement>("button:not([disabled])");
    const lastControl = controls?.[controls.length - 1];
    if (!lastControl) return;
    event.preventDefault();
    lastControl.focus();
  }

  async function endGame() {
    if (gameOver) return;
    gameOver = true;
    phase = "over";
    releaseAll();
    setPour(0);
    const result = concludeRun("spill", score);
    localBest = result.best;
    newBest = result.newBest;
    liveMessage = `Game over. Final score ${score}.`;
    await tick();
    slip?.focus();
  }

  /** A fresh run from a checkpoint, into the countdown. */
  function newGame(start: number) {
    run = newRun({ start, reached, seed: 1 + Math.floor(Math.random() * 1_000_000) });
    score = run.total;
    lives = run.lives;
    livesPulse = 0;
    roomsCleared = 0;
    starsTotal = 0;
    threeStarRooms = 0;
    teaSpilled = 0;
    newBest = false;
    caption = null;
    verdict = null;
    enterRoom();
    phase = "countdown";
    countdown = COUNTDOWN_SECONDS;
    countdownElapsed = 0;
    goVisible = false;
    last = 0;
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
  }

  /** The start card if a checkpoint has been earned, else straight to the countdown. */
  async function openRun() {
    reached = readSpillReach();
    checkpoints = availableCheckpoints(reached);
    if (checkpoints.length > 1) {
      run = newRun({ start: checkpoints[checkpoints.length - 1], reached });
      enterRoom();
      phase = "start";
      liveMessage = "Choose where to start.";
      await tick();
      startCard?.querySelector<HTMLButtonElement>(".boba-btn:not(.secondary)")?.focus();
    } else newGame(0);
  }

  function chooseStart(index: number) {
    sfxBlip();
    newGame(index);
    focusPlayfield();
  }

  function beginRun() {
    countdown = 0;
    goVisible = true;
    timers.later(() => (goVisible = false), 620);
    setMusicPhase(phaseFor(room));
    startMusic();
    sfxStart();
    phase = "play";
    syncHud();
    announceRoom();
    focusPlayfieldIfIdle();
  }

  function restart() {
    stopMusic();
    timers.clear();
    releaseAll();
    paused = false;
    gameOver = false;
    void openRun();
  }

  // --- The loop ----------------------------------------------------------------------

  function frame(timestamp: number) {
    if (!active) return;
    if (!last) last = timestamp;
    const rawDt = (timestamp - last) / 1000;
    last = timestamp;
    const dt = Math.min(rawDt, 0.05);

    if (!paused) {
      clock += dt;
      if (phase === "countdown") {
        const next = stepCountdown(countdownElapsed, countdown, Math.min(rawDt, 0.25));
        countdownElapsed = next.elapsed;
        if (next.beep) {
          countdown = next.count;
          sfxCountdown(countdown);
        }
        if (next.done) beginRun();
      } else if (phase === "play") {
        stepPen(dt);
        simulate(dt);
      } else if (phase === "result") {
        resultAge += dt;
        if (run.over) {
          if (resultAge >= GAME_OVER_SECONDS) void endGame();
        } else if (resultAge >= (lastCleared ? CLEAR_SECONDS : FAIL_SECONDS)) advance();
      }
      if (phase !== "start") stepVisuals(dt);
      if (caption) {
        captionAge += dt;
        if (captionAge >= captionLife) caption = null;
        // A retry's hint goes once the tea is coming.
        else if (captionLife === Infinity && phase === "play" && world.status !== "waiting") caption = null;
      }
      hudClock += dt;
      if (hudClock >= 0.1) {
        hudClock = 0;
        syncHud();
      }
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  // --- Sizing and lifecycle -------------------------------------------------------------

  function layout() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    ctx = fitCanvas(canvas, viewW, viewH);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const hudBottom = hudRow ? hudRow.getBoundingClientRect().bottom : 72;
    hudBottomPx = hudBottom;
    const barTop = barEl ? barEl.getBoundingClientRect().top : viewH;
    const top = hudBottom + CAPTION_SPACE;
    const availH = Math.max(160, barTop - 8 - top);
    const availW = viewW - (viewW < 560 ? 0 : 48);
    S = Math.max(0.5, Math.floor(Math.min(availW / RW, availH / RH) * 16) / 16);
    ox = Math.round(((viewW - RW * S) / 2) * dpr) / dpr;
    oy = Math.round((top + (availH - RH * S) / 2) * dpr) / dpr;
    rx = ox + MX * S;
    ry = oy + MT * S;
    captionTop = Math.max(hudBottom + 6, oy - CAPTION_SPACE + 6);
    verdictTop = ry + HEIGHT * S * 0.3;
    roomCenterX = rx + (WIDTH * S) / 2;
    dynCanvas ??= makeCanvas(RW, RH);
    dynCtx ??= dynCanvas.getContext("2d");
    dynImage ??= new ImageData(RW, RH);
    bakeKitchen();
    draw();
  }

  onMount(() => {
    dialFont = arcadeFont(Math.max(10, Math.round(11 * Math.min(1.2, S / 2))), 700);
    chipFont = arcadeFont(12, 500);
    const unmountShell = mountShell({
      isOver: () => gameOver,
      isPaused: () => paused || phase === "start",
      pause: () => void pauseGame(),
      togglePause,
      playScope: () => playScope,
      onKey,
      onResize: layout,
      observe: hudRow,
      onReduceMotion: (reduce) => {
        reduceMotion = reduce;
        if (roomCanvas) bakeRoom();
      },
    });
    const onTab = (event: KeyboardEvent) => onPlayfieldTab(event);
    window.addEventListener("keydown", onTab);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);

    tick().then(() => {
      if (!active) return;
      void openRun();
      layout();
      dialFont = arcadeFont(Math.max(10, Math.round(10 + S * 1.2)), 700);
      tipVisible = firstVisit("spill");
      raf = requestAnimationFrame(frame);
    });

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      timers.clear();
      setPour(0);
      stopMusic();
      window.removeEventListener("keydown", onTab);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      unmountShell();
    };
  });

  $: strawFraction = strawBudget > 0 ? clamp(strawNow / strawBudget, 0, 1) : 0;
</script>

<div
  bind:this={stage}
  class="boba-stage sp-stage"
  class:is-room={overRoom && hoverId < 0}
  class:is-straw={hoverId >= 0 && !gesture}
  on:pointerdown={onStageDown}
  on:pointermove={onStageMove}
  on:pointerup={onStageUp}
  on:pointercancel={onStageCancel}
  on:pointerleave={onStageLeave}
  on:contextmenu|preventDefault
  aria-hidden="true"
></div>
<canvas bind:this={canvas} class="boba-canvas" aria-hidden="true"></canvas>

<div bind:this={playScope} class="sp-play">
  <!-- Where focus rests in play: not a button, so Space stays the pen key. -->
  <div bind:this={playfield} class="sr-only" tabindex="-1" role="group" aria-label="Spill playfield"></div>
  <header class="boba-hud boba-ui is-bare" aria-label="Spill status">
    <div bind:this={hudRow} class="boba-hud-row">
      <div class="boba-ticket boba-ticket-start boba-riso" style="--tilt: -1.1deg">
        <span class="boba-ticket-icon" aria-hidden="true">
          <PixelIcon grid={MENU_ICONS.spill.grid} palette={MENU_ICONS.spill.palette} px={3} />
        </span>
        <span class="boba-big" aria-label="Score {score}">{String(score).padStart(4, "0")}</span>
      </div>

      <div class="boba-ticket boba-ticket-center boba-riso sp-room-ticket" style="--tilt: 0.8deg">
        <span class="boba-stack">
          <span class="boba-meta">{roomLabel}</span>
          <span class="boba-phase sp-room-name">{roomName}</span>
        </span>
        <span class="sp-pips" role="img" aria-label="{previewStars} of 3 stars so far">
          {#each [0, 1, 2] as index}
            <span class="sp-pip" class:is-on={index < previewStars}>
              <PixelIcon grid={STAR} palette={index < previewStars ? STAR_ON : STAR_OFF} px={2} />
            </span>
          {/each}
        </span>
      </div>

      <div class="boba-ticket boba-ticket-end boba-riso" style="--tilt: -0.6deg">
        {#key strawPulse}
          <span
            class="sp-meter"
            class:is-out={strawNow <= 0}
            class:is-hit={strawPulse > 0}
            role="img"
            aria-label="{strawNow} units of straw left"
          >
            <svg class="sp-meter-straw" viewBox="0 0 60 10" aria-hidden="true" focusable="false">
              <defs>
                <pattern id="sp-stripes" width="6" height="10" patternUnits="userSpaceOnUse" patternTransform="skewX(-35)">
                  <rect width="3" height="10" fill="#ff5277" />
                  <rect x="3" width="3" height="10" fill="#fdf8f3" />
                </pattern>
              </defs>
              <rect class="sp-meter-ghost" x="1" y="2" width="58" height="6" rx="3" />
              {#if strawFraction > 0}
                <rect class="sp-meter-body" x="1" y="2" width={Math.max(6, 58 * strawFraction)} height="6" rx="3" />
              {/if}
            </svg>
            <span class="sp-meter-figure" aria-hidden="true">{strawNow}</span>
          </span>
        {/key}
        <Pearls left={lives} total={START_LIVES} pulse={livesPulse} />
        <HudButtons {paused} disabled={phase === "start"} on:pause={togglePause} />
      </div>
    </div>

    {#if tipVisible && !paused && phase !== "start"}
      <div class="boba-tip" role="note" aria-label="How to play">
        <span>draw a straw to steer the tea into the cup</span>
      </div>
    {/if}
  </header>

  <!-- The same line goes to the live region, so this copy is hidden. -->
  {#if caption}
    {#key caption.id}
      <p class="sp-caption boba-ui" style="top: {captionTop}px" aria-hidden="true">{caption.line}</p>
    {/key}
  {/if}

  {#if verdict}
    {#key verdict.id}
      <div class="sp-verdict boba-ui boba-riso is-small" style="top: {verdictTop}px; left: {roomCenterX}px" aria-hidden="true">
        <span class="sp-verdict-stars">
          {#each [0, 1, 2] as index}
            <span class="sp-verdict-star" class:is-on={index < verdict.stars} style="--delay: {index * STAR_STAGGER}s">
              <PixelIcon grid={STAR} palette={index < verdict.stars ? STAR_ON : STAR_OFF} px={4} />
            </span>
          {/each}
        </span>
        <span class="boba-phase sp-verdict-points">{verdict.points} points</span>
      </div>
    {/key}
  {/if}

  <div bind:this={barEl} class="sp-bar boba-ui">
    <button
      type="button"
      class="boba-btn sp-bar-btn"
      style="--lean: -0.6deg"
      disabled={!canPour}
      aria-keyshortcuts="Enter"
      on:click={(event) => barAction(event, pour)}
    >
      Pour
      <kbd aria-hidden="true">Enter</kbd>
    </button>
    <button
      type="button"
      class="boba-btn secondary sp-bar-btn"
      style="--lean: 0.5deg"
      disabled={!canUndo}
      aria-keyshortcuts="Z"
      on:click={(event) => barAction(event, undo)}
    >
      Undo
      <kbd aria-hidden="true">Z</kbd>
    </button>
    <button
      type="button"
      class="boba-btn secondary sp-bar-btn"
      style="--lean: -0.4deg"
      disabled={!canUndo}
      aria-keyshortcuts="C"
      on:click={(event) => barAction(event, clearAll)}
    >
      Clear
      <kbd aria-hidden="true">C</kbd>
    </button>
  </div>
</div>

{#if phase === "start"}
  <div class="boba-scrim boba-ui" role="dialog" aria-modal="true" aria-labelledby="sp-start-title">
    <div bind:this={startCard} class="boba-card boba-riso boba-pause-card" tabindex="-1">
      <h2 id="sp-start-title" class="boba-title">start from</h2>
      <p class="boba-deck">Skipped rooms are scored at par.</p>
      <div class="boba-actions is-start">
        {#each checkpoints as index, i}
          <button
            type="button"
            class="boba-btn"
            class:secondary={i !== checkpoints.length - 1}
            on:click={() => chooseStart(index)}
          >
            Room {index + 1}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

{#if countdown > 0 && phase === "countdown"}
  <Countdown value={countdown} caption="kettle's on" goCaption="pour" />
{:else if goVisible}
  <Countdown value={0} caption="kettle's on" goCaption="pour" />
{/if}

{#if paused && !gameOver}
  <PauseCard bind:this={pauseCard} deck="The kettle is holding its pour." on:resume={resumeGame} on:menu={toMenu} on:exit={exit} />
{/if}

{#if gameOver}
  <ResultsSlip
    bind:this={slip}
    game="spill"
    title="last drop"
    deck={roomsCleared === 0
      ? "Not a drop made it."
      : `${roomsCleared} ${roomsCleared === 1 ? "room" : "rooms"} poured before the pearls ran out.`}
    {score}
    unit="points"
    {newBest}
    stats={[
      { label: "rooms cleared", value: roomsCleared },
      { label: "stars", value: starsTotal },
      { label: "three-star rooms", value: threeStarRooms },
      { label: "tea spilled", value: teaSpilled },
      { label: "personal best", value: localBest },
    ]}
    on:restart={restart}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>

<style>
  .sp-play {
    display: contents;
  }

  /* The kitchen wall shows in both themes, so the site never peeks through. */
  .sp-stage {
    background: #a68f77;
  }

  .sp-stage.is-room {
    cursor: crosshair;
  }

  .sp-stage.is-straw {
    cursor: pointer;
  }

  .boba-hud.is-bare::before {
    content: none;
  }

  .sp-room-ticket {
    gap: var(--space-4);
  }

  .sp-room-name {
    font-family: var(--font-ui);
    font-style: normal;
    font-weight: 500;
  }

  .sp-pips {
    display: inline-flex;
    gap: var(--space-1);
    color: var(--b-line);
  }

  .sp-pip:not(.is-on) {
    opacity: 0.45;
  }

  /* --- The straw meter: a drawn straw that shortens as it is spent --- */

  .sp-meter {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1-5);
  }

  .sp-meter.is-hit {
    animation: boba-shake var(--motion-slow) var(--ease-standard);
  }

  .sp-meter-straw {
    width: 3.75rem;
    height: 0.625rem;
    overflow: visible;
  }

  .sp-meter-ghost {
    fill: none;
    stroke: var(--b-muted);
    stroke-width: 1;
    stroke-dasharray: 2 2;
  }

  .sp-meter-body {
    fill: url(#sp-stripes);
    stroke: var(--b-line);
    stroke-width: 1.4;
  }

  .sp-meter-figure {
    min-width: 2.5ch;
    color: var(--b-strong);
    font-size: 0.95rem;
    font-variant-numeric: lining-nums tabular-nums;
    line-height: 1.2;
    text-align: right;
  }

  .sp-meter.is-out .sp-meter-figure {
    color: var(--b-accent);
    font-weight: 500;
  }

  /* --- Caption chip: one line, in the strip above the room --- */

  .sp-caption {
    position: fixed;
    left: 50%;
    z-index: calc(var(--layer-overlay) + 3);
    width: max-content;
    max-width: min(34rem, calc(100vw - var(--space-8)));
    margin: 0;
    padding: var(--space-1-5) var(--space-3);
    color: var(--b-strong);
    background: var(--b-raised);
    border: 1px solid var(--b-rule);
    border-radius: var(--radius-inline);
    box-shadow: var(--shadow-popover);
    font-family: var(--font-ui);
    font-size: 0.9375rem;
    font-style: italic;
    font-weight: 400;
    line-height: 1.4;
    text-align: center;
    text-wrap: balance;
    pointer-events: none;
    transform: translateX(-50%);
    animation: sp-caption-in var(--motion-slow) var(--ease-emphasized) both;
  }

  :global(.dark) .sp-caption {
    box-shadow: var(--shadow-popover-dark);
  }

  @keyframes sp-caption-in {
    from {
      opacity: 0;
      transform: translate(-50%, 6px);
    }
  }

  /* --- The verdict: stars landing one at a time, and the points --- */

  .sp-verdict {
    position: fixed;
    z-index: calc(var(--layer-overlay) + 3);
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    pointer-events: none;
    transform: translate(-50%, -50%);
  }

  .sp-verdict-stars {
    display: inline-flex;
    gap: var(--space-2);
    color: var(--b-line);
  }

  .sp-verdict-star {
    display: inline-grid;
    animation: sp-land 360ms var(--ease-emphasized) var(--delay) both;
  }

  .sp-verdict-star:not(.is-on) {
    opacity: 0.4;
    animation: none;
  }

  .sp-verdict-points {
    font-family: var(--font-ui);
  }

  @keyframes sp-land {
    from {
      opacity: 0;
      transform: translateY(-18px) rotate(-12deg) scale(1.3);
    }
    70% {
      opacity: 1;
      transform: translateY(2px) scale(1.08, 0.9);
    }
  }

  /* --- The bottom bar: thumb-sized, clear of the home indicator --- */

  .sp-bar {
    position: fixed;
    inset: auto 0 0;
    z-index: calc(var(--layer-overlay) + 3);
    display: flex;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4) max(var(--space-4), env(safe-area-inset-bottom));
    pointer-events: none;
  }

  .sp-bar-btn {
    min-width: 6rem;
    pointer-events: auto;
  }

  @media (hover: none) and (pointer: coarse) {
    .sp-bar-btn {
      min-width: 6.5rem;
      min-height: 3rem;
      font-size: 0.9375rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sp-caption,
    .sp-verdict-star,
    .sp-meter.is-hit {
      animation: none;
    }
  }

  @media (max-width: 640px) {
    .sp-room-ticket {
      gap: var(--space-3);
    }

    .sp-meter-straw {
      width: 2.5rem;
    }

    .sp-caption {
      font-size: 0.875rem;
    }

    .sp-bar {
      gap: var(--space-2);
      padding-inline: var(--space-3);
    }

    .sp-bar-btn {
      flex: 1;
      min-width: 0;
    }
  }
</style>
