import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { newCampaign } from "../src/lib/arcade/orders-campaign.ts";
import { INGREDIENTS, INGREDIENT_BY_ID, SKILLS } from "../src/lib/arcade/order-up/content/index.ts";
import { acceptChange, giveWaitEstimate, keepOriginal, offerGardenFeature, rememberUsual } from "../src/lib/arcade/order-up/engine/guest-actions.ts";
import { bookMarketing, buyDecor, buyMachine, buyShop, candidates, placeDecor, hire, selectGoal, selectShop, setPrice, staffTea } from "../src/lib/arcade/order-up/engine/management.ts";
import { addStock, buyPantry, stock } from "../src/lib/arcade/order-up/engine/pantry.ts";
import { actActivity, finishChore, makePearlBatch, startActivity, tickActivity } from "../src/lib/arcade/order-up/engine/activities.ts";
import { calendar } from "../src/lib/arcade/order-up/engine/calendar.ts";
import { command } from "../src/lib/arcade/order-up/engine/commands.ts";
import { hash, random } from "../src/lib/arcade/order-up/engine/random.ts";
import { createStaff } from "../src/lib/arcade/order-up/engine/state.ts";
import { BREW_MODS, upgradeNode } from "../src/lib/arcade/order-up/content/upgrades.ts";
import { TREE_NODES } from "../src/lib/arcade/order-up/content/progression-trees.ts";
import { hasNode } from "../src/lib/arcade/order-up/engine/tree-nodes.ts";
import { drinkPriceFactors } from "../src/lib/arcade/order-up/engine/receipts.ts";
import { chooseMod, craftPart, unlockUpgrade } from "../src/lib/arcade/order-up/engine/upgrades.ts";
import {
  beginWork,
  currentSkill,
  feedCat,
  finishSkill,
  handoff,
  inspectUsual,
  pickCup,
  pickTicket,
  satisfaction,
  settleShift,
  skillAction,
  shooGull,
  startShift,
  tickShift,
  wakeGuest,
} from "../src/lib/arcade/order-up/engine/shift.ts";

const FRAME = 0.1;
const SKILL_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]));
export const SEEDS = [1, 2, 3, 4, 5, 6];
export const SCENARIOS = [
  { id: "rush", day: 55 },
  { id: "quiet", day: 67 },
  { id: "expert", day: 55, mode: "expert" },
  { id: "rush-crew", day: 55, crew: true },
  { id: "expert-crew", day: 55, mode: "expert", crew: true },
  { id: "short-cash", day: 35, budget: 4_000 },
  { id: "outage", day: 31 },
];
const COUNTERS = {
  brew: ["preset-kettle", "auto-milk", "water-filter"],
  prep: ["pearl-cooker", "slicer", "foam-whipper"],
  build: ["auto-toppings", "fructose-pump", "blender"],
  serve: ["auto-sealer", "shaking-machine", "straw-dispenser"],
  front: ["jukebox", "umbrella-stand", "order-kiosk"],
  back: ["pantry-shelves", "cold-storage", "tip-jar"],
};
const PANTRY = {
  black: 45, milk: 45, pearls: 36, jasmine: 24, oat: 18, "brown-sugar": 21, taro: 16,
  strawberry: 14, mango: 12, banana: 12, popping: 10, honey: 8, pudding: 8,
};

export function makeCampaign(scenario) {
  const campaign = newCampaign(scenario.mode ?? "normal");
  campaign.day = scenario.day;
  campaign.xp = 25_000;
  campaign.cash = scenario.budget ?? 100_000;
  campaign.inventory = [];
  for (const [id, amount] of Object.entries(PANTRY)) addStock(campaign, id, amount);
  for (const ingredient of INGREDIENTS)
    if (ingredient.day <= campaign.day && !Object.hasOwn(PANTRY, ingredient.id))
      addStock(campaign, ingredient.id, 2);
  if (scenario.crew) {
    campaign.expansion.staff = ["barista", "prep", "runner"].map((role, i) => {
      const person = createStaff(role, i + 1);
      person.rota.fill(true);
      return person;
    });
  }
  return campaign;
}

