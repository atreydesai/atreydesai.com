import assert from "node:assert/strict";
import test from "node:test";

import {
  BRANCHES, BRANCH_FITTINGS, CREW, DAY_EVENTS, INGREDIENTS, INGREDIENT_UNLOCK_DAYS, LATE_EVENT_DAY, MANAGED_SALE_PRICE, POWERUPS, PROMOTIONS_BOARD, RENT_CYCLE_DAYS, SUPPLIERS, UPGRADES,
  branchPurchasePrice, buyBranch, buyPowerup, buyPublicity, buyStock, buyUpgrade, campaignEffects, certifyCrew, consumeIngredients, crewWages, daysUntilRent,
  eventForDay, finishDay, fitBranch, levelFor, newCampaign, nextExpiry, normalizeCampaign, rentDue,
  certifyLocationManager, hireLocationManager, managerBranches, managerPantryForecast, scheduleLocationManager,
  hireCrew, managerMenu, managerOrderInterval, neighborhoodAwardCount, selectBranch, setCrewActive, setCupPrint, setManagedBranch, setManagerBranch, setStandingOrder, settleManagedBranch, settleManagerBranch, startDay, stockCount, supplierPrice, takeCommission, usePowerup,
} from "../src/lib/arcade/orders-campaign.ts";
import {
  PREP_YIELDS, addIngredient, advanceService, collectBuns, collectPearls, createServiceDay,
  sealDrink, serveOrder, serviceRecipeRecords, serviceSummary, serviceUsageDelta, setIce, shakeDrink, useServicePowerup,
  startBrew, startBuns, startPearls, stopBrew, takeOrder,
} from "../src/lib/arcade/orders-service.ts";

import { shiftContractReward } from "../src/lib/arcade/orders-challenges.ts";

const noSales = { revenue: 0, tips: 0, served: 0, quality: 0 };

test("commissions persist across shifts, pay once, and count toward rent", () => {
  for (const mode of ["normal", "expert"]) {
    const initial = newCampaign(mode);
    assert.equal(takeCommission(initial).ok, false);
    const enrolled = resultOf(takeCommission({ ...initial, day: 5 }));
    assert.equal(takeCommission(enrolled).ok, false);
    const first = resultOf(finishDay(resultOf(startDay(enrolled)), { ...noSales, served: 3, commissionServed: 3 }));
    assert.equal(first.commission.count, 3);
    assert.equal(first.lastDay.commissionReward, 0);
    const recovered = normalizeCampaign(JSON.parse(JSON.stringify(first)), mode);
    assert.equal(recovered.commission.count, 3);
    const target = mode === "expert" ? 6 : 5;
    const payment = mode === "expert" ? 1400 : 1200;
    const due = rentDue(recovered);
    const lastDay = { ...recovered, day: 7, cash: due - payment };
    const closing = resultOf(finishDay(resultOf(startDay(lastDay)), { ...noSales, served: 3, commissionServed: 3 }));
    assert.equal(closing.lastDay.commissionReward, payment);
    assert.equal(closing.lastDay.commissionName, "Library Tea Break");
    assert.equal(closing.lastDay.rent, due);
    assert.equal(closing.status, "planning");
    assert.equal(closing.cash, 0);
    assert.equal(closing.commission, null);
    assert.notEqual(resultOf(takeCommission(closing)).commission.id, enrolled.commission.id);
    assert.equal(finishDay(closing, { ...noSales, served: target, commissionServed: target }).ok, false);
  }
});

function resultOf(result) {
  assert.ok(result.ok, result.message);
  return result.campaign;
}

function endDay(campaign, earnings = noSales) {
  return resultOf(finishDay(resultOf(startDay(campaign)), earnings));
}

test("The rent book totals recorded shifts only, archives the paid month and starts a fresh one", () => {
  let campaign = { ...newCampaign("normal"), day: 5, cash: 22000 };
  for (let day = 5; day <= 7; day++) {
    campaign = endDay(campaign, { revenue: 900, tips: 0, served: 2, quality: 78, cateringBonus: day === 7 ? 850 : 0,
      managerOrders: day === 6 ? 2 : 0, managerSales: day === 6 ? 900 : 0 });
    campaign = normalizeCampaign(JSON.parse(JSON.stringify(campaign)), "normal");
  }
  assert.equal(campaign.rentBook.current, null);
  assert.equal(campaign.rentBook.history.length, 1);
  const month = campaign.rentBook.history[0];
  assert.equal(month.month, 1);
  assert.equal(month.firstDay, 5);
  assert.equal(month.lastDay, 7);
  assert.equal(month.cups, 8);
  assert.equal(month.takings, 4450);
  assert.equal(month.rent, campaign.lastDay.rent);
  assert.equal(month.reserve, campaign.cash);
  assert.equal(month.outcome, "paid");
  const next = endDay(campaign, { revenue: 700, tips: 0, served: 1, quality: 98 });
  assert.equal(next.rentBook.current.month, 2);
  assert.equal(next.rentBook.current.firstDay, 8);
  assert.equal(next.rentBook.current.cups, 1);
  assert.deepEqual(next.rentBook.history, [month]);
});

test("An unpaid rent bill ends the campaign and records a closed month", () => {
  const failed = endDay({ ...newCampaign("expert"), day: 7, cash: 100 });
  assert.equal(failed.status, "closed");
  assert.equal(failed.rentBook.current, null);
  assert.equal(failed.rentBook.history[0].outcome, "closed");
  assert.equal(failed.rentBook.history[0].reserve, 100);
  assert.equal(failed.rentBook.history[0].rent, 0);
});

test("Neighborhood awards stay earned through worse shifts and affect the next drink and shop purchase", () => {
  for (const mode of ["normal", "expert"]) {
    let campaign = newCampaign(mode);
    campaign = { ...campaign, cash: 40000, xp: 400, reputation: 57, highestReputation: 57 };
    const strong = { revenue: 2300, tips: 700, served: 4, quality: 97, missed: 1 };
    campaign = endDay(campaign, strong);
    assert.equal(campaign.lastDay.newAward, 1);
    const firstDay = createServiceDay({ day: campaign.day, expert: mode === "expert", highestReputation: campaign.highestReputation });
    const baseDay = createServiceDay({ day: campaign.day, expert: mode === "expert" });
    assert.ok(firstDay.orders[0].maxPatience > baseDay.orders[0].maxPatience);
    while (campaign.highestReputation < 90) campaign = endDay(campaign, strong);
    assert.equal(campaign.lastDay.newAward, 3);
    campaign = normalizeCampaign(JSON.parse(JSON.stringify(campaign)), mode);
    assert.equal(campaign.lastDay.newAward, 3);
    for (let i = 0; i < 2; i++) campaign = endDay(campaign, { ...noSales, missed: 7 });
    assert.ok(campaign.reputation < 90);
    assert.equal(neighborhoodAwardCount(campaign.highestReputation), 3);
    assert.equal(campaignEffects({ ...campaign, currentEvent: "neighborhood" }).tipMultiplier, 1.08);
    const campus = BRANCHES.find(({ id }) => id === "campus");
    const discounted = branchPurchasePrice(campaign, campus);
    assert.equal(discounted, 6660);
    assert.equal(resultOf(buyBranch(campaign, campus.id)).cash, campaign.cash - discounted);
  }
});

