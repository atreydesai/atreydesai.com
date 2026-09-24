<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";

  import {
    finishMusic,
    setMusicPaused,
    setMusicPhase,
    sfxBlip,
    sfxCountdown,
    sfxDump,
    sfxGameOver,
    sfxMiss,
    sfxPlop,
    sfxPour,
    sfxServe,
    sfxStart,
    sfxTicket,
    sfxWrong,
    startMusic,
    stopMusic,
  } from "$lib/sfx";
  import {
    LIVES,
    MAX_TICKETS,
    SHIFT_SECONDS,
    TEAS,
    TOPPINGS,
    makeOrder,
    paceForElapsed,
    pointsForServe,
    sameDrink,
    ticketFor,
    timeRemaining,
    toggleTopping,
  } from "$lib/arcade/orders-engine.js";
  import type { Cup, Order, Phase, Tea, Topping } from "$lib/arcade/orders-engine.js";
  import { MENU_ICONS, PEARL } from "$lib/arcade/art";
  import { trapFocus } from "$lib/arcade/focus";
  import { fetchBoard, firstVisit, recordScore } from "$lib/arcade/scores";
  import Mark from "$lib/components/Mark.svelte";
  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import Countdown from "./Countdown.svelte";
  import CupTimer from "./CupTimer.svelte";
  import HudButtons from "./HudButtons.svelte";
  import PauseCard from "./PauseCard.svelte";
  import Pearls from "./Pearls.svelte";
  import ResultsSlip from "./ResultsSlip.svelte";

  // Order up: tickets clip onto a rail, each asking for one tea and a few
  // toppings. Build the drink, serve it; it goes to whoever ordered it. The
  // whole game is ordinary buttons, so it plays by mouse, touch, or keys.

  const dispatch = createEventDispatcher<{ close: null; menu: null }>();

  const COUNTDOWN_SECONDS = 3;
  const EMPTY_CUP: Cup = { tea: null, toppings: [] };

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
    foam: "cheese foam",
  };
  // Customers the leaderboard doesn't supply.
  const WALK_INS = [
    "mochi",
    "tofu",
    "pip",
    "bean",
    "juniper",
    "noodle",
    "clementine",
    "biscuit",
    "sesame",
    "dumpling",
    "yuzu",
    "pickles",
  ];

  // --- Pixel art -------------------------------------------------------------

  const TEA_JAR = ["OOOOOOO", "OLLLLLO", ".OLLLO.", ".OLLLO.", "..OOO.."];
  const TOPPING_ICONS: Record<Topping, { grid: string[]; palette: Record<string, string> }> = {
    pearls: { grid: [".b.b.", "b.b.b", ".b.b.", "b.b.b"], palette: { b: PEARL } },
    pudding: { grid: ["..CCC..", ".PPPPP.", "PPPPPPP", "PPPPPPP"], palette: { C: "#9a5b1e", P: "#f2c14e" } },
    jelly: { grid: ["JJ.JJ", "JJ.JJ", ".....", ".JJ.J", ".JJ.."], palette: { J: "#8bbf5a" } },
    foam: { grid: [".fff.", "fffff", "fFfff", ".OOO."], palette: { f: "#fffaf0", F: "#e8d5c4", O: "currentColor" } },
  };

  // The counter cup, drawn from what is in it. Each row lists the columns
  // inside the glass, so it narrows toward the bottom.
  const CUP_ROWS: Array<[number, number]> = [
    [1, 10], [1, 10], [2, 9], [2, 9], [2, 9], [2, 9], [2, 9],
    [2, 9], [3, 8], [3, 8], [3, 8], [3, 8], [3, 8],
  ];
  const JELLY_CELLS = new Set(["4,3", "4,7", "5,5", "6,3", "7,6", "7,8"]);

  function cupCell(row: number, column: number, cup: Cup) {
    const has = (topping: Topping) => cup.toppings.includes(topping);
    const liquid = cup.tea ? "L" : ".";
    if (row <= 1) return has("foam") ? ((row + column) % 4 === 0 ? "F" : "f") : ".";
    if (row >= 11 && has("pearls")) return (row + column) % 2 === 0 ? "b" : liquid;
    if (row >= 9 && row <= 10 && has("pudding")) return row === 9 && column % 3 === 0 ? "C" : "P";
    if (row >= 4 && row <= 7 && has("jelly") && JELLY_CELLS.has(`${row},${column}`)) return "J";
    return liquid;
  }

  // Rows above the rim, where the straw pokes out once there is tea.
  const STRAW_ROWS = ["........SS..", ".......SS...", "......SS...."];

  function cupGrid(cup: Cup) {
    const straw = STRAW_ROWS.map((line) => (cup.tea ? line : ".".repeat(line.length)));
    const rows = CUP_ROWS.map(([from, to], row) => {
      let line = "";
      for (let column = 0; column < 12; column++) {
        if (column === from - 1 || column === to + 1) line += "O";
        else if (column < from || column > to) line += ".";
        else line += cupCell(row, column, cup);
      }
      return line;
    });
    // The straw carries on down through the drink.
    if (cup.tea) {
      rows[0] = replaceAt(rows[0], 5, "SS");
      rows[1] = replaceAt(rows[1], 5, "S");
    }
    rows.push("..OOOOOOOO..");
    return [...straw, ...rows];
  }

  function replaceAt(line: string, index: number, text: string) {
    return line.slice(0, index) + text + line.slice(index + text.length);
  }

  function cupPalette(cup: Cup) {
    return {
      O: "currentColor",
      L: cup.tea ? TEA_COLORS[cup.tea] : "transparent",
      b: PEARL,
      P: "#f2c14e",
      C: "#9a5b1e",
      J: "#8bbf5a",
      f: "#fffaf0",
      F: "#e8d5c4",
      S: "#ff5277",
    };
  }

  function describe(order: Order) {
    const toppings = order.toppings.map((topping) => TOPPING_NAMES[topping]);
    if (!toppings.length) return TEA_NAMES[order.tea];
    const last = toppings.pop();
    return `${TEA_NAMES[order.tea]} with ${toppings.length ? `${toppings.join(", ")} and ` : ""}${last}`;
  }

  function describeCup(cup: Cup) {
    if (!cup.tea && !cup.toppings.length) return "an empty cup";
    const base = cup.tea ? TEA_NAMES[cup.tea] : "no tea yet";
    const toppings = cup.toppings.map((topping) => TOPPING_NAMES[topping]);
    return toppings.length ? `${base} + ${toppings.join(" + ")}` : base;
  }

  interface Ticket {
    id: number;
    name: string;
    order: Order;
    patience: number;
    left: number;
    tilt: number;
    /** Set just before the ticket leaves, so its exit can differ. */
    outcome: "served" | "gone" | null;
  }

  // --- State -----------------------------------------------------------------

  let score = 0;
  let lives = LIVES;
  let combo = 0;
  let bestCombo = 0;
  let served = 0;
  let tips = 0;
  let cup: Cup = EMPTY_CUP;
  let tickets: Ticket[] = [];
  let countdown = COUNTDOWN_SECONDS;
  let goVisible = false;
  let running = false;
  let paused = false;
  let gameOver = false;
  let endReason: "hearts" | "time" = "time";
  let timeLeft = SHIFT_SECONDS;
  let phase: Phase = "opening";
  let tipVisible = false;
  let missPulse = 0;
  let wrongPulse = 0;
  let feedback: {
    id: number;
    text: string;
    kind: "plain" | "good" | "bad";
    tip: boolean;
  } | null = null;
  let liveMessage = "Order up starting";
  let localBest = 0;
  let newBest = false;
  let regulars: string[] = [];

  let hud: HTMLElement;
  let hudHeight = 80;
  let cupPx = 6;
  let hudButtons: HudButtons;
  let pauseCard: PauseCard;
  let slip: ResultsSlip;
  let reduceMotion = false;

  let elapsed = 0;
  let countdownElapsed = 0;
  let arrivalTimer = 0;
  let nextId = 1;
  let feedbackId = 0;
  let last = 0;
  let raf = 0;
  let active = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  $: grid = cupGrid(cup);
  $: palette = cupPalette(cup);
  $: cupEmpty = !cup.tea && !cup.toppings.length;

  const phaseLabel = (value: Phase) =>
    value === "rush" ? "lunch rush" : value === "steady" ? "steady trade" : "doors open";

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

  // Clicking a counter button shouldn't take focus from the page, or Space
  // would press that button again instead of serving.
  function keepFocus(event: MouseEvent) {
    event.preventDefault();
  }

  function say(text: string, kind: "plain" | "good" | "bad" = "plain", tip = false) {
    feedbackId += 1;
    feedback = { id: feedbackId, text, kind, tip };
  }

  // Served tickets float up off the rail; forgotten ones fall.
  function leave(node: Element, { ticket }: { ticket: Ticket }) {
    const servedOut = ticket.outcome === "served";
    return {
      duration: reduceMotion ? 0 : 340,
      easing: cubicOut,
      css: (t: number, u: number) =>
        servedOut
          ? `transform: translateY(${-u * 28}px) rotate(${ticket.tilt - u * 6}deg); opacity: ${t}`
          : `transform: translateY(${u * 48}px) rotate(${ticket.tilt + u * 14}deg); opacity: ${t}`,
    };
  }

  function arrive(node: Element, { ticket }: { ticket: Ticket }) {
    return {
      duration: reduceMotion ? 0 : 380,
      easing: cubicOut,
      css: (t: number, u: number) =>
        `transform: translateY(${-u * 26}px) rotate(${ticket.tilt - u * 8}deg); opacity: ${t}`,
    };
  }

  // --- Rules in motion ---------------------------------------------------------

  function pickName() {
    const onRail = new Set(tickets.map((ticket) => ticket.name));
    const pool = [...regulars, ...WALK_INS].filter((name) => !onRail.has(name));
    // Regulars from the leaderboard turn up about half the time.
    const fromBoard = regulars.filter((name) => !onRail.has(name));
    const source = fromBoard.length && Math.random() < 0.5 ? fromBoard : pool;
    return source[(Math.random() * source.length) | 0] ?? "a regular";
  }

  function addTicket() {
    const order = makeOrder(elapsed);
    const pace = paceForElapsed(elapsed);
    // Fussier orders get a little more time.
    const patience = pace.patience + order.toppings.length * 1.5;
    const ticket: Ticket = {
      id: nextId++,
      name: pickName(),
      order,
      patience,
      left: patience,
      tilt: Math.round((Math.random() * 4 - 2) * 10) / 10,
      outcome: null,
    };
    tickets = [...tickets, ticket];
    sfxTicket();
    liveMessage = `New order for ${ticket.name}: ${describe(order)}.`;
  }

  function loseLife() {
    combo = 0;
    lives -= 1;
    missPulse += 1;
    if (lives <= 0) void endGame("hearts");
  }

  function pour(tea: Tea) {
    if (!running || paused) return;
    tipVisible = false;
    if (cup.tea === tea) return;
    cup = { tea, toppings: cup.toppings };
    sfxPour(TEAS.indexOf(tea));
  }

  function toggle(topping: Topping) {
    if (!running || paused) return;
    tipVisible = false;
    const adding = !cup.toppings.includes(topping);
    cup = toggleTopping(cup, topping);
    if (adding) sfxPlop(TOPPINGS.indexOf(topping));
    else sfxBlip();
  }

  function dump() {
    if (!running || paused || cupEmpty) return;
    cup = EMPTY_CUP;
    sfxDump();
    say("poured out");
  }

  function serve() {
    if (!running || paused) return;
    if (cupEmpty) {
      say("the cup is empty");
      return;
    }

    const index = ticketFor(
      cup,
      tickets.map((ticket) => ({ order: ticket.order, patienceLeft: ticket.left })),
    );
    if (index < 0) {
      // Nobody ordered this one.
      wrongPulse += 1;
      cup = EMPTY_CUP;
      sfxWrong();
      say("nobody ordered that", "bad");
      liveMessage = "Nobody ordered that. You lose a pearl.";
      loseLife();
      return;
    }

    const ticket = tickets[index];
    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    served += 1;
    const result = pointsForServe(ticket.order, ticket.left / ticket.patience, combo);
    score += result.points;
    tips += result.tip;
    ticket.outcome = "served";
    tickets = tickets.filter((item) => item !== ticket);
    cup = EMPTY_CUP;
    sfxServe(result.tip > 0);
    say(`for ${ticket.name} +${result.points}`, "good", result.tip > 0);
    liveMessage = `Served ${ticket.name}. ${result.points} points.`;
  }

  // --- Game loop -----------------------------------------------------------

  function beginShift() {
    countdown = 0;
    goVisible = true;
    later(() => (goVisible = false), 620);
    phase = "opening";
    setMusicPhase("opening");
    startMusic();
    sfxStart();
    running = true;
    addTicket();
  }

  function frame(timestamp: number) {
    if (!active) return;
    if (!last) last = timestamp;
    const clockDt = Math.min((timestamp - last) / 1000, 0.25);
    last = timestamp;

    if (paused) {
      raf = requestAnimationFrame(frame);
      return;
    }

    if (!running) {
      countdownElapsed += clockDt;
      const next = Math.max(1, COUNTDOWN_SECONDS - Math.floor(countdownElapsed));
      if (next !== countdown && countdownElapsed < COUNTDOWN_SECONDS) {
        countdown = next;
        sfxCountdown(countdown);
      }
      if (countdownElapsed >= COUNTDOWN_SECONDS) beginShift();
      raf = requestAnimationFrame(frame);
      return;
    }

    elapsed += clockDt;
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

    // A full rail means the next customer waits at the door.
    arrivalTimer = Math.min(arrivalTimer + clockDt, pace.arrivalEvery);
    if (arrivalTimer >= pace.arrivalEvery && tickets.length < MAX_TICKETS) {
      arrivalTimer = 0;
      addTicket();
    }

    for (const ticket of tickets) {
      ticket.left -= clockDt;
      if (ticket.left > 0) continue;
      ticket.outcome = "gone";
      tickets = tickets.filter((item) => item !== ticket);
      sfxMiss();
      say(`${ticket.name} gave up`, "bad");
      liveMessage = `${ticket.name} gave up waiting. You lose a pearl.`;
      loseLife();
      if (gameOver) return;
    }
    tickets = tickets;

    if (active && !gameOver) raf = requestAnimationFrame(frame);
  }

  // --- Pause, restart, and finish -----------------------------------------

  async function pauseGame() {
    if (gameOver || paused) return;
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

  async function endGame(reason: "hearts" | "time") {
    if (gameOver) return;
    gameOver = true;
    running = false;
    active = false;
    endReason = reason;
    cancelAnimationFrame(raf);
    finishMusic();
    sfxGameOver(reason);
    const result = recordScore("orders", score);
    localBest = result.best;
    newBest = result.newBest;
    liveMessage =
      reason === "time" ? `Shift complete. Final score ${score}.` : `Kitchen closed. Final score ${score}.`;
    await tick();
    slip?.focus();
  }

  function restart() {
    stopMusic();
    score = 0;
    lives = LIVES;
    combo = 0;
    bestCombo = 0;
    served = 0;
    tips = 0;
    cup = EMPTY_CUP;
    tickets = [];
    countdown = COUNTDOWN_SECONDS;
    countdownElapsed = 0;
    goVisible = false;
    running = false;
    paused = false;
    gameOver = false;
    timeLeft = SHIFT_SECONDS;
    phase = "opening";
    tipVisible = false;
    missPulse = 0;
    wrongPulse = 0;
    feedback = null;
    newBest = false;
    elapsed = 0;
    arrivalTimer = 0;
    last = 0;
    active = true;
    sfxCountdown(COUNTDOWN_SECONDS);
    liveMessage = `Countdown ${COUNTDOWN_SECONDS}`;
    raf = requestAnimationFrame(frame);
  }

  onMount(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => (reduceMotion = motion.matches);
    syncMotion();
    motion.addEventListener("change", syncMotion);
    tipVisible = firstVisit("orders");
    sfxCountdown(COUNTDOWN_SECONDS);

    // The leaderboard's regulars drop by as customers.
    void fetchBoard("catch").then((board) => {
      regulars = [...new Set(board.scores.map((entry) => entry.name))].slice(0, 12);
    });

    // The counter starts below the whole HUD, first-run tip included.
    const measure = () => {
      hudHeight = hud.getBoundingClientRect().bottom;
      cupPx = window.innerWidth < 640 ? 5 : 6;
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(hud);

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
        else trapFocus(event, document.querySelector(".orders-game"));
        return;
      }
      if (event.repeat || gameOver) return;
      const key = event.key.toLowerCase();
      if (key === "p") {
        event.preventDefault();
        togglePause();
        return;
      }
      if (paused) return;
      const onControl =
        event.target instanceof HTMLElement && !!event.target.closest("button, input");
      const number = Number(event.key);
      if (number >= 1 && number <= TEAS.length) {
        event.preventDefault();
        pour(TEAS[number - 1]);
      } else if (number > TEAS.length && number <= TEAS.length + TOPPINGS.length) {
        event.preventDefault();
        toggle(TOPPINGS[number - TEAS.length - 1]);
      } else if ((event.key === " " || event.key === "Enter") && !onControl) {
        // A focused control keeps Space and Enter for itself.
        event.preventDefault();
        serve();
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        dump();
      }
    };

    window.addEventListener("resize", measure);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      stopMusic();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      resizeObserver.disconnect();
      motion.removeEventListener("change", syncMotion);
      window.removeEventListener("resize", measure);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  });