function prepareTier(campaign, counter, tier) {
  const machines = COUNTERS[counter] ?? [];
  // Spread an affordable budget across the counter before raising individual tiers.
  for (let t = 1; t <= tier; t++)
    for (const id of machines)
      if ((campaign.expansion.machines[id]?.tier ?? 0) === t - 1)
        buyMachine(campaign, id);
  return machines.map((id) => campaign.expansion.machines[id]?.tier ?? 0).join("/");
}

export function runShift(campaign, seed, {
  hitRate = 0.88,
  hitGrade = 98,
  missGrade = 60,
  manualTime = 1,
  strategy,
  usuals,
} = {}) {
  const date = new Date(Date.UTC(2026, 0, seed)).toISOString().slice(0, 10);
  const since = campaign.cash;
  const shift = startShift(campaign, date);
  const eligibleSince = new WeakMap();
  const retired = new Set();
  const featureTickets = new Set();
  let guestsLost = 0;
  let serviceSeconds = 0;
  let work = null;

  while (shift.status !== "complete" && shift.realElapsed < shift.duration + 26) {
    const now = shift.realElapsed;
    const tickets = shift.tickets.filter(Boolean).sort((a, b) => a.patience - b.patience);
    const arrivalTimes = new Map(tickets.map((ticket) => [ticket.id, ticket.arrived]));
    const receiptsBefore = shift.receipts.length;
    if (shift.gull.active) shooGull(campaign, shift);

    for (const ticket of tickets) {
      if (ticket.sleeping) wakeGuest(shift, ticket.slot);
      if (ticket.changeTo) {
        if (strategy === "speed" && ticket.cups.some((cup) => cup.step >= 2))
          keepOriginal(campaign, shift, ticket.slot);
        else acceptChange(campaign, shift, ticket.slot);
      }
      if (ticket.special === "cat") {
        pickTicket(campaign, shift, ticket.slot);
        if (feedCat(campaign, shift, ticket.slot)) retired.add(ticket.id);
      }
      if (ticket.usual && !ticket.revealed) {
        pickTicket(campaign, shift, ticket.slot);
        const remembered = usuals?.get(ticket.memoryGuest ?? ticket.guest);
        if (!remembered || remembered !== ticket.recipe || !rememberUsual(campaign, shift, remembered, ticket.slot))
          inspectUsual(shift);
      }
      if (strategy === "quality" && shift.elapsed - ticket.arrived >= 0.35 && offerGardenFeature(campaign, shift, ticket.slot))
        featureTickets.add(ticket.id);
      if (strategy === "regulars") giveWaitEstimate(campaign, shift, ticket.slot);
      if (ticket.cups.every((cup) => cup.ready) && (ticket.pickupAt ?? 0) <= shift.elapsed)
        handoff(campaign, shift, ticket.slot);
    }

    if (work) {
      const { ticket, cup, run, end } = work;
      if (shift.tickets[ticket.slot] !== ticket || cup.run !== run) work = null;
      else if (now >= end && cup.warmup <= 0) {
        // Key each skill roll by the order, cup and step so automation does not consume bot RNG.
        const roll = random(hash(`${seed}:${ticket.id}:${ticket.cups.indexOf(cup)}:${cup.step}`)).value;
        if (run.variant === "quick") skillAction(campaign, shift, { type: "quick" }, ticket.slot);
        else if (run.id === "topping-ladle") {
          for (const id of roll < hitRate ? run.wanted : run.wanted.slice(1))
            skillAction(campaign, shift, { type: "add", id }, ticket.slot);
          skillAction(campaign, shift, { type: "done" }, ticket.slot);
        } else if (run.choices.length) {
          const index = roll < hitRate ? run.knobTarget : (run.knobTarget + 1) % run.choices.length;
          skillAction(campaign, shift, { type: "choose", index }, ticket.slot);
        }
        else {
          run.grade = roll < hitRate ? hitGrade : missGrade;
          run.finished = true;
          run.result = "simulated input";
          finishSkill(campaign, shift, ticket, cup);
        }
        work = null;
      }
    }

    if (!work) {
      for (const ticket of tickets) {
        if (shift.tickets[ticket.slot] !== ticket) continue;
        const index = ticket.cups.findIndex((cup) => {
          const skill = currentSkill(cup);
          if (!skill || cup.ready || cup.run) return false;
          if (eligibleSince.get(cup)?.skill !== skill || eligibleSince.get(cup)?.step !== cup.step)
            eligibleSince.set(cup, { skill, step: cup.step, time: now });
          return now - eligibleSince.get(cup).time >= 0.4;
        });
        if (index < 0) continue;
        pickTicket(campaign, shift, ticket.slot);
        pickCup(campaign, shift, index);
        if (beginWork(campaign, shift, ticket.slot, index)) {
          const cup = ticket.cups[index];
          if (cup.run) {
            const { seconds, target } = SKILL_BY_ID.get(cup.run.id);
            const inputTime = cup.run.variant === "quick" ? 0.3 :
              cup.run.id === "topping-ladle" ? 0.25 * (cup.run.wanted.length + 1) :
                cup.run.choices.length ? 0.55 : Math.min(seconds - 0.15, seconds * target * manualTime);
            work = { ticket, cup, run: cup.run, end: now + cup.warmup + inputTime / cup.run.speed };
          }
        }
        break;
      }
    }

    tickShift(campaign, shift, FRAME);
    const newReceipts = shift.receipts.slice(receiptsBefore);
    for (const receipt of newReceipts)
      serviceSeconds += receipt.time - (arrivalTimes.get(receipt.ticket) ?? receipt.time);
    if (usuals)
      for (const receipt of newReceipts)
        if (!receipt.special && !featureTickets.has(receipt.ticket)) usuals.set(receipt.guest, receipt.recipe);
    const served = new Set(newReceipts.map((receipt) => receipt.ticket));
    for (const ticket of tickets)
      if (shift.tickets[ticket.slot] !== ticket && !served.has(ticket.id) && !retired.has(ticket.id))
        guestsLost++;
    retired.clear();
  }

  const report = settleShift(campaign, shift);
  if (!report) throw new Error("The simulation did not complete its shift.");
  return {
    cupsPerMinute: 60 * report.served / shift.realElapsed,
    grade: report.served ? report.points / report.served : null,
    satisfaction: satisfaction(report.points, report.served, report.lost),
    guestsLost,
    cupsLost: report.lost,
    cash: campaign.cash,
    cashDelta: campaign.cash - since,
    brewCondition: averageCondition(campaign),
    cups: report.served,
    points: report.points,
    ...qualitySales(campaign, shift, featureTickets),
    serviceSeconds: report.served ? serviceSeconds / report.served : null,
  };
}

