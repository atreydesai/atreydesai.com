/**
 * People in the room, head to toe: the chef in an apron, crew in theirs,
 * and the original cast as guests with the customer floor's legs under
 * their portraits. Three steps of walk; a carried cup rides at the hand.
 */
import { figure, TAKEAWAY } from "../../../orders-guests.js";
import type { Palette } from "../../../core/painter.ts";

export interface PersonSprite {
  grid: string[];
  palette: Palette;
}

const CHEF = [
  "....OOOOOO....", "...OHWHHHHO...", "..OHWWHHHHHO..", "..OHHHHHHHHO..", "...OHHHHHHO...",
  "...OOOOOOOO...", "..OODDDDDDOO..", "..OSSSSSSSSO..", "..OSOSSSOSSO..", "..OSSSSSSSSO..",
  "...OSSSSSSO...", "....ODDDOO....", "...ORHHHHRO...", "..ORHHHHHHRO..", "..ORHAAAAHRO..",
  "..OSHAAAAHSO..", "...OHAAHAHO...", "...OHAAAAHO...", "...OAAAAAAO...",
];
const CHEF_INK: Palette = { O: "#30242a", H: "#efd3a7", W: "#ffe7b9", D: "#655455", S: "#d69b74", R: "#be6357", A: "#91a17d" };

const FEET = [
  ["....ODDODO....", "....ODDODO....", "...OOO.OOOO..."],
  ["....ODDODO....", "...ODDO.OO....", "...OOO........"],
  ["....ODDODO....", "....OO.ODDO...", ".......OOOO..."],
];

/** The chef, standing (step 0) or mid-stride (1, 2), apron in `apron`. */
export function chefSprite(step = 0, apron = "#91a17d"): PersonSprite {
  return { grid: [...CHEF, ...FEET[step % 3]], palette: { ...CHEF_INK, A: apron } };
}

const guestCache = new Map<string, PersonSprite>();

/** A guest by name (the cast's looks), with a face and a step. */
export function guestSprite(name: string, face = "calm", step = 0): PersonSprite {
  const key = name + "|" + face + "|" + (step % 3);
  const hit = guestCache.get(key);
  if (hit) return hit;
  const f = figure(name.toLowerCase(), face as Parameters<typeof figure>[1]);
  const grid = [...f.grid.slice(0, -1), ".OOODDDDDOOO..", ...FEET[step % 3]];
  const sprite = { grid, palette: { ...f.palette, D: f.palette.D ?? "#655455" } };
  if (guestCache.size > 400) guestCache.clear();
  guestCache.set(key, sprite);
  return sprite;
}

/** A takeaway cup to carry. */
export const CARRY: PersonSprite = { grid: TAKEAWAY.grid as unknown as string[], palette: { ...TAKEAWAY.palette, T: "#c78f62" } };
