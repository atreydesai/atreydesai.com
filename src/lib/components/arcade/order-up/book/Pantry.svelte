<script lang="ts">
  // The pantry as a stock ledger: one row an ingredient, the supplier chosen
  // once at the top, the picked ingredient's lots and uses beside it, and the
  // menu's prices under the ledger.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { INGREDIENTS, FAMILIES, RECIPES, VIEWS } from "#lib/arcade/order-up/content/index.ts";
  import { stock, stockPrice, pantryLots, pantryCount, pantryCapacity as capacity, SUPPLIER_OFFERS } from "#lib/arcade/order-up/engine/pantry.ts";
  import { seasonalPrice } from "#lib/arcade/order-up/engine/calendar.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import Icon from "../Icon.svelte";
  export let campaign: Campaign;
  export let live = false;
  export let action: (name: string, data?: any) => void = () => {};
  let supplier = "market";
  let group = "all";
  let query = "";
  let picked = "";
  const GROUPS = ["all", "tea", "milk", "fruit", "topping", "syrup", "side", "finish"];
  const PRICES = [
    [0, "Value"],
    [1, "Standard"],
    [2, "Premium"],
  ] as const;
  $: known = INGREDIENTS.filter((i) => i.day <= campaign.day);
  $: groups = GROUPS.filter((g) => g === "all" || known.some((i) => i.group === g));
  $: ingredients = known.filter((i) => (group === "all" || i.group === group) && i.name.toLowerCase().includes(query.toLowerCase()));
  $: offers = SUPPLIER_OFFERS.filter((o) => o.day <= campaign.day);
  $: if (!offers.some((o) => o.id === supplier)) supplier = "market";
  $: offer = SUPPLIER_OFFERS.find((o) => o.id === supplier)!;
  $: lots = pantryLots(campaign);
  $: full = pantryCount(campaign) + offer.quantity > capacity(campaign);
  $: chosen = INGREDIENTS.find((i) => i.id === picked) ?? ingredients[0];
  $: chosenLots = chosen ? lots.filter((l) => l.ingredient === chosen.id).sort((a, b) => a.expiresOn - b.expiresOn) : [];
  $: usedIn = chosen ? RECIPES.filter((r) => r.day <= campaign.day && r.ingredients.some((x) => x.id === chosen.id)).length : 0;
  const when = (delay: number) => (delay === 0 ? "now" : delay === 1 ? "tomorrow" : "in two days");
  function season(id: string, s: string) {
    const factor = seasonalPrice(id, campaign.day);
    return factor < 1 ? { text: "In season", tone: "is-good" } : s === "all" ? { text: "", tone: "" } : { text: "Out of season", tone: "" };
  }
  function oldest(id: string) {
    return lots.filter((l) => l.ingredient === id).sort((a, b) => a.expiresOn - b.expiresOn)[0];
  }
</script>

<div class="lg-title">
  <h2>Pantry</h2>
  <span>{pantryCount(campaign)} of {capacity(campaign)} on the shelves</span>
</div>

