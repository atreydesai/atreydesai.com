/**
 * Skyline Tea Loft: a tasting room near the top of a tower. Exposed brick
 * between steel-framed windows that run floor to ceiling, a black steel
 * beam along the ceiling line, bare bulbs on long cords, a herringbone oak
 * floor, a low sofa by the glass, a record player, plants. The flight board
 * lists the day's tasting flights. Outside, a decked roof terrace with
 * planters behind a glass rail, a stair up from the floor below, then the
 * drop to a hazy city with the skyline standing across it.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, project, faceLight, type IsoGrid } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { herringbone, plaster } from "../surfaces.ts";
import type { Surface } from "../surfaces.ts";
import type { Venue, PropSpec, WallItem, WindowSpec, WallSide, FrontBox } from "../types.ts";
import { displayCup } from "../front.ts";
import { word, bigWord, bigWidth } from "../font.ts";
import { INK } from "../props.ts";
import type { VenueOptions } from "./index.ts";
import { wallBox, wallWord, wallRun, wallAt, litCache, roomGround, hash, weatherHaze, floorShader, CREAM } from "./_station-kit.ts";

const BRICK = "#a2573f";
const STEEL = "#2f2e34";
const STEEL_HI = "#5b5a62";
const OAK = "#b5845a";
const CONCRETE = "#b3afa6";
const PLUM = "#7a5a72";
const NEON = "#ff8f7e";

const lit = (light: Light, hex: string, face = 0.3, glow = 0) => light.lit(hex, face, glow);

// ---------------------------------------------------------------- surfaces

/** Old brick in running bond: a few burnt headers, pale lime mortar. */
function oldBrick(): Surface {
  return {
    colors: [BRICK, "#97503b", "#7e4232", "#c9b79e", "#b0654a"],
    at(u, z) {
      const course = Math.floor(z / 4);
      if (z - course * 4 < 1) return 3;
      const along = u + (course & 1) * 5;
      const b = Math.floor(along / 10);
      if (along - b * 10 < 1) return 3;
      const n = noise(b, course, 21);
      return n > 0.9 ? 2 : n > 0.7 ? 1 : n < 0.08 ? 4 : 0;
    },
  };
}

// ---------------------------------------------------------------- outside: terrace, the drop, the city

const TERRACE: [number, number, number, number] = [-2.6, -2.4, 2.4, 2.6];
/** The stair up from the floor below, x from the room's right edge: its head at the south end, facing the terrace doors. */
const STAIR: [number, number, number, number] = [1.2, 0.2, 2.2, 2.1];

const C = [
  "#8f7b69", "#98846f", "#6f5d50", "#857160", // 0-3 deck
  "#c7c2b8", "#a7a29a", // 4-5 parapet cap, its shadow line
  "#8a6a5a", "#77594b", "#56606c", "#8fa2b0", "#6a4f44", // 6-10 facade: brick, shade, glass, glass catching sky, deep shade
  "#a3a9ae", "#b0b3b2", "#959ca3", "#b8b3a8", "#9aa898", "#c4c8ca", // 11-16 roofs below, a park, haze
  "#878d93", "#7b8187", // 17-18 streets, their kerbs
  "#4a443f", "#5c554e", "#3a3532", // 19-21 stairwell
  "#8b9298", "#a0a59f", // 22-23 roof shadows, rooftop boxes
  "#8a847c", // 24 top treads
];
const ROOFS = [C[11], C[12], C[13], C[14], C[16]];
const SNOW = ["#e9edec", "#dde3e5", "#d3d9dc"];
/** The stair's treads, paler at the head and darker as they go down. */
const STEPS = ["#a59e93", "#8f887e", "#78726a", "#635e58", "#4f4a46"];

function loftGround(cols: number, rows: number) {
  const x0 = TERRACE[0],
    y0 = TERRACE[1],
    x1 = cols + TERRACE[2],
    y1 = rows + TERRACE[3];
  return (x: number, y: number, light?: Light) => {
    const snow = light?.weather === "snow";
    if (x > x0 && x < x1 && y > y0 && y < y1) {
      // The stair down to the floor below: treads stepping away into the dark.
      const sx = x - cols;
      if (sx > STAIR[0] && sx < STAIR[2] && y > STAIR[1] && y < STAIR[3]) {
        const t = (STAIR[3] - y) * 5;
        const step = Math.floor(t);
        if (t - step < 0.2 || sx - STAIR[0] < 0.08 || STAIR[2] - sx < 0.08) return C[21];
        return STEPS[Math.min(4, step >> 1)];
      }
      // Deck boards along y; on a snow day white with the gaps showing.
      const u = x * 24,
        v = y * 24;
      const col = Math.floor(u / 6);
      if (u - col * 6 < 1) return snow ? SNOW[2] : C[2];
      if (snow) return SNOW[hash(col, Math.floor(v / 30), 4) > 0.7 ? 1 : 0];
      const a = v + noise(col, 1, 13) * 60;
      if (a - Math.floor(a / 60) * 60 < 1) return C[2];
      if (hash(col, Math.floor(a / 4), 2) > 0.95) return C[3];
      return hash(col, Math.floor(a / 60), 6) > 0.55 ? C[1] : C[0];
    }
    // The parapet's cap, then the tower's own face dropping straight down under it where it faces us.
    const dx = x - x1,
      dy = y - y1;
    if ((dx >= 0 && dx < 0.2 && y > y0 && y < y1 + 0.2) || (dy >= 0 && dy < 0.2 && x > x0 && x < x1 + 0.2)) return snow ? SNOW[0] : C[4];
    let depth = -1,
      run = 0,
      faceY = false;
    if (dy >= 0.2 && x - dy > x0 && x - dy < x1 + 0.2) {
      depth = (dy - 0.2) * 24;
      run = (x - dy) * 24;
      faceY = true;
    } else if (dx >= 0.2 && y - dx > y0 && y - dx < y1 + 0.2) {
      depth = (dx - 0.2) * 24;
      run = (y - dx) * 24;
    }
    if (depth >= 0) {
      if (depth < 2) return C[5];
      // Storeys of brick, a band of glass in each, darker and hazier further down.
      const storey = depth - Math.floor(depth / 16) * 16;
      const bay = run - Math.floor(run / 12) * 12;
      const deep = depth > 70;
      if (storey > 5 && storey < 13 && bay > 2 && bay < 10) return storey < 7 ? C[9] : C[8];
      return deep ? C[10] : faceY ? C[6] : C[7];
    }
    // Far below: haze gathering with distance, then blocks of roofs between streets.
    const far = -(x + y) - 6;
    if (far > 0 && hash(Math.floor(x * 24), Math.floor(y * 24), 17) < far * 0.09) return C[16];
    const bx = x * 1.9 + 0.3,
      by = y * 1.9 + 0.7;
    const ix = Math.floor(bx),
      iy = Math.floor(by);
    const fx = bx - ix,
      fy = by - iy;
    if (fx < 0.2 || fy < 0.2) return fx < 0.04 || fy < 0.04 ? C[18] : hash(Math.floor(x * 14), Math.floor(y * 14), 3) > 0.93 ? C[11] : C[17];
    const lx = fx < 0.58 ? 0 : 1,
      ly = fy < 0.58 ? 0 : 1;
    const lot = hash(ix * 2 + lx, iy * 2 + ly, 31);
    if (lot > 0.9) return hash(Math.floor(x * 7), Math.floor(y * 7), 9) > 0.45 ? C[15] : "#7f9478";
    // The shaded side of each roof's parapet, a few plant boxes and skylights.
    const ex = lx ? 1 - fx : 0.58 - fx,
      ey = ly ? 1 - fy : 0.58 - fy;
    if (ex < 0.05 || ey < 0.05) return C[22];
    if (hash(Math.floor(x * 8), Math.floor(y * 8), ix + iy) > 0.93) return C[23];
    return snow ? SNOW[2] : ROOFS[Math.floor(lot * 5)];
  };
}

