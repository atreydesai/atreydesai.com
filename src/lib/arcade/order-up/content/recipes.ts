import type { Recipe, SkillId } from "./schema.ts";
import { INGREDIENTS, INGREDIENT_BY_ID } from "./ingredients.ts";
import { FAMILIES } from "./families.ts";
import { SKILLS } from "./skills.ts";
import { REGULARS } from "./legacy-menu.ts";

const skillDay = Object.fromEntries(SKILLS.map((s) => [s.id, s.day]));
const familyBases: Record<string, string[]> = {
  "milk-tea": ["black", "milk"],
  "fruit-tea": ["jasmine", "strawberry"],
  float: ["black", "vanilla-scoop"],
  sparkling: ["jasmine", "seltzer"],
  "cheese-foam": ["oolong", "foam-base"],
  slush: ["strawberry", "milk"],
  "fresh-milk": ["milk", "brown-sugar"],
  latte: ["matcha", "milk"],
  layered: ["thai-tea", "condensed"],
  yogurt: ["yogurt", "strawberry"],
  hot: ["black", "milk"],
  snow: ["milk", "red-bean"],
};

/** How each ingredient is said in a drink's name; "" leaves it unsaid. */
const SAY: Record<string, string> = {
  milk: "", "foam-base": "", seltzer: "", fructose: "", "brown-sugar": "brown sugar", "sesame-syrup": "sesame",
  "black-sesame": "black sesame", "osmanthus-syrup": "osmanthus", "rose-syrup": "rose", "rose-tea": "rose",
  "osmanthus-tea": "osmanthus", "thai-tea": "thai", "earl-grey": "earl grey", "butterfly-pea": "butterfly pea",
  "winter-melon": "winter melon", "coconut-milk": "coconut", "sea-salt-cream": "sea salt", condensed: "condensed milk",
  pearls: "pearl", popping: "popping boba", "grass-jelly": "grass jelly", "crystal-boba": "crystal boba",
  "coconut-jelly": "coconut jelly", "red-bean": "red bean", "taro-balls": "taro ball", "mochi-bits": "mochi",
  "lychee-jelly": "lychee jelly", "rainbow-jelly": "rainbow jelly", "cookie-crumble": "cookie", "brulee-crust": "brûlée",
  "passion-fruit": "passion fruit", "lychee-fruit": "lychee", "dragon-fruit": "dragon fruit", "coconut-fruit": "coconut",
  "banana-scoop": "banana", "vanilla-scoop": "vanilla", strawberry: "strawberry", banana: "banana",
};
const NOUN: Record<string, string> = {
  "milk-tea": "milk tea", "fruit-tea": "tea", float: "float", sparkling: "fizz", "cheese-foam": "cheese foam tea",
  slush: "slush", "fresh-milk": "fresh milk", latte: "latte", layered: "layered tea", yogurt: "yogurt drink",
  hot: "tea", snow: "snow bowl",
};
const usedNames = new Set<string>();

