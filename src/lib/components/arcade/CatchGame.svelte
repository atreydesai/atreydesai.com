<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { get } from "svelte/store";

  import {
    setMusicPaused,
    setMusicPhase,
    sfxBlip,
    sfxCatch,
    sfxCountdown,
    sfxGolden,
    sfxMilestone,
    sfxMiss,
    sfxStart,
    startMusic,
    stopMusic,
  } from "#lib/sfx.ts";
  import {
    PLAYFIELD_TOP,
    bounceHorizontal,
    catchGolden,
    catchRules,
    clampSpawnCenter,
    createLives,
    difficultyAt,
    dropPearl,
    formatShift,
    isGoldenSpawn,
    isPerfectCatch,
    planThrow,
    pointsForCatch,
    predictLanding,
    shiftCells,
    volleySize,
  } from "#lib/boba-engine.js";
  import {
    ACCENT,
    DRINKS,
    HALO,
    ICON_BOBA,
    ICON_BOBA_PAL,
    INK,
    LID,
    PEARL,
    STRAW_PINK,
    addParticle,
    addPopup,
    arcadeFont,
    drawHalo,
    drawParticles,
    drawPopups,
    drawSprite,
    fitCanvas,
    isDarkTheme,
    risoColors,
    stepParticles,
    stepPopups,
    type Particle,
    type Popup,
  } from "#lib/arcade/art.ts";
  import {
    HOLD,
    LESSONS,
    MOVE_LATEST,
    SETTLE,
    flightPath,
    lessonNow,
    mayOffer,
    nextDown,
    onSpot,
    stillNext,
    type FlightPoint,
  } from "#lib/arcade/catch-lessons.js";
  import { createCoach, type Lesson } from "#lib/arcade/core/coach.ts";
  import { beckon, chalkPath, drawGhost, drawSpotlight, type FocusBox } from "#lib/arcade/core/ghost.ts";
  import { createFrameLoop } from "#lib/arcade/core/loop.ts";
  import { clamp, snap } from "#lib/arcade/core/math.ts";
  import { COUNTDOWN_SECONDS, stepCountdown } from "#lib/arcade/countdown.js";
  import { emojiRows } from "#lib/arcade/share.ts";
  import { arcadeExits, concludeRun, createTimers, isOnControl, mountShell } from "#lib/arcade/shell.ts";
  import { arcadeExpert } from "#lib/boba.ts";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import Coach from "./Coach.svelte";
  import Countdown from "./Countdown.svelte";
  import { REVIVE_BLINK_SECONDS, blinkShows } from "#lib/arcade/blink.ts";
  import ExpertTag from "./ExpertTag.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import Pearls from "./Pearls.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";
  import TrackFlag from "./TrackFlag.svelte";

  const { exit, toMenu } = arcadeExits(createEventDispatcher<{ close: null; menu: null }>());
  type GamePhase = "opening" | "steady" | "rush";
  type Difficulty = ReturnType<typeof difficultyAt>;

  // Read once: the switch lives on the menu.
  const rules = catchRules(get(arcadeExpert));

  // --- Pixel sprites -------------------------------------------------------

  const CUP = [
    "OOOOOOO",
    "OlllllO",
    ".OLLLO.",
    ".OLLLO.",
    ".OLLLO.",
    ".ObLbO.",
    ".OLbLO.",
    "..OOO..",
  ];
  const STRAWS = [
    ["...S...", "...S..."],
    ["....S..", "...S..."],
    [".....S.", "....S.."],
    ["..S....", "...S..."],
    [".S.....", "..S...."],
  ];
  // Thirteen cells at 6px is normal's 78px basket; expert's is nine (54px).
  // The engine's basketWidth is the same number, so a cup is caught exactly
  // where the basket is drawn.
  const BASKET = [
    "DDDDDDDDDDDDD",
    "DgggggggggggD",
    ".DgggggggggD.",
    ".Dg.g.g.g.gD.",
    ".Dg.g.g.g.gD.",
    "..Dg.g.g.gD..",
    "..Dg.g.g.gD..",
    "...DgggggD...",
    "...DDDDDDD...",
  ];
  const BASKET_SMALL = [
    "DDDDDDDDD",
    "DgggggggD",
    ".DgggggD.",
    ".Dg.g.gD.",
    ".Dg.g.gD.",
    "..Dg.gD..",
    "..Dg.gD..",
    "...DgD...",
    "...DDD...",
  ];

  const PAL: Record<string, string> = {
    O: INK,
    l: LID,
    b: PEARL,
    S: STRAW_PINK,
  };
  const GOLD_PAL: Record<string, string> = {
    O: "#6d4511",
    l: "#fff0a6",
    b: "#68400d",
    S: "#fdf8f3",
    L: "#f2b84b",
  };
  const BPAL: Record<string, string> = {
    D: "#5c5c5c",
    g: "#8f8f8f",
  };

  const BOBA_PX = 5;
  const BASKET_PX = 6;
  const BOBA_W = CUP[0].length * BOBA_PX;
  const BOBA_H = (STRAWS[0].length + CUP.length) * BOBA_PX;
  const BASKET_H = BASKET.length * BASKET_PX;
  const BOBA_SPRITE = { width: BOBA_W, height: BOBA_H };
  const MIN_SPAWN_CENTER_Y = PLAYFIELD_TOP + BOBA_H / 2 + 74;
  /** The cups of a volley leave their links a beat apart. */
  const VOLLEY_STAGGER = 0.12;
  /** A throw with nowhere fair to land waits on its link in steps this long… */
  const HOLD_STEP = 0.08;
  /** …and gives up after this long, rather than ever being thrown unfairly. */
  const MAX_HOLD = 1.2;

  const basketW = rules.basketWidth;
  const basketGrid = rules.expert ? BASKET_SMALL : BASKET;

  interface Boba {
    x: number;
    y: number;
    vx: number;
    vy: number;
    gravity: number;
    liquid: string;
    grid: string[];
    golden: boolean;
    /** How it was thrown: a plain throw, a high lob that hangs, or a low flick. */
    kind: "throw" | "lob" | "flick";
    /** Shared by the cups of one pair or three; 0 for a cup thrown alone. */
    volley: number;
    /** When (on the sim clock) and where it reaches the catch line. */
    landAt: number;
    landCenter: number;
    /** It has gone past the catch line uncaught: it can't be caught now, only fall off the page. */
    passed: boolean;
    /** The catch was being shown on it when it went past: the next cup shows it again, and its lost pearl gets no line. */
    retaught: boolean;
  }

  interface PendingSpawn {
    x: number;
    y: number;
    remaining: number;
    telegraph: number;
    held: number;
    golden: boolean;
    source: HTMLElement | null;
    /** The link's centre and size on screen, for the lesson that rings it. */
    link: { x: number; y: number; width: number; height: number } | null;
    volley: number;
  }

  // --- Reactive UI state ---------------------------------------------------

  let score = 0;
  let lives = createLives(rules);
  let combo = 0;
  let bestCombo = 0;
  let caughtCount = 0;
  let perfectCatches = 0;
  let goldenCaught = 0;
  let gameOver = false;
  let paused = false;
  let countdown = COUNTDOWN_SECONDS;
  let goVisible = false;
  let shiftLabel = formatShift(0);
  let phase: GamePhase = "opening";
  let missPulse = 0;
  let missFlash = false;
  let liveMessage = "Boba catch is starting.";
  let localBest = 0;
  let newBest = false;
  let share: string[] = [];
  // Bumped on every start so the song flag starts fresh with the new run.
  let run = 0;

  // --- Lessons -------------------------------------------------------------

  // Taught once per device, inside the live shift: catch-lessons.js says
  // what and when, and the coach slows play and shows one at a time.
  const coach = createCoach("catch");
  /** Seconds on shift that "go" stays up; nothing is taught before it's gone. */
  const GO_SECONDS = 0.62;
  /** The Coach's slip: its text size and padding, its widest, its height on one line, and its margin from the page's edge. */
  const SLIP_FONT_PX = 13;
  const SLIP_PADDING = 24 + 4;
  const SLIP_MAX = 320;
  const SLIP_HEIGHT = 34;
  const SLIP_GUTTER = 16;
  /** The pen loop around a cup in flight (half its size, in px). */
  const CUP_RING = 30;
  /** The chalk's square, on the arcade's 4px grid. */
  const CHALK_CELL = 4;
  type Side = "left" | "right" | "above" | "below";
  interface Cue {
    lesson: Lesson;
    /** The cup it is about, until that cup is caught or falls. */
    cup: Boba | null;
    /** The glowing link it is about, until that link throws. */
    spawn: PendingSpawn | null;
    /** The link itself, so the loop can find it again if the page reflows. */
    element: HTMLElement | null;
    /** What the callout points at: it follows a cup or the basket, and stays put on a link or a landing. */
    anchor: "link" | "landing" | "cup" | "basket";
    /** For the catch: the centre of the cup where it lands, where the basket has to get to. */
    spot: number;
    /** Where the tail points, in viewport px. */
    x: number;
    y: number;
    ring: number;
    /** Half the width of what it points at, when that is wider than the loop (a long link). */
    width: number;
    side: Side;
  }
  let cue: Cue | null = null;
  /** The coach's lesson and whether it's fading, copied out so the page follows them. */
  let coachLesson: Lesson | null = null;
  let coachLeaving = false;
  let coachX: number | null = null;
  let coachY: number | null = null;
  let coachRing = 0;
  let coachWidth = 0;
  let coachSide: Side = "right";
  /** The slip offers Continue while it is explaining (not once the move is made or it is on its way out). */
  let coachContinuable = false;
  /** How dim the page is around an explanation, 0..1, eased in real time. */
  let lessonDim = 0;
  /** The basket, and the thing the lesson is about: what stays lit (reused every frame). */
  const focusBoxes: FocusBox[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
  const basketOnly: FocusBox[] = [focusBoxes[0]];
  /** Light kept round each thing (px), and the wash's cell, on the arcade's 4px grid. */
  const LIGHT_PAD = 12;
  const LIGHT_CELL = 4;
  /** Each lesson's slip as the Coach drew it (Continue and all), measured once it is on the page. */
  const slipSizes = new Map<string, { w: number; h: number }>();
  /** Lessons whose slow motion timed out this run: they wait for a later run. */
  const timedOut = new Set<string>();
  /** What the lessons treat as known: learned on this device, or timed out this run. */
  const known = (id: string) => coach.learned(id) || timedOut.has(id);
  /** Real seconds the catch has been explaining (carried over when it moves to a cup that lands first). */
  let catchFor = 0;

  /**
   * Catch plays on the page, so its marks follow the page's theme: ink on
   * the light paper, cream on the dark. Read at the start of each run.
   */
  let darkPage = false;
  let markColor = risoColors(false).ink;
  /** Real seconds the lessons have run, stopped while paused: it marches the chalk and breathes the ghost. */
  let lessonClock = 0;
  /** Real seconds since the last lesson came down (none yet this run: forever), so two never run together. */
  let quietFor = Infinity;
  /** Real seconds the basket has stayed under the taught cup; a sweep through doesn't count. */
  let settledFor = 0;
  /** The first throw's way down, built once when its lesson starts, and the part still ahead of the cup. */
  const arc: FlightPoint[] = [];
  const arcAhead: Array<{ x: number; y: number }> = [];
  const arcHead = { x: 0, y: 0 };
  /** The sim clock when the arc was built (its points' `t` count from here). */
  let arcFrom = 0;
  /** Where the ghost basket sits, on the basket's own pixel grid. */
  let ghostX = 0;
  let ghostY = 0;
  let reduceMotion = false;
  /** What the lessons read each frame, kept in one object rather than built every frame. */
  const moment = {
    now: 0,
    cups: [] as Boba[],
    waiting: [] as PendingSpawn[],
    pearlDown: false,
    pearlsComeBack: rules.goldensToRestore > 0,
  };

  // --- Canvas and lifecycle state -----------------------------------------

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let popupFont = '500 13px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';
  /** Where focus rests during the shift: not a button, so Enter continues a lesson and Space pauses. */
  let playfieldEl: HTMLElement;
  let playScope: HTMLElement;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;

  let bobas: Boba[] = [];
  let pendingSpawns: PendingSpawn[] = [];
  let particles: Particle[] = [];
  let popups: Popup[] = [];
  /** What happened when, for the share strip. */
  let events: Array<{ time: number; kind: "drop" | "back" | "golden" }> = [];
  let viewW = 0;
  let viewH = 0;
  let basketY = 0;
  let pointerX = 0;
  let mouseX = 0;
  /** Seconds on shift. The ramp reads it. */
  let elapsed = 0;
  let countdownElapsed = 0;
  let spawnTimer = 0;
  let spawnNumber = 0;
  /** Volleys thrown this run, so the cups of one share a number. */
  let volleys = 0;
  let basketSquash = 0;
  /** Seconds the basket has left to flicker after a pearl drops or comes back. */
  let basketBlink = 0;
  let active = true;
  // Paused, nothing moves, so the last frame stays (`redraw` after a resize).
  const loop = createFrameLoop({
    update: (dt, rawDt) => advance(dt, rawDt),
    draw: () => drawScene(),
    isPaused: () => paused,
    drawWhilePaused: false,
  });
  const timers = createTimers();
  const { later } = timers;

  const phaseLabel = (value: GamePhase) => {
    if (value === "rush") return "rush hour";
    if (value === "steady") return "steady pour";
    return "opening shift";
  };

  const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

  // The stage sits over the page: nothing it receives should reach the page.
  function swallow(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // --- Drawing -------------------------------------------------------------

  function drawBoba(boba: Boba) {
    if (!ctx) return;
    const halo = boba.golden ? "rgba(255, 226, 124, 0.9)" : HALO;
    drawHalo(ctx, boba.grid, boba.x, boba.y, BOBA_PX, halo);
    drawSprite(
      ctx,
      boba.grid,
      boba.x,
      boba.y,
      BOBA_PX,
      boba.golden ? GOLD_PAL : { ...PAL, L: boba.liquid },
    );
  }

  function drawBasket(basketX: number) {
    if (!ctx || !blinkShows(basketBlink)) return;
    const context = ctx;
    const drawAt = (x: number, y: number) => {
      drawHalo(context, basketGrid, x, y, BASKET_PX, "rgba(253, 248, 243, 0.62)");
      drawSprite(context, basketGrid, x, y, BASKET_PX, BPAL);
    };

    if (basketSquash <= 0) {
      drawAt(basketX, basketY);
      return;
    }

    const amount = Math.min(1, basketSquash / 0.13);
    context.save();
    context.translate(basketX + basketW / 2, basketY + BASKET_H);
    context.scale(1 + amount * 0.1, 1 - amount * 0.08);
    drawAt(-basketW / 2, -BASKET_H);
    context.restore();
  }

  function drawTelegraph(spawn: PendingSpawn) {
    if (!ctx) return;
    const progress = spawn.held > 0 ? 1 : clamp(1 - spawn.remaining / spawn.telegraph, 0, 1);
    const centerX = spawn.x + BOBA_W / 2;
    const centerY = spawn.y + BOBA_H / 2;
    const radius = 9 + progress * 17;
    const segment = 7;
    const left = Math.round(centerX - radius);
    const top = Math.round(centerY - radius);
    const right = Math.round(centerX + radius);
    const bottom = Math.round(centerY + radius);

    ctx.save();
    ctx.globalAlpha = 0.95 - progress * 0.38;
    ctx.fillStyle = spawn.golden ? "#f2b84b" : ACCENT;
    ctx.fillRect(left, top, segment, 3);
    ctx.fillRect(left, top, 3, segment);
    ctx.fillRect(right - segment, top, segment, 3);
    ctx.fillRect(right - 3, top, 3, segment);
    ctx.fillRect(left, bottom - 3, segment, 3);
    ctx.fillRect(left, bottom - segment, 3, segment);
    ctx.fillRect(right - segment, bottom - 3, segment, 3);
    ctx.fillRect(right - 3, bottom - segment, 3, segment);
    ctx.restore();
  }

  function basketLeft() {
    return clamp(pointerX - basketW / 2, 0, viewW - basketW);
  }

  function basketCenter() {
    return basketLeft() + basketW / 2;
  }

  const paintGhostBasket = (g: CanvasRenderingContext2D) => drawSprite(g, basketGrid, ghostX, ghostY, BASKET_PX, BPAL);

  /**
   * The first throw's lesson, drawn under the cups: the cup's way down in
   * chalk, from the cup to the catch line, and a ghost of the basket where it
   * lands, dithered in the page's ink. Both step aside while the basket is
   * there, and come back if it wanders off.
   */
  function drawLessonGhost() {
    if (!ctx || !cue || cue.anchor !== "landing" || arc.length < 2) return;
    if (coach.current !== cue.lesson || coach.leaving || settledFor > 0) return;
    // The part of the arc still ahead, from the cup itself; the dashes stay
    // put on the path as the cup eats it, and march toward the basket.
    const since = simTime - arcFrom;
    arcAhead.length = 0;
    let consumed = 0;
    if (cue.cup) {
      arcHead.x = cue.cup.x + BOBA_W / 2;
      arcHead.y = cue.cup.y + BOBA_H;
      arcAhead.push(arcHead);
    }
    for (const point of arc) {
      if (point.t <= since) {
        consumed = point.d + Math.hypot(arcHead.x - point.x, arcHead.y - point.y);
        continue;
      }
      arcAhead.push(point);
    }
    chalkPath(ctx, arcAhead, {
      color: markColor,
      cell: CHALK_CELL,
      dash: 1,
      gap: 2,
      offset: consumed - (reduceMotion ? 0 : lessonClock * 24),
    });

    const end = arc[arc.length - 1];
    ghostX = snap(clamp(end.x - basketW / 2, 0, viewW - basketW), BASKET_PX);
    ghostY = snap(basketY, BASKET_PX);
    const density = 0.45 + 0.25 * beckon(lessonClock, reduceMotion, 1.1);
    drawGhost(ctx, ghostX, ghostY, basketW, BASKET_H, paintGhostBasket, { color: markColor, density, cell: BASKET_PX });
  }

  /** Sets `box` to the rectangle x0..x1, y0..y1 with light to spare round it. */
  function lightBox(box: FocusBox, x0: number, y0: number, x1: number, y1: number) {
    box.x = x0 - LIGHT_PAD;
    box.y = y0 - LIGHT_PAD;
    box.w = x1 - x0 + LIGHT_PAD * 2;
    box.h = y1 - y0 + LIGHT_PAD * 2;
  }

  /**
   * The explanation's spotlight: the page dims under a wash of ink, and the
   * basket and what the lesson is about stay in full light: the link, the
   * cup, or (for the catch) the cup, the chalk still ahead of it and the
   * ghost basket where it lands.
   */
  function drawLessonLight() {
    if (!ctx || lessonDim <= 0.01) return;
    const basket = focusBoxes[0];
    const left = basketLeft();
    lightBox(basket, left, basketY, left + basketW, basketY + BASKET_H);
    let boxes = basketOnly;
    if (cue && cue.anchor !== "basket") {
      const thing = focusBoxes[1];
      if (cue.anchor === "link") {
        // The link, and the corner marks of its throw.
        const half = Math.max(cue.width, 26);
        lightBox(thing, cue.x - half, cue.y - 26, cue.x + half, cue.y + 26);
      } else if (cue.anchor === "cup") {
        const x = cue.cup ? cue.cup.x : cue.x - BOBA_W / 2;
        const y = cue.cup ? cue.cup.y : cue.y - BOBA_H / 2;
        lightBox(thing, x, y, x + BOBA_W, y + BOBA_H);
      } else {
        const end = arc[arc.length - 1];
        let x0 = clamp(end.x - basketW / 2, 0, viewW - basketW);
        let x1 = x0 + basketW;
        let y0 = basketY;
        let y1 = basketY + BASKET_H;
        if (cue.cup) {
          x0 = Math.min(x0, cue.cup.x);
          x1 = Math.max(x1, cue.cup.x + BOBA_W);
          y0 = Math.min(y0, cue.cup.y);
          y1 = Math.max(y1, cue.cup.y + BOBA_H);
        }
        const since = simTime - arcFrom;
        for (const point of arc) {
          if (point.t <= since) continue;
          x0 = Math.min(x0, point.x);
          x1 = Math.max(x1, point.x);
          y0 = Math.min(y0, point.y);
          y1 = Math.max(y1, point.y);
        }
        lightBox(thing, x0, y0, x1, y1);
      }
      // (Boxes that touch are lit as one by drawSpotlight itself.)
      boxes = focusBoxes;
    }
    // A dark wash reads on the page in either theme.
    // Over a page of text the dither stays faint, so the words under it still read as words.
    drawSpotlight(ctx, viewW, viewH, boxes, lessonDim, { color: INK, cell: LIGHT_CELL, pattern: "flat", wash: 0.28 });
  }

  function drawScene() {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewW, viewH);
    drawLessonGhost();
    for (const spawn of pendingSpawns) drawTelegraph(spawn);
    for (const boba of bobas) drawBoba(boba);
    drawParticles(ctx, particles);
    drawLessonLight();
    drawPopups(ctx, popups, popupFont);
    drawBasket(basketLeft());
    placeCoach();
  }

  // --- Spawning and effects ------------------------------------------------

  function eligibleLinks() {
    return Array.from(document.querySelectorAll<HTMLElement>("a[href]"))
      .filter(
        (element) =>
          !element.closest(".boba-ui") &&
          !element.classList.contains("boba-source") &&
          !element.classList.contains("boba-source-gold"),
      )
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(
        ({ rect }) =>
          rect.width > 12 &&
          rect.height > 6 &&
          rect.top > MIN_SPAWN_CENTER_Y - 12 &&
          rect.bottom < basketY - 12 &&
          rect.right > 0 &&
          rect.left < viewW,
      );
  }

  /** One throw: a single cup, or a volley from several links at once. */
  function queueVolley(size: number, difficulty: Difficulty) {
    const links = eligibleLinks();
    const volley = size > 1 ? ++volleys : 0;
    for (let index = 0; index < size; index++) {
      queueSpawn(links, difficulty.telegraph + index * VOLLEY_STAGGER, volley);
    }
  }

  function queueSpawn(links: ReturnType<typeof eligibleLinks>, telegraph: number, volley: number) {
    let centerX = BOBA_W / 2 + Math.random() * Math.max(1, viewW - BOBA_W);
    let centerY = MIN_SPAWN_CENTER_Y + Math.random() * Math.max(1, viewH * 0.2);
    let source: HTMLElement | null = null;
    let link: PendingSpawn["link"] = null;

    if (links.length) {
      // Each link throws one cup at a time.
      const [choice] = links.splice((Math.random() * links.length) | 0, 1);
      centerX = choice.rect.left + choice.rect.width / 2;
      centerY = choice.rect.top + choice.rect.height / 2;
      source = choice.element;
      link = { x: centerX, y: centerY, width: choice.rect.width, height: choice.rect.height };
    }

    centerX = clampSpawnCenter(centerX, viewW, BOBA_W);
    centerY = clamp(
      centerY,
      MIN_SPAWN_CENTER_Y,
      Math.max(MIN_SPAWN_CENTER_Y, basketY - BOBA_H / 2 - 28),
    );
    spawnNumber += 1;
    const golden = isGoldenSpawn(spawnNumber);

    source?.classList.add(golden ? "boba-source-gold" : "boba-source");
    pendingSpawns.push({
      x: centerX - BOBA_W / 2,
      y: centerY - BOBA_H / 2,
      remaining: telegraph,
      telegraph,
      held: 0,
      golden,
      source,
      link,
      volley,
    });
  }

  function playfield() {
    return { catchLine: basketY + BASKET_PX, sprite: BOBA_SPRITE, viewportWidth: viewW, basketWidth: basketW };
  }

  /**
   * The cup a link throws, or null if it would land where the basket can't
   * also get to every other cup in time; the link then holds it a moment.
   */
  function launch(spawn: PendingSpawn, difficulty: Difficulty, now: number): Boba | null {
    const others = bobas
      .filter((boba) => boba.landAt > now)
      .map((boba) => ({ time: boba.landAt, center: boba.landCenter }));
    const plan = planThrow(difficulty, spawn, playfield(), others, now);
    if (!plan) return null;

    const straw = STRAWS[(Math.random() * STRAWS.length) | 0];
    return {
      x: spawn.x,
      y: spawn.y,
      vx: plan.vx,
      vy: plan.vy,
      gravity: difficulty.gravity,
      liquid: DRINKS[(Math.random() * DRINKS.length) | 0],
      grid: [...straw, ...CUP],
      golden: spawn.golden,
      kind: plan.kind,
      volley: spawn.volley,
      landAt: plan.landAt,
      landCenter: plan.landCenter,
      passed: false,
      retaught: false,
    };
  }

  function addCatchEffects(boba: Boba, centerX: number, perfect: boolean, points: number) {
    // The basket's squash is a bump: none under Reduce Motion.
    basketSquash = reduceMotion ? 0 : 0.13;
    const primary = boba.golden ? "#f2b84b" : boba.liquid;
    const particleCount = boba.golden ? 14 : perfect ? 11 : 8;
    for (let i = 0; i < particleCount; i++) {
      addParticle(particles, centerX, basketY + 8, i % 3 === 0 ? PEARL : primary, boba.golden ? 125 : 92);
    }

    const text = boba.golden
      ? perfect
        ? `golden & perfect +${points}`
        : `golden +${points}`
      : perfect
        ? `perfect +${points}`
        : combo > 1
          ? `+${points} ×${combo}`
          : `+${points}`;
    addPopup(popups, centerX, basketY - 14, text, boba.golden ? "gold" : perfect ? "perfect" : "plain");
  }

  function addMissEffects(boba: Boba, centerX: number) {
    const primary = boba.golden ? "#f2b84b" : boba.liquid;
    for (let i = 0; i < 10; i++) {
      addParticle(particles, centerX, viewH - 9, i % 3 === 0 ? PEARL : primary, 118, 340);
    }
    addPopup(popups, clamp(centerX, 65, viewW - 65), viewH - 46, "splat", "miss", 0.8);
    missPulse += 1;
    missFlash = true;
    later(() => (missFlash = false), 250);
  }

  // --- Catches and misses --------------------------------------------------

  /** Catches before the bonus point is taught to a player who hasn't found it. */
  const PERFECT_AFTER = 5;

  function registerCatch(boba: Boba, centerX: number, basketX: number) {
    const perfect = isPerfectCatch(centerX, basketX, basketW, rules.perfectRadius);
    const points = pointsForCatch(boba.golden, perfect);
    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    caughtCount += 1;
    if (perfect) perfectCatches += 1;
    score += points;
    addCatchEffects(boba, centerX, perfect, points);

    // The catch is made when the cup it is being shown on lands in the
    // basket; catching another cup meanwhile doesn't count. A catch while it
    // isn't up shows a player who already knows it.
    if (coach.current?.id === LESSONS.catch.id) {
      if (cue?.cup === boba && !coach.leaving) coach.done(LESSONS.catch.id);
    } else coach.done(LESSONS.catch.id);
    // A line about this cup has been seen.
    if (cue?.cup === boba) {
      if (coach.current === cue.lesson && !cue.lesson.move) coach.done(cue.lesson.id);
      cue.cup = null;
    }
    // The bonus point, once the catch is known and nothing else is up: on
    // the first perfect catch (its popup has just said so), or for a player
    // who hasn't found the middle after a few.
    if (!coach.current && coach.learned("catch") && (perfect || caughtCount >= PERFECT_AFTER)) teachNow("perfect", quietFor);

    const pan = viewW > 0 ? (centerX / viewW) * 2 - 1 : 0;
    let restored = false;
    if (boba.golden) {
      goldenCaught += 1;
      events.push({ time: elapsed, kind: "golden" });
      const result = catchGolden(lives, rules);
      lives = result.lives;
      restored = result.restored;
      if (restored) {
        events.push({ time: elapsed, kind: "back" });
        addPopup(popups, centerX, basketY - 38, "a pearl back", "gold", 1.1);
      } else if (result.toGo > 0) {
        const more = result.toGo === 1 ? "one more" : result.toGo === 2 ? "two more" : `${result.toGo} more`;
        addPopup(popups, centerX, basketY - 38, `${more} for a pearl`, "gold", 1);
      }
    }

    if (restored) {
      basketBlink = REVIVE_BLINK_SECONDS;
      sfxMilestone(pan);
    } else if (boba.golden) sfxGolden(combo, pan);
    else if (caughtCount % 10 === 0) sfxMilestone(pan);
    else sfxCatch(combo, perfect, pan);

    if (restored) {
      liveMessage = `Golden cup caught. A pearl is back, ${lives.left} left.`;
    } else if (boba.golden) {
      liveMessage = `You caught a golden cup for ${points} points.`;
    } else if (perfect) {
      liveMessage = `A perfect catch, for ${points} points.`;
    } else if (caughtCount % 5 === 0) {
      liveMessage = `${caughtCount} cups caught. Score ${score}.`;
    }
  }

  function registerMiss(boba: Boba, centerX: number) {
    combo = 0;
    addMissEffects(boba, centerX);
    sfxMiss(viewW > 0 ? (centerX / viewW) * 2 - 1 : 0);

    lives = dropPearl(lives);
    if (lives.left > 0) basketBlink = REVIVE_BLINK_SECONDS;
    events.push({ time: elapsed, kind: "drop" });
    liveMessage =
      lives.left > 0
        ? `Miss. ${lives.left} ${lives.left === 1 ? "pearl" : "pearls"} left.`
        : "No pearls left.";

    if (lives.left <= 0) void endGame();
    // A cup the catch was being shown on: the next cup is showing it again.
    else if (!boba.retaught) teachNow("miss");
  }

  // --- Lessons -------------------------------------------------------------

  /**
   * How big a lesson's slip is: as the Coach drew it, once it has been on
   * the page; until then, its line in the slip's type, padded, on one line.
   */
  function slipSize(lesson: Lesson) {
    const measured = slipSizes.get(lesson.id);
    if (measured) return measured;
    let w = SLIP_MAX;
    if (ctx) {
      ctx.save();
      ctx.font = arcadeFont(SLIP_FONT_PX, 400);
      w = ctx.measureText(lesson.name ? `${lesson.name} ${lesson.text}` : lesson.text).width + SLIP_PADDING;
      ctx.restore();
    }
    return { w: Math.ceil(Math.min(SLIP_MAX, w, viewW - SLIP_GUTTER * 2)), h: SLIP_HEIGHT };
  }

  /** Measures the slip on the page the first time it is there with its Continue button, and places it again by that. */
  function measureSlip(lesson: Lesson) {
    if (slipSizes.has(lesson.id) || !coachContinuable || !cue) return;
    const slip = document.querySelector<HTMLElement>(".coach .slip");
    if (!slip || slip.offsetWidth <= 0) return;
    slipSizes.set(lesson.id, { w: slip.offsetWidth, h: slip.offsetHeight });
    if (cue.anchor === "link") cue.side = pickSide(lesson, cue.x, cue.y, cue.side === "left" || cue.side === "right" ? cue.side : inward(cue.x), cue.ring, cue.width, true);
    else if (cue.anchor === "landing" && cue.cup) aimAtLanding(cue, cue.cup);
    else if (cue.anchor === "basket") pinToBasket(cue);
  }

  /**
   * How far the Coach sets its slip from the anchor, beside it or above it:
   * clear of the pen loop, or of the thing itself when it is wider (it
   * follows Coach.svelte's own spacing).
   */
  function reach(ring: number, width: number, across: boolean) {
    if (ring <= 0 && width <= 0) return 6 + 14;
    if (!across) return Math.max(ring * 0.8, (ring * 1.75) / 2) + 14;
    const loopW = Math.max(ring * 2.3, width > 0 ? (width + 6) * 2 : 0);
    return Math.max(ring * 0.8, loopW / 2, width) + 14;
  }

  /**
   * Which side of a thing at `x, y` the slip goes on: `prefer`'s side, or
   * the other if the page runs out first. For something that stays put (a
   * link), when neither side has room the slip goes above it, or below if
   * the tickets are in the way; a moving thing keeps to a side.
   */
  function pickSide(lesson: Lesson, x: number, y: number, prefer: Side, ring = 0, width = 0, upright = false): Side {
    const { w, h } = slipSize(lesson);
    const away = reach(ring, width, true);
    const fitsRight = x + away + w + SLIP_GUTTER <= viewW;
    const fitsLeft = x - away - w - SLIP_GUTTER >= 0;
    if (prefer === "right" && fitsRight) return "right";
    if (prefer === "left" && fitsLeft) return "left";
    if (fitsRight) return "right";
    if (fitsLeft) return "left";
    if (!upright) return prefer;
    return y - reach(ring, width, false) - h >= PLAYFIELD_TOP + 8 ? "above" : "below";
  }

  /** Toward the middle of the page, where there's room. */
  const inward = (x: number): Side => (x < viewW / 2 ? "right" : "left");

  /** The edge of a basket centred at `center` on `side`, so the slip sits beside it, not over it. */
  const basketEdge = (center: number, side: Side) => center + (side === "right" ? 1 : -1) * (basketW / 2 + 2);

  /**
   * Points the catch at where `cup` will land, from where it is now on the
   * page as it is now: the chalk's path down, and the slip beside the ghost
   * basket on the side away from the real one, so the hand has a clear way.
   */
  function aimAtLanding(target: Cue, cup: Boba) {
    flightPath(cup, cup.gravity, playfield(), arc);
    arcFrom = simTime;
    const spot = arc[arc.length - 1].x;
    const y = basketY + BASKET_H / 2;
    const side = pickSide(target.lesson, spot, y, basketCenter() < spot ? "right" : "left", 0, basketW / 2 + 2);
    target.spot = spot;
    target.x = basketEdge(clamp(spot, basketW / 2, viewW - basketW / 2), side);
    target.y = y;
    target.side = side;
  }

  /** Where a link is on the page now, its loop, and the side its slip goes on. */
  function aimAtLink(target: Cue, link: { x: number; y: number; width: number; height: number }) {
    target.ring = Math.round(clamp(Math.max(link.width / 2, link.height), 18, 56));
    target.width = Math.round(link.width / 2);
    target.spot = target.x = link.x;
    target.y = link.y;
    target.side = pickSide(target.lesson, link.x, link.y, inward(link.x), target.ring, target.width, true);
  }

  /** Where a lesson points: the landing, the link, the cup, or the basket. */
  function makeCue(lesson: Lesson, cup: Boba | null, spawn: PendingSpawn | null): Cue {
    const made: Cue = { lesson, cup, spawn, element: null, anchor: "basket", spot: 0, x: 0, y: 0, ring: 0, width: 0, side: "right" };
    if (lesson.id === LESSONS.catch.id && cup) {
      made.spawn = null;
      made.anchor = "landing";
      aimAtLanding(made, cup);
    } else if (spawn?.link) {
      made.cup = null;
      made.anchor = "link";
      made.element = spawn.source;
      aimAtLink(made, spawn.link);
    } else if (cup) {
      made.spawn = null;
      made.anchor = "cup";
      made.ring = CUP_RING;
      made.spot = made.x = cup.x + BOBA_W / 2;
      made.y = cup.y + BOBA_H / 2;
      made.side = pickSide(lesson, made.x, made.y, inward(made.x), CUP_RING);
    } else pinToBasket(made);
    return made;
  }

  /**
   * A line about the basket stays where the basket was when it came up: a
   * slip that followed the basket would run from the pointer on its way to
   * Continue.
   */
  function pinToBasket(target: Cue) {
    const center = basketCenter();
    target.spot = center;
    target.side = pickSide(target.lesson, center, basketY, inward(center), 0, basketW / 2 + 2);
    target.x = basketEdge(center, target.side);
    target.y = basketY + BASKET_H / 2;
  }

  /**
   * The cup a lesson is about has gone past the basket: the lesson is over
   * now, not when the cup leaves the page (the lost pearl still drops then).
   * The catch comes down uncounted, and the next cup shows it again.
   */
  function cupPassed(boba: Boba) {
    if (!cue || cue.cup !== boba) return;
    if (coach.current === cue.lesson && !coach.leaving) {
      if (cue.lesson.move) {
        coach.dismiss();
        cue = null;
        boba.retaught = true;
        return;
      }
      coach.done(cue.lesson.id);
    }
    cue.cup = null;
  }

  /** The window changed size: a lesson's landing, or its link, is found again on the page as it is now. */
  function refitCue() {
    if (!cue || coach.current !== cue.lesson) return;
    if (cue.anchor === "landing" && cue.cup) {
      const cup = cue.cup;
      if (cup.vy > 0 && cup.y + BOBA_H >= basketY + BASKET_PX) {
        // Already past the new catch line: it can't be caught now.
        cup.passed = true;
        cupPassed(cup);
      } else aimAtLanding(cue, cup);
    } else if (cue.anchor === "link" && cue.element?.isConnected) {
      const rect = cue.element.getBoundingClientRect();
      aimAtLink(cue, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height });
    } else if (cue.anchor === "basket") pinToBasket(cue);
  }

  /**
   * The window changed size: every throw still on its link starts from
   * where the link is now (inside the new playfield), every cup in the air
   * is projected onto the new catch line (one already below it can't be
   * caught now), and the lesson is fitted to all of that.
   */
  function refitPlay() {
    const catchLine = basketY + BASKET_PX;
    for (const spawn of pendingSpawns) {
      let centerX = spawn.x + BOBA_W / 2;
      let centerY = spawn.y + BOBA_H / 2;
      if (spawn.source?.isConnected) {
        const rect = spawn.source.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
        spawn.link = { x: centerX, y: centerY, width: rect.width, height: rect.height };
      }
      centerX = clampSpawnCenter(centerX, viewW, BOBA_W);
      centerY = clamp(centerY, MIN_SPAWN_CENTER_Y, Math.max(MIN_SPAWN_CENTER_Y, basketY - BOBA_H / 2 - 28));
      spawn.x = centerX - BOBA_W / 2;
      spawn.y = centerY - BOBA_H / 2;
    }
    for (const boba of bobas) {
      if (boba.passed) continue;
      if (boba.vy > 0 && boba.y + BOBA_H >= catchLine) {
        boba.passed = true;
        cupPassed(boba);
        continue;
      }
      const landing = predictLanding(boba, boba.gravity, catchLine, BOBA_SPRITE, viewW);
      boba.landAt = simTime + landing.time;
      boba.landCenter = landing.center;
    }
    refitCue();
    revalidateCue();
  }

  /**
   * A lesson about a cup points the player at the next cup down. If a cup
   * thrown since lands first, the lesson stands down, uncounted: it would
   * steer the player away from the cup that matters now. The catch moves on
   * to that cup if there is still time to get under it (the same
   * explanation, its time running on); otherwise it waits, as it would.
   */
  function revalidateCue() {
    if (!cue?.cup || coach.current !== cue.lesson || coach.leaving || stillNext(cue.cup, bobas)) return;
    const move = cue.lesson.move;
    coach.dismiss();
    cue = null;
    if (!move) return;
    const next = nextDown(bobas);
    if (next && next.landAt - simTime >= MOVE_LATEST && coach.offer(LESSONS.catch)) cue = makeCue(LESSONS.catch, next, null);
  }

  /** Asks the lessons what this moment should teach, once "go" is gone. */
  function checkLessons(realDt: number) {
    const current = coach.current;
    if (current?.move && !coach.leaving && cue?.lesson === current) {
      // The catch: play comes back to speed once the basket has settled
      // under the cup, not as a hand sweeps through the spot.
      settledFor = cue.cup && onSpot(basketCenter(), cue.spot, basketW) ? settledFor + realDt : 0;
      if (!coach.acting && settledFor >= SETTLE) coach.acted(current.id);
      // A move being taught holds the stage until its cup is caught or goes
      // past, but never holds play slow for more than `HOLD`: then it comes
      // down uncounted, and waits for a later run.
      catchFor += realDt;
      if (catchFor >= HOLD) {
        coach.dismiss();
        cue = null;
        timedOut.add(current.id);
      }
      return;
    }
    settledFor = 0;
    if (elapsed < GO_SECONDS) return;
    moment.now = simTime;
    moment.cups = bobas;
    moment.waiting = pendingSpawns;
    moment.pearlDown = lives.left < lives.max;
    const next = lessonNow(moment, known);
    if (next && next.lesson.id !== current?.id && mayOffer(next.lesson, current, coach.age, quietFor, coach.leaving) && coach.offer(next.lesson)) {
      cue = makeCue(next.lesson, next.cup, next.spawn);
      if (next.lesson.move) catchFor = 0;
    }
    if (!coach.current) cue = null;
  }

  /**
   * Teaches something that just happened, beside the basket: now, while
   * nothing else is up, or at a later time it happens. A lost pearl is said
   * at once; the bonus point can wait for a rest after another line.
   */
  function teachNow(id: "miss" | "perfect", quiet = Infinity) {
    const lesson = LESSONS[id];
    if (gameOver || !mayOffer(lesson, coach.current, coach.age, quiet, coach.leaving) || !coach.offer(lesson)) return;
    cue = makeCue(lesson, null, null);
  }

  /**
   * The player has read it: Continue (Enter, or the slip's button) ends the
   * explanation, counts it, and play eases back to speed. The catch skipped
   * this way counts as known.
   */
  function continueLesson() {
    if (!coach.current || coach.leaving || countdown > 0 || paused || gameOver) return;
    coach.done(coach.current.id);
  }

  /** The ringed link has thrown its cup, or let it go. */
  function linkThrew(thrown: boolean) {
    if (!cue) return;
    cue.spawn = null;
    // With the catch still to teach, it takes over from this line once the
    // line has been read, and play stays slow for it; otherwise the line goes.
    if (coach.current === cue.lesson && (!thrown || coach.learned("catch"))) coach.done(cue.lesson.id);
  }

  /** Puts the callout beside its thing, following a cup in the air; anything else stays put. */
  function placeCoach() {
    const lesson = coach.current;
    if (!lesson || !cue || cue.lesson !== lesson || gameOver) {
      if (coachLesson) coachLesson = null;
      if (coachX !== null) coachX = coachY = null;
      if (coachContinuable) coachContinuable = false;
      return;
    }
    if (cue.anchor === "cup" && cue.cup) {
      cue.x = cue.cup.x + BOBA_W / 2;
      cue.y = cue.cup.y + BOBA_H / 2;
      cue.side = pickSide(lesson, cue.x, cue.y, cue.side, CUP_RING);
    }
    if (coachLesson !== lesson) coachLesson = lesson;
    // The slip stays readable through its minimum life, then fades.
    if (coachLeaving !== coach.fading) coachLeaving = coach.fading;
    const continuable = !coach.leaving && !coach.acting && (lesson.slow ?? 1) < 1;
    if (continuable !== coachContinuable) coachContinuable = continuable;
    const x = Math.round(cue.x);
    const y = Math.round(cue.y);
    if (x !== coachX) coachX = x;
    if (y !== coachY) coachY = y;
    if (cue.ring !== coachRing) coachRing = cue.ring;
    if (cue.width !== coachWidth) coachWidth = cue.width;
    if (cue.side !== coachSide) coachSide = cue.side;
    measureSlip(lesson);
  }

  /** Catch is played on the page, so its marks take the page's ink: dark on light paper, cream on dark. */
  function readTheme() {
    darkPage = isDarkTheme();
    markColor = risoColors(darkPage).ink;
  }

  // --- Game loop -----------------------------------------------------------

  /** One clock for the cups' flights and the fairness check. */
  let simTime = 0;

  function beginRound() {
    countdown = 0;
    goVisible = true;
    phase = difficultyAt(0, rules).phase;
    setMusicPhase(phase);
    startMusic();
    sfxStart();
    liveMessage = `Go. ${sentence(phaseLabel(phase))}.`;
  }

  function step(dt: number) {
    elapsed += dt;
    simTime += dt;
    if (goVisible && elapsed >= GO_SECONDS) goVisible = false;

    const difficulty = difficultyAt(elapsed, rules);
    if (difficulty.phase !== phase) {
      phase = difficulty.phase;
      setMusicPhase(phase);
      liveMessage = `${sentence(phaseLabel(phase))}.`;
    }
    const shown = formatShift(elapsed);
    if (shown !== shiftLabel) shiftLabel = shown;

    spawnTimer += dt;
    const inPlay = bobas.length + pendingSpawns.length;
    if (spawnTimer >= difficulty.spawnInterval) {
      if (inPlay < difficulty.maxActive) {
        spawnTimer -= difficulty.spawnInterval;
        queueVolley(Math.min(volleySize(difficulty), difficulty.maxActive - inPlay), difficulty);
      } else {
        // Full: throw as soon as a cup lands, not a burst of saved-up ones.
        spawnTimer = difficulty.spawnInterval;
      }
    }

    for (let index = 0; index < pendingSpawns.length; index++) {
      const spawn = pendingSpawns[index];
      spawn.remaining -= dt;
      if (spawn.remaining > 0) continue;
      const boba = launch(spawn, difficulty, simTime);
      if (!boba && spawn.held < MAX_HOLD) {
        spawn.held += HOLD_STEP;
        spawn.remaining = HOLD_STEP;
        continue;
      }
      // Thrown, or (rarely, at the top of the ramp) never fair: the link lets it go.
      spawn.source?.classList.remove("boba-source", "boba-source-gold");
      pendingSpawns.splice(index, 1);
      index -= 1;
      if (boba) bobas.push(boba);
      if (cue?.spawn === spawn) linkThrew(boba !== null);
      // A cup thrown now may land before the one a lesson is about.
      if (boba) revalidateCue();
    }

    const basketX = basketLeft();
    const catchLine = basketY + BASKET_PX;

    for (let index = bobas.length - 1; index >= 0; index--) {
      const boba = bobas[index];
      boba.vy += boba.gravity * dt;
      boba.x += boba.vx * dt;
      boba.y += boba.vy * dt;
      bounceHorizontal(boba, BOBA_W, viewW);

      const bottom = boba.y + BOBA_H;
      const previousBottom = bottom - boba.vy * dt;
      const centerX = boba.x + BOBA_W / 2;

      if (
        boba.vy > 0 &&
        previousBottom <= catchLine &&
        bottom >= catchLine &&
        centerX >= basketX &&
        centerX <= basketX + basketW
      ) {
        bobas.splice(index, 1);
        registerCatch(boba, centerX, basketX);
        continue;
      }
      if (!boba.passed && boba.vy > 0 && bottom >= catchLine) {
        boba.passed = true;
        cupPassed(boba);
      }

      if (boba.y > viewH + 10) {
        bobas.splice(index, 1);
        registerMiss(boba, centerX);
        if (gameOver) return;
      }
    }

    basketSquash = Math.max(0, basketSquash - dt);
    stepParticles(particles, dt);
    stepPopups(popups, dt);
  }

  /** One frame of real time: the countdown, or the shift at the lesson's pace. */
  function advance(realDt: number, rawDt: number) {
    if (countdown > 0) {
      const next = stepCountdown(countdownElapsed, countdown, Math.min(rawDt, 0.25));
      countdownElapsed = next.elapsed;
      if (next.beep) {
        countdown = next.count;
        sfxCountdown(countdown);
      }
      if (next.done) beginRound();
      return;
    }
    // A lesson eases the whole shift (throws, flights, the ramp) into slow
    // motion and back out, so every planned landing keeps its fairness; the
    // basket stays on the mouse, at full speed.
    // Lessons hold on real time (uncapped, so as long on a slow device),
    // while the shift's own step stays capped.
    // Real time, capped only against a leap (a tab coming back), as the coach's own clock is.
    const real = Math.min(rawDt, 1);
    const dt = coach.step(rawDt, realDt);
    lessonClock += real;
    // The basket's blink after a pearl drops or comes back runs on real
    // time, so slow motion doesn't stretch it.
    basketBlink = Math.max(0, basketBlink - real);
    step(dt);
    quietFor = coach.current ? 0 : quietFor + real;
    if (!gameOver) checkLessons(real);
    // The spotlight comes up with an explanation, and goes as it ends or the move is made.
    const lesson = coach.current;
    const dimTarget = lesson && cue?.lesson === lesson && !coach.leaving && !coach.acting && (lesson.slow ?? 1) < 1 ? 1 : 0;
    lessonDim = reduceMotion ? dimTarget : lessonDim + (dimTarget - lessonDim) * (1 - Math.exp(-real / 0.18));
  }

  // --- Starting, pausing, and finishing -------------------------------------

  function clearSpawnSources() {
    document
      .querySelectorAll(".boba-source, .boba-source-gold")
      .forEach((element) => element.classList.remove("boba-source", "boba-source-gold"));
  }

  /** A clean counter for a new run. */
  function resetRun() {
    stopMusic();
    clearSpawnSources();
    timers.clear();
    bobas = [];
    pendingSpawns = [];
    particles = [];
    popups = [];
    events = [];
    score = 0;
    lives = createLives(rules);
    combo = 0;
    bestCombo = 0;
    caughtCount = 0;
    perfectCatches = 0;
    goldenCaught = 0;
    elapsed = 0;
    simTime = 0;
    countdownElapsed = 0;
    spawnTimer = 0;
    spawnNumber = 0;
    volleys = 0;
    basketSquash = 0;
    basketBlink = 0;
    shiftLabel = formatShift(0);
    phase = difficultyAt(0, rules).phase;
    missPulse = 0;
    missFlash = false;
    goVisible = false;
    gameOver = false;
    paused = false;
    newBest = false;
    share = [];
    coach.reset();
    cue = null;
    arc.length = 0;
    lessonClock = 0;
    quietFor = Infinity;
    settledFor = 0;
    lessonDim = 0;
    catchFor = 0;
    timedOut.clear();
    readTheme();
    run += 1;
  }

  /** A run, after the countdown. */
  function startRun() {
    resetRun();
    countdown = COUNTDOWN_SECONDS;
    pointerX = clamp(mouseX, basketW / 2, viewW - basketW / 2);
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
    drawScene();
    active = true;
    loop.stop();
    loop.start();
    // Keyboard and screen-reader users land in the game, on its playfield.
    void tick().then(() => {
      if (active && !gameOver) focusPlayfield();
    });
  }

  async function pauseGame() {
    if (gameOver || !active || paused) return;
    paused = true;
    setMusicPaused(true);
    liveMessage = "The game is paused.";
    await tick();
    pauseCard?.focus();
  }

  function resumeGame() {
    if (gameOver || !active || !paused) return;
    paused = false;
    loop.resync();
    setMusicPaused(false);
    sfxBlip();
    liveMessage = countdown > 0 ? `Countdown ${countdown}` : "The game resumed.";
    focusPlayfield();
  }

  function focusPlayfield() {
    playfieldEl?.focus({ preventScroll: true });
  }

  function togglePause() {
    if (paused) resumeGame();
    else void pauseGame();
  }

  async function endGame() {
    if (gameOver) return;
    active = false;
    gameOver = true;
    paused = false;
    loop.stop();
    // The loop has stopped mid-frame: draw the floor as the last cup left it.
    drawScene();
    clearSpawnSources();
    const result = concludeRun("catch", score);
    localBest = result.best;
    newBest = result.newBest;
    const cells = shiftCells(events, elapsed);
    // The time on shift is already one of the shared stats.
    share = emojiRows(cells, cells.length <= 12 ? 12 : 10, 3);
    liveMessage = `The game is over after ${formatShift(elapsed)} on shift. Your final score is ${score}.`;
    await tick();
    slip?.focus();
  }

  // --- Sizing and lifecycle ------------------------------------------------

  function sizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    ctx = fitCanvas(canvas, viewW, viewH);
    basketY = viewH - BASKET_H - 16;
    pointerX = clamp(pointerX, basketW / 2, viewW - basketW / 2);
    refitPlay();
    loop.redraw();
  }

  onMount(() => {
    mouseX = window.innerWidth / 2;
    pointerX = mouseX;
    popupFont = arcadeFont();
    readTheme();
    sizeCanvas();

    const onMove = (event: MouseEvent) => {
      mouseX = event.clientX;
      // On the slip's Continue button, the basket keeps its aim: reaching
      // for the button mustn't steer the basket off the cup.
      const onContinue = event.target instanceof Element && event.target.closest(".coach button");
      if (!onContinue) pointerX = mouseX;
    };
    const unmountShell = mountShell({
      isOver: () => gameOver,
      isPaused: () => paused,
      pause: () => void pauseGame(),
      togglePause,
      playScope: () => playScope,
      onKey: (event) => {
        // Enter on the playfield ends the explanation that is up, as its
        // slip says; a focused ticket button keeps Enter for itself.
        if (event.key === "Enter" && coachContinuable && !paused && !isOnControl(event)) {
          event.preventDefault();
          continueLesson();
          return;
        }
        // Space pauses too, unless a focused control keeps it for itself.
        if (event.key === " " && !isOnControl(event)) {
          event.preventDefault();
          togglePause();
        }
      },
      onResize: sizeCanvas,
      onReduceMotion: (reduce) => {
        reduceMotion = reduce;
        loop.redraw();
      },
      pauseOnPointerLeave: true,
    });
    window.addEventListener("mousemove", onMove, { passive: true });

    startRun();

    return () => {
      active = false;
      loop.stop();
      clearSpawnSources();
      stopMusic();
      timers.clear();
      unmountShell();
      window.removeEventListener("mousemove", onMove);
    };
  });
