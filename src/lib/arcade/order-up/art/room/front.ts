/**
 * The shop front on: the order window from behind the counter, and the
 * shopfront from across the pavement. Both are baked per venue and light
 * like the room: the window shows the venue's own outside (its street,
 * quad, beach or crater field) framed in its own walls over its own
 * counter; the street shows its facade between the neighbours with the
 * sun's shadow under the awning. People are drawn over the bake each frame.
 */
import { Painter, noise, halfGrid } from "../../../core/painter.ts";
import { PixelBuffer, packColor } from "../../../core/pixel-buffer.ts";
import { bayer } from "../../../core/dither.ts";
import { mixHex } from "../../../core/color.ts";
import type { Light } from "../../../core/light.ts";
import type { Venue, FacadeSpec, FrontBox } from "./types.ts";
import { SPRITES, litPalette, INK } from "./props.ts";
import { bigWord, bigWidth, word } from "./font.ts";
/**
 * The drink sprites are drawn by the page, not the bake worker, so they're
 * handed in rather than imported: the worker never loads the recipe tables.
 */
type CupSprite = { grid: readonly string[]; palette: Record<string, string>; anchorX: number; foot: number };
let cupFor: ((recipe: string) => CupSprite) | null = null;
export function useCupSprites(fn: (recipe: string) => CupSprite) {
  cupFor = fn;
}

export const FRONT_HEIGHT = 150;
/** The window view is closer: a smaller canvas, so everything in it is bigger. */
export const WINDOW_HEIGHT = 100;
/** Where the pass's top edge is in the window view; guests stand behind it. */
export const PASS_Y = 68;
/** The pavement line in the street view. */
export const KERB_Y = 124;

const CREAM = "#fff1dd";

export interface BakedFront {
  width: number;
  height: number;
  light: Light;
  outdoor: Light;
  background: PixelBuffer;
  /** Where people stand: the pass line, or the pavement. */
  line: number;
  /** The street view's door, for the queue. */
  door?: { x: number; y: number };
}

function lit(light: Light, hex: string, face = 0.3, glow = 0) {
  return light.lit(hex, face, glow);
}

