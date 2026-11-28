import type { SeasonId } from "./schema.ts";
export const SEASONS: readonly {
  id: SeasonId;
  name: string;
  days: number;
  palette: string[];
  family: string;
  weather: string[];
}[] = [
  {
    id: "spring",
    name: "spring",
    days: 28,
    palette: ["#adbc99", "#d8aca7", "#d9cfb1"],
    family: "fruit-tea",
    weather: ["sun", "rain", "breeze"],
  },
  {
    id: "summer",
    name: "summer",
    days: 28,
    palette: ["#e4ce8c", "#8eb9af", "#bf8c75"],
    family: "slush",
    weather: ["sun", "heat", "storm"],
  },
  {
    id: "autumn",
    name: "autumn",
    days: 28,
    palette: ["#bf8c75", "#c9aa6d", "#887e63"],
    family: "latte",
    weather: ["sun", "rain", "fog"],
  },
  {
    id: "winter",
    name: "winter",
    days: 28,
    palette: ["#b1c3c7", "#8c9ba8", "#d8cfbd"],
    family: "hot",
    weather: ["snow", "fog", "sun"],
  },
];
