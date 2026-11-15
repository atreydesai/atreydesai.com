<script lang="ts">
  // The strip a game shows while its demo plays: the word demo, one caption
  // saying what is happening (the game's script sets it), and the way out.
  // While it plays, Play stops the demo and starts a real run. When the demo
  // has finished, the strip says so and offers it again.
  //
  // The game plays itself underneath on its real rules, scores nothing, and
  // shuts out the player's own game keys; Enter and Space reach the focused
  // button here. `placement` keeps the strip clear of a game's own controls.
  import { createEventDispatcher, onMount, tick } from "svelte";

  export let caption = "";
  /** The script has run out: offer it again beside Play. */
  export let ended = false;
  export let placement: "bottom" | "top" = "bottom";

  const dispatch = createEventDispatcher<{ play: null; again: null }>();
  let playButton: HTMLButtonElement;

  export function focus() {
    playButton?.focus();
  }

  onMount(() => {
    void tick().then(() => playButton?.focus());
  });
</script>

<div class="demo boba-ui" class:is-top={placement === "top"} role="region" aria-label="Demo">
  <div class="boba-riso is-small strip">
    <span class="boba-phase label">demo</span>
    <p class="caption" aria-live="polite">{ended ? "That’s the idea. Your turn." : caption}</p>
    <div class="buttons">
      {#if ended}
        <button type="button" class="boba-btn secondary" on:click={() => dispatch("again")}>
          Watch again
        </button>
      {/if}
      <button bind:this={playButton} type="button" class="boba-btn" on:click={() => dispatch("play")}>
        Play
      </button>
    </div>
  </div>
</div>

<style>
  .demo {
    position: fixed;
    left: 50%;
    bottom: max(var(--space-6), env(safe-area-inset-bottom));
    z-index: calc(var(--layer-overlay) + 4);
    width: min(calc(100% - 2rem), 34rem);
    transform: translateX(-50%);
    pointer-events: none;
  }

  .demo.is-top {
    top: 5.5rem;
    bottom: auto;
  }

  .strip {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    /* The sheet's own rough paper (.boba-riso::after) is the background, so
       the strip's edge is the drawn outline, never a square box. */
    pointer-events: auto;
  }

  .label {
    flex: none;
  }

  .caption {
    flex: 1;
    min-width: 0;
    margin: 0;
    color: var(--b-strong);
    font-size: 0.875rem;
    line-height: 1.35;
    text-wrap: pretty;
  }

  .buttons {
    display: flex;
    flex: none;
    gap: var(--space-2);
  }

  @media (max-width: 480px) {
    .strip {
      flex-wrap: wrap;
      padding: var(--space-3);
    }

    .caption {
      flex-basis: calc(100% - 4rem);
    }

    .buttons {
      width: 100%;
      justify-content: flex-end;
    }
  }
</style>
