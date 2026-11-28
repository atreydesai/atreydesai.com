<script lang="ts">
  // The workshop as a board. Machines: the shop's slots first, each fitted
  // machine with its condition and whether it runs itself, then the catalogue
  // by counter, each machine with its tier and the key that fits or upgrades
  // it. Tool belt: the slots Q to Y, then the powerups to put on them.
  // Upgrades: the brew tree, from the bench through the parts it makes to the
  // three kits a shop can fit one of at a time.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { MACHINES, POWERUPS } from "#lib/arcade/order-up/content/index.ts";
  import { rankFor, machineSlots, installed, machineAt, machineDefinition, machineModel } from "#lib/arcade/order-up/engine/management.ts";
  import { TUNING } from "#lib/arcade/order-up/engine/tuning.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import OrderPixelWord from "../../OrderPixelWord.svelte";
  import Icon from "../Icon.svelte";
  import Machine from "../Machine.svelte";
  import UpgradeTree, { type TreeItem } from "./UpgradeTree.svelte";
  import { UPGRADE_NODES, BREW_RESPEC_COST, BREW_POWER_BUDGET, type UpgradeNode } from "#lib/arcade/order-up/content/upgrades.ts";
  import { workshopPrice } from "#lib/arcade/order-up/engine/upgrades.ts";
  import { upgradeSprite } from "#lib/arcade/order-up/art/upgrade-icons.ts";
  import { TREE_NODES } from "#lib/arcade/order-up/content/progression-trees.ts";
  import { nodeStatus } from "#lib/arcade/order-up/engine/tree-nodes.ts";
  export let campaign: Campaign;
  export let live = false;
  export let action: (name: string, data?: any) => void = () => {};
  let station = "all";
  let page: "machines" | "belt" | "upgrades" = "machines";
  let pickedNode = "";
  let system = "brew";
  // Each system's tree, opened on the day its first node does; the brew kits keep their own, fuller tree.
  const SYSTEMS = [
    ["brew", "Brew"],
    ["counters", "Counters"],
    ["furniture", "Furniture"],
    ["decor", "Decor"],
    ["guests", "Guests"],
    ["crew", "Crew"],
    ["tea", "Tea"],
    ["drinks", "Drinks"],
    ["suppliers", "Suppliers"],
    ["locations", "Rooms"],
    ["promotions", "Promotions"],
    ["contracts", "Contracts"],
    ["events", "Events"],
  ] as const;
  const inSystem = (id: string, s: string) => {
    const n = TREE_NODES.find((x) => x.id === id)!;
    return s === "counters" ? n.system === "machines" && !n.id.startsWith("brew-") && n.id !== "machine-garden-calibration" : n.system === s;
  };
  $: systems = SYSTEMS.filter(([id]) => id === "brew" || TREE_NODES.some((n) => inSystem(n.id, id) && n.day <= campaign.day));
  /** A node's name from its id: "prep-hold-bath" reads "Prep hold bath". */
  const PREFIX = new Set(["tea", "menu", "pantry", "room", "promo", "contract", "event", "guest", "crew", "furniture", "decor", "machine"]);
  function nodeName(id: string) {
    const words = id.split("-");
    const rest = PREFIX.has(words[0]) && words.length > 1 ? words.slice(1) : words;
    const text = rest.join(" ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  $: systemTree = system === "brew" ? [] : TREE_NODES.filter((n) => inSystem(n.id, system)).map((n): TreeItem => {
    void campaign.cash;
    const st = nodeStatus(campaign, n.id);
    const price = workshopPrice(campaign, n.cost);
    return {
      id: n.id,
      requires: n.requires,
      name: nodeName(n.id),
      // Crossed out only when the rival in its pair is installed; anything else not to be had is locked, with its reason.
      state: st.status === "owned" || st.status === "open" ? st.status : st.reason.startsWith("The other upgrade") ? "shut" : "locked",
      sprite: upgradeSprite(n.id),
      gains: [n.product.charAt(0).toUpperCase() + n.product.slice(1) + "."],
      costs: [n.drawback],
      ...(st.status === "open" ? { action: n.cost ? "Install it, " + money(price) : "Install it" } : {}),
      reason: st.status === "owned" || st.status === "open" ? "" : st.reason,
    };
  });
  let slot = 0;
  const KEYS = ["Q", "W", "E", "R", "T", "Y"];
  const COUNTERS = ["all", "brew", "prep", "build", "serve", "front", "back"];
  const TIERS = [1, 2, 3];
  $: known = MACHINES.filter((m) => m.day <= campaign.day);
  const firstDay = Math.min(...MACHINES.map((m) => m.day));
  $: counters = COUNTERS.filter((c) => c === "all" || known.some((m) => m.station === c));
  $: catalogue = known.filter((m) => station === "all" || m.station === station);
  $: fitted = installed(campaign);
  $: room = machineSlots(campaign);
  $: slotsFull = fitted.length >= room;
  // Every slot keeps its place, filled or not, so fitting a machine moves nothing.
  $: places = Array.from({ length: Math.max(room, fitted.length) }, (_, i) => fitted[i]);
  $: powers = POWERUPS.filter((p) => p.day <= campaign.day);
  $: slots = rankFor(campaign) >= 30 ? 6 : 5;

  // --- The brew tree, as the tree view shows it ---
  $: shop = campaign.expansion.activeShop;
  $: workshop = campaign.expansion.workshop;
  $: brew = workshop.brew[shop];
  $: tree = UPGRADE_NODES.map((node) => treeItem(node, campaign, live));
  const name = (id: string) => UPGRADE_NODES.find((n) => n.id === id)?.name.toLowerCase() ?? id;
  function has(c: Campaign, id: string) {
    const node = UPGRADE_NODES.find((n) => n.id === id);
    const w = c.expansion.workshop;
    if (node?.kind === "bench") return w.brewBench;
    if (node?.kind === "part") return (w.parts[node.id] ?? 0) > 0;
    return !!w.brew[c.expansion.activeShop]?.unlocked.includes(id as never);
  }
  function treeItem(node: UpgradeNode, c: Campaign, busy: boolean): TreeItem {
    const price = workshopPrice(c, node.cost);
    const missing = node.requires.filter((id) => !has(c, id));
    const parts = Object.entries(node.partsConsumed).filter(([id, n]) => (c.expansion.workshop.parts[id as never] ?? 0) < (n ?? 0));
    const short = c.cash < price;
    const base = { id: node.id, requires: node.requires, name: node.name, sprite: upgradeSprite(node.id) };
    const why = busy
      ? "Change the workshop between shifts."
      : missing.length
        ? "Needs " + missing.map(name).join(" and ") + "."
        : parts.length
          ? "Needs a " + parts.map(([id]) => name(id)).join(" and a ") + "."
          : short
            ? "Needs " + money(price) + " in the till."
            : "";
    const can = !busy && !missing.length && !parts.length && !short;
    if (node.kind === "bench") {
      const owned = c.expansion.workshop.brewBench;
      return { ...base, state: owned ? "owned" : missing.length ? "locked" : "open", gains: ["Opens the parts and kits below."], costs: [node.drawback], ...(owned ? {} : { action: "Build it, " + money(price), ready: can, reason: why }) };
    }
    if (node.kind === "part") {
      const held = c.expansion.workshop.parts[node.id] ?? 0;
      const tool = Object.keys(c.expansion.machines).some((k) => node.effects.tools.includes(machineModel(k)));
      const uses = UPGRADE_NODES.filter((n) => n.partsConsumed[node.id as never]).map((n) => n.name.toLowerCase());
      return {
        ...base,
        state: held ? "owned" : missing.length ? "locked" : "open",
        count: held,
        gains: ["Goes into " + uses.join(", ") + "."],
        costs: [node.drawback],
        action: "Make one, " + money(price),
        ready: can && tool,
        reason: why || (tool ? "" : "Needs one of these machines: " + node.effects.tools.map((t) => machineDefinition(t)?.name ?? t).join(", ") + "."),
      };
    }
    const unlocked = !!c.expansion.workshop.brew[c.expansion.activeShop]?.unlocked.includes(node.id);
    const active = c.expansion.workshop.brew[c.expansion.activeShop]?.active ?? null;
    const e = node.effects;
    const gains = [
      e.speed > 1 ? `Works ${e.speed}× as fast.` : "",
      e.capacity > 1 ? `Runs ${e.capacity} cups at once.` : "",
      e.grade > 88 ? `Brews to grade ${e.grade}.` : "",
      e.wear < 1 ? "Wears machines more slowly." : "",
      e.power === 0 ? "Keeps working in a power cut." : "",
    ].filter(Boolean);
    const costs = [
      e.grade < 88 ? `Brews to grade ${e.grade}.` : "",
      e.speed < 1 ? `Works at ${e.speed}× speed.` : "",
      e.power > 0 ? `Each job draws ${e.power} of ${BREW_POWER_BUDGET} power.` : "",
      e.wear > 1 ? `Wears machines ${e.wear}× as fast.` : "",
      node.drawback,
    ].filter(Boolean);
    if (!unlocked)
      return { ...base, state: missing.length ? "locked" : "open", gains, costs, action: "Unlock it, " + money(price), ready: can, reason: why };
    if (active === node.id)
      return { ...base, state: "owned", fitted: true, gains, costs, action: "Take it off, " + money(workshopPrice(c, BREW_RESPEC_COST)), ready: !busy && c.cash >= workshopPrice(c, BREW_RESPEC_COST), reason: busy ? why : "Fitted at this shop." };
    return { ...base, state: "owned", gains, costs, ...(active ? { reason: "Take the fitted kit off first." } : { action: "Fit it", ready: !busy }) };
  }
  /** The fitted kit's rig, on a brew machine it works with. */
  function kitFor(id: string) {
    const kit = UPGRADE_NODES.find((n) => n.id === brew?.active);
    const m = machineDefinition(id);
    if (kit?.kind !== "mod" || m?.station !== "brew") return "";
    return !kit.effects.skills || m.skills.some((sk) => kit.effects.skills!.includes(sk)) ? kit.id : "";
  }
  function treeAct(id: string) {
    const node = UPGRADE_NODES.find((n) => n.id === id);
    if (!node) return;
    if (node.kind === "part") return action("craft-part", { id });
    if (node.kind === "bench" || !brew?.unlocked.includes(node.id as never)) return action("unlock-upgrade", { id });
    if (brew?.active === node.id) return action("respec-mod", { id });
    return action("choose-mod", { id });
  }
