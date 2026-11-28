/**
 * The Garden Tea Room: a glass conservatory on a lawn. Both walls are mostly
 * glass between white glazing bars over a low panelled plinth, so the sun
 * comes across the stone flags in long patches. Ferns hang from the roof,
 * citrus and a palm stand in pots, guests take tea at white tables in wicker
 * chairs, and the counters are white slats. Outside: a gravel walk, flower
 * borders, a clipped hedge, a fountain, and the trees beyond.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, project, faceLight, type IsoGrid } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { stone, plaster, shiplap, ground } from "../surfaces.ts";
import type { Venue, PropSpec, WallItem, WallSide, WindowSpec, FrontBox } from "../types.ts";
import { displayCup } from "../front.ts";
import type { VenueOptions } from "./index.ts";
import { lampPostProp, benchProp, SPRITES, litPalette } from "../props.ts";
import { litSet, leafClump, plantProp, matItem, frontWallProps, pot, INK, CREAM, seasonTreeProp, lawnAt, frontFace, glassFront, shrubFront, signFront, lampFront } from "./_corner-kit.ts";

const WHITE = "#e8e2d4";
const BAR = "#ebe6d8";
const WICKER = "#b8935e";

const gravel = ground("#cbbd9e", "#c3b494", "#a99b7d", 0.14, 11);
const EDGE = "#b5ad9c";
const SOIL = "#6a5444";
const LEAF = "#4f7044";
const LEAF_AUTUMN = "#6a6a3e";
const LEAF_WINTER = "#5a5a44";
const FLOWERS = ["#d98a96", "#e8cc86", "#b9a0c8", "#ece2cf", "#dea06e", "#c9707a"];

/** Where the fountain stands, behind the left wall. */
const FX = -6.5,
  FY = 1.2;

function gardenGround(cols: number, rows: number) {
  return (x: number, y: number, light?: Light) => {
    // The gravel walk round the glasshouse, and the wide walk along its front.
    if (x > -1.2 && y > -1.2 && x < cols + 1.2 && y < rows + 1.2) return gravel.colors[gravel.at(x * 24, y * 24)];
    if (x > -1.32 && y > -1.32 && x < cols + 1.32 && y < rows + 1.32) return EDGE;
    if (y > rows + 1.32 && y < rows + 3.4) return y > rows + 3.28 ? EDGE : gravel.colors[gravel.at(x * 24, y * 24)];
    // The fountain's gravel circle and the walk out to it.
    const fx = x - FX,
      fy = y - FY;
    const r2 = fx * fx + fy * fy;
    if (r2 < 5.3) return gravel.colors[gravel.at(x * 24, y * 24)];
    if (r2 < 5.8) return EDGE;
    if (y > FY - 0.6 && y < FY + 0.6 && x > FX && x < -1.2) return y < FY - 0.5 || y > FY + 0.5 ? EDGE : gravel.colors[gravel.at(x * 24, y * 24)];
    // Flower borders beyond the walk on both sides.
    const borderL = x > -4.9 && x < -3.6 && y > -3.6 && y < rows + 1.3;
    const borderR = y > -4.9 && y < -3.6 && x > -3.6;
    if (borderL || borderR) {
      // Clumps of one flower each among the leaves; asters in autumn, bare earth in winter.
      const cx = Math.floor(x * 2.2),
        cy = Math.floor(y * 2.2);
      const clump = noise(cx, cy, 22);
      const n = noise(Math.floor(x * 10), Math.floor(y * 10), 21);
      const season = light?.season;
      if (season === "winter") return n > 0.55 ? LEAF_WINTER : SOIL;
      if (season === "autumn") return clump > 0.7 && n > 0.5 ? (clump > 0.85 ? "#b9a0c8" : "#c47a3e") : n > 0.2 ? LEAF_AUTUMN : SOIL;
      if (clump > 0.45 && n > 0.5) return FLOWERS[Math.floor(clump * 13) % 6];
      return n > 0.12 ? LEAF : SOIL;
    }
    // Mown stripes.
    return lawnAt(x, y, light, Math.floor((x + y) / 1.4));
  };
}