/** Towers across the city: two ranks, hazy, their windows lit after dark; lamps on the streets far below. */
function skyline(v: Venue) {
  return (p: Painter, light: Light, width: number, horizon: number) => {
    const haze = mixHex(light.sky[2], "#c2c4c4", 0.35);
    const g = roomGround(v, width, horizon);
    const deep = g ? 40 : 24;
    const night = light.night > 0.4;
    const ranks: [string, number, number, number][] = [
      ["#a7afb8", 0.5, 10, 7],
      ["#7f8996", 0.22, 26, 11],
    ];
    ranks.forEach(([tone, mixHaze, hmax, seed], r) => {
      const body = mixHex(lit(light, tone, 0.5), haze, mixHaze);
      const side = mixHex(lit(light, mixHex(tone, INK, 0.25), 0.2), haze, mixHaze);
      const glass = mixHex(body, light.sky[1], 0.3);
      let x = -6 + r * 13;
      for (let i = 0; x < width; i++) {
        const w = 8 + Math.floor(noise(i, seed, 3) * (r ? 12 : 16));
        const tallOne = noise(i, seed + 2, 3) > 0.8;
        const h = 2 + Math.floor(noise(i, seed + 1, 3) * hmax) + (tallOne ? 12 : 0);
        const top = horizon - h;
        const bottom = horizon + deep - 12 + r * 12;
        p.rect(body, x, top, w, bottom - top);
        p.rect(side, x + w - 3, top, 3, bottom - top);
        // A stepped crown, a spire, or a flat roof with a plant room.
        const crown = noise(i, seed + 3, 3);
        if (crown > 0.75) {
          p.rect(body, x + 2, top - 3, w - 4, 3);
          p.rect(side, x + w - 4, top - 3, 2, 3);
          p.rect(body, x + Math.floor(w / 2) - 1, top - 9, 2, 6);
        } else if (crown > 0.5) p.rect(side, x + 2, top - 2, 4, 2);
        for (let wy = top + 2; wy < bottom - 4; wy += 3)
          for (let wx = x + 1; wx < x + w - 3; wx += 2) {
            if (night) {
              if (noise(wx, wy, seed + 5) < 0.26) p.rect(r ? "#f2c97c" : "#e0bc80", wx, wy, 1, 1);
            } else if (r === 1 && (wx + wy) % 4 === 0) p.rect(glass, wx, wy, 1, 1);
          }
        if (night && r === 1 && tallOne) p.rect("#e86a5a", x + Math.floor(w / 2), top - (crown > 0.75 ? 10 : 1), 1, 1);
        x += w + (noise(i, seed + 4, 3) > 0.6 ? 4 + Math.floor(noise(i, seed + 6, 3) * 10) : 1);
      }
      // Haze thickens toward their feet and thins again over the roofs below.
      const foot = horizon + deep - 12 + r * 12;
      for (let k = 0; k < 9; k++) p.dither(haze, 0, foot - 9 + k, width, 1, ((k + 1) / 9) * 0.75);
      if (r === 1) for (let k = 0; k < 10; k++) p.dither(haze, 0, foot + k, width, 1, 0.75 * (1 - k / 10));
    });
    weatherHaze(p, light, width, horizon, g ? 120 : 30);
    if (!g) return;
    // Streetlights and windows far below after dark.
    if (light.night > 0.3) {
      for (let i = 0; i < 520; i++) {
        const sx = Math.floor(hash(i, 1, 77) * width);
        const sy = horizon + 30 + Math.floor(hash(i, 2, 77) * 300);
        const tx = ((sx - g.ox) / g.hw + (sy - g.oy) / g.hh) / 2;
        const ty = ((sy - g.oy) / g.hh - (sx - g.ox) / g.hw) / 2;
        const c = v.outside.ground(tx, ty);
        if (c === C[17]) p.rect(i % 3 ? "#f2c97c" : "#e9e2c4", sx, sy, 1, 1);
        else if (ROOFS.includes(c) && i % 3 === 0) p.rect("#d9b47a", sx, sy, 1, 1);
        else if (c === C[8] && i % 2 === 0) p.rect("#f0cf8a", sx, sy, 2, 1);
      }
    }
  };
}

/** The skyline through the glass: the city far below, two ranks of towers, sky. */
const VIEW = litCache([
  ["#a7afb8", 0.5, 0], // 0 far tower
  ["#949ca6", 0.3, 0], // 1 far tower side
  ["#6e7886", 0.5, 0], // 2 near tower
  ["#5a6270", 0.2, 0], // 3 near tower side
  ["#8fa6b8", 0.8, 0], // 4 glass catching sky
  ["#a3a8aa", 0.5, 0], // 5 city below
  ["#8d949b", 0.4, 0], // 6 city below shade
  ["#f2c97c", 0.3, 1], // 7 lit window
  ["#3e4450", 0.1, 0], // 8 dark window
  ["#b9a48a", 0.6, 0], // 9 a brick tower
]);
const NEAR_TOP = new Float32Array(2048);
const NEAR_ID = new Int16Array(2048);
const NEAR_EDGE = new Uint8Array(2048);
const FAR_TOP = new Float32Array(2048);
const FAR_ID = new Int16Array(2048);
{
  let u = 0;
  for (let i = 0; u < 2048; i++) {
    const w = 12 + Math.floor(noise(i, 1, 61) * 26);
    const gap = noise(i, 2, 61) > 0.75 ? 6 + Math.floor(noise(i, 3, 61) * 10) : 0;
    const top = 0.5 + noise(i, 4, 61) * 0.42 + (noise(i, 5, 61) > 0.85 ? 0.08 : 0);
    for (let k = 0; k < w && u < 2048; k++, u++) {
      NEAR_TOP[u] = top;
      NEAR_ID[u] = i;
      NEAR_EDGE[u] = k > w - 5 ? 2 : k === 0 ? 1 : 0;
    }
    for (let k = 0; k < gap && u < 2048; k++, u++) NEAR_TOP[u] = 0;
  }
  u = 0;
  for (let i = 0; u < 2048; i++) {
    const w = 8 + Math.floor(noise(i, 1, 62) * 16);
    const top = 0.44 + noise(i, 4, 62) * 0.2;
    for (let k = 0; k < w && u < 2048; k++, u++) {
      FAR_TOP[u] = top;
      FAR_ID[u] = i;
    }
  }
}