function qualitySales(campaign, shift, featureTickets) {
  const sales = { featureCups: 0, housePremiumCups: 0, housePremiumCash: 0, menuPremiumCash: 0, precisionPremiumCash: 0 };
  for (const receipt of shift.receipts) {
    const feature = featureTickets.has(receipt.ticket);
    if (feature) sales.featureCups++;
    const factors = drinkPriceFactors(campaign, shift.shop, receipt, feature);
    // Isolate each adjustment from the settled receipt. Backing out multipliers
    // from a rounded price can differ from the unrounded accounting by a cent.
    const beforeHouseTea = Math.round(receipt.price / factors.houseTea);
    const beforePrecision = Math.round(beforeHouseTea / factors.precision);
    if (factors.houseTea > 1) sales.housePremiumCups++;
    sales.housePremiumCash += receipt.price - beforeHouseTea;
    sales.precisionPremiumCash += beforeHouseTea - beforePrecision;
    sales.menuPremiumCash += beforePrecision - Math.round(beforePrecision / factors.menuPrice)
      + receipt.tip - Math.round(receipt.tip / factors.menuTip);
  }
  return sales;
}

function averageCondition(campaign) {
  const machines = Object.entries(campaign.expansion.machines)
    .filter(([id, machine]) => machine.shop === campaign.expansion.activeShop && COUNTERS.brew.includes(id.split("::").at(-1)))
    .map(([, machine]) => machine);
  return machines.length
    ? machines.reduce((sum, machine) => sum + machine.condition, 0) / machines.length
    : null;
}

export function average(rows) {
  return Object.fromEntries(Object.keys(rows[0]).map((key) => {
    const values = rows.map((row) => row[key]).filter((value) => value !== null);
    return [key, values.length ? values.reduce((total, value) => total + value, 0) / values.length : null];
  }));
}

