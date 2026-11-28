import type { SkillBehavior } from "./common.ts";
/** The order is complete when the requested scoops match. */
export const topping_ladle: SkillBehavior = {
  id: "topping-ladle",
  motion: "linear",
  good: "right toppings",
  under: "wrong toppings",
  over: "wrong toppings",
};
