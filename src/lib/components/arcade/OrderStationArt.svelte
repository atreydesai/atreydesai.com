<script lang="ts">
  import OrderPixelWord from "./OrderPixelWord.svelte";
  import OrderNeighborhoodView from "./OrderNeighborhoodView.svelte";
  import OrderTakeoutTray from "./OrderTakeoutTray.svelte";
  import type { CupPrintId } from "#lib/arcade/orders-recipe-journal.ts";
  import { onMount } from "svelte";
  import { CUP_TURN_FRAMES, neighborhoodLight, stationCup } from "#lib/arcade/orders-station-art.ts";

  type Station = "brew" | "build" | "serve" | "prep" | "stock";
  interface Props {
    station: Station;
    showCup: boolean;
    tea: string | null;
    accentTea?: string | null;
    milk?: string | null;
    milkSelection?: string | null;
    milkUnlocked?: readonly string[];
    ingredientUnlocked?: readonly string[];
    mixins?: readonly string[];
    takeoutPacked?: number;
    cupPrint?: CupPrintId;
    toppings?: readonly string[];
    progress?: number;
    serving?: boolean;
    active?: boolean;
    bun?: boolean;
    ice?: number | null;
    sealed?: boolean;
    finish?: "shake" | "seal" | "foam" | null;
    autoSealing?: boolean;
    foamAvailable?: boolean;
    floatAvailable?: boolean;
    seltzerAvailable?: boolean;
    sparkling?: boolean;
    scoop?: string | null;
    foamed?: boolean;
    pearlProgress?: number;
    bunProgress?: number;
    pearlCooking?: boolean;
    bunCooking?: boolean;
    pearlReady?: number;
    bunReady?: number;
    bunAvailable?: boolean;
    waffleAvailable?: boolean;
    waffle?: boolean;
    orderedSide?: "bun" | "waffle" | null;
    waffleReady?: number;
    waffleCooking?: boolean;
    waffleProgress?: number;
    stockUnlocked?: boolean;
    expressProgress?: number;
    expressStatus?: "idle" | "incoming" | "arrived";
    weather?: string;
    branch?: string;
    renovated?: boolean;
    daylight?: number;
    upgrades?: readonly string[];
    carafeTea?: string | null;
    carafeProgress?: number;
    carafeFilling?: boolean;
  }

  let {
    station, showCup, tea, accentTea = null, milk = null, milkSelection, milkUnlocked = ["milk", "oat"], ingredientUnlocked = [],
    mixins = [], takeoutPacked, cupPrint, toppings = [], progress = 0, renovated = false,
    serving = false, active = true, bun = false, ice = null, sealed, finish = null, autoSealing = false, foamAvailable = false, foamed = false, floatAvailable = false, scoop = null, seltzerAvailable = false, sparkling = false,
    pearlProgress = 0, bunProgress = 0, pearlCooking = false, bunCooking = false,
    pearlReady = 0, bunReady = 0, bunAvailable = true,
    waffleAvailable = false, waffle = false, orderedSide = null, waffleReady = 0, waffleCooking = false, waffleProgress = 0,
    stockUnlocked = true, expressProgress = 0, expressStatus = "idle", weather = "neighborhood", branch = "corner", daylight = 0, upgrades = [], carafeTea = null, carafeProgress = 0, carafeFilling = false,
  }: Props = $props();
  const id = $props.id();
  const tiles = id + "-tiles";
  const grain = id + "-grain";
  const screen = id + "-screen";
  const steam = id + "-steam";
  const colors = {
    stock: { wall: "#9d9985", line: "#817d70", lower: "#a19479", wood: "#a17a5a", lip: "#674e43" },
    prep: { wall: "#b7a293", line: "#957d72", lower: "#b29d84", wood: "#a97d60", lip: "#6d5347" },
    brew: { wall: "#cbad8b", line: "#ae8b75", lower: "#deb697", wood: "#b77a59", lip: "#815347" },
    build: { wall: "#97ad95", line: "#798e79", lower: "#b8ae7e", wood: "#b68256", lip: "#825846" },
    serve: { wall: "#d7a78c", line: "#b47f6d", lower: "#dfaf83", wood: "#ad775a", lip: "#795146" },
  };

  const kettles = [
    { id: "black", x: 70, color: "#bd6e4c", edge: "#98513e", light: "#dd9660" },
    { id: "jasmine", x: 182, color: "#849364", edge: "#5c684d", light: "#b3b475" },
    { id: "taro", x: 294, color: "#9e7481", edge: "#735465", light: "#c597a5" },
  ];
  const jars = [
    { id: "pearls", x: 58, y: 102, color: "#90674e", shade: "#694649", bits: "#4e3a38" },
    { id: "popping", x: 144, y: 96, color: "#dca15b", shade: "#b46d4a", bits: "#e8b35c" },
    { id: "pudding", x: 230, y: 108, color: "#e7bd70", shade: "#ba8654", bits: "#f7d88d" },
  ];
  const jellyAvailable = $derived(ingredientUnlocked.includes("grass-jelly"));
  const mangoAvailable = $derived(ingredientUnlocked.includes("mango"));
  const yuzuAvailable = $derived(ingredientUnlocked.includes("yuzu"));
  const sesameAvailable = $derived(ingredientUnlocked.includes("sesame-syrup"));
  const jellyJar = { id: "grass-jelly", x: 313, y: 102, color: "#6c625e", shade: "#45454c", bits: "#36383d" };
  const pumps = [
    { id: "brown-sugar", x: 559, y: 110, contents: "#a3664b", shade: "#714c40" },
    { id: "honey", x: 642, y: 92, contents: "#d8a44c", shade: "#b17c47" },
    { id: "vanilla", x: 725, y: 110, contents: "#e0be87", shade: "#b68c64" },
  ];
  const sesamePump = { id: "sesame-syrup", x: 743, y: 110, contents: "#655850", shade: "#413930" };
  const syrupPumps = $derived(sesameAvailable ? [
    ...pumps.map((pump, index) => ({ ...pump, x: 521 + index * 74 })),
    sesamePump,
  ] : pumps);
  const jarBits = [[8, 33], [32, 28], [48, 41], [16, 50], [40, 62], [7, 74], [23, 72], [51, 75]];
  const bunPleats = ["M-23-9l6-12 12-7", "M-12-10l6-13 6-3", "M3-11v-9l-2-5", "M14-9l-4-13-6-5", "M26-4l-4-12-13-10"];

  let reduced = $state(false);
  let frame = $state(0);
  let spun = 0;
  const turnMs = 680;

  const carafeKettle = $derived(kettles.find((kettle) => kettle.id === (carafeTea ?? tea)));
  const carafeFreshness = $derived(Math.max(0, Math.min(carafeProgress, 1)));
  const waffleFill = $derived(waffleReady ? 51 : 51 * Math.max(0, Math.min(waffleProgress, 1)));
  const brewProgress = $derived(Math.min(1, Math.max(0, progress)));
  const cup = $derived(stationCup({ tea, accentTea, milk, mixins, toppings, ice, foamed, scoop, cupPrint, sparkling, sealed: sealed ?? (station === "serve" && !!tea) }, frame));
  const truckX = $derived(897 - Math.max(0, Math.min(expressProgress, 1)) * 172);
  const cupX = $derived(station === "brew" ? 468 : 454);
  const scene = $derived(colors[station]);
  const cityPalettes = {
    day: ["#d3a78f", "#9a827d", "#f2c78c"],
    rain: ["#92929b", "#767882", "#bab1a5"],
    night: ["#796a82", "#5e586c", "#d19779"],
  } as const;
  const city = $derived(cityPalettes[neighborhoodLight(branch, weather, daylight)]);

  onMount(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => reduced = motion.matches;
    update();
    motion.addEventListener("change", update);
    return () => motion.removeEventListener("change", update);
  });

  $effect(() => {
    if (!serving) {
      spun = 0;
      frame = 0;
      return;
    }
    if (reduced) {
      spun = turnMs;
      frame = 0;
      return;
    }
    if (!active || spun >= turnMs) return;
    let request = 0;
    let previous = 0;
    function turn(now: number) {
      if (previous) spun = Math.min(turnMs, spun + now - previous);
      previous = now;
      frame = Math.floor((spun / turnMs) * CUP_TURN_FRAMES) % CUP_TURN_FRAMES;
      if (spun < turnMs) request = requestAnimationFrame(turn);
    }
    request = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(request);
  });
</script>

