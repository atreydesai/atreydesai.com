<script lang="ts">
  // The lesson's callout, set in the world beside the thing it is about and
  // drawn in the scenes' own pixel language in the site's colours: a chip of
  // the dark riso paper with stepped corners, a faint cream rule and the
  // accent printed a cell off behind it, cream type in the arcade's one
  // family, keys as pixel keycaps, pixel corner marks round the thing and a
  // dotted line between them. It is placed in viewport pixels by the game,
  // which follows the thing as it moves; once the lesson is over it holds
  // its place, so it never chases its thing as play comes back. Continue
  // and an overflowing face take pointer input. Paused, it hides.
  //
  // The game decides where the eye already is and puts the callout there:
  // beside the runner, under the cup, by the station. `side` says which
  // side of the anchor the slip sits on; where a slip beside its thing won't
  // fit at its measured size, it takes the other side, then above or below,
  // so it never covers its thing, and it always stays on screen.
  import { createEventDispatcher, onMount } from "svelte";

  import type { Lesson } from "#lib/arcade/core/coach.ts";

  export let lesson: Lesson | null = null;
  /** The thing being taught, in viewport pixels; null puts the slip at `side` alone. */
  export let x: number | null = null;
  export let y: number | null = null;
  export let side: "above" | "below" | "left" | "right" = "above";
  /** Half the size of the brackets drawn around the anchor; 0 draws none. */
  export let ring = 0;
  /** Half the width of the thing itself, when it is wider than the ring would be (a long link): the brackets stretch round it and the slip keeps clear of it. */
  export let width = 0;
  /** Half the height of the thing itself, when it is taller than the ring would be (a tap): likewise. */
  export let height = 0;
  /** The scene behind is dark (most are): the loop and tail print cream, not ink. */
  export let scene: "dark" | "light" = "dark";
  /** The lesson is fading out (it has been readable long enough). */
  export let leaving = false;
  /**
   * The lesson is over (done, skipped, or its move made): the slip and its
   * marks hold where they are from here on, rather than following the thing.
   */
  export let ended = false;
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
  let faceH = 0;
  let contentH = 0;
  /** The slip's measured size, bindable, so a game can tell whether it fits beside a thing. */
  export let slipW = 0;
  export let slipH = 0;
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
  // actually has. Once the lesson is over its words are held, so losing its
  // Continue never says the lesson again.
  $: fresh =
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

  let announcement = "";
  $: announcement = !lesson || hidden ? "" : (ended || leaving) && announcement ? announcement : fresh;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.max(lo, v)));

  // Once the lesson is over (or fading), everything that places it is held
  // as it last was: the anchor, the side and the marks' size.
  let held: { x: number | null; y: number | null; side: typeof side; ring: number; width: number; height: number } | null = null;
  $: held = ended || leaving ? (held ?? { x, y, side, ring, width, height }) : null;
  $: ax = held ? held.x : x;
  $: ay = held ? held.y : y;
  $: aSide = held ? held.side : side;
  $: aRing = held ? held.ring : ring;
  $: aWidth = held ? held.width : width;
  $: aHeight = held ? held.height : height;

  $: anchored = ax !== null && ay !== null && Number.isFinite(ax) && Number.isFinite(ay);
  $: loopW = Math.max(aRing * 2.3, aWidth > 0 ? (aWidth + 6) * 2 : 0);
  $: loopH = Math.max(aRing * 1.75, aHeight > 0 ? (aHeight + 4) * 2 : 0);
  // How far the slip sits from the anchor on each axis: clear of the loop (or the thing).
  $: reachX = Math.max(aRing * 0.8, loopW / 2, aWidth);
  $: reachY = Math.max(aRing * 0.8, loopH / 2);
  $: marked = aRing > 0 || aWidth > 0;
  $: gapX = (marked ? reachX : 6) + 14;
  $: gapY = (marked ? reachY : 6) + 14;
  $: place = position(anchored, ax ?? viewW / 2, ay ?? viewH / 2, aSide, gapX, gapY, slipW, slipH, viewW, viewH, top);
  // Once over, the slip's own placement is held too, so its Continue going
  // away (and the slip measuring smaller) never moves what is still on screen.
  let heldPlace: ReturnType<typeof position> | null = null;
  $: heldPlace = ended || leaving ? (heldPlace ?? place) : null;
  $: shown = heldPlace ?? place;
  $: reach = shown.where === "left" || shown.where === "right" ? reachX : reachY;

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
    // Beside the thing, unless the slip won't fit there (a narrow phone):
    // then the other side, then above or below, so it never covers its thing.
    // Above or below is the game's own choice, made to keep clear of what
    // moves past (straw stab's cups over its belt), so it is never flipped;
    // the screen's edge only nudges it.
    let where = asked;
    if (has && w > 0 && h > 0 && (where === "left" || where === "right") && !fits(where, ax, ay, gx, gy, w, h, vw, vh, minTop)) {
      const order: Array<typeof side> = [where === "left" ? "right" : "left", "above", "below"];
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
    // Kept under the tickets, unless the slip is too tall for the room left
    // (large text on a short screen): then it rises over them rather than
    // leaving Continue below the screen, and scrolls if even that is short.
    topY = clamp(topY, Math.max(GUTTER, Math.min(minTop, vh - GUTTER - h)), vh - GUTTER - h);
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
    if (!anchored || ax === null || ay === null) return null;
    const dx = ax - shown.tx;
    const dy = ay - shown.ty;
    const length = Math.hypot(dx, dy);
    const stop = (marked ? reach * 0.95 : 6) + 4;
    if (length <= stop + 6) return null;
    const k = (length - stop) / length;
    return { x1: shown.tx, y1: shown.ty, x2: shown.tx + dx * k, y2: shown.ty + dy * k };
  })();

  // Corner marks round the thing: four pixel L's at the corners of its box.
  const ARM = 9;
  const BAR = 3;
  $: bx = (ax ?? 0) - loopW / 2;
  $: by = (ay ?? 0) - loopH / 2;
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
      class:above-hud={shown.top < top}
      class:is-leaving={leaving}
      class:is-hidden={hidden}
      class:is-light={scene === "light"}
      class:is-touch={touch === true}
      class:is-keys={touch === false}
    >
      {#if anchored && ax !== null && ay !== null}
        <svg class="marks" width={viewW} height={viewH} aria-hidden="true">
          {#if aRing > 0}
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
        bind:offsetWidth={slipW}
        bind:offsetHeight={slipH}
        class="slip"
        style="left: {shown.left}px; top: {shown.top}px"
      >
        <div class="face" bind:clientHeight={faceH} class:scrollable={contentH > faceH}>
          <div class="content" bind:offsetHeight={contentH}>
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
    /* The site's dark riso paper and its cream ink, the same in both themes,
       since the scenes don't follow the theme. */
    --coach-mark: #fdf8f3;
    --chip: #2a2422;
    --chip-text: #fdf8f3;
    --chip-quiet: #e8d5c4;
    --chip-rule: rgb(253 248 243 / 0.22);
    --chip-name: #dba84d;
    --chip-slab: #e85d4c;
    --key-face: #fdf8f3;
    --key-ink: #1a1a1a;
    --key-shade: #b9ab98;
    /* One cell cut from each corner: the pixel chip's outline. */
    --notch: polygon(
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
  }

  .coach.is-light {
    --coach-mark: #1a1a1a;
  }

  .coach.above-hud {
    z-index: calc(var(--layer-overlay) + 4);
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

  /* Pixel corner marks round the thing, in the accent. */
  .corners rect {
    fill: var(--chip-slab);
  }

  .tail {
    stroke: var(--coach-mark);
    stroke-width: 3;
    stroke-linecap: butt;
    stroke-dasharray: 3 5;
  }

  /* The slip carries the accent, printed one cell down and right of the chip
     (the riso slab, pixel-crisp); the chip itself is cut on the inner face. */
  .slip {
    position: absolute;
    max-width: min(19rem, calc(100vw - 2rem));
    filter: drop-shadow(4px 4px 0 var(--chip-slab));
    animation: coach-in var(--motion-slow) steps(3, end) both;
  }

  .face {
    --cut: 4px;
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    color: var(--chip-text);
    background: var(--chip);
    box-shadow: inset 0 0 0 2px var(--chip-rule);
    clip-path: var(--notch);
    font-family: var(--font-ui);
    font-size: 0.9375rem;
    font-weight: 400;
    line-height: 1.4;
    text-wrap: pretty;
  }

  .face.scrollable {
    pointer-events: auto;
  }

  .content {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    padding: 0.625rem 0.875rem;
  }

  .name {
    color: var(--chip-name);
    font-style: italic;
  }

  .words {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-2);
    margin: 0;
  }

  /* Keys are pixel keycaps: a cream face, ink lettering, a shaded foot. */
  .slip :global(.boba-keys) {
    gap: var(--space-1);
    color: var(--chip-quiet);
  }

  .slip :global(.boba-keys kbd) {
    --cut: 2px;
    margin: 0;
    padding: 0.125rem 0.375rem 0.25rem;
    color: var(--key-ink);
    background: var(--key-face);
    border: 0;
    border-radius: 0;
    box-shadow: inset 0 -2px 0 var(--key-shade);
    clip-path: var(--notch);
    font-family: var(--font-ui);
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.2;
  }

  /* Continue is a pixel key. */
  .go {
    --cut: 2px;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2rem;
    margin-left: auto;
    padding: 0 0.625rem 0.125rem;
    color: var(--key-ink);
    background: var(--key-face);
    border: 0;
    border-radius: 0;
    box-shadow: inset 0 -3px 0 var(--key-shade);
    clip-path: var(--notch);
    cursor: pointer;
    font-family: var(--font-ui);
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1;
    pointer-events: auto;
    touch-action: manipulation;
  }

  @media (hover: hover) {
    .go:hover {
      background: #ffffff;
    }
  }

  .go:active {
    box-shadow: inset 0 -1px 0 var(--key-shade);
    transform: translateY(2px);
  }

  /* The clip would cut a ring drawn outside, so focus is drawn inside the key. */
  .go:focus-visible {
    outline: 2px solid transparent;
    box-shadow:
      inset 0 -3px 0 var(--key-shade),
      inset 0 0 0 2px var(--chip-slab);
  }

  .go kbd {
    padding: 0;
    color: #666666;
    background: none;
    border: 0;
    font: inherit;
    font-size: 0.6875rem;
    font-weight: 500;
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

  @media (max-width: 640px) {
    .face {
      font-size: 0.875rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .slip {
      animation: none;
    }

    .is-leaving {
      transition: none;
    }

    .go:active {
      transform: none;
    }
  }
</style>
