import { createRng } from "./core/rng.ts";
import { advanceCommission, commissionOffer, normalizeCommission, SHOP_PAINTS, type CommissionProgress, type ShopPaintId } from "./orders-commissions.ts";
import { canUsePrint, CUP_PRINTS, mergeRecipeRecords, normalizeRecipeRecords, type CupPrintId, type RecipeRecords } from "./orders-recipe-journal.ts";
import { normalizeRentBook, recordRentDay, type RentBook } from "./orders-rent-book.ts";

export const INGREDIENTS = [
  { id: "black", name: "Black tea", shelfLife: 7, openingStock: 12 },
  { id: "jasmine", name: "Jasmine tea", shelfLife: 7, openingStock: 12 },
  { id: "taro", name: "Taro", shelfLife: 7, openingStock: 10 },
  { id: "milk", name: "Dairy milk", shelfLife: 4, openingStock: 15 },
  { id: "oat", name: "Oat milk", shelfLife: 5, openingStock: 10 },
  { id: "pearls", name: "Tapioca pearls", shelfLife: 3, openingStock: 10 },
  { id: "popping", name: "Popping boba", shelfLife: 5, openingStock: 8 },
  { id: "pudding", name: "Pudding", shelfLife: 3, openingStock: 8 },
  { id: "strawberry", name: "Strawberries", shelfLife: 3, openingStock: 8 },
  { id: "banana", name: "Bananas", shelfLife: 3, openingStock: 8 },
  { id: "brown-sugar", name: "Brown sugar syrup", shelfLife: 10, openingStock: 12 },
  { id: "honey", name: "Honey", shelfLife: 10, openingStock: 8 },
  { id: "vanilla", name: "Vanilla syrup", shelfLife: 10, openingStock: 8 },
  { id: "bun", name: "Pineapple buns", shelfLife: 3, openingStock: 7 },
  { id: "mango", name: "Mango", shelfLife: 4, openingStock: 8 },
  { id: "grass-jelly", name: "Grass jelly", shelfLife: 5, openingStock: 8 },
  { id: "waffle", name: "Sesame waffle batter", shelfLife: 5, openingStock: 6 },
  { id: "banana-scoop", name: "Banana ice cream", shelfLife: 7, openingStock: 5 },
  { id: "vanilla-scoop", name: "Vanilla ice cream", shelfLife: 7, openingStock: 5 },
  { id: "sesame-syrup", name: "Toasted sesame syrup", shelfLife: 10, openingStock: 8 },
  { id: "yuzu", name: "Yuzu", shelfLife: 4, openingStock: 7 },
  { id: "seltzer", name: "Seltzer", shelfLife: 7, openingStock: 8 },
] as const;

export const FRUIT_INGREDIENTS = ["strawberry", "banana", "mango", "yuzu"] as const;

export const SUPPLIERS = [
  { id: "market", name: "Corner Market", description: "Small orders for immediate pickup.", price: 240, batchSize: 4, leadDays: 0, shelfLifeBonus: 0 },
  { id: "wholesaler", name: "Night Freight", description: "The lowest cost per portion, delivered tomorrow.", price: 560, batchSize: 16, leadDays: 1, shelfLifeBonus: 0 },
  { id: "cooperative", name: "Orchard Co-op", description: "Two extra days of shelf life, delivered in two days.", price: 620, batchSize: 10, leadDays: 2, shelfLifeBonus: 2 },
] as const;

export const UPGRADES = [
  { id: "cozy-seats", name: "Window Bench", description: "Guests give you 15% longer to make their orders.", price: 2400, level: 2 },
  { id: "auto-tea", name: "Tea Dispenser", description: "Selects the ordered tea and stops it brewing at the right time.", price: 3500, level: 2 },
  { id: "auto-milk", name: "Portion Pump", description: "Automatically adds the ordered milk.", price: 4200, level: 3 },
  { id: "better-recipe", name: "Recipe Notes", description: "Adds up to eight quality points per completed order.", price: 3200, level: 3 },
  { id: "auto-toppings", name: "Topping Carousel", description: "Adds available toppings as soon as a cup reaches Build.", price: 3800, level: 3 },
  { id: "street-sign", name: "Sidewalk Sign", description: "Guests arrive 15% more often and wait 6% less.", price: 3900, level: 4 },
  { id: "batch-timers", name: "Batch Timers", description: "Kitchen batches take 12% less time.", price: 2850, level: 2 },
  { id: "warm-shelf", name: "Warm Shelf", description: "Pearls, buns, and waffles stay fresh for 15 more seconds after cooking.", price: 3300, level: 3 },
  { id: "supplier-ledger", name: "Supplier Ledger", description: "Set up to four ingredients to reorder from their selected suppliers when fewer than four portions remain.", price: 3150, level: 3 },
  { id: "menu-easel", name: "Menu Easel", description: "Put a house tea on the menu. Guests will occasionally order it.", price: 3200, level: 3 },
  { id: "wall-calendar", name: "Wall Calendar", description: "See the next three days of events, deliveries, and rent at a glance.", price: 2150, level: 3 },
  { id: "takeout-rack", name: "Takeout Rack", description: "Book three-cup pickup orders from day 12.", price: 4450, level: 5 },
  { id: "opening-key", name: "Opening Key", description: "Cook a batch before guests arrive and the shift clock starts.", price: 2750, level: 4 },
  { id: "tip-jar", name: "Counter Tip Jar", description: "Guests leave 12% more in tips.", price: 3800, level: 3 },
  { id: "cold-storage", name: "Cold Storage", description: "New stock deliveries stay fresh for two extra days.", price: 4800, level: 4 },
  { id: "cold-tray", name: "Cold Tray", description: "Scoops stay cold for another twelve seconds at the pass.", price: 4200, level: 5 },
  { id: "tea-carafe", name: "Tea Carafe", description: "Brew two portions at once. Save one for the next guest who orders that tea.", price: 4400, level: 4 },
  { id: "pickup-counter", name: "Pickup Counter", description: "Hand out sealed drinks together. Adds 60¢ to each sale.", price: 6400, level: 5 },
  { id: "auto-extras", name: "Prep Cart", description: "Adds fruit, syrup, ready sides, and ice as a cup reaches Build.", price: 4800, level: 4 },
  { id: "ticket-rack", name: "Wide Ticket Rack", description: "Keep four tickets open across the counters.", price: 5400, level: 6 },
  { id: "auto-sealer", name: "Automatic Sealer", description: "Seals a finished drink when it matches the ticket.", price: 7200, level: 8 },
] as const;

export const POWERUPS = [
  { id: "rush", name: "Prep Sprint", description: "Instantly finishes every tea and batch in progress, or the next one you start.", price: 800, level: 1, expertOnly: false },
  { id: "patience", name: "House Samples", description: "Gives everyone at the counter extra patience.", price: 550, level: 1, expertOnly: false },
  { id: "quality", name: "Recipe Card", description: "Adds up to 12 quality points to the next handoff that needs them.", price: 650, level: 2, expertOnly: false },
  { id: "assist", name: "Counter Help", description: "Corrects the mix, plates cooked sides, then shakes and seals the selected cup.", price: 475, level: 1, expertOnly: false },
  { id: "supplies", name: "Emergency Run", description: "Tops up every unlocked ingredient below four portions. The delivery expires after today's shift.", price: 950, level: 1, expertOnly: false },
  { id: "special", name: "Tip Special", description: "Adds $2 to each of the next three tips before the day's tip multiplier.", price: 450, level: 2, expertOnly: false },
  { id: "quiet", name: "Window Chime", description: "Guests stop losing patience briefly while the kitchen keeps working.", price: 575, level: 4, expertOnly: false },
] as const;

export const CREW = [
  { id: "host", name: "Counter Host", description: "Guests wait 16% longer while the host is on duty.", price: 1600, wage: 160, level: 2, certificate: { name: "Welcome Service", benefit: "Guests wait 8% longer while the host is on duty.", price: 1600, premium: 40 } },
  { id: "prep", name: "Prep Cook", description: "Starts and collects needed kitchen batches, which take 25% less time.", price: 2300, wage: 220, level: 3, certificate: { name: "Batch Lead", benefit: "Prepared batches stay fresh 8 seconds longer.", price: 2200, premium: 55 } },
  { id: "runner", name: "Order Runner", description: "Hands out sealed drinks. Adds 90¢ per sale.", price: 3000, wage: 210, level: 4, certificate: { name: "Pass Lead", benefit: "Hands off drinks in 1.25 seconds and serves side stand orders faster.", price: 2400, premium: 55 } },
  { id: "manager", name: "Branch Manager", description: "Runs a separate branch selling its own tea using the shared pantry.", price: 5200, wage: 310, level: 5, certificate: { name: "Store Lead", benefit: "Serves up to five teas per shift and unlocks fruit and dessert menus.", price: 3200, premium: 75 } },
] as const;

export const BRANCHES = [
  { id: "corner", name: "Corner Counter", description: "Your original shop and its steady neighborhood crowd.", price: 0, level: 1, rent: 0, income: 0, arrivalMultiplier: 1, patienceMultiplier: 1, tipMultiplier: 1 },
  { id: "campus", name: "Campus Kiosk", description: "More frequent arrivals and $1.25 extra per completed order. Students are in a hurry.", price: 7400, level: 3, rent: 950, income: 125, arrivalMultiplier: 1.18, patienceMultiplier: 0.88, tipMultiplier: 1 },
  { id: "garden", name: "Garden Tea Room", description: "A slower crowd with more patience, bigger tips, and $1.45 extra per completed order.", price: 11000, level: 4, rent: 1250, income: 145, arrivalMultiplier: 0.9, patienceMultiplier: 1.2, tipMultiplier: 1.22 },
  { id: "night", name: "Night Market Stall", description: "Your fastest crowd leaves bigger tips and pays $2.20 extra per completed order.", price: 15200, level: 5, rent: 1800, income: 220, arrivalMultiplier: 1.32, patienceMultiplier: 0.84, tipMultiplier: 1.14 },
  { id: "station", name: "Central Station", description: "A brisk commuter rush, steadier patience, and $2.65 extra per completed order.", price: 20500, level: 6, rent: 2400, income: 265, arrivalMultiplier: 1.24, patienceMultiplier: 0.94, tipMultiplier: 1.1 },
  { id: "harbor", name: "Harbor Tea House", description: "Ferry riders wait longer and pay $3.05 extra per completed order.", price: 27500, level: 8, rent: 2650, income: 305, arrivalMultiplier: 1.19, patienceMultiplier: 1.16, tipMultiplier: 1.12 },
  { id: "loft", name: "Skyline Tea Loft", description: "Guests arrive more often, linger over tea, and pay $3.70 extra per completed order.", price: 38500, level: 10, rent: 3700, income: 370, arrivalMultiplier: 1.16, patienceMultiplier: 1.24, tipMultiplier: 1.18 },
] as const;

