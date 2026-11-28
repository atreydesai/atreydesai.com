/**
 * The Mountain Lodge: a log cabin under the peaks. Round-log walls with pale
 * chinking, a fieldstone fireplace in the back corner with the fire lit, a
 * plaid rug and an armchair, skis and snowshoes on the walls, lanterns,
 * log counters. Outside, snow with footprints to the door, pines, a
 * woodpile and a sled; in summer and autumn the meadow shows through.
 * The trade here is hot drinks: a copper urn steams by the window.
 */
import { mixHex } from "../../../../core/color.ts";
import { isoBox, isoTile, project, faceLight, type IsoGrid } from "../../../../core/iso.ts";
import type { Light } from "../../../../core/light.ts";
import type { Painter } from "../../../../core/painter.ts";
import { noise } from "../../../../core/painter.ts";
import { planks, type Surface } from "../surfaces.ts";
import type { Venue, PropSpec, WallItem, FrontBox } from "../types.ts";
import { cafeTable, seating } from "../seating.ts";
import { displayCup } from "../front.ts";
import type { VenueOptions } from "./index.ts";
import { menuBoard, rail, clock } from "../walls.ts";
import { SPRITES, litPalette, INK } from "../props.ts";
import { word, bigWord, bigWidth } from "../font.ts";
import { overlay, litOnce, table, wpt, wline, wquad, wdot, wdisc, wword, fpt, fquad, fline, frontWalls, type Box } from "./_frontier-kit.ts";

const LOG = "#8b5e3f";
const LOG_L = "#a87b55";
const LOG_D = "#5a3d2c";
const CHINK = "#c9b799";
const STONE = "#9a938a";
const STONE_ALT = "#8a837b";
const MORTAR = "#6a635c";
const PLAID = "#9e3f36";
const PINE = "#4f7556";
const SNOW = "#e8ecef";

/** Snow on the ground and the trees: winter, spring at this height, or snow falling. */
const snowy = (l: Light) => l.weather === "snow" || l.season === "winter" || l.season === "spring";

/** Round logs laid along the wall, chinked pale between, the odd check and knot. */
const logWall: Surface = {
  colors: [LOG, LOG_L, LOG_D, CHINK, "#7a5136"],
  at(u, z) {
    const course = Math.floor(z / 8);
    const y = z - course * 8;
    if (y < 1) return 3;
    if (y < 2) return 2;
    if (y > 6) return 1;
    if (noise(Math.floor(u / 3), course, 3) > 0.95) return 4;
    return noise(Math.floor((u + course * 17) / 40), course, 5) > 0.72 ? 4 : 0;
  },
};

/** Wide boards, a plaid rug in the lounge, hearthstones before the fire, a mat inside the door. */
function lodgeFloor(cols: number, rows: number): Surface {
  return overlay(planks("#a97c52", "#b18459", "#6e4c35", "#9a6f48", 9, 70), [PLAID, "#3f5a45", "#2f3b4a", "#d8c9a6", "#7c3029", STONE, STONE_ALT, MORTAR, "#7a6a4a", "#5f5238"], (u, v) => {
    const x = u / 24;
    const y = v / 24;
    // The rug.
    if (x > 2.2 && x < 4.8 && y > 5.3 && y < 7.5) {
      if (x < 2.3 || x > 4.7) return Math.floor(v) % 2 ? 3 : -1;
      if (y < 5.38 || y > 7.42) return 4;
      const a = Math.floor(u) % 16;
      const b = Math.floor(v) % 16;
      const ga = a < 4;
      const gb = b < 4;
      if (ga && gb) return 2;
      if (ga || gb) return (Math.floor(u) + Math.floor(v)) & 1 ? 1 : 4;
      if (a === 9 || b === 9) return 3;
      return 0;
    }
    // Hearthstones before the fireplace.
    if (x > cols - 2.15 && y < 1.2) {
      const row = Math.floor(v / 7);
      const off = row & 1 ? 5 : 0;
      if (Math.floor(v) % 7 === 0 || Math.floor(u + off) % 11 === 0) return 7;
      return noise(Math.floor((u + off) / 11), row, 4) > 0.5 ? 5 : 6;
    }
    // A woven mat inside the door.
    if (x > cols - 1.05 && x < cols - 0.1 && y > 5.1 && y < 6.9) return Math.floor(v / 3) % 2 ? 8 : 9;
    return -1;
  });
}

// The outside: snow round the cabin, a trodden path and footprints from the door, ski tracks off to the left.
// The same marks read as meadow, dirt path and boot prints in summer and autumn.
const SNOW_SLOT = 0, ALT = 1, SPECK = 2, PRINT = 3, PATH = 4, TRACK = 5, DRIFT = 6;
const WINTER_GROUND = [SNOW, "#dfe4e9", "#cbd3dc", "#b4bfcc", "#d2d9e1", "#c4cdd8", "#d6dde5"];
const SUMMER_GROUND = ["#86a067", "#7e9a60", "#9fb87a", "#8a7a5a", "#a3916f", "#7e9a60", "#6f8a56"];
const AUTUMN_GROUND = ["#a99c62", "#9f9259", "#bdb071", "#857252", "#9c8766", "#9f9259", "#8c7f4c"];

function lodgeGround(cols: number, rows: number) {
  return (x: number, y: number, light?: Light) => {
    const pal = !light || snowy(light) ? WINTER_GROUND : light.season === "autumn" ? AUTUMN_GROUND : SUMMER_GROUND;
    return pal[groundSlot(cols, x, y, rows)];
  };
}

function groundSlot(cols: number, x: number, y: number, rows: number) {
  // Snow banked against the cabin's foot.
  if (Math.max(-x, -y, x - cols, y - rows) < 0.3) return DRIFT;
  // The path from the door down to the bottom of the frame, footprints along it.
  if (x > cols - 0.2) {
    const along = x - cols;
    const yc = 6.0 + along * 0.3 + Math.sin(along * 1.3) * 0.15;
    const off = y - yc;
    if (off > -0.42 && off < 0.42) {
      const k = Math.floor(along / 0.38);
      const fx = cols + (k + 0.5) * 0.38;
      const fy = yc + (k & 1 ? 0.13 : -0.13);
      if ((x - fx) ** 2 * 26 + (y - fy) ** 2 * 50 < 0.12) return PRINT;
      return noise(Math.floor(x * 24), Math.floor(y * 24), 7) > 0.8 ? ALT : PATH;
    }
  }
  // Ski tracks running off to the left.
  if (x < -1.5) {
    const t = y - 0.45 * x;
    if ((t > 5.4 && t < 5.47) || (t > 5.62 && t < 5.69)) return TRACK;
  }
  return SNOWFIELD[(Math.floor(y * 24) & 255) * 256 + (Math.floor(x * 24) & 255)];
}

/** The open snow's grain and drifts, baked once into a tile of slots. */
const SNOWFIELD = (() => {
  const t = new Uint8Array(256 * 256);
  for (let v = 0; v < 256; v++)
    for (let u = 0; u < 256; u++) t[v * 256 + u] = noise(u, v, 11) > 0.95 ? SPECK : noise(Math.floor(u / 6), Math.floor(v / 4), 12) > 0.6 ? ALT : SNOW_SLOT;
  return t;
})();

// Peaks: a far pale range and a nearer one, snow above a line that drops in winter.
const PEAKS_FAR: [number, number, number][] = [[0.05, 26, 0.9], [0.22, 34, 1.1], [0.4, 22, 0.8], [0.6, 38, 1.0], [0.78, 28, 0.9], [0.95, 32, 1.1]];
const PEAKS_NEAR: [number, number, number][] = [[0.12, 18, 0.7], [0.33, 14, 0.6], [0.5, 20, 0.75], [0.7, 15, 0.6], [0.88, 19, 0.7]];

