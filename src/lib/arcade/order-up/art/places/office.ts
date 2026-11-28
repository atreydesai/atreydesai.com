/**
 * The office: a desk under a window, seen from where you'd stand at it. The
 * shop book lies open on the desk by the cash box, the season's calendar
 * hangs on the wall with today ringed and the rent days marked, and a wall
 * clock tells the hour. A desk lamp pools light on the book after dark.
 */
import {
  Painter, PLACE_W, PLACE_H, INK, CREAM, mixHex, noise, tone, box, contact, surface, plasterAt, boardsAt, floorAt, floorRows,
  windowPane, pool, beam, dim, foliage, ink, type Light, type Tone,
} from "./kit.ts";
import { word, wordWidth } from "../room/font.ts";

export interface OfficeState {
  /** Day of the season, 1..28. */
  day: number;
}

const W = PLACE_W;
const H = PLACE_H;
const WALL = 150;
const TOP = 58;
const FRONT = 46;

/** The things on the desk and wall the view makes into buttons. */
export const OFFICE_SPOTS = {
  book: { x: 150, y: 158, w: 124, h: 40 },
  calendar: { x: 176, y: 20, w: 58, h: 80 },
  till: { x: 42, y: 160, w: 74, h: 38 },
  board: { x: 28, y: 30, w: 118, h: 78 },
};

export function drawOffice(p: Painter, light: Light, state: OfficeState) {
  const t = tone(light, 0.4, 0.45);
  // Plaster above a panelled dado, a picture rail.
  surface(p, 0, 0, W, WALL, [t.front("#d8c3a0"), t.front("#cfba96")], plasterAt(41));
  surface(p, 0, 112, W, WALL - 112, [t.front("#8f6a50"), t.front("#86634a"), t.front("#6c4f3d")], boardsAt(18));
  p.rect(t.top("#b08562"), 0, 110, W, 3);
  p.rect(ink(t), 0, 113, W, 1);
  p.rect(t.front("#a57d5c"), 0, 12, W, 2);
  p.rect(t.shade("#8c6c52"), 0, 14, W, 1);
  // The floor between the desk's legs.
  surface(p, 0, WALL, W, H - WALL, [t.top("#7e5b46"), t.top("#86624b"), t.top("#5e4334"), t.top("#9a7458")], floorAt(floorRows(H - WALL, 6, 1.2), 70));

  board(p, t);
  calendar(p, t, state.day);
  windowPane(p, t, 264, 28, 74, 64, "#7a5a46", 9);
  curtains(p, t, 264, 28, 74, 64);
  clock(p, t, light, 380, 52);
  shelf(p, t);

  desk(p, t);
  till(p, t);
  book(p, t);
  lamp(p, t, light);
  mug(p, t, 300, 194);
  plant(p, t, 396, 190);

  // Sun through the window lands across the desk by day.
  const day = light.sun * (1 - light.night) * 0.35;
  beam(p, 264, 338, 100, 206, Math.round(light.azimuth * 70), day);
  if (light.night > 0.15) {
    dim(p, 340, 200, 300, 200, 0.35 * light.night);
    pool(p, 320, 196, 150, 52, 0.55 * light.night);
    pool(p, 352, 120, 70, 60, 0.25 * light.night);
  }
}

