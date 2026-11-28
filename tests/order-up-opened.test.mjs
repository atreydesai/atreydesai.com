import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAPTER_DAYS,
  albumBadges,
  albumDecor,
  albumRecipes,
  albumRegulars,
  beltShows,
  chapterIsNew,
  chapters,
  listedShops,
  newToday,
  DAILY_DAY,
  GOAL_SCALE_DAYS,
  goalScaleOpen,
} from "../src/lib/arcade/order-up/engine/opened.ts";
import { bookMarketing, candidates, selectGoal, MARKETING } from "../src/lib/arcade/order-up/engine/management.ts";
import { unlocks } from "../src/lib/arcade/order-up/engine/calendar.ts";
import { BADGES, DECOR, GOALS, GUESTS, INGREDIENTS, RECIPES, SHOPS } from "../src/lib/arcade/order-up/content/index.ts";
import { newCampaign } from "../src/lib/arcade/orders-campaign.ts";
import { newShop } from "../src/lib/arcade/order-up/engine/save.ts";
import { buyPantry, openingGifts, pantryCount, stock, SUPPLIER_OFFERS } from "../src/lib/arcade/order-up/engine/pantry.ts";

const onDay = (day) => {
  const c = newCampaign("normal");
  c.day = day;
  return c;
};

test("opened: a new shop's book holds Today, the pantry and the album; the rest arrive with their first content", () => {
  assert.deepEqual(chapters(onDay(1)), ["today", "pantry", "collection"]);
  assert.equal(CHAPTER_DAYS.workshop, 4, "the first machines");
  assert.equal(CHAPTER_DAYS.crew, 5, "the first hire");
  assert.equal(CHAPTER_DAYS.map, 12, "the second shop");
  assert.deepEqual(chapters(onDay(4)), ["today", "pantry", "workshop", "collection"]);
  assert.deepEqual(chapters(onDay(5)), ["today", "pantry", "workshop", "crew", "collection"]);
  assert.deepEqual(chapters(onDay(12)), ["today", "pantry", "workshop", "crew", "map", "collection"]);
  assert.ok(chapterIsNew(onDay(4), "workshop") && !chapterIsNew(onDay(5), "workshop"), "a chapter is marked new on its first day only");
});

test("opened: what a save already holds is never hidden, whatever the day", () => {
  const c = onDay(2);
  c.expansion.staff.push({ id: "x" });
  c.expansion.shops.campus = { stars: 0, expansion: 0 };
  c.expansion.powerups.rush = 2;
  assert.deepEqual(chapters(c), ["today", "pantry", "workshop", "crew", "map", "collection"]);
  assert.ok(beltShows(c, "rush"), "a held powerup shows on the belt");
});

test("opened: the belt stays blank until the workshop sells its powerups", () => {
  const day1 = onDay(1);
  for (const id of day1.expansion.loadout) assert.equal(beltShows(day1, id), false, id);
  const day4 = onDay(4);
  assert.ok(beltShows(day4, "rush"));
  assert.equal(beltShows(day4, "quality"), false, "the recipe card is sold from day 6");
});

test("opened: the album and the shops page hold what is open so far, plus what was found", () => {
  const c = onDay(1);
  assert.equal(albumRecipes(c).length, RECIPES.filter((r) => r.day <= 1).length);
  assert.ok(albumRecipes(c).length < RECIPES.length);
  assert.equal(albumRegulars(c).length, GUESTS.filter((g) => g.day <= 1).length);
  assert.equal(albumBadges(c).length, BADGES.filter((b) => b.day <= 1).length);
  assert.equal(albumDecor(c).length, DECOR.filter((d) => d.day <= 1).length);
  const late = RECIPES.find((r) => r.day > 1);
  c.expansion.recipes[late.id] = { served: 1 };
  assert.ok(albumRecipes(c).includes(late), "a recipe already served stays in the album");
  assert.deepEqual(
    listedShops(c).map((s) => s.id),
    ["corner", "campus"],
    "the open shop and the next one",
  );
  assert.equal(listedShops(onDay(120)).length, SHOPS.length);
});

test("opened: the job board is empty before the first role opens, then offers only open roles", () => {
  assert.deepEqual(candidates(onDay(1)), []);
  const board = candidates(onDay(5));
  assert.equal(board.length, 3);
  for (const person of board) assert.equal(person.role, "host");
});

