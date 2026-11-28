<script lang="ts">
  // Order Up opens on its saves: three shops per difficulty, each its own
  // slot, and on a development host a fourth test kitchen with cheats. The
  // first campaign's single save is retired here the first time this opens.
  // Phones and tablets get an under-development card instead: the game is
  // built for a desktop screen, keyboard and mouse for now.
  import { onMount, createEventDispatcher, tick } from "svelte";
  import { get } from "svelte/store";
  import { arcadeExpert } from "#lib/boba.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import {
    LAST_SLOT_KEY,
    PLAYER_SLOTS,
    TEST_SLOT,
    clearSlot,
    readSlots,
    retireOldSaves,
    testSlotAllowed,
    type SlotId,
    type SlotSummary,
  } from "#lib/arcade/order-up/engine/slots.ts";
  import ExpandedCampaign from "./order-up/ExpandedCampaign.svelte";
  import ExpertTag from "./ExpertTag.svelte";
  import "./order-pixel.css";

  const dispatch = createEventDispatcher<{ close: null; menu: null }>();

  let slot: SlotId | null = null;
  let slots: SlotSummary[] = [];
  let testAllowed = false;
  let ready = false;
  let confirming: SlotId | null = null;
  let lastSlot: SlotId = "1";
  let card: HTMLElement;
  const mode = get(arcadeExpert) ? "expert" : "normal";
  /** A touch device, or a window too narrow for the shop. */
  const MOBILE = "(hover: none) and (pointer: coarse), (max-width: 899px)";
  let mobile = false;
  let gateKey: HTMLButtonElement | undefined;

  function storage(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function refresh() {
    const store = storage();
    slots = store ? readSlots(store, mode, testAllowed) : PLAYER_SLOTS.map((id) => ({ slot: id, empty: true, unreadable: false, day: 0, cash: 0, shop: "", midShift: false, savedAt: null }));
  }

  async function focusPicker() {
    await tick();
    if (mobile) return gateKey?.focus();
    const target =
      card?.querySelector<HTMLElement>(`[data-slot="${lastSlot}"] .play`) ?? card?.querySelector<HTMLElement>(".play");
    target?.focus();
  }

  function play(id: SlotId) {
    confirming = null;
    lastSlot = id;
    try {
      storage()?.setItem(LAST_SLOT_KEY, id);
    } catch {
      // Storage can be off; the picker just won't remember.
    }
    slot = id;
  }

  function remove(id: SlotId) {
    const store = storage();
    if (store) clearSlot(store, id, mode);
    confirming = null;
    refresh();
    void focusPicker();
  }

  function backToSaves() {
    slot = null;
    refresh();
    void focusPicker();
  }

  function label(id: SlotId) {
    return id === TEST_SLOT ? "test kitchen" : "shop " + id;
  }

  function onKey(event: KeyboardEvent) {
    if (slot || event.key !== "Escape") return;
    event.preventDefault();
    if (confirming) confirming = null;
    else dispatch("close");
  }

  onMount(() => {
    const query = window.matchMedia(MOBILE);
    mobile = query.matches;
    const follow = (event: MediaQueryListEvent) => (mobile = event.matches);
    query.addEventListener("change", follow);
    const store = storage();
    if (store) retireOldSaves(store);
    testAllowed = testSlotAllowed(window.location.hostname, import.meta.env.DEV);
    try {
      const last = store?.getItem(LAST_SLOT_KEY);
      if (last === "1" || last === "2" || last === "3" || (last === TEST_SLOT && testAllowed)) lastSlot = last;
    } catch {
      // Keep the first slot.
    }
    refresh();
    ready = true;
    void focusPicker();
    return () => query.removeEventListener("change", follow);
  });
</script>

<svelte:window on:keydown={onKey} />

{#if mobile}
  <div class="boba-stage is-paper" aria-hidden="true"></div>
  <div class="boba-scrim boba-ui order-pixel-ui saves-scrim" role="dialog" aria-modal="true" aria-labelledby="mobile-title">
    <div class="boba-card order-pixel-sheet mobile-card">
      <h2 id="mobile-title" class="boba-title">under development</h2>
      <p>Order Up is being built for desktop. Play it on a computer for now.</p>
      <button type="button" class="boba-key is-primary" bind:this={gateKey} onclick={() => dispatch("close")}
        >Back to the arcade</button
      >
    </div>
  </div>
{:else if slot}
  {#key slot}
    <ExpandedCampaign
      {slot}
      cheats={slot === TEST_SLOT && testAllowed}
      on:close={() => dispatch("close")}
      on:menu={() => dispatch("menu")}
      on:saves={backToSaves}
    />
  {/key}
{:else if ready}
  <div class="boba-stage is-paper" aria-hidden="true"></div>
  <div class="boba-scrim boba-ui order-pixel-ui saves-scrim" role="dialog" aria-modal="true" aria-labelledby="saves-title">
    <div bind:this={card} class="boba-card order-pixel-sheet saves-card">
      <header class="saves-header">
        <h2 id="saves-title" class="boba-title">saves</h2>
        {#if mode === "expert"}<ExpertTag />{/if}
        <button type="button" class="boba-key order-pixel-paper-key close" onclick={() => dispatch("close")}
          >Close<kbd aria-hidden="true">Esc</kbd></button
        >
      </header>
      <ul class="slots">
        {#each slots as summary (summary.slot)}
          <li class="slot" class:is-test={summary.slot === TEST_SLOT} data-slot={summary.slot}>
            <div class="slot-text">
              <h3>{label(summary.slot)}</h3>
              {#if summary.unreadable}
                <p>This save can't be read.</p>
              {:else if summary.empty}
                <p>{summary.slot === TEST_SLOT ? "Cheats on. Only here on localhost." : "Empty."}</p>
              {:else}
                <p>
                  Day {summary.day} · {summary.shop} · {money(summary.cash)}{summary.midShift ? " · mid-shift" : ""}
                </p>
              {/if}
            </div>
            <div class="slot-actions">
              {#if confirming === summary.slot}
                <span class="confirm" role="status">Delete this shop?</span>
                <button type="button" class="boba-key is-primary" onclick={() => remove(summary.slot)}>Delete</button>
                <button type="button" class="boba-key order-pixel-paper-key" onclick={() => (confirming = null)}>Keep</button>
              {:else}
                <button
                  type="button"
                  class="boba-key play"
                  class:is-primary={summary.slot === lastSlot}
                  class:order-pixel-paper-key={summary.slot !== lastSlot}
                  onclick={() => play(summary.slot)}
                  >{summary.empty || summary.unreadable ? "New shop" : "Play"}<span class="sr-only"> in {label(summary.slot)}</span></button
                >
                {#if !summary.empty}
                  <button
                    type="button"
                    class="boba-key order-pixel-paper-key"
                    onclick={() => (confirming = summary.slot)}
                    >{summary.slot === TEST_SLOT ? "Reset" : "Delete"}<span class="sr-only"> {label(summary.slot)}</span></button
                  >
                {/if}
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .saves-scrim {
    z-index: calc(var(--layer-overlay) + 4);
  }

  .saves-card {
    width: min(34rem, 100%);
  }

  .mobile-card {
    display: grid;
    gap: var(--space-4);
    width: min(24rem, 100%);
  }

  .mobile-card p {
    margin: 0;
    line-height: 1.45;
  }

  .mobile-card .boba-key {
    justify-self: start;
    min-height: 44px;
    padding-inline: var(--space-4);
  }

  .saves-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .saves-header .close {
    min-height: 40px;
    margin-left: auto;
  }

  .slots {
    display: grid;
    gap: var(--space-3);
    margin: var(--space-6) 0 0;
    padding: 0;
    list-style: none;
  }

  .slot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--b-line) 24%, var(--b-paper));
    clip-path: var(--notch);
  }

  .slot.is-test {
    background: color-mix(in srgb, var(--b-line) 5%, var(--b-paper));
    box-shadow: inset 0 0 0 1.5px var(--b-accent);
  }

  .slot-text {
    min-width: 0;
  }

  .slot h3 {
    margin: 0;
    color: var(--b-strong);
    font-size: 0.9375rem;
    font-weight: 500;
    line-height: 1.3;
  }

  .slot p {
    margin: 2px 0 0;
    color: var(--b-muted);
    font-size: 0.8125rem;
    line-height: 1.4;
  }

  .slot-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .slot-actions .boba-key {
    min-height: 40px;
  }

  .confirm {
    color: var(--b-strong);
    font-size: 0.8125rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