/** Height of a range at column x, and whether x is on its peak's sunward (left) flank. */
function ridge(peaks: [number, number, number][], x: number, width: number): [number, boolean] {
  let h = 0;
  let left = true;
  for (const [px, ph, s] of peaks) {
    const d = x - px * width;
    const v = ph - Math.abs(d) * s * 0.9 + noise(Math.floor(x / 2), Math.floor(px * 100), 4) * 1.6;
    if (v > h) {
      h = v;
      left = d < 0;
    }
  }
  return [h, left];
}

function farPeaks(p: Painter, light: Light, width: number, horizon: number) {
  const deep = snowy(light);
  const farRock = light.lit("#8e9db0", 0.3);
  const farSnow = light.lit("#e9eef2", 0.5);
  const farShade = light.lit("#c3cdd8", 0.2);
  const nearRock = light.lit("#6f7f8f", 0.3);
  const nearSnow = light.lit("#e4e9ee", 0.6);
  const nearShade = light.lit("#b6c1cd", 0.2);
  const base = horizon + 8;
  const sunLeft = light.azimuth > 0;
  for (let x = 0; x < width; x++) {
    const [h1, l1] = ridge(PEAKS_FAR, x, width);
    const top1 = Math.max(0, Math.round(base - h1));
    const snowTo = Math.round(base - h1 * (deep ? 0.55 : 0.78) + noise(x >> 1, 3, 2) * 2);
    const lit = l1 === sunLeft;
    p.rect(farRock, x, top1, 1, base - top1);
    if (snowTo > top1) p.rect(lit ? farSnow : farShade, x, top1, 1, snowTo - top1);
  }
  for (let x = 0; x < width; x++) {
    const [hh, l2] = ridge(PEAKS_NEAR, x, width);
    const h2 = hh * 0.9;
    const top2 = Math.max(0, Math.round(base + 6 - h2));
    const snowTo = Math.round(base + 6 - h2 * (deep ? 0.35 : 0.72) + noise(x >> 1, 5, 2) * 2);
    const lit = l2 === sunLeft;
    p.rect(nearRock, x, top2, 1, base + 6 - top2);
    if (snowTo > top2) p.rect(lit ? nearSnow : nearShade, x, top2, 1, snowTo - top2);
  }
  // The treeline along the foot of the range.
  const tree = light.lit("#3f5f49", 0.2);
  const treeSnow = light.lit("#dfe6ea", 0.4);
  for (let tx = -3; tx < width + 3; tx += 3) {
    const h = 5 + Math.floor(noise(tx, 2, 6) * 6);
    const by = base + 9;
    for (let r = 0; r < h; r++) {
      const half = Math.floor((r * 2.2) / h + 0.5);
      p.rect(tree, tx - half, by - h + r, half * 2 + 1, 1);
    }
    if (deep) p.rect(treeSnow, tx, by - h, 1, 2);
  }
  p.rect(tree, 0, base + 8, width, 2);
}

// The window view: snow (or meadow), a row of pines, the range behind, sky.
const VIEW_RIDGE = table(2048, (i) => 0.58 + 0.16 * Math.max(0, Math.sin(i / 23) * 0.8 + Math.sin(i / 9.5) * 0.35) + noise(i >> 1, 1, 3) * 0.015);
const VIEW_PINE = table(2048, (i) => {
  const c = i % 11;
  const h = 0.22 + noise(Math.floor(i / 11), 0, 8) * 0.16;
  return 0.18 + h * (1 - Math.abs(c - 5) / 5.5);
});
const VIEW = litOnce([
  [SNOW, 0.5],
  ["#d2d9e1", 0.3],
  ["#3f5f49", 0.3],
  ["#dfe6ea", 0.5],
  ["#7d8d9d", 0.3],
  ["#e6ebef", 0.6],
  ["#bcc6d1", 0.2],
  ["#86a067", 0.5],
  ["#a99c62", 0.5],
  ["#5a3d2c", 0.2],
]);

function lodgeView(u: number, v: number, light: Light) {
  const c = VIEW(light);
  const [s0, s1, s2] = light.sky;
  const iu = Math.floor(u) & 2047;
  const deep = snowy(light);
  const pine = VIEW_PINE[iu];
  if (v < 0.17) return deep ? (noise(iu, Math.floor(v * 30), 2) > 0.88 ? c[1] : c[0]) : light.season === "autumn" ? c[8] : c[7];
  if (v < pine) return deep && v > pine - 0.025 ? c[3] : c[2];
  const r = VIEW_RIDGE[iu];
  if (v < r) {
    const snowLine = deep ? 0.5 : 0.62;
    if (v > snowLine + (iu % 13) * 0.004) return (iu >> 3) & 1 ? c[5] : c[6];
    return c[4];
  }
  return v < 0.78 ? s2 : v < 0.9 ? s1 : s0;
}

// Things standing outside.

/** A pine with its tiers, snow along their tops when the season has it. */
function pineProp(key: string, x: number, y: number, h: number, seed: number): PropSpec {
  return {
    key,
    x,
    y,
    height: h,
    pad: 14,
    shadow: "round",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const deep = snowy(light);
      const base = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, base.x, base.y, 6, 2));
      if (deep) p.oval(light.lit("#f1f4f6", f.top), base.x, base.y - 1, 7, 2);
      p.rect(light.lit("#5e4232", f.left), base.x - 1, base.y - 8, 3, 8);
      const tiers = 5;
      const dark = light.lit(mixHex(PINE, INK, 0.3), f.right * 0.5);
      const mid = light.lit(PINE, f.left);
      const hi = light.lit(mixHex(PINE, "#cfe0b8", 0.25), f.top);
      const snow = light.lit("#f1f4f6", Math.min(1, f.top + 0.2));
      const snowD = light.lit("#cdd6e0", 0.2);
      const step = (h - 12) / tiers;
      for (let i = 0; i < tiers; i++) {
        const by = base.y - 6 - i * step;
        const w = Math.round(15 - i * 2.6 + noise(i, seed, 3) * 2);
        const th = step + 7;
        p.poly(INK, [base.x, by - th - 1, base.x + w + 1, by + 1, base.x - w - 1, by + 1]);
        p.poly(dark, [base.x, by - th, base.x + w, by, base.x - w, by]);
        p.poly(mid, [base.x, by - th, base.x - w, by, base.x - 1, by - 2]);
        p.line(hi, base.x - 1, by - th + 1, base.x - w + 2, by - 1);
        if (deep) {
          for (let k = -w + 1; k < w; k++) {
            const sag = Math.abs(k) / w;
            const yy = by - 1 - Math.round((1 - sag) * 2);
            p.rect(k < 0 ? snow : snowD, base.x + k, yy - 1, 1, 2);
          }
          p.rect(snow, base.x - 1, by - th, 2, 2);
        }
      }
    },
  };
}

