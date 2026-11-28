import {
  blankPowerups, campaignEffects, campaignPowerupBlockReason, consumeIngredients, deliveryShelfLife, eventForDay, FRUIT_INGREDIENTS, INGREDIENTS,
  INGREDIENT_UNLOCK_DAYS, runnerHandoffSeconds, stockCount, usePowerup,
  type BranchId, type Campaign, type CampaignEffects, type CrewId, type DayEvent, type IngredientId, type IngredientPortions, type PowerupId,
} from "./orders-campaign.ts";
import { orderFeedback } from "./orders-feedback.ts";
import { CATERING_COURIER_TRAVEL, cateringOffer, type CateringOffer } from "./orders-catering.ts";
import type { RecipeRecords } from "./orders-recipe-journal.ts";
export { RUNNER_HANDOFF_SECONDS } from "./orders-campaign.ts";

export type TeaId = "black" | "jasmine" | "taro";
export const MIXED_TEA_DAY = 21;
export type MilkId = "milk" | "oat";
export const SYRUPS = ["brown-sugar", "honey", "vanilla", "sesame-syrup"] as const;
export type SyrupId = typeof SYRUPS[number];
export const FLOAT_FLAVORS = ["banana-scoop", "vanilla-scoop"] as const;
export type FloatFlavor = typeof FLOAT_FLAVORS[number];
export type Level = 0 | 1 | 2 | 3;
export type OrderStatus = "waiting" | "accepted" | "brewing" | "building" | "served" | "missed";
export type ServiceEffects = CampaignEffects & { sideBonus: number; icedBonus: number; sparklingBonus: number };

export type PrepId = "pearls" | "bun" | "waffle";
type PrepQuality = Partial<Record<PrepId, number[]>>;

export interface HouseBlend {
  tea: TeaId;
  accentTea?: TeaId;
  milk: MilkId | null;
  topping: IngredientId | null;
  fruit: IngredientId | null;
  syrup: SyrupId;
  sugar: Level;
  ice: Level;
  float?: FloatFlavor;
  sparkling?: true;
}

export interface Recipe {
  name: string;
  tea: TeaId;
  accentTea?: TeaId;
  milk: MilkId | null;
  toppings: IngredientId[];
  mixins: IngredientId[];
  syrup: SyrupId;
  sugar: Level;
  ice: Level;
  bun: boolean;
  waffle?: true;
  foam?: boolean;
  sparkling?: true;
  float?: FloatFlavor;
}

export function recipeSide(recipe: Recipe): "bun" | "waffle" | null {
  return recipe.waffle ? "waffle" : recipe.bun ? "bun" : null;
}

export interface ServiceCup {
  tea: TeaId;
  accentTea?: TeaId;
  milk: MilkId | null;
  brew: { elapsed: number; target: number; quality: number | null; done: boolean; carafeFill?: true };
  ingredients: IngredientPortions;
  ice: Level;
  shaken: boolean;
  finishTouchedAt?: number;
  foamed?: boolean;
  sparkling?: boolean;
  float?: { flavor: FloatFlavor; scoopedAt: number };
  sealed: boolean;
  sealedAt?: number;
  qualityBonus: number;
  prepQuality: PrepQuality;
}

export interface IngredientSwap {
  from: IngredientId;
  to: IngredientId;
  amount: number;
}

export interface ServiceOrder {
  id: string;
  customerId: string;
  customerName: string;
  tag: string;
  arrivesAt: number;
  /** Remaining seconds. Time drains more slowly while a cup is on the workbench. */
  patience: number;
  maxPatience: number;
  status: OrderStatus;
  recipe: Recipe;
  cup: ServiceCup | null;
  specialRequest?: { line: string; bonus: number };
  locationSpecial?: BranchId;
  seasonalSpecial?: string;
  reservation?: true;
  catering?: true;
  houseBlend?: true;
  swap?: IngredientSwap;
}

export interface PrepBatch {
  cooking: boolean;
  elapsed: number;
  target: number;
  ready: number;
  quality: number;
  cookedAt: number | null;
}

export interface ServiceReceipt {
  orderId: string;
  customerId: string;
  customerName: string;
  recipeName: string;
  quality: number;
  revenue: number;
  tips: number;
  specialBonus?: number;
  menuBonus?: number;
  handedOffBy?: "runner";
  packedAt?: number;
  grades: { brew: number; build: number; finish: number; wait: number };
  message: string;
}

export interface ServiceDay {
  day: number;
  expert: boolean;
  status: "open" | "closing" | "complete";
  elapsed: number;
  duration: number;
  preOpen?: number;
  orders: ServiceOrder[];
  pearls: PrepBatch;
  buns: PrepBatch;
  waffles: PrepBatch;
  receipts: ServiceReceipt[];
  usage: IngredientPortions;
  effects: ServiceEffects;
  powerups: Record<PowerupId, number>;
  notice: string;
  streak: number;
  houseRoundReady: boolean;
  houseRoundAt?: number;
  quietUntil?: number;
  carafe?: { tea: TeaId; quality: number; filledAt: number };
  crewActivity?: Partial<Record<CrewId, string>>;
  orderPlan?: ServicePlan;
  pendingDelivery?: ExpressDelivery;
  reservation?: ReservationOffer;
  catering?: string;
}

export interface ReservationOffer {
  name: string;
  count: number;
  reward: number;
  minQuality: number;
  arrivesAt: number;
}

export interface ExpressDelivery {
  ingredient: IngredientId;
  cost: number;
  quantity: number;
  arrivesAt: number;
}

export interface ServicePlan {
  orders: number;
  fruit: number;
  buns: number;
  special: boolean;
}

export function servicePlan(orders: readonly ServiceOrder[]): ServicePlan {
  return {
    orders: orders.length,
    fruit: orders.filter(({ recipe }) => recipe.mixins.length > 0).length,
    buns: orders.filter(({ recipe }) => recipe.bun).length,
    special: orders.some(({ specialRequest }) => !!specialRequest),
  };
}

export type ServiceState = ServiceDay;

export interface ServiceSummary {
  shiftScore: number;
  revenue: number;
  tips: number;
  served: number;
  quality: number;
  missed: number;
  regularVisits: Record<string, number>;
}

interface DayOptions {
  day: number;
  expert: boolean;
  reserveTable?: boolean;
  startPrep?: boolean;
  bookCatering?: boolean;
  houseBlend?: HouseBlend;
  upgrades?: readonly string[];
  activeCrew?: readonly CrewId[];
  activeBranch?: Campaign["activeBranch"];
  branchFittings?: readonly BranchId[];
  publicity?: Campaign["publicity"];
  highestReputation?: number;
  certifiedCrew?: readonly CrewId[];
  event?: DayEvent;
  regularVisits?: Readonly<Record<string, number>>;
}

const TEAS = ["black", "jasmine", "taro"] as const;
const MILKS = ["milk", "oat"] as const;
export const TOPPINGS = ["pearls", "popping", "pudding", "grass-jelly"] as const;
export const MIXINS = FRUIT_INGREDIENTS;
const ICE_LEVELS = [0, 1, 2, 3] as const;
const BUILD_INGREDIENTS = [...TOPPINGS, ...MIXINS, ...SYRUPS, "bun", "waffle"] as const;
export function unlockedIngredients(day: number): IngredientId[] {
  return INGREDIENTS.filter(({ id }) => INGREDIENT_UNLOCK_DAYS[id] <= day).map(({ id }) => id);
}

export function normalizeHouseBlend(value: unknown, day: number): HouseBlend | null {
  if (!Number.isSafeInteger(day) || day < 1 || !isRecord(value)) return null;
  const { tea, accentTea, milk, topping, fruit, syrup, sugar, ice, float, sparkling } = value;
  if (!isChoice(tea, TEAS) || (milk !== null && !isChoice(milk, MILKS)) ||
    (topping !== null && !isChoice(topping, TOPPINGS)) || (fruit !== null && !isChoice(fruit, MIXINS)) ||
    !isChoice(syrup, SYRUPS) || !isChoice(sugar, ICE_LEVELS) || !isChoice(ice, ICE_LEVELS) ||
    (float !== undefined && !isChoice(float, FLOAT_FLAVORS))) return null;
  if (accentTea !== undefined && (day < MIXED_TEA_DAY || !isChoice(accentTea, TEAS) || accentTea === tea)) return null;
  if (sparkling !== undefined && (sparkling !== true || day < INGREDIENT_UNLOCK_DAYS.seltzer || milk !== null || float !== undefined)) return null;
  if (![tea, milk, topping, fruit, syrup, float].every((id) => id == null || INGREDIENT_UNLOCK_DAYS[id] <= day)) return null;
  return { tea, milk, topping, fruit, syrup, sugar, ice, ...(float ? { float } : {}), ...(accentTea ? { accentTea } : {}),
    ...(sparkling ? { sparkling } : {}) };
}

export function recipeFromHouseBlend({ tea, accentTea, milk, topping, fruit, syrup, sugar, ice, float, sparkling }: HouseBlend): Recipe {
  const toppingName = topping === "pearls" ? "pearl" : topping === "popping" ? "popping boba" : topping === "grass-jelly" ? "grass jelly" : topping;
  const lead = fruit ?? (syrup === "sesame-syrup" && sugar ? "sesame" : toppingName ?? (milk === "oat" ? "oat" : null));
  const style = sparkling ? "spritz" : float ? "float" : milk === "milk" ? "milk tea" : "tea";
  const base = accentTea ? tea + " & " + accentTea : tea;
  const title = [lead, base, style].filter(Boolean).join(" ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { name: `House ${title}`, tea, milk, toppings: topping ? [topping] : [], mixins: fruit ? [fruit] : [], syrup, sugar, ice, bun: false,
    ...(float ? { float } : {}), ...(accentTea ? { accentTea } : {}), ...(sparkling ? { sparkling } : {}) };
}

import { REGULARS, RECIPE_BOOK, LOCATION_MENUS, EVENT_MENUS, favoritesByCustomer } from "./order-up/content/legacy-menu.ts";
export { REGULARS, RECIPE_BOOK, LOCATION_MENUS, EVENT_MENUS } from "./order-up/content/legacy-menu.ts";

function recipeAvailable(recipe: Recipe, day: number) {
  const ingredients = [recipe.tea, recipe.accentTea, recipe.milk, recipe.syrup, ...recipe.toppings, ...recipe.mixins, recipeSide(recipe), recipe.float, recipe.sparkling ? "seltzer" as const : null];
  return (!recipe.sparkling || (!recipe.foam && !recipe.float && recipe.milk === null)) && (!recipe.foam || day >= FROTH_DAY) && (!recipe.accentTea || day >= MIXED_TEA_DAY) &&
    ingredients.every((ingredient) => ingredient == null || INGREDIENT_UNLOCK_DAYS[ingredient] <= day);
}

function copyRecipe(recipe: Recipe): Recipe {
  return { ...recipe, toppings: [...recipe.toppings], mixins: [...recipe.mixins] };
}

function scheduleMenuFeatures(orders: ServiceOrder[], day: number, branch: BranchId | undefined, event: DayEvent) {
  if (day < 4) return;
  const debuts = new Set(REGULARS.filter((regular) => regular.day === day).map(({ id }) => id));
  const returning = orders.filter(({ customerId, specialRequest }) => !debuts.has(customerId) && !specialRequest);
  if (branch && branch !== "corner") {
    const local = LOCATION_MENUS[branch]?.filter((recipe) => recipeAvailable(recipe, day));
    const order = local?.length ? returning.shift() : undefined;
    if (local?.length && order) {
      order.recipe = copyRecipe(local[(day - 4) % local.length]);
      order.locationSpecial = branch;
    }
  }
  const seasonal = Object.hasOwn(EVENT_MENUS, event.id) ? EVENT_MENUS[event.id] : undefined;
  if (seasonal && returning.length && recipeAvailable(seasonal, day)) {
    const order = returning[Math.floor(returning.length / 2)];
    order.recipe = copyRecipe(seasonal);
    order.seasonalSpecial = event.id;
  }
}

