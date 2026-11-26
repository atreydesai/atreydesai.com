<script lang="ts">
  import { figure } from "#lib/arcade/orders-guests.js";
  import { MIXINS, SYRUPS, TOPPINGS, type ServiceCup } from "#lib/arcade/orders-service.ts";
  import type { CupPrintId } from "#lib/arcade/orders-recipe-journal.ts";
  import { neighborhoodLight, stationCup } from "#lib/arcade/orders-station-art.ts";
  import { shopPaint, type ShopPaintId } from "#lib/arcade/orders-commissions.ts";
  import OrderPixelWord from "./OrderPixelWord.svelte";
  import OrderNeighborhoodView from "./OrderNeighborhoodView.svelte";

  interface Props {
    customerId: string;
    cup: ServiceCup;
    accentTea?: string | null;
    serving?: boolean;
    quality?: number;
    active?: boolean;
    weather?: string;
    daylight?: number;
    branch?: string;
    renovated?: boolean;
    paint?: ShopPaintId;
    cupPrint?: CupPrintId;
  }

  let { customerId, cup, accentTea, serving = false, quality, active = true, weather = "neighborhood", daylight = 0, branch = "corner",
    renovated = false, paint = "clay", cupPrint }: Props = $props();
  const id = $props.id();
  const name = $derived(customerId.toLowerCase());
  const reaction = $derived(quality === undefined ? "content" : quality >= 90 ? "wow" : quality >= 70 ? "content" : "meh");
  const backdropColors = { day: "#d2ac8f", rain: "#8e9294", night: "#a18a91" };
  const backdrop = $derived(backdropColors[neighborhoodLight(branch, weather, daylight)]);
  const drink = $derived(stationCup({
    tea: cup.tea, accentTea: accentTea ?? cup.accentTea, milk: cup.milk, ice: cup.ice, sealed: cup.sealed, foamed: cup.foamed,
    scoop: cup.float?.flavor, cupPrint, sparkling: cup.sparkling,
    toppings: TOPPINGS.flatMap((item) => Array<string>(cup.ingredients[item] ?? 0).fill(item)),
    mixins: [...MIXINS, ...SYRUPS].flatMap((item) =>
      Array<string>(cup.ingredients[item] ?? 0).fill(item)),
  }, 0));
  const calm = $derived(figure(name, "calm"));
  const tasted = $derived(figure(name, reaction));
  const paving = [100, 242, 359, 593, 725, 846];
  const palette = $derived(shopPaint(paint));
</script>

