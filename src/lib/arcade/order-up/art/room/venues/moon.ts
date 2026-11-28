/**
 * The Lunar Tea Outpost: a habitat module on the regolith. Riveted pale
 * panels over a blue wainscot, round portholes onto black sky, stars and
 * the Earth, a grated deck, console counters, an airlock with hazard
 * stripes in the back corner, oxygen bottles, a spacesuit on its stand,
 * and a hydroponic shelf of greens under a pink grow light. Outside, grey
 * regolith pocked with craters, a rover, a dish, solar arrays. The sky is
 * black at every hour; the sun still lights the ground hard. In the low
 * gravity, pearls and a cup drift over the counters.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, project, faceLight, type IsoGrid } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { panels, grating, type Surface } from "../surfaces.ts";
import type { Venue, PropSpec, WallItem, FrontBox } from "../types.ts";
import { cafeTable, windowBar, seating } from "../seating.ts";
import { displayCup } from "../front.ts";
import type { VenueOptions } from "./index.ts";
import { menuBoard, clock } from "../walls.ts";
import { INK } from "../props.ts";
import { word, bigWord, bigWidth } from "../font.ts";
import { overlay, litOnce, table, wline, wquad, wdot, wdisc, wring, wword, fpt, fquad, fline, frontWalls, type Box } from "./_frontier-kit.ts";

const PANEL = "#d6d5cf";
const BLUE = "#5f7192";
const TRIM = "#86a6cf";
const HAZARD = "#e0b040";
const HAZARD_D = "#2f2c33";
const SPACE = "#0b0b13";
const PINK = "#e889b8";
const ROCK = "#8f8d89";

/** Riveted panels with a blue trim band near the top. */
const hullWall = overlay(panels(PANEL, "#cfcec8", "#a5a6a3", "#8e9094", 20, 18), [TRIM, "#4f5f7e"], (u, z) => {
  if (z >= 60 && z < 63) return 0;
  if (z >= 63 && z < 64) return 1;
  return -1;
});

const blueWainscot = panels(BLUE, "#5a6b8b", "#46536e", "#3b4660", 20, 22);

/** The grated deck: hazard stripes before the airlock, a pink wash under the grow light, a round hatch in the front corner. */
function deckFloor(cols: number, rows: number): Surface {
  const grate = grating("#8d9298", "#4b4f57", "#70757d");
  const pink = ["#a8909e", "#5e4c58", "#86707e"];
  return overlay(grate, [HAZARD, HAZARD_D, ...pink, "#9aa0a6", "#6f747b"], (u, v) => {
    const x = u / 24;
    const y = v / 24;
    // The airlock's apron.
    if (x > cols - 2 && y < 1.05) return (Math.floor(u + v) % 10) < 5 ? 0 : 1;
    // The grow light's spill, fading out from the shelf.
    const px = x - 0.4;
    const py = y - 1.6;
    const d = Math.sqrt(px * px * 0.8 + py * py * 1.1);
    if (d < 1.6 && noise(Math.floor(u), Math.floor(v), 3) > d / 1.6 - 0.15) return 2 + grate.at(u, v);
    // The hatch.
    const hx = x - (cols - 0.5);
    const hy = y - (rows - 0.5);
    const r = Math.sqrt(hx * hx + hy * hy);
    if (r < 0.42) {
      if (r > 0.33) return Math.floor((Math.atan2(hy, hx) + 4) * 3.2) % 2 ? 0 : 1;
      if (r > 0.3) return 6;
      if (Math.abs(hx + hy) < 0.04 && r < 0.18) return 1;
      return 5;
    }
    return -1;
  });
}

// The outside: grey regolith, craters on a hash grid (one at most a cell), rover tracks, trodden ground round the module.
const CELL = 2.5;
const GROUND = { base: ROCK, alt: "#878581", speck: "#a3a19c", floor: "#7f7d79", rimLit: "#aeaba5", rimDark: "#6c6a66", shadow: "#5a5855", track: "#77756f", pad: "#9a9893" };

function regolith(cols: number, rows: number) {
  return (x: number, y: number, light?: Light) => {
    const sx = light ? light.sunDir[0] : 0.7;
    const sy = light ? light.sunDir[1] : 0.7;
    const out = Math.max(-x, -y, x - cols, y - rows);
    if (out < 0.7) return noise(Math.floor(x * 24), Math.floor(y * 24), 2) > 0.9 ? GROUND.alt : GROUND.pad;
    // The rover's tracks curving in from the left.
    const ty = y + 5.3 - (x - 3) * 0.16 - Math.sin(x * 0.5) * 0.3;
    if (x < 3 && x > -8 && ((ty > -0.05 && ty < 0.05) || (ty > 0.4 && ty < 0.5)) && (Math.floor(x * 12) & 1)) return GROUND.track;
    // A crater in this cell?
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (noise(cx, cy, 21) > 0.5) {
      const r = 0.18 + noise(cx, cy, 23) ** 2 * 0.62;
      const ox = (cx + 0.5) * CELL + (noise(cx, cy, 22) - 0.5) * (CELL - 2 * r - 0.3);
      const oy = (cy + 0.5) * CELL + (noise(cx, cy, 24) - 0.5) * (CELL - 2 * r - 0.3);
      const dx = x - ox;
      const dy = (y - oy) * 1.0;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < r * 1.25) {
        // A raised rim, lit on the sun's side; inside, the shadow of the rim toward the sun, then the floor.
        const toSun = dx * sx + dy * sy;
        if (d > r) return toSun > 0 ? GROUND.rimLit : GROUND.alt;
        if (toSun > r * 0.3 - (r - d) * 0.4) return GROUND.shadow;
        return d > r * 0.8 && toSun < 0 ? GROUND.rimLit : GROUND.floor;
      }
    }
    const n = noise(Math.floor(x * 24), Math.floor(y * 24), 5);
    if (n > 0.96) return GROUND.speck;
    if (n < 0.02) return GROUND.rimDark;
    return noise(Math.floor(x * 3), Math.floor(y * 5), 6) > 0.6 ? GROUND.alt : GROUND.base;
  };
}

