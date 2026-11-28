<script lang="ts">
  // The shops: every venue in the chain, each shown by its own room, with
  // the picked one's stars, rooms to add and what it costs beside the list.
  // The truck's stop and the commissary's van routes live with their shop.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { SHOPS, INGREDIENTS, VIEWS } from "#lib/arcade/order-up/content/index.ts";
  import { listedShops } from "#lib/arcade/order-up/engine/opened.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { TUNING } from "#lib/arcade/order-up/engine/tuning.ts";
  import Icon from "../Icon.svelte";
  import ShopThumb from "../ShopThumb.svelte";
  export let campaign: Campaign;
  export let live = false;
  export let action: (name: string, data?: any) => void = () => {};
  let picked = "";
  let routeTo = 0;
  let routeItem = 0;
  const STOPS = ["park", "stadium", "beach", "concert", "offices"];
  // What each shop does differently, from its rules.
  const RULES: Record<string, string> = {
    campus: "A quarter more guests during the class rushes.",
    garden: "Guests wait a fifth longer.",
    night: "A fifth more guests.",
    station: "Guests are in a hurry for their train.",
    harbor: "Guests come in waves with the ferry.",
    loft: "Every fourth order is a flight of three.",
    truck: "Choose where it parks each day.",
    boardwalk: "Slushes sell best, and drinks melt faster.",
    lodge: "Guests order hot drinks.",
    commissary: "Fills supply trays for the other shops.",
  };
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const vanDay = VIEWS.find((v) => v.id === "delivery")?.day ?? 0;
  const price = (n: number) => Math.round(n * TUNING[campaign.mode].purchase);
  $: open = SHOPS.filter((s) => campaign.expansion.shops[s.id]);
  $: shop = SHOPS.find((s) => s.id === picked) ?? SHOPS.find((s) => s.id === campaign.expansion.activeShop) ?? SHOPS[0];
  $: state = campaign.expansion.shops[shop.id];
  $: locked = shop.day > campaign.day;
  $: next = state && state.expansion < 3 ? shop.expansions[state.expansion] : null;
  $: targets = SHOPS.filter((s) => campaign.expansion.shops[s.id] && s.id !== "commissary");
  $: items = INGREDIENTS.filter((i) => i.day <= campaign.day);
</script>

<div class="lg-title">
  <h2>Shops</h2>
  <span>{open.length} of {SHOPS.length} open</span>
</div>

