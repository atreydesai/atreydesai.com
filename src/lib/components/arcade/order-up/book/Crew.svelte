<script lang="ts">
  // The crew as a board: the picked person's card (where they work, their
  // week, their energy), the rest of the crew under it to pick from, and the
  // job board beside. The card keeps one size whoever is picked and the crew
  // only grows at its foot, so neither picking nor hiring moves another key.
  // Stacked on a narrow board, the job board (always three tiles) goes first
  // for the same reason: a hire never pushes the next hire key away.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { CREW_ROLES, SHOPS } from "#lib/arcade/order-up/content/index.ts";
  import { candidates, wage, staffGrade } from "#lib/arcade/order-up/engine/management.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import OrderPixelWord from "../../OrderPixelWord.svelte";
  import Portrait from "../Portrait.svelte";
  export let campaign: Campaign;
  export let live = false;
  export let action: (name: string, data?: any) => void = () => {};
  let picked = "";
  const DAYS = ["1", "2", "3", "4", "5", "6", "7"];
  const words = (traits: string[]) => traits.map((t) => t.replaceAll("-", " ")).join(", ");
  const marks = (energy: number) => Array.from({ length: 10 }, (_, i) => i < Math.round(energy / 10));
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

<div class="crew">
  <section class="bk-section" aria-label="Crew">
    <div class="bk-cap"><OrderPixelWord text="Crew" cells={2} /><span class="bk-meta">{money(tonight)} in wages tonight</span></div>
    {#if staff.length && person && role}
      <div class="card" aria-live="polite">
        <div class="who">
          <span class="face"><Portrait name={person.portrait} size={60} /></span>
          <span class="bk-name">{person.name}</span>
          <span class="bk-lbl about">{role.name}{person.traits.length ? ", " + words(person.traits) : ""}</span>
          <span class="bk-lbl line">energy {Math.round(person.energy)} of 100</span>
          <span class="bk-lbl line" class:gone={!person.station}
            >{person.station ? "grade " + Math.round(staffGrade(person, person.station)) + " at " + person.station : ""}</span
          >
          <button
            type="button"
            class="boba-key is-small tea"
            disabled={person.energy >= 100 || campaign.cash < 120}
            onclick={() => action("staff-tea", { id: person.id })}>Make them tea, {money(120)}</button
          >
        </div>
        <div class="fields">
          <span class="bk-lbl">shop</span>
          <div class="stepper">
            <button type="button" class="boba-key is-small" disabled={shops.length < 2} aria-label="Previous shop" onclick={() => moveShop(-1)}>‹</button>
            <span class="bk-name">{shops[shopIndex]?.name ?? ""}</span>
            <button type="button" class="boba-key is-small" disabled={shops.length < 2} aria-label="Next shop" onclick={() => moveShop(1)}>›</button>
          </div>
          <span class="bk-lbl">counter</span>
          <div class="counters" role="group" aria-label={"Counter for " + person.name}>
            <button
              type="button"
              class="boba-key is-small"
              aria-pressed={!person.station}
              onclick={() => action("assign", { id: person.id, station: null, shop: person.shop })}>helping</button
            >
            {#each role.stations as s (s)}
              <button
                type="button"
                class="boba-key is-small"
                aria-pressed={person.station === s}
                onclick={() => action("assign", { id: person.id, station: s, shop: person.shop })}>{s} <small>{person.skills[s]}/5</small></button
              >
            {/each}
          </div>
          <span class="bk-lbl">works on</span>
          <div class="rota" role="group" aria-label={"Week for " + person.name}>
            {#each person.rota as on, day (day)}
              <button
                type="button"
                class="boba-key is-small"
                aria-pressed={on}
                aria-label={"Day " + (day + 1)}
                disabled={live}
                onclick={() => action("rota", { id: person.id, day, value: !on })}>{DAYS[day]}</button
              >
            {/each}
          </div>
        </div>
      </div>
      <div class="bk-tiles is-fill roster" style:--min="112px">
        {#each staff as p (p.id)}
          {@const r = CREW_ROLES.find((x) => x.id === p.role)}
          <button type="button" class="bk-tile mate" class:is-on={person.id === p.id} aria-pressed={person.id === p.id} onclick={() => (picked = p.id)}>
            <span class="pic"><Portrait name={p.portrait} size={40} /></span>
            <span class="bk-name">{p.name}</span>
            <span class="bk-lbl">{r?.name ?? ""}</span>
            <span class="bk-lbl">{p.station ?? "helping"}</span>
            <span class="bk-lbl">{money(wage(p))} a shift</span>
            <span class="bk-tally" role="img" aria-label={"Energy " + Math.round(p.energy)}>{#each marks(p.energy) as on, k (k)}<i class:on></i>{/each}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="bk-empty">No one on the crew yet. Hire from the job board.</p>
    {/if}
  </section>

  <section class="bk-section board" aria-label="Job board">
    <div class="bk-cap"><OrderPixelWord text="Job board" cells={2} /></div>
    <div class="bk-tiles" style:--n={3}>
      {#each applicants as a (a.id)}
        {@const r = CREW_ROLES.find((x) => x.id === a.role)!}
        {@const hired = staff.some((s) => s.id === a.id)}
        <div class="bk-tile applicant">
          <span class="pic"><Portrait name={a.portrait} size={48} /></span>
          <span class="bk-name">{a.name}</span>
          <span class="bk-lbl">{r.name}</span>
          <span class="bk-lbl">{money(r.wage)} a shift</span>
          <span class="bk-lbl traits">{words(a.traits)}</span>
          <button
            type="button"
            class="boba-key is-small hire"
            disabled={live || hired || campaign.cash < r.hire}
            aria-label={hired ? a.name + ", hired" : "Hire " + a.name + " for " + money(r.hire)}
            onclick={() => action("hire", { id: a.id })}>{hired ? "Hired" : money(r.hire)}</button
          >
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .crew {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }

  /* The picked person: who they are on the left, where and when they work on the right. */
  .card {
    display: grid;
    grid-template-columns: 9.5rem minmax(0, 1fr);
    gap: 16px;
    padding: 14px;
    background: var(--lg-chip);
    clip-path: var(--notch);
  }

  .who {
    display: grid;
    align-content: start;
    justify-items: center;
    gap: 5px;
    text-align: center;
  }

  .who .bk-name.bk-name {
    margin-top: 2px;
    font-size: 15px;
  }

  .who .bk-lbl.line {
    height: 14px;
  }

  .who .bk-lbl.about {
    display: grid;
    place-items: center;
    height: 28px;
    overflow: hidden;
    line-height: 14px;
  }

  .gone {
    visibility: hidden;
  }

  .tea {
    justify-self: stretch;
    margin-top: 4px;
  }

  .fields {
    display: grid;
    align-content: start;
    gap: 6px;
  }

  .fields > .bk-lbl:not(:first-child) {
    margin-top: 6px;
  }

  .stepper {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 34px;
    align-items: center;
    gap: 6px;
  }

  .stepper .bk-name {
    overflow: hidden;
    text-align: center;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  /* Room for helping and five counters, so every role's card is the same height. */
  .counters {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: repeat(2, 28px);
    gap: 6px;
  }

  .counters small {
    font-size: 11px;
    opacity: 0.7;
  }

  .rota {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
  }

  .card .rota .boba-key.is-small {
    padding-inline: 0;
  }

  .card .stepper .boba-key.is-small {
    font-size: 17px;
  }

  /* Crew and applicant tiles: picture, name and facts at the same heights across a row. */
  .crew .bk-tile.mate,
  .crew .bk-tile.applicant {
    align-content: start;
    gap: 5px;
    padding: 12px 8px 10px;
  }

  .pic {
    display: grid;
    place-items: center;
    height: 56px;
  }

  /* One line each, so a long role or name can't push a tile's key below its neighbours'. */
  .crew .bk-tile :is(.bk-name, .bk-lbl:not(.traits)) {
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .mate .bk-tally {
    margin-top: 3px;
  }

  .mate.is-on .bk-tally i {
    background: #d9c49b;
  }

  .mate.is-on .bk-tally i.on {
    background: #2b1f20;
  }

  .bk-tile .bk-lbl.traits {
    display: grid;
    place-items: center;
    height: 28px;
    overflow: hidden;
    line-height: 14px;
  }

  .hire {
    justify-self: stretch;
    margin-top: 2px;
  }

  @media (max-width: 900px) {
    .crew {
      grid-template-columns: minmax(0, 1fr);
    }

    .board {
      order: -1;
    }
  }

  /* A phone: the card stacks, its portrait beside the name. */
  @media (max-width: 480px) {
    .card {
      grid-template-columns: minmax(0, 1fr);
    }

    .who {
      grid-template-columns: 60px minmax(0, 1fr);
      column-gap: 14px;
      justify-items: start;
      text-align: left;
    }

    .face {
      grid-row: 1 / span 4;
      align-self: center;
    }

    .who .bk-lbl.about {
      place-items: center start;
    }

    .tea {
      grid-column: 1 / -1;
    }
  }
</style>
