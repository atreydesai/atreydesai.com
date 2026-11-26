<script lang="ts">
  import { createBackdrop } from "#lib/arcade/scenery/live.ts";
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";
  import { get } from "svelte/store";

  import {
    setMusicPaused,
    setMusicPhase,
    setPourStream,
    sfxBlip,
    sfxBrew,
    sfxBrewed,
    sfxCoin,
    sfxCombo,
    sfxCountdown,
    sfxDump,
    sfxIce,
    sfxIceFull,
    sfxMilestone,
    sfxPlop,
    sfxPump,
    sfxScoop,
    sfxScorch,
    sfxSeal,
    sfxServe,
    sfxShake,
    sfxSputter,
    sfxStart,
    sfxTicket,
    sfxTipJar,
    sfxWalkOut,
    sfxWrong,
    startMusic,
    stopMusic,
  } from "#lib/sfx.ts";
  import { COUNTDOWN_SECONDS, stepCountdown } from "#lib/arcade/countdown.js";
  import {
    BREW_SECONDS,
    CRITIC,
    CROSS_AT,
    RUSH_AT,
    FILL_LINE,
    HAND_OFF_SECONDS,
    ICE_CUBES,
    ICE_MAX,
    LIVES,
    POUR_MAX,
    SHAKES_NEEDED,
    SHARE_FACES,
    SHIFT_SECONDS,
    SUGAR_MAX,
    TANK_CAPACITY,
    TEAS,
    TOPPINGS,
    activePatienceRate,
    cheer,
    comboFor,
    comboProgress,
    criticDue,
    drawFromTank,
    fillJar,
    gradeDrink,
    gradeWord,
    iceGrade,
    iceState,
    jarPayout,
    judgeScoop,
    keepsStreak,
    ladleAt,
    makeOrder,
    maxTickets,
    mostImpatient,
    nextArrivalIn,
    paceForElapsed,
    patienceFor,
    pickRegular,
    pickSpecial,
    pointsForDrink,
    pourGrade,
    rulesFor,
    sampleBoost,
    sampleTarget,
    samplesFor,
    tapFor,
    scoopQueue,
    scoopResult,
    sealGrade,
    sealNeedle,
    sealResult,
    servedMood,
    shakeGrade,
    stationsFor,
    stepPour,
    sugarGrade,
    sugarPumps,
    sugarState,
    tankState,
    timeRemaining,
    waitingMood,
  } from "#lib/arcade/orders-engine.js";
  import type {
    Ice,
    Order,
    Phase,
    Quirk,
    Reaction,
    Regular,
    Station,
    Tea,
    Topping,
    WaitMood,
  } from "#lib/arcade/orders-engine.js";
  import { Crowd } from "#lib/arcade/orders-crowd.ts";
  import { botAct, createBot, type BotView } from "#lib/arcade/orders-bot.js";
  import { TURN_FRAMES, TURN_FROM, drinkGrid, toppingKey, turnIndex, turnShare } from "#lib/arcade/orders-drink.js";
  import { FIGURE_W, JAR_H, JAR_W } from "#lib/arcade/orders-guests.js";
  import { GLYPHS, GLYPH_ROWS, ICONS, TEA_WORDS, wordWidth } from "#lib/arcade/orders-labels.js";
  import {
    CARD_STEPS,
    STATION_LESSON,
    followLessons,
    ladleCentreIn,
    lessonMemory,
    needleCentreIn,
    ticketBeckon,
    type LessonView,
    type Target,
  } from "#lib/arcade/orders-lessons.js";
  import { HAND_KEYS, createKeyLatch, keyHold, releaseFor } from "#lib/arcade/orders-keys.js";
  import { createCoach, type Lesson } from "#lib/arcade/core/coach.ts";
  import { hexToRgb, mixHex, mixRgb, type RGB } from "#lib/arcade/core/color.ts";
  import { bayer } from "#lib/arcade/core/dither.ts";
  import { beckon, drawGhost, drawSpotlight, type FocusBox } from "#lib/arcade/core/ghost.ts";
  import { createFrameLoop, every } from "#lib/arcade/core/loop.ts";
  import { clamp, damp, lerp, smooth } from "#lib/arcade/core/math.ts";
  import {
    ACCENT,
    CREAM,
    INK,
    LID,
    MENU_ICONS,
    NOTE_GOLD,
    PEARL,
    STRAW_PINK,
    addParticle,
    addPopup,
    arcadeFont,
    cachedSprite,
    drawChipNote,
    drawHalo,
    drawParticles,
    drawSprite,
    fitCanvas,
    risoColors,
    stepParticles,
    stepPopups,
    SPRITE_PAD,
    type Particle,
    type Popup,
  } from "#lib/arcade/art.ts";
  import { emojiRows } from "#lib/arcade/share.ts";
  import { arcadeExits, concludeRun, createTimers, isOnControl, mountShell } from "#lib/arcade/shell.ts";
  import { arcadeExpert } from "#lib/boba.ts";
  import Mark from "#lib/components/Mark.svelte";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import Coach from "./Coach.svelte";
  import Countdown from "./Countdown.svelte";
  import CupTimer from "./CupTimer.svelte";
  import ExpertTag from "./ExpertTag.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import Pearls from "./Pearls.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";

  // Order up: regulars walk up and hang a ticket on the rail, each with a
  // drink in mind. Take a ticket (its card pins under the cup), then work
  // the bench by hand: pump the syrup, drop in the ice cube by cube and pour
  // to the line, drop each topping from a swinging ladle, shake it, and
  // stamp the seal while the sealer is hot. Around that, tanks run dry and brew, samples buy a guest time,
  // the critic visits, and one tea is the special. Serving well climbs a
  // combo, fills the tip jar, and cheers the line. Every rule, number and
  // grade lives in orders-engine.js; the guests' art in orders-guests.js and
  // their walk in orders-crowd.ts; this file steps it, draws the bench, and
  // wires it to the arcade. The shift teaches itself as it is played: the
  // first drink on a device is walked through station by station, and later
  // things are named as they first matter (orders-lessons.js says what and
  // when; the shared coach shows one line at a time).

  const { exit, toMenu } = arcadeExits(createEventDispatcher<{ close: null; menu: null }>());

  type Colors = ReturnType<typeof risoColors>;
  /** Where a scoop physically lands. */
  type ScoopOutcome = "clean" | "rim" | "miss";
  /** How a scoop is marked in the queue: a wrong jar is wrong wherever it lands. */
  type ScoopMark = ScoopOutcome | "wrong";
  type SealWord = "sealed" | "loose" | "scorched";

  // --- Names and colours -------------------------------------------------------

  const TEA_NAMES: Record<Tea, string> = {
    milk: "milk tea",
    taro: "taro",
    matcha: "matcha",
    strawberry: "strawberry",
  };
  const TEA_COLORS: Record<Tea, string> = {
    milk: "#c79a6b",
    taro: "#b388e0",
    matcha: "#8bbf5a",
    strawberry: "#f47ba0",
  };
  const TOPPING_NAMES: Record<Topping, string> = {
    pearls: "pearls",
    pudding: "pudding",
    jelly: "jelly",
    redbean: "red bean",
  };
  /** On a phone the tap labels shorten to fit five across. */
  const TEA_SHORT: Record<Tea, string> = {
    milk: "milk",
    taro: "taro",
    matcha: "matcha",
    strawberry: "berry",
  };
  const ICE_NAMES: Record<Ice, string> = { none: "no ice", less: "less ice", regular: "regular ice", extra: "extra ice" };
  /** On a phone's ticket the cubes carry the amount, so the words shorten. */
  const ICE_SHORT: Record<Ice, string> = { none: "no ice", less: "less", regular: "regular", extra: "extra" };
  const sugarName = (sugar: number) => `${sugar}% sugar`;
  const TOPPING_SHORT: Record<Topping, string> = { pearls: "pearls", pudding: "pudding", jelly: "jelly", redbean: "bean" };
  const QUIRK_NAMES: Record<Quirk, string> = {
    hurry: "in a hurry",
    patient: "patient",
    tipper: "big tipper",
    critic: "critic",
  };

  const HAND_LABELS: Record<Station, string> = {
    ice: "Add ice",
    sugar: "Pump syrup",
    pour: "Hold to pour",
    scoop: "Drop",
    shake: "Shake",
    seal: "Seal",
  };
  const SEAL_WORDS: Record<SealWord, string> = { sealed: "sealed", loose: "loose", scorched: "scorched" };

  // --- Timing ----------------------------------------------------------------------

  /** A release below this is a stray tap, not a pour. */
  const MIN_POUR = 0.08;
  const AFTER_POUR = 0.35;
  const RELOAD = 0.35;
  const AFTER_SCOOPS = 0.4;
  const AFTER_SHAKE = 0.25;
  /** The ladle dips into a jar and comes up loaded. */
  const DIP_SECONDS = 0.15;
  /** A cube of ice arcs from the bin into the cup. */
  const ICE_ARC_SECONDS = 0.28;
  /** Once the last cube the ticket wants has landed, this beat, then the pour. */
  const ICE_SETTLE = 0.12;
  /** Within the seal, from the stamp: the plate lands, the straw pops, the cup hops off. */
  const PRESS_LANDS = 0.24;
  const PRESS_LIFTS = 0.34;
  const PRESS_GONE = 0.46;
  const STRAW_IN = 0.3;
  const STRAW_UP = 0.42;
  const HOP_START = 0.46;
  const RECEIPT_SECONDS = 2.4;
  const NOTICE_SECONDS = 1.8;
  const RECENT_NAMES = 6;
  /** A drink graded this or better is perfect. */
  const PERFECT = 95;
  /** A taught station counts as learned at this grade or better ("fine"); below it, the next drink teaches it again. */
  const LESSON_PASS = 55;
  /** The receipt stays this much longer while a lesson is about it. */
  const RECEIPT_LESSON_SECONDS = 1.4;

  // --- Pixel art ----------------------------------------------------------------

  /**
   * The back bar: a wooden shelf on brackets along the wall, and standing on
   * it the ice bin, a dispenser for each tea and the syrup bottle. Each
   * dispenser is a glass tank (its tea showing) on a base whose tap reaches
   * over the shelf's edge, so the stream falls in front of the shelf into the
   * cup on the counter below. Heights in cells, measured from the cup.
   */
  /** A machine's width in cells: 10, or up to 12 where its column has room (so its label can say its name). */
  let tankW = 10;
  /** A machine's height above the shelf: tank, collar, base. */
  const MACHINE_ROWS = 13;
  /** The shelf plank's thickness. */
  const SHELF_ROWS = 2;
  /** The tap's tip sits this far above the cup's rim: a short, visible stream. */
  const STREAM_ROWS = 7;
  /** The tap reaches this far below the shelf's top. */
  const TAP_DROP = 4;
  const WOOD_TOP = "#c79a6b";
  const WOOD_FACE = "#a77a52";
  const WOOD_EDGE = "#5e3d2a";
  const STEEL = "#d9d4cc";
  const STEEL_DARK = "#a9a39a";
  const GLASS = "#e3eff2";
  const SYRUP = "#c98a2e";
  /** The syrup bottle: a pump head, a neck, and a squat bottle of amber syrup. */
  const PUMP_W = 8;
  const PUMP_ROWS = 11;
  const SHAKER = [
    "......OO......",
    "....OOOOOO....",
    "..OOLLLLLLOO..",
    ".OLLLLLLLLLLO.",
  ];
  const FILM = ["OLLLLLLLLLLLLO"];
  const LADLE_BOWL = ["O.......O", "OO.....OO", ".OOOOOOO."];
  const NAPKINS = [".OOOOOO.", ".OppppO.", "OOOOOOOO", "OppppppO", "OOOOOOOO"];
  const STRAW_JAR = ["...S.B.", "..S..B.", "..S.B..", "OOOOOOO", "O.SB..O", "O.SB..O", ".OOOOO."];
  const SPARE_CUP = [
    "OOOOOOOO",
    "OppppppO",
    "OppppppO",
    ".OppppO.",
    ".OppppO.",
    ".OppppO.",
    "..OOOO..",
  ];
  const ICE_CUBE = ["hpO", "ppp", "pps"];
  const ICE_SLOT = "#d3e9f1";
  /** The eight cells round a cube's slot, dotted in to mark where it goes. */
  const ICE_RING: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ];
  const ICE_PALETTE = { h: "#ffffff", p: "#dceef4", s: "#b5d2dc", O: INK };
  /** The ice bin at the left end of the counter: lid propped open, cubes heaped inside. */
  const ICE_BIN = [
    "OO........",
    "OLO.......",
    ".OLO......",
    "..OLO.....",
    "OOOOOOOOOO",
    "OhpOpphpsO",
    "OppshpOppO",
    "OBBBBBBBBO",
    "OBBBBBBBBO",
    "OBBBBBBBBO",
    "OOOOOOOOOO",
  ];
  /** A small star for the critic and the day's special. */
  const STAR = ["..O..", "OOOOO", ".OOO.", ".O.O."];
  /** Light on any page, so dark pearls read against the night theme too. A shade more opaque than art.ts's HALO (0.8), as the bench has always been drawn. */
  const HALO = "rgba(253, 248, 243, 0.85)";

  // Each topping: a 5×3 heaped scoop (ladle, fall, pile, jars) and a 3×2
  // icon (tickets, the scoop queue).
  const SCOOP_COLS = 5;
  const SCOOP_ROWS = 3;
  const TOPPING_ART: Record<Topping, { grid: string[]; icon: string[]; palette: Record<string, string> }> = {
    pearls: { grid: [".b.b.", "b.b.b", ".b.b."], icon: ["b.b", ".b."], palette: { b: PEARL } },
    pudding: { grid: [".CCC.", "PPPPP", "PPPPP"], icon: ["CCC", "PPP"], palette: { C: "#9a5b1e", P: "#f2c14e" } },
    jelly: { grid: ["J.JJ.", "JJ.JJ", ".JJ.J"], icon: ["J.J", "JJ."], palette: { J: "#8bbf5a" } },
    redbean: { grid: [".R.R.", "RRR.R", ".RRR."], icon: ["R.R", ".RR"], palette: { R: "#8a3a2e" } },
  };
  /** On a ticket the pearls take the ink colour, so they show on dark paper. */
  const toppingIconPalette = (kind: Topping) =>
    kind === "pearls" ? { b: "currentColor" } : TOPPING_ART[kind].palette;

  // Topping jars: glass (lid-coloured) filled with the topping, ink outline.
  const JAR_COLS = 7;
  const JAR_ROWS = 7;
  const jarGrids = new Map<Topping, string[]>();
  function jarGrid(kind: Topping) {
    const cached = jarGrids.get(kind);
    if (cached) return cached;
    const art = TOPPING_ART[kind].grid;
    const inside = [0, 1, 2, 3].map((row) => `O${art[row % art.length].replace(/\./g, "p")}O`);
    const grid = [".OOOOO.", "OOOOOOO", ...inside, ".OOOOO."];
    jarGrids.set(kind, grid);
    return grid;
  }

  // The counter cup, in cells: 14 wide and 18 tall. Row 0 is the rim, rows
  // 1–16 the inside, row 17 the base; the walls step in twice on the way down.
  const CUP_W = 14;
  const CUP_H = 18;
  const INSIDE_ROWS = 16;
  const wallInset = (row: number) => (row < 7 ? 0 : row < 13 ? 1 : 2);
  /** The cup's whole shape, for its halo. */
  const CUP_SILHOUETTE = Array.from({ length: CUP_H }, (_, row) => {
    const inset = row === 0 ? 0 : row === CUP_H - 1 ? 2 : wallInset(row);
    return ".".repeat(inset) + "O".repeat(CUP_W - 2 * inset) + ".".repeat(inset);
  });
  /** Just the edge of that shape, one cell thick: the shake's ghost. */
  const CUP_OUTLINE = CUP_SILHOUETTE.map((line, row) =>
    [...line]
      .map((cellChar, col) => {
        if (cellChar !== "O") return ".";
        const inside = (r: number, c: number) => CUP_SILHOUETTE[r]?.[c] === "O";
        return inside(row - 1, col) && inside(row + 1, col) && inside(row, col - 1) && inside(row, col + 1) ? "." : "O";
      })
      .join(""),
  );
  /**
   * Ice: where each cube rests on the bottom, in the order they drop, and
   * where they bob along the top once the tea is in. The cup marks the slots
   * the ticket wants before any go in.
   */
  const ICE_REST: Array<[number, number]> = [
    [3, 14],
    [7, 14],
    [4, 11],
    [8, 11],
    [2, 8],
    [6, 8],
  ];
  /** Floating, by how many cubes are in: their columns along the surface. */
  const ICE_FLOAT: Record<number, number[]> = {
    1: [5],
    2: [3, 7],
    3: [2, 5, 8],
    4: [1, 4, 7, 10],
    5: [1, 4, 7, 10, 5],
    6: [1, 4, 7, 10, 3, 8],
  };
  /** Where landed scoops settle, as [column, row] of each 5×3 sprite. */
  const PILE_SLOTS: Array<[number, number]> = [
    [3, 14],
    [6, 14],
    [3, 11],
    [6, 11],
    [3, 8],
    [6, 8],
  ];
  /** Cells the bench needs, top to bottom (the back bar, the stream, the cup, the counter) and across. */
  const ROWS_NEEDED = 46;
  const COLS_NEEDED = 66;
  /** The ladle hangs from a pivot this many cells above it, out of view. */
  const LADLE_ARM = 60;

  const MOOD_WORDS: Record<WaitMood, string> = {
    calm: "happy to wait",
    glance: "watching the clock",
    cross: "about to leave",
  };

  // --- Types ---------------------------------------------------------------------

  interface Guest {
    id: number;
    regular: Regular;
    order: Order;
    patience: number;
    left: number;
    tilt: number;
    /** Their ticket is on the rail: until then they are walking up, and wait without losing patience. */
    placed: boolean;
    /** Set just before the guest leaves, so the exit can differ. */
    outcome: "served" | "gone" | null;
  }

  /** The cup in progress. Fields stepped every frame are mutated in place. */
  interface Cup {
    guestId: number;
    name: string;
    regular: Regular;
    order: Order;
    stations: Station[];
    station: Station;
    /** Between stations, or with the drink already judged: input waits. */
    busy: boolean;
    /** Cubes of ice the player put in. */
    ice: number;
    /** Pumps of syrup the player gave. */
    sugar: number;
    tea: Tea | null;
    level: number;
    heldSeconds: number;
    pourGrade: number | null;
    queue: Topping[];
    drops: number[];
    results: ScoopMark[];
    pile: Topping[];
    scoopStart: number;
    swing: number;
    /** The jar the ladle last dipped into, and when it comes up carrying it. */
    chosen: Topping;
    loadedAt: number;
    shakes: number;
    shakeStart: number;
    shakeSeconds: number | null;
    /** The gauge's needle runs from this moment. */
    sealStart: number;
    /** Where the needle was at the stamp, and when; null until stamped. */
    sealValue: number | null;
    stampAt: number | null;
    sealed: boolean;
    /** The perfect-drink burst has been decided for this cup. */
    burst: boolean;
    /** A perfect drink, turning once on the counter as it is handed over. */
    turning: boolean;
  }

  /** A cube of ice on its way from the bin to the cup. */
  interface IceArc {
    age: number;
  }

  /** A ticket going up from a guest's hand (bench px) to their slot on the rail; `fx`/`fy` are where it is now, on screen. */
  interface Flight {
    id: number;
    x0: number;
    y0: number;
    t: number;
    fx: number;
    fy: number;
    scale: number;
    turn: number;
  }

  interface Falling {
    kind: Topping;
    result: ScoopOutcome;
    /** Centre x and top y of the sprite, in px. */
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    spin: number;
    /** 0 falling; 1 after the rim or the first bounce; 2 rolling. */
    stage: number;
    splashed: boolean;
    age: number;
    alpha: number;
  }

  interface Receipt {
    id: number;
    /** Where the guest stood, in bench px: the slip rises over them. */
    x: number;
    name: string;
    sentBack: boolean;
    rows: Array<{ label: string; word: string }>;
    points: number;
    /** Rubber stamps beside the points: the tip, the special, the critic, the jar. */
    stamps: string[];
    /** The combo multiplier this drink was paid at, when above 1. */
    combo: number;
    perfect: boolean;
    /** Only a drink sent back carries a line: what went wrong. */
    line: string;
    until: number;
  }

  interface Step {
    id: Station;
    label: string;
    state: "todo" | "current" | "done";
    word: string;
  }

  // --- State -----------------------------------------------------------------

  /** Expert mode, read once as the game opens (the switch lives on the menu). */
  const expert = get(arcadeExpert);
  const ticketCap = maxTickets(expert);
  const sampleCap = samplesFor(expert);

  let score = 0;
  let lives = LIVES;
  let streak = 0;
  let bestStreak = 0;
  let served = 0;
  let gradeTotal = 0;
  let perfects = 0;
  let guests: Guest[] = [];
  let making: Cup | null = null;
  let tapIndex = 0;
  let receipt: Receipt | null = null;
  let notice: { text: string; until: number } | null = null;
  let countdown = COUNTDOWN_SECONDS;
  let countdownElapsed = 0;
  let goVisible = false;
  let running = false;
  let paused = false;
  let gameOver = false;
  let endReason: "hearts" | "time" = "time";
  let timeLeft = SHIFT_SECONDS;
  let phase: Phase = "opening";
  let missPulse = 0;
  /** The jar the marker is on; it stays on the last one used. */
  let jarIndex = 0;
  /** Cup-shares left in each tea's tank, and when a brewing tank is done (0 when not brewing). */
  let tanks: number[] = TEAS.map(() => TANK_CAPACITY);
  let brewEnds: number[] = TEAS.map(() => 0);
  let samplesLeft = sampleCap;
  let criticsSeen = 0;
  let special: Tea = "milk";
  /** Coins in the tip jar, by the rules (the crowd shows them landing a beat later). */
  let jar = 0;
  let jarsCashed = 0;
  /** How each guest left, in order, for the share. */
  let history: Reaction[] = [];
  let shareLines: string[] = [];
  let liveMessage = "Order up is starting.";
  let localBest = 0;
  let newBest = false;

  let playScope: HTMLElement;
  let playfield: HTMLElement;
  let syrupEl: HTMLButtonElement;
  let hud: HTMLElement;
  let hudHeight = 80;
  let benchArt: HTMLElement;
  const drawBackdrop = createBackdrop("orders");
  let canvas: HTMLCanvasElement;
  let tapEls: HTMLButtonElement[] = [];
  /** Each tap's Brew chip, while its tank wants brewing. */
  let brewEls: Array<HTMLButtonElement | null> = [];
  let iceEl: HTMLButtonElement;
  let handEl: HTMLButtonElement;
  let sampleEl: HTMLButtonElement;
  let receiptEl: HTMLElement | null = null;
  let cardEl: HTMLElement;
  let streakEl: HTMLElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;
  let popupFont = '500 13px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';
  let reduceMotion = false;
  let small = false;
  /** A touch device: lessons name the gesture and light the pad, not a key. */
  let touchUI = false;

  // The bench, in CSS px.
  let W = 0;
  let H = 0;
  let cell = 6;
  let counterY = 0;
  let cupTop = 0;
  let spoutX: number[] = [];
  /** The ice bin's centre, under the ice button, and the syrup bottle's, under its button. */
  let binX = 0;
  let pumpX = 0;
  /** Where the back bar's buttons sit over its machines. */
  let tapsTop = 0;
  let tapsH = 0;
  /** The guests' own pixel size: the bench's cell, or smaller where they stand close together. */
  let guestPx = 4;
  let cupX = 0;

  // Game time: stops while paused, so every timer below holds with it.
  let clock = 0;
  let elapsed = 0;
  let arrivalTimer = 0;
  /** Seconds until the next guest walks in; see nextArrivalIn. */
  let arrivalIn = Infinity;
  let nextId = 1;
  /** Orders taken this shift, so the first few can come plain. */
  let ordersMade = 0;
  let receiptId = 0;
  let recent: string[] = [];
  /** Things the cup in progress waits for, in game time. Cleared with the cup. */
  let beats: Array<{ at: number; run: () => void }> = [];

  // Effects, mutated in place every frame.
  let falling: Falling[] = [];
  let particles: Particle[] = [];
  let popups: Popup[] = [];
  let wobble = 0;
  let joltDir = 1;
  let joltAge = 10;
  let flashAge = 10;
  let iceJitter = [0, 0, 0, 0, 0, 0];
  let lastShakeArrow: "left" | "right" | null = null;
  let iceArcs: IceArc[] = [];
  /** Since the syrup pump was last pressed: the head dips and a squirt falls. */
  let pumpAge = 10;
  /** Tickets on their way from a guest's hand up to the rail. */
  let flights: Flight[] = [];
  /** Tea is actually running this frame: held, and the tank not dry. */
  let streamOn = false;
  let tankSteamTimer = 0;

  /** Whatever is holding the pour open: each key (see orders-keys.js), the hand, a tap, the bench. */
  const holds = new Set<string>();
  /** An Enter that continued a lesson: its release is ignored, so it never lets go of anything. */
  const keyLatch = createKeyLatch();

  /** The line of guests above the rail, and the tip jar at its end. */
  const crowd = new Crowd({
    hand: (id, x, y) => handTicket(id, x, y),
    coin: (count) => sfxCoin(count),
    full: () => {
      sfxTipJar();
      crowd.note(`jar +${jarPayout(1, LIVES).points}`);
    },
  });

  // --- Lessons ----------------------------------------------------------------
  // The shift teaches itself (orders-lessons.js says what and when; the
  // coach shows one line at a time and remembers it on the device). While a
  // lesson is up and unanswered the whole shift stops: the guests' patience,
  // the arrivals, the clock and the bench. The player's own press brings it
  // back and is made at once (a move's press makes the move; any other
  // counts as Continue), so nothing is lost to reading and no press is lost
  // to the stop.

  const coach = createCoach("orders");
  /** The lesson on screen and what it points at, and the quiet before the next. */
  const lessons = lessonMemory();
  /** The coach's lesson and whether it's fading (done, and up long enough to read), copied out so the page follows them. */
  let coachLesson: Lesson | null = null;
  let coachLeaving = false;
  /** The lesson is still up and unanswered (not done, its move not made): it offers Continue only then. */
  let coachOpen = false;
  /** The lesson is over (done, or its move made): the slip holds where it is. */
  let coachEnded = false;
  /** The slip is placed on screen beside its thing: only then does the lesson stop the shift. */
  let lessonShown = false;
  /** While the walk-through waits for the shift's first ticket, the guest whose ticket is marked on the rail, or -1. */
  let beckonGuest = -1;
  /** A ticket has been taken this shift. */
  let ticketTaken = false;
  /** The tap is held open (the hand key shows pressed down). */
  let handHeld = false;
  let coachX: number | null = null;
  let coachY: number | null = null;
  let coachRing = 0;
  /** Half the width of a wide target (a ticket, a machine, the shake marks), so the loop stretches round it rather than growing tall. */
  let coachWidth = 0;
  /** The callout's measured size (0 until it has been on screen). */
  let coachSlipW = 0;
  let coachSlipH = 0;
  /** Half the height of a tall thing the callout rings (a tap), else 0. */
  let coachHeight = 0;
  let coachSide: "above" | "below" | "left" | "right" = "below";
  let coachScene: "dark" | "light" = "light";
  /** On touch, the pad the lesson is about lights up: the hand, or the Sample button. */
  let handLit = false;
  let sampleLit = false;
  /** How dim the shop is around a lesson, 0..1, eased in real time (at once under Reduce Motion). */
  let lessonDim = 0;
  /** The page's own pieces dim with the shop (a class); these stay lit for the lesson they are about. */
  let dimOthers = false;
  let litTicket = -1;
  let litCard = false;
  let litHand = false;
  let litSample = false;
  let litReceipt = false;
  /** The tea machine the lesson is about (its Brew chip and special star stay lit), or -1. */
  let litTap = -1;
  let litLess = false;
  /** The bench clock when the shift began, and how long "go" stays up before anything is taught. */
  let begunAt = 0;
  const GO_SECONDS = 0.62;
  /** Real seconds the lessons have been on screen (stops when paused): drives the ghosts. */
  let lessonClock = 0;
  /** The counter as the lessons read it, updated in place each frame. */
  const lessonView: LessonView = {
    coarse: false,
    expert,
    started: false,
    tapIndex: 0,
    jarIndex: 0,
    holding: false,
    loaded: false,
    ladle: 0,
    needle: 0,
    cup: null,
    guests: [],
    tanks: [],
    brewEnds: [],
    samplesLeft: 0,
    special: "milk",
    jar: 0,
    receipt: null,
  };
  /** Where the lesson's DOM target sits on screen, read when it is offered and about ten times a second. */
  let anchorBox: DOMRect | null = null;
  /** The bench canvas on screen, for targets drawn on it. */
  let benchBox: DOMRect | null = null;
  /** The rail of tickets on screen: a ticket's slip never sits over it. */
  let railBox: DOMRect | null = null;
  /** The hand button on screen: a slip never covers it while it is the move being taught. */
  let handBox: DOMRect | null = null;
  /** A card line's station on the back bar (the bottle, the bin, the ordered tap), or a brew's whole machine. */
  let machineBox: DOMRect | null = null;
  /** How far down the slip may sit: under the HUD, or under the whole rail for a ticket's lesson. */
  let coachTop = 72;
  const refreshTick = every(0.1);

  const timers = createTimers();
  const loop = createFrameLoop({
    update: (dt, rawDt) => advance(dt, rawDt),
    draw: () => {
      drawRoom();
      draw();
      placeCoach();
    },
    isPaused: () => paused,
  });

  /** A stable 0–1 value per integer, so seeded marks never shimmer. (Not core's hash: the room is seeded by this one.) */
  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  const phaseLabel = (value: Phase) =>
    value === "rush" ? "lunch rush" : value === "steady" ? "steady trade" : "doors open";

  // --- Derived for the template ---------------------------------------------------

  // The hand and the ice follow the bench. With nothing on the bench the
  // hand takes the next ticket: whoever is closest to leaving.
  $: handLive = making ? !(making.station === "seal" && making.stampAt !== null) : guests.length > 0;
  $: handLabel = making ? HAND_LABELS[making.station] : "Next ticket";
  $: combo = comboProgress(streak, expert);
  $: iceTarget = making ? ICE_CUBES[making.order.ice] : 0;
  $: sugarCount = making?.sugar ?? 0;
  $: sugarTarget = making ? sugarPumps(making.order.sugar) : 0;
  $: syrupOpen = sugarAdjustable(making);
  $: steps = stepsFor(making);
  /** The guest whose drink is on the bench, and how much patience they have left (refreshed with the line). */
  $: makingGuest = making ? (guests.find((guest) => guest.id === making?.guestId) ?? null) : null;
  $: makingShare = makingGuest ? clamp(makingGuest.left / makingGuest.patience, 0, 1) : 1;
  $: averageGrade = served ? Math.round(gradeTotal / served) : 0;
  /** Anyone else on the line to hand a sample to; whether they need it is checked on the press. */
  $: sampleAnyone = mostImpatient(guests, making?.guestId ?? null);
  $: canSample = running && !paused && !gameOver && samplesLeft > 0 && sampleAnyone >= 0;
  $: iceCount = making?.ice ?? 0;
  $: iceOpen = iceAdjustable(making);
  $: tankStates = tanks.map((tank) => tankState(tank));
  /** Brewing progress per tap, 0–1, or -1 when it isn't brewing. Set with the line's refresh, not every frame. */
  let brewing: number[] = TEAS.map(() => -1);

  /** Hands the template the tanks and brewing as they stand (they change in place every frame). */
  function refreshTanks() {
    tanks = tanks;
    brewing = brewEnds.map((end) => (end > 0 ? clamp(1 - (end - clock) / BREW_SECONDS, 0, 1) : -1));
  }

  /** The stations before the tea: pressing a tap there moves straight on to the pour. */
  const beforeTea = (station: Station) => station === "ice" || station === "sugar" || station === "pour";

  /** Can this tap pour into this cup right now? */
  function tapLive(index: number, cup: Cup | null = making) {
    return (
      !!cup &&
      beforeTea(cup.station) &&
      !cup.busy &&
      (!cup.tea || cup.tea === TEAS[index]) &&
      brewEnds[index] === 0
    );
  }

  /** Syrup goes in (and the last pump can come back out) at its own station, under the bottle. */
  function sugarAdjustable(cup: Cup | null) {
    return !!cup && cup.station === "sugar" && !cup.busy;
  }

  /** Ice goes in at its own station, and can still be changed at the pour until the tea goes in. */
  function iceAdjustable(cup: Cup | null) {
    if (!cup || cup.busy) return false;
    if (cup.station === "ice") return true;
    return cup.station === "pour" && !cup.tea && cup.level === 0 && holds.size === 0;
  }

  /** Who a sample would go to: the guest closest to leaving (not the one being made), if they need one. */
  function sampleFor(list: Guest[], cup: Cup | null) {
    return sampleTarget(list, cup?.guestId ?? null);
  }

  /** Does this tap's tank want brewing (and isn't already)? */
  function brewWanted(index: number) {
    return brewEnds[index] === 0 && tankState(tanks[index]) !== "ok";
  }

  function scoopAverage(cup: Cup) {
    return Math.round(cup.drops.reduce((total, grade) => total + grade, 0) / Math.max(1, cup.drops.length));
  }

  /** The card's lines before any ticket is taken, dimmed: the stations a drink goes through. */
  const IDLE_STEPS: Step[] = (["sugar", "ice", "pour", "scoop", "shake", "seal"] as Station[]).map((id) => ({
    id,
    label: id === "sugar" ? "syrup" : id === "pour" ? "tea" : id === "scoop" ? "scoops" : id,
    state: "todo",
    word: "",
  }));

  /**
   * The making card's lines: the drink's stations in the order it is built,
   * the one the cup is at current, those behind it done with their grade.
   */
  function stepsFor(cup: Cup | null): Step[] {
    if (!cup) return IDLE_STEPS;
    const at = cup.stations.indexOf(cup.station);
    const sealed = cup.sealValue !== null;
    return cup.stations.map((id, index): Step => {
      const state = sealed || index < at ? "done" : index === at ? "current" : "todo";
      let word = "";
      if (state === "done") {
        if (id === "sugar") word = gradeWord(sugarGrade(cup.sugar, cup.order.sugar, expert));
        else if (id === "ice") word = gradeWord(iceGrade(cup.ice, cup.order.ice, expert));
        else if (id === "pour" && cup.pourGrade !== null) word = gradeWord(cup.pourGrade);
        else if (id === "scoop") word = gradeWord(scoopAverage(cup));
        else if (id === "shake" && cup.shakeSeconds !== null) word = gradeWord(shakeGrade(cup.shakeSeconds, expert));
        else if (id === "seal" && cup.sealValue !== null) word = SEAL_WORDS[sealResult(cup.sealValue, expert)];
      }
      const label = id === "sugar" ? "syrup" : id === "pour" ? TEA_WORDS[cup.order.tea] : id === "scoop" ? "scoops" : id;
      return { id, label, state, word };
    });
  }

  /** What a card line holds, in words, for a screen reader (the marks say it to the eye). */
  function stepAmount(cup: Cup, id: Station) {
    if (id === "sugar") return `, ${cup.sugar} of ${sugarPumps(cup.order.sugar)} pumps`;
    if (id === "ice") return `, ${cup.ice} of ${ICE_CUBES[cup.order.ice]} cubes`;
    if (id === "pour") return `, ${TEA_NAMES[cup.order.tea]}`;
    if (id === "scoop") {
      const wanted = cup.order.toppings.map((line) => `${line.scoops} ${TOPPING_NAMES[line.kind]}`).join(" and ");
      return `, ${wanted}, ${cup.drops.length} of ${cup.queue.length} in`;
    }
    if (id === "shake") return `, ${cup.shakes} of ${SHAKES_NEEDED} shakes`;
    return "";
  }

  function describeOrder(order: Order) {
    const parts = [TEA_NAMES[order.tea], sugarName(order.sugar), ICE_NAMES[order.ice]];
    for (const line of order.toppings) {
      parts.push(`${line.scoops} ${line.scoops === 1 ? "scoop" : "scoops"} of ${TOPPING_NAMES[line.kind]}`);
    }
    return parts.join(", ");
  }

  function guestLabel(guest: Guest, mood: WaitMood, mine: boolean) {
    const quirk = guest.regular.quirk ? `, ${QUIRK_NAMES[guest.regular.quirk]}` : "";
    const state = mine ? "Their drink is on the bench." : `${MOOD_WORDS[mood][0].toUpperCase()}${MOOD_WORDS[mood].slice(1)}.`;
    const today = guest.order.tea === special ? ` ${TEA_NAMES[special]} is today's special.` : "";
    return `${guest.regular.name}${quirk}: ${describeOrder(guest.order)}.${today} ${state}`;
  }

  /** Arguments are what the label depends on, so the template redraws it when they change. */
  function tapLabel(index: number, today: Tea, brew: number[], states: string[]) {
    const tea = TEAS[index];
    const parts = [`${TEA_NAMES[tea]} tap`];
    if (tea === today) parts.push("today's special");
    if (brew[index] >= 0) parts.push("brewing");
    else if (states[index] === "empty") parts.push("tank empty");
    else if (states[index] === "low") parts.push("tank low");
    return parts.join(", ");
  }

  // Clicking a counter button shouldn't take focus from the page, or Space
  // would press that button again instead of working the bench.
  function keepFocus(event: MouseEvent) {
    event.preventDefault();
  }

  function note(text: string) {
    notice = { text, until: clock + NOTICE_SECONDS };
    liveMessage = text;
  }

  /** The shift's input is live: running and not paused. */
  function playing() {
    return running && !paused && !gameOver;
  }

  /** Svelte only sees the cup change when it is reassigned. */
  function refresh() {
    making = making;
  }

  function after(seconds: number, run: () => void) {
    const beat = { at: clock + seconds, run };
    beats.push(beat);
    return beat;
  }

  /**
   * The beat that moves the cup on once the last pump or cube is in. Until
   * it comes, ↓ can still take that one back out, which cancels it.
   */
  let settle: { at: number; run: () => void } | null = null;

  /** ↓ during the settle: the last pump or cube comes back out and the cup stays. */
  function unsettle(cup: Cup) {
    if (!settle || !cup.busy) return false;
    beats = beats.filter((beat) => beat !== settle);
    settle = null;
    cup.busy = false;
    return true;
  }

  // --- Guests on the line -----------------------------------------------------------
  // Each guest walks up (the crowd draws that) and their ticket appears on
  // the rail once it leaves their hand; patience only runs from then.

  // A served guest's ticket lifts off the rail with them; a lost one drops away.
  function leave(node: Element, { guest }: { guest: Guest }) {
    const happy = guest.outcome === "served";
    return {
      duration: reduceMotion ? 0 : happy ? 300 : 360,
      css: (t: number, u: number) => {
        const k = cubicOut(u);
        if (happy) return `transform: translateY(${-k * 18}px) rotate(${guest.tilt + k * 4}deg); opacity: ${t}`;
        return `transform: translateY(${k * 48}px) rotate(${k * 12}deg); opacity: ${t}`;
      },
    };
  }

  function rememberName(name: string) {
    recent = [...recent.filter((item) => item !== name), name].slice(-RECENT_NAMES);
  }

  function addGuest() {
    const exclude = [...guests.map((guest) => guest.regular.name), ...recent];
    // The first guest through the door after the critic's hour is the critic (twice a shift in expert).
    const critic = criticDue(elapsed, criticsSeen, expert, served);
    const regular = critic ? CRITIC : pickRegular(exclude);
    if (critic) criticsSeen += 1;
    // The first orders of a shift come plain (makeOrder counts them).
    const order = makeOrder(elapsed, regular, Math.random, expert, ordersMade++);
    const patience = patienceFor(order, regular, elapsed, expert);
    const guest: Guest = {
      id: nextId++,
      regular,
      order,
      patience,
      left: patience,
      tilt: Math.round((Math.random() * 3 - 1.5) * 10) / 10,
      placed: false,
      outcome: null,
    };
    guests = [...guests, guest];
    crowd.arrive(guest.id, regular.name, guests.length - 1);
    if (critic) {
      note("the critic is here");
      liveMessage = `The critic is here, and their drink counts double: ${describeOrder(order)}.`;
    } else {
      liveMessage = `${regular.name} is waiting: ${describeOrder(order)}.`;
    }
  }

  /** A guest holds their ticket out: it goes up to the rail (at once under Reduce Motion). */
  function handTicket(id: number, x: number, y: number) {
    if (reduceMotion) {
      landTicket(id);
      return;
    }
    flights = [...flights, { id, x0: x, y0: y, t: 0, fx: -999, fy: -999, scale: 0.6, turn: -10 }];
    placeFlights();
  }

  /** The ticket is clipped to the rail: the guest waits from now. */
  function landTicket(id: number) {
    if (flights.some((flight) => flight.id === id)) flights = flights.filter((flight) => flight.id !== id);
    placeTicket(id);
    crowd.hung(id);
  }

  const FLIGHT_SECONDS = 0.55;

  function stepFlights(dt: number) {
    if (!flights.length) return;
    for (const flight of [...flights]) {
      flight.t += dt / FLIGHT_SECONDS;
      if (flight.t >= 1) landTicket(flight.id);
    }
    placeFlights();
  }

  /** Puts each ticket in the air on its arc from the hand to its clip on the rail. */
  function placeFlights() {
    if (!flights.length || !benchArt) return;
    const art = benchArt.getBoundingClientRect();
    for (const flight of flights) {
      const slot = lineEl?.querySelector(`[data-guest="${flight.id}"]`)?.getBoundingClientRect();
      const x0 = art.left + flight.x0;
      const y0 = art.top + flight.y0;
      const x1 = slot ? slot.left + slot.width / 2 : x0;
      const y1 = slot ? slot.top : art.top;
      // Straight up past the back bar between the machines (small, so it
      // never crosses a sticker), then across to its clip on the rail.
      const u = clamp(flight.t, 0, 1);
      const above = art.top + tapsTop - 8;
      if (u < 0.5) {
        const k = u / 0.5;
        flight.fx = x0;
        flight.fy = lerp(y0, Math.min(y0, above) - 40, k * (2 - k));
        flight.scale = 0.45;
      } else {
        const k = (u - 0.5) / 0.5;
        const eased = 1 - (1 - k) * (1 - k);
        flight.fx = lerp(x0, x1, eased);
        flight.fy = lerp(Math.min(y0, above) - 40, y1, eased);
        flight.scale = lerp(0.45, 1, eased);
      }
      flight.turn = lerp(-10, 0, u);
    }
    flights = flights;
  }

  /** The ticket has left the guest's hand and hangs on the rail. */
  function placeTicket(id: number) {
    const guest = guests.find((item) => item.id === id);
    if (!guest || guest.placed) return;
    guest.placed = true;
    sfxTicket();
    guests = guests;
  }

  /** Takes a guest off the line; the crowd walks them out wearing `reaction`. */
  function removeGuest(guest: Guest, outcome: "served" | "gone", reaction: Reaction, coins = 0) {
    guest.outcome = outcome;
    guests = guests.filter((item) => item !== guest);
    crowd.leave(guest.id, reaction, coins);
    rememberName(guest.regular.name);
    history = [...history, reaction];
  }

  /** Loses a pearl, and the combo with it. */
  function loseLife() {
    if (comboFor(streak, expert) > 1) popBeside("combo lost", "miss", 1.1, 2);
    streak = 0;
    lives -= 1;
    missPulse += 1;
    if (lives <= 0) void endGame("hearts");
  }

  function walkOut(guest: Guest) {
    const mine = making?.guestId === guest.id;
    removeGuest(guest, "gone", "storm");
    sfxWalkOut();
    if (mine) binCup();
    if (!reduceMotion) veilAge = 0;
    note(`${guest.regular.name} left`);
    liveMessage = `${guest.regular.name} left${mine ? " and their cup was binned" : ""}. You lose a pearl.`;
    loseLife();
  }

  /** A perfect drink cheers everyone still waiting: a little patience back, and a smile. */
  function cheerLine() {
    let cheered = 0;
    for (const guest of guests) {
      if (!guest.placed) continue;
      guest.left = cheer(guest.left, guest.patience, expert);
      crowd.react(guest.id, "content");
      cheered += 1;
    }
    if (cheered) guests = guests;
    return cheered;
  }

  // --- Taking a ticket, dumping it ---------------------------------------------------

  /**
   * Takes a guest's ticket to the bench. A cup with nothing in it yet can
   * still go to another ticket (taken by mistake, or just poured out); one
   * with anything in it is finished or dumped first.
   */
  function take(index: number) {
    if (!playing()) return;
    const guest = guests[index];
    if (!guest) return;
    if (making) {
      if (making.guestId === guest.id) return;
      if (!untouched(making)) {
        note("finish or dump this one first");
        return;
      }
      binCup();
    }
    wake();
    ticketTaken = true;
    startCup(guest);
  }

  /** Nothing has gone into the cup yet, and it is waiting at its first station. */
  function untouched(cup: Cup) {
    return cup.station === cup.stations[0] && !cup.busy && cup.sugar === 0 && cup.ice === 0 && !cup.tea && cup.level === 0;
  }

  /** A fresh cup for this guest's ticket, under the tap of the tea they ordered. */
  function startCup(guest: Guest) {
    // Taken straight from their hand: it goes on the rail now.
    if (!guest.placed) landTicket(guest.id);
    receipt = null;
    notice = null;
    const stations = stationsFor(guest.order);
    // The cup goes under the ordered tea's tap, so Space pours the right
    // tea; the arrows or another tap still move it.
    tapIndex = tapFor(guest.order);
    making = {
      guestId: guest.id,
      name: guest.regular.name,
      regular: guest.regular,
      order: guest.order,
      stations,
      station: stations[0],
      busy: false,
      ice: 0,
      sugar: 0,
      tea: null,
      level: 0,
      heldSeconds: 0,
      pourGrade: null,
      queue: scoopQueue(guest.order),
      drops: [],
      results: [],
      pile: [],
      scoopStart: 0,
      swing: 1,
      chosen: TOPPINGS[jarIndex],
      loadedAt: 0,
      shakes: 0,
      shakeStart: 0,
      shakeSeconds: null,
      sealStart: 0,
      sealValue: null,
      stampAt: null,
      sealed: false,
      burst: false,
      turning: false,
    };
    holds.clear();
    iceArcs = [];
    streamOn = false;
    cupX = stationX(making);
    wobble = 0;
    sfxBlip();
    guests = guests;
    coach.done("ticket");
    liveMessage = `Making ${guest.regular.name}'s ${describeOrder(guest.order)}. ${stationMessage(making)}`;
  }

  /** The hand with an empty bench: the ticket of whoever is closest to leaving. */
  function takeNext() {
    const index = mostImpatient(guests);
    if (index >= 0) take(index);
  }

  /** Throws the cup away, and everything it was waiting on. */
  function binCup() {
    making = null;
    beats = [];
    settle = null;
    falling = [];
    iceArcs = [];
    holds.clear();
    streamOn = false;
    setPourStream(0);
    guests = guests;
  }

  /**
   * Pours the cup out and starts the same drink again with an empty one; the
   * ticket stays theirs. While the new cup is empty, another ticket can still
   * be taken instead.
   */
  function dump() {
    if (!playing() || !making || making.stampAt !== null) return;
    const guest = guests.find((item) => item.id === making?.guestId);
    wake();
    binCup();
    sfxDump();
    if (guest) startCup(guest);
    const started = guest ? liveMessage : "";
    note("poured out");
    if (started) liveMessage = `The cup was poured out. ${started}`;
  }

  // --- Ice --------------------------------------------------------------------------
  // One press, one cube. The cup marks a slot for each cube the ticket asks
  // for and the ticket shows the same cubes, filling as they go in; at the
  // ice station the last one moves the cup on to the pour by itself. More
  // can still go in at the pour before the tea (too much), and pressing a
  // tap early leaves it short.

  function cubes(count: number) {
    return `${count} ${count === 1 ? "cube" : "cubes"}`;
  }

  function pumps(count: number) {
    return `${count === 1 ? "once" : count === 2 ? "twice" : `${count} times`}`;
  }

  /** The station after this one. */
  function nextStation(cup: Cup): Station {
    return cup.stations[cup.stations.indexOf(cup.station) + 1] ?? "pour";
  }

  /** One cube from the bin. */
  function addIce() {
    const cup = making;
    if (!cup || !playing() || !iceAdjustable(cup)) return false;
    if (cup.ice >= ICE_MAX) {
      note("the cup holds no more ice");
      return false;
    }
    wake();
    cup.ice += 1;
    if (!reduceMotion) iceArcs.push({ age: 0 });
    sfxIce(cup.ice);
    const target = ICE_CUBES[cup.order.ice];
    liveMessage = `The cup has ${cup.ice} of ${cubes(target)} of ice.`;
    if (cup.station === "ice" && cup.ice >= target) {
      // Right on: once the cube lands, a ding, and on to the pour.
      cup.busy = true;
      settle = after((reduceMotion ? 0 : ICE_ARC_SECONDS) + ICE_SETTLE, () => {
        settle = null;
        sfxIceFull();
        coach.done("ice");
        enterStation(nextStation(cup));
      });
    } else if (cup.ice > target) {
      popBeside("too much ice", "miss", 0.9, 12);
      note("too much ice");
      liveMessage = `Too much ice: ${cup.ice}, the ticket says ${target}. Press down to take one out.`;
    }
    refresh();
    return true;
  }

  /** One cube back out, while there is still no tea on it. */
  function removeIce() {
    const cup = making;
    if (!cup || !playing() || cup.ice === 0) return;
    if (!(cup.station === "ice" && cup.busy && unsettle(cup)) && !iceAdjustable(cup)) return;
    wake();
    cup.ice -= 1;
    // A cube still in the air is the one that comes back.
    if (iceArcs.length) iceArcs.pop();
    sfxIce(0);
    liveMessage = `The cup has ${cup.ice} of ${cubes(ICE_CUBES[cup.order.ice])} of ice.`;
    refresh();
  }

  /** One pump of syrup into the cup under the bottle. */
  function pumpSyrup() {
    const cup = making;
    if (!cup || !playing() || !sugarAdjustable(cup)) return false;
    if (cup.sugar >= SUGAR_MAX) return false;
    wake();
    cup.sugar += 1;
    pumpAge = 0;
    sfxPump(cup.sugar);
    const target = sugarPumps(cup.order.sugar);
    liveMessage = `The cup has ${cup.sugar} of ${target} ${target === 1 ? "pump" : "pumps"} of syrup.`;
    if (cup.sugar >= target) {
      // Right on: a ding, and on to the next station.
      cup.busy = true;
      settle = after(ICE_SETTLE + 0.1, () => {
        settle = null;
        sfxIceFull();
        coach.done("syrup");
        enterStation(nextStation(cup));
      });
    }
    refresh();
    return true;
  }

  /** One pump back out, at the bottle, before the drink moves on. */
  function removeSyrup() {
    const cup = making;
    if (!cup || !playing() || cup.station !== "sugar" || cup.sugar === 0) return;
    if (cup.busy && !unsettle(cup)) return;
    wake();
    cup.sugar -= 1;
    pumpAge = 10;
    sfxPump(0);
    const target = sugarPumps(cup.order.sugar);
    liveMessage = `The cup has ${cup.sugar} of ${target} ${target === 1 ? "pump" : "pumps"} of syrup.`;
    refresh();
  }

  /**
   * A tap pressed before the tea: straight on to the pour, short on ice or
   * syrup if they weren't all in.
   */
  function leaveEarly() {
    const cup = making;
    if (!cup || cup.busy || (cup.station !== "ice" && cup.station !== "sugar")) return;
    const short: string[] = [];
    if (cup.stations.includes("ice") && iceState(cup.ice, cup.order.ice) === "short") short.push("ice");
    if (cup.stations.includes("sugar") && sugarState(cup.sugar, cup.order.sugar) === "short") short.push("sugar");
    if (short.length) {
      popBeside(`short on ${short.join(" and ")}`, "miss", 0.9, 12);
      // Said with whatever the rest of this press says (the pour station's
      // line, an empty tank), once the press is done, so nothing said after
      // it replaces it; alone if the press said nothing new.
      const warning = `The cup is short on ${short.join(" and ")}.`;
      const before = liveMessage;
      queueMicrotask(() => {
        liveMessage = liveMessage === before ? warning : `${warning} ${liveMessage}`;
      });
    }
    enterStation("pour");
  }

  // --- The pour --------------------------------------------------------------------

  function selectTap(index: number) {
    const cup = making;
    if (!cup || !beforeTea(cup.station) || cup.busy || holds.size) return false;
    if (cup.tea && cup.tea !== TEAS[index]) {
      note(`this cup is ${TEA_NAMES[cup.tea]}, dump to switch`);
      return false;
    }
    if (index !== tapIndex) {
      wake();
      tapIndex = index;
      liveMessage = `The cup is under the ${TEA_NAMES[TEAS[index]]} tap.`;
      // Moved under the ordered tea's tap: the move is known.
      if (TEAS[index] === cup.order.tea) coach.done("tap");
    }
    return true;
  }

  function moveTap(direction: number) {
    selectTap(clamp(tapIndex + direction, 0, TEAS.length - 1));
  }

  function startHold(source: string) {
    const cup = making;
    if (!cup || cup.station !== "pour" || cup.busy || !playing()) return;
    if (cup.tea && cup.tea !== TEAS[tapIndex]) return;
    const tea = TEA_NAMES[TEAS[tapIndex]];
    if (brewEnds[tapIndex] > 0) {
      note(`${tea} is brewing`);
      return;
    }
    wake();
    if (!holds.size) {
      cup.heldSeconds = 0;
      if (tankState(tanks[tapIndex]) === "empty") note(`the ${tea} tank is empty`);
      // The pour's lesson stays up through the hold, to say where to let go.
      coach.acted("pour");
    }
    holds.add(source);
    refresh();
  }

  /**
   * Lets go of one source. A deliberate release (`commit`) with enough tea in
   * the cup finishes the pour; a lost pointer or a blur only closes the tap.
   */
  function endHold(source: string, commit: boolean) {
    if (!holds.delete(source) || holds.size) return;
    streamOn = false;
    setPourStream(0);
    const cup = making;
    // A tap let go after it has run dry isn't judged: brew, and the pour carries on.
    const dry = !!cup && tankState(tanks[tapIndex]) === "empty";
    if (commit && cup && cup.station === "pour" && !cup.busy && cup.level >= MIN_POUR && !dry) {
      commitPour();
      return;
    }
    // Let go too soon, taken back, or dry: nothing was judged, so the pour's
    // lesson (if it was waiting on this hold) comes back as it was.
    if (coach.current?.id === "pour" && coach.acting && !coach.leaving) {
      coach.dismiss();
      lessons.cue = null;
    }
    refresh();
  }

  /** Closes the tap without judging the pour (pause, blur, game over). */
  function releaseAll() {
    holds.clear();
    keyLatch.clear();
    streamOn = false;
    lastShakeArrow = null;
    setPourStream(0);
    // A hold taken back (a pause, the window losing focus) wasn't an answer: the pour's lesson comes back.
    if (coach.current?.id === "pour" && coach.acting && !coach.leaving) {
      coach.dismiss();
      lessons.cue = null;
    }
  }

  function commitPour() {
    const cup = making;
    if (!cup || cup.station !== "pour" || cup.busy) return;
    holds.clear();
    streamOn = false;
    setPourStream(0);
    cup.busy = true;
    cup.pourGrade = pourGrade(cup.level, cup.order.ice, expert);
    const word = gradeWord(cup.pourGrade);
    popBeside(word, popupKind(cup.pourGrade), 1.1, 5);
    liveMessage = `The pour was ${word}.`;
    lessonResult("pour", cup.tea === cup.order.tea && cup.pourGrade >= LESSON_PASS);
    refresh();
    after(AFTER_POUR, () => enterStation(cup.stations.includes("scoop") ? "scoop" : "shake"));
  }

  function popupKind(grade: number): "perfect" | "plain" | "miss" {
    return grade >= 95 ? "perfect" : grade >= 55 ? "plain" : "miss";
  }

  function enterStation(next: Station) {
    const cup = making;
    if (!cup) return;
    cup.station = next;
    cup.busy = false;
    holds.clear();
    streamOn = false;
    setPourStream(0);
    lastShakeArrow = null;
    if (next === "scoop") {
      cup.scoopStart = clock;
      cup.swing = paceForElapsed(elapsed, expert).swing;
      cup.loadedAt = 0;
      // The ladle goes straight into the first scoop's jar. In expert the
      // jar is still the player's to pick: its drinks split across two jars
      // more often on purpose.
      if (!expert) jarIndex = Math.max(0, TOPPINGS.indexOf(cup.queue[0]));
      dipJar(cup);
    } else if (next === "seal") {
      cup.sealStart = clock;
      cup.sealValue = null;
      cup.stampAt = null;
      cup.sealed = false;
    }
    const message = stationMessage(cup);
    if (message) liveMessage = message;
    refresh();
  }

  /**
   * What the live region says as the cup reaches its station. Nothing while
   * that station's lesson is still to be taught: the coach's own line says
   * it beside the station, and it shouldn't be heard twice.
   */
  function stationMessage(cup: Cup) {
    if (!coach.learned(STATION_LESSON[cup.station])) return "";
    switch (cup.station) {
      case "sugar":
        return `Syrup: pump ${pumps(sugarPumps(cup.order.sugar))} for ${sugarName(cup.order.sugar)}.`;
      case "ice":
        return `Ice: add ${cubes(ICE_CUBES[cup.order.ice])}.`;
      case "pour":
        return `Pour: hold the ${TEA_NAMES[cup.order.tea]} tap and let go at the line.`;
      case "scoop": {
        const count = cup.queue.length;
        return `Scoop: ${count} ${count === 1 ? "scoop" : "scoops"}, ${cup.queue.map((kind) => TOPPING_NAMES[kind]).join(", ")}. The ladle is in the ${TOPPING_NAMES[cup.chosen]} jar.`;
      }
      case "shake":
        return `Shake: ${SHAKES_NEEDED} quick shakes.`;
      default:
        return "Seal: stamp when the needle is in the band.";
    }
  }

  // --- The ladle ----------------------------------------------------------------------

  /** The ladle's swing radius: the cup's mouth edge sits at exactly the mode's cup mouth. */
  const ladleRadius = () => ((CUP_W / 2) * cell) / rulesFor(expert).cupMouth;

  function ladleNow(cup: Cup) {
    const x = ladleAt(clock - cup.scoopStart, cup.swing, Math.PI / 2);
    const dx = x * ladleRadius();
    const length = LADLE_ARM * cell;
    const restY = cupTop - 3 * cell;
    const by = restY - (length - Math.sqrt(Math.max(0, length * length - dx * dx)));
    return { x, bx: W / 2 + dx, by, pivotY: restY - length };
  }

  /** The ladle dips into the marked jar and comes up carrying it (after any reload). */
  function dipJar(cup: Cup) {
    cup.chosen = TOPPINGS[jarIndex];
    cup.loadedAt = Math.max(cup.loadedAt, clock + (reduceMotion ? 0 : DIP_SECONDS));
  }

  /** Marks a jar and loads the ladle from it. */
  function selectJar(index: number) {
    const cup = making;
    if (!cup || cup.station !== "scoop" || cup.busy || !playing()) return false;
    const next = clamp(index, 0, TOPPINGS.length - 1);
    if (next === jarIndex) return true;
    wake();
    jarIndex = next;
    dipJar(cup);
    liveMessage = `The ladle is in the ${TOPPING_NAMES[TOPPINGS[next]]} jar.`;
    if (TOPPINGS[next] === cup.queue[cup.drops.length]) coach.done("jar");
    refresh();
    return true;
  }

  function moveJar(direction: number) {
    selectJar(jarIndex + direction);
  }

  function drop() {
    const cup = making;
    if (!cup || cup.station !== "scoop" || cup.busy || clock < cup.loadedAt || !playing()) return;
    const index = cup.drops.length;
    const wanted = cup.queue[index];
    if (!wanted) return;
    wake();
    const kind = cup.chosen;
    const ladle = ladleNow(cup);
    // A wrong jar still falls where the ladle was; it just counts for nothing.
    const landed = scoopResult(ladle.x, expert);
    const judged = judgeScoop(wanted, kind, ladle.x, expert);
    cup.drops.push(judged.grade);
    cup.results.push(judged.result);
    sfxScoop(landed, index);
    falling.push({
      kind,
      result: landed,
      x: ladle.bx,
      y: ladle.by - 2 * cell,
      vx: 0,
      vy: 0,
      angle: 0,
      spin: 0,
      stage: 0,
      splashed: false,
      age: 0,
      alpha: 1,
    });
    const word =
      judged.result === "wrong" ? "wrong jar" : landed === "clean" ? "clean" : landed === "rim" ? "off the rim" : "missed";
    popBeside(word, judged.result === "clean" ? "perfect" : judged.result === "rim" ? "plain" : "miss", 0.8, 9);
    lessonResult("drop", judged.result === "clean" || judged.result === "rim");
    liveMessage =
      judged.result === "wrong"
        ? `Scoop ${index + 1} of ${cup.queue.length}, wrong jar: ${TOPPING_NAMES[kind]}, not ${TOPPING_NAMES[wanted]}.`
        : `Scoop ${index + 1} of ${cup.queue.length}, ${word}.`;
    cup.loadedAt = clock + RELOAD;
    const next = cup.queue[cup.drops.length];
    if (!next) {
      cup.busy = true;
      after(AFTER_SCOOPS, () => enterStation("shake"));
    } else if (!expert && TOPPINGS[jarIndex] !== next) {
      // The ladle reloads from the next scoop's jar (the arrows still choose another).
      jarIndex = TOPPINGS.indexOf(next);
      dipJar(cup);
    }
    refresh();
  }

  // --- The shake ----------------------------------------------------------------------

  function shake() {
    const cup = making;
    if (!cup || cup.station !== "shake" || cup.busy || !playing()) return;
    wake();
    cup.shakes += 1;
    if (cup.shakes === 1) cup.shakeStart = clock;
    joltDir = cup.shakes % 2 ? 1 : -1;
    joltAge = 0;
    if (!reduceMotion) iceJitter = iceJitter.map(() => (Math.random() - 0.5) * 2);
    sfxShake(cup.shakes);
    if (cup.shakes >= SHAKES_NEEDED) {
      flashAge = 0;
      cup.shakeSeconds = clock - cup.shakeStart;
      cup.busy = true;
      const grade = shakeGrade(cup.shakeSeconds, expert);
      const word = gradeWord(grade);
      popBeside(word, popupKind(grade), 1.1, 5);
      liveMessage = `The shake was ${word}.`;
      lessonResult("shake", grade >= LESSON_PASS);
      after(AFTER_SHAKE, () => enterStation("seal"));
    }
    refresh();
  }

  // --- The seal -----------------------------------------------------------------------

  /** Stamps the press at wherever the needle is. The press, straw and hop follow in stepCup. */
  function stamp() {
    const cup = making;
    if (!cup || cup.station !== "seal" || cup.busy || cup.stampAt !== null || !playing()) return;
    wake();
    const value = sealNeedle(clock - cup.sealStart, expert);
    cup.sealValue = value;
    cup.stampAt = clock;
    cup.busy = true;
    const result = sealResult(value, expert);
    const grade = sealGrade(value, expert);
    popBeside(SEAL_WORDS[result], result === "sealed" ? "perfect" : grade >= 55 ? "plain" : "miss", 1.1, 5);
    liveMessage = `The lid is ${SEAL_WORDS[result]}.`;
    // A perfect drink turns once on the counter as it goes (drawn only
    // without Reduce Motion, checked as it is drawn; its timing never changes).
    const judged = judge(cup);
    cup.turning = !!judged?.result.accepted && judged.result.total >= PERFECT;
    if (cup.turning) {
      warming.tea = cup.tea ?? cup.order.tea;
      warming.key = toppingKey(cup.order.toppings);
      warming.next = 0;
    }
    lessonResult("seal", grade >= LESSON_PASS);
    refresh();
  }

  /** The hand: whatever the station needs from one press. */
  function act(source: string) {
    if (!playing()) return;
    const cup = making;
    if (!cup) {
      takeNext();
      return;
    }
    if (cup.station === "ice") addIce();
    else if (cup.station === "sugar") pumpSyrup();
    else if (cup.station === "pour") startHold(source);
    else if (cup.station === "scoop") drop();
    else if (cup.station === "shake") shake();
    else stamp();
  }

  // --- Brewing and samples -------------------------------------------------------------

  /** Starts a low or empty tank brewing; any time in the shift, except mid-pour from that tap. */
  function brew(index: number) {
    if (!playing()) return;
    const tea = TEA_NAMES[TEAS[index]];
    if (brewEnds[index] > 0) return;
    if (tankState(tanks[index]) === "ok") {
      note(`${tea} has plenty left`);
      return;
    }
    if (holds.size && making?.station === "pour" && tapIndex === index) {
      note(`let go of the ${tea} tap first`);
      return;
    }
    wake();
    brewEnds[index] = clock + BREW_SECONDS;
    sfxBrew();
    coach.done("brew");
    coach.done("dry");
    refreshTanks();
    liveMessage = `The ${tea} is brewing.`;
  }

  function stepBrewing() {
    brewEnds.forEach((end, index) => {
      if (end <= 0 || clock < end) return;
      brewEnds[index] = 0;
      tanks[index] = TANK_CAPACITY;
      sfxBrewed();
      liveMessage = `${TEA_NAMES[TEAS[index]]} is brewed and the tank is full.`;
      refreshTanks();
    });
  }

  /** A free sample for whoever is closest to leaving, not the guest being made. */
  function giveSample() {
    if (!playing() || samplesLeft <= 0) return;
    const guest = guests[sampleFor(guests, making)];
    if (!guest) {
      // Never wasted on someone happy to wait.
      note("nobody needs one yet");
      return;
    }
    wake();
    guest.left = sampleBoost(guest.left, guest.patience);
    samplesLeft -= 1;
    sfxPlop(sampleCap - samplesLeft);
    coach.done("sample");
    guests = guests;
    note(`sample for ${guest.regular.name}`);
    liveMessage = `A free sample for ${guest.regular.name}; they will wait longer. ${samplesLeft} ${samplesLeft === 1 ? "sample" : "samples"} left.`;
  }

  // --- Serving ----------------------------------------------------------------------

  /** The drink as the guest will judge it. Patience is frozen once stamped, so this holds until it's served. */
  function judge(cup: Cup) {
    const guest = guests.find((item) => item.id === cup.guestId);
    if (!guest || !cup.tea) return null;
    const result = gradeDrink({
      order: cup.order,
      tea: cup.tea,
      iceCount: cup.ice,
      sugarCount: cup.sugar,
      level: cup.level,
      drops: cup.drops,
      shakeSeconds: cup.shakeSeconds ?? 99,
      sealValue: cup.sealValue ?? 0,
      patienceFraction: clamp(guest.left / guest.patience, 0, 1),
      expert: expert,
    });
    return { guest, tea: cup.tea, result, patienceFraction: clamp(guest.left / guest.patience, 0, 1) };
  }

  function serveCup() {
    const cup = making;
    if (!cup) return;
    const judged = judge(cup);
    making = null;
    beats = [];
    holds.clear();
    if (!judged) {
      guests = guests;
      return;
    }
    const { guest, tea, result, patienceFraction } = judged;
    const name = guest.regular.name;
    const until = clock + RECEIPT_SECONDS;
    // The receipt rises where the guest stands, as they take the drink.
    const x = crowd.xOf(guest.id) ?? cupX;

    if (!result.accepted) {
      sfxWrong();
      removeGuest(guest, "gone", "sentBack");
      const line = `${name} ordered ${TEA_NAMES[cup.order.tea]}, not ${TEA_NAMES[tea]}`;
      receipt = {
        id: ++receiptId,
        x,
        name,
        sentBack: true,
        rows: [],
        points: 0,
        stamps: [],
        combo: 0,
        perfect: false,
        line,
        until,
      };
      if (!reduceMotion) veilAge = 0;
      liveMessage = `${line}. The drink was sent back, and you lose a pearl.`;
      loseLife();
      return;
    }

    const nextStreak = keepsStreak(result.total) ? streak + 1 : 0;
    const pay = pointsForDrink(result.total, guest.regular, nextStreak, cup.order.tea === special, expert);
    const perfect = result.total >= PERFECT;
    const reaction = servedMood(result.total, patienceFraction);
    const before = comboFor(streak, expert);
    let jarPaid = 0;
    let pearlBack = false;
    streak = nextStreak;
    bestStreak = Math.max(bestStreak, streak);
    score += pay.points;
    served += 1;
    gradeTotal += result.total;
    if (perfect) perfects += 1;
    // Tips into the jar; a full jar pays out and buys back a lost pearl.
    const filled = fillJar(jar, pay.coins);
    jar = filled.jar;
    if (filled.payouts) {
      const paid = jarPayout(filled.payouts, lives);
      jarPaid = paid.points;
      pearlBack = paid.lives > lives;
      score += paid.points;
      lives = paid.lives;
      jarsCashed += filled.payouts;
    }
    sfxServe(pay.tip > 0);
    // The fanfare comes in just after the serve chime.
    if (perfect) timers.later(() => sfxMilestone(), 220);
    // The room answers too: the lamps flare for a moment, up out of the way.
    if (perfect && !reduceMotion) flareAge = 0;
    removeGuest(guest, "served", reaction, pay.coins);
    const cheered = perfect ? cheerLine() : 0;
    if (pay.multiplier > before) {
      // The combo steps up: a louder chord each step, and the lamps answer.
      timers.later(() => sfxCombo(pay.multiplier), perfect ? 520 : 200);
      popBeside(`×${pay.multiplier} combo`, "perfect", 1.4, 2);
      if (!reduceMotion) flareAge = 0;
    } else if (!keepsStreak(result.total) && before > 1) {
      popBeside("combo lost", "miss", 1.1, 2);
    }

    const rows = [
      { label: "ice", word: gradeWord(result.ice) },
      { label: "sugar", word: gradeWord(result.sugar) },
      { label: "pour", word: gradeWord(result.pour) },
    ];
    if (result.scoop !== null) rows.push({ label: "scoops", word: gradeWord(result.scoop) });
    rows.push(
      { label: "shake", word: gradeWord(result.shake) },
      { label: "seal", word: gradeWord(result.seal) },
      { label: "wait", word: gradeWord(result.wait) },
    );
    const critic = guest.regular.quirk === "critic";
    const stamps = [
      pay.tip > 0 ? `tip +${pay.tip}` : "",
      pay.specialBonus > 0 ? `special +${pay.specialBonus}` : "",
      critic ? "critic ×2" : "",
      pay.criticBonus > 0 ? `critic bonus +${pay.criticBonus}` : "",
      jarPaid > 0 ? `tip jar +${jarPaid}` : "",
      pearlBack ? "pearl back" : "",
    ].filter(Boolean);
    receipt = {
      id: ++receiptId,
      x,
      name,
      sentBack: false,
      rows,
      points: pay.points,
      stamps,
      combo: pay.multiplier > 1 ? pay.multiplier : 0,
      perfect,
      line: "",
      // Held a moment longer the first time a lesson is about it.
      until: until + (!coach.learned("serve") || (pay.multiplier > 1 && !coach.learned("combo")) ? RECEIPT_LESSON_SECONDS : 0),
    };
    const extras = [
      pay.tip > 0 ? `a tip of ${pay.tip}` : "",
      pay.specialBonus > 0 ? `${pay.specialBonus} for today's special` : "",
      critic ? "double for the critic" : "",
      pay.criticBonus > 0 ? `a critic's bonus of ${pay.criticBonus}` : "",
      pay.multiplier > 1 ? `a ×${pay.multiplier} combo` : "",
    ].filter(Boolean);
    const tail = [
      jarPaid > 0 ? ` The tip jar filled and paid ${jarPaid}${pearlBack ? ", and bought back a pearl" : ""}.` : "",
      cheered ? " The line cheers up." : "",
    ].join("");
    liveMessage = `Served ${name}, ${perfect ? "perfect, " : ""}graded ${result.total} of 100: ${pay.points} points${extras.length ? ` with ${extras.join(" and ")}` : ""}.${tail}`;
  }

  // --- Drawing ----------------------------------------------------------------------

  /** The liquid's surface, in px, without the wobble. */
  function surfaceY(cup: Cup) {
    return cupTop + 17 * cell - Math.min(cup.level, 1) * INSIDE_ROWS * cell;
  }

  function pouring(cup: Cup | null): cup is Cup {
    return !!cup && cup.station === "pour" && !cup.busy && holds.size > 0;
  }

  const cupLeftAt = (cx: number) => Math.round(cx - (CUP_W / 2) * cell);

  /** Where the taps end: STREAM_ROWS above the cup's rim. */
  const nozzleBottom = () => Math.round(cupTop - STREAM_ROWS * cell);
  /** The top of the back-bar shelf, where the machines stand. */
  const shelfTop = () => nozzleBottom() - TAP_DROP * cell;
  /** The shelf's underside. */
  const shelfBottom = () => shelfTop() + SHELF_ROWS * cell;
  /** Where the cup goes for the scoop, the shake and the seal: between the middle two machines. */
  const workX = () => W / 2;
  /** The syrup bottle's tube, which the cup goes under for the syrup. */
  const pumpTipX = () => Math.round(pumpX - (PUMP_W / 2 + 1.5) * cell);
  /** Where the cup stands at its station. */
  function stationX(cup: Cup) {
    if (cup.station === "sugar") return pumpTipX();
    if (cup.station === "ice" || cup.station === "pour") return spoutX[tapIndex] ?? workX();
    return workX();
  }

  /**
   * A grade word beside the cup, on its left, so it never sits on the
   * machinery above. Only when the cup is too near the left edge (under the
   * first tap on a phone) does it go to the right, past the fill pennant.
   */
  function popBeside(text: string, kind: "plain" | "perfect" | "miss", life: number, row: number) {
    let width = text.length * 7;
    if (ctx) {
      ctx.save();
      ctx.font = popupFont;
      width = ctx.measureText(text).width;
      ctx.restore();
    }
    const left = cupLeftAt(cupX);
    const gap = 1.5 * cell + 4;
    let x = left - gap - width / 2;
    if (x - width / 2 < 2) x = Math.min(W - width / 2 - 2, left + (CUP_W + 3.5) * cell + gap + width / 2);
    addPopup(popups, x, cupTop + row * cell, text, kind, life);
  }

  /**
   * The back bar: the shelf and its brackets, then everything standing on it.
   * Machines that can't be used right now are faded, the way the buttons
   * over them are.
   */
  function drawBackBar(g: CanvasRenderingContext2D, colors: Colors) {
    const c = cell;
    const top = shelfTop();
    // Brackets under the shelf, into the wall: at the ends and under each machine.
    const brackets = [c * 2, W - c * 3, ...spoutX];
    if (pumpX) brackets.push(pumpX);
    for (const x of brackets) {
      const bx = Math.round(x - c / 2);
      g.fillStyle = WOOD_EDGE;
      for (let row = 0; row < 3; row++) g.fillRect(bx - (2 - row) * c, top + (SHELF_ROWS + row) * c, (3 - row) * c, c);
    }
    // The plank: a light top edge, a face, a dark lip.
    g.fillStyle = WOOD_TOP;
    g.fillRect(0, top, W, c);
    g.fillStyle = WOOD_FACE;
    g.fillRect(0, top + c, W, (SHELF_ROWS - 1) * c);
    g.fillStyle = WOOD_EDGE;
    g.fillRect(0, top + SHELF_ROWS * c - Math.max(2, Math.round(c / 3)), W, Math.max(2, Math.round(c / 3)));

    drawIceBin(g);
    drawPump(g, colors);
    const flowingAt = streamOn ? tapIndex : -1;
    const wordsFit = teaWordsFit();
    TEAS.forEach((tea, index) => {
      const x = spoutX[index];
      if (x === undefined) return;
      g.save();
      g.globalAlpha = (!making && brewEnds[index] === 0) || tapLive(index) ? 1 : 0.55;
      drawDispenser(g, colors, x, tea, clamp(tanks[index] / TANK_CAPACITY, 0, 1), index === flowingAt, brewEnds[index] > 0);
      // Its label on the glass, clear of the tap below; the tea shows above and below it.
      const left = Math.round(x - (tankW / 2) * cell);
      const tankTop = shelfTop() - MACHINE_ROWS * cell + 2 * cell;
      const rows = Math.max(2, Math.ceil(((GLYPH_ROWS + 4) * labelUnit()) / cell));
      const label = TEA_LABELS[tea];
      drawJarLabel(g, label.word, label.icon, wordsFit, left + cell, tankW - 2, tankTop + Math.floor((6 - rows) / 2) * cell, left + 2 * cell);
      g.restore();
    });
  }

  /** Each tea's label: a short printed word, and a flavour mark for a jar too narrow for it. */
  const TEA_LABELS: Record<Tea, { word: string; icon: keyof typeof ICONS }> = {
    milk: { word: TEA_WORDS.milk, icon: "milk" },
    taro: { word: TEA_WORDS.taro, icon: "taro" },
    matcha: { word: TEA_WORDS.matcha, icon: "leaf" },
    strawberry: { word: TEA_WORDS.strawberry, icon: "berry" },
  };
  const LABEL_PAPER = "#ede0c6";
  const LABEL_SHADE = "#d4c3a3";
  const LABEL_LIGHT = "#f8f0e0";
  const LABEL_EDGE = "#b9a587";
  const LABEL_INK = "#54443a";

  /** The print unit on a label: a quarter of a cell, at least 2px, so the lettering stays on a pixel grid. */
  const labelUnit = () => Math.max(2, Math.round(cell / 4));

  /** Whether every tea's word fits its jar; if one doesn't, they all show their mark, so the row reads alike. */
  function teaWordsFit() {
    const room = (tankW - 2) * cell - 4 * labelUnit();
    return TEAS.every((tea) => wordWidth(TEA_LABELS[tea].word) * labelUnit() <= room);
  }

  /**
   * A paper label on a jar, drawn on the jar's own cells: a warm off-white
   * a shade under the HUD's paper, darker toward each side where the jar
   * curves away and lighter where the glass catches the light, a faint edge
   * top and bottom, the top right corner lifting off the glass, and the word
   * printed small in soft ink (or the flavour's mark, when `useWord` is off).
   * `jarLeft` and `jarCols` are the glass's first cell and its width in cells;
   * `top` is the label's first row; `highlightX` is the glass's shine.
   */
  function drawJarLabel(
    g: CanvasRenderingContext2D,
    word: string,
    icon: keyof typeof ICONS,
    useWord: boolean,
    jarLeft: number,
    jarCols: number,
    top: number,
    highlightX = -1,
  ) {
    const c = cell;
    const u = labelUnit();
    const content = useWord ? wordWidth(word) * u : 5 * u;
    const cols = Math.min(jarCols, Math.max(3, Math.ceil((content + 4 * u) / c)));
    const rows = Math.max(2, Math.ceil(((GLYPH_ROWS + 4) * u) / c));
    const left = Math.round(jarLeft + Math.floor((jarCols - cols) / 2) * c);
    const y0 = Math.round(top);
    const width = cols * c;
    const height = rows * c;
    // The paper, all but the lifted corner.
    g.fillStyle = LABEL_PAPER;
    g.fillRect(left, y0, width - u, u);
    g.fillRect(left, y0 + u, width, height - u);
    // The jar's curve: a shaded column at each side, dithered into the paper.
    g.fillStyle = LABEL_SHADE;
    for (let y = y0; y < y0 + height; y += u) {
      const row = (y - y0) / u;
      g.fillRect(left, y, u, u);
      if (row > 0) g.fillRect(left + width - u, y, u, u);
      if (row % 2 === 0) {
        g.fillRect(left + u, y, u, u);
        if (row > 0) g.fillRect(left + width - 2 * u, y, u, u);
      }
    }
    // Where the glass shines, the paper does too.
    if (highlightX >= left + 2 * u && highlightX < left + width - 3 * u) {
      g.fillStyle = LABEL_LIGHT;
      g.fillRect(highlightX, y0 + u, u, height - 2 * u);
    }
    // A faint edge along the top and bottom (the sides are the shading).
    g.fillStyle = LABEL_EDGE;
    g.fillRect(left + u, y0, width - 3 * u, Math.max(1, Math.round(u / 2)));
    g.fillRect(left, y0 + height - Math.max(1, Math.round(u / 2)), width, Math.max(1, Math.round(u / 2)));
    // The lifted corner: its underside, a shade darker, folded down.
    g.fillStyle = LABEL_SHADE;
    g.fillRect(left + width - 2 * u, y0 + u, u, u);
    // The print, on the label's own unit grid, centred.
    const x = left + Math.round((width - content) / (2 * u)) * u;
    const y = y0 + Math.round((height - GLYPH_ROWS * u) / (2 * u)) * u;
    if (useWord) {
      g.fillStyle = LABEL_INK;
      let pen = x;
      for (const letter of word) {
        const glyph = GLYPHS[letter];
        if (!glyph) {
          pen += 4 * u;
          continue;
        }
        glyph.forEach((line, row) => {
          [...line].forEach((cell, column) => {
            if (cell === "#") g.fillRect(pen + column * u, y + row * u, u, u);
          });
        });
        pen += (glyph[0].length + 1) * u;
      }
    } else {
      drawSprite(g, ICONS[icon].grid, x, y, u, ICONS[icon].palette);
    }
  }

  /** One tea machine standing on the shelf at `x`, its tank `share` full. */
  function drawDispenser(
    g: CanvasRenderingContext2D,
    colors: Colors,
    x: number,
    tea: Tea,
    share: number,
    flowing: boolean,
    brewing: boolean,
  ) {
    const c = cell;
    const line = Math.max(2, Math.round(c / 3));
    const left = Math.round(x - (tankW / 2) * c);
    const base = shelfTop();
    const top = base - MACHINE_ROWS * c;
    const tankTop = top + 2 * c;
    const tankBottom = top + 8 * c;
    // The lid and its knob. Nothing is drawn behind the machine: its own ink
    // outlines part it from the wall.
    g.fillStyle = colors.ink;
    g.fillRect(Math.round(x - c), top, 2 * c, c);
    g.fillRect(left + 2 * c, top + c, (tankW - 4) * c, c);
    // The glass tank, with the tea in it; it sloshes while this tap runs.
    g.fillStyle = GLASS;
    g.fillRect(left + c, tankTop, (tankW - 2) * c, tankBottom - tankTop);
    if (share > 0) {
      g.fillStyle = TEA_COLORS[tea];
      const height = tankBottom - tankTop - c;
      for (let column = 1; column < tankW - 1; column++) {
        const slosh = flowing && !reduceMotion ? Math.sin(clock * 14 + column * 1.3) * 0.45 * c : 0;
        const surface = Math.min(tankBottom - 1, tankBottom - share * height + slosh);
        g.fillRect(left + column * c, surface, c, tankBottom - surface);
      }
    }
    // A highlight down the glass, then its outline.
    g.fillStyle = "rgba(255, 255, 255, 0.7)";
    g.fillRect(left + 2 * c, tankTop + c, Math.max(2, Math.round(c / 2)), tankBottom - tankTop - 2 * c);
    g.strokeStyle = colors.ink;
    g.lineWidth = line;
    g.strokeRect(left + c + line / 2, tankTop + line / 2, (tankW - 2) * c - line, tankBottom - tankTop - line);
    // A collar in the tea's colour, so each machine reads as its tea.
    g.fillStyle = colors.ink;
    g.fillRect(left, tankBottom, tankW * c, c);
    g.fillStyle = TEA_COLORS[tea];
    g.fillRect(left + line, tankBottom + line, tankW * c - 2 * line, c - 2 * line);
    // The base: steel, on two feet.
    g.fillStyle = STEEL;
    g.fillRect(left, tankBottom + c, tankW * c, base - tankBottom - 2 * c);
    g.strokeStyle = colors.ink;
    g.strokeRect(left + line / 2, tankBottom + c, tankW * c - line, base - tankBottom - 2 * c);
    g.fillStyle = colors.ink;
    g.fillRect(left + c, base - c, 2 * c, c);
    g.fillRect(left + (tankW - 3) * c, base - c, 2 * c, c);
    // The tap under the base: a body with a lever to one side, and a spout
    // down over the shelf's edge.
    const tip = nozzleBottom();
    g.fillStyle = colors.ink;
    g.fillRect(Math.round(x + c), base - 2 * c, c, c);
    g.fillRect(Math.round(x - c), base - 2 * c, 2 * c, tip - base + 2 * c);
    g.fillStyle = STEEL_DARK;
    g.fillRect(Math.round(x - c) + line, base - 2 * c + line, 2 * c - 2 * line, tip - base + 2 * c - 2 * line);
    if (brewing && !reduceMotion) {
      // Brewing: the lid lifts a little with the steam.
      g.fillStyle = colors.ink;
      g.fillRect(left + 2 * c, top + Math.round(Math.sin(clock * 20) * 0.5) * 2, (tankW - 4) * c, Math.max(2, line));
    }
  }

  /**
   * The syrup bottle at the shelf's right end: a pump head that dips with
   * each pump, a tube down over the shelf's edge, and a label marked with the
   * pumps the drink wants, filling as they go in.
   */
  function drawPump(g: CanvasRenderingContext2D, colors: Colors) {
    if (!pumpX) return;
    const c = cell;
    const line = Math.max(2, Math.round(c / 3));
    const base = shelfTop();
    const left = Math.round(pumpX - (PUMP_W / 2) * c);
    const live = !!making && sugarAdjustable(making);
    const press = !reduceMotion && pumpAge < 0.16 ? Math.round(Math.sin((pumpAge / 0.16) * Math.PI) * 2) * c : 0;
    g.save();
    g.globalAlpha = !making || live ? 1 : 0.55;
    const top = base - PUMP_ROWS * c;
    // The bottle.
    g.fillStyle = SYRUP;
    g.fillRect(left, top + 4 * c, PUMP_W * c, base - top - 4 * c);
    g.fillStyle = GLASS;
    g.fillRect(left, top + 4 * c, PUMP_W * c, c);
    g.strokeStyle = colors.ink;
    g.lineWidth = line;
    g.strokeRect(left + line / 2, top + 4 * c + line / 2, PUMP_W * c - line, base - top - 4 * c - line);
    // The neck, and the pump head on its stem.
    g.fillStyle = colors.ink;
    g.fillRect(left + 3 * c, top + 3 * c, 2 * c, c);
    g.fillRect(Math.round(pumpX - c / 2), top + c + press, c, 2 * c - press);
    g.fillRect(left + 2 * c, top + press, 4 * c, c);
    // The tube from the head, out and down over the shelf's edge.
    const tip = nozzleBottom();
    g.fillRect(left + 2 * c, top + press, c, c);
    g.fillRect(left - c, top + press, 3 * c, c);
    g.fillRect(left - 2 * c, top + press, c, tip - top - press);
    // The label: a ring for each pump the drink wants, filled as each goes in.
    const target = making ? sugarPumps(making.order.sugar) : 0;
    const given = making?.sugar ?? 0;
    // Its label low on the bottle, and above it the pumps the drink wants.
    const pumpWord = wordWidth("syrup") * labelUnit() + 4 * labelUnit() <= PUMP_W * c;
    drawJarLabel(g, "syrup", "syrup", pumpWord, left, PUMP_W, top + 7 * c, left + c);
    const labelTop = top + 4.5 * c;
    if (making && (target || given)) {
      const marks = Math.max(target, given);
      const size = Math.max(2, Math.round(c * 0.8));
      const gap = ((PUMP_W - 2) * c - marks * size) / (marks + 1);
      for (let index = 0; index < marks; index++) {
        const mx = Math.round(left + c + gap + index * (size + gap));
        const my = Math.round(labelTop + 1.5 * c - size / 2);
        g.fillStyle = index >= target ? colors.slab : "#fbe08a";
        if (index < given) {
          g.fillRect(mx, my, size, size);
          g.strokeStyle = colors.ink;
          g.lineWidth = 1;
          g.strokeRect(mx + 0.5, my + 0.5, size - 1, size - 1);
        } else {
          g.strokeStyle = colors.ink;
          g.lineWidth = 1;
          g.strokeRect(mx + 0.5, my + 0.5, size - 1, size - 1);
        }
      }
    }
    g.restore();
  }

  /** The tip jar stands at the counter's left end. */
  const tipJarLeft = () => cell;
  const tipJarRight = () => tipJarLeft() + JAR_W * guestPx;

  /** While it's quiet: a stack of clean cups, a napkin holder and a jar of straws. */
  function drawIdleProps(g: CanvasRenderingContext2D, colors: Colors) {
    const x = W - 10 * cell;
    for (let index = 0; index < 3; index++) {
      drawHalo(g, SPARE_CUP, x, counterY - (SPARE_CUP.length + index * 2) * cell, cell, HALO);
      drawSprite(g, SPARE_CUP, x, counterY - (SPARE_CUP.length + index * 2) * cell, cell, {
        O: colors.ink,
        p: colors.paper,
      });
    }
    // Seeded spots, so they sit in the same places every visit, clear of the tip jar.
    const napkinX = Math.round(Math.max((0.05 + hash(5) * 0.05) * W, tipJarRight() + 2 * cell));
    const strawX = napkinX + (NAPKINS[0].length + 2 + Math.round(hash(9) * 3)) * cell;
    drawHalo(g, NAPKINS, napkinX, counterY - NAPKINS.length * cell, cell, HALO);
    drawHalo(g, STRAW_JAR, strawX, counterY - STRAW_JAR.length * cell, cell, HALO);
    drawSprite(g, NAPKINS, napkinX, counterY - NAPKINS.length * cell, cell, { O: colors.ink, p: LID });
    drawSprite(g, STRAW_JAR, strawX, counterY - STRAW_JAR.length * cell, cell, {
      O: colors.ink,
      S: STRAW_PINK,
      B: "#6aa6e0",
    });
  }

  /** The ice bin's left edge, standing on the shelf under the ice button. */
  const binLeft = () => Math.round(Math.max(cell, binX - (ICE_BIN[0].length / 2) * cell));
  const BIN_PALETTE = { O: INK, L: LID, h: "#ffffff", p: "#dceef4", s: "#b5d2dc", B: "#8fb8c9" };

  /** The ice bin on the shelf, lid propped open. */
  function drawIceBin(g: CanvasRenderingContext2D) {
    const top = shelfTop() - ICE_BIN.length * cell;
    const fade = !making || iceAdjustable(making);
    g.save();
    g.globalAlpha = fade ? 1 : 0.55;
    drawHalo(g, ICE_BIN, binLeft(), top, cell, HALO);
    drawSprite(g, ICE_BIN, binLeft(), top, cell, BIN_PALETTE);
    const binWord = wordWidth("ice") * labelUnit() + 4 * labelUnit() <= (ICE_BIN[0].length - 2) * cell;
    drawJarLabel(g, "ice", "ice", binWord, binLeft() + cell, ICE_BIN[0].length - 2, top + 7 * cell);
    g.restore();
  }

  /**
   * Where a cube of ice is on its way from the bin to the cup, at 0–1: out
   * of the bin's front, below the shelf, so it never crosses the machines.
   */
  function iceArcAt(u: number) {
    const fromX = binLeft() + (ICE_BIN[0].length / 2) * cell;
    const fromY = shelfBottom() + cell;
    const toX = cupX;
    const toY = cupTop + 2 * cell;
    const peak = fromY;
    const x = lerp(fromX, toX, u);
    const y = (1 - u) * (1 - u) * fromY + 2 * (1 - u) * u * peak + u * u * toY;
    return { x, y };
  }

  function drawIceArcs(g: CanvasRenderingContext2D) {
    for (const arc of iceArcs) {
      const u = clamp(arc.age / ICE_ARC_SECONDS, 0, 1);
      const { x, y } = iceArcAt(u);
      drawHalo(g, ICE_CUBE, x - 1.5 * cell, y, cell, HALO);
      drawSprite(g, ICE_CUBE, x - 1.5 * cell, y, cell, ICE_PALETTE);
    }
  }

  /** A squirt of syrup from the bottle's tube, just after a pump. */
  function drawSyrup(g: CanvasRenderingContext2D) {
    if (pumpAge > 0.2 || !making || making.station !== "sugar") return;
    const x = pumpTipX();
    const top = nozzleBottom();
    const bottom = top + (cupTop + 15 * cell - top) * clamp(pumpAge / 0.12, 0, 1);
    g.fillStyle = SYRUP;
    g.fillRect(Math.round(x - cell / 2), top, Math.max(2, Math.round(cell / 2) * 2 - 2), Math.max(0, bottom - top));
  }

  /** Pearls are dark; on the night theme they take the ink colour instead. */
  function iconPalette(kind: Topping) {
    return TOPPING_ART[kind].palette;
  }

  function surfaceWobble(column: number) {
    if (reduceMotion || wobble < 0.01) return 0;
    return Math.sin(clock * 9 + column * 1.1) * 0.35 * cell * wobble;
  }

  function drawCup(g: CanvasRenderingContext2D, colors: Colors, cup: Cup, cx: number, top: number) {
    const c = cell;
    const left = cupLeftAt(cx);
    const base = top + 17 * c;
    const inside = (row: number, column: number) => {
      const inset = wallInset(row);
      return column >= inset + 1 && column <= 12 - inset;
    };

    // A paper halo round the whole cup, an opaque inside (so the fill line and
    // the tea never have the room showing through), then the tea with
    // sub-cell precision, clipped row by row to the tapering walls.
    drawHalo(g, CUP_SILHOUETTE, left, top, c, HALO);
    g.fillStyle = EMPTY_CUP;
    for (let row = 1; row <= INSIDE_ROWS; row++) {
      const inset = wallInset(row);
      g.fillRect(left + (inset + 1) * c, top + row * c, (12 - 2 * inset) * c, c);
    }
    const surface = surfaceY(cup);
    if (cup.tea && cup.level > 0) {
      g.fillStyle = TEA_COLORS[cup.tea];
      for (let column = 1; column <= 12; column++) {
        const s = Math.max(top + c, surface + surfaceWobble(column));
        for (let row = 1; row <= INSIDE_ROWS; row++) {
          if (!inside(row, column)) continue;
          const y0 = top + row * c;
          const from = Math.max(y0, s);
          if (from < y0 + c) g.fillRect(left + column * c, from, c, y0 + c - from);
        }
      }
    }

    // Syrup sits on the bottom until the tea goes in and takes it up.
    if (!cup.tea && cup.sugar > 0) {
      const rows = Math.min(cup.sugar, SUGAR_MAX) * 0.5;
      g.fillStyle = SYRUP;
      g.fillRect(left + 3 * c, base - rows * c, 8 * c, rows * c);
    }

    // Scoops that landed, settled on the bottom.
    cup.pile.forEach((kind, index) => {
      const [column, row] = PILE_SLOTS[index % PILE_SLOTS.length];
      drawSprite(g, TOPPING_ART[kind].grid, left + column * c, top + row * c, c, TOPPING_ART[kind].palette);
    });

    // The straw, once the sealer has been, runs down through the drink.
    const strawCells = strawProgress(cup);
    if (strawCells > 0) {
      g.fillStyle = STRAW_PINK;
      g.fillRect(left + 9 * c, top + c, c, 12 * c);
    }

    // Before the tea, the cup marks a slot for each cube the ticket wants:
    // a dotted square on the bottom, filled as each cube lands. A cube past
    // the ticket's count lands ringed in accent.
    const landed = Math.max(0, cup.ice - iceArcs.length);
    const target = ICE_CUBES[cup.order.ice];
    const marking = (cup.station === "ice" || cup.station === "pour") && !cup.tea;
    if (marking) {
      const dot = Math.max(2, Math.round(c * 0.6));
      for (let index = landed; index < Math.min(target, ICE_REST.length); index++) {
        const [column, row] = ICE_REST[index];
        // A faint ice-blue slot, ringed in dots.
        g.fillStyle = ICE_SLOT;
        g.fillRect(left + column * c, top + row * c, 3 * c, 3 * c);
        g.fillStyle = colors.ink;
        for (const [dx, dy] of ICE_RING) {
          g.fillRect(
            Math.round(left + (column + dx + 0.5) * c - dot / 2),
            Math.round(top + (row + dy + 0.5) * c - dot / 2),
            dot,
            dot,
          );
        }
      }
    }
    // Ice the player dropped in rests on the bottom and bobs up with the tea;
    // a cube still in the air isn't in the cup yet.
    const floats = ICE_FLOAT[clamp(cup.ice, 1, 6)];
    for (let index = 0; index < Math.min(landed, ICE_REST.length); index++) {
      const [restColumn, restRow] = ICE_REST[index];
      const restTop = top + restRow * c;
      // The last two float a cell lower, under the first four.
      const sink = index >= 4 ? c : 0;
      const y = Math.max(top - c + sink, Math.min(restTop, surface - c + sink));
      const lift = clamp((restTop - y) / (2 * c), 0, 1);
      const row = clamp(Math.floor((y - top) / c) + 2, 1, INSIDE_ROWS);
      const inset = wallInset(row);
      let column = Math.round(lerp(restColumn, floats[index], lift));
      column = clamp(column, inset + 1, 12 - inset - 2);
      const jitter = reduceMotion ? 0 : iceJitter[index] * c * Math.exp(-joltAge * 14);
      const x = left + column * c + jitter;
      drawSprite(g, ICE_CUBE, x, y, c, ICE_PALETTE);
      if (marking && index >= target) {
        g.strokeStyle = colors.slab;
        g.lineWidth = Math.max(2, Math.round(c / 3));
        g.strokeRect(Math.round(x) - 1, Math.round(y) - 1, 3 * c + 2, 3 * c + 2);
      }
    }

    // At the ice and the pour: a dashed line where the tea should stop.
    if (cup.station === "pour" || cup.station === "ice") {
      const lineY = base - FILL_LINE[cup.order.ice] * INSIDE_ROWS * c;
      const row = clamp(Math.floor((lineY - top) / c), 1, INSIDE_ROWS);
      const inset = wallInset(row);
      const thick = Math.max(2, Math.round(c / 3));
      g.fillStyle = colors.ink;
      for (let column = inset + 1; column <= 12 - inset; column += 2) {
        g.fillRect(left + column * c, Math.round(lineY - thick / 2), c, thick);
      }
      // An accent pennant on the outside of the wall, pointing at the line.
      const edge = left + (CUP_W - inset) * c + 1;
      g.fillStyle = colors.slab;
      g.beginPath();
      g.moveTo(edge, lineY);
      g.lineTo(edge + 3 * c, lineY - 1.2 * c);
      g.lineTo(edge + 3 * c, lineY + 1.2 * c);
      g.closePath();
      g.fill();
    }

    // The walls, the rim and the base in ink.
    g.fillStyle = colors.ink;
    g.fillRect(left, top, CUP_W * c, c);
    for (let row = 1; row <= INSIDE_ROWS; row++) {
      const inset = wallInset(row);
      g.fillRect(left + inset * c, top + row * c, c, c);
      g.fillRect(left + (CUP_W - 1 - inset) * c, top + row * c, c, c);
    }
    g.fillRect(left + 2 * c, top + 17 * c, 10 * c, c);

    // Past full, tea runs down the outside.
    const spill = clamp((cup.level - 1) / (POUR_MAX - 1), 0, 1);
    if (spill > 0 && cup.tea) {
      g.fillStyle = TEA_COLORS[cup.tea];
      const length = Math.round(spill * (CUP_H - 1) * c);
      g.fillRect(left - c, top + c, c, length);
      g.fillRect(left + CUP_W * c, top + c, c, length);
    }

    if (cup.station === "shake") {
      // Each shake bumps the lid up a cell; the last one flashes the drink
      // through it.
      const effort = !reduceMotion;
      const lift = effort && joltAge < 0.09 ? c : 0;
      const flash = effort && flashAge < 0.3 && cup.tea ? TEA_COLORS[cup.tea] : LID;
      drawHalo(g, SHAKER, left, top - SHAKER.length * c - lift, c, HALO);
      drawSprite(g, SHAKER, left, top - SHAKER.length * c - lift, c, { O: colors.ink, L: flash });
    }
    if (cup.sealed && cup.sealValue !== null) {
      // Clean, crooked (loose), or browned (scorched).
      const result = sealResult(cup.sealValue, expert);
      const film = result === "scorched" ? SCORCHED : LID;
      const palette = { O: colors.ink, L: film };
      if (result === "loose") {
        // Lifted a cell at one side: it never sat down flat.
        const half = CUP_W / 2;
        drawHalo(g, FILM, left, top - 2 * c, c, HALO, 0, half);
        drawHalo(g, FILM, left + half * c, top - c, c, HALO, half);
        drawSprite(g, FILM, left, top - 2 * c, c, palette, 0, half);
        drawSprite(g, FILM, left + half * c, top - c, c, palette, half);
      } else {
        drawHalo(g, FILM, left, top - c, c, HALO);
        drawSprite(g, FILM, left, top - c, c, palette);
      }
    }
    if (strawCells > 0) {
      // Out through the film at a slight lean.
      const above: Array<[number, number]> = [
        [9, -1],
        [9, -2],
        [10, -3],
        [10, -4],
      ];
      g.fillStyle = STRAW_PINK;
      for (const [column, row] of above.slice(0, strawCells)) g.fillRect(left + column * c, top + row * c, c, c);
    }
  }

  /** Each tea's palette for the stacked drink, made once. */
  const drinkPalettes = new Map<Tea, Record<string, string>>();

  function drinkPalette(tea: Tea) {
    let palette = drinkPalettes.get(tea);
    if (!palette) {
      palette = {
        O: INK,
        t: TEA_COLORS[tea],
        T: mixHex(TEA_COLORS[tea], INK, 0.22),
        F: LID,
        f: mixHex(LID, INK, 0.18),
        S: STRAW_PINK,
        P: PEARL,
        D: TOPPING_ART.pudding.palette.P,
        J: TOPPING_ART.jelly.palette.J,
        R: TOPPING_ART.redbean.palette.R,
      };
      drinkPalettes.set(tea, palette);
    }
    return palette;
  }

  /** One turn's sprite for this drink, made (once) as a cached sprite. */
  function drinkSprite(tea: Tea, key: string, index: number) {
    const frame = drinkGrid(index, key);
    return { frame, sprite: cachedSprite(`orders-drink-${tea}-${key}-${index}`, frame.grid, cell, drinkPalette(tea), HALO) };
  }

  /**
   * A perfect drink's turn is made before it plays: from the stamp, a few
   * of its sprites a frame (there are TURN_FRAMES), so the turn itself only
   * draws.
   */
  const warming = { tea: "milk" as Tea, key: "", next: TURN_FRAMES };

  function warmTurn() {
    for (let count = 0; count < 4 && warming.next < TURN_FRAMES; count++) drinkSprite(warming.tea, warming.key, warming.next++);
  }

  /**
   * The sealed drink as a stacked sprite (orders-drink.js), `share` of the
   * way through one turn, standing with its foot at (`x`, `base`).
   */
  function drawTurningDrink(g: CanvasRenderingContext2D, cup: Cup, x: number, base: number, share: number, alpha: number) {
    const { frame, sprite } = drinkSprite(cup.tea ?? cup.order.tea, toppingKey(cup.order.toppings), turnIndex(share));
    g.save();
    g.globalAlpha = alpha;
    g.drawImage(sprite, Math.round(x - frame.anchorX * cell) - SPRITE_PAD, Math.round(base - (frame.foot + 1) * cell) - SPRITE_PAD);
    g.restore();
  }

  /** How many cells of straw show above the film (0 before it pops in). */
  function strawProgress(cup: Cup) {
    if (cup.station !== "seal" || cup.stampAt === null) return 0;
    const t = clock - cup.stampAt;
    if (t < STRAW_IN) return 0;
    if (reduceMotion) return 4;
    return Math.max(1, Math.ceil(clamp((t - STRAW_IN) / (STRAW_UP - STRAW_IN), 0, 1) * 4));
  }

  function drawSpill(g: CanvasRenderingContext2D, cup: Cup) {
    const spill = clamp((cup.level - 1) / (POUR_MAX - 1), 0, 1);
    if (spill <= 0 || !cup.tea) return;
    const left = cupLeftAt(cupX);
    const reach = spill * 6 * cell;
    g.fillStyle = TEA_COLORS[cup.tea];
    g.fillRect(left - cell - reach, counterY - Math.round(cell / 2), CUP_W * cell + 2 * cell + 2 * reach, Math.round(cell / 2));
  }

  /** A short stream from the nozzle into the cup. */
  function drawStream(g: CanvasRenderingContext2D, cup: Cup) {
    if (!streamOn || !pouring(cup) || !cup.tea) return;
    const x = spoutX[tapIndex];
    if (x === undefined) return;
    const top = nozzleBottom();
    const under = Math.abs(cupX - x) < 6 * cell;
    const end = under ? surfaceY(cup) : counterY;
    const flicker = reduceMotion ? 0 : (Math.random() - 0.5) * cell * 0.7;
    const width = 2 * cell + flicker;
    g.fillStyle = TEA_COLORS[cup.tea];
    g.fillRect(Math.round(x - width / 2), top, Math.round(width), Math.max(0, end - top));
  }

  function drawLadle(g: CanvasRenderingContext2D, colors: Colors, cup: Cup) {
    const ladle = ladleNow(cup);
    const arm = Math.max(3, Math.round(cell * 0.6));
    g.save();
    g.lineCap = "round";
    g.beginPath();
    // A short handle up toward the pivot, as if held from above.
    const dx = W / 2 - ladle.bx;
    const dy = ladle.pivotY - (ladle.by - 2 * cell);
    const reach = (9 * cell) / Math.hypot(dx, dy);
    g.moveTo(ladle.bx + dx * reach, ladle.by - 2 * cell + dy * reach);
    g.lineTo(ladle.bx, ladle.by - 2 * cell);
    g.strokeStyle = HALO;
    g.lineWidth = arm + 4;
    g.stroke();
    g.strokeStyle = colors.ink;
    g.lineWidth = arm;
    g.stroke();
    g.restore();
    // Dipping into the jar: the bowl ducks down a little and comes back up full.
    const dipping = !reduceMotion && clock < cup.loadedAt && clock >= cup.loadedAt - DIP_SECONDS;
    const dip = dipping ? Math.sin(((clock - (cup.loadedAt - DIP_SECONDS)) / DIP_SECONDS) * Math.PI) * 1.5 * cell : 0;
    const bowlX = ladle.bx - (LADLE_BOWL[0].length / 2) * cell;
    const bowlY = ladle.by - 2 * cell + dip;
    drawHalo(g, LADLE_BOWL, bowlX, bowlY, cell, HALO);
    drawSprite(g, LADLE_BOWL, bowlX, bowlY, cell, { O: colors.ink });
    if (clock >= cup.loadedAt && !cup.busy) drawTopping(g, cup.chosen, ladle.bx, bowlY, 0, 1);
  }

  /** A scoop sprite by its centre x and top y, haloed so it reads on any page. */
  function drawTopping(g: CanvasRenderingContext2D, kind: Topping, x: number, y: number, angle: number, alpha: number) {
    const art = TOPPING_ART[kind];
    const sprite = cachedSprite(`orders-scoop-${kind}`, art.grid, cell, art.palette, HALO);
    const width = SCOOP_COLS * cell;
    const height = SCOOP_ROWS * cell;
    g.save();
    g.globalAlpha = alpha;
    g.translate(Math.round(x), Math.round(y + height / 2));
    if (angle) g.rotate(angle);
    g.drawImage(sprite, -width / 2 - SPRITE_PAD, -height / 2 - SPRITE_PAD);
    g.restore();
  }

  /** Where each topping jar stands: two either side of the cup. */
  function jarCentres() {
    const half = (JAR_COLS / 2) * cell;
    const nearGap = (CUP_W / 2 + 2) * cell + half;
    const leftFar = tipJarRight() + 2 * cell + half;
    const leftNear = Math.max(leftFar + 2 * half + cell, workX() - nearGap);
    const rightNear = workX() + nearGap;
    const rightFar = Math.max(rightNear + 2 * half + cell, W - cell - half);
    return [leftFar, leftNear, rightNear, rightFar];
  }

  /** Which jar, if any, a point on the bench lands on: generous, for a thumb. */
  function jarAt(x: number, y: number) {
    if (y < counterY - (JAR_ROWS + 4) * cell || y > counterY + 2 * cell) return -1;
    const reach = (JAR_COLS / 2 + 1) * cell;
    return jarCentres().findIndex((centre) => Math.abs(x - centre) <= reach);
  }

  /** The jars along the back of the counter; an arrow marks the one the ladle dips into. */
  function drawJars(g: CanvasRenderingContext2D, colors: Colors, cup: Cup) {
    const c = cell;
    const centres = jarCentres();
    const top = counterY - JAR_ROWS * c;
    TOPPINGS.forEach((kind, index) => {
      const x = Math.round(centres[index] - (JAR_COLS / 2) * c);
      drawHalo(g, jarGrid(kind), x, top, c, HALO);
      drawSprite(g, jarGrid(kind), x, top, c, { ...TOPPING_ART[kind].palette, O: colors.ink, p: LID });
      if (index !== jarIndex || cup.busy) return;
      const tipY = top - 0.6 * c;
      g.save();
      g.fillStyle = colors.slab;
      g.strokeStyle = colors.ink;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(centres[index], tipY);
      g.lineTo(centres[index] - 1.3 * c, tipY - 1.8 * c);
      g.lineTo(centres[index] + 1.3 * c, tipY - 1.8 * c);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    });
  }

  /**
   * The scoops still to drop, near the top left: one icon each, and under a
   * finished one a mark for how it went (a tick for clean, a ring off the
   * rim, a cross for a miss), so the result never rests on colour alone.
   */
  function drawScoopQueue(g: CanvasRenderingContext2D, colors: Colors, cup: Cup) {
    const px = Math.max(2, Math.round(cell * 0.75));
    const iconW = 3 * px;
    const iconH = 2 * px;
    const gap = Math.max(5, cell);
    const mark = Math.max(5, Math.round(cell * 0.9));
    const x0 = Math.round(cupX + (CUP_W / 2 + 3) * cell);
    const y = Math.round(nozzleBottom() + 2 * cell);
    cup.queue.forEach((kind, index) => {
      const x = x0 + index * (iconW + gap);
      const result = cup.results[index];
      const current = !result && index === cup.results.length && !cup.busy;
      g.save();
      g.globalAlpha = result === "miss" || result === "wrong" ? 0.35 : result || current ? 1 : 0.45;
      drawSprite(g, TOPPING_ART[kind].icon, x, y, px, iconPalette(kind));
      g.restore();
      if (result === "wrong") {
        // Struck through: this scoop came from the wrong jar.
        g.save();
        g.strokeStyle = colors.ink;
        g.lineWidth = Math.max(1.5, cell / 4);
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(x - 1, y + iconH + 1);
        g.lineTo(x + iconW + 1, y - 1);
        g.stroke();
        g.restore();
      }
      const mx = x + iconW / 2;
      const my = y + iconH + mark;
      g.save();
      g.strokeStyle = colors.ink;
      g.fillStyle = colors.ink;
      g.lineWidth = Math.max(1.5, cell / 4);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      if (result === "clean") {
        g.moveTo(mx - mark / 2, my);
        g.lineTo(mx - mark / 8, my + mark / 2.5);
        g.lineTo(mx + mark / 2, my - mark / 2.5);
        g.stroke();
      } else if (result === "rim") {
        g.arc(mx, my, mark / 2.6, 0, Math.PI * 2);
        g.stroke();
      } else if (result === "miss") {
        g.moveTo(mx - mark / 2.5, my - mark / 2.5);
        g.lineTo(mx + mark / 2.5, my + mark / 2.5);
        g.moveTo(mx + mark / 2.5, my - mark / 2.5);
        g.lineTo(mx - mark / 2.5, my + mark / 2.5);
        g.stroke();
      } else if (result === "wrong") {
        // A filled square: not a near miss but the wrong thing.
        const side = Math.round(mark * 0.7);
        g.fillRect(Math.round(mx - side / 2), Math.round(my - side / 2), side, side);
      } else if (current) {
        g.moveTo(mx, my - mark / 2.5);
        g.lineTo(mx + mark / 2, my + mark / 2.5);
        g.lineTo(mx - mark / 2, my + mark / 2.5);
        g.closePath();
        g.fill();
      }
      g.restore();
    });
  }

  function drawShakePips(g: CanvasRenderingContext2D, colors: Colors, cup: Cup) {
    const size = cell;
    const gap = Math.max(2, Math.round(cell / 2));
    const total = SHAKES_NEEDED * size + (SHAKES_NEEDED - 1) * gap;
    const y = Math.round(cupTop - (SHAKER.length + 2.5) * cell);
    for (let index = 0; index < SHAKES_NEEDED; index++) {
      const x = Math.round(cupX - total / 2 + index * (size + gap));
      if (index < cup.shakes) {
        g.fillStyle = colors.ink;
        g.fillRect(x, y, size, size);
      } else {
        g.strokeStyle = colors.ink;
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      }
    }
  }

  /** Short motion ticks behind the cup on each shake, fading fast. */
  function drawShakeTicks(g: CanvasRenderingContext2D, colors: Colors, dx: number) {
    if (reduceMotion || joltAge >= 0.18) return;
    const c = cell;
    const left = cupLeftAt(cupX + dx);
    const side = joltDir > 0 ? -1 : 1;
    const edge = side < 0 ? left - c : left + (CUP_W + 1) * c;
    g.save();
    g.globalAlpha = 1 - joltAge / 0.18;
    g.lineCap = "round";
    g.beginPath();
    [3, 8, 13].forEach((row, index) => {
      const y = cupTop + row * c;
      const length = (index === 1 ? 2.6 : 1.8) * c;
      g.moveTo(edge, y);
      g.lineTo(edge + side * length, y - 0.4 * c);
    });
    const thick = Math.max(2, Math.round(c / 3));
    g.strokeStyle = HALO;
    g.lineWidth = thick + 4;
    g.stroke();
    g.strokeStyle = colors.ink;
    g.lineWidth = thick;
    g.stroke();
    g.restore();
  }

  /** The sealer's plate: hovering over the cup until stamped, then down onto the rim, a beat, and away. */
  function drawPress(g: CanvasRenderingContext2D, colors: Colors, cup: Cup) {
    const landed = cupTop - cell;
    const hover = cupTop - 4 * cell;
    const mount = shelfBottom();
    let bottom: number;
    if (cup.stampAt === null) {
      bottom = hover;
    } else {
      const t = clock - cup.stampAt;
      if (reduceMotion) {
        if (t > PRESS_LIFTS) return;
        bottom = landed;
      } else {
        if (t < PRESS_LANDS) bottom = lerp(hover, landed, cubicOut(t / PRESS_LANDS) ** 2);
        else if (t < PRESS_LIFTS) bottom = landed;
        else bottom = lerp(landed, hover, clamp((t - PRESS_LIFTS) / (PRESS_GONE - PRESS_LIFTS), 0, 1));
      }
    }
    const left = Math.round(cupX - (CUP_W / 2 + 2) * cell);
    const width = (CUP_W + 4) * cell;
    const height = Math.round(1.5 * cell);
    const plateTop = Math.round(bottom - height);
    // The rod comes down from a mount under the shelf.
    g.fillStyle = colors.ink;
    g.fillRect(Math.round(cupX - 2 * cell), mount, 4 * cell, cell);
    g.fillRect(Math.round(cupX - cell), mount, 2 * cell, Math.max(0, plateTop - mount));
    g.fillStyle = colors.paper;
    g.fillRect(left, plateTop, width, height);
    g.strokeStyle = colors.ink;
    g.lineWidth = 2;
    g.strokeRect(left + 1, plateTop + 1, width - 2, height - 2);
  }

  /**
   * The sealer's heat gauge beside the cup: cold at the bottom, scorching at
   * the top. The good band is a different tone and bracketed by two ticks;
   * the needle is a solid ink triangle with a line across. After the stamp
   * it stays where it was stamped.
   */
  function drawSealGauge(g: CanvasRenderingContext2D, colors: Colors, cup: Cup) {
    const c = cell;
    if (cup.stampAt !== null && clock - cup.stampAt > HOP_START) return;
    const value = cup.sealValue ?? sealNeedle(clock - cup.sealStart, expert);
    const band = rulesFor(expert).sealBand;
    const width = GAUGE_COLS * c;
    const height = GAUGE_ROWS * c;
    const left = Math.round(cupX + (CUP_W / 2 + 4) * c);
    const top = Math.round(cupTop + c);
    const yAt = (v: number) => Math.round(top + (1 - v) * height);
    const bandTop = yAt(band[1]);
    const bandBottom = yAt(band[0]);
    const tick = Math.max(2, Math.round(c / 3));
    // The dial on its stand on the counter; nothing behind it.
    g.fillStyle = colors.ink;
    g.fillRect(Math.round(left + width / 2 - c / 2), top + height, c, counterY - top - height);
    g.fillRect(left, counterY - c, width, c);
    g.fillStyle = colors.paper;
    g.fillRect(left, top, width, height);
    g.fillStyle = GAUGE_HOT;
    g.fillRect(left, top, width, bandTop - top);
    g.fillStyle = GAUGE_BAND;
    g.fillRect(left, bandTop, width, bandBottom - bandTop);
    g.strokeStyle = colors.ink;
    g.lineWidth = 2;
    g.strokeRect(left + 1, top + 1, width - 2, height - 2);
    // The two ticks that bracket the band, reaching out to the left.
    g.fillStyle = colors.ink;
    g.fillRect(left - 1.5 * c, bandTop - tick / 2, 1.5 * c + width / 2, tick);
    g.fillRect(left - 1.5 * c, bandBottom - tick / 2, 1.5 * c + width / 2, tick);
    // The needle: a line across and a solid triangle pointing in from the right.
    const y = yAt(value);
    g.fillRect(left, y - 1, width, 2);
    g.beginPath();
    g.moveTo(left + width - 1, y);
    g.lineTo(left + width + 2.5 * c, y - 1.4 * c);
    g.lineTo(left + width + 2.5 * c, y + 1.4 * c);
    g.closePath();
    g.fill();
  }

  /** A little grey smoke off a scorched film. */
  function smokePuff() {
    if (reduceMotion) return;
    for (let index = 0; index < 8; index++) {
      addParticle(particles, cupX + (Math.random() - 0.5) * 8 * cell, cupTop - 2 * cell, "#7d7a78", 26, -70);
    }
  }

  /** Steam off a tank while it brews. */
  function stepTankSteam(dt: number) {
    if (reduceMotion || !brewEnds.some((end) => end > 0)) return;
    tankSteamTimer -= dt;
    if (tankSteamTimer > 0) return;
    tankSteamTimer = 0.12;
    brewEnds.forEach((end, index) => {
      const x = spoutX[index];
      if (end <= 0 || x === undefined) return;
      // Off whichever side of the tank, from about its shoulder.
      const side = Math.random() < 0.5 ? -1 : 1;
      addParticle(particles, x + side * (tankW / 2 - 1) * cell, shelfTop() - MACHINE_ROWS * cell, CREAM, 14, -60);
    });
  }

  function drawMaking(g: CanvasRenderingContext2D, colors: Colors, cup: Cup) {
    const c = cell;
    let dx = 0;
    let dy = 0;
    let tilt = 0;
    let alpha = 1;
    if (cup.station === "shake" && !reduceMotion) {
      const k = Math.exp(-joltAge * 16);
      dx = joltDir * 1.2 * c * k;
      tilt = joltDir * 0.07 * k;
    }
    if (cup.station === "seal" && cup.stampAt !== null && !reduceMotion) {
      const u = clamp((clock - cup.stampAt - HOP_START) / (HAND_OFF_SECONDS - HOP_START), 0, 1);
      // A hop along the counter to the guest it's for, fading into their hands.
      const to = crowd.xOf(cup.guestId);
      if (to !== null) dx = (to - cupX) * cubicOut(u);
      dy = -Math.sin(u * Math.PI) * 4 * c;
      alpha = 1 - u * u * u;
    }

    if (cup.station === "scoop") {
      drawJars(g, colors, cup);
      drawLadle(g, colors, cup);
      drawScoopQueue(g, colors, cup);
    }
    drawSpill(g, cup);

    const pivotY = cupTop + CUP_H * c;
    const sinceStamp = cup.stampAt !== null ? clock - cup.stampAt : -1;
    if (cup.turning && !reduceMotion && sinceStamp >= TURN_FROM) {
      // A perfect drink, seen from a little above, turns once as it goes.
      drawTurningDrink(g, cup, cupX + dx, pivotY + dy, turnShare(sinceStamp), alpha);
    } else {
      g.save();
      g.globalAlpha = alpha;
      g.translate(cupX + dx, pivotY + dy);
      if (tilt) g.rotate(tilt);
      g.translate(-cupX, -pivotY);
      drawCup(g, colors, cup, cupX, cupTop);
      g.restore();
    }

    drawStream(g, cup);
    if (cup.station === "shake") {
      drawShakePips(g, colors, cup);
      drawShakeTicks(g, colors, dx);
    }
    if (cup.station === "seal") {
      drawSealGauge(g, colors, cup);
      drawPress(g, colors, cup);
    }
  }

  /** Draws whatever is on the bench now. */
  function draw() {
    const g = ctx;
    if (!g || !W || !H) return;
    // The bench draws in fixed colours: it sits on the room, not on the page.
    const colors = BENCH;
    g.clearRect(0, 0, W, H);
    // The wall's back bar, the guests across the counter (cut off at its
    // edge), then everything standing on the counter in front of them.
    drawBackBar(g, colors);
    crowd.drawBack(g);
    if (!making) drawIdleProps(g, colors);
    if (making) drawMaking(g, colors, making);
    drawLessonGhost(g);
    drawIceArcs(g);
    drawSyrup(g);
    for (const item of falling) drawTopping(g, item.kind, item.x, item.y, item.angle, item.alpha);
    drawParticles(g, particles);
    crowd.drawFront(g, popupFont);
    drawLessonLight(g);
    drawNotes(g);
  }

  /** Grade words: cream on a dark one-cell backing, legible over any part of the room. */
  function drawNotes(g: CanvasRenderingContext2D) {
    if (!popups.length) return;
    g.save();
    g.font = popupFont;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const popup of popups) {
      const alpha = Math.max(0, Math.min(1, (popup.life / popup.maxLife) * 2));
      const color = popup.kind === "perfect" ? NOTE_GOLD : popup.kind === "miss" ? "#f18272" : CREAM;
      drawChipNote(g, popup.text, Math.round(popup.x), popup.y, { color, back: SCENE_INK, pad: 12, alpha, cell: SC });
    }
    g.restore();
  }

  // --- Stepping effects -------------------------------------------------------------

  function splash(x: number, y: number, color: string, count: number) {
    if (reduceMotion) return;
    for (let index = 0; index < count; index++) addParticle(particles, x + (Math.random() - 0.5) * cell * 2, y, color, 60, 620);
  }

  /** A perfect drink throws a little burst of pearls as it leaves the counter (the wall stays light enough for them all shift). */
  function pearlBurst() {
    if (reduceMotion) return;
    for (let index = 0; index < 16; index++) {
      addParticle(particles, cupX + (Math.random() - 0.5) * 6 * cell, cupTop - cell, PEARL, 170, 520);
    }
  }

  function stepFalling(dt: number) {
    const gravity = 230 * cell;
    const cup = making;
    const tall = SCOOP_ROWS * cell;
    for (let index = falling.length - 1; index >= 0; index--) {
      const item = falling[index];
      item.age += dt;
      item.vy += gravity * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.angle += item.spin * dt;
      const bottom = item.y + tall;

      if (item.result === "miss") {
        if (bottom >= counterY) {
          item.y = counterY - tall;
          if (reduceMotion) {
            item.vx = 0;
            item.vy = 0;
            item.spin = 0;
          } else if (item.stage < 2) {
            // Bounce once, then roll away along the counter.
            item.vy = item.stage === 0 ? -item.vy * 0.38 : 0;
            item.vx = Math.sign(item.x - W / 2 || 1) * 26 * cell;
            item.spin = Math.sign(item.vx) * 9;
            item.stage += 1;
          } else {
            item.vy = 0;
          }
        }
        if (reduceMotion && item.vy === 0) item.alpha = Math.max(0, item.alpha - dt / 0.6);
        if (item.x < -6 * cell || item.x > W + 6 * cell || item.alpha <= 0 || item.age > 3) falling.splice(index, 1);
        continue;
      }

      if (item.result === "rim" && item.stage === 0 && bottom >= cupTop) {
        // Ticks off the rim, then tumbles in toward the middle.
        item.stage = 1;
        item.y = cupTop - tall;
        item.vy = reduceMotion ? 0 : -item.vy * 0.28;
        item.vx = (W / 2 - item.x) * 3;
        item.spin = reduceMotion ? 0 : Math.sign(W / 2 - item.x) * 8;
        continue;
      }
      if (cup && cup.tea && !item.splashed && bottom >= surfaceY(cup) && (item.result === "clean" || item.stage === 1)) {
        item.splashed = true;
        splash(item.x, surfaceY(cup), TEA_COLORS[cup.tea], 5);
      }
      if (item.stage === 1) item.vx *= Math.exp(-dt * 4);
      // It settles where the next free spot in the pile is.
      const slot = cup ? PILE_SLOTS[cup.pile.length % PILE_SLOTS.length] : null;
      if (cup && slot && item.y >= cupTop + slot[1] * cell) {
        cup.pile.push(item.kind);
        falling.splice(index, 1);
      } else if (item.age > 3) {
        falling.splice(index, 1);
      }
    }
  }

  function stepEffects(dt: number) {
    const cup = making;
    const target = !cup ? cupX : stationX(cup);
    cupX = reduceMotion ? target : damp(cupX, target, 24, dt);
    if (Math.abs(target - cupX) < 0.3) cupX = target;

    pumpAge += dt;

    const flowing = streamOn && pouring(cup);
    wobble = flowing ? 1 : wobble * Math.exp(-dt * 3);
    if (flowing && cup.tea && !reduceMotion && Math.random() < dt * 28) {
      const x = spoutX[tapIndex] ?? cupX;
      if (Math.abs(cupX - x) < 6 * cell) splash(x, surfaceY(cup), TEA_COLORS[cup.tea], 1);
    }
    // Ice in the air lands after its arc.
    if (iceArcs.length) {
      for (const arc of iceArcs) arc.age += dt;
      const landed = iceArcs.filter((arc) => arc.age >= ICE_ARC_SECONDS).length;
      if (landed) {
        iceArcs = iceArcs.filter((arc) => arc.age < ICE_ARC_SECONDS);
        if (cup) splash(cupX, cupTop + 2 * cell, "#dceef4", 2 * landed);
      }
    }
    stepTankSteam(dt);
    joltAge += dt;
    flashAge += dt;
    stepFalling(dt);
    stepParticles(particles, dt);
    stepPopups(popups, dt);
  }

  // --- The room ----------------------------------------------------------------------

  // The shop, seen from behind the counter: a ceiling with pendant lamps, a
  // plain wall, and the counter. Behind the line, the taps and the bench the
  // wall is one flat tone with nothing on it and nothing moving, so the
  // tickets and the stations are always the most readable things on screen.
  // The room's character lives on the side walls, outside the play area, when
  // the screen leaves room for them: a menu board and a shelf of jars on the
  // left, and on the right the clock and a small window onto the street,
  // where the day turns from afternoon to night as the shift runs out. On a
  // narrow screen there are no side walls, so there is just the wall. The
  // room's own light warms and then dims only a little over the shift.
  //
  // It is painted at one pixel per SC-px cell into small offscreen layers,
  // rebuilt only when the light steps (every two seconds of shift) or the
  // layout changes, and scaled up without smoothing. Each frame blits them
  // and draws the clock's hand and, briefly, the room's answer to a perfect
  // drink or a lost guest, both kept off the play area. The palette is fixed:
  // the room looks the same in both site themes.

  // Ordered dithering (`bayer`) and colour mixing come from the arcade's core.
  const SC = 4;
  const rgb = hexToRgb;
  const css = (color: RGB) => `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

  /**
   * The light through the shift, eased between keys: the sky in the window
   * and the rooftops under it, and in the room a small swing in the wall
   * (warmer by golden hour, a little dimmer by night), the lamps coming on,
   * and how far the wood darkens.
   */
  const LIGHT_KEYS = [
    { p: 0, top: "#8ba6c2", low: "#e6dccd", town: "#8f97a6", wall: "#d9c7ae", lamp: 0, dark: 0 },
    { p: 0.5, top: "#b98e9c", low: "#efc48f", town: "#857f93", wall: "#dcc4a3", lamp: 0.3, dark: 0.03 },
    { p: 0.78, top: "#5a4a6a", low: "#c97a6a", town: "#5a5170", wall: "#d1b999", lamp: 0.8, dark: 0.08 },
    { p: 1, top: "#2c3049", low: "#4a4262", town: "#3b3953", wall: "#c7ae90", lamp: 1, dark: 0.12 },
  ];
  const WOOD = rgb("#8a5a3a");
  const WOOD_LINE = rgb("#5e3d2a");
  const LIP = rgb("#c79a6b");
  const LIP_EDGE = rgb("#a77a52");
  const FRAME = rgb("#5e3d2a");
  const SILL = rgb("#a77a52");
  const SOFFIT = rgb("#3a2a26");
  const SOFFIT_BEAM = rgb("#4f3a33");
  const GOLD = rgb(NOTE_GOLD);
  const CREAM_RGB = rgb("#f6eee2");
  const DEEP = rgb("#2a1c18");
  /** The popups' dark backing: the scene's own ink, not art.ts's night-blue chip. */
  const SCENE_INK = "#1a1a1a";
  /** The bench's art keeps its light-theme colours over the room, always. */
  const BENCH = risoColors(false);
  const EMPTY_CUP = "#f6eee2";
  /** A film the sealer browned. */
  const SCORCHED = "#a8784c";
  /** The seal gauge, in cells, and its tones: the good band, and too hot above it. */
  const GAUGE_COLS = 5;
  const GAUGE_ROWS = 14;
  const GAUGE_BAND = "#8bbf5a";
  const GAUGE_HOT = "#f4b6a8";
  const STEP_SECONDS = 2;
  /** Cells kept clear between the play area and anything on a side wall. */
  const GUTTER = 4;
  /** A side wall narrower than this, in cells, stays bare. */
  const SIDE_MIN = 14;
  const URN_ROWS = 10;
  const URN = [
    "...OO....",
    "..OLLO...",
    ".OOOOOO..",
    ".OMMMMO..",
    "OMMhMMMO.",
    "OMMhMMMOO",
    "OMMMMMMOT",
    "OMMMMMMO.",
    ".OMMMMO..",
    "..O..O...",
  ];
  const URN_PALETTE: Record<string, RGB> = {
    O: rgb("#3a3f44"),
    L: rgb("#6f777c"),
    M: rgb("#9aa3a8"),
    h: rgb("#c9d0d4"),
    T: rgb("#3a3f44"),
  };
  /** The jars on the shelf: the teas, then a few tins. */
  const SHELF_TINTS = [...TEAS.map((tea) => rgb(TEA_COLORS[tea])), rgb("#b0442f"), rgb("#3f6f6a"), rgb("#8f8f8f")];

  interface Buf {
    w: number;
    h: number;
    d: Uint8ClampedArray<ArrayBuffer>;
  }
  interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  const newBuf = (w: number, h: number): Buf => ({ w, h, d: new Uint8ClampedArray(new ArrayBuffer(Math.max(1, w * h) * 4)) });
  function px(b: Buf, x: number, y: number, c: RGB) {
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
    const i = (y * b.w + x) * 4;
    b.d[i] = c[0];
    b.d[i + 1] = c[1];
    b.d[i + 2] = c[2];
    b.d[i + 3] = 255;
  }
  function clear(b: Buf, x: number, y: number) {
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
    b.d[(y * b.w + x) * 4 + 3] = 0;
  }
  function fill(b: Buf, x: number, y: number, w: number, h: number, c: RGB) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(b.w, Math.round(x + w));
    const y1 = Math.min(b.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) px(b, xx, yy, c);
  }
  /** Ordered-dither `c` over a box at `density` (0–1), on the screen's own grid. */
  function dither(b: Buf, x: number, y: number, w: number, h: number, c: RGB, density: number) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(b.w, Math.round(x + w));
    const y1 = Math.min(b.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) if (bayer(xx, yy) < density) px(b, xx, yy, c);
  }
  function disc(b: Buf, cx: number, cy: number, r: number, c: RGB) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(b, cx + x, cy + y, c);
  }
  function commit(b: Buf, canvas: HTMLCanvasElement) {
    canvas.width = b.w;
    canvas.height = b.h;
    const context = canvas.getContext("2d");
    context?.putImageData(new ImageData(b.d, b.w, b.h), 0, 0);
  }

  // Two canvases, so CSS can set the view through the window further back
  // than the room: `far` is the window's view, `near` the room.
  let farCanvas: HTMLCanvasElement;
  let farCtx: CanvasRenderingContext2D | null = null;
  let nearCanvas: HTMLCanvasElement;
  let nearCtx: CanvasRenderingContext2D | null = null;
  let lineEl: HTMLElement;
  let tapsEl: HTMLElement;
  let columnEl: HTMLElement;
  let hudRow: HTMLElement;
  let VW = 0;
  let VH = 0;
  const NONE: Box = { x: 0, y: 0, w: 0, h: 0 };
  /** The room's layout in cells, measured from the DOM so it lines up. */
  const room = {
    cols: 0,
    rows: 0,
    soffit: 0,
    counter: 0,
    counterPx: 0,
    /** The play area: the column from the line down, plus a gutter. The wall here stays bare. */
    play: { l: 0, r: 0, t: 0 },
    lamps: [] as number[],
    lampY: 0,
    /** Side-wall pieces; zero-sized when the wall has no room for them. */
    board: { ...NONE },
    shelves: [] as Box[],
    clock: { x: 0, y: 0, r: 0 },
    window: { ...NONE },
    urnX: -1,
  };
  const skyLayer = typeof document === "undefined" ? null : document.createElement("canvas");
  const roomLayer = typeof document === "undefined" ? null : document.createElement("canvas");
  const counterLayer = typeof document === "undefined" ? null : document.createElement("canvas");
  const veils: HTMLCanvasElement[] = [];
  let bakedStep = -1;
  let light = lightAt(0);
  let flareAge = 10;
  let veilAge = 10;

  /** The light at a point in the shift, eased between its keys. */
  function lightAt(p: number) {
    let index = 0;
    while (index < LIGHT_KEYS.length - 2 && p > LIGHT_KEYS[index + 1].p) index++;
    const a = LIGHT_KEYS[index];
    const b = LIGHT_KEYS[index + 1];
    const t = clamp((p - a.p) / (b.p - a.p), 0, 1);
    const mix = (from: string, to: string) => mixRgb(rgb(from), rgb(to), t);
    return {
      p,
      top: mix(a.top, b.top),
      low: mix(a.low, b.low),
      town: mix(a.town, b.town),
      wall: mix(a.wall, b.wall),
      lamp: lerp(a.lamp, b.lamp, t),
      dark: lerp(a.dark, b.dark, t),
    };
  }

  /** Measures the DOM the room has to line up with, then lays the room out in cells. */
  function layoutRoom() {
    if (!farCanvas || !nearCanvas || !benchArt) return;
    VW = window.innerWidth;
    VH = window.innerHeight;
    farCtx = fitCanvas(farCanvas, VW, VH);
    nearCtx = fitCanvas(nearCanvas, VW, VH);
    const cols = Math.ceil(VW / SC);
    const rows = Math.ceil(VH / SC);
    const benchBox = benchArt.getBoundingClientRect();
    const lineBox = lineEl?.getBoundingClientRect();
    const tapsBox = tapsEl?.getBoundingClientRect();
    const columnBox = columnEl?.getBoundingClientRect();
    const hudBottom = hudRow ? hudRow.getBoundingClientRect().bottom : 64;

    room.cols = cols;
    room.rows = rows;
    room.counterPx = benchBox.top + counterY;
    room.counter = Math.floor(room.counterPx / SC);
    room.soffit = clamp(Math.round((hudBottom * 0.55) / SC), 6, 16);
    room.lamps = [1 / 6, 1 / 2, 5 / 6].map((f) => Math.round(cols * f));
    room.lampY = room.soffit + 4;
    room.play = {
      l: columnBox ? Math.floor(columnBox.left / SC) - GUTTER : 0,
      r: columnBox ? Math.ceil(columnBox.right / SC) + GUTTER : cols,
      t: Math.floor((lineBox ? lineBox.top : hudBottom) / SC),
    };

    // The side walls: whatever the play area leaves, under the HUD and above
    // the counter (and the urn on it).
    const top = Math.ceil(hudBottom / SC) + 4;
    const bottom = room.counter - URN_ROWS - 4;
    const leftW = room.play.l - 2;
    const rightL = room.play.r;
    const rightW = cols - 2 - rightL;

    // Left: a menu board, and under it a shelf or two of jars.
    room.board = { ...NONE };
    room.shelves = [];
    if (leftW >= SIDE_MIN && bottom - top >= 16) {
      const w = Math.min(30, leftW - 4);
      const h = clamp(Math.round(w * 0.55), 8, 16);
      room.board = { x: 2 + Math.round((leftW - w) / 2), y: top + 2, w, h };
      const shelfW = Math.min(leftW - 2, w + 6);
      const shelfX = 2 + Math.round((leftW - shelfW) / 2);
      for (let y = top + 2 + h + 14; y <= bottom && room.shelves.length < 2; y += 13) {
        room.shelves.push({ x: shelfX, y, w: shelfW, h: 1 });
      }
    }

    // Right: the clock, and under it a small window.
    room.clock = { x: 0, y: 0, r: 0 };
    room.window = { ...NONE };
    if (rightW >= SIDE_MIN && bottom - top >= 16) {
      const centre = rightL + Math.round(rightW / 2);
      const r = clamp(Math.floor(rightW / 5), 3, 6);
      room.clock = { x: centre, y: top + 2 + r, r };
      const w = clamp(Math.round(rightW * 0.45), 10, 24);
      const t = room.clock.y + r + 7;
      const h = Math.min(Math.round(w * 1.3), bottom - 2 - t);
      if (h >= 10) room.window = { x: centre - Math.round(w / 2), y: t, w, h };
    }

    // The urn stands at whichever end of the counter has room outside the taps.
    room.urnX = -1;
    if (tapsBox) {
      const need = (URN[0].length + 4) * SC;
      if (VW - tapsBox.right >= need) room.urnX = Math.round((tapsBox.right + (VW - tapsBox.right) / 2) / SC) - 4;
      else if (tapsBox.left >= need) room.urnX = Math.round(tapsBox.left / 2 / SC) - 4;
    }

    // Veils for a dimmed room, a few ordered-dither densities.
    veils.length = 0;
    for (const density of [0.0625, 0.1875]) {
      const b = newBuf(cols, rows);
      dither(b, 0, 0, cols, rows, rgb("#120c10"), density);
      const canvas = document.createElement("canvas");
      commit(b, canvas);
      veils.push(canvas);
    }
    bakedStep = -1;
    bakeRoom();
  }

  /** Repaints the static layers for the current light. */
  function bakeRoom() {
    if (!skyLayer || !roomLayer || !counterLayer || !room.cols) return;
    const step = Math.floor(elapsed / STEP_SECONDS);
    if (step === bakedStep) return;
    bakedStep = step;
    light = lightAt(clamp((step * STEP_SECONDS) / SHIFT_SECONDS, 0, 1));
    const { cols, rows, counter } = room;
    const L = light;

    const sky = newBuf(cols, rows);
    paintView(sky);
    commit(sky, skyLayer);

    // The room: the ceiling, the wall, and what hangs on the side walls.
    const inside = newBuf(cols, rows);
    fill(inside, 0, 0, cols, room.soffit, SOFFIT);
    fill(inside, 0, room.soffit - 1, cols, 1, SOFFIT_BEAM);
    paintWindowFrame(inside);
    paintBoard(inside);
    paintShelves(inside);
    paintClockFace(inside);
    // Pendant lamps, their bulbs warming as evening comes.
    const bulb = mixRgb(rgb("#e8dcc4"), GOLD, L.lamp * 0.8);
    for (const x of room.lamps) {
      fill(inside, x, room.soffit, 1, room.lampY - room.soffit, SOFFIT);
      fill(inside, x - 1, room.lampY, 3, 1, SOFFIT);
      fill(inside, x - 2, room.lampY + 1, 5, 1, SOFFIT);
      fill(inside, x - 3, room.lampY + 2, 7, 1, SOFFIT_BEAM);
      fill(inside, x - 1, room.lampY + 3, 3, 1, bulb);
    }
    commit(inside, roomLayer);

    // The counter: a lip, a plain wood face in three panels, and the urn.
    // The bench can sit below the fold when the counter needs to scroll.
    // Always leave room to bake the lip, even when it is offscreen.
    const below = Math.max(4, rows - counter + 2);
    const o = URN_ROWS;
    const front = newBuf(cols, o + below);
    const wood = mixRgb(WOOD, DEEP, L.dark);
    const line = mixRgb(WOOD_LINE, DEEP, L.dark);
    fill(front, 0, o + 3, cols, below, wood);
    fill(front, 0, o, cols, 2, mixRgb(LIP, DEEP, L.dark * 0.6));
    fill(front, 0, o + 2, cols, 1, mixRgb(LIP_EDGE, DEEP, L.dark * 0.6));
    fill(front, 0, o + 3, cols, 1, line);
    const seam = mixRgb(line, wood, 0.55);
    for (const x of [room.play.l - 2, room.play.r + 1]) {
      if (x > 2 && x < cols - 3) fill(front, x, o + 4, 1, below, seam);
    }
    if (room.urnX >= 0) {
      URN.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === "." || !URN_PALETTE[ch]) return;
          px(front, room.urnX + x, y, mixRgb(mixRgb(URN_PALETTE[ch], L.wall, 0.3), DEEP, L.dark * 0.6));
        }),
      );
    }
    commit(front, counterLayer);
  }

  /** Mixes a side-wall colour toward the wall, so nothing up there competes with the play. */
  const quiet = (c: RGB, toward: number) => mixRgb(c, light.wall, toward);

  /**
   * The view through the window: the sky in flat bands joined by dithering,
   * the sun going down or the moon, and a line of rooftops with a lit window
   * or two by night. Nothing in it moves.
   */
  function paintView(b: Buf) {
    const { x, y, w, h } = room.window;
    if (!w || !h) return;
    const L = light;
    const bands = [L.top, mixRgb(L.top, L.low, 0.5), L.low];
    for (let yy = y; yy < y + h; yy++) {
      const f = ((yy - y) / h) * (bands.length - 1);
      const segment = Math.min(bands.length - 2, Math.floor(f));
      const blend = clamp((f - segment - 0.3) / 0.4, 0, 1);
      for (let xx = x; xx < x + w; xx++) px(b, xx, yy, bands[blend > bayer(xx, yy) ? segment + 1 : segment]);
    }
    if (L.p < 0.7) {
      // The sun sinks behind the rooftops by dusk.
      const sunY = Math.round(lerp(y + h * 0.3, y + h, clamp(L.p / 0.66, 0, 1)));
      disc(b, x + Math.round(w * 0.66), sunY, 2, mixRgb(rgb("#fbeed2"), rgb("#f2c27a"), clamp(L.p / 0.5, 0, 1)));
    }
    if (L.p >= 0.84) {
      const mx = x + Math.round(w * 0.3);
      const my = y + Math.max(3, Math.round(h * 0.2));
      disc(b, mx, my, 2, mixRgb(CREAM_RGB, L.top, 0.25));
      disc(b, mx + 1, my - 1, 2, L.top);
    }
    // Three rooftops across the bottom of the glass, in one flat tone.
    const lit = mixRgb(GOLD, L.town, 0.55);
    let left = x;
    for (let index = 0; index < 3 && left < x + w; index++) {
      const width = index === 2 ? x + w - left : Math.round(w * (0.28 + hash(index + 60) * 0.12));
      const height = Math.round(h * (0.22 + hash(index + 70) * 0.16));
      fill(b, left, y + h - height, width, height, L.town);
      if (L.p >= 0.75 && index !== 1 && width > 4) px(b, left + 2 + Math.floor(hash(index + 80) * (width - 4)), y + h - height + 2, lit);
      left += width;
    }
  }

  /** The window's frame, a cross of glazing bars, and its sill; the glass is cleared so the view shows. */
  function paintWindowFrame(b: Buf) {
    const { x, y, w, h } = room.window;
    if (!w || !h) return;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) clear(b, xx, yy);
    const frame = quiet(mixRgb(FRAME, DEEP, light.dark), 0.35);
    fill(b, x - 1, y - 1, w + 2, 1, frame);
    fill(b, x - 1, y - 1, 1, h + 2, frame);
    fill(b, x + w, y - 1, 1, h + 2, frame);
    fill(b, x, y + Math.round(h * 0.4), w, 1, frame);
    fill(b, x + Math.floor(w / 2), y, 1, h, frame);
    fill(b, x - 2, y + h, w + 4, 2, quiet(SILL, 0.3));
  }

  /** The menu board: a few rows of chalk, each an item and its price, barely off the board. */
  function paintBoard(b: Buf) {
    const { x, y, w, h } = room.board;
    if (!w || !h) return;
    const board = quiet(rgb("#2f3a33"), 0.45);
    fill(b, x - 1, y - 1, w + 2, h + 2, quiet(FRAME, 0.35));
    fill(b, x, y, w, h, board);
    const chalk = mixRgb(rgb("#d8d3c8"), board, 0.5);
    // A heading, then the menu.
    const heading = Math.round(w * 0.4);
    fill(b, x + Math.round((w - heading) / 2), y + 2, heading, 1, chalk);
    for (let row = 0, yy = y + 5; yy < y + h - 1; row++, yy += 3) {
      fill(b, x + 2, yy, Math.round((w - 9) * (0.45 + hash(row + 90) * 0.4)), 1, chalk);
      fill(b, x + w - 5, yy, 3, 1, chalk);
    }
  }

  /** A shelf or two of jars: a few large shapes, muted toward the wall. */
  function paintShelves(b: Buf) {
    room.shelves.forEach((shelf, row) => {
      fill(b, shelf.x, shelf.y, shelf.w, 1, quiet(FRAME, 0.4));
      const count = clamp(Math.floor(shelf.w / 8), 2, 4);
      const slot = shelf.w / count;
      for (let index = 0; index < count; index++) {
        const seed = row * 10 + index;
        const w = 4 + Math.floor(hash(seed + 100) * 2);
        const h = 5 + Math.floor(hash(seed + 110) * 3);
        const jx = Math.round(shelf.x + slot * (index + 0.5) - w / 2);
        const body = quiet(SHELF_TINTS[Math.floor(hash(seed + 120) * SHELF_TINTS.length)], 0.55);
        fill(b, jx, shelf.y - h + 1, w, h - 1, body);
        fill(b, jx + 1, shelf.y - h, w - 2, 1, mixRgb(body, DEEP, 0.18));
      }
    });
  }

  function paintClockFace(b: Buf) {
    const { x, y, r } = room.clock;
    if (r < 3) return;
    const rim = quiet(SOFFIT, 0.4);
    disc(b, x, y, r, rim);
    disc(b, x, y, r - 1, quiet(CREAM_RGB, 0.4));
    px(b, x, y - r + 1, quiet(rgb(ACCENT), 0.45));
    px(b, x + r - 1, y, rim);
    px(b, x, y + r - 1, rim);
    px(b, x - r + 1, y, rim);
  }

  /** Advances the room on the game clock, so it freezes with the pause. */
  function stepRoom(dt: number) {
    if (!room.cols) return;
    bakeRoom();
    flareAge += dt;
    veilAge += dt;
  }

  /** The clock's one hand sweeps a full turn over the shift. */
  function drawClockHand(g: CanvasRenderingContext2D) {
    const { x, y, r } = room.clock;
    if (r < 3) return;
    const angle = -Math.PI / 2 + (Math.PI * 2 * clamp(elapsed, 0, SHIFT_SECONDS)) / SHIFT_SECONDS;
    g.fillStyle = css(quiet(SOFFIT, 0.3));
    for (let s = 0; s <= r - 1.5; s += 0.5) {
      g.fillRect((x + Math.round(Math.cos(angle) * s)) * SC, (y + Math.round(Math.sin(angle) * s)) * SC, SC, SC);
    }
  }

  /**
   * The room's answers, brief and up out of the way: the lamps flare for a
   * perfect drink, and for a lost guest the lights dip around the play area.
   */
  function drawRoomEffects(g: CanvasRenderingContext2D) {
    if (reduceMotion) return;
    if (flareAge < 0.4) {
      const strength = 0.6 * (1 - flareAge / 0.4);
      const r = 6;
      g.fillStyle = "#ffe3a3";
      for (const lx of room.lamps) {
        const cy = room.lampY + 3;
        for (let y = -r; y <= r; y++) {
          if (cy + y >= room.play.t) break;
          for (let x = -r; x <= r; x++) {
            const d = Math.hypot(x, y) / r;
            if (d < 1 && bayer(lx + x, cy + y) < strength * (1 - d)) g.fillRect((lx + x) * SC, (cy + y) * SC, SC, SC);
          }
        }
      }
    }
    if (veilAge < 0.5 && veils.length) {
      const k = veilAge < 0.15 ? 1 : 1 - (veilAge - 0.15) / 0.35;
      const level = Math.min(veils.length - 1, Math.floor(k * veils.length));
      const { l, r, t } = room.play;
      const w = room.cols * SC;
      const h = room.rows * SC;
      g.save();
      g.beginPath();
      g.rect(0, 0, w, h);
      g.rect(l * SC, t * SC, (r - l) * SC, h - t * SC);
      g.clip("evenodd");
      if (k > 0.05) g.drawImage(veils[level], 0, 0, w, h);
      g.restore();
      // The bulbs go out for a moment.
      g.fillStyle = css(SOFFIT_BEAM);
      for (const x of room.lamps) g.fillRect((x - 1) * SC, (room.lampY + 3) * SC, 3 * SC, SC);
    }
  }

  function drawRoom() {
    const far = farCtx;
    const g = nearCtx;
    if (!far || !g || !room.cols || !skyLayer || !roomLayer || !counterLayer) return;
    const w = room.cols * SC;
    const h = room.rows * SC;
    // Far: the view through the window, softened in CSS like a shallow depth of field.
    far.imageSmoothingEnabled = false;
    far.clearRect(0, 0, w, h);
    far.drawImage(skyLayer, 0, 0, w, h);
    g.clearRect(0, 0, w, h);
    // The painted wall sits between the view through the glass and the
    // original counter, clock, lamps and bench. Keep the real window clear.
    g.save();
    g.beginPath();
    g.rect(0, 0, w, h);
    const glass = room.window;
    if (glass.w && glass.h) g.rect(glass.x * SC, glass.y * SC, glass.w * SC, glass.h * SC);
    g.clip("evenodd");
    g.fillStyle = css(light.wall);
    g.fillRect(0, 0, w, h);
    drawBackdrop(g, {
      width: w, height: room.counterPx, rows: 114, time: elapsed, still: reduceMotion,
      alternate: 1 - clamp((elapsed / SHIFT_SECONDS - 0.35) / 0.33, 0, 1),
      opacity: 0.76, focus: 0.62,
    });
    g.restore();
    // Near: the fixtures in front of the wall.
    g.imageSmoothingEnabled = false;
    g.drawImage(roomLayer, 0, 0, w, h);
    drawClockHand(g);
    g.drawImage(counterLayer, 0, Math.round(room.counterPx) - URN_ROWS * SC, w, counterLayer.height * SC);
    drawRoomEffects(g);
    drawRoomWash(g, w, h);
  }

  function resetRoom() {
    flareAge = veilAge = 10;
    bakedStep = -1;
    bakeRoom();
  }

  // --- Rules in motion -------------------------------------------------------------

  /** Full tanks, a fresh special, and the samples back, for a new shift. */
  function resetShiftExtras() {
    tanks = TEAS.map(() => TANK_CAPACITY);
    brewEnds = TEAS.map(() => 0);
    brewing = TEAS.map(() => -1);
    samplesLeft = sampleCap;
    criticsSeen = 0;
    special = pickSpecial();
    jar = 0;
    jarsCashed = 0;
    history = [];
    shareLines = [];
    crowd.reset(0);
  }

  function beginShift() {
    countdown = 0;
    goVisible = true;
    timers.later(() => (goVisible = false), 620);
    phase = "opening";
    setMusicPhase("opening");
    startMusic();
    sfxStart();
    running = true;
    begunAt = clock;
    arrivalTimer = 0;
    arrivalIn = Infinity;
    addGuest();
    liveMessage = `Today's special is ${TEA_NAMES[special]}. ${liveMessage}`;
    // A HUD button clicked during the countdown would otherwise keep Space.
    if (document.activeElement instanceof HTMLButtonElement && playScope?.contains(document.activeElement)) {
      focusPlayfield();
    }
  }

  function stepCup(dt: number) {
    const cup = making;
    if (!cup) return;
    if (pouring(cup)) {
      // The tap gives what the tank has left; a dry tank stops the stream
      // and the level with it, but the hold goes on until it is let go.
      cup.heldSeconds += dt;
      const want = stepPour(cup.level, cup.heldSeconds, dt) - cup.level;
      const drawn = drawFromTank(tanks[tapIndex], want);
      // Changed in place through a plain alias, so the template only hears
      // about it on the line's refresh, not every frame.
      const levels = tanks;
      levels[tapIndex] = drawn.tank;
      const was = streamOn;
      streamOn = drawn.poured > 0;
      if (streamOn) {
        if (!cup.tea) {
          // The tea is whichever tap poured first; it is locked from here on.
          cup.tea = TEAS[tapIndex];
          refresh();
        }
        cup.level = Math.min(POUR_MAX, cup.level + drawn.poured);
        setPourStream(1, cup.level);
      } else {
        setPourStream(0);
        if (was) {
          sfxSputter();
          note(`the ${TEA_NAMES[TEAS[tapIndex]]} tank ran dry`);
          refreshTanks();
        }
      }
      if (cup.level >= POUR_MAX) commitPour();
    }
    if (cup.station === "seal" && cup.stampAt !== null) {
      const t = clock - cup.stampAt;
      if (!cup.sealed && t >= PRESS_LANDS) {
        cup.sealed = true;
        sfxSeal();
        if (cup.sealValue !== null && sealResult(cup.sealValue, expert) === "scorched") {
          sfxScorch();
          smokePuff();
        }
      }
      if (!cup.burst && t >= HOP_START) {
        cup.burst = true;
        const judged = judge(cup);
        if (judged?.result.accepted && judged.result.total >= PERFECT) pearlBurst();
      }
      // Served at a fixed time after the stamp, however it is drawn going over.
      if (t >= HAND_OFF_SECONDS) serveCup();
    }
  }

  function stepBeats() {
    if (!beats.length) return;
    const due = beats.filter((beat) => beat.at <= clock);
    if (!due.length) return;
    beats = beats.filter((beat) => beat.at > clock);
    for (const beat of due) beat.run();
  }

  /**
   * One step of the game by `realDt` seconds (capped by the frame loop); the
   * countdown reads the uncapped `rawDt`, as it always has. While a lesson is
   * up and unanswered the whole shift stands still: the bench, the clock,
   * the guests' patience and the arrivals. Once it is answered the bench is
   * back at full speed at once, and the line (patience, arrivals, the shift's
   * clock) eases back with the coach. A step waiting for its moment (the
   * ladle over the cup, the needle in the band) stops the step right on it.
   */
  function advance(realDt: number, rawDt: number) {
    if (!running) {
      const step = stepCountdown(countdownElapsed, countdown, Math.min(rawDt, 0.25));
      countdownElapsed = step.elapsed;
      if (step.beep) {
        countdown = step.count;
        sfxCountdown(countdown);
      }
      if (step.done) beginShift();
      return;
    }

    // Lessons age on real time (uncapped), and the line's eased step never exceeds the frame's cap.
    let lineDt = coach.step(rawDt, realDt);
    let dt = realDt;
    if (lessonHolds()) {
      dt = 0;
      lineDt = 0;
    } else {
      const until = momentIn();
      if (until < dt) {
        lineDt *= until / dt;
        dt = until;
      }
    }
    lessonClock += realDt;
    // The spotlight comes up with a lesson and goes as it is done or the move is made.
    const dimTarget = coach.current && !coach.leaving && !coach.acting ? 1 : 0;
    lessonDim = reduceMotion ? dimTarget : lessonDim + (dimTarget - lessonDim) * (1 - Math.exp(-realDt / SPOT_EASE));
    clock += dt;
    elapsed += lineDt;
    timeLeft = timeRemaining(elapsed);
    if (elapsed >= SHIFT_SECONDS) {
      void endGame("time");
      return;
    }

    const pace = paceForElapsed(elapsed, expert);
    if (pace.phase !== phase) {
      phase = pace.phase;
      setMusicPhase(phase);
      liveMessage = phase === "rush" ? "Lunch rush." : "Steady trade.";
    }

    // The next guest is due on the pace, or soon after the counter empties.
    // A full line means they wait at the door.
    arrivalTimer = Math.min(arrivalTimer + lineDt, pace.arrivalEvery);
    arrivalIn = Math.min(arrivalIn - lineDt, nextArrivalIn(pace, guests.length, arrivalTimer));
    if (arrivalIn <= 0 && guests.length < ticketCap) {
      arrivalTimer = 0;
      arrivalIn = Infinity;
      addGuest();
    }

    // Patience: from when the ticket is hung, slower for the guest who can
    // see their drink being made, and frozen once it is stamped.
    const activeRate = activePatienceRate(expert);
    for (const guest of [...guests]) {
      if (!guest.placed) continue;
      const mine = making?.guestId === guest.id;
      if (mine && making?.stampAt !== null) continue;
      guest.left -= lineDt * (mine ? activeRate : 1);
      if (guest.left <= 0) {
        walkOut(guest);
        if (gameOver) return;
      }
    }
    stepBrewing();
    if (refreshTick(realDt)) {
      guests = guests;
      refreshTanks();
      if (lessons.cue) measureAnchor();
    }

    // Stood still, a running tap would read as one run dry.
    if (dt > 0) stepCup(dt);
    stepBeats();
    if (gameOver) return;
    warmTurn();
    if (receipt && clock >= receipt.until) receipt = null;
    if (notice && clock >= notice.until) notice = null;
    checkLessons();
    stepBot(realDt);

    stepEffects(dt);
    stepCrowd(dt);
    stepRoom(dt);
  }

  // --- The line of guests ---------------------------------------------------------

  /** Tells the crowd who waits where, and how patient they are, then steps it and the tickets in the air. */
  function stepCrowd(dt: number) {
    crowd.sync(guests.map((guest) => ({ id: guest.id, share: guest.placed ? clamp(guest.left / guest.patience, 0, 1) : 1 })));
    crowd.step(dt);
    stepFlights(dt);
  }

  /**
   * Where the guests stand across the counter: between the back bar's
   * columns, skipping the middle one where the cup does its work, so a face
   * is never right behind the cup. Their pixels shrink if the spots are close.
   */
  function layoutCrowd() {
    const columns = [binX, ...spoutX, pumpX].filter((x) => x > 0).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let index = 1; index < columns.length; index++) gaps.push((columns[index - 1] + columns[index]) / 2);
    let middle = 0;
    gaps.forEach((gap, index) => {
      if (Math.abs(gap - workX()) < Math.abs(gaps[middle] - workX())) middle = index;
    });
    const spots = gaps.filter((_, index) => index !== middle).slice(0, ticketCap);
    let tightest = W;
    for (let index = 1; index < spots.length; index++) tightest = Math.min(tightest, spots[index] - spots[index - 1]);
    guestPx = Math.max(2, Math.min(cell, Math.floor(tightest / (FIGURE_W - 1))));
    crowd.layout(W, H, guestPx, counterY, spots, tipJarLeft());
  }

  // --- Lessons, in play -------------------------------------------------------------

  /** The slip's size before it has been measured: Coach's widest, and two lines (px). */
  const SLIP_W = 304;
  const SLIP_H = 64;
  /** The lessons a touch player answers on the hand, which lights up with them. */
  const HAND_LESSONS = new Set(["ticket", "ice", "syrup", "pour", "drop", "shake", "seal"]);
  /** Ghosts on the bench are dithered ink: the wall and the cup's inside are light, so cream would vanish. */
  const GHOST_INK = SCENE_INK;
  /** Real seconds a lesson may go unplaced (its thing not on screen) before it is taken down, so play never stays stopped for a line nobody can see. */
  const UNPLACED_SECONDS = 1.5;

  /** Copies what the lessons read about the counter into their view, in place. */
  function syncLessonView() {
    const view = lessonView;
    const cup = making;
    view.coarse = touchUI;
    view.started = ticketTaken;
    view.tapIndex = tapIndex;
    view.jarIndex = jarIndex;
    view.holding = holds.size > 0;
    view.loaded = !!cup && clock >= cup.loadedAt;
    view.ladle = cup?.station === "scoop" ? ladleAt(clock - cup.scoopStart, cup.swing, Math.PI / 2) : 0;
    view.needle = cup?.station === "seal" && cup.stampAt === null ? sealNeedle(clock - cup.sealStart, expert) : 0;
    view.cup = cup;
    view.guests = guests;
    view.tanks = tanks;
    view.brewEnds = brewEnds;
    view.samplesLeft = samplesLeft;
    view.special = special;
    view.jar = crowd.jar;
    view.receipt = receipt;
  }

  /**
   * Asks the lessons what this moment should teach and keeps the coach in
   * step with the bench (followLessons in orders-lessons.js): a station's
   * lesson whose moment has gone comes down uncounted, the next waits for
   * a short quiet, and the line on screen follows its target. While the
   * walk-through waits for the shift's first ticket, that ticket is marked.
   */
  function checkLessons() {
    // Nothing new while "go" is still on screen.
    if (clock - begunAt < GO_SECONDS) return;
    syncLessonView();
    // A line that could not be put on screen never holds play for long.
    if (coach.current && !coach.leaving && !coach.acting && !lessonShown && coach.age > UNPLACED_SECONDS) {
      coach.dismiss();
      lessons.cue = null;
    }
    if (followLessons(coach, lessonView, lessons, clock)) {
      measureAnchor(true);
      // Once more after the page has caught up (a ticket just placed, a chip just shown, the slip measured).
      void tick().then(() => measureAnchor());
    }
    const beckon = ticketBeckon(lessonView, coach.learned);
    if (beckon !== beckonGuest) beckonGuest = beckon;
  }

  /**
   * A taught move's result: worked, it is learned (or simply known, if it
   * was never shown); didn't, and it comes down uncounted so the next one
   * teaches it again.
   */
  function lessonResult(id: string, worked: boolean) {
    if (worked) {
      coach.done(id);
    } else if (coach.current?.id === id && !coach.leaving) {
      coach.dismiss();
      lessons.cue = null;
    }
  }

  /** A lesson is up, on screen, and unanswered, so the shift stands still for it. */
  function lessonHolds() {
    const lesson = coach.current;
    return !!lesson && lesson.slow === 0 && !coach.leaving && !coach.acting && lessonShown && running && !gameOver;
  }

  /**
   * A press in the shift while a lesson holds it: play comes back, and the
   * press goes on to do what it always does, so none is lost to the stop. A
   * step's press is its move begun (the line stays up until the station has
   * worked or its moment passes); any press during a thing reads as Continue
   * (the slip stays until it has been up long enough to read).
   */
  function wake() {
    const lesson = coach.current;
    if (!lesson || coach.leaving || coach.acting || lesson.slow !== 0) return;
    if (lesson.move) coach.acted(lesson.id);
    else coach.done(lesson.id);
  }

  /**
   * Game seconds until the moment a step waits on (the ladle right over the
   * cup, the needle in the middle of the band), so the frame stops right on
   * it; Infinity when nothing waits.
   */
  function momentIn() {
    const cup = making;
    if (!cup || cup.busy) return Infinity;
    if (lessons.waiting === "ladle" && cup.station === "scoop" && clock >= cup.loadedAt) {
      return ladleCentreIn(clock - cup.scoopStart, cup.swing);
    }
    if (lessons.waiting === "needle" && cup.station === "seal" && cup.stampAt === null) {
      return needleCentreIn(clock - cup.sealStart, expert);
    }
    return Infinity;
  }

  /** The DOM thing a lesson points at, if it is one. */
  function anchorElement(at: Target): Element | null {
    switch (at.kind) {
      case "step":
        return cardEl?.querySelector(`[data-step="${CARD_STEPS[at.index]}"]`) ?? null;
      case "ticket":
      case "patience":
        return lineEl?.querySelector(`[data-guest="${at.guest}"] .ou-guest`) ?? null;
      case "tap":
        return tapEls[at.index] ?? null;
      case "brew":
        return brewEls[at.index] ?? null;
      case "sample":
        return sampleEl ?? null;
      case "receipt":
        return receiptEl;
      case "streak":
        return streakEl ?? receiptEl;
      default:
        return null;
    }
  }

  /**
   * The machine on the back bar a lesson can point at instead: a card
   * line's station (the bottle, the bin, the ordered tea's tap), seen from
   * above when there is no room beside the card; a brew's whole machine.
   */
  function machineElement(at: Target): HTMLElement | null {
    if (at.kind === "tap" || at.kind === "brew") return tapEls[at.index] ?? null;
    if (at.kind !== "step") return null;
    const station = CARD_STEPS[at.index];
    if (station === "sugar") return syrupEl ?? null;
    if (station === "ice") return iceEl ?? null;
    if (station === "pour" && making) return tapEls[tapFor(making.order)] ?? null;
    return null;
  }

  /**
   * Reads where the lesson's target is on screen. A target that has just
   * gone (a receipt cleared, a ticket served) keeps its last place, so the
   * line fades where it was; a new target with nothing to show yet has none.
   */
  function measureAnchor(fresh = false) {
    if (canvas) benchBox = canvas.getBoundingClientRect();
    const at = lessons.cue?.at;
    if (lineEl) railBox = lineEl.getBoundingClientRect();
    if (handEl) handBox = handEl.getBoundingClientRect();
    machineBox = at ? machineElement(at)?.getBoundingClientRect() ?? null : null;
    if (machineBox && at?.kind === "brew") {
      // A brew's brackets take in the whole machine and the chip at its foot.
      const chip = brewEls[at.index]?.getBoundingClientRect();
      if (chip && chip.height > 0) {
        const bottom = Math.max(machineBox.bottom, chip.bottom);
        machineBox = new DOMRect(machineBox.left, machineBox.top, machineBox.width, bottom - machineBox.top);
      }
    }
    if (at && (at.kind === "ticket" || at.kind === "patience")) {
      // A ticket by its slot on the rail: its settled place, not where its
      // unfold has got to; the patience lesson by its track along the foot.
      const slot = lineEl?.querySelector(`[data-guest="${at.guest}"]`);
      const box = slot?.getBoundingClientRect();
      const track = at.kind === "patience" ? slot?.querySelector(".ou-patience")?.getBoundingClientRect() : null;
      if (box && track) anchorBox = new DOMRect(box.left + 12, track.top, box.width - 24, track.height);
      else if (box) anchorBox = box;
      else if (fresh) anchorBox = null;
      return;
    }
    const element = at ? anchorElement(at) : null;
    if (element) anchorBox = element.getBoundingClientRect();
    else if (fresh) anchorBox = null;
  }

  /** A lesson's target drawn on the bench: where it is in bench px, its loop's radius, and its half-width if wide (reused each frame). */
  const benchSpot = { x: 0, y: 0, r: 0, w: 0 };

  /** Finds a target drawn on the bench, or returns null for one in the page. */
  function benchPoint(at: Target): typeof benchSpot | null {
    const c = cell;
    const spot = benchSpot;
    spot.w = 0;
    switch (at.kind) {
      case "jar":
        spot.x = jarCentres()[at.index] ?? workX();
        spot.y = counterY - (JAR_ROWS / 2) * c;
        spot.r = (JAR_COLS / 2 + 1.5) * c;
        return spot;
      case "ladle":
        // Where the ladle should be when it drops: right over the cup.
        spot.x = workX();
        spot.y = cupTop - 4 * c;
        spot.r = 4.5 * c;
        return spot;
      case "line":
        // The pennant pointing at the fill line.
        spot.x = cupLeftAt(cupX) + (CUP_W + 1.5) * c;
        spot.y = cupTop + 17 * c - FILL_LINE[making?.order.ice ?? "regular"] * INSIDE_ROWS * c;
        spot.r = 2.5 * c;
        return spot;
      case "gauge": {
        const band = rulesFor(expert).sealBand;
        spot.x = Math.round(cupX + (CUP_W / 2 + 4) * c) + (GAUGE_COLS * c) / 2;
        spot.y = Math.round(cupTop + c) + (1 - (band[0] + band[1]) / 2) * GAUGE_ROWS * c;
        spot.r = 3.2 * c;
        return spot;
      }
      case "tipjar":
        spot.x = tipJarLeft() + (JAR_W / 2) * guestPx;
        spot.y = counterY - (JAR_H / 2) * guestPx;
        spot.r = Math.max(JAR_W, JAR_H) * guestPx * 0.62;
        return spot;
      default:
        return null;
    }
  }

  type Side = "above" | "below" | "left" | "right";
  /** A box on screen, in viewport px. */
  interface Rect {
    l: number;
    t: number;
    r: number;
    b: number;
  }
  /**
   * One place the slip could go: a side of its anchor; the anchor and the
   * brackets Coach draws round it (`ring` for a small thing, `half` and
   * `tall` for a wide or a tall one); and how high on screen it may sit.
   */
  interface Spot {
    side: Side;
    x: number;
    y: number;
    ring: number;
    half: number;
    tall: number;
    floor: number;
  }

  /** Keeps the slip this far inside the screen's edge, as Coach does (px). */
  const EDGE = 16;
  /** The places tried for the current lesson, best first, and the boxes it must keep clear of; pooled, so a frame allocates nothing. */
  const spotPool: Spot[] = [];
  let spotCount = 0;
  const keepPool: Rect[] = [];
  let keepCount = 0;
  const slipBox: Rect = { l: 0, t: 0, r: 0, b: 0 };
  const loopBox: Rect = { l: 0, t: 0, r: 0, b: 0 };
  const thingBox: Rect = { l: 0, t: 0, r: 0, b: 0 };

  function addSpot(side: Side, x: number, y: number, ring: number, half: number, tall: number, floor: number) {
    const spot = spotPool[spotCount] ?? (spotPool[spotCount] = { side, x, y, ring, half, tall, floor });
    spot.side = side;
    spot.x = x;
    spot.y = y;
    spot.ring = ring;
    spot.half = half;
    spot.tall = tall;
    spot.floor = floor;
    spotCount++;
  }

  /** A box the slip must keep clear of, in viewport px. */
  function addKeep(l: number, t: number, w: number, h: number) {
    if (w <= 0 || h <= 0) return;
    const box = keepPool[keepCount] ?? (keepPool[keepCount] = { l: 0, t: 0, r: 0, b: 0 });
    box.l = l;
    box.t = t;
    box.r = l + w;
    box.b = t + h;
    keepCount++;
  }

  /** The same, from bench px. */
  function addKeepBench(x: number, y: number, w: number, h: number) {
    if (benchBox) addKeep(benchBox.left + x, benchBox.top + y, w, h);
  }

  /** The brackets Coach draws round a spot's anchor (its own arithmetic), into `into`. */
  function loopRect(s: Pick<Spot, "x" | "y" | "ring" | "half" | "tall">, into: Rect) {
    const w = Math.max(s.ring * 2.3, s.half > 0 ? (s.half + 6) * 2 : 0);
    const h = Math.max(s.ring * 1.75, s.tall > 0 ? (s.tall + 4) * 2 : 0);
    into.l = s.x - w / 2;
    into.r = s.x + w / 2;
    into.t = s.y - h / 2;
    into.b = s.y + h / 2;
    return into;
  }

  /**
   * Where Coach will put a slip `w` × `h` for this spot, by its own
   * arithmetic, into `slipBox`; and whether it fits on that side without the
   * screen's edge pushing it back over its thing (where it fits, Coach keeps
   * the side it was given).
   */
  function slipFor(s: Spot, w: number, h: number, vw: number, vh: number) {
    const loopW = Math.max(s.ring * 2.3, s.half > 0 ? (s.half + 6) * 2 : 0);
    const loopH = Math.max(s.ring * 1.75, s.tall > 0 ? (s.tall + 4) * 2 : 0);
    const marked = s.ring > 0 || s.half > 0;
    const gapX = (marked ? Math.max(s.ring * 0.8, loopW / 2, s.half) : 6) + 14;
    const gapY = (marked ? Math.max(s.ring * 0.8, loopH / 2) : 6) + 14;
    let left = s.x - w / 2;
    let top = s.y - h / 2;
    let fits: boolean;
    if (s.side === "left") {
      left = s.x - gapX - w;
      fits = left >= EDGE;
    } else if (s.side === "right") {
      left = s.x + gapX;
      fits = left + w <= vw - EDGE;
    } else if (s.side === "above") {
      top = s.y - gapY - h;
      fits = top >= s.floor;
    } else {
      top = s.y + gapY;
      fits = top + h <= vh - EDGE;
    }
    left = Math.max(EDGE, Math.min(vw - EDGE - w, left));
    top = Math.max(s.floor, Math.min(vh - EDGE - h, top));
    slipBox.l = left;
    slipBox.t = top;
    slipBox.r = left + w;
    slipBox.b = top + h;
    return fits;
  }

  /** How much of `b` (grown by a few px) the slip box `a` covers, in px². */
  function overlap(a: Rect, b: Rect) {
    const margin = 4;
    const w = Math.min(a.r, b.r + margin) - Math.max(a.l, b.l - margin);
    const h = Math.min(a.b, b.b + margin) - Math.max(a.t, b.t - margin);
    return w > 0 && h > 0 ? w * h : 0;
  }

  /**
   * What a slip must never cover while this lesson is up: the cup and the
   * station in use (its machine, the ladle, the shaker, the press and the
   * gauge), the hand button when it is the move being taught, and for a
   * ticket's line the rail itself. The thing the lesson is about is kept
   * clear as well, by each spot.
   */
  function keepClear(lesson: Lesson, at: Target) {
    keepCount = 0;
    const c = cell;
    const cup = making;
    if (cup && benchBox) {
      addKeepBench(cupLeftAt(cupX) - c, cupTop - c, (CUP_W + 2) * c, counterY - cupTop + c);
      switch (cup.station) {
        case "sugar": {
          const top = shelfTop() - (PUMP_ROWS + 1) * c;
          addKeepBench(pumpX - (PUMP_W / 2 + 3) * c, top, (PUMP_W + 4) * c, nozzleBottom() - top + c);
          break;
        }
        case "ice":
          addKeepBench(binLeft() - c, shelfTop() - (ICE_BIN.length + 1) * c, (ICE_BIN[0].length + 2) * c, (ICE_BIN.length + SHELF_ROWS + 2) * c);
          break;
        case "pour": {
          const x = spoutX[tapIndex];
          const top = shelfTop() - (MACHINE_ROWS + 1) * c;
          if (x !== undefined) addKeepBench(x - (tankW / 2 + 1) * c, top, (tankW + 2) * c, cupTop - top);
          break;
        }
        case "scoop": {
          const ladle = ladleNow(cup);
          addKeepBench(ladle.bx - 5 * c, ladle.by - 3 * c, 10 * c, 5 * c);
          break;
        }
        case "shake":
          addKeepBench(cupX - 8 * c, cupTop - (SHAKER.length + 4) * c, 16 * c, (SHAKER.length + 4) * c);
          break;
        case "seal":
          // The press over the cup, from its mount under the shelf; the gauge is the seal's own thing.
          addKeepBench(cupX - (CUP_W / 2 + 2) * c, shelfBottom(), (CUP_W + 4) * c, counterY - shelfBottom());
          break;
        default:
          break;
      }
    }
    if (lesson.move && HAND_LESSONS.has(lesson.id) && handBox) addKeep(handBox.left, handBox.top, handBox.width, handBox.height);
    if ((at.kind === "ticket" || at.kind === "patience") && railBox) addKeep(railBox.left, railBox.top, railBox.width, railBox.height);
  }

  /**
   * Where the lesson's slip goes: the first of its places, best first, that
   * fits on screen and covers nothing in `keepClear` (nor its own thing);
   * failing that, the one that covers least. The pour's line, once the tap is
   * held, moves beside the fill line only where that is clear (null: it
   * stays where it was).
   */
  function placeSpot(lesson: Lesson, at: Target, point: typeof benchSpot | null): Spot | null {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = coachSlipW || SLIP_W;
    const h = coachSlipH || SLIP_H;
    const floor = Math.round(hudHeight + 8);
    // The thing itself, as Coach will ring it.
    let x: number;
    let y: number;
    let ring: number;
    let half = 0;
    let tall = 0;
    if (point && benchBox) {
      x = benchBox.left + point.x;
      y = benchBox.top + point.y;
      ring = Math.max(14, point.r);
      half = point.w;
    } else if (anchorBox) {
      const box = anchorBox;
      x = box.left + box.width / 2;
      y = box.top + box.height / 2;
      if (at.kind === "patience") {
        // The patience track along the ticket's foot: low brackets as wide as the track.
        ring = 14;
        half = box.width / 2;
      } else if (lesson.id === "ticket") {
        // The ticket carries its own stepping brackets: the slip keeps clear of it and draws none.
        ring = 0;
        half = box.width / 2;
        tall = box.height / 2;
      } else {
        // As tall as the thing, stretched to its width when that is wider.
        ring = Math.max(14, (box.height / 1.75) * 1.1);
        half = box.width / 2 > ring * 1.15 ? box.width / 2 : 0;
      }
    } else {
      return null;
    }
    // A machine on the back bar, bracketed tall and narrow, its slip above it.
    const m = machineBox && machineBox.width > 0 && machineBox.height > 0 ? machineBox : null;
    const mx = m ? m.left + m.width / 2 : 0;
    const my = m ? m.top + m.height / 2 : 0;
    const mw = m ? m.width / 2 : 0;
    const mh = m ? m.height / 2 : 0;
    spotCount = 0;
    switch (at.kind) {
      case "ticket":
      case "patience":
        // Beside the rail at its ends; otherwise in the strip under it.
        addSpot("left", x, y, ring, half, tall, floor);
        addSpot("right", x, y, ring, half, tall, floor);
        addSpot("below", x, y, ring, half, tall, railBox ? Math.round(railBox.bottom + 8) : floor);
        break;
      case "step":
        // Beside the card on its left, over the finished lines; where there
        // is no room (a phone), above the station on the back bar, over the
        // rail, well clear of the cup and the hand.
        addSpot("left", x, y, ring, half, 0, floor);
        if (m) addSpot("above", mx, my, 14, mw, mh, floor);
        else if (lesson.id === "shake" && benchBox && making) {
          const size = cell;
          const gap = Math.max(2, Math.round(cell / 2));
          const marks = SHAKES_NEEDED * size + (SHAKES_NEEDED - 1) * gap;
          addSpot("above", benchBox.left + cupX, benchBox.top + cupTop - (SHAKER.length + 2) * cell, 14, marks / 2, 0, floor);
        }
        addSpot("right", x, y, ring, half, 0, floor);
        break;
      case "tap":
      case "brew":
        if (m) {
          addSpot("above", mx, my, 14, mw, mh, floor);
          addSpot("left", mx, my, 14, mw, mh, floor);
          addSpot("right", mx, my, 14, mw, mh, floor);
        } else {
          addSpot("above", x, y, ring, half, 0, floor);
          addSpot("left", x, y, ring, half, 0, floor);
          addSpot("right", x, y, ring, half, 0, floor);
        }
        break;
      case "sample":
        addSpot("right", x, y, ring, half, 0, floor);
        addSpot("above", x, y, ring, half, 0, floor);
        addSpot("left", x, y, ring, half, 0, floor);
        break;
      case "receipt":
      case "streak":
        addSpot("below", x, y, ring, half, 0, floor);
        addSpot("right", x, y, ring, half, 0, floor);
        addSpot("left", x, y, ring, half, 0, floor);
        addSpot("above", x, y, ring, half, 0, floor);
        break;
      case "jar": {
        // Away from the cup first, so it never lies over the ladle's swing.
        const far: Side = at.index < 2 ? "left" : "right";
        addSpot(far, x, y, ring, half, 0, floor);
        addSpot("above", x, y, ring, half, 0, floor);
        addSpot(far === "left" ? "right" : "left", x, y, ring, half, 0, floor);
        addSpot("below", x, y, ring, half, 0, floor);
        break;
      }
      case "ladle":
        addSpot("above", x, y, ring, half, 0, floor);
        addSpot("left", x, y, ring, half, 0, floor);
        addSpot("right", x, y, ring, half, 0, floor);
        break;
      case "line":
        addSpot("right", x, y, ring, half, 0, floor);
        break;
      case "gauge":
        addSpot("right", x, y, ring, half, 0, floor);
        if (benchBox) {
          // No room beside the gauge (a phone): the whole seal bracketed, the
          // press, the cup and the gauge, with the slip above the press.
          const c = cell;
          const left = cupX - (CUP_W / 2 + 2) * c;
          const right = cupX + (CUP_W / 2 + 4 + GAUGE_COLS + 2.5) * c;
          const top = shelfBottom();
          addSpot("above", benchBox.left + (left + right) / 2, benchBox.top + (top + counterY) / 2, 14, (right - left) / 2, (counterY - top) / 2, floor);
        }
        addSpot("above", x, y, ring, half, 0, floor);
        break;
      default:
        addSpot("above", x, y, ring, half, 0, floor);
        addSpot("right", x, y, ring, half, 0, floor);
        break;
    }
    keepClear(lesson, at);
    loopRect({ x, y, ring, half, tall }, thingBox);
    let best: Spot | null = null;
    let bestScore = Infinity;
    for (let index = 0; index < spotCount; index++) {
      const spot = spotPool[index];
      const fits = slipFor(spot, w, h, vw, vh);
      let score = (fits ? 0 : 1e9) + overlap(slipBox, loopRect(spot, loopBox)) + overlap(slipBox, thingBox);
      for (let k = 0; k < keepCount; k++) score += overlap(slipBox, keepPool[k]);
      if (score === 0) return spot;
      if (score < bestScore) {
        best = spot;
        bestScore = score;
      }
    }
    return at.kind === "line" ? null : best;
  }

  /**
   * Puts the lesson's line in the first place beside its thing that keeps
   * clear of the cup, the station in use, the hand being taught and (for a
   * ticket) the rail, with pixel brackets round the thing, and lights the
   * pad it is about on touch. Once the lesson is over (done, or its move
   * made) the slip holds where it is.
   */
  function placeCoach() {
    const lesson = coach.current;
    const cue = lessons.cue;
    const at = lesson && cue && cue.lesson.id === lesson.id && running && !gameOver ? cue.at : null;
    // The page's pieces follow the spotlight.
    const dim = !!lesson && !!cue && running && !gameOver && !coach.leaving && !coach.acting;
    if (dim !== dimOthers) dimOthers = dim;
    if (dim && lesson && cue) {
      const ticket = cue.at.kind === "ticket" || cue.at.kind === "patience" ? cue.at.guest : -1;
      if (ticket !== litTicket) litTicket = ticket;
      // The drink in hand, its card and the hand stay lit through any lesson.
      const card = !!making;
      if (card !== litCard) litCard = card;
      const hand = !!lesson.move || !!making;
      if (hand !== litHand) litHand = hand;
      const sample = lesson.id === "sample";
      if (sample !== litSample) litSample = sample;
      const slip = cue.at.kind === "receipt" || cue.at.kind === "streak";
      if (slip !== litReceipt) litReceipt = slip;
      const tap = cue.at.kind === "brew" || cue.at.kind === "tap" ? cue.at.index : lesson.id === "pour" && making ? tapFor(making.order) : -1;
      if (tap !== litTap) litTap = tap;
      const less = lesson.id === "ice";
      if (less !== litLess) litLess = less;
    }
    const held = holds.size > 0;
    if (held !== handHeld) handHeld = held;
    // A ticket on the rail is followed frame by frame (it moves as others leave).
    if (at && (at.kind === "ticket" || at.kind === "patience")) measureAnchor();
    const point = at ? benchPoint(at) : null;
    if (!lesson || !cue || !at || (point ? !benchBox : !anchorBox)) {
      // The last line stays mounted, faded, so the live region keeps its
      // words until the next lesson replaces them.
      if (!coachLeaving) coachLeaving = true;
      if (coachOpen) coachOpen = false;
      if (handLit) handLit = false;
      if (sampleLit) sampleLit = false;
      if (lessonShown) lessonShown = false;
      return;
    }
    if (coachLesson !== cue.lesson) coachLesson = cue.lesson;
    // The line fades only once it has been up long enough to read; its Continue goes as soon as it is done.
    if (coachLeaving !== coach.fading) coachLeaving = coach.fading;
    const open = !coach.leaving && !coach.acting;
    if (open !== coachOpen) coachOpen = open;
    const live = touchUI && open;
    const hand =
      live &&
      HAND_LESSONS.has(lesson.id) &&
      // On a pad the hand pours from whichever tap the cup is under: lit only once that is the ordered one.
      (lesson.id !== "pour" || (!!making && TEAS[tapIndex] === making.order.tea));
    if (hand !== handLit) handLit = hand;
    const sample = live && lesson.id === "sample";
    if (sample !== sampleLit) sampleLit = sample;
    // Over: the slip holds where it is. Only the pour's line moves on, to the
    // fill line while the tap is held, and only where there is room for it.
    const following = coach.acting && !coach.leaving && at.kind === "line";
    if ((coach.leaving || coach.acting) && !following) {
      if (!coachEnded) coachEnded = true;
      return;
    }
    const spot = placeSpot(lesson, at, point);
    if (!spot) {
      if (!coachEnded) coachEnded = true;
      return;
    }
    if (coachEnded) coachEnded = false;
    const x = Math.round(spot.x);
    const y = Math.round(spot.y);
    const ring = Math.round(spot.ring);
    const half = Math.round(spot.half);
    const tall = Math.round(spot.tall);
    if (x !== coachX) coachX = x;
    if (y !== coachY) coachY = y;
    if (ring !== coachRing) coachRing = ring;
    if (half !== coachWidth) coachWidth = half;
    if (tall !== coachHeight) coachHeight = tall;
    if (spot.side !== coachSide) coachSide = spot.side;
    if (spot.floor !== coachTop) coachTop = spot.floor;
    // The card, the hand row and the Sample button sit on the counter's dark
    // wood: the tail prints cream there; on the light wall, in ink.
    const scene = room.counterPx && y > room.counterPx ? "dark" : "light";
    if (scene !== coachScene) coachScene = scene;
    if (!lessonShown) lessonShown = true;
  }

  // --- The spotlight ---------------------------------------------------------------
  // While a lesson is up the shop dims and what it is about stays lit: on the
  // bench canvas the cup and the station in play (drawSpotlight's pixel-
  // stepped edge), on the room canvas everything round the bench, and on the
  // page the tickets, the card and the hand row not in play (a class).

  /** The wash: the room's own deep brown, so the light shop dims warm. */
  const SPOT_WASH = "#2a1c18";
  /** How quickly the spotlight comes up and goes (seconds). */
  const SPOT_EASE = 0.18;
  /** What stays lit on the bench, in bench px (drawSpotlight merges any that overlap). */
  const focusBoxes: FocusBox[] = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  let focusCount = 0;
  const litBoxes: FocusBox[] = [];

  function pushFocus(x: number, y: number, w: number, h: number) {
    if (focusCount >= focusBoxes.length) return;
    const box = focusBoxes[focusCount++];
    box.x = x;
    box.y = y;
    box.w = w;
    box.h = h;
  }

  /** A tea machine's column on the shelf, down to its spout. */
  function machineFocus(index: number) {
    const c = cell;
    const x = spoutX[index];
    if (x === undefined) return;
    const top = shelfTop() - (MACHINE_ROWS + 1) * c;
    pushFocus(x - (tankW / 2 + 1) * c, top, (tankW + 2) * c, nozzleBottom() - top + c);
  }

  /** What the current lesson keeps lit on the bench. */
  function lessonFocus(lessonId: string, at: Target) {
    focusCount = 0;
    const c = cell;
    const cup = making;
    if (cup) {
      // The cup in hand stays lit for any lesson, with room above it for the stream, the shaker and the press.
      pushFocus(cupLeftAt(cupX) - 2 * c, cupTop - 7 * c, (CUP_W + 4) * c, counterY - cupTop + 8 * c);
    }
    switch (lessonId) {
      case "syrup": {
        const top = shelfTop() - (PUMP_ROWS + 1) * c;
        pushFocus(pumpX - (PUMP_W / 2 + 3) * c, top, (PUMP_W + 4) * c, nozzleBottom() - top + c);
        break;
      }
      case "ice":
        pushFocus(binLeft() - c, shelfTop() - (ICE_BIN.length + 1) * c, (ICE_BIN[0].length + 2) * c, (ICE_BIN.length + SHELF_ROWS + 2) * c);
        break;
      case "pour":
        if (cup) machineFocus(tapFor(cup.order));
        break;
      case "brew":
        machineFocus(at.index);
        break;
      case "jar": {
        const centre = jarCentres()[at.index];
        if (centre !== undefined) pushFocus(centre - (JAR_COLS / 2 + 1) * c, counterY - (JAR_ROWS + 3) * c, (JAR_COLS + 2) * c, (JAR_ROWS + 4) * c);
        break;
      }
      case "drop":
        pushFocus(workX() - 7 * c, cupTop - 16 * c, 14 * c, 16 * c);
        break;
      case "seal":
        pushFocus(cupX + (CUP_W / 2 + 2) * c, cupTop, (GAUGE_COLS + 6) * c, counterY - cupTop + c);
        break;
      case "tipjar":
        pushFocus(tipJarLeft() - c, counterY - (JAR_H + 2) * guestPx, JAR_W * guestPx + 2 * c, (JAR_H + 2) * guestPx + c);
        break;
      default:
        break;
    }
  }

  /** The bench's part of the spotlight: dim everything but the lit boxes. */
  function drawLessonLight(g: CanvasRenderingContext2D) {
    if (lessonDim <= 0.01) return;
    const lesson = coach.current;
    const cue = lessons.cue;
    if (lesson && cue && cue.lesson.id === lesson.id) lessonFocus(lesson.id, cue.at);
    litBoxes.length = 0;
    for (let index = 0; index < focusCount; index++) litBoxes.push(focusBoxes[index]);
    drawSpotlight(g, W, H, litBoxes, lessonDim, { color: SPOT_WASH, cell });
  }

  /** The room's part: everything round the bench dims with it (the bench draws its own). */
  function drawRoomWash(g: CanvasRenderingContext2D, w: number, h: number) {
    if (lessonDim <= 0.01 || !benchBox) return;
    g.save();
    g.globalAlpha = 0.5 * lessonDim;
    g.fillStyle = SPOT_WASH;
    g.beginPath();
    g.rect(0, 0, w, h);
    g.rect(Math.round(benchBox.left), Math.round(benchBox.top), Math.round(benchBox.width), Math.round(benchBox.height));
    g.fill("evenodd");
    g.restore();
  }

  /**
   * Continue (Enter, or the slip's button): ends the lesson up and counts it
   * as known, a step's included (its move is then the player's to make), and
   * brings play back.
   */
  function continueLesson() {
    const lesson = coach.current;
    if (!lesson || coach.leaving || coach.acting || !running || paused) return;
    coach.done(lesson.id);
  }

  /** A lesson is up and unanswered: Enter continues it rather than working the hand. */
  function lessonOpen() {
    return !!coach.current && !coach.leaving && !coach.acting && running && !paused;
  }

  /**
   * The lesson's ghost, the move it asks for, played in real time while
   * play stands still: a pump of syrup squirting into the cup, a cube
   * arcing from the bin into it, the tea rising to the line before the tap
   * is held, the scoop falling from the ladle (stopped right over the cup)
   * into it, the cup jolting side to side, and the press coming down on the
   * rim (with the needle stopped in the band). Each is dithered ink (syrup
   * and tea in their own colours), breathing slowly, shown done and still
   * under Reduce Motion (the shake, which is nothing but motion, not at
   * all), and gone once paused.
   */
  function drawLessonGhost(g: CanvasRenderingContext2D) {
    const lesson = coach.current;
    const cup = making;
    if (!lesson || !cup || paused || coach.leaving || coach.acting || lessons.cue?.lesson.id !== lesson.id) return;
    const density = 0.4 + 0.25 * beckon(lessonClock, reduceMotion);
    if (lesson.id === "syrup" && cup.station === "sugar" && !cup.busy) drawSyrupGhost(g, cup, density);
    else if (lesson.id === "ice" && cup.station === "ice" && !cup.busy) drawIceGhost(g, density);
    else if (lesson.id === "pour" && cup.station === "pour" && !holds.size) drawPourGhost(g, cup, density);
    else if (lesson.id === "drop" && cup.station === "scoop" && !cup.busy) drawDropGhost(g, cup, density);
    else if (lesson.id === "shake" && cup.station === "shake" && !cup.busy && !reduceMotion) drawShakeGhost(g, density);
    else if (lesson.id === "seal" && cup.station === "seal" && cup.stampAt === null) drawPressGhost(g, density);
  }

  // Each ghost is painted by one function made once, reading where to paint
  // from `ghostAt`, so a frame allocates nothing for it.
  const ghostAt = { left: 0, surface: 0, x: 0, y: 0, width: 0, height: 0, art: TOPPING_ART.pearls };
  const ghostStyle = { color: GHOST_INK, density: 0.5, cell: 4 };

  /** The ghost's colour and screen door for this frame, on the bench's grid. */
  function styleGhost(color: string, density: number) {
    ghostStyle.color = color;
    ghostStyle.density = density;
    ghostStyle.cell = cell;
    return ghostStyle;
  }

  /** The tea up to `ghostAt.surface` inside the cup at `ghostAt.left`, row by row inside its tapering walls. */
  const paintPourGhost = (ghost: CanvasRenderingContext2D) => {
    const c = cell;
    for (let row = 1; row <= INSIDE_ROWS; row++) {
      const y0 = cupTop + row * c;
      if (y0 + c <= ghostAt.surface) continue;
      const inset = wallInset(row);
      const from = Math.max(y0, ghostAt.surface);
      ghost.fillRect(ghostAt.left + (inset + 1) * c, from, (12 - 2 * inset) * c, y0 + c - from);
    }
  };

  /** A scoop of `ghostAt.art`, its centre at `ghostAt.x` and its top at `ghostAt.y`. */
  const paintDropGhost = (ghost: CanvasRenderingContext2D) => {
    const c = cell;
    const { x, y, art } = ghostAt;
    drawSprite(ghost, art.grid, x - (SCOOP_COLS / 2) * c, y, c, art.palette);
  };

  /** A plain block, `ghostAt.width` × `ghostAt.height` from `ghostAt.left`, its top at `ghostAt.y`: the sealer's plate, or a squirt of syrup. */
  const paintPressGhost = (ghost: CanvasRenderingContext2D) => {
    ghost.fillRect(ghostAt.left, ghostAt.y, ghostAt.width, ghostAt.height);
  };

  /** A cube of ice, its centre at `ghostAt.x` and its top at `ghostAt.y`. */
  const paintIceGhost = (ghost: CanvasRenderingContext2D) => {
    drawSprite(ghost, ICE_CUBE, ghostAt.x - 1.5 * cell, ghostAt.y, cell, ICE_PALETTE);
  };

  /** The cup's outline, its left edge at `ghostAt.left`. */
  const paintShakeGhost = (ghost: CanvasRenderingContext2D) => {
    drawSprite(ghost, CUP_OUTLINE, ghostAt.left, cupTop, cell, { O: GHOST_INK });
  };

  /** A pump: syrup running from the bottle's tube down into the cup, a beat, and again (all the way down under Reduce Motion). */
  function drawSyrupGhost(g: CanvasRenderingContext2D, cup: Cup, density: number) {
    const c = cell;
    const top = nozzleBottom();
    const bottom = cupTop + 15 * c;
    const t = reduceMotion ? 1 : clamp((lessonClock % 1.2) / 0.35, 0, 1);
    ghostAt.width = Math.max(2, Math.round(c / 2) * 2 - 2);
    ghostAt.left = Math.round(pumpTipX() - c / 2);
    ghostAt.y = top;
    ghostAt.height = Math.max(0, Math.round((bottom - top) * t));
    if (ghostAt.height > 0 && cup.station === "sugar") {
      drawGhost(g, ghostAt.left - c, top, ghostAt.width + 2 * c, bottom - top, paintPressGhost, styleGhost(SYRUP, density));
    }
  }

  /** A cube arcing from the bin into the cup, a beat, and again (in the cup under Reduce Motion). */
  function drawIceGhost(g: CanvasRenderingContext2D, density: number) {
    const c = cell;
    const u = reduceMotion ? 1 : clamp((lessonClock % 1.2) / 0.5, 0, 1);
    const from = iceArcAt(0);
    const to = iceArcAt(1);
    const at = iceArcAt(u);
    ghostAt.x = at.x;
    ghostAt.y = at.y;
    const left = Math.min(from.x, to.x) - 3 * c;
    drawGhost(g, left, from.y - c, Math.abs(to.x - from.x) + 6 * c, to.y - from.y + 5 * c, paintIceGhost, styleGhost(GHOST_INK, density));
  }

  /** The cup jolting one way and the other, as each press shakes it. */
  function drawShakeGhost(g: CanvasRenderingContext2D, density: number) {
    const c = cell;
    const side = Math.floor(lessonClock / 0.16) % 2 ? 1 : -1;
    ghostAt.left = cupLeftAt(cupX) + Math.round(side * 1.5) * c;
    drawGhost(g, cupLeftAt(cupX) - 3 * c, cupTop - c, (CUP_W + 6) * c, (CUP_H + 2) * c, paintShakeGhost, styleGhost(GHOST_INK, density));
  }

  /** The tea rising from where it is to the fill line, a beat there, and again (at the line under Reduce Motion). */
  function drawPourGhost(g: CanvasRenderingContext2D, cup: Cup, density: number) {
    const c = cell;
    const line = FILL_LINE[cup.order.ice];
    const t = reduceMotion ? 1 : clamp((lessonClock % 1.8) / 1.26, 0, 1);
    const level = lerp(Math.min(cup.level, line), line, smooth(t));
    ghostAt.left = cupLeftAt(cupX);
    ghostAt.surface = Math.round(cupTop + 17 * c - level * INSIDE_ROWS * c);
    drawGhost(g, ghostAt.left, cupTop, CUP_W * c, CUP_H * c, paintPourGhost, styleGhost(TEA_COLORS[cup.order.tea], density));
  }

  /** The drop: the scoop falling from the ladle's bowl into the cup, a beat there, and again (in the cup under Reduce Motion). */
  function drawDropGhost(g: CanvasRenderingContext2D, cup: Cup, density: number) {
    const c = cell;
    const ladle = ladleNow(cup);
    const from = ladle.by - 2 * c;
    const to = Math.max(from, Math.round(surfaceY(cup)) - SCOOP_ROWS * c);
    const t = reduceMotion ? 1 : clamp((lessonClock % 1.4) / 0.7, 0, 1);
    ghostAt.x = ladle.bx;
    ghostAt.y = Math.round(lerp(from, to, t * t));
    ghostAt.art = TOPPING_ART[cup.queue[cup.drops.length] ?? cup.chosen];
    const half = (SCOOP_COLS / 2 + 1) * c;
    drawGhost(g, ladle.bx - half, from - c, 2 * half, to - from + (SCOOP_ROWS + 2) * c, paintDropGhost, styleGhost(GHOST_INK, density));
  }

  /** The stamp: the press plate coming down from where it hovers onto the rim, a beat there, and again (down under Reduce Motion). */
  function drawPressGhost(g: CanvasRenderingContext2D, density: number) {
    const c = cell;
    const hover = cupTop - 4 * c;
    const landed = cupTop - c;
    const t = reduceMotion ? 1 : clamp((lessonClock % 1.4) / 0.5, 0, 1);
    ghostAt.width = (CUP_W + 4) * c;
    ghostAt.height = Math.round(1.5 * c);
    ghostAt.left = Math.round(cupX - (CUP_W / 2 + 2) * c);
    ghostAt.y = Math.round(lerp(hover, landed, cubicOut(t)) - ghostAt.height);
    drawGhost(g, ghostAt.left, hover - ghostAt.height - c, ghostAt.width, landed - hover + ghostAt.height + 2 * c, paintPressGhost, styleGhost(GHOST_INK, density));
  }

  // --- The test bot (development only) ------------------------------------------------
  // `?autoplay` hands the counter to the bot in orders-bot.js, which plays
  // like a steady person; `?autoplay=careless` sometimes forgets to check the
  // tap or the jar. Each shift's tally goes to the console as it ends. While
  // a lesson is new the bot waits a second, so every lesson can be watched.

  let autoplay: ReturnType<typeof createBot> | null = null;
  const botCup: NonNullable<BotView["cup"]> = {
    guestId: 0, station: "", busy: false, tea: null, orderTea: "", drops: 0, queue: [], stampAt: null, level: 0, line: 0,
    scoopStart: 0, swing: 1, loaded: false, sealStart: 0, sealPeriod: rulesFor(expert).sealPeriod, band: rulesFor(expert).sealBand,
  };
  const botView: BotView = {
    now: 0, cup: null, holding: false, dry: false, tapIndex: 0, target: 0, jarIndex: 0, wanted: 0, teaReady: true, lowTank: -1, restless: false, ticket: false,
  };

  function devBot() {
    if (!import.meta.env.DEV) return null;
    const mode = new URLSearchParams(window.location.search).get("autoplay");
    if (mode === null) return null;
    return createBot(Math.floor(Math.random() * 2 ** 31), { slip: mode === "careless" ? 0.15 : 0 });
  }

  function stepBot(realDt: number) {
    if (!autoplay || !running || paused) return;
    const lesson = coach.current;
    if (lesson && !coach.leaving && coach.age < 1 && !holds.size) return;
    // A line it has nothing to do for (a thing, or a step it can't make yet) is continued, so play never stays stopped.
    if (lesson && lessonHolds() && coach.age >= (lesson.move ? 3 : 1.5)) {
      continueLesson();
      return;
    }
    const cup = making;
    botView.now = clock;
    botView.holding = holds.size > 0;
    botView.dry = holds.size > 0 && tankState(tanks[tapIndex]) === "empty";
    botView.tapIndex = tapIndex;
    botView.jarIndex = jarIndex;
    botView.ticket = guests.some((guest) => guest.placed);
    const restless = sampleTarget(guests, cup?.guestId ?? null);
    botView.restless = samplesLeft > 0 && restless >= 0 && guests[restless].left / guests[restless].patience < 0.3;
    botView.lowTank = tanks.findIndex((tank, index) => brewEnds[index] === 0 && tankState(tank) !== "ok");
    if (cup) {
      botCup.guestId = cup.guestId;
      botCup.station = cup.station;
      botCup.busy = cup.busy;
      botCup.tea = cup.tea;
      botCup.orderTea = cup.order.tea;
      botCup.drops = cup.drops.length;
      botCup.queue = cup.queue;
      botCup.stampAt = cup.stampAt;
      botCup.level = cup.level;
      botCup.line = FILL_LINE[cup.order.ice];
      botCup.scoopStart = cup.scoopStart;
      botCup.swing = cup.swing;
      botCup.loaded = clock >= cup.loadedAt;
      botCup.sealStart = cup.sealStart;
      botView.cup = botCup;
      botView.target = tapFor(cup.order);
      botView.wanted = Math.max(0, TOPPINGS.indexOf(cup.queue[cup.drops.length]));
      botView.teaReady = brewEnds[tapIndex] === 0 && tanks[tapIndex] > 0.001;
    } else {
      botView.cup = null;
    }
    const action = botAct(autoplay, botView, realDt);
    if (action === "take") takeNext();
    else if (action === "press") act("bot");
    else if (action === "hold") startHold("bot");
    else if (action === "release") endHold("bot", true);
    else if (action === "left" || action === "right") {
      const direction = action === "left" ? -1 : 1;
      if (cup?.station === "scoop") moveJar(direction);
      else moveTap(direction);
    } else if (action === "brew" && botView.lowTank >= 0) brew(botView.lowTank);
    else if (action === "sample") giveSample();
  }

  // --- Input ---------------------------------------------------------------

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Tab") {
      onPlayfieldTab(event);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (gameOver || paused) return;
    const key = event.key;
    if (!running) return;

    // Enter (not on a focused control) continues past a line that holds play.
    // The press is used up by it: its release must not let go of a pour
    // another key is holding (and each key holds on its own anyway).
    if (key === "Enter" && !isOnControl(event) && lessonOpen()) {
      event.preventDefault();
      if (!event.repeat) {
        keyLatch.take(key);
        continueLesson();
      }
      return;
    }

    if (key === " " || key === "Enter") {
      // A focused control keeps Space and Enter for itself.
      if (isOnControl(event)) return;
      event.preventDefault();
      if (!event.repeat) act(keyHold("key", key));
      return;
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      if (event.repeat || !making) return;
      const direction = key === "ArrowLeft" ? "left" : "right";
      if (beforeTea(making.station)) moveTap(direction === "left" ? -1 : 1);
      else if (making.station === "scoop") moveJar(direction === "left" ? -1 : 1);
      else if (making.station === "shake" && direction !== lastShakeArrow) {
        // Arrows shake only when they alternate, like a wrist going back and forth.
        lastShakeArrow = direction;
        shake();
      }
      return;
    }
    if (key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault();
      if (event.repeat || !making) return;
      if (making.station === "sugar") {
        if (key === "ArrowUp") pumpSyrup();
        else removeSyrup();
        return;
      }
      if (making.station !== "pour" && making.station !== "ice") return;
      if (key === "ArrowUp") addIce();
      else removeIce();
      return;
    }
    if (key === "Backspace" || key === "Delete") {
      event.preventDefault();
      if (!event.repeat) dump();
      return;
    }
    const lower = key.toLowerCase();
    if (lower === "b") {
      event.preventDefault();
      if (!event.repeat) brew(tapIndex);
      return;
    }
    if (lower === "s") {
      event.preventDefault();
      if (!event.repeat) giveSample();
      return;
    }
    const number = Number(key);
    if (Number.isInteger(number) && number >= 1 && number <= ticketCap) {
      event.preventDefault();
      if (!event.repeat) take(number - 1);
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    const hold = releaseFor(keyLatch, "key", event.key);
    if (hold) endHold(hold, true);
  }

  /** A control losing focus lets go of whatever its keys were holding, unjudged. */
  function endKeyHolds(from: string) {
    for (const key of HAND_KEYS) endHold(keyHold(from, key), false);
  }

  const isPrimary = (event: PointerEvent) => !(event.pointerType === "mouse" && event.button !== 0);

  function capture(event: PointerEvent) {
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety; the up and cancel handlers still release.
    }
  }

  /** Press and hold a tap: the cup slides under it and it pours while held. */
  function tapDown(event: PointerEvent, index: number) {
    if (!isPrimary(event)) return;
    event.preventDefault();
    if (!tapLive(index) || !selectTap(index)) return;
    leaveEarly();
    capture(event);
    startHold("tap");
  }

  function tapKey(event: KeyboardEvent, index: number, down: boolean) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!down) {
      endHold(keyHold("tap-key", event.key), true);
      return;
    }
    if (event.repeat || !tapLive(index) || !selectTap(index)) return;
    leaveEarly();
    startHold(keyHold("tap-key", event.key));
  }

  /** The hand acts on pointer down, never waiting for a click. */
  function handDown(event: PointerEvent, source: string) {
    if (!isPrimary(event)) return;
    event.preventDefault();
    capture(event);
    act(source);
  }

  /** The bench: a jar marks that jar at the scoop; anywhere else is the hand (an empty bench takes the next ticket). */
  function benchDown(event: PointerEvent) {
    if (!isPrimary(event)) return;
    event.preventDefault();
    const cup = making;
    if (!cup && !running) return;
    if (cup && cup.station === "scoop" && !cup.busy) {
      const box = canvas.getBoundingClientRect();
      const jar = jarAt(event.clientX - box.left, event.clientY - box.top);
      if (jar >= 0) {
        selectJar(jar);
        return;
      }
    }
    capture(event);
    act("bench");
  }

  function handKey(event: KeyboardEvent, down: boolean) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!down) endHold(keyHold("hand-key", event.key), true);
    else if (!event.repeat) act(keyHold("hand-key", event.key));
  }

  // --- Pause, restart, and finish -----------------------------------------

  async function pauseGame() {
    if (gameOver || paused) return;
    paused = true;
    releaseAll();
    setMusicPaused(true);
    liveMessage = "The game is paused.";
    await tick();
    pauseCard?.focus();
  }

  function resumeGame() {
    if (gameOver || !paused) return;
    paused = false;
    loop.resync();
    setMusicPaused(false);
    sfxBlip();
    liveMessage = "The game resumed.";
    focusPlayfield();
  }

  /**
   * Hands focus to the counter rather than a HUD button, so Space pours
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
    if (!event.shiftKey || document.activeElement !== playfield) return;
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

  async function endGame(reason: "hearts" | "time") {
    if (gameOver) return;
    gameOver = true;
    running = false;
    endReason = reason;
    loop.stop();
    coach.dismiss();
    lessons.cue = null;
    lessons.waiting = null;
    beckonGuest = -1;
    // The shop comes back to full light behind the results.
    lessonDim = 0;
    dimOthers = false;
    releaseAll();
    if (autoplay) {
      const count = (reaction: Reaction) => history.filter((item) => item === reaction).length;
      console.info("order up autoplay", { reason, score, served, sentBack: count("sentBack"), walkouts: count("storm") });
    }
    // A half-made cup is abandoned with the shift.
    making = null;
    beats = [];
    falling = [];
    iceArcs = [];
    // One last frame without the spotlight (the loop has stopped).
    drawRoom();
    draw();
    const result = concludeRun("orders", score, reason);
    localBest = result.best;
    newBest = result.newBest;
    // One face per guest, the way they left, then a jar for each one filled.
    shareLines = [
      ...emojiRows(history.map((reaction) => SHARE_FACES[reaction]), 10, 3),
      ...(jarsCashed ? ["🫙".repeat(Math.min(jarsCashed, 10))] : []),
    ];
    liveMessage =
      reason === "time" ? `Shift complete. Final score ${score}.` : `Kitchen closed. Final score ${score}.`;
    await tick();
    slip?.focus();
  }

  function restart() {
    stopMusic();
    timers.clear();
    releaseAll();
    score = 0;
    lives = LIVES;
    streak = 0;
    bestStreak = 0;
    served = 0;
    gradeTotal = 0;
    perfects = 0;
    guests = [];
    making = null;
    tapIndex = 0;
    receipt = null;
    notice = null;
    countdown = COUNTDOWN_SECONDS;
    countdownElapsed = 0;
    goVisible = false;
    running = false;
    paused = false;
    gameOver = false;
    timeLeft = SHIFT_SECONDS;
    phase = "opening";
    missPulse = 0;
    newBest = false;
    clock = 0;
    elapsed = 0;
    arrivalTimer = 0;
    arrivalIn = Infinity;
    ordersMade = 0;
    recent = [];
    resetShiftExtras();
    resetRoom();
    beats = [];
    falling = [];
    particles = [];
    popups = [];
    iceArcs = [];
    coach.reset();
    autoplay = devBot();
    lessons.cue = null;
    coachLesson = null;
    coachEnded = false;
    lessonShown = false;
    lessons.announced.clear();
    settle = null;
    lessons.quiet = 0;
    lessons.calm = 0;
    lessons.waiting = null;
    ticketTaken = false;
    beckonGuest = -1;
    lessonDim = 0;
    begunAt = 0;
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
    loop.start();
    // The results slip has gone: focus back on the counter, so Space works the bench.
    void tick().then(focusPlayfield);
  }

  // --- Sizing and lifecycle ------------------------------------------------

  /** Sizes the bench to its box, picks the grid, and lines the spouts and the bin up with their buttons. */
  function sizeBench() {
    if (!benchArt || !canvas) return;
    const rect = benchArt.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    ctx = fitCanvas(canvas, W, H);
    benchBox = canvas.getBoundingClientRect();
    // Whole-pixel cells, sized so the back bar, the stream and the cup all
    // fit; everything judged from the cup is measured in the same cells.
    cell = Math.max(2, Math.min(Math.floor(H / ROWS_NEEDED), Math.floor(W / COLS_NEEDED)));
    counterY = H - 3 * cell;
    cupTop = counterY - CUP_H * cell;
    spoutX = TEAS.map((_, index) => {
      const tap = tapEls[index];
      if (!tap) return ((index + 1.5) / (TEAS.length + 1)) * W;
      const box = tap.getBoundingClientRect();
      return box.left + box.width / 2 - rect.left;
    });
    const centre = (el: HTMLElement | undefined, fallback: number) => {
      if (!el) return fallback;
      const box = el.getBoundingClientRect();
      return box.left + box.width / 2 - rect.left;
    };
    binX = centre(iceEl, (0.5 / (TEAS.length + 2)) * W);
    pumpX = centre(syrupEl, ((TEAS.length + 1.5) / (TEAS.length + 2)) * W);
    // As wide as the column allows, within reason, so the labels fit their words.
    const column = tapEls[0]?.getBoundingClientRect().width ?? W / (TEAS.length + 2);
    tankW = clamp(Math.floor(column / cell) - 1, 9, 12);
    // The buttons sit over the machines, from their lids to the shelf.
    tapsTop = Math.max(0, shelfTop() - MACHINE_ROWS * cell);
    tapsH = shelfBottom() - tapsTop;
    layoutCrowd();
    // Re-seat the cup where it belongs on the new layout, without a slide.
    if (making) cupX = stationX(making);
    // The room lines up with the bench, the taps and the line, so it follows.
    layoutRoom();
    drawRoom();
    draw();
    // A lesson's target has moved with the layout: measured again, or dropped if it has gone.
    if (lessons.cue) measureAnchor(true);
  }

  function measure() {
    if (hud) hudHeight = hud.getBoundingClientRect().bottom;
    sizeBench();
  }

  onMount(() => {
    popupFont = arcadeFont();
    special = pickSpecial();

    const smallQuery = window.matchMedia("(max-width: 640px), (orientation: landscape) and (max-height: 28rem)");
    const onSmall = () => {
      small = smallQuery.matches;
      void tick().then(measure);
    };
    small = smallQuery.matches;
    smallQuery.addEventListener("change", onSmall);
    // On a touch screen the lessons name the gesture and light the pad.
    const touchQuery = window.matchMedia("(hover: none) and (pointer: coarse)");
    const onTouch = () => (touchUI = touchQuery.matches);
    onTouch();
    touchQuery.addEventListener("change", onTouch);

    const unmountShell = mountShell({
      isOver: () => gameOver,
      isPaused: () => paused,
      pause: () => void pauseGame(),
      togglePause,
      playScope: () => playScope,
      onResize: measure,
      // The HUD's second row changes where the counter starts.
      observe: hud,
      onReduceMotion: (reduce) => {
        reduceMotion = reduce;
        crowd.reduceMotion = reduce;
      },
    });
    // The bench's own box changes with the column (a guest card growing a
    // line, the window resizing), and the canvas follows it.
    const benchObserver = new ResizeObserver(() => sizeBench());
    benchObserver.observe(benchArt);
    benchObserver.observe(lineEl);
    benchObserver.observe(columnEl);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // Held keys never outlive the window's focus.
    window.addEventListener("blur", releaseAll);

    // Straight to the countdown: the shift teaches itself as it goes.
    measure();
    // No card in front of the counter any more, so focus lands in the game.
    focusPlayfield();
    autoplay = devBot();
    sfxCountdown(COUNTDOWN_SECONDS);
    loop.start();

    return () => {
      loop.stop();
      timers.clear();
      setPourStream(0);
      stopMusic();
      benchObserver.disconnect();
      smallQuery.removeEventListener("change", onSmall);
      touchQuery.removeEventListener("change", onTouch);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      unmountShell();
    };
  });
