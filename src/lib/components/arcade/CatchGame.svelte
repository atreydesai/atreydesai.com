<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  import {
    finishMusic,
    setMusicPaused,
    setMusicPhase,
    sfxBlip,
    sfxCatch,
    sfxCountdown,
    sfxGameOver,
    sfxGolden,
    sfxMilestone,
    sfxMiss,
    sfxStart,
    startMusic,
    stopMusic,
  } from "$lib/sfx";
  import {
    COUNTDOWN_SECONDS,
    GAME_DURATION_SECONDS,
    PLAYFIELD_TOP,
    bounceHorizontal,
    clampSpawnCenter,
    difficultyForElapsed,
    isGoldenSpawn,
    isPerfectCatch,
    pointsForCatch,
    timeRemaining,
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
  import { trapFocus } from "$lib/arcade/focus";
  import { firstVisit, recordScore } from "$lib/arcade/scores";
  import Mark from "$lib/components/Mark.svelte";
  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import Countdown from "./Countdown.svelte";
  import CupTimer from "./CupTimer.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import Pearls from "./Pearls.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";
  import TrackFlag from "./TrackFlag.svelte";

  const dispatch = createEventDispatcher<{ close: null; menu: null }>();
  type GamePhase = "opening" | "steady" | "rush";

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
  const BASKET_W = BASKET[0].length * BASKET_PX;
  const BASKET_H = BASKET.length * BASKET_PX;
  const TELEGRAPH_SECONDS = 0.44;
  const MIN_SPAWN_CENTER_Y = PLAYFIELD_TOP + BOBA_H / 2 + 74;

  interface Boba {
    x: number;
    y: number;
    vx: number;
    vy: number;
    liquid: string;
    grid: string[];
    golden: boolean;
  }

  interface PendingSpawn {
    x: number;
    y: number;
    remaining: number;
    golden: boolean;
    source: HTMLElement | null;
  }

  // --- Reactive UI state ---------------------------------------------------

  let score = 0;
  let hearts = 3;
  let combo = 0;
  let bestCombo = 0;
  let caughtCount = 0;
  let perfectCatches = 0;
  let gameOver = false;
  let endReason: "hearts" | "time" = "hearts";
  let paused = false;
  let countdown = COUNTDOWN_SECONDS;
  let goVisible = false;
  let timeLeft = GAME_DURATION_SECONDS;
  let phase: GamePhase = "opening";
  // Initialized after mount to avoid flashing first-run guidance for returning
  // players before their cookie can be read.
  let tipVisible = false;
  let missPulse = 0;
  let missFlash = false;
  let liveMessage = "Boba catch starting";
  let localBest = 0;
  let newBest = false;
  // Bumped on restart so the song flag starts fresh with the new run.
  let run = 0;

  // --- Canvas and lifecycle state -----------------------------------------

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let popupFont = "500 13px monospace";
  let hudButtons: HudButtons;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;

  let bobas: Boba[] = [];
  let pendingSpawns: PendingSpawn[] = [];
  let particles: Particle[] = [];
  let popups: Popup[] = [];
  let viewW = 0;
  let viewH = 0;
  let basketY = 0;
  let pointerX = 0;
  let elapsed = 0;
  let countdownElapsed = 0;
  let spawnTimer = 0;
  let spawnNumber = 0;
  let basketSquash = 0;
  let last = 0;
  let raf = 0;
  let active = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const clamp = (value: number, low: number, high: number) =>
    Math.max(low, Math.min(high, value));

  const phaseLabel = (value: GamePhase) => {
    if (value === "rush") return "rush hour";
    if (value === "steady") return "steady pour";
    return "opening shift";
  };

  function later(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function exit() {
    sfxBlip();
    dispatch("close");
  }

  // The stage sits over the page: nothing it receives should reach the page.
  function swallow(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  function toMenu() {
    sfxBlip();
    dispatch("menu");
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
    if (!ctx) return;
    const context = ctx;
    const drawAt = (x: number, y: number) => {
      drawHalo(context, BASKET, x, y, BASKET_PX, "rgba(253, 248, 243, 0.62)");
      drawSprite(context, BASKET, x, y, BASKET_PX, BPAL);
    };

    if (basketSquash <= 0) {
      drawAt(basketX, basketY);
      return;
    }

    const amount = Math.min(1, basketSquash / 0.13);
    context.save();
    context.translate(basketX + BASKET_W / 2, basketY + BASKET_H);
    context.scale(1 + amount * 0.1, 1 - amount * 0.08);
    drawAt(-BASKET_W / 2, -BASKET_H);
    context.restore();
  }

  function drawTelegraph(spawn: PendingSpawn) {
    if (!ctx) return;
    const progress = 1 - spawn.remaining / TELEGRAPH_SECONDS;
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

  function drawScene() {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewW, viewH);
    for (const spawn of pendingSpawns) drawTelegraph(spawn);
    for (const boba of bobas) drawBoba(boba);
    drawParticles(ctx, particles);
    drawPopups(ctx, popups, popupFont);
    drawBasket(clamp(pointerX - BASKET_W / 2, 0, viewW - BASKET_W));
  }

  // --- Spawning and effects ------------------------------------------------

  function eligibleLinks() {
    return Array.from(document.querySelectorAll<HTMLElement>("a[href]"))
      .filter((element) => !element.closest(".boba-ui"))
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

  function queueSpawn() {
    let centerX = BOBA_W / 2 + Math.random() * Math.max(1, viewW - BOBA_W);
    let centerY = MIN_SPAWN_CENTER_Y + Math.random() * Math.max(1, viewH * 0.2);
    let source: HTMLElement | null = null;
    const links = eligibleLinks();

    if (links.length) {
      const choice = links[(Math.random() * links.length) | 0];
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
      remaining: TELEGRAPH_SECONDS,
      golden,
      source,
    });
  }

  function activateSpawn(spawn: PendingSpawn, gravity: number) {
    spawn.source?.classList.remove("boba-source", "boba-source-gold");
    const bottom = spawn.y + BOBA_H;
    const catchLine = basketY + BASKET_PX;
    const apexBottom = Math.min(bottom - 60, catchLine - 150);
    const rise = Math.max(50, bottom - apexBottom);
    const straw = STRAWS[(Math.random() * STRAWS.length) | 0];
    bobas.push({
      x: spawn.x,
      y: spawn.y,
      vx: (Math.random() - 0.5) * 110,
      vy: -Math.sqrt(2 * gravity * rise) - Math.random() * 24,
      liquid: DRINKS[(Math.random() * DRINKS.length) | 0],
      grid: [...straw, ...CUP],
      golden: spawn.golden,
    });
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
          ? `+${points} · ×${combo}`
          : `+${points}`;
    addPopup(popups, centerX, basketY - 14, text, boba.golden ? "gold" : perfect ? "perfect" : "plain");
  }

  function addMissEffects(boba: Boba, centerX: number, lostCombo: number) {
    const primary = boba.golden ? "#f2b84b" : boba.liquid;
    for (let i = 0; i < 10; i++) {
      addParticle(particles, centerX, viewH - 9, i % 3 === 0 ? PEARL : primary, 118, 340);
    }
    addPopup(
      popups,
      clamp(centerX, 65, viewW - 65),
      viewH - 46,
      lostCombo > 1 ? "splat · combo lost" : "splat",
      "miss",
      0.8,
    );
    missPulse += 1;
    missFlash = true;
    later(() => (missFlash = false), 250);
  }

  // --- Game loop -----------------------------------------------------------

  function beginRound() {
    countdown = 0;
    goVisible = true;
    phase = "opening";
    setMusicPhase("opening");
    startMusic();
    sfxStart();
    liveMessage = "Go. Opening shift.";
    later(() => (goVisible = false), 620);
  }

  function registerCatch(boba: Boba, centerX: number, basketX: number) {
    const perfect = isPerfectCatch(centerX, basketX, BASKET_W);
    const points = pointsForCatch(boba.golden, perfect);
    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    caughtCount += 1;
    if (perfect) perfectCatches += 1;
    score += points;
    tipVisible = false;
    addCatchEffects(boba, centerX, perfect, points);

    const pan = viewW > 0 ? (centerX / viewW) * 2 - 1 : 0;
    if (boba.golden) sfxGolden(combo, pan);
    else if (caughtCount % 10 === 0) sfxMilestone(pan);
    else sfxCatch(combo, perfect, pan);

    if (boba.golden) {
      liveMessage = `Golden boba caught for ${points} points`;
    } else if (perfect) {
      liveMessage = `Perfect catch for ${points} points`;
    } else if (caughtCount % 5 === 0) {
      liveMessage = `${caughtCount} cups caught. Score ${score}.`;
    }
  }

  function registerMiss(boba: Boba, centerX: number) {
    const lostCombo = combo;
    combo = 0;
    hearts -= 1;
    addMissEffects(boba, centerX, lostCombo);
    sfxMiss(viewW > 0 ? (centerX / viewW) * 2 - 1 : 0);
    liveMessage =
      hearts > 0
        ? `Miss. ${hearts} ${hearts === 1 ? "pearl" : "pearls"} left.`
        : "No pearls left.";

    if (hearts <= 0) void endGame("hearts");
  }

  function frame(timestamp: number) {
    if (!active || gameOver) return;
    if (!last) last = timestamp;
    const rawDt = (timestamp - last) / 1000;
    last = timestamp;
    const dt = Math.min(rawDt, 0.05);
    const clockDt = Math.min(rawDt, 0.25);

    if (paused) {
      raf = requestAnimationFrame(frame);
      return;
    }

    if (countdown > 0) {
      countdownElapsed += clockDt;
      const nextCountdown = Math.max(1, COUNTDOWN_SECONDS - Math.floor(countdownElapsed));
      if (nextCountdown !== countdown && countdownElapsed < COUNTDOWN_SECONDS) {
        countdown = nextCountdown;
        sfxCountdown(countdown);
      }
      if (countdownElapsed >= COUNTDOWN_SECONDS) beginRound();
      drawScene();
      raf = requestAnimationFrame(frame);
      return;
    }

    elapsed += clockDt;
    timeLeft = timeRemaining(elapsed);
    if (elapsed >= GAME_DURATION_SECONDS) {
      timeLeft = 0;
      drawScene();
      void endGame("time");
      return;
    }

    const difficulty = difficultyForElapsed(elapsed);
    if (difficulty.phase !== phase) {
      phase = difficulty.phase;
      setMusicPhase(phase);
      liveMessage = phase === "rush" ? "Rush hour. Final fifteen seconds." : "Steady pour.";
    }

    spawnTimer += clockDt;
    if (
      spawnTimer >= difficulty.spawnInterval &&
      bobas.length + pendingSpawns.length < difficulty.maxActive
    ) {
      spawnTimer -= difficulty.spawnInterval;
      queueSpawn();
    }

    for (let index = pendingSpawns.length - 1; index >= 0; index--) {
      const spawn = pendingSpawns[index];
      spawn.remaining -= dt;
      if (spawn.remaining <= 0) {
        pendingSpawns.splice(index, 1);
        activateSpawn(spawn, difficulty.gravity);
      }
    }

    const basketX = clamp(pointerX - BASKET_W / 2, 0, viewW - BASKET_W);
    const catchLine = basketY + BASKET_PX;

    for (let index = bobas.length - 1; index >= 0; index--) {
      const boba = bobas[index];
      boba.vy += difficulty.gravity * dt;
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
        centerX <= basketX + BASKET_W
      ) {
        bobas.splice(index, 1);
        registerCatch(boba, centerX, basketX);
        continue;
      }

      if (boba.y > viewH + 10) {
        bobas.splice(index, 1);
        registerMiss(boba, centerX);
        if (gameOver) break;
      }
    }

    basketSquash = Math.max(0, basketSquash - dt);
    stepParticles(particles, dt);
    stepPopups(popups, dt);
    drawScene();
    if (active && !gameOver) raf = requestAnimationFrame(frame);
  }

  // --- Pause, restart, and finish -----------------------------------------

  function clearSpawnSources() {
    for (const spawn of pendingSpawns) {
      spawn.source?.classList.remove("boba-source", "boba-source-gold");
    }
    document
      .querySelectorAll(".boba-source, .boba-source-gold")
      .forEach((element) => element.classList.remove("boba-source", "boba-source-gold"));
  }

  async function pauseGame() {
    if (gameOver || !active || paused) return;
    paused = true;
    setMusicPaused(true);
    liveMessage = "Game paused";
    await tick();
    pauseCard?.focus();
  }

  function resumeGame() {
    if (gameOver || !active || !paused) return;
    paused = false;
    last = 0;
    setMusicPaused(false);
    sfxBlip();
    liveMessage = countdown > 0 ? `Countdown ${countdown}` : "Game resumed";
    hudButtons?.focusPause();
  }

  function togglePause() {
    if (paused) resumeGame();
    else void pauseGame();
  }

  async function endGame(reason: "hearts" | "time") {
    if (gameOver) return;
    active = false;
    gameOver = true;
    paused = false;
    endReason = reason;
    cancelAnimationFrame(raf);
    clearSpawnSources();
    finishMusic();
    sfxGameOver(reason);
    const result = recordScore("catch", score);
    localBest = result.best;
    newBest = result.newBest;
    liveMessage =
      reason === "time"
        ? `Shift complete. Final score ${score}.`
        : `Game over. Final score ${score}.`;
    await tick();
    slip?.focus();
  }

  function restart() {
    stopMusic();
    clearSpawnSources();
    bobas = [];
    pendingSpawns = [];
    particles = [];
    popups = [];
    score = 0;
    hearts = 3;
    combo = 0;
    bestCombo = 0;
    caughtCount = 0;
    perfectCatches = 0;
    elapsed = 0;
    countdownElapsed = 0;
    spawnTimer = 0;
    spawnNumber = 0;
    basketSquash = 0;
    last = 0;
    countdown = COUNTDOWN_SECONDS;
    goVisible = false;
    timeLeft = GAME_DURATION_SECONDS;
    phase = "opening";
    // A restart is still part of the same visit; first-run guidance should not
    // return once the player has completed or abandoned their first run.
    tipVisible = false;
    missPulse = 0;
    missFlash = false;
    gameOver = false;
    paused = false;
    newBest = false;
    run += 1;
    active = true;
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
    drawScene();
    raf = requestAnimationFrame(frame);
  }

  // --- Sizing and lifecycle ------------------------------------------------

  function sizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    ctx = fitCanvas(canvas, viewW, viewH);
    basketY = viewH - BASKET_H - 16;
    pointerX = clamp(pointerX, BASKET_W / 2, viewW - BASKET_W / 2);
    drawScene();
  }

  onMount(() => {
    pointerX = window.innerWidth / 2;
    popupFont = arcadeFont();
    sizeCanvas();
    tipVisible = firstVisit("catch");
    sfxCountdown(COUNTDOWN_SECONDS);

    const onMove = (event: MouseEvent) => {
      pointerX = event.clientX;
    };
    const onResize = () => sizeCanvas();
    const onBlur = () => {
      if (!gameOver && active && !paused) void pauseGame();
    };
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        if (gameOver) trapFocus(event, document.querySelector(".boba-over-card"));
        else if (paused) trapFocus(event, document.querySelector(".boba-pause-card"));
        else trapFocus(event, document.querySelector(".boba-hud"));
        return;
      }

      if (!gameOver && (event.key.toLowerCase() === "p" || event.key === " ")) {
        event.preventDefault();
        togglePause();
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    document.documentElement.addEventListener("mouseleave", onBlur);
    raf = requestAnimationFrame(frame);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      clearSpawnSources();
      stopMusic();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      document.documentElement.removeEventListener("mouseleave", onBlur);
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
    </div>

    <div
      class="boba-ticket boba-ticket-center boba-riso"
      class:is-rush={phase === "rush"}
      style="--tilt: 1deg"
      role="timer"
      aria-label={`${timeLeft} seconds remaining, ${phaseLabel(phase)}`}
    >
      <CupTimer fraction={timeLeft / GAME_DURATION_SECONDS} rush={phase === "rush"} />
      <span class="boba-big">{String(timeLeft).padStart(2, "0")}</span>
      <span class="boba-stack">
        <span class="boba-meta">seconds</span>
        <span class="boba-phase">{phaseLabel(phase)}</span>
      </span>
    </div>

    <div class="boba-ticket boba-ticket-end boba-riso" style="--tilt: -0.8deg">
      <Pearls left={hearts} pulse={missPulse} />
      {#key run}
        <TrackFlag />
      {/key}
      <HudButtons bind:this={hudButtons} {paused} on:pause={togglePause} />
    </div>
  </div>

  {#if tipVisible}
    <div class="boba-tip" role="note" aria-label="How to play">
      <span class="boba-tip-label">how to play</span>
      <span>move to catch</span>
      <Mark kind="dot" />
      <span>dead center is a perfect</span>
      <Mark kind="dot" />
      <span>gold cups earn +3</span>
      <span class="boba-keys"><kbd>P</kbd> pause <kbd>Esc</kbd> quit</span>
    </div>
  {/if}
</header>

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
    title={endReason === "time" ? "shift complete" : "game over"}
    deck={endReason === "time"
      ? "Sixty seconds served. Wipe down the counter."
      : "Three pearls dropped. The floor is sticky now."}
    {score}
    {newBest}
    stats={[
      { label: "cups caught", value: caughtCount },
      { label: "perfect catches", value: perfectCatches },
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