</script>

<div
  class="boba-stage is-page"
  on:click={swallow}
  on:pointerdown={swallow}
  on:wheel={swallow}
  aria-hidden="true"
></div>
<canvas bind:this={canvas} class="boba-canvas" aria-hidden="true"></canvas>

<div bind:this={playScope} class="catch-play">
<!-- Where focus rests during the shift: not a button, so Enter continues a
     lesson and Space pauses. -->
<div bind:this={playfieldEl} class="sr-only" tabindex="-1" role="group" aria-label="Boba catch playfield"></div>
<header class="boba-hud boba-ui" aria-label="Boba catch status">
  <div class="boba-hud-row">
    <div class="boba-ticket boba-ticket-start boba-riso" style="--tilt: -1.4deg">
      <span class="boba-ticket-icon" aria-hidden="true">
        <PixelIcon grid={ICON_BOBA} palette={ICON_BOBA_PAL} px={3} />
      </span>
      <span class="boba-big">{String(score).padStart(3, "0")}</span>
      <span class="boba-stack">
        <span class="boba-meta">points</span>
        <span class="boba-line">
          {#if combo > 1}
            {#key combo}
              <span class="boba-combo active">×{combo} combo</span>
            {/key}
          {/if}
        </span>
      </span>
      <ExpertTag />
    </div>

    <!-- No clock to beat: how long this shift has lasted, and the pace. -->
    <div
      class="boba-ticket boba-ticket-center boba-riso"
      class:is-rush={phase === "rush"}
      style="--tilt: 1deg"
      role="timer"
      aria-label={`${shiftLabel} on shift, ${phaseLabel(phase)}`}
    >
      <span class="boba-big">{shiftLabel}</span>
      <span class="boba-stack">
        <span class="boba-meta">on shift</span>
        <span class="boba-phase">{phaseLabel(phase)}</span>
      </span>
    </div>

    <div class="boba-ticket boba-ticket-end boba-riso">
      <Pearls left={lives.left} total={lives.max} pulse={missPulse} />
      {#key run}
        <TrackFlag />
      {/key}
      <HudButtons {paused} on:pause={togglePause} />
    </div>
  </div>
</header>
  <!-- Inside the play scope, so Tab reaches its Continue button. -->
  <!-- The lesson's callout, beside the link, the cup, the landing, or the basket. -->
  <Coach
    lesson={coachLesson}
    x={coachX}
    y={coachY}
    side={coachSide}
    ring={coachRing}
    width={coachWidth}
    scene={darkPage ? "dark" : "light"}
    leaving={coachLeaving}
    continuable={coachContinuable}
    returnFocus={focusPlayfield}
    on:continue={continueLesson}
    hidden={paused || gameOver}
    top={PLAYFIELD_TOP + 8}
  />
</div>

{#if countdown > 0 || goVisible}
  <Countdown value={countdown} />
{/if}

{#if missFlash}
  <div class="boba-miss-flash" aria-hidden="true"></div>
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
    game="catch"
    title="game over"
    deck="The last pearl dropped."
    {score}
    {newBest}
    {share}
    stats={[
      { label: "time on shift", value: formatShift(elapsed) },
      { label: "cups caught", value: caughtCount },
      { label: "perfect catches", value: perfectCatches },
      { label: "golden cups", value: goldenCaught },
      { label: "personal best", value: localBest },
    ]}
    on:restart={startRun}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>

<style>
  /* Only groups the playfield with the tickets, for focus; it lays nothing out. */
  .catch-play {
    display: contents;
  }

  /* Links that are about to throw a cup glow in the accent (gold for a
     golden cup), a beat before it appears. */
  :global(a.boba-source),
  :global(a.boba-source-gold) {
    position: relative;
    z-index: calc(var(--layer-overlay) + 2);
    animation: boba-source-pulse 0.44s steps(2, end) infinite;
  }

  :global(a.boba-source) {
    color: #c9462f !important;
    text-shadow: 2px 0 rgb(232 93 76 / 0.24);
  }

  :global(a.boba-source-gold) {
    color: #704a05 !important;
    text-shadow: 2px 0 rgb(219 168 77 / 0.4);
  }

  :global(.dark a.boba-source) {
    color: #f18272 !important;
  }

  :global(.dark a.boba-source-gold) {
    color: #dba84d !important;
  }

  @keyframes -global-boba-source-pulse {
    50% {
      filter: brightness(1.28);
      transform: translateY(-1px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(a.boba-source),
    :global(a.boba-source-gold) {
      animation: none;
    }
  }
</style>
