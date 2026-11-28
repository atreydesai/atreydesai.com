import test from "node:test";
import assert from "node:assert/strict";
import { newCampaign } from "../src/lib/arcade/orders-campaign.ts";
import {
  SKILLS,
  RECIPES,
  INGREDIENTS,
  MACHINES,
  SHOPS,
  POWERUPS,
  GOALS,
  GUESTS,
  DECOR,
} from "../src/lib/arcade/order-up/content/index.ts";
import {
  stock,
  addStock,
  useStock,
  canMake,
  consumeRecipe,
  buyPantry,
  expireAndDeliver,
  pantryCount,
  pantryCapacity,
} from "../src/lib/arcade/order-up/engine/pantry.ts";
import {
  startShift,
  tickShift,
  beginWork,
  currentSkill,
  setStation,
  handoff,
  usePowerup,
  finishSkill,
  settleShift,
  shooGull,
  feedCat,
  wakeGuest,
} from "../src/lib/arcade/order-up/engine/shift.ts";
import { spawnTicket } from "../src/lib/arcade/order-up/engine/tickets.ts";
import {
  buyMachine,
  buyShop,
  selectShop,
  expandShop,
  moveCounter,
  moveMachine,
  hire,
  assignStaff,
  staffOnDuty,
  payroll,
  wage,
  candidates,
  takeLoan,
  repayLoan,
  selectGoal,
} from "../src/lib/arcade/order-up/engine/management.ts";
import { emptyShop, createStaff } from "../src/lib/arcade/order-up/engine/state.ts";
import {
  metric,
  storyVisit,
  goalBonus,
  beginGoals,
  discoverBadges,
} from "../src/lib/arcade/order-up/engine/progression.ts";
import {
  startActivity,
  tickActivity,
  actActivity,
  finishChore,
  flavorGrades,
  tasteBlend,
  plant,
  water,
  harvest,
  planRoute,
  deliverRoute,
  runnerDelivery,
  finishTasteoff,
  recovery,
} from "../src/lib/arcade/order-up/engine/activities.ts";
import { command } from "../src/lib/arcade/order-up/engine/commands.ts";
import { playDay } from "./helpers/order-up-player.mjs";
function prepared(mode = "normal", day = 120) {
  const c = newCampaign(mode);
  c.day = day;
  c.cash = 10000000;
  c.xp = 100000;
  c.inventory = [];
  c.expansion.extraInventory = [];
  for (const i of INGREDIENTS) if (i.day <= day) addStock(c, i.id, 4, 0, day + 50);
  return c;
}
for (const mode of ["normal", "expert"]) {
  test(`${mode}: initial kit clears a full opening day with graded handed-off cups`, () => {
    const c = newCampaign(mode),
      result = playDay(c);
    assert.ok(result.report);
    assert.ok(result.report.served >= 2, JSON.stringify(result.report));
    assert.ok(result.report.average >= 80, JSON.stringify(result.report));
    assert.equal(
      result.report.points,
      result.shift.receipts.reduce((n, r) => n + r.grade, 0),
    );
    assert.equal(c.day, 2);
    assert.equal(c.status, "planning");
    assert.ok(result.commands > 20);
  });
  test(`${mode}: inventory is shared across shops and uses earliest expiry first`, () => {
    const c = prepared(mode, 20);
    c.inventory = [];
    c.expansion.extraInventory = [];
    addStock(c, "black", 4, 0, 22);
    addStock(c, "black", 6, 0, 25);
    assert.ok(useStock(c, "black", 3));
    assert.equal(c.inventory.find((l) => l.expiresOn === 22).quantity, 1);
    buyShop(c, "campus");
    selectShop(c, "campus");
    assert.equal(stock(c, "black"), 7);
    assert.ok(useStock(c, "black", 2));
    assert.equal(
      c.inventory.some((l) => l.expiresOn === 22),
      false,
    );
  });
  test(`${mode}: no ingredient consumed unless the whole recipe fits`, () => {
    const c = newCampaign(mode),
      recipe = RECIPES[0];
    c.inventory = [];
    c.expansion.extraInventory = [];
    addStock(c, recipe.ingredients[0].id, 8);
    const before = structuredClone(c.inventory);
    assert.equal(consumeRecipe(c, recipe), false);
    assert.deepEqual(c.inventory, before);
  });
  test(`${mode}: machines have three tiers, slot limits and wear-safe grades`, () => {
    const c = prepared(mode);
    const m = MACHINES[0];
    assert.ok(buyMachine(c, m.id));
    assert.ok(buyMachine(c, m.id));
    assert.ok(buyMachine(c, m.id));
    assert.equal(buyMachine(c, m.id), false);
    assert.equal(c.expansion.machines[m.id].tier, 3);
    c.status = "open";
    assert.equal(buyMachine(c, MACHINES[1].id), false);
  });
  test(`${mode}: branch managers have separate wages and rest restores energy`, () => {
    const c = prepared(mode);
    c.expansion.shops.campus = emptyShop("campus");
    const a = createStaff("manager", 1, "corner"),
      b = createStaff("manager", 2, "campus");
    a.rota.fill(true);
    b.rota.fill(true);
    c.expansion.staff = [a, b];
    const expected = wage(a) + wage(b);
    assert.equal(payroll(c), expected);
    assert.equal(a.energy, 88);
    assert.equal(b.energy, 88);
    a.rota.fill(false);
    assert.equal(payroll(c), wage(b));
    assert.equal(a.energy, 100);
    assert.equal(b.energy, 76);
  });
  test(`${mode}: all 24 powerups dispatch, consume one item and enforce cooldown`, () => {
    for (const p of POWERUPS) {
      const c = prepared(mode),
        s = startShift(c);
      c.expansion.loadout = [p.id];
      c.expansion.powerups[p.id] = 2;
      assert.equal(usePowerup(c, s, p.id), true, p.id);
      assert.equal(c.expansion.powerups[p.id], 1, p.id);
      assert.equal(usePowerup(c, s, p.id), false, p.id);
    }
  });
}
test("all recipe variants consume their listed portions in both modes", () => {
  for (const mode of ["normal", "expert"])
    for (const r of RECIPES) {
      const c = newCampaign(mode);
      c.day = r.day;
      c.inventory = [];
      c.expansion.extraInventory = [];
      for (const item of r.ingredients) addStock(c, item.id, item.quantity * (r.size === 2 ? 2 : 1), 0, c.day + 9);
      assert.equal(canMake(c, r), true, r.id);
      assert.equal(consumeRecipe(c, r), true, r.id);
      assert.equal(pantryCount(c), 0, r.id);
    }
});
test("purchases enforce pantry capacity and delivery dates; expiry never creates stock", () => {
  const c = prepared();
  assert.ok(pantryCount(c) <= pantryCapacity(c));
  c.inventory = [];
  c.expansion.extraInventory = [];
  assert.ok(buyPantry(c, "black", "wholesaler"));
  const n = stock(c, "black");
  assert.equal(n, 0);
  c.day++;
  expireAndDeliver(c);
  assert.equal(stock(c, "black"), 16);
  c.day += 100;
  expireAndDeliver(c);
  assert.equal(stock(c, "black"), 0);
});
test("unserved cups do not award shift points", () => {
  const c = newCampaign(),
    s = startShift(c);
  assert.equal(handoff(c, s), false);
  assert.equal(s.points, 0);
  beginWork(c, s);
  for (let i = 0; i < 50; i++) tickShift(c, s, 0.1);
  assert.equal(s.points, 0);
});
test("passive kettles keep their timers when the chef changes counters", () => {
  const c = newCampaign(),
    s = startShift(c);
  beginWork(c, s);
  const cup = s.tickets[0].cups[0];
  assert.ok(cup.run);
  setStation(c, s, "prep");
  const before = cup.warmup;
  tickShift(c, s, 0.1);
  assert.ok(cup.warmup < before);
});
test("each shop supports three paid, star-gated expansions and its own layout", () => {
  const c = prepared();
  for (const shop of SHOPS) {
    if (!c.expansion.shops[shop.id]) assert.ok(buyShop(c, shop.id));
    assert.ok(selectShop(c, shop.id));
    const state = c.expansion.shops[shop.id];
    state.stars = 5;
    for (let i = 0; i < 3; i++) assert.ok(expandShop(c, shop.id));
    assert.equal(expandShop(c, shop.id), false);
    assert.equal(state.expansion, 3);
  }
  assert.notDeepEqual(c.expansion.shops.corner.layout, c.expansion.shops.moon.layout);
});
test("arrangement forbids occupied and outside floor tiles", () => {
  const c = prepared();
  const at = c.expansion.shops.corner.layout.prep;
  assert.equal(moveCounter(c, "brew", ...at), false);
  assert.equal(moveCounter(c, "brew", -1, 0), false);
  assert.equal(command(c, "move-counter", { id: "brew", x: 1, y: 1 }).ok, true);
  assert.equal(c.expansion.metrics["arranged-corner"], 1);
});
test("all regulars complete exactly one five-visit keepsake story", () => {
  const c = prepared();
  for (const g of GUESTS) {
    for (let i = 0; i < 4; i++) assert.equal(storyVisit(c, g.id, 90), false);
    assert.equal(storyVisit(c, g.id, 90), true, g.id);
    assert.equal(storyVisit(c, g.id, 90), false);
    assert.ok(c.expansion.keepsakes.includes(g.keepsake));
  }
  assert.equal(c.expansion.metrics.stories, 120);
});
test("selected goals pay once per period", () => {
  const c = prepared(),
    g = GOALS.find((g) => g.scale === "shift");
  selectGoal(c, g.id);
  beginGoals(c);
  metric(c, g.metric, g.target);
  assert.equal(goalBonus(c), g.reward);
  assert.equal(goalBonus(c), 0);
  c.day++;
  beginGoals(c);
  assert.equal(c.expansion.goalProgress[g.id], 0);
});
test("taste panels distinguish paired and clashing flavors and consume stock", () => {
  assert.ok(
    flavorGrades(["oolong", "peach"]).reduce((n, x) => n + x, 0) >
      flavorGrades(["lemon", "milk"]).reduce((n, x) => n + x, 0),
  );
  const c = prepared();
  const before = stock(c, "oolong");
  const grades = tasteBlend(c, ["oolong", "peach"]);
  assert.ok(grades);
  assert.equal(stock(c, "oolong"), before - 1);
  assert.ok(c.expansion.pairings.includes("oolong+peach"));
  assert.ok(c.expansion.prints.length);
});
test("garden uses a three-growth cycle, watering once a day, then shared-pantry harvest", () => {
  const c = prepared();
  c.expansion.shops.garden = emptyShop("garden");
  assert.ok(plant(c, 0, "peach"));
  for (let i = 0; i < 3; i++) {
    assert.ok(water(c, 0));
    assert.equal(water(c, 0), false);
    if (i < 2) c.day++;
  }
  const before = stock(c, "peach");
  assert.ok(harvest(c, 0));
  assert.ok(stock(c, "peach") > before);
  assert.equal(c.expansion.garden[0].ingredient, null);
});
test("a ten-second chore repairs equipment once per day, not an infinite till exploit", () => {
  const c = prepared();
  buyMachine(c, MACHINES[0].id);
  const m = c.expansion.machines[MACHINES[0].id];
  m.condition = 10;
  m.broken = true;
  const a = startActivity("chore", MACHINES[0].id);
  for (let n = 0; n < 101; n++) {
    if (n % 20 === 0) actActivity(a, a.cursor);
    tickActivity(a, 0.1, "normal");
  }
  assert.ok(finishChore(c, a));
  assert.ok(m.condition >= 70);
  assert.equal(m.broken, false);
  assert.equal(finishChore(c, a), false);
  const b = { ...a, reward: 0 };
  assert.equal(finishChore(c, b), false);
});
test("delivery consumes shared pantry portions exactly once and earns slosh-graded sales", () => {
  const c = prepared();
  c.expansion.shops.commissary = emptyShop("commissary");
  addStock(c, "black", 12);
  assert.ok(planRoute(c, "corner", "black"));
  const before = stock(c, "black"),
    a = startActivity("delivery", "corner");
  for (let n = 0; n < 125; n++) tickActivity(a, 0.1, "normal", a.balance > 0.1 ? -0.5 : a.balance < -0.1 ? 0.5 : 0);
  assert.ok(a.done && a.grade > 70);
  assert.ok(deliverRoute(c, a));
  assert.equal(stock(c, "black"), before - 8);
  assert.equal(deliverRoute(c, a), false);
});
test("tasteoff and loans are bounded, recovery does not erase progress", () => {
  const c = prepared();
  const a = startActivity("tasteoff");
  for (let i = 0; i < 3; i++) {
    a.cursor = 0.5;
    actActivity(a);
  }
  assert.ok(finishTasteoff(c, a).won);
  assert.equal(finishTasteoff(c, a), null);
  assert.ok(takeLoan(c));
  assert.equal(takeLoan(c), false);
  assert.ok(repayLoan(c));
  c.status = "closed";
  c.bestShiftScore = 800;
  assert.ok(recovery(c));
  assert.equal(c.status, "planning");
  assert.equal(c.bestShiftScore, 800);
  assert.equal(recovery(c), false);
});
test("cat and commuter have real queue interactions and gulls can be shooed", () => {
  const c = prepared(),
    s = startShift(c);
  s.tickets = s.tickets.map(() => null);
  const cat = spawnTicket(c, s, { special: "cat" });
  s.selected = cat.slot;
  assert.ok(feedCat(c, s));
  assert.ok(c.expansion.cat);
  const commuter = spawnTicket(c, s, { special: "commuter" });
  s.selected = commuter.slot;
  assert.ok(commuter.sleeping);
  const patience = commuter.patience;
  tickShift(c, s, 0.1);
  assert.equal(commuter.patience, patience);
  assert.ok(wakeGuest(s));
  s.gull.active = true;
  assert.ok(shooGull(c, s));
  assert.equal(s.gull.active, false);
});

