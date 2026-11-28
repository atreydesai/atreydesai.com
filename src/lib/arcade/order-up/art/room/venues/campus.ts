/**
 * The Campus Kiosk: a tea counter in the student union, looking onto the
 * quad. Cream plaster over oak panelling, a terrazzo floor with brass
 * strips, navy counters trimmed in gold, navy and gold pennants along the
 * walls, a cork board thick with flyers, a bookcase, and the brass class
 * bell by the serving counter. Big arched windows look over the lawns to
 * the halls and the clock tower.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, project, faceLight } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { plaster, panels, herringbone, brick as brickSurface } from "../surfaces.ts";
import type { Surface } from "../surfaces.ts";
import type { Venue, PropSpec, WallItem, WallSide, FrontBox } from "../types.ts";
import { cafeTable, windowBar, seating } from "../seating.ts";
import { displayCup } from "../front.ts";
import { word, bigWord, bigWidth } from "../font.ts";
import type { VenueOptions } from "./index.ts";
import { menuBoard, clock } from "../walls.ts";
import { lampPostProp, benchProp, aFrameProp } from "../props.ts";
import { litSet, wallQuad, wallLine, wallDot, wallPt, matItem, bikeRackProp, frontWallProps, cornerDoorRoute, facePt, faceLine, faceQuad, INK, CREAM, seasonTreeProp, lawnAt, frontFace, ashlarFront, glassFront, lampFront } from "./_corner-kit.ts";

const NAVY = "#3b4766";
const GOLD = "#c9a24a";
const OAK = "#8a6446";
const CREAM_WALL = "#e2d6bc";

const fract = (n: number) => n - Math.floor(n);

/** Terrazzo: a pale ground of chips in three colours, brass strips every two tiles. */
function terrazzo(base: string, alt: string, strip: string, chips: [string, string, string]): Surface {
  return {
    colors: [base, alt, strip, ...chips],
    at(u, v) {
      if (fract(u / 48) * 48 < 1 || fract(v / 48) * 48 < 1) return 2;
      const n = noise(Math.floor(u / 1.6), Math.floor(v / 1.6), 51);
      if (n > 0.975) return 3 + Math.min(2, Math.floor((n - 0.975) / 0.0084));
      return noise(Math.floor(u / 5), Math.floor(v / 4), 52) > 0.72 ? 1 : 0;
    },
  };
}

// The quad: a herringbone brick apron round the kiosk, brick paths, striped lawn.
const apron = herringbone("#a8604c", "#b46c55", "#8e5444", 6, 18);
const pathBrick = brickSurface("#b06a52", "#a25e48", "#c9a88a", 8, 4);
const EDGE = "#a9a296";

function quadGround(cols: number, rows: number) {
  return (x: number, y: number, light?: Light) => {
    if (x > -1.25 && y > -1.25 && x < cols + 1.25 && y < rows + 1.25) return apron.colors[apron.at(x * 24, y * 24)];
    if (x > -1.4 && y > -1.4 && x < cols + 1.4 && y < rows + 1.4) return EDGE;
    // The walk along the front of the union, the one the street view looks across.
    if (y > rows + 1.4 && y < rows + 3.4) return y > rows + 3.28 ? EDGE : pathBrick.colors[pathBrick.at(x * 24, y * 24)];
    // Paths across the quad behind each wall, and the one out to the right.
    const p1 = y > -5.4 && y < -4.0;
    const p2 = x > -5.2 && x < -3.8 && y < rows + 1.4;
    const p3 = x > cols + 1.4 && y > 1.8 && y < 3.2;
    if (p1 || p2 || p3) {
      if ((p1 && (y < -5.28 || y > -4.12)) || (p2 && (x < -5.08 || x > -3.92)) || (p3 && !p1 && (y < 1.92 || y > 3.08))) return EDGE;
      return pathBrick.colors[pathBrick.at(p2 && !p1 ? y * 24 : x * 24, p2 && !p1 ? x * 24 : y * 24)];
    }
    // Mowing stripes.
    return lawnAt(x, y, light, Math.floor(x / 1.5));
  };
}

