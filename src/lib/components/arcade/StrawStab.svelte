<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  import {
    audioClock,
    finishMusic,
    resumeAudio,
    setMusicPhase,
    sfxBlip,
    sfxCountdown,
    sfxGameOver,
    sfxMilestone,
    sfxMiss,
    sfxStab,
    sfxStart,
    sfxWhiff,
    songTempos,
    startMusic,
    stopMusic,
    suspendAudio,
  } from "$lib/sfx";
  import {
    BEATS_PER_BAR,
    LIVES,
    WINDOWS,
    barAtTime,
    barPosition,
    barStart,
    cupBeats,
    isGoldenCup,
    isLate,
    judgeStab,
    nearestCup,
    pointsForStab,
    tierForBar,
  } from "$lib/arcade/stab-engine.js";
  import {
    DRINKS,
    INK,
    MENU_ICONS,
    PAPER_WHITE,
    PEARL,
    SPRITE_PAD,
    STRAW_PINK,
    addParticle,
    addPopup,
    arcadeFont,
    cachedSprite,
    drawLoop,
    drawParticles,
    drawPopups,
    fitCanvas,
    risoColors,
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
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import Pearls from "./Pearls.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";
  import TrackFlag from "./TrackFlag.svelte";

  // Straw stab: cups ride a belt and pass under the straw exactly on the
  // soundtrack's beats. The belt is drawn against the audio clock itself,
  // so what you see lines up with what you hear, pauses included.

  const dispatch = createEventDispatcher<{ close: null; menu: null }>();

  // Slowest song first, so the tempo climbs through each loop.
  const PLAYLIST = [1, 0, 2, 3];
  const TEMPOS = songTempos(PLAYLIST);
  const COUNTDOWN_SECONDS = 3;
  const PLUNGE_SECONDS = 0.05;
  const RELOAD_SECONDS = 0.1;
  const TUMBLE_SECONDS = 0.45;
  const HALO = "rgba(253, 248, 243, 0.8)";
  const TIER_LABELS = [
    "easy does it",
    "picking up",
    "double time",
    "no breaks",
    "chaos shift",
    "last call",
  ];
  const STAB_KEYS = new Set([" ", "Enter", "ArrowDown", "j", "k", "f", "d"]);

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

  interface Cup {
    /** Song time when the cup is dead under the straw. */
    time: number;
    drink: number;
    golden: boolean;
    resolved: boolean;
    missed: boolean;
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
  let lives = LIVES;
  let combo = 0;
  let bestCombo = 0;
  let hits = 0;
  let perfects = 0;
  let countdown = COUNTDOWN_SECONDS;
  let goVisible = false;
  let running = false;
  let paused = false;
  let gameOver = false;
  let tipVisible = false;
  let missPulse = 0;
  let missFlash = false;
  let beatInBar = -1;
  let currentBpm = TEMPOS[0];
  let tier = 0;
  let songsReached = 1;
  let liveMessage = "Straw stab starting";
  let localBest = 0;
  let newBest = false;
  let run = 0;

  // --- Canvas, clock, and lifecycle state ----------------------------------

  let canvas: HTMLCanvasElement;
  let hud: HTMLElement;
  let hudRow: HTMLElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let hudButtons: HudButtons;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;
  let popupFont = "500 13px monospace";
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

  // The clock. With audio, song time is the heard audio time minus the first
  // downbeat, smoothed against performance.now() so motion stays fluid.
  // Without audio it is plain performance time.
  let useAudio = false;
  let origin = 0;
  let clockOffset = 0;
  let clockSynced = false;
  let waitingForAudio = false;
  let waitStarted = 0;
  let heldSong = 0;

  let countdownElapsed = 0;
  let last = 0;
  let raf = 0;
  let active = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const clamp = (value: number, low: number, high: number) =>
    Math.max(low, Math.min(high, value));
  const perfSeconds = () => performance.now() / 1000;

  function later(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  }

  function exit() {
    sfxBlip();
    dispatch("close");
  }

  function toMenu() {
    sfxBlip();
    dispatch("menu");
  }

  function clockNow() {
    const perf = perfSeconds();
    if (useAudio) {
      const heard = audioClock();
      if (heard !== null) {
        const raw = heard - perf;
        if (!clockSynced || Math.abs(raw - clockOffset) > 0.03) {
          clockOffset = raw;
          clockSynced = true;
        } else {
          clockOffset += (raw - clockOffset) * 0.05;
        }
      }
    }
    return perf + clockOffset;
  }

  const songNow = () => clockNow() - origin;

  // --- Layout helpers --------------------------------------------------------

  const cupX = (cup: Cup, now: number) => strawX + (cup.time - now) * speed;
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

  function drawBelt(now: number, colors: ReturnType<typeof risoColors>) {
    if (!ctx) return;
    const band = Math.max(12, px * 3);
    ctx.fillStyle = colors.slab;
    ctx.fillRect(0, beltY + 4, viewW, band);
    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, beltY, viewW, band);
    ctx.fillStyle = colors.ink;
    ctx.fillRect(0, beltY, viewW, 2);
    ctx.fillRect(0, beltY + band - 2, viewW, 2);

    // Every beat is notched into the belt, so the rhythm is visible too.
    const firstBar = barAtTime(TEMPOS, Math.max(0, now - strawX / speed));
    const lastBar = barAtTime(TEMPOS, Math.max(0, now + leadSeconds)) + 1;
    for (let bar = firstBar; bar <= lastBar; bar++) {
      const start = barStart(TEMPOS, bar);
      const beatLength = 60 / barPosition(TEMPOS, bar).bpm;
      for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
        const x = strawX + (start + beat * beatLength - now) * speed;
        if (x < -4 || x > viewW + 4) continue;
        const height = beat === 0 ? band - 4 : Math.round((band - 4) / 2);
        ctx.fillRect(Math.round(x) - 1, beltY + 2, 2, height);
      }
    }
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
    if (plunge || gameOver) return;
    let bottom = restBottom();
    if (reload > 0) bottom -= (reload / RELOAD_SECONDS) * (strawH + 30);
    else if (running && !reduceMotion) bottom -= Math.max(0, 1 - beatPhase * 3) * 3;
    drawStraw(strawX, bottom);
  }

  function draw(now: number) {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewW, viewH);
    const colors = risoColors();
    drawBelt(now, colors);
    // The ring on the belt marks where a cup should be when you stab.
    drawLoop(ctx, 0, strawX - (cupW + 34) / 2, beltY - cupH - 14, cupW + 34, cupH + 26, colors);
    for (const cup of cups) drawCup(cup, now);
    for (const straw of tumbling) {
      const k = straw.age / TUMBLE_SECONDS;
      drawStraw(straw.x - straw.age * speed, beltY, -Math.min(1.3, k * 4), 1 - k);
    }
    drawPlunge(now);
    drawHand();
    drawParticles(ctx, particles);
    drawPopups(ctx, popups, popupFont);
  }

  // --- Rules in motion ---------------------------------------------------------

  function planAhead(now: number) {
    while (barStart(TEMPOS, plannedBars) < now + leadSeconds + 0.6) {
      const start = barStart(TEMPOS, plannedBars);
      const beatLength = 60 / barPosition(TEMPOS, plannedBars).bpm;
      for (const beat of cupBeats(TEMPOS, plannedBars)) {
        cupCount += 1;
        cups.push({
          time: start + beat * beatLength,
          drink: (Math.random() * DRINKS.length) | 0,
          golden: isGoldenCup(cupCount),
          resolved: false,
          missed: false,
          straw: null,
        });
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

    currentBar = bar;
    currentBpm = position.bpm;
    songsReached = position.loop * TEMPOS.length + position.song + 1;
    const nextTier = tierForBar(TEMPOS, bar);
    if (nextTier !== tier) {
      tier = nextTier;
      setMusicPhase(tier >= 2 ? "rush" : "steady");
      liveMessage = `${TIER_LABELS[tier]}.`;
    }
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
    missPulse += 1;
    missFlash = true;
    later(() => (missFlash = false), 250);
    if (lives <= 0) void endGame();
    else liveMessage = `${lives} ${lives === 1 ? "pearl" : "pearls"} left.`;
    return pan(x);
  }

  function stab() {
    if (!running || paused || gameOver || waitingForAudio) return;
    const now = songNow();
    if (now - lastStab < 0.06) return;
    lastStab = now;
    settlePlunge();
    reload = 0;
    tipVisible = false;

    const index = nearestCup(cups, now);
    const impactY = beltY - cupH + px * 1.5;
    if (index < 0) {
      // Nothing under the straw: it hits the belt.
      plunge = { cup: null, offset: 0, age: 0 };
      for (let i = 0; i < 7; i++) addParticle(particles, strawX, beltY, risoColors().ink, 70, 300);
      addPopup(popups, strawX, restBottom() - strawH - 8, "bonk", "miss");
      sfxWhiff(loseLife(strawX));
      return;
    }

    const cup = cups[index];
    const error = now - cup.time;
    const rating = judgeStab(error) ?? "graze";
    cup.resolved = true;
    // Early stabs land left of center and late ones right, as the cup moves.
    const offset = clamp(error / WINDOWS.graze, -1, 1) * (cupW / 2 - px * 1.5);
    plunge = { cup, offset, age: 0 };

    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    hits += 1;
    if (rating === "perfect") perfects += 1;
    const points = pointsForStab(rating, cup.golden, combo);
    score += points;

    const x = cupX(cup, now) + offset;
    const liquid = cup.golden ? "#f2b84b" : DRINKS[cup.drink];
    const count = rating === "perfect" ? 10 : rating === "good" ? 7 : 5;
    for (let i = 0; i < count; i++) {
      addParticle(particles, x, impactY, i % 3 === 0 ? PAPER_WHITE : i % 3 === 1 ? "#e85d4c" : liquid, 80, 320);
    }
    const label = cup.golden ? `golden ${rating}` : rating;
    addPopup(
      popups,
      strawX,
      restBottom() - strawH - 8,
      combo > 4 ? `${label} +${points} · ×${combo}` : `${label} +${points}`,
      cup.golden ? "gold" : rating === "perfect" ? "perfect" : "plain",
    );
    if (combo % 20 === 0) {
      sfxMilestone(pan(x));
      liveMessage = `${combo} in a row. Score ${score}.`;
    } else {
      sfxStab(rating, combo, pan(x));
      if (cup.golden) liveMessage = `Golden cup, ${points} points.`;
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
    // Drums from the first bar: the beat is the whole game here.
    setMusicPhase("steady");
    const downbeat = startMusic(PLAYLIST);
    useAudio = downbeat !== null && audioClock() !== null;
    clockSynced = false;
    clockOffset = 0;
    if (useAudio && downbeat !== null) {
      origin = downbeat;
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
    const dt = Math.min(rawDt, 0.05);

    if (paused) {
      draw(running ? heldSong : 0);
      raf = requestAnimationFrame(frame);
      return;
    }

    if (!running) {
      countdownElapsed += Math.min(rawDt, 0.25);
      const next = Math.max(1, COUNTDOWN_SECONDS - Math.floor(countdownElapsed));
      if (next !== countdown && countdownElapsed < COUNTDOWN_SECONDS) {
        countdown = next;
        sfxCountdown(countdown);
      }
      if (countdownElapsed >= COUNTDOWN_SECONDS) beginRun();
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
        draw(heldSong);
        raf = requestAnimationFrame(frame);
        return;
      }
    }

    const now = songNow();
    planAhead(now);
    for (const cup of cups) {
      if (!isLate(cup, now)) continue;
      cup.resolved = true;
      cup.missed = true;
      const x = cupX(cup, now);
      addPopup(popups, x, beltY - cupH - 18, "no straw", "miss", 0.8);
      sfxMiss(loseLife(x));
      if (gameOver) return;
    }
    cups = cups.filter((cup) => cupX(cup, now) > -cupW * 2);
    updateBeat(now);
    stepStraws(dt);
    stepParticles(particles, dt);
    stepPopups(popups, dt);
    draw(now);
    if (active && !gameOver) raf = requestAnimationFrame(frame);
  }

  // --- Pause, restart, and finish -----------------------------------------

  async function pauseGame() {
    if (gameOver || paused) return;
    paused = true;
    if (running && !waitingForAudio) {
      heldSong = songNow();
      if (useAudio) suspendAudio();
    }
    liveMessage = "Game paused";
    await tick();
    pauseCard?.focus();
  }

  function resumeGame() {
    if (gameOver || !paused) return;
    paused = false;
    last = 0;
    if (running) {
      if (useAudio) {
        resumeAudio();
        waitingForAudio = true;
        waitStarted = perfSeconds();
      } else {
        origin = perfSeconds() - heldSong;
      }
    }
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
    running = false;
    active = false;
    cancelAnimationFrame(raf);
    finishMusic();
    sfxGameOver("hearts");
    const result = recordScore("stab", score);
    localBest = result.best;
    newBest = result.newBest;
    liveMessage = `Last call. Final score ${score}.`;
    draw(songNow());
    await tick();
    slip?.focus();
  }

  function restart() {
    stopMusic();
    score = 0;
    lives = LIVES;
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
    tipVisible = false;
    missPulse = 0;
    missFlash = false;
    beatInBar = -1;
    currentBpm = TEMPOS[0];
    tier = 0;
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
    useAudio = false;
    waitingForAudio = false;
    last = 0;
    run += 1;
    active = true;
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
    raf = requestAnimationFrame(frame);
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
    // Measured from the ticket row, not the whole HUD, so the belt stays put
    // when the first-run tip closes.
    const playTop = hudRow ? hudRow.getBoundingClientRect().bottom : 80;
    beltY = Math.round(
      clamp(
        playTop + (viewH - playTop) * 0.62,
        playTop + strawH + cupH + 48,
        viewH - Math.max(48, viewH * 0.12),
      ),
    );
    strawX = Math.round(viewW * (viewW < 640 ? 0.24 : 0.3));
    speed = clamp((viewW - strawX) / 1.7, 220, 620);
    leadSeconds = (viewW - strawX + cupW) / speed;
    draw(running ? (paused ? heldSong : songNow()) : 0);
  }

  function onPointer(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    stab();
  }

  onMount(() => {
    popupFont = arcadeFont();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => (reduceMotion = motion.matches);
    syncMotion();
    motion.addEventListener("change", syncMotion);
    sizeCanvas();
    tipVisible = firstVisit("stab");
    sfxCountdown(COUNTDOWN_SECONDS);

    const onResize = () => sizeCanvas();
    const onBlur = () => {
      if (!gameOver && !paused) void pauseGame();
    };
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        if (gameOver) trapFocus(event, document.querySelector(".boba-over-card"));
        else if (paused) trapFocus(event, document.querySelector(".boba-pause-card"));
        else trapFocus(event, hud);
        return;
      }
      if (event.repeat || gameOver) return;
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        togglePause();
        return;
      }
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (!STAB_KEYS.has(key)) return;
      // A focused control keeps Space and Enter for itself.
      if (event.target instanceof HTMLElement && event.target.closest("button, input")) return;
      event.preventDefault();
      stab();
    };

    // The ticket row can change height (a font loading, a narrow screen
    // wrapping it), and the belt sits below it.
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
      // Never leave the shared audio clock frozen behind a closed game.
      resumeAudio();
      stopMusic();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
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

<header bind:this={hud} class="boba-hud boba-ui" aria-label="Straw stab status">
  <div bind:this={hudRow} class="boba-hud-row">
    <div class="boba-ticket boba-ticket-start boba-riso" style="--tilt: -1.2deg">
      <span class="boba-ticket-icon" aria-hidden="true">
        <PixelIcon grid={MENU_ICONS.stab.grid} palette={MENU_ICONS.stab.palette} px={3} />
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
      class:is-rush={tier >= 2}
      style="--tilt: 0.9deg"
    >
      <span class="beats" aria-hidden="true">
        {#each [0, 1, 2, 3] as beat}
          <span class="beat" class:on={running && !paused && beat === beatInBar}></span>
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
      <Pearls left={lives} total={LIVES} pulse={missPulse} />
      <HudButtons bind:this={hudButtons} {paused} on:pause={togglePause} />
    </div>
  </div>

  {#if tipVisible}
    <div class="boba-tip" role="note" aria-label="How to play">
      <span class="boba-tip-label">how to play</span>
      <span>stab as each cup reaches the ring</span>
      <Mark kind="dot" />
      <span>on the beat is a perfect</span>
      <Mark kind="dot" />
      <span>a missed cup or a stab at the belt costs a pearl</span>
      <span class="boba-keys"><kbd>Space</kbd> stab <kbd>P</kbd> pause <kbd>Esc</kbd> quit</span>
    </div>
  {/if}
</header>

{#if countdown > 0 || goVisible}
  <Countdown value={countdown} caption="the belt starts in" goCaption="find the beat" />
{/if}

{#if missFlash}
  <div class="boba-miss-flash" aria-hidden="true"></div>
{/if}

{#if paused && !gameOver}
  <PauseCard
    bind:this={pauseCard}
    deck="The belt is holding its breath. So is the drummer."
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
    deck={`Three cups went out strawless. You got ${songsReached} ${songsReached === 1 ? "song" : "songs"} in.`}
    {score}
    {newBest}
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
  /* Four beat lights, one per beat of the bar. */
  .beats {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .beat {
    width: 0.625rem;
    height: 0.625rem;
    border: 1.5px solid var(--b-line);
    border-radius: 50%;
    transition:
      background-color 60ms linear,
      transform 60ms linear;
  }

  .beat.on {
    background: var(--b-slab);
    border-color: var(--b-slab);
    transform: scale(1.25);
  }

  @media (prefers-reduced-motion: reduce) {
    .beat {
      transition: none;
    }

    .beat.on {
      transform: none;
    }
  }
</style>