const SPECIAL_REQUEST_BONUS = 125;
const SPECIAL_REQUESTS: Readonly<Record<string, { line: string; changes: Partial<Recipe> }>> = {
  mochi: { line: "Could I try oat milk today?", changes: { name: "Brown Sugar Oat Tea", milk: "oat" } },
  biscuit: { line: "Double the pearls, please.", changes: { name: "Double Pearl Milk Tea", toppings: ["pearls", "pearls"] } },
  juniper: { line: "A little ice today. I know, I know.", changes: { ice: 1 } },
  bean: { line: "One pump of honey today, please.", changes: { name: "Honey Black Tea", syrup: "honey", sugar: 1 } },
  tofu: { line: "Would it work with honey instead?", changes: { name: "Honey Black Tea", syrup: "honey" } },
  pip: { line: "Can I try the popping boba today?", changes: { name: "Iced Popping Boba Tea", toppings: ["popping"] } },
  nori: { line: "Could I have twice the strawberry?", changes: { name: "Double Strawberry Jasmine", mixins: ["strawberry", "strawberry"] } },
  clementine: { line: "And a warm bun if you have one.", changes: { name: "Jasmine Milk Tea & Bun", bun: true } },
  bao: { line: "No bun today. Can I try it with pearls?", changes: { name: "Honey Jasmine Pearl Tea", bun: false, toppings: ["pearls"] } },
  oats: { line: "Could you hold the ice? I have a long walk.", changes: { ice: 0 } },
  peaches: { line: "Skip the strawberry today. Banana on its own, please.", changes: { name: "Banana Pop Milk Tea", mixins: ["banana"] } },
  dumpling: { line: "I'd like pudding in place of pearls today.", changes: { name: "Taro Pudding Milk Tea & Bun", toppings: ["pudding"] } },
  pudding: { line: "Two scoops of pudding this time, please.", changes: { name: "Double Pudding Taro", toppings: ["pudding", "pudding"] } },
  sprout: { line: "Could I have banana in place of strawberry?", changes: { name: "Banana Shortcake Tea", mixins: ["banana"] } },
  figgy: { line: "Could you make it with oat milk and no ice?", changes: { milk: "oat", ice: 0 } },
  miso: { line: "Extra popping boba to go with the ice, please.", changes: { toppings: ["popping", "popping"] } },
  basil: { line: "May I have pearls with my bun today?", changes: { name: "Jasmine Oat Pearl Tea & Bun", toppings: ["pearls"] } },
  maple: { line: "Let's do one pump of brown sugar today, chef.", changes: { sugar: 1 } },
  kiwi: { line: "Just strawberry with the pudding this time.", changes: { name: "Strawberry Pudding Tea", mixins: ["strawberry"] } },
  honey: { line: "I'll try that with oat milk today.", changes: { milk: "oat" } },
  rye: { line: "No bun today. Could I get honey instead of brown sugar?", changes: { name: "Honey Mango Jelly Taro Cloud", bun: false, syrup: "honey" } },
  sesame: { line: "Pudding only today, please. Save the pearls for later.", changes: { name: "Vanilla Oat Pudding Tea", toppings: ["pudding"] } },
  yuzu: { line: "Could you make it one pump of honey? And no ice.", changes: { sugar: 1, ice: 0 } },
  lychee: { line: "Pudding in place of the popping boba today, please.", changes: { name: "Strawberry Jasmine Pudding Tea & Waffle", toppings: ["pudding"] } },
  pepper: { line: "Could I have dairy milk this time?", changes: { milk: "milk" } },
  cocoa: { line: "No banana this morning. A pump of vanilla would be lovely.", changes: { name: "Vanilla Pearl Black Tea & Bun", mixins: [], syrup: "vanilla", sugar: 1 } },
  chai: { line: "A cold one today. One pudding scoop and banana ice cream.", changes: { name: "Double Banana Taro Float & Bun", toppings: ["pudding"], float: "banana-scoop", ice: 3 } },
  noodle: { line: "Could I keep the double mango and swap the jelly for pearls?", changes: { name: "Double Mango Pearl Jasmine Cloud", toppings: ["pearls"] } },
  pickles: { line: "Could I try strawberries and vanilla syrup?", changes: { name: "Strawberry Banana Jelly Float", toppings: ["grass-jelly"], mixins: ["strawberry"], syrup: "vanilla" } },
  olive: { line: "Just mango this time. I'll still take the waffle.", changes: { name: "Mango Taro & Waffle", mixins: ["mango"] } },
  tahini: { line: "Could I have oat milk and hold the ice?", changes: { milk: "oat", ice: 0 } },
  sloe: { line: "The fruit was lovely. Can I try mango today?", changes: { name: "Mango Jasmine Taro Cloud", mixins: ["mango"] } },
  clove: { line: "Skip the jelly this time. I'd like another pearl scoop.", changes: { toppings: ["pearls", "pearls"] } },
  marzipan: { line: "Could I have two portions of yuzu? Keep the ice low.", changes: { name: "Double Yuzu Black Jasmine", mixins: ["yuzu", "yuzu"], ice: 1 } },
  clover: { line: "Vanilla ice cream with the mango this time.", changes: { float: "vanilla-scoop" } },
  crumb: { line: "Banana ice cream today, and one pump of sesame.", changes: { float: "banana-scoop", sugar: 1 } },
  mallow: { line: "Could you serve that with strawberries?", changes: { mixins: ["strawberry"] } },
};

function scheduleSpecialRequest(orders: ServiceOrder[], day: number, visits: DayOptions["regularVisits"]) {
  if (day < 5 || !visits) return;
  const candidates = orders.filter(({ customerId }) => {
    const count = visits[customerId];
    return Boolean(SPECIAL_REQUESTS[customerId]) && wholeInRange(count, 2, Number.MAX_SAFE_INTEGER) &&
      REGULARS.some((regular) => regular.id === customerId && regular.day < day);
  });
  if (!candidates.length) return;

  const selected = candidates[(day - 5) % candidates.length];
  const request = SPECIAL_REQUESTS[selected.customerId];
  const recipe = { ...selected.recipe, ...request.changes };
  selected.recipe = { ...recipe, toppings: [...recipe.toppings], mixins: [...recipe.mixins] };
  selected.specialRequest = { line: request.line, bonus: SPECIAL_REQUEST_BONUS };
}

const SHIFT_SECONDS = 100;
const LAST_CALL_SECONDS = 18;
const MAX_ACTIVE_ORDERS = 3;
const MAX_WALK_IN_TICKETS = 24;
const MAX_TICKETS = MAX_WALK_IN_TICKETS + 3;
const RESERVATION_GUEST_GAP = 1.5;
export const RESERVATION_UNLOCK_DAY = 5;
const RESERVATION_GROUPS = [
  { name: "Board Game Club", arrivesAt: 36 },
  { name: "Film Society", arrivesAt: 52 },
  { name: "Cycling Club", arrivesAt: 44 },
] as const;

export function reservationForDay(day: number, expert: boolean): ReservationOffer | null {
  if (!Number.isSafeInteger(day) || day < RESERVATION_UNLOCK_DAY) return null;
  const group = RESERVATION_GROUPS[(day - RESERVATION_UNLOCK_DAY) % RESERVATION_GROUPS.length];
  return { ...group, count: expert ? 3 : 2, reward: expert ? 850 : 550, minQuality: expert ? 90 : 85 };
}

export function reservationProgress(state: ServiceDay) {
  const target = state.reservation?.count ?? 0;
  const reward = state.reservation?.reward ?? 0;
  const members = new Set(state.orders.filter(({ reservation }) => reservation).map(({ id }) => id));
  const receipts = state.receipts.filter(({ orderId }) => members.has(orderId));
  const qualified = receipts.filter(({ quality }) => quality >= (state.reservation?.minQuality ?? 100)).length;
  return { served: receipts.length, qualified, target, earned: qualified === target ? reward : 0, reward };
}
const EPSILON = 0.00001;

export const PREP_IDS = ["pearls", "bun", "waffle"] as const;
export const PREP_YIELDS = { pearls: 4, bun: 3, waffle: 2 } as const;
const PREP_LABELS = { pearls: "Pearls", bun: "Buns", waffle: "Waffles" } as const;
const PREP_START = { pearls: "The pearls are simmering.", bun: "The buns are steaming.", waffle: "The press is toasting the waffles." } as const;
export const HOUSE_ROUND_STREAK = 3;
export const HOUSE_ROUND_QUALITY = { normal: 85, expert: 91 } as const;
export const FROTH_DAY = 10;
export const EXPRESS_DELIVERY_DAY = 3;
export const AUTO_SEAL_SECONDS = 0.9;
const PREP_TARGETS = { pearls: 7, bun: 5, waffle: 3.25 } as const;
const BREW_TARGETS: Record<TeaId, number> = { black: 4, jasmine: 3.5, taro: 5 };

function brewTarget(tea: TeaId, accentTea?: TeaId) {
  return accentTea ? Math.max(BREW_TARGETS[tea], BREW_TARGETS[accentTea]) + 0.6 : BREW_TARGETS[tea];
}

function teasMatch(cup: ServiceCup, recipe: Recipe) {
  return (cup.tea === recipe.tea && cup.accentTea === recipe.accentTea) ||
    (!!recipe.accentTea && cup.tea === recipe.accentTea && cup.accentTea === recipe.tea);
}

function blankBatch(id: PrepId): PrepBatch {
  return { cooking: false, elapsed: 0, target: PREP_TARGETS[id], ready: 0, quality: 0, cookedAt: null };
}

function scheduleOrders(day: number, expert: boolean, effects: ServiceEffects, visits: DayOptions["regularVisits"]): ServiceOrder[] {
  const menu = REGULARS.filter((regular) => regular.day <= day);
  const rotation = (day - 1) % menu.length;
  const returning = [...menu.slice(rotation), ...menu.slice(0, rotation)].filter((regular) => regular.day < day);
  const guests = [...menu.filter((regular) => regular.day === day), ...returning];
  const pace = Math.max(expert ? 7.5 : 10.5, (expert ? 16 : 21) - (day - 1) * (expert ? 1.6 : 2));
  const gap = pace / effects.arrivalMultiplier;
  const orders: ServiceOrder[] = [];
  for (let index = 0; index < Math.min(guests.length, MAX_WALK_IN_TICKETS); index++) {
    const rushOffset = day >= 4 && index % 3 === 2 ? gap * 0.48 : 0;
    const arrivesAt = Math.round((index * gap - rushOffset) * 10) / 10;
    if (arrivesAt > SHIFT_SECONDS - 9) break;
    const regular = guests[index];
    const previous = visits?.[regular.id];
    const priorVisits = inRange(previous, 0, Number.MAX_SAFE_INTEGER) ? Math.min(5, previous) : 0;
    const patience = Math.max(1, (expert ? 27 : 39) * effects.patienceMultiplier * regular.patience + priorVisits -
      Math.min(expert ? 5 : 6, Math.max(0, day - 3)));
    const { favorite } = regular;
    orders.push({
      id: `${day}-${index + 1}`,
      customerId: regular.id,
      customerName: regular.name,
      tag: regular.tag,
      arrivesAt,
      patience,
      maxPatience: patience,
      status: "waiting",
      recipe: copyRecipe(favorite),
      cup: null,
    });
  }
  scheduleSpecialRequest(orders, day, visits);
  return orders;
}

function scheduleReservation(orders: ServiceOrder[], offer: ReservationOffer, day: number, expert: boolean, effects: ServiceEffects) {
  const used = new Set(orders.map(({ customerId }) => customerId));
  const available = REGULARS.filter(({ id }) => !used.has(id));
  // The regulars are ordered by their debut. Prefer already introduced guests,
  // even when a packed public queue leaves only later guests available.
  const familiar = available.filter((regular) => regular.day < day);
  const offset = day % Math.max(1, familiar.length);
  const other = available.filter((regular) => regular.day >= day);
  const guests = [...familiar.slice(offset), ...familiar.slice(0, offset), ...other].slice(0, offer.count);
  if (orders.length + offer.count > MAX_TICKETS || guests.length < offer.count) return false;
  const fallbacks = LOCATION_MENUS.campus;
  guests.forEach((guest, index) => {
    const patience = (expert ? 23 : 30) * effects.patienceMultiplier * guest.patience;
    const recipe = recipeAvailable(guest.favorite, day) ? guest.favorite : fallbacks[index % fallbacks.length];
    orders.push({
      id: `${day}-reservation-${index + 1}`,
      customerId: guest.id,
      customerName: guest.name,
      tag: `Here with the ${offer.name}`,
      arrivesAt: offer.arrivesAt + index * RESERVATION_GUEST_GAP,
      maxPatience: patience,
      patience,
      status: "waiting",
      recipe: copyRecipe(recipe),
      cup: null,
      reservation: true,
    });
  });
  orders.sort((a, b) => a.arrivesAt - b.arrivesAt);
  return true;
}

function scheduleHouseBlend(orders: ServiceOrder[], blend: HouseBlend, day: number) {
  const debuted = new Set(REGULARS.filter((regular) => regular.day < day).map(({ id }) => id));
  const order = orders.find(({ customerId, specialRequest, locationSpecial, seasonalSpecial, reservation }) =>
    debuted.has(customerId) && !specialRequest && !locationSpecial && !seasonalSpecial && !reservation);
  if (!order) return;
  order.recipe = recipeFromHouseBlend(blend);
  order.houseBlend = true;
}

export function openingPrepSeconds(expert: boolean) {
  return expert ? 10 : 14;
}

export function createServiceDay({ day, expert, reserveTable = false, startPrep = false, houseBlend, upgrades = [], activeCrew = [], activeBranch,
  branchFittings, publicity, event, regularVisits, highestReputation, certifiedCrew, bookCatering = false }: DayOptions): ServiceDay {
  day = Number.isSafeInteger(day) ? Math.max(1, day) : 1;
  event ??= eventForDay(day);
  const installed = campaignEffects({
    currentEvent: "neighborhood", upgrades: [...upgrades], activeCrew, activeBranch, branchFittings, publicity, highestReputation, certifiedCrew,
  });
  const effects = {
    ...installed,
    arrivalMultiplier: installed.arrivalMultiplier * (inRange(event.arrivalMultiplier, 0.2, 4) ? event.arrivalMultiplier : 1),
    patienceMultiplier: installed.patienceMultiplier * (inRange(event.patienceMultiplier, 0.2, 4) ? event.patienceMultiplier : 1),
    tipMultiplier: Math.min(10, installed.tipMultiplier * (inRange(event.tipMultiplier, 0, 10) ? event.tipMultiplier : 1)),
    fruitBonus: Math.min(5000, installed.fruitBonus + (wholeInRange(event.fruitBonus, 0, 5000) ? event.fruitBonus : 0)),
    sideBonus: wholeInRange(event.sideBonus, 0, 5000) ? event.sideBonus : 0,
    icedBonus: wholeInRange(event.icedBonus, 0, 5000) ? event.icedBonus : 0,
    sparklingBonus: wholeInRange(event.sparklingBonus, 0, 5000) ? event.sparklingBonus : 0,
    autoSeal: installed.autoSeal && !event.sealerOffline,
  };
  const orders = scheduleOrders(day, expert, effects, regularVisits);
  scheduleMenuFeatures(orders, day, activeBranch, event);
  if (upgrades.includes("menu-easel")) {
    const blend = normalizeHouseBlend(houseBlend, day);
    if (blend) scheduleHouseBlend(orders, blend, day);
  }
  const catering = bookCatering && upgrades.includes("takeout-rack") ? cateringOffer(day, expert) : null;
  const offer = reserveTable && !catering ? reservationForDay(day, expert) : null;
  const reservation = offer && scheduleReservation(orders, offer, day, expert, effects) ? offer : null;
  if (catering) {
    catering.recipes.forEach((recipe, index) => {
      orders.push({ ...cateringTicket(day, catering, index), recipe: copyRecipe(recipe) });
    });
    orders.sort((a, b) => a.arrivesAt - b.arrivesAt);
  }
  const preOpen = startPrep && upgrades.includes("opening-key") ? openingPrepSeconds(expert) : undefined;
  return {
    ...(reservation ? { reservation } : {}),
    ...(catering ? { catering: catering.id } : {}),
    ...(preOpen !== undefined ? { preOpen } : {}),
    day, expert, effects, status: "open", elapsed: 0, duration: SHIFT_SECONDS,
    orders,
    pearls: blankBatch("pearls"), buns: blankBatch("bun"), waffles: blankBatch("waffle"), receipts: [], usage: {},
    powerups: blankPowerups(), streak: 0, houseRoundReady: false,
    notice: preOpen !== undefined ? "The kitchen is open for prep." : "The counter is open.",
  };
}

