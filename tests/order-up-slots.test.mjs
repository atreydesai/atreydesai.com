import assert from "node:assert/strict";
import test from "node:test";

import {
  PLAYER_SLOTS,
  TEST_SLOT,
  bestShiftScore,
  clearSlot,
  readSlots,
  retireOldSaves,
  slotKey,
  summarizeSlot,
  testSlotAllowed,
} from "../src/lib/arcade/order-up/engine/slots.ts";
import {
  CHEAT_CASH,
  addCash,
  endShiftNow,
  finishEveryCup,
  jumpToDay,
  openAllShops,
  refillPatience,
  stockEverything,
  unlockCollection,
} from "../src/lib/arcade/order-up/engine/cheats.ts";
import { newCampaign } from "../src/lib/arcade/orders-campaign.ts";
import { saveEnvelope } from "../src/lib/arcade/order-up/engine/save.ts";
import { startShift } from "../src/lib/arcade/order-up/engine/shift.ts";
import { rankFor } from "../src/lib/arcade/order-up/engine/management.ts";
import { SHOPS, RECIPE_BY_ID, INGREDIENT_BY_ID } from "../src/lib/arcade/order-up/content/index.ts";
import { pantryCount } from "../src/lib/arcade/order-up/engine/pantry.ts";

function memoryStore(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}

test("each slot and difficulty has its own key, and the test kitchen its own", () => {
  const keys = new Set();
  for (const mode of ["normal", "expert"]) for (const slot of [...PLAYER_SLOTS, TEST_SLOT]) keys.add(slotKey(slot, mode));
  assert.equal(keys.size, 8);
  assert.ok(![...keys].some((k) => k === "boba_order_up_shop_v1_normal" || k === "boba_order_up_shop_v1_expert"));
});

test("the first campaign's single save is retired, and nothing else is touched", () => {
  const store = memoryStore({
    boba_order_up_shop_v1_normal: "{}",
    boba_order_up_shop_v1_expert: "{}",
    boba_order_up_v2_backup_normal: "{}",
    boba_order_up_before_import_expert: "{}",
    boba_order_up_unreadable_backup_normal: "{}",
    [slotKey("1", "normal")]: "{}",
    boba_coach_v1: "{}",
  });
  assert.equal(retireOldSaves(store), 5);
  assert.deepEqual([...store.map.keys()].sort(), [slotKey("1", "normal"), "boba_coach_v1"].sort());
  assert.equal(retireOldSaves(store), 0, "a second run removes nothing");
});

test("the test kitchen is only offered on a development host", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]", "shop.localhost"]) assert.equal(testSlotAllowed(host), true, host);
  for (const host of ["atreydesai.com", "www.atreydesai.com", "atreydesai.vercel.app", "local.example.com"])
    assert.equal(testSlotAllowed(host), false, host);
  assert.equal(testSlotAllowed("atreydesai.com", true), true, "the dev server always offers it");
});

test("a slot's summary reads its day, shop, till and an open shift; an empty or broken slot says so", () => {
  const campaign = newCampaign("normal");
  campaign.day = 7;
  campaign.cash = 123456;
  const summary = summarizeSlot("2", JSON.stringify(saveEnvelope(campaign, null)));
  assert.equal(summary.empty, false);
  assert.equal(summary.day, 7);
  assert.equal(summary.cash, 123456);
  assert.equal(summary.shop, SHOPS.find((s) => s.id === campaign.expansion.activeShop).name);
  assert.equal(summary.midShift, false);
  assert.equal(summarizeSlot("1", null).empty, true);
  const broken = summarizeSlot("3", "{not json");
  assert.equal(broken.empty, false);
  assert.equal(broken.unreadable, true);
});

test("the picker lists three slots, plus the test kitchen only where it's allowed; clearing empties one slot", () => {
  const campaign = newCampaign("normal");
  const store = memoryStore({ [slotKey("2", "normal")]: JSON.stringify(saveEnvelope(campaign, null)) });
  assert.deepEqual(readSlots(store, "normal", false).map((s) => s.slot), ["1", "2", "3"]);
  assert.deepEqual(readSlots(store, "normal", true).map((s) => s.slot), ["1", "2", "3", "test"]);
  assert.deepEqual(readSlots(store, "normal", false).map((s) => s.empty), [true, false, true]);
  assert.equal(readSlots(store, "expert", false)[1].empty, true, "difficulties keep separate shops");
  clearSlot(store, "2", "normal");
  assert.equal(readSlots(store, "normal", false)[1].empty, true);
});

test("the menu's best is the best of the player's own shops, never the test kitchen", () => {
  const shop = (score) => {
    const c = newCampaign("normal");
    c.bestShiftScore = score;
    return JSON.stringify(saveEnvelope(c, null));
  };
  const store = memoryStore({
    [slotKey("1", "normal")]: shop(40),
    [slotKey("3", "normal")]: shop(95),
    [slotKey("test", "normal")]: shop(9999),
  });
  assert.equal(bestShiftScore(store, "normal"), 95);
  assert.equal(bestShiftScore(store, "expert"), 0);
});