/** The tree line beyond the garden: rounded crowns in several greens, a few poplars. */
function farTrees(p: Painter, light: Light, width: number, horizon: number) {
  const haze = light.sky[2];
  const palette =
    light.season === "autumn" ? ["#b5653c", "#c9903e", "#6a8a58", "#a8704a"] : light.season === "winter" ? ["#8a7a70", "#7a6c66", "#6f6560", "#5f6a5a"] : ["#5f7b55", "#6a8a58", "#55724e", "#7a9462"];
  const greens = palette.map((c) => mixHex(light.lit(c, 0.4), haze, 0.28));
  const back = mixHex(light.lit(light.season === "winter" ? "#6a6460" : "#4f6a4a", 0.3), haze, 0.4);
  p.rect(back, 0, horizon - 4, width, 8);
  for (let x = -4; x < width + 6; x += 5) {
    const r = 4 + Math.floor(noise(x, 1, 31) * 4);
    p.oval(back, x, horizon - 4 - Math.floor(noise(x, 2, 31) * 3), r, r - 1);
  }
  for (let x = -6, i = 0; x < width + 8; i++) {
    const poplar = noise(i, 3, 31) > 0.84;
    const c = greens[i % 4];
    if (poplar) {
      p.oval(c, x, horizon - 10, 3, 9);
      p.dither(mixHex(c, "#fff3c8", 0.2), x - 2, horizon - 18, 2, 12, 0.4);
      x += 7;
      continue;
    }
    const r = 5 + Math.floor(noise(i, 4, 31) * 5);
    p.oval(c, x, horizon - 2 - Math.floor(r * 0.6), r, r - 1);
    p.dither(mixHex(c, "#fff3c8", 0.22), x - r + 1, horizon - 2 - r * 1.4, r, r * 0.6, 0.4, i);
    x += r + 3;
  }
  p.rect(mixHex(light.lit("#6f8b5c", 0.5), haze, 0.25), 0, horizon + 2, width, 2);
}

const VIEW = litSet([
  ["#cbbd9e", 0.6], // 0 gravel
  ["#4f7044", 0.5], // 1 border leaves
  ["#3f5f3a", 0.4], // 2 hedge dark
  ["#567a48", 0.6], // 3 hedge
  ["#7f9a62", 0.7], // 4 lawn
  ["#88a46a", 0.7], // 5 lawn alt
  ["#5f7b55", 0.5], // 6 trees
  ["#7a9a66", 0.7], // 7 trees lit
  ["#e48a9a", 0.6], // 8 flower pink
  ["#f2d58a", 0.6], // 9 flower yellow
  ["#c3a0cf", 0.6], // 10 flower lilac
  ["#d8d0bc", 0.6], // 11 stone
  ["#9cc4cc", 0.7], // 12 water
  ["#4f6a4a", 0.3], // 13 far trees
  ["#c47a3e", 0.6], // 14 autumn leaves
  ["#d9a055", 0.7], // 15 autumn leaves lit
  ["#7a6a60", 0.3], // 16 bare wood
  ["#958478", 0.4], // 17 bare wood lit
]);

function gardenView(u: number, v: number, light: Light, _wall: WallSide, height: number) {
  const c = VIEW(light);
  const [s0, s1, s2] = light.sky;
  const left = u >= 1000;
  const w = left ? u - 1000 : u;
  const z = v * height;
  // The fountain through the left glass, in front of the hedge.
  if (left) {
    const d = Math.abs(w - 150);
    if (d < 13 && z > 3 && z < 8) return z < 4 ? c[2] : c[11];
    if (d < 2 && z < 16) return c[11];
    if (d < 6 && z > 15 && z < 17) return c[11];
    if (z > 16 && z < 24 && d < 2 + (z - 16) * 0.6 && ((w + Math.floor(z)) & 1) === 0) return c[12];
  }
  if (z < 2) return c[0];
  if (z < 7) {
    const n = noise(Math.floor(w), Math.floor(z), 21);
    return n > 0.7 ? c[8 + (Math.floor(w / 3) % 3)] : c[1];
  }
  const hedgeTop = 14 + (noise(Math.floor(w / 4), 0, 3) > 0.7 ? 1 : 0);
  if (z < hedgeTop) return noise(Math.floor(w / 2), Math.floor(z / 2), 4) > 0.65 ? c[3] : c[2];
  if (z < 21) return (Math.floor(w / 7) & 1) === 0 ? c[4] : c[5];
  // Trees: a crown line that rises and falls.
  const crown = 30 + Math.sin(w / 9) * 4 + Math.sin(w / 4.3 + 1) * 2 + (noise(Math.floor(w / 3), 1, 5) - 0.5) * 3;
  if (z < crown) {
    const n = noise(Math.floor(w / 2), Math.floor(z / 2), 6);
    if (light.season === "winter") return n > 0.6 ? c[17] : c[16];
    if (light.season === "autumn") return n > 0.7 ? c[15] : z < 24 ? c[13] : n > 0.35 ? c[14] : c[6];
    return n > 0.7 ? c[7] : z < 24 ? c[13] : c[6];
  }
  const t = (z - crown) / Math.max(1, height - crown);
  return t > 0.6 ? s0 : t > 0.25 ? s1 : s2;
}

