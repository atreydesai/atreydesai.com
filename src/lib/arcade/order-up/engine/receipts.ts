import type { Campaign } from "../../orders-campaign.ts";
import type { Cup, Ticket, Receipt, Shift } from "./shift-types.ts";
import { RECIPE_BY_ID, GUEST_BY_ID, SPECIAL_GUESTS } from "../content/index.ts";
import { TUNING } from "./tuning.ts";
import { calendar } from "./calendar.ts";
import { hasFinishingCrew, staffOnDuty, style, MARKETING } from "./management.ts";
import { GARDEN_FEATURE, PREMIUM_MENU, WAIT_ESTIMATE } from "../content/service-program.ts";
import { machineDefinition } from "./equipment.ts";
import { brewMod } from "./upgrades.ts";
import { hasNode } from "./tree-nodes.ts";
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

export function drinkPriceFactors(
  c: Campaign,
  shop: string,
  drink: Pick<Receipt, "recipe" | "grade" | "skills">,
  featured: boolean,
) {
  const family = RECIPE_BY_ID[drink.recipe].family;
  const level = c.expansion.prices[family] ?? 1;
  const earned = drink.grade >= PREMIUM_MENU.minimumGrade;
  const steep = drink.skills.find((mark) => mark.skill === "steep");
  const source = steep?.source;
  const precision = level === 2 && earned && steep && steep.grade >= PREMIUM_MENU.minimumGrade && source &&
    brewMod(c, shop)?.id === "brew-precision" && c.expansion.machines[source]?.shop === shop &&
    machineDefinition(source)?.station === "brew";
  const houseTea = featured && shop === GARDEN_FEATURE.shop && drink.recipe === GARDEN_FEATURE.recipe &&
    drink.grade >= GARDEN_FEATURE.minimumGrade && drink.skills.some(
      (mark) => mark.skill === "steep" && mark.source !== null && mark.source === c.expansion.gardenFeature.calibratedMachine,
    );
  return {
    menuPrice: [0.84, 1, earned ? PREMIUM_MENU.earnedPrice : PREMIUM_MENU.refundPrice][level],
    menuTip: [0.8, 1, earned ? PREMIUM_MENU.earnedTip : PREMIUM_MENU.disappointedTip][level],
    precision: precision ? PREMIUM_MENU.precisionBrewPrice : 1,
    houseTea: houseTea ? GARDEN_FEATURE.premium : 1,
  };
}

export function receiptFor(c: Campaign, s: Shift, t: Ticket, cup: Cup, index: number): Receipt {
  const recipe = RECIPE_BY_ID[cup.recipe],
    guest = GUEST_BY_ID[t.guest],
    special = SPECIAL_GUESTS.find((g) => g.id === t.special),
    today = calendar(c.day),
    grade = Math.min(100, cupGrade(cup, t) + (hasFinishingCrew(c, s.shop) ? 3 : 0));
  const factors = drinkPriceFactors(c, s.shop, { recipe: cup.recipe, grade, skills: cup.grades }, t.featured === true);
  const redeemed = c.expansion.marketing === "loyalty" && hasNode(c, "promo-loyalty-stamp", s.shop) &&
    (c.expansion.visits[t.guest] ?? 0) > 0 && staffOnDuty(c, s.shop).some((person) => person.role === "host");
  const price = Math.round(
    recipe.price *
      TUNING[c.mode].price *
      factors.menuPrice *
      (grade < 45 ? 0.65 : 1) *
      (s.shop === "commissary" ? 0.4 : 1) *
      ((t.refills ?? 0) > 0 ? 0.55 : 1) *
      factors.precision *
      factors.houseTea *
      (grade >= 94 && c.expansion.prices[recipe.family] === 2 && hasNode(c, "menu-tasting-card", s.shop) ? 1.12 : 1) *
      (redeemed ? 0.92 : 1),
  );
  const marketing = MARKETING.find((m) => m.id === c.expansion.marketing);
  const specialTip = t.vip ? 2 : (special?.tips ?? 1);
  const waitTip = t.expectedAt !== undefined && s.elapsed > t.expectedAt ? WAIT_ESTIMATE.missedTip : 1;
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
      factors.menuTip *
      waitTip,
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
