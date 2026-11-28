import type { SkillBehavior } from "./common.ts";
/** balanced is the visible result of a well-timed steep. */
export const steep: SkillBehavior = {
  id: "steep",
  motion: "linear",
  good: "balanced",
  under: "weak",
  over: "bitter",
};