/** Ferns in wicker baskets hung from the roof on chains. */
function hangingFerns(spots: [number, number, number][], wallH: number) {
  return (p: Painter, g: IsoGrid, light: Light) => {
    const frond = light.lit("#6d9a58", 0.4);
    const frondHi = light.lit("#93bd78", 0.6);
    const dark = light.lit("#3f5f3a", 0.1);
    const chain = light.lit("#5a5048", 0);
    spots.forEach(([x, y, z], k) => {
      const at = project(g, x, y, z);
      const top = project(g, x, y, wallH + 4);
      p.line(chain, at.x, top.y, at.x, at.y - 4);
      p.line(chain, at.x - 3, at.y - 1, at.x, at.y - 4);
      p.line(chain, at.x + 3, at.y - 1, at.x, at.y - 4);
      // Fronds arching out and down over the rim.
      for (let i = 0; i < 11; i++) {
        const side = i % 2 ? 1 : -1;
        const spread = 0.6 + (i >> 1) * 0.55;
        let px = at.x,
          py = at.y;
        const len = 5 + ((i * 7 + k * 3) % 5);
        for (let s = 1; s <= len; s++) {
          const nx = at.x + side * spread * s * 0.9;
          const ny = at.y - 1 + s * s * (0.09 + (i % 3) * 0.04) - (s < 3 ? 1 : 0);
          p.line(s > len - 2 ? dark : frond, px, py, nx, ny);
          if (s % 2 === 0) p.rect(i % 4 === 0 ? frondHi : frond, nx, ny + 1, 1, 1);
          px = nx;
          py = ny;
        }
      }
      // The basket.
      p.oval(light.lit(mixHex(WICKER, INK, 0.3), 0.2), at.x, at.y + 1, 5, 3);
      p.oval(light.lit(WICKER, 0.35), at.x, at.y, 5, 2);
      for (let i = -4; i <= 4; i += 2) p.rect(light.lit(mixHex(WICKER, INK, 0.25), 0.2), at.x + i, at.y + 1, 1, 2);
      p.rect(frondHi, at.x - 1, at.y - 2, 3, 1);
    });
  };
}

/** A white iron table for two with wicker tub chairs either side and a pot of tea. */
function bistroProp(key: string, x: number, y: number, cushion: string): PropSpec {
  return {
    key,
    x,
    y,
    height: 26,
    pad: 10,
    draw(p, g, light) {
      const share = 0.5;
      const f = faceLight(light, share);
      const wDark = light.lit(mixHex(WICKER, INK, 0.3), f.left * 0.5);
      const wMid = light.lit(WICKER, f.top * 0.8);
      const wHi = light.lit(mixHex(WICKER, CREAM, 0.3), f.top);
      const chair = (u: number, v: number, side: number) => {
        const c = project(g, u, v, 0);
        p.alpha(0.28, () => p.oval(INK, c.x, c.y, 6, 2));
        // The tub: a drum of wicker, a cushion, a back curling round the outer side.
        p.rect(wDark, c.x - 5, c.y - 8, 11, 7);
        p.oval(wDark, c.x, c.y - 2, 5, 2);
        for (let k = -4; k <= 4; k += 2) p.rect(wMid, c.x + k, c.y - 7, 1, 5);
        p.oval(wMid, c.x, c.y - 8, 5, 2);
        p.oval(light.lit(cushion, f.top), c.x - side, c.y - 9, 3, 1);
        const bx = c.x + side * 4;
        p.rect(wDark, bx - 2, c.y - 17, 4, 10);
        p.rect(wMid, bx - 2 + (side > 0 ? 0 : 1), c.y - 17, 3, 9);
        p.oval(wHi, bx, c.y - 17, 2, 1);
        p.line(wDark, bx - side * 1, c.y - 16, c.x - side * 3, c.y - 10);
      };
      chair(0.12, 0.78, -1);
      // The table: a pedestal and a round white top with tea on it.
      const t = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, t.x, t.y, 7, 2));
      const iron = light.lit("#4a4448", 0.1);
      p.rect(iron, t.x, t.y - 12, 1, 12);
      p.line(iron, t.x - 4, t.y, t.x, t.y - 3);
      p.line(iron, t.x + 4, t.y, t.x, t.y - 3);
      p.oval(light.lit(mixHex(WHITE, INK, 0.3), f.left), t.x, t.y - 12, 9, 4);
      p.oval(light.lit(WHITE, f.top), t.x, t.y - 13, 9, 4);
      p.line(light.lit(mixHex(WHITE, CREAM, 0.5), Math.min(1, f.top + 0.2)), t.x - 6, t.y - 15, t.x - 2, t.y - 16);
      const tp = SPRITES.teapot;
      const pal: Record<string, string> = {};
      for (const [k, col] of Object.entries({ ...tp.palette, L: "#a9c98c", B: "#6f9a5a", D: "#4c6b40" })) pal[k] = k === "O" ? col : light.lit(col, f.top * 0.7);
      p.sprite(tp.grid, pal, t.x - 6, t.y - 19);
      p.rect(light.lit(INK, 0), t.x + 3, t.y - 15, 3, 2);
      p.rect(light.lit("#f3ead6", f.top), t.x + 3, t.y - 15, 2, 1);
      chair(0.78, 0.12, 1);
    },
  };
}

