/**
 * The Night Market Stall: an open-air stall in a car park turned market.
 * Low walls of striped canvas on a timber frame with a scalloped valance,
 * a deck of boards, crate counters, red lanterns and strings of bulbs, and
 * a neon TEA sign. Round it on the asphalt: chalk marks, the neighbours'
 * tents and food carts, and the city lit up beyond. Mostly open at night,
 * but it holds up by day too.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, project, faceLight, type IsoGrid } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { planks, shiplap, ground } from "../surfaces.ts";
import type { Surface } from "../surfaces.ts";
import type { Venue, PropSpec, WallItem, WallSide, FrontBox } from "../types.ts";
import { windowBar } from "../seating.ts";
import { displayCup } from "../front.ts";
import { word } from "../font.ts";
import type { VenueOptions } from "./index.ts";
import { SPRITES, litPalette } from "../props.ts";
import { litSet, wallQuad, wallLine, wallWord, wallDot, wallPt, frontWallProps, faceQuad, faceWord, INK, CREAM, frontFace, signFront, lanternFront, bulbsFront } from "./_corner-kit.ts";

const WALL_H = 56;
const TIMBER = "#6e4e38";
const STRIPE_A = "#e3d2ae";
const STRIPE_B = "#c0583e";
const LANTERN = "#c8553a";

const fract = (n: number) => n - Math.floor(n);

/** Striped canvas between timber posts every two tiles, a fold line now and then. */
function canvas(a: string, b: string, post: string, fold: string): Surface {
  return {
    colors: [a, b, post, fold],
    at(u, z) {
      const along = fract(u / 48) * 48;
      if (along < 3) return 2;
      if (z > 47 && z < 49) return 3;
      return Math.floor((u - 3) / 6) & 1 ? 1 : 0;
    },
  };
}

// The car park: asphalt, faded bay lines, chalk.
const tar = ground("#55525a", "#5b5860", "#6a6670", 0.05, 3);
const BAY = "#a8a49a";
const CHALK = ["#e8a8b8", "#a8c8e8", "#ecdc98", "#f0ece0"];

function lotGround(cols: number, rows: number) {
  return (x: number, y: number) => {
    // Faded bay lines along the front.
    if (y > rows + 1.4 && y < rows + 1.5 && x > -3 && x < cols + 4) return BAY;
    if (y > rows + 1.5 && y < rows + 4 && (Math.abs(x - 0.5) < 0.05 || Math.abs(x - 3) < 0.05 || Math.abs(x + 2) < 0.05)) return BAY;
    if (x > cols + 2.4 && x < cols + 2.5 && y > -4 && y < rows + 1.4) return BAY;
    // Hopscotch by the stall's open side.
    const hx = x - (cols + 0.9),
      hy = y - 0.6;
    if (hx > 0 && hx < 0.7 && hy > 0 && hy < 3.6) {
      const cell = hy - Math.floor(hy / 0.6) * 0.6;
      if (hx < 0.05 || hx > 0.65 || cell < 0.05) return CHALK[0];
      if (Math.floor(hy / 0.6) === 2 && Math.abs(hx - 0.35) < 0.04) return CHALK[0];
    }
    // A chalk sun with rays in front.
    const sx = x - 3.4,
      sy = y - (rows + 1.3);
    const r = Math.sqrt(sx * sx + sy * sy);
    if (r > 0.3 && r < 0.36) return CHALK[2];
    if (r > 0.45 && r < 0.75 && Math.abs(Math.sin(Math.atan2(sy, sx) * 4)) < 0.12) return CHALK[2];
    // An arrow pointing the queue in.
    const ax = x - (cols + 1.4),
      ay = y - (rows - 0.6);
    if (ay > -0.04 && ay < 0.04 && ax > 0 && ax < 1.0) return CHALK[1];
    if (ax > 0 && ax < 0.3 && Math.abs(Math.abs(ay) - ax) < 0.04) return CHALK[1];
    return tar.colors[tar.at(x * 24, y * 24)];
  };
}