/** Halls round the far side of the quad, a domed library, and the clock tower. */
function farCampus(p: Painter, light: Light, width: number, horizon: number) {
  const haze = light.sky[2];
  const hz = (hex: string, face = 0.3, k = 0.28) => mixHex(light.lit(hex, face), haze, k);
  const brick = [hz("#a8634e"), hz("#b9876a"), hz("#9a5a48")];
  const roof = hz("#5f5a66", 0.3, 0.2);
  const stone = hz("#d8cdb6", 0.4);
  const night = light.night > 0.4;
  let x = -8;
  for (let i = 0; x < width; i++) {
    const w = 30 + Math.floor(noise(i, 1, 13) * 26);
    const h = 9 + Math.floor(noise(i, 2, 13) * 4);
    p.rect(brick[i % 3], x, horizon - h, w, h + 6);
    p.poly(roof, [x - 1, horizon - h, x + w + 1, horizon - h, x + w - 3, horizon - h - 4, x + 3, horizon - h - 4]);
    for (let wx = x + 3; wx < x + w - 3; wx += 4)
      for (let wy = horizon - h + 2; wy < horizon + 2; wy += 5) p.rect(night && noise(wx, wy, 3) > 0.45 ? "#e9c27c" : stone, wx, wy, 2, 3);
    x += w + 2;
  }
  // The library dome.
  const dx = Math.round(width * 0.22);
  p.rect(stone, dx - 12, horizon - 14, 24, 20);
  p.oval(hz("#7f9a8a", 0.4), dx, horizon - 15, 10, 7);
  p.rect(stone, dx - 12, horizon - 15, 24, 2);
  p.rect(hz("#7f9a8a", 0.4), dx, horizon - 25, 1, 4);
  for (let k = -9; k <= 9; k += 4) p.rect(hz("#b8ad98", 0.2), dx + k, horizon - 12, 1, 14);
  // The clock tower.
  const tx = Math.round(width * 0.68);
  const tb = hz("#a8634e", 0.35, 0.22);
  const top = Math.max(5, horizon - 13);
  p.rect(tb, tx - 5, top, 10, horizon - top + 8);
  p.rect(hz("#d8cdb6", 0.4, 0.2), tx - 6, top - 1, 12, 2);
  p.rect(hz("#d8cdb6", 0.4, 0.2), tx - 6, top + 9, 12, 1);
  p.poly(roof, [tx - 6, top - 1, tx + 6, top - 1, tx, top - 9]);
  p.rect(roof, tx, top - 12, 1, 4);
  p.oval(light.night > 0.3 ? "#f3dfa8" : hz("#efe6d2", 0.5, 0.1), tx, top + 4, 3, 3);
  p.rect(hz(INK, 0, 0.2), tx, top + 2, 1, 3);
  p.rect(hz(INK, 0, 0.2), tx, top + 4, 2, 1);
}

const VIEW = litSet([
  ["#7f9a62", 0.6], // 0 lawn
  ["#8aa56b", 0.6], // 1 lawn alt
  ["#b06a52", 0.5], // 2 path
  ["#a8634e", 0.4], // 3 hall brick
  ["#e8dcc4", 0.5], // 4 stone trim
  ["#4a5a62", 0.1], // 5 glass
  ["#5f5a66", 0.3], // 6 slate
  ["#5f8455", 0.5], // 7 leaves
  ["#7fa06a", 0.7], // 8 leaves lit
  ["#6a4c3c", 0.3], // 9 trunk
  ["#efe6d2", 0.6], // 10 clock face
  ["#c47a3e", 0.6], // 11 autumn leaves
  ["#d9a055", 0.7], // 12 autumn leaves lit
  ["#5a4a44", 0.3], // 13 bare twigs
]);

function quadView(u: number, v: number, light: Light, _wall: WallSide, height: number) {
  const c = VIEW(light);
  const [s0, s1, s2] = light.sky;
  const night = light.night > 0.4;
  const left = u >= 1000;
  const w = left ? u - 1000 : u;
  const z = v * height;
  // A big tree in some windows, crowns over the halls.
  const tc = left ? 64 : 40;
  const dt = Math.abs(w - tc);
  const crownTop = 0.78 - (dt * dt) / 900;
  if (dt < 22 && v > 0.3 && v < crownTop) {
    const n = noise(Math.floor(w / 2), Math.floor(v * 30), 8);
    if (light.season === "winter") {
      if (n > 0.8 || (dt < 1.5 && v < 0.6)) return c[13];
    } else if (light.season === "autumn") return n > 0.62 ? c[12] : c[11];
    else return n > 0.62 ? c[8] : c[7];
  }
  if (dt < 1.5 && v < 0.35) return c[9];
  if (v < 0.1) return (Math.floor(w / 9) & 1) === 0 ? c[0] : c[1];
  if (v < 0.14) return c[2];
  if (v < 0.24) return c[1];
  // The clock tower through the far left arch: brick shaft, stone bands, a clock, a spire.
  const dx = w - 121;
  if (left && dx > -5 && dx < 5) {
    const face = dx * dx + (z - 34) * (z - 34);
    if (face < 11) return dx === 0 && z > 33 && z < 37 ? c[6] : z > 33.5 && z < 34.5 && dx > 0 ? c[6] : night ? "#f3dfa8" : c[10];
    if (face < 18) return c[4];
    if (z < 40) return Math.abs(z - 27) < 0.6 ? c[4] : c[3];
    if (z < 42) return c[4];
    if (Math.abs(dx) < (49 - z) * 0.6) return c[6];
  }
  if (v < 0.52) {
    // The hall across the quad: brick, stone bands, tall windows.
    if (Math.abs(v - 0.37) < 0.012 || v > 0.5) return c[4];
    const k = w % 9;
    if (k > 2 && k < 7 && ((v > 0.27 && v < 0.35) || (v > 0.4 && v < 0.48))) return night && noise(Math.floor(w / 9), v > 0.38 ? 1 : 0, 4) > 0.4 ? "#e9c27c" : c[5];
    return c[3];
  }
  if (v < 0.58) return c[6];
  return v > 0.8 ? s0 : v > 0.66 ? s1 : s2;
}

