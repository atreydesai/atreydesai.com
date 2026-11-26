<script lang="ts">
  import { onMount } from "svelte";
  import { GAMES, type GameId } from "#lib/boba.ts";
  import { TURN_STEPS } from "#lib/arcade/core/sprite-stack.ts";
  import RisoDefs from "#lib/components/arcade/RisoDefs.svelte";
  import "#lib/components/arcade/arcade.css";
  import { alternateStudies, altitudeStops, studies } from "./catalog";
  import { clamp, HEIGHT, Pixels, raster, WIDTH } from "#lib/arcade/scenery/pixel.ts";
  import { propArt, propSheet, props } from "#lib/arcade/scenery/props.ts";
  import { drawStudy } from "#lib/arcade/scenery/stage.ts";

  const worlds = ["stack", "runner", "lander", "spill", "stab", "orders", "catch"] as const;
  const names = Object.fromEntries(GAMES.map((game) => [game.id, game.name]));
  const durations = { climb: 22, frame: 1 / 20 };
  const pngHref = "data:image/png;base64,";

  let game = $state<GameId>("stack");
  let alternate = $state(false);
  let altitude = $state(72);
  let playing = $state(false);
  let motion = $state(true);
  let reduced = $state(false);
  let visible = $state(true);
  let inView = $state(true);
  let gameplay = $state(true);
  let clock = $state(0);
  let chosenProp = $state("station");
  let propTurn = $state(0);
  let propStage = $state<HTMLCanvasElement>();
  let stage = $state<HTMLCanvasElement>();
  let ascentPosition = 0;

  const study = $derived(alternate ? alternateStudies[game] : studies[game]);
  const hasAscent = $derived(game === "stack" && !alternate);
  const activeProp = $derived(props[chosenProp]);
  const chapter = $derived(altitudeStops.reduce((chosen, next) =>
    Math.abs(next.value - altitude) < Math.abs(chosen.value - altitude) ? next : chosen, altitudeStops[0]));
  const sceneLabel = $derived(hasAscent ? names[game] + ", " + chapter.name : names[game] + ", " + study.title);

  onMount(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const readPreference = () => {
      reduced = preference.matches;
      if (reduced) playing = false;
    };
    const readVisibility = () => (visible = !document.hidden);
    readPreference();
    readVisibility();
    preference.addEventListener("change", readPreference);
    document.addEventListener("visibilitychange", readVisibility);
    return () => {
      preference.removeEventListener("change", readPreference);
      document.removeEventListener("visibilitychange", readVisibility);
    };
  });

  $effect(() => {
    if (!stage) return;
    const observer = new IntersectionObserver(([entry]) => (inView = entry.isIntersecting));
    observer.observe(stage);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (stage) drawStudy(stage, game, altitude, clock, gameplay, alternate);
  });

  $effect(() => {
    if (propStage) previewProp(propStage, chosenProp, propTurn);
  });

  $effect(() => {
    if (!motion || reduced || !visible || (!inView && !playing)) return;
    let last: number | undefined;
    let id = requestAnimationFrame(frame);
    function frame(now: number) {
      last ??= now;
      const elapsed = (now - last) / 1000;
      if (elapsed >= durations.frame) {
        last = now;
        const dt = Math.min(elapsed, 0.15);
        clock += dt;
        if (playing) {
          ascentPosition += dt * 100 / durations.climb;
          altitude = clamp(Math.round(ascentPosition), 0, 100);
          if (altitude === 100) playing = false;
        }
      }
      id = requestAnimationFrame(frame);
    }
    return () => cancelAnimationFrame(id);
  });

  function selectWorld(id: GameId) {
    if (id === game) return;
    game = id;
    resetStudy(false);
  }

  function resetStudy(isAlternate: boolean) {
    alternate = isAlternate;
    playing = false;
    clock = 0;
    selectProp((isAlternate ? alternateStudies : studies)[game].props[0]);
  }

  function selectProp(id: string) {
    chosenProp = id;
    propTurn = 0;
  }

  function chooseAltitude(value: number) {
    playing = false;
    altitude = value;
  }

  function toggleAscent() {
    if (reduced) {
      chooseAltitude(altitudeStops.find((item) => item.value > altitude)?.value ?? 0);
      return;
    }
    if (playing) {
      playing = false;
      return;
    }
    ascentPosition = altitude >= altitudeStops[3].value ? 0 : altitude;
    altitude = ascentPosition;
    motion = true;
    playing = true;
  }

  function toggleMotion() {
    motion = !motion;
    if (!motion) playing = false;
  }

  function previewAltitude(canvas: HTMLCanvasElement, value: number) {
    const art = raster(WIDTH, HEIGHT, (p) => drawStudy(p.ctx.canvas, "stack", value, 0, false));
    new Pixels(canvas.getContext("2d")!).image(art, 0, 0, canvas.width / WIDTH);
  }

  function previewProp(canvas: HTMLCanvasElement, id: string, turn = 0) {
    const art = propArt(id, turn);
    const p = new Pixels(canvas.getContext("2d")!);
    p.ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.max(1, Math.min(4, Math.floor(canvas.width / art.width), Math.floor(canvas.height / art.height)));
    p.image(art, (canvas.width - art.width * scale) / 2, (canvas.height - art.height * scale) / 2, scale);
  }

  function preparePng(link: HTMLAnchorElement, canvas: HTMLCanvasElement, name: string) {
    link.href = canvas.toDataURL("image/png");
    link.download = name + ".png";
  }

  function saveBackdrop(link: HTMLAnchorElement) {
    const art = document.createElement("canvas");
    art.width = WIDTH;
    art.height = HEIGHT;
    drawStudy(art, game, altitude, clock, false, alternate);
    const name = (hasAscent ? chapter.name : study.title).replaceAll(" ", "-");
    preparePng(link, art, game + "-" + name + "-backdrop");
  }

  function saveProp(link: HTMLAnchorElement, slices = false) {
    const art = slices ? propSheet(chosenProp) : propArt(chosenProp, propTurn);
    if (art) preparePng(link, art, chosenProp + (slices ? "-slices" : ""));
  }
