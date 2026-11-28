/**
 * Harbor Tea House: a shiplap tea room at the end of a pier. Teal boards
 * over white beadboard, portholes ringed in brass and one wide window over
 * the open water, brass lanterns, a weathered plank floor, a life ring and
 * a ferry timetable. Outside the pier deck runs round the room on piles,
 * a gangway leads off toward the shore past a moored fishing boat, the
 * island ferry lies alongside the pier's end, and a lighthouse stands on
 * the far headland across the bay.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, project, faceLight } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { planks, shiplap, boards } from "../surfaces.ts";
import type { Venue, PropSpec, WallItem, WindowSpec, WallSide, FrontBox } from "../types.ts";
import { cafeTable, seating } from "../seating.ts";
import { displayCup } from "../front.ts";
import { INK } from "../props.ts";
import { word, bigWord, bigWidth } from "../font.ts";
import type { VenueOptions } from "./index.ts";
import { portholeRim, wallBox, wallWord, wallRun, wallArc, wallAt, litCache, roomGround, hash, groundPool, weatherHaze, floorShader, CREAM } from "./_station-kit.ts";

const TEAL = "#4e7d7c";
const TEAL_D = "#3b6261";
const WHITE = "#ebe5d4";
const BRASS = "#b89048";
const ROPE = "#c7a46e";
const RED = "#b8473b";
const NAVY = "#34506a";
const HULL = "#e9e4d6";

const lit = (light: Light, hex: string, face = 0.3, glow = 0) => light.lit(hex, face, glow);

// ---------------------------------------------------------------- outside: pier and water

/** The pier deck's extent (tiles): round the room, out to the ferry, and a gangway toward shore. */
const PIER_X0 = -3.9;
const PIER_PAD = 1.4;
const WALK: [number, number] = [4.4, 8.4];
const FASCIA = 0.45;

const G = ["#8e897f", "#97928a", "#69655d", "#827d74", "#4c7b87", "#558793", "#3f6b78", "#86b2b2", "#5d5148", "#40372f", "#2f2a28", "#7f9c9a"];
const [D0, D1, DSEAM, DGRAIN, W0, W1, WD, WL, FAS, FAS_D, PILE, FOAM] = G;
const SNOW = ["#e9edec", "#dde3e5", "#c3cacc"];

function harborGround(cols: number, rows: number) {
  const xr = cols + PIER_PAD;
  const yr = rows + PIER_PAD;
  return (x: number, y: number, light?: Light) => {
    const main = x > PIER_X0 && x < xr && y > -PIER_PAD && y < yr;
    const walk = x > WALK[0] && x < WALK[1] && y >= yr - 0.01;
    if (main || walk) {
      // Boards run along x on the deck and along y down the gangway.
      const along = walk && !main ? y * 24 : x * 24;
      const across = walk && !main ? x * 24 : y * 24;
      const row = Math.floor(across / 8);
      // On a snow day the deck lies white, its seams faint under it; the water never takes it.
      const snow = light?.weather === "snow";
      if (across - row * 8 < 1) return snow ? (row & 1 ? SNOW[1] : SNOW[2]) : DSEAM;
      if (snow) return SNOW[hash(Math.floor(along / 20), row, 3) > 0.7 ? 1 : 0];
      const off = noise(row, 3, 11) * 56;
      const a = along + off;
      if (a - Math.floor(a / 56) * 56 < 1) return DSEAM;
      if (hash(Math.floor(a / 3), row, 5) > 0.94) return DGRAIN;
      return hash(Math.floor(a / 56), row, 7) > 0.6 ? D1 : D0;
    }
    // The deck's edge beam where it faces us, the piles under it, foam where they meet the water.
    const belowY = y - yr;
    const belowX = x - xr;
    const belowW = x - WALK[1];
    const faceY = belowY >= 0 && belowY < FASCIA && x > PIER_X0 && x < xr && !(x > WALK[0] && x < WALK[1]);
    const faceX = belowX >= 0 && belowX < FASCIA && y > -PIER_PAD && y < yr + FASCIA;
    const faceW = belowW >= 0 && belowW < FASCIA && y > yr;
    if (faceY || faceX || faceW) {
      const t = faceY ? belowY : faceX ? belowX : belowW;
      const run = faceY ? x : y;
      if (run - Math.floor(run * 0.66) / 0.66 < 0.14) return PILE;
      return t < 0.14 ? FAS : FAS_D;
    }
    if ((belowY >= FASCIA && belowY < FASCIA + 0.3 && x > PIER_X0 && x < xr) || (belowX >= FASCIA && belowX < FASCIA + 0.3 && y > -PIER_PAD && y < yr + 0.6) || (belowW >= FASCIA && belowW < FASCIA + 0.3 && y > yr)) {
      const run = belowY >= 0 && belowY < 1 ? x : y;
      return run - Math.floor(run * 0.66) / 0.66 < 0.12 ? PILE : hash(Math.floor(x * 30), Math.floor(y * 30), 2) > 0.7 ? FOAM : WD;
    }
    // Open water: wavelets laid along the screen's rows, darker in their troughs.
    const sx = (x - y) * 24;
    const sy = (x + y) * 12;
    const row = Math.floor(sy / 3);
    const k = hash(row, Math.floor((sx + row * 7) / 9), 5);
    if (k > 0.93) return WL;
    if (k < 0.1) return WD;
    return hash(Math.floor(sx / 34), Math.floor(sy / 10), 2) > 0.5 ? W0 : W1;
  };
}

