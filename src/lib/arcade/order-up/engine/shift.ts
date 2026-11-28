import { machineDefinition, machineAt } from "./equipment.ts";
import { recordRentDay } from "../../orders-rent-book.ts";
import type { Campaign } from "../../orders-campaign.ts";
import type { SkillId, Station } from "../content/schema.ts";
import {
  SKILLS,
  RECIPE_BY_ID,
  POWERUPS,
  MACHINES,
  GOALS,
  SHOPS,
  INGREDIENTS,
  SPECIAL_GUESTS,
} from "../content/index.ts";
import { createRun, stepSkill, actSkill, type SkillAction } from "../skills/index.ts";
import { type Shift, type Ticket, type Cup, freshCup } from "./shift-types.ts";
import { calendar } from "./calendar.ts";
import { TUNING, shiftDuration, ticketLimit, arrivalInterval, phaseAt } from "./tuning.ts";
import {
  rankFor,
  walkSeconds,
  staffOnDuty,
  staffGrade,
  staffSpeed,
  trainWitness,
  payroll,
  rentDue,
  MARKETING,
} from "./management.ts";
import {
  expireAndDeliver,
  openingGifts,
  canMake,
  consumeRecipe,
  emergencyRestock,
  addStock,
  useStock,
  stock,
} from "./pantry.ts";
import {
  metric,
  storyVisit,
  giftPower,
  discoverBadges,
  goalBonus,
  beginGoals,
  updateShopStars,
  grantRankUnlocks,
} from "./progression.ts";
import { spawnTicket, availableRecipes, draw, activeCup, selectedTicket } from "./tickets.ts";
import { receiptFor } from "./receipts.ts";
import { growGarden, adoptCat } from "./activities.ts";
import { hash, dailySeed } from "./random.ts";
export * from "./shift-types.ts";
export { selectedTicket, activeCup, selectTicket, availableRecipes } from "./tickets.ts";
export function startShift(c: Campaign, daily: string | null = null): Shift {
  if (c.status === "open") throw new Error("Resume the open shift before starting another.");
  if (c.status === "closed") throw new Error("The rent book needs attention.");
  expireAndDeliver(c);
  openingGifts(c);
  beginGoals(c);
  const today = calendar(c.day),
    rank = rankFor(c);
  c.status = "open";
  c.expansion.notice = "";
  const s: Shift = {
    version: 3,
    mode: c.mode,
    day: c.day,
    shop: c.expansion.activeShop,
    seed: daily ? dailySeed(daily, c.mode) : hash(`${c.mode}:${c.day}:${c.expansion.activeShop}`),
    duration: shiftDuration(rank),
    elapsed: 0,
    realElapsed: 0,
    status: "open",
    tickets: Array.from({ length: ticketLimit(c.day) }, () => null),
    selected: 0,
    nextArrival: arrivalInterval(c.mode, c.day, 0, shiftDuration(rank)),
    rankAtStart: rank,
    nextId: 1,
    arrivals: 0,
    receipts: [],
    lost: 0,
    points: 0,
    revenue: 0,
    tips: 0,
    flow: 0,
    streak: 0,
    tipJar: 0,
    effects: {},
    cooldowns: {},
    chefStation: "brew",
    walking: 0,
    lastMark: null,
    notice: "",
    noticeAt: 0,
    event: today.event.id,
    holiday: today.holiday?.id ?? null,
    settled: false,
    gull: { active: false, since: 0, next: 28 },
    bonus: 0,
    daily,
    lesson: null,
    autoClock: 0,
    lastGift: null,
    packedJobs: [],
    weather: today.weather,
    reserve: c.cash,
  };
  spawnTicket(c, s);
  if (!c.expansion.seenDays.includes(c.day)) c.expansion.seenDays.push(c.day);
  return s;
}
/** The selection moves to another waiting ticket when its own leaves the rail. */
function reselect(s: Shift) {
  if (s.tickets[s.selected]) return;
  const next = s.tickets.findIndex((t) => !!t);
  if (next >= 0) s.selected = next;
}
export function effect(s: Shift, id: string) {
  return !!s.effects[id] && (s.effects[id].charges > 0 || s.effects[id].until > s.realElapsed);
}
export function setStation(c: Campaign, s: Shift, station: Station) {
  if (!["brew", "prep", "build", "serve", "stock"].includes(station)) return false;
  s.walking = walkSeconds(c, s.chefStation, station);
  s.chefStation = station;
  return true;
}
export function currentSkill(cup: Cup) {
  return RECIPE_BY_ID[cup.recipe]?.steps[cup.step] ?? null;
}
export function beginWork(
  c: Campaign,
  s: Shift,
  slot = s.selected,
  cupIndex?: number,
  automatic?: { grade: number; speed: number; source: string },
) {
  const ticket = s.tickets[slot];
  if (
    !ticket ||
    ticket.sleeping ||
    ticket.special === "cat" ||
    (ticket.usual && !ticket.revealed) ||
    ticket.changeTo ||
    s.status === "complete"
  )
    return false;
  const cup = ticket.cups[cupIndex ?? ticket.cupIndex];
  if (!cup) return false;
  const skill = currentSkill(cup);
  if (cup.ready || cup.run || !skill) return false;
  const definition = SKILLS.find((x) => x.id === skill)!;
  if (!automatic) {
    if (s.chefStation !== definition.station) {
      setStation(c, s, definition.station);
      return false;
    }
    if (s.walking > 0) return false;
  }
  if (!cup.started) {
    if (!consumeRecipe(c, RECIPE_BY_ID[cup.recipe])) {
      s.notice = "This cup needs fresh stock.";
      s.noticeAt = s.realElapsed;
      return false;
    }
    cup.started = true;
  }
  if (skill === "pearl-pot" && c.expansion.pearls > 0) {
    c.expansion.pearls--;
    cup.preparedPearls = true;
    cup.grades.push({
      skill,
      grade: Math.round(88 + 10 * c.expansion.freshness),
      result: "batch pearls",
      source: "prep batch",
    });
    cup.step++;
    return true;
  }
  const tea = RECIPE_BY_ID[cup.recipe].ingredients.find(
    (i) => INGREDIENTS.find((x) => x.id === i.id)?.group === "tea",
  )?.id;
  cup.run = createRun(skill, c.mode, c.day, {
    window: effect(s, "windows") ? 1.65 : 1,
    speed: (automatic?.speed ?? 1) * (1 + Math.min(4, s.flow) * 0.025),
    tea,
    automatic: automatic?.grade,
    source: automatic?.source,
  });
  cup.warmup = skill === "steep" ? 2.2 : skill === "pearl-pot" ? 2.8 : skill === "egg-waffle" ? 3.2 : 0;
  if (automatic) cup.warmup /= automatic.speed;
  if ((skill === "topping-ladle" && effect(s, "ladle")) || (skill === "seal" && effect(s, "seal"))) {
    cup.run.automatic = 100;
    cup.run.seconds = 0.35;
    cup.run.source = "powerup";
    cup.warmup = 0;
    const key = skill === "seal" ? "seal" : "ladle";
    s.effects[key].charges--;
  }
  if (effect(s, "rush") && ["steep", "pearl-pot", "egg-waffle"].includes(skill)) {
    cup.run.automatic = 96;
    cup.run.seconds = 0.1;
    cup.warmup = 0;
    s.effects.rush.charges--;
  }
  return true;
}
export function finishSkill(c: Campaign, s: Shift, ticket: Ticket, cup: Cup) {
  const run = cup.run;
  if (!run?.finished) return;
  let grade = run.grade;
  if (run.source === "powerup") grade = 100;
  cup.grades.push({ skill: run.id, grade, result: run.result, source: run.source });
  cup.step++;
  cup.run = null;
  cup.warmup = 0;
  s.lastMark = { skill: run.id, grade, time: s.realElapsed };
  metric(c, "skills");
  metric(c, run.id);
  if (grade >= 98) {
    s.flow = Math.min(5, s.flow + 1);
    metric(c, "perfect-skills");
    metric(c, "flow");
    trainWitness(c, SKILLS.find((k) => k.id === run.id)!.station, grade);
  } else if (grade < 75) {
    if (effect(s, "flow")) s.effects.flow.charges--;
    else s.flow = 0;
  }
  if (effect(s, "duplicate")) {
    const twin = s.tickets
      .flatMap((t) => (t ? t.cups : []))
      .find((other) => other !== cup && !other.run && !other.ready && currentSkill(other) === run.id);
    if (twin) {
      const owner = s.tickets.find((t) => t?.cups.includes(twin))!;
      if (twin.started || consumeRecipe(c, RECIPE_BY_ID[twin.recipe])) {
        twin.started = true;
        twin.grades.push({ skill: run.id, grade, result: "second hands", source: "ghost" });
        twin.step++;
        if (twin.step >= RECIPE_BY_ID[twin.recipe].steps.length) {
          twin.ready = true;
          twin.readyAt = s.elapsed;
        }
        s.effects.duplicate.charges--;
      }
    }
  }
  if (cup.step >= RECIPE_BY_ID[cup.recipe].steps.length) {
    cup.ready = true;
    cup.readyAt = s.elapsed;
    if (ticket.cupIndex === ticket.cups.indexOf(cup)) {
      const next = ticket.cups.findIndex((x) => !x.ready);
      if (next >= 0) ticket.cupIndex = next;
    }
  }
  if (run.source && c.expansion.machines[run.source]) {
    const machine = c.expansion.machines[run.source];
    machine.condition = Math.max(0, machine.condition - TUNING[c.mode].wear / machine.tier);
    if (machine.condition < 18 && draw(s) < 0.04 / machine.tier) {
      machine.broken = true;
      s.notice = "A machine broke down. Clean it in closing chores.";
      s.noticeAt = s.realElapsed;
    }
  }
}
export function skillAction(c: Campaign, s: Shift, action: SkillAction, slot = s.selected) {
  const ticket = s.tickets[slot],
    cup = ticket ? activeCup(ticket) : null;
  if (!cup?.run || cup.warmup > 0) return false;
  actSkill(cup.run, action);
  if (cup.run.finished) finishSkill(c, s, ticket!, cup);
  return true;
}
export function inspectUsual(s: Shift) {
  const ticket = selectedTicket(s);
  if (!ticket || !ticket.usual || ticket.revealed) return false;
  ticket.revealed = true;
  ticket.patience = Math.max(0, ticket.patience - 3);
  return true;
}
export function wakeGuest(s: Shift, slot = s.selected) {
  const ticket = s.tickets[slot];
  if (!ticket?.sleeping) return false;
  ticket.sleeping = false;
  s.notice = "The commuter is awake.";
  s.noticeAt = s.realElapsed;
  return true;
}
export function feedCat(c: Campaign, s: Shift, slot = s.selected) {
  const ticket = s.tickets[slot];
  if (ticket?.special !== "cat" || !adoptCat(c)) return false;
  s.tickets[slot] = null;
  reselect(s);
  s.notice = "The cat has a home here.";
  s.noticeAt = s.realElapsed;
  return true;
}
export function handoff(c: Campaign, s: Shift, slot = s.selected) {
  const ticket = s.tickets[slot];
  if (
    !ticket ||
    ticket.changeTo ||
    (ticket.usual && !ticket.revealed) ||
    !ticket.cups.every((cup) => cup.ready) ||
    s.status === "complete"
  )
    return false;
  if (ticket.pickupAt && s.elapsed < ticket.pickupAt) {
    s.notice = "The courier arrives in " + Math.ceil(ticket.pickupAt - s.elapsed) + " seconds.";
    s.noticeAt = s.realElapsed;
    return false;
  }
  if (ticket.special === "parent" && !ticket.changed && draw(s) < 0.16) {
    ticket.changed = true;
    ticket.cups.push(freshCup(ticket.recipe));
    ticket.cupIndex = ticket.cups.length - 1;
    ticket.patience += 20;
    s.notice = "The parent wants one more small cup.";
    s.noticeAt = s.realElapsed;
    return false;
  }
  let sum = 0,
    story = false;
  for (const [i, cup] of ticket.cups.entries()) {
    const receipt = receiptFor(c, s, ticket, cup, i);
    if (effect(s, "quality")) {
      receipt.grade = Math.min(100, receipt.grade + 12);
      s.effects.quality.charges--;
    }
    if (effect(s, "special")) {
      receipt.tip += 200;
      s.effects.special.charges--;
    }
    s.receipts.push(receipt);
    sum += receipt.grade;
    s.points += receipt.grade;
    s.revenue += receipt.price;
    s.tips += receipt.tip;
    c.cash += receipt.price + receipt.tip;
    s.tipJar += receipt.tip;
    metric(c, "served", 1, receipt.grade);
    metric(c, "tips", receipt.tip, receipt.grade);
    metric(c, RECIPE_BY_ID[cup.recipe].family, 1, receipt.grade);
    if (cup.grades.every((g) => !g.source)) metric(c, "handmade", 1, receipt.grade);
    if (s.elapsed - ticket.arrived < 25) metric(c, "fast", 1, receipt.grade);
    if (c.expansion.freshness > 0.8) metric(c, "fresh", 1, receipt.grade);
    if (RECIPE_BY_ID[cup.recipe].ingredients.some((i) => INGREDIENTS.find((x) => x.id === i.id)?.group === "side"))
      metric(c, "sides", 1, receipt.grade);
    if (receipt.grade >= 95) {
      metric(c, "perfect", 1, receipt.grade);
      s.streak++;
    } else s.streak = 0;
    if (s.streak > 0 && s.streak % 5 === 0) s.lastGift = giftPower(c, s.seed + s.streak);
    const record = c.expansion.recipes[cup.recipe] ?? { count: 0, best: 0 };
    if (!record.count) metric(c, "recipes");
    record.count++;
    record.best = Math.max(record.best, receipt.grade);
    c.expansion.recipes[cup.recipe] = record;
    if (ticket.packed) metric(c, "packed", 1, receipt.grade, ticket.job ?? undefined);
    c.xp += Math.round(receipt.grade * 0.3);
    updateShopStars(c, receipt.grade, ticket.special === "critic");
  }
  const average = sum / ticket.cups.length;
  story = (ticket.refills ?? 0) === 0 && storyVisit(c, ticket.guest, average);
  if ((ticket.refills ?? 0) > 0) metric(c, "refills", 1, average);
  if (story) s.lastGift = giftPower(c, s.seed + ticket.id);
  if (ticket.special === "influencer" && average >= 95)
    c.expansion.metrics.viralTomorrow = (c.expansion.metrics.viralTomorrow ?? 0) + 1;
  if (ticket.special === "inspector") {
    const bad = Object.values(c.expansion.machines).filter(
      (m) => m.shop === s.shop && (m.condition < 35 || m.broken),
    ).length;
    if (bad) {
      c.cash = Math.max(0, c.cash - bad * 150);
      s.bonus -= bad * 150;
    }
  }
  if (ticket.special === "critic" && average >= 90) {
    c.reputation = Math.min(100, c.reputation + 3);
    metric(c, "critics");
  }
  if (ticket.special === "mayor" || ticket.special === "celebrity") metric(c, ticket.special);
  if (ticket.packed && ticket.job && !s.packedJobs.includes(ticket.job)) s.packedJobs.push(ticket.job);
  if (s.tipJar >= 1800) {
    s.tipJar -= 1800;
    s.lastGift = giftPower(c, s.seed + Math.floor(s.tips));
  }
  delete s.effects.cat;
  if (ticket.special === "crammer" && (ticket.refills ?? 0) < 2 && s.elapsed < s.duration - 15) {
    ticket.refills = (ticket.refills ?? 0) + 1;
    ticket.cups = [freshCup(ticket.recipe)];
    ticket.cupIndex = 0;
    ticket.patience = ticket.maxPatience = Math.max(45, ticket.maxPatience * 0.8);
    ticket.arrived = s.elapsed;
    ticket.usual = false;
    ticket.revealed = true;
    s.notice = "The student wants a refill.";
    s.noticeAt = s.realElapsed;
    return true;
  }
  s.tickets[slot] = null;
  reselect(s);
  return true;
}
export function shooGull(c: Campaign, s: Shift) {
  if (!s.gull.active) return false;
  s.gull.active = false;
  s.gull.next = s.elapsed + 25;
  metric(c, "gulls");
  return true;
}
export function repairMachine(c: Campaign, s: Shift, id: string, grade: number) {
  const m = c.expansion.machines[id];
  if (!m?.broken || grade < 55) return false;
  m.broken = false;
  m.condition = Math.min(100, m.condition + 35 + grade * 0.25);
  metric(c, "repairs");
  return true;
}
function automation(c: Campaign, s: Shift) {
  const staff = staffOnDuty(c),
    powerCut = calendar(c.day).event.effect === "power-cut" && !effect(s, "weather");
  const machines = Object.entries(c.expansion.machines).filter(
    ([, m]) => m.shop === s.shop && m.automatic && !m.broken && m.condition > 0,
  );
  const busy = new Set(
    s.tickets.flatMap((t) => (t ? t.cups.flatMap((cup) => (cup.run?.source ? [cup.run.source] : [])) : [])),
  );
  for (const ticket of s.tickets) {
    if (!ticket || ticket.sleeping) continue;
    if (ticket.cups.every((cup) => cup.ready) && staff.some((p) => p.role === "runner" || p.role === "courier")) {
      handoff(c, s, ticket.slot);
      continue;
    }
    for (let index = 0; index < ticket.cups.length; index++) {
      const cup = ticket.cups[index],
        skill = currentSkill(cup);
      if (cup.ready || cup.run || !skill) continue;
      const station = SKILLS.find((k) => k.id === skill)!.station;
      const person = staff.find(
        (p) =>
          p.station === station &&
          !busy.has(p.id) &&
          !["host", "cashier", "runner", "manager", "courier"].includes(p.role),
      );
      if (person) {
        if (
          beginWork(c, s, ticket.slot, index, {
            grade: staffGrade(person, station),
            speed: staffSpeed(person) * 0.83,
            source: person.id,
          })
        )
          busy.add(person.id);
        continue;
      }
      if (powerCut) continue;
      const found = machines.find(([id, m]) => !busy.has(id) && machineDefinition(id)?.skills.includes(skill));
      if (found) {
        const [id, m] = found,
          definition = machineDefinition(id)!,
          tier = definition.tiers[m.tier - 1];
        if (
          beginWork(c, s, ticket.slot, index, {
            grade: tier.grade - Math.max(0, 65 - m.condition) * 0.25,
            speed: tier.speed * TUNING[c.mode].machineSpeed * 0.8,
            source: id,
          })
        )
          busy.add(id);
      }
    }
  }
}
export function tickShift(c: Campaign, s: Shift, realDt: number) {
  if (s.status === "complete" || s.settled || !Number.isFinite(realDt) || realDt <= 0) return s;
  realDt = Math.min(0.1, realDt);
  s.realElapsed += realDt;
  c.expansion.totalPlaySeconds += realDt;
  for (const [id, value] of Object.entries(s.effects))
    if (value.until > 0 && value.until <= s.realElapsed && value.charges <= 0) delete s.effects[id];
  const dt = realDt * (effect(s, "slow") ? 0.5 : 1);
  s.elapsed += dt;
  s.walking = Math.max(0, s.walking - dt);
  const today = calendar(c.day),
    busker = s.tickets.some((t) => t?.special === "busker"),
    quiet = effect(s, "quiet") || effect(s, "cat");
  c.expansion.freshness = Math.max(0, c.expansion.freshness - dt / 180);
  const active = selectedTicket(s);
  for (const ticket of s.tickets) {
    if (!ticket) continue;
    if (!ticket.sleeping && !quiet) {
      const modifier = (effect(s, "patience") ? 0.6 : 1) * (busker ? 0.82 : 1) * (ticket === active ? 0.78 : 1);
      ticket.patience = Math.max(0, ticket.patience - dt * modifier);
    }
    if (ticket.patience <= 0) {
      s.lost += ticket.cups.length;
      c.reputation = Math.max(0, c.reputation - TUNING[c.mode].missedPenalty);
      s.tickets[ticket.slot] = null;
      reselect(s);
      continue;
    }
    if (
      ticket.special === "undecided" &&
      !ticket.changed &&
      s.elapsed - ticket.arrived > 8 &&
      !ticket.cups.some((cup) => cup.ready)
    ) {
      ticket.changed = true;
      const alternatives = availableRecipes(c).filter((r) => r.id !== ticket.recipe);
      if (alternatives.length) {
        ticket.changeTo = alternatives[Math.floor(draw(s) * alternatives.length)].id;
        s.notice = "A guest has a new request.";
        s.noticeAt = s.realElapsed;
      }
    }
    for (const cup of ticket.cups) {
      if (cup.run) {
        if (cup.warmup > 0) cup.warmup = Math.max(0, cup.warmup - dt);
        else {
          stepSkill(cup.run, dt);
          if (cup.run.finished) finishSkill(c, s, ticket, cup);
        }
      }
      if (cup.ready && !RECIPE_BY_ID[cup.recipe].hot && s.elapsed - cup.readyAt > 18 && !effect(s, "ice"))
        cup.damage = Math.min(
          25,
          cup.damage + dt * (s.shop === "boardwalk" || today.event.effect === "melt" ? 0.4 : 0.1),
        );
    }
  }
  if (s.elapsed < s.duration) {
    if (s.elapsed >= s.nextArrival && !s.tickets.some((t) => t?.sleeping)) {
      spawnTicket(c, s);
      const marketing = MARKETING.find((m) => m.id === c.expansion.marketing);
      let rate = today.event.arrival * (marketing?.arrivals ?? 1) * (effect(s, "happy") ? 2 : 1);
      if (s.shop === "campus" && phaseAt(s.elapsed, s.duration).includes("rush")) rate *= 1.25;
      if (s.shop === "night") rate *= 1.2;
      if (s.shop === "harbor" && Math.floor(s.elapsed / 28) % 2 === 0) rate *= 1.4;
      if (c.expansion.metrics.viralActive) rate *= 1.2;
      s.nextArrival = s.elapsed + arrivalInterval(c.mode, c.day, s.elapsed, s.duration) / rate;
    }
  } else s.status = "closing";
  if (s.status === "closing" && (!s.tickets.some((t) => !!t) || s.elapsed >= s.duration + 24)) {
    for (const t of s.tickets) if (t) s.lost += t.cups.length;
    s.tickets = s.tickets.map(() => null);
    s.status = "complete";
    return s;
  }
  if ((s.shop === "harbor" || s.shop === "station") && c.day >= 50 && !c.expansion.cat) {
    if (!s.gull.active && s.elapsed >= s.gull.next) {
      s.gull.active = true;
      s.gull.since = s.elapsed;
    } else if (s.gull.active && s.elapsed - s.gull.since > 7) {
      const cup = s.tickets.flatMap((t) => (t ? t.cups : [])).find((cup) => cup.started && !cup.ready);
      if (cup) cup.damage += 12;
      s.gull.active = false;
      s.gull.next = s.elapsed + 25;
    }
  }
  s.autoClock += dt;
  if (s.autoClock >= 0.18) {
    s.autoClock = 0;
    automation(c, s);
  }
  return s;
}
export function usePowerup(c: Campaign, s: Shift, id: string) {
  const item = POWERUPS.find((p) => p.id === id);
  if (
    !item ||
    item.day > c.day ||
    !c.expansion.loadout.includes(id) ||
    (c.expansion.powerups[id] ?? 0) <= 0 ||
    (s.cooldowns[id] ?? 0) > s.realElapsed ||
    s.status === "complete"
  )
    return false;
  const ticket = selectedTicket(s);
  c.expansion.powerups[id]--;
  s.cooldowns[id] = s.realElapsed + 12;
  const duration = item.seconds || (["patience", "quiet"].includes(item.effect) ? 12 : 0);
  s.effects[item.effect] = {
    until: duration ? s.realElapsed + duration : 0,
    charges: duration ? 0 : item.charges || 1,
  };
  switch (item.effect) {
    case "patience":
      for (const t of s.tickets) if (t) t.patience = Math.min(t.maxPatience, t.patience + 18);
      s.effects.patience = { until: s.realElapsed + (item.seconds || 12), charges: 0 };
      break;
    case "supplies":
      emergencyRestock(c);
      break;
    case "rush":
      for (const t of s.tickets)
        if (t)
          for (const cup of t.cups)
            if (cup.run && ["steep", "pearl-pot", "egg-waffle"].includes(cup.run.id)) {
              cup.warmup = 0;
              cup.run.finished = true;
              cup.run.grade = 96;
              cup.run.result = "ready";
              finishSkill(c, s, t, cup);
            }
      break;
    case "assist":
      if (ticket) {
        const cup = activeCup(ticket);
        if (!cup.started && consumeRecipe(c, RECIPE_BY_ID[cup.recipe])) cup.started = true;
        if (cup.started) {
          for (const skill of RECIPE_BY_ID[cup.recipe].steps.slice(cup.step))
            cup.grades.push({ skill, grade: 88, result: "counter help", source: "powerup" });
          cup.run = null;
          cup.step = RECIPE_BY_ID[cup.recipe].steps.length;
          cup.ready = true;
          cup.readyAt = s.elapsed;
        }
      }
      break;
    case "ice":
      c.expansion.ice = 150;
      for (const t of s.tickets)
        if (t)
          for (const cup of t.cups) {
            cup.damage = 0;
            cup.readyAt = s.elapsed;
          }
      break;
    case "freshness":
      c.expansion.freshness = 1;
      break;
    case "fortune": {
      const ids = ["windows", "patience", "seal", "ladle"];
      const selected = ids[Math.floor(draw(s) * ids.length)];
      s.effects[selected] = { until: s.realElapsed + 15, charges: selected === "seal" || selected === "ladle" ? 3 : 0 };
      s.notice =
        selected === "windows"
          ? "The fortune steadies your hands."
          : selected === "patience"
            ? "The fortune calms the queue."
            : selected === "seal"
              ? "The fortune warms the stamp."
              : "The fortune centers the ladle.";
      s.noticeAt = s.realElapsed;
      break;
    }
    case "handoff":
      for (const t of [...s.tickets]) if (t) handoff(c, s, t.slot);
      break;
    case "pearls":
      c.expansion.pearls += 8;
      c.expansion.freshness = 1;
      break;
    case "remake":
      if (ticket) {
        const old = activeCup(ticket);
        ticket.cups[ticket.cupIndex] = freshCup(old.recipe);
        ticket.cups[ticket.cupIndex].started = true;
        ticket.patience = ticket.maxPatience;
      }
      break;
    case "vip":
      if (ticket) {
        ticket.vip = true;
        ticket.patience += 30;
      }
      break;
  }
  metric(c, "powerups");
  return true;
}
export function settleShift(c: Campaign, s: Shift) {
  if (s.status !== "complete" || s.settled || s.day !== c.day) return null;
  s.settled = true;
  const before = s.rankAtStart ?? rankFor(c),
    bonus = goalBonus(c);
  let managerSales = 0;
  for (const person of c.expansion.staff.filter(
    (p) => p.role === "manager" && p.shop !== s.shop && p.rota[(c.day - 1) % 7],
  )) {
    const menu = availableRecipes(c),
      recipe = menu[0];
    if (!recipe) continue;
    for (let i = 0; i < 2 + person.skills.serve; i++) {
      if (!consumeRecipe(c, recipe)) break;
      managerSales += Math.round(recipe.price * 0.85);
    }
  }
  const wages = payroll(c),
    rent = c.day % 7 === 0 ? rentDue(c) : 0,
    interest = c.day % 7 === 0 ? c.expansion.loanInterest : 0;
  c.cash += bonus + managerSales;
  c.cash -= wages + rent + interest;
  const short = Math.max(0, -c.cash);
  c.cash = Math.max(0, c.cash);
  c.expansion.missedRent += short;
  c.bestShiftScore = Math.max(c.bestShiftScore, s.points);
  if (s.daily) c.expansion.dailyBests[s.daily] = Math.max(c.expansion.dailyBests[s.daily] ?? 0, s.points);
  c.highestReputation = Math.max(c.highestReputation, c.reputation);
  c.rentPaid += Math.max(0, rent - short);
  metric(c, "days");
  growGarden(c);
  const badges = discoverBadges(c),
    after = rankFor(c);
  grantRankUnlocks(c, before, after);
  const report = {
    day: c.day,
    served: s.receipts.length,
    lost: s.lost,
    points: s.points,
    revenue: s.revenue + managerSales,
    tips: s.tips,
    wages,
    rent,
    interest,
    bonus,
    net: s.revenue + s.tips + bonus + managerSales - wages - rent - interest,
    rankBefore: before,
    rankAfter: after,
    newBadges: badges,
    recipes: Object.keys(c.expansion.recipes).length,
    stories: c.expansion.metrics.stories ?? 0,
    average: s.receipts.length ? Math.round(s.points / s.receipts.length) : 0,
    shop: s.shop,
  };
  c.expansion.lastReport = report;
  c.expansion.marketing = null;
  c.expansion.ice = Math.max(60, c.expansion.ice);
  c.expansion.metrics.viralActive = c.expansion.metrics.viralTomorrow ?? 0;
  c.expansion.metrics.viralTomorrow = 0;
  c.lastDay = {
    day: c.day,
    shiftScore: s.points,
    revenue: report.revenue,
    tips: s.tips,
    served: report.served,
    quality: report.average,
    missed: s.lost,
    expired: 0,
    rent: Math.max(0, rent - short),
    rentOwed: short,
    wages,
    branchIncome: managerSales,
    standingOrders: 0,
    standingSpent: 0,
    promotion: after > before ? `rank ${after}` : null,
    level: after,
    reason: short ? "The till couldn't cover the close." : null,
  };
  c.rentBook = recordRentDay(c.rentBook, {
    day: c.day,
    cups: s.receipts.length,
    takings: report.revenue + s.tips,
    payroll: wages,
    expired: 0,
    rent: Math.max(0, rent - short),
    reserve: c.cash,
    outcome: short ? "closed" : rent ? "paid" : "open",
  });
  c.day++;
  c.status = short ? "closed" : "planning";
  expireAndDeliver(c);
  openingGifts(c);
  return report;
}
