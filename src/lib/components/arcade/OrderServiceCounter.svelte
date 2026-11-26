<script lang="ts">
  import { tick } from "svelte";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import { TAKEAWAY } from "#lib/arcade/orders-guests.js";
  import { BRANCHES, INGREDIENTS, POWERUPS, campaignPowerupBlockReason, dayEvent, managerOrderCap, managerSupplyCapacity, neighborhoodAwardCount,
    runnerHandoffSeconds, selectedManagerMenu, stockCount, type Campaign, type IngredientId, type PowerupId } from "#lib/arcade/orders-campaign.ts";
  import {
    addIngredient, applyServiceExtras, applyServiceToppings, AUTO_SEAL_SECONDS, canAutoSeal, canFillCarafe, carafeRemaining, cateringProgress,
    chargeSparkle, closeServiceDay, collectBatch, discardPrepBatch,
    EXPRESS_DELIVERY_DAY, expressDeliveryBlockReason, expressDeliveryQuote, FLOAT_FLAVORS, foamDrink, foamMilkFor, ingredientSwapQuote,
    isOverTarget, MIXINS, prepFreshness, PREP_YIELDS, SYRUPS, TOPPINGS,
    HOUSE_ROUND_STREAK, openServiceDoors, openTicketCount, pourCarafe, readyReservationOrders, recipeSide, remakeOrder, removeIngredient,
    requestIngredientSwap, reservationProgress, runnerPickupOrders, scoopFloat, scoopFreshness, serveHouseRound,
    sealDrink, serveOrder, servePickupCounter, serveReservationTable, setIce, shakeDrink, startBatch, startBrew, stopBrew, SWAP_TIP_COST,
    servicePowerupBlockReason, takeOrder, unlockedIngredients, type ServiceState, type ServiceOrder, type ServiceCup,
    type TeaId, type MilkId, type FloatFlavor, type Level, type PrepBatch, type PrepId,
  } from "#lib/arcade/orders-service.ts";
  import { money, type ShopSound } from "#lib/arcade/orders-display.ts";
  import OrderCustomerFloor from "./OrderCustomerFloor.svelte";
  import OrderCommissionNote from "./OrderCommissionNote.svelte";
  import OrderKitchenItem from "./OrderKitchenItem.svelte";
  import OrderKitchenScene from "./OrderKitchenScene.svelte";
  import OrderPickupView from "./OrderPickupView.svelte";
  import OrderPixelWord from "./OrderPixelWord.svelte";
  import type { RecipeMark } from "./OrderRecipePips.svelte";
  import OrderSelectedTicket from "./OrderSelectedTicket.svelte";
  import OrderShiftBoard from "./OrderShiftBoard.svelte";
  import OrderStationArt from "./OrderStationArt.svelte";
  import OrderTicketRail from "./OrderTicketRail.svelte";
  import type { ShiftContractProgress } from "#lib/arcade/orders-challenges.ts";
  import { commissionCups, shopPaint, type CommissionOffer } from "#lib/arcade/orders-commissions.ts";
  import { shopKeepsakes } from "#lib/arcade/orders-guestbook.ts";

  export let campaign: Campaign;
  export let shift: ServiceState;
  export let paused = false;
  export let reduceMotion = false;
  export let closeView = false;
  export let training = false;
  export let notice = "";
  export let contracts: readonly ShiftContractProgress[] = [];
  export let commission: CommissionOffer | null = null;
  export let onApply: (next: ServiceState, feedback?: string, sound?: ShopSound) => boolean;
  export let onPowerup: (id: PowerupId, orderId?: string) => boolean;
  export let onExpress: (id: IngredientId) => boolean;
  export let onCamera: (close: boolean) => void;
  export let onNextPractice: () => void;
  export let onExitPractice: () => void;

  const stations = ["brew", "build", "serve", "prep", "stock"] as const;
  type Station = typeof stations[number];
  const arrows: Record<string, readonly [number, number]> = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  };
  const positions = [
    { name: "Brew", x: 235, y: 217, w: 210, h: 134, feetX: 366, feetY: 273 },
    { name: "Build", x: 490, y: 340, w: 244, h: 140, feetX: 491, feetY: 282 },
    { name: "Serve", x: 690, y: 195, w: 230, h: 132, feetX: 553, feetY: 260 },
    { name: "Prep", x: 257, y: 365, w: 177, h: 116, feetX: 320, feetY: 337 },
    { name: "Stockroom", x: 509, y: 102, w: 125, h: 127, feetX: 533, feetY: 161 },
  ];
  const benchNames = { brew: "Brew stove", build: "Build island", serve: "Serve pass", prep: "Prep counter", stock: "Stockroom" };
  const crewIcons = { host: "clip", prep: "prep", runner: "serve" };
  const prepNames = { pearls: "Pearls", bun: "Buns", waffle: "Waffles" };
  const prepLabels = { pearls: "Cook pearls", bun: "Steam buns", waffle: "Toast waffles" };
  const prepIcons = { pearls: "prep-pearls", bun: "prep-buns", waffle: "prep-waffles" };
  const sides = { bun: "Bun", waffle: "Waffle" };
  const gradeMarks = [
    { id: "brew", name: "Brew", icon: "brew" },
    { id: "build", name: "Build", icon: "build" },
    { id: "finish", name: "Finish", icon: "seal" },
    { id: "wait", name: "Wait", icon: "patience" },
  ] as const;
  const apron = ["....OOOOOO....", "...OHWHHHHO...", "..OHWWHHHHHO..", "..OHHHHHHHHO..", "...OHHHHHHO...",
    "...OOOOOOOO...", "..OODDDDDDOO..", "..OSSSSSSSSO..", "..OSOSSSOSSO..", "..OSSSSSSSSO..",
    "...OSSSSSSO...", "....ODDDOO....", "...ORHHHHRO...", "..ORHHHHHHRO..", "..ORHAAAAHRO..",
    "..OSHAAAAHSO..", "...OHAAHAHO...", "...OHAAAAHO...", "...OAAAAAAO...", "....ODDODO....",
    "....ODDODO....", "...OOO.OOOO..."];
  const apronInk = { O: "#30242a", H: "#efd3a7", W: "#ffe7b9", D: "#655455", S: "#d69b74", R: "#be6357", A: "#91a17d" };
  const carryInk = { ...TAKEAWAY.palette, T: "#c78f62" };
  const iceLevels = ["No ice", "Less", "Regular", "Extra"];
  const teas = ["black", "jasmine", "taro"] as const;
  const milks = ["milk", "oat"] as const;
  const dairyFixtures: readonly (MilkId | null)[] = [null, "milk", "oat"];
  const ingredientGroups = [
    { label: "Toppings", options: TOPPINGS },
    { label: "Mix-ins", options: MIXINS },
    { label: "Syrup", options: SYRUPS },
  ];
  const ingredientLabels = Object.fromEntries(INGREDIENTS.map((item) => [item.id, item.name])) as Record<IngredientId, string>;
  const benchStock: { id: IngredientId; x: number; y: number; w: number; h: number; movedX?: number }[] = [
    { id: "pearls", x: 89, y: 154, w: 78, h: 114 },
    { id: "popping", x: 175, y: 154, w: 78, h: 114 },
    { id: "pudding", x: 261, y: 154, w: 78, h: 114 },
    { id: "grass-jelly", x: 347, y: 154, w: 78, h: 114 },
    { id: "brown-sugar", x: 588, movedX: 550, y: 165, w: 78, h: 136 },
    { id: "honey", x: 671, movedX: 624, y: 161, w: 78, h: 136 },
    { id: "vanilla", x: 754, movedX: 698, y: 165, w: 78, h: 136 },
    { id: "sesame-syrup", x: 772, y: 165, w: 72, h: 136 },
    { id: "strawberry", x: 103, y: 269, w: 98, h: 94 },
    { id: "banana", x: 187, y: 269, w: 75, h: 94 },
    { id: "mango", x: 266, y: 269, w: 72, h: 94 },
    { id: "yuzu", x: 362, y: 271, w: 78, h: 69 },
  ];

  let station: Station = shift.preOpen === undefined ? "brew" : "prep";
  let selectedId = "";
  let drafted = "";
  let selected: ServiceOrder | undefined;
  let tea: TeaId | null = null;
  let accentTea: TeaId | null = null;
  let milk: MilkId | null | undefined;
  let handoff: { cup: ServiceCup; orderId: string; customerId: string; quality: number; at: number } | null = null;
  let finishCue: { action: "shake" | "foam" | "seal"; orderId: string; at: number } | null = null;
  let leaveConfirm = false;
  let browseIngredients = false;
  let stationHeading: HTMLElement;
  let worktop: HTMLElement;
  let stationButtons: HTMLButtonElement[] = [];
  let chefSprite: HTMLDivElement;
  let carryingUntil = 0;
  let animatedRunnerOrder = "";
  let deliveryIngredient: IngredientId = "black";
  let trackedDelivery: IngredientId | null = null;
  let arrivedAt = -10;
  let expressStatus: "idle" | "incoming" | "arrived" = "idle";
  let stockReturn: number | null = null;

  $: preOpening = shift.preOpen !== undefined;
  $: tickets = preOpening ? [] : shift.orders.filter((order) => order.arrivesAt <= shift.elapsed && order.status !== "served" && order.status !== "missed");
  $: takeout = cateringProgress(shift);
  $: trayCups = takeout ? takeout.collectionAt !== null && shift.elapsed >= takeout.collectionAt ? 0 : takeout.packed : undefined;
  $: activeTickets = openTicketCount(shift);
  $: rackFull = activeTickets >= shift.effects.ticketSlots;
  $: selected = tickets.find((order) => order.id === selectedId && (!rackFull || order.status !== "waiting"))
    ?? (rackFull ? tickets.find(({ status }) => status !== "waiting") : tickets[0]);
  $: if (selected && selected.id !== drafted) {
    drafted = selected.id;
    browseIngredients = false;
    tea = selected.cup?.tea ?? (campaign.upgrades.includes("auto-tea") ? selected.recipe.tea : null);
    accentTea = selected.cup?.accentTea ?? (campaign.upgrades.includes("auto-tea") ? selected.recipe.accentTea ?? null : null);
    milk = selected.cup ? selected.cup.milk : campaign.upgrades.includes("auto-milk") ? selected.recipe.milk : undefined;
  }
  $: unlocked = unlockedIngredients(shift.day);
  $: expandedPumpRack = unlocked.includes("sesame-syrup");
  $: stockUnlocked = !training && shift.day >= EXPRESS_DELIVERY_DAY;
  $: deliveryQuote = expressDeliveryQuote(campaign, deliveryIngredient);
  $: dispatchBlock = expressDeliveryBlockReason(campaign, shift, deliveryIngredient);
  $: managedKitchen = station === "stock" && !training ? BRANCHES.find(({ id }) => id === campaign.managerBranch) : undefined;
  $: dispatchMenu = managedKitchen ? selectedManagerMenu(campaign, managedKitchen.id) : null;
  $: dispatchStock = managedKitchen ? managerSupplyCapacity(campaign, managedKitchen.id) : 0;
  $: dispatchMax = managerOrderCap(campaign.certifiedCrew.includes("manager"));
  $: replacement = !training && selected && (station === "brew" || station === "build")
    ? ingredientSwapQuote(campaign, shift, selected.id) : null;
  $: pending = shift.pendingDelivery;
  $: reserved = shift.reservation ? reservationProgress(shift) : null;
  $: tableOrders = readyReservationOrders(shift);
  $: if (pending) {
    trackedDelivery = pending.ingredient;
    deliveryIngredient = pending.ingredient;
  }
  else if (trackedDelivery) {
    arrivedAt = shift.elapsed;
    trackedDelivery = null;
  }
  $: expressStatus = pending ? "incoming" : shift.elapsed < arrivedAt + 2.3 ? "arrived" : "idle";
  $: expressProgress = pending ? 1 - progress(pending.arrivesAt - shift.elapsed, expressDeliveryQuote(campaign, pending.ingredient).seconds) : 0;
  $: brewShortage = selected?.status === "accepted"
    ? [selected.recipe.tea, selected.recipe.accentTea, selected.recipe.milk].find((id): id is TeaId | MilkId => !!id && stockCount(campaign, id) === 0)
    : undefined;
  $: brewReady = !!tea && milk !== undefined && (!selected?.recipe.accentTea || !!accentTea);
  $: cup = selected?.cup ?? null;
  $: brew = cup?.brew ?? null;
  $: hands = tickets.filter((order) => order.status === "brewing");
  $: carafeFilling = hands.some((order) => order.cup?.brew.carafeFill);
  $: carafeProgress = carafeRemaining(shift);
  $: carafeTea = carafeProgress > 0 ? shift.carafe?.tea ?? null : null;
  $: usingCarafe = selected?.status === "accepted" && !selected.recipe.accentTea && selected.recipe.tea === carafeTea;
  $: canPour = usingCarafe && milk !== undefined;
  $: canDouble = selected?.status === "accepted" && !selected.recipe.accentTea && brewReady && tea && canFillCarafe(shift) && stockCount(campaign, tea) >= 2;
  $: otherHands = hands.filter((order) => order.id !== selected?.id);
  $: runnerQueue = campaign.activeCrew.includes("runner") ? runnerPickupOrders(shift) : [];
  $: runnerStart = runnerQueue.length ? Math.max(...runnerQueue.map(({ cup }) => cup?.sealedAt ?? shift.elapsed)) : null;
  $: runnerDelay = runnerHandoffSeconds(campaign);
  $: runnerProgress = runnerStart === null ? undefined : progress(shift.elapsed - runnerStart, runnerDelay);
  $: hostGreeting = campaign.activeCrew.includes("host") && tickets.some(({ arrivesAt }) => shift.elapsed - arrivesAt < 1.1);
  $: hotTeas = hands.flatMap(({ cup }) => cup ? [cup.tea, ...(cup.accentTea ? [cup.accentTea] : [])] : []);
  $: keepsakes = shopKeepsakes(campaign.regularVisits).map(({ id }) => id);
  $: event = dayEvent(campaign.currentEvent);
  $: last = shift.receipts.at(-1);
  $: commissioned = commission && campaign.commission
    ? Math.min(commission.target, campaign.commission.count + commissionCups(commission, shift))
    : null;
  $: quietTime = Math.max(0, (shift.quietUntil ?? 0) - shift.elapsed);
  $: heldPowerups = POWERUPS.filter(({ id }) => campaign.powerups[id] > 0);
  $: plated = handoff && shift.elapsed < handoff.at + 1.4 ? handoff : null;
  $: visibleReceipt = plated ? shift.receipts.find(({ orderId }) => orderId === plated!.orderId) ?? last : last;
  $: displayCup = station === "serve" && plated ? plated.cup : cup;
  $: finish = station === "serve" && finishCue?.orderId === selected?.id && finishCue && shift.elapsed < finishCue.at + 0.65 ? finishCue.action : null;
  $: sealingNow = finish === "seal" && finishCue && shift.elapsed < finishCue.at + 0.18;
  $: autoSealing = !!selected && canAutoSeal(shift, selected);
  $: pickupGuest = station === "serve" && displayCup?.sealed && !sealingNow && !selected?.catering ? plated?.customerId ?? selected?.customerId : undefined;
  $: chef = positions[stations.indexOf(station)];
  $: carrying = !reduceMotion && shift.elapsed < carryingUntil;
  $: syncChefMotion(chefSprite, paused);
  $: apronPalette = { ...apronInk, A: shopPaint(campaign.paint).apron };
  $: renovated = campaign.branchFittings.includes(campaign.activeBranch);
  $: prepBatches = { pearls: shift.pearls, bun: shift.buns, waffle: shift.waffles };
  $: prepping = Object.values(prepBatches).some(({ cooking }) => cooking);
  $: pickupOrders = tickets.filter((order) => order.cup?.sealed && !order.catering);
  $: finished = tickets.some((order) => order.cup?.sealed);
  $: batchPickup = shift.effects.batchPickup && pickupOrders.length > 1;
  $: if (last?.handedOffBy === "runner" && last.orderId !== animatedRunnerOrder) {
    animatedRunnerOrder = last.orderId;
    const delivered = shift.orders.find(({ id }) => id === last.orderId)?.cup;
    if (delivered) handoff = { cup: delivered, orderId: last.orderId, customerId: last.customerId, quality: last.quality, at: shift.elapsed };
  }
  $: if (worktop && station) worktop.scrollTop = 0;

  export async function goToStation(index: number, focus = false, justPoured = false) {
    const next = stations[index];
    if (!next || (next === "stock" && !stockUnlocked)) return;
    if (station !== next) {
      const carries = (justPoured || !!selected?.cup?.brew.done) &&
        ((station === "brew" && next === "build") || (station === "build" && next === "serve"));
      carryingUntil = carries && !reduceMotion && !paused ? shift.elapsed + 0.48 : 0;
      station = next;
    }
    if (focus) {
      await tick();
      stationHeading?.focus({ preventScroll: true });
    }
  }

  export function activatePrimary() {
    if (paused || station === "stock" || shift.status === "complete") return false;
    const key = worktop?.querySelector<HTMLButtonElement>(".station-controls .is-primary:not(:disabled)");
    if (!key) return false;
    key.click();
    return true;
  }

  export async function toggleCamera() {
    closeView = !closeView;
    onCamera(closeView);
    await tick();
    if (matchMedia("(max-width: 720px) and (orientation: portrait)").matches) {
      worktop?.closest(".shop-content")?.scrollTo({ top: 0 });
    }
  }

  export function moveInDirection(key: string) {
    const direction = arrows[key];
    if (!direction || paused || shift.status === "complete") return false;
    const [x, y] = direction;
    const focused = stationButtons.findIndex((button) => button === document.activeElement);
    const from = positions[focused < 0 ? stations.indexOf(station) : focused];
    let best = Infinity;
    let next = -1;
    for (const [index, place] of positions.entries()) {
      if (stations[index] === "stock" && !stockUnlocked) continue;
      const dx = place.x - from.x;
      const dy = place.y - from.y;
      const forward = dx * x + dy * y;
      if (forward <= 0) continue;
      const distance = Math.hypot(dx, dy);
      const alignment = forward / distance;
      const score = distance / (alignment * alignment);
      if (score >= best) continue;
      best = score;
      next = index;
    }
    if (next < 0) return false;
    void goToStation(next, focused < 0);
    if (focused >= 0) stationButtons[next]?.focus({ preventScroll: true });
    return true;
  }

  function syncChefMotion(element: HTMLDivElement | undefined, stop: boolean) {
    for (const animation of element?.getAnimations?.() ?? []) {
      if (stop) animation.pause();
      else if (animation.playState === "paused") animation.play();
    }
  }

  function label(id: IngredientId) {
    return ingredientLabels[id];
  }

  function chooseTea(id: TeaId) {
    if (!selected?.recipe.accentTea || tea === null) tea = id;
    else if (id === tea) {
      tea = accentTea;
      accentTea = null;
    } else {
      accentTea = accentTea === id ? null : id;
    }
  }

  function progress(elapsed: number, target: number) {
    return target > 0 ? Math.max(0, Math.min(1, elapsed / target)) : 0;
  }

  function choose(order: ServiceOrder) {
    if (rackFull && order.status === "waiting") return;
    handoff = null;
    carryingUntil = 0;
    selectedId = order.id;
    if (order.status === "waiting") {
      if (onApply(takeOrder(shift, order.id), "Ticket clipped to the rail.", "ticket")) station = "brew";
    } else if (order.status === "building") {
      station = order.cup?.sealed ? "serve" : "build";
    } else {
      station = "brew";
    }
  }

  function chooseGuest(order: ServiceOrder, pickupReady: boolean) {
    if (station === "serve" && pickupReady) serve(order);
    else choose(order);
  }

  function useBoost(id: PowerupId) {
    if (onPowerup(id, selected?.id) && id === "assist") void goToStation(2, true);
  }

  function restock(id: IngredientId) {
    deliveryIngredient = id;
    if (station !== "stock") stockReturn = stations.indexOf(station);
    void goToStation(4, true);
  }

  function offerRound() {
    onApply(serveHouseRound(shift), "A round of samples for the room.", "tray");
  }

  function leaveStock() {
    if (stockReturn === null) return;
    const back = stockReturn;
    stockReturn = null;
    void goToStation(back, true);
  }

  function wanted(order: ServiceOrder, id: IngredientId) {
    if (order.recipe.syrup === id) return order.recipe.sugar;
    return order.recipe.toppings.filter((item) => item === id).length + order.recipe.mixins.filter((item) => item === id).length;
  }

  function buildChoices(group: (typeof ingredientGroups)[number], order: ServiceOrder, current: ServiceCup, available: IngredientId[], showAll: boolean) {
    return group.options.filter((id) => available.includes(id) && (showAll || wanted(order, id) || current.ingredients[id]));
  }

  function recipeParts(order: ServiceOrder, currentStation: Station, chosenTeas: (TeaId | null)[], chosenMilk: MilkId | null | undefined): RecipeMark[] {
    const { recipe, cup } = order;
    if (currentStation === "brew") return [
      { kind: recipe.tea, label: label(recipe.tea), done: chosenTeas.includes(recipe.tea) },
      ...(recipe.accentTea ? [{ kind: recipe.accentTea, label: label(recipe.accentTea), done: chosenTeas.includes(recipe.accentTea) }] : []),
      { kind: recipe.milk ?? "plain", label: recipe.milk ? label(recipe.milk) : "Plain tea", done: chosenMilk === recipe.milk },
    ];
    const marks: RecipeMark[] = [];
    if (currentStation !== "prep") marks.push({ kind: "ice", label: iceLevels[recipe.ice] + (recipe.ice ? " ice" : ""), count: recipe.ice, done: cup?.ice === recipe.ice });
    const ingredients = [...new Set([...recipe.toppings, ...recipe.mixins, ...(recipe.sugar ? [recipe.syrup] : [])])];
    for (const id of ingredients) {
      if (currentStation === "prep" && id !== "pearls") continue;
      const amount = wanted(order, id);
      marks.push({ kind: id, label: `${amount} ${label(id)}`, count: amount, done: cup?.ingredients[id] === amount });
    }
    const side = recipeSide(recipe);
    if (side) marks.push({ kind: side, label: side === "bun" ? "One steamed bun" : "One sesame waffle", done: !!cup?.ingredients[side] });
    if (currentStation === "serve" && recipe.foam) marks.push({ kind: "foam", label: "Milk foam cap", done: !!cup?.foamed });
    if (currentStation === "serve" && recipe.float) marks.push({ kind: recipe.float, label: label(recipe.float), done: cup?.float?.flavor === recipe.float });
    if (currentStation === "serve" && recipe.sparkling) marks.push({ kind: "seltzer", label: "One seltzer charge", done: !!cup?.sparkling });
    return marks;
  }

  function startSelected(double = false) {
    if (!selected) return;
    if (selected.status === "waiting") {
      onApply(takeOrder(shift, selected.id), "Ticket clipped to the rail.", "ticket");
      return;
    }
    if (brewReady && tea && milk !== undefined) {
      onApply(startBrew(shift, selected.id, tea, milk, { double, accentTea: accentTea ?? undefined }), "", "heat");
    }
  }

  function useCarafe() {
    if (selected && milk !== undefined && onApply(pourCarafe(shift, selected.id, milk), "Tea poured at Build.", "brew")) {
      void goToStation(1, true, true);
    }
  }

  function askForSwap(order: ServiceOrder) {
    const next = requestIngredientSwap(campaign, shift, order.id);
    if (next === shift || !onApply(next, next.notice, "ticket")) return;
    const updated = next.orders.find(({ id }) => id === order.id);
    if (station === "brew" && updated) milk = updated.recipe.milk;
  }

  async function pull(order: ServiceOrder, moveToBuild = false) {
    if (!onApply(stopBrew(shift, order.id), "Tea is ready at Build.", "brew")) return;
    if (moveToBuild) await goToStation(1, true, true);
  }

  function stock(id: IngredientId, source: Campaign) {
    if (id === "pearls") return shift.pearls.ready;
    if (id === "bun") return shift.buns.ready;
    if (id === "waffle") return shift.waffles.ready;
    return stockCount(source, id);
  }

  function topLabels(current: ServiceCup | null, group: number) {
    return current ? ingredientGroups[group].options.flatMap((id) => Array<string>(current.ingredients[id] ?? 0).fill(id)) : [];
  }

  function handOff(next: ServiceState, order: ServiceOrder | undefined, group = false) {
    if (next === shift || !order?.cup) return;
    const receipt = next.receipts.find(({ orderId }) => orderId === order.id);
    if (!receipt || !onApply(next, group ? next.notice : receipt.message, "serve")) return;
    handoff = { cup: order.cup, orderId: order.id, customerId: order.customerId, quality: receipt.quality, at: shift.elapsed };
    void tick().then(() => stationHeading?.focus({ preventScroll: true }));
  }

  function serve(order: ServiceOrder) {
    const next = serveOrder(shift, order.id);
    if (order.catering) {
      if (next !== shift && onApply(next, next.notice, "serve")) void tick().then(() => stationHeading?.focus({ preventScroll: true }));
    } else {
      handOff(next, order);
    }
  }

  function serveAll() {
    const front = selected?.cup?.sealed && !selected.catering ? selected : pickupOrders[0];
    handOff(servePickupCounter(shift), front, true);
  }

  function serveTable() {
    const front = tableOrders.find(({ id }) => id === selected?.id) ?? tableOrders[0];
    handOff(serveReservationTable(shift), front, true);
  }

  function operatePrep(id: PrepId) {
    const batch = prepBatches[id];
    if (batch.cooking) onApply(collectBatch(shift, id), prepNames[id] + " ready.", "brew");
    else onApply(startBatch(shift, id), "", id === "waffle" ? "sizzle" : "heat");
  }

  function openDoors() {
    const next = openServiceDoors(shift);
    if (next !== shift && onApply(next, next.notice, "ticket")) void goToStation(0, true);
  }

  function plateSide(order: ServiceOrder, side: "bun" | "waffle") {
    if (!prepBatches[side].ready) {
      void goToStation(3, true);
      return;
    }
    onApply(addIngredient(shift, order.id, side), sides[side] + " plated.", "portion");
  }

  function prepAvailable(id: PrepId, batch: PrepBatch, source: Campaign) {
    return batch.cooking ? batch.elapsed >= batch.target * 0.65 : batch.ready === 0 && stockCount(source, id) >= PREP_YIELDS[id];
  }

  function wantsFoam(order: ServiceOrder, current: ServiceCup) {
    return current.shaken && !current.sealed && !!order.recipe.foam && !current.foamed;
  }

  function wantsSparkle(order: ServiceOrder, current: ServiceCup) {
    return !!order.recipe.sparkling && current.shaken && !current.sealed && current.milk === null && !current.sparkling;
  }

  function wantedScoop(order: ServiceOrder, current: ServiceCup) {
    const flavor = order.recipe.float;
    return current.shaken && !current.sealed && current.float?.flavor !== flavor ? flavor : undefined;
  }

  function addScoop(order: ServiceOrder, flavor: FloatFlavor) {
    onApply(scoopFloat(shift, order.id, flavor), "Ice cream scooped.", "ice");
  }

  function operatePass(order: ServiceOrder, current: ServiceCup, skipFinish = false) {
    if (current.sealed) {
      serve(order);
      return;
    }
    if (!skipFinish && wantsSparkle(order, current)) {
      onApply(chargeSparkle(shift, order.id), "Tea charged with seltzer.", "sizzle");
      return;
    }
    const scoop = !skipFinish ? wantedScoop(order, current) : undefined;
    if (scoop) {
      addScoop(order, scoop);
      return;
    }
    const action = !current.shaken ? "shake" : !skipFinish && wantsFoam(order, current) ? "foam" : "seal";
    const next = action === "shake" ? shakeDrink(shift, order.id) : action === "foam" ? foamDrink(shift, order.id) : sealDrink(shift, order.id);
    if (onApply(next, action === "shake" ? "Cup shaken." : action === "foam" ? "Foam ready." : "Cup sealed.", action === "foam" ? "sizzle" : action)) {
      finishCue = { action, orderId: order.id, at: shift.elapsed };
    }
  }
