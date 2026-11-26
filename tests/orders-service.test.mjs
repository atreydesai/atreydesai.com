import assert from "node:assert/strict";
import test from "node:test";

import { buyPowerup, consumeIngredients, DAY_EVENTS, eventForDay, LATE_EVENT_DAY, newCampaign, normalizeCampaign, startDay, stockCount } from "../src/lib/arcade/orders-campaign.ts";
import { cateringOffer } from "../src/lib/arcade/orders-catering.ts";
import { blendForDay, normalizeBlendTin } from "../src/lib/arcade/orders-blend-tin.ts";
import {
  activateCampaignPowerup, addIngredient, advanceService, applyServiceExtras, applyServiceToppings, canFillCarafe, carafeRemaining, cateringProgress, chargeSparkle, closeServiceDay,
  collectBatch, collectBuns, collectPearls, createServiceDay, fillNewBuilds, foamDrink, foamMilkFor, FROTH_DAY, EVENT_MENUS, ingredientSwapQuote, LOCATION_MENUS, PREP_YIELDS, RECIPE_BOOK, REGULARS, recipeSide, remakeOrder,
  removeIngredient, normalizeHouseBlend, openServiceDoors, openTicketCount, openingShortages, pourCarafe, recipeFromHouseBlend, reservationForDay, reservationProgress, restoreService, sealDrink, serveHouseRound, serveOrder, servePickupCounter, serveReservationTable, serviceSummary, serviceUsageDelta,
  requestIngredientSwap, scoopFloat, scoopFreshness, serviceRecipeRecords, setIce, shakeDrink, startBatch, startBrew, startBuns, startPearls, stopBrew, takeOrder, tickCampaignService,
  discardPrepBatch, prepFreshness, RUNNER_HANDOFF_SECONDS, orderExpressDelivery, expressDeliveryQuote, settleExpressDelivery,
  unlockedIngredients, useServicePowerup,
} from "../src/lib/arcade/orders-service.ts";

function day(options = {}) {
  return createServiceDay({ day: 1, expert: false, ...options });
}

function getOrder(shift, id) {
  return shift.orders.find((order) => order.id === id);
}

function accept(shift, order) {
  return takeOrder(advanceService(shift, order.arrivesAt - shift.elapsed), order.id);
}

function brew(shift, order) {
  const { tea, milk } = order.recipe;
  const cooking = startBrew(accept(shift, order), order.id, tea, milk);
  return stopBrew(advanceService(cooking, getOrder(cooking, order.id).cup.brew.target), order.id);
}

function build(shift, order, omit = []) {
  const { id, recipe } = order;
  let next = setIce(shift, id, recipe.ice);
  for (const ingredient of [...recipe.toppings, ...recipe.mixins, ...Array(recipe.sugar).fill(recipe.syrup), recipeSide(recipe)].filter(Boolean)) {
    if (!omit.includes(ingredient)) next = addIngredient(next, id, ingredient);
  }
  return next;
}

function serve(shift, order) {
  return serveOrder(sealDrink(shakeDrink(shift, order.id), order.id), order.id);
}

function balancedEvent(overrides = {}) {
  return { ...eventForDay(1), arrivalMultiplier: 1, patienceMultiplier: 1, tipMultiplier: 1, fruitBonus: 0, ...overrides };
}

test("the rotating cast introduces unlocked recipes through day thirty-one", () => {
  assert.ok(REGULARS.length >= 16);
  assert.equal(new Set(REGULARS.map(({ id }) => id)).size, REGULARS.length);
  assert.equal(RECIPE_BOOK.at(-1).day, 31);
  assert.deepEqual(new Set(unlockedIngredients(1)), new Set(["black", "milk", "pearls", "brown-sugar"]));
  for (let number = 1; number <= 32; number++) {
    const unlocked = unlockedIngredients(number);
    const newcomers = RECIPE_BOOK.filter(({ day }) => day === number);
    for (const expert of [false, true]) {
      const shift = day({ day: number, expert });
      const debuts = Math.min(newcomers.length, shift.orders.length);
      assert.deepEqual(shift.orders.slice(0, debuts).map(({ recipe }) => recipe), newcomers.slice(0, debuts).map(({ recipe }) => recipe));
      assert.equal(new Set(shift.orders.map(({ customerId }) => customerId)).size, shift.orders.length);
      assert.ok(shift.orders.every(({ recipe }) => [recipe.tea, recipe.accentTea, recipe.milk, recipe.syrup, ...recipe.toppings, ...recipe.mixins, recipeSide(recipe), recipe.float, recipe.sparkling ? "seltzer" : null]
        .every((id) => !id || unlocked.includes(id))));
    }
  }
  assert.ok(day({ day: 2 }).orders.some(({ recipe }) => recipe.mixins.includes("strawberry")));
  assert.ok(day({ day: 3 }).orders.some(({ recipe }) => recipe.mixins.includes("banana")));
});

test("a returning regular can order a deterministic variation with a one-time recipe bonus", () => {
  const regularVisits = Object.fromEntries(REGULARS.map(({ id }) => [id, 3]));
  const opening = day({ day: 3, regularVisits });
  assert.equal(opening.orders.some(({ specialRequest }) => specialRequest), false);
  assert.equal(day({ day: 5, regularVisits: { mochi: 1 } }).orders.some(({ specialRequest }) => specialRequest), false);
  const shift = day({ day: 5, regularVisits });
  const featured = shift.orders.filter(({ specialRequest }) => specialRequest);
  assert.equal(featured.length, 1);
  assert.deepEqual(day({ day: 5, regularVisits }), shift);
  const [order] = featured;
  const catalog = RECIPE_BOOK.find(({ customerId }) => order.customerId === customerId);
  assert.notDeepEqual(order.recipe, catalog.recipe);
  assert.equal(catalog.day < shift.day, true);
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(shift)), 5, false), shift);

  let work = brew(shift, order);
  if (order.recipe.toppings.includes("pearls")) {
    work = startPearls(work);
    work = collectPearls(advanceService(work, work.pearls.target));
  }
  if (order.recipe.bun) {
    work = startBuns(work);
    work = collectBuns(advanceService(work, work.buns.target));
  }
  const ready = build(work, order);
  const ordinary = { ...ready, orders: ready.orders.map((ticket) =>
    ticket.id === order.id ? { ...ticket, specialRequest: undefined } : ticket) };
  const boosted = serve(ready, order);
  assert.equal(boosted.receipts[0].specialBonus, order.specialRequest.bonus);
  assert.equal(boosted.receipts[0].revenue, serve(ordinary, order).receipts[0].revenue + order.specialRequest.bonus);
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(boosted)), 5, false), boosted);

  const wrongIce = setIce(ready, order.id, order.recipe.ice === 3 ? 0 : 3);
  assert.equal(serve(wrongIce, order).receipts[0].specialBonus, undefined);
});

test("orders arrive separately and parallel kettles leave the source state untouched", () => {
  const initial = day({ day: 10, event: balancedEvent() });
  const [first, second, third, fourth] = initial.orders;
  assert.equal(takeOrder(initial, second.id), initial);
  const two = accept(accept(initial, first), second);
  const oneBrew = startBrew(two, first.id, first.recipe.tea, first.recipe.milk);
  const twoBrews = startBrew(oneBrew, second.id, second.recipe.tea, second.recipe.milk);
  const later = advanceService(twoBrews, 2);
  assert.deepEqual(twoBrews.orders.slice(0, 2).map(({ cup }) => cup.brew.elapsed), [0, 0]);
  assert.deepEqual(later.orders.slice(0, 2).map(({ cup }) => cup.brew.elapsed), [2, 2]);
  assert.equal(oneBrew.orders[1].status, "accepted");
  assert.equal(initial.orders[0].status, "waiting");
  assert.deepEqual(initial.usage, {});
  const three = advanceService(accept(later, third), fourth.arrivesAt - third.arrivesAt);
  assert.equal(takeOrder(three, fourth.id), three);
  assert.equal(getOrder(three, first.id).status, "building");
  assert.equal(getOrder(three, second.id).status, "building");
});

