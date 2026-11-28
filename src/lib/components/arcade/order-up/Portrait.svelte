<script lang="ts">
  // A guest from the waist up, in the original cast's drawing, with a pixel
  // emote over their shoulder when they have something to say.
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import { EMOTES, FACES, figure } from "#lib/arcade/orders-guests.js";

  type Face = Parameters<typeof figure>[1];

  let { name = "mochi", face = "calm", size = 48, emote = "" }: { name?: string; face?: string; size?: number; emote?: string } =
    $props();

  const INK = "#2b2320";
  const BUBBLE = { O: INK, w: "#fdf8f3", E: "#4a322d" };
  // Emotes the first cast never needed: a question, a note and sleep.
  const EXTRA: Record<string, { grid: string[]; palette: Record<string, string> }> = {
    question: {
      grid: [".OOOOOOO.", "OwwwwwwwO", "OwwEEEwwO", "OwEwwwEwO", "OwwwwEwwO", "OwwwEwwwO", "OwwwwwwwO", "OwwwEwwwO", ".OOOOOOO.", "...OO...."],
      palette: BUBBLE,
    },
    music: {
      grid: [".OOOOOOO.", "OwwwwwwwO", "OwwwEEEwO", "OwwwEwwEO", "OwwwEwwEO", "OwEEEwEEO", "OwEEEwEEO", "OwwwwwwwO", ".OOOOOOO.", "...OO...."],
      palette: BUBBLE,
    },
    zzz: {
      grid: [".OOOOOOO.", "OwwwwwwwO", "OwEEEEwwO", "OwwwEwwwO", "OwwEwwwwO", "OwEEEEwwO", "OwwwwwwwO", ".OOOOOOO.", "...OO...."],
      palette: BUBBLE,
    },
  };
  const ALIAS: Record<string, keyof typeof EMOTES> = { sparkles: "star", sweat: "drop", storm: "anger" };

  const look = $derived(FACES.includes(face as Face) ? (face as Face) : "calm");
  const sprite = $derived(figure(name.toLowerCase(), look));
  const icon = $derived(emote ? (EXTRA[emote] ?? EMOTES[(ALIAS[emote] ?? emote) as keyof typeof EMOTES] ?? null) : null);
</script>

<!-- A size of 0 fills the width it is given, for guests set into a painted scene. -->
<span
  class="portrait"
  class:is-fluid={!size}
  style:width={size ? size + "px" : undefined}
  style:height={size ? Math.round(size * 1.15) + "px" : undefined}
>
  <span class="person" aria-hidden="true"><PixelIcon grid={sprite.grid} palette={sprite.palette} px={3} /></span>
  {#if icon}<span class="emote" aria-hidden="true"><PixelIcon grid={icon.grid} palette={icon.palette} px={2} /></span>{/if}
</span>

<style>
  .portrait {
    position: relative;
    display: inline-block;
    flex-shrink: 0;
  }

  .portrait.is-fluid {
    display: block;
    width: 100%;
    aspect-ratio: 1 / 1.15;
  }

  .person {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .person :global(svg) {
    width: 100%;
    height: auto;
    image-rendering: pixelated;
  }

  .emote {
    position: absolute;
    top: -4%;
    right: -14%;
    width: 42%;
  }

  .emote :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
