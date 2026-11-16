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
  } from "$lib/sfx";
  import {
    PLAYFIELD_TOP,
    bounceHorizontal,
    catchGolden,
    catchRules,
    clampSpawnCenter,
    createLives,
    demoTarget,
    difficultyAt,
    dropPearl,
    formatShift,
    isGoldenSpawn,
    isPerfectCatch,
    planThrow,
    pointsForCatch,
    shiftCells,
    volleySize,
  } from "$lib/boba-engine";
  import {
    DRINKS,
    ICON_BOBA,
    ICON_BOBA_PAL,
    PEARL,
    addParticle,
    addPopup,
    arcadeFont,
    drawHalo,
    drawParticles,
    drawPopups,
    drawSprite,
    fitCanvas,
    stepParticles,
    stepPopups,
    type Particle,
    type Popup,
  } from "$lib/arcade/art";
  import { COUNTDOWN_SECONDS, stepCountdown } from "$lib/arcade/countdown.js";
  import { demoIntro, firstVisit } from "$lib/arcade/scores";
  import { emojiRows } from "$lib/arcade/share";
  import { arcadeExits, concludeRun, createTimers, isOnControl, mountShell } from "$lib/arcade/shell";
  import { arcadeExpert, takeDemoRequest } from "$lib/boba";
  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import Countdown from "./Countdown.svelte";
  import { REVIVE_BLINK_SECONDS, blinkShows } from "$lib/arcade/blink";
  import DemoBar from "./DemoBar.svelte";
  import DemoCard from "./DemoCard.svelte";
  import ExpertTag from "./ExpertTag.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import Pearls from "./Pearls.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";
  import TrackFlag from "./TrackFlag.svelte";

  const { exit, toMenu } = arcadeExits(createEventDispatcher<{ close: null; menu: null }>());
  type GamePhase = "opening" | "steady" | "rush";
  type Difficulty = ReturnType<typeof difficultyAt>;
  type Rules = ReturnType<typeof catchRules>;

  // Read once: the switch lives on the menu. The demo always plays normal.
  const PLAY_RULES = catchRules(get(arcadeExpert));
  const DEMO_RULES = catchRules(false);

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
    O: "#2b2320",
    l: "#ece3d6",
    b: PEARL,
    S: "#ff5277",
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

  interface Boba {
    x: number;
    y: number;
    vx: number;
    vy: number;
    gravity: number;
    liquid: string;
    grid: string[];
    golden: boolean;
    /** When (on the sim clock) and where it reaches the catch line. */
    landAt: number;
    landCenter: number;
    launchedAt: number;
    /** The demo's aim error for this cup, and whether the demo lets it fall. */
    aim: number;
    skip: boolean;
  }

  interface PendingSpawn {
    x: number;
    y: number;
    remaining: number;
    telegraph: number;
    held: number;
    golden: boolean;
    source: HTMLElement | null;
  }

  // --- The demo's script ---------------------------------------------------

  // The demo plays normal at forty seconds in, then jumps to rush hour for
  // its last stretch to show the pace climbing.
  const DEMO_RAMP_START = 40;
  const DEMO_PACE_OFFSET = 95;
  const DEMO_REACTION = 0.2;
  const DEMO_SPEED = 1500;
  const DEMO_CAPTIONS = [
    "Move the mouse to catch the cups the links throw.",
    "Catch near the middle of the basket for a bonus point.",
    "Golden cups are worth three points.",
    "Golden cups are worth three points.",
    "Missing a cup drops one of your three pearls.",
    "Three golden cups in a row win a dropped pearl back.",
    "It keeps speeding up until the last pearl drops.",
    "It keeps speeding up until the last pearl drops.",
  ];

  // --- Reactive UI state ---------------------------------------------------

  let rules: Rules = PLAY_RULES;
  let basketW = rules.basketWidth;
  let basketGrid = rules.expert ? BASKET_SMALL : BASKET;
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
  // Shown on the first real run on this device, never in the demo.
  let tipVisible = false;
  let tipChecked = false;
  let missPulse = 0;
  let missFlash = false;
  let liveMessage = "Boba catch starting";
  let localBest = 0;
  let newBest = false;
  let share: string[] = [];
  // Bumped on every start so the song flag starts fresh with the new run.
  let run = 0;

  /** First time here: asked whether to watch the demo before the countdown. */
  let asking = false;
  let demoOn = false;
  let demoEnded = false;
  let demoCaption = "";
  let demoStep = 0;
  let demoStepAt = 0;
  let demoClock = 0;
  let demoSkipNext = false;
  let demoBar: DemoBar;

  // --- Canvas and lifecycle state -----------------------------------------

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let popupFont = '500 13px "neue-haas-grotesk-text", Helvetica, Arial, sans-serif';
  let hudButtons: HudButtons;
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
  /** Seconds on shift. The ramp reads it (plus the demo's offset). */
  let elapsed = 0;
  let rampOffset = 0;
  let countdownElapsed = 0;
  let spawnTimer = 0;
  let spawnNumber = 0;
  let basketSquash = 0;
  /** Seconds the basket has left to flicker after a pearl drops or comes back. */
  let basketBlink = 0;
  let last = 0;
  let raf = 0;
  let active = true;
  const timers = createTimers();
  const { later } = timers;

  const clamp = (value: number, low: number, high: number) =>
    Math.max(low, Math.min(high, value));

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
    const halo = boba.golden ? "rgba(255, 226, 124, 0.9)" : "rgba(253, 248, 243, 0.8)";
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
    ctx.fillStyle = spawn.golden ? "#f2b84b" : "#e85d4c";
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

  function drawScene() {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewW, viewH);
    for (const spawn of pendingSpawns) drawTelegraph(spawn);
    for (const boba of bobas) drawBoba(boba);
    drawParticles(ctx, particles);
    drawPopups(ctx, popups, popupFont);
    drawBasket(basketLeft());
  }

  // --- Spawning and effects ------------------------------------------------

  function eligibleLinks() {
    // The demo's strip sits under the tickets; nothing is thrown from behind it.
    const strip = demoOn
      ? document.querySelector('.boba-ui[role="region"][aria-label="Demo"]')?.getBoundingClientRect()
      : null;
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
          rect.left < viewW &&
          !(strip && rect.top < strip.bottom + 12 && rect.bottom > strip.top - 12),
      );
  }

  /** One throw: a single cup, or a volley from several links at once. */
  function queueVolley(size: number, difficulty: Difficulty) {
    const links = eligibleLinks();
    for (let index = 0; index < size; index++) {
      queueSpawn(links, difficulty.telegraph + index * VOLLEY_STAGGER);
    }
  }

  function queueSpawn(links: ReturnType<typeof eligibleLinks>, telegraph: number) {
    let centerX = BOBA_W / 2 + Math.random() * Math.max(1, viewW - BOBA_W);
    let centerY = MIN_SPAWN_CENTER_Y + Math.random() * Math.max(1, viewH * 0.2);
    let source: HTMLElement | null = null;

    if (links.length) {
      // Each link throws one cup at a time.
      const [choice] = links.splice((Math.random() * links.length) | 0, 1);
      centerX = choice.rect.left + choice.rect.width / 2;
      centerY = choice.rect.top + choice.rect.height / 2;
      source = choice.element;
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
    });

    if (demoOn && golden && demoStep === 1) goDemoStep(2);
  }

  /**
   * The cup a link throws, or null if it would land where the basket can't
   * also get to every other cup in time; the link then holds it a moment.
   */
  function launch(spawn: PendingSpawn, difficulty: Difficulty, now: number): Boba | null {
    const others = bobas
      .filter((boba) => boba.landAt > now)
      .map((boba) => ({ time: boba.landAt, center: boba.landCenter }));
    const field = { catchLine: basketY + BASKET_PX, sprite: BOBA_SPRITE, viewportWidth: viewW, basketWidth: basketW };
    const plan = planThrow(difficulty, spawn, field, others, now);
    if (!plan) return null;

    const straw = STRAWS[(Math.random() * STRAWS.length) | 0];
    const skip = demoOn && demoSkipNext && !spawn.golden;
    if (skip) demoSkipNext = false;
    return {
      x: spawn.x,
      y: spawn.y,
      vx: plan.vx,
      vy: plan.vy,
      gravity: difficulty.gravity,
      liquid: DRINKS[(Math.random() * DRINKS.length) | 0],
      grid: [...straw, ...CUP],
      golden: spawn.golden,
      landAt: plan.landAt,
      landCenter: plan.landCenter,
      launchedAt: now,
      aim: demoOn ? (Math.random() - 0.5) * basketW * 0.62 : 0,
      skip,
    };
  }

  function addCatchEffects(boba: Boba, centerX: number, perfect: boolean, points: number) {
    basketSquash = 0.13;
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

  function registerCatch(boba: Boba, centerX: number, basketX: number) {
    const perfect = isPerfectCatch(centerX, basketX, basketW, rules.perfectRadius);
    const points = pointsForCatch(boba.golden, perfect);
    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    caughtCount += 1;
    if (perfect) perfectCatches += 1;
    score += points;
    tipVisible = false;
    addCatchEffects(boba, centerX, perfect, points);

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

    if (demoOn) return;
    if (restored) {
      liveMessage = `Golden cup caught. A pearl is back, ${lives.left} left.`;
    } else if (boba.golden) {
      liveMessage = `Golden cup caught for ${points} points`;
    } else if (perfect) {
      liveMessage = `Perfect catch for ${points} points`;
    } else if (caughtCount % 5 === 0) {
      liveMessage = `${caughtCount} cups caught. Score ${score}.`;
    }
  }

  function registerMiss(boba: Boba, centerX: number) {
    combo = 0;
    addMissEffects(boba, centerX);
    sfxMiss(viewW > 0 ? (centerX / viewW) * 2 - 1 : 0);

    if (demoOn) {
      // The demo shows a pearl dropping but never ends on one.
      if (lives.left > 1) lives = dropPearl(lives);
      else lives = { ...lives, goldens: 0 };
      basketBlink = REVIVE_BLINK_SECONDS;
      if (demoStep === 3) goDemoStep(4);
      return;
    }

    lives = dropPearl(lives);
    if (lives.left > 0) basketBlink = REVIVE_BLINK_SECONDS;
    events.push({ time: elapsed, kind: "drop" });
    liveMessage =
      lives.left > 0
        ? `Miss. ${lives.left} ${lives.left === 1 ? "pearl" : "pearls"} left.`
        : "No pearls left.";

    if (lives.left <= 0) void endGame();
  }

  // --- The demo ------------------------------------------------------------

  function goDemoStep(step: number) {
    demoStep = step;
    demoStepAt = demoClock;
    demoCaption = DEMO_CAPTIONS[step] ?? demoCaption;
    if (step !== 3) demoSkipNext = false;
    if (step === 3) demoSkipNext = true;
    if (step === 6) rampOffset = DEMO_PACE_OFFSET;
  }

  /** The script: each step waits for its moment, or for time to run out. */
  function stepDemo(dt: number) {
    demoClock += dt;
    if (demoEnded) return;
    const inStep = demoClock - demoStepAt;
    if (demoStep === 0 && demoClock >= 5.5) goDemoStep(1);
    // Step 1 moves on when the first golden cup is about to fly.
    else if (demoStep === 1 && demoClock >= 13) goDemoStep(2);
    else if (demoStep === 2 && inStep >= 3.5) goDemoStep(3);
    // Step 3 lets one cup fall, and moves on when it lands.
    else if (demoStep === 3 && inStep >= 5) goDemoStep(4);
    else if (demoStep === 4 && inStep >= 4) goDemoStep(5);
    else if (demoStep === 5 && inStep >= 4) goDemoStep(6);
    else if (demoStep === 6 && inStep >= 5) goDemoStep(7);
    else if (demoStep === 7 && ((!bobas.length && !pendingSpawns.length) || inStep >= 3)) {
      // Idle now: no more throws, and the music settles back down.
      demoEnded = true;
      phase = "opening";
      setMusicPhase(phase);
    }
  }

  /** The demo's hand on the mouse: it moves the basket the way a player would. */
  function steerDemo(dt: number, now: number) {
    const seen = bobas
      .filter((boba) => !boba.skip && now - boba.launchedAt >= DEMO_REACTION)
      .map((boba) => ({ time: boba.landAt, center: boba.landCenter + boba.aim, golden: boba.golden }));
    const target = demoTarget(seen, now);
    const goal = target ? target.center : demoEnded && !bobas.length ? viewW / 2 : pointerX;
    const gap = goal - pointerX;
    const step = Math.min(Math.abs(gap) * Math.min(1, dt * 10), DEMO_SPEED * dt);
    pointerX = clamp(pointerX + Math.sign(gap) * step, basketW / 2, viewW - basketW / 2);
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
    later(() => (goVisible = false), 620);
  }

  function step(dt: number) {
    elapsed += dt;
    simTime += dt;
    if (demoOn) stepDemo(dt);

    const difficulty = difficultyAt(elapsed + rampOffset, rules);
    if (difficulty.phase !== phase && !(demoOn && demoEnded)) {
      phase = difficulty.phase;
      setMusicPhase(phase);
      if (!demoOn) liveMessage = `${sentence(phaseLabel(phase))}.`;
    }
    const shown = formatShift(elapsed);
    if (shown !== shiftLabel) shiftLabel = shown;

    const throwing = !demoOn || demoStep < 7;
    if (throwing) {
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
    }

    if (demoOn) steerDemo(dt, simTime);

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

      if (boba.y > viewH + 10) {
        bobas.splice(index, 1);
        registerMiss(boba, centerX);
        if (gameOver) return;
      }
    }

    basketSquash = Math.max(0, basketSquash - dt);
    basketBlink = Math.max(0, basketBlink - dt);
    stepParticles(particles, dt);
    stepPopups(popups, dt);
  }

  function frame(timestamp: number) {
    if (!active || gameOver) return;
    if (!last) last = timestamp;
    const rawDt = (timestamp - last) / 1000;
    last = timestamp;
    const dt = Math.min(rawDt, 0.05);
    const clockDt = Math.min(rawDt, 0.25);

    if (paused || asking) {
      drawScene();
      raf = requestAnimationFrame(frame);
      return;
    }

    if (countdown > 0) {
      const next = stepCountdown(countdownElapsed, countdown, clockDt);
      countdownElapsed = next.elapsed;
      if (next.beep) {
        countdown = next.count;
        sfxCountdown(countdown);
      }
      if (next.done) beginRound();
      drawScene();
      raf = requestAnimationFrame(frame);
      return;
    }

    step(dt);
    if (gameOver) {
      drawScene();
      return;
    }
    drawScene();
    if (active) raf = requestAnimationFrame(frame);
  }

  function runLoop() {
    cancelAnimationFrame(raf);
    last = 0;
    active = true;
    raf = requestAnimationFrame(frame);
  }

  // --- Starting, pausing, and finishing -------------------------------------

  function clearSpawnSources() {
    document
      .querySelectorAll(".boba-source, .boba-source-gold")
      .forEach((element) => element.classList.remove("boba-source", "boba-source-gold"));
  }

  /** A clean counter for a new run or demo, on `next`'s rules. */
  function resetRun(next: Rules) {
    stopMusic();
    clearSpawnSources();
    timers.clear();
    rules = next;
    basketW = rules.basketWidth;
    basketGrid = rules.expert ? BASKET_SMALL : BASKET;
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
    rampOffset = 0;
    countdownElapsed = 0;
    spawnTimer = 0;
    spawnNumber = 0;
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
    asking = false;
    demoOn = false;
    demoEnded = false;
    run += 1;
  }

  /** A real run, after the countdown. */
  function startRun() {
    resetRun(PLAY_RULES);
    countdown = COUNTDOWN_SECONDS;
    pointerX = clamp(mouseX, basketW / 2, viewW - basketW / 2);
    // The first-run tip shows on the first real run on this device.
    if (!tipChecked) {
      tipChecked = true;
      tipVisible = firstVisit("catch");
    } else {
      tipVisible = false;
    }
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
    drawScene();
    runLoop();
  }

  /** The demo: normal rules, played by an autopilot on the real engine. */
  async function startDemo() {
    resetRun(DEMO_RULES);
    demoOn = true;
    countdown = 0;
    tipVisible = false;
    rampOffset = DEMO_RAMP_START;
    demoClock = 0;
    goDemoStep(0);
    pointerX = viewW / 2;
    const difficulty = difficultyAt(rampOffset, rules);
    phase = difficulty.phase;
    // The first cup flies almost at once.
    spawnTimer = difficulty.spawnInterval - 0.35;
    setMusicPhase(phase);
    startMusic();
    liveMessage = "Demo playing.";
    drawScene();
    runLoop();
    await tick();
    demoBar?.focus();
  }

  async function pauseGame() {
    if (gameOver || !active || paused || asking) return;
    paused = true;
    setMusicPaused(true);
    liveMessage = demoOn ? "Demo paused" : "Game paused";
    await tick();
    pauseCard?.focus();
  }

  function resumeGame() {
    if (gameOver || !active || !paused) return;
    paused = false;
    last = 0;
    setMusicPaused(false);
    sfxBlip();
    liveMessage = countdown > 0 ? `Countdown ${countdown}` : demoOn ? "Demo resumed" : "Game resumed";
    hudButtons?.focusPause();
  }

  function togglePause() {
    if (paused) resumeGame();
    else void pauseGame();
  }

  async function endGame() {
    if (gameOver || demoOn) return;
    active = false;
    gameOver = true;
    paused = false;
    cancelAnimationFrame(raf);
    clearSpawnSources();
    const result = concludeRun("catch", score);
    localBest = result.best;
    newBest = result.newBest;
    const cells = shiftCells(events, elapsed);
    // The time on shift is already one of the shared stats.
    share = emojiRows(cells, cells.length <= 12 ? 12 : 10, 3);
    liveMessage = `Game over after ${formatShift(elapsed)} on shift. Final score ${score}.`;
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
    drawScene();
  }

  onMount(() => {
    mouseX = window.innerWidth / 2;
    pointerX = mouseX;
    popupFont = arcadeFont();
    sizeCanvas();

    const onMove = (event: MouseEvent) => {
      mouseX = event.clientX;
      // The demo moves the basket itself.
      if (!demoOn) pointerX = mouseX;
    };
    const unmountShell = mountShell({
      isOver: () => gameOver,
      isPaused: () => paused,
      pause: () => void pauseGame(),
      togglePause,
      playScope: () =>
        asking
          ? document.querySelector('[aria-labelledby="boba-demo-title"]')
          : demoOn
            ? document.querySelector(".boba-arcade")
            : document.querySelector(".boba-hud"),
      onKey: (event) => {
        if (asking) return;
        // Space pauses too, unless a focused control keeps it for itself.
        if (event.key === " " && !isOnControl(event)) {
          event.preventDefault();
          togglePause();
        }
      },
      onResize: sizeCanvas,
      pauseOnPointerLeave: true,
    });
    window.addEventListener("mousemove", onMove, { passive: true });

    const intro = demoIntro("catch", takeDemoRequest("catch"));
    if (intro === "demo") void startDemo();
    else if (intro === "ask") {
      asking = true;
      liveMessage = "Watch the demo, or play.";
      runLoop();
    } else startRun();

    return () => {
      active = false;
      cancelAnimationFrame(raf);
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
  class:is-demo={demoOn || asking}
  on:click={swallow}
  on:pointerdown={swallow}
  on:wheel={swallow}
  aria-hidden="true"
></div>
<canvas bind:this={canvas} class="boba-canvas" aria-hidden="true"></canvas>

<header class="boba-hud boba-ui" aria-label="Boba catch status">
  <div class="boba-hud-row">
    <div class="boba-ticket boba-ticket-start boba-riso" style="--tilt: -1.4deg">
      <span class="boba-ticket-icon" aria-hidden="true">
        <PixelIcon grid={ICON_BOBA} palette={ICON_BOBA_PAL} px={3} />
      </span>
      <span class="boba-big">{String(score).padStart(3, "0")}</span>
      <span class="boba-stack">
        <span class="boba-meta">points</span>
        {#key combo}
          <span class="boba-combo" class:active={combo > 1}>
            {combo > 1 ? `×${combo} combo` : "no combo yet"}
          </span>
        {/key}
      </span>
      {#if !demoOn}
        <ExpertTag />
      {/if}
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
      <HudButtons bind:this={hudButtons} {paused} on:pause={togglePause} />
    </div>
  </div>

  {#if tipVisible && !paused && !gameOver}
    <div class="boba-tip" role="note" aria-label="How to play">
      <span>move the basket to catch the cups</span>
    </div>
  {/if}
</header>

{#if !asking && !demoOn && (countdown > 0 || goVisible)}
  <Countdown value={countdown} />
{/if}

{#if missFlash}
  <div class="boba-miss-flash" aria-hidden="true"></div>
{/if}

{#if asking}
  <DemoCard on:watch={() => void startDemo()} on:play={startRun} />
{/if}

{#if demoOn && !paused}
  <DemoBar
    bind:this={demoBar}
    caption={demoCaption}
    ended={demoEnded}
    placement="top"
    on:play={startRun}
    on:again={() => void startDemo()}
  />
{/if}

{#if paused && !gameOver}
  <PauseCard
    bind:this={pauseCard}
    resumeLabel={demoOn ? "Resume demo" : "Resume shift"}
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
    deck="The last pearl dropped. The floor is sticky now."
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
  /* The demo plays itself, so the pointer is free for its buttons. */
  .boba-stage.is-demo {
    cursor: default;
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
