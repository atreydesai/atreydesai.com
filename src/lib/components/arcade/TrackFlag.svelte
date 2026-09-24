<script lang="ts">
  import { onMount } from "svelte";

  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import WavingFlag from "$lib/components/WavingFlag.svelte";
  import { ICON_NOTE, NOTE_PAL } from "$lib/arcade/art";
  import { onSongChange } from "$lib/sfx";

  let currentSong = "";

  onMount(() => onSongChange((name) => (currentSong = name)));
</script>

<span class="boba-track" aria-label={`Now playing ${currentSong || "nothing yet"}`}>
  <span class="note" aria-hidden="true">
    <PixelIcon grid={ICON_NOTE} palette={NOTE_PAL} px={2} />
  </span>
  <span class="flag">
    {#if currentSong}
      <WavingFlag text={currentSong} />
    {:else}
      <span class="placeholder">tuning the radio…</span>
    {/if}
  </span>
</span>

<style>
  .boba-track {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1-5);
    width: 12rem;
    height: 2rem;
    overflow: hidden;
  }

  .note {
    display: grid;
    flex: none;
    place-items: center;
  }

  .flag {
    display: flex;
    align-items: center;
    min-width: 0;
    height: 2rem;
    overflow: hidden;
  }

  .placeholder {
    color: var(--b-muted);
    font-family: var(--font-prose);
    font-size: 0.95rem;
    font-style: italic;
    white-space: nowrap;
  }

  /* The flag is the first thing to go when the HUD gets crowded. */
  @media (max-width: 1100px) {
    .boba-track {
      display: none;
    }
  }
</style>