/** The far band: open sea to a headland with its lighthouse, the island ferry crossing, a sail. */
function seaFar(v: Venue) {
  return (p: Painter, light: Light, width: number, horizon: number) => {
    const haze = mixHex(light.sky[2], "#a9c0c0", 0.3);
    p.rect(haze, 0, horizon - 1, width, 1);
    // The headland on the right, a lighthouse on its point.
    const hill = lit(light, "#6f8c78", 0.3);
    const hillD = lit(light, "#5a7462", 0.1);
    const hx = Math.round(width * 0.72);
    for (let x = hx - 70; x < width; x++) {
      const t = (x - (hx - 70)) / 70;
      const h = Math.round(Math.min(1, t) * 9 + Math.sin(x / 9) * 1.5 + (x > hx ? 2 : 0));
      if (h > 0) p.rect(x > hx + 30 ? hillD : hill, x, horizon - h, 1, h);
    }
    const lx = hx - 50;
    p.rect(lit(light, "#efe8d8", 0.5), lx, horizon - 14, 3, 10);
    p.rect(lit(light, RED, 0.4), lx, horizon - 10, 3, 2);
    p.rect(lit(light, RED, 0.4), lx - 1, horizon - 16, 5, 2);
    p.rect(lit(light, INK, 0), lx - 1, horizon - 17, 5, 1);
    if (light.night > 0.3) {
      p.rect("#fff0b8", lx, horizon - 15, 3, 1);
      p.alpha(0.3 * light.night, () => p.poly("#ffe8a8", [lx + 1, horizon - 15, lx - 40, horizon - 19, lx - 40, horizon - 12]));
    }
    // The island ferry on the horizon.
    const fx = Math.round(width * 0.22);
    p.rect(lit(light, HULL, 0.5), fx, horizon - 4, 26, 3);
    p.rect(lit(light, NAVY, 0.3), fx, horizon - 2, 26, 1);
    p.rect(lit(light, HULL, 0.5), fx + 5, horizon - 7, 15, 3);
    p.rect(lit(light, RED, 0.4), fx + 13, horizon - 10, 3, 3);
    p.rect(lit(light, INK, 0), fx + 13, horizon - 11, 3, 1);
    for (let k = 0; k < 5; k++) p.rect(light.night > 0.4 ? "#f0c87a" : lit(light, "#3f5560", 0.2), fx + 6 + k * 3, horizon - 6, 1, 1);
    // A sail.
    const sx = Math.round(width * 0.48);
    p.poly(lit(light, "#f2ecdc", 0.6), [sx, horizon - 10, sx, horizon - 2, sx + 6, horizon - 2]);
    p.rect(lit(light, "#8a5a3c", 0.3), sx - 2, horizon - 2, 9, 1);
    const g = roomGround(v, width, horizon);
    weatherHaze(p, light, width, horizon, g ? 110 : 30);
    if (!g) return;
    // Sun glitter on the water, thinning in rain and fog; a lamp's path on it after dark.
    const glints = light.weather === "rain" || light.weather === "fog" ? 0.15 : 1;
    const n = Math.round(260 * Math.min(1, light.sun + 0.2) * glints);
    const glint = mixHex(lit(light, "#f4f1e2", 1), "#ffffff", 0.2 * light.sun);
    const H = 400;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(hash(i, 1, 41) * width);
      const y = horizon + 2 + Math.floor(hash(i, 2, 41) ** 1.6 * H);
      if (light.night > 0.6 && hash(i, 3, 41) > 0.3) continue;
      const q = { x: (x - g.ox) / g.hw, y: (y - g.oy) / g.hh };
      const tx = (q.x + q.y) / 2,
        ty = (q.y - q.x) / 2;
      const c = v.outside.ground(tx, ty);
      if (c !== W0 && c !== W1) continue;
      p.rect(glint, x, y, 1 + (i % 3 === 0 ? 2 : 1), 1);
    }
    // Gulls wheeling over the water.
    if (light.night < 0.5 && light.weather !== "rain")
      for (const [fx, gy, k] of [[0.7, 46, 0], [0.8, 70, 1], [0.9, 36, 1], [0.62, 88, 0]] as [number, number, number][]) {
        const c = { x: Math.round(width * fx), y: gy };
        const wing = lit(light, "#f4f0e4", 0.8);
        const tip = lit(light, "#6a6a70", 0.3);
        p.rect(wing, c.x - 3, c.y - 1 + k, 3, 1);
        p.rect(wing, c.x + 1, c.y - 1 + k, 3, 1);
        p.rect(wing, c.x, c.y, 1, 1);
        p.rect(tip, c.x - 4, c.y + k, 1, 1);
        p.rect(tip, c.x + 4, c.y + k, 1, 1);
      }
    if (light.night > 0.15) {
      // Lamp pools on the deck, and each lamp's broken reflection on the water beyond the edge.
      const lamps: [number, number, number, number][] = [
        [4.1, v.rows + 0.9, 4.1, v.rows + PIER_PAD + 1.4],
        [v.cols + 1.0, 2.1, v.cols + PIER_PAD + 1.3, 2.4],
      ];
      for (const [lx, ly, wx, wy] of lamps) {
        groundPool(p, g, v, light, lx, ly, 2.2, light.night * 1.3);
        const c = project(g, wx, wy);
        for (let k = 0; k < 8; k++) {
          const w = Math.max(1, 5 - Math.abs(k - 3));
          const jitter = ((k * 5) % 7) - 3;
          p.rect(k % 2 ? "#e8b870" : "#ffd88a", c.x - w + jitter, c.y - 6 + k * 3, w * 2, 1);
        }
      }
    }
  };
}

/** Window views: open water to the headland through the right wall, the ferry's white flank through the left. */
const VIEW = litCache([
  ["#558793", 0.6, 0], // 0 sea
  ["#4b7c88", 0.4, 0], // 1 sea dark
  ["#86b2b2", 0.8, 0], // 2 sea light
  ["#6f8c78", 0.5, 0], // 3 headland
  ["#5a7462", 0.3, 0], // 4 headland shade
  ["#efe8d8", 0.7, 0], // 5 lighthouse
  [RED, 0.5, 0], // 6 red
  [HULL, 0.5, 0], // 7 ferry hull
  [NAVY, 0.4, 0], // 8 ferry band
  ["#3f5560", 0.2, 0], // 9 porthole glass
  ["#f0c87a", 0.3, 1], // 10 lit porthole
  ["#2f2a2c", 0.1, 0], // 11 gull / ink
  ["#c9c3b4", 0.4, 0], // 12 hull shade
]);
const WAVE = new Uint8Array(2048 * 4);
const HEAD = new Float32Array(2048);
for (let u = 0; u < 2048; u++) {
  for (let r = 0; r < 4; r++) WAVE[u * 4 + r] = noise(Math.floor(u / (6 + r * 3)), r, 51) > 0.78 ? 1 : 0;
  HEAD[u] = Math.max(0, Math.sin(((u % 300) - 150) / 50) * 0.1 + 0.03);
}

function harborView(u: number, v: number, light: Light, wall: WallSide): string {
  const c = VIEW(light);
  const [s0, s1, s2] = light.sky;
  const iu = Math.floor(u) & 2047;
  if (wall === "left") {
    // Alongside the ferry: its white flank, a navy band and lit portholes, water at the foot.
    if (v < 0.14) return WAVE[iu * 4 + 1] ? c[2] : c[1];
    if (v < 0.2) return c[8];
    if (v > 0.86) return v > 0.93 ? s1 : c[12];
    const pu = iu % 22;
    const pv = (v - 0.52) * 30;
    if ((pu - 11) * (pu - 11) + pv * pv < 22) return light.night > 0.4 ? c[10] : c[9];
    return v < 0.3 ? c[12] : c[7];
  }
  const horizon = 0.42;
  if (v < horizon) {
    const row = Math.min(3, Math.floor((horizon - v) * 10));
    if (WAVE[iu * 4 + row] && light.weather !== "fog") return c[2];
    return v < 0.16 ? c[1] : c[0];
  }
  // The headland with its lighthouse, then sky with a gull or two.
  const local = iu % 300;
  const h = HEAD[iu];
  if (v < horizon + h) return local > 200 ? c[4] : c[3];
  if (local > 168 && local < 173 && v < horizon + h + 0.24) {
    if (v > horizon + h + 0.18) return c[6];
    return v > horizon + h + 0.1 && v < horizon + h + 0.13 ? c[6] : c[5];
  }
  if (light.night > 0.4 && local > 165 && local < 176 && Math.abs(v - (horizon + h + 0.2)) < 0.015) return "#fff0b8";
  const gull = (iu % 97) - 40;
  if (gull >= 0 && gull < 5 && Math.abs(v - 0.78 - (gull === 2 ? 0.02 : 0)) < 0.015 && gull !== 2) return c[11];
  return v > 0.85 ? s0 : v > 0.62 ? s1 : s2;
}

// ---------------------------------------------------------------- walls

/** A red-and-white life ring on a hook, rope looped round it. */
function lifeRing(wall: WallSide, at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const c = wallAt(place, 8, 9);
      p.rect(lit(light, INK, 0), c.x, c.y - 12, 1, 3);
      p.oval(lit(light, INK, 0), c.x, c.y, 9, 9);
      for (let k = 0; k < 4; k++)
        for (let a = 0; a < 16; a++) {
          const t = ((k * 16 + a) / 64) * Math.PI * 2;
          for (const r of [6, 7, 8]) p.rect(lit(light, k % 2 ? RED : "#f1ebdc", 0.4), c.x + Math.round(Math.cos(t) * r), c.y + Math.round(Math.sin(t) * r), 1, 1);
        }
      p.oval(lit(light, mixHex(TEAL, INK, 0.2), 0.1), c.x, c.y, 4, 4);
      p.oval(lit(light, INK, 0), c.x, c.y, 4, 4);
      p.oval(lit(light, TEAL, 0.1), c.x, c.y, 3, 3);
      for (const t of [0.6, 2.2, 3.8, 5.4]) {
        const x = c.x + Math.round(Math.cos(t) * 8);
        const y = c.y + Math.round(Math.sin(t) * 8);
        p.rect(lit(light, ROPE, 0.4), x - 1, y - 1, 2, 3);
      }
    },
  };
}