/** Black sky at every hour, stars, the Earth, the highlands on the horizon. */
function farSpace(p: Painter, light: Light, width: number, horizon: number) {
  p.rect(SPACE, 0, 0, width, horizon);
  for (let i = 0; i < width * horizon; i += 37) {
    const x = i % width;
    const y = Math.floor(i / width);
    const n = noise(x, y, 31);
    if (n > 0.55) p.rect(n > 0.92 ? "#f3efe0" : n > 0.75 ? "#b8bccb" : "#7f8496", x, y, 1, 1);
  }
  // The Earth, half lit.
  earthDisc(p, Math.round(width * 0.63), 7, 6);
  // Highlands: hard-lit ridges, their shadow side black.
  const lit = light.lit("#a7a49e", 0.8);
  const mid = light.lit("#86837e", 0.4);
  const shade = light.lit("#4f4d4b", 0);
  const sunLeft = light.azimuth > 0;
  for (let x = 0; x < width; x++) {
    let h = 0;
    let left = true;
    for (const [px, ph, pw] of HIGHLANDS) {
      const d = (x - px * width) / pw;
      const v = ph * (1 - d * d);
      if (v > h) {
        h = v;
        left = d < 0;
      }
    }
    const top = Math.round(horizon - h);
    if (h < 0.5) continue;
    p.rect(left === sunLeft ? lit : shade, x, top, 1, horizon - top + 1);
    p.rect(mid, x, horizon - 1, 1, 2);
  }
}

/** Highland domes on the horizon: centre (share of the width), height, half-width in pixels. */
const HIGHLANDS: [number, number, number][] = [[0.04, 7, 30], [0.17, 11, 40], [0.33, 6, 26], [0.5, 9, 36], [0.64, 5, 22], [0.79, 12, 44], [0.95, 8, 30]];

function earthDisc(p: Painter, cx: number, cy: number, r: number) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const d = dx * dx + dy * dy;
      if (d > r * r) continue;
      const land = noise(Math.floor((dx + 20) / 2), Math.floor((dy + 20) / 2), 41) > 0.6;
      const cloud = noise(dx + 30, Math.floor((dy + 30) / 2), 43) > 0.8;
      let c = cloud ? "#e8eef2" : land ? (noise(dx, dy, 44) > 0.5 ? "#6f9a5a" : "#b8a070") : "#3f6fa8";
      if (dx > r * 0.35) c = mixHex(c, SPACE, 0.6);
      else if (d > (r - 1) * (r - 1)) c = mixHex(c, "#9fc0e8", 0.4);
      p.rect(c, cx + dx, cy + dy, 1, 1);
    }
}

// Through the portholes: black, stars, the regolith's edge, the Earth in one of them.
const VIEW = litOnce([
  [ROCK, 0.8],
  ["#5d5b58", 0],
  ["#a7a49e", 0.9],
]);
const HILLS = table(2048, (i) => 0.12 + Math.max(0, Math.sin(i / 7) * 0.05 + Math.sin(i / 17 + 2) * 0.06) + noise(i >> 1, 3, 3) * 0.02);

function portholeView(u: number, v: number, light: Light, wall: string, height: number) {
  const iu = Math.floor(u) & 2047;
  const h = HILLS[iu];
  if (v < h) {
    const c = VIEW(light);
    return v > h - 0.03 ? c[2] : HILLS[(iu + 1) & 2047] > h ? c[1] : c[0];
  }
  // The Earth through the left wall's first porthole, and high in the order window.
  const ex = height >= 30 ? u - 160 : u - 1072;
  const ey = (v - 0.62) * height;
  const d = ex * ex + ey * ey;
  if (d < 64) {
    const land = noise(Math.floor((ex + 20) / 3), Math.floor((ey + 20) / 3), 41) > 0.58;
    const cloud = noise(Math.floor(ex + 30), Math.floor((ey + 30) / 2), 43) > 0.78;
    if (ex > 3) return cloud ? "#5f6670" : land ? "#2f3a2c" : "#1c2c44";
    if (d > 49) return "#9fc0e8";
    return cloud ? "#e8eef2" : land ? "#6f9a5a" : "#3f6fa8";
  }
  const s = noise(iu, Math.floor(v * height), 7);
  if (s > 0.985) return "#f3efe0";
  if (s > 0.97) return "#8f94a6";
  return SPACE;
}

// Things standing outside.

function roverProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    w: 1.6,
    d: 1,
    height: 30,
    pad: 8,
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const body: Box = [0.15, 0.15, 1.3, 0.7];
      for (const u of [0.25, 0.8, 1.35])
        for (const v of [0.1, 0.9]) {
          const q = project(g, u, v, 4);
          p.oval(INK, q.x, q.y, 4, 4);
          p.oval(light.lit("#5d5b58", f.left * 0.4), q.x, q.y, 3, 3);
          p.rect(light.lit("#a7a49e", f.top), q.x - 1, q.y - 2, 2, 1);
        }
      isoBox(p, g, light, ...body, 6, { top: "#d6d5cf", left: "#c9c8c2", right: "#a9a8a2" }, 6);
      fquad(p, g, "left", body, 0.1, 0.9, 7, 9, light.lit(TRIM, f.left));
      // Seat, mast, a small dish.
      isoBox(p, g, light, 0.5, 0.3, 0.4, 0.4, 5, { top: "#3a3f4a" }, 12);
      isoBox(p, g, light, 0.5, 0.28, 0.4, 0.06, 10, { top: "#3a3f4a" }, 12);
      const m = project(g, 1.25, 0.3, 12);
      p.rect(light.lit("#8e9094", f.left), m.x, m.y - 14, 1, 14);
      p.oval(light.lit("#e6e5df", f.top), m.x, m.y - 16, 4, 2);
      p.rect(INK, m.x, m.y - 19, 1, 2);
      const lamp = project(g, 1.45, 0.5, 10);
      p.rect(light.night > 0.3 ? "#fff0c0" : light.lit("#f3ecd6", 0.6), lamp.x, lamp.y - 1, 2, 2);
    },
  };
}

function dishProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 46,
    pad: 14,
    shadow: "round",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 7, 2));
      isoBox(p, g, light, 0.3, 0.3, 0.4, 0.4, 5, { top: "#a9a8a2" });
      p.rect(INK, b.x - 2, b.y - 30, 4, 26);
      p.rect(light.lit("#c9c8c2", f.left), b.x - 1, b.y - 30, 2, 26);
      // The bowl, tipped up toward the Earth.
      const cx = b.x + 2;
      const cy = b.y - 34;
      for (let r = 0; r < 12; r++) {
        const half = Math.round(Math.sqrt(144 - (r - 6) * (r - 6) * 3.4));
        const y = cy - 6 + r;
        if (half <= 0) continue;
        p.rect(INK, cx - half - 1, y, half * 2 + 3, 1);
        p.rect(light.lit(r < 6 ? "#e6e5df" : "#b9b8b2", r < 6 ? f.top : f.left * 0.5), cx - half, y, half * 2 + 1, 1);
      }
      p.line(light.lit("#8e9094", 0.2), cx, cy, cx + 6, cy - 9);
      p.line(light.lit("#8e9094", 0.2), cx, cy, cx - 6, cy - 9);
      p.rect(light.lit("#c2493c", 0.5), cx - 1, cy - 11, 2, 2);
    },
  };
}

/** A row of solar panels, tilted to the sun. */
function solarProp(key: string, x: number, y: number, alongX: boolean, n: number): PropSpec {
  return {
    key,
    x,
    y,
    w: alongX ? n : 0.9,
    d: alongX ? 0.9 : n,
    height: 18,
    pad: 4,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      for (let k = 0; k < n; k++) {
        const [u, v] = alongX ? [k, 0] : [0, k];
        const at = (a: number, b: number, z: number) => project(g, u + (alongX ? a : b), v + (alongX ? b : a), z);
        for (const t of [0.2, 0.8]) {
          const leg = at(t, 0.3, 0);
          p.rect(light.lit("#6f7883", 0.3), leg.x, leg.y - 14, 1, 14);
        }
        // Facing the near side (the sun's side at noon): high at the back, low at the front.
        const A = at(0.04, 0.1, 17);
        const B = at(0.96, 0.1, 17);
        const C = at(0.96, 0.85, 5);
        const D = at(0.04, 0.85, 5);
        p.poly(INK, [A.x, A.y - 1, B.x, B.y - 1, C.x, C.y + 1, D.x, D.y + 1]);
        p.poly(light.lit("#2f4a7a", f.top * 0.6), [A.x, A.y, B.x, B.y, C.x, C.y, D.x, D.y]);
        for (let t = 0.25; t < 1; t += 0.25) {
          const a1 = at(0.04 + t * 0.92, 0.1, 17);
          const a2 = at(0.04 + t * 0.92, 0.85, 5);
          p.line(light.lit("#6f8fc0", 0.3), a1.x, a1.y, a2.x, a2.y);
        }
        const m1 = at(0.04, 0.47, 10);
        const m2 = at(0.96, 0.47, 10);
        p.line(light.lit("#6f8fc0", 0.3), m1.x, m1.y, m2.x, m2.y);
        p.line(light.lit("#b8cff0", Math.min(1, f.top + 0.3)), A.x + 1, A.y, B.x - 1, B.y);
      }
    },
  };
}

/** A mast with a beacon that blinks red. */
function beaconProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 44,
    pad: 8,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.25, () => p.rect(INK, b.x - 3, b.y - 1, 7, 2));
      for (let z = 0; z < 40; z += 4) {
        p.line(light.lit("#a9a8a2", f.left), b.x - 2, b.y - z, b.x + 2, b.y - z - 4);
        p.line(light.lit("#a9a8a2", f.left), b.x + 2, b.y - z, b.x - 2, b.y - z - 4);
      }
      p.rect(INK, b.x - 2, b.y - 43, 5, 4);
      p.rect(light.night > 0.2 ? "#ff6a5a" : light.lit("#c2493c", 0.6, 1), b.x - 1, b.y - 42, 3, 2);
      if (light.night > 0.2) p.alpha(0.35 * light.night, () => p.oval("#ff6a5a", b.x, b.y - 41, 6, 5));
    },
  };
}

/** Supply canisters stacked by the dish. */
function canistersProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 18,
    pad: 3,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      for (const [u, v, c] of [[0.3, 0.3, "#d6d5cf"], [0.65, 0.4, HAZARD], [0.4, 0.7, "#d6d5cf"]] as const) {
        const q = project(g, u, v, 0);
        p.rect(INK, q.x - 4, q.y - 12, 9, 12);
        p.rect(light.lit(c, f.left), q.x - 3, q.y - 11, 7, 11);
        p.rect(light.lit(mixHex(c, INK, 0.3), 0), q.x + 2, q.y - 11, 2, 11);
        p.oval(light.lit(mixHex(c, "#ffffff", 0.2), f.top), q.x, q.y - 12, 3, 1);
        p.rect(light.lit(BLUE, 0.3), q.x - 3, q.y - 6, 7, 1);
      }
    },
  };
}

// Things standing in the module.

