<script lang="ts">
  import { tick } from "svelte";
  import {
    BRANCHES, CREW, CREW_CERTIFICATE_SHIFTS, INGREDIENTS, NEIGHBORHOOD_AWARDS, RENT_CYCLE_DAYS,
    POWERUPS, PROMOTIONS_BOARD,
    SUPPLIERS, STANDING_ORDER_LIMIT, STANDING_ORDER_THRESHOLD,
    UPGRADES,
    crewWages, managerBranches, dayEvent, dayTakings, daysUntilRent, deliveryShelfLife,
    eventForDay,
    levelFor, levelProgress,
    neighborhoodAwardCount, nextExpiry,
    rentDue,
    stockCount,
    supplierPrice,
    type Campaign,
    type BranchId, type CrewId, type ManagerMenuId,
    type IngredientId,
    type PowerupId, type PublicityId,
    type SupplierId,
    type UpgradeId,
  } from "#lib/arcade/orders-campaign.ts";
  import { RECIPE_BOOK, REGULARS, reservationForDay, unlockedIngredients, type openingShortages, type HouseBlend } from "#lib/arcade/orders-service.ts";
  import { cateringOffer } from "#lib/arcade/orders-catering.ts";
  import type { BlendTin } from "#lib/arcade/orders-blend-tin.ts";
  import type { CupPrintId } from "#lib/arcade/orders-recipe-journal.ts";
  import { figure } from "#lib/arcade/orders-guests.js";
  import { money } from "#lib/arcade/orders-display.ts";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import OrderPixelWord from "./OrderPixelWord.svelte";
  import OrderKitchenItem from "./OrderKitchenItem.svelte";
  import OrderBranchStamp from "./OrderBranchStamp.svelte";
  import OrderBranchOffice from "./OrderBranchOffice.svelte";
  import OrderCommissionNote from "./OrderCommissionNote.svelte";
  import OrderHouseBlend from "./OrderHouseBlend.svelte";
  import OrderKeepsakeCabinet from "./OrderKeepsakeCabinet.svelte";
  import OrderGuestStamps from "./OrderGuestStamps.svelte";
  import { completedGuestCards, guestbookNote, guestbookStamps, GUESTBOOK_STAMP_GOAL, SHOP_KEEPSAKES, shopKeepsakes } from "#lib/arcade/orders-guestbook.ts";
  import OrderPantryShelf from "./OrderPantryShelf.svelte";
  import OrderRecipeAlbum from "./OrderRecipeAlbum.svelte";
  import OrderRentEnvelope from "./OrderRentEnvelope.svelte";
  import OrderRentStatement from "./OrderRentStatement.svelte";
  import OrderShiftBoard from "./OrderShiftBoard.svelte";
  import OrderTakeoutTray from "./OrderTakeoutTray.svelte";
  import type { ShiftContractProgress } from "#lib/arcade/orders-challenges.ts";
  import { SHOP_PAINTS, shopPaint, type CommissionOffer, type ShopPaintId } from "#lib/arcade/orders-commissions.ts";
  import "./order-pixel.css";

  export let campaign: Campaign;
  export let initialReceipt = false;
  export let hasActiveShift = false;
  export let hasPrepShift = false;
  export let saveNotice = "";
  export let contracts: readonly ShiftContractProgress[] = [];
  export let commission: CommissionOffer | null = null;
  export let todaySpecials: readonly string[] = [];
  export let shortages: Readonly<ReturnType<typeof openingShortages>> = [];
  export let tableBooked = false;
  export let cateringBooked = false;
  export let houseBlend: HouseBlend | null = null;
  export let todayBlend: HouseBlend | null = null;
  export let blendTin: BlendTin;
  export let onStart: (startPrep?: boolean) => void;
  export let onPractice: (customerId?: string) => void;
  export let onPrint: (id: CupPrintId) => void;
  export let onBuyUpgrade: (id: UpgradeId) => void;
  export let onBuyPowerup: (id: PowerupId) => void;
  export let onOrderStock: (ingredient: IngredientId, supplier: SupplierId, crates: number) => void;
  export let onStandingOrder: (ingredient: IngredientId, supplier: SupplierId | null) => void;
  export let onHire: (id: CrewId) => void;
  export let onCertify: (id: CrewId) => void;
  export let onAssign: (id: CrewId, active: boolean) => void;
  export let onBuyBranch: (id: BranchId) => void;
  export let onFitBranch: (id: BranchId) => void;
  export let onSelectBranch: (id: BranchId) => void;
  export let onManagedBranch: (id: BranchId | null) => void;
  export let onHireLocationManager: (id: BranchId) => void;
  export let onScheduleLocationManager: (id: BranchId, working: boolean) => void;
  export let onCertifyLocationManager: (id: BranchId) => void;
  export let onManagerBranch: (id: BranchId | null) => void;
  export let onManagerMenu: (branch: BranchId, menu: ManagerMenuId) => void;
  export let onPublicity: (id: PublicityId) => void;
  export let onReserve: (booked: boolean) => void;
  export let onCatering: (booked: boolean) => void;
  export let onCommission: () => void;
  export let onPaint: (paint: ShopPaintId) => void;
  export let onHouseBlend: (value: HouseBlend | null) => void;
  export let onBlendTin: (book: BlendTin) => void;
  export let onRestart: () => void;

  type View = "opening" | "receipt" | "pantry" | "workshop" | "office" | "regulars" | "house";
  const tools = [
    { id: "pantry", name: "Pantry", icon: "popping" },
    { id: "workshop", name: "Workshop", icon: "brew" },
    { id: "office", name: "Shop office", icon: "street-sign" },
    { id: "regulars", name: "Regulars", icon: "clip" },
    { id: "house", name: "House blend", icon: "cup" },
  ] as const;
  const ingredientNames = new Map(INGREDIENTS.map(({ id, name }) => [id, name]));
  const equipmentGroup = new Set<UpgradeId>(["auto-tea", "auto-milk", "auto-toppings", "auto-extras", "auto-sealer", "batch-timers", "warm-shelf", "cold-storage", "tea-carafe", "supplier-ledger"]);
  const equipmentGroups = [
    { name: "Kitchen automation", items: UPGRADES.filter(({ id }) => equipmentGroup.has(id)) },
    { name: "Shop improvements", items: UPGRADES.filter(({ id }) => !equipmentGroup.has(id)) },
  ];
  const equipmentIcons: Record<UpgradeId, string> = {
    "cozy-seats": "cozy-seats", "street-sign": "street-sign", "better-recipe": "quality", "auto-tea": "brew",
    "auto-milk": "milk", "auto-toppings": "pearls", "auto-extras": "supplies",
    "batch-timers": "patience", "tip-jar": "special", "cold-storage": "ice", "pickup-counter": "serve",
    "menu-easel": "street-sign", "tea-carafe": "carafe", "supplier-ledger": "reorder", "warm-shelf": "warm-shelf",
    "cold-tray": "ice", "ticket-rack": "ticket", "auto-sealer": "seal", "wall-calendar": "patience", "takeout-rack": "serve", "opening-key": "prep",
  };
  const crewIcons = { host: "clip", prep: "prep", runner: "serve", manager: "street-sign" };
  const branchIcons = { corner: "cup", campus: "clip", garden: "jasmine", night: "quality", station: "bell", harbor: "plain", loft: "jasmine" };
  const publicityIcons = { "sidewalk-samples": "cup", "loyalty-stamps": "quality", "fruit-chalkboard": "strawberry" };
  const dayIcons: Record<string, string> = {
    neighborhood: "cup", rain: "plain", campus: "rush", "tip-day": "special", "market-day": "stock",
    "book-club": "clip", festival: "bell", commute: "patience", "fruit-special": "strawberry",
    candlelight: "seal", "bottle-return": "seltzer",
  };
  const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });
  let view: View = "opening";
  let regularPage: "guests" | "recipes" = "guests";
  let inspectedMonth: number | null = null;
  let pageHeading: HTMLHeadingElement;
  let shelfHeading: HTMLHeadingElement;
  let supplierHeading: HTMLHeadingElement;
  let ingredient: IngredientId = INGREDIENTS[0].id;
  let crates = 1;

  $: closing = campaign.lastDay;
  $: months = [...(campaign.rentBook.current ? [campaign.rentBook.current] : []), ...campaign.rentBook.history.slice().reverse()];
  $: viewedMonth = months.find(({ month }) => month === inspectedMonth) ?? months[0];
  $: closingMonth = campaign.rentBook.history.find(({ lastDay }) => lastDay === closing?.day);
  $: if (initialReceipt) view = "receipt";
  $: notice = saveNotice === closing?.reason ? "" : saveNotice;
  $: closed = campaign.status === "closed";
  $: page = closed ? "receipt" : view === "receipt" && !closing ? "opening" : view;
  $: utility = tools.find(({ id }) => id === page);
  $: heading = closed ? "Shop closed" : page === "receipt" ? "Day " + closing?.day + " receipt" : utility?.name ?? "Day " + campaign.day;
  $: level = levelFor(campaign);
  $: promotionProgress = levelProgress(campaign);
  $: rentIn = daysUntilRent(campaign);
  $: event = dayEvent(campaign.currentEvent);
  $: ingredients = unlockedIngredients(campaign.day);
  $: currentIngredients = INGREDIENTS.filter(({ id }) => ingredients.includes(id));
  $: upcomingIngredients = INGREDIENTS.filter(({ id }) => !ingredients.includes(id));
  $: selected = INGREDIENTS.find(({ id }) => id === ingredient) ?? INGREDIENTS[0];
  $: expiry = nextExpiry(campaign, ingredient);
  $: menu = RECIPE_BOOK.filter(({ day }) => day === campaign.day);
  $: nextMenu = RECIPE_BOOK.find(({ day }) => day > campaign.day);
  $: regulars = REGULARS.filter(({ day }) => day <= campaign.day);
  $: keepsakes = shopKeepsakes(campaign.regularVisits);
  $: completedCards = completedGuestCards(campaign.regularVisits);
  $: activeBranch = BRANCHES.find(({ id }) => id === campaign.activeBranch) ?? BRANCHES[0];
  $: sideStand = BRANCHES.find(({ id }) => id === campaign.managedBranch);
  $: managersWorking = managerBranches(campaign).length;
  $: managedShop = BRANCHES.find(({ id }) => id === campaign.managerBranch);
  $: payroll = crewWages(campaign);
  $: crewGap = Math.max(0, payroll - campaign.cash);
  $: rentGap = rentIn === 0 ? Math.max(0, rentDue(campaign) + payroll - campaign.cash) : 0;
  $: reservation = reservationForDay(campaign.day, campaign.mode === "expert");
  $: catering = campaign.upgrades.includes("takeout-rack") ? cateringOffer(campaign.day, campaign.mode === "expert") : null;
  $: publicity = PROMOTIONS_BOARD.find(({ id }) => id === campaign.publicity);
  $: hasEasel = campaign.upgrades.includes("menu-easel");
  $: hasSupplierLedger = campaign.upgrades.includes("supplier-ledger");
  $: standingCount = Object.keys(campaign.standingOrders ?? {}).length;
  $: standingSupplier = campaign.standingOrders?.[ingredient];
  $: upcomingDays = campaign.upgrades.includes("wall-calendar") ? [1, 2, 3].map((offset) => {
    const day = campaign.day + offset;
    return { day, event: eventForDay(day), rent: day % RENT_CYCLE_DAYS === 0,
      deliveries: campaign.deliveries.filter(({ arrivesOn }) => arrivesOn === day).length };
  }) : [];
  $: awards = neighborhoodAwardCount(campaign.highestReputation);
  $: unlockedAward = closing?.newAward ? NEIGHBORHOOD_AWARDS[closing.newAward - 1] : null;

  export function focus() {
    pageHeading?.focus();
  }

  async function openView(next: View) {
    view = next;
    await tick();
    focus();
  }

  function chooseIngredient(id: IngredientId) {
    ingredient = id;
    crates = 1;
  }

  function focusSupplier() {
    if (!matchMedia("(max-width: 620px)").matches) return;
    supplierHeading?.focus({ preventScroll: true });
    supplierHeading?.scrollIntoView({ block: "start" });
  }

  async function pickFromShelf(id: IngredientId) {
    chooseIngredient(id);
    await tick();
    focusSupplier();
  }

  async function openRestock(id: IngredientId) {
    chooseIngredient(id);
    await openView("pantry");
    focusSupplier();
  }

  function backToShelf() {
    shelfHeading?.focus({ preventScroll: true });
    shelfHeading?.scrollIntoView({ block: "start" });
  }

  function expiryLabel(lots: Campaign["inventory"], item: IngredientId, expiresOn: number, today: number) {
    const count = lots.reduce((total, lot) =>
      lot.ingredient === item && lot.expiresOn === expiresOn ? total + lot.quantity : total, 0);
    const expires = count === 1 ? "expires" : "expire";
    return expiresOn === today + 1 ? `${count} ${expires} tonight` : `${count} ${expires} before day ${expiresOn}`;
  }