function cateringTicket(day: number, offer: CateringOffer, index: number): ServiceOrder {
  const arrivesAt = offer.arrivesAt + index * 1.5;
  const patience = offer.deadline - arrivesAt;
  return {
    id: `${day}-catering-${index + 1}`, customerId: "takeout-" + (index + 1), customerName: offer.label,
    tag: "For courier pickup", arrivesAt, patience, maxPatience: patience, status: "waiting",
    recipe: offer.recipes[index], cup: null, catering: true,
  };
}

export function cateringProgress(state: ServiceDay) {
  const offer = state.catering ? cateringOffer(state.day, state.expert) : null;
  if (!offer || offer.id !== state.catering) return null;
  const packed = state.receipts.filter(({ packedAt }) => packedAt !== undefined && packedAt <= offer.deadline + EPSILON);
  const qualified = packed.filter(({ quality }) => quality >= offer.minQuality).length;
  const readyAt = packed.length === offer.recipes.length ? Math.max(...packed.map(({ packedAt }) => packedAt!)) : null;
  const arrivalAt = Math.min(readyAt ?? Infinity, offer.deadline - CATERING_COURIER_TRAVEL);
  const collectionAt = packed.length ? Math.max(arrivalAt + CATERING_COURIER_TRAVEL, readyAt ?? offer.deadline) : null;
  return { offer, packed: packed.length, qualified, readyAt, arrivalAt, collectionAt, earned: qualified === offer.recipes.length ? offer.reward : 0 };
}

function findOrder(state: ServiceDay, id: string) {
  return state.orders.find((order) => order.id === id);
}

function replaceOrder(state: ServiceDay, order: ServiceOrder, notice = state.notice): ServiceDay {
  return { ...state, orders: state.orders.map((entry) => entry.id === order.id ? order : entry), notice };
}

function isActiveOrder(order: ServiceOrder) {
  return order.status === "accepted" || order.status === "brewing" || order.status === "building";
}

function isPresent(order: ServiceOrder, elapsed: number) {
  return order.arrivesAt <= elapsed + EPSILON && (order.status === "waiting" || isActiveOrder(order));
}

function patienceRate(order: ServiceOrder, expert: boolean) {
  if (!isActiveOrder(order)) return 1;
  return expert ? 0.65 : 0.52;
}

function addPortion(usage: IngredientPortions, ingredient: IngredientId, count = 1): IngredientPortions {
  return { ...usage, [ingredient]: (usage[ingredient] ?? 0) + count };
}

function clampGrade(value: number) {
  return Math.round(Math.min(100, Math.max(0, value)));
}

function timingGrade(elapsed: number, target: number, expert: boolean, batch = false) {
  const tolerance = target * (batch ? (expert ? 0.12 : 0.24) : (expert ? 0.055 : 0.18));
  const difference = Math.max(0, Math.abs(elapsed - target) - tolerance);
  const penalty = difference / target * (expert ? 135 : 96);
  return Math.max(batch ? 45 : 35, clampGrade(100 - penalty));
}

export function isOverTarget(elapsed: number, target: number, expert: boolean, batch = false) {
  return elapsed > target && timingGrade(elapsed, target, expert, batch) < 100;
}

export function takeOrder(state: ServiceDay, id: string): ServiceDay {
  const order = findOrder(state, id);
  if (state.status === "complete" || state.preOpen !== undefined || order?.status !== "waiting" || !isPresent(order, state.elapsed)) return state;
  if (openTicketCount(state) >= state.effects.ticketSlots) return state;
  return replaceOrder(state, { ...order, status: "accepted" }, `${order.customerName}'s order is on the workbench.`);
}

export function openTicketCount(state: ServiceDay) {
  return state.orders.filter(isActiveOrder).length;
}

export function carafeRemaining(state: ServiceDay) {
  const holdSeconds = state.expert ? 24 : 34;
  return state.carafe ? Math.max(0, 1 - (state.elapsed - state.carafe.filledAt) / holdSeconds) : 0;
}

export function canFillCarafe(state: ServiceDay) {
  return state.effects.carafe && carafeRemaining(state) === 0 &&
    !state.orders.some((order) => order.status === "brewing" && order.cup?.brew.carafeFill);
}

type FruitId = typeof MIXINS[number];
export const SWAP_TIP_COST = 55;

const FRUIT_ALTERNATIVES: Readonly<Record<FruitId, readonly FruitId[]>> = {
  strawberry: ["banana", "mango", "yuzu"],
  banana: ["mango", "strawberry"],
  mango: ["banana", "strawberry", "yuzu"],
  yuzu: ["strawberry", "mango"],
};

const GUEST_FRUIT_PREFERENCES: Readonly<Partial<Record<string, readonly FruitId[]>>> = {
  nori: ["yuzu", "strawberry"],
  oats: ["banana", "mango"],
  peaches: ["mango", "banana", "strawberry"],
  miso: ["yuzu", "strawberry", "mango"],
  kiwi: ["strawberry", "mango", "banana"],
  lychee: ["strawberry", "mango", "yuzu"],
  marzipan: ["yuzu", "mango"],
  fennel: ["yuzu", "strawberry"],
};

function fruitAlternatives(customerId: string, from: FruitId): readonly FruitId[] {
  return GUEST_FRUIT_PREFERENCES[customerId]?.filter((fruit) => FRUIT_ALTERNATIVES[from].includes(fruit)) ?? FRUIT_ALTERNATIVES[from];
}

function ordinaryTicket(order: {
  reservation?: unknown; catering?: unknown; specialRequest?: unknown;
  locationSpecial?: unknown; seasonalSpecial?: unknown; houseBlend?: unknown;
}) {
  return order.reservation === undefined && order.catering === undefined && order.specialRequest === undefined &&
    order.locationSpecial === undefined && order.seasonalSpecial === undefined && order.houseBlend === undefined;
}

function swapPatience(state: ServiceDay) {
  return state.expert ? 4 : 2;
}

export function ingredientSwapQuote(campaign: Campaign, state: ServiceDay, orderId: string): IngredientSwap | null {
  if (campaign.status !== "open" || campaign.day !== state.day || (campaign.mode === "expert") !== state.expert ||
    state.status === "complete" || state.preOpen !== undefined) return null;
  const order = findOrder(state, orderId);
  if (!order || order.swap || !ordinaryTicket(order) || !isPresent(order, state.elapsed) || order.patience <= swapPatience(state)) return null;
  const { recipe, cup } = order;

  if (order.status === "accepted" && recipe.milk && stockCount(campaign, recipe.milk) === 0) {
    const to = recipe.milk === "milk" ? "oat" : "milk";
    return INGREDIENT_UNLOCK_DAYS[to] <= state.day && stockCount(campaign, to) >= (recipe.foam ? 2 : 1)
      ? { from: recipe.milk, to, amount: 1 } : null;
  }
  if (order.status !== "building" || !cup || cup.sealed) return null;

  for (const from of MIXINS) {
    const amount = recipe.mixins.filter((fruit) => fruit === from).length;
    if (!amount || cup.ingredients[from] || stockCount(campaign, from) >= amount) continue;
    for (const to of fruitAlternatives(order.customerId, from)) {
      const total = amount + recipe.mixins.filter((fruit) => fruit === to).length;
      const alreadyAdded = cup.ingredients[to] ?? 0;
      if (INGREDIENT_UNLOCK_DAYS[to] <= state.day && total <= 3 && alreadyAdded <= total &&
        stockCount(campaign, to) >= total - alreadyAdded) return { from, to, amount };
    }
  }
  return null;
}

export function requestIngredientSwap(campaign: Campaign, state: ServiceDay, orderId: string): ServiceDay {
  const swap = ingredientSwapQuote(campaign, state, orderId);
  const order = findOrder(state, orderId);
  if (!swap || !order) return state;

  const { recipe } = order;
  const adjusted = isChoice(swap.to, MILKS)
    ? { ...recipe, milk: swap.to }
    : { ...recipe, mixins: recipe.mixins.map((fruit) => fruit === swap.from ? swap.to : fruit) };
  const name = INGREDIENTS.find(({ id }) => id === swap.to)?.name ?? swap.to;
  return replaceOrder(state, { ...order, recipe: adjusted, swap, patience: order.patience - swapPatience(state) },
    `${order.customerName} agreed to ${name.toLowerCase()}.`);
}

export function startBrew(state: ServiceDay, id: string, tea: TeaId, milk: MilkId | null, options: { double?: boolean; accentTea?: TeaId } = {}): ServiceDay {
  const order = findOrder(state, id);
  if (state.status === "complete" || order?.status !== "accepted") return state;
  const { double = false } = options;
  const accentTea = state.effects.autoTea ? order.recipe.accentTea : options.accentTea;
  if (double && (accentTea || !canFillCarafe(state))) return state;
  if (state.effects.autoTea) tea = order.recipe.tea;
  if (state.effects.autoMilk) milk = order.recipe.milk;
  if (!TEAS.includes(tea) || INGREDIENT_UNLOCK_DAYS[tea] > state.day) return state;
  if (!!accentTea !== !!order.recipe.accentTea ||
    (accentTea && (state.day < MIXED_TEA_DAY || !TEAS.includes(accentTea) || accentTea === tea))) return state;
  if (milk !== null && (!MILKS.includes(milk) || INGREDIENT_UNLOCK_DAYS[milk] > state.day)) return state;

  const target = brewTarget(tea, accentTea);
  const rush = state.powerups.rush > 0;
  const cup: ServiceCup = {
    tea, milk, ...(accentTea ? { accentTea } : {}), brew: {
      elapsed: rush ? target : 0, target, quality: rush ? 100 : null, done: rush, ...(double ? { carafeFill: true } : {}),
    },
    ingredients: {}, ice: 0, shaken: false, sealed: false, qualityBonus: 0, prepQuality: {},
  };
  let usage = addPortion(state.usage, tea, double ? 2 : 1);
  if (accentTea) usage = addPortion(usage, accentTea);
  if (milk) usage = addPortion(usage, milk);
  const powerups = rush ? { ...state.powerups, rush: state.powerups.rush - 1 } : state.powerups;
  const next = { ...state, usage, powerups };
  if (double) next.carafe = rush ? { tea, quality: 100, filledAt: state.elapsed } : undefined;
  return replaceOrder(next, { ...order, cup, status: rush ? "building" : "brewing" },
    rush ? "The tea is ready." : double ? "Steeping an extra portion for the carafe." : "The tea is brewing.");
}

export function pourCarafe(state: ServiceDay, id: string, milk: MilkId | null): ServiceDay {
  const order = findOrder(state, id);
  const { carafe } = state;
  const remaining = carafeRemaining(state);
  if (state.status === "complete" || !state.effects.carafe || !carafe || !remaining || order?.status !== "accepted" ||
    order.recipe.accentTea || order.recipe.tea !== carafe.tea) return state;
  if (state.effects.autoMilk) milk = order.recipe.milk;
  if (milk !== null && (!MILKS.includes(milk) || INGREDIENT_UNLOCK_DAYS[milk] > state.day)) return state;

  const target = BREW_TARGETS[carafe.tea];
  const quality = clampGrade(carafe.quality - Math.max(0, 0.5 - remaining) * 28);
  const cup: ServiceCup = {
    tea: carafe.tea, milk, brew: { elapsed: target, target, quality, done: true },
    ingredients: {}, ice: 0, shaken: false, sealed: false, qualityBonus: 0, prepQuality: {},
  };
  const usage = milk ? addPortion(state.usage, milk) : state.usage;
  return replaceOrder({ ...state, usage, carafe: undefined }, { ...order, cup, status: "building" }, "Poured tea from the carafe.");
}

function brewed(order: ServiceOrder, elapsed: number, quality: number): ServiceOrder {
  if (!order.cup) return order;
  const cup = { ...order.cup, brew: { ...order.cup.brew, elapsed, quality, done: true } };
  return { ...order, cup, status: "building" };
}

export function stopBrew(state: ServiceDay, id: string): ServiceDay {
  const order = findOrder(state, id);
  if (state.status === "complete" || order?.status !== "brewing" || !order.cup) return state;
  const { elapsed, target } = order.cup.brew;
  const quality = timingGrade(elapsed, target, state.expert);
  if (state.effects.autoTea && elapsed + EPSILON < target) return state;
  const next = order.cup.brew.carafeFill ? { ...state, carafe: { tea: order.cup.tea, quality, filledAt: state.elapsed } } : state;
  return replaceOrder(next, brewed(order, elapsed, quality), quality >= 90 ? "The tea is ready." : "The brew is ready for tasting.");
}

const PREP_KEYS = { pearls: "pearls", bun: "buns", waffle: "waffles" } as const;

