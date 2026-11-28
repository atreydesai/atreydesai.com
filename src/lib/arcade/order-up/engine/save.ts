import { newCampaign, normalizeCampaign, type Campaign, type CampaignMode } from "../../orders-campaign.ts";
import { RECIPE_BY_ID, GUEST_BY_ID, SHOPS, SKILLS, POWERUPS, EVENTS, HOLIDAYS, INGREDIENT_BY_ID } from "../content/index.ts";
import { object, finite, STATIONS } from "./state.ts";
import type { Shift, Ticket, Cup, Receipt } from "./shift-types.ts";
import { createRun } from "../skills/index.ts";
import type { SkillId } from "../content/schema.ts";
export const SAVE_LIMIT = 5_000_000;
const number = (n: unknown, fallback = 0, min = 0, max = 1e9) => finite(n, fallback, min, max);
/** Restores a variable-length shift without comparing it to today's rank duration. */
export function restoreExpandedShift(value: unknown, c: Campaign): Shift | null {
  const s = object(value);
  if (
    s.version !== 3 ||
    s.mode !== c.mode ||
    s.day !== c.day ||
    !SHOPS.some((x) => x.id === s.shop) ||
    !c.expansion.shops[String(s.shop)] ||
    !Array.isArray(s.tickets) ||
    s.tickets.length < 3 ||
    s.tickets.length > 6 ||
    !["open", "closing", "complete"].includes(String(s.status))
  )
    return null;
  if (
    typeof s.duration !== "number" ||
    !Number.isFinite(s.duration) ||
    s.duration < 60 ||
    s.duration > 3600 ||
    typeof s.elapsed !== "number" ||
    s.elapsed < 0 ||
    s.elapsed > s.duration + 30
  )
    return null;
  const data = structuredClone(s) as unknown as Shift;
  data.rankAtStart = Math.floor(number(s.rankAtStart, 1, 1, 60));
  data.elapsed = number(s.elapsed);
  data.duration = s.duration;
  data.realElapsed = number(s.realElapsed, data.elapsed, 0, 100000);
  data.seed = Math.floor(number(s.seed, 1, 1, 0xffffffff));
  data.nextId = Math.floor(number(s.nextId, 1));
  data.nextArrival = number(s.nextArrival, data.elapsed + 5);
  data.selected = Math.floor(number(s.selected, 0, 0, s.tickets.length - 1));
  data.walking = number(s.walking, 0, 0, 20);
  data.chefStation = STATIONS.includes(s.chefStation as any) ? (s.chefStation as any) : "brew";
  data.autoClock = 0;
  for (const key of ["arrivals", "lost", "points", "revenue", "tips", "streak", "tipJar", "bonus", "reserve"] as const)
    (data[key] as number) = number(s[key]);
  data.flow = number(s.flow, 0, 0, 5);
  data.event = EVENTS.some((e) => e.id === s.event) ? String(s.event) : EVENTS[0].id;
  data.holiday = HOLIDAYS.some((e) => e.id === s.holiday) ? String(s.holiday) : null;
  data.weather = typeof s.weather === "string" ? s.weather : "clear";
  data.daily = typeof s.daily === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.daily) ? s.daily : null;
  data.tickets = s.tickets.map((raw, index) => {
    if (raw === null) return null;
    const t = object(raw);
    if (
      !RECIPE_BY_ID[String(t.recipe)] ||
      !Array.isArray(t.cups) ||
      t.cups.length < 1 ||
      t.cups.length > 12 ||
      typeof t.guest !== "string" ||
      (!GUEST_BY_ID[t.guest] && data.shop !== "commissary")
    )
      return null;
    const ticket = structuredClone(t) as unknown as Ticket;
    ticket.slot = index;
    ticket.id = Math.floor(number(t.id, index + 1));
    ticket.patience = number(t.patience, 60, 0, 3600);
    ticket.maxPatience = number(t.maxPatience, 60, 1, 3600);
    ticket.cupIndex = Math.floor(number(t.cupIndex, 0, 0, t.cups.length - 1));
    ticket.arrived = number(t.arrived, 0, 0, data.elapsed);
    ticket.name = GUEST_BY_ID[t.guest]?.name ?? "supply tray";
    ticket.usual = !!t.usual;
    ticket.revealed = !!t.revealed;
    ticket.sleeping = !!t.sleeping;
    ticket.changed = !!t.changed;
    ticket.vip = !!t.vip;
    ticket.packed = !!t.packed;
    ticket.job = typeof t.job === "string" ? t.job : null;
    ticket.special = typeof t.special === "string" ? t.special : null;
    ticket.changeTo = RECIPE_BY_ID[String(t.changeTo)] ? String(t.changeTo) : null;
    ticket.memoryGuest = GUEST_BY_ID[String(t.memoryGuest)] ? String(t.memoryGuest) : null;
    ticket.refills = Math.floor(number(t.refills, 0, 0, 2));
    ticket.pickupAt = typeof t.pickupAt === "number" ? number(t.pickupAt, 0, 0, data.duration + 24) : null;
    ticket.cups = t.cups.map((rawCup) => {
      const u = object(rawCup),
        recipe = RECIPE_BY_ID[String(u.recipe)] ?? RECIPE_BY_ID[String(t.recipe)],
        cup = structuredClone(u) as unknown as Cup;
      cup.recipe = recipe.id;
      cup.step = Math.floor(number(u.step, 0, 0, recipe.steps.length));
      cup.started = !!u.started;
      cup.ready = !!u.ready && cup.step === recipe.steps.length;
      cup.readyAt = number(u.readyAt, 0, 0, data.elapsed);
      cup.damage = number(u.damage, 0, 0, 100);
      cup.warmup = number(u.warmup, 0, 0, 30);
      cup.preparedPearls = !!u.preparedPearls;
      cup.grades = Array.isArray(u.grades)
        ? u.grades.slice(0, cup.step).map((rawGrade, i) => {
            const g = object(rawGrade);
            return {
              skill: recipe.steps[i],
              grade: number(g.grade, 0, 0, 100),
              source: typeof g.source === "string" ? g.source : null,
              result: typeof g.result === "string" ? g.result.slice(0, 80) : "restored",
            };
          })
        : [];
      const r = object(u.run),
        expected = recipe.steps[cup.step];
      cup.run = null;
      if (expected && r.id === expected && !cup.ready) {
        const run = createRun(expected, c.mode, c.day);
        run.seconds = number(r.seconds, run.seconds, 0.1, 10);
        run.elapsed = number(r.elapsed, 0, 0, run.seconds + 1);
        run.position = number(r.position, 0, 0, 1);
        run.target = number(r.target, run.target, 0, 1);
        run.window = number(r.window, run.window, 0.001, 1);
        run.speed = number(r.speed, 1, 0.1, 10);
        run.holdSeconds = number(r.holdSeconds);
        run.held = false;
        run.knob = Math.floor(number(r.knob, 1, 0, 2));
        run.knobTarget = Math.floor(number(r.knobTarget, 1, 0, 2));
        run.automatic = typeof r.automatic === "number" ? number(r.automatic, 0, 0, 100) : null;
        run.source = typeof r.source === "string" ? r.source : null;
        run.hits = Array.isArray(r.hits) ? r.hits.slice(0, 30).map((n) => number(n, 0, 0, 100)) : [];
        run.marks = Array.isArray(r.marks) ? r.marks.slice(0, 30).map((n) => number(n, 0, 0, 1)) : [];
        run.path = Array.isArray(r.path)
          ? r.path.slice(0, 180).map((p) => ({ x: number(object(p).x, 0.5, 0, 1), y: number(object(p).y, 0.5, 0, 1) }))
          : [];
        run.cursor = { x: number(object(r.cursor).x, 0.5, 0, 1), y: number(object(r.cursor).y, 0.5, 0, 1) };
        cup.run = run;
      }
      return cup;
    });
    return ticket;
  });
  data.receipts = Array.isArray(s.receipts)
    ? s.receipts
        .slice(0, 1000)
        .filter((r) => RECIPE_BY_ID[String(object(r).recipe)])
        .map((raw) => {
          const r = object(raw);
          return {
            ...r,
            id: number(r.id),
            ticket: number(r.ticket),
            name: String(r.name ?? "guest").slice(0, 80),
            grade: number(r.grade, 0, 0, 100),
            price: number(r.price),
            tip: number(r.tip),
            time: number(r.time, 0, 0, data.elapsed),
            cup: number(r.cup),
            story: number(r.story, 0, 0, 5),
            emote: String(r.emote ?? "music"),
            skills: Array.isArray(r.skills)
              ? r.skills
                  .filter((g) => SKILLS.some((s) => s.id === object(g).skill))
                  .map((g) => ({ ...object(g), grade: number(object(g).grade, 0, 0, 100) }))
              : [],
          } as unknown as Receipt;
        })
    : [];
  // Points have one source of truth: cups that were handed over, never WIP.
  data.points = data.receipts.reduce((sum, r) => sum + r.grade, 0);
  data.revenue = data.receipts.reduce((sum, r) => sum + r.price, 0);
  data.tips = data.receipts.reduce((sum, r) => sum + r.tip, 0);
  data.cooldowns = Object.fromEntries(
    Object.entries(object(s.cooldowns))
      .filter(([id]) => POWERUPS.some((p) => p.id === id))
      .map(([id, n]) => [id, number(n, 0, 0, data.realElapsed + 60)]),
  );
  data.effects = Object.fromEntries(
    Object.entries(object(s.effects))
      .filter(([id]) => POWERUPS.some((p) => p.effect === id))
      .map(([id, e]) => [
        id,
        { until: number(object(e).until, 0, 0, data.realElapsed + 300), charges: number(object(e).charges, 0, 0, 100) },
      ]),
  );
  data.gull = {
    active: !!object(s.gull).active,
    since: number(object(s.gull).since, 0, 0, data.elapsed),
    next: number(object(s.gull).next, 28),
  };
  data.notice = "";
  data.noticeAt = 0;
  data.lastMark = null;
  data.lesson = null;
  data.lastGift = null;
  data.packedJobs = Array.isArray(s.packedJobs) ? s.packedJobs.filter((x) => typeof x === "string").slice(0, 100) : [];
  data.settled = !!s.settled;
  return data;
}
export interface LoadedSave {
  campaign: Campaign;
  shift: Shift | null;
  legacyShift: unknown | null;
  carry: Record<string, unknown>;
  warning: string;
  migrated: boolean;
}
/**
 * A new Order Up shop. It holds only what day 1's menu uses: each later
 * ingredient's opening crate arrives on the day it opens (openingGifts)
 * instead of filling the shelves out of sight until then. The first
 * campaign's own new save, newCampaign, still stocks everything.
 */
