<script lang="ts">
  import { onMount } from "svelte";

  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import WavingFlag from "#lib/components/WavingFlag.svelte";
  import { ICON_NOTE, NOTE_PAL } from "#lib/arcade/art.ts";
  import { onSongChange } from "#lib/sfx.ts";

  let currentSong = "";

  onMount(() => onSongChange((name) => (currentSong = name)));
</script>

<!-- Shown only once a song is playing: before that there is nothing to say. -->
{#if currentSong}
  <span class="boba-track" aria-label={`Now playing ${currentSong}`}>
    <span class="note" aria-hidden="true">
      <PixelIcon grid={ICON_NOTE} palette={NOTE_PAL} px={2} />
    </span>
    <span class="flag">
      <WavingFlag text={currentSong} />
    </span>
  </span>
{/if}

<style>
  /* The box hugs what is drawn in it (the flag's canvas sets its own CSS
     width from the measured song name), so the
     ticket's ordinary gap follows it whatever the song. Long names are
     capped and cut at the free end of the flag. */
  .boba-track {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1-5);
    width: max-content;
    max-width: 12rem;
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

  /* The flag is the first thing to go when the HUD gets crowded. */
  @media (max-width: 1100px) {
    .boba-track {
      display: none;
    }
  }
</style>