test("The day's fruit sale applies to the quoted and charged supplier price", () => {
  const [market, wholesaler, coop] = SUPPLIERS;
  const starting = newCampaign("expert");
  const street = { ...starting, currentEvent: "market-day" };
  assert.equal(supplierPrice(street, "strawberry", market), 180);
  assert.equal(supplierPrice(street, "milk", market), market.price);
  assert.equal(street.cash - resultOf(buyStock(street, "strawberry", market.id, 3)).cash, 540);
  const harvest = { ...starting, currentEvent: "fruit-special" };
  assert.equal(supplierPrice(harvest, "banana", coop), 527);
  assert.equal(supplierPrice(harvest, "banana", wholesaler), wholesaler.price);
});

test("Crew certifications count qualifying shifts and pay a premium only on duty after reload", () => {
  for (const mode of ["normal", "expert"]) {
    const initial = { ...newCampaign(mode), cash: 50000, xp: 900, upgrades: ["warm-shelf"] };
    const hired = resultOf(setCrewActive(resultOf(hireCrew(initial, "prep")), "prep", true));
    assert.equal(certifyCrew(hired, "prep").ok, false);
    const unsold = endDay(hired);
    assert.equal(unsold.crewShifts.prep, undefined);
    const strong = { revenue: 1900, tips: 400, served: 3, quality: 94 };
    const first = endDay(unsold, strong);
    assert.equal(first.crewShifts.prep, 1);
    assert.equal(certifyCrew(first, "prep").ok, false);
    const second = endDay(first, strong);
    assert.equal(second.crewShifts.prep, 2);
    const passed = resultOf(certifyCrew(second, "prep"));
    const staff = CREW.find(({ id }) => id === "prep");
    assert.equal(second.cash - passed.cash, staff.certificate.price);
    const revived = normalizeCampaign(JSON.parse(JSON.stringify(passed)), mode);
    assert.equal(certifyCrew(revived, "prep").ok, false);
    assert.equal(crewWages(revived), staff.wage + staff.certificate.premium);
    assert.equal(campaignEffects(revived).prepHoldBonus, 23);
    const idle = resultOf(setCrewActive(revived, "prep", false));
    assert.equal(crewWages(idle), 0);
    assert.equal(campaignEffects(idle).prepHoldBonus, 15);
  }
});

test("Renovations apply to that storefront's service and preserve upkeep while another shop is open", () => {
  for (const mode of ["normal", "expert"]) {
    const initial = { ...newCampaign(mode), cash: 30000, xp: 530 };
    assert.equal(fitBranch(initial, "garden").ok, false);
    const garden = resultOf(buyBranch(initial, "garden"));
    const shelf = BRANCH_FITTINGS.garden;
    const fitted = resultOf(fitBranch(garden, "garden"));
    assert.equal(fitted.cash, garden.cash - shelf.price);
    assert.equal(rentDue(fitted), rentDue(garden) + shelf.addedRent);
    assert.equal(fitBranch(fitted, "garden").ok, false);
    const revived = normalizeCampaign(JSON.parse(JSON.stringify(fitted)), mode);
    const main = resultOf(selectBranch(revived, "corner"));
    assert.equal(rentDue(main), rentDue(fitted));
    assert.equal(campaignEffects({ ...main, currentEvent: "fruit-special" }).fruitBonus, 90);
    assert.equal(campaignEffects({ ...revived, currentEvent: "fruit-special" }).fruitBonus, 155);
    const service = createServiceDay({
      day: 12, expert: mode === "expert", activeBranch: revived.activeBranch, branchFittings: revived.branchFittings, event: eventForDay(12),
    });
    assert.equal(service.effects.fruitBonus, shelf.fruitBonus);
  }
});

test("Favorite recipe records unlock prints after real handoffs and keep an unlocked print on reload", () => {
  const seed = { ...newCampaign("normal"), recipeRecords: {
    "Pearl Milk Tea": { best: 98, count: 2 },
    "Black Milk Tea": { best: 97, count: 2 },
    "Brown Sugar Milk Tea": { best: 99, count: 1 },
  } };
  assert.equal(setCupPrint(seed, "plum").ok, false);
  let shift = createServiceDay({ day: 1, expert: false });
  const order = shift.orders[0];
  assert.equal(order.recipe.name, "Brown Sugar Milk Tea");
  shift = takeOrder(shift, order.id);
  shift = startBrew(useServicePowerup(shift, "rush"), order.id, order.recipe.tea, order.recipe.milk);
  shift = serveOrder(useServicePowerup(shift, "assist", order.id), order.id);
  const earned = serviceRecipeRecords(shift);
  assert.equal(earned[order.recipe.name].count, 1);
  assert.equal(earned[order.recipe.name].best, shift.receipts[0].quality);
  const recorded = endDay(seed, { ...serviceSummary(shift), recipeRecords: earned });
  assert.equal(recorded.recipeRecords[order.recipe.name].count, 2);
  const printed = resultOf(setCupPrint(recorded, "plum"));
  assert.equal(normalizeCampaign(JSON.parse(JSON.stringify(printed)), "normal").cupPrint, "plum");
  assert.equal(setCupPrint(resultOf(startDay(printed)), "house").ok, false);
  assert.equal(normalizeCampaign({ ...printed, cupPrint: "ferry" }, "normal").cupPrint, "house");
});