/** The city beyond the car park: towers, a few lit windows by dusk, every one at night. */
function farCity(p: Painter, light: Light, width: number, horizon: number) {
  const haze = light.sky[2];
  const tones = ["#7a7f8c", "#8a8a96", "#6f7585", "#8f8a90"].map((c) => mixHex(light.lit(c, 0.25), haze, 0.35));
  const near = ["#5f6472", "#6a6a78"].map((c) => mixHex(light.lit(c, 0.25), haze, 0.2));
  let x = -4;
  for (let i = 0; x < width; i++) {
    const w = 8 + Math.floor(noise(i, 1, 41) * 14);
    const h = 8 + Math.floor(noise(i, 2, 41) * 20);
    p.rect(tones[i % 4], x, horizon - h, w, h + 4);
    if (noise(i, 3, 41) > 0.8) p.rect(tones[(i + 1) % 4], x + Math.floor(w / 2) - 1, horizon - h - 5, 2, 5);
    const lit = light.night > 0.25;
    if (lit)
      for (let wy = horizon - h + 2; wy < horizon - 1; wy += 3)
        for (let wx = x + 1; wx < x + w - 1; wx += 2) if (noise(wx, wy, 7) < 0.18 + light.night * 0.25) p.rect(noise(wx, wy, 8) > 0.85 ? "#9fd0e0" : "#efc77a", wx, wy, 1, 1);
    x += w + 1;
  }
  // Lower roofs nearer, and a couple of rooftop signs.
  x = -10;
  for (let i = 0; x < width; i++) {
    const w = 16 + Math.floor(noise(i, 4, 41) * 18);
    const h = 3 + Math.floor(noise(i, 5, 41) * 5);
    p.rect(near[i % 2], x, horizon - h, w, h + 4);
    if (noise(i, 6, 41) > 0.7) {
      const sx = x + 4;
      const on = light.night > 0.3;
      p.rect(mixHex(light.lit("#3a3440", 0.2), haze, 0.15), sx, horizon - h - 5, 10, 4);
      p.rect(on ? ["#ff8a9a", "#8ae0e0", "#ffd27a"][i % 3] : mixHex(light.lit("#b8a8a0", 0.3), haze, 0.2), sx + 1, horizon - h - 4, 8, 2);
    }
    x += w;
  }
}

const VIEW = litSet([
  ["#55525a", 0.4], // 0 asphalt
  ["#d8c8a8", 0.4], // 1 tent canvas
  ["#5f8a8a", 0.4], // 2 tent teal stripe
  ["#6e4e38", 0.3], // 3 timber
  ["#7a7f8c", 0.25], // 4 city
  ["#b8573f", 0.4], // 5 cart red
  ["#3a3440", 0.2], // 6 shade
]);

function stallView(u: number, v: number, light: Light, _wall: WallSide, height: number) {
  const c = VIEW(light);
  const [s0, s1, s2] = light.sky;
  const z = v * height;
  const w = u >= 1000 ? u - 1000 : u;
  const night = light.night > 0.3;
  if (z < 3) return c[0];
  // A neighbour's tent: striped canopy over a table, a lantern.
  if (w > 64 && w < 84) {
    if (z < 9) return z > 7 ? c[3] : c[6];
    if (z < 15) return (Math.abs(w - 74) < 1 && z > 10 && z < 13 && night) ? "#ffd27a" : c[6];
    if (z < 18 + (84 - w) * 0.25) return (Math.floor(w / 3) & 1) === 0 ? c[1] : c[2];
  }
  if (z < 6) return c[0];
  const tower = 10 + Math.floor(noise(Math.floor(w / 5), 1, 9) * 10);
  if (z < tower) return night && noise(Math.floor(w / 2), Math.floor(z / 3), 3) < 0.3 ? "#efc77a" : c[4];
  const t = (z - tower) / Math.max(1, height - tower);
  return t > 0.6 ? s0 : t > 0.25 ? s1 : s2;
}

/** A scalloped canvas valance along the wall top, stripes to match. */
function valance(wall: WallSide, at: number, w: number): WallItem {
  return {
    wall,
    at,
    z: WALL_H,
    draw(p, light, place) {
      const n = Math.floor(w / 6);
      for (let i = 0; i < n; i++) {
        const col = light.lit(i % 2 ? STRIPE_A : STRIPE_B, 0.35);
        wallQuad(p, place, i * 6, -1, 6, 5, col);
        const tip = wallPt(place, i * 6 + 3, -7);
        const a = wallPt(place, i * 6, -5);
        const b = wallPt(place, i * 6 + 6, -5);
        p.poly(col, [a.x, a.y, b.x, b.y, tip.x + place.dir * 2, tip.y, tip.x - place.dir * 2, tip.y]);
        p.rect(light.lit(mixHex(i % 2 ? STRIPE_A : STRIPE_B, INK, 0.35), 0.2), tip.x, tip.y + 1, 1, 1);
      }
      wallLine(p, place, 0, 0, w, 0, light.lit(TIMBER, 0.3));
      wallLine(p, place, 0, 1, w, 1, light.lit(mixHex(TIMBER, INK, 0.4), 0));
    },
  };
}

