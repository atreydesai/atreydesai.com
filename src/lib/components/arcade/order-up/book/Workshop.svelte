<script lang="ts">
  // The workshop's ledger: machines by counter with their tier and upkeep,
  // the picked one drawn beside them with what it does and what it costs;
  // and the tool belt, filled slot by slot from the powerups below it.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { MACHINES, POWERUPS } from "#lib/arcade/order-up/content/index.ts";
  import { rankFor, machineSlots, installed, machineAt } from "#lib/arcade/order-up/engine/management.ts";
  import { TUNING } from "#lib/arcade/order-up/engine/tuning.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import Icon from "../Icon.svelte";
  import Machine from "../Machine.svelte";
  export let campaign: Campaign;
  export let live = false;
  export let action: (name: string, data?: any) => void = () => {};
  let station = "all";
  let page: "machines" | "belt" = "machines";
  let picked = "";
  let slot = 0;
  const KEYS = ["Q", "W", "E", "R", "T", "Y"];
  const COUNTERS = ["all", "brew", "prep", "build", "serve", "front", "back"];
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  $: known = MACHINES.filter((m) => m.day <= campaign.day);
  const firstDay = Math.min(...MACHINES.map((m) => m.day));
  $: counters = COUNTERS.filter((c) => c === "all" || known.some((m) => m.station === c));
  $: catalogue = known.filter((m) => station === "all" || m.station === station);
  $: chosen = MACHINES.find((m) => m.id === picked) ?? catalogue[0];
  $: owned = chosen ? machineAt(campaign, chosen.id) : undefined;
  $: tier = owned?.tier ?? 0;
  $: cost = chosen ? Math.round(chosen.price * (tier === 0 ? 1 : tier === 1 ? 1.2 : 1.7) * TUNING[campaign.mode].purchase) : 0;
  $: slotsFull = installed(campaign).length >= machineSlots(campaign);
  $: powers = POWERUPS.filter((p) => p.day <= campaign.day);
  $: slots = rankFor(campaign) >= 30 ? 6 : 5;
  const pips = (t: number) => [1, 2, 3].map((n) => n <= t);
</script>

<div class="lg-title">
  <h2>Workshop</h2>
  <span>{installed(campaign).length} of {machineSlots(campaign)} machine slots used</span>
</div>

<div class="lg-chips" role="group" aria-label="Workshop page">
  <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={page === "machines"} onclick={() => (page = "machines")}>Machines</button>
  <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={page === "belt"} onclick={() => (page = "belt")}>Tool belt</button>
  <span class="gap"></span>
  <button type="button" class="boba-key order-pixel-paper-key" disabled={campaign.day < 6} title={campaign.day < 6 ? "Opens on day 6" : undefined} onclick={() => action("view", { id: "arrange" })}>Arrange the room</button>
  <button type="button" class="boba-key order-pixel-paper-key" disabled={campaign.day < 4} title={campaign.day < 4 ? "Opens on day 4" : undefined} onclick={() => action("view", { id: "chores" })}>Upkeep</button>
</div>

