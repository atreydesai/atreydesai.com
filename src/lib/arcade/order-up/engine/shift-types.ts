import type { Mode, Station, SkillId } from "../content/schema.ts";
import type { SkillRun } from "../skills/index.ts";
export interface SkillGrade {
  skill: SkillId;
  grade: number;
  result: string;
  source: string | null;
}
export interface Cup {
  recipe: string;
  step: number;
  grades: SkillGrade[];
  run: SkillRun | null;
  warmup: number;
  started: boolean;
  ready: boolean;
  readyAt: number;
  damage: number;
  preparedPearls: boolean;
}
export interface Ticket {
  id: number;
  slot: number;
  guest: string;
  special: string | null;
  recipe: string;
  cups: Cup[];
  cupIndex: number;
  patience: number;
  maxPatience: number;
  arrived: number;
  usual: boolean;
  revealed: boolean;
  changed: boolean;
  sleeping: boolean;
  vip: boolean;
  packed: boolean;
  name: string;
  job: string | null;
  changeTo?: string | null;
  memoryGuest?: string | null;
  refills?: number;
  pickupAt?: number | null;
  featured?: boolean;
  expectedAt?: number;
}
export interface Receipt {
  id: number;
  ticket: number;
  guest: string;
  name: string;
  recipe: string;
  grade: number;
  skills: SkillGrade[];
  price: number;
  tip: number;
  emote: string;
  special: string | null;
  story: number;
  packed: boolean;
  time: number;
  cup: number;
}
export interface Effect {
  until: number;
  charges: number;
}
export interface Shift {
  version: 3;
  skillModel?: 1;
  rankAtStart: number;
  mode: Mode;
  day: number;
  shop: string;
  seed: number;
  duration: number;
  elapsed: number;
  realElapsed: number;
  status: "open" | "closing" | "complete";
  tickets: (Ticket | null)[];
  selected: number;
  nextArrival: number;
  nextId: number;
  arrivals: number;
  receipts: Receipt[];
  lost: number;
  points: number;
  revenue: number;
  tips: number;
  flow: number;
  streak: number;
  tipJar: number;
  effects: Record<string, Effect>;
  cooldowns: Record<string, number>;
  chefStation: Station;
  walking: number;
  lastMark: { skill: SkillId; grade: number; time: number } | null;
  notice: string;
  noticeAt: number;
  event: string;
  holiday: string | null;
  settled: boolean;
  gull: { active: boolean; since: number; next: number };
  bonus: number;
  daily: string | null;
  lesson: string | null;
  autoClock: number;
  lastGift: string | null;
  packedJobs: string[];
  weather: string;
  reserve: number;
  hostCheckIn?: boolean;
  lastDoseFamily?: string;
}
export function freshCup(recipe: string): Cup {
  return {
    recipe,
    step: 0,
    grades: [],
    run: null,
    warmup: 0,
    started: false,
    ready: false,
    readyAt: 0,
    damage: 0,
    preparedPearls: false,
  };
}