export const PROMOTIONS_BOARD = [
  { id: "sidewalk-samples", name: "Sidewalk Samples", description: "Guests arrive 22% more often and wait 14% less.", price: 180, level: 2, arrivalMultiplier: 1.22, patienceMultiplier: 0.86, tipMultiplier: 1, fruitBonus: 0 },
  { id: "loyalty-stamps", name: "Loyalty Stamp Drive", description: "Tips rise 65%, and guests wait 8% less.", price: 210, level: 3, arrivalMultiplier: 1, patienceMultiplier: 0.92, tipMultiplier: 1.65, fruitBonus: 0 },
  { id: "fruit-chalkboard", name: "Fruit Chalkboard", description: "Adds $1.90 to each fruit recipe with the right fruit portions and at least 70% quality.", price: 300, level: 3, arrivalMultiplier: 1, patienceMultiplier: 1, tipMultiplier: 1, fruitBonus: 190 },
] as const;

export interface DayEvent {
  id: string;
  name: string;
  description: string;
  arrivalMultiplier: number;
  patienceMultiplier: number;
  tipMultiplier: number;
  /** Extra cents per sale of a correctly made fruit recipe. */
  fruitBonus?: number;
  sideBonus?: number;
  icedBonus?: number;
  sparklingBonus?: number;
  sealerOffline?: boolean;
}

const EARLY_DAY_EVENTS: readonly DayEvent[] = [
  { id: "neighborhood", name: "Neighborhood Day", description: "A steady mix of familiar faces and first-time visitors.", arrivalMultiplier: 1, patienceMultiplier: 1, tipMultiplier: 1 },
  { id: "rain", name: "Rainy Afternoon", description: "Guests linger. Fresh snacks earn $1.15 extra.", arrivalMultiplier: 0.82, patienceMultiplier: 1.28, tipMultiplier: 1, sideBonus: 115 },
  { id: "campus", name: "Campus Break", description: "Students hurry. Extra-ice recipes earn 85¢ more when made to order.", arrivalMultiplier: 1.3, patienceMultiplier: 0.86, tipMultiplier: 1, icedBonus: 85 },
  { id: "tip-day", name: "Tip Jar Day", description: "Customers leave 50% bigger tips for the crew.", arrivalMultiplier: 1, patienceMultiplier: 1, tipMultiplier: 1.5 },
  { id: "market-day", name: "Street Market", description: "The market draws a crowd. Corner Market fruit costs 25% less.", arrivalMultiplier: 1.18, patienceMultiplier: 1, tipMultiplier: 1.2 },
  { id: "book-club", name: "Book Club", description: "The book club takes its time and tips well.", arrivalMultiplier: 0.95, patienceMultiplier: 1.18, tipMultiplier: 1.15 },
  { id: "festival", name: "Lantern Night", description: "The busiest evening of the week brings more guests and bigger tips.", arrivalMultiplier: 1.35, patienceMultiplier: 1.03, tipMultiplier: 1.25 },
  { id: "commute", name: "Morning Commute", description: "Guests have a little less time to wait and leave smaller tips.", arrivalMultiplier: 1.08, patienceMultiplier: 0.9, tipMultiplier: 0.75 },
  { id: "fruit-special", name: "Fruit Special", description: "Fruit drinks earn up to 90¢ more. Orchard Co-op fruit costs 15% less.", arrivalMultiplier: 1.1, patienceMultiplier: 1, tipMultiplier: 1, fruitBonus: 90 },
];

export const LATE_EVENT_DAY = 29;
export const DAY_EVENTS: readonly DayEvent[] = [
  ...EARLY_DAY_EVENTS,
  { id: "candlelight", name: "Candlelight Service", description: "Seal by hand today. Guests wait longer and tip 25% more.",
    arrivalMultiplier: 0.97, patienceMultiplier: 1.16, tipMultiplier: 1.25, sealerOffline: true },
  { id: "bottle-return", name: "Bottle Return", description: "Corner Market seltzer is 25% off. Well-made sparkling tea earns $1.15 extra.",
    arrivalMultiplier: 1.13, patienceMultiplier: .97, tipMultiplier: 1, sparklingBonus: 115 },
];

export function dayEvent(id: string) {
  return DAY_EVENTS.find((event) => event.id === id) ?? DAY_EVENTS[0];
}

export const NEIGHBORHOOD_AWARDS = [
  { threshold: 60, name: "Good Neighbor", benefit: "5% more guest patience", patience: 1.05 },
  { threshold: 75, name: "Local Favorite", benefit: "8% larger tips", tips: 1.08 },
  { threshold: 90, name: "Neighborhood Landmark", benefit: "10% off new locations", branchPrice: 0.9 },
] as const;

export type PublicityId = typeof PROMOTIONS_BOARD[number]["id"];
export type CrewId = typeof CREW[number]["id"];
export type LiveCrewId = Exclude<CrewId, "manager">;
export type BranchId = typeof BRANCHES[number]["id"];
export type ManagerMenuId = "classic" | "fruit" | "dessert";

interface LocationManager {
  scheduled: boolean;
  shifts: number;
  certified: boolean;
}

export interface BranchFitting {
  name: string;
  description: string;
  price: number;
  level: number;
  addedRent: number;
  arrivalMultiplier?: number;
  patienceMultiplier?: number;
  tipMultiplier?: number;
  fruitBonus?: number;
  serveBonus?: number;
}

export const BRANCH_FITTINGS: Record<BranchId, BranchFitting> = {
  corner: { name: "Tea Window", description: "Guests arrive 12% more often and wait 4% less.", price: 2800, level: 3, addedRent: 0, arrivalMultiplier: 1.12, patienceMultiplier: 0.96 },
  campus: { name: "Study Bench", description: "Guests wait 16% longer and arrive 6% less often.", price: 4200, level: 4, addedRent: 0, patienceMultiplier: 1.16, arrivalMultiplier: 0.94 },
  garden: { name: "Glasshouse Shelf", description: "Adds 65¢ to each fruit recipe with the right fruit portions and at least 70% quality.", price: 4900, level: 5, addedRent: 300, fruitBonus: 65 },
  night: { name: "Late Lanterns", description: "Tips rise 18%, and guests wait 6% less.", price: 5800, level: 6, addedRent: 0, tipMultiplier: 1.18, patienceMultiplier: 0.94 },
  station: { name: "Express Rail", description: "Guests arrive 10% more often and each completed order earns 70¢ extra.", price: 7200, level: 7, addedRent: 0, serveBonus: 70, arrivalMultiplier: 1.10 },
  harbor: { name: "Pier Seating", description: "Guests wait 22% longer and arrive 6% less often.", price: 8600, level: 9, addedRent: 500, patienceMultiplier: 1.22, arrivalMultiplier: 0.94 },
  loft: { name: "Observation Deck", description: "Guests wait 16% longer and arrive 6% less often.", price: 10200, level: 10, addedRent: 600, patienceMultiplier: 1.16, arrivalMultiplier: 0.94 },
};

export type CampaignMode = "normal" | "expert";
export type IngredientId = typeof INGREDIENTS[number]["id"];
export type SupplierId = typeof SUPPLIERS[number]["id"];
export type UpgradeId = typeof UPGRADES[number]["id"];
export type PowerupId = typeof POWERUPS[number]["id"];
export type StandingOrders = Partial<Record<IngredientId, SupplierId>>;
export type IngredientPortions = Partial<Record<IngredientId, number>>;

export const INGREDIENT_UNLOCK_DAYS: Record<IngredientId, number> = {
  black: 1, milk: 1, pearls: 1, "brown-sugar": 1,
  jasmine: 2, strawberry: 2, honey: 2, bun: 2,
  taro: 3, oat: 3, popping: 3, banana: 3, vanilla: 3, pudding: 4,
  mango: 7, "grass-jelly": 9, waffle: 13, "banana-scoop": 16, "vanilla-scoop": 16,
  "sesame-syrup": 18, yuzu: 23, seltzer: 27,
};

export interface StockLot {
  id: number;
  ingredient: IngredientId;
  quantity: number;
  /** The first day the lot can no longer be used. */
  expiresOn: number;
}

export interface Delivery extends StockLot {
  supplier: SupplierId;
  arrivesOn: number;
}

export interface DayEarnings {
  revenue: number;
  tips: number;
  served: number;
  quality: number;
  missed?: number;
  contractBonus?: number;
  reservationBonus?: number;
  cateringBonus?: number;
  managedSales?: number;
  managedOrders?: number;
  managerSales?: number;
  managerOrders?: number;
  floatingManagerWorked?: boolean;
  commissionServed?: number;
  regularVisits?: Record<string, number>;
  recipeRecords?: RecipeRecords;
}

