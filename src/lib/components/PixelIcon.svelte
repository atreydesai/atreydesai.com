<script lang="ts">
  // Renders an 8-bit sprite grid (array of strings; "." = transparent) as
  // crisp inline-SVG pixels. `palette` maps each char to a color; the value
  // "currentColor" is allowed so an icon can inherit the surrounding text
  // color (handy for light/dark theming).
  export let grid: string[];
  export let palette: Record<string, string>;
  export let px = 2;

  $: cols = grid.reduce((m, r) => Math.max(m, r.length), 0);
  $: rows = grid.length;
  $: cells = grid.flatMap((row, y) =>
    [...row]
      .map((ch, x) => ({ ch, x, y }))
      .filter((c) => c.ch !== "." && palette[c.ch]),
  );
</script>

<svg
  class="pixel-icon"
  width={cols * px}
  height={rows * px}
  viewBox="0 0 {cols} {rows}"
  shape-rendering="crispEdges"
  aria-hidden="true"
  focusable="false"
>
  {#each cells as c (c.y + "-" + c.x)}
    <rect x={c.x} y={c.y} width="1" height="1" fill={palette[c.ch]} />
  {/each}
</svg>

<style>
  .pixel-icon {
    display: inline-block;
    vertical-align: middle;
  }
</style>
