/**
 * The Garden Tea Room's beds: four raised beds on a gravel walk, a lawn, a
 * picket fence with a glasshouse and a big tree behind it, hills under the
 * day's sky. The season colours the grass and the tree; the hour moves the
 * shadows; after dark the glasshouse glows and lights string the fence.
 * The backdrop is baked once per light and plot state; the plants (which
 * sway), butterflies or fireflies and the weather are painted every frame.
 */
import {
  Painter, PLACE_W, PLACE_H, INK, CREAM, mixHex, noise, tone, box, cast, contact, sky, hills, clipped, pool, precipitation,
  foliage, SEASON_GREENS, ink, type Light, type Tone,
} from "./kit.ts";

export interface GardenPlot {
  /** What is planted's colour, or null for a bare bed. */
  color: string | null;
  growth: number;
  watered: boolean;
  /** "tea" grows as a leafy bush, anything else as a fruiting plant. */
  group?: string;
}

const W = PLACE_W;
const H = PLACE_H;
const SOIL_Y = 196;
const SOIL_D = 12;
const BOARD_H = 20;

/** Each bed's front board, where the view sets its key. */
export const GARDEN_BEDS = [0, 1, 2, 3].map((i) => ({ x: 22 + i * 100, y: SOIL_Y, w: 88, h: BOARD_H }));

/** Where the seed packets sit (the seed picker goes by them). */
export const GARDEN_SEEDS = { x: 396, y: 246 };

export function drawGardenBackdrop(p: Painter, light: Light, plots: readonly GardenPlot[]) {
  const t = tone(light, 1);
  const g = SEASON_GREENS[light.season] ?? SEASON_GREENS.spring;
  const winter = light.season === "winter";

  sky(p, light, 0, 0, W, 128, 2);
  hills(p, light.lit(mixHex(g.far, light.sky[2], 0.35), 0.4), 0, W, 128, 26, 1.3);
  hills(p, light.lit(g.far, t.f.top), 0, W, 136, 18, 4.1);
  // A hedge behind the fence.
  for (let x = 0; x < W; x += 1) {
    const top = 120 + Math.round(4 * Math.sin(x / 9) + 3 * noise(Math.floor(x / 5), 0, 8));
    p.rect(t.front(mixHex(g.leaf, INK, 0.25)), x, top, 1, 150 - top);
    if (noise(x, 1, 8) > 0.55) p.rect(t.top(g.leaf), x, top, 1, 2);
  }
  // The lawn.
  p.rect(t.top(g.grass), 0, 148, W, H - 148);
  for (let i = 0; i < 900; i++) {
    const x = Math.floor(noise(i, 0, 9) * W);
    const y = 148 + Math.floor(noise(i, 1, 9) * (H - 148));
    p.rect(t.top(i % 3 ? g.grassAlt : mixHex(g.grass, INK, 0.15)), x, y, 1, i % 4 ? 1 : 2);
  }
  if (light.season === "autumn")
    for (let i = 0; i < 70; i++) p.rect(t.top(i % 2 ? "#c97a3f" : "#d9a04a"), Math.floor(noise(i, 0, 12) * W), 150 + Math.floor(noise(i, 1, 12) * 120), 2, 1);

  tree(p, t, light, 46, 150);
  glasshouse(p, t, light);
  fence(p, t, light);

  // The gravel walk the beds stand on.
  p.rect(t.top(winter ? "#d8d6cf" : "#c9b99a"), 0, 186, W, 60);
  p.rect(t.shade(mixHex(g.grass, INK, 0.2)), 0, 186, W, 1);
  for (let i = 0; i < 700; i++) {
    const x = Math.floor(noise(i, 0, 40) * W);
    const y = 187 + Math.floor(noise(i, 1, 40) * 58);
    p.rect(t.top(i % 3 ? (winter ? "#c4c2bb" : "#b3a385") : "#e3d6bc"), x, y, 1, 1);
  }
  p.rect(t.top(mixHex(g.grass, INK, 0.1)), 0, 246, W, 1);

  for (const [i, bed] of GARDEN_BEDS.entries()) drawBed(p, t, light, bed.x, plots[i]);

  // A watering can and the seed packets in a crate.
  can(p, t, 8, 262);
  seeds(p, t, 378, 258);

  if (light.night > 0.2) {
    // The glasshouse's lamps and the fence's string lights spill onto the grass.
    pool(p, 356, 152, 90, 46, 0.4 * light.night);
    for (let x = 14; x < 290; x += 34) pool(p, x, 146, 16, 10, 0.4 * light.night);
  }
}

