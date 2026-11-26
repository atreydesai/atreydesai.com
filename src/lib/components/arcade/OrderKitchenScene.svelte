<script lang="ts">
  import { onMount } from "svelte";
  import { shopPaint, type ShopPaintId } from "#lib/arcade/orders-commissions.ts";
  import { neighborhoodLight } from "#lib/arcade/orders-station-art.ts";
  import OrderNeighborhoodView from "./OrderNeighborhoodView.svelte";
  import OrderKeepsakeCabinet from "./OrderKeepsakeCabinet.svelte";
  import OrderPixelWord from "./OrderPixelWord.svelte";

  type Station = "brew" | "build" | "serve" | "prep" | "stock";

  type CrewRole = "host" | "prep" | "runner";

  interface Props {
    station?: Station;
    upgrades?: readonly string[];
    working?: boolean;
    ready?: boolean;
    hotTeas?: readonly string[];
    prepping?: boolean;
    pearlCooking?: boolean;
    bunCooking?: boolean;
    waffleAvailable?: boolean;
    waffleCooking?: boolean;
    carafeFull?: boolean;
    crew?: readonly CrewRole[];
    certifiedCrew?: readonly string[];
    expansion?: string;
    renovated?: boolean;
    paint?: ShopPaintId;
    runnerProgress?: number;
    hostGreeting?: boolean;
    stockUnlocked?: boolean;
    keepsakes?: readonly string[];
    awards?: number;
    reservationActive?: boolean;
    preOpening?: boolean;
    expressProgress?: number;
    expressStatus?: "idle" | "incoming" | "arrived";
    weather?: string;
    daylight?: number;
    paused?: boolean;
  }

  let { station, upgrades = [], working = false, ready = false, hotTeas = [], prepping = false,
    pearlCooking = false, bunCooking = false, waffleAvailable = false, waffleCooking = false, carafeFull = false, crew = [], certifiedCrew = [], expansion = "",
    renovated = false, paint = "clay",
    runnerProgress, hostGreeting = false, stockUnlocked = false, keepsakes = [], awards = 0, reservationActive = false, preOpening = false,
    expressProgress = 0, expressStatus = "idle",
    weather = "neighborhood", daylight = 0, paused = false }: Props = $props();
  const id = $props.id();
  const floor = id + "-floor";
  const wall = id + "-wall";
  const trim = id + "-trim";
  const grain = id + "-grain";
  const city = id + "-city";

  const windows = [
    [63, 50], [87, 58], [116, 42], [130, 46], [116, 54], [155, 60],
    [177, 44], [198, 48], [184, 56], [210, 65], [235, 49], [242, 62],
  ];
  const kettles = [
    { id: "black", x: 182, y: 217, body: "#b77157", shade: "#8c4d44", light: "#d99a67" },
    { id: "jasmine", x: 233, y: 197, body: "#8d9972", shade: "#657557", light: "#c4bd84" },
    { id: "taro", x: 284, y: 179, body: "#a77d87", shade: "#785764", light: "#d0a2ab" },
  ];
  const rain = [[62,27], [78,52], [91,38], [112,66], [127,25], [139,52], [151,37], [168,79], [179,28], [193,53], [211,35], [227,69], [242,24]];
  const festivalLanterns = [[133, 29], [191, 33], [247, 34], [303, 31], [362, 25], [416, 16]];
  const windowPalettes = {
    day: { sky: "#d3a78f", horizon: "#d9b19a", distant: "#9a827d", near: "#776563" },
    rain: { sky: "#92929b", horizon: "#777684", distant: "#515460", near: "#373941" },
    night: { sky: "#51485f", horizon: "#685a6b", distant: "#393a49", near: "#30313d" },
  };
  const windowLight = $derived(neighborhoodLight(expansion, weather, daylight));
  const windowPalette = $derived(windowPalettes[windowLight]);
  const staffPosts = {
    runner: { x: 519, y: 295, shirt: "#536e60", cap: "#aac3a2", skin: "#dba174" },
    host: { x: 757, y: 241, shirt: "#995e63", cap: "#e9b39b", skin: "#926144" },
    prep: { x: 146, y: 336, shirt: "#756481", cap: "#d9b4be", skin: "#c98c68" },
  };
  const roomAccents: Record<string, { cloth: string; trim: string; sign: string }> = {
    corner: { cloth: "#687e6d", trim: "#bea87d", sign: "+" },
    campus: { cloth: "#67746b", trim: "#d9bb76", sign: "C" },
    garden: { cloth: "#62816a", trim: "#bdc38d", sign: "G" },
    night: { cloth: "#75617a", trim: "#dab498", sign: "N" },
    station: { cloth: "#557376", trim: "#c4c6a2", sign: "S" },
    harbor: { cloth: "#466d71", trim: "#d5bd92", sign: "H" },
    loft: { cloth: "#716178", trim: "#c8ad8b", sign: "L" },
  };
  const location = $derived(roomAccents[expansion] ?? roomAccents.corner);
  const room = $derived(paint === "clay" ? location : { ...shopPaint(paint), sign: location.sign });
  let reducedMotion = $state(false);
  let lastRunnerStep = $state(0);
  const runnerStep = $derived(Math.round(Math.max(0, Math.min(runnerProgress ?? 0, 1)) * 12) / 12);

  $effect(() => {
    if (!paused) lastRunnerStep = runnerStep;
  });

  onMount(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => reducedMotion = preference.matches;
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  });

  const bolts = [16, 48, 83, 116, 151, 182];
  const jars = [
    { x: 475, y: 315, fill: "#955c4e", light: "#d99767", dark: "#5c3d42" },
    { x: 506, y: 325, fill: "#c68756", light: "#ecc17b", dark: "#855348" },
    { x: 537, y: 336, fill: "#c1a366", light: "#f3d598", dark: "#97754f" },
  ];
  const queueMarks = [[665, 401], [746, 447], [652, 480], [560, 515], [465, 521], [370, 490], [276, 462]];
</script>