{#if page === "machines" && !known.length}
  <p class="lg-note">The first machines arrive on day {firstDay}.</p>
{:else if page === "machines"}
  <div class="lg-chips" role="group" aria-label="Counter">
    {#each counters as c (c)}
      <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={station === c} onclick={() => (station = c)}>{cap(c)}</button>
    {/each}
  </div>
  <div class="lg-split">
    <div class="lg-table" style:--cols="minmax(10rem, 1fr) 4.5rem 3.5rem 4rem">
      <div class="lg-head" aria-hidden="true"><span>Machine</span><span>Counter</span><span>Tier</span><span class="lg-num">Upkeep</span></div>
      {#each catalogue as machine (machine.id)}
        {@const own = machineAt(campaign, machine.id)}
        <button type="button" class="lg-row" class:is-picked={chosen?.id === machine.id} class:is-dim={!own} aria-pressed={chosen?.id === machine.id} onclick={() => (picked = machine.id)}>
          <span class="lg-name"><Machine id={machine.id} tier={own?.tier || 1} size={30} /><span>{machine.name}</span></span>
          <span class="lg-mark">{cap(machine.station)}</span>
          <span class="pips" aria-label={(own?.tier ?? 0) + " of 3"}>{#each pips(own?.tier ?? 0) as on, k (k)}<i class:on></i>{/each}</span>
          <span class="lg-num lg-mark" class:is-warn={!!own && own.condition < 40}>{own ? Math.round(own.condition) + "%" : ""}</span>
        </button>
      {/each}
    </div>
    <aside class="lg-detail" aria-live="polite">
      {#if chosen}
        <div class="machine-art"><Machine id={chosen.id} tier={tier || 1} size={96} /></div>
        <h3>{chosen.name}</h3>
        <p>{chosen.skills.length ? "Does " + chosen.skills.slice(0, 3).map((id) => id.replaceAll("-", " ")).join(", ") + "." : chosen.effect}</p>
        <dl class="lg-facts">
          <dt>Counter</dt>
          <dd>{cap(chosen.station)}</dd>
          <dt>Tier</dt>
          <dd>{tier ? chosen.tiers[tier - 1].name : "Not fitted"}</dd>
          {#if owned}<dt>Grade</dt><dd>{chosen.tiers[tier - 1].grade}</dd>{/if}
        </dl>
        <div class="lg-actions">
          <button
            type="button"
            class="boba-key is-primary"
            disabled={live || tier >= 3 || campaign.cash < cost || (!owned && slotsFull)}
            onclick={() => action("buy-machine", { id: chosen.id })}
            >{tier >= 3 ? "Fully upgraded" : (tier === 0 ? "Fit it, " : "Upgrade, ") + money(cost)}</button
          >
          {#if owned}
            <button
              type="button"
              class="boba-key order-pixel-paper-key"
              aria-pressed={owned.automatic}
              onclick={() => action("automatic", { id: chosen.id, value: !owned!.automatic })}>Runs itself</button
            >
          {/if}
        </div>
        {#if !owned && slotsFull}<p class="lg-note">Every slot is taken.</p>{/if}
      {/if}
    </aside>
  </div>
{:else}
  <div class="lg-rubric"><h3>The belt</h3><span class="lg-meta">Pick a slot, then a powerup for it</span></div>
  <div class="belt" role="group" aria-label="Tool belt slots">
    {#each Array.from({ length: slots }) as _, i (i)}
      {@const power = POWERUPS.find((p) => p.id === campaign.expansion.loadout[i])}
      <button type="button" class="belt-slot" aria-pressed={slot === i} aria-label={"Slot " + KEYS[i] + (power ? ", " + power.name : ", empty")} onclick={() => (slot = i)}>
        {#if power}<Icon art={power.art} size={28} />{:else}<span class="empty"></span>{/if}
        <kbd>{KEYS[i]}</kbd>
      </button>
    {/each}
  </div>
  <div class="lg-table" style:--cols="minmax(12rem, 1fr) 3rem 6rem 6.5rem">
    <div class="lg-head" aria-hidden="true"><span>Powerup</span><span class="lg-num">Have</span><span></span><span class="lg-num">Buy one</span></div>
    {#each powers as power (power.id)}
      {@const onSlot = campaign.expansion.loadout[slot] === power.id}
      <div class="lg-row">
        <span class="lg-name power"
          ><Icon art={power.art} size={28} /><span><b>{power.name}</b><small>{power.description}</small></span></span
        >
        <span class="lg-num">{campaign.expansion.powerups[power.id] ?? 0}</span>
        <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={onSlot} disabled={live} onclick={() => action("loadout", { slot, id: power.id })}
          >On {KEYS[slot]}</button
        >
        <button type="button" class="boba-key order-pixel-paper-key" disabled={live || campaign.cash < power.price} onclick={() => action("buy-power", { id: power.id })}
          >{money(power.price)}</button
        >
      </div>
    {/each}
  </div>
{/if}

<style>
  .gap {
    flex: 1;
  }

  .pips {
    display: inline-flex;
    gap: 3px;
  }

  .pips i {
    width: 7px;
    height: 7px;
    box-shadow: inset 0 0 0 1.5px var(--bk-rule-strong);
    transform: rotate(45deg);
  }

  .pips i.on {
    background: var(--b-gold);
    box-shadow: none;
  }

  .machine-art {
    display: grid;
    place-items: center;
    height: 104px;
    background: var(--bk-wash);
  }

  .belt {
    display: flex;
    gap: 8px;
    margin-bottom: var(--space-4);
  }

  .belt-slot {
    position: relative;
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border: 0;
    background: var(--bk-raised);
    box-shadow: inset 0 0 0 1.5px var(--bk-rule-strong);
    cursor: pointer;
    clip-path: var(--notch);
  }

  .belt-slot[aria-pressed="true"] {
    background: var(--bk-wash-2);
    box-shadow:
      inset 0 0 0 2px var(--b-accent),
      inset 0 -3px var(--b-accent);
  }

  .belt-slot:focus-visible {
    outline: 2px solid var(--b-accent);
    outline-offset: -2px;
  }

  .belt-slot kbd {
    position: absolute;
    right: 4px;
    bottom: 4px;
  }

  .empty {
    width: 18px;
    height: 18px;
    box-shadow: inset 0 0 0 1.5px var(--bk-rule-strong);
  }

  .power > span {
    display: grid;
    gap: 2px;
    white-space: normal !important;
  }

  .power b {
    font-weight: 500;
  }

  .power small {
    color: var(--bk-muted);
    font-size: 0.75rem;
    font-weight: 400;
    line-height: 1.3;
  }
</style>
