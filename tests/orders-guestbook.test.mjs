import assert from "node:assert/strict";
import test from "node:test";
import { REGULARS } from "../src/lib/arcade/orders-service.ts";
import { completedGuestCards, guestbookNote, guestbookStamps, shopKeepsakes } from "../src/lib/arcade/orders-guestbook.ts";

test("a guest card holds at most three stamps from saved good visits", () => {
  for (const [visits, expected] of [[undefined, 0], [-1, 0], [Infinity, 0], [1.5, 0], [1, 1], [2, 2], [3, 3], [10, 3]]) {
    assert.equal(guestbookStamps(visits), expected);
  }
  assert.equal(completedGuestCards({ mochi: 30, biscuit: 2, unknown: 80 }), 1);
});

test("each keepsake opens at its completed-card milestone", () => {
  const milestones = [[2, "postcard"], [5, "plant"], [9, "charm"], [14, "cup-trophy"]];
  const visits = (count) => Object.fromEntries(REGULARS.slice(0, count).map(({ id }) => [id, 3]));
  for (const [index, [threshold, id]] of milestones.entries()) {
    assert.equal(shopKeepsakes(visits(threshold - 1)).length, index);
    assert.equal(shopKeepsakes(visits(threshold)).at(-1)?.id, id);
  }
});

test("regulars have authored notes with a safe fallback for additions", () => {
  const fallback = guestbookNote("future-regular");
  assert.equal(guestbookNote("constructor"), fallback);
  assert.ok(new Set(REGULARS.map(({ id }) => guestbookNote(id)).filter((note) => note !== fallback)).size >= 15);
});
