<script lang="ts">
  // The drink in hand, drawn as the original shop draws its cup: a stack of
  // slices outlined once, each run of one colour a single SVG path.
  import { cupSprite } from "#lib/arcade/order-up/art/sprites.ts";

  let {
    recipe = "",
    steps = 99,
    turn = 0,
    damage = 0,
    size = 120,
  }: { recipe?: string; steps?: number; turn?: number; damage?: number; size?: number } = $props();

  const sprite = $derived(cupSprite(recipe, steps, turn, damage));
  const width = $derived(Math.max(...sprite.grid.map((row) => row.length)));
  const height = $derived(sprite.grid.length);
  const paths = $derived.by(() => {
    const runs = new Map<string, string>();
    sprite.grid.forEach((row, y) => {
      let start = 0;
      while (start < row.length) {
        const cell = row[start];
        let end = start + 1;
        while (end < row.length && row[end] === cell) end++;
        const fill = sprite.palette[cell];
        if (fill && cell !== ".") runs.set(fill, (runs.get(fill) ?? "") + `M${start} ${y}h${end - start}v1H${start}z`);
        start = end;
      }
    });
    return [...runs].map(([fill, d]) => ({ fill, d }));
  });
</script>

<svg
  class="cup"
  viewBox="0 0 {width} {height}"
  width={size}
  height={(size * height) / width}
  shape-rendering="crispEdges"
  role="img"
  aria-label="the drink"
>
  {#each paths as path (path.fill)}<path d={path.d} fill={path.fill} />{/each}
</svg>

<style>
  .cup {
    display: block;
    max-width: 100%;
    max-height: 100%;
  }
</style>
