<script lang="ts">
  // The office desk: the shop book, the season's calendar and the cash box.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { rentOnDueDay, wage } from "#lib/arcade/order-up/engine/management.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { PLACE_W, PLACE_H, placeLight, shiftProgress } from "#lib/arcade/order-up/art/places/kit.ts";
  import { drawOffice, OFFICE_SPOTS } from "#lib/arcade/order-up/art/places/office.ts";
  import PixelScene from "../PixelScene.svelte";
  import "./view.css";

  export let campaign: Campaign;
  export let openBook: (tab: string) => void;
  /** The shift in progress, for the hour's light. */
  export let shift: Shift | null = null;

  $: rentDay = Math.ceil(campaign.day / 7) * 7;
  $: payroll = campaign.expansion.staff.filter((s) => s.rota[(campaign.day - 1) % 7]).reduce((n, p) => n + wage(p), 0);
  $: cal = calendar(campaign.day);
  $: light = placeLight(cal.season.id, cal.weather, shiftProgress(shift), true);
  $: key = light.key + "|" + cal.seasonDay;
  const spot = (box: { x: number; y: number; w: number; h: number }) =>
    `left:${(box.x / PLACE_W) * 100}%;top:${(box.y / PLACE_H) * 100}%;width:${(box.w / PLACE_W) * 100}%;height:${(box.h / PLACE_H) * 100}%`;
</script>

<div class="ou-view">
  <div class="ou-stage">
    <div class="ou-frame">
      <PixelScene width={PLACE_W} height={PLACE_H} draw={() => {}} bake={(p) => drawOffice(p, light, { day: cal.seasonDay })} bakeKey={key} version={key} label="The office desk" />
      <button type="button" class="ou-hot" style={spot(OFFICE_SPOTS.book)} onclick={() => openBook("today")} aria-label="Open the ledger"
        ><span class="ou-caption">Ledger</span></button
      >
      <button type="button" class="ou-hot" style={spot(OFFICE_SPOTS.calendar)} onclick={() => openBook("today")} aria-label="Open the calendar"
        ><span class="ou-caption">Calendar</span></button
      >
      <button type="button" class="ou-hot" style={spot(OFFICE_SPOTS.till)} onclick={() => openBook("pantry")} aria-label="Open the pantry"
        ><span class="ou-caption">Pantry</span></button
      >
    </div>
  </div>
  <div class="ou-keys">
    <span class="ou-chip ou-fixed till">Till {money(campaign.cash)}</span>
    <span class="ou-chip ou-fixed rent">Rent {money(rentOnDueDay(campaign))} on day {rentDay}</span>
    <span class="ou-chip ou-fixed wages">{payroll ? `Wages ${money(payroll)} today` : "No wages today"}</span>
  </div>
</div>

<style>
  .till {
    min-width: 8rem;
  }

  .rent {
    min-width: 11rem;
  }

  .wages {
    min-width: 9.5rem;
  }
</style>
