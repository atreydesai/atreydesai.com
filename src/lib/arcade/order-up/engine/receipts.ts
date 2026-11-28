import type { Campaign } from "../../orders-campaign.ts";
import type { Cup, Ticket, Receipt, Shift } from "./shift-types.ts";
import { RECIPE_BY_ID, GUEST_BY_ID, SPECIAL_GUESTS } from "../content/index.ts";
import { TUNING } from "./tuning.ts";
import { calendar } from "./calendar.ts";
import { style, MARKETING } from "./management.ts";
export function cupGrade(cup: Cup, ticket: Ticket) {
  const skills = cup.grades.reduce((n, g) => n + g.grade, 0) / Math.max(1, cup.grades.length);
  const patience = Math.max(0, Math.min(1, ticket.patience / ticket.maxPatience));
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(skills * 0.9 + Math.min(100, 65 + patience * 50) * 0.1 - cup.damage - (ticket.changeTo ? 15 : 0)),
    ),
  );
}
export function receiptFor(c: Campaign, s: Shift, t: Ticket, cup: Cup, index: number): Receipt {
  const recipe = RECIPE_BY_ID[cup.recipe],
    guest = GUEST_BY_ID[t.guest],
    special = SPECIAL_GUESTS.find((g) => g.id === t.special),
    today = calendar(c.day),
    grade = cupGrade(cup, t);
  const priceLevel = c.expansion.prices[recipe.family] ?? 1;
  const price = Math.round(
    recipe.price *
      TUNING[c.mode].price *
      [0.84, 1, 1.22][priceLevel] *
      (grade < 45 ? 0.65 : 1) *
      (s.shop === "commissary" ? 0.4 : 1) *
      ((t.refills ?? 0) > 0 ? 0.55 : 1),
  );
  const marketing = MARKETING.find((m) => m.id === c.expansion.marketing);
  const specialTip = t.vip ? 2 : (special?.tips ?? 1);
  const tip = Math.round(
    Math.max(0, grade - 55) *
      4.5 *
      (guest?.tips ?? 1) *
      specialTip *
      today.event.tips *
      (today.holiday?.tip ?? 1) *
      (1 + style(c)) *
      (marketing?.tips ?? 1) *
      (s.effects.happy ? 2 : 1) *
      (1 + Math.min(5, s.flow) * 0.04) *
      [0.8, 1, 1.12][priceLevel],
  );
  return {
    id: s.nextId++,
    ticket: t.id,
    guest: t.guest,
    name: t.name,
    recipe: cup.recipe,
    grade,
    skills: structuredClone(cup.grades),
    price,
    tip,
    emote:
      grade >= 97 ? "sparkles" : grade >= 85 ? "heart" : grade >= 65 ? "music" : grade >= 40 ? "question" : "storm",
    special: t.special,
    story: Math.min(4, c.expansion.visits[t.guest] ?? 0),
    packed: t.packed,
    time: s.elapsed,
    cup: index,
  };
}
