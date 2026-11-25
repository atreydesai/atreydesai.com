<script lang="ts">
  import { createEventDispatcher } from "svelte";

  /** One sentence the player needs while paused; most games need none. */
  export let deck = "";
  export let resumeLabel = "Resume";

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
  <div class="boba-card boba-riso boba-pause-card" tabindex="-1">
    <h2 id="boba-pause-title" class="boba-title">paused</h2>
    {#if deck}
      <p class="boba-deck">{deck}</p>
    {/if}
    <!-- Each key hint lives in the button it triggers, so it is said once. -->
    <div class="boba-actions is-start">
      <button
        bind:this={resumeButton}
        type="button"
        class="boba-btn"
        aria-keyshortcuts="P"
        on:click={() => dispatch("resume")}
      >
        {resumeLabel}
        <kbd aria-hidden="true">P</kbd>
      </button>
      <button type="button" class="boba-btn secondary" on:click={() => dispatch("menu")}>
        Menu
      </button>
      <button
        type="button"
        class="boba-btn secondary"
        aria-keyshortcuts="Escape"
        on:click={() => dispatch("exit")}
      >
        Exit
        <kbd aria-hidden="true">Esc</kbd>
      </button>
    </div>
  </div>
</div>