/** The ferry timetable: a navy board, sailings after the shop's hour. */
const PORTS = ["ISLAND", "NORTH PT", "THE LIGHT", "OLD QUAY", "BAYSIDE"];
function ferryBoard(wall: WallSide, at: number, z: number, hour: () => number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const BW = 58,
        BH = 30;
      wallBox(p, place, -2, -2, BW + 4, BH + 4, lit(light, WHITE, 0.3));
      wallBox(p, place, -1, -1, BW + 2, BH + 2, lit(light, INK, 0));
      wallBox(p, place, 0, 0, BW, BH, lit(light, NAVY, 0.2));
      wallWord(p, place, 4, BH - 2, "FERRY", lit(light, "#f1ebdc", 0.5, 0.6));
      // A little ferry by the title.
      const f = wallAt(place, 34, BH - 3);
      p.rect(lit(light, HULL, 0.5), f.x, f.y + 2, 10, 2);
      p.rect(lit(light, HULL, 0.5), f.x + 2, f.y, 5, 2);
      p.rect(lit(light, RED, 0.5), f.x + 5, f.y - 2, 2, 2);
      const h = hour();
      let t = Math.ceil(h * 2) / 2;
      for (let i = 0; i < 3; i++) {
        t += 0.5 + (i % 2) * 0.5;
        const text = `${String(Math.floor(t) % 24).padStart(2, "0")}${(t % 1) * 60 ? "30" : "00"} ${PORTS[(Math.floor(h) + i * 2) % PORTS.length]}`;
        wallWord(p, place, 3, BH - 10 - i * 7, text, lit(light, i === 0 ? "#f2d58a" : "#cfe0e0", 0.5, 0.6));
      }
    },
  };
}

/** A coil of rope hung on a peg. */
function ropeCoil(wall: WallSide, at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const c = wallAt(place, 7, 8);
      p.rect(lit(light, "#6a4c3c", 0.2), c.x - 1, c.y - 10, 3, 2);
      for (let r = 7; r >= 3; r--) {
        p.oval(lit(light, mixHex(ROPE, INK, 0.45), 0.1), c.x, c.y + 1, r, r + 1);
        p.oval(lit(light, r % 2 ? ROPE : mixHex(ROPE, CREAM, 0.25), 0.4), c.x, c.y, r - 1, r);
      }
      p.oval(lit(light, TEAL_D, 0), c.x, c.y, 2, 3);
      p.rect(lit(light, ROPE, 0.4), c.x + 4, c.y + 6, 1, 6);
      p.rect(lit(light, ROPE, 0.4), c.x + 5, c.y + 11, 1, 3);
    },
  };
}

/** A brass ship's lantern on a bracket (its glow is a wall lamp). */
function wallLantern(wall: WallSide, at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const on = light.night > 0.15;
      const c = wallAt(place, 0, 0);
      p.rect(lit(light, mixHex(BRASS, INK, 0.3), 0.2), c.x - 1, c.y - 2, 3, 4);
      p.rect(lit(light, INK, 0), c.x - 4, c.y - 13, 9, 12);
      p.rect(lit(light, BRASS, 0.4), c.x - 3, c.y - 12, 7, 2);
      p.rect(on ? "#ffd98a" : lit(light, "#d8e0d8", 0.4), c.x - 3, c.y - 10, 7, 6);
      p.rect(lit(light, BRASS, 0.4), c.x - 3, c.y - 4, 7, 2);
      p.rect(lit(light, BRASS, 0.4), c.x - 1, c.y - 10, 1, 6);
      p.rect(lit(light, INK, 0), c.x - 2, c.y - 16, 5, 3);
      p.rect(lit(light, BRASS, 0.5), c.x, c.y - 18, 1, 2);
    },
  };
}

/** Nautical signal flags strung along the wall's top. */
function signalFlags(wall: WallSide, length: number, z: number): WallItem {
  return {
    wall,
    at: 0.2,
    z,
    draw(p, light, place) {
      const len = length * 24 - 10;
      const sets = [
        [RED, "#f1ebdc"],
        ["#e6c04a", NAVY],
        [NAVY, "#f1ebdc"],
        ["#f1ebdc", RED],
        ["#e6c04a", RED],
        [NAVY, "#e6c04a"],
      ];
      let prev = wallAt(place, 0, 0);
      const n = Math.floor(len / 9);
      for (let i = 0; i <= n; i++) {
        const a = i * 9;
        const sag = Math.sin((i / n) * Math.PI * 3) * 2 - 2;
        const at = wallAt(place, a, sag);
        p.line(lit(light, "#3a2c2c", 0), prev.x, prev.y, at.x, at.y);
        prev = at;
        if (i === n) break;
        const [c1, c2] = sets[i % sets.length];
        const top = wallAt(place, a + 2, sag - 1);
        for (let k = 0; k < 6; k++)
          for (let r = 0; r < 6; r++) {
            const q = wallAt(place, a + 2 + k, sag - 1 - r);
            p.rect(lit(light, (k < 3) !== (r < 3) && i % 3 !== 1 ? c2 : c1, 0.4), q.x, q.y, 1, 1);
          }
        void top;
      }
    },
  };
}

/** A framed chart of the bay. */
function chart(wall: WallSide, at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const W = 30,
        H = 20;
      wallBox(p, place, -2, -2, W + 4, H + 4, lit(light, "#6a4c3c", 0.2));
      wallBox(p, place, 0, 0, W, H, lit(light, "#e8dcbc", 0.3));
      wallBox(p, place, 2, 2, W - 4, H - 4, lit(light, "#a9c9c4", 0.3));
      wallBox(p, place, 4, 6, 10, 9, lit(light, "#d6c79a", 0.3));
      wallBox(p, place, 17, 3, 7, 5, lit(light, "#d6c79a", 0.3));
      wallRun(p, place, 6, 12, 14, lit(light, "#8a5a3c", 0.2));
      const s = wallAt(place, 22, 14);
      p.rect(lit(light, RED, 0.4), s.x, s.y, 1, 1);
      wallArc(p, place, 23, 14, 2, 2, lit(light, "#6a6a70", 0.2), 0, Math.PI * 2);
    },
  };
}

/** The wide window's white casing (round windows have their own brass rims). */
function casing(win: WindowSpec): WallItem {
  return {
    wall: win.wall,
    at: win.at,
    z: win.sill,
    draw(p, light, place) {
      const w = win.width * 24;
      const h = win.top - win.sill;
      const trim = lit(light, WHITE, 0.4);
      wallBox(p, place, -3, h, w + 6, 3, trim);
      wallBox(p, place, -3, -4, w + 6, 3, trim);
      wallBox(p, place, -3, -1, 2, h + 1, trim);
      wallBox(p, place, w + 1, -1, 2, h + 1, trim);
      wallRun(p, place, -3, h + 3, w + 6, lit(light, mixHex(WHITE, CREAM, 0.4), 0.6));
      wallRun(p, place, -3, -5, w + 6, lit(light, mixHex(TEAL_D, INK, 0.3), 0));
    },
  };
}

// ---------------------------------------------------------------- props

/** A coat stand with a yellow oilskin and a sou'wester. */
function coatStandProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 44,
    draw(p, g, light) {
      const f = faceLight(light, 0.3);
      const b = project(g, 0.5, 0.5, 0);
      const wood = lit(light, "#6a4c3c", 0.2);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 7, 2));
      p.line(wood, b.x - 5, b.y, b.x, b.y - 4);
      p.line(wood, b.x + 5, b.y, b.x, b.y - 4);
      p.rect(lit(light, INK, 0), b.x - 1, b.y - 42, 3, 39);
      p.rect(wood, b.x, b.y - 42, 1, 38);
      p.rect(wood, b.x - 4, b.y - 38, 9, 1);
      // The oilskin hung on the left peg, the hat on top.
      const coat = "#e0b23e";
      p.rect(lit(light, INK, 0), b.x - 9, b.y - 37, 9, 24);
      p.rect(lit(light, coat, f.left + 0.2), b.x - 8, b.y - 36, 7, 22);
      p.rect(lit(light, mixHex(coat, CREAM, 0.35), 0.6), b.x - 8, b.y - 36, 2, 20);
      p.rect(lit(light, mixHex(coat, INK, 0.3), 0.1), b.x - 3, b.y - 33, 1, 18);
      p.rect(lit(light, mixHex(coat, INK, 0.3), 0.1), b.x - 7, b.y - 26, 5, 1);
      p.rect(lit(light, INK, 0), b.x - 4, b.y - 47, 10, 5);
      p.rect(lit(light, coat, f.top + 0.2), b.x - 3, b.y - 46, 8, 3);
      p.rect(lit(light, INK, 0), b.x - 5, b.y - 43, 12, 1);
      // A string bag of floats on the other peg.
      p.rect(lit(light, RED, 0.4), b.x + 2, b.y - 35, 3, 3);
      p.rect(lit(light, "#e6c04a", 0.4), b.x + 3, b.y - 31, 3, 3);
      p.line(lit(light, "#8a7a62", 0.2), b.x + 1, b.y - 37, b.x + 4, b.y - 28);
    },
  };
}