test("buns and pearls can be timed together and charge their batch yields exactly once", () => {
  const initial = day({ day: 3 });
  const order = initial.orders.find(({ customerId }) => customerId === "dumpling");
  const cooking = startBuns(startPearls(accept(initial, order)));
  assert.deepEqual(serviceUsageDelta(initial, cooking), { pearls: PREP_YIELDS.pearls, bun: PREP_YIELDS.bun });
  assert.equal(startPearls(cooking), cooking);
  assert.equal(collectBuns(cooking), cooking);
  const started = startBrew(cooking, order.id, order.recipe.tea, order.recipe.milk);
  const bunsDone = collectBuns(advanceService(started, cooking.buns.target));
  const pearlsDone = collectPearls(advanceService(stopBrew(bunsDone, order.id), cooking.pearls.target - cooking.buns.target));
  assert.equal(pearlsDone.buns.quality, 100);
  assert.equal(pearlsDone.pearls.quality, 100);
  assert.equal(startBuns(pearlsDone), pearlsDone);
  const scooped = addIngredient(addIngredient(pearlsDone, order.id, "bun"), order.id, "pearls");
  assert.deepEqual(serviceUsageDelta(pearlsDone, scooped), {});
  assert.equal(scooped.pearls.ready, PREP_YIELDS.pearls - 1);
  assert.equal(scooped.buns.ready, PREP_YIELDS.bun - 1);
  const thrownAway = removeIngredient(scooped, order.id, "pearls");
  assert.deepEqual(thrownAway.usage, scooped.usage);
  assert.equal(thrownAway.pearls.ready, scooped.pearls.ready);
  assert.deepEqual(getOrder(thrownAway, order.id).cup.prepQuality.pearls, []);
});

test("a full recipe, fresh prep, and a timely handoff earn a graded receipt and a returning regular", () => {
  const initial = day();
  const order = initial.orders[1];
  const brewed = brew(collectPearls(advanceService(startPearls(initial), initial.pearls.target)), order);
  assert.equal(serveOrder(brewed, order.id), brewed);
  const built = build(brewed, order);
  assert.equal(sealDrink(built, order.id), built);
  const shaken = shakeDrink(built, order.id);
  assert.equal(getOrder(setIce(shaken, order.id, 3), order.id).cup.shaken, false);
  const served = serve(built, order);
  const [receipt] = served.receipts;
  assert.equal(receipt.quality, 100);
  assert.deepEqual(receipt.grades, { brew: 100, build: 100, finish: 100, wait: 100 });
  assert.ok(receipt.revenue > 400 && receipt.tips > 0);
  assert.deepEqual(serviceSummary(served), {
    revenue: receipt.revenue, tips: receipt.tips, served: 1, quality: 100, missed: 0, regularVisits: { biscuit: 1 },
  });
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(served)), 1, false), served);
  assert.equal(serveOrder(served, order.id), served);
  const liked = day({ regularVisits: { biscuit: 4 } });
  assert.equal(liked.orders[1].patience, initial.orders[1].patience + 4);
});

test("wrong choices grade below the intended recipe and a remake never refunds ingredients", () => {
  const initial = day({ day: 3 });
  const order = initial.orders[0];
  const brewing = startBrew(accept(initial, order), order.id, "black", "milk");
  const weak = stopBrew(advanceService(brewing, 1), order.id);
  const added = addIngredient(weak, order.id, "brown-sugar");
  const bad = serve(added, order).receipts[0];
  assert.ok(bad.grades.brew < 30);
  assert.ok(bad.grades.build < 70);
  const remade = remakeOrder(added, order.id);
  assert.equal(getOrder(remade, order.id).status, "accepted");
  assert.equal(getOrder(remade, order.id).cup, null);
  assert.deepEqual(remade.usage, added.usage);
  const brewedAgain = brew(remade, order);
  assert.deepEqual(serviceUsageDelta(remade, brewedAgain), { taro: 1, oat: 1 });
  const good = serve(build(brewedAgain, order), order).receipts[0];
  assert.ok(good.quality > bad.quality);
  assert.ok(good.revenue > bad.revenue);
});

test("upgraded dispensers and build tools preserve portions and prepared stock", () => {
  const initial = day({ day: 3, upgrades: ["auto-tea", "auto-milk", "auto-toppings", "auto-extras"] });
  const order = initial.orders.find(({ customerId }) => customerId === "peaches");
  const cooking = startBrew(accept(initial, order), order.id, "jasmine", null);
  assert.deepEqual(cooking.usage, { black: 1, oat: 1 });
  const brewed = advanceService(cooking, 4);
  assert.equal(getOrder(brewed, order.id).status, "building");
  const filled = applyServiceExtras(applyServiceToppings(brewed, order.id), order.id);
  assert.deepEqual(serviceUsageDelta(brewed, filled), { strawberry: 1, banana: 1, popping: 1, honey: 1 });
  assert.equal(applyServiceExtras(filled, order.id), filled);
  assert.equal(applyServiceToppings(filled, order.id), filled);
  assert.equal(serve(filled, order).receipts[0].quality, 100);
});

test("powerups improve current prep, extend patience, and boost one handoff", () => {
  const initial = day();
  const order = initial.orders[0];
  const cooking = startPearls(startBrew(takeOrder(initial, order.id), order.id, order.recipe.tea, order.recipe.milk));
  const rushed = useServicePowerup(cooking, "rush");
  assert.equal(getOrder(rushed, order.id).cup.brew.quality, 100);
  assert.equal(rushed.pearls.elapsed, rushed.pearls.target);
  assert.equal(rushed.pearls.ready, PREP_YIELDS.pearls);
  assert.equal(rushed.pearls.cooking, false);
  assert.deepEqual(serviceUsageDelta(cooking, rushed), {});
  const sampled = useServicePowerup(rushed, "patience");
  assert.ok(sampled.orders[0].patience > rushed.orders[0].patience);
  assert.equal(sampled.orders[1].patience, rushed.orders[1].patience);
  const boosted = serve(useServicePowerup(sampled, "quality"), order);
  assert.equal(boosted.powerups.quality, 0);
  assert.equal(boosted.receipts[0].quality, serve(sampled, order).receipts[0].quality + 12);
});

test("Counter Help waits for prep and pantry stock, then fixes and seals only the selected cup", () => {
  const campaign = startDay(buyPowerup(newCampaign("expert"), "assist").campaign).campaign;
  const initial = day({ expert: true });
  const order = initial.orders.find(({ customerId }) => customerId === "biscuit");
  const brewed = brew(initial, order);
  const blocked = activateCampaignPowerup(campaign, brewed, "assist", order.id);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.campaign, campaign);
  assert.equal(blocked.service, brewed);
  assert.match(blocked.message, /pearls/);

  const cooking = startPearls(brewed);
  const ready = collectPearls(advanceService(cooking, cooking.pearls.target));
  const mixed = setIce(ready, order.id, 3);
  const emptySyrup = consumeIngredients(campaign, { "brown-sugar": stockCount(campaign, "brown-sugar") }).campaign;
  const missing = activateCampaignPowerup(emptySyrup, mixed, "assist", order.id);
  assert.equal(missing.ok, false);
  assert.equal(missing.campaign.powerups.assist, 1);
  assert.equal(missing.service, mixed);

  const helped = activateCampaignPowerup(campaign, mixed, "assist", order.id);
  assert.equal(helped.ok, true);
  assert.equal(helped.campaign.powerups.assist, 0);
  assert.equal(stockCount(helped.campaign, "brown-sugar"), stockCount(campaign, "brown-sugar") - order.recipe.sugar);
  assert.equal(helped.service.pearls.ready, mixed.pearls.ready - 1);
  assert.equal(getOrder(helped.service, order.id).cup.sealed, true);
  assert.equal(getOrder(helped.service, order.id).cup.ice, order.recipe.ice);
  assert.equal(helped.service.receipts.length, 0);
});

test("Emergency Run tops up only unlocked ingredients, and never charges a full pantry", () => {
  assert.equal(buyPowerup(newCampaign("normal"), "supplies").ok, true);
  let campaign = startDay(buyPowerup(newCampaign("expert"), "supplies").campaign).campaign;
  const shift = day({ expert: true });
  const full = activateCampaignPowerup(campaign, shift, "supplies");
  assert.equal(full.ok, false);
  assert.equal(full.campaign, campaign);

  campaign = consumeIngredients(campaign, { black: 12, jasmine: 12, milk: 12 }).campaign;
  const restored = activateCampaignPowerup(campaign, shift, "supplies");
  assert.equal(restored.ok, true);
  assert.equal(restored.campaign.powerups.supplies, 0);
  assert.equal(stockCount(restored.campaign, "black"), 4);
  assert.equal(stockCount(restored.campaign, "milk"), 4);
  assert.equal(stockCount(restored.campaign, "jasmine"), 0);
  assert.deepEqual(restored.campaign.inventory.filter(({ expiresOn }) => expiresOn === 2).map(({ quantity }) => quantity), [4, 1]);
});