function loftView(u: number, v: number, light: Light, _wall: WallSide, height: number): string {
  const c = VIEW(light);
  const [s0, s1, s2] = light.sky;
  const iu = Math.floor(u) & 2047;
  const night = light.night > 0.4;
  const pv = v * height;
  // Near towers.
  const nt = NEAR_TOP[iu];
  if (nt > 0 && v < nt) {
    const id = NEAR_ID[iu];
    const edge = NEAR_EDGE[iu];
    const brick = id % 5 === 3;
    if (edge === 2) return c[3];
    const row = Math.floor(pv / 4);
    const col = Math.floor(u / 3);
    const inWin = pv - row * 4 > 1.2 && u - col * 3 > 0.8;
    if (v > nt - 0.03) return brick ? c[9] : c[2];
    if (inWin) {
      if (night) return hash(col, row, id) < 0.33 ? c[7] : c[8];
      return brick ? c[8] : c[4];
    }
    return brick ? c[9] : c[2];
  }
  // Far towers in the haze.
  if (v < FAR_TOP[iu]) {
    if (night && Math.floor(pv) % 3 === 0 && Math.floor(u) % 2 === 0 && hash(Math.floor(u), Math.floor(pv), FAR_ID[iu]) < 0.25) return c[7];
    return FAR_ID[iu] % 3 === 0 ? c[1] : c[0];
  }
  // The city far below, then sky.
  if (v < 0.4) return v < 0.3 && hash(Math.floor(u / 2), Math.floor(pv / 2), 5) > 0.7 ? c[6] : c[5];
  return v > 0.82 ? s0 : v > 0.6 ? s1 : s2;
}

// ---------------------------------------------------------------- walls

/** The flight board: the day's tasting flights, four small cups to a row. */
function flightBoard(wall: WallSide, at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const BW = 40,
        BH = 34;
      wallBox(p, place, -2, -2, BW + 4, BH + 4, lit(light, STEEL, 0.2));
      wallBox(p, place, 0, 0, BW, BH, lit(light, "#2a2a2e", 0.1));
      wallWord(p, place, 4, BH - 3, "FLIGHTS", lit(light, "#efe4cc", 0.4, 0.6));
      wallRun(p, place, 4, BH - 10, BW - 8, lit(light, "#6a6870", 0.2));
      const flights = [
        ["#c98a4b", "#b8573f", "#7d3a31", "#e2c89a"],
        ["#a9c98c", "#6f9a5a", "#c9d9a0", "#e2c89a"],
        ["#c3a0cf", "#e8b0b8", "#f2d58a", "#e2c89a"],
      ];
      flights.forEach((cups, i) => {
        const up = BH - 15 - i * 7;
        cups.forEach((cup, k) => {
          wallBox(p, place, 4 + k * 5, up - 3, 4, 4, lit(light, "#efe4cc", 0.3));
          wallBox(p, place, 5 + k * 5, up - 2, 2, 2, lit(light, cup, 0.4, 0.3));
        });
        wallWord(p, place, 27, up, `$${8 + i * 2}`, lit(light, "#f2d58a", 0.4, 0.6));
      });
    },
  };
}

/** A neon TEA on the brick, twice the small face's size. */
function neonSign(wall: WallSide, at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const on = light.night > 0.2;
      const tube = on ? "#ffd0c4" : lit(light, NEON, 0.8, 1);
      const halo = on ? NEON : lit(light, mixHex(NEON, BRICK, 0.4), 0.4);
      const G: Record<string, number[]> = { T: [7, 2, 2, 2, 2], E: [7, 4, 6, 4, 7], A: [2, 5, 7, 5, 5] };
      // Brackets, then each lit cell drawn as a 2 by 2 tube with a halo round it.
      wallBox(p, place, 2, 4, 1, 4, lit(light, STEEL, 0.2));
      wallBox(p, place, 26, 4, 1, 4, lit(light, STEEL, 0.2));
      const cells: [number, number][] = [];
      [..."TEA"].forEach((ch, n) =>
        G[ch].forEach((bits, r) => {
          for (let c = 0; c < 3; c++) if (bits & (4 >> c)) cells.push([n * 10 + c * 2, 14 - r * 2]);
        }),
      );
      if (on) p.alpha(0.35 * light.night, () => cells.forEach(([a, u]) => wallBox(p, place, a - 1, u - 1, 4, 4, halo)));
      cells.forEach(([a, u]) => wallBox(p, place, a, u, 2, 2, tube));
    },
  };
}

/** The black steel beam along the ceiling line, its bottom flange catching the light, rivets on its web. */
function beam(wall: WallSide, length: number, z: number): WallItem {
  return {
    wall,
    at: 0,
    z,
    draw(p, light, place) {
      const len = length * 24;
      wallBox(p, place, 0, 0, len, 12, lit(light, STEEL, 0.1));
      wallRun(p, place, 0, 0, len, lit(light, STEEL_HI, 0.4));
      wallRun(p, place, 0, 1, len, lit(light, "#46454c", 0.3));
      wallRun(p, place, 0, 11, len, lit(light, STEEL_HI, 0.3));
      wallRun(p, place, 0, -1, len, lit(light, INK, 0));
      for (let a = 6; a < len; a += 12) {
        const q = wallAt(place, a, 6);
        p.rect(lit(light, "#6a6970", 0.4), q.x, q.y, 1, 1);
      }
    },
  };
}

/** Horizontal steel muntins across a tall window. */
function muntins(win: WindowSpec, heights: number[]): WallItem {
  return {
    wall: win.wall,
    at: win.at,
    z: 0,
    draw(p, light, place) {
      const w = Math.round(win.width * 24);
      for (const h of heights) wallRun(p, place, 0, h, w, lit(light, STEEL, 0.2));
    },
  };
}

/** A framed record sleeve on the brick. */
function sleeve(wall: WallSide, at: number, z: number, tone: string): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wallBox(p, place, -1, -1, 16, 16, lit(light, STEEL, 0.1));
      wallBox(p, place, 0, 0, 14, 14, lit(light, tone, 0.4));
      const c = wallAt(place, 7, 7);
      p.oval(lit(light, "#26242a", 0.2), c.x + (place.dir > 0 ? 2 : -2), c.y, 4, 4);
      p.rect(lit(light, NEON, 0.4), c.x + (place.dir > 0 ? 2 : -2), c.y, 1, 1);
    },
  };
}

// ---------------------------------------------------------------- props

/** A fiddle-leaf fig in a big concrete pot. */
function figProp(key: string, x: number, y: number, tall = 56): PropSpec {
  return {
    key,
    x,
    y,
    height: tall + 4,
    pad: 10,
    draw(p, g, light) {
      const f = faceLight(light, 0.3);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 8, 2));
      p.rect(lit(light, INK, 0), b.x - 7, b.y - 12, 15, 12);
      p.rect(lit(light, CONCRETE, f.left + 0.1), b.x - 6, b.y - 12, 13, 11);
      p.rect(lit(light, mixHex(CONCRETE, CREAM, 0.3), 0.5), b.x - 6, b.y - 12, 3, 11);
      p.rect(lit(light, mixHex(CONCRETE, INK, 0.25), 0.1), b.x + 4, b.y - 12, 3, 11);
      p.rect(lit(light, "#4a3a30", 0.1), b.x - 5, b.y - 13, 11, 1);
      const trunk = lit(light, "#6a4c3c", 0.2);
      p.line(trunk, b.x, b.y - 12, b.x - 1, b.y - tall + 14);
      p.line(trunk, b.x, b.y - 24, b.x + 5, b.y - tall + 18);
      const dark = lit(light, "#3f6040", f.left * 0.4);
      const mid = lit(light, "#5a8650", f.top * 0.6);
      const hi = lit(light, "#8db870", f.top);
      // Big fiddle leaves crowded up three branches, each with a darker rib.
      const leaves: [number, number][] = [];
      for (let k = 0; k < 22; k++) {
        const t = k / 21;
        const side = k % 3 === 0 ? -1 : k % 3 === 1 ? 1 : 0;
        leaves.push([Math.round(side * (4 + Math.sin(k * 1.7) * 4) + Math.sin(k) * 2), Math.round(-tall + 6 + t * 34 + Math.cos(k * 2.3) * 2)]);
      }
      leaves.forEach(([dx, dy], i) => {
        p.oval(INK, b.x + dx, b.y + dy, 5, 3);
        p.oval(i % 4 === 0 ? hi : i % 2 ? mid : dark, b.x + dx, b.y + dy - 1, 4, 2);
        p.rect(dark, b.x + dx - 1, b.y + dy - 1, 3, 1);
        if (i % 4 === 0) p.rect(hi, b.x + dx - 2, b.y + dy - 2, 2, 1);
      });
    },
  };
}

