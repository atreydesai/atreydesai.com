import type { Campaign } from "../../orders-campaign.ts";
import type { Machine } from "../content/schema.ts";
import {
  BREW_MODS,
  BREW_RESPEC_COST,
  WORKSHOP_PARTS,
  upgradeNode,
  type BrewModNode,
  type UpgradeNode,
} from "../content/upgrades.ts";
import { machineDefinition, machineModel } from "./equipment.ts";
import { chapterOpen } from "./opened.ts";
import type { MachineState } from "./state.ts";
import { TUNING } from "./tuning.ts";

export function workshopPrice(c: Campaign, cost: number) {
  return Math.round(cost * TUNING[c.mode].purchase);
}

function canEdit(c: Campaign) {
  return c.status === "planning" && !!c.expansion.shops[c.expansion.activeShop] && chapterOpen(c, "workshop");
}

function canBuild(c: Campaign, node: UpgradeNode) {
  return (
    c.cash >= workshopPrice(c, node.cost) &&
    node.requires.every((id) => {
      const prerequisite = upgradeNode(id);
      if (prerequisite?.kind === "bench") return c.expansion.workshop.brewBench;
      if (prerequisite?.kind === "part") return (c.expansion.workshop.parts[prerequisite.id] ?? 0) > 0;
      return !!prerequisite && !!c.expansion.workshop.brew[c.expansion.activeShop]?.unlocked.includes(prerequisite.id);
    }) &&
    WORKSHOP_PARTS.every(({ id }) => (c.expansion.workshop.parts[id] ?? 0) >= (node.partsConsumed[id] ?? 0))
  );
}

function buyNode(c: Campaign, node: UpgradeNode) {
  c.cash -= workshopPrice(c, node.cost);
  for (const { id } of WORKSHOP_PARTS) {
    const used = node.partsConsumed[id];
    if (!used) continue;
    const left = (c.expansion.workshop.parts[id] ?? 0) - used;
    if (left) c.expansion.workshop.parts[id] = left;
    else delete c.expansion.workshop.parts[id];
  }
}

export function craftPart(c: Campaign, id: string) {
  const node = upgradeNode(id);
  if (!canEdit(c) || node?.kind !== "part" || !canBuild(c, node)) return false;
  if (!Object.keys(c.expansion.machines).some((key) => node.effects.tools.includes(machineModel(key)))) return false;
  buyNode(c, node);
  const part = node.effects.produces;
  c.expansion.workshop.parts[part] = (c.expansion.workshop.parts[part] ?? 0) + 1;
  return true;
}

export function unlockUpgrade(c: Campaign, id: string) {
  const node = upgradeNode(id);
  if (!canEdit(c) || !node || node.kind === "part" || !canBuild(c, node)) return false;
  const workshop = c.expansion.workshop;
  if (node.kind === "bench") {
    if (workshop.brewBench) return false;
    buyNode(c, node);
    workshop.brewBench = true;
  } else {
    const shop = (workshop.brew[c.expansion.activeShop] ?? { unlocked: [], active: null });
    if (shop.unlocked.includes(node.id)) return false;
    buyNode(c, node);
    shop.unlocked.push(node.id);
    workshop.brew[c.expansion.activeShop] = shop;
  }
  return true;
}

export function brewMod(c: Campaign, shop = c.expansion.activeShop) {
  const active = c.expansion.workshop.brew[shop]?.active;
  return BREW_MODS.find((node) => node.id === active);
}

export function chooseMod(c: Campaign, id: string) {
  if (!canEdit(c)) return false;
  const mod = BREW_MODS.find((node) => node.id === id);
  const shopId = c.expansion.activeShop;
  const shop = c.expansion.workshop.brew[shopId];
  if (!mod || !shop || shop.active || !shop.unlocked.includes(mod.id)) return false;
  const compatible = Object.entries(c.expansion.machines).some(([key, machine]) => {
    const definition = machineDefinition(key);
    return (
      machine.shop === shopId && definition?.station === "brew" &&
      definition.skills.some((skill) => !mod.effects.skills || mod.effects.skills.includes(skill))
    );
  });
  if (!compatible) return false;
  shop.active = mod.id;
  return true;
}

export function respecMod(c: Campaign) {
  if (!canEdit(c)) return false;
  const shop = c.expansion.workshop.brew[c.expansion.activeShop];
  const price = workshopPrice(c, BREW_RESPEC_COST);
  if (!shop?.active || c.cash < price) return false;
  c.cash -= price;
  shop.active = null;
  return true;
}

export function operatingStats(definition: Machine, machine: MachineState, mod: BrewModNode | undefined) {
  const tier = definition.tiers[machine.tier - 1];
  const profile = definition.station === "brew" ? mod?.effects : undefined;
  const allowed = profile?.skills;
  return {
    skills: allowed ? definition.skills.filter((skill) => allowed.includes(skill)) : definition.skills,
    grade: (profile?.grade ?? tier.grade) - Math.max(0, 65 - machine.condition) * 0.25,
    speed: profile?.speed ?? tier.speed,
    capacity: profile?.capacity ?? 1,
    power: profile?.power ?? 1,
  };
}

export function machineWear(c: Campaign, shop: string, source: string, machine: MachineState) {
  const mod = machineDefinition(source)?.station === "brew" ? brewMod(c, shop) : undefined;
  return TUNING[c.mode].wear * (mod?.effects.wear ?? 1) / machine.tier;
}
