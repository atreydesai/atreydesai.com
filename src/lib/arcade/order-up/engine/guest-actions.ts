/** Guest decisions operate on tickets; the UI never fabricates recipes or grades. */
import type { Campaign } from "../../orders-campaign.ts";
import type { Shift, Ticket } from "./shift-types.ts";
import { freshCup } from "./shift-types.ts";
import { RECIPE_BY_ID, RECIPES } from "../content/index.ts";
import { hash } from "./random.ts";
import { metric } from "./progression.ts";
export function memoryChoices(c: Campaign, t: Ticket) {
  const recipe = RECIPE_BY_ID[t.recipe];
  const alternatives = RECIPES.filter(
    (r) => r.id !== t.recipe && r.day <= c.day && (!r.shops.length || r.shops.includes(c.expansion.activeShop)),
  );
  const sameFamily = alternatives.filter((r) => r.family === recipe.family);
  const options = [recipe, ...(sameFamily.length >= 2 ? sameFamily : alternatives).slice(0, 3)];
  return options.sort((a, b) => hash(a.id + t.guest) - hash(b.id + t.guest));
}
export function rememberUsual(c: Campaign, s: Shift, recipe: string, slot = s.selected) {
  const t = s.tickets[slot];
  if (!t || !t.usual || t.revealed || s.status === "complete" || !memoryChoices(c, t).some((r) => r.id === recipe))
    return false;
  if (recipe !== t.recipe) {
    t.patience = Math.max(0, t.patience - 5);
    s.notice = "That isn't their usual.";
    s.noticeAt = s.realElapsed;
    metric(c, "memory-misses");
    return false;
  }
  t.revealed = true;
  metric(c, "remembered");
  s.notice = "You remembered.";
  s.noticeAt = s.realElapsed;
  return true;
}
export function acceptChange(c: Campaign, s: Shift, slot = s.selected) {
  const t = s.tickets[slot],
    next = t?.changeTo && RECIPE_BY_ID[t.changeTo];
  if (!t || !next || next.day > c.day || s.status === "complete") return false;
  // Ingredients already used stay used. Unstarted cups have not spent anything.
  const wasted = t.cups.filter((cup) => cup.started).length;
  if (wasted) metric(c, "remade", wasted);
  t.recipe = next.id;
  t.cups = t.cups.map(() => freshCup(next.id));
  t.cupIndex = 0;
  t.changeTo = null;
  t.usual = false;
  t.revealed = true;
  t.patience = Math.min(t.maxPatience, t.patience + 8);
  s.notice = "The new request is on the ticket.";
  s.noticeAt = s.realElapsed;
  return true;
}
export function keepOriginal(c: Campaign, s: Shift, slot = s.selected) {
  const t = s.tickets[slot];
  if (!t?.changeTo || s.status === "complete") return false;
  t.changeTo = null;
  for (const cup of t.cups) cup.damage = Math.min(100, cup.damage + 15);
  s.notice = "The original drink stays, with a smaller grade.";
  s.noticeAt = s.realElapsed;
  metric(c, "kept-orders");
  return true;
}