{#snippet portrait(art: ReturnType<typeof figure>)}
  <g transform="translate(431 56) scale(10)">
    {#each art.grid as row, y}
      {#each row as ink, x}
        {#if art.palette[ink]}
          <path d="M{x} {y}h1v1h-1z" fill={art.palette[ink]} />
        {/if}
      {/each}
    {/each}
  </g>
{/snippet}

<svg class="pickup-view" class:frozen={!active} viewBox="0 0 900 344" width="900" height="344" shape-rendering="crispEdges"
  aria-hidden="true" focusable="false">
  <defs>
    <pattern id={id + "-grain"} width="39" height="20" patternUnits="userSpaceOnUse">
      <path d="M2 3h5v1H2zm17 4h11v1H19zm15 8h3v1h-3zM8 14h9v1H8z" fill="#f2c396" opacity=".38" />
      <path d="M6 8h7v1H6zm14 8h8v1h-8zm10-13h6v1h-6z" fill="#614c42" opacity=".32" />
    </pattern>
  </defs>

  <!-- A recessed service window faces the pavement and the opposite block. -->
  <path d="M0 0h900v344H0z" fill="#927660" />
  <path d="M29 23h842v216H29z" fill="#593f39" />
  {#if branch !== "corner"}
    <OrderNeighborhoodView {branch} x={47} y={36} width={806} height={198} {weather} {daylight} {active} {renovated} />
  {:else}
  <path d="M47 36h806v189H47z" fill={backdrop} />
  <path d="M47 110h806v84H47z" fill="#a89684" />
  <path d="M47 90h35V74h55v19h21v70H47zm192 1h36V65h51v25h44v72H239zm326 29h74V75h39V60h65v33h43v58h67v41H565z" fill="#777876" />
  <path d="M88 84h37v6H88zm167 24h31v5h-31zm49-22h17v7h-17zm347 5h28v8h-28zm64 7h19v7h-19zm80 61h28v7h-28z" fill="#d6b59a" opacity=".72" />
  <path d="M47 131h806v50H47z" fill="#c6ad90" />
  <path d="M48 136h153v38H48zm528 7h104v32H576zm137-17h135v52H713z" fill="#a89382" />
  <path d="M68 145h61v30H68zm70 0h55v30h-55zm452 7h76v22h-76zm133-13h112v34H723z" fill="#78867b" />
  <path d="M62 139h136v8H62zm525 9h80v7h-80zm133-16h118v8H720z" fill="#dfb789" />
  <path d="M49 178h803v56H49z" fill="#918a77" />
  <path d="M49 181h803v8H49z" fill="#d1b89a" />
  <path d="M52 196h797v4H52zm0 17h797v3H52z" fill="#a9a18c" />
  {#each paving as x}
    <path d="M{x} 188h3l21 43h-4z" fill="#817b6b" />
  {/each}
  {#if weather === "rain"}
    <path d="M63 216h83v3H63zm204 8h84v4h-84zm324-26h83v3h-83zm170 22h56v4h-56z" fill="#b7b8ac" />
    <path class="pickup-rain" d="M95 50v12m62 11v16m45-45v15m51-4v13m94-25v17m42 9v14m210-35v17m40 54v14m75-66v15m44 15v14m58-45v19" stroke="#dad5c8" stroke-width="3" opacity=".6" />
  {/if}

  {/if}

  <!-- Window jamb, shade and the little painted pickup sign. -->
  <path d="M25 19h850v23H25zm0 20h24v187H25zm826 0h24v187h-24z" fill="#745344" />
  <path d="M29 23h842v6H29zM30 43h6v174h-6zm834 0h6v173h-6z" fill="#bf9070" />
  <path d="M50 43h115l12 9v13H50zm663 0h138v22H697V53z" fill="#665648" />
  <path d="M50 44h112l12 9v4H50zm673 0h129v13H709v-5z" fill="#9b9377" />
  <path d="M180 43h136v10H180z" fill="#5d4c42" />
  <path d="M188 52h5v16h-5zm114 0h5v16h-5z" fill="#805c4c" />
  <path d="M174 65h147v32H174z" fill="#624b3f" />
  <path d="M178 68h139v25H178z" fill="#a4a183" />
  <path d="M181 69h133v2H181zm0 21h133v2H181z" fill="#d6b182" />
  <g transform="translate(206 75)" color="#4d5146">
    <OrderPixelWord text="PICKUP" cells={2.35} />
  </g>

  <g class:before-taste={serving}>
    {@render portrait(calm)}
  </g>
  {#if serving}
    <g class="after-taste">
      {@render portrait(tasted)}
    </g>
  {/if}

  <!-- The shop's low oak sill masks the guest's waist. -->
  <path d="M0 228h900v116H0z" fill="#64483e" />
  <path d="M28 223h843l29 20v64H0v-64z" fill="#bb8a66" />
  <path d="M30 223h840l25 16H7z" fill="#e1ad7e" />
  <path d="M26 227h848v6H26z" fill="#9a6e56" />
  <path d="M7 242h886v59H7z" fill="url(#{id}-grain)" />
  <path d="M0 271h282l37-3h106m142 0h76l61 3h196m-847 19h160m445 0h181" fill="none" stroke="#8a6453" stroke-width="2" opacity=".63" />
  <path d="M0 305h900v10H0zm0 30h900v4H0z" fill="#4e3935" />
  <path d="M0 315h900v7H0z" fill="#a57959" />
  <path d="M409 277l21-12h139l24 12v10l-19 11H427l-18-12z" fill="#6b594a" />
  <path d="M414 278l19-10h133l21 10-15 12H430z" fill={paint === "clay" ? "#818d79" : palette.cloth} />
  <path d="M423 280l13-8h128l15 8-9 7H432z" fill={paint === "clay" ? "#a8ac88" : palette.trim} />
  <path d="M448 280l9-5h86l10 5-9 5h-87z" fill="#717b69" opacity=".7" />

  {#if cup.ingredients.waffle}
    <g transform="translate(365 279)">
      <path d="M-39 0l12-9h53l16 9v8l-13 8h-58l-10-8z" fill="#644c42" />
      <path d="M-35 0l10-7h50l13 7-11 10h-53z" fill="#abb191" />
      <path d="M-20-5l7-6h30l8 6v12l-6 4h-33l-6-5z" fill="#a96b4c" />
      <path d="M-18-6l7-5h27l7 5v8l-6 4h-29l-6-4z" fill="#eab479" />
      <path d="M-12-7h6v4h-6zm9 0h6v4h-6zm9 0h6v4H6zM-12 0h6v4h-6zm9 0h6v4h-6zm9 0h6v4H6z" fill="#a9724d" />
    </g>
  {/if}
  {#if cup.ingredients.bun}
    <g transform="translate(635 279)">
      <path d="M-39 0l12-9h53l16 9v8l-13 8h-58l-10-8z" fill="#644c42" />
      <path d="M-35 0l10-7h50l13 7-11 10h-53z" fill="#abb191" />
      <path d="M-24 1l4-12 9-9h21l12 9 4 12-8 7h-33z" fill="#a87753" />
      <path d="M-21 0l4-11 8-7H9l10 8 4 10-7 5h-30z" fill="#edd29a" />
      <path d="M-9-16l-6 10m12-11-4 10m9-10v10m6-9 5 9" fill="none" stroke="#c79b6c" stroke-width="2" />
    </g>
  {/if}

  {#if serving}
    <g class="taste-arm">
      <path d="M554 209h19v23h-19v9h-20v-13h20z" fill={calm.palette.O} />
      <path d="M556 211h14v16h-14v10h-20v-7h20z" fill={calm.palette.C} />
    </g>
  {/if}
  <g class:lift={serving}>
    <g transform="translate(500 282) scale(2.85)">
      <g transform="translate({drink.translateX} {drink.translateY})">
        {#each drink.paths as { fill, d } (fill)}
          <path {fill} {d} />
        {/each}
      </g>
    </g>
    {#if serving}
      <g class="sip-hand">
        <path d="M516 241h10v5h6v13h-6v5h-10v-4h-8v-13h8z" fill={calm.palette.O} />
        <path d="M518 244h7v5h5v8h-5v4h-7v-4h-8v-8h8z" fill={calm.palette.S} />
        <path d="M519 257h7v3h-7z" fill={calm.palette.s} />
      </g>
    {/if}
  </g>

  {#if serving && (quality ?? 0) >= 90}
    <path class="tasted-spark" d="M590 81h4v8h8v4h-8v8h-4v-8h-8v-4h8zm15 28h4v4h-4z" fill="#f6d194" />
  {/if}
</svg>

<style>
  .pickup-view {
    display: block;
    inline-size: 100%;
    block-size: auto;
  }

  .lift { animation: sip 1.25s steps(12, end) both; }
  .sip-hand, .taste-arm { animation: reach 1.25s steps(1, end) both; }
  .before-taste { animation: conceal 1.25s steps(1, end) both; }
  .after-taste { animation: reveal 1.25s steps(1, end) both; }
  .tasted-spark { animation: spark 1.25s steps(4, end) both; }
  .pickup-rain { animation: rain .55s steps(6) infinite; }
  .frozen :is(.lift, .before-taste, .after-taste, .tasted-spark, .pickup-rain, .sip-hand, .taste-arm) { animation-play-state: paused; }

  @keyframes sip {
    0%, 12% { transform: translate(0, 0); }
    42%, 60% { transform: translate(-10px, -30px); }
    83%, 100% { transform: translate(48px, -20px); }
  }

  @keyframes reach {
    0% { opacity: 0; }
    15%, 100% { opacity: 1; }
  }

  @keyframes conceal {
    0% { opacity: 1; }
    63%, 100% { opacity: 0; }
  }

  @keyframes reveal {
    0% { opacity: 0; }
    63%, 100% { opacity: 1; }
  }

  @keyframes spark {
    0%, 60% { opacity: 0; }
    78% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-8px); }
  }

  @keyframes rain {
    to { transform: translateY(27px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .lift, .before-taste, .after-taste, .tasted-spark, .pickup-rain, .sip-hand, .taste-arm { animation: none; }
    .before-taste { opacity: 0; }
    .tasted-spark, .sip-hand, .taste-arm { display: none; }
  }
</style>
