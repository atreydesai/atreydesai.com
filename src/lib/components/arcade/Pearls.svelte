<script lang="ts">
  /** Lives left. */
  export let left: number;
  export let total = 3;
  /** Bump to shake the row when a life is lost. */
  export let pulse = 0;
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
      <svg
        class="boba-pearl"
        class:lost={index >= left}
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
      >
        <circle class="body" cx="8" cy="8" r="5.6" />
        <circle class="shine" cx="6" cy="6" r="1.5" />
      </svg>
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

  .hit {
    animation: boba-shake var(--motion-slow) var(--ease-standard);
  }

  @media (prefers-reduced-motion: reduce) {
    .hit {
      animation: none;
    }
  }
</style>
