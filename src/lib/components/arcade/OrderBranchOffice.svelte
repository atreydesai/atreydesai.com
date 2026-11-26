<script lang="ts">
  import {
    BRANCHES, BRANCH_FITTINGS, BRANCH_MANAGER, CREW_CERTIFICATE_SHIFTS, branchPurchasePrice, branchRentCharge, levelFor, MANAGED_ORDER_CAP, managedOrderInterval,
    managerMenuOptions, managerOrderCap, managerOrderInterval, managerOnDuty, managerPantryForecast, managerTrained, managerWage, selectedManagerMenu, type BranchId, type Campaign, type ManagerMenuId,
  } from "#lib/arcade/orders-campaign.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import OrderBranchStamp from "./OrderBranchStamp.svelte";
  import OrderKitchenItem from "./OrderKitchenItem.svelte";
  import "./order-pixel.css";

  interface Props {
    campaign: Campaign;
    disabled?: boolean;
    onBuy: (id: BranchId) => void;
    onOpen: (id: BranchId) => void;
    onRunner: (id: BranchId | null) => void;
    onManager: (id: BranchId | null) => void;
    onHireManager: (id: BranchId) => void;
    onScheduleManager: (id: BranchId, working: boolean) => void;
    onCertifyManager: (id: BranchId) => void;
    onFit: (id: BranchId) => void;
    onMenu: (branch: BranchId, menu: ManagerMenuId) => void;
  }

  let { campaign, disabled = false, onBuy, onOpen, onRunner, onManager, onHireManager, onScheduleManager, onCertifyManager, onFit, onMenu }: Props = $props();
  const mapId = $props.id();
  let inspected = $state<BranchId | null>(null);
  const shortNames: Record<BranchId, string> = {
    corner: "Corner", campus: "Campus", garden: "Garden",
    night: "Night Market", station: "Station", harbor: "Harbor", loft: "Skyline Loft",
  };
  const tags = {
    main: { label: "Next shift", icon: "cup" },
    runner: { label: "Runner", icon: "serve" },
    manager: { label: "Manager", icon: "street-sign" },
    owned: { label: "Owned", icon: "ticket" },
  };

  const branch = $derived(BRANCHES.find(({ id }) => id === (inspected ?? campaign.activeBranch)) ?? BRANCHES[0]);
  const owned = $derived(campaign.branches.includes(branch.id));
  const main = $derived(campaign.activeBranch === branch.id);
  const runner = $derived(campaign.managedBranch === branch.id);
  const manager = $derived(managerOnDuty(campaign, branch.id));
  const localManager = $derived(campaign.locationManagers[branch.id]);
  const certifiedManager = $derived(managerTrained(campaign, branch.id));
  const certifiedRunner = $derived(campaign.certifiedCrew.includes("runner"));
  const menu = $derived(selectedManagerMenu(campaign, branch.id));
  const availableMenus = $derived(manager ? managerMenuOptions(campaign, branch.id) : []);
  const menuSupply = $derived(manager ? managerPantryForecast(campaign).find((entry) => entry.branch === branch.id)?.orders ?? 0 : 0);
  const level = $derived(levelFor(campaign));
  const price = $derived(branchPurchasePrice(campaign, branch));
  const fitting = $derived(BRANCH_FITTINGS[branch.id]);
  const fitted = $derived(campaign.branchFittings.includes(branch.id));
  const locked = $derived(disabled || campaign.status !== "planning");
</script>

