<script lang="ts">
  // The shop book, kept like a ledger: the day and its headline across the
  // top, the chapters down the side as index tabs, ruled rows with their
  // column headings written once, and one primary action at the foot. Every
  // part keeps its place as pages change, so nothing jumps under the hand.
  import { onMount } from "svelte";
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { chapters, chapterIsNew } from "#lib/arcade/order-up/engine/opened.ts";
  import { bookIcon } from "#lib/arcade/order-up/art/view-icons.ts";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import OrderPixelWord from "../OrderPixelWord.svelte";
  import Today from "./book/Today.svelte";
  import Pantry from "./book/Pantry.svelte";
  import Workshop from "./book/Workshop.svelte";
  import Crew from "./book/Crew.svelte";
  import Map from "./book/Map.svelte";
  import Collection from "./book/Collection.svelte";
  import TestKitchen from "./book/TestKitchen.svelte";
  export let campaign: Campaign;
  export let tab = "today";
  export let live = false;
  export let notice = "";
  export let action: (name: string, data?: any) => void = () => {};
  export let close: () => void = () => {};
  /** The test kitchen's slot: the book carries its cheats as a last chapter. */
  export let cheats = false;
  const NAMES: Record<string, string> = {
    today: "Today",
    pantry: "Pantry",
    workshop: "Workshop",
    crew: "Crew",
    map: "Shops",
    collection: "Album",
    test: "Testing",
  };
  // Chapters appear as their first content opens (engine/opened.ts); a
  // chapter asked for before then opens Today instead.
  $: tabs = [...chapters(campaign), ...(cheats ? ["test"] : [])];
  $: if (!tabs.includes(tab)) tab = "today";
  let heading: HTMLHeadingElement;
  let paper: HTMLElement;
  $: today = calendar(campaign.day);
  onMount(() => {
    heading?.focus({ preventScroll: true });
  });
  function setTab(id: string) {
    tab = id;
    if (paper) paper.scrollTop = 0;
  }
  function onTabKey(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    setTab(next);
    (document.querySelector(`[data-book-tab="${next}"]`) as HTMLElement | null)?.focus();
  }
</script>

