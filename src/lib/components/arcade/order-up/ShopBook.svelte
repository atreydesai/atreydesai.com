<script lang="ts">
  // The shop book, kept as a ledger: a wood-framed board of dark tiles with
  // coloured bookmarks along its top, one per chapter, and the shop's receipt
  // tucked against its left edge where a page has one (yesterday's close on
  // Today, what's on the way on the Pantry). The day, the till and Close sit
  // across the top of the board; files, the status line and the primary key
  // along its foot. Every part keeps its place as chapters change, so nothing
  // jumps under the hand. Its colours are its own, the same in either theme.
  import { onMount } from "svelte";
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { chapters, chapterIsNew, DAILY_DAY } from "#lib/arcade/order-up/engine/opened.ts";
  import { bookIcon } from "#lib/arcade/order-up/art/view-icons.ts";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import "./slip.css";
  import "./motion.css";
  import OrderPixelWord from "../OrderPixelWord.svelte";
  import Today from "./book/Today.svelte";
  import Pantry from "./book/Pantry.svelte";
  import Workshop from "./book/Workshop.svelte";
  import Crew from "./book/Crew.svelte";
  import Map from "./book/Map.svelte";
  import Collection from "./book/Collection.svelte";
  import TestKitchen from "./book/TestKitchen.svelte";
  import Receipt from "./book/Receipt.svelte";
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
  /** Each chapter's bookmark colour, from the game's palette. */
  const COLORS: Record<string, string> = {
    today: "#c9462f",
    pantry: "#b7832f",
    workshop: "#4f7f78",
    crew: "#5e8a4f",
    map: "#4a6a9a",
    collection: "#7a5a8e",
    test: "#6b5a52",
  };
  // Chapters appear as their first content opens (engine/opened.ts); a
  // chapter asked for before then opens Today instead.
  $: tabs = [...chapters(campaign), ...(cheats ? ["test"] : [])];
  $: if (!tabs.includes(tab)) tab = "today";
  $: today = calendar(campaign.day);
  $: dailyOpen = campaign.day >= DAILY_DAY || Object.keys(campaign.expansion.dailyBests).length > 0;
  $: slip = tab === "today" || tab === "pantry" ? tab : "";
  let heading: HTMLHeadingElement;
  let paper: HTMLElement;
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
  <div class="shop-book" role="dialog" aria-modal="true" aria-labelledby="book-title">
    <!-- The receipt's column is kept on every page, so the book never moves sideways. -->
    <aside class="book-tuck" aria-label="Receipt">
      {#if slip}<div class="tucked"><Receipt {campaign} kind={slip} /></div>{/if}
    </aside>
    <div class="book-main">
      <nav class="book-tabs" aria-label="Ledger">
        {#each tabs as id, i (id)}
          {@const icon = bookIcon(id)}
          <button
            type="button"
            class="index-tab"
            class:is-current={tab === id}
            style:--tab={COLORS[id]}
            data-book-tab={id}
            aria-current={tab === id ? "page" : undefined}
            onclick={() => setTab(id)}
            onkeydown={(e) => onTabKey(e, i)}
            ><PixelIcon grid={icon.grid} palette={icon.palette} px={2} /><OrderPixelWord text={NAMES[id]} cells={2} /><span class="sr-only"
              >{NAMES[id]}</span
            >{#if chapterIsNew(campaign, id)}<b class="tab-new">New</b>{/if}</button
          >
        {/each}
      </nav>
      <div class="book-frame">
        <div class="book-board">
          <header class="book-header">
            <span class="book-day" aria-hidden="true">{campaign.day}</span>
            <div class="book-title">
              <h1 id="book-title" tabindex="-1" bind:this={heading}><span class="sr-only">Day {campaign.day}, </span>{today.event.name}</h1>
              <p class="book-lede">{today.event.description}</p>
            </div>
            <div class="book-till"><span class="sr-only">In the till </span><strong>{money(campaign.cash)}</strong></div>
            <button type="button" class="boba-key close-book" onclick={close}>Close<kbd>Esc</kbd></button>
          </header>
          <main class="book-paper" bind:this={paper}>
            {#if slip}<div class="tuck-inline"><Receipt {campaign} kind={slip} /></div>{/if}
            {#key tab}<div class="chapter ou-arrive">{#if tab === "today"}<Today {campaign} {live} {action} />{:else if tab === "pantry"}<Pantry
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
              />{:else}<Collection {campaign} {live} {action} />{/if}</div>{/key}
          </main>
          <footer class="book-footer">
            <div class="book-files">
              <button type="button" class="boba-key is-small" onclick={() => action("saves")}>Saves</button>
              <button type="button" class="boba-key is-small" onclick={() => action("export")}>Export</button>
              <button type="button" class="boba-key is-small" disabled={live} onclick={() => action("import")}>Import</button>
            </div>
            <span class="book-notice" role="status">{notice}</span>
            <button
              type="button"
              class="boba-key daily"
              class:is-gone={!dailyOpen}
              disabled={!dailyOpen || live || campaign.status === "closed"}
              onclick={() => action("daily")}>Daily shift</button
            >
            <button
              type="button"
              class="boba-key is-primary open-shop"
              onclick={() => (live ? action("resume") : action("open"))}
              disabled={campaign.status === "closed"}>{live ? "Back to the shift" : "Open the shop"}</button
            >
          </footer>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .book-scrim {
    z-index: 4;
    padding: max(var(--space-3), env(safe-area-inset-top)) var(--space-3) max(var(--space-3), env(safe-area-inset-bottom));
  }

  /* The ledger's own colours, the same in either theme. */
  .shop-book {
    --lg-board: #241d1f;
    --lg-chip: #332a2c;
    --lg-chip-2: #3d3335;
    --lg-chip-3: #4a3e40;
    --lg-line: #4d4144;
    --lg-cream: #ffe7b8;
    --lg-text: #e9dccb;
    --lg-muted: #a8968a;
    --lg-orange: #c9462f;
    --lg-orange-foot: #7f2a1c;
    --lg-orange-hi: #e0664d;
    --lg-wood: #7a4b35;
    --lg-wood-hi: #9b6448;
    --lg-wood-lo: #55311f;
    --lg-slip: #fbf8f1;
    --lg-slip-ink: #232020;
    --lg-slip-muted: #857c74;
    --lg-slip-rule: #cfc7bc;
    --lg-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;

    display: grid;
    grid-template-columns: 196px minmax(0, 1fr);
    width: min(1240px, 100%);
    /* Tied to the window, so a long page scrolls inside the board instead of growing the book. */
    height: min(820px, calc(100dvh - 2 * var(--space-3)));
    max-height: 100%;
    color: var(--lg-text);
    font-family: var(--font-ui);
    font-variant-numeric: lining-nums tabular-nums;
  }

  .book-tuck {
    position: relative;
    min-width: 0;
  }

  .tucked {
    position: absolute;
    top: 100px;
    right: -14px;
    left: 8px;
    z-index: 2;
    transform: rotate(-2.2deg);
  }

  .tuck-inline {
    display: none;
  }

  .book-main {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
  }

  /* Bookmarks along the top: the current one stands taller, joined to the board. */
  .book-tabs {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 58px;
    padding: 0 28px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .index-tab {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    gap: 7px;
    height: 44px;
    padding: 0 12px 6px;
    border: 0;
    color: var(--lg-cream);
    background: var(--tab);
    box-shadow:
      inset 0 3px rgb(255 255 255 / 0.22),
      inset 0 -3px rgb(0 0 0 / 0.25);
    clip-path: var(--notch);
    cursor: pointer;
  }

  .index-tab.is-current {
    height: 56px;
    padding-bottom: 12px;
  }

  @media (hover: hover) {
    .index-tab:not(.is-current):hover {
      filter: brightness(1.12);
    }
  }

  .index-tab:focus-visible {
    outline: 2px solid var(--lg-cream);
    outline-offset: -4px;
  }

  .index-tab :global(.pixel-icon) {
    flex: none;
  }

  .tab-new {
    position: absolute;
    top: -2px;
    right: 6px;
    padding: 2px 4px;
    color: #fff;
    background: var(--lg-orange);
    font: 600 9px/1 var(--font-ui);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .book-frame {
    position: relative;
    display: grid;
    min-height: 0;
    padding: 12px;
    background: var(--lg-wood);
    box-shadow:
      inset 0 3px var(--lg-wood-hi),
      inset 0 -6px var(--lg-wood-lo),
      inset 3px 0 var(--lg-wood-hi),
      inset -3px 0 var(--lg-wood-lo);
    clip-path: polygon(6px 0, calc(100% - 6px) 0, calc(100% - 6px) 3px, calc(100% - 3px) 3px, calc(100% - 3px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 3px) calc(100% - 6px), calc(100% - 3px) calc(100% - 3px), calc(100% - 6px) calc(100% - 3px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 3px), 3px calc(100% - 3px), 3px calc(100% - 6px), 0 calc(100% - 6px), 0 6px, 3px 6px, 3px 3px, 6px 3px);
  }

  .book-board {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 12px;
    min-height: 0;
    padding: 14px 18px 12px;
    background: var(--lg-board);
    box-shadow: inset 0 0 0 2px var(--lg-line);
  }

  .book-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 16px;
  }

  .book-day {
    color: var(--lg-cream);
    font: 700 34px/1 var(--font-display);
    letter-spacing: -0.02em;
  }

  .book-title {
    min-width: 0;
  }

  .book-header h1 {
    margin: 0;
    overflow: hidden;
    color: var(--lg-text);
    font: 500 15px/1.25 var(--font-ui);
    white-space: nowrap;
    text-overflow: ellipsis;
    outline: none;
  }

  .book-lede {
    margin: 2px 0 0;
    overflow: hidden;
    color: var(--lg-muted);
    font-size: 14px;
    line-height: 1.3;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .book-till strong {
    color: var(--lg-cream);
    font: 700 30px/1 var(--font-display);
    letter-spacing: -0.015em;
  }

  .close-book {
    min-height: 36px;
  }

  .book-header kbd {
    padding: 1px 4px;
    font: 500 10px/1.2 var(--font-ui);
    opacity: 0.7;
    box-shadow: inset 0 0 0 1px currentColor;
  }

  .book-paper {
    min-width: 0;
    min-height: 0;
    padding-right: 4px;
    overflow-y: auto;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: var(--lg-line) transparent;
  }

  .book-footer {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    min-height: 44px;
  }

  .book-files {
    display: flex;
    gap: 6px;
  }

  .book-files .boba-key {
    min-height: 32px;
  }

  .book-notice {
    min-width: 0;
    overflow: hidden;
    color: var(--lg-muted);
    font-size: 13px;
    text-align: right;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .daily {
    min-height: 36px;
  }

  .daily.is-gone {
    visibility: hidden;
  }

  .open-shop {
    min-width: 11rem;
    min-height: 42px;
    font-size: 15px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  /* Narrower windows: a slimmer receipt column. */
  @media (max-width: 1100px) {
    .shop-book {
      grid-template-columns: 160px minmax(0, 1fr);
    }

    .tucked {
      top: 92px;
      left: 4px;
    }
  }

  /* A phone: the book fills the screen, the bookmarks scroll, and the receipt sits at the top of the page. */
  @media (max-width: 760px) {
    .book-scrim {
      padding: 0;
    }

    .shop-book {
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
      height: 100dvh;
    }

    .book-tuck {
      display: none;
    }

    .tuck-inline {
      display: block;
      max-width: 320px;
      margin: 4px auto 14px;
    }

    .book-tabs {
      height: 50px;
      padding: 0 10px;
    }

    .index-tab {
      height: 38px;
    }

    .index-tab.is-current {
      height: 48px;
    }

    .book-frame {
      padding: 6px;
    }

    .book-board {
      padding: 10px 10px 8px;
    }

    .book-header {
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 10px;
    }

    .book-till {
      display: none;
    }

    .book-day {
      font-size: 28px;
    }

    /* Two rows on a phone: the files and the daily shift, then the primary key across the width. */
    .book-footer {
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 8px;
    }

    .book-notice {
      display: none;
    }

    .daily {
      grid-column: 3;
      min-height: 32px;
    }

    .open-shop {
      grid-column: 1 / -1;
      min-width: 0;
    }
  }

  /* ---- The board's vocabulary: shared by every page ---------------------- */

  /* Keys on the board are the game's own dark keys; a chosen one turns cream. */
  .shop-book :global(.boba-key[aria-pressed="true"]) {
    --key-face: var(--lg-cream);
    --key-foot: #c9b48d;
    --key-rule: transparent;
    color: #2b1f20;
  }

  .shop-book :global(.boba-key.is-small) {
    min-height: 28px;
    padding: 0 9px 3px;
    font-size: 12px;
  }

  .shop-book :global(.boba-key:disabled) {
    opacity: 0.45;
    cursor: default;
  }

  /* A section: a pixel-lettered cap over its tiles. */
  .shop-book :global(.bk-section) {
    display: grid;
    align-content: start;
    gap: 8px;
  }

  .shop-book :global(.bk-cap) {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 14px;
    color: var(--lg-muted);
  }

  .shop-book :global(.bk-cap .order-pixel-word) {
    color: var(--lg-muted);
  }

  .shop-book :global(.bk-meta) {
    color: var(--lg-muted);
    font: 500 12px/1 var(--font-ui);
  }

  .shop-book :global(.bk-grow) {
    flex: 1;
  }

  .shop-book :global(.bk-keys) {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .shop-book :global(.bk-tiles) {
    display: grid;
    grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr));
    gap: 8px;
  }

  .shop-book :global(.bk-tiles.is-fill) {
    grid-template-columns: repeat(auto-fill, minmax(var(--min, 112px), 1fr));
  }

  /* A tile: a notched dark chip, its picture above its words. */
  .shop-book :global(.bk-tile) {
    position: relative;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 6px;
    min-width: 0;
    padding: 10px 8px;
    border: 0;
    color: var(--lg-text);
    background: var(--lg-chip);
    font: inherit;
    text-align: center;
    clip-path: var(--notch);
  }

  .shop-book :global(button.bk-tile) {
    cursor: pointer;
  }

  @media (hover: hover) {
    .shop-book :global(button.bk-tile:hover:not(:disabled)) {
      background: var(--lg-chip-2);
    }
  }

  /* Pressed, a tile sinks a pixel, as the game's keys sink into their foot. */
  .shop-book :global(button.bk-tile:active:not(:disabled)) {
    transform: translateY(2px);
    filter: brightness(0.94);
  }

  .shop-book :global(button.bk-tile:focus-visible) {
    outline: 2px solid var(--lg-cream);
    outline-offset: -2px;
  }

  /* A tile that can't be picked keeps its box and dims what's on it. */
  .shop-book :global(.bk-tile:disabled) {
    cursor: default;
  }

  .shop-book :global(.bk-tile:disabled > *) {
    opacity: 0.42;
  }

  .shop-book :global(.bk-big) {
    color: var(--lg-cream);
    font: 700 24px/1 var(--font-display);
  }

  .shop-book :global(.bk-mid) {
    color: var(--lg-cream);
    font: 700 18px/1 var(--font-display);
  }

  .shop-book :global(.bk-name) {
    max-width: 100%;
    color: var(--lg-text);
    font: 500 13px/1.15 var(--font-ui);
  }

  .shop-book :global(.bk-lbl) {
    color: var(--lg-muted);
    font: 400 12px/1.15 var(--font-ui);
  }

  /* Chosen: cream. Needs you: an orange edge. The day's one or two main things: orange. */
  .shop-book :global(.bk-tile.is-on) {
    background: var(--lg-cream);
  }

  .shop-book :global(.bk-tile.is-on :is(.bk-big, .bk-mid, .bk-name, .bk-lbl)) {
    color: #2b1f20;
  }

  .shop-book :global(.bk-tile.is-hot) {
    box-shadow: inset 0 0 0 2px var(--lg-orange);
  }

  .shop-book :global(.bk-tile.is-fill) {
    background: var(--lg-orange);
    box-shadow: inset 0 -3px var(--lg-orange-foot);
  }

  .shop-book :global(.bk-tile.is-fill :is(.bk-big, .bk-mid, .bk-name, .bk-lbl)) {
    color: #fff;
  }

  .shop-book :global(.bk-tally) {
    display: flex;
    gap: 2px;
  }

  .shop-book :global(.bk-tally i) {
    width: 7px;
    height: 5px;
    background: var(--lg-line);
  }

  .shop-book :global(.bk-tally i.on) {
    background: var(--lg-cream);
  }

  .shop-book :global(.bk-note) {
    margin: 0;
    color: var(--lg-muted);
    font-size: 13px;
  }

  .shop-book :global(.bk-empty) {
    padding: 16px 0;
    color: var(--lg-muted);
    font-size: 14px;
    text-align: center;
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
    color: var(--lg-muted);
    font: 500 11px/1 var(--font-ui);
    box-shadow: inset 0 0 0 1px var(--lg-line);
  }
</style>
