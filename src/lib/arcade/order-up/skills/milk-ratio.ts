import type { SkillBehavior } from "./common.ts";
/** balanced is the visible result of a well-timed milk-ratio. */
export const milk_ratio: SkillBehavior = {
  id: "milk-ratio",
  motion: "linear",
  good: "balanced",
  under: "light",
  over: "too rich",
};