export function startBatch(state: ServiceDay, id: PrepId): ServiceDay {
  const key = PREP_KEYS[id];
  const current = state[key];
  if (state.status === "complete" || INGREDIENT_UNLOCK_DAYS[id] > state.day || current.cooking || current.ready > 0) return state;
  const rush = state.powerups.rush > 0;
  const batch = { ...blankBatch(id), cooking: true, elapsed: rush ? current.target : 0 };
  const powerups = rush ? { ...state.powerups, rush: state.powerups.rush - 1 } : state.powerups;
  const next = {
    ...state, [key]: batch, powerups, usage: addPortion(state.usage, id, PREP_YIELDS[id]),
    notice: PREP_START[id],
  };
  return rush ? collectBatch(next, id) : next;
}

export function collectBatch(state: ServiceDay, id: PrepId): ServiceDay {
  const key = PREP_KEYS[id];
  const batch = state[key];
  if (state.status === "complete" || !batch.cooking || batch.elapsed + EPSILON < batch.target * 0.65) return state;
  const quality = timingGrade(batch.elapsed, batch.target, state.expert, true);
  return {
    ...state,
    [key]: { ...batch, cooking: false, ready: PREP_YIELDS[id], quality, cookedAt: state.elapsed },
    notice: `${PREP_LABELS[id]} ready.`,
  };
}

export function prepFreshness(state: ServiceDay, id: PrepId) {
  const batch = state[PREP_KEYS[id]];
  if (!batch.ready || batch.cookedAt === null) return 0;
  const age = state.elapsed - batch.cookedAt;
  const hold = id === "waffle" ? state.expert ? 9 : 15 : state.day <= 2 ? 55 : state.expert ? 24 : 34;
  return clampGrade(batch.quality - Math.max(0, age - hold - state.effects.prepHoldBonus) * 1.35);
}

export function discardPrepBatch(state: ServiceDay, id: PrepId): ServiceDay {
  const key = PREP_KEYS[id];
  if (state.status === "complete" || !state[key].ready) return state;
  return { ...state, [key]: blankBatch(id), notice: `Discarded the remaining ${PREP_LABELS[id].toLowerCase()}.` };
}

export function startPearls(state: ServiceDay) { return startBatch(state, "pearls"); }
export function collectPearls(state: ServiceDay) { return collectBatch(state, "pearls"); }
export function startBuns(state: ServiceDay) { return startBatch(state, "bun"); }
export function collectBuns(state: ServiceDay) { return collectBatch(state, "bun"); }

function tickOrder(order: ServiceOrder, state: ServiceDay, elapsed: number): ServiceOrder {
  if (!isPresent(order, elapsed)) return order;
  const seconds = Math.max(0, elapsed - Math.max(state.elapsed, order.arrivesAt));
  if (!seconds) return order;
  const waitingSeconds = Math.max(0, elapsed - Math.max(state.elapsed, order.arrivesAt, state.quietUntil ?? 0));
  const patience = order.catering
    ? Math.max(0, order.arrivesAt + order.maxPatience - elapsed)
    : Math.max(0, order.patience - waitingSeconds * patienceRate(order, state.expert));
  if (patience <= EPSILON) return { ...order, cup: null, patience: 0, status: "missed" };
  const next = { ...order, patience };
  if (order.status !== "brewing" || !order.cup) {
    const ready = order.cup?.finishTouchedAt;
    if (ready !== undefined && elapsed + EPSILON >= ready + AUTO_SEAL_SECONDS && canAutoSeal(state, order)) {
      return { ...next, cup: { ...order.cup!, sealed: true, sealedAt: ready + AUTO_SEAL_SECONDS } };
    }
    return next;
  }

  const brew = order.cup.brew;
  const brewingTime = brew.elapsed + seconds;
  if (state.effects.autoTea && brewingTime + EPSILON >= brew.target) return brewed(next, brew.target, 100);
  if (brewingTime + EPSILON >= brew.target * 2) return brewed(next, brew.target * 2, timingGrade(brew.target * 2, brew.target, state.expert));
  return { ...next, cup: { ...order.cup, brew: { ...brew, elapsed: brewingTime } } };
}

function tickBatch(batch: PrepBatch, seconds: number): PrepBatch {
  if (!batch.cooking || batch.elapsed >= batch.target * 2) return batch;
  return { ...batch, elapsed: Math.min(batch.target * 2, batch.elapsed + seconds) };
}

function tickPrep(state: ServiceDay, seconds: number) {
  const prepTime = seconds / state.effects.prepMultiplier;
  return {
    pearls: tickBatch(state.pearls, prepTime),
    buns: tickBatch(state.buns, prepTime),
    waffles: tickBatch(state.waffles, prepTime),
  };
}

export function openServiceDoors(state: ServiceDay): ServiceDay {
  if (state.status !== "open" || state.preOpen === undefined) return state;
  const { preOpen, ...service } = state;
  return { ...service, notice: "The counter is open." };
}

function closingDeadline(state: ServiceDay) {
  let lastDeparture = state.duration;
  for (const order of state.orders) {
    if (order.status === "missed" || order.status === "served") continue;
    const departure = Math.max(order.arrivesAt, state.elapsed, state.quietUntil ?? 0) + order.patience / patienceRate(order, state.expert);
    lastDeparture = Math.max(lastDeparture, departure);
  }
  return Math.min(state.duration + LAST_CALL_SECONDS, lastDeparture);
}

export function advanceService(state: ServiceDay, seconds: number): ServiceDay {
  if (state.status === "complete" || !Number.isFinite(seconds) || seconds <= 0) return state;
  if (state.preOpen !== undefined) {
    const prepSeconds = Math.min(state.preOpen, seconds);
    const preparing = { ...state, ...tickPrep(state, prepSeconds), preOpen: state.preOpen - prepSeconds };
    if (preparing.preOpen > EPSILON) return preparing;
    state = openServiceDoors(preparing);
    seconds -= prepSeconds;
    if (seconds <= 0) return state;
  }
  let elapsed = state.elapsed + seconds;
  if (elapsed >= state.duration) elapsed = Math.max(state.elapsed, Math.min(elapsed, closingDeadline(state)));
  const orders = state.orders.map((order) => tickOrder(order, state, elapsed));
  const brokeStreak = orders.some((order, index) => order.status === "missed" && state.orders[index].status !== "missed");
  const closing = elapsed + EPSILON >= state.duration;
  const next: ServiceDay = {
    ...state, elapsed, orders, streak: brokeStreak ? 0 : state.streak, status: closing ? "closing" : "open",
    ...tickPrep(state, elapsed - state.elapsed),
    notice: closing && state.status === "open" ? "Last call. Finish the tickets already at the counter." : state.notice,
  };
  const fillingIndex = state.orders.findIndex(({ status, cup }) => status === "brewing" && cup?.brew.carafeFill);
  const filling = fillingIndex < 0 ? null : orders[fillingIndex];
  const finishedBrew = filling?.status === "building" ? filling.cup : null;
  if (finishedBrew && finishedBrew.brew.quality !== null) {
    const prior = state.orders[fillingIndex].cup!.brew.elapsed;
    const filledAt = Math.min(elapsed, state.elapsed + finishedBrew.brew.elapsed - prior);
    next.carafe = { tea: finishedBrew.tea, quality: finishedBrew.brew.quality, filledAt };
  }
  if (next.carafe && !carafeRemaining(next)) next.carafe = undefined;
  if (closing && (elapsed + EPSILON >= state.duration + LAST_CALL_SECONDS || !orders.some((order) => isPresent(order, elapsed)))) {
    return closeServiceDay(next);
  }
  return next;
}

function buildingOrder(state: ServiceDay, id: string) {
  const order = findOrder(state, id);
  if (state.status === "complete" || order?.status !== "building" || !order.cup || order.cup.sealed) return null;
  return { order, cup: order.cup };
}

function isPrep(ingredient: IngredientId): ingredient is PrepId {
  return PREP_IDS.some((id) => id === ingredient);
}

function sidePortion(ingredient: IngredientId) {
  return ingredient === "bun" || ingredient === "waffle";
}

function isBuildIngredient(ingredient: IngredientId): ingredient is typeof BUILD_INGREDIENTS[number] {
  return BUILD_INGREDIENTS.some((id) => id === ingredient);
}

function isSyrup(ingredient: IngredientId): ingredient is SyrupId {
  return SYRUPS.some((id) => id === ingredient);
}

function prepBonus(prepQuality: PrepQuality) {
  const grades = PREP_IDS.flatMap((id) => prepQuality[id] ?? []);
  if (!grades.length) return 0;
  return Math.round((grades.reduce((sum, grade) => sum + grade, 0) / grades.length - 85) / 5);
}

function resetFinish(cup: ServiceCup) {
  const { float: _scoop, sparkling: _fizz, finishTouchedAt: _finishTime, ...parts } = cup;
  return { ...parts, shaken: false, ...(parts.foamed ? { foamed: false } : {}) };
}

export function addIngredient(state: ServiceDay, id: string, ingredient: IngredientId): ServiceDay {
  const current = buildingOrder(state, id);
  if (!current || !isBuildIngredient(ingredient) || INGREDIENT_UNLOCK_DAYS[ingredient] > state.day) return state;
  const { order, cup } = current;
  const count = cup.ingredients[ingredient] ?? 0;
  const tripleFruit = order.swap?.to === ingredient && order.recipe.mixins.filter((fruit) => fruit === ingredient).length === 3;
  const limit = isSyrup(ingredient) || tripleFruit ? 3 : sidePortion(ingredient) ? 1 : 2;
  if (count >= limit) return state;

  let next = state;
  let prepQuality = cup.prepQuality;
  if (isPrep(ingredient)) {
    const key = PREP_KEYS[ingredient];
    const batch = state[key];
    if (!batch.ready) return state;
    const quality = prepFreshness(state, ingredient);
    prepQuality = { ...prepQuality, [ingredient]: [...(prepQuality[ingredient] ?? []), quality] };
    next = { ...state, [key]: { ...batch, ready: batch.ready - 1 } };
  } else {
    next = { ...state, usage: addPortion(state.usage, ingredient) };
  }
  const ingredients = addPortion(cup.ingredients, ingredient);
  const name = ingredient === "waffle" ? "Sesame waffle" : INGREDIENTS.find(({ id }) => id === ingredient)?.name;
  return replaceOrder(next, { ...order, cup: { ...resetFinish(cup), ingredients, prepQuality, qualityBonus: prepBonus(prepQuality) } },
    `${name} added.`);
}

export function removeIngredient(state: ServiceDay, id: string, ingredient: IngredientId): ServiceDay {
  const current = buildingOrder(state, id);
  if (!current || !isBuildIngredient(ingredient)) return state;
  const { order, cup } = current;
  const count = cup.ingredients[ingredient] ?? 0;
  if (!count) return state;
  const ingredients = { ...cup.ingredients };
  if (count === 1) delete ingredients[ingredient];
  else ingredients[ingredient] = count - 1;
  const prepQuality = isPrep(ingredient) ? { ...cup.prepQuality, [ingredient]: (cup.prepQuality[ingredient] ?? []).slice(0, -1) } : cup.prepQuality;
  return replaceOrder(state, { ...order, cup: { ...resetFinish(cup), ingredients, prepQuality, qualityBonus: prepBonus(prepQuality) } },
    "One portion removed.");
}

export function setIce(state: ServiceDay, id: string, ice: Level): ServiceDay {
  const current = buildingOrder(state, id);
  if (!current || !ICE_LEVELS.includes(ice) || current.cup.ice === ice) return state;
  const { order, cup } = current;
  return replaceOrder(state, { ...order, cup: { ...resetFinish(cup), ice } }, "Ice adjusted.");
}

export function shakeDrink(state: ServiceDay, id: string): ServiceDay {
  const current = buildingOrder(state, id);
  if (!current || current.cup.shaken) return state;
  const { order, cup } = current;
  return replaceOrder(state, { ...order, cup: { ...cup, shaken: true, finishTouchedAt: state.elapsed } }, "Drink shaken.");
}

export function foamMilkFor(recipe: Recipe): MilkId {
  return recipe.milk ?? "milk";
}

export function foamDrink(state: ServiceDay, id: string): ServiceDay {
  const current = buildingOrder(state, id);
  if (!current || state.day < FROTH_DAY || !current.order.recipe.foam || !current.cup.shaken || current.cup.foamed) return state;
  const { order, cup } = current;
  const usage = addPortion(state.usage, foamMilkFor(order.recipe));
  return replaceOrder({ ...state, usage }, { ...order, cup: { ...cup, foamed: true, finishTouchedAt: state.elapsed } }, "Milk foam added.");
}

export function chargeSparkle(state: ServiceDay, id: string): ServiceDay {
  const current = buildingOrder(state, id);
  if (!current || state.day < INGREDIENT_UNLOCK_DAYS.seltzer) return state;
  const { order, cup } = current;
  if (!order.recipe.sparkling || order.recipe.milk !== null || order.recipe.foam || order.recipe.float ||
    cup.milk !== null || cup.foamed || cup.float || !cup.shaken || cup.sparkling) return state;
  const usage = addPortion(state.usage, "seltzer");
  return replaceOrder({ ...state, usage }, { ...order, cup: { ...cup, sparkling: true, finishTouchedAt: state.elapsed } }, "Seltzer added.");
}

export function scoopFreshness(state: ServiceDay, cup: ServiceCup) {
  if (!cup.float) return 0;
  const hold = (state.expert ? 9 : 14) + state.effects.floatHoldBonus;
  return clampGrade(100 - Math.max(0, state.elapsed - cup.float.scoopedAt - hold) * 2.6);
}

export function scoopFloat(state: ServiceDay, id: string, flavor: FloatFlavor): ServiceDay {
  const current = buildingOrder(state, id);
  if (!current || !FLOAT_FLAVORS.includes(flavor) || INGREDIENT_UNLOCK_DAYS[flavor] > state.day ||
    !current.order.recipe.float || !current.cup.shaken || current.cup.float?.flavor === flavor) return state;
  const { order, cup } = current;
  const usage = addPortion(state.usage, flavor);
  const float = { flavor, scoopedAt: state.elapsed };
  return replaceOrder({ ...state, usage }, { ...order, cup: { ...cup, float, finishTouchedAt: state.elapsed } }, "Ice cream scooped.");
}

