<script lang="ts">
  // The taste-off: three judges, three presentations; stop the needle in the
  // band each time to beat the rival shop's cup.
  import { tick } from "svelte";
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import type { Activity } from "#lib/arcade/order-up/engine/activities.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { PLACE_W, PLACE_H, placeLight, shiftProgress } from "#lib/arcade/order-up/art/places/kit.ts";
  import { drawTasteoffBackdrop, drawTasteoffLife } from "#lib/arcade/order-up/art/places/tasteoff.ts";
  import PixelScene from "../PixelScene.svelte";
  import "./view.css";

  export let campaign: Campaign;
  export let live: boolean;
  export let activity: Activity | null;
  export let paused: boolean;
  export let reduced: boolean;
  export let action: (name: string, data?: any) => void;
  /** The shift in progress, for the hour's light. */
  export let shift: Shift | null = null;

  $: running = activity?.kind === "tasteoff" && !activity.done;
  $: result = activity?.kind === "tasteoff" ? activity : null;
  $: played = campaign.expansion.tasteoffDay === campaign.day;
  $: round = campaign.expansion.tournamentRound + 1;
  $: hits = result?.hits ?? [];
  $: cursor = activity?.kind === "tasteoff" ? activity.cursor : 0.5;
  $: state = { hits, round: campaign.expansion.tournamentRound };
  $: cal = calendar(campaign.day);
  $: light = placeLight(cal.season.id, cal.weather, shiftProgress(shift), false);
  $: bakeKey = [light.key, hits.join(","), state.round].join("|");
  $: animate = running && !paused && !reduced;
  $: version = animate ? "live" : [bakeKey, cursor.toFixed(2), running].join("|");
  let presentKey: HTMLButtonElement;

  // The needle is read off the running round each frame.
  function nowCursor() {
    return activity?.kind === "tasteoff" ? activity.cursor : 0.5;
  }

  function enter() {
    action("activity", { kind: "tasteoff", round: campaign.expansion.tournamentRound });
    // Space presents from the key that entered.
    void tick().then(() => presentKey?.focus());
  }
  $: canEnter = !running && !live && !played && campaign.day >= 8;
  $: note = running
    ? "Stop the needle in the band."
    : live
      ? "The taste-off runs between shifts."
      : played
        ? `${result?.done ? `Your cups scored ${result.grade}. ` : ""}The next round is tomorrow.`
        : campaign.day < 8
          ? "The taste-off opens on day 8."
          : campaign.expansion.rivalWins
            ? `${campaign.expansion.rivalWins} won so far.`
            : "";
</script>

<div class="ou-view">
  <div class="ou-stage">
    <div class="ou-frame">
      <PixelScene
        width={PLACE_W}
        height={PLACE_H}
        bake={(p) => drawTasteoffBackdrop(p, light, state)}
        {bakeKey}
        draw={(p, t) => drawTasteoffLife(p, light, state, t, nowCursor(), running)}
        live={animate}
        {version}
        label="The taste-off tent"
      />
      {#if hits.length}<p class="ou-sr" role="status">The judges scored {hits.join(", ")}.</p>{/if}
    </div>
  </div>
  <div class="ou-keys">
    <span class="ou-chip ou-fixed round">Round {Math.min(4, round)} of 4</span>
    <button type="button" class="boba-key" disabled={!canEnter} onclick={enter}>Enter</button>
    <button bind:this={presentKey} type="button" class="boba-key is-primary primary-key" disabled={!running} aria-keyshortcuts="Space" onclick={() => action("activity-press")}
      >Present<kbd aria-hidden="true">Space</kbd></button
    >
    <p class="ou-note ou-fixed note">{note}</p>
  </div>
</div>

<style>
  .round {
    min-width: 6.5rem;
    text-align: center;
  }

  .note {
    width: 16rem;
  }
</style>