test("opened: day 1 announces nothing; later days list only what the player acts on", () => {
  assert.ok(unlocks(1).length > 20, "day 1 opens a lot");
  assert.deepEqual(newToday(onDay(1)), [], "none of it is listed as new");
  const quiet = ["decor", "goal", "skill", "guest", "special", "event"];
  for (const day of [2, 3, 4, 8, 12, 20]) {
    const listed = newToday(onDay(day));
    assert.ok(listed.length < unlocks(day).length || unlocks(day).every((u) => !quiet.includes(u.kind)), `day ${day}`);
    for (const u of listed) assert.ok(!quiet.includes(u.kind), `day ${day} lists a ${u.kind}`);
  }
  assert.ok(newToday(onDay(4)).some((u) => u.kind === "machine"), "the first machines are announced");
  assert.ok(newToday(onDay(12)).some((u) => u.kind === "shop"), "the second shop is announced");
});

test("opened: a new shop's shelves hold only day 1's ingredients; each later one arrives with its opening crate", () => {
  const c = newShop("normal");
  const held = new Set([...c.inventory].map((l) => l.ingredient));
  assert.deepEqual([...held].sort(), INGREDIENTS.filter((i) => i.day === 1).map((i) => i.id).sort());
  assert.ok(pantryCount(c) < 100, "no hidden crates fill the shelves");
  assert.ok(pantryCount(newCampaign("normal")) > pantryCount(c), "the first campaign's own new save still stocks everything");
  c.day = 2;
  openingGifts(c);
  for (const i of INGREDIENTS.filter((x) => x.day === 2)) assert.ok(stock(c, i.id) > 0, `${i.id} arrives on day 2`);
  // A save that already holds its opening stock gets nothing more.
  const old = newCampaign("normal");
  old.day = 2;
  const before = stock(old, "jasmine");
  openingGifts(old);
  assert.equal(stock(old, "jasmine"), before);
});

test("opened: one supplier, then the bulk and the long-keeping ones", () => {
  assert.deepEqual(
    SUPPLIER_OFFERS.map((o) => [o.id, o.day]),
    [["market", 1], ["wholesaler", 3], ["cooperative", 5]],
  );
  const c = newShop("normal");
  c.cash = 100000;
  assert.equal(buyPantry(c, "black", "wholesaler"), false, "no night freight on day 1");
  assert.equal(buyPantry(c, "black", "market"), true);
  c.day = 3;
  assert.equal(buyPantry(c, "black", "wholesaler"), true);
  assert.equal(buyPantry(c, "black", "cooperative"), false, "the co-op opens on day 5");
});

test("opened: promotions from day 3, contracts by length, the daily shift from day 2", () => {
  const c = newShop("normal");
  assert.ok(MARKETING.every((m) => m.day === 3));
  assert.equal(bookMarketing(c, "flyers"), false);
  c.day = 3;
  assert.equal(bookMarketing(c, "flyers"), true);

  assert.deepEqual(GOAL_SCALE_DAYS, { shift: 1, week: 3, job: 5, season: 8 });
  const d = newShop("normal");
  const shift = GOALS.find((g) => g.scale === "shift" && g.day <= 1);
  const season = GOALS.find((g) => g.scale === "season" && g.day <= 1);
  assert.equal(selectGoal(d, shift.id), true);
  assert.equal(selectGoal(d, season.id), false, "season contracts wait for day 8");
  assert.ok(!goalScaleOpen(d, "week") && goalScaleOpen({ ...d, day: 3 }, "week"));
  d.expansion.selectedGoals.push(season.id); // a save that took one earlier
  assert.equal(selectGoal(d, season.id), true, "a contract already taken can still be dropped");
  assert.ok(!d.expansion.selectedGoals.includes(season.id));

  assert.equal(DAILY_DAY, 2);
});

test("opened: the test kitchen's day jump brings the opening crates of every day it passes", async () => {
  const { jumpToDay } = await import("../src/lib/arcade/order-up/engine/cheats.ts");
  const c = newShop("normal");
  jumpToDay(c, 5);
  for (const id of ["jasmine", "taro", "oat", "pudding"]) assert.ok(stock(c, id) > 0, id);
});