export function sealDrink(state: ServiceDay, id: string): ServiceDay {
  const current = buildingOrder(state, id);
  if (!current?.cup.shaken) return state;
  const { order, cup } = current;
  return replaceOrder(state, { ...order, cup: { ...cup, sealed: true, sealedAt: state.elapsed } }, "Cup sealed and ready to hand off.");
}

export function remakeOrder(state: ServiceDay, id: string): ServiceDay {
  const order = findOrder(state, id);
  if (state.status === "complete" || !order?.cup || !isActiveOrder(order)) return state;
  return replaceOrder(state, { ...order, cup: null, status: "accepted" }, "Cup discarded. Start a new brew for this ticket.");
}

function addRequested(state: ServiceDay, order: ServiceOrder, ingredients: IngredientId[]) {
  let next = state;
  for (const ingredient of new Set(ingredients)) {
    const wanted = ingredients.filter((requested) => requested === ingredient).length;
    for (let amount = order.cup?.ingredients[ingredient] ?? 0; amount < wanted; amount++) {
      next = addIngredient(next, order.id, ingredient);
    }
  }
  return next;
}

export function applyServiceToppings(state: ServiceDay, id: string): ServiceDay {
  const current = buildingOrder(state, id);
  if (!state.effects.autoToppings || !current) return state;
  return addRequested(state, current.order, current.order.recipe.toppings);
}

function extrasFor(recipe: Recipe): IngredientId[] {
  const ingredients = [...recipe.mixins, ...Array<IngredientId>(recipe.sugar).fill(recipe.syrup)];
  const side = recipeSide(recipe);
  if (side) ingredients.push(side);
  return ingredients;
}

export function applyServiceExtras(state: ServiceDay, id: string): ServiceDay {
  const current = buildingOrder(state, id);
  if (!state.effects.autoExtras || !current) return state;
  const { order } = current;
  return setIce(addRequested(state, order, extrasFor(order.recipe)), id, order.recipe.ice);
}

export function fillNewBuilds(campaign: Campaign, before: ServiceDay, service: ServiceDay) {
  if (campaign.status !== "open" || campaign.day !== service.day || before.day !== service.day ||
    (campaign.mode === "expert") !== service.expert || service.status === "complete" ||
    !(service.effects.autoToppings || service.effects.autoExtras)) {
    return { campaign, service };
  }
  const prior = new Map(before.orders.map(({ id, status }) => [id, status]));
  const ready = service.orders.filter(({ id, status, cup }) =>
    status === "building" && !cup?.sealed && (prior.get(id) === "brewing" || prior.get(id) === "accepted"));
  for (const order of ready) {
    const { id, recipe, cup } = order;
    const targets = [
      ...(service.effects.autoToppings ? recipe.toppings : []),
      ...(service.effects.autoExtras ? extrasFor(recipe) : []),
    ];
    for (const ingredient of new Set(targets)) {
      const ordered = targets.filter((target) => target === ingredient).length;
      const already = cup?.ingredients[ingredient] ?? 0;
      const available = isPrep(ingredient) ? service[PREP_KEYS[ingredient]].ready : stockCount(campaign, ingredient);
      const portions = Math.min(available, ordered - already);
      if (portions > 0) {
        const measured = addRequested(service, order, Array<IngredientId>(already + portions).fill(ingredient));
        const stocked = consumeIngredients(campaign, serviceUsageDelta(service, measured));
        if (!stocked.ok) continue;
        service = measured;
        campaign = stocked.campaign;
      }
    }
    if (service.effects.autoExtras) service = setIce(service, id, recipe.ice);
  }
  return { campaign, service };
}

function priceFor(recipe: Recipe) {
  const sidePrice = recipe.waffle ? 240 : recipe.bun ? 195 : 0;
  return 395 + (recipe.milk ? 30 : 0) + (recipe.accentTea ? 70 : 0) +
    recipe.toppings.length * 55 + recipe.mixins.length * 55 + sidePrice + (recipe.float ? 110 : 0) + (recipe.sparkling ? 150 : 0);
}

function recipePortions(recipe: Recipe) {
  let portions: IngredientPortions = recipe.sugar ? { [recipe.syrup]: recipe.sugar } : {};
  for (const ingredient of [...recipe.toppings, ...recipe.mixins]) portions = addPortion(portions, ingredient);
  const side = recipeSide(recipe);
  if (side) portions[side] = 1;
  return portions;
}

export function canAutoSeal(state: ServiceDay, order: ServiceOrder) {
  const { cup, recipe } = order;
  if (!state.effects.autoSeal || order.status !== "building" || !cup?.shaken || cup.sealed || cup.finishTouchedAt === undefined ||
    !teasMatch(cup, recipe) || cup.milk !== recipe.milk || cup.ice !== recipe.ice ||
    (recipe.foam && !cup.foamed) || (recipe.float && cup.float?.flavor !== recipe.float) || (recipe.sparkling && !cup.sparkling)) return false;
  const expected = recipePortions(recipe);
  return BUILD_INGREDIENTS.every((id) => (cup.ingredients[id] ?? 0) === (expected[id] ?? 0));
}

export function openingShortages(campaign: Campaign, orders: readonly ServiceOrder[]) {
  const portions: IngredientPortions = {};
  const walkIns = orders.filter(({ catering }) => !catering).slice(0, campaign.mode === "expert" ? 3 : 2);
  for (const { recipe } of [...walkIns, ...orders.filter(({ catering }) => catering)]) {
    portions[recipe.tea] = (portions[recipe.tea] ?? 0) + 1;
    if (recipe.accentTea) portions[recipe.accentTea] = (portions[recipe.accentTea] ?? 0) + 1;
    if (recipe.milk) portions[recipe.milk] = (portions[recipe.milk] ?? 0) + 1;
    if (recipe.foam) {
      const milk = foamMilkFor(recipe);
      portions[milk] = (portions[milk] ?? 0) + 1;
    }
    if (recipe.float) portions[recipe.float] = (portions[recipe.float] ?? 0) + 1;
    if (recipe.sparkling) portions.seltzer = (portions.seltzer ?? 0) + 1;
    const build = recipePortions(recipe);
    for (const { id } of INGREDIENTS) {
      const needed = build[id];
      if (needed) portions[id] = (portions[id] ?? 0) + needed;
    }
  }
  return INGREDIENTS.flatMap(({ id, name }) => {
    const demand = portions[id] ?? 0;
    const minimum = isPrep(id) ? Math.ceil(demand / PREP_YIELDS[id]) * PREP_YIELDS[id] : demand;
    const missing = minimum - stockCount(campaign, id);
    return missing > 0 ? [{ id, name, missing }] : [];
  });
}

function gradeOrder(state: ServiceDay, order: ServiceOrder, cup: ServiceCup): ServiceReceipt["grades"] {
  const { recipe } = order;
  const wrongTea = teasMatch(cup, recipe) ? 0 : recipe.accentTea ? 46 : 56;
  const wrongMilk = cup.milk !== recipe.milk ? 26 : 0;
  const brew = clampGrade((cup.brew.quality ?? 0) - wrongTea - wrongMilk);
  const expected = recipePortions(recipe);
  let build = 100 - Math.abs(cup.ice - recipe.ice) * 12;
  for (const ingredient of BUILD_INGREDIENTS) {
    const difference = Math.abs((cup.ingredients[ingredient] ?? 0) - (expected[ingredient] ?? 0));
    const penalty = isSyrup(ingredient) ? 12 : sidePortion(ingredient) ? 24 : 22;
    build -= difference * penalty;
  }
  const prepGrades = PREP_IDS.flatMap((id) => cup.prepQuality[id] ?? []);
  const prepGrade = prepGrades.length ? 42 + prepGrades.reduce((sum, grade) => sum + grade, 0) / prepGrades.length * 0.58 : 100;
  const foamPenalty = recipe.foam && !cup.foamed ? 45 : 0;
  const floatPenalty = !recipe.float ? 0 : cup.float?.flavor !== recipe.float ? 50 : (100 - scoopFreshness(state, cup)) * 0.62;
  const fizzPenalty = recipe.sparkling && !cup.sparkling ? 45 : 0;
  const finish = clampGrade(prepGrade - foamPenalty - floatPenalty - fizzPenalty);
  const wait = order.catering ? 100 : clampGrade(45 + 65 * order.patience / order.maxPatience);
  return { brew, build: clampGrade(build), finish, wait };
}

export function serveOrder(state: ServiceDay, id: string, handedOffBy?: "runner"): ServiceDay {
  const order = findOrder(state, id);
  if (state.status === "complete" || order?.status !== "building" || !order.cup?.sealed) return state;
  const { cup, recipe } = order;
  const grades = gradeOrder(state, order, cup);
  const baseQuality = clampGrade(grades.brew * 0.30 + grades.build * 0.42 + grades.finish * 0.18 + grades.wait * 0.10 +
    cup.qualityBonus + state.effects.qualityBonus);
  const boost = state.powerups.quality ? Math.min(12, 100 - baseQuality) : 0;
  const quality = baseQuality + boost;
  const base = priceFor(recipe);
  const hasFruit = recipe.mixins.length > 0 && MIXINS.every((fruit) =>
    (cup.ingredients[fruit] ?? 0) === recipe.mixins.filter((ingredient) => ingredient === fruit).length);
  const fruitBonus = quality >= 70 && hasFruit ? state.effects.fruitBonus : 0;
  const side = recipeSide(recipe);
  const asOrdered = teasMatch(cup, recipe) && cup.milk === recipe.milk && grades.build === 100;
  const sideBonus = quality >= 75 && asOrdered && side && (cup.prepQuality[side]?.[0] ?? 0) >= 88
    ? state.effects.sideBonus : 0;
  const icedBonus = quality >= 75 && asOrdered && recipe.ice === 3 ? state.effects.icedBonus : 0;
  const sparklingBonus = quality >= 75 && asOrdered && recipe.sparkling && cup.sparkling ? state.effects.sparklingBonus : 0;
  const menuBonus = fruitBonus + sideBonus + icedBonus + sparklingBonus;
  const specialBonus = order.specialRequest && grades.build === 100 && grades.brew >= 90 && grades.finish >= 85
    ? order.specialRequest.bonus : 0;
  const revenue = Math.round(base * (0.50 + quality / 200)) + menuBonus + specialBonus + state.effects.serveBonus;
  const regular = REGULARS.find(({ id }) => id === order.customerId);
  const special = !order.catering && state.powerups.special > 0;
  const baseTip = Math.round(Math.max(0, quality - 58) * (state.expert ? 2.8 : 2.4) * (regular?.tips ?? 1));
  const tips = order.catering ? 0 : Math.max(0, baseTip - (order.swap ? SWAP_TIP_COST : 0)) + (special ? 200 : 0);
  const message = order.catering ? "Packed " + recipe.name + "." : orderFeedback(order, cup, grades, quality);
  const receipt: ServiceReceipt = {
    orderId: id, customerId: order.customerId, customerName: order.customerName, recipeName: recipe.name,
    quality, revenue, tips, grades, message,
    ...(specialBonus ? { specialBonus } : {}),
    ...(menuBonus ? { menuBonus } : {}),
    ...(handedOffBy ? { handedOffBy } : {}),
    ...(order.catering ? { packedAt: state.elapsed } : {}),
  };
  const powerups = boost || special ? {
    ...state.powerups,
    quality: state.powerups.quality - Number(boost > 0),
    special: state.powerups.special - Number(special),
  } : state.powerups;
  const threshold = state.expert ? HOUSE_ROUND_QUALITY.expert : HOUSE_ROUND_QUALITY.normal;
  const streak = quality >= threshold ? state.streak + 1 : 0;
  const houseRoundReady = state.houseRoundReady || (streak > 0 && streak % HOUSE_ROUND_STREAK === 0);
  const next = replaceOrder({ ...state, powerups, streak, houseRoundReady, receipts: [...state.receipts, receipt] },
    { ...order, status: "served" }, `${order.customerName}: ${message}`);
  return next.status === "closing" && !next.orders.some((order) => isPresent(order, next.elapsed)) ? closeServiceDay(next) : next;
}

export function servePickupCounter(state: ServiceDay): ServiceDay {
  if (!state.effects.batchPickup || state.status === "complete") return state;
  const ready = state.orders.filter(({ status, cup, catering }) => status === "building" && cup?.sealed && !catering);
  if (ready.length < 2) return state;
  const next = ready.reduce((work, { id }) => serveOrder(work, id), state);
  return { ...next, notice: "Picked up " + ready.length + " drinks." };
}

export function readyReservationOrders(state: ServiceDay) {
  if (!state.reservation || state.status === "complete") return [];
  const booked = state.orders.filter(({ reservation, status }) => reservation && status !== "served" && status !== "missed");
  return booked.length > 1 && booked.every(({ status, cup }) => status === "building" && cup?.sealed) ? booked : [];
}

export function serveReservationTable(state: ServiceDay, handedOffBy?: ServiceReceipt["handedOffBy"]): ServiceDay {
  const booked = readyReservationOrders(state);
  if (!booked.length) return state;
  const next = booked.reduce((shift, { id }) => serveOrder(shift, id, handedOffBy), state);
  return { ...next, notice: "The table has its drinks." };
}