</script>

<div bind:this={playScope} class="ou-game">
  <div class="boba-stage ou-stage" aria-hidden="true"></div>
  <!-- The room behind the counter, painted at two depths: the street through
       the window, softened, and the room, a little muted. The bench and the
       DOM sit on both, crisp. -->
  <canvas bind:this={farCanvas} class="ou-scene ou-far" aria-hidden="true"></canvas>
  <canvas bind:this={nearCanvas} class="ou-scene ou-near" aria-hidden="true"></canvas>

  <!-- Where focus rests while working: not a button, so Space stays the
       hand. Clipped to nothing, and tabindex -1 keeps it out of the cycle. -->
  <div bind:this={playfield} class="sr-only" tabindex="-1" role="group" aria-label="Order up counter"></div>

  <header bind:this={hud} class="boba-hud boba-ui is-bare" aria-label="Order up status">
    <div bind:this={hudRow} class="boba-hud-row">
      <div class="boba-ticket boba-ticket-start boba-riso has-slab" style="--tilt: -1.2deg">
        <span class="boba-ticket-icon" aria-hidden="true">
          <PixelIcon grid={MENU_ICONS.orders.grid} palette={MENU_ICONS.orders.palette} px={3} />
        </span>
        <span class="boba-big">{String(score).padStart(3, "0")}</span>
        <span class="boba-stack">
          <span class="boba-meta">points</span>
          <!-- The combo: its multiplier once it climbs, and pips filling toward the next step. -->
          {#key combo.multiplier}
            <span class="boba-combo ou-combo" class:active={combo.multiplier > 1}>
              {combo.multiplier > 1 ? `×${combo.multiplier} combo` : "combo"}
              {#if combo.span}
                <span class="ou-pips" aria-hidden="true">
                  {#each Array(combo.span) as _, pip}<span class="ou-pip" class:is-used={pip >= combo.filled}></span>{/each}
                </span>
              {/if}
            </span>
          {/key}
          <ExpertTag />
        </span>
      </div>

      <div
        class="boba-ticket boba-ticket-center boba-riso"
        class:is-rush={phase === "rush"}
        style="--tilt: 1deg"
        role="timer"
        aria-label={`${timeLeft} seconds left in the shift, ${phaseLabel(phase)}`}
      >
        <CupTimer fraction={timeLeft / SHIFT_SECONDS} rush={phase === "rush"} />
        <span class="boba-big">{String(timeLeft).padStart(2, "0")}</span>
        <span class="boba-stack">
          <span class="boba-meta">seconds</span>
          <span class="boba-phase">{phaseLabel(phase)}</span>
        </span>
      </div>

      <div class="boba-ticket boba-ticket-end boba-riso" style="--tilt: -0.8deg">
        <Pearls left={lives} total={LIVES} pulse={missPulse} />
        <HudButtons {paused} on:pause={togglePause} />
      </div>
    </div>
  </header>

  <div class="ou-counter boba-ui" style={`--hud-h: ${hudHeight}px`}>
    <div bind:this={columnEl} class="ou-column">
      <!-- The rail: each guest's ticket comes up from the counter and is
           clipped here. -->
      <section class="ou-line" aria-label="Customers" style={`--cap: ${ticketCap}`}>
        <span class="ou-wire" aria-hidden="true"></span>
        <ol bind:this={lineEl} class="ou-guests" class:is-four={ticketCap > 3}>
          {#each guests as guest, index (guest.id)}
              {@const share = Math.max(0, guest.left / guest.patience)}
              {@const mood = waitingMood(share)}
              {@const mine = making?.guestId === guest.id}
              {@const critic = guest.regular.quirk === "critic"}
              {@const wanted = ICE_CUBES[guest.order.ice]}
              {@const pumpsWanted = sugarPumps(guest.order.sugar)}
              <li
                class="ou-slot"
                class:is-dim={dimOthers && litTicket !== guest.id}
                data-guest={guest.id}
                out:leave={{ guest }}
                animate:flip={{ duration: reduceMotion ? 0 : 260 }}
              >
                <button
                  type="button"
                  class="ou-guest boba-riso is-small"
                  class:has-slab={guest.placed && share <= CROSS_AT}
                  class:is-rush={guest.placed && share <= RUSH_AT}
                  class:is-making={mine}
                  class:is-hanging={!guest.placed}
                  style={`--tilt: ${guest.tilt}deg`}
                  aria-pressed={mine}
                  aria-label={guestLabel(guest, mood, mine)}
                  disabled={!guest.placed}
                  aria-keyshortcuts={String(index + 1)}
                  on:mousedown={keepFocus}
                  on:click={() => take(index)}
                >
                  <span class="ou-clip" aria-hidden="true"></span>
                  <span class="ou-head">
                    <span class="ou-who">
                      <span class="ou-name">{guest.regular.name}</span>
                      <span class="ou-tag">{guest.regular.tag}</span>
                    </span>
                    {#if !mine}
                      <kbd class="ou-key">{index + 1}</kbd>
                    {/if}
                  </span>
                  {#if mine || guest.regular.quirk || (guest.placed && share <= CROSS_AT)}
                    <span class="ou-pills">
                      {#if mine}<span class="ou-pill is-making">making</span>{/if}
                      <!-- About to walk out: said in words as well as the slab and the accent line. -->
                      {#if guest.placed && share <= CROSS_AT}<span class="ou-pill is-leaving">leaving</span>{/if}
                      {#if critic}
                        <span class="ou-pill is-star">
                          <PixelIcon grid={STAR} palette={{ O: "currentColor" }} px={2} />critic
                        </span>
                      {:else if guest.regular.quirk}
                        <span class="ou-pill">{QUIRK_NAMES[guest.regular.quirk]}</span>
                      {/if}
                    </span>
                  {/if}
                  <span class="ou-order">
                    <span class="ou-item">
                      <span class="ou-icon"><span class="ou-swatch" style={`--swatch: ${TEA_COLORS[guest.order.tea]}`}></span></span>
                      <span class="ou-long">{TEA_NAMES[guest.order.tea]}</span>
                      <span class="ou-short">{TEA_SHORT[guest.order.tea]}</span>
                      {#if guest.order.tea === special}
                        <span class="ou-star" aria-hidden="true"><PixelIcon grid={STAR} palette={{ O: "currentColor" }} px={2} /></span>
                      {/if}
                    </span>
                    <!-- The sugar: a drop per pump wanted, filling as they go in. -->
                    <span class="ou-item">
                      <span class="ou-icon ou-ice-cubes">
                        {#if pumpsWanted || (mine && sugarCount)}
                          {#each Array(Math.max(pumpsWanted, mine ? sugarCount : 0)) as _, drop}
                            <span
                              class="ou-drop"
                              class:is-empty={mine && drop >= sugarCount}
                              class:is-over={mine && drop >= pumpsWanted}
                            ></span>
                          {/each}
                        {:else}
                          <span class="ou-drop is-none"></span>
                        {/if}
                      </span>
                      <span class="ou-long">{sugarName(guest.order.sugar)}</span>
                      <span class="ou-short">{guest.order.sugar}%</span>
                    </span>
                    <!-- The ice: one cube per cube wanted. On the drink being made
                         they fill as cubes go in, and any extra shows in accent. -->
                    <span class="ou-item">
                      <span class="ou-icon ou-ice-cubes">
                        {#if wanted || (mine && iceCount)}
                          {#each Array(Math.max(wanted, mine ? iceCount : 0)) as _, cube}
                            <span
                              class="ou-cube"
                              class:is-empty={mine && cube >= iceCount}
                              class:is-over={mine && cube >= wanted}
                            ></span>
                          {/each}
                        {:else}
                          <span class="ou-cube is-none"></span>
                        {/if}
                      </span>
                      <span class="ou-long">{ICE_NAMES[guest.order.ice]}</span>
                      <span class="ou-short">{ICE_SHORT[guest.order.ice]}</span>
                    </span>
                    {#each guest.order.toppings as line}
                      <span class="ou-item">
                        <span class="ou-icon">
                          <PixelIcon grid={TOPPING_ART[line.kind].grid} palette={toppingIconPalette(line.kind)} px={small && ticketCap > 3 ? 2 : 3} />
                        </span>
                        <span class="ou-long">{TOPPING_NAMES[line.kind]} ×{line.scoops}</span>
                        <span class="ou-short">{TOPPING_SHORT[line.kind]} ×{line.scoops}</span>
                      </span>
                    {/each}
                  </span>
                  <span class="ou-patience" class:is-low={share <= CROSS_AT} style={`--left: ${share}`}></span>
                </button>
                {#if beckonGuest === guest.id && running && !paused}
                  <!-- The ticket to take: pixel brackets stepping in and out round it. -->
                  <span class="ou-beckon" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                {/if}
              </li>
          {/each}
        </ol>
        {#if running && !guests.length}
          <p class="ou-quiet">no one waiting</p>
        {/if}
      </section>

      <!-- The bench: the cup and everything that happens to it. -->
      <div class="ou-bench">
        <div bind:this={benchArt} class="ou-bench-art" style={`--taps-top: ${tapsTop}px; --taps-h: ${tapsH}px`}>
          <!-- The back bar's controls, laid over its machines: the ice bin,
               a tap for each tea (hold to pour), and the syrup bottle. Each
               button is its machine; the sticker on the glass is its label. -->
          <div bind:this={tapsEl} class="ou-taps" role="group" aria-label="Ice, taps and syrup">
            <div class="ou-tap-slot">
              <button
                bind:this={iceEl}
                type="button"
                class="ou-tap ou-ice"
                aria-label={making && iceTarget
                  ? `Add a cube of ice, ${iceCount} of ${iceTarget} in the cup`
                  : `Add a cube of ice, ${iceCount} in the cup`}
                aria-keyshortcuts="ArrowUp"
                disabled={!iceOpen}
                on:mousedown={keepFocus}
                on:click={() => addIce()}
              ></button>
              {#if iceOpen && iceCount > 0}
                <button
                  type="button"
                  class="boba-key ou-chip"
                  class:is-dim={dimOthers && !litLess}
                  aria-label="Take a cube of ice out"
                  aria-keyshortcuts="ArrowDown"
                  on:mousedown={keepFocus}
                  on:click={removeIce}
                >
                  Less
                </button>
              {/if}
            </div>
            {#each TEAS as tea, index}
              {@const brewNow = brewing[index]}
              {@const tank = tankStates[index]}
              <div class="ou-tap-slot">
                <button
                  bind:this={tapEls[index]}
                  type="button"
                  class="ou-tap"
                  aria-pressed={!!making && tapIndex === index}
                  aria-label={tapLabel(index, special, brewing, tankStates)}
                  disabled={!tapLive(index, making)}
                  on:mousedown={keepFocus}
                  on:pointerdown={(event) => tapDown(event, index)}
                  on:pointerup={() => endHold("tap", true)}
                  on:pointercancel={() => endHold("tap", false)}
                  on:lostpointercapture={() => endHold("tap", false)}
                  on:keydown={(event) => tapKey(event, index, true)}
                  on:keyup={(event) => tapKey(event, index, false)}
                  on:blur={() => endKeyHolds("tap-key")}
                  on:contextmenu={(event) => event.preventDefault()}
                >
                  <!-- Today's special: a star by the lid. Brewing: a bar
                       filling along the foot. -->
                  {#if tea === special}
                    <span class="ou-tap-star" class:is-dim={dimOthers && litTap !== index} aria-hidden="true"><PixelIcon grid={STAR} palette={{ O: "currentColor" }} px={2} /></span>
                  {/if}
                  {#if brewNow >= 0}
                    <span class="ou-brew-bar" style={`--done: ${brewNow}`} aria-hidden="true"></span>
                  {/if}
                </button>
                {#if brewNow < 0 && tank !== "ok"}
                  <button
                    bind:this={brewEls[index]}
                    type="button"
                    class="boba-key ou-chip"
                    class:is-dim={dimOthers && litTap !== index}
                    aria-label={`Brew ${TEA_NAMES[tea]}`}
                    disabled={!running}
                    on:mousedown={keepFocus}
                    on:click={() => brew(index)}
                  >
                    Brew
                  </button>
                {/if}
              </div>
            {/each}
            <div class="ou-tap-slot">
              <button
                bind:this={syrupEl}
                type="button"
                class="ou-tap ou-syrup"
                aria-label={making && sugarTarget
                  ? `Pump the syrup, ${sugarCount} of ${sugarTarget} pumps in`
                  : "Pump the syrup"}
                disabled={!syrupOpen}
                on:mousedown={keepFocus}
                on:click={() => pumpSyrup()}
              ></button>
            </div>
          </div>
          <canvas
            bind:this={canvas}
            class="ou-canvas"
            aria-hidden="true"
            on:pointerdown={benchDown}
            on:pointerup={() => endHold("bench", true)}
            on:pointercancel={() => endHold("bench", false)}
            on:lostpointercapture={() => endHold("bench", false)}
            on:contextmenu={(event) => event.preventDefault()}
          ></canvas>
          <!-- The live region carries the same news, so this copy is hidden. -->
          {#if receipt}
            {#key receipt.id}
              <div
                bind:this={receiptEl}
                class="ou-receipt boba-riso is-small"
                class:is-dim={dimOthers && !litReceipt}
                style={`--x: ${Math.round(receipt.x)}px`}
                aria-hidden="true"
              >
                {#if receipt.perfect}
                  <span class="ou-stamp is-perfect">perfect</span>
                {/if}
                <div class="ou-receipt-main">
                  <p class="ou-receipt-for">for {receipt.name}</p>
                  {#if receipt.sentBack}
                    <p class="ou-receipt-points">sent back</p>
                  {:else}
                    <p class="ou-receipt-points">+{receipt.points}</p>
                    {#if receipt.stamps.length}
                      <span class="ou-stamps">
                        {#each receipt.stamps as text, order}
                          <span class="ou-stamp" style={`--turn: ${order % 2 ? 5 : -8}deg; --delay: ${120 + order * 90}ms`}>{text}</span>
                        {/each}
                      </span>
                    {/if}
                    {#if receipt.combo > 0}
                      <span bind:this={streakEl} class="ou-receipt-streak">×{receipt.combo} combo</span>
                    {/if}
                  {/if}
                  {#if receipt.line}<p class="ou-receipt-line">{receipt.line}</p>{/if}
                </div>
                {#if receipt.rows.length}
                  <dl class="ou-receipt-rows">
                    {#each receipt.rows as row}
                      <div>
                        <dt>{row.label}</dt>
                        <dd>{row.word}</dd>
                      </div>
                    {/each}
                  </dl>
                {/if}
              </div>
            {/key}
          {/if}
        </div>

        <!-- The drink being made, pinned under the cup: its stations in the
             order it is built, with what each wants (the syrup's pumps, the
             ice's cubes, the tea, the scoops), the one at hand marked and the
             ones behind graded; and under them the guest's patience. It earns
             a slab when they are about to leave, and jitters near the end. -->
        <div
          bind:this={cardEl}
          class="ou-card boba-riso is-small"
          class:has-slab={!!making && makingShare <= CROSS_AT}
          class:is-rush={!!making && makingShare <= RUSH_AT}
          class:is-dim={dimOthers && !litCard}
        >
          <ol class="ou-steps" class:is-idle={!making} aria-label="The drink">
            {#each steps as step (step.id)}
              <li
                class="ou-step"
                data-step={step.id}
                class:is-current={!!making && step.state === "current"}
                class:is-done={step.state === "done"}
                aria-current={making && step.state === "current" ? "step" : undefined}
              >
                {#if making && step.state === "current"}<Mark kind="caret" />{/if}
                {#if making && step.id === "sugar"}
                  <span class="ou-cubes" aria-hidden="true">
                    {#each Array(Math.max(sugarTarget, sugarCount)) as _, drop}
                      <span class="ou-drop" class:is-empty={drop >= sugarCount} class:is-over={drop >= sugarTarget}></span>
                    {/each}
                  </span>
                {:else if making && step.id === "ice"}
                  <span class="ou-cubes" aria-hidden="true">
                    {#each Array(Math.max(iceTarget, iceCount)) as _, cube}
                      <span class="ou-cube" class:is-empty={cube >= iceCount} class:is-over={cube >= iceTarget}></span>
                    {/each}
                  </span>
                {:else if making && step.id === "pour"}
                  <span class="ou-swatch" style={`--swatch: ${TEA_COLORS[making.order.tea]}`} aria-hidden="true"></span>
                {:else if making && step.id === "scoop"}
                  {#each making.order.toppings as line}
                    <span class="ou-card-scoop" aria-hidden="true">
                      <PixelIcon grid={TOPPING_ART[line.kind].icon} palette={toppingIconPalette(line.kind)} px={2} />×{line.scoops}
                    </span>
                  {/each}
                {/if}
                <span>{step.label}</span>
                {#if making}<span class="sr-only">{stepAmount(making, step.id)}</span>{/if}
                {#if step.word}<span class="ou-step-word">{step.word}</span>{/if}
              </li>
            {/each}
          </ol>
          <!-- Who it's for and their patience; a notice takes the name's
               place, never the patience. -->
          <p class="ou-card-foot">
            {#if notice}
              <span class="ou-card-notice">{notice.text}</span>
            {:else if making}
              <span class="ou-card-for">for {making.name}</span>
            {/if}
            {#if making}
              <span
                class="ou-card-patience"
                class:is-low={makingShare <= CROSS_AT}
                style={`--left: ${makingShare}`}
                role="meter"
                aria-label={`${making.name}'s patience`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(makingShare * 10) * 10}
              ></span>
              {#if makingShare <= CROSS_AT}<span class="ou-card-leaving">leaving</span>{/if}
            {/if}
          </p>
        </div>
      </div>

      <!-- The hand: one big key for whatever the station needs, then the
           dump and the free samples, set on the counter as pixel keys. -->
      <div class="ou-hand">
        <button
          bind:this={handEl}
          type="button"
          class="boba-key is-primary ou-hand-btn"
          class:is-lit={handLit}
          class:is-down={handHeld}
          class:is-dim={dimOthers && !litHand}
          disabled={!handLive}
          on:mousedown={keepFocus}
          on:pointerdown={(event) => handDown(event, "hand")}
          on:pointerup={() => endHold("hand", true)}
          on:pointercancel={() => endHold("hand", false)}
          on:lostpointercapture={() => endHold("hand", false)}
          on:keydown={(event) => handKey(event, true)}
          on:keyup={(event) => handKey(event, false)}
          on:blur={() => endKeyHolds("hand-key")}
          on:contextmenu={(event) => event.preventDefault()}
        >
          {handLabel}
          {#if making?.station === "ice"}
            <!-- The cubes the ticket wants, filling as each goes in. -->
            <span class="ou-cubes is-hand" aria-hidden="true">
              {#each Array(Math.max(iceTarget, iceCount)) as _, cube}
                <span class="ou-cube" class:is-empty={cube >= iceCount} class:is-over={cube >= iceTarget}></span>
              {/each}
            </span>
          {:else if making?.station === "sugar"}
            <!-- The pumps the ticket wants, filling as each goes in. -->
            <span class="ou-cubes is-hand" aria-hidden="true">
              {#each Array(Math.max(sugarTarget, sugarCount)) as _, drop}
                <span class="ou-drop" class:is-empty={drop >= sugarCount} class:is-over={drop >= sugarTarget}></span>
              {/each}
            </span>
          {/if}
          {#if handLive}<kbd aria-hidden="true">Space</kbd>{/if}
        </button>
        <button
          type="button"
          class="boba-key"
          class:is-dim={dimOthers}
          aria-keyshortcuts="Backspace"
          disabled={!handLive}
          on:mousedown={keepFocus}
          on:click={dump}
        >
          Dump <kbd aria-hidden="true">⌫</kbd>
        </button>
        <button
          bind:this={sampleEl}
          type="button"
          class="boba-key ou-sample"
          class:is-lit={sampleLit}
          class:is-dim={dimOthers && !litSample}
          aria-keyshortcuts="S"
          aria-label={`Sample for the guest closest to leaving, ${samplesLeft} left`}
          disabled={!canSample}
          on:mousedown={keepFocus}
          on:click={giveSample}
        >
          Sample
          <span class="ou-pips" aria-hidden="true">
            {#each Array(sampleCap) as _, pip}<span class="ou-pip" class:is-used={pip >= samplesLeft}></span>{/each}
          </span>
          <kbd aria-hidden="true">S</kbd>
        </button>
      </div>
    </div>
  </div>
  <!-- The lesson, beside the station or the thing it is about: inside the
       game's own scope, so Tab reaches its Continue. -->
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
    hidden={paused || gameOver}
    top={coachTop}
    touch={touchUI}
    continuable={!!coachLesson && coachOpen}
    on:continue={continueLesson}
    returnFocus={focusPlayfield}
  />
</div>

<!-- Tickets on their way from a guest's hand up to the rail. -->
<div class="ou-flights boba-ui" aria-hidden="true">
  {#each flights as flight (flight.id)}
    <span
      class="ou-flight boba-riso is-small"
      style={`transform: translate(${flight.fx}px, ${flight.fy}px) translate(-50%, 0) rotate(${flight.turn}deg) scale(${flight.scale})`}
    >
      <span class="ou-flight-lines"></span>
    </span>
  {/each}
</div>

{#if countdown > 0 || goVisible}
  <Countdown value={countdown} />
{/if}


{#if paused && !gameOver}
  <PauseCard
    bind:this={pauseCard}
    resumeLabel="Resume shift"
    on:resume={resumeGame}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

{#if gameOver}
  <ResultsSlip
    bind:this={slip}
    game="orders"
    title={endReason === "time" ? "shift complete" : "kitchen’s closed"}
    deck={endReason === "time" ? "" : "Three guests left without a drink."}
    {score}
    {newBest}
    stats={[
      { label: "drinks served", value: served },
      { label: "average grade", value: served ? averageGrade : "–" },
      { label: "longest streak", value: bestStreak },
      { label: "tip jars filled", value: jarsCashed },
      { label: "personal best", value: localBest },
    ]}
    share={shareLines}
    on:restart={restart}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>

<style>
  .ou-game {
    display: contents;
  }

  /* Under the room, in its afternoon wall colour, in case a frame shows first. */
  .ou-stage {
    background: #d9c7ae;
  }

  .ou-scene {
    position: fixed;
    inset: 0;
    z-index: var(--layer-overlay);
    pointer-events: none;
  }

  /* The room recedes like a shallow depth of field, so the bench reads
     first: the street through the window softest, the room a little muted.
     CSS filters rather than the canvas's own, so Safari matches. */
  .ou-far {
    filter: blur(1.5px) saturate(0.6) contrast(0.9);
  }

  .ou-near {
    filter: saturate(0.8);
  }

  /* No paper wash behind the tickets: they sit on the ceiling. The shared
     sheet carries the same rule; this keeps it if that changes. */
  .boba-hud.is-bare::before {
    content: none;
  }

  .ou-counter {
    position: fixed;
    inset: 0;
    z-index: calc(var(--layer-overlay) + 1);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: calc(var(--hud-h) + var(--space-4)) var(--space-6) max(var(--space-5), env(safe-area-inset-bottom));
    /* Only when nothing else fits (a huge text zoom) does the counter scroll,
       inside itself; the page underneath never does. */
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .ou-column {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-4);
    width: min(100%, 46rem);
  }

  /* --- The line --- */

  /* The rail, and the tickets clipped to it. The rail and the clips belong
     to the room, which keeps its colours in both themes. */
  .ou-line {
    position: relative;
    flex: none;
    padding-top: var(--space-3);
  }

  .ou-wire {
    position: absolute;
    inset: var(--space-1) 0 auto;
    z-index: 1;
    height: 2px;
    background: #2b2320;
  }

  .ou-guests {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: repeat(var(--cap, 3), minmax(0, 1fr));
    align-items: start;
    gap: var(--space-4);
    min-height: 9.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ou-slot {
    position: relative;
    min-width: 0;
  }

  /* The ticket to take, while the walk-through waits for it: four pixel
     corner brackets in the accent round the slip, stepping out a cell and
     back in (still under Reduce Motion). */
  .ou-beckon {
    position: absolute;
    inset: -0.5rem;
    z-index: 3;
    pointer-events: none;
    animation: ou-beckon 0.9s steps(1, end) infinite;
  }

  .ou-beckon i {
    position: absolute;
    width: 9px;
    height: 9px;
    border: 0 solid #e85d4c;
  }

  .ou-beckon i:nth-child(1) {
    top: 0;
    left: 0;
    border-width: 3px 0 0 3px;
  }

  .ou-beckon i:nth-child(2) {
    top: 0;
    right: 0;
    border-width: 3px 3px 0 0;
  }

  .ou-beckon i:nth-child(3) {
    bottom: 0;
    left: 0;
    border-width: 0 0 3px 3px;
  }

  .ou-beckon i:nth-child(4) {
    right: 0;
    bottom: 0;
    border-width: 0 3px 3px 0;
  }

  @keyframes ou-beckon {
    50% {
      inset: -0.75rem;
    }
  }

  .ou-guest {
    display: grid;
    gap: var(--space-1-5);
    width: 100%;
    padding: var(--space-3) var(--space-3) var(--space-2-5);
    color: var(--b-text);
    background: none;
    border: 0;
    border-radius: 12px 16px 11px 14px;
    cursor: pointer;
    font: inherit;
    text-align: left;
    touch-action: manipulation;
    transform: rotate(var(--tilt));
    transform-origin: 50% 0;
    transition:
      transform var(--motion-base) var(--ease-emphasized),
      opacity var(--motion-fast) var(--ease-standard);
  }

  /* The cup on the bench is theirs: the ticket lifts off the rail. */
  .ou-guest.is-making {
    transform: translateY(-3px) rotate(var(--tilt));
  }

  /* Still on its way up from the guest's hand: once it reaches the rail it
     unfolds down from its clip. */
  .ou-guest.is-hanging {
    opacity: 0;
    pointer-events: none;
    transform: rotate(var(--tilt)) scaleY(0.15);
  }

  .ou-clip {
    position: absolute;
    top: calc(var(--space-2) * -1 - 1px);
    left: 50%;
    width: 1.25rem;
    height: 0.75rem;
    background: #2b2320;
    border-radius: 2px 2px 0 0;
    transform: translateX(-50%);
  }

  .ou-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .ou-who {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .ou-name {
    overflow: hidden;
    color: var(--b-strong);
    font-size: 0.9375rem;
    font-weight: 500;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The tag runs to two lines at most. */
  .ou-tag {
    display: -webkit-box;
    overflow: hidden;
    color: var(--b-muted);
    font-size: 0.75rem;
    font-style: italic;
    line-height: 1.25;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .ou-key {
    align-self: start;
    flex: none;
    font-size: 0.75rem;
    line-height: 1.25;
    padding: 0 var(--space-1);
    color: var(--b-strong);
    background: var(--b-wash);
    border-radius: var(--radius-control);
    font-family: inherit;
  }

  /* Pills under the name: whose cup is on the bench, and any quirk. They sit
     side by side and wrap. */
  .ou-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .ou-pill {
    padding: 0 var(--space-1-5);
    color: var(--b-text);
    border: 1px solid var(--b-rule);
    border-radius: 999px;
    font-size: 0.6875rem;
    line-height: 1.4;
    white-space: nowrap;
  }

  .ou-pill.is-making {
    color: var(--b-strong);
    border-color: var(--b-line);
    font-weight: 500;
  }

  .ou-pill.is-leaving {
    color: var(--b-accent);
    border-color: currentColor;
    font-weight: 500;
  }

  .ou-order {
    display: grid;
    gap: var(--space-0-5);
    color: var(--b-text);
    font-size: 0.75rem;
    line-height: 1.3;
  }

  .ou-item {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .ou-icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 0.875rem;
    color: var(--b-line);
  }

  .ou-swatch {
    width: 0.75rem;
    height: 0.75rem;
    background: var(--swatch);
    border: 1.5px solid var(--b-line);
    border-radius: 2px;
  }

  .ou-cube {
    flex: none;
    width: 0.4375rem;
    height: 0.4375rem;
    background: #8ec9e0;
    border: 1px solid var(--b-line);
  }

  /* A cube still to go in: an empty dotted slot, like the cup's marks. */
  .ou-cube.is-empty {
    background: transparent;
    border: 1px dotted var(--b-muted);
  }

  /* One more than the ticket asked for. */
  .ou-cube.is-over {
    background: var(--b-accent);
    border-style: solid;
  }

  /* No ice: a cube struck through. */
  .ou-cube.is-none {
    background: linear-gradient(to top right, transparent 42%, var(--b-line) 42% 62%, transparent 62%);
  }

  .ou-icon.ou-ice-cubes {
    justify-content: flex-start;
    width: auto;
    min-width: 0.875rem;
  }

  /* Patience is a pencil line that shortens, turning accent near the end
     (when the face is already frowning, so colour never says it alone). */
  /* Thick enough to read at a glance from the bench. */
  .ou-patience {
    height: 5px;
    margin-top: var(--space-0-5);
    background: var(--b-line);
    border-radius: 2px;
    transform: scaleX(var(--left));
    transform-origin: left;
    transition: transform 100ms linear;
  }

  .ou-patience.is-low {
    background: var(--b-accent);
  }

  .ou-quiet {
    position: absolute;
    z-index: 2;
    top: var(--space-8);
    left: 50%;
    margin: 0;
    padding: var(--space-0-5) var(--space-2);
    background: var(--b-paper);
    border: 1px solid var(--b-rule);
    border-radius: var(--radius-inline);
    transform: translateX(-50%);
    white-space: nowrap;
    color: var(--b-muted);
    font-size: 0.875rem;
    font-style: italic;
    text-align: center;
  }

  /* --- The back bar's buttons ---
     Laid over the machines the bench draws: each button is its machine, and
     its face is the machine's label plate. */

  .ou-taps {
    position: absolute;
    z-index: 2;
    top: var(--taps-top);
    right: 0;
    left: 0;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--space-3);
    height: var(--taps-h);
  }

  /* A machine and, when its tank wants it, a Brew chip at the shelf. */
  .ou-tap-slot {
    position: relative;
    display: grid;
    min-width: 0;
  }

  .ou-tap {
    position: relative;
    display: block;
    padding: 0;
    color: var(--b-strong);
    background: none;
    border: 0;
    border-radius: var(--radius-control);
    cursor: pointer;
    font: inherit;
    line-height: 1.25;
    touch-action: none;
    -webkit-touch-callout: none;
  }

  /* The buttons draw nothing of their own: the machine under each is the
     button, its sticker the label. Focus still shows its ring. */
  .ou-tap:disabled {
    cursor: default;
  }

  /* Short names only on a phone. */
  .ou-short {
    display: none;
  }

  /* Today's special: a small star just over its machine's lid. */
  .ou-tap-star {
    position: absolute;
    top: 0;
    left: 50%;
    display: inline-flex;
    color: #c9462f;
    transform: translate(-50%, -110%);
  }

  /* Brew and Less: a small pixel key straddling the machine's bottom edge. */
  .ou-chip {
    position: absolute;
    z-index: 1;
    inset: auto 0 -0.625rem;
    width: fit-content;
    min-height: 1.375rem;
    margin-inline: auto;
    padding: 0 var(--space-2) 4px;
    font-size: 0.6875rem;
  }

  .ou-pill.is-star {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .ou-pill.is-star :global(.pixel-icon) {
    color: var(--b-accent);
  }

  /* Brewing: a thin bar fills along the foot. */
  .ou-brew-bar {
    position: absolute;
    inset: auto 0 0;
    height: 3px;
    background: var(--b-line);
    transform: scaleX(var(--done));
    transform-origin: left;
    transition: transform 100ms linear;
  }

  .ou-cubes {
    display: inline-flex;
    gap: 2px;
  }

  /* A pump of syrup: a drop, filled as it goes in. */
  .ou-drop {
    flex: none;
    width: 0.375rem;
    height: 0.4375rem;
    background: #c98a2e;
    border: 1px solid var(--b-line);
    border-radius: 50% 50% 45% 45% / 60% 60% 40% 40%;
  }

  .ou-drop.is-empty {
    background: transparent;
    border: 1px dotted var(--b-muted);
  }

  .ou-drop.is-over {
    background: var(--b-accent);
    border-style: solid;
  }

  .ou-drop.is-none {
    background: linear-gradient(to top right, transparent 42%, var(--b-line) 42% 62%, transparent 62%);
  }

  .ou-cubes.is-hand .ou-drop {
    width: 0.5rem;
    height: 0.5625rem;
    border-color: currentColor;
  }

  /* Tickets in the air between a guest's hand and the rail. */
  .ou-flights {
    position: fixed;
    inset: 0;
    z-index: calc(var(--layer-overlay) + 2);
    pointer-events: none;
  }

  .ou-flight {
    position: absolute;
    top: 0;
    left: 0;
    width: 2.5rem;
    height: 3rem;
    transform-origin: 50% 0;
  }

  .ou-flight-lines {
    position: absolute;
    inset: 0.65rem 0.45rem auto;
    height: 1rem;
    background: repeating-linear-gradient(var(--b-line) 0 1.5px, transparent 1.5px 5px);
    opacity: 0.55;
  }

  /* On the hand at the ice: a little larger, on the ink face. */
  .ou-cubes.is-hand {
    gap: 3px;
    margin-left: var(--space-1);
  }

  .ou-cubes.is-hand .ou-cube {
    width: 0.5625rem;
    height: 0.5625rem;
    border-color: currentColor;
  }

  .ou-cubes.is-hand .ou-cube.is-empty {
    border-style: dotted;
  }

  /* The score ticket's combo: the word, then its pips. */
  .ou-combo {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .ou-combo .ou-pip {
    width: 0.375rem;
    height: 0.375rem;
  }

  .ou-star {
    display: inline-flex;
    margin-left: calc(var(--space-1) * -0.5);
    color: var(--b-accent);
  }

  /* --- The bench --- */

  .ou-bench {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: var(--space-1-5);
    /* Grows into whatever height is left, up to a composed size; never
       shrinks below its own content, so it can't slide under the hand. */
    min-height: min-content;
    max-height: 28rem;
  }

  .ou-bench-art {
    position: relative;
    display: grid;
    flex: 1 1 0;
    place-items: center;
    /* Never shorter than this: the cup, the ladle and the gauge need it. */
    min-height: 11rem;
  }

  .ou-canvas {
    position: absolute;
    inset: 0;
    cursor: pointer;
    touch-action: none;
    -webkit-touch-callout: none;
  }

  /* Up on the wall over the guest who took the drink (--x, their place on
     the bench), held inside the bench at either end. */
  .ou-receipt {
    --receipt-w: min(100%, 22rem);

    position: relative;
    z-index: 3;
    display: flex;
    grid-area: 1 / 1;
    align-self: start;
    justify-self: start;
    align-items: start;
    gap: var(--space-5);
    width: var(--receipt-w);
    margin-left: clamp(0px, calc(var(--x, 50%) - 11rem), calc(100% - 22rem));
    padding: var(--space-3) var(--space-4);
    pointer-events: none;
    transform: rotate(-0.8deg);
    animation: ou-slip-in var(--motion-slow) var(--ease-emphasized) both;
  }

  .ou-receipt-main {
    position: relative;
    display: grid;
    flex: 1;
    align-content: start;
    gap: var(--space-1);
    min-width: 0;
  }

  .ou-receipt-for {
    margin: 0;
    color: var(--b-muted);
    font-size: 0.75rem;
    line-height: 1.25;
  }

  .ou-receipt-points {
    margin: 0;
    color: var(--b-strong);
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 500;
    line-height: 1.1;
  }

  .ou-receipt-streak {
    color: var(--b-accent);
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.25;
  }

  .ou-receipt-line {
    margin: 0;
    color: var(--b-text);
    font-size: 0.8125rem;
    font-style: italic;
    line-height: 1.35;
  }

  .ou-stamps {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-2);
    margin: var(--space-0-5) 0 var(--space-1);
  }

  .ou-stamp {
    display: inline-block;
    padding: 0 var(--space-1-5);
    color: var(--b-accent);
    border: 2px solid currentColor;
    border-radius: 3px 8px 4px 9px;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.4;
    white-space: nowrap;
    transform: rotate(var(--turn, -8deg));
    filter: url(#boba-rough-fine);
    animation: ou-stamp-in var(--motion-slow) var(--ease-emphasized) var(--delay, 120ms) both;
  }

  .ou-stamp.is-perfect {
    position: absolute;
    top: calc(var(--space-2) * -1);
    right: var(--space-3);
    background: var(--b-paper);
    transform: rotate(6deg);
    animation-name: ou-perfect-in;
  }

  @keyframes ou-perfect-in {
    from {
      opacity: 0;
      transform: rotate(14deg) scale(1.6);
    }
  }

  .ou-receipt-rows {
    display: grid;
    flex: 1;
    gap: var(--space-1);
    margin: 0;
    padding-left: var(--space-4);
    border-left: 1px dashed var(--b-rule);
    font-size: 0.75rem;
    line-height: 1.3;
  }

  .ou-receipt-rows div {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .ou-receipt-rows dt {
    display: flex;
    flex: 1;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
    color: var(--b-muted);
    white-space: nowrap;
  }

  /* Dot leaders, like the results receipt. */
  .ou-receipt-rows dt::after {
    content: "";
    flex: 1;
    min-width: var(--space-3);
    border-bottom: 1px dotted var(--b-muted);
    opacity: 0.6;
  }

  .ou-receipt-rows dd {
    margin: 0;
    color: var(--b-strong);
    font-weight: 500;
    white-space: nowrap;
  }

  @keyframes ou-slip-in {
    from {
      opacity: 0;
      transform: translateY(10px) rotate(-3deg);
    }
  }

  @keyframes ou-stamp-in {
    from {
      opacity: 0;
      transform: rotate(-16deg) scale(1.6);
    }
  }

  /* --- Stepper and prompt --- */

  /* The making card: the drink on the bench as a ticket pinned under the
     cup. One row of its stations, one of the guest and their patience, at
     every width, so the bench above never changes height mid-drink. */
  .ou-card {
    --tilt: -0.4deg;

    display: grid;
    flex: none;
    gap: var(--space-1);
    align-self: center;
    max-width: 100%;
    padding: var(--space-1-5) var(--space-3);
  }

  /* The card's paper sits a little crooked, like a pinned ticket; its text stays level. */
  .ou-card::after {
    transform: rotate(var(--tilt));
  }

  .ou-steps {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    gap: var(--space-1) var(--space-4);
    margin: 0;
    padding: 0;
    color: var(--b-muted);
    font-size: 0.8125rem;
    line-height: 1.3;
    list-style: none;
  }

  .ou-steps.is-idle {
    opacity: 0.55;
  }

  .ou-step {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    white-space: nowrap;
  }

  .ou-step.is-current {
    color: var(--b-strong);
    font-weight: 500;
  }

  .ou-step.is-done {
    color: var(--b-muted);
  }

  .ou-step-word {
    color: var(--b-text);
    font-style: italic;
  }

  .ou-card-scoop {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    font-size: 0.6875rem;
  }

  .ou-card-foot {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 1.35em;
    margin: 0;
    overflow: hidden;
    white-space: nowrap;
    color: var(--b-muted);
    font-size: 0.8125rem;
    font-style: italic;
    line-height: 1.35;
  }

  .ou-card-notice {
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--b-strong);
  }

  /* The guest's patience, as on their ticket but where the eye already is. */
  .ou-card-patience {
    flex: 0 1 8rem;
    height: 5px;
    background: var(--b-line);
    border-radius: 2px;
    transform: scaleX(var(--left));
    transform-origin: left;
    transition: transform 100ms linear;
  }

  .ou-card-patience.is-low {
    background: var(--b-accent);
  }

  .ou-card-leaving {
    color: var(--b-accent);
    font-style: normal;
    font-weight: 500;
  }

  /* The lesson's spotlight, on the page's own pieces: what the lesson isn't
     about dims with the shop. */
  .is-dim {
    filter: brightness(0.62) saturate(0.85);
  }

  /* Whatever has focus keeps full contrast, ring and all. */
  .is-dim:focus-visible,
  .is-dim:focus-within {
    filter: none;
  }

  .ou-card,
  .ou-receipt,
  .ou-slot,
  .ou-tap-star {
    transition: filter 180ms var(--ease-standard);
  }

  /* Keys press at once (pixel things step); only the dim eases. */
  .ou-hand > .boba-key,
  .ou-chip {
    transition: filter 180ms var(--ease-standard);
  }

  /* --- The hand --- */

  /* The keys throw a hard shadow on the wood below them. It is cast by the
     row, since a key's own filter would be cut away by its stepped outline. */
  .ou-hand {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    filter: drop-shadow(0 3px 0 rgb(20 10 6 / 0.45));
  }

  /* The hand's keys are set on the counter's wood: the shared pixel key
     (dark face, a foot it presses into, the hand's face in the accent), in
     a row like the labels they replace, at the same sizes. */
  .ou-hand .boba-key {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: var(--space-1-5);
    min-height: 2.5rem;
    padding: 0 var(--space-4) 4px;
    white-space: nowrap;
  }

  .ou-hand .boba-key:not(:disabled):is(:active, .is-down) {
    padding-bottom: 2px;
  }

  /* The shared ring is the accent, which vanishes on the hand's accent face: there it is cream. */
  .ou-hand .boba-key.is-primary:focus-visible {
    box-shadow:
      inset 0 0 0 2px #fdf8f3,
      inset 0 -4px 0 var(--key-foot);
  }

  /* On touch, the pad a lesson is about: a cream ring inside its face, like a finger on it. */
  .ou-hand .boba-key.is-lit {
    box-shadow:
      inset 0 0 0 3px #fdf8f3,
      inset 0 -4px 0 var(--key-foot);
  }

  .ou-hand .boba-key.is-lit:not(:disabled):is(:active, .is-down) {
    box-shadow:
      inset 0 0 0 3px #fdf8f3,
      inset 0 -2px 0 var(--key-foot);
  }

  /* On the hand's accent face, a mark past what the ticket asked for prints dark. */
  .ou-cubes.is-hand :is(.ou-cube, .ou-drop).is-over {
    background: #2a2422;
  }

  .ou-pips {
    display: inline-flex;
    gap: 3px;
  }

  .ou-pip {
    width: 0.4375rem;
    height: 0.4375rem;
    background: currentColor;
    border: 1.5px solid currentColor;
    border-radius: 50%;
  }

  .ou-pip.is-used {
    background: transparent;
  }

  .ou-hand .ou-hand-btn {
    min-width: min(15rem, 50%);
    min-height: 3.5rem;
    padding-inline: var(--space-6);
    touch-action: none;
    -webkit-touch-callout: none;
  }

  /* Touch devices have no keys to hint at. */
  @media (hover: none) and (pointer: coarse) {
    .ou-key {
      display: none;
    }
  }

  /* --- Phones ---
     The vertical budget at 375 x 640, in px: HUD two rows (104) + 8, line
     (10 + about 104 for the cards), taps (48), bench (canvas at least 176,
     4, making card about 43), hand (44), three 8px gaps, 8 at the foot. That is
     about 460, leaving room for a card with a fourth order line; anything
     spare goes to the bench. */

  @media (max-width: 640px), (orientation: landscape) and (max-height: 28rem) {
    .ou-counter {
      padding: calc(var(--hud-h) + var(--space-2)) var(--space-4) max(var(--space-2), env(safe-area-inset-bottom));
    }

    .ou-column {
      gap: var(--space-2);
    }

    .ou-line {
      padding-top: var(--space-2-5);
    }

    .ou-guests {
      gap: var(--space-2);
      min-height: 6.5rem;
    }

    .ou-guest {
      gap: 0.1875rem;
      padding: var(--space-1-5) var(--space-1-5) var(--space-1);
      line-height: 1.15;
    }

    .ou-head {
      gap: var(--space-1);
    }

    .ou-name {
      font-size: 0.8125rem;
      line-height: 1.15;
    }

    /* Three cards to a 375px row: no tags; the pills carry what matters. */
    .ou-tag {
      display: none;
    }

    /* `making` and the quirk share one row; the quirk gives way first. */
    .ou-pills {
      flex-wrap: nowrap;
      gap: 3px;
      min-width: 0;
    }

    .ou-pill {
      flex: none;
      padding: 0 3px;
      font-size: 0.625rem;
      line-height: 1.3;
    }

    .ou-pill:not(.is-making) {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ou-order {
      gap: 0;
      font-size: 0.6875rem;
      line-height: 1.15;
    }

    .ou-item {
      gap: var(--space-1);
    }

    .ou-order .ou-cube {
      width: 0.3125rem;
      height: 0.3125rem;
    }

    .ou-ice-cubes {
      gap: 1px;
    }

    /* Four to a row (expert): tighter tickets and smaller print. */
    .ou-guests.is-four {
      gap: var(--space-1);
    }

    .is-four .ou-guest {
      padding-inline: var(--space-1);
    }

    .is-four .ou-order {
      font-size: 0.625rem;
    }

    .is-four .ou-item {
      gap: 3px;
    }

    .ou-patience {
      margin-top: 0;
    }

    .ou-quiet {
      top: var(--space-6);
    }

    .ou-taps {
      gap: var(--space-1-5);
    }

    /* Six across: short labels. */
    .ou-long {
      display: none;
    }

    .ou-short {
      display: inline;
    }


    .ou-chip {
      padding-inline: var(--space-1-5);
    }

    .ou-bench {
      gap: var(--space-1);
    }

    /* The making card, tight: its lines in three columns and two rows, so
       a long expert drink never runs off the side and the card keeps one
       height. A finished line shows its grade in place of its marks. */
    .ou-card {
      gap: 2px;
      padding: var(--space-1) var(--space-2-5);
    }

    .ou-steps {
      display: grid;
      grid-template-columns: repeat(3, auto);
      justify-content: center;
      gap: 2px var(--space-3);
      min-height: calc(2.6em + 2px);
      font-size: 0.6875rem;
    }

    .ou-step.is-done :is(.ou-cubes, .ou-swatch, .ou-card-scoop) {
      display: none;
    }

    .ou-card-foot {
      font-size: 0.6875rem;
    }

    .ou-receipt {
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
    }

    .ou-receipt-rows {
      gap: 0;
      padding-left: var(--space-3);
      line-height: 1.25;
    }

    .ou-hand {
      gap: var(--space-2);
    }

    .ou-hand .boba-key {
      flex: none;
      padding-inline: var(--space-2-5);
    }

    /* The hand takes whatever width the other two leave. */
    .ou-hand .ou-hand-btn {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 2.75rem;
    }
  }

  /* Keep tickets, machines and the hand within reach on a sideways phone. */
  @media (orientation: landscape) and (max-height: 28rem) {
    .ou-counter {
      padding-block: calc(var(--hud-h) + var(--space-1)) max(var(--space-1), env(safe-area-inset-bottom));
    }

    .ou-column {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 5fr);
      grid-template-rows: minmax(min-content, 1fr) auto;
      column-gap: var(--space-4);
    }

    .ou-line {
      grid-row: span 2;
      align-self: start;
    }

    .ou-guests,
    .ou-guests.is-four {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      row-gap: var(--space-4);
    }

    .ou-bench-art {
      min-height: 9rem;
    }

    .ou-hand .boba-key {
      min-height: 2.75rem;
    }
  }

  @media (min-width: 33rem) and (max-width: 640px) and (orientation: landscape) and (max-height: 28rem) {
    .boba-hud-row {
      grid-template-columns: auto auto auto;
      gap: var(--space-2);
    }

    .boba-ticket-center {
      grid-area: 1 / 2;
    }

    .boba-ticket-end {
      grid-column: 3;
    }
  }

  /* Three buttons to a 375px row: the key chips give way first. */
  @media (max-width: 420px) {
    .ou-hand kbd {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ou-receipt,
    .ou-stamp,
    .ou-beckon {
      animation: none;
    }

    .ou-guest,
    .ou-tap,
    .ou-patience,
    .ou-card-patience,
    .ou-brew-bar,
    .ou-card,
    .ou-hand > .boba-key,
    .ou-slot,
    .ou-chip,
    .ou-tap-star {
      transition: none;
    }

    /* A pressed key still sinks into its foot, without travelling. */
    .ou-hand .boba-key:not(:disabled):is(:active, .is-down),
    .ou-chip:not(:disabled):active {
      transform: none;
    }
  }
</style>