/** TEA in neon tubes on a dark backing board, glowing after dark. */
function neonTea(wall: WallSide, at: number, z: number): WallItem {
  // Each letter as strokes in a 9 by 13 box: [x0, y0, x1, y1] from the top-left.
  const T = [[0, 0, 8, 0], [4, 0, 4, 12]];
  const E = [[0, 0, 7, 0], [0, 0, 0, 12], [0, 6, 6, 6], [0, 12, 7, 12]];
  const A = [[0, 12, 4, 0], [4, 0, 8, 12], [2, 7, 6, 7]];
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const on = light.night > 0.15;
      const w = 40,
        h = 20;
      wallQuad(p, place, -1, -1, w + 2, h + 2, light.lit("#3e3a3f", 0.2));
      wallQuad(p, place, 0, 0, w, h, light.lit("#2a2630", 0));
      for (const k of [3, w - 4]) wallQuad(p, place, k, h + 1, 1, 6, light.lit("#3e3a3f", 0));
      const colors = ["#ff7a9a", "#7ae0e8", "#ffd27a"];
      [T, E, A].forEach((strokes, i) => {
        const x0 = 4 + i * 12;
        const tube = on ? colors[i] : light.lit(mixHex(colors[i], "#8a8a8a", 0.5), 0.3);
        const glow = colors[i];
        for (const [a, b, c2, d] of strokes) {
          const steps = Math.max(Math.abs(c2 - a), Math.abs(d - b));
          for (let s = 0; s <= steps; s++) {
            const t = steps ? s / steps : 0;
            const along = x0 + a + (c2 - a) * t;
            const up = h - 4 - (b + (d - b) * t);
            if (on) p.alpha(0.35 * light.night, () => wallQuad(p, place, along - 1, up - 1, 3, 3, glow));
            wallDot(p, place, along, up, tube);
          }
        }
      });
      if (on) p.alpha(0.12 * light.night, () => wallQuad(p, place, -6, -6, w + 12, h + 12, "#ff9ab0"));
    },
  };
}

/** A painted board menu on two cords: BOBA, prices in chalk colours. */
function plankMenu(wall: WallSide, at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const w = 34,
        h = 22;
      // Laid out to read left to right on either wall.
      const m = (a: number, len: number) => (place.dir > 0 ? a : w - a - len);
      wallLine(p, place, 4, h, 2, h + 6, light.lit("#c9b48a", 0.2));
      wallLine(p, place, w - 4, h, w - 2, h + 6, light.lit("#c9b48a", 0.2));
      wallQuad(p, place, -1, -1, w + 2, h + 2, light.lit("#8a6448", 0.3));
      wallQuad(p, place, 0, 0, w, h, light.lit("#3a3030", 0.1));
      wallWord(p, place, m(4, 15), h - 3, "BOBA", light.lit("#f3e4c4", 0.4));
      wallLine(p, place, m(21, 9), h - 5, m(21, 9) + 9, h - 5, light.lit("#ffb38a", 0.3));
      const lines = ["#ffb38a", "#c9e6a0", "#e8b0d0"];
      for (let i = 0; i < 3; i++) {
        wallLine(p, place, m(4, 13), h - 11 - i * 3.5, m(4, 13) + 13, h - 11 - i * 3.5, light.lit(lines[i], 0.3));
        wallLine(p, place, m(25, 5), h - 11 - i * 3.5, m(25, 5) + 5, h - 11 - i * 3.5, light.lit("#f3e4c4", 0.3));
      }
    },
  };
}

/** A rolled canvas flap over the opening in the left wall. */
function rolledFlap(wall: WallSide, at: number, w: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wallQuad(p, place, -2, 0, w * 24 + 4, 5, light.lit(mixHex(STRIPE_A, INK, 0.2), 0.2));
      for (let a = 0; a < w * 24; a += 6) wallQuad(p, place, a, 1, 3, 3, light.lit(STRIPE_B, 0.3));
      wallLine(p, place, -2, 5, w * 24 + 2, 5, light.lit(mixHex(STRIPE_A, CREAM, 0.3), 0.4));
      for (const a of [3, w * 24 - 4]) wallLine(p, place, a, 0, a, 6, light.lit("#c9b48a", 0.3));
    },
  };
}

/** Crates stacked on the blocked corner, a gas bottle and a cooler. */
function crateStack(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 34,
    pad: 4,
    draw(p, g, light) {
      const share = 0.9;
      const crate = (bx: number, by: number, z: number, wood: string) => {
        isoBox(p, g, light, bx, by, 0.42, 0.42, 10, { top: wood, left: wood, right: mixHex(wood, INK, 0.2) }, z, share);
        const f = faceLight(light, share);
        const slat = light.lit(mixHex(wood, INK, 0.4), f.left * 0.5);
        const box = [bx, by, 0.42, 0.42];
        faceQuad(p, g, "y", box, 0, 1, z + 4, z + 5, slat);
        faceQuad(p, g, "x", box, 0, 1, z + 4, z + 5, light.lit(mixHex(wood, INK, 0.45), f.right * 0.5));
      };
      crate(0.08, 0.1, 0, "#b98d5e");
      crate(0.5, 0.1, 0, "#a8804f");
      crate(0.1, 0.12, 10, "#a8804f");
      crate(0.12, 0.52, 0, "#b98d5e");
      // Oranges in the top crate.
      const o = project(g, 0.31, 0.33, 20);
      for (let i = 0; i < 5; i++) p.rect(light.lit("#e39a3a", faceLight(light, share).top + 0.2), o.x - 4 + i * 2, o.y - 1 - (i % 2), 2, 2);
      // The cooler and a gas bottle.
      isoBox(p, g, light, 0.56, 0.56, 0.36, 0.3, 9, { top: "#e8e2d0", left: "#3f7a8a", right: "#2f6070" }, 0, share);
      const gb = project(g, 0.75, 0.32, 10);
      p.rect(light.lit("#3e6a8a", faceLight(light, share).left), gb.x - 2, gb.y - 9, 5, 9);
      p.rect(light.lit("#2e4a62", 0), gb.x + 2, gb.y - 9, 1, 9);
      p.rect(light.lit("#9a9da0", 0.4), gb.x - 1, gb.y - 11, 3, 2);
    },
  };
}

