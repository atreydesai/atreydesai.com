/**
 * The taste-off tent at the fair: a striped canopy over a clothed judging
 * table, three judges behind it with a score card each, your cup on the
 * left and the rival shop's on the right, a crowd at the ropes and the
 * fairground (a big wheel, other tents) under the day's sky behind. After
 * dark, bulbs string the valance and the wheel lights up. The tent is baked;
 * the timing gauge and the weather are painted every frame.
 */
import {
  Painter, PLACE_W, PLACE_H, INK, CREAM, mixHex, noise, tone, box, contact, cast, sky, hills, skyline, pool, dim, gauge, precipitation,
  SEASON_GREENS, ink, type Light, type Tone,
} from "./kit.ts";
import { seated, standing, emote } from "./people.ts";
import { word, wordWidth, bigWord, bigWidth } from "../room/font.ts";

export interface TasteoffState {
  /** The judges' scores so far this round. */
  hits: readonly number[];
  /** Rounds finished, 0..4. */
  round: number;
}

const W = PLACE_W;
const H = PLACE_H;
const TABLE = 186;
const TABLE_D = 12;
const GROUND = 150;

export const TASTEOFF_JUDGES = ["juniper", "mochi", "sesame"].map((name, i) => ({ name, x: 166 + i * 50 }));

export function judgeFace(grade: number | undefined) {
  return grade === undefined ? "calm" : grade >= 80 ? "starry" : grade >= 55 ? "content" : "meh";
}

const WHEEL = { x: 92, y: 74, r: 46 };

export function drawTasteoffBackdrop(p: Painter, light: Light, state: TasteoffState) {
  const t = tone(light, 1);
  const g = SEASON_GREENS[light.season] ?? SEASON_GREENS.spring;
  const night = light.night;
  sky(p, light, 0, 0, W, GROUND, 6);
  hills(p, light.lit(mixHex(g.far, light.sky[2], 0.4), 0.4), 0, W, GROUND - 10, 22, 2.2);
  skyline(p, light, GROUND - 4, 230, W, "#b49484", 31, 26);
  drawWheel(p, light, 0.2);
  // Other tents along the midway.
  for (const [x, w, c] of [[196, 46, "#7f9a72"], [300, 58, "#d9a95f"], [372, 50, "#8fa4c4"]] as const) {
    const top = GROUND - 30;
    p.poly(ink(t), [x - 2, top + 12, x + w / 2, top - 2, x + w + 2, top + 12]);
    p.poly(t.top(c), [x, top + 11, x + w / 2, top, x + w, top + 11]);
    p.rect(ink(t), x - 1, top + 11, w + 2, GROUND - top - 10);
    p.rect(t.front("#efe3c8"), x, top + 12, w, GROUND - top - 12);
    p.rect(night > 0.3 ? "#f6d28a" : t.shade("#6b5048"), x + w / 2 - 5, top + 18, 10, GROUND - top - 18);
  }
  // The ground: trampled grass, a straw path.
  p.rect(t.top(g.grass), 0, GROUND, W, H - GROUND);
  for (let i = 0; i < 500; i++) p.rect(t.top(i % 3 ? g.grassAlt : "#d9c48c"), Math.floor(noise(i, 0, 7) * W), GROUND + Math.floor(noise(i, 1, 7) * (H - GROUND)), i % 3 ? 1 : 2, 1);

  tentShell(p, t, light);
  crowd(p, t);
  table(p, t, light, state);
  banner(p, t);
  if (night > 0.2) {
    dim(p, 216, 170, 300, 200, 0.25 * night);
    pool(p, 216, 176, 200, 70, 0.4 * night);
  }
}

