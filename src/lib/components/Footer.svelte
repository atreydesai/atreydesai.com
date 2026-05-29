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

  // Music player
  let isPlaying = false;
  let hoveredMusic = false;
  let audioElement: HTMLAudioElement | null = null;

  // Dynamically import all mp3 files from /static/audio using Vite's glob
  const audioModules = import.meta.glob<string>("/static/audio/*.mp3", {
    eager: true,
    query: "?url",
    import: "default",
  });
  const musicSamples = Object.values(audioModules).map((url) =>
    url.replace(/^\/static/, ""),
  );

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
      class="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-y-4"
    >
      <!-- Left side - DC Time -->
      <div class="text-ink-500 dark:text-ink-400 text-center sm:text-left space-y-1">
        <div class="text-xs uppercase tracking-wider tabular-nums">{dcTime}</div>
        <div class="text-xs uppercase tracking-wider opacity-75">
          Washington, DC
        </div>
      </div>

      <!-- Right side - Last updated + Music player -->
      <div class="flex flex-col items-center sm:items-end space-y-1">
        <div class="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 opacity-75">
          Last updated {new Date(__BUILD_DATE__).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <button
          type="button"
          on:click={toggleMusic}
          on:mouseenter={() => (hoveredMusic = true)}
          on:mouseleave={() => (hoveredMusic = false)}
          class="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-cream-300 transition-all duration-300 group"
        >
          <span
            class="inline-flex items-center transition-transform duration-300 group-hover:scale-110"
            class:animate-pulse={isPlaying}
          >
            <Disc3 size={14} animate={hoveredMusic} />
          </span>
          <span>let's get groovy</span>
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
