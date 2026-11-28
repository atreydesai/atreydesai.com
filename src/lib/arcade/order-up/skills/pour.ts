import type { SkillBehavior } from "./common.ts";
/** on the line is the visible result of a well-timed pour. */
export const pour: SkillBehavior = {
  id: "pour",
  motion: "knob",
  good: "on the line",
  under: "short",
  over: "spilled",
};