function board(p: Painter, t: Tone) {
  const { x, y, w, h } = OFFICE_SPOTS.board;
  p.rect(ink(t), x - 1, y - 1, w + 2, h + 2);
  p.rect(t.front("#8a6248"), x, y, w, h);
  p.rect(t.front("#c9a27a"), x + 3, y + 3, w - 6, h - 6);
  for (let i = 0; i < 160; i++) p.rect(t.front(i % 2 ? "#b8916a" : "#d6b48c"), x + 3 + Math.floor(noise(i, 0, 5) * (w - 6)), y + 3 + Math.floor(noise(i, 1, 5) * (h - 6)), 1, 1);
  // Pinned: last week's receipts, a photo of the shop, the rota, a postcard.
  const pin = (px: number, py: number, c: string) => {
    p.rect(ink(t), px - 1, py - 1, 3, 3);
    p.rect(t.front(c), px, py, 1, 1);
  };
  note(p, t, x + 8, y + 8, 22, 34, "#f6efe0", 5);
  pin(x + 19, y + 9, "#c4574a");
  p.rect(ink(t), x + 36, y + 10, 34, 26);
  p.rect(t.front("#f4ecda"), x + 37, y + 11, 32, 24);
  p.rect(t.front("#9fb8c4"), x + 39, y + 13, 28, 10);
  p.rect(t.front("#b88a70"), x + 44, y + 19, 18, 12);
  p.rect(t.front("#c4574a"), x + 43, y + 18, 20, 2);
  p.rect(t.front("#e8d6b4"), x + 50, y + 24, 6, 7);
  pin(x + 53, y + 11, "#7f9a72");
  // The rota: a grid of the week.
  p.rect(ink(t), x + 76, y + 8, 34, 30);
  p.rect(t.front("#fbf5e6"), x + 77, y + 9, 32, 28);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 7; c++) if (noise(r, c, 8) > 0.45) p.rect(t.front(["#7f9a72", "#e0a85a", "#8fa4c4", "#d77973"][r]), x + 79 + c * 4, y + 14 + r * 5, 3, 3);
  p.rect(t.front("#c9b28e"), x + 79, y + 11, 20, 1);
  pin(x + 93, y + 9, "#e9c46a");
  note(p, t, x + 14, y + 46, 40, 24, "#eadcf0", 7);
  pin(x + 33, y + 47, "#8fa4c4");
  note(p, t, x + 62, y + 44, 44, 26, "#f2d8a8", 3);
  pin(x + 83, y + 45, "#c4574a");
}

function note(p: Painter, t: Tone, x: number, y: number, w: number, h: number, paper: string, seed: number) {
  p.alpha(0.3, () => p.rect(INK, x + 2, y + 2, w, h));
  p.rect(t.front(paper), x, y, w, h);
  for (let i = 0; i < Math.floor((h - 6) / 4); i++) p.rect(t.front(mixHex(paper, INK, 0.35)), x + 3, y + 5 + i * 4, Math.max(4, w - 8 - Math.floor(noise(i, seed, 2) * 10)), 1);
}

function calendar(p: Painter, t: Tone, day: number) {
  const { x, y, w, h } = OFFICE_SPOTS.calendar;
  const season = t.light.season;
  const header = { spring: "#7f9a72", summer: "#d9a95f", autumn: "#c4704a", winter: "#7d8fa8" }[season] ?? "#c4574a";
  p.rect(ink(t), x + w / 2 - 1, y - 4, 2, 4);
  p.alpha(0.3, () => p.rect(INK, x + 3, y + 3, w, h));
  p.rect(ink(t), x - 1, y - 1, w + 2, h + 2);
  p.rect(t.front("#fbf5e6"), x, y, w, h);
  p.rect(t.front(header), x, y, w, 14);
  p.rect(t.front(mixHex(header, CREAM, 0.3)), x, y, w, 1);
  const name = season.toUpperCase();
  word(p, name, t.front(CREAM), x + Math.round((w - wordWidth(name)) / 2), y + 5);
  // A week to a row, rent days down the last column, today ringed.
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 7; c++) {
      const n = r * 7 + c + 1;
      const cx = x + 4 + c * 7;
      const cy = y + 20 + r * 14;
      const past = n < day;
      p.rect(t.front(past ? "#d7ccb6" : "#e9dfc9"), cx, cy, 6, 11);
      if (c === 6) {
        p.rect(t.front("#7f9a72"), cx + 1, cy + 7, 4, 3);
        p.rect(t.front("#e9c46a"), cx + 2, cy + 8, 2, 1);
      }
      if (past) p.line(t.front("#b9a78a"), cx, cy + 10, cx + 5, cy);
      if (n === day) {
        p.rect(t.front("#c4574a"), cx - 1, cy - 1, 8, 1);
        p.rect(t.front("#c4574a"), cx - 1, cy + 11, 8, 1);
        p.rect(t.front("#c4574a"), cx - 1, cy, 1, 11);
        p.rect(t.front("#c4574a"), cx + 6, cy, 1, 11);
      }
    }
  // The page curls at the corner.
  p.poly(t.front("#e6dcc6"), [x + w - 7, y + h, x + w, y + h - 7, x + w, y + h]);
}

