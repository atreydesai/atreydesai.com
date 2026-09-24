<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  import {
    finishMusic,
    setMusicPaused,
    setMusicPhase,
    sfxBlip,
    sfxGameOver,
    sfxMilestone,
    sfxPlace,
    sfxSlice,
    sfxTopple,
    startMusic,
    stopMusic,
  } from "$lib/sfx";
  import {
    START_WIDTH,
    dropCup,
    phaseForHeight,
    speedForHeight,
    stepSlide,
    trackFor,
    widthAfterPerfect,
  } from "$lib/arcade/stack-engine.js";
  import type { Span } from "$lib/arcade/stack-engine.js";
  import {
    DRINKS,
    INK,
    LID,
    MENU_ICONS,
    PEARL,
    SPRITE_PAD,
    addParticle,
    addPopup,
    arcadeFont,
    cachedSprite,
    drawHalo,
    drawParticles,
    drawPopups,
    drawSprite,
    fitCanvas,
    risoColors,
    stepParticles,
    stepPopups,
    type Particle,
    type Popup,
  } from "$lib/arcade/art";
  import { trapFocus } from "$lib/arcade/focus";
  import { firstVisit, readBest, recordScore } from "$lib/arcade/scores";
  import Mark from "$lib/components/Mark.svelte";
  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";

  // Cup stack: a cup slides back and forth over the tower; drop it, and
  // whatever hangs over the edge is sliced off and falls. The tower is a
  // column of drinks, each a different flavour, so a tall one is a rainbow.

  const dispatch = createEventDispatcher<{ close: null; menu: null }>();

  const CUP_ROWS = 10;
  const HALO = "rgba(253, 248, 243, 0.8)";
  const DROP_KEYS = new Set([" ", "Enter", "ArrowDown"]);
  const PALETTES = DRINKS.map((liquid) => ({ O: INK, l: LID, L: liquid, b: PEARL }));

  /** A cup `width` sprite pixels wide: lid, rim, tapering body, pearls. */
  function cupGrid(width: number) {
    const line = (inset: number, edge: string, fill: string) => {
      const inner = width - inset * 2;
      if (inner <= 0) return ".".repeat(width);
      if (inner === 1) return `${".".repeat(inset)}${edge}${".".repeat(inset)}`;
      return `${".".repeat(inset)}${edge}${fill.repeat(inner - 2)}${edge}${".".repeat(inset)}`;
    };
    const taper = width > 4 ? 1 : 0;
    let pearls = line(taper, "O", "L");
    pearls = [...pearls]
      .map((cell, column) => (cell === "L" && column % 2 === 1 ? "b" : cell))
      .join("");
    return [
      line(taper, "O", "O"),
      line(0, "O", "l"),
      line(0, "O", "O"),
      line(0, "O", "L"),
      line(0, "O", "L"),
      line(0, "O", "L"),
      line(taper, "O", "L"),
      line(taper, "O", "L"),
      pearls,
      line(width > 6 ? 2 : taper, "O", "O"),
    ];
  }

  const grids = new Map<number, string[]>();
  function gridFor(width: number) {
    let grid = grids.get(width);
    if (!grid) {
      grid = cupGrid(width);
      grids.set(width, grid);
    }
    return grid;
  }

  interface Layer extends Span {
    drink: number;
    land: number;
  }

  interface Piece {
    /** Screen position of the piece's center, in px. */
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    spin: number;
    drink: number;
    /** The source cup's width, and the columns of it that broke off. */
    gridWidth: number;
    from: number;
    to: number;
  }

  // --- State -----------------------------------------------------------------

  let stacked = 0;
  let streak = 0;
  let bestStreak = 0;
  let perfects = 0;
  let paused = false;
  let gameOver = false;
  let tipVisible = false;
  let liveMessage = "Cup stack starting";
  let localBest = 0;
  let previousBest = 0;
  let newBest = false;

  let canvas: HTMLCanvasElement;
  let hudRow: HTMLElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let hudButtons: HudButtons;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;
  let popupFont = "500 13px monospace";
  let labelFont = "400 12px monospace";
  let reduceMotion = false;

  let viewW = 0;
  let viewH = 0;
  let unit = 6;
  let cupH = 48;
  let groundY = 0;
  let playTop = 80;
  let halfScreen = 40;

  // tower[0] is the tray; every other entry is a cup.
  let tower: Layer[] = [];
  let slider = { left: 0, direction: 1 as 1 | -1, width: START_WIDTH, drink: 0 };
  let pieces: Piece[] = [];
  let flashes: Array<{ level: number; left: number; width: number; age: number }> = [];
  let particles: Particle[] = [];
  let popups: Popup[] = [];
  let camera = 0;
  let zoom = 1;
  let playing = true;
  let last = 0;
  let raf = 0;
  let active = true;
  let lastDrop = 0;
  let endTimer: ReturnType<typeof setTimeout> | null = null;

  const screenX = (units: number) => viewW / 2 + units * unit;
  /** Screen y of the top of cup level `level` (0 = the first cup). */
  const levelTop = (level: number) => groundY - (level + 1) * cupH + camera;

  function exit() {
    sfxBlip();
    dispatch("close");
  }

  function toMenu() {
    sfxBlip();
    dispatch("menu");
  }

  // --- Drawing -------------------------------------------------------------

  function drawCup(layer: Span & { drink: number }, top: number, squash = 0) {
    if (!ctx) return;
    const sprite = cachedSprite(
      `stack-${layer.width}-${layer.drink}`,
      gridFor(layer.width),
      unit,
      PALETTES[layer.drink],
      HALO,
    );
    const x = Math.round(screenX(layer.left)) - SPRITE_PAD;
    if (squash <= 0) {
      ctx.drawImage(sprite, x, Math.round(top) - SPRITE_PAD);
      return;
    }
    // A little squash as the cup lands, anchored at its base.
    ctx.save();
    ctx.translate(0, top + cupH);
    ctx.scale(1, 1 - squash * 0.1);
    ctx.drawImage(sprite, x, -cupH - SPRITE_PAD);
    ctx.restore();
  }

  function drawTray(colors: ReturnType<typeof risoColors>) {
    if (!ctx) return;
    const left = screenX(-START_WIDTH / 2 - 2);
    const width = (START_WIDTH + 4) * unit;
    const top = groundY + camera;
    ctx.fillStyle = colors.slab;
    ctx.fillRect(left + 4, top + 4, width, 12);
    ctx.fillStyle = colors.paper;
    ctx.fillRect(left, top, width, 12);
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(left + 1, top + 1, width - 2, 10);
  }

  /** A dashed pencil line at the height of the personal best. */
  function drawBestLine(colors: ReturnType<typeof risoColors>) {
    if (!ctx || previousBest <= 0) return;
    const y = Math.round(levelTop(previousBest - 1));
    if (y < playTop + 8 || y > viewH) return;
    ctx.save();
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(viewW - 16, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = labelFont;
    ctx.fillStyle = colors.muted;
    ctx.textBaseline = "bottom";
    ctx.fillText(`your best · ${previousBest}`, 16, y - 4);
    ctx.restore();
  }

  function drawPiece(piece: Piece) {
    if (!ctx) return;
    const grid = gridFor(piece.gridWidth);
    const width = (piece.to - piece.from) * unit;
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.angle);
    const x = -width / 2;
    const y = -cupH / 2;
    drawHalo(ctx, grid, x, y, unit, HALO, piece.from, piece.to);
    drawSprite(ctx, grid, x, y, unit, PALETTES[piece.drink], piece.from, piece.to);
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewW, viewH);
    const colors = risoColors();

    ctx.save();
    if (zoom !== 1) {
      // Pull back to show the whole tower once it has fallen.
      ctx.translate(viewW / 2, groundY);
      ctx.scale(zoom, zoom);
      ctx.translate(-viewW / 2, -groundY);
    }
    drawBestLine(colors);
    drawTray(colors);
    for (let level = 1; level < tower.length; level++) {
      const layer = tower[level];
      const top = levelTop(level - 1);
      if (top > viewH / zoom + cupH || top < -cupH * 4 - viewH / zoom) continue;
      drawCup(layer, top, layer.land / 0.12);
    }
    for (const flash of flashes) {
      const grow = flash.age * 30;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - flash.age / 0.35);
      ctx.strokeStyle = colors.slab;
      ctx.lineWidth = 3;
      ctx.strokeRect(
        screenX(flash.left) - 4 - grow,
        levelTop(flash.level) - 4 - grow,
        flash.width * unit + 8 + grow * 2,
        cupH + 8 + grow * 2,
      );
      ctx.restore();
    }
    if (playing) drawCup({ ...slider }, levelTop(tower.length - 1));
    for (const piece of pieces) drawPiece(piece);
    drawParticles(ctx, particles);
    ctx.restore();
    drawPopups(ctx, popups, popupFont);
  }

  // --- Rules in motion ---------------------------------------------------------

  function nextSlider() {
    const top = tower[tower.length - 1];
    const track = trackFor(top, halfScreen);
    // Cups come in from alternating sides.
    const fromLeft = tower.length % 2 === 1;
    slider = {
      left: fromLeft ? track.min : track.max,
      direction: fromLeft ? 1 : -1,
      width: top.width,
      drink: tower.length % DRINKS.length,
    };
  }

  function breakOff(cut: Span, snappedLeft: number, level: number, whole: boolean) {
    const from = whole ? 0 : cut.left - snappedLeft;
    const to = whole ? slider.width : from + cut.width;
    const centerUnits = cut.left + cut.width / 2;
    const side = centerUnits < tower[tower.length - 1].left + tower[tower.length - 1].width / 2 ? -1 : 1;
    pieces.push({
      x: screenX(centerUnits),
      y: levelTop(level) + cupH / 2,
      vx: side * (40 + Math.random() * 50),
      vy: -80,
      angle: 0,
      spin: side * (2.5 + Math.random() * 2),
      drink: slider.drink,
      gridWidth: slider.width,
      from,
      to,
    });
  }

  function drop() {
    if (!playing || paused || gameOver) return;
    const now = performance.now();
    if (now - lastDrop < 80) return;
    lastDrop = now;
    tipVisible = false;

    const top = tower[tower.length - 1];
    const level = tower.length - 1;
    const result = dropCup(top, slider.left);
    const snapped = Math.round(slider.left);

    if (result.kind === "miss" || !result.placed) {
      breakOff({ left: snapped, width: slider.width }, snapped, level, true);
      void topple();
      return;
    }

    let placed: Span = result.placed;
    if (result.kind === "perfect") {
      streak += 1;
      perfects += 1;
      bestStreak = Math.max(bestStreak, streak);
      const grown = widthAfterPerfect(placed.width, streak);
      if (grown > placed.width) {
        // Grow back toward the tray's center line.
        const growLeft = placed.left + placed.width / 2 > 0;
        placed = { left: growLeft ? placed.left - 1 : placed.left, width: grown };
      }
      flashes.push({ level, left: placed.left, width: placed.width, age: 0 });
      addPopup(
        popups,
        screenX(placed.left + placed.width / 2),
        levelTop(level) - 14,
        grown > result.placed.width ? `perfect ×${streak} · wider` : streak > 1 ? `perfect ×${streak}` : "perfect",
        "perfect",
      );
    } else {
      streak = 0;
      if (result.cut) {
        breakOff(result.cut, snapped, level, false);
        sfxSlice();
      }
    }

    tower = [...tower, { ...placed, drink: slider.drink, land: reduceMotion ? 0 : 0.12 }];
    stacked = tower.length - 1;
    const x = screenX(placed.left + placed.width / 2);
    for (let i = 0; i < (result.kind === "perfect" ? 10 : 5); i++) {
      addParticle(particles, x + (Math.random() - 0.5) * placed.width * unit, levelTop(level) + cupH, DRINKS[slider.drink], 60, 240);
    }

    if (stacked % 10 === 0) {
      sfxMilestone();
      addPopup(popups, x, levelTop(level) - 32, `${stacked} high`, "gold", 1);
      liveMessage = `${stacked} cups high.`;
    } else {
      sfxPlace(result.kind === "perfect", stacked);
      if (result.kind === "perfect") liveMessage = `Perfect. ${stacked} cups.`;
    }
    setMusicPhase(phaseForHeight(stacked));
    nextSlider();
  }

  async function topple() {
    playing = false;
    streak = 0;
    sfxTopple();
    liveMessage = `The cup missed. ${stacked} cups high.`;
    // Let the last cup fall and the camera pull back before the slip.
    endTimer = setTimeout(() => void endGame(), reduceMotion ? 300 : 1300);
  }

  function frame(timestamp: number) {
    if (!active) return;
    if (!last) last = timestamp;
    const dt = Math.min((timestamp - last) / 1000, 0.05);
    last = timestamp;

    if (paused) {
      raf = requestAnimationFrame(frame);
      return;
    }

    if (playing) {
      const top = tower[tower.length - 1];
      const moved = stepSlide(
        slider.left,
        slider.direction,
        speedForHeight(stacked) * dt,
        trackFor(top, halfScreen),
      );
      slider.left = moved.position;
      slider.direction = moved.direction;
    }

    // Keep the sliding cup about a third of the way down the play area.
    const desired = playTop + (viewH - playTop) * 0.34;
    const target = playing ? Math.max(0, desired - (groundY - tower.length * cupH)) : 0;
    camera += (target - camera) * Math.min(1, dt * (playing ? 6 : 3));
    if (!playing) {
      const towerHeight = tower.length * cupH + 40;
      const fit = Math.min(1, (groundY - playTop - 24) / towerHeight);
      zoom += (fit - zoom) * Math.min(1, dt * 3);
    }

    for (const layer of tower) layer.land = Math.max(0, layer.land - dt);
    for (let index = flashes.length - 1; index >= 0; index--) {
      flashes[index].age += dt;
      if (flashes[index].age > 0.35) flashes.splice(index, 1);
    }
    for (let index = pieces.length - 1; index >= 0; index--) {
      const piece = pieces[index];
      piece.vy += 2200 * dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.angle += piece.spin * dt;
      if (piece.y > viewH / Math.min(1, zoom) + cupH * 2) pieces.splice(index, 1);
    }
    stepParticles(particles, dt);
    stepPopups(popups, dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  // --- Pause, restart, and finish -----------------------------------------

  async function pauseGame() {
    if (gameOver || paused || !playing) return;
    paused = true;
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
    hudButtons?.focusPause();
  }

  function togglePause() {
    if (paused) resumeGame();
    else void pauseGame();
  }

  async function endGame() {
    if (gameOver) return;
    gameOver = true;
    finishMusic();
    sfxGameOver("hearts");
    const result = recordScore("stack", stacked);
    localBest = result.best;
    newBest = result.newBest;
    liveMessage = `Timber. ${stacked} cups high.`;
    await tick();
    slip?.focus();
  }

  function begin() {
    tower = [{ left: -START_WIDTH / 2, width: START_WIDTH, drink: 0, land: 0 }];
    stacked = 0;
    streak = 0;
    bestStreak = 0;
    perfects = 0;
    pieces = [];
    flashes = [];
    particles = [];
    popups = [];
    camera = 0;
    zoom = 1;
    playing = true;
    paused = false;
    gameOver = false;
    newBest = false;
    previousBest = readBest("stack");
    last = 0;
    nextSlider();
    setMusicPhase("opening");
    startMusic();
  }

  function restart() {
    stopMusic();
    if (endTimer) clearTimeout(endTimer);
    begin();
    liveMessage = "New tower. Drop the first cup.";
  }

  // --- Sizing and lifecycle ------------------------------------------------

  function sizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    ctx = fitCanvas(canvas, viewW, viewH);
    unit = viewW < 640 ? 4 : 5;
    cupH = CUP_ROWS * unit;
    halfScreen = Math.floor(viewW / 2 / unit) - 1;
    playTop = hudRow ? hudRow.getBoundingClientRect().bottom : 80;
    groundY = viewH - Math.max(56, Math.round(viewH * 0.1));
    draw();
  }

  function onPointer(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    drop();
  }

  onMount(() => {
    popupFont = arcadeFont();
    labelFont = arcadeFont(12, 400);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => (reduceMotion = motion.matches);
    syncMotion();
    motion.addEventListener("change", syncMotion);
    sizeCanvas();
    tipVisible = firstVisit("stack");
    begin();

    const onResize = () => sizeCanvas();
    const onBlur = () => {
      if (!gameOver && !paused && playing) void pauseGame();
    };
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        if (gameOver) trapFocus(event, document.querySelector(".boba-over-card"));
        else if (paused) trapFocus(event, document.querySelector(".boba-pause-card"));
        else trapFocus(event, hudRow.closest(".boba-hud"));
        return;
      }
      if (event.repeat || gameOver) return;
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        togglePause();
        return;
      }
      if (!DROP_KEYS.has(event.key)) return;
      // A focused control keeps Space and Enter for itself.
      if (event.target instanceof HTMLElement && event.target.closest("button, input")) return;
      event.preventDefault();
      drop();
    };

    const resizeObserver = new ResizeObserver(() => sizeCanvas());
    resizeObserver.observe(hudRow);
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      if (endTimer) clearTimeout(endTimer);
      stopMusic();
      resizeObserver.disconnect();
      motion.removeEventListener("change", syncMotion);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  });
