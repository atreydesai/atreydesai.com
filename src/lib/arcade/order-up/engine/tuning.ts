import type { Mode, SkillId } from "../content/schema.ts";
export interface Tuning {
  startingCash: number;
  gradeWindow: number;
  dayTightening: number;
  minimumWindow: number;
  arrivalSeconds: number;
  patienceSeconds: number;
  orderSize: number;
  purchase: number;
  price: number;
  rent: number;
  shelfLife: number;
  machineSpeed: number;
  freebie: number;
  usualHint: number;
  tickets: number;
  firstDaysArrival: number;
  firstDaysPatience: number;
  missedPenalty: number;
  wear: number;
  deliveryTolerance: number;
}
/** Numerical difficulty lives here. Neither mode filters content or actions. */
export const TUNING: Readonly<Record<Mode, Tuning>> = {
  normal: {
    startingCash: 5400,
    gradeWindow: 0.115,
    dayTightening: 0.00035,
    minimumWindow: 0.075,
    arrivalSeconds: 13,
    patienceSeconds: 72,
    orderSize: 1,
    purchase: 1,
    price: 1,
    rent: 1,
    shelfLife: 1,
    machineSpeed: 1,
    freebie: 0.19,
    usualHint: 0.24,
    tickets: 6,
    firstDaysArrival: 20,
    firstDaysPatience: 100,
    missedPenalty: 1,
    wear: 0.34,
    deliveryTolerance: 0.42,
  },
  expert: {
    startingCash: 4200,
    gradeWindow: 0.077,
    dayTightening: 0.00025,
    minimumWindow: 0.048,
    arrivalSeconds: 10.5,
    patienceSeconds: 55,
    orderSize: 1.25,
    purchase: 1.15,
    price: 0.94,
    rent: 1.32,
    shelfLife: 0.78,
    machineSpeed: 0.9,
    freebie: 0.1,
    usualHint: 0,
    tickets: 6,
    firstDaysArrival: 14.5,
    firstDaysPatience: 76,
    missedPenalty: 2,
    wear: 0.46,
    deliveryTolerance: 0.28,
  },
};
export const SKILL_WINDOW: Readonly<Record<SkillId, number>> = {
  steep: 1,
  "kettle-heat": 1,
  pour: 1.1,
  "milk-ratio": 0.9,
  "pearl-pot": 1.2,
  "egg-waffle": 1.1,
  "fruit-board": 1.2,
  "cheese-foam": 0.9,
  "tiger-stripes": 1,
  "topping-ladle": 1,
  blender: 1,
  shake: 1.1,
  seal: 0.85,
  "straw-stab": 1,
  torch: 1,
  "layered-pour": 1,
  "colour-change": 1,
  "cream-rosette": 1,
  packing: 1.1,
};
export function gradingWindow(mode: Mode, day: number, skill: SkillId) {
  const t = TUNING[mode];
  return Math.max(t.minimumWindow, t.gradeWindow - Math.max(0, day - 5) * t.dayTightening) * SKILL_WINDOW[skill];
}
export function shiftDuration(rank: number) {
  return Math.min(240, 100 + Math.floor(Math.max(0, rank - 1) / 2) * 5);
}
export function ticketLimit(day: number) {
  return day <= 5 ? 3 : day < 10 ? 4 : day < 40 ? 5 : 6;
}
export function phaseAt(elapsed: number, duration: number) {
  const f = elapsed / duration;
  return f < 0.12
    ? "opening"
    : f < 0.3
      ? "morning"
      : f < 0.48
        ? "lunch rush"
        : f < 0.64
          ? "lull"
          : f < 0.88
            ? "after-school rush"
            : "last call";
}
export function arrivalInterval(mode: Mode, day: number, elapsed: number, duration: number) {
  const t = TUNING[mode];
  const base = day <= 5 ? t.firstDaysArrival : t.arrivalSeconds;
  const phase = phaseAt(elapsed, duration);
  return Math.max(4.5, base - Math.min(3, day / 40)) * (phase === "lull" ? 1.8 : phase.includes("rush") ? 0.78 : 1.1);
}
