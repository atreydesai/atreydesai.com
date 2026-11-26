<script lang="ts">
  import { createBackdrop } from "#lib/arcade/scenery/live.ts";
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { get } from "svelte/store";

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
  } from "#lib/sfx.ts";
  import { COUNTDOWN_SECONDS, stepCountdown } from "#lib/arcade/countdown.js";
  import {
    AFTER_HOURS,
    CUP_WALL,
    EVENTS,
    HEIGHT,
    IN_PIPE,
    MILK,
    MIN_SEGMENT,
    PEARL as PEARL_KIND,
    PIPE_MOUTH,
    ROOMS,
    SPILLED,
    STEP,
    WIDTH,
    beginStroke,
    cancelStroke,
    cleanProgress,
    clearStrokes,
    commitStroke,
    createWorld,
    cupWalls,
    describeRoom,
    extendStroke,
    judgeRoom,
    nextRoom,
    pourNow,
    progressSummary,
    progressTotal,
    recordRoomResult,
    removeStroke,
    roomAt,
    shareLines,
    step,
    strawLeft,
    strokeAt,
    unlockedRooms,
  } from "#lib/arcade/spill-engine.js";
  import type { Progress, Room, RoomResult, World } from "#lib/arcade/spill-engine.js";
  import {
    ACCENT,
    CREAM as CREAM_HEX,
    ICON_AUDIO_PAL,
    ICON_LEVELS,
    ICON_LOCK,
    INK as INK_HEX,
    LID as LID_HEX,
    MENU_ICONS,
    NOTE_BACK,
    PEARL as PEARL_HEX,
    STRAW_PINK,
    arcadeFont,
    fitCanvas,
  } from "#lib/arcade/art.ts";
  import { createCoach } from "#lib/arcade/core/coach.ts";
  import { hexToRgb, mixHex } from "#lib/arcade/core/color.ts";
  import { bayer } from "#lib/arcade/core/dither.ts";
  import { chalkPath, drawGhost, drawSpotlight, type FocusBox } from "#lib/arcade/core/ghost.ts";
  import { createFrameLoop, every } from "#lib/arcade/core/loop.ts";
  import { clamp } from "#lib/arcade/core/math.ts";
  import { hash2 } from "#lib/arcade/core/rng.ts";
  import { readSpillProgress, writeSpillProgress } from "#lib/arcade/scores.ts";
  import { DIGITS, GAUGE_CUT, GLYPHS, LABEL_ROWS, WORDS, gaugeFit, gaugeLayout, topLine, tubeColumns } from "#lib/arcade/spill-gauge.js";
  import {
    LESSONS,
    LOW_SHARE,
    ROUTE_ROOM,
    aim,
    chooseSide,
    continuable as offersContinue,
    createHolds,
    createSpot,
    fillLineY,
    ghostRoute,
    holds,
    inItsPart,
    keepClear,
    knownFrom,
    mayOffer,
    planningLesson,
    resultLesson,
    roomFrame,
    routeVerdict,
    sidesFor,
    wordedFor,
  } from "#lib/arcade/spill-lessons.js";
  import type { Cue, Keep, Lesson } from "#lib/arcade/spill-lessons.js";
  import { arcadeExpert } from "#lib/boba.ts";
  import { arcadeExits, concludeRun, createTimers, isOnControl, mountShell } from "#lib/arcade/shell.ts";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import Coach from "./Coach.svelte";
  import Countdown from "./Countdown.svelte";
  import ExpertTag from "./ExpertTag.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";

  // Spill: a kettle pours, and the player draws straws to steer the tea into
  // the cup. Every rule and the fluid itself live in spill-engine.js; this
  // file paints the shop's back kitchen around the room, draws what the engine
  // simulates, and turns pointer and keys into strokes.

  const { exit, toMenu } = arcadeExits(createEventDispatcher<{ close: null; menu: null }>());
  /** Expert is read once, as the game opens, and kept: its rooms, its progress, its board. */
  const expert = get(arcadeExpert);
  const mode = expert ? "expert" : "normal";
  /** The last authored room: clearing it signs the board and opens after hours. */
  const LAST_ROOM = ROOMS.length - 1;

  /**
   * idle: no room started yet (the level select is up over the next room);
   * countdown, play, and result (the verdict is in, the tea still moves);
   * done: the closing-time slip after the last room.
   */
  type Phase = "idle" | "countdown" | "play" | "result" | "done";
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
  /**
   * A short, wide screen (a phone on its side): the controls stand in a
   * cabinet beside the room, with the caption over them, so the room has the
   * screen's whole height. The same query is in the styles below.
   */
  const SIDE_QUERY = "(max-height: 540px) and (min-aspect-ratio: 5/4)";
  /** How far a kettle tips while it pours. */
  const TILT = 0.5;
  const PIPE_TRANSIT = 0.3;

  // --- Timing ------------------------------------------------------------------

  const CLEAR_SECONDS = 2.1;
  const FAIL_SECONDS = 2.8;
  const SKIP_AFTER = 0.6;
  const INTRO_SECONDS = 4;
  const STAR_STAGGER = 0.12;
  /** The reach ring shows below this share, and is at full strength by LOW_SHARE. */
  const RING_SHARE = 0.6;
  /** Seconds the gauge shakes when straw is refused for want of straw. */
  const GAUGE_SHAKE = 0.36;
  /** Rooms to a page: the level select keeps a page's rooms side by side. */
  const ROOM_COLUMNS = 3;

  // --- Colour ---------------------------------------------------------------------
  // The kitchen has no light mode: it is painted the same in both themes, and
  // only the HTML on top (tickets, chips, buttons) follows the theme. Pixels
  // are packed as one Uint32 each, in the byte order ImageData keeps; the
  // mixing is the core's (each mix here stays between its two colours), and
  // the shared palette comes from art.ts.

  const pack = (r: number, g: number, b: number, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  const c32 = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    return pack(r, g, b);
  };
  const mix32 = (a: string, b: string, t: number) => c32(mixHex(a, b, t));

  const INK = c32(INK_HEX);
  const CREAM = c32(CREAM_HEX);
  const PAPER = c32("#fbf2e8");
  const CORAL = c32(ACCENT);
  const WHITE = c32("#ffffff");
  const STEEL = c32("#9aa3a8");
  const STEEL_LIGHT = c32("#c9d0d4");
  const STEEL_DARK = c32("#6f777c");
  const STEEL_DEEP = c32("#3a3f44");
  /** The hole a control is set into, in the counter or the cabinet. */
  const SOCKET = c32(mixHex("#3a3f44", INK_HEX, 0.45));
  const PINK = c32(STRAW_PINK);
  const PINK_DEEP = c32("#c93a5e");
  const STRIPE_WHITE = c32(CREAM_HEX);
  const PEARL_DARK = c32(PEARL_HEX);
  const PEARL_SHINE = c32("#8a6a5a");
  const LID = c32(LID_HEX);
  /** The star's gold: warmer than the arcade's NOTE_GOLD, so it stays the spill's own. */
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

  /** Sixteen quiet tile colours, one per page of rooms, so progress is felt. */
  const TILE_TINTS = [
    "#a9bcb2", "#a7b9c9", "#b6b0c4", "#c2aca7", "#b7a9b8", "#9aa7b5",
    "#b3bfa6", "#a3b7bd", "#c4b59f", "#abb3c8", "#c6bf9f", "#c0a9b3",
    "#cbbfac", "#a8b1a2", "#b8aa9c", "#8f9aab",
  ];
  /** The kitchen's back wall, from OrderUp's family but a step dimmer. */
  const WALL_HEX = "#a68f77";
  const WAINSCOT_HEX = "#7b604f";
  const SOFFIT_HEX = "#3a2a26";
  const BEAM_HEX = "#4f3a33";
  const WOOD_HEX = "#5e3d2a";
  const FLOOR_HEX = ["#4a3c35", "#56473e"];
  /** The window slit: the day passing over the pages, then night after hours. */
  const SKIES = [
    { top: "#cfe3ea", low: "#f5e6d3", sun: "#fff6d8", night: false },
    { top: "#8fb9de", low: "#cfe3ea", sun: "#fff6d8", night: false },
    { top: "#a9c4d9", low: "#f5e6d3", sun: "#ffd166", night: false },
    { top: "#c68098", low: "#ffd166", sun: "#ffd166", night: false },
    { top: "#3b2a52", low: "#c86a5a", sun: "#e85d4c", night: false },
    { top: "#141a2e", low: "#3b2a52", sun: "#fdf8f3", night: true },
  ];

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
  const LOCK_PAL = { L: "currentColor" };

  const PEARL_GRID = ["..ppp..", ".ppppp.", "pphpppp", "phhpppp", "ppppppp", ".ppppp.", "..ppp.."];
  const CHECK_GRID = ["......O", ".....OO", "O...OO.", "OO.OO..", ".OOO...", "..O...."];

  // --- State -------------------------------------------------------------------

  let phase: Phase = "idle";
  let paused = false;
  let liveMessage = "Spill is starting.";
  let localBest = 0;
  let newBest = false;
  let countdown = 0;
  let countdownElapsed = 0;
  let goVisible = false;

  // Progress lives on the device; the score is every room's best points.
  let progress: Progress = cleanProgress(null);
  let levelIndex = 0;
  let remixSeed = 1;
  let afterHoursCleared = 0;
  let levelsOpen = false;
  /** A room has been started this visit, so the level select can close back to it. */
  let roomStarted = false;
  let musicStarted = false;
  /** The slip has been shown for this clear of the last room, so the result waits for Next. */
  let holdResult = false;
  let focusedTile = 0;

  // HUD readouts, refreshed about ten times a second (the gauge as it changes).
  let roomLabel = "room 01";
  let roomName = "";
  let previewStars = 0;
  let canPour = false;
  let canClear = false;
  let canNext = false;
  let strawBudget = 1;
  let strawUsed = 0;
  let draftUsed = 0;
  let strawSpent: number[] = [];
  /** Real seconds the gauge has left to shake (a straw refused for want of straw). */
  let gaugeShake = 0;
  let lowAnnounced = false;
  let outAnnounced = false;

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

  let room: Room = roomAt(0, 1, expert);
  let world: World = createWorld(room);
  let resultAge = 0;
  let lastCleared = false;
  let accumulator = 0;
  let alpha = 1;
  let clock = 0;
  /** The HUD's readouts refresh about ten times a second. */
  const hudTick = every(0.1);
  let pourAnnounced = false;
  let shake = 0;

  const drawBackdrop = createBackdrop("spill");
  let canvas: HTMLCanvasElement;
  let stage: HTMLElement;
  let playScope: HTMLElement;
  let playfield: HTMLElement;
  let hudRow: HTMLElement;
  let barEl: HTMLElement;
  let pourButton: HTMLButtonElement | null = null;
  let clearButton: HTMLButtonElement | null = null;
  let gaugeEl: HTMLElement | null = null;
  let captionEl: HTMLElement | null = null;
  let verdictEl: HTMLElement | null = null;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;
  let levelsCard: HTMLElement;
  let tileButtons: HTMLButtonElement[] = [];
  let ctx: CanvasRenderingContext2D | null = null;
  let reduceMotion = false;
  let dialFont = '700 11px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';

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
  /** The controls stand beside the room (a short, wide screen), not under it. */
  let sideLayout = false;
  /** Where the caption chip goes: over the room, or over the controls beside it. */
  let captionStyle = "";

  // The straw gauge, painted into the counter on the kitchen's grid where
  // its box in the bar sits, measured only on a resize so it never moves
  // while a room is played: its corner and size in CSS px, its cell size,
  // and what sits where inside it, in cells.
  const gaugeBox = { x: 0, y: 0, w: 0, h: 0 };
  let gaugeUnit = 0;
  let gauge = gaugeLayout(0);
  /** The straw's columns this frame, reused. */
  const tube = { rest: 0, draftTo: 0, marks: [] as number[] };
  /** The controls' boxes as last measured (CSS px), for the counter's sockets and the callout's keep-clear. */
  const controlBoxes = { pour: { x: 0, y: 0, w: 0, h: 0 }, clear: { x: 0, y: 0, w: 0, h: 0 } };

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
  let kitchenWallBottom = 0;
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

  /** The window's sky for the page: the day runs once over all the pages. */
  function skyIndex() {
    return Math.min(SKIES.length - 1, Math.floor((pageIndex() * SKIES.length) / TILE_TINTS.length));
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
    // Beside the room, the cabinet of controls takes the wall's lower part.
    const cabinet = sideLayout ? cabinetCells() : null;
    kitchenWallBottom = Math.min(floorRow, cabinet?.y0 ?? floorRow) * SC;
    const shelvesEnd = cabinet ? Math.min(wainscotRow, cabinet.y0 - 3) : wainscotRow;
    if (leftSpace >= 12) paintShelves(2, leftSpace, below, wainscotRow, 0);
    if (rightSpace >= 12) {
      const slitW = Math.min(30, rightSpace - 2);
      paintWindow(rightStart + Math.round((rightSpace - slitW) / 2), below + 1, slitW, 5);
      paintLadles(rightStart, rightSpace, below + 10);
      if (shelvesEnd - (below + 28) > 10) paintShelves(rightStart, rightSpace, below + 28, shelvesEnd, 1);
    }

    // The controls: set into the counter the room stands on, or into the
    // cabinet beside it, each in a socket of its own.
    if (cabinet) paintCabinet(cabinet);
    else paintCounter(floorRow, cols, rows);
    paintSocket(controlBoxes.pour);
    paintSocket(controlBoxes.clear);
    paintSocket(gaugeBox);

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
    const sky = SKIES[remix ? SKIES.length - 1 : skyIndex()];
    const frame = c32(WOOD_HEX);
    rect(x - 1, y - 1, w + 2, h + 2, frame);
    const top = c32(sky.top);
    const low = c32(sky.low);
    for (let yy = 0; yy < h; yy++) {
      const t = yy / Math.max(1, h - 1);
      for (let xx = 0; xx < w; xx++) put(x + xx, y + yy, t > bayer(xx, yy) * 0.6 + 0.3 ? low : top);
    }
    const sunX = x + Math.round(w * (0.25 + skyIndex() * 0.1));
    const sunY = y + 1 + Math.min(h - 2, Math.floor(skyIndex() / 2));
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

  /**
   * The counter the room stands on, the width of the kitchen: a steel
   * worktop with a lit lip, and its front in brushed panels down to a kick
   * strip, over the last of the floor. The controls are set into its front.
   */
  function paintCounter(top: number, cols: number, rows: number) {
    const kick = Math.max(top + 4, rows - 3);
    rect(0, top, cols, 1, STEEL_LIGHT);
    rect(0, top + 1, cols, 1, STEEL);
    rect(0, top + 2, cols, 1, INK);
    rect(0, top + 3, cols, kick - top - 3, STEEL_DARK);
    // The lip's shadow on the front, and a seam between panels now and then.
    dither(0, top + 3, cols, 1, STEEL_DEEP, 0.5);
    const seamLight = c32(mixHex("#6f777c", "#9aa3a8", 0.5));
    for (let x = 7; x < cols; x += 37) {
      rect(x, top + 4, 1, kick - top - 4, STEEL_DEEP);
      rect(x + 1, top + 4, 1, kick - top - 4, seamLight);
    }
    rect(0, kick, cols, 1, STEEL_DEEP);
  }

  /** The cabinet beside the room, in cells: round the controls with a margin, on the wall. */
  function cabinetCells() {
    const bar = barEl?.getBoundingClientRect();
    if (!bar) return null;
    return {
      x0: Math.floor(bar.left / SC) - 3,
      y0: Math.floor(bar.top / SC) - 3,
      x1: Math.ceil(bar.right / SC) + 3,
      y1: Math.ceil(bar.bottom / SC) + 3,
    };
  }

  /**
   * A steel cabinet hung on the wall beside the room, the controls set into
   * its front: an ink outline, a lit top lip, a rivet in each corner, and
   * its shadow on the wall, down and to the right like the room's.
   */
  function paintCabinet(box: { x0: number; y0: number; x1: number; y1: number }) {
    const { x0, y0, x1, y1 } = box;
    const shade = c32(mixHex(WALL_HEX, SOFFIT_HEX, 0.55));
    for (let y = y0 + 2; y <= y1; y++) {
      for (let x = x0 + 2; x <= x1; x++) {
        if (x < x1 && y < y1) continue;
        if (bayer(x, y) < 0.5) put(x, y, shade);
      }
    }
    rect(x0, y0, x1 - x0, y1 - y0, INK);
    rect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2, STEEL_DARK);
    rect(x0 + 1, y0 + 1, x1 - x0 - 2, 1, STEEL_LIGHT);
    rect(x0 + 1, y0 + 2, x1 - x0 - 2, 1, STEEL);
    dither(x0 + 1, y0 + 3, x1 - x0 - 2, 1, STEEL_DEEP, 0.5);
    for (const [x, y] of [
      [x0 + 2, y0 + 4],
      [x1 - 3, y0 + 4],
      [x0 + 2, y1 - 3],
      [x1 - 3, y1 - 3],
    ]) {
      put(x, y, STEEL_LIGHT);
      put(x + 1, y + 1, STEEL_DEEP);
    }
  }

  /**
   * The socket a control sits in, a cell round its box (CSS px): a dark
   * hole with stepped corners and the light on its lower lip, so a key
   * pressed down sinks into it.
   */
  function paintSocket(box: { x: number; y: number; w: number; h: number }) {
    if (box.w <= 0 || box.h <= 0) return;
    const x0 = Math.floor(box.x / SC) - 1;
    const y0 = Math.floor(box.y / SC) - 1;
    const x1 = Math.ceil((box.x + box.w) / SC) + 1;
    const y1 = Math.ceil((box.y + box.h) / SC) + 1;
    rect(x0 + 1, y0, x1 - x0 - 2, y1 - y0, SOCKET);
    rect(x0, y0 + 1, x1 - x0, y1 - y0 - 2, SOCKET);
    rect(x0 + 1, y1 - 1, x1 - x0 - 2, 1, STEEL);
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
    paintSieves();
    world.blocks.forEach((block, index) => {
      if (block.type === "ice") paintBlock(block, index);
    });
    paintFanHousings();
    paintRails();

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

  // --- Sieves and rails ----------------------------------------------------------------

  /**
   * A sieve: a steel mesh with an ink edge, wires across it every few units
   * and pale gaps between, so it reads as something tea falls through.
   */
  function paintSieves() {
    for (const sieve of world.sieves) {
      const { x1, y1, x2, y2 } = sieve;
      const length = Math.hypot(x2 - x1, y2 - y1) || 1;
      for (let y = Math.floor(Math.min(y1, y2) - 4); y <= Math.max(y1, y2) + 4; y++) {
        for (let x = Math.floor(Math.min(x1, x2) - 4); x <= Math.max(x1, x2) + 4; x++) {
          const d = segDist(x + 0.5, y + 0.5, x1, y1, x2, y2);
          if (d > 2.4) continue;
          const along = ((x + 0.5 - x1) * (x2 - x1) + (y + 0.5 - y1) * (y2 - y1)) / length;
          if (d > 1.6) blend(x, y, INK, 0.7);
          else if (Math.floor(along) % 3 === 0) put(x, y, STEEL_DARK);
          else blend(x, y, STEEL_LIGHT, 0.45);
        }
      }
      for (const [px, py] of [
        [x1, y1],
        [x2, y2],
      ]) {
        disc(px, py, 2.4, INK);
        disc(px, py, 1.4, STEEL);
      }
    }
  }

  /** Where a kettle's chain meets its trolley, relative to the spout, hanging level. */
  function handleOffset(kettle: Kettle) {
    const sp = kettleSprite(kettle);
    return spriteToWorld(sp, { ...kettle, x: 0, y: 0 }, 0, sp.hx, sp.hy).x;
  }

  /** The slot in the top trim that a kettle on a rail runs along. */
  function paintRails() {
    for (const kettle of world.kettles) {
      if (!kettle.rail) continue;
      const reach = Math.abs(kettle.rail.range);
      const centre = kettle.baseX + handleOffset(kettle);
      const x0 = Math.round(centre - reach - 7);
      const x1 = Math.round(centre + reach + 7);
      rect(x0, -MT + 1, x1 - x0, 4, INK);
      rect(x0 + 1, -MT + 2, x1 - x0 - 2, 2, STEEL_DEEP);
      rect(x0, -MT + 5, x1 - x0, 1, STEEL_LIGHT);
    }
  }

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
    const bandRight = cup.x < WIDTH / 2;

    // The fill line at the amount needed, with a notch outside the wall.
    const lineY = fillLineY(cup, CUP_WALL);
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
    if (kettle.rail) {
      // The trolley it hangs from, running in the slot in the trim.
      const tx = Math.round(handle.x);
      rect(tx - 4, -MT + 1, 9, 5, INK);
      rect(tx - 3, -MT + 2, 7, 3, STEEL);
      put(tx - 2, -MT + 2, STEEL_LIGHT);
      put(tx + 2, -MT + 2, STEEL_LIGHT);
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
        // The first tea into a cup: what its dashed line asks for.
        if (cup && phase === "play" && !coach.current) teach({ lesson: LESSONS.fill, target: { kind: "line", index: a } });
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

  // --- Lessons -------------------------------------------------------------------------
  // Taught once per device, inside the live room: spill-lessons.js says what
  // and when, and the coach shows one at a time. Nothing is slowed: a lesson
  // that explains holds the room instead. During planning the room is frozen
  // outright (roomFrame takes no step: the dial, a belt, a kettle's rail all
  // wait), so a held room plays out exactly as an unheld one would from the
  // same planning time, while straws can still be drawn and taken back; a
  // lesson about a result holds the next room back. Each lesson may hold for
  // a few seconds of real time in a visit; Continue, Pour, or doing what it
  // asks lets the room run on.

  type Side = "above" | "below" | "left" | "right";

  const coach = createCoach("spill");
  /** What the lesson up is about (refound every frame, since belts and kettles move). */
  let cue: Cue | null = null;
  const spot = createSpot();
  /** The callout, copied out of the coach so the markup follows it. */
  let coachLesson: Lesson | null = null;
  let coachLeaving = false;
  let coachX: number | null = null;
  let coachY: number | null = null;
  let coachRing = 0;
  let coachWidth = 0;
  let coachHeight = 0;
  let coachSide: Side = "above";
  let coachScene: "dark" | "light" = "light";
  let coachContinuable = false;
  /** The lesson is over (done, or its move made): the callout holds where it is as it goes. */
  let coachEnded = false;
  /** The slip's size as Coach measures it (0 until the slip for the lesson up has been laid out). */
  let coachSlipW = 0;
  let coachSlipH = 0;
  /** The room's name chip steps aside while a lesson is up, unless the lesson is about it. */
  let captionHidden = false;
  /** The lesson up holds the room this frame. */
  let lessonHolds = false;
  /** A lesson is up and explaining (placed, not done, its move not made): the kitchen dims to its thing. */
  let lessonExplains = false;
  /** Each lesson's hold allowance for the visit. */
  const lessonHold = createHolds(expert);
  /** What planning has settled: what the device has learned (a move continued past counts as learned). */
  const settledLesson = (id: string) => coach.learned(id);
  /** Pour was pressed: planning is over, and nothing holds the room until the next one. */
  let pourLatched = false;
  /** Real seconds since the last lesson came down, so two never run together. */
  let quietFor = Infinity;
  /** The spotlight's strength, eased in real time. */
  let lessonDim = 0;
  /** The bar control the lesson is about, lit while the rest of the bar steps back. */
  let barLit: "pour" | "gauge" | null = null;
  /** The input the player is using: the lessons' wording and their key chips follow it. */
  let inputMode: "mouse" | "touch" | "keys" = "mouse";
  /** The ghost route in room units, built once per lesson, and the arrowhead at its end. */
  let ghost: ReadonlyArray<{ x: number; y: number }> = [];
  const ghostArrow = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const ghostBox = { x: 0, y: 0, w: 0, h: 0 };
  /**
   * The ghost straw, dithered once into its own layer at the screen's scale
   * (on the dither's 4-unit repeat), and drawn from there each frame: only
   * the chalk moves.
   */
  let ghostLayer: HTMLCanvasElement | null = null;
  let ghostKey = "";
  const ghostArea = { x: 0, y: 0, w: 0, h: 0 };
  /** The ghost straw's dither: a checkerboard of cream. */
  const GHOST_DENSITY = 0.5;
  /** The spotlight's boxes in canvas px: a pool, and the ones in use this frame. */
  const litPool: FocusBox[] = [];
  const litBoxes: FocusBox[] = [];
  /** A control's box, measured as its lesson starts and after a resize, not every frame. */
  let placeRect: { x: number; y: number; w: number; h: number } | null = null;
  /** The cue the callout has been placed for, so one never shows before it has a place. */
  let placedCue: Cue | null = null;
  /** The slip size the side was last chosen for (0 before it has been measured). */
  let sizedW = 0;
  let sizedH = 0;
  /**
   * Real seconds after a lesson goes up in which its side may still be
   * chosen again as its slip is measured (the slip steps in over this long,
   * and its Continue key may arrive a frame after its words); then it is kept.
   */
  const SIDE_SETTLES = 0.4;
  /** The chalk's ink. */
  const CHALK = INK_HEX;
  /** Roughly the slip's size, for choosing a side before it has been measured. */
  const SLIP_W = 260;
  const SLIP_H = 72;

  function setCue(next: Cue) {
    cue = next;
    placeRect = null;
    placedCue = null;
    // Its slip is measured afresh.
    coachSlipW = coachSlipH = 0;
    // A lesson takes the room name's place: one message at a time.
    if (caption && captionLife === INTRO_SECONDS) caption = null;
    if (next.target.kind === "route") buildGhost();
  }

  /** The route's points, its box, and an arrowhead at its end pointing the way it is drawn. */
  function buildGhost() {
    ghost = ghostRoute(room) ?? [];
    ghostKey = "";
    if (ghost.length < 2) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const point of ghost) {
      x0 = Math.min(x0, point.x);
      y0 = Math.min(y0, point.y);
      x1 = Math.max(x1, point.x);
      y1 = Math.max(y1, point.y);
    }
    const pad = 4;
    ghostBox.x = x0 - pad;
    ghostBox.y = y0 - pad;
    ghostBox.w = x1 - x0 + pad * 2;
    ghostBox.h = y1 - y0 + pad * 2;
    // The area the dithered layer covers: the box, out to the dither's repeat.
    ghostArea.x = Math.floor(ghostBox.x / 4) * 4;
    ghostArea.y = Math.floor(ghostBox.y / 4) * 4;
    ghostArea.w = Math.ceil((ghostBox.x + ghostBox.w) / 4) * 4 - ghostArea.x;
    ghostArea.h = Math.ceil((ghostBox.y + ghostBox.h) / 4) * 4 - ghostArea.y;
    const end = ghost[ghost.length - 1];
    const before = ghost[ghost.length - 2];
    const length = Math.hypot(end.x - before.x, end.y - before.y) || 1;
    const ux = (end.x - before.x) / length;
    const uy = (end.y - before.y) / length;
    ghostArrow[0].x = end.x - ux * 6 - uy * 4;
    ghostArrow[0].y = end.y - uy * 6 + ux * 4;
    ghostArrow[1].x = end.x;
    ghostArrow[1].y = end.y;
    ghostArrow[2].x = end.x - ux * 6 + uy * 4;
    ghostArrow[2].y = end.y - uy * 6 - ux * 4;
  }

  /** Ends what was about planning, as the tea comes: a move not made comes back, a line read counts. */
  function endPlanningLesson() {
    const current = coach.current;
    if (!current || current.during !== "plan" || coach.leaving) return;
    if (current.move) coach.dismiss();
    else coach.done(current.id);
  }

  /** What planning should teach now, once "go" has gone. The pour ends what was about planning. */
  function checkLessons() {
    const current = coach.current;
    if (world.status !== "waiting" || pourLatched) {
      endPlanningLesson();
      if (!coach.current) cue = null;
      return;
    }
    const next = planningLesson(world, settledLesson, { drafting: !!world.draft });
    if (next && next.lesson.id !== current?.id && mayOffer(next.lesson, current, coach.age, quietFor, coach.leaving) && coach.offer(next.lesson)) {
      setCue(next);
    }
    if (!coach.current) cue = null;
  }

  /** A lesson that something which just happened calls for: the coach decides whether it can go up now. */
  function teach(next: Cue | null) {
    if (!next || coach.learned(next.lesson.id) || coach.current?.id === next.lesson.id) return;
    if (coach.offer(next.lesson)) setCue(next);
  }

  /** A lesson about a straw whose straw has gone (Clear) comes down at once, and holds nothing. */
  function dropLostTarget() {
    if (!cue || cue.target.kind !== "straw" || coach.current !== cue.lesson || coach.leaving) return;
    for (const stroke of world.strokes) if (stroke.id === cue.target.index) return;
    coach.dismiss();
    cue = null;
    lessonHolds = false;
  }

  /** Whether the lesson up belongs to the part of the room being played, so it may hold it. */
  function holdableNow() {
    const lesson = coach.current;
    return !!cue && cue.lesson === lesson && inItsPart(lesson, { phase, status: world.status, poured: pourLatched });
  }

  /**
   * Whether the lesson up holds the room this frame, out of its allowance
   * for the visit: the dial and all while the room is still planning and
   * Pour hasn't been pressed, the tea where it is while the pour is
   * explained, or the next room while a result is explained. Never while a
   * straw is being drawn.
   * @param dt Real seconds this frame.
   */
  function updateHold(dt: number) {
    lessonHolds = lessonHold.take(coach.current, { leaving: coach.leaving, acting: coach.acting, holdable: holdableNow(), drafting: !!world.draft }, dt);
  }

  /**
   * The player is aiming the keyboard pen or changing the straws: whatever
   * the lesson up was holding runs on at once and for the
   * rest of the visit, so planning done during a lesson costs planning time
   * as usual (pouring early is points), and a pour stopped for a lesson
   * starts again before anything is drawn into it. The lesson stays up:
   * room 1's ghost keeps teaching while the dial runs.
   */
  function editing() {
    const lesson = coach.current;
    if (lesson) lessonHold.end(lesson.id);
    lessonHolds = false;
  }

  /**
   * A lesson that holds the room has just gone up (on a step mid-frame): the
   * room stops on that step, not a few steps on.
   */
  function stopsHere() {
    const lesson = coach.current;
    return (
      phase === "play" &&
      holdableNow() &&
      holds(lesson, { leaving: coach.leaving, acting: coach.acting, expert, drafting: !!world.draft }) &&
      !!lesson &&
      lessonHold.left(lesson.id) > 0
    );
  }

  /**
   * The room changes or ends under a lesson: a line read long enough counts,
   * a move not made comes back, and either way it goes at once.
   */
  function endLesson() {
    const current = coach.current;
    if (current && !coach.leaving && !current.move && coach.age >= (current.minLife ?? 0.9)) coach.skip(current.id);
    coach.dismiss();
    cue = null;
    lessonHolds = false;
  }

  /**
   * The player has read it: Continue (Enter on the playfield, the slip's
   * button, or a result's own keys) ends it and lets the room run on. It
   * counts as learned, a move continued past (room 1's route) as much as a
   * line about a thing: the player has said they know it.
   */
  function continueLesson() {
    if (!coachContinuable || paused || levelsOpen) return;
    const lesson = coach.current;
    if (!lesson) return;
    coach.done(lesson.id);
    lessonHolds = false;
    coachContinuable = false;
  }

  /**
   * A straw went down (`drawnId`) or was taken back (-1) in room 1 while
   * the route is still to learn. The engine runs the room on the straws as
   * laid: if they would pour into the cup the route is learned; if not, a
   * straw off the ghost (or the one just drawn) is where taking a straw back
   * is taught.
   */
  function judgeRoute(drawnId: number) {
    if (room.id !== ROUTE_ROOM || world.status !== "waiting" || coach.learned(LESSONS.route.id) || !world.strokes.length) return;
    const verdict = routeVerdict(room, world.strokes, drawnId);
    if (verdict.learned) {
      coach.done(LESSONS.route.id);
      return;
    }
    if (drawnId >= 0 && verdict.offGhost >= 0 && coach.current?.id === LESSONS.route.id && !coach.learned(LESSONS.takeBack.id)) {
      // The route steps aside uncounted, and comes back once the straw is taken back.
      coach.dismiss();
      teach({ lesson: LESSONS.takeBack, target: { kind: "straw", index: verdict.offGhost } });
    }
  }

  /** A DOM element's box, in CSS px. */
  function boxOf(element: Element | null | undefined) {
    if (!element?.isConnected) return null;
    const r = element.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  }

  /** The slip's size, once Coach has laid out the slip for the lesson up. */
  function measuredSlip() {
    return coachSlipW > 0 && coachSlipH > 0 ? { w: coachSlipW, h: coachSlipH } : null;
  }

  /**
   * What the callout keeps clear of, in CSS px, each with what covering it
   * costs: the lesson's own things, the cups, the kettles and the tea (or
   * where it will fall) from the room, the controls (most of all the one
   * the lesson is about), and the verdict while it is up.
   */
  function keepClearOnScreen(target: Cue["target"], about: string): Keep[] {
    const out: Keep[] = keepClear(world, spot, target).map((box) => ({ x: rx + box.x * S, y: ry + box.y * S, w: box.w * S, h: box.h * S, weight: box.weight }));
    // A control is out of the room: better covered for a moment than a cup or the tea.
    out.push({ ...controlBoxes.pour, weight: about === "pour" ? 4 : 0.25 });
    out.push({ ...controlBoxes.clear, weight: 0.25 });
    out.push({ ...gaugeBox, weight: about === "gauge" ? 4 : 0.25 });
    const shownVerdict = verdict ? boxOf(verdictEl) : null;
    if (shownVerdict && about !== "verdict") out.push({ ...shownVerdict, weight: 1.5 });
    return out;
  }

  /**
   * The side the slip goes on: the one, of those this lesson would take,
   * whose slip covers least of what it should keep clear of (Coach then
   * only keeps it on screen). `slip` is its size, measured once it is up.
   */
  function pickSide(target: Cue["target"], anchor: { x: number; y: number; ring: number; width: number; height: number }, slip: { w: number; h: number }): Side {
    let prefer: Side[];
    if (spot.place === "room") prefer = sidesFor(target, spot, room);
    else if (spot.place === "pour" || spot.place === "gauge") prefer = sideLayout ? ["left", "above", "below", "right"] : ["above", "right", "left", "below"];
    else if (spot.place === "caption" && sideLayout) prefer = ["left", "above", "below", "right"];
    else prefer = ["below", "above", "right", "left"];
    return chooseSide(anchor, slip, { w: viewW, h: viewH, top: hudBottomPx + 8 }, keepClearOnScreen(target, spot.place), prefer);
  }

  /** Where the callout goes this frame, and what the spotlight keeps lit. */
  function placeCoach() {
    const lesson = coach.current;
    if (!lesson || !cue || cue.lesson !== lesson || phase === "done") {
      if (coachLesson) coachLesson = null;
      if (coachX !== null) coachX = coachY = null;
      if (coachContinuable) coachContinuable = false;
      if (captionHidden) captionHidden = false;
      if (lessonDim <= 0.01) spot.count = 0;
      return;
    }
    const target = cue.target;
    const found = aim(target, world, spot, { cupWall: CUP_WALL, dial: target.kind === "dial" ? dialSpots[target.index] : null });
    let x: number | null = null;
    let y: number | null = null;
    let ring = 0;
    let width = 0;
    let height = 0;
    let scene: "dark" | "light" = "light";
    if (found && spot.place === "room") {
      x = rx + spot.x * S;
      y = ry + spot.y * S;
      ring = spot.ring * S;
      width = spot.wide * S;
      height = spot.tall * S;
    } else if (found) {
      // A control (the straw gauge is painted, so its box is the painted one) or a chip.
      if (!placeRect) {
        if (spot.place === "gauge") placeRect = gaugeBox.w > 0 ? { ...gaugeBox } : null;
        else placeRect = boxOf(spot.place === "pour" ? pourButton : spot.place === "verdict" ? verdictEl : captionEl);
      }
      if (placeRect) {
        x = placeRect.x + placeRect.w / 2;
        y = placeRect.y + placeRect.h / 2;
        ring = (placeRect.h / 2 + 4) / 0.875;
        width = placeRect.w / 2 + 2 > ring * 1.15 ? placeRect.w / 2 - 4 : 0;
        // The controls sit on the counter's dark steel: the tail prints cream there.
        scene = spot.place === "pour" || spot.place === "gauge" ? "dark" : "light";
      }
    }
    if (x === null || y === null) {
      // Not placed yet (its control is still mounting): it waits. Gone (a
      // straw taken back): it fades where it was.
      if (placedCue !== cue) {
        if (coachLesson) coachLesson = null;
        if (coachContinuable) coachContinuable = false;
        return;
      }
    } else {
      // The side is chosen as the lesson goes up, chosen again as the slip
      // is measured while it steps in, then kept, so it doesn't hop as it follows.
      let side = coachSide;
      const anchor = { x, y, ring, width, height };
      if (placedCue !== cue) {
        side = pickSide(target, anchor, { w: Math.min(SLIP_W, viewW - 32), h: SLIP_H });
        sizedW = sizedH = 0;
      } else if (coach.age < SIDE_SETTLES) {
        const slip = measuredSlip();
        if (slip && (slip.w !== sizedW || slip.h !== sizedH)) {
          side = pickSide(target, anchor, slip);
          sizedW = slip.w;
          sizedH = slip.h;
        }
      }
      placedCue = cue;
      if (x !== coachX) coachX = x;
      if (y !== coachY) coachY = y;
      if (ring !== coachRing) coachRing = ring;
      if (width !== coachWidth) coachWidth = width;
      if (height !== coachHeight) coachHeight = height;
      if (side !== coachSide) coachSide = side;
      if (scene !== coachScene) coachScene = scene;
    }
    const shown = wordedFor(lesson, inputMode);
    if (coachLesson !== shown) coachLesson = shown;
    if (coachLeaving !== coach.fading) coachLeaving = coach.fading;
    const ended = coach.leaving || coach.acting;
    if (ended !== coachEnded) coachEnded = ended;
    const canContinue = offersContinue(lesson, lessonHolds);
    if (coachContinuable !== canContinue) coachContinuable = canContinue;
    const hideCaption = target.kind !== "caption";
    if (hideCaption !== captionHidden) captionHidden = hideCaption;
  }

  const paintGhostStraw = (g: CanvasRenderingContext2D) => {
    g.strokeStyle = "#000";
    g.lineWidth = STRAW_OUTER * 2;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(ghost[0].x, ghost[0].y);
    for (let i = 1; i < ghost.length; i++) g.lineTo(ghost[i].x, ghost[i].y);
    g.stroke();
  };

  /** The ghost straw's dithered layer at `scale` device px per room unit, made again only when the scale changes. */
  function ghostRaster(scale: number) {
    const key = `${scale}:${GHOST_DENSITY}`;
    if (ghostLayer && ghostKey === key) return ghostLayer;
    ghostLayer ??= document.createElement("canvas");
    ghostLayer.width = Math.max(1, Math.ceil(ghostArea.w * scale));
    ghostLayer.height = Math.max(1, Math.ceil(ghostArea.h * scale));
    const g = ghostLayer.getContext("2d");
    if (!g) return null;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, ghostLayer.width, ghostLayer.height);
    g.setTransform(scale, 0, 0, scale, -ghostArea.x * scale, -ghostArea.y * scale);
    drawGhost(g, ghostBox.x, ghostBox.y, ghostBox.w, ghostBox.h, paintGhostStraw, { color: CREAM_HEX, density: GHOST_DENSITY, cell: 1 });
    ghostKey = key;
    return ghostLayer;
  }

  /**
   * The route lesson's hologram, in the room's own pixels: a ghost straw
   * dithered in cream where to draw (drawn once, at this scale), chalk
   * dashes marching the way to draw it with an arrowhead at the end, and a
   * small accent post at its start where the pen goes down. Still under
   * Reduce Motion, and held while paused.
   */
  function drawLessonGhost(left: number, top: number) {
    if (!ctx || !cue || cue.target.kind !== "route" || coach.current !== cue.lesson || coach.leaving || ghost.length < 2) return;
    const m = ctx.getTransform();
    const layer = ghostRaster((Math.hypot(m.a, m.b) || 1) * S);
    ctx.save();
    if (layer) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(layer, left + ghostArea.x * S, top + ghostArea.y * S, ghostArea.w * S, ghostArea.h * S);
    }
    ctx.translate(left, top);
    ctx.scale(S, S);
    const progress = reduceMotion ? 1 : Math.min(1, (clock % 2.4) / 1.5);
    chalkPath(ctx, ghost, { color: CHALK, cell: 1.5, dash: 2, gap: 2, offset: reduceMotion ? 0 : -clock * 9, progress });
    chalkPath(ctx, ghostArrow, { color: CHALK, cell: 1.5, dash: 64, gap: 0 });
    const start = ghost[0];
    ctx.fillStyle = CHALK;
    ctx.fillRect(Math.round(start.x) - 2.5, Math.round(start.y) - 2.5, 5, 5);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(Math.round(start.x) - 1.5, Math.round(start.y) - 1.5, 3, 3);
    ctx.restore();
  }

  /**
   * The explanation's spotlight: while a lesson is up, the kitchen dims
   * under a wash of ink and what the lesson is about (the fixture, the cup,
   * the kettle, the ghost route, the straws) stays in full light, stepped to
   * the kitchen's cell. It follows the lesson shown, held or not.
   */
  function drawLessonLight(left: number, top: number) {
    if (!ctx || lessonDim <= 0.01) return;
    litBoxes.length = 0;
    for (let i = 0; i < spot.count; i++) {
      const from = spot.lit[i];
      const box = (litPool[i] ??= { x: 0, y: 0, w: 0, h: 0 });
      box.x = left + from.x * S;
      box.y = top + from.y * S;
      box.w = from.w * S;
      box.h = from.h * S;
      litBoxes.push(box);
    }
    // The gauge is painted on the counter, so it stays lit with what its lesson is about.
    if (barLit === "gauge" && gaugeBox.w > 0) {
      gaugeLit.x = gaugeBox.x - SC;
      gaugeLit.y = gaugeBox.y - SC;
      gaugeLit.w = gaugeBox.w + SC * 2;
      gaugeLit.h = gaugeBox.h + SC * 2;
      litBoxes.push(gaugeLit);
    }
    drawSpotlight(ctx, viewW, viewH, litBoxes, lessonDim, { color: INK_HEX, cell: SC });
  }

  const gaugeLit: FocusBox = { x: 0, y: 0, w: 0, h: 0 };

  // --- The straw gauge ------------------------------------------------------------------

  const GAUGE_RULE = "rgba(253, 248, 243, 0.32)";
  const GAUGE_QUIET = "rgba(253, 248, 243, 0.62)";
  /** The accent, a step lighter, so "low" and "out" read on the dark chip. */
  const GAUGE_WARN = "#f18272";
  const GAUGE_SPENT = "rgba(253, 248, 243, 0.2)";
  const GAUGE_MARK = "rgba(253, 248, 243, 0.42)";
  /** The straw's stripes: as the straws in the room, coral once low, and pale while a stroke is being drawn. */
  const STRAW_STRIPES = [STRAW_PINK, CREAM_HEX] as const;
  const LOW_STRIPES = ["#e85d4c", "#b8402f"] as const;
  const DRAFT_STRIPES = ["#ffb0c0", CREAM_HEX] as const;
  /** The top line as last laid out, kept until the figure or the state changes. */
  let gaugeLine: ReturnType<typeof topLine> = [];
  let gaugeLineKey = "";

  /** Prints a word in the pixel alphabet, or a figure in the gauge's digits, a cell of `u` px at a time. */
  function printCells(text: string, digits: boolean, x: number, y: number, u: number, color: string) {
    if (!ctx) return;
    ctx.fillStyle = color;
    let at = 0;
    for (const letter of text) {
      const glyph: readonly string[] | undefined = digits ? DIGITS[letter as keyof typeof DIGITS] : GLYPHS[letter];
      if (glyph) {
        for (let row = 0; row < LABEL_ROWS; row++) {
          for (let col = 0; col < glyph[row].length; col++) {
            if (glyph[row][col] === "#") ctx.fillRect(x + (at + col) * u, y + row * u, u, u);
          }
        }
      }
      at += (glyph?.[0].length ?? 3) + 1;
    }
  }

  /**
   * The straw gauge, painted on the counter (or the cabinet) in the kitchen's
   * pixels: a dark chip like the callout's, "straw" and the figure left over
   * a pixel straw that shortens from the right as straw is spent. Low, the
   * straw goes coral, the chip's rule blinks in the accent and it says "low";
   * out, it says "out". Read straight from the room each frame, so the
   * stroke being drawn eats into it live. Under Reduce Motion nothing blinks
   * or shakes.
   */
  function drawGauge() {
    if (!ctx || !gaugeUnit) return;
    const u = gaugeUnit;
    const shaking = gaugeShake > 0 && !reduceMotion;
    const x = gaugeBox.x + (shaking ? (Math.floor(gaugeShake * 28) % 2 ? u : -u) : 0);
    const y = gaugeBox.y;
    const w = gaugeBox.w;
    const h = gaugeBox.h;
    const cut = GAUGE_CUT * u;
    const left = Math.max(0, strawBudget - strawUsed - draftUsed);
    const state = left < 0.5 ? "out" : strawBudget > 0 && left / strawBudget < LOW_SHARE ? "low" : "ok";

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = NOTE_BACK;
    ctx.fillRect(x + cut, y, w - cut * 2, h);
    ctx.fillRect(x, y + cut, w, h - cut * 2);
    ctx.fillStyle = state !== "ok" && (reduceMotion || Math.floor(clock * 4) % 2 === 0) ? GAUGE_WARN : GAUGE_RULE;
    ctx.fillRect(x + cut, y, w - cut * 2, 2);
    ctx.fillRect(x + cut, y + h - 2, w - cut * 2, 2);
    ctx.fillRect(x, y + cut, 2, h - cut * 2);
    ctx.fillRect(x + w - 2, y + cut, 2, h - cut * 2);

    // The top line: "straw" at the left, the figure (and "low") at the right.
    const figure = Math.round(left);
    const key = `${state}:${figure}:${gauge.right}`;
    if (key !== gaugeLineKey) {
      gaugeLineKey = key;
      gaugeLine = topLine({ figure, state }, gauge.right);
    }
    const lineY = y + gauge.label.y * u;
    printCells(WORDS.label, false, x + gauge.label.x * u, lineY, u, GAUGE_QUIET);
    for (const entry of gaugeLine) printCells(entry.text, entry.digits, x + entry.x * u, lineY, u, entry.digits ? CREAM_HEX : GAUGE_WARN);

    // The straw: what is left, the stroke being drawn (dithered: it isn't
    // down yet), then each straw down at its cost, an outline with its ends marked.
    const length = gauge.tube.w;
    tubeColumns(length, strawBudget, left, draftUsed, strawSpent, tube);
    const tx = x + gauge.tube.x * u;
    const ty = y + gauge.tube.y * u;
    const rows = gauge.tube.h;
    const stripes = state === "low" ? LOW_STRIPES : STRAW_STRIPES;
    for (let stripe = 0; stripe < 2; stripe++) {
      ctx.fillStyle = stripes[stripe];
      for (let col = 0; col < tube.rest; col++) {
        for (let row = 0; row < rows; row++) if ((((col + row) & 3) < 2 ? 0 : 1) === stripe) ctx.fillRect(tx + col * u, ty + row * u, u, u);
      }
      ctx.fillStyle = DRAFT_STRIPES[stripe];
      for (let col = tube.rest; col < tube.draftTo; col++) {
        for (let row = 0; row < rows; row++) {
          if (((col + row) & 1) === 0 && (((col + row) & 3) < 2 ? 0 : 1) === stripe) ctx.fillRect(tx + col * u, ty + row * u, u, u);
        }
      }
    }
    if (tube.draftTo < length) {
      ctx.fillStyle = GAUGE_SPENT;
      ctx.fillRect(tx + tube.draftTo * u, ty, (length - tube.draftTo) * u, u);
      ctx.fillRect(tx + tube.draftTo * u, ty + (rows - 1) * u, (length - tube.draftTo) * u, u);
      ctx.fillStyle = GAUGE_MARK;
      let from = tube.draftTo;
      for (const mark of tube.marks) {
        if (mark > from) ctx.fillRect(tx + from * u, ty, u, rows * u);
        from = mark;
      }
      ctx.fillRect(tx + (length - 1) * u, ty, u, rows * u);
    }
    ctx.restore();
  }

  // --- The room, start to finish -------------------------------------------------------

  function phaseFor(r: Room) {
    if (r.remix) return "rush";
    return r.page >= 5 ? "rush" : r.page >= 3 ? "steady" : "opening";
  }

  function labelFor(index: number, r: Room) {
    return r.remix ? "after hours" : `room ${pad2(index + 1)}`;
  }

  function showCaption(line: string, life: number) {
    captionCount += 1;
    caption = { id: captionCount, line };
    captionAge = 0;
    captionLife = life;
  }

  /** A fresh world for a level: straws cleared, kettles full. */
  function enterRoom(index: number, override?: Room) {
    const previousPage = room ? pageIndex() : -1;
    const wasRemix = !!room?.remix;
    levelIndex = index;
    room = override ?? roomAt(index, remixSeed, expert);
    world = createWorld(room);
    accumulator = 0;
    alpha = 1;
    pourAnnounced = false;
    lowAnnounced = false;
    outAnnounced = false;
    holdResult = false;
    verdict = null;
    pourLatched = false;
    endLesson();
    resetRoomVisuals();
    cancelGesture();
    penDrawing = false;
    roomLabel = labelFor(index, room);
    roomName = room.name;
    bakeRoom();
    if (previousPage !== pageIndex() || wasRemix !== !!room.remix) bakeKitchen();
    syncHud();
  }

  /** The room's name, unless the room opens on a lesson, which takes its place. */
  function announceRoom() {
    liveMessage = describeRoom(room);
    // A new room is a fresh moment: what it brings is named at once.
    quietFor = Infinity;
    checkLessons();
    if (!coach.current) showCaption(room.name, INTRO_SECONDS);
  }

  /** Into a level: through the countdown the first time the music starts, else straight in. */
  function playLevel(index: number) {
    if (index >= AFTER_HOURS && levelIndex < AFTER_HOURS) remixSeed = 1 + Math.floor(Math.random() * 1_000_000);
    caption = null;
    enterRoom(index);
    roomStarted = true;
    if (!musicStarted) {
      phase = "countdown";
      countdown = COUNTDOWN_SECONDS;
      countdownElapsed = 0;
      goVisible = false;
      loop.resync();
      sfxCountdown(COUNTDOWN_SECONDS);
      liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
      return;
    }
    setMusicPhase(phaseFor(room));
    setMusicPaused(false);
    phase = "play";
    loop.resync();
    syncHud();
    announceRoom();
  }

  function settleRoom(result: RoomResult) {
    phase = "result";
    resultAge = 0;
    cancelGesture();
    penDrawing = false;
    setPour(0);
    lastCleared = result.cleared;
    teaSpilled += result.spilled;
    if (result.cleared) {
      let note = "";
      if (levelIndex < AFTER_HOURS) {
        const before = progress;
        progress = recordRoomResult(progress, levelIndex, result);
        writeSpillProgress(progress, mode);
        const opened = unlockedRooms(progress);
        if (levelIndex + 1 < ROOMS.length && opened[levelIndex + 1] && !unlockedRooms(before)[levelIndex + 1]) {
          note = ` Room ${levelIndex + 2} is open.`;
        } else if (progress.afterHours && !before.afterHours) note = " After hours is open.";
        else if (result.points > before.points[levelIndex] && before.stars[levelIndex] > 0) note = " A new best for this room.";
      } else {
        afterHoursCleared += 1;
      }
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
      liveMessage = `Room cleared with ${result.stars} ${result.stars === 1 ? "star" : "stars"}, ${result.points} points.${note}`;
    } else {
      sfxRoomFail();
      if (!reduceMotion) shake = 1;
      showCaption(room.hint, Infinity);
      liveMessage = `Spilled. Hint: ${room.hint}.`;
    }
    // What the room's end means, the first time: the stars, the points, a spill's hint.
    endLesson();
    // Room 1 cleared is the route made to work, however it was drawn (or skipped).
    if (result.cleared && room.id === ROUTE_ROOM) coach.done(LESSONS.route.id);
    teach(resultLesson(result.cleared, coach.learned));
    syncHud();
  }

  /** On from a result: the next room after a clear (or the slip after the last room), the same room after a spill. */
  function advance() {
    if (lastCleared && levelIndex === LAST_ROOM && !holdResult) {
      void openSlip();
      return;
    }
    const nextIndex = lastCleared ? levelIndex + 1 : levelIndex;
    // The slip winds the music down: the next room starts it again through the countdown.
    if (!musicStarted) {
      playLevel(nextIndex);
      return;
    }
    if (lastCleared) setMusicPhase(phaseFor(roomAt(nextIndex, remixSeed, expert)));
    const keepHint = !lastCleared ? caption : null;
    enterRoom(nextIndex);
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
    if (phase !== "result" || paused || levelsOpen) return;
    // A lesson explaining the result is read first.
    if (coachContinuable) {
      continueLesson();
      return;
    }
    if (resultAge < SKIP_AFTER) return;
    advance();
  }

  /** Whether the engine has judged the room (read fresh, never narrowed). */
  function settled(): boolean {
    const status: string = world.status;
    return status === "cleared" || status === "failed";
  }

  /**
   * Steps the simulation on a fixed clock. It runs while the room is in play
   * and after its verdict, so tea still on its way keeps flowing; the verdict
   * is caught the step it lands.
   */
  function simulate(dt: number, hold = false) {
    // A lesson holding the room freezes it: no step at all, so the room
    // later plays out exactly as it would have from where it stopped.
    const clock = roomFrame(world, accumulator, dt, hold);
    accumulator = clock.accumulator;
    for (let k = 0; k < clock.steps; k++) {
      step(world, STEP);
      if (world.events.count) handleEvents();
      if (phase === "play" && settled()) settleRoom(world.result ?? judgeRoom(world));
      // A lesson that stops the room went up on this step (the tea reaching
      // the cup): the room stops here, the rest of the frame's time let go.
      if (!hold && stopsHere()) {
        hold = true;
        break;
      }
    }
    alpha = clock.alpha;
    let flowing = 0;
    for (const kettle of world.kettles) if (kettle.started && kettle.left > 0) flowing++;
    // Held, the pour falls silent with the tea.
    setPour(hold ? 0 : Math.min(1, flowing * 0.6));
  }

  function syncHud() {
    const live = phase === "play" && !settled();
    canPour = live && world.status === "waiting";
    canClear = live && world.strokes.length > 0;
    canNext = phase === "result" && lastCleared && !levelsOpen;
    const judged = world.result ?? judgeRoom(world);
    previewStars = world.status === "waiting" ? 0 : judged.stars;
    cupOk = judged.cups.map((cup) => cup.ok);
    syncGauge();
  }

  /**
   * The straw gauge: what is left, the stroke being drawn, and what each
   * straw down cost. Says "low" and "out" once each a room.
   */
  function syncGauge() {
    strawBudget = world.budget;
    strawSpent = world.strokes.map((stroke) => stroke.length).reverse();
    strawUsed = strawSpent.reduce((sum, length) => sum + length, 0);
    draftUsed = world.draftLength;
    const left = strawLeft(world);
    if (phase !== "play") return;
    if (left < 0.5) {
      if (!outAnnounced) {
        outAnnounced = true;
        gaugeShake = GAUGE_SHAKE;
        liveMessage = "Out of straw.";
      }
    } else if (left < strawBudget * LOW_SHARE && !lowAnnounced) {
      lowAnnounced = true;
      liveMessage = `Straw low, ${Math.round(left)} units left.`;
    }
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
    // The painting is on the wall, under the authored puzzle and above
    // the native steel counter and the sockets for its controls.
    drawBackdrop(ctx, {
      width: viewW, height: kitchenWallBottom, rows: 117, time: clock, still: reduceMotion,
      alternate: pageIndex() >= TILE_TINTS.length / 2 ? 1 : 0,
      opacity: 0.84, focus: 0.56,
      align: viewW < 600 ? { row: 66, y: Math.max(hudBottomPx + 12, oy - 18) } : undefined,
    });
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
    // The gauge on the counter, outside the shake and under the lesson's dim.
    drawGauge();
    // The lesson: where it points, the spotlight over the kitchen, and the
    // ghost route above it, under the pen and its reach ring.
    placeCoach();
    drawLessonLight(x + MX * S, y + MT * S);
    drawLessonGhost(x + MX * S, y + MT * S);
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

  /** Screen-space marks: timer figures, the keyboard pen, the reach ring, the draft's end. */
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

    drawReachRing(left, top, drawing);

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
        // The finger hides the draft's end, so a square marks it.
        ctx.strokeStyle = "#fdf8f3";
        ctx.lineWidth = 4;
        ctx.strokeRect(Math.round(ex) - 6, Math.round(ey) - 6, 12, 12);
        ctx.strokeStyle = out ? "#c9462f" : "#1a1a1a";
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(ex) - 6, Math.round(ey) - 6, 12, 12);
      }
    }
    ctx.restore();
  }

  /**
   * How far the straw left can still reach: a ring of pixel dashes round the
   * pen tip (the draft's end on touch, where the finger isn't), clipped to
   * the room. Unseen while straw is plentiful, firm once it runs short.
   */
  function drawReachRing(left: number, top: number, drawing: boolean) {
    if (!ctx || phase !== "play" || paused || levelsOpen || settled()) return;
    const budget = world.budget || 1;
    const remaining = strawLeft(world);
    const share = remaining / budget;
    const strength = clamp((RING_SHARE - share) / (RING_SHARE - LOW_SHARE), 0, 1);
    if (strength <= 0.02 || remaining < 0.5) return;
    let cx: number;
    let cy: number;
    let reach = remaining;
    if (drawing && world.draft) {
      const end = world.draft[world.draft.length - 1];
      cx = end[0];
      cy = end[1];
      // A mouse or the keyboard pen: centred on the tip, less what the
      // straw still has to cover to get there from the draft's end.
      if (!gesture?.touch) {
        const tip = gesture?.drawing ? { x: worldX(gesture.x), y: worldY(gesture.y) } : pen;
        const tx = clamp(tip.x, 0, WIDTH);
        const ty = clamp(tip.y, 0, HEIGHT);
        reach = Math.max(0, remaining - Math.hypot(tx - cx, ty - cy));
        cx = tx;
        cy = ty;
      }
    } else if (penVisible) {
      cx = pen.x;
      cy = pen.y;
    } else return;
    if (reach < 1) return;
    const low = share < LOW_SHARE;
    const x0 = left + cx * S;
    const y0 = top + cy * S;
    const radius = reach * S;
    const size = low ? 4 : 3;
    const count = Math.max(12, Math.floor((Math.PI * 2 * radius) / 9));
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, WIDTH * S, HEIGHT * S);
    ctx.clip();
    for (const [color, grow, alphaScale] of [
      ["#fdf8f3", 2, 0.7],
      [low ? "#c9462f" : "#1a1a1a", 0, 1],
    ] as const) {
      ctx.globalAlpha = strength * alphaScale * (low ? 1 : 0.8);
      ctx.fillStyle = color;
      for (let k = 0; k < count; k += 2) {
        const angle = (k / count) * Math.PI * 2;
        const px = Math.round(x0 + Math.cos(angle) * radius - (size + grow) / 2);
        const py = Math.round(y0 + Math.sin(angle) * radius - (size + grow) / 2);
        ctx.fillRect(px, py, size + grow, size + grow);
      }
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
    return phase === "play" && !paused && !levelsOpen && world.status !== "cleared" && world.status !== "failed";
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

  /** A straw refused for want of straw: the gauge says so, with a shake, and taking one back is taught there. */
  function outOfStraw() {
    if (paced("empty", 0.8)) gaugeShake = GAUGE_SHAKE;
    if (!outAnnounced) syncGauge();
    if (world.strokes.length) teach({ lesson: LESSONS.takeBack, target: { kind: "gauge", index: 0 } });
  }

  /** Starts a straw at a world point; says why if it can't. A pen down ends any lesson's hold. */
  function startDraft(x: number, y: number) {
    editing();
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
      syncGauge();
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
    if (strawLeft(world) >= 0.5) flashNoDraw(cx, cy);
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
    const drawn = commitStroke(world);
    if (drawn >= 0) {
      strawVersion++;
      judgeRoute(drawn);
    }
    syncHud();
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
    if (!stroke) return false;
    editing();
    if (!removeStroke(world, id)) return false;
    crumbs(stroke.points);
    sfxErase();
    strawVersion++;
    coach.done(LESSONS.takeBack.id);
    judgeRoute(-1);
    if (hoverId === id) hoverId = -1;
    syncHud();
    return true;
  }

  function cancelGesture() {
    if (gesture?.drawing) cancelStroke(world);
    gesture = null;
    draftUsed = world.draftLength;
  }

  function onStageDown(event: PointerEvent) {
    inputMode = event.pointerType === "mouse" ? "mouse" : "touch";
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
      draftUsed = 0;
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
    const key = event.key;
    const lower = key.toLowerCase();
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (levelsOpen) {
      // The dialog's tiles take their own keys; L closes it again.
      if (lower === "l") {
        event.preventDefault();
        closeLevels();
      }
      return;
    }
    if (paused || phase === "idle" || phase === "done") return;
    if (lower === "l") {
      event.preventDefault();
      void openLevels();
      return;
    }
    // A focused button (Pause, Mute, the slip's Continue) keeps its own Enter and Space.
    if ((key === " " || key === "Enter") && isOnControl(event)) return;
    // On the playfield, Enter ends the explanation that is up, as its slip says.
    if (key === "Enter" && coachContinuable) {
      event.preventDefault();
      continueLesson();
      return;
    }
    if (ARROWS[key] || key === " " || key === "Delete") inputMode = "keys";
    if (phase === "result") {
      if (key === " " || key === "Enter" || ARROWS[key]) event.preventDefault();
      if (key === " " || key === "Enter") trySkip();
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
    if (lower === "c") clearAll();
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
      else {
        cancelStroke(world);
        syncGauge();
      }
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
    if (lessonHolds && world.status === "waiting") editing();
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
      // Pressing Pour is what its lesson asks for, taught or not, and ends
      // planning at once: what held the room lets go, and the kettle starts
      // on the next step.
      coach.done(LESSONS.pour.id);
      pourLatched = true;
      lessonHolds = false;
      endPlanningLesson();
      liveMessage = "Pouring early.";
      syncHud();
    }
  }

  function clearAll() {
    if (!playable() || !world.strokes.length) return;
    editing();
    for (const stroke of world.strokes) crumbs(stroke.points);
    clearStrokes(world);
    sfxErase();
    strawVersion++;
    syncHud();
  }

  /** Next, from its button or its key: a lesson about the result is read first, as with Enter and Space. */
  function next() {
    if (phase !== "result" || !lastCleared || paused || levelsOpen) return;
    if (coachContinuable) {
      continueLesson();
      return;
    }
    advance();
  }

  /** Bar buttons keep focus for keyboard users, and hand it back after a click. */
  function barAction(event: MouseEvent, action: () => void) {
    action();
    if (event.detail > 0) focusPlayfield();
  }

  // --- Pause, the level select, and closing time ---------------------------------------------

  async function pauseGame() {
    if (paused || levelsOpen || phase === "idle" || phase === "done") return;
    paused = true;
    releaseAll();
    setPour(0);
    setMusicPaused(true);
    liveMessage = "The game is paused.";
    await tick();
    pauseCard?.focus();
  }

  function resumeGame() {
    if (!paused) return;
    paused = false;
    loop.resync();
    setMusicPaused(false);
    sfxBlip();
    liveMessage = "The game resumed.";
    focusPlayfield();
  }

  function togglePause() {
    if (levelsOpen || phase === "done") return;
    if (paused) resumeGame();
    else void pauseGame();
  }

  function focusPlayfield() {
    playfield?.focus({ preventScroll: true });
  }

  /**
   * Focus reached the playfield from the keyboard: the lessons word
   * themselves for the pen keys, and the pen shows, so a keyboard player
   * isn't left guessing.
   */
  function onPlayfieldFocus() {
    let keyboard = false;
    try {
      keyboard = playfield.matches(":focus-visible");
    } catch {
      keyboard = false;
    }
    if (!keyboard) return;
    inputMode = "keys";
    penVisible = true;
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

  $: openRooms = unlockedRooms(progress);
  $: summary = progressSummary(progress);
  $: score = progressTotal(progress);
  $: nextLevel = nextRoom(progress);
  $: isAfterHours = levelIndex >= AFTER_HOURS;

  /** Whether a level-select tile (an authored room, or after hours) can be played. */
  function tileOpen(index: number) {
    return index >= AFTER_HOURS ? progress.afterHours : !!openRooms[index];
  }

  function tileLabel(index: number) {
    if (index >= AFTER_HOURS) return progress.afterHours ? `after hours, endless remixes${index === nextLevel ? ", next" : ""}` : "after hours, locked";
    const n = index + 1;
    if (!openRooms[index]) return `room ${n}, locked`;
    const stars = progress.stars[index];
    const scored = stars > 0 ? `, ${stars} of 3 stars, best ${progress.points[index]} points` : ", not cleared yet";
    return `room ${n}, ${ROOMS[index].name}${scored}${index === nextLevel ? ", next" : ""}`;
  }

  /** Opens the level select over the room, which waits until it closes. */
  async function openLevels() {
    if (levelsOpen || paused || phase === "countdown" || phase === "done") return;
    levelsOpen = true;
    releaseAll();
    setPour(0);
    if (musicStarted) setMusicPaused(true);
    syncHud();
    // Read fresh: progress may have changed this tick, before the reactive copies catch up.
    const now = progressSummary(progress);
    focusedTile = nextRoom(progress);
    liveMessage = `Rooms. ${now.cleared} of ${ROOMS.length} cleared, ${now.stars} of ${now.maxStars} stars.`;
    await tick();
    tileButtons[focusedTile]?.focus();
  }

  /** Back to the room, which carries on; with no room started yet, back to the arcade menu. */
  function closeLevels() {
    if (!levelsOpen) return;
    if (!roomStarted) {
      toMenu();
      return;
    }
    levelsOpen = false;
    loop.resync();
    if (musicStarted) setMusicPaused(false);
    sfxBlip();
    syncHud();
    liveMessage = phase === "play" ? `Back to ${room.name}.` : liveMessage;
    focusPlayfield();
  }

  function chooseLevel(index: number) {
    if (!tileOpen(index)) {
      liveMessage = index >= AFTER_HOURS ? `After hours opens once room ${ROOMS.length} is cleared.` : `Room ${index + 1} opens once room ${index} is cleared.`;
      return;
    }
    levelsOpen = false;
    sfxBlip();
    releaseAll();
    playLevel(index);
    focusPlayfield();
  }

  /**
   * The tile straight above or below another, by where they sit on screen:
   * the grid shows one page to a row on a phone and two on a wider screen.
   */
  function tileAcross(index: number, direction: 1 | -1) {
    const from = tileButtons[index]?.getBoundingClientRect();
    if (!from) return index;
    const centre = from.left + from.width / 2;
    let best = index;
    let bestGap = Infinity;
    let bestOff = Infinity;
    tileButtons.forEach((button, i) => {
      if (!button || i === index) return;
      const box = button.getBoundingClientRect();
      const gap = direction > 0 ? box.top - from.bottom : from.top - box.bottom;
      if (gap < -2) return;
      const off = Math.abs(box.left + box.width / 2 - centre);
      // The nearest row first, then the tile closest under the one we left.
      if (gap < bestGap - 4 || (Math.abs(gap - bestGap) <= 4 && off < bestOff)) {
        best = i;
        bestGap = gap;
        bestOff = off;
      }
    });
    return best;
  }

  function onTileKey(event: KeyboardEvent, index: number) {
    const last = AFTER_HOURS;
    let to = -1;
    if (event.key === "ArrowRight") to = Math.min(last, index + 1);
    else if (event.key === "ArrowLeft") to = Math.max(0, index - 1);
    else if (event.key === "ArrowDown") to = tileAcross(index, 1);
    else if (event.key === "ArrowUp") to = tileAcross(index, -1);
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = last;
    if (to < 0) return;
    event.preventDefault();
    event.stopPropagation();
    focusedTile = to;
    tileButtons[to]?.focus();
  }

  /** Escape closes the level select before the arcade's own Escape can quit. */
  function onEscapeFirst(event: KeyboardEvent) {
    if (event.key !== "Escape" || !levelsOpen) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeLevels();
  }

  /** Closing time: the last room is cleared, and the slip scores every room's best. */
  async function openSlip() {
    phase = "done";
    holdResult = true;
    releaseAll();
    setPour(0);
    const result = concludeRun("spill", score, "time");
    musicStarted = false;
    localBest = result.best;
    newBest = result.newBest;
    liveMessage = `Closing time. ${score} points across all ${ROOMS.length} rooms.`;
    await tick();
    slip?.focus();
  }

  /** The slip closes onto the level select, with after hours open. */
  function closeSlip() {
    phase = "result";
    resultAge = 0;
    newBest = false;
    void openLevels();
  }

  function beginRun() {
    countdown = 0;
    goVisible = true;
    timers.later(() => (goVisible = false), 620);
    setMusicPhase(phaseFor(room));
    startMusic();
    musicStarted = true;
    sfxStart();
    phase = "play";
    syncHud();
    announceRoom();
    focusPlayfieldIfIdle();
  }

  /** Set once lessons have run on this device: progress saved before then shows what was already played. */
  const LESSONS_SEEN_KEY = "boba_spill_lessons";

  /**
   * Whether this is the first visit since the game began teaching in play
   * (marked as it is asked). Only then does saved progress count lessons as
   * known; after that, the device's own lessons say what it knows.
   */
  function firstVisitWithLessons() {
    try {
      if (window.localStorage.getItem(LESSONS_SEEN_KEY)) return false;
      window.localStorage.setItem(LESSONS_SEEN_KEY, "1");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * How the game opens. A device that has cleared nothing goes straight
   * into room 1 through the countdown (and returns true: focus goes to the
   * playfield); one with progress gets the level select over the next room,
   * that room in focus. Lessons start afresh for the visit.
   */
  function openGame() {
    progress = cleanProgress(readSpillProgress(mode));
    coach.reset();
    lessonHold.clear();
    quietFor = Infinity;
    if (firstVisitWithLessons()) {
      // A save from before the lessons: what its cleared rooms taught (in either mode) is known.
      const other = cleanProgress(readSpillProgress(expert ? "normal" : "expert"));
      for (const id of knownFrom((index) => progress.stars[index] > 0 || other.stars[index] > 0)) coach.skip(id);
    }
    if (progressSummary(progress).cleared === 0) {
      playLevel(0);
      return true;
    }
    const start = nextRoom(progress);
    enterRoom(start >= AFTER_HOURS ? LAST_ROOM : start);
    phase = "idle";
    void openLevels();
    return false;
  }

  // --- The loop ----------------------------------------------------------------------

  /**
   * One frame of play: the countdown, or the room on its fixed clock. The
   * lessons run on real time (`rawDt`), so a hold lasts as long on a slow
   * device as a fast one.
   */
  function update(dt: number, rawDt: number) {
    clock += dt;
    if (phase === "countdown") {
      const nextCount = stepCountdown(countdownElapsed, countdown, Math.min(rawDt, 0.25));
      countdownElapsed = nextCount.elapsed;
      if (nextCount.beep) {
        countdown = nextCount.count;
        sfxCountdown(countdown);
      }
      if (nextCount.done) beginRun();
    } else if (phase === "play" || phase === "result") {
      coach.step(rawDt, dt);
      quietFor = coach.current ? 0 : quietFor + rawDt;
      if (phase === "play") {
        checkLessons();
        dropLostTarget();
      }
      // Real time, capped at a second as the coach's own clock is, so a slow
      // device's long frames still spend the hold as they pass.
      updateHold(Math.min(rawDt, 1));
      if (phase === "play") {
        stepPen(dt);
        simulate(dt, lessonHolds);
      } else {
        // The verdict is in, and the tea keeps moving until the room changes;
        // a lesson about the result holds the next room back while it explains.
        simulate(dt);
        if (!lessonHolds) resultAge += dt;
        if (!holdResult && !lessonHolds && resultAge >= (lastCleared ? CLEAR_SECONDS : FAIL_SECONDS)) advance();
      }
      // The spotlight follows the lesson shown, held or not (expert's too):
      // up while it explains, gone as it is done or its move is made.
      const explains = !!cue && coach.current === cue.lesson && placedCue === cue && !coach.leaving && !coach.acting;
      if (explains !== lessonExplains) lessonExplains = explains;
      const dimTarget = explains ? 1 : 0;
      lessonDim = reduceMotion ? dimTarget : lessonDim + (dimTarget - lessonDim) * (1 - Math.exp(-rawDt / 0.18));
      const lit = explains && cue ? (cue.target.kind === "pour" ? "pour" : cue.target.kind === "gauge" ? "gauge" : null) : null;
      if (lit !== barLit) barLit = lit;
    }
    // Held while the tea is coming, the whole room stops: splashes, steam,
    // a kettle tipping. Held in planning, only the room's clock does.
    const frozen = phase === "play" && lessonHolds && world.status !== "waiting";
    if (phase !== "idle") stepVisuals(frozen ? 0 : dt);
    gaugeShake = Math.max(0, gaugeShake - rawDt);
    if (caption) {
      captionAge += dt;
      if (captionAge >= captionLife) caption = null;
      // A retry's hint goes once the tea is coming.
      else if (captionLife === Infinity && phase === "play" && world.status !== "waiting") caption = null;
    }
    if (hudTick(dt)) syncHud();
  }

  const loop = createFrameLoop({
    update,
    draw,
    // The level select and closing time hold the room too; it is still drawn.
    isPaused: () => paused || levelsOpen || phase === "done",
  });

  // --- Sizing and lifecycle -------------------------------------------------------------

  /** Copies a DOM rect into a box (CSS px); an empty one when there is no element. */
  function measureInto(box: { x: number; y: number; w: number; h: number }, element: Element | null) {
    const r = element?.getBoundingClientRect();
    box.x = r?.left ?? 0;
    box.y = r?.top ?? 0;
    box.w = r?.width ?? 0;
    box.h = r?.height ?? 0;
  }

  /**
   * Measures the controls where the bar's styles put them, and fits the
   * painted gauge into its box: the biggest cells the box allows, centred,
   * its corner on the kitchen's grid.
   */
  function measureControls() {
    measureInto(controlBoxes.pour, pourButton);
    measureInto(controlBoxes.clear, clearButton);
    const r = gaugeEl?.getBoundingClientRect();
    const fit = r ? gaugeFit(r.width, r.height) : null;
    if (!r || !fit) {
      gaugeUnit = 0;
      gaugeBox.x = gaugeBox.y = gaugeBox.w = gaugeBox.h = 0;
      return;
    }
    gaugeUnit = fit.unit;
    gauge = gaugeLayout(fit.columns);
    gaugeBox.w = gauge.width * fit.unit;
    gaugeBox.h = gauge.height * fit.unit;
    gaugeBox.x = Math.round((r.left + (r.width - gaugeBox.w) / 2) / SC) * SC;
    gaugeBox.y = Math.round((r.top + (r.height - gaugeBox.h) / 2) / SC) * SC;
  }

  function layout() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    ctx = fitCanvas(canvas, viewW, viewH);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    sideLayout = window.matchMedia(SIDE_QUERY).matches;
    const hudBottom = hudRow ? hudRow.getBoundingClientRect().bottom : 72;
    hudBottomPx = hudBottom;
    const bar = barEl?.getBoundingClientRect();
    if (sideLayout && bar) {
      // The controls stand in a cabinet beside the room (its styles put them
      // low on the right): the room takes the height under the tickets and
      // the width left of the cabinet, centred there.
      const top = hudBottom + 12;
      const availH = Math.max(120, viewH - 16 - top);
      const availW = Math.max(120, bar.left - 12 - 24 - 16);
      S = Math.max(0.5, Math.floor(Math.min(availW / RW, availH / RH) * 16) / 16);
      ox = Math.round((16 + (availW - RW * S) / 2) * dpr) / dpr;
      oy = Math.round((top + (availH - RH * S) / 2) * dpr) / dpr;
    } else {
      const barTop = bar ? bar.top : viewH;
      const top = hudBottom + CAPTION_SPACE;
      const availH = Math.max(160, barTop - 8 - top);
      const availW = viewW - (viewW < 560 ? 0 : 48);
      S = Math.max(0.5, Math.floor(Math.min(availW / RW, availH / RH) * 16) / 16);
      ox = Math.round(((viewW - RW * S) / 2) * dpr) / dpr;
      oy = Math.round((top + (availH - RH * S) / 2) * dpr) / dpr;
    }
    rx = ox + MX * S;
    ry = oy + MT * S;
    if (sideLayout && bar) {
      // Over the cabinet, as wide as it is.
      captionStyle = `left: ${Math.round(bar.left + bar.width / 2)}px; bottom: ${Math.round(viewH - bar.top + 20)}px; max-width: ${Math.round(bar.width + 24)}px`;
    } else {
      captionTop = Math.max(hudBottom + 6, oy - CAPTION_SPACE + 6);
      captionStyle = `left: 50%; top: ${captionTop}px`;
    }
    verdictTop = ry + HEIGHT * S * 0.3;
    roomCenterX = rx + (WIDTH * S) / 2;
    measureControls();
    dynCanvas ??= makeCanvas(RW, RH);
    dynCtx ??= dynCanvas.getContext("2d");
    dynImage ??= new ImageData(RW, RH);
    bakeKitchen();
    // A lesson pointing at a control finds it again where the resize put it.
    placeRect = null;
    draw();
  }

  onMount(() => {
    dialFont = arcadeFont(Math.max(10, Math.round(11 * Math.min(1.2, S / 2))), 700);
    const unmountShell = mountShell({
      isOver: () => phase === "done",
      isPaused: () => paused || levelsOpen,
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
    // Capture, so the level select's Escape is seen before the arcade's.
    window.addEventListener("keydown", onEscapeFirst, true);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);

    // A phone is taught with taps until it shows otherwise.
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) inputMode = "touch";

    tick().then(() => {
      if (!active) return;
      layout();
      dialFont = arcadeFont(Math.max(10, Math.round(10 + S * 1.2)), 700);
      // Into room 1, focus rests on the playfield so its keys work at once;
      // the level select puts it on the next room's tile itself.
      if (openGame()) focusPlayfield();
      loop.start();
    });

    return () => {
      active = false;
      loop.stop();
      timers.clear();
      setPour(0);
      stopMusic();
      window.removeEventListener("keydown", onTab);
      window.removeEventListener("keydown", onEscapeFirst, true);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      unmountShell();
    };
  });

  // What the gauge says to a screen reader (the canvas paints the same reading).
  $: strawLeftNow = Math.max(0, strawBudget - strawUsed - draftUsed);
  $: leftShare = strawBudget > 0 ? clamp(strawLeftNow / strawBudget, 0, 1) : 0;
  $: strawFigure = Math.round(strawLeftNow);
  $: strawOut = strawLeftNow < 0.5;
  $: strawLow = !strawOut && leftShare < LOW_SHARE;
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
  <div bind:this={playfield} class="sr-only" tabindex="-1" role="group" aria-label="Spill playfield" on:focus={onPlayfieldFocus}></div>
  <header class="boba-hud boba-ui is-bare" aria-label="Spill status">
    <div bind:this={hudRow} class="boba-hud-row">
      <div class="boba-ticket boba-ticket-start boba-riso" style="--tilt: -1.1deg">
        <span class="boba-ticket-icon" aria-hidden="true">
          <PixelIcon grid={MENU_ICONS.spill.grid} palette={MENU_ICONS.spill.palette} px={3} />
        </span>
        <span class="boba-big" aria-label="Score {score}">{String(score).padStart(4, "0")}</span>
        <ExpertTag />
      </div>

      <div class="boba-ticket boba-ticket-center boba-riso sp-room-ticket" style="--tilt: 0.8deg">
        <span class="boba-stack">
          <span class="boba-meta">{roomLabel}</span>
          <span class="boba-phase sp-room-name">{roomName}</span>
        </span>
        {#if isAfterHours}
          <span class="sp-count" role="img" aria-label="{afterHoursCleared} after-hours {afterHoursCleared === 1 ? 'room' : 'rooms'} poured">
            <span class="sp-count-figure" aria-hidden="true">{afterHoursCleared}</span>
            <span class="boba-meta" aria-hidden="true">poured</span>
          </span>
        {:else}
          <span class="sp-pips" role="img" aria-label="{previewStars} of 3 stars so far">
            {#each [0, 1, 2] as index}
              <span class="sp-pip" class:is-on={index < previewStars}>
                <PixelIcon grid={STAR} palette={index < previewStars ? STAR_ON : STAR_OFF} px={2} />
              </span>
            {/each}
          </span>
        {/if}
      </div>

      <div class="boba-ticket boba-ticket-end boba-riso" style="--tilt: -0.6deg">
        <span class="sp-hud-buttons">
          <button
            type="button"
            class="boba-icon-btn"
            disabled={phase === "countdown" || phase === "done" || paused}
            aria-label="Levels"
            aria-keyshortcuts="L"
            aria-haspopup="dialog"
            aria-expanded={levelsOpen}
            title="Levels (L)"
            on:click={() => (levelsOpen ? closeLevels() : void openLevels())}
          >
            <PixelIcon grid={ICON_LEVELS} palette={ICON_AUDIO_PAL} px={2} />
          </button>
          <HudButtons {paused} disabled={phase === "idle" || phase === "done" || levelsOpen} on:pause={togglePause} />
        </span>
      </div>
    </div>
  </header>

  <!-- The same line goes to the live region, so this copy is hidden. It steps aside while a lesson is up. -->
  {#if caption}
    {#key caption.id}
      <p
        bind:this={captionEl}
        class="sp-caption boba-ui boba-chip"
        class:is-hidden={captionHidden}
        class:is-side={sideLayout}
        style={captionStyle}
        aria-hidden="true"
      >
        {caption.line}
      </p>
    {/key}
  {/if}

  {#if verdict}
    {#key verdict.id}
      <div bind:this={verdictEl} class="sp-verdict boba-ui boba-chip" style="top: {verdictTop}px; left: {roomCenterX}px" aria-hidden="true">
        <span class="sp-verdict-stars">
          {#each [0, 1, 2] as index}
            <span class="sp-verdict-star" class:is-on={index < verdict.stars} style="--delay: {index * STAR_STAGGER}s">
              <PixelIcon grid={STAR} palette={index < verdict.stars ? STAR_ON : STAR_OFF} px={4} />
            </span>
          {/each}
        </span>
        <span class="sp-verdict-points">{verdict.points} points</span>
      </div>
    {/key}
  {/if}

  <!-- The controls, set into the counter under the room (into a cabinet beside it on a short, wide
       screen): Pour (Next once a room is cleared) and Clear are pixel keys, and the straw gauge is
       painted into the counter between them, in this box. While a lesson explains, the keys step
       back with the kitchen except the one it is about. -->
  <div bind:this={barEl} class="sp-bar boba-ui" class:is-spot={lessonExplains}>
    <button
      bind:this={pourButton}
      type="button"
      class="boba-key is-primary sp-key"
      class:is-lit={barLit === "pour"}
      disabled={!canNext && !canPour}
      aria-keyshortcuts="Enter"
      on:click={(event) => barAction(event, canNext ? next : pour)}
    >
      <!-- Both words hold the key's width, so it never changes size as Pour turns to Next. -->
      <span class="sp-key-words">
        <span class:is-off={canNext}>Pour</span>
        <span class:is-off={!canNext}>Next</span>
      </span>
      <kbd aria-hidden="true">Enter</kbd>
    </button>

    <div
      bind:this={gaugeEl}
      class="sp-gauge"
      role="img"
      aria-label={strawOut ? "Out of straw" : `${strawFigure} units of straw left${strawLow ? ", low" : ""}`}
    ></div>

    <button
      bind:this={clearButton}
      type="button"
      class="boba-key sp-key"
      disabled={!canClear}
      aria-keyshortcuts="C"
      on:click={(event) => barAction(event, clearAll)}
    >
      Clear
      <kbd aria-hidden="true">C</kbd>
    </button>
  </div>

  <!-- The lesson's callout, beside the fixture, the ghost route, the cup, or the control it is about:
       inside the play scope, so Tab reaches its Continue. -->
  <Coach
    lesson={coachLesson}
    x={coachX}
    y={coachY}
    side={coachSide}
    ring={coachRing}
    width={coachWidth}
    height={coachHeight}
    bind:slipW={coachSlipW}
    bind:slipH={coachSlipH}
    scene={coachScene}
    leaving={coachLeaving}
    ended={coachEnded}
    touch={inputMode === "touch"}
    continuable={coachContinuable}
    on:continue={continueLesson}
    returnFocus={focusPlayfield}
    hidden={paused || levelsOpen || phase === "done" || phase === "countdown"}
    top={hudBottomPx + 8}
  />
</div>

{#if levelsOpen}
  <div class="boba-scrim boba-ui" role="dialog" aria-modal="true" aria-labelledby="sp-levels-title">
    <div bind:this={levelsCard} class="boba-card boba-riso boba-pause-card sp-levels-card" tabindex="-1">
      <div class="sp-levels-head">
        <h2 id="sp-levels-title" class="boba-title">rooms</h2>
        <p class="sp-levels-stats">
          <span><strong>{summary.total}</strong> points</span>
          <span><strong>{summary.stars}</strong> of {summary.maxStars} stars</span>
        </p>
      </div>
      <div class="sp-rooms" role="group" aria-label="Rooms, three to a page">
        {#each ROOMS as level, index}
          {@const open = tileOpen(index)}
          <button
            bind:this={tileButtons[index]}
            type="button"
            class="sp-tile"
            class:is-page-right={index % (ROOM_COLUMNS * 2) === ROOM_COLUMNS}
            class:is-locked={!open}
            class:is-next={index === nextLevel}
            class:is-current={roomStarted && index === levelIndex}
            tabindex={index === focusedTile ? 0 : -1}
            aria-disabled={open ? undefined : "true"}
            aria-label={tileLabel(index)}
            on:click={() => chooseLevel(index)}
            on:keydown={(event) => onTileKey(event, index)}
            on:focus={() => (focusedTile = index)}
          >
            <span class="sp-tile-top">
              <span class="sp-tile-number">{pad2(index + 1)}</span>
              {#if open}
                <span class="sp-tile-stars">
                  {#each [0, 1, 2] as star}
                    <span class="sp-tile-star" class:is-on={star < progress.stars[index]}>
                      <PixelIcon grid={STAR} palette={star < progress.stars[index] ? STAR_ON : STAR_OFF} px={1} />
                    </span>
                  {/each}
                </span>
              {:else}
                <span class="sp-tile-lock"><PixelIcon grid={ICON_LOCK} palette={LOCK_PAL} px={2} /></span>
              {/if}
            </span>
            <span class="sp-tile-name">{level.name}</span>
          </button>
        {/each}
        <button
          bind:this={tileButtons[AFTER_HOURS]}
          type="button"
          class="sp-tile sp-tile-wide"
          class:is-locked={!progress.afterHours}
          class:is-next={nextLevel === AFTER_HOURS}
          class:is-current={roomStarted && isAfterHours}
          tabindex={focusedTile === AFTER_HOURS ? 0 : -1}
          aria-disabled={progress.afterHours ? undefined : "true"}
          aria-label={tileLabel(AFTER_HOURS)}
          on:click={() => chooseLevel(AFTER_HOURS)}
          on:keydown={(event) => onTileKey(event, AFTER_HOURS)}
          on:focus={() => (focusedTile = AFTER_HOURS)}
        >
          <span class="sp-tile-top">
            <span class="sp-tile-name sp-tile-hours">after hours</span>
            {#if !progress.afterHours}
              <span class="sp-tile-lock"><PixelIcon grid={ICON_LOCK} palette={LOCK_PAL} px={2} /></span>
            {/if}
          </span>
          <span class="boba-meta">{progress.afterHours ? "every room again, remixed" : `opens when room ${ROOMS.length} is cleared`}</span>
        </button>
      </div>
      <div class="boba-actions">
        <button type="button" class="boba-btn secondary" aria-keyshortcuts="Escape" on:click={closeLevels}>
          {roomStarted ? "Back" : "Menu"}
          <kbd aria-hidden="true">Esc</kbd>
        </button>
      </div>
    </div>
  </div>
{/if}

{#if countdown > 0 && phase === "countdown"}
  <Countdown value={countdown} />
{:else if goVisible}
  <Countdown value={0} />
{/if}

{#if paused}
  <PauseCard bind:this={pauseCard} on:resume={resumeGame} on:menu={toMenu} on:exit={exit} />
{/if}

{#if phase === "done"}
  <ResultsSlip
    bind:this={slip}
    game="spill"
    title="closing time"
    deck="Every room poured."
    {score}
    unit="points"
    {newBest}
    share={shareLines(progress)}
    stats={[
      { label: "rooms cleared", value: summary.cleared },
      { label: "stars", value: `${summary.stars} of ${summary.maxStars}` },
      { label: "three-star rooms", value: summary.threeStar },
      { label: "tea spilled", value: teaSpilled },
      { label: "personal best", value: localBest },
    ]}
    on:restart={closeSlip}
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

  .sp-hud-buttons {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .sp-hud-buttons > .boba-icon-btn:disabled {
    cursor: default;
    opacity: 0.6;
  }

  /* After hours: how many remixes have been poured this visit. */
  .sp-count {
    display: inline-grid;
    justify-items: center;
    gap: var(--space-0-5);
  }

  .sp-count-figure {
    color: var(--b-strong);
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: lining-nums tabular-nums;
    line-height: 1;
  }

  /* --- Caption chip: the room's name, or a spill's hint, in the strip above the room --- */

  /* A pixel chip like the callout's (`.boba-chip`: the dark riso paper, stepped
     corners, a faint cream rule), cream italic in the one family. It steps in,
     as pixel things do. Beside the room (a short, wide screen), it sits over
     the cabinet of controls instead; its place comes from the layout. */
  .sp-caption {
    position: fixed;
    z-index: calc(var(--layer-overlay) + 3);
    width: max-content;
    max-width: min(34rem, calc(100vw - var(--space-8)));
    margin: 0;
    padding: 0.5rem 0.875rem 0.5625rem;
    font-family: var(--font-ui);
    font-size: 0.9375rem;
    font-style: italic;
    font-weight: 400;
    line-height: 1.4;
    text-align: center;
    text-wrap: balance;
    pointer-events: none;
    transform: translateX(-50%);
    animation: sp-chip-in var(--motion-slow) steps(3, end) both;
  }

  /* One message at a time: a lesson up elsewhere hides the chip, not forgets it. */
  .sp-caption.is-hidden {
    visibility: hidden;
  }

  @keyframes sp-chip-in {
    from {
      opacity: 0;
      transform: translate(-50%, 4px);
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
    color: #fdf8f3;
  }

  /* Each star drops in a cell at a time. */
  .sp-verdict-star {
    display: inline-grid;
    animation: sp-land 320ms steps(4, end) var(--delay) both;
  }

  .sp-verdict-star:not(.is-on) {
    opacity: 0.4;
    animation: none;
  }

  .sp-verdict-points {
    color: #e8d5c4;
    font-family: var(--font-ui);
    font-size: 0.875rem;
    font-style: italic;
    line-height: 1.25;
  }

  @keyframes sp-land {
    from {
      opacity: 0;
      transform: translateY(-16px);
    }
    75% {
      opacity: 1;
      transform: translateY(4px);
    }
  }

  /* --- The controls: pixel keys set into the counter under the room --- */

  /* The bar only places the keys and the gauge's box: the counter, the sockets
     and the gauge itself are painted into the kitchen behind them, measured
     where these styles put them on each resize, so nothing moves in play. */
  .sp-bar {
    position: fixed;
    inset: auto 0 0;
    /* Under the lesson's callout (which comes after it), so a slip that has
       to cover a key for a moment is never cut by it. */
    z-index: calc(var(--layer-overlay) + 2);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-4) max(var(--space-4), env(safe-area-inset-bottom));
    pointer-events: none;
  }

  /* `.boba-key` prints a dark pixel key (Pour the accent one); its key chip sits beside the word. */
  .sp-key {
    grid-auto-flow: column;
    min-width: 6rem;
    min-height: 3rem;
    pointer-events: auto;
    transition: filter 180ms var(--ease-standard);
  }

  .sp-key-words {
    display: inline-grid;
  }

  .sp-key-words > span {
    grid-area: 1 / 1;
  }

  .sp-key-words > .is-off {
    visibility: hidden;
  }

  /* A lesson explaining: the keys step back with the kitchen, except the one it is about. */
  .sp-bar.is-spot > .sp-key:not(.is-lit) {
    filter: brightness(0.62) saturate(0.85);
  }

  /* The gauge's box: four-pixel cells, at least as wide as its top line
     (gaugeFit in spill-gauge.js), never so long the bar outgrows the room. */
  .sp-gauge {
    flex: 1 1 208px;
    min-width: 208px;
    max-width: 320px;
    height: 56px;
    pointer-events: auto;
    cursor: default;
  }

  @media (hover: none) and (pointer: coarse) {
    .sp-key {
      font-size: 0.9375rem;
    }
  }

  /* A phone: three-pixel cells, so the keys and the gauge share one row. */
  @media (max-width: 480px) {
    .sp-bar {
      gap: var(--space-2);
      padding-inline: var(--space-3);
    }

    .sp-key {
      min-width: 4.75rem;
      padding-inline: var(--space-2-5);
    }

    .sp-gauge {
      flex-basis: 156px;
      min-width: 156px;
      height: 42px;
    }
  }

  /* Narrower still: the gauge takes a row of its own above the keys. */
  @media (max-width: 359px) {
    .sp-gauge {
      flex-basis: 100%;
      order: -1;
      max-width: none;
    }

    .sp-key {
      flex: 1;
    }
  }

  /* A short, wide screen: the keys and the gauge stand in a cabinet low on
     the right, beside the room, the gauge over the keys. (SIDE_QUERY, above.) */
  @media (max-height: 540px) and (min-aspect-ratio: 5/4) {
    .sp-bar {
      inset: auto max(var(--space-5), env(safe-area-inset-right)) max(var(--space-5), env(safe-area-inset-bottom)) auto;
      width: 208px;
      gap: var(--space-2);
      padding: 0;
    }

    .sp-gauge {
      flex: 0 0 100%;
      order: -1;
      min-width: 0;
      max-width: none;
      height: 56px;
    }

    .sp-key {
      flex: 1 1 0;
      min-width: 0;
      padding-inline: var(--space-2);
    }
  }

  /* --- The level select: a page of rooms to a row --- */

  .sp-levels-card {
    width: min(100%, 46rem);
  }

  .sp-levels-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2) var(--space-5);
  }

  .sp-levels-stats {
    display: flex;
    gap: var(--space-4);
    margin: 0;
    color: var(--b-muted);
    font-size: 0.75rem;
    line-height: 1.25;
  }

  .sp-levels-stats strong {
    color: var(--b-strong);
    font-size: 0.9375rem;
    font-weight: 500;
  }

  /* A page of three to a row on a phone, two pages to a row on a wider
     screen, with a little more room between the two. The tiles scroll inside
     the card, so its title and its way out stay in view. */
  .sp-rooms {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    max-height: calc(100dvh - 15rem);
    margin-top: var(--space-5);
    margin-inline: calc(var(--space-1) * -1);
    padding: var(--space-1);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  @media (min-width: 720px) {
    .sp-rooms {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }

    .sp-tile.is-page-right {
      margin-left: var(--space-3);
    }
  }

  .sp-tile {
    position: relative;
    display: grid;
    align-content: start;
    gap: var(--space-1);
    min-height: 3.25rem;
    padding: var(--space-2) var(--space-2-5);
    color: var(--b-strong);
    background: var(--b-raised);
    border: 1px solid var(--b-rule);
    border-radius: 8px 11px 7px 10px;
    cursor: pointer;
    font: inherit;
    text-align: left;
    touch-action: manipulation;
    transition:
      border-color var(--motion-fast) var(--ease-standard),
      background-color var(--motion-fast) var(--ease-standard);
  }

  @media (hover: hover) {
    .sp-tile:not(.is-locked):hover {
      background-image: linear-gradient(var(--b-wash), var(--b-wash));
      border-color: var(--b-muted);
    }
  }

  .sp-tile.is-current {
    border-color: var(--b-line);
  }

  /* The next room to play: a small accent tab on its top edge. */
  .sp-tile.is-next::before {
    content: "";
    position: absolute;
    top: -1px;
    left: var(--space-2-5);
    width: 1.5rem;
    height: 4px;
    background: var(--b-slab);
    border-radius: 0 0 2px 2px;
  }

  .sp-tile.is-locked {
    color: var(--b-muted);
    background: transparent;
    border-style: dashed;
    cursor: default;
    opacity: 0.7;
  }

  .sp-tile-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .sp-tile-number {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 700;
    font-variant-numeric: lining-nums tabular-nums;
    line-height: 1;
  }

  .sp-tile-lock {
    display: inline-grid;
    color: var(--b-muted);
  }

  .sp-tile-name {
    color: var(--b-text);
    font-size: 0.75rem;
    line-height: 1.25;
  }

  .sp-tile.is-locked .sp-tile-name {
    color: var(--b-muted);
  }

  .sp-tile-hours {
    color: var(--b-strong);
    font-size: 0.875rem;
    font-style: italic;
  }

  .sp-tile-stars {
    display: inline-flex;
    gap: 2px;
    color: var(--b-line);
  }

  .sp-tile-star {
    display: inline-grid;
  }

  .sp-tile-star:not(.is-on) {
    opacity: 0.35;
  }

  .sp-tile-wide {
    grid-column: 1 / -1;
    min-height: 3rem;
  }

  .sp-levels-card .boba-actions {
    margin-top: var(--space-5);
  }

  @media (prefers-reduced-motion: reduce) {
    .sp-caption,
    .sp-verdict-star {
      animation: none;
    }

    .sp-key {
      transition: none;
    }

    /* No press travel: the key's foot still shows it pressed. */
    .sp-key:not(:disabled):active {
      transform: none;
    }
  }

  @media (max-width: 640px) {
    .sp-room-ticket {
      gap: var(--space-3);
    }

    .sp-caption {
      font-size: 0.875rem;
    }

    .sp-tile {
      padding: var(--space-2);
    }
  }
</style>