test("Tip Special lasts three handoffs and round-trips without stacking", () => {
  const initial = day();
  let boosted = useServicePowerup(initial, "special");
  assert.equal(boosted.powerups.special, 3);
  assert.equal(useServicePowerup(boosted, "special"), boosted);
  boosted = restoreService(JSON.parse(JSON.stringify(boosted)), initial.day, initial.expert);
  let basic = initial;
  for (const [index, order] of initial.orders.slice(0, 4).entries()) {
    basic = serve(brew(basic, order), order);
    boosted = serve(brew(boosted, order), order);
    assert.equal(boosted.receipts[index].tips - basic.receipts[index].tips, index < 3 ? 200 : 0);
  }
  assert.equal(boosted.powerups.special, 0);

  const oldPowerups = { rush: 0, patience: 1, quality: 1 };
  assert.deepEqual(restoreService({ ...initial, powerups: oldPowerups }, 1, false).powerups,
    { ...oldPowerups, assist: 0, supplies: 0, special: 0, quiet: 0 });
  assert.deepEqual(normalizeCampaign({ ...newCampaign("normal"), powerups: oldPowerups }, "normal").powerups,
    { ...oldPowerups, assist: 0, supplies: 0, special: 0, quiet: 0 });
});

test("a window chime holds waiting and active patience while the tea continues steeping", () => {
  for (const expert of [false, true]) {
    const initial = day({ day: 5, expert });
    const ticket = initial.orders[0];
    const accepted = takeOrder(initial, ticket.id);
    const ready = startBrew(accepted, ticket.id, ticket.recipe.tea, ticket.recipe.milk);
    const held = useServicePowerup(ready, "quiet");
    const advanced = advanceService(held, 2);
    assert.equal(getOrder(advanced, ticket.id).patience, getOrder(ready, ticket.id).patience);
    assert.equal(getOrder(advanced, ticket.id).cup.brew.elapsed, 2);
    assert.equal(useServicePowerup(advanced, "quiet"), advanced);
    assert.deepEqual(restoreService(JSON.parse(JSON.stringify(advanced)), 5, expert), advanced);
    const after = advanceService(held, 10);
    assert.ok(getOrder(after, ticket.id).patience < getOrder(ready, ticket.id).patience);
  }
});

test("a fruit event bonus applies once to correctly made fruit orders and keeps tips unscaled", () => {
  const base = day({ day: 2, event: balancedEvent() });
  const event = day({ day: 2, event: balancedEvent({ fruitBonus: 90, tipMultiplier: 1.5 }) });
  const [order] = event.orders;
  const ordinary = serve(build(brew(base, order), order), order).receipts[0];
  const special = serve(build(brew(event, order), order), order).receipts[0];
  assert.equal(special.revenue, ordinary.revenue + 90);
  assert.equal(special.tips, ordinary.tips);
  const baseOmitted = serve(build(brew(base, order), order, ["strawberry"]), order).receipts[0];
  const eventOmitted = serve(build(brew(event, order), order, ["strawberry"]), order).receipts[0];
  assert.equal(eventOmitted.revenue, baseOmitted.revenue);
});

test("last call honors pending customers with a bounded grace period and early close ignores future guests", () => {
  const initial = day({ event: balancedEvent() });
  const early = closeServiceDay(initial);
  assert.equal(early.status, "complete");
  assert.equal(serviceSummary(early).missed, 1);
  assert.equal(early.orders.length, 1);
  const shifted = advanceService(initial, initial.duration);
  assert.equal(shifted.status, "closing");
  const last = shifted.orders.at(-1);
  const served = serve(build(brew(shifted, last), last), last);
  assert.equal(served.status, "complete");
  assert.equal(served.receipts.length, 1);
  const unattended = advanceService(shifted, 300);
  assert.equal(unattended.status, "complete");
  assert.equal(serviceSummary(unattended).missed, initial.orders.length);
  assert.equal(advanceService(unattended, 30), unattended);
});

test("the shift settles at the same time after a long tick or a series of short ticks", () => {
  const initial = day({ event: balancedEvent({ arrivalMultiplier: 0.7, patienceMultiplier: 0.4 }) });
  const skipped = advanceService(initial, 200);
  let stepped = initial;
  for (let second = 0; second < 200; second++) stepped = advanceService(stepped, 1);
  assert.equal(skipped.status, "complete");
  assert.ok(skipped.elapsed > initial.duration && skipped.elapsed < initial.duration + 18);
  assert.ok(Math.abs(skipped.elapsed - stepped.elapsed) < 0.001);
  assert.deepEqual(serviceSummary(skipped), serviceSummary(stepped));
});

test("a saved workbench restores active timers and rejects mismatched or invalid work", () => {
  const initial = day({ day: 3, expert: true });
  const order = initial.orders[0];
  const active = advanceService(startPearls(startBrew(accept(initial, order), order.id, order.recipe.tea, order.recipe.milk)), 1.8);
  const saved = JSON.parse(JSON.stringify(active));
  assert.deepEqual(restoreService(saved, 3, true), active);
  assert.equal(restoreService(saved, 2, true), null);
  assert.equal(restoreService(saved, 3, false), null);
  saved.orders[0].cup.brew.elapsed = "3s";
  assert.equal(restoreService(saved, 3, true), null);
  const complete = closeServiceDay(active);
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(complete)), 3, true), complete);
});

test("the prep cook starts demanded batches once and keeps a failed stock purchase atomic", () => {
  for (const mode of ["normal", "expert"]) {
    const activeCrew = ["prep"];
    const campaign = { ...startDay(newCampaign(mode)).campaign, activeCrew };
    const initial = day({ expert: mode === "expert", activeCrew });
    const order = initial.orders.find(({ recipe }) => recipe.toppings.includes("pearls"));
    const atArrival = advanceService(initial, order.arrivesAt);
    const started = tickCampaignService(campaign, atArrival, 1);
    assert.equal(started.service.pearls.cooking, true);
    assert.equal(stockCount(started.campaign, "pearls"), stockCount(campaign, "pearls") - PREP_YIELDS.pearls);
    const collected = tickCampaignService(started.campaign, started.service, initial.pearls.target);
    assert.equal(collected.service.pearls.ready, PREP_YIELDS.pearls);
    assert.equal(collected.service.pearls.quality, 100);
    assert.equal(collected.campaign, started.campaign);

    const depleted = consumeIngredients(campaign, { pearls: stockCount(campaign, "pearls") - 1 }).campaign;
    const blocked = tickCampaignService(depleted, atArrival, 1);
    assert.equal(blocked.campaign, depleted);
    assert.deepEqual(blocked.service.usage, {});
    assert.equal(blocked.service.pearls.cooking, false);
    assert.match(blocked.service.crewActivity.prep, /Low stock/);
  }
});

test("the host improves queue patience and the runner leaves a receipt after the pickup delay", () => {
  const activeCrew = ["host", "runner"];
  const campaign = { ...startDay(newCampaign("normal")).campaign, activeCrew };
  const initial = day({ activeCrew });
  const [order] = initial.orders;
  assert.ok(order.patience > day().orders[0].patience);
  const building = build(brew(initial, order), order);
  const sealed = sealDrink(shakeDrink(building, order.id), order.id);
  const pending = tickCampaignService(campaign, sealed, RUNNER_HANDOFF_SECONDS - 1);
  assert.equal(pending.service.receipts.length, 0);
  assert.match(pending.service.crewActivity.runner, /Picking up/);
  const resumed = restoreService(JSON.parse(JSON.stringify(pending.service)), 1, false);
  const delivered = tickCampaignService(campaign, resumed, 1);
  assert.equal(delivered.service.receipts.length, 1);
  assert.equal(delivered.service.receipts[0].handedOffBy, "runner");
  assert.equal(tickCampaignService(campaign, delivered.service, 1).service.receipts.length, 1);
});

