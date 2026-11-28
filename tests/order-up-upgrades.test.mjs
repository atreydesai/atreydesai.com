import test from "node:test";
import assert from "node:assert/strict";
import { newCampaign, normalizeCampaign } from "../src/lib/arcade/orders-campaign.ts";
import { CONSTRAINTS, TREE_ARTIFACTS, TREE_NODES } from "../src/lib/arcade/order-up/content/progression-trees.ts";
import { BREW_MODS, BREW_RESPEC_COST, UPGRADE_NODES } from "../src/lib/arcade/order-up/content/upgrades.ts";
import { GARDEN_FEATURE, GARDEN_OFFER_WINDOW_SECONDS, PREMIUM_MENU } from "../src/lib/arcade/order-up/content/service-program.ts";
import { command } from "../src/lib/arcade/order-up/engine/commands.ts";
import { canOfferGardenFeature } from "../src/lib/arcade/order-up/engine/guest-actions.ts";
import { hire } from "../src/lib/arcade/order-up/engine/management.ts";
import { addStock, stock } from "../src/lib/arcade/order-up/engine/pantry.ts";
import { receiptFor } from "../src/lib/arcade/order-up/engine/receipts.ts";
import { restoreExpandedShift } from "../src/lib/arcade/order-up/engine/save.ts";
import { startShift, tickShift } from "../src/lib/arcade/order-up/engine/shift.ts";
import { createStaff } from "../src/lib/arcade/order-up/engine/state.ts";
import { spawnTicket } from "../src/lib/arcade/order-up/engine/tickets.ts";
import { brewPareto, makeCampaign, runShift } from "../scripts/order-up-sim.mjs";

function assertDag(nodes, dependencies = (node) => node.requires) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  assert.equal(byId.size, nodes.length);
  const visiting = new Set();
  const reached = new Set();
  const visit = (id) => {
    assert.ok(!visiting.has(id), `Cycle through ${id}.`);
    const node = byId.get(id);
    assert.ok(node, `Missing prerequisite ${id}.`);
    if (reached.has(id)) return;
    visiting.add(id);
    for (const requirement of dependencies(node)) visit(requirement);
    visiting.delete(id);
    reached.add(id);
  };
  for (const id of byId.keys()) visit(id);
  assert.equal(reached.size, nodes.length);
  return byId;
}

test("every system's nodes have a path from a root, a real constraint, a drawback and an icon", () => {
  const byId = assertDag(TREE_NODES);
  const systems = Map.groupBy(TREE_NODES, (node) => node.system);
  assert.equal(systems.size, 12);
  for (const [system, nodes] of systems) {
    assertDag(nodes, (node) => node.requires.filter((id) => byId.get(id).system === system));
    assert.ok(nodes.some((node) => node.requires.length === 0));
    for (const node of nodes) {
      assert.ok(node.constraints.length && node.constraints.every((id) => CONSTRAINTS[id]), node.id);
      assert.ok(Number.isInteger(node.cost) && node.cost >= 0, node.id);
      if (node.delivered === "planned") assert.ok(node.cost > 0, node.id);
      assert.match(node.drawback, /\S.*\./);
      assert.match(node.icon, /\S.*\./);
      for (const requirement of node.requires) assert.ok(byId.get(requirement).day <= node.day, node.id);
    }
  }
  for (const [day, releases] of Map.groupBy(TREE_NODES, (node) => node.day))
    assert.equal(new Set(releases.map((node) => node.group)).size, 1, `Day ${day}.`);
  for (const siblings of Map.groupBy(TREE_NODES, (node) => node.group).values())
    for (const left of siblings)
      for (const right of siblings)
        assert.ok(left.constraints.some((id) => right.constraints.includes(id)), `${left.id}, ${right.id}`);
});

test("the cross-system production graph has typed sources, consumers and terminal uses", () => {
  const byId = new Map(TREE_NODES.map((node) => [node.id, node]));
  assertDag(TREE_ARTIFACTS, (artifact) => artifact.consumers);
  const cross = new Set();
  for (const artifact of TREE_ARTIFACTS) {
    assert.ok(artifact.output && (artifact.consumers.length || artifact.terminalUse), artifact.id);
    assert.ok(byId.has(artifact.producer));
    for (const consumer of artifact.consumers) {
      assert.ok(byId.get(consumer).requires.includes(artifact.producer));
      if (byId.get(consumer).system !== byId.get(artifact.producer).system)
        cross.add(byId.get(artifact.producer).system);
    }
  }
  // Contract outputs feed the existing settlement and reputation loop.
  for (const system of ["tea", "drinks", "machines", "crew", "locations", "guests", "furniture", "suppliers", "promotions", "decor", "events"])
    assert.ok(cross.has(system), system);
});