<div class="office-map">
  <svg viewBox="0 0 300 164" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path fill="#e1d5a6" d="M0 0H300V164H0Z" />
    <path fill="#cfce9e" d="M213 0H300V68H230V55H208Z" />
    <path fill="#a1bbb0" d="M300 99H273V113H260V132H243V148H227V164H300Z" />
    <path fill="none" stroke="#c19166" stroke-width="11" d="M0 79H192V86H300M101 0V79M192 86V164" />
    <path fill="none" stroke="#f3deb3" stroke-width="7" d="M0 79H192V86H300M101 0V79M192 86V164" />
    <path fill="none" stroke="#ab9071" stroke-width="6" stroke-dasharray="2 4" d="M0 148H230V132H260" />
    <path fill="none" stroke="#8d7b66" stroke-width="1" d="M0 145H227V129H260M0 151H233V135H260" />
    <path fill="none" stroke="#d1ddd1" stroke-width="2" d="M270 144h15m-27 10h16m8-34h12m-8 17h14" />
  </svg>
  <ul aria-label="Branch locations">
    {#each BRANCHES as location (location.id)}
      {@const marker = location.id === campaign.activeBranch ? tags.main
        : location.id === campaign.managedBranch ? tags.runner
        : managerOnDuty(campaign, location.id) ? tags.manager
        : campaign.branches.includes(location.id) ? tags.owned : null}
      <li class:skyline={location.id === "loft"}>
        <button class="map-pin" type="button" aria-label={`Inspect ${location.name}`}
          aria-describedby={marker ? mapId + "-" + location.id : undefined}
          aria-pressed={branch.id === location.id} onclick={() => inspected = location.id}>
          <OrderBranchStamp branch={location.id} size={51} />
          <strong>{shortNames[location.id]}</strong>
          {#if marker}
            <span class="map-marker" id={mapId + "-" + location.id}>
              <OrderKitchenItem kind={marker.icon} size={13} />{marker.label}
            </span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</div>

<section class="branch-detail" aria-label={branch.name}>
  <strong>{branch.name}</strong>
  <p>{branch.description}</p>
  {#if branch.id !== "corner"}
    <p class="facts">
      <span><OrderKitchenItem kind="rush" size={15} />{Math.round(branch.arrivalMultiplier * 100)}% traffic</span>
      <span><OrderKitchenItem kind="patience" size={15} />{Math.round(branch.patienceMultiplier * 100)}% wait</span>
      <span>+{money(branch.income)} per sale</span>
      <span>+{money(branchRentCharge(campaign.mode, branch.rent))} rent</span>
    </p>
  {/if}
  {#if manager}
    <p class="facts assignment">
      <span><OrderKitchenItem kind={menu.icon} size={16} />{menu.name}, {money(menu.price)} per cup</span>
      <span>Stock covers {menuSupply}/{managerOrderCap(certifiedManager)} · One every {managerOrderInterval(campaign.mode, certifiedManager)}s</span>
      <span>{money(managerWage(certifiedManager))} wages per shift</span>
    </p>
  {:else if runner}
    <p class="assignment">Your runner sells up to {MANAGED_ORDER_CAP} milk teas from the shared pantry, one every {managedOrderInterval(campaign.mode, certifiedRunner)}s.</p>
  {/if}
  {#if owned && !main}
    {#if !localManager && !manager && level < BRANCH_MANAGER.level}
      <p class="assignment">Managers unlock at level {BRANCH_MANAGER.level}.</p>
    {/if}
    <div class="actions">
      <button class="boba-key order-pixel-paper-key" type="button" disabled={locked}
        aria-label={`Open at ${branch.name}`} onclick={() => onOpen(branch.id)}>Open here</button>
      {#if campaign.crew.includes("runner")}
        <button class="boba-key order-pixel-paper-key" type="button" disabled={locked || manager} aria-pressed={runner}
          aria-label={`Staff side stand at ${branch.name}`} onclick={() => onRunner(runner ? null : branch.id)}>
          {runner ? "Stand staffed" : "Send runner to stand"}
        </button>
      {/if}
      {#if localManager}
        <button class="boba-key order-pixel-paper-key" type="button" disabled={locked} aria-pressed={manager}
          aria-label={manager ? `Give the manager at ${branch.name} the day off` : `Schedule the manager at ${branch.name}`}
          onclick={() => onScheduleManager(branch.id, !manager)}>
          {manager ? "Manager on duty" : "Schedule manager"}
        </button>
      {:else if campaign.crew.includes("manager") && (manager || !campaign.managerBranch) && !runner}
        <button class="boba-key order-pixel-paper-key" type="button" disabled={locked || runner} aria-pressed={manager}
          aria-label={`Send manager to ${branch.name}`} onclick={() => onManager(manager ? null : branch.id)}>
          {manager ? "Manager assigned" : "Send manager"}
        </button>
      {:else}
        <button class="boba-key order-pixel-paper-key" type="button"
          disabled={locked || level < BRANCH_MANAGER.level || campaign.cash < BRANCH_MANAGER.price}
          aria-label={`Hire manager at ${branch.name} for ${money(BRANCH_MANAGER.price)}`} onclick={() => onHireManager(branch.id)}>
          Hire manager · {money(BRANCH_MANAGER.price)}
        </button>
      {/if}
    </div>
  {:else if !owned}
    <div class="actions">
      <button class="boba-key order-pixel-paper-key" type="button" disabled={locked || level < branch.level || campaign.cash < price}
        aria-label={`Buy ${branch.name} for ${money(price)}`} onclick={() => onBuy(branch.id)}>Buy for {money(price)}</button>
      {#if level < branch.level}<span>Level {branch.level}</span>{/if}
    </div>
  {/if}
  {#if owned}
    <section class="fitting" aria-label={branch.name + " renovation"}>
      <OrderKitchenItem kind="street-sign" size={25} lit={fitted} />
      <div>
        <strong>{fitting.name}</strong>
        <small>{fitting.description}</small>
        {#if !fitted && level < fitting.level}<small>Level {fitting.level}</small>{/if}
        {#if fitting.addedRent}<small>+{money(fitting.addedRent)} rent</small>{/if}
      </div>
      {#if fitted}<small class="fitted">Built</small>
      {:else}
        <button class="boba-key order-pixel-paper-key" type="button"
          disabled={locked || level < fitting.level || campaign.cash < fitting.price}
          aria-label={`Build ${fitting.name} for ${money(fitting.price)}`} onclick={() => onFit(branch.id)}>{money(fitting.price)}</button>
      {/if}
    </section>
  {/if}
  {#if localManager && !localManager.certified}
    <div class="fitting">
      <OrderKitchenItem kind="quality" size={25} lit={localManager.shifts >= CREW_CERTIFICATE_SHIFTS} />
      <div>
        <strong>{BRANCH_MANAGER.certificate.name}</strong>
        <small>{localManager.shifts} of {CREW_CERTIFICATE_SHIFTS} shifts with sales</small>
      </div>
      {#if localManager.shifts >= CREW_CERTIFICATE_SHIFTS}
        <button class="boba-key order-pixel-paper-key" type="button" disabled={locked || campaign.cash < BRANCH_MANAGER.certificate.price}
          onclick={() => onCertifyManager(branch.id)}>Train · {money(BRANCH_MANAGER.certificate.price)}</button>
      {/if}
    </div>
  {/if}
  {#if availableMenus.length > 1}
    <div class="manager-menu" role="group" aria-label="Manager's menu">
      <strong>Manager’s menu</strong>
      <div>
        {#each availableMenus as option (option.id)}
          <button type="button" class="boba-key order-pixel-paper-key" disabled={locked} aria-pressed={menu.id === option.id}
            aria-label={`Stock ${option.name} at ${branch.name}`} onclick={() => onMenu(branch.id, option.id)}>
            <OrderKitchenItem kind={option.icon} size={24} /><span>{option.name}<small>{money(option.price)}/cup</small></span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .fitting {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 6px;
    color: #5b4535;
    background: #ebd7b4;
    clip-path: var(--notch);
  }
  .fitting strong, .fitting small { display: block; }
  .fitting strong { font-size: .83rem; }
  .fitting small { font-size: .72rem; line-height: 1.25; }
  .fitting button { min-height: 44px; padding-inline: 6px; }
  .fitting .fitted { color: #455d3c; font-weight: 700; }
  .manager-menu { margin-top: 10px; }
  .manager-menu > strong { font-size: .82rem; }
  .manager-menu > div { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 94px), 1fr)); gap: 5px; margin-top: 4px; }
  .manager-menu button {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    padding-inline: 5px;
    min-height: 44px;
    font-size: .72rem;
    text-align: left;
  }
  .manager-menu button[aria-pressed="true"] { --key-face: var(--b-mine); --key-rule: var(--b-accent); }
  .manager-menu button small { display: block; font-size: .65rem; }
  .manager-menu button :global(svg) { flex: none; }
  .office-map {
    position: relative;
    isolation: isolate;
    border: 1px solid #896c53;
    background: #e1d5a6;
  }

  .office-map > svg {
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
    z-index: -1;
  }

  ul {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: .45rem .3rem;
    list-style: none;
    padding: .35rem;
    margin: 0;
  }
  li.skyline { grid-column: 2; }

  .map-pin {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .18rem;
    width: 100%;
    height: 100%;
    min-height: 5.2rem;
    border: 1px solid transparent;
    background: transparent;
    color: #49362f;
    font: inherit;
    font-size: .72rem;
    padding: .16rem 0;
    cursor: pointer;
    line-height: 1.1;
  }

  .map-pin > strong {
    background: #f6e5bb;
    padding: .14rem;
    text-align: center;
  }

  .map-pin:hover, .map-pin[aria-pressed="true"] {
    background: #f9ebc790;
    border-color: #96725a;
  }

  .map-pin[aria-pressed="true"] {
    box-shadow: inset 0 0 0 1px #96725a;
  }

  .map-pin:focus-visible {
    outline: 2px solid #754334;
    outline-offset: 2px;
  }

  .map-marker {
    display: inline-flex;
    align-items: center;
    gap: .12rem;
    padding: 0 .13rem;
    color: #f7e9c5;
    background: #535e48;
    font-size: .62rem;
  }

  .branch-detail {
    display: grid;
    gap: .27rem;
    padding-block-start: .6rem;
    font-size: .76rem;
    line-height: 1.3;
  }

  .branch-detail > strong { font-size: .9rem; }
  p { margin: 0; }
  .facts, .actions { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem .55rem; }
  .facts span { display: inline-flex; align-items: center; gap: .18rem; }
  .assignment { margin-block-start: .18rem; }
  .actions { margin-block-start: .2rem; }
  .actions button { min-height: 2rem; padding-inline: .48rem; font-size: .72rem; }
  .actions button[aria-pressed="true"] { background-color: #dbd9ac; }
</style>