/** A cork board crowded with flyers. */
function corkBoard(wall: WallSide, at: number, z: number, w: number, h: number, seed: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wallQuad(p, place, -2, -2, w + 4, h + 4, light.lit(OAK, 0.3));
      wallQuad(p, place, 0, 0, w, h, light.lit("#b58a5a", 0.2));
      for (let i = 0; i < 40; i++) wallDot(p, place, 1 + noise(i, seed, 1) * (w - 2), 1 + noise(i, seed, 2) * (h - 2), light.lit("#9a7046", 0.2));
      const colors = ["#efe4cc", "#f2d58a", "#c3a0cf", "#a9c98c", "#e8b48a", "#8fb8d8", "#efe4cc", "#e48a6a"];
      const pins = ["#c2493c", "#3f6670", "#c9a24a"];
      let a = 2;
      for (let i = 0; a < w - 6; i++) {
        const fw = 6 + Math.floor(noise(i, seed, 3) * 5);
        const fh = 7 + Math.floor(noise(i, seed, 4) * 5);
        const up = 2 + Math.floor(noise(i, seed, 5) * (h - fh - 3));
        const col = colors[(i + seed) % colors.length];
        wallQuad(p, place, a + 1, up - 1, fw, fh, light.lit("#7a5a3a", 0.1));
        wallQuad(p, place, a, up, fw, fh, light.lit(col, 0.35));
        for (let l = 3; l < fh - 1; l += 2) wallLine(p, place, a + 1, up + fh - l, a + fw - 2 - (l % 3), up + fh - l, light.lit(mixHex(col, INK, 0.4), 0.2));
        wallDot(p, place, a + Math.floor(fw / 2), up + fh - 1, light.lit(pins[i % 3], 0.4));
        // A second, overlapping flyer now and then.
        if (noise(i, seed, 6) > 0.55 && a + fw + 4 < w) {
          const up2 = Math.max(1, up - 6);
          wallQuad(p, place, a + fw - 2, up2, 6, 7, light.lit(colors[(i + 3) % colors.length], 0.35));
          wallDot(p, place, a + fw + 1, up2 + 6, light.lit(pins[(i + 1) % 3], 0.4));
        }
        a += fw + 1;
      }
    },
  };
}

/** Pennant bunting sagging along the top of a wall, navy and gold. */
function bunting(wall: WallSide, at: number, z: number, w: number, colors: string[]): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const sag = (a: number) => Math.sin((Math.PI * a) / w) * 6;
      const string = light.lit("#3a3035", 0);
      for (let a = 0; a < w; a++) {
        const A = wallPt(place, a, -sag(a));
        p.rect(string, A.x, A.y, 1, 1);
      }
      let i = 0;
      for (let a = 3; a + 5 < w; a += 7, i++) {
        const col = colors[i % colors.length];
        const up0 = -sag(a);
        const up1 = -sag(a + 5);
        const A = wallPt(place, a, up0 - 1);
        const B = wallPt(place, a + 5, up1 - 1);
        const C = wallPt(place, a + 2.5, (up0 + up1) / 2 - 8);
        p.poly(light.lit(col, 0.3), [A.x, A.y, B.x, B.y + 1, C.x, C.y]);
        p.line(light.lit(mixHex(col, INK, 0.35), 0.1), B.x, B.y, C.x, C.y);
      }
    },
  };
}

/** The brass class bell on its bracket, with a pull rope. */
function classBell(wall: WallSide, at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const iron = light.lit("#3e3a3f", 0);
      const b = wallPt(place, 0, 0);
      // Back plate and the arm out from the wall.
      wallQuad(p, place, -3, -2, 7, 12, light.lit(OAK, 0.3));
      p.rect(iron, b.x - 1, b.y - 9, 3, 2);
      p.rect(iron, b.x + place.dir * 2, b.y - 9, 4 * place.dir, 1);
      const cx = b.x + place.dir * 6;
      const top = b.y - 8;
      // The bell: a dome flaring to a lip.
      const brass = light.lit(GOLD, 0.45);
      const dark = light.lit(mixHex(GOLD, INK, 0.4), 0.1);
      const hi = light.lit(mixHex(GOLD, CREAM, 0.5), 0.6);
      p.rect(iron, cx - 1, top - 2, 3, 2);
      p.poly(dark, [cx - 3, top, cx + 4, top, cx + 6, top + 8, cx - 5, top + 8]);
      p.poly(brass, [cx - 3, top, cx + 3, top, cx + 4, top + 7, cx - 4, top + 7]);
      p.rect(hi, cx - 2, top + 1, 1, 5);
      p.rect(dark, cx - 6, top + 8, 13, 1);
      p.rect(brass, cx - 5, top + 8, 11, 1);
      p.rect(iron, cx, top + 9, 1, 2);
      // A rope with a tassel.
      const rope = light.lit("#c9b48a", 0.3);
      for (let k = 0; k < 14; k++) p.rect(rope, cx + 2 + (k > 6 ? 1 : 0), top + 9 + k, 1, 1);
      p.rect(light.lit("#a83a3a", 0.3), cx + 2, top + 23, 3, 3);
    },
  };
}

