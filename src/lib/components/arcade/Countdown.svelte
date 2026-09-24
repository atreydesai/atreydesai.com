<script lang="ts">
  import { LOOPS } from "$lib/arcade/art";

  /** 3, 2, 1… then 0 for "go". */
  export let value: number;
  export let caption = "shift starts in";
  export let goCaption = "catch the rush";
  export let goLabel = "go";

  $: loop = LOOPS[value % LOOPS.length];
</script>

<!-- Each number gets circled by hand, with a different pen loop each time. -->
<div class="boba-countdown boba-ui" aria-live="assertive">
  {#key value}
    <div class="boba-count">
      <svg
        class="boba-count-loop"
        viewBox="0 0 44 28"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path class="ghost" d={loop} />
        <path class="fill" d={loop} />
        <path class="stroke" pathLength="1" d={loop} />
      </svg>
      <span class="boba-count-num">{value > 0 ? value : goLabel}</span>
    </div>
  {/key}
  <span class="boba-count-caption">{value > 0 ? caption : goCaption}</span>
</div>

<style>
  .boba-countdown {
    position: fixed;
    inset: 0;
    z-index: calc(var(--layer-overlay) + 2);
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--space-4);
    pointer-events: none;
  }

  .boba-count {
    position: relative;
    display: grid;
    place-items: center;
    width: 15rem;
    height: 9.5rem;
    animation: boba-pop 480ms var(--ease-emphasized) both;
  }

  .boba-count-loop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: url(#boba-rough-loop);
  }

  .ghost {
    fill: var(--b-slab);
    transform: translate(1.1px, 1.6px);
  }

  .fill {
    fill: var(--b-paper);
  }

  .stroke {
    fill: none;
    stroke: var(--b-line);
    stroke-width: 0.42;
    stroke-linecap: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: boba-draw 420ms var(--ease-standard) 60ms forwards;
  }

  .boba-count-num {
    position: relative;
    color: var(--b-strong);
    font-family: var(--font-display);
    font-size: clamp(3.75rem, 2.25rem + 6vw, 6rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 0.9;
  }

  .boba-count-caption {
    padding: var(--space-0-5) var(--space-2);
    color: var(--b-strong);
    background: var(--b-paper);
    border-radius: var(--radius-control);
    font-family: var(--font-prose);
    font-size: 1.2rem;
    font-style: italic;
    line-height: 1.4;
  }

  @media (max-width: 640px) {
    .boba-count {
      width: 12rem;
      height: 7.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .boba-count {
      animation: none;
    }

    .stroke {
      stroke-dashoffset: 0;
      animation: none;
    }
  }
</style>