/** A sea chest: banded wood, rope handles. */
function seaChestProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 18,
    draw(p, g, light) {
      const share = 0.3;
      const wood = "#7a5a40";
      isoBox(p, g, light, 0.15, 0.15, 0.7, 0.45, 12, { top: mixHex(wood, CREAM, 0.15), left: wood, right: mixHex(wood, INK, 0.25) }, 0, share);
      for (const u of [0.25, 0.75]) {
        const a = project(g, 0.15 + u * 0.7, 0.6, 0);
        p.line(lit(light, NAVY, 0.3), a.x, a.y - 1, a.x, a.y - 11);
      }
      const h = project(g, 0.5, 0.6, 7);
      p.rect(lit(light, BRASS, 0.5), h.x - 1, h.y - 1, 3, 3);
      const r = project(g, 0.85, 0.38, 8);
      p.rect(lit(light, ROPE, 0.4), r.x + 1, r.y - 2, 2, 4);
    },
  };
}

/** An oak barrel. */
function barrel(p: Painter, light: Light, x: number, y: number, h = 16, r = 7) {
  const wood = "#8a603f";
  p.alpha(0.3, () => p.oval(INK, x, y, r + 1, 2));
  p.rect(lit(light, INK, 0), x - r - 1, y - h, r * 2 + 3, h);
  p.rect(lit(light, wood, 0.3), x - r, y - h, r * 2 + 1, h - 1);
  p.rect(lit(light, mixHex(wood, CREAM, 0.25), 0.5), x - r + 2, y - h, 2, h - 2);
  p.rect(lit(light, mixHex(wood, INK, 0.3), 0.1), x + r - 2, y - h, 2, h - 1);
  for (const t of [0.2, 0.75]) p.rect(lit(light, "#4a4448", 0.2), x - r, y - Math.round(h * t) - 1, r * 2 + 1, 1);
  p.oval(lit(light, INK, 0), x, y - h, r + 1, 3);
  p.oval(lit(light, mixHex(wood, CREAM, 0.2), 0.5), x, y - h, r, 2);
}

/** A barrel and a coil of rope on the floor. */
function barrelRopeProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 22,
    draw(p, g, light) {
      const b = project(g, 0.36, 0.4, 0);
      barrel(p, light, b.x, b.y);
      const r = project(g, 0.7, 0.72, 0);
      for (let k = 0; k < 4; k++) {
        p.oval(lit(light, INK, 0), r.x, r.y - k * 2, 7 - k, 3);
        p.oval(lit(light, k % 2 ? ROPE : mixHex(ROPE, CREAM, 0.2), 0.4), r.x, r.y - k * 2 - 1, 6 - k, 2);
      }
      p.oval(lit(light, mixHex(ROPE, INK, 0.5), 0), r.x, r.y - 7, 2, 1);
    },
  };
}

/** A half barrel of blue hydrangeas. */
function hydrangeaProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 28,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, 0.3);
      const b = project(g, 0.5, 0.5, 0);
      barrel(p, light, b.x, b.y, 10, 8);
      const leaf = lit(light, "#4f7a4a", f.left * 0.4);
      const blooms = ["#8aa6d8", "#a7b8e6", "#b8a4d6", "#7d9ad0"];
      const heads: [number, number, number][] = [[-5, -14, 0], [3, -16, 1], [-1, -20, 2], [6, -12, 3], [-7, -10, 1], [1, -11, 0]];
      for (const [dx, dy] of heads) p.oval(leaf, b.x + dx, b.y + dy + 2, 4, 3);
      heads.forEach(([dx, dy, k], i) => {
        p.oval(lit(light, mixHex(blooms[k], INK, 0.25), 0.2), b.x + dx, b.y + dy, 3, 3);
        p.dither(lit(light, blooms[k], f.top + 0.2), b.x + dx - 3, b.y + dy - 3, 6, 5, 0.7, i);
        p.rect(lit(light, mixHex(blooms[k], CREAM, 0.5), 0.6), b.x + dx - 1, b.y + dy - 2, 1, 1);
      });
    },
  };
}


/** An iron bollard on the pier's edge. */
function bollardProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 12,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 5, 2));
      p.rect(lit(light, INK, 0), b.x - 3, b.y - 8, 7, 8);
      p.rect(lit(light, "#3c3a3e", f.left), b.x - 2, b.y - 8, 5, 7);
      p.rect(lit(light, "#5a585c", f.top), b.x - 2, b.y - 8, 2, 6);
      p.oval(lit(light, INK, 0), b.x, b.y - 9, 4, 2);
      p.oval(lit(light, "#4a484c", f.top), b.x, b.y - 10, 3, 1);
    },
  };
}

/** Crates and a lobster pot by the pier's edge. */
function cratesProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    w: 1,
    d: 2,
    height: 26,
    shadow: "none",
    draw(p, g, light) {
      const wood = "#a8845a";
      const sh = [project(g, 0.1, 0.85), project(g, 0.8, 0.85), project(g, 1.1, 1.1), project(g, 0.4, 1.15)];
      p.alpha(0.25, () => p.poly(INK, sh.flatMap((q) => [q.x, q.y])));
      const crate = (u: number, v: number, s: number, z: number) => {
        isoBox(p, g, light, u, v, s, s, Math.round(s * 24), { top: mixHex(wood, CREAM, 0.15), left: wood, right: mixHex(wood, INK, 0.25) }, z);
        const a = project(g, u, v + s, z + s * 12);
        const b2 = project(g, u + s, v + s, z + s * 12);
        p.line(lit(light, mixHex(wood, INK, 0.4), 0.1), a.x, a.y, b2.x, b2.y);
      };
      crate(0.1, 0.15, 0.7, 0);
      crate(0.18, 0.25, 0.5, 17);
      // The lobster pot: a netted half-barrel.
      const c = project(g, 0.5, 1.45, 0);
      p.rect(lit(light, INK, 0), c.x - 9, c.y - 9, 19, 9);
      p.oval(lit(light, INK, 0), c.x, c.y - 9, 9, 5);
      p.oval(lit(light, "#5f6f62", 0.4), c.x, c.y - 9, 8, 4);
      p.rect(lit(light, "#5f6f62", 0.4), c.x - 8, c.y - 9, 17, 8);
      for (let k = -6; k <= 6; k += 3) p.line(lit(light, "#c7b48a", 0.4), c.x + k, c.y - 13 + Math.abs(k) / 3, c.x + k, c.y - 2);
      p.line(lit(light, "#c7b48a", 0.4), c.x - 8, c.y - 6, c.x + 8, c.y - 6);
      p.rect(lit(light, RED, 0.5), c.x + 6, c.y - 12, 3, 3);
    },
  };
}

/** A harbor lamp: black post, brass lantern. */
function harborLampProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 56,
    shadow: "none",
    draw(p, g, light) {
      const b = project(g, 0.5, 0.5, 0);
      const post = lit(light, "#36343a", 0.1);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 5, 2));
      p.rect(post, b.x - 3, b.y - 4, 7, 4);
      p.rect(post, b.x - 1, b.y - 46, 3, 44);
      p.rect(post, b.x - 2, b.y - 47, 5, 2);
      const on = light.night > 0.15;
      p.rect(lit(light, INK, 0), b.x - 4, b.y - 58, 9, 11);
      p.rect(lit(light, BRASS, 0.4), b.x - 3, b.y - 57, 7, 1);
      p.rect(on ? "#ffd98a" : lit(light, "#d8e0d8", 0.4), b.x - 3, b.y - 55, 7, 6);
      p.rect(lit(light, BRASS, 0.4), b.x, b.y - 55, 1, 6);
      p.rect(lit(light, INK, 0), b.x - 2, b.y - 61, 5, 3);
      if (on) p.alpha(0.22 * light.night, () => p.oval("#ffc070", b.x, b.y - 52, 12, 10));
    },
  };
}

