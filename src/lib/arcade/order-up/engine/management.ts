import type { Campaign, BranchId, CrewId } from "../../orders-campaign.ts";
import type { Station } from "../content/schema.ts";
import {
  MACHINES,
  SHOPS,
  CREW_ROLES,
  TRAITS,
  DECOR,
  RANKS,
  POWERUPS,
  GUESTS,
  GOALS,
  FAMILIES,
} from "../content/index.ts";
import { STATIONS, createStaff, emptyShop, type StaffState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { calendar } from "./calendar.ts";
import { machineEntry, machineModel, instanceKey } from "./equipment.ts";
import { goalScaleOpen } from "./opened.ts";
export { machineEntry, machineAt, machineModel, machineDefinition } from "./equipment.ts";
export function rankFor(c: Campaign) {
  return Math.min(60, Math.max(1, Math.min(Math.floor(c.day / 2) + 1, RANKS.filter((r) => r.xp <= c.xp).length)));
}
export function machineSlots(c: Campaign, shop = c.expansion.activeShop) {
  const definition = SHOPS.find((s) => s.id === shop)!;
  return definition.slots + (c.expansion.shops[shop]?.expansion ?? 0) * 2;
}
export function installed(c: Campaign, shop = c.expansion.activeShop) {
  return Object.entries(c.expansion.machines).filter(([, m]) => m.shop === shop);
}
export function buyMachine(c: Campaign, id: string) {
  if (c.status === "open") return false;
  const definition = MACHINES.find((m) => m.id === id);
  if (!definition || definition.day > c.day) return false;
  const key = instanceKey(c, id),
    current = machineEntry(c, id)?.[1],
    tier = current?.tier ?? 0;
  if (tier >= 3) return false;
  const price = Math.round(definition.price * (tier === 0 ? 1 : tier === 1 ? 1.2 : 1.7) * TUNING[c.mode].purchase);
  if (c.cash < price || (!current && installed(c).length >= machineSlots(c))) return false;
  c.cash -= price;
  c.expansion.machines[key] = {
    tier: tier + 1,
    condition: 100,
    shop: current?.shop ?? c.expansion.activeShop,
    slot:
      current?.slot ??
      Array.from({ length: machineSlots(c) }, (_, i) => i).find((i) => !installed(c).some(([, m]) => m.slot === i)) ??
      0,
    rotation: current?.rotation ?? 0,
    automatic: true,
    broken: false,
  };
  if (definition.legacy && !c.upgrades.includes(id)) c.upgrades.push(id);
  c.expansion.metrics.machines = Object.keys(c.expansion.machines).length;
  return true;
}
export function buyShop(c: Campaign, id: string) {
  const shop = SHOPS.find((s) => s.id === id);
  if (!shop || shop.day > c.day || c.expansion.shops[id] || c.status === "open") return false;
  const price = Math.round(shop.price * TUNING[c.mode].purchase);
  if (c.cash < price) return false;
  c.cash -= price;
  c.expansion.shops[id] = emptyShop(id);
  if (
    ["corner", "campus", "garden", "night", "station", "harbor", "loft"].includes(id) &&
    !c.branches.includes(id as BranchId)
  )
    c.branches.push(id as BranchId);
  return true;
}
export function selectShop(c: Campaign, id: string) {
  if (!c.expansion.shops[id] || c.status === "open") return false;
  c.expansion.activeShop = id;
  if (c.branches.includes(id as BranchId)) c.activeBranch = id as BranchId;
  return true;
}
export function expandShop(c: Campaign, id = c.expansion.activeShop) {
  const state = c.expansion.shops[id],
    definition = SHOPS.find((s) => s.id === id);
  if (!state || !definition || state.expansion >= 3 || c.status === "open") return false;
  const next = definition.expansions[state.expansion],
    price = Math.round(next.price * TUNING[c.mode].purchase);
  if (c.cash < price || state.stars < next.stars) return false;
  c.cash -= price;
  state.expansion++;
  return true;
}
export function moveCounter(c: Campaign, station: Station, x: number, y: number) {
  if (c.status === "open" || !STATIONS.includes(station) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const shop = SHOPS.find((s) => s.id === c.expansion.activeShop)!,
    layout = c.expansion.shops[shop.id].layout;
  x = Math.round(x);
  y = Math.round(y);
  if (
    x < 0 ||
    y < 0 ||
    x >= shop.layout.width ||
    y >= shop.layout.height ||
    shop.layout.blocked.includes(y * shop.layout.width + x) ||
    Object.entries(layout).some(([id, p]) => id !== station && p[0] === x && p[1] === y)
  )
    return false;
  layout[station] = [x, y];
  return true;
}
export function moveMachine(c: Campaign, id: string, slot: number, rotation = 0, shop = c.expansion.activeShop) {
  const machine = c.expansion.machines[id];
  if (
    !machine ||
    !c.expansion.shops[shop] ||
    c.status === "open" ||
    !Number.isInteger(slot) ||
    !Number.isFinite(rotation) ||
    slot < 0 ||
    slot >= machineSlots(c, shop)
  )
    return false;
  if (installed(c, shop).some(([key]) => key !== id && machineModel(key) === machineModel(id))) return false;
  const other = installed(c, shop).find(([key, m]) => key !== id && m.slot === slot);
  if (other) {
    other[1].slot = machine.slot;
    other[1].shop = machine.shop;
  }
  machine.shop = shop;
  machine.slot = Math.floor(slot);
  machine.rotation = ((rotation % 4) + 4) % 4;
  return true;
}
export function walkSeconds(c: Campaign, from: Station, to: Station) {
  if (from === to) return 0;
  const layout = c.expansion.shops[c.expansion.activeShop].layout,
    [a, b] = [layout[from], layout[to]];
  return (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])) * 0.11;
}
export function staffOnDuty(c: Campaign, shop = c.expansion.activeShop) {
  return c.expansion.staff.filter((s) => s.shop === shop && s.rota[(c.day - 1) % 7] && s.energy > 5);
}
export function staffGrade(staff: StaffState, station: Station) {
  const traits = TRAITS.filter((t) => staff.traits.includes(t.id));
  return Math.min(
    96,
    72 + staff.skills[station] * 4 + traits.reduce((n, t) => n + t.grade, 0) - Math.max(0, 35 - staff.energy) / 5,
  );
}
export function staffSpeed(staff: StaffState) {
  return (
    Math.max(0.55, staff.energy / 100) *
    TRAITS.filter((t) => staff.traits.includes(t.id)).reduce((n, t) => n * t.speed, 1)
  );
}
export function candidates(c: Campaign) {
  const unlocked = CREW_ROLES.filter((r) => r.day <= c.day);
  // Nobody is offered before the first role opens: hire() would refuse them.
  if (!unlocked.length) return [];
  const storyGuests = GUESTS.filter(
    (g) =>
      (c.expansion.visits[g.id] ?? 0) >= 5 &&
      !c.expansion.staff.some((s) => s.portrait === g.id) &&
      unlocked.some((r) => r.id === g.role),
  );
  const result = [0, 1, 2].map((i) =>
    createStaff(
      unlocked[(c.day + i) % Math.max(1, unlocked.length)]?.id ?? "host",
      c.day * 3 + i,
      c.expansion.activeShop,
    ),
  );
  for (const [i, g] of storyGuests.slice(0, 3).entries())
    result[i] = createStaff(g.role, c.day * 3 + i, c.expansion.activeShop, g.id);
  return result;
}
export function hire(c: Campaign, candidate: StaffState) {
  const role = CREW_ROLES.find((r) => r.id === candidate.role);
  if (!role || role.day > c.day || c.expansion.staff.some((s) => s.id === candidate.id) || c.status === "open")
    return false;
  if (c.cash < role.hire) return false;
  c.cash -= role.hire;
  c.expansion.staff.push(structuredClone(candidate));
  if (["host", "prep", "runner", "manager"].includes(candidate.role) && !c.crew.includes(candidate.role as CrewId))
    c.crew.push(candidate.role as CrewId);
  return true;
}
export function assignStaff(c: Campaign, id: string, station: Station | null, shop = c.expansion.activeShop) {
  const person = c.expansion.staff.find((s) => s.id === id),
    role = CREW_ROLES.find((r) => r.id === person?.role);
  if (!person || !role || !c.expansion.shops[shop] || (station && !role.stations.includes(station))) return false;
  person.station = station;
  person.shop = shop;
  if (person.role === "manager") c.expansion.shops[shop].manager = id;
  return true;
}
export function staffTea(c: Campaign, id: string) {
  const person = c.expansion.staff.find((s) => s.id === id);
  if (!person || c.cash < 120) return false;
  c.cash -= 120;
  person.energy = Math.min(100, person.energy + 40);
  return true;
}
export function trainWitness(c: Campaign, station: Station, grade: number) {
  if (grade < 98) return;
  const staff = staffOnDuty(c).filter((s) => s.station === station),
    trainer = staffOnDuty(c).some((s) => s.role === "trainer");
  for (const s of staff) {
    s.progress[station] += trainer ? 16 : 8;
    if (s.progress[station] >= 100 && s.skills[station] < 5) {
      s.skills[station]++;
      s.progress[station] -= 100;
    }
  }
}
export function wage(person: StaffState) {
  const role = CREW_ROLES.find((r) => r.id === person.role)!;
  return Math.round(role.wage * (1 + (Math.max(...Object.values(person.skills)) - 1) * 0.12));
}
export function payroll(c: Campaign) {
  let amount = 0;
  for (const person of c.expansion.staff) {
    if (person.rota[(c.day - 1) % 7]) {
      amount += wage(person);
      person.energy = Math.max(0, person.energy - 12);
      person.shifts++;
      person.paidDays.push(c.day);
      person.paidDays = person.paidDays.slice(-14);
      if (person.station) {
        person.progress[person.station] += 10;
        if (person.progress[person.station] >= 100 && person.skills[person.station] < 5) {
          person.skills[person.station]++;
          person.progress[person.station] -= 100;
        }
      }
    } else person.energy = Math.min(100, person.energy + 45);
  }
  return amount;
}
export function rentDue(c: Campaign) {
  const base = 1800 + Math.min(4000, c.day * 18);
  return Math.round(
    (base +
      Object.entries(c.expansion.shops).reduce(
        (sum, [id, state]) => sum + (SHOPS.find((s) => s.id === id)?.rent ?? 0) * (1 + state.expansion * 0.12),
        0,
      )) *
      TUNING[c.mode].rent,
  );
}
/** The rent that will be charged on the coming rent day, quoted at that day's rate. */
export function rentOnDueDay(c: Campaign) {
  const due = Math.ceil(c.day / 7) * 7;
  return rentDue({ ...c, day: due } as Campaign);
}
export function takeLoan(c: Campaign) {
  if (c.day < 7 || c.expansion.loan > 0 || c.status === "open") return false;
  c.expansion.loan = 10000;
  c.cash += 10000;
  c.expansion.loanInterest = 500;
  return true;
}
export function repayLoan(c: Campaign, amount = 1000) {
  const paid = Math.min(amount, c.expansion.loan, c.cash);
  if (paid <= 0) return false;
  c.cash -= paid;
  c.expansion.loan -= paid;
  c.expansion.loanInterest = Math.ceil(c.expansion.loan * 0.05);
  return true;
}
export function buyDecor(c: Campaign, id: string) {
  const item = DECOR.find((d) => d.id === id);
  if (
    !item ||
    item.day > c.day ||
    item.kind === "keepsake" ||
    c.cash < item.price ||
    c.expansion.decor.includes(id) ||
    c.status === "open"
  )
    return false;
  c.cash -= item.price;
  c.expansion.decor.push(id);
  if (item.kind === "print") c.expansion.prints.push(id);
  return true;
}
export function placeDecor(c: Campaign, id: string, x: number, y: number, rotation = 0) {
  if (c.status === "open" || (!c.expansion.decor.includes(id) && !c.expansion.keepsakes.includes(id))) return false;
  const shop = c.expansion.shops[c.expansion.activeShop],
    definition = SHOPS.find((s) => s.id === c.expansion.activeShop)!;
  if (x < 0 || y < 0 || x >= definition.layout.width || y >= definition.layout.height) return false;
  shop.decor = shop.decor.filter((p) => p.id !== id);
  shop.decor.push({ id, x: Math.floor(x), y: Math.floor(y), rotation: rotation % 4 });
  return true;
}
export function comfort(c: Campaign) {
  return Math.min(
    0.5,
    c.expansion.shops[c.expansion.activeShop].decor.reduce(
      (n, p) => n + (DECOR.find((d) => d.id === p.id)?.comfort ?? 0) * 0.008,
      0,
    ),
  );
}
export function style(c: Campaign) {
  return Math.min(
    0.6,
    c.expansion.shops[c.expansion.activeShop].decor.reduce(
      (n, p) => n + (DECOR.find((d) => d.id === p.id)?.style ?? 0) * 0.008,
      0,
    ),
  );
}
export function setLoadout(c: Campaign, slot: number, id: string) {
  if (
    c.status === "open" ||
    slot < 0 ||
    slot >= (rankFor(c) >= 30 ? 6 : 5) ||
    !POWERUPS.some((p) => p.id === id && p.day <= c.day)
  )
    return false;
  const previous = c.expansion.loadout.indexOf(id);
  if (previous >= 0) c.expansion.loadout[previous] = c.expansion.loadout[slot];
  c.expansion.loadout[slot] = id;
  return true;
}
export function buyPower(c: Campaign, id: string) {
  const item = POWERUPS.find((p) => p.id === id);
  if (!item || item.day > c.day || c.cash < item.price || c.status === "open") return false;
  c.cash -= item.price;
  c.expansion.powerups[id] = (c.expansion.powerups[id] ?? 0) + 1;
  return true;
}
export function selectGoal(c: Campaign, id: string) {
  const item = GOALS.find((g) => g.id === id);
  if (!item || item.day > c.day || c.status === "open") return false;
  const found = c.expansion.selectedGoals.includes(id);
  if (found) c.expansion.selectedGoals = c.expansion.selectedGoals.filter((g) => g !== id);
  else if (!goalScaleOpen(c, item.scale)) return false;
  else if (c.expansion.selectedGoals.length < 6) c.expansion.selectedGoals.push(id);
  else return false;
  return true;
}
/** Promotions, from day 3: the first days are for learning the counter. */
export const MARKETING = [
  { id: "flyers", name: "flyers", price: 180, arrivals: 1.2, tips: 1, day: 3 },
  { id: "radio", name: "radio spot", price: 360, arrivals: 1.4, tips: 1, day: 3 },
  { id: "loyalty", name: "loyalty cards", price: 240, arrivals: 1.1, tips: 1.45, day: 3 },
  { id: "display", name: "window display", price: 160, arrivals: 1.1, tips: 1.2, day: 3 },
];
export function bookMarketing(c: Campaign, id: string) {
  const item = MARKETING.find((m) => m.id === id);
  if (!item || item.day > c.day || c.status === "open" || c.cash < item.price || c.expansion.marketing) return false;
  c.cash -= item.price;
  c.expansion.marketing = id;
  return true;
}
export function setPrice(c: Campaign, family: string, price: number) {
  if (c.status === "open" || !FAMILIES.some((f) => f.id === family) || ![0, 1, 2].includes(price)) return false;
  c.expansion.prices[family] = price;
  return true;
}
