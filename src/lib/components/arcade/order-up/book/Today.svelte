<script lang="ts">
  // Today's page: what yesterday made, what's new, the week ahead and the
  // money on one side; the contracts to take on, as chits, on the other.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { newToday } from "#lib/arcade/order-up/engine/opened.ts";
  import { GOALS } from "#lib/arcade/order-up/content/index.ts";
  import { rentOnDueDay, wage, MARKETING } from "#lib/arcade/order-up/engine/management.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import Icon from "../Icon.svelte";
  export let campaign: Campaign;
  export let action: (name: string, data?: any) => void = () => {};
  export let live = false;
  let goalScale: "shift" | "week" | "job" | "season" = "shift";
  let allNew = false;
  const SCALES = [
    ["shift", "Shift"],
    ["week", "Week"],
    ["job", "Jobs"],
    ["season", "Season"],
  ] as const;
  $: today = calendar(campaign.day);
  $: fresh = newToday(campaign);
  $: report = campaign.expansion.lastReport;
  $: goals = GOALS.filter((g) => g.day <= campaign.day && g.scale === goalScale && (!g.season || g.season === today.season.id));
  $: booked = campaign.expansion.selectedGoals.length;
  $: wages = campaign.expansion.staff.filter((s) => s.rota[(campaign.day - 1) % 7]).reduce((n, p) => n + wage(p), 0);
  $: closed = !!report && report.day === campaign.day - 1;
  const todayKey = new Date().toISOString().slice(0, 10);
  function arrival(kind: string) {
    if (kind === "ingredient") return "A crate of it is in the pantry.";
    if (kind === "machine") return "It's for sale in the workshop.";
    if (kind === "shop") return "It's for sale on the shops page.";
    if (kind === "recipe") return "It's on the menu from today.";
    return "It's in the shop book.";
  }
  const marks = (n: number, of: number) => Array.from({ length: Math.min(of, 10) }, (_, i) => i < Math.round((n / of) * Math.min(of, 10)));
</script>

