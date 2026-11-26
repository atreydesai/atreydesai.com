<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import { arcadeExpert, setExpert } from "#lib/boba.ts";
  import { fitCanvas, MENU_ICONS } from "#lib/arcade/art.ts";
  import { createFrameLoop } from "#lib/arcade/core/loop.ts";
  import { createBackdrop } from "#lib/arcade/scenery/live.ts";
  import { arcadeExits, mountShell } from "#lib/arcade/shell.ts";
  import {
    blankPowerups, buyBranch, buyPowerup, buyPublicity, buyStock, buyUpgrade, campaignEffects, certifyCrew, consumeIngredients, dayEvent, hireCrew, selectBranch, setCrewActive,
    finishDay, fitBranch, INGREDIENTS, levelFor, newCampaign, normalizeCampaign, paintShop, setCupPrint, setManagedBranch, setManagerBranch, setManagerMenu, setStandingOrder, settleManagedBranch, settleManagerBranch, startDay, takeCommission,
    type Campaign, type CampaignMode, type IngredientId, type PowerupId,
  } from "#lib/arcade/orders-campaign.ts";
  import {
    activateCampaignPowerup, cateringProgress, createServiceDay, fillNewBuilds, normalizeHouseBlend, openingShortages, orderExpressDelivery, recipeFromHouseBlend,
    REGULARS, reservationForDay, reservationProgress, restoreService, serviceRecipeRecords, serviceSummary, serviceUsageDelta, type HouseBlend,
    settleExpressDelivery, tickCampaignService,
    type ServiceState,
  } from "#lib/arcade/orders-service.ts";
  import { cateringOffer } from "#lib/arcade/orders-catering.ts";
  import { blendForDay, normalizeBlendTin, type BlendTin } from "#lib/arcade/orders-blend-tin.ts";
  import {
    finishMusic, setMusicPaused, setMusicPhase, sfxBlip, sfxBrew, sfxBrewed, sfxIce, sfxPlop, sfxSeal,
    sfxServe, sfxShake, sfxSizzle, sfxTicket, sfxTipJar, startMusic, stopMusic,
  } from "#lib/sfx.ts";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import ExpertTag from "./ExpertTag.svelte";
  import HudButtons from "./HudButtons.svelte";
  import OrderShopLedger from "./OrderShopLedger.svelte";
  import OrderServiceCounter from "./OrderServiceCounter.svelte";
  import OrderPixelWord from "./OrderPixelWord.svelte";
  import PauseCard from "./PauseCard.svelte";
  import { money, type ShopSound } from "#lib/arcade/orders-display.ts";
  import { shiftContracts, shiftContractReward } from "#lib/arcade/orders-challenges.ts";
  import { commissionOffer, commissionCups } from "#lib/arcade/orders-commissions.ts";

  const dispatch = createEventDispatcher<{ close: null; menu: null }>();
  const { exit, toMenu } = arcadeExits(dispatch);
  const backdrop = createBackdrop("orders");
  const illustration = MENU_ICONS.orders;
  const closingHandoffSeconds = 2.6;
  const cameraKey = "boba_order_up_close_camera_v1";
  const shopSounds: Record<ShopSound, () => void> = {
    tap: sfxBlip, ticket: sfxTicket, heat: sfxBrew, brew: sfxBrewed, portion: sfxPlop,
    ice: sfxIce, shake: sfxShake, sizzle: sfxSizzle, seal: sfxSeal, tray: sfxTipJar, serve: sfxServe,
  };

  let mode: CampaignMode = get(arcadeExpert) ? "expert" : "normal";
  let campaign = newCampaign(mode);
  let shift: ServiceState | null = null;
  let practice: { source: Campaign; plan: ServiceState; shift: ServiceState; ticket: number } | null = null;
  let isServing = false;
  let paused = false;
  let reduceMotion = false;
  let storageAvailable = true;
  let storageNotice = "";
  let notice = "";
  let initialReceipt = false;
  let bookedDay: number | null = null;
  let cateringDay: number | null = null;
  let houseBlend: HouseBlend | null = null;
  let blendTin: BlendTin = normalizeBlendTin(null, 1);
  let host: HTMLElement;
  let heading: HTMLElement;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let pauseCard: PauseCard;
  let serviceCounter: OrderServiceCounter;
  let ledger: OrderShopLedger;
  let classic: typeof import("./OrderUp.svelte").default | null = null;
  let loadingClassic = false;
  let mounted = false;
  let unsubscribeShell: (() => void) | undefined;
  let activeSeconds = 0;
  let sinceSave = 0;
  let serviceTime = 0;
  let closingHandoff = 0;
  let closeView = false;
  let musicPhase: "opening" | "steady" | "rush" | null = null;

  $: counterShift = practice?.shift ?? (shift && closingHandoff > 0 ? { ...shift, elapsed: shift.elapsed + closingHandoff } : shift);
  $: inKitchen = isServing || !!practice;
  $: todayBlend = blendForDay(houseBlend, blendTin, campaign.day);
  $: menuShift = campaign.status === "closed" ? null : shift ?? openingShift(campaign, bookedDay === campaign.day, todayBlend, cateringDay === campaign.day);
  $: contracts = menuShift ? shiftContracts(menuShift) : [];
  $: commission = campaign.status === "closed" ? null : commissionOffer(campaign.day, campaign.mode === "expert");
  $: todaySpecials = [...new Set(menuShift?.orders.filter((order) => order.locationSpecial || order.seasonalSpecial || order.houseBlend).map(({ recipe }) => recipe.name))];
  $: shortages = !shift && menuShift ? openingShortages(campaign, menuShift.orders) : [];
  $: summary = shift ? serviceSummary(shift) : null;
  $: till = summary && shift ? summary.revenue + Math.round(summary.tips * shift.effects.tipMultiplier) : 0;
  $: remaining = shift ? Math.max(0, Math.ceil(shift.duration - shift.elapsed)) : 0;
  $: clockFace = Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0");

  const saveKey = (selected: CampaignMode) => "boba_order_up_shop_v1_" + selected;

  function openingShift(source: Campaign, reserveTable: boolean, blend: HouseBlend | null, bookCatering = false, startPrep = false) {
    return createServiceDay({
      day: source.day, expert: source.mode === "expert", upgrades: source.upgrades, activeCrew: source.activeCrew,
      activeBranch: source.activeBranch, branchFittings: source.branchFittings, publicity: source.publicity, event: dayEvent(source.currentEvent),
      regularVisits: source.regularVisits, highestReputation: source.highestReputation, certifiedCrew: source.certifiedCrew,
      reserveTable, bookCatering, startPrep, houseBlend: blend ?? undefined,
    });
  }

  function practiceTicket(plan: ServiceState, ticket: number): ServiceState {
    const order = plan.orders[ticket % plan.orders.length];
    return {
      ...plan, duration: 3_600, notice: "", orderPlan: undefined,
      orders: [{ ...order, arrivesAt: 0, patience: 3_600, maxPatience: 3_600 }],
    };
  }

  async function openPractice(customerId?: string) {
    const source: Campaign = { ...campaign, status: "open", legacyUnlimitedStock: true, powerups: blankPowerups() };
    const plan = openingShift(source, false, todayBlend);
    if (!plan.orders.length) return;
    if (customerId) {
      const regular = REGULARS.find(({ id, day }) => id === customerId && day <= campaign.day);
      if (!regular) return;
      const sample = {
        id: `${campaign.day}-album-practice`, customerId: regular.id, customerName: regular.name,
        tag: regular.tag, arrivesAt: 0, patience: 3_600, maxPatience: 3_600,
        status: "waiting" as const, recipe: regular.favorite, cup: null,
      };
      plan.orders = [sample, ...plan.orders.filter((order) => order.customerId !== customerId)];
    }
    practice = { source, plan, shift: practiceTicket(plan, 0), ticket: 0 };
    paused = false;
    serviceTime = 0;
    setMusicPhase("opening");
    startMusic();
    loop.resync();
    loop.redraw();
    await tick();
    heading?.focus({ preventScroll: true });
  }

  function nextPractice() {
    if (practice) {
      const ticket = practice.ticket + 1;
      practice = { ...practice, ticket, shift: practiceTicket(practice.plan, ticket) };
      serviceTime = 0;
    }
  }

  function settleShift(source: Campaign, completed: ServiceState) {
    const settled = settleExpressDelivery(source, completed);
    const stand = settleManagedBranch(settled.campaign, completed.elapsed);
    const managed = settleManagerBranch(stand.campaign, completed.elapsed);
    const offer = source.commission ? commissionOffer(source.day, source.mode === "expert") : null;
    return finishDay(managed.campaign, { ...serviceSummary(settled.service), contractBonus: shiftContractReward(settled.service),
      recipeRecords: serviceRecipeRecords(settled.service),
      reservationBonus: reservationProgress(settled.service).earned, cateringBonus: cateringProgress(settled.service)?.earned ?? 0,
      managedOrders: stand.orders, managedSales: stand.sales,
      managerOrders: managed.orders, managerSales: managed.sales,
      commissionServed: offer ? commissionCups(offer, settled.service) : 0 });
  }

  function readSave(selected: CampaignMode) {
    let data: { campaign?: unknown; shift?: unknown; bookedDay?: unknown; cateringDay?: unknown; houseBlend?: unknown; blendTin?: unknown } | null = null;
    try {
      const serialized = window.localStorage.getItem(saveKey(selected));
      data = serialized ? JSON.parse(serialized) : null;
    } catch {
      storageAvailable = false;
      storageNotice = "Could not read the previous save.";
    }
    const loaded = normalizeCampaign(data?.campaign, selected);
    const active = loaded.status === "open" ? restoreService(data?.shift, loaded.day, selected === "expert") : null;
    // A damaged workbench can be reopened from the ledger using the shop's stock.
    campaign = loaded.status === "open" && !active ? { ...loaded, status: "planning" } : loaded;
    const { tipMultiplier, batchPickup } = campaignEffects(campaign);
    shift = active ? { ...active, effects: { ...active.effects, tipMultiplier, batchPickup } } : null;
    bookedDay = data?.bookedDay === campaign.day && campaign.status !== "closed" ? campaign.day : null;
    cateringDay = data?.cateringDay === campaign.day && campaign.status !== "closed" && campaign.upgrades.includes("takeout-rack") ? campaign.day : null;
    houseBlend = campaign.upgrades.includes("menu-easel") ? normalizeHouseBlend(data?.houseBlend, campaign.day) : null;
    blendTin = normalizeBlendTin(campaign.upgrades.includes("menu-easel") && levelFor(campaign) >= 5 ? data?.blendTin : null, campaign.day);
    initialReceipt = false;
    closingHandoff = 0;
    sinceSave = 0;
    isServing = false;
    paused = false;
    if (active?.status === "complete") {
      const settlement = settleShift(campaign, active);
      if (settlement.ok) {
        campaign = settlement.campaign;
        shift = null;
        bookedDay = null;
        cateringDay = null;
        initialReceipt = true;
        save();
      }
    }
  }

  function save() {
    try {
      window.localStorage.setItem(saveKey(mode), JSON.stringify({ campaign, shift, bookedDay, cateringDay, houseBlend, blendTin }));
      sinceSave = 0;
      storageAvailable = true;
      storageNotice = "";
    } catch {
      sinceSave = 0;
      storageAvailable = false;
      storageNotice = "This browser could not save the shop.";
    }
  }

  function saveCamera(close: boolean) {
    closeView = close;
    try {
      window.localStorage.setItem(cameraKey, close ? "1" : "0");
    } catch {
      // The camera is still available for this visit.
    }
  }

  function onOtherTab(event: StorageEvent) {
    if (event.key !== saveKey(mode)) return;
    if (isServing) stopMusic();
    readSave(mode);
    isServing = false;
    notice = "This shop was updated in another tab.";
    loop.redraw();
  }

  async function switchMode(selected: CampaignMode) {
    if (selected === mode || isServing) return;
    save();
    mode = selected;
    setExpert(selected === "expert");
    readSave(selected);
    notice = "";
    activeSeconds = 0;
    await tick();
    loop.redraw();
  }

  function show(result: { campaign: Campaign; message: string; ok: boolean }) {
    notice = result.message;
    if (!result.ok) return;
    campaign = result.campaign;
    sfxBlip();
    save();
  }

  async function openDay(startPrep = false) {
    if (!shift) {
      const opening = startDay(campaign);
      if (!opening.ok) {
        notice = opening.message;
        return;
      }
      campaign = opening.campaign;
      shift = openingShift(campaign, bookedDay === campaign.day, todayBlend, cateringDay === campaign.day, startPrep);
    }
    notice = "";
    initialReceipt = false;
    isServing = true;
    paused = false;
    musicPhase = null;
    followMusic(shift.elapsed, shift.duration);
    startMusic();
    serviceTime = 0;
    sinceSave = 0;
    save();
    loop.resync();
    await tick();
    heading.focus({ preventScroll: true });
  }

  function resetShop() {
    campaign = newCampaign(mode);
    shift = null;
    bookedDay = null;
    cateringDay = null;
    houseBlend = null;
    blendTin = normalizeBlendTin(null, 1);
    initialReceipt = false;
    isServing = false;
    activeSeconds = 0;
    notice = "The new shop is ready.";
    save();
    loop.redraw();
    void tick().then(() => ledger?.focus());
  }

  function closeDay(current: ServiceState) {
    const result = settleShift(campaign, current);
    if (!result.ok) {
      notice = result.message;
      return;
    }
    campaign = result.campaign;
    shift = null;
    bookedDay = null;
    cateringDay = null;
    closingHandoff = 0;
    isServing = false;
    paused = false;
    finishMusic();
    initialReceipt = true;
    notice = "";
    save();
    loop.redraw();
    void tick().then(() => ledger?.focus());
  }

  function applyShift(next: ServiceState, feedback = "", sound: ShopSound = "tap") {
    if (practice) {
      if (next === practice.shift) return false;
      const filled = fillNewBuilds(practice.source, practice.shift, next);
      practice = { ...practice, shift: { ...filled.service, notice: feedback || next.notice } };
      if (sound === "serve") sfxServe((next.receipts.at(-1)?.quality ?? 0) >= 94);
      else shopSounds[sound]();
      return true;
    }
    if (!isServing || !shift || next === shift) return false;
    const portions = serviceUsageDelta(shift, next);
    if (Object.keys(portions).length) {
      const stock = consumeIngredients(campaign, portions);
      if (!stock.ok) {
        notice = stock.message;
        return false;
      }
      campaign = stock.campaign;
    }
    ({ campaign, service: shift } = fillNewBuilds(campaign, shift, next));
    notice = feedback;
    if (sound === "serve") sfxServe((next.receipts.at(-1)?.quality ?? 0) >= 94);
    else shopSounds[sound]();
    if (next.status === "complete" && (sound !== "serve" || reduceMotion)) closeDay(next);
    else save();
    return true;
  }

  function activate(id: PowerupId, orderId?: string) {
    if (!shift) return false;
    const result = activateCampaignPowerup(campaign, shift, id, orderId);
    notice = result.message;
    if (!result.ok) return false;
    ({ campaign, service: shift } = fillNewBuilds(result.campaign, shift, result.service));
    if (id === "quiet") sfxTipJar();
    else sfxBlip();
    save();
    return true;
  }

  function callExpress(ingredient: IngredientId) {
    if (!shift) return false;
    const result = orderExpressDelivery(campaign, shift, ingredient);
    notice = result.message;
    if (!result.ok) return false;
    campaign = result.campaign;
    shift = result.service;
    sfxBlip();
    save();
    return true;
  }

  function reserveTable(active: boolean) {
    if (shift || campaign.status !== "planning" || !reservationForDay(campaign.day, campaign.mode === "expert")) return;
    bookedDay = active ? campaign.day : null;
    if (active) cateringDay = null;
    sfxBlip();
    save();
  }

  function reserveCatering(active: boolean) {
    if (shift || campaign.status !== "planning" || !campaign.upgrades.includes("takeout-rack") ||
      !cateringOffer(campaign.day, campaign.mode === "expert")) return;
    cateringDay = active ? campaign.day : null;
    if (active) bookedDay = null;
    sfxBlip();
    save();
  }

  function saveHouseBlend(blend: HouseBlend | null) {
    if (shift || campaign.status !== "planning" || !campaign.upgrades.includes("menu-easel")) return;
    const recipe = normalizeHouseBlend(blend, campaign.day);
    if (blend && !recipe) return;
    houseBlend = recipe;
    if (blendTin.rotate) blendTin = { ...blendTin, rotate: false };
    notice = recipe ? recipeFromHouseBlend(recipe).name + " is on the menu." : "House tea taken off the menu.";
    sfxBlip();
    save();
  }

  function updateBlendTin(next: BlendTin) {
    if (shift || campaign.status !== "planning" || !campaign.upgrades.includes("menu-easel") || levelFor(campaign) < 5) return;
    blendTin = normalizeBlendTin(next, campaign.day);
    sfxBlip();
    save();
  }

  async function pause() {
    if ((!practice && (!isServing || !shift)) || paused) return;
    paused = true;
    setMusicPaused(true);
    if (!practice) save();
    await tick();
    pauseCard?.focus();
  }

  async function resume() {
    if (!paused) return;
    paused = false;
    setMusicPaused(false);
    loop.resync();
    await tick();
    heading.focus({ preventScroll: true });
  }

  async function returnToLedger() {
    if (practice) {
      practice = null;
      paused = false;
      finishMusic();
      loop.redraw();
      await tick();
      ledger?.focus();
      return;
    }
    if (shift?.status === "complete") {
      closeDay(shift);
      return;
    }
    isServing = false;
    paused = false;
    finishMusic();
    save();
    loop.redraw();
    await tick();
    heading.focus({ preventScroll: true });
  }

  function resize() {
    if (canvas) ctx = fitCanvas(canvas, innerWidth, innerHeight);
    loop.redraw();
  }

  function followMusic(elapsed: number, duration: number) {
    const phase = elapsed >= duration * 0.81 ? "rush" : elapsed >= 16 ? "steady" : "opening";
    if (phase === musicPhase) return;
    musicPhase = phase;
    setMusicPhase(phase);
  }

  function draw() {
    if (!ctx) return;
    const w = innerWidth;
    const h = innerHeight;
    const fraction = shift ? Math.min(1, shift.elapsed / shift.duration) : 0;
    const kitchen = isServing || !!practice;
    ctx.fillStyle = kitchen ? "#2c272a" : "#504047";
    ctx.fillRect(0, 0, w, h);
    backdrop(ctx, {
      width: w, height: h, focus: 0.64, time: activeSeconds,
      still: reduceMotion || paused, alternate: 1 - fraction, opacity: kitchen ? 0.26 : 0.9,
    });
    ctx.fillStyle = "rgba(40, 27, 30, 0.24)";
    ctx.fillRect(0, 0, w, h);
  }

  const loop = createFrameLoop({
    isPaused: () => paused || (!isServing && !practice),
    drawWhilePaused: false,
    update(dt) {
      if (!shift && !practice) return;
      activeSeconds += dt;
      if (!practice) sinceSave += dt;
      serviceTime += dt;
      if (serviceTime < 0.085) return;
      const step = serviceTime;
      serviceTime = 0;
      if (practice) {
        const ticked = tickCampaignService(practice.source, practice.shift, step);
        const filled = fillNewBuilds(ticked.campaign, practice.shift, ticked.service);
        if (filled.service.receipts.length > practice.shift.receipts.length) sfxServe();
        practice = { ...practice, source: filled.campaign, shift: filled.service };
        return;
      }
      if (!shift) return;
      if (shift.status === "complete") {
        closingHandoff += step;
        if (closingHandoff >= closingHandoffSeconds || reduceMotion) closeDay(shift);
        return;
      }
      const ticked = tickCampaignService(campaign, shift, step);
      const filled = fillNewBuilds(ticked.campaign, shift, ticked.service);
      const next = filled.service;
      followMusic(next.elapsed, next.duration);
      const freshReceipt = next.receipts.length > shift.receipts.length;
      const delivery = shift.pendingDelivery && !next.pendingDelivery ? shift.pendingDelivery : null;
      campaign = filled.campaign;
      if (freshReceipt) {
        notice = next.receipts.at(-1)?.message ?? "";
        sfxServe((next.receipts.at(-1)?.quality ?? 0) >= 94);
      } else if (delivery && next.status !== "complete") {
        notice = `${INGREDIENTS.find(({ id }) => id === delivery.ingredient)?.name ?? "Stock"} arrived.`;
        sfxBrewed();
      }
      if (next.status === "complete" && (!freshReceipt || reduceMotion)) closeDay(next);
      else {
        shift = next;
        if (freshReceipt || delivery || filled.service !== ticked.service || sinceSave >= 2) save();
      }
    },
    draw,
  });

  async function openClassic() {
    if (loadingClassic) return;
    loadingClassic = true;
    try {
      const game = await import("./OrderUp.svelte");
      if (!mounted) return;
      save();
      loop.stop();
      unsubscribeShell?.();
      unsubscribeShell = undefined;
      classic = game.default;
    } catch {
      notice = "Score attack could not open. Try again.";
    } finally {
      loadingClassic = false;
    }
  }

  onMount(() => {
    mounted = true;
    readSave(mode);
    try {
      closeView = window.localStorage.getItem(cameraKey) === "1";
    } catch {
      closeView = false;
    }
    unsubscribeShell = mountShell({
      isOver: () => false,
      isPaused: () => paused,
      pause,
      togglePause: () => paused ? resume() : pause(),
      playScope: () => host,
      onResize: resize,
      onReduceMotion: (value) => {
        reduceMotion = value;
        loop.redraw();
      },
      onKey: (event) => {
        if (!inKitchen || paused || event.altKey || event.ctrlKey || event.metaKey ||
          (event.target instanceof HTMLElement && event.target.closest("input, select, textarea"))) return;
        if (event.key.startsWith("Arrow") && !event.shiftKey &&
          !(event.target instanceof HTMLElement && event.target.isContentEditable) && serviceCounter?.moveInDirection(event.key)) {
          event.preventDefault();
          return;
        }
        if (event.key.toLowerCase() === "v") {
          event.preventDefault();
          void serviceCounter?.toggleCamera();
          return;
        }
        if (event.code === "Space" && !(event.target instanceof HTMLElement && event.target.closest("button, summary, a")) && serviceCounter?.activatePrimary()) {
          event.preventDefault();
          return;
        }
        const index = Number(event.key) - 1;
        if (Number.isInteger(index) && index >= 0 && index < 5) {
          event.preventDefault();
          void serviceCounter?.goToStation(index, true);
        }
      },
    });
    const persistOnLeave = () => { if (shift) save(); };
    window.addEventListener("pagehide", persistOnLeave);
    window.addEventListener("storage", onOtherTab);
    resize();
    loop.start();
    heading?.focus({ preventScroll: true });
    return () => {
      mounted = false;
      if (shift) save();
      if (!classic) stopMusic();
      loop.stop();
      unsubscribeShell?.();
      window.removeEventListener("pagehide", persistOnLeave);
      window.removeEventListener("storage", onOtherTab);
    };
  });
