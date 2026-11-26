<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { get } from "svelte/store";

  import { arcadeExpert } from "#lib/boba.ts";
  import {
    audioClock,
    resumeAudio,
    setMusicPhase,
    sfxBlip,
    sfxCountdown,
    sfxMilestone,
    sfxMiss,
    sfxStab,
    sfxStart,
    sfxWhiff,
    songTempos,
    stabPlaylist,
    startMusic,
    stopMusic,
    suspendAudio,
  } from "#lib/sfx.ts";
  import { COUNTDOWN_SECONDS, stepCountdown } from "#lib/arcade/countdown.js";
  import {
    BEATS_PER_BAR,
    MAX_TIER,
    STAB_COOLDOWN,
    barAtTime,
    barPosition,
    barSeconds,
    barStart,
    beltX,
    createPractice,
    cupBeats,
    endPractice,
    inputSeconds,
    isGoldenCup,
    isMissed,
    planPracticeCup,
    judgeStab,
    markBar,
    nearestCup,
    pointsForStab,
    practiceLearned,
    practiceAt,
    practiceOn,
    practiceResult,
    presentSeconds,
    shareRows,
    songTime,
    stabMode,
    steadyOffset,
    tierForBar,
    type Practice,
    type StabMode,
  } from "#lib/arcade/stab-engine.js";
  import {
    HOLD_AFTER,
    LESSONS,
    PRESS_AFTER,
    STOPS,
    STOP_WITHIN,
    bracketBox,
    lessonForMiss,
    lessonForSong,
    lessonForStab,
    ghostPlunge,
    lessonNow,
    mayOffer,
    nextWaiting,
    practiceBracket,
    roomToStop,
    type NextCup,
  } from "#lib/arcade/stab-lessons.js";
  import {
    ACCENT,
    CREAM,
    DRINKS,
    HALO,
    INK,
    MENU_ICONS,
    NOTE_BACK,
    NOTE_GOLD,
    PAPER_WHITE,
    PEARL,
    SPRITE_PAD,
    STRAW_PINK,
    addParticle,
    addPopup,
    arcadeFont,
    cachedSprite,
    drawChipNote,
    drawParticles,
    fitCanvas,
    stepParticles,
    stepPopups,
    type Particle,
    type Popup,
  } from "#lib/arcade/art.ts";
  import { createCoach, resetLessons, type Lesson } from "#lib/arcade/core/coach.ts";
  import { TICK_LOOKAHEAD, createTicks } from "#lib/arcade/stab-tick.ts";
  import { hexToRgb, mixHex, mixRgb, rgbToHex, type RGB } from "#lib/arcade/core/color.ts";
  import { bayer, paintBands } from "#lib/arcade/core/dither.ts";
  import { drawBrackets, drawGhost, drawSpotlight, type FocusBox } from "#lib/arcade/core/ghost.ts";
  import { clamp, quantize, smoothstep, snap } from "#lib/arcade/core/math.ts";
  import { createRng } from "#lib/arcade/core/rng.ts";
  import { arcadeExits, concludeRun, createTimers, isOnControl, mountShell } from "#lib/arcade/shell.ts";
  import { REVIVE_BLINK_SECONDS, blinkShows } from "#lib/arcade/blink.ts";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import Coach from "./Coach.svelte";
  import Countdown from "./Countdown.svelte";
  import ExpertTag from "./ExpertTag.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import Pearls from "./Pearls.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";
  import TrackFlag from "./TrackFlag.svelte";

  // Straw stab: cups ride a belt and pass under the straw exactly on the
  // soundtrack's beats. The belt is drawn against the audio clock itself,
  // so what you see lines up with what you hear, pauses included.

  const { exit, toMenu } = arcadeExits(createEventDispatcher<{ close: null; menu: null }>());

  // Four songs, one from each tempo band, slowest first, so the tempo
  // climbs through each loop. Drawn afresh for every run (see resetRun).
  let PLAYLIST = stabPlaylist();
  let TEMPOS = songTempos(PLAYLIST);
  const PLUNGE_SECONDS = 0.05;
  const RELOAD_SECONDS = 0.1;
  /** How far above its rest the next straw starts as it comes back into the hand, past its own length, px. */
  const RELOAD_RISE = 30;
  const TUMBLE_SECONDS = 0.45;
  const TIER_LABELS = [
    "easy does it",
    "picking up",
    "double time",
    "no breaks",
    "chaos shift",
    "last call",
    "after hours",
  ];
  /**
   * Keys that stab. Not Enter: Enter continues past a lesson's line, and a
   * focused button keeps it.
   */
  const STAB_KEYS = new Set([" ", "ArrowDown", "j", "k", "f", "d"]);
  const LIVES_WORDS = ["No", "One", "Two", "Three", "Four"];

  /** Expert is read once, when the game opens; the switch lives on the menu. */
  const expert = get(arcadeExpert);
  /** The rules of the run being played. */
  const mode: StabMode = stabMode(expert);

  // --- The scene: a night-market stall at dusk ------------------------------
  //
  // The tier is the time of day: tier 0 is golden dusk, MAX_TIER full night
  // with the market lit. The scene is opaque and the same in both themes.

  /** The scene cell, in CSS px. Every scene element snaps to it. */
  const SC = 4;

  // The market is the backdrop, not the game: every colour behind the belt
  // is printed with most of its saturation and a little of its light taken
  // out, so the cups, belt, straw, and notes are always the loudest things.
  const SCENE_SATURATION = 0.6;
  const SCENE_LIGHT = 0.82;
  function calm(hex: string, saturation = SCENE_SATURATION, light = SCENE_LIGHT) {
    const values = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
    const grey = 0.3 * values[0] + 0.59 * values[1] + 0.11 * values[2];
    const channel = (value: number) =>
      Math.round(Math.max(0, Math.min(255, (grey + (value - grey) * saturation) * light)))
        .toString(16)
        .padStart(2, "0");
    return `#${values.map(channel).join("")}`;
  }

  // The sky's five bands, top to horizon. Dusk runs through a deep twilight
  // (the warm bands sinking toward the horizon) on its way to night.
  const SKY_DUSK = ["#2a2748", "#5a3a6a", "#b85a5a", "#e8915a", "#f4c27a"].map((c) => calm(c));
  const SKY_TWILIGHT = ["#1d1f3d", "#2a2748", "#4a3462", "#7a4262", "#a8545e"].map((c) => calm(c));
  const SKY_NIGHT = ["#141a2e", "#1a2040", "#1f2547", "#2c2a52", "#3b2a52"].map((c) => calm(c));
  /** Where each band starts, as a share of the height down to the horizon. */
  const SKY_STOPS = [0, 0.24, 0.48, 0.7, 0.9];
  const SUN = calm("#fde9b8", 0.6, 0.8);
  const STAR = "#fdf8f3";
  /** Stars print at most this bright. */
  const STAR_LEVEL = 0.6;
  const FAR = ["#3a2f52", "#1c1d38"].map((c) => calm(c, 0.6, 0.9));
  const NEAR = ["#2b2440", "#12142a"].map((c) => calm(c, 0.6, 0.9));
  const WINDOW_LIT = calm("#f4c27a", 0.55, 0.72);
  const WINDOW_WARM = calm("#e8915a", 0.55, 0.72);
  const AWNING = calm("#b85a5a");
  const ANTENNA = calm("#e85d4c", 0.7, 0.8);
  const LANTERN_CORE = calm("#fde9b8", 0.7, 0.86);
  const CORD = "#2b2320";
  /**
   * A flat dark band behind the play lane, from above the straw down to the
   * belt, laid over whatever the market has there.
   */
  const LANE_SHADE = "#0e111c";
  const LANE_ALPHA = 0.5;
  const COUNTER_TOP = "#e9dfd0";
  const COUNTER_TOP_SHADE = "#d8ccba";
  const COUNTER_LIP = "#b9ab98";
  const COUNTER_FRONT = "#8a5a3c";
  const COUNTER_SHADE = "#6f4530";
  const PLANK = "#5a3826";
  const HOUSING = "#2b2320";
  const HOUSING_DEEP = "#1f1916";
  const ROLLER = "#cfc6ba";
  const ROLLER_SHADE = "#a89e92";
  const ROLLER_SPOKE = "#7d746a";
  const FLOOR = "#3a3157";
  const FLOOR_SHADOW = "#2b2440";
  const EMBER = "#8a3251";
  const BELT_FACE = "#f3ead9";
  const GOLD = "#f2b84b";
  /** Lantern and firework colours: the drinks, then gold for golden cups, all quietened. */
  const LANTERN_COLORS = [...DRINKS, GOLD].map((c) => calm(c, 0.6, 0.78));
  const GOLD_INDEX = DRINKS.length;
  const PENNANT_COLORS = [CREAM, ACCENT, DRINKS[4], DRINKS[5]].map((c) => calm(c, 0.55, 0.7));
  const EMBER_CALM = calm(EMBER);

  /** Belt rows: an ink lip, the cream face the beats are notched into, an ink lip. */
  const BELT_LIP = SC;
  const BELT_FACE_H = 2 * SC;
  const BELT_H = BELT_LIP * 2 + BELT_FACE_H;
  /** Skyline rows hidden under the belt, so no strip ever shows its foot. */
  const BASE_ROWS = BELT_H / SC;
  const FAR_PERIOD = 200;
  const NEAR_PERIOD = 160;
  const MISS_DIM_SECONDS = 0.3;
  const FLASH_SECONDS = 0.36;
  const MAX_SPARKS = 200;

  // A lantern as a cell grid: k cap, b paper, s shade, c core, t tassel.
  // The running light only brightens a core; lanterns never change size.
  const LANTERN = [".k.", "sbs", "bcb", "sbs", ".t."];
  /** Rows kept clear under the lowest cord, so the strings stay well above the straw. */
  const LANTERN_CLEARANCE = 7;

  // A roller seen end on, with one spoke. Frames turn it counter-clockwise,
  // the way a roller under a leftward belt turns.
  const ROLLER_GRID = ["..rrr..", ".rrrrr.", "rrrrrrr", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr.."];
  const ROLLER_SPOKES = [
    [3, 1, 3, 2, 3, 3, 3, 4, 3, 5],
    [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    [1, 3, 2, 3, 3, 3, 4, 3, 5, 3],
    [5, 1, 4, 2, 3, 3, 2, 4, 1, 5],
  ];
  const ROLLER_PITCH = 16;
  /** Counter boards: rows per board including its line, and cells between joints. */
  const PLANK_ROWS = 6;
  const PLANK_LENGTH = 44;

  // --- Pixel sprites -------------------------------------------------------

  // A sealed cup: printed film on top, pearls at the bottom.
  const CUP = [
    "OOOOOOOOO",
    "OfFfFfFfO",
    "OOOOOOOOO",
    ".OLLLLLO.",
    ".OLLLLLO.",
    ".OLLLLLO.",
    ".ObLbLbO.",
    "..ObLbO..",
    "..OOOOO..",
  ];
  const STRAW = ["SS", "SW", "WS", "SS", "SW", "WS", "SS", "SW", "WS", "SS", "SS", "S."];
  const CUP_PALETTES = DRINKS.map((liquid) => ({
    O: INK,
    f: PAPER_WHITE,
    F: "#e85d4c",
    b: PEARL,
    L: liquid,
  }));
  const GOLD_PALETTE = { O: "#6d4511", f: "#fff0a6", F: "#f2b84b", b: "#68400d", L: "#f2b84b" };
  const STRAW_PALETTE = { S: STRAW_PINK, W: PAPER_WHITE };

  interface Cup extends NextCup {
    /** Song time when the cup is dead under the straw. */
    time: number;
    /** The bar it rides in, for the share. */
    bar: number;
    /** Where in its bar it falls, in beats (2.5 is between beats 2 and 3). */
    beat: number;
    /** Its bar's tier, which sets how tight a perfect is. */
    tier: number;
    /** Planned `number`th in the run, from 1: the first few are a first run's practice. */
    number: number;
    drink: number;
    golden: boolean;
    resolved: boolean;
    missed: boolean;
    /** Song time it was stabbed or called missed. */
    takenAt: number;
    /** Its practice tick has been scheduled on the audio clock. */
    ticked: boolean;
    /** Where the straw went in, in px from the cup's center; null until stabbed. */
    straw: number | null;
  }

  interface Plunge {
    /** The cup being stabbed, or null when the straw is headed for the belt. */
    cup: Cup | null;
    offset: number;
    age: number;
  }

  // --- Reactive UI state ---------------------------------------------------

  let score = 0;
  let combo = 0;
  let bestCombo = 0;
  let hits = 0;
  let perfects = 0;
  let countdown = COUNTDOWN_SECONDS;
  let goVisible = false;
  let running = false;
  let paused = false;
  let gameOver = false;
  let lives = mode.lives;
  /** Seconds the straw in hand has left to flicker after a pearl is lost. */
  let strawBlink = 0;
  let missPulse = 0;
  let missFlash = false;
  let beatInBar = -1;
  let currentBpm = TEMPOS[0];
  let tier = 0;
  let songsReached = 1;
  let liveMessage = "Straw stab is starting.";
  let localBest = 0;
  let newBest = false;
  let run = 0;

  // --- Canvas, clock, and lifecycle state ----------------------------------

  let canvas: HTMLCanvasElement;
  /** The playfield and the tickets: where Tab cycles during a run. */
  let playScope: HTMLElement;
  /** Where focus rests during a run: not a button, so Space stays the stab. */
  let playfield: HTMLElement;
  let hudRow: HTMLElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;
  /** The run as emoji lines for the results slip's share. */
  let share: string[] = [];
  let popupFont = '500 13px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';
  let reduceMotion = false;

  let viewW = 0;
  let viewH = 0;
  let px = 5;
  let cupW = 45;
  let cupH = 45;
  let strawW = 10;
  let strawH = 60;
  let beltY = 0;
  let strawX = 0;
  let speed = 400;
  let leadSeconds = 2;

  let cups: Cup[] = [];
  let plunge: Plunge | null = null;
  let tumbling: Array<{ x: number; age: number }> = [];
  let reload = 0;
  let particles: Particle[] = [];
  let popups: Popup[] = [];
  let plannedBars = 0;
  let cupCount = 0;
  let currentBar = -1;
  let beatPhase = 1;
  let lastStab = -Infinity;
  /** The worst stab in each bar, for the share. */
  let marks: number[] = [];

  // The scene. Its layout is worked out once per resize, its colours once
  // per visible step of the time of day, and nothing is allocated per frame.
  let stageTop = 80;
  /** The tier the scene is showing, easing toward `tier` over a bar: the time of day. */
  let tierLevel = 0;
  /** The sky's top colour, which the stage behind the canvas also wears. */
  let skyTop = SKY_DUSK[0];
  let farScroll = 0;
  let nearScroll = 0;
  /** A perfect stab lights one string in the cup's colour. */
  let flash: { string: number; color: number; at: number } | null = null;
  let lanternMissAt = -Infinity;
  let fireBar = -1;

  // The clock. Song time is the heard audio time minus the first downbeat.
  // The page clock (performance.now, which event and frame timestamps share)
  // is mapped onto it by one steady offset, read from the audio clock once a
  // frame; so a stab is placed by its event's timestamp, a frame by when it
  // reaches the screen, and both against what is heard. Without audio the
  // offset is zero and song time is plain page time.
  let useAudio = false;
  let origin = 0;
  let clockOffset = 0;
  let clockSynced = false;
  let waitingForAudio = false;
  let waitStarted = 0;
  let heldSong = 0;
  /** The song time last drawn, held while paused so the belt doesn't step back. */
  let lastShown = 0;
  /** The measured frame interval, in seconds: how far ahead a frame is drawn. */
  let frameInterval = 1 / 60;

  let countdownElapsed = 0;
  let last = 0;
  let raf = 0;
  let active = true;
  const timers = createTimers();
  const { later } = timers;

  const perfSeconds = () => performance.now() / 1000;

  /** Reads the audio clock and steadies the page-to-audio offset. */
  function syncClock() {
    if (!useAudio) return;
    const perf = perfSeconds();
    const heard = audioClock();
    if (heard === null) return;
    clockOffset = steadyOffset(clockSynced ? clockOffset : null, heard - perf);
    clockSynced = true;
  }

  /** Song time at a moment on the page clock, in seconds. */
  const songAt = (pageSeconds: number) => songTime(pageSeconds, clockOffset, origin);
  /** Song time as heard right now. */
  const songNow = () => songAt(perfSeconds());

  // --- Layout helpers --------------------------------------------------------

  const cupX = (cup: Cup, now: number) => beltX(strawX, speed, cup.time, now);
  const restBottom = () => beltY - cupH - 14;
  const stuckBottom = () => beltY - cupH + px * 6;
  const pan = (x: number) => (viewW > 0 ? (x / viewW) * 2 - 1 : 0);

  // --- Drawing -------------------------------------------------------------

  function drawStraw(x: number, bottom: number, angle = 0, alpha = 1) {
    if (!ctx) return;
    const sprite = cachedSprite("stab-straw", STRAW, px, STRAW_PALETTE, HALO);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (angle) {
      ctx.translate(x, bottom);
      ctx.rotate(angle);
      ctx.drawImage(sprite, -strawW / 2 - SPRITE_PAD, -strawH - SPRITE_PAD);
    } else {
      ctx.drawImage(
        sprite,
        Math.round(x - strawW / 2) - SPRITE_PAD,
        Math.round(bottom - strawH) - SPRITE_PAD,
      );
    }
    ctx.restore();
  }

  function drawCup(cup: Cup, now: number) {
    if (!ctx) return;
    const center = cupX(cup, now);
    if (center < -cupW || center > viewW + cupW) return;
    const sprite = cup.golden
      ? cachedSprite("stab-cup-gold", CUP, px, GOLD_PALETTE, HALO)
      : cachedSprite(`stab-cup-${cup.drink}`, CUP, px, CUP_PALETTES[cup.drink], HALO);
    ctx.save();
    if (cup.missed) ctx.globalAlpha = 0.45;
    ctx.drawImage(sprite, Math.round(center - cupW / 2) - SPRITE_PAD, beltY - cupH - SPRITE_PAD);
    ctx.restore();
    // Clear plastic: the straw shows through the cup.
    if (cup.straw !== null) drawStraw(center + cup.straw, stuckBottom());
  }

  /** The belt: a cream face between ink lips, so it reads on dusk and night alike. */
  function drawBelt(now: number) {
    if (!ctx) return;
    ctx.fillStyle = INK;
    ctx.fillRect(0, beltY, viewW, BELT_H);
    ctx.fillStyle = BELT_FACE;
    ctx.fillRect(0, beltY + BELT_LIP, viewW, BELT_FACE_H);

    // Every beat is notched into the belt, so the rhythm is visible too.
    ctx.fillStyle = INK;
    const firstBar = barAtTime(TEMPOS, Math.max(0, now - strawX / speed));
    const lastBar = barAtTime(TEMPOS, Math.max(0, now + leadSeconds)) + 1;
    for (let bar = firstBar; bar <= lastBar; bar++) {
      const start = barStart(TEMPOS, bar);
      const beatLength = 60 / barPosition(TEMPOS, bar).bpm;
      for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
        const x = strawX + (start + beat * beatLength - now) * speed;
        if (x < -4 || x > viewW + 4) continue;
        const height = beat === 0 ? BELT_FACE_H : BELT_FACE_H / 2;
        ctx.fillRect(Math.round(x) - 1, beltY + BELT_LIP, 2, height);
      }
    }
  }

  /**
   * A small stepped accent notch on the belt line, centred exactly where a
   * cup's centre is at its beat (strawX sits on the scene grid for this).
   */
  function drawStabMark() {
    if (!ctx) return;
    const x = strawX;
    ctx.fillStyle = ACCENT;
    ctx.fillRect(x - 6, beltY - 12, 12, 4);
    ctx.fillRect(x - 4, beltY - 8, 8, 4);
    ctx.fillRect(x - 2, beltY - 4, 4, 4);
  }

  // --- Scene helpers -----------------------------------------------------------

  // Seeded things (the city, the stars, the lanterns, the wood) come from
  // the core's createRng, so they never reshuffle.

  /** How far a tier-gated layer has eased in: 0 below `from`, 1 a bar after it. */
  const layerWeight = (from: number) => smoothstep(0, 1, tierLevel - (from - 1));
  const nightAt = () => clamp(tierLevel / MAX_TIER, 0, 1);
  const rgb = hexToRgb;
  const mix = mixRgb;
  const toHex = rgbToHex;

  const DUSK_RGB = SKY_DUSK.map(rgb);
  const TWILIGHT_RGB = SKY_TWILIGHT.map(rgb);
  const NIGHT_RGB = SKY_NIGHT.map(rgb);
  /** Band `index` of the sky at time of day `n` (0 dusk, 1 night). */
  const skyBand = (index: number, n: number) =>
    n <= 0.5
      ? mix(DUSK_RGB[index], TWILIGHT_RGB[index], n / 0.5)
      : mix(TWILIGHT_RGB[index], NIGHT_RGB[index], (n - 0.5) / 0.5);

  // --- Scene layout ---------------------------------------------------------------

  /** Belt bottom: the sky and skylines stop here; the stall starts. */
  let skyBottom = 0;
  /** Where the sun sets and the distant haze begins. */
  let horizonY = 0;
  /** From the ticket row down to the belt. */
  let span = 1;
  let sunR = 8;
  let sunX = 0;
  let sunCanvas: HTMLCanvasElement | null = null;
  /** The colour step the cached sky and skylines were painted at. */
  let sceneStep = -1;

  // Colours for the current step, derived on repaint.
  let hazeColor = "";
  let hazeRim = "";
  let farLit = "";
  let farWarm = "";
  let poleLight = "";
  let poleDark = "";

  // Where the beat is, for everything that plays along. Set once per frame.
  let sceneBeat = -1;

  function readBeat(now: number) {
    if (now <= 0) {
      sceneBeat = -1;
      return;
    }
    const bar = barAtTime(TEMPOS, now);
    const beats = (now - barStart(TEMPOS, bar)) / (60 / barPosition(TEMPOS, bar).bpm);
    sceneBeat = bar * BEATS_PER_BAR + Math.min(BEATS_PER_BAR - 1, Math.floor(beats));
  }

  function sizeScene() {
    span = Math.max(80, beltY - stageTop);
    skyBottom = beltY + BELT_H;
    // The play lane: from a little above the resting straw down to the belt.
    laneTop = snap(restBottom() - strawH - 3 * SC, SC);
    // The horizon sits at or above the lane, so the sun sets over it, not behind the cups.
    horizonY = snap(Math.min(beltY - span * 0.3, laneTop - SC), SC);
    sunR = clamp(Math.round((span * 0.07) / SC), 5, 9);
    sunX = snap(viewW * 0.86, SC);
    buildSun();
    far = buildFar();
    near = buildNear();
    buildRigs();
    buildStall();
    buildLane();
    sceneStep = -1;
  }

  // --- The lane shade ----------------------------------------------------------------

  /** Top of the play lane, in px. */
  let laneTop = 0;
  let laneCanvas: HTMLCanvasElement | null = null;

  /** The lane's band at cell scale: solid, with a two-row dithered top edge. */
  function buildLane() {
    const columns = Math.max(1, Math.ceil(viewW / SC));
    const rows = Math.max(1, Math.round((beltY - laneTop) / SC));
    laneCanvas ??= document.createElement("canvas");
    laneCanvas.width = columns;
    laneCanvas.height = rows;
    const context = laneCanvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(columns, rows);
    const [r, g, b] = rgb(LANE_SHADE);
    for (let row = 0; row < rows; row++) {
      const cover = row === 0 ? 0.34 : row === 1 ? 0.67 : 1;
      for (let col = 0; col < columns; col++) {
        const o = (row * columns + col) * 4;
        image.data[o] = r;
        image.data[o + 1] = g;
        image.data[o + 2] = b;
        image.data[o + 3] = cover > bayer(col, row) ? 255 : 0;
      }
    }
    context.putImageData(image, 0, 0);
  }

  function drawLane() {
    if (!ctx || !laneCanvas) return;
    ctx.globalAlpha = LANE_ALPHA;
    ctx.drawImage(laneCanvas, 0, laneTop, laneCanvas.width * SC, laneCanvas.height * SC);
    ctx.globalAlpha = 1;
  }

  /** Repaints the sky and skylines when the time of day has moved a visible step. */
  function syncScene() {
    const step = Math.round(nightAt() * 48);
    if (step === sceneStep) return;
    sceneStep = step;
    const n = step / 48;
    const bands = [0, 1, 2, 3, 4].map((index) => skyBand(index, n));
    // The far city takes a little of the horizon's light at dusk, so it sits
    // back from the nearer rooftops.
    const farFill = mix(mix(rgb(FAR[0]), rgb(FAR[1]), n), bands[4], 0.16 * (1 - n));
    const nearFill = mix(rgb(NEAR[0]), rgb(NEAR[1]), n);
    const haze = mix(bands[4], farFill, 0.6);
    skyTop = toHex(bands[0]);
    hazeColor = toHex(haze);
    hazeRim = toHex(mix(bands[4], haze, 0.45));
    farLit = toHex(mix(rgb(WINDOW_LIT), farFill, 0.3));
    farWarm = toHex(mix(rgb(WINDOW_WARM), farFill, 0.3));
    poleLight = mixHex(COUNTER_SHADE, "#1a1622", n * 0.5);
    poleDark = mixHex("#3e2a20", "#14111a", n * 0.5);
    paintSky(bands);
    paintStrip(far, farFill, mix(farFill, bands[3], 0.3), farFill, farFill);
    paintStrip(
      near,
      nearFill,
      mix(nearFill, bands[3], 0.18),
      mix(nearFill, mix(rgb(AWNING), rgb("#4a2e4e"), n), 0.3),
      mix(nearFill, rgb("#0a0b16"), 0.35),
    );
  }

  // --- Sky, sun, and stars -------------------------------------------------------------

  // Painted at one pixel per scene cell into a small canvas and scaled up
  // without smoothing, so it is chunky by construction and cheap to blit.
  let skyCanvas: HTMLCanvasElement | null = null;
  let skyImage: ImageData | null = null;

  /** Five flat bands joined by ordered dithering. */
  function paintSky(bands: RGB[]) {
    const width = Math.max(1, Math.ceil(viewW / SC));
    const height = Math.max(1, Math.ceil(skyBottom / SC));
    skyCanvas ??= document.createElement("canvas");
    if (skyCanvas.width !== width || skyCanvas.height !== height) {
      skyCanvas.width = width;
      skyCanvas.height = height;
      skyImage = null;
    }
    const context = skyCanvas.getContext("2d");
    if (!context) return;
    skyImage ??= context.createImageData(width, height);
    // Flat for most of each band, dithered across the middle of each join.
    paintBands(skyImage.data, width, height, bands, SKY_STOPS.map((f) => (f * horizonY) / SC));
    context.putImageData(skyImage, 0, 0);
  }

  /** A pixel disc with a one-cell rim, painted once per size. */
  function buildSun() {
    const size = sunR * 2 + 1;
    sunCanvas ??= document.createElement("canvas");
    sunCanvas.width = size;
    sunCanvas.height = size;
    const context = sunCanvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, size, size);
    const rim = mixHex(SUN, SKY_DUSK[4], 0.5);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - sunR, y - sunR);
        if (d > sunR + 0.35) continue;
        context.fillStyle = d > sunR - 0.65 ? rim : SUN;
        context.fillRect(x, y, 1, 1);
      }
    }
  }

  /** Half set on the horizon at dusk; gone behind the haze by the middle tiers. */
  function drawSun() {
    if (!ctx || !sunCanvas) return;
    const night = nightAt();
    if (night >= 0.46) return;
    const sink = snap(smoothstep(0, 1, night / 0.45) * (sunR + 2) * SC, SC);
    const size = sunCanvas.width * SC;
    ctx.drawImage(sunCanvas, sunX - sunR * SC, horizonY + sink - sunR * SC, size, size);
  }

  /** The far plain the sun sets into, with a one-cell rim of light. */
  function drawHaze() {
    if (!ctx) return;
    ctx.fillStyle = hazeColor;
    ctx.fillRect(0, horizonY, viewW, skyBottom - horizonY);
    ctx.fillStyle = hazeRim;
    ctx.fillRect(0, horizonY, viewW, SC);
  }

  /** Kind 0 is one dim cell, 1 one bright cell, 2 a bright cell with soft arms. */
  const STARS = (() => {
    const random = createRng(2207);
    return Array.from({ length: 84 }, (_, index) => {
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

  /** Stars come out from the top down as night falls, dimmed; a dozen twinkle slowly. */
  function drawStars(now: number) {
    if (!ctx) return;
    const night = nightAt();
    if (night < 0.28) return;
    const columns = Math.floor(viewW / SC);
    const rows = Math.max(1, (horizonY - span * 0.1) / SC);
    const twinkling = !reduceMotion;
    // Each star's brightness, in eighths.
    for (let index = 0; index < STARS.length; index++) {
      const star = STARS[index];
      let alpha = quantize((night - (0.3 + 0.42 * star.y + 0.14 * star.wake)) / 0.12, 4);
      if (star.kind === 0) alpha *= 0.5;
      if (twinkling && star.twinkle && alpha > 0) {
        alpha *= Math.max(0.25, quantize(0.5 + 0.5 * Math.sin(now * star.speed * 0.5 + star.phase), 4));
      }
      starLevel[index] = Math.round(alpha * 8);
    }
    ctx.fillStyle = STAR;
    for (let level = 1; level <= 8; level++) {
      ctx.globalAlpha = (level / 8) * STAR_LEVEL;
      ctx.beginPath();
      for (let index = 0; index < STARS.length; index++) {
        if (starLevel[index] !== level) continue;
        const star = STARS[index];
        const x = Math.floor(star.x * columns) * SC;
        const y = Math.floor(star.y * rows) * SC;
        ctx.rect(x, y, SC, SC);
      }
      ctx.fill();
    }
    // The few brightest wear soft arms, a little under half their light.
    for (let index = 0; index < STARS.length; index++) {
      const star = STARS[index];
      if (star.kind !== 2 || !starLevel[index]) continue;
      const x = Math.floor(star.x * columns) * SC;
      const y = Math.floor(star.y * rows) * SC;
      ctx.globalAlpha = (starLevel[index] / 8) * 0.45 * STAR_LEVEL;
      ctx.fillRect(x - SC, y, SC, SC);
      ctx.fillRect(x + SC, y, SC, SC);
      ctx.fillRect(x, y - SC, SC, SC);
      ctx.fillRect(x, y + SC, SC, SC);
    }
    ctx.globalAlpha = 1;
  }

  // --- Skylines ---------------------------------------------------------------------------

  // Two periodic silhouettes, built cell by cell into a bitmap once per
  // resize and painted into a strip canvas once per colour step. Windows are
  // kept apart as single cells, so they can come on one by one as night falls.
  const W_WARM = 1;
  const W_BLINK = 2;
  const W_RED = 4;
  const W_STALL = 8;

  interface Strip {
    period: number;
    rows: number;
    /** 0 sky, 1 fill, 2 awning stripe, 3 stall interior. */
    cells: Uint8Array;
    canvas: HTMLCanvasElement | null;
    image: ImageData | null;
    wx: Int16Array;
    wy: Int16Array;
    /** When each window comes on, against the share of the city that is lit. */
    wu: Float32Array;
    wf: Uint8Array;
    count: number;
  }

  let far: Strip | null = null;
  let near: Strip | null = null;

  function newStrip(period: number, rows: number): Strip {
    return {
      period,
      rows,
      cells: new Uint8Array(period * rows),
      canvas: null,
      image: null,
      wx: new Int16Array(0),
      wy: new Int16Array(0),
      wu: new Float32Array(0),
      wf: new Uint8Array(0),
      count: 0,
    };
  }

  /** Fills a block of cells, wrapping sideways so the strip tiles without a seam. */
  function fillCells(strip: Strip, x: number, y: number, w: number, h: number, value: number) {
    const top = Math.max(0, y);
    const bottom = Math.min(strip.rows, y + h);
    for (let row = top; row < bottom; row++) {
      for (let col = x; col < x + w; col++) {
        strip.cells[row * strip.period + (((col % strip.period) + strip.period) % strip.period)] = value;
      }
    }
  }

  function roofAt(strip: Strip, col: number) {
    let row = 0;
    while (row < strip.rows - 1 && !strip.cells[row * strip.period + col]) row++;
    return row;
  }

  function finishWindows(strip: Strip, list: number[]) {
    const count = list.length / 4;
    strip.wx = new Int16Array(count);
    strip.wy = new Int16Array(count);
    strip.wu = new Float32Array(count);
    strip.wf = new Uint8Array(count);
    for (let index = 0; index < count; index++) {
      strip.wx[index] = list[index * 4];
      strip.wy[index] = list[index * 4 + 1];
      strip.wu[index] = list[index * 4 + 2];
      strip.wf[index] = list[index * 4 + 3];
    }
    strip.count = count;
  }

  /** The far city: blocks with setbacks, water towers, and antennas. */
  function buildFar() {
    const scale = span / SC;
    const rows = Math.ceil(scale * 0.46) + BASE_ROWS + 12;
    const strip = newStrip(FAR_PERIOD, rows);
    const random = createRng(4127);
    const ground = rows - BASE_ROWS;
    const windows: number[] = [];
    let x = 0;
    while (x < FAR_PERIOD) {
      let w = 5 + Math.floor(random() * 10);
      if (FAR_PERIOD - x - w < 5) w = FAR_PERIOD - x;
      const tall = random() < 0.16;
      const height = Math.max(4, Math.round(scale * (tall ? 0.34 + random() * 0.08 : 0.1 + random() * 0.22)));
      const top = ground - height;
      fillCells(strip, x, top, w, rows - top, 1);
      for (let wy = top + 2; wy < Math.min(ground - 1, top + 2 + height * 0.7); wy += 2) {
        for (let wx = x + 1; wx < x + w - 1; wx += 2) {
          if (random() < 0.3) {
            windows.push(wx, wy, random(), (random() < 0.5 ? W_WARM : 0) | (random() < 0.06 ? W_BLINK : 0));
          }
        }
      }
      const roll = random();
      if (w >= 8 && roll < 0.3) {
        // A setback crown.
        const inset = 1 + Math.floor(random() * 2);
        fillCells(strip, x + inset, top - 2 - Math.floor(random() * 3), w - inset * 2, 5, 1);
      } else if (w >= 7 && roll < 0.6) {
        // A water tower: two legs, a tank, a peaked lid.
        const tx = x + 1 + Math.floor(random() * (w - 5));
        fillCells(strip, tx, top - 2, 1, 2, 1);
        fillCells(strip, tx + 3, top - 2, 1, 2, 1);
        fillCells(strip, tx, top - 5, 4, 3, 1);
        fillCells(strip, tx + 1, top - 6, 2, 1, 1);
      }
      if (random() < 0.32) {
        // An antenna, sometimes with a crossbar, and a red light at night.
        const ax = x + 1 + Math.floor(random() * Math.max(1, w - 2));
        const roof = roofAt(strip, ax % FAR_PERIOD);
        const mast = 3 + Math.floor(random() * 5);
        fillCells(strip, ax, roof - mast, 1, mast, 1);
        if (random() < 0.5) fillCells(strip, ax - 1, roof - mast + 2, 3, 1, 1);
        windows.push(ax % FAR_PERIOD, roof - mast, random(), W_RED);
      }
      x += w;
      if (x < FAR_PERIOD - 4 && random() < 0.35) x += 1 + Math.floor(random() * 2);
    }
    finishWindows(strip, windows);
    return strip;
  }

  /** Nearer rooftops and the stalls of the market: striped awnings, lit underneath. */
  function buildNear() {
    const scale = span / SC;
    const rows = Math.ceil(scale * 0.22) + BASE_ROWS + 8;
    const strip = newStrip(NEAR_PERIOD, rows);
    const random = createRng(9203);
    const ground = rows - BASE_ROWS;
    const windows: number[] = [];
    // A continuous low wall, so the belt always sits against the dark.
    fillCells(strip, 0, ground - 3, NEAR_PERIOD, rows, 1);
    let x = 0;
    while (x < NEAR_PERIOD - 4) {
      const kind = random();
      if (kind < 0.42) {
        let w = 10 + Math.floor(random() * 7);
        if (NEAR_PERIOD - x - w < 8) w = NEAR_PERIOD - x - 1;
        const height = Math.max(8, Math.round(scale * (0.07 + random() * 0.04)));
        const top = ground - height;
        // The stall under its awning, then its counter.
        fillCells(strip, x, top + 3, w, rows, 3);
        fillCells(strip, x, top + 3 + Math.max(3, Math.floor((height - 3) * 0.55)), w, rows, 1);
        // Canopy in two-cell stripes with rounded shoulders; the striped
        // tabs hang a cell lower, which makes the scalloped edge.
        for (let col = x - 1; col <= x + w; col++) {
          const stripe = ((col - x + 1) >> 1) & 1 ? 2 : 1;
          const shoulder = col === x - 1 || col === x + w;
          fillCells(strip, col, shoulder ? top + 1 : top, 1, shoulder ? 2 : 3, stripe);
          if (stripe === 2 && !shoulder) fillCells(strip, col, top + 3, 1, 1, 2);
        }
        // A string of stall lights just under the canopy: the first lights on.
        for (let col = x + 1; col < x + w - 1; col += 2) {
          windows.push(
            col % NEAR_PERIOD,
            top + 5,
            random(),
            W_STALL | (random() < 0.5 ? W_WARM : 0) | (random() < 0.1 ? W_BLINK : 0),
          );
        }
        x += w + 1;
      } else if (kind < 0.8) {
        let w = 8 + Math.floor(random() * 10);
        if (NEAR_PERIOD - x - w < 4) w = NEAR_PERIOD - x;
        const height = Math.max(6, Math.round(scale * (0.1 + random() * 0.1)));
        const top = ground - height;
        fillCells(strip, x, top, w, rows, 1);
        if (random() < 0.45) {
          // A stepped gable.
          for (let i = 0; i < w; i++) {
            const rise = Math.min(i, w - 1 - i, 6);
            if (rise > 0) fillCells(strip, x + i, top - rise, 1, rise, 1);
          }
        } else if (random() < 0.6) {
          // A chimney.
          fillCells(strip, x + 1 + Math.floor(random() * (w - 3)), top - 3, 2, 3, 1);
        }
        for (let wy = top + 2; wy < ground - 2; wy += 3) {
          for (let wx = x + 1; wx < x + w - 1; wx += 3) {
            if (random() < 0.4) {
              windows.push(wx % NEAR_PERIOD, wy, random(), (random() < 0.45 ? W_WARM : 0) | (random() < 0.07 ? W_BLINK : 0));
            }
          }
        }
        x += w;
      } else {
        // Just the low wall for a few cells.
        x += 3 + Math.floor(random() * 4);
      }
    }
    finishWindows(strip, windows);
    return strip;
  }

  /** Paints a strip's cells, with a one-cell rim of sky light on every top edge. */
  function paintStrip(strip: Strip | null, fill: RGB, rim: RGB, stripe: RGB, interior: RGB) {
    if (!strip) return;
    const { period, rows, cells } = strip;
    strip.canvas ??= document.createElement("canvas");
    if (strip.canvas.width !== period || strip.canvas.height !== rows) {
      strip.canvas.width = period;
      strip.canvas.height = rows;
      strip.image = null;
    }
    const context = strip.canvas.getContext("2d");
    if (!context) return;
    strip.image ??= context.createImageData(period, rows);
    const data = strip.image.data;
    for (let index = 0; index < period * rows; index++) {
      const value = cells[index];
      const o = index * 4;
      if (!value) {
        data[o + 3] = 0;
        continue;
      }
      const exposed = index < period || cells[index - period] === 0;
      const color = exposed && value !== 3 ? rim : value === 2 ? stripe : value === 3 ? interior : fill;
      data[o] = color[0];
      data[o + 1] = color[1];
      data[o + 2] = color[2];
      data[o + 3] = 255;
    }
    context.putImageData(strip.image, 0, 0);
  }

  function stripOffset(strip: Strip, scroll: number) {
    const width = strip.period * SC;
    return ((snap(scroll, SC) % width) + width) % width;
  }

  function drawStrip(strip: Strip | null, scroll: number) {
    if (!ctx || !strip?.canvas) return;
    const width = strip.period * SC;
    const top = skyBottom - strip.rows * SC;
    for (let x = -stripOffset(strip, scroll); x < viewW; x += width) {
      ctx.drawImage(strip.canvas, x, top, width, strip.rows * SC);
    }
  }

  /**
   * 0 dark, 1 lit, 2 warm, 3 the red light on an antenna. Windows only ever
   * come on as night falls; none blink (the W_BLINK cells from the old
   * market stay in the seed so the city is drawn the same).
   */
  function windowState(strip: Strip, index: number, lit: number) {
    const flags = strip.wf[index];
    const u = strip.wu[index];
    if (flags & W_RED) return nightAt() > 0.42 + u * 0.25 ? 3 : 0;
    const on = flags & W_STALL ? lit * 2.2 > u : lit > u;
    return on ? (flags & W_WARM ? 2 : 1) : 0;
  }

  function drawWindows(strip: Strip | null, scroll: number, distant: boolean) {
    if (!ctx || !strip || !strip.count) return;
    const width = strip.period * SC;
    const top = skyBottom - strip.rows * SC;
    const offset = stripOffset(strip, scroll);
    // Few lit at dusk, about two in three at night, each by its own seed.
    const lit = 0.05 + 0.6 * nightAt();
    for (let state = 1; state <= 3; state++) {
      if (state === 3 && !distant) break;
      ctx.fillStyle =
        state === 3 ? ANTENNA : state === 1 ? (distant ? farLit : WINDOW_LIT) : distant ? farWarm : WINDOW_WARM;
      ctx.beginPath();
      for (let tile = -offset; tile < viewW; tile += width) {
        for (let index = 0; index < strip.count; index++) {
          const x = tile + strip.wx[index] * SC;
          if (x < -SC || x > viewW) continue;
          if (windowState(strip, index, lit) !== state) continue;
          ctx.rect(x, top + strip.wy[index] * SC, SC, SC);
        }
      }
      ctx.fill();
    }
  }

  // --- Lantern strings ----------------------------------------------------------------------

  interface Lantern {
    col: number;
    /** The cord's row where the lantern hangs. */
    row: number;
    color: number;
    /** Time of day its core starts to glow, so they come on one by one. */
    glow: number;
  }

  interface Pennant {
    col: number;
    /** Cord rows at the pennant's three columns. */
    r0: number;
    r1: number;
    r2: number;
    color: number;
  }

  interface Rig {
    /** The tier the string arrives at. */
    from: number;
    canvas: HTMLCanvasElement | null;
    lanterns: Lantern[];
    pennants: Pennant[];
    /** Where its running light starts, so the strings never step in a column. */
    offset: number;
  }

  let rigs: Rig[] = [];
  let poleCols: number[] = [];
  let poleTop = 0;

  function buildRigs() {
    const columns = Math.max(1, Math.ceil(viewW / SC));
    const strawTop = beltY - cupH - 14 - strawH;
    const bandTop = snap(stageTop, SC) + 2 * SC;
    // The cord's lowest point leaves room for a swelled lantern above the straw.
    const lowest = strawTop - 16 - (LANTERN_CLEARANCE + 1) * SC;
    const usable = Math.max(SC * 6, lowest - bandTop);
    const fit = usable >= 150 ? 3 : usable >= 80 ? 2 : 1;
    // [attach, lowest] per string as shares of the band, in the order they arrive.
    const layouts =
      fit === 3
        ? [
            [0.3, 0.62],
            [0.02, 0.3],
            [0.58, 1],
          ]
        : fit === 2
          ? [
              [0.45, 1],
              [0, 0.42],
            ]
          : [[0, 1]];
    const fractions = viewW >= 640 ? [-0.4, 0.06, 0.53, 0.96, 1.4] : [-0.5, 0.62, 1.7];
    const poles = fractions.map((f) => Math.round((f * viewW) / SC));
    poleCols = poles.filter((col) => col >= 0 && col < columns);
    const spacing = viewW >= 640 ? 14 : 11;
    const random = createRng(7741);
    const rows = Math.ceil(lowest / SC) + 4;
    poleTop = rows;

    rigs = layouts.map(([attach, low], s) => {
      const cordRow = new Int16Array(columns);
      const lanterns: Lantern[] = [];
      const jitter = poles.map(() => Math.round((random() - 0.5) * 2));
      for (let i = 0; i < poles.length - 1; i++) {
        const left = poles[i];
        const right = poles[i + 1];
        const a = (bandTop + attach * usable) / SC + jitter[i];
        const b = (bandTop + attach * usable) / SC + jitter[i + 1];
        const sag = ((low - attach) * usable) / SC;
        const rowAt = (col: number) => {
          const t = (col - left) / (right - left);
          return Math.round(a + (b - a) * t + 4 * sag * t * (1 - t));
        };
        for (let col = Math.max(0, left); col <= Math.min(columns - 1, right); col++) cordRow[col] = rowAt(col);
        poleTop = Math.min(poleTop, Math.round(Math.min(a, b)) - 2);
        const count = Math.max(2, Math.round((right - left) / spacing));
        for (let k = 0; k < count; k++) {
          const col = Math.round(left + ((k + 0.5) / count) * (right - left));
          if (col < 2 || col > columns - 3) continue;
          lanterns.push({
            col,
            row: rowAt(col),
            color: (lanterns.length * 3 + s * 5 + 1) % DRINKS.length,
            glow: 0.3 + random() * 0.25,
          });
        }
      }
      // Bunting between neighbouring lanterns that share a swag.
      const pennants: Pennant[] = [];
      for (let k = 0; k < lanterns.length - 1; k++) {
        const col = Math.round((lanterns[k].col + lanterns[k + 1].col) / 2);
        if (col < 1 || col > columns - 2) continue;
        // Never across a pole.
        if (poles.some((pole) => pole > lanterns[k].col && pole < lanterns[k + 1].col)) continue;
        pennants.push({
          col,
          r0: cordRow[col - 1],
          r1: cordRow[col],
          r2: cordRow[col + 1],
          color: (k + s) % PENNANT_COLORS.length,
        });
      }
      // The cord, one cell thick, running down any step to meet its neighbour.
      const canvas = document.createElement("canvas");
      canvas.width = columns;
      canvas.height = rows;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = CORD;
        for (let col = 0; col < columns; col++) {
          const row = cordRow[col];
          const left = col > 0 ? cordRow[col - 1] : row;
          const right = col < columns - 1 ? cordRow[col + 1] : row;
          const end = Math.max(row, Math.max(left, right) - 1);
          context.fillRect(col, row, 1, end - row + 1);
        }
      }
      return { from: s, canvas, lanterns, pennants, offset: s * 7 };
    });
  }

  const lanternSprites: Array<HTMLCanvasElement | undefined> = [];

  /** A lantern at cell scale: colour, core (0 paper, 1 glowing, 2 lit), dim (0–2). */
  function lanternSprite(color: number, core: number, dim: number) {
    const index = (color * 3 + core) * 3 + dim;
    const cached = lanternSprites[index];
    if (cached) return cached;
    const grid = LANTERN;
    const sprite = document.createElement("canvas");
    sprite.width = grid[0].length;
    sprite.height = grid.length;
    const context = sprite.getContext("2d");
    if (context) {
      const body = LANTERN_COLORS[color];
      const fade = (hex: string) => (dim ? mixHex(hex, NOTE_BACK, dim === 1 ? 0.25 : 0.5) : hex);
      const palette: Record<string, string> = {
        k: fade(CORD),
        b: fade(body),
        // The corners shade only lightly, so a lantern reads round, not as a plus.
        s: fade(mixHex(body, CORD, 0.16)),
        t: fade(mixHex(body, CORD, 0.15)),
        c: fade(core === 2 ? LANTERN_CORE : core === 1 ? mixHex(body, LANTERN_CORE, 0.5) : body),
      };
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          const key = grid[row][col];
          if (key === ".") continue;
          context.fillStyle = palette[key];
          context.fillRect(col, row, 1, 1);
        }
      }
    }
    lanternSprites[index] = sprite;
    return sprite;
  }

  // The one soft-edged effect: a warm wash of added light around each lantern.
  let haloSprite: HTMLCanvasElement | null = null;
  function halo() {
    if (!haloSprite) {
      haloSprite = document.createElement("canvas");
      haloSprite.width = haloSprite.height = 64;
      const context = haloSprite.getContext("2d");
      if (context) {
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, "rgba(253, 233, 184, 0.75)");
        gradient.addColorStop(0.4, "rgba(244, 194, 122, 0.3)");
        gradient.addColorStop(1, "rgba(232, 145, 90, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
      }
    }
    return haloSprite;
  }

  /** Each string's weight as it fades in over a bar, in printed quarters. */
  const rigWeight = (rig: Rig) => (rig.from === 0 ? 1 : quantize(layerWeight(rig.from), 4));

  /** Lights one visible string in a stabbed cup's colour. */
  function flashString(now: number, color: number) {
    let active = 0;
    for (const rig of rigs) if (rigWeight(rig) >= 0.5) active += 1;
    if (!active) return;
    let pick = perfects % active;
    for (let s = 0; s < rigs.length; s++) {
      if (rigWeight(rigs[s]) < 0.5) continue;
      if (pick === 0) {
        flash = { string: s, color, at: now };
        return;
      }
      pick -= 1;
    }
  }

  function drawPoles() {
    if (!ctx) return;
    for (const col of poleCols) {
      const x = (col - 1) * SC;
      const y = poleTop * SC;
      ctx.fillStyle = poleLight;
      ctx.fillRect(x, y, SC, skyBottom - y);
      ctx.fillStyle = poleDark;
      ctx.fillRect(x + SC, y, SC, skyBottom - y);
      // A turned finial.
      ctx.fillStyle = COUNTER_FRONT;
      ctx.fillRect(x, y - SC, SC * 2, SC);
    }
  }

  function drawRigs(now: number) {
    if (!ctx || !rigs.length) return;
    drawPoles();
    const night = nightAt();
    const motion = !reduceMotion && sceneBeat >= 0;
    let dim = 0;
    if (!reduceMotion) {
      const t = (now - lanternMissAt) / MISS_DIM_SECONDS;
      if (t >= 0 && t < 1) dim = t < 0.5 ? 2 : 1;
    }
    const haloWeight = smoothstep(0, 1, (night - 0.3) / 0.45) * (dim ? 0.4 : 1);
    const bunting = quantize(layerWeight(3), 4);
    const flashAge = flash ? now - flash.at : -1;
    // The running light steps one lantern along each string per bar.
    const sceneBar = Math.floor(sceneBeat / BEATS_PER_BAR);

    for (let s = 0; s < rigs.length; s++) {
      const rig = rigs[s];
      const weight = rigWeight(rig);
      if (weight <= 0 || !rig.canvas) continue;
      ctx.globalAlpha = weight;
      ctx.drawImage(rig.canvas, 0, 0, rig.canvas.width * SC, rig.canvas.height * SC);

      const count = rig.lanterns.length;
      const litIndex = motion && count ? count - 1 - ((sceneBar + rig.offset) % count) : -1;
      const flashing = flash !== null && flash.string === s && flashAge >= 0 && flashAge < FLASH_SECONDS;

      if (haloWeight > 0.01) {
        ctx.globalCompositeOperation = "lighter";
        ctx.imageSmoothingEnabled = true;
        const glow = halo();
        for (let k = 0; k < count; k++) {
          const lantern = rig.lanterns[k];
          const r = 5 * SC;
          ctx.globalAlpha = weight * haloWeight * (k === litIndex ? 0.26 : 0.16);
          const cx = lantern.col * SC + SC / 2;
          const cy = (lantern.row + 3.5) * SC;
          ctx.drawImage(glow, cx - r, cy - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.imageSmoothingEnabled = false;
      }

      if (bunting > 0) {
        ctx.globalAlpha = weight * bunting;
        for (let color = 0; color < PENNANT_COLORS.length; color++) {
          ctx.fillStyle = PENNANT_COLORS[color];
          ctx.beginPath();
          for (const pennant of rig.pennants) {
            if (pennant.color !== color) continue;
            const x = pennant.col * SC;
            ctx.rect(x - SC, (pennant.r0 + 1) * SC, SC, SC);
            ctx.rect(x, (pennant.r1 + 1) * SC, SC, SC);
            ctx.rect(x + SC, (pennant.r2 + 1) * SC, SC, SC);
            ctx.rect(x, (pennant.r1 + 2) * SC, SC, SC);
          }
          ctx.fill();
        }
      }

      ctx.globalAlpha = weight;
      for (let k = 0; k < count; k++) {
        const lantern = rig.lanterns[k];
        const lit = k === litIndex;
        const color = flashing && flash ? flash.color : lantern.color;
        const core = lit || (flashing && flashAge < 0.12) ? 2 : night >= lantern.glow ? 1 : 0;
        const sprite = lanternSprite(color, core, dim);
        ctx.drawImage(
          sprite,
          (lantern.col - 1) * SC,
          (lantern.row + 1) * SC,
          sprite.width * SC,
          sprite.height * SC,
        );
      }
    }
    ctx.globalAlpha = 1;
  }

  // --- Fireworks -------------------------------------------------------------------------------

  const P_ROCKET = 0;
  const P_SPARK = 1;
  const P_FLASH = 2;
  const sparks = Array.from({ length: MAX_SPARKS }, () => ({
    kind: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 1,
    color: 0,
  }));
  let sparkCount = 0;
  /** Each colour cooling to ember in four printed steps. */
  const COOLING = LANTERN_COLORS.map((color) => [
    color,
    mixHex(color, EMBER_CALM, 0.35),
    mixHex(color, EMBER_CALM, 0.7),
    EMBER_CALM,
  ]);

  function spawnSpark(kind: number, x: number, y: number, vx: number, vy: number, life: number, color: number) {
    if (sparkCount >= MAX_SPARKS) return;
    const p = sparks[sparkCount++];
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.age = 0;
    p.life = life;
    p.color = color;
  }

  const fireworkReach = () => Math.min(64, viewW * 0.08);
  const FIREWORK_ALPHA = 0.7;

  /**
   * A small rocket from the top of the lane, timed to burst on the next beat
   * high in the sky: never over the lane, never in the straw's column.
   */
  function launchFirework(beatLength: number) {
    const keepOut = cupW * 1.5 + fireworkReach();
    const leftEnd = strawX - keepOut;
    const rightStart = strawX + keepOut;
    const leftSpan = Math.max(0, leftEnd - viewW * 0.06);
    const rightSpan = Math.max(0, viewW * 0.94 - rightStart);
    if (leftSpan + rightSpan <= 0) return;
    const pick = Math.random() * (leftSpan + rightSpan);
    const x = pick < leftSpan ? viewW * 0.06 + pick : rightStart + (pick - leftSpan);
    const top = stageTop + 24;
    // Room under the burst for its sparks to fall before they would reach the lane.
    const bottom = Math.max(top, Math.min(beltY - span * 0.45, laneTop - fireworkReach() * 1.2 - 48));
    const burstY = top + Math.random() * (bottom - top);
    const startY = laneTop - SC;
    const life = beatLength * 0.9;
    spawnSpark(P_ROCKET, x, startY, (Math.random() - 0.5) * 16, (burstY - startY) / life, life, (Math.random() * DRINKS.length) | 0);
  }

  function burst(x: number, y: number, color: number) {
    spawnSpark(P_FLASH, x, y, 0, 0, 0.09, color);
    const speed = fireworkReach() * 1.5;
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
      const v = speed * (0.92 + Math.random() * 0.16);
      spawnSpark(P_SPARK, x, y, Math.cos(angle) * v, Math.sin(angle) * v, 1.1 + Math.random() * 0.3, color);
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.3;
      const v = speed * 0.5;
      spawnSpark(P_SPARK, x, y, Math.cos(angle) * v, Math.sin(angle) * v, 0.9, color);
    }
  }

  function stepSparks(dt: number) {
    const drag = Math.max(0, 1 - 1.5 * dt);
    for (let index = sparkCount - 1; index >= 0; index--) {
      const p = sparks[index];
      p.age += dt;
      if (p.age >= p.life) {
        const { kind, x, y, color } = p;
        sparks[index] = sparks[sparkCount - 1];
        sparks[sparkCount - 1] = p;
        sparkCount--;
        if (kind === P_ROCKET) burst(x, y, color);
        continue;
      }
      if (p.kind === P_SPARK) {
        p.vx *= drag;
        p.vy = p.vy * drag + 70 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function drawSparks() {
    if (!ctx || !sparkCount) return;
    for (let index = 0; index < sparkCount; index++) {
      const p = sparks[index];
      const x = snap(p.x, SC);
      const y = snap(p.y, SC);
      // Printed at most at FIREWORK_ALPHA, so a burst stays behind the play.
      if (p.kind === P_ROCKET) {
        ctx.fillStyle = LANTERN_CORE;
        ctx.globalAlpha = FIREWORK_ALPHA;
        ctx.fillRect(x, y, SC, SC);
        ctx.globalAlpha = FIREWORK_ALPHA * 0.5;
        ctx.fillRect(x, y + SC, SC, SC);
        ctx.globalAlpha = FIREWORK_ALPHA * 0.25;
        ctx.fillRect(x, y + SC * 2, SC, SC);
      } else if (p.kind === P_FLASH) {
        ctx.fillStyle = LANTERN_CORE;
        ctx.globalAlpha = FIREWORK_ALPHA;
        ctx.fillRect(x - SC, y, SC * 3, SC);
        ctx.fillRect(x, y - SC, SC, SC * 3);
      } else {
        const t = p.age / p.life;
        ctx.fillStyle = COOLING[p.color][Math.min(3, Math.floor(t * 4))];
        ctx.globalAlpha = FIREWORK_ALPHA * (t > 0.85 ? 0.5 : 1);
        ctx.fillRect(x, y, SC, SC);
      }
    }
    ctx.globalAlpha = 1;
  }

  // --- The stall ------------------------------------------------------------------------------

  let stallCanvas: HTMLCanvasElement | null = null;
  let housingRows = 6;
  const rollerFrames: HTMLCanvasElement[] = [];

  /** Belt housing, counter top, a planked wooden front, and the floor, painted once per size. */
  function buildStall() {
    const columns = Math.max(1, Math.ceil(viewW / SC));
    const rows = Math.max(1, Math.ceil((viewH - skyBottom) / SC));
    housingRows = Math.min(rows, clamp(Math.round(rows * 0.2), 5, 9));
    const topRows = rows - housingRows >= 12 ? 3 : 2;
    const floorRows = clamp(Math.round(rows * 0.12), 2, 7);
    const frontStart = Math.min(rows, housingRows + topRows);
    const floorStart = Math.max(frontStart, rows - floorRows);
    stallCanvas ??= document.createElement("canvas");
    stallCanvas.width = columns;
    stallCanvas.height = rows;
    const context = stallCanvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(columns, rows);
    const data = image.data;

    // Seeded grain streaks in the wood, and where each board's butt joints fall.
    const random = createRng(3301);
    const seams = Array.from({ length: 8 }, () => Math.floor(random() * PLANK_LENGTH));
    const grain = new Uint8Array(columns * rows);
    const frontRows = floorStart - frontStart;
    if (frontRows > 4) {
      for (let k = 0; k < (columns * frontRows) / 45; k++) {
        const col = Math.floor(random() * columns);
        const row = frontStart + 3 + Math.floor(random() * (frontRows - 4));
        if ((row - frontStart) % PLANK_ROWS === PLANK_ROWS - 1) continue;
        const length = 2 + Math.floor(random() * 5);
        for (let i = 0; i < length; i++) grain[row * columns + ((col + i) % columns)] = 1;
      }
    }

    const palette = {
      housing: rgb(HOUSING),
      deep: rgb(HOUSING_DEEP),
      top: rgb(COUNTER_TOP),
      topShade: rgb(COUNTER_TOP_SHADE),
      lip: rgb(COUNTER_LIP),
      front: rgb(COUNTER_FRONT),
      shade: rgb(COUNTER_SHADE),
      plank: rgb(PLANK),
      floor: rgb(FLOOR),
      floorShadow: rgb(FLOOR_SHADOW),
    };
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        let color: RGB;
        if (row < housingRows) {
          color = row === housingRows - 1 ? palette.deep : palette.housing;
        } else if (row < frontStart) {
          const r = row - housingRows;
          color = r === 0 ? palette.top : r === 1 && topRows === 3 ? palette.topShade : palette.lip;
        } else if (row < floorStart) {
          const r = row - frontStart;
          const fromBottom = floorStart - 1 - row;
          const band = Math.floor(r / PLANK_ROWS);
          if (r % PLANK_ROWS === PLANK_ROWS - 1 && fromBottom > 0) color = palette.plank;
          else if ((col + seams[band % seams.length]) % PLANK_LENGTH === 0) color = palette.plank;
          else {
            // Shade under the counter's lip and down at the kick, dithered.
            const shade = r < 3 ? (3 - r) / 3.2 : fromBottom < 2 ? (2 - fromBottom) / 3 : 0;
            color = shade > bayer(col, row) || grain[row * columns + col] ? palette.shade : palette.front;
          }
        } else {
          const r = row - floorStart;
          color = r === 0 || (r === 1 && bayer(col, row) < 0.5) ? palette.floorShadow : palette.floor;
        }
        const o = (row * columns + col) * 4;
        data[o] = color[0];
        data[o + 1] = color[1];
        data[o + 2] = color[2];
        data[o + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);

    if (!rollerFrames.length) {
      for (const spokes of ROLLER_SPOKES) {
        const frame = document.createElement("canvas");
        frame.width = frame.height = ROLLER_GRID.length;
        const c = frame.getContext("2d");
        if (c) {
          for (let y = 0; y < ROLLER_GRID.length; y++) {
            for (let x = 0; x < ROLLER_GRID[y].length; x++) {
              if (ROLLER_GRID[y][x] === ".") continue;
              c.fillStyle = x + y >= 9 ? ROLLER_SHADE : ROLLER;
              c.fillRect(x, y, 1, 1);
            }
          }
          // A mid-tone spoke short of the rim, so the disc stays whole, on a dark hub.
          c.fillStyle = ROLLER_SPOKE;
          for (let i = 0; i < spokes.length; i += 2) c.fillRect(spokes[i], spokes[i + 1], 1, 1);
          c.fillStyle = HOUSING;
          c.fillRect(3, 3, 1, 1);
        }
        rollerFrames.push(frame);
      }
    }
  }

  /** The counter, and rollers peeking out of the housing at the belt's real speed. */
  function drawStall(now: number) {
    if (!ctx || !stallCanvas) return;
    ctx.drawImage(stallCanvas, 0, skyBottom, stallCanvas.width * SC, stallCanvas.height * SC);
    const size = ROLLER_GRID.length;
    const rows = Math.min(size, housingRows);
    if (!rollerFrames.length) return;
    const top = skyBottom + Math.max(0, Math.floor((housingRows - 1 - size) / 2)) * SC;
    const radius = (ROLLER_GRID.length / 2) * SC;
    const angle = reduceMotion ? 0 : (now * speed) / radius;
    const frame = rollerFrames[Math.floor(angle / (Math.PI / 4)) & 3];
    const first = ((Math.round(strawX / SC) % ROLLER_PITCH) + ROLLER_PITCH) % ROLLER_PITCH - ROLLER_PITCH / 2;
    for (let col = first; col * SC < viewW; col += ROLLER_PITCH) {
      ctx.drawImage(frame, 0, 0, size, rows, col * SC, top, size * SC, rows * SC);
    }
  }

  /** Popups as notes: cream on a night backing, gold for gold, legible in either theme. */
  function drawNotes() {
    if (!ctx || !popups.length) return;
    ctx.save();
    ctx.font = popupFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const popup of popups) {
      const alpha = clamp((popup.life / popup.maxLife) * 2, 0, 1);
      drawChipNote(ctx, popup.text, Math.round(popup.x), popup.y, { color: popup.kind === "gold" ? NOTE_GOLD : CREAM, alpha, cell: SC });
    }
    ctx.restore();
  }

  function drawPlunge(now: number) {
    if (!plunge) return;
    const t = Math.min(1, plunge.age / PLUNGE_SECONDS);
    const eased = t * t;
    if (plunge.cup) {
      const targetX = cupX(plunge.cup, now) + plunge.offset;
      drawStraw(
        strawX + (targetX - strawX) * eased,
        restBottom() + (stuckBottom() - restBottom()) * eased,
      );
    } else {
      drawStraw(strawX, restBottom() + (beltY - restBottom()) * eased);
    }
  }

  function drawHand() {
    if (plunge || gameOver || !blinkShows(strawBlink)) return;
    let bottom = restBottom();
    if (reload > 0) bottom -= (reload / RELOAD_SECONDS) * (strawH + RELOAD_RISE);
    else if (running && !reduceMotion) bottom -= Math.max(0, 1 - beatPhase * 3) * 3;
    drawStraw(strawX, bottom);
  }

  function draw(now: number) {
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    syncScene();
    readBeat(now);
    // Back to front: sky, sun and stars, the city, fireworks, the market's
    // rooftops, its lantern strings, the lane's shade, then the stall and the belt.
    ctx.fillStyle = skyTop;
    ctx.fillRect(0, 0, viewW, viewH);
    if (skyCanvas) ctx.drawImage(skyCanvas, 0, 0, skyCanvas.width * SC, skyCanvas.height * SC);
    drawStars(now);
    drawSun();
    drawHaze();
    drawStrip(far, farScroll);
    drawWindows(far, farScroll, true);
    drawSparks();
    drawStrip(near, nearScroll);
    drawWindows(near, nearScroll, false);
    drawRigs(now);
    // Everything behind the cups' lane is laid under one flat dark band.
    drawLane();
    drawStall(now);
    drawBelt(now);
    // A notch on the belt marks where a cup should be when you stab.
    drawStabMark();
    for (const cup of cups) drawCup(cup, now);
    for (const straw of tumbling) {
      const k = straw.age / TUMBLE_SECONDS;
      drawStraw(straw.x - straw.age * speed, beltY, -Math.min(1.3, k * 4), 1 - k);
    }
    drawPlunge(now);
    drawHand();
    drawParticles(ctx, particles);
    // A lesson's spotlight, under its own marks (the brackets and the ghost
    // straw, which open wider than the lit lane) and the notes, which all
    // stay at full strength over it.
    drawLessonLight();
    drawPractice(now);
    drawCupLesson(now);
    drawNotes();
    placeCoach();
  }

  // --- Lessons -------------------------------------------------------------------
  //
  // Taught once per device, inside the live run: stab-lessons.js says what
  // and when, and the coach shows one line at a time. Nothing here bends the
  // beat: lines, brackets, the ghost straw and the spotlight are all drawn
  // for the song time on screen, and play never slows. The two pearl lines
  // stop it outright where there is room (`lookForStop`), the way the pause
  // card does: the audio clock is suspended, so the music and the belt hold
  // together, and Continue picks both up exactly where they stopped.

  /** Song seconds after the first downbeat that "go" is gone by; nothing is taught before. */
  const GO_SECONDS = 0.62;
  /** Coach's distance from an anchor with no ring round it (its 6 + 14 px), and its margin from the window's edges. */
  const SLIP_GAP = 20;
  const SLIP_GUTTER = 16;
  /** A slip's size until it has been on screen to measure: its widest, and two lines with Continue. */
  const SLIP_GUESS = Object.freeze({ id: "", w: 320, h: 76 });
  /** How far above the lane's top the judgement notes reach (two rows, the upper one rising). */
  const NOTES_CLEAR = 52;
  /** Real seconds a lesson's brackets round its cup take to grow on: quick, as the cup may be close. */
  const LOOP_DRAW = 0.1;
  /** The ghost straw shows the stab for this many of the practice's cups. */
  const GHOST_CUPS = 2;
  /** Song seconds the ghost straw rides in its cup after the beat, fading over the last part. */
  const GHOST_RIDE = 0.36;
  const GHOST_FADE = 0.16;

  // In development, `?autoplay` stabs for you, mostly dead on and now and
  // then off (early, late, a graze, a cup let go, a stab at the bare belt),
  // so every lesson can be seen; `?lessons` forgets them first. Never in a
  // production build.
  const devParams = import.meta.env.DEV && typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const autoplay = !!devParams?.has("autoplay");
  if (devParams?.has("lessons")) resetLessons("stab");

  const coach = createCoach("stab");
  interface Cue {
    lesson: Lesson;
    /** The cup it is about, until that cup is taken or lost; null for the notch itself. */
    cup: Cup | null;
  }
  let cue: Cue | null = null;
  /** This run's practice (none once the device has learned the stab). */
  let practice: Practice = createPractice(false);
  /** The coach's lesson and its place, copied out so the page follows them. */
  let coachLesson: Lesson | null = null;
  let coachLeaving = false;
  let coachX: number | null = null;
  let coachY: number | null = null;
  let coachSide: "above" | "below" | "left" = "below";
  /** The slip's size as Coach laid it out, for the lesson it was read for. */
  let slipSize: { id: string; w: number; h: number } = SLIP_GUESS;
  /** The slip offers Continue while it is explaining (not once it is done or on its way out). */
  let coachContinuable = false;
  /** The lesson is over (done, or on its way out): the callout holds where it is. */
  let coachEnded = false;
  /**
   * A pearl line has stopped the belt: the audio clock is suspended (as the
   * pause card suspends it) and the run waits for Continue.
   */
  let lessonHeld = false;
  /** The heard song time until which a pearl line just up looks for room to stop the belt, or null. */
  let stopUntil: number | null = null;
  /** The heard song time the belt stops at, once room was found (HOLD_AFTER on), or null. */
  let holdAt: number | null = null;
  /** Real seconds since room was found, so a press already on its way then is not taken for Continue. */
  let stopAge = 0;
  /** A pearl line is stopping the belt, or about to: the straw waits, and a press continues it. */
  const stopping = () => lessonHeld || holdAt !== null;
  /** How dim the stall is around an explanation, 0..1, eased in real time. */
  let lessonDim = 0;
  /** Real seconds since the last lesson came down (none yet this run: forever), so two never run together. */
  let quietFor = Infinity;
  /** The belt lane from just behind the notch to the right edge: what stays lit (reused every frame). */
  const laneLight: FocusBox[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  /** The practice's tick on each of its cups' beats, on the audio clock. */
  const ticks = createTicks();
  /** What the lessons read each frame, kept in one object rather than built every frame. */
  const moment: { now: number; next: Cup | null; practicing: boolean; seen: number } = { now: 0, next: null, practicing: false, seen: Infinity };

  /** The earliest cup still waiting for the straw: the only one a lesson may be about. */
  const nextCup = () => nextWaiting(cups);

  // The ghost straw, drawn through the core's dither in cream. Its position
  // is set before each draw, so the paint function is made once.
  let ghostX = 0;
  let ghostY = 0;
  /** The plunge the ghost takes, its heights set each frame from the layout. */
  const ghostStraw = { rest: 0, lid: 0, stuck: 0, plunge: PLUNGE_SECONDS, ride: GHOST_RIDE, reduce: false };
  const paintGhostStraw = (g: CanvasRenderingContext2D) =>
    g.drawImage(cachedSprite("stab-straw", STRAW, px, STRAW_PALETTE, HALO), ghostX, ghostY);

  /**
   * The practice's hologram, drawn for the song time on screen (the moment
   * the frame is seen) so it lands with the music: cream pixel brackets
   * round the notch that close onto the next practice cup as it comes and
   * are snug on it exactly on its beat, and for the first two cups a ghost straw that
   * stabs as a dead-on stab should, its tip meeting the lid on the beat, then
   * rides in the cup a moment. Under Reduce Motion the ghost shows only its
   * contact pose, from the beat, and doesn't fade.
   */
  function drawPractice(now: number) {
    if (!ctx || !practiceOn(practice) || !running) return;
    const next = nextCup();
    if (next && practiceAt(practice, next.time)) {
      // Under Reduce Motion they sit closed on the notch, still timed to the beat.
      const grow = practiceBracket(next.time - now, 60 / barPosition(TEMPOS, next.bar).bpm, reduceMotion);
      if (grow !== null) bracketCup(strawX, CREAM, grow);
    }
    // The ghost's tip meets the lid on the beat (see ghostPlunge).
    ghostStraw.rest = restBottom();
    ghostStraw.lid = beltY - cupH;
    ghostStraw.stuck = stuckBottom();
    ghostStraw.reduce = reduceMotion;
    for (const cup of cups) {
      if (cup.number > GHOST_CUPS) break;
      if (!practiceAt(practice, cup.time)) continue;
      // Not over a stab the player already made before the beat.
      if (cup.resolved && cup.takenAt < cup.time) continue;
      const since = now - cup.time;
      const share = ghostPlunge(since, ghostStraw);
      if (share === null) continue;
      const bottom = ghostStraw.rest + (ghostStraw.stuck - ghostStraw.rest) * share;
      // Into the cup as it moves; held still in it under Reduce Motion, unfaded.
      const x = reduceMotion ? cupX(cup, now) : strawX + (cupX(cup, now) - strawX) * share;
      const density = reduceMotion ? 0.55 : 0.55 * clamp((GHOST_RIDE - since) / GHOST_FADE, 0, 1);
      ghostX = Math.round(x - strawW / 2) - SPRITE_PAD;
      ghostY = Math.round(bottom - strawH) - SPRITE_PAD;
      drawGhost(ctx, ghostX, ghostY, strawW + SPRITE_PAD * 2, strawH + SPRITE_PAD * 2, paintGhostStraw, {
        color: CREAM,
        density,
        cell: px,
      });
    }
  }

  /** The layout `bracketBox` rings a cup in, kept in one object rather than built every frame. */
  const bracketLayout = { beltY: 0, cupW: 0, cupH: 0, px: 0 };

  /**
   * Pixel brackets snug round a cup whose centre is at `x`, as the lesson
   * callout rings a thing: `grow` times as big (the practice's close-in, in
   * whole art pixels), `progress` of their arms grown on.
   */
  function bracketCup(x: number, color: string, grow = 1, progress = 1) {
    if (!ctx) return;
    bracketLayout.beltY = beltY;
    bracketLayout.cupW = cupW;
    bracketLayout.cupH = cupH;
    bracketLayout.px = px;
    const box = bracketBox(x, bracketLayout, grow);
    drawBrackets(ctx, box.x, box.y, box.w, box.h, { color, arm: px * 3, bar: px, progress });
  }

  /**
   * The golden and off-beat lines ring their cup on the canvas, on the
   * belt's own clock, so the brackets ride the cup exactly; the slip stays
   * put by the notch, where the cup is headed. Grown on, unless motion is reduced.
   */
  function drawCupLesson(now: number) {
    if (!cue?.cup || coach.current !== cue.lesson || coach.leaving) return;
    bracketCup(cupX(cue.cup, now), ACCENT, 1, reduceMotion ? 1 : Math.min(1, coach.age / LOOP_DRAW));
  }

  /**
   * The explanation's spotlight: the stall, the sky and the belt behind the
   * notch dim under a night wash, and the lane stays lit from just behind
   * the notch to the right edge, straw to belt, so the cup being taught and
   * every cup still to come stay in full light while play goes on.
   */
  function drawLessonLight() {
    if (!ctx || lessonDim <= 0.01) return;
    const box = laneLight[0];
    box.x = strawX - cupW * 1.5;
    box.y = laneTop - SC;
    box.w = viewW - box.x;
    box.h = beltY + BELT_H + SC - box.y;
    drawSpotlight(ctx, viewW, viewH, laneLight, lessonDim, { color: NOTE_BACK, cell: SC });
  }

  /** The slip's size for `lesson`: measured once it is on screen, guessed generously until then. */
  function slipFor(lesson: Lesson) {
    if (slipSize.id === lesson.id) return slipSize;
    const element = playScope?.querySelector<HTMLElement>(".coach .slip");
    if (element && element.offsetHeight > 0 && element.textContent?.includes(lesson.text)) {
      slipSize = { id: lesson.id, w: element.offsetWidth, h: element.offsetHeight };
      return slipSize;
    }
    return SLIP_GUESS;
  }

  /**
   * Where the slip goes, given its size, clear of the notch, the straw, the
   * notes and the cups still to come: under the belt by the notch; else
   * beside the notch, on the belt behind it, where every cup has already
   * gone by; else above the lane, over the notes and the path the next straw
   * comes down after a stab. Where none of them has room for all of it,
   * under the belt or beside the notch, whichever spills least.
   */
  function slipPlace(w: number, h: number) {
    const top = stageTop + 8;
    const belowY = beltY + BELT_H / 2;
    const belowSpill = belowY + SLIP_GAP + h - (viewH - SLIP_GUTTER);
    if (belowSpill <= 0) return { side: "below" as const, x: strawX, y: belowY };
    // Beside the notch: level with a cup on the belt, but never up among the notes.
    const leftX = strawX - cupW / 2;
    const leftY = Math.max(beltY - cupH / 2, restBottom() - strawH + 12 + h / 2);
    const leftSpill = SLIP_GUTTER - (leftX - SLIP_GAP - w);
    if (leftSpill <= 0) return { side: "left" as const, x: leftX, y: leftY };
    // The next straw comes down from its own length and RELOAD_RISE over its rest.
    const reloadTop = restBottom() - 2 * strawH - RELOAD_RISE;
    const aboveY = Math.min(laneTop - NOTES_CLEAR, reloadTop + SLIP_GAP - SC);
    if (aboveY - SLIP_GAP - h >= top) return { side: "above" as const, x: strawX, y: aboveY };
    return belowSpill <= leftSpill
      ? { side: "below" as const, x: strawX, y: belowY }
      : { side: "left" as const, x: leftX, y: leftY };
  }

  /**
   * Puts the callout by the notch, where every lesson is about (a cup's own
   * loop is drawn on the canvas, riding the cup in): see `slipPlace`.
   */
  function placeCoach() {
    const lesson = coach.current;
    if (!lesson || !cue || cue.lesson !== lesson || gameOver) {
      if (coachLesson) coachLesson = null;
      if (coachX !== null) coachX = coachY = null;
      if (coachContinuable) coachContinuable = false;
      return;
    }
    const size = slipFor(lesson);
    const { side, x, y } = slipPlace(size.w, size.h);
    if (coachLesson !== lesson) coachLesson = lesson;
    // The slip stays readable through its minimum life, then fades.
    if (coachLeaving !== coach.fading) coachLeaving = coach.fading;
    const continuable = !coach.leaving && !coach.acting;
    if (continuable !== coachContinuable) coachContinuable = continuable;
    if (continuable === coachEnded) coachEnded = !continuable;
    if (x !== coachX) coachX = x;
    if (y !== coachY) coachY = y;
    if (side !== coachSide) coachSide = side;
  }

  /**
   * Teaches something that has just happened at the notch, if the device
   * still needs it and the stage is free: otherwise a later time it happens.
   * A pearl line then looks for room to stop the belt (`lookForStop`).
   */
  function teach(lesson: Lesson | null) {
    if (!lesson || gameOver || lastShown < GO_SECONDS) return;
    if (!mayOffer(lesson, coach.current, coach.age, quietFor) || !coach.offer(lesson)) return;
    cue = { lesson, cup: null };
    if (STOPS.includes(lesson.id) && !practiceOn(practice)) stopUntil = songNow() + STOP_WITHIN;
  }

  /**
   * While a pearl line just up looks for room: the first moment the next cup
   * will still be a beat off once the sound just made has played out, the
   * belt is set to stop (HOLD_AFTER on). Past STOP_WITHIN, or once the line
   * has gone, it stays over the running belt.
   */
  function lookForStop(now: number) {
    if (stopUntil === null) return;
    const lesson = coach.current;
    if (!lesson || coach.leaving || !STOPS.includes(lesson.id) || now > stopUntil) {
      stopUntil = null;
      return;
    }
    if (!roomToStop({ now, next: nextCup(), beat: 60 / currentBpm })) return;
    stopUntil = null;
    holdAt = now + HOLD_AFTER;
    stopAge = 0;
  }

  /** Holds the song where it is: the audio clock suspended, so the music and the belt stop together. */
  function holdClock() {
    heldSong = songNow();
    if (useAudio) suspendAudio();
  }

  /**
   * Picks the song up where it was held: the audio clock resumed (the belt
   * waits for it, then reads the clock afresh), or, playing silently, the
   * page clock moved on by the time it was held.
   */
  function releaseClock() {
    last = 0;
    if (useAudio) {
      resumeAudio();
      waitingForAudio = true;
      waitStarted = perfSeconds();
    } else {
      origin = perfSeconds() - heldSong;
    }
  }

  /** The pearl line up stops the belt until Continue (the frame calls it at `holdAt`). */
  function holdForLesson() {
    holdAt = null;
    const lesson = coach.current;
    if (lessonHeld || !running || paused || waitingForAudio || gameOver || !lesson || !STOPS.includes(lesson.id) || coach.leaving) return;
    lessonHeld = true;
    holdClock();
  }

  /** The line that stopped the belt is over (or never got to): the run picks up exactly where it stopped. */
  function releaseLesson() {
    holdAt = null;
    stopUntil = null;
    if (!lessonHeld) return;
    lessonHeld = false;
    if (running && !paused && !gameOver) releaseClock();
  }

  /**
   * A frame while a pearl line holds the belt: nothing on it moves (it is
   * drawn where it stopped), and the line doesn't age, so it waits for
   * Continue; its spotlight eases in on real time, and the straw's flicker
   * for the pearl just lost plays out, as the pearl's own does in the tickets.
   */
  function holdFrame(realDt: number) {
    stopAge += realDt;
    strawBlink = Math.max(0, strawBlink - Math.min(realDt, 0.05));
    easeSpotlight(realDt);
    // The development autoplay reads for a moment, then carries on.
    if (autoplay && coach.current && !coach.leaving && stopAge >= 2) continueLesson();
    if (!coach.current || coach.leaving) releaseLesson();
  }

  /** Asks the lessons what is coming that should be taught, once "go" is gone. */
  function checkLessons(shown: number) {
    // A line about a cup is over once its cup has been taken or lost; its
    // loop goes, and the line stays by the notch until it has been read.
    if (cue?.cup?.resolved) {
      if (coach.current === cue.lesson && !coach.leaving) coach.done(cue.lesson.id);
      cue.cup = null;
    }
    if (shown >= GO_SECONDS) {
      moment.now = shown;
      moment.next = nextCup();
      moment.practicing = practiceOn(practice);
      // Wholly on screen: a cup's centre half a cup in from the right edge.
      moment.seen = (viewW - strawX - cupW / 2) / speed;
      const found = lessonNow(moment, coach.learned);
      if (
        found &&
        found.lesson.id !== coach.current?.id &&
        mayOffer(found.lesson, coach.current, coach.age, quietFor) &&
        coach.offer(found.lesson)
      ) {
        cue = { lesson: found.lesson, cup: found.cup };
      }
    }
    if (!coach.current) cue = null;
  }

  /**
   * One frame of the lessons, on real time: the coach ages the line (it
   * never slows anything here; its time scale is ignored), lines are asked
   * for, and the spotlight eases in with an explanation and out as it ends.
   */
  function stepLessons(shown: number, realDt: number) {
    coach.step(realDt);
    quietFor = coach.current ? 0 : quietFor + realDt;
    if (!gameOver) checkLessons(shown);
    easeSpotlight(realDt);
  }

  /** The spotlight eases in with an explanation and out as it ends, on real time (at once under Reduce Motion). */
  function easeSpotlight(realDt: number) {
    const lesson = coach.current;
    const target = lesson && cue?.lesson === lesson && !coach.leaving && !coach.acting ? 1 : 0;
    lessonDim = reduceMotion ? target : lessonDim + (target - lessonDim) * (1 - Math.exp(-Math.min(realDt, 0.25) / 0.18));
  }

  /**
   * Puts each practice cup's tick on the audio clock as its beat comes
   * within the look-ahead, so the practice can be followed by ear: the
   * downbeat is in the clock notes are scheduled in, so a cup's beat there
   * is the downbeat plus its song time. The look-ahead is measured on that
   * same clock, not the heard one, which lags it by the output's latency (a
   * Bluetooth headset's can be longer than the look-ahead itself). Without
   * audio there is nothing to tick, and the visual practice carries on.
   */
  function scheduleTicks() {
    if (!useAudio || !practiceOn(practice)) return;
    const now = ticks.now();
    if (now === null) return;
    for (const cup of cups) {
      if (cup.ticked) continue;
      if (!practiceAt(practice, cup.time) || origin + cup.time - now > TICK_LOOKAHEAD) break;
      cup.ticked = true;
      if (origin + cup.time >= now) ticks.at(origin + cup.time, PLAYLIST[barPosition(TEMPOS, cup.bar).song]);
    }
  }

  /**
   * The practice is over (two good stabs in a row, its cups all gone, or
   * Continue): its line goes, counted if it taught the stab, or uncounted
   * so the next run practises again. A tick already on its way for a cup
   * that now scores is silenced.
   */
  function finishPractice() {
    ticks.stop();
    const learned = practiceLearned(practice);
    if (coach.current?.id === LESSONS.stab.id && !coach.leaving) {
      if (learned) coach.done(LESSONS.stab.id);
      else coach.dismiss();
    } else if (learned) coach.done(LESSONS.stab.id);
  }

  /**
   * The player has read it: Continue (Enter on the playfield, or the slip's
   * button) ends the line and its spotlight. On the practice it ends the
   * practice too, counted as known, and the belt counts from then on. A line
   * that stopped the belt starts it again, exactly where it stopped.
   */
  function continueLesson() {
    const lesson = coach.current;
    if (!lesson || coach.leaving || !running || paused || gameOver) return;
    if (lesson.id === LESSONS.stab.id && practiceOn(practice)) {
      endPractice(practice);
      ticks.stop();
    }
    coach.done(lesson.id);
    releaseLesson();
  }

  // --- Rules in motion ---------------------------------------------------------

  function planAhead(now: number) {
    while (barStart(TEMPOS, plannedBars) < now + leadSeconds + 0.6) {
      const bar = plannedBars;
      const start = barStart(TEMPOS, bar);
      const beatLength = 60 / barPosition(TEMPOS, bar).bpm;
      const barTier = tierForBar(TEMPOS, bar, mode);
      for (const beat of cupBeats(TEMPOS, bar, Math.random, mode)) {
        cupCount += 1;
        const time = start + beat * beatLength;
        cups.push({
          time,
          bar,
          beat,
          tier: barTier,
          number: cupCount,
          drink: (Math.random() * DRINKS.length) | 0,
          golden: isGoldenCup(cupCount),
          resolved: false,
          missed: false,
          takenAt: 0,
          ticked: false,
          straw: null,
        });
        planPracticeCup(practice, cupCount, time, mode);
        if (autoplay) planAutoplay(time, cupCount, beatLength);
      }
      plannedBars += 1;
    }
  }

  function updateBeat(now: number) {
    const bar = barAtTime(TEMPOS, now);
    const position = barPosition(TEMPOS, bar);
    const beatLength = 60 / position.bpm;
    const beats = (now - barStart(TEMPOS, bar)) / beatLength;
    beatPhase = now < 0 ? 1 : beats - Math.floor(beats);
    const beat = now < 0 ? -1 : Math.min(BEATS_PER_BAR - 1, Math.floor(beats));
    if (beat !== beatInBar) beatInBar = beat;
    if (bar === currentBar) return;

    // A new song after the first: its first downbeat is when it is taught.
    const songs = position.loop * TEMPOS.length + position.song + 1;
    const newSong = currentBar >= 0 && songs !== songsReached;
    currentBar = bar;
    currentBpm = position.bpm;
    songsReached = songs;
    const nextTier = tierForBar(TEMPOS, bar, mode);
    const tierRose = nextTier > tier;
    if (nextTier !== tier) {
      tier = nextTier;
      setMusicPhase(tier >= 2 ? "rush" : "steady");
      liveMessage = `${TIER_LABELS[tier]}.`;
    }
    if (newSong) teach(lessonForSong({ tierRose, practicing: practiceOn(practice) }, coach.learned));
  }

  /**
   * Eases the time of day toward the current tier over about a bar, drifts
   * the skylines slowly, and runs the fireworks. Reduced motion steps the sky
   * between tiers and leaves everything else still.
   */
  function stepScene(now: number, dt: number) {
    const shownTier = Math.min(tier, MAX_TIER);
    if (reduceMotion) {
      tierLevel = shownTier;
      sparkCount = 0;
      return;
    }
    const step = dt / barSeconds(currentBpm);
    tierLevel += clamp(shownTier - tierLevel, -step, step);
    farScroll = (farScroll + dt * speed * 0.006) % (FAR_PERIOD * SC);
    nearScroll = (nearScroll + dt * speed * 0.018) % (NEAR_PERIOD * SC);
    stepSparks(dt);
    if (now > 0 && currentBar !== fireBar) {
      fireBar = currentBar;
      // At full night a small firework goes up every other bar.
      if (tier >= MAX_TIER && tierLevel > MAX_TIER - 0.5 && currentBar % 2 === 0) {
        launchFirework(60 / currentBpm);
      }
    }
    if (flash && now - flash.at > FLASH_SECONDS) flash = null;
  }

  /** Lands any straw still on its way down, before the next one goes. */
  function settlePlunge() {
    if (!plunge) return;
    if (plunge.cup) plunge.cup.straw = plunge.offset;
    else tumbling.push({ x: strawX, age: 0 });
    plunge = null;
  }

  function loseLife(x: number) {
    combo = 0;
    lives -= 1;
    if (lives > 0) strawBlink = REVIVE_BLINK_SECONDS;
    missPulse += 1;
    missFlash = true;
    later(() => (missFlash = false), 250);
    if (lives <= 0) void endGame();
    else liveMessage = `${lives} ${lives === 1 ? "pearl" : "pearls"} left.`;
    return pan(x);
  }

  /** Stab input can act: a live run, not stopped for a line or waiting on audio. */
  const canStab = () => running && !paused && !stopping() && !gameOver && !waitingForAudio;

  /**
   * A stab key or tap. While a pearl line has the belt stopped (or is about
   * to) there is nothing at the notch to stab (the line only stops it with
   * the next cup a beat off), so the press continues the line instead, once
   * it has been up a moment (PRESS_AFTER); a press sooner does nothing.
   */
  function press(event: Event) {
    if (stopping() && !paused) {
      if (stopAge >= PRESS_AFTER) continueLesson();
      return;
    }
    stabFromEvent(event);
  }

  /** A key or tap, judged at the moment it happened, not when it was handled. */
  function stabFromEvent(event: Event) {
    if (!canStab()) return;
    stab(songAt(inputSeconds(event.timeStamp, performance.now())));
  }

  /**
   * Stabs at song time `at`: the straw goes into the nearest cup still
   * waiting within the graze window, or hits the belt. Every stab comes
   * through here. Up to the practice's boundary on the song clock, its cups
   * score nothing and nothing costs a pearl, the belt included.
   */
  function stab(at: number) {
    if (at - lastStab < STAB_COOLDOWN) return;
    lastStab = at;
    settlePlunge();
    reload = 0;

    const index = nearestCup(cups, at, mode);
    const impactY = beltY - cupH + px * 1.5;
    const noteY = restBottom() - strawH - 8;
    if (index < 0) {
      // Nothing under the straw: it hits the belt.
      plunge = { cup: null, offset: 0, age: 0 };
      for (let i = 0; i < 7; i++) addParticle(particles, strawX, beltY, i % 2 ? INK : ROLLER, 70, 300);
      addPopup(popups, strawX, noteY, "bonk", "miss");
      if (practiceAt(practice, at)) {
        practiceResult(practice, "bonk");
        sfxWhiff(pan(strawX));
        liveMessage = "The straw hit the belt.";
        return;
      }
      lanternMissAt = at;
      markBar(marks, barAtTime(TEMPOS, at), "miss");
      sfxWhiff(loseLife(strawX));
      teach(lessonForStab({ result: "bonk", error: 0, practicing: false, expert: mode.expert }, coach.learned));
      return;
    }

    const cup = cups[index];
    const error = at - cup.time;
    const rating = judgeStab(error, mode, cup.tier) ?? "graze";
    cup.resolved = true;
    cup.takenAt = at;
    // Early stabs land left of center and late ones right, as the cup moves.
    const offset = clamp(error / mode.windows.graze, -1, 1) * (cupW / 2 - px * 1.5);
    plunge = { cup, offset, age: 0 };

    if (practiceAt(practice, cup.time)) {
      // Practice: the stab is rated and placed, said aloud, and nothing is scored.
      const x = cupX(cup, lastShown) + offset;
      const count = rating === "perfect" ? 10 : rating === "good" ? 7 : 5;
      for (let i = 0; i < count; i++) {
        addParticle(particles, x, impactY, i % 3 === 0 ? PAPER_WHITE : i % 3 === 1 ? ACCENT : DRINKS[cup.drink], 80, 320);
      }
      addPopup(popups, strawX, noteY, rating, rating === "perfect" ? "perfect" : "plain");
      if (rating !== "perfect") addPopup(popups, strawX, noteY - 22, error < 0 ? "early" : "late", "plain");
      sfxStab(rating, 1, pan(x));
      const word = `${rating[0].toUpperCase()}${rating.slice(1)}`;
      liveMessage = rating === "perfect" ? `${word}.` : `${word}, ${error < 0 ? "early" : "late"}.`;
      // A good stab is kept for later runs at once, so leaving now doesn't
      // mean practising again; this practice still runs to its streak.
      if (rating !== "graze") coach.skip(LESSONS.stab.id);
      if (practiceResult(practice, rating)) finishPractice();
      return;
    }

    markBar(marks, cup.bar, rating);

    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    hits += 1;
    if (rating === "perfect") perfects += 1;
    const points = pointsForStab(rating, cup.golden, combo);
    score += points;

    const x = cupX(cup, lastShown) + offset;
    const liquid = cup.golden ? "#f2b84b" : DRINKS[cup.drink];
    const count = rating === "perfect" ? 10 : rating === "good" ? 7 : 5;
    if (rating === "perfect" && !reduceMotion) flashString(at, cup.golden ? GOLD_INDEX : cup.drink);
    for (let i = 0; i < count; i++) {
      addParticle(particles, x, impactY, i % 3 === 0 ? PAPER_WHITE : i % 3 === 1 ? "#e85d4c" : liquid, 80, 320);
    }
    const label = cup.golden ? `golden ${rating}` : rating;
    addPopup(
      popups,
      strawX,
      noteY,
      combo > 4 ? `${label} +${points} ×${combo}` : `${label} +${points}`,
      cup.golden ? "gold" : rating === "perfect" ? "perfect" : "plain",
    );
    // Off the notch, a second note says which way, so the timing can be trusted.
    if (rating !== "perfect") addPopup(popups, strawX, noteY - 22, error < 0 ? "early" : "late", "plain");
    if (combo % 20 === 0) {
      sfxMilestone(pan(x));
      liveMessage = `${combo} in a row. Score ${score}.`;
    } else {
      sfxStab(rating, combo, pan(x));
      if (cup.golden) liveMessage = `Golden cup, ${points} points.`;
    }
    teach(lessonForStab({ result: rating, error, practicing: false, expert: mode.expert }, coach.learned));
  }

  /** Seconds off each cup's beat, in turn; null lets that cup go, "bonk" stabs the belt a beat before it. */
  const AUTOPLAY_AIMS: Array<number | null | "bonk"> = [0, 0, 0.07, 0, -0.07, 0, 0.13, 0, null, 0, "bonk", 0, 0.03];
  /** The autoplay's stabs still to come, in song time, in order. */
  let autoplayStabs: number[] = [];

  function planAutoplay(time: number, count: number, beatLength: number) {
    const aim = AUTOPLAY_AIMS[count % AUTOPLAY_AIMS.length];
    if (aim === null) return;
    if (aim === "bonk") autoplayStabs.push(time - beatLength / 2 - 0.02);
    autoplayStabs.push(time + (aim === "bonk" ? 0 : aim));
    autoplayStabs.sort((a, b) => a - b);
  }

  function runAutoplay(shown: number) {
    while (autoplayStabs.length && autoplayStabs[0] <= shown) {
      const at = autoplayStabs.shift() as number;
      // Not into a belt a line is stopping.
      if (!stopping()) stab(at);
    }
  }

  function stepStraws(dt: number) {
    if (plunge) {
      plunge.age += dt;
      if (plunge.age >= PLUNGE_SECONDS) {
        settlePlunge();
        reload = RELOAD_SECONDS;
      }
    } else if (reload > 0) {
      reload = Math.max(0, reload - dt);
    }
    for (let index = tumbling.length - 1; index >= 0; index--) {
      tumbling[index].age += dt;
      if (tumbling[index].age >= TUMBLE_SECONDS) tumbling.splice(index, 1);
    }
  }

  // --- Game loop -----------------------------------------------------------

  function beginRun() {
    countdown = 0;
    goVisible = true;
    later(() => (goVisible = false), 620);
    // Drums from the first bar: the beat is the whole game here. Expert
    // opens in a busy tier, so it opens in the rush arrangement too.
    setMusicPhase(tier >= 2 ? "rush" : "steady");
    const downbeat = startMusic(PLAYLIST);
    useAudio = downbeat !== null && audioClock() !== null;
    clockSynced = false;
    clockOffset = 0;
    if (useAudio && downbeat !== null) {
      origin = downbeat;
      syncClock();
    } else {
      // No running audio: play silently on the page clock instead of
      // letting unsynced music drift against the belt.
      stopMusic();
      origin = perfSeconds() + 0.12;
    }
    sfxStart();
    running = true;
    liveMessage = "Go. Stab on the beat.";
  }

  function frame(timestamp: number) {
    if (!active) return;
    if (!last) last = timestamp;
    const rawDt = (timestamp - last) / 1000;
    last = timestamp;
    // How long frames take here, so each is drawn for when it will be seen.
    if (rawDt > 0.002 && rawDt < 0.1) frameInterval += (rawDt - frameInterval) * 0.1;
    const dt = Math.min(rawDt, 0.05);

    if (paused || lessonHeld) {
      if (!paused) holdFrame(rawDt);
      draw(running ? lastShown : 0);
      raf = requestAnimationFrame(frame);
      return;
    }
    strawBlink = Math.max(0, strawBlink - dt);

    if (!running) {
      const step = stepCountdown(countdownElapsed, countdown, Math.min(rawDt, 0.25));
      countdownElapsed = step.elapsed;
      if (step.beep) {
        countdown = step.count;
        sfxCountdown(countdown);
      }
      if (step.done) beginRun();
      draw(0);
      raf = requestAnimationFrame(frame);
      return;
    }

    if (waitingForAudio) {
      if (audioClock() !== null) {
        waitingForAudio = false;
        clockSynced = false;
      } else if (perfSeconds() - waitStarted > 0.8) {
        // Audio did not come back: carry on silently from the same beat.
        waitingForAudio = false;
        useAudio = false;
        stopMusic();
        clockOffset = 0;
        origin = perfSeconds() - heldSong;
      } else {
        draw(lastShown);
        raf = requestAnimationFrame(frame);
        return;
      }
    }

    syncClock();
    // Heard now: misses are called against this.
    const now = songNow();
    // A pearl line stops the belt where there is room, once the sound just
    // made has played out: drawn where it was, and held from here until Continue.
    lookForStop(now);
    if (holdAt !== null) stopAge += rawDt;
    if (holdAt !== null && now >= holdAt) {
      holdForLesson();
      if (lessonHeld) {
        draw(lastShown);
        raf = requestAnimationFrame(frame);
        return;
      }
    }
    // On screen at the next refresh: everything is drawn for this.
    const shown = songAt(presentSeconds(timestamp, performance.now(), frameInterval));
    lastShown = shown;
    planAhead(shown);
    scheduleTicks();
    if (autoplay) runAutoplay(shown);
    for (const cup of cups) {
      if (!isMissed(cup, now, mode)) continue;
      cup.resolved = true;
      cup.missed = true;
      cup.takenAt = now;
      const x = cupX(cup, shown);
      addPopup(popups, x, beltY - cupH - 18, "no straw", "miss", 0.8);
      // A practice cup let go costs nothing.
      if (practiceAt(practice, cup.time)) {
        liveMessage = "The cup went by.";
        if (practiceResult(practice, "miss")) finishPractice();
        continue;
      }
      lanternMissAt = now;
      markBar(marks, cup.bar, "miss");
      sfxMiss(loseLife(x));
      if (gameOver) return;
      teach(lessonForMiss(false, coach.learned));
    }
    cups = cups.filter((cup) => cupX(cup, shown) > -cupW * 2);
    updateBeat(shown);
    stepScene(shown, dt);
    stepStraws(dt);
    stepParticles(particles, dt);
    stepPopups(popups, dt);
    stepLessons(shown, rawDt);
    draw(shown);
    if (active && !gameOver) raf = requestAnimationFrame(frame);
  }

  // --- Pause, restart, and finish -----------------------------------------

  async function pauseGame() {
    if (gameOver || paused) return;
    paused = true;
    // A line holding the belt has already held the clock.
    if (running && !waitingForAudio && !lessonHeld) holdClock();
    liveMessage = "The game is paused.";
    await tick();
    pauseCard?.focus();
  }

  function resumeGame() {
    if (gameOver || !paused) return;
    paused = false;
    last = 0;
    // Back to a line holding the belt, it stays held until Continue.
    if (running && !lessonHeld) releaseClock();
    sfxBlip();
    liveMessage = "The game resumed.";
    void tick().then(focusPlayfield);
  }

  /** Puts focus on the playfield, so keys go to the game and Space stabs. */
  function focusPlayfield() {
    playfield?.focus({ preventScroll: true });
  }

  /**
   * Shift+Tab from the playfield wraps to the last control in the tickets
   * (or a lesson's Continue): the playfield isn't in the Tab order itself,
   * so the shell's trap would let it leave the game.
   */
  function onPlayfieldTab(event: KeyboardEvent) {
    if (event.key !== "Tab" || !event.shiftKey || document.activeElement !== playfield) return;
    const controls = playScope?.querySelectorAll<HTMLElement>("button:not([disabled])");
    const last = controls?.[controls.length - 1];
    if (!last) return;
    event.preventDefault();
    last.focus();
  }

  function togglePause() {
    if (paused) resumeGame();
    else void pauseGame();
  }

  async function endGame() {
    if (gameOver) return;
    gameOver = true;
    running = false;
    active = false;
    cancelAnimationFrame(raf);
    // A line read long enough counts as seen; one cut short comes again.
    const lesson = coach.current;
    if (lesson && !lesson.move && !coach.leaving && coach.age >= (lesson.minLife ?? 0.9)) coach.done(lesson.id);
    coach.dismiss();
    cue = null;
    lessonHeld = false;
    holdAt = null;
    stopUntil = null;
    ticks.stop();
    lessonDim = 0;
    const result = concludeRun("stab", score);
    localBest = result.best;
    newBest = result.newBest;
    share = shareRows(marks);
    liveMessage = `Last call. Final score ${score}.`;
    draw(lastShown);
    await tick();
    slip?.focus();
  }

  /** A fresh belt: new songs, nothing on it, the clock stopped. */
  function resetRun() {
    cancelAnimationFrame(raf);
    // A run left while a line held the belt mustn't leave the audio clock frozen.
    if (lessonHeld) resumeAudio();
    lessonHeld = false;
    holdAt = null;
    stopUntil = null;
    stopMusic();
    timers.clear();
    PLAYLIST = stabPlaylist();
    TEMPOS = songTempos(PLAYLIST);
    score = 0;
    lives = mode.lives;
    strawBlink = 0;
    combo = 0;
    bestCombo = 0;
    hits = 0;
    perfects = 0;
    countdown = COUNTDOWN_SECONDS;
    countdownElapsed = 0;
    goVisible = false;
    running = false;
    paused = false;
    gameOver = false;
    missPulse = 0;
    missFlash = false;
    beatInBar = -1;
    currentBpm = TEMPOS[0];
    tier = tierForBar(TEMPOS, 0, mode);
    tierLevel = Math.min(tier, MAX_TIER);
    songsReached = 1;
    newBest = false;
    cups = [];
    plunge = null;
    tumbling = [];
    reload = 0;
    particles = [];
    popups = [];
    plannedBars = 0;
    cupCount = 0;
    currentBar = -1;
    lastStab = -Infinity;
    lastShown = 0;
    marks = [];
    share = [];
    farScroll = 0;
    nearScroll = 0;
    flash = null;
    lanternMissAt = -Infinity;
    fireBar = -1;
    sparkCount = 0;
    useAudio = false;
    waitingForAudio = false;
    last = 0;
    // A device that hasn't learned the stab opens on the practice.
    practice = createPractice(!coach.learned(LESSONS.stab.id));
    ticks.stop();
    coach.reset();
    cue = null;
    lessonDim = 0;
    quietFor = Infinity;
    autoplayStabs = [];
    run += 1;
    active = true;
  }

  /** A run: the countdown, then the belt, with focus on the playfield. */
  function restart() {
    resetRun();
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
    raf = requestAnimationFrame(frame);
    void tick().then(focusPlayfield);
  }

  // --- Sizing and lifecycle ------------------------------------------------

  function sizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    ctx = fitCanvas(canvas, viewW, viewH);
    px = viewW < 640 ? 4 : 6;
    cupW = CUP[0].length * px;
    cupH = CUP.length * px;
    strawW = STRAW[0].length * px;
    strawH = STRAW.length * px;
    // Measured from the ticket row, not the whole HUD.
    const playTop = hudRow ? hudRow.getBoundingClientRect().bottom : 80;
    // On the scene's cell grid, so the belt lines up with the stall below it.
    // On a screen too short for both, room for the straw and a cup above the
    // belt wins over room below it (so not the core clamp, which would let
    // the floor lose).
    const lowest = playTop + strawH + cupH + 48;
    const highest = viewH - Math.max(48, viewH * 0.12);
    beltY = snap(Math.max(lowest, Math.min(highest, playTop + (viewH - playTop) * 0.62)), SC);
    // On the grid too, so the notch (drawn on the grid) is exactly where a
    // cup's centre is at its beat.
    strawX = snap(viewW * (viewW < 640 ? 0.24 : 0.3), SC);
    speed = clamp((viewW - strawX) / 1.7, 220, 620);
    leadSeconds = (viewW - strawX + cupW) / speed;
    stageTop = playTop;
    // A lesson's slip may lay out differently at the new size: measure it again.
    slipSize = SLIP_GUESS;
    sizeScene();
    draw(running ? lastShown : 0);
  }

  function onPointer(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    press(event);
  }

  function onKey(event: KeyboardEvent) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    // Enter on the playfield continues past the line that is up; a focused
    // button (pause, mute, Continue itself) keeps its own Enter.
    if (key === "Enter") {
      if (coachContinuable && !paused && !isOnControl(event)) {
        event.preventDefault();
        continueLesson();
      }
      return;
    }
    if (!STAB_KEYS.has(key)) return;
    if (key === " ") {
      // Space on the HUD's own buttons or a lesson's Continue is the stab:
      // focus goes back to the playfield first, so the button isn't pressed
      // on the key's release and a later Enter continues a line rather than
      // pressing it. Any other focused button keeps Space.
      const ours = event.target instanceof HTMLElement && event.target.closest(".boba-hud button, .coach button");
      if (ours) focusPlayfield();
      else if (isOnControl(event)) return;
    }
    event.preventDefault();
    press(event);
  }

  onMount(() => {
    popupFont = arcadeFont();
    const unmountShell = mountShell({
      isOver: () => gameOver,
      isPaused: () => paused,
      pause: () => void pauseGame(),
      togglePause,
      // Tab cycles the playfield, the tickets' buttons, and a lesson's Continue.
      playScope: () => playScope,
      onKey,
      onResize: sizeCanvas,
      // The ticket row can change height (a font loading, a narrow screen
      // wrapping it), and the belt sits below it.
      observe: hudRow,
      onReduceMotion: (reduce) => (reduceMotion = reduce),
    });
    // Ahead of the shell's own Tab handling, which this wraps for the playfield.
    window.addEventListener("keydown", onPlayfieldTab, true);
    sizeCanvas();
    // Straight to the countdown: the belt teaches as it runs.
    restart();

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      // Never leave the shared audio clock frozen behind a closed game.
      resumeAudio();
      stopMusic();
      ticks.stop();
      timers.clear();
      unmountShell();
      window.removeEventListener("keydown", onPlayfieldTab, true);
    };
  });
</script>

<div class="boba-stage ss-stage" style:background={skyTop} on:pointerdown={onPointer} aria-hidden="true"></div>
<canvas bind:this={canvas} class="boba-canvas" aria-hidden="true"></canvas>

<div bind:this={playScope} class="ss-play">
  <!-- Where focus rests during the run: not a button, so Space stays the stab. -->
  <div bind:this={playfield} class="sr-only" tabindex="-1" role="group" aria-label="Straw stab playfield"></div>
  <header class="boba-hud boba-ui is-bare" aria-label="Straw stab status">
    <div bind:this={hudRow} class="boba-hud-row">
      <div class="boba-ticket boba-ticket-start boba-riso" style="--tilt: -1.2deg">
        <span class="boba-ticket-icon" aria-hidden="true">
          <PixelIcon grid={MENU_ICONS.stab.grid} palette={MENU_ICONS.stab.palette} px={3} />
        </span>
        <span class="boba-big">{String(score).padStart(3, "0")}</span>
        <span class="boba-stack">
          <span class="ss-meta">
            <span class="boba-meta">points</span>
            <ExpertTag />
          </span>
          <span class="boba-line">
            {#if combo > 1}
              {#key combo}
                <span class="boba-combo active">×{combo} combo</span>
              {/key}
            {/if}
          </span>
        </span>
      </div>

      <div
        class="boba-ticket boba-ticket-center boba-riso"
        class:is-rush={tier >= 2}
        style="--tilt: 0.9deg"
      >
        <span class="beats" aria-hidden="true">
          {#each [0, 1, 2, 3] as beat}
            <span class="beat" class:on={running && !paused && !lessonHeld && beat === beatInBar}></span>
          {/each}
        </span>
        <span class="boba-stack">
          <span class="boba-meta">{currentBpm} bpm</span>
          <span class="boba-phase">{TIER_LABELS[tier]}</span>
        </span>
        {#key run}
          <TrackFlag />
        {/key}
      </div>

      <div class="boba-ticket boba-ticket-end boba-riso" style="--tilt: -0.7deg">
        <Pearls left={lives} total={mode.lives} pulse={missPulse} />
        <HudButtons {paused} on:pause={togglePause} />
      </div>
    </div>
  </header>

  <!-- The lesson's callout, under the belt by the notch or the cup it is about. -->
  <Coach
    lesson={coachLesson}
    x={coachX}
    y={coachY}
    side={coachSide}
    leaving={coachLeaving}
    ended={coachEnded}
    continuable={coachContinuable}
    on:continue={continueLesson}
    returnFocus={focusPlayfield}
    hidden={paused || gameOver}
    top={stageTop + 8}
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
    on:resume={resumeGame}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

{#if gameOver}
  <ResultsSlip
    bind:this={slip}
    game="stab"
    title="last call"
    deck={`${LIVES_WORDS[mode.lives]} cups went by without a straw, ${songsReached} ${songsReached === 1 ? "song" : "songs"} in.`}
    {score}
    {newBest}
    {share}
    stats={[
      { label: "cups strawed", value: hits },
      { label: "perfect stabs", value: perfects },
      { label: "best combo", value: `×${bestCombo}` },
      { label: "personal best", value: localBest },
    ]}
    on:restart={restart}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>

<style>
  /* The playfield and the tickets, as one Tab scope; no box of its own. */
  .ss-play {
    display: contents;
  }

  /* The scene has no light mode: the stage wears the sky's top colour in
     both themes, so the site never shows through behind the canvas. */
  .ss-stage {
    background: #232132;
  }

  /* The score's unit, and "expert" beside it in an expert run. */
  .ss-meta {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-1);
  }

  /* Four beat lights, one per beat of the bar: square pixel cells on the
     ticket's chip, an outline lit solid in the accent on its beat, switched
     at once as the scene's pixels are, never eased or scaled. */
  .beats {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .beat {
    width: 12px;
    height: 12px;
    border: 2px solid var(--b-line);
    border-radius: 0;
  }

  .beat.on {
    background: var(--b-slab);
    border-color: var(--b-slab);
  }
</style>