export function runnerPickupOrders(state: ServiceDay) {
  const holdingTable = state.orders.filter(({ reservation, status }) => reservation && status !== "served" && status !== "missed").length > 1;
  const ready = state.orders.filter(({ status, cup, reservation, catering }) =>
    status === "building" && cup?.sealed && !catering && !(holdingTable && reservation))
    .sort((a, b) => (a.cup?.sealedAt ?? 0) - (b.cup?.sealedAt ?? 0));
  const table = holdingTable ? readyReservationOrders(state) : [];
  const tableTime = table.length ? Math.max(...table.map(({ cup }) => cup?.sealedAt ?? 0)) : Infinity;
  if (table.length && (!ready.length || tableTime <= (ready[0].cup?.sealedAt ?? 0))) return table;
  return ready.slice(0, 1);
}

export function serveHouseRound(state: ServiceDay): ServiceDay {
  if (state.status === "complete" || !state.houseRoundReady || !state.orders.some((order) => !order.catering && isPresent(order, state.elapsed))) return state;
  const extra = state.expert ? 3 : 5;
  const orders = state.orders.map((order) => !order.catering && isPresent(order, state.elapsed)
    ? { ...order, patience: order.patience + extra, maxPatience: order.maxPatience + extra }
    : order);
  return { ...state, orders, houseRoundReady: false, houseRoundAt: state.elapsed, notice: "A round of samples gave the guests more time." };
}

export function expressDeliveryQuote(campaign: Pick<Campaign, "mode">, _ingredient: IngredientId) {
  return campaign.mode === "expert"
    ? { cost: 650, quantity: 5, seconds: 11 }
    : { cost: 480, quantity: 6, seconds: 7 };
}

export function expressDeliveryBlockReason(campaign: Campaign, service: ServiceDay, ingredient: IngredientId) {
  if (campaign.status !== "open" || campaign.day !== service.day || service.expert !== (campaign.mode === "expert") ||
    service.status === "complete") return "Express delivery is only available during the current shift.";
  if (service.preOpen !== undefined) return "Open the doors before ordering express delivery.";
  if (campaign.day < EXPRESS_DELIVERY_DAY) return `Express delivery unlocks on day ${EXPRESS_DELIVERY_DAY}.`;
  if (campaign.legacyUnlimitedStock) return "The pantry is already stocked for this shift.";
  if (service.pendingDelivery) return "Wait for the delivery already on its way.";
  if (!unlockedIngredients(campaign.day).includes(ingredient)) return "Choose an unlocked ingredient.";
  const quote = expressDeliveryQuote(campaign, ingredient);
  if (service.elapsed + quote.seconds > service.duration + LAST_CALL_SECONDS) return "The courier cannot arrive before closing.";
  if (campaign.cash < quote.cost) return "There is not enough cash for express delivery.";
  return "";
}

export function orderExpressDelivery(campaign: Campaign, service: ServiceDay, ingredient: IngredientId) {
  const block = expressDeliveryBlockReason(campaign, service, ingredient);
  if (block) return { ok: false, campaign, service, message: block };
  const { seconds, cost, quantity } = expressDeliveryQuote(campaign, ingredient);
  const pendingDelivery = { ingredient, cost, quantity, arrivesAt: service.elapsed + seconds };
  const message = "The express delivery is on its way.";
  return { ok: true, campaign: { ...campaign, cash: campaign.cash - cost }, service: { ...service, pendingDelivery, notice: message }, message };
}

export function settleExpressDelivery(campaign: Campaign, service: ServiceDay): { campaign: Campaign; service: ServiceDay } {
  const pending = service.pendingDelivery;
  if (!pending || campaign.day !== service.day || campaign.status !== "open" ||
    service.expert !== (campaign.mode === "expert")) return { campaign, service };

  const { ingredient, quantity, cost, arrivesAt } = pending;
  if (service.elapsed + EPSILON < arrivesAt) {
    if (service.status !== "complete") return { campaign, service };
    return {
      campaign: { ...campaign, cash: campaign.cash + cost },
      service: { ...service, pendingDelivery: undefined, notice: "The express delivery was refunded at closing." },
    };
  }

  const item = INGREDIENTS.find(({ id }) => id === ingredient);
  if (!item) return { campaign, service };
  const expiresOn = campaign.day + deliveryShelfLife(campaign, item.shelfLife, 0);
  const lot = { id: campaign.nextId, ingredient, quantity, expiresOn };
  return {
    campaign: { ...campaign, nextId: campaign.nextId + 1, inventory: [...campaign.inventory, lot] },
    service: { ...service, pendingDelivery: undefined, notice: `${item.name} arrived at the stockroom.` },
  };
}

export function tickCampaignService(campaign: Campaign, state: ServiceDay, seconds: number) {
  if (state.day !== campaign.day || state.expert !== (campaign.mode === "expert") ||
    state.status === "complete" || !Number.isFinite(seconds) || seconds <= 0) return { campaign, service: state };

  const crew = campaign.activeCrew;
  if (!crew.length) return settleExpressDelivery(campaign, advanceService(state, seconds));
  let service = state;
  let remaining = seconds;
  if (service.preOpen !== undefined) {
    const prepSeconds = Math.min(service.preOpen, remaining);
    service = advanceService(service, prepSeconds);
    remaining -= prepSeconds;
    if (remaining <= 0) return { campaign, service };
  }
  const runnerDelay = runnerHandoffSeconds(campaign);
  const crewActivity = { ...state.crewActivity };
  while (service.status !== "complete") {
    ({ campaign, service } = settleExpressDelivery(campaign, service));
    if (crew.includes("runner")) {
      const ready = runnerPickupOrders(service);
      const first = ready[0];
      const table = ready.length > 1;
      const sealedAt = ready.length ? Math.max(...ready.map(({ cup }) => cup?.sealedAt ?? 0)) : 0;
      if (first && service.elapsed + EPSILON >= sealedAt + runnerDelay) {
        service = table ? serveReservationTable(service, "runner") : serveOrder(service, first.id, "runner");
        crewActivity.runner = table ? "Handed off the table's drinks." : `Handed off ${first.customerName}'s order.`;
      } else if (first) {
        crewActivity.runner = table ? "Picking up the table's drinks." : `Picking up ${first.customerName}'s order.`;
      } else if (!crewActivity.runner?.startsWith("Handed off")) {
        crewActivity.runner = "Watching the handoff counter.";
      }
    }
    if (service.status === "complete") break;
    if (crew.includes("host")) {
      crewActivity.host = service.orders.some((order) => order.status === "waiting" && isPresent(order, service.elapsed))
        ? "Checking in with the waiting guests." : "Watching the door.";
    }
    if (crew.includes("prep")) {
      const jobs: string[] = [];
      for (const id of PREP_IDS) {
        const key = PREP_KEYS[id];
        const batch = service[key];
        const name = PREP_LABELS[id];
        if (batch.cooking) {
          if (batch.elapsed + EPSILON >= batch.target) {
            service = collectBatch(service, id);
          } else {
            jobs.push(`Cooking ${name.toLowerCase()}`);
          }
        } else {
          const needsBatch = service.orders.some((order) => isPresent(order, service.elapsed) &&
            (id !== "waffle" || order.status !== "waiting") && !order.cup?.sealed &&
            (recipePortions(order.recipe)[id] ?? 0) > (order.cup?.ingredients[id] ?? 0));
          const staleWaffles = id === "waffle" && batch.ready > 0 && prepFreshness(service, id) < 88;
          if (needsBatch && (batch.ready === 0 || staleWaffles)) {
            const counter = staleWaffles ? discardPrepBatch(service, id) : service;
            const started = startBatch(counter, id);
            const stock = consumeIngredients(campaign, serviceUsageDelta(service, started));
            if (stock.ok && started !== service) {
              campaign = stock.campaign;
              service = started;
              jobs.push(`Cooking ${name.toLowerCase()}`);
            } else if (!stock.ok) {
              jobs.push(`Low stock for ${name.toLowerCase()}`);
            }
          }
        }
        if (service[key].ready > 0) jobs.push(`${name} ready`);
      }
      crewActivity.prep = jobs.length ? `${jobs.join(", ")}.` : "Watching for prep orders.";
    }
    if (remaining <= EPSILON) break;
    // Bounded steps preserve handoff and batch timing when the caller advances several seconds.
    const step = Math.min(remaining, 0.25);
    remaining -= step;
    service = advanceService(service, step);
  }
  return settleExpressDelivery(campaign, { ...service, crewActivity });
}

function counterHelpBlockReason(state: ServiceDay, orderId: string | undefined, campaign?: Campaign): string {
  const current = orderId ? buildingOrder(state, orderId) : null;
  if (!current) return "Choose an unsealed cup with finished tea.";
  const { order, cup } = current;
  const expected = recipePortions(order.recipe);
  const changesMix = cup.ice !== order.recipe.ice ||
    BUILD_INGREDIENTS.some((ingredient) => (cup.ingredients[ingredient] ?? 0) !== (expected[ingredient] ?? 0));
  if (order.recipe.sparkling && cup.milk !== null) return "Remake this tea without milk before adding seltzer.";
  if (campaign && order.recipe.sparkling && (!cup.sparkling || changesMix) && stockCount(campaign, "seltzer") < 1) {
    return "There is no seltzer for this order.";
  }
  if (campaign && order.recipe.foam && (!cup.foamed || changesMix) && stockCount(campaign, foamMilkFor(order.recipe)) < 1) {
    return "There is no milk for this order's foam.";
  }
  if (campaign && order.recipe.float && (cup.float?.flavor !== order.recipe.float || changesMix) && stockCount(campaign, order.recipe.float) < 1) {
    return "That ice cream is out of stock for this order.";
  }
  for (const ingredient of BUILD_INGREDIENTS) {
    const needed = (expected[ingredient] ?? 0) - (cup.ingredients[ingredient] ?? 0);
    if (needed <= 0) continue;
    if (isPrep(ingredient)) {
      if (state[PREP_KEYS[ingredient]].ready < needed) {
        return `Get the ${PREP_LABELS[ingredient].toLowerCase()} ready before using Counter Help.`;
      }
    } else if (campaign && stockCount(campaign, ingredient) < needed) {
      const name = INGREDIENTS.find(({ id }) => id === ingredient)?.name;
      return `${name} is out of stock for this order.`;
    }
  }
  return "";
}

function fillAndSealOrder(state: ServiceDay, orderId: string): ServiceDay {
  const current = buildingOrder(state, orderId);
  if (!current) return state;
  const { order, cup } = current;
  const expected = recipePortions(order.recipe);
  let next = state;
  for (const ingredient of BUILD_INGREDIENTS) {
    const count = cup.ingredients[ingredient] ?? 0;
    const target = expected[ingredient] ?? 0;
    for (let amount = count; amount > target; amount--) next = removeIngredient(next, orderId, ingredient);
    for (let amount = count; amount < target; amount++) next = addIngredient(next, orderId, ingredient);
  }
  next = setIce(next, orderId, order.recipe.ice);
  next = shakeDrink(next, orderId);
  if (order.recipe.foam) next = foamDrink(next, orderId);
  if (order.recipe.float) next = scoopFloat(next, orderId, order.recipe.float);
  if (order.recipe.sparkling) next = chargeSparkle(next, orderId);
  return { ...sealDrink(next, orderId), notice: "Counter Help finished and sealed the cup." };
}

export function servicePowerupBlockReason(state: ServiceDay, id: PowerupId, orderId?: string, campaign?: Campaign): string {
  if (state.status === "complete") return "The shift is complete.";
  if (state.preOpen !== undefined && id !== "rush" && id !== "supplies") return "Open the doors before using this powerup.";
  const hasGuest = state.orders.some((order) => !order.catering && isPresent(order, state.elapsed));
  switch (id) {
    case "assist": return counterHelpBlockReason(state, orderId, campaign);
    case "supplies": return "";
    case "patience": return hasGuest ? "" : "Wait until a guest is at the counter.";
    case "quality":
      if (state.powerups.quality > 0) return "A Recipe Card is already waiting for a handoff.";
      return state.orders.some((order) => isPresent(order, state.elapsed)) ? "" : "Wait until there is an order to improve.";
    case "special":
      if (state.powerups.special > 0) return "The Tip Special is still running.";
      return state.orders.filter(({ status, catering }) => !catering && status !== "served" && status !== "missed").length >= 3
        ? "" : "There are fewer than three orders left in the shift.";
    case "quiet":
      if ((state.quietUntil ?? 0) > state.elapsed) return "The window chime is still ringing.";
      return hasGuest ? "" : "Wait until a guest is at the counter.";
    case "rush": {
      if (state.powerups.rush > 0) return "A Prep Sprint is already waiting for a brew or batch.";
      const brewing = state.orders.some((order) => order.status === "brewing");
      const prep = PREP_IDS.some((id) => state[PREP_KEYS[id]].cooking);
      const futureWork = state.orders.some(({ status }) => status === "waiting" || status === "accepted");
      return brewing || prep || futureWork ? "" : "There is no brew or batch left to speed up.";
    }
    default: return "That powerup is unavailable.";
  }
}