/** A fern on a tall wooden stand, fronds spilling over. */
function fernStand(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 34,
    pad: 10,
    draw(p, g, light) {
      const f = faceLight(light, 0.6);
      const wood = light.lit("#7a5a44", f.left);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.28, () => p.oval(INK, b.x, b.y, 6, 2));
      for (const dx of [-4, 4]) p.line(wood, b.x + dx, b.y, b.x + dx * 0.6, b.y - 16);
      p.line(wood, b.x, b.y + 1, b.x, b.y - 16);
      p.rect(light.lit("#7a5a44", f.top), b.x - 5, b.y - 17, 11, 2);
      const potC = "#c47c5b";
      p.rect(light.lit(mixHex(potC, INK, 0.2), f.left), b.x - 4, b.y - 24, 9, 7);
      p.rect(light.lit(potC, f.top), b.x - 4, b.y - 24, 6, 7);
      p.rect(light.lit(mixHex(potC, CREAM, 0.2), f.top), b.x - 5, b.y - 25, 11, 2);
      const frond = light.lit("#6d9a58", f.top * 0.8 + 0.1);
      const hi = light.lit("#93bd78", Math.min(1, f.top + 0.2));
      const dark = light.lit("#3f5f3a", 0);
      for (let i = 0; i < 12; i++) {
        const side = i % 2 ? 1 : -1;
        const spread = 0.5 + (i >> 1) * 0.42;
        let px = b.x,
          py = b.y - 25;
        const len = 6 + (i % 4);
        for (let s = 1; s <= len; s++) {
          const nx = b.x + side * spread * s;
          const ny = b.y - 25 - (s < 4 ? 3 - s : 0) - (i < 4 ? 3 : 0) + s * s * 0.12;
          p.line(s > len - 2 ? dark : frond, px, py, nx, ny);
          if (s % 2 === 1) p.rect(i % 3 ? frond : hi, nx, ny - 1, 1, 1);
          px = nx;
          py = ny;
        }
      }
    },
  };
}

/** A hanging lantern: iron cap, glass, a candle that lights after dark. */
function lanterns(spots: [number, number, number][], wallH: number) {
  return (p: Painter, g: IsoGrid, light: Light) => {
    const on = light.night > 0.15;
    const iron = light.lit("#3e3a3f", 0);
    const glass = on ? "#ffd896" : light.lit("#e6e0cc", 0.5);
    for (const [x, y, z] of spots) {
      const at = project(g, x, y, z);
      // A short chain: the glass roof it hangs from is cut away with the walls.
      const top = Math.max(project(g, x, y, wallH + 4).y, at.y - 34);
      p.line(light.lit("#5a5048", 0), at.x, top, at.x, at.y - 12);
      if (on) {
        p.alpha(0.16 * light.night, () => p.oval("#ffc070", at.x, at.y - 4, 12, 9));
        p.alpha(0.22 * light.night, () => p.oval("#ffd890", at.x, at.y - 4, 6, 5));
      }
      p.rect(iron, at.x - 1, at.y - 12, 3, 1);
      p.poly(iron, [at.x - 4, at.y - 8, at.x + 5, at.y - 8, at.x + 2, at.y - 11, at.x - 1, at.y - 11]);
      p.rect(iron, at.x - 3, at.y - 8, 7, 8);
      p.rect(glass, at.x - 2, at.y - 7, 2, 6);
      p.rect(glass, at.x + 1, at.y - 7, 2, 6);
      if (on) p.rect("#fff2c8", at.x, at.y - 4, 1, 2);
      p.rect(iron, at.x - 4, at.y, 9, 1);
    }
  };
}

