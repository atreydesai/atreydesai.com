import type { SkillBehavior } from "./common.ts";
/** smooth is the visible result of a well-timed blender. */
export const blender: SkillBehavior = {
  id: "blender",
  motion: "linear",
  good: "smooth",
  under: "coarse",
  over: "watery",
};
