<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  import type { GameId } from "$lib/boba";
  import { LOOPS } from "$lib/arcade/art";
  import { fetchBoard, submitScore, type BoardEntry } from "$lib/arcade/scores";
  import { cleanName, MAX_NAME } from "$lib/profanity";

  export let game: GameId;
  export let title: string;
  export let deck: string;
  export let score: number;
  export let unit = "points";
  export let newBest = false;
  export let stats: Array<{ label: string; value: string | number }> = [];

  const dispatch = createEventDispatcher<{ restart: null; menu: null; exit: null }>();

  let card: HTMLElement;
  let boardLoading = true;
  let boardAvailable = false;
  let board: BoardEntry[] = [];
  let playerName = "";
  let nameError = "";
  let submitting = false;
  let submitted = false;

  export function focus() {
    card?.focus();
  }

  // The last name signed on any board is offered again, so a regular
  // doesn't retype it after every run. It lives on this device only.
  const NAME_KEY = "boba_player_name_v1";

  function readName() {
    try {
      return localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      return "";
    }
  }

  function saveName(name: string) {
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // Storage can be off; the field just starts empty next time.
    }
  }

  onMount(async () => {
    playerName = readName();
    const result = await fetchBoard(game);
    boardAvailable = result.available;
    board = result.scores;
    boardLoading = false;
  });

  function onNameInput() {
    nameError = "";
  }

  async function submit() {
    const checked = cleanName(playerName);
    if (!checked.ok || !checked.value) {
      nameError = checked.reason ?? "invalid name";
      return;
    }

    nameError = "";
    submitting = true;
    const result = await submitScore(game, checked.value, score);
    submitting = false;
    if (!result.ok) {
      nameError = result.reason;
      return;
    }

    let marked = false;
    board = result.scores.map((entry) => {
      const me = !marked && entry.name === checked.value && entry.score === score;
      if (me) marked = true;
      return { ...entry, me };
    });
    saveName(checked.value);
    submitted = true;
  }
</script>

