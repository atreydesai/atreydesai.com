/** Staged shops for tests: each sample is a save with supplied stock and money, not earned progress. */
import { newCampaign, type CampaignMode } from "../../src/lib/arcade/orders-campaign.ts";
import {
  INGREDIENTS,
  MACHINES,
  RECIPES,
  SHOPS,
  POWERUPS,
  DECOR,
  GUESTS,
} from "../../src/lib/arcade/order-up/content/index.ts";
import { emptyShop, createStaff } from "../../src/lib/arcade/order-up/engine/state.ts";
import { addStock } from "../../src/lib/arcade/order-up/engine/pantry.ts";
import { startShift } from "../../src/lib/arcade/order-up/engine/shift.ts";
import { spawnTicket } from "../../src/lib/arcade/order-up/engine/tickets.ts";
import { saveEnvelope } from "../../src/lib/arcade/order-up/engine/save.ts";
import { planRoute } from "../../src/lib/arcade/order-up/engine/activities.ts";
export const SAMPLES = [
  {
    id: "kitchen",
    title: "the lunch queue",
    shop: "corner",
    day: 18,
    view: "room",
    live: true,
    family: "milk-tea",
    verb: "brew, pour, shake, seal",
    description: "Make three real orders while the other guests wait.",
    detail: "Start the kettle, switch tickets while it steeps, then finish the cups by hand.",
  },
  {
    id: "guests",
    title: "a change of plans",
    shop: "corner",
    day: 56,
    view: "window",
    live: true,
    family: "milk-tea",
    verb: "remember, remake, refill",
    description: "A changed order, a family favourite, and one more refill.",
    detail: "The first guest changes their request. The second needs a remembered drink. The third stays for a refill.",
  },
  {
    id: "garden",
    title: "a quiet morning",
    shop: "garden",
    day: 40,
    view: "garden",
    live: false,
    family: "fruit-tea",
    verb: "plant, water, harvest",
    description: "Pick ripe fruit and grow the next batch.",
    detail: "Harvest the ready planter, water another, and choose a seasonal seed for the empty bed.",
  },
  {
    id: "lab",
    title: "the tasting table",
    shop: "garden",
    day: 55,
    view: "lab",
    live: false,
    family: "fruit-tea",
    verb: "blend, taste, discover",
    description: "Let three faces tell you which flavours belong together.",
    detail: "Try oolong with peach; compare it with milk and lemon. Good pairings earn a cup print.",
  },
  {
    id: "night",
    title: "lantern service",
    shop: "night",
    day: 36,
    view: "room",
    live: true,
    family: "cheese-foam",
    verb: "whisk, build, hand off",
    description: "Work the night-market counter under the lanterns.",
    detail: "Choose a ticket, move between counters, and finish its foam before the queue runs out of patience.",
  },
  {
    id: "loft",
    title: "tea above the city",
    shop: "loft",
    day: 62,
    view: "room",
    live: true,
    family: "layered",
    verb: "layer, seal, serve",
    description: "Build a three-cup order in the skyline shop.",
    detail: "Each cup earns its own grades; all three must be ready before the tray can leave.",
  },
  {
    id: "delivery",
    title: "the last mile",
    shop: "commissary",
    day: 94,
    view: "delivery",
    live: false,
    family: "milk-tea",
    verb: "steer, balance, deliver",
    description: "Keep a carrier level through the city bumps.",
    detail: "Use the left and right controls to counter the slosh. A cleaner delivery earns a better grade.",
  },
  {
    id: "arrange",
    title: "make room",
    shop: "campus",
    day: 65,
    view: "arrange",
    live: false,
    family: "milk-tea",
    verb: "place, rotate, staff",
    description: "Make a kitchen with shorter walks.",
    detail: "Select a counter and tap a floor tile, or drag it. The layout changes the chef’s travel time.",
  },
  {
    id: "winter",
    title: "snow outside",
    shop: "lodge",
    day: 90,
    view: "room",
    live: true,
    family: "hot",
    verb: "heat, steep, pour",
    description: "Get hot drinks to the waiting skiers.",
    detail: "Choose the right kettle temperature, then finish the drink in a mug rather than a cold cup.",
  },
  {
    id: "moon",
    title: "one small sip",
    shop: "moon",
    day: 116,
    view: "room",
    live: true,
    family: "snow",
    verb: "blend, top, serve",
    description: "Take a late-game order at the lunar outpost.",
    detail: "Try the snow-bowl family, explore the shop book, or switch to a station close-up.",
  },
] as const;
export type SampleId = (typeof SAMPLES)[number]["id"];
export function createSample(id: string, mode: CampaignMode = "normal") {
  const scene = SAMPLES.find((s) => s.id === id);
  if (!scene) throw new Error("Unknown playable sample.");
  const c = newCampaign(mode);
  c.day = scene.day;
  c.cash = 185000;
  c.xp = scene.day * 500;
  c.status = "planning";
  for (const place of SHOPS.filter((s) => s.day <= c.day)) c.expansion.shops[place.id] = emptyShop(place.id);
  c.expansion.activeShop = scene.shop;
  if (c.branches.includes(scene.shop as any)) c.activeBranch = scene.shop as any;
  c.expansion.shops[scene.shop].stars = 4;
  c.expansion.shops[scene.shop].expansion = 2;
  c.inventory = [];
  c.expansion.extraInventory = [];
  for (const ingredient of INGREDIENTS.filter((i) => i.day <= c.day)) addStock(c, ingredient.id, 4, 0, c.day + 8);
  // Extra stock for the illustrated activities is explicit and bounded by the same pantry rules.
  for (const ingredient of ["black", "milk", "brown-sugar", "oolong", "peach", "lemon"])
    addStock(c, ingredient, 8, 0, c.day + 8);
  const equipment = ["auto-tea", "auto-milk", "auto-toppings"];
  for (const [i, id] of equipment.entries()) {
    const def = MACHINES.find((m) => m.id === id);
    if (def && def.day <= c.day)
      c.expansion.machines[id] = {
        tier: i + 1,
        condition: 100,
        shop: scene.shop,
        slot: i,
        rotation: i % 4,
        automatic: false,
        broken: false,
      };
  }
  for (const power of POWERUPS.filter((p) => p.day <= c.day)) c.expansion.powerups[power.id] = 3;
  c.expansion.cat = c.day >= 30;
  c.expansion.ice = 250;
  c.expansion.garden = [
    { ingredient: "peach", planted: c.day - 3, watered: c.day - 1, growth: 2 },
    { ingredient: "oolong", planted: c.day - 4, watered: c.day - 1, growth: 3 },
    { ingredient: null, planted: 0, watered: 0, growth: 0 },
    { ingredient: "lemon", planted: c.day - 2, watered: c.day - 1, growth: 1 },
  ];
  const decor = DECOR.filter((d) => d.kind === "decor" && d.day <= c.day).slice(0, 6);
  c.expansion.decor = decor.map((d) => d.id);
  c.expansion.shops[scene.shop].decor = decor
    .slice(0, 3)
    .map((d, i) => ({ id: d.id, x: 2 + i, y: 1, rotation: i % 4 }));
  if (scene.id === "arrange") {
    c.expansion.metrics["arranged-" + scene.shop] = 1;
    c.expansion.staff = [createStaff("barista", 91, scene.shop), createStaff("prep", 92, scene.shop)];
  }
  if (scene.id === "delivery") {
    addStock(c, "black", 12, 0, c.day + 8);
    planRoute(c, "corner", "black", 8);
  }
  let shift = scene.live ? startShift(c) : null;
  if (shift) {
    shift.tickets = shift.tickets.map(() => null);
    shift.arrivals = 0;
    shift.selected = 0;
    shift.nextArrival = 24;
    const recipes = RECIPES.filter(
      (r) => r.day <= c.day && r.family === scene.family && (!r.shops.length || r.shops.includes(scene.shop)),
    );
    const guests = GUESTS.filter((g) => g.day <= c.day).slice(0, 3);
    for (let i = 0; i < 3; i++) {
      const recipe = recipes[i % recipes.length] ?? RECIPES[0];
      for (const ing of recipe.ingredients) addStock(c, ing.id, 4, 0, c.day + 8);
      const ticket = spawnTicket(c, shift, {
        guest: guests[i].id,
        recipe: recipe.id,
        count: scene.id === "loft" && i === 0 ? 3 : 1,
        special: scene.id === "guests" ? ["undecided", "grandparent", "crammer"][i] : undefined,
      });
      if (ticket) {
        if (scene.id !== "guests") {
          ticket.usual = false;
          ticket.revealed = true;
          ticket.special = null;
        }
        ticket.sleeping = false;
        ticket.job = null;
      }
    }
  }
  return {
    scene,
    envelope: saveEnvelope(c, shift, {
      sample: scene.id,
      notice: "Staged playable example. Your campaign is unchanged.",
    }),
  };
}