function tree(p: Painter, t: Tone, light: Light, x: number, base: number) {
  const g = SEASON_GREENS[light.season] ?? SEASON_GREENS.spring;
  cast(p, light, x - 10, base + 2, 22, 70, 7, 0.3);
  const bark = "#6a4c3c";
  p.rect(ink(t), x - 4, base - 58, 9, 58);
  p.rect(t.front(bark), x - 3, base - 58, 7, 58);
  p.rect(t.left(mixHex(bark, CREAM, 0.15)), x - 3, base - 58, 2, 58);
  p.rect(t.away(mixHex(bark, INK, 0.25)), x + 2, base - 58, 2, 58);
  // Branches.
  for (const [dx, dy] of [[-20, -70], [22, -74], [2, -90]]) {
    p.line(ink(t), x - 1, base - 50, x + dx - 1, base + dy);
    p.line(t.front(bark), x, base - 50, x + dx, base + dy);
    p.line(t.front(bark), x + 1, base - 50, x + dx + 1, base + dy);
  }
  if (light.season === "winter") {
    p.line(t.front(bark), x - 20, base - 74, x - 30, base - 80);
    p.line(t.front(bark), x + 22, base - 80, x + 32, base - 84);
    p.line(t.front(bark), x - 10, base - 62, x - 16, base - 90);
    p.rect(t.top("#f4f4ee"), x - 26, base - 79, 6, 1);
    p.rect(t.top("#f4f4ee"), x + 22, base - 81, 7, 1);
    return;
  }
  // The crown: clumps inked as one mass, then each lit toward the sun.
  const blobs: [number, number, number][] = [[0, -82, 26], [-24, -72, 17], [24, -72, 18], [-10, -102, 18], [12, -100, 17], [-32, -88, 12], [34, -88, 12]];
  for (const [dx, dy, r] of blobs) p.oval(ink(t), x + dx, base + dy, r + 1, r * 0.8 + 1);
  for (const [dx, dy, r] of blobs) foliage(p, t, x + dx, base + dy, r, r * 0.8, g.leaf, g.leafLit, false);
  if (g.blossom)
    for (let i = 0; i < 46; i++) {
      const a = noise(i, 0, 14) * Math.PI * 2;
      const rr = noise(i, 1, 14) * 30;
      p.rect(t.top(i % 3 ? g.blossom : "#fff0f0"), x + Math.round(Math.cos(a) * rr * 1.3), base - 86 + Math.round(Math.sin(a) * rr * 0.8), 2, 1);
    }
}

