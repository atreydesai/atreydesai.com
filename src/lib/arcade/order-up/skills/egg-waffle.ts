import type { SkillBehavior } from "./common.ts";
/** golden is the visible result of a well-timed egg-waffle. */
export const egg_waffle: SkillBehavior = {
  id: "egg-waffle",
  motion: "sequence",
  good: "golden",
  under: "pale",
  over: "dark",
  marks: [0.1, 0.45, 0.83],
};