test("later shifts bunch arrivals and let stale prep be discarded without refunding stock", () => {
  const initial = day({ day: 4, event: balancedEvent() });
  const [first, second, third] = initial.orders;
  assert.ok(third.arrivesAt - second.arrivesAt < second.arrivesAt - first.arrivesAt);
  const batch = collectPearls(advanceService(startPearls(initial), initial.pearls.target));
  const stale = advanceService(batch, 45);
  assert.ok(prepFreshness(stale, "pearls") < 100);
  const cleared = discardPrepBatch(stale, "pearls");
  assert.equal(cleared.pearls.ready, 0);
  assert.deepEqual(cleared.usage, stale.usage);
  const { prepMultiplier, serveBonus, ...oldEffects } = initial.effects;
  const restored = restoreService({ ...initial, effects: oldEffects }, 4, false);
  assert.equal(restored.effects.prepMultiplier, 1);
  assert.equal(restored.effects.serveBonus, 0);
});

test("express deliveries charge once, arrive during service, and survive reload", () => {
  for (const mode of ["normal", "expert"]) {
    const campaign = startDay({ ...newCampaign(mode), day: 3 }).campaign;
    const shift = day({ day: 3, expert: mode === "expert" });
    const quote = expressDeliveryQuote(campaign, "pearls");
    assert.equal(orderExpressDelivery(campaign, shift, "pudding").ok, false);
    assert.equal(orderExpressDelivery({ ...campaign, cash: quote.cost - 1 }, shift, "pearls").ok, false);

    const ordered = orderExpressDelivery(campaign, shift, "pearls");
    assert.equal(ordered.ok, true);
    assert.equal(ordered.campaign.cash, campaign.cash - quote.cost);
    assert.equal(stockCount(ordered.campaign, "pearls"), stockCount(campaign, "pearls"));
    assert.equal(orderExpressDelivery(ordered.campaign, ordered.service, "pearls").ok, false);
    const saved = JSON.parse(JSON.stringify(ordered));
    const restored = restoreService(saved.service, 3, mode === "expert");
    assert.deepEqual(restored.pendingDelivery, ordered.service.pendingDelivery);
    assert.equal(restoreService({ ...saved.service, pendingDelivery: { ...saved.service.pendingDelivery, cost: 1 } }, 3, mode === "expert"), null);
    const waiting = tickCampaignService(saved.campaign, restored, quote.seconds - 1);
    assert.ok(waiting.service.pendingDelivery);
    const delivered = tickCampaignService(waiting.campaign, waiting.service, 1);
    assert.equal(delivered.service.pendingDelivery, undefined);
    assert.equal(stockCount(delivered.campaign, "pearls"), stockCount(campaign, "pearls") + quote.quantity);
    assert.equal(delivered.campaign.cash, campaign.cash - quote.cost);
    const after = tickCampaignService(delivered.campaign, delivered.service, 1);
    assert.equal(after.campaign, delivered.campaign);
  }
});

test("closing before the courier arrives refunds the pending order exactly once", () => {
  const early = startDay(newCampaign("normal")).campaign;
  assert.match(orderExpressDelivery(early, day(), "black").message, /day 3/);
  const campaign = { ...early, day: 3 };
  const initial = day({ day: 3 });
  const ordered = orderExpressDelivery(campaign, initial, "black");
  const completed = closeServiceDay(ordered.service);
  const refunded = settleExpressDelivery(ordered.campaign, completed);
  assert.equal(refunded.campaign.cash, campaign.cash);
  assert.equal(refunded.service.pendingDelivery, undefined);
  assert.match(refunded.service.notice, /refunded/);
  assert.deepEqual(settleExpressDelivery(refunded.campaign, refunded.service), refunded);
});

test("branches rotate a local special without altering first visits or personal requests", () => {
  const regularVisits = Object.fromEntries(REGULARS.map(({ id }) => [id, 3]));
  for (const [activeBranch, menu] of Object.entries(LOCATION_MENUS)) {
    for (const expert of [false, true]) {
      const picks = [4, 5].map((number) => {
        const shift = day({ day: number, expert, activeBranch, event: balancedEvent(), regularVisits });
        const visiting = shift.orders.filter(({ customerId }) => REGULARS.find(({ id }) => id === customerId).day === number);
        assert.ok(visiting.length);
        assert.ok(visiting.every(({ locationSpecial, specialRequest }) => !locationSpecial && !specialRequest));
        const featured = shift.orders.filter(({ locationSpecial }) => locationSpecial === activeBranch);
        assert.equal(featured.length, 1);
        assert.equal(featured[0].specialRequest, undefined);
        assert.deepEqual(restoreService(JSON.parse(JSON.stringify(shift)), number, expert), shift);
        return featured[0].recipe;
      });
      assert.deepEqual(picks, menu.filter(({ waffle, float, accentTea }) => !waffle && !float && !accentTea));
    }
  }
  for (const number of [1, 2, 3]) {
    assert.equal(day({ day: number, activeBranch: "night" }).orders.some(({ locationSpecial }) => locationSpecial), false);
  }
});

test("seasonal specials can run alongside a branch recipe as separate orders", () => {
  for (const [id, recipe] of Object.entries(EVENT_MENUS)) {
    const number = recipe.sparkling ? LATE_EVENT_DAY : 6;
    const shift = day({ day: number, activeBranch: "garden", event: balancedEvent({ id }) });
    const eventOrder = shift.orders.find(({ seasonalSpecial }) => seasonalSpecial === id);
    assert.deepEqual(eventOrder.recipe, recipe);
    assert.equal(eventOrder.locationSpecial, undefined);
    assert.ok(shift.orders.some(({ locationSpecial }) => locationSpecial === "garden"));
    assert.deepEqual(restoreService(JSON.parse(JSON.stringify(shift)), number, false), shift);
  }
});

test("Candlelight turns off the sealer and Bottle Return pays only when a fizzy recipe is actually charged", () => {
  const candlelight = DAY_EVENTS.find(({ id }) => id === "candlelight");
  const returnDay = DAY_EVENTS.find(({ id }) => id === "bottle-return");
  const options = { day: LATE_EVENT_DAY, upgrades: ["auto-sealer"] };
  const candles = day({ ...options, event: candlelight });
  assert.equal(candles.effects.autoSeal, false);
  assert.equal(candles.effects.tipMultiplier, 1.25);
  const shift = day({ ...options, event: returnDay });
  const order = shift.orders.find(({ seasonalSpecial }) => seasonalSpecial === returnDay.id);
  const shaken = shakeDrink(build(brew(shift, order), order), order.id);
  assert.equal(getOrder(advanceService(shaken, 1), order.id).cup.sealed, false);
  const flat = serveOrder(sealDrink(shaken, order.id), order.id);
  assert.equal(flat.receipts[0].menuBonus, undefined);
  const charged = chargeSparkle(shaken, order.id);
  assert.deepEqual(serviceUsageDelta(shaken, charged), { seltzer: 1 });
  assert.equal(chargeSparkle(charged, order.id), charged);
  const fizz = serveOrder(advanceService(charged, 1), order.id);
  assert.equal(fizz.receipts[0].menuBonus, 115);
  assert.equal(fizz.receipts[0].grades.finish, 100);
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(fizz)), LATE_EVENT_DAY, false), fizz);
});

test("waffle press uses its own fresh batch and preserves active legacy saves", () => {
  const before = day({ day: 12 });
  assert.equal(startBatch(before, "waffle"), before);
  const { waffles: _unused, ...legacy } = before;
  assert.deepEqual(restoreService(legacy, 12, false), before);

  for (const expert of [false, true]) {
    const shift = day({ day: 13, expert });
    const ticket = shift.orders[0];
    assert.equal(recipeSide(ticket.recipe), "waffle");
    const brewed = brew(shift, ticket);
    const toasting = startBatch(brewed, "waffle");
    assert.deepEqual(serviceUsageDelta(brewed, toasting), { waffle: 2 });
    assert.equal(collectBatch(toasting, "waffle"), toasting);
    const cooked = collectBatch(advanceService(toasting, toasting.waffles.target), "waffle");
    const plated = build(cooked, ticket);
    assert.equal(plated.waffles.ready, 1);
    assert.equal(plated.buns, shift.buns);
    assert.deepEqual(serviceUsageDelta(cooked, plated).waffle, undefined);
    const receipt = serve(plated, ticket).receipts[0];
    assert.equal(receipt.grades.build, 100);
    assert.equal(receipt.grades.finish, 100);
    assert.match(receipt.message, /crispiest corner/);
    assert.deepEqual(restoreService(plated, 13, expert), plated);

    const later = advanceService(cooked, 12);
    assert.equal(prepFreshness(later, "waffle") < 100, expert);
    const night = day({ day: 15, expert, activeBranch: "night", event: balancedEvent() });
    assert.ok(night.orders.some((order) => order.locationSpecial === "night" && order.recipe.waffle));
  }
});