export interface DayReport {
  day: number;
  revenue: number;
  tips: number;
  served: number;
  quality: number;
  missed: number;
  expired: number;
  rent: number;
  rentOwed: number;
  wages: number;
  branchIncome: number;
  contractBonus?: number;
  reservationBonus?: number;
  cateringBonus?: number;
  managedSales?: number;
  managedOrders?: number;
  managerSales?: number;
  managerOrders?: number;
  publicityCost?: number;
  standingOrders: number;
  standingSpent: number;
  commissionReward?: number;
  commissionName?: string;
  unlockedPaint?: ShopPaintId;
  newAward?: number;
  promotion: string | null;
  level: number;
  reason: string | null;
}

export interface Campaign {
  version: 2;
  mode: CampaignMode;
  day: number;
  cash: number;
  xp: number;
  reputation: number;
  highestReputation: number;
  status: "planning" | "open" | "closed";
  inventory: StockLot[];
  deliveries: Delivery[];
  legacyUnlimitedStock: boolean;
  crew: CrewId[];
  crewShifts: Partial<Record<CrewId, number>>;
  certifiedCrew: CrewId[];
  activeCrew: LiveCrewId[];
  branches: BranchId[];
  branchFittings: BranchId[];
  activeBranch: BranchId;
  managedBranch?: BranchId | null;
  managerBranch?: BranchId | null;
  locationManagers: Partial<Record<BranchId, LocationManager>>;
  managerMenus: Partial<Record<BranchId, ManagerMenuId>>;
  publicity?: PublicityId | null;
  standingOrders?: StandingOrders;
  commission: CommissionProgress | null;
  paint: ShopPaintId;
  paintUnlocked: ShopPaintId[];
  recipeRecords: RecipeRecords;
  cupPrint: CupPrintId;
  upgrades: string[];
  powerups: Record<PowerupId, number>;
  activePowerups: PowerupId[];
  currentEvent: string;
  lastDay: DayReport | null;
  regularVisits: Record<string, number>;
  rentPaid: number;
  rentBook: RentBook;
  nextId: number;
}

interface CampaignResult {
  ok: boolean;
  campaign: Campaign;
  message: string;
}

export interface CampaignEffects {
  arrivalMultiplier: number;
  patienceMultiplier: number;
  tipMultiplier: number;
  qualityBonus: number;
  fruitBonus: number;
  autoTea: boolean;
  autoMilk: boolean;
  autoToppings: boolean;
  autoExtras: boolean;
  carafe: boolean;
  batchPickup: boolean;
  prepMultiplier: number;
  prepHoldBonus: number;
  floatHoldBonus: number;
  ticketSlots: number;
  autoSeal: boolean;
  serveBonus: number;
}

export const STANDING_ORDER_LIMIT = 4;
export const STANDING_ORDER_THRESHOLD = 4;
export const CREW_CERTIFICATE_SHIFTS = 2;
export const RUNNER_HANDOFF_SECONDS = 2.5;
export const RENT_CYCLE_DAYS = 7;
const LEVELS = [0, 75, 185, 330, 510, 730, 1000, 1360, 1840, 2350];
const PROMOTIONS = ["Corner counter", "Neighborhood stop", "Local favorite", "Market fixture", "Tea house", "Neighborhood landmark", "City institution", "Harbor favorite", "City tea network", "Skyline tea keeper"];

