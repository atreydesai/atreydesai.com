/** Machine instances belong to a shop; a catalogue id is not an instance id. */
import type { Campaign } from "../../orders-campaign.ts";
import { MACHINES } from "../content/machines.ts";
import type { MachineState } from "./state.ts";
export function machineModel(key: string) {
  return key.split("::").at(-1) ?? key;
}
export function machineDefinition(key: string) {
  return MACHINES.find((m) => m.id === machineModel(key));
}
export function machineEntry(
  c: Campaign,
  id: string,
  shop = c.expansion.activeShop,
): [string, MachineState] | undefined {
  const model = machineModel(id);
  return Object.entries(c.expansion.machines).find(([key, m]) => m.shop === shop && machineModel(key) === model);
}
export function machineAt(c: Campaign, id: string, shop = c.expansion.activeShop) {
  return machineEntry(c, id, shop)?.[1];
}
export function instanceKey(c: Campaign, id: string, shop = c.expansion.activeShop) {
  return machineEntry(c, id, shop)?.[0] ?? (c.expansion.machines[id] ? `${shop}::${machineModel(id)}` : id);
}