</script>

<div class="orders-game">
  <div class="boba-stage is-paper" aria-hidden="true"></div>

  <header bind:this={hud} class="boba-hud boba-ui" aria-label="Order up status">
    <div class="boba-hud-row">
      <div class="boba-ticket boba-ticket-start boba-riso" style="--tilt: -1.2deg">
        <span class="boba-ticket-icon" aria-hidden="true">
          <PixelIcon grid={MENU_ICONS.orders.grid} palette={MENU_ICONS.orders.palette} px={3} />
        </span>
        <span class="boba-big">{String(score).padStart(3, "0")}</span>
        <span class="boba-stack">
          <span class="boba-meta">points</span>
          {#key combo}
            <span class="boba-combo" class:active={combo > 1}>
              {combo > 1 ? `×${combo} streak` : "no streak yet"}
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
        <HudButtons bind:this={hudButtons} {paused} on:pause={togglePause} />
      </div>
    </div>

    {#if tipVisible}
      <div class="boba-tip" role="note" aria-label="How to play">
        <span class="boba-tip-label">how to play</span>
        <span>build the drink on a ticket</span>
        <Mark kind="dot" />
        <span>serve it before they give up</span>
        <Mark kind="dot" />
        <span>faster service, bigger tips</span>
        <span class="boba-keys"><kbd>1</kbd>–<kbd>8</kbd> add <kbd>Space</kbd> serve <kbd>⌫</kbd> dump</span>
      </div>
    {/if}
  </header>

  <div class="counter boba-ui" style={`--hud-h: ${hudHeight}px`}>
    <!-- The order rail: tickets clip onto a wire as customers arrive. -->
    <section class="rail" aria-label="Orders">
      <span class="wire" aria-hidden="true"></span>
      <ol class="tickets">
        {#each tickets as ticket (ticket.id)}
          {@const ready = sameDrink(cup, ticket.order)}
          <li
            class="slip boba-riso is-small"
            class:ready
            style={`transform: rotate(${ticket.tilt}deg)`}
            in:arrive={{ ticket }}
            out:leave={{ ticket }}
            animate:flip={{ duration: reduceMotion ? 0 : 260 }}
          >
            <span class="clip" aria-hidden="true"></span>
            <p class="who">for {ticket.name}</p>
            <ul class="items">
              <li class:has={cup.tea === ticket.order.tea}>
                <span class="tick" aria-hidden="true">
                  {#if cup.tea === ticket.order.tea}✓{:else}<Mark kind="dot" text="" />{/if}
                </span>
                <span class="swatch" style={`--swatch: ${TEA_COLORS[ticket.order.tea]}`}></span>
                {TEA_NAMES[ticket.order.tea]}
              </li>
              {#each ticket.order.toppings as topping}
                <li class:has={cup.toppings.includes(topping)}>
                  <span class="tick" aria-hidden="true">
                    {#if cup.toppings.includes(topping)}✓{:else}<Mark kind="dot" text="" />{/if}
                  </span>
                  + {TOPPING_NAMES[topping]}
                </li>
              {/each}
            </ul>
            <span
              class="patience"
              class:hurry={ticket.left / ticket.patience < 0.3}
              style={`--left: ${Math.max(0, ticket.left / ticket.patience)}`}
              aria-hidden="true"
            ></span>
            {#if ready}
              <span class="ready-stamp" aria-hidden="true">ready</span>
            {/if}
          </li>
        {/each}
      </ol>
      {#if running && tickets.length === 0}
        <p class="quiet">The rail is empty. Enjoy it while it lasts.</p>
      {/if}
    </section>

    <!-- The cup being built, and what to do with it. -->
    <section class="station" aria-label="Your cup">
      <div class="cup">
        {#key wrongPulse}
          <span class="cup-art" class:wobble={wrongPulse > 0}>
            <PixelIcon {grid} {palette} px={cupPx} />
          </span>
        {/key}
        <p class="cup-label">{describeCup(cup)}</p>
        {#if feedback}
          {#key feedback.id}
            <span class="feedback {feedback.kind}" aria-hidden="true">
              {feedback.text}{#if feedback.tip}
                <Mark kind="dot" /> tip{/if}
            </span>
          {/key}
        {/if}
      </div>
      <div class="station-actions">
        <button
          type="button"
          class="boba-btn"
          disabled={!running || cupEmpty}
          on:mousedown={keepFocus}
          on:click={serve}
        >
          Serve <kbd class="hint">Space</kbd>
        </button>
        <button
          type="button"
          class="boba-btn secondary"
          disabled={!running || cupEmpty}
          on:mousedown={keepFocus}
          on:click={dump}
        >
          Dump <kbd class="hint">⌫</kbd>
        </button>
      </div>
    </section>

    <!-- The shelf: one tea, any toppings. -->
    <section class="shelf" aria-label="Ingredients">
      <div class="shelf-row" role="group" aria-label="Teas">
        {#each TEAS as tea, index}
          <button
            type="button"
            class="jar"
            aria-pressed={cup.tea === tea}
            disabled={!running}
            on:mousedown={keepFocus}
            on:click={() => pour(tea)}
          >
            <PixelIcon grid={TEA_JAR} palette={{ O: "currentColor", L: TEA_COLORS[tea] }} px={3} />
            <span class="jar-name">{TEA_NAMES[tea]}</span>
            <kbd class="hint">{index + 1}</kbd>
          </button>
        {/each}
      </div>
      <div class="shelf-row" role="group" aria-label="Toppings">
        {#each TOPPINGS as topping, index}
          <button
            type="button"
            class="jar"
            aria-pressed={cup.toppings.includes(topping)}
            disabled={!running}
            on:mousedown={keepFocus}
            on:click={() => toggle(topping)}
          >
            <PixelIcon
              grid={TOPPING_ICONS[topping].grid}
              palette={TOPPING_ICONS[topping].palette}
              px={3}
            />
            <span class="jar-name">{TOPPING_NAMES[topping]}</span>
            <kbd class="hint">{TEAS.length + index + 1}</kbd>
          </button>
        {/each}
      </div>
    </section>
  </div>
</div>

{#if countdown > 0 || goVisible}
  <Countdown value={countdown} caption="the counter opens in" goCaption="orders up" />
{/if}

{#if paused && !gameOver}
  <PauseCard
    bind:this={pauseCard}
    deck="The customers froze mid-sip. Very polite of them."
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
      ? "Ninety seconds of orders. Go sit down for a second."
      : "Three orders went wrong. The regulars will talk."}
    {score}
    {newBest}
    stats={[
      { label: "drinks served", value: served },
      { label: "tips earned", value: tips },
      { label: "best streak", value: `×${bestCombo}` },
      { label: "personal best", value: localBest },
    ]}
    on:restart={restart}
    on:menu={toMenu}
    on:exit={exit}
  />
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>

<style>
  .counter {
    position: fixed;
    inset: 0;
    z-index: calc(var(--layer-overlay) + 1);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    padding: calc(var(--hud-h) + var(--space-8)) var(--space-6) var(--space-8);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* --- Rail --- */

  .rail {
    position: relative;
    width: min(100%, 52rem);
    padding-top: var(--space-4);
  }

  .wire {
    position: absolute;
    inset: var(--space-2) 0 auto;
    height: 2px;
    background: var(--b-line);
    box-shadow: 0 3px 0 var(--b-slab);
  }

  .tickets {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-items: start;
    gap: var(--space-4);
    min-height: 9rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .slip {
    display: grid;
    align-content: start;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-3) var(--space-3);
    transform-origin: 50% 0;
  }

  .clip {
    position: absolute;
    top: calc(var(--space-2) * -1 - 2px);
    left: 50%;
    width: 1.5rem;
    height: 0.875rem;
    background: var(--b-line);
    border-radius: 2px 2px 0 0;
    transform: translateX(-50%);
  }

  .who {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--b-strong);
    font-family: var(--font-prose);
    font-size: 1.0625rem;
    font-style: italic;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .items {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    color: var(--b-muted);
    font-size: 0.75rem;
    line-height: 1.25;
    list-style: none;
  }

  .items li {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
  }

  .items li.has {
    color: var(--b-strong);
  }

  /* A tick once the cup has it; until then, the site's drawn dot. */
  .tick {
    display: inline-flex;
    justify-content: center;
    width: 0.75rem;
    flex: none;
  }

  .has .tick {
    color: var(--b-accent);
  }

  .swatch {
    width: 0.75rem;
    height: 0.75rem;
    flex: none;
    background: var(--swatch);
    border: 1.5px solid var(--b-line);
    border-radius: 2px;
  }

  /* Patience is a pencil line that shortens, and turns accent near the end. */
  .patience {
    height: 3px;
    margin-top: var(--space-1);
    background: var(--b-line);
    border-radius: 2px;
    transform: scaleX(var(--left));
    transform-origin: left;
  }

  .patience.hurry {
    background: var(--b-accent);
  }

  .ready-stamp {
    position: absolute;
    top: var(--space-2);
    right: calc(var(--space-2) * -1);
    padding: 0 var(--space-1-5);
    color: var(--b-accent);
    background: var(--b-paper);
    border: 2px solid currentColor;
    border-radius: 3px 8px 4px 9px;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    line-height: 1.25;
    text-transform: uppercase;
    transform: rotate(9deg);
    filter: url(#boba-rough-fine);
    animation: stamp-in var(--motion-slow) var(--ease-emphasized) both;
  }

  @keyframes stamp-in {
    from {
      opacity: 0;
      transform: rotate(16deg) scale(1.6);
    }
  }

  .quiet {
    margin: var(--space-2) 0 0;
    color: var(--b-muted);
    font-family: var(--font-prose);
    font-size: 0.95rem;
    font-style: italic;
    text-align: center;
  }

  /* --- Station --- */

  .station {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
  }

  .cup {
    position: relative;
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    min-width: 11rem;
    color: var(--b-line);
  }

  .cup-art {
    display: grid;
    place-items: center;
  }

  .cup-art.wobble {
    animation: boba-shake var(--motion-slow) var(--ease-standard);
  }

  .cup-label {
    margin: 0;
    color: var(--b-text);
    font-size: 0.75rem;
    line-height: 1.25;
    text-align: center;
  }

  .feedback {
    position: absolute;
    top: -1.75rem;
    left: 50%;
    padding: var(--space-0-5) var(--space-2);
    color: var(--b-strong);
    background: var(--b-paper);
    border-radius: var(--radius-control);
    font-size: 0.75rem;
    line-height: 1.25;
    white-space: nowrap;
    pointer-events: none;
    transform: translateX(-50%);
    animation: float-off 1.1s var(--ease-standard) forwards;
  }

  .feedback :global(.mark) {
    margin-inline: var(--space-0-5);
  }

  .feedback.good {
    color: var(--b-accent);
  }

  .feedback.bad {
    color: var(--b-accent);
    font-style: italic;
  }

  @keyframes float-off {
    0% {
      opacity: 0;
      transform: translate(-50%, 6px);
    }
    15%,
    70% {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -10px);
    }
  }

  .station-actions {
    display: grid;
    gap: var(--space-3);
  }

  .hint {
    padding: 0 var(--space-1);
    border-radius: var(--radius-control);
    background: rgb(128 128 128 / 0.18);
    font: inherit;
    font-size: 0.75rem;
  }

  /* --- Shelf --- */

  .shelf {
    display: grid;
    gap: var(--space-3);
    width: min(100%, 44rem);
  }

  .shelf-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .jar {
    position: relative;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: var(--space-1-5);
    min-height: 4.75rem;
    padding: var(--space-2);
    color: var(--b-strong);
    background: var(--b-raised);
    border: 1px solid var(--b-rule);
    border-radius: var(--radius-control);
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    line-height: 1.25;
    touch-action: manipulation;
    transition:
      border-color var(--motion-fast) var(--ease-standard),
      box-shadow var(--motion-base) var(--ease-emphasized),
      transform var(--motion-base) var(--ease-emphasized);
  }

  .jar:hover:not(:disabled) {
    border-color: var(--b-muted);
  }

  .jar:active:not(:disabled) {
    transform: translateY(1px);
  }

  /* In the cup: printed onto the accent, like the HUD tickets. */
  .jar[aria-pressed="true"] {
    background: var(--b-paper);
    border-color: var(--b-line);
    box-shadow: 3px 3px 0 var(--b-slab);
    transform: translate(-1px, -1px);
  }

  .jar:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .jar .hint {
    position: absolute;
    top: var(--space-1);
    right: var(--space-1);
  }

  @media (hover: none) and (pointer: coarse) {
    .hint {
      display: none;
    }
  }

  /* --- Phones --- */

  @media (max-width: 640px) {
    .counter {
      gap: var(--space-4);
      padding: calc(var(--hud-h) + var(--space-5)) var(--space-4) var(--space-6);
    }

    .tickets {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4) var(--space-3);
      min-height: 0;
    }

    .station {
      gap: var(--space-4);
    }

    .cup {
      min-width: 8rem;
    }

    .shelf-row {
      gap: var(--space-2);
    }

    .jar {
      min-height: 4rem;
      padding: var(--space-1-5) var(--space-1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ready-stamp,
    .cup-art.wobble,
    .feedback {
      animation: none;
    }

    .jar {
      transition: none;
    }
  }
</style>
