// Existing 6f86974 economy catalogue, preserved without retuning.
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
  {
    id: "market",
    name: "Corner Market",
    description: "Small orders for immediate pickup.",
    price: 240,
    batchSize: 4,
    leadDays: 0,
    shelfLifeBonus: 0,
  },
  {
    id: "wholesaler",
    name: "Night Freight",
    description: "The lowest cost per portion, delivered tomorrow.",
    price: 560,
    batchSize: 16,
    leadDays: 1,
    shelfLifeBonus: 0,
  },
  {
    id: "cooperative",
    name: "Orchard Co-op",
    description: "Two extra days of shelf life, delivered in two days.",
    price: 620,
    batchSize: 10,
    leadDays: 2,
    shelfLifeBonus: 2,
  },
] as const;

export const UPGRADES = [
  {
    id: "cozy-seats",
    name: "Window Bench",
    description: "Guests give you 15% longer to make their orders.",
    price: 2400,
    level: 2,
  },
  {
    id: "auto-tea",
    name: "Tea Dispenser",
    description: "Selects the ordered tea and stops it brewing at the right time.",
    price: 3500,
    level: 2,
  },
  { id: "auto-milk", name: "Portion Pump", description: "Automatically adds the ordered milk.", price: 4200, level: 3 },
  {
    id: "better-recipe",
    name: "Recipe Notes",
    description: "Adds up to eight quality points per completed order.",
    price: 3200,
    level: 3,
  },
  {
    id: "auto-toppings",
    name: "Topping Carousel",
    description: "Adds available toppings as soon as a cup reaches Build.",
    price: 3800,
    level: 3,
  },
  {
    id: "street-sign",
    name: "Sidewalk Sign",
    description: "Guests arrive 15% more often and wait 6% less.",
    price: 3900,
    level: 4,
  },
  {
    id: "batch-timers",
    name: "Batch Timers",
    description: "Kitchen batches take 12% less time.",
    price: 2850,
    level: 2,
  },
  {
    id: "warm-shelf",
    name: "Warm Shelf",
    description: "Pearls, buns, and waffles stay fresh for 15 more seconds after cooking.",
    price: 3300,
    level: 3,
  },
  {
    id: "supplier-ledger",
    name: "Supplier Ledger",
    description:
      "Set up to four ingredients to reorder from their selected suppliers when fewer than four portions remain.",
    price: 3150,
    level: 3,
  },
  {
    id: "menu-easel",
    name: "Menu Easel",
    description: "Put a house tea on the menu. Guests will occasionally order it.",
    price: 3200,
    level: 3,
  },
  {
    id: "wall-calendar",
    name: "Wall Calendar",
    description: "See the next three days of events, deliveries, and rent at a glance.",
    price: 2150,
    level: 3,
  },
  {
    id: "takeout-rack",
    name: "Takeout Rack",
    description: "Book three-cup pickup orders from day 12.",
    price: 4450,
    level: 5,
  },
  {
    id: "opening-key",
    name: "Opening Key",
    description: "Cook a batch before guests arrive and the shift clock starts.",
    price: 2750,
    level: 4,
  },
  { id: "tip-jar", name: "Counter Tip Jar", description: "Guests leave 12% more in tips.", price: 3800, level: 3 },
  {
    id: "cold-storage",
    name: "Cold Storage",
    description: "New stock deliveries stay fresh for two extra days.",
    price: 4800,
    level: 4,
  },
  {
    id: "cold-tray",
    name: "Cold Tray",
    description: "Scoops stay cold for another twelve seconds at the pass.",
    price: 4200,
    level: 5,
  },
  {
    id: "tea-carafe",
    name: "Tea Carafe",
    description: "Brew two portions at once. Save one for the next guest who orders that tea.",
    price: 4400,
    level: 4,
  },
  {
    id: "pickup-counter",
    name: "Pickup Counter",
    description: "Hand out sealed drinks together. Adds 60¢ to each sale.",
    price: 6400,
    level: 5,
  },
  {
    id: "auto-extras",
    name: "Prep Cart",
    description: "Adds fruit, syrup, ready sides, and ice as a cup reaches Build.",
    price: 4800,
    level: 4,
  },
  {
    id: "ticket-rack",
    name: "Wide Ticket Rack",
    description: "Keep four tickets open across the counters.",
    price: 5400,
    level: 6,
  },
  {
    id: "auto-sealer",
    name: "Automatic Sealer",
    description: "Seals a finished drink when it matches the ticket.",
    price: 7200,
    level: 8,
  },
] as const;

