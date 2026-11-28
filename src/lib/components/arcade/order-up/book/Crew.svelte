<script lang="ts">
  // The crew roster: who works where, their energy and pay, the picked one's
  // week and counter beside the list; the job board underneath.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { CREW_ROLES, SHOPS } from "#lib/arcade/order-up/content/index.ts";
  import { candidates, wage, staffGrade } from "#lib/arcade/order-up/engine/management.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import Portrait from "../Portrait.svelte";
  export let campaign: Campaign;
  export let live = false;
  export let action: (name: string, data?: any) => void = () => {};
  let picked = "";
  const DAYS = ["1", "2", "3", "4", "5", "6", "7"];
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  $: applicants = candidates(campaign);
  $: staff = campaign.expansion.staff;
  $: person = staff.find((p) => p.id === picked) ?? staff[0];
  $: role = person ? CREW_ROLES.find((r) => r.id === person.role) : undefined;
  $: shops = SHOPS.filter((s) => campaign.expansion.shops[s.id]);
  $: shopIndex = person ? Math.max(0, shops.findIndex((s) => s.id === person.shop)) : 0;
  $: tonight = staff.filter((s) => s.rota[(campaign.day - 1) % 7]).reduce((n, s) => n + wage(s), 0);
  function moveShop(by: number) {
    if (!person || shops.length < 2) return;
    const next = shops[(shopIndex + by + shops.length) % shops.length];
    action("assign", { id: person.id, station: person.station, shop: next.id });
  }
</script>

<div class="lg-title">
  <h2>Crew</h2>
  <span>{money(tonight)} in wages tonight</span>
</div>

{#if staff.length}
  <div class="lg-split">
    <div class="lg-table" style:--cols="minmax(9rem, 1fr) 5rem 5rem 5rem 4rem">
      <div class="lg-head" aria-hidden="true"><span>Name</span><span>Role</span><span>Counter</span><span>Energy</span><span class="lg-num">Wage</span></div>
      {#each staff as p (p.id)}
        {@const r = CREW_ROLES.find((x) => x.id === p.role)}
        <button type="button" class="lg-row" class:is-picked={person?.id === p.id} aria-pressed={person?.id === p.id} onclick={() => (picked = p.id)}>
          <span class="lg-name"><Portrait name={p.portrait} size={30} /><span>{p.name}</span></span>
          <span class="lg-mark">{r ? cap(r.name) : ""}</span>
          <span class="lg-mark">{p.station ? cap(p.station) : "Helping"}</span>
          <span class="bar" aria-label={"Energy " + Math.round(p.energy)}><i style:width="{p.energy}%"></i></span>
          <span class="lg-num">{money(wage(p))}</span>
        </button>
      {/each}
    </div>
    <aside class="lg-detail" aria-live="polite">
      {#if person && role}
        <div class="who"><Portrait name={person.portrait} size={56} /><div><h3>{person.name}</h3><p>{cap(role.name)}{person.traits.length ? ", " + person.traits.map((t) => t.replaceAll("-", " ")).join(", ") : ""}</p></div></div>
        <div class="field">
          <span>Shop</span>
          <div class="stepper">
            <button type="button" class="boba-key order-pixel-paper-key" disabled={shops.length < 2} aria-label="Previous shop" onclick={() => moveShop(-1)}>‹</button>
            <b>{shops[shopIndex]?.name ?? ""}</b>
            <button type="button" class="boba-key order-pixel-paper-key" disabled={shops.length < 2} aria-label="Next shop" onclick={() => moveShop(1)}>›</button>
          </div>
        </div>
        <div class="field">
          <span>Counter</span>
          <div class="lg-chips" role="group" aria-label={"Counter for " + person.name}>
            <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={!person.station} onclick={() => action("assign", { id: person.id, station: null, shop: person.shop })}>Helping</button>
            {#each role.stations as s (s)}
              <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={person.station === s} onclick={() => action("assign", { id: person.id, station: s, shop: person.shop })}
                >{cap(s)} <small>{person.skills[s]}/5</small></button
              >
            {/each}
          </div>
        </div>
        <div class="field">
          <span>Works on</span>
          <div class="rota" role="group" aria-label={"Week for " + person.name}>
            {#each person.rota as on, day (day)}
              <button type="button" aria-pressed={on} aria-label={"Day " + (day + 1)} disabled={live} onclick={() => action("rota", { id: person.id, day, value: !on })}>{DAYS[day]}</button>
            {/each}
          </div>
        </div>
        <dl class="lg-facts">
          <dt>Energy</dt>
          <dd>{Math.round(person.energy)} of 100</dd>
          {#if person.station}<dt>Grade at {person.station}</dt><dd>{Math.round(staffGrade(person, person.station))}</dd>{/if}
        </dl>
        <div class="lg-actions">
          <button type="button" class="boba-key order-pixel-paper-key" disabled={person.energy >= 100 || campaign.cash < 120} onclick={() => action("staff-tea", { id: person.id })}
            >Make them tea, {money(120)}</button
          >
        </div>
      {/if}
    </aside>
  </div>
{:else}
  <p class="lg-empty">No one on the crew yet. Hire from the job board.</p>
{/if}

<div class="lg-rubric"><h3>Job board</h3></div>
<div class="lg-table" style:--cols="minmax(9rem, 1fr) 5rem minmax(6rem, 1.2fr) 5rem 7rem">
  <div class="lg-head" aria-hidden="true"><span>Name</span><span>Role</span><span>Good at</span><span class="lg-num">Wage</span><span class="lg-num">Hire</span></div>
  {#each applicants as a (a.id)}
    {@const r = CREW_ROLES.find((x) => x.id === a.role)!}
    {@const hired = staff.some((s) => s.id === a.id)}
    <div class="lg-row">
      <span class="lg-name"><Portrait name={a.portrait} size={30} /><span>{a.name}</span></span>
      <span class="lg-mark">{cap(r.name)}</span>
      <span class="lg-mark">{a.traits.map((t) => t.replaceAll("-", " ")).join(", ")}</span>
      <span class="lg-num">{money(r.wage)}</span>
      <button type="button" class="boba-key order-pixel-paper-key" disabled={live || hired || campaign.cash < r.hire} onclick={() => action("hire", { id: a.id })}
        >{hired ? "Hired" : money(r.hire)}</button
      >
    </div>
  {/each}
</div>

<style>
  .who {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .who p {
    margin-top: 4px;
    color: var(--bk-muted);
    font-size: 0.8125rem;
  }

  .field {
    display: grid;
    gap: 6px;
  }

  .field > span {
    color: var(--bk-muted);
    font-size: 0.75rem;
  }

  .field .lg-chips {
    margin: 0;
  }

  .stepper {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 6px;
  }

  .stepper b {
    overflow: hidden;
    font-size: 0.8125rem;
    font-weight: 500;
    text-align: center;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .rota {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }

  .rota button {
    height: 30px;
    border: 0;
    color: var(--bk-muted);
    background: var(--bk-paper);
    box-shadow: inset 0 0 0 1.5px var(--bk-rule-strong);
    font: 600 0.75rem/1 var(--font-ui);
    cursor: pointer;
  }

  .rota button[aria-pressed="true"] {
    color: var(--bk-paper);
    background: var(--bk-ink);
    box-shadow: none;
  }

  .rota button:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .rota button:focus-visible {
    outline: 2px solid var(--b-accent);
    outline-offset: 1px;
  }
</style>
