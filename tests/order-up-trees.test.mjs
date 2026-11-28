import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCampaign } from "../src/lib/arcade/orders-campaign.ts";
import { GUEST_BY_ID, RECIPES, RECIPE_BY_ID } from "../src/lib/arcade/order-up/content/index.ts";
import { TREE_NODES } from "../src/lib/arcade/order-up/content/progression-trees.ts";
import { actActivity, deliverRoute, finishChore, makePearlBatch, planRoute, startActivity, tickActivity } from "../src/lib/arcade/order-up/engine/activities.ts";
import { command } from "../src/lib/arcade/order-up/engine/commands.ts";
import { giveWaitEstimate } from "../src/lib/arcade/order-up/engine/guest-actions.ts";
import { buyMachine, machineSlots, payroll, rentDue, staffGrade, style } from "../src/lib/arcade/order-up/engine/management.ts";
import { addStock, buyPantry, consumeRecipe, expireAndDeliver, pantryCapacity, pantryCount, stock, stockPrice } from "../src/lib/arcade/order-up/engine/pantry.ts";
import { receiptFor } from "../src/lib/arcade/order-up/engine/receipts.ts";
import { restoreExpandedShift } from "../src/lib/arcade/order-up/engine/save.ts";
import { availableRecipes, beginWork, finishSkill, handoff, skillAction, startShift, tickShift } from "../src/lib/arcade/order-up/engine/shift.ts";
import { freshCup } from "../src/lib/arcade/order-up/engine/shift-types.ts";
import { createStaff, emptyShop } from "../src/lib/arcade/order-up/engine/state.ts";
import { spawnTicket } from "../src/lib/arcade/order-up/engine/tickets.ts";
import { genericNode, hasNode, nodeStatus, unlockNode } from "../src/lib/arcade/order-up/engine/tree-nodes.ts";
import { makeCampaign } from "../scripts/order-up-sim.mjs";

const owns = (c, ...ids) => { c.expansion.treeNodes.corner = ids; return c; };
const fresh = (nodes = [], day = 55) => {
  const c = owns(makeCampaign({ day }), ...nodes);
  c.inventory = [];
  c.expansion.extraInventory = [];
  for (const id of ["black", "milk", "brown-sugar", "pearls", "popping", "jasmine", "strawberry", "honey", "oolong", "peach"])
    addStock(c, id, 16, 0, day + 4);
  return c;
};
const addCrew = (c, role, station) => {
  const p = createStaff(role, c.expansion.staff.length + 1);
  if (station) p.station = station;
  p.rota.fill(true);
  c.expansion.staff.push(p);
  return p;
};
function service(c, { recipe = "usual-mochi", skill = "steep", count = 1, started = true } = {}) {
  const s = startShift(c);
  const t = s.tickets.find(Boolean);
  assert.ok(t);
  s.tickets.fill(null);
  s.selected = t.slot;
  s.tickets[t.slot] = t;
  s.nextArrival = 1e6;
  Object.assign(t, { recipe, special: null, changeTo: null, usual: false, sleeping: false,
    job: null, packed: count > 2, cupIndex: 0, pickupAt: null, patience: 80, maxPatience: 80 });
  t.cups = Array.from({ length: count }, () => ({ ...freshCup(recipe), started, step: RECIPE_BY_ID[recipe].steps.indexOf(skill) }));
  assert.ok(t.cups[0].step >= 0, recipe + " " + skill);
  return { s, t, cup: t.cups[0] };
}
function advance(c, s, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 10); i++) tickShift(c, s, 0.1);
}

