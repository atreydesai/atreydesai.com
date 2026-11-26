import assert from "node:assert/strict";
import test from "node:test";

import { advanceCommission, commissionCups, commissionOffer, normalizeCommission } from "../src/lib/arcade/orders-commissions.ts";
import { createServiceDay } from "../src/lib/arcade/orders-service.ts";

test("commissions start on day four and rotate by shop week", () => {
  assert.equal(commissionOffer(3, false), null);
  assert.equal(commissionOffer(4, false).target, 5);
  assert.equal(commissionOffer(4, true).target, 6);
  assert.deepEqual(commissionOffer(4, false), commissionOffer(7, false));
  assert.deepEqual([8, 15, 22, 29].map((day) => commissionOffer(day, false).kind), ["fruit", "prep", "signature", "fruit"]);
  assert.equal(commissionOffer(28, true).deadline, 28);
});

test("normalization preserves current commission progress through the deadline", () => {
  const { id, deadline, target } = commissionOffer(4, false);
  assert.deepEqual(normalizeCommission({ id, deadline, count: 90 }, 7, false), { id, deadline, count: target });
  assert.equal(normalizeCommission({ id, deadline, count: 3 }, 8, false), null);
  assert.equal(normalizeCommission({ id, deadline: 6, count: 3 }, 6, false), null);
  assert.equal(normalizeCommission({ id, deadline, count: 3.5 }, 6, false), null);
});

test("a commission pays at the target crossing and never pays its completed progress again", () => {
  const offer = commissionOffer(4, false);
  const { id, deadline, target } = offer;
  const accepted = { id, deadline, count: 0 };
  const first = advanceCommission(accepted, offer, target - 1);
  assert.deepEqual(first, { progress: { ...accepted, count: target - 1 }, reward: 0 });
  const completed = advanceCommission(first.progress, offer, 3);
  assert.deepEqual(completed, { progress: { ...accepted, count: target }, reward: offer.reward });
  assert.deepEqual(advanceCommission(completed.progress, offer, 10), { progress: completed.progress, reward: 0 });
});

function handoff(shift, order, grades = {}, quality = 100) {
  shift.receipts.push({
    orderId: order.id, customerId: order.customerId, recipeName: order.recipe.name, quality,
    grades: { brew: 100, build: 100, finish: 100, wait: 100, ...grades },
  });
  order.status = "served";
}

test("fruit needs an actual high-quality, exact-build handoff in the offer week", () => {
  const offer = commissionOffer(8, false);
  const shift = createServiceDay({ day: 8, expert: false });
  const fruit = shift.orders.find(({ recipe }) => recipe.mixins.length > 0);
  assert.ok(fruit);
  assert.equal(commissionCups(offer, shift), 0);
  handoff(shift, fruit, { build: 99 });
  handoff(shift, fruit, {}, offer.minQuality - 1);
  assert.equal(commissionCups(offer, shift), 0);
  handoff(shift, fruit);
  handoff(shift, fruit);
  assert.equal(commissionCups(offer, shift), 1);
  assert.equal(commissionCups(offer, { ...shift, day: 15 }), 0);
});

test("specialist prep and signature goals have enough base-menu opportunities", () => {
  for (const expert of [false, true]) {
    for (let week = 2; week <= 12; week++) {
      const firstDay = (week - 1) * 7 + 1;
      const offer = commissionOffer(firstDay, expert);
      let opportunities = 0;
      for (let day = firstDay; day <= offer.deadline; day++) {
        const shift = createServiceDay({ day, expert });
        for (const order of shift.orders) {
          if (offer.kind === "prep" && (order.recipe.bun || order.recipe.waffle || order.recipe.toppings.includes("pearls"))) {
            order.cup = { prepQuality: { pearls: [100] } };
          }
          handoff(shift, order);
        }
        opportunities += commissionCups(offer, shift);
      }
      assert.ok(opportunities >= offer.target, `week ${week}, expert ${expert}`);
    }
  }
});
