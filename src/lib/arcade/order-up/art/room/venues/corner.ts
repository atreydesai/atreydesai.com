/**
 * The Corner Counter: the first shop, a neighbourhood tea shop on a street
 * corner. Terracotta brick over a sage tiled wainscot, a warm checker floor,
 * wooden counters with sage drawer fronts under three green pendants. A wide
 * shop window on the right wall looks across the street at the shops
 * opposite; a small one on the left looks over the side street's houses.
 * Guests come in at the door by the near corner and queue down the right side.
 */
import { mixHex } from "../../../../core/color.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { checker, brick, tiles, stone, ground } from "../surfaces.ts";
import type { Venue, WallItem, FrontBox } from "../types.ts";
import { displayCup } from "../front.ts";
import { word, wordWidth, bigWord, bigWidth } from "../font.ts";
import type { VenueOptions } from "./index.ts";
import { shelf, clock, framed, rail } from "../walls.ts";
import { lampPostProp, benchProp, aFrameProp, SPRITES, litPalette } from "../props.ts";
import { litSet, wallQuad, wallLine, wallWord, wallDot, plantProp, matItem, bikeRackProp, facadeRow, frontWallProps, INK, CREAM, seasonTreeProp, frontFace, brickFront, glassFront, awningFront } from "./_corner-kit.ts";

const BRICK = "#b4664e";
const SAGE = "#86a084";
const WOOD = "#a8744f";
const FRAME = "#5e4a3e";

// The street: flags on the pavements, asphalt, kerbs, a zebra crossing.
const pave = stone("#bcb3a5", "#b2a99b", "#978e82", "#c8c1b4", 16);
const tar = ground("#59565c", "#5e5b61", "#6e6a72", 0.05, 3);
const KERB = "#b0a89c";
const GUTTER = "#4d4a50";
const LINE = "#d8cc98";
const ZEBRA = "#ddd7c6";
const SOIL = "#5e4c40";
const GRATE = "#45403f";
const LEAF_A = "#c47a3e";
const LEAF_B = "#d9a055";

/** Street A runs behind the right wall, street B behind the left; they cross behind the back corner. */
const A0 = -5.8,
  A1 = -2.2,
  B0 = -5.6,
  B1 = -2.2;
/** The two street trees, each in a pit with a grate. */
const T1X = -1.5,
  T1Y = 6.5,
  T2X = 8.9,
  T2Y = -1.3;

function pit(dx: number, dy: number) {
  return (Math.floor((dx + dy) * 10) & 1) === 0 && Math.abs(dx) < 0.36 && Math.abs(dy) < 0.36 ? SOIL : GRATE;
}

/** In front of the shop the pavement runs unbroken (the street view's foreground). */
const FRONT_Y = 7.8;

function cornerGround(x: number, y: number, light?: Light) {
  const inA = y > A0 && y < A1;
  const inB = x > B0 && x < B1 && y < FRONT_Y;
  if (inA || inB) {
    if (inA && inB) return tar.colors[tar.at(x * 24, y * 24)];
    if (inA) {
      if (y > A1 - 0.12 || y < A0 + 0.12) return GUTTER;
      // Zebra crossings: one at the corner, one in front of the shop.
      if ((x > -2.0 && x < -0.6) || (x > 4.7 && x < 6.3)) return ((y * 2.4) & 1) === 0 && y < A1 - 0.3 && y > A0 + 0.3 ? ZEBRA : tar.colors[tar.at(x * 24, y * 24)];
      if (Math.abs(y - (A0 + A1) / 2) < 0.05 && x - Math.floor(x / 1.4) * 1.4 < 0.7) return LINE;
      return tar.colors[tar.at(x * 24, y * 24)];
    }
    if (x > B1 - 0.12 || x < B0 + 0.12) return GUTTER;
    if (y > -2.0 && y < -0.6) return ((x * 2.4) & 1) === 0 && x < B1 - 0.3 && x > B0 + 0.3 ? ZEBRA : tar.colors[tar.at(x * 24, y * 24)];
    if (Math.abs(x - (B0 + B1) / 2) < 0.05 && y - Math.floor(y / 1.4) * 1.4 < 0.7) return LINE;
    return tar.colors[tar.at(x * 24, y * 24)];
  }
  // Kerb stones along both pavements.
  if ((y > A1 - 0.02 && y < A1 + 0.14 && x > B1) || (y < A0 && y > A0 - 0.14) || (y < FRONT_Y && ((x > B1 - 0.02 && x < B1 + 0.14 && y > A1) || (x < B0 && x > B0 - 0.14)))) return KERB;
  // Tree pits with their grates.
  const ax = x - T1X - 0.5,
    ay = y - T1Y - 0.5;
  if (ax > -0.45 && ax < 0.45 && ay > -0.45 && ay < 0.45) return pit(ax, ay);
  const bx = x - T2X - 0.5,
    by = y - T2Y - 0.5;
  if (bx > -0.45 && bx < 0.45 && by > -0.45 && by < 0.45) return pit(bx, by);
  // Fallen leaves on the flags in autumn.
  if (light?.season === "autumn" && noise(Math.floor(x * 14), Math.floor(y * 14), 77) > 0.965) return noise(Math.floor(x * 14), Math.floor(y * 14), 78) > 0.5 ? LEAF_A : LEAF_B;
  return pave.colors[pave.at(x * 24, y * 24)];
}