/** A clipped hedge: a long box with a leafy face. */
function hedgeProp(key: string, x: number, y: number, w: number, d: number, h: number): PropSpec {
  return {
    key,
    x,
    y,
    w,
    d,
    height: h + 2,
    pad: 4,
    draw(p, g, light) {
      const box = isoBox(p, g, light, 0, 0, w, d, h, { top: "#5f8a50", left: "#4f7444", right: "#3f5f3a", ink: "#2f3f2c" }, 0);
      const f = faceLight(light, 1);
      const hi = light.lit("#7fa66a", Math.min(1, f.top + 0.2));
      // Leaf highlights scattered over the clipped top only, never past its edges.
      void box;
      for (let i = 1; i < w * 12; i++)
        for (let j = 1; j < d * 12; j++)
          if (noise(i, j, 3) < 0.18) {
            const at = project(g, i / 12, j / 12, h);
            p.rect(hi, at.x, at.y, 1, 1);
          }
      const L = light.lit("#3f5f3a", f.left * 0.5);
      for (let i = 0; i < w * 8; i++) {
        const a = project(g, (i + 0.5) / 8, d, 2 + noise(i, 1, 9) * (h - 4));
        p.rect(L, a.x, a.y, 2, 1);
      }
    },
  };
}

/** A stone fountain: a round basin, a column and a bowl that spills. */
function fountainProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    w: 2,
    d: 2,
    height: 34,
    pad: 8,
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const c = project(g, 1, 1, 0);
      const stoneC = "#d8d0bc";
      const s0 = light.lit(mixHex(stoneC, INK, 0.25), f.left * 0.7);
      const s1 = light.lit(stoneC, f.top);
      const water = light.lit("#7fa8b4", 0.5);
      const waterHi = light.lit("#c4dde0", 0.8);
      p.alpha(0.3, () => p.oval(INK, c.x, c.y + 1, 22, 9));
      p.oval(s0, c.x, c.y - 3, 21, 9);
      p.oval(s1, c.x, c.y - 6, 21, 9);
      p.oval(water, c.x, c.y - 6, 18, 7);
      p.dither(waterHi, c.x - 14, c.y - 10, 28, 6, 0.18, 2);
      // Column and upper bowl.
      p.rect(s0, c.x - 2, c.y - 20, 5, 14);
      p.rect(s1, c.x - 2, c.y - 20, 2, 14);
      p.oval(s0, c.x, c.y - 21, 8, 3);
      p.oval(s1, c.x, c.y - 22, 8, 3);
      p.oval(water, c.x, c.y - 22, 6, 2);
      // Spills and the jet.
      for (const dx of [-8, 8]) for (let k = 0; k < 13; k++) if ((k + dx) % 3 !== 0) p.rect(waterHi, c.x + dx + (dx > 0 ? 1 : -1) * (k > 8 ? 1 : 0), c.y - 21 + k, 1, 1);
      p.rect(waterHi, c.x, c.y - 30, 1, 7);
      p.rect(water, c.x - 1, c.y - 26, 3, 1);
      p.rect(waterHi, c.x - 2, c.y - 28, 1, 2);
      p.rect(waterHi, c.x + 2, c.y - 28, 1, 2);
    },
  };
}

/** A clipped box ball in a stone urn, either side of the door. */
function topiaryProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 28,
    pad: 4,
    draw(p, g, light) {
      const c = pot(p, g, light, "#cfc5ae", 0.4, 9, 1);
      leafClump(p, light, c.x, c.y - 9, 8, "#567a48", 3, 1);
    },
  };
}

/** Little pots of herbs and cacti along a window sill. */
function sillPots(wall: WallSide, at: number, spots: number[]): WallItem {
  return {
    wall,
    at,
    z: 16,
    draw(p, light, place) {
      spots.forEach((along, i) => {
        const s = SPRITES[i % 3 === 1 ? "cactus" : "plant"];
        const pal = litPalette(i % 3 === 2 ? { ...s.palette, P: "#d9a17a", L: "#b8d49a" } : s.palette, light, 0.6);
        const x = place.x + place.dir * along;
        const y = place.y + place.slope * along;
        p.alpha(0.25, () => p.rect(INK, x - 3, y - 1, 7, 1));
        p.sprite(s.grid, pal, x - Math.floor(s.grid[0].length / 2), y - s.grid.length);
      });
    },
  };
}