function baseline({ seeds, ...bot }) {
  const rows = [];
  for (const scenario of SCENARIOS) {
    for (const counter of ["manual", ...Object.keys(COUNTERS)]) {
      for (const tier of counter === "manual" ? [0] : [1, 2, 3]) {
        let fitted, spent;
        const results = seeds.map((seed) => {
          const campaign = makeCampaign(scenario);
          const before = campaign.cash;
          fitted = prepareTier(campaign, counter, tier);
          spent = before - campaign.cash;
          return runShift(campaign, seed, bot);
        });
        rows.push({ scenario: scenario.id, counter, tier, fitted, spent, ...average(results) });
      }
    }
  }
  return rows;
}

function makeParts(campaign, required) {
  if (Object.keys(required).length && !campaign.expansion.workshop.brewBench && !unlockUpgrade(campaign, "brew-bench"))
    return false;
  // Build assemblies before the shared components they can consume.
  const parts = Object.entries(required).sort(([a], [b]) => upgradeNode(b).cost - upgradeNode(a).cost);
  for (const [part, quantity] of parts) {
    while ((campaign.expansion.workshop.parts[part] ?? 0) < quantity)
      if (!makeParts(campaign, upgradeNode(part).partsConsumed) || !craftPart(campaign, part)) return false;
  }
  return true;
}

function fitBrew(campaign, id) {
  const mod = upgradeNode(id);
  const station = campaign.expansion.workshop.brew[campaign.expansion.activeShop];
  if (!station?.unlocked.includes(id) && (!makeParts(campaign, mod.partsConsumed) || !unlockUpgrade(campaign, id))) return false;
  return chooseMod(campaign, id);
}

const BREW_SCENARIOS = [...SCENARIOS, { id: "premium-menu", day: 67, premiumMenu: true }];
const OBJECTIVES = {
  rush: "cupsPerMinute",
  quiet: "grade",
  expert: "satisfaction",
  "rush-crew": "cupsPerMinute",
  "expert-crew": "satisfaction",
  "short-cash": "cashDelta",
  "premium-menu": "cashDelta",
  outage: "cupsPerMinute",
};
const DIRECTIONS = { cupsPerMinute: 1, grade: 1, satisfaction: 1, guestsLost: -1, cashDelta: 1, brewCondition: 1 };
const EPSILON = { cupsPerMinute: 0.05, grade: 0.25, satisfaction: 0.5, guestsLost: 0.25, cashDelta: 100, brewCondition: 0.25 };

export function brewPareto({ seeds = SEEDS, ...bot } = {}) {
  const rows = BREW_SCENARIOS.flatMap((scenario) => BREW_MODS.map(({ id: mod }) => {
    const samples = seeds.map((seed) => {
      // Kits and tools are sunk capital, including the already fitted short-cash shop.
      const campaign = makeCampaign({ ...scenario, budget: undefined });
      prepareTier(campaign, "brew", 1);
      const beforeKit = campaign.cash;
      if (!fitBrew(campaign, mod)) throw new Error(`Could not fit ${mod}.`);
      const firstFitCost = beforeKit - campaign.cash;
      if (scenario.premiumMenu)
        for (const family of ["milk-tea", "fruit-tea"]) setPrice(campaign, family, 2);
      campaign.cash = scenario.budget ?? 10_000;
      const shift = runShift(campaign, seed, bot);
      return { ...shift, firstFitCost, firstShiftAfterFit: shift.cashDelta - firstFitCost };
    });
    return { scenario: scenario.id, mod, ...average(samples), samples };
  }));
  const pairs = BREW_MODS.flatMap((left, index) => BREW_MODS.slice(index + 1).map((right) => {
    const wins = { [left.id]: [], [right.id]: [] };
    const advantages = { [left.id]: false, [right.id]: false };
    for (const { id: scenario } of BREW_SCENARIOS) {
      const a = rows.find((row) => row.scenario === scenario && row.mod === left.id);
      const b = rows.find((row) => row.scenario === scenario && row.mod === right.id);
      for (let i = 0; i < seeds.length; i++)
        for (const [metric, direction] of Object.entries(DIRECTIONS)) {
          if (a.samples[i][metric] === null || b.samples[i][metric] === null) continue;
          const delta = (a.samples[i][metric] - b.samples[i][metric]) * direction;
          if (delta > EPSILON[metric]) advantages[left.id] = true;
          if (delta < -EPSILON[metric]) advantages[right.id] = true;
        }
      const objective = OBJECTIVES[scenario];
      const delta = a[objective] - b[objective];
      if (delta > EPSILON[objective]) wins[left.id].push(scenario);
      if (delta < -EPSILON[objective]) wins[right.id].push(scenario);
    }
    return {
      left: left.id, right: right.id, wins, advantages,
      pass: advantages[left.id] && advantages[right.id] && wins[left.id].length > 0 && wins[right.id].length > 0,
    };
  }));
  return { rows, pairs };
}

