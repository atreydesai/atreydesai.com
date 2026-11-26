<script lang="ts">
  // The lesson's callout, set in the world beside the thing it is about and
  // drawn in the scenes' own pixel language, like the score notes the games
  // already float over their scenes: a dark chip with stepped corners and
  // cream type, the line and its key, pixel corner marks round the thing,
  // and a dotted line between them. It is placed in viewport pixels by the
  // game, which follows the thing as it moves; only its small Continue takes
  // a press, so play carries on underneath. Paused, it hides.
  //
  // The game decides where the eye already is and puts the callout there:
  // beside the runner, under the cup, by the station. `side` says which
  // side of the anchor the slip sits on; where it won't fit there at its
  // measured size, it takes the opposite side, then above or below, so it
  // never covers its thing, and it always stays on screen.
  import { createEventDispatcher, onMount } from "svelte";

  import type { Lesson } from "#lib/arcade/core/coach.ts";

  export let lesson: Lesson | null = null;
  /** The thing being taught, in viewport pixels; null puts the slip at `side` alone. */
  export let x: number | null = null;
  export let y: number | null = null;
  export let side: "above" | "below" | "left" | "right" = "above";
  /** Half the size of the pen loop drawn around the anchor; 0 draws none. */
  export let ring = 0;
  /** Half the width of the thing itself, when it is wider than the loop would be (a long link): the loop stretches round it and the slip keeps clear of it. */
  export let width = 0;
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
  /**
   * The game is slowed for this explanation: the slip carries a Continue
   * button (Enter on a keyboard, which the game also listens for) that ends
   * it and brings play back to speed.
   */
  export let continuable = false;

  /** Where focus goes when the Continue button it was on goes away (the game's playfield). */
  export let returnFocus: (() => void) | null = null;

  const dispatch = createEventDispatcher<{ continue: null }>();

  function go() {
    dispatch("continue");
    returnFocus?.();
  }

  /** A Continue button that disappears while focused hands focus back to the game. */
  function handsBackFocus(node: HTMLButtonElement) {
    return {
      destroy() {
        if (document.activeElement === node || !document.activeElement || document.activeElement === document.body) returnFocus?.();
      },
    };
  }

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
          continuable && !(touch ?? coarse) ? "Enter continues." : "",
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.max(lo, v)));

  $: anchored = x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y);
  $: loopW = Math.max(ring * 2.3, width > 0 ? (width + 6) * 2 : 0);
  $: loopH = ring * 1.75;
  // How far the slip sits from the anchor on each axis: clear of the loop (or the thing).
  $: reachX = Math.max(ring * 0.8, loopW / 2, width);
  $: reachY = Math.max(ring * 0.8, loopH / 2);
  $: marked = ring > 0 || width > 0;
  $: gapX = (marked ? reachX : 6) + 14;
  $: gapY = (marked ? reachY : 6) + 14;
  $: place = position(anchored, x ?? viewW / 2, y ?? viewH / 2, side, gapX, gapY, slipW, slipH, viewW, viewH, top);
  $: reach = place.where === "left" || place.where === "right" ? reachX : reachY;

  /**
   * Whether the slip, at its measured size, fits on `where` of the anchor
   * without being pushed back over it by the screen's edge.
   */
  function fits(where: typeof side, ax: number, ay: number, gx: number, gy: number, w: number, h: number, vw: number, vh: number, minTop: number) {
    if (where === "left") return ax - gx - w >= GUTTER;
    if (where === "right") return ax + gx + w <= vw - GUTTER;
    if (where === "above") return ay - gy - h >= minTop;
    return ay + gy + h <= vh - GUTTER;
  }

  function position(
    has: boolean,
    ax: number,
    ay: number,
    asked: typeof side,
    gx: number,
    gy: number,
    w: number,
    h: number,
    vw: number,
    vh: number,
    minTop: number,
  ) {
    // The side asked for, unless the slip won't fit there (a narrow phone):
    // then the opposite side, then above or below, so it never covers its thing.
    let where = asked;
    if (has && w > 0 && h > 0 && !fits(where, ax, ay, gx, gy, w, h, vw, vh, minTop)) {
      const opposite = ({ left: "right", right: "left", above: "below", below: "above" } as const)[where];
      const order: Array<typeof side> = [opposite, "above", "below"];
      where = order.find((other) => fits(other, ax, ay, gx, gy, w, h, vw, vh, minTop)) ?? asked;
    }
    let left = ax - w / 2;
    let topY = ay - h / 2;
    if (has) {
      if (where === "above") topY = ay - gy - h;
      if (where === "below") topY = ay + gy;
      if (where === "left") left = ax - gx - w;
      if (where === "right") left = ax + gx;
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
    return { left: Math.round(left), top: Math.round(topY), tx, ty, where };
  }

  // The tail stops short of the loop, so the two marks don't touch.
  $: tail = (() => {
    if (!anchored || x === null || y === null) return null;
    const dx = x - place.tx;
    const dy = y - place.ty;
    const length = Math.hypot(dx, dy);
    const stop = (marked ? reach * 0.95 : 6) + 4;
    if (length <= stop + 6) return null;
    const k = (length - stop) / length;
    return { x1: place.tx, y1: place.ty, x2: place.tx + dx * k, y2: place.ty + dy * k };
  })();

  // Corner marks round the thing: four pixel L's at the corners of its box.
  const ARM = 9;
  const BAR = 3;
  $: bx = (x ?? 0) - loopW / 2;
  $: by = (y ?? 0) - loopH / 2;
  $: corners = [
    [bx, by, 1, 1],
    [bx + loopW, by, -1, 1],
    [bx, by + loopH, 1, -1],
    [bx + loopW, by + loopH, -1, -1],
  ].map(([cx, cy, sx, sy]) => ({
    h: { x: Math.round(sx > 0 ? cx : cx - ARM), y: Math.round(sy > 0 ? cy : cy - BAR), w: ARM, h: BAR },
    v: { x: Math.round(sx > 0 ? cx : cx - BAR), y: Math.round(sy > 0 ? cy : cy - ARM), w: BAR, h: ARM },
  }));
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
            <g class="corners">
              {#each corners as corner}
                <rect x={corner.h.x} y={corner.h.y} width={corner.h.w} height={corner.h.h} />
                <rect x={corner.v.x} y={corner.v.y} width={corner.v.w} height={corner.v.h} />
              {/each}
            </g>
          {/if}
          {#if tail}
            <line class="tail" x1={tail.x1} y1={tail.y1} x2={tail.x2} y2={tail.y2} />
          {/if}
        </svg>
      {/if}

      <div
        bind:this={slip}
        bind:offsetWidth={slipW}
        bind:offsetHeight={slipH}
        class="slip"
        style="left: {place.left}px; top: {place.top}px"
      >
        <!-- The live region below reads the words; the slip shows them. -->
        <p class="words" aria-hidden="true">
          {#if lesson.name}<span class="name">{lesson.name}</span>{/if}
          <span class="line">{lesson.text}</span>
          {#if lesson.keys?.length}
            <span class="boba-keys">
              {#each lesson.keys as key}<kbd>{key}</kbd>{/each}
            </span>
          {/if}
          {#if lesson.touch}<span class="touch">{lesson.touch}</span>{/if}
        </p>
        {#if continuable && !leaving}
          <button type="button" class="go" use:handsBackFocus on:click={go}>
            Continue
            <kbd aria-hidden="true">Enter</kbd>
          </button>
        {/if}
      </div>
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
    --chip: #141a2e;
    --chip-text: #fdf8f3;
    --chip-quiet: rgb(253 248 243 / 0.62);
    --chip-rule: rgb(253 248 243 / 0.32);
    --chip-gold: #ffd166;
  }

  .coach.is-light {
    --coach-mark: #2b2320;
  }

  .coach.is-hidden {
    visibility: hidden;
  }

  .marks {
    position: absolute;
    inset: 0;
    overflow: visible;
    shape-rendering: crispEdges;
  }

  /* Pixel corner marks, in the accent, like the corner ticks a link shows before it throws. */
  .corners rect {
    fill: #e85d4c;
  }

  .tail {
    stroke: var(--coach-mark);
    stroke-width: 3;
    stroke-linecap: butt;
    stroke-dasharray: 3 5;
  }

  /* A dark chip with one cell cut from each corner: the scenes' own note chips, larger. */
  .slip {
    --cut: 4px;
    position: absolute;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1-5) var(--space-3);
    max-width: min(20rem, calc(100vw - 2rem));
    margin: 0;
    padding: var(--space-2) var(--space-3);
    color: var(--chip-text);
    background: var(--chip);
    box-shadow: inset 0 0 0 2px var(--chip-rule);
    clip-path: polygon(
      var(--cut) 0,
      calc(100% - var(--cut)) 0,
      calc(100% - var(--cut)) var(--cut),
      100% var(--cut),
      100% calc(100% - var(--cut)),
      calc(100% - var(--cut)) calc(100% - var(--cut)),
      calc(100% - var(--cut)) 100%,
      var(--cut) 100%,
      var(--cut) calc(100% - var(--cut)),
      0 calc(100% - var(--cut)),
      0 var(--cut),
      var(--cut) var(--cut)
    );
    font-size: 0.8125rem;
    line-height: 1.35;
    text-wrap: balance;
    animation: coach-in var(--motion-slow) steps(3, end) both;
  }

  .name {
    color: var(--chip-gold);
    font-style: italic;
  }

  .words {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-2);
    margin: 0;
  }

  /* Keys as square pixel keycaps on the chip. */
  .slip :global(.boba-keys) {
    color: var(--chip-quiet);
  }

  .slip :global(.boba-keys kbd),
  .go kbd {
    padding: 0 var(--space-1);
    color: var(--chip-text);
    background: rgb(253 248 243 / 0.08);
    border: 1px solid var(--chip-rule);
    border-radius: 0;
    font: inherit;
    font-size: 0.75rem;
    line-height: 1.4;
  }

  /* Continue: a small square key on the chip, the only part that takes a press. */
  .go {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1-5);
    min-height: 1.75rem;
    margin-left: auto;
    padding: 0 var(--space-1-5);
    color: var(--chip-gold);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 0;
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 500;
    pointer-events: auto;
    touch-action: manipulation;
  }

  .go:hover {
    border-color: var(--chip-rule);
  }

  .is-keys .go kbd {
    display: inline;
  }

  .is-touch .go kbd {
    display: none;
  }

  .touch {
    display: none;
    color: var(--chip-quiet);
    font-style: italic;
  }

  @media (hover: none) and (pointer: coarse) {
    .touch {
      display: inline;
    }

    .go kbd {
      display: none;
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
    transition: opacity var(--motion-slow) steps(3, end);
  }

  /* It arrives in three steps, as pixel things do, not on a smooth ease. */
  @keyframes coach-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .slip {
      animation: none;
    }

    .is-leaving {
      transition: none;
    }
  }
</style>
