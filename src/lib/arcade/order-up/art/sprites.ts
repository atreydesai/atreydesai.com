/** Hand-drawn cell motifs and orthographic parts. Static turns are cached. */
import { stackGrid, quantizeTurn, latheSlices, type LatheLayer } from "../../core/sprite-stack.ts";
import { mixHex } from "../../core/color.ts";
import { model, block, cut, ellipse, within } from "../../scenery/stacks/orthographic.ts";
import type { ArtRef } from "../content/schema.ts";
import { INGREDIENT_BY_ID, FAMILIES, MACHINES, RECIPE_BY_ID } from "../content/index.ts";
export const INK = "#302b29",
  PAPER = "#f3e6cb",
  SHADOW = "#65544b";
const ICONS: Record<string, string[]> = {
  tea: [
    "................",
    "......ll........",
    "....llll.ll.....",
    "...llll.llll....",
    "...lll.lllll....",
    "....l.lllll.....",
    ".....llll.......",
    "....lll.........",
    "...ll...........",
    "..ll............",
    "..o..oooooo..o..",
    "..o..cccccc..o..",
    "...o.cccccc.o...",
    "...o.cccccc.o...",
    "....oooooooo....",
    "................",
  ],
  milk: [
    ".....oooooo.....",
    "....oppppppo....",
    "....oooooooo....",
    "...occcccccco...",
    "...occcccccco...",
    "...oppppppppo...",
    "...oppppppppo...",
    "...opppccpppo...",
    "...oppccccppo...",
    "...opppccpppo...",
    "...oppppppppo...",
    "...occcccccco...",
    "...occcccccco...",
    "...oooooooooo...",
    "................",
    "................",
  ],
  fruit: [
    "........ll......",
    ".......ll.......",
    ".....ll.ll......",
    "....ooooooo.....",
    "...occccccco....",
    "..ocppcccccco...",
    "..ocpccccccco...",
    "..occccccccco...",
    "..occccccccco...",
    "..occccccccco...",
    "...occccccco....",
    "....ooooooo.....",
    "................",
    "................",
    "................",
    "................",
  ],
  topping: [
    "....oooooooo....",
    "...oppppppppo...",
    "..oooooooooooo..",
    "..oppppppppppo..",
    "..oppppppppppo..",
    "..oppccppccppo..",
    "..opccccccccpo..",
    "..oppccppccppo..",
    "..oppppccppppo..",
    "..opppccccpppo..",
    "..oppccppccppo..",
    "..opccccccccpo..",
    "..oppccppccppo..",
    "...oooooooooo...",
    "................",
    "................",
  ],
  syrup: [
    ".......oooo.....",
    ".......oppo.....",
    ".....oooooo.....",
    ".....oppppo.....",
    ".....occcco.....",
    "....occcccco....",
    "...occcccccco...",
    "...occcccccco...",
    "...oppppppppo...",
    "...opppccpppo...",
    "...oppppppppo...",
    "...occcccccco...",
    "...occcccccco...",
    "....oooooooo....",
    "................",
    "................",
  ],
  side: [
    "................",
    "....ooooooo.....",
    "...occccccco....",
    "..ocpcpcpccco...",
    "..occpcpcccco...",
    "..ocpcpcpccco...",
    "..occpcpcccco...",
    "..ocpcpcpccco...",
    "...occccccco....",
    "....ooooooo.....",
    "..ppppppppppp...",
    "...ppppppppp....",
    "................",
    "................",
    "................",
    "................",
  ],
  machine: [
    ".....oooooo.....",
    "....occcccco....",
    "...occcccccco...",
    "...oppppppppo...",
    "...oppooopppo...",
    "...oppococppo...",
    "...oppooopppo...",
    "...oppppppppo...",
    "...occcccccco...",
    "...occcppccco...",
    "...occcppccco...",
    "...oooooooooo...",
    "....o......o....",
    "................",
    "................",
    "................",
  ],
  skill: [
    "......pp........",
    "......pp........",
    "....pppppp......",
    "....pppppp......",
    "....pppppppp....",
    "....pppppppp....",
    "......pppppp....",
    "......pppppp....",
    "....cccccccc....",
    "....cccccccc....",
    "......cccc......",
    "......cccc......",
    "................",
    "................",
    "................",
    "................",
  ],
  powerup: [
    "......oooo......",
    "....ooccccoo....",
    "...occcccccco...",
    "..occcppcccco...",
    "..occcppcccco...",
    "..occpppppcco...",
    "..occpppppcco...",
    "..occcppcccco...",
    "..occcppcccco...",
    "...occccccco....",
    "....oocccoo.....",
    "......ooo.......",
    "................",
    "................",
    "................",
    "................",
  ],
  badge: [
    "....oooooooo....",
    "...occcccccco...",
    "..occcpppcccco..",
    "..occcpppcccco..",
    "..ocpppppppcco..",
    "..occpppppccco..",
    "..occcpppcccco..",
    "..occcccccccco..",
    "...occcccccco...",
    "....oooooooo....",
    ".....cc..cc.....",
    ".....cc..cc.....",
    "....ccc..ccc....",
    "................",
    "................",
    "................",
  ],
  shop: [
    ".......oo.......",
    "......occo......",
    ".....occcco.....",
    "....occcccco....",
    "...occcccccco...",
    "..oooooooooooo..",
    "..oppppppppppo..",
    "..opcccppccppo..",
    "..opcccppccppo..",
    "..oppppppppppo..",
    "..opppoooppppo..",
    "..opppocoppppo..",
    "..opppocoppppo..",
    "..oooooooooooo..",
    "................",
    "................",
  ],
  event: [
    "...oo......oo...",
    "..oppooooooppo..",
    "..oppppppppppo..",
    "..occcccccccco..",
    "..oooooooooooo..",
    "..oppppppppppo..",
    "..opccppccpppo..",
    "..opccppccpppo..",
    "..oppppppppppo..",
    "..opccppccpppo..",
    "..opccppccpppo..",
    "..oppppppppppo..",
    "..oooooooooooo..",
    "................",
    "................",
    "................",
  ],
  decor: [
    ".......ll.......",
    "....ll.llll.....",
    "....llllll......",
    ".....lllllll....",
    "....llllll......",
    "......ll........",
    "......ll........",
    "...oooooooooo...",
    "....occcccco....",
    "....occcccco....",
    ".....occcco.....",
    ".....occcco.....",
    "......oooo......",
    "................",
    "................",
    "................",
  ],
  cup: [
    ".....o..........",
    ".....o..........",
    ".....o..........",
    "..oooooooooooo..",
    "..oppppppppppo..",
    "...occcccccco...",
    "...occcccccco...",
    "...occcccccco...",
    "...occcccccco...",
    "....occcccco....",
    "....occcccco....",
    "....occoccoo....",
    "....ococcoco....",
    ".....oooooo.....",
    "................",
    "................",
  ],
};
const iconCache = new Map<string, { grid: string[]; palette: Record<string, string> }>();
export function iconSprite(art: ArtRef) {
  const key = JSON.stringify(art);
  let found = iconCache.get(key);
  if (found) return found;
  const base = ICONS[art.kind] ?? ICONS.cup,
    grid = base.map((row) => row.split(""));
  // A tiny stable cut mark makes otherwise related bins distinguishable.
  if (["tea", "milk", "fruit", "topping", "syrup", "side"].includes(art.kind)) {
    const marks = 1 + (art.seed % 3);
    for (let n = 0; n < marks; n++) {
      const x = 5 + n * 2;
      if (grid[8]?.[x] === "c") grid[8][x] = "p";
    }
  }
  found = { grid: grid.map((row) => row.join("")), palette: { o: INK, p: PAPER, c: art.color, l: "#7d9270" } };
  iconCache.set(key, found);
  return found;
}
const modelCache = new Map<string, ReturnType<typeof model>>(),
  stackCache = new Map<string, ReturnType<typeof stackGrid> & { palette: Record<string, string> }>();
