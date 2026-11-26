<script lang="ts">
  import { figure } from "#lib/arcade/orders-guests.js";
  import { INGREDIENTS } from "#lib/arcade/orders-campaign.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import type { ServiceOrder } from "#lib/arcade/orders-service.ts";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import OrderKitchenItem from "./OrderKitchenItem.svelte";
  import OrderRecipePips, { type RecipeMark } from "./OrderRecipePips.svelte";

  interface Props {
    order: ServiceOrder;
    parts: readonly RecipeMark[];
    fullRecipe: () => RecipeMark[];
  }

  let { order, parts, fullRecipe }: Props = $props();
  let expanded = $state(false);
  const portrait = $derived(figure(order.customerId, "calm"));
  const detailsId = $props.id();
  const labels = new Map(INGREDIENTS.map(({ id, name }) => [id, name]));
</script>

<div class="open-slip" role="group" aria-label="Selected recipe">
  <span class="receipt-face">
    {#if order.catering}<OrderKitchenItem kind="stock" size={28} />
    {:else}<PixelIcon grid={portrait.grid} palette={portrait.palette} px={2} />{/if}
  </span>
  <div class="slip-copy">
    <span class="slip-guest">{order.customerName}
      {#if order.reservation}
        <small class="menu-stamp"><OrderKitchenItem kind="cozy-seats" size={15} />Booked table</small>
      {:else if order.catering}
        <small class="menu-stamp"><OrderKitchenItem kind="stock" size={15} />Takeout</small>
      {:else if order.houseBlend}
        <small class="menu-stamp"><OrderKitchenItem kind="cup" size={15} />House blend</small>
      {:else if order.locationSpecial || order.seasonalSpecial}
        <small class="menu-stamp"><OrderKitchenItem kind={order.locationSpecial ? "street-sign" : "quality"} size={15} />
          {order.locationSpecial ? "House special" : "Event special"}</small>
      {/if}
    </span>
    <strong>{order.recipe.name}</strong>
    {#if parts.length}<div aria-hidden={expanded}><OrderRecipePips {parts} /></div>{/if}
  </div>
  <button type="button" class="boba-key order-pixel-paper-key ingredients-key"
    aria-label="Read full recipe" aria-controls={detailsId} aria-expanded={expanded} onclick={() => expanded = !expanded}>
    <OrderKitchenItem kind="clip" size={20} />
    <svg viewBox="0 0 8 8" width="8" height="8" shape-rendering="crispEdges" aria-hidden="true">
      <path d="M1 2h6v1H6v1H5v1H3V4H2V3H1Z" fill="currentColor" />
    </svg>
  </button>
  {#if order.specialRequest}
    <p class="guest-request">
      <q>{order.specialRequest.line}</q>
      <strong>{money(order.specialRequest.bonus)} for a well-made request</strong>
    </p>
  {/if}
  {#if order.swap}
    <p class="guest-request"><OrderKitchenItem kind={order.swap.to} size={18} />{labels.get(order.swap.to)} in place of {labels.get(order.swap.from)?.toLowerCase()}</p>
  {/if}
  <ul id={detailsId} class="ingredients-readout" aria-label="Full recipe" hidden={!expanded}>
    {#if expanded}
      {#each fullRecipe() as ingredient (ingredient.kind)}
        <li class:done={ingredient.done}><OrderKitchenItem kind={ingredient.kind} size={20} lit={!!ingredient.done} />
          <span>{ingredient.label}<span class="sr-only">{ingredient.done ? ", ready" : ""}</span></span></li>
      {/each}
    {/if}
  </ul>
</div>

<style>
  .open-slip {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--space-2);
    min-height: 3.25rem;
    margin-top: 5px;
    padding: 6px var(--space-2);
    border-block: 1px dashed #ab8a70;
    background: var(--slip-paper);
    color: var(--slip-ink);
    clip-path: var(--notch);
  }
  .slip-copy { min-width: 0; display: grid; gap: 2px; line-height: 1.18; }
  .slip-copy strong { font-size: .925rem; font-weight: 500; }
  .slip-guest { display: flex; flex-wrap: wrap; align-items: center; gap: 1px 7px; color: var(--slip-accent); font-size: .75rem; font-style: italic; }
  .menu-stamp { display: inline-flex; align-items: center; gap: 2px; color: #694820; font-size: .72rem; }
  .guest-request { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 3px 10px; margin: 0; color: var(--slip-ink); font-size: .8125rem; }
  .guest-request strong { color: #6c471f; font-size: inherit; font-weight: 500; }
  .receipt-face { display: block; height: 2.4rem; flex: none; align-self: center; }
  .ingredients-key.boba-key {
    min-height: 36px;
    min-width: 38px;
    padding: 3px;
    gap: 0;
    --key-face: #e7c89f;
    --key-foot: #b8936d;
    --key-rule: #86644e;
    color: #654d41;
  }
  .ingredients-key[aria-expanded="true"] > svg:last-child { transform: scaleY(-1); }
  .ingredients-readout {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin: 0;
    padding: 5px 0 0;
    border-top: 1px dashed #c2a380;
    list-style: none;
  }
  .ingredients-readout[hidden] { display: none; }
  .ingredients-readout li {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    color: #584538;
    background: #e4c9a6;
    font-size: .76rem;
    clip-path: var(--notch);
  }
  .ingredients-readout li.done { background: #d1d5ad; color: #374a36; }
  @media (max-width: 720px) {
    .open-slip { min-height: 2.85rem; padding-block: 3px; }
  }
  @media (orientation: landscape) and (max-height: 430px) {
    .open-slip { min-height: 2.5rem; padding-block: 2px; }
  }
</style>
