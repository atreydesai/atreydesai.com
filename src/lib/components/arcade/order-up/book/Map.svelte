<script lang="ts">
  // The shops as tiles, each shown by its own room: the ones you run first
  // (the one you're in filled orange), then the ones to buy. The picked one is
  // written up beside them, with its keys pinned to the panel's foot so they
  // never move. The truck's stop and the commissary's van come last, once
  // those shops are yours, so nothing below them can shift.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { SHOPS, INGREDIENTS, VIEWS } from "#lib/arcade/order-up/content/index.ts";
  import { listedShops } from "#lib/arcade/order-up/engine/opened.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { TUNING } from "#lib/arcade/order-up/engine/tuning.ts";
  import OrderPixelWord from "../../OrderPixelWord.svelte";
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
  // Yours in the game's own order (so "Work here" never reshuffles them), then the rest by the day they open.
  $: listed = listedShops(campaign);
  $: owned = listed.filter((s) => campaign.expansion.shops[s.id]);
  $: forSale = listed.filter((s) => !campaign.expansion.shops[s.id]).sort((a, b) => a.day - b.day);
  $: shop = SHOPS.find((s) => s.id === picked) ?? SHOPS.find((s) => s.id === campaign.expansion.activeShop) ?? SHOPS[0];
  $: state = campaign.expansion.shops[shop.id];
  $: locked = shop.day > campaign.day;
  $: next = state && state.expansion < 3 ? shop.expansions[state.expansion] : null;
  $: here = campaign.expansion.activeShop === shop.id;
  $: targets = SHOPS.filter((s) => campaign.expansion.shops[s.id] && s.id !== "commissary");
  $: items = INGREDIENTS.filter((i) => i.day <= campaign.day);
  $: truck = !!campaign.expansion.shops.truck;
  $: van = !!campaign.expansion.shops.commissary && targets.length > 0 && items.length > 0;
  $: target = targets[routeTo % Math.max(1, targets.length)];
  $: item = items[routeItem % Math.max(1, items.length)];
</script>

