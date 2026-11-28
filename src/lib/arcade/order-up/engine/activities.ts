import type { Campaign } from "../../orders-campaign.ts";
import { INGREDIENTS, INGREDIENT_BY_ID, SHOPS, RECIPES, DECOR } from "../content/index.ts";
import { useStock, addStock, stock } from "./pantry.ts";
import { calendar } from "./calendar.ts";
import { metric } from "./progression.ts";
import { hash } from "./random.ts";
import { TUNING } from "./tuning.ts";
import { GARDEN_FEATURE } from "../content/service-program.ts";
import { treeChoiceOpen } from "./opened.ts";
import { hasNode } from "./tree-nodes.ts";
export interface Activity {
  kind: "delivery" | "chore" | "tasteoff" | "batch" | "garden" | "lab";
  elapsed: number;
  duration: number;
  progress: number;
  grade: number;
  done: boolean;
  target: string;
  cursor: number;
  balance: number;
  spilled: number;
  actions: number;
  hits: number[];
  round: number;
  reward: number;
}
export function startActivity(kind: Activity["kind"], target = "", round = 0): Activity {
  return {
    kind,
    elapsed: 0,
    duration: kind === "delivery" ? 12 : kind === "chore" ? 10 : kind === "tasteoff" ? 9 : 3,
    progress: 0,
    grade: 0,
    done: false,
    target,
    cursor: 0.5,
    balance: 0,
    spilled: 0,
    actions: 0,
    hits: [],
    round,
    reward: 0,
  };
}
export function tickActivity(a: Activity, dt: number, mode: "normal" | "expert", steering = 0) {
  if (a.done || !Number.isFinite(dt) || dt <= 0) return a;
  dt = Math.min(0.1, dt);
  a.elapsed += dt;
  a.progress = Math.min(1, a.elapsed / a.duration);
  if (a.kind === "delivery") {
    const bump = Math.sin(a.elapsed * 2.3) * 0.36 + Math.sin(a.elapsed * 5.1) * 0.13;
    a.balance += (bump + steering * 0.9 - a.balance * 0.65) * dt;
    if (Math.abs(a.balance) > TUNING[mode].deliveryTolerance)
      a.spilled += dt * 12 * (Math.abs(a.balance) - TUNING[mode].deliveryTolerance);
    a.cursor = (a.balance + 1) / 2;
  } else if (a.kind === "chore") a.cursor = (Math.sin(a.elapsed * 2.5) + 1) / 2;
  else if (a.kind === "tasteoff") a.cursor = (Math.sin(a.elapsed * (2.1 + a.round * 0.4)) + 1) / 2;
  if (a.progress >= 1) {
    a.done = true;
    a.grade =
      a.kind === "delivery"
        ? Math.max(0, Math.round(100 - a.spilled * 10))
        : Math.round(a.hits.length ? a.hits.reduce((n, x) => n + x, 0) / a.hits.length : 0);
  }
  return a;
}
export function actActivity(a: Activity, value = 0.5) {
  if (a.done) return false;
  a.actions++;
  if (a.kind === "chore") {
    a.hits.push(Math.max(0, 100 - Math.abs(a.cursor - value) * 130));
    a.grade = Math.round(a.hits.reduce((n, x) => n + x, 0) / a.hits.length);
  } else if (a.kind === "tasteoff") {
    a.hits.push(Math.max(0, Math.round(100 - Math.abs(a.cursor - 0.5) * 220)));
    if (a.hits.length >= 3) {
      a.done = true;
      a.grade = Math.round(a.hits.reduce((n, x) => n + x, 0) / 3);
    }
  } else a.hits.push(Math.max(0, 100 - Math.abs(value - 0.5) * 180));
  return true;
}
export function finishChore(c: Campaign, a: Activity) {
  if (
    a.kind !== "chore" ||
    !a.done ||
    a.actions < 3 ||
    a.reward ||
    c.expansion.metrics["chore-" + c.day + "-" + a.target]
  )
    return false;
  c.expansion.metrics["chore-" + c.day + "-" + a.target] = 1;
  const machine = c.expansion.machines[a.target];
  if (machine) {
    const part = c.expansion.workshop.parts["brew-coupling"] ?? 0;
    const spare = hasNode(c, "back-spares-bin", machine.shop) && part > 0 && (machine.broken || machine.condition < 45);
    if (spare) {
      if (part === 1) delete c.expansion.workshop.parts["brew-coupling"];
      else c.expansion.workshop.parts["brew-coupling"] = part - 1;
    }
    machine.condition = Math.min(100, machine.condition + 25 + a.grade * 0.45 + (spare ? 20 : 0));
    machine.broken = false;
  } else if (a.target === "till") c.cash += Math.round(a.grade * 0.8);
  else if (a.target === "mop") for (const person of c.expansion.staff) person.energy = Math.min(100, person.energy + 5);
  a.reward = 1;
  metric(c, "chores");
  c.xp += 10;
  return true;
}
const GOOD_PAIRS = [
  ["oolong", "peach"],
  ["jasmine", "lychee-fruit"],
  ["matcha", "red-bean"],
  ["hojicha", "oat"],
  ["coconut-milk", "mango"],
  ["black", "brown-sugar"],
  ["thai-tea", "condensed"],
  ["butterfly-pea", "lemon"],
  ["coffee", "condensed"],
  ["rose-tea", "lychee-fruit"],
  ["taro", "coconut-milk"],
  ["black-sesame", "soy"],
];
const BAD_PAIRS = [
  ["lemon", "milk"],
  ["lime", "foam-base"],
  ["grapefruit", "milk"],
  ["coffee", "watermelon"],
  ["black-sesame", "grapefruit"],
];
/** Kept in the rules, not shown to the player: infer this table from three faces. */
export function flavorGrades(ids: string[]) {
  const unique = [...new Set(ids)].filter((id) => INGREDIENT_BY_ID[id]);
  if (unique.length < 2) return [0, 0, 0];
  let grade = 66;
  for (const pair of GOOD_PAIRS) if (pair.every((id) => unique.includes(id))) grade += 23;
  for (const pair of BAD_PAIRS) if (pair.every((id) => unique.includes(id))) grade -= 35;
  const groups = new Set(unique.map((id) => INGREDIENT_BY_ID[id].group));
  if (groups.size > 2) grade += 5;
  const tags = unique.flatMap((id) => INGREDIENT_BY_ID[id].pairTags);
  if (tags.filter((t) => t === "floral").length >= 2) grade += 9;
  if (tags.filter((t) => t === "earthy").length >= 2) grade += 9;
  return [0, 1, 2].map((i) => Math.max(0, Math.min(100, grade + ((hash(unique.join("|") + i) % 13) - 6))));
}
export function tasteBlend(c: Campaign, ids: string[]) {
  if (
    new Set(ids).size !== ids.length ||
    c.status === "open" ||
    ids.length < 2 ||
    ids.length > 4 ||
    ids.some((id) => !INGREDIENT_BY_ID[id] || INGREDIENT_BY_ID[id].day > c.day || stock(c, id) < 1)
  )
    return null;
  for (const id of ids) useStock(c, id, 1);
  return recordBlend(c, ids);
}

