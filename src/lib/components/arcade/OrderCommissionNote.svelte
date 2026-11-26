<script lang="ts">
  import type { CommissionOffer } from "#lib/arcade/orders-commissions.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import OrderKitchenItem from "./OrderKitchenItem.svelte";

  interface Props {
    offer: CommissionOffer;
    count: number | null;
    onAccept?: () => void;
    compact?: boolean;
  }

  let { offer, count, onAccept, compact = false }: Props = $props();
  const ready = $derived(count !== null && count >= offer.target);
</script>

<section class:compact class:ready aria-label="Neighborhood commission">
  <OrderKitchenItem kind={offer.icon} size={compact ? 24 : 32} lit={ready} />
  <div class="brief">
    <h3>{offer.name}</h3>
    {#if !compact && !ready}
      <p>{offer.goal}</p>
    {/if}
    {#if count !== null}
      <span class="progress" role="meter" aria-label="Commission orders" aria-valuemin="0" aria-valuenow={count} aria-valuemax={offer.target}>
        {#each Array(offer.target) as _, index}
          <i class:filled={index < count} aria-hidden="true"></i>
        {/each}
        <span aria-hidden="true">{count}/{offer.target}</span>
      </span>
    {/if}
    {#if !compact}
      <div class="note-bottom">
        {#if ready}<p class="deadline">Complete</p>
        {:else}<p class="deadline"><span>By day {offer.deadline}</span><strong>+{money(offer.reward)}</strong></p>{/if}
        {#if onAccept && count === null}
          <button class="boba-key order-pixel-paper-key" type="button" aria-label="Take commission" onclick={onAccept}>Take</button>
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  section {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px 8px;
    padding: 7px 9px;
    background: #d9d6ad;
    color: #4c4837;
    clip-path: var(--notch);
    box-shadow: inset 0 -2px #b5a983;
  }
  .brief { flex: 1 1 8rem; min-width: 0; }
  h3 { margin: 0; color: #424632; font: inherit; font-weight: 600; font-size: .85rem; line-height: 1.1; }
  p { margin: 3px 0 0; font-size: .75rem; line-height: 1.25; }
  .note-bottom { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 2px 8px; }
  .deadline { display: flex; flex-wrap: wrap; gap: 0 8px; color: #655947; }
  .deadline strong { color: #47543c; font-weight: 600; }
  .progress { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 2px; min-height: 16px; margin: 2px 0 0; font-size: .76rem; font-variant-numeric: tabular-nums; }
  .progress i { width: 7px; height: 7px; border: 1px solid #92876a; background: #ede3bd; }
  .progress i.filled { border-color: #59694d; background: #7b9366; }
  .progress span { padding-inline-start: 3px; }
  .ready { background: #d2dbad; }
  .compact { flex-wrap: nowrap; padding: 4px 7px; }
  .compact .brief { flex: 0 1 auto; }
  .compact h3 { font-size: .75rem; }
  .compact .progress { margin: 0; }
  button.boba-key { min-width: 56px; min-height: 40px; padding: 4px 7px; font-size: .76rem; }
</style>
