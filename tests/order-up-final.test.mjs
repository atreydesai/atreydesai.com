import test from "node:test";
import assert from "node:assert/strict";
import { newCampaign, normalizeCampaign } from "../src/lib/arcade/orders-campaign.ts";
import {
  MACHINES,
  RECIPES,
  INGREDIENTS,
  SHOPS,
  VIEWS,
  GUESTS,
  RECIPE_BY_ID,
} from "../src/lib/arcade/order-up/content/index.ts";
import { emptyShop } from "../src/lib/arcade/order-up/engine/state.ts";
import {
  buyMachine,
  moveMachine,
  moveCounter,
  selectShop,
  installed,
  machineAt,
  machineEntry,
} from "../src/lib/arcade/order-up/engine/management.ts";
import { loadEnvelope, saveEnvelope } from "../src/lib/arcade/order-up/engine/save.ts";
import { addStock, stock, pantryCount } from "../src/lib/arcade/order-up/engine/pantry.ts";
import { startShift, tickShift, beginWork, handoff, inspectUsual } from "../src/lib/arcade/order-up/engine/shift.ts";
import { spawnTicket } from "../src/lib/arcade/order-up/engine/tickets.ts";
import {
  memoryChoices,
  rememberUsual,
  acceptChange,
  keepOriginal,
} from "../src/lib/arcade/order-up/engine/guest-actions.ts";
import { planRoute, tasteBlend, deliverRoute, startActivity } from "../src/lib/arcade/order-up/engine/activities.ts";
import { SAMPLES, createSample } from "./helpers/order-up-samples.ts";
function ready(mode = "normal") {
  const c = newCampaign(mode);
  c.day = 120;
  c.cash = 1_000_000;
  c.inventory = [];
  c.expansion.extraInventory = [];
  for (const shop of SHOPS) c.expansion.shops[shop.id] = emptyShop(shop.id);
  for (const i of INGREDIENTS) addStock(c, i.id, 4, 0, c.day + 10);
  return c;
}
function onlyTicket(c, s, special) {
  s.tickets = s.tickets.map(() => null);
  s.arrivals = 0;
  s.selected = 0;
  return spawnTicket(c, s, { guest: "mochi", recipe: "usual-mochi", special, count: 1 });
}
function complete(t) {
  for (const cup of t.cups) {
    cup.step = RECIPE_BY_ID[cup.recipe].steps.length;
    cup.grades = RECIPE_BY_ID[cup.recipe].steps.map((skill) => ({
      skill,
      grade: 95,
      result: "test receipt",
      source: null,
    }));
    cup.ready = true;
    cup.started = true;
  }
  t.patience = t.maxPatience;
}
for (const mode of ["normal", "expert"]) {
  test(`${mode}: the same machine can be bought and upgraded independently at two shops`, () => {
    const c = ready(mode),
      id = "auto-tea";
    assert.ok(buyMachine(c, id));
    machineAt(c, id).condition = 62;
    selectShop(c, "campus");
    assert.ok(buyMachine(c, id));
    assert.ok(buyMachine(c, id));
    assert.equal(machineAt(c, id).tier, 2);
    assert.equal(machineAt(c, id, "corner").tier, 1);
    assert.equal(machineAt(c, id, "corner").condition, 62);
    const saved = normalizeCampaign(JSON.parse(JSON.stringify(c)), mode);
    assert.equal(machineAt(saved, id, "campus").tier, 2);
    assert.equal(machineAt(saved, id, "corner").condition, 62);
    assert.equal(installed(saved, "corner").length, 1);
    assert.equal(installed(saved, "campus").length, 1);
  });
  test(`${mode}: a bought machine uses an empty slot and moving one cannot duplicate a model`, () => {
    const c = ready(mode);
    buyMachine(c, "auto-tea");
    assert.ok(moveMachine(c, "auto-tea", 3));
    buyMachine(c, "auto-milk");
    assert.equal(machineAt(c, "auto-milk").slot, 0);
    selectShop(c, "campus");
    buyMachine(c, "auto-tea");
    assert.equal(moveMachine(c, "auto-tea", 1, 0, "campus"), false);
    assert.equal(machineAt(c, "auto-tea", "corner").shop, "corner");
  });
  test(`${mode}: malformed layout input does not corrupt a shop`, () => {
    const c = ready(mode);
    buyMachine(c, "auto-tea");
    const before = JSON.stringify(c.expansion.shops.corner.layout);
    for (const bad of [NaN, Infinity, -Infinity]) {
      assert.equal(moveCounter(c, "brew", bad, 2), false);
      assert.equal(moveMachine(c, "auto-tea", bad), false);
    }
    assert.equal(moveMachine(c, "auto-tea", 1.5), false);
    assert.equal(JSON.stringify(c.expansion.shops.corner.layout), before);
  });
  test(`${mode}: a remembered order must be chosen or inspected before any ingredients are spent`, () => {
    const c = ready(mode),
      s = startShift(c),
      t = onlyTicket(c, s, "grandparent");
    assert.ok(t.usual && !t.revealed && t.memoryGuest);
    const before = pantryCount(c);
    assert.equal(beginWork(c, s), false);
    assert.equal(pantryCount(c), before);
    const options = memoryChoices(c, t);
    assert.equal(options.length, 4);
    assert.equal(new Set(options.map((r) => r.id)).size, 4);
    const wrong = options.find((r) => r.id !== t.recipe);
    const patience = t.patience;
    assert.equal(rememberUsual(c, s, wrong.id), false);
    assert.equal(t.patience, patience - 5);
    assert.ok(rememberUsual(c, s, t.recipe));
    assert.equal(t.revealed, true);
    assert.equal(c.expansion.metrics.remembered, 1);
    assert.equal(rememberUsual(c, s, t.recipe), false);
  });
  test(`${mode}: inspecting a usual costs patience and restores through a real save round trip`, () => {
    const c = ready(mode),
      s = startShift(c),
      t = onlyTicket(c, s, "grandparent");
    const patience = t.patience;
    assert.ok(inspectUsual(s));
    assert.equal(t.patience, patience - 3);
    const loaded = loadEnvelope(JSON.parse(JSON.stringify(saveEnvelope(c, s, {}))), mode);
    const saved = loaded.shift.tickets[t.slot];
    assert.equal(saved.revealed, true);
    assert.equal(saved.memoryGuest, t.memoryGuest);
  });
  test(`${mode}: the undecided guest can change an already-started cup without a free refund`, () => {
    const c = ready(mode),
      s = startShift(c),
      t = onlyTicket(c, s, "undecided");
    assert.ok(beginWork(c, s));
    const used = pantryCount(c);
    s.elapsed = 8.1;
    tickShift(c, s, 0.01);
    assert.ok(t.changeTo);
    assert.equal(t.recipe, "usual-mochi");
    assert.ok(t.cups[0].started);
    const newRecipe = t.changeTo;
    assert.ok(acceptChange(c, s));
    assert.equal(t.recipe, newRecipe);
    assert.equal(t.cups[0].started, false);
    assert.equal(t.changeTo, null);
    assert.equal(pantryCount(c), used);
    assert.equal(c.expansion.metrics.remade, 1);
    assert.equal(acceptChange(c, s), false);
  });
  test(`${mode}: keeping a changed request is an explicit grade tradeoff`, () => {
    const c = ready(mode),
      s = startShift(c),
      t = onlyTicket(c, s, "undecided");
    t.changeTo = "usual-biscuit";
    assert.ok(keepOriginal(c, s));
    assert.equal(t.recipe, "usual-mochi");
    assert.equal(t.cups[0].damage, 15);
    assert.equal(t.changeTo, null);
  });
  test(`${mode}: crammer refills pay less, count real receipts and do not advance three story visits`, () => {
    const c = ready(mode),
      s = startShift(c),
      t = onlyTicket(c, s, "crammer");
    t.cups = t.cups.slice(0, 1);
    complete(t);
    assert.ok(handoff(c, s));
    assert.equal(t.refills, 1);
    const fullPrice = s.receipts[0].price;
    complete(t);
    assert.ok(handoff(c, s));
    assert.equal(t.refills, 2);
    assert.ok(s.receipts[1].price < fullPrice);
    complete(t);
    assert.ok(handoff(c, s));
    assert.equal(s.tickets[t.slot], null);
    assert.equal(s.receipts.length, 3);
    assert.equal(
      s.points,
      s.receipts.reduce((n, r) => n + r.grade, 0),
    );
    assert.equal(c.expansion.visits[t.guest], 1);
    assert.equal(c.expansion.metrics.refills, 2);
  });
  test(`${mode}: a courier cannot collect before the booked pickup time`, () => {
    const c = ready(mode),
      s = startShift(c),
      t = onlyTicket(c, s, "courier");
    assert.equal(t.pickupAt, 12);
    complete(t);
    assert.equal(handoff(c, s), false);
    assert.equal(s.points, 0);
    s.elapsed = 12;
    assert.ok(handoff(c, s));
    assert.ok(s.points > 0);
  });
  test(`${mode}: delivery routes reject negative, fractional, non-finite and overbooked loads`, () => {
    const c = ready(mode);
    for (const q of [0, -8, 0.5, NaN, Infinity, 101]) assert.equal(planRoute(c, "corner", "black", q), false);
    const quantity = stock(c, "black");
    assert.ok(planRoute(c, "corner", "black", quantity));
    assert.equal(planRoute(c, "corner", "black", 1), false);
  });
  test(`${mode}: a zero-grade delivery still settles once and leaves the next load alone`, () => {
    const c = ready(mode);
    addStock(c, "black", 8, 0, c.day + 10);
    assert.ok(planRoute(c, "corner", "black", 4));
    assert.ok(planRoute(c, "corner", "black", 4));
    const a = startActivity("delivery", "corner");
    a.done = true;
    a.grade = 0;
    const quantity = stock(c, "black"),
      cash = c.cash;
    assert.ok(deliverRoute(c, a));
    assert.equal(c.cash, cash);
    assert.equal(stock(c, "black"), quantity - 4);
    assert.equal(deliverRoute(c, a), false);
    assert.equal(c.expansion.routes.filter((r) => r.progress < 1).length, 1);
    assert.equal(stock(c, "black"), quantity - 4);
  });
  test(`${mode}: repeated ingredients do not let the tasting panel spend one portion twice`, () => {
    const c = ready(mode),
      before = stock(c, "milk");
    assert.equal(tasteBlend(c, ["milk", "milk"]), null);
    assert.equal(stock(c, "milk"), before);
  });
  for (const scene of SAMPLES)
    test(`${mode}: playable sample ${scene.id} restores with valid art, view, tickets and stock`, () => {
      const { envelope } = createSample(scene.id, mode),
        loaded = loadEnvelope(JSON.parse(JSON.stringify(envelope)), mode);
      const c = loaded.campaign;
      assert.equal(c.day, scene.day);
      assert.equal(c.mode, mode);
      assert.equal(c.expansion.activeShop, scene.shop);
      assert.ok(VIEWS.some((v) => v.id === scene.view && v.day <= scene.day));
      assert.ok(pantryCount(c) > 0);
      assert.equal(!!loaded.shift, scene.live);
      if (loaded.shift) {
        assert.equal(loaded.shift.tickets.filter(Boolean).length, 3);
        for (const t of loaded.shift.tickets.filter(Boolean)) {
          assert.ok(GUESTS.some((g) => g.id === t.guest));
          assert.ok(RECIPE_BY_ID[t.recipe]);
        }
      }
    });
}
test("unknown sample ids fail instead of silently overwriting a campaign", () =>
  assert.throws(() => createSample("__proto__"), /Unknown/));
