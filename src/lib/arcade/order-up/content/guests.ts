import type { Guest } from "./schema.ts";
import { REGULARS } from "./legacy-menu.ts";
import { INGREDIENTS } from "./ingredients.ts";
import { RECIPES, RECIPE_BY_ID } from "./recipes.ts";
const names = [
  "acorn",
  "ada",
  "almie",
  "anise",
  "aster",
  "auburn",
  "azuki",
  "bamboo",
  "bell",
  "bergamot",
  "birch",
  "bluebell",
  "briar",
  "bubbles",
  "button",
  "cacao",
  "caper",
  "cedar",
  "chamomile",
  "cherry",
  "chestnut",
  "chive",
  "cinder",
  "clement",
  "coco",
  "comet",
  "copper",
  "coriander",
  "cosmo",
  "dahlia",
  "dew",
  "dill",
  "dove",
  "ember",
  "fable",
  "fern",
  "flax",
  "flora",
  "frost",
  "ginger",
  "hazel",
  "hemlock",
  "hickory",
  "holly",
  "indigo",
  "iris",
  "ivy",
  "jade",
  "jasper",
  "jules",
  "kelp",
  "kestrel",
  "lace",
  "laurel",
  "lavender",
  "linden",
  "lotus",
  "lumen",
  "marble",
  "marigold",
  "moss",
  "nectar",
  "nutmeg",
  "opal",
  "orbit",
  "papaya",
  "petal",
  "pistachio",
  "poppy",
  "quince",
  "reed",
  "rosemary",
  "rowan",
  "sage",
  "sorrel",
  "tansy",
  "thyme",
  "willow",
  "yarrow",
  "zinnia",
];
const arcs = [
  ["seed", "sprout", "flower", "bouquet", "greenhouse"],
  ["pencil", "sketch", "canvas", "gallery", "ribbon"],
  ["book", "exam", "cap", "friend", "apron"],
  ["wrench", "wheel", "bicycle", "parcel", "van"],
  ["note", "guitar", "song", "stage", "record"],
  ["ticket", "suitcase", "map", "postcard", "globe"],
  ["yarn", "needle", "scarf", "gift", "heart"],
  ["whisk", "bun", "cake", "candle", "recipe"],
  ["star", "telescope", "moon", "rocket", "lander"],
  ["shoe", "bib", "medal", "photo", "flag"],
];
const emotions = ["question", "sweat", "sparkles", "heart", "music"];
const roles = ["prep", "cashier", "barista", "courier", "host", "runner", "cleaner", "baker", "trainer", "manager"];
function story(index: number) {
  return arcs[index % arcs.length].map((prop, i) => ({ prop, emote: emotions[i] }));
}
const old: Guest[] = REGULARS.map((g, i) => ({
  id: g.id,
  name: g.name,
  day: Math.max(g.day, RECIPE_BY_ID["usual-" + g.id].day),
  favorite: "usual-" + g.id,
  variations: RECIPES.filter(
    (r) =>
      r.family === RECIPE_BY_ID["usual-" + g.id].family && r.day <= Math.max(g.day, RECIPE_BY_ID["usual-" + g.id].day),
  )
    .slice(0, 3)
    .map((r) => r.id),
  portrait: g.id,
  patience: g.patience,
  tips: g.tips,
  story: g.id === "mochi" ? arcs[2].map((prop, i) => ({ prop, emote: emotions[i] })) : story(i),
  keepsake: "keepsake-" + (i + 1),
  role: roles[i % 10],
  art: { kind: "guest", color: "#b69275", motif: g.id, seed: i },
}));
const newIngredients = INGREDIENTS.filter((i) => !i.legacy);
const fresh: Guest[] = names.map((name, i) => {
  const ingredient = newIngredients[i % newIngredients.length];
  const favorite = RECIPES.filter((r) => r.ingredients.some((x) => x.id === ingredient.id)).sort(
    (a, b) => a.day - b.day,
  )[0];
  const day = Math.max(favorite.day, 6 + Math.floor(i / 2));
  return {
    id: name,
    name: name[0].toUpperCase() + name.slice(1),
    day,
    favorite: favorite.id,
    variations: RECIPES.filter((r) => r.ingredients.some((x) => x.id === ingredient.id) && r.day <= day)
      .slice(0, 3)
      .map((r) => r.id),
    portrait: name,
    patience: 0.9 + (i % 7) * 0.05,
    tips: 0.9 + (i % 5) * 0.12,
    story: story(i + 3),
    keepsake: "keepsake-" + ((i % 40) + 1),
    role: roles[i % 10],
    art: { kind: "guest", color: ["#91a17d", "#bf8c75", "#a18da1", "#c9aa6d"][i % 4], motif: name, seed: 100 + i },
  };
});
export const GUESTS: readonly Guest[] = [...old, ...fresh].map((g) => {
  const family = RECIPE_BY_ID[g.favorite].family;
  const variations = [
    ...new Set([
      ...g.variations,
      ...RECIPES.filter((r) => r.family === family && r.id !== g.favorite)
        .sort((a, b) => a.day - b.day)
        .map((r) => r.id),
    ]),
  ].slice(0, 3);
  return { ...g, variations };
});
export const GUEST_BY_ID: Readonly<Record<string, Guest>> = Object.fromEntries(GUESTS.map((g) => [g.id, g]));