function whole(value: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : fallback;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function visitCounts(value: unknown) {
  return Object.fromEntries(Object.entries(record(value) ?? {}).flatMap(([name, count]) => {
    const visits = whole(count);
    return name.length > 0 && name.length <= 80 && visits > 0 ? [[name, visits]] : [];
  }));
}

export function blankPowerups(): Record<PowerupId, number> {
  return { rush: 0, patience: 0, quality: 0, assist: 0, supplies: 0, special: 0, quiet: 0 };
}

export function eventForDay(day: number): DayEvent {
  day = whole(day, 1);
  if (day < 2) return EARLY_DAY_EVENTS[0];

  // Shuffle a fresh deck for each group of days so weather and crowds vary
  // while every event recurs. Reloads and concurrent tabs draw the same card.
  const late = day >= LATE_EVENT_DAY;
  const draw = day - (late ? LATE_EVENT_DAY : 2);
  const deck = [...(late ? DAY_EVENTS : EARLY_DAY_EVENTS)];
  const round = Math.floor(draw / deck.length) + (late ? (LATE_EVENT_DAY - 2) / EARLY_DAY_EVENTS.length : 0);
  const random = createRng(round + 2);
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck[draw % deck.length];
}

function shelfLifeBonus(mode: CampaignMode) {
  return mode === "normal" ? 3 : 0;
}

export function deliveryShelfLife(campaign: Pick<Campaign, "mode" | "upgrades">, ingredientDays: number, supplierBonus: number) {
  return ingredientDays + supplierBonus + shelfLifeBonus(campaign.mode) + (campaign.upgrades.includes("cold-storage") ? 2 : 0);
}

function openingStock(mode: CampaignMode, day: number, nextId = 1): StockLot[] {
  return INGREDIENTS.map((ingredient, index) => ({
    id: nextId + index,
    ingredient: ingredient.id,
    quantity: ingredient.openingStock + (mode === "normal" ? 4 : 0),
    expiresOn: Math.max(day + ingredient.shelfLife, INGREDIENT_UNLOCK_DAYS[ingredient.id] + 1) + shelfLifeBonus(mode),
  }));
}

export function newCampaign(mode: CampaignMode): Campaign {
  const inventory = openingStock(mode, 1);
  return {
    version: 2, mode, day: 1, cash: mode === "expert" ? 4200 : 5400, xp: 0, reputation: 50, highestReputation: 50,
    status: "planning", inventory, deliveries: [], upgrades: [], powerups: blankPowerups(), activePowerups: [],
    legacyUnlimitedStock: false, crew: [], crewShifts: {}, certifiedCrew: [], activeCrew: [], branches: ["corner"], branchFittings: [], activeBranch: "corner", managedBranch: null, managerBranch: null, locationManagers: {}, managerMenus: {}, publicity: null,
    commission: null, standingOrders: {}, paint: "clay", paintUnlocked: ["clay"], recipeRecords: {}, cupPrint: "house",
    currentEvent: eventForDay(1).id, lastDay: null, regularVisits: {}, rentPaid: 0, rentBook: normalizeRentBook(null), nextId: inventory.length + 1,
  };
}

function savedLot(value: unknown): StockLot | null {
  const entry = record(value);
  if (!entry) return null;
  const ingredient = INGREDIENTS.find(({ id }) => id === entry.ingredient);
  const id = whole(entry.id);
  const quantity = whole(entry.quantity);
  const expiresOn = whole(entry.expiresOn);
  return ingredient && id && quantity && expiresOn ? { id, ingredient: ingredient.id, quantity, expiresOn } : null;
}

function savedReport(value: unknown, day: number): DayReport | null {
  const entry = record(value);
  if (!entry) return null;
  const reportDay = whole(entry.day);
  if (!reportDay || reportDay > day) return null;
  return {
    day: reportDay, revenue: whole(entry.revenue), tips: whole(entry.tips), served: whole(entry.served),
    quality: whole(entry.quality, 0, 100), missed: whole(entry.missed), expired: whole(entry.expired),
    rent: whole(entry.rent), rentOwed: whole(entry.rentOwed), wages: whole(entry.wages), branchIncome: whole(entry.branchIncome), contractBonus: whole(entry.contractBonus),
    managedSales: whole(entry.managedSales), managedOrders: whole(entry.managedOrders),
    managerSales: whole(entry.managerSales), managerOrders: whole(entry.managerOrders),
    reservationBonus: whole(entry.reservationBonus), cateringBonus: whole(entry.cateringBonus), publicityCost: whole(entry.publicityCost),
    standingOrders: whole(entry.standingOrders, 0, STANDING_ORDER_LIMIT), standingSpent: whole(entry.standingSpent),
    commissionReward: whole(entry.commissionReward),
    ...(typeof entry.commissionName === "string" && entry.commissionName.length <= 72 ? { commissionName: entry.commissionName } : {}),
    ...(SHOP_PAINTS.some(({ id }) => id === entry.unlockedPaint) ? { unlockedPaint: entry.unlockedPaint as ShopPaintId } : {}),
    ...(Number.isInteger(entry.newAward) && Number(entry.newAward) >= 1 && Number(entry.newAward) <= NEIGHBORHOOD_AWARDS.length
      ? { newAward: Number(entry.newAward) } : {}),
    promotion: typeof entry.promotion === "string" ? entry.promotion : null,
    level: Math.max(1, whole(entry.level, 1, LEVELS.length)),
    reason: typeof entry.reason === "string" ? entry.reason : null,
  };
}

export function normalizeCampaign(value: unknown, mode: CampaignMode): Campaign {
  const initial = newCampaign(mode);
  const saved = record(value);
  if (!saved || (saved.version !== 1 && saved.version !== 2) || saved.mode !== mode) return initial;

  const day = Math.max(1, whole(saved.day, 1));
  const status = saved.status === "open" || saved.status === "closed" ? saved.status : "planning";
  const ids = new Set<number>();
  const inventory = Array.isArray(saved.inventory) ? saved.inventory.flatMap((value) => {
    const lot = savedLot(value);
    if (!lot || lot.expiresOn <= day || ids.has(lot.id)) return [];
    ids.add(lot.id);
    return [lot];
  }) : [];
  const deliveries = Array.isArray(saved.deliveries) ? saved.deliveries.flatMap((value) => {
    const lot = savedLot(value);
    const entry = record(value);
    const supplier = SUPPLIERS.find(({ id }) => id === entry?.supplier);
    const arrivesOn = whole(entry?.arrivesOn);
    if (!lot || !supplier || !arrivesOn || lot.expiresOn <= Math.max(day, arrivesOn) || ids.has(lot.id)) return [];
    ids.add(lot.id);
    if (arrivesOn <= day) {
      inventory.push(lot);
      return [];
    }
    return [{ ...lot, supplier: supplier.id, arrivesOn }];
  }) : [];

  const savedPowers = record(saved.powerups);
  const powerups = blankPowerups();
  for (const { id } of POWERUPS) powerups[id] = whole(savedPowers?.[id]);
  const active = Array.isArray(saved.activePowerups) && status === "open" ? [...new Set(saved.activePowerups)] : [];
  const purchased = Array.isArray(saved.upgrades) ? [...new Set(saved.upgrades)] : [];
  const standingOrders = purchased.includes("supplier-ledger") ? normalizeStandingOrders(saved.standingOrders, day) : {};
  const paintUnlocked = [...new Set<ShopPaintId>(["clay", ...savedIds(SHOP_PAINTS, saved.paintUnlocked)])];
  const paint = paintUnlocked.find((id) => id === saved.paint) ?? "clay";
  const recipeRecords = normalizeRecipeRecords(saved.recipeRecords);
  const cupPrint = canUsePrint(saved.cupPrint, recipeRecords) ? saved.cupPrint : "house";
  let nextId = Math.max(1, whole(saved.nextId, initial.nextId));
  for (const id of ids) nextId = Math.max(nextId, id + 1);

  const oldNormal = mode === "normal" && saved.version === 1;
  const legacyUnlimitedStock = mode === "normal" && status === "open" && (oldNormal || saved.legacyUnlimitedStock === true);
  if (oldNormal && status === "planning") {
    inventory.push(...openingStock(mode, day, nextId));
    nextId += INGREDIENTS.length;
  }
  const crew = savedIds(CREW, saved.crew);
  const crewShifts: Campaign["crewShifts"] = {};
  const savedShifts = record(saved.crewShifts);
  for (const id of crew) {
    const shifts = whole(savedShifts?.[id], 0, CREW_CERTIFICATE_SHIFTS);
    if (shifts) crewShifts[id] = shifts;
  }
  const certifiedCrew = savedIds(CREW, saved.certifiedCrew).filter((id) => crewShifts[id] === CREW_CERTIFICATE_SHIFTS);
  const branches = [...new Set<BranchId>(["corner", ...savedIds(BRANCHES, saved.branches)])];
  const branchFittings = savedIds(BRANCHES, saved.branchFittings).filter((id) => branches.includes(id));
  const activeBranch = branches.find((id) => id === saved.activeBranch) ?? "corner";
  const managedBranch = status !== "closed" && crew.includes("runner")
    ? branches.find((id) => id !== activeBranch && id === saved.managedBranch) ?? null
    : null;
  const managerBranch = status !== "closed" && crew.includes("manager")
    ? branches.find((id) => id !== activeBranch && id !== managedBranch && id === saved.managerBranch) ?? null
    : null;
  const locationManagers: Campaign["locationManagers"] = {};
  const savedManagers = record(saved.locationManagers);
  for (const branch of branches) {
    const entry = record(savedManagers?.[branch]);
    if (!entry) continue;
    const shifts = whole(entry.shifts, 0, CREW_CERTIFICATE_SHIFTS);
    locationManagers[branch] = {
      scheduled: entry.scheduled === true && status !== "closed" && branch !== managedBranch && branch !== managerBranch,
      shifts, certified: entry.certified === true && shifts === CREW_CERTIFICATE_SHIFTS,
    };
  }
  const savedMenus = record(saved.managerMenus);
  const managerMenus: Campaign["managerMenus"] = {};
  for (const branch of branches) {
    const menu = managerMenuOptions({ day, certifiedCrew, locationManagers }, branch).find(({ id }) => id === savedMenus?.[branch]);
    if (menu && menu.id !== "classic") managerMenus[branch] = menu.id;
  }
  const activeCrew = savedIds(CREW, saved.activeCrew).filter((id): id is LiveCrewId => id !== "manager" && crew.includes(id) && (!managedBranch || id !== "runner"));
  const reputation = whole(saved.reputation, initial.reputation, 100);
  const runningEvent = status === "open" ? DAY_EVENTS.find(({ id }) => id === saved.currentEvent) : undefined;

  return {
    version: 2, mode, day, status, inventory, deliveries, powerups, nextId,
    legacyUnlimitedStock, crew, crewShifts, certifiedCrew, activeCrew, branches, branchFittings, activeBranch, managedBranch, managerBranch, locationManagers, managerMenus, standingOrders,
    publicity: status === "closed" ? null : publicityFor(saved.publicity)?.id ?? null,
    commission: status === "closed" ? null : normalizeCommission(saved.commission, day, mode === "expert"),
    paint, paintUnlocked, recipeRecords, cupPrint,
    cash: whole(saved.cash, initial.cash), xp: whole(saved.xp), reputation,
    highestReputation: Math.max(reputation, whole(saved.highestReputation, reputation, 100)),
    upgrades: purchased.filter((value): value is UpgradeId => UPGRADES.some(({ id }) => value === id)),
    activePowerups: active.filter((value): value is PowerupId => POWERUPS.some(({ id }) => value === id)),
    currentEvent: runningEvent?.id ?? eventForDay(day).id, lastDay: savedReport(saved.lastDay, day),
    regularVisits: visitCounts(saved.regularVisits), rentPaid: whole(saved.rentPaid), rentBook: normalizeRentBook(saved.rentBook),
  };
}

function savedIds<T extends string>(catalog: readonly { id: T }[], saved: unknown): T[] {
  return Array.isArray(saved) ? [...new Set(saved)].filter((value): value is T => catalog.some(({ id }) => id === value)) : [];
}

export function levelFor(campaign: Pick<Campaign, "xp">) {
  return Math.max(1, LEVELS.findLastIndex((required) => campaign.xp >= required) + 1);
}

export function levelProgress(campaign: Pick<Campaign, "xp">) {
  const level = levelFor(campaign);
  const base = LEVELS[level - 1];
  const next = LEVELS[level];
  return next === undefined ? null : { progress: campaign.xp - base, target: next - base };
}

export function branchRentCharge(mode: CampaignMode, baseRent: number) {
  return mode === "normal" ? Math.round(baseRent * 0.7) : baseRent;
}

export function rentDue(campaign: Pick<Campaign, "mode" | "rentPaid"> & Partial<Pick<Campaign, "branches" | "branchFittings">>) {
  const branchRent = BRANCHES.reduce((sum, branch) => sum + (campaign.branches?.includes(branch.id) ? branch.rent : 0), 0);
  const fittingRent = BRANCHES.reduce((sum, { id }) => (
    campaign.branches?.includes(id) && campaign.branchFittings?.includes(id) ? sum + BRANCH_FITTINGS[id].addedRent : sum
  ), 0);
  const escalation = Math.min(7, campaign.rentPaid);
  const shopRent = campaign.mode === "expert" ? 5200 + 400 * escalation : 3100 + 225 * escalation;
  return shopRent + branchRentCharge(campaign.mode, branchRent) + fittingRent;
}

export function daysUntilRent(campaign: Pick<Campaign, "mode" | "day">) {
  return (RENT_CYCLE_DAYS - campaign.day % RENT_CYCLE_DAYS) % RENT_CYCLE_DAYS;
}

export function stockCount(campaign: Campaign, id: IngredientId) {
  if (campaign.legacyUnlimitedStock) return Infinity;
  return campaign.inventory.reduce((count, lot) => lot.ingredient === id && lot.expiresOn > campaign.day ? count + lot.quantity : count, 0);
}

export function nextExpiry(campaign: Campaign, id: IngredientId) {
  if (campaign.legacyUnlimitedStock) return null;
  let earliest = Infinity;
  for (const lot of campaign.inventory) {
    if (lot.ingredient === id && lot.expiresOn > campaign.day) earliest = Math.min(earliest, lot.expiresOn);
  }
  return Number.isFinite(earliest) ? earliest : null;
}

function branchFor(id: BranchId | undefined) {
  return BRANCHES.find((branch) => branch.id === id) ?? BRANCHES[0];
}

export function crewWages(campaign: Pick<Campaign, "activeCrew" | "managedBranch" | "managerBranch"> &
  Partial<Pick<Campaign, "certifiedCrew" | "locationManagers" | "activeBranch">>) {
  const branchWages = BRANCHES.reduce((sum, { id }) => sum + (
    id !== campaign.activeBranch && id !== campaign.managedBranch && id !== campaign.managerBranch && campaign.locationManagers?.[id]?.scheduled
      ? managerWage(campaign.locationManagers[id].certified) : 0
  ), 0);
  return CREW.reduce((sum, worker) => {
    const working = worker.id === "manager"
      ? Boolean(campaign.managerBranch)
      : campaign.activeCrew.includes(worker.id) || (worker.id === "runner" && campaign.managedBranch);
    const premium = campaign.certifiedCrew?.includes(worker.id) ? worker.certificate.premium : 0;
    return sum + (working ? worker.wage + premium : 0);
  }, branchWages);
}

function publicityFor(id: unknown) {
  return PROMOTIONS_BOARD.find((promotion) => promotion.id === id);
}

export function neighborhoodAwardCount(highestReputation: number) {
  return NEIGHBORHOOD_AWARDS.filter(({ threshold }) => highestReputation >= threshold).length;
}

export function branchPurchasePrice(campaign: Pick<Campaign, "highestReputation">, branch: typeof BRANCHES[number]) {
  return campaign.highestReputation >= NEIGHBORHOOD_AWARDS[2].threshold
    ? Math.round(branch.price * NEIGHBORHOOD_AWARDS[2].branchPrice) : branch.price;
}

export function runnerHandoffSeconds(campaign: Pick<Campaign, "certifiedCrew">) {
  return campaign.certifiedCrew.includes("runner") ? RUNNER_HANDOFF_SECONDS / 2 : RUNNER_HANDOFF_SECONDS;
}

export function campaignEffects(campaign: Pick<Campaign, "currentEvent" | "upgrades"> & Partial<Pick<Campaign, "activeBranch" | "publicity" | "highestReputation">> & { activeCrew?: readonly CrewId[]; certifiedCrew?: readonly CrewId[]; branchFittings?: readonly BranchId[] }): CampaignEffects {
  const event = dayEvent(campaign.currentEvent);
  const installed = new Set(campaign.upgrades);
  const branch = branchFor(campaign.activeBranch);
  const fitting = campaign.branchFittings?.includes(branch.id) ? BRANCH_FITTINGS[branch.id] : undefined;
  const crew = new Set(campaign.activeCrew);
  const certified = new Set(campaign.certifiedCrew);
  const publicity = publicityFor(campaign.publicity);
  const awards = neighborhoodAwardCount(campaign.highestReputation ?? 0);
  const goodwill = awards >= 1 ? NEIGHBORHOOD_AWARDS[0].patience : 1;
  const recognition = awards >= 2 ? NEIGHBORHOOD_AWARDS[1].tips : 1;
  return {
    arrivalMultiplier: event.arrivalMultiplier * branch.arrivalMultiplier * (fitting?.arrivalMultiplier ?? 1) * (publicity?.arrivalMultiplier ?? 1) * (installed.has("street-sign") ? 1.15 : 1),
    patienceMultiplier: event.patienceMultiplier * branch.patienceMultiplier * (fitting?.patienceMultiplier ?? 1) * (publicity?.patienceMultiplier ?? 1) * (crew.has("host") ? 1.16 * (certified.has("host") ? 1.08 : 1) : 1) * (installed.has("cozy-seats") ? 1.15 : 1) * (installed.has("street-sign") ? 0.94 : 1) * goodwill,
    tipMultiplier: event.tipMultiplier * branch.tipMultiplier * (fitting?.tipMultiplier ?? 1) * (publicity?.tipMultiplier ?? 1) * (installed.has("tip-jar") ? 1.12 : 1) * recognition,
    fruitBonus: (event.fruitBonus ?? 0) + (publicity?.fruitBonus ?? 0) + (fitting?.fruitBonus ?? 0),
    prepMultiplier: (crew.has("prep") ? 0.75 : 1) * (installed.has("batch-timers") ? 0.88 : 1),
    prepHoldBonus: (installed.has("warm-shelf") ? 15 : 0) + (crew.has("prep") && certified.has("prep") ? 8 : 0),
    floatHoldBonus: installed.has("cold-tray") ? 12 : 0,
    ticketSlots: installed.has("ticket-rack") ? 4 : 3,
    autoSeal: installed.has("auto-sealer") && !event.sealerOffline,
    serveBonus: (crew.has("runner") ? 90 : 0) + (installed.has("pickup-counter") ? 60 : 0) + (fitting?.serveBonus ?? 0),
    qualityBonus: installed.has("better-recipe") ? 8 : 0,
    autoTea: installed.has("auto-tea"), autoMilk: installed.has("auto-milk"),
    autoToppings: installed.has("auto-toppings"), autoExtras: installed.has("auto-extras"),
    carafe: installed.has("tea-carafe"), batchPickup: installed.has("pickup-counter"),
  };
}

const success = (campaign: Campaign, message = ""): CampaignResult => ({ ok: true, campaign, message });
const failure = (campaign: Campaign, message: string): CampaignResult => ({ ok: false, campaign, message });

export function startDay(campaign: Campaign): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, campaign.status === "closed" ? "This shop has closed." : "The shop is already open.");
  if (campaign.cash < crewWages(campaign)) return failure(campaign, "Set aside enough cash for today’s crew wages or adjust the shift roster.");
  return success({ ...campaign, status: "open", activePowerups: [] }, "The shop is open.");
}

