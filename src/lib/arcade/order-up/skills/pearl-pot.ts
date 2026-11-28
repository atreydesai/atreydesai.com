import type { SkillBehavior } from "./common.ts";
/** chewy is the visible result of a well-timed pearl-pot. */
export const pearl_pot: SkillBehavior = {
  id: "pearl-pot",
  motion: "sequence",
  good: "chewy",
  under: "firm",
  over: "mushy",
  marks: [0.12, 0.46, 0.82],
};