/**
 * The conservatory from the gravel walk: a white panelled plinth, tall glass
 * between white bars, a glass gable with a finial, the name on a white board
 * over double glass doors, ferns and citrus inside, the drink on a sill
 * shelf, box balls in urns by the door, hedges and a lamp on the lawn.
 */
function gardenFront(p: Painter, light: Light, box: FrontBox) {
  const L = (hex: string, f = 0.5, g = 0) => light.lit(hex, f, g);
  const fw = frontFace(light);
  const W = p.width;
  const { x, w, ground: G, open } = box;
  const night = light.night > 0.4;
  const c = Math.round(x + w / 2);
  const white = L(BAR, Math.max(0.5, fw));
  const whiteShade = L(mixHex(BAR, INK, 0.2), 0.3);
  const plinth = G - 14,
    eave = G - 70,
    apex = eave - 30;
  // Hedges on the lawn either side, a lamp on the walk.
  shrubFront(p, light, 0, G - 2, x - 6, 24, "#4f7444", 3);
  shrubFront(p, light, x + w + 6, G - 2, W - x - w - 6, 24, "#4f7444", 5);
  // The glass: the inside shows through, warm after dark.
  const gx0 = x + 2,
    gx1 = x + w - 2;
  const inner = (x0: number, x1: number, y0: number, y1: number) => {
    if (night && open) {
      p.rect("#f2d49a", x0, y0, x1 - x0, y1 - y0);
      p.dither("#e8bc78", x0, y1 - 8, x1 - x0, 8, 0.5);
    } else glassFront(p, light, x0, y0, x1 - x0, y1 - y0, false);
  };
  inner(gx0, gx1, eave, plinth);
  // The gable: glass in a white frame up to the finial.
  for (let y = apex; y < eave; y++) {
    const half = ((y - apex) / (eave - apex)) * (w / 2 + 4);
    const x0 = Math.round(c - half),
      x1 = Math.round(c + half);
    if (night && open) p.rect(y % 2 ? "#f2d49a" : "#ecc88a", x0, y, x1 - x0, 1);
    else p.rect(L(mixHex(light.sky[1], "#3b3440", y < apex + 10 ? 0.25 : 0.4), 0.5), x0, y, x1 - x0, 1);
  }
  // Silhouettes inside: hanging ferns, the citrus, the counter.
  const plant = night && open ? "#9a8a5a" : L("#4f6a4a", 0.3);
  for (const fx of [gx0 + 22, c + 30, gx1 - 18]) {
    p.line(L("#5a5048", 0.2), fx, eave, fx, eave + 8);
    p.oval(plant, fx, eave + 12, 7, 4);
    for (let k = -6; k <= 6; k += 3) p.line(plant, fx + k, eave + 13, fx + k * 1.4, eave + 20 - Math.abs(k) * 0.4);
  }
  p.rect(plant, gx0 + 8, plinth - 22, 2, 22);
  p.oval(plant, gx0 + 9, plinth - 26, 8, 7);
  if (open) {
    p.rect(L("#e6e0d0", 0.4, 0.6), c + 14, plinth - 9, 40, 2);
    p.rect(L("#cfc8b8", 0.3, 0.5), c + 14, plinth - 7, 40, 7);
  }
  // White bars, transom and the frame.
  for (let bx = gx0; bx <= gx1; bx += 13) p.rect(white, bx, eave, 2, plinth - eave);
  p.rect(white, gx0, eave + 14, gx1 - gx0, 2);
  p.rect(white, gx0 - 2, eave - 2, gx1 - gx0 + 4, 3);
  for (let i = -3; i <= 3; i++) {
    const bx = c + i * 13;
    const top = apex + Math.round((Math.abs(bx - c) / (w / 2 + 4)) * (eave - apex));
    if (top < eave) p.rect(white, bx, top, 2, eave - top);
  }
  p.line(L(INK, 0), x - 4, eave - 1, c, apex - 1);
  p.line(L(INK, 0), c, apex - 1, x + w + 4, eave - 1);
  for (let k = 0; k < 3; k++) {
    p.line(k === 2 ? whiteShade : white, x - 4, eave + k, c, apex + k);
    p.line(k === 2 ? whiteShade : white, c, apex + k, x + w + 4, eave + k);
  }
  // Cresting along the gable and a finial at the top.
  for (let t = 0.1; t < 0.95; t += 0.12) {
    p.rect(white, Math.round(x - 4 + (c - x + 4) * t), Math.round(eave - 2 - (eave - apex) * t) - 2, 1, 2);
    p.rect(white, Math.round(c + (x + w + 4 - c) * (1 - t)), Math.round(eave - 2 - (eave - apex) * t) - 2, 1, 2);
  }
  p.rect(white, c, apex - 8, 1, 8);
  p.oval(white, c, apex - 9, 2, 2);
  // The panelled plinth.
  p.rect(L(INK, 0), x - 1, plinth - 1, w + 2, 1);
  p.rect(L("#e2dccd", Math.max(0.4, fw)), x, plinth, w, G - plinth);
  p.rect(L("#f0ebde", 0.8), x - 2, plinth - 1, w + 4, 2);
  for (let px = x + 4; px + 14 < x + w; px += 18) p.rect(L("#c9c2b0", 0.3), px, plinth + 3, 14, G - plinth - 6);
  // The doors: double glass under a fanlight.
  const dw = 30,
    dx = c - dw / 2,
    dy = G - 44;
  p.rect(L(INK, 0), dx - 2, dy - 9, dw + 4, G - dy + 9);
  p.oval(white, c, dy, dw / 2 + 1, 8);
  p.oval(night && open ? "#f2d49a" : L(mixHex(light.sky[1], "#3b3440", 0.35), 0.5), c, dy, dw / 2 - 2, 6);
  for (const k of [-6, 0, 6]) p.line(white, c, dy, c + k, dy - 6);
  p.rect(white, dx, dy, dw, G - dy);
  inner(dx + 3, c - 1, dy + 3, G - 6);
  inner(c + 1, dx + dw - 3, dy + 3, G - 6);
  p.rect(white, dx + 3, dy + 16, dw - 6, 1);
  p.rect(L("#d6a367", 0.8), c - 3, dy + 22, 2, 3);
  p.rect(L("#d6a367", 0.8), c + 1, dy + 22, 2, 3);
  p.rect(L("#b9b2a4", 0.7), dx - 4, G - 2, dw + 8, 2);
  // The name on a white board over the door.
  signFront(p, light, box.name, c, eave - 8, "#f0ebde", "#4f6a4a", w - 10, 0.3);
  // A sill shelf inside the glass with the drink on it.
  if (open) {
    const sx = x + Math.round(w * 0.24);
    p.rect(L("#e6e0d0", 0.7), sx - 14, plinth - 2, 28, 2);
    if (box.display) displayCup(p, light, box.display, sx, plinth - 2);
  }
  // Box balls in stone urns by the door, flowers along the plinth.
  for (const ux of [dx - 14, dx + dw + 14]) {
    p.rect(L(INK, 0), ux - 6, G - 11, 13, 1);
    p.rect(L("#cfc5ae", fw + 0.2), ux - 5, G - 10, 11, 3);
    p.poly(L("#bdb39c", fw), [ux - 4, G - 7, ux + 5, G - 7, ux + 3, G, ux - 2, G]);
    shrubFront(p, light, ux - 7, G - 10, 14, 13, "#567a48", ux, true);
  }
  const blooms = light.season === "winter" ? [] : light.season === "autumn" ? ["#c47a3e", "#b9a0c8"] : ["#d98a96", "#e8cc86", "#b9a0c8", "#ece2cf"];
  for (let fx = x + 2; fx < x + w - 2; fx += 3) {
    if (fx > dx - 22 && fx < dx + dw + 22) continue;
    p.rect(L("#4f7044", 0.5), fx, G - 3 - (fx % 2), 2, 3);
    if (blooms.length && noise(fx, 1, 23) > 0.4) p.rect(L(blooms[Math.floor(noise(fx, 2, 23) * blooms.length)], 0.7), fx, G - 5 - (fx % 3), 2, 2);
  }
  lampFront(p, light, x - 10, G, 46);
}