export function dayTakings(report: DayReport) {
  return report.revenue + report.tips + report.branchIncome + (report.contractBonus ?? 0) +
    (report.reservationBonus ?? 0) + (report.cateringBonus ?? 0) + (report.managedSales ?? 0) +
    (report.managerSales ?? 0) + (report.commissionReward ?? 0);
}

export function finishDay(campaign: Campaign, earnings: DayEarnings): CampaignResult {
  if (campaign.status !== "open") return failure(campaign, "Open the shop before settling the day.");
  const day = campaign.day + 1;
  const revenue = whole(earnings.revenue);
  const tips = whole(whole(earnings.tips) * campaignEffects(campaign).tipMultiplier);
  const served = whole(earnings.served);
  const missed = whole(earnings.missed);
  const quality = whole(earnings.quality, 0, 100);
  const guestCount = served + missed;
  const feedback = served ? Math.round((quality - 60) / 7) + Math.min(2, Math.floor(served / 3)) : 0;
  const walkouts = guestCount ? Math.round(4 * missed / guestCount) : 0;
  const reputation = whole(Math.max(0, campaign.reputation + Math.max(-6, feedback - walkouts)), 0, 100);
  const highestReputation = Math.max(campaign.highestReputation, reputation);
  const earnedAward = neighborhoodAwardCount(highestReputation);
  const newAward = earnedAward > neighborhoodAwardCount(campaign.highestReputation) ? earnedAward : 0;
  const xp = whole(campaign.xp + served * 9 + Math.round(served * quality / 10));
  const level = levelFor({ xp });
  const promotion = level > levelFor(campaign) ? PROMOTIONS[level - 1] : null;
  const rentOwed = !campaign.legacyUnlimitedStock && daysUntilRent(campaign) === 0 ? rentDue(campaign) : 0;
  const rentWaived = campaign.legacyUnlimitedStock && daysUntilRent(campaign) === 0;
  const wages = crewWages(campaign);
  const branchIncome = whole(served * branchFor(campaign.activeBranch).income);
  const contractBonus = whole(earnings.contractBonus);
  const reservationBonus = whole(earnings.reservationBonus);
  const cateringBonus = whole(earnings.cateringBonus);
  const managedSales = whole(earnings.managedSales);
  const managedOrders = whole(earnings.managedOrders);
  const managerSales = whole(earnings.managerSales);
  const managerOrders = whole(earnings.managerOrders);
  const worked = new Set<CrewId>(served ? campaign.activeCrew : []);
  if (campaign.managedBranch && managedOrders) worked.add("runner");
  if (campaign.managerBranch && (earnings.floatingManagerWorked ?? managerOrders > 0)) worked.add("manager");
  const crewShifts = { ...campaign.crewShifts };
  for (const id of campaign.crew) {
    if (worked.has(id)) crewShifts[id] = Math.min(CREW_CERTIFICATE_SHIFTS, (crewShifts[id] ?? 0) + 1);
  }
  const offer = campaign.commission ? commissionOffer(campaign.day, campaign.mode === "expert") : null;
  const committed = offer && campaign.commission ? advanceCommission(campaign.commission, offer, whole(earnings.commissionServed, 0, served)) : null;
  const commissionReward = committed?.reward ?? 0;
  const commissionPaint = commissionReward ? SHOP_PAINTS.find((entry) => entry.commission === offer?.kind)?.id : undefined;
  const unlockedPaint = commissionPaint && !campaign.paintUnlocked.includes(commissionPaint) ? commissionPaint : undefined;
  const proceeds = whole(campaign.cash + revenue + tips + branchIncome + contractBonus + reservationBonus + cateringBonus +
    managedSales + managerSales + commissionReward - wages);
  const closed = proceeds < rentOwed;
  const rent = closed ? 0 : rentOwed;
  const reason = closed ? "The shop closed because it could not pay rent." : null;
  const expired = closed ? 0 : campaign.inventory.reduce((count, lot) => lot.expiresOn <= day ? count + lot.quantity : count, 0);
  const visitsToday = Object.fromEntries(Object.entries(visitCounts(earnings.regularVisits)).map(([name, visits]) => {
    const previous = Object.hasOwn(campaign.regularVisits, name) ? campaign.regularVisits[name] : 0;
    return [name, whole(previous + visits)];
  }));
  const regularVisits = { ...campaign.regularVisits, ...visitsToday };
  const publicityCost = publicityFor(campaign.publicity)?.price ?? 0;
  const lastDay: DayReport = {
    standingOrders: 0, standingSpent: 0, day: campaign.day, revenue, tips, served, quality, missed, expired, rent, rentOwed, wages, branchIncome,
    contractBonus, reservationBonus, cateringBonus, managedSales, managedOrders, managerSales, managerOrders, publicityCost, promotion, level, reason, commissionReward,
    ...(commissionReward && offer ? { commissionName: offer.name } : {}),
    ...(unlockedPaint ? { unlockedPaint } : {}),
    ...(newAward ? { newAward } : {}),
  };
  const settled: Campaign = {
    ...campaign, cash: proceeds - rent, xp, lastDay, regularVisits, crewShifts, activePowerups: [], publicity: null,
    recipeRecords: mergeRecipeRecords(campaign.recipeRecords, earnings.recipeRecords ?? {}),
    rentBook: recordRentDay(campaign.rentBook, {
      day: campaign.day, cups: served + managedOrders + managerOrders, takings: dayTakings(lastDay), payroll: wages, expired, rent, reserve: proceeds - rent,
      outcome: closed ? "closed" : rent ? "paid" : rentWaived ? "waived" : "open",
    }, RENT_CYCLE_DAYS),
    commission: !closed && committed && day <= committed.progress.deadline ? committed.progress : null,
    paintUnlocked: unlockedPaint ? [...campaign.paintUnlocked, unlockedPaint] : campaign.paintUnlocked,
    reputation, highestReputation,
    rentPaid: campaign.rentPaid + (rent > 0 ? 1 : 0),
  };
  if (closed) return success({ ...settled, status: "closed", managedBranch: null, managerBranch: null,
    locationManagers: Object.fromEntries(Object.entries(campaign.locationManagers).map(([id, manager]) => [id, { ...manager, scheduled: false }])),
  }, reason ?? "The shop has closed.");

  const inventory = campaign.inventory.filter((lot) => lot.expiresOn > day);
  const deliveries: Delivery[] = [];
  for (const delivery of campaign.deliveries) {
    if (delivery.arrivesOn > day) deliveries.push(delivery);
    else {
      const { id, ingredient, quantity, expiresOn } = delivery;
      if (expiresOn > day) inventory.push({ id, ingredient, quantity, expiresOn });
    }
  }
  if (campaign.legacyUnlimitedStock) inventory.push(...openingStock(campaign.mode, day, settled.nextId));
  const nextId = settled.nextId + (campaign.legacyUnlimitedStock ? INGREDIENTS.length : 0);
  const planning: Campaign = { ...settled, day, status: "planning", currentEvent: eventForDay(day).id, inventory, deliveries, nextId, legacyUnlimitedStock: false };
  return success(placeStandingOrders(planning, lastDay), rent ? "Day closed. Rent paid." : "Day closed. The next day is ready.");
}