/** A red-and-white buoy with its light. */
function buoyProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 24,
    shadow: "none",
    draw(p, g, light) {
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.35, () => p.oval("#2f4f58", b.x, b.y + 1, 8, 2));
      p.oval(lit(light, INK, 0), b.x, b.y - 4, 7, 4);
      p.oval(lit(light, RED, 0.5), b.x, b.y - 4, 6, 3);
      p.rect(lit(light, INK, 0), b.x - 4, b.y - 16, 9, 12);
      for (let k = 0; k < 3; k++) p.rect(lit(light, k % 2 ? "#f1ebdc" : RED, 0.5), b.x - 3, b.y - 15 + k * 4, 7, 4);
      p.rect(lit(light, mixHex(RED, CREAM, 0.4), 0.7), b.x - 3, b.y - 15, 1, 11);
      p.rect(lit(light, INK, 0), b.x - 1, b.y - 21, 3, 5);
      const on = light.night > 0.2;
      p.rect(on ? "#9ff0b0" : lit(light, "#9fc0a0", 0.4), b.x, b.y - 20, 1, 3);
      if (on) p.alpha(0.3 * light.night, () => p.oval("#9ff0b0", b.x, b.y - 19, 6, 5));
      p.rect(lit(light, WS_LIGHT, 0.8), b.x - 9, b.y + 1, 4, 1);
      p.rect(lit(light, WS_LIGHT, 0.8), b.x + 6, b.y, 3, 1);
    },
  };
}
const WS_LIGHT = "#bcd8d4";

/** A red rowing boat riding at anchor, oars shipped. */
function rowboatProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    w: 1.7,
    d: 0.8,
    height: 12,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const P = (u: number, v: number, z = 0) => project(g, u, v, z);
      const rim = [P(0, 0.4, 6), P(0.35, 0.08, 6), P(1.5, 0.08, 6), P(1.7, 0.4, 7), P(1.5, 0.72, 6), P(0.35, 0.72, 6)];
      const keel = [P(0.1, 0.4), P(0.4, 0.2), P(1.45, 0.2), P(1.62, 0.4), P(1.45, 0.6), P(0.4, 0.6)];
      p.alpha(0.35, () => p.poly("#2f4f58", keel.flatMap((q) => [q.x + 1, q.y + 2])));
      p.poly(lit(light, RED, f.left), [keel[3].x, keel[3].y, keel[4].x, keel[4].y, keel[5].x, keel[5].y, keel[0].x, keel[0].y, rim[0].x, rim[0].y, rim[5].x, rim[5].y, rim[4].x, rim[4].y, rim[3].x, rim[3].y]);
      p.poly(lit(light, "#d9c49a", f.top * 0.8), rim.flatMap((q) => [q.x, q.y]));
      const inner = [P(0.25, 0.4, 4), P(0.45, 0.2, 4), P(1.45, 0.2, 4), P(1.55, 0.4, 4), P(1.45, 0.6, 4), P(0.45, 0.6, 4)];
      p.poly(lit(light, "#8a6a4a", f.top * 0.6), inner.flatMap((q) => [q.x, q.y]));
      for (const u of [0.7, 1.15]) {
        const a = P(u, 0.12, 5),
          b = P(u, 0.68, 5);
        p.line(lit(light, "#b89a70", f.top), a.x, a.y, b.x, b.y);
      }
      const o1 = P(0.3, 0.55, 6),
        o2 = P(1.5, 0.3, 6);
      p.line(lit(light, "#c9a46e", f.top), o1.x, o1.y, o2.x, o2.y);
      p.line(lit(light, mixHex(RED, CREAM, 0.4), f.left + 0.2), rim[3].x, rim[3].y, rim[4].x, rim[4].y);
      p.line(lit(light, mixHex(RED, CREAM, 0.4), f.left + 0.2), rim[4].x, rim[4].y, rim[5].x, rim[5].y);
    },
  };
}

/** A heap of drying net with its floats, a lobster pot on top. */
function netsProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    w: 1,
    d: 1,
    height: 18,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const c = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, c.x, c.y, 12, 4));
      p.oval(lit(light, INK, 0), c.x, c.y - 4, 12, 5);
      p.oval(lit(light, "#5f7468", f.top * 0.7), c.x, c.y - 5, 11, 4);
      p.dither(lit(light, "#8aa090", f.top), c.x - 10, c.y - 9, 20, 7, 0.35, 3);
      for (const [dx, dy, col] of [[-7, -5, RED], [-2, -8, "#e6c04a"], [4, -6, RED], [8, -4, "#e6c04a"], [0, -3, "#f1ebdc"]] as [number, number, string][]) p.rect(lit(light, col, 0.5), c.x + dx, c.y + dy, 2, 2);
    },
  };
}

