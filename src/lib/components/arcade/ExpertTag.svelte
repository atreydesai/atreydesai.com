<script lang="ts">
  // Says "expert" on a game's score ticket when the run is in expert mode, so
  // the player always knows which board the score is going to. Nothing in
  // normal mode. Read once: the switch lives on the menu, not in a game.
  import { get } from "svelte/store";
  import { arcadeExpert } from "#lib/boba.ts";

  const expert = get(arcadeExpert);
</script>

{#if expert}
  <span class="boba-meta expert">expert</span>
{/if}

<style>
  .expert {
    color: var(--b-accent);
    font-style: italic;
  }
</style>
