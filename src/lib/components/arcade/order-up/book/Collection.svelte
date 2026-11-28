<script lang="ts">
  // The album: recipes served, regulars met, badges earned and decor kept,
  // as pages of tiles with the picked one written up beside them.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { FAMILIES, GUESTS, DECOR, BADGES, INGREDIENT_BY_ID, RECIPE_BY_ID } from "#lib/arcade/order-up/content/index.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { albumRecipes, albumRegulars, albumBadges, albumDecor } from "#lib/arcade/order-up/engine/opened.ts";
  import Icon from "../Icon.svelte";
  import Portrait from "../Portrait.svelte";
  import Cup from "../Cup.svelte";
  export let campaign: Campaign;
  export let live = false;
  export let action: (name: string, data?: any) => void = () => {};
  type Page = "recipes" | "regulars" | "badges" | "decor";
  let page: Page = "recipes";
  let filter = "all";
  let query = "";
  let index = 0;
  let picked = "";
  const perPage = 24;
  const PAGES: [Page, string][] = [
    ["recipes", "Recipes"],
    ["regulars", "Regulars"],
    ["badges", "Badges"],
    ["decor", "Decor"],
  ];
  const KINDS = ["decor", "paint", "print", "apron", "keepsake", "cat"];
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  $: q = query.toLowerCase();
  // Each page holds what is open so far (engine/opened.ts), so the album grows with the shop.
  $: entries = {
    recipes: albumRecipes(campaign),
    regulars: albumRegulars(campaign),
    badges: albumBadges(campaign),
    decor: albumDecor(campaign),
  };
  $: list =
    page === "recipes"
      ? entries.recipes.filter((r) => (filter === "all" || r.family === filter) && r.name.toLowerCase().includes(q)).map((r) => r.id)
      : page === "regulars"
        ? entries.regulars.filter((g) => g.name.toLowerCase().includes(q)).map((g) => g.id)
        : page === "badges"
          ? entries.badges.filter((b) => b.name.toLowerCase().includes(q)).map((b) => b.id)
          : entries.decor.filter((d) => (filter === "all" || d.kind === filter) && d.name.toLowerCase().includes(q)).map((d) => d.id);
  $: pages = Math.max(1, Math.ceil(list.length / perPage));
  $: shown = list.slice(index * perPage, index * perPage + perPage);
  $: found =
    page === "recipes"
      ? Object.keys(campaign.expansion.recipes).length
      : page === "regulars"
        ? Object.keys(campaign.expansion.visits).length
        : page === "badges"
          ? campaign.expansion.badges.length
          : campaign.expansion.decor.length + campaign.expansion.keepsakes.length;
  $: total = entries[page].length;
  $: pick = picked && list.includes(picked) ? picked : (shown[0] ?? "");
  $: recipe = page === "recipes" ? RECIPE_BY_ID[pick] : undefined;
  $: guest = page === "regulars" ? GUESTS.find((g) => g.id === pick) : undefined;
  $: badge = page === "badges" ? BADGES.find((b) => b.id === pick) : undefined;
  $: decor = page === "decor" ? DECOR.find((d) => d.id === pick) : undefined;
  $: ownsDecor = !!decor && (campaign.expansion.decor.includes(decor.id) || campaign.expansion.keepsakes.includes(decor.id) || campaign.expansion.prints.includes(decor.id));
  /** What a tile is called aloud, found or not. */
  function tileName(id: string) {
    if (page === "recipes") return campaign.expansion.recipes[id] ? RECIPE_BY_ID[id].name : "Recipe not served yet";
    if (page === "regulars") return campaign.expansion.visits[id] ? (GUESTS.find((g) => g.id === id)?.name ?? id) : "Regular not met yet";
    if (page === "badges") return BADGES.find((b) => b.id === id)?.name ?? id;
    return DECOR.find((d) => d.id === id)?.name ?? id;
  }

  function change(p: Page) {
    page = p;
    filter = "all";
    query = "";
    index = 0;
    picked = "";
  }
</script>

<div class="lg-title">
  <h2>Album</h2>
  <span>{found} of {total} found</span>
</div>

