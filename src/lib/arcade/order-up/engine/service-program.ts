import type { Campaign } from "../../orders-campaign.ts";
import { GARDEN_FEATURE } from "../content/service-program.ts";
import { machineDefinition } from "./equipment.ts";
import { staffOnDuty } from "./management.ts";
import { brewMod, workshopPrice } from "./upgrades.ts";
import { treeChoiceOpen } from "./opened.ts";
import { calendar } from "./calendar.ts";

function planningAtGarden(c: Campaign) {
  return c.status === "planning" && c.expansion.activeShop === GARDEN_FEATURE.shop;
}

function precisionMachine(c: Campaign, key: string) {
  const m = c.expansion.machines[key];
  if (!m || m.shop !== GARDEN_FEATURE.shop || !m.automatic || m.broken || m.condition <= 0) return false;
  const definition = machineDefinition(key);
  return definition?.station === "brew" && definition.skills.includes("steep");
}

function calibrated(c: Campaign) {
  const key = c.expansion.gardenFeature.calibratedMachine;
  return !!key && brewMod(c, GARDEN_FEATURE.shop)?.id === GARDEN_FEATURE.kit && precisionMachine(c, key);
}

export function calibrateGardenBrew(c: Campaign, machine: string) {
  const state = c.expansion.gardenFeature;
  const cost = workshopPrice(c, GARDEN_FEATURE.calibrationCost);
  if (
    !planningAtGarden(c) || !treeChoiceOpen(c, "machine-garden-calibration") ||
    !state.developed || state.calibratedMachine === machine || c.cash < cost ||
    brewMod(c)?.id !== GARDEN_FEATURE.kit || !precisionMachine(c, machine)
  ) return false;
  c.cash -= cost;
  state.calibratedMachine = machine;
  return true;
}

export function trainGardenService(c: Campaign, staffId: string) {
  const state = c.expansion.gardenFeature;
  const person = c.expansion.staff.find((staff) => staff.id === staffId);
  const cost = workshopPrice(c, GARDEN_FEATURE.trainingCost);
  if (
    !planningAtGarden(c) || !treeChoiceOpen(c, "crew-garden-service") || !calibrated(c) ||
    !person || person.shop !== GARDEN_FEATURE.shop || person.station !== "prep" ||
    person.shifts < 2 || person.energy < 45 || state.trainedStaff === staffId || c.cash < cost
  ) return false;
  c.cash -= cost;
  person.energy -= GARDEN_FEATURE.trainingEnergy;
  state.trainedStaff = staffId;
  return true;
}

function ready(c: Campaign) {
  if (!calibrated(c)) return false;
  const staffId = c.expansion.gardenFeature.trainedStaff;
  return staffOnDuty(c, GARDEN_FEATURE.shop).some((person) => person.id === staffId && person.station === "prep");
}

export function listGardenFeature(c: Campaign, listed: boolean) {
  if (!planningAtGarden(c) || !treeChoiceOpen(c, "room-garden-feature") || (listed && !ready(c))) return false;
  c.expansion.gardenFeature.listed = listed;
  return true;
}

export function gardenFeatureReady(c: Campaign, shop: string, backupPower: boolean) {
  const state = c.expansion.gardenFeature;
  return shop === GARDEN_FEATURE.shop && state.listed && state.lastOfferDay !== c.day &&
    (backupPower || calendar(c.day).event.effect !== "power-cut") && ready(c);
}