function tentShell(p: Painter, t: Tone, light: Light) {
  const red = "#c4574a";
  const cloth = "#f1e1c0";
  // Under the canopy it's in shade.
  p.alpha(0.18, () => p.rect(INK, 0, 56, W, TABLE - 56));
  // Canopy stripes, then a scalloped valance.
  for (let x = 0; x < W; x += 18) {
    const c = (x / 18) % 2 ? cloth : red;
    p.rect(t.top(c), x, 0, 18, 40);
    p.rect(t.front(mixHex(c, INK, 0.12)), x, 30, 18, 10);
  }
  p.rect(ink(t), 0, 40, W, 1);
  for (let x = 0; x < W; x += 18) {
    const c = (x / 18) % 2 ? cloth : red;
    p.oval(ink(t), x + 9, 41, 9, 7);
    p.oval(t.front(c), x + 9, 40, 8, 6);
    p.rect(t.front(mixHex(c, CREAM, 0.3)), x + 3, 41, 12, 1);
  }
  p.rect(t.front(red), 0, 34, W, 6);
  p.rect(t.front("#e07a63"), 0, 34, W, 1);
  // The poles.
  for (const x of [14, W - 20]) {
    p.rect(ink(t), x - 1, 40, 8, H - 40);
    p.rect(t.front("#8a6248"), x, 40, 6, H - 40);
    p.rect(t.left("#a77856"), x, 40, 2, H - 40);
    p.rect(t.away("#6e4d3f"), x + 4, 40, 2, H - 40);
    contact(p, x - 4, H - 1, 14, 0.4);
  }
  // Bunting in two swags.
  const colors = ["#e9c46a", "#7f9a72", "#e48f88", "#8fa4c4"];
  for (let x = 24; x < W - 24; x += 9) {
    const k = (x - 24) / (W - 48);
    const sag = Math.round(Math.sin((k * 2 % 1) * Math.PI) * 9);
    const c = t.front(colors[Math.floor(x / 9) % 4]);
    p.rect(t.shade("#5a4436"), x, 58 + sag, 9, 1);
    p.rect(c, x + 1, 59 + sag, 6, 2);
    p.rect(c, x + 2, 61 + sag, 4, 2);
    p.rect(c, x + 3, 63 + sag, 2, 1);
  }
  if (light.night > 0.2)
    for (let x = 8; x < W; x += 16) {
      p.rect("#fff1c4", x, 48, 2, 2);
      pool(p, x + 1, 49, 7, 5, 0.6 * light.night, "#ffe2a0", 2);
    }
}

function crowd(p: Painter, t: Tone) {
  // Regulars at the ropes either side, a rope on posts.
  const names = ["pip", "noodle", "clementine", "bean", "tofu", "biscuit"];
  const spots = [38, 58, 80, 352, 374, 396];
  for (let i = 0; i < 6; i++) standing(p, t, names[i], i % 2 ? "content" : "calm", spots[i], 210 + (i % 2) * 6, i >= 3);
  for (const x of [28, 104, 328, 404]) {
    p.rect(ink(t), x - 1, 202, 4, 22);
    p.rect(t.front("#c9a560"), x, 203, 2, 21);
    contact(p, x - 3, 224, 8, 0.4);
  }
  for (const [a, b] of [[30, 104], [330, 404]] as const)
    for (let x = a; x < b; x++) p.rect(t.front("#c4574a"), x, 205 + Math.round(Math.sin(((x - a) / (b - a)) * Math.PI) * 4), 1, 1);
}

function table(p: Painter, t: Tone, light: Light, state: TasteoffState) {
  const x0 = 112;
  const x1 = 320;
  // The judges, seated behind.
  for (const [i, judge] of TASTEOFF_JUDGES.entries()) {
    const grade = state.hits[i];
    seated(p, t, judge.name, judgeFace(grade), judge.x, TABLE - TABLE_D + 2);
    if (grade !== undefined && grade >= 80) emote(p, "star", judge.x + 7, TABLE - TABLE_D - 20);
  }
  cast(p, light, x0, TABLE + 44, x1 - x0, 30, 6, 0.3);
  // The cloth: a top, then a skirt in folds with a red hem.
  box(p, t, x0, TABLE, x1 - x0, 40, TABLE_D, { top: "#f6ead2", front: "#efe0c2" });
  for (let x = x0 + 6; x < x1 - 4; x += 10) {
    p.rect(t.front("#dccaa6"), x, TABLE + 2, 2, 38);
    p.rect(t.front("#fbf2de"), x + 3, TABLE + 2, 1, 38);
  }
  p.rect(t.front("#c4574a"), x0, TABLE + 34, x1 - x0, 4);
  p.rect(t.front("#e07a63"), x0, TABLE + 34, x1 - x0, 1);
  // Score cards in front of each judge.
  for (const [i, judge] of TASTEOFF_JUDGES.entries()) {
    const grade = state.hits[i];
    const cx = judge.x;
    p.rect(ink(t), cx - 10, TABLE - 12, 20, 12);
    p.rect(t.front("#fbf7ee"), cx - 9, TABLE - 11, 18, 10);
    const text = grade === undefined ? "-" : String(grade);
    word(p, text, t.front(grade === undefined ? "#b9a78a" : grade >= 80 ? "#5f7a5a" : grade >= 55 ? "#2b2126" : "#c4574a"), cx - Math.floor(wordWidth(text) / 2), TABLE - 9);
  }
  // Your cup on its stand, the rival's on theirs.
  for (const [cx, tea, label] of [[128, "#c79562", "YOU"], [304, "#a17d52", "RIVAL"]] as const) {
    p.rect(ink(t), cx - 8, TABLE - 26, 16, 22);
    p.rect(t.front("#f2e8d4"), cx - 7, TABLE - 25, 14, 20);
    p.rect(t.front(tea), cx - 6, TABLE - 21, 12, 15);
    for (let k = 0; k < 4; k++) p.rect(t.front("#3a2a28"), cx - 5 + k * 3, TABLE - 9, 2, 2);
    p.rect(t.left("#ffffff"), cx - 6, TABLE - 23, 1, 14);
    p.rect(ink(t), cx - 9, TABLE - 27, 18, 2);
    p.rect(t.front("#c4574a"), cx + 2, TABLE - 34, 2, 8);
    word(p, label, t.front("#7a5a46"), cx - Math.floor(wordWidth(label) / 2), TABLE + 6);
  }
  // A rosette for each round, filled once it's been played.
  for (let r = 0; r < 4; r++) {
    const rx = 186 + r * 20;
    const done = r < state.round;
    p.oval(ink(t), rx, TABLE + 14, 6, 6);
    p.oval(t.front(done ? "#e9c46a" : "#d8c7a4"), rx, TABLE + 14, 5, 5);
    p.oval(t.front(done ? "#c4574a" : "#efe0c2"), rx, TABLE + 14, 2, 2);
    p.rect(t.front(done ? "#c4574a" : "#c9b48e"), rx - 3, TABLE + 20, 2, 6);
    p.rect(t.front(done ? "#c4574a" : "#c9b48e"), rx + 2, TABLE + 20, 2, 6);
  }
}

