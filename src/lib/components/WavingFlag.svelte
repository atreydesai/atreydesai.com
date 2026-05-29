<script lang="ts">
  import { onMount } from "svelte";

  // A pixel-art waving flag (à la 8-bit "Octobit" flags). The song name is baked
  // crisply into a buffer at full device resolution, then redrawn each frame
  // column-by-column at 1:1 with per-column vertical offsets SNAPPED to chunky
  // pixel steps and cycled through FRAMES discrete frames — so the cloth ripples
  // blockily while the text stays sharp. Anchored at the pole, more sway at the
  // free end.
  export let text: string;
  export let fill = "#e85d4c";
  export let ink = "#fdf8f3";
  export let shadow = "rgba(26, 26, 26, 0.3)";

  const FONT_CSS = 12; // readable text size (css px)
  const PADX_CSS = 5;
  const PADY_CSS = 3;
  const AMP_CSS = 4; // wave amplitude (css px)
  const STEP_CSS = 2; // wave snaps to this px grid → blocky, not smooth
  const FRAMES = 8; // discrete "drawings"
  const STEP_MS = 110; // ms per frame

  let canvas: HTMLCanvasElement;
  let buf: HTMLCanvasElement | null = null;
  let bw = 0; // buffer width (device px)
  let bh = 0; // buffer height (device px)
  let amp = 0; // amplitude (device px)
  let step = 1; // wave grid (device px)
  let shOff = 2; // shadow offset (device px)
  let frame = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let mounted = false;

  function build() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const f = Math.round(FONT_CSS * dpr);
    const padx = Math.round(PADX_CSS * dpr);
    const pady = Math.round(PADY_CSS * dpr);
    amp = Math.round(AMP_CSS * dpr);
    step = Math.max(1, Math.round(STEP_CSS * dpr));
    shOff = Math.max(1, Math.round(2 * dpr));
    const font = `${f}px ui-monospace, "Courier New", monospace`;

    const m = document.createElement("canvas").getContext("2d");
    if (!m) return;
    m.font = font;
    const label = (text || "").toUpperCase();
    const tw = Math.max(1, Math.ceil(m.measureText(label).width));
    bw = tw + padx * 2;
    bh = f + pady * 2;

    // Bake the flag crisply (no upscaling of the text).
    buf = document.createElement("canvas");
    buf.width = bw;
    buf.height = bh;
    const b = buf.getContext("2d");
    if (!b) return;
    b.fillStyle = fill;
    b.fillRect(0, 0, bw, bh);
    b.fillStyle = "rgba(0,0,0,0.16)"; // bottom shade strip for depth
    b.fillRect(0, bh - Math.max(1, Math.round(dpr)), bw, Math.max(1, Math.round(dpr)));
    b.fillStyle = ink;
    b.font = font;
    b.textBaseline = "middle";
    b.fillText(label, padx, Math.round(bh / 2));

    // Device-resolution backing; CSS size = backing / dpr → sharp on retina.
    canvas.width = bw + shOff;
    canvas.height = bh + amp * 2 + shOff;
    canvas.style.width = canvas.width / dpr + "px";
    canvas.style.height = canvas.height / dpr + "px";
  }

  function draw() {
    if (!canvas || !buf) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const wl = Math.max(6, bw * 0.7);
    const ph = (frame / FRAMES) * Math.PI * 2;

    const off = new Array(bw);
    for (let x = 0; x < bw; x++) {
      const grow = bw > 1 ? x / (bw - 1) : 0; // 0 at pole → 1 at free end
      const raw = amp * grow * Math.sin((x / wl) * Math.PI * 2 - ph);
      off[x] = Math.round(raw / step) * step; // snap to chunky grid
    }

    // offset shadow (per-column silhouette)
    ctx.fillStyle = shadow;
    for (let x = 0; x < bw; x++) {
      ctx.fillRect(x + shOff, amp + off[x] + shOff, 1, bh);
    }
    // crisp flag, drawn column by column 1:1 at its blocky offset
    for (let x = 0; x < bw; x++) {
      ctx.drawImage(buf, x, 0, 1, bh, x, amp + off[x], 1, bh);
    }
  }

  function tick() {
    frame = (frame + 1) % FRAMES;
    draw();
  }

  onMount(() => {
    mounted = true;
    build();
    draw();
    const reduce =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) timer = setInterval(tick, STEP_MS);
    return () => {
      if (timer) clearInterval(timer);
    };
  });

  // Rebuild when the song name changes.
  $: if (mounted && text) {
    build();
    draw();
  }
</script>

<canvas bind:this={canvas} class="waving-flag" aria-label={text}></canvas>

<style>
  .waving-flag {
    display: block;
    margin-left: 2px;
  }
</style>