export const POWERUPS = [
  {
    id: "rush",
    name: "Prep Sprint",
    description: "Instantly finishes every tea and batch in progress, or the next one you start.",
    price: 800,
    level: 1,
    expertOnly: false,
  },
  {
    id: "patience",
    name: "House Samples",
    description: "Gives everyone at the counter extra patience.",
    price: 550,
    level: 1,
    expertOnly: false,
  },
  {
    id: "quality",
    name: "Recipe Card",
    description: "Adds up to 12 quality points to the next handoff that needs them.",
    price: 650,
    level: 2,
    expertOnly: false,
  },
  {
    id: "assist",
    name: "Counter Help",
    description: "Corrects the mix, plates cooked sides, then shakes and seals the selected cup.",
    price: 475,
    level: 1,
    expertOnly: false,
  },
  {
    id: "supplies",
    name: "Emergency Run",
    description: "Tops up every unlocked ingredient below four portions. The delivery expires after today's shift.",
    price: 950,
    level: 1,
    expertOnly: false,
  },
  {
    id: "special",
    name: "Tip Special",
    description: "Adds $2 to each of the next three tips before the day's tip multiplier.",
    price: 450,
    level: 2,
    expertOnly: false,
  },
  {
    id: "quiet",
    name: "Window Chime",
    description: "Guests stop losing patience briefly while the kitchen keeps working.",
    price: 575,
    level: 4,
    expertOnly: false,
  },
] as const;

export const CREW = [
  {
    id: "host",
    name: "Counter Host",
    description: "Guests wait 16% longer while the host is on duty.",
    price: 1600,
    wage: 160,
    level: 2,
    certificate: {
      name: "Welcome Service",
      benefit: "Guests wait 8% longer while the host is on duty.",
      price: 1600,
      premium: 40,
    },
  },
  {
    id: "prep",
    name: "Prep Cook",
    description: "Starts and collects needed kitchen batches, which take 25% less time.",
    price: 2300,
    wage: 220,
    level: 3,
    certificate: {
      name: "Batch Lead",
      benefit: "Prepared batches stay fresh 8 seconds longer.",
      price: 2200,
      premium: 55,
    },
  },
  {
    id: "runner",
    name: "Order Runner",
    description: "Hands out sealed drinks. Adds 90¢ per sale.",
    price: 3000,
    wage: 210,
    level: 4,
    certificate: {
      name: "Pass Lead",
      benefit: "Hands off drinks in 1.25 seconds and serves side stand orders faster.",
      price: 2400,
      premium: 55,
    },
  },
  {
    id: "manager",
    name: "Branch Manager",
    description: "Runs a separate branch selling its own tea using the shared pantry.",
    price: 5200,
    wage: 310,
    level: 5,
    certificate: {
      name: "Store Lead",
      benefit: "Serves up to five teas per shift and unlocks fruit and dessert menus.",
      price: 3200,
      premium: 75,
    },
  },
] as const;

export const BRANCHES = [
  {
    id: "corner",
    name: "Corner Counter",
    description: "Your original shop and its steady neighborhood crowd.",
    price: 0,
    level: 1,
    rent: 0,
    income: 0,
    arrivalMultiplier: 1,
    patienceMultiplier: 1,
    tipMultiplier: 1,
  },
  {
    id: "campus",
    name: "Campus Kiosk",
    description: "More frequent arrivals and $1.25 extra per completed order. Students are in a hurry.",
    price: 7400,
    level: 3,
    rent: 950,
    income: 125,
    arrivalMultiplier: 1.18,
    patienceMultiplier: 0.88,
    tipMultiplier: 1,
  },
  {
    id: "garden",
    name: "Garden Tea Room",
    description: "A slower crowd with more patience, bigger tips, and $1.45 extra per completed order.",
    price: 11000,
    level: 4,
    rent: 1250,
    income: 145,
    arrivalMultiplier: 0.9,
    patienceMultiplier: 1.2,
    tipMultiplier: 1.22,
  },
  {
    id: "night",
    name: "Night Market Stall",
    description: "Your fastest crowd leaves bigger tips and pays $2.20 extra per completed order.",
    price: 15200,
    level: 5,
    rent: 1800,
    income: 220,
    arrivalMultiplier: 1.32,
    patienceMultiplier: 0.84,
    tipMultiplier: 1.14,
  },
  {
    id: "station",
    name: "Central Station",
    description: "A brisk commuter rush, steadier patience, and $2.65 extra per completed order.",
    price: 20500,
    level: 6,
    rent: 2400,
    income: 265,
    arrivalMultiplier: 1.24,
    patienceMultiplier: 0.94,
    tipMultiplier: 1.1,
  },
  {
    id: "harbor",
    name: "Harbor Tea House",
    description: "Ferry riders wait longer and pay $3.05 extra per completed order.",
    price: 27500,
    level: 8,
    rent: 2650,
    income: 305,
    arrivalMultiplier: 1.19,
    patienceMultiplier: 1.16,
    tipMultiplier: 1.12,
  },
  {
    id: "loft",
    name: "Skyline Tea Loft",
    description: "Guests arrive more often, linger over tea, and pay $3.70 extra per completed order.",
    price: 38500,
    level: 10,
    rent: 3700,
    income: 370,
    arrivalMultiplier: 1.16,
    patienceMultiplier: 1.24,
    tipMultiplier: 1.18,
  },
] as const;

