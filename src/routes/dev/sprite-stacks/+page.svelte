<script lang="ts">
  import { onMount } from "svelte";
  import { GAMES, type GameId } from "#lib/boba.ts";
  import { TURN_STEPS } from "#lib/arcade/core/sprite-stack.ts";
  import RisoDefs from "#lib/components/arcade/RisoDefs.svelte";
  import "#lib/components/arcade/arcade.css";
  import { specimens } from "./specimens";
  import { models } from "#lib/arcade/scenery/stacks/models.ts";
  import { paintSheet } from "#lib/arcade/scenery/stacks/frames.ts";
  import { STAGE_WIDTH, STAGE_HEIGHT, DEFAULT_GROUND_Y, paintScene, paintThumbnail, paintTurntable } from "./preview";

  const turnStep = 360 / TURN_STEPS;
  const sheetScale = 3;

  let selected = $state<GameId>("spill");
  let angle = $state(specimens.spill.angle);
  let squash = $state(0.75);
  let spacing = $state(1);
  let layers = $state(models.spill.slices.length);
  let stage = $state<HTMLCanvasElement>();
  let sheet = $state<HTMLCanvasElement>();
  let reducedMotion = $state(false);
  let turning = $state(false);
  let animation = 0;

  const specimen = $derived(specimens[selected]);
  const model = $derived(models[selected]);
  const sliceWidth = $derived(model.slices[0][0].length);
  const sliceHeight = $derived(model.slices[0].length);
  const sliceDisplayWidth = $derived(sliceWidth * sheetScale);
  const groundY = $derived(specimen.groundY ?? DEFAULT_GROUND_Y);
  const backdrop = $derived(stage ? paintScene(specimen.scene, groundY) : undefined);

  $effect(() => {
    if (stage && backdrop) paintTurntable(stage, backdrop, model, selected, groundY, angle, squash, spacing, layers);
  });

  $effect(() => {
    if (sheet) {
      sheet.closest(".sheet-scroller")?.scrollTo(0, 0);
      paintSheet(sheet, model);
    }
  });

  onMount(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    function readPreference() {
      reducedMotion = query.matches;
      if (reducedMotion) stopTurn();
    }

    readPreference();
    query.addEventListener("change", readPreference);
    return () => {
      cancelAnimationFrame(animation);
      query.removeEventListener("change", readPreference);
    };
  });

  function stopTurn() {
    cancelAnimationFrame(animation);
    turning = false;
  }

  function selectSpecimen(id: GameId) {
    if (selected === id) return;
    stopTurn();
    selected = id;
    angle = specimens[id].angle;
    layers = models[id].slices.length;
  }

  function showLayers(count: number) {
    layers = count;
    const scroller = sheet?.closest(".sheet-scroller");
    if (!scroller) return;
    const start = (count - 1) * sliceDisplayWidth;
    const end = start + sliceDisplayWidth;
    if (start < scroller.scrollLeft) scroller.scrollLeft = start;
    if (end > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = end - scroller.clientWidth;
  }

  function turnOnce() {
    if (turning) {
      stopTurn();
      return;
    }
    if (reducedMotion) {
      angle = (angle + 90) % 360;
      return;
    }

    const startAngle = angle % 360;
    const duration = 2500;
    let startTime: number | undefined;
    turning = true;

    function step(time: number) {
      startTime ??= time;
      const progress = Math.min((time - startTime) / duration, 1);
      angle = (startAngle + Math.round(progress * TURN_STEPS) * turnStep) % 360;
      if (progress === 1) stopTurn();
      else animation = requestAnimationFrame(step);
    }

    animation = requestAnimationFrame(step);
  }

  function downloadSheet() {
    if (!sheet) return;
    const link = document.createElement("a");
    link.href = sheet.toDataURL("image/png");
    link.download = specimen.name.replaceAll(" ", "-") + "-slices.png";
    link.click();
  }
</script>

<svelte:head>
  <title>Sprite stacks · Boba arcade</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="gallery boba-ui" data-justify="off">
  <RisoDefs />

  <header class="gallery-header">
    <h1>sprite stacks</h1>
    <div>
      <p>Seven pixel-art props for the boba arcade. Turn them and peel them back one layer at a time.</p>
      <p class="boba-meta">Order Up already stacks its finished drink. The other six games use flat sprites or pixel-painted scenery.</p>
      <a class="related" href="/dev/arcade-scenes/">Explore the backdrop studies</a>
    </div>
  </header>

  <div class="gallery-board">
    <section class="boba-riso specimen-index" aria-labelledby="index-title">
      <h2 class="boba-phase" id="index-title">the arcade</h2>
      <ul>
        {#each GAMES as game (game.id)}
          {@const item = specimens[game.id]}
          {@const art = models[game.id]}
          <li>
            <button type="button" class="specimen-choice" aria-pressed={selected === game.id} onclick={() => selectSpecimen(game.id)}>
              <span class="thumb">
                <canvas width="42" height="38" aria-hidden="true" {@attach (canvas) => paintThumbnail(canvas, art, item.angle)}></canvas>
              </span>
              <span class="choice-copy">
                <span>{game.name}</span>
                <span class="boba-meta">{item.name}</span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
    </section>

    <section class="viewer" aria-labelledby="specimen-title">
      <figure>
        <div class="turntable" role="img" aria-label={specimen.description}>
          <canvas bind:this={stage} width={STAGE_WIDTH} height={STAGE_HEIGHT} aria-hidden="true"></canvas>
        </div>
        <figcaption>
          <h2 id="specimen-title" class="boba-title">{specimen.name}</h2>
          <p>{specimen.use}</p>
        </figcaption>
      </figure>

      <div class="controls">
        <div class="range-control">
          <label for="sprite-angle">turn</label>
          <output for="sprite-angle" aria-live="off">{angle}°</output>
          <input id="sprite-angle" type="range" min="0" max="360" step={turnStep} bind:value={angle} oninput={stopTurn} />
        </div>
        <div class="range-control">
          <label for="sprite-layers">visible layers</label>
          <output for="sprite-layers" aria-live="off">{layers}/{model.slices.length}</output>
          <input id="sprite-layers" type="range" min="1" max={model.slices.length} value={layers}
            oninput={(event) => showLayers(event.currentTarget.valueAsNumber)} />
        </div>
        <label class="select-control">
          <span>squash</span>
          <select bind:value={squash}>
            <option value={0.6}>0.60</option>
            <option value={0.75}>0.75</option>
            <option value={1}>1.00</option>
          </select>
        </label>
        <label class="select-control">
          <span>slice spacing</span>
          <select bind:value={spacing}>
            <option value={0}>0 px</option>
            <option value={1}>1 px</option>
            <option value={2}>2 px</option>
          </select>
        </label>
        <button type="button" class="boba-key spin" onclick={turnOnce}>
          {reducedMotion ? "Turn 90°" : turning ? "Stop turn" : "Turn once"}
        </button>
      </div>
    </section>
  </div>

  <section class="slice-section" aria-labelledby="slice-title">
    <div class="slice-header">
      <div>
        <h2 id="slice-title" class="boba-title">slice sheet</h2>
        <p class="boba-meta">{model.slices.length} layers · {sliceWidth} × {sliceHeight} px each · ground to top, left to right</p>
      </div>
      <button type="button" class="boba-btn" onclick={downloadSheet}>Download PNG</button>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (the sheet scrolls by keyboard) -->
    <div class="sheet-scroller" role="region" tabindex="0" aria-label={specimen.name + ", all " + model.slices.length + " layers from ground to top"}>
      <div class="slice-strip" style:width={(sliceDisplayWidth * model.slices.length) + "px"}>
        <canvas bind:this={sheet} aria-hidden="true"
          style:width="100%"
          style:height={(sliceHeight * sheetScale) + "px"}
          style:--slice-size={sliceDisplayWidth + "px"}></canvas>
        {#if layers < model.slices.length}
          <span class="layer-marker" aria-hidden="true" style:left={((layers - 1) * sliceDisplayWidth) + "px"}
            style:width={sliceDisplayWidth + "px"}></span>
        {/if}
      </div>
    </div>
  </section>
</div>

<style>
  .gallery {
    width: min(100% - 2 * var(--space-6), 70rem);
    margin-inline: auto;
    padding-block: var(--space-10) var(--space-16);
  }

  .gallery-header {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    align-items: end;
    gap: var(--space-6);
    border-bottom: 1px solid var(--b-rule);
    padding-bottom: var(--space-6);
    margin-bottom: var(--space-8);
  }

  .gallery-header h1 {
    margin: 0;
    color: var(--b-strong);
    font-family: var(--font-display);
    font-size: clamp(3rem, 7vw, 6rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 0.95;
    text-wrap: balance;
  }

  .gallery-header p {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.5;
    text-wrap: pretty;
  }

  .gallery-header p.boba-meta {
    margin-top: var(--space-2);
    font-size: 0.8125rem;
  }

  .related {
    display: inline-flex;
    align-items: center;
    min-height: 2rem;
    margin-top: var(--space-1);
    color: var(--b-accent);
    font-size: 0.8125rem;
  }

  .gallery-board {
    display: grid;
    grid-template-areas: "viewer index";
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: var(--space-6);
    align-items: start;
  }

  .viewer { grid-area: viewer; }

  figure { margin: 0; }

  .turntable {
    position: relative;
    background: var(--b-paper);
    outline: 1px solid var(--b-line);
    outline-offset: -1px;
  }

  canvas {
    display: block;
    image-rendering: pixelated;
  }

  .turntable canvas {
    width: 100%;
    height: auto;
  }

  figcaption {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  figcaption p {
    max-width: 58ch;
    margin: 0;
    color: var(--b-muted);
    font-size: 0.875rem;
    line-height: 1.45;
    text-wrap: pretty;
  }

  .specimen-index {
    grid-area: index;
    min-width: 0;
    padding: var(--space-4);
  }

  .specimen-index h2 { margin: 0 var(--space-2) var(--space-2); }

  .specimen-index ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .specimen-index li + li { border-top: 1px solid var(--b-rule); }

  .specimen-choice {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-1) var(--space-2);
    text-align: left;
    font: inherit;
    color: var(--b-strong);
    cursor: pointer;
  }

  .specimen-choice:hover { background: var(--b-wash); }

  .specimen-choice[aria-pressed="true"] { background: var(--b-wash); }

  .specimen-choice[aria-pressed="true"]::before {
    content: "";
    position: absolute;
    inset: var(--space-1) auto var(--space-1) 0;
    width: 2px;
    background: var(--b-accent);
  }

  .thumb {
    display: grid;
    flex: 0 0 3rem;
    place-items: center;
    width: 3rem;
    height: 2.625rem;
    color: var(--b-muted);
    background: var(--b-raised);
    border: 1px solid var(--b-rule);
  }

  .thumb canvas { width: 2.625rem; height: 2.375rem; }

  .choice-copy {
    display: grid;
    gap: var(--space-0-5);
    font-size: 0.9375rem;
    line-height: 1.2;
  }

  .controls {
    display: grid;
    grid-template-columns: minmax(6rem, 1fr) minmax(6rem, 1fr) auto auto 6.5rem;
    gap: var(--space-3);
    align-items: end;
    margin-top: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px solid var(--b-rule);
    font-size: 0.8125rem;
  }

  .range-control, .select-control {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
    color: var(--b-strong);
  }

  .range-control { grid-template-columns: 1fr auto; }

  .range-control input {
    grid-column: 1 / -1;
    width: 100%;
    height: 2.75rem;
    margin: 0;
    accent-color: var(--b-accent);
    cursor: ew-resize;
  }

  .range-control output { color: var(--b-accent); }

  .select-control select {
    height: 2.75rem;
    padding-inline: var(--space-2);
    color: var(--b-strong);
    background: var(--b-paper);
    border: 1px solid var(--b-rule);
    border-radius: var(--radius-control);
    font: inherit;
  }

  .spin, .slice-header button { min-height: 2.75rem; }

  .slice-section {
    margin-top: var(--space-10);
    padding-top: var(--space-5);
    border-top: 1px solid var(--b-rule);
  }

  .slice-header {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .slice-header p { margin: var(--space-2) 0 0; }

  .sheet-scroller {
    overflow-x: auto;
    background: var(--b-paper);
    border: 1px solid var(--b-rule);
  }

  .slice-strip { position: relative; }

  .layer-marker {
    position: absolute;
    inset-block: 0;
    box-shadow: inset 0 0 0 2px var(--b-accent);
    pointer-events: none;
  }

  .sheet-scroller canvas {
    max-width: none;
    /* A guide at each successive slice boundary, outside the exported PNG. */
    background: repeating-linear-gradient(to right, transparent 0 calc(var(--slice-size) - 1px), var(--b-rule) calc(var(--slice-size) - 1px) var(--slice-size));
  }

  @media (max-width: 52rem) {
    .gallery-board {
      grid-template-areas: "index" "viewer";
      grid-template-columns: minmax(0, 1fr);
    }

    .specimen-index ul {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
    }

    .specimen-index li + li { border-top: 0; border-left: 1px solid var(--b-rule); }

    .specimen-choice {
      flex-direction: column;
      gap: var(--space-1);
      min-height: 100%;
      padding: var(--space-1) var(--space-1) var(--space-2);
      text-align: center;
    }

    .thumb { flex-basis: auto; }

    .choice-copy { font-size: 0.8125rem; }

    .choice-copy .boba-meta {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .specimen-choice[aria-pressed="true"]::before {
      inset: auto var(--space-2) 0;
      width: auto;
      height: 2px;
    }
  }

  @media (max-width: 38rem) {
    .gallery {
      width: calc(100% - 2 * var(--space-4));
      padding-top: var(--space-8);
    }

    .gallery-header {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-3);
      margin-bottom: var(--space-5);
      padding-bottom: var(--space-4);
    }

    .gallery-board { gap: var(--space-4); }

    .specimen-index { padding: var(--space-3); }

    .specimen-index ul { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .specimen-index li:nth-child(5) { border-left: 0; }
    .specimen-index li:nth-child(n + 5) { border-top: 1px solid var(--b-rule); }

    .controls { grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--space-3) var(--space-2); }
    .range-control { grid-column: span 6; }
    .select-control, .spin { grid-column: span 4; }
    .slice-header { align-items: start; }
  }

  @media (max-width: 23rem) {
    .slice-header { flex-wrap: wrap; }
  }
</style>
