/**
 * People in the room, head to toe: the chef in an apron, crew in theirs,
 * and the original cast as guests with the customer floor's legs under
 * their portraits. Three steps of walk; a carried cup rides at the hand.
 */
import { figure, TAKEAWAY } from "../../../orders-guests.js";
import type { Palette } from "../../../core/painter.ts";

const INK_PEOPLE = "#30242a";

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

const poseCache = new Map<string, PersonSprite>();
function cached(key: string, make: () => PersonSprite) {
  const hit = poseCache.get(key);
  if (hit) return hit;
  const sprite = make();
  if (poseCache.size > 600) poseCache.clear();
  poseCache.set(key, sprite);
  return sprite;
}

/**
 * A guest sitting: the standing figure down to the shoulders and arms, a lap,
 * and feet hanging just off the floor (drawn lifted to the seat's height).
 * From behind (`back`), the hair covers the face and the lap is hidden by
 * the chair. `swing` moves the feet (a kid on a high stool, a fidget).
 */
export function sittingSprite(name: string, face = "calm", back = false, swing = 0): PersonSprite {
  return cached(`sit|${name}|${face}|${back ? 1 : 0}|${swing % 2}`, () => {
    const f = figure(name.toLowerCase(), face as Parameters<typeof figure>[1]);
    const top = f.grid.slice(0, -1);
    const rows = back ? top.map((row, y) => (y >= 3 && y <= 11 ? row.replace(/[^O.H]/g, "H") : row)) : top;
    const legs = back ? [".OOODDDDDOOO.."] : [".OODDDDDDDDOO.", swing % 2 ? ".ODDO....ODDO." : "..ODDO..ODDO..", swing % 2 ? ".OOO......OOO." : "..OOO...OOO..."];
    return { grid: [...rows, ...legs], palette: { ...f.palette, D: f.palette.D ?? "#655455" } };
  });
}

const KID_SHIRTS = ["#e8b04a", "#7fc4e8", "#e86a5c", "#8fc47a", "#c49ade"];
const KID = [
  "...OOOO...",
  "..OHHHHO..",
  ".OHHHHHHO.",
  ".OHSSSSHO.",
  ".OSESSESO.",
  ".OSSSSSSO.",
  "..OSffSO..",
  "..OCCCCO..",
  ".OCCCCCCO.",
  ".OSCCCCSO.",
  "..ODDDDO..",
];
const KID_FEET = [
  ["..OD..DO..", "..OO..OO.."],
  ["..OD.ODO..", ".OO..OO..."],
  ["..ODO.DO..", "...OO..OO."],
];

/** A child, after a parent's looks: standing or mid-stride, or sitting with their feet swinging. */
export function kidSprite(parent: string, step = 0, sitting = false, swing = 0): PersonSprite {
  return cached(`kid|${parent}|${step % 3}|${sitting ? 1 : 0}|${swing % 2}`, () => {
    const p = figure(parent.toLowerCase(), "calm").palette as Record<string, string>;
    let h = 0;
    for (const ch of parent) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const legs = sitting ? (swing % 2 ? [".OD....DO.", "OO......OO"] : ["..OD..DO..", "..OO..OO.."]) : KID_FEET[step % 3];
    return { grid: [...KID, ...legs], palette: { O: INK_PEOPLE, H: p.H, S: p.S, f: p.f ?? p.S, E: INK_PEOPLE, C: KID_SHIRTS[h % KID_SHIRTS.length], D: "#3a3f44" } };
  });
}

const DOG_COATS = [
  ["#b5835a", "#7a5238", "#ead2b0"],
  ["#3d3a3c", "#262325", "#e8e0d4"],
  ["#e2c48e", "#b08d5a", "#fff1dd"],
  ["#9a9aa2", "#686870", "#f0f0f0"],
];
const DOG: Record<string, string[]> = {
  stand0: ["..........OO.", "O........OBBO", "BO......OBBEO", ".BOOOOOOBBBBN", ".OBBBBBBBBOO.", ".OBWBBBBBO...", ".OBOOOOOBO...", ".OO....OO...."],
  stand1: ["..........OO.", "...O.....OBBO", "..OB....OBBEO", "..BOOOOOOBBBN", ".OBBBBBBBBOO.", ".OBWBBBBBO...", ".OBO..OBO....", "OO...OO......"],
  stand2: ["..........OO.", ".O.......OBBO", "OB......OBBEO", ".BOOOOOOOBBBN", ".OBBBBBBBBOO.", ".OBWBBBBBO...", "..OBOOOBO....", "...OO..OO...."],
  lie0: ["..........OO.", ".........OBBO", "O.......OBBEO", "BOOOOOOOBBBBN", "OBBBBBBBBBOO.", "OOWWOOOOOOO.."],
  lie1: ["..........OO.", ".........OBBO", "........OBBEO", "OOOOOOOOBBBBN", "BBBBBBBBBBOO.", "OOWWOOOOOOO.."],
};

/** A dog, facing right: standing or trotting (`step`), or lying down with its tail thumping (`wag`). */
export function dogSprite(owner: string, step = 0, lying = false, wag = 0): PersonSprite {
  return cached(`dog|${owner}|${step % 3}|${lying ? 1 : 0}|${wag % 2}`, () => {
    let h = 7;
    for (const ch of owner) h = (h * 37 + ch.charCodeAt(0)) >>> 0;
    const [coat, dark, chest] = DOG_COATS[h % DOG_COATS.length];
    const grid = lying ? DOG["lie" + (wag % 2)] : DOG["stand" + (step % 3)];
    return { grid, palette: { O: INK_PEOPLE, B: coat, E: INK_PEOPLE, N: "#2b2126", W: chest, D: dark } };
  });
}