/** A low sofa against the wall, facing into the room. */
function sofaProp(key: string, x: number, y: number, d: number): PropSpec {
  // Declared one tile at its far end (padded to fit) so it sorts behind anyone walking past its front.
  return {
    key,
    x,
    y,
    w: 1,
    d: 1,
    pad: 38,
    height: 22,
    draw(p, g, light) {
      const share = 0.3;
      const cloth = PLUM;
      const st = { top: mixHex(cloth, CREAM, 0.12), left: cloth, right: mixHex(cloth, INK, 0.2) };
      // Black steel legs, the base, the back along the wall, two arms, seat cushions.
      for (const v of [0.15, d - 0.2]) isoBox(p, g, light, 0.75, v, 0.06, 0.06, 3, { top: STEEL, ink: "" }, 0, share);
      isoBox(p, g, light, 0.12, 0.08, 0.78, d - 0.16, 6, st, 3, share);
      isoBox(p, g, light, 0.12, 0.08, 0.22, d - 0.16, 12, st, 9, share);
      isoBox(p, g, light, 0.12, 0.08, 0.78, 0.2, 6, st, 9, share);
      isoBox(p, g, light, 0.12, d - 0.28, 0.78, 0.2, 6, st, 9, share);
      const n = 2;
      const cw = (d - 0.56) / n;
      for (let k = 0; k < n; k++) isoBox(p, g, light, 0.34, 0.28 + k * cw + 0.02, 0.54, cw - 0.04, 3, { top: mixHex(cloth, CREAM, 0.2), left: mixHex(cloth, CREAM, 0.05), right: cloth }, 9, share);
      // A mustard cushion and a folded throw.
      const c = project(g, 0.3, d * 0.3, 18);
      p.rect(lit(light, INK, 0), c.x - 4, c.y - 6, 9, 7);
      p.rect(lit(light, "#d1a23f", 0.4), c.x - 3, c.y - 5, 7, 5);
      const t = project(g, 0.55, d * 0.72, 13);
      p.rect(lit(light, "#e4d8c0", 0.4), t.x - 5, t.y - 2, 10, 3);
      p.rect(lit(light, "#b9573f", 0.4), t.x - 5, t.y, 10, 1);
    },
  };
}

/** A low oak credenza with a record player, records leaning against it. */
function recordsProp(key: string, x: number, y: number): PropSpec {
  // Two tiles long, declared as one (padded) so the chef walking in front of it is drawn over it.
  return {
    key,
    x,
    y,
    w: 1,
    d: 1,
    pad: 26,
    height: 30,
    draw(p, g, light) {
      const share = 0.3;
      for (const u of [0.25, 1.75]) isoBox(p, g, light, u, 0.45, 0.06, 0.06, 4, { top: STEEL, ink: "" }, 0, share);
      isoBox(p, g, light, 0.15, 0.12, 1.7, 0.42, 13, { top: mixHex(OAK, CREAM, 0.15), left: OAK, right: mixHex(OAK, INK, 0.2) }, 4, share);
      const f = faceLight(light, share);
      for (const s of [0.33, 0.66]) {
        const a = project(g, 0.15 + 1.7 * s, 0.54, 5),
          b = project(g, 0.15 + 1.7 * s, 0.54, 16);
        p.line(lit(light, mixHex(OAK, INK, 0.35), f.left * 0.5), a.x, a.y, b.x, b.y);
      }
      // Records in the left bay.
      for (let k = 0; k < 6; k++) {
        const q = project(g, 0.25 + k * 0.08, 0.54, 6);
        p.rect(lit(light, ["#3a3540", "#b8573f", "#e2c89a", "#5f7a8a", "#2b2a30", "#c9a24a"][k], 0.3), q.x, q.y - 8, 1, 8);
      }
      // The turntable.
      isoBox(p, g, light, 0.9, 0.16, 0.62, 0.34, 3, { top: "#3a3438", left: "#2a2628", right: "#242022" }, 17, share);
      const pl = project(g, 1.14, 0.33, 20);
      p.oval(lit(light, "#1f1d22", 0.2), pl.x, pl.y, 6, 3);
      p.oval(lit(light, "#3e3a44", 0.4), pl.x - 1, pl.y - 1, 2, 1);
      p.rect(lit(light, NEON, 0.4), pl.x, pl.y, 1, 1);
      const arm = project(g, 1.42, 0.2, 21);
      p.line(lit(light, "#c9c6c0", 0.5), arm.x, arm.y, pl.x + 3, pl.y);
      // A sleeve leaning against the cabinet, a small cactus on top.
      const sl = project(g, 1.95, 0.6, 0);
      p.rect(lit(light, INK, 0), sl.x - 1, sl.y - 12, 11, 12);
      p.rect(lit(light, "#e2c89a", 0.4), sl.x, sl.y - 11, 9, 10);
      p.oval(lit(light, "#b8573f", 0.4), sl.x + 4, sl.y - 6, 3, 3);
      const ca = project(g, 0.45, 0.32, 17);
      p.rect(lit(light, INK, 0), ca.x - 3, ca.y - 4, 7, 4);
      p.rect(lit(light, "#d9a17a", 0.4), ca.x - 2, ca.y - 3, 5, 3);
      p.rect(lit(light, INK, 0), ca.x - 2, ca.y - 11, 5, 7);
      p.rect(lit(light, "#6c8f5a", 0.4), ca.x - 1, ca.y - 10, 3, 6);
      p.rect(lit(light, "#a6c48c", 0.5), ca.x - 1, ca.y - 10, 1, 5);
    },
  };
}

/** A snake plant in a black pot. */
function snakePlantProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 38,
    draw(p, g, light) {
      const f = faceLight(light, 0.3);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 7, 2));
      p.rect(lit(light, INK, 0), b.x - 6, b.y - 11, 13, 11);
      p.rect(lit(light, "#3a383e", 0.3), b.x - 5, b.y - 11, 11, 10);
      p.rect(lit(light, "#5a585e", 0.5), b.x - 5, b.y - 11, 2, 10);
      const blades: [number, number, number][] = [[-4, 22, -1], [-1, 30, 0], [2, 26, 1], [5, 20, 1], [0, 18, -1], [-3, 14, 0]];
      blades.forEach(([dx, h, lean], i) => {
        for (let k = 0; k < h; k++) {
          const x = b.x + dx + Math.round((lean * k) / 10);
          const y = b.y - 11 - k;
          const w = k > h - 4 ? 1 : 2;
          p.rect(lit(light, INK, 0), x - 1, y, w + 2, 1);
          p.rect(lit(light, k % 5 === 0 ? "#9cbf7a" : i % 2 ? "#4f7a4a" : "#5f8a56", f.top * 0.7), x, y, w, 1);
        }
      });
    },
  };
}

