import type { SkillBehavior } from "./common.ts";
/** centre is the visible result of a well-timed straw-stab. */
export const straw_stab: SkillBehavior = {
  id: "straw-stab",
  motion: "ladle",
  good: "centre",
  under: "edge",
  over: "edge",
};