/** Split logs stacked on the snow, end grain out, a cap of snow on the top in season. */
function woodpileProp(key: string, x: number, y: number, w: number): PropSpec {
  return {
    key,
    x,
    y,
    w,
    d: 0.7,
    height: 22,
    pad: 6,
    shadow: "none",
    draw(p, g, light) {
      p.alpha(0.25, () => p.poly(INK, [project(g, 0, 0.55).x, project(g, 0, 0.55).y, project(g, w, 0.55).x, project(g, w, 0.55).y, project(g, w, 0.75).x + 3, project(g, w, 0.75).y + 2, project(g, 0, 0.75).x + 3, project(g, 0, 0.75).y + 2]));
      const f = faceLight(light, 1);
      const box: Box = [0.05, 0.1, w - 0.1, 0.5];
      isoBox(p, g, light, ...box, 14, { top: "#7a5638", left: "#4a3428", right: "#5a3d2c" });
      // End grain on the face toward +y: staggered rows of log ends.
      const n = Math.floor((w - 0.1) * 7);
      const end = light.lit("#d9b88a", f.left);
      const end2 = light.lit("#c49a6a", f.left);
      const ring = light.lit("#9a7048", f.left * 0.5);
      for (let row = 0; row < 3; row++)
        for (let k = 0; k < n; k++) {
          const s = (k + 0.5 + (row & 1) * 0.5) / n;
          if (s > 0.97) continue;
          const q = fpt(g, "left", box, s, 3 + row * 4.5);
          p.oval(INK, q.x, q.y - 1, 2.6, 2.6);
          p.oval(noise(k, row, 4) > 0.5 ? end : end2, q.x, q.y - 1, 1.8, 1.8);
          p.rect(ring, q.x, q.y - 1, 1, 1);
        }
      // A chopping block and its axe at the near end.
      const c = project(g, w - 0.1, 0.85, 0);
      p.rect(INK, c.x - 4, c.y - 7, 9, 7);
      p.rect(light.lit("#7a5638", f.left), c.x - 3, c.y - 6, 7, 6);
      p.oval(light.lit("#d9b88a", f.top), c.x, c.y - 7, 4, 1.5);
      p.line(light.lit("#8a6a4c", 0.3), c.x + 1, c.y - 7, c.x + 6, c.y - 15);
      p.rect(light.lit("#8e9094", 0.5), c.x - 1, c.y - 9, 3, 2);
      if (snowy(light)) {
        isoBox(p, g, light, 0.03, 0.08, w - 0.06, 0.54, 2, { top: "#eef2f4", left: "#dfe5ea", right: "#cbd3dc", ink: "" }, 14);
        const snow = light.lit("#eef2f4", f.top);
        for (let k = 0; k < n; k += 2) {
          const q = fpt(g, "left", box, (k + 0.5) / n, 14);
          p.rect(snow, q.x - 1, q.y, 3, 1);
        }
        p.oval(snow, c.x, c.y - 8, 3, 1);
      }
    },
  };
}

/** A wooden post with a lantern hung from its arm. */
function lanternPostProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 46,
    pad: 8,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const b = project(g, 0.5, 0.5, 0);
      p.alpha(0.25, () => p.rect(INK, b.x - 3, b.y - 1, 7, 2));
      p.rect(INK, b.x - 2, b.y - 42, 4, 42);
      p.rect(light.lit("#6e4c35", f.left), b.x - 1, b.y - 42, 2, 42);
      p.rect(INK, b.x - 2, b.y - 42, 12, 3);
      p.rect(light.lit("#8b5e3f", f.top), b.x - 1, b.y - 41, 10, 1);
      const on = light.night > 0.15;
      p.rect(INK, b.x + 5, b.y - 38, 7, 9);
      p.rect(on ? "#ffd27a" : light.lit("#e6d2a6", 0.3), b.x + 6, b.y - 37, 5, 7);
      if (on) p.alpha(0.28 * light.night, () => p.oval("#ffc070", b.x + 8, b.y - 33, 12, 10));
      if (snowy(light)) p.rect(light.lit("#eef2f4", f.top), b.x - 2, b.y - 43, 12, 1);
    },
  };
}

/** A red wooden sled, or in summer a wheelbarrow of kindling. */
function sledProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 14,
    pad: 4,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      if (snowy(light)) {
        for (const v of [0.25, 0.65]) {
          const a = project(g, 0.05, v, 1);
          const b = project(g, 0.95, v, 1);
          p.line(light.lit("#5a4a44", 0.2), a.x, a.y, b.x, b.y);
          p.line(light.lit("#5a4a44", 0.2), b.x, b.y, b.x + 2, b.y - 3);
        }
        isoBox(p, g, light, 0.12, 0.18, 0.72, 0.55, 2, { top: "#b8463a", left: "#9a3a30", right: "#7a2e28" }, 4);
        for (const u of [0.3, 0.5, 0.7]) {
          const q = project(g, u, 0.18, 6);
          const r = project(g, u, 0.73, 6);
          p.line(light.lit("#d36a55", f.top), q.x, q.y, r.x, r.y);
        }
        const rope = project(g, 0.95, 0.45, 3);
        p.line(light.lit("#c9b48e", 0.4), rope.x, rope.y, rope.x + 6, rope.y + 4);
      } else {
        isoBox(p, g, light, 0.2, 0.25, 0.6, 0.45, 7, { top: "#6f8a8e", left: "#5f777a", right: "#4f6366" }, 3);
        const w = project(g, 0.9, 0.5, 3);
        p.oval(INK, w.x, w.y, 3, 3);
        p.oval(light.lit("#5a4a44", 0.2), w.x, w.y, 2, 2);
        for (let k = 0; k < 4; k++) {
          const q = project(g, 0.3 + k * 0.12, 0.45, 10);
          p.rect(light.lit("#a97c52", f.top), q.x - 2, q.y, 5, 1);
        }
      }
    },
  };
}

/** A snowman with a scarf, in the snow seasons only. */
function snowmanProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 26,
    pad: 6,
    shadow: "none",
    draw(p, g, light) {
      if (!snowy(light)) return;
      const f = faceLight(light, 1);
      const b = project(g, 0.5, 0.5, 0);
      const body = light.lit("#eef2f4", f.top);
      const shade = light.lit("#c9d2dc", f.left * 0.3);
      p.alpha(0.25, () => p.oval(INK, b.x + 1, b.y, 7, 2));
      for (const [r, y] of [[7, 7], [5, 17], [4, 24]] as const) {
        p.oval(INK, b.x, b.y - y, r + 1, r + 1);
        p.oval(shade, b.x, b.y - y, r, r);
        p.oval(body, b.x - 1, b.y - y - 1, r - 1, r - 1);
      }
      p.rect(light.lit("#b8463a", 0.4), b.x - 4, b.y - 20, 9, 2);
      p.rect(light.lit("#b8463a", 0.4), b.x + 2, b.y - 19, 2, 5);
      p.rect(light.lit("#e0823c", 0.5), b.x, b.y - 24, 3, 1);
      p.rect(INK, b.x - 2, b.y - 26, 1, 1);
      p.rect(INK, b.x + 1, b.y - 26, 1, 1);
      for (const k of [10, 14]) p.rect(INK, b.x, b.y - k, 1, 1);
      p.line(light.lit("#5e4232", 0.2), b.x - 5, b.y - 16, b.x - 10, b.y - 21);
      p.line(light.lit("#5e4232", 0.2), b.x + 5, b.y - 16, b.x + 10, b.y - 20);
    },
  };
}

/** A carved signpost pointing in. */
function signpostProp(key: string, x: number, y: number): PropSpec {
  return {
    key,
    x,
    y,
    height: 34,
    pad: 10,
    shadow: "none",
    draw(p, g, light) {
      const f = faceLight(light, 1);
      const b = project(g, 0.5, 0.5, 0);
      p.rect(INK, b.x - 2, b.y - 30, 4, 30);
      p.rect(light.lit("#6e4c35", f.left), b.x - 1, b.y - 30, 2, 30);
      p.poly(INK, [b.x - 18, b.y - 30, b.x + 10, b.y - 30, b.x + 10, b.y - 21, b.x - 18, b.y - 21, b.x - 22, b.y - 26]);
      p.poly(light.lit(LOG_L, f.left), [b.x - 17, b.y - 29, b.x + 9, b.y - 29, b.x + 9, b.y - 22, b.x - 17, b.y - 22, b.x - 20, b.y - 26]);
      word(p, "LODGE", light.lit("#3a2820", 0.2), b.x - 16, b.y - 28);
      if (snowy(light)) p.rect(light.lit("#eef2f4", f.top), b.x - 18, b.y - 31, 28, 1);
    },
  };
}