/** A monstera spilling out of a woven basket. */
function monsteraProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 40,
    pad: 10,
    draw(p, g, light) {
      const f = faceLight(light, 0.3);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 9, 2));
      p.rect(lit(light, INK, 0), b.x - 8, b.y - 11, 17, 11);
      p.rect(lit(light, "#c9a36e", f.left + 0.2), b.x - 7, b.y - 11, 15, 10);
      for (let r = 0; r < 4; r++) p.rect(lit(light, "#a07e4e", 0.2), b.x - 7, b.y - 9 + r * 2, 15, 1);
      const dark = lit(light, "#3f6040", f.left * 0.3);
      const mid = lit(light, "#5e8a55", f.top * 0.6);
      const hi = lit(light, "#a9c995", f.top);
      const leaves: [number, number, number][] = [[-10, -18, 6], [8, -20, 7], [-2, -28, 7], [10, -32, 5], [-9, -32, 5], [2, -16, 5]];
      leaves.forEach(([dx, dy, r], i) => {
        p.line(dark, b.x, b.y - 11, b.x + dx, b.y + dy + r);
        p.oval(INK, b.x + dx, b.y + dy, r + 1, r);
        p.oval(i % 2 ? mid : dark, b.x + dx, b.y + dy, r, r - 1);
        p.dither(hi, b.x + dx - r + 1, b.y + dy - r + 1, r, r - 1, 0.4, i);
        // The splits in the leaf.
        p.line(lit(light, INK, 0), b.x + dx, b.y + dy, b.x + dx + (dx > 0 ? r : -r), b.y + dy - 1);
      });
    },
  };
}

/** A walnut floor speaker with a trailing pothos on it. */
function speakerProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 40,
    pad: 6,
    draw(p, g, light) {
      const share = 0.3;
      const wood = "#6e4a34";
      isoBox(p, g, light, 0.25, 0.3, 0.5, 0.42, 28, { top: mixHex(wood, CREAM, 0.15), left: wood, right: mixHex(wood, INK, 0.25) }, 0, share);
      const a = project(g, 0.5, 0.72, 20);
      p.oval(lit(light, "#2a2628", 0.2), a.x - 3, a.y + 1, 3, 3);
      p.oval(lit(light, "#4a4448", 0.3), a.x - 3, a.y + 1, 1, 1);
      const b2 = project(g, 0.5, 0.72, 8);
      p.oval(lit(light, "#2a2628", 0.2), b2.x - 3, b2.y + 1, 5, 5);
      p.oval(lit(light, "#4a4448", 0.3), b2.x - 3, b2.y + 1, 2, 2);
      const t = project(g, 0.5, 0.5, 28);
      p.rect(lit(light, INK, 0), t.x - 4, t.y - 6, 9, 6);
      p.rect(lit(light, "#e9e3d4", 0.4), t.x - 3, t.y - 5, 7, 4);
      const leaf = lit(light, "#5e8a55", 0.4);
      const leaf2 = lit(light, "#8db870", 0.5);
      for (let k = 0; k < 14; k++) {
        p.rect(k % 3 ? leaf : leaf2, t.x - 4 - Math.round(k * 0.4), t.y - 6 + k * 2 + (k % 2), 2, 2);
        if (k < 9) p.rect(k % 2 ? leaf : leaf2, t.x + 3 + (k % 2), t.y - 7 + k * 2, 2, 2);
      }
      for (const [dx, dy] of [[-2, -9], [1, -10], [3, -8]]) p.rect(leaf2, t.x + dx, t.y + dy, 2, 2);
    },
  };
}

/** A berber rug under the sofa: cream, a pale border, a charcoal diamond lattice. Lit like the floor under it. */
function rug(venue: () => Venue, x: number, y: number, w: number, d: number) {
  return floorShader(venue, [x, y, x + w, y + d], (tx, ty) => {
    const u = tx - x,
      v = ty - y;
    if (u < 0.08 || v < 0.08 || w - u < 0.08 || d - v < 0.08) return "#cfc3aa";
    if (u < 0.2 || v < 0.2 || w - u < 0.2 || d - v < 0.2) return "#e6dcc6";
    const a = (u + v * 0.55) * 2.2,
      b = (u - v * 0.55) * 2.2;
    if (Math.abs(a - Math.round(a)) < 0.06 || Math.abs(b - Math.round(b)) < 0.06) return "#4a4448";
    return "#e6dcc6";
  });
}

// ---------------------------------------------------------------- the terrace

/** A glass rail panel between steel posts, one tile long, along x or along y. */
function railProp(key: string, x: number, y: number, alongX: boolean, len = 1, glazed = true): PropSpec {
  return {
    key,
    x,
    y,
    w: alongX ? len : 0.1,
    d: alongX ? 0.1 : len,
    height: 26,
    pad: 7,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const P = (t: number, z: number) => (alongX ? project(g, t, 0.05, z) : project(g, 0.05, t, z));
      const glass = mixHex(light.sky[1], "#9fc0c8", 0.4);
      for (let k = 0; k < len; k++) {
        const a = P(k, 2),
          b = P(k + 1, 2),
          c = P(k + 1, 20),
          d = P(k, 20);
        if (glazed) {
          p.alpha(0.3, () => p.poly(glass, [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]));
          p.line(lit(light, "#d6e4e6", 0.8), d.x + 2, d.y + 3, d.x + 6, d.y + 8);
        }
        const post = P(k, 0);
        p.rect(lit(light, STEEL, 0.2), post.x - 1, post.y - 22, 2, 22);
      }
      const a = P(0, 2),
        b = P(len, 2),
        c = P(len, 20),
        d = P(0, 20);
      p.line(lit(light, STEEL_HI, f.top), d.x, d.y - 1, c.x, c.y - 1);
      p.line(lit(light, STEEL, 0.2), d.x, d.y, c.x, c.y);
      p.line(lit(light, STEEL, 0.2), a.x, a.y, b.x, b.y);
    },
  };
}

