/** Shop-book commands are rules, not UI event handlers. */
import type { Campaign } from "../../orders-campaign.ts";
import type { Shift } from "./shift-types.ts";
import { MACHINES, DECOR, FAMILIES, GUESTS, RECIPE_BY_ID, INGREDIENT_BY_ID } from "../content/index.ts";
import { buyPantry, rotateStock } from "./pantry.ts";
import {
  buyMachine,
  buyShop,
  selectShop,
  expandShop,
  moveCounter,
  moveMachine,
  hire,
  candidates,
  assignStaff,
  staffTea,
  takeLoan,
  repayLoan,
  buyDecor,
  placeDecor,
  setLoadout,
  buyPower,
  selectGoal,
  bookMarketing,
  setPrice,
} from "./management.ts";
import { plant, water, harvest, tasteBlend, planRoute, runnerDelivery, recovery, adoptCat } from "./activities.ts";
import { machineEntry } from "./equipment.ts";
import { object, STATIONS } from "./state.ts";
import type { Station } from "../content/schema.ts";
export interface CommandResult {
  ok: boolean;
  message: string;
  taste?: number[];
  view?: string;
}
export function command(c: Campaign, name: string, raw: unknown = {}): CommandResult {
  const d = object(raw),
    id = typeof d.id === "string" ? d.id : "",
    n = (key: string) => (typeof d[key] === "number" ? (d[key] as number) : 0);
  let ok = false;
  let message = "";
  let view: string | undefined;
  switch (name) {
    case "buy-stock":
      ok = buyPantry(c, id, typeof d.supplier === "string" ? d.supplier : "market");
      message = ok ? "The crate is on its way." : "There isn't enough cash or shelf space for that crate.";
      break;
    case "rotate-stock":
      ok = rotateStock(c, id, n("shelf"));
      break;
    case "buy-machine":
      ok = buyMachine(c, id);
      message = ok ? "The machine is fitted." : "This machine needs more cash, a free slot, or another day.";
      break;
    case "buy-shop":
      ok = buyShop(c, id);
      message = ok ? "The new shop is on the map." : "That shop isn't for sale yet.";
      break;
    case "select-shop":
      ok = selectShop(c, id);
      break;
    case "expand":
      ok = expandShop(c, id || c.expansion.activeShop);
      message = ok ? "The shop is bigger now." : "This expansion needs more stars or cash.";
      break;
    case "move-counter":
      ok = moveCounter(c, id as Station, n("x"), n("y"));
      if (ok) c.expansion.metrics["arranged-" + c.expansion.activeShop] = 1;
      break;
    case "move-machine":
      ok = moveMachine(c, id, n("slot"), n("rotation"), typeof d.shop === "string" ? d.shop : c.expansion.activeShop);
      break;
    case "hire": {
      const person = candidates(c).find((s) => s.id === id);
      ok = !!person && hire(c, person);
      message = ok ? "The new crew member is on the rota." : "New crew can't start during a shift.";
      break;
    }
    case "assign":
      ok = assignStaff(
        c,
        id,
        d.station === null ? null : (String(d.station) as Station),
        typeof d.shop === "string" ? d.shop : c.expansion.activeShop,
      );
      break;
    case "staff-tea":
      ok = staffTea(c, id);
      break;
    case "rota": {
      const person = c.expansion.staff.find((s) => s.id === id),
        day = n("day");
      if (person && c.status !== "open" && Number.isInteger(day) && day >= 0 && day < 7) {
        person.rota[day] = !!d.value;
        ok = true;
      }
      break;
    }
    case "automatic": {
      const machine = machineEntry(c, id)?.[1];
      if (machine) {
        machine.automatic = !!d.value;
        ok = true;
      }
      break;
    }
    case "loan":
      ok = takeLoan(c);
      break;
    case "repay":
      ok = repayLoan(c);
      break;
    case "recovery":
      ok = recovery(c);
      break;
    case "buy-decor":
      ok = buyDecor(c, id);
      break;
    case "place-decor":
      ok = placeDecor(c, id, n("x"), n("y"), n("rotation"));
      if (ok) c.expansion.metrics["arranged-" + c.expansion.activeShop] = 1;
      break;
    case "place-from-book":
      if (c.expansion.decor.includes(id) || c.expansion.keepsakes.includes(id)) {
        const state = c.expansion.shops[c.expansion.activeShop];
        ok = placeDecor(c, id, 2 + (state.decor.length % 3), 2 + (Math.floor(state.decor.length / 3) % 2));
        if (ok) {
          c.expansion.metrics["arranged-" + c.expansion.activeShop] = 1;
          view = "arrange";
        }
      }
      break;
    case "equip-decor": {
      const item = DECOR.find((x) => x.id === id);
      if (item && c.status !== "open" && (c.expansion.decor.includes(id) || c.expansion.prints.includes(id))) {
        if (item.kind === "paint") {
          c.expansion.paint = id;
          c.expansion.shops[c.expansion.activeShop].paint = id;
          c.expansion.metrics["arranged-" + c.expansion.activeShop] = 1;
        } else if (item.kind === "print") c.expansion.cupPrint = id;
        else if (item.kind === "apron") c.expansion.apron = id;
        else if (item.kind === "cat") c.expansion.catAccessory = id;
        ok = true;
      }
      break;
    }
    case "loadout":
      ok = setLoadout(c, n("slot"), id);
      break;
    case "buy-power":
      ok = buyPower(c, id);
      break;
    case "goal":
      ok = selectGoal(c, id);
      break;
    case "marketing":
      ok = bookMarketing(c, id);
      break;
    case "price":
      ok = setPrice(c, id, n("price"));
      break;
    case "display":
      if (c.status !== "open" && FAMILIES.some((f) => f.id === id && f.day <= c.day)) {
        c.expansion.windowDisplay = id;
        ok = true;
      }
      break;
    case "truck-stop":
      if (
        c.status !== "open" &&
        c.expansion.shops.truck &&
        ["park", "stadium", "beach", "concert", "offices"].includes(id)
      ) {
        c.expansion.truckStop = id;
        ok = true;
      }
      break;
    case "route":
      ok = planRoute(c, String(d.to), String(d.ingredient));
      message = ok ? "The van has a route." : "The commissary needs a shop and eight fresh portions.";
      break;
    case "runner-delivery":
      ok = runnerDelivery(c, String(d.to));
      break;
    case "plant":
      ok = plant(c, n("plot"), id);
      break;
    case "water":
      ok = water(c, n("plot"));
      break;
    case "harvest":
      ok = harvest(c, n("plot"));
      break;
    case "blend": {
      const taste = Array.isArray(d.ingredients)
        ? tasteBlend(
            c,
            d.ingredients.filter((s): s is string => typeof s === "string"),
          )
        : null;
      return {
        ok: !!taste,
        message: taste ? "The panel has tasted the blend." : "Put two different ingredients in the jars.",
        taste: taste ?? undefined,
      };
    }
    case "adopt":
      ok = adoptCat(c);
      break;
  }
  return { ok, message: message || (ok ? "" : "That isn't available right now."), view };
}
