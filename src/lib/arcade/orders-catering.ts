import type { Recipe } from "./orders-service.ts";

export const CATERING_COURIER_TRAVEL = 0.85;

export interface CateringOffer {
  id: string;
  name: string;
  label: string;
  description: string;
  arrivesAt: number;
  deadline: number;
  minQuality: number;
  reward: number;
  recipes: readonly Recipe[];
}

interface Route {
  day: number;
  offer: CateringOffer;
}

const ROUTES: readonly Route[] = [
  {
    day: 12,
    offer: {
      id: "bindery-break", name: "Bindery Break", label: "Bindery",
      description: "Three teas for the print crew before the next run.",
      arrivesAt: 7, deadline: 85, minQuality: 75, reward: 850,
      recipes: [
        { name: "Pressroom Milk Tea", tea: "black", milk: "milk", toppings: [], mixins: [], syrup: "brown-sugar", sugar: 2, ice: 1, bun: false },
        { name: "Strawberry Proof", tea: "jasmine", milk: null, toppings: [], mixins: ["strawberry"], syrup: "honey", sugar: 1, ice: 2, bun: false },
        { name: "Taro Pudding Tea", tea: "taro", milk: "oat", toppings: ["pudding"], mixins: [], syrup: "vanilla", sugar: 1, ice: 1, bun: false },
      ],
    },
  },
  {
    day: 16,
    offer: {
      id: "matinee-tray", name: "Matinee Tray", label: "Picture House",
      description: "The projection booth wants floats before the matinee.",
      arrivesAt: 9, deadline: 87, minQuality: 77, reward: 980,
      recipes: [
        { name: "Vanilla Curtain Float", tea: "black", milk: "milk", toppings: [], mixins: [], syrup: "vanilla", sugar: 1, ice: 1, bun: false, float: "vanilla-scoop" },
        { name: "Banana Balcony Float", tea: "taro", milk: "oat", toppings: [], mixins: [], syrup: "brown-sugar", sugar: 1, ice: 1, bun: false, float: "banana-scoop" },
        { name: "Honey Jasmine Fizz", tea: "jasmine", milk: null, toppings: ["popping"], mixins: [], syrup: "honey", sugar: 1, ice: 2, bun: false },
      ],
    },
  },
  {
    day: 20,
    offer: {
      id: "kiln-day", name: "Kiln Day", label: "Clay Studio",
      description: "Three orders for the potters while the kiln cools.",
      arrivesAt: 10, deadline: 88, minQuality: 79, reward: 1100,
      recipes: [
        { name: "Sesame Pearl Black Tea", tea: "black", milk: "milk", toppings: ["pearls"], mixins: [], syrup: "sesame-syrup", sugar: 1, ice: 0, bun: false },
        { name: "Toasted Taro & Waffle", tea: "taro", milk: "oat", toppings: [], mixins: [], syrup: "sesame-syrup", sugar: 1, ice: 1, bun: false, waffle: true },
        { name: "Mango Jasmine Cooler", tea: "jasmine", milk: null, toppings: [], mixins: ["mango"], syrup: "honey", sugar: 1, ice: 3, bun: false },
      ],
    },
  },
  {
    day: 23,
    offer: {
      id: "ferry-call", name: "Ferry Call", label: "Ferry Office",
      description: "One tray for the deck crew before the afternoon crossing.",
      arrivesAt: 12, deadline: 89, minQuality: 81, reward: 1220,
      recipes: [
        { name: "Yuzu Deck Tea", tea: "jasmine", accentTea: "black", milk: null, toppings: [], mixins: ["yuzu"], syrup: "honey", sugar: 1, ice: 2, bun: false },
        { name: "Two-Tea Pearl Milk", tea: "black", accentTea: "taro", milk: "milk", toppings: ["pearls"], mixins: [], syrup: "brown-sugar", sugar: 1, ice: 1, bun: false },
        { name: "Yuzu Harbor Jasmine", tea: "jasmine", milk: null, toppings: ["popping"], mixins: ["yuzu"], syrup: "vanilla", sugar: 1, ice: 3, bun: false },
      ],
    },
  },
];

export function cateringOffer(day: number, expert: boolean): CateringOffer | null {
  if (!Number.isSafeInteger(day) || day < ROUTES[0].day) return null;
  const available = ROUTES.filter((route) => route.day <= day);
  const newest = available.length - 1;
  const route = available[(day - available[newest].day + newest) % available.length];
  const { offer } = route;
  return {
    ...offer,
    deadline: offer.deadline - (expert ? 9 : 0),
    minQuality: offer.minQuality + (expert ? 7 : 0),
    reward: offer.reward + (expert ? 80 : 0),
    recipes: offer.recipes.map((recipe) => ({ ...recipe, toppings: [...recipe.toppings], mixins: [...recipe.mixins] })),
  };
}
