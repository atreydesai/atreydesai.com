<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  import PixelIcon from "$lib/components/PixelIcon.svelte";
  import {
    ICON_AUDIO_PAL,
    ICON_MUTE,
    ICON_PAUSE,
    ICON_PLAY,
    ICON_SPEAKER,
  } from "$lib/arcade/art";
  import { getMuted, setMuted, sfxBlip } from "$lib/sfx";

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
</script>

<span class="boba-hud-buttons">
  <button
    bind:this={pauseButton}
    type="button"
    class="boba-icon-btn"
    {disabled}
    on:click={() => dispatch("pause")}
    aria-label={paused ? "Resume game" : "Pause game"}
    title={paused ? "Resume (P)" : "Pause (P)"}
  >
    <PixelIcon grid={paused ? ICON_PLAY : ICON_PAUSE} palette={ICON_AUDIO_PAL} px={2} />
  </button>
  <button
    type="button"
    class="boba-icon-btn"
    on:click={toggleMute}
    aria-pressed={muted}
    aria-label="Mute game audio"
    title={muted ? "Unmute" : "Mute"}
  >
    <PixelIcon grid={muted ? ICON_MUTE : ICON_SPEAKER} palette={ICON_AUDIO_PAL} px={2} />
  </button>
</span>
