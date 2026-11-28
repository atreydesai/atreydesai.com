import type { Campaign } from "../../orders-campaign.ts";
import { TREE_NODES, type TreeNodeId } from "../content/progression-trees.ts";
import { SHOPS } from "../content/shops.ts";
import { WORKSHOP_PARTS, type BrewPartId } from "../content/upgrades.ts";
import { workshopPrice } from "./upgrades.ts";

const FACILITIES: ReadonlySet<TreeNodeId> = new Set(["prep-batch-pot", "build-dosing-rail", "serve-handoff-rack", "front-greeting-post"]);
const GENERIC = new Set<TreeNodeId>([
  "prep-batch-pot", "prep-hold-bath", "prep-portion-tray",
  "build-dosing-rail", "build-fixed-doser", "build-flex-nozzle",
  "serve-handoff-rack", "serve-locker-bank", "serve-finish-bench",
  "front-greeting-post", "front-express-rail", "front-host-stand",
  "back-service-rack", "back-spares-bin", "back-wash-station",
  "crew-station-lead", "crew-floater", "crew-hospitality",
  "pantry-night-freight", "pantry-orchard-crate", "pantry-market-call",
  "furniture-fit-kit", "decor-display-rails", "decor-menu-window", "decor-regular-shelf",
  "room-utility", "menu-batch-base", "menu-tasting-card",
  "promo-radio-window", "promo-loyalty-stamp", "event-outage-plan", "event-rush-plan", "event-quiet-plan",
  "contract-neighbor-supply",
]);

export type NodeStatus = {
  status: "owned" | "open" | "locked" | "shut";
  reason: string;
};

export function hasNode(c: Campaign, id: TreeNodeId, shop = c.expansion.activeShop) {
  return c.expansion.treeNodes[shop]?.includes(id) ?? false;
}

export function facilitySlots(c: Campaign, shop = c.expansion.activeShop) {
  return c.expansion.treeNodes[shop]?.filter((id) => FACILITIES.has(id)).length ?? 0;
}

export function genericNode(id: TreeNodeId) {
  return GENERIC.has(id);
}

function part(id: TreeNodeId): BrewPartId | undefined {
  return WORKSHOP_PARTS.find((item) => item.id === id)?.id;
}

function fulfilled(c: Campaign, id: TreeNodeId, day: number) {
  const { workshop, gardenFeature } = c.expansion;
  const shop = c.expansion.activeShop;
  if (hasNode(c, id)) return true;
  const material = part(id);
  if (material) return (workshop.parts[material] ?? 0) > 0;
  switch (id) {
    case "brew-bench": return workshop.brewBench;
    case "brew-precision":
    case "brew-manifold":
    case "brew-gravity": return workshop.brew[shop]?.unlocked.includes(id) ?? false;
    case "tea-garden-oolong": return gardenFeature.developed || gardenFeature.sampleUntil > c.day;
    case "menu-garden-oolong": return gardenFeature.developed;
    case "machine-garden-calibration": return shop === "garden" && !!gardenFeature.calibratedMachine;
    case "crew-garden-service": return shop === "garden" && !!gardenFeature.trainedStaff;
    case "room-garden-feature": return shop === "garden" && gardenFeature.listed;
    case "guest-garden-offer": return shop === "garden" && gardenFeature.lastOfferDay === c.day;
    case "guest-wait-estimate": return c.day >= day && c.expansion.staff.some((p) => p.role === "host" && p.shop === shop);
    case "crew-shadow": return c.day >= day && c.expansion.staff.some((p) => p.shop === shop);
    case "menu-base-card": return c.day >= day && Object.values(c.expansion.recipes).some((recipe) => recipe.best >= 80);
    default: return c.day >= day && TREE_NODES.some((node) => node.id === id && node.delivered === "existing");
  }
}

export function nodeStatus(c: Campaign, id: string): NodeStatus {
  const node = TREE_NODES.find((item) => item.id === id);
  if (!node) return { status: "shut", reason: "This upgrade is unknown." };
  if (fulfilled(c, node.id, node.day)) return { status: "owned", reason: "This requirement is met." };
  if (node.delivered === "planned") return { status: "shut", reason: "This upgrade is planned." };
  if (c.day < node.day) return { status: "locked", reason: `This opens on day ${node.day}.` };
  if (!genericNode(node.id)) return { status: "shut", reason: "Complete this in its usual activity." };
  const shop = c.expansion.activeShop;
  if (c.status !== "planning" || !c.expansion.shops[shop])
    return { status: "shut", reason: "Make this change between shifts." };

  const conflict = TREE_NODES.find((item) => item.id !== node.id && item.group === node.group && hasNode(c, item.id));
  if (conflict) return { status: "locked", reason: "The other upgrade in this group is installed." };
  const missing = node.requires.find((id) => {
    const parent = TREE_NODES.find((item) => item.id === id)!;
    return !fulfilled(c, id, parent.day);
  });
  if (missing) return { status: "locked", reason: `Complete ${missing.replaceAll("-", " ")} first.` };

  if (FACILITIES.has(node.id)) {
    const definition = SHOPS.find((item) => item.id === shop)!;
    const limit = definition.slots + c.expansion.shops[shop].expansion * 2 +
      Number(hasNode(c, "back-service-rack")) + Number(hasNode(c, "room-utility"));
    const used = Object.values(c.expansion.machines).filter((machine) => machine.shop === shop).length;
    if (used + facilitySlots(c) >= limit) return { status: "locked", reason: "This needs a free machine slot." };
  }
  if ((node.system === "crew" || ["front-host-stand", "pantry-market-call", "back-wash-station", "serve-finish-bench"].includes(node.id)) &&
      !c.expansion.staff.some((p) => p.shop === shop &&
        (node.id === "crew-hospitality" || node.id === "front-host-stand" ? p.role === "host" :
          node.id === "pantry-market-call" ? p.role === "runner" :
          node.id === "back-wash-station" ? p.role === "cleaner" && p.station === "stock" :
          node.id === "serve-finish-bench" ? p.station === "serve" && ["cashier", "trainer"].includes(p.role) :
          node.id === "crew-station-lead" ? p.role === "barista" && !!p.station : !!p.station))) {
    return { status: "locked", reason: "This needs a suitable employee at this shop." };
  }
  if ((node.system === "decor" || node.id === "furniture-fit-kit") && c.expansion.shops[shop].decor.length === 0)
    return { status: "locked", reason: "Place a decoration at this shop first." };
  if (node.id === "contract-neighbor-supply" && !c.expansion.shops.commissary)
    return { status: "locked", reason: "This agreement needs a commissary." };
  if (c.cash < workshopPrice(c, node.cost)) return { status: "locked", reason: "The till cannot cover the price." };
  return { status: "open", reason: "This upgrade is available." };
}

export function unlockNode(c: Campaign, id: string) {
  if (nodeStatus(c, id).status !== "open") return false;
  const node = TREE_NODES.find((item) => item.id === id)!;
  for (const parent of node.requires) {
    const material = part(parent);
    if (!material) continue;
    const left = (c.expansion.workshop.parts[material] ?? 0) - 1;
    if (left) c.expansion.workshop.parts[material] = left;
    else delete c.expansion.workshop.parts[material];
  }
  c.cash -= workshopPrice(c, node.cost);
  (c.expansion.treeNodes[c.expansion.activeShop] ??= []).push(node.id);
  return true;
}