test("tree status honors days, ownership, cash, capacity, materials, and exclusive installs across saves", () => {
  const c = fresh([], 12);
  assert.equal(nodeStatus(c, "nope").status, "shut");
  assert.equal(nodeStatus(c, "furniture-communal").status, "shut");
  assert.equal(nodeStatus(c, "prep-batch-pot").status, "locked");
  c.day = 40;
  assert.equal(nodeStatus(c, "prep-batch-pot").status, "open");
  c.status = "open";
  assert.equal(nodeStatus(c, "prep-batch-pot").status, "shut");
  c.status = "planning";
  for (let n = 0; n < 6; n++) c.expansion.machines["fixture-" + n] = { shop: "corner" };
  assert.match(nodeStatus(c, "prep-batch-pot").reason, /slot/);
  c.expansion.machines = {};
  const capital = c.cash;
  c.cash = 1;
  assert.match(nodeStatus(c, "prep-batch-pot").reason, /till/);
  c.cash = capital;
  assert.equal(command(c, "unlock-node", { id: "prep-batch-pot" }).ok, true);
  assert.equal(c.cash, capital - 2250);
  assert.equal(nodeStatus(c, "prep-batch-pot").status, "owned");
  assert.equal(unlockNode(c, "prep-hold-bath"), false);
  c.expansion.workshop.brewBench = true;
  c.expansion.workshop.parts = { "brew-coupling": 1, "brew-valve": 1 };
  assert.equal(unlockNode(c, "prep-hold-bath"), true);
  assert.equal(c.expansion.workshop.parts["brew-valve"], undefined);
  assert.match(nodeStatus(c, "prep-portion-tray").reason, /other upgrade/);
  assert.equal(c.expansion.workshop.parts["brew-coupling"], 1);
  c.expansion.treeNodes.corner.push("prep-portion-tray");
  const loaded = normalizeCampaign(JSON.parse(JSON.stringify(c)), "normal");
  assert.deepEqual(loaded.expansion.treeNodes.corner, ["prep-batch-pot", "prep-hold-bath"]);
  loaded.expansion.shops.campus = emptyShop("campus");
  loaded.expansion.activeShop = "campus";
  assert.equal(nodeStatus(loaded, "prep-batch-pot").status, "open");
  for (const node of TREE_NODES.filter((n) => genericNode(n.id))) assert.equal(node.delivered, "live", node.id);
});

test("topping picks reserve the order, charge wrong scoops, preserve them on save, and grade omissions", () => {
  const c = fresh();
  const { s, t, cup } = service(c, { recipe: "usual-biscuit", skill: "topping-ladle", started: false });
  s.chefStation = "build";
  const before = stock(c, "pearls");
  const popping = stock(c, "popping");
  assert.ok(beginWork(c, s, t.slot));
  assert.ok(cup.run.wanted.includes("pearls"));
  const requested = cup.run.wanted.filter((id) => id === "pearls").length;
  assert.equal(stock(c, "pearls"), before - requested);
  assert.equal(skillAction(c, s, { type: "add", id: "black" }, t.slot), false);
  assert.ok(skillAction(c, s, { type: "add", id: "popping" }, t.slot));
  assert.equal(stock(c, "popping"), popping - 1);
  const restored = restoreExpandedShift(JSON.parse(JSON.stringify(s)), c);
  assert.deepEqual(restored.tickets[t.slot].cups[0].run.added, ["popping"]);
  assert.ok(skillAction(c, restored, { type: "done" }, t.slot));
  assert.ok(restored.tickets[t.slot].cups[0].grades.at(-1).grade <= 25);
  assert.equal(stock(c, "pearls"), before - requested);
  assert.equal(c.expansion.metrics.waste, requested + 1);
  for (const automatic of [false, true]) {
    const next = fresh();
    const { s, t, cup } = service(next, { recipe: "usual-biscuit", skill: "topping-ladle", started: false });
    next.expansion.metrics["hand-good:topping-ladle"] = 6;
    s.chefStation = "build";
    assert.ok(beginWork(next, s, t.slot, 0, automatic ? { source: "staff", grade: 91, speed: 2 } : undefined));
    const run = cup.run;
    if (automatic) advance(next, s, 1.2);
    else assert.ok(skillAction(next, s, { type: "quick" }, t.slot));
    assert.deepEqual(run.added, run.wanted);
    assert.equal(cup.grades[0].grade, automatic ? 91 : 94);
  }
});