test("Normal uses the same stock and rent systems with a larger margin", () => {
  let campaign = newCampaign("normal");
  const expert = newCampaign("expert");
  const due = rentDue(campaign);
  assert.ok(due > 0 && due < rentDue(expert));
  assert.equal(daysUntilRent(campaign), daysUntilRent(expert));
  for (const { id } of INGREDIENTS) {
    assert.ok(Number.isFinite(stockCount(campaign, id)));
    assert.ok(stockCount(campaign, id) > stockCount(expert, id));
    assert.ok(nextExpiry(campaign, id) > nextExpiry(expert, id));
  }
  campaign = resultOf(buyStock(campaign, "milk", "market"));
  campaign = resultOf(buyPowerup(campaign, "supplies"));
  const startingCash = campaign.cash;
  const milk = stockCount(campaign, "milk");
  campaign = resultOf(startDay(campaign));
  campaign = resultOf(consumeIngredients(campaign, { milk }));
  assert.equal(stockCount(campaign, "milk"), 0);
  campaign = resultOf(usePowerup(campaign, "supplies"));
  assert.equal(stockCount(campaign, "milk"), 4);
  campaign = resultOf(finishDay(campaign, noSales));
  assert.equal(stockCount(campaign, "milk"), 0);
  for (let day = 2; day <= RENT_CYCLE_DAYS; day += 1) campaign = endDay(campaign);
  assert.equal(campaign.day, RENT_CYCLE_DAYS + 1);
  assert.equal(campaign.rentPaid, 1);
  assert.equal(campaign.cash, startingCash - due);
});

test("An open older Normal shift can finish and then receives its first finite inventory", () => {
  const legacy = { ...newCampaign("normal"), version: 1, day: 7, status: "open", cash: 100, inventory: [] };
  const campaign = normalizeCampaign(legacy, "normal");
  assert.equal(stockCount(campaign, "milk"), Infinity);
  assert.deepEqual(normalizeCampaign(campaign, "normal"), campaign);
  const settled = resultOf(finishDay(campaign, noSales));
  assert.equal(settled.day, 8);
  assert.equal(settled.cash, 100);
  assert.equal(settled.legacyUnlimitedStock, false);
  assert.equal(settled.rentBook.history[0].outcome, "waived");
  assert.equal(endDay(settled).rentBook.history[0].lastDay, 7);
  assert.equal(stockCount(settled, "milk"), stockCount(newCampaign("normal"), "milk"));
  const planning = normalizeCampaign({ ...legacy, status: "planning" }, "normal");
  assert.equal(stockCount(planning, "milk"), stockCount(settled, "milk"));
});

test("Crew and branches persist in both modes and settle their costs once", () => {
  for (const mode of ["normal", "expert"]) {
    let campaign = { ...newCampaign(mode), cash: 30000, xp: 1000 };
    const liveCrew = CREW.filter(({ id }) => id !== "manager");
    for (const worker of liveCrew) {
      campaign = resultOf(hireCrew(campaign, worker.id));
      assert.equal(hireCrew(campaign, worker.id).ok, false);
      campaign = resultOf(setCrewActive(campaign, worker.id, true));
    }
    const wages = crewWages(campaign);
    assert.equal(wages, liveCrew.reduce((sum, worker) => sum + worker.wage, 0));
    assert.equal(startDay({ ...campaign, cash: wages - 1 }).ok, false);
    const baseRent = rentDue(campaign);
    campaign = resultOf(buyBranch(campaign, "garden"));
    assert.equal(buyBranch(campaign, "garden").ok, false);
    assert.ok(rentDue(campaign) > baseRent);
    const expandedRent = rentDue(campaign);
    campaign = resultOf(selectBranch(campaign, "corner"));
    assert.equal(rentDue(campaign), expandedRent);
    campaign = resultOf(selectBranch(campaign, "garden"));
    assert.equal(campaignEffects(campaign).prepMultiplier, 0.75);
    assert.equal(campaignEffects(campaign).serveBonus, 90);
    assert.ok(campaignEffects(campaign).patienceMultiplier > 1.2);
    const branch = BRANCHES.find(({ id }) => id === "garden");
    const before = campaign.cash;
    campaign = endDay(campaign, { revenue: 1000, tips: 0, served: 2, quality: 91, contractBonus: 250, reservationBonus: 150 });
    assert.equal(campaign.lastDay.wages, wages);
    assert.equal(campaign.lastDay.branchIncome, branch.income * 2);
    assert.equal(campaign.lastDay.contractBonus, 250);
    assert.equal(campaign.lastDay.reservationBonus, 150);
    assert.equal(campaign.cash, before + 1400 + branch.income * 2 - wages);
    assert.deepEqual(normalizeCampaign(campaign, mode), campaign);
  }
});

test("An owned side stand shares the runner and sells only stocked orders within the shift", () => {
  for (const mode of ["normal", "expert"]) {
    const initial = { ...newCampaign(mode), cash: 30000, xp: 400 };
    const expanded = resultOf(buyBranch(initial, "campus"));
    assert.equal(setManagedBranch(expanded, "corner").ok, false);
    const hired = resultOf(hireCrew(expanded, "runner"));
    const rostered = resultOf(setCrewActive(hired, "runner", true));
    assert.equal(setManagedBranch(rostered, "campus").ok, false);
    assert.equal(setManagedBranch(rostered, "garden").ok, false);
    const assigned = resultOf(setManagedBranch(rostered, "corner"));
    assert.equal(crewWages(assigned), crewWages(rostered));
    assert.equal(campaignEffects(assigned).serveBonus, 0);
    assert.deepEqual(normalizeCampaign({ ...assigned, activeCrew: ["runner"] }, mode), assigned);
    assert.equal(normalizeCampaign({ ...assigned, crew: [] }, mode).managedBranch, null);
    const switched = resultOf(selectBranch(assigned, "corner"));
    assert.equal(switched.managedBranch, null);
    assert.ok(switched.activeCrew.includes("runner"));
    assert.equal(resultOf(setCrewActive(assigned, "runner", true)).managedBranch, null);
    const opened = resultOf(startDay(assigned));
    assert.equal(setManagedBranch(opened, null).ok, false);
    assert.equal(settleManagedBranch(opened, 0).campaign, opened);
    assert.equal(settleManagedBranch(opened, 100).orders, mode === "normal" ? 4 : 3);
    assert.equal(settleManagedBranch(opened, 500).orders, 4);

    const fewMilk = { ...opened, inventory: opened.inventory.map((lot) => lot.ingredient === "milk" ? { ...lot, quantity: 2 } : lot) };
    const result = settleManagedBranch(fewMilk, 100);
    assert.equal(result.orders, 2);
    assert.equal(result.sales, 2 * MANAGED_SALE_PRICE);
    assert.equal(result.campaign.cash, opened.cash);
    assert.equal(stockCount(result.campaign, "milk"), 0);
    assert.equal(stockCount(result.campaign, "black"), stockCount(opened, "black") - 2);
    const settled = resultOf(finishDay(result.campaign, { ...noSales, managedSales: result.sales, managedOrders: result.orders }));
    assert.equal(settled.lastDay.managedOrders, 2);
    assert.equal(settled.lastDay.managedSales, result.sales);
    assert.equal(settled.cash, opened.cash + result.sales - crewWages(assigned));
    assert.equal(settled.xp, opened.xp);
    assert.deepEqual(normalizeCampaign(settled, mode), settled);
  }
});

