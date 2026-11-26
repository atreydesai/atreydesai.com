import { INGREDIENTS, type IngredientId } from "./orders-campaign.ts";
import type { ServiceCup, ServiceOrder, ServiceReceipt } from "./orders-service.ts";

const labels = new Map<IngredientId, string>(INGREDIENTS.map(({ id, name }) => [id, name.toLowerCase()]));
const pleased = ["I could get used to this.", "I'll take the long way home with this.", "Same again next time?", "Worth the stop.", "This one's mine. I'm not sharing."];

export function orderFeedback(order: ServiceOrder, cup: ServiceCup, grades: ServiceReceipt["grades"], quality: number) {
  const { recipe } = order;
  if (quality >= 94) {
    if (recipe.foam && cup.foamed) return "The foam stayed right on top.";
    if (recipe.float && cup.float?.flavor === recipe.float) return "The last sip tasted like the first bite.";
    if (recipe.waffle && (cup.prepQuality.waffle?.[0] ?? 0) >= 92) return "Saved the crispiest corner for last.";
    if (order.reservation) return "I'm taking this back to the table.";
    if (order.houseBlend) return "Keep this one on the chalkboard.";
    const index = [...order.customerId].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % pleased.length;
    return pleased[index];
  }

  const weakest = Math.min(grades.brew, grades.build, grades.finish, grades.wait);
  if (weakest >= 78) return "That hit the spot.";
  if (grades.brew === weakest) {
    if (recipe.accentTea) {
      const teas = [cup.tea, cup.accentTea];
      if (!teas.includes(recipe.tea) || !teas.includes(recipe.accentTea)) return `I ordered ${labels.get(recipe.tea)} and ${labels.get(recipe.accentTea)}.`;
    } else if (cup.tea !== recipe.tea) return `I asked for ${labels.get(recipe.tea)}.`;
    if (cup.milk !== recipe.milk) return recipe.milk ? `I asked for ${labels.get(recipe.milk)}.` : "I take my tea plain.";
    return cup.brew.elapsed > cup.brew.target ? "The tea got a little bitter." : "The tea needed another moment.";
  }
  if (grades.build === weakest) {
    if (cup.ice !== recipe.ice) return cup.ice > recipe.ice ? "Too much ice for me." : "Could use more ice.";
    const ingredients = [...recipe.toppings, ...recipe.mixins];
    const absent = ingredients.find((id) => (cup.ingredients[id] ?? 0) < ingredients.filter((other) => other === id).length);
    if (absent) return `I was missing the ${labels.get(absent)}.`;
    if (recipe.waffle && !cup.ingredients.waffle) return "Could I get my waffle next time?";
    if (recipe.bun && !cup.ingredients.bun) return "Could I get my bun next time?";
    if ((cup.ingredients[recipe.syrup] ?? 0) < recipe.sugar) return "I ordered it a bit sweeter.";
    if ((cup.ingredients[recipe.syrup] ?? 0) > recipe.sugar) return "A little sweet for me.";
    return "The mix was a bit different from my ticket.";
  }
  if (grades.finish === weakest) {
    if (recipe.foam && !cup.foamed) return "I missed the foam cap.";
    if (recipe.float && cup.float?.flavor !== recipe.float) return `I ordered ${labels.get(recipe.float)} on top.`;
    if (recipe.float && cup.float) return "My scoop had started to melt.";
    if (recipe.waffle && (cup.prepQuality.waffle?.[0] ?? 100) < 74) return "The waffle had lost its crisp edges.";
    return "The batch had been sitting a while.";
  }
  return "I nearly missed my ride.";
}