/** The airlock: a bulkhead out of the back corner, hazard frame, a hatch door with a porthole and a status light. */
function airlockProp(cols: number, share: number): PropSpec {
  return {
    key: "prop:airlock",
    x: cols - 2,
    y: 0,
    w: 2,
    d: 0.6,
    height: 80,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const b: Box = [0.02, 0, 1.96, 0.55];
      isoBox(p, g, light, ...b, 76, { top: "#c9c8c2", left: PANEL, right: "#b5b4ae" }, 0, share);
      // Panel seams and rivets on the side.
      for (const z of [20, 40, 60]) fline(p, g, "right", b, 0, z, 1, z, light.lit("#a5a6a3", f.right * 0.5));
      // The hazard frame round the opening.
      const s0 = 0.22;
      const s1 = 0.78;
      const top = 58;
      for (let s = s0 - 0.08; s < s1 + 0.08; s += 1 / 96) {
        const band = Math.floor(s * 96) % 6 < 3;
        const a = fpt(g, "left", b, s, top + 6);
        const c = band ? light.lit(HAZARD, f.left) : light.lit(HAZARD_D, 0);
        p.rect(c, a.x, a.y, 1, 5);
      }
      for (const [sa, sb] of [[s0 - 0.08, s0], [s1, s1 + 0.08]] as const)
        for (let z = 0; z < top + 6; z++) {
          const band = Math.floor((z + (sa > 0.5 ? 2 : 0)) / 4) % 2 === 0;
          fline(p, g, "left", b, sa, z, sb, z, band ? light.lit(HAZARD, f.left) : light.lit(HAZARD_D, 0));
        }
      // The door.
      fquad(p, g, "left", b, s0, s1, 0, top, light.lit("#9aa3ad", f.left));
      fline(p, g, "left", b, 0.5, 0, 0.5, top, light.lit("#6f7883", 0.1));
      fline(p, g, "left", b, s0, top, s1, top, light.lit(INK, 0));
      // Its porthole, the corridor light beyond.
      const w = fpt(g, "left", b, 0.5, 40);
      p.oval(INK, w.x, w.y, 6, 6);
      p.oval(light.lit("#6f7883", 0.3), w.x, w.y, 5, 5);
      p.oval(light.night > 0.2 ? "#f3dca0" : light.lit("#c9d6de", 0.5), w.x, w.y, 3, 3);
      // A wheel handle and the status light.
      const hw = fpt(g, "left", b, 0.5, 24);
      p.oval(INK, hw.x, hw.y, 4, 4);
      p.oval(light.lit("#9aa3ad", f.left), hw.x, hw.y, 3, 3);
      p.rect(INK, hw.x - 3, hw.y, 7, 1);
      p.rect(INK, hw.x, hw.y - 3, 1, 7);
      const st = fpt(g, "left", b, 0.86, 50);
      p.rect(INK, st.x - 1, st.y - 1, 5, 4);
      p.rect(light.lit("#6fd08a", 0.6, 1), st.x, st.y, 3, 2);
      if (light.night > 0.2) p.alpha(0.3, () => p.oval("#6fd08a", st.x + 1, st.y + 1, 4, 3));
      // The word over it.
      const t = fpt(g, "left", b, 0.24, 72);
      word(p, "AIRLOCK", light.lit(BLUE, 0.2), t.x, t.y, 0.5);
    },
  };
}

/** Oxygen bottles strapped in the corner. */
function tanksProp(share: number): PropSpec {
  return {
    key: "prop:o2",
    x: 0,
    y: 0,
    height: 50,
    pad: 4,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const tanks: [number, number, number][] = [[0.3, 0.3, 44], [0.65, 0.3, 40], [0.3, 0.68, 40]];
      for (const [u, v, h] of tanks) {
        const q = project(g, u, v, 0);
        p.alpha(0.3, () => p.oval(INK, q.x, q.y, 5, 2));
        p.rect(INK, q.x - 5, q.y - h, 11, h);
        p.rect(light.lit("#5f8a66", f.left), q.x - 4, q.y - h + 2, 9, h - 2);
        p.rect(light.lit("#4a6e52", 0), q.x + 2, q.y - h + 2, 3, h - 2);
        p.rect(light.lit("#8fb894", f.top), q.x - 3, q.y - h + 3, 1, h - 6);
        p.oval(INK, q.x, q.y - h, 5, 2);
        p.oval(light.lit("#e6e5df", f.top), q.x, q.y - h, 4, 1);
        p.rect(INK, q.x - 1, q.y - h - 5, 3, 4);
        p.rect(light.lit("#c9ccc8", 0.5), q.x, q.y - h - 4, 1, 3);
        p.rect(light.lit("#efe9dc", f.left), q.x - 4, q.y - h + 8, 9, 3);
        word(p, "O2", light.lit("#3a3f4a", 0.2), q.x - 3, q.y - h + 13);
        p.rect(light.lit(HAZARD, 0.3), q.x - 4, q.y - 12, 9, 2);
      }
    },
  };
}

/** Trays of greens on a three-tier rack, under a pink grow light. */
function hydroProp(share: number): PropSpec {
  return {
    key: "prop:hydro",
    x: 0,
    y: 1,
    height: 44,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const glow = (c: string) => light.lit(c, Math.max(0.4, f.top), 0.3);
      for (const [u, v] of [[0.1, 0.1], [0.1, 0.84], [0.62, 0.1], [0.62, 0.84]] as const) isoBox(p, g, light, u, v, 0.06, 0.06, 40, { top: "#b5b4ae", ink: INK }, 0, share);
      for (const z of [4, 18, 32]) {
        isoBox(p, g, light, 0.1, 0.1, 0.58, 0.8, 3, { top: "#3f4a5a", left: "#c9c8c2", right: "#b5b4ae" }, z, share);
        for (let k = 0; k < 3; k++) {
          const q = project(g, 0.38, 0.22 + k * 0.27, z + 3);
          const leaf = glow(k === 1 ? "#8fc06a" : "#78b05a");
          const dark = glow("#4f7a4a");
          p.rect(INK, q.x - 5, q.y - 4, 11, 4);
          p.rect(dark, q.x - 4, q.y - 3, 9, 3);
          p.rect(leaf, q.x - 4, q.y - 5, 3, 3);
          p.rect(leaf, q.x + 2, q.y - 5, 3, 3);
          p.rect(leaf, q.x - 1, q.y - 7, 3, 4);
          p.rect(light.lit("#f0b8d8", 0.6, 0.6), q.x, q.y - 7, 1, 1);
          p.rect(light.lit("#f0b8d8", 0.6, 0.6), q.x - 4, q.y - 5, 1, 1);
          if (z === 18 && k === 2) p.rect(light.lit("#c2493c", 0.5, 0.4), q.x + 2, q.y - 4, 2, 2);
        }
        // The pink strip under the shelf above.
        const a = project(g, 0.15, 0.15, z + 13);
        const c = project(g, 0.15, 0.85, z + 13);
        if (z < 32) p.line(light.lit("#ff9fd0", 0.6, 1), a.x, a.y, c.x, c.y);
      }
      // The grow light's bar over the top.
      const a = project(g, 0.2, 0.08, 44);
      const c = project(g, 0.2, 0.92, 44);
      p.line(INK, a.x, a.y - 1, c.x, c.y - 1);
      p.line(light.lit("#ff9fd0", 0.6, 1), a.x, a.y, c.x, c.y);
      p.line(light.lit(PINK, 0.4, 1), a.x, a.y + 1, c.x, c.y + 1);
    },
  };
}

