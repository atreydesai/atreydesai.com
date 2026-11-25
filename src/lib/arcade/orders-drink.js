// The finished drink, built to turn in place: a sealed cup of tea with its
// toppings against the bottom of the wall and a straw through the film, as
// slices for the arcade's sprite stacker (core/sprite-stack.ts). A perfect
// drink turns once on the counter as it goes over to the guest; nothing the
// player aims at is ever stacked. The turn fits inside the hand-off, which
// is timed by the rules (HAND_OFF_SECONDS), never by the drawing, so it
// costs no time. Under Reduce Motion it isn't drawn at all: the flat cup
// simply goes, as every other drink does.
//
// DOM-free: palette characters out, so the component colours the tea and
// caches each turn as an ordinary sprite.
//
// Characters: O ink outline, t tea, T the tea against the wall (the cup's
// visible side, a shade darker), F the film, f its rim, S straw, and the
// toppings: P pearls, D pudding, J jelly, R red bean.

import { TURN_STEPS, latheSlices, stackGrid } from "./core/sprite-stack.ts";
import { HAND_OFF_SECONDS } from "./orders-engine.js";

/** The slices' width, in cells: about the counter cup's 14 at its rim. */
const SIZE = 13;
/** The cup's radius slice by slice, from the bottom up: it widens to the rim. */
const PROFILE = [4.2, 4.5, 4.8, 5.1, 5.3, 5.5, 5.7, 5.9, 6.1];
/** Slices of straw standing above the film. */
const STRAW_ABOVE = 4;
/** Where the straw goes through the film (its top-left cell): off the middle, so it swings round as the cup turns. */
const STRAW_X = 8;
const STRAW_Y = 5;
/** The cup seen from a little above: how much the round top squashes. */
const SQUASH = 0.6;
/** Toppings along the bottom of the wall, in the first few slices. */
const TOPPING_SLICES = 3;
/** Each topping's character. */
const TOPPING_CHARS = Object.freeze({ pearls: "P", pudding: "D", jelly: "J", redbean: "R" });
/**
 * The turn is shown at this many steps (every other of TURN_STEPS), so the
 * sprites to make for a turn are few and can be made before it plays.
 */
export const TURN_FRAMES = TURN_STEPS / 2;
/** From the stamp, when the turn starts: as the sealer lifts off. It ends at the hand-off. */
export const TURN_FROM = 0.34;

/** @type {Map<string, string[][]>} */
const slicesByKind = new Map();

/**
 * The key for a drink's toppings: the kinds in it, in order ("" for none).
 * @param {ReadonlyArray<{ kind: keyof typeof TOPPING_CHARS }>} toppings
 */
export function toppingKey(toppings) {
  return toppings.map((line) => line.kind).join("+");
}

/**
 * The drink's slices, ground first, for its toppings, made once per kind of drink.
 * @param {string} key from toppingKey
 */
export function drinkSlices(key = "") {
  let slices = slicesByKind.get(key);
  if (slices) return slices;
  const chars = key ? key.split("+").map((kind) => TOPPING_CHARS[/** @type {keyof typeof TOPPING_CHARS} */ (kind)] ?? "P") : [];
  const film = PROFILE.length;
  const layers = [
    ...PROFILE.map((r) => ({ r, fill: "t", rim: "T" })),
    { r: PROFILE[PROFILE.length - 1], fill: "F", rim: "f" },
    // The straw's own slices: nothing round, only the straw (painted below).
    ...Array.from({ length: STRAW_ABOVE }, () => ({ r: -1, fill: "." })),
  ];
  slices = latheSlices(layers, SIZE, (z, x, y, ch) => {
    // Two cells square, so no turn samples it away.
    if (x - STRAW_X >= 0 && x - STRAW_X <= 1 && y - STRAW_Y >= 0 && y - STRAW_Y <= 1 && z >= film) return "S";
    // The toppings every few cells round the bottom of the wall, seeded by
    // place so they never shimmer; two kinds take turns.
    const spot = x * 7 + y * 3 + z * 5;
    if (chars.length && z < TOPPING_SLICES && ch === "T" && spot % 4 === 0) return chars[Math.floor(spot / 4) % chars.length];
    return ch;
  });
  slicesByKind.set(key, slices);
  return slices;
}

/**
 * Which of the TURN_FRAMES steps a share (0..1) of a full turn lands on.
 * @param {number} share
 */
export function turnIndex(share) {
  return ((Math.round(share * TURN_FRAMES) % TURN_FRAMES) + TURN_FRAMES) % TURN_FRAMES;
}

/**
 * How far through its one turn the drink is, `seconds` after the stamp:
 * 0 until the sealer lifts, 1 at the hand-off.
 * @param {number} seconds
 */
export function turnShare(seconds) {
  return Math.min(1, Math.max(0, (seconds - TURN_FROM) / (HAND_OFF_SECONDS - TURN_FROM)));
}

/** @typedef {{ grid: string[], anchorX: number, anchorY: number, foot: number }} DrinkFrame */

/** @type {Map<string, DrinkFrame>} */
const frames = new Map();

/**
 * The drink stacked at one of TURN_FRAMES turns, as a sprite grid with an
 * ink outline round the whole of it, made once. `foot` is the grid's last
 * row with anything in it: stand that on the counter.
 * @param {number} index 0..TURN_FRAMES-1
 * @param {string} [key] from toppingKey
 * @returns {DrinkFrame}
 */
export function drinkGrid(index, key = "") {
  const step = turnIndex(index / TURN_FRAMES);
  const id = `${key}|${step}`;
  let frame = frames.get(id);
  if (!frame) {
    const stacked = stackGrid(drinkSlices(key), { turn: (step / TURN_FRAMES) * Math.PI * 2, squash: SQUASH, spacing: 1, outline: "O" });
    let foot = stacked.grid.length - 1;
    while (foot > 0 && !/[^.]/.test(stacked.grid[foot])) foot -= 1;
    frame = { ...stacked, foot };
    frames.set(id, frame);
  }
  return frame;
}

/** The palette characters a drink grid may use, besides "." for nothing. */
export const DRINK_CHARS = Object.freeze(["O", "t", "T", "F", "f", "S", ...Object.values(TOPPING_CHARS)]);