</script>

{#snippet fixture(title: string, x: number, y: number, w: number, h: number, action: () => void, lit = false, requested = false)}
  <button type="button" class="fixture" class:is-lit={lit} class:is-requested={requested && !lit} aria-label={title} {title}
    style:left={x / 9 + "%"} style:top={y / 3.44 + "%"} style:width={w / 9 + "%"} style:height={h / 3.44 + "%"}
    on:click={action}>
    <span aria-hidden="true"></span>
  </button>
{/snippet}

<div class="counter-layout">
  <OrderTicketRail {shift} {tickets} selectedId={selected?.id} {activeTickets} {rackFull} {quietTime} {takeout}
    onOpenDoors={openDoors} onChoose={choose} />

  <div class="kitchen-board" class:close-view={closeView}>
    <div class="kitchen-frame">
      <div class="kitchen-view" role="group" aria-label="Tea shop kitchen">
        <OrderKitchenScene {station} {paused} {hotTeas} {stockUnlocked} {expressStatus} {expressProgress}
          upgrades={campaign.upgrades} working={hands.length > 0} ready={finished}
          crew={campaign.activeCrew} certifiedCrew={campaign.certifiedCrew} {runnerProgress} {hostGreeting} {keepsakes} awards={neighborhoodAwardCount(campaign.highestReputation)}
          expansion={campaign.activeBranch} {renovated} {preOpening} prepping={prepping} paint={campaign.paint}
          pearlCooking={shift.pearls.cooking} bunCooking={shift.buns.cooking}
          waffleCooking={shift.waffles.cooking} waffleAvailable={unlocked.includes("waffle")}
          carafeFull={!!carafeTea}
          reservationActive={!!shift.reservation}
          weather={event.id} daylight={shift.elapsed / shift.duration} />
        <div class="chef" bind:this={chefSprite} aria-hidden="true" style:left={chef.feetX / 9 + "%"} style:top={chef.feetY / 5.35 + "%"}>
          <span class="chef-shadow"></span>
          <PixelIcon grid={apron} palette={apronPalette} px={3} />
          {#if carrying}
            <span class="chef-cup"><PixelIcon grid={TAKEAWAY.grid} palette={carryInk} px={3} /></span>
          {/if}
        </div>
        {#each positions as place, index}
          {@const id = stations[index]}
          {#if id !== "stock" || stockUnlocked}
          {@const active = station === id}
          {@const busy = (id === "brew" && hands.length > 0) || (id === "serve" && finished) || (id === "prep" && prepping) || (id === "stock" && expressStatus !== "idle")}
          <button
            type="button"
            class="kitchen-hotspot"
            class:is-here={active}
            bind:this={stationButtons[index]}
            aria-label={place.name + " station"}
            aria-controls="order-worktop"
            aria-pressed={active}
            aria-keyshortcuts={String(index + 1)}
            data-station={id}
            style:left={place.x / 9 + "%"}
            style:top={place.y / 5.35 + "%"}
            style:width={place.w / 9 + "%"}
            style:height={place.h / 5.35 + "%"}
            on:click={() => goToStation(index)}
          >
            <span class="station-sign" aria-hidden="true">
              <OrderPixelWord text={place.name} cells={1} />
              {#if busy}<span class="working-dot"></span>{/if}
              <kbd>{index + 1}</kbd>
            </span>
          </button>
          {/if}
        {/each}
        {#if station === "serve" && tableOrders.length > 1}
          <button type="button" class="kitchen-hotspot table-hotspot is-here" aria-label="Serve guests at their table" on:click={serveTable}>
            <span class="station-sign" aria-hidden="true"><OrderPixelWord text="Table" cells={1} /></span>
          </button>
        {/if}
        {#if !preOpening}
          <OrderCustomerFloor {shift} {selected} {paused} canHandoff={station === "serve"} canTake={!rackFull} onChoose={chooseGuest} />
        {/if}
      </div>
    </div>

    <section class="workbench boba-chip" id="order-worktop" aria-labelledby="order-worktop-heading" bind:this={worktop}>
      <header class="counter-plaque">
        <h2 id="order-worktop-heading" tabindex="-1" data-arcade-tab-anchor bind:this={stationHeading}>
          <OrderKitchenItem kind={station} size={24} />
          <span class="sr-only">{benchNames[station]}</span>
          <OrderPixelWord text={benchNames[station]} cells={1} />
        </h2>
        <button type="button" class="boba-key camera-key" aria-label="Counter close-up view" aria-pressed={closeView} aria-keyshortcuts="V"
          on:click={toggleCamera}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">
            <path d="M0 0h5v2H2v3H0zm11 0h5v5h-2V2h-3zM0 11h2v3h3v2H0zm14 0h2v5h-5v-2h3zM6 6h4v4H6z" />
          </svg>
          <span>{closeView ? "Room" : "Close-up"}</span>
        </button>
      </header>
    <div class="station-body">
      <div class="station-visual">
        <div class="bench-paint">
        {#if pickupGuest && displayCup}
          {#key pickupGuest}
            <OrderPickupView customerId={pickupGuest} cup={displayCup} serving={!!plated} quality={plated?.quality}
              active={!paused} branch={campaign.activeBranch} {renovated} paint={campaign.paint} cupPrint={campaign.cupPrint}
              weather={event.id} daylight={shift.elapsed / shift.duration} />
          {/key}
        {:else}
        <OrderStationArt
          {station}
          showCup={station === "brew" || displayCup?.brew.done === true}
          {stockUnlocked} {expressStatus} {expressProgress}
          {carafeFilling} {carafeProgress} {carafeTea}
          tea={displayCup?.tea ?? (selected ? tea : null)}
          accentTea={displayCup?.accentTea ?? (selected ? accentTea : null)}
          milk={displayCup?.milk ?? null}
          milkSelection={station === "brew" && selected?.status === "accepted" ? milk : undefined}
          milkUnlocked={unlocked}
          ingredientUnlocked={unlocked}
          upgrades={campaign.upgrades}
          mixins={[...topLabels(displayCup, 1), ...topLabels(displayCup, 2)]}
          takeoutPacked={trayCups}
          cupPrint={campaign.cupPrint}
          toppings={topLabels(displayCup, 0)}
          progress={brew ? progress(brew.elapsed, brew.target) : Math.max(progress(shift.pearls.elapsed, shift.pearls.target), progress(shift.buns.elapsed, shift.buns.target))}
          active={!paused}
          serving={!!plated && station === "serve"}
          {finish}
          {autoSealing}
          foamAvailable={station === "serve" && shift.day >= 10}
          floatAvailable={station === "serve" && !!selected?.recipe.float}
          seltzerAvailable={station === "serve" && !!selected?.recipe.sparkling}
          sparkling={displayCup?.sparkling ?? false}
          scoop={displayCup?.float?.flavor ?? null}
          foamed={displayCup?.foamed ?? false}
          weather={event.id}
          branch={campaign.activeBranch}
          {renovated}
          daylight={shift.elapsed / shift.duration}
          bun={station === "brew" ? !!shift.buns.ready : !!displayCup?.ingredients.bun}
          waffle={!!displayCup?.ingredients.waffle}
          orderedSide={selected ? recipeSide(selected.recipe) : null}
          ice={displayCup?.ice}
          sealed={displayCup?.sealed ?? false}
          pearlProgress={progress(shift.pearls.elapsed, shift.pearls.target)}
          bunProgress={progress(shift.buns.elapsed, shift.buns.target)}
          pearlCooking={shift.pearls.cooking} bunCooking={shift.buns.cooking}
          pearlReady={shift.pearls.ready} bunReady={shift.buns.ready} bunAvailable={unlocked.includes("bun")}
          waffleProgress={progress(shift.waffles.elapsed, shift.waffles.target)}
          waffleCooking={shift.waffles.cooking} waffleReady={shift.waffles.ready} waffleAvailable={unlocked.includes("waffle")}
        />
        {/if}
        {#if station === "brew"}
          {#if selected?.status === "accepted" && !campaign.upgrades.includes("auto-tea")}
            {#each teas as id, index}
              {#if unlocked.includes(id)}
                {@render fixture("Stove kettle for " + label(id), 112 + index * 112, 170, 106, 114, () => chooseTea(id), tea === id || accentTea === id,
                  (selected.recipe.tea === id || selected.recipe.accentTea === id) && stockCount(campaign, id) > 0)}
              {/if}
            {/each}
          {/if}
          {#if selected?.status === "accepted" && !campaign.upgrades.includes("auto-milk")}
            {#each dairyFixtures as id, index}
              {#if id === null || unlocked.includes(id)}
                {@render fixture(id === null ? "Plain pitcher" : label(id) + " pitcher", 620 + index * 88, 172, 80, 134,
                  () => milk = id, milk === id, selected.recipe.milk === id && (id === null || stockCount(campaign, id) > 0))}
              {/if}
            {/each}
          {/if}
          {#if selected?.status === "accepted" && brewReady}
            {@render fixture("Start brew at the cup", 471, 231, 132, 126, () => startSelected(), true)}
          {/if}
          {#if canPour}
            {@render fixture("Pour from the carafe", 552, 146, 66, 102, useCarafe, true)}
          {:else if canDouble}
            {@render fixture("Brew two at the carafe", 552, 146, 66, 102, () => startSelected(true), false)}
          {/if}
          {#if selected?.status === "brewing" && brew && brew.elapsed >= brew.target}
            {@const order = selected}
            {@render fixture("Pull tea from the worktop", 471, 231, 132, 126, () => pull(order, true), true)}
          {/if}
        {:else if station === "stock" && !dispatchBlock && expressStatus !== "arrived"}
          {@render fixture("Ring the market bell", 521, 171, 272, 178, () => onExpress(deliveryIngredient), true)}
        {:else if station === "prep"}
          {#if prepAvailable("pearls", shift.pearls, campaign)}
            {@render fixture(shift.pearls.cooking ? "Lift pearls from the pot" : "Start the pearl pot", 245, 187, 232, 150,
              () => operatePrep("pearls"), shift.pearls.cooking)}
          {/if}
          {#if unlocked.includes("bun") && prepAvailable("bun", shift.buns, campaign)}
            {@render fixture(shift.buns.cooking ? "Lift buns from the steamer" : "Start bun steamer", 648, 183, 238, 165,
              () => operatePrep("bun"), shift.buns.cooking)}
          {/if}
          {#if unlocked.includes("waffle") && prepAvailable("waffle", shift.waffles, campaign)}
            {@render fixture(shift.waffles.cooking ? "Lift waffles from the press" : "Close the waffle press", 451, 199, 148, 120,
              () => operatePrep("waffle"), shift.waffles.cooking)}
          {/if}
        {:else if station === "build" && selected?.status === "building" && cup && !cup.sealed}
          {@const order = selected}
          {@const side = recipeSide(order.recipe)}
          {@const ready = cup.ice === order.recipe.ice && (!side || !!cup.ingredients[side]) &&
            benchStock.every(({ id }) => (cup?.ingredients[id] ?? 0) === wanted(order, id))}
          {@render fixture("Carry cup from the worktop", 459, 253, 113, 80, () => goToStation(2, true), ready)}
          {@render fixture("Set ice at the hopper", 846, 162, 54, 142, () => onApply(setIce(shift, order.id, order.recipe.ice), "", "ice"), cup.ice === order.recipe.ice)}
          {#if side && !cup.ingredients[side]}
            {@render fixture(prepBatches[side].ready ? "Plate " + side + " on the worktop" : "Go to Prep for " + side,
              665, 276, 142, 58, () => plateSide(order, side), !!prepBatches[side].ready)}
          {/if}
          {#each benchStock as item (item.id)}
            {@const target = wanted(order, item.id)}
            {@const added = cup.ingredients[item.id] ?? 0}
            {#if unlocked.includes(item.id) && stock(item.id, campaign) > 0}
              {@const moved = expandedPumpRack && item.movedX !== undefined}
              {@render fixture(label(item.id) + " on the worktop", moved ? item.movedX! : item.x, item.y, moved ? 72 : item.w, item.h,
                () => onApply(addIngredient(shift, order.id, item.id), "", "portion"), target > 0 && added >= target, added < target)}
            {/if}
          {/each}
        {:else if station === "serve" && selected?.status === "building" && cup && !plated}
          {@const order = selected}
          {@const current = cup}
          {#if order.recipe.float && current.shaken && !current.sealed}
            {#each FLOAT_FLAVORS as flavor, i}
              {#if stockCount(campaign, flavor) > 0 && current.float?.flavor !== flavor}
                {@render fixture("Scoop " + label(flavor).toLowerCase() + " at the freezer", 679 + i * 103, 182, 96, 122,
                  () => addScoop(order, flavor), order.recipe.float === flavor)}
              {/if}
            {/each}
          {/if}
          {#if wantsSparkle(order, current)}
            {#if stockCount(campaign, "seltzer") > 0}
              {@render fixture("Charge tea at the seltzer tap", 746, 184, 182, 126, () => operatePass(order, current), true)}
            {/if}
          {:else if wantsFoam(order, current)}
            {#if stockCount(campaign, foamMilkFor(order.recipe)) > 0}
              {@render fixture("Froth milk at the pitcher", 746, 185, 130, 128, () => operatePass(order, current), true)}
            {/if}
          {:else if order.catering && cup.sealed}
            {@render fixture("Pack cup into takeout tray", 122, 235, 153, 122, () => operatePass(order, current), true)}
          {:else if pickupGuest}
            {@render fixture("Hand cup over the pass", 501, 190, 215, 278, () => operatePass(order, current), true)}
          {:else if !wantedScoop(order, current)}
            {@render fixture(!cup.shaken ? "Shake cup on tray" : !cup.sealed ? "Use the sealer" : "Hand cup over the pass",
              450, 196, 202, 206, () => operatePass(order, current), cup.sealed)}
          {/if}
        {/if}
        </div>

        {#if selected && station !== "stock" && !(station === "serve" && (plated || pickupGuest))}
          {@const order = selected}
          {#key order.id}
            <OrderSelectedTicket {order} parts={recipeParts(order, station, [tea, accentTea], milk)}
              fullRecipe={() => [...recipeParts(order, "brew", [tea, accentTea], milk), ...recipeParts(order, "serve", [], undefined)]} />
          {/key}
        {/if}
      </div>

      <div class="station-controls">
        {#if replacement && selected}
          {@const order = selected}
          <div class="swap-offer" role="group" aria-label="Ingredient swap">
            <span title={label(replacement.from) + " is short"}>
              <OrderKitchenItem kind={replacement.from} size={20} />
              <span aria-hidden="true">→</span>
              <OrderKitchenItem kind={replacement.to} size={20} />
            </span>
            <small>−{SWAP_TIP_COST}¢ tip</small>
            <button type="button" class="boba-key order-pixel-paper-key" on:click={() => askForSwap(order)}>
              Offer {label(replacement.to).toLowerCase()}
            </button>
          </div>
        {/if}
        {#if station === "brew"}
          {#if selected?.status === "accepted"}
            <div class="brew-choices">
              <div class="choice-rack" role="group" aria-label="Tea choices">
                <span>{selected.recipe.accentTea ? "Two teas" : "Tea"}</span>
                {#each teas.filter((id) => unlocked.includes(id)) as id}
                  <button type="button" class="ingredient boba-key" class:requested-choice={selected.recipe.tea === id || selected.recipe.accentTea === id}
                    aria-pressed={tea === id || accentTea === id} disabled={campaign.upgrades.includes("auto-tea")} on:click={() => chooseTea(id)}>
                    <OrderKitchenItem kind={id} size={28} lit={tea === id || accentTea === id} />
                    <span>{label(id)}</span>
                  </button>
                {/each}
              </div>
              <div class="choice-rack" role="group" aria-label="Milk choices">
                <span>Milk</span>
                <button type="button" class="ingredient boba-key" class:requested-choice={selected.recipe.milk === null}
                  aria-pressed={milk === null} disabled={campaign.upgrades.includes("auto-milk")} on:click={() => milk = null}>
                  <OrderKitchenItem kind="plain" size={28} lit={milk === null} />
                  <span>Plain</span>
                </button>
                {#each milks.filter((id) => unlocked.includes(id)) as id}
                  <button type="button" class="ingredient boba-key" class:requested-choice={selected.recipe.milk === id}
                    aria-pressed={milk === id} disabled={campaign.upgrades.includes("auto-milk")} on:click={() => milk = id}>
                    <OrderKitchenItem kind={id} size={28} lit={milk === id} />
                    <span>{label(id)}</span>
                  </button>
                {/each}
              </div>
            </div>
            <div class="action-row">
              {#if canPour}
                <button type="button" class="boba-key is-primary main-button" on:click={useCarafe}>
                  <OrderKitchenItem kind="carafe" size={24} />Pour from carafe
                </button>
              {/if}
              <button type="button" class="boba-key main-button" class:is-primary={!canPour} disabled={!brewReady} on:click={() => startSelected()}>
                <OrderKitchenItem kind="brew" size={24} />Start brew
              </button>
              {#if canDouble}
                <button type="button" class="boba-key" on:click={() => startSelected(true)}>
                  <OrderKitchenItem kind="carafe" size={24} />Brew two
                </button>
              {/if}
            </div>
            {#if stockUnlocked && brewShortage}
              <button type="button" class="boba-key main-button" on:click={() => restock(brewShortage!)}>
                <OrderKitchenItem kind="stock" size={22} /> Restock {label(brewShortage)}
              </button>
            {/if}
          {:else if selected?.status === "waiting"}
            <div class="station-prompt">
              <button type="button" class="boba-key is-primary main-button" on:click={() => startSelected()}>
                <OrderKitchenItem kind="clip" size={24} />Take ticket
              </button>
            </div>
          {:else if selected?.status === "brewing" && brew}
            {@const late = isOverTarget(brew.elapsed, brew.target, shift.expert)}
            <div class="brewing" aria-label="Selected tea timer">
              <div class="meter-label"><strong>{label(selected.cup!.tea)}</strong><span class:late>{late ? "Oversteeping" : brew.elapsed >= brew.target ? "Pull now" : Math.ceil(brew.target - brew.elapsed) + "s"}</span></div>
              <div class="prep-meter" class:late><progress max="1" value={progress(brew.elapsed, brew.target * 1.5)} aria-label="Tea steeping"></progress><i aria-hidden="true"></i></div>
              <button type="button" class="boba-key is-primary main-button" disabled={brew.elapsed < brew.target} on:click={() => selected && pull(selected, true)}>
                <OrderKitchenItem kind="collect" size={24} />Pull tea
              </button>
            </div>
          {:else if selected?.status === "building"}
            <button type="button" class="boba-key is-primary main-button" on:click={() => goToStation(1, true)}>
              <OrderKitchenItem kind="cup" size={24} />Carry to island
            </button>
          {/if}

          {#if carafeTea || carafeFilling}
            <div class="freshness-meter">
              <OrderKitchenItem kind="carafe" size={21} lit={!!carafeTea} />
              <span>{carafeTea ? label(carafeTea) + " in carafe" : "Filling carafe"}</span>
              {#if carafeTea}<progress max="1" value={carafeProgress} aria-label="Carafe freshness"></progress>{/if}
            </div>
          {/if}

          {#if otherHands.length}
            <div class="other-brews" role="group" aria-label="Other kettles">
              {#each otherHands as other (other.id)}
                {@const batch = other.cup?.brew}
                {#if batch}
                  {@const ready = batch.elapsed >= batch.target}
                  <button type="button" class="boba-key extra-kettle" disabled={!ready}
                    aria-label={ready ? "Pull tea for " + other.customerName : other.customerName + "’s tea is steeping"} on:click={() => pull(other)}>
                    <OrderKitchenItem kind={other.cup?.tea ?? "brew"} size={23} lit={ready} />{other.customerName}
                    <span>{ready ? "↑" : Math.ceil(batch.target - batch.elapsed) + "s"}</span>
                  </button>
                {/if}
              {/each}
            </div>
          {/if}

        {:else if station === "stock"}
          {#if managedKitchen && dispatchMenu}
            <aside class="dispatch-slip" aria-label="Branch pantry forecast">
              <OrderKitchenItem kind={dispatchMenu.icon} size={27} lit={dispatchStock > 0} />
              <div><strong>{managedKitchen.name}</strong><small>{dispatchMenu.name}</small></div>
              <span title="Cups the shared pantry can cover">{dispatchStock}/{dispatchMax} stocked</span>
            </aside>
          {/if}
          {#if pending}
            <div class="delivery-readout" aria-label="Express delivery on its way">
              <OrderKitchenItem kind={pending.ingredient} size={31} />
              <span>{label(pending.ingredient)} ×{pending.quantity}</span>
              <strong>{Math.max(0, Math.ceil(pending.arrivesAt - shift.elapsed))}s</strong>
              <progress max="1" value={Math.max(0, expressProgress)} aria-label="Courier progress"></progress>
            </div>
          {:else}
            <div class="stock-keys" role="group" aria-label="Choose express ingredient">
              {#each unlocked as id (id)}
                {@const quantity = stockCount(campaign, id)}
                <button type="button" class="boba-key stock-bin" aria-pressed={id === deliveryIngredient}
                  aria-label={"Order " + label(id) + ", " + (Number.isFinite(quantity) ? quantity + " in stock" : "in stock")}
                  title={label(id)} on:click={() => deliveryIngredient = id}>
                  <OrderKitchenItem kind={id} size={27} /><span>{Number.isFinite(quantity) ? quantity : "∞"}</span>
                </button>
              {/each}
            </div>
            <div class="stock-order">
              <button type="button" class="boba-key is-primary" disabled={!!dispatchBlock} on:click={() => onExpress(deliveryIngredient)}>
                <OrderKitchenItem kind="stock" size={24} /> Call market for {money(deliveryQuote.cost)}
              </button>
              <span>{dispatchBlock || `${label(deliveryIngredient)} ×${deliveryQuote.quantity} in ${deliveryQuote.seconds}s`}</span>
            </div>
          {/if}
          {#if stockReturn !== null}
            <button type="button" class="boba-key main-button" on:click={leaveStock}>
              <OrderKitchenItem kind={stations[stockReturn]} size={20} /> Back to {positions[stockReturn].name}
            </button>
          {/if}
        {:else if station === "prep"}
          <div class="prep-rack">
            {#each ["pearls", "bun", "waffle"] as item (item)}
              {@const id = item as PrepId}
              {@const batch = prepBatches[id]}
              {#if unlocked.includes(id)}
                {@const canWork = prepAvailable(id, batch, campaign)}
                {@const freshness = prepFreshness(shift, id)}
                {@const short = !batch.cooking && batch.ready === 0 && stockCount(campaign, id) < PREP_YIELDS[id]}
                <div class="prep" class:cooling={batch.ready > 0 && freshness < 92}>
                  <div class="meter-label">
                    <strong>{prepNames[id]}</strong>
                    {#if batch.cooking}
                      <span>{isOverTarget(batch.elapsed, batch.target, shift.expert, true) ? "Overdone" : batch.elapsed >= batch.target ? "Lift now" : Math.ceil(batch.target - batch.elapsed) + "s"}</span>
                    {:else}
                      {#if short || batch.ready}<span>{short ? "Low stock" : batch.ready + (freshness < 92 ? " cooling" : " ready")}</span>{/if}
                    {/if}
                  </div>
                  {#if batch.cooking}
                    <div class="prep-meter">
                      <progress max="1" value={progress(batch.elapsed, batch.target * 1.5)} aria-label={prepNames[id] + " cooking"}></progress>
                      <i aria-hidden="true"></i>
                    </div>
                  {:else if batch.ready}
                    <progress max="100" value={freshness} aria-label={prepNames[id] + " freshness, " + freshness + "%"}></progress>
                  {/if}
                  {#if batch.ready}
                    {#if freshness < 92}<button type="button" class="boba-key discard" on:click={() => onApply(discardPrepBatch(shift, id))}>
                      <OrderKitchenItem kind="remake" size={19} />Discard batch
                    </button>{/if}
                  {:else if short && stockUnlocked}
                    <button type="button" class="boba-key" on:click={() => restock(id)}>
                      <OrderKitchenItem kind="stock" size={22} />Restock {prepNames[id].toLowerCase()}
                    </button>
                  {:else}
                    <button type="button" class="boba-key" disabled={!canWork}
                      on:click={() => operatePrep(id)}>
                      <OrderKitchenItem kind={batch.cooking ? "collect" : prepIcons[id]} size={24} />
                      {batch.cooking ? "Collect " + prepNames[id].toLowerCase() : prepLabels[id]}
                    </button>
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
          {#if selected?.status === "building" && !selected.cup?.sealed}
            <button type="button" class="boba-key is-primary main-button" on:click={() => goToStation(1, true)}>
              <OrderKitchenItem kind="build" size={24} />Back to island
            </button>
          {/if}
        {:else if station === "build"}
          {#if selected?.status === "building" && cup}
            {@const side = recipeSide(selected.recipe)}
            {@const needsToppings = selected.recipe.toppings.some((id) => (cup.ingredients[id] ?? 0) < wanted(selected!, id) && stock(id, campaign) > 0)}
            {@const needsExtras = cup.ice !== selected.recipe.ice || (!!side && !cup.ingredients[side] && prepBatches[side].ready > 0) ||
              [...selected.recipe.mixins, selected.recipe.syrup].some((id) => (cup.ingredients[id] ?? 0) < wanted(selected!, id) && stock(id, campaign) > 0)}
            <div class="build-racks">
              {#each ingredientGroups as group}
                {@const choices = buildChoices(group, selected, cup, unlocked, browseIngredients)}
                {#if choices.length}
                  <div class="choice-rack" role="group" aria-label={group.label}>
                    <span>{group.label}</span>
                    {#each choices as id}
                      {@const count = cup.ingredients[id] ?? 0}
                      {@const target = wanted(selected, id)}
                      {@const available = stock(id, campaign)}
                      {@const needsPrep = id === "pearls" && target > count && available === 0}
                      {@const needsOrder = stockUnlocked && !needsPrep && target > count && available === 0}
                      <span class="ingredient-pair" class:requested={target > 0} class:portioned={target > 0 && count === target} class:overfilled={count > target}>
                        <button type="button" class="ingredient boba-key" disabled={cup.sealed || (available === 0 && !needsPrep && !needsOrder)}
                          aria-label={needsPrep ? "Go to Prep for pearls" : needsOrder ? "Restock " + label(id) : "Add " + label(id) + (target ? ", " + count + " of " + target : "")}
                          title={needsPrep ? "Go to Prep" : available === 0 ? "Out of stock" : ""}
                          on:click={() => needsPrep ? goToStation(3, true) : needsOrder ? restock(id) : selected && onApply(addIngredient(shift, selected.id, id), "", "portion")}>
                          <OrderKitchenItem kind={needsOrder ? "stock" : id} size={27} lit={count > 0} />
                          <span>{needsPrep ? "Cook pearls" : needsOrder ? "Restock" : label(id)} {target || count ? count + "/" + target : ""}</span>
                        </button>
                        {#if count && !cup.sealed}
                          <button type="button" class="remove boba-key" aria-label={"Remove " + label(id)}
                            on:click={() => selected && onApply(removeIngredient(shift, selected.id, id))}>−</button>
                        {/if}
                      </span>
                    {/each}
                  </div>
                {/if}
              {/each}
              <div class="choice-rack" role="group" aria-label="Ice">
                <span class="ice-bin"><OrderKitchenItem kind="ice" size={20} /> Ice</span>
                {#each iceLevels as text, index}
                  <button type="button" class="ingredient boba-key" class:requested-choice={selected.recipe.ice === index}
                    disabled={cup.sealed} aria-pressed={cup.ice === index}
                    on:click={() => selected && onApply(setIce(shift, selected.id, index as Level), "", "ice")}>{text}</button>
                {/each}
              </div>
            </div>
            <div class="action-row">
              {#if side && !cup.sealed}
                <button type="button" class="boba-key" disabled={!!cup.ingredients[side]}
                  on:click={() => selected && plateSide(selected, side)}>
                  <OrderKitchenItem kind={side} size={23} />
                  {cup.ingredients[side] ? sides[side] + " plated" : prepBatches[side].ready ? "Plate " + side : side === "bun" ? "Steam a bun" : "Toast a waffle"}
                </button>
              {/if}
              {#if !cup.sealed && needsToppings && campaign.upgrades.includes("auto-toppings")}
                <button type="button" class="boba-key" on:click={() => selected && onApply(applyServiceToppings(shift, selected.id))}>Auto-fill toppings</button>
              {/if}
              {#if !cup.sealed && needsExtras && campaign.upgrades.includes("auto-extras")}
                <button type="button" class="boba-key" on:click={() => selected && onApply(applyServiceExtras(shift, selected.id))}>Auto-fill extras</button>
              {/if}
              <button type="button" class="boba-key is-primary" on:click={() => goToStation(2, true)}>
                <OrderKitchenItem kind="serve" size={24} />Carry to pass
              </button>
              {#if !cup.sealed && (browseIngredients || ingredientGroups.some((group) => group.options.some((id) => unlocked.includes(id) && !wanted(selected!, id) && !cup?.ingredients[id])))}
                <button type="button" class="text-control boba-key" aria-pressed={browseIngredients} on:click={() => browseIngredients = !browseIngredients}>{browseIngredients ? "Only ticket ingredients" : "All ingredients"}</button>
              {/if}
              {#if !cup.sealed}
                <button type="button" class="text-control boba-key" on:click={() => {
                  if (selected && onApply(remakeOrder(shift, selected.id), "A fresh cup is waiting at Brew.")) void goToStation(0, true);
                }}><OrderKitchenItem kind="remake" size={17} />Remake cup</button>
              {/if}
            </div>
          {:else}
            <div class="station-prompt">
              <strong>The build bench needs a brewed cup.</strong>
              <button type="button" class="boba-key is-primary" on:click={() => goToStation(0, true)}>
                <OrderKitchenItem kind="brew" size={24} />Walk to stove
              </button>
            </div>
          {/if}
        {:else}
          {#if selected?.status === "building" && cup && !plated}
            {@const order = selected}
            {@const current = cup}
            {@const side = recipeSide(order.recipe)}
            {@const foamNext = wantsFoam(order, current)}
            {@const fizzNext = wantsSparkle(order, current)}
            {@const scoopNext = wantedScoop(order, current)}
            {@const foamMilk = foamMilkFor(order.recipe)}
            {@const finishIngredient = foamNext ? foamMilk : fizzNext ? "seltzer" : scoopNext}
            {@const short = finishIngredient && stockCount(campaign, finishIngredient) <= 0 ? finishIngredient : undefined}
            <div class="handoff">
              {#if autoSealing && current.finishTouchedAt !== undefined}
                <div class="runner-meter"><OrderKitchenItem kind="seal" size={20} /><progress max={AUTO_SEAL_SECONDS}
                  value={Math.max(0, Math.min(AUTO_SEAL_SECONDS, shift.elapsed - current.finishTouchedAt))} aria-label="Automatic sealer"></progress></div>
              {/if}
              {#if runnerProgress !== undefined && runnerQueue.some(({ id }) => id === order.id)}
                <div class="runner-meter"><OrderKitchenItem kind="serve" size={20} /><progress max={1}
                  value={runnerProgress} aria-label="Runner pickup"></progress></div>
              {/if}
              {#if side && !current.ingredients[side] && !current.sealed}
                <button type="button" class="boba-key text-control" on:click={() => goToStation(1, true)}>
                  <OrderKitchenItem kind={side} size={21} /> Plate {side} at Build
                </button>
              {/if}
              {#if current.float}
                <div class="freshness-meter"><OrderKitchenItem kind={current.float.flavor} size={21} />
                  <progress max="100" value={scoopFreshness(shift, current)} aria-label="Ice cream freshness"></progress>
                </div>
              {/if}
              <div class="action-row">
                {#if short}
                  <button type="button" class="boba-key is-primary" on:click={() => restock(short)}><OrderKitchenItem kind="stock" size={23} /> Restock {label(short)}</button>
                {:else}
                  <button type="button" class="boba-key is-primary" on:click={() => operatePass(order, current)}>
                    <OrderKitchenItem kind={!current.shaken ? "shake" : foamNext ? "foam" : fizzNext ? "seltzer" : scoopNext ?? (!current.sealed ? "seal" : "bell")} size={23} />
                    {!current.shaken ? "Shake cup" : foamNext ? "Froth milk" : fizzNext ? "Charge with seltzer" : scoopNext ? "Scoop " + label(scoopNext).toLowerCase() : !current.sealed ? "Seal cup" : order.catering ? "Pack cup" : "Serve order"}
                  </button>
                {/if}
                {#if foamNext}<button type="button" class="boba-key text-control" on:click={() => operatePass(order, current, true)}>Seal without foam</button>{/if}
                {#if fizzNext}<button type="button" class="boba-key text-control" on:click={() => operatePass(order, current, true)}>Seal without fizz</button>{/if}
                {#if scoopNext}<button type="button" class="boba-key text-control" on:click={() => operatePass(order, current, true)}>
                  {current.float ? "Seal as made" : "Seal without scoop"}
                </button>{/if}
                {#if current.sealed && order.reservation && tableOrders.length > 1}
                  <button type="button" class="boba-key" on:click={serveTable}>
                    <OrderKitchenItem kind="cozy-seats" size={23} />Serve the table
                  </button>
                {:else if current.sealed && batchPickup}
                  <button type="button" class="boba-key" on:click={serveAll}>
                    <OrderKitchenItem kind="serve" size={23} />Hand out {pickupOrders.length} cups
                  </button>
                {/if}
              </div>
            </div>
          {:else}
            <div class="station-prompt">
              {#if selected}
                {@const next = selected}
                <button type="button" class="boba-key is-primary" on:click={() => choose(next)}>
                  <OrderKitchenItem kind={next.status === "waiting" ? "clip" : "brew"} size={24} />
                  {next.status === "waiting" ? "Take " + next.customerName + "’s ticket"
                    : next.cup?.sealed ? "Pick up " + next.customerName + "’s cup"
                    : "Back to " + next.customerName + "’s tea"}
                </button>
              {:else if !last}
                <strong>Finished cups come to this window.</strong>
              {/if}
            </div>
          {/if}
          {#if visibleReceipt}
            <div class="serve-receipt">
              <div><strong>{visibleReceipt.customerName}</strong><span>{visibleReceipt.recipeName}</span></div>
              <div><strong>{visibleReceipt.quality}%</strong>{#if !training}<span>{money(visibleReceipt.revenue)} + {money(visibleReceipt.tips)} tip</span>{/if}</div>
              {#if visibleReceipt.specialBonus}
                <p class="request-paid"><OrderKitchenItem kind="special" size={18} /> Includes a {money(visibleReceipt.specialBonus)} custom order bonus</p>
              {/if}
              {#if visibleReceipt.menuBonus && !training}
                <p class="request-paid"><OrderKitchenItem kind="street-sign" size={18} /> +{money(visibleReceipt.menuBonus)} from the chalkboard</p>
              {/if}
              <ul class="grade-stamps" aria-label="Drink grades">
                {#each gradeMarks as mark (mark.id)}
                  {@const score = visibleReceipt.grades[mark.id]}
                  <li class:good={score >= 90} title={mark.name} aria-label={mark.name + " " + score + "%"}>
                    <OrderKitchenItem kind={mark.icon} size={19} lit={score >= 90} /><span>{score}%</span>
                  </li>
                {/each}
              </ul>
              {#if visibleReceipt.message}<p class="tasting-note"><q>{visibleReceipt.message}</q></p>{/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>

    <footer class="counter-foot">
      <p aria-live="polite" class:sr-only={station === "serve" && !!last?.message && notice === last.message}>{notice || shift.notice || (selected ? "" : "Watch the rail for new tickets.")}</p>
      {#if training}
        <div class="close-actions">
          {#if last || shift.status === "complete"}
            <button type="button" class="text-control boba-key" on:click={onNextPractice}>Next practice ticket</button>
          {/if}
          <button type="button" class="text-control boba-key" on:click={onExitPractice}>End practice</button>
        </div>
      {:else if leaveConfirm}
        <div class="close-actions"><span>Close and settle today?</span>
          <button type="button" class="text-control boba-key" on:click={() => leaveConfirm = false}>Keep open</button>
          <button type="button" class="text-control boba-key" on:click={() => onApply(closeServiceDay(shift))}>Close day</button>
        </div>
      {:else if shift.status !== "complete" && !preOpening}
        <button type="button" class="text-control boba-key" on:click={() => leaveConfirm = true}>Close early</button>
      {/if}
    </footer>
    </section>

    <div class="service-tools">
    {#if heldPowerups.length || shift.powerups.special > 0 || quietTime > 0}
      <aside class="boost-shelf" aria-label="Shift boosts">
        <h2><span class="sr-only">Shift boosts</span><OrderPixelWord text="Boosts" cells={1} /></h2>
        <div class="powerups">
          {#each heldPowerups as item (item.id)}
            {@const reason = campaignPowerupBlockReason(campaign, item.id) || servicePowerupBlockReason(shift, item.id, selected?.id, campaign)}
            <button type="button" class="boba-key boost" disabled={!!reason}
              aria-label={item.name + ", " + campaign.powerups[item.id] + " available"} title={reason || item.description}
              on:click={() => useBoost(item.id)}>
              <OrderKitchenItem kind={item.id} size={22} lit={!reason} />
              <span><strong>{item.name} <small>×{campaign.powerups[item.id]}</small></strong>{#if reason}<small>{reason}</small>{/if}</span>
            </button>
          {/each}
          {#if shift.powerups.special > 0}
            <span class="active-special"><OrderKitchenItem kind="special" size={20} /> Tip Special ×{shift.powerups.special}</span>
          {/if}
          {#if quietTime > 0}
            <span class="active-special"><OrderKitchenItem kind="quiet" size={20} lit /> Chime {Math.ceil(quietTime)}s</span>
          {/if}
        </div>
      </aside>
    {/if}
    {#if campaign.activeCrew.length || contracts.length || reserved || commissioned !== null || shift.streak || shift.houseRoundReady}
      <div class="side-rail">
        {#if commission && commissioned !== null}
          <OrderCommissionNote offer={commission} count={commissioned} compact />
        {/if}
        {#if contracts.length}
          <details class="shift-card">
            <summary aria-label="Shift contracts">
              <OrderKitchenItem kind="clip" size={20} /><span>{contracts.filter(({ complete }) => complete).length}/{contracts.length}</span>
            </summary>
            <OrderShiftBoard {contracts} compact />
          </details>
        {/if}
        {#if reserved}
          <span class="table-mark" aria-label={"Reservation tickets at target quality, " + reserved.qualified + " of " + reserved.target}
            title="Reservation tickets at target quality">
            <OrderKitchenItem kind="cozy-seats" size={21} lit={!!reserved.earned} /> {reserved.qualified}/{reserved.target}
          </span>
        {/if}
        {#if shift.houseRoundReady}
          <button type="button" class="boba-key round-key" disabled={!tickets.some(({ catering }) => !catering)} on:click={offerRound}>
            <OrderKitchenItem kind="cup" size={21} lit /> Tasting tray
          </button>
        {:else if shift.streak > 0}
          <span class="table-mark" title={HOUSE_ROUND_STREAK + " good drinks charge a tasting tray"}
            aria-label={shift.streak + " good drinks in a row"}>
            <OrderKitchenItem kind="quality" size={21} /> ×{shift.streak}
          </span>
        {/if}
        {#if campaign.activeCrew.length}
          <ul class="crew-marks" aria-label="Crew on duty">
            {#each campaign.activeCrew as worker (worker)}
              <li title={shift.crewActivity?.[worker] ?? worker}><OrderKitchenItem kind={crewIcons[worker]} size={22} lit={!!shift.crewActivity?.[worker]} />
                <span class="sr-only">{shift.crewActivity?.[worker] ?? worker}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
    </div>
  </div>
</div>

<style>
  .counter-layout {
    display: grid;
    gap: var(--space-3);
    width: min(calc(100% - 2rem), 85rem);
    margin: var(--space-4) auto max(var(--space-4), env(safe-area-inset-bottom));
  }

  .kitchen-board {
    display: grid;
    grid-template-columns: minmax(0, 1.58fr) minmax(20rem, 1fr);
    grid-template-rows: auto 1fr;
    gap: var(--space-3);
    align-items: start;
  }

  .kitchen-board.close-view { grid-template-columns: minmax(0, 0.88fr) minmax(20rem, 1.3fr); }

  .kitchen-view {
    position: relative;
    aspect-ratio: 900 / 535;
    min-width: 0;
    isolation: isolate;
  }

  .kitchen-frame { grid-area: 1 / 1; min-width: 0; }

  .kitchen-view > :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .chef {
    position: absolute;
    z-index: 1;
    width: 6.1%;
    transform: translate(-50%, -95%);
    pointer-events: none;
    transition: left 480ms ease-in-out, top 480ms ease-in-out;
  }

  .chef :global(svg) {
    display: block;
    width: 100%;
    height: auto;
    position: relative;
  }

  .chef-cup {
    position: absolute;
    top: 46%;
    right: -8%;
    width: 41%;
  }

  .chef-shadow {
    position: absolute;
    inset: auto 4% 0;
    height: 18%;
    background: rgb(37 24 25 / 0.68);
    clip-path: polygon(12% 0, 84% 0, 84% 24%, 100% 24%, 100% 74%, 86% 74%, 86% 100%, 13% 100%, 13% 76%, 0 76%, 0 24%, 12% 24%);
  }

  .kitchen-hotspot {
    position: absolute;
    z-index: 2;
    display: grid;
    justify-items: center;
    align-items: end;
    transform: translate(-50%, -50%);
    border: 0;
    background: none;
    padding: 0;
    color: #ffe7b8;
    cursor: pointer;
    touch-action: manipulation;
  }

  .station-sign {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 7px 7px;
    max-width: 100%;
    background: #3b2826;
    box-shadow: inset 0 2px #936652, inset 0 -2px #211a20, 3px 3px #392821;
    clip-path: var(--notch);
    transition: background-color 150ms steps(2, end);
  }

  .kitchen-hotspot.is-here .station-sign {
    color: #372222;
    background: #f0c482;
    box-shadow: inset 0 2px #ffe3a5, inset 0 -3px #ad6b4d;
  }

  .kitchen-hotspot:focus-visible {
    outline: 2px dashed #ffe0a8;
    outline-offset: -2px;
  }
  .table-hotspot { left: 10.1%; top: 70.65%; width: 11%; height: 11%; min-width: 40px; min-height: 32px; }

  @media (hover: hover) {
    .kitchen-hotspot:hover .station-sign { background: #ad674e; color: #fff2d7; }
  }

  .station-sign kbd {
    min-width: 0.7rem;
    color: inherit;
    font: inherit;
    font-size: 0.68rem;
    line-height: 1;
  }

  .working-dot { flex: none; width: 5px; height: 5px; background: #ffe59f; }
  .is-here .working-dot { background: #92442d; }

  .workbench {
    --bench-cream: #fff0d6;
    --bench-muted: #e4c9ab;
    --bench-rule: #77594b;
    --slip-paper: #f1dfbf;
    --slip-ink: #322626;
    --slip-muted: #634e43;
    --slip-accent: #903e2f;
    grid-area: 1 / 2 / span 2;
    min-width: 0;
    color: var(--bench-cream);
  }

  .counter-plaque {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-height: 2.5rem;
    padding: 3px var(--space-3);
    margin: 0;
    color: #ffe0a9;
    background: #48312b;
    border-block: 2px solid #926652;
    line-height: 1;
  }

  .counter-plaque h2 { display: flex; align-items: center; gap: var(--space-2); margin: 0; color: inherit; line-height: 1; }
  .counter-plaque h2:focus-visible { outline: 2px solid #e9b180; outline-offset: 2px; }
  .camera-key.boba-key { min-height: 33px; padding-inline: 7px; gap: 5px; font-size: 0.72rem; }
  .camera-key[aria-pressed="true"] { --key-rule: #e2b17a; }

  .station-body { padding: var(--space-2); }
  .station-visual { min-width: 0; }
  .bench-paint { position: relative; aspect-ratio: 900 / 344; }
  .bench-paint > :global(svg) { display: block; width: 100%; height: 100%; }

  .fixture {
    position: absolute;
    display: grid;
    justify-items: end;
    align-items: end;
    min-width: 34px;
    min-height: 34px;
    padding: 3px;
    transform: translate(-50%, -50%);
    cursor: pointer;
    touch-action: manipulation;
    background: transparent;
    border: 0;
  }

  .fixture span { display: block; width: 5px; height: 5px; background: #fff0ac; box-shadow: 1px 1px #67453b; opacity: 0.67; }
  .fixture.is-lit span, .fixture:focus-visible span { opacity: 1; }
  .fixture.is-requested span { width: 7px; height: 7px; background: #ffe0a6; outline: 1px solid #8f5b40; opacity: 1; }
  .fixture:focus-visible { outline: 2px solid #fff0af; outline-offset: -3px; }

  @media (hover: hover) {
    .fixture:hover { outline: 1px dashed #fff0af; outline-offset: -2px; }
    .fixture:hover span { opacity: 1; }
  }

  .meter-label strong, .station-prompt strong { font-weight: 500; }
  .meter-label span, .station-prompt span, .handoff span { color: var(--bench-muted); font-size: 0.8125rem; }

  .station-controls { display: grid; gap: var(--space-2); padding-top: var(--space-2); min-width: 0; }
  .swap-offer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 6px;
    background: #e4d4ac;
    color: #4e3d34;
    clip-path: var(--notch);
    font-size: .75rem;
  }
  .swap-offer > span { display: inline-flex; align-items: center; gap: 2px; }
  .swap-offer button { margin-inline-start: auto; padding-inline: 6px; }
  .brew-choices, .build-racks { display: grid; gap: 5px; }

  .choice-rack, .action-row, .other-brews {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  .choice-rack {
    padding: 2px 3px 4px;
  }

  .choice-rack > span:first-child {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 0 0 3.45rem;
    color: var(--bench-muted);
    font-size: 0.75rem;
    font-style: italic;
  }

  button.boba-key.ingredient {
    min-height: 43px;
    padding-inline: 7px;
    font-size: 0.75rem;
    line-height: 1.16;
    text-align: left;
    justify-content: start;
  }

  .ingredient[aria-pressed="true"] {
    --key-face: #f0c59f;
    --key-foot: #a27155;
    --key-rule: #c8875f;
    color: #382725;
  }

  .ingredient.requested-choice:not([aria-pressed="true"]), .requested > .ingredient {
    --key-rule: #c67c61;
  }

  .portioned > .ingredient {
    --key-face: #d5d9b8;
    --key-foot: #869272;
    --key-rule: #758369;
    color: #2b352a;
  }

  .overfilled > .ingredient { --key-rule: #bd6453; }

  .ingredient-pair { display: inline-flex; max-width: 100%; }
  .remove.boba-key { min-width: 32px; padding-inline: 5px; }

  .prep-rack { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .prep {
    flex: 1 1 8.25rem;
    display: grid;
    gap: 4px;
    padding: 5px 3px 1px;
  }

  .prep.cooling progress { --meter-fill: #d99570; }
  .prep-meter { position: relative; display: flex; align-items: center; min-height: 12px; }
  .prep-meter i { width: 2px; height: 12px; position: absolute; left: 66.667%; background: #ffe0a6; }
  .meter-label .late { color: #f0a38e; }
  .prep-meter.late progress { --meter-fill: #d28470; }
  .runner-meter { display: flex; align-items: center; gap: var(--space-2); }
  .runner-meter progress { max-width: 8rem; }
  .freshness-meter { display: flex; align-items: center; gap: .3rem; font-size: .75rem; color: #f1c593; }
  .freshness-meter progress { max-width: 4rem; }
  .stock-keys, .stock-order { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  .stock-bin.boba-key { min-width: 53px; padding-inline: 4px; gap: 2px; }
  .stock-bin[aria-pressed="true"] { --key-face: #ead1a5; --key-foot: #9d6b4e; --key-rule: #e9a878; color: #382725; }
  .stock-order > span { color: var(--bench-muted); font-size: 0.8rem; padding-inline: 4px; }
  .delivery-readout { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 4px 8px; padding: 4px; }
  .delivery-readout strong { font-size: 1.1rem; }
  .delivery-readout progress { grid-column: 1 / -1; }

  .meter-label { display: flex; justify-content: space-between; gap: var(--space-2); align-items: baseline; }
  .station-prompt, .brewing, .handoff { display: grid; gap: 5px; }
  .station-prompt strong { font-size: 0.91rem; }
  .main-button { justify-self: start; }
  .extra-kettle.boba-key { font-size: 0.78rem; padding-inline: 7px; }
  .extra-kettle:not(:disabled) { --key-rule: #d2a56f; }
  .station-controls button.boba-key { min-height: 43px; }

  progress { --meter-track: #625047; --meter-fill: #efa988; width: 100%; height: 8px; appearance: none; border: 0; background: var(--meter-track); accent-color: var(--meter-fill); }
  progress::-webkit-progress-bar { background: var(--meter-track); }
  progress::-webkit-progress-value { background: var(--meter-fill); }
  progress::-moz-progress-bar { background: var(--meter-fill); }

  .serve-receipt {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-2);
    padding: 6px var(--space-2);
    border-block-start: 1px dashed #ab8a70;
    background: var(--slip-paper);
    color: var(--slip-ink);
    clip-path: var(--notch);
  }

  .serve-receipt > div { display: grid; gap: 2px; }
  .serve-receipt strong { font-weight: 500; }
  .serve-receipt span { color: var(--slip-muted); font-size: 0.75rem; }
  .grade-stamps { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 5px; list-style: none; margin: 0; padding: 0; }
  .grade-stamps li { display: inline-flex; align-items: center; gap: 2px; background: #e5c599; padding: 3px 5px; clip-path: var(--notch); }
  .grade-stamps li.good { background: #cbd3a6; }
  .grade-stamps li span { color: #4b4138; }
  .tasting-note { grid-column: 1 / -1; margin: 0; color: var(--slip-ink); font-size: .82rem; font-style: italic; }
  .request-paid { grid-column: 1 / -1; display: flex; align-items: center; gap: 5px; margin: 0; color: #6c471f; font-size: 0.8125rem; }

  .counter-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: 3px var(--space-2) 4px;
    border-top: 1px solid var(--bench-rule);
    min-height: 2.75rem;
  }

  .counter-foot p { margin: 0; font-size: 0.75rem; color: var(--bench-muted); }
  .dispatch-slip {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    color: #4d4433;
    background: #dedbb0;
    clip-path: var(--notch);
    font-size: .78rem;
  }
  .dispatch-slip small { display: block; font-size: .68rem; }
  .dispatch-slip > span { color: #56634b; font-variant-numeric: tabular-nums; }
  .close-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: end; gap: var(--space-1); font-size: 0.73rem; }
  .text-control.boba-key { min-height: 40px; padding-inline: 9px; line-height: 1.15; white-space: nowrap; }

  .service-tools { grid-area: 2 / 1; display: grid; gap: 4px; min-width: 0; }

  .boost-shelf {
    display: flex;
    align-items: start;
    gap: var(--space-2);
    min-width: 0;
    padding: 6px 8px;
    color: #ffe7b8;
    background: #392b2b;
    box-shadow: inset 0 3px #8d624e, inset 0 -3px #211c21;
    clip-path: var(--notch);
  }

  .boost-shelf h2 { flex: none; color: inherit; margin: 0; padding: 0.75rem 4px 0; line-height: 1; }
  .powerups { display: flex; flex-wrap: wrap; min-width: 0; gap: 5px; }
  .boost.boba-key { min-height: 43px; padding-inline: 7px; max-width: 100%; font-size: 0.72rem; text-align: left; }
  .boost.boba-key > span { display: grid; gap: 2px; max-width: 14rem; }
  .boost.boba-key strong { color: inherit; font-weight: 500; }
  .boost.boba-key small { color: inherit; font-size: 0.66rem; }
  .boost.boba-key:disabled { --key-face: #4b3a38; --key-rule: #906c5b; --key-foot: #271e22; opacity: 1; color: #e5c2ab; }
  .active-special { display: inline-flex; align-items: center; gap: 5px; padding: 4px; font-size: 0.75rem; }

  .side-rail { display: flex; flex-wrap: wrap; align-items: start; gap: 4px; color: #ffe7b8; }
  .shift-card, .crew-marks, .table-mark { margin: 0; background: #392b2b; clip-path: var(--notch); }
  .table-mark { display: flex; align-items: center; gap: 6px; min-height: 39px; padding: 3px 8px; font-size: 0.8125rem; }
  .round-key.boba-key { --key-face: #4a604b; --key-rule: #aeb78a; --key-foot: #283e35; min-height: 39px; padding-inline: 8px; }
  .shift-card summary { display: flex; align-items: center; gap: 6px; min-height: 39px; padding: 3px 8px; cursor: pointer; font-size: 0.8125rem; list-style: none; }
  .shift-card summary::-webkit-details-marker { display: none; }
  .shift-card summary::after { content: "+" / ""; color: #e5b793; }
  .shift-card[open] summary::after { content: "−" / ""; }
  .shift-card > :global(section) { min-width: 11rem; }
  .crew-marks { display: flex; align-items: center; min-height: 39px; gap: 0.4rem; padding: 3px 8px; list-style: none; }

  @media (max-width: 720px) and (orientation: portrait) {
    .counter-layout { width: calc(100% - 1rem); margin-top: var(--space-2); gap: var(--space-2); }
    .kitchen-board, .kitchen-board.close-view { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; gap: var(--space-2); }
    .kitchen-frame, .workbench, .service-tools { grid-area: auto; }
    .close-view .workbench { order: -1; }
    .camera-key.boba-key { min-height: 40px; }
    .station-sign { padding: 5px 5px 6px; gap: 4px; }
    .station-body { padding: 6px; }
  }

  @media (orientation: landscape) and (max-height: 540px) {
    .counter-layout { width: calc(100% - 1rem); height: calc(100% - 9px); grid-template-rows: auto minmax(0, 1fr); margin-block: 4px 5px; gap: 5px; }
    .kitchen-board { grid-template-columns: minmax(0, 1.17fr) minmax(17rem, 1fr); grid-template-rows: minmax(0, 1fr) auto; align-items: stretch; min-height: 0; gap: 5px; }
    .kitchen-frame { container-type: size; }
    .kitchen-view { width: min(100%, calc(100cqh * 900 / 535)); margin-inline: auto; }
    .workbench { align-self: start; max-height: 100%; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scroll-padding-block-start: 2.2rem; }
    .powerups { flex-wrap: nowrap; overflow-x: auto; }
    .boost { flex: none; }
    .counter-plaque { position: sticky; top: 0; z-index: 2; min-height: 2rem; }
    .station-body { padding: 5px; }
  }

  @media (orientation: landscape) and (max-width: 680px) {
    .kitchen-board { grid-template-columns: minmax(0, 1fr) minmax(15.5rem, 1.2fr); }
    .kitchen-board.close-view { grid-template-columns: minmax(0, 0.87fr) minmax(15.5rem, 1.35fr); }
  }

  @media (orientation: landscape) and (max-height: 430px) {
    .bench-paint { width: min(100%, 18rem); margin-inline: auto; }
    .close-view .bench-paint { width: min(100%, 21rem); }
    .bench-paint { box-shadow: 0 0 0 1px var(--bench-rule); }
  }

  @media (hover: none) and (pointer: coarse) {
    .station-sign kbd { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .chef, .station-sign { transition: none; }
  }
</style>