const POLICIES = {
  speed: { kit: "brew-manifold", shop: "campus", stock: 12, advertisement: "flyers", traffic: 1.2, goal: "contract-fast",
    nodes: ["build-dosing-rail", "build-fixed-doser"] },
  quality: { kit: "brew-precision", shop: "garden", stock: 11, advertisement: "display", traffic: 0, goal: "contract-perfect",
    nodes: ["prep-batch-pot", "serve-handoff-rack", "prep-portion-tray"] },
  regulars: { stock: 12, advertisement: "loyalty", traffic: 0, goal: "contract-tips",
    nodes: ["furniture-fit-kit", "decor-display-rails", "front-greeting-post", "crew-hospitality", "front-host-stand",
      "decor-regular-shelf", "promo-loyalty-stamp", "event-quiet-plan"] },
  volume: { stock: 20, advertisement: "radio", traffic: 1.05, goal: "contract-served",
    nodes: ["prep-batch-pot", "back-service-rack", "pantry-night-freight", "prep-hold-bath", "menu-batch-base"] },
};
export const CAMPAIGN_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const CASH_PERIODS = [[10, 20], [21, 40], [41, 60]];

function restock(campaign, strategy, policy) {
  const ids = ["black", "milk", "pearls", "jasmine", "brown-sugar", "strawberry", "honey", "taro", "oat", "oolong"];
  if (strategy === "quality") ids.push("peach");
  if (campaign.day >= 7) ids.push("mango", "popping", "pudding", "banana");
  if (campaign.day >= 15) ids.push("matcha", "green", "vanilla", "foam-base");
  for (const id of ids) {
    const ingredient = INGREDIENT_BY_ID[id];
    if (ingredient.day > campaign.day) continue;
    const goal = ["black", "milk", "pearls", "jasmine", "brown-sugar"].includes(id) ? policy.stock :
      strategy === "quality" && id === "peach" ? 8 : 5;
    let onHand = stock(campaign, id);
    const pending = campaign.expansion.shipments.filter((order) => order.ingredient === id)
      .reduce((sum, order) => sum + order.quantity, 0);
    if (strategy === "volume" && ingredient.suppliers.includes("wholesaler") && onHand + pending < goal)
      buyPantry(campaign, id, "wholesaler");
    const floor = strategy === "volume" ? Math.min(goal, 7) : goal;
    while (onHand < floor && campaign.cash > 850 && buyPantry(campaign, id))
      onHand += 4;
  }
}

function fitMachine(campaign, id) {
  const shop = campaign.expansion.activeShop;
  if (campaign.cash < 2_400 || Object.entries(campaign.expansion.machines)
      .some(([key, machine]) => machine.shop === shop && key.split("::").at(-1) === id)) return;
  buyMachine(campaign, id);
}

function hireRole(campaign, role) {
  const shop = campaign.expansion.activeShop;
  if (campaign.expansion.staff.some((person) => person.shop === shop && person.role === role)) return;
  const candidate = candidates(campaign).find((person) => person.role === role);
  if (candidate && campaign.cash > 4_500) hire(campaign, candidate);
}

function maintainMachines(campaign, strategy) {
  const threshold = strategy === "speed" ? 55 : 44;
  for (const [id, machine] of Object.entries(campaign.expansion.machines)) {
    if (machine.shop !== campaign.expansion.activeShop || (!machine.broken && machine.condition >= threshold)) continue;
    const chore = startActivity("chore", id);
    for (let i = 0; i < 101 && !chore.done; i++) {
      tickActivity(chore, FRAME, campaign.mode);
      if (i % 20 === 0) actActivity(chore, chore.cursor);
    }
    finishChore(campaign, chore);
    // The bot spends at most one maintenance activity per day.
    break;
  }
}