/** The order window: looking out over the pass at the guests and the venue's outside. */
export function bakeWindow(v: Venue, light: Light, outdoor: Light, width: number): BakedFront {
  const H = WINDOW_HEIGHT;
  const buf = new PixelBuffer(width, H);
  const p = new Painter(buf, width, H);
  const opening = { x0: 10, x1: width - 10, y0: 8, y1: PASS_Y };
  const glassH = opening.y1 - opening.y0;
  // Outside, through the opening: the venue's view above, its own ground where the guests stand.
  const groundTop = opening.y0 + Math.round(glassH * 0.5);
  const sunFace = Math.min(1, outdoor.sun * (0.4 + 0.6 * outdoor.elevation));
  for (let y = opening.y0; y < opening.y1; y++)
    for (let x = opening.x0; x < opening.x1; x++) {
      if (y < groundTop) {
        const vv = 1 - (y - opening.y0) / (groundTop - opening.y0);
        buf.set(x, y, packColor(v.outside.view(x * 1.3, 0.3 + vv * 0.7, outdoor, "right", 40)));
      } else {
        const depth = (y - groundTop) / (opening.y1 - groundTop);
        const gx = (x - width / 2) / (10 + depth * 14);
        const gy = v.rows + 4 - depth * 3;
        buf.set(x, y, packColor(outdoor.lit(v.outside.ground(gx, gy, outdoor), sunFace)));
      }
    }
  // The pass's shadow on the ground behind it, and a soft shade under the header.
  for (let y = opening.y1 - 3; y < opening.y1; y++)
    for (let x = opening.x0; x < opening.x1; x++) if (bayer(x, y) < 0.5) buf.set(x, y, packColor(lit(outdoor, "#4a3c3c", 0)));
  for (let y = opening.y0; y < opening.y0 + 6; y++)
    for (let x = opening.x0; x < opening.x1; x++) if (bayer(x, y) < 0.45 - (y - opening.y0) / 14) buf.set(x, y, packColor(lit(light, INK, 0)));
  const wallColors = v.wall.colors;
  const paintWall = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const slot = v.wall.at(x * 1.4, (H - y) * 1.4);
        buf.set(x, y, packColor(lit(light, wallColors[slot], 0.1)));
      }
  };
  paintWall(0, 0, width, opening.y0);
  paintWall(0, opening.y0, opening.x0, opening.y1);
  paintWall(opening.x1, opening.y0, width, opening.y1);
  // The opening's frame and sill.
  const frame = lit(light, mixHex(v.counter.trim, INK, 0.25), 0.2);
  const frameLight = lit(light, mixHex(v.counter.trim, CREAM, 0.25), 0.4);
  p.rect(frame, opening.x0 - 3, opening.y0 - 3, opening.x1 - opening.x0 + 6, 3);
  p.rect(frame, opening.x0 - 3, opening.y0, 3, glassH);
  p.rect(frame, opening.x1, opening.y0, 3, glassH);
  p.rect(frameLight, opening.x0 - 3, opening.y0 - 3, opening.x1 - opening.x0 + 6, 1);
  p.rect(INK, opening.x0, opening.y0, opening.x1 - opening.x0, 1);
  // The pass: worktop, its lip, the counter front with the venue's panels.
  const top = lit(light, v.counter.top, 0.5);
  p.rect(top, 0, PASS_Y, width, 5);
  p.rect(lit(light, mixHex(v.counter.top, CREAM, 0.3), 0.6), 0, PASS_Y, width, 1);
  p.rect(INK, 0, PASS_Y + 5, width, 1);
  const front = v.counter.front;
  for (let y = PASS_Y + 6; y < H; y++)
    for (let x = 0; x < width; x++) {
      const panel = v.counter.panel ?? "drawers";
      let c = front;
      if (panel === "slats" || panel === "bamboo") c = x % 7 === 0 ? mixHex(front, INK, 0.3) : front;
      else if (panel === "tile") c = x % 9 === 0 || (y - PASS_Y) % 9 === 0 ? mixHex(front, CREAM, 0.2) : front;
      else if (panel === "log" || panel === "crate") c = (y - PASS_Y) % 7 === 0 ? mixHex(front, INK, 0.3) : front;
      else if (panel === "steel") c = y === PASS_Y + 14 ? mixHex(front, CREAM, 0.35) : front;
      else if (panel === "drawers") c = x % 64 === 0 || y === PASS_Y + 8 || y === H - 6 ? mixHex(front, INK, 0.35) : x % 64 >= 28 && x % 64 <= 34 && y === PASS_Y + 13 ? mixHex(front, CREAM, 0.4) : front;
      const shade = y > H - 10 && bayer(x, y) < (y - (H - 10)) / 14;
      buf.set(x, y, packColor(lit(light, shade ? mixHex(c, INK, 0.3) : c, 0.15)));
    }
  // Things on the pass: a bell, the napkins, a tip jar, a straw cup.
  const on = (name: string, x: number, recolor?: Record<string, string>) => {
    const s = SPRITES[name];
    p.sprite(s.grid, litPalette({ ...s.palette, ...recolor }, light, 0.4), x, PASS_Y + 1 - s.grid.length);
  };
  const bell = width - 34;
  p.rect(lit(light, "#3a2c2c", 0), bell - 4, PASS_Y - 1, 9, 2);
  p.oval(lit(light, "#d6a367", 0.6), bell, PASS_Y - 4, 4, 3);
  p.rect(lit(light, "#f6d79a", 0.8), bell - 2, PASS_Y - 6, 2, 1);
  p.rect(lit(light, "#3a2c2c", 0), bell, PASS_Y - 9, 1, 2);
  on("tin", 16, { L: "#e8d7b3", B: "#cdb88f" });
  on("cups", 24);
  on("jar", width - 20, { B: "#d7c08a", D: "#a48f6a", C: "#7c9a7a" });
  return { width, height: H, light, outdoor, background: buf, line: PASS_Y };
}