test("A Branch Manager runs a third location and shares pantry and payroll with the runner", () => {
  for (const mode of ["normal", "expert"]) {
    const initial = { ...newCampaign(mode), cash: 45000, xp: 510, day: 3 };
    assert.equal(hireCrew({ ...initial, xp: 509 }, "manager").ok, false);
    const expanded = resultOf(buyBranch(resultOf(buyBranch(initial, "campus")), "garden"));
    assert.equal(setManagerBranch(expanded, "corner").ok, false);
    const runner = resultOf(hireCrew(expanded, "runner"));
    const hired = resultOf(hireCrew(runner, "manager"));
    assert.equal(hired.cash, runner.cash - 5200);
    assert.equal(setCrewActive(hired, "manager", true).ok, false);
    const sideStand = resultOf(setManagedBranch(hired, "campus"));
    assert.equal(setManagerBranch(sideStand, "campus").ok, false);
    assert.equal(setManagerBranch(sideStand, "garden").ok, false);
    assert.equal(setManagerBranch(sideStand, "night").ok, false);
    const staffed = resultOf(setManagerBranch(sideStand, "corner"));
    assert.equal(setManagedBranch(staffed, "corner").ok, false);
    assert.equal(crewWages(staffed), 520);
    assert.deepEqual(normalizeCampaign({ ...staffed, activeCrew: ["manager"] }, mode), staffed);
    const oldSave = { ...staffed };
    delete oldSave.managerBranch;
    assert.equal(normalizeCampaign(oldSave, mode).managerBranch, null);
    assert.equal(normalizeCampaign({ ...staffed, managerBranch: "campus" }, mode).managerBranch, null);
    const switched = resultOf(selectBranch(staffed, "corner"));
    assert.equal(switched.managerBranch, null);
    assert.equal(switched.managedBranch, "campus");
    assert.equal(crewWages(switched), 210);
    const prepared = {
      ...staffed, inventory: staffed.inventory.map((lot) => lot.ingredient === "milk" ? { ...lot, quantity: 5 } : lot),
    };
    const opened = resultOf(startDay(prepared));
    assert.equal(setManagerBranch(opened, null).ok, false);
    assert.equal(settleManagerBranch(opened, managerOrderInterval(mode) - 1).orders, 0);
    assert.equal(settleManagerBranch(opened, 999).orders, 4);

    const runnerShift = settleManagedBranch(opened, 100);
    const managerShift = settleManagerBranch(runnerShift.campaign, 100);
    assert.equal(managerShift.orders, 5 - runnerShift.orders);
    assert.equal(managerShift.sales, managerShift.orders * managerMenu("corner").price);
    assert.equal(stockCount(managerShift.campaign, "milk"), 0);
    assert.equal(stockCount(managerShift.campaign, "black"), stockCount(opened, "black") - 5);
    const earnings = { ...noSales, managedOrders: runnerShift.orders, managedSales: runnerShift.sales, managerOrders: managerShift.orders, managerSales: managerShift.sales };
    const settled = resultOf(finishDay(managerShift.campaign, earnings));
    assert.equal(settled.lastDay.managerOrders, managerShift.orders);
    assert.equal(settled.lastDay.managerSales, managerShift.sales);
    assert.equal(settled.cash, opened.cash + runnerShift.sales + managerShift.sales - 520);
    assert.equal(settled.xp, opened.xp);
    assert.deepEqual(normalizeCampaign(settled, mode), settled);
    const closed = resultOf(finishDay({ ...opened, day: 7, cash: 0 }, noSales));
    assert.equal(closed.status, "closed");
    assert.equal(closed.managerBranch, null);
  }
});

test("Each owned shop can hire a manager with separate wages and training on one shared pantry", () => {
  for (const mode of ["normal", "expert"]) {
    const base = newCampaign(mode);
    const initial = { ...base, day: 16, currentEvent: eventForDay(16).id, cash: 300000, xp: 2350,
      inventory: base.inventory.map((lot) => ({ ...lot, expiresOn: 30 })) };
    const owned = BRANCHES.slice(1).reduce((campaign, { id }) => resultOf(buyBranch(campaign, id)), initial);
    const hires = owned.branches.filter((id) => id !== owned.activeBranch);
    const staffed = hires.reduce((campaign, id) => resultOf(hireLocationManager(campaign, id)), owned);
    assert.deepEqual(managerBranches(staffed), hires);
    assert.equal(staffed.cash, owned.cash - 6 * 5200);
    assert.equal(crewWages(staffed), 6 * 310);
    assert.equal(hireLocationManager(staffed, "corner").ok, false);
    assert.equal(hireLocationManager(owned, owned.activeBranch).ok, false);
    assert.equal(startDay({ ...staffed, cash: 6 * 310 - 1 }).ok, false);
    assert.deepEqual(normalizeCampaign(JSON.parse(JSON.stringify(staffed)), mode), staffed);

    const benched = resultOf(scheduleLocationManager(staffed, "campus", false));
    assert.equal(crewWages(benched), 5 * 310);
    const visit = resultOf(selectBranch(staffed, "corner"));
    assert.equal(managerBranches(visit).includes("corner"), false);
    assert.equal(crewWages(visit), 5 * 310);
    assert.deepEqual(managerBranches(resultOf(selectBranch(visit, "loft"))), hires);

    const shared = { ...staffed, inventory: [
      { id: 1, ingredient: "black", quantity: 5, expiresOn: 18 },
      { id: 2, ingredient: "milk", quantity: 4, expiresOn: 18 },
    ] };
    const forecast = managerPantryForecast(shared);
    assert.equal(forecast.find(({ branch }) => branch === "corner").orders, 4);
    assert.equal(forecast.find(({ branch }) => branch === "station").orders, 1);
    assert.equal(stockCount(shared, "black"), 5);
    const opened = resultOf(startDay(shared));
    const remote = settleManagerBranch(opened, 120);
    assert.equal(remote.orders, 5);
    assert.equal(remote.sales, 4 * managerMenu("corner").price + managerMenu("station").price);
    assert.equal(stockCount(remote.campaign, "black"), 0);
    assert.equal(remote.campaign.locationManagers.corner.shifts, 1);
    assert.equal(remote.campaign.locationManagers.campus.shifts, 0);
    const closing = resultOf(finishDay(remote.campaign, { ...noSales, managerOrders: remote.orders, managerSales: remote.sales }));
    assert.equal(closing.lastDay.wages, 1860);
    assert.equal(closing.cash, opened.cash + remote.sales - 1860);

    const experienced = { ...closing, locationManagers: {
      ...closing.locationManagers, corner: { ...closing.locationManagers.corner, shifts: 2 },
    } };
    const certified = resultOf(certifyLocationManager(experienced, "corner"));
    assert.equal(crewWages(certified), 6 * 310 + 75);
    assert.equal(certified.locationManagers.campus.certified, false);
    assert.deepEqual(normalizeCampaign(JSON.parse(JSON.stringify(certified)), mode), certified);
  }
});

