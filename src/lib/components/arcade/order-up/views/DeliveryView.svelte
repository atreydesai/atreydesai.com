<script lang="ts">
  // The delivery run: ride a van's load from the commissary to a shop on the
  // cargo bike, leaning against the bumps to keep the cups level. The lean
  // keys sit at the foot of the street, one each side, for thumbs.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import type { Activity } from "#lib/arcade/order-up/engine/activities.ts";
  import { TUNING } from "#lib/arcade/order-up/engine/tuning.ts";
  import { SHOPS, INGREDIENT_BY_ID } from "#lib/arcade/order-up/content/index.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { placeLight, shiftProgress } from "#lib/arcade/order-up/art/places/kit.ts";
  import { drawDelivery, DELIVERY_HEIGHT, DELIVERY_WIDTH } from "#lib/arcade/order-up/art/delivery.ts";
  import PixelScene from "../PixelScene.svelte";
  import Picker from "./Picker.svelte";
  import "./view.css";

  export let campaign: Campaign;
  export let activity: Activity | null;
  export let steering: number;
  export let weather: string;
  export let paused: boolean;
  export let reduced: boolean;
  export let action: (name: string, data?: any) => void;
  /** The shift in progress, for the hour's light. */
  export let shift: Shift | null = null;

  $: routes = campaign.expansion.routes.filter((r) => r.progress < 1);
  let target = "practice";
  // A run in progress shows its own route, wherever it was started from.
  $: if (activity?.kind === "delivery" && activity.target && activity.target !== target) target = activity.target;
  $: if (target !== "practice" && !routes.some((r) => r.to === target) && !(activity?.kind === "delivery" && activity.target === target))
    target = routes[0]?.to ?? "practice";
  $: choices = [
    ...routes.map((r) => ({ id: r.to, name: "To " + (SHOPS.find((x) => x.id === r.to)?.name ?? r.to), icon: r.ingredient })),
    { id: "practice", name: "Practice run" },
  ];
  $: riding = activity?.kind === "delivery" && !activity.done;
  $: finished = activity?.kind === "delivery" && activity.done ? activity : null;
  $: route = routes.find((r) => r.to === target);
  $: cups = (() => {
    const tea = route ? (INGREDIENT_BY_ID[route.ingredient]?.cupColor ?? "#c79562") : "#c79562";
    return [tea, "#a7b46f", tea, "#b38db3"];
  })();
  $: hasCourier = campaign.expansion.staff.some((s) => s.role === "courier");
  $: cal = calendar(campaign.day);
  $: light = placeLight(cal.season.id, weather || cal.weather, shiftProgress(shift), false);
  $: scene = {
    time: activity?.kind === "delivery" ? activity.elapsed : 0,
    progress: activity?.kind === "delivery" ? activity.progress : 0,
    balance: activity?.kind === "delivery" ? activity.balance : 0,
    steering,
    tolerance: TUNING[campaign.mode].deliveryTolerance,
    riding,
    weather: light.weather,
    cups,
  };
  $: live = riding && !paused && !reduced;
  // While live the loop paints; otherwise a change in what is shown repaints once.
  $: key = live ? "live" : [light.key, cups.join(","), scene.progress.toFixed(3), scene.balance.toFixed(2), scene.time.toFixed(2)].join("|");

  function lean(value: number) {
    return {
      onpointerdown: (event: PointerEvent) => {
        if (!riding) return;
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
        action("steer", { value });
      },
      onpointerup: () => action("steer", { value: 0 }),
      onpointercancel: () => action("steer", { value: 0 }),
      onlostpointercapture: () => action("steer", { value: 0 }),
      // Held Enter or Space leans like a held pointer; a click with no pointer (assistive tech) leans a moment.
      onkeydown: (event: KeyboardEvent) => {
        if (!riding || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        action("steer", { value });
      },
      onkeyup: (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") action("steer", { value: 0 });
      },
      onclick: (event: MouseEvent) => {
        if (!riding || event.detail !== 0) return;
        action("steer", { value });
        setTimeout(() => action("steer", { value: 0 }), 350);
      },
    };
  }
</script>

<div class="ou-view">
  <div class="ou-stage">
    <div class="ou-frame">
      <PixelScene
        width={DELIVERY_WIDTH}
        height={DELIVERY_HEIGHT}
        draw={(p) => drawDelivery(p, light, scene)}
        {live}
        fps={60}
        version={key}
        label="A courier rides a cargo bike of cups down the street"
      />
      <button type="button" class="boba-key lean left" class:is-down={steering < 0} disabled={!riding} aria-keyshortcuts="ArrowLeft" {...lean(-1)}
        >Lean left<kbd aria-hidden="true">←</kbd></button
      >
      <button type="button" class="boba-key lean right" class:is-down={steering > 0} disabled={!riding} aria-keyshortcuts="ArrowRight" {...lean(1)}
        >Lean right<kbd aria-hidden="true">→</kbd></button
      >
      {#if finished}
        <p class="result ou-caption" role="status">
          Graded {finished.grade}.{#if finished.reward > 1}
            The shop sold it for {money(finished.reward)}.{/if}
        </p>
      {/if}
    </div>
  </div>
  <div class="ou-keys">
    <Picker items={choices} bind:value={target} label="Route" keys={0} width="12rem" disabled={riding} />
    <button
      type="button"
      class="boba-key is-primary"
      disabled={riding}
      onclick={() => action("activity", { kind: "delivery", target: route ? target : "practice" })}>Ride</button
    >
    <button type="button" class="boba-key" disabled={riding || !hasCourier || !route} onclick={() => action("runner-delivery", { to: target })}
      >Send the courier for {money(100)}</button
    >
  </div>
</div>

<style>
  .lean {
    position: absolute;
    bottom: 6%;
    min-height: clamp(36px, calc(var(--px) * 30), 48px);
    font-size: clamp(0.75rem, calc(var(--px) * 9), 0.875rem);
    touch-action: none;
  }

  .lean.left {
    left: 3%;
  }

  .lean.right {
    right: 3%;
  }

  .result {
    position: absolute;
    top: 12%;
    left: 50%;
    margin: 0;
    padding: 4px 10px;
    font-size: 0.8125rem;
    transform: translateX(-50%);
  }
</style>