</script>

<div class="workshop">
  <div class="top">
    <div class="bk-keys" role="group" aria-label="Workshop page">
      <button type="button" class="boba-key" aria-pressed={page === "machines"} onclick={() => (page = "machines")}>Machines</button>
      <button type="button" class="boba-key" aria-pressed={page === "belt"} onclick={() => (page = "belt")}>Tool belt</button>
      <button type="button" class="boba-key" aria-pressed={page === "upgrades"} onclick={() => (page = "upgrades")}>Upgrades</button>
    </div>
    <span class="bk-grow"></span>
    <div class="bk-keys">
      <button
        type="button"
        class="boba-key"
        disabled={campaign.day < 6}
        title={campaign.day < 6 ? "Opens on day 6" : undefined}
        onclick={() => action("view", { id: "arrange" })}>Arrange the room</button
      >
      <button
        type="button"
        class="boba-key"
        disabled={campaign.day < 4}
        title={campaign.day < 4 ? "Opens on day 4" : undefined}
        onclick={() => action("view", { id: "chores" })}>Upkeep</button
      >
    </div>
  </div>

  {#if page === "machines" && !known.length}
    <p class="bk-empty">The first machines arrive on day {firstDay}.</p>
  {:else if page === "machines"}
    <section class="bk-section" aria-label="Machine slots">
      <div class="bk-cap">
        <OrderPixelWord text="Slots" cells={2} /><span class="bk-meta">{fitted.length} of {room} used</span>
        {#if slotsFull}<span class="bk-meta">Every slot is taken.</span>{/if}
      </div>
      <div class="bk-tiles slots" style:--n={Math.min(6, places.length)}>
        {#each places as place, i (place ? place[0] : "empty-" + i)}
          {#if place}
            {@const id = machineModel(place[0])}
            {@const state = place[1]}
            <div class="bk-tile machine" class:is-hot={state.condition < 40}>
              <span class="pic"><Machine {id} tier={state.tier} size={48} kit={kitFor(id)} /></span>
              <span class="bk-name">{machineDefinition(place[0])?.name ?? ""}</span>
              <span class="n" class:warn={state.condition < 40}><span class="sr-only">Condition </span>{Math.round(state.condition)}%</span>
              <button
                type="button"
                class="boba-key is-small wide"
                aria-pressed={state.automatic}
                onclick={() => action("automatic", { id, value: !state.automatic })}>Runs itself</button
              >
            </div>
          {:else}
            <!-- An empty slot holds a fitted one's places, so fitting a machine grows nothing. -->
            <div class="bk-tile machine is-empty">
              <span class="pic"><span class="hole"></span></span>
              <span class="bk-name">Empty slot</span>
              <span class="boba-key is-small wide gone" aria-hidden="true">Runs itself</span>
            </div>
          {/if}
        {/each}
      </div>
    </section>

    <section class="bk-section" aria-label="Catalogue">
      <div class="bk-cap wraps">
        <OrderPixelWord text="Catalogue" cells={2} />
        <div class="bk-keys" role="group" aria-label="Counter">
          {#each counters as c (c)}
            <button type="button" class="boba-key is-small" aria-pressed={station === c} onclick={() => (station = c)}>{c}</button>
          {/each}
        </div>
      </div>
      <div class="bk-tiles is-fill" style:--min="140px">
        {#each catalogue as machine (machine.id)}
          {@const own = machineAt(campaign, machine.id)}
          {@const tier = own?.tier ?? 0}
          {@const cost = Math.round(machine.price * (tier === 0 ? 1 : tier === 1 ? 1.2 : 1.7) * TUNING[campaign.mode].purchase)}
          <div class="bk-tile machine">
            <span class="pic"><Machine id={machine.id} tier={tier || 1} size={56} /></span>
            <span class="bk-name">{machine.name}</span>
            <span class="bk-tally tiers" role="img" aria-label={"Tier " + tier + " of 3"}
              >{#each TIERS as n (n)}<i class:on={n <= tier}></i>{/each}</span
            >
            <button
              type="button"
              class="boba-key is-small wide"
              disabled={live || tier >= 3 || campaign.cash < cost || (!own && slotsFull)}
              aria-label={tier >= 3 ? machine.name + ", fully upgraded" : (tier === 0 ? "Fit " : "Upgrade ") + machine.name + ", " + money(cost)}
              onclick={() => action("buy-machine", { id: machine.id })}
              >{tier >= 3 ? "Fully upgraded" : (tier === 0 ? "Fit it, " : "Upgrade, ") + money(cost)}</button
            >
          </div>
        {/each}
      </div>
    </section>
  {:else if page === "upgrades"}
    <section class="upgrades" aria-label="Upgrades">
      <div class="bk-keys" role="group" aria-label="System">
        {#each systems as [id, label] (id)}
          <button type="button" class="boba-key is-small" aria-pressed={system === id} onclick={() => ((system = id), (pickedNode = ""))}>{label}</button>
        {/each}
      </div>
      {#if system === "brew"}
        <div class="bk-cap"><OrderPixelWord text="Brew" cells={2} /><span class="bk-meta">One kit fitted at a time</span></div>
        <UpgradeTree items={tree} bind:picked={pickedNode} act={treeAct} label="Brew upgrades" />
      {:else}
        {@const label = SYSTEMS.find(([id]) => id === system)?.[1] ?? ""}
        <div class="bk-cap"><OrderPixelWord text={label} cells={2} /><span class="bk-meta">One of each pair per shop</span></div>
        {#key system}<UpgradeTree items={systemTree} bind:picked={pickedNode} act={(id) => action("unlock-node", { id })} label={label + " upgrades"} />{/key}
      {/if}
    </section>
  {:else}
    <section class="bk-section" aria-label="Tool belt">
      <div class="bk-cap"><OrderPixelWord text="Belt" cells={2} /><span class="bk-meta">Pick a slot, then a powerup for it</span></div>
      <div class="bk-tiles belt" style:--n={slots} role="group" aria-label="Tool belt slots">
        {#each Array.from({ length: slots }) as _, i (i)}
          {@const power = POWERUPS.find((p) => p.id === campaign.expansion.loadout[i])}
          <button
            type="button"
            class="bk-tile belt-slot"
            class:is-on={slot === i}
            aria-pressed={slot === i}
            aria-label={"Slot " + KEYS[i] + (power ? ", " + power.name : ", empty")}
            onclick={() => (slot = i)}
          >
            <span class="pic">{#if power}<Icon art={power.art} size={32} />{:else}<span class="hole"></span>{/if}</span>
            <kbd>{KEYS[i]}</kbd>
          </button>
        {/each}
      </div>
    </section>

    <section class="bk-section" aria-label="Powerups">
      <div class="bk-cap"><OrderPixelWord text="Powerups" cells={2} /></div>
      <div class="bk-tiles is-fill powers" style:--min="196px">
        {#each powers as power (power.id)}
          {@const have = campaign.expansion.powerups[power.id] ?? 0}
          <div class="bk-tile power">
            <span class="n" class:zero={!have}><span class="sr-only">Have </span>{have}</span>
            <span class="pic"><Icon art={power.art} size={40} /></span>
            <span class="bk-name">{power.name}</span>
            <span class="bk-lbl what" title={power.description}>{power.description}</span>
            <div class="keys">
              <button
                type="button"
                class="boba-key is-small"
                aria-pressed={campaign.expansion.loadout[slot] === power.id}
                disabled={live}
                onclick={() => action("loadout", { slot, id: power.id })}>On {KEYS[slot]}</button
              >
              <button
                type="button"
                class="boba-key is-small"
                disabled={live || campaign.cash < power.price}
                aria-label={"Buy one " + power.name + " for " + money(power.price)}
                onclick={() => action("buy-power", { id: power.id })}>{money(power.price)}</button
              >
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .workshop {
    display: grid;
    gap: 14px;
    align-content: start;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }

  .top .boba-key {
    min-height: 34px;
  }

  .wraps {
    flex-wrap: wrap;
    row-gap: 8px;
  }

  /* Every tile in a row holds its picture, name, fact and key at the same heights. */
  .workshop .bk-tile.machine,
  .workshop .bk-tile.power {
    align-content: start;
    gap: 6px;
    padding: 12px 8px 10px;
  }

  .pic {
    display: grid;
    place-items: center;
    height: 56px;
  }

  .slots .pic {
    height: 48px;
  }

  /* A name keeps two lines' height and centres in it, one line or two. */
  .workshop .bk-tile .bk-name {
    display: grid;
    place-items: center;
    height: 30px;
    overflow: hidden;
    font-weight: 400;
    font-size: 12px;
    line-height: 15px;
  }


  .tiers {
    align-items: center;
    height: 18px;
  }

  .bk-tile .bk-tally.tiers i {
    width: 12px;
  }

  .wide {
    justify-self: stretch;
  }

  .workshop .is-empty .bk-name {
    color: var(--lg-muted);
  }

  .gone {
    visibility: hidden;
  }

  .hole {
    width: 26px;
    height: 26px;
    box-shadow: inset 0 0 0 2px var(--lg-line);
  }

  /* The belt: one fixed-size key per slot. */
  .belt {
    max-width: calc(var(--n) * 96px);
  }

  .workshop .bk-tile.belt-slot {
    position: relative;
    height: 64px;
    padding: 0;
  }

  .belt-slot .pic {
    height: 40px;
  }

  .belt-slot .hole {
    width: 22px;
    height: 22px;
  }

  .belt-slot kbd {
    position: absolute;
    right: 5px;
    bottom: 5px;
  }

  .n {
    position: absolute;
    top: 8px;
    right: 9px;
    color: var(--lg-cream);
    font: 700 16px/1 var(--font-display);
  }

  .n.zero {
    color: var(--lg-muted);
    font-weight: 500;
  }

  .n.warn {
    color: var(--lg-orange-hi);
  }

  .slots .n {
    font: 600 12px/1 var(--font-ui);
  }

  .bk-tile .bk-lbl.what {
    display: -webkit-box;
    height: 42px;
    overflow: hidden;
    line-height: 14px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .keys {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    justify-self: stretch;
    margin-top: 2px;
  }

  @media (max-width: 760px) {
    .slots {
      --n: 3 !important;
    }

    .belt {
      max-width: none;
    }

    /* Two powerups a row on a phone, with room for the longest description. */
    .powers {
      --min: 150px !important;
    }

    .bk-tile .bk-lbl.what {
      height: 70px;
      -webkit-line-clamp: 5;
      line-clamp: 5;
    }
  }
</style>
