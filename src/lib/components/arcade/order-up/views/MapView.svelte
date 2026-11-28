<script lang="ts">
  // The city map: every shop's building, which are yours, and the van routes
  // from the commissary. Pick a building to work there or buy it; load the
  // van from the row below.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import { SHOPS, INGREDIENTS } from "#lib/arcade/order-up/content/index.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { TUNING } from "#lib/arcade/order-up/engine/tuning.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { PLACE_W, PLACE_H, placeLight, shiftProgress } from "#lib/arcade/order-up/art/places/kit.ts";
  import { drawMap, MAP_SPOTS } from "#lib/arcade/order-up/art/places/map.ts";
  import PixelScene from "../PixelScene.svelte";
  import Picker from "./Picker.svelte";
  import "./view.css";

  export let campaign: Campaign;
  export let shift: Shift | null;
  export let action: (name: string, data?: any) => void;
  export let openBook: (tab: string) => void;

  let chosen = "";
  $: picked = chosen || campaign.expansion.activeShop;
  let routeTo = "corner";
  let routeIngredient = "black";
  $: place = SHOPS.find((s) => s.id === picked)!;
  $: owned = !!campaign.expansion.shops[picked];
  $: here = campaign.expansion.activeShop;
  $: ownedIds = SHOPS.filter((s) => campaign.expansion.shops[s.id]).map((s) => s.id);
  $: openIds = SHOPS.filter((s) => s.day <= campaign.day).map((s) => s.id);
  $: routes = campaign.expansion.routes.filter((r) => r.progress < 1).map((r) => ({ to: r.to, progress: r.progress }));
  $: hasVan = !!campaign.expansion.shops.commissary;
  $: stops = SHOPS.filter((s) => campaign.expansion.shops[s.id] && s.id !== "commissary").map((s) => ({ id: s.id, name: s.name, swatch: s.palette[0] }));
  $: loads = INGREDIENTS.filter((i) => i.day <= campaign.day).map((i) => ({ id: i.id, name: i.name, icon: i.id }));

  $: cal = calendar(campaign.day);
  $: light = placeLight(cal.season.id, cal.weather, shiftProgress(shift), false);
  $: key = [light.key, picked, here, ownedIds.join(","), openIds.join(","), routes.map((r) => r.to + Math.round(r.progress * 20)).join(",")].join("|");

  function stateOf(id: string, day: number) {
    const shop = SHOPS.find((s) => s.id === id)!;
    return campaign.expansion.shops[id] ? (id === here ? "you're here" : "yours") : shop.day > day ? `opens day ${shop.day}` : `for sale, ${money(Math.round(shop.price * TUNING[campaign.mode].purchase))}`;
  }
  const at = (x: number, y: number) => `left:${(x / PLACE_W) * 100}%;top:${(y / PLACE_H) * 100}%`;
</script>

<div class="ou-view">
  <div class="ou-stage">
    <div class="ou-frame">
      <PixelScene
        width={PLACE_W}
        height={PLACE_H}
        draw={() => {}}
        bake={(p) =>
          drawMap(p, light, {
            shops: SHOPS.map((s) => ({ id: s.id, palette: s.palette })),
            owned: ownedIds,
            open: openIds,
            picked,
            here,
            routes,
          })}
        bakeKey={key}
        version={key}
        label="The city map"
      />
      {#each SHOPS as s (s.id)}
        {@const spot = MAP_SPOTS[s.id]}
        {#if spot}
          <button
            type="button"
            class="ou-hot lot"
            class:is-picked={picked === s.id}
            style={at(spot.x, spot.y)}
            aria-pressed={picked === s.id}
            aria-label={`${s.name}, ${stateOf(s.id, campaign.day)}`}
            title={s.name}
            onclick={() => (chosen = s.id)}
          ></button>
        {/if}
      {/each}
      <div class="card">
        <span class="ou-caption ou-fixed name">{place.name}</span>
        {#if owned}
          <button type="button" class="boba-key ou-fixed act" disabled={!!shift || here === picked} onclick={() => action("select-shop", { id: picked })}
            >{here === picked ? "You're here" : "Work here"}</button
          >
        {:else}
          <button type="button" class="boba-key ou-fixed act" disabled={!!shift || place.day > campaign.day} onclick={() => action("buy-shop", { id: picked })}
            >{place.day > campaign.day ? `Opens day ${place.day}` : `Buy for ${money(Math.round(place.price * TUNING[campaign.mode].purchase))}`}</button
          >
        {/if}
        <button type="button" class="boba-key" onclick={() => openBook("map")}>Shops</button>
      </div>
    </div>
  </div>
  <div class="ou-keys">
    <span class="ou-note">Van</span>
    <Picker items={hasVan ? stops : []} bind:value={routeTo} label="Van stop" keys={0} width="9rem" empty="No commissary" disabled={!hasVan} />
    <Picker items={hasVan ? loads : []} bind:value={routeIngredient} label="Load" keys={0} width="9rem" empty="Buy it first" disabled={!hasVan} />
    <button type="button" class="boba-key" disabled={!hasVan} onclick={() => action("route", { to: routeTo, ingredient: routeIngredient })}>Load 8</button>
  </div>
</div>

<style>
  /* Each shop's lot, centred on its door. */
  .lot {
    width: calc(var(--px) * 34);
    height: calc(var(--px) * 30);
    transform: translate(-50%, -85%);
  }

  .card {
    position: absolute;
    top: 6px;
    left: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .card .name {
    display: inline-flex;
    align-items: center;
    width: 10.5rem;
    height: 44px;
    margin: 0;
    font-size: 0.8125rem;
  }

  .card .act {
    width: 9rem;
    min-height: 44px;
  }

  .card .boba-key {
    min-height: 44px;
  }

  /* On a narrow frame the card keeps to the keys. */
  @container (max-width: 560px) {
    .card .name {
      display: none;
    }

    .card .act {
      width: 7.5rem;
      font-size: 0.75rem;
    }
  }
</style>