test("prep stages win by volume or by cost and shelf space", () => {
  const stockRoom = fresh();
  const pot = fresh(["prep-batch-pot"]);
  const warm = fresh(["prep-batch-pot", "prep-hold-bath"]);
  const small = fresh(["prep-batch-pot", "prep-portion-tray"]);
  assert.ok(makePearlBatch(stockRoom, 92));
  assert.ok(makePearlBatch(pot, 92));
  assert.ok(makePearlBatch(warm, 92));
  assert.ok(makePearlBatch(small, 92));
  assert.deepEqual([stockRoom, pot, warm, small].map((c) => c.expansion.pearls), [8, 10, 14, 5]);
  assert.equal(stock(small, "pearls") - stock(warm, "pearls"), 2);
  assert.equal(pantryCapacity(small) - pantryCapacity(warm), 24);
  assert.equal(machineSlots(stockRoom) - machineSlots(pot), 1);
  assert.equal(makePearlBatch(small, 92), false);
  warm.day++;
  expireAndDeliver(warm);
  assert.equal(warm.expansion.pearls, 7);
  assert.equal(warm.expansion.metrics.waste, 7);
});

test("the dosing rail gives a preset, the fixed head is fastest, and the flex head alone takes off-ratios", () => {
  const onlyRail = fresh(["build-dosing-rail"]);
  assert.equal(machineSlots(onlyRail), machineSlots(fresh()) - 1);
  const standard = RECIPES.find((r) => r.day < 40 && r.steps.includes("topping-ladle") && r.sugar === 2).id;
  const off = RECIPES.find((r) => r.day < 40 && r.steps.includes("topping-ladle") && r.sugar !== 2).id;
  const base = service(onlyRail, { recipe: standard, skill: "topping-ladle" });
  base.s.chefStation = "build";
  assert.ok(beginWork(onlyRail, base.s));
  assert.equal(base.cup.run.variant, "quick");
  const trial = (variant, recipe, previous) => {
    const c = fresh(["build-dosing-rail", variant]);
    const { s, cup } = service(c, { recipe, skill: "topping-ladle" });
    s.lastDoseFamily = previous;
    advance(c, s, 0.2);
    return cup.run;
  };
  assert.equal(trial("build-fixed-doser", off), null);
  const fixed = trial("build-fixed-doser", standard);
  const flex = trial("build-flex-nozzle", standard);
  assert.ok(fixed.speed > flex.speed && fixed.automatic < flex.automatic);
  assert.ok(trial("build-flex-nozzle", off, "different").speed < trial("build-flex-nozzle", off).speed);
  const wash = fresh(["build-dosing-rail", "build-flex-nozzle", "back-service-rack", "back-wash-station"]);
  const cleaner = addCrew(wash, "cleaner", "stock");
  const cleaned = service(wash, { recipe: off, skill: "topping-ladle" });
  cleaned.s.lastDoseFamily = "different";
  advance(wash, cleaned.s, 0.2);
  assert.equal(cleaned.cup.run.speed, trial("build-flex-nozzle", off).speed);
  assert.equal(cleaner.energy, 92);
});

test("service staging buys hold time, lockers trade grade for unattended handoff, and finishing needs staff and time", () => {
  const ready = (c) => {
    const { s, t, cup } = service(c);
    cup.ready = true;
    cup.grades = [{ skill: "steep", grade: 85 }];
    return { s, t, cup };
  };
  const equipment = fresh(["serve-handoff-rack"]);
  const standard = fresh();
  assert.equal(machineSlots(standard) - machineSlots(equipment), 1);
  for (const c of [standard, equipment]) {
    const { s, cup } = ready(c);
    s.elapsed = 20;
    advance(c, s, 0.2);
    assert.equal(cup.damage > 0, c === standard);
  }
  const locker = fresh(["serve-handoff-rack", "serve-locker-bank"]);
  const l = ready(locker);
  l.t.special = "courier";
  l.t.pickupAt = 1;
  advance(locker, l.s, 0.8);
  assert.equal(l.s.receipts.length, 0);
  advance(locker, l.s, 0.4);
  assert.equal(l.cup.damage, 3);
  assert.equal(l.s.receipts.length, 1);
  const bench = fresh(["serve-handoff-rack", "serve-finish-bench"]);
  const b = ready(bench);
  const basicGrade = receiptFor(bench, b.s, b.t, b.cup, 0).grade;
  addCrew(bench, "cashier", "serve");
  assert.equal(handoff(bench, b.s), false);
  advance(bench, b.s, 1.6);
  assert.ok(handoff(bench, b.s));
  assert.equal(b.s.receipts[0].grade, basicGrade + 3);
});