{#snippet block(x: number, y: number, body: string, side: string, top: string)}
  <g transform="translate({x} {y})">
    <path d="M0 0 38-13 75 0v38L38 51 0 38z" fill="#362a2d" />
    <path d="M3 2 37 14v33L3 35z" fill={body} />
    <path d="M40 14 72 3v32L40 47z" fill={side} />
    <path d="M4 0 38-11 70 0 38 12z" fill={top} />
    <path d="M9 4l25 9v3L9 7z" fill="#e6ba88" opacity=".34" />
    <path d="M10 16l16 5v3l-16-5zm0 8 19 6v2l-19-6z" fill="#382a2c" opacity=".22" />
  </g>
{/snippet}

{#snippet kettle(x: number, y: number, body: string, shade: string, light: string, hot: boolean)}
  <g transform="translate({x} {y})">
    <path d="M-33 3l12-7h47l13 7v6l-16 7h-45l-14-7z" fill="#4a3b3b" />
    <path d="M-28 3l9-5h40l10 5v5l-12 5h-37L-28 8z" fill={hot ? "#ca7955" : "#756257"} />
    <path d="M-33-27h18l6 7v14l-5 6h-15l-8-9v-10z" fill="#3b2c30" />
    <path d="M-30-23h10l4 4v10l-6 6-9-7v-8z" fill="#886752" />
    <path d="M21-22h8l7-9h11l-4 7-5 13-8 7H20z" fill="#422e32" />
    <path d="M25-19h7l7-9h5l-5 12-9 7h-6z" fill={light} />
    <path d="M-23-35l9-8h31l11 9 4 28-11 11h-35L-27-6z" fill="#3d2b30" />
    <path d="M-21-33l8-7h28l10 7 3 26-9 8h-32l-10-8z" fill={body} />
    <path d="M16-37l9 6 3 24-9 8H5l9-11z" fill={shade} />
    <path d="M-16-30h5v15h-5zm5-3h9v4h-9zm-3 28h15v3h-15z" fill={light} />
    <path d="M-18-40v-5l7-5h25l6 6v4z" fill="#422e32" />
    <path d="M-14-43l5-5h21l5 5z" fill={light} />
    <path d="M-7-49v-5H6v5z" fill="#4c3735" />
    <path d="M-3-22h10v2h3v10H7v2H-3v-2h-3v-10h3z" fill="#65423c" />
    <path d="M-3-19H6v8h-9z" fill="#ebce9d" />
    <path d="M1-17h2v3h3v2H1z" fill={hot ? "#b75349" : "#77534b"} />
  </g>
{/snippet}

{#snippet jar(x: number, y: number, body: string, light: string, dark: string)}
  <g transform="translate({x} {y})">
    <path d="M-13 1l5-4H9l9 4v4L7 9H-7l-6-3z" fill="#4a3a36" opacity=".38" />
    <path d="M-12-22h3v-5H9v5h4v3h3v16l-6 6H-9l-6-5v-17h3z" fill="#49363a" />
    <path d="M-11-20h4v-4H7v4h4v3h2v13L8 0H-8l-4-3v-14h1z" fill={body} />
    <path d="M-11-18h4v12h-4zm4-3h13v3H-7z" fill={light} />
    <path d="M7-17h6v13L8 0H-5v-3h12z" fill={dark} />
    <path d="M-4-15h4v3h-4zm7 3h4v3H3zm-8 4h4v3h-4zm6 2h4v3H1z" fill={dark} />
    <path d="M-10-28h20v5h-20z" fill="#685247" />
    <path d="M-8-28H7v2H-8z" fill="#e4bb85" />
  </g>
{/snippet}

{#snippet lamp(x: number, y: number, scale: number)}
  <g transform="translate({x} {y}) scale({scale})">
    <path d="M-2-166h4v158h-4z" fill="#593d36" />
    <path d="M-6-8H6v7H-6z" fill="#553b35" />
    <path d="M-9 0H9v3h6v4h5v4h4v4h4v8H-28v-8h4v-4h4V7h5V3h6z" fill="#533831" />
    <path d="M-9 3H9v3h6v4h5v4h4v5H-24v-5h4v-4h5V6h6z" fill="#ab614b" />
    <path d="M-9 3H3v3h-5v4h-6v4h-6v5h-8v-4h4v-5h4V6h5z" fill="#d08358" />
    <path d="M-23 19h46v5h-46z" fill="#eab57c" />
    <path d="M-12 24h24v3H-12z" fill="#ffe3a0" />
    <path d="M-31 31h3v3h-3zm53 10h3v3h-3zm-14 6h3v2H8zm-28 2h2v3h-2z" fill="#f6cb86" opacity=".48" />
  </g>
{/snippet}

{#snippet steam(x: number, y: number, delay: string)}
  <g transform="translate({x} {y})">
    <g class="steam" style:animation-delay={delay}>
      <path d="M-3 0v-7h4v-6h4v-8h4v10H5v7H1v4z" fill="#f7d6a4" opacity=".72" />
      <path d="M5-24h4v-4H5zm-11 7h3v-3h-3z" fill="#ffe3b2" opacity=".47" />
    </g>
  </g>
{/snippet}

{#snippet tableStool(x: number, y: number)}
  <g transform="translate({x} {y})">
    <path d="M-10 0l10-4 11 4-11 4z" fill="#362f37" opacity=".55" />
    <path d="M-5-9h3v7h-3zm7 0h3v8H2z" fill="#55433d" />
    <path d="M-9-13l9-4 9 4v4L0-5l-9-4z" fill="#51443d" />
    <path d="M-7-13l7-3 7 3-7 3z" fill="#8c9276" />
    <path d="M-7-12l7 3v2l-7-3z" fill="#a7a283" />
  </g>
{/snippet}

<svg class="kitchen-scene" class:still={paused} viewBox="0 0 900 535" width="900" height="535" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
  <defs>
    <pattern id={floor} width="54" height="54" patternUnits="userSpaceOnUse">
      <path d="M0 0h54v54H0z" fill="#514044" />
      <path d="M1 1h25v25H1zm27 27h25v25H28z" fill="#61504d" />
      <path d="M28 1h25v25H28z" fill="#554448" />
      <path d="M1 28h25v25H1z" fill="#59494a" />
      <path d="M1 1h25v1H1zm0 27h24v1H1zm28 0h23v1H29z" fill="#8a7161" opacity=".38" />
      <path d="M0 26h54v2H0zM26 0h2v54h-2zM0 53h54v1H0zM53 0h1v54h-1z" fill="#3f343b" />
      <path d="M5 4h5v2H5zm9 11h2v2h-2zm30-7h4v1h-4zm-10 7h2v1h-2zM5 44h3v2H5zm13-9h3v1h-3zm21 14h4v1h-4zm-5-16h2v2h-2z" fill="#ad8a71" opacity=".24" />
      <path d="M22 19h2v2h-2zm14 2h5v1h-5zm11 14h2v3h-2zm-28 9h4v2h-4z" fill="#3d343b" opacity=".42" />
    </pattern>
    <pattern id={wall} width="47" height="39" patternUnits="userSpaceOnUse">
      <path d="M0 0h47v39H0z" fill="#d1a485" />
      <path d="M1 1h45v18H1zm20 20h25v17H21z" fill="#dcb290" />
      <path d="M0 19h47v2H0zm0 19h47v1H0zM46 0h1v19h-1zM19 21h2v17h-2z" fill="#ae806f" />
      <path d="M2 2h42v1H2zm21 20h22v1H23zM2 22h12v1H2z" fill="#efd0a6" opacity=".78" />
      <path d="M8 10h3v2H8zm23 18h5v1h-5zm8 4h2v2h-2zm-34-3h2v2H5zm31-16h5v1h-5z" fill="#a7766b" opacity=".39" />
    </pattern>
    <pattern id={trim} width="27" height="27" patternUnits="userSpaceOnUse">
      <path d="M0 0h27v27H0z" fill="#7c655b" />
      <path d="M1 1h25v25H1z" fill="#aa8667" />
      <path d="M2 2h23v23H2z" fill="#77796a" />
      <path d="M11 4h5v4h4v3h3v5h-3v4h-4v3h-5v-3H7v-4H4v-5h3V8h4z" fill="#b89a70" />
      <path d="M11 11h5v5h-5z" fill="#614e4c" />
    </pattern>
    <pattern id={grain} width="32" height="20" patternUnits="userSpaceOnUse">
      <path d="M2 2h6v1H2zm9 4h3v2h-3zm12 8h7v1h-7zm-19 2h3v2H4zm20-14h4v1h-4z" fill="#eac390" opacity=".32" />
      <path d="M15 12h5v1h-5zm10-8h5v1h-5zm-17 6h4v1H8zm2 8h5v1h-5z" fill="#372c30" opacity=".23" />
    </pattern>
    <clipPath id={city}>
      <path d="M54 26h194v90H54z" />
    </clipPath>
  </defs>

  <path d="M0 0h900v535H0z" fill="#383037" />

  <!-- The wall fold and the full projected tile grid share the same corner. -->
  <g transform="matrix(1 -.36 0 1 0 94)">
    <path d="M0-78h450v265H0z" fill="url(#{wall})" />
    <path d="M0-17h450v10H0z" fill="#b08a72" opacity=".75" />
    <path d="M0 120h450v5H0z" fill="#e7b485" />
    <path d="M0 126h450v55H0z" fill="#81917f" />
    <path d="M0 126h450v55H0z" fill="url(#{grain})" />
    <path d="M0 126h450v6H0zm0 45h450v11H0z" fill="#526759" />
    <path d="M0 135h450v3H0z" fill="#b5b89a" />
    <path d="M12 145v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23" stroke="#687e6d" stroke-width="2" />
    <path d="M0 178h450v9H0z" fill="#6c4d48" />
    <path d="M0 179h450v2H0z" fill="#c29472" />
  </g>
  <g transform="matrix(1 .36 0 1 450 -68)">
    <path d="M0-70h450v257H0z" fill="url(#{wall})" />
    <path d="M0-70h450v257H0z" fill="#6a4b48" opacity=".16" />
    <path d="M0-17h450v10H0z" fill="#ac795f" opacity=".64" />
    <path d="M0 120h450v5H0z" fill="#ddb38e" />
    <path d="M0 126h450v55H0z" fill="#778276" />
    <path d="M0 126h450v55H0z" fill="url(#{grain})" />
    <path d="M0 126h450v6H0zm0 45h450v11H0z" fill="#4f6259" />
    <path d="M0 135h450v3H0z" fill="#a3a78c" />
    <path d="M12 145v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23m25-23v23" stroke="#606f65" stroke-width="2" />
    <path d="M0 178h450v9H0z" fill="#60443f" />
    <path d="M0 179h450v2H0z" fill="#aa805f" />
  </g>

  <g transform="matrix(1 .36 -1 .36 450 119)">
    <path d="M0 0h620v620H0z" fill="url(#{floor})" />
    <path d="M0 0h620v27H27v593H0z" fill="url(#{trim})" />
    <path d="M27 0h4v620h-4zm0 27h593v4H27z" fill="#392c32" />
    <path d="M32 32h315v23H55v303H32z" fill="#2e2a33" opacity=".22" />
    <path d="M371 454h153v89H371z" fill="#302b35" opacity=".48" />
    <path d="M374 457h146v83H374z" fill="#857469" />
    <path d="M376 459h142v79H376z" fill="#53494c" />
    <path d="M380 463h134v71H380zm4 4v63h126v-63z" fill="#b89871" fill-rule="evenodd" opacity=".54" />
    <path d="M444 480h9v8h9v6h9v9h-9v6h-9v8h-9v-8h-9v-6h-9v-9h9v-6h9z" fill="#a28f72" />
    <path d="M444 494h9v9h-9zm-52 0h6v9h-6zm104 0h6v9h-6z" fill="#b98067" />
    <path d="M485 38h64v5h-64zm73 0h24v5h-24zM33 456h5v60h-5zm0 68h5v22h-5z" fill="#a28772" opacity=".36" />
  </g>
  <path d="M445 0h5v119l-5 2z" fill="#c19074" />
  <path d="M450 0h5v121l-5-2z" fill="#94705f" />

  <!-- A warm tile runner connects the sidewalk to the customer lane. -->
  <path d="M758 452 900 401v68l-63 23z" fill="#453943" />
  <path d="M762 450 900 400v56l-65 23z" fill="#65515b" />
  <path d="M766 453 900 405m-112 57 112-40m-89 48 89-32m-45 34 45-16m-88-13 22 8m24-37 22 8m-37 28 22 8m-75 7 22 8" stroke="#52434f" stroke-width="2" />
  <path d="M769 451 900 404v3l-127 46zm58 23 73-26v4l-69 25z" fill="#9a7d75" opacity=".7" />
  <path d="M800 432 885 402l15 7v16l-61 22z" fill="#ceb084" opacity=".23" />
  {#if weather === "rain"}
    <path d="M788 451l28-10 18 5-30 11zm35 14 33-12 20 7-32 13zm29-26 31-11 13 4-32 12z" fill="#829198" opacity=".46" />
    <path d="M805 450l16-6m24 18 20-7m6-18 17-6" stroke="#c7b6ad" stroke-width="2" opacity=".65" />
  {/if}
  <path d="M765 383 836 410 807 421 736 394z" fill="#9b7153" opacity=".19" />
  {#each queueMarks as [x, y]}
    <g transform="translate({x} {y})">
      <path d="M-22 0 0-8 22 0 0 8z" fill="#aa926d" opacity=".45" />
      <path d="M-18 0 0-6 18 0 0 6z" fill="#66514a" />
      <path d="M-10 0 0-4 10 0 0 4z" fill="#c2a47a" opacity=".63" />
    </g>
  {/each}
  <path d="M728 364 757 353 785 364 757 375z" fill="#3b3937" />
  <path d="M733 364 757 355 781 364 757 373z" fill="#72816d" />
  <path d="M742 364 757 359 771 364 757 369z" fill="#cbb584" />
  <g transform="matrix(1 -.36 .82 .4 689 436)" color="#dcb989" opacity=".85">
    <OrderPixelWord text="QUEUE" cells={2} />
  </g>

  <!-- The side window looks out over a second block. -->
  <g transform="matrix(1 -.36 0 1 0 109)">
    <path d="M42 18h216v109H42z" fill="#7b5850" opacity=".42" />
    <path d="M43 16h211v111H43z" fill="#543b3a" />
    <path d="M47 20h203v98H47z" fill="#ae7d65" />
    <path d="M52 24h197v94H52z" fill="#3d414f" />
    {#if renovated || (expansion && expansion !== "corner") || ["market-day", "festival", "campus", "candlelight", "bottle-return"].includes(weather)}
      <OrderNeighborhoodView branch={expansion || "corner"} x={54} y={26} width={194} height={90} {weather} {daylight} {renovated} active={!paused} />
    {:else}
    <g clip-path="url(#{city})">
      <path d="M54 26h194v37H54z" fill={windowPalette.sky} />
      <path d="M54 62h194v34H54z" fill={windowPalette.horizon} />
      <path d="M54 68h14v2H54zm29 0h15v2H83zm39 0h12v2h-12zm58 0h15v2h-15zm46 0h10v2h-10z" fill="#6c5261" />
      <path d="M54 116V81h12v-6h19v12h16V58h37v19h9V66h22v10h8v9h18V62h27v13h12v8h14v33z" fill={windowPalette.distant} />
      <path d="M54 116V98h19v-6h24v9h25V90h27v7h22v-9h22v11h27v-8h28v25z" fill={windowPalette.near} />
      <path d="M64 104h4v3h-4zm10 0h4v3h-4zm36 4h4v3h-4zm33-8h4v3h-4zm39-3h4v3h-4zm50 5h5v3h-5zM108 67h5v3h-5zm13 0h5v3h-5zm0 9h5v3h-5zm31 1h4v3h-4zm54-6h6v3h-6z" fill="#c38a73" />
      <path d="M108 76h5v3h-5zm29 26h4v3h-4zm65 6h5v3h-5zm4-29h6v3h-6z" fill="#e9ad78" />
      {#if windowLight !== "day"}
        {#each windows as [x, y]}
          <path d="M{x} {y}h2v2h-2z" fill="#d7a391" opacity=".69" />
        {/each}
      {/if}
      {#if windowLight === "rain"}
        <path d="M71 42h42v3H71zm61 5h55v3h-55zm69-9h38v3h-38z" fill="#8f8791" opacity=".7" />
        <g class="rain" fill="#b3bcc1" opacity=".63">
          {#each rain as [x, y]}
            <path d="M{x} {y - 23}h2v8h-2zm0 32h2v8h-2zm0 32h2v8h-2z" />
          {/each}
        </g>
      {:else if windowLight === "night"}
        <path d="M212 34h11v3h4v5h2v7h-3v5h-5v3h-9v-2h-5v-4h-3v-9h3v-5h5z" fill="#ead0a1" />
        <path d="M219 35h4v3h4v5h2v6h-3v5h-5v3h-4v-4h6v-6h3v-5h-3v-4h-4z" fill="#c39a83" />
      {:else}
        <path d="M65 50h13v-4h22v3h9v4H65zm104-10h15v-3h22v4h12v4h-49z" fill="#eed0aa" opacity=".76" />
      {/if}
    </g>
    {/if}
    <path d="M116 22h5v95h-5zm64 0h5v95h-5zM50 74h200v5H50z" fill="#5d4540" />
    <path d="M116 25h2v47h-2zm64 0h2v47h-2zM50 75h199v1H50z" fill="#c39170" />
    <path d="M39 116h218v9H39z" fill="#d9a47b" />
    <path d="M39 124h218v7H39zM53 131h15v8H53zm180 0h15v8h-15z" fill="#79564a" />
  </g>

  <!-- Tea tins, a hanging colander, and the rail over the range. -->
  <g transform="matrix(1 -.36 0 1 0 81)">
    <path d="M270 79h157v10H270z" fill="#62473f" />
    <path d="M271 79h156v4H271z" fill="#bc8c68" />
    <path d="M281 89h10v15h-8zm125 0h10l-3 15h-7z" fill="#765446" />
    <path d="M284 58h21v21h-21z" fill="#ad6d58" />
    <path d="M309 62h21v17h-21z" fill="#74816e" />
    <path d="M336 54h19v25h-19z" fill="#896371" />
    <path d="M361 59h23v20h-23z" fill="#ab815d" />
    <path d="M282 55h25v5h-25zm25 4h25v5h-25zm27-7h23v5h-23zm25 4h27v5h-27z" fill="#654940" />
    <path d="M290 65h10v8h-10zm24 3h12v7h-12zm26-4h10v8h-10zm26 1h13v8h-13z" fill="#e5bf89" />
    <path d="M395 67h5v-7h5v-4h9v4h5v7h4v6h-5v6h-18v-5h-5z" fill="#69584c" />
    <path d="M401 66h15v5h-15zm3-6h9v4h-9z" fill="#af9a74" />
    <path d="M277 112h146v4H277z" fill="#6e5247" />
    <path d="M292 113h3v16h-3zm25 0h3v18h-3zm29 0h3v15h-3zm35 0h3v19h-3zm23 0h3v17h-3z" fill="#674741" />
    <path d="M288 128h10v13h-10zm25 0h5v18h-5zm8 0h5v18h-5zm22 0h8v13h-8zm34 3h10v9h-10zm24-2h10v14h-10z" fill="#9e715b" />
    <path d="M286 135h14v2h-14zm54 0h14v2h-14zm36-3h12v2h-12zm23-2h14v2h-14z" fill="#d1ae86" />
  </g>

  <!-- A narrow back door with reeded glass anchors the wall corner. -->
  <g transform="matrix(1 .36 0 1 450 -66)">
    <path d="M31 63h71v123H31z" fill="#6a4e46" opacity=".48" />
    <path d="M28 57h70v121H28z" fill="#66483e" />
    <path d="M33 62h61v113H33z" fill="#ab7a5d" />
    <path d="M39 69h47v97H39z" fill="#7f5b4e" />
    <path d="M41 71h42v56H41z" fill="#596966" />
    <path d="M45 73h5v51h-5zm10 0h5v51h-5zm10 0h5v51h-5zm10 0h5v51h-5z" fill="#818a74" />
    <path d="M43 132h34v28H43z" fill="#966a55" />
    <path d="M45 135h30v2H45zM79 137h9v4h-9z" fill="#d6a779" />
  </g>

  {#if stockUnlocked}
    <g transform="matrix(1 .36 0 1 450 -66)">
      <path d="M22 53h86v21H22z" fill="#583f37" />
      <path d="M25 55h80v16H25z" fill={station === "stock" ? "#e7bd7b" : "#ae8462"} />
      <g transform="translate(35 58)" color="#4d3a35">
        <OrderPixelWord text="STOCK" cells={1.9} />
      </g>
      <path d="M41 71h42v56H41z" fill={expressStatus === "arrived" ? "#cba467" : "#53605e"} />
      <path d="M45 74h5v49h-5zm10 0h5v49h-5zm10 0h5v49h-5zm10 0h5v49h-5z" fill="#e9c697" opacity=".29" />
      {#if expressStatus === "incoming"}
        <path d="M43 117h38v5H43z" fill="#454b48" />
        <path d="M45 118h{34 * Math.max(0, Math.min(expressProgress, 1))}v3H45z" fill="#dba468" />
      {/if}
      {#if expressStatus === "arrived"}
        <path d="M43 118h33v25H43z" fill="#80573e" stroke="#573d35" stroke-width="2" />
        <path d="M46 120h27v17H46z" fill="#c28f5e" />
        <path d="M55 120h6v17h-6z" fill="#e7ba7c" />
      {/if}
    </g>
    <path d="M475 134l41 15 44-15 12 7-56 20-53-19z" fill="#555954" />
    <path d="M475 137l41 15 44-15 5 3-49 18-46-17z" fill="#86927b" />
  {/if}

  <!-- The service pass sits beneath the shop's painted boba menu. -->
  <g transform="matrix(1 .36 0 1 450 -12)">
    <path d="M117 31h210v111H117z" fill="#6f4d48" opacity=".52" />
    <path d="M112 26h208v109H112z" fill="#523a39" />
    <path d="M118 31h196v101H118z" fill="#b68366" />
    <path d="M125 38h182v93H125z" fill="#76534b" />
    <path d="M129 42h173v84H129z" fill="#a5735f" />
    <path d="M129 43h173v12H129z" fill="#8c5e55" />
    <path d="M129 102h173v24H129z" fill="#765044" />
    <path d="M137 71h38v32h-38zm104-9h48v40h-48z" fill="#5e4b47" />
    <path d="M140 74h32v25h-32zm104-9h42v33h-42z" fill="#d1a174" />
    <path d="M141 82h13v17h-13zm16 4h13v13h-13zm89-6h11v18h-11zm15-7h11v25h-11zm15 13h9v12h-9z" fill="#936556" />
    <path d="M157 42h3v16h-3zm70 0h3v14h-3zm38 0h3v12h-3z" fill="#59433e" />
    <path d="M151 58h15v3h4v4h-23v-4h4zm70-2h15v3h4v4h-23v-4h4zm38-2h15v3h4v4h-23v-4h4z" fill="#d48c5f" />
    <path d="M150 64h17v3h-17zm70-2h17v3h-17zm38-2h17v3h-17z" fill="#edc485" />
    {#if upgrades.includes("cozy-seats")}
      <path d="M207 109h71v10h-71zm5 10h6v7h-6zm55 0h6v7h-6z" fill="#5c4242" />
      <path d="M210 105h65v8h-65z" fill="#a36d62" />
      <path d="M211 106h62v2h-62z" fill="#e5ac83" />
    {/if}
    {#if upgrades.includes("street-sign")}
      <path d="M276 84h14l7 32h-24z" fill="#513d3c" />
      <path d="M278 87h10l5 24h-17z" fill="#7e8371" />
      <path d="M280 93h8v2h-8zm0 5h8v2h-8zm-1 5h11v2h-11z" fill="#d6c498" />
    {/if}
    <path d="M124 38h7v92h-7zm174 0h8v92h-8zM123 37h184v7H123z" fill="#69483e" />
    <path d="M109 123h216v10H109z" fill="#d8a077" />
    <path d="M109 132h216v6H109z" fill="#78513f" />
    <path d="M119 21h205v58H119z" fill="#64463e" opacity=".55" />
    <path d="M111 12h208v63H111z" fill="#513c39" />
    <path d="M115 15h200v57H115z" fill="#a67454" />
    <path d="M119 19h192v49H119z" fill="#46514b" />
    <path d="M121 20h188v2H121zm0 45h188v1H121z" fill="#807f63" />
    <g transform="translate(175 25)" color="#f8dda2">
      <OrderPixelWord text="BOBA" cells={4} />
    </g>
    <g transform="translate(181 54)" color="#bcb991">
      <OrderPixelWord text="MILK TEA" cells={1.5} />
    </g>
    <path d="M132 35h29v4h-2v13h-4v5h-16v-5h-4V39h-3zm17-3v-7h4v-3h5v4h-5v6z" fill="#cf956d" />
    <path d="M137 40h18v8h-2v5h-12v-5h-4z" fill="#edd19b" />
    <path d="M139 47h4v3h-4zm6 3h4v3h-4zm5-5h4v3h-4z" fill="#654b48" />
    <path d="M277 29h23v3h-23zm0 7h18v2h-18zm0 7h25v2h-25zm0 7h15v2h-15z" fill="#b0ab88" />
  </g>

  <g transform="matrix(1 .36 0 1 450 -41)">
    <path d="M352 58h70v12h-70z" fill="#68514a" />
    <path d="M352 57h70v4h-70z" fill="#b58b6e" />
    <path d="M361 67h5v17h-5zm48 0h6v17h-6z" fill="#694f46" />
    <path d="M359 40h16v16h-16zm20-5h13v21h-13zm20 9h17v12h-17z" fill="#758371" />
    <path d="M357 37h20v5h-20zm20-5h17v5h-17zm20 9h21v5h-21z" fill="#664d47" />
    <path d="M364 45h6v6h-6zm17-4h8v8h-8zm22 6h9v6h-9z" fill="#d2b88e" />
    {#if awards > 0}
      <g transform="translate(349 96)" class="wall-awards">
        <OrderKeepsakeCabinet tier={awards} size={76} />
      </g>
    {:else}
      <path d="M371 115h36v35h-36z" fill="#8d6657" />
      <path d="M375 119h27v27h-27z" fill="#d5ad8b" />
      <path d="M382 122h14v3h-14zm-3 7h16v2h-16zm0 6h19v2h-19zm0 6h12v2h-12z" fill="#996557" />
    {/if}
  </g>

  {#if weather === "festival"}
    <g transform="matrix(1 .36 0 1 450 -68)">
      <path d="M107 14h26v5h58v4h56v1h56v-3h59v-6h54v-8h34" stroke="#614341" stroke-width="3" fill="none" />
      {#each festivalLanterns as [x, y], index}
        <g transform="translate({x} {y})">
          <path d="M-1-10h2V0h-2zM-8 0H8v3h4v15H8v4H-8v-4h-4V3h4zm6 22h4v5h-4z" fill="#6c453c" />
          <path d="M-6 3H6v3h3v10H6v3H-6v-3h-3V6h3z" fill={index % 2 ? "#d2a267" : "#b97962"} />
          <path d="M-4 6h5v9h-5zm2 13h5v2h-5z" fill="#f7d995" />
        </g>
      {/each}
    </g>
  {/if}

  <!-- Branch details are mounted high on the wall to leave the work areas clear. -->
  {#if expansion === "campus"}
    <g transform="matrix(1 -.36 0 1 0 81) translate(245 -39)">
      <path d="M27 73h64v47H27z" fill="#684b40" />
      <path d="M31 77h56v39H31z" fill="#b6936a" />
      <path d="M36 81h21v20H36zm24 4h21v25H60z" fill="#e8d3a4" />
      <path d="M39 87h15v2H39zm0 5h12v2H39zm24-1h15v2H63zm0 5h12v2H63zm0 5h15v2H63z" fill="#887763" />
      <path d="M39 80h4v4h-4zm35 4h4v4h-4z" fill="#a66b58" />
    </g>
  {:else if expansion === "garden"}
    <g transform="translate(579 104)">
      <path d="M-5-104h3v78h-3zm22 0h3v78h-3z" fill="#7c604d" />
      <path d="M-12-26h40l-5 14H-7z" fill="#ae795c" stroke="#654a43" stroke-width="3" />
      <path d="M5-27v-15H-3v-7h-7v-6H1v5h8v10h5v-14h7v-7h9v6h-5v10h-6v18z" fill="#557c65" />
      <path d="M15-30h6v11h5v6h5v8h-6v-6h-5v-8h-5zm-17-8h6v7h-6z" fill="#839574" />
      <path d="M-9-24h34v3H-9z" fill="#d6a980" />
    </g>
  {:else if expansion === "night"}
    <path d="M768 19l49 20 57 18" fill="none" stroke="#6f494b" stroke-width="3" />
    {#each [[788, 29], [826, 43], [861, 54]] as [x, y]}
      <g transform="translate({x} {y})">
        <path d="M-1 0h2v9h-2zm-10 10h22v4h4v20h-4v4h-22v-4h-4V14h4zm9 28h4v5h-4z" fill="#754947" />
        <path d="M-9 14H9v4h3v12H9v4H-9v-4h-3V18h3z" fill="#bc765b" />
        <path d="M-4 14h8v20h-8z" fill="#e2a66b" />
        <path d="M-2 18h4v12h-4z" fill="#f4cb87" />
      </g>
    {/each}
  {:else if expansion === "station"}
    <g transform="translate(786 66)">
      <path d="M-11-16h22v4h5v24h-5v4h-22v-4h-5v-24h5z" fill="#5a5149" />
      <path d="M-9-12H9v4h3V8H9v4H-9V8h-3V-8h3z" fill="#d8ba8f" />
      <path d="M-1-8h3v9h7v3H-1zM-9 0h2v2h-2zm8 7h2v2h-2z" fill="#60574b" />
    </g>
    <g transform="matrix(1 .36 0 1 450 -61)">
      <path d="M369 77h62v30h-62z" fill="#59483f" />
      <path d="M373 81h54v22h-54z" fill="#677a71" />
      <path d="M377 85h13v3h-13zm17 0h27v3h-27zm-17 6h13v3h-13zm17 0h21v3h-21zm-17 6h13v3h-13zm17 0h27v3h-27z" fill="#d6c49b" />
    </g>
  {/if}

  {#if keepsakes.includes("postcard")}
    <g data-keepsake="postcard" transform="matrix(1 -.36 0 1 11 157)">
      <path d="M0 4h26v18H0z" fill="#76584c" opacity=".5" />
      <path d="M0 1h25v18H0z" fill="#ebd1a3" stroke="#805b4c" stroke-width="1.5" />
      <path d="M3 4h19v9H3z" fill="#a5a68d" />
      <path d="M4 13V9h4V7h4v3h4V8h4v5z" fill="#637f6d" />
      <path d="M17 5h3v3h-3zM3 15h13v1H3z" fill="#f8dfa3" />
      <path d="M12-1h3v5h-3z" fill="#b56b56" />
    </g>
  {/if}
  {#if upgrades.includes("wall-calendar")}
    <g transform="matrix(1 .36 0 1 708 87)" shape-rendering="crispEdges">
      <path d="M0 2h38v32H0z" fill="#71574c" opacity=".65" />
      <path d="M1 0h35v31H1z" fill="#e0bc8f" stroke="#846353" stroke-width="1.5" />
      <path d="M1 0h35v7H1z" fill="#aa7760" />
      <path d="M7 10h3v17H7zm6 0h3v17h-3zm6 0h3v17h-3zm6 0h3v17h-3zm6 0h2v17h-2z" fill="#d1ab86" />
      <path d="M5 15h29v2H5zm0 6h29v2H5z" fill="#e6c8a0" />
      <path d="M19 11h3v3h-3zm6 8h3v3h-3z" fill="#7d8b6d" />
      <path d="M17-2h4v4h-4z" fill="#654b42" />
    </g>
  {/if}
  {#if keepsakes.includes("plant")}
    <g transform="translate(548 61)">
      <path d="M-12 13l12-4 14 5-13 5z" fill="#604b41" />
      <path d="M-11 11l11-4 14 5-13 5z" fill="#bd936d" />
      <path d="M-9 4h18l-3 9h-12z" fill="#8b634d" stroke="#593f3a" stroke-width="1.5" />
      <path d="M-7 5H7v3H-7z" fill="#c58e6b" />
      <path d="M-1 4v-13h-4v-4h-6v-5h7v4h6v7h3v-10h4v-4h6v5h-5v6H7V4z" fill="#5b826d" />
      <path d="M-8-17h4v2h-4zm19-2h3v2h-3zM3-8h3v4H3z" fill="#a4aa7e" />
    </g>
  {/if}
  {#if keepsakes.includes("cup-trophy")}
    <g transform="matrix(1 .36 0 1 450 -41) translate(349 58)">
      <path d="M-12 0h24v5H-12z" fill="#825d4a" />
      <path d="M-12 0h24v2H-12z" fill="#c49971" />
      <path d="M-10-19h5v-3H6v3h5v7h-3l-3 5H2v3h4v4H-6v-4h4v-3h-3l-3-5h-2z" fill="#6d4d3c" />
      <path d="M-4-20H5v9L2-8h-3l-3-3z" fill="#e4af67" />
      <path d="M-3-18h6v2h-6zm2 10h2v5h-2zm-4 5H5v2H-5z" fill="#f1ca84" />
      <path d="M-7-17h2v3h-2zm13 0h2v3H6zM0-14h2v2H0z" fill="#bc895d" />
    </g>
  {/if}

  <!-- Floor shadows keep the furniture grounded in the same room. -->
  <path d="M56 233 245 163 365 206 365 264 173 338 48 293z" fill="#332b35" opacity=".43" />
  <path d="M562 207 704 150 861 206 861 271 731 327 566 269z" fill="#322b35" opacity=".42" />
  <path d="M370 337 491 290 634 346 634 409 519 460 366 403z" fill="#332a33" opacity=".54" />

  <!-- The left run houses the range and wash basin. -->
  <path d="M66 227 245 161 350 200v58l-178 67-106-39z" fill="#3e3034" />
  <path d="M71 232 170 269v49l-99-36z" fill="#65574e" />
  <path d="M176 270 347 207v47l-171 64z" fill="#7f775f" />
  <path d="M179 273 344 212v6l-165 60z" fill="#b9a37c" />
  <path d="M180 288 343 228v3l-163 60z" fill="#574941" />
  <path d="M228 253v34m67-59v34" stroke="#50443e" stroke-width="3" />
  <path d="M186 282l25-9v4l-25 9zm54-20 26-10v4l-26 10zm68-25 24-9v4l-24 9z" fill="#cfad7e" />
  <path d="M83 247l73 27v26l-73-27z" fill="#3e373a" />
  <path d="M88 252l63 24v18l-63-24z" fill="#69504a" />
  <path d="M91 255l56 21v5l-56-21z" fill="#ae8061" />
  <path d="M71 281 170 317l178-65v9l-176 66L71 290z" fill="#4c3737" />
  <path d="M62 220 244 153 353 193v12l-182 67-109-40z" fill="#483638" />
  <path d="M67 220 244 156 348 194 172 258z" fill="#c29167" />
  <path d="M67 220 244 156 348 194 172 258z" fill="url(#{grain})" />
  <path d="M65 224 170 263v5L65 229z" fill="#a47357" />
  <path d="M173 262 350 197v5l-177 66z" fill="#e1ab7c" />
  <path d="M117 221 252 172 326 198 193 247z" fill="#463a3b" />
  <path d="M123 221 252 175 320 199 193 244z" fill="#8d8674" />
  <path d="M127 224l64 23 130-47-1 6-128 48-65-24z" fill="#585153" />
  <path d="M153 219l26-9 28 10-25 9zm52-20 26-9 27 10-25 9zm53-19 26-9 25 10-24 9z" fill="#4f4241" />
  {#each kettles as pot (pot.id)}
    {@render kettle(pot.x, pot.y, pot.body, pot.shade, pot.light, hotTeas.includes(pot.id))}
  {/each}

  <path d="M72 209 104 197l28 10v17l-31 11-29-10z" fill="#604b42" />
  <path d="M75 210 103 200l25 8-28 10z" fill="#acb4a2" />
  <path d="M80 210 103 203l20 6-23 7z" fill="#74867e" />
  <path d="M77 214l23 8v8l-23-8zm27 8 23-8v8l-23 8z" fill="#89998a" />
  <path d="M96 204v-15h4v-4h11v12h-4v-8h-6v15z" fill="#e1c392" />
  <path d="M322 194l24-9 25 9v13l-23 9-26-9z" fill="#564438" />
  <path d="M324 195l23-7 22 7-22 7z" fill="#d09b67" />
  <path d="M326 198l20 7v8l-20-7z" fill="#a97452" />
  <path d="M350 205l17-7v7l-17 7z" fill="#855b48" />
  <path d="M336 192v-6h4v-5h15v5h4v6l-5 3h-13z" fill="#f1c983" />
  <path d="M342 185h11v3h-11z" fill="#ffe1a2" />

  {#if upgrades.includes("tea-carafe")}
    <g transform="translate(141 226)">
      <path d="M-12 1l11-4L14 2 3 7z" fill="#685044" />
      <path d="M10-28h9v5h3v15h-4v4H9v-5h5v-14h-4z" fill="#514138" />
      <path d="M-11-33l5-6h13l7 9v29L8 3H-6l-5-5z" fill="#655046" />
      <path d="M-9-27h10v27h-6l-4-3z" fill="#c4a178" />
      <path d="M2-27h9v26L6 1H2z" fill="#8c735c" />
      <path d="M-6-33v-5H5v5h8v6H-9v-6z" fill="#4f4c40" />
      <path d="M-5-19h6v11h-6z" fill={carafeFull ? "#f4bc79" : "#736658"} />
    </g>
  {/if}

  {#if upgrades.includes("auto-tea")}
    <path d="M280 133l40-15 40 15v52l-42 15-38-14z" fill="#3d3538" />
    <path d="M283 136l35 12v46l-35-12z" fill="#9fa48a" />
    <path d="M322 148l35-13v47l-35 12z" fill="#687d6b" />
    <path d="M285 134l35-13 35 13-35 12z" fill="#bdb994" />
    <path d="M289 145l25 9v20l-25-8z" fill="#57484a" />
    <path d="M292 149l17 6v10l-17-6z" fill="#b38b64" />
    <path d="M302 172l9 3v4l-9-3z" fill="#e0bc84" />
  {/if}

  <!-- A wall-end planter and a folded delivery stack give the side its depth. -->
  <path d="M1 302l22-9 38 13-4 20-26 12-30-12z" fill="#392c34" />
  <path d="M1 306l27-10 28 11-27 11z" fill="#514443" />
  <path d="M9 306l21-7 19 8-19 7z" fill="#342e30" />
  <path d="M9 310l20 8 21-8-4 15-16 7-16-7z" fill="#9b6555" />
  <path d="M30 319l20-8-4 14-16 7z" fill="#744e48" />
  <path d="M25 304v-23h-5v-7h-9v-6H3v-7h11v4h7v6h5v7h4v9h6v-17h6v-7h9v-5h9v7h-5v6h-9v6h-5v11h-5v9h-6v7z" fill="#536a59" />
  <path d="M29 293v-19h-4v-10h2v-10h7v-8h7v11h-4v10h-4v15h4v11z" fill="#899575" />
  <path d="M17 283h-7v-6H3v7h6v7h7v7h12v-5h-6v-5h-5zm23 5h9v-8h11v7h-7v7h-8v6H34v-5h6z" fill="#7b8d6e" />

  <!-- Handoff counter, sealer, receipt rail, and brass call bell. -->
  <path d="M571 210 708 158 848 208v54l-134 50-143-51z" fill="#3e2d34" />
  <path d="M575 216 711 264v42l-136-49z" fill="#966353" />
  <path d="M716 264 844 216v43l-128 47z" fill="#6d4945" />
  <path d="M581 225 707 270v6l-126-45z" fill="#c88f6a" />
  <path d="M581 235l39 14v24l-39-14zm44 16 39 14v24l-39-14zm44 16 36 13v24l-36-13z" fill="#7b5147" />
  <path d="M585 239l31 11v3l-31-11zm44 16 31 11v3l-31-11zm44 16 27 10v3l-27-10z" fill="#9f6e57" />
  <path d="M595 246l11 4v3l-11-4zm44 16 11 4v3l-11-4zm43 15 11 4v3l-11-4z" fill="#d1a476" />
  <path d="M733 266l98-37v20l-98 37z" fill="#593d3c" />
  <path d="M738 269l88-33v4l-88 33z" fill="#a27a5e" />
  <g transform="matrix(1 -.36 0 1 748 271)" color="#f0cd98">
    <OrderPixelWord text="PICKUP" cells={1.85} />
  </g>
  <path d="M574 257l139 50 131-49v8l-130 50-140-51z" fill="#4c373a" />
  <path d="M565 199 706 147 853 200v13l-141 53-147-54z" fill="#4b3637" />
  <path d="M572 199 706 150 847 201 710 250z" fill="#c6966e" />
  <path d="M572 199 706 150 847 201 710 250z" fill="url(#{grain})" />
  <path d="M569 202l141 52v8l-141-52z" fill="#dda97a" />
  <path d="M714 255l135-50v6l-135 51z" fill="#9d6e58" />
  <path d="M616 201l61-22 65 24-60 23z" fill="#685748" />
  <path d="M622 201l57-19 57 21-54 20z" fill={station === "serve" && ready ? "#dcb173" : "#a97d5a"} />
  <path d="M637 201l44-15 43 16-43 16zm6 0 38 14 37-13-37-13z" fill="#ebc18b" fill-rule="evenodd" />
  <path d="M738 168l25-9 43 15v33l-25 10-43-15z" fill="#46363b" />
  <path d="M742 172l37 14v27l-37-14z" fill="#889485" />
  <path d="M783 186l19-8v27l-19 7z" fill="#5c6e67" />
  <path d="M742 169l22-8 37 14-20 8z" fill="#bbba9d" />
  <path d="M748 180l26 10v13l-26-9z" fill="#4c4545" />
  <path d="M751 184l15 6v3l-15-5z" fill={station === "serve" && (working || ready) ? "#f3cf83" : "#aa9c79"} />
  <path d="M793 178l12-5v4l-12 5zm-44 19 19 7v3l-19-7z" fill="#c9b38d" />
  <path d="M731 212l13-5 18 6v5l-13 6-18-6z" fill="#654d40" />
  <path d="M734 212h6v-5h4v-4h9v4h4v5h3v3h-26z" fill="#d2a05b" />
  <path d="M739 212v-4h4v-3h7v4h-5v3z" fill="#f5ce86" />
  <path d="M746 202h5v4h-5z" fill="#6f5140" />
  <path d="M806 209l19-7 11 4v10l-18 7-12-5z" fill="#654c41" />
  <path d="M807 209l18-6 9 3-17 7z" fill="#e1c79c" />
  <path d="M808 211l9 4v6l-9-4zm12 5 13-5v4l-13 5z" fill="#c7a47e" />

  <!-- The prep island is a freestanding block with its own end shelves. -->
  <path d="M376 344 490 300 624 350v56l-110 44-138-52z" fill="#422f34" />
  <path d="M380 349 512 398v47l-132-49z" fill="#8d6652" />
  <path d="M517 398 621 356v47l-104 42z" fill="#63514b" />
  <path d="M384 357 509 404v5l-125-47z" fill="#b89068" />
  <path d="M387 371l35 13v22l-35-13zm39 15 36 13v23l-36-13zm41 15 39 15v23l-39-14z" fill="#725145" />
  <path d="M391 374l27 10v3l-27-10zm39 14 28 11v3l-28-11zm41 15 31 12v3l-31-12z" fill="#ae8061" />
  <path d="M400 385l11 4v4l-11-4zm40 15 11 4v4l-11-4zm43 16 11 4v4l-11-4z" fill="#dbb182" />
  <path d="M522 403l91-36v29l-91 37z" fill="#413638" />
  <path d="M522 416l92-36v4l-92 36zm0 12 92-36v5l-92 36z" fill="#96745a" />
  <path d="M534 407l8-3v15l-8 3zm10-5 8-3v15l-8 3zm13-4 8-3v15l-8 3z" fill="#a9916e" />
  <path d="M579 392l24-10v12l-24 10z" fill="#758473" />
  <path d="M380 393l135 50 106-42v8l-106 44-135-50z" fill="#47343a" />
  <path d="M371 334 489 288 628 341v13l-115 46-142-53z" fill="#4d3937" />
  <path d="M377 334 489 291 622 342 511 385z" fill="#c29970" />
  <path d="M377 334 489 291 622 342 511 385z" fill="url(#{grain})" />
  <path d="M375 338l137 51v7l-137-51z" fill="#dbad82" />
  <path d="M516 390l108-44v6l-108 44z" fill="#a1765c" />
  <path d="M437 345l38-15 66 24-37 15z" fill="#806048" />
  <path d="M439 342l36-13 62 23-33 14z" fill={station === "build" && ready ? "#edbf79" : "#d6a674"} />
  <path d="M445 342l30-11 57 21-28 11zm4 0 55 19 24-9-53-19z" fill="#906648" fill-rule="evenodd" />
  <path d="M461 342l12-4 9 3-11 4z" fill="#e9c786" />
  <path d="M482 347l5-2 11 4-5 2zm16 6 9-3 8 3-9 3z" fill="#936954" />
  <path d="M458 337l7-3 4 2-7 3z" fill="#ba7366" />
  {#each jars as jarData}
    {@render jar(jarData.x, jarData.y, jarData.fill, jarData.light, jarData.dark)}
  {/each}
  <path d="M394 330l28-10 23 8v13l-27 10-24-8z" fill="#57473e" />
  <path d="M397 331l25-9 20 7-24 9z" fill="#a8a490" />
  <path d="M399 335l18 7v6l-18-7zm21 7 21-8v6l-21 8z" fill="#818575" />
  <path d="M404 330l18-6 15 5-18 6z" fill="#526362" />
  <path d="M407 329l5-2 7 2-5 3zm14 2 4-2 6 2-5 2z" fill="#d1d7b7" />
  <path d="M574 342l18-7 20 8v7l-18 9-20-8z" fill="#735446" />
  <path d="M576 341l17-5 16 6-16 7z" fill="#d2ae80" />
  <path d="M581 340l19 5v-3l-10-5z" fill="#8c624b" />

  {#if upgrades.includes("auto-milk")}
    <path d="M543 311h3v-6h14v6h3v19l-6 5h-9l-5-5z" fill="#594743" />
    <path d="M546 314h14v16l-4 3h-7l-3-3z" fill="#e7ce9b" />
    <path d="M549 299h13v4h-6v10h-4v-10h-3z" fill="#8c715c" />
  {/if}
  {#if upgrades.includes("auto-toppings")}
    <path d="M471 301l38-13 42 15v8l-42 16-38-15z" fill="#47363a" />
    <path d="M473 302l36-12 38 13-38 13z" fill="#9d806b" />
    {@render jar(489, 303, "#9a6455", "#d99d73", "#69454a")}
    {@render jar(509, 294, "#be8b5b", "#ecc085", "#87604f")}
    {@render jar(531, 304, "#bda16d", "#ecd5a0", "#8b6d54")}
  {/if}
  {#if upgrades.includes("better-recipe")}
    <path d="M524 359l18-7 15 6-17 8z" fill="#6b5145" />
    <path d="M525 357l16-6 14 5-16 8z" fill="#ebd3a6" />
    <path d="M530 357l9 3 9-4-8-3z" fill="#b38368" />
  {/if}
  {#if upgrades.includes("auto-extras")}
    {@render block(608, 360, "#8e745a", "#65544e", "#bfa080")}
    <path d="M616 345l22-7 17 6v12l-21 8-18-7z" fill="#746352" />
    <path d="M618 346l20-6 14 5-19 7z" fill="#c2996e" />
    {@render jar(634, 346, "#ad7355", "#dfa977", "#754e4b")}
  {/if}

  {#if reservationActive}
    <!-- The booked table sits to the left of the Prep aisle. -->
    {@render tableStool(48, 402)}
    {@render tableStool(138, 408)}
    <path d="M55 395l38-15 39 16-39 15z" fill="#342c34" opacity=".52" />
    <path d="M64 382h5v17l-5-2zm49 0h5v15l-5 2zm-23 12h5v13l-5-2z" fill="#4e3c38" />
    <path d="M65 385h2v12l-2-1zm49 0h2v11l-2 1zm-23 12h2v8l-2-1z" fill="#987558" />
    <path d="M54 377l37-14 39 14v8l-39 15-37-15z" fill="#503c38" />
    <path d="M59 377l32-12 34 12-34 12z" fill="#b9906b" />
    <path d="M59 377l32-12 34 12-34 12z" fill="url(#{grain})" />
    <path d="M56 380l35 13 37-14v4l-37 14-35-13z" fill="#987052" />
    <path d="M92 393l36-13v3l-36 13z" fill="#bea17a" />
    <path d="M75 378l15-6 18 6-16 6z" fill="#8c9277" />
    <path d="M78 378l12-4 15 4-13 4z" fill="#b3a988" />
    <path d="M81 375l10-4 8 3-10 4z" fill="#f0d5a0" />
    <path d="M89 374l4-2 2 1-4 2z" fill="#ae8060" />
    {@render tableStool(93, 432)}
  {/if}

  <!-- Prep island with a low burner and a two-tier bamboo steamer. -->
  <path d="M149 362 252 325 335 356v44l-104 41-81-28z" fill="#322a32" opacity=".54" />
  <path d="M151 357 252 320l85 31v40l-106 40-80-30z" fill="#44363a" />
  <path d="M156 362l73 26v36l-73-27z" fill="#735754" />
  <path d="M233 388l99-37v37l-99 37z" fill="#726f60" />
  <path d="M237 393l91-34v6l-91 34zm0 24l91-34v3l-91 34z" fill="#aa9270" />
  <path d="M264 382v19m34-32v19" stroke="#4f4741" stroke-width="3" />
  <path d="M160 373l61 22v15l-61-23z" fill="#5c4544" />
  <path d="M168 381l45 16v3l-45-16z" fill="#b18b6a" />
  <path d="M148 352 252 314l87 32v9l-108 40-83-32z" fill="#463637" />
  <path d="M153 353l99-36 81 30-102 38z" fill="#c2916b" />
  <path d="M153 353l99-36 81 30-102 38z" fill="url(#{grain})" />
  <path d="M150 358l81 30v4l-81-30zm84 30l102-38v4l-102 38z" fill="#dfaf7f" />
  <path d="M168 352l44-16 34 13-43 16z" fill={station === "prep" ? "#e2b879" : "#947555"} />
  <path d="M178 344l20-8 29 6 9 6-11 9h-37l-12-7z" fill="#483d3b" />
  <path d="M179 323l10-6h34l11 6v20l-10 9h-34l-11-9z" fill="#3d3437" />
  <path d="M182 328l12 6h24l13-6v13l-8 8h-32l-9-7z" fill="#778779" />
  <path d="M216 334l14-6v13l-8 8h-15l9-9z" fill="#52665e" />
  <path d="M176 333h-6v-6h10m53 0h9v6h-8" stroke="#453637" stroke-width="4" fill="none" />
  <path d="M182 323l10-4h29l10 4-11 7h-27z" fill="#b7a885" />
  <path d="M188 323l8-3h22l7 3-8 4h-20z" fill="#604740" />
  <path d="M196 322h4v3h-4zm7 1h4v3h-4zm8-2h4v3h-4z" fill="#3e3034" />
  <path d="M252 339l24-9 32 10v9l-28 12-29-10z" fill="#4e3d3b" />
  <path d="M253 314l10-7h29l12 7v29l-11 8h-29l-11-8z" fill="#624738" />
  <path d="M256 317l11 5h24l10-5v10l-9 5h-27l-9-5zm0 14l11 5h24l10-5v10l-9 6h-27l-9-6z" fill="#c69963" />
  <path d="M257 314l9-5h25l10 5-11 5h-23z" fill="#e0b785" />
  <path d="M272 310v-5h11v5" fill="none" stroke="#664937" stroke-width="3" />
  <path d="M263 324l5 2h23l6-3m-34 15 5 2h23l6-3" fill="none" stroke="#89664b" stroke-width="2" />
  {#if upgrades.includes("warm-shelf")}
    <g transform="translate(312 320)">
      <path d="M-19 23l13-6 22 8-13 6z" fill="#685045" />
      <path d="M6-28h5v54H6z" fill="#685547" />
      <path d="M-38-23 5-39l14 5v9l-43 17-14-5z" fill="#60463e" />
      <path d="M-35-23 5-37l11 4-40 15z" fill="#b08b62" />
      <path d="M-24-16l39-15v5L-24-11z" fill="#e9b978" />
      <path d="M-24-11 15-26l-8 46-44 16z" fill="#ffd391" opacity=".17" />
    </g>
  {/if}
  {#if waffleAvailable}
    <g transform="translate(250 357)">
      <path d="M-27-6-5-15 24-5v9L2 14l-29-10z" fill="#4a3b38" />
      <path d="M-24-6-5-13 20-4 1 4z" fill="#738170" />
      <path d="M-24-4-1 4v6l-23-8z" fill="#93806a" />
      <path d="M-19-9-5-17 13-11 17-5 1 1l-21-7z" fill="#9d654f" />
      <path d="M-16-9-5-15 10-10 1-5z" fill="#c58b65" />
      <path d="M-10-14v-3h10v5" fill="none" stroke="#564139" stroke-width="2" />
      <path d="M6 6l9-3v2l-9 4z" fill={waffleCooking ? "#ffc186" : "#7c6655"} />
    </g>
  {/if}
  <g transform="matrix(1 -.37 0 1 271 398)" color="#ead09b">
    <OrderPixelWord text="PREP" cells={1.65} />
  </g>

  {#if expansion && expansion !== "corner"}
    <g transform="matrix(1 .36 0 1 450 -62)">
      <path d="M324 88h33v40h-33z" fill="#6a4b46" />
      <path d="M328 92h25v32h-25z" fill="#a98565" />
      <path d="M331 95h19v25h-19z" fill={room.cloth} />
      <g transform="translate(335 101)" color={room.trim}>
        <OrderPixelWord text={room.sign} cells={2.2} />
      </g>
    </g>
  {/if}

  {#each crew as post (post)}
    {@const worker = staffPosts[post]}
    {@const running = post === "runner" && runnerProgress !== undefined}
    {@const greeting = post === "host" && hostGreeting}
    {@const stirring = post === "prep" && (prepping || pearlCooking || bunCooking)}
    {@const pace = running && !reducedMotion ? (paused ? lastRunnerStep : runnerStep) : 0}
    <g class:runner-return={post === "runner" && !running && !paused && !reducedMotion}
      style:transform={`translate(${worker.x + pace * 96}px, ${worker.y - pace * 9}px)`}>
      <path d="M-13 0h5v-3H9v3h5v4H8v2H-8V4h-5z" fill="#392e35" opacity=".65" />
      <path class:crew-step={running} d="M-9-17H9v15H1v-6H-1v6h-8z" fill="#443640" />
      <path d="M-9-31h18v4h4v13H-13v-13h4z" fill={worker.shirt} stroke="#46343b" stroke-width="2" />
      <path d="M-7-29h3v7h8v-7h3v16H-7z" fill="#f5d8a1" />
      <path d="M-3-19h6v2h-6z" fill="#b78c66" />
      <path d="M-9-45H9v13H6v4H-6v-4h-3z" fill={worker.skin} stroke="#46343b" stroke-width="2" />
      <path d="M-5-38h2v3h-2zm8 0h2v3H3z" fill="#46343b" />
      <path d="M-11-44h4v-5H7v5h4v5h-22z" fill={worker.cap} stroke="#46343b" stroke-width="2" />
      <path d="M-6-47H6v2H-6z" fill="#ffe2b0" />
      {#if certifiedCrew.includes(post)}
        <path class="crew-pin" d="M2-24h5v5H5v2H3v-2H1v-4z" fill="#71493a" />
        <path d="M2-23h4v3H5v2H3v-2H2z" fill="#e8b957" />
        <path d="M2-23h3v1H2z" fill="#ffe6a1" />
      {/if}
      {#if running}
        <path d="M9-18h22v4H9z" fill="#6a4b43" />
        <path d="M14-33h13v11l-3 4h-7l-3-4z" fill="#6b4c42" />
        <path d="M16-31h9v8l-2 3h-5l-2-3z" fill="#da9e6d" />
        <path d="M16-31h9v2h-9z" fill="#f0d2a0" />
      {:else if greeting}
        <g class="crew-wave">
          <path d="M9-26h8v-6h5v-9h6v13h-5v8H9z" fill={worker.shirt} stroke="#46343b" stroke-width="2" />
          <path d="M22-42h6v8h-6z" fill={worker.skin} />
        </g>
      {:else if stirring}
        <g class="crew-stir">
          <path d="M8-25h13v5H8z" fill={worker.shirt} stroke="#46343b" stroke-width="2" />
          <path d="M20-25h7v6h-7z" fill={worker.skin} />
          <path d="M24-31l5-1 8 20-4 2z" fill="#c89a6d" />
          <path d="M32-14h9v6h-9z" fill="#554743" />
        </g>
      {/if}
    </g>
  {/each}

  <!-- The cutaway storefront frames a recessed, open door onto the sidewalk. -->
  <g transform="matrix(1 -.36 0 1 815 427)">
    <path d="M0-103h85v101H0z" fill="#3b3039" />
    <path d="M0-97h85v93H0z" fill="#785c52" />
    <path d="M8-86h67v86H8z" fill="#3a3846" />
    <path d="M9-25h64v28H9z" fill="#857269" />
    <path d="M9-25h64v2H9zm0 12h64v2H9z" fill="#625158" />
    <path d="M11-86h5v62h-5zm57 0h5v62h-5z" fill="#463843" />
    <path d="M13-57h15v3H13zm0-21h17v3H13zm36 13h18v2H49z" fill="#766071" />
    <path d="M19-55h20v30H19zm25 7h24v23H44z" fill="#322f3a" />
    <path d="M23-51h4v3h-4zm8 7h4v3h-4zm19 0h3v3h-3zm10 9h4v3h-4z" fill="#d18e70" />
    {#if preOpening}
      <path d="M11-85h60v82H11z" fill="#594e4b" />
      <path d="M15-80h54v6H15zm0 10h54v6H15zm0 10h54v6H15zm0 10h54v6H15zm0 10h54v6H15zm0 10h54v6H15zm0 10h54v6H15zm0 10h54v5H15z" fill="#896c5e" />
      <path d="M28-48h29v17H28z" fill="#2e3636" />
      <path d="M31-45h23v10H31z" fill="#b3a484" />
    {/if}
    <path d="M10-4h64v5H10z" fill="#563f39" />
    <path d="M10-4h64v2H10z" fill="#e3b885" />
    <path d="M0-88h10v91H0zm74 0h11v91H74z" fill="#684b45" />
    <path d="M3-87h4v84H3zm73 0h4v84h-4z" fill="#c0946f" />
    <path d="M1-73h4v68H1zm80 0h3v68h-3z" fill="#926953" />
    <path d="M-5-109h90v27H-5z" fill="#4c383b" />
    <path d="M-2-106h87v18H-2z" fill="#be8566" />
    <path d="M-2-105h87v3H-2zm3 13h82v2H1z" fill="#e0ac7b" />
    <path d="M2-85h82v3H2z" fill="#594044" />
    <g transform="translate(19 -101)" color="#482d2d">
      <OrderPixelWord text={preOpening ? " PREP" : "ENTRY"} cells={1.65} />
    </g>
  </g>
  <path d="M819 340 806 345v75l13 7z" fill="#79594d" />
  <path d="M810 348l4-2v74l-4-2z" fill="#9b775d" />
  {#if !preOpening}
    <path d="M825 340l-19-7v74l19 13z" fill="#4b373b" />
    <path d="M823 343l-14-6v68l14 10z" fill="#946954" />
    <path d="M821 346l-10-5v44l10 6z" fill="#777c72" />
    <path d="M815 345l-1-1v40l1 1zM818 347l-1-1v40l1 1z" fill="#a3a78c" />
    <path d="M811 392l9 5v3l-9-5z" fill="#d2ab77" />
  {/if}
  <path d="M70 335v-50h4v50z" fill="#af8b67" />
  <path d="M70 284h5v7h-5z" fill="#d2af82" />
  <path d="M56 335l14-6 15 5v17l-12 7-16-6z" fill="#433a40" />
  <path d="M59 336l11-5 12 4-11 5z" fill="#b8ac8e" />
  <path d="M60 339l11 4v12l-10-5zm14 4 8-5v12l-8 4z" fill="#77857e" />

  {#if keepsakes.includes("charm")}
    <g transform="translate(795 335)">
      <path d="M-2-15h10l16-6v4l-15 6H-2z" fill="#835f4d" />
      <path d="M-2-13h3v11h-3z" fill="#d5b28a" />
      <path d="M-7-3H7v5h3v16H7v4H-7v-4h-3V2h3z" fill="#735047" />
      <path d="M-6-1H6v5h2v12H5v4H-5v-4h-3V4h2z" fill="#bd7c62" />
      <path d="M-3 5h6v3h2v6h-2v2h-6v-2h-2V8h2z" fill="#f1c78a" />
      <path d="M-1 8h2v2h2v2h-2v2h-2v-2h-2v-2h2zm-3 15h2v7h-2zm6 0h2v7H2z" fill="#875c49" />
    </g>
  {/if}

  {#each bolts as x}
    <path d="M{x + 176} {267 - x * .366}h2v2h-2z" fill="#efc792" opacity=".62" />
  {/each}

  {@render lamp(387, 39, .91)}
  {@render lamp(520, 43, .76)}
  {@render lamp(431, 146, 1.05)}

  {#each kettles as pot, index (pot.id)}
    {#if hotTeas.includes(pot.id)}
      {@render steam(pot.x, pot.y - 57, index * -260 + "ms")}
    {/if}
  {/each}
  {#if pearlCooking}
    {@render steam(206, 315, "-380ms")}
  {/if}
  {#if bunCooking}
    {@render steam(279, 299, "-620ms")}
  {/if}
  {#if waffleCooking}
    {@render steam(246, 337, "-120ms")}
  {/if}
</svg>

<style>
  .runner-return { transition: transform .44s steps(8, end); }
  .kitchen-scene {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .steam { animation: kettle-steam 1.2s steps(7, end) infinite; }
  .rain { animation: window-rain 440ms steps(8, end) infinite; }
  .crew-step { animation: crew-step 420ms steps(2, end) infinite; }
  .crew-wave { animation: crew-wave 760ms steps(3, end) infinite alternate; transform-origin: 9px -23px; }
  .crew-stir { animation: crew-stir 540ms steps(3, end) infinite alternate; transform-origin: 8px -23px; }
  .still :is(.steam, .rain, .crew-step, .crew-wave, .crew-stir) { animation-play-state: paused; }

  @keyframes crew-step {
    50% { transform: translate(2px, -2px); }
  }

  @keyframes crew-wave {
    to { transform: rotate(-15deg); }
  }

  @keyframes crew-stir {
    to { transform: rotate(12deg); }
  }

  @keyframes kettle-steam {
    0% { opacity: .15; transform: translateY(0); }
    45% { opacity: .9; }
    100% { opacity: .1; transform: translateY(-14px); }
  }

  @keyframes window-rain {
    to { transform: translateY(32px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .steam, .rain, .crew-step, .crew-wave, .crew-stir { animation: none; }
  }
</style>
