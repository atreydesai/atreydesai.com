import type { SkillBehavior } from "./common.ts";
/** even slices is the visible result of a well-timed fruit-board. */
export const fruit_board: SkillBehavior = {
  id: "fruit-board",
  motion: "sequence",
  good: "even slices",
  under: "rough cuts",
  over: "too pulpy",
  marks: [0.15, 0.43, 0.8],
};
