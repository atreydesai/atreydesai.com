<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  import {
    finishMusic,
    getMuted,
    onSongChange,
    setMusicPaused,
    setMusicPhase,
    setMuted,
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
  import { cleanName, MAX_NAME } from "$lib/profanity";
  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import WavingFlag from "$lib/components/WavingFlag.svelte";

  const dispatch = createEventDispatcher();
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
    b: "#2b1a12",
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
  const DRINKS = [
    "#b388e0",
    "#8bbf5a",
    "#c79a6b",
    "#f47ba0",
    "#f4b942",
    "#6aa6e0",
    "#9fd17a",
    "#e76f8e",
  ];

  const ICON_BOBA = [
    "...S...",
    "...S...",
    "OOOOOOO",
    ".OLLLO.",
    ".OLLLO.",
    ".ObLbO.",
    ".OLbLO.",
    "..OOO..",
  ];
  const ICON_BOBA_PAL: Record<string, string> = {
    O: "currentColor",
    L: "#c79a6b",
    b: "#2b1a12",
    S: "#ff5277",
  };
  const ICON_SPEAKER = [
    "....A....",
    "...AA..W.",
    "AAAAA.W.W",
    "AAAAA.W.W",
    "AAAAA.W.W",
    "...AA..W.",
    "....A....",
  ];
  const ICON_MUTE = [
    "....A....",
    "...AA....",
    "AAAAA.X.X",
    "AAAAA..X.",
    "AAAAA.X.X",
    "...AA....",
    "....A....",
  ];
  const ICON_PAUSE = [
    "PP..PP",
    "PP..PP",
    "PP..PP",
    "PP..PP",
    "PP..PP",
    "PP..PP",
  ];
  const ICON_PLAY = [
    "P.....",
    "PPP...",
    "PPPPP.",
    "PPPPP.",
    "PPP...",
    "P.....",
  ];
  const ICON_AUDIO_PAL: Record<string, string> = {
    A: "currentColor",
    W: "#e85d4c",
    X: "currentColor",
    P: "currentColor",
  };
  const ICON_HEART = [
    ".H.H.",
    "HHHHH",
    "HHHHH",
    ".HHH.",
    "..H..",
  ];
  const HEART_ON: Record<string, string> = { H: "#e85d4c" };
  const HEART_OFF: Record<string, string> = { H: "#b8a89a" };
  const ICON_NOTE = [
    "...N.",
    "...NN",
    "...NN",
    "...N.",
    "...N.",
    "NN.N.",
    "NNNN.",
    "NNN..",
  ];
  const NOTE_PAL: Record<string, string> = { N: "#e85d4c" };

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

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    gravity: number;
    size: number;
    life: number;
    maxLife: number;
    color: string;
  }

  interface Popup {
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
    maxLife: number;
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
  let progressPercent = 0;
  let phase: GamePhase = "opening";
  // Initialized after mount to avoid flashing first-run guidance for returning
  // players before their cookie can be read.
  let tipVisible = false;
  let missPulse = 0;
  let missFlash = false;
  let currentSong = "";
  let muted = false;
  let liveMessage = "Boba mode starting";

  // High scores
  let localBest = 0;
  let newBest = false;
  let globalAvailable = false;
  let globalLoading = true;
  let globalScores: Array<{ name: string; score: number; me?: boolean }> = [];
  let playerName = "";
  let nameError = "";
  let submitting = false;
  let submitted = false;
  let playerRank: number | null = null;

  // --- Canvas and lifecycle state -----------------------------------------

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let dialogEl: HTMLElement;
  let pauseButton: HTMLButtonElement;
  let resumeButton: HTMLButtonElement;
  let previousFocus: HTMLElement | null = null;
  let previousOverflow = "";

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

  function close() {
    dispatch("close");
  }

  function exit() {
    sfxBlip();
    close();
  }

  function toggleMute() {
    muted = !muted;
    setMuted(muted);
    if (!muted) sfxBlip();
  }

  // --- Drawing -------------------------------------------------------------

  function drawSprite(
    grid: string[],
    x: number,
    y: number,
    px: number,
    palette: Record<string, string>,
  ) {
    if (!ctx) return;
    for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
      const row = grid[rowIndex];
      for (let column = 0; column < row.length; column++) {
        const character = row[column];
        if (character === ".") continue;
        const color = palette[character];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(
          Math.round(x + column * px),
          Math.round(y + rowIndex * px),
          px,
          px,
        );
      }
    }
  }

  function drawSilhouette(
    grid: string[],
    x: number,
    y: number,
    px: number,
    color: string,
  ) {
    if (!ctx) return;
    ctx.fillStyle = color;
    for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
      const row = grid[rowIndex];
      for (let column = 0; column < row.length; column++) {
        if (row[column] === ".") continue;
        ctx.fillRect(
          Math.round(x + column * px),
          Math.round(y + rowIndex * px),
          px,
          px,
        );
      }
    }
  }

  function drawBoba(boba: Boba) {
    if (!ctx) return;
    const halo = boba.golden ? "rgba(255, 226, 124, 0.9)" : "rgba(253, 248, 243, 0.8)";
    for (const [offsetX, offsetY] of [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ]) {
      drawSilhouette(boba.grid, boba.x + offsetX, boba.y + offsetY, BOBA_PX, halo);
    }
    drawSprite(
      boba.grid,
      boba.x,
      boba.y,
      BOBA_PX,
      boba.golden ? GOLD_PAL : { ...PAL, L: boba.liquid },
    );
  }

  function drawBasket(basketX: number) {
    if (!ctx) return;
    const drawAt = (x: number, y: number) => {
      for (const [offsetX, offsetY] of [
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ]) {
        drawSilhouette(
          BASKET,
          x + offsetX,
          y + offsetY,
          BASKET_PX,
          "rgba(253, 248, 243, 0.62)",
        );
      }
      drawSprite(BASKET, x, y, BASKET_PX, BPAL);
    };

    if (basketSquash <= 0) {
      drawAt(basketX, basketY);
      return;
    }

    const amount = Math.min(1, basketSquash / 0.13);
    const scaleX = 1 + amount * 0.1;
    const scaleY = 1 - amount * 0.08;
    ctx.save();
    ctx.translate(basketX + BASKET_W / 2, basketY + BASKET_H);
    ctx.scale(scaleX, scaleY);
    drawAt(-BASKET_W / 2, -BASKET_H);
    ctx.restore();
  }

  function drawTelegraph(spawn: PendingSpawn) {
    if (!ctx) return;
    const progress = 1 - spawn.remaining / TELEGRAPH_SECONDS;
    const centerX = spawn.x + BOBA_W / 2;
    const centerY = spawn.y + BOBA_H / 2;
    const radius = 9 + progress * 17;
    const segment = 7;

    ctx.save();
    ctx.globalAlpha = 0.95 - progress * 0.38;
    ctx.fillStyle = spawn.golden ? "#f2b84b" : "#e85d4c";
    ctx.fillRect(Math.round(centerX - radius), Math.round(centerY - radius), segment, 3);
    ctx.fillRect(Math.round(centerX - radius), Math.round(centerY - radius), 3, segment);
    ctx.fillRect(Math.round(centerX + radius - segment), Math.round(centerY - radius), segment, 3);
    ctx.fillRect(Math.round(centerX + radius - 3), Math.round(centerY - radius), 3, segment);
    ctx.fillRect(Math.round(centerX - radius), Math.round(centerY + radius - 3), segment, 3);
    ctx.fillRect(Math.round(centerX - radius), Math.round(centerY + radius - segment), 3, segment);
    ctx.fillRect(
      Math.round(centerX + radius - segment),
      Math.round(centerY + radius - 3),
      segment,
      3,
    );
    ctx.fillRect(
      Math.round(centerX + radius - 3),
      Math.round(centerY + radius - segment),
      3,
      segment,
    );
    ctx.restore();
  }

  function drawEffects() {
    if (!ctx) return;
    for (const particle of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        Math.round(particle.x),
        Math.round(particle.y),
        particle.size,
        particle.size,
      );
      ctx.restore();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 12px ${getComputedStyle(document.documentElement).getPropertyValue("--font-mono")}`;
    for (const popup of popups) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, popup.life / popup.maxLife);
      ctx.fillStyle = "rgba(253, 248, 243, 0.95)";
      ctx.fillText(popup.text, Math.round(popup.x + 1), Math.round(popup.y + 1));
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, Math.round(popup.x), Math.round(popup.y));
      ctx.restore();
    }
  }

  function drawScene() {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewW, viewH);
    for (const spawn of pendingSpawns) drawTelegraph(spawn);
    for (const boba of bobas) drawBoba(boba);
    drawEffects();
    const basketX = clamp(pointerX - BASKET_W / 2, 0, viewW - BASKET_W);
    drawBasket(basketX);
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

  function addParticle(
    x: number,
    y: number,
    color: string,
    speed = 90,
    gravity = 260,
  ) {
    const life = 0.38 + Math.random() * 0.22;
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * speed * 2,
      vy: -30 - Math.random() * speed,
      gravity,
      size: Math.random() > 0.65 ? 4 : 3,
      life,
      maxLife: life,
      color,
    });
  }

  function addCatchEffects(
    boba: Boba,
    centerX: number,
    perfect: boolean,
    points: number,
  ) {
    basketSquash = 0.13;
    const primary = boba.golden ? "#f2b84b" : boba.liquid;
    const particleCount = boba.golden ? 14 : perfect ? 11 : 8;
    for (let i = 0; i < particleCount; i++) {
      addParticle(
        centerX,
        basketY + 8,
        i % 3 === 0 ? "#2b1a12" : primary,
        boba.golden ? 125 : 92,
      );
    }

    const text = boba.golden
      ? perfect
        ? `GOLDEN PERFECT +${points}`
        : `GOLDEN +${points}`
      : perfect
        ? `PERFECT +${points}`
        : combo > 1
          ? `+${points} · ${combo} COMBO`
          : `+${points}`;
    popups.push({
      x: centerX,
      y: basketY - 14,
      text,
      color: boba.golden ? "#b36a08" : perfect ? "#e85d4c" : "#2b2320",
      life: 0.72,
      maxLife: 0.72,
    });
  }

  function addMissEffects(boba: Boba, centerX: number, lostCombo: number) {
    const primary = boba.golden ? "#f2b84b" : boba.liquid;
    for (let i = 0; i < 10; i++) {
      addParticle(centerX, viewH - 9, i % 3 === 0 ? "#2b1a12" : primary, 118, 340);
    }
    popups.push({
      x: clamp(centerX, 65, viewW - 65),
      y: viewH - 46,
      text: lostCombo > 1 ? "MISS · COMBO LOST" : "MISS",
      color: "#c9462f",
      life: 0.8,
      maxLife: 0.8,
    });
    missPulse += 1;
    missFlash = true;
    later(() => (missFlash = false), 250);
  }

  function updateEffects(dt: number) {
    basketSquash = Math.max(0, basketSquash - dt);
    for (let index = particles.length - 1; index >= 0; index--) {
      const particle = particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        particles.splice(index, 1);
        continue;
      }
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }

    for (let index = popups.length - 1; index >= 0; index--) {
      const popup = popups[index];
      popup.life -= dt;
      if (popup.life <= 0) {
        popups.splice(index, 1);
        continue;
      }
      popup.y -= 24 * dt;
    }
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
    const pan = viewW > 0 ? (centerX / viewW) * 2 - 1 : 0;
    sfxMiss(pan);
    liveMessage = hearts > 0 ? `Miss. ${hearts} hearts remaining.` : "No hearts remaining.";

    if (hearts <= 0) endGame("hearts");
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
      const nextCountdown = Math.max(
        1,
        COUNTDOWN_SECONDS - Math.floor(countdownElapsed),
      );
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
    const nextTimeLeft = timeRemaining(elapsed);
    if (nextTimeLeft !== timeLeft) {
      timeLeft = nextTimeLeft;
      progressPercent = Math.min(100, (elapsed / GAME_DURATION_SECONDS) * 100);
    }
    if (elapsed >= GAME_DURATION_SECONDS) {
      timeLeft = 0;
      progressPercent = 100;
      drawScene();
      endGame("time");
      return;
    }

    const difficulty = difficultyForElapsed(elapsed);
    if (difficulty.phase !== phase) {
      phase = difficulty.phase;
      setMusicPhase(phase);
      liveMessage =
        phase === "rush" ? "Rush hour. Final fifteen seconds." : "Steady pour.";
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

    updateEffects(dt);
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
      .forEach((element) =>
        element.classList.remove("boba-source", "boba-source-gold"),
      );
  }

  async function pauseGame() {
    if (gameOver || !active || paused) return;
    paused = true;
    setMusicPaused(true);
    liveMessage = "Game paused";
    await tick();
    resumeButton?.focus();
  }

  function resumeGame() {
    if (gameOver || !active || !paused) return;
    paused = false;
    last = 0;
    setMusicPaused(false);
    sfxBlip();
    liveMessage = countdown > 0 ? `Countdown ${countdown}` : "Game resumed";
    pauseButton?.focus();
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

    if (score > localBest) {
      localBest = score;
      writeBest(localBest);
      newBest = true;
    }

    liveMessage =
      reason === "time"
        ? `Shift complete. Final score ${score}.`
        : `Game over. Final score ${score}.`;
    void fetchGlobal();
    await tick();
    dialogEl?.focus();
  }

  function resetRunState() {
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
    progressPercent = 0;
    phase = "opening";
    // A restart is still part of the same visit; first-run guidance should not
    // return once the player has completed or abandoned their first run.
    tipVisible = false;
    missPulse = 0;
    missFlash = false;
    gameOver = false;
    paused = false;
    newBest = false;
    submitted = false;
    playerName = "";
    nameError = "";
    playerRank = null;
    currentSong = "";
    active = true;
  }

  function restart() {
    stopMusic();
    resetRunState();
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
    drawScene();
    raf = requestAnimationFrame(frame);
  }

  // --- High scores ---------------------------------------------------------

  const BEST_COOKIE = "boba_best_v2";
  const INSTRUCTIONS_COOKIE = "boba_instructions_seen_v1";

  function readBest() {
    const match = document.cookie.match(/(?:^|;\s*)boba_best_v2=(\d+)/);
    return match ? parseInt(match[1], 10) || 0 : 0;
  }

  function writeBest(value: number) {
    document.cookie = `${BEST_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  }

  function hasSeenInstructions() {
    return document.cookie
      .split(";")
      .some((part) => part.trim().startsWith(`${INSTRUCTIONS_COOKIE}=`));
  }

  function rememberInstructions() {
    document.cookie = `${INSTRUCTIONS_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
  }

  async function fetchGlobal() {
    globalLoading = true;
    try {
      const response = await fetch("/api/scores");
      const data = await response.json();
      globalAvailable = !!data.available;
      globalScores = Array.isArray(data.scores) ? data.scores : [];
    } catch {
      globalAvailable = false;
      globalScores = [];
    } finally {
      globalLoading = false;
    }
  }

  function onNameInput() {
    nameError =
      playerName.trim().length > MAX_NAME ? `too long (${MAX_NAME} max)` : "";
  }

  async function submitScore() {
    const checked = cleanName(playerName);
    if (!checked.ok || !checked.value) {
      nameError = checked.reason ?? "invalid name";
      return;
    }

    nameError = "";
    submitting = true;
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: checked.value, score }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        nameError = data?.reason ?? "couldn't submit";
        return;
      }

      playerRank = data.rank ?? null;
      let marked = false;
      globalScores = (data.scores ?? []).map(
        (entry: { name: string; score: number }) => {
          const me =
            !marked && entry.name === checked.value && entry.score === score;
          if (me) marked = true;
          return { ...entry, me };
        },
      );
      submitted = true;
    } catch {
      nameError = "couldn't submit, try again";
    } finally {
      submitting = false;
    }
  }

  // --- Sizing, focus, and lifecycle ---------------------------------------

  function sizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
    basketY = viewH - BASKET_H - 16;
    pointerX = clamp(pointerX, BASKET_W / 2, viewW - BASKET_W / 2);
    drawScene();
  }

  function focusableIn(container: HTMLElement | null) {
    if (!container) return [];
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  function trapFocus(event: KeyboardEvent, container: HTMLElement | null) {
    const focusable = focusableIn(container);
    if (!focusable.length) {
      event.preventDefault();
      container?.focus();
      return;
    }

    const first = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      lastFocusable.focus();
    } else if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("boba-active");
    window.dispatchEvent(new Event("boba-game-start"));

    pointerX = window.innerWidth / 2;
    sizeCanvas();
    localBest = readBest();
    tipVisible = !hasSeenInstructions();
    if (tipVisible) rememberInstructions();
    muted = getMuted();
    onSongChange((name) => (currentSong = name));
    sfxCountdown(COUNTDOWN_SECONDS);

    const onMove = (event: MouseEvent) => {
      pointerX = event.clientX;
    };
    const onResize = () => sizeCanvas();
    const onBlur = () => {
      if (!gameOver && active && !paused) void pauseGame();
    };
    const onVisibility = () => {
      if (document.hidden && !gameOver && active && !paused) void pauseGame();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exit();
        return;
      }

      if (event.key === "Tab") {
        if (gameOver) trapFocus(event, dialogEl);
        else if (paused) trapFocus(event, document.querySelector(".boba-pause-card"));
        else trapFocus(event, document.querySelector(".boba-hud-shell"));
        return;
      }

      if (
        !gameOver &&
        (event.key.toLowerCase() === "p" || event.key === " ")
      ) {
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
      onSongChange(null);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      document.documentElement.style.overflow = previousOverflow;
      document.body.classList.remove("boba-active");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      document.documentElement.removeEventListener("mouseleave", onBlur);
      queueMicrotask(() => {
        if (previousFocus?.isConnected) {
          previousFocus.focus();
          return;
        }
        document.querySelector<HTMLElement>(".boba-launcher")?.focus();
      });
    };
  });
</script>

<div
  class="boba-stage"
  on:click|stopPropagation|preventDefault
  on:pointerdown|stopPropagation|preventDefault
  on:wheel|preventDefault
  aria-hidden="true"
></div>
<canvas bind:this={canvas} class="boba-canvas" aria-hidden="true"></canvas>

<header class="boba-hud boba-ui" aria-label="Boba game status">
  <div
    class="boba-hud-shell"
    style={`--run-progress:${progressPercent}%`}
  >
    <div class="boba-hud-left">
      <span class="boba-brand">
        <PixelIcon grid={ICON_BOBA} palette={ICON_BOBA_PAL} px={2} />
        <span>BOBA MODE</span>
      </span>
      <span class="boba-stat">
        <span class="boba-stat-label">score</span>
        <strong>{String(score).padStart(3, "0")}</strong>
      </span>
      <span class="boba-stat boba-combo" class:active={combo > 1}>
        <span class="boba-stat-label">combo</span>
        <strong>×{combo}</strong>
      </span>
    </div>

    <div class="boba-clock" aria-label={`${timeLeft} seconds remaining`}>
      <strong>{String(timeLeft).padStart(2, "0")}</strong>
      <span>{phaseLabel(phase)}</span>
    </div>

    <div class="boba-hud-right">
      {#key missPulse}
        <span
          class="boba-hearts"
          class:boba-hearts-hit={missPulse > 0}
          aria-label={`${hearts} hearts remaining`}
        >
          {#each Array(3) as _, index}
            <PixelIcon
              grid={ICON_HEART}
              palette={index < hearts ? HEART_ON : HEART_OFF}
              px={3}
            />
          {/each}
        </span>
      {/key}

      <span class="boba-track-window" aria-label={`Now playing ${currentSong || "waiting"}`}>
        <span class="boba-track-note" aria-hidden="true">
          <PixelIcon grid={ICON_NOTE} palette={NOTE_PAL} px={2} />
        </span>
        <span class="boba-track-flag">
          {#if currentSong}
            <WavingFlag text={currentSong} />
          {:else}
            <span class="boba-track-placeholder">next track</span>
          {/if}
        </span>
      </span>

      <button
        bind:this={pauseButton}
        type="button"
        class="boba-icon-btn"
        on:click={togglePause}
        aria-label={paused ? "Resume game" : "Pause game"}
        title={paused ? "resume (P)" : "pause (P)"}
      >
        <PixelIcon
          grid={paused ? ICON_PLAY : ICON_PAUSE}
          palette={ICON_AUDIO_PAL}
          px={2}
        />
      </button>
      <button
        type="button"
        class="boba-icon-btn"
        on:click={toggleMute}
        aria-pressed={muted}
        aria-label={muted ? "Unmute game audio" : "Mute game audio"}
        title={muted ? "unmute" : "mute"}
      >
        <PixelIcon
          grid={muted ? ICON_MUTE : ICON_SPEAKER}
          palette={ICON_AUDIO_PAL}
          px={2}
        />
      </button>
    </div>
  </div>

  {#if tipVisible}
    <div class="boba-tip" role="note" aria-label="How to play">
      <span class="boba-tip-label">how to play</span>
      <span class="boba-tip-instruction"><strong>Move</strong> to catch</span>
      <span class="boba-tip-instruction"><strong>Center</strong> for perfect</span>
      <span class="boba-tip-instruction"><strong>Gold</strong> earns +3</span>
      <span class="boba-tip-shortcuts"><kbd>P</kbd> pause <kbd>Esc</kbd> quit</span>
    </div>
  {/if}
</header>

{#if countdown > 0 || goVisible}
  <div class="boba-countdown" aria-live="assertive">
    {#key countdown > 0 ? countdown : "go"}
      <span>{countdown > 0 ? countdown : "GO"}</span>
    {/key}
    <small>{countdown > 0 ? "shift starts in" : "catch the rush"}</small>
  </div>
{/if}

{#if missFlash}
  <div class="boba-miss-flash" aria-hidden="true"></div>
{/if}

{#if paused && !gameOver}
  <div class="boba-pause boba-ui" role="dialog" aria-modal="true" aria-labelledby="boba-pause-title">
    <div class="boba-pause-card" tabindex="-1">
      <h2 id="boba-pause-title">PAUSED</h2>
      <button
        bind:this={resumeButton}
        type="button"
        class="boba-btn pause-action"
        on:click={resumeGame}
      >
        RESUME SHIFT
      </button>
    </div>
  </div>
{/if}

{#if gameOver}
  <div class="boba-over boba-ui">
    <div
      bind:this={dialogEl}
      class="boba-over-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boba-over-title"
      tabindex="-1"
    >
      <div class="boba-over-accent" aria-hidden="true"></div>
      <header class="boba-results-head">
        <div>
          <span class="boba-eyebrow">
            {endReason === "time" ? "sixty seconds served" : "three drinks dropped"}
          </span>
          <h2 id="boba-over-title">
            {endReason === "time" ? "shift complete" : "game over"}
          </h2>
        </div>
        {#if newBest}
          <span class="boba-newbest">NEW BEST</span>
        {/if}
      </header>

      <div class="boba-final">
        <span class="boba-final-label">final score</span>
        <strong>{score}</strong>
        <span class="boba-final-unit">points</span>
      </div>

      <dl class="boba-run-stats">
        <div>
          <dt>cups caught</dt>
          <dd>{caughtCount}</dd>
        </div>
        <div>
          <dt>perfect</dt>
          <dd>{perfectCatches}</dd>
        </div>
        <div>
          <dt>best combo</dt>
          <dd>×{bestCombo}</dd>
        </div>
        <div>
          <dt>personal best</dt>
          <dd>{localBest}</dd>
        </div>
      </dl>

      <div class="boba-results-lower">
        <div class="boba-board">
          <div class="boba-board-head">global top</div>
          {#if globalLoading}
            <div class="boba-board-row muted">loading board…</div>
          {:else if !globalAvailable}
            <div class="boba-board-row muted">board offline</div>
          {:else if globalScores.length === 0}
            <div class="boba-board-row muted">be the first</div>
          {:else}
            {#each globalScores.slice(0, 6) as entry, index}
              <div class="boba-board-row" class:me={entry.me}>
                <span class="rank">{index + 1}</span>
                <span class="bname">{entry.name}</span>
                <span class="bscore">{entry.score}</span>
              </div>
            {/each}
          {/if}
        </div>

        <div class="boba-submit-panel">
          {#if score > 0 && globalAvailable && !submitted}
            <span class="boba-submit-title">put it on the board</span>
            <form class="boba-submit" on:submit|preventDefault={submitScore}>
              <label class="sr-only" for="boba-player-name">Player name</label>
              <input
                id="boba-player-name"
                class="boba-name"
                bind:value={playerName}
                on:input={onNameInput}
                placeholder="Your name"
                maxlength={MAX_NAME}
                spellcheck="false"
                autocomplete="off"
                aria-describedby={nameError ? "boba-name-error" : undefined}
              />
              <button
                type="submit"
                class="boba-btn small"
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Submit"}
              </button>
            </form>
            {#if nameError}
              <div id="boba-name-error" class="boba-name-err" role="alert">
                {nameError}
              </div>
            {/if}
          {:else if submitted}
            <div class="boba-submitted">
              score submitted{#if playerRank}&nbsp;· rank #{playerRank}{/if}
            </div>
          {:else if globalLoading}
            <span class="boba-submit-title muted">checking the board…</span>
          {:else}
            <span class="boba-submit-title muted">local score saved</span>
          {/if}
        </div>
      </div>

      <div class="boba-over-actions">
        <button type="button" class="boba-btn" on:click={restart}>Play again</button>
        <button type="button" class="boba-btn ghost" on:click={exit}>Exit</button>
      </div>
    </div>
  </div>
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>

<style>
  :global(body.boba-active .custom-cursor) {
    display: none !important;
  }

  :global(a.boba-source),
  :global(a.boba-source-gold) {
    position: relative;
    z-index: calc(var(--layer-overlay) + 2);
    animation: boba-source-pulse 0.44s steps(2, end) infinite;
  }

  :global(a.boba-source) {
    color: #e85d4c !important;
    text-shadow: 2px 0 rgba(232, 93, 76, 0.24);
  }

  :global(a.boba-source-gold) {
    color: #b36a08 !important;
    text-shadow: 2px 0 rgba(242, 184, 75, 0.34);
  }

  @keyframes boba-source-pulse {
    50% {
      filter: brightness(1.28);
      transform: translateY(-1px);
    }
  }

  .boba-stage {
    position: fixed;
    inset: 0;
    z-index: var(--layer-overlay);
    cursor: none;
    background:
      radial-gradient(circle at 50% 88%, rgba(232, 93, 76, 0.09), transparent 34%),
      linear-gradient(rgba(253, 248, 243, 0.28), rgba(253, 248, 243, 0.34));
    backdrop-filter: saturate(0.72) contrast(0.96);
  }

  :global(.dark) .boba-stage {
    background:
      radial-gradient(circle at 50% 88%, rgba(240, 117, 99, 0.1), transparent 34%),
      linear-gradient(rgba(26, 26, 26, 0.26), rgba(26, 26, 26, 0.34));
    backdrop-filter: saturate(0.78) brightness(0.86);
  }

  .boba-canvas {
    position: fixed;
    inset: 0;
    z-index: calc(var(--layer-overlay) + 1);
    pointer-events: none;
  }

  .boba-ui {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  /* The HUD is an anchored status rail, not a floating collection of cards. */
  .boba-hud {
    position: fixed;
    inset: 0 0 auto;
    z-index: calc(var(--layer-overlay) + 3);
    pointer-events: none;
  }

  .boba-hud-shell {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    min-height: 62px;
    padding: 8px clamp(14px, 2vw, 30px);
    color: #1a1a1a;
    background:
      radial-gradient(rgba(26, 26, 26, 0.035) 0.8px, transparent 0.9px),
      rgba(253, 248, 243, 0.96);
    background-size: 4px 4px;
    border-bottom: 2px solid #1a1a1a;
    box-shadow: 0 4px 0 #e85d4c;
    pointer-events: auto;
  }

  .boba-hud-shell::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: -4px;
    width: var(--run-progress);
    height: 4px;
    background: #1a1a1a;
    transition: width 0.28s linear;
  }

  .boba-hud-left,
  .boba-hud-right {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .boba-hud-left {
    justify-self: start;
    gap: clamp(12px, 1.8vw, 24px);
  }

  .boba-hud-right {
    justify-self: end;
    justify-content: flex-end;
    gap: 10px;
  }

  .boba-brand {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #e85d4c;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .boba-stat {
    display: grid;
    gap: 1px;
    min-width: 48px;
  }

  .boba-stat-label {
    color: #8a7d70;
    font-size: 0.54rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    line-height: 1;
    text-transform: uppercase;
  }

  .boba-stat strong {
    font-size: 0.84rem;
    line-height: 1;
  }

  .boba-combo strong {
    color: #8a7d70;
    transition: color 0.16s ease, transform 0.16s ease;
  }

  .boba-combo.active strong {
    color: #e85d4c;
    transform: translateY(-1px);
  }

  .boba-clock {
    display: grid;
    place-items: center;
    min-width: 106px;
    line-height: 1;
  }

  .boba-clock strong {
    font-size: 1.45rem;
    font-weight: 900;
    letter-spacing: -0.08em;
  }

  .boba-clock span {
    margin-top: 3px;
    color: #8a7d70;
    font-size: 0.53rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .boba-hearts {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .boba-hearts-hit {
    animation: hearts-hit 0.25s steps(3, end);
  }

  @keyframes hearts-hit {
    35% {
      transform: translateX(-5px);
      filter: brightness(1.25);
    }
    70% {
      transform: translateX(4px);
    }
  }

  .boba-track-window {
    display: grid;
    grid-template-columns: 18px 10.9rem;
    align-items: center;
    width: 12.35rem;
    min-width: 12.35rem;
    height: 34px;
    overflow: hidden;
    border-left: 1px solid rgba(26, 26, 26, 0.2);
    border-right: 1px solid rgba(26, 26, 26, 0.2);
  }

  .boba-track-note {
    display: grid;
    place-items: center;
  }

  .boba-track-flag {
    display: flex;
    align-items: center;
    width: 10.9rem;
    height: 34px;
    overflow: hidden;
  }

  .boba-track-placeholder {
    padding-left: 7px;
    color: #8a7d70;
    font-size: 0.56rem;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .boba-icon-btn {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    color: #1a1a1a;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-control);
    cursor: pointer;
    transition:
      color var(--motion-base) var(--ease-standard),
      background-color var(--motion-base) var(--ease-standard),
      transform var(--motion-instant) var(--ease-standard);
  }

  .boba-icon-btn:hover {
    color: #c9462f;
    background: rgba(232, 93, 76, 0.09);
  }

  .boba-icon-btn:active {
    transform: translateY(1px);
  }

  .boba-icon-btn:focus-visible,
  .boba-btn:focus-visible,
  .boba-name:focus-visible,
  .boba-pause-card:focus-visible,
  .boba-over-card:focus-visible {
    outline: 2px solid #c9462f;
    outline-offset: 2px;
  }

  .boba-tip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    width: fit-content;
    max-width: calc(100vw - var(--space-8));
    margin: var(--space-2-5) auto 0;
    padding: var(--space-2) var(--space-2-5);
    gap: var(--space-1) var(--space-3);
    color: #515151;
    background: #fffdfb;
    border: 1px solid #c8c8c8;
    border-radius: var(--radius-inline);
    box-shadow: var(--shadow-popover);
    font-size: 0.75rem;
    font-weight: 400;
    line-height: 1.333;
    text-align: center;
  }

  .boba-tip-label {
    color: #8a7d70;
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 600;
  }

  .boba-tip-instruction,
  .boba-tip-shortcuts {
    white-space: nowrap;
  }

  .boba-tip-instruction strong {
    color: #c9462f;
    font-weight: 600;
  }

  .boba-tip-shortcuts {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: #666666;
  }

  .boba-tip kbd {
    min-width: 20px;
    padding: 1px 4px;
    color: #1a1a1a;
    background: #faf0e6;
    border: 1px solid #c8c8c8;
    border-radius: var(--radius-control);
    box-shadow: 0 1px 0 #c8c8c8;
    font: inherit;
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .boba-countdown {
    position: fixed;
    inset: 0;
    z-index: calc(var(--layer-overlay) + 2);
    display: grid;
    place-content: center;
    justify-items: center;
    pointer-events: none;
    color: #1a1a1a;
    font-family: var(--font-mono);
    text-shadow:
      3px 3px 0 #fdf8f3,
      -2px -2px 0 #fdf8f3;
  }

  .boba-countdown span {
    font-size: clamp(4.5rem, 12vw, 8rem);
    font-weight: 900;
    letter-spacing: -0.1em;
    line-height: 0.8;
    animation: countdown-pop 0.55s steps(4, end);
  }

  .boba-countdown small {
    margin-top: 17px;
    color: #e85d4c;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  @keyframes countdown-pop {
    from {
      opacity: 0;
      transform: scale(1.3);
    }
  }

  .boba-miss-flash {
    position: fixed;
    inset: auto 0 0;
    z-index: calc(var(--layer-overlay) + 2);
    height: 24vh;
    pointer-events: none;
    background: linear-gradient(transparent, rgba(201, 70, 47, 0.25));
    animation: miss-flash 0.25s ease-out both;
  }

  @keyframes miss-flash {
    to {
      opacity: 0;
    }
  }

  .boba-pause,
  .boba-over {
    position: fixed;
    inset: 0;
    z-index: var(--layer-modal);
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(26, 26, 26, 0.56);
    backdrop-filter: blur(3px);
  }

  .boba-pause-card {
    width: min(92vw, 360px);
    padding: 30px 34px 34px;
    color: #1a1a1a;
    background: #fdf8f3;
    border: 3px solid #1a1a1a;
    box-shadow: 8px 8px 0 #e85d4c;
    text-align: center;
  }

  .boba-pause-card h2 {
    margin: 4px 0 20px;
    color: #e85d4c;
    font-family: var(--font-mono);
    font-size: 1.8rem;
    font-weight: 900;
    letter-spacing: 0.06em;
  }

  .boba-eyebrow {
    color: #8a7d70;
    font-size: 0.6rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .boba-over {
    overflow-y: auto;
  }

  .boba-over-card {
    position: relative;
    width: min(94vw, 650px);
    margin: auto;
    padding: clamp(26px, 4vw, 42px);
    overflow: hidden;
    color: #1a1a1a;
    background:
      radial-gradient(rgba(26, 26, 26, 0.026) 0.8px, transparent 0.9px),
      #fdf8f3;
    background-size: 4px 4px;
    border: 3px solid #1a1a1a;
    box-shadow: 10px 10px 0 #e85d4c;
  }

  .boba-over-accent {
    position: absolute;
    top: 0;
    right: 0;
    width: 110px;
    height: 18px;
    background: repeating-linear-gradient(
      90deg,
      #e85d4c 0 10px,
      transparent 10px 16px
    );
  }

  .boba-results-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }

  .boba-results-head h2 {
    margin: 4px 0 0;
    color: #e85d4c;
    font-family: var(--font-mono);
    font-size: clamp(1.25rem, 3vw, 1.8rem);
    font-weight: 900;
    letter-spacing: 0.045em;
  }

  .boba-newbest {
    flex: 0 0 auto;
    margin-top: 9px;
    padding: 5px 8px;
    color: #fdf8f3;
    background: #e85d4c;
    border: 2px solid #1a1a1a;
    box-shadow: 2px 2px 0 #1a1a1a;
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    transform: rotate(2deg);
  }

  .boba-final {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: baseline;
    gap: 10px;
    margin: 25px 0 19px;
    padding-bottom: 19px;
    border-bottom: 2px solid rgba(26, 26, 26, 0.16);
  }

  .boba-final-label,
  .boba-final-unit {
    color: #8a7d70;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .boba-final strong {
    color: #1a1a1a;
    font-size: clamp(3.7rem, 9vw, 6.5rem);
    font-weight: 900;
    letter-spacing: -0.11em;
    line-height: 0.72;
    text-align: center;
  }

  .boba-run-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    margin: 0;
    padding: 0;
  }

  .boba-run-stats div {
    padding: 0 14px;
    border-left: 1px solid rgba(26, 26, 26, 0.16);
    text-align: center;
  }

  .boba-run-stats div:first-child {
    border-left: 0;
  }

  .boba-run-stats dt {
    color: #8a7d70;
    font-size: 0.54rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .boba-run-stats dd {
    margin: 4px 0 0;
    color: #1a1a1a;
    font-size: 1.05rem;
    font-weight: 900;
  }

  .boba-results-lower {
    display: grid;
    grid-template-columns: minmax(210px, 1fr) minmax(200px, 0.9fr);
    gap: 28px;
    margin-top: 27px;
    padding-top: 22px;
    border-top: 2px solid rgba(26, 26, 26, 0.16);
  }

  .boba-board {
    min-width: 0;
    text-align: left;
  }

  .boba-board-head,
  .boba-submit-title {
    display: block;
    margin-bottom: 8px;
    color: #8a7d70;
    font-size: 0.59rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .boba-board-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 22px;
    padding: 2px 6px;
    border-radius: 2px;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .boba-board-row.muted,
  .boba-submit-title.muted {
    color: #b8a89a;
    font-weight: 600;
  }

  .boba-board-row.me {
    background: rgba(232, 93, 76, 0.14);
  }

  .boba-board-row .rank {
    width: 1.5em;
    color: #8a7d70;
    text-align: right;
  }

  .boba-board-row .bname {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .boba-board-row .bscore {
    color: #e85d4c;
    font-weight: 900;
  }

  .boba-submit-panel {
    min-height: 74px;
  }

  .boba-submit {
    display: flex;
    gap: 8px;
  }

  .boba-name {
    min-width: 0;
    width: 100%;
    min-height: 40px;
    padding: 0 var(--space-3);
    color: #1a1a1a;
    background: #fffdfb;
    border: 1px solid #c8c8c8;
    border-radius: var(--radius-control);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 400;
    line-height: 1.333;
  }

  .boba-name::placeholder {
    color: #666666;
  }

  .boba-name-err {
    margin-top: 7px;
    color: #c0392b;
    font-size: 0.63rem;
  }

  .boba-submitted {
    padding: 9px 10px;
    color: #e85d4c;
    background: rgba(232, 93, 76, 0.1);
    font-size: 0.7rem;
    font-weight: 800;
  }

  .boba-over-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-8);
  }

  .boba-btn {
    min-height: 40px;
    padding: var(--space-2) var(--space-4);
    color: #fdf8f3;
    background: #1a1a1a;
    border: 1px solid #1a1a1a;
    border-radius: var(--radius-control);
    box-shadow: none;
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1;
    transition:
      color var(--motion-base) var(--ease-standard),
      background-color var(--motion-base) var(--ease-standard),
      border-color var(--motion-base) var(--ease-standard),
      transform var(--motion-instant) var(--ease-standard);
  }

  .boba-btn.ghost {
    color: #1a1a1a;
    background: transparent;
    border-color: #666666;
  }

  .boba-btn.pause-action {
    padding: 9px 15px;
    color: #fdf8f3;
    background: #e85d4c;
    border: 2px solid #1a1a1a;
    border-radius: 3px;
    box-shadow: 3px 3px 0 #1a1a1a;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.045em;
  }

  .boba-btn.small {
    min-height: 32px;
    padding: var(--space-2) var(--space-3);
  }

  .boba-btn:hover {
    background: #434343;
  }

  .boba-btn.ghost:hover {
    background: #faf0e6;
  }

  .boba-btn.pause-action:hover {
    background: #e85d4c;
    box-shadow: 4px 4px 0 #1a1a1a;
    transform: translate(-1px, -1px);
  }

  .boba-btn.pause-action:active {
    box-shadow: 1px 1px 0 #1a1a1a;
    transform: translate(2px, 2px);
  }

  .boba-btn:active {
    transform: translateY(1px);
  }

  .boba-btn:disabled {
    opacity: 0.55;
    cursor: default;
    transform: none;
  }

  :global(.dark) .boba-hud-shell {
    color: #fdf8f3;
    background:
      radial-gradient(rgba(253, 248, 243, 0.035) 0.8px, transparent 0.9px),
      rgba(42, 36, 34, 0.96);
    border-bottom-color: #fdf8f3;
  }

  :global(.dark) .boba-hud-shell::after {
    background: #fdf8f3;
  }

  :global(.dark) .boba-track-window {
    border-color: rgba(253, 248, 243, 0.2);
  }

  :global(.dark) .boba-icon-btn {
    color: #fdf8f3;
  }

  :global(.dark) .boba-icon-btn:hover {
    color: #f07563;
  }

  :global(.dark) .boba-icon-btn:focus-visible,
  :global(.dark) .boba-btn:focus-visible,
  :global(.dark) .boba-name:focus-visible,
  :global(.dark) .boba-pause-card:focus-visible,
  :global(.dark) .boba-over-card:focus-visible {
    outline-color: #f07563;
  }

  :global(.dark) .boba-tip {
    color: #e8d5c4;
    background: #383838;
    border-color: #434343;
    box-shadow: var(--shadow-popover-dark);
  }

  :global(.dark) .boba-tip-label,
  :global(.dark) .boba-tip-shortcuts {
    color: #b8a89a;
  }

  :global(.dark) .boba-tip-instruction strong {
    color: #f07563;
  }

  :global(.dark) .boba-tip kbd {
    color: #fdf8f3;
    background: #2a2422;
    border-color: #666666;
    box-shadow: 0 1px 0 #666666;
  }

  :global(.dark) .boba-countdown {
    color: #fdf8f3;
    text-shadow:
      3px 3px 0 #1a1a1a,
      -2px -2px 0 #1a1a1a;
  }

  :global(.dark) .boba-over-card {
    color: #fdf8f3;
    background:
      radial-gradient(rgba(253, 248, 243, 0.028) 0.8px, transparent 0.9px),
      #2a2422;
    border-color: #fdf8f3;
    box-shadow: 10px 10px 0 #f07563;
  }

  :global(.dark) .boba-pause-card {
    color: #fdf8f3;
    background: #2a2422;
    border-color: #fdf8f3;
    box-shadow: 8px 8px 0 #f07563;
  }

  :global(.dark) .boba-pause-card h2 {
    color: #f07563;
  }

  :global(.dark) .boba-final strong,
  :global(.dark) .boba-run-stats dd {
    color: #fdf8f3;
  }

  :global(.dark) .boba-final,
  :global(.dark) .boba-results-lower {
    border-color: rgba(253, 248, 243, 0.17);
  }

  :global(.dark) .boba-run-stats div {
    border-color: rgba(253, 248, 243, 0.17);
  }

  :global(.dark) .boba-name {
    color: #faf0e6;
    background: #383838;
    border-color: #434343;
  }

  :global(.dark) .boba-btn {
    color: #1a1a1a;
    background: #fdf8f3;
    border-color: #fdf8f3;
  }

  :global(.dark) .boba-btn.ghost {
    color: #fdf8f3;
    background: transparent;
    border-color: #e8d5c4;
  }

  :global(.dark) .boba-btn.pause-action {
    color: #fdf8f3;
    background: #e85d4c;
    border-color: #fdf8f3;
    box-shadow: 3px 3px 0 #fdf8f3;
  }

  :global(.dark) .boba-btn:hover {
    background: #faf0e6;
  }

  :global(.dark) .boba-btn.ghost:hover {
    background: #383838;
  }

  :global(.dark) .boba-btn.pause-action:hover {
    background: #e85d4c;
    box-shadow: 4px 4px 0 #fdf8f3;
  }

  :global(.dark) .boba-btn.pause-action:active {
    box-shadow: 1px 1px 0 #fdf8f3;
  }

  @media (max-width: 980px) {
    .boba-brand span:last-child {
      display: none;
    }

    .boba-track-window {
      grid-template-columns: 18px 7.2rem;
      width: 8.65rem;
      min-width: 8.65rem;
    }

    .boba-track-flag {
      width: 7.2rem;
    }

    .boba-hud-left {
      gap: 12px;
    }
  }

  @media (max-height: 690px) {
    .boba-over {
      place-items: start center;
      padding-top: 82px;
      padding-bottom: 36px;
    }

    .boba-over-card {
      padding-block: 25px;
    }

    .boba-final {
      margin-block: 18px 14px;
      padding-bottom: 14px;
    }

    .boba-results-lower {
      margin-top: 20px;
      padding-top: 17px;
    }

    .boba-over-actions {
      margin-top: 20px;
    }
  }

  @media (max-width: 760px) {
    /* Defensive only: layout gating prevents the game from mounting here. */
    .boba-hud-shell {
      grid-template-columns: 1fr auto;
    }

    .boba-clock {
      grid-column: 2;
      grid-row: 1;
    }

    .boba-hud-right {
      display: none;
    }

    .boba-results-lower {
      grid-template-columns: 1fr;
    }

    .boba-run-stats {
      grid-template-columns: repeat(2, 1fr);
      gap: 15px 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(a.boba-source),
    :global(a.boba-source-gold),
    .boba-countdown span,
    .boba-hearts-hit,
    .boba-miss-flash {
      animation: none;
    }

    .boba-tip,
    .boba-hud-shell::after {
      transition: none;
    }
  }
</style>