/** Rooftops beyond the shops: pitched roofs, chimneys, a water tank, hazed by distance. */
function farRoofs(p: Painter, light: Light, width: number, horizon: number) {
  const haze = light.sky[2];
  const tones = ["#8a7f86", "#9a8278", "#7f8590", "#a08a7a"].map((c) => mixHex(light.lit(c, 0.2), haze, 0.3));
  const roofs = ["#6f6670", "#7a6a66", "#6a7078"].map((c) => mixHex(light.lit(c, 0.3), haze, 0.25));
  let x = -6;
  for (let i = 0; x < width; i++) {
    const w = 14 + Math.floor(noise(i, 1, 7) * 14);
    const h = 3 + Math.floor(noise(i, 2, 7) * 5);
    const r = 3 + Math.floor(noise(i, 3, 7) * 4);
    const wall = tones[i % 4];
    p.rect(wall, x, horizon - h, w, h + 3);
    p.poly(roofs[i % 3], [x - 1, horizon - h, x + w + 1, horizon - h, x + w - 3, horizon - h - r, x + 3, horizon - h - r]);
    if (noise(i, 4, 7) > 0.4) p.rect(roofs[(i + 1) % 3], x + Math.floor(w * 0.7), horizon - h - r - 3, 2, 4);
    if (noise(i, 5, 7) > 0.85) {
      // A water tank on legs.
      p.rect(roofs[0], x + 4, horizon - h - r - 4, 1, 4);
      p.rect(roofs[0], x + 8, horizon - h - r - 4, 1, 4);
      p.rect(mixHex(light.lit("#8a6a58", 0.3), haze, 0.25), x + 3, horizon - h - r - 9, 7, 5);
    }
    if (light.night > 0.4) for (let k = 0; k < 3; k++) if (noise(i, k, 9) > 0.5) p.rect("#e9c27c", x + 3 + k * 4, horizon - h + 1, 1, 1);
    x += w;
  }
}

// The window views as lit palettes: the shops across, the houses on the side street.
const VIEW = litSet([
  ["#9c9488", 0.4], // 0 far pavement
  ["#c9b48a", 0.4], // 1 bakery wall
  ["#7f9aa0", 0.4], // 2 books wall
  ["#b06a55", 0.4], // 3 florist wall
  ["#d8cdb6", 0.4], // 4 cafe wall
  ["#4a5a62", 0.1], // 5 glass
  ["#efe2c4", 0.4], // 6 trim
  ["#c65f4a", 0.5], // 7 awning red
  ["#3f6670", 0.5], // 8 awning teal
  ["#6c8a5a", 0.5], // 9 awning green
  ["#8e6a9e", 0.5], // 10 awning plum
  ["#a8634e", 0.3], // 11 house brick
  ["#e8dcc4", 0.4], // 12 sash white
  ["#5f7b55", 0.5], // 13 leaves
  ["#7d9a6a", 0.6], // 14 leaves lit
  ["#6a5a52", 0.2], // 15 roof slate
  ["#58565c", 0.3], // 16 street
  ["#c47a3e", 0.6], // 17 autumn leaves
  ["#d9a055", 0.7], // 18 autumn leaves lit
  ["#5a4a44", 0.3], // 19 bare twigs
]);
const SHOP_WALL = [1, 2, 3, 4];
const SHOP_AWNING = [7, 8, 9, 10];