// Things standing in the cabin.

/** Stone courses on a box face: staggered joints, a few stones a shade apart. */
function stoneFace(p: Painter, g: IsoGrid, light: Light, face: "left" | "right", b: Box, z0: number, z1: number, lit: number, seed: number) {
  const len = (face === "left" ? b[2] : b[3]) * 24;
  const mortar = light.lit(MORTAR, lit * 0.5);
  const alt = light.lit(STONE_ALT, lit);
  const pale = light.lit("#b0a99f", lit);
  for (let z = z0; z < z1; z += 6) {
    const course = Math.floor(z / 6);
    let a = noise(course, seed, 3) * 6 - 6;
    while (a < len) {
      const w = 7 + Math.floor(noise(Math.floor(a), course, seed + 1) * 6);
      const s0 = Math.max(0, a / len);
      const s1 = Math.min(1, (a + w) / len);
      const n = noise(Math.floor(a), course, seed + 2);
      if (s1 > s0 && n > 0.55) fquad(p, g, face, b, s0, s1, z + 1, Math.min(z + 6, z1), n > 0.85 ? pale : alt);
      if (a > 0) fline(p, g, face, b, s0, z, s0, Math.min(z + 6, z1), mortar);
      a += w;
    }
    fline(p, g, face, b, 0, z, 1, z, mortar);
  }
}

/** The fireplace: a fieldstone hearth with the fire going, a log mantel, the chimney breast to the ceiling. */
function fireplaceProp(cols: number, share: number): PropSpec {
  return {
    key: "prop:fireplace",
    x: cols - 2,
    y: 0,
    w: 2,
    d: 0.85,
    height: 92,
    pad: 8,
    draw(p, g, light) {
      const f = faceLight(light, share);
      // The chimney breast, to the wall top and through it.
      const breast: Box = [0.25, 0, 1.5, 0.55];
      isoBox(p, g, light, ...breast, 88, { top: STONE, left: STONE, right: mixHex(STONE, INK, 0.2) }, 0, share);
      stoneFace(p, g, light, "left", breast, 34, 88, f.left, 5);
      stoneFace(p, g, light, "right", breast, 34, 88, f.right, 9);
      isoBox(p, g, light, 0.2, -0.02, 1.6, 0.6, 3, { top: "#7d766e" }, 88, share);
      // A mountain print on the breast.
      const pa = fpt(g, "left", breast, 0.28, 66);
      const pb = fpt(g, "left", breast, 0.72, 66);
      p.poly(light.lit("#5a3d2c", 0.2), [pa.x - 1, pa.y - 1, pb.x + 1, pb.y - 1, pb.x + 1, pb.y + 15, pa.x - 1, pa.y + 15]);
      p.poly(light.lit("#c9d6de", 0.3), [pa.x, pa.y, pb.x, pb.y, pb.x, pb.y + 14, pa.x, pa.y + 14]);
      const mid = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;
      p.poly(light.lit("#6f7f8f", 0.3), [pa.x, pa.y + 12, mid - 2, my + 3, mid + 3, my + 7, pb.x, pb.y + 10, pb.x, pb.y + 14, pa.x, pa.y + 14]);
      p.poly(light.lit("#eef2f4", 0.5), [mid - 4, my + 6, mid - 2, my + 3, mid + 1, my + 5]);
      p.line(light.lit("#3f5f49", 0.3), pa.x, pa.y + 13, pb.x, pb.y + 13);
      // The hearth box.
      const hearth: Box = [0, 0, 2, 0.85];
      isoBox(p, g, light, ...hearth, 30, { top: STONE, left: STONE, right: mixHex(STONE, INK, 0.2) }, 0, share);
      stoneFace(p, g, light, "left", hearth, 0, 30, f.left, 3);
      stoneFace(p, g, light, "right", hearth, 0, 30, f.right, 7);
      // The firebox: an arched mouth on the front face, black inside, the fire in it.
      const len = 48;
      const a0 = 12;
      const a1 = 36;
      const half = (a1 - a0) / 2;
      const midA = (a0 + a1) / 2;
      const soot = light.lit("#2a2220", 0);
      const flame = ["#ffe39a", "#f6b04a", "#e2702f", "#b8452c"].map((c) => light.lit(c, 0.6, 1));
      for (let a = a0; a <= a1; a++) {
        const s = a / len;
        const top = 14 + 7 * Math.sqrt(Math.max(0, 1 - ((a - midA) / half) ** 2));
        const q = fpt(g, "left", hearth, s, 0);
        p.rect(INK, q.x, q.y - top - 1, 1, 1);
        p.rect(soot, q.x, q.y - top, 1, top - 1);
        // Flames: tongues of different heights, hottest at the root.
        const t = (a - a0) / (a1 - a0);
        if (t < 0.08 || t > 0.92) continue;
        const fh = 5 + Math.round(7 * Math.abs(Math.sin(a * 1.7)) * (1 - Math.abs(t - 0.5)) + noise(a, 1, 5) * 3);
        for (let z = 0; z < fh; z++) {
          const k = z / fh;
          const c = k < 0.3 ? flame[0] : k < 0.6 ? flame[1] : k < 0.85 ? flame[2] : flame[3];
          p.rect(c, q.x, q.y - 5 - z, 1, 1);
        }
      }
      // Logs on the andirons, glowing at the ends.
      const l0 = fpt(g, "left", hearth, 0.3, 4);
      const l1 = fpt(g, "left", hearth, 0.7, 4);
      p.line(light.lit("#4a3428", 0.2), l0.x, l0.y, l1.x, l1.y);
      p.line(light.lit("#3a2a22", 0.1), l0.x, l0.y + 1, l1.x, l1.y + 1);
      p.rect(flame[2], l0.x, l0.y - 1, 2, 2);
      p.rect(flame[1], l1.x - 1, l1.y - 1, 2, 2);
      if (light.night > 0.1) {
        const c = fpt(g, "left", hearth, 0.5, 8);
        p.alpha(0.22 * light.night, () => p.oval("#ffb060", c.x, c.y + 6, 22, 8));
      }
      // The log mantel, a few things on it.
      isoBox(p, g, light, -0.06, -0.02, 2.12, 0.95, 4, { top: LOG_L, left: LOG, right: LOG_D }, 30, share);
      const things: [number, string, number][] = [[0.25, "#efe2c4", 7], [0.38, "#efe2c4", 5], [1.62, "#c9573f", 5], [1.78, "#5f7a5a", 6]];
      for (const [u, col, h] of things) {
        const q = project(g, u, 0.5, 34);
        p.rect(INK, q.x - 2, q.y - h - 1, 4, h + 1);
        p.rect(light.lit(col, f.top), q.x - 1, q.y - h, 2, h);
        if (col === "#efe2c4") p.rect(light.night > 0.2 ? "#ffd27a" : light.lit("#e8b25a", 0.3), q.x - 1, q.y - h - 2, 1, 1);
      }
      // A pine sprig along the mantel's middle.
      for (let k = 0; k < 9; k++) {
        const q = project(g, 0.6 + k * 0.09, 0.6, 35);
        p.rect(light.lit(PINE, f.top), q.x, q.y - 1 - (k % 2), 2, 2);
        if (k % 3 === 1) p.rect(light.lit("#b8463a", 0.4), q.x, q.y - 2, 1, 1);
      }
      // Tools by the hearth.
      const tq = project(g, 1.9, 0.95, 0);
      p.rect(light.lit("#3a3436", 0.2), tq.x, tq.y - 16, 1, 16);
      p.rect(light.lit("#3a3436", 0.2), tq.x - 2, tq.y - 2, 5, 2);
    },
  };
}

