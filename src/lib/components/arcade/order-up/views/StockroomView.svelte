<script lang="ts">
  // The stockroom rack: an open crate for each ingredient in stock, its
  // label giving the count, pink with a red tag when the oldest of it spoils
  // by tomorrow. Stock is ordered at the clipboard; pearls cook in the pot.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import { INGREDIENTS } from "#lib/arcade/order-up/content/index.ts";
  import { stock, pantryLots, pantryCount, pantryCapacity } from "#lib/arcade/order-up/engine/pantry.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { PLACE_W, PLACE_H, placeLight, shiftProgress } from "#lib/arcade/order-up/art/places/kit.ts";
  import { drawStockroom, STOCK_SLOTS, STOCK_LABEL, STOCK_SPOTS, type StockCrate } from "#lib/arcade/order-up/art/places/stockroom.ts";
  import PixelScene from "../PixelScene.svelte";
  import Ingredient from "../Ingredient.svelte";
  import "./view.css";

  export let campaign: Campaign;
  export let action: (name: string, data?: any) => void;
  export let openBook: (tab: string) => void;
  /** The shift in progress, for the hour's light. */
  export let shift: Shift | null = null;

  let page = 0;
  $: stocked = INGREDIENTS.filter((i) => i.day <= campaign.day && stock(campaign, i.id) > 0);
  $: pages = Math.max(1, Math.ceil(stocked.length / STOCK_SLOTS.length));
  $: if (page > pages - 1) page = pages - 1;
  $: shown = stocked.slice(page * STOCK_SLOTS.length, (page + 1) * STOCK_SLOTS.length);
  $: lots = pantryLots(campaign);
  const oldest = (id: string) => lots.filter((l) => l.ingredient === id).sort((a, b) => a.expiresOn - b.expiresOn)[0]?.expiresOn;
  $: soonBy = campaign.day + 1;
  $: crates = STOCK_SLOTS.map((_, i): StockCrate | null => {
    const item = shown[i];
    if (!item) return null;
    const spoils = oldest(item.id);
    return { color: item.cupColor, group: item.group, soon: spoils !== undefined && spoils <= soonBy };
  });

  $: cal = calendar(campaign.day);
  $: light = placeLight(cal.season.id, cal.weather, shiftProgress(shift), true);
  $: key = light.key + "|" + crates.map((c) => (c ? c.color + c.group + (c.soon ? "!" : "") : "-")).join(",");

  const box = (x: number, y: number, w: number, h: number) =>
    `left:${(x / PLACE_W) * 100}%;top:${(y / PLACE_H) * 100}%;width:${(w / PLACE_W) * 100}%;height:${(h / PLACE_H) * 100}%`;
  const at = (x: number, y: number) => `left:${(x / PLACE_W) * 100}%;top:${(y / PLACE_H) * 100}%`;
</script>

<div class="ou-view">
  <div class="ou-stage">
    <div class="ou-frame">
      <PixelScene width={PLACE_W} height={PLACE_H} draw={() => {}} bake={(p) => drawStockroom(p, light, crates)} bakeKey={key} version={key} label="Stockroom rack" />
      <ul class="crates" aria-label="On the shelves">
        {#each shown as item, i (item.id)}
          {@const slot = STOCK_SLOTS[i]}
          {@const spoils = oldest(item.id)}
          <li
            class="ou-box crate"
            style={box(slot.x + STOCK_LABEL.dx, slot.y + STOCK_LABEL.dy, STOCK_LABEL.w, STOCK_LABEL.h - 2)}
            title={`${item.name}: ${stock(campaign, item.id)}${spoils ? ", use by day " + spoils : ""}`}
          >
            <span class="ou-icon" style="--size: 11"><Ingredient id={item.id} size={16} /></span>
            <span class="count">{stock(campaign, item.id)}</span>
            <span class="ou-sr">{item.name}{spoils ? `, use by day ${spoils}` : ""}</span>
          </li>
        {/each}
      </ul>
      <span class="ou-spot" style={at(STOCK_SPOTS.order.x, STOCK_SPOTS.order.y)}>
        <button type="button" class="boba-key" onclick={() => openBook("pantry")}>Order stock</button>
      </span>
      <span class="ou-spot" style={at(STOCK_SPOTS.batch.x, STOCK_SPOTS.batch.y)}>
        <button type="button" class="boba-key" onclick={() => action("batch")}>Cook pearls</button>
      </span>
    </div>
  </div>
  <div class="ou-keys">
    <button type="button" class="boba-key" disabled={page === 0} onclick={() => (page = Math.max(0, page - 1))} aria-label="Previous shelves">‹</button>
    <span class="ou-chip ou-fixed shelves">Shelves {page + 1} of {pages}</span>
    <button type="button" class="boba-key" disabled={page >= pages - 1} onclick={() => (page = Math.min(pages - 1, page + 1))} aria-label="Next shelves">›</button>
    <span class="ou-chip ou-fixed held">{pantryCount(campaign)} of {pantryCapacity(campaign)} in stock</span>
  </div>
</div>

<style>
  .crates {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .crate {
    display: flex;
    align-items: center;
    gap: calc(var(--px) * 2);
    padding-left: calc(var(--px) * 1);
    color: #3a2a28;
    font-size: max(0.6875rem, calc(var(--px) * 8));
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .ou-keys .boba-key {
    min-width: 44px;
    font-size: 1.375rem;
    font-weight: 600;
    line-height: 1;
  }

  .shelves {
    min-width: 7.5rem;
    text-align: center;
  }

  .held {
    min-width: 9rem;
    text-align: center;
  }
</style>