function cornerView(u: number, v: number, light: Light) {
  const c = VIEW(light);
  const [, s1, s2] = light.sky;
  const night = light.night > 0.4;
  if (u < 1000) {
    // The right window: the street, then the shops across with their awnings.
    if (v < 0.08) return c[16];
    if (v < 0.13) return c[0];
    const shop = Math.floor((u + 9) / 31) & 3;
    const k = (u + 9) % 31;
    if (v > 0.88) return v > 0.95 ? s1 : s2;
    if (v > 0.84) return c[6];
    if (k < 1) return c[6];
    if (v < 0.46) {
      // Shop window and door at street level.
      if (k > 3 && k < 20 && v > 0.16 && v < 0.42) return night ? "#e9c27c" : v > 0.36 && k < 9 ? c[12] : c[5];
      if (k > 23 && k < 29 && v < 0.43) return night && v > 0.3 ? "#e9c27c" : c[15];
      return c[SHOP_WALL[shop]];
    }
    if (v < 0.56) return ((k >> 2) & 1) === 0 ? c[SHOP_AWNING[shop]] : c[6];
    // Upper floor sash windows.
    const wk = k % 10;
    if (v > 0.62 && v < 0.8 && wk > 2 && wk < 8) return night && noise(Math.floor((u + 9) / 10), 0, 3) > 0.5 ? "#e9c27c" : Math.abs(v - 0.71) < 0.015 ? c[12] : c[5];
    return c[SHOP_WALL[shop]];
  }
  // The left window: a street tree in front of the houses across the side street.
  const crown = 0.5 + Math.sin(u / 6) * 0.08;
  const trunk = Math.abs(((u - 1000) % 34) - 17) < 1.2;
  if (v < 0.06) return c[16];
  if (v > crown + 0.25 && v < 0.98) {
    const dv = v - (crown + 0.25);
    if (dv < 0.04 + noise(Math.floor(u / 3), 1, 4) * 0.05) {
      const n = noise(Math.floor(u / 2), Math.floor(v * 30), 3);
      if (light.season === "winter") {
        if (n > 0.78) return c[19];
      } else if (light.season === "autumn") return n > 0.6 ? c[18] : c[17];
      else return n > 0.6 ? c[14] : c[13];
    }
  }
  if (v > 0.86) return v > 0.94 ? s1 : s2;
  if (v > 0.8) return c[15];
  if (trunk && v < crown + 0.3) return c[15];
  // Brick house fronts with white sashes.
  const wk = (u - 1000) % 14;
  if (v > 0.24 && v < 0.44 && wk > 3 && wk < 10) return night && noise(Math.floor((u - 1000) / 14), 1, 5) > 0.4 ? "#e9c27c" : Math.abs(v - 0.34) < 0.02 ? c[12] : c[5];
  if (v > 0.54 && v < 0.74 && wk > 3 && wk < 10) return night && noise(Math.floor((u - 1000) / 14), 2, 5) > 0.5 ? "#e9c27c" : Math.abs(v - 0.64) < 0.02 ? c[12] : c[5];
  if ((wk === 3 || wk === 10) && ((v > 0.23 && v < 0.45) || (v > 0.53 && v < 0.75))) return c[12];
  return c[11];
}