/** A spacesuit on its stand by the airlock, helmet on. */
function suitProp(x: number, y: number, share: number): PropSpec {
  return {
    key: "prop:suit",
    x,
    y,
    height: 50,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const b = project(g, 0.5, 0.45, 0);
      const white = light.lit("#e6e5df", f.left);
      const shade = light.lit("#b9b8b2", 0.1);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 7, 2));
      isoBox(p, g, light, 0.25, 0.2, 0.5, 0.5, 2, { top: "#5d5b58" }, 0, share);
      // Legs, body, pack, arms, helmet.
      for (const dx of [-4, 1]) {
        p.rect(INK, b.x + dx - 1, b.y - 18, 6, 16);
        p.rect(white, b.x + dx, b.y - 17, 4, 14);
        p.rect(shade, b.x + dx + 3, b.y - 17, 1, 14);
        p.rect(light.lit("#5d5b58", 0.2), b.x + dx, b.y - 5, 4, 3);
      }
      p.rect(INK, b.x - 8, b.y - 36, 17, 20);
      p.rect(light.lit("#c9c8c2", f.left), b.x - 9, b.y - 37, 4, 16);
      p.rect(white, b.x - 6, b.y - 35, 13, 18);
      p.rect(shade, b.x + 5, b.y - 35, 2, 18);
      p.rect(light.lit(TRIM, f.left), b.x - 6, b.y - 24, 13, 2);
      p.rect(light.lit("#3a3f4a", 0.2), b.x - 3, b.y - 32, 6, 4);
      p.rect(light.lit("#c2493c", 0.5, 0.5), b.x - 2, b.y - 31, 1, 1);
      p.rect(light.lit("#6fd08a", 0.5, 0.5), b.x + 1, b.y - 31, 1, 1);
      for (const dx of [-10, 8]) {
        p.rect(INK, b.x + dx - 1, b.y - 35, 5, 16);
        p.rect(white, b.x + dx, b.y - 34, 3, 14);
        p.rect(light.lit("#5d5b58", 0.2), b.x + dx, b.y - 21, 3, 2);
      }
      p.oval(INK, b.x, b.y - 42, 7, 7);
      p.oval(white, b.x, b.y - 42, 6, 6);
      p.oval(light.lit("#c99a3a", 0.6), b.x, b.y - 41, 4, 3);
      p.rect(light.lit("#f3dca0", 0.8), b.x - 3, b.y - 43, 2, 1);
    },
  };
}

/** The water recycler: a tall tank, pipes into the wall, a gauge. */
function recyclerProp(rows: number, share: number): PropSpec {
  return {
    key: "prop:recycler",
    x: 0,
    y: rows - 1,
    height: 60,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const q = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, q.x, q.y, 9, 3));
      const h = 50;
      p.rect(INK, q.x - 9, q.y - h, 19, h);
      p.rect(light.lit("#c9c8c2", f.left), q.x - 8, q.y - h + 1, 17, h - 2);
      p.rect(light.lit("#a9a8a2", 0), q.x + 4, q.y - h + 1, 5, h - 2);
      p.rect(light.lit("#e6e5df", f.top), q.x - 6, q.y - h + 2, 1, h - 6);
      p.oval(INK, q.x, q.y - h, 9, 3);
      p.oval(light.lit("#e6e5df", f.top), q.x, q.y - h, 8, 2);
      // A sight glass with water in it.
      p.rect(INK, q.x - 3, q.y - 40, 5, 26);
      p.rect(light.lit("#3a4a5a", 0.1), q.x - 2, q.y - 39, 3, 24);
      p.rect(light.lit("#6fa8d8", 0.4, 0.3), q.x - 2, q.y - 28, 3, 13);
      word(p, "H2O", light.lit(BLUE, 0.3), q.x - 5, q.y - 47);
      p.rect(light.lit(TRIM, f.left), q.x - 8, q.y - 10, 17, 2);
      // Pipes into the wall.
      const w = project(g, 0.05, 0.5, 30);
      p.rect(light.lit("#8e9094", 0.3), w.x, q.y - 32, q.x - 8 - w.x, 2);
      p.rect(light.lit("#c2493c", 0.3), w.x, q.y - 22, q.x - 8 - w.x, 2);
      const gg = project(g, 0.5, 0.5, 8);
      p.oval(INK, gg.x + 2, gg.y, 3, 3);
      p.oval(light.lit("#efe9dc", 0.4), gg.x + 2, gg.y, 2, 2);
    },
  };
}

// Things on the walls.

