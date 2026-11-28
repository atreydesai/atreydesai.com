<script lang="ts">
  // Closing chores: pick a machine (or the till, or the floor) and scrub it,
  // pressing as the needle crosses the band.
  import { tick } from "svelte";
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import type { Activity } from "#lib/arcade/order-up/engine/activities.ts";
  import { installed } from "#lib/arcade/order-up/engine/management.ts";
  import { machineDefinition } from "#lib/arcade/order-up/engine/equipment.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { PLACE_W, PLACE_H, placeLight, shiftProgress } from "#lib/arcade/order-up/art/places/kit.ts";
  import { drawChoresBackdrop, drawChoresLife, type ChoreTarget } from "#lib/arcade/order-up/art/places/chores.ts";
  import PixelScene from "../PixelScene.svelte";
  import Picker from "./Picker.svelte";
  import "./view.css";

  export let campaign: Campaign;
  export let activity: Activity | null;
  export let paused: boolean;
  export let reduced: boolean;
  export let action: (name: string, data?: any) => void;
  /** The shift in progress, for the hour's light. */
  export let shift: Shift | null = null;

  $: machines = installed(campaign);
  let target = "till";
  // A job in progress shows its own target.
  $: if (activity?.kind === "chore" && activity.target && activity.target !== target) target = activity.target;
  $: chores = [
    { id: "till", name: "Count the till" },
    { id: "mop", name: "Mop the floor" },
    ...machines.map(([id, m]) => ({ id, name: machineDefinition(id)?.name ?? id, note: Math.round(m.condition) + "% clean" })),
  ];
  $: working = activity?.kind === "chore" && !activity.done;
  $: done = activity?.kind === "chore" && activity.done ? activity : null;
  $: chosen = campaign.expansion.machines[target];
  $: art = ((): ChoreTarget => {
    if (target === "mop") return { kind: "mop" };
    if (!chosen) return { kind: "till" };
    const def = machineDefinition(target);
    return { kind: "machine", station: def?.station ?? "brew", tier: chosen.tier, tint: def?.art.color ?? "#bd895c" };
  })();
  $: dirt = working ? 1 - activity!.progress : done ? 0 : chosen ? 1 - chosen.condition / 100 : 0.5;
  $: cursor = activity?.kind === "chore" ? activity.cursor : 0.5;
  $: cal = calendar(campaign.day);
  $: light = placeLight(cal.season.id, cal.weather, shiftProgress(shift), true);
  $: bakeKey = [light.key, art.kind, art.station, art.tier, art.tint].join("|");
  $: live = working && !paused && !reduced;
  $: version = live ? "live" : [bakeKey, dirt.toFixed(2), cursor.toFixed(2), working].join("|");
  let scrubKey: HTMLButtonElement;

  // The needle and the grime are read off the running job each frame, so
  // what is drawn is what a press is scored against.
  function nowCursor() {
    return activity?.kind === "chore" ? activity.cursor : 0.5;
  }
  function nowDirt() {
    return activity?.kind === "chore" && !activity.done ? 1 - activity.progress : dirt;
  }

  function start() {
    action("activity", { kind: "chore", target });
    // Space scrubs from the key that started it.
    void tick().then(() => scrubKey?.focus());
  }
</script>

<div class="ou-view">
  <div class="ou-stage">
    <div class="ou-frame">
      <PixelScene
        width={PLACE_W}
        height={PLACE_H}
        bake={(p) => drawChoresBackdrop(p, light, art)}
        {bakeKey}
        draw={(p, t) => drawChoresLife(p, light, art, nowDirt(), t, nowCursor(), working)}
        {live}
        {version}
        label="Cleaning up after closing"
      />
      {#if done}<p class="result ou-caption" role="status">Graded {done.grade}.</p>{/if}
    </div>
  </div>
  <div class="ou-keys">
    <Picker items={chores} bind:value={target} label="Chore" keys={0} width="15rem" disabled={working} />
    <button type="button" class="boba-key" disabled={working} onclick={start}>Start</button>
    <button bind:this={scrubKey} type="button" class="boba-key is-primary primary-key" disabled={!working} aria-keyshortcuts="Space" onclick={() => action("activity-press")}
      >Scrub<kbd aria-hidden="true">Space</kbd></button
    >
  </div>
</div>

<style>
  .result {
    position: absolute;
    top: 6%;
    left: 50%;
    margin: 0;
    padding: 4px 10px;
    font-size: 0.8125rem;
    transform: translateX(-50%);
  }
</style>