export function machineSprite(id: string, tier = 1, turn = 0, working = false) {
  const definition = MACHINES.find((m) => m.id === id) ?? MACHINES[0],
    t = Math.max(1, Math.min(3, tier)),
    key = id + ":" + t;
  let shape = modelCache.get(key);
  if (!shape) {
    const palette = {
      a: t === 1 ? "#aa7d68" : t === 2 ? "#a9bab4" : "#c6a15e",
      b: t === 1 ? "#7d5c50" : t === 2 ? "#6e8c87" : "#8c7149",
      c: PAPER,
      d: "#85a6a1",
      e: INK,
      g: definition.art.color,
      r: "#be755e",
    };
    const parts = [block(0, 0, 0, 6, 5, 2, ["a", "b"], 1), block(0, 1, 2, 5, 4, 6, ["a", "b", "a"], 1)];
    if (definition.station === "brew" || id.includes("pot") || id.includes("cooker")) {
      parts.push(
        cut(
          (x, y) => (ellipse(x, y, 4, 4) ? "c" : ""),
          (y, z) => (Math.abs(y) <= 4 && within(z, 8, 13) ? "a" : ""),
          (x, z) => (Math.abs(x) <= 4 && within(z, 8, 13) ? "a" : ""),
          (x, z) => (Math.abs(x) <= 4 && within(z, 8, 13) ? "b" : ""),
        ),
      );
      parts.push(
        block(0, 0, 14, 4, 4, 1, ["c", "a"], 1),
        block(0, 0, 15, 1, 1, 2, ["e", "e"]),
        block(5, 0, 10, 2, 1, 2, ["a", "b"]),
      );
    } else if (id.includes("blender") || id.includes("whip") || id.includes("shak")) {
      parts.push(
        block(0, 0, 8, 3, 3, 9, ["c", "d"], 1),
        block(0, 0, 17, 4, 4, 1, ["a", "b"], 1),
        block(0, 0, 18, 1, 1, 1, ["c", "c"]),
      );
    } else if (definition.station === "serve") {
      parts.push(
        block(-4, -2, 8, 1, 2, 9, ["a", "b"]),
        block(0, -2, 17, 6, 3, 2, ["a", "b"]),
        block(2, 1, 8, 2, 2, 4, ["c", "d"], 1),
      );
    } else if (definition.station === "front") {
      parts.push(
        block(0, 0, 8, 6, 2, 9, ["a", "b"]),
        block(0, 3, 10, 5, 1, 5, ["d", "d"]),
        block(0, 4, 16, 4, 1, 1, ["c", "c"]),
      );
    } else if (definition.station === "back") {
      parts.push(
        block(0, -3, 8, 6, 1, 11, ["a", "b"]),
        block(0, 0, 12, 6, 4, 1, ["c", "b"]),
        block(0, 0, 18, 6, 4, 1, ["c", "b"]),
      );
    } else {
      parts.push(
        block(0, 0, 8, 5, 4, 3, ["c", "a"], 1),
        block(0, -3, 11, 5, 1, 5, ["a", "b"]),
        block(0, 2, 11, 3, 2, 1, ["r", "r"]),
      );
    }
    // Tiers add knobs and a second brass rail instead of just recolouring.
    for (let i = 0; i < t; i++) parts.push(block(-3 + i * 3, 5, 4, 1, 0, 2, ["e", i === t - 1 ? "g" : "c"]));
    if (t === 3) parts.push(block(0, -4, 18, 6, 1, 1, ["a", "b"]));
    shape = model(19, 17, 21, palette, parts);
    modelCache.set(key, shape);
    if (modelCache.size > 192) modelCache.delete(modelCache.keys().next().value!);
  }
  const angle = quantizeTurn(turn),
    cacheKey = key + ":" + angle;
  let sprite = stackCache.get(cacheKey);
  if (!sprite) {
    sprite = { ...stackGrid(shape.slices, { turn: angle, squash: 0.65, outline: "O" }), palette: shape.palette };
    stackCache.set(cacheKey, sprite);
    if (stackCache.size > 512) stackCache.delete(stackCache.keys().next().value!);
  }
  return sprite;
}
// --- The drink ------------------------------------------------------------------
//
// The drink is the first campaign's stacked cup (`stationCup` in
// orders-station-art.ts) made general: a lathe of discs per cup family, the
// tea, milk, fruit, toppings and finish of any recipe in its own colours, and
// a fill that rises with the steps done. The finished stack is outlined once.

