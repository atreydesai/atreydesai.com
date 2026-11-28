/**
 * Central Station: a tea kiosk set into the wall of a grand concourse. Tall
 * cream ashlar over green glazed tile, arched iron windows onto the
 * platforms, a split-flap departures board that lists the next trains out
 * after the shop's own hour, a big station clock, brass pendants over a
 * cream marble floor set with green cabochons. Outside is the concourse
 * itself, roofed in glass: stone flags, benches and luggage, the platform's
 * yellow line, and a maroon train standing at platform 2 behind the kiosk.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, project, faceLight, type IsoGrid } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { tiles } from "../surfaces.ts";
import type { Surface } from "../surfaces.ts";
import type { Venue, PropSpec, WallItem, WindowSpec, WallSide, FrontBox } from "../types.ts";
import { displayCup } from "../front.ts";
import { menuBoard } from "../walls.ts";
import { standSprite, SPRITES, INK } from "../props.ts";
import { word, bigWord, bigWidth } from "../font.ts";
import type { VenueOptions } from "./index.ts";
import { archRim, wallBox, wallWord, wallRun, litCache, roomGround, hash, frond, groundPool, floorShader, CREAM } from "./_station-kit.ts";

const STONE = "#e2d6bb";
const GREEN = "#2f5747";
const GREEN_TILE = "#3d6151";
const BRASS = "#b9924e";
const IRON = "#3a4341";
const MAROON = "#7d3c3a";
const MARBLE = "#e6ddc8";

// ---------------------------------------------------------------- surfaces

/** Cream marble squares, a green cabochon at every corner, faint grey veins. */
function marbleFloor(): Surface {
  return {
    colors: ["#e4dac5", "#d6cbb4", "#bfb198", "#3d6555", "#5b8571"],
    at(u, v) {
      const fu = u - Math.floor(u / 24) * 24;
      const fv = v - Math.floor(v / 24) * 24;
      const du = fu < 12 ? fu : 24 - fu;
      const dv = fv < 12 ? fv : 24 - fv;
      const d = du + dv;
      if (d < 4.6) return d < 1.8 ? 4 : 3;
      if (fu < 1 || fv < 1) return 2;
      const vein = noise(Math.floor((u + v * 0.7) / 2), Math.floor((u - v) / 13), 7);
      return vein > 0.91 ? 1 : 0;
    },
  };
}

/** Dressed stone in long courses, the joints staggered. */
function ashlar(): Surface {
  return {
    colors: [STONE, "#dbcdb0", "#c2b293", "#cfc0a1"],
    at(u, z) {
      const course = Math.floor(z / 12);
      if (z - course * 12 < 1) return 2;
      const along = u + (course & 1) * 15;
      if (along - Math.floor(along / 30) * 30 < 1) return 2;
      if (noise(u | 0, z | 0, 5) > 0.975) return 3;
      return noise(Math.floor(along / 30), course, 3) > 0.62 ? 1 : 0;
    },
  };
}

// The concourse outside: big worn flags, a yellow line, the track bed.
const FLAG = ["#cdc4b0", "#c6bca7", "#aca28c", "#bbb19b"];
const CONCOURSE = [...FLAG, "#d9b24a", "#b48e36", "#e3dccb", "#9d968a", "#5e5651", "#6c645d", "#4a3f39", "#a4a4a8", "#55555b", "#b9924e"];
const [F0, F1, FS, FK, YEL, YEL_D, COPE, COPE_D, BAL, BAL2, SLEEPER, RAIL, RAIL_D, INLAY] = CONCOURSE;

/** Where the platform edge and track run behind the kiosk (ground y, tiles). */
const EDGE = -3.1;
const TRACK0 = -3.55;
const TRACK1 = -6.25;

function concourseGround(cols: number, rows: number) {
  return (x: number, y: number) => {
    // Platform edge, yellow line with tactile studs, coping, then the track bed.
    if (y < EDGE && y > TRACK1 - 0.45) {
      if (y > EDGE - 0.22) return (Math.floor(x * 8) + Math.floor(y * 8)) & 1 ? YEL : YEL_D;
      if (y > TRACK0) return y > TRACK0 + 0.08 ? COPE : COPE_D;
      if (y < TRACK1) return y < TRACK1 - 0.37 ? YEL : y < TRACK1 - 0.08 ? COPE : COPE_D;
      // Rails, then sleepers, then ballast.
      const r1 = Math.abs(y + 4.35),
        r2 = Math.abs(y + 5.45);
      if (r1 < 0.05 || r2 < 0.05) return RAIL;
      if (r1 < 0.1 || r2 < 0.1) return RAIL_D;
      if (y < -3.95 && y > -5.85 && x - Math.floor(x * 2) / 2 < 0.16) return SLEEPER;
      return hash(Math.floor(x * 20), Math.floor(y * 20), 3) > 0.55 ? BAL : BAL2;
    }
    // A brass line inlaid in the flags round the kiosk's front.
    const ox = x - cols,
      oy = y - rows;
    const band = (oy > 1 && oy < 1.09 && x > -2 && x < cols + 1.09) || (ox > 1 && ox < 1.09 && y > -1.6 && y < rows + 1.09);
    if (band) return INLAY;
    // Big flags, a slab and a half each, staggered by row.
    const u = x * 24,
      v = y * 24;
    const row = Math.floor(v / 36);
    const off = (row & 1) * 18;
    const fu = u + off - Math.floor((u + off) / 36) * 36;
    const fv = v - row * 36;
    if (fu < 1 || fv < 1) return FS;
    const k = hash(u | 0, v | 0, 9);
    if (k > 0.985) return FK;
    return hash(Math.floor((u + off) / 36), row, 4) > 0.55 ? F1 : F0;
  };
}

// ---------------------------------------------------------------- far band and window views

/** The train shed's roof over everything: glazing between iron ribs, a lattice girder at its foot. */
function shedRoof(v: Venue) {
  return (p: Painter, light: Light, width: number, horizon: number) => {
    // Snow lies on the glazing; rain runs down it.
    const snow = light.weather === "snow";
    const glass = snow ? light.lit("#e6eae6", 0.5) : mixHex(light.sky[1], "#9aa4a4", light.weather === "rain" ? 0.45 : 0.25);
    const glassHi = snow ? light.lit("#f4f4ee", 0.7) : mixHex(light.sky[2], "#d8dcd4", 0.3);
    const iron = light.lit(IRON, 0.1);
    const ironHi = light.lit(mixHex(IRON, CREAM, 0.25), 0.3);
    p.rect(glass, 0, 0, width, horizon);
    for (let y = 0; y < horizon; y += 3) p.dither(glassHi, 0, y, width, 1, snow ? 0.6 : 0.25, 0, y);
    if (light.weather === "rain") for (let x = 3; x < width; x += 9) p.rect(mixHex(glass, "#5f6a70", 0.4), x, (x * 7) % horizon, 1, 4);
    // Arched ribs, one a span, and glazing bars between.
    const span = 56;
    for (let x = -span; x < width + span; x += span) {
      for (let k = 0; k <= span; k++) {
        const t = (k / span) * Math.PI;
        const yy = horizon - 5 - Math.round(Math.sin(t) * (horizon * 1.3));
        p.rect(iron, x + k, yy, 1, 2);
      }
      p.rect(iron, x, 0, 2, horizon);
    }
    for (let x = 0; x < width; x += 7) p.rect(ironHi, x, 0, 1, horizon - 5);
    // The lattice girder the roof springs from.
    p.rect(iron, 0, horizon - 5, width, 5);
    for (let x = 0; x < width; x += 4) {
      p.rect(ironHi, x, horizon - 4, 1, 1);
      p.rect(ironHi, x + 1, horizon - 3, 1, 1);
      p.rect(ironHi, x + 2, horizon - 2, 1, 1);
    }
    p.rect(light.lit(INK, 0), 0, horizon - 1, width, 1);
    if (light.night > 0.3)
      for (let x = 20; x < width; x += span) {
        p.rect("#ffe2a0", x, horizon - 8, 2, 2);
        p.alpha(0.25 * light.night, () => p.oval("#ffd890", x + 1, horizon - 7, 6, 4));
      }
    const g = roomGround(v, width, horizon);
    if (!g) return;
    // Under the roof the concourse keeps its lamps on after dark: warm pools on the flags.
    if (light.night > 0.1) {
      groundPool(p, g, v, light, 5.9, v.rows + 1.5, 2.2, light.night);
      groundPool(p, g, v, light, v.cols + 2.4, 1.6, 2, light.night * 0.8);
      groundPool(p, g, v, light, -2.6, v.rows + 0.4, 2, light.night * 0.7);
    }
  };
}

