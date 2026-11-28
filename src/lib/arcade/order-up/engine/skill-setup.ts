import type { Campaign } from "../../orders-campaign.ts";
import { INGREDIENT_BY_ID } from "../content/ingredients.ts";
import type { Recipe, SkillId } from "../content/schema.ts";

export const MASTERY_RUNS = 6;
export const MASTERY_GRADE = 90;

export function skillMastery(c: Campaign, skill: SkillId) {
  const goodRuns = c.expansion.metrics[`hand-good:${skill}`] ?? 0;
  return { goodRuns, required: MASTERY_RUNS, mastered: goodRuns >= MASTERY_RUNS };
}

export function recipeSkillOptions(recipe: Recipe, skill: SkillId) {
  const tea = recipe.ingredients.find((item) => INGREDIENT_BY_ID[item.id]?.group === "tea")?.id;
  const choices: Partial<Record<SkillId, number>> = {
    pour: Math.min(2, recipe.size),
    "milk-ratio": recipe.sugar <= 1 ? 0 : recipe.sugar >= 3 ? 2 : 1,
    "cheese-foam": recipe.ice <= 1 ? 0 : recipe.ice === 3 ? 2 : 1,
    blender: Math.max(0, recipe.ice - 1),
    "layered-pour": 0,
    "colour-change": 1,
  };
  const wanted = skill === "topping-ladle" ? recipe.ingredients
    .filter(({ id }) => INGREDIENT_BY_ID[id]?.group === "topping")
    .flatMap(({ id, quantity }) => Array(quantity * (recipe.size === 2 ? 2 : 1)).fill(id) as string[]) : undefined;
  return { tea, choice: choices[skill], wanted };
}
