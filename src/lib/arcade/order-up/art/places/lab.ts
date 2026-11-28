/**
 * The tasting bench: a tiled back room with shelves of sample jars, a
 * chalkboard keeping a tally of the pairings found, and three regulars
 * seated behind a butcher-block bench. Four glass jars stand on the bench
 * between them, each filled with what is in it; the tasters' faces answer
 * a blend, with a heart or a drop over the shoulder.
 */
import {
  Painter, PLACE_W, PLACE_H, INK, CREAM, mixHex, noise, tone, box, contact, surface, tileAt, windowPane, hangingLamp, pool, beam, dim,
  ink, type Light, type Tone,
} from "./kit.ts";
import { seated, emote } from "./people.ts";
import { word } from "../room/font.ts";

export interface LabState {
  jars: readonly (string | null)[];
  /** Each taster's grade for the last blend, or null. */
  taste: readonly number[] | null;
  pairings: number;
}

const W = PLACE_W;
const H = PLACE_H;
const BENCH = 192;
const BENCH_D = 18;
const FLOOR = 236;

export const LAB_TASTERS = ["mochi", "sesame", "biscuit"].map((name, i) => ({ name, x: 150 + i * 66, top: 156 }));
/** Each jar's glass, standing on the bench between the tasters. */
export const LAB_JARS = [0, 1, 2, 3].map((i) => ({ x: 107 + i * 66, y: 162, w: 20, h: 26 }));

export function tasterFace(grade: number | undefined) {
  return grade === undefined ? "calm" : grade >= 82 ? "starry" : grade >= 60 ? "content" : "unimpressed";
}

export function drawLab(p: Painter, light: Light, state: LabState) {
  const t = tone(light, 0.35, 0.45);
  surface(p, 0, 0, W, FLOOR, [t.front("#e2d5ba"), t.front("#d9cbae"), t.front("#c6b595")], tileAt(12, 6));
  p.rect(t.front("#7f9a72"), 0, 140, W, 4);
  p.rect(t.top("#a3bb94"), 0, 140, W, 1);
  // Checker floor.
  surface(p, 0, FLOOR, W, H - FLOOR, [t.top("#c9b99c"), t.top("#ad9b80"), t.top("#8f7d68")], (u, v) => {
    const row = v < 10 ? 0 : v < 22 ? 1 : 2;
    const size = [10, 14, 18][row];
    const off = row * 7;
    if (v === 10 || v === 22) return 2;
    return (Math.floor((u + off) / size) + row) & 1;
  });
  p.dither(INK, 0, FLOOR, W, 3, 0.35);

  chalkboard(p, t, 22, 40, 90, 76, state.pairings);
  // The lamp's cord runs down behind the shelves.
  const lamp = hangingLamp(p, t, 216, 0, 126, "#7f9a72");
  shelf(p, t, 128, 72, 184);
  shelf(p, t, 128, 112, 184);
  windowPane(p, t, 330, 40, 72, 66, "#7a6252", 13);

  // The tasters, seated behind the bench.
  for (const [i, taster] of LAB_TASTERS.entries()) {
    const grade = state.taste?.[i];
    // A stool back behind each.
    seated(p, t, taster.name, tasterFace(grade), taster.x, BENCH - BENCH_D + 2);
    if (grade !== undefined) {
      const kind = grade >= 82 ? "heart" : grade < 60 ? "drop" : "";
      if (kind) emote(p, kind, taster.x + 6, taster.top - 2);
    }
  }

  bench(p, t);
  for (const [i, jar] of LAB_JARS.entries()) drawJar(p, t, jar, state.jars[i] ?? null);
  // Tasting spoons in a cup and a jug of water.
  spoons(p, t, 46, BENCH + 12);
  jug(p, t, 380, BENCH + 14);

  beam(p, 330, 402, 96, 240, Math.round(light.azimuth * 70), light.sun * (1 - light.night) * 0.3);
  if (lamp.on) {
    dim(p, 216, 180, 280, 190, 0.3 * light.night);
    pool(p, 216, 176, 180, 70, 0.38 * Math.max(0.4, light.night));
  }
}