function curtains(p: Painter, t: Tone, x: number, y: number, w: number, h: number) {
  const cloth = "#b6574a";
  p.rect(ink(t), x - 8, y - 9, w + 16, 4);
  p.rect(t.front("#7a5a46"), x - 7, y - 8, w + 14, 2);
  for (const side of [-1, 1]) {
    const cx = side < 0 ? x - 8 : x + w - 2;
    p.rect(ink(t), cx - 1, y - 6, 11, h + 14);
    p.rect(t.front(cloth), cx, y - 5, 9, h + 12);
    for (let k = 1; k < 9; k += 3) p.rect(t.front(mixHex(cloth, INK, 0.2)), cx + k, y - 5, 1, h + 12);
    p.rect(t.left(mixHex(cloth, CREAM, 0.2)), cx, y - 5, 1, h + 12);
    p.rect(t.front("#e0b85c"), cx, y + h - 8, 9, 2);
  }
}

function clock(p: Painter, t: Tone, light: Light, cx: number, cy: number) {
  p.oval(ink(t), cx, cy, 15, 15);
  p.oval(t.front("#8a6248"), cx, cy, 14, 14);
  p.oval(t.front("#f6efe0"), cx, cy, 11, 11);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.rect(t.front(i % 3 ? "#b9a78a" : INK), Math.round(cx + Math.sin(a) * 9), Math.round(cy - Math.cos(a) * 9), 1, 1);
  }
  const hour = light.hour % 12;
  const minute = (light.hour % 1) * 60;
  const ha = (hour / 12) * Math.PI * 2;
  const ma = (minute / 60) * Math.PI * 2;
  p.line(ink(t), cx, cy, Math.round(cx + Math.sin(ha) * 6), Math.round(cy - Math.cos(ha) * 6));
  p.line(t.front("#c4574a"), cx, cy, Math.round(cx + Math.sin(ma) * 9), Math.round(cy - Math.cos(ma) * 9));
  p.rect(ink(t), cx - 1, cy - 1, 2, 2);
}

function shelf(p: Painter, t: Tone) {
  // A wall shelf of binders by the window.
  box(p, t, 356, 98, 64, 3, 6, { top: "#b08562", front: "#8a6248" });
  const spines = ["#7f9a72", "#c4704a", "#8fa4c4", "#d9a95f", "#a88ac4", "#7f9a72"];
  for (let i = 0; i < 6; i++) {
    const bx = 360 + i * 9;
    const hgt = 20 + Math.floor(noise(i, 0, 4) * 6);
    p.rect(ink(t), bx - 1, 92 - hgt - 1, 9, hgt + 1);
    p.rect(t.front(spines[i]), bx, 92 - hgt, 7, hgt);
    p.rect(t.front(mixHex(spines[i], CREAM, 0.5)), bx + 2, 92 - hgt + 5, 3, 4);
    p.rect(t.left(mixHex(spines[i], CREAM, 0.2)), bx, 92 - hgt, 1, hgt);
  }
}