function banner(p: Painter, t: Tone) {
  const text = "TASTE OFF";
  const w = bigWidth(text) + 18;
  const x = Math.round(W / 2 - w / 2);
  const y = 68;
  p.line(t.shade("#5a4436"), x + 2, y, x - 10, 42);
  p.line(t.shade("#5a4436"), x + w - 2, y, x + w + 10, 42);
  p.rect(ink(t), x - 1, y - 1, w + 2, 15);
  p.rect(t.front("#fbf2de"), x, y, w, 13);
  p.poly(ink(t), [x - 1, y + 13, x + 8, y + 13, x - 1, y + 19]);
  p.poly(ink(t), [x + w + 1, y + 13, x + w - 8, y + 13, x + w + 1, y + 19]);
  bigWord(p, text, t.front("#c4574a"), x + 9, y + 3);
}

/** The moving part: the gauge while a round runs, and the weather. */
export function drawTasteoffLife(p: Painter, light: Light, state: TasteoffState, time: number, cursor: number, running: boolean) {
  void state;
  if (running) gauge(p, W / 2, H - 24, 72, cursor, 0.12);
  precipitation(p, light, time, 0, 56, W, H - 56, 0.8);
}

/** The big wheel, baked with the backdrop at a still angle, behind the tent. */
export function drawWheel(p: Painter, light: Light, angle: number) {
  const t = tone(light, 1);
  const { x, y, r } = WHEEL;
  const frame = t.front("#e8e0cc");
  const edge = t.shade(mixHex("#e8e0cc", INK, 0.45));
  // Two legs, the rim (doubled), spokes and the cars.
  for (const dx of [-32, 32]) {
    p.line(edge, x + dx - 1, GROUND - 2, x - 1, y);
    p.line(frame, x + dx, GROUND - 2, x, y);
    p.line(frame, x + dx + 1, GROUND - 2, x + 1, y);
  }
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    p.rect(edge, Math.round(x + Math.cos(a) * (r + 1)), Math.round(y + Math.sin(a) * (r + 1)), 1, 1);
    p.rect(frame, Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
    p.rect(frame, Math.round(x + Math.cos(a) * (r - 6)), Math.round(y + Math.sin(a) * (r - 6)), 1, 1);
  }
  const lit = light.night > 0.3;
  for (let k = 0; k < 10; k++) {
    const a = angle + (k / 10) * Math.PI * 2;
    const ex = Math.round(x + Math.cos(a) * r);
    const ey = Math.round(y + Math.sin(a) * r);
    p.line(frame, x, y, ex, ey);
    if (lit) p.rect("#ffe6a8", Math.round(x + Math.cos(a) * (r - 3)), Math.round(y + Math.sin(a) * (r - 3)), 1, 1);
    p.rect(ink(t), ex - 4, ey, 9, 7);
    p.rect(lit ? "#ffd98f" : t.front(["#c4574a", "#7f9a72", "#e9c46a", "#8fa4c4", "#e48f88"][k % 5]), ex - 3, ey + 1, 7, 5);
    p.rect(lit ? "#fff1c4" : t.top("#fbf2de"), ex - 3, ey + 1, 7, 1);
  }
  p.oval(ink(t), x, y, 4, 4);
  p.oval(frame, x, y, 2, 2);
}