test("A plain location menu needs only its own tea", () => {
  const campaign = {
    ...newCampaign("expert"), day: 3, status: "open", crew: ["manager"], branches: ["corner", "campus"], managerBranch: "campus",
    inventory: [{ id: 1, ingredient: "jasmine", quantity: 4, expiresOn: 8 }],
  };
  assert.equal(managerMenu("campus").milk, null);
  assert.equal(settleManagerBranch(campaign, 100).orders, 4);
});

test("A single publicity purchase lasts through the shift and settles without a second charge", () => {
  for (const mode of ["normal", "expert"]) {
    const initial = newCampaign(mode);
    assert.equal(buyPublicity(initial, "loyalty-stamps").ok, false);
    assert.equal(buyPublicity({ ...initial, xp: 185, cash: 0 }, "loyalty-stamps").ok, false);
    const stampDrive = PROMOTIONS_BOARD.find(({ id }) => id === "loyalty-stamps");
    const booked = resultOf(buyPublicity({ ...initial, xp: 185 }, stampDrive.id));
    assert.equal(booked.cash, initial.cash - stampDrive.price);
    assert.equal(buyPublicity(booked, "fruit-chalkboard").ok, false);
    assert.deepEqual(normalizeCampaign(booked, mode), booked);
    const opened = resultOf(startDay(booked));
    assert.deepEqual(normalizeCampaign(opened, mode), opened);
    assert.equal(buyPublicity(opened, "loyalty-stamps").ok, false);
    const settled = resultOf(finishDay(opened, { ...noSales, tips: 400 }));
    assert.equal(settled.publicity, null);
    assert.equal(settled.lastDay.publicityCost, stampDrive.price);
    assert.equal(settled.cash, booked.cash + Math.round(400 * stampDrive.tipMultiplier));
    assert.ok(buyPublicity(settled, "loyalty-stamps").ok);
  }
});

test("Publicity combines with events and invalid saved promotions are discarded", () => {
  const initial = { ...newCampaign("normal"), xp: 185, currentEvent: "fruit-special" };
  const event = DAY_EVENTS.find(({ id }) => id === initial.currentEvent);
  const chalkboard = PROMOTIONS_BOARD.find(({ id }) => id === "fruit-chalkboard");
  const chalk = resultOf(buyPublicity(initial, chalkboard.id));
  assert.equal(campaignEffects(chalk).fruitBonus, event.fruitBonus + chalkboard.fruitBonus);
  const samples = PROMOTIONS_BOARD.find(({ id }) => id === "sidewalk-samples");
  const sampleDay = resultOf(buyPublicity(initial, samples.id));
  assert.equal(campaignEffects(sampleDay).arrivalMultiplier, event.arrivalMultiplier * samples.arrivalMultiplier);
  assert.equal(campaignEffects(sampleDay).patienceMultiplier, event.patienceMultiplier * samples.patienceMultiplier);
  assert.equal(normalizeCampaign({ ...initial, publicity: "unknown" }, "normal").publicity, null);
  assert.equal(normalizeCampaign({ ...sampleDay, status: "closed" }, "normal").publicity, null);
});

test("The Supplier Ledger places one canonical crate after arrival and expiry processing", () => {
  for (const mode of ["normal", "expert"]) {
    const initial = { ...newCampaign(mode), day: 3, xp: 185, inventory: [], cash: 9000 };
    assert.equal(setStandingOrder(initial, "black", "market").ok, false);
    const equipped = resultOf(buyUpgrade(initial, "supplier-ledger"));
    assert.equal(equipped.cash, initial.cash - 3150);
    let configured = resultOf(setStandingOrder(equipped, "black", "market"));
    configured = resultOf(setStandingOrder(configured, "milk", "cooperative"));
    configured = resultOf(setStandingOrder(configured, "honey", "wholesaler"));
    configured = resultOf(setStandingOrder(configured, "pearls", "market"));
    assert.equal(setStandingOrder(configured, "mango", "market").ok, false);
    assert.equal(setStandingOrder(configured, "bun", "market").ok, false);
    assert.equal(setStandingOrder(resultOf(startDay(configured)), "black", null).ok, false);
    const manuallyOrdered = resultOf(buyStock(resultOf(buyStock(configured, "milk", "cooperative")), "honey", "wholesaler"));
    const before = {
      ...manuallyOrdered, inventory: [
        { id: 4, ingredient: "black", quantity: 10, expiresOn: 4 },
        { id: 5, ingredient: "pearls", quantity: 4, expiresOn: 6 },
      ],
    };
    const next = endDay(before);
    const market = SUPPLIERS.find(({ id }) => id === "market");
    assert.equal(next.lastDay.expired, 10);
    assert.equal(next.lastDay.standingOrders, 1);
    assert.equal(next.lastDay.standingSpent, market.price);
    assert.equal(next.cash, before.cash - market.price);
    assert.equal(next.deliveries.length, 1);
    assert.equal(next.deliveries[0].ingredient, "milk");
    assert.equal(stockCount(next, "black"), market.batchSize);
    assert.equal(stockCount(next, "honey"), 16);
    assert.deepEqual(normalizeCampaign(next, mode), next);
  }
});