/** The guests' place along the pass: evenly spaced in the opening's left part, the bell end kept clear. */
export function windowSpots(width: number, count: number) {
  const left = 34;
  const right = width - 70;
  const step = Math.min(30, (right - left) / Math.max(1, count - 1));
  return Array.from({ length: count }, (_, i) => Math.round(left + i * step));
}

/** A neighbour's frontage: brick or render, sash windows lit after dark. */
function neighbour(p: Painter, light: Light, x0: number, x1: number, top: number, ground: number, seed: number) {
  const tones = ["#b88a70", "#c9b48e", "#9aa59a", "#b7958a", "#a9a3b8"];
  const base = tones[Math.floor(noise(seed, 1, 5) * tones.length)];
  const wall = lit(light, base, 0.5);
  const shade = lit(light, mixHex(base, INK, 0.2), 0.3);
  p.rect(wall, x0, top, x1 - x0, ground - top);
  for (let y = top + 3; y < ground; y += 4) p.rect(shade, x0, y, x1 - x0, 1);
  p.rect(lit(light, mixHex(base, INK, 0.4), 0.2), x0, top, x1 - x0, 3);
  const lightOn = light.night > 0.4;
  for (let wy = top + 10; wy < ground - 30; wy += 22)
    for (let wx = x0 + 6; wx + 12 < x1 - 2; wx += 20) {
      const lit1 = lightOn && noise(wx, wy, seed) < 0.6;
      p.rect(lit(light, INK, 0), wx - 1, wy - 1, 14, 18);
      p.rect(lit1 ? "#f0cf8a" : lit(light, mixHex(light.sky[1], "#3b3440", 0.4), 0.5), wx, wy, 12, 16);
      p.rect(lit(light, mixHex(base, CREAM, 0.3), 0.5), wx, wy + 7, 12, 1);
      p.rect(lit(light, mixHex(base, CREAM, 0.3), 0.6), wx - 2, wy + 16, 16, 2);
    }
  // A ground-floor shop window.
  const sw = x1 - x0 - 12;
  p.rect(lit(light, INK, 0), x0 + 5, ground - 26, sw + 2, 26);
  p.rect(lightOn ? "#e8c98a" : lit(light, "#7d8a90", 0.4), x0 + 6, ground - 25, sw, 20);
  p.rect(lit(light, mixHex(base, INK, 0.3), 0.3), x0 + 6, ground - 5, sw, 5);
}

/** The drink in the shop window, stood on the sill. */
export function displayCup(p: Painter, light: Light, recipe: string, x: number, y: number) {
  if (!cupFor) return;
  const cup = cupFor(recipe);
  const pal: Record<string, string> = {};
  for (const [k, c] of Object.entries(cup.palette)) pal[k] = light.lit(c, 0.4, 0.4);
  const small = halfGrid(cup.grid as string[]);
  p.alpha(0.3, () => p.rect(INK, x - 5, y - 1, 10, 2));
  p.sprite(small, pal, Math.round(x - cup.anchorX / 2), Math.round(y - cup.foot / 2));
}

