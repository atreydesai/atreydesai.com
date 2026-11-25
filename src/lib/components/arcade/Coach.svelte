<script lang="ts">
  // The lesson's callout, set in the world beside the thing it is about: a
  // small riso slip with one line and its key, a pen loop around the thing,
  // and a short ink tail between them. It is placed in viewport pixels by
  // the game, which follows the thing as it moves, and never takes a click
  // or a key, so play carries on underneath. Paused, it hides.
  //
  // The game decides where the eye already is and puts the callout there:
  // beside the runner, under the cup, by the station. `side` says which
  // side of the anchor the slip sits on; it stays on screen either way.
  import { onMount } from "svelte";

  import { LOOPS } from "#lib/arcade/art.ts";
  import type { Lesson } from "#lib/arcade/core/coach.ts";

  export let lesson: Lesson | null = null;
  /** The thing being taught, in viewport pixels; null puts the slip at `side` alone. */
  export let x: number | null = null;
  export let y: number | null = null;
  export let side: "above" | "below" | "left" | "right" = "above";
  /** Half the size of the pen loop drawn around the anchor; 0 draws none. */
  export let ring = 0;
  /** The scene behind is dark (most are): the loop and tail print cream, not ink. */
  export let scene: "dark" | "light" = "dark";
  /** The lesson is fading out (it has been readable long enough). */
  export let leaving = false;
  /** Paused, or something covers the game: hide without forgetting. */
  export let hidden = false;
  /** Keep the slip below this many pixels from the top (under the tickets). */
  export let top = 72;
  /** The input the game is showing (its touch pads, or keys); null works it out from the pointer. */
  export let touch: boolean | null = null;

  const GUTTER = 16;
  let slip: HTMLElement;
  let slipW = 0;
  let slipH = 0;
  let viewW = 0;
  let viewH = 0;
  /** A touch device: lessons name the gesture, not the key. */
  let coarse = false;

  onMount(() => {
    const sync = () => {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
    };
    sync();
    const touch = window.matchMedia("(hover: none) and (pointer: coarse)");
    const syncTouch = () => (coarse = touch.matches);
    syncTouch();
    window.addEventListener("resize", sync);
    touch.addEventListener("change", syncTouch);
    return () => {
      window.removeEventListener("resize", sync);
      touch.removeEventListener("change", syncTouch);
    };
  });

  // One live region that stays mounted, so a screen reader hears each lesson
  // as it appears (and nothing while the game is paused), with the input it
  // actually has.
  $: announcement =
    lesson && !hidden
      ? [
          lesson.name ? `${lesson.name[0].toUpperCase()}${lesson.name.slice(1)}.` : "",
          lesson.text,
          (touch ?? coarse) ? (lesson.touch ? `${lesson.touch[0].toUpperCase()}${lesson.touch.slice(1)}.` : "") : lesson.keys?.length ? `Press ${lesson.keys.join(" or ")}.` : "",
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.max(lo, v)));

  $: anchored = x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y);
  $: gap = (ring > 0 ? ring * 0.8 : 6) + 14;
  $: place = position(anchored, x ?? viewW / 2, y ?? viewH / 2, side, gap, slipW, slipH, viewW, viewH, top);

  function position(
    has: boolean,
    ax: number,
    ay: number,
    where: typeof side,
    away: number,
    w: number,
    h: number,
    vw: number,
    vh: number,
    minTop: number,
  ) {
    let left = ax - w / 2;
    let topY = ay - h / 2;
    if (has) {
      if (where === "above") topY = ay - away - h;
      if (where === "below") topY = ay + away;
      if (where === "left") left = ax - away - w;
      if (where === "right") left = ax + away;
    } else if (where === "below") {
      topY = vh - h - GUTTER * 6;
    }
    left = clamp(left, GUTTER, vw - GUTTER - w);
    topY = clamp(topY, minTop, vh - GUTTER - h);
    // The tail runs from the slip's nearest edge toward the anchor.
    const cx = clamp(ax, left + 12, left + w - 12);
    const cy = clamp(ay, topY + 8, topY + h - 8);
    let tx = cx;
    let ty = cy;
    if (where === "above") ty = topY + h;
    if (where === "below") ty = topY;
    if (where === "left") tx = left + w;
    if (where === "right") tx = left;
    return { left: Math.round(left), top: Math.round(topY), tx, ty };
  }

  // The tail stops short of the loop, so the two marks don't touch.
  $: tail = (() => {
    if (!anchored || x === null || y === null) return null;
    const dx = x - place.tx;
    const dy = y - place.ty;
    const length = Math.hypot(dx, dy);
    const stop = (ring > 0 ? ring * 0.9 : 6) + 4;
    if (length <= stop + 6) return null;
    const k = (length - stop) / length;
    return { x1: place.tx, y1: place.ty, x2: place.tx + dx * k, y2: place.ty + dy * k };
  })();

  // Each lesson gets one of the hand-drawn loops, so they don't all match.
  $: loop = LOOPS[(lesson?.id.length ?? 0) % LOOPS.length];
  $: loopW = ring * 2.3;
  $: loopH = ring * 1.75;
