<script lang="ts">
  // The pantry as a board of crates: pick a supplier, then buy from any
  // ingredient's tile. A tile shows how many are on hand, when the oldest
  // keeps to, and an orange edge when some spoil tomorrow. What's on the way
  // is the receipt tucked beside the book; menu prices are the last chip.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { INGREDIENTS, FAMILIES } from "#lib/arcade/order-up/content/index.ts";
  import { stock, stockPrice, pantryLots, pantryCount, pantryCapacity as capacity, SUPPLIER_OFFERS } from "#lib/arcade/order-up/engine/pantry.ts";
  import { seasonalPrice } from "#lib/arcade/order-up/engine/calendar.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import OrderPixelWord from "../../OrderPixelWord.svelte";
  import Icon from "../Icon.svelte";
  export let campaign: Campaign;
  export let live = false;
  export let action: (name: string, data?: any) => void = () => {};
  let supplier = "market";
  let group = "all";
  const GROUPS = ["all", "tea", "milk", "fruit", "topping", "syrup", "side", "finish"];
  const PRICES = [
    [0, "$", "Value"],
    [1, "$$", "Standard"],
    [2, "$$$", "Premium"],
  ] as const;
  $: known = INGREDIENTS.filter((i) => i.day <= campaign.day);
  $: groups = GROUPS.filter((g) => g === "all" || known.some((i) => i.group === g));
  $: ingredients = known.filter((i) => group === "all" || i.group === group);
  $: offers = SUPPLIER_OFFERS.filter((o) => o.day <= campaign.day);
  $: if (!offers.some((o) => o.id === supplier)) supplier = "market";
  $: offer = SUPPLIER_OFFERS.find((o) => o.id === supplier)!;
  $: lots = pantryLots(campaign);
  $: count = pantryCount(campaign);
  $: room = capacity(campaign);
  $: full = count + offer.quantity > room;
  const when = (delay: number) => (delay === 0 ? "now" : delay === 1 ? "tomorrow" : "in 2 days");
  function oldest(id: string) {
    return lots.filter((l) => l.ingredient === id && l.expiresOn > campaign.day).sort((a, b) => a.expiresOn - b.expiresOn)[0];
  }
  function season(id: string, s: string) {
    const factor = seasonalPrice(id, campaign.day);
    return factor < 1 ? "in season" : s === "all" ? "" : "out of season";
  }
</script>

<div class="pantry">
  <div class="top">
    <div class="bk-keys" role="group" aria-label="Supplier">
      {#each offers as item (item.id)}
        <button type="button" class="boba-key supplier" aria-pressed={supplier === item.id} onclick={() => (supplier = item.id)}
          ><strong>{item.name}</strong><span>{item.quantity} {when(item.delay)}{item.life ? `, keeps ${item.life} days longer` : ""}</span></button
        >
      {/each}
    </div>
    <span class="bk-grow"></span>
    <div class="shelves" style:--fill="{Math.min(100, (count / room) * 100)}%">
      <i></i><span>{count}/{room} on the shelves</span>
    </div>
  </div>

  <div class="bk-keys" role="group" aria-label="Kind">
    {#each groups as g (g)}
      <button type="button" class="boba-key is-small" aria-pressed={group === g} onclick={() => (group = g)}>{g}</button>
    {/each}
    <span class="gap"></span>
    <button type="button" class="boba-key is-small" aria-pressed={group === "prices"} onclick={() => (group = "prices")}>menu prices</button>
  </div>

  {#if group === "prices"}
    {#if live}<p class="bk-note">Set before the shop opens.</p>{/if}
    <div class="bk-tiles is-fill" style:--min="150px">
      {#each FAMILIES.filter((f) => f.day <= campaign.day) as family (family.id)}
        {@const level = campaign.expansion.prices[family.id] ?? 1}
        <div class="bk-tile family">
          <Icon art={family.art} size={40} /><span class="bk-name">{family.name}</span>
          <div class="bk-keys levels" role="group" aria-label={family.name + " price"}>
            {#each PRICES as [value, mark, label] (value)}
              <button
                type="button"
                class="boba-key is-small"
                aria-pressed={level === value}
                aria-label={label}
                disabled={live}
                onclick={() => action("price", { id: family.id, price: value })}>{mark}</button
              >
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="bk-tiles is-fill" style:--min="118px">
      {#each ingredients as ingredient (ingredient.id)}
        {@const have = stock(campaign, ingredient.id)}
        {@const lot = oldest(ingredient.id)}
        {@const soon = have > 0 && !!lot && lot.expiresOn <= campaign.day + 1}
        {@const price = stockPrice(campaign, ingredient.id, supplier)}
        {@const s = season(ingredient.id, ingredient.season)}
        <div class="bk-tile crate" class:is-hot={soon}>
          {#if s}<span class="season" class:good={s === "in season"}>{s}</span>{/if}
          <span class="n" class:zero={!have}>{have}</span>
          <Icon art={ingredient.art} size={40} />
          <span class="bk-name">{ingredient.name}</span>
          <span class="bk-lbl" class:soon>{have && lot ? "to day " + lot.expiresOn : " "}</span>
          <button
            type="button"
            class="boba-key is-small buy"
            disabled={campaign.cash < price || full}
            aria-label={"Buy " + offer.quantity + " " + ingredient.name + " for " + money(price)}
            onclick={() => action("buy-stock", { id: ingredient.id, supplier })}>{money(price)}</button
          >
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .pantry {
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .top {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pantry .supplier {
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    min-height: 44px;
    padding: 6px 12px 9px;
    text-align: left;
  }

  .supplier strong {
    font-weight: 600;
  }

  .supplier span {
    font-size: 11px;
    opacity: 0.75;
  }

  .shelves {
    display: grid;
    gap: 5px;
    justify-items: end;
    color: var(--lg-muted);
    font-size: 12px;
    white-space: nowrap;
  }

  .shelves i {
    display: block;
    width: 130px;
    height: 6px;
    background: var(--lg-line);
  }

  .shelves i::before {
    content: "";
    display: block;
    width: var(--fill);
    height: 100%;
    background: var(--lg-cream);
  }

  .gap {
    width: 10px;
  }

  .pantry .bk-tile.crate {
    gap: 4px;
    padding: 12px 6px 9px;
  }

  .pantry .crate.bk-tile .bk-name {
    display: grid;
    place-items: center;
    height: 28px;
    font-weight: 400;
    font-size: 12px;
  }

  .pantry .crate.bk-tile .bk-lbl {
    min-height: 13px;
    font-size: 11px;
  }

  .pantry .crate.bk-tile .bk-lbl.soon {
    color: var(--lg-orange-hi);
    font-weight: 500;
  }

  .n {
    position: absolute;
    top: 7px;
    right: 8px;
    color: var(--lg-cream);
    font: 700 16px/1 var(--font-display);
  }

  .n.zero {
    color: var(--lg-muted);
    font-weight: 500;
  }

  .season {
    position: absolute;
    top: 8px;
    left: 8px;
    color: var(--lg-muted);
    font-size: 10px;
  }

  .season.good {
    color: #dba84d;
  }

  .buy {
    min-width: 60px;
  }

  .pantry .bk-tile.family {
    gap: 8px;
    padding: 12px 8px;
  }

  .levels {
    justify-content: center;
  }

  @media (max-width: 760px) {
    .top {
      flex-wrap: wrap;
    }

    .shelves {
      justify-items: start;
    }
  }
</style>