export function useServicePowerup(state: ServiceDay, id: PowerupId, orderId?: string): ServiceDay {
  if (servicePowerupBlockReason(state, id, orderId)) return state;
  switch (id) {
    case "assist": return orderId ? fillAndSealOrder(state, orderId) : state;
    case "supplies": return { ...state, notice: "The emergency delivery is ready." };
    case "special":
      return { ...state, powerups: { ...state.powerups, special: 3 }, notice: "The next three handoffs each get a $2 tip bonus." };
    case "quiet":
      return { ...state, quietUntil: Math.min(state.duration + LAST_CALL_SECONDS, state.elapsed + (state.expert ? 7 : 9)),
        notice: "The line can wait while the kitchen works." };
    case "quality":
      return { ...state, powerups: { ...state.powerups, quality: 1 }, notice: "The next handoff that needs it gets a quality boost." };
    case "patience": {
      const extra = state.expert ? 8 : 12;
      const orders = state.orders.map((order) => !order.catering && isPresent(order, state.elapsed) ?
        { ...order, patience: order.patience + extra, maxPatience: order.maxPatience + extra } : order);
      return { ...state, orders, powerups: { ...state.powerups, patience: state.powerups.patience + 1 }, notice: "House samples gave the guests more time." };
    }
    case "rush": {
      const brewing = state.orders.some((order) => order.status === "brewing");
      const activeBatches = PREP_IDS.filter((prep) => state[PREP_KEYS[prep]].cooking);
      if (!brewing && !activeBatches.length) {
        return { ...state, powerups: { ...state.powerups, rush: 1 }, notice: "The next brew or batch will reach its target immediately." };
      }
      const orders = state.orders.map((order) => order.status === "brewing" && order.cup ? brewed(order, order.cup.brew.target, 100) : order);
      let next = { ...state, orders };
      const filling = state.orders.find(({ status, cup }) => status === "brewing" && cup?.brew.carafeFill)?.cup;
      if (filling) next.carafe = { tea: filling.tea, quality: 100, filledAt: state.elapsed };
      for (const prep of activeBatches) {
        const key = PREP_KEYS[prep];
        next = collectBatch({ ...next, [key]: { ...state[key], elapsed: state[key].target } }, prep);
      }
      return { ...next, notice: "The tea and batches in progress are ready." };
    }
  }
}

export function activateCampaignPowerup(campaign: Campaign, state: ServiceDay, id: PowerupId, orderId?: string) {
  const fail = (message: string) => ({ ok: false, campaign, service: state, message });
  if (state.day !== campaign.day || state.expert !== (campaign.mode === "expert")) {
    return fail("The shift does not match this shop.");
  }
  const block = campaignPowerupBlockReason(campaign, id) || servicePowerupBlockReason(state, id, orderId, campaign);
  if (block) return fail(block);

  const service = useServicePowerup(state, id, orderId);
  const used = usePowerup(campaign, id);
  if (!used.ok) return fail(used.message);
  const stock = consumeIngredients(used.campaign, serviceUsageDelta(state, service));
  if (!stock.ok) return fail(stock.message);
  const message = id === "supplies" ? used.message : service.notice;
  return { ok: true, campaign: stock.campaign, service: { ...service, notice: message }, message };
}

export function closeServiceDay(state: ServiceDay): ServiceDay {
  if (state.status === "complete") return state;
  if (state.preOpen !== undefined) {
    return {
      ...openServiceDoors(state), orders: [], orderPlan: state.orderPlan ?? servicePlan(state.orders),
      status: "complete", notice: "The shift is complete.",
    };
  }
  const orders = state.orders.filter((order) => order.arrivesAt <= state.elapsed + EPSILON).map((order): ServiceOrder =>
    isPresent(order, state.elapsed) ? { ...order, status: "missed", patience: 0, cup: null } : order);
  const streak = state.orders.some((order) => isPresent(order, state.elapsed)) ? 0 : state.streak;
  return { ...state, orders, streak, orderPlan: state.orderPlan ?? servicePlan(state.orders), status: "complete", notice: "The shift is complete." };
}

export function serviceSummary(state: ServiceDay): ServiceSummary {
  const { receipts } = state;
  let revenue = 0;
  let tips = 0;
  let quality = 0;
  const regularVisits: Record<string, number> = {};
  for (const receipt of receipts) {
    revenue += receipt.revenue;
    tips += receipt.tips;
    quality += receipt.quality;
    if (receipt.packedAt === undefined && receipt.quality >= 70) regularVisits[receipt.customerId] = (regularVisits[receipt.customerId] ?? 0) + 1;
  }
  return {
    revenue, tips, served: receipts.length, shiftScore: quality, quality: receipts.length ? Math.round(quality / receipts.length) : 0,
    missed: state.orders.filter((order) => order.status === "missed").length, regularVisits,
  };
}

export function serviceRecipeRecords(state: ServiceDay): RecipeRecords {
  const standardOrders = new Map(state.orders.filter((order) => !order.catering && !order.specialRequest &&
    !order.houseBlend && !order.seasonalSpecial && !order.locationSpecial && !order.swap).map((order) => [order.id, order]));
  const records = new Map<string, RecipeRecords[string]>();
  for (const { orderId, recipeName, quality } of state.receipts) {
    const order = standardOrders.get(orderId);
    if (!order || favoritesByCustomer.get(order.customerId) !== recipeName) continue;
    const entry = records.get(recipeName);
    records.set(recipeName, { best: Math.max(entry?.best ?? 0, quality), count: (entry?.count ?? 0) + 1 });
  }
  return Object.fromEntries(records);
}

export function serviceUsageDelta(before: ServiceDay, after: ServiceDay): IngredientPortions {
  const portions: IngredientPortions = {};
  if (before.day !== after.day || before.expert !== after.expert) return portions;
  for (const { id } of INGREDIENTS) {
    const delta = (after.usage[id] ?? 0) - (before.usage[id] ?? 0);
    if (delta > 0) portions[id] = delta;
  }
  return portions;
}

// The campaign saves the pantry and this workbench together after every action.
// Validate the whole workbench before reusing either its timers or its recorded sales.
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function wholeInRange(value: unknown, min: number, max: number): value is number {
  return inRange(value, min, max) && Number.isInteger(value);
}

function isChoice<T extends string | number>(value: unknown, options: readonly T[]): value is T {
  return options.some((option) => value === option);
}

function isPortions(value: unknown, maximum: number): value is IngredientPortions {
  return isRecord(value) && Object.entries(value).every(([id, number]) =>
    INGREDIENTS.some((ingredient) => ingredient.id === id) && wholeInRange(number, 0, maximum));
}

function isRecipe(value: unknown): value is Recipe {
  return isRecord(value) && typeof value.name === "string" && isChoice(value.tea, TEAS) &&
    (value.accentTea === undefined || (isChoice(value.accentTea, TEAS) && value.accentTea !== value.tea)) &&
    (value.milk === null || isChoice(value.milk, MILKS)) && isChoice(value.syrup, SYRUPS) &&
    isChoice(value.sugar, ICE_LEVELS) && isChoice(value.ice, ICE_LEVELS) && typeof value.bun === "boolean" &&
    (value.foam === undefined || typeof value.foam === "boolean") &&
    (value.sparkling === undefined || (value.sparkling === true && value.milk === null && !value.foam && value.float === undefined)) &&
    (value.float === undefined || (!value.foam && isChoice(value.float, FLOAT_FLAVORS))) &&
    (value.waffle === undefined || (value.waffle === true && !value.bun)) &&
    Array.isArray(value.toppings) && value.toppings.length <= 4 && value.toppings.every((item) => isChoice(item, TOPPINGS)) &&
    Array.isArray(value.mixins) && value.mixins.length <= 4 && value.mixins.every((item) => isChoice(item, MIXINS));
}

function isCup(value: unknown): value is ServiceCup {
  if (!isRecord(value) || !isChoice(value.tea, TEAS) || (value.milk !== null && !isChoice(value.milk, MILKS)) ||
    !isChoice(value.ice, ICE_LEVELS) || typeof value.shaken !== "boolean" || typeof value.sealed !== "boolean" ||
    !isPortions(value.ingredients, 3) || !inRange(value.qualityBonus, -20, 20) || !isRecord(value.prepQuality)) return false;

  const { brew, prepQuality, ingredients, accentTea } = value;
  if (accentTea !== undefined && (!isChoice(accentTea, TEAS) || accentTea === value.tea)) return false;
  const target = brewTarget(value.tea, accentTea);
  if (!isRecord(brew) || brew.target !== target || !inRange(brew.elapsed, 0, target * 2) ||
    typeof brew.done !== "boolean" || (brew.done ? !wholeInRange(brew.quality, 0, 100) : brew.quality !== null) ||
    (brew.carafeFill !== undefined && (brew.carafeFill !== true || !!accentTea))) return false;
  if (value.sealed && (!brew.done || !value.shaken)) return false;
  if (value.finishTouchedAt !== undefined && (!value.shaken || !inRange(value.finishTouchedAt, 0, SHIFT_SECONDS + LAST_CALL_SECONDS))) return false;
  if (value.foamed !== undefined && (typeof value.foamed !== "boolean" || (value.foamed && (!value.shaken || !brew.done)))) return false;
  if (ingredients.seltzer !== undefined || (value.sparkling !== undefined && (typeof value.sparkling !== "boolean" ||
    (value.sparkling && (!value.shaken || !brew.done || value.milk !== null || value.foamed || value.float !== undefined))))) return false;
  if (value.float !== undefined && (!isRecord(value.float) || !isChoice(value.float.flavor, FLOAT_FLAVORS) ||
    !inRange(value.float.scoopedAt, 0, SHIFT_SECONDS + LAST_CALL_SECONDS) || !value.shaken || !brew.done || value.foamed)) return false;
  if (value.sealedAt !== undefined && (!value.sealed || !inRange(value.sealedAt, 0, SHIFT_SECONDS + LAST_CALL_SECONDS))) return false;

  return PREP_IDS.every((id) => {
    const quality = prepQuality[id];
    const count = ingredients[id] ?? 0;
    if (quality === undefined) return count === 0;
    return Array.isArray(quality) && quality.length === count && quality.every((grade) => wholeInRange(grade, 0, 100));
  });
}

function isBatch(value: unknown, id: PrepId, elapsed: number): value is PrepBatch {
  if (!isRecord(value) || typeof value.cooking !== "boolean" || value.target !== PREP_TARGETS[id] ||
    !inRange(value.elapsed, 0, PREP_TARGETS[id] * 2) || !wholeInRange(value.ready, 0, PREP_YIELDS[id]) ||
    !wholeInRange(value.quality, 0, 100) || (value.cookedAt !== null && !inRange(value.cookedAt, 0, elapsed))) return false;
  if (value.cooking) return value.ready === 0 && value.cookedAt === null;
  return value.ready === 0 || value.cookedAt !== null;
}

function isIngredientSwap(value: unknown, recipe: Recipe, customerId: string, day: number) {
  if (!isRecord(value) || !wholeInRange(value.amount, 1, 3) || value.from === value.to) return false;
  const { from, to, amount } = value;
  if (isChoice(from, MILKS) && isChoice(to, MILKS)) {
    return amount === 1 && recipe.milk === to && INGREDIENT_UNLOCK_DAYS[from] <= day && INGREDIENT_UNLOCK_DAYS[to] <= day;
  }
  if (!isChoice(from, MIXINS) || !isChoice(to, MIXINS) ||
    INGREDIENT_UNLOCK_DAYS[from] > day || INGREDIENT_UNLOCK_DAYS[to] > day) return false;
  const toCount = recipe.mixins.filter((fruit) => fruit === to).length;
  return toCount >= amount && toCount <= 3 && !recipe.mixins.includes(from) && fruitAlternatives(customerId, from).includes(to);
}

function isServiceOrder(value: unknown, elapsed: number, day: number): value is ServiceOrder {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.customerId !== "string" ||
    (value.catering !== true && !REGULARS.some((regular) => regular.id === value.customerId)) ||
    typeof value.customerName !== "string" || typeof value.tag !== "string" ||
    !inRange(value.arrivesAt, 0, SHIFT_SECONDS) || !inRange(value.maxPatience, 1, Number.MAX_SAFE_INTEGER) ||
    !inRange(value.patience, 0, value.maxPatience) || !isRecipe(value.recipe)) return false;
  if (value.recipe.foam && day < FROTH_DAY) return false;
  if (value.recipe.sparkling && day < INGREDIENT_UNLOCK_DAYS.seltzer) return false;
  if (value.recipe.accentTea && day < MIXED_TEA_DAY) return false;
  if (isRecord(value.cup) && !!value.cup.accentTea !== !!value.recipe.accentTea) return false;
  if (value.recipe.float && day < INGREDIENT_UNLOCK_DAYS[value.recipe.float]) return false;
  if (day < INGREDIENT_UNLOCK_DAYS.waffle && (value.recipe.waffle || (isRecord(value.cup) && isRecord(value.cup.ingredients) && value.cup.ingredients.waffle))) return false;
  if (isRecord(value.cup) && ((value.cup.foamed && !value.recipe.foam) || (value.cup.sparkling && !value.recipe.sparkling))) return false;
  if (value.specialRequest !== undefined && (!isRecord(value.specialRequest) ||
    typeof value.specialRequest.line !== "string" || !value.specialRequest.line.length || value.specialRequest.line.length > 200 ||
    !wholeInRange(value.specialRequest.bonus, 1, 5000))) return false;
  if (value.houseBlend !== undefined) {
    if (value.houseBlend !== true || value.specialRequest !== undefined || value.locationSpecial !== undefined ||
      value.seasonalSpecial !== undefined || value.reservation !== undefined) return false;
    const { recipe, customerId } = value;
    const blend = normalizeHouseBlend({ ...recipe, topping: recipe.toppings[0] ?? null, fruit: recipe.mixins[0] ?? null }, day);
    if (recipeSide(recipe) || recipe.foam || recipe.toppings.length > 1 || recipe.mixins.length > 1 ||
      !blend || recipe.name !== recipeFromHouseBlend(blend).name ||
      !REGULARS.some(({ id, day: debut }) => id === customerId && debut < day)) return false;
  }
  if (value.reservation !== undefined && (value.reservation !== true || value.specialRequest !== undefined ||
    value.locationSpecial !== undefined || value.seasonalSpecial !== undefined)) return false;
  if (value.catering !== undefined && (value.catering !== true || value.specialRequest !== undefined || value.houseBlend !== undefined ||
    value.reservation !== undefined || value.locationSpecial !== undefined || value.seasonalSpecial !== undefined)) return false;
  if (value.locationSpecial !== undefined) {
    if (typeof value.locationSpecial !== "string" || !Object.hasOwn(LOCATION_MENUS, value.locationSpecial) ||
      value.specialRequest !== undefined || value.seasonalSpecial !== undefined) return false;
    const recipe = value.recipe;
    if (!LOCATION_MENUS[value.locationSpecial as keyof typeof LOCATION_MENUS].some(({ name }) => name === recipe.name)) return false;
  }
  if (value.seasonalSpecial !== undefined &&
    (typeof value.seasonalSpecial !== "string" || !Object.hasOwn(EVENT_MENUS, value.seasonalSpecial) ||
      EVENT_MENUS[value.seasonalSpecial]?.name !== value.recipe.name || value.specialRequest !== undefined)) return false;
  if (value.swap !== undefined && (value.status === "waiting" || !ordinaryTicket({
    reservation: value.reservation, catering: value.catering, specialRequest: value.specialRequest,
    locationSpecial: value.locationSpecial, seasonalSpecial: value.seasonalSpecial, houseBlend: value.houseBlend,
  }) || !isIngredientSwap(value.swap, value.recipe, value.customerId, day))) return false;
  if (value.arrivesAt > elapsed + EPSILON && value.status !== "waiting") return false;
  if (isRecord(value.cup) && inRange(value.cup.sealedAt, 0, Infinity) && value.cup.sealedAt > elapsed + EPSILON) return false;
  if (isRecord(value.cup) && typeof value.cup.finishTouchedAt === "number" &&
    !inRange(value.cup.finishTouchedAt, 0, typeof value.cup.sealedAt === "number" ? value.cup.sealedAt : elapsed)) return false;
  if (isRecord(value.cup) && isRecord(value.cup.float) &&
    (!value.recipe.float || !inRange(value.cup.float.scoopedAt, 0, typeof value.cup.sealedAt === "number" ? value.cup.sealedAt : elapsed))) return false;
  switch (value.status) {
    case "waiting":
    case "accepted": return value.cup === null && value.patience > 0;
    case "missed": return value.cup === null && value.patience === 0;
    case "brewing": return isCup(value.cup) && !value.cup.brew.done && value.patience > 0;
    case "building": return isCup(value.cup) && value.cup.brew.done && value.patience > 0;
    case "served": return isCup(value.cup) && value.cup.sealed && value.patience > 0;
    default: return false;
  }
}