/** The arched windows' stone surround over the curve. */
function archTrim(wall: WallSide, at: number, width: number, top: number, sill: number): WallItem {
  return {
    wall,
    at,
    z: 0,
    draw(p, light, place) {
      const rx = (width / 2) * 24;
      const cz = top - rx * 0.7;
      const trim = light.lit("#efe6d2", 0.35);
      const dark = light.lit("#b8ad98", 0.2);
      for (let i = 0; i <= 40; i++) {
        const a = (Math.PI * i) / 40;
        const along = rx - Math.cos(a) * (rx + 1.5);
        const up = cz + Math.sin(a) * (rx * 0.7 + 1.5);
        wallDot(p, place, along, up + 1, trim, 1, 2);
        wallDot(p, place, along, up + 2, dark);
      }
      // The keystone.
      wallQuad(p, place, rx - 2, top + 1, 4, 4, trim);
      // Sill block under the glass.
      wallQuad(p, place, -2, sill - 2, width * 24 + 4, 2, dark);
    },
  };
}

/** A bookcase against the left wall, its shelves facing the room. */
function bookcase(key: string, x: number, y: number, d: number): PropSpec {
  const h = 44;
  const w = 0.42;
  return {
    key,
    x,
    y,
    w,
    d,
    height: h + 4,
    draw(p, g, light) {
      const share = 0.4;
      const f = faceLight(light, share);
      isoBox(p, g, light, 0, 0, w, d, h, { top: OAK, left: mixHex(OAK, INK, 0.1), right: mixHex(OAK, INK, 0.1) }, 0, share);
      const box = [0, 0, w, d];
      faceQuad(p, g, "x", box, 0.06, 0.94, 2, h - 2, light.lit(mixHex(OAK, INK, 0.55), 0));
      const books = ["#3b4766", "#a83a3a", "#c9a24a", "#5f7a5a", "#e8dcc4", "#8e6a9e", "#3f6670", "#b8573f", "#d8b98a"];
      for (let level = 0; level < 4; level++) {
        const z0 = 2 + level * 10.5;
        faceQuad(p, g, "x", box, 0.04, 0.96, z0 - 1, z0, light.lit(OAK, f.right + 0.1));
        let s = 0.1;
        for (let i = 0; s < 0.88; i++) {
          const n = noise(i, level, 17);
          if (n > 0.9 && level !== 1) {
            s += 0.08;
            continue;
          }
          const bh = 6 + Math.floor(noise(i, level, 18) * 3);
          const col = books[Math.floor(noise(i, level, 19) * books.length)];
          const lean = n > 0.82 ? 1 : 0;
          const a = facePt(g, "x", 0, 0, w, d, s, z0);
          p.rect(light.lit(col, f.right * 0.6 + 0.1), a.x, a.y - bh, 2, bh);
          p.rect(light.lit(mixHex(col, CREAM, 0.35), f.right * 0.6 + 0.2), a.x, a.y - bh + 1, 1, 1);
          if (lean) p.rect(light.lit(col, f.right * 0.6), a.x + 2, a.y - bh + 1, 1, bh - 1);
          s += 0.09;
        }
      }
      faceLine(p, g, "x", box, 0, h, 1, h, light.lit(mixHex(OAK, CREAM, 0.3), f.top));
    },
  };
}

/** Two recycling bins under one lid colour each: paper and cans. */
function bins(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 22,
    draw(p, g, light) {
      const share = 0.4;
      isoBox(p, g, light, 0.12, 0.14, 0.34, 0.34, 18, { top: "#2f5a8a", left: "#3a6a9a", right: "#2f5480" }, 0, share);
      isoBox(p, g, light, 0.54, 0.14, 0.34, 0.34, 18, { top: "#3f6a3f", left: "#4f7a4a", right: "#3e6340" }, 0, share);
      const a = project(g, 0.29, 0.48, 12);
      const b = project(g, 0.71, 0.48, 12);
      p.rect(light.lit("#e8dcc4", 0.3), a.x - 2, a.y - 1, 4, 3);
      p.rect(light.lit("#e8dcc4", 0.3), b.x - 2, b.y - 1, 4, 3);
      const s1 = project(g, 0.29, 0.31, 18);
      p.rect(light.lit("#1f3a5a", 0), s1.x - 3, s1.y - 1, 6, 1);
    },
  };
}