function desk(p: Painter, t: Tone) {
  const x = 18;
  const w = W - 36;
  const top = WALL + 4;
  const wood = "#9c6e4c";
  // Legs and the floor's shadow under the desk.
  p.alpha(0.35, () => p.rect(INK, x + 6, top + TOP + FRONT, w - 12, 8));
  for (const lx of [x + 4, x + w - 14]) {
    p.rect(ink(t), lx - 1, top + TOP, 12, H - top - TOP);
    p.rect(t.front(mixHex(wood, INK, 0.15)), lx, top + TOP, 10, H - top - TOP);
  }
  // The top, its grain running across, and the front with drawers.
  p.rect(ink(t), x - 1, top - 1, w + 2, TOP + FRONT + 2);
  p.rect(t.top(wood), x, top, w, TOP);
  // Long grain lines, a knot or two.
  for (let i = 0; i < 26; i++) {
    const gy = top + 2 + Math.floor(noise(i, 0, 12) * (TOP - 4));
    const gx = x + Math.floor(noise(i, 1, 12) * (w - 60));
    p.rect(t.top(i % 3 ? "#90654a" : "#ab7d5a"), gx, gy, 40 + Math.floor(noise(i, 2, 12) * 80), 1);
  }
  p.oval(t.top("#85593f"), x + 250, top + 40, 3, 1);
  p.rect(t.top("#b58660"), x, top, w, 1);
  p.rect(t.top("#c69a70"), x, top + TOP - 2, w, 2);
  p.rect(t.front("#83593f"), x, top + TOP, w, 6);
  p.rect(ink(t), x, top + TOP + 6, w, 1);
  p.rect(t.front("#8f6447"), x, top + TOP + 7, w, FRONT - 7);
  for (const [dx, dw] of [[14, 110], [134, 146], [290, 92]] as const) {
    const dx0 = x + dx;
    p.rect(t.shade("#6e4b36"), dx0, top + TOP + 12, dw, FRONT - 18);
    p.rect(t.front("#9a6d4d"), dx0 + 1, top + TOP + 13, dw - 2, FRONT - 20);
    p.rect(t.front("#b18160"), dx0 + 1, top + TOP + 13, dw - 2, 1);
    p.rect(ink(t), dx0 + dw / 2 - 6, top + TOP + 22, 12, 3);
    p.rect(t.front("#e0b85c"), dx0 + dw / 2 - 5, top + TOP + 22, 10, 1);
  }
}

function till(p: Painter, t: Tone) {
  const { x, y, w, h } = OFFICE_SPOTS.till;
  const tin = "#5f7a6e";
  contact(p, x - 2, y + h + 1, w + 4, 0.4);
  // The lid stands open behind; trays of coins and a bundle of notes.
  p.rect(ink(t), x - 1, y - 13, w + 2, 15);
  p.rect(t.front(mixHex(tin, CREAM, 0.15)), x, y - 12, w, 13);
  p.rect(t.front(mixHex(tin, INK, 0.2)), x + 2, y - 10, w - 4, 9);
  box(p, t, x, y + 14, w, h - 14, 14, { top: "#3e4a44", front: tin });
  for (let c = 0; c < 4; c++) {
    const cx = x + 3 + c * 13;
    p.rect(t.shade("#2f3833"), cx, y + 2, 11, 10);
    for (let k = 0; k < 4; k++) {
      p.oval(t.top(c === 3 ? "#c9c9c4" : "#e6b85c"), cx + 5, y + 9 - k * 2, 4, 1);
      p.rect(t.top(c === 3 ? "#f2f2ec" : "#fbe6a6"), cx + 3, y + 8 - k * 2, 2, 1);
    }
  }
  p.rect(t.top("#9fb58f"), x + w - 19, y + 2, 16, 10);
  p.rect(t.top("#c4d6b4"), x + w - 19, y + 2, 16, 1);
  p.rect(t.top("#7f9a72"), x + w - 13, y + 2, 3, 10);
  p.rect(ink(t), x + w / 2 - 4, y + 22, 8, 4);
  p.rect(t.front("#c9cfcc"), x + w / 2 - 3, y + 23, 6, 2);
}

