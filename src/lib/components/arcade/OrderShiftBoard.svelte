<script lang="ts">
  import type { ShiftContractProgress } from "#lib/arcade/orders-challenges.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import OrderKitchenItem from "./OrderKitchenItem.svelte";

  interface Props {
    contracts: readonly ShiftContractProgress[];
    compact?: boolean;
  }

  let { contracts, compact = false }: Props = $props();
</script>

{#if contracts.length}
  <section class:compact aria-label="Shift contracts">
    {#if !compact}<h3>Shift contracts</h3>{/if}
    <ul>
      {#each contracts as contract (contract.id)}
        <li class:complete={contract.complete}>
          <OrderKitchenItem kind={contract.icon} size={compact ? 16 : 23} />
          <span class="goal">{contract.text}</span>
          <span class="count" aria-label={contract.complete ? "Complete" : `${contract.count} of ${contract.target}`}>
            {contract.count}/{contract.target}
          </span>
          {#if !compact}<span class="reward">+{money(contract.reward)}</span>{/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  section {
    color: #49362f;
    background: #f4e1b9;
    clip-path: var(--notch);
    padding: .55rem .65rem;
  }

  h3 {
    color: #5f4235;
    font: inherit;
    font-weight: 500;
    margin: 0 0 .3rem;
  }

  ul {
    padding: 0;
    margin: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: .42rem;
    align-items: center;
    padding: .25rem 0;
    line-height: 1.23;
    font-size: .76rem;
  }

  .count, .reward {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    white-space: nowrap;
  }

  .complete .count {
    color: #33583b;
    background: #d9dfb3;
    padding-inline: .18rem;
  }

  .compact {
    padding: .2rem .4rem;
  }

  .compact li {
    grid-template-columns: auto minmax(0, 1fr) auto;
    font-size: .66rem;
  }
</style>