/** Lanterns over the brew counter, the build counter and the two tables. */
const LANTERNS: [number, number, number][] = [
  [1.5, 1.5, 44],
  [4.5, 4.5, 40],
  [6.7, 4.7, 42],
  [7.7, 6.3, 36],
];

export function gardenVenue(o: VenueOptions): Venue {
  const { cols, rows } = o;
  const sill = 16,
    top = 72;
  const glass = (wall: WallSide, at: number, width: number): WindowSpec => ({ wall, at, width, sill, top, bars: 3, transom: 14, frame: BAR });
  return {
    id: "garden",
    cols,
    rows,
    floor: stone("#cdc3ac", "#c2b7a0", "#a59a84", "#dbd2be", 24),
    wall: plaster(WHITE, "#dcd5c4"),
    wainscot: { surface: shiplap("#e2dccd", "#dad3c2", "#bdb5a2", 4), height: 14, rail: "#cfc7b4" },
    cap: "#f0ebde",
    slab: "#a89c8a",
    windows: [glass("right", 0.15, 2.7), glass("right", 3.15, 2.7), glass("right", 6.15, 2.7), glass("left", 0.15, 2.4), glass("left", 2.8, 2.4), glass("left", 5.45, 2.4)],
    doors: [],
    // The lanterns are drawn by the overhead; these give their pools of light.
    lamps: [
      ...LANTERNS.map(([x, y, z]) => ({ kind: "sconce" as const, x, y, z, reach: 2.4 })),
      { kind: "bulbs", x: 0.3, y: 0, z: 76, to: [cols - 0.3, 0, 76], reach: 0.01 },
      { kind: "bulbs", x: 0, y: 0.3, z: 76, to: [0, rows - 0.3, 76], reach: 0.01 },
    ],
    wallItems: [sillPots("right", 0, [14, 34, 52, 160, 178, 198]), sillPots("left", 0, [80, 98, 142, 158])],
    props: [
      plantProp("prop:citrus", 0, rows - 1, "citrus", "#c47c5b", 0.6, 3),
      plantProp("prop:palm", cols - 1, 0, "palm", "#e8dcc4", 0.6, 5),
      fernStand("prop:fern", 0, 3.1),
      plantProp("prop:fig", 2.5, 0, "fig", "#e8dcc4", 0.6, 4),
      bistroProp("prop:table1", 6.2, 4.2, "#7f9a7e"),
      bistroProp("prop:table2", 6.9, 5.9, "#c98a6a"),
      ...frontWallProps("prop:front", cols, rows, { height: 14, kind: "panel", color: WHITE, line: "#bdb5a2", cap: "#f0ebde", base: ["#a8a090", 3], gapsRight: [rows - 1], post: BAR }),
    ],
    floorItems: [matItem(cols - 0.94, rows - 0.9, 0.86, 0.8, "#8a7a5a", "#5f6f52"), matItem(5.95, 3.95, 2.0, 3.1, "#c9b48a", "#8a7a5a")],
    counter: { top: "#e6e0d0", front: "#e2dccd", side: "#c9c2b0", trim: "#b9a888", panel: "slats", height: 15 },
    outside: {
      ground: gardenGround(cols, rows),
      far: farTrees,
      view: gardenView,
      props: [
        { ...fountainProp("out:fountain", FX - 1, FY - 1), shadow: "none" as const },
        hedgeProp("out:hedgeR", -1.2, -6.4, cols + 6, 0.8, 14),
        { ...hedgeProp("out:hedgeL", -6.0, 3.2, 0.8, rows + 5, 14), shadow: "none" as const },
        seasonTreeProp("out:tree1", 2.2, -8.0, "#5f8455", 3, 66),
        seasonTreeProp("out:tree2", -4.8, 6.6, "#6a8a58", 9, 64),
        { ...topiaryProp("out:topiary1", cols + 0.3, rows - 2.2), shadow: "none" as const },
        { ...topiaryProp("out:topiary2", cols - 0.2, rows + 0.35), shadow: "none" as const },
        lampPostProp("out:lamp", -1.0, rows + 0.4),
        { ...benchProp("out:bench", 3.0, rows + 0.75, "#e8e2d4", true), shadow: "none" as const },
      ],
    },
    entry: [cols + 1.4, rows - 0.5],
    queue: [
      [cols - 0.6, 1.6],
      [cols - 0.6, 2.6],
      [cols - 0.6, 3.6],
      [cols - 0.6, 4.6],
    ],
    pickup: [cols - 1.6, 2.4],
    indoorSun: 0.7,
    facade: {
      wall: plaster(WHITE, "#dcd5c4"),
      trim: BAR,
      sign: { board: "#f0ebde", ink: "#4f6a4a" },
      awning: null,
      door: BAR,
      upper: false,
      neighbours: "none",
      queueAt: 0.42,
      paint: gardenFront,
    },
    overhead(p, g, light) {
      hangingFerns(
        [
          [0.6, 2.2, 60],
          [0.6, 5.9, 58],
          [2.7, 0.6, 60],
          [6.0, 0.6, 58],
        ],
        80,
      )(p, g, light);
      lanterns(LANTERNS, 80)(p, g, light);
    },
  };
}
