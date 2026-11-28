/**
 * The regulars as the room draws them, set into a place at its own density:
 * a guest's figure (14 by 20) lit for the hour, cut off wherever a table or
 * a bench is painted over them, with an emote bubble over a shoulder.
 */
import { figure, EMOTES } from "../../../orders-guests.js";
import type { Painter } from "../../../core/painter.ts";
import type { Tone } from "./kit.ts";

type Face = Parameters<typeof figure>[1];

/** A figure with its bottom-centre at (x, y); returns its top. */
export function seated(p: Painter, t: Tone, name: string, face: string, x: number, y: number, flip = false) {
  const f = figure(name.toLowerCase(), face as Face);
  const grid = f.grid as readonly string[];
  const w = grid[0].length;
  p.sprite(grid, t.palette(f.palette, Math.max(t.f.front, 0.25)), Math.round(x - w / 2), y - grid.length + 1, flip);
  return y - grid.length + 1;
}

/** An emote (heart, drop, star, anger, puff, clock) with its bottom-left at (x, y). */
export function emote(p: Painter, kind: string, x: number, y: number) {
  const e = (EMOTES as Record<string, { grid: readonly string[]; palette: Record<string, string> }>)[kind];
  if (!e) return;
  p.sprite(e.grid as string[], e.palette, x, y - e.grid.length + 1);
}

const LEGS = ["...OCCCCCCO...", "....ODDODO....", "....ODDODO....", "...OOO.OOOO..."];

/** A figure standing, legs and all, with its feet at (x, y). */
export function standing(p: Painter, t: Tone, name: string, face: string, x: number, y: number, flip = false) {
  const f = figure(name.toLowerCase(), face as Face);
  const grid = [...(f.grid as readonly string[]).slice(0, -1), ...LEGS];
  const w = grid[0].length;
  const palette = { ...f.palette, D: (f.palette as Record<string, string>).D ?? "#655455" };
  p.alpha(0.3, () => p.rect("#2b2126", Math.round(x - w / 2) + 2, y, w - 4, 1));
  p.sprite(grid, t.palette(palette, Math.max(t.f.front, 0.25)), Math.round(x - w / 2), y - grid.length + 1, flip);
  return y - grid.length + 1;
}