test("greeting and host frontage trade space for patience while express trades queue space for pickup time", () => {
  const base = fresh();
  const host = fresh(["front-greeting-post", "front-host-stand", "crew-hospitality"]);
  addCrew(base, "host");
  addCrew(host, "host");
  const plain = startShift(base);
  const managed = startShift(host);
  assert.ok(managed.tickets.find(Boolean).maxPatience > plain.tickets.find(Boolean).maxPatience);
  assert.equal(machineSlots(host), machineSlots(base) - 1);
  const t = managed.tickets.find(Boolean);
  Object.assign(t, { patience: 5, special: null, changeTo: null, usual: false, job: null });
  managed.elapsed = 30;
  assert.ok(giveWaitEstimate(host, managed, t.slot));
  assert.equal(t.patience, 25);
  assert.equal(payroll(host) - payroll(base), 80);
  const express = fresh(["front-greeting-post", "front-express-rail"]);
  const es = startShift(express);
  const p = es.tickets.find(Boolean);
  es.tickets.fill(p);
  es.tickets[0] = null;
  assert.equal(spawnTicket(express, es, { guest: "mochi", recipe: "usual-mochi", special: "none" }), null);
  const courier = spawnTicket(express, es, { guest: "mochi", recipe: "usual-mochi", special: "courier" });
  assert.equal(courier.pickupAt, 6);
});

test("service storage adds workspace by giving up shelf or queue space and repair spares are spent", () => {
  const normal = fresh();
  const c = fresh(["back-service-rack", "back-spares-bin", "room-utility"]);
  assert.equal(machineSlots(c), machineSlots(normal) + 2);
  assert.equal(pantryCapacity(c), pantryCapacity(normal) + 36);
  assert.equal(pantryCapacity(fresh(["back-service-rack"])), pantryCapacity(normal) - 24);
  assert.equal(rentDue(c), rentDue(normal) + 500);
  assert.equal(startShift(c).tickets.length, startShift(normal).tickets.length - 1);
  c.status = "planning";
  assert.ok(buyMachine(c, "preset-kettle"));
  const machine = c.expansion.machines["preset-kettle"];
  machine.condition = 10;
  machine.broken = true;
  c.expansion.workshop.parts["brew-coupling"] = 1;
  const task = startActivity("chore", "preset-kettle");
  for (let i = 0; i < 101; i++) {
    if (i % 20 === 0) actActivity(task, task.cursor);
    tickActivity(task, 0.1, c.mode);
  }
  assert.ok(finishChore(c, task));
  assert.equal(machine.condition, 100);
  assert.equal(machine.broken, false);
  assert.equal(c.expansion.workshop.parts["brew-coupling"], undefined);
});

test("station leads improve their home specialty while floaters can fill an idle gap with a penalty", () => {
  const automatic = (node, station, recipe, skill) => {
    const c = fresh(node ? [node] : []);
    const member = addCrew(c, "barista", station);
    member.skills.brew = member.skills.build = 2;
    const { s, cup } = service(c, { recipe, skill });
    advance(c, s, 0.2);
    return { run: cup.run, grade: staffGrade(member, "brew") };
  };
  const regular = automatic(null, "brew", "usual-mochi", "steep");
  assert.equal(automatic("crew-station-lead", "brew", "usual-mochi", "steep").run.automatic, regular.grade + 7);
  assert.equal(automatic(null, "build", "usual-mochi", "steep").run, null);
  const floater = automatic("crew-floater", "build", "usual-mochi", "steep").run;
  assert.ok(floater);
  assert.equal(floater.automatic, regular.grade - 4);
  assert.ok(floater.speed < regular.run.speed);
  assert.ok(automatic("crew-station-lead", "build", "usual-biscuit", "topping-ladle").run.speed <
    automatic(null, "build", "usual-biscuit", "topping-ladle").run.speed);
});

