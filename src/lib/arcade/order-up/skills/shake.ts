import type { SkillBehavior } from "./common.ts";
/** well mixed is the visible result of a well-timed shake. */
export const shake: SkillBehavior = {
  id: "shake",
  motion: "rhythm",
  good: "well mixed",
  under: "unmixed",
  over: "melted",
  marks: [0.18, 0.38, 0.58, 0.78],
};