/** A long cor-ten planter of grasses and lavender. */
function planterProp(key: string, x: number, y: number, alongX: boolean, len = 2): PropSpec {
  return {
    key,
    x,
    y,
    w: alongX ? len : 1,
    d: alongX ? 1 : len,
    height: 34,
    pad: 8,
    shadow: "none",
    draw(p, g, light) {
      const W = alongX ? len - 0.2 : 0.5;
      const D = alongX ? 0.5 : len - 0.2;
      const u0 = alongX ? 0.1 : 0.25;
      const v0 = alongX ? 0.25 : 0.1;
      // Its own soft shadow on the deck, cast away from the sun.
      const sh = [project(g, u0, v0 + D), project(g, u0 + W, v0 + D), project(g, u0 + W, v0), project(g, u0 + W + 0.25, v0 + 0.1), project(g, u0 + W + 0.25, v0 + D + 0.25), project(g, u0 + 0.1, v0 + D + 0.25)];
      p.alpha(0.18 + 0.12 * light.sun, () => p.poly(INK, sh.flatMap((q) => [q.x, q.y])));
      isoBox(p, g, light, u0, v0, W, D, 14, { top: "#5a4a3a", left: "#9a5a36", right: "#7e4a2e" }, 0);
      const f = faceLight(light, 1);
      const n = Math.round(len * 7);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const q = project(g, u0 + (alongX ? W * t : W / 2), v0 + (alongX ? D / 2 : D * t), 14);
        const h = 10 + ((k * 7) % 9);
        // Grasses green in spring and summer, amber in autumn, dry straw in winter.
        const season = light.season;
        const grass = season === "autumn" ? (k % 2 ? "#c9904a" : "#b8a060") : season === "winter" ? "#b9ae94" : "#8aa070";
        const bloom = season === "winter" ? "#9a9080" : season === "autumn" ? "#a08aa0" : "#8a7aa8";
        const tone = k % 4 === 1 ? bloom : k % 3 === 0 ? "#c9b98a" : grass;
        for (let i = 0; i < h; i++) {
          const sway = Math.round(Math.sin(i / 4 + k) * (i / 6));
          p.rect(lit(light, i > h - 4 && k % 4 === 1 && season !== "winter" ? "#a898c8" : tone, f.top * (0.6 + (i / h) * 0.4)), q.x + sway, q.y - i, 1, 1);
        }
        p.rect(lit(light, "#6f8458", f.left * 0.5), q.x - 1, q.y - 3, 3, 3);
      }
    },
  };
}

/** Two bistro chairs and a small round table on the deck. */
function bistroProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 24,
    shadow: "round",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const chair = (u: number, v: number) => {
        const c = project(g, u, v, 0);
        p.line(lit(light, STEEL, 0.2), c.x - 3, c.y, c.x - 3, c.y - 9);
        p.line(lit(light, STEEL, 0.2), c.x + 3, c.y, c.x + 3, c.y - 9);
        p.rect(lit(light, "#4f7a6a", f.top), c.x - 4, c.y - 10, 9, 2);
        p.rect(lit(light, "#4f7a6a", f.left), c.x - 4, c.y - 17, 9, 6);
        p.rect(lit(light, INK, 0), c.x - 4, c.y - 18, 9, 1);
      };
      chair(0.25, 0.3);
      const t = project(g, 0.55, 0.55, 0);
      p.alpha(0.3, () => p.oval(INK, t.x, t.y, 6, 2));
      p.rect(lit(light, STEEL, 0.2), t.x, t.y - 13, 1, 13);
      p.oval(lit(light, INK, 0), t.x, t.y - 14, 7, 3);
      p.oval(lit(light, "#e9e3d4", f.top), t.x, t.y - 15, 6, 2);
      p.rect(lit(light, "#b8573f", 0.5), t.x - 2, t.y - 19, 3, 3);
      chair(0.85, 0.75);
    },
  };
}

/** The rooftop's water tank on its steel legs. */
function waterTowerProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    w: 2,
    d: 2,
    height: 120,
    pad: 6,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const c = project(g, 1, 1, 0);
      const legs = lit(light, "#3a3a40", 0.2);
      for (const dx of [-14, -5, 5, 14]) p.rect(legs, c.x + dx, c.y - 64 + Math.abs(dx) / 3, 2, 64 - Math.abs(dx) / 3);
      p.line(legs, c.x - 14, c.y - 50, c.x + 15, c.y - 30);
      p.line(legs, c.x + 15, c.y - 50, c.x - 14, c.y - 30);
      p.rect(legs, c.x - 16, c.y - 66, 33, 3);
      // The wooden tank, its hoops, a conical cap.
      const wood = "#8a6a4e";
      const top = c.y - 100;
      p.rect(lit(light, INK, 0), c.x - 15, top, 31, 36);
      p.rect(lit(light, wood, f.left), c.x - 14, top, 29, 35);
      p.rect(lit(light, mixHex(wood, INK, 0.3), f.right), c.x + 6, top, 9, 35);
      for (let k = 0; k < 29; k += 3) p.rect(lit(light, mixHex(wood, INK, 0.2), 0.2), c.x - 14 + k, top, 1, 35);
      for (const hy of [6, 16, 26]) p.rect(lit(light, "#3a3a40", 0.3), c.x - 14, top + hy, 29, 1);
      p.poly(lit(light, "#4a4448", f.top), [c.x - 17, top, c.x, top - 14, c.x + 18, top]);
      p.line(lit(light, INK, 0), c.x - 17, top, c.x, top - 14);
      p.line(lit(light, INK, 0), c.x, top - 14, c.x + 18, top);
      p.rect(lit(light, "#4a4448", 0.3), c.x, top - 18, 1, 4);
    },
  };
}

/** A café parasol, furled after dark and in rain, snow or wind. */
function parasolProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 54,
    pad: 22,
    shadow: "round",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const b = project(g, 0.5, 0.5, 0);
      p.rect(lit(light, STEEL, 0.2), b.x - 3, b.y - 2, 7, 2);
      p.rect(lit(light, "#d9d2c2", 0.4), b.x, b.y - 46, 1, 44);
      const cloth = "#e9e1cf";
      if (light.night > 0.5 || light.weather === "rain" || light.weather === "snow" || light.weather === "wind") {
        p.poly(lit(light, cloth, f.left), [b.x - 2, b.y - 48, b.x + 3, b.y - 48, b.x + 1, b.y - 22]);
        return;
      }
      const ribs = 8;
      for (let k = 0; k < ribs; k++) {
        const a0 = (k / ribs) * Math.PI * 2,
          a1 = ((k + 1) / ribs) * Math.PI * 2;
        const pt = (a: number) => [b.x + Math.cos(a) * 26, b.y - 40 + Math.sin(a) * 11];
        const [x0, y0] = pt(a0);
        const [x1, y1] = pt(a1);
        const front = Math.sin((a0 + a1) / 2) > 0;
        p.poly(lit(light, k % 2 ? cloth : "#c9573f", front ? f.left * 0.6 + 0.2 : f.top), [b.x, b.y - 50, x0, y0, x1, y1]);
      }
    },
  };
}

// ---------------------------------------------------------------- the street view

/**
 * The loft from its own roof terrace, the skyline behind: a brick-and-steel
 * penthouse with floor-to-ceiling steel-framed glass, the name on a black
 * plate along the beam, the neon TEA on a brick pier, folding doors open
 * onto the deck, the water tank on the roof and planters either side.
 */
