<script lang="ts">
  /** Lives left. */
  export let left: number;
  export let total = 3;
  /** Bump to shake the row when a life is lost. */
  export let pulse = 0;

  // A pearl that changes blinks, so a lost life and a life won back (a
  // revive, a pearl returned, a fresh run) are seen, not just counted. A lost
  // one flickers between pearl and ring in the accent before it settles as a
  // ring; a returned one flickers back in and lands with a small pop. Each
  // pearl keeps its own count, so a blink restarts if it changes again.
  type Change = "out" | "in" | null;
  let changing: Change[] = [];
  let restarts: number[] = [];
  let previous: number | null = null;

  $: follow(left);

  function follow(now: number) {
    if (previous === null || now === previous) {
      previous = now;
      return;
    }
    const kind: Change = now < previous ? "out" : "in";
    for (let index = Math.min(now, previous); index < Math.max(now, previous); index++) {
      changing[index] = kind;
      restarts[index] = (restarts[index] ?? 0) + 1;
    }
    changing = changing;
    restarts = restarts;
    previous = now;
  }

  function settle(index: number, event: AnimationEvent) {
    if (!event.animationName.includes("pearl-blink")) return;
    changing[index] = null;
    changing = changing;
  }
</script>

<!-- Lives are tapioca pearls; a dropped one is only a pencil ring. -->
{#key pulse}
  <span
    class="boba-pearls"
    class:hit={pulse > 0}
    role="img"
    aria-label={`${left} of ${total} pearls left`}
  >
    {#each Array(total) as _, index}
      {#key restarts[index] ?? 0}
        <svg
          class="boba-pearl"
          class:lost={index >= left}
          class:out={changing[index] === "out"}
          class:in={changing[index] === "in"}
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
          on:animationend={(event) => settle(index, event)}
        >
          <circle class="body" cx="8" cy="8" r="5.6" />
          <circle class="shine" cx="6" cy="6" r="1.5" />
        </svg>
      {/key}
    {/each}
  </span>
{/key}

<style>
  .boba-pearls {
    display: inline-flex;
    align-items: center;
    gap: var(--space-0-5);
  }

  .boba-pearl {
    width: 1.125rem;
    height: 1.125rem;
    overflow: visible;
    filter: url(#boba-rough-fine);
    transform-box: fill-box;
    transform-origin: center;
  }

  .body {
    fill: var(--b-line);
    stroke: var(--b-line);
    stroke-width: 1.4;
    transition: fill var(--motion-base) var(--ease-standard);
  }

  .shine {
    fill: var(--b-paper);
    opacity: 0.75;
  }

  .lost .body {
    fill: transparent;
    stroke: var(--b-muted);
    stroke-dasharray: 2.4 2;
  }

  /* A paper-coloured shine only reads as a highlight on an ink pearl. */
  .lost .shine,
  :global(.dark) .shine {
    opacity: 0;
  }

  /* Lost: four hard blinks between an accent pearl and the ring. */
  .out .body {
    animation: pearl-blink-out 960ms steps(1, end) both;
  }

  @keyframes pearl-blink-out {
    0%,
    25%,
    50% {
      fill: var(--b-accent);
      stroke: var(--b-accent);
      stroke-dasharray: none;
    }
    12.5%,
    37.5%,
    62.5%,
    100% {
      fill: transparent;
      stroke: var(--b-muted);
      stroke-dasharray: 2.4 2;
    }
  }

  /* Won back: the ring blinks into a pearl, then the pearl lands with a pop. */
  .in .body {
    animation: pearl-blink-in 840ms steps(1, end) both;
  }

  .in {
    animation: pearl-pop 840ms var(--ease-emphasized) both;
  }

  @keyframes pearl-blink-in {
    0%,
    25%,
    50% {
      fill: transparent;
      stroke: var(--b-muted);
      stroke-dasharray: 2.4 2;
    }
    12.5%,
    37.5%,
    62.5% {
      fill: var(--b-accent);
      stroke: var(--b-accent);
      stroke-dasharray: none;
    }
    75%,
    100% {
      fill: var(--b-line);
      stroke: var(--b-line);
      stroke-dasharray: none;
    }
  }

  @keyframes pearl-pop {
    0%,
    62% {
      transform: scale(1);
    }
    78% {
      transform: scale(1.35);
    }
    100% {
      transform: scale(1);
    }
  }

  .hit {
    animation: boba-shake var(--motion-slow) var(--ease-standard);
  }

  @media (prefers-reduced-motion: reduce) {
    .hit,
    .in,
    .out .body,
    .in .body {
      animation: none;
    }
  }
</style>