/** A timber post from the deck up past the canvas, with a finial. */
function postProp(key: string, x: number, y: number, h: number): PropSpec {
  return {
    key,
    x: x - 0.1,
    y: y - 0.1,
    w: 0.2,
    d: 0.2,
    height: h + 4,
    shadow: "none",
    draw(p, g, light) {
      isoBox(p, g, light, 0.02, 0.02, 0.16, 0.16, h, { top: TIMBER, left: TIMBER, right: mixHex(TIMBER, INK, 0.25) }, 0, 0.9);
      const t = project(g, 0.1, 0.1, h);
      p.rect(light.lit(STRIPE_B, 0.4), t.x - 1, t.y - 3, 3, 3);
    },
  };
}

/** A neighbour's tent: four poles, a striped peaked canopy, a table of goods and a lantern. */
function tentProp(key: string, x: number, y: number, stripe: string, goods: string[]): PropSpec {
  return {
    key,
    x,
    y,
    w: 2,
    d: 2,
    height: 50,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const pole = light.lit("#5a5048", 0.2);
      for (const [u, v] of [[0.1, 0.1], [1.9, 0.1], [0.1, 1.9], [1.9, 1.9]]) {
        const a = project(g, u, v, 0);
        p.rect(pole, a.x, a.y - 34, 1, 34);
      }
      // A trestle table of goods.
      isoBox(p, g, light, 0.4, 1.2, 1.3, 0.5, 12, { top: "#c9b48a", left: "#7a5a44", right: "#6a4c3a" }, 0);
      faceQuad(p, g, "y", [0.4, 1.2, 1.3, 0.5], 0, 1, 0, 11, light.lit(stripe, f.left));
      goods.forEach((name, i) => {
        const s = SPRITES[name];
        const at = project(g, 0.6 + i * 0.35, 1.45, 12);
        const pal: Record<string, string> = {};
        for (const [k, col] of Object.entries(s.palette)) pal[k] = k === "O" ? col : light.lit(col, f.top * 0.8);
        p.sprite(s.grid, pal, at.x - Math.floor(s.grid[0].length / 2), at.y - s.grid.length + 1);
      });
      // The canopy: a striped pyramid over the four poles, a valance round the eaves.
      const eave = 34,
        peak = project(g, 1, 1, 50);
      const corners = [project(g, 0, 0, eave), project(g, 2, 0, eave), project(g, 2, 2, eave), project(g, 0, 2, eave)];
      // Back slopes first (seen from above), then the two that face the street.
      const slopes: [number, number, number][] = [[0, 1, f.top * 0.5], [3, 0, f.top * 0.5], [1, 2, f.right * 0.7 + 0.1], [2, 3, f.left * 0.7 + 0.1]];
      for (const [i, j, face] of slopes) {
        const P = corners[i],
          Q = corners[j];
        const n = 6;
        for (let k = 0; k < n; k++) {
          const t0 = k / n,
            t1 = (k + 1) / n;
          const col = k % 2 ? "#e8dcc4" : stripe;
          p.poly(light.lit(col, face), [P.x + (Q.x - P.x) * t0, P.y + (Q.y - P.y) * t0, P.x + (Q.x - P.x) * t1, P.y + (Q.y - P.y) * t1, peak.x, peak.y]);
        }
      }
      const ink = light.lit(INK, 0);
      p.line(ink, corners[3].x, corners[3].y, corners[2].x, corners[2].y);
      p.line(ink, corners[2].x, corners[2].y, corners[1].x, corners[1].y);
      p.line(ink, corners[2].x, corners[2].y, peak.x, peak.y);
      p.line(ink, corners[3].x, corners[3].y, peak.x, peak.y);
      p.line(ink, corners[1].x, corners[1].y, peak.x, peak.y);
      p.rect(light.lit(stripe, f.top), peak.x - 1, peak.y - 3, 2, 3);
      for (const [i, j, face] of [[3, 2, f.left], [2, 1, f.right]] as const) {
        const P = corners[i],
          Q = corners[j];
        for (let k = 0; k < 8; k++) {
          const t = (k + 0.5) / 8;
          const vx = P.x + (Q.x - P.x) * t,
            vy = P.y + (Q.y - P.y) * t;
          p.rect(light.lit(k % 2 ? "#e8dcc4" : stripe, face), vx - 2, vy, 4, 3);
        }
      }
      const on = light.night > 0.15;
      const l = project(g, 1, 1.6, 30);
      p.line(pole, l.x, l.y - 4, l.x, l.y);
      p.rect(light.lit(LANTERN, 0.3), l.x - 2, l.y, 5, 5);
      p.rect(on ? "#ffd27a" : light.lit("#f0c8a0", 0.3), l.x - 1, l.y + 1, 3, 3);
      if (on) p.alpha(0.2 * light.night, () => p.oval("#ffc070", l.x, l.y + 3, 10, 7));
    },
  };
}