function penthouseFront(p: Painter, light: Light, box: FrontBox) {
  const L = (hex: string, f = 0.5, g = 0) => light.lit(hex, f, g);
  const { x, w, ground } = box;
  const night = light.night > 0.4;
  const b0 = x + 6,
    b1 = x + w - 6;
  const top = 40;
  const width = x * 2 + w;
  // The terrace: its deck running back to the glass rail at the roof's edge, the city below beyond it.
  const rail = ground - 30;
  for (let y = rail, k = 0; y < 150; k++) {
    const hgt = 1 + Math.floor(k / 3);
    p.rect(L(k % 2 ? "#98846f" : "#8f7b69", 0.6), 0, y, width, hgt);
    p.rect(L("#6f5d50", 0.3), 0, y + hgt, width, 1);
    y += hgt + 1;
  }
  p.alpha(0.3, () => p.rect(mixHex(light.sky[1], "#9fc0c8", 0.4), 0, rail - 14, width, 14));
  p.rect(L(STEEL_HI, 0.6), 0, rail - 15, width, 1);
  p.rect(L(STEEL, 0.3), 0, rail - 14, width, 1);
  for (let xx = 4; xx < width; xx += 26) p.rect(L(STEEL, 0.3), xx, rail - 15, 2, 15);
  // The water tank on the roof, behind the parapet.
  const tx = b1 - 30;
  const legs = L("#3a3a40", 0.2);
  for (const dx of [-9, -3, 3, 9]) p.rect(legs, tx + dx, top - 12, 1, 12);
  p.rect(L(INK, 0), tx - 11, top - 34, 23, 22);
  p.rect(L("#8a6a4e", 0.6), tx - 10, top - 34, 21, 21);
  p.rect(L(mixHex("#8a6a4e", INK, 0.3), 0.3), tx + 5, top - 34, 6, 21);
  for (const hy of [4, 10, 16]) p.rect(L("#3a3a40", 0.3), tx - 10, top - 34 + hy, 21, 1);
  p.poly(L("#4a4448", 0.6), [tx - 12, top - 34, tx, top - 44, tx + 12, top - 34]);
  // Brick body.
  const bricks = oldBrick();
  for (let y = top; y < ground; y++)
    for (let xx = b0; xx < b1; xx++) p.rect(L(bricks.colors[bricks.at(xx - b0, ground - y)], 0.45), xx, y, 1, 1);
  // The steel beam along the top, the name on a black plate bolted to it.
  p.rect(L(INK, 0), b0 - 4, top - 4, b1 - b0 + 8, 11);
  p.rect(L(STEEL, 0.3), b0 - 3, top - 3, b1 - b0 + 6, 9);
  p.rect(L(STEEL_HI, 0.6), b0 - 3, top - 3, b1 - b0 + 6, 1);
  for (let xx = b0; xx < b1; xx += 8) p.rect(L("#6a6970", 0.5), xx, top + 3, 1, 1);
  const name = box.name.toUpperCase();
  const pw = bigWidth(name) + 10;
  const px0 = Math.round((b0 + b1) / 2 - pw / 2);
  p.rect(L(INK, 0), px0 - 1, top + 8, pw + 2, 13);
  p.rect(L("#2a2a2e", 0.3), px0, top + 9, pw, 11);
  // The neon and the bulbs burn only while the loft is open.
  const lamplit = night && box.open;
  const neon = box.open ? (night ? "#ffd0c4" : L(NEON, 0.8, 1)) : L(mixHex(NEON, INK, 0.45), 0.4);
  bigWord(p, name, neon, px0 + 5, top + 11);
  if (lamplit) p.alpha(0.18 * light.night, () => p.rect(NEON, px0 - 2, top + 7, pw + 4, 15));
  // Two bays of steel-framed glass between brick piers; the right one is the doors, folded open.
  const pier = 12;
  const g0 = b0 + pier,
    g1 = b1 - pier;
  const mid = Math.round(g0 + (g1 - g0) * 0.58);
  const gy0 = top + 25,
    gy1 = ground - 2;
  const inside = box.open ? (night ? "#f2cf86" : L("#d8cdb8", 0.4)) : L("#3e4450", 0.2);
  const sky = mixHex(light.sky[1], "#9fb4c0", 0.3);
  for (const [a, b] of [[g0, mid - 3], [mid + 3, g1]]) {
    p.rect(L(INK, 0), a - 1, gy0 - 1, b - a + 2, gy1 - gy0 + 1);
    p.rect(inside, a, gy0, b - a, gy1 - gy0);
    // By day the glass gives back the sky over the lower panes' reflections.
    if (!night) p.dither(sky, a, gy0, b - a, Math.round((gy1 - gy0) * 0.45), 0.5);
  }
  // Inside: bulbs on cords, a shelf of tins, a plant, the day's cup on the sill.
  for (const bx of [g0 + 14, g0 + 40, mid + 18]) {
    p.rect(L("#26242a", 0), bx, gy0, 1, 10);
    p.rect(lamplit ? "#fff0c8" : L("#e9dfc8", 0.6), bx - 1, gy0 + 10, 3, 3);
    if (lamplit) p.alpha(0.3 * light.night, () => p.oval("#ffd890", bx, gy0 + 11, 6, 5));
  }
  if (box.open) {
    const tins = ["#b8573f", "#d8a05c", "#6f9a5a", "#8e6a9e", "#e2c89a"];
    p.rect(L(OAK, 0.4), g0 + 4, gy0 + 22, mid - g0 - 12, 2);
    for (let k = 0; k < 8; k++) p.rect(L(tins[k % tins.length], 0.4), g0 + 6 + k * 6, gy0 + 17, 3, 5);
    p.rect(L("#5a8650", 0.5), mid - 14, gy1 - 18, 7, 9);
    p.rect(L("#3a383e", 0.3), mid - 13, gy1 - 9, 5, 7);
  }
  // Steel glazing bars: a grid over the fixed bay, a folded stack of door leaves at the right bay's edge.
  const bar = L(STEEL, 0.25);
  for (let xx = g0; xx < mid - 3; xx += 12) p.rect(bar, xx, gy0, 2, gy1 - gy0);
  for (const yy of [gy0, gy0 + 14, gy1 - 13]) p.rect(bar, g0, yy, mid - 3 - g0, 2);
  p.rect(bar, mid - 5, gy0, 2, gy1 - gy0);
  for (let k = 0; k < 4; k++) p.rect(k % 2 ? L(STEEL_HI, 0.5) : bar, g1 - 6 + k * 2, gy0, 2, gy1 - gy0);
  p.rect(bar, mid + 3, gy0, g1 - mid - 3, 2);
  // A steel sill across the fixed bay, the day's cup on it in front of the bars.
  p.rect(L(STEEL, 0.3), g0, gy1 - 12, mid - 3 - g0, 2);
  if (box.display && box.open) displayCup(p, light, box.display, Math.round((g0 + mid) / 2) - 4, gy1 - 12);
  const tag = box.open ? "OPEN" : "SHUT";
  const tgx = Math.round((mid + g1) / 2) - 9;
  p.rect(L(INK, 0), tgx, gy0 + 6, 18, 8);
  p.rect(box.open ? L("#7f9a72", 0.6, 0.6) : L("#c4574a", 0.6), tgx + 1, gy0 + 7, 16, 6);
  word(p, tag, L(CREAM, 0.6), tgx + 2, gy0 + 8);
  // The neon TEA on the left pier, doubled in size, glowing after dark.
  const nx = b0 + 2,
    ny = gy0 + 4;
  const tube = box.open ? (night ? "#ffd0c4" : L(NEON, 0.9, 1)) : L(mixHex(NEON, INK, 0.45), 0.4);
  const G: Record<string, number[]> = { T: [7, 2, 2, 2, 2], E: [7, 4, 6, 4, 7], A: [2, 5, 7, 5, 5] };
  [..."TEA"].forEach((ch, n) =>
    G[ch].forEach((bits, r) => {
      for (let c = 0; c < 3; c++) if (bits & (4 >> c)) p.rect(tube, nx + c * 2, ny + n * 12 + r * 2, 2, 2);
    }),
  );
  if (lamplit) p.alpha(0.3 * light.night, () => p.rect(NEON, nx - 2, ny - 2, 10, 38));
  // Planters of grasses either side, standing on the deck.
  for (const [a, b] of [[x - 22, b0 - 2], [b1 + 2, x + w + 22]]) {
    p.rect(L(INK, 0), a, ground - 14, b - a, 14);
    p.rect(L("#9a5a36", 0.5), a + 1, ground - 13, b - a - 2, 13);
    p.rect(L("#b8703f", 0.7), a + 1, ground - 13, b - a - 2, 1);
    for (let k = a + 2; k < b - 2; k += 2) {
      const hgt = 8 + ((k * 7) % 9);
      p.rect(L(k % 6 === 0 ? "#8a7aa8" : "#8aa070", 0.6), k, ground - 13 - hgt, 1, hgt);
    }
  }
}

