import { machineDefinition, machineAt } from "./equipment.ts";
import type { Campaign, IngredientId } from "../../orders-campaign.ts";
import type { Recipe } from "../content/schema.ts";
import { INGREDIENTS, INGREDIENT_BY_ID, MACHINES } from "../content/index.ts";
import { calendar, seasonalPrice } from "./calendar.ts";
import { TUNING } from "./tuning.ts";
import { INGREDIENTS as FIRST_CAMPAIGN_INGREDIENTS } from "../content/legacy-economy.ts";
import { hasNode } from "./tree-nodes.ts";
import { staffOnDuty } from "./management.ts";
/**
 * The suppliers, each from the day it opens. The market is small and now;
 * the night freight is the cheapest unit, for what sells fast; the co-op's
 * big crates keep five days longer, for what sells steadily but slowly.
 */
export const SUPPLIER_OFFERS = [
  { id: "market", name: "corner market", quantity: 4, delay: 0, factor: 1, life: 0, day: 1 },
  { id: "wholesaler", name: "night freight", quantity: 16, delay: 1, factor: 0.72, life: 0, day: 3 },
  { id: "cooperative", name: "orchard co-op", quantity: 24, delay: 2, factor: 0.8, life: 5, day: 5 },
] as const;
export function pantryLots(c: Campaign) {
  return [...c.inventory, ...c.expansion.extraInventory];
}
export function stock(c: Campaign, id: string) {
  return pantryLots(c)
    .filter((l) => l.ingredient === id && l.expiresOn > c.day)
    .reduce((n, l) => n + l.quantity, 0);
}
export function pantryCount(c: Campaign) {
  return pantryLots(c).reduce((n, l) => n + l.quantity, 0) + c.expansion.shipments.reduce((n, l) => n + l.quantity, 0);
}
export function pantryCapacity(c: Campaign) {
  return (
    360 + (hasNode(c, "room-utility") ? 60 : 0) - (hasNode(c, "back-service-rack") ? 24 : 0) -
    (hasNode(c, "prep-hold-bath") ? 24 : 0) +
    Object.entries(c.expansion.machines).reduce(
      (n, [id, m]) => n + (machineDefinition(id)?.effect === "capacity" ? m.tier * 80 : 0),
      0,
    )
  );
}
export function addStock(c: Campaign, id: string, quantity: number, lifeBonus = 0, expiresOn?: number) {
  const ingredient = INGREDIENT_BY_ID[id];
  quantity = Math.max(0, Math.floor(quantity));
  if (!ingredient || !quantity) return 0;
  quantity = Math.min(quantity, Math.max(0, pantryCapacity(c) - pantryCount(c)));
  if (!quantity) return 0;
  const cold = Object.entries(c.expansion.machines).reduce(
    (n, [id, m]) => n + (machineDefinition(id)?.effect === "freshness" ? m.tier : 0),
    0,
  );
  const seasonal = ingredient.season === calendar(c.day).season.id ? 1.3 : ingredient.season === "all" ? 1 : 0.8;
  const expires =
    expiresOn ??
    c.day +
      Math.max(
        1,
        Math.floor(ingredient.shelfLife * TUNING[c.mode].shelfLife * seasonal) + Math.min(5, cold) + lifeBonus,
      );
  if (ingredient.legacy)
    c.inventory.push({ id: c.nextId++, ingredient: id as IngredientId, quantity, expiresOn: expires });
  else
    c.expansion.extraInventory.push({
      id: c.expansion.nextId++,
      ingredient: id,
      quantity,
      expiresOn: expires,
      shelf: 0,
    });
  return quantity;
}
export function useStock(c: Campaign, id: string, quantity: number) {
  quantity = Math.max(0, Math.floor(quantity));
  if (stock(c, id) < quantity) return false;
  const lots = pantryLots(c)
    .filter((l) => l.ingredient === id && l.expiresOn > c.day)
    .sort((a, b) => a.expiresOn - b.expiresOn || a.id - b.id);
  for (const lot of lots) {
    const used = Math.min(quantity, lot.quantity);
    lot.quantity -= used;
    quantity -= used;
    if (!quantity) break;
  }
  c.inventory = c.inventory.filter((l) => l.quantity > 0);
  c.expansion.extraInventory = c.expansion.extraInventory.filter((l) => l.quantity > 0);
  return true;
}
export function requirements(recipe: Recipe) {
  return recipe.ingredients.map((i) => ({ ...i, quantity: i.quantity * (recipe.size === 2 ? 2 : 1) }));
}
function serviceRequirements(c: Campaign, recipe: Recipe) {
  const ingredients = requirements(recipe);
  if (hasNode(c, "menu-tasting-card") && c.expansion.prices[recipe.family] === 2) {
    const honey = ingredients.find((item) => item.id === "honey");
    if (honey) honey.quantity++;
    else ingredients.push({ id: "honey", quantity: 1 });
  }
  return ingredients;
}
export function canMake(c: Campaign, recipe: Recipe) {
  return (
    recipe.day <= c.day &&
    serviceRequirements(c, recipe).every((i) => stock(c, i.id) >= i.quantity) &&
    (recipe.hot || c.expansion.ice >= recipe.ice)
  );
}
export function consumeRecipe(c: Campaign, recipe: Recipe) {
  if (!canMake(c, recipe)) return false;
  for (const ingredient of serviceRequirements(c, recipe)) useStock(c, ingredient.id, ingredient.quantity);
  if (!recipe.hot) c.expansion.ice = Math.max(0, c.expansion.ice - recipe.ice);
  return true;
}
function supplierTerms(c: Campaign, supplier: string) {
  const offer = SUPPLIER_OFFERS.find((item) => item.id === supplier);
  if (!offer) return null;
  const runner = supplier === "market" && c.status === "open" && hasNode(c, "pantry-market-call")
    ? staffOnDuty(c).find((person) => person.role === "runner" && person.energy >= 20) : undefined;
  if (runner) return { ...offer, quantity: 2, factor: 1.3, runner };
  if (supplier === "wholesaler" && hasNode(c, "pantry-night-freight"))
    return { ...offer, quantity: 24, factor: 0.60, runner };
  if (supplier === "cooperative" && hasNode(c, "pantry-orchard-crate"))
    return { ...offer, quantity: 32, delay: 3, life: 8, runner };
  return { ...offer, runner };
}

