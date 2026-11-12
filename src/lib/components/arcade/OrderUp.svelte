<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";

  import {
    setDemoPourStream,
    setMusicPaused,
    setMusicPhase,
    setPourStream,
    sfxBlip,
    sfxBrew,
    sfxBrewed,
    sfxCountdown,
    sfxDump,
    sfxIce,
    sfxMilestone,
    sfxPlop,
    sfxScoop,
    sfxScorch,
    sfxSeal,
    sfxServe,
    sfxShake,
    sfxSputter,
    sfxStart,
    sfxTicket,
    sfxWalkOut,
    sfxWrong,
    startMusic,
    stopMusic,
  } from "$lib/sfx";
  import { COUNTDOWN_SECONDS, stepCountdown } from "$lib/arcade/countdown.js";
  import {
    ACTIVE_PATIENCE_RATE,
    BREW_SECONDS,
    CRITIC,
    CUP_MOUTH,
    FILL_LINE,
    ICE_MAX,
    LIVES,
    MAX_TICKETS,
    POUR_MAX,
    SAMPLES_PER_SHIFT,
    SEAL_BAND,
    SHAKES_NEEDED,
    SHIFT_SECONDS,
    TANK_CAPACITY,
    TEAS,
    TOPPINGS,
    criticDue,
    drawFromTank,
    gradeDrink,
    gradeWord,
    judgeScoop,
    keepsStreak,
    ladleAt,
    makeOrder,
    mostImpatient,
    nextArrivalIn,
    paceForElapsed,
    patienceFor,
    pickRegular,
    pickSpecial,
    pointsForDrink,
    pourGrade,
    sampleBoost,
    sampleTarget,
    scoopQueue,
    scoopResult,
    sealGrade,
    sealNeedle,
    sealResult,
    shakeGrade,
    stationsFor,
    stepPour,
    tankState,
    timeRemaining,
  } from "$lib/arcade/orders-engine.js";
  import type { Ice, Order, Phase, Quirk, Regular, Station, Tea, Topping } from "$lib/arcade/orders-engine.js";
  import {
    DEMO_DROP_WITHIN,
    DEMO_ORDER,
    DEMO_PATIENCE,
    DEMO_PRESS_SECONDS,
    DEMO_REGULAR,
    DEMO_SCRIPT,
    DEMO_SEAL_AIM,
    DEMO_SEAL_WITHIN,
    DEMO_START_JAR,
    DEMO_START_TAP,
    demoIceScoops,
    demoPourTarget,
    reachedTarget,
  } from "$lib/arcade/orders-demo.js";
  import type { DemoStep } from "$lib/arcade/orders-demo.js";
  import {
    INK,
    LID,
    MENU_ICONS,
    PEARL,
    STRAW_PINK,
    addParticle,
    addPopup,
    arcadeFont,
    cachedSprite,
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
  } from "$lib/arcade/art";
  import { firstVisit } from "$lib/arcade/scores";
  import { arcadeExits, concludeRun, createTimers, isOnControl, mountShell } from "$lib/arcade/shell";
  import Mark from "$lib/components/Mark.svelte";
  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import Countdown from "./Countdown.svelte";
  import CupTimer from "./CupTimer.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import Pearls from "./Pearls.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";

  // Order up: regulars queue on the line, each with a drink in mind. Take a
  // ticket, then work the bench by hand: scoop the ice and pour to the line,
  // pick each topping's jar and drop it from a swinging ladle, shake it, and
  // stamp the seal while the sealer is hot. Around that, tanks run dry and
  // brew, samples buy a guest time, the critic visits, and one tea is the
  // special. Every rule, number and grade lives in orders-engine.js; this
  // file steps it, draws it, and wires it to the arcade. The demo
  // (orders-demo.js) plays one drink through the same functions.

  const { exit, toMenu } = arcadeExits(createEventDispatcher<{ close: null; menu: null }>());

  type Colors = ReturnType<typeof risoColors>;
  type Mood = "happy" | "flat" | "cross";
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
  const ICE_NAMES: Record<Ice, string> = { none: "no ice", light: "light ice", full: "full ice" };
  /** Cube icons on the ticket. */
  const ICE_ICONS: Record<Ice, number> = { none: 0, light: 1, full: 2 };
  /** Each scoop from the bin puts this many cubes in the cup. */
  const CUBES_PER_SCOOP = 2;
  const QUIRK_NAMES: Record<Quirk, string> = {
    hurry: "in a hurry",
    patient: "patient",
    tipper: "big tipper",
    critic: "critic",
  };

  const PROMPTS: Record<Station, string> = {
    pour: "hold to pour, let go at the line",
    scoop: "pick the jar, drop when the ladle is over the cup",
    shake: "shake",
    seal: "stamp when the needle is in the band",
  };
  const HAND_LABELS: Record<Station, string> = { pour: "Hold to pour", scoop: "Drop", shake: "Shake", seal: "Seal" };
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
  /** A scoop of ice arcs from the bin into the cup. */
  const ICE_ARC_SECONDS = 0.36;
  /** From the stamp to the serve. */
  const SEAL_SECONDS = 0.7;
  /** Within the seal, from the stamp: the plate lands, the straw pops, the cup hops off. */
  const PRESS_LANDS = 0.24;
  const PRESS_LIFTS = 0.34;
  const PRESS_GONE = 0.46;
  const STRAW_IN = 0.3;
  const STRAW_UP = 0.42;
  const HOP_START = 0.46;
  const RECEIPT_SECONDS = 2.4;
  const DUMP_LOCKOUT = 0.4;
  const NOTICE_SECONDS = 1.8;
  const RECENT_NAMES = 6;
  /** A drink graded this or better is perfect. */
  const PERFECT = 95;

  // --- Pixel art ----------------------------------------------------------------

  const TEA_URN = ["OOOOOOO", "OLLLLLO", ".OLLLO.", ".OLLLO.", "..OOO.."];
  /** Each tea machine: a tank this many cells wide and tall, then a pipe and a nozzle. */
  const TANK_W = 10;
  const TANK_ROWS = 7;
  const NOZZLE = ["OOOO", ".OO."];
  /** Cells of open air between a nozzle and the rim: a short stream. */
  const NOZZLE_GAP = 3;
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
  /** The ice button's icon: a scoop of cubes. */
  const ICE_ICON = ["OOOOOOO", "OhpOphO", ".OpppO.", "..OOO.."];
  /** A small star for the critic and the day's special. */
  const STAR = ["..O..", "OOOOO", ".OOO.", ".O.O."];
  /** Light on any page, so dark pearls read against the night theme too. */
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
  /** Ice: where each cube rests on the bottom, and where it bobs at the top. */
  const ICE_REST: Array<[number, number]> = [
    [3, 14],
    [7, 14],
    [4, 11],
    [7, 11],
    [3, 8],
    [8, 8],
  ];
  /** Floating, by how many cubes are in: their columns along the surface. */
  const ICE_FLOAT: Record<number, number[]> = {
    2: [3, 7],
    4: [1, 4, 7, 10],
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
  /** The cup stands about this share of the bench's height. */
  const CUP_SHARE = 0.45;
  /** Cells the bench needs, top to bottom and across, before the grid shrinks. */
  const ROWS_NEEDED = 34;
  const COLS_NEEDED = 54;
  /** The ladle hangs from a pivot this many cells above it, out of view. */
  const LADLE_ARM = 60;

  // Faces: eight cells square, seeded by name so a regular always looks the
  // same, with an ink outline added around whatever is drawn.
  const SKINS = ["#f3cfae", "#dca47c", "#b07850", "#7a4f35"];
  const HAIRS = ["#2b1a12", "#5a3825", "#c98b3a", "#8f8f8f", "#b0442f"];
  const HATS = ["#3f6fb0", "#2f7d5b", "#e85d4c", "#704a05"];
  const SHIRTS = ["#6aa6e0", "#e76f8e", "#9fd17a", "#f4b942", "#b388e0"];
  const FACE = ["........", "........", ".SSSSSS.", ".SESSES.", ".SSSSSS.", "", "", "..CCCC.."];
  const MOUTHS: Record<Mood, [string, string]> = {
    happy: [".SMSSMS.", "..SMMS.."],
    flat: [".SMMMMS.", "..SSSS.."],
    cross: [".SSMMSS.", "..MSSM.."],
  };
  const HAIRDOS = [
    ["..HHHH..", ".HHHHHH.", ".H....H."],
    ["...HH...", "..HHHH..", ".HHHHHH."],
    ["..TTTT..", ".TTTTTTT", ".H....H."],
  ];

  function nameHash(name: string) {
    let h = 2166136261;
    for (let index = 0; index < name.length; index++) {
      h ^= name.charCodeAt(index);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const faceGrids = new Map<string, string[]>();
  const facePalettes = new Map<string, Record<string, string>>();

  /** The critic's reading glasses: a dark frame over pale lenses, across the eyes. */
  const GLASSES: Record<number, string> = { 2: ".GGGGGG.", 3: "GLEGGELG" };

  function faceGrid(name: string, mood: Mood, glasses = false) {
    const key = `${name}|${mood}|${glasses}`;
    const cached = faceGrids.get(key);
    if (cached) return cached;
    const hairdo = HAIRDOS[(nameHash(name) >>> 6) % HAIRDOS.length];
    const rows = FACE.map((row, index) => {
      let line = index === 5 ? MOUTHS[mood][0] : index === 6 ? MOUTHS[mood][1] : row;
      const over = hairdo[index];
      if (over) line = [...line].map((cell, column) => (over[column] !== "." ? over[column] : cell)).join("");
      const frame = glasses ? GLASSES[index] : undefined;
      if (frame) line = [...line].map((cell, column) => (frame[column] !== "." ? frame[column] : cell)).join("");
      // A sweat drop beside the eye once they are about to give up.
      if (mood === "cross" && index === 3) line = line.slice(0, 7) + "W";
      return line;
    });
    // Pad by one cell and outline every empty cell that touches the drawing.
    const padded = [".".repeat(10), ...rows.map((row) => `.${row}.`), ".".repeat(10)];
    const filled = (row: number, column: number) => (padded[row]?.[column] ?? ".") !== ".";
    const grid = padded.map((row, y) =>
      [...row]
        .map((cell, x) =>
          cell === "." && (filled(y - 1, x) || filled(y + 1, x) || filled(y, x - 1) || filled(y, x + 1))
            ? "O"
            : cell,
        )
        .join(""),
    );
    faceGrids.set(key, grid);
    return grid;
  }

  function facePalette(name: string) {
    const cached = facePalettes.get(name);
    if (cached) return cached;
    const h = nameHash(name);
    const palette = {
      S: SKINS[h % SKINS.length],
      E: INK,
      M: INK,
      H: HAIRS[(h >>> 3) % HAIRS.length],
      T: HATS[(h >>> 9) % HATS.length],
      C: SHIRTS[(h >>> 12) % SHIRTS.length],
      W: "#7fc4e8",
      G: INK,
      L: "#cfe3ea",
      O: "currentColor",
    };
    facePalettes.set(name, palette);
    return palette;
  }

  const moodFor = (share: number): Mood => (share > 0.6 ? "happy" : share > 0.3 ? "flat" : "cross");
  const MOOD_WORDS: Record<Mood, string> = {
    happy: "happy to wait",
    flat: "getting restless",
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
    /** Scoops of ice the player put in. */
    ice: number;
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
  }

  /** A scoop of ice on its way from the bin to the cup. */
  interface IceArc {
    age: number;
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
    name: string;
    sentBack: boolean;
    rows: Array<{ label: string; word: string }>;
    points: number;
    /** Rubber stamps beside the points: the tip, the special, the critic. */
    stamps: string[];
    streak: number;
    perfect: boolean;
    /** Only a drink sent back carries a line: what went wrong. */
    line: string;
    until: number;
  }

  interface Step {
    id: string;
    label: string;
    state: "todo" | "current" | "done";
    word: string;
  }

  // --- State -----------------------------------------------------------------

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
  let samplesLeft = SAMPLES_PER_SHIFT;
  let criticSeen = false;
  let special: Tea = "milk";
  /** The first time here: asked whether to watch the demo before the countdown. */
  let askFirst = false;
  let liveMessage = "Order up starting";
  let localBest = 0;
  let newBest = false;

  let playScope: HTMLElement;
  let playfield: HTMLElement;
  let hud: HTMLElement;
  let hudHeight = 80;
  let benchArt: HTMLElement;
  let canvas: HTMLCanvasElement;
  let tapEls: HTMLButtonElement[] = [];
  let iceEl: HTMLButtonElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let firstCard: HTMLElement;
  let watchButton: HTMLButtonElement;
  let demoBar: HTMLElement;
  let skipButton: HTMLButtonElement;
  let endCard: HTMLElement;
  let endButton: HTMLButtonElement;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;
  let popupFont = '500 13px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';
  let reduceMotion = false;
  let small = false;
  let facePx = 4;

  // The bench, in CSS px.
  let W = 0;
  let H = 0;
  let cell = 6;
  let counterY = 0;
  let cupTop = 0;
  let spoutX: number[] = [];
  /** The ice bin's centre, under the ice button. */
  let binX = 0;
  let cupX = 0;

  // Game time: stops while paused, so every timer below holds with it.
  let clock = 0;
  let elapsed = 0;
  let arrivalTimer = 0;
  /** Seconds until the next guest walks in; see nextArrivalIn. */
  let arrivalIn = Infinity;
  let guestRefresh = 0;
  let takeLockUntil = 0;
  let nextId = 1;
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
  /** 0 with the nozzles tucked up under the tanks, 1 reaching for the cup. */
  let tapReach = 1;
  let iceJitter = [0, 0, 0, 0, 0, 0];
  let lastShakeArrow: "left" | "right" | null = null;
  let iceArcs: IceArc[] = [];
  /** Tea is actually running this frame: held, and the tank not dry. */
  let streamOn = false;
  let tankSteamTimer = 0;

  /** Whatever is holding the pour open: keys, the hand, a tap, the bench. */
  const holds = new Set<string>();

  // --- The demo ---------------------------------------------------------------
  // It plays on the same bench and line as the shift. Opening it sets the
  // shift's state aside (`shelved`) and lays a fresh one in its place;
  // closing it puts the shift back exactly as it was. Score, pearls and
  // stats are never touched while it plays.

  interface Shelved {
    guests: Guest[];
    making: Cup | null;
    tapIndex: number;
    jarIndex: number;
    tanks: number[];
    brewEnds: number[];
    receipt: Receipt | null;
    notice: { text: string; until: number } | null;
    clock: number;
    takeLockUntil: number;
    beats: Array<{ at: number; run: () => void }>;
    falling: Falling[];
    particles: Particle[];
    popups: Popup[];
    iceArcs: IceArc[];
    cupX: number;
    wobble: number;
    tapReach: number;
    folk: Folk[];
  }

  /** True from opening the demo until it is closed, end card included. */
  let demoOn = false;
  /** The end card is up. */
  let demoEnd = false;
  /** Opened in the middle of a shift (rather than before one). */
  let demoMidShift = false;
  let shelved: Shelved | null = null;
  let demoCaption = "";
  /** The control the script is pressing, so it shows pressed. */
  let demoPress = "";
  let demoPressUntil = 0;
  let demoIndex = 0;
  let demoWait = 0;
  /** The step in progress: stepped each frame until it says it is done. */
  let demoTask: ((dt: number) => boolean) | null = null;

  let last = 0;
  let raf = 0;
  let active = true;
  const timers = createTimers();

  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  /** A stable 0–1 value per integer, so seeded marks never shimmer. */
  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  const phaseLabel = (value: Phase) =>
    value === "rush" ? "lunch rush" : value === "steady" ? "steady trade" : "doors open";

  // --- Derived for the template ---------------------------------------------------

  // The hand and the ice follow the bench, demo included; the player's own
  // input is shut out of the demo in the handlers instead.
  $: handLive = !!making && !(making.station === "seal" && making.stampAt !== null);
  $: handLabel = making ? HAND_LABELS[making.station] : "Pick a ticket";
  $: steps = stepsFor(making);
  // In the demo the caption above the bench says it instead.
  $: prompt = demoOn ? "" : notice ? notice.text : making ? PROMPTS[making.station] : "";
  $: averageGrade = served ? Math.round(gradeTotal / served) : 0;
  /** Anyone else on the line to hand a sample to; whether they need it is checked on the press. */
  $: sampleAnyone = mostImpatient(guests, making?.guestId ?? null);
  $: canSample = !demoOn && running && !paused && !gameOver && samplesLeft > 0 && sampleAnyone >= 0;
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

  /** Can this tap pour into this cup right now? */
  function tapLive(index: number, cup: Cup | null = making) {
    return (
      !!cup &&
      cup.station === "pour" &&
      !cup.busy &&
      (!cup.tea || cup.tea === TEAS[index]) &&
      brewEnds[index] === 0
    );
  }

  /** Ice goes in at the pour, before any tea. */
  function iceAdjustable(cup: Cup | null) {
    return !!cup && cup.station === "pour" && !cup.busy && !cup.tea && cup.level === 0 && holds.size === 0;
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

  /** The stepper: a step is done once its grade is known, and the first undone is current. */
  function stepsFor(cup: Cup | null): Step[] {
    if (!cup) {
      return ["pour", "scoop", "shake", "seal", "serve"].map((label): Step => ({ id: label, label, state: "todo", word: "" }));
    }
    const list: Step[] = [{ id: "pour", label: "pour", state: "todo", word: cup.pourGrade === null ? "" : gradeWord(cup.pourGrade) }];
    if (cup.stations.includes("scoop")) {
      const done = cup.drops.length === cup.queue.length;
      list.push({ id: "scoop", label: "scoop", state: "todo", word: done ? gradeWord(scoopAverage(cup)) : "" });
    }
    list.push({ id: "shake", label: "shake", state: "todo", word: cup.shakeSeconds === null ? "" : gradeWord(shakeGrade(cup.shakeSeconds)) });
    list.push({ id: "seal", label: "seal", state: "todo", word: cup.sealValue === null ? "" : SEAL_WORDS[sealResult(cup.sealValue)] });
    list.push({ id: "serve", label: "serve", state: "todo", word: "" });
    let current = false;
    for (const step of list) {
      if (step.word) step.state = "done";
      else if (!current) {
        step.state = "current";
        current = true;
      }
    }
    return list;
  }

  function describeOrder(order: Order) {
    const parts = [TEA_NAMES[order.tea], ICE_NAMES[order.ice]];
    for (const line of order.toppings) {
      parts.push(`${line.scoops} ${line.scoops === 1 ? "scoop" : "scoops"} of ${TOPPING_NAMES[line.kind]}`);
    }
    return parts.join(", ");
  }

  function guestLabel(guest: Guest, mood: Mood, mine: boolean) {
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

  /** The shift's input is live: running and not paused, and no demo in the way. */
  function playing() {
    return running && !paused && !gameOver && !demoOn;
  }

  /** The bench can act: in a live shift, or in the demo's sandbox. */
  function benchLive() {
    return !paused && !gameOver && (demoOn ? !demoEnd : running);
  }

  /** Svelte only sees the cup change when it is reassigned. */
  function refresh() {
    making = making;
  }

  function after(seconds: number, run: () => void) {
    beats.push({ at: clock + seconds, run });
  }

  // --- Guests on the line -----------------------------------------------------------

  // Guests clip onto the rail as they arrive.
  function arrive(node: Element, { guest }: { guest: Guest }) {
    return {
      duration: reduceMotion ? 0 : 380,
      easing: cubicOut,
      css: (t: number, u: number) =>
        `transform: translateY(${-u * 26}px) rotate(${guest.tilt - u * 8}deg); opacity: ${t}`,
    };
  }

  // Served guests hop for joy and float up off the rail; the ones who gave up
  // (or were sent the wrong tea) drop away.
  function leave(node: Element, { guest }: { guest: Guest }) {
    const happy = guest.outcome === "served";
    return {
      duration: reduceMotion ? 0 : happy ? 560 : 360,
      css: (t: number, u: number) => {
        if (!happy) {
          const k = cubicOut(u);
          return `transform: translateY(${k * 48}px) rotate(${k * 12}deg); opacity: ${t}`;
        }
        const hop = u < 0.3 ? -Math.sin((u / 0.3) * Math.PI) * 10 : 0;
        const rise = u < 0.3 ? 0 : cubicOut((u - 0.3) / 0.7);
        return `transform: translateY(${hop - rise * 30}px); opacity: ${u < 0.3 ? 1 : 1 - rise}`;
      },
    };
  }

  function rememberName(name: string) {
    recent = [...recent.filter((item) => item !== name), name].slice(-RECENT_NAMES);
  }

  function addGuest() {
    const exclude = [...guests.map((guest) => guest.regular.name), ...recent];
    // Once a shift, the first guest through the door after CRITIC_AT is the critic.
    const critic = criticDue(elapsed, criticSeen);
    const regular = critic ? CRITIC : pickRegular(exclude);
    if (critic) criticSeen = true;
    const order = makeOrder(elapsed, regular);
    const patience = patienceFor(order, regular, elapsed);
    const guest: Guest = {
      id: nextId++,
      regular,
      order,
      patience,
      left: patience,
      tilt: Math.round((Math.random() * 3 - 1.5) * 10) / 10,
      outcome: null,
    };
    guests = [...guests, guest];
    sfxTicket();
    if (critic) {
      note("the critic is here");
      liveMessage = `The critic is here, and their drink counts double: ${describeOrder(order)}.`;
    } else {
      liveMessage = `${regular.name} is waiting: ${describeOrder(order)}.`;
    }
  }

  function removeGuest(guest: Guest, outcome: "served" | "gone") {
    guest.outcome = outcome;
    guests = guests.filter((item) => item !== guest);
    if (!demoOn) rememberName(guest.regular.name);
  }

  function loseLife() {
    streak = 0;
    lives -= 1;
    missPulse += 1;
    if (lives <= 0) void endGame("hearts");
  }

  function walkOut(guest: Guest) {
    const mine = making?.guestId === guest.id;
    removeGuest(guest, "gone");
    sfxWalkOut();
    if (mine) binCup();
    if (!reduceMotion) veilAge = 0;
    note(`${guest.regular.name} left`);
    liveMessage = `${guest.regular.name} left${mine ? " and their cup was binned" : ""}. You lose a pearl.`;
    loseLife();
  }

  // --- Taking a ticket, dumping it ---------------------------------------------------

  function take(index: number) {
    if (!benchLive()) return;
    const guest = guests[index];
    if (!guest) return;
    if (making) {
      if (making.guestId !== guest.id) note("finish or dump this one first");
      return;
    }
    if (clock < takeLockUntil) return;
    receipt = null;
    notice = null;
    making = {
      guestId: guest.id,
      name: guest.regular.name,
      regular: guest.regular,
      order: guest.order,
      stations: stationsFor(guest.order),
      station: "pour",
      busy: false,
      ice: 0,
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
    };
    holds.clear();
    iceArcs = [];
    streamOn = false;
    cupX = spoutX[tapIndex] ?? W / 2;
    wobble = 0;
    sfxBlip();
    guests = guests;
    liveMessage = `Making ${guest.regular.name}'s ${describeOrder(guest.order)}. At the pour, under the ${TEA_NAMES[TEAS[tapIndex]]} tap.`;
  }

  /** Throws the cup away, and everything it was waiting on. */
  function binCup() {
    making = null;
    beats = [];
    falling = [];
    iceArcs = [];
    holds.clear();
    streamOn = false;
    setPourStream(0);
    guests = guests;
  }

  function dump() {
    if (!playing() || !making || making.stampAt !== null) return;
    binCup();
    sfxDump();
    takeLockUntil = clock + DUMP_LOCKOUT;
    note("poured out");
  }

  // --- Ice --------------------------------------------------------------------------

  /** One scoop from the bin, before any tea goes in. */
  function addIce() {
    const cup = making;
    if (!cup || !benchLive() || !iceAdjustable(cup)) return false;
    if (cup.ice >= ICE_MAX) {
      note("the cup holds no more ice");
      return false;
    }
    cup.ice += 1;
    if (!reduceMotion) iceArcs.push({ age: 0 });
    sfxIce(cup.ice);
    liveMessage = `${cup.ice} ${cup.ice === 1 ? "scoop" : "scoops"} of ice in the cup.`;
    refresh();
    return true;
  }

  /** One scoop back out, while there is still no tea on it. */
  function removeIce() {
    const cup = making;
    if (!cup || !benchLive() || !iceAdjustable(cup) || cup.ice === 0) return;
    cup.ice -= 1;
    // A scoop still in the air is the one that comes back.
    if (iceArcs.length) iceArcs.pop();
    sfxIce(0);
    liveMessage = `${cup.ice} ${cup.ice === 1 ? "scoop" : "scoops"} of ice in the cup.`;
    refresh();
  }

  // --- The pour --------------------------------------------------------------------

  /** The pour's sound: heard through the shift's paused music while the demo plays. */
  function streamSound(level: number, fill = 0) {
    if (demoOn) setDemoPourStream(level, fill);
    else setPourStream(level, fill);
  }

  function selectTap(index: number) {
    const cup = making;
    if (!cup || cup.station !== "pour" || cup.busy || holds.size) return false;
    if (cup.tea && cup.tea !== TEAS[index]) {
      note(`this cup is ${TEA_NAMES[cup.tea]}, dump to switch`);
      return false;
    }
    if (index !== tapIndex) {
      tapIndex = index;
      liveMessage = `Under the ${TEA_NAMES[TEAS[index]]} tap.`;
    }
    return true;
  }

  function moveTap(direction: number) {
    selectTap(clamp(tapIndex + direction, 0, TEAS.length - 1));
  }

  function startHold(source: string) {
    const cup = making;
    if (!cup || cup.station !== "pour" || cup.busy || !benchLive()) return;
    if (cup.tea && cup.tea !== TEAS[tapIndex]) return;
    const tea = TEA_NAMES[TEAS[tapIndex]];
    if (brewEnds[tapIndex] > 0) {
      note(`${tea} is brewing`);
      return;
    }
    if (!holds.size) {
      cup.heldSeconds = 0;
      if (tankState(tanks[tapIndex]) === "empty") note(`the ${tea} tank is empty`);
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
    if (commit && cup && cup.station === "pour" && !cup.busy && cup.level >= MIN_POUR) commitPour();
    else refresh();
  }

  /** Closes the tap without judging the pour (pause, blur, game over, the demo). */
  function releaseAll() {
    holds.clear();
    streamOn = false;
    lastShakeArrow = null;
    setPourStream(0);
  }

  function commitPour() {
    const cup = making;
    if (!cup || cup.station !== "pour" || cup.busy) return;
    holds.clear();
    streamOn = false;
    setPourStream(0);
    cup.busy = true;
    cup.pourGrade = pourGrade(cup.level, cup.order.ice);
    const word = gradeWord(cup.pourGrade);
    popBeside(word, popupKind(cup.pourGrade), 1.1, 5);
    liveMessage = `Pour ${word}.`;
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
      // The demo swings at the opening pace, whenever it is opened.
      cup.swing = paceForElapsed(demoOn ? 0 : elapsed).swing;
      cup.loadedAt = 0;
      dipJar(cup);
      const count = cup.queue.length;
      liveMessage = `Scoop: ${count} ${count === 1 ? "scoop" : "scoops"}, ${cup.queue.map((kind) => TOPPING_NAMES[kind]).join(", ")}. The ladle is in the ${TOPPING_NAMES[cup.chosen]} jar.`;
    } else if (next === "shake") {
      liveMessage = `Shake: ${SHAKES_NEEDED} quick shakes.`;
    } else if (next === "seal") {
      cup.sealStart = clock;
      cup.sealValue = null;
      cup.stampAt = null;
      cup.sealed = false;
      liveMessage = "Seal: stamp when the needle is in the band.";
    }
    refresh();
  }

  // --- The ladle ----------------------------------------------------------------------

  /** The ladle's swing radius: the cup's mouth edge sits at exactly CUP_MOUTH. */
  const ladleRadius = () => ((CUP_W / 2) * cell) / CUP_MOUTH;

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
    if (!cup || cup.station !== "scoop" || cup.busy || !benchLive()) return false;
    const next = clamp(index, 0, TOPPINGS.length - 1);
    if (next === jarIndex) return true;
    jarIndex = next;
    dipJar(cup);
    liveMessage = `The ladle is in the ${TOPPING_NAMES[TOPPINGS[next]]} jar.`;
    refresh();
    return true;
  }

  function moveJar(direction: number) {
    selectJar(jarIndex + direction);
  }

  function drop() {
    const cup = making;
    if (!cup || cup.station !== "scoop" || cup.busy || clock < cup.loadedAt || !benchLive()) return;
    const index = cup.drops.length;
    const wanted = cup.queue[index];
    if (!wanted) return;
    const kind = cup.chosen;
    const ladle = ladleNow(cup);
    // A wrong jar still falls where the ladle was; it just counts for nothing.
    const landed = scoopResult(ladle.x);
    const judged = judgeScoop(wanted, kind, ladle.x);
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
    liveMessage =
      judged.result === "wrong"
        ? `Scoop ${index + 1} of ${cup.queue.length}, wrong jar: ${TOPPING_NAMES[kind]}, not ${TOPPING_NAMES[wanted]}.`
        : `Scoop ${index + 1} of ${cup.queue.length}, ${word}.`;
    cup.loadedAt = clock + RELOAD;
    if (cup.drops.length === cup.queue.length) {
      cup.busy = true;
      after(AFTER_SCOOPS, () => enterStation("shake"));
    }
    refresh();
  }

  // --- The shake ----------------------------------------------------------------------

  function shake() {
    const cup = making;
    if (!cup || cup.station !== "shake" || cup.busy || !benchLive()) return;
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
      const grade = shakeGrade(cup.shakeSeconds);
      const word = gradeWord(grade);
      popBeside(word, popupKind(grade), 1.1, 5);
      liveMessage = `Shake ${word}.`;
      after(AFTER_SHAKE, () => enterStation("seal"));
    }
    refresh();
  }

  // --- The seal -----------------------------------------------------------------------

  /** Stamps the press at wherever the needle is. The press, straw and hop follow in stepCup. */
  function stamp() {
    const cup = making;
    if (!cup || cup.station !== "seal" || cup.busy || cup.stampAt !== null || !benchLive()) return;
    const value = sealNeedle(clock - cup.sealStart);
    cup.sealValue = value;
    cup.stampAt = clock;
    cup.busy = true;
    const result = sealResult(value);
    const grade = sealGrade(value);
    popBeside(SEAL_WORDS[result], result === "sealed" ? "perfect" : grade >= 55 ? "plain" : "miss", 1.1, 5);
    liveMessage = `Seal ${SEAL_WORDS[result]}.`;
    refresh();
  }

  /** The hand: whatever the station needs from one press. */
  function act(source: string) {
    const cup = making;
    if (!cup || !benchLive()) return;
    if (cup.station === "pour") startHold(source);
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
    brewEnds[index] = clock + BREW_SECONDS;
    sfxBrew();
    refreshTanks();
    liveMessage = `Brewing ${tea}.`;
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
    guest.left = sampleBoost(guest.left, guest.patience);
    samplesLeft -= 1;
    sfxPlop(SAMPLES_PER_SHIFT - samplesLeft);
    const figure = folk.find((item) => item.id === guest.id);
    if (figure && !reduceMotion) figure.hop = 0;
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
      level: cup.level,
      drops: cup.drops,
      shakeSeconds: cup.shakeSeconds ?? 99,
      sealValue: cup.sealValue ?? 0,
      patienceFraction: clamp(guest.left / guest.patience, 0, 1),
    });
    return { guest, tea: cup.tea, result };
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
    const { guest, tea, result } = judged;
    const name = guest.regular.name;
    // The demo's receipt stays until its end card; the script decides how long.
    const until = clock + (demoOn ? 99 : RECEIPT_SECONDS);

    if (!result.accepted) {
      sfxWrong();
      removeGuest(guest, "gone");
      const line = `${name} ordered ${TEA_NAMES[cup.order.tea]}, not ${TEA_NAMES[tea]}`;
      receipt = {
        id: ++receiptId,
        name,
        sentBack: true,
        rows: [],
        points: 0,
        stamps: [],
        streak: 0,
        perfect: false,
        line,
        until,
      };
      if (!reduceMotion) veilAge = 0;
      if (demoOn) return;
      liveMessage = `${line}. Sent back. You lose a pearl.`;
      loseLife();
      return;
    }

    const nextStreak = keepsStreak(result.total) ? streak + 1 : 0;
    const pay = pointsForDrink(result.total, guest.regular, nextStreak, cup.order.tea === special);
    const perfect = result.total >= PERFECT;
    // The demo shows what a drink earns but never banks it.
    if (!demoOn) {
      streak = nextStreak;
      bestStreak = Math.max(bestStreak, streak);
      score += pay.points;
      served += 1;
      gradeTotal += result.total;
      if (perfect) perfects += 1;
    }
    sfxServe(pay.tip > 0);
    // The fanfare comes in just after the serve chime.
    if (perfect) timers.later(() => sfxMilestone(), 220);
    // The room celebrates too: the lamps flare and gold runs along the transom.
    if (perfect && !reduceMotion) flareAge = sparkAge = 0;
    removeGuest(guest, "served");

    const rows = [
      { label: "ice", word: gradeWord(result.ice) },
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
    ].filter(Boolean);
    receipt = {
      id: ++receiptId,
      name,
      sentBack: false,
      rows,
      points: pay.points,
      stamps,
      streak: pay.streakBonus > 0 ? nextStreak : 0,
      perfect,
      line: "",
      until,
    };
    const extras = [
      pay.tip > 0 ? `a tip of ${pay.tip}` : "",
      pay.specialBonus > 0 ? `${pay.specialBonus} for today's special` : "",
      critic ? "double for the critic" : "",
      pay.criticBonus > 0 ? `a critic's bonus of ${pay.criticBonus}` : "",
      pay.streakBonus > 0 ? `a ${nextStreak} drink streak` : "",
    ].filter(Boolean);
    liveMessage = `Served ${name}, ${perfect ? "perfect, " : ""}graded ${result.total} of 100: ${pay.points} points${extras.length ? ` with ${extras.join(" and ")}` : ""}.`;
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

  /** Where the nozzles end: a few cells above the rim when out, tucked under the tanks when in. */
  function nozzleBottom() {
    const tucked = (TANK_ROWS + 1 + NOZZLE.length) * cell;
    const out = Math.max(tucked, cupTop - NOZZLE_GAP * cell);
    return Math.round(lerp(tucked, out, tapReach));
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
   * The tea machines: a tank hanging from the top of the bench under each tap
   * button, a window showing its tea, and a pipe down to a nozzle just above
   * the rim. The pipes tuck up out of the ladle's way once the pour is done.
   */
  function drawDispensers(g: CanvasRenderingContext2D, colors: Colors) {
    const c = cell;
    const line = Math.max(2, Math.round(c / 3));
    const tankTop = c;
    const tankBottom = (TANK_ROWS + 1) * c;
    const tip = nozzleBottom();
    const pipeBottom = tip - NOZZLE.length * c;
    const flowingAt = streamOn ? tapIndex : -1;
    TEAS.forEach((tea, index) => {
      const x = spoutX[index];
      if (x === undefined) return;
      const left = Math.round(x - (TANK_W / 2) * c);
      const width = TANK_W * c;
      g.save();
      g.globalAlpha = (!making && brewEnds[index] === 0) || tapLive(index) ? 1 : 0.55;
      // A paper halo, so the machine reads against whatever the room shows.
      g.fillStyle = HALO;
      g.fillRect(Math.round(x - c) - 2, 0, 2 * c + 4, tankTop);
      g.fillRect(left - 2, tankTop - 2, width + 4, tankBottom - tankTop + 4);
      if (pipeBottom > tankBottom) g.fillRect(Math.round(x - c) - 2, tankBottom, 2 * c + 4, pipeBottom - tankBottom);
      drawHalo(g, NOZZLE, x - 2 * c, pipeBottom, c, HALO);
      g.fillStyle = colors.ink;
      g.fillRect(Math.round(x - c), 0, 2 * c, tankTop);
      g.fillStyle = colors.paper;
      g.fillRect(left, tankTop, width, tankBottom - tankTop);
      // The window: the tea left in the tank, sloshing while this tap runs.
      const wx = left + 2 * c;
      const wy = tankTop + 2 * c;
      const ww = width - 4 * c;
      const wh = tankBottom - tankTop - 4 * c;
      const share = clamp(tanks[index] / TANK_CAPACITY, 0, 1);
      if (share > 0) {
        g.fillStyle = TEA_COLORS[tea];
        for (let column = 0; column < TANK_W - 4; column++) {
          const slosh = index === flowingAt && !reduceMotion ? Math.sin(clock * 14 + column * 1.3) * 0.45 * c : 0;
          const top = Math.min(wy + wh - 1, wy + (1 - share) * wh + slosh);
          g.fillRect(wx + column * c, top, c, wy + wh - top);
        }
      }
      g.strokeStyle = colors.ink;
      g.lineWidth = line;
      g.strokeRect(wx, wy, ww, wh);
      g.strokeRect(left + line / 2, tankTop + line / 2, width - line, tankBottom - tankTop - line);
      if (pipeBottom > tankBottom) {
        g.fillStyle = colors.ink;
        g.fillRect(Math.round(x - c), tankBottom, 2 * c, pipeBottom - tankBottom);
        g.fillStyle = colors.paper;
        g.fillRect(Math.round(x - c) + line, tankBottom, 2 * c - 2 * line, pipeBottom - tankBottom);
      }
      drawSprite(g, NOZZLE, x - 2 * c, pipeBottom, c, { O: colors.ink });
      g.restore();
    });
  }

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
    // Seeded spots, so they sit in the same places every visit, clear of the ice bin.
    const napkinX = Math.round(Math.max((0.05 + hash(5) * 0.05) * W, binRight() + 2 * cell));
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

  /** The ice bin's left edge, standing on the counter under the ice button. */
  const binLeft = () => Math.round(Math.max(cell, binX - (ICE_BIN[0].length / 2) * cell));
  const binRight = () => binLeft() + ICE_BIN[0].length * cell;
  const BIN_PALETTE = { O: INK, L: LID, h: "#ffffff", p: "#dceef4", s: "#b5d2dc", B: "#8fb8c9" };

  /** The ice bin, lid propped open. Out of the way while the jars are on the counter. */
  function drawIceBin(g: CanvasRenderingContext2D) {
    if (making?.station === "scoop") return;
    const top = counterY - ICE_BIN.length * cell;
    const fade = !making || iceAdjustable(making);
    g.save();
    g.globalAlpha = fade ? 1 : 0.55;
    drawHalo(g, ICE_BIN, binLeft(), top, cell, HALO);
    drawSprite(g, ICE_BIN, binLeft(), top, cell, BIN_PALETTE);
    g.restore();
  }

  /** Where a scoop of ice is on its arc from the bin's mouth to the cup's, at 0–1. */
  function iceArcAt(u: number) {
    const fromX = binLeft() + 6 * cell;
    const fromY = counterY - 8 * cell;
    const toX = cupX;
    const toY = cupTop + 2 * cell;
    const peak = Math.min(fromY, toY) - 6 * cell;
    const x = lerp(fromX, toX, u);
    const y = (1 - u) * (1 - u) * fromY + 2 * (1 - u) * u * peak + u * u * toY;
    return { x, y };
  }

  function drawIceArcs(g: CanvasRenderingContext2D) {
    for (const arc of iceArcs) {
      const u = clamp(arc.age / ICE_ARC_SECONDS, 0, 1);
      const { x, y } = iceArcAt(u);
      for (let cube = 0; cube < CUBES_PER_SCOOP; cube++) {
        const cx = x + (cube - 0.5) * 3.5 * cell;
        const cy = y + cube * cell;
        drawHalo(g, ICE_CUBE, cx - 1.5 * cell, cy, cell, HALO);
        drawSprite(g, ICE_CUBE, cx - 1.5 * cell, cy, cell, ICE_PALETTE);
      }
    }
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

    // Ice the player scooped in rests on the bottom and bobs up with the tea;
    // a scoop still in the air isn't in the cup yet.
    const cubes = Math.max(0, cup.ice - iceArcs.length) * CUBES_PER_SCOOP;
    const floats = ICE_FLOAT[cup.ice * CUBES_PER_SCOOP] ?? ICE_FLOAT[6];
    for (let index = 0; index < cubes; index++) {
      const [restColumn, restRow] = ICE_REST[index];
      const restTop = top + restRow * c;
      // The third scoop's cubes float a cell lower, under the first four.
      const sink = index >= 4 ? c : 0;
      const y = Math.max(top - c + sink, Math.min(restTop, surface - c + sink));
      const lift = clamp((restTop - y) / (2 * c), 0, 1);
      const row = clamp(Math.floor((y - top) / c) + 2, 1, INSIDE_ROWS);
      const inset = wallInset(row);
      let column = Math.round(lerp(restColumn, floats[index], lift));
      column = clamp(column, inset + 1, 12 - inset - 2);
      const jitter = reduceMotion ? 0 : iceJitter[index] * c * Math.exp(-joltAge * 14);
      drawSprite(g, ICE_CUBE, left + column * c + jitter, y, c, ICE_PALETTE);
    }

    // At the pour: a dashed line where the tea should stop.
    if (cup.station === "pour") {
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
      const result = sealResult(cup.sealValue);
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
    g.moveTo(W / 2, ladle.pivotY);
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
    const room = W / 2 - (CUP_W / 2 + 2) * cell;
    const far = room * 0.3;
    const near = room * 0.72;
    return [far, near, W - near, W - far];
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
    const x0 = Math.round(1.5 * cell);
    const y = Math.round((TANK_ROWS + 4) * cell);
    // A small paper chip under the queue, so it reads over the room.
    const chipW = cup.queue.length * (iconW + gap) - gap + 2 * gap;
    g.fillStyle = BENCH.paper;
    g.fillRect(x0 - gap, y - gap, chipW, iconH + 2 * mark + gap);
    g.strokeStyle = "#c8c8c8";
    g.lineWidth = 1;
    g.strokeRect(x0 - gap + 0.5, y - gap + 0.5, chipW - 1, iconH + 2 * mark + gap - 1);
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
    g.fillStyle = HALO;
    g.fillRect(Math.round(cupX - total / 2) - gap, y - gap, total + 2 * gap, size + 2 * gap);
    for (let index = 0; index < SHAKES_NEEDED; index++) {
      const x = Math.round(cupX - total / 2 + index * (size + gap));
      if (index < cup.shakes) {
        g.fillStyle = colors.ink;
        g.fillRect(x, y, size, size);
      } else {
        g.strokeStyle = colors.muted;
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
    let bottom: number;
    if (cup.stampAt === null) {
      bottom = hover;
    } else {
      const t = clock - cup.stampAt;
      if (reduceMotion) {
        if (t > PRESS_LIFTS) return;
        bottom = landed;
      } else {
        if (t > PRESS_GONE) return;
        if (t < PRESS_LANDS) bottom = lerp(hover, landed, cubicOut(t / PRESS_LANDS) ** 2);
        else if (t < PRESS_LIFTS) bottom = landed;
        else bottom = lerp(landed, -cell, (t - PRESS_LIFTS) / (PRESS_GONE - PRESS_LIFTS));
      }
    }
    const left = Math.round(cupX - (CUP_W / 2 + 2) * cell);
    const width = (CUP_W + 4) * cell;
    const height = Math.round(1.5 * cell);
    const plateTop = Math.round(bottom - height);
    g.fillStyle = HALO;
    g.fillRect(Math.round(cupX - cell) - 2, 0, 2 * cell + 4, Math.max(0, plateTop));
    g.fillRect(left - 2, plateTop - 2, width + 4, height + 4);
    g.fillStyle = colors.ink;
    g.fillRect(Math.round(cupX - cell), 0, 2 * cell, Math.max(0, plateTop));
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
    const value = cup.sealValue ?? sealNeedle(clock - cup.sealStart);
    const width = GAUGE_COLS * c;
    const height = GAUGE_ROWS * c;
    const left = Math.round(cupX + (CUP_W / 2 + 4) * c);
    const top = Math.round(cupTop + c);
    const yAt = (v: number) => Math.round(top + (1 - v) * height);
    const bandTop = yAt(SEAL_BAND[1]);
    const bandBottom = yAt(SEAL_BAND[0]);
    const tick = Math.max(2, Math.round(c / 3));
    // A paper halo round the gauge, its ticks and its needle.
    g.fillStyle = HALO;
    g.fillRect(left - 2 * c - 2, top - c - 2, width + 5 * c + 4, height + 2 * c + 4);
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
      addParticle(particles, x + side * (TANK_W / 2 + 0.5) * cell, 3 * cell, "#fdf8f3", 14, -60);
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
      const u = clamp((clock - cup.stampAt - HOP_START) / (SEAL_SECONDS - HOP_START), 0, 1);
      // A hop off the counter toward the line, fading as it goes.
      dy = -(Math.sin(u * Math.PI) * 3 * c + u * u * 10 * c);
      alpha = 1 - u * u;
    }

    if (cup.station === "scoop") {
      drawJars(g, colors, cup);
      drawLadle(g, colors, cup);
      drawScoopQueue(g, colors, cup);
    }
    drawSpill(g, cup);

    const pivotY = cupTop + CUP_H * c;
    g.save();
    g.globalAlpha = alpha;
    g.translate(cupX + dx, pivotY + dy);
    if (tilt) g.rotate(tilt);
    g.translate(-cupX, -pivotY);
    drawCup(g, colors, cup, cupX, cupTop);
    g.restore();

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

  /** Draws whatever is on the bench now: the shift's, or the demo's while it plays. */
  function draw() {
    const g = ctx;
    if (!g || !W || !H) return;
    // The bench draws in fixed colours: it sits on the room, not on the page.
    const colors = BENCH;
    g.clearRect(0, 0, W, H);
    if (!making) drawIdleProps(g, colors);
    drawIceBin(g);
    drawDispensers(g, colors);
    if (making) drawMaking(g, colors, making);
    drawIceArcs(g);
    for (const item of falling) drawTopping(g, item.kind, item.x, item.y, item.angle, item.alpha);
    drawParticles(g, particles);
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
      const x = Math.round(popup.x);
      const y = Math.round(popup.y);
      const width = Math.ceil((g.measureText(popup.text).width + 12) / SC) * SC;
      g.globalAlpha = Math.max(0, Math.min(1, (popup.life / popup.maxLife) * 2));
      g.fillStyle = SCENE_INK;
      g.fillRect(Math.round(x - width / 2), y - 10, width, 20);
      g.fillStyle = popup.kind === "perfect" ? "#ffd166" : popup.kind === "miss" ? "#f18272" : SCENE_CREAM;
      g.fillText(popup.text, x, y + 0.5);
    }
    g.restore();
  }

  // --- Stepping effects -------------------------------------------------------------

  function splash(x: number, y: number, color: string, count: number) {
    if (reduceMotion) return;
    for (let index = 0; index < count; index++) addParticle(particles, x + (Math.random() - 0.5) * cell * 2, y, color, 60, 620);
  }

  /** A perfect drink throws a little burst of pearls as it leaves the counter. */
  function pearlBurst() {
    if (reduceMotion) return;
    const color = light.p >= 0.75 ? EMPTY_CUP : PEARL;
    for (let index = 0; index < 16; index++) {
      addParticle(particles, cupX + (Math.random() - 0.5) * 6 * cell, cupTop - cell, color, 170, 520);
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
    const target = !cup ? cupX : cup.station === "pour" ? (spoutX[tapIndex] ?? W / 2) : W / 2;
    cupX = reduceMotion ? target : cupX + (target - cupX) * (1 - Math.exp(-dt * 24));
    if (Math.abs(target - cupX) < 0.3) cupX = target;

    // The nozzles reach down for the pour (and while the counter is idle),
    // and tuck up for everything else.
    const reach = !cup || cup.station === "pour" ? 1 : 0;
    tapReach = reduceMotion ? reach : tapReach + (reach - tapReach) * (1 - Math.exp(-dt * 12));

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
        if (cup) splash(cupX, cupTop + 2 * cell, "#dceef4", 3 * landed);
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

  // The shop, seen from behind the counter in side elevation: a ceiling with
  // pendant lamps, a wide window onto the street, the side walls, the guests
  // waiting across the counter, and the counter itself. It is painted at one
  // pixel per SC-px cell into small offscreen layers, rebuilt only when the
  // light steps (every two seconds of shift) or the layout changes, and scaled
  // up without smoothing; each frame only blits them and draws the few moving
  // things between. The palette is fixed: the room looks the same in both
  // site themes.

  const SC = 4;
  /** Ordered dithering thresholds, 4 × 4. */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((value) => (value + 0.5) / 16);
  const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];
  type RGB = [number, number, number];
  const rgb = (hex: string): RGB => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
  const css = (color: RGB) => `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

  /** The sky through the day, by shift progress, with the street's colour. */
  const SKY_KEYS = [
    { p: 0, top: "#779bbe", mid: "#a9c4d9", low: "#f5e6d3", town: "#7d8ba3" },
    { p: 0.5, top: "#c68098", mid: "#f18272", low: "#ffd166", town: "#6d6888" },
    { p: 0.78, top: "#3b2a52", mid: "#8a3251", low: "#e85d4c", town: "#3a3157" },
    { p: 1, top: "#141a2e", mid: "#1f2547", low: "#3b2a52", town: "#2a2748" },
  ];
  /** The room's light in flat steps: walls, their shade, the lamps, and how dark it is. */
  // Warm by golden hour, clearly dim by dusk (p ≈ 0.78), at night's values
  // by p ≈ 0.9; the middle steps are the golden and night colours mixed.
  const ROOM_STEPS = [
    { until: 0.3, wall: "#d9c7ae", shade: "#bfa98c", lamp: 0, dark: 0 },
    { until: 0.56, wall: "#e2b77f", shade: "#c08a55", lamp: 0.3, dark: 0.06 },
    { until: 0.7, wall: "#be966c", shade: "#976c4e", lamp: 0.55, dark: 0.15 },
    { until: 0.86, wall: "#99765a", shade: "#6d4f46", lamp: 0.8, dark: 0.28 },
    { until: Infinity, wall: "#7a5a4a", shade: "#4a3540", lamp: 1, dark: 0.38 },
  ];
  const WOOD = rgb("#8a5a3a");
  const WOOD_LINE = rgb("#5e3d2a");
  const LIP = rgb("#c79a6b");
  const LIP_EDGE = rgb("#a77a52");
  const FRAME = rgb("#5e3d2a");
  const SILL = rgb("#a77a52");
  const SOFFIT = rgb("#3a2a26");
  const SOFFIT_BEAM = rgb("#4f3a33");
  const GOLD = rgb("#ffd166");
  const CREAM_RGB = rgb("#f6eee2");
  const WARM = rgb("#ffe3a3");
  const DEEP = rgb("#2a1c18");
  const STREET_DARK = rgb("#151325");
  const SCENE_INK = "#1a1a1a";
  const SCENE_CREAM = "#fdf8f3";
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
  // Passers-by: two-frame walks, one flat colour, drawn facing right.
  const WALKER = [
    [".##..", ".##..", "####.", "#.##.", ".##..", ".#.#.", "#...#"],
    [".##..", ".##..", ".###.", ".##..", ".##..", ".##..", ".#.#."],
  ];
  const DOG = [
    ["...##", "####.", "#..#."],
    ["...##", "####.", ".##.."],
  ];
  const BIKE = [
    ["....##...", "....##...", "...###...", "....##...", ".##.#.##.", "#..#.#..#", ".##...##."],
    ["....##...", "....##...", "...###...", "...#.#...", ".##.#.##.", "#..#.#..#", ".##...##."],
  ];
  // Guests across the counter: head and shoulders, three flat tones.
  const FIGURE_BODY = ["..SSSSSS..", "..SSSSSS..", "...SSSS...", "....SS....", "..CCCCCC..", ".CCCCCCCC.", "CCCCCCCCCC", "CCCCCCCCCC", "CCCCCCCCCC"];
  const FIGURE_TOPS = [
    ["...HHHH...", "..HHHHHH..", "..HSSSSH.."],
    ["....HH....", "..HHHHHH..", "..HHHHHH.."],
    ["...TTTT...", "..TTTTTTTT", "..HSSSSH.."],
  ];
  const FIGURE_ROWS = 12;
  /** The lunch-rush crowd further back: smaller and darker. */
  const CROWD = ["..XXXX..", ".XXXXXX.", ".XXXXXX.", "..XXXX..", "...XX...", ".YYYYYY.", "YYYYYYYY", "YYYYYYYY", "YYYYYYYY"];
  const MAX_WALKERS = 10;
  const MAX_STEAM = 24;

  interface Buf {
    w: number;
    h: number;
    d: Uint8ClampedArray<ArrayBuffer>;
  }
  interface Building {
    x: number;
    w: number;
    h: number;
    tank: boolean;
    awning: number;
    sign: boolean;
    seed: number;
  }
  interface Walker {
    active: boolean;
    x: number;
    dir: number;
    speed: number;
    kind: number;
  }
  interface Folk {
    id: number;
    guest: Guest;
    x: number;
    leaving: "served" | "gone" | null;
    age: number;
    rate: number;
    phase: number;
    /** Seconds since a sample made them hop. */
    hop: number;
  }
  interface Puff {
    active: boolean;
    x: number;
    y: number;
    age: number;
    life: number;
    seed: number;
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
  /** A soft pool of light: dithered, densest in the middle. */
  function glow(b: Buf, cx: number, cy: number, r: number, c: RGB, strength: number) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x, y) / r;
        if (d < 1 && bayer(cx + x, cy + y) < strength * (1 - d)) px(b, cx + x, cy + y, c);
      }
    }
  }
  function commit(b: Buf, canvas: HTMLCanvasElement) {
    canvas.width = b.w;
    canvas.height = b.h;
    const context = canvas.getContext("2d");
    context?.putImageData(new ImageData(b.d, b.w, b.h), 0, 0);
  }

  // Two canvases, so CSS can set the street further back than the room:
  // `far` is the view through the window, `near` the room and the queue.
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
  /** The room's layout in cells, measured from the DOM so it lines up. */
  const room = {
    cols: 0,
    rows: 0,
    soffit: 0,
    winL: 0,
    winR: 0,
    winT: 0,
    transom: 0,
    sill: 0,
    street: 0,
    counter: 0,
    counterPx: 0,
    doorL: 0,
    doorR: 0,
    mullions: [] as number[],
    lamps: [] as number[],
    lampY: 0,
    clock: { x: 0, y: 0, r: 0 },
    bench: { l: 0, r: 0, t: 0, b: 0 },
    urnX: -1,
    lineL: 0,
    lineW: 0,
  };
  let buildings: Building[] = [];
  const skyLayer = typeof document === "undefined" ? null : document.createElement("canvas");
  const streetLayer = typeof document === "undefined" ? null : document.createElement("canvas");
  const roomLayer = typeof document === "undefined" ? null : document.createElement("canvas");
  const counterLayer = typeof document === "undefined" ? null : document.createElement("canvas");
  const veils: HTMLCanvasElement[] = [];
  const figureSprites = new Map<string, HTMLCanvasElement>();
  let bakedStep = -1;
  let light = lightAt(0);
  let walkers: Walker[] = Array.from({ length: MAX_WALKERS }, () => ({ active: false, x: 0, dir: 1, speed: 0, kind: 0 }));
  let walkerTimer = 0.5;
  let folk: Folk[] = [];
  let steam: Puff[] = Array.from({ length: MAX_STEAM }, () => ({ active: false, x: 0, y: 0, age: 0, life: 1, seed: 0 }));
  let steamTimer = 0;
  let doorAge = 10;
  let bellAge = 10;
  let flareAge = 10;
  let sparkAge = 10;
  let veilAge = 10;

  /** The light at a point in the shift: sky and street by keyframe, the room in steps. */
  function lightAt(p: number) {
    let index = 0;
    while (index < SKY_KEYS.length - 2 && p > SKY_KEYS[index + 1].p) index++;
    const a = SKY_KEYS[index];
    const b = SKY_KEYS[index + 1];
    const t = clamp((p - a.p) / (b.p - a.p), 0, 1);
    const step = Math.max(0, ROOM_STEPS.findIndex((item) => p < item.until));
    const inside = ROOM_STEPS[step];
    return {
      p,
      step,
      top: mixRgb(rgb(a.top), rgb(b.top), t),
      mid: mixRgb(rgb(a.mid), rgb(b.mid), t),
      low: mixRgb(rgb(a.low), rgb(b.low), t),
      town: mixRgb(rgb(a.town), rgb(b.town), t),
      wall: rgb(inside.wall),
      shade: rgb(inside.shade),
      lamp: inside.lamp,
      dark: inside.dark,
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
    // The window takes the middle; the side walls get what the column leaves.
    const columnW = columnBox ? columnBox.width : VW;
    const side = Math.max(2, Math.round(((VW - columnW) / 2 / SC) * 0.75));
    room.winL = side;
    room.winR = cols - side;
    room.winT = room.soffit + 2;
    room.sill = Math.max(room.winT + 12, room.counter - 5);
    room.street = room.sill - 3;
    room.transom = room.winT + Math.max(4, Math.round((room.street - room.winT) * 0.18));
    const doorW = 12;
    room.doorR = room.winR - 1;
    room.doorL = room.doorR - doorW;
    room.mullions = [];
    const span = room.doorL - room.winL;
    const panes = Math.max(1, Math.round(span / 28));
    for (let index = 1; index < panes; index++) room.mullions.push(Math.round(room.winL + (span * index) / panes));
    room.lamps = [1 / 6, 1 / 2, 5 / 6].map((f) => Math.round(cols * f));
    room.lampY = room.soffit + 4;
    // The clock: on the right wall if there is one, else hung from the ceiling.
    const rightWall = cols - room.winR;
    if (rightWall >= 12) {
      const r = Math.min(5, Math.floor(rightWall / 2) - 2);
      room.clock = { x: room.winR + Math.round(rightWall / 2), y: room.winT + r + 4, r };
    } else {
      room.clock = { x: room.doorL - 7, y: room.soffit + 6, r: 4 };
    }
    room.bench = {
      l: Math.floor(benchBox.left / SC),
      r: Math.ceil(benchBox.right / SC),
      t: Math.floor(benchBox.top / SC),
      b: room.counter,
    };
    room.lineL = lineBox ? lineBox.left : 0;
    room.lineW = lineBox ? lineBox.width : VW;
    // The urn stands at whichever end of the counter has room outside the taps.
    room.urnX = -1;
    if (tapsBox) {
      const need = (URN[0].length + 4) * SC;
      if (VW - tapsBox.right >= need) room.urnX = Math.round((tapsBox.right + (VW - tapsBox.right) / 2) / SC) - 4;
      else if (tapsBox.left >= need) room.urnX = Math.round(tapsBox.left / 2 / SC) - 4;
    }

    // Seeded buildings across the street.
    buildings = [];
    const glassH = room.street - room.winT;
    let x = room.winL;
    for (let index = 0; x < room.winR; index++) {
      const w = 8 + Math.floor(hash(index + 1) * 14);
      buildings.push({
        x,
        w,
        h: Math.round(glassH * (0.24 + hash(index + 50) * 0.3)),
        tank: hash(index + 7) < 0.3,
        awning: hash(index + 9) < 0.5 ? Math.floor(hash(index + 13) * 3) : -1,
        sign: hash(index + 11) < 0.35,
        seed: index,
      });
      x += w + Math.floor(hash(index + 21) * 3);
    }

    // Veils for a dimmed room, a few ordered-dither densities.
    veils.length = 0;
    for (const density of [0.125, 0.25, 0.375]) {
      const b = newBuf(cols, rows);
      dither(b, 0, 0, cols, rows, rgb("#120c10"), density);
      const canvas = document.createElement("canvas");
      commit(b, canvas);
      veils.push(canvas);
    }
    bakedStep = -1;
    bakeRoom();
  }

  function guestTones(name: string) {
    const palette = facePalette(name);
    return { skin: rgb(palette.S), hair: rgb(palette.H), hat: rgb(palette.T), shirt: rgb(palette.C) };
  }

  /** A guest's figure, cached per name, facing, and light step. */
  function figureSprite(name: string, back: boolean) {
    const key = `${name}|${back}|${light.step}`;
    const cached = figureSprites.get(key);
    if (cached) return cached;
    const tones = guestTones(name);
    const night = (c: RGB) => mixRgb(c, DEEP, light.dark);
    const colors: Record<string, RGB> = {
      S: night(tones.skin),
      H: night(tones.hair),
      T: night(tones.hat),
      C: night(mixRgb(tones.shirt, light.shade, 0.4)),
    };
    const top = FIGURE_TOPS[(nameHash(name) >>> 6) % FIGURE_TOPS.length];
    let grid = [...top, ...FIGURE_BODY];
    // Seen from behind, the head is all hair.
    if (back) grid = grid.map((row, index) => (index >= 2 && index <= 5 ? row.replace(/S/g, "H") : row));
    const b = newBuf(10, FIGURE_ROWS);
    grid.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && colors[ch] && px(b, x, y, colors[ch])));
    const canvas = document.createElement("canvas");
    commit(b, canvas);
    if (figureSprites.size > 240) figureSprites.clear();
    figureSprites.set(key, canvas);
    return canvas;
  }

  /** Repaints the static layers for the current light. */
  function bakeRoom() {
    if (!skyLayer || !streetLayer || !roomLayer || !counterLayer || !room.cols) return;
    const step = Math.floor(elapsed / STEP_SECONDS);
    if (step === bakedStep) return;
    bakedStep = step;
    light = lightAt(clamp((step * STEP_SECONDS) / SHIFT_SECONDS, 0, 1));
    const { cols, rows, winL, winR, winT, street, sill, counter } = room;
    const L = light;
    const p = L.p;

    // Sky: flat bands joined by dithering, with the sun, or the moon and stars.
    const sky = newBuf(cols, rows);
    const bands = [L.top, mixRgb(L.top, L.mid, 0.5), L.mid, mixRgb(L.mid, L.low, 0.5), L.low];
    const glassH = Math.max(1, street - winT);
    for (let y = winT; y < street; y++) {
      const f = ((y - winT) / glassH) * (bands.length - 1);
      const segment = Math.min(bands.length - 2, Math.floor(f));
      const blend = clamp((f - segment - 0.3) / 0.4, 0, 1);
      for (let x = winL; x < winR; x++) px(sky, x, y, bands[blend > bayer(x, y) ? segment + 1 : segment]);
    }
    if (p < 0.66) {
      const sunY = Math.round(lerp(winT + glassH * 0.25, street + 3, clamp(p / 0.62, 0, 1)));
      disc(sky, Math.round(lerp(winL, winR, 0.72)), sunY, 4, mixRgb(rgb("#fff6d8"), GOLD, clamp(p / 0.5, 0, 1)));
    }
    if (p >= 0.82) {
      for (let index = 0; index < 40; index++) {
        if (hash(index + 400) > (p - 0.78) * 4) continue;
        const sx = Math.round(lerp(winL, winR, hash(index + 500)));
        const sy = Math.round(lerp(winT, street - glassH * 0.45, hash(index + 600)));
        px(sky, sx, sy, CREAM_RGB);
      }
      const mx = Math.round(lerp(winL, winR, 0.24));
      const my = winT + 6;
      disc(sky, mx, my, 3, CREAM_RGB);
      disc(sky, mx + 2, my - 1, 3, L.top);
    }
    commit(sky, skyLayer);

    // Across the street: buildings, their windows, a street lamp, the pavement.
    const town = newBuf(cols, rows);
    const shade = mixRgb(L.town, STREET_DARK, 0.2);
    const unlit = mixRgb(L.town, STREET_DARK, 0.32);
    const roof = mixRgb(L.town, L.low, 0.18);
    const awnings = [rgb("#a54a3c"), rgb("#3f6f6a"), rgb("#b08a3e")].map((c) => mixRgb(c, L.town, 0.5));
    const flatGold = mixRgb(GOLD, L.town, 0.5);
    // Buildings behind the bench stay calm: their dark windows are a single
    // step off the wall, so no grid of dots competes with the machines.
    const calm = mixRgb(L.town, STREET_DARK, 0.08);
    for (const house of buildings) {
      const top = street - house.h;
      const right = Math.min(house.x + house.w, winR);
      const behind = house.x < room.bench.r && right > room.bench.l;
      fill(town, house.x, top, right - house.x, house.h, L.town);
      fill(town, house.x, top, right - house.x, 1, roof);
      fill(town, right - 1, top + 1, 1, house.h - 1, shade);
      if (house.tank && house.w > 9) {
        const tx = house.x + 2 + Math.floor(hash(house.seed + 70) * (house.w - 7));
        fill(town, tx, top - 4, 4, 3, shade);
        fill(town, tx, top - 1, 1, 1, shade);
        fill(town, tx + 3, top - 1, 1, 1, shade);
      }
      const ground = street - 3;
      if (house.awning >= 0) fill(town, house.x + 1, ground - 1, right - house.x - 2, 2, awnings[house.awning]);
      if (house.sign && house.w > 9) fill(town, house.x + 2, ground - 5, Math.min(7, house.w - 4), 2, roof);
      // Windows come on one by one from golden hour; behind the bench they
      // stay muted so they never compete with the cup.
      for (let wy = top + 2; wy < ground - 6; wy += 3) {
        for (let wx = house.x + 2; wx < right - 2; wx += 3) {
          const on = 0.45 + hash(wx * 31 + wy * 7) * 0.53;
          const behindBench = wx >= room.bench.l && wx <= room.bench.r && wy >= room.bench.t;
          px(town, wx, wy, p >= on ? (behindBench ? flatGold : GOLD) : behind ? calm : unlit);
        }
      }
    }
    const pavement = mixRgb(rgb("#a39d94"), STREET_DARK, L.dark * 1.4);
    fill(town, winL, street, winR - winL, sill - street, pavement);
    fill(town, winL, street, winR - winL, 1, mixRgb(pavement, STREET_DARK, 0.25));
    fill(town, room.doorL, sill, room.doorR - room.doorL, counter - sill + 1, pavement);
    const lampX = winL + 5;
    const post = mixRgb(rgb("#2b2320"), L.town, 0.3);
    fill(town, lampX, street - 14, 1, 14, post);
    fill(town, lampX, street - 14, 3, 1, post);
    if (p >= 0.7) {
      fill(town, lampX + 2, street - 13, 2, 1, GOLD);
      for (let y = street - 12; y < street; y++) {
        const half = Math.round(((y - (street - 12)) / 12) * 5);
        dither(town, lampX + 3 - half, y, half * 2 + 1, 1, mixRgb(GOLD, L.town, 0.45), 0.3);
      }
    }
    commit(town, streetLayer);

    // The room: soffit, walls, the window frame, side walls, lamps, the clock.
    const inside = newBuf(cols, rows);
    fill(inside, 0, 0, cols, rows, L.wall);
    fill(inside, 0, sill, cols, rows - sill, L.shade);
    fill(inside, 0, 0, cols, room.soffit, SOFFIT);
    fill(inside, 0, room.soffit - 1, cols, 1, SOFFIT_BEAM);
    // Glass: clear it so the street shows, then frame it.
    for (let y = winT; y < sill; y++) for (let x = winL; x < winR; x++) clear(inside, x, y);
    for (let y = sill; y <= counter + 1; y++) for (let x = room.doorL; x < room.doorR; x++) clear(inside, x, y);
    const frame = mixRgb(FRAME, DEEP, L.dark);
    fill(inside, winL - 1, winT - 1, winR - winL + 2, 1, frame);
    fill(inside, winL - 1, winT - 1, 1, sill - winT + 1, frame);
    fill(inside, winR, winT - 1, 1, sill - winT + 1, frame);
    fill(inside, winL, room.transom, winR - winL, 1, frame);
    for (const x of room.mullions) fill(inside, x, winT, 1, sill - winT, frame);
    fill(inside, room.doorL - 1, room.transom, 1, counter - room.transom + 2, frame);
    fill(inside, winL - 2, sill, room.doorL - winL + 2, 2, mixRgb(SILL, DEEP, L.dark));
    // Golden hour lays a long warm patch of window light across the left wall.
    if (L.step === 1) {
      for (let y = winT + 3; y < sill; y++) {
        const x0 = Math.round((y - winT) * 0.6);
        const w = Math.min(7, winL - 1 - x0);
        if (w > 0) dither(inside, x0, y, w, 1, mixRgb(L.wall, rgb("#f6d09a"), 0.85), 0.5);
      }
    }
    paintLeftWall(inside);
    paintRightWall(inside);
    paintClockFace(inside);
    // Pendant lamps, their bulbs warming and their glow spreading as evening comes.
    const bulb = L.lamp > 0 ? mixRgb(rgb("#e8dcc4"), GOLD, L.lamp) : rgb("#e8dcc4");
    for (const x of room.lamps) {
      fill(inside, x, room.soffit, 1, room.lampY - room.soffit, SOFFIT);
      if (L.lamp > 0) glow(inside, x, room.lampY + 3, Math.round(3 + 9 * L.lamp), WARM, 0.5 + 0.35 * L.lamp);
      fill(inside, x - 1, room.lampY, 3, 1, SOFFIT);
      fill(inside, x - 2, room.lampY + 1, 5, 1, SOFFIT);
      fill(inside, x - 3, room.lampY + 2, 7, 1, SOFFIT_BEAM);
      fill(inside, x - 1, room.lampY + 3, 3, 1, bulb);
    }
    commit(inside, roomLayer);

    // The counter: lip, wood face with panels, an under-counter shelf, the urn.
    const below = rows - counter + 2;
    const o = URN_ROWS;
    const front = newBuf(cols, o + below);
    const wood = mixRgb(WOOD, DEEP, L.dark);
    const line = mixRgb(WOOD_LINE, DEEP, L.dark);
    const muted = (c: RGB) => mixRgb(mixRgb(c, wood, 0.72), DEEP, L.dark * 0.5);
    fill(front, 0, o + 3, cols, below, wood);
    fill(front, 0, o, cols, 2, mixRgb(LIP, DEEP, L.dark * 0.6));
    fill(front, 0, o + 2, cols, 1, mixRgb(LIP_EDGE, DEEP, L.dark * 0.6));
    fill(front, 0, o + 3, cols, 1, line);
    const shelf = o + 3 + Math.max(6, Math.floor((below - 3) * 0.55));
    for (let x = 14; x < cols; x += 32) fill(front, x, o + 4, 1, shelf - o - 4, line);
    fill(front, 0, shelf, cols, 1, line);
    fill(front, 0, shelf + 1, cols, 1, mixRgb(line, DEEP, 0.4));
    for (let x = 3, index = 0; x < cols - 6; index++) {
      const kind = Math.floor(hash(index + 800) * 3);
      if (kind === 0) {
        const h = 4 + Math.floor(hash(index + 810) * 3);
        fill(front, x, shelf - h, 3, h, muted(CREAM_RGB));
        x += 5;
      } else if (kind === 1) {
        fill(front, x, shelf - 3, 5, 3, muted(rgb("#b0603e")));
        for (let s = 0; s < 5; s += 2) px(front, x + s, shelf - 4, muted(rgb(STRAW_PINK)));
        x += 7;
      } else {
        const color = muted(rgb(["#8a3251", "#3f6f3a", "#c98b3a"][Math.floor(hash(index + 820) * 3)]));
        fill(front, x, shelf - 4, 2, 4, color);
        px(front, x, shelf - 5, color);
        x += 4;
      }
      x += Math.floor(hash(index + 830) * 4);
    }
    if (L.lamp > 0) {
      for (const lx of room.lamps) {
        const half = Math.round((6 + 10 * L.lamp) * (2 / 3));
        for (let dx = -half; dx <= half; dx++) {
          const k = 1 - Math.abs(dx) / half;
          for (let y = o; y < o + 6; y++) {
            if (bayer(lx + dx, y) < L.lamp * 0.55 * k) px(front, lx + dx, y, mixRgb(y < o + 3 ? LIP : wood, WARM, 0.35));
          }
        }
      }
    }
    if (room.urnX >= 0) {
      URN.forEach((row, y) =>
        [...row].forEach((ch, x) => ch !== "." && URN_PALETTE[ch] && px(front, room.urnX + x, y, mixRgb(URN_PALETTE[ch], DEEP, L.dark * 0.6))),
      );
    }
    commit(front, counterLayer);
  }

  /** Shelves of jars and tins and a menu board of chalk dashes, if the wall has room. */
  function paintLeftWall(b: Buf) {
    const width = room.winL - 1;
    if (width < 12) return;
    const L = light;
    const boardW = Math.min(26, width - 4);
    const boardH = Math.min(14, Math.max(8, Math.round((room.sill - room.winT) * 0.3)));
    const bx = Math.round((width - boardW) / 2);
    const by = room.winT + 2;
    fill(b, bx - 1, by - 1, boardW + 2, boardH + 2, mixRgb(FRAME, DEEP, L.dark));
    fill(b, bx, by, boardW, boardH, mixRgb(rgb("#2f3a33"), DEEP, L.dark * 0.5));
    const chalk = mixRgb(rgb("#d8d3c8"), DEEP, L.dark * 0.4);
    for (let y = by + 2, row = 0; y < by + boardH - 1; y += 2, row++) {
      let x = bx + 2;
      while (x < bx + boardW - 3) {
        const length = 2 + Math.floor(hash(row * 17 + x) * 4);
        fill(b, x, y, Math.min(length, bx + boardW - 2 - x), 1, chalk);
        x += length + 1 + Math.floor(hash(row * 5 + x + 3) * 2);
      }
    }
    const plank = mixRgb(FRAME, DEEP, L.dark);
    const tints = [...TEAS.map((tea) => rgb(TEA_COLORS[tea])), rgb("#8f8f8f"), rgb("#b0442f"), rgb("#3f6f6a")];
    for (let shelfY = by + boardH + 7, row = 0; shelfY < room.sill - 2 && row < 3; shelfY += 7, row++) {
      fill(b, 1, shelfY, width - 2, 1, plank);
      for (let x = 2, index = 0; x < width - 4; index++) {
        const w = 2 + Math.floor(hash(row * 40 + index) * 2);
        const h = 3 + Math.floor(hash(row * 40 + index + 9) * 2);
        const color = mixRgb(tints[Math.floor(hash(row * 40 + index + 3) * tints.length)], L.shade, 0.3 + L.dark);
        fill(b, x, shelfY - h, w, h, color);
        fill(b, x, shelfY - h, w, 1, mixRgb(color, DEEP, 0.3));
        x += w + 1;
      }
    }
  }

  /** A potted plant on the right wall, if there is one. */
  function paintRightWall(b: Buf) {
    const width = room.cols - room.winR - 1;
    if (width < 10) return;
    const L = light;
    const x = room.winR + 1 + Math.round(width / 2) - 3;
    const y = room.sill - 4;
    fill(b, x - 1, room.sill - 1, 8, 1, mixRgb(FRAME, DEEP, L.dark));
    fill(b, x, y, 6, 3, mixRgb(rgb("#b0603e"), DEEP, L.dark));
    fill(b, x - 1, y, 8, 1, mixRgb(rgb("#c97a55"), DEEP, L.dark));
    const leaf = mixRgb(rgb("#5a8f4e"), DEEP, L.dark);
    const leafDark = mixRgb(rgb("#3f6f3a"), DEEP, L.dark);
    for (let index = 0; index < 18; index++) {
      const lx = x + 3 + Math.round((hash(index + 900) - 0.5) * 9);
      const ly = y - 1 - Math.floor(hash(index + 910) * 7);
      px(b, lx, ly, index % 3 ? leaf : leafDark);
      px(b, lx + 1, ly, leaf);
    }
  }

  function paintClockFace(b: Buf) {
    const { x, y, r } = room.clock;
    if (r < 3) return;
    const rim = mixRgb(SOFFIT, DEEP, 0.2);
    if (room.cols - room.winR < 12) fill(b, x, room.soffit, 1, y - r - room.soffit, rim);
    disc(b, x, y, r, rim);
    disc(b, x, y, r - 1, CREAM_RGB);
    px(b, x, y - r + 1, rgb("#e85d4c"));
    px(b, x + r - 1, y, rim);
    px(b, x, y + r - 1, rim);
    px(b, x - r + 1, y, rim);
  }

  // --- The room: moving things -------------------------------------------------------

  const doorX = () => ((room.doorL + room.doorR) / 2) * SC;

  function guestSlot(index: number) {
    return room.lineL + ((index + 0.5) * room.lineW) / MAX_TICKETS;
  }

  function swingDoor() {
    if (reduceMotion) return;
    doorAge = 0;
    bellAge = 0;
  }

  /** Keeps a figure for every guest on the line, and walks the leavers out. */
  function stepFolk(dt: number) {
    guests.forEach((guest, index) => {
      if (folk.some((item) => item.id === guest.id)) return;
      folk.push({
        id: guest.id,
        guest,
        x: reduceMotion ? guestSlot(index) : doorX(),
        leaving: null,
        age: 0,
        rate: 1.4 + hash(guest.id) * 1.2,
        hop: 10,
        phase: hash(guest.id + 3) * 6,
      });
      swingDoor();
    });
    for (let index = folk.length - 1; index >= 0; index--) {
      const item = folk[index];
      item.age += dt;
      item.hop += dt;
      const slot = guests.indexOf(item.guest);
      if (slot < 0 && !item.leaving) {
        item.leaving = item.guest.outcome ?? "gone";
        item.age = 0;
      }
      if (item.leaving && reduceMotion) {
        folk.splice(index, 1);
        continue;
      }
      // A served guest hops first, then everyone leaving heads for the door.
      if (item.leaving === "served" && item.age < 0.3) continue;
      const target = item.leaving ? doorX() : guestSlot(slot);
      const step = 260 * (figureCell() / SC) * dt;
      if (reduceMotion) item.x = target;
      else item.x += clamp(target - item.x, -step, step);
      if (item.leaving && Math.abs(item.x - target) < 1) {
        folk.splice(index, 1);
        swingDoor();
      }
    }
  }

  function stepWalkers(dt: number) {
    const left = room.winL * SC - 48;
    const right = room.winR * SC + 48;
    for (const walker of walkers) {
      if (!walker.active) continue;
      walker.x += walker.dir * walker.speed * dt;
      if (walker.x < left - 40 || walker.x > right + 40) walker.active = false;
    }
    walkerTimer -= dt;
    if (walkerTimer > 0) return;
    const rush = phase === "rush";
    walkerTimer = (rush ? 0.7 : 1.8) + Math.random() * (rush ? 0.9 : 1.8);
    // A quiet street: two at a time by day, four in the rush.
    if (walkers.filter((walker) => walker.active).length >= (rush ? 4 : 2)) return;
    const free = walkers.find((walker) => !walker.active);
    if (!free) return;
    const roll = Math.random();
    free.active = true;
    free.dir = Math.random() < 0.5 ? 1 : -1;
    free.kind = roll < 0.1 ? 2 : roll < 0.22 ? 1 : 0;
    free.speed = free.kind === 2 ? 70 + Math.random() * 20 : 18 + Math.random() * 14;
    free.x = free.dir > 0 ? left : right;
  }

  function stepSteam(dt: number) {
    if (room.urnX < 0) return;
    steamTimer -= dt;
    if (steamTimer <= 0) {
      steamTimer = 0.26;
      const puff = steam.find((item) => !item.active);
      if (puff) {
        puff.active = true;
        puff.x = (room.urnX + 3.5) * SC;
        puff.y = room.counterPx - URN_ROWS * SC;
        puff.age = 0;
        puff.life = 1.2 + Math.random() * 0.8;
        puff.seed = Math.random() * 6;
      }
    }
    for (const puff of steam) {
      if (!puff.active) continue;
      puff.age += dt;
      puff.y -= 22 * dt;
      puff.x += Math.sin(puff.age * 3 + puff.seed) * 10 * dt;
      if (puff.age >= puff.life) puff.active = false;
    }
  }

  /** Advances the room on the game clock, so it freezes with the pause. */
  function stepRoom(dt: number) {
    if (!room.cols) return;
    bakeRoom();
    stepFolk(dt);
    doorAge += dt;
    bellAge += dt;
    flareAge += dt;
    sparkAge += dt;
    veilAge += dt;
    if (reduceMotion) return;
    stepWalkers(dt);
    stepSteam(dt);
  }

  function blitCells(g: CanvasRenderingContext2D, grid: string[], x: number, y: number, color: string, mirror: boolean, size = SC) {
    g.fillStyle = color;
    const width = grid[0].length;
    grid.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === ".") return;
        g.fillRect(x + (mirror ? width - 1 - c : c) * size, y + r * size, size, size);
      }),
    );
  }

  /**
   * The guests' cell: from the bench's cup cell, so a figure's visible head
   * and shoulders stand about 60% of the cup's height at every width.
   */
  const figureCell = () => Math.max(2, Math.round((0.6 * CUP_H * cell) / (FIGURE_ROWS - 2)));

  function drawWalkers(g: CanvasRenderingContext2D) {
    if (reduceMotion) return;
    const color = css(mixRgb(light.town, STREET_DARK, 0.5));
    const feet = (room.street + 2) * SC;
    for (const walker of walkers) {
      if (!walker.active) continue;
      const x = Math.round(walker.x / SC) * SC;
      const frame = Math.floor(walker.x / (SC * 3)) & 1;
      const mirror = walker.dir < 0;
      const sprite = walker.kind === 2 ? BIKE[frame] : WALKER[frame];
      blitCells(g, sprite, x, feet - sprite.length * SC, color, mirror);
      if (walker.kind === 1) blitCells(g, DOG[frame], x - walker.dir * 7 * SC, feet - DOG[0].length * SC, color, mirror);
    }
  }

  function drawClouds(g: CanvasRenderingContext2D) {
    if (light.p >= 0.72) return;
    const tint = light.p < 0.4 ? "#f6eee2" : "#f5c6a5";
    const glassW = (room.winR - room.winL) * SC;
    g.fillStyle = tint;
    for (let index = 0; index < 2; index++) {
      const w = (12 + index * 6) * SC;
      // The clouds sit still: nothing behind the bench should pull the eye.
      const drift = 0;
      const x = room.winL * SC + ((hash(index + 40) * glassW + drift) % (glassW + w)) - w;
      const y = (room.winT + 3 + index * 5) * SC;
      const sx = Math.round(x / SC) * SC;
      g.fillRect(sx, y + SC, w, SC * 2);
      g.fillRect(sx + 3 * SC, y, w - 7 * SC, SC);
    }
  }

  function drawDoor(g: CanvasRenderingContext2D) {
    const swing = !reduceMotion && doorAge < 0.7 ? Math.sin((doorAge / 0.7) * Math.PI) : 0;
    const top = (room.transom + 1) * SC;
    const bottom = (room.counter + 1) * SC;
    const full = (room.doorR - room.doorL) * SC;
    const width = Math.round((full * (1 - 0.55 * swing)) / SC) * SC;
    const left = room.doorR * SC - width;
    const frame = css(mixRgb(FRAME, DEEP, light.dark));
    g.fillStyle = frame;
    g.fillRect(left, top, SC, bottom - top);
    g.fillRect(room.doorR * SC - SC, top, SC, bottom - top);
    g.fillRect(left, top, width, SC);
    g.fillRect(left + 2 * SC, (room.sill - 2) * SC, SC, 2 * SC);
    if (swing > 0) {
      g.save();
      g.globalAlpha = 0.18;
      g.fillRect(left + SC, top + SC, width - 2 * SC, bottom - top - SC);
      g.restore();
    }
    // The bell above the door, tipping when someone comes or goes.
    const tip = !reduceMotion && bellAge < 1 ? Math.round(Math.sin(bellAge * 18) * Math.exp(-bellAge * 4) * 1.5) : 0;
    const bx = (room.doorL + 3 + tip) * SC;
    const by = (room.transom - 3) * SC;
    g.fillStyle = frame;
    g.fillRect((room.doorL + 3) * SC, by - SC, SC, SC);
    g.fillStyle = "#dba84d";
    g.fillRect(bx - SC, by, 3 * SC, SC);
    g.fillRect(bx - SC, by + SC, 3 * SC, SC);
    g.fillStyle = "#704a05";
    g.fillRect(bx, by + 2 * SC, SC, SC);
  }

  /** The clock's one hand sweeps a full turn over the shift. */
  function drawClockHand(g: CanvasRenderingContext2D) {
    const { x, y, r } = room.clock;
    if (r < 3) return;
    const angle = -Math.PI / 2 + (Math.PI * 2 * clamp(elapsed, 0, SHIFT_SECONDS)) / SHIFT_SECONDS;
    g.fillStyle = css(mixRgb(SOFFIT, DEEP, 0.2));
    for (let s = 0; s <= r - 1.5; s += 0.5) {
      g.fillRect((x + Math.round(Math.cos(angle) * s)) * SC, (y + Math.round(Math.sin(angle) * s)) * SC, SC, SC);
    }
  }

  function drawQueue(g: CanvasRenderingContext2D) {
    const base = Math.round(room.counterPx);
    const fc = figureCell();
    // The lunch rush brings a few more, further back: two thirds the size, darker.
    if (phase === "rush") {
      const cc = Math.max(2, Math.round((fc * 2) / 3));
      const count = 2 + Math.floor(hash(7) * 3);
      const head = css(mixRgb(light.shade, DEEP, 0.35 + light.dark * 0.5));
      const body = css(mixRgb(light.shade, DEEP, 0.5 + light.dark * 0.4));
      for (let index = 0; index < count; index++) {
        const x = Math.round(lerp(room.winL * SC + 16, room.doorL * SC - 40, hash(index + 300)) / cc) * cc;
        const bob = !reduceMotion && Math.sin(clock * (1.1 + hash(index + 310)) + index) > 0.5 ? Math.max(1, Math.round(cc / 2)) : 0;
        const y = base - (CROWD.length + 1) * cc - bob;
        blitCells(g, CROWD.slice(0, 5), x, y, head, false, cc);
        blitCells(g, CROWD.slice(5), x, y + 5 * cc, body, false, cc);
      }
    }
    for (const item of folk) {
      const back = item.leaving === "gone";
      const sprite = figureSprite(item.guest.regular.name, back);
      let lift = 0;
      if (!reduceMotion) {
        if (item.leaving === "served" && item.age < 0.3) lift = Math.round(Math.sin((item.age / 0.3) * Math.PI) * 3) * fc;
        // A sample's hop: twice, quickly.
        else if (!item.leaving && item.hop < 0.5) lift = Math.round(Math.abs(Math.sin((item.hop / 0.5) * 2 * Math.PI)) * 2) * fc;
        else if (!item.leaving && Math.sin(clock * item.rate + item.phase) > 0.55) lift = Math.max(1, Math.round(fc / 2));
      }
      const x = Math.round(item.x - 5 * fc);
      const y = base - (FIGURE_ROWS - 2) * fc - lift;
      g.drawImage(sprite, x, y, 10 * fc, FIGURE_ROWS * fc);
    }
  }

  function drawSteam(g: CanvasRenderingContext2D) {
    if (reduceMotion || room.urnX < 0) return;
    g.save();
    g.fillStyle = "#f6eee2";
    for (const puff of steam) {
      if (!puff.active) continue;
      const k = 1 - puff.age / puff.life;
      g.globalAlpha = 0.35 * k;
      const size = SC;
      g.fillRect(Math.round(puff.x / SC) * SC, Math.round(puff.y / SC) * SC, size, size);
    }
    g.restore();
  }

  /** Lamps flare and gold runs along the transom for a perfect drink; the room dims for a lost guest. */
  function drawRoomEffects(g: CanvasRenderingContext2D) {
    if (reduceMotion) return;
    if (flareAge < 0.5) {
      const strength = 0.7 * (1 - flareAge / 0.5);
      g.fillStyle = "#ffe3a3";
      for (const lx of room.lamps) {
        const cy = room.lampY + 3;
        const r = 14;
        for (let y = -r; y <= r; y++) {
          for (let x = -r; x <= r; x++) {
            const d = Math.hypot(x, y) / r;
            if (d < 1 && bayer(lx + x, cy + y) < strength * (1 - d)) g.fillRect((lx + x) * SC, (cy + y) * SC, SC, SC);
          }
        }
      }
    }
    if (sparkAge < 0.7) {
      const head = lerp(room.winL, room.winR, sparkAge / 0.6);
      g.fillStyle = "#ffd166";
      for (let k = 0; k < 8; k++) {
        const x = Math.round(head - k * 3);
        if (x < room.winL || x >= room.winR) continue;
        g.fillRect(x * SC, (room.transom + (k % 2 ? -1 : 0)) * SC, SC, SC);
      }
      const hx = Math.round(head);
      if (hx >= room.winL && hx < room.winR) {
        g.fillRect(hx * SC, (room.transom - 2) * SC, SC, 5 * SC);
        g.fillRect((hx - 2) * SC, room.transom * SC, 5 * SC, SC);
      }
    }
    if (veilAge < 0.6 && veils.length) {
      const k = veilAge < 0.15 ? 1 : 1 - (veilAge - 0.15) / 0.45;
      const level = Math.min(veils.length - 1, Math.floor(k * veils.length));
      if (k > 0.05) g.drawImage(veils[level], 0, 0, room.cols * SC, room.rows * SC);
    }
  }

  function drawRoom() {
    const far = farCtx;
    const g = nearCtx;
    if (!far || !g || !room.cols || !skyLayer || !streetLayer || !roomLayer || !counterLayer) return;
    const w = room.cols * SC;
    const h = room.rows * SC;
    // Far: the view through the window, softened in CSS like a shallow depth of field.
    far.imageSmoothingEnabled = false;
    far.clearRect(0, 0, w, h);
    far.drawImage(skyLayer, 0, 0, w, h);
    drawClouds(far);
    far.drawImage(streetLayer, 0, 0, w, h);
    drawWalkers(far);
    // Near: the room and everything in it, a little muted.
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, w, h);
    g.drawImage(roomLayer, 0, 0, w, h);
    drawDoor(g);
    drawClockHand(g);
    drawQueue(g);
    g.drawImage(counterLayer, 0, Math.round(room.counterPx) - URN_ROWS * SC, w, counterLayer.height * SC);
    drawSteam(g);
    drawRoomEffects(g);
  }

  function resetRoom() {
    folk = [];
    walkers.forEach((walker) => (walker.active = false));
    steam.forEach((puff) => (puff.active = false));
    walkerTimer = 0.5;
    doorAge = bellAge = flareAge = sparkAge = veilAge = 10;
    bakedStep = -1;
    bakeRoom();
  }

  // --- Rules in motion -------------------------------------------------------------

  /** Full tanks, a fresh special, and the samples back, for a new shift. */
  function resetShiftExtras() {
    tanks = TEAS.map(() => TANK_CAPACITY);
    brewEnds = TEAS.map(() => 0);
    brewing = TEAS.map(() => -1);
    samplesLeft = SAMPLES_PER_SHIFT;
    criticSeen = false;
    special = pickSpecial();
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
    arrivalTimer = 0;
    arrivalIn = Infinity;
    addGuest();
    liveMessage = `Today's special is ${TEA_NAMES[special]}. ${liveMessage}`;
    // A HUD button clicked during the countdown would otherwise keep Space.
    if (document.activeElement instanceof HTMLButtonElement && playScope?.contains(document.activeElement)) {
      focusPlayfield();
    }
  }

  function startCountdown() {
    countdown = COUNTDOWN_SECONDS;
    countdownElapsed = 0;
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
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
        streamSound(1, cup.level);
      } else {
        streamSound(0);
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
        if (cup.sealValue !== null && sealResult(cup.sealValue) === "scorched") {
          sfxScorch();
          smokePuff();
        }
      }
      if (!cup.burst && t >= HOP_START) {
        cup.burst = true;
        const judged = judge(cup);
        if (judged?.result.accepted && judged.result.total >= PERFECT) pearlBurst();
      }
      if (t >= SEAL_SECONDS) serveCup();
    }
  }

  function stepBeats() {
    if (!beats.length) return;
    const due = beats.filter((beat) => beat.at <= clock);
    if (!due.length) return;
    beats = beats.filter((beat) => beat.at > clock);
    for (const beat of due) beat.run();
  }

  function frame(timestamp: number) {
    if (!active) return;
    if (!last) last = timestamp;
    const rawDt = (timestamp - last) / 1000;
    last = timestamp;
    const dt = Math.min(rawDt, 0.05);

    if (paused || askFirst || demoEnd) {
      // Still drawn, so the theme toggle shows through a card; the room
      // holds still, since its time is the game's.
      drawRoom();
      draw();
      raf = requestAnimationFrame(frame);
      return;
    }

    if (demoOn) {
      // The demo's own clock; the shift's is set aside, so it holds.
      clock += dt;
      stepDemo(dt);
      stepCup(dt);
      stepBeats();
      if (receipt && clock >= receipt.until) receipt = null;
      if (notice && clock >= notice.until) notice = null;
      guestRefresh += dt;
      if (guestRefresh >= 0.1) {
        guestRefresh = 0;
        guests = guests;
        refreshTanks();
      }
      stepEffects(dt);
      stepRoom(dt);
      drawRoom();
      draw();
      raf = requestAnimationFrame(frame);
      return;
    }

    if (!running) {
      const step = stepCountdown(countdownElapsed, countdown, Math.min(rawDt, 0.25));
      countdownElapsed = step.elapsed;
      if (step.beep) {
        countdown = step.count;
        sfxCountdown(countdown);
      }
      if (step.done) beginShift();
      drawRoom();
      draw();
      raf = requestAnimationFrame(frame);
      return;
    }

    clock += dt;
    elapsed += dt;
    timeLeft = timeRemaining(elapsed);
    if (elapsed >= SHIFT_SECONDS) {
      void endGame("time");
      return;
    }

    const pace = paceForElapsed(elapsed);
    if (pace.phase !== phase) {
      phase = pace.phase;
      setMusicPhase(phase);
      liveMessage = phase === "rush" ? "Lunch rush." : "Steady trade.";
    }

    // The next guest is due on the pace, or soon after the counter empties.
    // A full line means they wait at the door.
    arrivalTimer = Math.min(arrivalTimer + dt, pace.arrivalEvery);
    arrivalIn = Math.min(arrivalIn - dt, nextArrivalIn(pace, guests.length, arrivalTimer));
    if (arrivalIn <= 0 && guests.length < MAX_TICKETS) {
      arrivalTimer = 0;
      arrivalIn = Infinity;
      addGuest();
    }

    // Patience: slower for the guest who can see their drink being made, and
    // frozen once it is stamped.
    for (const guest of [...guests]) {
      const mine = making?.guestId === guest.id;
      if (mine && making?.stampAt !== null) continue;
      guest.left -= dt * (mine ? ACTIVE_PATIENCE_RATE : 1);
      if (guest.left <= 0) {
        walkOut(guest);
        if (gameOver) return;
      }
    }
    stepBrewing();
    guestRefresh += dt;
    if (guestRefresh >= 0.1) {
      guestRefresh = 0;
      guests = guests;
      refreshTanks();
    }

    stepCup(dt);
    stepBeats();
    if (gameOver) return;
    if (receipt && clock >= receipt.until) receipt = null;
    if (notice && clock >= notice.until) notice = null;

    stepEffects(dt);
    stepRoom(dt);
    drawRoom();
    draw();
    raf = requestAnimationFrame(frame);
  }

  // --- The demo, in motion -------------------------------------------------------------

  function shelve(): Shelved {
    return {
      guests,
      making,
      tapIndex,
      jarIndex,
      tanks,
      brewEnds,
      receipt,
      notice,
      clock,
      takeLockUntil,
      beats,
      falling,
      particles,
      popups,
      iceArcs,
      cupX,
      wobble,
      tapReach,
      folk,
    };
  }

  function unshelve(saved: Shelved) {
    guests = saved.guests;
    making = saved.making;
    tapIndex = saved.tapIndex;
    jarIndex = saved.jarIndex;
    tanks = saved.tanks;
    brewEnds = saved.brewEnds;
    receipt = saved.receipt;
    notice = saved.notice;
    clock = saved.clock;
    takeLockUntil = saved.takeLockUntil;
    beats = saved.beats;
    falling = saved.falling;
    particles = saved.particles;
    popups = saved.popups;
    iceArcs = saved.iceArcs;
    cupX = saved.cupX;
    wobble = saved.wobble;
    tapReach = saved.tapReach;
    folk = saved.folk;
    refreshTanks();
  }

  /** A fresh bench for the demo: its own guest (still to come), cup, and full tanks. */
  function layDemo() {
    holds.clear();
    streamOn = false;
    guests = [];
    making = null;
    tapIndex = DEMO_START_TAP;
    jarIndex = DEMO_START_JAR;
    tanks = TEAS.map(() => TANK_CAPACITY);
    brewEnds = TEAS.map(() => 0);
    refreshTanks();
    receipt = null;
    notice = null;
    clock = 0;
    takeLockUntil = 0;
    beats = [];
    falling = [];
    particles = [];
    popups = [];
    iceArcs = [];
    cupX = spoutX[tapIndex] ?? W / 2;
    wobble = 0;
    tapReach = 1;
    folk = [];
    demoTask = null;
    demoCaption = "";
    enterDemoStep(0);
    demoPress = "";
    demoEnd = false;
  }

  /** Opens the demo; mid-shift, the shift freezes exactly as a pause would. */
  async function openDemo() {
    if (demoOn || gameOver || paused) return;
    askFirst = false;
    releaseAll();
    demoMidShift = running;
    if (running) setMusicPaused(true);
    shelved = shelve();
    demoOn = true;
    layDemo();
    sfxBlip();
    liveMessage = "Demo: one drink, made start to finish.";
    last = 0;
    await tick();
    skipButton?.focus();
  }

  async function finishDemo() {
    if (!demoOn || demoEnd) return;
    demoTask = null;
    releaseAll();
    demoPress = "";
    demoCaption = "";
    demoEnd = true;
    liveMessage = "Demo over. Your turn.";
    await tick();
    endButton?.focus();
  }

  async function watchAgain() {
    if (!demoOn) return;
    layDemo();
    sfxBlip();
    last = 0;
    await tick();
    skipButton?.focus();
  }

  /** Puts the shift back as it was and carries on: resumed, or on to the countdown. */
  function closeDemo() {
    if (!demoOn || !shelved) return;
    releaseAll();
    const saved = shelved;
    shelved = null;
    demoOn = false;
    demoEnd = false;
    demoTask = null;
    demoCaption = "";
    demoPress = "";
    unshelve(saved);
    last = 0;
    sfxBlip();
    if (demoMidShift && running) {
      setMusicPaused(false);
      liveMessage = "Shift resumed";
    } else if (!running) {
      startCountdown();
    }
    focusPlayfield();
  }

  async function askAboutDemo() {
    askFirst = true;
    liveMessage = "First shift? Watch one drink being made first.";
    await tick();
    watchButton?.focus();
  }

  function answerFirst(watch: boolean) {
    if (!askFirst) return;
    askFirst = false;
    if (watch) {
      void openDemo();
      return;
    }
    sfxBlip();
    startCountdown();
    focusPlayfield();
  }

  /** Shows a control as pressed while the script uses it. */
  function pressFor(id: string, seconds = DEMO_PRESS_SECONDS) {
    demoPress = id;
    demoPressUntil = clock + seconds;
  }

  let demoGuestId = -1;

  function addDemoGuest() {
    const order = { ...DEMO_ORDER, toppings: DEMO_ORDER.toppings.map((line) => ({ ...line })) };
    guests = [
      {
        id: demoGuestId--,
        regular: DEMO_REGULAR,
        order,
        patience: DEMO_PATIENCE,
        left: DEMO_PATIENCE,
        tilt: -0.8,
        outcome: null,
      },
    ];
    sfxTicket();
    liveMessage = `${DEMO_REGULAR.name} is waiting: ${describeOrder(order)}.`;
  }

  /** Runs the script: waits, then starts each step and steps it until it is done. */
  function stepDemo(dt: number) {
    if (demoEnd) return;
    if (demoPress && clock >= demoPressUntil) demoPress = "";
    if (demoTask) {
      if (!demoTask(dt)) return;
      demoTask = null;
      enterDemoStep(demoIndex + 1);
    }
    demoWait -= dt;
    if (demoWait > 0) return;
    const step = DEMO_SCRIPT[demoIndex];
    if (!step) {
      void finishDemo();
      return;
    }
    demoTask = demoAction(step);
  }

  /**
   * Makes a step current: its caption shows straight away, so it reads
   * during the step's wait (the beat before the action) and stays until
   * the next step begins. The receipt's caption waits for the receipt.
   */
  function enterDemoStep(index: number) {
    demoIndex = index;
    const step = DEMO_SCRIPT[index];
    demoWait = step?.wait ?? 0;
    if (step?.caption && step.act !== "receipt") showCaption(step.caption);
  }

  function showCaption(text: string) {
    demoCaption = text;
    liveMessage = text;
  }

  /**
   * One step of the script, as a task stepped each frame until it returns
   * true. Each calls what the player's own input calls, at a human pace.
   */
  function demoAction(step: DemoStep): (dt: number) => boolean {
    switch (step.act) {
      case "arrive":
        return () => {
          addDemoGuest();
          return true;
        };
      case "take":
        return () => {
          pressFor("ticket-0");
          take(0);
          return true;
        };
      case "ice": {
        let left = demoIceScoops(making?.order ?? DEMO_ORDER);
        let timer = 0;
        return (dt) => {
          if (left <= 0 || !making) return true;
          timer -= dt;
          if (timer > 0) return false;
          pressFor("ice");
          addIce();
          left -= 1;
          timer = step.every ?? 0.5;
          return left <= 0;
        };
      }
      case "pour": {
        const index = step.tap ?? 0;
        const target = demoPourTarget(making?.order ?? DEMO_ORDER);
        let since = -1;
        return (dt) => {
          const cup = making;
          if (!cup) return true;
          if (since < 0) {
            // Press the tap: the cup slides under it, and a beat later the tea runs.
            selectTap(index);
            pressFor(`tap-${index}`, Infinity);
            since = 0;
            return false;
          }
          since += dt;
          if (since < 0.35) return false;
          if (!holds.has("demo") && cup.station === "pour" && !cup.busy) startHold("demo");
          if (cup.level >= target || cup.busy || cup.station !== "pour") {
            endHold("demo", true);
            demoPress = "";
            return true;
          }
          return false;
        };
      }
      case "jar":
        return () => {
          moveJar(step.dir ?? 0);
          return true;
        };
      case "drop": {
        let previous = Number.NaN;
        return () => {
          const cup = making;
          if (!cup || cup.station !== "scoop") return !cup;
          if (cup.busy || clock < cup.loadedAt) return false;
          const x = ladleNow(cup).x;
          const hit = Number.isFinite(previous) && reachedTarget(previous, x, 0, DEMO_DROP_WITHIN);
          previous = x;
          if (!hit) return false;
          pressFor("hand");
          drop();
          return true;
        };
      }
      case "shake": {
        let left = step.count ?? SHAKES_NEEDED;
        let timer = 0;
        return (dt) => {
          const cup = making;
          if (!cup || left <= 0) return true;
          if (cup.station !== "shake" || cup.busy) return false;
          timer -= dt;
          if (timer > 0) return false;
          pressFor("hand", 0.09);
          shake();
          left -= 1;
          timer = step.every ?? 0.16;
          return left <= 0;
        };
      }
      case "seal": {
        let previous = Number.NaN;
        return () => {
          const cup = making;
          if (!cup) return true;
          if (cup.station !== "seal" || cup.busy) return false;
          const value = sealNeedle(clock - cup.sealStart);
          const hit = Number.isFinite(previous) && reachedTarget(previous, value, DEMO_SEAL_AIM, DEMO_SEAL_WITHIN);
          previous = value;
          if (!hit) return false;
          pressFor("hand");
          stamp();
          return true;
        };
      }
      case "receipt": {
        let shownAt = -1;
        return () => {
          if (shownAt < 0) {
            if (!receipt) return false;
            shownAt = clock;
            if (step.caption) showCaption(step.caption);
          }
          return clock - shownAt >= (step.hold ?? 2.5);
        };
      }
      default:
        return () => {
          void finishDemo();
          return true;
        };
    }
  }

  // --- Input ---------------------------------------------------------------

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Tab") {
      onPlayfieldTab(event);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (gameOver || paused || askFirst) return;
    const key = event.key;

    if (demoOn) {
      // Space or Enter skips to the end card; a focused button keeps them.
      if ((key === " " || key === "Enter") && !demoEnd && !isOnControl(event)) {
        event.preventDefault();
        if (!event.repeat) void finishDemo();
      }
      return;
    }
    if (!running) return;

    if (key === " " || key === "Enter") {
      // A focused control keeps Space and Enter for itself.
      if (isOnControl(event)) return;
      event.preventDefault();
      if (!event.repeat) act("key");
      return;
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      if (event.repeat || !making) return;
      const direction = key === "ArrowLeft" ? "left" : "right";
      if (making.station === "pour") moveTap(direction === "left" ? -1 : 1);
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
      if (event.repeat || making?.station !== "pour") return;
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
    if (Number.isInteger(number) && number >= 1 && number <= MAX_TICKETS) {
      event.preventDefault();
      if (!event.repeat) take(number - 1);
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.key === " " || event.key === "Enter") endHold("key", true);
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
    if (demoOn || !tapLive(index) || !selectTap(index)) return;
    capture(event);
    startHold("tap");
  }

  function tapKey(event: KeyboardEvent, index: number, down: boolean) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!down) {
      endHold("tap-key", true);
      return;
    }
    if (demoOn || event.repeat || !tapLive(index) || !selectTap(index)) return;
    startHold("tap-key");
  }

  /** The hand acts on pointer down, never waiting for a click. */
  function handDown(event: PointerEvent, source: string) {
    if (!isPrimary(event)) return;
    event.preventDefault();
    if (demoOn || !making) return;
    capture(event);
    act(source);
  }

  /** The bench: a jar marks that jar at the scoop; anywhere else is the hand. */
  function benchDown(event: PointerEvent) {
    if (!isPrimary(event)) return;
    event.preventDefault();
    const cup = making;
    if (demoOn || !cup) return;
    if (cup.station === "scoop" && !cup.busy) {
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
    if (!down) endHold("hand-key", true);
    else if (!event.repeat && !demoOn) act("hand-key");
  }

  // --- Pause, restart, and finish -----------------------------------------

  async function pauseGame() {
    // The demo and the first-shift question already hold the shift.
    if (gameOver || paused || demoOn || askFirst) return;
    paused = true;
    releaseAll();
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

  /** Where Tab cycles: the first-shift question, the demo's controls, or the game. */
  function trapScope(): Element | null {
    if (askFirst) return firstCard ?? null;
    if (demoOn) return (demoEnd ? endCard : demoBar) ?? null;
    return playScope;
  }

  function togglePause() {
    if (demoOn || askFirst) return;
    if (paused) resumeGame();
    else void pauseGame();
  }

  async function endGame(reason: "hearts" | "time") {
    if (gameOver) return;
    gameOver = true;
    running = false;
    active = false;
    endReason = reason;
    cancelAnimationFrame(raf);
    releaseAll();
    // A half-made cup is abandoned with the shift.
    making = null;
    beats = [];
    falling = [];
    iceArcs = [];
    const result = concludeRun("orders", score, reason);
    localBest = result.best;
    newBest = result.newBest;
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
    takeLockUntil = 0;
    recent = [];
    tapReach = 1;
    resetShiftExtras();
    resetRoom();
    beats = [];
    falling = [];
    particles = [];
    popups = [];
    iceArcs = [];
    last = 0;
    active = true;
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
    raf = requestAnimationFrame(frame);
  }

  // --- Sizing and lifecycle ------------------------------------------------

  /** Sizes the bench to its box, picks the grid, and lines the spouts and the bin up with their buttons. */
  function sizeBench() {
    if (!benchArt || !canvas) return;
    const rect = benchArt.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    ctx = fitCanvas(canvas, W, H);
    // Whole-pixel cells, sized so the cup stands about CUP_SHARE of the bench;
    // everything judged from the cup is measured in the same cells.
    cell = Math.round((H * CUP_SHARE) / CUP_H);
    cell = Math.max(2, Math.min(cell, Math.floor(H / ROWS_NEEDED), Math.floor(W / COLS_NEEDED)));
    counterY = H - 3 * cell;
    cupTop = counterY - CUP_H * cell;
    spoutX = TEAS.map((_, index) => {
      const tap = tapEls[index];
      if (!tap) return ((index + 1.5) / (TEAS.length + 1)) * W;
      const box = tap.getBoundingClientRect();
      return box.left + box.width / 2 - rect.left;
    });
    if (iceEl) {
      const box = iceEl.getBoundingClientRect();
      binX = box.left + box.width / 2 - rect.left;
    } else {
      binX = (0.5 / (TEAS.length + 1)) * W;
    }
    // Re-seat the cup where it belongs on the new layout, without a slide.
    if (making) cupX = making.station === "pour" ? spoutX[tapIndex] : W / 2;
    // The room lines up with the bench, the taps and the line, so it follows.
    layoutRoom();
    drawRoom();
    draw();
  }

  function measure() {
    if (hud) hudHeight = hud.getBoundingClientRect().bottom;
    sizeBench();
  }

  onMount(() => {
    popupFont = arcadeFont();
    special = pickSpecial();
    // The first time here, ask about the demo before the countdown starts.
    if (firstVisit("orders")) void askAboutDemo();
    else sfxCountdown(COUNTDOWN_SECONDS);

    const smallQuery = window.matchMedia("(max-width: 640px)");
    const onSmall = () => {
      small = smallQuery.matches;
      facePx = small ? 3 : 4;
      void tick().then(measure);
    };
    small = smallQuery.matches;
    facePx = small ? 3 : 4;
    smallQuery.addEventListener("change", onSmall);

    const unmountShell = mountShell({
      isOver: () => gameOver,
      isPaused: () => paused,
      pause: () => void pauseGame(),
      togglePause,
      playScope: trapScope,
      onResize: measure,
      // The demo row and the HUD's second row change where the counter starts.
      observe: hud,
      onReduceMotion: (reduce) => (reduceMotion = reduce),
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


    measure();
    raf = requestAnimationFrame(frame);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      timers.clear();
      setPourStream(0);
      stopMusic();
      benchObserver.disconnect();
      smallQuery.removeEventListener("change", onSmall);
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
          {#key streak}
            <span class="boba-combo" class:active={streak > 1}>
              {streak > 1 ? `×${streak} streak` : "no streak yet"}
            </span>
          {/key}
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
        <HudButtons {paused} disabled={demoOn || askFirst} on:pause={togglePause} />
      </div>

      <!-- The demo: under the end ticket, before and during a shift (on a
           phone, beside the timer on the second row). While it plays, the
           same spot skips it. -->
      {#if !gameOver}
        <div bind:this={demoBar} class="ou-demo-bar">
          {#if demoOn && !demoEnd}
            <button
              bind:this={skipButton}
              type="button"
              class="boba-btn secondary ou-demo-btn"
              on:click={() => void finishDemo()}
            >
              Skip demo
            </button>
          {:else}
            <button
              type="button"
              class="boba-btn secondary ou-demo-btn"
              disabled={paused || askFirst || demoOn}
              on:mousedown={keepFocus}
              on:click={() => void openDemo()}
            >
              Demo
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </header>

  <div class="ou-counter boba-ui" style={`--hud-h: ${hudHeight}px`}>
    <div bind:this={columnEl} class="ou-column">
      <!-- The line: regulars clip onto a rail as they arrive. The demo swaps
           in its own line without the shift's guests playing their exits. -->
      <section class="ou-line" aria-label="Customers">
        <span class="ou-wire" aria-hidden="true"></span>
        <ol bind:this={lineEl} class="ou-guests">
          {#key demoOn}
            {#each guests as guest, index (guest.id)}
              {@const share = Math.max(0, guest.left / guest.patience)}
              {@const mood = moodFor(share)}
              {@const mine = making?.guestId === guest.id}
              {@const critic = guest.regular.quirk === "critic"}
              <li
                class="ou-slot"
                in:arrive={{ guest }}
                out:leave={{ guest }}
                animate:flip={{ duration: reduceMotion ? 0 : 260 }}
              >
                <button
                  type="button"
                  class="ou-guest boba-riso is-small"
                  class:has-slab={share < 0.3}
                  class:is-making={mine}
                  class:is-demo-press={demoPress === `ticket-${index}`}
                  style={`--tilt: ${guest.tilt}deg`}
                  aria-pressed={mine}
                  aria-label={guestLabel(guest, mood, mine)}
                  aria-keyshortcuts={String(index + 1)}
                  on:mousedown={keepFocus}
                  on:click={() => !demoOn && take(index)}
                >
                  <span class="ou-clip" aria-hidden="true"></span>
                  <span class="ou-head">
                    <span class="ou-face">
                      <PixelIcon grid={faceGrid(guest.regular.name, mood, critic)} palette={facePalette(guest.regular.name)} px={facePx} />
                    </span>
                    <span class="ou-who">
                      <span class="ou-name">{guest.regular.name}</span>
                      <span class="ou-tag">{guest.regular.tag}</span>
                    </span>
                    {#if !mine}
                      <kbd class="ou-key">{index + 1}</kbd>
                    {/if}
                  </span>
                  {#if mine || guest.regular.quirk}
                    <span class="ou-pills">
                      {#if mine}<span class="ou-pill is-making">making</span>{/if}
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
                      {TEA_NAMES[guest.order.tea]}
                      {#if guest.order.tea === special}
                        <span class="ou-star" aria-hidden="true"><PixelIcon grid={STAR} palette={{ O: "currentColor" }} px={2} /></span>
                      {/if}
                    </span>
                    <span class="ou-item">
                      <span class="ou-icon">
                        {#each Array(ICE_ICONS[guest.order.ice]) as _}<span class="ou-cube"></span>{/each}
                      </span>
                      {ICE_NAMES[guest.order.ice]}
                    </span>
                    {#each guest.order.toppings as line}
                      <span class="ou-item">
                        <span class="ou-icon">
                          <PixelIcon grid={TOPPING_ART[line.kind].grid} palette={toppingIconPalette(line.kind)} px={3} />
                        </span>
                        {TOPPING_NAMES[line.kind]} ×{line.scoops}
                      </span>
                    {/each}
                  </span>
                  <span class="ou-patience" class:is-low={share < 0.3} style={`--left: ${share}`}></span>
                </button>
              </li>
            {/each}
          {/key}
        </ol>
        {#if running && !demoOn && !guests.length}
          <p class="ou-quiet">no one waiting</p>
        {/if}
      </section>

      <!-- The ice bin and the taps: scoop ice in first, then hold a tap to pour. -->
      <div bind:this={tapsEl} class="ou-taps" role="group" aria-label="Ice and taps">
        <div class="ou-tap-slot">
          <button
            bind:this={iceEl}
            type="button"
            class="ou-tap ou-ice"
            class:is-demo-press={demoPress === "ice"}
            aria-label={`Add a scoop of ice, ${iceCount} of ${ICE_MAX} in the cup`}
            aria-keyshortcuts="ArrowUp"
            disabled={!iceOpen}
            on:mousedown={keepFocus}
            on:click={() => !demoOn && addIce()}
          >
            <PixelIcon grid={ICE_ICON} palette={{ O: "currentColor", h: "#ffffff", p: "#dceef4" }} px={3} />
            <span class="ou-tap-name">
              ice
              <span class="ou-cubes" aria-hidden="true">
                {#each Array(ICE_MAX) as _, cube}<span class="ou-cube" class:is-empty={cube >= iceCount}></span>{/each}
              </span>
            </span>
          </button>
          {#if iceOpen && iceCount > 0}
            <button
              type="button"
              class="boba-btn secondary ou-chip"
              aria-label="Take a scoop of ice out"
              aria-keyshortcuts="ArrowDown"
              disabled={demoOn}
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
              class:is-low={brewNow < 0 && tank !== "ok"}
              class:is-demo-press={demoPress === `tap-${index}`}
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
              on:blur={() => endHold("tap-key", false)}
              on:contextmenu={(event) => event.preventDefault()}
            >
              <!-- State never adds a row: a corner star, a dashed edge, a
                   bar along the foot, or the label itself. -->
              {#if tea === special}
                <span class="ou-tap-star" aria-hidden="true"><PixelIcon grid={STAR} palette={{ O: "currentColor" }} px={2} /></span>
                <span class="sr-only">special</span>
              {/if}
              <PixelIcon grid={TEA_URN} palette={{ O: "currentColor", L: TEA_COLORS[tea] }} px={3} />
              <span class="ou-tap-name">
                {#if brewNow >= 0}
                  brewing
                {:else if tank === "empty"}
                  empty
                {:else}
                  <span class="ou-long">{TEA_NAMES[tea]}</span>
                  <span class="ou-short" aria-hidden="true">{TEA_SHORT[tea]}</span>
                {/if}
              </span>
              {#if brewNow >= 0}
                <span class="ou-brew-bar" style={`--done: ${brewNow}`} aria-hidden="true"></span>
              {/if}
            </button>
            {#if brewNow < 0 && tank !== "ok"}
              <button
                type="button"
                class="boba-btn secondary ou-chip"
                aria-label={`Brew ${TEA_NAMES[tea]}`}
                disabled={!running || demoOn}
                on:mousedown={keepFocus}
                on:click={() => brew(index)}
              >
                Brew
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <!-- The bench: the cup and everything that happens to it. -->
      <div class="ou-bench">
        {#if demoOn}
          <!-- The live region reads each caption, so this copy is hidden. -->
          <p class="ou-caption" aria-hidden="true">{demoCaption}</p>
        {/if}
        <div bind:this={benchArt} class="ou-bench-art">
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
          {#if running && !demoOn && !making && !receipt}
            <p class="ou-idle" aria-hidden="true">pick a ticket</p>
          {/if}
          <!-- The live region carries the same news, so this copy is hidden. -->
          {#if receipt}
            {#key receipt.id}
              <div class="ou-receipt boba-riso is-small" aria-hidden="true">
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
                    {#if receipt.streak > 0}
                      <span class="ou-receipt-streak">×{receipt.streak} streak</span>
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

        <!-- The stepper and the prompt share one paper chip over the room. -->
        <div class="ou-status">
          <ol class="ou-steps" class:is-idle={!making} aria-label="Steps">
            {#each steps as step (step.id)}
              <li
                class="ou-step"
                class:is-current={!!making && step.state === "current"}
                aria-current={making && step.state === "current" ? "step" : undefined}
              >
                {#if making && step.state === "current"}<Mark kind="caret" />{/if}
                <span>{step.label}</span>
                {#if step.word}<span class="ou-step-word">{step.word}</span>{/if}
              </li>
            {/each}
          </ol>
          <p class="ou-prompt" class:is-notice={!!notice}>{prompt}</p>
        </div>
      </div>

      <!-- The hand: one big button for whatever the station needs, then the
           dump and the free samples. -->
      <div class="ou-hand">
        <button
          type="button"
          class="boba-btn ou-hand-btn"
          class:is-demo-press={demoPress === "hand"}
          disabled={!handLive}
          on:mousedown={keepFocus}
          on:pointerdown={(event) => handDown(event, "hand")}
          on:pointerup={() => endHold("hand", true)}
          on:pointercancel={() => endHold("hand", false)}
          on:lostpointercapture={() => endHold("hand", false)}
          on:keydown={(event) => handKey(event, true)}
          on:keyup={(event) => handKey(event, false)}
          on:blur={() => endHold("hand-key", false)}
          on:contextmenu={(event) => event.preventDefault()}
        >
          {handLabel}
          {#if handLive && !demoOn}<kbd aria-hidden="true">Space</kbd>{/if}
        </button>
        <button
          type="button"
          class="boba-btn secondary"
          aria-keyshortcuts="Backspace"
          disabled={!handLive || demoOn}
          on:mousedown={keepFocus}
          on:click={dump}
        >
          Dump <kbd aria-hidden="true">⌫</kbd>
        </button>
        <button
          type="button"
          class="boba-btn secondary ou-sample"
          aria-keyshortcuts="S"
          aria-label={`Sample for the guest closest to leaving, ${samplesLeft} left`}
          disabled={!canSample}
          on:mousedown={keepFocus}
          on:click={giveSample}
        >
          Sample
          <span class="ou-pips" aria-hidden="true">
            {#each Array(SAMPLES_PER_SHIFT) as _, pip}<span class="ou-pip" class:is-used={pip >= samplesLeft}></span>{/each}
          </span>
          <kbd aria-hidden="true">S</kbd>
        </button>
      </div>
    </div>
  </div>
</div>

{#if (countdown > 0 || goVisible) && !askFirst && !demoOn}
  <Countdown value={countdown} caption="the counter opens in" goCaption="orders up" />
{/if}

{#if askFirst}
  <div class="boba-scrim boba-ui" role="dialog" aria-modal="true" aria-labelledby="ou-first-title">
    <div bind:this={firstCard} class="boba-card boba-riso" tabindex="-1">
      <h2 id="ou-first-title" class="boba-title">first shift?</h2>
      <p class="boba-deck">Watch one drink being made first.</p>
      <div class="boba-actions is-start">
        <button bind:this={watchButton} type="button" class="boba-btn" on:click={() => answerFirst(true)}>
          Watch demo
        </button>
        <button type="button" class="boba-btn secondary" on:click={() => answerFirst(false)}>Skip</button>
      </div>
    </div>
  </div>
{/if}

{#if demoOn && demoEnd}
  <div class="boba-scrim boba-ui" role="dialog" aria-modal="true" aria-labelledby="ou-end-title">
    <div bind:this={endCard} class="boba-card boba-riso" tabindex="-1">
      <h2 id="ou-end-title" class="boba-title">your turn</h2>
      <div class="boba-actions is-start">
        <button bind:this={endButton} type="button" class="boba-btn" on:click={closeDemo}>
          {demoMidShift && running ? "Back to the shift" : "Start shift"}
        </button>
        <button type="button" class="boba-btn secondary" on:click={() => void watchAgain()}>Watch again</button>
      </div>
    </div>
  </div>
{/if}

{#if paused && !gameOver}
  <PauseCard
    bind:this={pauseCard}
    deck="The shift is on hold."
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
    deck={endReason === "time"
      ? "The shift is over."
      : "Three guests left without a drink."}
    {score}
    {newBest}
    stats={[
      { label: "drinks served", value: served },
      { label: "average grade", value: served ? averageGrade : "–" },
      { label: "perfect drinks", value: perfects },
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

  /* --- The demo --- */

  /* A grid item of the HUD row: under the end ticket, right-aligned with it. */
  .ou-demo-bar {
    display: flex;
    grid-column: 3;
    grid-row: 2;
    align-self: center;
    justify-self: end;
  }

  .ou-demo-btn {
    min-height: 2rem;
    padding: 0 var(--space-3);
    font-size: 0.75rem;
    pointer-events: auto;
  }

  /* Each caption in a paper chip above the bench, one line. */
  .ou-caption {
    flex: none;
    align-self: center;
    max-width: 100%;
    min-height: calc(1.35em + var(--space-1) * 2 + 2px);
    margin: 0;
    padding: var(--space-1) var(--space-3);
    overflow: hidden;
    color: var(--b-strong);
    background: var(--b-paper);
    border: 1px solid var(--b-rule);
    border-radius: var(--radius-inline);
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.35;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ou-caption:empty {
    visibility: hidden;
  }

  /* The control the demo is using shows pressed, with an accent ring. */
  .ou-guest.is-demo-press,
  .ou-tap.is-demo-press {
    box-shadow: 0 0 0 3px var(--b-accent);
  }

  .ou-tap.is-demo-press {
    transform: translateY(1px);
  }

  .ou-hand-btn.is-demo-press {
    --lift: 2px;

    box-shadow: 0 0 0 3px var(--b-accent);
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

  .ou-line {
    position: relative;
    flex: none;
    padding-top: var(--space-3);
  }

  .ou-wire {
    position: absolute;
    inset: var(--space-1) 0 auto;
    height: 2px;
    background: var(--b-line);
  }

  .ou-guests {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
    gap: var(--space-4);
    min-height: 9.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ou-slot {
    min-width: 0;
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
    transition: transform var(--motion-base) var(--ease-emphasized);
  }

  /* The cup on the bench is theirs: the ticket lifts off the rail. */
  .ou-guest.is-making {
    transform: translateY(-3px) rotate(var(--tilt));
  }

  .ou-clip {
    position: absolute;
    top: calc(var(--space-2) * -1 - 1px);
    left: 50%;
    width: 1.25rem;
    height: 0.75rem;
    background: var(--b-line);
    border-radius: 2px 2px 0 0;
    transform: translateX(-50%);
  }

  .ou-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .ou-face {
    display: grid;
    flex: none;
    place-items: center;
    color: var(--b-line);
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
    width: 0.375rem;
    height: 0.375rem;
    background: #dceef4;
    border: 1px solid var(--b-line);
  }

  /* Patience is a pencil line that shortens, turning accent near the end
     (when the face is already frowning, so colour never says it alone). */
  .ou-patience {
    height: 3px;
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

  /* --- The taps --- */

  .ou-taps {
    display: grid;
    flex: none;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-3);
  }

  /* A tap and, when its tank wants it, a Brew chip overlapping its foot.
     The chip is positioned, so the row's height never moves. */
  .ou-tap-slot {
    position: relative;
    display: grid;
    min-width: 0;
  }

  /* One constant height at every width: the icon and the label, nothing
     else in the flow. State lives in a corner, the edge, or the foot. */
  .ou-tap {
    position: relative;
    display: grid;
    overflow: hidden;
    justify-items: center;
    align-content: center;
    gap: var(--space-1);
    height: 3.5rem;
    padding: var(--space-1) var(--space-1);
    color: var(--b-strong);
    background: var(--b-paper);
    border: 1px solid var(--b-rule);
    border-radius: var(--radius-control);
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    line-height: 1.25;
    touch-action: none;
    -webkit-touch-callout: none;
    transition:
      border-color var(--motion-fast) var(--ease-standard),
      opacity var(--motion-fast) var(--ease-standard),
      transform var(--motion-base) var(--ease-emphasized);
  }

  .ou-tap:hover:not(:disabled) {
    border-color: var(--b-muted);
  }

  .ou-tap:active:not(:disabled) {
    transform: translateY(1px);
  }

  /* The cup is under this one: paper and an ink edge. */
  .ou-tap[aria-pressed="true"] {
    background: var(--b-paper);
    border-color: var(--b-line);
    box-shadow: inset 0 0 0 1px var(--b-line);
  }

  /* Not live: the button stays opaque over the room, its label goes muted
     (still above 4.5:1 on the paper), the urn fades, and a dashed edge says
     so without colour. */
  .ou-tap:disabled {
    color: var(--b-muted);
    cursor: default;
    border-style: dashed;
  }

  .ou-tap:disabled :global(.pixel-icon) {
    opacity: 0.55;
  }

  /* A low or empty tank: a heavier dashed accent edge (the chip and the
     machine's window say it too, so colour never says it alone). */
  .ou-tap.is-low,
  .ou-tap.is-low:hover:not(:disabled) {
    border: 2px dashed var(--b-accent);
  }

  .ou-tap-name {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ou-short {
    display: none;
  }

  /* Today's special: a small star in the top corner. */
  .ou-tap-star {
    position: absolute;
    top: 3px;
    right: 4px;
    display: inline-flex;
    color: var(--b-accent);
  }

  /* Brew and Less: a compact chip straddling the button's bottom edge. */
  .ou-chip {
    position: absolute;
    z-index: 1;
    inset: auto 0 -0.625rem;
    width: fit-content;
    min-height: 1.25rem;
    margin-inline: auto;
    padding: 0 var(--space-2);
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

  .ou-cube.is-empty {
    visibility: hidden;
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

  .ou-idle {
    z-index: 1;
    grid-area: 1 / 1;
    margin: 0 0 var(--space-8);
    padding: var(--space-0-5) var(--space-2);
    color: var(--b-strong);
    background: var(--b-paper);
    border-radius: var(--radius-control);
    font-size: 0.9375rem;
    pointer-events: none;
  }

  .ou-receipt {
    position: relative;
    z-index: 2;
    display: flex;
    grid-area: 1 / 1;
    align-items: start;
    gap: var(--space-5);
    width: min(100%, 25rem);
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

  .ou-status {
    display: grid;
    flex: none;
    gap: var(--space-1);
    align-self: center;
    max-width: 100%;
    padding: var(--space-1-5) var(--space-3);
    background: var(--b-paper);
    border: 1px solid var(--b-rule);
    border-radius: var(--radius-inline);
  }

  /* One row of steps and one of prompt, at every width, so the bench above
     never changes height mid-drink. */
  .ou-steps {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    gap: var(--space-1) var(--space-5);
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
    align-items: baseline;
    gap: var(--space-1);
    white-space: nowrap;
  }

  .ou-step.is-current {
    color: var(--b-strong);
    font-weight: 500;
  }

  .ou-step-word {
    color: var(--b-text);
    font-style: italic;
  }

  .ou-prompt {
    min-height: 1.35em;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--b-muted);
    font-size: 0.8125rem;
    font-style: italic;
    line-height: 1.35;
    text-align: center;
  }

  .ou-prompt.is-notice {
    color: var(--b-strong);
  }

  /* --- The hand --- */

  .ou-hand {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
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

  .ou-hand .boba-btn {
    flex: none;
  }

  .ou-hand-btn {
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
     4, stepper about 43), hand (44), three 8px gaps, 8 at the foot. That is
     about 460, leaving room for the demo's caption chip (30) and a card
     with a fourth order line; anything spare goes to the bench. */

  @media (max-width: 640px) {
    .ou-counter {
      padding: calc(var(--hud-h) + var(--space-2)) var(--space-4) max(var(--space-2), env(safe-area-inset-bottom));
    }

    .ou-column {
      gap: var(--space-2);
    }

    /* Beside the centred timer, at the right end of the HUD's second row. */
    .ou-demo-bar {
      grid-column: 2;
      grid-row: 2;
    }

    .ou-demo-btn {
      min-height: 1.75rem;
      padding: 0 var(--space-2);
      font-size: 0.6875rem;
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

    .ou-patience {
      margin-top: 0;
    }

    .ou-quiet {
      top: var(--space-6);
    }

    .ou-taps {
      gap: var(--space-1-5);
      margin-bottom: var(--space-1);
    }

    /* Five across: the icon over a short label. */
    .ou-long {
      display: none;
    }

    .ou-short {
      display: inline;
    }

    .ou-tap {
      gap: var(--space-0-5);
      height: 3rem;
      padding: var(--space-1) 2px;
    }

    .ou-tap-name {
      font-size: 0.6875rem;
    }

    .ou-chip {
      padding-inline: var(--space-1-5);
    }

    .ou-bench {
      gap: var(--space-1);
    }

    /* The stepper: one row of steps (their grades show on the bench as they
       land), one of prompt, tight. */
    .ou-status {
      gap: 2px;
      padding: var(--space-1) var(--space-2-5);
    }

    .ou-steps {
      column-gap: var(--space-3);
      font-size: 0.75rem;
    }

    .ou-step-word {
      display: none;
    }

    .ou-prompt {
      font-size: 0.75rem;
    }

    .ou-caption {
      padding-block: var(--space-0-5);
      font-size: 0.8125rem;
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

    .ou-hand .boba-btn {
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

  /* Three buttons to a 375px row: the key chips give way first. */
  @media (max-width: 420px) {
    .ou-hand kbd {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ou-receipt,
    .ou-stamp {
      animation: none;
    }

    .ou-guest,
    .ou-tap,
    .ou-patience,
    .ou-brew-bar {
      transition: none;
    }
  }
</style>
