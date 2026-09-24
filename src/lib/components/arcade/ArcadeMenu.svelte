<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import { GAMES, canPlay, type GameId } from "$lib/boba";
  import { MENU_ICONS } from "$lib/arcade/art";
  import { trapFocus } from "$lib/arcade/focus";
  import { readBest } from "$lib/arcade/scores";
  import { sfxBlip, unlockAudio } from "$lib/sfx";

  const dispatch = createEventDispatcher<{ pick: GameId; close: null }>();

  let card: HTMLElement;
  let bests: Partial<Record<GameId, number>> = {};
  let playable: Partial<Record<GameId, boolean>> = {};

  function pick(id: GameId) {
    // Unlock audio inside the gesture, so the game's first sound can play.
    unlockAudio();
    sfxBlip();
    dispatch("pick", id);
  }

  onMount(() => {
    bests = Object.fromEntries(GAMES.map((game) => [game.id, readBest(game.id)]));
    playable = Object.fromEntries(GAMES.map((game) => [game.id, canPlay(game.id)]));
    void tick().then(() => card?.focus());

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        trapFocus(event, card);
        return;
      }
      const game = GAMES.find((item) => item.key === event.key);
      if (game && playable[game.id]) {
        event.preventDefault();
        pick(game.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<div class="boba-scrim boba-ui" role="dialog" aria-modal="true" aria-labelledby="boba-menu-title">
  <div bind:this={card} class="boba-card boba-riso menu" tabindex="-1" style="--tilt: -1deg">
    <h2 id="boba-menu-title" class="boba-title">today’s menu</h2>
    <p class="boba-deck">Four small games about boba. Pick your poison.</p>

    <!-- Priced like a menu board: each game's best score sits where the
         price would be. -->
    <ol class="list">
      {#each GAMES as game (game.id)}
        <li>
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
                <span class="leader" aria-hidden="true"></span>
                <span class="best">
                  {bests[game.id] ? `best ${bests[game.id]}` : "not played yet"}
                </span>
              </span>
              <span class="blurb">
                {playable[game.id] === false
                  ? "Needs a mouse, so it only opens on a computer."
                  : game.blurb}
              </span>
            </span>
            <kbd class="key" aria-hidden="true">{game.key}</kbd>
          </button>
        </li>
      {/each}
    </ol>

    <div class="boba-actions">
      <button type="button" class="boba-btn secondary" on:click={() => dispatch("close")}>
        Close
      </button>
    </div>
    <p class="boba-keys boba-keys-row"><kbd>1</kbd>–<kbd>4</kbd> pick <kbd>Esc</kbd> close</p>
  </div>
</div>

<style>
  .menu {
    width: min(100%, 32rem);
  }

  .list {
    margin: var(--space-6) 0 0;
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

  .name {
    color: var(--b-strong);
    font-family: var(--font-prose);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.375;
    white-space: nowrap;
  }

  .leader {
    flex: 1;
    min-width: var(--space-4);
    border-bottom: 1px dotted var(--b-muted);
    opacity: 0.6;
  }

  .best {
    color: var(--b-muted);
    font-size: 0.75rem;
    line-height: 1.25;
    white-space: nowrap;
  }

  .blurb {
    color: var(--b-text);
    font-family: var(--font-prose);
    font-size: 0.95rem;
    font-style: italic;
    line-height: 1.47;
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