test("the Brew graph agrees with the design and cash costs rise along every edge", () => {
  const byId = assertDag(UPGRADE_NODES);
  const design = new Map(TREE_NODES.map((node) => [node.id, node]));
  assert.equal(new Set(BREW_MODS.map((mod) => mod.group)).size, 1);
  for (const node of UPGRADE_NODES) {
    assert.deepEqual(node.requires, design.get(node.id).requires);
    assert.equal(node.cost, design.get(node.id).cost);
    for (const requirement of node.requires) assert.ok(node.cost > byId.get(requirement).cost, node.id);
    for (const [part, quantity] of Object.entries(node.partsConsumed))
      assert.ok(node.requires.includes(part) && byId.get(part).kind === "part" && Number.isInteger(quantity) && quantity > 0);
    assert.match(node.drawback, /\S.*\./);
  }
  assert.equal(design.get("machine-garden-calibration").cost, GARDEN_FEATURE.calibrationCost);
  assert.equal(design.get("crew-garden-service").cost, GARDEN_FEATURE.trainingCost);
});

const issue = (c, name, id) => assert.ok(command(c, name, { id }).ok, `${name} ${id}`);
const craft = (c, id) => issue(c, "craft-part", id);
function buyBrew(c) {
  issue(c, "buy-machine", "preset-kettle");
  issue(c, "buy-machine", "water-filter");
  issue(c, "buy-machine", "steam-wand");
  issue(c, "unlock-upgrade", "brew-bench");
}
function makeValve(c) {
  craft(c, "brew-coupling");
  craft(c, "brew-valve");
}
function unlockMod(c, id) {
  makeValve(c);
  craft(c, "brew-coupling");
  if (id === "brew-manifold") craft(c, "brew-pump-head");
  if (id === "brew-gravity") {
    craft(c, "brew-reservoir");
    craft(c, "brew-valve");
  }
  issue(c, "unlock-upgrade", id);
}

test("old saves keep the original equipment and default to empty program state", () => {
  const c = makeCampaign({ day: 22 });
  issue(c, "buy-machine", "preset-kettle");
  issue(c, "buy-machine", "preset-kettle");
  c.expansion.machines["preset-kettle"].condition = 63;
  c.expansion.machines["preset-kettle"].automatic = false;
  delete c.expansion.workshop;
  delete c.expansion.gardenFeature;
  const loaded = normalizeCampaign(JSON.parse(JSON.stringify(c)), "normal");
  assert.deepEqual(loaded.expansion.machines, c.expansion.machines);
  assert.deepEqual(loaded.expansion.workshop, { brewBench: false, parts: {}, brew: {} });
  assert.equal(loaded.expansion.gardenFeature.developed, false);
  assert.equal(loaded.expansion.gardenFeature.listed, false);
});

test("Workshop commands check tooling, money, fit and respec and persist independently by shop", () => {
  const c = makeCampaign({ day: 27 });
  assert.equal(command(c, "craft-part", { id: "brew-coupling" }).ok, false);
  issue(c, "unlock-upgrade", "brew-bench");
  assert.equal(command(c, "craft-part", { id: "brew-coupling" }).ok, false);
  for (const id of ["preset-kettle", "water-filter", "steam-wand"]) issue(c, "buy-machine", id);
  craft(c, "brew-coupling");
  const cash = c.cash;
  c.cash = 1;
  assert.equal(command(c, "craft-part", { id: "brew-valve" }).ok, false);
  assert.equal(c.expansion.workshop.parts["brew-coupling"], 1);
  c.cash = cash;
  craft(c, "brew-valve");
  assert.equal(c.expansion.workshop.parts["brew-coupling"], undefined);
  craft(c, "brew-coupling");
  issue(c, "unlock-upgrade", "brew-precision");
  issue(c, "choose-mod", "brew-precision");
  unlockMod(c, "brew-manifold");
  assert.equal(command(c, "choose-mod", { id: "brew-manifold" }).ok, false);
  const before = c.cash;
  assert.ok(command(c, "respec-mod").ok);
  assert.equal(before - c.cash, BREW_RESPEC_COST);
  issue(c, "choose-mod", "brew-manifold");
  issue(c, "buy-shop", "garden");
  issue(c, "select-shop", "garden");
  assert.equal(command(c, "choose-mod", { id: "brew-manifold" }).ok, false);
  assert.ok(command(c, "craft-part", { id: "brew-coupling" }).ok);
  const loaded = normalizeCampaign(JSON.parse(JSON.stringify(c)), "normal");
  assert.deepEqual(loaded.expansion.workshop.brew.corner, {
    unlocked: ["brew-manifold", "brew-precision"], active: "brew-manifold",
  });
  assert.equal(loaded.expansion.workshop.brew.garden, undefined);
  issue(loaded, "select-shop", "corner");
  startShift(loaded);
  assert.equal(command(loaded, "respec-mod").ok, false);
  assert.equal(command(loaded, "craft-part", { id: "brew-coupling" }).ok, false);
});

