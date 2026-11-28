import type { SkillBehavior } from "./common.ts";
/** right heat is the visible result of a well-timed kettle-heat. */
export const kettle_heat: SkillBehavior = {
  id: "kettle-heat",
  motion: "knob",
  good: "right heat",
  under: "cool",
  over: "scalded",
};