test("cheats: the till, the day with its rank, every shop, the pantry and the collection", () => {
  const c = newCampaign("normal");
  const cash = c.cash;
  assert.equal(addCash(c, CHEAT_CASH[0]).ok, true);
  assert.equal(c.cash, cash + CHEAT_CASH[0]);

  assert.equal(stockEverything(c).ok, true);
  assert.ok(pantryCount(c) > 0);
  assert.equal(jumpToDay(c, 60).ok, true);
  assert.equal(c.day, 60);
  const left = [...c.inventory, ...c.expansion.extraInventory];
  assert.ok(left.every((lot) => lot.expiresOn > 60), "stock kept to an earlier day spoils on the jump");
  assert.ok(
    left.every((lot) => INGREDIENT_BY_ID[lot.ingredient].day > 1),
    "what was stocked on day 1 is gone; what's left is the opening crates of the days passed",
  );
  assert.equal(rankFor(c), 31, "day 60's rank is reached, not only the date");
  assert.equal(jumpToDay(c, 10).ok, true);
  assert.equal(c.day, 10);

  assert.equal(openAllShops(c).ok, true);
  assert.equal(Object.keys(c.expansion.shops).length, SHOPS.length);

  const before = pantryCount(c);
  assert.equal(stockEverything(c).ok, true);
  assert.ok(pantryCount(c) > before);

  assert.equal(unlockCollection(c).ok, true);
  assert.ok(c.expansion.decor.length > 0);
});

test("cheats: a live shift can have its cups made, its guests calmed and its clock run out; the day waits", () => {
  const c = newCampaign("normal");
  stockEverything(c);
  const s = startShift(c);
  c.status = "open";
  assert.equal(jumpToDay(c, 30).ok, false, "the day can't change mid-shift");
  for (let i = 0; i < 4 && !s.tickets.some(Boolean); i++) s.elapsed += 1;
  const tickets = s.tickets.filter(Boolean);
  if (tickets.length) {
    for (const t of tickets) t.patience = 1;
    assert.equal(refillPatience(s).ok, true);
    for (const t of tickets) assert.equal(t.patience, t.maxPatience);
    assert.equal(finishEveryCup(s).ok, true);
    for (const t of tickets)
      for (const cup of t.cups) {
        assert.equal(cup.ready, true);
        assert.equal(cup.step, RECIPE_BY_ID[cup.recipe].steps.length);
        assert.ok(cup.grades.every((g) => g.grade === 100));
      }
  }
  assert.equal(endShiftNow(s).ok, true);
  assert.ok(s.elapsed >= s.duration);
  assert.equal(s.status, "complete", "the day can be settled straight away");
  assert.ok(s.tickets.every((t) => !t), "guests still waiting have left");
});

test("two loads to one shop: the courier delivers the one the pantry can fill, and is paid only when it goes", async () => {
  const { runnerDelivery, startActivity, deliverRoute } = await import("../src/lib/arcade/order-up/engine/activities.ts");
  const { addStock, stock } = await import("../src/lib/arcade/order-up/engine/pantry.ts");
  const c = newCampaign("normal");
  c.day = 95;
  c.cash = 100000;
  c.expansion.routes = [
    { to: "corner", ingredient: "matcha", quantity: 8, day: 95, progress: 0 },
    { to: "corner", ingredient: "jasmine", quantity: 8, day: 95, progress: 0 },
  ];
  // Only the second load can be filled.
  addStock(c, "jasmine", 12);
  assert.ok(stock(c, "matcha") < 8);
  const a = startActivity("delivery", "corner");
  a.done = true;
  a.grade = 90;
  assert.equal(deliverRoute(c, a), true);
  assert.equal(c.expansion.routes[1].progress, 1, "the fillable load went");
  assert.equal(c.expansion.routes[0].progress, 0);

  // A courier with nothing to deliver costs nothing.
  const d = newCampaign("normal");
  d.cash = 5000;
  const { INGREDIENTS } = await import("../src/lib/arcade/order-up/content/index.ts");
  const empty = INGREDIENTS.find((i) => stock(d, i.id) === 0);
  d.expansion.routes = [{ to: "corner", ingredient: empty.id, quantity: 8, day: 1, progress: 0 }];
  d.expansion.staff = [{ id: "c1", name: "Ro", portrait: "ro", role: "courier", traits: [], skills: { brew: 1, prep: 1, build: 1, serve: 1, stock: 1 }, progress: { brew: 0, prep: 0, build: 0, serve: 0, stock: 0 }, energy: 100, station: null, shop: "corner", rota: [true, true, true, true, true, true, true], shifts: 0, paidDays: [] }];
  const before = d.cash;
  assert.equal(runnerDelivery(d, "corner"), false);
  assert.equal(d.cash, before);
});
