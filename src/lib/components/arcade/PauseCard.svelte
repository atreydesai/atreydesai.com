<script lang="ts">
  import { createEventDispatcher } from "svelte";

  /** One sentence the player needs while paused; most games need none. */
  export let deck = "";
  export let resumeLabel = "Resume";
  export let menuLabel = "Menu";
  export let pixel = false;

  const dispatch = createEventDispatcher<{ resume: null; menu: null; exit: null }>();
  let resumeButton: HTMLButtonElement;

  export function focus() {
    resumeButton?.focus();
  }
</script>

<div
  class="boba-scrim boba-ui"
  role="dialog"
  aria-modal="true"
  aria-labelledby="boba-pause-title"
>
  <div class="boba-card boba-pause-card" class:boba-riso={!pixel} class:order-pixel-sheet={pixel} tabindex="-1">
    <h2 id="boba-pause-title" class="boba-title">paused</h2>
    {#if deck}
      <p class="boba-deck">{deck}</p>
    {/if}
    <!-- Each key hint lives in the button it triggers, so it is said once. -->
    <div class="boba-actions is-start">
      <button
        bind:this={resumeButton}
        type="button"
        class={pixel ? "boba-key is-primary" : "boba-btn"}
        aria-keyshortcuts="P"
        on:click={() => dispatch("resume")}
      >
        {resumeLabel}
        <kbd aria-hidden="true">P</kbd>
      </button>
      <button type="button" class={pixel ? "boba-key order-pixel-paper-key" : "boba-btn secondary"} on:click={() => dispatch("menu")}>
        {menuLabel}
      </button>
      <button
        type="button"
        class={pixel ? "boba-key order-pixel-paper-key" : "boba-btn secondary"}
        aria-keyshortcuts="Escape"
        on:click={() => dispatch("exit")}
      >
        Exit
        <kbd aria-hidden="true">Esc</kbd>
      </button>
    </div>
  </div>
</div>

<style>
  .boba-pause-card.order-pixel-sheet .boba-key { min-height: 44px; }
</style>
