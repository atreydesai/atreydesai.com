<script lang="ts">
  // The shop from across the street: its front, the drink in its window, the
  // line at the door and the people walking past.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import { FAMILIES, RECIPES } from "#lib/arcade/order-up/content/index.ts";
  import FrontScene from "../FrontScene.svelte";
  import Cup from "../Cup.svelte";
  import "./view.css";

  export let campaign: Campaign;
  export let shift: Shift | null;
  export let weather: string;
  export let reduced = false;
  export let paused = false;
  export let action: (name: string, data?: any) => void;

  $: families = FAMILIES.filter((f) => f.day <= campaign.day);
  $: index = Math.max(0, families.findIndex((f) => f.id === campaign.expansion.windowDisplay));
  $: family = families[index] ?? families[0];
  $: display = RECIPES.find((r) => r.family === family?.id && r.day <= campaign.day) ?? RECIPES[0];

  function step(by: number) {
    if (shift || !families.length) return;
    const next = families[(index + by + families.length) % families.length];
    action("display", { id: next.id });
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") (event.preventDefault(), step(-1));
    if (event.key === "ArrowRight") (event.preventDefault(), step(1));
  }
</script>

<div class="ou-view">
  <div class="ou-stage">
    <FrontScene kind="street" {campaign} {shift} {weather} {reduced} {paused} display={display.id} />
  </div>
  <div class="ou-keys">
    <div class="stepper" role="group" aria-label="Window display">
      <button type="button" class="boba-key" disabled={!!shift} aria-label="Previous drink" onkeydown={onKey} onclick={() => step(-1)}>‹</button>
      <span class="current"><Cup recipe={display.id} size={22} /><span>In the window: {family?.name}</span></span>
      <button type="button" class="boba-key" disabled={!!shift} aria-label="Next drink" onkeydown={onKey} onclick={() => step(1)}>›</button>
    </div>
    {#if shift}<p class="ou-note">The window is set before the shop opens.</p>{/if}
  </div>
</div>

<style>
  .stepper {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stepper .boba-key {
    min-width: 36px;
    justify-content: center;
    font-size: 1rem;
  }

  .current {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 12rem;
    color: #ffe7b8;
    font-size: 0.8125rem;
  }
</style>