function glasshouse(p: Painter, t: Tone, light: Light) {
  const x = 292;
  const w = 128;
  const base = 152;
  const eave = 92;
  const ridge = 66;
  const frame = "#e7e0cf";
  const glow = light.night > 0.2;
  cast(p, light, x, base + 2, w, 70, 6, 0.25);
  // The gable end and the glass, the sky caught in it.
  const pane = (px: number, py: number, pw: number, ph: number) => {
    const reflect = light.lit(mixHex(light.sky[0], "#7fa39a", 0.55), 0.45);
    p.rect(glow ? mixHex("#ffdc9a", "#e8b870", noise(px, py, 2)) : reflect, px, py, pw, ph);
    if (!glow) p.rect(light.lit(mixHex(light.sky[0], "#ffffff", 0.3), 0.8), px + 1, py + 1, 2, 1);
    // Pots on the staging inside, against the lowest panes.
    if (py + ph >= base - 4) {
      const leaves = glow ? "#7a8650" : t.shade("#6f9260");
      for (let i = 0; i < 2; i++) {
        const lx = px + 3 + i * 6;
        p.oval(leaves, lx, py + 4, 3, 3);
        p.rect(glow ? "#a4633f" : t.shade("#b86a4e"), lx - 2, py + 7, 4, 3);
      }
    }
  };
  p.rect(ink(t), x - 2, eave - 2, w + 4, base - eave + 3);
  p.poly(ink(t), [x - 4, eave, x + w / 2, ridge - 3, x + w + 4, eave]);
  p.poly(t.front(frame), [x - 2, eave, x + w / 2, ridge - 1, x + w + 2, eave]);
  p.rect(t.front(frame), x - 1, eave - 1, w + 2, base - eave + 1);
  for (let px = x + 2; px < x + w - 2; px += 14)
    for (let py = eave + 2; py < base - 2; py += 18) pane(px, py, 12, Math.min(16, base - 2 - py));
  // The roof's glazing above the eave.
  clipped(p, x, ridge, w, eave - ridge, () => {
    for (let px = x + 3; px < x + w - 2; px += 14) {
      const rise = Math.abs(px + 6 - (x + w / 2));
      const top = ridge + 2 + Math.round(rise * ((eave - ridge) / (w / 2)));
      if (eave - 2 - top > 1) pane(px, top, 12, eave - 2 - top);
    }
  });
  // A door with a step.
  p.rect(ink(t), x + w / 2 - 9, base - 34, 18, 34);
  p.rect(t.front(frame), x + w / 2 - 8, base - 33, 16, 33);
  p.rect(glow ? "#ffd98f" : light.lit("#b9cfc4", 0.5), x + w / 2 - 6, base - 31, 12, 18);
  p.rect(t.shade("#bdb4a0"), x + w / 2 - 12, base, 24, 3);
}

function fence(p: Painter, t: Tone, light: Light) {
  const paint = light.season === "winter" ? "#efeee8" : "#efe3c8";
  const shade = mixHex(paint, INK, 0.2);
  cast(p, light, 0, 156, 290, 22, 5, 0.22);
  p.rect(t.front(shade), 0, 136, 290, 3);
  p.rect(t.front(shade), 0, 146, 290, 3);
  for (let x = 2; x < 286; x += 8) {
    p.rect(ink(t), x - 1, 128, 7, 26);
    p.rect(t.front(paint), x, 130, 5, 23);
    p.rect(t.front(paint), x + 1, 129, 3, 1);
    p.rect(t.away(shade), light.azimuth > 0 ? x + 4 : x, 131, 1, 22);
  }
  if (light.night > 0.2) {
    // A string of lights swagged along the top.
    for (let x = 0; x < 290; x++) {
      const y = 126 + Math.round(Math.sin(((x % 34) / 34) * Math.PI) * 5);
      p.rect(t.shade("#4a3a36"), x, y, 1, 1);
      if (x % 9 === 4) {
        p.rect("#ffe6a8", x - 1, y + 1, 3, 2);
        p.rect("#fff6d8", x, y + 1, 1, 1);
      }
    }
  }
}

function drawBed(p: Painter, t: Tone, light: Light, x: number, plot: GardenPlot | undefined) {
  const w = 88;
  const wood = "#9a6c4c";
  cast(p, light, x, SOIL_Y + BOARD_H + 2, w, 18, 6, 0.3);
  // Soil, tilled in rows; dark and glinting when watered.
  const soil = plot?.watered ? "#4b3530" : "#6e4e3e";
  box(p, t, x, SOIL_Y, w, BOARD_H, SOIL_D, { top: "#b88a62", front: wood });
  p.rect(t.top(soil), x + 3, SOIL_Y - SOIL_D + 3, w - 6, SOIL_D - 4);
  for (let r = 0; r < 3; r++) p.rect(t.top(mixHex(soil, CREAM, 0.12)), x + 5, SOIL_Y - SOIL_D + 4 + r * 3, w - 10, 1);
  if (plot?.watered)
    for (let i = 0; i < 7; i++) p.rect(light.lit("#a9c0cc", 0.8), x + 8 + i * 11, SOIL_Y - 4 - (i % 2) * 3, 2, 1);
  if (light.season === "winter") {
    p.rect(t.top("#f4f4ee"), x, SOIL_Y - SOIL_D, w, 2);
    p.rect(t.top("#f4f4ee"), x, SOIL_Y, w, 1);
  }
  // Boards and their posts.
  p.rect(t.front(mixHex(wood, INK, 0.25)), x, SOIL_Y + 9, w, 1);
  for (const px of [x, x + w - 4]) {
    p.rect(t.front(mixHex(wood, INK, 0.15)), px, SOIL_Y, 4, BOARD_H);
    p.rect(t.top("#c69a70"), px, SOIL_Y - SOIL_D - 2, 4, 2);
  }
  // A stake with a seed packet on it when something is planted.
  if (plot?.color) {
    const sx = x + w - 12;
    p.rect(ink(t), sx, SOIL_Y - SOIL_D - 14, 2, 14);
    p.rect(ink(t), sx - 4, SOIL_Y - SOIL_D - 22, 10, 10);
    p.rect(t.front("#f2e6cc"), sx - 3, SOIL_Y - SOIL_D - 21, 8, 8);
    p.oval(t.front(plot.color), sx + 1, SOIL_Y - SOIL_D - 17, 2, 2);
  }
}