<div class="boba-scrim boba-ui book-scrim">
  <div class="shop-book order-pixel-sheet" role="dialog" aria-modal="true" aria-labelledby="book-title">
    <header class="book-header">
      <div class="book-title">
        <span class="book-day" aria-hidden="true"><OrderPixelWord text={"Day " + campaign.day} cells={2} /></span>
        <h1 id="book-title" tabindex="-1" bind:this={heading}><span class="sr-only">Day {campaign.day}, </span>{today.event.name}</h1>
        <p class="book-lede">{today.event.description}</p>
      </div>
      <div class="book-till">
        <span>In the till</span>
        <strong>{money(campaign.cash)}</strong>
      </div>
      <button type="button" class="boba-key order-pixel-paper-key close-book" onclick={close}>Close<kbd>Esc</kbd></button>
    </header>
    <div class="book-body">
      <nav class="book-index" aria-label="Shop book">
        {#each tabs as id, i (id)}
          {@const icon = bookIcon(id)}
          <button
            type="button"
            class="index-tab"
            class:is-current={tab === id}
            data-book-tab={id}
            aria-current={tab === id ? "page" : undefined}
            onclick={() => setTab(id)}
            onkeydown={(e) => onTabKey(e, i)}
            ><PixelIcon grid={icon.grid} palette={icon.palette} px={2} /><span>{NAMES[id]}</span>{#if chapterIsNew(campaign, id)}<b class="tab-new">New</b>{/if}</button
          >
        {/each}
      </nav>
      <main class="book-paper" bind:this={paper}>
        {#if tab === "today"}<Today {campaign} {live} {action} />{:else if tab === "pantry"}<Pantry
            {campaign}
            {live}
            {action}
          />{:else if tab === "workshop"}<Workshop {campaign} {live} {action} />{:else if tab === "crew"}<Crew
            {campaign}
            {live}
            {action}
          />{:else if tab === "map"}<Map {campaign} {live} {action} />{:else if tab === "test" && cheats}<TestKitchen
            {campaign}
            {live}
            {action}
          />{:else}<Collection {campaign} {live} {action} />{/if}
      </main>
    </div>
    <footer class="book-footer">
      <span class="book-notice" role="status">{notice}</span>
      <div class="book-files">
        <button type="button" class="text-key" onclick={() => action("saves")}>Saves</button>
        <button type="button" class="text-key" onclick={() => action("export")}>Export</button>
        <button type="button" class="text-key" disabled={live} onclick={() => action("import")}>Import</button>
      </div>
      <button
        type="button"
        class="boba-key is-primary open-shop"
        onclick={() => (live ? action("resume") : action("open"))}
        disabled={campaign.status === "closed"}>{live ? "Back to the shift" : "Open the shop"}</button
      >
    </footer>
  </div>
</div>

<style>
  .book-scrim {
    z-index: 4;
    padding: max(var(--space-4), env(safe-area-inset-top)) var(--space-4) max(var(--space-4), env(safe-area-inset-bottom));
  }

  .shop-book {
    --bk-paper: var(--b-paper);
    --bk-raised: var(--b-raised);
    --bk-ink: var(--b-strong);
    --bk-text: var(--b-text);
    --bk-muted: var(--b-muted);
    --bk-rule: color-mix(in srgb, var(--b-line) 16%, var(--b-paper));
    --bk-rule-strong: color-mix(in srgb, var(--b-line) 34%, var(--b-paper));
    --bk-wash: color-mix(in srgb, var(--b-line) 4%, var(--b-paper));
    --bk-wash-2: color-mix(in srgb, var(--b-gold) 12%, var(--b-paper));
    --bk-margin: color-mix(in srgb, var(--b-accent) 40%, var(--b-paper));
    display: flex;
    flex-direction: column;
    width: min(68rem, 100%);
    height: min(52rem, 100%);
    max-height: 100%;
    overflow: hidden;
    color: var(--bk-text);
  }

  .book-header {
    display: grid;
    grid-template-columns: 1fr auto auto;
    flex-shrink: 0;
    align-items: start;
    gap: var(--space-5);
    padding: var(--space-4) var(--space-6) var(--space-3);
    border-bottom: 2px solid var(--bk-rule-strong);
  }

  .book-title {
    min-width: 0;
  }

  .book-day {
    display: block;
    margin-bottom: 8px;
    color: var(--b-gold);
  }

  .book-header h1 {
    margin: 0;
    overflow: hidden;
    color: var(--bk-ink);
    font-family: var(--font-display);
    font-size: clamp(1.625rem, 3vw, 2.25rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
    white-space: nowrap;
    text-overflow: ellipsis;
    outline: none;
  }

  .book-lede {
    margin: 6px 0 0;
    overflow: hidden;
    color: var(--bk-muted);
    font-size: 0.875rem;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .book-till {
    display: grid;
    justify-items: end;
    gap: 2px;
    padding-top: 4px;
  }

  .book-till span {
    color: var(--bk-muted);
    font-size: 0.75rem;
  }

  .book-till strong {
    color: var(--bk-ink);
    font-family: var(--font-display);
    font-size: 1.375rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .close-book {
    min-height: 40px;
  }

  .close-book kbd {
    padding: 0 4px;
    color: var(--bk-muted);
    font: 500 0.6875rem/1.4 var(--font-ui);
    box-shadow: inset 0 0 0 1px var(--bk-rule-strong);
  }

  .book-body {
    display: grid;
    grid-template-columns: 9.5rem 1fr;
    flex: 1;
    min-height: 0;
  }

  /* Index tabs down the margin: the current one pulled out onto the page. */
  .book-index {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-4) 0 var(--space-4) var(--space-4);
    border-right: 2px solid var(--bk-rule-strong);
    overflow-y: auto;
  }

  .index-tab {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 0 12px;
    border: 0;
    color: var(--bk-muted);
    background: none;
    font: 500 0.875rem/1 var(--font-ui);
    text-align: left;
    cursor: pointer;
    clip-path: var(--notch);
  }

  .tab-new {
    margin-left: auto;
    color: var(--b-accent);
    font: 600 0.625rem/1 var(--font-ui);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .index-tab :global(svg) {
    flex: none;
    width: 22px;
    height: 22px;
    opacity: 0.7;
  }

  .index-tab.is-current {
    color: var(--bk-ink);
    background: var(--bk-wash-2);
    box-shadow: inset 3px 0 var(--b-accent);
  }

  .index-tab.is-current :global(svg) {
    opacity: 1;
  }

  @media (hover: hover) {
    .index-tab:not(.is-current):hover {
      color: var(--bk-ink);
      background: var(--bk-wash);
    }
  }

  .index-tab:focus-visible {
    outline: 2px solid var(--b-accent);
    outline-offset: -2px;
  }

  .book-paper {
    min-width: 0;
    min-height: 0;
    padding: var(--space-5) var(--space-6) var(--space-6);
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .book-footer {
    display: grid;
    grid-template-columns: 1fr auto auto;
    flex-shrink: 0;
    align-items: center;
    gap: var(--space-4);
    min-height: 64px;
    padding: var(--space-3) var(--space-6);
    border-top: 2px solid var(--bk-rule-strong);
  }

  .book-notice {
    min-width: 0;
    overflow: hidden;
    color: var(--bk-muted);
    font-size: 0.8125rem;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .book-files {
    display: flex;
    gap: var(--space-3);
  }

  .text-key {
    min-height: 36px;
    padding: 0 4px;
    border: 0;
    color: var(--bk-muted);
    background: none;
    font: 500 0.8125rem/1 var(--font-ui);
    text-decoration: underline;
    text-decoration-color: var(--bk-rule-strong);
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .text-key:disabled {
    opacity: 0.45;
    cursor: default;
  }

  @media (hover: hover) {
    .text-key:not(:disabled):hover {
      color: var(--bk-ink);
    }
  }

  .open-shop {
    min-width: 12rem;
    min-height: 44px;
    font-size: 0.9375rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (max-width: 760px) {
    .book-scrim {
      padding: 0;
    }

    .shop-book {
      height: 100%;
    }

    .book-header {
      grid-template-columns: 1fr auto;
      padding: var(--space-4);
    }

    .book-till {
      display: none;
    }

    .book-body {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }

    .book-index {
      flex-direction: row;
      padding: var(--space-2) var(--space-4) 0;
      border-right: 0;
      border-bottom: 2px solid var(--bk-rule-strong);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .index-tab {
      flex: none;
      padding: 0 10px;
    }

    .index-tab.is-current {
      box-shadow: inset 0 -3px var(--b-accent);
    }

    .index-tab span {
      font-size: 0.8125rem;
    }

    .book-paper {
      padding: var(--space-4);
    }

    .book-footer {
      grid-template-columns: 1fr auto;
      padding: var(--space-3) var(--space-4);
    }

    .book-notice {
      display: none;
    }

    .open-shop {
      min-width: 0;
    }
  }

  /* ---- The ledger: shared by every page ---------------------------------- */

  /* A page's own title line: the chapter's name, and one fact on the right. */
  .shop-book :global(.lg-title) {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    margin: 0 0 var(--space-4);
  }

  .shop-book :global(.lg-title h2) {
    margin: 0;
    color: var(--bk-ink);
    font-family: var(--font-display);
    font-size: 1.625rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  .shop-book :global(.lg-title > span),
  .shop-book :global(.lg-meta) {
    color: var(--bk-muted);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* A rubric over a section: small capitals over a rule. */
  .shop-book :global(.lg-rubric) {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    margin: var(--space-6) 0 var(--space-2);
    padding-bottom: 6px;
    border-bottom: 1px solid var(--bk-rule-strong);
  }

  .shop-book :global(.lg-rubric h3) {
    margin: 0;
    color: var(--bk-ink);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .shop-book :global(.lg-rubric:first-child) {
    margin-top: 0;
  }

  /* Two columns: the ledger, and the picked entry beside it. */
  .shop-book :global(.lg-split) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 17rem;
    gap: var(--space-6);
    align-items: start;
  }

  @media (max-width: 960px) {
    .shop-book :global(.lg-split) {
      grid-template-columns: 1fr;
    }
  }

  /* On a phone a ledger keeps its columns and scrolls sideways within the page. */
  @media (max-width: 760px) {
    .shop-book :global(.lg-table) {
      overflow-x: auto;
      overscroll-behavior-x: contain;
    }

    .shop-book :global(.lg-detail) {
      position: static;
      min-height: 0;
    }
  }

  /* Rows on a grid the page sets with --cols; headings written once. */
  .shop-book :global(.lg-table) {
    display: grid;
    grid-template-columns: var(--cols);
    align-items: center;
  }

  .shop-book :global(.lg-head),
  .shop-book :global(.lg-row) {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    column-gap: var(--space-3);
  }

  .shop-book :global(.lg-head) {
    padding: 0 8px 6px;
    color: var(--bk-muted);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-bottom: 1px solid var(--bk-rule-strong);
  }

  .shop-book :global(.lg-row) {
    min-height: 46px;
    padding: 4px 8px;
    border: 0;
    border-bottom: 1px solid var(--bk-rule);
    color: var(--bk-text);
    background: none;
    font: inherit;
    font-size: 0.875rem;
    text-align: left;
  }

  .shop-book :global(button.lg-row) {
    cursor: pointer;
  }

  @media (hover: hover) {
    .shop-book :global(button.lg-row:hover) {
      background: var(--bk-wash);
    }
  }

  .shop-book :global(.lg-row.is-picked) {
    background: var(--bk-wash-2);
    box-shadow: inset 3px 0 var(--b-accent);
  }

  .shop-book :global(.lg-row.is-dim) {
    color: var(--bk-muted);
  }

  .shop-book :global(.lg-row:focus-visible) {
    outline: 2px solid var(--b-accent);
    outline-offset: -2px;
  }

  .shop-book :global(.lg-name) {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    color: var(--bk-ink);
    font-weight: 500;
  }

  .shop-book :global(.lg-name > span) {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .shop-book :global(.lg-num) {
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }

  .shop-book :global(.lg-mark) {
    color: var(--bk-muted);
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .shop-book :global(.lg-mark.is-warn) {
    color: var(--b-accent);
    font-weight: 600;
  }

  .shop-book :global(.lg-mark.is-good) {
    color: var(--b-gold);
    font-weight: 600;
  }

  /* The picked entry. */
  .shop-book :global(.lg-detail) {
    position: sticky;
    top: 0;
    display: grid;
    gap: var(--space-3);
    min-height: 16rem;
    padding: var(--space-4);
    background: var(--bk-raised);
    box-shadow: inset 0 0 0 1.5px var(--bk-rule-strong);
    clip-path: var(--notch);
  }

  .shop-book :global(.lg-detail h3) {
    margin: 0;
    color: var(--bk-ink);
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.01em;
  }

  .shop-book :global(.lg-detail p) {
    margin: 0;
    color: var(--bk-text);
    font-size: 0.875rem;
    line-height: 1.45;
  }

  .shop-book :global(.lg-facts) {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px var(--space-3);
    margin: 0;
    font-size: 0.8125rem;
  }

  .shop-book :global(.lg-facts dt) {
    color: var(--bk-muted);
  }

  .shop-book :global(.lg-facts dd) {
    margin: 0;
    color: var(--bk-ink);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .shop-book :global(.lg-actions) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .shop-book :global(.lg-actions .boba-key),
  .shop-book :global(.lg-row .boba-key),
  .shop-book :global(.lg-chips .boba-key) {
    min-height: 34px;
  }

  /* Choice chips: short rows of paper keys, the chosen one pressed. */
  .shop-book :global(.lg-chips) {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 var(--space-3);
  }

  .shop-book :global(.lg-chips .boba-key[aria-pressed="true"]) {
    --key-face: var(--bk-ink);
    --key-foot: color-mix(in srgb, var(--bk-ink) 60%, #000);
    --key-rule: var(--bk-ink);
    color: var(--bk-paper);
  }

  .shop-book :global(.lg-find) {
    min-height: 34px;
    padding: 0 10px;
    border: 0;
    color: var(--bk-ink);
    background: var(--bk-raised);
    box-shadow: inset 0 0 0 1.5px var(--bk-rule-strong);
    font: inherit;
    font-size: 0.8125rem;
    clip-path: var(--notch);
  }

  .shop-book :global(.lg-find:focus-visible) {
    outline: 2px solid var(--b-accent);
    outline-offset: -2px;
  }

  .shop-book :global(.lg-note) {
    margin: var(--space-2) 0 0;
    color: var(--bk-muted);
    font-size: 0.8125rem;
  }

  .shop-book :global(.lg-empty) {
    padding: var(--space-6) 0;
    color: var(--bk-muted);
    font-size: 0.875rem;
    text-align: center;
  }

  /* A rubber stamp on an entry: booked, new, in season. */
  .shop-book :global(.stamp) {
    display: inline-block;
    padding: 2px 6px;
    color: var(--b-accent);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    box-shadow: inset 0 0 0 1.5px currentColor;
    transform: rotate(-4deg);
  }

  .shop-book :global(.stamp.is-gold) {
    color: var(--b-gold);
  }

  .shop-book :global(.tally) {
    display: inline-flex;
    gap: 2px;
    vertical-align: middle;
  }

  .shop-book :global(.tally i) {
    width: 3px;
    height: 11px;
    background: var(--bk-rule-strong);
  }

  .shop-book :global(.tally i.on) {
    background: var(--bk-ink);
  }

  .shop-book :global(.bar) {
    position: relative;
    height: 6px;
    background: var(--bk-rule);
  }

  .shop-book :global(.bar > i) {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--b-gold);
  }

  .shop-book :global(.sr-only) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .shop-book :global(.book-paper kbd) {
    padding: 0 3px;
    color: var(--bk-muted);
    font: 500 0.6875rem/1 var(--font-ui);
    box-shadow: inset 0 0 0 1px var(--bk-rule-strong);
  }
</style>