/** A porthole's rim: a thick steel ring with bolts. */
function portRim(wall: "left" | "right", at: number, sill: number, top: number, tiles: number): WallItem {
  return {
    wall,
    at,
    z: 0,
    draw(p, light, place) {
      const c = (tiles * 24) / 2;
      const cu = (sill + top) / 2;
      const r = (top - sill) / 2;
      for (let k = 0; k < 3; k++) wring(p, place, c, cu, r + 1 + k, light.lit(k === 2 ? INK : k === 1 ? "#9aa3ad" : "#c9ccd2", 0.3));
      wring(p, place, c, cu, r, light.lit("#5d6470", 0.1));
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * Math.PI * 2 + 0.4;
        wdot(p, place, c + Math.cos(t) * (r + 2), cu + Math.sin(t) * (r + 2), light.lit("#6f7883", 0.2));
      }
    },
  };
}

/** The pink wash the grow light throws on the wall behind the shelf. */
function pinkWash(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      p.alpha(0.18, () => wdisc(p, place, 12, 10, 20, light.lit(PINK, 0.5, 1), 16));
      p.alpha(0.18, () => wdisc(p, place, 12, 8, 12, light.lit(PINK, 0.5, 1), 10));
    },
  };
}

/** A bundle of cables along the top of a wall, clipped every so often. */
function cableRun(wall: "left" | "right", z: number, tiles: number): WallItem {
  return {
    wall,
    at: 0,
    z,
    draw(p, light, place) {
      const w = tiles * 24;
      const cols = ["#4f5f7e", "#c2493c", HAZARD, "#3a3f4a"];
      cols.forEach((c, i) => wline(p, place, 0, -i, w, -i, light.lit(c, 0.3)));
      for (let a = 10; a < w; a += 28) wquad(p, place, a, -4, 2, 6, light.lit("#9aa3ad", 0.3));
    },
  };
}

/** A sign giving the gravity, so nobody lets go of a cup. */
function gravitySign(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wquad(p, place, -2, -2, 35, 11, light.lit(HAZARD_D, 0.2));
      wquad(p, place, -1, -1, 33, 9, light.lit(HAZARD, 0.4));
      wword(p, place, 2, 6, "0.16 G", light.lit(HAZARD_D, 0.1));
    },
  };
}

/** A round mission patch. */
function patch(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wdisc(p, place, 8, 8, 8, light.lit(HAZARD_D, 0.2));
      wdisc(p, place, 8, 8, 7, light.lit(BLUE, 0.3));
      wdisc(p, place, 8, 6, 3, light.lit("#d6d5cf", 0.5));
      wdisc(p, place, 11, 11, 1.5, light.lit("#6f9a5a", 0.4));
      wline(p, place, 2, 4, 14, 4, light.lit(HAZARD, 0.4));
    },
  };
}

/** Handholds by the portholes. */
function handhold(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wline(p, place, 0, 0, 14, 0, light.lit(HAZARD, 0.4));
      wline(p, place, 0, 0, 0, -2, light.lit("#8e9094", 0.2));
      wline(p, place, 14, 0, 14, -2, light.lit("#8e9094", 0.2));
    },
  };
}

// The outpost from the regolith, front on.

