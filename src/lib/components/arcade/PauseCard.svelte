<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let deck = "The pearls will wait. They’re patient like that.";
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
  <div class="boba-card boba-riso boba-pause-card" tabindex="-1" style="--tilt: -1.6deg">
    <h2 id="boba-pause-title" class="boba-title">paused</h2>
    <p class="boba-deck">{deck}</p>
    <div class="boba-actions is-start">
      <button
        bind:this={resumeButton}
        type="button"
        class="boba-btn"
        on:click={() => dispatch("resume")}
      >
        {resumeLabel}
      </button>
      <button type="button" class="boba-btn secondary" on:click={() => dispatch("menu")}>
        Menu
      </button>
      <button type="button" class="boba-btn secondary" on:click={() => dispatch("exit")}>
        Exit
      </button>
    </div>
    <p class="boba-keys boba-keys-row"><kbd>P</kbd> resume <kbd>Esc</kbd> quit</p>
  </div>
</div>
