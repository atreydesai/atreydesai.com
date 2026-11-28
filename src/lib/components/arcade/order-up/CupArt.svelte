<svelte:options namespace="svg" />

<script lang="ts">
  // The drink as a group inside a painted scene: its foot on (x, y), each
  // sprite cell `scale` units wide, as the original station art seats its cup.
  import { cupSprite } from "#lib/arcade/order-up/art/sprites.ts";

  let {
    recipe,
    steps = 99,
    turn = 0,
    damage = 0,
    x,
    y,
    scale,
    shaking = false,
  }: { recipe: string; steps?: number; turn?: number; damage?: number; x: number; y: number; scale: number; shaking?: boolean } =
    $props();

  const sprite = $derived(cupSprite(recipe, steps, turn, damage));
  const paths = $derived.by(() => {
    const runs = new Map<string, string>();
    sprite.grid.forEach((row, line) => {
      let start = 0;
      while (start < row.length) {
        const cell = row[start];
        let end = start + 1;
        while (end < row.length && row[end] === cell) end++;
        const fill = sprite.palette[cell];
        if (fill && cell !== ".") runs.set(fill, (runs.get(fill) ?? "") + `M${start} ${line}h${end - start}v1H${start}z`);
        start = end;
      }
    });
    return [...runs].map(([fill, d]) => ({ fill, d }));
  });
</script>

<g transform="translate({x} {y}) scale({scale})" shape-rendering="crispEdges">
  <g class:shaking>
    <g transform="translate({-Math.round(sprite.anchorX)} {-sprite.foot - 1})">
      {#each paths as path (path.fill)}<path d={path.d} fill={path.fill} />{/each}
    </g>
  </g>
</g>

<style>
  .shaking {
    animation: shake 0.18s steps(2, end) infinite;
  }

  @keyframes shake {
    50% {
      transform: translate(1px, -1px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shaking {
      animation: none;
    }
  }
</style>