/** A copper urn of hot water on a little stand, steaming. */
function urnProp(x: number, y: number, share: number): PropSpec {
  return {
    key: "prop:urn",
    x,
    y,
    height: 46,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, share);
      isoBox(p, g, light, 0.18, 0.18, 0.64, 0.64, 10, { top: LOG_L, left: LOG, right: LOG_D }, 0, share);
      const c = project(g, 0.5, 0.5, 10);
      const copper = light.lit("#b8703f", f.left);
      const hi = light.lit("#e3a06a", Math.min(1, f.top + 0.2));
      const dark = light.lit("#7a4528", 0);
      const rows: number[] = [5, 7, 8, 8, 8, 7, 6, 4, 3];
      rows.forEach((r, i) => {
        const y = c.y - 2 - i * 2;
        p.rect(INK, c.x - r - 1, y - 1, r * 2 + 3, 3);
      });
      rows.forEach((r, i) => {
        const y = c.y - 2 - i * 2;
        p.rect(copper, c.x - r, y, r * 2 + 1, 2);
        p.rect(dark, c.x + r - 1, y, 2, 2);
        p.rect(hi, c.x - r + 1, y, 1, 2);
      });
      p.oval(INK, c.x, c.y - 21, 4, 2);
      p.oval(hi, c.x, c.y - 21, 3, 1);
      p.rect(INK, c.x - 1, c.y - 25, 3, 3);
      p.rect(light.lit("#3a2a22", 0.2), c.x, c.y - 24, 1, 2);
      for (const side of [-1, 1]) {
        p.rect(INK, c.x + side * 10 - 1, c.y - 15, 3, 6);
        p.rect(copper, c.x + side * 10, c.y - 14, 1, 4);
      }
      // The tap.
      p.rect(INK, c.x - 9, c.y - 8, 4, 3);
      p.rect(light.lit("#d9b06a", 0.5), c.x - 8, c.y - 7, 2, 1);
      // Steam.
      p.alpha(0.45, () => {
        const steam = light.lit("#f3eee6", 0.6);
        for (let k = 0; k < 12; k++) p.rect(steam, c.x + Math.round(Math.sin(k * 0.7) * 2), c.y - 27 - k, 1, 1);
        for (let k = 0; k < 8; k++) p.rect(steam, c.x + 3 + Math.round(Math.sin(k * 0.8 + 2) * 2), c.y - 29 - k, 1, 1);
      });
    },
  };
}

function logBasketProp(x: number, y: number, share: number): PropSpec {
  return {
    key: "prop:logs",
    x,
    y,
    height: 20,
    pad: 4,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const c = project(g, 0.5, 0.5, 0);
      const logs: [number, number, number][] = [[-4, 14, -2], [0, 16, 1], [4, 13, 3], [-1, 12, -4]];
      for (const [dx, h, lean] of logs) {
        p.line(INK, c.x + dx - 1, c.y - 4, c.x + dx + lean - 1, c.y - h);
        p.line(light.lit("#8a6a4c", f.left), c.x + dx, c.y - 4, c.x + dx + lean, c.y - h);
        p.line(light.lit("#6a4c3c", 0), c.x + dx + 1, c.y - 4, c.x + dx + lean + 1, c.y - h);
        p.rect(light.lit("#d9b88a", f.top), c.x + dx + lean, c.y - h - 1, 2, 1);
      }
      p.oval(INK, c.x, c.y - 4, 9, 5);
      p.oval(light.lit("#a8875a", f.left), c.x, c.y - 4, 8, 4);
      for (let k = -7; k <= 7; k += 2) p.rect(light.lit("#7a5f3e", 0), c.x + k, c.y - 6, 1, 5);
      p.rect(light.lit("#c9a774", f.top), c.x - 7, c.y - 8, 15, 1);
    },
  };
}

/** A leather armchair with a plaid throw over its arm. */
function armchairProp(x: number, y: number, share: number): PropSpec {
  return {
    key: "prop:armchair",
    x,
    y,
    height: 26,
    pad: 4,
    draw(p, g, light) {
      const leather = "#8a4a32";
      const top = "#a8664a";
      // Back, seat, cushion, then the two arms over the seat's sides.
      isoBox(p, g, light, 0.18, 0.14, 0.64, 0.18, 21, { top, left: mixHex(leather, INK, 0.12) }, 0, share);
      isoBox(p, g, light, 0.18, 0.3, 0.64, 0.5, 7, { top, left: leather }, 0, share);
      isoBox(p, g, light, 0.26, 0.32, 0.48, 0.44, 2, { top: "#b5714f", left: "#9c5a3e", ink: "" }, 7, share);
      isoBox(p, g, light, 0.1, 0.18, 0.13, 0.64, 12, { top, left: leather }, 0, share);
      isoBox(p, g, light, 0.77, 0.18, 0.13, 0.64, 12, { top, left: leather }, 0, share);
      // The throw.
      const f = faceLight(light, share);
      const a = project(g, 0.84, 0.3, 12);
      for (let k = 0; k < 7; k++) p.rect(light.lit(k % 3 === 0 ? "#3f5a45" : PLAID, f.right), a.x - 2 + Math.round(k * 0.6), a.y - 1 + k, 4, 1);
    },
  };
}

/** A stump side table with a mug of cocoa, steaming. */
function stumpProp(x: number, y: number, share: number): PropSpec {
  return {
    key: "prop:stump",
    x,
    y,
    height: 22,
    pad: 4,
    draw(p, g, light) {
      const f = faceLight(light, share);
      const c = project(g, 0.5, 0.5, 0);
      p.alpha(0.3, () => p.oval(INK, c.x, c.y, 7, 2));
      p.rect(INK, c.x - 7, c.y - 12, 15, 12);
      p.rect(light.lit("#7a5638", f.left), c.x - 6, c.y - 12, 13, 12);
      for (const k of [-4, 0, 3]) p.rect(light.lit("#5a3d2c", 0), c.x + k, c.y - 11, 1, 10);
      p.oval(INK, c.x, c.y - 12, 7, 3);
      p.oval(light.lit("#d9b88a", f.top), c.x, c.y - 12, 6, 2);
      p.oval(light.lit("#b8956a", f.top), c.x, c.y - 12, 3, 1);
      p.rect(INK, c.x - 2, c.y - 19, 5, 6);
      p.rect(light.lit("#c9573f", f.left), c.x - 1, c.y - 18, 3, 4);
      p.rect(light.lit("#6a3a2a", 0.2), c.x - 1, c.y - 18, 3, 1);
      p.rect(INK, c.x + 3, c.y - 17, 1, 2);
      p.alpha(0.45, () => {
        for (let k = 0; k < 7; k++) p.rect(light.lit("#f3eee6", 0.6), c.x + Math.round(Math.sin(k * 0.9) * 1.5), c.y - 21 - k, 1, 1);
      });
    },
  };
}