<div class="boba-scrim boba-over boba-ui">
  <div
    bind:this={card}
    class="boba-card boba-riso boba-over-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="boba-over-title"
    tabindex="-1"
  >
    <!-- The score on the left; the run's stats print beside it like a
         receipt: labels, dot leaders, figures, one to a row. -->
    <div class="top">
      <div class="score">
        <h2 id="boba-over-title" class="boba-title">{title}</h2>
        <p class="boba-deck">{deck}</p>

        <div class="final">
          <span class="circle">
            <svg viewBox="0 0 44 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path pathLength="1" d={LOOPS[1]} />
            </svg>
            <strong>{score}</strong>
            {#if newBest}
              <span class="stamp">new best</span>
            {/if}
          </span>
          <span class="boba-meta">{unit}</span>
        </div>
      </div>

      {#if stats.length}
        <dl class="receipt">
          {#each stats as stat}
            <div>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          {/each}
        </dl>
      {/if}
    </div>

    <div class="lower">
      {#if !boardLoading && boardAvailable && board.length > 0}
        <section class="board" aria-labelledby="boba-board-title">
          <h3 id="boba-board-title" class="label">the regulars</h3>
          <ol>
            {#each board.slice(0, 6) as entry, index}
              <li class="row" class:me={entry.me}>
                <span class="rank">{index + 1}</span>
                <span class="name">{entry.name}</span>
                {#if entry.me}<span class="you">you</span>{/if}
                <span class="value">{entry.score}</span>
              </li>
            {/each}
          </ol>
        </section>
      {/if}

      {#if score > 0 && boardAvailable && !submitted}
        <div class="sign">
          <label class="label" for="boba-player-name">sign the board</label>
          <form class="form" on:submit|preventDefault={submit}>
            <input
              id="boba-player-name"
              class="field"
              bind:value={playerName}
              on:input={onNameInput}
              placeholder="Your name"
              maxlength={MAX_NAME}
              spellcheck="false"
              autocomplete="nickname"
              aria-invalid={nameError ? "true" : undefined}
              aria-describedby={nameError ? "boba-name-error" : undefined}
            />
            <button type="submit" class="boba-btn" disabled={submitting}>
              {submitting ? "Saving…" : "Submit"}
            </button>
          </form>
          {#if nameError}
            <p id="boba-name-error" class="error" role="alert">
              <span aria-hidden="true">✕</span>
              {nameError}
            </p>
          {/if}
        </div>
      {/if}
    </div>

    <div class="boba-actions">
      <button type="button" class="boba-btn" on:click={() => dispatch("restart")}>
        Play again
      </button>
      <button type="button" class="boba-btn secondary" on:click={() => dispatch("menu")}>
        Menu
      </button>
      <button type="button" class="boba-btn secondary" on:click={() => dispatch("exit")}>
        Exit
      </button>
    </div>
  </div>
</div>

<style>
  /* The card is the container: the top block goes two-up only when the
     card itself is wide enough, whatever the viewport. */
  .boba-over-card {
    width: min(100%, 36rem);
    container-type: inline-size;
  }

  /* Score block on the left, the receipt beside it, centred against it. */
  .top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(10.5rem, 12rem);
    align-items: center;
    gap: var(--space-6);
  }

  .score {
    min-width: 0;
  }

  .score:only-child {
    grid-column: 1 / -1;
  }

  .final {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin-top: var(--space-6);
  }

  /* A rubber stamp, pressed a little crooked across the top of the circled
     score, over the pen loop but clear of the figures. */
  .stamp {
    position: absolute;
    top: 0;
    left: 50%;
    z-index: 1;
    background: var(--b-paper);
    padding: var(--space-1) var(--space-2-5);
    color: var(--b-accent);
    border: 2px solid currentColor;
    border-radius: 4px 10px 6px 12px;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    line-height: 1.25;
    text-transform: uppercase;
    white-space: nowrap;
    transform: translate(-50%, -70%) rotate(-6deg);
    filter: url(#boba-rough-fine);
    animation: stamp 380ms var(--ease-emphasized) 350ms both;
  }

  @keyframes stamp {
    from {
      opacity: 0;
      transform: translate(-50%, -70%) rotate(-12deg) scale(1.8);
    }
  }

  .circle {
    position: relative;
    display: inline-grid;
    place-items: center;
    min-width: 6.5rem;
    padding: var(--space-3) var(--space-6);
  }

  .circle svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: url(#boba-rough-loop);
  }

  .circle path {
    fill: none;
    stroke: var(--b-slab);
    stroke-width: 0.6;
    stroke-linecap: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: boba-draw 700ms var(--ease-standard) 250ms forwards;
  }

  .final strong {
    position: relative;
    color: var(--b-strong);
    font-family: var(--font-display);
    font-size: clamp(3.25rem, 2.25rem + 4vw, 4.5rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 0.9;
  }

  /* The run's stats, one to a row, like a receipt. */
  .receipt {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-4) 0;
    border-block: 1px dashed var(--b-rule);
    font-size: 0.75rem;
    line-height: 1.333;
  }

  .receipt div {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .receipt dt {
    display: flex;
    flex: 1;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
    color: var(--b-muted);
    white-space: nowrap;
  }

  .receipt dt::after {
    content: "";
    flex: 1;
    min-width: var(--space-4);
    border-bottom: 1px dotted var(--b-muted);
    opacity: 0.6;
  }

  .receipt dd {
    margin: 0;
    color: var(--b-strong);
    font-weight: 500;
    white-space: nowrap;
  }

  .lower {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-8);
    margin-top: var(--space-6);
  }

  .label {
    display: block;
    margin: 0 0 var(--space-2);
    color: var(--b-strong);
    font-family: var(--font-ui);
    font-size: 0.875rem;
    font-style: italic;
    font-weight: 400;
    line-height: 1.333;
  }

  .board ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 1.75rem;
    padding: var(--space-1) var(--space-1-5);
    border-radius: var(--radius-control);
    font-size: 0.75rem;
    line-height: 1.25;
  }

  .row.me {
    background: var(--b-mine);
  }

  .rank {
    width: 1.5em;
    flex: none;
    color: var(--b-muted);
    text-align: right;
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .you {
    color: var(--b-accent);
  }

  .value {
    color: var(--b-strong);
    font-weight: 500;
  }

  .form {
    display: flex;
    gap: var(--space-2);
  }

  .field {
    flex: 1;
    min-width: 0;
    min-height: 2.5rem;
    padding: 0 var(--space-3);
    color: var(--b-strong);
    background: var(--b-raised);
    border: 1px solid var(--b-rule);
    border-radius: var(--radius-control);
    font: inherit;
    /* 1rem stops iOS zooming the page when the field takes focus. */
    font-size: 1rem;
    line-height: 1.333;
    transition: border-color var(--motion-fast) var(--ease-standard);
  }

  @media (hover: hover) and (pointer: fine) {
    .field {
      font-size: 0.75rem;
    }
  }

  .field:hover,
  .field:focus-visible {
    border-color: var(--b-muted);
  }

  .field::placeholder {
    color: var(--b-muted);
  }

  .error {
    display: flex;
    gap: var(--space-1-5);
    margin: var(--space-2) 0 0;
    color: var(--b-accent);
    font-size: 0.75rem;
    line-height: 1.333;
  }

  /* A narrow card (phones) stacks: score block, then the receipt. */
  @container (max-width: 30rem) {
    .top {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-5);
    }

    .lower {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-6);
    }
  }

  @media (max-height: 690px) {
    .boba-over {
      place-items: start center;
    }

    .boba-over-card {
      padding-block: var(--space-6);
    }

    .final {
      margin-top: var(--space-5);
    }

    .lower {
      margin-top: var(--space-5);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stamp {
      animation: none;
    }

    .circle path {
      stroke-dashoffset: 0;
      animation: none;
    }
  }
</style>