test("goal grade thresholds do not discard lifetime counts", () => {
  const c = prepared(),
    g = GOALS.find((g) => g.scale === "shift" && g.metric === "served");
  selectGoal(c, g.id);
  beginGoals(c);
  metric(c, "served", 2, g.grade - 1);
  assert.equal(c.expansion.goalProgress[g.id], 0);
  assert.equal(c.expansion.metrics.served, 2);
  metric(c, "served", 1, g.grade);
  assert.equal(c.expansion.goalProgress[g.id], 1);
});
test("packed jobs count each eligible cup once and only for the matching booking", () => {
  const c = prepared(),
    jobs = GOALS.filter((g) => g.scale === "job");
  c.expansion.selectedGoals = [jobs[0].id, jobs[1].id];
  const s = startShift(c),
    t = s.tickets.find(Boolean);
  t.packed = true;
  t.job = jobs[0].id;
  for (const cup of t.cups) {
    cup.ready = true;
    cup.grades = RECIPES.find((r) => r.id === cup.recipe).steps.map((skill) => ({ skill, grade: 100 }));
  }
  assert.ok(handoff(c, s, t.slot));
  assert.equal(c.expansion.goalProgress[jobs[0].id], t.cups.length);
  assert.equal(c.expansion.goalProgress[jobs[1].id], 0);
  assert.equal(c.expansion.metrics.packed, t.cups.length);
});

test("a guest who walks out hands the selection to another waiting ticket", () => {
  const c = newCampaign("normal");
  const s = startShift(c);
  spawnTicket(c, s);
  const [first, second] = s.tickets.filter(Boolean);
  s.selected = first.slot;
  first.patience = 0.01;
  tickShift(c, s, 0.05);
  assert.equal(s.tickets[first.slot], null);
  assert.equal(s.selected, second.slot);
});