/** A small fishing boat moored alongside the gangway, its bow up the frame. */
function fishingBoatProp(key: string, x: number, y: number): PropSpec {
  const W = 1.4,
    D = 3.4;
  return {
    key,
    x,
    y,
    w: W,
    d: D,
    height: 56,
    pad: 10,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const P = (u: number, v: number, z = 0) => project(g, u, v, z);
      type Pt = { x: number; y: number };
      const quad = (a: Pt, b: Pt, c: Pt, d: Pt, color: string) => p.poly(color, [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]);
      const outline = (inset: number): [number, number][] => [
        [W / 2, -0.1 + inset * 1.6],
        [W - inset, 0.9],
        [W - inset, D - inset],
        [inset, D - inset],
        [inset, 0.9],
      ];
      const GZ = 15;
      // Its shadow on the water, then the hull's two faces we see.
      p.alpha(0.35, () => p.poly("#2f4f58", outline(0).flatMap(([u, v]) => [P(u, v).x + 2, P(u, v).y + 2])));
      const hullS = lit(light, HULL, f.right);
      quad(P(W / 2, -0.1), P(W, 0.9), P(W, 0.9, GZ), P(W / 2, -0.1, GZ + 2), lit(light, mixHex(HULL, INK, 0.15), f.right));
      quad(P(W, 0.9), P(W, D), P(W, D, GZ), P(W, 0.9, GZ), hullS);
      quad(P(0, D), P(W, D), P(W, D, GZ), P(0, D, GZ), lit(light, mixHex(HULL, INK, 0.12), f.left));
      // Red boot-top at the waterline, a teal sheer stripe under the gunwale.
      for (const [z, color] of [[1, RED], [2, RED], [3, RED], [11, TEAL], [12, TEAL]] as [number, string][]) {
        const bw = P(W / 2, -0.1 + z * 0.005, z),
          a = P(W, 0.9, z),
          b = P(W, D, z),
          c = P(0, D, z);
        p.line(lit(light, color, f.right), bw.x, bw.y, a.x, a.y);
        p.line(lit(light, color, f.right), a.x, a.y, b.x, b.y);
        p.line(lit(light, color, f.left), b.x, b.y, c.x, c.y);
      }
      // Inside the bulwarks: their white inner face, the wooden deck lower down.
      p.poly(lit(light, "#d9d2c2", f.top * 0.6), outline(0).flatMap(([u, v], i) => [P(u, v, i === 0 ? GZ + 2 : GZ).x, P(u, v, i === 0 ? GZ + 2 : GZ).y]));
      p.poly(lit(light, "#8f6c4a", f.top), outline(0.14).flatMap(([u, v]) => [P(u, v, GZ - 5).x, P(u, v, GZ - 5).y]));
      const rim = outline(0).map(([u, v], i) => P(u, v, i === 0 ? GZ + 2 : GZ));
      for (let i = 0; i < rim.length; i++) {
        const a = rim[i],
          b = rim[(i + 1) % rim.length];
        p.line(i === 0 || i === 1 || i === 2 ? lit(light, CREAM, 0.6) : lit(light, "#bdb5a4", 0.3), a.x, a.y, b.x, b.y);
      }
      p.line(lit(light, INK, 0), P(W / 2, -0.1).x, P(W / 2, -0.1).y, P(W / 2, -0.1, GZ + 2).x, P(W / 2, -0.1, GZ + 2).y);
      // The wheelhouse aft: white with a teal roof, its windows lit after dark.
      const on = light.night > 0.4;
      isoBox(p, g, light, 0.25, 2.05, W - 0.5, 0.85, 14, { top: "#d9d2c2", left: HULL, right: mixHex(HULL, INK, 0.15) }, GZ - 5);
      isoBox(p, g, light, 0.18, 1.95, W - 0.36, 1.0, 2, { top: TEAL, left: TEAL_D, right: mixHex(TEAL_D, INK, 0.2) }, GZ + 9);
      for (const v2 of [2.2, 2.55]) {
        const a = P(W - 0.25, v2, GZ + 6),
          b = P(W - 0.25, v2 + 0.25, GZ + 6);
        quad(a, b, { x: b.x, y: b.y + 4 }, { x: a.x, y: a.y + 4 }, on ? "#f0c87a" : lit(light, "#3f5560", 0.2));
      }
      const sw = P(0.45, 2.9, GZ + 6),
        sw2 = P(W - 0.45, 2.9, GZ + 6);
      quad(sw, sw2, { x: sw2.x, y: sw2.y + 4 }, { x: sw.x, y: sw.y + 4 }, on ? "#f0c87a" : lit(light, "#3f5560", 0.2));
      // Mast, boom with the sail furled on it, a pennant, the forestay.
      const m = P(W / 2, 1.05, GZ - 5);
      const top = m.y - 40;
      p.rect(lit(light, "#5a4032", 0.2), m.x, top, 1, 40);
      p.rect(lit(light, "#7a5a44", 0.4), m.x - 1, top + 22, 1, 18);
      const boomEnd = P(W / 2, 2.0, GZ + 14);
      p.line(lit(light, "#5a4032", 0.2), m.x, m.y - 18, boomEnd.x, boomEnd.y);
      p.line(lit(light, "#e9dfc6", f.top + 0.2), m.x, m.y - 19, boomEnd.x, boomEnd.y - 1);
      p.line(lit(light, "#e9dfc6", f.top + 0.2), m.x + 1, m.y - 20, boomEnd.x, boomEnd.y - 2);
      p.poly(lit(light, RED, 0.5), [m.x + 1, top, m.x + 8, top + 2, m.x + 1, top + 4]);
      const bowTip = P(W / 2, -0.1, GZ + 2);
      p.line(lit(light, "#6a6058", 0.2), m.x, top + 2, bowTip.x, bowTip.y);
      // Fenders over the side, the name on the bow, a line to the bollard.
      for (let k = 0; k < 3; k++) {
        const q = P(W + 0.02, 1.3 + k * 0.6, GZ - 4);
        p.rect(lit(light, INK, 0), q.x - 1, q.y - 1, 3, 5);
        p.rect(lit(light, k % 2 ? "#e6c04a" : RED, 0.5), q.x, q.y, 1, 3);
      }
      const nm = P(W, 1.05, 9);
      word(p, "MAY", lit(light, NAVY, f.right), nm.x - 11, nm.y - 3, -0.5);
      const tie = P(W, 1.6, GZ);
      const post = P(1.8, 1.8, 8);
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        p.rect(lit(light, ROPE, 0.4), Math.round(tie.x + (post.x - tie.x) * t), Math.round(tie.y + (post.y - tie.y) * t + Math.sin(t * Math.PI) * 3), 1, 1);
      }
    },
  };
}

/** The island ferry, berthed at the pier's end: white hull, navy band, a red funnel. */
function ferryProp(key: string, x: number, y: number, W: number, D: number): PropSpec {
  return {
    key,
    x,
    y,
    w: W,
    d: D,
    height: 62,
    pad: 8,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const P = (u: number, v: number, z = 0) => project(g, u, v, z);
      const hz = 16;
      const bow = 1.8;
      p.alpha(0.35, () => p.poly("#2f4f58", [P(0, bow).x, P(0, bow).y + 3, P(W / 2, 0).x, P(W / 2, 0).y + 3, P(W, bow).x, P(W, bow).y + 3, P(W, D).x, P(W, D).y + 3, P(0, D).x, P(0, D).y + 3]));
      const quad = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }, color: string) => p.poly(color, [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]);
      quad(P(W / 2, 0), P(W, bow), P(W, bow, hz), P(W / 2, -0.2, hz + 3), lit(light, mixHex(HULL, INK, 0.2), f.right));
      quad(P(W, bow), P(W, D), P(W, D, hz), P(W, bow, hz), lit(light, HULL, f.right));
      quad(P(0, D), P(W, D), P(W, D, hz), P(0, D, hz), lit(light, mixHex(HULL, INK, 0.1), f.left));
      for (const z of [3, 4, 5]) {
        const a = P(W, bow, z),
          b = P(W, D, z),
          c = P(0, D, z),
          bw = P(W / 2, 0.05, z);
        const col = z === 5 ? NAVY : RED;
        p.line(lit(light, col, f.right), bw.x, bw.y, a.x, a.y);
        p.line(lit(light, col, f.right), a.x, a.y, b.x, b.y);
        p.line(lit(light, col, f.left), b.x, b.y, c.x, c.y);
      }
      for (const z of [11, 12]) {
        const a = P(W, bow, z),
          b = P(W, D, z);
        p.line(lit(light, NAVY, f.right), a.x, a.y, b.x, b.y);
      }
      p.poly(lit(light, "#b9a98c", f.top), [P(0, bow, hz).x, P(0, bow, hz).y, P(W / 2, -0.2, hz + 3).x, P(W / 2, -0.2, hz + 3).y, P(W, bow, hz).x, P(W, bow, hz).y, P(W, D, hz).x, P(W, D, hz).y, P(0, D, hz).x, P(0, D, hz).y]);
      // Portholes along the hull.
      const on = light.night > 0.4;
      for (let v = bow + 0.4; v < D - 0.3; v += 0.55) {
        const q = P(W, v, 8);
        p.rect(lit(light, INK, 0), q.x - 1, q.y - 1, 3, 3);
        p.rect(on ? "#f0c87a" : lit(light, "#3f5560", 0.2), q.x, q.y, 1, 1);
      }
      // The saloon with its window band, the bridge on top, the funnel.
      isoBox(p, g, light, 0.25, bow + 0.6, W - 0.5, D - bow - 1.2, 16, { top: "#b9b3a6", left: HULL, right: mixHex(HULL, INK, 0.18) }, hz);
      for (let v = bow + 0.8; v < D - 0.8; v += 0.5) {
        const a = P(W - 0.25, v, hz + 12),
          b = P(W - 0.25, v + 0.35, hz + 12);
        p.poly(on ? "#f0c87a" : lit(light, "#3f5560", 0.15), [a.x, a.y, b.x, b.y, b.x, b.y + 6, a.x, a.y + 6]);
      }
      const rail = P(W, bow, hz + 4),
        rail2 = P(W, D, hz + 4);
      p.line(lit(light, "#f4f0e4", f.right), rail.x, rail.y, rail2.x, rail2.y);
      isoBox(p, g, light, 0.5, bow + 0.7, W - 1, 1.4, 11, { top: "#c6c0b2", left: HULL, right: mixHex(HULL, INK, 0.18) }, hz + 16);
      const bw1 = P(W - 0.5, bow + 0.8, hz + 24),
        bw2 = P(W - 0.5, bow + 2.0, hz + 24);
      p.poly(on ? "#f0c87a" : lit(light, "#2f4552", 0.15), [bw1.x, bw1.y, bw2.x, bw2.y, bw2.x, bw2.y + 5, bw1.x, bw1.y + 5]);
      isoBox(p, g, light, W / 2 - 0.35, bow + 3.0, 0.7, 0.7, 14, { top: INK, left: RED, right: mixHex(RED, INK, 0.3) }, hz + 16);
      isoBox(p, g, light, W / 2 - 0.35, bow + 3.0, 0.7, 0.7, 3, { top: "#2e2a2c", left: "#2e2a2c", right: "#2e2a2c", lip: false }, hz + 27);
      // Life rings on the saloon's flank, the name on the bow.
      for (const v of [bow + 1.1, D - 1.4]) {
        const q = P(W - 0.25, v, hz + 5);
        p.oval(lit(light, RED, 0.5), q.x, q.y, 2, 2);
        p.rect(lit(light, "#f1ebdc", 0.5), q.x, q.y, 1, 1);
      }
      const nm = P(W, bow + 0.25, 9);
      word(p, "ISLA", lit(light, NAVY, f.right), nm.x - 15, nm.y + 1, -0.5);
    },
  };
}