test("Standing orders preserve the next payroll and approaching rent", () => {
  const initial = { ...newCampaign("expert"), day: 5, xp: 185, inventory: [], cash: 30000 };
  const equipped = resultOf(buyUpgrade(initial, "supplier-ledger"));
  const staffing = resultOf(setCrewActive(resultOf(hireCrew(equipped, "host")), "host", true));
  let configured = resultOf(setStandingOrder(staffing, "black", "market"));
  configured = resultOf(setStandingOrder(configured, "milk", "market"));
  const market = SUPPLIERS.find(({ id }) => id === "market");
  const reserve = crewWages(configured) + rentDue(configured);
  const next = endDay({ ...configured, cash: crewWages(configured) + reserve + market.price + 1 });
  assert.equal(next.day, 6);
  assert.equal(next.lastDay.standingOrders, 1);
  assert.equal(next.cash, reserve + 1);
  assert.equal(stockCount(next, "milk"), 0);
  const withPayrollOnly = endDay({ ...configured, day: 3, cash: crewWages(configured) * 2 + market.price - 1 });
  assert.equal(withPayrollOnly.lastDay.standingOrders, 0);
  const closed = endDay({ ...configured, day: 7, cash: crewWages(configured) });
  assert.equal(closed.status, "closed");
  assert.equal(closed.lastDay.standingOrders, 0);
  assert.equal(closed.lastDay.standingSpent, 0);
});

test("Restoring a supplier ledger rejects unowned, invalid, locked, and excess entries", () => {
  const campaign = { ...newCampaign("normal"), day: 3, xp: 185 };
  const saved = { black: "market", milk: "cooperative", jasmine: "wholesaler", taro: "market", oat: "cooperative", "grass-jelly": "market", bunny: "market" };
  assert.deepEqual(normalizeCampaign({ ...campaign, standingOrders: saved }, "normal").standingOrders, {});
  const installed = resultOf(buyUpgrade(campaign, "supplier-ledger"));
  const restored = normalizeCampaign({ ...installed, standingOrders: saved }, "normal");
  assert.deepEqual(restored.standingOrders, { black: "market", jasmine: "wholesaler", taro: "market", milk: "cooperative" });
  const changed = resultOf(setStandingOrder(restored, "black", "cooperative"));
  assert.equal(changed.standingOrders.black, "cooperative");
  const cleared = resultOf(setStandingOrder(changed, "black", null));
  assert.equal(cleared.standingOrders.black, undefined);
  assert.equal(setStandingOrder(cleared, "grass-jelly", "market").ok, false);
  assert.equal(setStandingOrder(cleared, "honey", "bogus").ok, false);
});

test("Expert stock has distinct supplier prices, transit times and shelf life", () => {
  const market = SUPPLIERS.find(({ id }) => id === "market");
  const wholesale = SUPPLIERS.find(({ id }) => id === "wholesaler");
  const coOp = SUPPLIERS.find(({ id }) => id === "cooperative");
  const strawberries = INGREDIENTS.find(({ id }) => id === "strawberry");
  assert.ok(wholesale.price / wholesale.batchSize < market.price / market.batchSize);
  let campaign = newCampaign("expert");
  const opening = stockCount(campaign, "strawberry");

  campaign = resultOf(buyStock(campaign, "strawberry", market.id));
  assert.equal(stockCount(campaign, "strawberry"), opening + market.batchSize);
  campaign = resultOf(buyStock(campaign, "strawberry", wholesale.id, 2));
  campaign = resultOf(buyStock(campaign, "strawberry", coOp.id));
  assert.equal(campaign.cash, newCampaign("expert").cash - market.price - 2 * wholesale.price - coOp.price);
  assert.equal(stockCount(campaign, "strawberry"), opening + market.batchSize);
  assert.equal(buyStock(campaign, "strawberry", market.id, 1.5).campaign, campaign);
  assert.equal(buyStock(campaign, "strawberry", market.id, 100).campaign, campaign);

  campaign = endDay(campaign);
  assert.equal(stockCount(campaign, "strawberry"), opening + market.batchSize + 2 * wholesale.batchSize);
  assert.equal(campaign.deliveries.length, 1);
  campaign = endDay(campaign);
  assert.equal(stockCount(campaign, "strawberry"), opening + market.batchSize + 2 * wholesale.batchSize + coOp.batchSize);
  assert.equal(campaign.deliveries.length, 0);
  assert.equal(campaign.inventory.at(-1).expiresOn, 3 + strawberries.shelfLife + coOp.shelfLifeBonus);

  campaign = endDay(campaign);
  assert.ok(campaign.lastDay.expired >= opening + market.batchSize);
  assert.equal(stockCount(campaign, "strawberry"), 2 * wholesale.batchSize + coOp.batchSize);
  assert.equal(nextExpiry(campaign, "strawberry"), 2 + strawberries.shelfLife);
});

test("Mango and grass jelly have stock on their debut and can be ordered in older saves", () => {
  for (const [id, unlockDay] of [["mango", 7], ["grass-jelly", 9]]) {
    assert.equal(INGREDIENT_UNLOCK_DAYS[id], unlockDay);
    for (const mode of ["normal", "expert"]) {
      const starting = { ...newCampaign(mode), day: unlockDay };
      assert.ok(stockCount(starting, id) > 0);
      const legacyInventory = starting.inventory.filter(({ ingredient }) => !["mango", "grass-jelly"].includes(ingredient));
      const loaded = normalizeCampaign({ ...starting, inventory: legacyInventory }, mode);
      assert.equal(stockCount(loaded, id), 0);
      const restocked = resultOf(buyStock(loaded, id, "market"));
      const opened = resultOf(startDay(restocked));
      const used = resultOf(consumeIngredients(opened, { [id]: 1 }));
      assert.equal(stockCount(used, id), stockCount(restocked, id) - 1);
    }
  }
});

test("An Expert recipe consumes soonest-expiring stock atomically", () => {
  const first = { id: 1, ingredient: "black", quantity: 2, expiresOn: 4 };
  const second = { id: 20, ingredient: "black", quantity: 3, expiresOn: 6 };
  const oldest = { id: 21, ingredient: "black", quantity: 2, expiresOn: 2 };
  let campaign = resultOf(startDay({ ...newCampaign("expert"), inventory: [first, second, oldest] }));
  assert.equal(nextExpiry(campaign, "black"), 2);
  const unavailable = consumeIngredients(campaign, { black: 3, milk: 1 });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.campaign, campaign);
  assert.equal(consumeIngredients(campaign, { black: -1 }).campaign, campaign);
  assert.equal(stockCount(campaign, "black"), 7);
  campaign = resultOf(consumeIngredients(campaign, { black: 3 }));
  assert.deepEqual(campaign.inventory, [{ ...first, quantity: 1 }, second]);
  assert.equal(nextExpiry(campaign, "black"), 4);
  assert.equal(stockCount(campaign, "black"), 4);
  assert.equal(oldest.quantity, 2);
});