/** The chalkboard over the brew counter: BOBA, MILK TEA, a doodled cup and prices. */
function chalkboard(at: number, z: number): WallItem {
  const w = 46,
    h = 26;
  return {
    wall: "right",
    at,
    z,
    draw(p, light, place) {
      wallQuad(p, place, -2, -2, w + 4, h + 4, light.lit("#6a4a3a", 0.2));
      wallQuad(p, place, -1, -1, w + 2, h + 2, light.lit("#7d5a46", 0.3));
      wallQuad(p, place, 0, 0, w, h, light.lit("#2f3b37", 0));
      // Chalk dust.
      for (let i = 0; i < 18; i++) wallDot(p, place, 2 + noise(i, 1, 3) * (w - 4), 2 + noise(i, 2, 3) * (h - 4), light.lit("#45524d", 0.1));
      const chalk = light.lit("#efe4cc", 0.3);
      wallWord(p, place, 3, h - 3, "BOBA", light.lit("#f2d58a", 0.3));
      wallWord(p, place, 3, h - 11, "MILK TEA", chalk);
      wallLine(p, place, 3, h - 18, 19, h - 18, light.lit("#e8b48a", 0.2));
      wallLine(p, place, 3, h - 21, 14, h - 21, light.lit("#a9c98c", 0.2));
      wallLine(p, place, 24, h - 18, 27, h - 18, chalk);
      wallLine(p, place, 24, h - 21, 27, h - 21, chalk);
      // A cup with pearls, in chalk.
      const cx = 36;
      wallLine(p, place, cx, h - 6, cx + 7, h - 6, chalk);
      wallLine(p, place, cx, h - 6, cx + 1, h - 20, chalk);
      wallLine(p, place, cx + 7, h - 6, cx + 6, h - 20, chalk);
      wallLine(p, place, cx + 1, h - 20, cx + 6, h - 20, chalk);
      wallLine(p, place, cx + 5, h - 6, cx + 7, h - 2, light.lit("#e8b48a", 0.2));
      for (const [a, b] of [[2, 17], [4, 18], [3, 16], [5, 16]]) wallDot(p, place, cx + a, h - b, light.lit("#6a4a3a", 0.4));
    },
  };
}

/** A wooden shelf on two brackets with tins and caddies. */
function tinShelf(wall: "left" | "right", at: number, z: number, w: number, seed: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const tinColors = ["#b8573f", "#5f7a5a", "#d8a05c", "#8e6a9e", "#3f6670", "#c9b48a"];
      let a = 3;
      for (let i = 0; a < w - 4; i++) {
        const tall = noise(i, seed, 2) > 0.5;
        const tw = tall ? 4 : 5;
        const th = tall ? 7 : 5;
        const col = tinColors[Math.floor(noise(i, seed, 3) * tinColors.length)];
        wallQuad(p, place, a, 0, tw, th, light.lit(INK, 0));
        wallQuad(p, place, a + 1, 0, tw - 2, th - 1, light.lit(col, 0.35));
        wallQuad(p, place, a + 1, th - 3, tw - 2, 1, light.lit(mixHex(col, CREAM, 0.45), 0.4));
        wallQuad(p, place, a, th - 1, tw, 1, light.lit(mixHex(col, INK, 0.3), 0.2));
        a += tw + 1;
      }
      wallQuad(p, place, 0, -2, w, 2, light.lit(WOOD, 0.35));
      wallLine(p, place, 0, -3, w, -3, light.lit(mixHex(WOOD, INK, 0.45), 0));
      wallQuad(p, place, 3, -6, 1, 4, light.lit(mixHex(WOOD, INK, 0.3), 0));
      wallQuad(p, place, w - 4, -6, 1, 4, light.lit(mixHex(WOOD, INK, 0.3), 0));
    },
  };
}

/** An OPEN sign hung in the shop window: red tubes, lit after dark. */
function openSign(at: number, z: number): WallItem {
  return {
    wall: "right",
    at,
    z,
    draw(p, light, place) {
      const on = light.night > 0.15;
      wallLine(p, place, 4, 14, 2, 22, light.lit("#3a3035", 0));
      wallLine(p, place, 18, 14, 20, 22, light.lit("#3a3035", 0));
      wallQuad(p, place, 0, 0, 23, 11, light.lit("#2e2a2f", 0));
      if (on) p.alpha(0.25 * light.night, () => wallQuad(p, place, -2, -2, 27, 15, "#ff8a6a"));
      wallWord(p, place, 4, 8, "OPEN", on ? "#ff9a7a" : light.lit("#c65f4a", 0.3));
    },
  };
}

