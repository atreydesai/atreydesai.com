<script lang="ts">
  // The order window from behind the pass: the guests waiting across it, the
  // venue's own outside behind them, and the drink in hand on the counter.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import { selectedTicket, activeCup } from "#lib/arcade/order-up/engine/shift.ts";
  import FrontScene from "../FrontScene.svelte";
  import Cup from "../Cup.svelte";
  import "./view.css";

  export let campaign: Campaign;
  export let shift: Shift | null;
  export let weather: string;
  export let reduced = false;
  export let paused = false;
  export let action: (name: string, data?: any) => void;
  export let chooseTicket: (slot: number) => void;

  $: ticket = shift ? selectedTicket(shift) : null;
  $: cup = ticket ? activeCup(ticket) : null;
  $: guests = (shift?.tickets ?? []).map((t, slot) => ({ ticket: t!, slot })).filter((g) => !!g.ticket).slice(0, 5);
  $: ready = !!ticket && ticket.cups.every((c) => c.ready);
</script>

<div class="ou-view">
  <div class="ou-stage">
    <FrontScene kind="window" {campaign} {shift} {weather} {reduced} {paused} {guests} selected={shift?.selected ?? -1} {chooseTicket}>
      {#if ticket && cup}
        <span class="pass-cup"><Cup recipe={cup.recipe} steps={cup.ready ? 99 : cup.step} size={46} /></span>
      {/if}
    </FrontScene>
  </div>
  <div class="ou-keys">
    {#if !shift}
      <p class="ou-note">Guests line up here once the shop opens.</p>
    {:else}
      <button type="button" class="boba-key is-primary" disabled={!ready} onclick={() => action("handoff")}>Hand off</button>
      {#if ticket?.usual && !ticket.revealed}<button type="button" class="boba-key" onclick={() => action("inspect")}>Check the album</button>{/if}
    {/if}
  </div>
</div>

<style>
  .pass-cup {
    position: absolute;
    right: 13%;
    bottom: 32%;
    pointer-events: none;
  }
</style>