</script>

{#if classic}
  <svelte:component this={classic} on:close={() => dispatch("close")} on:menu={() => dispatch("menu")} />
{:else}
  <div class="boba-stage shop-wall" aria-hidden="true"></div>
  <canvas bind:this={canvas} class="boba-canvas shop-scene" aria-hidden="true"></canvas>
  <div
    bind:this={host}
    class="shop boba-ui order-pixel-ui"
    class:is-working={inKitchen}
    role="dialog"
    aria-modal="true"
    aria-labelledby="order-shop-title"
  >
    <div class="shop-frame" inert={paused}>
      <header class="shop-header">
        <div class="shop-sign">
          <PixelIcon grid={illustration.grid} palette={illustration.palette} px={3} />
          <div>
            <h1 id="order-shop-title" bind:this={heading} tabindex="-1" data-arcade-tab-anchor>
              <span class="sr-only">order up</span><OrderPixelWord text="Order Up" />
            </h1>
            {#if isServing && shift?.expert}
              <span class="shop-expert"><ExpertTag /></span>
            {:else if !inKitchen}
              <span class="shop-tagline">milk tea counter</span>
            {/if}
          </div>
        </div>
        {#if practice}
          <span class="practice-meter"><span class="sr-only">Practice counter</span><OrderPixelWord text="Practice" cells={1.5} /></span>
          <HudButtons {paused} on:pause={pause} />
        {:else if isServing && shift}
          <div class="shop-meter" aria-label="Shift status">
            <span>Day <strong><span class="sr-only">{campaign.day}</span><OrderPixelWord text={String(campaign.day)} cells={1.5} /></strong></span>
            {#if shift.preOpen !== undefined}
              <span>Prep <strong><span class="sr-only">{Math.ceil(shift.preOpen)} seconds</span><OrderPixelWord text={String(Math.ceil(shift.preOpen))} cells={1.5} /></strong></span>
            {:else if shift.status === "open"}
              <span>Time <strong><span class="sr-only">{clockFace}</span><OrderPixelWord text={clockFace} cells={1.5} /></strong></span>
            {:else}
              <span class="last-call">Last call</span>
            {/if}
            <span class="shop-till">Till <strong><span class="sr-only">{money(till)}</span><OrderPixelWord text={money(till)} cells={1.5} /></strong></span>
          </div>
          <HudButtons {paused} on:pause={pause} />
        {:else}
          <div class="shop-modes" role="group" aria-label="Shop difficulty">
            <button class="boba-key" type="button" aria-pressed={mode === "normal"} on:click={() => switchMode("normal")}>
              <span class="sr-only">Normal</span><OrderPixelWord text="Normal" cells={1} />
            </button>
            <button class="boba-key" type="button" aria-pressed={mode === "expert"} on:click={() => switchMode("expert")}>
              <span class="sr-only">Expert</span><OrderPixelWord text="Expert" cells={1} />
            </button>
          </div>
          <button class="shop-menu boba-key" type="button" aria-label="Arcade menu" on:click={toMenu}>Arcade<span class="wide-menu">menu</span></button>
        {/if}
      </header>

      <main class="shop-content" class:counter-content={inKitchen}>
        {#if inKitchen && counterShift}
          {#key practice?.ticket ?? -1}
          <OrderServiceCounter
            bind:this={serviceCounter}
            campaign={practice?.source ?? campaign}
            shift={counterShift}
            notice={practice ? "" : storageAvailable ? notice : storageNotice}
            {paused}
            {reduceMotion}
            {closeView}
            contracts={practice ? [] : contracts}
            commission={practice ? null : commission}
            training={!!practice}
            onApply={applyShift}
            onPowerup={(id, orderId) => practice ? false : activate(id, orderId)}
            onExpress={(id) => practice ? false : callExpress(id)}
            onCamera={saveCamera}
            onNextPractice={nextPractice}
            onExitPractice={returnToLedger}
          />
          {/key}
        {:else}
          <div class="ledger-space">
            {#key mode}
              <OrderShopLedger
                bind:this={ledger}
                {campaign}
                {contracts}
                {commission}
                {todaySpecials}
                {shortages}
                {houseBlend}
                {todayBlend}
                {blendTin}
                tableBooked={shift ? !!shift.reservation : bookedDay === campaign.day}
                cateringBooked={shift ? !!shift.catering : cateringDay === campaign.day}
                {initialReceipt}
                hasActiveShift={!!shift}
                hasPrepShift={shift?.preOpen !== undefined}
                saveNotice={storageAvailable ? notice : storageNotice}
                onStart={openDay}
                onPractice={openPractice}
                onPrint={(id) => show(setCupPrint(campaign, id))}
                onBuyUpgrade={(id) => show(buyUpgrade(campaign, id))}
                onBuyPowerup={(id) => show(buyPowerup(campaign, id))}
                onOrderStock={(id, supplier, crates) => show(buyStock(campaign, id, supplier, crates))}
                onStandingOrder={(id, supplier) => show(setStandingOrder(campaign, id, supplier))}
                onHire={(id) => show(hireCrew(campaign, id))}
                onCertify={(id) => show(certifyCrew(campaign, id))}
                onAssign={(id, active) => show(setCrewActive(campaign, id, active))}
                onBuyBranch={(id) => show(buyBranch(campaign, id))}
                onFitBranch={(id) => show(fitBranch(campaign, id))}
                onSelectBranch={(id) => show(selectBranch(campaign, id))}
                onManagedBranch={(id) => show(setManagedBranch(campaign, id))}
                onManagerBranch={(id) => show(setManagerBranch(campaign, id))}
                onManagerMenu={(branch, menu) => show(setManagerMenu(campaign, branch, menu))}
                onPublicity={(id) => show(buyPublicity(campaign, id))}
                onReserve={reserveTable}
                onCatering={reserveCatering}
                onCommission={() => show(takeCommission(campaign))}
                onPaint={(paint) => show(paintShop(campaign, paint))}
                onHouseBlend={saveHouseBlend}
                onBlendTin={updateBlendTin}
                onRestart={resetShop}
                onClassic={openClassic}
                {loadingClassic}
              />
            {/key}
          </div>
        {/if}
      </main>
    </div>
    {#if paused}
      <PauseCard
        bind:this={pauseCard}
        pixel
        resumeLabel="Resume shift"
        menuLabel="Shop ledger"
        on:resume={resume}
        on:menu={returnToLedger}
        on:exit={exit}
      />
    {/if}
  </div>
{/if}

<style>
  .shop-scene,
  .shop-wall {
    background: #56454a;
  }

  .shop {
    position: fixed;
    inset: 0;
    z-index: calc(var(--layer-overlay) + 2);
  }

  .shop-frame {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
  }

  .shop-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-4);
    padding: max(10px, env(safe-area-inset-top)) max(var(--space-5), env(safe-area-inset-right)) var(--space-3)
      max(var(--space-5), env(safe-area-inset-left));
    border-bottom: 3px solid #7c5d50;
    background: #302622;
    color: #fff1dd;
  }

  .shop-sign {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .shop-sign h1 {
    margin: 0;
    color: #fff1dd;
    font-family: var(--font-display);
    font-size: clamp(1.38rem, 4vw, 2rem);
    line-height: 0.94;
    font-weight: 700;
    letter-spacing: -0.04em;
  }

  .shop-sign h1:focus {
    outline: none;
  }

  .shop-sign > div > span {
    display: block;
    color: #e5c9ae;
    font-size: 0.69rem;
    margin-top: 3px;
    white-space: nowrap;
  }

  .shop-expert { --b-accent: #f18272; }

  .shop-modes,
  .shop-meter {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .shop-modes {
    gap: 3px;
  }

  .shop-modes button,
  .shop-menu {
    min-height: 42px;
    padding-inline: var(--space-2);
    font-size: 0.78rem;
  }

  .shop-modes button[aria-pressed="true"] {
    --key-face: #eaceac;
    --key-foot: #b08060;
    --key-rule: #f0d8bc;
    color: #322621;
  }

  .shop-meter > span {
    display: grid;
    justify-items: start;
    min-width: 2.85rem;
    color: #ead3b9;
    font-size: 0.72rem;
    line-height: 1.1;
  }

  .shop-meter strong {
    color: #fff2df;
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
  }
  .shop-meter .last-call { color: #f1b579; align-self: end; }
  .practice-meter { color: #efd2a1; margin-inline-start: auto; }

  .shop-header :global(.boba-icon-btn) {
    width: 2.375rem;
    height: 2.5rem;
    color: #fff2df;
    background: #392a28;
    border-radius: 0;
    box-shadow: inset 0 0 0 2px #836456, inset 0 -4px #221b1e;
    clip-path: var(--notch);
  }

  .shop-header :global(.boba-icon-btn:hover) {
    color: #ffb89d;
    background: rgb(255 225 194 / 0.13);
  }

  .wide-menu {
    margin-inline-start: -0.15em;
  }

  .shop-content {
    min-width: 0;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }

  .ledger-space {
    display: grid;
    width: min(calc(100% - 2rem), 51rem);
    margin: var(--space-6) auto max(var(--space-4), env(safe-area-inset-bottom));
  }

  @media (max-width: 620px) {
    .shop-header {
      gap: var(--space-2);
      padding-inline: max(var(--space-2), env(safe-area-inset-left)) max(var(--space-2), env(safe-area-inset-right));
    }

    .shop-sign { gap: var(--space-1-5); }
    .shop-sign :global(.pixel-icon) { max-width: 27px; }
    .shop-sign > div > span { font-size: 0.59rem; }
    .shop-meter > span { min-width: 2.3rem; }
    .shop-modes button { padding-inline: var(--space-1-5); }
    .wide-menu { display: none; }
    .ledger-space { width: calc(100% - 1.125rem); margin-top: var(--space-2); }
  }

  @media (max-width: 380px) {
    .shop-sign :global(.pixel-icon) { display: none; }
    .shop-till { display: none !important; }
  }

  @media (orientation: landscape) and (max-height: 540px) {
    .shop-header { padding-block: 4px; }
    .shop-sign .shop-tagline { display: none; }
    .ledger-space { margin-top: var(--space-2); }
  }
</style>