<div class="today">
  <div class="left">
    {#if campaign.status === "closed"}
      <div class="warning">
        <p>The till couldn't cover the close, so the shop is shut.</p>
        <button type="button" class="boba-key is-primary" onclick={() => action("recovery")}>Borrow {money(3000)} and reopen</button>
      </div>
    {/if}

    {#if closed && report}
      <section class="receipt" aria-labelledby="close-title">
        <h2 id="close-title">Day {report.day}</h2>
        <p>
          {report.served}
          {report.served === 1 ? "cup" : "cups"}, {report.points} points{report.served ? `, average grade ${report.average}` : ""}.{#if report.lost}
            {report.lost === 1 ? " One guest" : ` ${report.lost} guests`} left without a drink.{/if}{#if report.rankAfter > report.rankBefore}
            You reached rank {report.rankAfter}.{/if}
        </p>
        <dl class="lg-facts">
          {#each [["Sales", report.revenue], ["Tips", report.tips], ["Contracts", report.bonus], ["Wages", -report.wages], ["Rent", -report.rent]] as [label, value] (label)}
            {#if value}<dt>{label}</dt><dd>{money(Number(value))}</dd>{/if}
          {/each}
          <dt class="net">Net</dt>
          <dd class="net">{money(report.net)}</dd>
        </dl>
      </section>
    {/if}

    {#if fresh[0]}
      <section class="new-slip">
        <span class="stamp">New</span>
        {#if "art" in fresh[0].item}<Icon art={fresh[0].item.art} size={44} />{/if}
        <div>
          <h3>{fresh[0].item.name}</h3>
          <p>{arrival(fresh[0].kind)}</p>
        </div>
      </section>
      {#if fresh.length > 1}
        <button type="button" class="more" aria-expanded={allNew} onclick={() => (allNew = !allNew)}
          >{allNew ? "Hide" : "Show"} {fresh.length - 1} more new {fresh.length === 2 ? "thing" : "things"}</button
        >
        {#if allNew}
          <ul class="new-list">
            {#each fresh.slice(1) as row (row.item.id)}<li>
                {#if "art" in row.item}<Icon art={row.item.art} size={22} />{/if}<span>{row.item.name}</span><small>{row.kind}</small>
              </li>{/each}
          </ul>
        {/if}
      {/if}
    {/if}

    <div class="lg-rubric"><h3>The week</h3>{#if today.holiday}<span class="lg-meta">{today.holiday.name}</span>{/if}</div>
    <ol class="week" aria-label="The coming week">
      {#each Array.from({ length: 7 }) as _, i (i)}
        {@const day = calendar(campaign.day + i)}
        <li class:is-today={i === 0}>
          <span class="n">{day.day}</span>
          <small>{day.weekDay === 7 ? "Rent" : (day.holiday?.name ?? day.event.name)}</small>
        </li>
      {/each}
    </ol>

    <div class="lg-rubric"><h3>Money</h3></div>
    <div class="lg-table" style:--cols="minmax(8rem, 1fr) 6.5rem 9rem">
      <div class="lg-row">
        <span>Wages tonight</span><span class="lg-num">{money(wages)}</span><span></span>
      </div>
      <div class="lg-row">
        <span>Rent on day {Math.ceil(campaign.day / 7) * 7}</span><span class="lg-num">{money(rentOnDueDay(campaign))}</span><span></span>
      </div>
      {#if campaign.day >= 7}
        <div class="lg-row">
          <span>Loan{#if campaign.expansion.loan}<small class="lg-mark"> {money(campaign.expansion.loanInterest)} interest a week</small>{/if}</span>
          <span class="lg-num">{money(campaign.expansion.loan)}</span>
          {#if campaign.expansion.loan > 0}
            <button type="button" class="boba-key order-pixel-paper-key" onclick={() => action("repay")}>Repay {money(1000)}</button>
          {:else}
            <button type="button" class="boba-key order-pixel-paper-key" disabled={live} onclick={() => action("loan")}>Borrow {money(10000)}</button>
          {/if}
        </div>
      {/if}
      <div class="lg-row">
        <span>Daily shift <small class="lg-mark">Best {campaign.expansion.dailyBests[todayKey] ?? 0} points</small></span><span></span>
        <button type="button" class="boba-key order-pixel-paper-key" disabled={live || campaign.status === "closed"} onclick={() => action("daily")}>Play it</button>
      </div>
    </div>

    <div class="lg-rubric"><h3>Promotion</h3><span class="lg-meta">One a day</span></div>
    <div class="lg-chips" role="group" aria-label="Promotion">
      {#each MARKETING as item (item.id)}
        <button
          type="button"
          class="boba-key order-pixel-paper-key promo"
          aria-pressed={campaign.expansion.marketing === item.id}
          disabled={live || (!!campaign.expansion.marketing && campaign.expansion.marketing !== item.id)}
          onclick={() => action("marketing", { id: item.id })}
          ><span>{item.name[0].toUpperCase() + item.name.slice(1)}</span><b>{money(item.price)}</b></button
        >
      {/each}
    </div>
  </div>

  <section class="contracts" aria-labelledby="contracts-title">
    <div class="lg-rubric"><h3 id="contracts-title">Contracts</h3><span class="lg-meta">{booked} of 6 taken</span></div>
    <div class="lg-chips" role="group" aria-label="Contract length">
      {#each SCALES as [id, label] (id)}
        <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={goalScale === id} onclick={() => (goalScale = id)}>{label}</button>
      {/each}
    </div>
    <div class="chits">
      {#each goals as goal (goal.id)}
        {@const taken = campaign.expansion.selectedGoals.includes(goal.id)}
        {@const done = Math.min(goal.target, campaign.expansion.goalProgress[goal.id] ?? 0)}
        <button
          type="button"
          class="chit"
          class:is-taken={taken}
          disabled={live || (!taken && booked >= 6)}
          aria-pressed={taken}
          onclick={() => action("goal", { id: goal.id })}
        >
          <span class="chit-text">
            <span class="chit-name">{goal.name}</span>
            <span class="chit-meta"
              ><span class="tally" aria-hidden="true">{#each marks(done, goal.target) as on, k (k)}<i class:on></i>{/each}</span>
              <span class="lg-num">{done} of {goal.target}</span></span
            >
          </span>
          <span class="chit-pay">{money(goal.reward)}<span class="stamp" class:is-hidden={!taken}>Taken</span></span>
        </button>
      {:else}
        <p class="lg-empty">None this long yet.</p>
      {/each}
    </div>
  </section>
</div>

<style>
  .today {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 20rem;
    gap: var(--space-6);
    align-items: start;
  }

  @media (max-width: 960px) {
    .today {
      grid-template-columns: 1fr;
    }
  }

  .warning {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: color-mix(in srgb, var(--b-accent) 10%, var(--b-paper));
    box-shadow: inset 3px 0 var(--b-accent);
  }

  .warning p {
    margin: 0;
  }

  .receipt {
    display: grid;
    gap: var(--space-2);
    margin-bottom: var(--space-5);
    padding: var(--space-4);
    background: var(--bk-raised);
    box-shadow: inset 0 0 0 1.5px var(--bk-rule-strong);
    clip-path: var(--notch);
  }

  .receipt h2 {
    margin: 0;
    color: var(--bk-ink);
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
  }

  .receipt p {
    margin: 0;
    font-size: 0.875rem;
  }

  .receipt .net {
    padding-top: 6px;
    border-top: 1px solid var(--bk-rule-strong);
    color: var(--bk-ink);
    font-weight: 600;
  }

  .new-slip {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--bk-wash-2);
    clip-path: var(--notch);
  }

  .new-slip .stamp {
    position: absolute;
    top: 8px;
    right: 10px;
  }

  .new-slip h3 {
    margin: 0;
    color: var(--bk-ink);
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
  }

  .new-slip p {
    margin: 4px 0 0;
    font-size: 0.875rem;
  }

  .more {
    margin-top: var(--space-2);
    padding: 4px 0;
    border: 0;
    color: var(--bk-muted);
    background: none;
    font: 500 0.8125rem/1.2 var(--font-ui);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .new-list {
    display: grid;
    gap: 6px;
    margin: var(--space-2) 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.8125rem;
  }

  .new-list li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .new-list small {
    color: var(--bk-muted);
  }

  .week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .week li {
    display: grid;
    justify-items: center;
    gap: 4px;
    min-width: 0;
    padding: 8px 4px;
    border-right: 1px solid var(--bk-rule);
  }

  .week li:last-child {
    border-right: 0;
  }

  .week li.is-today {
    background: var(--bk-wash-2);
    box-shadow: inset 0 -3px var(--b-accent);
  }

  .week .n {
    color: var(--bk-ink);
    font-size: 0.8125rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .week small {
    display: -webkit-box;
    width: 100%;
    min-height: 2.5em;
    overflow: hidden;
    color: var(--bk-muted);
    font-size: 0.6875rem;
    line-height: 1.25;
    text-align: center;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .promo {
    gap: 8px;
  }

  .promo b {
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    opacity: 0.75;
  }

  .contracts {
    position: sticky;
    top: 0;
  }

  .chits {
    display: grid;
    gap: 8px;
  }

  /* A contract chit: a slip clipped to the page, its tally pencilled in. */
  .chit {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
    min-height: 58px;
    padding: 10px 12px 10px 14px;
    border: 0;
    color: var(--bk-text);
    background: var(--bk-raised);
    box-shadow:
      inset 0 0 0 1.5px var(--bk-rule-strong),
      inset 4px 0 var(--bk-rule-strong);
    font: inherit;
    text-align: left;
    cursor: pointer;
    clip-path: var(--notch);
  }

  .chit::before {
    content: "";
    position: absolute;
    top: 0;
    left: 22px;
    width: 10px;
    height: 4px;
    background: var(--bk-muted);
  }

  .chit.is-taken {
    background: var(--bk-wash-2);
    box-shadow:
      inset 0 0 0 1.5px var(--b-gold),
      inset 4px 0 var(--b-accent);
  }

  .chit:disabled {
    cursor: default;
  }

  .chit:disabled:not(.is-taken) {
    opacity: 0.55;
  }

  @media (hover: hover) {
    .chit:not(:disabled):hover {
      box-shadow:
        inset 0 0 0 1.5px var(--bk-ink),
        inset 4px 0 var(--bk-ink);
    }
  }

  .chit:focus-visible {
    outline: 2px solid var(--b-accent);
    outline-offset: -2px;
  }

  .chit-text {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .chit-name {
    color: var(--bk-ink);
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25;
  }

  .chit-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--bk-muted);
    font-size: 0.75rem;
  }

  .chit-pay {
    display: grid;
    justify-items: end;
    gap: 4px;
    color: var(--bk-ink);
    font-size: 0.875rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* The stamp keeps its room when absent, so taking a contract moves nothing. */
  .stamp.is-hidden {
    visibility: hidden;
  }
</style>
