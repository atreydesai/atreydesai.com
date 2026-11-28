<script lang="ts">
  // A painted scene on its own small pixel grid, scaled up whole and crisp.
  // It paints into a pixel buffer and puts that on the canvas in one go.
  // A still scene paints once each time `version` changes and never again;
  // a `live` one runs a frame loop (capped at `fps`) only while it is on
  // screen and the tab is showing. A scene with a static backdrop passes it
  // as `bake`: it is painted once per `bakeKey` and copied under `draw`'s
  // moving part each frame.
  import { onMount, untrack } from "svelte";
  import { Painter } from "#lib/arcade/order-up/art/paint.ts";
  import { PixelBuffer } from "#lib/arcade/core/pixel-buffer.ts";

  interface Props {
    width: number;
    height: number;
    draw: (painter: Painter, time: number) => void;
    /** The still part of the picture, baked once per `bakeKey`. */
    bake?: (painter: Painter) => void;
    bakeKey?: string;
    live?: boolean;
    /** Frames a second while live. */
    fps?: number;
    /** Repaints when this changes; pass a string so equal states don't repaint. */
    version?: unknown;
    label?: string;
  }

  let { width, height, draw, bake, bakeKey = "", live = false, fps = 60, version = 0, label = "" }: Props = $props();
  let canvas = $state<HTMLCanvasElement>();
  let onScreen = $state(true);
  let tabShown = $state(true);
  let frame: PixelBuffer | null = null;
  let back: PixelBuffer | null = null;
  let backFor = "";
  let time = 0;

  function paint() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (!frame || frame.width !== width || frame.height !== height) frame = new PixelBuffer(width, height);
    if (bake) {
      const key = width + "x" + height + "|" + bakeKey;
      if (!back || backFor !== key) {
        back = new PixelBuffer(width, height);
        bake(new Painter(back, width, height));
        backFor = key;
      }
      frame.words.set(back.words);
    } else frame.clear();
    frame.globalAlpha = 1;
    frame.clip = null;
    draw(new Painter(frame, width, height), time);
    frame.putOn(ctx);
  }

  // One paint per change of what the picture shows (never per parent update).
  $effect(() => {
    void version;
    void bakeKey;
    void width;
    void height;
    void canvas;
    untrack(paint);
  });

  // The frame loop runs only while live, on screen and with the tab showing.
  $effect(() => {
    if (!live || !onScreen || !tabShown || !canvas) return;
    const step = 1000 / Math.max(1, fps);
    let raf = 0;
    let last = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      time += last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (now - lastPaint < step - 2) return;
      lastPaint = now;
      paint();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  onMount(() => {
    const seen = new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting));
    if (canvas) seen.observe(canvas);
    const visibility = () => (tabShown = !document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      seen.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  });
</script>

<canvas bind:this={canvas} class="pixel-scene" aria-label={label || undefined} role={label ? "img" : undefined}></canvas>

<style>
  .pixel-scene {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
    background: #2c2629;
  }
</style>