export const PROMOTIONS_BOARD = [
  {
    id: "sidewalk-samples",
    name: "Sidewalk Samples",
    description: "Guests arrive 22% more often and wait 14% less.",
    price: 180,
    level: 2,
    arrivalMultiplier: 1.22,
    patienceMultiplier: 0.86,
    tipMultiplier: 1,
    fruitBonus: 0,
  },
  {
    id: "loyalty-stamps",
    name: "Loyalty Stamp Drive",
    description: "Tips rise 65%, and guests wait 8% less.",
    price: 210,
    level: 3,
    arrivalMultiplier: 1,
    patienceMultiplier: 0.92,
    tipMultiplier: 1.65,
    fruitBonus: 0,
  },
  {
    id: "fruit-chalkboard",
    name: "Fruit Chalkboard",
    description: "Adds $1.90 to each fruit recipe with the right fruit portions and at least 70% quality.",
    price: 300,
    level: 3,
    arrivalMultiplier: 1,
    patienceMultiplier: 1,
    tipMultiplier: 1,
    fruitBonus: 190,
  },
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

export const EARLY_DAY_EVENTS: readonly DayEvent[] = [
  {
    id: "neighborhood",
    name: "Neighborhood Day",
    description: "A steady mix of familiar faces and first-time visitors.",
    arrivalMultiplier: 1,
    patienceMultiplier: 1,
    tipMultiplier: 1,
  },
  {
    id: "rain",
    name: "Rainy Afternoon",
    description: "Guests linger. Fresh snacks earn $1.15 extra.",
    arrivalMultiplier: 0.82,
    patienceMultiplier: 1.28,
    tipMultiplier: 1,
    sideBonus: 115,
  },
  {
    id: "campus",
    name: "Campus Break",
    description: "Students hurry. Extra-ice recipes earn 85¢ more when made to order.",
    arrivalMultiplier: 1.3,
    patienceMultiplier: 0.86,
    tipMultiplier: 1,
    icedBonus: 85,
  },
  {
    id: "tip-day",
    name: "Tip Jar Day",
    description: "Customers leave 50% bigger tips for the crew.",
    arrivalMultiplier: 1,
    patienceMultiplier: 1,
    tipMultiplier: 1.5,
  },
  {
    id: "market-day",
    name: "Street Market",
    description: "The market draws a crowd. Corner Market fruit costs 25% less.",
    arrivalMultiplier: 1.18,
    patienceMultiplier: 1,
    tipMultiplier: 1.2,
  },
  {
    id: "book-club",
    name: "Book Club",
    description: "The book club takes its time and tips well.",
    arrivalMultiplier: 0.95,
    patienceMultiplier: 1.18,
    tipMultiplier: 1.15,
  },
  {
    id: "festival",
    name: "Lantern Night",
    description: "The busiest evening of the week brings more guests and bigger tips.",
    arrivalMultiplier: 1.35,
    patienceMultiplier: 1.03,
    tipMultiplier: 1.25,
  },
  {
    id: "commute",
    name: "Morning Commute",
    description: "Guests have a little less time to wait and leave smaller tips.",
    arrivalMultiplier: 1.08,
    patienceMultiplier: 0.9,
    tipMultiplier: 0.75,
  },
  {
    id: "fruit-special",
    name: "Fruit Special",
    description: "Fruit drinks earn up to 90¢ more. Orchard Co-op fruit costs 15% less.",
    arrivalMultiplier: 1.1,
    patienceMultiplier: 1,
    tipMultiplier: 1,
    fruitBonus: 90,
  },
];

export const LATE_EVENT_DAY = 29;
export const DAY_EVENTS: readonly DayEvent[] = [
  ...EARLY_DAY_EVENTS,
  {
    id: "candlelight",
    name: "Candlelight Service",
    description: "Seal by hand today. Guests wait longer and tip 25% more.",
    arrivalMultiplier: 0.97,
    patienceMultiplier: 1.16,
    tipMultiplier: 1.25,
    sealerOffline: true,
  },
  {
    id: "bottle-return",
    name: "Bottle Return",
    description: "Corner Market seltzer is 25% off. Well-made sparkling tea earns $1.15 extra.",
    arrivalMultiplier: 1.13,
    patienceMultiplier: 0.97,
    tipMultiplier: 1,
    sparklingBonus: 115,
  },
];

export function dayEvent(id: string) {
  return DAY_EVENTS.find((event) => event.id === id) ?? DAY_EVENTS[0];
}

export const NEIGHBORHOOD_AWARDS = [
  { threshold: 60, name: "Good Neighbor", benefit: "5% more guest patience", patience: 1.05 },
  { threshold: 75, name: "Local Favorite", benefit: "8% larger tips", tips: 1.08 },
  { threshold: 90, name: "Neighborhood Landmark", benefit: "10% off new locations", branchPrice: 0.9 },
] as const;

export type PublicityId = (typeof PROMOTIONS_BOARD)[number]["id"];
export type CrewId = (typeof CREW)[number]["id"];
export type LiveCrewId = Exclude<CrewId, "manager">;
export type BranchId = (typeof BRANCHES)[number]["id"];
export type ManagerMenuId = "classic" | "fruit" | "dessert";

export interface LocationManager {
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
  corner: {
    name: "Tea Window",
    description: "Guests arrive 12% more often and wait 4% less.",
    price: 2800,
    level: 3,
    addedRent: 0,
    arrivalMultiplier: 1.12,
    patienceMultiplier: 0.96,
  },
  campus: {
    name: "Study Bench",
    description: "Guests wait 16% longer and arrive 6% less often.",
    price: 4200,
    level: 4,
    addedRent: 0,
    patienceMultiplier: 1.16,
    arrivalMultiplier: 0.94,
  },
  garden: {
    name: "Glasshouse Shelf",
    description: "Adds 65¢ to each fruit recipe with the right fruit portions and at least 70% quality.",
    price: 4900,
    level: 5,
    addedRent: 300,
    fruitBonus: 65,
  },
  night: {
    name: "Late Lanterns",
    description: "Tips rise 18%, and guests wait 6% less.",
    price: 5800,
    level: 6,
    addedRent: 0,
    tipMultiplier: 1.18,
    patienceMultiplier: 0.94,
  },
  station: {
    name: "Express Rail",
    description: "Guests arrive 10% more often and each completed order earns 70¢ extra.",
    price: 7200,
    level: 7,
    addedRent: 0,
    serveBonus: 70,
    arrivalMultiplier: 1.1,
  },
  harbor: {
    name: "Pier Seating",
    description: "Guests wait 22% longer and arrive 6% less often.",
    price: 8600,
    level: 9,
    addedRent: 500,
    patienceMultiplier: 1.22,
    arrivalMultiplier: 0.94,
  },
  loft: {
    name: "Observation Deck",
    description: "Guests wait 16% longer and arrive 6% less often.",
    price: 10200,
    level: 10,
    addedRent: 600,
    patienceMultiplier: 1.16,
    arrivalMultiplier: 0.94,
  },
};

export type CampaignMode = "normal" | "expert";
export type IngredientId = (typeof INGREDIENTS)[number]["id"];
export type SupplierId = (typeof SUPPLIERS)[number]["id"];
export type UpgradeId = (typeof UPGRADES)[number]["id"];
export type PowerupId = (typeof POWERUPS)[number]["id"];
export type StandingOrders = Partial<Record<IngredientId, SupplierId>>;
export type IngredientPortions = Partial<Record<IngredientId, number>>;

export const INGREDIENT_UNLOCK_DAYS: Record<IngredientId, number> = {
  black: 1,
  milk: 1,
  pearls: 1,
  "brown-sugar": 1,
  jasmine: 2,
  strawberry: 2,
  honey: 2,
  bun: 2,
  taro: 3,
  oat: 3,
  popping: 3,
  banana: 3,
  vanilla: 3,
  pudding: 4,
  mango: 7,
  "grass-jelly": 9,
  waffle: 13,
  "banana-scoop": 16,
  "vanilla-scoop": 16,
  "sesame-syrup": 18,
  yuzu: 23,
  seltzer: 27,
};
