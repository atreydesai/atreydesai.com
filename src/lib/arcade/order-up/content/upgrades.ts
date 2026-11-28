import type { SkillId } from "./schema.ts";

export type BrewPartId = "brew-coupling" | "brew-valve" | "brew-pump-head" | "brew-reservoir";
export type BrewModId = "brew-manifold" | "brew-precision" | "brew-gravity";
export type UpgradeId = "brew-bench" | BrewPartId | BrewModId;
export type WorkshopParts = Partial<Record<BrewPartId, number>>;

interface Node<Id extends UpgradeId> {
  id: Id;
  name: string;
  requires: readonly UpgradeId[];
  cost: number;
  partsConsumed: Readonly<WorkshopParts>;
  drawback: string;
}

export interface BenchNode extends Node<"brew-bench"> {
  kind: "bench";
  effects: { opens: "brew" };
}

export interface PartNode extends Node<BrewPartId> {
  kind: "part";
  effects: { produces: BrewPartId; tools: readonly string[] };
}

export interface BrewModNode extends Node<BrewModId> {
  kind: "mod";
  group: "brew-counter";
  effects: {
    grade: number;
    speed: number;
    capacity: number;
    power: number;
    wear: number;
    skills?: readonly SkillId[];
  };
}

export type UpgradeNode = BenchNode | PartNode | BrewModNode;

export const BREW_POWER_BUDGET = 3;
// Base prices are in cents. The workshop applies the mode's purchase multiplier.
export const BREW_RESPEC_COST = 3_500;
export const BREW_COSTS = {
  "brew-bench": 1_200,
  "brew-coupling": 1_400,
  "brew-valve": 1_750,
  "brew-pump-head": 2_050,
  "brew-reservoir": 2_350,
  "brew-manifold": 26_000,
  "brew-precision": 23_500,
  "brew-gravity": 21_000,
} as const satisfies Record<UpgradeId, number>;

export const UPGRADE_NODES: readonly UpgradeNode[] = [
  {
    id: "brew-bench",
    kind: "bench",
    name: "Brew bench",
    requires: [],
    cost: BREW_COSTS["brew-bench"],
    partsConsumed: {},
    effects: { opens: "brew" },
    drawback: "The bench uses cash before you can make parts.",
  },
  {
    id: "brew-coupling",
    kind: "part",
    name: "Sealed coupling",
    requires: ["brew-bench"],
    cost: BREW_COSTS["brew-coupling"],
    partsConsumed: {},
    effects: { produces: "brew-coupling", tools: ["stovetop-kettle", "preset-kettle", "auto-tea", "triple-urn"] },
    drawback: "Making a coupling uses cash and requires a kettle or dispenser.",
  },
  {
    id: "brew-valve",
    kind: "part",
    name: "Flow valve",
    requires: ["brew-coupling"],
    cost: BREW_COSTS["brew-valve"],
    partsConsumed: { "brew-coupling": 1 },
    effects: { produces: "brew-valve", tools: ["water-filter", "tea-carafe"] },
    drawback: "Making a valve uses a coupling and requires a filter or carafe.",
  },
  {
    id: "brew-pump-head",
    kind: "part",
    name: "Pump head",
    requires: ["brew-coupling"],
    cost: BREW_COSTS["brew-pump-head"],
    partsConsumed: { "brew-coupling": 1 },
    effects: { produces: "brew-pump-head", tools: ["auto-milk", "steam-wand"] },
    drawback: "Making a pump head uses a coupling and requires a pump or wand.",
  },
  {
    id: "brew-reservoir",
    kind: "part",
    name: "Raised reservoir",
    requires: ["brew-valve"],
    cost: BREW_COSTS["brew-reservoir"],
    partsConsumed: { "brew-valve": 1 },
    effects: { produces: "brew-reservoir", tools: ["preset-kettle", "triple-urn", "tea-carafe", "cold-brew-tower"] },
    drawback: "Making a reservoir uses a valve that could fit a kit.",
  },
  {
    id: "brew-manifold",
    kind: "mod",
    group: "brew-counter",
    name: "Parallel manifold",
    requires: ["brew-bench", "brew-valve", "brew-pump-head"],
    cost: BREW_COSTS["brew-manifold"],
    partsConsumed: { "brew-valve": 1, "brew-pump-head": 1 },
    effects: { grade: 82, speed: 1.85, capacity: 3, power: 1, wear: 2.8 },
    drawback: "Fast parallel runs lower grade and wear machines faster.",
  },
  {
    id: "brew-precision",
    kind: "mod",
    group: "brew-counter",
    name: "Precision head",
    requires: ["brew-bench", "brew-valve", "brew-coupling"],
    cost: BREW_COSTS["brew-precision"],
    partsConsumed: { "brew-valve": 1, "brew-coupling": 1 },
    effects: { grade: 97, speed: 0.9, capacity: 1, power: 2, wear: 0.6 },
    drawback: "The head runs slowly and leaves power for only one Brew job.",
  },
  {
    id: "brew-gravity",
    kind: "mod",
    group: "brew-counter",
    name: "Gravity feed",
    requires: ["brew-bench", "brew-valve", "brew-reservoir"],
    cost: BREW_COSTS["brew-gravity"],
    partsConsumed: { "brew-valve": 1, "brew-reservoir": 1 },
    effects: { grade: 90, speed: 1, capacity: 1, power: 0, wear: 0.85, skills: ["steep", "pour"] },
    drawback: "Each machine only steeps or pours, one cup at a time.",
  },
];

export const BREW_MODS = UPGRADE_NODES.filter((node): node is BrewModNode => node.kind === "mod");
export const WORKSHOP_PARTS = UPGRADE_NODES.filter((node): node is PartNode => node.kind === "part");

export function upgradeNode(id: string) {
  return UPGRADE_NODES.find((node) => node.id === id);
}
