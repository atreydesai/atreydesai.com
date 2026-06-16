<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import {
    sfxStart,
    sfxCatch,
    sfxMilestone,
    sfxMiss,
    sfxGameOver,
    sfxBlip,
    setMuted,
    startMusic,
    stopMusic,
    onSongChange,
  } from "$lib/sfx";
  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import WavingFlag from "$lib/components/WavingFlag.svelte";
  import { cleanName, MAX_NAME } from "$lib/profanity";

  const dispatch = createEventDispatcher();
  function close() {
    dispatch("close");
  }

  let muted = false;
  let currentSong = ""; // "now playing" flag text
  function toggleMute() {
    muted = !muted;
    setMuted(muted);
    if (!muted) sfxBlip();
  }
  function exit() {
    sfxBlip();
    close();
  }

  // --- 8-bit sprites (rows of single-char cells; "." = transparent) ---
  // Cup body is constant; the two straw rows on top vary per boba so straws
  // point straight, lean left, or lean right.
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
    ["...S...", "...S..."], // straight
    ["....S..", "...S..."], // lean right
    [".....S.", "....S.."], // lean right (more)
    ["..S....", "...S..."], // lean left
    [".S.....", "..S...."], // lean left (more)
  ];
  const BOBA_COLS = 7;
  const BOBA_ROWS = STRAWS[0].length + CUP.length; // 10
  // Wastebasket: ribbed gray bin, wider at the mouth.
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

  // Fixed sprite colors. Boba liquid (L) is set per-drink for variety.
  const PAL: Record<string, string> = {
    O: "#2b2320", // cup outline
    l: "#ece3d6", // lid
    b: "#2b1a12", // tapioca pearls
    S: "#ff5277", // straw — bold pink so it never reads as transparent
  };
  const BPAL: Record<string, string> = {
    D: "#5c5c5c", // basket dark gray
    g: "#8f8f8f", // basket light gray
  };
  const DRINKS = [
    "#b388e0", "#8bbf5a", "#c79a6b", "#f47ba0",
    "#f4b942", "#6aa6e0", "#9fd17a", "#e76f8e",
  ];

  // --- HUD pixel icons (rendered as inline SVG via PixelIcon) ---
  // "currentColor" lets the outline follow the HUD text color (light/dark).
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
  const ICON_AUDIO_PAL: Record<string, string> = {
    A: "currentColor",
    W: "#e85d4c",
    X: "currentColor",
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
  // Eighth note ♪ — the "flagpole" the now-playing pennant hangs off.
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
  const BOBA_W = BOBA_COLS * BOBA_PX; // 35
  const BOBA_H = BOBA_ROWS * BOBA_PX; // 50
  const BASKET_W = BASKET[0].length * BASKET_PX; // 78
  const BASKET_H = BASKET.length * BASKET_PX; // 54

  interface Boba {
    x: number;
    y: number;
    vx: number;
    vy: number;
    L: string;
    grid: string[];
  }

  // Reactive (drive the HUD)
  let score = 0;
  let hearts = 3;
  let gameOver = false;

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

  // Plain game state (canvas-driven, no reactivity needed)
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let bobas: Boba[] = [];
  let viewW = 0;
  let viewH = 0;
  let basketY = 0;
  let pointerX = 0;
  let elapsed = 0;
  let spawnTimer = 0;
  let last = 0;
  let raf = 0;
  let running = true;

  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));

  function drawSprite(
    g: string[],
    x: number,
    y: number,
    px: number,
    pal: Record<string, string>,
  ) {
    if (!ctx) return;
    for (let r = 0; r < g.length; r++) {
      const row = g[r];
      for (let col = 0; col < row.length; col++) {
        const ch = row[col];
        if (ch === ".") continue;
        const color = pal[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x + col * px), Math.round(y + r * px), px, px);
      }
    }
  }

  // Spawn a boba "bouncing" out of a random on-screen link.
  function spawnBoba(gravity: number) {
    let ox = Math.random() * viewW;
    let oy = 40 + Math.random() * 120;
    const rects = Array.from(document.querySelectorAll("a[href]"))
      .map((el) => el.getBoundingClientRect())
      .filter(
        (r) =>
          r.width > 12 &&
          r.height > 6 &&
          r.bottom > 0 &&
          r.top < viewH &&
          r.right > 0 &&
          r.left < viewW,
      );
    if (rects.length) {
      const r = rects[(Math.random() * rects.length) | 0];
      ox = r.left + r.width / 2;
      oy = r.top + r.height / 2;
    }
    const y = oy - BOBA_H / 2;
    const bottom = y + BOBA_H;
    const catchLine = basketY + BASKET_PX;
    // Pop high enough to clear the basket. With apex height = v0²/(2g), pick an
    // apex whose bottom sits ~150px ABOVE the catch line (and at least 60px
    // above the spawn point), so every boba — even ones spawned level with or
    // below the basket — arcs up and falls back through the catch zone instead
    // of dropping straight out the bottom (which made low links unwinnable).
    const apexBottom = Math.min(bottom - 60, catchLine - 150);
    const rise = Math.max(50, bottom - apexBottom);
    const vy = -Math.sqrt(2 * gravity * rise) - Math.random() * 30;
    const straw = STRAWS[(Math.random() * STRAWS.length) | 0];
    bobas.push({
      x: ox - BOBA_W / 2,
      y,
      vx: (Math.random() - 0.5) * 130,
      vy,
      L: DRINKS[(Math.random() * DRINKS.length) | 0],
      grid: [...straw, ...CUP],
    });
  }

  function frame(t: number) {
    if (!running) return;
    if (!last) last = t;
    let dt = (t - last) / 1000;
    last = t;
    if (dt > 0.05) dt = 0.05; // clamp tab-switch gaps
    elapsed += dt;

    // Difficulty ramps up: heavier gravity + faster spawns over ~65s.
    const gravity = 520 + Math.min(elapsed, 70) * 7;
    const spawnInterval = Math.max(0.36, 1.4 - elapsed * 0.016);

    spawnTimer += dt;
    if (spawnTimer >= spawnInterval && bobas.length < 50) {
      spawnTimer = 0;
      spawnBoba(gravity);
    }

    const basketX = clamp(pointerX - BASKET_W / 2, 0, viewW - BASKET_W);
    const catchLine = basketY + BASKET_PX; // just inside the rim

    for (let i = bobas.length - 1; i >= 0; i--) {
      const b = bobas[i];
      b.vy += gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const bottom = b.y + BOBA_H;
      const prevBottom = bottom - b.vy * dt;
      const cx = b.x + BOBA_W / 2;

      // Caught: crossed the rim line this frame, over the mouth.
      if (
        b.vy > 0 &&
        prevBottom <= catchLine &&
        bottom >= catchLine &&
        cx >= basketX &&
        cx <= basketX + BASKET_W
      ) {
        bobas.splice(i, 1);
        score += 1;
        if (score % 10 === 0) sfxMilestone();
        else sfxCatch();
        continue;
      }
      // Missed: fell off the bottom of the screen.
      if (b.y > viewH + 12) {
        bobas.splice(i, 1);
        hearts -= 1;
        if (hearts <= 0) {
          endGame();
          break;
        }
        sfxMiss();
      }
    }

    if (ctx) {
      ctx.clearRect(0, 0, viewW, viewH);
      for (const b of bobas) drawSprite(b.grid, b.x, b.y, BOBA_PX, { ...PAL, L: b.L });
      drawSprite(BASKET, basketX, basketY, BASKET_PX, BPAL);
    }

    if (running) raf = requestAnimationFrame(frame);
  }

  function endGame() {
    running = false;
    gameOver = true;
    cancelAnimationFrame(raf);
    sfxGameOver();
    if (score > localBest) {
      localBest = score;
      writeBest(localBest);
      newBest = true;
    }
    fetchGlobal();
  }

  function restart() {
    score = 0;
    hearts = 3;
    bobas = [];
    elapsed = 0;
    spawnTimer = 0;
    last = 0;
    gameOver = false;
    newBest = false;
    submitted = false;
    playerName = "";
    nameError = "";
    playerRank = null;
    running = true;
    sfxStart();
    raf = requestAnimationFrame(frame);
  }

  // --- high scores: local (cookie) + global (Vercel Blob via /api/scores) ---
  const BEST_COOKIE = "boba_best";
  function readBest(): number {
    const m = document.cookie.match(/(?:^|;\s*)boba_best=(\d+)/);
    return m ? parseInt(m[1], 10) || 0 : 0;
  }
  function writeBest(v: number) {
    document.cookie = `${BEST_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
  }

  async function fetchGlobal() {
    globalLoading = true;
    try {
      const res = await fetch("/api/scores");
      const data = await res.json();
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
      playerName.trim().length > MAX_NAME ? `too long — ${MAX_NAME} max` : "";
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
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: checked.value, score }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        nameError = data?.reason ?? "couldn't submit";
        return;
      }
      playerRank = data.rank ?? null;
      // Highlight this player's row (first matching name+score).
      let marked = false;
      globalScores = (data.scores ?? []).map(
        (s: { name: string; score: number }) => {
          const me = !marked && s.name === checked.value && s.score === score;
          if (me) marked = true;
          return { ...s, me };
        },
      );
      submitted = true;
    } catch {
      nameError = "couldn't submit, try again";
    } finally {
      submitting = false;
    }
  }

  function sizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    canvas.style.width = viewW + "px";
    canvas.style.height = viewH + "px";
    ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
    basketY = viewH - BASKET_H - 16;
  }

  onMount(() => {
    pointerX = window.innerWidth / 2;
    sizeCanvas();
    localBest = readBest();
    onSongChange((name) => (currentSong = name));
    sfxStart();
    startMusic();

    const onMove = (e: MouseEvent) => (pointerX = e.clientX);
    const onResize = () => sizeCanvas();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      stopMusic();
      onSongChange(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  });
</script>

<!-- Wobbly hand-printed edges for the riso overlays (cream sheet + offset
     orange slab), matching the homepage announcement banner. -->
<svg width="0" height="0" style="position: absolute" aria-hidden="true">
  <filter id="boba-rough">
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
    <feDisplacementMap in="SourceGraphic" scale="6" />
  </filter>
</svg>

<canvas bind:this={canvas} class="boba-canvas" aria-hidden="true"></canvas>

<div class="boba-hud" aria-hidden="true">
  <div class="riso">
    <div class="riso-back"></div>
    <div class="riso-front boba-hud-row">
      <span class="boba-tag-group">
        <PixelIcon grid={ICON_BOBA} palette={ICON_BOBA_PAL} px={2} />
        <span class="boba-tag">BOBA MODE</span>
      </span>
      <span class="boba-score">SCORE {score}</span>
      <span class="boba-hearts">
        {#each Array(3) as _, i}
          <PixelIcon
            grid={ICON_HEART}
            palette={i < hearts ? HEART_ON : HEART_OFF}
            px={3}
          />
        {/each}
      </span>
      <button
        class="boba-mute"
        on:click={toggleMute}
        title={muted ? "unmute" : "mute"}
        aria-label={muted ? "unmute" : "mute"}
      >
        <PixelIcon
          grid={muted ? ICON_MUTE : ICON_SPEAKER}
          palette={ICON_AUDIO_PAL}
          px={2}
        />
      </button>
    </div>
  </div>
  <div class="boba-tip">
    <div class="boba-tip-back"></div>
    <div class="boba-tip-front">
      move your mouse · catch the boba · ESC to quit
    </div>
  </div>

  {#if currentSong}
    <div class="boba-np">
      <div class="riso boba-np-riso">
        <div class="riso-back"></div>
        <div class="riso-front boba-np-base">
          <PixelIcon grid={ICON_NOTE} palette={NOTE_PAL} px={2} />
        </div>
      </div>
      <WavingFlag text={currentSong} />
    </div>
  {/if}
</div>

{#if gameOver}
  <div class="boba-over">
    <div class="riso">
      <div class="riso-back"></div>
      <div class="riso-front boba-over-card">
        <div class="boba-over-title">GAME OVER</div>
        <div class="boba-over-score">
          SCORE&nbsp;{score}{#if newBest}<span class="boba-newbest">NEW BEST!</span>{/if}
        </div>
        <div class="boba-best">best&nbsp;{localBest}</div>

        {#if score > 0 && globalAvailable && !submitted}
          <div class="boba-submit">
            <input
              class="boba-name"
              bind:value={playerName}
              on:input={onNameInput}
              placeholder="YOUR NAME"
              spellcheck="false"
              autocomplete="off"
            />
            <button
              class="boba-btn small"
              on:click={submitScore}
              disabled={submitting}
            >
              {submitting ? "…" : "SUBMIT"}
            </button>
          </div>
          {#if nameError}
            <div class="boba-name-err">{nameError}</div>
          {/if}
        {:else if submitted}
          <div class="boba-submitted">
            submitted!{#if playerRank}&nbsp;you're #{playerRank}{/if}
          </div>
        {/if}

        <div class="boba-board">
          <div class="boba-board-head">GLOBAL TOP</div>
          {#if globalLoading}
            <div class="boba-board-row muted">loading…</div>
          {:else if !globalAvailable}
            <div class="boba-board-row muted">offline</div>
          {:else if globalScores.length === 0}
            <div class="boba-board-row muted">be the first!</div>
          {:else}
            {#each globalScores.slice(0, 6) as s, i}
              <div class="boba-board-row" class:me={s.me}>
                <span class="rank">{i + 1}</span>
                <span class="bname">{s.name}</span>
                <span class="bscore">{s.score}</span>
              </div>
            {/each}
          {/if}
        </div>

        <div class="boba-over-actions">
          <button class="boba-btn" on:click={restart}>PLAY AGAIN</button>
          <button class="boba-btn ghost" on:click={exit}>EXIT</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .boba-canvas {
    position: fixed;
    inset: 0;
    z-index: 9998;
    pointer-events: none;
  }

  /* Riso "announcement banner" panels: a cream sheet over an offset orange
     slab, both with wobbly hand-printed edges (#boba-rough) — matching the
     homepage banner. Wraps the HUD and game-over overlays. */
  .riso {
    position: relative;
    display: inline-block;
  }
  .riso-back {
    position: absolute;
    top: 5px;
    left: 5px;
    right: -5px;
    bottom: -5px;
    background: #e85d4c;
    border-radius: 20px 7px 15px 9px;
    filter: url(#boba-rough);
    z-index: 0;
    pointer-events: none;
  }
  .riso-front {
    position: relative;
    z-index: 1;
    isolation: isolate;
    background: transparent;
  }
  .riso-front::before,
  .riso-front::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 13px 18px 13px 16px;
    filter: url(#boba-rough);
    pointer-events: none;
  }
  .riso-front::before {
    background: #fdf8f3; /* cream sheet */
    z-index: -2;
  }
  .riso-front::after {
    border: 2.5px solid #1a1a1a; /* sketchy outline */
    z-index: -1;
  }
  :global(.dark) .riso-back {
    background: #f07563;
  }
  :global(.dark) .riso-front::before {
    background: #2a2422;
  }
  :global(.dark) .riso-front::after {
    border-color: #fdf8f3;
  }

  /* All HUD chrome uses the site's mono stack + palette. */
  .boba-hud,
  .boba-over {
    font-family: var(--font-mono);
  }

  .boba-hud {
    position: fixed;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    pointer-events: none;
    text-align: center;
    width: max-content;
    max-width: 92vw;
  }
  .boba-hud-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #1a1a1a;
    padding: 8px 18px;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .boba-tag-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .boba-tag {
    color: #e85d4c;
  }
  .boba-score {
    color: #1a1a1a;
  }
  .boba-hearts {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  /* Clickable even though the rest of the HUD is pointer-events: none. */
  .boba-mute {
    pointer-events: auto;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    background: none;
    border: 0;
    padding: 0;
    margin-left: 2px;
    line-height: 1;
  }
  /* Instructions ribbon — a deliberately DIFFERENT riso panel: accent-orange
     sheet over a dark slab offset the opposite way, no outline, tighter wobble
     radius. Reads as a distinct "tip" vs the cream stats pill above it. */
  .boba-tip {
    position: relative;
    display: inline-block;
    margin-top: 10px;
  }
  .boba-tip-back {
    position: absolute;
    top: 4px;
    left: -4px;
    right: 4px;
    bottom: -4px;
    background: #1a1a1a;
    border-radius: 8px 16px 7px 15px;
    filter: url(#boba-rough);
    z-index: 0;
    pointer-events: none;
  }
  .boba-tip-front {
    position: relative;
    z-index: 1;
    isolation: isolate;
    color: #fdf8f3;
    padding: 4px 13px;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .boba-tip-front::before {
    content: "";
    position: absolute;
    inset: 0;
    background: #e85d4c;
    border-radius: 16px 7px 15px 8px;
    filter: url(#boba-rough);
    z-index: -1;
    pointer-events: none;
  }

  /* "Now playing": a pixel note with a pennant flapping off it, song name inside. */
  .boba-np {
    margin-top: 9px;
    display: inline-flex;
    align-items: center;
  }
  /* Scale the riso plaque down for the little note badge (the "flagpole"). */
  .boba-np-riso .riso-back {
    top: 3px;
    left: 3px;
    right: -3px;
    bottom: -3px;
    border-radius: 9px 4px 7px 5px;
  }
  .boba-np-riso .riso-front::before,
  .boba-np-riso .riso-front::after {
    border-radius: 7px 9px 6px 8px;
  }
  .boba-np-base {
    display: inline-flex;
    align-items: center;
    padding: 4px 6px;
    line-height: 1;
  }
  /* The waving song-name flag is rendered on a canvas (see WavingFlag.svelte). */

  .boba-over {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: grid;
    place-items: center;
    background: rgba(26, 26, 26, 0.45);
    pointer-events: auto;
  }
  .boba-over-card {
    color: #1a1a1a;
    padding: 28px 40px;
    text-align: center;
  }
  .boba-over-title {
    font-size: 1.4rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #e85d4c;
  }
  .boba-over-score {
    margin-top: 8px;
    font-size: 1rem;
    font-weight: 700;
  }
  .boba-over-actions {
    margin-top: 18px;
    display: flex;
    gap: 12px;
    justify-content: center;
  }
  .boba-btn {
    font: inherit;
    font-weight: 700;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    cursor: pointer;
    padding: 8px 14px;
    border: 2.5px solid #1a1a1a;
    border-radius: 4px;
    background: #e85d4c;
    color: #fdf8f3;
    box-shadow: 3px 3px 0 #1a1a1a;
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease;
  }
  .boba-btn.ghost {
    background: #fdf8f3;
    color: #1a1a1a;
  }
  .boba-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #1a1a1a;
  }
  .boba-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 #1a1a1a;
  }
  .boba-btn.small {
    padding: 7px 12px;
    font-size: 0.68rem;
  }
  .boba-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  /* High-score block */
  .boba-best {
    margin-top: 3px;
    font-size: 0.72rem;
    color: #8a7d70;
    letter-spacing: 0.04em;
  }
  .boba-newbest {
    margin-left: 8px;
    color: #e85d4c;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.06em;
  }
  .boba-submit {
    margin-top: 16px;
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .boba-name {
    font: inherit;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    width: 8.5em;
    padding: 7px 10px;
    border: 2.5px solid #1a1a1a;
    border-radius: 4px;
    background: #fff;
    color: #1a1a1a;
    outline: none;
  }
  .boba-name::placeholder {
    color: #b8a89a;
    letter-spacing: 0.06em;
  }
  .boba-name:focus {
    box-shadow: 0 0 0 2px #e85d4c;
  }
  .boba-name-err {
    margin-top: 7px;
    font-size: 0.64rem;
    color: #c0392b;
    letter-spacing: 0.02em;
  }
  .boba-submitted {
    margin-top: 14px;
    font-size: 0.74rem;
    font-weight: 700;
    color: #e85d4c;
  }
  .boba-board {
    margin-top: 18px;
    min-width: 210px;
    text-align: left;
  }
  .boba-board-head {
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #8a7d70;
    text-align: center;
    margin-bottom: 6px;
  }
  .boba-board-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
  }
  .boba-board-row.muted {
    justify-content: center;
    color: #b8a89a;
    font-weight: 600;
  }
  .boba-board-row.me {
    background: rgba(232, 93, 76, 0.16);
  }
  .boba-board-row .rank {
    width: 1.4em;
    color: #8a7d70;
    text-align: right;
  }
  .boba-board-row .bname {
    flex: 1;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .boba-board-row .bscore {
    color: #e85d4c;
    font-weight: 800;
  }

  /* Dark mode: ink->cream text (the riso sheet handles the background). */
  :global(.dark) .boba-hud-row,
  :global(.dark) .boba-over-card {
    color: #fdf8f3;
  }
  :global(.dark) .boba-score {
    color: #fdf8f3;
  }
  :global(.dark) .boba-tip-back {
    background: #fdf8f3; /* dark slab is invisible on a dark page */
  }
  :global(.dark) .boba-name {
    background: #1a1a1a;
    color: #fdf8f3;
    border-color: #fdf8f3;
  }
  :global(.dark) .boba-board-row.me {
    background: rgba(240, 117, 99, 0.22);
  }
  :global(.dark) .boba-btn {
    border-color: #fdf8f3;
    box-shadow: 3px 3px 0 #fdf8f3;
  }
  :global(.dark) .boba-btn.ghost {
    background: #1a1a1a;
    color: #fdf8f3;
  }
  :global(.dark) .boba-btn:hover {
    box-shadow: 4px 4px 0 #fdf8f3;
  }
  :global(.dark) .boba-btn:active {
    box-shadow: 1px 1px 0 #fdf8f3;
  }
</style>
