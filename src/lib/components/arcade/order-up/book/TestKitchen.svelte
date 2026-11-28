<script lang="ts">
  // The test kitchen's page in the shop book: cheats to reach any part of
  // the game. Only the test slot on a development host shows it.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { VIEWS } from "#lib/arcade/order-up/content/index.ts";
  import { CHEAT_CASH, CHEAT_DAYS } from "#lib/arcade/order-up/engine/cheats.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  export let campaign: Campaign;
  export let action: (name: string, data?: any) => void = () => {};
  export let live = false;
  const cheat = (name: string, value?: number | string) => action("cheat", { name, value });
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
  <p class="test-note">Cheats change this slot only. Your own saves are untouched.</p>

  <section aria-labelledby="test-till">
    <div class="lg-rubric"><h3 id="test-till">Till</h3></div>
    <div class="row">
      {#each CHEAT_CASH as amount (amount)}
        <button type="button" class="boba-key order-pixel-paper-key" onclick={() => cheat("cash", amount)}>Add {money(amount)}</button>
      {/each}
    </div>
  </section>

  <section aria-labelledby="test-day">
    <div class="lg-rubric"><h3 id="test-day">Day</h3></div>
    <p>Jumping ahead opens everything that day has. Between shifts only.</p>
    <div class="row">
      {#each CHEAT_DAYS as day (day)}
        <button
          type="button"
          class="boba-key order-pixel-paper-key"
          disabled={live}
          class:is-current={campaign.day === day}
          aria-pressed={campaign.day === day}
          onclick={() => cheat("day", day)}>Day {day}</button
        >
      {/each}
      <button type="button" class="boba-key order-pixel-paper-key" disabled={live} onclick={() => cheat("day", campaign.day + 1)}>Next day</button>
    </div>
  </section>

  <section aria-labelledby="test-unlock">
    <div class="lg-rubric"><h3 id="test-unlock">Unlock</h3></div>
    <div class="row">
      <button type="button" class="boba-key order-pixel-paper-key" disabled={live} onclick={() => cheat("shops")}>Open every shop</button>
      <button type="button" class="boba-key order-pixel-paper-key" onclick={() => cheat("stock")}>Stock the pantry</button>
      <button type="button" class="boba-key order-pixel-paper-key" onclick={() => cheat("collection")}>Whole collection</button>
    </div>
  </section>

  <section aria-labelledby="test-shift">
    <div class="lg-rubric"><h3 id="test-shift">Shift</h3></div>
    {#if !live}<p>Open the shop to use these.</p>{/if}
    <div class="row">
      <button type="button" class="boba-key order-pixel-paper-key" disabled={!live} onclick={() => cheat("finish-cup")}>Finish this cup</button>
      <button type="button" class="boba-key order-pixel-paper-key" disabled={!live} onclick={() => cheat("finish-all")}>Finish every cup</button>
      <button type="button" class="boba-key order-pixel-paper-key" disabled={!live} onclick={() => cheat("patience")}>Refill patience</button>
      <button type="button" class="boba-key order-pixel-paper-key" disabled={!live} onclick={() => cheat("time")}>Add a minute</button>
      <button type="button" class="boba-key order-pixel-paper-key" disabled={!live} onclick={() => cheat("end")}>End the shift</button>
    </div>
  </section>

  <section aria-labelledby="test-places">
    <div class="lg-rubric"><h3 id="test-places">Go to</h3></div>
    <div class="row">
      {#each VIEWS as v (v.id)}
        <button type="button" class="boba-key order-pixel-paper-key" onclick={() => cheat("view", v.id)}>{v.name}</button>
      {/each}
    </div>
    <div class="row">
      {#each ACTIVITIES as [kind, label] (kind)}
        <button type="button" class="boba-key order-pixel-paper-key" disabled={live && kind !== "delivery"} onclick={() => cheat("activity", kind)}>{label}</button>
      {/each}
    </div>
  </section>
</div>

<style>
  .test-page {
    display: grid;
    gap: var(--space-6);
  }

  .test-note {
    margin: 0;
  }

  section {
    display: grid;
    gap: var(--space-2);
  }

  section :global(.lg-rubric) {
    margin: 0;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .row :global(.boba-key) {
    min-height: 34px;
  }

  .test-page .row :global(.boba-key.is-current) {
    --key-face: var(--bk-ink);
    --key-rule: var(--bk-ink);
    color: var(--bk-paper);
  }
</style>