/** A round poster column at the path's edge, plastered with notices. */
function posterColumn(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 40,
    pad: 4,
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, b.x, b.y, 7, 2));
      const body = light.lit("#3f5a4e", f.left);
      p.rect(body, b.x - 6, b.y - 32, 12, 32);
      const colors = ["#efe4cc", "#f2d58a", "#c3a0cf", "#e8b48a", "#8fb8d8", "#a9c98c"];
      for (let i = 0; i < 6; i++) {
        const px = b.x - 5 + (i % 3) * 4;
        const py = b.y - 28 + Math.floor(i / 3) * 11 + (i % 2);
        p.rect(light.lit(colors[i], i % 3 === 2 ? f.right * 0.6 : f.left + 0.1), px, py, 3, 9);
      }
      p.rect(light.lit(mixHex("#3f5a4e", INK, 0.4), 0), b.x + 4, b.y - 32, 2, 32);
      p.oval(light.lit("#3f5a4e", f.top), b.x, b.y - 33, 7, 2);
      p.poly(light.lit("#2f463c", f.top), [b.x - 6, b.y - 34, b.x + 6, b.y - 34, b.x, b.y - 39]);
      p.rect(light.lit(GOLD, f.top), b.x, b.y - 41, 1, 2);
    },
  };
}

/**
 * The union from across the walk: a stone hall the width of the view, slate
 * roof and the clock tower behind, tall arched windows above, an arcade
 * below with the kiosk in its widest arch: the name in gold on navy, pennants
 * strung across, shelves and the navy counter inside, the drink on the counter.
 */
