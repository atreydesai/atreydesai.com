<script lang="ts">
  import { INGREDIENTS, nextExpiry, stockCount, type Campaign, type IngredientId } from "#lib/arcade/orders-campaign.ts";
  import OrderKitchenItem from "./OrderKitchenItem.svelte";

  const views = [
    { id: "all", label: "All stock", icon: "stock" },
    { id: "soon", label: "Use tonight", icon: "patience" },
    { id: "low", label: "Running low", icon: "reorder" },
  ] as const;

  interface Props {
    campaign: Campaign;
    current: readonly IngredientId[];
    upcoming: readonly IngredientId[];
    selected: IngredientId;
    onPick: (id: IngredientId) => void;
  }

  let { campaign, current, upcoming, selected, onPick }: Props = $props();
  let view = $state<typeof views[number]["id"]>("all");
  const names = new Map(INGREDIENTS.map(({ id, name }) => [id, name]));
  const restock = $derived(current.filter((id) => stockCount(campaign, id) <= (id === "pearls" ? 4 : 3)));
  const tonight = $derived(current.filter((id) => nextExpiry(campaign, id) === campaign.day + 1));
  const visible = $derived(view === "soon" ? tonight : view === "low" ? restock : current);
</script>

{#snippet shelf(items: readonly IngredientId[], label: string)}
  <ul class="shelf" aria-label={label}>
    {#each items as id (id)}
      {@const quantity = stockCount(campaign, id)}
      {@const expiry = nextExpiry(campaign, id)}
      {@const low = quantity <= (id === "pearls" ? 4 : 3)}
      {@const expiring = expiry !== null && expiry === campaign.day + 1}
      {@const stockLabel = Number.isFinite(quantity) ? `${quantity} in stock` : "Unlimited stock"}
      {@const status = quantity === 0 ? "Out of stock" : expiring ? "Some expires tonight" : low ? "Low stock" : ""}
      <li>
        <button type="button" aria-pressed={id === selected}
          aria-label={`${names.get(id)}, ${stockLabel}${status ? `, ${status}` : ""}`}
          title={status || stockLabel} onclick={() => onPick(id)}>
          <OrderKitchenItem kind={id} size={33} />
          <span class="label">
            <strong>{names.get(id)}</strong>
            <span class="quantity" class:low class:expiring>
              {Number.isFinite(quantity) ? quantity : "∞"}{#if status}<small>{quantity === 0 ? "out" : expiring ? "use soon" : "low"}</small>{/if}
            </span>
          </span>
        </button>
      </li>
    {/each}
  </ul>
{/snippet}

<div class="shelf-views" role="group" aria-label="Filter ingredients">
  {#each views as choice (choice.id)}
    {@const count = choice.id === "soon" ? tonight.length : choice.id === "low" ? restock.length : null}
    <button class="boba-key order-pixel-paper-key" type="button" aria-pressed={view === choice.id} onclick={() => view = choice.id}>
      <OrderKitchenItem kind={choice.icon} size={20} />{choice.label}{#if count !== null}<small>{count}</small>{/if}
    </button>
  {/each}
</div>

{#if visible.length}
  {@render shelf(visible, "Current ingredients")}
{:else}
  <p class="shelf-empty">{view === "soon" ? "Nothing expires tonight." : "The shelf is stocked."}</p>
{/if}

{#if view === "all" && upcoming.length}
  <details>
    <summary>Upcoming ingredients</summary>
    {@render shelf(upcoming, "Upcoming ingredients")}
  </details>
{/if}

<style>
  .shelf {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 5rem), 1fr));
    gap: .4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    min-width: 0;
  }

  .shelf > li > button {
    display: grid;
    grid-template-rows: 2.25rem 1fr;
    justify-items: center;
    width: 100%;
    min-height: 5.5rem;
    padding: .35rem .25rem .3rem;
    color: #4a322d;
    background: #e8c596;
    border: 1px solid #987451;
    clip-path: var(--notch);
    font: inherit;
    line-height: 1.12;
    cursor: pointer;
  }

  .shelf > li > button:hover {
    background-color: #f5d8aa;
  }

  .shelf > li > button[aria-pressed="true"] {
    background: #f5dfa9;
    border-color: #744b37;
    box-shadow: inset 0 0 0 1px #744b37;
  }

  button:focus-visible { outline: 2px solid transparent; box-shadow: inset 0 0 0 2px #754334; }

  summary:focus-visible {
    outline: 2px solid #754334;
    outline-offset: 2px;
  }

  .shelf-views { display: flex; flex-wrap: wrap; gap: 4px; margin-block-end: .45rem; }
  .shelf-views button { min-height: 44px; padding-inline: 6px; gap: 3px; font-size: .74rem; }
  .shelf-views button[aria-pressed="true"] { --key-face: var(--b-mine); --key-rule: var(--b-accent); }
  .shelf-empty { margin: .65rem 0; color: #65564b; font-size: .83rem; }

  .label {
    display: grid;
    align-content: space-between;
    gap: .18rem;
    width: 100%;
    padding: .26rem .12rem .17rem;
    background: #fbedd2;
    font-size: .72rem;
    overflow-wrap: anywhere;
    text-align: center;
  }

  .quantity {
    font-variant-numeric: tabular-nums;
  }

  .quantity.low, .quantity.expiring {
    color: #864431;
    font-weight: 750;
  }

  small {
    margin-inline-start: .25em;
    font-size: .64rem;
  }

  details {
    margin-block-start: .7rem;
  }

  summary {
    box-sizing: border-box;
    width: fit-content;
    padding: .5rem .15rem;
    cursor: pointer;
    font-weight: 650;
    font-size: .85rem;
  }

  details[open] summary {
    margin-block-end: .25rem;
  }
</style>
