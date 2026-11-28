import type { SkillBehavior } from "./common.ts";
/** centre is the visible result of a well-timed topping-ladle. */
export const topping_ladle: SkillBehavior = {
  id: "topping-ladle",
  motion: "ladle",
  good: "centre",
  under: "rim",
  over: "miss",
};
