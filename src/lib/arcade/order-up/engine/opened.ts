// What the book, the album and the tool belt show on a given day. A new
// player meets the shop a little at a time: a chapter, a page's entries or a
// belt slot appears once its first content is open, or once the save already
// holds some of it (a first-campaign save, a jump back in days), so nothing a
// player owns is ever hidden.
//
// DOM-free, so the schedule can be tested with node.

import type { Campaign } from "../../orders-campaign.ts";
import { BADGES, CREW_ROLES, DECOR, GUESTS, MACHINES, POWERUPS, RECIPES, SHOPS } from "../content/index.ts";
import { unlocks } from "./calendar.ts";

const earliest = (days: number[]) => Math.min(...days);

/** The day each chapter that waits first has something in it: machines, the first hire, a second shop. */
export const CHAPTER_DAYS: Readonly<Record<string, number>> = {
  workshop: earliest(MACHINES.map((m) => m.day)),
  crew: earliest(CREW_ROLES.map((r) => r.day)),
  map: [...SHOPS.map((s) => s.day)].sort((a, b) => a - b)[1] ?? 1,
};

/** Contracts by length, from the day each opens: one shift's first, a season's once a week has passed. */
export const GOAL_SCALE_DAYS: Readonly<Record<string, number>> = { shift: 1, week: 3, job: 5, season: 8 };
/** The daily shift, a scored challenge, opens once the first real shift is done. */
export const DAILY_DAY = 2;

export function goalScaleOpen(c: Campaign, scale: string) {
  return c.day >= (GOAL_SCALE_DAYS[scale] ?? 1);
}

/** The book's chapters in their order; the test kitchen adds its own after them. */
export const CHAPTERS = ["today", "pantry", "workshop", "crew", "map", "collection"] as const;

export function chapterOpen(c: Campaign, id: string) {
  const day = CHAPTER_DAYS[id];
  if (day === undefined || c.day >= day) return true;
  if (id === "workshop") return Object.keys(c.expansion.machines).length > 0 || Object.values(c.expansion.powerups).some((n) => n > 0);
  if (id === "crew") return c.expansion.staff.length > 0;
  if (id === "map") return Object.keys(c.expansion.shops).length > 1;
  return true;
}

export function chapters(c: Campaign): string[] {
  return CHAPTERS.filter((id) => chapterOpen(c, id));
}

/** A chapter opens today: its tab is marked new for the day. */
export function chapterIsNew(c: Campaign, id: string) {
  return CHAPTER_DAYS[id] === c.day;
}

/** A belt slot shows its powerup once the workshop sells it, or while one is held. */
export function beltShows(c: Campaign, id: string) {
  const power = POWERUPS.find((p) => p.id === id);
  if (!power) return false;
  if ((c.expansion.powerups[id] ?? 0) > 0) return true;
  return power.day <= c.day && chapterOpen(c, "workshop");
}

/** The album's entries so far: what is open by today, plus anything already found. */
export function albumRecipes(c: Campaign) {
  return RECIPES.filter((r) => r.day <= c.day || !!c.expansion.recipes[r.id]);
}
export function albumRegulars(c: Campaign) {
  return GUESTS.filter((g) => g.day <= c.day || !!c.expansion.visits[g.id]);
}
export function albumBadges(c: Campaign) {
  return BADGES.filter((b) => b.day <= c.day || c.expansion.badges.includes(b.id));
}
export function albumDecor(c: Campaign) {
  const owned = new Set([...c.expansion.decor, ...c.expansion.keepsakes]);
  return DECOR.filter((d) => d.day <= c.day || owned.has(d.id));
}

/**
 * What Today lists as new: nothing on day 1, when everything is, and after
 * that only what the player acts on in the book. A skill is taught at the
 * counter on first use, a guest arrives in the queue, the day's event heads
 * the book, and decor and contracts have their own pages.
 */
const QUIET = new Set(["decor", "goal", "skill", "guest", "special", "event"]);
export function newToday(c: Campaign) {
  return c.day > 1 ? unlocks(c.day).filter((u) => !QUIET.has(u.kind)) : [];
}

/** The shops page lists the shops open by now and the next one to come. */
export function listedShops(c: Campaign) {
  const next = [...SHOPS].sort((a, b) => a.day - b.day).find((s) => s.day > c.day && !c.expansion.shops[s.id]);
  return SHOPS.filter((s) => s.day <= c.day || !!c.expansion.shops[s.id] || s === next);
}
