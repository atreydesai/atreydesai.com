import type { Campaign } from "../../orders-campaign.ts";
import { BADGES, GOALS, GUEST_BY_ID, POWERUPS, DECOR, RANKS } from "../content/index.ts";
import { calendar } from "./calendar.ts";
import { pick } from "./random.ts";
export function metric(c: Campaign, key: string, amount = 1, grade = 100, job?: string) {
  c.expansion.metrics[key] = (c.expansion.metrics[key] ?? 0) + amount;
  for (const id of c.expansion.selectedGoals) {
    const goal = GOALS.find((g) => g.id === id);
    if (
      goal?.metric === key &&
      grade >= goal.grade &&
      (goal.scale !== "job" || goal.id === job) &&
      (!goal.season || goal.season === calendar(c.day).season.id)
    )
      c.expansion.goalProgress[id] = (c.expansion.goalProgress[id] ?? 0) + amount;
  }
}
export function discoverBadges(c: Campaign) {
  const found: string[] = [];
  for (const badge of BADGES) {
    if (
      badge.day <= c.day &&
      !c.expansion.badges.includes(badge.id) &&
      (c.expansion.metrics[badge.metric] ?? 0) >= badge.target
    ) {
      c.expansion.badges.push(badge.id);
      found.push(badge.id);
      c.xp += 20;
    }
  }
  return found;
}
export function storyVisit(c: Campaign, id: string, quality: number) {
  const guest = GUEST_BY_ID[id];
  if (!guest || quality < 70) return false;
  const before = c.expansion.visits[id] ?? c.regularVisits[id] ?? 0;
  c.expansion.visits[id] = before + 1;
  c.regularVisits[id] = Math.max(c.regularVisits[id] ?? 0, before + 1);
  if (before === 4) {
    metric(c, "stories");
    if (!c.expansion.keepsakes.includes(guest.keepsake)) c.expansion.keepsakes.push(guest.keepsake);
    c.xp += 100;
    return true;
  }
  return false;
}
export function giftPower(c: Campaign, seed: number) {
  const available = POWERUPS.filter((p) => p.day <= c.day),
    gift = pick(available, seed);
  c.expansion.powerups[gift.id] = (c.expansion.powerups[gift.id] ?? 0) + 1;
  return gift.id;
}
export function goalBonus(c: Campaign) {
  let bonus = 0;
  for (const id of c.expansion.selectedGoals) {
    const goal = GOALS.find((g) => g.id === id);
    if (!goal) continue;
    const period =
        goal.scale === "shift" || goal.scale === "job"
          ? c.day
          : goal.scale === "week"
            ? Math.floor((c.day - 1) / 7)
            : Math.floor((c.day - 1) / 28),
      key = `${id}:${period}`;
    if ((c.expansion.goalProgress[id] ?? 0) >= goal.target && !c.expansion.claimedGoals.includes(key)) {
      bonus += goal.reward;
      c.expansion.claimedGoals.push(key);
      metric(c, "goals");
    }
  }
  return bonus;
}
export function beginGoals(c: Campaign) {
  for (const id of c.expansion.selectedGoals) {
    const goal = GOALS.find((g) => g.id === id);
    if (
      goal?.scale === "shift" ||
      goal?.scale === "job" ||
      (goal?.scale === "week" && (c.day - 1) % 7 === 0) ||
      (goal?.scale === "season" && (c.day - 1) % 28 === 0)
    )
      c.expansion.goalProgress[id] = 0;
  }
}
export function updateShopStars(c: Campaign, grade: number, critic = false) {
  const shop = c.expansion.shops[c.expansion.activeShop];
  shop.receipts++;
  shop.quality += grade;
  const average = shop.quality / Math.max(1, shop.receipts);
  const earned =
    1 +
    (shop.receipts >= 8 && average >= 70 ? 1 : 0) +
    (shop.receipts >= 24 && average >= 78 ? 1 : 0) +
    (shop.receipts >= 50 && average >= 85 ? 1 : 0) +
    (shop.receipts >= 90 && average >= 90 ? 1 : 0);
  shop.stars = Math.max(shop.stars, Math.min(5, earned + (critic && grade >= 95 ? 1 : 0)));
}
export function grantRankUnlocks(c: Campaign, before: number, after: number) {
  for (let n = before + 1; n <= after; n++) {
    const rank = RANKS[n - 1];
    if (rank && DECOR.some((d) => d.id === rank.unlock) && !c.expansion.decor.includes(rank.unlock))
      c.expansion.decor.push(rank.unlock);
  }
}
