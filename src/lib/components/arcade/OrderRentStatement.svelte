<script lang="ts">
  import { money } from "#lib/arcade/orders-display.ts";
  import type { RentPeriod } from "#lib/arcade/orders-rent-book.ts";
  import OrderKitchenItem from "./OrderKitchenItem.svelte";
  import OrderRentEnvelope from "./OrderRentEnvelope.svelte";

  let { period }: { period: RentPeriod } = $props();
  const status = $derived(period.outcome === "paid" ? "Rent paid" : period.outcome === "closed" ? "Rent unpaid" :
    period.outcome === "waived" ? "Rent waived" : "In progress");
  const dates = $derived(period.firstDay === period.lastDay ? "Day " + period.firstDay : `Days ${period.firstDay}–${period.lastDay}`);
</script>

<section class="rent-statement" class:closed={period.outcome === "closed"} aria-label={`Month ${period.month} statement`}>
  <div class="envelope"><OrderRentEnvelope state={period.outcome === "waived" ? "open" : period.outcome} size={100} /></div>
  <div class="month-heading">
    <h3>Month {period.month}</h3>
    <p>{dates} <span>·</span> {status}</p>
  </div>
  <div class="month-facts">
    <span><OrderKitchenItem kind="cup" size={20} />{period.cups} cups</span>
    <span><OrderKitchenItem kind="special" size={20} />{money(period.takings)} takings</span>
    {#if period.payroll}<span><OrderKitchenItem kind="clip" size={20} />{money(period.payroll)} payroll</span>{/if}
    {#if period.expired}<span><OrderKitchenItem kind="stock" size={20} />{period.expired} expired</span>{/if}
    {#if period.rent}<span><OrderKitchenItem kind="patience" size={20} />{money(period.rent)} rent</span>{/if}
    {#if period.outcome === "paid"}<span><OrderKitchenItem kind="quality" size={20} />{money(period.reserve)} after rent</span>{/if}
  </div>
</section>

<style>
  .rent-statement {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 4px 9px;
    padding: 6px 8px;
    color: #504037;
    background: #ebd7b1;
    clip-path: var(--notch);
  }
  .rent-statement.closed { background: #ead0b1; }
  .envelope :global(svg) { display: block; width: 64px; height: auto; }
  .month-heading h3 { color: #4b3c31; font-size: 1rem; margin: 0; }
  .month-heading p { color: #605748; font-size: .75rem; margin: 2px 0 0; }
  .closed .month-heading p { color: #874e42; }
  .month-facts { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 2px 9px; }
  .month-facts span { display: inline-flex; align-items: center; gap: 3px; min-width: 0; font-size: .74rem; }
</style>
