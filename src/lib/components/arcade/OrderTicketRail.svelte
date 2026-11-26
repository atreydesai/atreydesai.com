<script lang="ts">
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import { figure } from "#lib/arcade/orders-guests.js";
  import type { cateringProgress, ServiceOrder, ServiceState } from "#lib/arcade/orders-service.ts";
  import OrderKitchenItem from "./OrderKitchenItem.svelte";
  import OrderPixelWord from "./OrderPixelWord.svelte";
  import OrderTakeoutTray from "./OrderTakeoutTray.svelte";

  interface Props {
    shift: ServiceState;
    tickets: readonly ServiceOrder[];
    selectedId?: string;
    activeTickets: number;
    rackFull: boolean;
    quietTime: number;
    takeout: ReturnType<typeof cateringProgress>;
    onOpenDoors: () => void;
    onChoose: (order: ServiceOrder) => void;
  }

  let { shift, tickets, selectedId, activeTickets, rackFull, quietTime, takeout, onOpenDoors, onChoose }: Props = $props();
  const takeoutLeft = $derived(takeout ? Math.max(0, Math.ceil(takeout.offer.deadline - shift.elapsed)) : 0);
  const nextTakeout = $derived(tickets.find((order) => order.catering));

  function progress(elapsed: number, target: number) {
    return target > 0 ? Math.max(0, Math.min(1, elapsed / target)) : 0;
  }

  function ticketName(order: ServiceOrder) {
    if (order.status === "building") return order.cup?.sealed ? order.catering ? "Ready to pack" : "Ready for pickup" : "At the island";
    if (order.status === "brewing") {
      const batch = order.cup?.brew;
      return batch && batch.elapsed >= batch.target ? "Brew ready" : "Brewing";
    }
    return order.status === "accepted" ? "At the stove" : order.catering ? "Takeout ticket" : "Ready to order";
  }

  function ticketMark(order: ServiceOrder) {
    if (order.cup?.sealed) return "serve";
    if (order.status === "building") return "build";
    return order.status === "waiting" ? "clip" : "brew";
  }
</script>

