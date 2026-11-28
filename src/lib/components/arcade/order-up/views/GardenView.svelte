<script lang="ts">
  // The Garden Tea Room's beds: plant a seed, water it each day, pick it ripe.
  // Each bed's key sits on its front board; the seed to plant is chosen below.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import { INGREDIENTS, INGREDIENT_BY_ID } from "#lib/arcade/order-up/content/index.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { PLACE_W, PLACE_H, placeLight, shiftProgress } from "#lib/arcade/order-up/art/places/kit.ts";
  import { drawGardenBackdrop, drawGardenLife, GARDEN_BEDS, type GardenPlot } from "#lib/arcade/order-up/art/places/garden.ts";
  import PixelScene from "../PixelScene.svelte";
  import Picker from "./Picker.svelte";
  import "./view.css";

  export let campaign: Campaign;
  export let live: boolean;
  export let paused: boolean;
  export let reduced: boolean;
  export let action: (name: string, data?: any) => void;
  /** The shift in progress, for the hour's light. */
  export let shift: Shift | null = null;

  $: seeds = INGREDIENTS.filter((i) => i.day <= campaign.day && (i.group === "fruit" || i.group === "tea")).map((i) => ({ id: i.id, name: i.name, icon: i.id }));
  let seed = "strawberry";
  $: owned = !!campaign.expansion.shops.garden;
  $: cal = calendar(campaign.day);
  $: light = placeLight(cal.season.id, cal.weather, shiftProgress(shift), false);
  // Only animate when something can move: plants in the beds, insects outside winter, rain or snow.
  $: moving =
    campaign.expansion.garden.some((plot) => !!plot.ingredient) || cal.season.id !== "winter" || light.weather === "rain" || light.weather === "snow";
  $: plots = campaign.expansion.garden.map(
    (plot): GardenPlot => ({
      color: plot.ingredient ? (INGREDIENT_BY_ID[plot.ingredient]?.cupColor ?? null) : null,
      growth: plot.growth,
      watered: plot.watered === campaign.day,
      group: plot.ingredient ? INGREDIENT_BY_ID[plot.ingredient]?.group : undefined,
    }),
  );
  $: key = light.key + "|" + plots.map((p) => `${p.color}${Math.floor(p.growth)}${p.watered ? "w" : ""}${p.group ?? ""}`).join(",");
  $: note = !owned ? "The beds come with the Garden Tea Room." : live ? "Tend the beds between shifts." : `${money(60)} a packet`;

  function verb(plot: (typeof campaign.expansion.garden)[number]) {
    return !plot.ingredient ? "Plant" : plot.growth >= 3 ? "Pick" : plot.watered === campaign.day ? "Watered" : "Water";
  }
  const at = (x: number, y: number) => `left:${(x / PLACE_W) * 100}%;top:${(y / PLACE_H) * 100}%`;
</script>

<div class="ou-view">
  <div class="ou-stage">
    <div class="ou-frame">
      <PixelScene
        width={PLACE_W}
        height={PLACE_H}
        bake={(p) => drawGardenBackdrop(p, light, plots)}
        bakeKey={key}
        draw={(p, t) => drawGardenLife(p, light, plots, t)}
        live={!paused && !reduced && moving}
        fps={12}
        version={key}
        label="Four garden beds"
      />
      {#each campaign.expansion.garden as plot, i (i)}
        {@const bed = GARDEN_BEDS[i]}
        {@const name = plot.ingredient ? INGREDIENT_BY_ID[plot.ingredient]?.name : null}
        <span class="ou-spot bed" style={at(bed.x + bed.w / 2, bed.y + bed.h / 2 + 1)}>
          <button
            type="button"
            class="boba-key"
            disabled={live || !owned || (!!plot.ingredient && plot.growth < 3 && plot.watered === campaign.day)}
            aria-label={name ? `${verb(plot)}: ${name}, ${plot.growth >= 3 ? "ripe" : "growing"}` : "Plant: empty bed"}
            onclick={() =>
              plot.ingredient
                ? action(plot.growth >= 3 ? "harvest" : "water", { plot: i })
                : action("plant", { plot: i, id: seed })}>{verb(plot)}</button
          >
        </span>
      {/each}
    </div>
  </div>
  <div class="ou-keys">
    <Picker items={seeds} bind:value={seed} label="Seed" keys={0} width="10rem" disabled={live || !owned} />
    <p class="ou-note ou-fixed note">{note}</p>
  </div>
</div>

<style>
  .bed .boba-key {
    width: calc(var(--px) * 56);
  }

  .note {
    width: 17rem;
  }
</style>