/** A food cart under a parasol: wheels, a hatch, a little stack of bowls. */
function cartProp(key: string, x: number, y: number, body: string, umbrella: string): PropSpec {
  return {
    key,
    x,
    y,
    w: 1.4,
    d: 1,
    height: 46,
    pad: 10,
    draw(p, g, light) {
      const f = faceLight(light, 1);
      isoBox(p, g, light, 0.1, 0.2, 1.2, 0.6, 16, { top: "#d8d0bc", left: body, right: mixHex(body, INK, 0.25) }, 4);
      const box = [0.1, 0.2, 1.2, 0.6];
      faceQuad(p, g, "y", box, 0.1, 0.9, 10, 17, light.lit(mixHex(body, CREAM, 0.3), f.left));
      faceWord(p, g, "y", box, 0.5, 16, "FOOD", light.lit(mixHex(body, INK, 0.5), f.left));
      for (const u of [0.3, 1.1]) {
        const w = project(g, u, 0.8, 4);
        p.oval(light.lit("#2e2a2d", 0), w.x, w.y, 4, 4);
        p.oval(light.lit("#8a8d90", 0.4), w.x, w.y, 1, 1);
      }
      // Steam from a pot.
      const pot = project(g, 0.5, 0.5, 20);
      p.rect(light.lit("#6f7478", f.top), pot.x - 3, pot.y - 3, 7, 3);
      if (light.night < 0.9) p.alpha(0.4, () => p.rect(light.lit("#efe8dc", 0.5), pot.x, pot.y - 8, 1, 4));
      // Parasol.
      const top = project(g, 0.9, 0.5, 46);
      const pole = project(g, 0.9, 0.5, 20);
      p.line(light.lit("#5a5048", 0.2), pole.x, pole.y, top.x, top.y);
      // The parasol's near half as gores from the tip to a scalloped rim.
      const R = 18;
      for (let i = 0; i < 8; i++) {
        const a0 = Math.PI * (i / 8),
          a1 = Math.PI * ((i + 1) / 8);
        const rim = (a: number) => [top.x - Math.cos(a) * R, top.y + 8 + Math.sin(a) * 4] as const;
        const [x0, y0] = rim(a0),
          [x1, y1] = rim(a1);
        p.poly(light.lit(i % 2 ? "#e8dcc4" : umbrella, i < 4 ? f.left * 0.8 + 0.1 : f.right * 0.8 + 0.1), [top.x, top.y - 3, x0, y0, x1, y1]);
      }
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (i / 8);
        p.rect(light.lit(INK, 0), top.x - Math.cos(a) * R, top.y + 8 + Math.sin(a) * 4, 1, 2);
      }
      p.rect(light.lit("#5a5048", 0.2), top.x, top.y - 5, 1, 2);
    },
  };
}

/** Stacked plastic stools and a crate of empties. */
function stoolsProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 20,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      for (let k = 0; k < 3; k++) {
        const s = project(g, 0.35, 0.4, k * 3);
        p.rect(light.lit("#c94a3c", f.left), s.x - 4, s.y - 9, 9, 3);
        p.rect(light.lit("#e06a5a", f.top), s.x - 4, s.y - 10, 9, 1);
        p.rect(light.lit("#9a3a30", 0), s.x - 4, s.y - 6, 1, 6);
        p.rect(light.lit("#9a3a30", 0), s.x + 4, s.y - 6, 1, 6);
      }
      isoBox(p, g, light, 0.55, 0.5, 0.36, 0.36, 7, { top: "#3f6a8a", left: "#3f6a8a", right: "#2f5470" }, 0);
      const b = project(g, 0.73, 0.68, 7);
      for (let i = 0; i < 3; i++) p.rect(light.lit("#8fb89a", f.top), b.x - 3 + i * 2, b.y - 4, 1, 3);
    },
  };
}

/** Strings of bulbs from the stall's posts out to the neighbours. */
function strings(lines: [number, number, number, number, number, number][]) {
  return (p: Painter, g: IsoGrid, light: Light) => {
    const on = light.night > 0.15;
    for (const [x0, y0, z0, x1, y1, z1] of lines) {
      const a = project(g, x0, y0, z0);
      const b = project(g, x1, y1, z1);
      const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 8));
      let px = a.x,
        py = a.y;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 8;
        p.line(light.lit("#3a2c2c", 0), px, py, x, y);
        px = x;
        py = y;
        if (i < n) {
          p.rect(on ? ["#ffe08a", "#ffb38a", "#ff9a8a", "#c9e6a0"][i % 4] : light.lit("#d9c9a4", 0.3), x, y + 1, 2, 2);
          if (on) p.alpha(0.28 * light.night, () => p.rect("#ffe08a", x - 1, y, 4, 4));
        }
      }
    }
  };
}