function book(p: Painter, t: Tone) {
  const { x, y, w, h } = OFFICE_SPOTS.book;
  const cover = "#7a3f3a";
  contact(p, x, y + h + 2, w, 0.4);
  // The cover's edge, the page block's thickness, then the spread.
  p.rect(ink(t), x - 3, y - 1, w + 6, h + 5);
  p.rect(t.front(cover), x - 2, y + h, w + 4, 3);
  p.rect(t.top(cover), x - 2, y, w + 4, h);
  p.rect(t.front("#efe3c8"), x, y + h - 2, w, 2);
  const half = w / 2;
  p.rect(t.top("#f8eedb"), x, y + 1, half - 1, h - 3);
  p.rect(t.top("#f3e7cf"), x + half + 1, y + 1, half - 1, h - 3);
  p.rect(t.at("#d8c7a4", t.f.top * 0.6), x + half - 2, y + 1, 4, h - 3);
  p.rect(t.at("#c9b48e", 0), x + half - 1, y + 1, 2, h - 3);
  // A ledger on the left page, the day's notes on the right.
  for (let i = 0; i < 7; i++) {
    const ly = y + 5 + i * 4;
    p.rect(t.top("#c3b08c"), x + 5, ly, half - 12, 1);
    p.rect(t.top(i % 3 === 2 ? "#c4574a" : "#7a6650"), x + half - 18, ly - 1, 10, 1);
  }
  p.rect(t.top("#c3b08c"), x + half - 21, y + 3, 1, 30);
  for (let i = 0; i < 6; i++) p.rect(t.top("#9f8c6e"), x + half + 6, y + 6 + i * 5, 26 + Math.floor(noise(i, 1, 81) * 22), 1);
  p.rect(t.top("#7f9a72"), x + half + 6, y + 4, 8, 1);
  // A ribbon over the edge and a pencil across.
  p.rect(t.front("#c4574a"), x + half + 40, y + h - 2, 3, 9);
  p.line(ink(t), x + w - 30, y + h - 4, x + w + 6, y + h - 12);
  p.line(t.top("#e0b85c"), x + w - 29, y + h - 5, x + w + 5, y + h - 13);
}

function lamp(p: Painter, t: Tone, light: Light) {
  const on = light.night > 0.15 || light.weather === "rain" || light.weather === "fog";
  const bx = 352;
  const by = 196;
  const metal = "#3f5a54";
  contact(p, bx - 12, by + 1, 26, 0.4);
  p.rect(ink(t), bx - 12, by - 4, 24, 5);
  p.rect(t.top(metal), bx - 11, by - 3, 22, 3);
  for (let i = 0; i < 46; i++) p.rect(ink(t), bx - 1 + Math.round(i * 0.18), by - 4 - i, 3, 1);
  for (let i = 0; i < 46; i++) p.rect(t.left(mixHex(metal, CREAM, 0.2)), bx + Math.round(i * 0.18), by - 4 - i, 1, 1);
  const hx = bx + 8;
  const hy = by - 50;
  for (let i = 0; i < 24; i++) p.rect(ink(t), hx - Math.round(i * 0.9), hy + Math.round(i * 0.25), 3, 1);
  // The shade, angled down at the book.
  p.poly(ink(t), [hx - 30, hy + 2, hx - 18, hy - 6, hx - 6 + 4, hy + 12, hx - 22, hy + 20]);
  p.poly(t.top(mixHex(metal, CREAM, 0.1)), [hx - 28, hy + 3, hx - 18, hy - 4, hx - 6 + 2, hy + 11, hx - 21, hy + 18]);
  p.line(on ? "#fff1c4" : t.shade("#d8d0bc"), hx - 21, hy + 18, hx - 5, hy + 11);
}

function mug(p: Painter, t: Tone, x: number, base: number) {
  contact(p, x - 1, base + 1, 14, 0.4);
  p.rect(ink(t), x - 1, base - 12, 12, 13);
  p.rect(t.front("#e9dcc4"), x, base - 11, 10, 11);
  p.rect(t.left("#fbf2e2"), x, base - 11, 2, 11);
  p.rect(t.front("#c4574a"), x, base - 6, 10, 2);
  p.oval(t.top("#6b4a3b"), x + 5, base - 11, 4, 1);
  p.rect(ink(t), x + 10, base - 9, 4, 6);
  p.rect(t.front("#e9dcc4"), x + 11, base - 8, 2, 4);
}

function plant(p: Painter, t: Tone, x: number, base: number) {
  contact(p, x - 10, base + 1, 22, 0.4);
  for (const [dx, dy, r] of [[-7, -24, 7], [7, -26, 7], [0, -34, 8], [-4, -44, 6], [6, -42, 5]] as const) foliage(p, t, x + dx, base + dy, r, r * 0.8, "#5f8552", "#97b878");
  p.rect(ink(t), x - 9, base - 15, 19, 16);
  p.rect(t.front("#c47c5b"), x - 8, base - 14, 17, 14);
  p.rect(t.top("#d99a78"), x - 8, base - 14, 17, 2);
  p.rect(t.away("#9c5c44"), x + 4, base - 12, 5, 12);
}
