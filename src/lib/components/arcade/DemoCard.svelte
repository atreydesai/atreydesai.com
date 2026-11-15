<script lang="ts">
  // The first time a game opens on this device, it asks whether to watch its
  // demo before the first run. Two buttons, the demo first; Enter or Space
  // takes the focused one. The game holds its countdown until it is answered
  // and ignores its own keys while the card is up.
  import { createEventDispatcher, onMount, tick } from "svelte";

  export let deck = "Watch it play itself for a few seconds, or go straight in.";

  const dispatch = createEventDispatcher<{ watch: null; play: null }>();
  let watchButton: HTMLButtonElement;

  export function focus() {
    watchButton?.focus();
  }

  onMount(() => {
    void tick().then(() => watchButton?.focus());
  });
</script>

<div class="boba-scrim boba-ui" role="dialog" aria-modal="true" aria-labelledby="boba-demo-title">
  <div class="boba-card boba-riso boba-pause-card" tabindex="-1">
    <h2 id="boba-demo-title" class="boba-title">first time here?</h2>
    <p class="boba-deck">{deck}</p>
    <div class="boba-actions is-start">
      <button bind:this={watchButton} type="button" class="boba-btn" on:click={() => dispatch("watch")}>
        Watch the demo
      </button>
      <button type="button" class="boba-btn secondary" on:click={() => dispatch("play")}>
        Play
      </button>
    </div>
  </div>
</div>