/** A generic shopfront from a facade spec: walls, cornice, sign, awning, window and door. */
function shopfront(p: Painter, buf: PixelBuffer, light: Light, f: FacadeSpec, box: FrontBox) {
  const { x, y, w, h, ground } = box;
  const colors = f.wall.colors;
  for (let yy = y; yy < ground; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const slot = f.wall.at((xx - x) * 1, ground - yy);
      buf.set(xx, yy, packColor(light.lit(colors[slot], Math.min(1, light.sun * 0.55))));
    }
  void h;
  // Cornice and pilasters.
  p.rect(lit(light, f.trim, 0.6), x - 3, y - 4, w + 6, 4);
  p.rect(lit(light, mixHex(f.trim, CREAM, 0.3), 0.8), x - 3, y - 4, w + 6, 1);
  p.rect(lit(light, mixHex(f.trim, INK, 0.3), 0.2), x - 3, y, w + 6, 1);
  p.rect(lit(light, f.trim, 0.3), x, y, 4, ground - y);
  p.rect(lit(light, f.trim, 0.3), x + w - 4, y, 4, ground - y);
  const shopTop = f.upper ? y + Math.round((ground - y) * 0.42) : y + 6;
  if (f.upper) {
    for (let wx = x + 12; wx + 14 < x + w - 8; wx += 26) {
      p.rect(lit(light, INK, 0), wx - 1, y + 9, 16, 20);
      p.rect(light.night > 0.4 && noise(wx, 3, 9) < 0.7 ? "#f0cf8a" : lit(light, mixHex(light.sky[1], "#3b3440", 0.35), 0.5), wx, y + 10, 14, 18);
      p.rect(lit(light, f.trim, 0.6), wx - 2, y + 28, 18, 2);
    }
  }
  // The sign board with the shop's name.
  const name = box.name.toUpperCase();
  const tw = bigWidth(name);
  const sw = Math.min(w - 16, tw + 14);
  const sx = Math.round(x + (w - sw) / 2);
  const sy = shopTop;
  p.rect(lit(light, INK, 0), sx - 1, sy - 1, sw + 2, 13);
  p.rect(lit(light, f.sign.board, 0.4), sx, sy, sw, 11);
  p.rect(lit(light, mixHex(f.sign.board, CREAM, 0.2), 0.6), sx, sy, sw, 1);
  if (tw <= sw - 4) bigWord(p, name, lit(light, f.sign.ink, 0.6, 0.5), Math.round(x + (w - tw) / 2), sy + 2);
  else word(p, name, lit(light, f.sign.ink, 0.6, 0.5), Math.round(x + (w - (name.length * 4 - 1)) / 2), sy + 3);
  // The awning.
  const ay = sy + 15;
  if (f.awning) {
    const [a, b] = f.awning;
    for (let xx = x + 4; xx < x + w - 4; xx++) {
      const stripe = Math.floor((xx - x) / 7) % 2 ? b : a;
      p.rect(lit(light, stripe, 0.7), xx, ay, 1, 9);
      const scal = Math.floor((xx - x) / 7) % 2 ? 0 : 1;
      p.rect(lit(light, mixHex(stripe, INK, 0.25), 0.2), xx, ay + 9, 1, 2 + scal);
    }
    p.rect(lit(light, INK, 0), x + 4, ay - 1, w - 8, 1);
  }
  // Display window on the left, the door on the right.
  const winX = x + 8;
  const winW = Math.round(w * 0.55);
  const winY = ay + 14;
  const glassLit = box.open ? (light.night > 0.4 ? "#f2cf86" : lit(light, "#e9d9b6", 0.4)) : lit(light, "#7d8a90", 0.3);
  p.rect(lit(light, f.trim, 0.3), winX - 2, winY - 2, winW + 4, ground - winY - 4);
  p.rect(glassLit, winX, winY, winW, ground - winY - 12);
  p.rect(lit(light, mixHex(glassLit, "#ffffff", 0.35), 0.8), winX + 3, winY + 3, 14, 1);
  p.rect(lit(light, mixHex(glassLit, "#ffffff", 0.35), 0.8), winX + 3, winY + 5, 8, 1);
  p.rect(lit(light, mixHex(f.trim, INK, 0.3), 0.2), winX, ground - 12, winW, 8);
  p.rect(lit(light, f.trim, 0.5), winX - 3, ground - 13, winW + 6, 2);
  if (box.display) displayCup(p, light, box.display, winX + Math.round(winW / 2), ground - 13);
  const doorX = winX + winW + 8;
  const doorW = Math.min(26, x + w - 10 - doorX);
  const doorY = winY - 4;
  p.rect(lit(light, INK, 0), doorX - 1, doorY - 1, doorW + 2, ground - doorY + 1);
  p.rect(lit(light, f.door, 0.4), doorX, doorY, doorW, ground - doorY);
  p.rect(glassLit, doorX + 4, doorY + 4, doorW - 8, Math.round((ground - doorY) * 0.45));
  p.rect(lit(light, "#d6a367", 0.7), doorX + doorW - 5, doorY + Math.round((ground - doorY) * 0.6), 2, 2);
  // OPEN / CLOSED on the door glass.
  const tag = box.open ? "OPEN" : "SHUT";
  p.rect(lit(light, INK, 0), doorX + Math.round(doorW / 2) - 9, doorY + 10, 18, 8);
  p.rect(box.open ? lit(light, "#7f9a72", 0.6, 0.6) : lit(light, "#c4574a", 0.6), doorX + Math.round(doorW / 2) - 8, doorY + 11, 16, 6);
  word(p, tag, lit(light, CREAM, 0.6), doorX + Math.round(doorW / 2) - 7, doorY + 12);
  p.rect(lit(light, mixHex(f.trim, INK, 0.2), 0.3), x, ground - 3, w, 3);
}