</script>

<article class="ledger order-pixel-sheet" class:show-receipt={page === "receipt"} aria-labelledby="order-ledger-heading">
  {#if page === "opening"}
    <div class="opening" class:has-calendar={upcomingDays.length > 0}>
      <div class="opening-main">
        <header class="day-heading">
          <h2 id="order-ledger-heading" tabindex="-1" data-arcade-tab-anchor bind:this={pageHeading}>
            <span class="sr-only">{heading}</span><OrderPixelWord text={heading} cells={2.5} />
          </h2>
          <p class="headline">{event.name}</p>
          <p class="opening-deck">{event.description}</p>
        </header>

        <div class="opening-art" aria-hidden="true">
          {#if activeBranch.id !== "corner"}
          <OrderBranchStamp branch={activeBranch.id} size={153} />
          {:else}
          <svg viewBox="0 0 112 106" width="144" height="136" shape-rendering="crispEdges">
            <path d="M54 4h4v4h-4zM50 8h4v4h-4zm8 0h4v4h-4zm-12 4h4v4h-4zm16 0h4v4h-4zm-20 4h4v4h-4zm24 0h4v4h-4zm-28 4h4v4h-4zm32 0h4v4h-4zm-36 4h4v4h-4zm40 0h4v4h-4z" fill="#8f6753" />
            <path d="M17 31h82v4h4v43h-4v4H17v-4h-4V35h4z" fill="#583534" />
            <path d="M13 27h82v4h4v43h-4v4H13v-4H9V31h4z" fill="#412e30" />
            <path d="M15 31h78v4h2v35h-3v4H15v-4h-2V35h2z" fill="#ba7760" />
            <path d="M18 36h72v32H18z" fill="#506154" />
            <path d="M18 36h72v3H18zm0 29h72v3H18z" fill="#46504a" />
            <path d="M18 32h72v3H18zm0 38h72v2H18z" fill="#edc599" />
            <path d="M27 33h5v5h-5zm48 0h5v5h-5z" fill="#5d463b" />
            <g transform="translate(31 46)" color="#fff0c1"><OrderPixelWord text="Open" cells={2} /></g>
            <path d="M55 83h7v3h-7zM39 90h23v3H39zm20 5h18v3H59z" fill="#ad805f" opacity=".45" />
            {#if event.id === "rain"}
              <path d="M4 46h2v9H4zm0 16h2v9H4zm102-20h2v9h-2zm-2 15h2v13h-2z" fill="#898e9f" />
            {:else if event.id === "festival"}
              <path d="M7 12h6v3h3v10h-3v3H7v-3H4V15h3zm88 0h6v3h3v10h-3v3h-6v-3h-3V15h3z" fill="#c88464" />
              <path d="M8 15h4v9H8zm88 0h4v9h-4z" fill="#ffda98" />
            {:else}
              <path d="M96 8h2v5h5v2h-5v5h-2v-5h-5v-2h5zm-84 7h2v4h4v2h-4v4h-2v-4H8v-2h4z" fill="#cd9d62" />
            {/if}
          </svg>
          {/if}
        </div>

      </div>

      <div class="opening-actions">
        <button class="boba-key is-primary shift-button" type="button" on:click={() => onStart()}>
          {hasPrepShift ? "Resume prep" : hasActiveShift ? "Resume shift" : "Open the shop"}
          {@render arrow()}
        </button>
        {#if !hasActiveShift && campaign.upgrades.includes("opening-key")}
          <button class="boba-key order-pixel-paper-key shift-button" type="button" on:click={() => onStart(true)}>
            <OrderKitchenItem kind="prep" size={22} />Prep before opening
          </button>
        {/if}
        {#if closing}
          <button class="ledger-link previous-receipt" type="button" on:click={() => openView("receipt")}>
            <OrderKitchenItem kind="clip" size={20} /> Day {closing.day} receipt
          </button>
        {/if}
      </div>
      {@render ledgerNotice()}

      <div class="opening-details">
        {#if menu.length || todaySpecials.length}
          <section class="new-menu" aria-labelledby="order-new-menu">
            <h3 id="order-new-menu">{campaign.day === 1 ? "Opening menu" : "On the chalkboard"}</h3>
            <ul class="menu-entries" class:many={menu.length + todaySpecials.length > 3}>
              {#each menu as entry (entry.customerId)}
                <li>{entry.recipe.name}</li>
              {/each}
              {#each todaySpecials as name (name)}<li class="feature-recipe">{name}</li>{/each}
            </ul>
          </section>
        {:else if nextMenu}
          <p class="next-menu">More recipes arrive on day {nextMenu.day}.</p>
        {/if}

        <div class="opening-account">
          <p class="account-line">
            <span><strong>{money(campaign.cash)}</strong> in the till</span>
            <span class="level-meter">Shop level {level}
              {#if promotionProgress}<progress value={promotionProgress.progress} max={promotionProgress.target} aria-label="Progress to the next shop level"></progress>{/if}
            </span>
            <span>Reputation {campaign.reputation}</span>
          </p>
          <p class="rent-note" class:is-due={rentIn === 0}>
            <OrderKitchenItem kind="special" size={20} />
            {money(rentDue(campaign))} {rentIn === 0 ? "rent due tonight" : `rent due in ${rentIn} ${rentIn === 1 ? "day" : "days"}`}
          </p>
          {#if activeBranch.id !== "corner" || payroll}
            <p class="rent-note"><OrderKitchenItem kind={branchIcons[activeBranch.id]} size={20} /><span>{activeBranch.name}</span>
              {#if payroll}<span class="secondary-amount">{money(payroll)} wages</span>{/if}
            </p>
          {/if}
          {#if !hasActiveShift && crewGap}
            <div class="wage-gap">
              <span>{money(crewGap)} short for crew</span>
              <button class="ledger-link" type="button" on:click={() => openView("office")}>Adjust roster</button>
            </div>
          {:else if !hasActiveShift && rentGap}
            <p class="rent-note rent-gap">{money(rentGap)} to earn before rent</p>
          {/if}
          {#if publicity}<p class="rent-note"><OrderKitchenItem kind={publicityIcons[publicity.id]} size={20} />{publicity.name}</p>{/if}
          {#if sideStand}<p class="rent-note"><OrderKitchenItem kind="serve" size={20} />Runner at {sideStand.name}</p>{/if}
          {#if managersWorking}<p class="rent-note"><OrderKitchenItem kind="street-sign" size={20} />{managersWorking} managed {managersWorking === 1 ? "shop" : "shops"} open</p>{/if}
          {#if shortages.length}
            <section class="opening-stock" aria-label="Stock short for opening">
              <h3>Short for opening</h3>
              <div>
                {#each shortages.slice(0, 3) as item (item.id)}
                  <button type="button" class="ledger-link opening-stock-key"
                    aria-label={'Restock ' + item.name + ', ' + item.missing + ' short for opening'}
                    title={item.name} on:click={() => openRestock(item.id)}>
                    <OrderKitchenItem kind={item.id} size={23} /><span>−{item.missing}</span>
                  </button>
                {/each}
                {#if shortages.length > 3}
                  <button type="button" class="ledger-link opening-stock-key" on:click={() => openRestock(shortages[3].id)}>+{shortages.length - 3} more</button>
                {/if}
              </div>
            </section>
          {/if}
        </div>
        {#if upcomingDays.length}
          <section class="calendar-strip" aria-label="Next three shop days">
            <div class="calendar-heading"><OrderKitchenItem kind="patience" size={21} /><span>Calendar</span></div>
            <ul>
              {#each upcomingDays as entry (entry.day)}
                <li class:rent-day={entry.rent}>
                  <strong>Day {entry.day}</strong>
                  <span><OrderKitchenItem kind={dayIcons[entry.event.id] ?? "cup"} size={19} />{entry.event.name}</span>
                  {#if entry.rent || entry.deliveries}
                    <small>{entry.rent ? "Rent due" : ""}{entry.rent && entry.deliveries ? ", " : ""}{entry.deliveries ? entry.deliveries + (entry.deliveries === 1 ? " crate" : " crates") : ""}</small>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      </div>

      <div class="opening-contracts">
        <OrderShiftBoard {contracts} />
        {#if commission && (campaign.commission || !hasActiveShift)}
          <div class="commission-slot">
            <OrderCommissionNote offer={commission} count={campaign.commission?.count ?? null}
              onAccept={hasActiveShift ? undefined : onCommission} />
          </div>
        {/if}
        {#if reservation && (!hasActiveShift || tableBooked)}
          <section class="reservation-note" aria-label="Group reservation">
            <OrderKitchenItem kind="clip" size={26} />
            <div><strong>{reservation.name}</strong>
              <span class="inline-facts"><span>{reservation.count} seats at {reservation.minQuality}%+</span><span>+{money(reservation.reward)}</span></span>
            </div>
            {#if hasActiveShift}<span class="reservation-pinned">Booked</span>
            {:else}<button type="button" class="boba-key order-pixel-paper-key book-table" aria-pressed={tableBooked}
              aria-label="Book table" on:click={() => onReserve(!tableBooked)}>{tableBooked ? "Booked" : "Book table"}</button>{/if}
          </section>
        {/if}
        {#if catering && (!hasActiveShift || cateringBooked)}
          <section class="reservation-note catering-note" aria-label="Takeout order">
            <OrderTakeoutTray packed={0} size={48} />
            <div>
              <strong>{catering.name}</strong>
              <span class="inline-facts"><span>{catering.recipes.length} cups at {catering.minQuality}%+</span><span>+{money(catering.reward)}</span></span>
            </div>
            {#if hasActiveShift}<span class="reservation-pinned">Booked</span>
            {:else}<button type="button" class="boba-key order-pixel-paper-key book-table" aria-pressed={cateringBooked}
              aria-label="Book takeout" on:click={() => onCatering(!cateringBooked)}>{cateringBooked ? "Booked" : "Book takeout"}</button>{/if}
            <details class="catering-preview">
              <summary>Pickup list · {catering.deadline - catering.arrivesAt}s to pack</summary>
              <ul>{#each catering.recipes as recipe (recipe.name)}<li>{recipe.name}</li>{/each}</ul>
            </details>
          </section>
        {/if}
      </div>

      <div class="opening-footer">
        <div class="shop-tools" role="group" aria-label="Shop tools">
          {#each tools as tool (tool.id)}
            {#if tool.id !== "house" || hasEasel}
            <button class="ledger-link" type="button" on:click={() => openView(tool.id)}>
              <OrderKitchenItem kind={tool.icon} size={23} />{tool.name}
            </button>
            {/if}
          {/each}
          <button class="ledger-link" type="button" on:click={() => onPractice()}>
            <OrderKitchenItem kind="cup" size={23} /> Practice a ticket
          </button>
        </div>
      </div>
    </div>
  {:else if page === "receipt"}
    <div class="receipt-page">
      <header class="receipt-heading">
        <div>
          <div class="receipt-stamp" aria-hidden="true"><OrderPixelWord text={closed ? "Day " + (closing?.day ?? campaign.day) : "Till closed"} cells={1.5} /></div>
          <h2 id="order-ledger-heading" tabindex="-1" data-arcade-tab-anchor bind:this={pageHeading}>{heading}</h2>
        </div>
        <OrderKitchenItem kind={closed ? "clip" : "bell"} size={51} />
      </header>
      {#if closing}
        <div class="receipt-story">
          <p class="takings">{money(dayTakings(closing))}</p>
          <p class="till-label">Shift takings</p>
          <p class="shift-outcome">
            <span>{closing.served} {closing.served === 1 ? "order" : "orders"} served</span>
            {#if closing.served > 0}<span>{percent.format(closing.quality / 100)} drink quality</span>{/if}
            {#if closing.missed > 0}<span>{closing.missed} missed</span>{/if}
          </p>
        </div>
        <div class="receipt-details">
          {#if closing.shiftScore !== undefined}
            <p class="receipt-note"><strong>{closing.shiftScore.toLocaleString("en-US")} shift points.</strong> Each drink you hand off adds its quality in points.</p>
          {/if}
          <dl class="till-items">
            <div><dt>Sales</dt><dd>{money(closing.revenue)}</dd></div>
            <div><dt>Tips</dt><dd>{money(closing.tips)}</dd></div>
            {#if closing.branchIncome}<div><dt>Location bonus</dt><dd>{money(closing.branchIncome)}</dd></div>{/if}
            {#if closing.managedSales}<div><dt>Side stand <small>({closing.managedOrders} sold)</small></dt><dd>{money(closing.managedSales)}</dd></div>{/if}
            {#if closing.managerSales}<div><dt>Managed shops <small>({closing.managerOrders} sold)</small></dt><dd>{money(closing.managerSales)}</dd></div>{/if}
            {#if closing.contractBonus}<div><dt>Contracts earned</dt><dd>{money(closing.contractBonus)}</dd></div>{/if}
            {#if closing.reservationBonus}<div><dt>Reservation bonus</dt><dd>{money(closing.reservationBonus)}</dd></div>{/if}
            {#if closing.cateringBonus}<div><dt>Takeout bonus</dt><dd>{money(closing.cateringBonus)}</dd></div>{/if}
            {#if closing.commissionReward}<div><dt>{closing.commissionName ?? "Commission"}</dt><dd>{money(closing.commissionReward)}</dd></div>{/if}
            {#if closing.wages}<div><dt>Crew wages</dt><dd>{money(closing.wages)}</dd></div>{/if}
            {#if closing.publicityCost}<div><dt>Promotion paid</dt><dd>{money(closing.publicityCost)}</dd></div>{/if}
            {#if closing.standingOrders}<div><dt>Restocked <small>({closing.standingOrders} {closing.standingOrders === 1 ? "crate" : "crates"})</small></dt><dd>{money(closing.standingSpent)}</dd></div>{/if}
            {#if closing.rent > 0}
              <div><dt>Rent paid</dt><dd>{money(closing.rent)}</dd></div>
            {:else if closing.rentOwed > 0}
              <div class="unpaid"><dt>Unpaid rent</dt><dd>{money(closing.rentOwed)}</dd></div>
            {/if}
          </dl>
          {#if closing.expired > 0}
            <p class="receipt-note">{closing.expired} {closing.expired === 1 ? "portion" : "portions"} expired.</p>
          {/if}
          {#if closing.promotion}
            <p class="promotion"><OrderKitchenItem kind="quality" size={22} />Promoted to {closing.promotion}.</p>
          {/if}
          {#if closing.unlockedPaint}
            <p class="promotion"><OrderKitchenItem kind="street-sign" size={22} />{shopPaint(closing.unlockedPaint).name} paint unlocked.</p>
          {/if}
          {#if unlockedAward}
            <p class="promotion"><OrderKitchenItem kind="quality" size={22} />{unlockedAward.name} earned · {unlockedAward.benefit}</p>
          {/if}
        </div>
      {/if}
      {#if closingMonth}<div class="receipt-month"><OrderRentStatement period={closingMonth} /></div>{/if}
      {#if closed}
        <p class="closure-note">{closing?.reason ?? "The shop could not pay rent."}</p>
      {/if}
      {@render ledgerNotice()}
      <div class="receipt-actions">
        {#if closed}
          <button class="boba-key is-primary shift-button" type="button" on:click={onRestart}>Restart shop {@render arrow()}</button>
        {:else}
          <button class="boba-key is-primary shift-button" type="button" on:click={() => openView("opening")}>Plan day {campaign.day} {@render arrow()}</button>
        {/if}
      </div>
    </div>
  {:else}
    <div class="utility-page">
      <header class="utility-heading">
        <button class="ledger-link back-opening" type="button" on:click={() => openView("opening")}>{@render arrow(true)} Back to day {campaign.day}</button>
        <div>
          <h2 id="order-ledger-heading" tabindex="-1" data-arcade-tab-anchor bind:this={pageHeading}>
            <OrderKitchenItem kind={utility?.icon ?? "clip"} size={37} />{heading}
          </h2>
          {#if page !== "regulars"}<p>{money(campaign.cash)} in the till</p>{/if}
        </div>
      </header>
      {@render ledgerNotice()}
      <div class="ledger-panel">
        {#if page === "pantry"}
          <div class="pantry-grid">
            <section class="stock-list" aria-labelledby="order-ledger-stock">
              <h3 id="order-ledger-stock" bind:this={shelfHeading} tabindex="-1" data-arcade-tab-anchor>On the shelf</h3>
              <OrderPantryShelf {campaign} current={currentIngredients.map(({ id }) => id)} upcoming={upcomingIngredients.map(({ id }) => id)}
                selected={ingredient} onPick={pickFromShelf} />
            </section>

            <section class="supplier-order" aria-labelledby="order-ledger-suppliers">
              <h3 id="order-ledger-suppliers" bind:this={supplierHeading} tabindex="-1" data-arcade-tab-anchor><OrderKitchenItem kind={ingredient} size={26} />{selected.name}</h3>
              <button class="ledger-link back-to-shelf" type="button" on:click={backToShelf}>{@render arrow(true)} Back to shelf</button>
              {#if expiry !== null}<p class="fine-print">{expiryLabel(campaign.inventory, ingredient, expiry, campaign.day)}.</p>{/if}
              {#if hasActiveShift}<p>Suppliers reopen after the shift.</p>{/if}
              {#if hasSupplierLedger}
                <p class="reorder-status"><OrderKitchenItem kind="reorder" lit={!!standingSupplier} size={20} />
                  <span>Reorder below {STANDING_ORDER_THRESHOLD}</span><strong>{standingCount}/{STANDING_ORDER_LIMIT}</strong>
                </p>
              {/if}
              <div class="crate-pick" role="group" aria-label="Crates to order">
                <span>Crates</span>
                {#each [1, 2, 3] as amount}
                  <button type="button" class="boba-key order-pixel-paper-key" aria-label={amount + (amount === 1 ? " crate" : " crates")}
                    aria-pressed={crates === amount} disabled={hasActiveShift} on:click={() => crates = amount}>{amount}</button>
                {/each}
              </div>
              <ul class="purchase-list">
                {#each SUPPLIERS as supplier (supplier.id)}
                  {@const rate = supplierPrice(campaign, ingredient, supplier)}
                  {@const price = rate * crates}
                  {@const recurring = standingSupplier === supplier.id}
                  <li>
                    <div>
                      <h4>{supplier.name}{#if rate < supplier.price}<span class="market-tag">{ingredient === "seltzer" ? "Seltzer sale" : "Fruit sale"}</span>{/if}</h4>
                      <p>{supplier.batchSize * crates} portions, {supplier.leadDays ? `arrives day ${campaign.day + supplier.leadDays}` : "available now"}.</p>
                      <p class="fine-print">Keeps for {deliveryShelfLife(campaign, selected.shelfLife, supplier.shelfLifeBonus)} days.</p>
                    </div>
                    <div class="supplier-keys">
                      {#if hasSupplierLedger}
                        <button class="boba-key order-pixel-paper-key repeat-key" type="button"
                          disabled={hasActiveShift || (!standingSupplier && standingCount >= STANDING_ORDER_LIMIT)}
                          aria-pressed={recurring} aria-label={`Reorder ${selected.name} from ${supplier.name}`}
                          title={recurring ? "Stop reordering here" : "Reorder below " + STANDING_ORDER_THRESHOLD}
                          on:click={() => onStandingOrder(ingredient, recurring ? null : supplier.id)}>
                          <OrderKitchenItem kind="reorder" size={22} lit={recurring} />
                        </button>
                      {/if}
                      <button class="boba-key order-pixel-paper-key purchase" type="button"
                        disabled={hasActiveShift || campaign.cash < price}
                        aria-label={`Order ${selected.name} from ${supplier.name} for ${money(price)}`}
                        on:click={() => onOrderStock(ingredient, supplier.id, crates)}>{money(price)}</button>
                    </div>
                  </li>
                {/each}
              </ul>
              {#if campaign.deliveries.length}
                <section class="deliveries" aria-labelledby="order-ledger-deliveries">
                  <h4 id="order-ledger-deliveries">On the way</h4>
                  <ul>
                    {#each campaign.deliveries as delivery (delivery.id)}
                      <li>
                        <span>{ingredientNames.get(delivery.ingredient)} × {delivery.quantity}</span>
                        <span>Day {delivery.arrivesOn}</span>
                      </li>
                    {/each}
                  </ul>
                </section>
              {/if}
            </section>
          </div>
        {:else if page === "house"}
          <OrderHouseBlend blend={houseBlend} day={campaign.day} cupPrint={campaign.cupPrint} disabled={hasActiveShift}
            tin={level >= 5 ? blendTin : undefined} {todayBlend} onTin={onBlendTin} onSave={onHouseBlend} />
        {:else if page === "workshop"}
          <div class="workshop-grid">
            <section aria-labelledby="order-ledger-upgrades">
              <h3 id="order-ledger-upgrades">Equipment</h3>
              {#if hasEasel}<button class="ledger-link" type="button" on:click={() => openView("house")}>
                <OrderKitchenItem kind="cup" size={22} /> Mix a house tea
              </button>{/if}
              {#if hasActiveShift}<p>Purchases reopen after the shift.</p>{/if}
              {#each equipmentGroups as group (group.name)}
                <p class="workshop-group">{group.name}</p>
                <ul class="purchase-list illustrated-list" aria-label={group.name}>
                  {#each group.items as upgrade (upgrade.id)}
                    {@const owned = campaign.upgrades.includes(upgrade.id)}
                    <li>
                      <OrderKitchenItem kind={equipmentIcons[upgrade.id]} size={29} lit={owned} />
                      <div>
                        <h4>{upgrade.name}</h4>
                        <p>{upgrade.description}</p>
                        {#if !owned && level < upgrade.level}<p class="fine-print">Level {upgrade.level}</p>{/if}
                      </div>
                      {#if owned}
                        <span class="purchased">Installed</span>
                      {:else}
                        <button
                          class="boba-key order-pixel-paper-key purchase"
                          type="button"
                          disabled={hasActiveShift || level < upgrade.level || campaign.cash < upgrade.price}
                          aria-label={`Buy ${upgrade.name} for ${money(upgrade.price)}`}
                          on:click={() => onBuyUpgrade(upgrade.id)}
                        >{money(upgrade.price)}</button>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/each}
            </section>

            <section aria-labelledby="order-ledger-powerups">
              <h3 id="order-ledger-powerups">Shift boosts</h3>
              <p class="workshop-group">Use during service</p>
              <ul class="purchase-list illustrated-list">
                {#each POWERUPS as item (item.id)}
                  {@const owned = campaign.powerups[item.id]}
                  <li>
                    <OrderKitchenItem kind={item.id} size={29} lit={owned > 0} />
                    <div>
                      <h4>{item.name}</h4>
                      <p>{item.description}</p>
                      {#if owned}<p class="fine-print">{owned} in stock</p>{/if}
                      {#if level < item.level}<p class="fine-print">Level {item.level}</p>{/if}
                    </div>
                    <button
                      class="boba-key order-pixel-paper-key purchase"
                      type="button"
                      disabled={hasActiveShift || level < item.level || campaign.cash < item.price}
                      aria-label={`Buy ${item.name} for ${money(item.price)}`}
                      on:click={() => onBuyPowerup(item.id)}
                    >{money(item.price)}</button>
                  </li>
                {/each}
              </ul>
            </section>
          </div>
        {:else if page === "office"}
          <div class="workshop-grid office-grid">
            <section aria-labelledby="order-office-crew">
              <h3 id="order-office-crew">Crew</h3>
              {#if payroll}<p class="fine-print">{money(payroll)} in wages this shift</p>{/if}
              <ul class="purchase-list illustrated-list">
                {#each CREW as worker (worker.id)}
                  {@const hired = campaign.crew.includes(worker.id)}
                  {@const certified = campaign.certifiedCrew.includes(worker.id)}
                  {@const worked = campaign.crewShifts[worker.id] ?? 0}
                  {@const course = worker.certificate}
                  {@const duty = worker.id === "manager" ? !!managedShop : campaign.activeCrew.includes(worker.id)}
                  <li>
                    <OrderKitchenItem kind={crewIcons[worker.id]} size={32} lit={duty} />
                    <div>
                      <h4>{worker.name}</h4>
                      <p>{worker.description}</p>
                      <p class="fine-print inline-facts"><span>{money(worker.wage + (certified ? course.premium : 0))} per shift</span>
                        {#if !hired && level < worker.level}<span>Level {worker.level}</span>{/if}
                        {#if worker.id === "runner" && sideStand}<span>At {sideStand.name}</span>{/if}
                        {#if worker.id === "manager" && managedShop}<span>At {managedShop.name}</span>{/if}
                      </p>
                    </div>
                    {#if hired && worker.id === "manager"}
                      <span class="purchased">{duty ? "Assigned" : "Available"}</span>
                    {:else if hired}
                      <button class="boba-key order-pixel-paper-key purchase" class:on-duty={duty} type="button"
                        aria-label={worker.name + " on duty"} aria-pressed={duty} disabled={hasActiveShift}
                        on:click={() => onAssign(worker.id, !duty)}>{duty ? "On duty" : "Off duty"}</button>
                    {:else}
                      <button class="boba-key order-pixel-paper-key purchase" type="button"
                        aria-label={"Hire " + worker.name + " for " + money(worker.price)} disabled={hasActiveShift || level < worker.level || campaign.cash < worker.price}
                        on:click={() => onHire(worker.id)}>{money(worker.price)}</button>
                    {/if}
                    {#if hired}
                      <div class="crew-course" class:certified>
                        <OrderKitchenItem kind="quality" size={22} lit={certified || worked >= CREW_CERTIFICATE_SHIFTS} />
                        <div>
                          <strong>{course.name}</strong>
                          <small>{certified || worked >= CREW_CERTIFICATE_SHIFTS ? course.benefit : worked + "/" + CREW_CERTIFICATE_SHIFTS + " shifts worked"}</small>
                          {#if !certified && worked >= CREW_CERTIFICATE_SHIFTS}<small>+{money(course.premium)} per shift</small>{/if}
                        </div>
                        {#if !certified && worked >= CREW_CERTIFICATE_SHIFTS}
                          <button class="boba-key order-pixel-paper-key purchase" type="button"
                            aria-label={`Certify ${worker.name} for ${money(course.price)}`} title={`Adds ${money(course.premium)} to the shift wage`}
                            disabled={hasActiveShift || campaign.cash < course.price}
                            on:click={() => onCertify(worker.id)}>{money(course.price)}</button>
                        {/if}
                      </div>
                    {/if}
                  </li>
                {/each}
              </ul>
            </section>
            <section aria-labelledby="order-office-locations">
              <h3 id="order-office-locations">Locations</h3>
              <OrderBranchOffice {campaign} disabled={hasActiveShift} onBuy={onBuyBranch} onOpen={onSelectBranch}
                onRunner={onManagedBranch} onManager={onManagerBranch} onFit={onFitBranch} onMenu={onManagerMenu}
                onHireManager={onHireLocationManager} onScheduleManager={onScheduleLocationManager} onCertifyManager={onCertifyLocationManager} />
            </section>
          </div>
          {#if campaign.day >= 3 || awards}
            <section class="awards-board" aria-labelledby="shop-awards-title">
              <div class="cabinet-art"><OrderKeepsakeCabinet tier={awards} size={180} /></div>
              <div>
                <h3 id="shop-awards-title">Neighborhood awards</h3>
                <p class="fine-print">Best reputation {campaign.highestReputation}</p>
                <ol>
                  {#each NEIGHBORHOOD_AWARDS as award, index (award.threshold)}
                    <li class:earned={index < awards}>
                      <span>{index < awards ? "✓" : award.threshold}</span><div><strong>{award.name}</strong><small>{award.benefit}</small></div>
                    </li>
                  {/each}
                </ol>
              </div>
            </section>
          {/if}
          {#if campaign.day >= 4}
            <section class="paint-board" aria-labelledby="shop-paint-title">
              <h3 id="shop-paint-title">Shop paint</h3>
              <div class="paint-keys">
                {#each SHOP_PAINTS as paint (paint.id)}
                  {@const unlocked = campaign.paintUnlocked.includes(paint.id)}
                  <button type="button" class="boba-key order-pixel-paper-key"
                    aria-label={paint.name} aria-pressed={campaign.paint === paint.id}
                    disabled={!unlocked || hasActiveShift} title={!unlocked ? paint.source : undefined}
                    on:click={() => onPaint(paint.id)}>
                    <svg viewBox="0 0 22 19" width="27" height="24" shape-rendering="crispEdges" aria-hidden="true">
                      <path d="M2 2h18v15H2z" fill="#5b4336" />
                      <path d="M4 4h14v11H4z" fill={paint.cloth} />
                      <path d="M5 5h12v2H5zM5 11h6v2H5z" fill={paint.trim} />
                      <path d="M13 10h3v4h-3z" fill={paint.apron} />
                    </svg>
                    <span>{paint.name}{#if !unlocked}<small>{paint.source}</small>{/if}</span>
                  </button>
                {/each}
              </div>
            </section>
          {/if}
          {#if viewedMonth}
            <details class="rent-book">
              <summary><OrderRentEnvelope state={viewedMonth.outcome === "waived" ? "open" : viewedMonth.outcome} size={43} /> <strong>Rent book</strong></summary>
              {#if months.length > 1}
                <div class="month-keys" role="group" aria-label="Recorded months">
                  {#each months as period (period.month)}
                    <button type="button" class="boba-key order-pixel-paper-key" aria-pressed={viewedMonth.month === period.month}
                      on:click={() => inspectedMonth = period.month}>Month {period.month}</button>
                  {/each}
                </div>
              {/if}
              <OrderRentStatement period={viewedMonth} />
            </details>
          {/if}
          <section class="publicity-board" aria-labelledby="order-office-publicity">
            <h3 id="order-office-publicity">Promote a shift</h3>
            <ul class="purchase-list illustrated-list">
              {#each PROMOTIONS_BOARD as offer (offer.id)}
                {@const booked = campaign.publicity === offer.id}
                <li>
                  <OrderKitchenItem kind={publicityIcons[offer.id]} size={30} lit={booked} />
                  <div>
                    <h4>{offer.name}</h4>
                    <p>{offer.description}</p>
                    {#if level < offer.level}<p class="fine-print">Level {offer.level}</p>{/if}
                  </div>
                  {#if booked}<span class="purchased">Booked</span>
                  {:else}<button class="boba-key order-pixel-paper-key purchase" type="button"
                    disabled={hasActiveShift || !!campaign.publicity || level < offer.level || campaign.cash < offer.price}
                    aria-label={"Book " + offer.name + " for " + money(offer.price)} on:click={() => onPublicity(offer.id)}>{money(offer.price)}</button>{/if}
                </li>
              {/each}
            </ul>
          </section>
        {:else}
          <div class="regular-tabs" role="group" aria-label="Shop book">
            <button class="boba-key order-pixel-paper-key" type="button" aria-pressed={regularPage === "guests"}
              on:click={() => regularPage = "guests"}><OrderKitchenItem kind="clip" size={21} />Guestbook</button>
            <button class="boba-key order-pixel-paper-key" type="button" aria-pressed={regularPage === "recipes"}
              on:click={() => regularPage = "recipes"}><OrderKitchenItem kind="cup" size={21} />Recipe album</button>
          </div>
          {#if regularPage === "recipes"}
            <OrderRecipeAlbum day={campaign.day} records={campaign.recipeRecords} cupPrint={campaign.cupPrint}
              locked={hasActiveShift} {onPrint} {onPractice} />
          {:else}
          {#if campaign.day >= 5}<p class="fine-print">Serve a regular well twice and they may come back with a custom request.</p>{/if}
          <div class="keepsakes" aria-label="Shop keepsakes">
            {#each SHOP_KEEPSAKES as item (item.id)}
              {@const earned = keepsakes.some(({ id }) => id === item.id)}
              <span class:earned><OrderKitchenItem kind={item.icon} size={26} lit={earned} />
                <span>{item.name}<small>{earned ? "On display" : completedCards + "/" + item.threshold}</small></span>
              </span>
            {/each}
          </div>
          <ul class="regulars-list">
            {#each regulars as regular (regular.id)}
              {@const visits = campaign.regularVisits[regular.id] ?? 0}
              {@const portrait = figure(regular.id, visits > 0 ? "content" : "calm")}
              <li>
                <span class="regular-face"><PixelIcon grid={portrait.grid} palette={portrait.palette} px={2} /></span>
                <div>
                  <div class="regular-heading">
                    <h4>{regular.name}</h4>
                    <OrderGuestStamps count={guestbookStamps(visits)} />
                  </div>
                  <p>{regular.favorite.name}</p>
                  <p class="fine-print">{regular.tag}</p>
                  {#if guestbookStamps(visits) === GUESTBOOK_STAMP_GOAL}<p class="guest-note"><q>{guestbookNote(regular.id)}</q></p>{/if}
                </div>
              </li>
            {/each}
          </ul>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</article>

{#snippet arrow(back = false)}
  <svg class:back width="14" height="14" viewBox="0 0 14 14" shape-rendering="crispEdges" aria-hidden="true">
    <path d="M7 2h2v2h2v2h2v2h-2v2H9v2H7v-2h2V8H1V6h8V4H7Z" fill="currentColor" />
  </svg>
{/snippet}

{#snippet ledgerNotice()}
  <p class="notice" role="status" class:has-notice={!!notice}>{notice}</p>
{/snippet}

<style>
  .ledger {
    --ledger-inset: clamp(1.25rem, 5vw, 3rem);
    --ledger-rule: color-mix(in srgb, var(--b-line) 30%, var(--b-paper));
    width: 100%;
  }

  .ledger.show-receipt {
    max-width: 31rem;
    justify-self: center;
  }

  .ledger.show-receipt::before {
    mask: linear-gradient(#000 0 0) top / 100% calc(100% - 7px) no-repeat,
      repeating-linear-gradient(90deg, #000 0 7px, transparent 7px 12px) bottom / 100% 7px no-repeat;
  }

  .ledger.show-receipt::after {
    bottom: 2px;
    mask: linear-gradient(#000 0 0) top / 100% calc(100% - 7px) no-repeat,
      repeating-linear-gradient(90deg, #000 0 3px, transparent 3px 12px) bottom / 100% 7px no-repeat;
  }

  .opening, .utility-page, .receipt-page {
    padding: clamp(1.4rem, 5vw, 3rem) var(--ledger-inset);
  }

  .opening-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: clamp(0.5rem, 4vw, 3rem);
  }

  .day-heading h2 {
    display: inline-flex;
    margin: 0;
    padding: 5px 7px 6px;
    color: var(--b-gold);
  }

  #order-ledger-heading:focus { outline: none; }

  .day-heading {
    margin-inline-start: -7px;
    padding-inline-start: 7px;
  }

  .headline {
    max-width: 20ch;
    margin: 0.4rem 0 0;
    color: var(--b-strong);
    font-family: var(--font-display);
    font-size: clamp(2.05rem, 5vw, 3.25rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 0.99;
    word-spacing: 0.06em;
    text-wrap: balance;
  }

  .opening-deck {
    max-width: 41ch;
    margin: 0.75rem 0 0;
    color: var(--b-text);
    font-size: 0.9375rem;
    line-height: 1.5;
    text-wrap: pretty;
  }

  .opening-art :global(svg) {
    display: block;
    width: clamp(5rem, 23vw, 10rem);
    height: auto;
  }

  .new-menu, .opening-account, .opening-footer {
    margin-block-start: var(--space-6);
  }

  .new-menu h3 {
    margin: 0;
    color: var(--b-gold);
    font-size: 0.9375rem;
    font-style: italic;
    font-weight: 400;
  }

  .menu-entries {
    display: grid;
    gap: 0.4rem 1.25rem;
    justify-content: start;
    margin: 0.55rem 0 0;
    padding: 0;
    list-style: none;
  }

  .menu-entries.many { grid-template-columns: repeat(2, minmax(0, max-content)); }

  .menu-entries li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0;
    color: var(--b-strong);
    font-size: 0.875rem;
    line-height: 1.3;
  }

  .menu-entries li::before {
    flex: none;
    width: 4px;
    height: 4px;
    align-self: start;
    margin-top: 0.45rem;
    background: var(--b-gold);
    content: "";
  }

  .menu-entries .feature-recipe { color: var(--b-gold); }

  .next-menu {
    margin: var(--space-5) 0 0;
    color: var(--b-muted);
    font-size: 0.8125rem;
  }

  .account-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.15rem 1rem;
    margin: 0;
    color: var(--b-muted);
    font-size: 0.8125rem;
  }

  .account-line strong { color: var(--b-strong); font-size: 1.05rem; font-weight: 500; }
  .level-meter { display: inline-flex; align-items: center; gap: .25rem; }
  .level-meter progress { width: 2.8rem; height: 6px; appearance: none; background: #e4c9a5; border: 0; }
  .level-meter progress::-webkit-progress-bar { background: #e4c9a5; }
  .level-meter progress::-webkit-progress-value { background: #7b8157; }
  .level-meter progress::-moz-progress-bar { background: #7b8157; }
  .calendar-strip { margin-block-start: .75rem; color: #52463b; }
  .calendar-heading { display: flex; gap: 4px; align-items: center; font-size: .78rem; font-weight: 500; }
  .calendar-strip ul { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 0; margin: 4px 0 0; list-style: none; }
  .calendar-strip li { padding: 4px 5px; background: #ebd5ae; clip-path: var(--notch); }
  .calendar-strip li.rent-day { background: #eac3a2; }
  .calendar-strip li > * { font-size: .73rem; font-weight: 500; }
  .calendar-strip li span { display: flex; align-items: center; gap: 2px; line-height: 1.13; }
  .calendar-strip li small { display: block; margin-top: 2px; color: #704d3c; font-size: .65rem; }

  .rent-note {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0.4rem 0 0;
    color: var(--b-muted);
    font-size: 0.8125rem;
  }

  .rent-note.is-due { color: var(--b-accent); font-weight: 500; }
  .secondary-amount { margin-inline-start: .35rem; }
  .inline-facts { display: inline-flex; flex-wrap: wrap; gap: 0 .65rem; }
  .opening-stock { margin-block-start: .45rem; }
  .opening-stock h3 { margin: 0; font-size: .75rem; font-weight: 600; color: var(--b-accent); }
  .opening-stock > div { display: flex; flex-wrap: wrap; gap: .25rem .4rem; }
  .opening-stock .opening-stock-key { min-width: 44px; min-height: 40px; color: var(--b-accent); gap: .1rem; }

  .opening-contracts { max-width: 31rem; margin-top: var(--space-4); }
  .commission-slot { margin-top: var(--space-2); }
  .reservation-note { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.4rem; margin-top: var(--space-2); }
  .reservation-note div { display: grid; gap: 1px; font-size: 0.8125rem; }
  .reservation-note strong { color: var(--b-strong); font-weight: 500; }
  .reservation-note span { color: var(--b-muted); font-size: 0.75rem; }
  .catering-note { background: #ead7b5; padding: 4px 7px; clip-path: var(--notch); }
  .catering-preview { grid-column: 2 / -1; color: #604a39; font-size: .73rem; }
  .catering-preview summary { cursor: pointer; }
  .catering-preview ul { margin: 4px 0; padding-inline-start: 18px; }
  .book-table.boba-key { min-height: 40px; padding-inline: 8px; }
  .book-table[aria-pressed="true"] { --key-face: var(--b-mine); --key-rule: var(--b-accent); }

  .notice {
    margin: 0;
    color: var(--b-accent);
    font-size: 0.8125rem;
    font-style: italic;
    line-height: 1.4;
  }

  .notice.has-notice { margin-top: var(--space-3); }

  .opening-actions, .shop-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.9rem;
  }

  .opening-actions { margin-block-start: var(--space-4); }

  .shift-button {
    gap: 0.75rem;
    min-height: 2.75rem;
    padding-inline: 0.875rem;
  }

  .shop-tools {
    margin: 0.9rem -4px -0.5rem;
    gap: 0 0.9rem;
  }

  .ledger-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 2.75rem;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--b-text);
    font-family: var(--font-ui);
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.25;
    cursor: pointer;
    touch-action: manipulation;
  }

  .ledger-link:focus-visible { outline: 2px solid var(--b-accent); outline-offset: -1px; }
  .ledger-link:disabled { cursor: default; opacity: 0.55; }
  .ledger-link:active { color: var(--b-accent); }

  @media (hover: hover) {
    .ledger-link:not(:disabled):hover { color: var(--b-accent); text-decoration: underline; text-underline-offset: 3px; }
  }

  .previous-receipt { font-style: italic; font-weight: 400; }
  .back { transform: scaleX(-1); }

  .receipt-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .receipt-stamp { color: var(--b-accent); margin-block-end: 0.4rem; }
  .receipt-heading h2, .utility-heading h2 {
    margin: 0;
    color: var(--b-strong);
    font-family: var(--font-display);
    font-size: clamp(1.65rem, 4vw, 2.125rem);
    font-weight: 700;
    letter-spacing: -0.017em;
    line-height: 1.05;
    word-spacing: 0.085em;
  }

  .receipt-story {
    margin-top: var(--space-6);
    color: var(--b-strong);
  }

  .takings {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2.7rem, 9vw, 4.6rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
    overflow-wrap: anywhere;
  }

  .till-label {
    margin: 0.25rem 0 0;
    color: var(--b-muted);
    font-size: 0.875rem;
    font-style: italic;
  }

  .shift-outcome {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.85rem;
    margin: var(--space-4) 0 0;
    color: var(--b-text);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .shift-outcome > span { white-space: nowrap; }

  .till-items {
    display: grid;
    gap: 0.3rem;
    margin: var(--space-5) 0 0;
    padding: var(--space-3) 0 0;
    border-top: 1px dashed var(--ledger-rule);
  }

  .till-items > div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    color: var(--b-text);
    font-size: 0.8125rem;
  }

  .till-items dd { margin: 0; }
  .till-items .unpaid { color: var(--b-accent); font-weight: 500; }
  .receipt-note, .promotion, .closure-note { margin: var(--space-3) 0 0; font-size: 0.875rem; }
  .receipt-note { color: var(--b-muted); }
  .promotion { display: flex; align-items: center; gap: 0.45rem; color: var(--b-gold); font-style: italic; }
  .closure-note { color: var(--b-accent); }
  .receipt-actions { margin-top: var(--space-5); }
  .receipt-month { margin-top: var(--space-3); }

  .utility-heading .back-opening { margin: -0.65rem -4px 0.5rem; }
  .utility-heading > div { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem 1rem; }
  .utility-heading h2 { display: flex; align-items: center; gap: 0.625rem; }
  .utility-heading p { margin: 0; color: var(--b-muted); font-size: 0.8125rem; }
  .ledger-panel { padding-top: var(--space-6); }

  .pantry-grid, .workshop-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    align-items: start;
    gap: clamp(1.25rem, 4vw, 2.75rem);
  }

  .ledger-panel h3 {
    margin: 0 0 0.4rem;
    color: var(--b-strong);
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: -0.027em;
    line-height: 1.1;
    word-spacing: 0.055em;
  }

  .ledger-panel h4 {
    margin: 0;
    color: var(--b-strong);
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25;
  }

  .ledger-panel p {
    max-width: 50ch;
    margin: 0.25rem 0 0;
    color: var(--b-text);
    font-size: 0.875rem;
    line-height: 1.45;
    text-wrap: pretty;
  }

  .ledger-panel .fine-print { color: var(--b-muted); font-size: 0.75rem; }

  .supplier-order > h3 { display: flex; align-items: center; gap: 0.45rem; }
  .rent-gap { color: #854439; }
  .wage-gap { display: flex; gap: 3px 8px; align-items: center; flex-wrap: wrap; color: #854439; font-size: .8rem; }
  .wage-gap button { color: inherit; text-decoration: underline; }
  .back-to-shelf { display: none; }
  #order-ledger-stock, #order-ledger-suppliers { scroll-margin-top: 8px; }
  .supplier-keys { display: flex; flex: none; align-items: center; gap: 4px; }
  .market-tag { margin-inline-start: .35rem; color: #645532; font-size: .69rem; font-style: italic; font-weight: 400; }
  .repeat-key.boba-key { min-width: 39px; min-height: 42px; padding: 4px; }
  .repeat-key[aria-pressed="true"] { --key-face: #cfdaaa; --key-rule: #879368; }
  .reorder-status { display: flex; align-items: center; gap: 4px; margin: .45rem 0 0; color: var(--b-muted); font-size: .75rem; }
  .reorder-status strong { margin-inline-start: .2rem; color: var(--b-gold); font-variant-numeric: tabular-nums; }

  .crate-pick { display: flex; align-items: center; gap: 4px; margin-top: var(--space-3); }
  .crate-pick > span { margin-right: 4px; color: var(--b-muted); font-size: 0.8125rem; }
  .crate-pick .boba-key { min-height: 40px; min-width: 38px; padding-inline: 7px; }
  .crate-pick .boba-key[aria-pressed="true"] { --key-face: var(--b-mine); --key-rule: var(--b-accent); }
  .paint-board { margin-block: var(--space-4) var(--space-5); }
  .awards-board {
    display: grid;
    grid-template-columns: minmax(94px, 162px) minmax(0, 1fr);
    align-items: center;
    gap: clamp(10px, 3vw, 24px);
    max-width: 30rem;
    margin-block: var(--space-5);
    padding: 10px;
    clip-path: var(--notch);
    background: #ecd6af;
    color: #483b32;
  }
  .cabinet-art { display: grid; place-items: center; }
  .cabinet-art :global(svg) { display: block; width: 100%; height: auto; }
  .awards-board h3 { margin: 0; }
  .awards-board ol { display: grid; gap: 3px; margin: 5px 0 0; padding: 0; list-style: none; }
  .awards-board li { display: grid; grid-template-columns: 20px 1fr; align-items: baseline; gap: 4px; font-size: .76rem; }
  .awards-board li > span { color: #794e41; text-align: center; }
  .awards-board li.earned > span { color: #3f643e; }
  .awards-board small { display: block; color: #615244; line-height: 1.2; }
  .crew-course {
    grid-column: 2 / -1;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
    padding: 4px 5px;
    background: #eddcbd;
    color: #5d4a38;
    clip-path: var(--notch);
    font-size: .75rem;
  }
  .crew-course.certified { background: #dce0ba; color: #3d5943; }
  .crew-course small { display: block; font-size: .69rem; line-height: 1.25; }
  .crew-course .purchase { font-size: .75rem; }
  .paint-keys { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
  .paint-keys .boba-key { min-height: 42px; font-size: .76rem; padding-inline: 7px; text-align: start; }
  .paint-keys .boba-key[aria-pressed="true"] { --key-face: var(--b-mine); --key-rule: var(--b-accent); }
  .paint-keys small { display: block; color: #644e43; font-size: .68rem; }

  .purchase-list,
  .deliveries ul,
  .regulars-list {
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
  }

  .regular-tabs { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
  .regular-tabs button { min-height: 44px; gap: 4px; padding-inline: 7px; }
  .regular-tabs button[aria-pressed="true"] { --key-face: var(--b-mine); --key-rule: var(--b-accent); }

  .keepsakes { display: flex; flex-wrap: wrap; gap: 0.35rem 1rem; margin-block: var(--space-4); }
  .keepsakes > span { display: inline-flex; align-items: center; gap: 5px; color: var(--b-muted); font-size: 0.78rem; }
  .keepsakes > span.earned { color: var(--b-gold); }
  .keepsakes small { display: block; font-size: 0.69rem; }
  .ledger-panel .guest-note { color: var(--b-gold); font-style: italic; font-size: 0.8125rem; }

  .purchase-list li,
  .deliveries li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0;
  }

  .purchase-list li {
    padding-block: 0.65rem;
  }

  .workshop-group {
    margin: 0.7rem 0 0;
    color: var(--b-gold);
    font-size: 0.75rem;
    font-style: italic;
    font-weight: 500;
  }

  .illustrated-list li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.5rem;
  }

  .illustrated-list li :global(.kitchen-item) {
    align-self: start;
  }

  .purchase {
    flex: none;
    min-width: 3rem;
    min-height: 2.75rem;
    padding-inline: 0.625rem;
  }

  .purchase.on-duty { --key-face: var(--b-mine); --key-rule: var(--b-accent); }
  .publicity-board { margin-top: var(--space-6); max-width: 38rem; }
  .rent-book { margin-block-start: var(--space-5); max-width: 34rem; }
  .rent-book summary {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    margin-block-end: 3px;
    padding-inline: 5px;
    background: #eee0c6;
    color: #544435;
    clip-path: var(--notch);
    cursor: pointer;
  }
  .rent-book summary::after { content: "▸"; margin-inline-start: auto; margin-inline-end: 8px; }
  .rent-book[open] summary::after { content: "▾"; }
  .month-keys { display: flex; gap: 4px; overflow: auto; padding-block: 3px; }
  .month-keys button { min-height: 44px; padding-inline: 7px; flex: none; }
  .month-keys button[aria-pressed="true"] { --key-face: var(--b-mine); --key-rule: var(--b-accent); }

  .purchased {
    flex: none;
    padding: 0.25rem 0.375rem;
    border: 2px solid currentColor;
    color: var(--b-gold);
    font-size: 0.75rem;
  }

  .deliveries {
    margin-top: 0.875rem;
  }

  .deliveries li {
    color: var(--b-muted);
    font-size: 0.75rem;
    padding-block: 0.375rem;
  }

  .regulars-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: clamp(1.25rem, 4vw, 2.75rem);
  }

  .regulars-list li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.55rem;
    margin: 0;
    padding-block: 0.65rem;
  }

  .regular-face {
    display: block;
    height: 2.5rem;
    align-self: center;
    overflow: hidden;
    background: var(--b-wash);
    box-shadow: inset 0 -2px var(--ledger-rule);
  }

  .regular-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.4rem;
  }

  @media (max-width: 620px) {
    .pantry-grid, .workshop-grid, .regulars-list { grid-template-columns: minmax(0, 1fr); }
    .back-to-shelf { display: inline-flex; }
  }

  @media (min-width: 760px) and (min-height: 521px) {
    .opening {
      display: grid;
      grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
      grid-template-areas: "lead lead" "actions actions" "notice notice" "details contracts" "footer footer";
      align-items: start;
      column-gap: var(--space-5);
    }
    .opening-main { grid-area: lead; }
    .opening-actions { grid-area: actions; }
    .opening-details { grid-area: details; min-width: 0; }
    .opening-account { margin-block-start: var(--space-4); }
    .opening-contracts { grid-area: contracts; }
    .opening > .notice { grid-area: notice; }
    .opening-footer { grid-area: footer; }
  }

  @media (max-width: 440px) {
    .opening-main { align-items: start; }
    .menu-entries.many { grid-template-columns: minmax(0, 1fr); }
    .opening-account, .opening-footer, .new-menu { margin-block-start: var(--space-4); }
    .opening-art { margin-block-start: 0.1rem; }
    .shop-tools { column-gap: 0.65rem; }
  }

  @media (orientation: landscape) and (max-height: 520px) and (min-width: 570px) {
    .ledger.show-receipt { max-width: 37rem; }

    .opening, .receipt-page { padding: 1.125rem 1.5rem 1.4rem; }

    .opening {
      display: grid;
      grid-template-columns: minmax(0, 1.13fr) minmax(0, 0.87fr);
      grid-template-areas: "lead menu" "actions actions" "notice notice" "account contracts" "footer footer";
      align-items: center;
      gap: 0.55rem 1rem;
    }

    .opening-main { grid-area: lead; }
    .opening-actions { grid-area: actions; margin: 0; }
    .opening-details { display: contents; }
    .opening.has-calendar { grid-template-areas: "lead menu" "actions actions" "notice notice" "account contracts" "calendar calendar" "footer footer"; }
    .calendar-strip { grid-area: calendar; margin-block-start: 0; }
    .new-menu, .next-menu { grid-area: menu; margin: 0; }
    .opening-account { grid-area: account; margin: 0; }
    .opening-contracts { grid-area: contracts; margin: 0; }
    .opening > .notice { grid-area: notice; }
    .opening-footer { grid-area: footer; display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem 1.15rem; margin: 0; }
    .shop-tools { margin: 0; column-gap: 0.7rem; }
    .opening-art :global(svg) { width: 5.25rem; }
    .headline { font-size: clamp(1.6rem, 4.25vw, 2.3rem); }
    .opening-deck { margin-top: 0.5rem; }
    .opening .menu-entries.many { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .menu-entries { gap: 0.25rem; }

    .receipt-page {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
      align-items: center;
      gap: var(--space-3) var(--space-6);
    }

    .receipt-heading, .closure-note, .receipt-page > .notice, .receipt-actions, .receipt-month { grid-column: 1 / -1; }
    .receipt-story, .closure-note, .receipt-actions { margin: 0; }
    .receipt-details .till-items { margin: 0; padding: 0; border: 0; }
    .takings { font-size: 3.2rem; }
  }

  @media (forced-colors: active) {
    .ledger-link:focus-visible { outline-color: Highlight; }
    .day-heading h2, .receipt-stamp { color: CanvasText; }
  }
</style>
