<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import {
    ICON_AUDIO_PAL,
    ICON_MUTE,
    ICON_PAUSE,
    ICON_PLAY,
    ICON_SPEAKER,
  } from "#lib/arcade/art.ts";
  import { getMuted, setMuted, sfxBlip } from "#lib/sfx.ts";

  export let paused = false;
  export let disabled = false;

  const dispatch = createEventDispatcher<{ pause: null }>();
  let pauseButton: HTMLButtonElement;
  let muted = false;

  onMount(() => {
    muted = getMuted();
  });

  function toggleMute() {
    muted = !muted;
    setMuted(muted);
    if (!muted) sfxBlip();
  }

  export function focusPause() {
    pauseButton?.focus();
  }

  // Space on these buttons is the game's (see isOnControl): it must not
  // also press the button, or a resumed game pauses on its first Space.
  // A button is pressed by Space on keyup, so both are held back.
  function keepSpace(event: KeyboardEvent) {
    if (event.key === " ") event.preventDefault();
  }
</script>

<span class="boba-hud-buttons">
  <button
    bind:this={pauseButton}
    type="button"
    class="boba-icon-btn"
    {disabled}
    on:keydown={keepSpace}
    on:keyup={keepSpace}
    on:click={() => dispatch("pause")}
    aria-label={paused ? "Resume game" : "Pause game"}
    title={paused ? "Resume (P)" : "Pause (P)"}
  >
    <PixelIcon grid={paused ? ICON_PLAY : ICON_PAUSE} palette={ICON_AUDIO_PAL} px={2} />
  </button>
  <button
    type="button"
    class="boba-icon-btn"
    on:keydown={keepSpace}
    on:keyup={keepSpace}
    on:click={toggleMute}
    aria-pressed={muted}
    aria-label="Mute game audio"
    title={muted ? "Unmute" : "Mute"}
  >
    <PixelIcon grid={muted ? ICON_MUTE : ICON_SPEAKER} palette={ICON_AUDIO_PAL} px={2} />
  </button>
</span>