test("the warm shelf delays cooling in both modes", () => {
  for (const expert of [false, true]) {
    const compare = (upgrades) => {
      const working = startBatch(day({ day: 13, expert, upgrades }), "waffle");
      const fresh = collectBatch(advanceService(working, working.waffles.target), "waffle");
      return prepFreshness(advanceService(fresh, 20), "waffle");
    };
    assert.ok(compare([]) < 100);
    assert.equal(compare(["warm-shelf"]), 100);
  }
});

test("chalkboard events reward fresh sides and the extra-ice recipe only when matched", () => {
  const rainy = day({ day: 6, event: balancedEvent({ id: "rain", sideBonus: 115 }) });
  const snack = rainy.orders[0];
  const brewing = brew(rainy, snack);
  const steamer = startBuns(brewing);
  const ready = collectBuns(advanceService(steamer, steamer.buns.target));
  assert.equal(serve(build(ready, snack), snack).receipts[0].menuBonus, 115);
  assert.equal(serve(build(ready, snack, ["bun"]), snack).receipts[0].menuBonus, undefined);

  const rush = day({ day: 6, event: balancedEvent({ id: "campus", icedBonus: 85 }) });
  const icy = rush.orders.find(({ seasonalSpecial }) => seasonalSpecial === "campus");
  const mixed = build(brew(rush, icy), icy);
  assert.equal(serve(mixed, icy).receipts[0].menuBonus, 85);
  assert.equal(serve(setIce(mixed, icy.id, 2), icy).receipts[0].menuBonus, undefined);
});

test("the opening forecast counts batch yields, expired lots, and milk for foam", () => {
  const opening = day({ day: 10 });
  const source = {
    ...newCampaign("normal"), day: 10,
    inventory: [{ id: 1, ingredient: "pearls", quantity: 3, expiresOn: 12 },
      { id: 2, ingredient: "oat", quantity: 1, expiresOn: 12 },
      { id: 3, ingredient: "mango", quantity: 8, expiresOn: 10 }],
  };
  const missing = Object.fromEntries(openingShortages(source, opening.orders.slice(0, 1)).map(({ id, missing }) => [id, missing]));
  assert.equal(missing.pearls, 1);
  assert.equal(missing.oat, 1);
  assert.equal(missing.mango, 1);
  assert.equal(missing.bun, PREP_YIELDS.bun);
  assert.equal(missing.waffle, undefined);
});

test("a double brew charges two tea portions once and leaves one fresh portion for a matching ticket", () => {
  const shift = day({ upgrades: ["tea-carafe"] });
  const [first, second] = shift.orders;
  const accepted = accept(shift, first);
  assert.equal(canFillCarafe(accepted), true);
  const double = startBrew(accepted, first.id, "black", "milk", { double: true });
  assert.deepEqual(serviceUsageDelta(accepted, double), { black: 2, milk: 1 });
  assert.equal(canFillCarafe(double), false);
  const saved = JSON.parse(JSON.stringify(double));
  assert.deepEqual(restoreService(saved, 1, false), saved);
  const pulled = stopBrew(advanceService(double, 4), first.id);
  assert.equal(carafeRemaining(pulled), 1);
  const queued = accept(pulled, second);
  const poured = pourCarafe(queued, second.id, second.recipe.milk);
  assert.equal(getOrder(poured, second.id).status, "building");
  assert.equal(getOrder(poured, second.id).cup.brew.quality, 100);
  assert.deepEqual(serviceUsageDelta(queued, poured), { milk: 1 });
  assert.equal(pourCarafe(poured, second.id, "milk"), poured);
  assert.equal(canFillCarafe(poured), true);
  assert.equal(advanceService(pulled, 34).carafe, undefined);
});

test("the carafe fills at the original automatic brew time and works with Prep Sprint", () => {
  for (const expert of [false, true]) {
    const shift = day({ expert, upgrades: ["tea-carafe", "auto-tea"] });
    const [first] = shift.orders;
    const brewing = startBrew(accept(shift, first), first.id, "black", "milk", { double: true });
    const automatic = advanceService(brewing, 6);
    assert.equal(automatic.carafe.filledAt, 4);
    assert.ok(carafeRemaining(automatic) < 1);

    const rushed = useServicePowerup(brewing, "rush");
    assert.equal(rushed.carafe.quality, 100);
    assert.equal(rushed.carafe.filledAt, 0);
    assert.deepEqual(restoreService(JSON.parse(JSON.stringify(rushed)), 1, expert), rushed);
  }
});

test("the pickup counter hands over every sealed cup exactly once", () => {
  const initial = day({ upgrades: ["pickup-counter"] });
  const [first, second] = initial.orders;
  let shift = startPearls(initial);
  shift = collectPearls(advanceService(shift, shift.pearls.target));
  for (const ticket of [first, second]) {
    shift = build(brew(shift, ticket), ticket);
    shift = sealDrink(shakeDrink(shift, ticket.id), ticket.id);
  }
  const blocked = { ...shift, effects: { ...shift.effects, batchPickup: false } };
  assert.equal(servePickupCounter(blocked), blocked);
  const served = servePickupCounter(shift);
  assert.equal(served.receipts.length, 2);
  assert.deepEqual(served.receipts.map(({ orderId }) => orderId), [first.id, second.id]);
  assert.deepEqual(serviceUsageDelta(shift, served), {});
  assert.equal(servePickupCounter(served), served);
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(served)), 1, false), served);
});

test("a float is scooped after shaking, costs one portion, and rewards a cold handoff", () => {
  for (const expert of [false, true]) {
    const shift = day({ day: 16, expert });
    const order = shift.orders[0];
    assert.equal(order.recipe.float, "vanilla-scoop");
    const brewed = brew(shift, order);
    const steaming = startBuns(brewed);
    const built = build(collectBuns(advanceService(steaming, steaming.buns.target)), order);
    assert.equal(scoopFloat(built, order.id, "vanilla-scoop"), built);
    const shaken = shakeDrink(built, order.id);
    const banana = scoopFloat(shaken, order.id, "banana-scoop");
    assert.equal(serve(banana, order).receipts[0].grades.finish, 50);
    const vanilla = scoopFloat(banana, order.id, "vanilla-scoop");
    assert.deepEqual(serviceUsageDelta(shaken, vanilla), { "banana-scoop": 1, "vanilla-scoop": 1 });
    assert.equal(scoopFloat(vanilla, order.id, "vanilla-scoop"), vanilla);
    assert.equal(serve(vanilla, order).receipts[0].grades.finish, 100);
    assert.ok(scoopFreshness(advanceService(vanilla, 12), getOrder(vanilla, order.id).cup) < 100 || !expert);
    assert.equal(getOrder(setIce(vanilla, order.id, 3), order.id).cup.float, undefined);
    assert.deepEqual(restoreService(JSON.parse(JSON.stringify(vanilla)), 16, expert), vanilla);
  }
});

test("a flavor can join a house tea when the freezer opens", () => {
  const recipe = { tea: "jasmine", milk: null, topping: null, fruit: "strawberry", syrup: "honey", sugar: 1, ice: 2, float: "banana-scoop" };
  assert.equal(normalizeHouseBlend(recipe, 15), null);
  assert.deepEqual(normalizeHouseBlend(recipe, 16), recipe);
  assert.equal(recipeFromHouseBlend(recipe).name, "House Strawberry Jasmine Float");
  const shift = day({ day: 16, upgrades: ["menu-easel"], houseBlend: recipe });
  assert.equal(shift.orders.find(({ houseBlend }) => houseBlend).recipe.float, "banana-scoop");
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(shift)), 16, false), shift);
});

test("two kettles use separate portions and can be selected in either order", () => {
  const initial = day({ day: 21, upgrades: ["tea-carafe"] });
  const ticket = initial.orders[0];
  const waiting = takeOrder(initial, ticket.id);
  const { tea, accentTea, milk } = ticket.recipe;
  assert.ok(accentTea);
  assert.equal(startBrew(waiting, ticket.id, tea, milk), waiting);
  assert.equal(startBrew(waiting, ticket.id, tea, milk, { accentTea: tea }), waiting);
  assert.equal(startBrew(waiting, ticket.id, tea, milk, { double: true, accentTea }), waiting);
  const steeping = startBrew(waiting, ticket.id, accentTea, milk, { accentTea: tea });
  assert.deepEqual(serviceUsageDelta(waiting, steeping), { [tea]: 1, [accentTea]: 1, [milk]: 1 });
  const pulled = stopBrew(advanceService(steeping, getOrder(steeping, ticket.id).cup.brew.target), ticket.id);
  const mixed = shakeDrink(build(pulled, ticket), ticket.id);
  const complete = serve(foamDrink(mixed, ticket.id), ticket);
  assert.equal(complete.receipts[0].grades.brew, 100);
  assert.equal(complete.receipts[0].grades.finish, 100);
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(complete)), 21, false), complete);
});