export function newShop(mode: CampaignMode): Campaign {
  const c = newCampaign(mode);
  c.inventory = c.inventory.filter((lot) => (INGREDIENT_BY_ID[lot.ingredient]?.day ?? 1) <= 1);
  return c;
}

export function loadEnvelope(value: unknown, mode: CampaignMode): LoadedSave {
  const envelope = object(value),
    raw = object(envelope.campaign),
    campaign = envelope.campaign ? normalizeCampaign(envelope.campaign, mode) : newShop(mode),
    migrated = raw.version !== 3 && !!envelope.campaign;
  if (envelope.campaign && raw.mode !== mode) throw new Error("That save belongs to the other difficulty.");
  if (envelope.campaign && ![1, 2, 3].includes(Number(raw.version)))
    throw new Error("This save is from a newer version of the game.");
  const shift = campaign.status === "open" ? restoreExpandedShift(envelope.expandedShift, campaign) : null;
  const legacyShift = campaign.status === "open" && !envelope.expandedShift && envelope.shift ? envelope.shift : null;
  let warning = "";
  if (campaign.status === "open" && !shift && !legacyShift) {
    campaign.status = "planning";
    warning = "The open shift couldn't be restored, but the shop and pantry are safe.";
  }
  return { campaign, shift, legacyShift, carry: envelope, warning, migrated };
}
export function parseSave(serialized: string, mode: CampaignMode) {
  if (serialized.length > SAVE_LIMIT) throw new Error("This save is too large.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("This file isn't a readable save.");
  }
  if (!object(parsed).campaign) throw new Error("This file doesn't contain a shop.");
  return loadEnvelope(parsed, mode);
}
export function saveEnvelope(campaign: Campaign, shift: Shift | null, carry: Record<string, unknown> = {}) {
  return {
    ...carry,
    version: 3,
    campaign,
    shift: null,
    expandedShift: shift?.settled ? null : shift,
    savedAt: new Date().toISOString(),
  };
}
