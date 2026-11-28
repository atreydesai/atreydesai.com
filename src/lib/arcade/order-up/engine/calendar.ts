import {
  SEASONS,
  EVENTS,
  HOLIDAYS,
  INGREDIENTS,
  FAMILIES,
  SKILLS,
  MACHINES,
  POWERUPS,
  GUESTS,
  SPECIAL_GUESTS,
  SHOPS,
  VIEWS,
  DECOR,
  RANKS,
  GOALS,
} from "../content/index.ts";
import type { Entry } from "../content/schema.ts";
import { pick } from "./random.ts";
export function calendar(day: number) {
  const d = Math.max(1, Math.floor(day)),
    cycle = Math.floor((d - 1) / 112),
    season = SEASONS[Math.floor(((d - 1) % 112) / 28)],
    seasonDay = ((d - 1) % 28) + 1,
    weekDay = ((d - 1) % 7) + 1;
  const fresh = EVENTS.find((x) => x.day === d),
    event =
      fresh ??
      pick(
        EVENTS.filter((x) => x.day <= d),
        d + cycle * 97,
      );
  const holiday = HOLIDAYS.find((x) => x.season === season.id && x.seasonDay === seasonDay) ?? null;
  return {
    day: d,
    cycle,
    season,
    seasonDay,
    weekDay,
    event,
    holiday,
    beat:
      weekDay === 2
        ? "market morning"
        : weekDay === 4
          ? "taste-off"
          : weekDay === 6
            ? "commission deadline"
            : weekDay === 7
              ? "quiet day"
              : "regular day",
    weather: holiday?.id === "first-snow" ? "snow" : event.weather,
    remix: cycle > 0 ? ["double delivery", "patient pairs", "precise pours", "seasonal favorites"][cycle % 4] : null,
  };
}
export function unlocks(
  day: number,
): { kind: string; item: Entry | { id: string; name: string; day: number; unlock: string; xp: number } }[] {
  const groups: Record<string, readonly Entry[]> = {
    ingredient: INGREDIENTS,
    family: FAMILIES,
    skill: SKILLS,
    machine: MACHINES,
    powerup: POWERUPS,
    guest: GUESTS,
    special: SPECIAL_GUESTS,
    shop: SHOPS,
    view: VIEWS,
    event: EVENTS,
    decor: DECOR,
    goal: GOALS,
  };
  return [
    ...Object.entries(groups).flatMap(([kind, items]) =>
      items.filter((x) => x.day === day).map((item) => ({ kind, item })),
    ),
    ...RANKS.filter((x) => x.day === day).map((item) => ({ kind: "rank", item })),
  ];
}
export function seasonalPrice(id: string, day: number) {
  const ingredient = INGREDIENTS.find((x) => x.id === id);
  if (!ingredient) return 1;
  return ingredient.season === "all" ? 1 : ingredient.season === calendar(day).season.id ? 0.8 : 1.25;
}
