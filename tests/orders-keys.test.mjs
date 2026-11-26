import assert from "node:assert/strict";
import test from "node:test";

import { HAND_KEYS, createKeyLatch, keyHold, releaseFor } from "../src/lib/arcade/orders-keys.js";

test("each hand key holds the tap on its own", () => {
  assert.notEqual(keyHold("key", " "), keyHold("key", "Enter"));
  assert.notEqual(keyHold("key", " "), keyHold("hand-key", " "));
  assert.equal(keyHold("key", " "), keyHold("key", " "), "the same key finds its own hold again");
  assert.deepEqual([...HAND_KEYS], [" ", "Enter"]);
});

test("an Enter that continued a lesson lets go of nothing, while Space keeps pouring", () => {
  // Space held: the tap is open. The tank runs dry and its line stops the
  // shift; Enter continues it, and is let go while Space is still down.
  const holds = new Set([keyHold("key", " ")]);
  const latch = createKeyLatch();
  latch.take("Enter");
  assert.equal(releaseFor(latch, "key", "Enter"), null, "the used-up release does nothing");
  assert.ok(holds.has(keyHold("key", " ")), "Space is still pouring");
  // Its next press is an ordinary one again.
  assert.equal(releaseFor(latch, "key", "Enter"), keyHold("key", "Enter"));
  // Space let go: its own hold ends.
  const space = releaseFor(latch, "key", " ");
  assert.equal(space, keyHold("key", " "));
  holds.delete(space);
  assert.equal(holds.size, 0);
});

test("letting go of one key never closes a pour another key is holding", () => {
  const holds = new Set();
  const latch = createKeyLatch();
  holds.add(keyHold("key", "Enter"));
  holds.add(keyHold("key", " "));
  holds.delete(releaseFor(latch, "key", "Enter"));
  assert.deepEqual([...holds], [keyHold("key", " ")]);
});

test("only the hand's keys release a hold, and a lost window forgets what was used up", () => {
  const latch = createKeyLatch();
  assert.equal(releaseFor(latch, "key", "a"), null);
  assert.equal(releaseFor(latch, "key", "ArrowLeft"), null);
  latch.take("Enter");
  latch.clear();
  assert.equal(releaseFor(latch, "key", "Enter"), keyHold("key", "Enter"));
});
