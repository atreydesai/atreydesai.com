import assert from "node:assert/strict";
import test from "node:test";

import { shiftContracts, shiftContractReward } from "../src/lib/arcade/orders-challenges.ts";
import { createServiceDay } from "../src/lib/arcade/orders-service.ts";

function receipt(order, overrides = {}) {
  return {
    orderId: order.id,
    quality: 100,
    grades: { build: 100, wait: 100, finish: 100 },
    specialBonus: order.specialRequest?.bonus,
    ...overrides,
  };
}

test("opening contracts reward a first serve, then reward a well-made order", () => {
  const state = createServiceDay({ day: 1, expert: false });
  assert.deepEqual(shiftContracts(state).map(({ id, target, count }) => [id, target, count]), [
    ["serve", 1, 0], ["quality", 1, 0],
  ]);
  assert.equal(shiftContractReward(state), 0);
  state.receipts.push(receipt(state.orders[0], { quality: 74 }));
  assert.equal(shiftContractReward(state), 100);
  state.receipts.push(receipt(state.orders[1]), receipt(state.orders[2]));
  assert.deepEqual(shiftContracts(state).map(({ count }) => count), [1, 1]);
  assert.equal(shiftContractReward(state), 250);
});

test("both modes rotate through contracts the scheduled orders can fulfill", () => {
  for (const expert of [false, true]) {
    const kinds = new Set();
    for (let day = 1; day <= 50; day++) {
      const state = createServiceDay({ day, expert });
      const opening = shiftContracts(state);
      assert.deepEqual(shiftContracts(state), opening);
      assert.equal(new Set(opening.map(({ id }) => id)).size, 2);
      const finished = { ...state, receipts: state.orders.map((order) => receipt(order)) };
      assert.ok(shiftContracts(finished).every(({ complete }) => complete));
      for (const { id } of opening) kinds.add(id);
    }
    for (const kind of ["serve", "quality", "fast", "fruit", "bun"]) assert.ok(kinds.has(kind), kind);
  }
});

test("a fruit recipe needs the exact build even if the cup quality is high", () => {
  const shifts = Array.from({ length: 20 }, (_, index) => createServiceDay({ day: index + 1, expert: false }));
  const state = shifts.find((shift) => shiftContracts(shift).some(({ id }) => id === "fruit"));
  assert.ok(state);
  const fruit = state.orders.find(({ recipe }) => recipe.mixins.length > 0);
  state.receipts.push(receipt(fruit, { grades: { build: 99 } }));
  assert.equal(shiftContracts(state).find(({ id }) => id === "fruit").count, 0);
});

test("a regular request contract counts the special bonus on the receipt", () => {
  const regularVisits = Object.fromEntries(
    Array.from({ length: 16 }, (_, index) => createServiceDay({ day: index + 1, expert: false }))
      .flatMap(({ orders }) => orders.map(({ customerId }) => [customerId, 2])),
  );
  const state = Array.from({ length: 50 }, (_, index) => createServiceDay({ day: index + 1, expert: false, regularVisits }))
    .find((shift) => shiftContracts(shift).some(({ id }) => id === "request"));
  assert.ok(state);
  const special = state.orders.find(({ specialRequest }) => specialRequest);
  state.receipts = [receipt(special, { specialBonus: undefined })];
  assert.equal(shiftContracts(state).find(({ id }) => id === "request").count, 0);
  state.receipts = [receipt(special)];
  assert.equal(shiftContracts(state).find(({ id }) => id === "request").count, 1);
});