function chalkboard(p: Painter, t: Tone, x: number, y: number, w: number, h: number, pairings: number) {
  p.rect(ink(t), x - 1, y - 1, w + 2, h + 2);
  p.rect(t.front("#9a7454"), x, y, w, h);
  p.rect(t.front("#38463f"), x + 3, y + 3, w - 6, h - 6);
  p.dither(t.front("#46554d"), x + 3, y + 3, w - 6, h - 6, 0.25);
  const chalk = t.front("#e6eadc");
  word(p, "PAIRINGS", chalk, x + 8, y + 8);
  p.rect(t.front("#b9c2b2"), x + 8, y + 15, 32, 1);
  // A tally, five to a gate.
  const n = Math.min(20, pairings);
  for (let i = 0; i < n; i++) {
    const gate = Math.floor(i / 5);
    const k = i % 5;
    const gx = x + 10 + (gate % 2) * 34;
    const gy = y + 22 + Math.floor(gate / 2) * 14;
    if (k < 4) p.rect(chalk, gx + k * 4, gy, 1, 10);
    else p.line(chalk, gx - 2, gy + 8, gx + 14, gy + 2);
  }
  if (!n) p.rect(t.front("#8d9a8f"), x + 10, y + 26, 20, 1);
  p.rect(t.top("#d8d2c4"), x + w - 20, y + h - 6, 8, 2);
  p.rect(t.front("#7a5a46"), x + 2, y + h - 3, w - 4, 2);
}

function shelf(p: Painter, t: Tone, x: number, y: number, w: number) {
  const colors = ["#bd895c", "#b3ae63", "#b989ba", "#d77973", "#e4c775", "#a17d52", "#7d985c", "#d68742", "#7b84bd", "#bb7c87", "#f2ede0", "#6b4a3b"];
  for (let i = 0; i < 13; i++) {
    const jx = x + 4 + i * 14;
    const h = 14 + Math.floor(noise(i, y, 50) * 6);
    const c = colors[(i * 5 + y) % colors.length];
    p.rect(ink(t), jx - 1, y - h - 1, 12, h + 1);
    p.rect(t.front("#ece6d6"), jx, y - h, 10, h);
    p.rect(t.front(c), jx, y - h + 5, 10, h - 5);
    p.rect(t.front(mixHex(c, CREAM, 0.3)), jx, y - h + 5, 10, 1);
    p.rect(t.left("#ffffff"), jx + 1, y - h + 2, 1, h - 4);
    p.rect(t.top("#a8784c"), jx, y - h - 1, 10, 2);
    p.rect(t.front("#f4ead4"), jx + 2, y - h + 8, 6, 4);
  }
  box(p, t, x, y, w, 4, 3, { top: "#a77856", front: "#7a5a46" });
  for (const bx of [x + 10, x + w - 14]) {
    p.rect(ink(t), bx, y + 4, 4, 6);
    p.rect(t.front("#5d4436"), bx + 1, y + 4, 2, 5);
  }
}

