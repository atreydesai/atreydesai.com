// The test kitchen's cheats: a development-only shop that can be pushed to
// any part of Order Up without playing up to it. Every cheat edits the shop
// or the shift in place and returns the line the book shows; the game saves
// afterwards as it does for any other change. Nothing here is reachable from
// a player's own slots (the game only offers it in the test slot on a
// development host).
//
// DOM-free, so each cheat can be tested with node.

import type { Campaign } from "../../orders-campaign.ts";
import { BADGES, DECOR, INGREDIENTS, RANKS, RECIPE_BY_ID, SHOPS } from "../content/index.ts";
import { rankFor } from "./management.ts";
import { addStock, expireAndDeliver, openingGifts, pantryCapacity, pantryCount } from "./pantry.ts";
import { grantRankUnlocks } from "./progression.ts";
import { emptyShop } from "./state.ts";
import type { Shift, Ticket } from "./shift-types.ts";

/** Days the book offers to jump to: the opening, then the content's milestones out to its last unlocks. */
export const CHEAT_DAYS = [1, 5, 10, 20, 30, 60, 90, 120] as const;
/** The latest day any content waits for. */
export const LAST_DAY = 120;
/** Till top-ups, in cents as the till keeps them: $1,000 and $100,000. */
export const CHEAT_CASH = [100_000, 10_000_000] as const;

export interface CheatResult {
  ok: boolean;
  message: string;
}

const done = (message: string): CheatResult => ({ ok: true, message });
const refused = (message: string): CheatResult => ({ ok: false, message });

export function addCash(c: Campaign, amount: number): CheatResult {
  if (!Number.isFinite(amount) || amount <= 0) return refused("Nothing was added.");
  c.cash += amount;
  return done(`Added $${(amount / 100).toLocaleString("en-US")} to the till.`);
}

/**
 * Moves the shop to a day, between shifts only, with the experience that
 * day's rank needs, so everything that opens by then is open. Going back to
 * an earlier day keeps what was earned. Each day passed brings its new
 * ingredients' opening crates, stock past its day spoils and shipments due by
 * then arrive, as playing through those days would.
 */
export function jumpToDay(c: Campaign, day: number): CheatResult {
  if (c.status === "open") return refused("Finish the shift before changing the day.");
  const target = Math.max(1, Math.min(LAST_DAY, Math.floor(day)));
  const before = rankFor(c);
  // Each day passed brings its new ingredients' opening crates, as playing through it would.
  for (let day = c.day + 1; day <= target; day++) {
    c.day = day;
    openingGifts(c);
  }
  c.day = target;
  c.status = "planning";
  expireAndDeliver(c);
  openingGifts(c);
  const rank = Math.min(RANKS.length, Math.floor(target / 2) + 1);
  c.xp = Math.max(c.xp, RANKS[rank - 1]?.xp ?? 0);
  grantRankUnlocks(c, before, rankFor(c));
  return done(`It's day ${target}.`);
}

/** Opens every shop the game has, whatever day they would open on. */
export function openAllShops(c: Campaign): CheatResult {
  if (c.status === "open") return refused("Finish the shift before opening shops.");
  let opened = 0;
  for (const shop of SHOPS) {
    if (c.expansion.shops[shop.id]) continue;
    c.expansion.shops[shop.id] = emptyShop(shop.id);
    opened++;
  }
  return opened ? done(`Opened ${opened} more shops.`) : done("Every shop is already open.");
}

/** Stocks every ingredient open by today. */
export function stockEverything(c: Campaign, quantity = 40): CheatResult {
  // The pantry holds a few hundred, so the room left is shared across every
  // known ingredient rather than spent on the first few.
  const known = INGREDIENTS.filter((i) => i.day <= c.day);
  const room = Math.max(0, pantryCapacity(c) - pantryCount(c));
  const each = Math.max(1, Math.min(quantity, Math.floor(room / Math.max(1, known.length))));
  let stocked = 0;
  for (const ingredient of known) if (addStock(c, ingredient.id, each)) stocked++;
  c.expansion.ice = Math.max(c.expansion.ice, 100);
  c.expansion.pearls = Math.max(c.expansion.pearls, 100);
  return done(`Stocked ${stocked} ingredients.`);
}

/** Unlocks every decoration and badge, so the collection can be checked whole. */
export function unlockCollection(c: Campaign): CheatResult {
  for (const item of DECOR) if (!c.expansion.decor.includes(item.id)) c.expansion.decor.push(item.id);
  for (const badge of BADGES) if (!c.expansion.badges.includes(badge.id)) c.expansion.badges.push(badge.id);
  return done("The whole collection is unlocked.");
}

function finishTicketCup(s: Shift, ticket: Ticket) {
  const cup = ticket.cups[ticket.cupIndex] ?? ticket.cups.find((x) => !x.ready);
  if (!cup || cup.ready) return false;
  const recipe = RECIPE_BY_ID[cup.recipe];
  cup.started = true;
  cup.run = null;
  cup.warmup = 0;
  for (let step = cup.step; step < recipe.steps.length; step++) {
    cup.grades.push({ skill: recipe.steps[step], grade: 100, result: "test kitchen", source: "cheat" });
  }
  cup.step = recipe.steps.length;
  cup.ready = true;
  cup.readyAt = s.elapsed;
  const next = ticket.cups.findIndex((x) => !x.ready);
  if (next >= 0) ticket.cupIndex = next;
  return true;
}

/** Makes the selected ticket's cup in hand, every step at full marks, ready to hand over. */
export function finishSelectedCup(s: Shift): CheatResult {
  const ticket = s.tickets[s.selected];
  if (!ticket) return refused("Pick a ticket first.");
  return finishTicketCup(s, ticket) ? done("The cup is ready to hand over.") : refused("That cup is already ready.");
}

/** Makes every waiting cup, so the whole rail can be handed over. */
export function finishEveryCup(s: Shift): CheatResult {
  let made = 0;
  for (const ticket of s.tickets) {
    if (!ticket) continue;
    while (finishTicketCup(s, ticket)) made++;
  }
  return made ? done(`Made ${made} cups.`) : refused("Every cup is already ready.");
}

/** Fills every waiting guest's patience. */
export function refillPatience(s: Shift): CheatResult {
  for (const ticket of s.tickets) if (ticket) ticket.patience = ticket.maxPatience;
  return done("Every guest is happy to wait.");
}

/** Adds time to the shift's clock. */
export function addShiftTime(s: Shift, seconds = 60): CheatResult {
  s.duration = Math.min(3600, s.duration + seconds);
  return done(`Added ${seconds} seconds to the shift.`);
}

/** Runs the shift's clock out, so it closes once the guests still in are served. */
/** Closes the shop now: guests still waiting leave without a drink, and the day can be settled. */
export function endShiftNow(s: Shift): CheatResult {
  s.elapsed = Math.max(s.elapsed, s.duration);
  for (const t of s.tickets) if (t) s.lost += t.cups.length;
  s.tickets = s.tickets.map(() => null);
  s.status = "complete";
  return done("The shop is closed for the day.");
}