/** A striped tent canopy seen front on: a sloped front from `peak` down to `eave`, a scalloped valance. */
function canopyFront(p: Painter, light: Light, x0: number, x1: number, inset: number, peak: number, eave: number, a: string, b: string, n: number) {
  const top0 = x0 + inset,
    top1 = x1 - inset;
  p.poly(light.lit(INK, 0), [top0 - 1, peak - 1, top1 + 1, peak - 1, x1 + 1, eave + 1, x0 - 1, eave + 1]);
  for (let i = 0; i < n; i++) {
    const t0 = i / n,
      t1 = (i + 1) / n;
    p.poly(light.lit(i % 2 ? b : a, 0.65), [top0 + (top1 - top0) * t0, peak, top0 + (top1 - top0) * t1, peak, x0 + (x1 - x0) * t1, eave, x0 + (x1 - x0) * t0, eave]);
  }
  p.rect(light.lit(mixHex(a, CREAM, 0.4), 0.9), top0, peak, top1 - top0, 1);
  for (let xx = x0; xx < x1; xx++) {
    const k = Math.floor((xx - x0) / 8) % 2;
    const s = (xx - x0) % 8;
    const col = k ? b : a;
    p.rect(light.lit(col, 0.5), xx, eave + 1, 1, 5 + (s > 1 && s < 6 ? 2 : 0));
  }
  p.rect(light.lit(INK, 0), x0, eave, x1 - x0, 1);
}

/** A neighbour's stall at the edge of the view: poles, a peaked canopy, a table of goods, a lantern. */
function neighbourStall(p: Painter, light: Light, cx: number, G: number, stripe: string, goods: string[]) {
  const half = 34;
  const eave = G - 52;
  const pole = light.lit("#5a5048", 0.3);
  p.rect(pole, cx - half + 4, eave, 2, G - eave);
  p.rect(pole, cx + half - 6, eave, 2, G - eave);
  canopyFront(p, light, cx - half, cx + half, 16, eave - 13, eave, stripe, "#e8dcc4", 8);
  // The table: a cloth to the ground, goods on top.
  const ty = G - 16;
  p.rect(light.lit(INK, 0), cx - half + 6, ty - 1, half * 2 - 12, 1);
  p.rect(light.lit("#c9b48a", 0.6), cx - half + 6, ty, half * 2 - 12, 2);
  p.rect(light.lit(stripe, frontFace(light) * 0.8 + 0.1), cx - half + 6, ty + 2, half * 2 - 12, G - ty - 2);
  for (let k = cx - half + 8; k < cx + half - 8; k += 6) p.rect(light.lit(mixHex(stripe, INK, 0.25), 0.3), k, G - 3, 3, 3);
  goods.forEach((name, i) => {
    const s = SPRITES[name];
    const pal: Record<string, string> = {};
    for (const [k, col] of Object.entries(s.palette)) pal[k] = k === "O" ? col : light.lit(col, 0.6, 0.4);
    p.sprite(s.grid, pal, cx - half + 12 + i * 14, ty - s.grid.length + 1);
  });
  lanternFront(p, light, cx, eave + 6, LANTERN);
}

/**
 * The stall from across the car park: a striped canopy on timber posts with
 * the name board on its front, lanterns and bulbs under the valance, the
 * neon TEA on the canvas behind, the crate counter with the drink on it,
 * and the neighbours' stalls either side.
 */