test("parallel Brew shares power, gravity can work through an outage, and precision keeps one live job", () => {
  for (const [id, day, expected] of [
    ["brew-manifold", 55, 3],
    ["brew-precision", 55, 1],
    ["brew-manifold", 31, 0],
    ["brew-gravity", 31, 1],
  ]) {
    const c = makeCampaign({ day });
    buyBrew(c);
    unlockMod(c, id);
    issue(c, "choose-mod", id);
    const s = startShift(c);
    s.tickets.fill(null);
    const ticket = spawnTicket(c, s, { guest: "mochi", recipe: "usual-mochi", count: 4 });
    assert.ok(ticket);
    tickShift(c, s, 0.1);
    tickShift(c, s, 0.1);
    assert.equal(ticket.cups.filter((cup) => cup.run?.source === "preset-kettle").length, expected, id);
    const before = c.expansion.machines["preset-kettle"].condition;
    for (let i = 0; i < 90; i++) tickShift(c, s, 0.1);
    if (expected > 0) assert.ok(c.expansion.machines["preset-kettle"].condition < before);
    else assert.equal(c.expansion.machines["preset-kettle"].condition, before);
  }
});

test("the Garden chain unlocks a feature that can be offered after automation has ticked", () => {
  const c = newCampaign();
  c.day = 20;
  // Cover the Garden setup and leave operating cash for the trial shifts and rent.
  c.cash = 75_000;
  issue(c, "buy-shop", "garden");
  issue(c, "select-shop", "garden");
  buyBrew(c);
  // Calibrate the later machine so the feature must choose it over the preset kettle.
  issue(c, "buy-machine", "auto-tea");
  unlockMod(c, "brew-precision");
  issue(c, "choose-mod", "brew-precision");
  const prep = createStaff("prep", 1, "garden");
  prep.rota.fill(true);
  assert.ok(hire(c, prep));
  assert.equal(command(c, "calibrate-garden-brew", { id: "preset-kettle" }).ok, false);
  assert.equal(command(c, "develop-garden-blend").ok, false);
  assert.ok(command(c, "plant", { id: "oolong", plot: 0 }).ok);
  for (let day = 20; day <= 21; day++) {
    assert.equal(c.day, day);
    assert.ok(command(c, "water", { plot: 0 }).ok);
    runShift(c, 1);
    assert.equal(c.status, "planning");
  }
  const tea = stock(c, "oolong");
  assert.ok(command(c, "harvest", { plot: 0, reserveSample: true }).ok);
  assert.equal(stock(c, "oolong"), tea + 11);
  addStock(c, "peach", 4, 0, c.day + 20);
  const peaches = stock(c, "peach");
  assert.deepEqual(command(c, "develop-garden-blend").taste, [85, 86, 87]);
  assert.equal(c.expansion.gardenFeature.sampleUntil, 0);
  assert.equal(stock(c, "peach"), peaches - 1);
  while (c.day < 26) {
    if (c.day === 23) issue(c, "calibrate-garden-brew", "auto-tea");
    if (c.day === 24) issue(c, "train-garden-service", prep.id);
    if (c.day === 25) assert.ok(command(c, "list-garden-feature", { value: true }).ok);
    runShift(c, 1);
  }
  for (const id of ["black", "milk", "pearls", "honey", "oolong", "peach"]) addStock(c, id, 15, 0, c.day + 5);
  const loaded = normalizeCampaign(JSON.parse(JSON.stringify(c)), "normal");
  assert.deepEqual(loaded.expansion.gardenFeature, c.expansion.gardenFeature);

  const live = structuredClone(loaded);
  delete live.expansion.visits.mochi;
  addStock(live, "brown-sugar", 4);
  const shift = startShift(live);
  shift.tickets.fill(null);
  const ticket = spawnTicket(live, shift, { guest: "mochi", recipe: "usual-mochi", special: "none", count: 1 });
  assert.ok(ticket);
  assert.equal(ticket.recipe, "usual-mochi");
  const black = stock(live, "black");
  const oolong = stock(live, "oolong");
  for (let i = 0; i < 20; i++) tickShift(live, shift, 0.1);
  assert.equal(ticket.cups[0].started, false);
  assert.ok(canOfferGardenFeature(live, shift, ticket.slot));
  assert.equal(stock(live, "black"), black);
  assert.equal(stock(live, "oolong"), oolong);

  const noOffer = structuredClone(live);
  const noOfferShift = structuredClone(shift);
  // Past the offer window (two seconds have gone already), automation starts the guest's own order.
  for (let i = 0; i < Math.ceil((GARDEN_OFFER_WINDOW_SECONDS - 2) * 10) + 2; i++) tickShift(noOffer, noOfferShift, 0.1);
  assert.ok(noOfferShift.tickets[ticket.slot].cups[0].run?.source);
  assert.equal(canOfferGardenFeature(noOffer, noOfferShift, ticket.slot), false);

  assert.ok(command(live, "offer-garden-feature", { slot: ticket.slot }, shift).ok);
  assert.equal(ticket.recipe, GARDEN_FEATURE.recipe);
  assert.equal(canOfferGardenFeature(live, shift, ticket.slot), false);
  for (let i = 0; i < 4; i++) tickShift(live, shift, 0.1);
  assert.equal(ticket.cups[0].run?.source, "auto-tea");
  assert.equal(stock(live, "black"), black);
  assert.equal(stock(live, "oolong"), oolong - 1);

  const report = runShift(loaded, 1, { strategy: "quality", hitRate: 1 });
  assert.equal(report.featureCups, 1);
  assert.equal(report.housePremiumCups, 1);
  assert.ok(report.housePremiumCash > 0);
});

