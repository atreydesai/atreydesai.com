<script lang="ts">
  // Today's page, in the order a day is planned: the money first, then the
  // promotion to book, then what's new, then the week ahead; the contracts to
  // take on down the right. Yesterday's close is the receipt tucked beside the
  // book. Today itself and nothing else is orange.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { newToday, goalScaleOpen } from "#lib/arcade/order-up/engine/opened.ts";
  import { GOALS } from "#lib/arcade/order-up/content/index.ts";
  import { rentOnDueDay, wage, MARKETING } from "#lib/arcade/order-up/engine/management.ts";
  import { PROMOTION_ICONS } from "#lib/arcade/order-up/art/promotions.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import OrderPixelWord from "../../OrderPixelWord.svelte";
  import Icon from "../Icon.svelte";
  import HouseTea from "./HouseTea.svelte";
  export let campaign: Campaign;
  export let action: (name: string, data?: any) => void = () => {};
  export let live = false;
  let goalScale: "shift" | "week" | "job" | "season" = "shift";
  const SCALES = [
    ["shift", "shift"],
    ["week", "week"],
    ["job", "jobs"],
    ["season", "season"],
  ] as const;
  // A contract kind shows from its day, or while one of it is taken; promotions likewise.
  $: scales = SCALES.filter(
    ([id]) => goalScaleOpen(campaign, id) || campaign.expansion.selectedGoals.some((g) => GOALS.find((x) => x.id === g)?.scale === id),
  );
  $: if (!scales.some(([id]) => id === goalScale)) goalScale = "shift";
  $: promotions = MARKETING.filter((m) => m.day <= campaign.day || campaign.expansion.marketing === m.id);
  $: today = calendar(campaign.day);
  $: fresh = newToday(campaign);
  $: goals = GOALS.filter((g) => g.day <= campaign.day && g.scale === goalScale && (!g.season || g.season === today.season.id));
  $: booked = campaign.expansion.selectedGoals.length;
  $: wages = campaign.expansion.staff.filter((s) => s.rota[(campaign.day - 1) % 7]).reduce((n, p) => n + wage(p), 0);
  $: rentDay = Math.ceil(campaign.day / 7) * 7;
  $: loanOpen = campaign.day >= 7 || campaign.expansion.loan > 0;
  const marks = (n: number, of: number) => Array.from({ length: Math.min(of, 10) }, (_, i) => i < Math.round((n / of) * Math.min(of, 10)));
</script>