function can(p: Painter, t: Tone, x: number, base: number) {
  const metal = "#7c9089";
  contact(p, x - 2, base + 1, 26, 0.35);
  p.rect(ink(t), x - 1, base - 15, 20, 16);
  p.rect(t.front(metal), x, base - 14, 18, 14);
  p.rect(t.top(mixHex(metal, CREAM, 0.35)), x, base - 14, 18, 2);
  p.rect(t.away(mixHex(metal, INK, 0.2)), x + 14, base - 12, 4, 12);
  p.line(ink(t), x + 18, base - 10, x + 27, base - 18);
  p.line(t.front(metal), x + 18, base - 11, x + 26, base - 18);
  p.rect(ink(t), x + 25, base - 21, 5, 4);
  p.rect(ink(t), x + 4, base - 20, 10, 2);
  p.rect(ink(t), x + 3, base - 19, 2, 5);
  p.rect(ink(t), x + 13, base - 19, 2, 5);
}

function seeds(p: Painter, t: Tone, x: number, base: number) {
  contact(p, x - 2, base + 1, 48, 0.35);
  box(p, t, x, base - 14, 44, 14, 6, { top: "#d4ad7c", front: "#b88a62" });
  const colors = ["#e0525a", "#f1c34a", "#9cb46a", "#a88ac4", "#e8935a"];
  for (let i = 0; i < 5; i++) {
    const px = x + 2 + i * 8;
    p.rect(ink(t), px, base - 26, 8, 12);
    p.rect(t.front("#f2e6cc"), px + 1, base - 25, 6, 10);
    p.rect(t.front(colors[i]), px + 2, base - 22, 4, 4);
  }
}

/** The moving part: the plants in the wind, wings by day, fireflies at night, the weather. */
export function drawGardenLife(p: Painter, light: Light, plots: readonly GardenPlot[], time: number) {
  const t = tone(light, 1);
  for (const [i, bed] of GARDEN_BEDS.entries()) {
    const plot = plots[i];
    if (plot?.color) plants(p, t, bed.x, plot, time + i * 0.7);
  }
  const g = SEASON_GREENS[light.season] ?? SEASON_GREENS.spring;
  void g;
  const fair = light.weather !== "rain" && light.weather !== "snow" && light.season !== "winter";
  if (fair && light.night < 0.4) {
    for (let k = 0; k < 2; k++) {
      const bx = 120 + k * 150 + Math.sin(time * 0.6 + k * 2) * 60;
      const by = 150 + Math.sin(time * 1.1 + k) * 18 + Math.sin(time * 3.3 + k) * 3;
      const flap = Math.floor(time * 8 + k) % 2;
      const color = k ? "#f1c34a" : "#f0f0e6";
      p.rect(INK, bx, by, 1, 2);
      p.rect(t.top(color), bx - 2, by - (flap ? 1 : 0), 2, flap ? 2 : 1);
      p.rect(t.top(color), bx + 1, by - (flap ? 1 : 0), 2, flap ? 2 : 1);
    }
  } else if (fair && light.night > 0.5) {
    for (let k = 0; k < 9; k++) {
      const on = Math.sin(time * 2.1 + k * 1.7) > 0.2;
      if (!on) continue;
      const fx = Math.round((noise(k, 0, 33) * W + Math.sin(time * 0.4 + k) * 12 + W) % W);
      const fy = Math.round(150 + noise(k, 1, 33) * 60 + Math.sin(time * 0.7 + k * 2) * 6);
      p.rect("#f6f0a0", fx, fy, 1, 1);
      p.alpha(0.35, () => p.rect("#f6f0a0", fx - 1, fy - 1, 3, 3));
    }
  }
  precipitation(p, light, time, 0, 0, W, H);
}