test("supplier agreements trade unit price, lead time and runner energy", () => {
  const basic = fresh([], 47);
  const freight = fresh(["pantry-night-freight"], 47);
  const orchard = fresh(["pantry-orchard-crate"], 47);
  const runnerShop = fresh(["pantry-market-call"], 47);
  const runner = addCrew(runnerShop, "runner");
  assert.ok(buyPantry(basic, "black", "wholesaler"));
  assert.ok(buyPantry(freight, "black", "wholesaler"));
  assert.ok(buyPantry(orchard, "black", "cooperative"));
  const one = basic.expansion.shipments[0], bulk = freight.expansion.shipments[0], long = orchard.expansion.shipments[0];
  assert.ok(bulk.quantity > one.quantity && freight.cash < basic.cash);
  assert.ok(stockPrice(freight, "black", "wholesaler") / bulk.quantity < stockPrice(basic, "black", "wholesaler") / one.quantity);
  assert.ok(long.expiresOn - long.arrivesOn > bulk.expiresOn - bulk.arrivesOn && long.arrivesOn > bulk.arrivesOn);
  startShift(runnerShop);
  const before = pantryCount(runnerShop);
  assert.ok(buyPantry(runnerShop, "black"));
  assert.equal(pantryCount(runnerShop) - before, 2);
  assert.equal(runnerShop.expansion.shipments.length, 0);
  assert.equal(runner.energy, 88);
});

test("furnishing access and display variants compete for effect, upkeep and attention", () => {
  const plain = fresh();
  assert.equal(unlockNode(plain, "furniture-fit-kit"), false);
  plain.expansion.shops.corner.decor.push({ id: "fern-window-plant", x: 1, y: 1, rotation: 0 });
  assert.ok(unlockNode(plain, "furniture-fit-kit"));
  const window = owns(structuredClone(plain), "decor-display-rails", "decor-menu-window");
  const shelf = owns(structuredClone(plain), "decor-display-rails", "decor-regular-shelf");
  assert.equal(payroll(window) - payroll(plain), 60);
  assert.ok(style(window) > style(plain));
  assert.equal(nodeStatus(shelf, "decor-menu-window").status, "locked");
  const feature = (c) => {
    c.expansion.visits.mochi = 1;
    c.expansion.windowDisplay = "fruit-tea";
    const s = startShift(c);
    let featured = 0;
    for (let i = 1; i <= 20; i++) {
      s.tickets.fill(null);
      s.seed = (i * 234567891) >>> 0;
      const t = spawnTicket(c, s, { guest: "mochi", special: "none" });
      if (RECIPE_BY_ID[t.recipe].family === "fruit-tea") featured++;
    }
    s.tickets.fill(null);
    return { featured, patience: spawnTicket(c, s, { guest: "mochi", recipe: "usual-mochi", special: "none" }).maxPatience };
  };
  const a = feature(window), b = feature(shelf);
  assert.ok(a.featured > b.featured);
  assert.ok(b.patience > a.patience);
});

test("batch recipes trade late grade for warmup while tasting spends garnish for a high-grade sale", () => {
  const batch = fresh(["menu-batch-base"]);
  const { s, t, cup } = service(batch, { count: 2 });
  assert.ok(beginWork(batch, s));
  assert.ok(cup.warmup < 2.2);
  s.elapsed = 65;
  cup.run.finished = true;
  cup.run.grade = 97;
  finishSkill(batch, s, t, cup);
  assert.equal(cup.grades[0].grade, 90);
  const tasting = fresh(["menu-tasting-card"]);
  const normal = fresh();
  for (const c of [normal, tasting]) c.expansion.prices["milk-tea"] = 2;
  const recipe = RECIPE_BY_ID["usual-mochi"];
  const honey = stock(tasting, "honey");
  assert.ok(consumeRecipe(tasting, recipe));
  assert.equal(stock(tasting, "honey"), honey - 1);
  const prep = service(tasting);
  prep.cup.grades = [{ skill: "steep", grade: 100 }];
  assert.ok(receiptFor(tasting, prep.s, prep.t, prep.cup, 0).price > receiptFor(normal, prep.s, prep.t, prep.cup, 0).price);
});