export function stockPrice(c: Campaign, id: string, supplier = "market") {
  const ingredient = INGREDIENT_BY_ID[id],
    offer = supplierTerms(c, supplier);
  if (!ingredient || !offer) return Infinity;
  const today = calendar(c.day);
  const discount = today.weekDay === 2 ? 0.85 : 1;
  return Math.round(
    ingredient.price *
      offer.quantity *
      offer.factor *
      TUNING[c.mode].purchase *
      seasonalPrice(id, c.day) *
      today.event.price *
      discount,
  );
}
export function buyPantry(c: Campaign, id: string, supplier = "market") {
  const ingredient = INGREDIENT_BY_ID[id],
    offer = supplierTerms(c, supplier);
  if (!ingredient || !offer || ingredient.day > c.day || offer.day > c.day) return false;
  const price = stockPrice(c, id, supplier);
  if (c.cash < price || pantryCount(c) + offer.quantity > pantryCapacity(c)) return false;
  c.cash -= price;
  if (offer.runner) offer.runner.energy -= 12;
  const delay = offer.runner ? 0 : offer.delay + (calendar(c.day).event.effect === "delayed" ? 1 : 0);
  if (delay === 0) addStock(c, id, offer.quantity, offer.life);
  else
    c.expansion.shipments.push({
      ingredient: id,
      quantity: offer.quantity,
      supplier: offer.id,
      arrivesOn: c.day + delay,
      expiresOn: c.day + delay + Math.max(1, Math.floor(ingredient.shelfLife * TUNING[c.mode].shelfLife)) + offer.life,
    });
  return true;
}
export function rotateStock(c: Campaign, id: string, shelf: number) {
  const lots = pantryLots(c)
    .filter((l) => l.ingredient === id)
    .sort((a, b) => a.expiresOn - b.expiresOn);
  for (const [i, lot] of lots.entries())
    c.expansion.shelves[String(lot.id)] = Math.max(0, Math.min(15, shelf)) * 100 + i;
  c.inventory.sort((a, b) => (c.expansion.shelves[String(a.id)] ?? 9999) - (c.expansion.shelves[String(b.id)] ?? 9999));
  c.expansion.extraInventory.sort(
    (a, b) => (c.expansion.shelves[String(a.id)] ?? 9999) - (c.expansion.shelves[String(b.id)] ?? 9999),
  );
  return lots.length > 0;
}
export function expireAndDeliver(c: Campaign) {
  let expired = pantryLots(c)
    .filter((l) => l.expiresOn <= c.day)
    .reduce((n, l) => n + l.quantity, 0);
  const warmedDay = c.expansion.metrics["warm-pearls-day"];
  if (warmedDay && warmedDay < c.day) {
    delete c.expansion.metrics["warm-pearls-day"];
    const discarded = Math.ceil(c.expansion.pearls / 2);
    c.expansion.pearls -= discarded;
    expired += discarded;
  }
  c.inventory = c.inventory.filter((l) => l.expiresOn > c.day);
  c.expansion.extraInventory = c.expansion.extraInventory.filter((l) => l.expiresOn > c.day);
  if (Object.keys(c.expansion.machines).some((key) => machineDefinition(key)?.id === "compost")) c.cash += expired * 3;
  c.expansion.metrics.waste = (c.expansion.metrics.waste ?? 0) + expired;
  const shipments = c.expansion.shipments.filter((s) => s.arrivesOn <= c.day),
    old = c.deliveries.filter((s) => s.arrivesOn <= c.day);
  c.expansion.shipments = c.expansion.shipments.filter((s) => s.arrivesOn > c.day);
  c.deliveries = c.deliveries.filter((s) => s.arrivesOn > c.day);
  for (const lot of [...shipments, ...old])
    if (lot.expiresOn > c.day) addStock(c, lot.ingredient, lot.quantity, 0, lot.expiresOn);
  return expired;
}
/**
 * A one-time crate makes each ingredient's debut playable, not a cash gate.
 * A first-campaign ingredient's crate is its old opening stock, which a new
 * shop no longer holds from day 1; a save that still holds some gets none.
 */
export function openingGifts(c: Campaign) {
  if (c.expansion.giftedDays.includes(c.day)) return;
  for (const ingredient of INGREDIENTS.filter((i) => i.day === c.day)) {
    if (!ingredient.legacy) addStock(c, ingredient.id, 6);
    else if (stock(c, ingredient.id) === 0) {
      const first = FIRST_CAMPAIGN_INGREDIENTS.find((x) => x.id === ingredient.id);
      addStock(c, ingredient.id, (first?.openingStock ?? 6) + (c.mode === "normal" ? 4 : 0));
    }
  }
  c.expansion.giftedDays.push(c.day);
}
export function emergencyRestock(c: Campaign) {
  for (const i of INGREDIENTS.filter((i) => i.day <= c.day)) {
    const short = Math.max(0, 4 - stock(c, i.id));
    if (short) addStock(c, i.id, short, 0, c.day + 1);
  }
  c.expansion.ice = Math.max(c.expansion.ice, 40);
}