/** The habitat dome seen from the landing pad: panelled, a blue band, a porthole, the airlock on the right. */
function domeFront(p: Painter, light: Light, box: FrontBox) {
  const lit = (hex: string, f = 0.7, g = 0) => light.lit(hex, f, g);
  const { ground } = box;
  const night = light.night > 0.4;
  const cx = box.x + Math.round(box.w * 0.42);
  const base = ground - 10;
  const rx = 66;
  const ry = 74;
  // The plinth it sits on, its shadow on the regolith.
  p.alpha(0.35, () => p.rect(INK, cx - rx - 6, ground - 2, rx * 2 + 60, 4));
  p.rect(INK, cx - rx - 3, base - 1, rx * 2 + 6, 11);
  p.rect(lit("#8c8f96", 0.6), cx - rx - 2, base, rx * 2 + 4, 9);
  for (let x = cx - rx; x < cx + rx; x += 12) p.rect(lit("#6f7883", 0.3), x, base + 2, 2, 7);
  // The dome: panels in rings and gores, lit from the sun's side.
  const sunLeft = light.azimuth > 0;
  for (let y = base - ry; y < base; y++) {
    const t = (base - y) / ry;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    if (half <= 0) continue;
    p.rect(INK, cx - half - 1, y, half * 2 + 3, 1);
    for (let x = cx - half; x <= cx + half; x++) {
      const across = (x - cx) / Math.max(1, half);
      const gore = Math.abs(Math.round(across * 5) - across * 5) < 0.06;
      const ring = (base - y) % 15 === 0;
      const lightSide = sunLeft ? across < -0.2 : across > 0.2;
      const shadeSide = sunLeft ? across > 0.55 : across < -0.55;
      const tone = gore || ring ? "#a5a6a3" : lightSide ? "#e2e1dc" : shadeSide ? "#bdbcb6" : PANEL;
      p.rect(lit(tone, lightSide ? 0.9 : 0.5), x, y, 1, 1);
    }
  }
  p.rect(INK, cx - 1, base - ry - 1, 3, 1);
  // The blue band round its foot, the name on it.
  p.rect(INK, cx - rx, base - 17, rx * 2 + 1, 15);
  p.rect(lit(BLUE, 0.6), cx - rx + 1, base - 16, rx * 2 - 1, 13);
  p.rect(lit(TRIM, 0.8), cx - rx + 1, base - 16, rx * 2 - 1, 1);
  const name = box.name.toUpperCase();
  const tw = bigWidth(name);
  if (tw < rx * 2 - 6) bigWord(p, name, lit("#eef2f6", 0.8, 0.4), Math.round(cx - tw / 2), base - 13);
  else word(p, name, lit("#eef2f6", 0.8, 0.4), Math.round(cx - (name.length * 4 - 1) / 2), base - 12);
  // A porthole with the drink in it, warm inside.
  const py = base - 44;
  p.oval(INK, cx, py, 15, 15);
  p.oval(lit("#9aa3ad", 0.7), cx, py, 14, 14);
  p.oval(lit("#c9ccd2", 0.9), cx - 1, py - 1, 12, 12);
  p.oval(box.open || night ? (night ? "#f0d8a0" : lit("#e9dcc2", 0.5)) : lit("#3a3f4a", 0.2), cx, py, 10, 10);
  if (box.display && box.open) displayCup(p, light, box.display, cx, py + 7);
  p.alpha(0.5, () => p.line(lit("#ffffff", 1), cx - 6, py - 4, cx - 2, py - 8));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    p.rect(lit("#6f7883", 0.3), cx + Math.round(Math.cos(a) * 13), py + Math.round(Math.sin(a) * 13), 1, 1);
  }
  // A dish on top, the beacon beside it.
  p.rect(lit("#a9a8a2", 0.6), cx + 20, base - ry + 2, 2, 8);
  p.oval(INK, cx + 21, base - ry, 8, 4);
  p.oval(lit("#e6e5df", 0.8), cx + 21, base - ry - 1, 7, 3);
  p.rect(INK, cx - 24, base - ry + 6, 3, 10);
  p.rect(light.night > 0.2 ? "#ff6a5a" : lit("#c2493c", 0.6), cx - 24, base - ry + 3, 3, 3);
  // The airlock: a box out of the dome's right side, hazard frame, hatch door, status light.
  const ax = cx + rx - 14;
  const aw = 42;
  const ay = base - 46;
  p.rect(INK, ax - 1, ay - 1, aw + 2, base - ay + 1);
  p.rect(lit(PANEL, 0.7), ax, ay, aw, base - ay);
  p.rect(lit("#e2e1dc", 0.9), ax, ay, aw, 2);
  p.rect(lit(TRIM, 0.7), ax, ay + 8, aw, 2);
  const dx = ax + 9;
  const dw = 24;
  const dy = ay + 13;
  for (let y = dy - 3; y < base; y++)
    for (let x = dx - 3; x < dx + dw + 3; x++) {
      if (x >= dx && x < dx + dw && y >= dy) continue;
      p.rect(lit(Math.floor((x + y) / 3) % 2 ? HAZARD : HAZARD_D, 0.6), x, y, 1, 1);
    }
  p.rect(lit("#9aa3ad", 0.6), dx, dy, dw, base - dy);
  p.rect(lit("#6f7883", 0.3), dx + dw / 2, dy, 1, base - dy);
  p.oval(INK, dx + dw / 2, dy + 8, 4, 4);
  p.oval(night || box.open ? "#f3dca0" : lit("#c9d6de", 0.5), dx + dw / 2, dy + 8, 3, 3);
  const st = box.open ? lit("#6fd08a", 0.6, 1) : lit("#c2493c", 0.6, 1);
  p.rect(INK, ax + aw - 6, ay + 14, 5, 5);
  p.rect(st, ax + aw - 5, ay + 15, 3, 3);
  if (light.night > 0.2) p.alpha(0.3, () => p.oval(box.open ? "#6fd08a" : "#c2493c", ax + aw - 4, ay + 16, 4, 3));
  word(p, box.open ? "OPEN" : "SHUT", lit(BLUE, 0.4), dx + 5, ay + 3);
  // Footprints and a ramp down to the regolith.
  p.rect(INK, dx - 4, base, dw + 8, 2);
  p.rect(lit("#a9a8a2", 0.6), dx - 3, base + 2, dw + 6, ground - base - 2);
  for (let k = 0; k < 4; k++) p.rect(lit("#6c6a66", 0.2), dx + 4 + k * 6, ground + 2 + (k % 2) * 3, 3, 1);
  // An oxygen bottle rack and a rover parked on the left.
  const rx0 = box.x - 46;
  for (const wx of [rx0 + 6, rx0 + 22, rx0 + 38]) {
    p.oval(INK, wx, ground - 5, 5, 5);
    p.oval(lit("#5d5b58", 0.3), wx, ground - 5, 4, 4);
  }
  p.rect(INK, rx0 - 1, ground - 19, 48, 11);
  p.rect(lit("#d6d5cf", 0.7), rx0, ground - 18, 46, 9);
  p.rect(lit(TRIM, 0.7), rx0, ground - 12, 46, 2);
  p.rect(lit("#3a3f4a", 0.3), rx0 + 12, ground - 26, 14, 8);
  p.rect(lit("#8e9094", 0.4), rx0 + 38, ground - 34, 1, 15);
  p.oval(lit("#e6e5df", 0.7), rx0 + 38, ground - 36, 4, 2);
}

const TUBES: [number, number][] = [[3.4, 3.0], [5.6, 4.6], [2.4, 5.6]];

/** Pearls, a cup and a tea bag adrift over the room: low gravity. The light panels' hangers too. */
function adrift(p: Painter, g: IsoGrid, light: Light) {
  const rod = light.lit("#8e9094", 0.3);
  for (const [x, y] of TUBES) {
    const at = project(g, x, y, 76);
    for (const dx of [-7, 7]) p.rect(rod, at.x + dx, at.y - 9, 1, 8);
  }
  const pearl = light.lit("#3a2a2c", 0.3);
  const hi = light.lit("#a88a7a", 0.6);
  // A cup adrift, its pearls rising out of the straw in a line.
  const c = project(g, 4.8, 2.6, 52);
  const cupGrid = ["..OO....", "..OSO...", "OOOSOOO.", "OLLLLLO.", ".OTTTTO.", ".OTTTTO.", ".OTTTTO.", ".OPTPTO.", "..OPPO..", "..OOOO.."];
  const cupPal = { O: INK, S: light.lit("#e8b46a", 0.5), L: light.lit("#f3eee6", 0.6), T: light.lit("#c08a62", 0.5), P: pearl };
  p.sprite(cupGrid, cupPal, c.x - 4, c.y - 10);
  const pearls: [number, number][] = [[-1, -14], [1, -19], [-2, -24], [2, -29], [0, -34]];
  for (const [dx, dy] of pearls) {
    p.rect(INK, c.x + dx - 1, c.y + dy - 1, 4, 4);
    p.rect(pearl, c.x + dx, c.y + dy, 2, 2);
    p.rect(hi, c.x + dx, c.y + dy, 1, 1);
  }
  for (const [dx, dy] of [[5, -17], [-5, -22], [4, -27]] as const) p.rect(light.lit("#c08a62", 0.5), c.x + dx, c.y + dy, 1, 1);
  // A tea bag on its string.
  const t = project(g, 2.3, 4.6, 48);
  p.line(light.lit("#e8dcc4", 0.4), t.x, t.y, t.x + 5, t.y - 6);
  p.rect(INK, t.x - 3, t.y - 1, 5, 6);
  p.rect(light.lit("#e8d8b0", 0.5), t.x - 2, t.y, 3, 4);
  p.rect(light.lit("#c9573f", 0.5), t.x + 4, t.y - 8, 3, 3);
}