/** The shop from across the pavement. */
export function bakeStreet(v: Venue, light: Light, outdoor: Light, width: number, name: string, open: boolean, display = ""): BakedFront {
  const H = FRONT_HEIGHT;
  const buf = new PixelBuffer(width, H);
  const p = new Painter(buf, width, H);
  const horizon = 70;
  const [s0, s1, s2] = outdoor.sky;
  for (let y = 0; y < horizon; y++)
    for (let x = 0; x < width; x++) {
      const t = y / horizon;
      const b = bayer(x, y);
      buf.set(x, y, packColor(t < 0.55 ? (t / 0.55 > b ? s1 : s0) : (t - 0.55) / 0.45 > b ? s2 : s1));
    }
  // Pavement and road, in the venue's own ground near the shop.
  for (let y = horizon; y < H; y++)
    for (let x = 0; x < width; x++) {
      // Further up the picture is further away: the ground compresses toward the horizon.
      const far = y < KERB_Y ? (KERB_Y - y) / (KERB_Y - horizon) : 0;
      const gx = (x - width / 2) / (14 - far * 9);
      const gy = y < KERB_Y ? v.rows + 0.4 - far * 9 : v.rows + 1 + (y - KERB_Y) / 5;
      buf.set(x, y, packColor(outdoor.lit(v.outside.ground(gx, gy, outdoor), Math.min(1, outdoor.sun * (0.4 + 0.6 * outdoor.elevation)))));
    }
  // The far band goes over the ground, so whatever stands on the horizon keeps its feet.
  if (v.outside.far) v.outside.far(p, outdoor, width, horizon);
  const f = v.facade;
  const w = Math.round(Math.min(width * 0.62, 190));
  const box: FrontBox = { x: Math.round((width - w) / 2), y: 22, w, h: KERB_Y - 22, ground: KERB_Y, open, name, display };
  if (!f || f.neighbours !== "none") {
    neighbour(p, outdoor, 0, box.x - 2, 14, KERB_Y, 3);
    neighbour(p, outdoor, box.x + w + 2, width, 10, KERB_Y, 7);
  }
  if (f?.paint) f.paint(p, outdoor, box);
  else
    shopfront(p, buf, outdoor, f ?? { wall: v.wall, trim: v.counter.trim, sign: { board: v.counter.front, ink: "#f3e2b8" }, awning: ["#c4574a", "#f1e1c0"], door: v.counter.front, upper: true }, box);
  // The kerb, and the sun's shadow under everything that faces the street.
  p.rect(outdoor.lit("#cdbfa6", 0.5), 0, KERB_Y + 12, width, 2);
  if (outdoor.sun > 0.1) {
    const depth = Math.round(4 + (1 - outdoor.elevation) * 10);
    p.alpha(0.28, () => p.rect(INK, box.x, KERB_Y, box.w, depth));
  }
  return { width, height: H, light, outdoor, background: buf, line: KERB_Y, door: { x: box.x + Math.round(w * (f?.queueAt ?? 0.8)), y: KERB_Y } };
}