<div class="today">
  <div class="col">
    {#if campaign.status === "closed"}
      <div class="bk-tile is-fill shut">
        <span class="bk-name">The till couldn't cover the close, so the shop is shut.</span>
        <button type="button" class="boba-key" onclick={() => action("recovery")}>Borrow {money(3000)} and reopen</button>
      </div>
    {/if}

    <section class="bk-section" aria-label="Money">
      <div class="bk-cap"><OrderPixelWord text="Money" cells={2} /></div>
      <div class="bk-tiles" style:--n={loanOpen ? 3 : 2}>
        <div class="bk-tile"><span class="bk-big">{money(wages)}</span><span class="bk-lbl">wages tonight</span></div>
        <div class="bk-tile is-hot"><span class="bk-big">{money(rentOnDueDay(campaign))}</span><span class="bk-lbl">rent, day {rentDay}</span></div>
        {#if loanOpen}
          <div class="bk-tile">
            <span class="bk-big">{money(campaign.expansion.loan)}</span>
            <span class="bk-lbl">loan{#if campaign.expansion.loan}, {money(campaign.expansion.loanInterest)} a week{/if}</span>
            {#if campaign.expansion.loan > 0}
              <button type="button" class="boba-key is-small" onclick={() => action("repay")}>Repay {money(1000)}</button>
            {:else}
              <button type="button" class="boba-key is-small" disabled={live} onclick={() => action("loan")}>Borrow {money(10000)}</button>
            {/if}
          </div>
        {/if}
      </div>
    </section>

    {#if promotions.length}
      <section class="bk-section" aria-label="Promotion">
        <div class="bk-cap"><OrderPixelWord text="Promote" cells={2} /><span class="bk-meta">one a day</span></div>
        <div class="bk-tiles" style:--n={4} role="group" aria-label="Promotion">
          {#each promotions as item (item.id)}
            {@const on = campaign.expansion.marketing === item.id}
            <button
              type="button"
              class="bk-tile"
              class:is-on={on}
              aria-pressed={on}
              disabled={live || (!!campaign.expansion.marketing && !on) || (!on && campaign.cash < item.price)}
              onclick={() => action("marketing", { id: item.id })}
              ><svg class="promo-icon" width="48" height="48" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"
                >{#each PROMOTION_ICONS[item.id] ?? [] as [x, y, w, h, fill], k (k)}<rect {x} {y} width={w} height={h} {fill} />{/each}</svg
              ><span class="bk-name">{item.name}</span><span class="bk-mid">{money(item.price)}</span></button
            >
          {/each}
        </div>
      </section>
    {/if}

    {#if fresh.length}
      <section class="bk-section" aria-label="New today">
        <div class="bk-cap"><OrderPixelWord text="New" cells={2} /></div>
        <div class="bk-tiles" style:--n={Math.min(4, Math.max(3, fresh.length))}>
          {#each fresh as row (row.kind + row.item.id)}
            <div class="bk-tile">
              {#if "art" in row.item}<Icon art={row.item.art} size={40} />{/if}<span class="bk-name">{row.item.name}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if campaign.expansion.shops.garden && campaign.day >= 20}
      <HouseTea {campaign} {live} {action} />
    {/if}
    <section class="bk-section" aria-label="The week">
      <div class="bk-cap"><OrderPixelWord text="Week" cells={2} />{#if today.holiday}<span class="bk-meta">{today.holiday.name}</span>{/if}</div>
      <ol class="bk-tiles week" style:--n={7}>
        {#each Array.from({ length: 7 }) as _, i (i)}
          {@const day = calendar(campaign.day + i)}
          <li class="bk-tile" class:is-fill={i === 0} title={day.weekDay === 7 ? "Rent" : (day.holiday?.name ?? day.event.name)}>
            <span class="bk-big">{day.day}</span><span class="bk-lbl">{day.weekDay === 7 ? "rent" : " "}</span>
          </li>
        {/each}
      </ol>
    </section>
  </div>

  <section class="col bk-section" aria-labelledby="contracts-title">
    <div class="bk-cap">
      <span id="contracts-title" class="sr-only">Contracts</span><OrderPixelWord text="Contracts" cells={2} /><span class="bk-meta"
        >{booked}/6 taken</span
      >
      <span class="bk-grow"></span>
      {#if scales.length > 1}
        <div class="bk-keys" role="group" aria-label="Contract length">
          {#each scales as [id, label] (id)}
            <button type="button" class="boba-key is-small" aria-pressed={goalScale === id} onclick={() => (goalScale = id)}>{label}</button>
          {/each}
        </div>
      {/if}
    </div>
    <div class="bk-tiles" style:--n={2}>
      {#each goals as goal (goal.id)}
        {@const taken = campaign.expansion.selectedGoals.includes(goal.id)}
        {@const done = Math.min(goal.target, campaign.expansion.goalProgress[goal.id] ?? 0)}
        <button
          type="button"
          class="bk-tile chit"
          class:is-hot={taken}
          disabled={live || (!taken && booked >= 6)}
          aria-pressed={taken}
          aria-label={goal.name + ", " + money(goal.reward) + ", " + done + " of " + goal.target + (taken ? ", taken" : "")}
          onclick={() => action("goal", { id: goal.id })}
          ><span class="bk-name">{goal.name.replace(/ contract$/, "")}</span><span class="bk-big">{money(goal.reward)}</span><span class="bk-tally"
            >{#each marks(done, goal.target) as on, k (k)}<i class:on></i>{/each}</span
          ></button
        >
      {:else}
        <p class="bk-empty">None this long yet.</p>
      {/each}
    </div>
  </section>
</div>

<style>
  .today {
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }

  .col {
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .today .bk-tile.shut {
    justify-items: start;
    text-align: left;
    padding: 12px 14px;
  }

  .week {
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .today .week .bk-tile .bk-lbl {
    min-height: 14px;
  }

  .promo-icon {
    width: 48px;
    height: 48px;
  }

  .today .bk-tile.chit {
    justify-items: start;
    gap: 6px;
    padding: 12px;
    text-align: left;
  }

  .today .bk-tile.chit .bk-name {
    color: var(--lg-text);
    font-weight: 400;
    font-size: 12px;
  }

  @media (max-width: 900px) {
    .today {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 480px) {
    .week {
      --n: 4 !important;
    }
  }
</style>
