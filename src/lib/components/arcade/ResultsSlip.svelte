<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";

  import { GAMES, type GameId } from "#lib/boba.ts";
  import { LOOPS } from "#lib/arcade/art.ts";
  import { currentMode, fetchBoard, readPlayerName, savePlayerName, submitScore, syncBests, type BoardEntry } from "#lib/arcade/scores.ts";
  import {
    canCopyImage,
    canShareFile,
    copyImage,
    copyText,
    shareFile,
    shareText,
    type ShareInput,
    type ShareOutcome,
  } from "#lib/arcade/share.ts";
  import { renderShareCard } from "#lib/arcade/share-card.ts";
  import { cleanName, MAX_NAME } from "#lib/profanity.ts";

  export let game: GameId;
  export let title: string;
  export let deck: string;
  export let score: number;
  export let unit = "points";
  export let newBest = false;
  /** The board holds a higher best for this device's name than this run: no stamp. */
  let beatenOnBoard = false;
  $: stamped = newBest && !beatenOnBoard;
  export let stats: Array<{ label: string; value: string | number }> = [];
  /**
   * The run as a few short lines of emoji for the share text and card, the
   * way a word game shares its grid: what happened, at a glance. Each game
   * builds its own; empty shares the words alone.
   */
  export let share: string[] = [];

  const mode = currentMode();
  const expert = mode === "expert";
  const gameName = GAMES.find((item) => item.id === game)?.name ?? game;

  // Share opens a panel in place of the board: the card as it will look,
  // and a way to send it as an image (copied, or the share sheet on a
  // phone) or as text. The card is drawn as soon as the slip opens, so a
  // copy can start inside the click (Safari refuses one that starts later).
  $: shareInput = {
    gameId: game,
    game: gameName,
    expert,
    score,
    unit,
    newBest: stamped,
    stats,
    lines: share,
  } satisfies ShareInput;

  let sharing = false;
  let cardPng: Promise<Blob> | null = null;
  let cardUrl = "";
  let cardFile: File | null = null;
  let drawnKey = "";
  let imageCopy = false;
  let firstShareButton: HTMLButtonElement;

  $: drawCard(shareInput);
  $: phoneShare = canShareFile(cardFile);

  function drawCard(input: ShareInput) {
    if (typeof window === "undefined") return;
    const key = JSON.stringify(input);
    if (key === drawnKey) return;
    drawnKey = key;
    const png = renderShareCard(input);
    cardPng = png;
    png
      .then((blob) => {
        if (cardPng !== png) return;
        if (cardUrl) URL.revokeObjectURL(cardUrl);
        cardUrl = URL.createObjectURL(blob);
        cardFile = new File([blob], `boba-${game}-${score}.png`, { type: "image/png" });
      })
      .catch(() => {
        // No card: the text still shares.
        if (cardPng === png) cardPng = null;
      });
  }

  onDestroy(() => {
    if (cardUrl) URL.revokeObjectURL(cardUrl);
  });

  async function toggleShare() {
    sharing = !sharing;
    if (!sharing) return;
    await tick();
    firstShareButton?.focus();
  }

  // What a button just did stands in its label for a moment.
  let imageState: ShareOutcome = "";
  let textState: ShareOutcome = "";
  let stateTimer: ReturnType<typeof setTimeout> | null = null;

  function report(which: "image" | "text", outcome: ShareOutcome) {
    imageState = which === "image" ? outcome : "";
    textState = which === "text" ? outcome : "";
    if (stateTimer) clearTimeout(stateTimer);
    stateTimer = setTimeout(() => (imageState = textState = ""), 2200);
  }

  function onCopyImage() {
    if (!cardPng) return;
    // No await before the copy starts: see the note above.
    void copyImage(cardPng).then((outcome) => report("image", outcome));
  }

  function onShareImage() {
    if (!cardFile) return;
    void shareFile(cardFile, shareText(shareInput)).then((outcome) => report("image", outcome));
  }

  function onCopyText() {
    void copyText(shareText(shareInput)).then((outcome) => report("text", outcome));
  }

  function said(outcome: ShareOutcome, idle: string) {
    if (outcome === "copied") return "Copied";
    if (outcome === "shared") return "Shared";
    if (outcome === "failed") return "Couldn’t copy";
    return idle;
  }

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

  onMount(async () => {
    imageCopy = canCopyImage();
    // The last name signed on this device is offered again.
    playerName = readPlayerName();
    const result = await fetchBoard(game, mode);
    boardAvailable = result.available;
    board = result.scores;
    boardLoading = false;
    // The board is the record: a best it holds above this run means this run wasn't one.
    if (result.mine !== null && result.mine > score) beatenOnBoard = true;
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
    const result = await submitScore(game, checked.value, score, mode);
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
    savePlayerName(checked.value);
    // Signing is also how a device that lost its bests gets them back, for every game.
    void syncBests(mode);
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
            {#if stamped}
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

    {#if sharing}
      <!-- The card as it will be sent, then the ways to send it. -->
      <section id="boba-share-panel" class="share-panel" aria-label="Share this run">
        <div class="preview">
          {#if cardUrl}
            <img
              src={cardUrl}
              alt={`Share card: ${gameName}${expert ? ", expert" : ""}, ${score} ${unit}`}
              width="1200"
              height="800"
            />
          {/if}
        </div>
        <div class="share-buttons">
          {#if phoneShare}
            <button
              bind:this={firstShareButton}
              type="button"
              class="boba-btn secondary"
              disabled={!cardFile}
              on:click={onShareImage}
            >
              {said(imageState, "Share image")}
            </button>
          {:else if imageCopy && cardPng}
            <button
              bind:this={firstShareButton}
              type="button"
              class="boba-btn secondary"
              on:click={onCopyImage}
            >
              {said(imageState, "Copy image")}
            </button>
          {/if}
          <button type="button" class="boba-btn secondary" on:click={onCopyText}>
            {said(textState, "Copy text")}
          </button>
        </div>
      </section>
    {:else}
    <div class="lower">
      {#if !boardLoading && boardAvailable && board.length > 0}
        <section class="board" aria-labelledby="boba-board-title">
          <h3 id="boba-board-title" class="label">{expert ? "the expert regulars" : "the regulars"}</h3>
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
    {/if}

    <p class="sr-only" aria-live="polite">
      {imageState === "copied"
        ? "The image is copied."
        : textState === "copied"
          ? "The text is copied."
          : imageState === "failed" || textState === "failed"
            ? "Copying failed."
            : ""}
    </p>

    <div class="boba-actions">
      <button type="button" class="boba-btn" on:click={() => dispatch("restart")}>
        Play again
      </button>
      <button
        type="button"
        class="boba-btn secondary"
        aria-expanded={sharing}
        aria-controls="boba-share-panel"
        on:click={toggleShare}
      >
        {sharing ? "Board" : "Share"}
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

  /* The share panel stands where the board was: the card, then its buttons
     beside it on a wide slip and under it on a narrow one. */
  .share-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-5);
    margin-top: var(--space-6);
  }

  .preview {
    aspect-ratio: 3 / 2;
    overflow: hidden;
    background: var(--b-wash);
    border-radius: var(--radius-control);
  }

  .preview img {
    display: block;
    width: 100%;
    height: auto;
  }

  .share-buttons {
    display: grid;
    gap: var(--space-3);
  }

  /* Each holds its width while its label swaps to "Copied". */
  .share-buttons .boba-btn {
    min-width: 8.5rem;
    white-space: nowrap;
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

    .share-panel {
      grid-template-columns: minmax(0, 1fr);
    }

    .share-buttons {
      grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
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
