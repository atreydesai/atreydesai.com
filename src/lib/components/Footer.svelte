<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { AudioLines, Disc3, VolumeOff } from "@jis3r/icons";

  // DC Time with seconds
  let dcTime = "";

  onMount(() => {
    const updateTime = () => {
      const now = new Date();
      dcTime = now.toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  });

  $: buildDate = new Date(__BUILD_DATE__)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toLowerCase();

  // Music player
  let isPlaying = false;
  let hoveredMusic = false;
  let audioElement: HTMLAudioElement | null = null;
  let currentSampleIndex = -1;

  // The boba game has its own reactive soundtrack. Pause the site sampler when
  // a run opens so the two music systems never compete.
  onMount(() => {
    const pauseForBoba = () => {
      if (!audioElement || audioElement.paused) return;
      audioElement.pause();
      isPlaying = false;
    };
    window.addEventListener("boba-game-start", pauseForBoba);
    return () => window.removeEventListener("boba-game-start", pauseForBoba);
  });

  const musicSamples = [
    "/audio/CARLI%20-%20CARLI%20(offizielles%20Musikvideo)%20%5BnWhtnAyD7r8%5D.mp3",
    "/audio/Diverseddie%20%E8%88%B5%20-%20Procrastination%20%E6%8B%96%E5%BB%B6%E7%97%87%20%5Bqx0f0KfA_90%5D.mp3",
    "/audio/Everybody%20Talks%20-%20Neon%20Trees%20%5BswoVAisnOLo%5D.mp3",
    "/audio/NewJeans%20-%20Zero%20%5BAudio%5D%20%5BzeOm8-t42aQ%5D.mp3",
    "/audio/Seori%20(feat.%20eaJ)%20-%20Dive%20with%20you%20%5BColor%20Coded%20Lyrics%E2%A7%B8Han%E2%A7%B8Rom%E2%A7%B8Eng%5D%20%5BnoXlOoHEPXY%5D.mp3",
    "/audio/Two%20Door%20Cinema%20Club%20-%20What%20You%20Know%20%5B_Ys8gLkfW6M%5D.mp3",
  ];

  function getNextSampleIndex() {
    if (musicSamples.length <= 1) return 0;

    let nextIndex = currentSampleIndex;
    while (nextIndex === currentSampleIndex) {
      nextIndex = Math.floor(Math.random() * musicSamples.length);
    }
    return nextIndex;
  }

  function skipMusic() {
    const nextIndex = getNextSampleIndex();
    currentSampleIndex = nextIndex;

    if (!audioElement) {
      audioElement = new Audio(musicSamples[nextIndex]);
      audioElement.volume = 0.3;
      audioElement.loop = true;
    } else {
      audioElement.pause();
      audioElement.src = musicSamples[nextIndex];
      audioElement.currentTime = 0;
    }

    audioElement.play()
      .then(() => {
        isPlaying = true;
      })
      .catch(() => {
        isPlaying = false;
        console.log("Audio playback requires user interaction first");
      });
  }

  function toggleMusic() {
    if (audioElement && isPlaying) {
      audioElement.pause();
      isPlaying = false;
      return;
    }

    if (!audioElement) {
      skipMusic();
      return;
    }

    audioElement.play()
      .then(() => {
        isPlaying = true;
      })
      .catch(() => {
        isPlaying = false;
        console.log("Audio playback requires user interaction first");
      });
  }

</script>

<footer class="page-shell-standard w-full mt-4 pb-8">
  <div class="border-t border-ink-200 dark:border-ink-700 pt-6">
    <div
      class="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-y-4"
    >
      <!-- Left side - DC Time -->
      <div class="space-y-1 text-center font-mono text-xs lowercase text-ink-500 dark:text-ink-400 sm:text-left">
        <div class="tabular-nums">{dcTime.toLowerCase()}</div>
        <div>washington, dc</div>
      </div>

      <!-- Right side - Last updated + Music player -->
      <div class="flex flex-col items-center space-y-1 font-mono text-xs lowercase text-ink-500 dark:text-ink-400 sm:items-end">
        <div>
          updated {buildDate}
        </div>
        <div class="inline-flex items-center gap-2">
          <button
            type="button"
            on:click={skipMusic}
            on:mouseenter={() => (hoveredMusic = true)}
            on:mouseleave={() => (hoveredMusic = false)}
            aria-label={isPlaying ? "Skip song" : "Start music"}
            title={isPlaying ? "Skip song" : "Start music"}
            class="inline-flex items-center text-inherit transition-[color,transform] duration-300 hover:scale-110 hover:text-ink-700 dark:hover:text-cream-300"
            class:animate-pulse={isPlaying}
          >
            <Disc3 size={14} animate={hoveredMusic} />
          </button>
          <button
            type="button"
            on:click={toggleMusic}
            aria-pressed={isPlaying}
            aria-label={isPlaying ? "Pause music" : "Play music"}
            class="inline-flex items-center gap-2 font-[inherit] text-[length:inherit] lowercase text-inherit transition-colors duration-300 hover:text-ink-700 dark:hover:text-cream-300"
          >
            <span>music</span>
            <span class="inline-flex items-center">
              {#if isPlaying}
                <span in:fade={{ duration: 200 }} class="inline-flex">
                  <AudioLines size={14} />
                </span>
              {:else}
                <span in:fade={{ duration: 200 }} class="inline-flex">
                  <VolumeOff size={14} />
                </span>
              {/if}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</footer>