test("the wide ticket rack restores its fourth live ticket in both modes", () => {
  for (const expert of [false, true]) {
    for (const wide of [false, true]) {
      const base = day({ day: 8, expert, upgrades: wide ? ["ticket-rack"] : [] });
      const ready = { ...base, orders: base.orders.map((order, index) => index < 5 ? { ...order, arrivesAt: 0 } : order) };
      const opened = ready.orders.slice(0, 5).reduce((shift, { id }) => takeOrder(shift, id), ready);
      assert.equal(openTicketCount(opened), wide ? 4 : 3);
      assert.deepEqual(restoreService(JSON.parse(JSON.stringify(opened)), 8, expert), opened);
    }
  }
});

test("the cold tray protects a float during a long wait at the pass", () => {
  for (const expert of [false, true]) {
    for (const cold of [false, true]) {
      const initial = day({ day: 16, expert, upgrades: cold ? ["cold-tray"] : [] });
      const first = initial.orders[0];
      const mixed = shakeDrink(brew(initial, first), first.id);
      const scooped = scoopFloat(mixed, first.id, first.recipe.float);
      const delayed = advanceService(scooped, 20);
      assert.equal(scoopFreshness(delayed, getOrder(delayed, first.id).cup) === 100, cold);
    }
  }
});

test("automatic sealing waits for every requested step and can resume its timer", () => {
  const initial = day({ day: 17, upgrades: ["auto-sealer"] });
  const order = initial.orders[0];
  const mixed = shakeDrink(build(brew(initial, order), order), order.id);
  assert.equal(getOrder(advanceService(mixed, 1), order.id).cup.sealed, false);
  const ready = foamDrink(mixed, order.id);
  const reaction = advanceService(ready, 0.4);
  const resumed = restoreService(JSON.parse(JSON.stringify(reaction)), 17, false);
  assert.ok(resumed);
  assert.equal(getOrder(resumed, order.id).cup.sealed, false);
  const finished = advanceService(resumed, 0.55);
  assert.equal(getOrder(finished, order.id).cup.sealed, true);
  assert.deepEqual(serviceUsageDelta(ready, finished), {});
  assert.equal(getOrder(advanceService(setIce(ready, order.id, 0), 2), order.id).cup.sealed, false);
});

test("installed prep equipment fills a new cup once and can use available parts when a bin is short", () => {
  const initial = day({ day: 7, upgrades: ["auto-tea", "auto-toppings", "auto-extras"] });
  const ticket = initial.orders[0];
  const prepping = startPearls(initial);
  const pearls = collectPearls(advanceService(prepping, prepping.pearls.target));
  const steeping = startBrew(takeOrder(pearls, ticket.id), ticket.id, "taro", "oat");
  const brewed = advanceService(steeping, getOrder(steeping, ticket.id).cup.brew.target);
  const source = newCampaign("normal");
  const pantry = { ...source, day: 7, status: "open",
    inventory: source.inventory.filter(({ ingredient }) => ingredient !== "mango").map((lot) => ({ ...lot, expiresOn: 16 })) };
  const filled = fillNewBuilds(pantry, steeping, brewed);
  const cup = getOrder(filled.service, ticket.id).cup;
  assert.deepEqual(cup.ingredients, { pearls: 2, "brown-sugar": 3 });
  assert.equal(cup.ice, ticket.recipe.ice);
  assert.equal(filled.service.pearls.ready, pearls.pearls.ready - 2);
  assert.equal(stockCount(pantry, "brown-sugar") - stockCount(filled.campaign, "brown-sugar"), 3);
  assert.deepEqual(fillNewBuilds(filled.campaign, filled.service, filled.service), filled);
});

test("reservations add a small group without replacing normal tickets, even on a packed night", () => {
  const visits = Object.fromEntries(REGULARS.map(({ id }) => [id, 3]));
  assert.equal(reservationForDay(4, false), null);
  for (const expert of [false, true]) {
    const event = balancedEvent({ id: "festival", arrivalMultiplier: 1.35 });
    for (const number of [5, 40]) {
      const options = { day: number, expert, event, activeBranch: "night", upgrades: ["street-sign"], regularVisits: visits };
      const walkIn = day(options);
      const shift = day({ ...options, reserveTable: true });
      const offer = reservationForDay(number, expert);
      assert.deepEqual(shift.reservation, offer);
      assert.deepEqual(shift.orders.filter(({ reservation }) => !reservation), walkIn.orders);
      const group = shift.orders.filter(({ reservation }) => reservation);
      assert.equal(group.length, offer.count);
      assert.equal(new Set(shift.orders.map(({ customerId }) => customerId)).size, shift.orders.length);
      assert.ok(group.every(({ arrivesAt }, index) => arrivesAt === offer.arrivesAt + index * 1.5));
      assert.deepEqual(restoreService(JSON.parse(JSON.stringify(shift)), number, expert), shift);
    }
  }
});

test("the group bonus requires every booked guest to qualify and preserves the target on early close", () => {
  const initial = day({ day: 5, reserveTable: true, event: balancedEvent() });
  const members = initial.orders.filter(({ reservation }) => reservation);
  const offer = initial.reservation;
  const closedEarly = closeServiceDay(initial);
  assert.deepEqual(reservationProgress(closedEarly), { served: 0, qualified: 0, target: offer.count, earned: 0, reward: offer.reward });
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(closedEarly)), 5, false), closedEarly);

  const receipt = (order, quality) => ({ orderId: order.id, quality });
  const oneShort = { ...initial, receipts: [receipt(members[0], 100), receipt(members[1], offer.minQuality - 1)] };
  assert.deepEqual(reservationProgress(oneShort), { served: 2, qualified: 1, target: 2, earned: 0, reward: offer.reward });
  const unrelated = receipt(initial.orders.find(({ reservation }) => !reservation), 100);
  assert.equal(reservationProgress({ ...oneShort, receipts: [...oneShort.receipts, unrelated] }).earned, 0);
  const earned = { ...initial, receipts: members.map((member) => receipt(member, 100)) };
  assert.equal(reservationProgress(earned).earned, offer.reward);
  assert.equal(restoreService({ ...initial, reservation: { ...offer, reward: 999 } }, 5, false), null);
});

test("Expert table delivery waits for all three guests' sealed cups and pays once after reload", () => {
  const shift = day({ day: 5, expert: true, reserveTable: true, event: balancedEvent() });
  const group = shift.orders.filter(({ reservation }) => reservation);
  assert.equal(group.length, 3);
  let prepared = advanceService(shift, group.at(-1).arrivesAt + 1);
  prepared = startPearls(useServicePowerup(prepared, "rush"));
  prepared = startBuns(useServicePowerup(prepared, "rush"));
  const staff = { ...startDay({ ...newCampaign("expert"), day: 5 }).campaign, activeCrew: ["runner"], certifiedCrew: ["runner"] };
  for (const guest of group) {
    assert.equal(serveReservationTable(prepared), prepared);
    prepared = takeOrder(prepared, guest.id);
    prepared = startBrew(useServicePowerup(prepared, "rush"), guest.id, guest.recipe.tea, guest.recipe.milk);
    prepared = useServicePowerup(prepared, "assist", guest.id);
    assert.ok(getOrder(prepared, guest.id).cup?.sealed);
    if (guest !== group.at(-1)) assert.equal(tickCampaignService(staff, prepared, 1.5).service.receipts.length, 0);
  }
  const revived = restoreService(JSON.parse(JSON.stringify(prepared)), 5, true);
  const served = serveReservationTable(revived);
  assert.equal(served.receipts.length, 3);
  assert.equal(reservationProgress(served).earned, shift.reservation.reward);
  assert.equal(serveReservationTable(served), served);
  const automatic = tickCampaignService(staff, revived, 1.25).service;
  assert.equal(automatic.receipts.length, 3);
  assert.ok(automatic.receipts.every(({ handedOffBy }) => handedOffBy === "runner"));
  assert.equal(reservationProgress(automatic).earned, shift.reservation.reward);
});