<div class="lg-chips" role="group" aria-label="Album page">
  {#each PAGES as [id, label] (id)}
    <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={page === id} onclick={() => change(id)}>{label}</button>
  {/each}
  <span class="gap"></span>
  <input class="lg-find" type="search" placeholder="Find" aria-label={"Find " + page} bind:value={query} oninput={() => (index = 0)} />
</div>

{#if page === "recipes" || page === "decor"}
  <div class="lg-chips filters" role="group" aria-label={page === "recipes" ? "Family" : "Kind"}>
    <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={filter === "all"} onclick={() => ((filter = "all"), (index = 0))}>All</button>
    {#if page === "recipes"}
      {#each FAMILIES.filter((f) => f.day <= campaign.day) as f (f.id)}
        <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={filter === f.id} onclick={() => ((filter = f.id), (index = 0))}>{cap(f.name)}</button>
      {/each}
    {:else}
      {#each KINDS as k (k)}
        <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={filter === k} onclick={() => ((filter = k), (index = 0))}>{cap(k)}</button>
      {/each}
    {/if}
  </div>
{/if}

<div class="lg-split">
  <div>
    <div class="album">
      {#each shown as id (id)}
        <button type="button" class="tile" class:is-picked={pick === id} aria-pressed={pick === id} aria-label={tileName(id)} onclick={() => (picked = id)}>
          {#if page === "recipes"}
            {@const r = RECIPE_BY_ID[id]}
            {@const record = campaign.expansion.recipes[id]}
            {#if record}<Cup recipe={id} size={40} />{:else}<span class="unknown">?</span>{/if}
            <span class="tile-name" class:muted={!record}>{record ? r.name : r.day > campaign.day ? "Day " + r.day : ""}</span>
          {:else if page === "regulars"}
            {@const g = GUESTS.find((x) => x.id === id)!}
            {@const visits = campaign.expansion.visits[id] ?? 0}
            <span class:faded={!visits}><Portrait name={id} size={40} /></span>
            <span class="tile-name">{visits ? g.name : ""}</span>
          {:else if page === "badges"}
            {@const b = BADGES.find((x) => x.id === id)!}
            {@const earned = campaign.expansion.badges.includes(id)}
            <span class:faded={!earned}><Icon art={b.art} size={36} /></span>
            <span class="tile-name">{b.name}</span>
          {:else}
            {@const d = DECOR.find((x) => x.id === id)!}
            <span class:faded={d.day > campaign.day}><Icon art={d.art} size={36} /></span>
            <span class="tile-name">{d.name}</span>
          {/if}
        </button>
      {:else}
        <p class="lg-empty">Nothing by that name.</p>
      {/each}
    </div>
    <div class="pager">
      <button type="button" class="boba-key order-pixel-paper-key" disabled={index === 0} aria-label="Previous page" onclick={() => index--}>‹</button>
      <span>Page {index + 1} of {pages}</span>
      <button type="button" class="boba-key order-pixel-paper-key" disabled={index + 1 >= pages} aria-label="Next page" onclick={() => index++}>›</button>
    </div>
  </div>

  <aside class="lg-detail" aria-live="polite">
    {#if recipe}
      {@const record = campaign.expansion.recipes[recipe.id]}
      <div class="art">{#if record}<Cup recipe={recipe.id} size={84} />{:else}<span class="unknown big">?</span>{/if}</div>
      <h3>{record ? recipe.name : "Not served yet"}</h3>
      {#if record}
        <dl class="lg-facts">
          <dt>Served</dt>
          <dd>{record.count}</dd>
          <dt>Best grade</dt>
          <dd>{record.best}</dd>
        </dl>
        <div class="ingredients">
          {#each recipe.ingredients as item (item.id)}<span title={INGREDIENT_BY_ID[item.id].name}><Icon art={INGREDIENT_BY_ID[item.id].art} size={24} />{item.quantity}</span>{/each}
        </div>
      {:else}
        <p>{recipe.day > campaign.day ? "On the menu from day " + recipe.day + "." : "Serve it once to add it here."}</p>
      {/if}
    {:else if guest}
      {@const visits = campaign.expansion.visits[guest.id] ?? 0}
      <div class="art"><span class:faded={!visits}><Portrait name={guest.id} size={72} /></span></div>
      <h3>{visits ? guest.name : "Not met yet"}</h3>
      {#if visits}
        <dl class="lg-facts">
          <dt>Visits</dt>
          <dd>{visits}</dd>
          <dt>Their usual</dt>
          <dd>{RECIPE_BY_ID[guest.favorite]?.name ?? ""}</dd>
        </dl>
        <div class="story">
          {#each guest.story as beat, i (i)}<span class:found={visits > i}>{visits > i ? beat.prop.replaceAll("-", " ") : "?"}</span>{/each}
        </div>
      {/if}
    {:else if badge}
      {@const have = campaign.expansion.metrics[badge.metric] ?? 0}
      <div class="art"><Icon art={badge.art} size={56} /></div>
      <h3>{badge.name}</h3>
      <div class="bar" aria-label={Math.min(badge.target, have) + " of " + badge.target}><i style:width="{Math.min(100, (have / badge.target) * 100)}%"></i></div>
      <p class="lg-num">{Math.min(badge.target, have)} of {badge.target}</p>
    {:else if decor}
      <div class="art"><Icon art={decor.art} size={56} /></div>
      <h3>{decor.name}</h3>
      <dl class="lg-facts">
        <dt>Kind</dt>
        <dd>{cap(decor.kind)}</dd>
        {#if decor.comfort}<dt>Comfort</dt><dd>+{decor.comfort}</dd>{/if}
        {#if decor.style}<dt>Style</dt><dd>+{decor.style}</dd>{/if}
      </dl>
      {#if ownsDecor}
        <button
          type="button"
          class="boba-key is-primary"
          disabled={live}
          onclick={() => action(["paint", "apron", "print", "cat"].includes(decor.kind) ? "equip-decor" : "place-from-book", { id: decor.id })}
          >{decor.kind === "decor" || decor.kind === "keepsake" ? "Place it" : "Use it"}</button
        >
      {:else}
        <button
          type="button"
          class="boba-key is-primary"
          disabled={live || decor.day > campaign.day || decor.kind === "keepsake" || campaign.cash < decor.price}
          onclick={() => action("buy-decor", { id: decor.id })}
          >{decor.kind === "keepsake" ? "A regular's gift" : decor.day > campaign.day ? "Day " + decor.day : "Buy it, " + money(decor.price)}</button
        >
      {/if}
    {/if}
  </aside>
</div>

<style>
  .gap {
    flex: 1;
  }

  .filters {
    max-height: 5.5rem;
    overflow-y: auto;
  }

  .album {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
    gap: 6px;
    min-height: 22rem;
    align-content: start;
  }

  .tile {
    display: grid;
    grid-template-rows: 48px auto;
    justify-items: center;
    align-items: center;
    gap: 4px;
    height: 6.5rem;
    padding: 8px 6px;
    border: 0;
    color: var(--bk-text);
    background: var(--bk-raised);
    box-shadow: inset 0 0 0 1px var(--bk-rule);
    font: inherit;
    cursor: pointer;
    clip-path: var(--notch);
  }

  .tile.is-picked {
    background: var(--bk-wash-2);
    box-shadow:
      inset 0 0 0 2px var(--b-accent),
      inset 0 -3px var(--b-accent);
  }

  .tile:focus-visible {
    outline: 2px solid var(--b-accent);
    outline-offset: -2px;
  }

  @media (hover: hover) {
    .tile:not(.is-picked):hover {
      box-shadow: inset 0 0 0 1.5px var(--bk-ink);
    }
  }

  .tile-name {
    display: -webkit-box;
    width: 100%;
    overflow: hidden;
    font-size: 0.75rem;
    line-height: 1.25;
    text-align: center;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .muted {
    color: var(--bk-muted);
  }

  .faded {
    opacity: 0.35;
    filter: grayscale(1);
  }

  .unknown {
    display: grid;
    place-items: center;
    width: 30px;
    height: 40px;
    color: var(--bk-muted);
    font-weight: 700;
    box-shadow: inset 0 0 0 1.5px var(--bk-rule-strong);
  }

  .unknown.big {
    width: 56px;
    height: 80px;
    font-size: 1.5rem;
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    margin-top: var(--space-3);
    color: var(--bk-muted);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }

  .pager span {
    min-width: 7rem;
    text-align: center;
  }

  .art {
    display: grid;
    place-items: center;
    height: 96px;
    background: var(--bk-wash);
  }

  .ingredients {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 0.75rem;
  }

  .ingredients span {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .story {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .story span {
    padding: 2px 6px;
    color: var(--bk-muted);
    font-size: 0.75rem;
    box-shadow: inset 0 0 0 1px var(--bk-rule-strong);
  }

  .story span.found {
    color: var(--bk-ink);
  }
</style>