{#snippet chevron(back: boolean)}<svg class="chev" width="8" height="14" viewBox="0 0 4 7" shape-rendering="crispEdges" aria-hidden="true"
    ><path d={back ? "M3 0h1v1H3zM2 1h2v1H2zM1 2h2v1H1zM0 3h2v1H0zM1 4h2v1H1zM2 5h2v1H2zM3 6h1v1H3z" : "M0 0h1v1H0zM0 1h2v1H0zM1 2h2v1H1zM2 3h2v1H2zM1 4h2v1H1zM0 5h2v1H0zM0 6h1v1H0z"} fill="currentColor" /></svg
  >{/snippet}

<div class="shops">
  <div class="pick">
    <section class="bk-section" aria-label="Your shops">
      <div class="bk-cap"><OrderPixelWord text="Shops" cells={2} /><span class="bk-meta">{open.length} of {SHOPS.length} open</span></div>
      <div class="bk-tiles is-fill grid">
        {#each owned as s (s.id)}
          {@const st = campaign.expansion.shops[s.id]}
          {@const active = campaign.expansion.activeShop === s.id}
          <button
            type="button"
            class="bk-tile tile"
            class:is-on={shop.id === s.id && !active}
            class:is-fill={active}
            aria-pressed={shop.id === s.id}
            onclick={() => (picked = s.id)}
          >
            <span class="pic"><ShopThumb id={s.id} width={128} height={72} /></span>
            <span class="nm"><span class="bk-name">{s.name}</span></span>
            <span class="stars"
              >{#each [1, 2, 3, 4, 5] as n (n)}<i class:on={st.stars >= n}></i>{/each}<span class="sr-only">{st.stars} of 5 stars</span></span
            >
            <span class="bk-lbl">{active ? "You're here" : st.expansion + 1 + " of 4 rooms"}</span>
          </button>
        {/each}
      </div>
    </section>

    {#if forSale.length}
      <section class="bk-section" aria-label="For sale">
        <div class="bk-cap"><OrderPixelWord text="For sale" cells={2} /></div>
        <div class="bk-tiles is-fill grid">
          {#each forSale as s (s.id)}
            {@const soon = s.day > campaign.day}
            <button type="button" class="bk-tile tile sale" class:is-on={shop.id === s.id} aria-pressed={shop.id === s.id} onclick={() => (picked = s.id)}>
              <span class="pic"><ShopThumb id={s.id} width={128} height={72} locked={soon} /></span>
              <span class="nm"><span class="bk-name">{s.name}</span></span>
              {#if soon}<span class="bk-lbl fact">Day {s.day}</span>{:else}<span class="bk-mid fact">{money(price(s.price))}</span>{/if}
            </button>
          {/each}
        </div>
      </section>
    {/if}
  </div>

  <aside class="panel" aria-live="polite" aria-label={shop.name}>
    <span class="pic big"><ShopThumb id={shop.id} width={276} height={132} {locked} /></span>
    <h3 class="title">{shop.name}</h3>
    <p class="rule">{RULES[shop.id] ?? ""}</p>
    <dl class="facts">
      <div><dt>Rent a week</dt><dd>{money(shop.rent)}</dd></div>
      <div><dt>Tickets at once</dt><dd>{shop.slots}</dd></div>
      {#if state}<div><dt>Rooms</dt><dd>{state.expansion + 1} of 4</dd></div>{/if}
      {#if next}<div><dt>Next room</dt><dd>{cap(next.format)}, {next.stars} {next.stars === 1 ? "star" : "stars"}</dd></div>{/if}
    </dl>
    <div class="acts">
      {#if state}
        <button type="button" class="boba-key is-primary" disabled={live || here} onclick={() => action("select-shop", { id: shop.id })}
          >{here ? "You're here" : "Work here"}</button
        >
        {#if next}
          <button
            type="button"
            class="boba-key"
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
  </aside>

  {#if truck || van}
    <div class="extra">
      {#if truck}
        <section class="bk-section" aria-label="Truck stop">
          <div class="bk-cap"><OrderPixelWord text="Truck" cells={2} /><span class="bk-meta">today's stop</span></div>
          <div class="bk-keys" role="group" aria-label="Truck stop">
            {#each STOPS as stop (stop)}
              <button
                type="button"
                class="boba-key key"
                aria-pressed={campaign.expansion.truckStop === stop}
                disabled={live}
                onclick={() => action("truck-stop", { id: stop })}>{cap(stop)}</button
              >
            {/each}
          </div>
        </section>
      {/if}

      {#if van}
        <section class="bk-section" aria-label="Send the van">
          <div class="bk-cap"><OrderPixelWord text="Van" cells={2} /><span class="bk-meta">send the van</span></div>
          <div class="load">
            <div class="stepper">
              <button type="button" class="boba-key key" aria-label="Previous ingredient" onclick={() => (routeItem = (routeItem - 1 + items.length) % items.length)}>{@render chevron(true)}</button>
              <b><Icon art={item.art} size={20} /><span>{item.name}</span></b>
              <button type="button" class="boba-key key" aria-label="Next ingredient" onclick={() => (routeItem = (routeItem + 1) % items.length)}>{@render chevron(false)}</button>
            </div>
            <div class="stepper">
              <button type="button" class="boba-key key" aria-label="Previous shop" onclick={() => (routeTo = (routeTo - 1 + targets.length) % targets.length)}>{@render chevron(true)}</button>
              <b><span>To {target.name}</span></b>
              <button type="button" class="boba-key key" aria-label="Next shop" onclick={() => (routeTo = (routeTo + 1) % targets.length)}>{@render chevron(false)}</button>
            </div>
            <button type="button" class="boba-key key" disabled={live} onclick={() => action("route", { to: target.id, ingredient: item.id })}>Load 8 on the van</button>
          </div>
          {#if campaign.expansion.routes.length}
            <div class="bk-tiles is-fill" style:--min="150px">
              {#each campaign.expansion.routes as planned, i (i)}
                <div class="bk-tile route">
                  <span class="pic small"><Icon art={INGREDIENTS.find((x) => x.id === planned.ingredient)?.art} size={32} /></span>
                  <span class="nm"><span class="bk-name">{planned.quantity} to {SHOPS.find((x) => x.id === planned.to)?.name}</span></span>
                  <button
                    type="button"
                    class="boba-key is-small"
                    disabled={planned.progress >= 1 || campaign.day < vanDay}
                    title={campaign.day < vanDay ? "The van opens on day " + vanDay : undefined}
                    onclick={() => action("drive", { to: planned.to })}>{planned.progress >= 1 ? "Delivered" : "Drive it"}</button
                  >
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .shops {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    /* The panel spans both rows; the last row is flexible, so it takes the panel's extra height and the truck and van sit right under the shops. */
    grid-template-rows: auto 1fr;
    gap: 16px 18px;
    align-items: start;
  }

  .pick {
    display: grid;
    grid-column: 1;
    grid-row: 1;
    gap: 14px;
    min-width: 0;
  }

  .extra {
    display: grid;
    grid-column: 1;
    grid-row: 2;
    gap: 14px;
    min-width: 0;
  }

  .grid {
    --min: 150px;
  }

  /* A shop tile: its room, its name on two fixed lines, then its facts, all on the same lines across a row. */
  /* Doubled classes: the board's shared rules carry the book's own scope, so these must outweigh them. */
  .shops .tile.bk-tile {
    grid-template-rows: 72px 30px 10px 14px;
    align-content: start;
    gap: 6px;
    padding: 10px 8px 12px;
  }

  .shops .tile.bk-tile.sale {
    grid-template-rows: 72px 30px 18px;
  }

  .pic {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 72px;
    overflow: hidden;
  }

  .pic.big {
    height: 132px;
  }

  .pic.small {
    height: 36px;
  }

  .nm {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 30px;
    overflow: hidden;
  }

  .nm .bk-name.bk-name {
    display: -webkit-box;
    overflow: hidden;
    line-height: 15px;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .fact {
    display: flex;
    align-items: center;
    height: 18px;
  }

  .stars {
    display: flex;
    gap: 5px;
    align-items: center;
    height: 10px;
  }

  .stars i {
    width: 7px;
    height: 7px;
    box-shadow: inset 0 0 0 1.5px var(--lg-line);
    transform: rotate(45deg);
  }

  .stars i.on {
    background: var(--lg-cream);
    box-shadow: none;
  }

  .tile.is-on .stars i {
    box-shadow: inset 0 0 0 1.5px #c9b48d;
  }

  .tile.is-on .stars i.on {
    background: #2b1f20;
    box-shadow: none;
  }

  .tile.is-fill .stars i {
    box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.45);
  }

  .tile.is-fill .stars i.on {
    background: #fff;
    box-shadow: none;
  }

  /* The picked shop, written up beside the tiles: a fixed box with its keys at the foot. */
  .panel {
    position: sticky;
    top: 0;
    display: grid;
    grid-column: 2;
    grid-row: 1 / span 2;
    grid-template-rows: 132px auto 34px minmax(0, 1fr) auto;
    gap: 8px;
    height: 430px;
    padding: 12px;
    overflow: hidden;
    background: var(--lg-chip);
    clip-path: var(--notch);
  }

  .title {
    margin: 4px 0 0;
    overflow: hidden;
    color: var(--lg-cream);
    font: 700 20px/1.15 var(--font-display);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .rule {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    color: var(--lg-muted);
    font-size: 13px;
    line-height: 17px;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .facts {
    display: grid;
    align-content: start;
    gap: 5px;
    margin: 0;
    overflow: hidden;
    font-size: 13px;
  }

  .facts div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .facts dt {
    color: var(--lg-muted);
  }

  .facts dd {
    margin: 0;
    color: var(--lg-cream);
    text-align: right;
  }

  /* Two key rows, always: the first never moves when the second is absent. */
  .acts {
    display: grid;
    grid-template-rows: 36px 36px;
    gap: 6px;
  }

  .acts .boba-key {
    min-height: 36px;
  }

  .key {
    min-height: 34px;
  }

  .load {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
  }

  .stepper {
    display: grid;
    grid-template-columns: 34px 10rem 34px;
    align-items: center;
    gap: 6px;
  }

  .stepper .key {
    padding: 0 0 4px;
  }

  .chev {
    display: block;
    flex: none;
  }

  .stepper b {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    color: var(--lg-text);
    font-size: 13px;
    font-weight: 500;
  }

  .stepper b span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .shops .route.bk-tile {
    grid-template-rows: 36px 30px 28px;
    align-content: start;
    gap: 6px;
    padding: 10px 8px 12px;
  }

  @media (max-width: 900px) {
    .shops {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: none;
    }

    .pick,
    .extra,
    .panel {
      grid-column: 1;
      grid-row: auto;
    }

    .panel {
      position: static;
    }
  }

  @media (max-width: 760px) {
    .stepper {
      grid-template-columns: 34px minmax(0, 1fr) 34px;
      width: 100%;
    }
  }
</style>