test("Takeout tickets keep their fixed pickup and pay only for the complete well-made tray", () => {
  const number = 12;
  const offer = cateringOffer(number, true);
  assert.equal(day({ day: number, expert: true, bookCatering: true }).catering, undefined);
  const initial = day({ day: number, expert: true, bookCatering: true, reserveTable: true, upgrades: ["takeout-rack"] });
  assert.equal(initial.catering, offer.id);
  assert.equal(initial.reservation, undefined);
  const cups = initial.orders.filter(({ catering }) => catering);
  assert.deepEqual(cups.map(({ recipe }) => recipe), offer.recipes);
  const closeBeforeArrival = closeServiceDay(initial);
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(closeBeforeArrival)), number, true), closeBeforeArrival);
  const late = advanceService(initial, offer.deadline - 1);
  const quiet = useServicePowerup(late, "quiet");
  const expired = advanceService(quiet, 1.01);
  assert.ok(expired.orders.filter(({ catering }) => catering).every(({ status }) => status === "missed"));
  assert.equal(cateringProgress(expired).earned, 0);

  let work = advanceService(initial, cups.at(-1).arrivesAt + 0.5);
  for (const cup of cups) {
    work = takeOrder(work, cup.id);
    work = startBrew(useServicePowerup(work, "rush"), cup.id, cup.recipe.tea, cup.recipe.milk);
    work = useServicePowerup(work, "assist", cup.id);
    assert.ok(getOrder(work, cup.id).cup?.sealed);
    work = serveOrder(work, cup.id);
    if (cup !== cups.at(-1)) assert.equal(cateringProgress(work).earned, 0);
  }
  assert.ok(work.receipts.every(({ packedAt, tips }) => packedAt !== undefined && tips === 0));
  assert.deepEqual(serviceSummary(work).regularVisits, {});
  const resumed = restoreService(JSON.parse(JSON.stringify(work)), number, true);
  assert.deepEqual(resumed, work);
  assert.equal(cateringProgress(resumed).earned, offer.reward);
});

test("Early prep cooks real stock without advancing guest time, and restores before or after opening", () => {
  for (const expert of [false, true]) {
    const mode = expert ? "expert" : "normal";
    const source = newCampaign(mode);
    const initial = day({ expert, startPrep: true, upgrades: ["opening-key"] });
    const active = startDay(source).campaign;
    const first = initial.orders[0];
    assert.equal(initial.preOpen, expert ? 10 : 14);
    assert.equal(takeOrder(initial, first.id), initial);
    const pot = startPearls(initial);
    const purchase = consumeIngredients(active, serviceUsageDelta(initial, pot));
    assert.equal(stockCount(active, "pearls") - stockCount(purchase.campaign, "pearls"), PREP_YIELDS.pearls);
    const prepped = collectPearls(advanceService(pot, pot.pearls.target));
    assert.equal(prepped.elapsed, 0);
    assert.equal(prepped.pearls.ready, PREP_YIELDS.pearls);
    assert.deepEqual(restoreService(JSON.parse(JSON.stringify(prepped)), 1, expert), prepped);
    const opened = openServiceDoors(prepped);
    assert.equal(opened.preOpen, undefined);
    assert.equal(takeOrder(opened, first.id).orders[0].status, "accepted");
    assert.equal(advanceService(prepped, prepped.preOpen + 0.5).elapsed, 0.5);
    assert.equal(serviceSummary(closeServiceDay(prepped)).missed, 0);
  }
});

test("A real shortage allows one milk swap, persists its recipe and skips signature credit", () => {
  const initial = day({ day: 3 });
  const [order] = initial.orders;
  assert.equal(order.recipe.milk, "oat");
  const stocked = startDay({ ...newCampaign("normal"), day: 3 }).campaign;
  const short = consumeIngredients(stocked, { oat: stockCount(stocked, "oat") }).campaign;
  const accepted = takeOrder(initial, order.id);
  assert.equal(ingredientSwapQuote(stocked, accepted, order.id), null);
  assert.deepEqual(ingredientSwapQuote(short, accepted, order.id), { from: "oat", to: "milk", amount: 1 });
  const agreed = requestIngredientSwap(short, accepted, order.id);
  assert.equal(getOrder(agreed, order.id).recipe.milk, "milk");
  assert.equal(getOrder(accepted, order.id).patience - getOrder(agreed, order.id).patience, 2);
  assert.deepEqual(agreed.usage, accepted.usage);
  assert.equal(requestIngredientSwap(short, agreed, order.id), agreed);
  const resumed = restoreService(JSON.parse(JSON.stringify(agreed)), 3, false);
  let work = startBrew(useServicePowerup(resumed, "rush"), order.id, order.recipe.tea, "milk");
  assert.equal(work.usage.milk, 1);
  work = serveOrder(useServicePowerup(work, "assist", order.id), order.id);
  assert.equal(work.receipts[0].grades.brew, 100);
  assert.deepEqual(serviceRecipeRecords(work), {});
});

test("house blend validates ingredient categories, unlocks, and level ranges", () => {
  const plain = { tea: "black", milk: null, topping: null, fruit: null, syrup: "brown-sugar", sugar: 0, ice: 0 };
  assert.deepEqual(normalizeHouseBlend(plain, 1), plain);
  const blend = { tea: "taro", milk: "oat", topping: "pudding", fruit: "strawberry", syrup: "vanilla", sugar: 2, ice: 1 };
  assert.equal(normalizeHouseBlend(blend, 3), null);
  assert.deepEqual(normalizeHouseBlend(blend, 4), blend);
  assert.equal(normalizeHouseBlend({ ...blend, topping: "banana" }, 5), null);
  assert.equal(normalizeHouseBlend({ ...blend, fruit: "pearls" }, 5), null);
  assert.equal(normalizeHouseBlend({ ...blend, milk: undefined }, 5), null);
  assert.equal(normalizeHouseBlend({ ...blend, ice: 4 }, 5), null);
  assert.deepEqual(recipeFromHouseBlend(blend), {
    name: "House Strawberry Taro Tea", tea: "taro", milk: "oat", toppings: ["pudding"], mixins: ["strawberry"],
    syrup: "vanilla", sugar: 2, ice: 1, bun: false,
  });
});

test("The recipe tin keeps the manual fallback, filters duplicates, and rotates the actual special", () => {
  const manual = { tea: "black", milk: "milk", topping: "pearls", fruit: null, syrup: "honey", sugar: 1, ice: 1 };
  const second = { ...manual, tea: "jasmine", fruit: "yuzu" };
  const sparkle = { ...second, milk: null, sparkling: true };
  const tin = normalizeBlendTin({ presets: [manual, manual, second, sparkle], rotate: true }, 23);
  assert.deepEqual(tin, { presets: [manual, second], rotate: true });
  assert.equal(blendForDay(manual, tin, 23).tea, "black");
  const scheduled = blendForDay(manual, tin, 24);
  const shift = day({ day: 24, upgrades: ["menu-easel"], houseBlend: scheduled });
  assert.equal(shift.orders.find(({ houseBlend }) => houseBlend).recipe.name, "House Yuzu Jasmine Milk Tea");
  const migrated = normalizeBlendTin({ presets: [manual], rotate: true }, 24);
  assert.equal(migrated.rotate, false);
  assert.equal(blendForDay(manual, migrated, 24), manual);
});

test("the Menu Easel adds one house recipe without altering other scheduled specials", () => {
  const houseBlend = { tea: "jasmine", milk: "milk", topping: "pearls", fruit: "banana", syrup: "honey", sugar: 1, ice: 2 };
  const options = {
    day: 6, reserveTable: true, activeBranch: "garden", houseBlend, event: balancedEvent({ id: "book-club" }),
    regularVisits: Object.fromEntries(REGULARS.map(({ id }) => [id, 3])),
  };
  const base = day(options);
  assert.equal(base.orders.filter(({ houseBlend }) => houseBlend).length, 0);
  const shifted = day({ ...options, upgrades: ["menu-easel"] });
  const specials = shifted.orders.filter(({ houseBlend }) => houseBlend);
  assert.equal(specials.length, 1);
  const [houseOrder] = specials;
  assert.ok(REGULARS.find(({ id }) => id === houseOrder.customerId).day < 6);
  assert.deepEqual(shifted.orders.filter(({ id }) => id !== houseOrder.id), base.orders.filter(({ id }) => id !== houseOrder.id));
  assert.deepEqual(houseOrder.recipe, recipeFromHouseBlend(houseBlend));
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(shifted)), 6, false), shifted);
  assert.equal(restoreService({
    ...shifted, orders: shifted.orders.map((order) => order === houseOrder ? { ...order, locationSpecial: "garden" } : order),
  }, 6, false), null);
});