/** A coat tree hung with a plaid jacket and a knit hat, boots on a bench. */
function coatRackProp(rows: number, share: number): PropSpec {
  return {
    key: "prop:coats",
    x: 0,
    y: rows - 1,
    height: 58,
    pad: 6,
    draw(p, g, light) {
      const f = faceLight(light, share);
      isoBox(p, g, light, 0.1, 0.15, 0.4, 0.7, 9, { top: LOG_L, left: LOG, right: LOG_D }, 0, share);
      for (const [v, col] of [[0.3, "#3a3436"], [0.6, "#6a4c3c"]] as const) {
        const q = project(g, 0.62, v, 0);
        p.rect(INK, q.x - 3, q.y - 8, 7, 8);
        p.rect(light.lit(col, f.left), q.x - 2, q.y - 7, 5, 7);
        p.rect(light.lit("#e8e0d0", f.top), q.x - 2, q.y - 8, 5, 1);
      }
      const t = project(g, 0.3, 0.5, 0);
      p.rect(INK, t.x - 1, t.y - 56, 3, 47);
      p.rect(light.lit(LOG_D, f.left), t.x, t.y - 56, 1, 47);
      p.rect(light.lit(LOG_D, f.left), t.x - 4, t.y - 54, 9, 1);
      // The jacket.
      const jx = t.x + 2;
      const jy = t.y - 52;
      for (let r = 0; r < 24; r++) {
        const half = r < 4 ? 3 : 5;
        for (let k = -half; k <= half; k++) p.rect(light.lit(Math.floor((k + 10) / 3) % 2 !== Math.floor(r / 3) % 2 ? PLAID : "#2f2a2c", f.left), jx + k, jy + r, 1, 1);
      }
      p.line(INK, jx - 6, jy + 4, jx - 6, jy + 24);
      p.line(INK, jx + 6, jy + 4, jx + 6, jy + 24);
      // A knit hat on the top hook.
      p.oval(INK, t.x - 2, t.y - 55, 4, 3);
      p.oval(light.lit("#3f5a45", f.top), t.x - 2, t.y - 55, 3, 2);
      p.rect(light.lit("#e8e0d0", f.top), t.x - 3, t.y - 59, 2, 2);
    },
  };
}

/** A boot tray inside the door, snow melting off the boots. */
function bootTrayProp(cols: number, rows: number, share: number): PropSpec {
  return {
    key: "prop:boots",
    x: cols - 1,
    y: rows - 1,
    height: 12,
    pad: 3,
    flat: false,
    draw(p, g, light) {
      const f = faceLight(light, share);
      isoTile(p, g, 0.15, 0.2, 0.7, 0.55, light.lit("#4a4448", 0.2));
      isoTile(p, g, 0.18, 0.23, 0.64, 0.49, light.lit("#5a5458", f.top));
      const boots: [number, number, string][] = [[0.3, 0.38, "#6a4c3c"], [0.42, 0.42, "#6a4c3c"], [0.6, 0.5, "#3f5a45"], [0.72, 0.54, "#3f5a45"]];
      for (const [u, v, col] of boots) {
        const q = project(g, u, v, 0);
        p.rect(INK, q.x - 2, q.y - 8, 4, 8);
        p.rect(light.lit(col, f.left), q.x - 1, q.y - 7, 2, 6);
        p.rect(INK, q.x - 2, q.y - 2, 6, 2);
        p.rect(light.lit("#e8e0d0", f.top), q.x - 1, q.y - 8, 2, 1);
      }
      for (let k = 0; k < 5; k++) {
        const q = project(g, 0.25 + k * 0.12, 0.7, 0);
        p.rect(light.lit("#cfe0ea", f.top), q.x, q.y - 1, 1, 1);
      }
    },
  };
}

// Things on the walls.

/** Crossed skis with their poles. */
function skis(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const pole = light.lit("#5a5458", 0.2);
      wline(p, place, 6, 2, 30, 50, pole);
      wline(p, place, 30, 2, 6, 50, pole);
      wdisc(p, place, 9, 8, 2, light.lit("#3a3436", 0.2));
      wdisc(p, place, 27, 8, 2, light.lit("#3a3436", 0.2));
      for (const [a, b, col] of [[0, 36, "#b8463a"], [36, 0, "#d9b06a"]] as const) {
        for (let t = 0; t <= 1; t += 1 / 70) {
          const al = a + (b - a) * t;
          const up = t * 58;
          const q = wpt(place, al, up);
          p.rect(INK, q.x - 1, q.y - 1, 4, 3);
        }
        for (let t = 0; t <= 1; t += 1 / 70) {
          const al = a + (b - a) * t;
          const up = t * 58;
          const q = wpt(place, al, up);
          p.rect(light.lit(col, 0.3), q.x, q.y, 2, 1);
        }
        const tip = wpt(place, b, 58);
        p.rect(light.lit(col, 0.3), tip.x - 1, tip.y - 2, 2, 2);
      }
      wdisc(p, place, 18, 29, 2.5, light.lit("#5a3d2c", 0.2));
    },
  };
}

/** A pair of snowshoes: bent-wood frames laced across. */
function snowshoes(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      for (const c of [7, 21]) {
        const frame = light.lit("#b48a5a", 0.4);
        const lace = light.lit("#8a6a4c", 0.2);
        // A teardrop: round at the top, drawn to a tail at the bottom.
        const half = (up: number) => (up > 10 ? 6 * Math.sqrt(Math.max(0, 1 - ((up - 17) / 9) ** 2)) : Math.max(0.5, (up / 10) * 5));
        for (let up = 0; up <= 26; up++) {
          const h = half(up);
          wdot(p, place, c - h - 1, up, light.lit(INK, 0), 1, 1);
          wdot(p, place, c + h + 1, up, light.lit(INK, 0), 1, 1);
          wdot(p, place, c - h, up, frame);
          wdot(p, place, c + h, up, frame);
          if (up > 3 && up < 25 && up % 3 === 0) wline(p, place, c - h + 1, up, c + h - 1, up, lace);
        }
        wline(p, place, c, 3, c, 25, lace);
        wquad(p, place, c - 3, 13, 7, 3, light.lit("#5a3d2c", 0.2));
      }
      wdot(p, place, 13, 30, light.lit(INK, 0), 1, 2);
    },
  };
}

/** A cuckoo clock: a carved little house round the dial, pine-cone weights. */
function cuckoo(wall: "left" | "right", at: number, z: number, hour: () => number): WallItem {
  const dial = clock(wall, at, z + 6, hour, "#5a3d2c");
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const wood = light.lit("#7a5136", 0.3);
      wquad(p, place, -8, 0, 17, 16, wood);
      wline(p, place, -10, 16, 1, 24, light.lit("#5a3d2c", 0.2));
      wline(p, place, 1, 24, 11, 16, light.lit("#5a3d2c", 0.2));
      wquad(p, place, -1, 17, 3, 3, light.lit("#2a2220", 0));
      dial.draw(p, light, { ...place, y: place.y - 6 });
      for (const a of [-3, 3]) {
        wline(p, place, a, 0, a, -14, light.lit("#3a3436", 0.2));
        wquad(p, place, a - 1, -20, 3, 6, light.lit("#6a4c3c", 0.3));
      }
    },
  };
}

/** Pegs by the door with a scarf and a hat. */
function pegs(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      wquad(p, place, 0, 0, 26, 3, light.lit(LOG_L, 0.3));
      for (const a of [5, 13, 21]) wdot(p, place, a, -1, light.lit(LOG_D, 0.1), 2, 2);
      for (let k = 0; k < 14; k++) {
        wdot(p, place, 4 + (k % 2), -2 - k, light.lit(k % 4 < 2 ? "#3f5a45" : "#d8c9a6", 0.3), 3, 1);
      }
      wdisc(p, place, 21, -4, 4, light.lit(PLAID, 0.3));
      wdot(p, place, 20, 1, light.lit("#e8e0d0", 0.4), 3, 2);
    },
  };
}

/** A plant on a window sill. */
function sillPlant(wall: "left" | "right", at: number, z: number): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const s = SPRITES.plant;
      p.sprite(s.grid, litPalette(s.palette, light, 0.3), place.x - 5, place.y - s.grid.length);
    },
  };
}

/** A carved board over the menu. */
function nameBoard(wall: "left" | "right", at: number, z: number, text: string): WallItem {
  return {
    wall,
    at,
    z,
    draw(p, light, place) {
      const w = text.length * 4 + 7;
      wquad(p, place, -1, -1, w + 2, 11, light.lit(LOG_D, 0.1));
      wquad(p, place, 0, 0, w, 9, light.lit(LOG_L, 0.3));
      wword(p, place, 4, 7, text, light.lit("#3a2820", 0.1));
    },
  };
}

// The lodge from the trail, front on.

