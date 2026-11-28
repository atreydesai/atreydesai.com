import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newCampaign, normalizeCampaign } from "../src/lib/arcade/orders-campaign.ts";
import { loadEnvelope, saveEnvelope, parseSave, restoreExpandedShift } from "../src/lib/arcade/order-up/engine/save.ts";
import { startShift, beginWork, tickShift, settleShift } from "../src/lib/arcade/order-up/engine/shift.ts";
import { migrateCampaign } from "../src/lib/arcade/order-up/engine/migrations.ts";
const fixture = (name) => JSON.parse(readFileSync(new URL("./fixtures/" + name, import.meta.url), "utf8"));
for (const name of ["v2-planning.json", "v2-mid-shift.json"])
  test(`original-engine ${name} migrates without losing campaign data`, () => {
    const value = fixture(name),
      snapshot = structuredClone(value);
    const loaded = loadEnvelope(value, "normal");
    assert.equal(loaded.campaign.version, 3);
    for (const key of [
      "day",
      "cash",
      "xp",
      "bestShiftScore",
      "inventory",
      "crew",
      "branches",
      "regularVisits",
      "locationManagers",
      "upgrades",
      "records",
      "bests",
    ])
      if (key in value.campaign) assert.deepEqual(loaded.campaign[key], value.campaign[key], key);
    assert.deepEqual(value, snapshot, "the input is immutable");
    assert.deepEqual(loaded.legacyShift, value.shift ?? null);
    assert.ok(loaded.campaign.expansion.staff.some((p) => p.role === "manager" && p.shop === "campus"));
    assert.deepEqual(normalizeCampaign(loaded.campaign, "normal"), loaded.campaign, "normalization is idempotent");
  });
test("the actual v2 active brew and timers are preserved for the legacy shift bridge", () => {
  const value = fixture("v2-mid-shift.json"),
    loaded = loadEnvelope(value, "normal");
  assert.equal(loaded.campaign.status, "open");
  assert.deepEqual(loaded.legacyShift, value.shift);
  assert.equal(loaded.shift, null);
});
for (const mode of ["normal", "expert"])
  for (const day of [1, 40, 120])
    test(`${mode} day ${day}: variable duration and mid-skill reload are preserved`, () => {
      const c = newCampaign(mode);
      c.day = day;
      c.xp = 100000;
      const s = startShift(c);
      beginWork(c, s);
      for (let n = 0; n < 20; n++) tickShift(c, s, 0.1);
      const saved = saveEnvelope(c, s),
        restored = parseSave(JSON.stringify(saved), mode);
      assert.equal(restored.shift.duration, s.duration);
      assert.equal(restored.shift.elapsed, s.elapsed);
      assert.equal(restored.campaign.day, c.day);
      assert.equal(restored.campaign.cash, c.cash);
      assert.deepEqual(restored.campaign.inventory, c.inventory);
      const cup = restored.shift.tickets.find(Boolean)?.cups[0];
      if (cup?.run) assert.equal(cup.run.held, false);
      assert.equal(restored.shift.points, 0);
    });
test("points on restore are only the sum of delivered receipts", () => {
  const c = newCampaign(),
    s = startShift(c);
  s.points = 999999;
  s.receipts = [
    {
      id: 1,
      ticket: 1,
      recipe: s.tickets[0].recipe,
      grade: 91,
      price: 500,
      tip: 80,
      name: "mochi",
      skills: [],
      time: 0,
      cup: 0,
      story: 0,
      emote: "heart",
    },
  ];
  const restored = restoreExpandedShift(s, c);
  assert.equal(restored.points, 91);
  assert.equal(restored.revenue, 500);
  assert.equal(restored.tips, 80);
});
test("Normal and Expert cannot accidentally import into each other", () => {
  assert.throws(() => parseSave(JSON.stringify({ campaign: newCampaign("expert") }), "normal"), /other difficulty/);
});
test("future versions and malformed files are rejected rather than reset", () => {
  assert.throws(() => parseSave("{", "normal"), /readable/);
  assert.throws(() => parseSave("{}", "normal"), /contain/);
  assert.throws(() => parseSave(JSON.stringify({ campaign: { ...newCampaign(), version: 50 } }), "normal"), /version/);
  assert.throws(() => parseSave(" ".repeat(5_000_001), "normal"), /large/);
});
test("an invalid workbench keeps the migrated shop and pantry", () => {
  const v = fixture("v2-mid-shift.json");
  v.shift = null;
  v.expandedShift = { version: 3, duration: -1 };
  const loaded = loadEnvelope(v, "normal");
  assert.equal(loaded.campaign.cash, 18740);
  assert.equal(loaded.campaign.status, "planning");
  assert.ok(loaded.warning);
  assert.deepEqual(loaded.campaign.inventory, v.campaign.inventory);
});
test("settlement is idempotent across save and reload", () => {
  const c = newCampaign(),
    s = startShift(c);
  s.status = "complete";
  settleShift(c, s);
  const day = c.day,
    cash = c.cash;
  assert.equal(settleShift(c, s), null);
  const saved = saveEnvelope(c, s);
  assert.equal(saved.expandedShift, null);
  assert.equal(c.day, day);
  assert.equal(c.cash, cash);
});