/** A framed print of a teapot. */
function teapotPrint(wall: "left" | "right", at: number, z: number): WallItem {
  return framed(wall, at, z, 14, 16, (p, light, x, y) => {
    const s = SPRITES.teapot;
    p.sprite(s.grid, litPalette({ ...s.palette, L: "#a9c98c", B: "#6f9a5a", D: "#4c6b40" }, light, 0.3), x - 4, y - 3);
    p.rect(light.lit("#c65f4a", 0.3), x - 4, y + 5, 9, 1);
  }, "#6a4a3a");
}

/**
 * The shop from across the pavement: two storeys of brick, sash windows with
 * window boxes above; a sage shopfront below with the name in gold on the
 * fascia, a striped awning, the big window with the drink in it and the OPEN
 * sign, the door on the right, an A-board and a hanging bracket sign.
 */
function cornerFront(p: Painter, light: Light, box: FrontBox) {
  const L = (hex: string, f = 0.5, g = 0) => light.lit(hex, f, g);
  const fw = frontFace(light);
  const { x, w, ground: G, open } = box;
  const top = box.y;
  const night = light.night > 0.4;
  const GREEN = "#4f6b55";
  // Brick front, two storeys, with a stone cornice and dentils.
  brickFront(p, light, x, top, w, G - top, BRICK, "#a65a44", "#c9a48a", 4);
  p.rect(L(INK, 0), x - 4, top - 6, w + 8, 1);
  p.rect(L("#e8dcc4", 0.8), x - 4, top - 5, w + 8, 4);
  p.rect(L("#c9bfa8", 0.4), x - 3, top - 1, w + 6, 2);
  for (let i = 0; i < w; i += 4) p.rect(L("#b8ad98", 0.3), x + i, top + 1, 2, 2);
  // Upper floor: three sashes, lintels and sills, flowers in two window boxes.
  const upTop = top + 7,
    upH = 20;
  for (let k = 0; k < 3; k++) {
    const wx = x + Math.round(w * (0.2 + k * 0.3)) - 9;
    p.rect(L("#d8cdb6", 0.7), wx - 3, upTop - 5, 24, 3);
    p.rect(L(INK, 0), wx - 1, upTop - 1, 20, upH + 2);
    p.rect(L("#ece3cf", 0.7), wx, upTop, 18, upH);
    glassFront(p, light, wx + 2, upTop + 2, 14, upH - 4, night && noise(k, 2, 7) < 0.7);
    p.rect(L("#ece3cf", 0.7), wx, upTop + Math.round(upH / 2), 18, 2);
    p.rect(L("#d8cdb6", 0.7), wx - 3, upTop + upH + 1, 24, 2);
    if (k !== 1) {
      p.rect(L(GREEN, fw), wx - 1, upTop + upH + 3, 20, 4);
      for (let i = 0; i < 9; i++) p.rect(L(["#c65f4a", "#f2d58a", "#e48a9a"][i % 3], 0.7), wx + i * 2, upTop + upH + 1 - (i % 2), 2, 2);
      p.rect(L("#6f8a5c", 0.6), wx, upTop + upH + 2, 18, 1);
    }
  }
  // The shopfront: sage pilasters, a green fascia with the name in gold.
  const sf = top + 38;
  p.rect(L(INK, 0), x + 1, sf - 1, w - 2, G - sf + 1);
  p.rect(L(SAGE, fw), x + 2, sf, w - 4, G - sf);
  p.rect(L("#6f8a6c", fw), x + 2, sf, 6, G - sf);
  p.rect(L("#6f8a6c", fw), x + w - 8, sf, 6, G - sf);
  p.rect(L("#e8dcc4", 0.8), x, sf - 2, 10, 3);
  p.rect(L("#e8dcc4", 0.8), x + w - 10, sf - 2, 10, 3);
  p.rect(L(GREEN, fw), x + 8, sf + 1, w - 16, 13);
  const name = box.name.toUpperCase();
  const gold = L("#e8c66a", 0.7, 0.6);
  if (bigWidth(name) <= w - 24) bigWord(p, name, gold, Math.round(x + (w - bigWidth(name)) / 2), sf + 4);
  else word(p, name, gold, Math.round(x + (w - wordWidth(name)) / 2), sf + 5);
  p.rect(L(mixHex(GREEN, INK, 0.4), 0.2), x + 8, sf + 14, w - 16, 1);
  // The awning over window and door.
  awningFront(p, light, x + 8, sf + 16, w - 16, "#b9614c", "#efe2c4", 8);
  // The big window on the left, on a tiled stall riser.
  const wx0 = x + 11,
    ww = Math.round(w * 0.56),
    wy0 = sf + 28,
    wh = G - 12 - wy0;
  p.rect(L(INK, 0), wx0 - 2, wy0 - 2, ww + 4, wh + 4);
  p.rect(L("#e8dcc4", 0.7), wx0 - 1, wy0 - 1, ww + 2, wh + 2);
  glassFront(p, light, wx0, wy0, ww, wh, open);
  if (!open) for (let yy = wy0; yy < wy0 + Math.round(wh * 0.6); yy += 2) p.rect(L("#d8c8a8", 0.4), wx0, yy, ww, 1);
  for (const t of [0.33, 0.66]) p.rect(L("#e8dcc4", 0.7), wx0 + Math.round(ww * t), wy0, 1, wh);
  p.rect(L("#e8dcc4", 0.7), wx0, wy0 + 8, ww, 1);
  p.rect(L("#d8cdb6", 0.8), wx0 - 3, G - 13, ww + 6, 2);
  if (open && box.display) displayCup(p, light, box.display, wx0 + Math.round(ww * 0.5), G - 13);
  // The OPEN sign in the window: red tubes that light after dark.
  if (open) {
    const ox = wx0 + ww - 24,
      oy = wy0 + 11;
    const on = light.night > 0.15;
    p.rect(L("#3a3035", 0), ox + 4, wy0 + 8, 1, 3);
    p.rect(L("#3a3035", 0), ox + 16, wy0 + 8, 1, 3);
    if (on) p.alpha(0.3 * light.night, () => p.rect("#ff8a6a", ox - 2, oy - 2, 25, 11));
    p.rect(L("#2e2a2f", 0.2), ox, oy, 21, 7);
    word(p, "OPEN", on ? "#ffb09a" : L("#c65f4a", 0.6), ox + 3, oy + 1);
  }
  p.rect(L("#6f8a6c", fw), wx0 - 3, G - 11, ww + 6, 11);
  for (let i = 0; i < ww + 6; i += 6) p.rect(L(mixHex(SAGE, CREAM, 0.3), fw), wx0 - 3 + i, G - 10, 1, 9);
  p.rect(L(mixHex(SAGE, CREAM, 0.3), fw), wx0 - 3, G - 6, ww + 6, 1);
  // The door, with a fanlight and the street number.
  const dx = wx0 + ww + 8,
    dw = Math.min(24, x + w - 12 - dx),
    dy = sf + 30;
  p.rect(L(INK, 0), dx - 2, dy - 9, dw + 4, G - dy + 9);
  p.rect(L("#e8dcc4", 0.7), dx - 1, dy - 8, dw + 2, 7);
  glassFront(p, light, dx + 1, dy - 7, dw - 2, 5, open);
  word(p, "12", L(INK, 0.2), dx + Math.round(dw / 2) - 3, dy - 7);
  p.rect(L(GREEN, fw), dx, dy, dw, G - dy);
  glassFront(p, light, dx + 4, dy + 4, dw - 8, Math.round((G - dy) * 0.45), open);
  p.rect(L(mixHex(GREEN, CREAM, 0.2), fw), dx + 4, dy + Math.round((G - dy) * 0.62), dw - 8, 6);
  p.rect(L("#d6a367", 0.8), dx + dw - 5, dy + Math.round((G - dy) * 0.55), 2, 2);
  p.rect(L("#d6a367", 0.8), dx + Math.round(dw / 2) - 3, dy + Math.round((G - dy) * 0.62) + 2, 6, 1);
  p.rect(L("#b9b2a4", 0.7), dx - 3, G - 2, dw + 6, 2);
  // A bracket sign with a cup, hung off the corner above the awning.
  const bx = x + w + 2,
    by = sf - 10;
  p.rect(L("#3e3a3f", 0), x + w - 2, by, 14, 1);
  p.rect(L("#3e3a3f", 0), x + w - 2, by, 1, 5);
  p.rect(L(INK, 0), bx + 1, by + 2, 11, 12);
  p.rect(L("#e8dcc4", 0.7), bx + 2, by + 3, 9, 10);
  p.rect(L("#b9614c", 0.6), bx + 4, by + 5, 5, 6);
  p.rect(L(INK, 0.2), bx + 5, by + 9, 1, 1);
  p.rect(L(INK, 0.2), bx + 7, by + 8, 1, 1);
  p.rect(L("#3e3a3f", 0), bx + 7, by + 3, 1, 2);
  // An A-board on the pavement by the window.
  if (open) {
    const ax = x + 2;
    p.poly(L("#7a5a45", 0.6), [ax - 9, G + 2, ax - 6, G - 20, ax + 6, G - 20, ax + 9, G + 2]);
    p.poly(L("#2f3a36", 0.2), [ax - 7, G - 1, ax - 5, G - 18, ax + 5, G - 18, ax + 7, G - 1]);
    word(p, "TEA", L("#f1e6cf", 0.4), ax - 5, G - 16);
    p.rect(L("#e8b48a", 0.4), ax - 4, G - 9, 7, 1);
    p.rect(L("#a9c98c", 0.4), ax - 4, G - 6, 5, 1);
  }
}