function nightFront(p: Painter, light: Light, box: FrontBox) {
  const L = (hex: string, f = 0.5, g = 0) => light.lit(hex, f, g);
  const fw = frontFace(light);
  const W = p.width;
  const { x, w, ground: G, open } = box;
  const c = Math.round(x + w / 2);
  const on = light.night > 0.15;
  neighbourStall(p, light, x - 28, G, "#5f8a8a", ["jar", "bottle", "jar"]);
  neighbourStall(p, light, x + w + 28, G, "#8e6a9e", ["teapot", "pot", "jar"]);
  const eave = G - 74,
    peak = eave - 22,
    back = eave + 8,
    ct = G - 17;
  // The canvas back wall between the posts, in the canopy's shade.
  for (let xx = x + 6; xx < x + w - 6; xx++) {
    const k = Math.floor((xx - x) / 6) % 2;
    p.rect(L(k ? STRIPE_B : STRIPE_A, 0.1, 0.7), xx, back, 1, ct - back);
  }
  p.rect(L(TIMBER, 0.2), x + 6, back, w - 12, 2);
  if (open) {
    // The neon TEA on its board, a menu, a shelf of jars.
    const nx = x + 16,
      ny = back + 8;
    p.rect(L(INK, 0), nx - 1, ny - 1, 38, 20);
    p.rect(L("#2a2630", 0), nx, ny, 36, 18);
    const tubes: [string, number[][]][] = [
      ["#ff7a9a", [[0, 0, 8, 0], [4, 0, 4, 12]]],
      ["#7ae0e8", [[0, 0, 7, 0], [0, 0, 0, 12], [0, 6, 6, 6], [0, 12, 7, 12]]],
      ["#ffd27a", [[0, 12, 4, 0], [4, 0, 8, 12], [2, 7, 6, 7]]],
    ];
    tubes.forEach(([col, strokes], i) => {
      const tube = on ? col : L(mixHex(col, "#8a8a8a", 0.5), 0.3);
      for (const [a, b, c2, d] of strokes) {
        const steps = Math.max(Math.abs(c2 - a), Math.abs(d - b));
        for (let s = 0; s <= steps; s++) {
          const t = steps ? s / steps : 0;
          const px = nx + 4 + i * 11 + Math.round(a + (c2 - a) * t);
          const py = ny + 3 + Math.round(b + (d - b) * t);
          if (on) p.alpha(0.3 * light.night, () => p.rect(col, px - 1, py - 1, 3, 3));
          p.rect(tube, px, py, 1, 1);
        }
      }
    });
    if (on) p.alpha(0.1 * light.night, () => p.rect("#ff9ab0", nx - 5, ny - 5, 46, 28));
    const mx = x + w - 52;
    p.rect(L("#8a6448", 0.3, 0.5), mx - 1, ny - 1, 34, 22);
    p.rect(L("#3a3030", 0.1, 0.4), mx, ny, 32, 20);
    word(p, "BOBA", L("#f3e4c4", 0.4, 0.6), mx + 3, ny + 3);
    ["#ffb38a", "#c9e6a0", "#e8b0d0"].forEach((col, i) => {
      p.rect(L(col, 0.3, 0.6), mx + 3, ny + 10 + i * 3, 14, 1);
      p.rect(L("#f3e4c4", 0.3, 0.6), mx + 22, ny + 10 + i * 3, 6, 1);
    });
    const sy = ct - 9;
    p.rect(L(TIMBER, 0.3, 0.6), c - 22, sy, 44, 2);
    for (let i = 0; i < 6; i++) {
      const s = SPRITES[i % 2 ? "jar" : "tin"];
      p.sprite(s.grid, litPalette(s.palette, light, 0.3), c - 20 + i * 7, sy - s.grid.length);
    }
  } else {
    // The front flap rolled down and tied.
    for (let xx = x + 6; xx < x + w - 6; xx++) {
      const k = Math.floor((xx - x) / 6) % 2;
      p.rect(L(k ? STRIPE_B : STRIPE_A, fw * 0.8 + 0.1), xx, back, 1, G - back);
    }
    for (const tx of [x + 30, x + w - 30]) p.rect(L("#c9b48a", 0.5), tx, back, 2, G - back);
  }
  // Posts, the canopy with the name board, lanterns and bulbs under the valance.
  for (const px of [x + 2, x + w - 6]) {
    p.rect(L(INK, 0), px - 1, eave, 6, G - eave);
    p.rect(L(TIMBER, fw * 0.7 + 0.1), px, eave, 4, G - eave);
    p.rect(L(mixHex(TIMBER, CREAM, 0.2), fw), px, eave, 1, G - eave);
  }
  // Bulbs strung out to the neighbours' canopies.
  bulbsFront(p, light, x - 8, eave + 2, x - 44, G - 51, 5, 7);
  bulbsFront(p, light, x + w + 8, eave + 2, x + w + 44, G - 51, 5, 7);
  canopyFront(p, light, x - 8, x + w + 8, 24, peak, eave, STRIPE_B, STRIPE_A, 14);
  signFront(p, light, box.name, c, peak + 5, "#3a3030", "#f3e4c4", w - 20, 0.8);
  bulbsFront(p, light, x + 4, eave + 9, x + w - 4, eave + 9, 4, 8);
  for (const lx of [x + 26, c, x + w - 26]) lanternFront(p, light, lx, eave + 8, LANTERN);
  if (open) {
    // The crate counter across the front, the drink on it.
    p.rect(L(INK, 0), x + 6, ct - 1, w - 12, 1);
    p.rect(L("#c49a68", 0.7), x + 6, ct, w - 12, 2);
    p.rect(L("#a87a4c", fw * 0.8 + 0.1), x + 6, ct + 2, w - 12, G - ct - 2);
    for (let yy = ct + 6; yy < G; yy += 4) p.rect(L("#8a6240", 0.3), x + 6, yy, w - 12, 1);
    for (let cx = x + 6; cx + 24 <= x + w - 6; cx += 25) {
      p.rect(L("#7a5236", 0.3), cx, ct + 2, 1, G - ct - 2);
      p.line(L("#7a5236", 0.3), cx + 1, G - 1, cx + 23, ct + 3);
    }
    if (box.display) displayCup(p, light, box.display, Math.round(x + w * 0.3), ct);
  }
  // Crates and a stool by the left post.
  p.rect(L(INK, 0), x - 14, G - 12, 13, 12);
  p.rect(L("#b98d5e", fw * 0.8 + 0.1), x - 13, G - 11, 11, 11);
  p.rect(L("#8a6240", 0.3), x - 13, G - 6, 11, 1);
  for (let i = 0; i < 4; i++) p.rect(L("#e39a3a", 0.6), x - 12 + i * 3, G - 14, 2, 2);
  void W;
}

