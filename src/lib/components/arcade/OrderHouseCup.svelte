<script lang="ts">
  import { stationCup } from "#lib/arcade/orders-station-art.ts";
  import type { CupPrintId } from "#lib/arcade/orders-recipe-journal.ts";

  interface Props {
    tea: string;
    accentTea?: string | null;
    milk: string | null;
    toppings: readonly string[];
    mixins: readonly string[];
    ice: number;
    scoop?: string;
    size?: number;
    cupPrint?: CupPrintId;
    sparkling?: boolean;
  }

  let { tea, accentTea, milk, toppings, mixins, ice, scoop, size = 168, cupPrint, sparkling }: Props = $props();
  const cup = $derived(stationCup({ tea, accentTea, milk, toppings, mixins, ice, scoop, cupPrint, sparkling, sealed: false }, 0));
</script>

<svg viewBox="0 0 128 130" width={size} height={size * 130 / 128} shape-rendering="crispEdges" aria-hidden="true" focusable="false">
  <path d="M22 52h4v-9h7v-8h10v-6h42v6h10v8h7v9h4v47H22z" fill="#4e5a51" opacity=".32" />
  <path d="M27 50h4v-7h6v-6h8v-4h38v4h8v6h6v7h4v46H27z" fill="#657569" opacity=".34" />

  <path d="M23 102l12-7h59l14 7 8 8v9l-13 7H25l-13-7v-9z" fill="#453637" opacity=".48" />
  <path d="M22 102l13-9h58l14 9 7 8v7l-13 6H27l-13-6v-7z" fill="#745442" />
  <path d="M24 102l13-7h54l14 7 6 7-12 7H29l-12-7z" fill="#b98963" />
  <path d="M30 103l10-5h49l10 5 5 6-8 4H31l-8-4z" fill="#cb9c73" />
  <path d="M24 107h5v2h-5zm11 4h3v2h-3zm55-10h5v2h-5zm7 9h5v1h-5zm-55 1h5v1h-5zm15-12h3v1h-3z" fill="#935e4a" />
  <path d="M43 97h43l13 7v6l-11 5H41l-11-5v-6z" fill="#604849" />
  <path d="M44 96h41l11 8-9 7H42l-9-7z" fill="#a2aa88" />
  <path d="M46 98h38l7 6-7 4H44l-7-4z" fill="#d7c69a" />
  <path d="M49 101h30l7 3-6 2H48l-5-2z" fill="#a48c71" />
  <g transform="translate(64 104) scale(3.5)">
    <g transform="translate({cup.translateX} {cup.translateY})">
      {#each cup.paths as { fill, d } (fill)}
        <path {fill} {d} />
      {/each}
    </g>
  </g>
</svg>
