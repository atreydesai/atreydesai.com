/**
 * Things hung on a wall, drawn along its slope: a menu board, a shelf of
 * tins, a clock that keeps the shop's hour, a framed print, a hood over the
 * stove, a sign. Each takes the wall place (its bottom-left on the wall and
 * which way the wall runs) and paints in the scene's light.
 */
import type { Painter, Palette } from "../../../core/painter.ts";
import type { Light } from "../../../core/light.ts";
import { mixHex } from "../../../core/color.ts";
import type { WallItem, WallPlace, WallSide } from "./types.ts";
import { word, wordWidth } from "./font.ts";
import { HW } from "./scene.ts";
import { SPRITES, litPalette, INK } from "./props.ts";

/** A parallelogram on the wall: `w` pixels along it, `h` up, from (x, y). */
export function wallRect(p: Painter, place: WallPlace, along: number, up: number, w: number, h: number, color: string) {
  const s = place.slope;
  const d = place.dir;
  const x0 = place.x + d * along;
  const y0 = place.y + s * along - up;
  p.poly(color, [x0, y0 - h, x0 + d * w, y0 + s * w - h, x0 + d * w, y0 + s * w, x0, y0]);
}

function wallLine(p: Painter, place: WallPlace, a: number, up: number, b: number, color: string) {
  const d = place.dir;
  p.line(color, place.x + d * a, place.y + place.slope * a - up, place.x + d * b, place.y + place.slope * b - up);
}

export function menuBoard(wall: WallSide, at: number, z: number, opts: { w?: number; h?: number; frame?: string; board?: string; title?: string; lines?: string[] } = {}): WallItem {
  const w = opts.w ?? 40;
  const h = opts.h ?? 22;
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const frame = light.lit(opts.frame ?? "#6a4a3a", 0.2);
      const board = light.lit(opts.board ?? "#2f3b37", 0);
      wallRect(p, place, -2, -2, w + 4, h + 4, frame);
      wallRect(p, place, 0, 0, w, h, board);
      const ink = light.lit("#efe4cc", 0.3);
      const title = opts.title ?? "MENU";
      const tx = Math.max(2, Math.round((w - wordWidth(title)) / 2));
      const a = place.dir > 0 ? tx : tx + wordWidth(title) - 1;
      word(p, title, ink, place.x + place.dir * a, place.y + place.slope * a - h + 2, place.slope * place.dir);
      const colors = ["#e8b48a", "#a9c98c", "#c3a0cf", "#f2d58a"];
      for (let i = 0; i < 4; i++) {
        const y = 9 + i * 3;
        if (y > h - 3) break;
        wallLine(p, place, 4, h - y, 4 + Math.round(w * 0.45), light.lit(colors[i], 0.2));
        wallLine(p, place, w - 9, h - y, w - 5, light.lit("#efe4cc", 0.2));
      }
    },
  };
}

export function shelf(wall: WallSide, at: number, z: number, w = 34, items: string[] = ["tin", "jar", "tin", "bottle", "jar"], wood = "#8a6048"): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const pal = (name: string, i: number) => {
        const s = SPRITES[name];
        const tint: Palette = ([{}, { B: "#5f7a5a", D: "#425640", L: "#9fbf8a" }, { B: "#b8573f", D: "#7d3a31", L: "#e48a6a" }, { B: "#8e6a9e", D: "#5e4370", L: "#c3a0cf" }] as Palette[])[i % 4];
        return { grid: s.grid, palette: litPalette({ ...s.palette, ...tint }, light, 0.2) };
      };
      const step = w / items.length;
      items.forEach((name, i) => {
        const along = step * i + step / 2;
        const s = pal(name, i);
        const x = place.x + place.dir * along - Math.floor(s.grid[0].length / 2);
        const y = place.y + place.slope * along - s.grid.length;
        p.sprite(s.grid, s.palette, x, y);
      });
      wallRect(p, place, 0, -2, w, 2, light.lit(wood, 0.3));
      wallLine(p, place, 0, -3, w, light.lit(mixHex(wood, INK, 0.45), 0));
      wallRect(p, place, 3, -6, 1, 4, light.lit(mixHex(wood, INK, 0.3), 0));
      wallRect(p, place, w - 4, -6, 1, 4, light.lit(mixHex(wood, INK, 0.3), 0));
    },
  };
}