/** Disc radii from the foot up, one slice each, per cup family. */
const PROFILES: Record<string, readonly number[]> = {
  tall: [6, 6.15, 6.38, 6.58, 6.76, 6.96, 7.22, 7.4, 7.64, 7.8, 8.04, 8.2, 8.45, 8.6, 8.8, 9],
  dome: [6, 6.15, 6.38, 6.58, 6.76, 6.96, 7.22, 7.4, 7.64, 7.8, 8.04, 8.2, 8.45, 8.6, 8.8, 9],
  slush: [6.2, 6.4, 6.6, 6.9, 7.2, 7.5, 7.8, 8.1, 8.4, 8.7, 9, 9.3, 9.5, 9.6],
  short: [6.8, 7.1, 7.4, 7.6, 7.8, 8, 8.2, 8.4, 8.6, 8.8],
  mug: [7.4, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6, 7.6],
  bottle: [6.4, 6.7, 6.8, 6.8, 6.8, 6.8, 6.8, 6.8, 6.8, 6.8, 6.6, 6, 5, 3.8, 3.2, 3.2],
  bowl: [4.6, 6.4, 7.8, 8.8, 9.4, 9.7],
};
const CUP_CELLS = 23;
const GLASS = ["#f6eee0", "#ddd2c0", "#b9ad9c"] as const;
const LIQUID_STEPS = new Set(["steep", "kettle-heat", "pour", "milk-ratio", "layered-pour", "blender", "colour-change"]);
const TOPPING_STEPS = new Set(["pearl-pot", "topping-ladle", "fruit-board"]);
const FOAM_STEPS = new Set(["cheese-foam", "cream-rosette"]);