{#snippet rivet(x: number, y: number)}
  <path d="M-2-3h4v1h1v4H2v1h-4V2h-1v-4h1z" transform="translate({x} {y})" fill="#f6d59a" stroke="#563c36" stroke-width="1.6" />
{/snippet}

{#snippet dial(value: number, x: number, y: number)}
  <g transform="translate({x} {y})">
    <path d="M-10-19h20l9 9v19l-9 10h-20l-9-10v-19z" fill="#5d4540" />
    <path d="M-7-15H7l8 8V7l-8 8H-7l-8-8V-7z" fill="#f1d5a3" />
    <path d="M-10 5h3m-2-12 2 2m7-7v3m9 2-2 2m3 10H7" fill="none" stroke="#704b3e" stroke-width="2" />
    <path d="M0 4V-8" transform="rotate({-106 + value * 212} 0 4)" fill="none" stroke="#b65347" stroke-width="2.5" />
    <path d="M-2 2h4v4h-4z" fill="#583d37" />
  </g>
{/snippet}

{#snippet leaf(x: number, y: number, tone: string)}
  <g transform="translate({x} {y})" fill={tone}>
    <path d="M-10 0h3v-4h4v-3h7v-3h6v6H8v5H4v4H-2v3h-7v-3h3V2h5v-4h5v-3h-4v3h-4v2z" />
  </g>
{/snippet}

{#snippet bunArt(x: number, y: number, scale: number)}
  <g transform="translate({x} {y}) scale({scale})" stroke-linejoin="round">
    <path d="M-52 3l13-7h77l15 7-8 10-15 5h-62l-13-5z" fill="#756050" stroke="#4d3633" stroke-width="3" />
    <path d="M-48 3l13-6h69l15 6-13 7h-73z" fill="#d79a5f" />
    <path d="M-38 0l3-15 12-13 15-5h14l16 6 12 13 6 15-8 6-21 4h-20l-19-3z" fill="#f7db9d" stroke="#67443a" stroke-width="2.6" />
    <path d="M-37 0l10-5 22 3 24-1 15-5 6 9-8 6-21 4h-20l-19-3z" fill="#deac6e" />
    {#each bunPleats as d}
      <path {d} stroke="#c7905e" stroke-width="2.3" fill="none" />
    {/each}
    <path d="M-23-20l12-7h7m-25 14 3-4m22 12h11" stroke="#fff0b5" stroke-width="3" fill="none" />
  </g>
{/snippet}

{#snippet waffleArt(x: number, y: number, scale: number)}
  <g transform="translate({x} {y}) scale({scale})" shape-rendering="crispEdges">
    <path d="M-33-8l12-10h41l12 11v15l-10 8h-44l-11-9z" fill="#6a4436" />
    <path d="M-30-5l10-8h39l10 8v11l-9 7h-41l-9-7z" fill="#b56b44" />
    <path d="M-29-7l10-9h38l10 9v9l-10 8h-39l-9-8z" fill="#f1ba73" />
    <path d="M-20-10h8v5h-8zm12 0h8v5h-8zm12 0h8v5H4zm12 0h5l4 5h-9zM-23-2h10v5h-10zm14 0H0v5h-9zm13 0h9v5H4zm13 0h8v5h-8z" fill="#ae683f" />
    <path d="M-18-12h3v2h-3zm13 9h3v2h-3zm15-9h3v2h-3zm5 16h4v2h-4zm-29 1h3v2h-3z" fill="#f8d698" />
  </g>
{/snippet}

{#snippet carton(x: number, y: number, scale: number)}
  <g transform="translate({x} {y}) scale({scale})">
    <path d="M-44-32l26-15h64l24 15v55L45 40h-64l-25-17z" fill="#553e36" />
    <path d="M-38-28h80v62h-59l-21-14z" fill="#b5825a" />
    <path d="M46-28l18-3v51L46 33z" fill="#895b49" />
    <path d="M-38-32l22-12h61l18 12-19 9h-61z" fill="#dfb078" />
    <path d="M-1-44h19l22 13-18 8v40H5v-40l17-8z" fill="#eed09a" />
    <path d="M-29-9h26v20h-26z" fill="#f1d1a1" />
    <path d="M-25-5h16v3h-16zm0 5h12v2h-12zm0 4h17v2h-17z" fill="#86644d" />
    <path d="M-30 18l9 6H-2v4h-21l-7-5z" fill="#97694f" />
  </g>
{/snippet}

<svg class="station-art" class:frozen={!active || reduced} viewBox="0 0 900 344" width="900" height="344" aria-hidden="true" focusable="false">
  <defs>
    <pattern id={tiles} width="62" height="45" patternUnits="userSpaceOnUse">
      <path d="M0 44h62M61 0v45" stroke={scene.line} stroke-width="2" />
      <path d="M2 3h10M2 5v4m17 32h13m13 0h11" stroke="#ffebbd" stroke-opacity=".34" stroke-width="1.7" />
      <path d="M52 36h4m-51-20h3" stroke="#654c46" stroke-opacity=".22" stroke-width="2" />
    </pattern>
    <pattern id={grain} width="29" height="19" patternUnits="userSpaceOnUse">
      <path d="M3 6h2m11-2h4m2 10h2M7 15h2m2-5h1" fill="none" stroke="#5b3d37" stroke-opacity=".16" stroke-width="1.3" />
      <path d="M2 9h3m19-7h2M14 17h4" fill="none" stroke="#fff1c3" stroke-opacity=".38" stroke-width="1.2" />
    </pattern>
    <pattern id={screen} width="9" height="10" patternUnits="userSpaceOnUse">
      <path d="M0 2h2v2H0zm4 5h2v2H4z" fill="#55433a" fill-opacity=".24" />
    </pattern>
    <clipPath id={id + "-loading-window"}>
      <path d="M653 56h220v175H653z" />
    </clipPath>
    <clipPath id={steam}>
      <path d="M0 0h900v310H0z" />
    </clipPath>
  </defs>

  <path d="M0 0h900v344H0z" fill={scene.wall} />
  <path d="M0 0h900v190H0z" fill="url(#{tiles})" />
  <path d="M0 0h900v15H0z" fill="#593d39" />
  <path d="M0 14h900v6H0z" fill="#f1d4a2" opacity=".48" />
  <path d="M0 190h900v60H0z" fill={scene.lower} />
  <path d="M0 190h900v7H0z" fill="#614640" opacity=".47" />
  <path d="M0 199h900v3H0z" fill="#f2c993" opacity=".7" />
  <path d="M0 228h900v81H0z" fill={scene.wood} />
  <path d="M0 229h900v8H0z" fill="#65473e" />
  <path d="M0 237h900v5H0z" fill="#edbd87" />
  <path d="M0 244h900v65H0z" fill="url(#{grain})" />
  <path d="M0 267h207l33-2h55m335 5h270M33 289h160m41 0h31m356 0h92l34 2h125m-661 5h34" opacity=".48" stroke="#754e40" stroke-width="2" fill="none" />
  <path d="M0 309h900v35H0z" fill={scene.lip} />
  <path d="M0 310h900m0 12H0" stroke="#4c3532" stroke-width="4" />
  <path d="M0 315h900m-827 16h198m18 0h25m282 0h68m13 0h151" stroke="#d99167" stroke-width="2" fill="none" opacity=".55" />
  <path d="M11 0v227m878-227v227" stroke="#64473d" stroke-width="2" opacity=".52" />

  {#if station === "brew"}
    <path d="M38 48h360v36H38z" fill="#6d4c40" opacity=".32" />
    <path d="M44 44h342v30H44z" fill="#ece0ab" stroke="#64483e" stroke-width="4" />
    <path d="M50 49h329v19H50z" fill="#b39a71" />
    <path d="M59 57h310" stroke="#634a43" stroke-width="2" />
    {#each [78, 194, 311, 366] as peg}
      {@render rivet(peg, 57)}
    {/each}

    <path d="M40 208h353l11 12-12 26H44l-19-10v-16z" fill="#58413b" />
    <path d="M39 213h352l6 10-12 8H41l-8-7z" fill="#9a6d52" />
    <path d="M45 234h336m-320 7h304" fill="none" stroke="#c39767" stroke-width="2" opacity=".75" />

    {#each kettles as kettle (kettle.id)}
      {@const lead = kettle.id === tea}
      {@const accent = kettle.id === accentTea && !lead}
      {@const selected = lead || accent}
      <g transform="translate({kettle.x} 0)">
        <path d="M5 201h73v20H6z" fill={lead ? "#e49161" : accent ? "#c2ad77" : "#6c5544"} />
        <path d="M-10 160h14l9 10v22l-10 8H-8l-9-9v-22z" fill="#685449" stroke="#493730" stroke-width="3" />
        <path d="M-9 166h11l5 5v17l-6 5h-7l-5-5v-16z" fill="#bb9777" />
        <path d="M7 145l12-14h44l13 15 5 48-11 17H15L4 196z" fill={kettle.color} stroke="#4f3733" stroke-width="4" />
        <path d="M61 137l13 13 4 43-10 16H47l16-19z" fill={kettle.edge} />
        <path d="M12 156l8-12h13m-17 17v28" stroke={kettle.light} stroke-width="5" fill="none" />
        <path d="M15 138v-6l9-9h32l9 10v5z" fill="#e7cfa0" stroke="#593c36" stroke-width="3" />
        <path d="M29 122v-8h22v8" fill="#68463a" stroke="#4d3630" stroke-width="3" />
        <path d="M68 156h12l12-10h12l-5 11-9 18-10 5h-9z" fill={kettle.light} stroke="#563b34" stroke-width="3" />
        <path d="M94 151h7m-79 53h33" stroke="#eec690" stroke-width="2" fill="none" />
        {#if selected}
          <path d="M36 200h11v6H36z" fill={accent ? "#ebdca3" : "#f5cb70"} />
        {/if}
        {@render dial(selected ? brewProgress : 0.11, 42, 173)}
        {#if accentTea && selected && brewProgress > 0 && brewProgress < 1}
          <path class="vapor" style:animation-delay={accent ? "-420ms" : undefined}
            d="M34 110v-7l5-5V88m9 21v-9l6-6v-8" fill="none" stroke="#fbdeaa" stroke-width="3" />
        {/if}
      </g>
    {/each}

    {#if upgrades.includes("tea-carafe")}
      <g transform="translate(551 0)" shape-rendering="crispEdges">
        <path d="M-28 191l8-6h36l11 7v8l-9 5h-39l-7-5z" fill="#655346" />
        <path d="M-24 192l6-5h33l8 6-7 5h-33z" fill="#a98b67" />
        <path d="M18 132h13l6 7v28l-6 9H20v-7h8l3-4v-23l-4-3h-9z" fill="#53443a" />
        <path d="M24 135h6l4 5v25l-3 5h-4l4-5v-24l-4-3h-3z" fill="#9e8d75" />
        <path d="M-16 113h30l7 9v56l-8 15h-29l-9-13v-56z" fill="#4b4039" />
        <path d="M-15 116h27l6 8v53l-7 12h-26l-7-10v-53z" fill="#879180" />
        <path d="M10 122h8v55l-7 12H2l8-11z" fill="#5e7168" />
        <path d="M-17 122h4v54h-4zm0 59h8v3h-8z" fill="#b9bc9c" />
        <path d="M-22 108l5-8h29l7 8v9h-41z" fill="#604b40" />
        <path d="M-17 104h27l5 5h-34z" fill="#c4926a" />
        <path d="M-4 94h10v6H-4z" fill="#654c40" />
        <path d="M-1 95h6v2h-6z" fill="#dab284" />
        <path d="M-12 133H7v43h-19z" fill="#423e38" />
        <path d="M-9 137H4v36H-9z" fill="#b2a58a" />
        {#if carafeTea}
          <path d="M-9 144H4v29H-9z" fill={carafeKettle?.color ?? "#bb8658"} />
          <path d="M-9 144H4v3H-9z" fill={carafeKettle?.light ?? "#e0bb87"} />
        {:else if carafeFilling}
          <path class="carafe-fill" d="M-9 144H4v29H-9z" fill={carafeKettle?.color ?? "#bb8658"} />
        {/if}
        <path d="M-7 140h2v27h-2zm4 6h5v2h-5zm0 8h5v2h-5zm0 8h5v2h-5z" fill="#fae3b4" opacity=".57" />
        <path d="M-18 181h34v5h-34z" fill="#48483e" />
        {#if carafeTea}
          <path d="M-16 182h{30 * carafeFreshness}v3H-16z" fill="#f1ca80" />
        {:else if carafeFilling}
          <path class="carafe-lamp" d="M-5 182h8v3h-8z" fill="#e8a461" />
        {/if}
      </g>
    {/if}

    <!-- Three pitchers on the dairy rail sit inside their individual drip trays. -->
    <path d="M572 72h276v17H572z" fill="#5f483d" />
    <path d="M577 74h266v6H577z" fill="#daa97a" />
    <path d="M574 212h279l19 19-15 22H570l-15-18z" fill="#51443b" />
    <path d="M575 217h276l14 13-15 10H571l-9-7z" fill="#8d8976" />
    <path d="M575 245h274v4H575z" fill="#caab81" />
    {#each [
      { id: null, x: 620, label: "PLAIN", body: "#9aa58e", shade: "#627b72", liquid: "#99ac9d" },
      { id: "milk", x: 708, label: "MILK", body: "#ebe1b9", shade: "#9da98d", liquid: "#f9e6ba" },
      { id: "oat", x: 796, label: "OAT", body: "#d6ad72", shade: "#a88459", liquid: "#efcb8c" },
    ] as pitcher}
      {@const available = pitcher.id === null || milkUnlocked.includes(pitcher.id)}
      {@const chosen = available && milkSelection === pitcher.id}
      <g transform="translate({pitcher.x} 0)" shape-rendering="crispEdges" opacity={available ? 1 : .57}>
        <path d="M-35 224l12-9h46l12 9-9 10h-52z" fill={chosen ? "#e9bc75" : "#5e574a"} />
        <path d="M-20 105h40l12 13-6 14v76l-11 13h-31l-13-13v-78l-7-10z" fill="#534138" />
        <path d="M18 143h19v9h5v35h-6v8H22v-10h9v-31H20z" fill="#56473d" />
        <path d="M25 148h10v5h4v28h-5v6h-8v-4h5v-29h-6z" fill={pitcher.shade} />
        {#if pitcher.id === "oat"}
          <path d="M-20 127l11-12v-11H9v11l12 12v76l-8 11h-26l-9-12z" fill={pitcher.body} />
          <path d="M-12 104h24v10h-24z" fill="#e2be81" stroke="#63483a" stroke-width="2" />
        {:else}
          <path d="M-26 126h48v78l-9 11h-26l-12-10z" fill={pitcher.body} />
          <path d="M-31 120l13-10h36l9 8-7 9h-42z" fill={pitcher.liquid} />
          <path d="M-24 122l9-7h31l6 4-6 5h-32z" fill={pitcher.shade} opacity=".46" />
        {/if}
        <path d="M12 132h9v70l-9 11H-2l14-13z" fill={pitcher.shade} />
        <path d="M-16 134h5v21h-5zm0 58h5v8h-5z" fill="#fff0ba" opacity=".7" />
        <path d="M-22 158h44v24h-44z" fill={pitcher.shade} />
        <path d="M-19 161h38v18h-38z" fill={chosen ? "#ffe2a1" : "#d9c49a"} />
        <g transform="translate({pitcher.id === null ? -17 : pitcher.id === "milk" ? -14 : -10} 165)" color="#533e35">
          <OrderPixelWord text={pitcher.label} cells={1.15} />
        </g>
        <path d="M-6 226H6v5H-6z" fill={chosen ? "#ffe4a0" : "#827068"} />
      </g>
    {/each}
    {#if upgrades.includes("batch-timers")}
      <path d="M393 56h120v38H393z" fill="#503e37" />
      <path d="M398 60h110v29H398z" fill="#8d957e" />
      <path d="M410 67h66v15h-66z" fill="#48554e" />
      <path d="M415 70h{56 * brewProgress}v8H415z" fill="#e6bf7f" />
      {@render rivet(493, 74)}
    {/if}
    {#if brewProgress > 0 && brewProgress < 1 && tea}
      <g clip-path="url(#{steam})" class="vapor" fill="none" stroke="#fcdfac" stroke-width="4" opacity=".74">
        <path d="M446 168v-10l-5-5v-11l6-6v-9m19 33v-9l5-5v-11l-5-5v-7m20 33v-7l6-6v-10" />
      </g>
    {/if}
  {:else if station === "build"}
    <path d="M38 55h307v34H38z" fill="#594d42" opacity=".32" />
    <path d="M45 53h292v22H45z" fill="#725445" stroke="#4e4036" stroke-width="3" />
    <path d="M48 55h284v8H48z" fill="#d1a46d" />
    <path d="M64 77v12m253-12v12" stroke="#5c4940" stroke-width="5" />
    <path d="M56 207h259l21 15-15 23H48l-15-11v-15z" fill="#5b4b41" />
    <path d="M58 210h257l12 10-12 9H51l-11-6z" fill="#a57a54" />

    {#if jellyAvailable}
      <path d="M318 208h57l19 14-15 22h-58l15-23z" fill="#5b4b41" />
      <path d="M320 212h54l13 10-10 7h-44l6-8z" fill="#a57a54" />
    {/if}
    {#each jellyAvailable ? [...jars, jellyJar] : jars as jar (jar.id)}
      <g transform="translate({jar.x} {jar.y})">
        <path d="M5 13l8-13h40l8 13 7 63-8 25H8L0 76z" fill="#f3dda5" stroke="#60483e" stroke-width="4" />
        <path d="M4 23l7-8h47l6 8v53l-8 22H9L4 82z" fill={jar.color} />
        <path d="M48 16h11l6 10v52l-9 20H40l9-22z" fill={jar.shade} />
        <path d="M3 10V1l6-7h48l7 7v9z" fill="#ab7b56" stroke="#5e483c" stroke-width="3" />
        <path d="M11 1h43m-42 12h45" stroke="#f4c889" stroke-width="2" />
        <path d="M10 23v52" stroke="#f4d4a2" stroke-width="4" fill="none" />
        {#each jarBits as [x, y]}
          <path d={jar.id === "grass-jelly" ? "M-2-2h10v9H-2z" : "M0-2h5l2 2v5l-2 2H0l-2-2V0z"} transform="translate({x + 5} {y + 6})" fill={jar.bits} />
        {/each}
        <path d="M17 42h34v26H17z" fill={toppings.includes(jar.id) ? "#f5cd7d" : "#e8c798"} stroke="#86594a" stroke-width="2" />
        {#if jar.id === "pearls"}
          <path d="M23 49h7v7h-7zm11 7h7v7h-7zm6-9h5v6h-5z" fill={jar.bits} />
        {:else if jar.id === "popping"}
          <path d="M29 50h9v-4h3v4h4v5h-5v6h-5v-5h-6z" fill="#a05e4c" />
        {:else if jar.id === "grass-jelly"}
          <path d="M24 53l11-7 10 5v9l-10 5-11-5z" fill={jar.bits} />
          <path d="M26 53l9-5 8 3-8 5z" fill="#777775" />
        {:else}
          <path d="M24 51h13v-4h5v14H25z" fill="#b97d50" />
          <path d="M25 51h11v4H25z" fill="#f2d083" />
        {/if}
      </g>
    {/each}

    {#if sesameAvailable}
      <path d="M519 213h296l27 16-7 18H515l-14-13 6-12z" fill="#625040" />
      <path d="M517 220h298l16 9-9 8H511l-5-6z" fill="#a9855a" />
    {:else}
      <path d="M546 213h269l27 16-7 18H534l-19-13 8-12z" fill="#625040" />
      <path d="M535 220h280l16 9-9 8H529l-6-6z" fill="#a9855a" />
    {/if}
    {#each syrupPumps as pump (pump.id)}
      <g transform="translate({pump.x} {pump.y})">
        <path d="M7 26h41l10 13v73l-7 8H5l-7-8V39z" fill="#edcf9b" stroke="#584238" stroke-width="4" />
        <path d="M1 44l10-5h34l10 5v68l-6 5H7l-6-6z" fill={pump.contents} />
        <path d="M42 40h9l4 5v67l-6 5H39l4-19z" fill={pump.shade} />
        <path d="M8 47v54" fill="none" stroke="#f9dda1" stroke-width="3" opacity=".65" />
        <path d="M11 22h33v12H11z" fill="#d2a470" stroke="#63483b" stroke-width="3" />
        <path d="M24 22V-2h35l6 5v6h-9V5H33v17" fill="#997653" stroke="#523e36" stroke-width="4" stroke-linejoin="round" />
        <path d="M19 65h23v25H16V70z" fill={mixins.includes(pump.id) ? "#ffe298" : "#e8cd9c"} />
        {#if pump.id === "sesame-syrup"}
          <path d="M24 73l3-4h4v4l-4 3h-3zm9 4 3-4h4v4l-4 3h-3zm-12 7 3-4h4v4l-4 3h-3z" fill={pump.shade} />
          <path d="M17 91h24v4H17z" fill="#cbb28e" />
        {:else}
          <path d="M27 71h5v4h3v6l-4 4h-4l-4-4v-6h4z" fill={pump.shade} />
        {/if}
      </g>
    {/each}

    <!-- The translucent ice hopper keeps a cluster of cubes in view. -->
    <path d="M824 132h48l7 11v77l-10 15h-41l-10-12v-80z" fill="#554a43" />
    <path d="M823 145h51v73l-8 11h-37l-6-8z" fill="#819692" />
    <path d="M826 151h40v56h-40z" fill="#b9bbb0" />
    <path d="M820 137v-18h7v-10h44v10h7v18z" fill="#5c5547" />
    <path d="M825 121h48v11h-48zm6-9h36v6h-36z" fill="#afb19a" />
    <path d="M830 173l7-5 10 6v10l-9 5-8-6zm16-12 7-5 10 6v10l-9 5-8-6zm-4 30 7-5 10 6v10l-9 5-8-6z" fill="#e8ebca" stroke="#718e89" stroke-width="2" />
    <path d="M830 173l8 5 8-5m1-12 8 5 8-5m-20 30 8 5 8-5" stroke="#92aba1" stroke-width="2" fill="none" />
    <path d="M828 213h41v9h-41z" fill="#52605a" />
    <path d="M835 215h{(ice ?? 0) > 0 ? 27 : 8}v5H835z" fill={(ice ?? 0) > 0 ? "#f5d691" : "#8b9d8b"} />
    <path d="M39 265h170l28 15-18 16H60l-31-13z" fill="#634a3b" opacity=".48" />
    <path d="M35 263h167l25 13-19 13H55l-27-12z" fill="#efc590" stroke="#78523f" stroke-width="3" />
    <path d="M48 275h158" stroke="#c68b5f" stroke-width="2" stroke-dasharray="7 4" />
    <path d="M62 273l7-6h14l7 6-7 7H69zm35 0 7-6h14l7 6-7 7h-14zm36 0 7-6h14l7 6-7 7h-14z" fill={mixins.includes("strawberry") ? "#c96a61" : "#d48972"} />
    <path d="M180 267h15l8 5-6 7h-15l-7-5z" fill={mixins.includes("banana") ? "#f9de87" : "#e2b96f"} />
    {#if mangoAvailable}
      <path d="M236 261h55l13 11v17l-16 8h-48l-14-13v-14z" fill="#664739" opacity=".5" />
      <path d="M237 261h53l12 12-12 15h-50l-13-13z" fill="#9a9d75" stroke="#625547" stroke-width="3" />
      <path d="M239 264h50l8 9-8 10h-47l-10-9z" fill="#c7bc87" />
      <path d="M240 273l9-6 11 4v7l-8 5-12-4zm19-4 10-6 11 4v7l-8 5-13-4zm17 7 9-5 7 3v5l-8 5-8-3z" fill={mixins.includes("mango") ? "#ffca65" : "#e9a451"} stroke="#a56843" stroke-width="1.5" />
      <path d="M240 273l12 3 8-5m-1-2 13 4 8-6m-4 9 8 3 8-5" fill="none" stroke="#ffe2a0" stroke-width="1.5" />
    {/if}
    {#if yuzuAvailable}
      <g transform="translate(348 268)" shape-rendering="crispEdges">
        <path d="M-29 5l8-9h42l9 9-6 14-12 6h-24l-12-6z" fill="#715949" opacity=".52" />
        <path d="M-28 2l9-9h38l10 9-7 14-12 6h-20l-12-6z" fill="#655849" stroke="#574239" stroke-width="2" />
        <path d="M-25 3l7-8h36l8 8-8 6h-37z" fill="#b3a98a" />
        <path d="M-21 10h42l-7 8h-27z" fill="#899786" />
        <path d="M-18 12h36l-4 3h-28z" fill="#bec0a0" />
        <path d="M-24-3v-7l5-7h12l6 6v7L-8 2h-10z" fill={mixins.includes("yuzu") ? "#f5d77d" : "#d9b45f"} stroke="#9b743e" stroke-width="2" />
        <path d="M-17-17v-4h7v3h5l-4 3z" fill="#798565" />
        <path d="M-8 2v-7l8-8h12l8 7v8l-7 5H0z" fill="#ab7848" />
        <path d="M-6-2l7-9h10l7 6v6l-6 4H0z" fill={mixins.includes("yuzu") ? "#ffea9e" : "#f1cf75"} />
        <path d="M5-9v4l-4 1m6-1 4 2m-6 1v4m3-9 4 3" stroke="#fff1b4" stroke-width="2" fill="none" />
        <path d="M17-7h5v2h-2v3h6v2h-8v-4h-1zm-36-4h3v3h-3zm5 5h2v2h-2z" fill="#f8dc85" />
      </g>
    {/if}
    {#if orderedSide}
      <path d="M610 276l16-10h76l19 10-5 14H622l-12-6z" fill="#805a48" opacity=".55" />
      <path d="M609 271l16-11h77l18 11-12 13h-83z" fill="#dad3ad" stroke="#665148" stroke-width="3" />
      <path d="M621 270l12-6h63l11 6-10 7h-64z" fill="#b6b191" />
      {#if orderedSide === "waffle" && waffle}{@render waffleArt(665, 271, .9)}
      {:else if orderedSide === "bun" && bun}{@render bunArt(665, 270, .78)}
      {:else}<path d="M647 271h35" stroke="#ded4af" stroke-width="2" stroke-dasharray="4 3" />{/if}
    {/if}
  {:else if station === "prep"}
    <g shape-rendering="crispEdges">
      <path d="M134 49h618v30H134z" fill="#796351" />
      <path d="M129 44h628v26H129z" fill="#5b443c" />
      <path d="M134 47h618v5H134z" fill="#c6946b" />
      <path d="M148 71h8v34h-8zm583 0h8v34h-8z" fill="#795d4e" />
      <g color="#ebca98" transform="translate(180 54)">
        <OrderPixelWord text="PEARLS" cells={2} />
      </g>
      <g color="#ebca98" transform="translate(632 54)">
        <OrderPixelWord text="BUNS" cells={2} />
      </g>
      <path d="M430 70h6v47h-6zm18 0h6v59h-6z" fill="#785b4d" />
      <path d="M422 115h22v17h-4v4h-14v-4h-4zm20 13h20v15h-4v4h-12v-4h-4z" fill="#aaa48d" stroke="#624b42" stroke-width="3" />
      <path d="M427 121h3v8h-3zm20 13h3v7h-3z" fill="#edc491" />
      {#if upgrades.includes("warm-shelf")}
        <path d="M324 66h244v13l-13 8H334l-10-8z" fill="#614641" />
        <path d="M330 68h232v8H330z" fill="#a87d54" />
        <path d="M341 77h213v6H341z" fill="#ffd597" />
        <path d="M341 83h213l109 154H229z" fill="#ffcc84" opacity=".21" />
        <path d="M363 83h170l58 133H302z" fill="#ffdf9c" opacity=".13" />
        <g color="#f9d394" transform="translate(392 54)"><OrderPixelWord text="WARM" cells={2} /></g>
      {/if}

      <path d="M123 234l36-19h173l30 19-7 37H131z" fill="#4d3e3b" />
      <path d="M128 233l31-13h171l27 13-17 11H146z" fill="#786b5d" />
      <path d="M137 247h208v18H137z" fill="#63534a" />
      <path d="M148 252h42v5h-42zm112 0h72v5h-72z" fill="#a3876c" />
      <path d="M203 249h35v12h-35z" fill="#463837" />
      <path d="M209 253h23v4h-23z" fill={pearlCooking ? "#ec9057" : "#8f7057"} />
      <path d="M163 149h-24v13h-8v16h23v-12h9zm164 0h23v13h8v16h-23v-12h-8z" fill="#4b3b3a" />
      <path d="M154 149h181v62l-12 16-25 9H185l-21-11-10-16z" fill="#667974" stroke="#493c3b" stroke-width="4" />
      <path d="M289 160h41v48l-10 14-22 9h-38l21-10 8-15z" fill="#4e615e" />
      <path d="M164 166h11v30h-11zm15 47h48v5h-48z" fill="#aeb298" />
      <path d="M155 144l15-15 33-10h80l35 10 16 15-14 16-33 8h-84l-35-8z" fill="#a4a48c" stroke="#493c3b" stroke-width="4" />
      <path d="M168 145l15-11 26-6h72l27 6 14 11-13 10-26 5h-74l-28-5z" fill="#674f46" />
      {#each [[187, 143], [204, 149], [221, 138], [234, 150], [251, 141], [269, 149], [287, 137], [300, 147]] as [x, y]}
        <path d="M{x} {y}h7v3h2v4h-2v2h-7v-2h-2v-4h2z" fill={pearlCooking || pearlReady ? "#3e3233" : "#8f694d"} />
      {/each}
      {@render dial(pearlCooking ? pearlProgress : pearlReady ? .94 : .1, 245, 195)}
      {#if pearlCooking}
        <path class="vapor" d="M208 135v-12l6-7v-9m24 24v-11l-5-6v-10m34 29v-9l7-8v-11" fill="none" stroke="#fcdfac" stroke-width="4" />
      {/if}

      {#if waffleAvailable}
        <g transform="translate(451 0)">
          <path d="M-64 226l16-11h95l19 11v16l-16 12h-99l-15-11z" fill="#503e39" />
          <path d="M-61 228l13-9h94l15 9-15 10h-94z" fill="#8b7460" />
          <path d="M-55 240h109v10H-55z" fill="#786254" />
          <path d="M-57 212l10-12h92l12 12v17H-57z" fill="#48443e" />
          <path d="M-51 213l8-8h86l8 8v11H-51z" fill="#777965" />
          <path d="M-40 214h79v5h-79z" fill="#a7a687" />
          {#if waffleReady}
            <path d="M-53 172l11-41h84l12 41-14 15h-81z" fill="#4e4139" />
            <path d="M-46 169l10-33h71l11 33-9 10h-75z" fill="#a69174" />
            <path d="M-36 153h72v16h-72z" fill="#777561" />
            <path d="M-28 149v23m14-23v23m14-23v23m14-23v23m14-23v23" stroke="#b2a083" stroke-width="2" />
            {@render waffleArt(0, 202, .88)}
          {:else}
            <path d="M-50 180l11-12h79l12 12v31H-50z" fill="#4b3c36" />
            <path d="M-46 183l10-11h72l12 11v14H-46z" fill="#b66e55" />
            <path d="M-39 183l8-8h62l9 8-9 7h-61z" fill="#d49368" />
            <path d="M-22 165h44v8H-22z" fill="#59453c" />
            <path d="M-18 165h36v3h-36z" fill="#a08465" />
            <path d="M-46 200h94v6H-46z" fill={waffleCooking ? "#ec9a60" : "#6f594c"} />
          {/if}
          <path d="M-29 243h53v4h-53z" fill="#51463d" />
          <path d="M-28 244h{waffleFill}v2h{-waffleFill}z" fill="#e8bd7d" />
          <path d="M32 242h13v7H32z" fill={waffleReady ? "#ffe39c" : waffleCooking ? "#e38c61" : "#877264"} />
          {#if waffleCooking}
            <path class="vapor" d="M-23 169v-8l-4-5v-9m20 18v-8l5-5v-9m24 25v-7l5-6v-8" fill="none" stroke="#fcdfac" stroke-width="3" />
          {/if}
        </g>
      {/if}

      <g opacity={bunAvailable ? 1 : .62}>
        <path d="M539 241l28-15h175l24 15-13 23H549z" fill="#594139" />
        <path d="M550 238l22-9h165l19 9-14 10H565z" fill="#cda371" />
        <path d="M566 115l14-13h147l16 14v110l-13 15H578l-12-14z" fill="#ac8357" stroke="#554039" stroke-width="4" />
        <path d="M569 124h171v21H569zm0 67h171v14H569zm0 30h171v10H569z" fill="#d1a170" />
        <path d="M579 146h151v44H579z" fill={bunCooking || bunReady || bun ? "#8d704e" : "#615348"} stroke="#5b443a" stroke-width="3" />
        <path d="M580 148h150v44H580z" fill="url(#{screen})" />
        <path d="M583 119h140m-149 22h160m-157 61h154m-150 25h145" stroke="#f1c890" stroke-width="3" />
        <path d="M584 151v34m139-34v34" stroke="#b69b78" stroke-width="3" />
        <path d="M607 101v-9h15v-6h59v6h15v9h-10v-5h-68v5z" fill="#665047" />
        {#if bun || bunReady || bunCooking}
          {@render bunArt(651, 172, .66)}
        {:else}
          <path d="M613 176h80l-8 8h-63z" fill="#a68560" />
        {/if}
        {@render dial(bunCooking ? bunProgress : bunReady ? .94 : .1, 655, 216)}
        {#if bunCooking}
          <path class="vapor" d="M615 107v-10l-4-5v-9m40 9v-9l5-6v-10m35 40V97l5-6v-9" fill="none" stroke="#fcdfac" stroke-width="4" />
        {/if}
      </g>
      <path d="M781 255l16-10h47l14 10-9 22h-61z" fill="#5c4d43" />
      <path d="M786 254l12-7h44l10 7-9 7h-47z" fill="#e1bc86" />
      <path d="M795 254h44m-39 4h34" stroke="#a38462" stroke-width="2" />
      <path d="M42 257h41l17 9-9 13H46l-15-12z" fill="#874f42" />
      <path d="M38 269h52l-4 7H47z" fill="#aa6b53" />
      <path d="M42 257l11-7h29l11 6-11 8H48z" fill="#f2d5a3" />
    </g>
  {:else if station === "stock"}
    <g shape-rendering="crispEdges" opacity={stockUnlocked ? 1 : .7}>
      <!-- Wire shelving and house stock. -->
      <path d="M52 34h249v191H52z" fill="#726956" opacity=".43" />
      <path d="M48 28h248v203h-13V43H60v194H48z" fill="#4d4e44" />
      <path d="M50 29h244v8H50zm1 15h5v184h-5zm234-3h5v184h-5z" fill="#91907a" />
      <path d="M60 92h222v13H60zm0 60h222v14H60zm0 61h222v14H60z" fill="#595447" />
      <path d="M63 94h217v4H63zm0 61h217v4H63zm0 60h217v4H63z" fill="#b8a284" />
      {@render carton(97, 72, .49)}
      {@render carton(164, 72, .49)}
      {@render carton(226, 132, .49)}
      {@render carton(93, 193, .5)}
      <path d="M185 184h86v28h-86z" fill="#718171" stroke="#51473d" stroke-width="4" />
      <path d="M194 190h68v5h-68zm0 9h68v6h-68z" fill="#9ca28a" />
      <path d="M82 144l2-18 7-19h56l9 18v20z" fill="#bdaf83" stroke="#665643" stroke-width="3" />
      <path d="M97 107h40v7H97zm-6 24h58v5H91z" fill="#dbc29a" />
      <path d="M215 61h17v25h-17zm25 0h17v25h-17z" fill="#bd8a67" stroke="#654f41" stroke-width="3" />
      <path d="M214 59h19v5h-19zm24 0h20v5h-20z" fill="#e4c09a" />

      <!-- The rolling door looks out onto the alley and its loading stripe. -->
      <path d="M633 37h255v202H633z" fill="#504940" />
      <g clip-path="url(#{id}-loading-window)">
        <path d="M651 54h225v176H651z" fill={city[0]} />
        <path d="M652 96h41v-20h29v11h38v48h37v-32h18V84h18V69h39v109H652z" fill={city[1]} />
        <path d="M656 114h7v12h-7zm17 0h7v12h-7zm26-18h13v11h-13zm73 55h15v9h-15zm54-54h7v10h-7zm20 0h7v10h-7z" fill={city[2]} />
        <path d="M651 171h225v60H651z" fill="#777766" />
        <path d="M652 182h224v7H652z" fill="#a39a81" />
        <path d="M656 219h40m18 0h40m18 0h40m18 0h44" stroke="#dabc83" stroke-width="3" />
        {#if expressStatus !== "idle"}
          <g transform="translate({expressStatus === 'incoming' ? truckX : 725} 150)">
            <path d="M-8 53h170v7H-8z" fill="#47433c" opacity=".65" />
            <path d="M13-38h107v86H-4V2l19-27z" fill="#463f3b" />
            <path d="M20-34h96v74H20z" fill="#e0b781" />
            <path d="M21-31h94v7H21z" fill="#f1cd9c" />
            <path d="M26-20h82v47H26z" fill={expressStatus === "arrived" ? "#695349" : "#9d9b80"} />
            {#if expressStatus === "incoming"}
              <path d="M30-13h74m-74 9h74m-74 9h74m-74 9h74" stroke="#746b59" stroke-width="3" />
            {/if}
            <path d="M13-18L0 3h16v-21z" fill="#647c74" />
            <path d="M0 10h16v22H0zm20 23h96v12H20z" fill="#af7460" />
            <path d="M13 37h21v18H13zm74 0h21v18H87z" fill="#463e3a" />
            <path d="M19 42h9v8h-9zm74 0h9v8h-9z" fill="#ae9f81" />
            <path d="M1 19h7v7H1z" fill="#f3d38f" />
          </g>
        {/if}
      </g>
      <path d="M644 45h235v191h-8V58H653v178h-9z" fill="#777e70" />
      <path d="M648 47h227v7H648z" fill="#bcc0a0" />
      <path d="M652 64h221v6H652zm0 11h221v5H652z" fill="#5d6458" />
      <path d="M641 226h242v13H641z" fill="#504941" />
      <path d="M646 227h232v4H646z" fill="#b9a382" />

      <!-- The dispatch bell and any delivered parcel use the same receiving mat. -->
      <path d="M384 84h221v33H384z" fill="#554639" />
      <path d="M390 88h209v25H390z" fill="#7d8b72" />
      <g color="#f6d8a0" transform="translate(420 92)">
        <OrderPixelWord text="DELIVERIES" cells={2.5} />
      </g>
      <path d="M384 218h229l34 23-18 42H398l-31-29z" fill="#594840" />
      <path d="M390 222h222l30 19-19 32H398l-26-22z" fill="#869282" />
      <path d="M393 227h216l25 16-15 24H401l-22-17z" fill="#69796c" />
      <path d="M397 232h208m-209 30h216m-222-21 13 13m210-15 8 7" stroke="#a9ab90" stroke-width="3" fill="none" />
      {#if expressStatus === "arrived"}
        {@render carton(502, 192, 1.28)}
      {:else}
        <path d="M447 218l18-12h89l19 12v16l-15 10h-98l-13-11z" fill="#4d3b36" />
        <path d="M453 218l14-7h84l16 8-15 8h-87z" fill="#a98c68" />
        <path d="M457 215v-7h9v-16h5v-13h10v-10h12v-6h35v6h11v10h9v13h7v16h8v7z" fill="#553e35" />
        <path d="M464 213v-5h8v-15h5v-12h8v-8h13v-5h25v5h11v8h8v12h7v15h7v5z" fill="#ca9860" />
        <path d="M478 194h8v-13h10v-7h15v7h-11v8h-7v11h-15z" fill="#f5d798" />
        <path d="M537 191h7v11h6v7h-23v-7h10z" fill="#a36d50" />
        <path d="M500 163v-8h20v8z" fill="#dda972" stroke="#573f35" stroke-width="3" />
        {#if expressStatus === "incoming"}
          <path d="M466 235h87v4h-87z" fill="#635046" />
          <path d="M468 235h{83 * Math.max(0, Math.min(expressProgress, 1))}v4h-{83 * Math.max(0, Math.min(expressProgress, 1))}z" fill="#f2c782" />
        {/if}
      {/if}
      <path d="M329 248h34l20 11v20h-46l-13-8v-16z" fill="#493d36" />
      <path d="M331 251h30l16 9-10 6h-34l-5-5z" fill="#c39569" />
      <path d="M338 257h24v4h-24z" fill="#edce97" />
    </g>
  {:else}
    <path d="M33 35h268v154H33z" fill="#6a4940" opacity=".35" />
    <path d="M39 31h249l12 11v146H27V42z" fill="#876053" stroke="#5d4038" stroke-width="4" />
    <path d="M42 47h243v127H42z" fill="#d5b197" stroke="#62463f" stroke-width="3" />
    {#if renovated || branch !== "corner" || ["market-day", "festival", "campus", "candlelight", "bottle-return"].includes(weather)}
      <OrderNeighborhoodView {branch} x={45} y={49} width={237} height={123} {weather} {daylight} {renovated} active={active && !reduced} />
    {:else}
    <path d="M42 47h243v68H42z" fill={city[0]} />
    <path d="M45 115h238v58H45z" fill="#ad9f77" />
    <path d="M45 150h238v22H45z" fill="#79917b" />
    <path d="M49 126h15v-26h17v-13h18v-14h32v14h21v13h19v27h15v-19h13V96h21v-9h25v9h19v24h17v31H49z" fill={city[1]} />
    <path d="M45 132h240v16H45z" fill={city[2]} opacity=".6" />
    {#if weather === "rain"}
      <path d="M62 58h2v11h-2zm22 24h2v14h-2zm25-27h2v12h-2zm17 48h2v14h-2zm21-40h2v14h-2zm38 14h2v15h-2zm29-19h2v13h-2zm24 50h2v12h-2zm23-39h2v15h-2z" fill="#c3c6c4" opacity=".65" />
    {/if}
    <path d="M45 158h45m42 6h56m31-9h30" stroke="#debd8a" stroke-width="2" opacity=".77" fill="none" />
    {/if}
    <path d="M163 49v125m-121-37h243" fill="none" stroke="#895b50" stroke-width="5" />
    <path d="M39 179h251m-121-130v84" fill="none" stroke="#ddb182" stroke-width="2" />
    <path d="M54 178v-16h26v17zm191 1v-18h22v18z" fill="#9d5d4a" stroke="#5d4038" stroke-width="2" />
    <path d="M65 160v-15l-8-12h8l7 11 8-10h7l-16 20v6m181 0v-10l-10-13h8l6 9 9-10h6l-13 16v8" fill="#627c62" />

    <path d="M332 220V92l17-15h210l17 15v128h-33v-116H364v116z" fill="#62443a" opacity=".5" />
    <path d="M323 220V83l16-14h208l16 14v137h-30V99H353v121z" fill="#768579" stroke="#553f36" stroke-width="4" />
    <path d="M335 82h215v17H334zm-2 20h10v108h-10zm204 0h15v108h-15z" fill="#acac86" />
    <path d="M354 98h180v27H354z" fill="#564c40" stroke="#493833" stroke-width="2" />
    <path d="M359 104h170v13H359z" fill={serving ? "#e6b85a" : "#a68658"} />
    <path d="M359 105h170v13H359z" fill="url(#{screen})" />
    {#if upgrades.includes("auto-sealer")}
      <path d="M321 131h26v46h-26z" fill="#5a483e" />
      <path d="M325 134h18v39h-18z" fill="#a39878" />
      <path d="M328 138h12v14h-12z" fill={weather === "candlelight" ? "#523f40" : autoSealing ? "#ffc785" : "#6c6653"} />
      {#if weather === "candlelight"}<path d="M331 143h6v4h-6z" fill="#b56a59" />{/if}
      <path d="M328 157h12v3h-12zm2 7h8v3h-8z" fill="#79694f" />
    {/if}
    {#if upgrades.includes("pickup-counter")}
      <path d="M533 104h18v70h-18z" fill="#baa979" />
      <path d="M537 109h10v15h-10z" fill={serving ? "#f6d597" : "#776c57"} />
      <path d="M537 129h10v34h-10z" fill="#88775e" />
    {/if}
    {#if finish === "seal"}
      <g class="seal-press">
        <path d="M404 119h80v19h-8v8h-64v-8h-8z" fill="#5a4940" />
        <path d="M410 124h68v12h-68z" fill="#c39965" />
        <path d="M416 138h56v4h-56z" fill="#f1cf90" />
      </g>
    {/if}
    <path d="M370 205h149l23 8-9 17H360l-9-13z" fill="#604c41" />
    {@render rivet(343, 90)}
    {@render rivet(542, 90)}
    {#if serving}
      <path class="handoff" d="M406 139v12m-6-6h12m89 7v12m-6-6h12m-82-36v8m-4-4h8" stroke="#fff0b1" stroke-width="3" />
    {/if}

    <g transform="translate(623 70)">
      <path d="M17 13h201v103H17z" fill="#725245" opacity=".37" />
      <path d="M6 8h206v29H6z" fill="#b78563" stroke="#67493f" stroke-width="3" />
      <path d="M1 2h217v15H1z" fill="#edc08b" stroke="#67493f" stroke-width="3" />
      <path d="M10 37h198v8H10z" fill="#705347" />
      <path d="M23 44h22v65H23zm148 0h22v65h-22z" fill="#936e53" stroke="#715347" stroke-width="2" />
      <path d="M30 44v53m149-53v53" stroke="#d3a16e" stroke-width="2" />
      {@render rivet(35, 24)}
      {@render rivet(184, 24)}
      <path d="M57-8h43L94 7H63zm60 0h43L155 7h-32z" fill="#9a6758" stroke="#65453e" stroke-width="2" />
      {@render leaf(79, -2, "#e6bc83")}
      {@render leaf(138, -2, "#e6bc83")}
    </g>
    {#if seltzerAvailable}
      <!-- Seltzer from a brass tap backed by two returnable glass bottles. -->
      <path d="M666 218h150l21 13-13 17H668l-14-13z" fill="#594941" />
      <path d="M668 222h148l16 9-11 11H671l-11-9z" fill="#839284" />
      <path d="M676 228h142m-146 5h145m-139 5h137" fill="none" stroke="#adab8d" stroke-width="2" />
      <path d="M670 216v-74l15-13h51v18h-34l-9 9v60z" fill="#56453c" />
      <path d="M675 216v-71l12-11h45v10h-32l-12 12v60z" fill="#ad8d61" />
      <path d="M678 147l11-10h39v3h-37l-10 9v60h-3z" fill="#dfbf84" />
      <path d="M687 134v-10h14v10M693 124v-12h10v12z" fill="#675044" />
      <path d="M695 113h6v10h-6z" fill="#987361" />
      <path d="M730 141h9v17h-9z" fill="#5d5346" />
      <path d="M733 144h4v11h-4z" fill="#d9b17e" />
      <path d="M670 210h24v12h-24z" fill="#64776b" />
      <path d="M675 213h15v4h-15z" fill={sparkling ? "#eed08a" : "#8e9580"} />
      <path d="M708 179h46v10h-4v25l-9 10h-23l-8-10v-25h-2z" fill="#514b40" />
      <path d="M712 183h38v3h-38zm3 7h31v23l-7 7h-18l-6-7z" fill="#a5b3a2" />
      <path d="M715 199h31v14l-7 7h-18l-6-7z" fill={sparkling ? "#c2cbb0" : "#879c8c"} />
      <path d="M718 192h3v20h-3zm6 22h9v3h-9z" fill="#d2d0b0" />
      {#each [{ x: 781, y: 167 }, { x: 810, y: 174 }] as bottle}
        <g transform="translate({bottle.x} {bottle.y})">
          <path d="M-6 0H6v11l7 9v31H-13V20l7-9z" fill="#4b5d54" stroke="#53453e" stroke-width="2" />
          <path d="M-4 4H4v9l6 9v25h-20V22l6-9z" fill="#788e7e" />
          <path d="M5 17l5 5v25H2V31h3z" fill="#617c71" />
          <path d="M-7 25h3v18h-3z" fill="#a4ac90" />
          <path d="M-8 31H8v8H-8z" fill="#d4bc93" />
          <path d="M-7-2H7v6H-7z" fill="#b18261" />
        </g>
      {/each}
      {#if sparkling}
        <g class="seltzer-bubbles" fill="#f3dda7">
          <path d="M722 198h4v4h-4zm10-10h3v3h-3zm7 17h3v3h-3zm-8 4h4v4h-4z" />
          <path d="M729 169h4v4h-4zm9-8h3v3h-3z" opacity=".84" />
        </g>
      {/if}
    {:else if floatAvailable}
      <path d="M629 218h194l19 14-15 17H625l-14-13z" fill="#514540" />
      <path d="M630 223h193l13 9-13 10H626l-7-8z" fill="#809085" />
      <path d="M637 228h178m-182 5h190" stroke="#a7ac8d" stroke-width="2" fill="none" />
      {#each [
        { id: "banana-scoop", x: 679, top: "#f6d68b", shade: "#d19f57", label: "BANANA" },
        { id: "vanilla-scoop", x: 782, top: "#f7e7bd", shade: "#cdb38a", label: "VANILLA" },
      ] as flavor (flavor.id)}
        <g transform="translate({flavor.x} 0)" shape-rendering="crispEdges">
          <path d="M-43 159l13-13h59l15 13v57l-13 15h-62l-12-15z" fill="#534540" />
          <path d="M-38 174h77v39l-10 13h-56l-11-12z" fill="#95a395" />
          <path d="M25 172h14v41l-10 13H15l10-12z" fill="#63786d" />
          <path d="M-38 158l10-9h56l11 10-10 13h-57l-10-7z" fill="#d0c1a0" />
          <path d="M-30 160l9-7h42l10 7-8 8h-44z" fill={flavor.shade} />
          <path d="M-26 161v-8h5v-5h6v-5h11v-3H7v4h9v4h6v7h5v8l-10 4h-36z" fill={flavor.top} />
          <path d="M-21 158h8v4h22v-2h10v4H17v3h-36z" fill={flavor.shade} />
          <path d="M-15 150h5v3h-5zm26-2h4v3h-4z" fill="#fff2cf" />
          <path d="M-26 184h52v22h-52z" fill={scoop === flavor.id ? "#ffe2a0" : "#d6c19a"} />
          <g transform="translate({flavor.id === "banana-scoop" ? -18 : -21} 191)" color="#5a493e">
            <OrderPixelWord text={flavor.label} cells={1.2} />
          </g>
          <path d="M-35 211h60v4h-60z" fill={scoop === flavor.id ? "#e3b978" : "#b2af94"} />
        </g>
      {/each}
    {:else if foamAvailable || foamed}
      <!-- The frother has a brass switch and a removable ceramic pitcher. -->
      <path d="M675 213h140l18 13-11 21H673l-12-14z" fill="#594539" />
      <path d="M675 215h139l14 11-10 10H673l-8-7z" fill="#b39169" />
      <path d="M755 137h43l11 11v70h-38v-58h-16z" fill="#655948" stroke="#493b35" stroke-width="3" />
      <path d="M758 140h40l7 8h-47zm35 13h11v61h-11z" fill="#9c977c" />
      <path d="M733 134h44v18h-44z" fill="#875d4c" stroke="#4f3a34" stroke-width="3" />
      <path d="M738 137h33v5h-33z" fill="#d69971" />
      <path d="M738 151h7v23h-7z" fill="#c6b694" />
      <path d="M776 181h14v22h-14z" fill="#57473d" />
      <path d="M779 184h8v10h-8z" fill={foamed ? "#ffdd8e" : "#9e7857"} />
      <path d="M768 208h37v7h-37z" fill="#45473e" />
      <g class:foam-pitcher={finish === "foam"}>
        <path d="M713 174h41l11-7-4 13v28l-9 13h-34l-9-14v-25z" fill="#4f3d37" />
        <path d="M716 179h42v28l-8 10h-30l-7-11v-23z" fill="#879989" />
        <path d="M747 180h10v25l-8 11h-10l8-13z" fill="#657b70" />
        <path d="M717 177l9-4h24l7 4-7 6h-24z" fill={foamed ? "#fff1c8" : "#bcb88f"} />
        <path d="M720 186h5v17h-5z" fill="#d8caa0" />
        <path d="M709 186h-9v9h-4v9h4v5h11v-5h-8v-8h8z" fill="#5e776d" stroke="#493b35" stroke-width="2" />
      </g>
      {#if finish === "foam"}
        <path class="foam-fizz" d="M726 169h5v5h-5zm8-10h4v4h-4zm12 8h6v5h-6z" fill="#fff1c8" />
      {/if}
    {:else}
      <path d="M696 177h113l22 12v41l-13 13H680l-10-11v-38z" fill="#6c5748" stroke="#553d36" stroke-width="4" />
      <path d="M696 184h111l14 10H684z" fill="#c99d70" />
      <path d="M686 197h129v34H686z" fill="#a47d56" />
      <path d="M699 204h104v15H699z" fill="#6c5545" />
      <path d="M740 207h22v5h-22z" fill="#eac892" />
    {/if}
  {/if}

  {#if station !== "prep" && station !== "stock"}
  <path d="M{cupX - 91} 277h174l27 15-19 10H{cupX - 95}l-21-11z" fill="#734c3d" opacity=".58" />
  {@const chilled = station === "serve" && upgrades.includes("cold-tray") && floatAvailable}
  <path d="M{cupX - 77} 267h153l22 13-20 13H{cupX - 77}l-21-14z" fill={chilled ? "#a9c0b9" : "#f3cc93"} stroke="#68483c" stroke-width="3" />
  <path d="M{cupX - 62} 274h124l15 6-14 6H{cupX - 62}l-15-6z" fill={chilled ? "#6d9599" : "#c59268"} />
  {#if chilled}
    <path d="M{cupX - 55} 276h7v3h-7zm10 6h5v2h-5zm78-6h7v3h-7zm10 5h5v2h-5z" fill="#e2dee0" />
  {/if}
  <path d="M{cupX - 71} 276l13-5m114 0 14 5" stroke="#f8dda5" stroke-width="2" opacity=".75" />
  {#if showCup}
    <path d="M{cupX - 31} 271h62l10 8-13 6H{cupX - 28}l-13-6z" fill="#80574a" opacity=".67" />
    <g class="counter-cup" transform="translate({cupX} 279) scale(4.45)" shape-rendering="crispEdges">
      <g class:shake-cup={finish === "shake"}>
        <g transform="translate({cup.translateX} {cup.translateY})">
          {#each cup.paths as { fill, d } (fill)}
            <path {fill} {d} />
          {/each}
        </g>
      </g>
    </g>
  {/if}

  {/if}

  {#if station === "serve"}
    {#if takeoutPacked !== undefined}
      <g transform="translate(45 192)"><OrderTakeoutTray packed={takeoutPacked} size={153} /></g>
    {/if}
    {#if waffle}
      <path d="M200 273l16-12h68l17 12v13l-15 10h-70l-16-10z" fill="#5f493e" />
      <path d="M203 274l15-10h64l15 10-12 13h-70z" fill="#a3a686" />
      <path d="M213 274l11-7h52l11 7-10 9h-54z" fill="#d4c896" />
      {@render waffleArt(249, 271, 1)}
    {/if}
    <path d="M628 268h145l25 13-17 13H612l-13-10z" fill="#725043" opacity=".38" />
    {#if bun}
      {@render bunArt(681, 274, 1.28)}
    {:else}
      <path d="M626 265h106l19 10-14 10H615l-12-9z" fill="#dca979" stroke="#714d42" stroke-width="3" />
      <path d="M622 271h106l10 5-11 4H621l-9-4z" fill="#ecbd86" />
      <path d="M630 272h90m-85 5h70" stroke="#b67d57" stroke-width="2" opacity=".54" fill="none" />
    {/if}
  {/if}

  <path d="M0 0h900v344H0z" fill="url(#{grain})" pointer-events="none" />
</svg>

<style>
  .station-art {
    display: block;
    inline-size: 100%;
    block-size: auto;
    overflow: hidden;
  }

  .carafe-fill {
    transform-box: fill-box;
    transform-origin: center bottom;
    animation: carafe-fill 900ms steps(6, end) infinite;
  }

  .carafe-lamp { animation: carafe-lamp 600ms steps(2, end) infinite alternate; }

  @keyframes carafe-fill {
    from { transform: scaleY(.2); }
    to { transform: scaleY(.72); }
  }

  @keyframes carafe-lamp {
    to { opacity: .48; }
  }

  .vapor {
    animation: steam 1.35s steps(6) infinite;
  }

  .handoff {
    animation: handoff 0.68s steps(6) both;
  }

  .foam-pitcher { animation: foam-pitcher 460ms steps(2, end) both; }
  .seltzer-bubbles { animation: seltzer-bubbles .92s steps(5, end) infinite; }

  @keyframes seltzer-bubbles {
    0% { transform: translateY(2px); opacity: .46; }
    70% { opacity: .9; }
    100% { transform: translateY(-7px); opacity: .36; }
  }

  .foam-fizz { animation: foam-fizz 460ms steps(4, end) both; }
  .shake-cup { animation: shake-cup 420ms steps(1, end) both; }
  .seal-press { animation: seal-press 380ms steps(3, end) both; }

  @keyframes foam-pitcher {
    28%, 74% { transform: translateY(-4px); }
    48% { transform: translate(2px, -2px); }
  }

  @keyframes foam-fizz {
    from { opacity: .95; }
    to { opacity: 0; transform: translateY(-12px); }
  }

  @keyframes shake-cup {
    15% { transform: translate(-2px, -3px) rotate(-8deg); }
    32% { transform: translate(3px, -4px) rotate(9deg); }
    49% { transform: translate(-3px, -4px) rotate(-10deg); }
    66% { transform: translate(2px, -3px) rotate(7deg); }
    84% { transform: translate(-1px, -1px) rotate(-3deg); }
  }

  @keyframes seal-press {
    0%, 100% { transform: translateY(-14px); }
    35%, 66% { transform: translateY(16px); }
  }

  .station-art.frozen :is(.vapor, .handoff, .seal-press, .shake-cup, .foam-pitcher, .foam-fizz, .carafe-fill, .carafe-lamp, .seltzer-bubbles) {
    animation-play-state: paused;
  }

  @keyframes steam {
    0% { opacity: 0.30; transform: translateY(7px); }
    62% { opacity: 0.86; }
    100% { opacity: 0.22; transform: translateY(-9px); }
  }

  @keyframes handoff {
    0%, 100% { opacity: 0; }
    25%, 62% { opacity: 0.95; }
  }

  @media (prefers-reduced-motion: reduce) {
    .vapor, .handoff, .seal-press, .shake-cup, .foam-pitcher, .foam-fizz, .carafe-fill, .carafe-lamp, .seltzer-bubbles { animation: none; }
    .carafe-fill { transform: scaleY(.45); }
  }
</style>