function advanceGarden(campaign) {
  if (campaign.expansion.activeShop !== "garden") return;
  const state = campaign.expansion.gardenFeature;
  const plot = campaign.expansion.garden[0];
  if (!state.developed && state.sampleUntil <= campaign.day) {
    if (!plot.ingredient) command(campaign, "plant", { id: "oolong", plot: 0 });
    command(campaign, "water", { plot: 0 });
    command(campaign, "harvest", { plot: 0, reserveSample: true });
  }
  if (!state.developed) command(campaign, "develop-garden-blend");
  if (!state.calibratedMachine) {
    const machine = Object.entries(campaign.expansion.machines)
      .find(([id, m]) => id.split("::").at(-1) === "preset-kettle" && m.shop === "garden");
    if (machine) command(campaign, "calibrate-garden-brew", { id: machine[0] });
  }
  if (!state.trainedStaff) {
    const person = campaign.expansion.staff.find((p) => p.shop === "garden" && p.station === "prep");
    if (person) command(campaign, "train-garden-service", { id: person.id });
  }
  if (!state.listed) command(campaign, "list-garden-feature", { value: true });
}

function advanceTree(campaign, policy) {
  if (policy.shop && campaign.expansion.activeShop !== policy.shop) return;
  for (const id of policy.nodes) {
    const node = TREE_NODES.find((n) => n.id === id);
    if (node.day > campaign.day || hasNode(campaign, id) || campaign.cash < node.cost + 6_000) continue;
    const parts = Object.fromEntries(node.requires.filter((parent) => upgradeNode(parent)?.kind === "part").map((part) => [part, 1]));
    if (makeParts(campaign, parts)) command(campaign, "unlock-node", { id });
  }
}

function prepareCampaignDay(campaign, strategy) {
  const policy = POLICIES[strategy];
  const today = calendar(campaign.day);
  if (strategy === "quality" && campaign.day >= 20 && campaign.cash >= 18_000 && !campaign.expansion.shops.garden)
    buyShop(campaign, "garden");
  if (strategy === "speed" && campaign.day >= 18 && campaign.cash >= 17_000 && !campaign.expansion.shops.campus)
    buyShop(campaign, "campus");
  if (campaign.expansion.shops.garden) selectShop(campaign, "garden");
  if (campaign.expansion.shops.campus) selectShop(campaign, "campus");

  restock(campaign, strategy, policy);
  fitMachine(campaign, "preset-kettle");
  fitMachine(campaign, "water-filter");
  if (strategy !== "quality") fitMachine(campaign, "steam-wand");
  fitMachine(campaign, "straw-dispenser");
  if (strategy === "quality" || strategy === "speed") fitMachine(campaign, "shaking-machine");
  const beforeWorkshop = campaign.cash;
  // Save the kit budget for the venue the policy plans to serve long term.
  if (policy.kit && campaign.expansion.activeShop === policy.shop && campaign.day >= 17 && campaign.cash > 6_000 &&
      !campaign.expansion.workshop.brew[campaign.expansion.activeShop]?.active)
    fitBrew(campaign, policy.kit);
  const workshopSpend = beforeWorkshop - campaign.cash;

  if (strategy === "regulars") {
    hireRole(campaign, "host");
    if (campaign.day >= 18 && campaign.cash > 3_500) {
      for (const [index, id] of ["fern-window-plant", "fern-curtain", "pearl-wall-print"].entries())
        if (buyDecor(campaign, id)) placeDecor(campaign, id, 2 + index, 1);
    }
  }
  if (strategy === "quality" && campaign.expansion.activeShop === "garden") hireRole(campaign, "prep");
  if (strategy === "volume") {
    hireRole(campaign, "runner");
    hireRole(campaign, "prep");
    if (campaign.expansion.pearls < 4 && stock(campaign, "pearls") >= 7) makePearlBatch(campaign, 90);
  }
  for (const person of campaign.expansion.staff)
    if (person.shop === campaign.expansion.activeShop && person.rota[today.weekDay - 1] && person.energy < 42)
      staffTea(campaign, person.id);

  advanceTree(campaign, policy);
  if (strategy === "quality" && hasNode(campaign, "prep-portion-tray") && campaign.expansion.pearls === 0 &&
      stock(campaign, "pearls") >= 4) makePearlBatch(campaign, 92);
  maintainMachines(campaign, strategy);
  if (strategy === "quality") {
    advanceGarden(campaign);
    if (campaign.expansion.gardenFeature.developed) {
      setPrice(campaign, "milk-tea", 2);
      setPrice(campaign, "fruit-tea", 2);
    }
  }
  if (campaign.cash > 4_000 && today.event.arrival >= policy.traffic) {
    if (strategy !== "quality" || today.event.tips >= 1.2 || today.event.arrival <= 0.9)
      bookMarketing(campaign, policy.advertisement);
  }
  if (!campaign.expansion.selectedGoals.includes(policy.goal)) selectGoal(campaign, policy.goal);
  if (strategy === "volume" && today.event.arrival <= 1 && campaign.cash > 5_000 &&
      stock(campaign, "milk") >= 10 && !campaign.expansion.selectedGoals.includes("catering-theatre"))
    selectGoal(campaign, "catering-theatre");
  else if (strategy === "volume" && today.event.arrival > 1 && campaign.expansion.selectedGoals.includes("catering-theatre"))
    selectGoal(campaign, "catering-theatre");
  return workshopSpend;
}