/** Window views: the train at platform 2 through the right wall, the concourse through the left. */
const VIEW = litCache([
  [MAROON, 0.3, 0], // 0 carriage
  ["#e9dcc0", 0.4, 0], // 1 cream band
  ["#3f5560", 0.1, 0], // 2 carriage glass
  ["#8c8f92", 0.4, 0], // 3 roof
  ["#5f6264", 0.2, 0], // 4 roof shade
  [IRON, 0.1, 0], // 5 iron
  ["#cfc5ae", 0.3, 0], // 6 far stone
  ["#b9ad94", 0.2, 0], // 7 far stone shade
  ["#2e2a2c", 0, 0], // 8 under-frame
  ["#f0c47a", 0.2, 1], // 9 lit carriage window
  ["#c9bfa9", 0.2, 0], // 10 concourse floor far
  ["#7a6a72", 0.2, 0], // 11 crowd a
  ["#5e6f78", 0.2, 0], // 12 crowd b
  ["#9a6a52", 0.2, 0], // 13 crowd c
  ["#8a8478", 0.2, 0], // 14 shopfront shade
  ["#e4c07a", 0.3, 1], // 15 shop window lit
  [GREEN, 0.2, 0], // 16 green signboard
  ["#e2b48c", 0.3, 0], // 17 skin
  ["#b07a52", 0.3, 0], // 18 skin
  ["#7a4e34", 0.3, 0], // 19 skin
  ["#3a3438", 0.1, 0], // 20 legs
]);
// The crowd on the concourse: a figure every seven pixels or so, some gaps, heights varying.
const BODY = new Uint8Array(2048);
const HEAD = new Uint8Array(2048);
const TOP = new Float32Array(2048);
const COLS = new Uint8Array(2048);
for (let u = 0; u < 2048; u++) {
  const pid = Math.floor(u / 7);
  const local = u % 7;
  const here = noise(pid, 1, 33) > 0.22;
  BODY[u] = here && local >= 1 && local <= 4 ? 11 + (pid % 3) : 0;
  HEAD[u] = here && local >= 2 && local <= 3 ? 17 + (Math.floor(noise(pid, 2, 33) * 3) % 3) : 0;
  TOP[u] = 0.2 + noise(pid, 3, 33) * 0.08;
  COLS[u] = u % 44 < 4 ? 1 : 0;
}

function stationView(u: number, v: number, light: Light, wall: WallSide): string {
  const c = VIEW(light);
  const [s0, s1, s2] = light.sky;
  const iu = Math.floor(u) & 2047;
  const night = light.night > 0.45;
  if (v > 0.62) {
    // The glazed roof: iron ribs and bars, sky through the glass.
    const rib = (iu + Math.floor(v * 40)) % 22 < 1 || (iu - Math.floor(v * 40) + 2048) % 22 < 1;
    if (rib || iu % 11 === 0) return c[5];
    return v > 0.86 ? s0 : v > 0.74 ? s1 : s2;
  }
  if (wall === "right") {
    // The far platform's stone wall and columns behind the train.
    if (v > 0.36) {
      if (COLS[iu]) return c[5];
      if (v > 0.56) return c[7];
      return (iu >> 2) % 3 === 0 && v > 0.44 && v < 0.52 ? (night ? c[15] : c[14]) : c[6];
    }
    // The carriage: roof, cream band, the window row, maroon below, the frame under it.
    if (v > 0.3) return v > 0.34 ? c[4] : c[3];
    if (v > 0.25) return c[0];
    if (v > 0.22) return c[1];
    if (v > 0.08) {
      const k = iu % 16;
      if (k < 3) return c[0];
      if (Math.floor(iu / 16) % 6 === 2) return k < 9 ? c[0] : c[2];
      return night ? c[9] : c[2];
    }
    if (v > 0.03) return (iu % 96) < 2 ? c[8] : c[0];
    return c[8];
  }
  // The concourse: far shopfronts, the crowd along the floor.
  if (COLS[iu]) return c[5];
  if (v > 0.4) {
    if (v > 0.52 && v < 0.58) return c[16];
    return (iu >> 3) % 2 === 0 && v < 0.5 ? (night ? c[15] : c[14]) : c[6];
  }
  if (BODY[iu] && v < TOP[iu]) {
    if (v > TOP[iu] - 0.06) return HEAD[iu] ? c[HEAD[iu]] : c[10];
    return v < 0.08 ? c[20] : c[BODY[iu]];
  }
  return c[10];
}

// ---------------------------------------------------------------- walls