function bench(p: Painter, t: Tone) {
  const block = "#c49a6a";
  p.rect(ink(t), 10, BENCH - BENCH_D - 1, W - 20, BENCH_D + 3);
  // Butcher block: strips running across.
  for (let r = 0; r < BENCH_D; r++) p.rect(t.top(r % 3 === 0 ? "#b88d5f" : noise(r, 0, 4) > 0.5 ? block : "#cba273"), 11, BENCH - BENCH_D + r, W - 22, 1);
  for (let i = 0; i < 30; i++) p.rect(t.top("#a97f55"), 11 + Math.floor(noise(i, 0, 14) * (W - 40)), BENCH - BENCH_D + Math.floor(noise(i, 1, 14) * BENCH_D), 10, 1);
  p.rect(t.top("#dcb88a"), 11, BENCH - BENCH_D, W - 22, 1);
  p.rect(t.front("#a57a52"), 11, BENCH, W - 22, 4);
  p.rect(ink(t), 10, BENCH + 4, W - 20, 1);
  // Cupboards under it.
  p.rect(ink(t), 16, BENCH + 5, W - 32, FLOOR - BENCH - 5);
  p.rect(t.front("#7f9a72"), 17, BENCH + 5, W - 34, FLOOR - BENCH - 6);
  for (let k = 0; k < 6; k++) {
    const dx = 20 + k * 66;
    p.rect(t.front("#6b845f"), dx, BENCH + 10, 60, FLOOR - BENCH - 18);
    p.rect(t.front("#8fab82"), dx, BENCH + 10, 60, 1);
    p.rect(t.front("#5a7150"), dx, FLOOR - 9, 60, 1);
    p.rect(ink(t), dx + (k % 2 ? 4 : 52), BENCH + 30, 3, 10);
    p.rect(t.front("#e0b85c"), dx + (k % 2 ? 5 : 53), BENCH + 31, 1, 8);
  }
  p.rect(t.shade("#4f6448"), 17, FLOOR - 5, W - 34, 4);
}

function drawJar(p: Painter, t: Tone, s: { x: number; y: number; w: number; h: number }, color: string | null) {
  const { x, y, w, h } = s;
  contact(p, x - 1, y + h + 1, w + 2, 0.4);
  p.rect(ink(t), x - 1, y + 2, w + 2, h - 1);
  p.rect(ink(t), x + 1, y - 3, w - 2, 6);
  // The glass, then what's in it, then the lid.
  const glass = t.front("#e8eee6");
  p.rect(glass, x, y + 3, w, h - 3);
  if (color) {
    p.rect(t.front(color), x + 1, y + 10, w - 2, h - 11);
    p.rect(t.front(mixHex(color, CREAM, 0.4)), x + 1, y + 10, w - 2, 1);
    p.rect(t.away(mixHex(color, INK, 0.25)), x + w - 4, y + 11, 3, h - 12);
  } else p.rect(t.front("#d8e0d8"), x + 1, y + h - 4, w - 2, 3);
  p.rect(t.left("#ffffff"), x + 2, y + 5, 1, h - 9);
  p.rect(t.left("#ffffff"), x + 3, y + 5, 1, 3);
  p.rect(t.top("#a8784c"), x + 2, y - 2, w - 4, 4);
  p.rect(t.top("#c99a6a"), x + 2, y - 2, w - 4, 1);
}

function spoons(p: Painter, t: Tone, x: number, base: number) {
  contact(p, x - 1, base - BENCH_D + 2, 14, 0.4);
  for (const [dx, h] of [[2, 14], [5, 16], [8, 13]] as const) {
    p.rect(ink(t), x + dx, base - BENCH_D - 10 - h + 12, 2, h);
    p.rect(t.top("#d6dcdc"), x + dx, base - BENCH_D - 12 - h + 12, 2, 2);
  }
  p.rect(ink(t), x - 1, base - BENCH_D - 10, 14, 12);
  p.rect(t.front("#d77973"), x, base - BENCH_D - 9, 12, 10);
  p.rect(t.left("#e8a39c"), x, base - BENCH_D - 9, 2, 10);
}

function jug(p: Painter, t: Tone, x: number, base: number) {
  const b = base - BENCH_D;
  contact(p, x - 2, b + 1, 18, 0.4);
  p.rect(ink(t), x - 1, b - 22, 16, 23);
  p.rect(t.front("#e4ecea"), x, b - 21, 14, 21);
  p.rect(t.front("#b9d2d6"), x, b - 13, 14, 13);
  p.rect(t.left("#ffffff"), x + 2, b - 19, 1, 16);
  p.rect(ink(t), x + 14, b - 17, 4, 10);
  p.rect(t.front("#e4ecea"), x + 15, b - 16, 2, 8);
  p.rect(ink(t), x - 3, b - 22, 4, 2);
}