function playCampaign(strategy, seed, mode, bot) {
  const campaign = newCampaign(mode);
  const totals = {
    cups: 0, points: 0, cupsLost: 0, guestsLost: 0,
    featureCups: 0, housePremiumCups: 0, housePremiumCash: 0, menuPremiumCash: 0, precisionPremiumCash: 0,
  };
  let workshopSpend = 0;
  const usuals = strategy === "regulars" ? new Map() : undefined;
  const scenarios = {};
  const dailyCash = [];
  while (campaign.day <= 60 && campaign.status !== "closed") {
    const event = calendar(campaign.day).event;
    const scenario = event.effect === "power-cut" ? "outage" : event.arrival >= 1.2 ? "rush" :
      event.arrival <= 0.9 ? "quiet" : "ordinary";
    const reserve = campaign.cash;
    workshopSpend += prepareCampaignDay(campaign, strategy);
    const daySeed = 1 + ((seed - 1 + campaign.day * 11) % 31);
    const result = runShift(campaign, daySeed, { ...bot, strategy, usuals });
    for (const key of Object.keys(totals)) totals[key] += result[key];
    (scenarios[scenario] ??= []).push({ ...result, cashDelta: campaign.cash - reserve });
    dailyCash.push(campaign.cash - reserve);
  }
  return {
    cash: campaign.cash,
    satisfaction: satisfaction(totals.points, totals.cups, totals.cupsLost),
    days: campaign.day - 1,
    finished: campaign.day === 61 && campaign.status !== "closed",
    offers: campaign.expansion.gardenFeature.lastOfferDay > 0,
    workshopSpend,
    treeNodes: Object.values(campaign.expansion.treeNodes).reduce((sum, nodes) => sum + nodes.length, 0),
    chores: campaign.expansion.metrics.chores ?? 0,
    ...totals,
    cashPerDay: Object.fromEntries(CASH_PERIODS.map(([first, last]) => {
      const days = dailyCash.slice(first - 1, last);
      return [`${first}–${last}`, days.length ? days.reduce((sum, cash) => sum + cash, 0) / days.length : null];
    })),
    scenarios: Object.fromEntries(Object.entries(scenarios).map(([id, days]) => [id, average(days)])),
  };
}