export function takeCommission(campaign: Campaign): CampaignResult {
  if (campaign.status !== "planning" || campaign.commission) return failure(campaign, "A commission can be taken before your next shift.");
  const offer = commissionOffer(campaign.day, campaign.mode === "expert");
  if (!offer) return failure(campaign, "The neighborhood board opens on day 4.");
  return success({ ...campaign, commission: { id: offer.id, deadline: offer.deadline, count: 0 } }, "Pinned " + offer.name + " to the board.");
}

export function paintShop(campaign: Campaign, paint: ShopPaintId): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Choose a new paint before opening the shop.");
  if (!campaign.paintUnlocked.includes(paint)) return failure(campaign, "Complete the matching commission to unlock that paint.");
  return success({ ...campaign, paint });
}

export function setCupPrint(campaign: Campaign, print: CupPrintId): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Pick a cup print before opening the shop.");
  if (!canUsePrint(print, campaign.recipeRecords)) return failure(campaign, "Finish more signature recipes to unlock that print.");
  const name = CUP_PRINTS.find(({ id }) => id === print)?.name;
  return success({ ...campaign, cupPrint: print }, (name ?? "Cup print") + " is on the cups.");
}

export function buyPublicity(campaign: Campaign, id: PublicityId): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Book a promotion before opening the shop.");
  const publicity = publicityFor(id);
  if (!publicity) return failure(campaign, "That promotion is unavailable.");
  if (campaign.publicity) return failure(campaign, "A promotion is already booked for this shift.");
  if (levelFor(campaign) < publicity.level) return failure(campaign, `${publicity.name} unlocks at level ${publicity.level}.`);
  if (campaign.cash < publicity.price) return failure(campaign, "There is not enough cash to book that promotion.");
  return success({ ...campaign, cash: campaign.cash - publicity.price, publicity: publicity.id }, `${publicity.name} booked for this shift.`);
}

export function hireCrew(campaign: Campaign, id: CrewId): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Hire crew before opening the shop.");
  const worker = CREW.find((entry) => entry.id === id);
  if (!worker) return failure(campaign, "That role is unavailable.");
  if (campaign.crew.includes(id)) return failure(campaign, "This role is already filled.");
  if (levelFor(campaign) < worker.level) return failure(campaign, `${worker.name} unlocks at level ${worker.level}.`);
  if (campaign.cash < worker.price) return failure(campaign, "There is not enough cash to hire for this role.");
  const assignment = id === "manager" ? "Assign them an inactive branch." : "Put them on duty for your next shift.";
  return success({ ...campaign, cash: campaign.cash - worker.price, crew: [...campaign.crew, id] }, `${worker.name} hired. ${assignment}`);
}

export function certifyCrew(campaign: Campaign, id: CrewId): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Book crew training before opening the shop.");
  const worker = CREW.find((entry) => entry.id === id);
  if (!worker || !campaign.crew.includes(id)) return failure(campaign, "Hire this role before booking training.");
  if (campaign.certifiedCrew.includes(id)) return failure(campaign, "This role is already certified.");
  if ((campaign.crewShifts[id] ?? 0) < CREW_CERTIFICATE_SHIFTS) {
    return failure(campaign, "This worker needs two completed shifts with sales before training.");
  }
  if (campaign.cash < worker.certificate.price) return failure(campaign, "There is not enough cash for crew training.");
  return success({
    ...campaign, cash: campaign.cash - worker.certificate.price, certifiedCrew: [...campaign.certifiedCrew, id],
  }, `${worker.certificate.name} earned.`);
}

export function setCrewActive(campaign: Campaign, id: CrewId, active: boolean): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Set the crew roster before opening the shop.");
  if (!campaign.crew.includes(id)) return failure(campaign, "Hire this role before putting them on duty.");
  if (id === "manager") return failure(campaign, "Assign the Branch Manager an inactive branch.");
  const activeCrew = campaign.activeCrew.filter((worker) => worker !== id);
  if (active) activeCrew.push(id);
  const managedBranch = id === "runner" && active ? null : campaign.managedBranch;
  return success({ ...campaign, activeCrew, managedBranch });
}

export function setManagedBranch(campaign: Campaign, id: BranchId | null): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Assign your Order Runner before opening the shop.");
  if (id === null) return success({ ...campaign, managedBranch: null });
  if (!campaign.crew.includes("runner")) return failure(campaign, "Hire the Order Runner before assigning a side stand.");
  if (!campaign.branches.includes(id) || id === campaign.activeBranch) return failure(campaign, "Choose an owned branch apart from your main shift.");
  if (managerOnDuty(campaign, id)) return failure(campaign, "A manager is already assigned there.");
  return success({ ...campaign, managedBranch: id, activeCrew: campaign.activeCrew.filter((worker) => worker !== "runner") });
}

export const MANAGED_SALE_PRICE = 310;
export const MANAGED_ORDER_CAP = 4;

export function managedOrderInterval(mode: CampaignMode, trained = false) {
  return (mode === "normal" ? 24 : 26) - (trained ? 3 : 0);
}

/** Apply the side stand's stock use to the campaign once, immediately before closing the shift. */
export function settleManagedBranch(campaign: Campaign, elapsed: number) {
  const id = campaign.managedBranch;
  const empty = { campaign, orders: 0, sales: 0 };
  if (campaign.status !== "open" || campaign.legacyUnlimitedStock || !Number.isFinite(elapsed) ||
      !id || id === campaign.activeBranch || !campaign.branches.includes(id) || !campaign.crew.includes("runner")) return empty;

  const orders = Math.min(
    MANAGED_ORDER_CAP,
    Math.floor(elapsed / managedOrderInterval(campaign.mode, campaign.certifiedCrew.includes("runner"))),
    stockCount(campaign, "black"),
    stockCount(campaign, "milk"),
  );
  if (orders <= 0) return empty;
  const used = consumeIngredients(campaign, { black: orders, milk: orders });
  return used.ok ? { campaign: used.campaign, orders, sales: orders * MANAGED_SALE_PRICE } : empty;
}

export function setManagerBranch(campaign: Campaign, id: BranchId | null): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Assign your Branch Manager before opening the shop.");
  if (id === null) return success({ ...campaign, managerBranch: null });
  if (!campaign.crew.includes("manager")) return failure(campaign, "Hire the Branch Manager before assigning a branch.");
  if (!campaign.branches.includes(id) || id === campaign.activeBranch) return failure(campaign, "Choose an owned branch apart from your main shift.");
  if (id === campaign.managedBranch) return failure(campaign, "The Order Runner is already assigned there.");
  if (campaign.locationManagers[id]) return failure(campaign, "This shop already has its own manager.");
  return success({ ...campaign, managerBranch: id });
}

export const BRANCH_MANAGER = CREW.find(({ id }) => id === "manager")!;

export function managerWage(certified: boolean) {
  return BRANCH_MANAGER.wage + (certified ? BRANCH_MANAGER.certificate.premium : 0);
}

export function managerOnDuty(campaign: Campaign, branch: BranchId) {
  return campaign.status !== "closed" && branch !== campaign.activeBranch && branch !== campaign.managedBranch &&
    (campaign.managerBranch === branch || campaign.locationManagers[branch]?.scheduled === true);
}

export function managerBranches(campaign: Campaign) {
  // Keep the original manager first, then serve from the other shops in purchase order.
  return campaign.branches.filter((branch) => managerOnDuty(campaign, branch))
    .sort((a, b) => Number(b === campaign.managerBranch) - Number(a === campaign.managerBranch));
}

export function hireLocationManager(campaign: Campaign, branch: BranchId): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Hire managers before opening the shop.");
  if (!campaign.branches.includes(branch) || branch === campaign.activeBranch) return failure(campaign, "Choose another owned shop.");
  if (campaign.locationManagers[branch] || campaign.managerBranch === branch) return failure(campaign, "This shop already has a manager.");
  if (levelFor(campaign) < BRANCH_MANAGER.level) return failure(campaign, `Managers unlock at level ${BRANCH_MANAGER.level}.`);
  if (campaign.cash < BRANCH_MANAGER.price) return failure(campaign, "There is not enough cash to hire a manager.");
  return success({
    ...campaign, cash: campaign.cash - BRANCH_MANAGER.price,
    managedBranch: campaign.managedBranch === branch ? null : campaign.managedBranch,
    locationManagers: { ...campaign.locationManagers, [branch]: { scheduled: true, shifts: 0, certified: false } },
  }, `Manager hired at ${branchFor(branch).name}.`);
}

export function scheduleLocationManager(campaign: Campaign, branch: BranchId, scheduled: boolean): CampaignResult {
  const manager = campaign.locationManagers[branch];
  if (campaign.status !== "planning" || !manager || branch === campaign.activeBranch) return failure(campaign, "Set the manager’s schedule before opening the shop.");
  return success({
    ...campaign,
    managedBranch: scheduled && campaign.managedBranch === branch ? null : campaign.managedBranch,
    locationManagers: { ...campaign.locationManagers, [branch]: { ...manager, scheduled } },
  });
}