export function cornerVenue(o: VenueOptions): Venue {
  const { cols, rows } = o;
  const shops = facadeRow(
    "out:shops",
    -3,
    A0 - 2.6,
    "y",
    2,
    [
      { w: 3.2, h: 46, wall: "#c9b48a", trim: "#efe2c4", awning: ["#c65f4a", "#efe2c4"], sign: "BAKERY" },
      { w: 2.6, h: 54, wall: "#7f9aa0", trim: "#e8dcc4", awning: ["#3f6670", "#e8dcc4"], sign: "BOOKS" },
      { w: 3.2, h: 44, wall: "#b06a55", trim: "#e9dcc2", awning: ["#6c8a5a", "#e9dcc2"], sign: "FLOWERS" },
      { w: 2.8, h: 50, wall: "#d8cdb6", trim: "#8a6a58", awning: ["#8e6a9e", "#efe2c4"], sign: "DELI" },
      { w: 3.4, h: 46, wall: "#9a8a6e", trim: "#efe2c4", awning: ["#c9a24a", "#efe2c4"], sign: "BIKES" },
      { w: 3, h: 52, wall: "#c9b48a", trim: "#efe2c4", awning: ["#3f6670", "#efe2c4"], sign: "BARBER" },
    ],
    3,
  );
  const houses = facadeRow(
    "out:houses",
    B0 - 2.4,
    -4,
    "x",
    2,
    [
      { w: 2.2, h: 36, wall: "#a8634e", trim: "#e8dcc4", roof: "#6a5f66", kind: "house", door: "#3f6670" },
      { w: 2.2, h: 38, wall: "#b9876a", trim: "#e8dcc4", roof: "#5f5a66", kind: "house", door: "#c65f4a" },
      { w: 2.2, h: 36, wall: "#9a5a48", trim: "#e8dcc4", roof: "#6a5f66", kind: "house", door: "#6c8a5a" },
      { w: 2.2, h: 40, wall: "#c4a07a", trim: "#e8dcc4", roof: "#5f5a66", kind: "house", door: "#8e6a9e" },
      { w: 2.2, h: 36, wall: "#a8634e", trim: "#e8dcc4", roof: "#6a5f66", kind: "house", door: "#c9a24a" },
      { w: 2.2, h: 38, wall: "#b9876a", trim: "#e8dcc4", roof: "#5f5a66", kind: "house", door: "#3f6670" },
      { w: 2.2, h: 36, wall: "#9a5a48", trim: "#e8dcc4", roof: "#6a5f66", kind: "house", door: "#c65f4a" },
    ],
    5,
  );
  return {
    id: "corner",
    cols,
    rows,
    floor: checker("#d6c4a4", "#987260", "#7a5c4c", 12),
    wall: brick(BRICK, "#a65a44", "#cdb59c", 8, 4),
    wainscot: { surface: tiles(SAGE, "#93ac8f", "#c8cdb8", 6, 3, true), height: 24, rail: "#5f7a5f" },
    cap: "#d4c3a8",
    slab: "#9a8a7c",
    windows: [
      { wall: "right", at: 5.1, width: 2.7, sill: 16, top: 68, bars: 2, transom: 14, frame: FRAME },
      { wall: "left", at: 4.3, width: 1.8, sill: 20, top: 62, bars: 1, transom: 12, frame: FRAME },
    ],
    doors: [],
    lamps: [
      { kind: "pendant", x: 1.5, y: 1.5, z: 42, color: "#4f6b55", reach: 2.4 },
      { kind: "pendant", x: 4.5, y: 3.5, z: 40, color: "#4f6b55", reach: 2.6 },
      { kind: "pendant", x: 6.8, y: 1.6, z: 40, color: "#4f6b55", reach: 2.4 },
    ],
    wallItems: [
      chalkboard(0.35, 36),
      tinShelf("right", 2.55, 46, 32, 1),
      tinShelf("right", 2.55, 34, 32, 2),
      clock("right", 4.5, 62, o.hour),
      openSign(5.4, 38),
      tinShelf("left", 0.3, 58, 32, 3),
      tinShelf("left", 0.3, 44, 32, 4),
      teapotPrint("left", 2.15, 38),
      rail("left", 2.95, 40, 26, WOOD, ["#e6d8c0", "#86a084", "#c98a6a", "#e6d8c0"]),
      shelf("left", 2.95, 56, 26, ["jar", "bottle", "jar"], WOOD),
    ],
    props: [
      plantProp("prop:monstera", 0, rows - 1, "monstera", "#c47c5b", 0.4, 2),
      ...frontWallProps("prop:front", cols, rows, { height: 14, kind: "brick", color: BRICK, line: "#c9a48a", cap: "#d4c3a8", base: [SAGE, 4], gapsRight: [rows - 1], post: "#a65a44" }),
    ],
    floorItems: [matItem(cols - 0.94, rows - 0.9, 0.86, 0.8, "#8a6a4a", "#5e4636")],
    counter: { top: "#c99a6a", front: "#7f9a7e", side: "#6a8469", trim: WOOD, panel: "drawers", height: 15 },
    outside: {
      ground: cornerGround,
      far: farRoofs,
      view: cornerView,
      props: [
        shops,
        houses,
        seasonTreeProp("out:tree1", T1X, T1Y, "#6f8f5c", 3, 64),
        seasonTreeProp("out:tree2", T2X, T2Y, "#5f8455", 7, 62),
        lampPostProp("out:lamp1", -0.9, 8.0),
        lampPostProp("out:lamp2", cols + 0.7, -0.4),
        { ...benchProp("out:bench", 4.1, rows + 0.75, "#8a6048", true), shadow: "none" as const },
        bikeRackProp("out:bikes", 1.4, rows + 0.7, true, ["#3f6670", "", "#c65f4a"]),
        { ...aFrameProp("out:aframe", cols + 0.5, rows - 3.0, "TEA"), shadow: "none" as const },
      ],
    },
    entry: [cols + 1.4, rows - 0.5],
    queue: [
      [cols - 0.6, 1.6],
      [cols - 0.6, 2.7],
      [cols - 0.6, 3.8],
      [cols - 0.6, 4.9],
    ],
    pickup: [cols - 1.6, 2.5],
    indoorSun: 0.4,
    facade: {
      wall: brick(BRICK, "#a65a44", "#cdb59c", 8, 4),
      trim: "#e8dcc4",
      sign: { board: "#4f6b55", ink: "#e8c66a" },
      awning: ["#b9614c", "#efe2c4"],
      door: "#4f6b55",
      upper: true,
      neighbours: "shops",
      queueAt: 0.78,
      paint: cornerFront,
    },
  };
}