/** The cabin seen from the path: a steep roof (snow on it in season), a porch, warm windows, the chimney smoking. */
function lodgeFront(p: Painter, light: Light, box: FrontBox) {
  const lit = (hex: string, f = 0.6, g = 0) => light.lit(hex, f, g);
  const { ground } = box;
  const deep = snowy(light);
  const night = light.night > 0.4;
  const x0 = box.x + 6;
  const x1 = box.x + box.w - 6;
  const mid = Math.round((x0 + x1) / 2);
  const eave = box.y + 34;
  const apex = box.y - 8;
  p.alpha(0.3, () => p.rect(INK, x0 - 6, ground - 2, x1 - x0 + 12, 4));
  // The chimney behind the roof's right slope.
  const cx = x1 - 30;
  p.rect(INK, cx - 1, box.y - 6, 18, eave - box.y + 6);
  for (let y = box.y - 5; y < eave; y++)
    for (let x = cx; x < cx + 16; x++) {
      const row = Math.floor((y - box.y) / 4);
      const joint = (y - box.y) % 4 === 0 || (x - cx + (row & 1) * 3) % 7 === 0;
      p.rect(lit(joint ? MORTAR : noise(Math.floor((x - cx + (row & 1) * 3) / 7), row, 5) > 0.5 ? STONE : STONE_ALT, 0.6), x, y, 1, 1);
    }
  p.rect(lit("#7d766e", 0.7), cx - 2, box.y - 8, 20, 3);
  // Smoke curling off it.
  p.alpha(0.4, () => {
    for (let k = 0; k < 7; k++) p.oval(lit("#d9dcdf", 0.6), cx + 8 + Math.round(Math.sin(k * 0.9) * 4) - k * 2, box.y - 13 - k * 6, 3 + k * 0.6, 2 + k * 0.4);
  });
  // Log walls under the eaves, the log ends out past each corner.
  p.rect(INK, x0 - 1, eave, x1 - x0 + 2, ground - eave);
  for (let y = eave; y < ground; y++) {
    const k = (y - eave) % 7;
    p.rect(lit(k === 0 ? CHINK : k === 1 ? LOG_D : k > 4 ? LOG_L : LOG, 0.6), x0, y, x1 - x0, 1);
  }
  for (const ex of [x0 - 4, x1 - 1]) for (let y = eave + 3; y < ground - 2; y += 7) {
    p.oval(INK, ex + 2, y, 3, 3);
    p.oval(lit("#c49a6a", 0.7), ex + 2, y, 2, 2);
  }
  // The roof, steep, shingled, snow along it in season.
  p.poly(INK, [x0 - 14, eave + 2, mid, apex - 2, x1 + 14, eave + 2]);
  p.poly(lit("#5a3d2c", 0.5), [x0 - 12, eave, mid, apex, x1 + 12, eave]);
  for (let y = apex + 4; y < eave; y += 4) {
    const half = ((y - apex) / (eave - apex)) * ((x1 - x0) / 2 + 12);
    p.line(lit("#4a3428", 0.3), mid - half, y, mid + half, y);
  }
  if (deep) {
    p.poly(lit("#eef2f4", 0.8), [x0 - 12, eave - 1, mid, apex, x1 + 12, eave - 1, x1 + 6, eave - 5, mid, apex + 6, x0 - 6, eave - 5]);
    for (let x = x0 - 10; x < x1 + 10; x += 3) p.rect(lit("#eef2f4", 0.8), x, eave - 1, 2, 2 + (x % 7 === 0 ? 2 : 0));
  }
  // A round window in the gable.
  p.oval(INK, mid, apex + 22, 7, 7);
  p.oval(lit(LOG_D, 0.4), mid, apex + 22, 6, 6);
  p.oval(night ? "#f2c07a" : lit(mixHex(light.sky[1], "#3b3440", 0.3), 0.5), mid, apex + 22, 4, 4);
  // The porch roof and its posts, the name on the fascia.
  const py = eave + 14;
  p.rect(INK, x0 + 8, py - 1, x1 - x0 - 16, 9);
  p.rect(lit("#6e4c35", 0.6), x0 + 9, py, x1 - x0 - 18, 7);
  if (deep) p.rect(lit("#eef2f4", 0.8), x0 + 8, py - 3, x1 - x0 - 16, 3);
  const name = box.name.toUpperCase();
  const tw = bigWidth(name);
  p.rect(INK, mid - tw / 2 - 5, py - 12, tw + 10, 12);
  p.rect(lit(LOG_L, 0.7), mid - tw / 2 - 4, py - 11, tw + 8, 10);
  bigWord(p, name, lit("#3a2820", 0.3), Math.round(mid - tw / 2), py - 10);
  for (const x of [x0 + 12, x1 - 15]) {
    p.rect(INK, x - 1, py + 7, 5, ground - 8 - py);
    p.rect(lit(LOG_L, 0.6), x, py + 7, 3, ground - 8 - py);
  }
  // Windows either side of the door, warm when lit.
  const glass = (gx: number, gy: number, gw: number, gh: number) => {
    p.rect(INK, gx - 2, gy - 2, gw + 4, gh + 4);
    p.rect(lit(LOG_D, 0.5), gx - 1, gy - 1, gw + 2, gh + 2);
    p.rect(night || !box.open ? (night ? "#f2c07a" : lit("#6f7880", 0.3)) : lit(mixHex(light.sky[1], "#e9c98c", 0.35), 0.6), gx, gy, gw, gh);
    p.rect(lit(LOG_D, 0.5), gx + Math.floor(gw / 2), gy, 1, gh);
    p.rect(lit(LOG_D, 0.5), gx, gy + Math.floor(gh / 2), gw, 1);
    p.rect(INK, gx - 3, gy + gh + 1, gw + 6, 3);
    p.rect(lit(deep ? "#eef2f4" : LOG_L, 0.8), gx - 3, gy + gh + 1, gw + 6, 2);
  };
  const wy = py + 18;
  glass(x0 + 22, wy, 24, 20);
  glass(x1 - 46, wy, 24, 20);
  if (box.display && box.open) displayCup(p, light, box.display, x0 + 34, wy + 20);
  // The door, a wreath in winter, a lantern beside it.
  const dw = 20;
  const dx = mid - dw / 2;
  const dy = wy - 4;
  p.rect(INK, dx - 1, dy - 1, dw + 2, ground - 6 - dy + 1);
  for (let x = dx; x < dx + dw; x++) p.rect(lit((x - dx) % 5 === 0 ? LOG_D : "#8a5f40", 0.6), x, dy, 1, ground - 6 - dy);
  p.rect(lit("#d6a367", 0.7), dx + dw - 5, dy + 20, 2, 2);
  if (light.season === "winter") {
    p.oval(lit("#3f5a45", 0.5), mid, dy + 9, 5, 5);
    p.oval(lit("#8a5f40", 0.4), mid, dy + 9, 2, 2);
    p.rect(lit("#b8463a", 0.5), mid - 1, dy + 13, 3, 2);
  } else {
    const tag = box.open ? "OPEN" : "SHUT";
    p.rect(INK, mid - 9, dy + 6, 18, 8);
    p.rect(box.open ? lit("#7f9a72", 0.6, 0.6) : lit("#c4574a", 0.6), mid - 8, dy + 7, 16, 6);
    word(p, tag, lit("#fff1dd", 0.6), mid - 7, dy + 8);
  }
  const lx = dx + dw + 5;
  p.rect(INK, lx - 1, dy + 2, 7, 9);
  p.rect(light.night > 0.15 ? "#ffd27a" : lit("#e6d2a6", 0.4), lx, dy + 3, 5, 7);
  if (light.night > 0.15) p.alpha(0.3 * light.night, () => p.oval("#ffc070", lx + 2, dy + 6, 12, 10));
  // The porch boards and a step down.
  p.rect(INK, x0 + 6, ground - 7, x1 - x0 - 12, 7);
  p.rect(lit("#9a7048", 0.7), x0 + 7, ground - 6, x1 - x0 - 14, 3);
  p.rect(lit("#6e4c35", 0.4), x0 + 7, ground - 3, x1 - x0 - 14, 3);
  if (deep) p.rect(lit("#eef2f4", 0.8), x0 + 7, ground - 7, 10, 1);
  // Skis by the post, a woodpile at the side.
  for (const [sx, c] of [[x0 + 2, "#b8463a"], [x0 + 6, "#d9b06a"]] as const) {
    p.rect(INK, sx - 1, ground - 52, 4, 50);
    p.rect(lit(c, 0.6), sx, ground - 51, 2, 48);
    p.rect(lit(c, 0.6), sx - 1, ground - 54, 2, 3);
  }
  const wx = x1 + 4;
  p.rect(INK, wx - 1, ground - 19, 26, 18);
  for (let r = 0; r < 4; r++)
    for (let k = 0; k < 6; k++) {
      p.rect(INK, wx + 1 + k * 4 + (r & 1) * 2, ground - 6 - r * 4, 4, 4);
      p.rect(lit(noise(k, r, 3) > 0.5 ? "#d9b88a" : "#c49a6a", 0.6), wx + 2 + k * 4 + (r & 1) * 2, ground - 5 - r * 4, 2, 2);
    }
  if (deep) p.rect(lit("#eef2f4", 0.8), wx - 1, ground - 20, 26, 2);
}

