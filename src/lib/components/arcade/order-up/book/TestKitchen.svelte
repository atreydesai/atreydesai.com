<script lang="ts">
  // The test kitchen's page: cheats to reach any part of the game, as rows of
  // keys, the day first since every test starts by choosing one. Only the
  // test slot on a development host shows it.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { VIEWS } from "#lib/arcade/order-up/content/index.ts";
  import { CHEAT_CASH, CHEAT_DAYS, LAST_DAY } from "#lib/arcade/order-up/engine/cheats.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import OrderPixelWord from "../../OrderPixelWord.svelte";
  export let campaign: Campaign;
  export let action: (name: string, data?: any) => void = () => {};
  export let live = false;
  const cheat = (name: string, value?: number | string) => action("cheat", { name, value });
  let target = 15;
  const go = () => cheat("day", Math.max(1, Math.min(LAST_DAY, Math.round(Number(target) || 1))));
  const ACTIVITIES = [
    ["delivery", "Delivery"],
    ["chore", "Chores"],
    ["tasteoff", "Taste-off"],
    ["garden", "Garden"],
    ["lab", "Tasting bench"],
    ["batch", "Pearl batch"],
  ] as const;
</script>

<div class="test-page">
  <p class="bk-note">Cheats change this slot only. Your own saves are untouched.</p>

  <section class="bk-section" aria-label="Day">
    <div class="bk-cap"><OrderPixelWord text="Day" cells={2} /><span class="bk-meta">between shifts only</span></div>
    <div class="bk-keys">
      {#each CHEAT_DAYS as day (day)}
        <button type="button" class="boba-key key" disabled={live} aria-pressed={campaign.day === day} onclick={() => cheat("day", day)}>Day {day}</button>
      {/each}
    </div>
    <div class="bk-keys">
      <button type="button" class="boba-key key" disabled={live || campaign.day <= 1} onclick={() => cheat("day", campaign.day - 1)}>Previous day</button>
      <button type="button" class="boba-key key" disabled={live} onclick={() => cheat("day", campaign.day + 1)}>Next day</button>
      <form class="go" onsubmit={(e) => (e.preventDefault(), go())}>
        <label for="test-day-to">Day</label>
        <input id="test-day-to" type="number" min="1" max={LAST_DAY} bind:value={target} disabled={live} />
        <button type="submit" class="boba-key key" disabled={live}>Go</button>
      </form>
    </div>
  </section>

  <div class="pair">
    <section class="bk-section" aria-label="Till">
      <div class="bk-cap"><OrderPixelWord text="Till" cells={2} /></div>
      <div class="bk-keys">
        {#each CHEAT_CASH as amount (amount)}
          <button type="button" class="boba-key key" onclick={() => cheat("cash", amount)}>Add {money(amount)}</button>
        {/each}
      </div>
    </section>

    <section class="bk-section" aria-label="Unlock">
      <div class="bk-cap"><OrderPixelWord text="Unlock" cells={2} /></div>
      <div class="bk-keys">
        <button type="button" class="boba-key key" disabled={live} onclick={() => cheat("shops")}>Open every shop</button>
        <button type="button" class="boba-key key" onclick={() => cheat("stock")}>Stock the pantry</button>
        <button type="button" class="boba-key key" onclick={() => cheat("collection")}>Whole collection</button>
      </div>
    </section>
  </div>

  <section class="bk-section" aria-label="Shift">
    <div class="bk-cap"><OrderPixelWord text="Shift" cells={2} /><span class="bk-meta">{live ? "" : "open the shop to use these"}</span></div>
    <div class="bk-keys">
      <button type="button" class="boba-key key" disabled={!live} onclick={() => cheat("finish-cup")}>Finish this cup</button>
      <button type="button" class="boba-key key" disabled={!live} onclick={() => cheat("finish-all")}>Finish every cup</button>
      <button type="button" class="boba-key key" disabled={!live} onclick={() => cheat("patience")}>Refill patience</button>
      <button type="button" class="boba-key key" disabled={!live} onclick={() => cheat("time")}>Add a minute</button>
      <button type="button" class="boba-key key" disabled={!live} onclick={() => cheat("end")}>End the day now</button>
    </div>
  </section>

  <section class="bk-section" aria-label="Go to">
    <div class="bk-cap"><OrderPixelWord text="Go to" cells={2} /></div>
    <div class="bk-keys" role="group" aria-label="Places">
      {#each VIEWS as v (v.id)}
        <button type="button" class="boba-key key" onclick={() => cheat("view", v.id)}>{v.name}</button>
      {/each}
    </div>
    <div class="bk-keys" role="group" aria-label="Activities">
      {#each ACTIVITIES as [kind, label] (kind)}
        <button type="button" class="boba-key key" disabled={live && kind !== "delivery"} onclick={() => cheat("activity", kind)}>{label}</button>
      {/each}
    </div>
  </section>

  <section class="bk-section" aria-label="Start over">
    <div class="bk-cap"><OrderPixelWord text="Start over" cells={2} /></div>
    <div class="bk-keys">
      <button type="button" class="boba-key key" onclick={() => cheat("reset")}>New test kitchen on day 1</button>
    </div>
  </section>
</div>

<style>
  .test-page {
    display: grid;
    gap: 18px;
    align-content: start;
  }

  .pair {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 18px 32px;
  }

  .key {
    min-height: 34px;
  }

  .go {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 12px;
  }

  .go label {
    color: var(--lg-muted);
    font-size: 13px;
  }

  .go input {
    width: 4.5rem;
    height: 34px;
    padding: 0 10px;
    border: 0;
    color: var(--lg-text);
    background: var(--lg-chip);
    box-shadow: inset 0 0 0 1.5px var(--lg-line);
    font: inherit;
    font-size: 13px;
    clip-path: var(--notch);
  }

  .go input:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--lg-cream);
  }

  .go input:disabled {
    opacity: 0.45;
  }

  @media (max-width: 760px) {
    .pair {
      grid-template-columns: minmax(0, 1fr);
    }

    .go {
      margin-left: 0;
    }
  }
</style>
