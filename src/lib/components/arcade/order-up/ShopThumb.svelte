<script module lang="ts">
  // One bake per shop, shared by every thumbnail of it.
  const cache = new Map<string, HTMLCanvasElement>();
  const waiting = new Map<string, Promise<HTMLCanvasElement>>();
</script>

<script lang="ts">
  // A shop's own room, baked at midday and cropped to its middle: what the
  // shops page shows for each one, so no two look alike.
  import { SHOPS } from "#lib/arcade/order-up/content/index.ts";
  import { roomHeight, HH, WALL } from "#lib/arcade/order-up/art/room/scene.ts";
  import { venueFor } from "#lib/arcade/order-up/art/room/venues/index.ts";
  import { bake, pixelsToCanvas } from "#lib/arcade/order-up/art/room/bake-client.ts";

  let { id, width = 160, height = 90, scale = 1, locked = false }: { id: string; width?: number; height?: number; scale?: number; locked?: boolean } = $props();
  let canvas = $state<HTMLCanvasElement>();

  function get(shopId: string) {
    const hit = cache.get(shopId);
    if (hit) return Promise.resolve(hit);
    let p = waiting.get(shopId);
    if (!p) {
      const shop = SHOPS.find((s) => s.id === shopId)!;
      const venue = venueFor(shopId, { cols: shop.layout.width, rows: shop.layout.height, hour: () => 13 });
      const width = Math.round(roomHeight(venue) * 1.7);
      p = bake({
        shop: shopId,
        cols: shop.layout.width,
        rows: shop.layout.height,
        layout: shop.layout.counters as unknown as Record<string, [number, number]>,
        decor: [],
        hour: 13,
        season: "spring",
        weather: "sun",
        width,
        flat: true,
      }).then((r) => {
        const c = pixelsToCanvas(r.background, r.width, r.height);
        // Remember where the room's middle is, for cropping.
        c.dataset.cx = String(r.grid.ox + ((venue.cols - venue.rows) * r.grid.hw) / 2);
        c.dataset.cy = String(r.grid.oy + ((venue.cols + venue.rows) * HH) / 2 - (venue.wallHeight ?? WALL) / 3);
        cache.set(shopId, c);
        waiting.delete(shopId);
        return c;
      });
      waiting.set(shopId, p);
    }
    return p;
  }

  $effect(() => {
    const shopId = id;
    let alive = true;
    void get(shopId).then((src) => {
      if (!alive || !canvas) return;
      const w = Math.round(width / scale);
      const h = Math.round(height / scale);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      const sx = Math.round(Number(src.dataset.cx) - w / 2);
      const sy = Math.round(Number(src.dataset.cy) - h / 2);
      ctx.drawImage(src, sx, sy, w, h, 0, 0, w, h);
    });
    return () => {
      alive = false;
    };
  });
</script>

<canvas bind:this={canvas} class="thumb" class:locked style:width="{width}px" style:height="{height}px" aria-hidden="true"></canvas>

<style>
  .thumb {
    display: block;
    flex: none;
    max-width: 100%;
    background: #3a3134;
    image-rendering: pixelated;
    clip-path: var(--notch);
  }

  .thumb.locked {
    filter: grayscale(1) brightness(0.8);
    opacity: 0.55;
  }
</style>
