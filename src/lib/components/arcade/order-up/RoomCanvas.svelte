<script lang="ts">
  // The shop's room, live: the venue baked for the hour and the weather into
  // a background, an atlas and an overhead layer, with the chef, crew and
  // guests walking over it. One canvas at the art's own pixel size, scaled
  // up crisp. It re-bakes only when the light steps (a few times an hour of
  // shop time, the next step baked ahead while the browser is idle), draws
  // at full rate only while someone walks and at a dozen frames a second
  // otherwise, and stops when it is off screen or the tab is hidden.
  // Counters are real buttons laid over the art; guests can be clicked too.
  import { onMount } from "svelte";
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import type { Station } from "#lib/arcade/order-up/content/schema.ts";
  import { SHOPS, SKILLS } from "#lib/arcade/order-up/content/index.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { lightAt, shiftHour, PLANNING_HOUR, type Light } from "#lib/arcade/core/light.ts";
  import { project, unproject } from "#lib/arcade/core/iso.ts";
  import { blit } from "#lib/arcade/core/atlas.ts";
  import { DynamicAtlas } from "#lib/arcade/core/dynamic-atlas.ts";
  import type { AtlasFrame } from "#lib/arcade/core/atlas.ts";
  import { roomHeight, groundGrid, paintPerson, type PlacedSprite } from "#lib/arcade/order-up/art/room/scene.ts";
  import { venueFor } from "#lib/arcade/order-up/art/room/venues/index.ts";
  import { bake, pixelsToCanvas } from "#lib/arcade/order-up/art/room/bake-client.ts";
  import type { BakeJob } from "#lib/arcade/order-up/art/room/bake-job.ts";
  import { createCast, type Walker } from "#lib/arcade/order-up/art/room/actors.ts";
  import { chefSprite, guestSprite, CARRY } from "#lib/arcade/order-up/art/room/people.ts";
  import { createFloor } from "#lib/arcade/order-up/art/floor.ts";
  import type { Venue } from "#lib/arcade/order-up/art/room/types.ts";
  import OrderPixelWord from "../OrderPixelWord.svelte";

  interface Props {
    campaign: Campaign;
    shift: Shift | null;
    station: Station;
    weather: string;
    paused?: boolean;
    reduced?: boolean;
    choose: (station: Station) => void;
    chooseTicket: (slot: number) => void;
    /** Arranging: the floor's tiles become buttons that move the picked thing there. */
    arrange?: boolean;
    move?: (x: number, y: number) => void;
    moving?: string;
  }

  let { campaign, shift, station, weather, paused = false, reduced = false, choose, chooseTicket, arrange = false, move = () => {}, moving = "" }: Props = $props();

  const STATIONS: Station[] = ["brew", "prep", "build", "serve", "stock"];
  const NAMES: Record<Station, string> = { brew: "Brew", prep: "Prep", build: "Build", serve: "Serve", stock: "Stock" };

  let frame = $state<HTMLDivElement>();
  let canvas = $state<HTMLCanvasElement>();
  let box = $state({ w: 900, h: 535 });

  const shop = $derived(SHOPS.find((s) => s.id === campaign.expansion.activeShop) ?? SHOPS[0]);
  const owned = $derived(campaign.expansion.shops[shop.id]);
  // The layout and decor are edited in place by the game, so they're read
  // fresh whenever they're needed rather than held in a derived value.
  function liveLayout(): Record<string, [number, number]> {
    return (campaign.expansion.shops[shop.id]?.layout ?? shop.layout.counters) as Record<string, [number, number]>;
  }
  function layoutSig() {
    const l = liveLayout();
    return STATIONS.map((s) => l[s]?.join(",")).join(";") + "|" + JSON.stringify(campaign.expansion.shops[shop.id]?.decor ?? []);
  }
  const season = $derived(calendar(campaign.day).season.id);

  let hourNow = PLANNING_HOUR;
  const venue: Venue = $derived(venueFor(shop.id, { cols: shop.layout.width, rows: shop.layout.height, hour: () => hourNow }));
  const nativeH = $derived(roomHeight(venue));
  const nativeW = $derived(Math.round(Math.min(nativeH * 2.3, Math.max(nativeH * 1.3, (nativeH * box.w) / Math.max(1, box.h)))));
  // Arranging can't put a counter on structure or on something the venue stands on its floor.
  const blocked = $derived.by(() => {
    const cells = new Set<number>(shop.layout.blocked);
    for (const p of venue.props) {
      if (p.flat) continue;
      for (let y = Math.floor(p.y); y < Math.ceil(p.y + (p.d ?? 1)); y++)
        for (let x = Math.floor(p.x); x < Math.ceil(p.x + (p.w ?? 1)); x++)
          if (x >= 0 && y >= 0 && x < venue.cols && y < venue.rows) cells.add(y * venue.cols + x);
    }
    return cells;
  });

  // What is running at each counter, for steam and the working dot.
  const busy = $derived(
    new Set(
      (shift?.tickets ?? [])
        .flatMap((t) => (t ? t.cups : []))
        .filter((c) => c.run)
        .map((c) => SKILLS.find((k) => k.id === c.run!.id)?.station)
        .filter(Boolean) as string[],
    ),
  );

  // Baked layers for the current light, and the step baked ahead. Bakes run
  // in a worker; the picture on screen stays until the next one arrives.
  type Room = {
    width: number;
    height: number;
    grid: { ox: number; oy: number; hw: number; hh: number };
    light: Light;
    sprites: PlacedSprite[];
    frames: Map<string, AtlasFrame>;
    silhouette: number[];
  };
  type Layers = { key: string; room: Room; bg: HTMLCanvasElement; atlas: HTMLCanvasElement; overhead: HTMLCanvasElement };
  let layers: Layers | null = null;
  let ahead: Layers | null = null;
  let fadeFrom: HTMLCanvasElement | null = null;
  let fadeStart = 0;
  let people: DynamicAtlas | null = null;
  let peopleLight = "";
  /** The baked room's grid, for laying buttons over it. */
  let frameGrid = $state<{ ox: number; oy: number; hw: number; hh: number; width: number; height: number } | null>(null);
  let signs = $state<{ id: Station; x: number; y: number; w: number; h: number; lx: number; ly: number; clip: string; depth: number }[]>([]);

  function lights(hour: number): [Light, Light] {
    return [lightAt({ hour, season, weather, indoor: true }), lightAt({ hour, season, weather, indoor: false })];
  }

  function keyFor(hour: number) {
    const [l, o] = lights(hour);
    return [venue.id, l.key, o.key, nativeW, nativeH, layoutSig()].join("|");
  }

  function request(hour: number): Promise<Layers | null> {
    const key = keyFor(hour);
    const [light] = lights(hour);
    const job: BakeJob = {
      shop: shop.id,
      cols: shop.layout.width,
      rows: shop.layout.height,
      layout: Object.fromEntries(STATIONS.filter((s) => liveLayout()[s]).map((s) => [s, [liveLayout()[s][0], liveLayout()[s][1]]])) as Record<string, [number, number]>,
      decor: (campaign.expansion.shops[shop.id]?.decor ?? []).map((d) => ({ ...d })),
      hour: light.hour,
      season,
      weather,
      width: nativeW,
    };
    return bake(job).then((r) => ({
      key,
      room: { width: r.width, height: r.height, grid: r.grid, light, sprites: r.sprites, frames: new Map(r.frames), silhouette: r.silhouette },
      bg: pixelsToCanvas(r.background, r.width, r.height),
      atlas: pixelsToCanvas(r.atlas, r.atlasWidth, r.atlasHeight),
      overhead: pixelsToCanvas(r.overhead, r.width, r.height),
    }));
  }

  function currentHour() {
    return shift ? shiftHour(shift.elapsed / Math.max(1, shift.duration)) : PLANNING_HOUR;
  }

  function show(next: Layers, hour: number) {
    if (layers && layers.room.width === next.room.width && layers.room.height === next.room.height && !reduced) {
      fadeFrom = layers.bg;
      fadeStart = performance.now();
    } else fadeFrom = null;
    layers = next;
    hourNow = hour;
    frameGrid = { ...next.room.grid, width: next.room.width, height: next.room.height };
    const layout = liveLayout();
    signs = STATIONS.filter((s) => layout[s] && (s !== "stock" || campaign.day >= 3)).map((s) => {
      const [x, y] = layout[s];
      const g = next.room.grid;
      const h = venue.counter.height ?? 15;
      const left = project(g, x, y + 1, 0);
      const right = project(g, x + 1, y, 0);
      const back = project(g, x, y, s === "stock" ? 44 : h + 8);
      const front = project(g, x + 1, y + 1, 0);
      // The label hangs on the counter's front corner, halfway up.
      const mid = project(g, x + 1, y + 1, s === "stock" ? 18 : h * 0.5);
      // The button is the counter's own outline: its top and two faces, nothing around it.
      const top = s === "stock" ? 44 : h + 8;
      const pts = [project(g, x, y, top), project(g, x + 1, y, top), project(g, x + 1, y, 0), project(g, x + 1, y + 1, 0), project(g, x, y + 1, 0), project(g, x, y + 1, top)];
      const bw = right.x - left.x;
      const bh = front.y - back.y;
      const clip = "polygon(" + pts.map((pt) => `${(((pt.x - left.x) / bw) * 100).toFixed(1)}% ${(((pt.y - back.y) / bh) * 100).toFixed(1)}%`).join(", ") + ")";
      return {
        id: s,
        x: (left.x / next.room.width) * 100,
        y: (back.y / next.room.height) * 100,
        w: (bw / next.room.width) * 100,
        h: (bh / next.room.height) * 100,
        lx: (mid.x / next.room.width) * 100,
        ly: (mid.y / next.room.height) * 100,
        clip,
        depth: x + y,
      };
    }).sort((a, b) => a.depth - b.depth);
  }

  /** True when a new picture went up this frame. */
  function ensureLayers() {
    const hour = currentHour();
    const key = keyFor(hour);
    let changed = false;
    if (layers?.key !== key) {
      const ready = ahead?.key === key ? ahead : recent.get(key);
      if (ready) {
        show(ready, hour);
        if (ahead === ready) ahead = null;
        changed = true;
      } else ask(hour, key);
    }
    // Bake the next light step ahead, while this one is on screen.
    const nextKey = keyFor(hour + 0.25);
    if (layers?.key === key && ahead?.key !== nextKey && nextKey !== key) ask(hour + 0.25, nextKey);
    return changed;
  }
  let dirtyFromBake = false;

  // Bakes in flight and the last few finished, by key: a request is never
  // lost to a newer one, and going back to a recent picture is instant.
  const pending = new Set<string>();
  const recent = new Map<string, Layers>();
  function ask(hour: number, key: string) {
    if (pending.has(key)) return;
    pending.add(key);
    void request(hour)
      .then((next) => {
        if (!next) return;
        recent.set(next.key, next);
        while (recent.size > 4) recent.delete(recent.keys().next().value!);
        const now = keyFor(currentHour());
        if (next.key === now && layers?.key !== now) {
          show(next, currentHour());
          dirtyFromBake = true;
        } else if (next.key === keyFor(currentHour() + 0.25)) ahead = next;
      })
      .finally(() => pending.delete(key));
  }

  const cast = createCast();
  const floor = createFloor();
  let planned = false;

  function replan() {
    const crew = campaign.expansion.staff
      .filter((p) => p.shop === shop.id && p.rota[(campaign.day - 1) % 7])
      .map((p) => ({ id: p.id, name: p.portrait || p.name, station: p.station }));
    cast.plan(venue, liveLayout(), station, shift ? floor(shift) : null, crew, !planned || reduced, shop.layout.counters.serve);
    planned = true;
  }

  function spriteFor(w: Walker, step: number) {
    if (w.role === "chef") return chefSprite(step);
    return guestSprite(w.name, w.face, step);
  }

  // Draw list, reused frame to frame.
  type Item = { depth: number; kind: 0 | 1; i: number; w?: Walker };
  const items: Item[] = [];
  const pool: Item[] = [];
  function item(depth: number, kind: 0 | 1, i: number, w?: Walker) {
    const it = pool.pop() ?? { depth: 0, kind: 0, i: 0 };
    it.depth = depth;
    it.kind = kind;
    it.i = i;
    it.w = w;
    items.push(it);
  }

  function inside(poly: number[], x: number, y: number) {
    let c = false;
    for (let i = 0, j = poly.length / 2 - 1; i < poly.length / 2; j = i++) {
      const xi = poly[i * 2],
        yi = poly[i * 2 + 1],
        xj = poly[j * 2],
        yj = poly[j * 2 + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  function draw(now: number) {
    if (!canvas || !layers) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const room = layers.room;
    if (canvas.width !== room.width || canvas.height !== room.height) {
      canvas.width = room.width;
      canvas.height = room.height;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.drawImage(layers.bg, 0, 0);
    if (fadeFrom) {
      const t = (now - fadeStart) / 1200;
      if (t >= 1) fadeFrom = null;
      else {
        ctx.globalAlpha = 1 - t;
        ctx.drawImage(fadeFrom, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
    const light = room.light;
    if (!people) people = new DynamicAtlas(512, 256);
    if (peopleLight !== light.key) {
      people.reset();
      peopleLight = light.key;
    }

    for (const it of items) pool.push(it);
    items.length = 0;
    room.sprites.forEach((s, i) => item(s.depth, 0, i));
    for (const w of cast.people.values()) item(w.x + w.y, 1, 0, w);
    items.sort((a, b) => a.depth - b.depth);

    const gg = groundGrid(venue, room.grid);
    const slab = gg.oy - room.grid.oy;
    const selected = shift?.selected ?? -1;
    for (const it of items) {
      if (it.kind === 0) {
        const s = room.sprites[it.i];
        const f = room.frames.get(s.key);
        if (f) blit(ctx, layers.atlas, f, s.x, s.y);
        continue;
      }
      const w = it.w!;
      const step = reduced ? 0 : cast.frame(w);
      const sprite = spriteFor(w, step);
      const key = w.role + "|" + w.name + "|" + w.face + "|" + step + "|" + (w.carrying ? 1 : 0);
      const share = venue.indoorSun ?? 0.4;
      const f = people.get(key, 24, 30, 12, 28, (p) =>
        paintPerson(p, light, { sprite, x: 0, y: 0, carry: w.carrying ? CARRY : undefined }, 12, 28, w.outside ? 1 : share),
      );
      // Ease the step down onto the ground outside rather than jumping.
      const out = Math.max(0, Math.min(1, Math.max(w.y - venue.rows, w.x - venue.cols, -w.x, -w.y) / 0.6));
      const at = project(room.grid, w.x, w.y);
      if (f) blit(ctx, people.canvas, f, at.x, at.y + slab * out, w.flip);
      if (w.slot >= 0 && w.slot === selected) {
        ctx.fillStyle = "#ffe3a5";
        const bob = reduced ? 0 : Math.round(Math.sin(now / 220));
        ctx.fillRect(Math.round(at.x) - 2, Math.round(at.y + slab * out) - 31 + bob, 5, 1);
        ctx.fillRect(Math.round(at.x) - 1, Math.round(at.y + slab * out) - 30 + bob, 3, 1);
        ctx.fillRect(Math.round(at.x), Math.round(at.y + slab * out) - 29 + bob, 1, 1);
      }
    }
    ctx.drawImage(layers.overhead, 0, 0);

    if (!reduced) {
      const t = now / 1000;
      // Steam over counters at work.
      ctx.fillStyle = "#f6e7cc";
      for (const s of ["brew", "prep"] as const) {
        const at = liveLayout()[s];
        if (!busy.has(s) || !at) continue;
        const [x, y] = at;
        const top = project(room.grid, x + 0.35, y + 0.35, (venue.counter.height ?? 15) + 10);
        for (let k = 0; k < 4; k++) {
          const life = (t * 0.9 + k / 4) % 1;
          ctx.globalAlpha = 0.55 * (1 - life);
          ctx.fillRect(Math.round(top.x + Math.sin(life * 6 + k) * 2), Math.round(top.y - life * 14), 2, 2);
        }
      }
      ctx.globalAlpha = 1;
      // Weather, outside only.
      const wx = light.weather;
      if (wx === "rain" || wx === "snow") {
        const n = wx === "rain" ? 70 : 55;
        ctx.fillStyle = wx === "rain" ? "#c9d3de" : "#f4f6f6";
        ctx.globalAlpha = wx === "rain" ? 0.55 : 0.85;
        for (let i = 0; i < n; i++) {
          const sx = (i * 97.31 + t * (wx === "rain" ? -18 : 6 + Math.sin(t + i) * 4)) % room.width;
          const sy = (i * 53.17 + t * (wx === "rain" ? 170 : 22)) % room.height;
          const x = sx < 0 ? sx + room.width : sx;
          if (inside(room.silhouette, x, sy)) continue;
          if (wx === "rain") ctx.fillRect(Math.round(x), Math.round(sy), 1, 4);
          else ctx.fillRect(Math.round(x), Math.round(sy), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  function onClick(event: MouseEvent) {
    if (!canvas || !layers || paused) return;
    const r = canvas.getBoundingClientRect();
    const x = ((event.clientX - r.left) / r.width) * layers.room.width;
    const y = ((event.clientY - r.top) / r.height) * layers.room.height;
    const slab = groundGrid(venue, layers.room.grid).oy - layers.room.grid.oy;
    for (const w of [...cast.people.values()].sort((a, b) => b.x + b.y - (a.x + a.y))) {
      if (w.role !== "guest" || w.slot < 0) continue;
      const out = Math.max(0, Math.min(1, Math.max(w.y - venue.rows, w.x - venue.cols, -w.x, -w.y) / 0.6));
      const at = project(layers.room.grid, w.x, w.y);
      at.y += slab * out;
      if (Math.abs(x - at.x) < 7 && y < at.y + 2 && y > at.y - 26) {
        chooseTicket(w.slot);
        return;
      }
    }
    const q = unproject(layers.room.grid, x, y + (venue.counter.height ?? 15) / 2);
    const layout = liveLayout();
    for (const s of STATIONS) {
      const at = layout[s];
      if (at && q.x >= at[0] - 0.1 && q.x <= at[0] + 1.1 && q.y >= at[1] - 0.1 && q.y <= at[1] + 1.1) {
        choose(s);
        return;
      }
    }
  }

  $effect(() => {
    // Re-plan when the station or the shift's people change.
    void station;
    void shift;
    if (layers) replan();
  });

  onMount(() => {
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) box = { w: width, h: height };
    });
    if (frame) ro.observe(frame);
    let visible = true;
    let raf = 0;
    let last = 0;
    let lastDraw = 0;
    let lastPlan = 0;
    const running = () => visible && !document.hidden;
    const tick = (now: number) => {
      raf = 0;
      if (!running()) return;
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const dirty = ensureLayers() || dirtyFromBake;
      dirtyFromBake = false;
      if (now - lastPlan > 120) {
        replan();
        lastPlan = now;
      }
      const moving = !paused && cast.step(dt, venue);
      // Under a pause card or the book nothing moves: a frame a second keeps the lamps honest.
      const idle = paused ? 1000 : reduced ? 500 : 83;
      if (moving || dirty || fadeFrom || now - lastDraw > idle) {
        draw(now);
        lastDraw = now;
      }
    };
    // Nothing is scheduled while the room is off screen or the tab is hidden.
    const wake = () => {
      if (running() && !raf) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });
    if (frame) io.observe(frame);
    document.addEventListener("visibilitychange", wake);
    wake();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", wake);
    };
  });
</script>

<div class="room" bind:this={frame} role="group" aria-label={shop.name + " room"}>
  <div class="art" style:--ratio={nativeW / nativeH}>
    <canvas bind:this={canvas} class="room-canvas" aria-hidden="true" onclick={onClick}></canvas>
    {#if arrange && frameGrid}
      {#each Array.from({ length: venue.rows }) as _, ty (ty)}
        {#each Array.from({ length: venue.cols }) as _, tx (tx)}
          {@const at = project(frameGrid, tx + 0.5, ty + 0.5)}
          <button
            type="button"
            class="tile"
            disabled={blocked.has(ty * venue.cols + tx)}
            aria-label={(() => {
              const here = STATIONS.find((st) => liveLayout()[st]?.[0] === tx && liveLayout()[st]?.[1] === ty);
              return here ? "Pick the " + NAMES[here] + " counter" : "Move the " + (moving || "counter") + " to " + (tx + 1) + ", " + (ty + 1);
            })()}
            style:left="{(at.x / frameGrid.width) * 100}%"
            style:top="{(at.y / frameGrid.height) * 100}%"
            style:width="{((frameGrid.hw * 2) / frameGrid.width) * 100}%"
            style:height="{((frameGrid.hh * 2) / frameGrid.height) * 100}%"
            onclick={() => {
              const here = STATIONS.find((st) => liveLayout()[st]?.[0] === tx && liveLayout()[st]?.[1] === ty);
              if (here) choose(here);
              else move(tx, ty);
            }}
          ></button>
        {/each}
      {/each}
    {/if}
    {#each signs as sign (sign.id)}
      <button
        type="button"
        class="counter"
        class:is-here={station === sign.id}
        aria-label={NAMES[sign.id] + " counter"}
        aria-pressed={station === sign.id}
        aria-keyshortcuts={String(STATIONS.indexOf(sign.id) + 1)}
        style:left="{sign.x}%"
        style:top="{sign.y}%"
        style:width="{sign.w}%"
        style:height="{sign.h}%"
        style:clip-path={sign.clip}
        style:z-index={1 + Math.round(sign.depth)}
        onclick={() => choose(sign.id)}
      ></button>
      <span class="sign" class:is-here={station === sign.id} aria-hidden="true" style:left="{sign.lx}%" style:top="{sign.ly}%">
        <OrderPixelWord text={NAMES[sign.id]} cells={1} />
        {#if busy.has(sign.id)}<i class="working"></i>{/if}
        <kbd>{STATIONS.indexOf(sign.id) + 1}</kbd>
      </span>
    {/each}
  </div>
</div>

<style>
  .room {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: #241d1f;
    container-type: size;
  }

  .art {
    position: relative;
    width: min(100cqw, calc(100cqh * var(--ratio)));
    aspect-ratio: var(--ratio);
    isolation: isolate;
  }

  .room-canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    cursor: pointer;
  }

  .tile {
    position: absolute;
    z-index: 40;
    padding: 0;
    border: 0;
    background: rgb(255 241 221 / 0.06);
    box-shadow: inset 0 0 0 1px rgb(255 241 221 / 0.22);
    clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
    transform: translate(-50%, -50%);
    cursor: pointer;
  }

  .tile:disabled {
    background: rgb(43 33 38 / 0.35);
    cursor: not-allowed;
  }

  @media (hover: hover) {
    .tile:not(:disabled):hover {
      background: rgb(240 196 130 / 0.45);
    }
  }

  .tile:focus-visible {
    background: rgb(240 196 130 / 0.6);
    outline: none;
  }

  .counter {
    position: absolute;
    z-index: 1;
    border: 0;
    padding: 0;
    background: none;
    cursor: pointer;
    touch-action: manipulation;
  }

  /* The button is clipped to the counter's shape, which would cut a ring off: focus lights its sign instead. */
  .counter:focus-visible {
    outline: none;
  }

  .counter:focus-visible + .sign {
    box-shadow:
      inset 0 0 0 2px #ffe0a8,
      inset 0 -3px #211a20;
  }

  .sign {
    position: absolute;
    z-index: 60;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 4px 4px;
    color: #ffe7b8;
    background: #3b2826;
    box-shadow:
      inset 0 2px #936652,
      inset 0 -2px #211a20;
    clip-path: var(--notch);
    transform: translate(-50%, -50%);
    pointer-events: none;
    transition: background-color 150ms steps(2, end);
  }

  .sign kbd {
    display: grid;
    place-items: center;
    min-width: 13px;
    height: 13px;
    padding: 0 2px;
    border: 0;
    background: #6c4a3f;
    color: #ffe7b8;
    font: 500 0.5625rem/1 var(--font-ui);
  }

  .sign.is-here {
    color: #372222;
    background: #f0c482;
    box-shadow:
      inset 0 2px #ffe3a5,
      inset 0 -2px #ad6b4d;
  }

  .sign.is-here kbd {
    background: #c98d5c;
    color: #372222;
  }

  .working {
    width: 5px;
    height: 5px;
    background: #f3a96f;
    box-shadow: 0 0 0 2px #5e3a2e;
  }

  /* Stacked on a phone, the room takes the width and its own height. */
  @media (max-width: 760px) {
    .room {
      height: auto;
      container-type: inline-size;
    }

    .art {
      width: 100%;
    }
  }

  @media (pointer: coarse) {
    .sign kbd {
      display: none;
    }
  }
</style>
