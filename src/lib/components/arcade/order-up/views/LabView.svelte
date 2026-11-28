<script lang="ts">
  // The tasting bench: put two to four ingredients in the jars and let three
  // regulars taste. A pairing all three love becomes the house blend.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import { INGREDIENTS, INGREDIENT_BY_ID } from "#lib/arcade/order-up/content/index.ts";
  import { stock } from "#lib/arcade/order-up/engine/pantry.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { PLACE_W, PLACE_H, placeLight, shiftProgress } from "#lib/arcade/order-up/art/places/kit.ts";
  import { drawLab, LAB_JARS, LAB_TASTERS } from "#lib/arcade/order-up/art/places/lab.ts";
  import PixelScene from "../PixelScene.svelte";
  import Ingredient from "../Ingredient.svelte";
  import Picker from "./Picker.svelte";
  import "./view.css";

  export let campaign: Campaign;
  export let live: boolean;
  export let taste: number[] | null;
  export let action: (name: string, data?: any) => void;
  /** The shift in progress, for the hour's light. */
  export let shift: Shift | null = null;

  let jars: string[] = [];
  $: choices = INGREDIENTS.filter((i) => i.day <= campaign.day && i.group !== "side" && stock(campaign, i.id) > 0).map((i) => ({ id: i.id, name: i.name, icon: i.id }));
  let choice = "black";
  $: if (!choices.some((i) => i.id === choice)) choice = choices[0]?.id ?? "";
  $: colors = LAB_JARS.map((_, i) => (jars[i] ? (INGREDIENT_BY_ID[jars[i]]?.cupColor ?? null) : null));
  $: pairings = campaign.expansion.pairings.length;
  $: cal = calendar(campaign.day);
  $: light = placeLight(cal.season.id, cal.weather, shiftProgress(shift), true);
  $: key = [light.key, colors.join(","), taste?.join(",") ?? "", pairings].join("|");
  $: note = live ? "The panel tastes between shifts." : pairings ? `${pairings} ${pairings === 1 ? "pairing" : "pairings"} found` : "No pairings found yet";

  const box = (x: number, y: number, w: number, h: number) =>
    `left:${(x / PLACE_W) * 100}%;top:${(y / PLACE_H) * 100}%;width:${(w / PLACE_W) * 100}%;height:${(h / PLACE_H) * 100}%`;
  const at = (x: number, y: number) => `left:${(x / PLACE_W) * 100}%;top:${(y / PLACE_H) * 100}%`;
</script>

<div class="ou-view">
  <div class="ou-stage">
    <div class="ou-frame">
      <PixelScene
        width={PLACE_W}
        height={PLACE_H}
        draw={() => {}}
        bake={(p) => drawLab(p, light, { jars: colors, taste, pairings })}
        bakeKey={key}
        version={key}
        label="Three tasters at the tasting bench"
      />
      {#if taste}
        {#each LAB_TASTERS as taster, i (taster.name)}
          <span class="ou-spot grade" style={at(taster.x, taster.top - 10)}>
            <span class="ou-caption">{taste[i]}</span>
          </span>
        {/each}
        <p class="ou-sr" role="status">The tasters gave {taste.join(", ")}.</p>
      {/if}
      {#each LAB_JARS as slot, i (i)}
        <button
          type="button"
          class="ou-hot jar"
          style={box(slot.x - 2, slot.y - 4, slot.w + 4, slot.h + 6)}
          disabled={!jars[i]}
          aria-label={jars[i] ? `Take out the ${INGREDIENT_BY_ID[jars[i]].name}` : "Empty jar"}
          onclick={() => (jars = jars.filter((_, n) => n !== i))}
          >{#if jars[i]}<span class="ou-icon" style="--size: 12"><Ingredient id={jars[i]} size={16} /></span>{/if}</button
        >
      {/each}
    </div>
  </div>
  <div class="ou-keys">
    <Picker items={choices} bind:value={choice} label="Ingredient" keys={0} width="10rem" disabled={live} />
    <button type="button" class="boba-key" disabled={live || jars.length >= 4 || jars.includes(choice) || !choice} onclick={() => (jars = [...jars, choice])}
      >Add</button
    >
    <button type="button" class="boba-key is-primary" disabled={live || jars.length < 2} onclick={() => action("blend", { ingredients: jars })}>Taste</button>
    <p class="ou-note ou-fixed note">{note}</p>
  </div>
</div>

<style>
  .jar {
    place-items: center;
    padding-top: calc(var(--px) * 10);
  }

  .grade {
    transform: translate(-50%, -100%);
  }

  .grade .ou-caption {
    min-width: 2.25rem;
    justify-content: center;
    font-variant-numeric: tabular-nums;
  }

  .note {
    width: 14rem;
  }
</style>