export function moonVenue(o: VenueOptions): Venue {
  const { cols, rows } = o;
  // A round table for three, and stools at the window onto the plain.
  const sit = seating(
    cafeTable("moon-table", 2.2, 4.6, ["-x", "-y", "+x"], { wood: BLUE, seat: TRIM, top: PANEL, metal: "#8d929a" }),
    windowBar("moon-bar", "front-left", 1.2, 4.2, 2, { cols, rows, wall: 18 }, { wood: BLUE, seat: PINK, top: PANEL, metal: "#8d929a" }),
  );
  const share = 0.3;
  const port = { sill: 30, top: 59, width: 1.2 };
  const holes = [
    { wall: "left" as const, at: 2.5 },
    { wall: "left" as const, at: 4.6 },
    { wall: "right" as const, at: 1.0 },
    { wall: "right" as const, at: 4.75 },
  ];
  return {
    id: "moon",
    cols,
    rows,
    floor: deckFloor(cols, rows),
    wall: hullWall,
    wainscot: { surface: blueWainscot, height: 22, rail: TRIM },
    cap: "#e2e1dc",
    slab: "#8c8f96",
    slabHeight: 10,
    windows: holes.map((h) => ({ wall: h.wall, at: h.at, width: port.width, sill: port.sill, top: port.top, shape: "round" as const })),
    doors: [],
    lamps: [
      ...TUBES.map(([x, y]) => ({ kind: "tube" as const, x, y, z: 76, reach: 3 })),
    ],
    wallItems: [
      cableRun("left", 72, rows),
      cableRun("right", 72, cols),
      pinkWash("left", 0.9, 28),
      ...holes.map((h) => portRim(h.wall, h.at, port.sill, port.top, port.width)),
      handhold("left", 2.6, 26),
      handhold("left", 4.7, 26),
      patch("left", 3.75, 46),
      menuBoard("right", 2.35, 32, { w: 38, h: 20, title: "TEA", board: "#20262e", frame: "#6f7883" }),
      clock("right", 4.5, 56, o.hour, "#3a3f4a"),
      gravitySign("right", 2.3, 64),
      handhold("right", 1.05, 26),
    ],
    props: [
      ...sit.props,
      airlockProp(cols, share),
      tanksProp(share),
      hydroProp(share),
      suitProp(cols - 3, 0.05, share),
      recyclerProp(rows, share),
      ...frontWalls(cols, rows, {
        key: "front:moon",
        height: 18,
        top: "#e2e1dc",
        face: PANEL,
        draw(p, g, light, face, box) {
          const f = faceLight(light, 0.6);
          const l = face === "left" ? f.left : f.right;
          fline(p, g, face, box, 0, 8, 1, 8, light.lit(TRIM, l));
          fline(p, g, face, box, 0, 9, 1, 9, light.lit(TRIM, l));
          fline(p, g, face, box, 0.5, 1, 0.5, 17, light.lit("#a5a6a3", l * 0.5));
          for (const s of [0.12, 0.38, 0.62, 0.88]) {
            const q = fpt(g, face, box, s, 14);
            p.rect(light.lit("#8e9094", 0.2), q.x, q.y, 1, 1);
          }
        },
      }),
    ],
    counter: { top: "#cfd3d8", front: "#8f97a3", side: "#76808c", trim: "#b7bec7", panel: "console", height: 16 },
    outside: {
      ground: regolith(cols, rows),
      far: farSpace,
      view: portholeView,
      noSnow: true,
      props: [
        roverProp("out:rover", 2.6, -5.8),
        dishProp("out:dish", -5.0, 1.0),
        canistersProp("out:cans", -4.2, 2.4),
        solarProp("out:solar-l", 0.6, rows + 1.0, true, 3),
        solarProp("out:solar-r", cols + 1.2, 0.4, false, 3),
        beaconProp("out:beacon", cols + 1.0, 4.4),
      ],
    },
    // In through the airlock and down the serve counter's open side, clear of it both ways.
    // Out of the airlock's door, the line back up toward it; out again down the far side of the line.
    seats: sit.seats,
    doorway: { wall: "right", from: cols - 1.55, to: cols - 0.45 },
    entry: [cols - 1.0, 0.8],
    queue: [
      [5.5, 3.4],
      [6.2, 3.55],
      [6.85, 3.25],
      [6.85, 2.5],
      [6.85, 1.75],
      [6.85, 1.05],
    ],
    pickup: [4.75, 3.5],
    out: [
      [5.2, 4.4],
      [7.45, 4.2],
      [7.45, 1.2],
    ],
    indoorSun: share,
    overhead: adrift,
    facade: {
      wall: hullWall,
      trim: TRIM,
      sign: { board: BLUE, ink: "#eef2f6" },
      door: "#9aa3ad",
      paint: domeFront,
      neighbours: "none",
      queueAt: 0.88,
    },
  };
}
