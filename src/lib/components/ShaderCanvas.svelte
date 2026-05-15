<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { SHADERS, VS } from "$lib/shaders/wallpapers";

  export let variant: "mound" | "nebula" = "mound";
  export let height: string = "clamp(280px, 50vw, 480px)";
  export let showCaption: boolean = true;
  export let showFps: boolean = true;

  let canvas: HTMLCanvasElement;
  let container: HTMLElement;
  let raf: number;
  let gl: WebGLRenderingContext | null = null;
  let cleanup: (() => void) | null = null;
  let failed = false;
  let fps = 0;

  const spec = SHADERS[variant];

  onMount(() => {
    if (!canvas) return;
    const ctx = canvas.getContext("webgl", {
      antialias: false,
      premultipliedAlpha: false,
      alpha: false,
    });
    if (!ctx) {
      failed = true;
      return;
    }
    gl = ctx;

    function compile(type: number, src: string) {
      const sh = gl!.createShader(type)!;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
        console.error("shader compile:", gl!.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }

    const vs = compile(gl.VERTEX_SHADER, VS)!;
    const fs = compile(gl.FRAGMENT_SHADER, spec.fs)!;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("link:", gl.getProgramInfoLog(prog));
      failed = true;
      return;
    }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const loc = {
      a_pos: gl.getAttribLocation(prog, "a_pos"),
      u_res: gl.getUniformLocation(prog, "u_res"),
      u_mouse: gl.getUniformLocation(prog, "u_mouse"),
      u_mouseRaw: gl.getUniformLocation(prog, "u_mouseRaw"),
      u_time: gl.getUniformLocation(prog, "u_time"),
      u_click: gl.getUniformLocation(prog, "u_click"),
      u_dpr: gl.getUniformLocation(prog, "u_dpr"),
    };

    const mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, down: 0, downSmooth: 0 };
    const start = performance.now();
    let frameCount = 0;
    let lastFpsT = start;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl!.viewport(0, 0, w, h);
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function setMouse(e: PointerEvent | TouchEvent) {
      const rect = canvas.getBoundingClientRect();
      let cx: number, cy: number;
      if ("touches" in e && e.touches.length) {
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
      } else {
        const pe = e as PointerEvent;
        cx = pe.clientX;
        cy = pe.clientY;
      }
      mouse.x = (cx - rect.left) / rect.width;
      mouse.y = 1.0 - (cy - rect.top) / rect.height;
    }
    const onMove = (e: PointerEvent) => setMouse(e);
    const onTouchMove = (e: TouchEvent) => setMouse(e);
    const onDown = (e: PointerEvent) => {
      mouse.down = 1;
      setMouse(e);
    };
    const onUp = () => {
      mouse.down = 0;
    };
    const onLeave = () => {
      mouse.x = 0.5;
      mouse.y = 0.5;
      mouse.down = 0;
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    let visible = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    function render(now: number) {
      if (!gl) return;
      if (!visible) {
        raf = requestAnimationFrame(render);
        return;
      }
      const t = (now - start) / 1000;
      mouse.sx += (mouse.x - mouse.sx) * 0.08;
      mouse.sy += (mouse.y - mouse.sy) * 0.08;
      mouse.downSmooth += (mouse.down - mouse.downSmooth) * 0.12;

      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(loc.a_pos);
      gl.vertexAttribPointer(loc.a_pos, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(loc.u_res, canvas.width, canvas.height);
      gl.uniform2f(loc.u_mouse, mouse.sx, mouse.sy);
      gl.uniform2f(loc.u_mouseRaw, mouse.x, mouse.y);
      gl.uniform1f(loc.u_time, t);
      gl.uniform1f(loc.u_click, mouse.downSmooth);
      gl.uniform1f(
        loc.u_dpr,
        Math.min(window.devicePixelRatio || 1, 2)
      );

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      frameCount++;
      if (now - lastFpsT > 500) {
        fps = Math.round((frameCount * 1000) / (now - lastFpsT));
        frameCount = 0;
        lastFpsT = now;
      }

      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    cleanup = () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      gl?.deleteBuffer(quad);
      gl?.deleteProgram(prog);
      gl?.deleteShader(vs);
      gl?.deleteShader(fs);
      gl = null;
    };
  });

  onDestroy(() => {
    cleanup?.();
  });
</script>

<figure class="shader-figure" bind:this={container} style="--shader-h: {height}">
  {#if failed}
    <div class="shader-fallback">
      WebGL is not available on this device.
    </div>
  {:else}
    <div class="canvas-wrap">
      <canvas bind:this={canvas} aria-label="{spec.name} shader demo"></canvas>
      {#if showFps}
        <div class="fps-overlay" aria-hidden="true">{fps} fps</div>
      {/if}
    </div>
  {/if}
  {#if showCaption}
    <figcaption>
      <span class="cap-name">{spec.name}</span>
      <span class="cap-desc">{spec.desc}</span>
    </figcaption>
  {/if}
</figure>

<style lang="postcss">
  .shader-figure {
    margin: 2rem 0;
    border-radius: 0.75rem;
    overflow: hidden;
    background: theme("colors.cream.100");
    border: 1px solid theme("colors.ink.100");
  }
  :global(.dark) .shader-figure {
    background: theme("colors.ink.800");
    border-color: theme("colors.ink.700");
  }
  .canvas-wrap {
    position: relative;
  }
  canvas {
    display: block;
    width: 100%;
    height: var(--shader-h);
    touch-action: none;
    cursor: crosshair;
  }
  .fps-overlay {
    position: absolute;
    top: 10px;
    right: 12px;
    padding: 4px 8px;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: rgba(20, 25, 35, 0.75);
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    pointer-events: none;
    font-variant-numeric: tabular-nums;
  }
  .shader-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--shader-h);
    color: theme("colors.ink.500");
    font-size: 0.875rem;
  }
  figcaption {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0.625rem 0.875rem;
    border-top: 1px solid theme("colors.ink.100");
    background: theme("colors.cream.50");
    font-size: 0.75rem;
  }
  :global(.dark) figcaption {
    background: theme("colors.ink.900");
    border-color: theme("colors.ink.700");
  }
  .cap-name {
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: theme("colors.ink.700");
  }
  :global(.dark) .cap-name {
    color: theme("colors.cream.200");
  }
  .cap-desc {
    color: theme("colors.ink.500");
  }
  :global(.dark) .cap-desc {
    color: theme("colors.ink.400");
  }
</style>