// ---------------------------------------------------------------- the street view

/**
 * The tea house from the pier head: a teal shiplap house under a white
 * gable on its deck over the water, a porthole in the gable, the name on
 * a navy board, a wide window with the day's cup on its sill, a door with
 * a porthole and a life ring by it, lanterns lit after dark, signal flags
 * strung from the ridge.
 */
function teaHouseFront(p: Painter, light: Light, box: FrontBox) {
  const L = (hex: string, f = 0.5, g = 0) => light.lit(hex, f, g);
  const { x, w, ground } = box;
  const night = light.night > 0.4;
  const h0 = x + 12,
    h1 = x + w - 12;
  const cx = Math.round((h0 + h1) / 2);
  const eave = 52,
    apex = 20;
  // The deck it stands on, its edge beam and the piles down into the water.
  const d0 = h0 - 26,
    d1 = h1 + 26;
  for (let y = ground - 4; y < ground + 8; y++) p.rect(L(y % 3 === 0 ? "#6e6a62" : y % 6 < 3 ? "#9a958c" : "#a39e94", 0.6), d0, y, d1 - d0, 1);
  p.rect(L("#4f463e", 0.2), d0, ground + 8, d1 - d0, 4);
  p.rect(L(INK, 0), d0, ground + 12, d1 - d0, 1);
  for (let xx = d0 + 4; xx < d1; xx += 16) {
    p.rect(L("#3a322c", 0.1), xx, ground + 12, 4, 150 - ground - 12);
    p.rect(L("#86b2b2", 0.7), xx - 2, ground + 18 + (xx % 3), 8, 1);
  }
  // Walls of teal shiplap under the gable.
  for (let y = apex; y < ground - 4; y++) {
    const half = y < eave ? Math.round(((y - apex) / (eave - apex)) * (h1 - h0 + 12) / 2) : (h1 - h0) / 2;
    const a = y < eave ? cx - half : h0,
      b = y < eave ? cx + half : h1;
    if (b <= a) continue;
    p.rect(L((y - apex) % 5 === 0 ? TEAL_D : (y >> 3) % 3 === 0 ? "#558584" : TEAL, 0.5), a, y, b - a, 1);
  }
  // White corner boards, bargeboards, the ridge's finial and a pennant.
  p.rect(L(WHITE, 0.6), h0 - 2, eave, 4, ground - 4 - eave);
  p.rect(L(WHITE, 0.6), h1 - 2, eave, 4, ground - 4 - eave);
  for (let k = -1; k <= 2; k++) {
    p.line(k < 0 ? L(INK, 0) : L(k === 2 ? "#4a5a5c" : WHITE, k === 2 ? 0.2 : 0.7), h0 - 9, eave + 3 - k, cx, apex - 2 - k);
    p.line(k < 0 ? L(INK, 0) : L(k === 2 ? "#4a5a5c" : WHITE, k === 2 ? 0.2 : 0.7), h1 + 9, eave + 3 - k, cx, apex - 2 - k);
  }
  p.rect(L("#6a4c3c", 0.3), cx, apex - 20, 1, 16);
  p.poly(L(RED, 0.6), [cx + 1, apex - 20, cx + 10, apex - 18, cx + 1, apex - 16]);
  // A porthole in the gable.
  const py = apex + 16;
  p.oval(L(INK, 0), cx, py, 7, 7);
  p.oval(L(BRASS, 0.6), cx, py, 6, 6);
  const lamplit = night && box.open;
  p.oval(lamplit ? "#f2cf86" : L("#7fa6ae", 0.6), cx, py, 4, 4);
  p.rect(lamplit ? "#fff0c8" : L("#cfe4e4", 0.8), cx - 2, py - 2, 2, 1);
  // The name on a navy board under the eaves.
  const name = box.name.toUpperCase();
  const sw = Math.min(h1 - h0 - 6, bigWidth(name) + 10);
  const sx = Math.round(cx - sw / 2),
    sy = eave + 3;
  p.rect(L(INK, 0), sx - 1, sy - 1, sw + 2, 13);
  p.rect(L(NAVY, 0.4), sx, sy, sw, 11);
  p.rect(L(WHITE, 0.6), sx, sy, sw, 1);
  const ink = lamplit ? "#ffe9c0" : L("#f1ebdc", 0.7, box.open ? 0.5 : 0);
  if (bigWidth(name) <= sw - 4) bigWord(p, name, ink, Math.round(cx - bigWidth(name) / 2), sy + 2);
  else word(p, name, ink, Math.round(cx - (name.length * 4 - 1) / 2), sy + 3);
  // The wide window, white-framed in three lights, the day's cup on its sill.
  const wx0 = h0 + 8,
    wx1 = h0 + Math.round((h1 - h0) * 0.56);
  const wy0 = sy + 18,
    wy1 = ground - 22;
  const glass = box.open ? (night ? "#f2cf86" : L("#dfe6e0", 0.5)) : L("#5f7478", 0.3);
  p.rect(L(WHITE, 0.6), wx0 - 3, wy0 - 3, wx1 - wx0 + 6, wy1 - wy0 + 6);
  p.rect(glass, wx0, wy0, wx1 - wx0, wy1 - wy0);
  if (box.open && !night) {
    p.rect(L("#9cc3c0", 0.6), wx0, wy0 + 6, wx1 - wx0, 6);
    p.rect(L(CREAM, 0.9), wx0 + 3, wy0 + 2, 12, 1);
  }
  for (const t of [1 / 3, 2 / 3]) p.rect(L(WHITE, 0.6), Math.round(wx0 + (wx1 - wx0) * t) - 1, wy0, 2, wy1 - wy0);
  p.rect(L(WHITE, 0.7), wx0 - 5, wy1 + 2, wx1 - wx0 + 10, 3);
  p.rect(L(INK, 0), wx0 - 5, wy1 + 5, wx1 - wx0 + 10, 1);
  if (box.display && box.open) displayCup(p, light, box.display, Math.round((wx0 + wx1) / 2), wy1 + 2);
  // The door with its porthole, a life ring on the wall beside it, a lantern either side.
  const dx0 = wx1 + 10,
    dx1 = h1 - 16;
  const dy0 = wy0 - 6;
  p.rect(L(WHITE, 0.6), dx0 - 2, dy0 - 2, dx1 - dx0 + 4, ground - 4 - dy0 + 2);
  p.rect(L(TEAL_D, 0.4), dx0, dy0, dx1 - dx0, ground - 4 - dy0);
  for (let xx = dx0 + 4; xx < dx1; xx += 5) p.rect(L(mixHex(TEAL_D, INK, 0.25), 0.2), xx, dy0, 1, ground - 4 - dy0);
  const pc = Math.round((dx0 + dx1) / 2);
  p.oval(L(BRASS, 0.6), pc, dy0 + 10, 5, 5);
  p.oval(box.open ? glass : L("#5f7478", 0.3), pc, dy0 + 10, 3, 3);
  p.rect(L(BRASS, 0.7), dx1 - 5, dy0 + 24, 2, 2);
  const tag = box.open ? "OPEN" : "SHUT";
  p.rect(L(INK, 0), pc - 9, dy0 + 18, 18, 8);
  p.rect(box.open ? L("#7f9a72", 0.6, 0.6) : L(RED, 0.6), pc - 8, dy0 + 19, 16, 6);
  word(p, tag, L(CREAM, 0.6), pc - 7, dy0 + 20);
  const rc = { x: h1 - 7, y: dy0 + 14 };
  p.oval(L(INK, 0), rc.x, rc.y, 6, 6);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    for (const r of [4, 5]) p.rect(L(Math.floor(k / 3) % 2 ? RED : "#f1ebdc", 0.6), rc.x + Math.round(Math.cos(a) * r), rc.y + Math.round(Math.sin(a) * r), 1, 1);
  }
  for (const lx of [dx0 - 6]) {
    p.rect(L(INK, 0), lx - 2, dy0 + 2, 5, 8);
    p.rect(night ? "#ffd98a" : L("#d8e0d8", 0.5), lx - 1, dy0 + 4, 3, 4);
    p.rect(L(BRASS, 0.6), lx - 2, dy0 + 2, 5, 1);
    if (night) p.alpha(0.25 * light.night, () => p.oval("#ffc070", lx, dy0 + 6, 9, 8));
  }
  // Signal flags strung down each bargeboard from the ridge to the eaves.
  const sets = [RED, "#e6c04a", NAVY, "#f1ebdc", RED, "#e6c04a", NAVY];
  for (const side of [-1, 1]) {
    const ex = side < 0 ? h0 - 9 : h1 + 9;
    const ey = eave + 4;
    let px = cx,
      py2 = apex - 3;
    for (let i = 1; i <= 7; i++) {
      const t = i / 8;
      const fx = Math.round(cx + (ex - cx) * t),
        fy = Math.round(apex - 3 + (ey - apex + 3) * t + Math.sin(t * Math.PI) * 4);
      p.line(L("#3a2c2c", 0.1), px, py2, fx, fy);
      p.poly(L(sets[i - 1], 0.6), [fx - 2, fy, fx + 2, fy, fx, fy + 5]);
      px = fx;
      py2 = fy;
    }
    p.line(L("#3a2c2c", 0.1), px, py2, ex, ey);
  }
}