export function certifyLocationManager(campaign: Campaign, branch: BranchId): CampaignResult {
  const manager = campaign.locationManagers[branch];
  const course = BRANCH_MANAGER.certificate;
  if (campaign.status !== "planning" || !manager || manager.certified) return failure(campaign, "Choose an eligible manager before opening the shop.");
  if (manager.shifts < CREW_CERTIFICATE_SHIFTS) return failure(campaign, "This manager needs two shifts with sales before training.");
  if (campaign.cash < course.price) return failure(campaign, "There is not enough cash for crew training.");
  return success({
    ...campaign, cash: campaign.cash - course.price,
    locationManagers: { ...campaign.locationManagers, [branch]: { ...manager, certified: true } },
  }, `${course.name} earned at ${branchFor(branch).name}.`);
}

export function managerTrained(campaign: Pick<Campaign, "certifiedCrew" | "locationManagers">, branch: BranchId) {
  return campaign.locationManagers[branch]?.certified ?? campaign.certifiedCrew.includes("manager");
}

const MANAGER_MENUS: Record<BranchId, { name: string; tea: IngredientId; milk: IngredientId | null; price: number }> = {
  corner: { name: "Corner Milk Tea", tea: "black", milk: "milk", price: 430 },
  campus: { name: "Jasmine Study Break", tea: "jasmine", milk: null, price: 410 },
  garden: { name: "Garden Oat Jasmine", tea: "jasmine", milk: "oat", price: 460 },
  night: { name: "Midnight Taro", tea: "taro", milk: "milk", price: 470 },
  station: { name: "Platform Black Tea", tea: "black", milk: null, price: 420 },
  harbor: { name: "Ferry Deck Jasmine", tea: "jasmine", milk: "oat", price: 490 },
  loft: { name: "Skyline Jasmine", tea: "jasmine", milk: null, price: 535 },
};

export function managerMenu(id: BranchId) {
  return MANAGER_MENUS[id];
}

export interface ManagerMenuOption {
  id: ManagerMenuId;
  name: string;
  portions: IngredientPortions;
  price: number;
  icon: IngredientId;
}

const MANAGER_FRUIT: Record<BranchId, { ingredient: IngredientId; name: string }> = {
  corner: { ingredient: "strawberry", name: "Corner Strawberry Tea" },
  campus: { ingredient: "banana", name: "Banana Study Break" },
  garden: { ingredient: "strawberry", name: "Glasshouse Strawberry Jasmine" },
  night: { ingredient: "mango", name: "Midnight Mango Taro" },
  station: { ingredient: "banana", name: "Platform Banana Tea" },
  harbor: { ingredient: "mango", name: "Ferry Deck Mango Jasmine" },
  loft: { ingredient: "yuzu", name: "Skyline Yuzu Jasmine" },
};

export function managerMenuOptions(campaign: Pick<Campaign, "day" | "certifiedCrew" | "locationManagers">, branch: BranchId): ManagerMenuOption[] {
  const classic = managerMenu(branch);
  const portions: IngredientPortions = { [classic.tea]: 1 };
  if (classic.milk) portions[classic.milk] = 1;
  const options: ManagerMenuOption[] = [{ id: "classic", name: classic.name, portions, price: classic.price, icon: classic.tea }];
  if (!managerTrained(campaign, branch)) return options;

  const fruit = MANAGER_FRUIT[branch];
  const milk = classic.milk ?? "milk";
  const specials: ManagerMenuOption[] = [
    { id: "fruit", name: fruit.name, portions: { [classic.tea]: 1, [fruit.ingredient]: 1 }, price: classic.price + 115, icon: fruit.ingredient },
    { id: "dessert", name: `${classic.name} with Pudding`, portions: { [classic.tea]: 1, [milk]: 1, pudding: 1 }, price: classic.price + 160, icon: "pudding" },
  ];
  return [...options, ...specials.filter(({ portions }) => INGREDIENTS.every(({ id }) =>
    !portions[id] || INGREDIENT_UNLOCK_DAYS[id] <= campaign.day))];
}

export function selectedManagerMenu(campaign: Pick<Campaign, "day" | "certifiedCrew" | "locationManagers" | "managerMenus">, branch: BranchId): ManagerMenuOption {
  const options = managerMenuOptions(campaign, branch);
  return options.find(({ id }) => id === campaign.managerMenus[branch]) ?? options[0];
}

export function setManagerMenu(campaign: Campaign, branch: BranchId, menu: ManagerMenuId): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Choose the branch menu before opening the shop.");
  if (!managerOnDuty(campaign, branch)) return failure(campaign, "Choose a shop with a manager on duty.");
  if (!managerTrained(campaign, branch)) return failure(campaign, "Certify this manager to change the menu.");
  const option = managerMenuOptions(campaign, branch).find(({ id }) => id === menu);
  if (!option) return failure(campaign, "This branch menu needs ingredients you have not unlocked.");
  const managerMenus = { ...campaign.managerMenus };
  if (menu === "classic") delete managerMenus[branch];
  else managerMenus[branch] = menu;
  return success({ ...campaign, managerMenus }, `${option.name} selected for the branch.`);
}

export const MANAGER_ORDER_CAP = 4;

export function managerOrderCap(trained = false) {
  return MANAGER_ORDER_CAP + (trained ? 1 : 0);
}

export function managerOrderInterval(mode: CampaignMode, trained = false) {
  if (trained) return mode === "normal" ? 19 : 20;
  return mode === "normal" ? 21 : 23;
}

export function managerSupplyCapacity(campaign: Campaign, branch: BranchId) {
  const { portions } = selectedManagerMenu(campaign, branch);
  const ingredients = INGREDIENTS.filter(({ id }) => (portions[id] ?? 0) > 0);
  if (ingredients.some(({ id }) => campaign.day < INGREDIENT_UNLOCK_DAYS[id])) return 0;
  return Math.min(
    managerOrderCap(managerTrained(campaign, branch)),
    ...ingredients.map(({ id }) => Math.floor(stockCount(campaign, id) / (portions[id] ?? 1))),
  );
}

function allocateManagerOrders(campaign: Campaign, elapsed: number) {
  let remaining = campaign;
  const branches = managerBranches(campaign).map((branch) => {
    const menu = selectedManagerMenu(campaign, branch);
    const trained = managerTrained(campaign, branch);
    const orders = Math.min(managerSupplyCapacity(remaining, branch), Math.floor(elapsed / managerOrderInterval(campaign.mode, trained)));
    if (orders > 0) {
      const usage = Object.fromEntries(Object.entries(menu.portions).map(([ingredient, quantity]) => [ingredient, quantity * orders]));
      remaining = consumeIngredients(remaining, usage).campaign;
    }
    return { branch, menu, orders, max: managerOrderCap(trained) };
  });
  return { campaign: remaining, branches };
}

export function managerPantryForecast(campaign: Campaign) {
  if (campaign.status === "closed" || campaign.legacyUnlimitedStock) return [];
  const runner = settleManagedBranch({ ...campaign, status: "open" }, 120);
  return allocateManagerOrders(runner.campaign, Infinity).branches;
}

/** Managers use whatever the main shop and runner have left at the end of the shift. */
export function settleManagerBranch(campaign: Campaign, elapsed: number) {
  if (campaign.status !== "open" || campaign.legacyUnlimitedStock || !Number.isFinite(elapsed)) {
    return { campaign, orders: 0, sales: 0, floatingManagerWorked: false };
  }
  const allocation = allocateManagerOrders(campaign, Math.max(0, elapsed));
  const locationManagers = { ...allocation.campaign.locationManagers };
  let orders = 0;
  let sales = 0;
  let floatingManagerWorked = false;
  for (const { branch, menu, orders: count } of allocation.branches) {
    orders += count;
    sales += count * menu.price;
    if (!count) continue;
    const manager = locationManagers[branch];
    if (manager) locationManagers[branch] = { ...manager, shifts: Math.min(CREW_CERTIFICATE_SHIFTS, manager.shifts + 1) };
    else floatingManagerWorked = true;
  }
  return { campaign: { ...allocation.campaign, locationManagers }, orders, sales, floatingManagerWorked };
}

export function buyBranch(campaign: Campaign, id: BranchId): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Buy branches before opening the shop.");
  const branch = BRANCHES.find((entry) => entry.id === id);
  if (!branch) return failure(campaign, "That branch is unavailable.");
  if (campaign.branches.includes(id)) return failure(campaign, "You already own this branch.");
  if (levelFor(campaign) < branch.level) return failure(campaign, `${branch.name} unlocks at level ${branch.level}.`);
  const price = branchPurchasePrice(campaign, branch);
  if (campaign.cash < price) return failure(campaign, "There is not enough cash for that branch.");
  return success({ ...campaign, cash: campaign.cash - price, branches: [...campaign.branches, id], activeBranch: id }, `${branch.name} purchased and selected for the next shift.`);
}

export function fitBranch(campaign: Campaign, id: BranchId): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Renovate the branch before opening the shop.");
  if (!campaign.branches.includes(id)) return failure(campaign, "Buy this branch before renovating it.");
  if (campaign.branchFittings.includes(id)) return failure(campaign, "This renovation is already installed.");
  const fitting = BRANCH_FITTINGS[id];
  if (levelFor(campaign) < fitting.level) return failure(campaign, `${fitting.name} unlocks at level ${fitting.level}.`);
  if (campaign.cash < fitting.price) return failure(campaign, "There is not enough cash for this renovation.");
  return success({
    ...campaign, cash: campaign.cash - fitting.price, branchFittings: [...campaign.branchFittings, id],
  }, `${fitting.name} installed.`);
}

export function selectBranch(campaign: Campaign, id: BranchId): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Select your branch before opening the shop.");
  if (!campaign.branches.includes(id)) return failure(campaign, "Buy this branch before opening it.");
  if (campaign.managedBranch === id) {
    return success({ ...campaign, activeBranch: id, managedBranch: null, activeCrew: [...new Set<LiveCrewId>([...campaign.activeCrew, "runner"])] });
  }
  return success({ ...campaign, activeBranch: id, managerBranch: campaign.managerBranch === id ? null : campaign.managerBranch });
}

