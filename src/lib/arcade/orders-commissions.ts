import type { ServiceDay, ServiceOrder, ServiceReceipt } from "./orders-service.ts";

export interface CommissionOffer {
  id: string;
  name: string;
  goal: string;
  icon: string;
  deadline: number;
  target: number;
  minQuality: number;
  reward: number;
  kind: "quality" | "fruit" | "prep" | "signature";
}

export interface CommissionProgress {
  id: string;
  deadline: number;
  count: number;
}

export const SHOP_PAINTS = [
  { id: "clay", name: "House clay", source: "", commission: null, cloth: "#687e6d", trim: "#bea87d", apron: "#91a17d" },
  { id: "library", name: "Library blue", source: "Library Tea Break", commission: "quality", cloth: "#576b7d", trim: "#d9bc91", apron: "#809bab" },
  { id: "orchard", name: "Orchard green", source: "Orchard Basket", commission: "fruit", cloth: "#597760", trim: "#e2bc77", apron: "#8f9f6f" },
  { id: "bakery", name: "Baked quince", source: "Bakery Swap", commission: "prep", cloth: "#9b6c4c", trim: "#efcf98", apron: "#cb9068" },
  { id: "sidewalk", name: "Mulberry ink", source: "Sidewalk Menu Club", commission: "signature", cloth: "#775a76", trim: "#d9a88a", apron: "#a989a0" },
] as const;

export type ShopPaintId = typeof SHOP_PAINTS[number]["id"];

export function shopPaint(id: unknown) {
  return SHOP_PAINTS.find((paint) => paint.id === id) ?? SHOP_PAINTS[0];
}

const OFFERS = [
  { kind: "fruit", name: "Orchard Basket", icon: "strawberry", target: [6, 8], quality: [80, 88], reward: [1650, 2100] },
  { kind: "prep", name: "Bakery Swap", icon: "bun", target: [7, 9], quality: [80, 88], reward: [1750, 2250] },
  { kind: "signature", name: "Sidewalk Menu Club", icon: "street-sign", target: [2, 3], quality: [83, 90], reward: [1950, 2450] },
] as const;

export function commissionOffer(day: number, expert: boolean): CommissionOffer | null {
  if (!Number.isSafeInteger(day) || day < 4) return null;
  const week = Math.ceil(day / 7);
  const deadline = week * 7;
  if (!Number.isSafeInteger(deadline)) return null;
  const mode = expert ? 1 : 0;
  const entry = week === 1
    ? { kind: "quality", name: "Library Tea Break", icon: "ticket", target: [5, 6], quality: [80, 87], reward: [1200, 1400] } as const
    : OFFERS[(week - 2) % OFFERS.length];
  const { kind, name, icon } = entry;
  const target = entry.target[mode];
  const minQuality = entry.quality[mode];
  const goal = {
    quality: `Serve ${target} drinks at ${minQuality}% or higher.`,
    fruit: `Match ${target} fruit drinks at ${minQuality}% or higher.`,
    prep: `Serve ${target} orders with fresh pearls or pastries at ${minQuality}% or higher.`,
    signature: `Match ${target} house specials, event specials, or bonus requests at ${minQuality}% or higher.`,
  }[kind];
  return { id: `week-${week}-${kind}`, name, goal, icon, deadline, target, minQuality, reward: entry.reward[mode], kind };
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? Math.max(0, value) : 0;
}

export function normalizeCommission(value: unknown, day: number, expert: boolean): CommissionProgress | null {
  const offer = commissionOffer(day, expert);
  if (!offer || !value || typeof value !== "object") return null;
  const saved = value as Partial<CommissionProgress>;
  if (saved.id !== offer.id || saved.deadline !== offer.deadline || !Number.isSafeInteger(saved.count)) return null;
  return { id: offer.id, deadline: offer.deadline, count: Math.min(offer.target, safeCount(saved.count)) };
}

function matches(offer: CommissionOffer, receipt: ServiceReceipt, order: ServiceOrder): boolean {
  if (receipt.quality < offer.minQuality) return false;
  if (offer.kind === "quality") return true;
  if (receipt.grades.build !== 100) return false;
  if (offer.kind === "fruit") return order.recipe.mixins.length > 0;
  if (offer.kind === "signature") {
    return Boolean(order.houseBlend || order.locationSpecial || order.seasonalSpecial ||
      (order.specialRequest && (receipt.specialBonus ?? 0) > 0));
  }
  const cup = order.cup;
  if (!cup) return false;
  const grades = Object.values(cup.prepQuality).flat();
  return grades.length > 0 && grades.every((grade) => grade >= offer.minQuality);
}

export function commissionCups(offer: CommissionOffer, shift: ServiceDay): number {
  if (commissionOffer(shift.day, shift.expert)?.id !== offer.id) return 0;
  const served = new Map(shift.orders.filter(({ status }) => status === "served").map((order) => [order.id, order]));
  const matched = new Set<string>();
  for (const receipt of shift.receipts) {
    const order = served.get(receipt.orderId);
    if (order && matches(offer, receipt, order)) matched.add(order.id);
  }
  return matched.size;
}

export function advanceCommission(
  progress: CommissionProgress, offer: CommissionOffer, extra: number,
): { progress: CommissionProgress; reward: number } {
  if (progress.id !== offer.id || progress.deadline !== offer.deadline) return { progress, reward: 0 };
  const before = Math.min(offer.target, safeCount(progress.count));
  const count = Math.min(offer.target, before + safeCount(extra));
  const reward = before < offer.target && count === offer.target ? offer.reward : 0;
  return { progress: { ...progress, count }, reward };
}