/** A round clock whose hands show `hour` (the shop's own time). */
export function clock(wall: WallSide, at: number, z: number, hour: () => number, rim = "#3e3438"): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const cx = place.x;
      const cy = place.y - 5;
      p.oval(light.lit(rim, 0.2), cx, cy, 5, 5);
      p.oval(light.lit("#f3ead6", 0.3), cx, cy, 4, 4);
      const h = hour();
      const hourA = ((h % 12) / 12) * Math.PI * 2;
      const minA = (h % 1) * Math.PI * 2;
      p.line(light.lit(INK, 0), cx, cy, cx + Math.round(Math.sin(hourA) * 2), cy - Math.round(Math.cos(hourA) * 2));
      p.line(light.lit("#b8573f", 0.2), cx, cy, cx + Math.round(Math.sin(minA) * 3), cy - Math.round(Math.cos(minA) * 3));
    },
  };
}

export function framed(wall: WallSide, at: number, z: number, w: number, h: number, paint: (p: Painter, light: Light, x: number, y: number) => void, frame = "#5a4038"): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wallRect(p, place, -1, -1, w + 2, h + 2, light.lit(frame, 0.2));
      wallRect(p, place, 0, 0, w, h, light.lit("#efe3c9", 0.2));
      paint(p, light, place.x + place.dir * Math.round(w / 2), place.y + place.slope * Math.round(w / 2) - Math.round(h / 2));
    },
  };
}

/** A painted sign or lettering straight on the wall. */
export function lettering(wall: WallSide, at: number, z: number, text: string, color: string, plate?: string): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const w = wordWidth(text);
      if (plate) wallRect(p, place, -3, -3, w + 6, 11, light.lit(plate, 0.2));
      const a = place.dir > 0 ? 0 : w - 1;
      word(p, text, light.lit(color, 0.4), place.x + place.dir * a, place.y + place.slope * a - 5, place.slope * place.dir);
    },
  };
}

/** A steel hood over a stove. */
export function hood(wall: WallSide, at: number, z: number, w = 28, steel = "#b9bdbc"): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wallRect(p, place, 2, 0, w - 4, 8, light.lit(mixHex(steel, INK, 0.25), 0.1));
      wallRect(p, place, 0, -6, w, 6, light.lit(steel, 0.4));
      wallLine(p, place, 0, -6, w, light.lit(INK, 0));
      wallLine(p, place, 1, -1, w - 1, light.lit(mixHex(steel, "#ffffff", 0.4), 0.5));
      wallRect(p, place, Math.round(w / 2) - 3, 8, 6, 14, light.lit(mixHex(steel, INK, 0.12), 0.2));
    },
  };
}

/** A wall-mounted rail of small things (cups, ladles). */
export function rail(wall: WallSide, at: number, z: number, w: number, color = "#8a8e90", hang: string[] = ["#e6d8c0", "#c98a6a", "#e6d8c0", "#8fb0a8"]): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wallLine(p, place, 0, 0, w, light.lit(color, 0.3));
      const n = hang.length;
      for (let i = 0; i < n; i++) {
        const along = ((i + 0.5) * w) / n;
        const x = place.x + place.dir * along;
        const y = place.y + place.slope * along;
        p.rect(light.lit(INK, 0), x, y, 1, 2);
        p.rect(light.lit(hang[i], 0.3), x - 2, y + 2, 4, 4);
        p.rect(light.lit(mixHex(hang[i], INK, 0.3), 0.1), x + 1, y + 2, 1, 4);
      }
    },
  };
}

/** Tile ratio of a wall item's `at` (tiles) to pixels along the wall. */
export const alongPx = (tiles: number) => tiles * HW;