export function supplierPrice(campaign: Pick<Campaign, "currentEvent">, ingredient: IngredientId, supplier: typeof SUPPLIERS[number]) {
  const fruit = FRUIT_INGREDIENTS.some((id) => id === ingredient);
  if (ingredient === "seltzer" && campaign.currentEvent === "bottle-return" && supplier.id === "market") return Math.round(supplier.price * 0.75);
  if (fruit && campaign.currentEvent === "market-day" && supplier.id === "market") return Math.round(supplier.price * 0.75);
  if (fruit && campaign.currentEvent === "fruit-special" && supplier.id === "cooperative") return Math.round(supplier.price * 0.85);
  return supplier.price;
}

export function buyStock(campaign: Campaign, ingredientId: IngredientId, supplierId: SupplierId, batches = 1): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Order stock during setup, before opening the shop.");
  const ingredient = INGREDIENTS.find(({ id }) => id === ingredientId);
  const supplier = SUPPLIERS.find(({ id }) => id === supplierId);
  if (!ingredient || !supplier || !Number.isSafeInteger(batches) || batches < 1) return failure(campaign, "Choose an ingredient, a supplier, and a whole number of batches.");
  const cost = supplierPrice(campaign, ingredientId, supplier) * batches;
  if (cost > campaign.cash) return failure(campaign, "There is not enough cash for that stock order.");

  const arrivesOn = campaign.day + supplier.leadDays;
  const lot = {
    id: campaign.nextId, ingredient: ingredient.id, quantity: supplier.batchSize * batches,
    expiresOn: arrivesOn + deliveryShelfLife(campaign, ingredient.shelfLife, supplier.shelfLifeBonus),
  };
  const paid = { ...campaign, cash: campaign.cash - cost, nextId: campaign.nextId + 1 };
  if (!supplier.leadDays) return success({ ...paid, inventory: [...campaign.inventory, lot] }, `${ingredient.name} added to stock.`);
  return success({ ...paid, deliveries: [...campaign.deliveries, { ...lot, supplier: supplier.id, arrivesOn }] }, `${ingredient.name} will arrive on day ${arrivesOn}.`);
}

function normalizeStandingOrders(value: unknown, day: number): StandingOrders {
  const saved = record(value);
  const entries = INGREDIENTS.flatMap(({ id }) => {
    if (INGREDIENT_UNLOCK_DAYS[id] > day) return [];
    const supplier = SUPPLIERS.find((entry) => entry.id === saved?.[id]);
    return supplier ? [[id, supplier.id] as const] : [];
  });
  return Object.fromEntries(entries.slice(0, STANDING_ORDER_LIMIT));
}

export function setStandingOrder(campaign: Campaign, ingredientId: IngredientId, supplierId: SupplierId | null): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Set standing orders before opening the shop.");
  if (!campaign.upgrades.includes("supplier-ledger")) return failure(campaign, "Install the Supplier Ledger first.");
  const ingredient = INGREDIENTS.find(({ id }) => id === ingredientId);
  if (!ingredient || INGREDIENT_UNLOCK_DAYS[ingredientId] > campaign.day) return failure(campaign, "Choose an unlocked ingredient.");
  const standingOrders = { ...campaign.standingOrders };
  if (supplierId === null) {
    delete standingOrders[ingredientId];
    return success({ ...campaign, standingOrders });
  }
  if (!SUPPLIERS.some(({ id }) => id === supplierId)) return failure(campaign, "Choose an available supplier.");
  if (!standingOrders[ingredientId] && Object.keys(standingOrders).length >= STANDING_ORDER_LIMIT) {
    return failure(campaign, "Clear a standing order before adding another.");
  }
  standingOrders[ingredientId] = supplierId;
  return success({ ...campaign, standingOrders });
}

function placeStandingOrders(planning: Campaign, lastDay: DayReport): Campaign {
  if (!planning.upgrades.includes("supplier-ledger") || !planning.standingOrders) return planning;
  const reserve = crewWages(planning) + (daysUntilRent(planning) <= 1 ? rentDue(planning) : 0);
  let campaign = planning;
  let orders = 0;

  for (const { id } of INGREDIENTS) {
    const supplier = SUPPLIERS.find((entry) => entry.id === campaign.standingOrders?.[id]);
    if (!supplier || INGREDIENT_UNLOCK_DAYS[id] > campaign.day) continue;
    if (campaign.cash - supplierPrice(campaign, id, supplier) < reserve || stockCount(campaign, id) >= STANDING_ORDER_THRESHOLD) continue;
    if (campaign.deliveries.some((delivery) => delivery.ingredient === id)) continue;
    const bought = buyStock(campaign, id, supplier.id);
    if (bought.ok) {
      campaign = bought.campaign;
      orders += 1;
    }
  }
  return { ...campaign, lastDay: { ...lastDay, standingOrders: orders, standingSpent: planning.cash - campaign.cash } };
}

export function consumeIngredients(campaign: Campaign, portions: IngredientPortions): CampaignResult {
  if (campaign.status !== "open") return failure(campaign, "Open the shop before using ingredients.");
  if (campaign.legacyUnlimitedStock) return success(campaign);

  const needed = new Map<IngredientId, number>();
  for (const [key, amount] of Object.entries(portions)) {
    const ingredient = INGREDIENTS.find(({ id }) => id === key);
    if (!ingredient || !Number.isSafeInteger(amount) || amount < 0) return failure(campaign, "Ingredient portions must be whole numbers.");
    if (amount > stockCount(campaign, ingredient.id)) return failure(campaign, `${ingredient.name} is out of stock for this order.`);
    if (amount > 0) needed.set(ingredient.id, amount);
  }
  if (!needed.size) return success(campaign);

  const inventory = campaign.inventory.toSorted((first, second) => first.expiresOn - second.expiresOn || first.id - second.id).flatMap((lot) => {
    const remaining = needed.get(lot.ingredient) ?? 0;
    if (!remaining || lot.expiresOn <= campaign.day) return [lot];
    const used = Math.min(remaining, lot.quantity);
    needed.set(lot.ingredient, remaining - used);
    return used < lot.quantity ? [{ ...lot, quantity: lot.quantity - used }] : [];
  });
  return success({ ...campaign, inventory });
}

export function buyUpgrade(campaign: Campaign, id: string): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Buy upgrades during setup, before opening the shop.");
  const upgrade = UPGRADES.find((entry) => entry.id === id);
  if (!upgrade) return failure(campaign, "That upgrade is unavailable.");
  if (campaign.upgrades.includes(id)) return failure(campaign, "This upgrade is already installed.");
  if (levelFor(campaign) < upgrade.level) return failure(campaign, `${upgrade.name} unlocks at level ${upgrade.level}.`);
  if (campaign.cash < upgrade.price) return failure(campaign, "There is not enough cash for that upgrade.");
  return success({ ...campaign, cash: campaign.cash - upgrade.price, upgrades: [...campaign.upgrades, id] }, `${upgrade.name} installed.`);
}

export function buyPowerup(campaign: Campaign, id: PowerupId): CampaignResult {
  if (campaign.status !== "planning") return failure(campaign, "Buy powerups during setup, before opening the shop.");
  const powerup = POWERUPS.find((entry) => entry.id === id);
  if (!powerup) return failure(campaign, "That powerup is unavailable.");
  if (levelFor(campaign) < powerup.level) return failure(campaign, `${powerup.name} unlocks at level ${powerup.level}.`);
  if (campaign.cash < powerup.price) return failure(campaign, "There is not enough cash for that powerup.");
  const powerups = { ...campaign.powerups, [id]: campaign.powerups[id] + 1 };
  return success({ ...campaign, powerups, cash: campaign.cash - powerup.price }, `${powerup.name} added to your supplies.`);
}

function emergencyDelivery(campaign: Campaign): StockLot[] {
  const lots: StockLot[] = [];
  for (const { id } of INGREDIENTS) {
    if (INGREDIENT_UNLOCK_DAYS[id] > campaign.day) continue;
    const quantity = 4 - stockCount(campaign, id);
    if (quantity > 0) lots.push({
      id: campaign.nextId + lots.length, ingredient: id, quantity, expiresOn: campaign.day + 1,
    });
  }
  return lots;
}

export function campaignPowerupBlockReason(campaign: Campaign, id: PowerupId): string {
  if (campaign.status !== "open") return "Use powerups while the shop is open.";
  const powerup = POWERUPS.find((entry) => entry.id === id);
  if (!powerup || !campaign.powerups[id]) return "That powerup is out of stock.";
  if (id === "supplies" && !emergencyDelivery(campaign).length) return "Every unlocked ingredient has at least four portions.";
  return "";
}

export function usePowerup(campaign: Campaign, id: PowerupId): CampaignResult {
  const block = campaignPowerupBlockReason(campaign, id);
  if (block) return failure(campaign, block);
  const powerup = POWERUPS.find((entry) => entry.id === id);
  if (!powerup) return failure(campaign, "That powerup is unavailable.");
  const powerups = { ...campaign.powerups, [id]: campaign.powerups[id] - 1 };
  const activePowerups = campaign.activePowerups.includes(id) ? campaign.activePowerups : [...campaign.activePowerups, id];
  if (id === "supplies") {
    const lots = emergencyDelivery(campaign);
    const inventory = [...campaign.inventory, ...lots];
    return success({ ...campaign, powerups, activePowerups, inventory, nextId: campaign.nextId + lots.length },
      `Emergency Run restocked ${lots.length} ingredient${lots.length === 1 ? "" : "s"} for today's shift.`);
  }
  return success({ ...campaign, powerups, activePowerups }, `${powerup.name} used.`);
}