</script>

<svelte:head>
  <title>Backdrop studies · Boba arcade</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="lab boba-ui" data-justify="off">
  <RisoDefs />

  <header class="masthead">
    <h1>backdrop studies</h1>
    <div>
      <p>Scenes and small props for the boba arcade, from the shop counter to the far side of Cup Stack’s climb.</p>
      <a class="related" href="/dev/sprite-stacks/">Sprite stack turntable</a>
    </div>
  </header>

  <nav class="worlds" aria-label="Choose an arcade scene">
    {#each worlds as id}
      <button type="button" aria-pressed={game === id} onclick={() => selectWorld(id)}>{names[id]}</button>
    {/each}
  </nav>

  <nav class="editions" aria-label="Choose a backdrop for this game">
    <button type="button" aria-pressed={!alternate} onclick={() => resetStudy(false)}>{studies[game].title}</button>
    <button type="button" aria-pressed={alternate} onclick={() => resetStudy(true)}>{alternateStudies[game].title}</button>
  </nav>

  <div class="workbench">
    <figure class="scene">
      <div class="screen" role="img" aria-label={sceneLabel}>
        <canvas bind:this={stage} width={WIDTH} height={HEIGHT} aria-hidden="true"></canvas>
      </div>
      <figcaption>
        <h2 class="boba-title">{study.title}</h2>
        <p>{study.note}</p>
        {#if hasAscent}
          <p class="chapter-note"><span class="boba-phase">{chapter.name}</span> {chapter.note}</p>
        {/if}
      </figcaption>
    </figure>

    <section class="boba-riso view-controls" aria-labelledby="controls-title">
      <h2 id="controls-title" class="boba-phase">scene controls</h2>
      {#if hasAscent}
        <div class="altitude">
          <div class="altitude-label">
            <label for="altitude">altitude</label>
            <output for="altitude" aria-live="off">{altitude}</output>
          </div>
          <input id="altitude" type="range" min="0" max="100" value={altitude}
            aria-valuetext={altitude + ", " + chapter.name}
            oninput={(event) => chooseAltitude(event.currentTarget.valueAsNumber)} />
          <ol aria-label="Altitude bands">
            {#each altitudeStops as item}
              <li>
                <button type="button" aria-pressed={chapter.value === item.value} onclick={() => chooseAltitude(item.value)}>
                  <canvas width="64" height="34" aria-hidden="true" {@attach (canvas) => previewAltitude(canvas, item.value)}></canvas>
                  <span>{item.name}</span>
                </button>
              </li>
            {/each}
          </ol>
          <button class="boba-key is-primary ascent" type="button" onclick={toggleAscent}>
            {reduced ? "Next altitude" : playing ? "Stop ascent" : "Play ascent"}
          </button>
        </div>
      {/if}
      <div class="scene-options">
        <label><input type="checkbox" bind:checked={gameplay} /> <span>show gameplay mockup</span></label>
        <label><input type="checkbox" checked={motion && !reduced} disabled={reduced} onchange={toggleMotion} /> <span>ambient motion</span></label>
      </div>
      <a class="boba-btn secondary save-backdrop" href={pngHref} download onclick={(event) => saveBackdrop(event.currentTarget)}>Download backdrop</a>
    </section>
  </div>

  <section class="prop-shelf" aria-labelledby="prop-title">
    <div class="shelf-header">
      <h2 id="prop-title" class="boba-title">prop shelf</h2>
      <p class="boba-meta">Select an object to inspect and export it.</p>
    </div>
    <div class="shelf-layout">
      <ul>
        {#each study.props as id (id)}
          <li>
            <button class="prop" type="button" aria-pressed={chosenProp === id} onclick={() => selectProp(id)}>
              <span class="prop-print">
                <canvas width="112" height="70" aria-hidden="true" {@attach (canvas) => previewProp(canvas, id)}></canvas>
              </span>
              <span class="prop-name">{props[id].name}</span>
            </button>
          </li>
        {/each}
      </ul>
      <div class="prop-inspector">
        <div class="prop-preview prop-print" role="img" aria-label={activeProp.name}>
          <canvas bind:this={propStage} width="210" height="106" aria-hidden="true"></canvas>
        </div>
        <h3 class="boba-phase">{activeProp.name}</h3>
        {#if activeProp.slices}
          <div class="prop-turn">
            <label for="prop-turn">turn</label>
            <output for="prop-turn" aria-live="off">{propTurn}°</output>
            <input id="prop-turn" type="range" min="0" max="360" step={360 / TURN_STEPS} bind:value={propTurn} />
          </div>
        {/if}
        <div class="prop-downloads">
          <a class="boba-btn" href={pngHref} download onclick={(event) => saveProp(event.currentTarget)}>Download PNG</a>
          {#if activeProp.slices}
            <a class="boba-btn secondary" href={pngHref} download onclick={(event) => saveProp(event.currentTarget, true)}>Download slices</a>
          {/if}
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .lab {
    width: min(100% - 2 * var(--space-6), 72rem);
    margin-inline: auto;
    padding-block: var(--space-10) var(--space-16);
  }

  .masthead {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    align-items: end;
    gap: var(--space-8);
    padding-bottom: var(--space-6);
  }

  .masthead h1 {
    margin: 0;
    color: var(--b-strong);
    font-family: var(--font-display);
    font-size: clamp(3rem, 6vw, 5.5rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 0.94;
    text-wrap: balance;
  }

  .masthead p, figcaption p {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.5;
    text-wrap: pretty;
  }

  .related {
    display: inline-flex;
    align-items: center;
    min-height: 2rem;
    margin-top: var(--space-1);
    color: var(--b-accent);
    font-size: 0.8125rem;
  }

  .worlds {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 var(--space-4);
    margin-bottom: var(--space-2);
    border-block: 1px solid var(--b-rule);
  }

  .worlds button {
    min-height: 2.75rem;
    padding: var(--space-1) var(--space-2);
    border-bottom: 2px solid transparent;
    color: var(--b-text);
    font: inherit;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .worlds button[aria-pressed="true"] {
    border-bottom-color: var(--b-accent);
    color: var(--b-strong);
    background: var(--b-wash);
  }

  .worlds button:hover, .editions button:hover, .altitude ol button:hover, .prop:hover { background: var(--b-wash); }

  .editions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .editions button {
    min-height: 2.75rem;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--b-rule);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .editions button[aria-pressed="true"] {
    color: var(--b-strong);
    border-color: var(--b-accent);
    background: var(--b-wash);
    box-shadow: inset 0 -1px var(--b-accent);
  }

  .workbench {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(13rem, 1fr);
    align-items: start;
    gap: var(--space-6);
  }

  .scene { margin: 0; }

  .screen {
    background: #252d43;
    outline: 1px solid var(--b-line);
    outline-offset: -1px;
  }

  .screen canvas {
    display: block;
    width: 100%;
    height: auto;
    image-rendering: pixelated;
  }

  figcaption {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  figcaption p { max-width: 62ch; }

  .view-controls { padding: var(--space-4) var(--space-5) var(--space-5); }

  .view-controls h2 { margin: 0 0 var(--space-2); }

  .altitude { margin-block: var(--space-3) 0; }

  .altitude-label {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    align-items: baseline;
    font-size: 0.8125rem;
  }

  .altitude-label output { color: var(--b-accent); }

  input {
    margin: 0;
    accent-color: var(--b-accent);
  }

  .altitude input {
    width: 100%;
    min-height: 2.75rem;
    cursor: ew-resize;
  }

  .altitude ol {
    display: grid;
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-3);
  }

  .altitude li + li { border-top: 1px solid var(--b-rule); }

  .altitude ol button {
    position: relative;
    display: flex;
    gap: var(--space-2);
    align-items: center;
    width: 100%;
    min-height: 2.75rem;
    padding: var(--space-1) var(--space-2);
    text-align: left;
    color: var(--b-text);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .altitude ol canvas {
    display: block;
    width: 3.625rem;
    height: auto;
    image-rendering: pixelated;
  }

  .altitude ol button[aria-pressed="true"] {
    background: var(--b-wash);
    color: var(--b-strong);
    font-weight: 500;
  }

  .altitude ol button[aria-pressed="true"]::before {
    content: "";
    position: absolute;
    inset: var(--space-1) auto var(--space-1) 0;
    width: 2px;
    background: var(--b-accent);
  }

  .ascent, .save-backdrop { width: 100%; min-height: 2.75rem; }

  .scene-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-4);
    margin-top: var(--space-2);
    padding-block: var(--space-1);
  }

  .scene-options label {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    min-height: 2.25rem;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .scene-options input { width: 1rem; height: 1rem; }

  figcaption .chapter-note {
    margin-top: var(--space-2);
    color: var(--b-muted);
    max-width: 79ch;
    font-size: 0.875rem;
    line-height: 1.5;
    text-wrap: pretty;
  }

  .chapter-note span { margin-right: var(--space-1); }

  .prop-shelf {
    margin-top: var(--space-8);
    border-top: 1px solid var(--b-rule);
    padding-top: var(--space-5);
  }

  .shelf-header {
    padding-bottom: var(--space-4);
  }

  .shelf-header p { margin: var(--space-2) 0 0; }

  .shelf-layout {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(15rem, 1fr);
    align-items: start;
    gap: var(--space-5);
  }

  .prop-inspector {
    display: grid;
    padding: var(--space-3);
    gap: var(--space-2);
    border: 1px solid var(--b-rule);
    background: var(--b-paper);
  }

  .prop-inspector h3 { margin: 0; }

  .prop-preview canvas {
    display: block;
    max-width: 100%;
    height: auto;
    image-rendering: pixelated;
  }

  .prop-turn {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    font-size: 0.8125rem;
  }

  .prop-turn input {
    grid-column: 1 / -1;
    width: 100%;
    min-height: 2.75rem;
  }

  .prop-downloads { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .prop-downloads a { min-height: 2.75rem; text-decoration: none; }
  .save-backdrop { text-decoration: none; }

  .prop-shelf ul {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7.25rem, 1fr));
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .prop {
    display: grid;
    width: 100%;
    height: 100%;
    gap: var(--space-1);
    align-content: start;
    padding: var(--space-2);
    border-top: 2px solid var(--b-rule);
    color: var(--b-text);
    text-align: start;
    font: inherit;
    cursor: pointer;
  }

  .prop[aria-pressed="true"] { border-top-color: var(--b-accent); background: var(--b-wash); }

  .prop-print {
    display: grid;
    place-items: center;
    background: #dcd3c9;
  }

  :global(.dark) .prop-print { background: #54515b; }

  .prop canvas {
    display: block;
    max-width: 100%;
    height: auto;
    image-rendering: pixelated;
  }

  .prop-name { font-size: 0.8125rem; line-height: 1.25; }

  @media (max-width: 54rem) {
    .workbench { grid-template-columns: minmax(0, 1fr) minmax(11rem, 0.36fr); gap: var(--space-4); }
    .view-controls { padding-inline: var(--space-3); }
    .worlds { gap: 0 var(--space-2); }
  }

  @media (max-width: 42rem) {
    .lab { width: calc(100% - 2 * var(--space-4)); padding-top: var(--space-6); }
    .masthead { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); padding-bottom: var(--space-3); }
    .workbench, .shelf-layout { grid-template-columns: minmax(0, 1fr); gap: var(--space-5); }
    .worlds button { padding-inline: var(--space-1); }
    .view-controls { padding-inline: var(--space-4); }
    .altitude ol { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .altitude li + li { border-top: 0; }
    .altitude ol button { flex-direction: column; align-items: start; height: 100%; gap: var(--space-1); }
    .ascent, .save-backdrop { width: auto; }
  }
</style>