/** A drink's name as a boba shop's menu would print it: flavors, then the kind of drink, then any side. */
function menuName(familyId: string, ids: string[], qualifier = "") {
  const unique = [...new Set(ids)];
  const sides = unique.filter((id) => INGREDIENT_BY_ID[id].group === "side" && id !== "ginger");
  // Milk drinks name their tea before the milk ("jasmine oat milk tea"); others name a creamy flavor first.
  const milky = ["milk-tea", "fresh-milk", "latte"].includes(familyId);
  const order = ["syrup", "finish", "fruit", "topping", ...(milky ? ["tea", "milk"] : ["milk", "tea"]), "side"];
  const teas = unique.filter((id) => INGREDIENT_BY_ID[id].group === "tea");
  let words = unique
    .filter((id) => !sides.includes(id))
    // Another tea or coffee is the name; black tea goes unsaid beside it.
    .filter((id) => !(id === "black" && teas.length > 1))
    .sort((a, b) => order.indexOf(INGREDIENT_BY_ID[a].group) - order.indexOf(INGREDIENT_BY_ID[b].group))
    .map((id) => SAY[id] ?? INGREDIENT_BY_ID[id].name.replace(/ (tea|milk|syrup)$/, ""))
    .filter((word, i, all) => word && all.indexOf(word) === i);
  // A plain black milk tea is just a milk tea.
  if (familyId === "milk-tea" && words.length > 1) words = words.filter((word) => word !== "black");
  if (familyId === "yogurt") words = words.filter((word) => word !== "yogurt");
  let noun = NOUN[familyId];
  if (noun.endsWith("milk tea") || noun.endsWith("fresh milk")) words = words.map((word) => word.replace(/ milk$/, ""));
  if (familyId === "hot" && words.includes("coffee")) noun = "";
  if (familyId === "float" && teas.length) noun = words.includes("coffee") ? "float" : "tea float";
  const lead = familyId === "hot" ? "hot" : "";
  const build = (count: number) => [lead, ...words.slice(0, count), noun].filter(Boolean).join(" ");
  let base = build(3);
  if (base.length > 30) base = build(2);
  const side = sides.length ? " & " + INGREDIENT_BY_ID[sides[0]].name.replace(/ batter$/, "").replace(/s$/, "") : "";
  const say = (extra: string) => [extra, base].filter(Boolean).join(" ") + side;
  let name = say(qualifier);
  for (const extra of ["house", "double", "large", "light", "classic"]) {
    if (!usedNames.has(name)) break;
    if (extra !== qualifier) name = say([extra, qualifier].filter(Boolean).join(" "));
  }
  usedNames.add(name);
  return name;
}
/** Every recipe is a buildable ingredient list, not a display-only variation. */
function recipe(
  id: string,
  name: string,
  familyId: string,
  ids: string[],
  sugar: 0 | 1 | 2 | 3 | 4 = 2,
  ice: 0 | 1 | 2 | 3 = 2,
  size: 0 | 1 | 2 = 1,
  extraDay = 1,
): Recipe {
  const family = FAMILIES.find((f) => f.id === familyId)!;
  const ingredients = [...new Set(ids)].map((id) => ({ id, quantity: ids.filter((x) => x === id).length }));
  const steps = [...family.skills] as SkillId[];
  if (ids.includes("pearls")) steps.splice(Math.min(1, steps.length), 0, "pearl-pot");
  if (ids.some((id) => INGREDIENT_BY_ID[id]?.group === "topping") && !steps.includes("topping-ladle"))
    steps.splice(Math.max(0, steps.indexOf("shake")), 0, "topping-ladle");
  if (
    ids.some((id) =>
      ["waffle", "egg-waffle", "taiyaki", "mochi-donut", "scallion-pancake", "mooncake", "zongzi", "tangyuan"].includes(
        id,
      ),
    )
  )
    steps.splice(1, 0, "egg-waffle");
  if (ids.includes("butterfly-pea") && ids.includes("lemon")) steps.splice(steps.length - 2, 0, "colour-change");
  if (ids.includes("brulee-crust")) steps.splice(steps.length - 2, 0, "torch");
  if (ids.includes("sea-salt-cream") && familyId === "hot") steps.push("cream-rosette");
  const day = Math.max(
    extraDay,
    family.day,
    ...ingredients.map((i) => INGREDIENT_BY_ID[i.id].day),
    ...steps.map((s) => skillDay[s]),
  );
  const cost = ingredients.reduce((n, i) => n + INGREDIENT_BY_ID[i.id].price * i.quantity, 0);
  return {
    id,
    name: name.toLowerCase(),
    day,
    family: familyId,
    ingredients,
    steps,
    sugar,
    ice: familyId === "hot" ? 0 : ice,
    size,
    hot: familyId === "hot",
    price: Math.round((440 + cost * 1.8 + size * 60) / 10) * 10,
    shops: [],
    machines: [],
    art: {
      kind: "cup",
      color: INGREDIENT_BY_ID[ids[0]].cupColor,
      motif: familyId,
      seed: id.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
    },
  };
}
export const ORIGINAL_FAVORITES: readonly Recipe[] = REGULARS.map((g) => {
  const r = g.favorite;
  const ingredients = [
    r.tea,
    ...(r.milk ? [r.milk] : []),
    ...r.toppings,
    ...r.mixins,
    r.syrup,
    ...(r.bun ? ["bun"] : []),
  ];
  usedNames.add(r.name.toLowerCase());
  return recipe(
    "usual-" + g.id,
    r.name,
    r.mixins.length ? "fruit-tea" : "milk-tea",
    ingredients,
    r.sugar as 0 | 1 | 2 | 3 | 4,
    r.ice as 0 | 1 | 2 | 3,
    1,
    g.day,
  );
});
const ingredientRecipes: Recipe[] = [];
for (const item of INGREDIENTS) {
  const preferred =
    item.group === "fruit"
      ? ["fruit-tea", "slush", "yogurt", "sparkling"]
      : item.group === "milk"
        ? ["milk-tea", "fresh-milk", "hot", "latte"]
        : item.group === "tea"
          ? ["milk-tea", "fruit-tea", "hot", "layered"]
          : ["milk-tea", "float", "snow", "fresh-milk"];
  for (let variant = 0; variant < 4; variant++) {
    const family = preferred[variant],
      bases = [...familyBases[family]];
    if (item.group === "tea" && bases.some((x) => INGREDIENT_BY_ID[x].group === "tea"))
      bases[bases.findIndex((x) => INGREDIENT_BY_ID[x].group === "tea")] = item.id;
    else if (item.group === "milk" && bases.includes("milk")) bases[bases.indexOf("milk")] = item.id;
    else if (!bases.includes(item.id)) bases.push(item.id);
    if (variant === 3 && item.group === "topping") bases.push(item.id);
    ingredientRecipes.push(
      recipe(
        `blend-${item.id}-${variant}`,
        menuName(family, bases, variant === 3 ? "large" : ""),
        family,
        bases,
        ([2, 1, 0, 3] as const)[variant],
        ([2, 1, 0, 3] as const)[variant],
        variant === 3 ? 2 : 1,
        item.day,
      ),
    );
  }
}
const signatureRecipes: Recipe[] = [];
const signatures: Record<string, string[][]> = {
  "milk-tea": [
    ["black", "milk", "pearls"],
    ["oolong", "peach", "milk"],
    ["jasmine", "lychee-fruit", "oat"],
    ["earl-grey", "honey", "almond"],
  ],
  "fruit-tea": [
    ["green", "passion-fruit", "aloe"],
    ["jasmine", "lychee-fruit"],
    ["oolong", "peach", "honey"],
    ["black", "lemon", "kumquat"],
  ],
  float: [
    ["taro", "vanilla-scoop", "cookie-crumble"],
    ["black", "banana-scoop", "caramel"],
    ["coffee", "vanilla-scoop"],
    ["jasmine", "banana-scoop", "honey"],
  ],
  sparkling: [
    ["jasmine", "yuzu", "seltzer"],
    ["green", "lime", "seltzer"],
    ["rose-tea", "lychee-fruit", "seltzer"],
    ["oolong", "peach", "seltzer"],
  ],
  "cheese-foam": [
    ["oolong", "foam-base"],
    ["green", "sea-salt-cream"],
    ["black", "foam-base", "brulee-crust"],
    ["matcha", "foam-base", "red-bean"],
  ],
  slush: [
    ["strawberry", "milk"],
    ["mango", "coconut-milk"],
    ["avocado", "condensed"],
    ["watermelon", "lime"],
  ],
  "fresh-milk": [
    ["milk", "brown-sugar", "pearls"],
    ["oat", "brown-sugar", "crystal-boba"],
    ["soy", "black-sesame", "taro-balls"],
    ["milk", "pandan", "mochi-bits"],
  ],
  latte: [
    ["matcha", "milk", "red-bean"],
    ["hojicha", "oat"],
    ["coffee", "black", "condensed"],
    ["matcha", "coconut-milk", "honey"],
  ],
  layered: [
    ["thai-tea", "condensed"],
    ["butterfly-pea", "lemon", "honey"],
    ["matcha", "milk", "strawberry"],
    ["coffee", "condensed", "milk"],
  ],
  yogurt: [
    ["yogurt", "strawberry", "chia"],
    ["yogurt", "mango", "sago"],
    ["yogurt", "pineapple"],
    ["yogurt", "grape", "aloe"],
  ],
  hot: [
    ["black", "milk", "sea-salt-cream"],
    ["ginger", "honey", "lemon"],
    ["hojicha", "oat"],
    ["barley", "soy", "black-sesame"],
  ],
  snow: [
    ["milk", "red-bean", "mochi-bits"],
    ["mango", "condensed"],
    ["taro", "taro-balls", "coconut-milk"],
    ["matcha", "milk", "brulee-crust"],
  ],
};
for (const [family, sets] of Object.entries(signatures))
  for (let n = 0; n < sets.length; n++)
    for (let v = 0; v < 2; v++)
      signatureRecipes.push(
        recipe(
          `signature-${family}-${n}-${v}`,
          menuName(family, sets[n], v ? "light" : ""),
          family,
          sets[n],
          v ? 1 : 2,
          v ? 1 : 2,
          v ? 0 : 1,
        ),
      );
export const RECIPES: readonly Recipe[] = [...ORIGINAL_FAVORITES, ...ingredientRecipes, ...signatureRecipes];
export const RECIPE_BY_ID: Readonly<Record<string, Recipe>> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
