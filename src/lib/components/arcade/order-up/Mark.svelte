<script lang="ts">
  // A small one-colour sign (a check, a question, a clock) in currentColor.
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import { MARKS } from "#lib/arcade/order-up/art/icons.ts";

  let { kind, size = 12 }: { kind: keyof typeof MARKS; size?: number } = $props();

  const grid = $derived([...MARKS[kind]]);
  const cols = $derived(Math.max(...grid.map((row) => row.length)));
</script>

<span class="mark" style:height={size + "px"} style:width={(size * cols) / grid.length + "px"} aria-hidden="true">
  <PixelIcon {grid} palette={{ O: "currentColor" }} px={1} />
</span>

<style>
  .mark {
    display: inline-grid;
    flex: none;
    place-items: center;
    vertical-align: middle;
  }

  .mark :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