test("Expert rent uses the day's receipts and closes the shop if it is one cent short", () => {
  let campaign = newCampaign("expert");
  for (let day = 1; day < RENT_CYCLE_DAYS; day += 1) {
    assert.equal(daysUntilRent(campaign), RENT_CYCLE_DAYS - day);
    campaign = endDay(campaign);
  }
  assert.equal(daysUntilRent(campaign), 0);
  const due = rentDue(campaign);
  const short = endDay(campaign, { ...noSales, revenue: due - campaign.cash - 1 });
  assert.equal(short.status, "closed");
  assert.equal(short.day, RENT_CYCLE_DAYS);
  assert.equal(short.cash, due - 1);
  assert.equal(short.lastDay.rent, 0);
  assert.equal(short.lastDay.rentOwed, due);
  assert.match(short.lastDay.reason, /rent/);
  assert.equal(startDay(short).ok, false);
  assert.equal(buyStock(short, "milk", "market").ok, false);

  const paid = endDay(campaign, { ...noSales, revenue: due - campaign.cash });
  assert.equal(paid.status, "planning");
  assert.equal(paid.day, RENT_CYCLE_DAYS + 1);
  assert.equal(paid.cash, 0);
  assert.equal(paid.lastDay.rent, due);
  assert.equal(paid.rentPaid, 1);
  assert.ok(rentDue(paid) > due);
});

test("Closing a day applies stronger event tips once and promotes players from service", () => {
  let campaign = newCampaign("normal");
  const tipDay = Array.from({ length: DAY_EVENTS.length + 1 }, (_, index) => index + 1)
    .find((day) => eventForDay(day).tipMultiplier === 1.5);
  for (let day = 1; day < tipDay; day += 1) campaign = endDay(campaign);
  assert.equal(campaign.currentEvent, eventForDay(campaign.day).id);
  assert.equal(campaignEffects(campaign).tipMultiplier, 1.5);
  const openingCash = campaign.cash;
  const earnings = { revenue: 2800, tips: 330, served: 5, quality: 94, missed: 1, regularVisits: { mochi: 2 } };
  campaign = endDay(campaign, earnings);
  assert.equal(campaign.lastDay.tips, 495);
  assert.equal(campaign.cash, openingCash + 2800 + 495 - campaign.lastDay.rent);
  assert.equal(levelFor(campaign), 2);
  assert.equal(campaign.lastDay.level, 2);
  assert.ok(campaign.lastDay.promotion);
  assert.equal(campaign.regularVisits.mochi, 2);
  assert.equal(finishDay(campaign, earnings).campaign, campaign);
  campaign = endDay(campaign, { ...noSales, regularVisits: { mochi: 1, tofu: 1 } });
  assert.deepEqual(campaign.regularVisits, { mochi: 3, tofu: 1 });
});

test("Events vary deterministically and the sign trades patience for foot traffic", () => {
  assert.equal(eventForDay(1).arrivalMultiplier, 1);
  const earlyCount = DAY_EVENTS.filter(({ id }) => !["candlelight", "bottle-return"].includes(id)).length;
  const draw = (start, count) => Array.from({ length: count }, (_, index) => eventForDay(start + index).id);
  assert.deepEqual(draw(2, earlyCount), draw(2, earlyCount));
  assert.notDeepEqual(draw(2, earlyCount), draw(2 + earlyCount, earlyCount));
  assert.equal(new Set(draw(2, earlyCount)).size, earlyCount);
  assert.equal(new Set(draw(LATE_EVENT_DAY, DAY_EVENTS.length)).size, DAY_EVENTS.length);
  assert.ok(!draw(2, LATE_EVENT_DAY - 2).some((id) => ["candlelight", "bottle-return"].includes(id)));
  assert.ok(DAY_EVENTS.some(({ tipMultiplier }) => tipMultiplier < 1));
  assert.ok(DAY_EVENTS.some(({ fruitBonus }) => fruitBonus > 0));
  const effects = campaignEffects({ currentEvent: eventForDay(1).id, upgrades: ["street-sign"] });
  assert.equal(effects.arrivalMultiplier, 1.15);
  assert.equal(effects.patienceMultiplier, 0.94);
});

test("Late event sales charge the seltzer quote and keep a resumed shift's scheduled event", () => {
  const campaign = { ...newCampaign("expert"), day: LATE_EVENT_DAY, currentEvent: "bottle-return" };
  const market = SUPPLIERS.find(({ id }) => id === "market");
  assert.equal(supplierPrice(campaign, "seltzer", market), 180);
  assert.equal(campaign.cash - resultOf(buyStock(campaign, "seltzer", "market")).cash, 180);
  assert.equal(supplierPrice(campaign, "strawberry", market), 240);
  const saved = normalizeCampaign(resultOf(startDay(campaign)), "expert");
  assert.equal(saved.currentEvent, "bottle-return");
});

test("Level-gated upgrades are permanent and purchased powerups are disposable", () => {
  let campaign = newCampaign("normal");
  assert.equal(buyUpgrade(campaign, "auto-tea").ok, false);
  assert.equal(buyPowerup(campaign, "quality").ok, false);
  campaign = endDay(campaign, { revenue: 3500, tips: 200, served: 6, quality: 90 });
  const tea = UPGRADES.find(({ id }) => id === "auto-tea");
  const patience = POWERUPS.find(({ id }) => id === "patience");
  const openingCash = campaign.cash;
  campaign = resultOf(buyUpgrade(campaign, tea.id));
  assert.equal(buyUpgrade(campaign, tea.id).ok, false);
  assert.equal(campaignEffects(campaign).autoTea, true);
  campaign = resultOf(buyPowerup(campaign, patience.id));
  assert.equal(campaign.cash, openingCash - tea.price - patience.price);
  assert.equal(usePowerup(campaign, patience.id).ok, false);
  campaign = resultOf(startDay(campaign));
  campaign = resultOf(usePowerup(campaign, patience.id));
  assert.equal(campaign.powerups.patience, 0);
  assert.deepEqual(campaign.activePowerups, ["patience"]);
  assert.equal(usePowerup(campaign, patience.id).ok, false);
  campaign = resultOf(finishDay(campaign, noSales));
  assert.equal(campaignEffects(campaign).autoTea, true);
  assert.deepEqual(campaign.activePowerups, []);
});

