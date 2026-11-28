/** Order Up's data contract. Catalogue rows never depend on the DOM. */
export type Mode = "normal" | "expert";
export type Station = "brew" | "prep" | "build" | "serve" | "stock";
export type SeasonId = "spring" | "summer" | "autumn" | "winter";
export type SkillId =
  | "steep"
  | "kettle-heat"
  | "pour"
  | "milk-ratio"
  | "pearl-pot"
  | "egg-waffle"
  | "fruit-board"
  | "cheese-foam"
  | "tiger-stripes"
  | "topping-ladle"
  | "blender"
  | "shake"
  | "seal"
  | "straw-stab"
  | "torch"
  | "layered-pour"
  | "colour-change"
  | "cream-rosette"
  | "packing";
export type ArtKind =
  | "tea"
  | "milk"
  | "fruit"
  | "topping"
  | "syrup"
  | "side"
  | "machine"
  | "guest"
  | "shop"
  | "powerup"
  | "decor"
  | "badge"
  | "event"
  | "skill"
  | "cup";
export interface ArtRef {
  kind: ArtKind;
  color: string;
  motif: string;
  seed: number;
}
export interface Entry {
  id: string;
  name: string;
  day: number;
  art: ArtRef;
}
export interface Ingredient extends Entry {
  group: "tea" | "milk" | "fruit" | "topping" | "syrup" | "side" | "finish";
  shelfLife: number;
  suppliers: string[];
  season: SeasonId | "all";
  cupColor: string;
  price: number;
  legacy: boolean;
  pairTags: string[];
}
export interface Family extends Entry {
  silhouette: "tall" | "short" | "dome" | "slush" | "mug" | "bottle" | "bowl";
  skills: SkillId[];
}
export interface Recipe extends Entry {
  family: string;
  ingredients: { id: string; quantity: number }[];
  steps: SkillId[];
  sugar: 0 | 1 | 2 | 3 | 4;
  ice: 0 | 1 | 2 | 3;
  size: 0 | 1 | 2;
  hot: boolean;
  price: number;
  shops: string[];
  machines: string[];
  variation?: string;
}
export interface Skill extends Entry {
  station: Station;
  input: "press" | "hold" | "rhythm" | "drag" | "sequence" | "knob" | "pick";
  choices?: readonly string[];
  seconds: number;
  target: number;
  verb: string;
  visual: string;
  decision: string;
  lesson: string;
  steps: string[];
}
export interface Machine extends Entry {
  station: Station | "front" | "back";
  skills: SkillId[];
  effect: "automation" | "patience" | "tips" | "capacity" | "freshness" | "traffic" | "prep" | "service";
  price: number;
  tiers: { name: string; grade: number; speed: number; capacity: number; art: ArtRef }[];
  legacy?: string;
}
export interface Powerup extends Entry {
  effect: string;
  seconds: number;
  charges: number;
  price: number;
  description: string;
  legacy?: string;
}
export interface Shop extends Entry {
  price: number;
  rent: number;
  palette: string[];
  twist: string;
  layout: { width: number; height: number; blocked: number[]; counters: Record<Station, [number, number]> };
  slots: number;
  expansions: { name: string; price: number; stars: number; slots: number; format: string; guest: string }[];
}
export interface Guest extends Entry {
  portrait: string;
  favorite: string;
  variations: string[];
  patience: number;
  tips: number;
  story: { prop: string; emote: string }[];
  keepsake: string;
  role: string;
}
export interface SpecialGuest extends Entry {
  effect: string;
  description: string;
  patience: number;
  tips: number;
  size: number;
}
export interface Event extends Entry {
  effect: string;
  weather: string;
  arrival: number;
  patience: number;
  tips: number;
  price: number;
  description: string;
}
export interface Holiday extends Entry {
  season: SeasonId;
  seasonDay: number;
  rule: string;
  family: string;
  guest: string;
  tip: number;
  prop: string;
}
export interface CrewRole extends Entry {
  stations: Station[];
  wage: number;
  hire: number;
  effect: string;
}
export interface Trait {
  id: string;
  name: string;
  speed: number;
  grade: number;
  patience: number;
  energy: number;
}
export interface Goal extends Entry {
  scale: "shift" | "week" | "job" | "season";
  metric: string;
  target: number;
  grade: number;
  reward: number;
  family?: string;
  season?: SeasonId;
}
export interface Badge extends Entry {
  metric: string;
  target: number;
  reward: string;
}
export interface Decor extends Entry {
  kind: "decor" | "paint" | "print" | "apron" | "keepsake" | "cat";
  comfort: number;
  style: number;
  price: number;
}
export interface Rank {
  id: string;
  name: string;
  day: number;
  xp: number;
  unlock: string;
}
export interface View extends Entry {
  verb: string;
  visual: string;
  decision: string;
}