</script>

<div class="boba-stage is-paper" on:pointerdown={onPointer} aria-hidden="true"></div>
<canvas bind:this={canvas} class="boba-canvas" aria-hidden="true"></canvas>

<header class="boba-hud boba-ui" aria-label="Cup stack status">
  <div bind:this={hudRow} class="boba-hud-row">
    <div class="boba-ticket boba-ticket-start boba-riso" style="--tilt: -1.3deg">
      <span class="boba-ticket-icon" aria-hidden="true">
        <PixelIcon grid={MENU_ICONS.stack.grid} palette={MENU_ICONS.stack.palette} px={3} />
      </span>
      <span class="boba-big">{String(stacked).padStart(2, "0")}</span>
      <span class="boba-stack">
        <span class="boba-meta">cups high</span>
        {#key streak}
          <span class="boba-combo" class:active={streak > 1}>
            {streak > 1 ? `×${streak} perfect` : streak === 1 ? "perfect" : "line them up"}
          </span>
        {/key}
      </span>
    </div>

    <div class="boba-ticket boba-ticket-end boba-riso" style="--tilt: -0.6deg">
      <span class="boba-stack">
        <span class="boba-meta">best</span>
        <span class="boba-phase">{previousBest ? `${previousBest} high` : "none yet"}</span>
      </span>
      <HudButtons bind:this={hudButtons} {paused} disabled={!playing} on:pause={togglePause} />
    </div>
  </div>

  {#if tipVisible}
    <div class="boba-tip" role="note" aria-label="How to play">
      <span class="boba-tip-label">how to play</span>
      <span>tap to drop the cup</span>
      <Mark kind="dot" />
      <span>what hangs over gets sliced off</span>
      <Mark kind="dot" />
      <span>three perfect drops in a row widen it</span>
      <span class="boba-keys"><kbd>Space</kbd> drop <kbd>P</kbd> pause <kbd>Esc</kbd> quit</span>
    </div>
  {/if}
</header>

{#if paused && !gameOver}
  <PauseCard
    bind:this={pauseCard}
    deck="The tower is holding still for you. Mostly."
    on:resume={resumeGame}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

{#if gameOver}
  <ResultsSlip
    bind:this={slip}
    game="stack"
    title="timber"
    deck={stacked === 0
      ? "Not one cup landed. The tray is very clean."
      : `${stacked} ${stacked === 1 ? "cup" : "cups"} high before gravity won.`}
    score={stacked}
    unit="cups"
    {newBest}
    stats={[
      { label: "cups stacked", value: stacked },
      { label: "perfect drops", value: perfects },
      { label: "best streak", value: `×${bestStreak}` },
      { label: "personal best", value: localBest },
    ]}
    on:restart={restart}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>
