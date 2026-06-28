<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { Disc3, VolumeOff } from "@jis3r/icons";
  import { Volume2 } from "lucide-svelte";

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

</script>

<footer class="layout-main w-full mt-20 pb-8">
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
        <button
          type="button"
          on:click={skipMusic}
          on:mouseenter={() => (hoveredMusic = true)}
          on:mouseleave={() => (hoveredMusic = false)}
          aria-pressed={isPlaying}
          aria-label={isPlaying ? "Skip song" : "Play music"}
          class="inline-flex items-center gap-2 font-[inherit] text-[length:inherit] lowercase text-inherit transition-all duration-300 hover:text-ink-700 dark:hover:text-cream-300 group"
        >
          <span
            class="inline-flex items-center transition-transform duration-300 group-hover:scale-110"
            class:animate-pulse={isPlaying}
          >
            <Disc3 size={14} animate={hoveredMusic} />
          </span>
          <span>music</span>
          <span class="inline-flex items-center transition-all duration-300">
            {#if isPlaying}
              <span in:fade={{ duration: 200 }} class="inline-flex">
                <Volume2 size={14} />
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
</footer>
