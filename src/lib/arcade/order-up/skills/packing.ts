import type { SkillBehavior } from "./common.ts";
/** balanced is the visible result of a well-timed packing. */
export const packing: SkillBehavior = {
  id: "packing",
  motion: "sequence",
  good: "balanced",
  under: "loose",
  over: "tipped",
  marks: [0.12, 0.44, 0.8],
};