<div class="lg-split">
  <div class="lg-table" style:--cols="minmax(12rem, 1fr) 4.5rem 3.5rem 6.5rem">
    <div class="lg-head" aria-hidden="true"><span>Shop</span><span>Stars</span><span>Rooms</span><span class="lg-num"></span></div>
    {#each listedShops(campaign) as s (s.id)}
      {@const st = campaign.expansion.shops[s.id]}
      {@const soon = s.day > campaign.day}
      <button type="button" class="lg-row shop-row" class:is-picked={shop.id === s.id} class:is-dim={soon} aria-pressed={shop.id === s.id} onclick={() => (picked = s.id)}>
        <span class="lg-name"><ShopThumb id={s.id} width={64} height={36} locked={soon} /><span>{s.name}</span></span>
        <span class="stars" aria-label={st ? st.stars + " stars" : "not open"}>{#if st}{#each [1, 2, 3, 4, 5] as n (n)}<i class:on={st.stars >= n}></i>{/each}{/if}</span>
        <span class="lg-mark">{st ? st.expansion + 1 + " of 4" : ""}</span>
        <span class="lg-num lg-mark" class:is-good={campaign.expansion.activeShop === s.id}
          >{campaign.expansion.activeShop === s.id ? "You're here" : st ? "Open" : soon ? "Day " + s.day : money(price(s.price))}</span
        >
      </button>
    {/each}
  </div>

  <aside class="lg-detail" aria-live="polite">
    <ShopThumb id={shop.id} width={238} height={134} locked={locked} />
    <h3>{shop.name}</h3>
    {#if RULES[shop.id]}<p>{RULES[shop.id]}</p>{/if}
    <dl class="lg-facts">
      <dt>Rent a week</dt>
      <dd>{money(shop.rent)}</dd>
      <dt>Tickets at once</dt>
      <dd>{shop.slots}</dd>
      {#if next}<dt>Next room</dt><dd>{cap(next.format)}, {next.stars} stars</dd>{/if}
    </dl>
    <div class="lg-actions">
      {#if state}
        <button type="button" class="boba-key is-primary" disabled={live || campaign.expansion.activeShop === shop.id} onclick={() => action("select-shop", { id: shop.id })}
          >{campaign.expansion.activeShop === shop.id ? "You're here" : "Work here"}</button
        >
        {#if next}
          <button
            type="button"
            class="boba-key order-pixel-paper-key"
            disabled={live || state.stars < next.stars || campaign.cash < price(next.price)}
            onclick={() => action("expand", { id: shop.id })}>Add a room, {money(price(next.price))}</button
          >
        {/if}
      {:else}
        <button type="button" class="boba-key is-primary" disabled={live || locked || campaign.cash < price(shop.price)} onclick={() => action("buy-shop", { id: shop.id })}
          >{locked ? "Opens on day " + shop.day : "Buy it, " + money(price(shop.price))}</button
        >
      {/if}
    </div>

    {#if shop.id === "truck" && state}
      <div class="field">
        <span>Today's stop</span>
        <div class="lg-chips" role="group" aria-label="Truck stop">
          {#each STOPS as stop (stop)}
            <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={campaign.expansion.truckStop === stop} disabled={live} onclick={() => action("truck-stop", { id: stop })}>{cap(stop)}</button>
          {/each}
        </div>
      </div>
    {/if}

    {#if shop.id === "commissary" && state && targets.length && items.length}
      <div class="field">
        <span>Send the van</span>
        <div class="stepper">
          <button type="button" class="boba-key order-pixel-paper-key" aria-label="Previous shop" onclick={() => (routeTo = (routeTo - 1 + targets.length) % targets.length)}>‹</button>
          <b>To {targets[routeTo % targets.length].name}</b>
          <button type="button" class="boba-key order-pixel-paper-key" aria-label="Next shop" onclick={() => (routeTo = (routeTo + 1) % targets.length)}>›</button>
        </div>
        <div class="stepper">
          <button type="button" class="boba-key order-pixel-paper-key" aria-label="Previous ingredient" onclick={() => (routeItem = (routeItem - 1 + items.length) % items.length)}>‹</button>
          <b><Icon art={items[routeItem % items.length].art} size={20} />{items[routeItem % items.length].name}</b>
          <button type="button" class="boba-key order-pixel-paper-key" aria-label="Next ingredient" onclick={() => (routeItem = (routeItem + 1) % items.length)}>›</button>
        </div>
        <button
          type="button"
          class="boba-key order-pixel-paper-key"
          disabled={live}
          onclick={() => action("route", { to: targets[routeTo % targets.length].id, ingredient: items[routeItem % items.length].id })}>Load 8 on the van</button
        >
        {#each campaign.expansion.routes as planned, i (i)}
          <div class="route">
            <Icon art={INGREDIENTS.find((x) => x.id === planned.ingredient)?.art} size={20} />
            <span>{planned.quantity} to {SHOPS.find((x) => x.id === planned.to)?.name}</span>
            <button
              type="button"
              class="boba-key order-pixel-paper-key"
              disabled={planned.progress >= 1 || campaign.day < vanDay}
              title={campaign.day < vanDay ? "The van opens on day " + vanDay : undefined}
              onclick={() => action("drive", { to: planned.to })}>{planned.progress >= 1 ? "Delivered" : "Drive it"}</button
            >
          </div>
        {/each}
      </div>
    {/if}
  </aside>
</div>

<style>
  .shop-row {
    min-height: 52px !important;
  }

  .stars {
    display: inline-flex;
    gap: 3px;
  }

  .stars i {
    width: 7px;
    height: 7px;
    box-shadow: inset 0 0 0 1.5px var(--bk-rule-strong);
    transform: rotate(45deg);
  }

  .stars i.on {
    background: var(--b-gold);
    box-shadow: none;
  }

  .field {
    display: grid;
    gap: 6px;
  }

  .field > span {
    color: var(--bk-muted);
    font-size: 0.75rem;
  }

  .field .lg-chips {
    margin: 0;
  }

  .stepper {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 6px;
  }

  .stepper b {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    overflow: hidden;
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .route {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px;
    font-size: 0.8125rem;
  }
</style>