</script>

{#if lesson}
  {#key lesson.id}
    <div
      class="coach boba-ui"
      class:is-leaving={leaving}
      class:is-hidden={hidden}
      class:is-light={scene === "light"}
      class:is-touch={touch === true}
      class:is-keys={touch === false}
    >
      {#if anchored && x !== null && y !== null}
        <svg class="marks" width={viewW} height={viewH} aria-hidden="true">
          {#if ring > 0}
            <g transform="translate({x - loopW / 2} {y - loopH / 2}) scale({loopW / 44} {loopH / 28})">
              <path class="loop slab" d={loop} pathLength="1" transform="translate(1.5 1.5)" vector-effect="non-scaling-stroke" />
              <path class="loop ink" d={loop} pathLength="1" vector-effect="non-scaling-stroke" />
            </g>
          {/if}
          {#if tail}
            <line class="tail" x1={tail.x1} y1={tail.y1} x2={tail.x2} y2={tail.y2} />
          {/if}
        </svg>
      {/if}

      <p
        bind:this={slip}
        bind:offsetWidth={slipW}
        bind:offsetHeight={slipH}
        class="slip boba-riso is-small"
        style="left: {place.left}px; top: {place.top}px"
        aria-hidden="true"
      >
        {#if lesson.name}<span class="name">{lesson.name}</span>{/if}
        <span class="line">{lesson.text}</span>
        {#if lesson.keys?.length}
          <span class="boba-keys">
            {#each lesson.keys as key}<kbd>{key}</kbd>{/each}
          </span>
        {/if}
        {#if lesson.touch}<span class="touch">{lesson.touch}</span>{/if}
      </p>
    </div>
  {/key}
{/if}

<p class="sr-only" role="status" aria-live="polite">{announcement}</p>

<style>
  .coach {
    position: fixed;
    inset: 0;
    z-index: calc(var(--layer-overlay) + 2);
    pointer-events: none;
    --coach-mark: #fdf8f3;
  }

  .coach.is-light {
    --coach-mark: #1a1a1a;
  }

  .coach.is-hidden {
    visibility: hidden;
  }

  .marks {
    position: absolute;
    inset: 0;
    overflow: visible;
  }

  .loop {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: coach-draw 520ms var(--ease-emphasized) 60ms forwards;
  }

  .loop.ink {
    stroke: var(--coach-mark);
    stroke-width: 2.5;
  }

  .loop.slab {
    stroke: var(--b-slab);
    stroke-width: 2.5;
  }

  .tail {
    stroke: var(--coach-mark);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-dasharray: 2 5;
  }

  .slip {
    position: absolute;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-2);
    max-width: min(20rem, calc(100vw - 2rem));
    margin: 0;
    padding: var(--space-1-5) var(--space-3);
    color: var(--b-strong);
    font-size: 0.8125rem;
    line-height: 1.3;
    text-wrap: balance;
    animation: boba-rise var(--motion-slow) var(--ease-emphasized) both;
  }

  .name {
    font-style: italic;
  }

  .touch {
    display: none;
    color: var(--b-muted);
    font-style: italic;
  }

  @media (hover: none) and (pointer: coarse) {
    .touch {
      display: inline;
    }
  }

  /* The game knows which input it is showing: that wins over the media query. */
  .is-touch .touch {
    display: inline;
  }

  .is-touch :global(.boba-keys) {
    display: none;
  }

  .is-keys .touch {
    display: none;
  }

  .is-keys :global(.boba-keys) {
    display: inline-flex;
  }

  .is-leaving {
    opacity: 0;
    transition: opacity var(--motion-slow) var(--ease-standard);
  }

  @keyframes coach-draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loop {
      animation: none;
      stroke-dashoffset: 0;
    }

    .slip {
      animation: none;
    }

    .is-leaving {
      transition: none;
    }
  }
</style>