// ---------------------------------------------------------------- the venue

export function harborVenue(o: VenueOptions): Venue {
  const { cols, rows } = o;
  // A table for three on the rag rug, and a small one for two by the portholes.
  const sit = seating(
    cafeTable("harbor-table", 2.85, 5.65, ["-x", "-y", "+x"], { wood: "#a47c58", seat: TEAL }),
    cafeTable("harbor-table2", 1.35, 3.85, ["-x", "-y"], { wood: "#a47c58", seat: RED }),
  );
  const wallH = 84;
  const port = (wall: WallSide, at: number, sill = 40): WindowSpec => ({ wall, at, width: 1, sill, top: sill + 24, shape: "round" });
  const big: WindowSpec = { wall: "right", at: 5.9, width: 2.9, sill: 28, top: 66, bars: 2, transom: 11, frame: WHITE };
  const ports = [port("right", 1.55), port("left", 2.3), port("left", 4.55)];
  const v: Venue = {
    id: "harbor",
    cols,
    rows,
    floor: planks("#9b968c", "#a6a196", "#6e6a62", "#8a857b", 8, 56),
    wall: shiplap(TEAL, "#558584", TEAL_D, 6),
    wainscot: { surface: boards("#e3ddcc", "#dad3c0", "#b9b19e", 5), height: 24, rail: WHITE },
    cap: "#f1ebdc",
    slab: "#6a5f55",
    wallHeight: wallH,
    windows: [big, ...ports],
    doors: [],
    lamps: [
      // The lanterns are wall items; a fire lamp gives each its glow on the wall and floor without a fixture of its own.
      { kind: "fire", x: 0.1, y: 3.45, z: 47, reach: 3.2 },
      { kind: "fire", x: 5.55, y: 0.1, z: 47, reach: 3.2 },
      { kind: "fire", x: 0.1, y: 6.6, z: 47, reach: 2.4 },
    ],
    wallItems: [
      signalFlags("left", rows, 78),
      ...ports.map((w) => portholeRim(w, BRASS)),
      casing(big),
      lifeRing("right", 0.2, 34),
      ferryBoard("right", 2.85, 48, o.hour),
      wallLantern("right", 5.55, 44),
      ropeCoil("left", 0.55, 44),
      wallLantern("left", 3.45, 44),
      chart("left", 5.45, 44),
      wallLantern("left", 6.6, 44),
    ],
    props: [
      ...sit.props,
      coatStandProp("prop:coats", 0, 0),
      seaChestProp("prop:chest", 2, 0),
      barrelRopeProp("prop:barrel", 0, rows - 1),
      hydrangeaProp("prop:hydrangea", cols - 1, rows - 1),
    ],
    counter: { top: "#b39a78", front: "#4f8584", side: "#3f6c6b", trim: WHITE, panel: "slats", height: 16 },
    outside: {
      ground: harborGround(cols, rows),
      noSnow: true,
      view: harborView,
      props: [
        ferryProp("out:ferry", PIER_X0 - 3.0, -1.4, 2.5, 9),
        fishingBoatProp("out:boat", 2.5, rows + 2.1),
        bollardProp("out:bollard", -1.2, rows + 0.7),
        bollardProp("out:bollard", 3.7, rows + 0.7),
        bollardProp("out:bollard", 3.8, rows + 3.4),
        bollardProp("out:bollard", 7.8, rows + 2.4),
        bollardProp("out:bollard", cols + 0.7, 0.4),
        bollardProp("out:bollard", cols + 0.7, 6.4),
        bollardProp("out:bollard", PIER_X0 + 0.2, 0.5),
        bollardProp("out:bollard", PIER_X0 + 0.2, 4.5),
        cratesProp("out:crates", cols + 0.15, 3.2),
        harborLampProp("out:lamp", 3.6, rows + 0.4),
        harborLampProp("out:lamp2", cols + 0.5, 1.6),
        buoyProp("out:buoy", cols + 3.2, 2.6),
        rowboatProp("out:rowboat", 3.4, -5.2),
        netsProp("out:nets", PIER_X0 + 0.9, 5.7),
      ],
    },
    front: { height: 18, color: TEAL, cap: WHITE, stripe: [WHITE, 2, 4], gapsLeft: [5, 6] },
    // Guests come up the gangway from below the frame, in through the open front and up to the serve counter.
    // Up the gangway and in through the gap in the low wall; the line runs straight down from the serve counter.
    seats: sit.seats,
    doorway: { wall: "front-left", from: 5, to: 7 },
    entry: [6.0, rows + 6.0],
    queue: [
      [6.5, 3.4],
      [6.4, 4.15],
      [6.3, 4.9],
      [6.2, 5.65],
      [6.1, 6.4],
      [6.0, rows + 0.75],
    ],
    pickup: [5.75, 3.5],
    out: [[5.4, 6.2]],
    indoorSun: 0.45,
    facade: { wall: shiplap(TEAL, "#558584", TEAL_D, 6), trim: WHITE, sign: { board: NAVY, ink: "#f1ebdc" }, door: TEAL_D, neighbours: "none", paint: teaHouseFront, queueAt: 0.72 },
  };
  v.outside.far = seaFar(v);
  v.floorItems = [rug(() => v, 1.9, 4.9, 1.9, 1.5)];
  return v;
}

/** A braided rag rug under the tea table, lit like the floor under it. */
function rug(venue: () => Venue, x: number, y: number, w: number, d: number) {
  const bands = ["#7a5a4a", "#c7a46e", NAVY, "#c7a46e", "#9a6a52"];
  return floorShader(venue, [x, y, x + w, y + d], (tx, ty) => {
    const e = Math.min(tx - x, ty - y, x + w - tx, y + d - ty);
    return bands[Math.min(bands.length - 1, Math.floor(e / 0.12))];
  });
}