export function campaignBalance({ seeds = CAMPAIGN_SEEDS, mode = "normal", ...bot } = {}) {
  const rows = Object.keys(POLICIES).map((strategy) => {
    const samples = seeds.map((seed) => playCampaign(strategy, seed, mode, bot));
    const summary = average(samples.map(({ scenarios, cashPerDay, finished, offers, ...numbers }) => numbers));
    return {
      strategy, ...summary,
      finished: samples.filter((sample) => sample.finished).length,
      featuredIn: samples.filter((sample) => sample.offers).length,
      cashPerDay: average(samples.map((sample) => sample.cashPerDay)),
      samples,
    };
  });
  const withinTenPercent = (sample, metric) => Math.min(...sample.map((row) => row[metric] ?? 0)) >=
    Math.max(...sample.map((row) => row[metric] ?? 0)) * 0.9;
  const qualified = rows.filter((row) => row.finished === seeds.length);
  let cohort = [];
  for (const ignored of [null, ...qualified]) {
    const sample = qualified.filter((row) => row !== ignored);
    if (sample.length > cohort.length && withinTenPercent(sample, "cash") && withinTenPercent(sample, "satisfaction"))
      cohort = sample.map(({ strategy }) => strategy);
  }
  const situations = [
    ["Rush volume", "rush", "cupsPerMinute", 1],
    ["Rush wait", "rush", "serviceSeconds", -1],
    ["Quiet quality", "quiet", "grade", 1],
    ["Outage", "outage", "satisfaction", 1],
    ["Ordinary day", "ordinary", "cashDelta", 1],
  ];
  const outcomes = situations.map(([label, scenario, metric, direction]) => {
    const results = rows.map((row) => ({
      strategy: row.strategy,
      value: average(row.samples.map((sample) => ({ value: sample.scenarios[scenario]?.[metric] ?? null }))).value,
    }));
    const top = Math.max(...results.map((result) => result.value === null ? -Infinity : result.value * direction));
    return { scenario: label, metric, winners: results.filter(
      (result) => result.value !== null && result.value * direction === top,
    ).map((result) => result.strategy), results };
  });
  const winsEverywhere = rows.some((row) => outcomes.every((outcome) => outcome.winners.includes(row.strategy)));
  const pass = cohort.length >= 3 && !winsEverywhere;
  return { rows, cohort, outcomes, winsEverywhere, pass };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: {
    seeds: { type: "string" },
    "hit-rate": { type: "string" },
    "hit-grade": { type: "string" },
    "miss-grade": { type: "string" },
    campaign: { type: "boolean" },
    expert: { type: "boolean" },
    json: { type: "boolean" },
    pareto: { type: "boolean" },
  } });
  const seeds = values.seeds ? values.seeds.split(",").map(Number) : values.campaign ? CAMPAIGN_SEEDS : SEEDS;
  if (seeds.some((seed) => !Number.isInteger(seed) || seed < 1 || seed > 31))
    throw new Error("Use seed days from 1 through 31.");
  const bot = {};
  for (const [flag, key, max] of [["hit-rate", "hitRate", 1], ["hit-grade", "hitGrade", 100], ["miss-grade", "missGrade", 100]]) {
    if (values[flag] === undefined) continue;
    const value = Number(values[flag]);
    if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`Invalid --${flag}.`);
    bot[key] = value;
  }
  const result = values.campaign ? campaignBalance({ seeds, mode: values.expert ? "expert" : "normal", ...bot }) :
    values.pareto ? brewPareto({ seeds, ...bot }) : { rows: baseline({ seeds, ...bot }) };
  if (values.json) console.log(JSON.stringify(values.pareto || values.campaign ? result : result.rows, null, 2));
  else {
    console.table(result.rows.map(({ samples, cashPerDay, ...row }) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, typeof value === "number" ? +value.toFixed(2) : value]),
    )));
    if (result.pairs) console.table(result.pairs.map(({ left, right, wins, pass }) => ({
      left, right, leftWins: wins[left].join(", "), rightWins: wins[right].join(", "), pass,
    })));
    if (result.outcomes) {
      console.table(result.rows.map(({ strategy, cashPerDay }) => ({
        strategy, ...Object.fromEntries(
          Object.entries(cashPerDay).map(([period, cash]) => [period, cash === null ? null : Math.round(cash)]),
        ),
      })));
      console.table(result.outcomes.map(({ scenario, metric, winners }) => ({ scenario, metric, winners: winners.join(", ") })));
      console.log(result.pass ? "Campaign balance passed." : "Campaign balance failed.", "Matched cohort:", result.cohort.join(", "));
    }
  }
  if (result.pass === false || result.pairs?.some((pair) => !pair.pass)) process.exitCode = 1;
}