function isReceipt(value: unknown): value is ServiceReceipt {
  if (!isRecord(value) || typeof value.orderId !== "string" || typeof value.customerId !== "string" ||
    typeof value.customerName !== "string" || typeof value.recipeName !== "string" || typeof value.message !== "string" ||
    !wholeInRange(value.quality, 0, 100) || !wholeInRange(value.revenue, 0, 25000) || !wholeInRange(value.tips, 0, 10000) ||
    (value.specialBonus !== undefined && !wholeInRange(value.specialBonus, 1, 5000)) ||
    (value.menuBonus !== undefined && !wholeInRange(value.menuBonus, 1, 15000)) || !isRecord(value.grades)) return false;
  if (value.handedOffBy !== undefined && value.handedOffBy !== "runner") return false;
  if (value.packedAt !== undefined && !inRange(value.packedAt, 0, SHIFT_SECONDS)) return false;
  const { brew, build, finish, wait } = value.grades;
  return [brew, build, finish, wait].every((grade) => wholeInRange(grade, 0, 100));
}

function isEffects(value: unknown): value is ServiceEffects {
  return isRecord(value) && inRange(value.arrivalMultiplier, 0.1, 10) && inRange(value.patienceMultiplier, 0.1, 10) &&
    inRange(value.tipMultiplier, 0, 10) && wholeInRange(value.qualityBonus, 0, 100) && wholeInRange(value.fruitBonus, 0, 5000) &&
    (value.prepMultiplier === undefined || inRange(value.prepMultiplier, 0.1, 10)) &&
    (value.prepHoldBonus === undefined || wholeInRange(value.prepHoldBonus, 0, 60)) &&
    (value.floatHoldBonus === undefined || wholeInRange(value.floatHoldBonus, 0, 60)) &&
    (value.ticketSlots === undefined || wholeInRange(value.ticketSlots, MAX_ACTIVE_ORDERS, MAX_ACTIVE_ORDERS + 1)) &&
    (value.autoSeal === undefined || typeof value.autoSeal === "boolean") &&
    (value.sideBonus === undefined || wholeInRange(value.sideBonus, 0, 5000)) &&
    (value.icedBonus === undefined || wholeInRange(value.icedBonus, 0, 5000)) &&
    (value.sparklingBonus === undefined || wholeInRange(value.sparklingBonus, 0, 5000)) &&
    (value.serveBonus === undefined || wholeInRange(value.serveBonus, 0, 1000)) &&
    (value.carafe === undefined || typeof value.carafe === "boolean") &&
    (value.batchPickup === undefined || typeof value.batchPickup === "boolean") &&
    [value.autoTea, value.autoMilk, value.autoToppings, value.autoExtras].every((effect) => typeof effect === "boolean");
}

export function restoreService(value: unknown, day: number, expert: boolean): ServiceDay | null {
  if (!isRecord(value) || !wholeInRange(day, 1, Number.MAX_SAFE_INTEGER) || value.day !== day || value.expert !== expert ||
    value.duration !== SHIFT_SECONDS || !inRange(value.elapsed, 0, SHIFT_SECONDS + LAST_CALL_SECONDS) ||
    !isChoice(value.status, ["open", "closing", "complete"]) || typeof value.notice !== "string" ||
    !isPortions(value.usage, Number.MAX_SAFE_INTEGER) || !isEffects(value.effects) || !isRecord(value.powerups) ||
    ![value.powerups.rush, value.powerups.patience, value.powerups.quality].every((count) => wholeInRange(count, 0, Number.MAX_SAFE_INTEGER)) ||
    (value.powerups.special !== undefined && !wholeInRange(value.powerups.special, 0, 3))) return null;

  if (value.crewActivity !== undefined && (!isRecord(value.crewActivity) ||
    !Object.entries(value.crewActivity).every(([id, activity]) =>
      ["host", "prep", "runner"].includes(id) && typeof activity === "string" && activity.length <= 200))) return null;

  if (value.pendingDelivery !== undefined) {
    const pending = value.pendingDelivery;
    if (day < EXPRESS_DELIVERY_DAY || !isRecord(pending) ||
      !isChoice(pending.ingredient, unlockedIngredients(day))) return null;
    const quote = expressDeliveryQuote({ mode: expert ? "expert" : "normal" }, pending.ingredient);
    if (pending.cost !== quote.cost || pending.quantity !== quote.quantity ||
      !inRange(pending.arrivesAt, quote.seconds, Math.min(value.elapsed + quote.seconds + EPSILON, SHIFT_SECONDS + LAST_CALL_SECONDS))) return null;
  }

  if (value.orderPlan !== undefined) {
    const plan = value.orderPlan;
    if (!isRecord(plan) || !wholeInRange(plan.orders, 0, MAX_TICKETS) ||
      !wholeInRange(plan.fruit, 0, plan.orders) || !wholeInRange(plan.buns, 0, plan.orders) || typeof plan.special !== "boolean") return null;
  }

  const { elapsed, orders, receipts, status } = value;
  if ((status === "open" && elapsed + EPSILON >= SHIFT_SECONDS) || (status === "closing" && elapsed + EPSILON < SHIFT_SECONDS) ||
    !isBatch(value.pearls, "pearls", elapsed) || !isBatch(value.buns, "bun", elapsed) ||
    (value.waffles !== undefined && (!isBatch(value.waffles, "waffle", elapsed) ||
      (day < INGREDIENT_UNLOCK_DAYS.waffle && (value.waffles.ready || value.waffles.cooking)))) ||
    !Array.isArray(orders) || orders.length > MAX_TICKETS || !orders.every((order) => isServiceOrder(order, elapsed, day)) ||
    !Array.isArray(receipts) || receipts.length > orders.length || !receipts.every(isReceipt)) return null;

  if (value.preOpen !== undefined && (!inRange(value.preOpen, EPSILON, openingPrepSeconds(expert)) ||
    status !== "open" || elapsed !== 0 || receipts.length || value.pendingDelivery !== undefined ||
    value.carafe !== undefined || value.quietUntil !== undefined || value.houseRoundReady || value.houseRoundAt !== undefined ||
    orders.some((order) => order.status !== "waiting" || order.patience !== order.maxPatience))) return null;
  if (orders.filter(({ houseBlend }) => houseBlend).length > 1) return null;
  const doubling = orders.filter(({ status, cup }) => status === "brewing" && cup?.brew.carafeFill).length;
  if (doubling > 1 || (!value.effects.carafe && orders.some(({ cup }) => cup?.brew.carafeFill))) return null;
  if (value.carafe !== undefined && (!value.effects.carafe || doubling || !isRecord(value.carafe) ||
    !isChoice(value.carafe.tea, TEAS) || INGREDIENT_UNLOCK_DAYS[value.carafe.tea] > day ||
    !wholeInRange(value.carafe.quality, 0, 100) || !inRange(value.carafe.filledAt, 0, elapsed))) return null;
  if ((value.streak !== undefined && !wholeInRange(value.streak, 0, receipts.length)) ||
    (value.houseRoundReady !== undefined && typeof value.houseRoundReady !== "boolean") ||
    (value.houseRoundAt !== undefined && !inRange(value.houseRoundAt, 0, elapsed))) return null;
  if (value.quietUntil !== undefined && !inRange(value.quietUntil, expert ? 7 : 9, Math.min(SHIFT_SECONDS + LAST_CALL_SECONDS, elapsed + (expert ? 7 : 9) + EPSILON))) return null;

  const booking = value.reservation;
  const members = orders.filter(({ reservation }) => reservation);
  if (booking === undefined) {
    if (members.length) return null;
  } else {
    const offer = reservationForDay(day, expert);
    if (!offer || !isRecord(booking) || booking.name !== offer.name || booking.count !== offer.count ||
      booking.minQuality !== offer.minQuality || booking.reward !== offer.reward || booking.arrivesAt !== offer.arrivesAt) return null;
    const expected = Math.min(offer.count, Math.max(0, Math.floor((elapsed + EPSILON - offer.arrivesAt) / RESERVATION_GUEST_GAP) + 1));
    if (members.length !== (status === "complete" ? expected : offer.count) ||
      new Set(orders.map((order) => order.customerId)).size !== orders.length ||
      !members.every((order, index) => order.id === `${day}-reservation-${index + 1}` &&
        order.arrivesAt === offer.arrivesAt + index * RESERVATION_GUEST_GAP && recipeAvailable(order.recipe, day))) return null;
  }

  const orderIds = new Set(orders.map((order) => order.id));
  const catering = orders.filter((order) => order.catering);
  const packed = receipts.filter((receipt) => receipt.packedAt !== undefined);
  if (value.catering === undefined) {
    if (catering.length || packed.length) return null;
  } else {
    const job = cateringOffer(day, expert);
    if (booking || !job || job.id !== value.catering) return null;
    const expected = job.recipes.map((_, index) => cateringTicket(day, job, index));
    const issued = status === "complete" ? expected.filter(({ arrivesAt }) => arrivesAt <= elapsed + EPSILON) : expected;
    if (catering.length !== issued.length || !issued.every((target, index) => {
      const { id, customerId, customerName, arrivesAt, maxPatience, recipe, status, patience } = catering[index];
      return id === target.id && customerId === target.customerId && customerName === target.customerName &&
        arrivesAt === target.arrivesAt && maxPatience === target.maxPatience && recipe.name === target.recipe.name &&
        recipeAvailable(recipe, day) && (status === "served" || status === "missed" ||
          Math.abs(patience - (job.deadline - Math.max(arrivesAt, elapsed))) <= EPSILON);
    })) return null;
    if (packed.length !== catering.filter(({ status }) => status === "served").length || !packed.every((receipt) =>
      catering.some((order) => order.id === receipt.orderId && order.status === "served" && receipt.tips === 0 &&
        inRange(receipt.packedAt, order.cup?.sealedAt ?? order.arrivesAt, Math.min(elapsed, job.deadline))))) return null;
  }
  const served = orders.filter((order) => order.status === "served");
  if (orderIds.size !== orders.length || orders.filter(isActiveOrder).length > (value.effects.ticketSlots ?? MAX_ACTIVE_ORDERS) || served.length !== receipts.length ||
    new Set(receipts.map((receipt) => receipt.orderId)).size !== receipts.length ||
    !receipts.every((receipt) => served.some((order) => receipt.orderId === order.id && receipt.customerId === order.customerId)) ||
    (status === "closing" && (elapsed >= SHIFT_SECONDS + LAST_CALL_SECONDS || !orders.some((order) => isPresent(order, elapsed)))) ||
    (status === "complete" && orders.some((order) => order.status === "waiting" || isActiveOrder(order)))) return null;

  const restored = value as unknown as ServiceDay;
  const effects = {
    ...restored.effects,
    prepMultiplier: restored.effects.prepMultiplier ?? 1,
    prepHoldBonus: restored.effects.prepHoldBonus ?? 0,
    floatHoldBonus: restored.effects.floatHoldBonus ?? 0,
    ticketSlots: restored.effects.ticketSlots ?? MAX_ACTIVE_ORDERS,
    autoSeal: restored.effects.autoSeal ?? false,
    sideBonus: restored.effects.sideBonus ?? 0,
    icedBonus: restored.effects.icedBonus ?? 0,
    sparklingBonus: restored.effects.sparklingBonus ?? 0,
    serveBonus: restored.effects.serveBonus ?? 0,
    carafe: restored.effects.carafe ?? false,
    batchPickup: restored.effects.batchPickup ?? false,
  };
  return { ...restored, effects, waffles: restored.waffles ?? blankBatch("waffle"), streak: restored.streak ?? 0, houseRoundReady: restored.houseRoundReady ?? false, powerups: {
    ...blankPowerups(), rush: restored.powerups.rush, patience: restored.powerups.patience,
    quality: restored.powerups.quality, special: restored.powerups.special ?? 0,
  } };
}
