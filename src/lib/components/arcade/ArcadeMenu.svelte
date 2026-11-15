<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import { GAMES, arcadeExpert, canPlay, openDemo, setExpert, type GameId } from "$lib/boba";
  import { MENU_ICONS } from "$lib/arcade/art";
  import { trapFocus } from "$lib/arcade/focus";
  import { readBest } from "$lib/arcade/scores";
  import { sfxBlip, unlockAudio } from "$lib/sfx";
  import Leaderboards from "./Leaderboards.svelte";

  const dispatch = createEventDispatcher<{ pick: GameId; close: null }>();

  /** A game that just failed to load, so the menu can say so. */
  export let failed: GameId | null = null;

  let card: HTMLElement;
  let view: "menu" | "boards" = "menu";
  let bests: Partial<Record<GameId, number>> = {};
  let playable: Partial<Record<GameId, boolean>> = {};

  $: expert = $arcadeExpert;
  $: mode = expert ? ("expert" as const) : ("normal" as const);
  // The prices on the board follow the switch.
  $: if (playable.catch !== undefined) refreshBests(mode);

  function refreshBests(which: "normal" | "expert") {
    bests = Object.fromEntries(GAMES.map((game) => [game.id, readBest(game.id, which)]));
  }

  function pick(id: GameId) {
    // Unlock audio inside the gesture, so the game's first sound can play.
    unlockAudio();
    sfxBlip();
    dispatch("pick", id);
  }

  function watch(id: GameId) {
    unlockAudio();
    sfxBlip();
    openDemo(id);
  }

  function toggleExpert(on = !expert) {
    if (on === expert) return;
    sfxBlip();
    setExpert(on);
  }

  async function showView(next: "menu" | "boards") {
    sfxBlip();
    view = next;
    await tick();
    card?.focus();
  }

  onMount(() => {
    playable = Object.fromEntries(GAMES.map((game) => [game.id, canPlay(game.id)]));
    void tick().then(() => card?.focus());

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        trapFocus(event, card);
        return;
      }
      if (event.target instanceof HTMLInputElement) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "e") {
        event.preventDefault();
        toggleExpert();
        return;
      }
      if (key === "l") {
        event.preventDefault();
        void showView(view === "boards" ? "menu" : "boards");
        return;
      }
      const game = GAMES.find((item) => item.key === event.key);
      if (game && playable[game.id]) {
        event.preventDefault();
        pick(game.id);
      }
    };
    // Escape on the boards goes back to the menu, not out of the arcade. It
    // listens in the capture phase so it is heard before the host's Escape.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || view !== "boards") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void showView("menu");
    };
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("keydown", onKey);
    };
  });
</script>

<!-- Clicking the scrim (outside the card) dismisses the menu; Esc and the
     Close button do the same for keyboard users. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="boba-scrim boba-ui"
  role="dialog"
  aria-modal="true"
  aria-labelledby="boba-menu-title"
  on:click={(event) => {
    if (event.target === event.currentTarget) dispatch("close");
  }}
