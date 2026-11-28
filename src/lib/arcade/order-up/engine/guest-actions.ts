/** Guest decisions operate on tickets; the UI never fabricates recipes or grades. */
import type { Campaign } from "../../orders-campaign.ts";
import type { Shift, Ticket } from "./shift-types.ts";
import { freshCup } from "./shift-types.ts";
import { RECIPE_BY_ID, RECIPES } from "../content/index.ts";
import { hash } from "./random.ts";
import { metric } from "./progression.ts";
import { GARDEN_FEATURE, WAIT_ESTIMATE } from "../content/service-program.ts";
import { gardenFeatureReady } from "./service-program.ts";
import { canMake } from "./pantry.ts";
import { treeChoiceOpen } from "./opened.ts";
import { staffOnDuty } from "./management.ts";
import { hasNode } from "./tree-nodes.ts";

function openHere(c: Campaign, s: Shift) {
  return c.status === "open" && s.status === "open" && s.day === c.day && s.mode === c.mode &&
    s.shop === c.expansion.activeShop;
}

export function giveWaitEstimate(c: Campaign, s: Shift, slot = s.selected) {
  const t = s.tickets[slot];
  if (
    !openHere(c, s) || !t || t.special || t.job || t.usual || t.changeTo ||
    t.featured || t.expectedAt !== undefined || s.hostCheckIn || t.cups.every((cup) => cup.ready) ||
    s.elapsed - t.arrived < WAIT_ESTIMATE.minimumWait || t.patience > t.maxPatience * 0.55 ||
    !treeChoiceOpen(c, "guest-wait-estimate") || !staffOnDuty(c, s.shop).some((person) => person.role === "host")
  ) return false;
  const delay = WAIT_ESTIMATE.delay + (hasNode(c, "front-host-stand", s.shop) ? 6 : 0);
  t.expectedAt = s.elapsed + delay;
  t.patience = Math.min(t.maxPatience, t.patience + delay);
  s.hostCheckIn = true;
  s.notice = "The guest will wait a little longer.";
  s.noticeAt = s.realElapsed;
  return true;
}

export function canOfferGardenFeature(c: Campaign, s: Shift, slot = s.selected): boolean {
  const t = s.tickets[slot];
  if (
    !openHere(c, s) || !t || t.special || t.job || t.sleeping || t.usual || t.changed ||
    t.changeTo || t.expectedAt !== undefined ||
    t.cups.length !== 1 || t.cups[0].started || t.patience < t.maxPatience * 0.65
  ) return false;
  const weather = s.effects.weather;
  const backupPower = !!weather && (weather.charges > 0 || weather.until > s.realElapsed);
  return gardenFeatureReady(c, s.shop, backupPower) && treeChoiceOpen(c, "guest-garden-offer") &&
    canMake(c, RECIPE_BY_ID[GARDEN_FEATURE.recipe]);
}

export function offerGardenFeature(c: Campaign, s: Shift, slot = s.selected) {
  if (!canOfferGardenFeature(c, s, slot)) return false;
  const t = s.tickets[slot]!;
  t.recipe = GARDEN_FEATURE.recipe;
  t.cups = [freshCup(GARDEN_FEATURE.recipe)];
  t.cupIndex = 0;
  t.featured = true;
  c.expansion.gardenFeature.lastOfferDay = c.day;
  s.notice = "The guest chose the house tea.";
  s.noticeAt = s.realElapsed;
  return true;
}
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