function campusFront(p: Painter, light: Light, box: FrontBox) {
  const L = (hex: string, f = 0.5, g = 0) => light.lit(hex, f, g);
  const fw = frontFace(light);
  const W = p.width;
  const { x, w, ground: G, open } = box;
  const night = light.night > 0.4;
  const c = Math.round(x + w / 2);
  const eave = 30;
  // The clock tower behind the roof, to the right.
  const tx = Math.min(W - 16, x + w + 20);
  p.rect(L(INK, 0), tx - 10, 0, 21, eave);
  p.rect(L("#a8634e", fw), tx - 9, 0, 19, eave);
  p.rect(L("#d8cdb6", 0.6), tx - 10, 15, 21, 2);
  p.rect(L("#d8cdb6", 0.6), tx - 10, 2, 21, 1);
  p.oval(L(INK, 0), tx, 8, 5, 5);
  p.oval(night ? "#f3dfa8" : L("#efe6d2", 0.7), tx, 8, 4, 4);
  const hr = ((light.hour % 12) / 12) * Math.PI * 2;
  const mn = (light.hour % 1) * Math.PI * 2;
  p.line(L(INK, 0), tx, 8, tx + Math.round(Math.sin(hr) * 2), 8 - Math.round(Math.cos(hr) * 2));
  p.line(L("#8a3f32", 0.2), tx, 8, tx + Math.round(Math.sin(mn) * 3), 8 - Math.round(Math.cos(mn) * 3));
  for (let k = -6; k <= 6; k += 4) p.rect(L("#7a4a3c", 0.2), tx + k, 19, 2, 6);
  // The slate roof with dormers.
  const slate = L("#6a6470", 0.6);
  p.rect(slate, 0, eave - 12, W, 12);
  for (let y = eave - 10; y < eave; y += 3) p.rect(L("#5a5460", 0.3), 0, y, W, 1);
  p.rect(L("#7a7480", 0.8), 0, eave - 12, W, 1);
  for (let dx = 14; dx < W; dx += 48) {
    if (Math.abs(dx - c) < 40 || Math.abs(dx - tx) < 18) continue;
    p.rect(L(INK, 0), dx - 6, eave - 16, 13, 13);
    p.rect(L("#d8cdb6", fw), dx - 5, eave - 15, 11, 12);
    glassFront(p, light, dx - 3, eave - 12, 7, 8, night && noise(dx, 1, 3) > 0.4);
    p.poly(slate, [dx - 7, eave - 15, dx + 7, eave - 15, dx, eave - 21]);
  }
  // Stone front the width of the view.
  ashlarFront(p, light, 0, eave + 2, W, G - eave - 2, "#d8cdb6", "#cfc3aa", "#b8ad98", 3);
  p.rect(L(INK, 0), 0, eave - 1, W, 1);
  p.rect(L("#e8dfcc", 0.8), 0, eave, W, 3);
  p.rect(L("#a89e8a", 0.3), 0, eave + 3, W, 1);
  // A pediment over the kiosk bay with a round window.
  p.poly(L(INK, 0), [x + 7, eave + 1, c, eave - 23, x + w - 7, eave + 1]);
  p.poly(L("#e8dfcc", 0.8), [x + 9, eave, c, eave - 21, x + w - 9, eave]);
  p.poly(L("#d8cdb6", fw), [x + 16, eave - 2, c, eave - 17, x + w - 16, eave - 2]);
  p.oval(L(INK, 0), c, eave - 8, 5, 5);
  p.oval(L("#e8dfcc", 0.8), c, eave - 8, 4, 4);
  glassFront(p, light, c - 2, eave - 10, 5, 5, night);
  // Upper storey: tall arched windows in stone surrounds, all along.
  const up = eave + 7,
    upH = 22;
  for (let wx = 10; wx + 12 < W; wx += 28) {
    p.rect(L("#e8dfcc", 0.7), wx - 2, up - 2, 16, upH + 4);
    p.oval(L("#e8dfcc", 0.7), wx + 6, up, 8, 6);
    p.rect(L(INK, 0), wx - 1, up + 1, 14, upH);
    p.oval(L(INK, 0), wx + 6, up + 1, 7, 5);
    const on = night && noise(wx, 2, 5) > 0.35;
    p.oval(on ? "#f0cf8a" : L(mixHex(light.sky[1], "#3b3440", 0.45), 0.4), wx + 6, up + 2, 6, 4);
    glassFront(p, light, wx, up + 2, 12, upH - 2, on);
    p.rect(L("#e8dfcc", 0.7), wx + 6, up - 2, 1, upH + 2);
    p.rect(L("#e8dfcc", 0.7), wx, up + 10, 12, 1);
    p.rect(L("#e8dfcc", 0.8), wx - 3, up + upH + 1, 18, 2);
  }
  // String course, with pennants strung along it across the kiosk bay.
  const sc = up + upH + 6;
  p.rect(L("#e8dfcc", 0.8), 0, sc, W, 3);
  p.rect(L("#a89e8a", 0.3), 0, sc + 3, W, 1);
  // Ground floor arcade: blind arches with windows either side of the kiosk.
  const kx0 = x + 16,
    kx1 = x + w - 16,
    kTop = sc + 8;
  for (let ax = 6; ax + 18 < W; ax += 30) {
    if (ax + 18 > kx0 - 4 && ax < kx1 + 4) continue;
    p.rect(L("#c9bea6", fw * 0.8), ax - 1, kTop + 2, 20, G - kTop - 2);
    p.oval(L("#c9bea6", fw * 0.8), ax + 9, kTop + 6, 10, 6);
    p.rect(L(INK, 0), ax + 2, kTop + 8, 14, G - kTop - 14);
    p.oval(L(INK, 0), ax + 9, kTop + 8, 7, 5);
    const on = night && noise(ax, 4, 5) > 0.3;
    p.oval(on ? "#f0cf8a" : L(mixHex(light.sky[1], "#3b3440", 0.45), 0.4), ax + 9, kTop + 9, 6, 4);
    glassFront(p, light, ax + 3, kTop + 9, 12, G - kTop - 16, on);
    p.rect(L("#e8dfcc", 0.8), ax, G - 6, 18, 2);
  }
  // The kiosk's arch: a stone surround, a keystone, the opening.
  const ry = 9;
  const kc = (kx0 + kx1) / 2,
    rx = (kx1 - kx0) / 2;
  p.rect(L("#e8dfcc", 0.8), kx0 - 4, kTop + ry, kx1 - kx0 + 8, G - kTop - ry);
  p.oval(L("#e8dfcc", 0.8), kc, kTop + ry, rx + 4, ry + 4);
  p.rect(L(INK, 0), kx0 - 1, kTop + ry, kx1 - kx0 + 2, G - kTop - ry);
  p.oval(L(INK, 0), kc, kTop + ry, rx + 1, ry + 1);
  const inside = open ? (night ? L("#5a4436", 0.2, 0.9) : L("#7a6450", 0.2)) : L("#3b4766", 0.3);
  p.rect(inside, kx0, kTop + ry, kx1 - kx0, G - kTop - ry);
  p.oval(inside, kc, kTop + ry, rx, ry);
  p.rect(L("#e8dfcc", 0.9), Math.round(kc) - 3, kTop - 4, 7, 6);
  if (open) {
    // Inside: shelves of tins, the class bell, warm light after dark.
    if (night) p.alpha(0.35, () => p.rect("#ffcf8a", kx0, kTop + 4, kx1 - kx0, G - kTop - 4));
    const shelfY = kTop + 24;
    for (const sy of [shelfY, shelfY + 8]) {
      p.rect(L(OAK, 0.4, 0.6), kx0 + 4, sy, kx1 - kx0 - 8, 2);
      for (let i = kx0 + 6; i < kx1 - 8; i += 6) p.rect(L(["#b8573f", "#3b4766", "#c9a24a", "#5f7a5a"][((i >> 2) + sy) % 4], 0.3, 0.6), i, sy - 4, 4, 4);
    }
    const bell = kx1 - 12;
    p.rect(L("#3e3a3f", 0.2), bell - 1, kTop + 12, 3, 2);
    p.poly(L(GOLD, 0.6, 0.6), [bell - 3, kTop + 14, bell + 3, kTop + 14, bell + 4, kTop + 20, bell - 4, kTop + 20]);
    // The name board under the arch, and pennants under it.
    const name = box.name.toUpperCase();
    const bw = bigWidth(name) + 10;
    const by = kTop + 4;
    p.rect(L(INK, 0), Math.round(kc - bw / 2) - 1, by - 1, bw + 2, 13);
    p.rect(L(NAVY, 0.5), Math.round(kc - bw / 2), by, bw, 11);
    p.rect(L(GOLD, 0.7), Math.round(kc - bw / 2), by, bw, 1);
    p.rect(L(GOLD, 0.7), Math.round(kc - bw / 2), by + 10, bw, 1);
    bigWord(p, name, L("#e8c66a", 0.7, 0.6), Math.round(kc - bw / 2) + 5, by + 2);
    const py = by + 13;
    for (let px = kx0 + 2; px < kx1 - 4; px += 6) {
      const sag = Math.round(Math.sin(((px - kx0) / (kx1 - kx0)) * Math.PI) * 3);
      p.rect(L("#3a3035", 0), px, py + sag, 6, 1);
      const col = ((px - kx0) / 6) % 2 < 1 ? NAVY : GOLD;
      p.poly(L(col, 0.5, 0.4), [px, py + sag + 1, px + 5, py + sag + 1, px + 2.5, py + sag + 6]);
    }
    // The navy counter with its gold trim, and the drink on it.
    const ct = G - 15;
    p.rect(L(INK, 0), kx0, ct - 1, kx1 - kx0, 1);
    p.rect(L("#c9a878", 0.6), kx0, ct, kx1 - kx0, 2);
    p.rect(L(GOLD, 0.6), kx0, ct + 2, kx1 - kx0, 1);
    p.rect(L(NAVY, fw), kx0, ct + 3, kx1 - kx0, G - ct - 3);
    for (let i = kx0 + 4; i + 18 <= kx1 - 4; i += 22) {
      p.rect(L(mixHex(NAVY, INK, 0.3), 0.2), i, ct + 5, 18, 7);
      p.rect(L(mixHex(NAVY, CREAM, 0.25), fw), i + 1, ct + 6, 16, 1);
    }
    if (box.display) displayCup(p, light, box.display, Math.round(kx0 + (kx1 - kx0) * 0.3), ct);
  } else {
    // The roller shutter down.
    for (let y = kTop; y < G; y += 3) p.rect(L(mixHex(NAVY, CREAM, 0.2), 0.4), kx0, y, kx1 - kx0, 1);
    const name = box.name.toUpperCase();
    word(p, name, L(GOLD, 0.6), Math.round(kc - (name.length * 4 - 1) / 2), kTop + 14);
  }
  // A step along the arcade, a lamp, and bikes at the rack on the left.
  p.rect(L("#b8ad98", 0.6), 0, G - 2, W, 2);
  lampFront(p, light, x - 8, G, 50);
  for (let i = 0; i < 2; i++) {
    const bx = 10 + i * 16;
    const col = L(i ? NAVY : GOLD, 0.6);
    p.oval(L("#2e2a2d", 0), bx, G - 5, 5, 5);
    p.oval(L("#2e2a2d", 0), bx + 13, G - 5, 5, 5);
    p.oval(L("#8a8d90", 0.5), bx, G - 5, 3, 3);
    p.oval(L("#8a8d90", 0.5), bx + 13, G - 5, 3, 3);
    p.line(col, bx, G - 5, bx + 5, G - 11);
    p.line(col, bx + 5, G - 11, bx + 11, G - 11);
    p.line(col, bx + 11, G - 11, bx + 13, G - 5);
    p.line(col, bx + 5, G - 11, bx + 7, G - 5);
    p.rect(L("#3a3035", 0), bx + 3, G - 13, 4, 1);
    p.rect(L("#3a3035", 0), bx + 10, G - 13, 3, 1);
  }
  p.rect(L("#6f7274", 0.5), 6, G - 12, 34, 1);
}