>
  <div bind:this={card} class="boba-card boba-riso menu" class:is-wide={view === "boards"} tabindex="-1">
    <div class="masthead">
      <h2 id="boba-menu-title" class="boba-title">{view === "boards" ? "leaderboards" : "today’s menu"}</h2>

      <!-- One switch for every game. Expert runs are harder and go on their
           own boards; the boards view follows it too. -->
      <div class="mode" role="radiogroup" aria-label="Difficulty">
        <button
          type="button"
          role="radio"
          aria-checked={!expert}
          class="mode-option"
          on:click={() => toggleExpert(false)}
        >
          normal
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={expert}
          class="mode-option"
          aria-keyshortcuts="E"
          on:click={() => toggleExpert(true)}
        >
          expert
          <kbd class="key" aria-hidden="true">E</kbd>
        </button>
      </div>
    </div>

    {#if view === "boards"}
      <Leaderboards {mode} on:pick={(event) => pick(event.detail)} />
    {:else}
      <!-- Priced like a menu board: each game's best score sits where the
           price would be. -->
      <ol class="list">
        {#each GAMES as game (game.id)}
          <li class="entry">
            <button
              type="button"
              class="item"
              disabled={playable[game.id] === false}
              on:click={() => pick(game.id)}
            >
              <span class="icon" aria-hidden="true">
                <PixelIcon
                  grid={MENU_ICONS[game.id].grid}
                  palette={MENU_ICONS[game.id].palette}
                  px={3}
                />
              </span>
              <span class="text">
                <span class="line">
                  <span class="name">{game.name}</span>
                  <span class="best">
                    {bests[game.id] ? `best ${bests[game.id]}` : ""}
                  </span>
                </span>
                {#if playable[game.id] === false}
                  <span class="blurb">Needs a mouse, so it only opens on a computer.</span>
                {:else if failed === game.id}
                  <span class="blurb" role="alert">Couldn’t load just now. Try it again.</span>
                {/if}
              </span>
              <kbd class="key" aria-hidden="true">{game.key}</kbd>
            </button>
            {#if playable[game.id] !== false}
              <button type="button" class="demo" on:click={() => watch(game.id)}>
                demo<span class="sr-only"> of {game.name}</span>
              </button>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}

    <div class="boba-actions">
      {#if view === "boards"}
        <button type="button" class="boba-btn" on:click={() => showView("menu")}>
          Back to the menu
        </button>
      {:else}
        <button type="button" class="boba-btn" aria-keyshortcuts="L" on:click={() => showView("boards")}>
          Leaderboards
          <kbd aria-hidden="true">L</kbd>
        </button>
      {/if}
      <button type="button" class="boba-btn secondary" on:click={() => dispatch("close")}>
        Close
      </button>
    </div>
  </div>
</div>

<style>
  .menu {
    width: min(100%, 32rem);
  }

  .menu.is-wide {
    width: min(100%, 40rem);
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
  }

  .masthead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  /* Two labels on one strip, the chosen one inked in. */
  .mode {
    display: inline-flex;
    padding: 2px;
    border: 1px solid var(--b-rule);
    border-radius: var(--radius-control);
  }

  .mode-option {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1-5);
    min-height: 2rem;
    padding: 0 var(--space-3);
    color: var(--b-muted);
    background: transparent;
    border: 0;
    border-radius: calc(var(--radius-control) - 1px);
    cursor: pointer;
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1;
    touch-action: manipulation;
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      color var(--motion-fast) var(--ease-standard);
  }

  .mode-option:hover {
    color: var(--b-strong);
  }

  .mode-option[aria-checked="true"] {
    color: var(--b-paper);
    background: var(--b-strong);
  }

  .mode-option[aria-checked="true"] .key {
    color: var(--b-paper);
    background: transparent;
  }

  .entry {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .entry .item {
    flex: 1;
    min-width: 0;
  }

  .demo {
    flex: none;
    min-height: 2.5rem;
    padding: 0 var(--space-2);
    color: var(--b-muted);
    background: transparent;
    border: 0;
    border-radius: var(--radius-control);
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    font-style: italic;
    line-height: 1.25;
    touch-action: manipulation;
    transition: background-color var(--motion-fast) var(--ease-standard);
  }

  .demo:hover {
    color: var(--b-strong);
    background: var(--b-wash);
  }

  .list {
    margin: var(--space-4) 0 0;
    padding: 0;
    list-style: none;
    border-top: 1px dashed var(--b-rule);
  }

  .list li {
    border-bottom: 1px dashed var(--b-rule);
  }

  .item {
    display: grid;
    grid-template-columns: 2.25rem minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3) var(--space-2);
    color: inherit;
    background: transparent;
    border: 0;
    border-radius: var(--radius-control);
    cursor: pointer;
    font: inherit;
    text-align: left;
    touch-action: manipulation;
    transition: background-color var(--motion-fast) var(--ease-standard);
  }

  .item:hover:not(:disabled) {
    background: var(--b-wash);
  }

  .item:disabled {
    cursor: default;
    opacity: 0.55;
  }

  .icon {
    display: grid;
    place-items: center;
    color: var(--b-line);
    transition: transform var(--motion-base) var(--ease-emphasized);
  }

  .item:hover:not(:disabled) .icon {
    transform: rotate(-8deg) scale(1.08);
  }

  .text {
    display: grid;
    gap: var(--space-0-5);
    min-width: 0;
  }

  .line {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  /* The site's item-heading recipe (type-item-heading): NHG Text, regular. */
  .name {
    color: var(--b-strong);
    font-family: var(--font-ui);
    font-size: 1.125rem;
    font-weight: 400;
    line-height: 1.3;
    letter-spacing: -0.005em;
    white-space: nowrap;
  }

  .best {
    margin-left: auto;
    color: var(--b-muted);
    font-size: 0.75rem;
    line-height: 1.25;
    white-space: nowrap;
  }

  .blurb {
    color: var(--b-text);
    font-family: var(--font-ui);
    font-size: 0.875rem;
    font-style: italic;
    font-weight: 400;
    line-height: 1.43;
    text-wrap: pretty;
  }

  .key {
    padding: var(--space-0-5) var(--space-1-5);
    color: var(--b-strong);
    background: var(--b-wash);
    border-radius: var(--radius-control);
    font: inherit;
    font-size: 0.75rem;
    line-height: 1.25;
  }

  @media (hover: none) and (pointer: coarse) {
    .key {
      display: none;
    }

    .item {
      grid-template-columns: 2.25rem minmax(0, 1fr);
    }
  }

  @media (max-width: 400px) {
    .name {
      font-size: 1.0625rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .icon {
      transition: none;
    }

    .item:hover:not(:disabled) .icon {
      transform: none;
    }
  }
</style>
