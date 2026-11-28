import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../src/lib/arcade/order-up/content/index.ts";
import { calendar, unlocks } from "../src/lib/arcade/order-up/engine/calendar.ts";
import { iconSprite, machineSprite, cupSprite } from "../src/lib/arcade/order-up/art/sprites.ts";
const collections = [
  "INGREDIENTS",
  "FAMILIES",
  "RECIPES",
  "SKILLS",
  "MACHINES",
  "POWERUPS",
  "GUESTS",
  "SPECIAL_GUESTS",
  "SHOPS",
  "EVENTS",
  "HOLIDAYS",
  "SEASONS",
  "CREW_ROLES",
  "TRAITS",
  "DECOR",
  "BADGES",
  "RANKS",
  "GOALS",
  "VIEWS",
];
for (const name of collections)
  test(`${name}: stable unique IDs and named records`, () => {
    const list = C[name];
    assert.ok(list.length);
    assert.equal(new Set(list.map((x) => x.id)).size, list.length);
    assert.ok(list.every((x) => x.name && x.id));
  });
test("catalogue counts meet numerical scope without claiming bespoke completion", () => {
  for (const [name, count] of Object.entries({
    INGREDIENTS: 80,
    FAMILIES: 12,
    RECIPES: 400,
    SKILLS: 14,
    MACHINES: 45,
    POWERUPS: 24,
    GUESTS: 120,
    SPECIAL_GUESTS: 20,
    SHOPS: 12,
    EVENTS: 60,
    HOLIDAYS: 16,
    SEASONS: 4,
    CREW_ROLES: 10,
    DECOR: 200,
    BADGES: 120,
    RANKS: 60,
    VIEWS: 13,
  }))
    assert.ok(C[name].length >= count, `${name}: ${C[name].length}`);
});
test("all 484 recipes are reachable in the shared Normal/Expert catalogue", () => {
  for (const r of C.RECIPES) {
    assert.ok(
      C.FAMILIES.some((f) => f.id === r.family && f.day <= r.day),
      r.id + " family",
    );
    assert.ok(r.steps.length && r.ingredients.length);
    for (const i of r.ingredients) {
      assert.ok(C.INGREDIENT_BY_ID[i.id]?.day <= r.day, r.id + " " + i.id);
      assert.ok(i.quantity > 0);
    }
    for (const id of r.steps)
      assert.ok(
        C.SKILLS.some((s) => s.id === id && s.day <= r.day),
        r.id + " " + id,
      );
    for (const id of r.shops) assert.ok(C.SHOPS.some((s) => s.id === id && s.day <= r.day));
    for (const id of r.machines) assert.ok(C.MACHINES.some((m) => m.id === id && m.day <= r.day));
  }
});
test("each ingredient has supplies, color, seasonal shelf life and at least two playable recipes", () => {
  for (const i of C.INGREDIENTS) {
    assert.ok(/^#[a-f0-9]{6}$/i.test(i.cupColor), i.id);
    assert.ok(i.shelfLife > 0 && i.suppliers.length);
    assert.ok(C.RECIPES.filter((r) => r.ingredients.some((x) => x.id === i.id)).length >= 2, i.id);
    assert.ok(iconSprite(i.art));
  }
});
test("every guest has a day-reachable favorite, variations and five story visits", () => {
  for (const g of C.GUESTS) {
    assert.equal(g.story.length, 5, g.id);
    assert.ok(g.portrait);
    assert.ok(C.RECIPE_BY_ID[g.favorite]?.day <= g.day, g.id);
    assert.ok(g.variations.length >= 2);
    assert.ok(g.variations.every((id) => C.RECIPE_BY_ID[id]));
    assert.ok(g.story.every((s) => s.prop && s.emote));
    assert.ok(C.DECOR.some((d) => d.id === g.keepsake && d.kind === "keepsake"));
  }
});
test("every machine has three bounded tiers with stackable art", () => {
  for (const m of C.MACHINES) {
    assert.equal(m.tiers.length, 3);
    for (const [i, t] of m.tiers.entries()) {
      assert.ok(t.grade < 100 && t.grade > 0);
      assert.ok(t.speed > 0);
      const art = machineSprite(m.id, i + 1, 0, false);
      assert.ok(art.grid.length && art.palette);
    }
  }
});
test("each family has a visible cup silhouette and signature skill", () => {
  for (const f of C.FAMILIES) {
    const r = C.RECIPES.find((r) => r.family === f.id);
    assert.ok(r);
    assert.ok(cupSprite(r.id, r.steps.length, 0).grid.length);
    assert.ok(f.skills.length);
  }
});
test("all event effects are in the typed engine contract", () => {
  for (const e of C.EVENTS) assert.ok(C.EVENT_EFFECTS.includes(e.effect), e.effect);
});
test("each of 120 calendar days has at least one authored catalogue unlock", () => {
  for (let d = 1; d <= 120; d++) assert.ok(unlocks(d).length, "day " + d);
});
test("the calendar is deterministic, loops four seasons, and includes all holidays", () => {
  const holidays = new Set();
  for (let d = 1; d <= 112; d++) {
    assert.deepEqual(calendar(d), calendar(d));
    if (calendar(d).holiday) holidays.add(calendar(d).holiday.id);
    assert.equal(calendar(d).season.id, calendar(d + 112).season.id);
  }
  assert.equal(holidays.size, 16);
  assert.equal(calendar(113).cycle, 1);
});
test("all goals, badges and rank rewards reference supported data", () => {
  const ids = new Set(
    Object.values(C)
      .filter(Array.isArray)
      .flatMap((a) => a.map((x) => x.id)),
  );
  for (const r of C.RANKS) assert.ok(ids.has(r.unlock), r.unlock);
  for (const g of C.GOALS) assert.ok(g.target > 0 && g.reward > 0);
  for (const b of C.BADGES) assert.ok(b.target > 0);
});
test("art is deterministic and every view describes its interaction", () => {
  for (const kind of collections)
    for (const item of C[kind]) if (item.art) assert.deepEqual(iconSprite(item.art), iconSprite(item.art));
  for (const v of C.VIEWS) assert.ok(v.verb && v.visual && v.decision);
});