/** Protruding log ends where the two back walls stop. */
function logEnds(cols: number, rows: number, wallH: number) {
  return (p: Painter, g: IsoGrid, light: Light) => {
    for (const [x, y] of [[cols + 0.08, 0.1], [0.1, rows + 0.08]] as const) {
      for (let z = 4; z < wallH; z += 8) {
        const q = project(g, x, y, z);
        p.oval(INK, q.x, q.y, 4, 4);
        p.oval(light.lit("#c49a6a", 0.4), q.x, q.y, 3, 3);
        p.oval(light.lit("#a87b55", 0.3), q.x, q.y, 1.5, 1.5);
        p.rect(light.lit("#8b5e3f", 0.2), q.x, q.y, 1, 1);
      }
    }
  };
}

export function lodgeVenue(o: VenueOptions): Venue {
  const { cols, rows } = o;
  // The armchair by the stump, and log stools round a table.
  const sit = seating(
    {
      props: [],
      seats: [{ id: "lodge-armchair", x: 2.8, y: 6.75, face: [0, 1] as [number, number], height: 7, dog: [2.15, 7.1] as [number, number], pieces: ["prop:armchair"] }],
    },
    cafeTable("lodge-table", 2.6, 4.3, ["-x", "-y", "+x"], { wood: LOG_D, seat: LOG_L, top: LOG_L, chair: "stump" }),
  );
  const share = 0.35;
  const wallH = 80;
  return {
    id: "lodge",
    cols,
    rows,
    floor: lodgeFloor(cols, rows),
    wall: logWall,
    cap: LOG_L,
    slab: "#7d7570",
    slabHeight: 8,
    wallHeight: wallH,
    windows: [
      { wall: "right", at: 3.2, width: 1.7, sill: 26, top: 60, bars: 1, transom: 12, frame: LOG_D },
      { wall: "left", at: 4.4, width: 2.0, sill: 26, top: 60, bars: 1, transom: 12, frame: LOG_D },
    ],
    doors: [],
    lamps: [
      { kind: "fire", x: cols - 1, y: 0.3, z: 14, reach: 3.2 },
      { kind: "sconce", x: cols - 2.5, y: 0.05, z: 50, color: "#5a4a3a", reach: 1.6 },
      { kind: "sconce", x: 0.05, y: 3.85, z: 50, color: "#5a4a3a", reach: 1.6 },
      { kind: "lantern", x: 3.6, y: 3.2, z: 62, color: "#8a6a3a", reach: 2.6 },
      { kind: "lantern", x: 6.4, y: 5.6, z: 62, color: "#8a6a3a", reach: 2.6 },
    ],
    wallItems: [
      skis("right", 0.35, 12),
      rail("right", 2.0, 34, 22, LOG_D, ["#c9573f", "#e6d8c0", "#5f7a5a", "#e6d8c0"]),
      cuckoo("right", cols - 3.5, 56, o.hour),
      snowshoes("left", 0.25, 30),
      menuBoard("left", 1.5, 30, { w: 46, h: 22, title: "COCOA", board: "#2f3b37", frame: LOG_D }),
      nameBoard("left", 1.7, 58, "LODGE"),
      sillPlant("left", 5.9, 27),
      pegs("left", rows - 1.4, 50),
    ],
    props: [
      ...sit.props,
      fireplaceProp(cols, share),
      urnProp(3.0, 0.05, share),
      logBasketProp(cols - 3, 0.05, share),
      armchairProp(2.3, 6.2, share),
      stumpProp(3.4, 6.5, share),
      coatRackProp(rows, share),
      bootTrayProp(cols, rows, share),
      ...frontWalls(cols, rows, {
        key: "front:lodge",
        height: 16,
        top: LOG_L,
        face: LOG,
        gapsRight: [5, 6],
        draw(p, g, light, face, box) {
          const f = faceLight(light, 0.6);
          const l = face === "left" ? f.left : f.right;
          for (const z of [1, 6, 11]) {
            fline(p, g, face, box, 0, z, 1, z, light.lit(LOG_D, l * 0.5));
            fline(p, g, face, box, 0, z + 4, 1, z + 4, light.lit(LOG_L, l));
          }
        },
      }),
    ],
    counter: { top: "#b48659", front: "#8b5e3f", side: "#6e4a33", trim: "#a87b55", panel: "log", height: 16 },
    outside: {
      ground: lodgeGround(cols, rows),
      far: farPeaks,
      view: lodgeView,
      props: [
        pineProp("out:pine1", -4.0, 1.2, 66, 1),
        pineProp("out:pine2", -3.4, 5.0, 58, 2),
        pineProp("out:pine3", 3.2, -4.6, 70, 3),
        pineProp("out:pine4", 6.4, -4.6, 60, 4),
        pineProp("out:pine5", 2.5, 10.6, 62, 5),
        pineProp("out:pine6", 12.8, 4.2, 56, 6),
        woodpileProp("out:woodpile", 0.5, rows + 0.3, 2.2),
        sledProp("out:sled", cols + 2.0, 4.0),
        snowmanProp("out:snowman", 4.6, rows + 1.4),
        signpostProp("out:sign", cols + 2.0, 1.0),
        lanternPostProp("out:lamp", cols + 0.9, 4.4),
      ],
    },
    // Up the trodden path and in at the door over the mat; the line runs down from the serve counter to it.
    seats: sit.seats,
    doorway: { wall: "front-right", from: 5, to: 7 },
    entry: [cols + 3.6, 6.95],
    queue: [
      [7.5, 3.4],
      [7.55, 4.15],
      [7.6, 4.9],
      [7.65, 5.65],
      [cols - 0.65, 6.0],
      [cols + 0.75, 6.35],
    ],
    pickup: [6.75, 3.5],
    out: [
      [6.8, 5.2],
      [cols - 0.7, 6.4],
      [cols + 0.8, 6.5],
    ],
    indoorSun: share,
    backHook: logEnds(cols, rows, wallH),
    facade: {
      wall: logWall,
      trim: LOG_D,
      sign: { board: LOG_L, ink: "#3a2820" },
      door: "#8a5f40",
      paint: lodgeFront,
      neighbours: "none",
      queueAt: 0.5,
    },
  };
}
