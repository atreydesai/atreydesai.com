<script lang="ts">
  import { onMount } from "svelte";
  import { fly, fade } from "svelte/transition";
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

  // Music player
  let isPlaying = false;
  let audioElement: HTMLAudioElement | null = null;

  const musicSamples = [
    "/audio/sample1.mp3",
    "/audio/sample2.mp3",
    "/audio/sample3.mp3",
  ];

  function toggleMusic() {
    if (!audioElement) {
      const randomSample =
        musicSamples[Math.floor(Math.random() * musicSamples.length)];
      audioElement = new Audio(randomSample);
      audioElement.volume = 0.3;
      audioElement.loop = true;
    }

    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play().catch(() => {
        console.log("Audio playback requires user interaction first");
      });
    }
    isPlaying = !isPlaying;
  }
</script>

<footer class="mt-20 pb-8 px-6 md:px-12">
  <div class="border-t border-ink-200 dark:border-ink-700 pt-6">
    <!-- Footer - full width, left/right justified -->
    <div
      class="flex flex-col sm:flex-row items-center sm:items-end justify-between text-sm space-y-4 sm:space-y-0"
    >
      <!-- Left side - DC Time -->
      <div class="text-ink-500 dark:text-ink-400 text-center sm:text-left">
        <div class="font-mono text-lg tabular-nums">{dcTime}</div>
        <div class="text-xs uppercase tracking-wider opacity-75">
          Washington, DC
        </div>
      </div>

      <!-- Right side - Music player -->
      <button
        type="button"
        on:click={toggleMusic}
        class="flex items-center space-x-2 text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-cream-300 transition-all duration-300 group"
      >
        <span
          class="transition-transform duration-300 group-hover:scale-110"
          class:animate-pulse={isPlaying}
        >
          <Disc3 size={16} class="translate-y-[1px]" />
        </span>
        <span class="text-xs uppercase tracking-wider">let's get groovy</span>
        <span class="transition-all duration-300">
          {#if isPlaying}
            <span in:fade={{ duration: 200 }}>
              <Volume2 size={16} class="translate-y-[0px]" />
            </span>
          {:else}
            <span in:fade={{ duration: 200 }}>
              <VolumeOff size={16} class="translate-y-[2px]" />
            </span>
          {/if}
        </span>
      </button>
    </div>
  </div>
</footer>
