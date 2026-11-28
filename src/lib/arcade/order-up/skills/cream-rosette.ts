import type { SkillBehavior } from "./common.ts";
/** rosette is the visible result of a well-timed cream-rosette. */
export const cream_rosette: SkillBehavior = {
  id: "cream-rosette",
  motion: "drag",
  good: "rosette",
  under: "flat",
  over: "crossed",
  guide: [
    {
      x: 0.5,
      y: 0.5,
    },
    {
      x: 0.6,
      y: 0.5,
    },
    {
      x: 0.6,
      y: 0.4,
    },
    {
      x: 0.5,
      y: 0.3,
    },
    {
      x: 0.3,
      y: 0.3,
    },
    {
      x: 0.2,
      y: 0.5,
    },
    {
      x: 0.3,
      y: 0.7,
    },
    {
      x: 0.5,
      y: 0.8,
    },
    {
      x: 0.7,
      y: 0.7,
    },
    {
      x: 0.8,
      y: 0.5,
    },
    {
      x: 0.7,
      y: 0.3,
    },
    {
      x: 0.5,
      y: 0.15,
    },
    {
      x: 0.3,
      y: 0.15,
    },
  ],
};