<div class="lg-chips suppliers" role="group" aria-label="Supplier">
  {#each offers as item (item.id)}
    <button type="button" class="boba-key order-pixel-paper-key supplier" aria-pressed={supplier === item.id} onclick={() => (supplier = item.id)}
      ><strong>{item.name}</strong><span>{when(item.delay)}, {item.quantity} a crate</span></button
    >
  {/each}
</div>

<div class="filters">
  <div class="lg-chips" role="group" aria-label="Kind">
    {#each groups as g (g)}
      <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={group === g} onclick={() => (group = g)}
        >{g === "all" ? "All" : g[0].toUpperCase() + g.slice(1)}</button
      >
    {/each}
  </div>
  <input class="lg-find" bind:value={query} type="search" placeholder="Find" aria-label="Find an ingredient" />
</div>

<div class="lg-split">
  <div class="lg-table" style:--cols="minmax(10rem, 1fr) 4.5rem 4.5rem 6.5rem 7.5rem">
    <div class="lg-head" aria-hidden="true">
      <span>Ingredient</span><span class="lg-num">On hand</span><span class="lg-num">Keeps to</span><span>Season</span><span class="lg-num"
        >Buy {offer.quantity}</span
      >
    </div>
    {#each ingredients as ingredient (ingredient.id)}
      {@const count = stock(campaign, ingredient.id)}
      {@const lot = oldest(ingredient.id)}
      {@const s = season(ingredient.id, ingredient.season)}
      {@const price = stockPrice(campaign, ingredient.id, supplier)}
      <div class="lg-row" class:is-picked={chosen?.id === ingredient.id}>
        <button type="button" class="pick lg-name" aria-pressed={chosen?.id === ingredient.id} onclick={() => (picked = ingredient.id)}
          ><Icon art={ingredient.art} size={28} /><span>{ingredient.name}</span></button
        >
        <span class="lg-num" class:out={count === 0}>{count}</span>
        <span class="lg-num lg-mark">{lot && count > 0 ? "day " + lot.expiresOn : ""}</span>
        <span class="lg-mark {s.tone}">{s.text}</span>
        <button
          type="button"
          class="boba-key order-pixel-paper-key buy"
          disabled={campaign.cash < price || full}
          aria-label={"Buy " + offer.quantity + " " + ingredient.name + " for " + money(price)}
          onclick={() => action("buy-stock", { id: ingredient.id, supplier })}>{money(price)}</button
        >
      </div>
    {:else}
      <p class="lg-empty">Nothing by that name.</p>
    {/each}
  </div>

  <aside class="lg-detail" aria-live="polite">
    {#if chosen}
      <div class="detail-head"><Icon art={chosen.art} size={48} /><h3>{chosen.name}</h3></div>
      <dl class="lg-facts">
        <dt>On hand</dt>
        <dd>{stock(campaign, chosen.id)}</dd>
        <dt>On the menu in</dt>
        <dd>{usedIn} {usedIn === 1 ? "recipe" : "recipes"}</dd>
        <dt>{offer.name}</dt>
        <dd>{money(stockPrice(campaign, chosen.id, supplier))} for {offer.quantity}</dd>
      </dl>
      {#if chosenLots.length}
        <div class="lots">
          {#each chosenLots as lot, i (i)}<span><b>{lot.quantity}</b> keep to day {lot.expiresOn}</span>{/each}
        </div>
      {:else}
        <p>None on the shelves.</p>
      {/if}
    {/if}
    {#if campaign.expansion.shipments.length}
      <div class="lg-rubric"><h3>On the way</h3></div>
      <div class="lots">
        {#each campaign.expansion.shipments as shipment, i (i)}
          {@const item = INGREDIENTS.find((x) => x.id === shipment.ingredient)}
          <span><Icon art={item?.art} size={20} /><b>{shipment.quantity}</b> {item?.name} on day {shipment.arrivesOn}</span>
        {/each}
      </div>
    {/if}
    <div class="lg-actions">
      <button
        type="button"
        class="boba-key order-pixel-paper-key"
        disabled={(VIEWS.find((v) => v.id === "stockroom")?.day ?? 1) > campaign.day}
        onclick={() => action("view", { id: "stockroom" })}>See the shelves</button
      >
    </div>
  </aside>
</div>

<div class="lg-rubric"><h3>Menu prices</h3><span class="lg-meta">{live ? "Set before the shop opens." : ""}</span></div>
<div class="lg-table" style:--cols="minmax(10rem, 1fr) auto">
  {#each FAMILIES.filter((f) => f.day <= campaign.day) as family (family.id)}
    {@const level = campaign.expansion.prices[family.id] ?? 1}
    <div class="lg-row">
      <span class="lg-name"><Icon art={family.art} size={24} /><span>{family.name}</span></span>
      <div class="lg-chips price" role="group" aria-label={family.name + " price"}>
        {#each PRICES as [value, label] (value)}
          <button
            type="button"
            class="boba-key order-pixel-paper-key"
            aria-pressed={level === value}
            disabled={live}
            onclick={() => action("price", { id: family.id, price: value })}>{label}</button
          >
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .suppliers {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }

  .supplier {
    display: grid;
    justify-items: start;
    gap: 4px;
    min-height: 52px !important;
    padding: 8px 12px 10px;
    text-align: left;
  }

  .supplier strong {
    font-size: 0.875rem;
  }

  .supplier span {
    font-size: 0.75rem;
    font-weight: 400;
    opacity: 0.8;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .filters .lg-find {
    width: 12rem;
  }

  .pick {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .pick:focus-visible {
    outline: 2px solid var(--b-accent);
    outline-offset: 2px;
  }

  .out {
    color: var(--b-accent);
    font-weight: 600;
  }

  .buy {
    justify-self: end;
    min-width: 6.5rem;
  }

  .detail-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .lots {
    display: grid;
    gap: 6px;
    font-size: 0.8125rem;
  }

  .lots span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .lots b {
    min-width: 2ch;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .price {
    justify-content: end;
    margin: 0;
  }
</style>
