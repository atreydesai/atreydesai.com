<script lang="ts" context="module">
  let nextId = 0;
</script>

<script lang="ts">
  /** Share of the shift left, 1 → 0. */
  export let fraction: number;
  export let rush = false;

  const clipId = `boba-cup-clip-${nextId++}`;
  const BODY = "M6.5 13 L10 42.5 Q10.4 45.5 13.4 45.5 L26.6 45.5 Q29.6 45.5 30 42.5 L33.5 13 Z";
  const DRAIN = 30; // user units of tea between full and empty

  $: drop = (1 - Math.max(0, Math.min(1, fraction))) * DRAIN;
</script>

<!-- The timer is a cup whose tea drains a second at a time, leaving the
     pearls. -->
<svg class="boba-cup" class:rush viewBox="0 0 40 48" aria-hidden="true" focusable="false">
  <defs>
    <clipPath id={clipId}><path d={BODY} /></clipPath>
  </defs>
  <g clip-path={`url(#${clipId})`}>
    <rect class="tea" x="0" y="14" width="40" height="34" style={`transform: translateY(${drop}px)`} />
    <circle class="pearl" cx="14" cy="42" r="2.3" />
    <circle class="pearl" cx="19.6" cy="42.6" r="2.3" />
    <circle class="pearl" cx="25.4" cy="41.8" r="2.3" />
    <circle class="pearl" cx="17" cy="38.4" r="2.3" />
    <circle class="pearl" cx="23" cy="38" r="2.3" />
  </g>
  <g class="line">
    <path d={BODY} />
    <path class="lid" d="M4 12.5 Q20 5.5 36 12.5 Z" />
  </g>
  <path class="straw" d="M22.5 9 L28 1.5" />
</svg>

<style>
  .boba-cup {
    width: 2.125rem;
    height: 2.625rem;
    overflow: visible;
    filter: url(#boba-rough-fine);
  }

  .tea {
    fill: var(--b-tea);
    transition:
      transform 1s linear,
      fill var(--motion-slow) var(--ease-standard);
  }

  .rush .tea {
    fill: var(--b-tea-rush);
  }

  .pearl {
    fill: var(--b-line);
  }

  .line path {
    fill: none;
    stroke: var(--b-line);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .line .lid {
    fill: var(--b-paper);
  }

  .straw {
    fill: none;
    stroke: var(--b-slab);
    stroke-width: 3;
    stroke-linecap: round;
  }

  @media (max-width: 640px) {
    .boba-cup {
      width: 1.75rem;
      height: 2.125rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tea {
      transition: none;
    }
  }
</style>