export function nightVenue(o: VenueOptions): Venue {
  const { cols, rows } = o;
  // Two stools at the rail along the near side, looking out over the car park.
  const sit = windowBar("night-bar", "front-left", 0.9, 2.9, 2, { cols, rows, wall: 12 }, { wood: TIMBER, seat: STRIPE_B, top: "#c49a68" });
  const postH = 70;
  return {
    id: "night",
    cols,
    rows,
    floor: planks("#8a6a4e", "#94735a", "#5e4636", "#7a5c44", 6, 40),
    wall: canvas(STRIPE_A, STRIPE_B, TIMBER, mixHex(STRIPE_B, INK, 0.2)),
    wainscot: { surface: shiplap("#7a5a40", "#84634a", "#54402e", 4), height: 14, rail: TIMBER },
    cap: "#8a6448",
    slab: "#6e5a4a",
    slabHeight: 5,
    wallHeight: WALL_H,
    windows: [{ wall: "left", at: 2.5, width: 1.4, sill: 18, top: 42, frame: TIMBER }],
    doors: [],
    lamps: [
      { kind: "lantern", x: 0.4, y: 2.15, z: 40, color: LANTERN, reach: 2.6 },
      { kind: "lantern", x: 0.4, y: 4.4, z: 40, color: LANTERN, reach: 2.4 },
      { kind: "lantern", x: 2.6, y: 0.4, z: 40, color: LANTERN, reach: 2.6 },
      { kind: "lantern", x: 4.6, y: 0.4, z: 40, color: LANTERN, reach: 2.6 },
      { kind: "bulbs", x: 0.2, y: 0, z: 52, to: [cols - 0.2, 0, 52], reach: 0.01 },
      { kind: "bulbs", x: 0, y: 0.2, z: 52, to: [0, rows - 0.2, 52], reach: 0.01 },
      // The open side under the strings to the neighbours.
      { kind: "sconce", x: 4.4, y: 3.4, z: 60, reach: 2.4 },
    ],
    wallItems: [
      valance("right", 0, cols * 24),
      valance("left", 0, rows * 24),
      neonTea("right", 0.35, 24),
      plankMenu("left", 0.3, 22),
      rolledFlap("left", 2.5, 1.4, 42),
    ],
    props: [
      ...sit.props,
      crateStack("prop:crates", cols - 1, 0),
      stoolsProp("prop:stools", 0, rows - 1),
      postProp("prop:post", cols, 0, postH),
      postProp("prop:post", 0, rows, postH),
      ...frontWallProps("prop:front", cols, rows, { height: 12, kind: "rail", color: TIMBER, line: "#5a4030", cap: "#8a6448", gapsRight: [3, 4], gapsLeft: [] }),
    ],
    counter: { top: "#c49a68", front: "#a87a4c", side: "#8a6240", trim: "#7a5236", panel: "crate", height: 15 },
    outside: {
      ground: lotGround(cols, rows),
      far: farCity,
      view: stallView,
      props: [
        tentProp("out:tentL", -5.2, 0.2, "#5f8a8a", ["jar", "bottle", "jar"]),
        tentProp("out:tentR", 0.4, -5.0, "#8e6a9e", ["teapot", "pot"]),
        cartProp("out:cart1", -2.6, 3.6, "#c9a24a", "#c0583e"),
        cartProp("out:cart2", cols + 0.6, -1.9, "#5f7a8a", "#e3a43a"),
        stoolsProp("out:stools", 1.2, rows + 0.4),
      ],
    },
    // In through the gap in the rail at the near end of the open side, the line out onto the car park.
    seats: sit.seats,
    doorway: { wall: "front-right", from: rows - 2, to: rows },
    entry: [cols + 4.2, rows - 0.7],
    queue: [
      [cols - 1.5, 3.4],
      [cols - 0.75, 3.6],
      [cols + 0.75, 3.9],
      [cols + 1.5, 3.9],
      [cols + 2.25, 3.9],
      [cols + 3.0, 3.9],
    ],
    pickup: [cols - 2.25, 3.5],
    out: [
      [cols - 2.0, rows - 0.65],
      [cols - 0.6, rows - 0.55],
      [cols + 0.8, rows - 0.55],
    ],
    indoorSun: 0.9,
    facade: {
      wall: canvas(STRIPE_A, STRIPE_B, TIMBER, mixHex(STRIPE_B, INK, 0.2)),
      trim: TIMBER,
      sign: { board: "#3a3030", ink: "#f3e4c4" },
      awning: [STRIPE_B, STRIPE_A],
      door: TIMBER,
      upper: false,
      neighbours: "none",
      queueAt: 0.6,
      paint: nightFront,
    },
    overhead: strings([
      [cols, 0, postH, cols + 1.4, -2.2, 46],
      [0, rows, postH, -1.8, rows - 1.6, 44],
      [0, 0, WALL_H + 4, -3.6, -1.2, 46],
    ]),
  };
}
