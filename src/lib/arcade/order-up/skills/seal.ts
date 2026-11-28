import type { SkillBehavior } from "./common.ts";
/** sealed is the visible result of a well-timed seal. */
export const seal: SkillBehavior = {
  id: "seal",
  motion: "seal",
  good: "sealed",
  under: "loose",
  over: "scorched",
};