test("mango and grass jelly unlock separately and count toward builds and fruit bonuses", () => {
  assert.equal(unlockedIngredients(6).includes("mango"), false);
  assert.equal(unlockedIngredients(7).includes("mango"), true);
  assert.equal(unlockedIngredients(8).includes("grass-jelly"), false);
  assert.equal(unlockedIngredients(9).includes("grass-jelly"), true);
  const houseBlend = { tea: "jasmine", milk: null, topping: "grass-jelly", fruit: "mango", syrup: "honey", sugar: 2, ice: 3 };
  assert.equal(normalizeHouseBlend(houseBlend, 8), null);
  assert.deepEqual(normalizeHouseBlend(houseBlend, 9), houseBlend);

  const initial = day({ day: 17, event: balancedEvent({ fruitBonus: 90 }), upgrades: ["auto-toppings", "auto-extras"] });
  const [order] = initial.orders;
  assert.equal(order.customerId, "noodle");
  const brewed = brew(initial, order);
  const built = applyServiceExtras(applyServiceToppings(brewed, order.id), order.id);
  assert.deepEqual(serviceUsageDelta(brewed, built), { "grass-jelly": 1, mango: 2, honey: 1 });
  const correct = serve(built, order).receipts[0];
  assert.equal(correct.grades.build, 100);
  const plain = serve({ ...built, effects: { ...built.effects, fruitBonus: 0 } }, order).receipts[0];
  assert.equal(correct.revenue - plain.revenue, 90);
  const short = removeIngredient(built, order.id, "mango");
  assert.ok(serve(short, order).receipts[0].grades.build < 100);
  assert.equal(serve(short, order).receipts[0].revenue,
    serve({ ...short, effects: { ...short.effects, fruitBonus: 0 } }, order).receipts[0].revenue);
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(built)), 17, false), built);
});

test("foam is applied after shaking, consumes the recipe milk, and can be skipped with a grade penalty", () => {
  const first = day({ day: FROTH_DAY });
  const [rye] = first.orders;
  assert.equal(rye.recipe.foam, true);
  assert.equal(foamMilkFor(rye.recipe), "oat");
  const initial = day({ day: 17, event: balancedEvent() });
  const [order] = initial.orders;
  assert.equal(foamMilkFor(order.recipe), "milk");
  const built = build(brew(initial, order), order);
  assert.equal(foamDrink(built, order.id), built);
  const shaken = shakeDrink(built, order.id);
  const foamed = foamDrink(shaken, order.id);
  assert.deepEqual(serviceUsageDelta(shaken, foamed), { milk: 1 });
  assert.equal(foamDrink(foamed, order.id), foamed);
  assert.equal(getOrder(foamed, order.id).cup.foamed, true);
  const edited = setIce(foamed, order.id, 0);
  assert.equal(getOrder(edited, order.id).cup.foamed, false);
  assert.equal(getOrder(edited, order.id).cup.shaken, false);
  assert.deepEqual(edited.usage, foamed.usage);
  const withoutFoam = serve(shaken, order).receipts[0];
  const withFoam = serve(foamed, order).receipts[0];
  assert.equal(withFoam.grades.finish - withoutFoam.grades.finish, 45);
  assert.ok(withFoam.quality > withoutFoam.quality);
  assert.deepEqual(restoreService(JSON.parse(JSON.stringify(foamed)), 17, false), foamed);
});

test("Counter Help applies requested foam atomically with the rest of the build", () => {
  const base = buyPowerup(newCampaign("normal"), "assist").campaign;
  const campaign = startDay({ ...base, day: 17, inventory: base.inventory.map((lot) => ({ ...lot, expiresOn: 18 })) }).campaign;
  const initial = day({ day: 17 });
  const [order] = initial.orders;
  const brewing = brew(initial, order);
  const dairyStock = stockCount(campaign, "milk");
  const depleted = consumeIngredients(campaign, { milk: dairyStock }).campaign;
  const blocked = activateCampaignPowerup(depleted, brewing, "assist", order.id);
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /foam/);
  assert.equal(blocked.campaign, depleted);
  assert.equal(blocked.service, brewing);

  const assisted = activateCampaignPowerup(campaign, brewing, "assist", order.id);
  assert.equal(assisted.ok, true);
  assert.equal(getOrder(assisted.service, order.id).cup.foamed, true);
  assert.equal(getOrder(assisted.service, order.id).cup.sealed, true);
  assert.equal(stockCount(assisted.campaign, "milk"), dairyStock - 1);
  const alreadyFoamed = foamDrink(shakeDrink(build(brewing, order), order.id), order.id);
  assert.equal(activateCampaignPowerup(depleted, alreadyFoamed, "assist", order.id).ok, true);
  const rework = setIce(alreadyFoamed, order.id, 1);
  assert.equal(activateCampaignPowerup(depleted, rework, "assist", order.id).ok, false);
});

test("three good handoffs earn a tasting tray, and spending it boosts only present guests", () => {
  for (const expert of [false, true]) {
    const initial = day({ day: 5, expert, event: balancedEvent() });
    const recipe = RECIPE_BOOK[0].recipe;
    const orders = initial.orders.slice(0, 8).map((order, index) =>
      ({ ...order, recipe, arrivesAt: index === 7 ? 95 : 0, patience: 70, maxPatience: 70 }));
    let work = { ...initial, orders };
    for (const order of orders.slice(0, 3)) work = serve(build(brew(work, order), order), order);
    assert.equal(work.streak, 3);
    assert.equal(work.houseRoundReady, true);
    assert.deepEqual(restoreService(JSON.parse(JSON.stringify(work)), 5, expert), work);

    const served = serveHouseRound(work);
    assert.equal(served.houseRoundReady, false);
    assert.equal(served.houseRoundAt, work.elapsed);
    assert.deepEqual(served.usage, work.usage);
    assert.equal(getOrder(served, orders[3].id).patience, getOrder(work, orders[3].id).patience + (expert ? 3 : 5));
    assert.equal(getOrder(served, orders[0].id), getOrder(work, orders[0].id));
    assert.equal(getOrder(served, orders[7].id), getOrder(work, orders[7].id));
    assert.equal(serveHouseRound(served), served);

    work = served;
    for (const order of orders.slice(3, 6)) work = serve(build(brew(work, order), order), order);
    assert.equal(work.streak, 6);
    assert.equal(work.houseRoundReady, true);
    const waiting = getOrder(work, orders[6].id);
    const missed = advanceService(work, waiting.patience + 0.01);
    assert.equal(missed.streak, 0);
    assert.equal(missed.houseRoundReady, true);
  }
});

test("runner handoffs can earn the tray, a poor cup resets the streak, and old saves default cleanly", () => {
  const activeCrew = ["runner"];
  const initial = day({ day: 5, activeCrew, event: balancedEvent() });
  const campaign = { ...startDay(newCampaign("normal")).campaign, day: 5, activeCrew };
  const recipe = RECIPE_BOOK[0].recipe;
  const orders = initial.orders.slice(0, 4).map((order) => ({ ...order, recipe, arrivesAt: 0, patience: 70, maxPatience: 70 }));
  let work = { ...initial, orders };
  for (const order of orders.slice(0, 3)) {
    const prepared = build(brew(work, order), order);
    const sealed = sealDrink(shakeDrink(prepared, order.id), order.id);
    work = tickCampaignService(campaign, sealed, RUNNER_HANDOFF_SECONDS).service;
  }
  assert.ok(work.receipts.every(({ handedOffBy }) => handedOffBy === "runner"));
  assert.equal(work.houseRoundReady, true);

  const poor = orders[3];
  const incorrect = stopBrew(advanceService(startBrew(takeOrder(work, poor.id), poor.id, "taro", null), 0.5), poor.id);
  const served = serve(incorrect, poor);
  assert.equal(served.streak, 0);
  assert.equal(served.houseRoundReady, true);
  assert.equal(serveHouseRound(served), served);
  const { streak, houseRoundAt, houseRoundReady, ...oldSave } = initial;
  const restored = restoreService(oldSave, 5, false);
  assert.equal(restored.streak, 0);
  assert.equal(restored.houseRoundReady, false);
  assert.equal(restored.houseRoundAt, undefined);
});