test("radio brings closer arrivals with less patience while loyalty trades sale price for return visits", () => {
  const radio = fresh(["promo-radio-window"]);
  const ordinary = fresh();
  const records = [radio, ordinary].map((c) => {
    c.expansion.marketing = "radio";
    const s = startShift(c);
    s.elapsed = s.duration * .34;
    s.tickets.fill(null);
    s.nextArrival = s.elapsed;
    advance(c, s, 0.1);
    return { interval: s.nextArrival - s.elapsed, patience: s.tickets.find(Boolean).maxPatience };
  });
  assert.ok(records[0].interval < records[1].interval && records[0].patience < records[1].patience);
  const loyalty = fresh(["promo-loyalty-stamp"], 55);
  addCrew(loyalty, "host");
  loyalty.expansion.marketing = "loyalty";
  loyalty.expansion.visits.mochi = 1;
  const s = startShift(loyalty);
  assert.equal(s.tickets.find(Boolean).guest, "mochi");
  const t = s.tickets.find(Boolean);
  const normal = fresh();
  normal.expansion.marketing = "loyalty";
  assert.ok(receiptFor(loyalty, s, t, t.cups[0], 0).price < receiptFor(normal, s, t, t.cups[0], 0).price);
});

test("event playbooks trade menu breadth, supplies or demand for situational readiness", () => {
  const outage = fresh(["event-outage-plan"], 31);
  outage.expansion.workshop.brew.corner = { active: "brew-gravity", unlocked: ["brew-gravity"] };
  const smaller = availableRecipes(outage, false);
  assert.ok(smaller.length < availableRecipes(fresh([], 31), false).length);
  assert.ok(smaller.length && smaller.every((r) => r.steps.includes("steep") && !r.steps.includes("milk-ratio")));
  const rush = fresh(["event-rush-plan"], 55);
  rush.expansion.marketing = "radio";
  const pearls = stock(rush, "pearls");
  const cash = rush.cash;
  startShift(rush);
  assert.equal(rush.expansion.pearls, 8);
  assert.equal(stock(rush, "pearls"), pearls - 4);
  assert.equal(rush.cash, cash - 250);
  const quiet = fresh(["event-quiet-plan"], 67);
  quiet.expansion.visits.mochi = 2;
  const quietShift = startShift(quiet);
  assert.equal(quietShift.tickets.find(Boolean).guest, "mochi");
  const normal = fresh([], 67);
  const other = startShift(normal);
  quietShift.nextArrival = other.nextArrival = 0;
  advance(quiet, quietShift, 0.1);
  advance(normal, other, 0.1);
  assert.ok(quietShift.nextArrival > other.nextArrival);
});

test("rush supply contracts redirect extra inventory for a same-day premium", () => {
  const contract = fresh(["contract-neighbor-supply"], 55);
  contract.expansion.shops.commissary = emptyShop("commissary");
  contract.expansion.shops.campus = emptyShop("campus");
  const before = stock(contract, "black");
  assert.ok(planRoute(contract, "campus", "black"));
  const route = contract.expansion.routes[0];
  assert.equal(route.quantity, 12);
  assert.equal(route.priority, true);
  const delivery = startActivity("delivery", "campus");
  Object.assign(delivery, { done: true, grade: 100 });
  assert.ok(deliverRoute(contract, delivery));
  assert.equal(stock(contract, "black"), before - 12);
  assert.equal(delivery.reward, 2700);
});
