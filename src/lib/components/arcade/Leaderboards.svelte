<script lang="ts">
  // Every game's board on one sheet: the top five of each, for the mode the
  // menu's switch is on, with a link from each into its game. Opened from the
  // menu's Leaderboards button; Back (or Escape) returns to the menu. A board
  // nobody has signed shows only its name.
  import { createEventDispatcher, onMount } from "svelte";

  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import { GAMES, canPlay, type GameId } from "#lib/boba.ts";
  import { MENU_ICONS } from "#lib/arcade/art.ts";
  import { fetchBoard, type ArcadeMode, type BoardEntry } from "#lib/arcade/scores.ts";

  export let mode: ArcadeMode;

  const dispatch = createEventDispatcher<{ pick: GameId }>();
  const SHOWN = 5;

  type Status = "loading" | "ready" | "offline";
  let boards: Partial<Record<GameId, { status: Status; scores: BoardEntry[] }>> = {};
  let playable: Partial<Record<GameId, boolean>> = {};
  let loadedMode: ArcadeMode | null = null;

  async function load(which: ArcadeMode) {
    loadedMode = which;
    boards = Object.fromEntries(GAMES.map((game) => [game.id, { status: "loading", scores: [] }]));
    await Promise.all(
      GAMES.map(async (game) => {
        const result = await fetchBoard(game.id, which);
        // The switch may have flipped while this was on its way.
        if (loadedMode !== which) return;
        boards = {
          ...boards,
          [game.id]: { status: result.available ? "ready" : "offline", scores: result.scores },
        };
      }),
    );
  }

  $: if (mode !== loadedMode) void load(mode);

  onMount(() => {
    playable = Object.fromEntries(GAMES.map((game) => [game.id, canPlay(game.id)]));
  });

  $: anyOffline = GAMES.every((game) => boards[game.id]?.status === "offline");
</script>

{#if anyOffline}
  <p class="boba-deck offline">The leaderboards are offline just now.</p>
{:else}
  <ol class="boards">
    {#each GAMES as game (game.id)}
      {@const board = boards[game.id]}
      <li class="board">
        <h3 class="head">
          <span class="icon" aria-hidden="true">
            <PixelIcon grid={MENU_ICONS[game.id].grid} palette={MENU_ICONS[game.id].palette} px={2} />
          </span>
          <span class="name">{game.name}</span>
          {#if playable[game.id] !== false}
            <button type="button" class="play" on:click={() => dispatch("pick", game.id)}>
              play<span class="sr-only"> {game.name}</span>
            </button>
          {/if}
        </h3>
        {#if board?.status === "ready" && board.scores.length}
          <ol class="rows">
            {#each board.scores.slice(0, SHOWN) as entry, index}
              <li class="row" class:first={index === 0}>
                <span class="rank">{index + 1}</span>
                <span class="who">{entry.name}</span>
                <span class="value">{entry.score.toLocaleString("en-US")}</span>
              </li>
            {/each}
          </ol>
        {:else if board?.status === "loading"}
          <p class="empty" aria-hidden="true">…</p>
        {/if}
      </li>
    {/each}
  </ol>
{/if}

<style>
  .offline {
    margin-top: var(--space-4);
  }

  .boards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-5) var(--space-6);
    margin: var(--space-4) 0 0;
    padding: var(--space-4) 0 0;
    list-style: none;
    border-top: 1px dashed var(--b-rule);
  }

  .board {
    min-width: 0;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-1-5);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 1.25rem;
    flex: none;
  }

  .name {
    flex: 1;
    min-width: 0;
    color: var(--b-strong);
    font-family: var(--font-ui);
    font-size: 0.9375rem;
    font-weight: 400;
    line-height: 1.3;
    white-space: nowrap;
  }

  .play {
    padding: var(--space-0-5) var(--space-1-5);
    color: var(--b-muted);
    background: transparent;
    border: 0;
    border-radius: var(--radius-control);
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    font-style: italic;
    line-height: 1.25;
    transition: background-color var(--motion-fast) var(--ease-standard);
  }

  .play:hover {
    color: var(--b-strong);
    background: var(--b-wash);
  }

  .rows {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 1.5rem;
    padding: 0 var(--space-1);
    font-size: 0.75rem;
    line-height: 1.25;
  }

  .row.first .who,
  .row.first .value {
    color: var(--b-accent);
  }

  .rank {
    width: 1.25em;
    flex: none;
    color: var(--b-muted);
    text-align: right;
  }

  .who {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--b-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value {
    color: var(--b-strong);
    font-variant-numeric: tabular-nums lining-nums;
    font-weight: 500;
  }

  .empty {
    margin: 0;
    padding: 0 var(--space-1);
    color: var(--b-muted);
    font-size: 0.75rem;
    font-style: italic;
    line-height: 1.5;
  }

  @media (max-width: 520px) {
    .boards {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
