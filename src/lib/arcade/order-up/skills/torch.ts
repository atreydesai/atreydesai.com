import type { SkillBehavior } from "./common.ts";
/** golden crust is the visible result of a well-timed torch. */
export const torch: SkillBehavior = {
  id: "torch",
  motion: "drag",
  good: "golden crust",
  under: "pale crust",
  over: "scorched",
  guide: [
    {
      x: 0.12,
      y: 0.24,
    },
    {
      x: 0.28,
      y: 0.24,
    },
    {
      x: 0.44,
      y: 0.24,
    },
    {
      x: 0.6,
      y: 0.24,
    },
    {
      x: 0.8,
      y: 0.24,
    },
    {
      x: 0.8,
      y: 0.48,
    },
    {
      x: 0.6,
      y: 0.48,
    },
    {
      x: 0.44,
      y: 0.48,
    },
    {
      x: 0.28,
      y: 0.48,
    },
    {
      x: 0.12,
      y: 0.48,
    },
    {
      x: 0.12,
      y: 0.72,
    },
    {
      x: 0.28,
      y: 0.72,
    },
    {
      x: 0.44,
      y: 0.72,
    },
    {
      x: 0.6,
      y: 0.72,
    },
    {
      x: 0.8,
      y: 0.72,
    },
  ],
};