function recordBlend(c: Campaign, ids: string[]) {
  const grades = flavorGrades(ids);
  c.expansion.labHistory.push({ ingredients: [...ids], grades });
  c.expansion.labHistory = c.expansion.labHistory.slice(-30);
  const key = [...ids].sort().join("+");
  if (grades.reduce((n, x) => n + x, 0) / 3 >= 82 && !c.expansion.pairings.includes(key)) {
    c.expansion.pairings.push(key);
    c.expansion.houseBlend = [...ids];
    c.xp += 75;
    metric(c, "pairings");
    const print = DECOR.filter((d) => d.kind === "print")[(c.expansion.pairings.length - 1) % 30].id;
    if (!c.expansion.prints.includes(print)) c.expansion.prints.push(print);
  }
  return grades;
}

export function developGardenBlend(c: Campaign) {
  const state = c.expansion.gardenFeature;
  const [, peach] = GARDEN_FEATURE.pairing;
  if (
    c.status !== "planning" || !treeChoiceOpen(c, "menu-garden-oolong") ||
    state.developed || state.sampleUntil <= c.day || stock(c, peach) < 1
  ) return null;
  useStock(c, peach, 1);
  state.sampleUntil = 0;
  const grades = recordBlend(c, [...GARDEN_FEATURE.pairing]);
  state.developed = grades.reduce((sum, grade) => sum + grade, 0) / grades.length >= 82;
  return grades;
}
export function plant(c: Campaign, plot: number, id: string) {
  const ingredient = INGREDIENT_BY_ID[id],
    p = c.expansion.garden[plot];
  if (
    !c.expansion.shops.garden ||
    c.status === "open" ||
    !p ||
    p.ingredient ||
    !ingredient ||
    !["fruit", "tea"].includes(ingredient.group) ||
    ingredient.day > c.day ||
    c.cash < 60
  )
    return false;
  c.cash -= 60;
  p.ingredient = id;
  p.planted = c.day;
  p.watered = 0;
  p.growth = 0;
  return true;
}
export function water(c: Campaign, plot: number) {
  const p = c.expansion.garden[plot];
  if (!p?.ingredient || p.watered === c.day || c.status === "open") return false;
  p.watered = c.day;
  p.growth = Math.min(3, p.growth + 1);
  metric(c, "watering");
  return true;
}
export function harvest(c: Campaign, plot: number, reserveSample = false) {
  const p = c.expansion.garden[plot];
  if (!p?.ingredient || p.growth < 3 || c.status === "open") return false;
  const feature = c.expansion.gardenFeature;
  if (reserveSample && (
    c.status !== "planning" || p.ingredient !== GARDEN_FEATURE.tea || !treeChoiceOpen(c, "tea-garden-oolong") ||
    feature.sampleUntil > c.day || feature.developed
  )) return false;
  const ingredient = INGREDIENT_BY_ID[p.ingredient],
    quantity = ingredient.season === calendar(c.day).season.id || ingredient.season === "all" ? 12 : 6;
  const added = addStock(c, p.ingredient, quantity - Number(reserveSample), 2);
  if (!added && !reserveSample) return false;
  if (reserveSample) feature.sampleUntil = c.day + GARDEN_FEATURE.sampleDays;
  c.expansion.garden[plot] = { ingredient: null, planted: 0, watered: 0, growth: 0 };
  metric(c, "harvests");
  c.xp += 30;
  return true;
}
export function growGarden(c: Campaign) {
  for (const p of c.expansion.garden) if (p.ingredient && p.watered === c.day) p.growth = Math.min(3, p.growth + 0.5);
}
export function makePearlBatch(c: Campaign, grade: number) {
  const small = hasNode(c, "prep-portion-tray");
  const bath = hasNode(c, "prep-hold-bath");
  if (small && c.expansion.pearls > 0) return false;
  if (!useStock(c, "pearls", small ? 2 : 4)) return false;
  c.expansion.pearls += small ? 5 : bath ? 14 : hasNode(c, "prep-batch-pot") ? 10 : 8;
  if (bath) c.expansion.metrics["warm-pearls-day"] = c.day;
  c.expansion.freshness = grade / 100;
  metric(c, "batches");
  return true;
}
export function planRoute(c: Campaign, to: string, ingredient: string, quantity = 8) {
  const contract = hasNode(c, "contract-neighbor-supply") && calendar(c.day).event.arrival >= 1.2;
  const load = quantity + (contract ? 4 : 0);
  if (
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    load > 100 ||
    !c.expansion.shops.commissary ||
    !c.expansion.shops[to] ||
    to === "commissary" ||
    c.status === "open" ||
    !INGREDIENT_BY_ID[ingredient] ||
    stock(c, ingredient) -
      c.expansion.routes
        .filter((r) => r.ingredient === ingredient && r.progress < 1)
        .reduce((n, r) => n + r.quantity, 0) <
      load ||
    c.expansion.routes.filter((r) => r.progress < 1).length >= 12
  )
    return false;
  c.expansion.routes.push({ to, ingredient, quantity: load, day: c.day, progress: 0, ...(contract ? { priority: true } : {}) });
  return true;
}
export function deliverRoute(c: Campaign, a: Activity) {
  if (!a.done || a.kind !== "delivery" || a.reward) return false;
  // Two loads can go to one shop: deliver one that the pantry can fill.
  const open = c.expansion.routes.filter((r) => r.progress < 1 && r.to === a.target);
  const route = open.find((r) => stock(c, r.ingredient) >= r.quantity) ?? open[0];
  if (!route || !useStock(c, route.ingredient, route.quantity)) return false;
  route.progress = 1;
  // A commissary shipment is sold through its destination from the same pantry.
  const sales = Math.round(route.quantity * (INGREDIENT_BY_ID[route.ingredient].price * 2 + 90) *
    (a.grade / 100) * (route.priority && route.day === c.day ? 1.25 : 1));
  c.cash += sales;
  a.reward = Math.max(1, sales);
  metric(c, "deliveries");
  c.xp += 40;
  return true;
}
export function runnerDelivery(c: Campaign, to: string) {
  const runner = c.expansion.staff.find((s) => s.role === "courier" && s.rota[(c.day - 1) % 7]);
  if (
    !runner ||
    c.cash < 100 ||
    !c.expansion.routes.some((r) => r.to === to && r.progress < 1 && stock(c, r.ingredient) >= r.quantity)
  )
    return false;
  const a = startActivity("delivery", to);
  a.done = true;
  a.grade = 80 + Math.max(...Object.values(runner.skills)) * 3;
  // The courier is paid only for a load that went.
  if (!deliverRoute(c, a)) return false;
  c.cash -= 100;
  return true;
}
export function finishTasteoff(c: Campaign, a: Activity) {
  if (!a.done || a.kind !== "tasteoff" || a.reward || c.day < 8 || c.expansion.tasteoffDay === c.day) return null;
  const rival = 72 + Math.min(15, Math.floor(c.day / 14)) + a.round * 2;
  const won = a.grade >= rival;
  a.reward = won ? 600 + a.round * 250 : 1;
  c.expansion.tasteoffDay = c.day;
  c.xp += won ? 100 : 30;
  if (won) {
    c.cash += a.reward;
    c.expansion.rivalWins++;
    metric(c, "tasteoffs");
    c.expansion.tournamentRound = (c.expansion.tournamentRound + 1) % 4;
  }
  return { won, rival, grade: a.grade };
}
export function adoptCat(c: Campaign) {
  if (c.expansion.cat || !useStock(c, "milk", 1)) return false;
  c.expansion.cat = true;
  metric(c, "cat");
  return true;
}
export function recovery(c: Campaign) {
  if (c.status !== "closed") return false;
  c.expansion.recoveries++;
  c.cash += 3000;
  c.expansion.loan += 3000;
  c.expansion.loanInterest = Math.ceil(c.expansion.loan * 0.05);
  c.status = "planning";
  for (const id of ["black", "milk", "brown-sugar"]) addStock(c, id, 8);
  return true;
}