function plants(p: Painter, t: Tone, x: number, plot: GardenPlot, time: number) {
  const stage = Math.max(0, Math.min(3, Math.floor(plot.growth)));
  const tea = plot.group === "tea";
  const leaf = tea ? "#5c8450" : "#6a9160";
  const leafLit = tea ? "#94b676" : "#a9c48a";
  const stem = "#4f6a4c";
  const ground = SOIL_Y - 5;
  for (let k = 0; k < 4; k++) {
    const px = x + 13 + k * 19;
    const sway = Math.round(Math.sin(time * 1.4 + k * 0.9) * (stage * 0.45));
    if (stage === 0) {
      // Two seed leaves on a thread of stem.
      p.rect(t.front(stem), px, ground - 3, 1, 3);
      p.rect(t.top(leafLit), px - 2, ground - 4, 2, 1);
      p.rect(t.top(leaf), px + 1, ground - 5, 2, 1);
      continue;
    }
    if (stage === 1) {
      // A low rosette.
      for (const [dx, dy, r] of [[-3, -2, 3], [3, -2, 3], [0, -5, 3]] as const) foliage(p, t, px + dx + (dy < -3 ? sway : 0), ground + dy, r, r * 0.6, leaf, leafLit);
      continue;
    }
    const h = stage === 2 ? 13 : 20;
    // Stems fanning up from the soil, clumps of leaf along them.
    p.line(ink(t), px, ground, px + sway - 1, ground - h);
    p.line(t.front(stem), px + 1, ground, px + sway, ground - h);
    const clumps: [number, number, number][] =
      stage === 2 ? [[-5, -4, 4], [5, -5, 4], [0, -h + 2, 5], [-3, -9, 3]] : [[-7, -5, 5], [7, -6, 5], [-4, -12, 5], [5, -14, 5], [0, -h + 1, 6]];
    for (const [dx, dy, r] of clumps) {
      const lift = (dy / -h) * sway;
      foliage(p, t, px + dx + Math.round(lift), ground + dy, r, r * 0.65, leaf, leafLit);
    }
    if (stage === 2 && !tea)
      for (const [dx, dy] of [[-4, -8], [4, -10], [1, -h - 2]]) {
        p.rect(t.top("#fff6e6"), px + dx + sway, ground + dy, 2, 1);
        p.rect(t.top("#f1c34a"), px + dx + sway, ground + dy + 1, 1, 1);
      }
    if (stage === 3 && plot.color) {
      if (tea) {
        for (const [dx, dy] of [[-6, -8], [4, -11], [0, -h - 3], [7, -4], [-3, -15]]) p.rect(t.top(plot.color), px + dx + sway, ground + dy, 2, 1);
      } else {
        // Ripe fruit hanging under the leaves.
        for (const [dx, dy] of [[-8, -1], [7, -3], [-3, -8], [8, -11], [-6, -14]]) {
          const fx = px + dx + Math.round((dy / -h) * sway);
          const fy = ground + dy;
          p.oval(ink(t), fx, fy, 2, 2);
          p.rect(t.front(plot.color), fx - 1, fy - 1, 3, 3);
          p.rect(t.at(mixHex(plot.color, INK, 0.25), 0), fx, fy + 1, 2, 1);
          p.rect(t.top(mixHex(plot.color, CREAM, 0.55)), fx - 1, fy - 1, 1, 1);
          p.rect(t.top(leafLit), fx, fy - 3, 1, 1);
        }
      }
    }
  }
}