function swatch(color: string) {
  return [mixHex(color, "#fff6e2", 0.3), color, mixHex(color, INK, 0.36)] as const;
}

const cupCache = new Map<string, { grid: string[]; palette: Record<string, string>; anchorX: number; foot: number }>();

/**
 * The cup for `recipeId` with `completedSteps` of its steps done (fractions
 * show a step under way). `turn` spins it on the counter; `damage` (warmth,
 * melt) greys it a little.
 */
export function cupSprite(recipeId: string, completedSteps = 99, turn = 0, damage = 0) {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) return { ...iconSprite({ kind: "cup", color: "#b08064", seed: 1, motif: "cup" }), anchorX: 8, foot: 15 };
  const steps = recipe.steps;
  const done = Math.max(0, Math.min(steps.length, completedSteps));
  const whole = Math.floor(done);
  const angle = quantizeTurn(turn);
  const key = recipeId + ":" + Math.round(done * 4) / 4 + ":" + Math.floor(damage / 10) + ":" + angle.toFixed(3);
  const hit = cupCache.get(key);
  if (hit) return hit;

  const family = FAMILIES.find((f) => f.id === recipe.family)!;
  const shape = family.silhouette;
  const profile = PROFILES[shape] ?? PROFILES.tall;
  const film = profile.length;
  const items = recipe.ingredients.map((i) => INGREDIENT_BY_ID[i.id]).filter(Boolean);
  const group = (g: string) => items.filter((i) => i.group === g);
  const teaItem = group("tea")[0];
  const milkItem = group("milk")[0];
  const fruits = [...group("fruit"), ...group("syrup")].slice(0, 2);
  const toppings = group("topping").slice(0, 3);
  const scoop = group("finish").find((i) => i.id.endsWith("scoop"));
  const did = (set: Set<string>) => steps.slice(0, whole).some((id) => set.has(id));
  const has = (id: string) => steps.slice(0, whole).includes(id as never);

  // How full: the share of the recipe's pouring steps done, eased toward a step under way.
  const pours = steps.filter((id) => LIQUID_STEPS.has(id));
  const poured = steps.slice(0, whole).filter((id) => LIQUID_STEPS.has(id)).length;
  const pouring = whole < steps.length && LIQUID_STEPS.has(steps[whole]) ? done - whole : 0;
  const fill = pours.length ? Math.min(1, (poured + pouring) / pours.length) : whole > 0 ? 1 : 0;
  const level = Math.round(fill * (film - 1));
  const milkIn = !!milkItem && (has("milk-ratio") || (!steps.includes("milk-ratio") && fill > 0.5));
  const toppingsIn = toppings.length > 0 && (did(TOPPING_STEPS) || fill >= 1);
  const foamed = did(FOAM_STEPS) || (family.id === "cheese-foam" && whole >= steps.length);
  const sealed = has("seal") || (whole >= steps.length && !["mug", "bowl"].includes(shape) && !foamed && !scoop);
  const straw = has("straw-stab") || (whole >= steps.length && sealed);
  const scooped = !!scoop && whole >= steps.length;
  const icy = !recipe.hot && recipe.ice > 0 && fill > 0.4 && !foamed && !scooped;
  const sparkling = family.id === "sparkling" && fill > 0;

  const tea = swatch(
    family.id === "snow" ? mixHex(teaItem?.cupColor ?? milkItem?.cupColor ?? "#eed8b0", "#fff8ec", 0.55)
      : (teaItem?.cupColor ?? milkItem?.cupColor ?? fruits[0]?.cupColor ?? "#d8b98e"),
  );
  const body = milkIn && teaItem && family.id !== "layered" ? swatch(mixHex(tea[1], milkItem!.cupColor, 0.46)) : milkItem && !teaItem ? swatch(milkItem.cupColor) : tea;
  const stale = Math.min(0.35, damage / 60);
  const palette: Record<string, string> = {
    O: "#3f2b2a",
    H: mixHex(body[0], "#c7bba8", stale), T: mixHex(body[1], "#b7ab98", stale), D: mixHex(body[2], "#8e8274", stale),
    M: milkItem ? swatch(milkItem.cupColor)[1] : GLASS[1], m: milkItem ? swatch(milkItem.cupColor)[2] : GLASS[2],
    e: GLASS[0], E: GLASS[1], g: GLASS[2],
    F: "#f3dba9", f: "#aa765d", S: "#f8e3ad", s: "#b45348",
    W: "#fff2d9", L: "#eed3a4", I: "#e5efcf", i: "#a9bcb0",
    P: "#fff5d7", p: "#e8cba0", B: "#fff3bd", b: "#ffd595",
    Q: scoop ? swatch(scoop.cupColor)[0] : "#fff3d8", q: scoop ? swatch(scoop.cupColor)[2] : "#d6bb98",
    K: fruits[0] ? swatch(fruits[0].cupColor)[1] : "#f19a88", k: fruits[0] ? swatch(fruits[0].cupColor)[2] : "#9e494f",
    U: fruits[1] ? swatch(fruits[1].cupColor)[1] : "#fae296", u: fruits[1] ? swatch(fruits[1].cupColor)[2] : "#a87549",
    a: toppings[0] ? mixHex(toppings[0].cupColor, INK, 0.25) : "#523338",
    c: toppings[1] ? mixHex(toppings[1].cupColor, INK, 0.25) : "#e69a3f",
    d: toppings[2] ? mixHex(toppings[2].cupColor, INK, 0.25) : "#f6d77c",
    // The cup's own kraft for a mug or bowl, glass for the rest.
    G: shape === "mug" ? "#e9d6b4" : shape === "bowl" ? "#e7d3b0" : GLASS[0],
    R: shape === "mug" ? "#b98b67" : shape === "bowl" ? "#a98563" : GLASS[2],
  };
  const fruitDepth = fill > 0 && fruits.length ? Math.min(level, 2 + fruits.length * 2) : 0;
  const opaque = shape === "mug" || shape === "bowl";
  const layers: LatheLayer[] = profile.map((r, z) => {
    // A mug or bowl is one glazed wall: its slices share a colour, so no seams show.
    if (opaque) return { r, fill: z === film - 1 ? "G" : "R", rim: "R" };
    if (z > level || fill === 0) return { r, fill: "e", rim: "g" };
    if (z < fruitDepth) return z < fruitDepth / 2 || fruits.length < 2 ? { r, fill: "K", rim: "k" } : { r, fill: "U", rim: "u" };
    // A layered drink keeps its milk under the tea; elsewhere milk is already in the colour.
    if (family.id === "layered" && milkItem && z < Math.max(3, Math.round(level * 0.45))) return { r, fill: "M", rim: "m" };
    if (z === level) return { r, fill: "H", rim: "D" };
    return { r, fill: "T", rim: "D" };
  });
  const lidRadius = profile[film - 1] + (sealed ? 0.35 : 0.2);
  if (!opaque && !["bottle"].includes(shape)) layers.push({ r: lidRadius, fill: sealed ? "F" : ".", rim: sealed ? "f" : "." });
  if (shape === "bottle") layers.push({ r: 3.6, fill: "s", rim: "s" }, { r: 3.6, fill: "s", rim: "O" });
  const domeRadii = (shape === "dome" || shape === "slush") && sealed ? [8.4, 7.6, 6.4, 4.6] : [];
  const moundRadii = shape === "bowl" && fill > 0 ? [8.4, 7.6, 6.6, 5.2, 3.4] : [];
  const scoopRadii = scooped ? [6.2, 6.5, 6.1, 5.5, 4.7, 3.8, 2.4] : [];
  const extra = Math.max(domeRadii.length, scoopRadii.length, moundRadii.length, straw ? 6 : 0);
  for (let n = 0; n < extra; n++) layers.push({ r: -1, fill: "." });

  const centre = (CUP_CELLS - 1) / 2;
  const top = shape === "bottle" ? film + 1 : film;
  const iceCubes = icy ? [[7, 9], [13, 11], [11, 6]].slice(0, recipe.ice) : [];
  const slices = latheSlices(layers, CUP_CELLS, (z, x, y, cell) => {
    const dx = x - centre;
    const dy = y - centre;
    // A straw through the lid, in the shop's red and cream.
    if (straw && z >= film - 2 && Math.abs(dx - 2) <= 0.6 && Math.abs(dy + 1) <= 0.6) return z % 3 ? "S" : "s";
    // A clear dome over foam or slush, its frame in the lid's paper.
    if (domeRadii.length && z > film) {
      const r = domeRadii[z - film - 1];
      if (r !== undefined && Math.hypot(dx, dy) <= r + 0.2) return Math.hypot(dx, dy) > r - 1 ? "f" : "E";
    }
    // Shaved ice heaped over a bowl, toppings spilling down its sides.
    if (moundRadii.length && z >= film) {
      const r = moundRadii[z - film];
      const d = Math.hypot(dx, dy);
      if (r !== undefined && d <= r) {
        if (toppingsIn && (x * 7 + y * 5 + z) % 11 < toppings.length + 1) return "acd"[(x + y + z) % toppings.length];
        return d >= r - 1 ? "D" : (x + y * 2) % 7 === 0 ? "W" : "H";
      }
    }
    if (scooped && z > top) {
      const r = scoopRadii[z - top - 1];
      const d = Math.hypot(dx + 1, dy);
      if (r !== undefined && d <= r) return d >= r - 1.1 ? "q" : "Q";
    }
    // A mug's handle, out past its wall on the right.
    if (shape === "mug" && z >= 3 && z <= 9 && Math.abs(dy) <= 1.2) {
      if ((z === 3 || z === 9) && dx > 6.6 && dx <= 10) return "R";
      if (dx > 9 && dx <= 10.4) return "R";
    }
    if (cell === ".") return cell;
    // The surface: ice, foam, bubbles or the tea itself.
    if (z === level && fill > 0 && !opaque && Math.hypot(dx, dy) < profile[z] - 1) {
      if (foamed) return (x * 5 + y * 3) % 13 < 2 ? "p" : "P";
      const cube = iceCubes.find(([cx, cy]) => Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1);
      if (cube) return x > cube[0] || y > cube[1] ? "i" : "I";
      return (x * 3 + y) % 11 === 0 ? "W" : "H";
    }
    if (opaque && z === film - 1 && Math.hypot(dx, dy) < profile[z] - 1) {
      if (fill === 0) return "g";
      if (foamed) return (x * 5 + y * 3) % 13 < 2 ? "p" : "P";
      return toppingsIn && (x * 7 + y * 5) % 9 < toppings.length ? "abc"[(x + y) % toppings.length] : "H";
    }
    const rim = cell === "D" || cell === "m" || cell === "k" || cell === "u" || cell === "g" || cell === "R";
    if (!rim) return cell;
    if (!opaque && toppingsIn && z < 5 && z <= level && (x * 5 + y * 3 + z * 7) % 13 < 2 + toppings.length) {
      return "acd"[(x * 2 + y + Math.floor(z / 2)) % toppings.length];
    }
    if (!opaque && foamed && z >= level - 2 && z <= level && fill > 0) return "p";
    if (sparkling && z < level && (x * 11 + y * 13 + z * 3) % 17 === 0) return z % 2 ? "B" : "b";
    // A narrow reflection down the glass, toward the light.
    if (!opaque && dx <= -4 && dy >= -1 && dy <= 4 && z > 3 && z < film - 1) return z % 5 ? "W" : cell === "g" ? "E" : "H";
    return cell;
  });
  const stacked = stackGrid(slices, { turn: angle, squash: 0.52, spacing: 1.28, outline: "O" });
  const foot = stacked.grid.findLastIndex((row) => /[^.]/.test(row));
  const sprite = { grid: stacked.grid, palette, anchorX: stacked.anchorX, foot };
  cupCache.set(key, sprite);
  if (cupCache.size > 256) cupCache.delete(cupCache.keys().next().value!);
  return sprite;
}

export function cacheStats() {
  return { icons: iconCache.size, models: modelCache.size, stacks: stackCache.size, cups: cupCache.size };
}