export function campusVenue(o: VenueOptions): Venue {
  const { cols, rows } = o;
  // A study table for three, and stools at the front window over the quad.
  const sit = seating(
    cafeTable("campus-table", 2.0, 4.25, ["-x", "-y", "+x"], { wood: OAK, seat: NAVY, top: "#c9a878" }),
    windowBar("campus-bar", "front-left", 1.1, 3.7, 2, { cols, rows, wall: 14 }, { wood: OAK, seat: GOLD, top: "#c9a878" }),
  );
  const archR = { at: 0.5, width: 1.5 };
  const archL1 = { at: 1.9, width: 1.4 };
  const archL2 = { at: 4.4, width: 1.4 };
  const A_SILL = 22,
    A_TOP = 72;
  return {
    id: "campus",
    cols,
    rows,
    floor: terrazzo("#d9d0bf", "#d0c6b3", "#b8933f", ["#6a7088", "#b9806a", "#9a948a"]),
    wall: plaster(CREAM_WALL, "#d8cbb0"),
    wainscot: { surface: panels(OAK, "#82603f", "#5e4430", "#6a4c36", 24, 22), height: 22, rail: GOLD },
    cap: "#efe6d2",
    slab: "#9a8e80",
    windows: [
      { wall: "right", at: archR.at, width: archR.width, sill: A_SILL, top: A_TOP, bars: 1, transom: 20, frame: "#efe6d2", shape: "arch" },
      { wall: "left", at: archL1.at, width: archL1.width, sill: A_SILL, top: A_TOP, bars: 1, transom: 20, frame: "#efe6d2", shape: "arch" },
      { wall: "left", at: archL2.at, width: archL2.width, sill: A_SILL, top: A_TOP, bars: 1, transom: 20, frame: "#efe6d2", shape: "arch" },
    ],
    doors: [],
    lamps: [
      { kind: "pendant", x: 1.5, y: 1.5, z: 42, color: GOLD, reach: 2.4 },
      { kind: "pendant", x: 5.8, y: 1.4, z: 40, color: GOLD, reach: 2.4 },
      { kind: "pendant", x: 3.2, y: 4.6, z: 40, color: GOLD, reach: 2.2 },
    ],
    wallItems: [
      archTrim("right", archR.at, archR.width, A_TOP, A_SILL),
      archTrim("left", archL1.at, archL1.width, A_TOP, A_SILL),
      archTrim("left", archL2.at, archL2.width, A_TOP, A_SILL),
      bunting("right", 0.1, 74, cols * 24 - 6, [NAVY, GOLD]),
      bunting("left", 0.1, 74, rows * 24 - 6, [GOLD, NAVY]),
      classBell("right", 2.5, 40),
      menuBoard("right", 4.3, 38, { w: 46, h: 22, title: "TEA BAR", board: NAVY, frame: GOLD }),
      clock("right", 3.5, 64, o.hour, NAVY),
      corkBoard("left", 0.25, 30, 36, 26, 2),
    ],
    props: [
      ...sit.props,
      bookcase("prop:books", 0, 3.35, 0.95),
      bins("prop:bins", 0, rows - 1),
      ...frontWallProps("prop:front", cols, rows, { height: 14, kind: "panel", color: CREAM_WALL, line: "#b8ad98", cap: OAK, base: [NAVY, 4], gapsRight: [rows - 1], post: OAK }),
    ],
    floorItems: [matItem(cols - 0.94, rows - 0.9, 0.86, 0.8, NAVY, GOLD)],
    counter: { top: "#c9a878", front: NAVY, side: "#2f3a55", trim: GOLD, panel: "steel", height: 15 },
    outside: {
      ground: quadGround(cols, rows),
      far: farCampus,
      view: quadView,
      props: [
        seasonTreeProp("out:oak1", 3.2, -5.8, "#5f8455", 3, 66),
        seasonTreeProp("out:oak2", -5.9, 1.2, "#6a8a58", 5, 66),
        seasonTreeProp("out:oak3", -1.9, rows + 0.4, "#6f8f5c", 9, 60),
        { ...benchProp("out:bench1", 5.2, -3.9, "#8a6048", true), shadow: "none" as const },
        { ...benchProp("out:bench2", cols + 0.9, -0.8, "#8a6048", false), shadow: "none" as const },
        bikeRackProp("out:bikes", 1.2, rows + 0.55, true, ["#c9a24a", "#3b4766", ""]),
        posterColumn("out:posters", -1.6, 4.9),
        lampPostProp("out:lamp1", cols + 0.7, -1.9),
        lampPostProp("out:lamp2", -1.0, rows + 0.2),
        { ...aFrameProp("out:aframe", cols + 0.5, rows - 2.0, "TEA"), shadow: "none" as const },
      ],
    },
    seats: sit.seats,
    ...cornerDoorRoute(cols, rows),
    indoorSun: 0.4,
    facade: {
      wall: plaster("#d8cdb6", "#cfc3aa"),
      trim: "#e8dfcc",
      sign: { board: NAVY, ink: "#e8c66a" },
      awning: null,
      door: NAVY,
      upper: true,
      neighbours: "none",
      queueAt: 0.5,
      paint: campusFront,
    },
  };
}