/** The split-flap board: the next four trains after the shop's hour, amber on black. */
const DESTINATIONS = ["HARBOR", "CAMPUS", "GARDEN", "LODGE", "CORNER", "BOARDWLK", "MOON", "SKYLINE"];
function departures(at: number, z: number, hour: () => number): WallItem {
  return {
    wall: "right",
    at,
    z,
    draw(p, light, place) {
      const BW = 70,
        BH = 46;
      wallBox(p, place, -3, -3, BW + 6, BH + 6, light.lit(INK, 0));
      wallBox(p, place, -2, -2, BW + 4, BH + 4, light.lit(BRASS, 0.3));
      wallBox(p, place, -1, -1, BW + 2, BH + 2, light.lit(mixHex(BRASS, INK, 0.4), 0.1));
      wallBox(p, place, 0, 0, BW, BH, light.lit("#262327", 0));
      wallBox(p, place, 0, BH - 9, BW, 9, light.lit(GREEN, 0.1, 0.5));
      wallWord(p, place, 4, BH - 2, "DEPARTURES", light.lit("#efe4cc", 0.4, 1));
      const flap = light.lit("#3a3638", 0.1);
      const split = light.lit("#19171a", 0);
      const amber = light.lit("#f2b54e", 0.5, 1);
      const h = hour();
      let t = Math.ceil(h * 4) / 4;
      for (let i = 0; i < 4; i++) {
        t += [0.25, 0.25, 0.5, 0.25][i];
        const hh = Math.floor(t) % 24;
        const mm = Math.round((t % 1) * 60);
        const dest = DESTINATIONS[(Math.floor(h * 4) + i * 3) % DESTINATIONS.length];
        const text = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${dest.padEnd(8)} ${1 + ((i * 5 + Math.floor(h)) % 6)}`;
        const top = BH - 12 - i * 8;
        for (let k = 0; k < text.length; k++) {
          const a = 3 + k * 4;
          if (text[k] === " ") continue;
          wallBox(p, place, a - 0.5, top - 5, 4, 7, flap);
          wallRun(p, place, a - 0.5, top - 2, 4, split);
        }
        wallWord(p, place, 3, top, text, i === 0 ? light.lit("#ffd27a", 0.6, 1) : amber);
      }
    },
  };
}

/** A big station clock in a brass bezel, its hands at the shop's hour. */
function stationClock(wall: WallSide, at: number, z: number, hour: () => number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const cx = place.x;
      const cy = place.y - 11;
      // The bracket it hangs from.
      p.rect(light.lit(IRON, 0.1), cx - 1, cy - 16, 3, 6);
      p.rect(light.lit(BRASS, 0.3), cx - 3, cy - 17, 7, 2);
      p.oval(light.lit(INK, 0), cx, cy, 12, 12);
      p.oval(light.lit(BRASS, 0.4), cx, cy, 11, 11);
      p.oval(light.lit(mixHex(BRASS, CREAM, 0.4), 0.6), cx - 1, cy - 1, 9, 9);
      p.oval(light.lit(mixHex(BRASS, INK, 0.3), 0.2), cx, cy, 9, 9);
      p.oval(light.lit("#f3ead4", 0.4, 0.6), cx, cy, 8, 8);
      const tick = light.lit(INK, 0);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const r = k % 3 === 0 ? 6 : 7;
        p.rect(tick, cx + Math.round(Math.sin(a) * r), cy - Math.round(Math.cos(a) * r), 1, 1);
        if (k % 3 === 0) p.rect(tick, cx + Math.round(Math.sin(a) * 7), cy - Math.round(Math.cos(a) * 7), 1, 1);
      }
      const h = hour();
      const ha = ((h % 12) / 12) * Math.PI * 2;
      const ma = (h % 1) * Math.PI * 2;
      p.line(tick, cx, cy, cx + Math.round(Math.sin(ha) * 4), cy - Math.round(Math.cos(ha) * 4));
      p.line(tick, cx, cy, cx + Math.round(Math.sin(ma) * 6), cy - Math.round(Math.cos(ma) * 6));
      p.rect(light.lit("#b8473b", 0.3), cx, cy, 1, 1);
    },
  };
}

/** A moulded cornice along the wall's top. */
function cornice(wall: WallSide, length: number, z: number): WallItem {
  return {
    wall,
    at: 0,
    z,
    draw(p, light, place) {
      const len = length * 24;
      const shade = wall === "right" ? 0.12 : 0;
      wallBox(p, place, 0, -2, len, 2, light.lit(mixHex(STONE, INK, 0.3 + shade), 0));
      wallBox(p, place, 0, 0, len, 4, light.lit(mixHex(STONE, CREAM, 0.3 - shade), 0.3));
      wallBox(p, place, 0, 4, len, 2, light.lit(mixHex(STONE, INK, 0.15 + shade), 0.1));
      for (let a = 4; a < len; a += 8) wallBox(p, place, a, -2, 2, 2, light.lit(mixHex(STONE, CREAM, 0.2), 0.3));
    },
  };
}

/** A framed railway poster: the harbor line, a lighthouse on a teal sea. */
function poster(wall: WallSide, at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const W = 22,
        H = 30;
      wallBox(p, place, -2, -2, W + 4, H + 4, light.lit(INK, 0));
      wallBox(p, place, -1, -1, W + 2, H + 2, light.lit(BRASS, 0.3));
      wallBox(p, place, 0, 0, W, H, light.lit("#efe2c4", 0.3));
      wallBox(p, place, 1, 9, W - 2, H - 15, light.lit("#9cc3c0", 0.3));
      wallBox(p, place, 1, 9, W - 2, 6, light.lit("#3f7a7c", 0.3));
      wallBox(p, place, 1, 7, W - 2, 3, light.lit("#d8c08c", 0.3));
      wallBox(p, place, 14, 15, 3, 9, light.lit("#f3ead6", 0.4));
      wallBox(p, place, 14, 18, 3, 2, light.lit("#b8473b", 0.4));
      wallBox(p, place, 13, 24, 5, 2, light.lit(INK, 0));
      wallBox(p, place, 5, 18, 3, 3, light.lit("#f4c46a", 0.5));
      wallWord(p, place, 5, 6, "BAY", light.lit(MAROON, 0.3));
    },
  };
}

// ---------------------------------------------------------------- props in the kiosk

const lit = (light: Light, hex: string, face = 0.3, glow = 0) => light.lit(hex, face, glow);

/** A kentia palm in a brass urn. */
function palmProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 54,
    pad: 10,
    draw(p, g, light) {
      const f = faceLight(light, 0.3);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 8, 2));
      // The urn: a foot, a bowl, a lip.
      p.rect(lit(light, INK, 0), b.x - 4, b.y - 3, 9, 3);
      p.rect(lit(light, mixHex(BRASS, INK, 0.3), f.left), b.x - 3, b.y - 3, 7, 2);
      p.oval(lit(light, INK, 0), b.x, b.y - 9, 8, 6);
      p.oval(lit(light, BRASS, f.left + 0.2), b.x, b.y - 9, 7, 5);
      p.rect(lit(light, mixHex(BRASS, CREAM, 0.45), 0.6), b.x - 5, b.y - 11, 2, 4);
      p.rect(lit(light, mixHex(BRASS, INK, 0.35), 0.1), b.x + 3, b.y - 10, 2, 5);
      p.rect(lit(light, INK, 0), b.x - 8, b.y - 15, 17, 2);
      p.rect(lit(light, mixHex(BRASS, CREAM, 0.25), 0.5), b.x - 7, b.y - 15, 15, 1);
      // Fronds arching out of the crown, leaflets hanging off them.
      const dark = lit(light, "#3f6a47", f.left * 0.4);
      const mid = lit(light, "#5d8a58", f.top * 0.6);
      const hi = lit(light, "#8fb878", f.top);
      const fronds: [number, number, number][] = [[-22, -6, 18], [20, -4, 16], [-15, -18, 22], [14, -20, 20], [-5, -30, 14], [6, -28, 12], [-24, 4, 10], [23, 6, 9]];
      fronds.forEach(([ex, ey, a], i) => frond(p, b.x, b.y - 16, ex, ey, a, i % 3 === 2 ? hi : mid, dark, hi, 5));
    },
  };
}

/** A shallow glass-fronted cabinet of tea tins, green with a brass rail. */
function tinCabinetProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 50,
    draw(p, g, light) {
      const share = 0.3;
      const D = 0.48;
      isoBox(p, g, light, 0.1, 0.08, 0.8, D, 44, { top: mixHex(GREEN, CREAM, 0.2), left: GREEN, right: mixHex(GREEN, INK, 0.3) }, 0, share);
      isoBox(p, g, light, 0.06, 0.04, 0.88, D + 0.08, 3, { top: mixHex(GREEN, CREAM, 0.25), left: BRASS, right: mixHex(BRASS, INK, 0.3) }, 44, share);
      // The glass doors on the front face: three shelves of tins behind them.
      const face = (u: number, z: number) => project(g, 0.1 + u * 0.8, 0.08 + D, z);
      const a = face(0.08, 6),
        b = face(0.92, 6),
        c = face(0.92, 40),
        d = face(0.08, 40);
      p.poly(lit(light, "#2c3a36", 0.1), [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]);
      const tins = ["#b8573f", "#d8a05c", "#6f9a5a", "#8e6a9e", "#e2c89a", "#4f7a8a"];
      for (let row = 0; row < 3; row++) {
        const z = 8 + row * 11;
        const s0 = face(0.1, z),
          s1 = face(0.9, z);
        p.line(lit(light, mixHex(GREEN, CREAM, 0.35), 0.3), s0.x, s0.y, s1.x, s1.y);
        for (let k = 0; k < 5; k++) {
          const q = face(0.16 + k * 0.17, z + 1);
          const tone = tins[(row * 2 + k) % tins.length];
          p.rect(lit(light, tone, 0.3), q.x - 1, q.y - 6, 3, 6);
          p.rect(lit(light, mixHex(tone, CREAM, 0.4), 0.5), q.x - 1, q.y - 6, 1, 6);
        }
      }
      const m = face(0.5, 6),
        m2 = face(0.5, 40);
      p.line(lit(light, BRASS, 0.4), m.x, m.y, m2.x, m2.y);
      p.line(lit(light, "#cfe0dc", 0.7), d.x + 2, d.y + 3, d.x + 6, d.y + 10);
      const h = face(0.46, 24);
      p.rect(lit(light, BRASS, 0.5), h.x, h.y, 1, 3);
      p.rect(lit(light, BRASS, 0.5), h.x + 2, h.y + 1, 1, 3);
    },
  };
}

/** A green wire rack of folded newspapers. */
function newsRackProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 34,
    draw(p, g, light) {
      const share = 0.3;
      for (const [u, v] of [[0.2, 0.25], [0.8, 0.25], [0.2, 0.75], [0.8, 0.75]]) isoBox(p, g, light, u - 0.03, v - 0.03, 0.06, 0.06, 26, { top: GREEN, ink: "" }, 0, share);
      for (let i = 0; i < 3; i++) {
        const z = 6 + i * 9;
        const back = 0.2 + i * 0.1;
        isoBox(p, g, light, 0.18, back, 0.64, 0.5 - i * 0.08, 2, { top: mixHex(GREEN, INK, 0.2) }, z, share);
        // Folded papers leaning on the tier, mastheads showing.
        for (let k = 0; k < 2; k++) {
          const a = project(g, 0.26 + k * 0.3, back + 0.42 - i * 0.08, z + 2);
          const tone = ["#e9e0cc", "#ead9c2", "#dfe3e0"][(i + k) % 3];
          p.rect(lit(light, INK, 0), a.x - 1, a.y - 9, 10, 9);
          p.rect(lit(light, tone, 0.4), a.x, a.y - 8, 8, 7);
          p.rect(lit(light, k ? MAROON : "#2f4f6f", 0.3), a.x, a.y - 8, 8, 2);
          p.rect(lit(light, "#8a8278", 0.3), a.x + 1, a.y - 4, 6, 1);
          p.rect(lit(light, "#8a8278", 0.3), a.x + 1, a.y - 2, 4, 1);
        }
      }
      const top = project(g, 0.5, 0.5, 30);
      p.rect(lit(light, INK, 0), top.x - 8, top.y - 4, 17, 6);
      p.rect(lit(light, MAROON, 0.4), top.x - 7, top.y - 3, 15, 4);
      word(p, "NEWS", lit(light, "#f1e4c8", 0.5), top.x - 7, top.y - 3);
    },
  };
}

/** Two tea chests and a sack, stencilled. */
function teaChestsProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 30,
    draw(p, g, light) {
      const share = 0.3;
      const wood = "#a87d55";
      const chest = (u: number, v: number, s: number, z: number) => {
        const box = isoBox(p, g, light, u, v, s, s, Math.round(s * 30), { top: mixHex(wood, CREAM, 0.15), left: wood, right: mixHex(wood, INK, 0.25) }, z, share);
        // Battens along the edges of its front face.
        const a = project(g, u, v + s, z + 2);
        const b = project(g, u + s, v + s, z + 2);
        p.line(lit(light, mixHex(wood, INK, 0.4), 0.1), a.x, a.y, b.x, b.y);
        p.line(lit(light, mixHex(wood, INK, 0.4), 0.1), a.x, a.y - box.h + 4, b.x, b.y - box.h + 4);
        const w = project(g, u + s * 0.2, v + s, z + box.h * 0.66);
        word(p, "TEA", lit(light, "#3a2a26", 0.2), w.x, w.y, 0.5);
      };
      chest(0.12, 0.14, 0.6, 0);
      chest(0.2, 0.2, 0.44, 18);
      const s = SPRITES.sack;
      standSprite(p, g, light, s.grid, s.palette, 0.86, 0.72, 0, share);
    },
  };
}

/** A Boston fern spilling from a green glazed pot on a stand. */
function fernProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 34,
    pad: 8,
    draw(p, g, light) {
      const f = faceLight(light, 0.3);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 7, 2));
      // A brass stand, three legs.
      for (const dx of [-5, 0, 5]) p.rect(lit(light, mixHex(BRASS, INK, 0.3), 0.2), b.x + dx, b.y - 12 + (dx === 0 ? 1 : 0), 1, 12 - (dx === 0 ? 1 : 0));
      p.rect(lit(light, BRASS, 0.4), b.x - 6, b.y - 13, 13, 2);
      p.oval(lit(light, INK, 0), b.x, b.y - 18, 7, 5);
      p.oval(lit(light, GREEN_TILE, f.left + 0.2), b.x, b.y - 18, 6, 4);
      p.rect(lit(light, mixHex(GREEN_TILE, CREAM, 0.4), 0.5), b.x - 4, b.y - 20, 2, 3);
      const dark = lit(light, "#456b43", f.left * 0.3);
      const mid = lit(light, "#6a9a5a", f.top * 0.6);
      const hi = lit(light, "#9cc47e", f.top);
      for (let k = 0; k < 11; k++) {
        const a = -Math.PI * 0.95 + (k / 10) * Math.PI * 0.9;
        const len = 9 + (k % 3) * 3;
        for (let i = 1; i <= len; i++) {
          const t = i / len;
          const x = b.x + Math.cos(a) * i * 1.1;
          const yy = b.y - 22 + Math.sin(a) * i * 0.7 + t * t * 10;
          p.rect(k % 2 ? mid : dark, Math.round(x), Math.round(yy), 1, 2);
          if (i % 3 === 0) p.rect(hi, Math.round(x), Math.round(yy) - 1, 1, 1);
        }
      }
    },
  };
}

/** The kiosk's corner post: cast iron, a hanging TEA sign and a globe lamp. */
function signPostProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 74,
    pad: 14,
    draw(p, g, light) {
      const b = project(g, 0.5, 0.5, 0);
      const f = faceLight(light, 0.3);
      const iron = lit(light, GREEN, f.left * 0.5);
      const ironD = lit(light, mixHex(GREEN, INK, 0.45), 0);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 7, 2));
      p.rect(lit(light, INK, 0), b.x - 5, b.y - 6, 11, 6);
      p.rect(iron, b.x - 4, b.y - 6, 9, 5);
      p.rect(lit(light, BRASS, 0.4), b.x - 4, b.y - 7, 9, 1);
      p.rect(lit(light, INK, 0), b.x - 2, b.y - 62, 5, 56);
      p.rect(iron, b.x - 1, b.y - 62, 3, 56);
      p.rect(lit(light, mixHex(GREEN, CREAM, 0.3), 0.4), b.x - 1, b.y - 60, 1, 52);
      for (const yy of [b.y - 20, b.y - 44]) p.rect(lit(light, BRASS, 0.4), b.x - 2, yy, 5, 2);
      // Arm out toward the room, the sign hung under it.
      p.rect(ironD, b.x - 16, b.y - 50, 18, 2);
      p.line(ironD, b.x - 12, b.y - 48, b.x, b.y - 42);
      p.rect(ironD, b.x - 14, b.y - 48, 1, 3);
      p.rect(ironD, b.x - 3, b.y - 48, 1, 3);
      p.rect(lit(light, INK, 0), b.x - 17, b.y - 45, 17, 11);
      p.rect(lit(light, GREEN, 0.3, 0.4), b.x - 16, b.y - 44, 15, 9);
      p.rect(lit(light, BRASS, 0.5), b.x - 16, b.y - 44, 15, 1);
      word(p, "TEA", lit(light, "#f1e4c8", 0.5, 0.8), b.x - 14, b.y - 42);
      // Globe lamp on top.
      const on = light.night > 0.15;
      p.rect(lit(light, BRASS, 0.4), b.x - 2, b.y - 64, 5, 2);
      p.oval(lit(light, INK, 0), b.x, b.y - 69, 5, 5);
      p.oval(on ? "#ffe6b0" : lit(light, "#efe6d2", 0.5), b.x, b.y - 69, 4, 4);
      p.rect(on ? "#fff4d6" : lit(light, CREAM, 0.8), b.x - 2, b.y - 71, 2, 2);
      if (on) p.alpha(0.22 * light.night, () => p.oval("#ffd890", b.x, b.y - 69, 10, 9));
    },
  };
}

/** A brass-and-green medallion set in the marble: rings and an eight-point star. Lit like the floor. */
const MED_RIM = mixHex(BRASS, INK, 0.2);
const STAR = Array.from({ length: 17 }, (_, k) => (k % 2 ? 0.16 : k % 4 === 0 ? 0.46 : 0.3));
function medallion(venue: () => Venue, cx: number, cy: number) {
  return floorShader(venue, [cx - 0.8, cy - 0.8, cx + 0.8, cy + 0.8], (tx, ty) => {
    const r = Math.hypot(tx - cx, ty - cy);
    if (r > 0.78) return null;
    const a = (Math.atan2(ty - cy, tx - cx) + Math.PI * 2) % (Math.PI * 2);
    const f = (a / (Math.PI * 2)) * 16;
    const k = Math.floor(f);
    const edge = STAR[k] + (STAR[k + 1] - STAR[k]) * (f - k);
    if (r < 0.06) return MAROON;
    if (r < edge) return BRASS;
    if (r < 0.5) return "#e9dfc9";
    if (r < 0.72) return GREEN_TILE;
    return MED_RIM;
  });
}

// ---------------------------------------------------------------- outside: the concourse

/** A platform bench: oak slats on cast-iron ends. Under the roof, so little sun. */
function benchProp(key: string, x: number, y: number, alongX: boolean): PropSpec {
  return {
    key,
    x,
    y,
    w: alongX ? 2 : 1,
    d: alongX ? 1 : 2,
    height: 20,
    draw(p, g, light) {
      const share = 0.25;
      const wood = "#a8784e";
      const L = alongX ? 1.7 : 0.36;
      const D = alongX ? 0.36 : 1.7;
      const x0 = alongX ? 0.15 : 0.32;
      const y0 = alongX ? 0.32 : 0.15;
      for (const t of [0.05, 0.85]) {
        const u = alongX ? x0 + L * t : x0;
        const v = alongX ? y0 : y0 + D * t;
        isoBox(p, g, light, u, v, alongX ? 0.1 : L, alongX ? D : 0.1, 9, { top: IRON }, 0, share);
      }
      isoBox(p, g, light, x0, y0, L, D, 2, { top: wood }, 8, share);
      const bx = alongX ? x0 : x0;
      const by = alongX ? y0 : y0;
      isoBox(p, g, light, bx, by, alongX ? L : 0.08, alongX ? 0.08 : D, 8, { top: mixHex(wood, INK, 0.15) }, 11, share);
    },
  };
}

/** Travellers' luggage: a tall case, a trunk, a carpet bag. */
function luggageProp(key: string, x: number, y: number, seed: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 26,
    draw(p, g, light) {
      const share = 0.25;
      const tones = [["#7d3c3a", "#c9a86a"], ["#3f5a6a", "#d8c8a6"], ["#8a6a48", "#3a2c2c"], ["#4f6a4a", "#d0b27a"]];
      const [a, b] = tones[seed % tones.length];
      const [c, d] = tones[(seed + 1) % tones.length];
      // A trunk lying down, a tall case stood on end beside it.
      isoBox(p, g, light, 0.15, 0.2, 0.62, 0.36, 9, { top: mixHex(c, CREAM, 0.15), left: c, right: mixHex(c, INK, 0.3) }, 0, share);
      const tr = project(g, 0.15, 0.56, 4);
      const tr2 = project(g, 0.77, 0.56, 4);
      p.line(lit(light, d, 0.4), tr.x, tr.y, tr2.x, tr2.y);
      isoBox(p, g, light, 0.58, 0.55, 0.3, 0.14, 20, { top: mixHex(a, CREAM, 0.15), left: a, right: mixHex(a, INK, 0.3) }, 0, share);
      const h = project(g, 0.73, 0.62, 22);
      p.rect(lit(light, INK, 0), h.x - 2, h.y - 2, 5, 1);
      p.rect(lit(light, INK, 0), h.x - 2, h.y - 2, 1, 2);
      p.rect(lit(light, INK, 0), h.x + 2, h.y - 2, 1, 2);
      const st = project(g, 0.58, 0.69, 10);
      const st2 = project(g, 0.88, 0.69, 10);
      p.line(lit(light, b, 0.4), st.x, st.y, st2.x, st2.y);
      // A carpet bag on the trunk.
      const bag = project(g, 0.4, 0.4, 9);
      p.rect(lit(light, INK, 0), bag.x - 5, bag.y - 7, 10, 7);
      p.rect(lit(light, "#9a5a4a", 0.3), bag.x - 4, bag.y - 6, 8, 5);
      p.rect(lit(light, "#d6a85a", 0.4), bag.x - 4, bag.y - 4, 8, 1);
      p.rect(lit(light, INK, 0), bag.x - 2, bag.y - 9, 4, 1);
    },
  };
}

/** A concourse lamp standard: fluted green post, two globes on a crossarm. */
function lampStandardProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 78,
    pad: 14,
    shadow: "none",
    draw(p, g, light) {
      const b = project(g, 0.5, 0.5, 0);
      const iron = lit(light, GREEN, 0.15);
      const ironHi = lit(light, mixHex(GREEN, CREAM, 0.3), 0.3);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 7, 2));
      p.rect(lit(light, INK, 0), b.x - 5, b.y - 9, 11, 9);
      p.rect(iron, b.x - 4, b.y - 9, 9, 8);
      p.rect(ironHi, b.x - 4, b.y - 9, 9, 1);
      p.rect(lit(light, INK, 0), b.x - 2, b.y - 66, 5, 58);
      p.rect(iron, b.x - 1, b.y - 66, 3, 58);
      p.rect(ironHi, b.x - 1, b.y - 64, 1, 54);
      p.rect(lit(light, INK, 0), b.x - 12, b.y - 68, 25, 3);
      p.rect(lit(light, BRASS, 0.3), b.x - 11, b.y - 67, 23, 1);
      const on = light.night > 0.15;
      for (const dx of [-10, 10]) {
        p.rect(lit(light, INK, 0), b.x + dx - 1, b.y - 70, 3, 2);
        p.oval(lit(light, INK, 0), b.x + dx, b.y - 75, 5, 5);
        p.oval(on ? "#ffe6b0" : lit(light, "#efe6d2", 0.4), b.x + dx, b.y - 75, 4, 4);
        p.rect(on ? "#fff4d6" : lit(light, CREAM, 0.7), b.x + dx - 2, b.y - 77, 2, 2);
        if (on) p.alpha(0.2 * light.night, () => p.oval("#ffd890", b.x + dx, b.y - 75, 10, 9));
      }
      // A platform sign hung from the post.
      p.rect(lit(light, INK, 0), b.x - 10, b.y - 52, 21, 9);
      p.rect(lit(light, "#f0e6cf", 0.3, 0.3), b.x - 9, b.y - 51, 19, 7);
      word(p, "1-4", lit(light, MAROON, 0.2), b.x - 5, b.y - 50);
    },
  };
}

/** A cast-iron column of the train shed, rising out of the frame. */
function columnProp(key: string, x: number, y: number, height: number): PropSpec {
  return {
    key,
    x,
    y,
    height,
    pad: 6,
    shadow: "none",
    draw(p, g, light) {
      const b = project(g, 0.5, 0.5, 0);
      const iron = lit(light, "#4b5652", 0.15);
      const ironHi = lit(light, "#77847d", 0.3);
      const ironD = lit(light, "#2f3734", 0);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 9, 3));
      // Plinth, fluted shaft, a capital and the springing of the ribs.
      p.rect(lit(light, INK, 0), b.x - 7, b.y - 12, 15, 12);
      p.rect(iron, b.x - 6, b.y - 12, 13, 11);
      p.rect(ironHi, b.x - 6, b.y - 12, 13, 1);
      p.rect(lit(light, INK, 0), b.x - 4, b.y - height, 9, height - 12);
      p.rect(iron, b.x - 3, b.y - height, 7, height - 12);
      for (const dx of [-2, 1]) p.rect(ironHi, b.x + dx, b.y - height, 1, height - 14);
      p.rect(ironD, b.x + 3, b.y - height, 1, height - 12);
      for (const yy of [b.y - 30, b.y - height + 18]) {
        p.rect(lit(light, INK, 0), b.x - 6, yy, 13, 4);
        p.rect(lit(light, BRASS, 0.3), b.x - 5, yy + 1, 11, 2);
      }
    },
  };
}

/** The train standing at platform 2: maroon carriages, a cream band, its windows lit after dark. */
function trainProp(key: string, x: number, y: number, length: number): PropSpec {
  return {
    key,
    x,
    y,
    w: length,
    d: 2.3,
    height: 56,
    pad: 8,
    shadow: "none",
    draw(p, g, light) {
      const share = 0.25;
      const D = 2.3;
      const f = faceLight(light, share);
      isoBox(p, g, light, 0.3, 0.35, length - 0.6, D - 0.7, 8, { top: "#2e2a2c", left: "#2a2628", right: "#242022" }, 0, share);
      // Bogies under each carriage's ends.
      const car = 7;
      for (let c0 = 0; c0 < length; c0 += car)
        for (const t of [0.9, car - 1.4]) {
          if (c0 + t > length - 0.4) continue;
          for (const dt of [0, 0.7]) {
            const w = project(g, c0 + t + dt, D - 0.3, 3);
            p.oval(lit(light, "#1f1b1d", 0), w.x, w.y, 3, 3);
            p.rect(lit(light, "#77777b", 0.3), w.x - 1, w.y - 1, 2, 1);
          }
        }
      const roof = light.weather === "snow" ? "#e4e8e6" : "#8a8d90";
      isoBox(p, g, light, 0, 0, length, D, 40, { top: roof, left: MAROON, right: mixHex(MAROON, INK, 0.3) }, 8, share);
      isoBox(p, g, light, 0.25, 0.45, length - 0.5, D - 0.9, 3, { top: light.weather === "snow" ? "#eef0ee" : "#9a9d9f", ink: "" }, 48, share);
      // Cream band and the window row along the platform side.
      const side = (t: number, z: number) => project(g, t, D, z);
      const cream = lit(light, "#e9dcc0", f.left + 0.1);
      for (const z of [36, 37, 18]) {
        const a = side(0.05, z),
          b = side(length - 0.05, z);
        p.line(cream, a.x, a.y, b.x, b.y);
      }
      const on = light.night > 0.35;
      for (let c0 = 0; c0 < length; c0 += car) {
        // The gangway between carriages.
        if (c0 > 0) {
          const a = side(c0, 46),
            b = side(c0, 9);
          p.line(lit(light, INK, 0), a.x, a.y, b.x, b.y);
          p.line(lit(light, "#4a2a2a", 0), a.x + 1, a.y, b.x + 1, b.y);
        }
        for (let k = 0; k < 6; k++) {
          const t0 = c0 + 0.55 + k * 1.05;
          if (t0 + 0.7 > Math.min(length, c0 + car) - 0.2) break;
          if (k === 2) {
            // A door: two leaves with a window each, a brass handle.
            const a = side(t0, 34),
              b = side(t0 + 0.8, 34),
              c = side(t0 + 0.8, 10),
              d = side(t0, 10);
            p.poly(lit(light, mixHex(MAROON, INK, 0.15), f.left), [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]);
            p.line(lit(light, INK, 0), a.x, a.y, d.x, d.y);
            p.line(lit(light, INK, 0), b.x, b.y, c.x, c.y);
            const m = side(t0 + 0.4, 34),
              m2 = side(t0 + 0.4, 10);
            p.line(lit(light, INK, 0), m.x, m.y, m2.x, m2.y);
            const wa = side(t0 + 0.08, 32),
              wb = side(t0 + 0.32, 32);
            p.poly(on ? "#f0c47a" : lit(light, "#3f5560", 0.2), [wa.x, wa.y, wb.x, wb.y, wb.x, wb.y + 7, wa.x, wa.y + 7]);
            continue;
          }
          const a = side(t0, 33),
            b = side(t0 + 0.75, 33);
          p.poly(lit(light, INK, 0), [a.x - 1, a.y - 1, b.x + 1, b.y - 1, b.x + 1, b.y + 12, a.x - 1, a.y + 12]);
          p.poly(on ? "#f0c47a" : lit(light, "#3f5560", 0.15), [a.x, a.y, b.x, b.y, b.x, b.y + 11, a.x, a.y + 11]);
          if (!on) p.line(lit(light, "#8fb0b8", 0.6), a.x + 2, a.y + 2, a.x + 5, a.y + 4);
          else p.alpha(0.18 * light.night, () => p.poly("#ffd890", [a.x - 2, a.y - 2, b.x + 2, b.y - 2, b.x + 2, b.y + 18, a.x - 2, a.y + 18]));
        }
        const num = side(c0 + 3.4, 16);
        word(p, String(2 + c0 / car), lit(light, "#e9dcc0", f.left), num.x, num.y - 5, 0.5);
      }
    },
  };
}

/** The ticket barriers onto the platforms: a line of gates along y, their arrows lit. */
function gatesProp(key: string, x: number, y: number, n: number): PropSpec {
  return {
    key,
    x,
    y,
    w: 1,
    d: n,
    height: 24,
    shadow: "none",
    draw(p, g, light) {
      const share = 0.25;
      for (let k = 0; k <= n; k++) {
        isoBox(p, g, light, 0.3, k - 0.12, 0.42, 0.24, 17, { top: "#3a3f3e", left: "#c9cbc6", right: "#9a9d99" }, 0, share);
        const s = project(g, 0.72, k, 13);
        p.rect(lit(light, INK, 0), s.x - 1, s.y - 3, 4, 4);
        p.rect(k % 3 === 2 ? lit(light, "#e8604a", 0.4, 1) : lit(light, "#7fe09a", 0.4, 1), s.x, s.y - 2, 2, 2);
        if (k === n) break;
        // Paddles meeting in the gap, red-edged glass.
        for (const t of [0.22, 0.78]) {
          const a = project(g, 0.5, k + t, 8),
            b = project(g, 0.5, k + t, 15);
          p.line(lit(light, "#b8473b", 0.3), a.x, a.y, b.x, b.y);
        }
        const a = project(g, 0.5, k + 0.15, 15),
          b = project(g, 0.5, k + 0.85, 15);
        p.alpha(0.35, () => p.poly(lit(light, "#cfe0e0", 0.5), [a.x, a.y, b.x, b.y, b.x, b.y + 7, a.x, a.y + 7]));
      }
    },
  };
}

/** A ticket machine: a green cabinet with a lit screen. */
function ticketMachineProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 34,
    draw(p, g, light) {
      const share = 0.25;
      isoBox(p, g, light, 0.25, 0.3, 0.5, 0.4, 30, { top: mixHex(GREEN, CREAM, 0.2), left: GREEN, right: mixHex(GREEN, INK, 0.3) }, 0, share);
      const s = project(g, 0.32, 0.7, 25);
      const s2 = project(g, 0.68, 0.7, 25);
      p.poly(lit(light, INK, 0), [s.x - 1, s.y - 1, s2.x + 1, s2.y - 1, s2.x + 1, s2.y + 8, s.x - 1, s.y + 8]);
      p.poly(lit(light, "#9fd0b0", 0.4, 1), [s.x, s.y, s2.x, s2.y, s2.x, s2.y + 7, s.x, s.y + 7]);
      const k = project(g, 0.4, 0.7, 14);
      p.rect(lit(light, BRASS, 0.4), k.x, k.y, 6, 2);
      p.rect(lit(light, "#1f1b1d", 0), k.x + 1, k.y + 5, 5, 1);
      const t = project(g, 0.5, 0.5, 31);
      p.rect(lit(light, INK, 0), t.x - 11, t.y - 7, 23, 9);
      p.rect(lit(light, MAROON, 0.3), t.x - 10, t.y - 6, 21, 7);
      word(p, "FARES", lit(light, "#f1e4c8", 0.5, 0.6), t.x - 9, t.y - 5);
    },
  };
}

/** A litter bin, cast iron with a brass band. */
function binProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 18,
    draw(p, g, light) {
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 6, 2));
      p.rect(lit(light, INK, 0), b.x - 5, b.y - 15, 11, 15);
      p.rect(lit(light, GREEN, 0.2), b.x - 4, b.y - 14, 9, 13);
      p.rect(lit(light, mixHex(GREEN, CREAM, 0.3), 0.3), b.x - 4, b.y - 14, 2, 13);
      p.rect(lit(light, BRASS, 0.4), b.x - 4, b.y - 11, 9, 2);
      p.rect(lit(light, "#1f1b1d", 0), b.x - 3, b.y - 15, 7, 1);
    },
  };
}

/** Opal globes on brass rods from the ceiling, the station's own lamps. */
function globes(spots: [number, number, number][], wallH: number) {
  return (p: Painter, g: IsoGrid, light: Light) => {
    const on = light.night > 0.15;
    for (const [x, y, z] of spots) {
      const at = project(g, x, y, z);
      const top = project(g, x, y, wallH + 6);
      p.rect(lit(light, mixHex(BRASS, INK, 0.3), 0.2), at.x, top.y, 1, at.y - top.y - 6);
      p.rect(lit(light, BRASS, 0.4), at.x - 2, at.y - 8, 5, 2);
      p.oval(lit(light, INK, 0), at.x, at.y - 2, 5, 5);
      p.oval(on ? "#ffe9bc" : lit(light, "#efe8d6", 0.5), at.x, at.y - 2, 4, 4);
      p.rect(on ? "#fff6dc" : lit(light, CREAM, 0.8), at.x - 2, at.y - 4, 2, 2);
      p.rect(lit(light, BRASS, 0.4), at.x - 1, at.y + 2, 3, 1);
      if (on) {
        p.alpha(0.28 * light.night, () => p.oval("#ffd890", at.x, at.y - 2, 9, 8));
        p.alpha(0.12 * light.night, () => p.oval("#ffd890", at.x, at.y, 16, 12));
      }
    }
  };
}

// ---------------------------------------------------------------- the street view

/**
 * The kiosk from the concourse: under an iron arch of the train shed, a
 * green timber kiosk with brass trim, its name lit along the fascia, a
 * serving window with the day's cup in it and a door at the end. The
 * station clock hangs from the arch and a departures board beside it.
 */
function kioskFront(hour: () => number) {
  return (p: Painter, light: Light, box: FrontBox) => {
    const L = (hex: string, f = 0.4, g = 0) => light.lit(hex, f, g);
    const { x, w, ground } = box;
    const night = light.night > 0.4;
    const iron = L(IRON, 0.15);
    const ironHi = L(mixHex(IRON, CREAM, 0.3), 0.3);
    // Two columns and the arch they carry, a lattice in its spandrels.
    const cl = x - 2,
      cr = x + w + 2;
    const cx = Math.round((cl + cr) / 2);
    const rx = (cr - cl) / 2;
    for (let k = 0; k <= 240; k++) {
      const t = (Math.PI * k) / 240;
      const ax = cx - Math.cos(t) * rx;
      const ay = 44 - Math.sin(t) * 38;
      p.rect(iron, ax - 1, ay, 3, 3);
      if (k % 12 === 0) p.line(ironHi, ax, ay + 3, ax + (ax < cx ? -6 : 6), 44);
    }
    for (const c of [cl, cr]) {
      p.rect(L(INK, 0), c - 4, 18, 9, ground - 18);
      p.rect(iron, c - 3, 18, 7, ground - 18);
      p.rect(ironHi, c - 2, 18, 1, ground - 20);
      for (const yy of [40, ground - 22]) {
        p.rect(L(INK, 0), c - 5, yy, 11, 4);
        p.rect(L(BRASS, 0.5), c - 4, yy + 1, 9, 2);
      }
      p.rect(L(INK, 0), c - 6, ground - 10, 13, 10);
      p.rect(iron, c - 5, ground - 9, 11, 9);
    }
    // The station clock hung from the crown, its hands at the shop's hour.
    const ky = 22;
    p.rect(iron, cx, 6, 1, ky - 13);
    p.oval(L(INK, 0), cx, ky, 8, 8);
    p.oval(L(BRASS, 0.5), cx, ky, 7, 7);
    p.oval(L("#f3ead4", 0.5, 0.6), cx, ky, 5, 5);
    const h = hour();
    const ha = ((h % 12) / 12) * Math.PI * 2,
      ma = (h % 1) * Math.PI * 2;
    p.line(L(INK, 0), cx, ky, cx + Math.round(Math.sin(ha) * 3), ky - Math.round(Math.cos(ha) * 3));
    p.line(L(INK, 0), cx, ky, cx + Math.round(Math.sin(ma) * 4), ky - Math.round(Math.cos(ma) * 4));
    // A departures board hung beside it: the next two trains.
    const bx = cx + 18,
      by = 24;
    p.line(iron, bx + 3, by, bx + 3, by - 8);
    p.line(iron, bx + 40, by, bx + 40, by - 12);
    p.rect(L(INK, 0), bx - 1, by - 1, 46, 17);
    p.rect(L("#262327", 0), bx, by, 44, 15);
    let t = Math.ceil(h * 4) / 4;
    for (let i = 0; i < 2; i++) {
      t += 0.25;
      const text = `${String(Math.floor(t) % 24).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")} ${DESTINATIONS[(Math.floor(h * 4) + i * 3) % DESTINATIONS.length].slice(0, 4)}`;
      word(p, text, L("#f2b54e", 0.6, 1), bx + 2, by + 2 + i * 7);
    }
    // The kiosk.
    const k0 = x + 14,
      k1 = x + w - 14;
    const kw = k1 - k0;
    const roof = ground - 80;
    const green = L(GREEN, 0.4);
    const greenD = L(mixHex(GREEN, INK, 0.35), 0.2);
    const brass = L(BRASS, 0.6);
    p.rect(L(INK, 0), k0 - 7, roof - 1, kw + 14, 6);
    p.rect(L(mixHex(GREEN, CREAM, 0.15), 0.6), k0 - 6, roof, kw + 12, 4);
    p.rect(brass, k0 - 6, roof + 4, kw + 12, 1);
    for (let xx = k0 - 6; xx < k1 + 6; xx += 4) p.rect(greenD, xx, roof + 5, 3, 2);
    // The fascia with the name, lit after dark.
    const fy = roof + 8;
    p.rect(L(INK, 0), k0 - 1, fy - 1, kw + 2, 15);
    p.rect(L(GREEN, 0.3, 0.3), k0, fy, kw, 13);
    p.rect(brass, k0, fy, kw, 1);
    p.rect(brass, k0, fy + 12, kw, 1);
    const name = box.name.toUpperCase();
    const ink = night && box.open ? "#ffe9b8" : L("#f1e4c8", 0.6, box.open ? 0.6 : 0);
    if (bigWidth(name) <= kw - 6) bigWord(p, name, ink, Math.round(k0 + (kw - bigWidth(name)) / 2), fy + 3);
    else word(p, name, ink, Math.round(k0 + (kw - (name.length * 4 - 1)) / 2), fy + 4);
    // The body: brass corner posts, a serving window, a door at the end, panelled below.
    const body = fy + 14;
    p.rect(L(INK, 0), k0 - 1, body, kw + 2, ground - body);
    p.rect(green, k0, body, kw, ground - body);
    const wx0 = k0 + 6,
      wx1 = k0 + Math.round(kw * 0.62);
    const wy0 = body + 5,
      wy1 = ground - 26;
    const glass = box.open ? (night ? "#f2cf86" : L("#e9dcc0", 0.4)) : L("#55605c", 0.3);
    p.rect(brass, wx0 - 2, wy0 - 2, wx1 - wx0 + 4, wy1 - wy0 + 4);
    p.rect(glass, wx0, wy0, wx1 - wx0, wy1 - wy0);
    if (box.open) {
      // Shelves of tins behind the glass, a kettle on the back counter.
      const tins = ["#b8573f", "#d8a05c", "#6f9a5a", "#8e6a9e", "#e2c89a"];
      for (let row = 0; row < 2; row++) {
        p.rect(L(mixHex(GREEN, CREAM, 0.3), 0.3), wx0 + 2, wy0 + 8 + row * 9, wx1 - wx0 - 4, 1);
        for (let k = 0; k < 9; k++) p.rect(L(tins[(k + row * 2) % tins.length], 0.4), wx0 + 4 + k * 7, wy0 + 3 + row * 9, 3, 5);
      }
      p.rect(L("#9aa0a3", 0.5), wx1 - 16, wy1 - 9, 7, 6);
      p.rect(L(INK, 0), wx1 - 14, wy1 - 11, 3, 2);
    } else for (let xx = wx0; xx < wx1; xx += 4) p.rect(L("#3f4a46", 0.2), xx, wy0, 1, wy1 - wy0);
    p.rect(L(CREAM, 0.6), wx0 + 3, wy0 + 2, 10, 1);
    // The counter ledge, marble on brass, the day's cup on it.
    p.rect(L(INK, 0), wx0 - 4, wy1 + 2, wx1 - wx0 + 8, 5);
    p.rect(L(MARBLE, 0.6), wx0 - 3, wy1 + 2, wx1 - wx0 + 6, 3);
    p.rect(brass, wx0 - 3, wy1 + 5, wx1 - wx0 + 6, 1);
    if (box.display && box.open) displayCup(p, light, box.display, Math.round((wx0 + wx1) / 2), wy1 + 2);
    for (const [a, b2] of [[wx0, Math.round((wx0 + wx1) / 2) - 2], [Math.round((wx0 + wx1) / 2) + 2, wx1]]) {
      p.rect(greenD, a + 2, ground - 16, b2 - a - 4, 1);
      p.rect(greenD, a + 2, ground - 6, b2 - a - 4, 1);
      p.rect(greenD, a + 2, ground - 16, 1, 10);
      p.rect(greenD, b2 - 3, ground - 16, 1, 10);
    }
    const dx0 = wx1 + 8,
      dx1 = k1 - 6;
    const dy0 = body + 4;
    p.rect(L(INK, 0), dx0 - 1, dy0 - 1, dx1 - dx0 + 2, ground - dy0 + 1);
    p.rect(L(mixHex(GREEN, INK, 0.12), 0.4), dx0, dy0, dx1 - dx0, ground - dy0);
    p.rect(glass, dx0 + 3, dy0 + 3, dx1 - dx0 - 6, Math.round((ground - dy0) * 0.4));
    p.rect(brass, dx1 - 5, dy0 + Math.round((ground - dy0) * 0.58), 2, 2);
    const tag = box.open ? "OPEN" : "SHUT";
    const tx = Math.round((dx0 + dx1) / 2) - 8;
    p.rect(L(INK, 0), tx - 1, dy0 + 7, 17, 8);
    p.rect(box.open ? L("#7f9a72", 0.6, 0.6) : L("#c4574a", 0.6), tx, dy0 + 8, 15, 6);
    word(p, tag, L(CREAM, 0.6), tx, dy0 + 9);
    for (const c of [k0, k1 - 2]) p.rect(brass, c, body, 2, ground - body);
    p.rect(brass, k0, ground - 3, kw, 1);
    // A traveller's trunk and case left by the kiosk, a lamp standard's globe glowing after dark.
    p.rect(L(INK, 0), x + 2, ground - 9, 13, 9);
    p.rect(L(MAROON, 0.4), x + 3, ground - 8, 11, 8);
    p.rect(L("#c9a86a", 0.5), x + 3, ground - 5, 11, 1);
    p.rect(L(INK, 0), x + 5, ground - 19, 8, 10);
    p.rect(L("#3f5a6a", 0.4), x + 6, ground - 18, 6, 9);
    if (night)
      for (const c of [cl, cr]) {
        p.alpha(0.25 * light.night, () => p.oval("#ffd890", c, 44, 10, 8));
        p.rect("#ffe9bc", c - 1, 46, 3, 3);
      }
  };
}

// ---------------------------------------------------------------- the venue

export function stationVenue(o: VenueOptions): Venue {
  const { cols, rows } = o;
  const wallH = 100;
  const arch = (wall: WallSide, at: number): WindowSpec => ({ wall, at, width: 1.6, sill: 34, top: 90, bars: 1, transom: 30, frame: IRON, shape: "arch" });
  const windows = [arch("right", 5.95), arch("right", 8.15), arch("left", 4.05)];
  const v: Venue = {
    id: "station",
    cols,
    rows,
    floor: marbleFloor(),
    wall: ashlar(),
    wainscot: { surface: tiles(GREEN_TILE, "#476c5b", "#2b4338", 8, 4), height: 26, rail: BRASS },
    cap: "#efe7d4",
    slab: "#a69a84",
    slabHeight: 4,
    wallHeight: wallH,
    windows,
    doors: [],
    lamps: [
      // Pools only: the globes themselves are drawn by `globes` overhead (a bulbs lamp with no run draws nothing).
      { kind: "bulbs", x: 3.0, y: 2.7, z: 70, reach: 3.4 },
      { kind: "bulbs", x: 7.6, y: 3.1, z: 70, reach: 3.4 },
    ],
    wallItems: [
      cornice("right", cols, wallH - 9),
      cornice("left", rows, wallH - 9),
      ...windows.map((w) => archRim(w, IRON)),
      departures(0.45, 44, o.hour),
      poster("right", 3.95, 40),
      stationClock("left", 0.95, 66, o.hour),
      menuBoard("left", 1.85, 44, { w: 38, h: 24, title: "TEA", board: "#24372f", frame: BRASS }),
    ],
    props: [
      palmProp("prop:palm", 0, 0),
      tinCabinetProp("prop:cabinet", 3, 0),
      newsRackProp("prop:news", 9, 0),
      teaChestsProp("prop:chests", 0, 2),
      fernProp("prop:fern", 0, rows - 1),
      signPostProp("prop:post", cols - 1, rows - 1),
    ],
    counter: { top: MARBLE, front: GREEN, side: "#264839", trim: BRASS, panel: "drawers", height: 16 },
    outside: {
      ground: concourseGround(cols, rows),
      view: stationView,
      covered: true,
      noSnow: true,
      props: [
        trainProp("out:train", -4, TRACK1 + 0.2, 24),
        columnProp("out:col1", 1.2, -2.4, 150),
        columnProp("out:col2", 7.4, -2.4, 150),
        columnProp("out:col3", -3.2, 0.6, 150),
        columnProp("out:col4", -3.2, 5.2, 150),
        columnProp("out:col5", cols + 3.4, -1.6, 170),
        gatesProp("out:gates", -5.9, 1.4, 6),
        benchProp("out:bench1", 1.0, rows + 1.6, true),
        luggageProp("out:bags1", 3.3, rows + 1.4, 0),
        lampStandardProp("out:lamp1", 5.4, rows + 1.0),
        benchProp("out:bench2", 6.6, rows + 2.3, true),
        binProp("out:bin", -0.4, rows + 0.7),
        ticketMachineProp("out:tickets", cols + 0.5, 0.0),
        benchProp("out:bench3", cols + 2.0, 0.6, false),
        luggageProp("out:bags2", cols + 1.3, 1.9, 2),
      ],
    },
    front: { height: 18, color: GREEN_TILE, cap: MARBLE, stripe: [BRASS, 2, 12], gapsRight: [3, 4] },
    // Guests come in off the concourse below the frame, queue out through the gap and wait by the serve counter.
    entry: [cols + 3.8, 5.4],
    queue: [
      [8.5, 2.45],
      [9.3, 3.15],
      [10.15, 3.7],
      [10.9, 4.25],
      [11.65, 4.35],
      [12.4, 4.1],
    ],
    pickup: [6.9, 2.3],
    indoorSun: 0.3,
    overhead: globes([
      [3.0, 2.7, 70],
      [7.6, 3.1, 70],
    ], wallH),
    facade: { wall: ashlar(), trim: BRASS, sign: { board: GREEN, ink: "#f1e4c8" }, door: GREEN, neighbours: "none", paint: kioskFront(o.hour), queueAt: 0.8 },
  };
  v.outside.far = shedRoof(v);
  v.floorItems = [medallion(() => v, 3.5, 2.6)];
  return v;
}