test("The Menu Easel unlocks at level three and stays installed after reload", () => {
  for (const mode of ["normal", "expert"]) {
    const initial = newCampaign(mode);
    assert.equal(buyUpgrade({ ...initial, xp: 184 }, "menu-easel").ok, false);
    const installed = resultOf(buyUpgrade({ ...initial, xp: 185 }, "menu-easel"));
    assert.equal(installed.cash, initial.cash - 3200);
    assert.equal(buyUpgrade(installed, "menu-easel").ok, false);
    assert.ok(normalizeCampaign(installed, mode).upgrades.includes("menu-easel"));
  }
});

test("A saved Expert campaign round-trips during service and invalid saves fall back safely", () => {
  let campaign = newCampaign("expert");
  campaign = resultOf(buyStock(campaign, "honey", "wholesaler"));
  campaign = resultOf(buyPowerup(campaign, "patience"));
  campaign = resultOf(startDay(campaign));
  campaign = resultOf(usePowerup(campaign, "patience"));
  campaign = resultOf(consumeIngredients(campaign, { milk: 1, black: 1 }));
  const saved = JSON.parse(JSON.stringify(campaign));
  assert.deepEqual(normalizeCampaign(saved, "expert"), campaign);
  assert.deepEqual(normalizeCampaign(saved, "normal"), newCampaign("normal"));
  assert.deepEqual(normalizeCampaign({ ...saved, version: 999 }, "expert"), newCampaign("expert"));
  const duplicate = saved.inventory[0];
  const malformed = { ...saved, inventory: [...saved.inventory, duplicate, { ...duplicate, id: 90, expiresOn: 1 }], nextId: 1 };
  assert.deepEqual(normalizeCampaign(malformed, "expert"), campaign);
});

function playCampaign(mode, ordersForDay) {
  const initial = newCampaign(mode);
  let campaign = initial;
  let spent = 0;
  let expired = 0;
  let gross = 0;
  let rent = 0;
  let firstAffordableBranch = null;
  for (let day = 1; day <= RENT_CYCLE_DAYS * 2; day += 1) {
    let shift = createServiceDay({ day, expert: mode === "expert", regularVisits: campaign.regularVisits });
    const orders = shift.orders.slice(0, ordersForDay(day));
    const needed = new Map();
    const count = (id, amount = 1) => needed.set(id, (needed.get(id) ?? 0) + amount);
    for (const { recipe } of orders) {
      count(recipe.tea);
      if (recipe.milk) count(recipe.milk);
      if (recipe.sugar) count(recipe.syrup, recipe.sugar);
      for (const id of [...recipe.toppings, ...recipe.mixins]) count(id);
      if (recipe.bun) count("bun");
    }
    for (const [id, yieldSize] of Object.entries(PREP_YIELDS)) {
      if (needed.has(id)) needed.set(id, Math.ceil(needed.get(id) / yieldSize) * yieldSize);
    }
    const market = SUPPLIERS.find(({ id }) => id === "market");
    for (const [id, amount] of needed) {
      const shortage = amount - stockCount(campaign, id);
      if (shortage > 0) {
        const priorCash = campaign.cash;
        campaign = resultOf(buyStock(campaign, id, market.id, Math.ceil(shortage / market.batchSize)));
        spent += priorCash - campaign.cash;
      }
    }

    campaign = resultOf(startDay(campaign));
    function apply(next) {
      const used = serviceUsageDelta(shift, next);
      campaign = resultOf(consumeIngredients(campaign, used));
      shift = next;
    }

    for (const { id, arrivesAt, recipe } of orders) {
      apply(advanceService(shift, arrivesAt - shift.elapsed));
      apply(takeOrder(shift, id));
      if (recipe.toppings.includes("pearls") && !shift.pearls.ready) {
        apply(startPearls(shift));
        apply(advanceService(shift, shift.pearls.target));
        apply(collectPearls(shift));
      }
      if (recipe.bun && !shift.buns.ready) {
        apply(startBuns(shift));
        apply(advanceService(shift, shift.buns.target));
        apply(collectBuns(shift));
      }
      apply(startBrew(shift, id, recipe.tea, recipe.milk));
      apply(advanceService(shift, shift.orders.find((order) => order.id === id).cup.brew.target));
      apply(stopBrew(shift, id));
      const addIns = [...recipe.toppings, ...recipe.mixins, ...Array(recipe.sugar).fill(recipe.syrup)];
      if (recipe.bun) addIns.push("bun");
      for (const ingredient of addIns) apply(addIngredient(shift, id, ingredient));
      apply(setIce(shift, id, recipe.ice));
      apply(shakeDrink(shift, id));
      apply(sealDrink(shift, id));
      apply(serveOrder(shift, id));
    }
    apply(advanceService(shift, shift.duration * 2));
    assert.equal(shift.status, "complete");
    const earnings = serviceSummary(shift);
    assert.equal(earnings.served, orders.length);
    assert.ok(earnings.quality >= 90);
    campaign = resultOf(finishDay(campaign, { ...earnings, contractBonus: shiftContractReward(shift) }));
    expired += campaign.lastDay.expired;
    gross += campaign.lastDay.revenue + campaign.lastDay.tips + campaign.lastDay.contractBonus;
    rent += campaign.lastDay.rent;
    const campus = BRANCHES[1];
    const branch = buyBranch(campaign, campus.id);
    if (branch.ok && branch.campaign.cash >= rentDue(branch.campaign) + 1000) firstAffordableBranch ??= day;
    assert.equal(campaign.status, "planning");
  }

  assert.ok(spent > 0, "the route pays for replacements");
  assert.ok(expired > 0, "the route survives stock expiry");
  assert.equal(campaign.rentPaid, 2);
  assert.equal(campaign.cash, initial.cash + gross - spent - rent);
  return { campaign, firstAffordableBranch };
}

test("Two solid orders per shift cover two rent cycles in both modes", () => {
  const normal = playCampaign("normal", () => 2);
  const expert = playCampaign("expert", () => 2);
  assert.ok(expert.campaign.cash >= 3000, "Expert leaves a reserve for restocking");
  assert.ok(normal.campaign.cash > expert.campaign.cash);
});

test("A mix of two to four solid orders funds an expansion and keeps a rent reserve", () => {
  for (const mode of ["normal", "expert"]) {
    const { campaign, firstAffordableBranch } = playCampaign(mode, (day) => 2 + (day - 1) % 3);
    assert.ok(firstAffordableBranch);
    const expanded = resultOf(buyBranch(campaign, "campus"));
    assert.ok(expanded.cash >= rentDue(expanded));
  }
});