// ---------------------------------------------------------------- the venue

export function loftVenue(o: VenueOptions): Venue {
  const { cols, rows } = o;
  const wallH = 96;
  const glass = (wall: WallSide, at: number, width: number, bars: number): WindowSpec => ({ wall, at, width, sill: 4, top: 84, bars, transom: 22, frame: STEEL });
  const windows = [glass("right", 0.35, 2.5, 3), glass("right", 4.95, 2.7, 3), glass("left", 1.85, 2.5, 3), glass("left", 5.0, 2.65, 3)];
  // The terrace's glass rail, a panel a tile.
  const rails: PropSpec[] = [];
  const [tx0, ty0, tx1, ty1] = [TERRACE[0], TERRACE[1], cols + TERRACE[2], rows + TERRACE[3]];
  for (let x = Math.ceil(tx0); x < tx1 - 0.5; x++) rails.push(railProp("out:railx", x, ty1 - 0.1, true));
  for (let y = Math.ceil(ty0); y < ty1 - 0.5; y++) rails.push(railProp("out:raily", tx1 - 0.1, y, false));
  // Guard rails round the stairwell, open at its head.
  for (const y of [STAIR[1], STAIR[3] - 1]) for (const x of [cols + STAIR[0] - 0.05, cols + STAIR[2] - 0.05]) rails.push(railProp("out:stairrail", x, y, false, 1, false));
  rails.push(railProp("out:stairrailx", cols + STAIR[0], STAIR[1] - 0.05, true, 1, false));
  // Along the far edges, behind the room, each run is one long rail painted into the backdrop.
  rails.push(railProp("out:railyb", tx0, Math.ceil(ty0), false, Math.ceil(ty1 - 0.5) - Math.ceil(ty0)));
  rails.push(railProp("out:railxb", Math.ceil(tx0), ty0, true, Math.ceil(tx1 - 0.5) - Math.ceil(tx0)));
  const v: Venue = {
    id: "loft",
    cols,
    rows,
    floor: herringbone(OAK, "#a8774f", "#6e4a36", 6, 18),
    wall: oldBrick(),
    wainscot: { surface: plaster("#3a383e", "#36343a"), height: 3, rail: STEEL },
    cap: "#4a4850",
    slab: "#77726a",
    slabHeight: 3,
    wallHeight: wallH,
    windows,
    doors: [],
    lamps: [
      // Pools only: the bulbs on their cords are drawn by `bulbs` overhead (a bulbs lamp with no run draws nothing).
      { kind: "bulbs", x: 2.2, y: 2.1, z: 64, reach: 2.6 },
      { kind: "bulbs", x: 5.5, y: 2.3, z: 60, reach: 2.6 },
      { kind: "bulbs", x: 2.4, y: 5.2, z: 58, reach: 2.6 },
      { kind: "bulbs", x: 5.4, y: 5.6, z: 66, reach: 2.4 },
    ],
    wallItems: [
      ...windows.map((w) => muntins(w, [32, 50])),
      beam("right", cols, wallH - 12),
      beam("left", rows, wallH - 12),
      flightBoard("left", 0.15, 40),
      neonSign("right", 3.1, 62),
      sleeve("left", 4.4, 44, "#e2c89a"),
      sleeve("left", 4.4, 64, "#5f7a8a"),
    ],
    props: [
      figProp("prop:fig", 0, 0),
      sofaProp("prop:sofa", 0, 2.1, 2.5),
      recordsProp("prop:records", 2, 0),
      snakePlantProp("prop:snake", 7, 0),
      monsteraProp("prop:monstera", 0, rows - 1),
      speakerProp("prop:speaker", cols - 1, rows - 1),
    ],
    counter: { top: CONCRETE, front: "#8f8b84", side: "#77736d", trim: STEEL, panel: "steel", height: 16 },
    outside: {
      ground: loftGround(cols, rows),
      // Snow is laid by the ground itself: on the deck and the roofs below, never down the tower's face.
      noSnow: true,
      view: loftView,
      props: [
        ...rails,
        waterTowerProp("out:tower", 4.0, -2.35),
        planterProp("out:planter1", 0.4, rows + 1.2, true, 3),
        planterProp("out:planter2", -2.2, rows + 0.1, false, 2),
        bistroProp("out:bistro", 4.4, rows + 0.9),
        parasolProp("out:parasol", 5.4, rows + 1.3),
        planterProp("out:planter3", cols + 1.2, 6.6, false, 2),
      ],
    },
    // Folding doors stand open onto the terrace; guests come up the stair and queue back along the deck.
    front: { height: 14, color: "#94503b", cap: STEEL, gapsRight: [2, 3, 4, 5] },
    entry: [cols + 1.7, 2.3],
    queue: [
      [6.5, 2.45],
      [7.2, 2.9],
      [8.3, 3.4],
      [8.9, 4.1],
      [8.8, 5.0],
      [8.7, 5.9],
      [8.6, 6.8],
      [8.4, 7.7],
    ],
    pickup: [7.6, 3.6],
    indoorSun: 0.6,
    facade: { wall: oldBrick(), trim: STEEL, sign: { board: "#2a2a2e", ink: NEON }, door: STEEL, neighbours: "none", paint: penthouseFront, queueAt: 0.78 },
    overhead: bulbs([
      [2.2, 2.1, 64],
      [5.5, 2.3, 60],
      [2.4, 5.2, 58],
      [5.4, 5.6, 66],
    ], wallH),
  };
  v.outside.far = skyline(v);
  v.floorItems = [rug(() => v, 0.15, 1.9, 1.9, 2.9)];
  return v;
}

/** Bare bulbs on long black cords from the ceiling, warm filaments after dark. */
function bulbs(spots: [number, number, number][], wallH: number) {
  return (p: Painter, g: IsoGrid, light: Light) => {
    const on = light.night > 0.15;
    for (const [x, y, z] of spots) {
      const at = project(g, x, y, z);
      const top = project(g, x, y, wallH + 4);
      p.line(lit(light, "#26242a", 0), at.x, top.y, at.x, at.y - 4);
      p.rect(lit(light, STEEL, 0.2), at.x - 1, at.y - 4, 3, 2);
      p.rect(on ? "#ffe3a6" : lit(light, "#e9dfc8", 0.5), at.x - 1, at.y - 2, 3, 3);
      p.rect(on ? "#fff4d8" : lit(light, CREAM, 0.7), at.x - 1, at.y - 2, 1, 1);
      if (on) {
        p.alpha(0.3 * light.night, () => p.oval("#ffd890", at.x, at.y - 1, 5, 4));
        p.alpha(0.12 * light.night, () => p.oval("#ffd890", at.x, at.y, 11, 8));
      }
    }
  };
}