<aside class="ticket-wall" aria-label="Order tickets">
  {#if shift.preOpen !== undefined}
    <div class="prep-doors">
      <div class="prep-doors-status"><OrderKitchenItem kind="prep" size={25} />
        <div><strong>Before opening</strong><small>{Math.ceil(shift.preOpen ?? 0)}s to prep</small></div>
      </div>
      <button class="boba-key is-primary" type="button" onclick={onOpenDoors}>Open doors</button>
    </div>
  {:else}
    <div class="rail-label">
      <OrderKitchenItem kind="clip" size={23} />
      <h2><span class="sr-only">Ticket rail</span><OrderPixelWord text="Tickets" cells={1} /></h2>
      {#if shift.effects.ticketSlots > 3 || rackFull}
        <span class="rack-count" class:full={rackFull} aria-label={activeTickets + " of " + shift.effects.ticketSlots + " open tickets"}>{activeTickets}/{shift.effects.ticketSlots}</span>
      {/if}
    </div>
    {#if takeout}
      <button class="takeout-key" class:is-due={takeoutLeft <= 10 && takeout.readyAt === null} type="button"
        aria-label={`Takeout ${takeout.packed} of ${takeout.offer.recipes.length} packed${takeout.readyAt === null ? ", " + takeoutLeft + " seconds left" : ""}`}
        title={takeout.offer.name} disabled={!nextTakeout || (rackFull && nextTakeout.status === "waiting")} onclick={() => nextTakeout && onChoose(nextTakeout)}>
        <OrderTakeoutTray packed={takeout.packed} size={39} />
        <span>{takeout.packed}/{takeout.offer.recipes.length} {takeout.readyAt === null && takeoutLeft ? takeoutLeft + "s" : takeout.earned ? "✓" : ""}</span>
      </button>
    {/if}
    <div class="ticket-list">
      {#each tickets as ticket (ticket.id)}
        {@const face = figure(ticket.customerName.toLowerCase(),
          ticket.patience / ticket.maxPatience < 0.25 ? "cross" : ticket.patience / ticket.maxPatience < 0.55 ? "glance" : "calm")}
        <button class="guest-ticket" class:takeout-ticket={ticket.catering} class:ticket-active={selectedId === ticket.id} type="button" aria-pressed={selectedId === ticket.id}
          disabled={rackFull && ticket.status === "waiting"} onclick={() => onChoose(ticket)}>
          <span class="guest-portrait">
            {#if ticket.catering}<OrderKitchenItem kind="stock" size={26} />
            {:else}<PixelIcon grid={face.grid} palette={face.palette} px={2} />{/if}
          </span>
          <span class="guest-order">
            <strong>{ticket.customerName}{#if ticket.reservation}<i class="reservation-mark" aria-label="Group reservation" title="Group reservation"></i>{/if}</strong>
            <small class:pickup-ready={ticket.cup?.sealed}><OrderKitchenItem kind={ticketMark(ticket)} size={13} />{ticketName(ticket)}</small>
            <progress class="patience" class:quiet={!ticket.catering && quietTime > 0} max="1" value={progress(ticket.patience, ticket.maxPatience)} aria-label={ticket.catering ? "Time until takeout pickup" : ticket.customerName + " patience"}></progress>
          </span>
        </button>
      {:else}
        <p class="empty-rail">{shift.status === "open" ? "Waiting for the next guest." : "All tickets cleared."}</p>
      {/each}
    </div>
  {/if}
</aside>

<style>
  .ticket-wall {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    min-height: 3.9rem;
    padding: var(--space-2) var(--space-3);
    color: #fff0d6;
    background: #392b2b;
    box-shadow: inset 0 3px #966754, inset 0 -4px #211c21, 0 4px #252226;
    clip-path: var(--notch);
  }

  .rail-label {
    display: flex;
    align-items: center;
    flex: none;
    gap: var(--space-1-5);
    padding-inline-end: var(--space-2);
  }

  .rail-label h2 { color: inherit; margin: 0; line-height: 1; }

  .ticket-list {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    gap: var(--space-2);
    min-width: 0;
    overflow: auto;
    padding: 4px 2px;
  }

  .prep-doors, .prep-doors-status { display: flex; align-items: center; gap: 8px; }
  .prep-doors { width: 100%; justify-content: space-between; }
  .prep-doors-status strong, .prep-doors-status small { display: block; }
  .prep-doors-status strong { font-size: .88rem; }
  .prep-doors-status small { color: #e4c69e; font-size: .74rem; }
  .prep-doors button { min-height: 42px; }

  .takeout-key {
    display: grid;
    place-items: center;
    min-width: 49px;
    min-height: 44px;
    padding: 2px 3px 4px;
    border: 0;
    box-shadow: inset 0 0 0 2px #9b9470, inset 0 -4px #2a332d;
    background: #596751;
    color: #f9e3ab;
    clip-path: var(--notch);
    font-size: .65rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .takeout-key:not(:disabled):hover, .takeout-key:focus-visible { background: #708060; }
  .takeout-key.is-due { background: #845443; }

  .guest-ticket {
    display: flex;
    align-items: center;
    flex: 0 1 9rem;
    gap: var(--space-1-5);
    position: relative;
    min-height: 2.9rem;
    border: 0;
    padding: 6px 8px 5px;
    background: #ecd4ac;
    box-shadow: inset 0 2px #fff0cc, inset 0 -3px #bf9a79;
    clip-path: var(--notch);
    color: #342527;
    cursor: pointer;
    text-align: left;
    font: inherit;
    touch-action: manipulation;
  }

  .guest-ticket.ticket-active {
    background: #f8d0a9;
    box-shadow: inset 0 3px #d48261, inset 0 -3px #d48261, inset 3px 0 #d48261, inset -3px 0 #d48261;
  }
  .guest-ticket.takeout-ticket { background: #dfdfb7; }
  .guest-ticket.takeout-ticket.ticket-active { background: #edf0c3; }

  .guest-ticket:focus-visible {
    box-shadow: inset 0 0 0 3px #ad3f30, inset 0 -3px #9d6755;
    outline: none;
  }
  .guest-ticket:disabled { cursor: default; opacity: .65; }
  .rack-count { color: #e3c59c; font-size: .63rem; font-variant-numeric: tabular-nums; }
  .rack-count.full { color: #ffbe90; }

  .guest-portrait {
    flex: none;
    align-self: end;
    height: 2.3rem;
    overflow: hidden;
  }

  .guest-order {
    display: grid;
    gap: 2px;
    min-width: 0;
    line-height: 1.14;
  }

  .guest-order strong {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .guest-order strong { font-size: 0.87rem; font-weight: 500; }
  .guest-order small { display: flex; align-items: center; gap: 3px; color: #654747; font-size: 0.72rem; }
  .guest-order .pickup-ready { color: #375642; font-weight: 500; }
  .reservation-mark { display: inline-block; width: 4px; height: 4px; margin: 0 0 2px 5px; background: #9a673d; }
  .empty-rail { margin: 0; color: #e9cbb0; font-size: 0.8rem; }

  progress { --meter-track: #625047; --meter-fill: #efa988; width: 100%; height: 8px; appearance: none; border: 0; background: var(--meter-track); accent-color: var(--meter-fill); }
  progress::-webkit-progress-bar { background: var(--meter-track); }
  progress::-webkit-progress-value { background: var(--meter-fill); }
  progress::-moz-progress-bar { background: var(--meter-fill); }
  progress.patience { --meter-track: #d4b693; --meter-fill: #9b523d; height: 3px; }
  .patience.quiet { --meter-fill: #759b90; }

  @media (max-width: 720px) and (orientation: portrait) {
    .ticket-wall { position: sticky; top: 0; z-index: 3; flex-wrap: wrap; gap: 3px 6px; padding: 4px 6px; min-height: 3.6rem; }
    .rail-label { padding-inline-end: 0; }
    .rail-label :global(.kitchen-item) { display: none; }
    .guest-ticket { flex: 0 0 auto; max-width: 9rem; min-height: 2.6rem; }
  }

  @media (orientation: landscape) and (max-height: 540px) {
    .ticket-wall { min-height: 3.55rem; padding: 3px 8px; gap: 6px; }
    .guest-ticket { min-height: 2.65rem; padding-block: 3px; }
  }
</style>