test("a host can extend one busy guest's wait and a missed estimate reduces that ticket's tip", () => {
  const c = makeCampaign({ day: 24 });
  const host = createStaff("host", 1);
  host.rota.fill(true);
  assert.ok(hire(c, host));
  const s = startShift(c);
  s.tickets.fill(null);
  const ticket = spawnTicket(c, s, { guest: "mochi", recipe: "usual-mochi", count: 1 });
  ticket.special = null;
  ticket.patience = 5;
  s.elapsed = s.realElapsed = 30;
  assert.ok(command(c, "give-wait-estimate", { slot: ticket.slot }, s).ok);
  assert.ok(ticket.patience > 5);
  assert.equal(command(c, "give-wait-estimate", { slot: ticket.slot }, s).ok, false);
  const saved = restoreExpandedShift(JSON.parse(JSON.stringify(s)), c);
  assert.equal(saved.hostCheckIn, true);
  assert.equal(saved.tickets[ticket.slot].expectedAt, 44);

  const cup = ticket.cups[0];
  cup.grades = [{ skill: "steep", grade: 100, result: "test", source: null }];
  const onTime = receiptFor(c, s, ticket, cup, 0);
  s.elapsed = 45;
  assert.ok(Math.abs(receiptFor(c, s, ticket, cup, 0).tip - onTime.tip * 0.75) <= 1);
});

test("premium menu pricing pays for quality and refunds a lower-grade cup below standard price", () => {
  const c = makeCampaign({ day: 24 });
  buyBrew(c);
  unlockMod(c, "brew-precision");
  issue(c, "choose-mod", "brew-precision");
  const stockKit = structuredClone(c);
  delete stockKit.expansion.workshop.brew.corner;
  const s = startShift(c);
  s.tickets.fill(null);
  const ticket = spawnTicket(c, s, { guest: "mochi", recipe: "usual-mochi", count: 1 });
  const cup = ticket.cups[0];
  for (const grade of [98, 78]) {
    cup.grades = [{ skill: "steep", grade, result: "test", source: null }];
    c.expansion.prices["milk-tea"] = 1;
    const standard = receiptFor(c, s, ticket, cup, 0);
    c.expansion.prices["milk-tea"] = 2;
    const premium = receiptFor(c, s, ticket, cup, 0);
    assert.equal(premium.grade, standard.grade);
    assert.equal(premium.price > standard.price, grade >= 90);
    assert.equal(premium.tip > standard.tip, grade >= 90);

    cup.grades[0].source = "preset-kettle";
    const precision = receiptFor(c, s, ticket, cup, 0);
    const factor = grade >= 90 ? PREMIUM_MENU.precisionBrewPrice : 1;
    assert.ok(Math.abs(precision.price - premium.price * factor) <= 1);
    assert.equal(precision.tip, premium.tip);
    stockKit.expansion.prices["milk-tea"] = 2;
    assert.equal(receiptFor(stockKit, s, ticket, cup, 0).price, premium.price);
    c.expansion.prices["milk-tea"] = 1;
    assert.equal(receiptFor(c, s, ticket, cup, 0).price, standard.price);
    c.expansion.prices["milk-tea"] = 2;
    cup.grades[0].source = "staff-1";
    assert.equal(receiptFor(c, s, ticket, cup, 0).price, premium.price);
  }
});

test("every Brew sibling pair earns a scenario win in the headless Pareto run", () => {
  const { rows, pairs } = brewPareto();
  assert.equal(pairs.length, 3);
  assert.ok(pairs.every((pair) => pair.pass), JSON.stringify(pairs));
  const premium = rows.filter((row) => row.scenario === "premium-menu");
  const precision = premium.find((row) => row.mod === "brew-precision");
  assert.ok(precision.precisionPremiumCash > 0);
  assert.ok(premium.every((row) => row === precision || row.cashDelta < precision.cashDelta));
});
