<script lang="ts">
  // The shop front on, live: the order window from behind the pass, or the
  // shopfront from across the street. The venue is baked for the hour and
  // weather once per light step; the guests, the people walking past and the
  // rain are drawn over it at a dozen frames a second, and nothing is drawn
  // while it is off screen or the tab is hidden.
  import { onMount, type Snippet } from "svelte";
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift, Ticket } from "#lib/arcade/order-up/engine/shift-types.ts";
  import { SHOPS } from "#lib/arcade/order-up/content/index.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { lightAt, shiftHour, PLANNING_HOUR } from "#lib/arcade/core/light.ts";
  import { blit } from "#lib/arcade/core/atlas.ts";
  import { DynamicAtlas, bufferCanvas } from "#lib/arcade/core/dynamic-atlas.ts";
  import { venueFor } from "#lib/arcade/order-up/art/room/venues/index.ts";
  import { bakeWindow, bakeStreet, windowSpots, useCupSprites, PASS_Y, KERB_Y, WINDOW_HEIGHT, FRONT_HEIGHT, type BakedFront } from "#lib/arcade/order-up/art/room/front.ts";
  import { cupSprite } from "#lib/arcade/order-up/art/sprites.ts";

  useCupSprites(cupSprite);
  import { guestSprite } from "#lib/arcade/order-up/art/room/people.ts";
  import { figure } from "#lib/arcade/orders-guests.js";

  interface Props {
    kind: "window" | "street";
    campaign: Campaign;
    shift: Shift | null;
    weather: string;
    reduced?: boolean;
    paused?: boolean;
    /** Window: the guests waiting, in their slots. */
    guests?: { ticket: Ticket; slot: number }[];
    selected?: number;
    chooseTicket?: (slot: number) => void;
    /** Street: the drink in the shop window. */
    display?: string;
    children?: Snippet;
  }

  let { kind, campaign, shift, weather, reduced = false, paused = false, guests = [], selected = -1, chooseTicket = () => {}, display = "", children }: Props = $props();

  let frame = $state<HTMLDivElement>();
  let canvas = $state<HTMLCanvasElement>();
  let box = $state({ w: 900, h: 535 });

  const shop = $derived(SHOPS.find((s) => s.id === campaign.expansion.activeShop) ?? SHOPS[0]);
  const season = $derived(calendar(campaign.day).season.id);
  const nativeH = $derived(kind === "window" ? WINDOW_HEIGHT : FRONT_HEIGHT);
  const nativeW = $derived(Math.round(Math.min(nativeH * 2.4, Math.max(nativeH * 1.4, (nativeH * box.w) / Math.max(1, box.h)))));
  const spots = $derived(kind === "window" ? windowSpots(nativeW, Math.max(1, Math.min(5, guests.length))) : []);

  let baked: { key: string; front: BakedFront; bg: HTMLCanvasElement } | null = null;
  let people: DynamicAtlas | null = null;
  let peopleKey = "";

  function hour() {
    return shift ? shiftHour(shift.elapsed / Math.max(1, shift.duration)) : PLANNING_HOUR;
  }

  function ensure() {
    const h = hour();
    const light = lightAt({ hour: h, season, weather, indoor: true });
    const outdoor = lightAt({ hour: h, season, weather, indoor: false });
    const open = !!shift;
    const key = [kind, shop.id, light.key, outdoor.key, nativeW, open, display].join("|");
    if (baked?.key === key) return false;
    const venue = venueFor(shop.id, { cols: shop.layout.width, rows: shop.layout.height, hour: () => h });
    const front = kind === "window" ? bakeWindow(venue, light, outdoor, nativeW) : bakeStreet(venue, light, outdoor, nativeW, shop.name, open, display);
    baked = { key, front, bg: bufferCanvas(front.background, baked?.bg) };
    return true;
  }

  const EMOTE: Record<string, string[]> = {
    zzz: [".OOOOOOO.", "OwwwwwwwO", "OwEEEEwwO", "OwwwEwwwO", "OwwEwwwwO", "OwEEEEwwO", "OwwwwwwwO", ".OOOOOOO.", "...OO...."],
    question: [".OOOOOOO.", "OwwwwwwwO", "OwwEEEwwO", "OwEwwwEwO", "OwwwwEwwO", "OwwwEwwwO", "OwwwwwwwO", "OwwwEwwwO", ".OOOOOOO.", "...OO...."],
  };

  function face(t: Ticket) {
    const left = t.maxPatience ? t.patience / t.maxPatience : 1;
    return t.sleeping ? "blink" : left < 0.25 ? "cross" : left < 0.5 ? "glance" : "calm";
  }

  // People walking past the shopfront: a few, at their own pace, wrapping round.
  const walkers = Array.from({ length: 4 }, (_, i) => ({ name: ["ada", "bo", "theo", "mika", "jun", "kit"][i], speed: 7 + i * 3.1, offset: i * 97, dir: i % 2 ? -1 : 1 }));

  /** Seconds of animation: it stands still while the game is paused. */
  let clock = 0;

  function draw(now: number) {
    if (!canvas || !baked) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const f = baked.front;
    if (canvas.width !== f.width || canvas.height !== f.height) {
      canvas.width = f.width;
      canvas.height = f.height;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(baked.bg, 0, 0);
    if (!people) people = new DynamicAtlas(512, 128);
    const lk = f.outdoor.key;
    if (peopleKey !== lk) {
      people.reset();
      peopleKey = lk;
    }
    const t = clock;
    const litPal = (pal: Record<string, string>) => {
      const out: Record<string, string> = {};
      for (const [k, c] of Object.entries(pal)) out[k] = k === "O" ? c : f.outdoor.lit(c, Math.min(1, f.outdoor.sun * 0.5));
      return out;
    };
    if (kind === "window") {
      guests.slice(0, 5).forEach(({ ticket, slot }, i) => {
        const fc = face(ticket);
        const fr = people!.get("w|" + ticket.name + "|" + fc, 16, 18, 8, 17, (p) => {
          const fig = figure(ticket.name.toLowerCase(), fc as Parameters<typeof figure>[1]);
          p.sprite(fig.grid.slice(0, 17), litPal(fig.palette), 1, 0);
        });
        const x = spots[i];
        const bob = reduced ? 0 : Math.round(Math.sin(t * 1.6 + i * 1.7) * 0.6);
        if (fr) blit(ctx, people!.canvas, fr, x, PASS_Y + 1 + bob);
        const emote = ticket.sleeping ? "zzz" : ticket.usual && !ticket.revealed ? "question" : "";
        if (emote) {
          const ef = people!.get("e|" + emote, 10, 11, 0, 10, (p) => p.sprite(EMOTE[emote], { O: "#2b2320", w: "#fdf8f3", E: "#4a322d" }, 0, 0));
          if (ef) blit(ctx, people!.canvas, ef, x + 6, PASS_Y - 16);
        }
        if (slot === selected) {
          ctx.fillStyle = "#ffe3a5";
          const b = reduced ? 0 : Math.round(Math.sin(now / 220));
          ctx.fillRect(x - 2, PASS_Y - 21 + b, 5, 1);
          ctx.fillRect(x - 1, PASS_Y - 20 + b, 3, 1);
          ctx.fillRect(x, PASS_Y - 19 + b, 1, 1);
        }
      });
    } else {
      // Passers-by on the pavement.
      walkers.forEach((w, i) => {
        const span = f.width + 40;
        const raw = (w.offset + (reduced ? 0 : t * w.speed) * w.dir) % span;
        const x = (raw + span) % span - 20;
        const step = reduced ? 0 : 1 + (Math.floor(t * 6 + i) % 2);
        const fr = people!.get("s|" + w.name + "|" + step, 16, 26, 8, 25, (p) => {
          const g = guestSprite(w.name, "calm", step);
          p.sprite(g.grid, litPal(g.palette), 1, 25 - g.grid.length + 1);
        });
        if (fr) blit(ctx, people!.canvas, fr, x, KERB_Y + 8 + (i % 2) * 3, w.dir < 0);
      });
      // The line at the door.
      const queue = (shift?.tickets ?? []).filter((x): x is Ticket => !!x && !!x.guest).slice(0, 4);
      queue.forEach((ticket, i) => {
        const fr = people!.get("q|" + ticket.name, 16, 26, 8, 25, (p) => {
          const g = guestSprite(ticket.name, face(ticket), 0);
          p.sprite(g.grid, litPal(g.palette), 1, 25 - g.grid.length + 1);
        });
        if (fr && f.door) blit(ctx, people!.canvas, fr, f.door.x + 10 + i * 13, KERB_Y + 3, true);
      });
    }
    // Rain or snow.
    const wx = f.outdoor.weather;
    if (!reduced && (wx === "rain" || wx === "snow")) {
      const n = wx === "rain" ? 50 : 40;
      ctx.fillStyle = wx === "rain" ? "#c9d3de" : "#f4f6f6";
      ctx.globalAlpha = wx === "rain" ? 0.5 : 0.85;
      const top = kind === "window" ? 8 : 0;
      const bottom = kind === "window" ? PASS_Y : f.height;
      for (let i = 0; i < n; i++) {
        const x = (((i * 97.31 + t * (wx === "rain" ? -14 : 5)) % f.width) + f.width) % f.width;
        const y = top + ((i * 53.17 + t * (wx === "rain" ? 120 : 16)) % (bottom - top));
        if (kind === "window" && (x < 10 || x > f.width - 10)) continue;
        ctx.fillRect(Math.round(x), Math.round(y), 1, wx === "rain" ? 3 : 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  onMount(() => {
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0 && e.contentRect.height > 0) box = { w: e.contentRect.width, h: e.contentRect.height };
    });
    if (frame) ro.observe(frame);
    let visible = true;
    let raf = 0;
    let last = 0;
    let previous = 0;
    const running = () => visible && !document.hidden;
    const tick = (now: number) => {
      raf = 0;
      if (!running()) return;
      raf = requestAnimationFrame(tick);
      if (previous && !paused && !reduced) clock += Math.min(0.1, (now - previous) / 1000);
      previous = now;
      const dirty = ensure();
      if (dirty || now - last > (paused ? 1000 : reduced ? 500 : 83)) {
        draw(now);
        last = now;
      }
    };
    // Nothing is scheduled while the scene is off screen or the tab is hidden.
    const wake = () => {
      if (running() && !raf) {
        previous = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
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

<div class="front" bind:this={frame}>
  <div class="art" style:--ratio={nativeW / nativeH}>
    <canvas bind:this={canvas} class="front-canvas" aria-hidden="true"></canvas>
    {#if kind === "window"}
      {#each guests.slice(0, 5) as g, i (g.ticket.id)}
        <button
          type="button"
          class="guest"
          aria-pressed={g.slot === selected}
          aria-label={g.ticket.name}
          style:left="{((spots[i] ?? 0) / nativeW) * 100}%"
          style:top="{((PASS_Y - 16) / nativeH) * 100}%"
          style:width="{(16 / nativeW) * 100}%"
          style:height="{(17 / nativeH) * 100}%"
          onclick={() => chooseTicket(g.slot)}
        ></button>
      {/each}
    {/if}
    {@render children?.()}
  </div>
</div>

<style>
  .front {
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
  }

  .front-canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  /* Stacked on a phone, the scene takes the width and its own height. */
  @media (max-width: 760px) {
    .front {
      height: auto;
      container-type: inline-size;
    }

    .art {
      width: 100%;
    }
  }

  .guest {
    position: absolute;
    transform: translateX(-50%);
    border: 0;
    padding: 0;
    background: none;
    cursor: pointer;
  }

  .guest:focus-visible {
    outline: 2px dashed #ffe0a8;
  }
</style>
