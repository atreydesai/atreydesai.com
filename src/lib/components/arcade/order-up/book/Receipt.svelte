<script lang="ts">
  // The shop's own thermal paper, in two places only: yesterday's close
  // beside Today, and what is on the way beside the Pantry. Nothing on it is
  // a control; it is read, not used.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { INGREDIENTS } from "#lib/arcade/order-up/content/index.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { satisfaction } from "#lib/arcade/order-up/engine/shift.ts";
  let { campaign, kind }: { campaign: Campaign; kind: string } = $props();
  const report = $derived(campaign.expansion.lastReport);
  const closed = $derived(!!report && report.day === campaign.day - 1);
  const lines = $derived(
    report
      ? ([
          ["sales", report.revenue],
          ["tips", report.tips],
          ["contracts", report.bonus],
          ["wages", -report.wages],
          ["rent", -report.rent],
        ] as const).filter(([, v]) => !!v)
      : [],
  );
  const name = (id: string) => INGREDIENTS.find((i) => i.id === id)?.name ?? id;
  const happy = $derived(report ? satisfaction(report.points, report.served, report.lost) : null);
</script>

{#if kind === "today" && closed && report}
  <div class="bk-slip" aria-label={"Day " + report.day + " receipt"}>
    <h3>DAY {report.day}</h3>
    <p class="sub">
      {report.served}
      {report.served === 1 ? "cup" : "cups"}{#if happy !== null}, {happy}% satisfied{/if}{#if report.lost}. {report.lost}
        {report.lost === 1 ? "guest" : "guests"} left{/if}{#if report.rankAfter > report.rankBefore}. Rank {report.rankAfter}{/if}
    </p>
    <hr />
    {#each lines as [label, value] (label)}<div class="ln"><span>{label}</span><i></i><b>{money(value)}</b></div>{/each}
    <hr />
    <div class="ln net"><b>NET</b><i></i><b>{money(report.net)}</b></div>
  </div>
{:else if kind === "pantry"}
  <div class="bk-slip" aria-label="Orders">
    <h3>ORDERS</h3>
    <p class="sub">day {campaign.day}</p>
    <hr />
    <p class="h">On the way</p>
    {#each campaign.expansion.shipments as s, i (i)}<div class="ln"><span>{s.quantity} {name(s.ingredient)}</span><i></i><b>day {s.arrivesOn}</b></div>
    {:else}<p class="none">nothing</p>{/each}
  </div>
{/if}
