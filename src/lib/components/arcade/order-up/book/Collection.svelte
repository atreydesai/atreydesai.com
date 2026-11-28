<script lang="ts">
  // The album: recipes served, regulars met, badges earned and decor kept, as
  // pages of tiles with the picked one written up beside them. Every page of
  // tiles keeps the size of a full one, and the filter row keeps its place on
  // every album page, so nothing moves as pages turn.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { FAMILIES, GUESTS, DECOR, BADGES, INGREDIENT_BY_ID, RECIPE_BY_ID } from "#lib/arcade/order-up/content/index.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { albumRecipes, albumRegulars, albumBadges, albumDecor } from "#lib/arcade/order-up/engine/opened.ts";
  import OrderPixelWord from "../../OrderPixelWord.svelte";
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
  const marks = (n: number, of: number) => Array.from({ length: 10 }, (_, i) => i < Math.round((Math.min(n, of) / of) * 10));
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

{#snippet chevron(back: boolean)}<svg class="chev" width="8" height="14" viewBox="0 0 4 7" shape-rendering="crispEdges" aria-hidden="true"
    ><path d={back ? "M3 0h1v1H3zM2 1h2v1H2zM1 2h2v1H1zM0 3h2v1H0zM1 4h2v1H1zM2 5h2v1H2zM3 6h1v1H3z" : "M0 0h1v1H0zM0 1h2v1H0zM1 2h2v1H1zM2 3h2v1H2zM1 4h2v1H1zM0 5h2v1H0zM0 6h1v1H0z"} fill="currentColor" /></svg
  >{/snippet}

<section class="bk-section album" aria-label="Album">
  <!-- The caption, the album's pages and the pager on one line; the filters and the search under them. The
       pager sits at the right edge with a fixed width, and the filter row keeps its height on every album
       page, empty where a page has no filter, so nothing moves as pages turn. -->
  <div class="bar">
    <div class="bk-cap head"><OrderPixelWord text="Album" cells={2} /></div>
    <div class="bk-keys pages" role="group" aria-label="Album page">
      {#each PAGES as [id, label] (id)}
        <button type="button" class="boba-key key" aria-pressed={page === id} onclick={() => change(id)}>{label}</button>
      {/each}
    </div>
    <span class="bk-meta count">{found} of {total} found</span>
    <div class="pager">
      <button type="button" class="boba-key key step" disabled={index === 0} aria-label="Previous page" onclick={() => index--}>{@render chevron(true)}</button>
      <span>Page {index + 1} of {pages}</span>
      <button type="button" class="boba-key key step" disabled={index + 1 >= pages} aria-label="Next page" onclick={() => index++}>{@render chevron(false)}</button>
    </div>
    <div class="filters">
      {#if page === "recipes" || page === "decor"}
        <div class="bk-keys" role="group" aria-label={page === "recipes" ? "Family" : "Kind"}>
          <button type="button" class="boba-key is-small" aria-pressed={filter === "all"} onclick={() => ((filter = "all"), (index = 0))}>All</button>
          {#if page === "recipes"}
            {#each FAMILIES.filter((f) => f.day <= campaign.day) as f (f.id)}
              <button type="button" class="boba-key is-small" aria-pressed={filter === f.id} onclick={() => ((filter = f.id), (index = 0))}>{cap(f.name)}</button>
            {/each}
          {:else}
            {#each KINDS as k (k)}
              <button type="button" class="boba-key is-small" aria-pressed={filter === k} onclick={() => ((filter = k), (index = 0))}>{cap(k)}</button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
    <input class="find" type="search" placeholder="Find" aria-label={"Find " + page} bind:value={query} oninput={() => (index = 0)} />
  </div>

  <div class="body">
    <div class="pick">
      <div class="grid">
        {#each shown as id (id)}
          <button
            type="button"
            class="bk-tile tile"
            class:is-on={pick === id}
            aria-pressed={pick === id}
            aria-label={tileName(id)}
            title={tileName(id)}
            onclick={() => (picked = id)}
          >
            {#if page === "recipes"}
              {@const r = RECIPE_BY_ID[id]}
              {@const record = campaign.expansion.recipes[id]}
              <span class="pic">{#if record}<Cup recipe={id} size={30} />{:else}<span class="unknown">?</span>{/if}</span>
              <span class="nm">{#if record}<span class="bk-name">{r.name}</span>{:else}<span class="bk-lbl">{r.day > campaign.day ? "Day " + r.day : ""}</span>{/if}</span>
            {:else if page === "regulars"}
              {@const g = GUESTS.find((x) => x.id === id)!}
              {@const visits = campaign.expansion.visits[id] ?? 0}
              <span class="pic" class:faded={!visits}><Portrait name={id} size={42} /></span>
              <span class="nm"><span class="bk-name">{visits ? g.name : ""}</span></span>
            {:else if page === "badges"}
              {@const b = BADGES.find((x) => x.id === id)!}
              {@const earned = campaign.expansion.badges.includes(id)}
              <span class="pic" class:faded={!earned}><Icon art={b.art} size={38} /></span>
              <span class="nm"><span class="bk-name">{b.name}</span></span>
            {:else}
              {@const d = DECOR.find((x) => x.id === id)!}
              <span class="pic" class:faded={d.day > campaign.day}><Icon art={d.art} size={38} /></span>
              <span class="nm"><span class="bk-name">{d.name}</span></span>
            {/if}
          </button>
        {:else}
          <p class="bk-empty none">Nothing by that name.</p>
        {/each}
      </div>
    </div>

    <aside class="panel" aria-live="polite">
      {#if recipe}
        {@const record = campaign.expansion.recipes[recipe.id]}
        <div class="art">{#if record}<Cup recipe={recipe.id} size={60} />{:else}<span class="unknown big">?</span>{/if}</div>
        <h3 class="title">{record ? recipe.name : "Not served yet"}</h3>
        <div class="facts">
          {#if record}
            <div class="minis">
              <span class="mini"><span class="bk-mid">{record.count}</span><span class="bk-lbl">served</span></span>
              <span class="mini"><span class="bk-mid">{record.best}</span><span class="bk-lbl">best grade</span></span>
            </div>
            <div class="ingredients">
              {#each recipe.ingredients as ing (ing.id)}<span title={INGREDIENT_BY_ID[ing.id].name}
                  ><Icon art={INGREDIENT_BY_ID[ing.id].art} size={24} />{ing.quantity}</span
                >{/each}
            </div>
          {:else}
            <p class="bk-note">{recipe.day > campaign.day ? "On the menu from day " + recipe.day + "." : "Serve it once to add it here."}</p>
          {/if}
        </div>
      {:else if guest}
        {@const visits = campaign.expansion.visits[guest.id] ?? 0}
        <div class="art" class:faded={!visits}><Portrait name={guest.id} size={80} /></div>
        <h3 class="title">{visits ? guest.name : "Not met yet"}</h3>
        <div class="facts">
          {#if visits}
            <div class="minis">
              <span class="mini"><span class="bk-mid">{visits}</span><span class="bk-lbl">visits</span></span>
              <span class="mini wide"><span class="bk-name">{RECIPE_BY_ID[guest.favorite]?.name ?? ""}</span><span class="bk-lbl">their usual</span></span>
            </div>
            <div class="story">
              {#each guest.story as beat, i (i)}<span class:found={visits > i}>{visits > i ? beat.prop.replaceAll("-", " ") : "?"}</span>{/each}
            </div>
          {/if}
        </div>
      {:else if badge}
        {@const have = campaign.expansion.metrics[badge.metric] ?? 0}
        <div class="art" class:faded={!campaign.expansion.badges.includes(badge.id)}><Icon art={badge.art} size={64} /></div>
        <h3 class="title">{badge.name}</h3>
        <div class="facts">
          <span class="bk-tally" aria-hidden="true">{#each marks(have, badge.target) as on, k (k)}<i class:on></i>{/each}</span>
          <span class="bk-lbl">{Math.min(badge.target, have)} of {badge.target}</span>
        </div>
      {:else if decor}
        <div class="art"><Icon art={decor.art} size={64} /></div>
        <h3 class="title">{decor.name}</h3>
        <div class="facts">
          <div class="minis">
            <span class="mini"><span class="bk-mid">{cap(decor.kind)}</span><span class="bk-lbl">kind</span></span>
            {#if decor.comfort}<span class="mini"><span class="bk-mid">+{decor.comfort}</span><span class="bk-lbl">comfort</span></span>{/if}
            {#if decor.style}<span class="mini"><span class="bk-mid">+{decor.style}</span><span class="bk-lbl">style</span></span>{/if}
          </div>
        </div>
        <div class="acts">
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
        </div>
      {/if}
    </aside>
  </div>
</section>

<style>
  .find {
    height: 28px;
    padding: 0 10px;
    border: 0;
    color: var(--lg-text);
    background: var(--lg-chip);
    box-shadow: inset 0 0 0 1.5px var(--lg-line);
    font: inherit;
    font-size: 13px;
    clip-path: var(--notch);
  }

  .find::placeholder {
    color: var(--lg-muted);
  }

  .find:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--lg-cream);
  }

  .album {
    container: album / inline-size;
  }

  .key {
    min-height: 34px;
  }

  .bar {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    grid-template-areas:
      "head pages count pager"
      "filters filters filters find";
    gap: 10px 14px;
    align-items: center;
  }

  .head {
    grid-area: head;
  }

  .pages {
    grid-area: pages;
  }

  .count {
    grid-area: count;
    justify-self: end;
    white-space: nowrap;
  }

  .pager {
    grid-area: pager;
  }

  .find {
    grid-area: find;
    align-self: start;
    width: 100%;
  }

  /* Two rows of small keys, always, whatever the page holds. */
  .filters {
    grid-area: filters;
    align-self: start;
    height: 62px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--lg-line) transparent;
  }

  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 18px;
    align-items: start;
  }

  .pick {
    display: grid;
    gap: 8px;
    min-width: 0;
    container-type: inline-size;
  }

  /* A full page is 24 tiles; the grid holds that much room on every page, so the pager never moves. */
  .grid {
    --cols: 4;
    --rows: 6;
    --tile: 100px;
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    grid-auto-rows: var(--tile);
    gap: 8px;
    align-content: start;
    height: calc(var(--rows) * var(--tile) + (var(--rows) - 1) * 8px);
  }

  @container (min-width: 560px) {
    .grid {
      --cols: 6;
      --rows: 4;
    }
  }

  @container (max-width: 260px) {
    .grid {
      --cols: 3;
      --rows: 8;
    }
  }

  /* A tile: its picture in a fixed box, its name on two fixed lines below. */
  /* Doubled classes: the board's shared rules carry the book's own scope, so these must outweigh them. */
  .album .tile.bk-tile {
    grid-template-rows: 52px 28px;
    align-content: center;
    gap: 4px;
    padding: 8px 4px;
  }

  .pic {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 52px;
    overflow: hidden;
  }

  .nm {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 28px;
    overflow: hidden;
  }

  .nm .bk-name.bk-name,
  .nm .bk-lbl.bk-lbl {
    display: -webkit-box;
    overflow: hidden;
    font-weight: 400;
    font-size: 12px;
    line-height: 14px;
    overflow-wrap: break-word;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .none {
    grid-column: 1 / -1;
  }

  .faded {
    opacity: 0.35;
    filter: grayscale(1);
  }

  .unknown {
    display: grid;
    place-items: center;
    width: 30px;
    height: 44px;
    color: var(--lg-muted);
    font-weight: 700;
    box-shadow: inset 0 0 0 1.5px var(--lg-line);
  }

  .tile.is-on .unknown {
    color: #6b5a52;
    box-shadow: inset 0 0 0 1.5px #c9b48d;
  }

  .unknown.big {
    width: 56px;
    height: 84px;
    font-size: 24px;
  }

  .pager {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--lg-muted);
    font-size: 13px;
    white-space: nowrap;
  }

  .pager span {
    width: 6.75rem;
    text-align: center;
  }

  .step {
    width: 34px;
    padding: 0 0 4px;
  }

  .chev {
    display: block;
    flex: none;
  }

  /* The picked entry: a fixed box, as tall as a page of tiles, kept in view while a taller grid scrolls. */
  .panel {
    position: sticky;
    top: 0;
    display: grid;
    grid-template-rows: 110px 46px minmax(0, 1fr) auto;
    gap: 10px;
    height: calc(4 * 100px + 3 * 8px);
    padding: 12px;
    overflow: hidden;
    background: var(--lg-chip);
    clip-path: var(--notch);
  }

  .art {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 110px;
    overflow: hidden;
    background: var(--lg-chip-2);
  }

  .title {
    display: -webkit-box;
    align-self: center;
    margin: 0;
    overflow: hidden;
    color: var(--lg-cream);
    font: 700 18px/23px var(--font-display);
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .facts {
    display: grid;
    align-content: start;
    gap: 12px;
    min-height: 0;
    overflow: hidden;
  }

  /* Figures of any size, their labels on one line. */
  .minis {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 10px 20px;
  }

  .mini {
    display: grid;
    align-content: start;
    gap: 4px;
  }

  .mini.wide {
    flex: 1;
    min-width: 0;
  }

  .ingredients {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    color: var(--lg-text);
    font-size: 12px;
  }

  .ingredients span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .story {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .story span {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 7px;
    color: var(--lg-muted);
    font-size: 12px;
    box-shadow: inset 0 0 0 1px var(--lg-line);
  }

  .story span.found {
    color: var(--lg-cream);
  }

  .acts {
    display: grid;
  }

  .acts .boba-key {
    min-height: 36px;
  }

  @media (max-width: 900px) {
    .body {
      grid-template-columns: minmax(0, 1fr);
    }

    .panel {
      position: static;
      height: 330px;
    }
  }

  /* Too narrow for the caption, the pages, the count and the pager on one line: they stack. */
  @container album (max-width: 719px) {
    .bar {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "head count"
        "pages pages"
        "filters filters"
        "find pager";
    }

    /* The filters have the full width here, and up to three rows of it. */
    .filters {
      height: 96px;
    }
  }

  @media (max-width: 760px) {

    /* Narrow tiles: a little more room for a name's longest word. */
    .album .tile.bk-tile {
      padding: 8px 2px;
    }

    .nm .bk-name.bk-name,
    .nm .bk-lbl.bk-lbl {
      font-size: 11px;
    }

    /* One row of filters that scrolls sideways, inside itself. */
    .filters {
      height: 34px;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .filters .bk-keys.bk-keys {
      flex-wrap: nowrap;
    }

    .filters .boba-key {
      flex: none;
    }
  }
</style>
