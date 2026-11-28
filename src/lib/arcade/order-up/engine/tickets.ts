import type { Campaign } from "../../orders-campaign.ts";
import type { Recipe } from "../content/schema.ts";
import type { Shift, Ticket } from "./shift-types.ts";
import { freshCup } from "./shift-types.ts";
import { RECIPES, RECIPE_BY_ID, GUESTS, GUEST_BY_ID, SPECIAL_GUESTS, GOALS } from "../content/index.ts";
import { canMake } from "./pantry.ts";
import { calendar } from "./calendar.ts";
import { comfort, staffOnDuty } from "./management.ts";
import { TUNING, phaseAt } from "./tuning.ts";
import { random, pick } from "./random.ts";
import { hasNode } from "./tree-nodes.ts";
import { brewMod } from "./upgrades.ts";

function outageMenu(c: Campaign) {
  return hasNode(c, "event-outage-plan") && calendar(c.day).event.effect === "power-cut" && brewMod(c)?.id === "brew-gravity";
}
export function availableRecipes(c: Campaign, stocked = true): Recipe[] {
  const recipes = RECIPES.filter(
    (r) =>
      r.day <= c.day && (!r.shops.length || r.shops.includes(c.expansion.activeShop)) && (!stocked || canMake(c, r)),
  );
  if (!outageMenu(c)) return recipes;
  return recipes.filter((r) => r.steps.includes("steep") &&
    !r.steps.some((step) => ["milk-ratio", "layered-pour", "kettle-heat"].includes(step)));
}
export function draw(s: Shift) {
  const r = random(s.seed || 1);
  s.seed = r.seed;
  return r.value;
}
export function spawnTicket(
  c: Campaign,
  s: Shift,
  forced?: { guest?: string; recipe?: string; special?: string; count?: number },
) {
  const slot = s.tickets.findIndex((t) => !t);
  if (slot < 0) return null;
  const menu = availableRecipes(c);
  if (!menu.length) {
    s.notice = "The pantry is out of what the menu needs.";
    s.noticeAt = s.realElapsed;
    return null;
  }
  const today = calendar(c.day),
    eligible = GUESTS.filter((g) => g.day <= c.day && menu.some((r) => r.id === g.favorite));
  const debut = eligible.filter((g) => g.day === c.day);
  const loyalty = c.expansion.marketing === "loyalty" && hasNode(c, "promo-loyalty-stamp", s.shop) &&
    staffOnDuty(c, s.shop).some((person) => person.role === "host");
  const quiet = today.event.arrival <= 0.9 && hasNode(c, "event-quiet-plan", s.shop);
  const returning = loyalty || quiet ? eligible.filter((g) => (c.expansion.visits[g.id] ?? 0) > 0) : [];
  const guests = returning.length ? returning : debut.length && s.arrivals < 2 ? debut : eligible;
  const guest = forced?.guest ? GUEST_BY_ID[forced.guest] : (guests[Math.floor(draw(s) * guests.length)] ?? GUESTS[0]);
  const newRecipe = menu.filter((r) => r.day === c.day),
    featured = menu.filter((r) => r.family === c.expansion.windowDisplay);
  let recipe = forced?.recipe
    ? RECIPE_BY_ID[forced.recipe]
    : s.arrivals === 0 && newRecipe.length
      ? newRecipe[0]
      : draw(s) < (hasNode(c, "decor-menu-window", s.shop) ? 0.43 : 0.18) && featured.length
        ? pick(featured, s.seed)
        : RECIPE_BY_ID[guest.favorite];
  if (!forced?.recipe && recipe?.id === guest.favorite && draw(s) < 0.28) {
    const variations = guest.variations.map((id) => RECIPE_BY_ID[id]).filter((r) => r && canMake(c, r));
    if (variations.length) recipe = variations[Math.floor(draw(s) * variations.length)];
  }
  if (!recipe || !canMake(c, recipe) || (outageMenu(c) && !menu.includes(recipe)))
    recipe = menu[Math.floor(draw(s) * menu.length)];
  const specialPool = SPECIAL_GUESTS.filter((g) => g.day <= c.day),
    newSpecial = specialPool.find((g) => g.day === c.day);
  let special = forced?.special
    ? SPECIAL_GUESTS.find((g) => g.id === forced.special)
    : s.arrivals === 1 && newSpecial
      ? newSpecial
      : draw(s) < 0.14 && specialPool.length
        ? specialPool[Math.floor(draw(s) * specialPool.length)]
        : null;
  if (s.elapsed > s.duration * 0.9 && specialPool.some((x) => x.id === "closer"))
    special = specialPool.find((x) => x.id === "closer");
  if (today.holiday && s.arrivals === 2) special = specialPool.find((x) => x.id === today.holiday!.guest) ?? special;
  const express = hasNode(c, "front-express-rail", s.shop);
  if (express && special?.id !== "courier" && s.tickets.filter((ticket) => !ticket).length === 1) return null;
  if (special?.id === "cat" && c.expansion.cat) special = null;
  if (special?.id === "nurse" || s.shop === "lodge" || today.event.effect === "hot") {
    const hot = menu.filter((r) => r.hot);
    if (hot.length) recipe = hot[Math.floor(draw(s) * hot.length)];
  }
  if (s.shop === "boardwalk" || today.holiday?.rule === "ice") {
    const slush = menu.filter((r) => r.family === "slush");
    if (slush.length) recipe = slush[Math.floor(draw(s) * slush.length)];
  }
  let count = forced?.count ?? special?.size ?? 1;
  if (c.day >= 20 && draw(s) < 0.12 * TUNING[c.mode].orderSize) count = Math.max(count, 2);
  if (s.shop === "loft" && s.arrivals % 4 === 1) count = Math.max(count, 3);
  let job: string | null = null;
  const catering = c.expansion.selectedGoals
    .map((id) => GOALS.find((g) => g.id === id))
    .find((g) => g?.scale === "job");
  if (catering && s.arrivals === 2) {
    count = Math.max(3, Math.min(12, catering.target));
    job = catering.id;
    special = SPECIAL_GUESTS.find((x) => x.id === "group") ?? special;
  }
  if (s.shop === "commissary") {
    count = 6;
    job = "commissary";
    special = null;
  }
  count = Math.max(1, Math.min(12, count));
  const tune = TUNING[c.mode],
    host = staffOnDuty(c).some((p) => p.role === "host"),
    base = c.day <= 5 ? tune.firstDaysPatience : tune.patienceSeconds;
  let patience =
    base *
    (guest?.patience ?? 1) *
    (special?.patience ?? 1) *
    today.event.patience *
    (1 + comfort(c)) *
    (host ? 1.16 : 1) *
    (1 + (count - 1) * 0.7);
  if (s.shop === "station") patience = Math.min(patience, 40 + (s.arrivals % 3) * 12);
  if (s.shop === "garden") patience *= 1.2;
  if (hasNode(c, "front-greeting-post", s.shop)) patience *= 1.06;
  if (hasNode(c, "crew-hospitality", s.shop) && host) patience *= 1.12;
  if (c.expansion.marketing === "radio" && hasNode(c, "promo-radio-window", s.shop) &&
      phaseAt(s.elapsed, s.duration).includes("rush")) patience *= 0.82;
  if (hasNode(c, "decor-regular-shelf", s.shop) && (c.expansion.visits[guest.id] ?? 0) > 0)
    patience *= 1.18;
  let memoryGuest: string | null = null;
  if (special?.id === "grandparent") {
    const linked = eligible.filter((g) => g.id !== guest.id);
    const relative = linked[Math.floor(draw(s) * linked.length)] ?? guest;
    memoryGuest = relative.id;
    recipe = RECIPE_BY_ID[relative.favorite];
  }
  const usual = special?.id === "grandparent" || ((c.expansion.visits[guest.id] ?? 0) >= 4 && draw(s) < 0.35);
  const ticket: Ticket = {
    id: s.nextId++,
    slot,
    guest: s.shop === "commissary" ? "" : guest.id,
    special: special?.id ?? null,
    recipe: recipe.id,
    cups: Array.from({ length: count }, () => freshCup(recipe.id)),
    cupIndex: 0,
    patience,
    maxPatience: patience,
    arrived: s.elapsed,
    usual,
    revealed: !usual,
    changed: false,
    sleeping: special?.id === "commuter",
    vip: false,
    packed: count >= 3 || special?.id === "courier",
    name: s.shop === "commissary" ? "supply tray" : guest.name,
    job,
    changeTo: null,
    memoryGuest,
    refills: 0,
    pickupAt: special?.id === "courier" ? s.elapsed + (express ? 6 : 12) : null,
  };
  s.tickets[slot] = ticket;
  s.arrivals++;
  if (!s.tickets[s.selected]) s.selected = slot;
  return ticket;
}
/**
 * Whether a guest stays on after their cup and orders again: the crammer (up
 * to twice), and now and then a student settled in with one cup (once).
 */
export function refillsFor(t: Ticket) {
  if (t.special === "crammer") return 2;
  const student = GUEST_BY_ID[t.guest]?.story?.[0]?.prop === "book";
  return !t.special && t.cups.length === 1 && student && t.id % 3 === 0 ? 1 : 0;
}
export function selectedTicket(s: Shift) {
  return s.tickets[s.selected] ?? null;
}
export function activeCup(t: Ticket) {
  return t.cups[t.cupIndex] ?? t.cups[0];
}
export function selectTicket(s: Shift, direction: number) {
  for (let n = 1; n <= s.tickets.length; n++) {
    const i = (s.selected + direction * n + s.tickets.length * 2) % s.tickets.length;
    if (s.tickets[i]) {
      s.selected = i;
      return true;
    }
  }
  return false;
}
