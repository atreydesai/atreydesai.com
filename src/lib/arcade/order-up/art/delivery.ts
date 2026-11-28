/**
 * The delivery run: a street seen from above at a slant, scrolling under a
 * courier on a cargo bike with four sealed cups in the front box. The
 * engine's balance leans the rider and the box (a sheared sprite stack),
 * steering turns the bike a little, and tea slops over the side once the
 * lean is past what the cups can take. A route strip at the top reads the
 * distance and a spirit level at the foot reads the balance.
 *
 * The street repeats every few blocks, so it is baked once per light into a
 * tall strip (roofs, pavements, parked cars, trees, the shadows the hour
 * throws and the lamps' pools after dark) and each frame copies the strip
 * in at the scroll offset, then paints the bike, the weather and the gauges.
 */
import { Painter, noise } from "./paint.ts";
import { PixelBuffer } from "../../core/pixel-buffer.ts";
import { mixHex } from "../../core/color.ts";
import type { Light } from "../../core/light.ts";
import { car, cargoBike, lamp, planter, stacked, tree } from "./models.ts";
import { PLACE_W, PLACE_H, INK, CREAM, tone, pool, chip, precipitation, ink } from "./places/kit.ts";

export const DELIVERY_WIDTH = PLACE_W;
export const DELIVERY_HEIGHT = PLACE_H;

export interface DeliveryState {
  /** Seconds ridden. */
  time: number;
  progress: number;
  balance: number;
  steering: number;
  tolerance: number;
  riding: boolean;
  weather: string;
  cups: readonly string[];
}

const W = DELIVERY_WIDTH;
const H = DELIVERY_HEIGHT;
const ROAD_L = 150;
const ROAD_R = 282;
const WALK = 26;
const BLOCK = 96;
const BLOCKS = 6;
const PERIOD = BLOCK * BLOCKS;
const SPEED = 70;
const CAR_COLORS = [
  ["#b65a4f", "#8c4740"],
  ["#6d8a8a", "#55706f"],
  ["#d0b073", "#a88a55"],
  ["#7d6a8c", "#625370"],
  ["#e2d6bd", "#b9ab92"],
] as const;
const AWNINGS = ["#c4574a", "#7f9a72", "#d9a95f", "#6d8a8a"];
const ROOFS = ["#a7735f", "#8c8f7a", "#b49a74", "#7f6e7a", "#9a8466", "#b88a70"];

let cached: { key: string; strip: PixelBuffer } | null = null;

/** The repeating street for a light, baked once. */
function streetStrip(light: Light) {
  if (cached?.key === light.key) return cached.strip;
  const strip = new PixelBuffer(W, PERIOD);
  paintStreet(new Painter(strip, W, PERIOD), light);
  cached = { key: light.key, strip };
  return strip;
}

function paintStreet(p: Painter, light: Light) {
  const t = tone(light, 1);
  const snow = light.weather === "snow" || light.season === "winter";
  const road = t.top(light.weather === "rain" ? "#4f4d5a" : "#605b69");
  const roadDark = t.top("#565160");
  const roadLight = t.top("#6d6876");
  const walk = t.top(snow ? "#e6e3da" : "#bcae97");
  const seam = t.top(snow ? "#d2cec4" : "#a69882");
  const curb = t.top("#d6c9b0");
  // Service lanes between the buildings, then the asphalt with its grain,
  // the centre line and the parking lanes' ticks.
  p.rect(t.top(snow ? "#d8d5cc" : "#8a8078"), 0, 0, W, PERIOD);
  for (let i = 0; i < 400; i++) p.rect(t.top("#7a716a"), Math.floor(noise(i, 0, 17) * W), Math.floor(noise(i, 1, 17) * PERIOD), 2, 1);
  p.rect(road, ROAD_L, 0, ROAD_R - ROAD_L, PERIOD);
  for (let y = 0; y < PERIOD; y += 2)
    for (let x = ROAD_L; x < ROAD_R; x += 2) {
      const n = noise(x, y, 3);
      if (n < 0.06) p.rect(roadDark, x, y, 2, 1);
      else if (n > 0.965) p.rect(roadLight, x, y, 1, 1);
    }
  const mid = (ROAD_L + ROAD_R) / 2;
  for (let y = 0; y < PERIOD; y += 24) p.rect(t.top("#e8d8b0"), mid - 1, y, 2, 12);
  for (let y = 0; y < PERIOD; y += BLOCK) {
    p.rect(roadLight, ROAD_L + 22, y + 20, 1, 8);
    p.rect(roadLight, ROAD_R - 23, y + 20, 1, 8);
  }
  const props: { y: number; draw: () => void }[] = [];
  for (let k = 0; k < BLOCKS; k++) {
    const top = k * BLOCK;
    // An alley crossing at the foot of the block, a crosswalk on some.
    const alley = top + BLOCK - 12;
    if (noise(k, 2, 9) < 0.5) for (let x = ROAD_L + 6; x < ROAD_R - 6; x += 8) p.rect(t.top("#e8d8b0"), x, alley + 2, 4, 8);
    else {
      p.oval(roadDark, mid - 20, top + 30, 5, 2);
      p.rect(roadLight, mid - 24, top + 30, 9, 1);
    }
    for (const side of [-1, 1] as const) {
      const walkX = side < 0 ? ROAD_L - WALK : ROAD_R;
      const curbX = side < 0 ? ROAD_L - 2 : ROAD_R;
      p.rect(walk, walkX, top, WALK, BLOCK);
      for (let y = 0; y < BLOCK; y += 12) p.rect(seam, walkX, top + y, WALK, 1);
      p.rect(seam, walkX + Math.floor(WALK / 2), top, 1, BLOCK);
      p.rect(curb, curbX, top, 2, BLOCK);
      p.rect(t.shade("#8e8173"), side < 0 ? curbX + 1 : curbX, top, 1, BLOCK);
      // The building: its roof, a parapet, and the south wall below it facing down the street.
      const roofX = side < 0 ? 0 : ROAD_R + WALK;
      const roofW = side < 0 ? ROAD_L - WALK : W - roofX;
      const roof = ROOFS[Math.floor(noise(k, side, 1) * ROOFS.length)];
      const depth = BLOCK - 26;
      p.rect(ink(t), roofX, top, roofW, depth + 14);
      // In winter the roof is under snow: a solid cover, with the roof showing
      // through only in a thin thawed line along the parapet.
      const roofIn = roofX + (side < 0 ? 0 : 1);
      p.rect(t.top(snow ? "#ecebe4" : roof), roofIn, top, roofW - 1, depth);
      p.rect(t.top(snow ? "#fbfbf6" : mixHex(roof, CREAM, 0.25)), roofIn, top, roofW - 1, 1);
      if (snow) p.dither(t.top(mixHex(roof, "#ecebe4", 0.35)), roofIn, top + depth - 3, roofW - 1, 3, 0.5);
      const wall = mixHex("#e3d6bc", roof, 0.3);
      p.rect(t.front(wall), roofX + (side < 0 ? 0 : 1), top + depth, roofW - 1, 13);
      for (let wx = roofX + 6; wx < roofX + roofW - 8; wx += 10) {
        const on = light.night > 0.3 && noise(wx, k, side + 4) < 0.6;
        p.rect(on ? "#ffd98f" : t.front(mixHex(wall, INK, 0.35)), wx, top + depth + 3, 5, 6);
      }
      // The street side of the building: its wall seen edge on, darker.
      const edgeX = side < 0 ? ROAD_L - WALK - 4 : ROAD_R + WALK;
      p.rect(side < 0 ? t.right(mixHex(wall, INK, 0.15)) : t.left(mixHex(wall, INK, 0.15)), edgeX, top, 4, depth + 13);
      // Something on every roof: a vent, a skylight, a water tank.
      const kind = Math.floor(noise(k, side, 4) * 3);
      const rx = roofX + 10 + Math.floor(noise(k, side, 5) * (roofW - 40));
      const ry = top + 10 + Math.floor(noise(k, side, 6) * 34);
      const cap = t.top("#f8f8f2");
      if (kind === 0) {
        p.rect(ink(t), rx, ry, 16, 11);
        p.rect(t.top("#bdb6ad"), rx + 1, ry + 1, 14, 6);
        p.rect(t.front("#8f8981"), rx + 1, ry + 7, 14, 3);
        if (snow) p.rect(cap, rx + 1, ry + 1, 14, 3);
      } else if (kind === 1) {
        p.rect(ink(t), rx, ry, 18, 12);
        p.rect(light.night > 0.3 ? "#e9c77a" : t.top("#9fb5b8"), rx + 1, ry + 1, 16, 10);
        p.rect(ink(t), rx + 9, ry + 1, 1, 10);
        if (snow) p.rect(cap, rx + 1, ry + 1, 16, 2);
      } else {
        p.oval(ink(t), rx + 8, ry + 8, 8, 7);
        p.oval(t.top("#a98a6a"), rx + 8, ry + 7, 7, 6);
        p.rect(t.front("#8a6c52"), rx + 2, ry + 7, 13, 1);
        if (snow) p.oval(cap, rx + 8, ry + 5, 6, 3);
      }
      // A shop awning over the pavement on some blocks.
      if (noise(k, side, 7) < 0.6) {
        const color = AWNINGS[Math.floor(noise(k, side, 8) * AWNINGS.length)];
        const ax = side < 0 ? ROAD_L - WALK - 2 : ROAD_R + WALK - 10;
        for (let y = 0; y < 34; y += 5) p.rect(t.top(y % 10 ? "#f1e1c0" : color), ax, top + 18 + y, 12, 5);
        p.rect(ink(t), side < 0 ? ax + 12 : ax - 1, top + 18, 1, 34);
        const flower = ["#e48f88", "#e9c46a", "#b8a2d0"][Math.floor(noise(k, side, 12) * 3)];
        const plant = stacked("planter-" + flower, () => planter(flower));
        const px = side < 0 ? ROAD_L - WALK + 14 : ROAD_R + 12;
        props.push({ y: top + 62, draw: () => p.sprite(plant.grid, t.palette(plant.palette, t.f.top), px - plant.anchorX, top + 62 - plant.anchorY) });
      }
      // A tree or a lamp by the kerb.
      const prop = noise(k, side, 10);
      const py = top + 12 + Math.floor(noise(k, side, 11) * 50);
      const px = side < 0 ? ROAD_L - 8 : ROAD_R + 8;
      if (prop < 0.5) {
        const seed = Math.floor(noise(k, side, 13) * 6);
        const crown = snow ? "#c9d4c6" : light.season === "autumn" ? "#c0793f" : seed % 2 ? "#6f8b62" : "#7d9468";
        const tr = stacked(`tree-${seed}-${crown}`, () => tree(seed, crown));
        props.push({
          y: py,
          draw: () => {
            shadow(p, light, px, py, 9, 22);
            p.sprite(tr.grid, t.palette(tr.palette, t.f.top), px - tr.anchorX, py - tr.anchorY);
          },
        });
      } else {
        const l = stacked("lamp-" + -side, () => lamp((-side) as 1 | -1));
        props.push({
          y: py,
          draw: () => {
            shadow(p, light, px, py, 3, 26);
            p.sprite(l.grid, t.palette(l.palette, t.f.top), px - l.anchorX, py - l.anchorY);
            if (light.night > 0.3) pool(p, px - side * 10, py + 4, 26, 14, 0.5 * light.night);
          },
        });
      }
      // A car parked in the lane on some blocks.
      if (noise(k, side, 14) < 0.45) {
        const [body, trim] = CAR_COLORS[Math.floor(noise(k, side, 15) * CAR_COLORS.length)];
        const cx = side < 0 ? ROAD_L + 12 : ROAD_R - 12;
        const cy = top + 26 + Math.floor(noise(k, side, 16) * 30);
        const v = stacked(`car-${body}-${side}`, () => car(body, trim), { turn: side < 0 ? 0 : Math.PI });
        props.push({
          y: cy,
          draw: () => {
            shadow(p, light, cx, cy + 10, 9, 10);
            p.sprite(v.grid, t.palette(v.palette, t.f.top), cx - v.anchorX, cy - v.anchorY);
          },
        });
      }
    }
    // The buildings' shadows across the pavement, thrown away from the sun.
    if (light.sun > 0.05) {
      const reach = Math.round(-light.azimuth * 40 * (1.2 - light.elevation));
      const color = mixHex(INK, light.sky[0], 0.3);
      p.alpha(0.3 * Math.min(1, light.sun * 1.5), () => {
        if (reach < 0) p.rect(color, ROAD_R + WALK + reach, top, -reach, BLOCK - 13);
        if (reach > 0) p.rect(color, ROAD_L - WALK, top, reach, BLOCK - 13);
      });
    }
  }
  // Each prop also once a period down, so what hangs over the strip's top
  // edge comes round again at its foot and the seam never shows.
  props.sort((a, b) => a.y - b.y);
  for (const prop of props) {
    prop.draw();
    if (prop.y < 40) p.at(0, PERIOD, prop.draw);
  }
  if (light.weather === "rain")
    for (let k = 0; k < 8; k++) {
      const y = Math.floor(noise(k, 0, 20) * PERIOD);
      const x = ROAD_L + 14 + noise(k, 1, 20) * (ROAD_R - ROAD_L - 28);
      p.oval(t.top("#6f7b88"), x, y, 9, 3);
      p.rect(t.top("#9eabb6"), x - 4, y - 1, 5, 1);
    }
}

/** A soft shadow on the ground under something `h` tall, away from the sun. */
function shadow(p: Painter, light: Light, x: number, y: number, r: number, h: number) {
  const dx = light.sun > 0.05 ? Math.round(-light.azimuth * h * 0.5) : 0;
  p.alpha(0.3, () => p.oval(INK, x + dx, y + 1, r, Math.max(2, r * 0.4)));
}

/** Copies the strip in at the scroll offset; on a canvas it paints the street afresh. */
function blitStreet(p: Painter, light: Light, scroll: number) {
  const strip = streetStrip(light);
  const target = p.ctx as unknown as Partial<PixelBuffer>;
  if (target.words && target.width === W) {
    const words = target.words;
    for (let y = 0; y < H; y++) {
      const src = (((y - scroll) % PERIOD) + PERIOD) % PERIOD;
      words.set(strip.words.subarray(src * W, src * W + W), y * W);
    }
    return;
  }
  const offset = ((scroll % PERIOD) + PERIOD) % PERIOD;
  p.at(0, offset - PERIOD, () => paintStreet(p, light));
  p.at(0, offset, () => paintStreet(p, light));
}

export function drawDelivery(p: Painter, light: Light, s: DeliveryState) {
  const t = tone(light, 1);
  const scroll = Math.floor(s.time * SPEED);
  blitStreet(p, light, scroll);

  // The courier, leaning with the load.
  const bikeX = Math.round((ROAD_L + ROAD_R) / 2 + 14 + s.balance * 6);
  const bikeY = 214;
  const lean = Math.max(-1.2, Math.min(1.2, s.balance)) * 0.42;
  const bike = stacked("bike-" + s.cups.join(","), () => cargoBike(s.cups), {
    turn: -s.steering * 0.16 - s.balance * 0.08,
    shear: lean,
    squash: 0.8,
    spacing: 0.8,
  });
  shadow(p, light, bikeX + 1, bikeY + 2, 7, 20);
  p.sprite(bike.grid, t.palette(bike.palette, t.f.top), bikeX - bike.anchorX, bikeY - bike.anchorY);
  // Past what the cups can take, tea slops over the side the box leans to.
  const over = Math.abs(s.balance) - s.tolerance;
  if (s.riding && over > 0) {
    const side = Math.sign(s.balance);
    const boxX = bikeX - bike.anchorX + Math.round(bike.grid[0].length / 2) + side * 6;
    const boxY = bikeY - bike.anchorY + 4;
    for (let i = 0; i < 3 + Math.round(over * 8); i++) {
      const f = (s.time * 2.6 + i * 0.37) % 1;
      const x = boxX + side * (2 + f * 14 + i);
      const y = boxY + f * f * 16 + (i % 3);
      p.rect("#b07f57", x, y, 2, 2);
      p.rect("#e3bb8a", x, y, 1, 1);
    }
  }
  if (s.riding) precipitation(p, light, s.time, 0, 0, W, H, 1.2);
  else precipitation(p, light, 0.5, 0, 0, W, H, 1.2);
  drawRoute(p, s.progress);
  drawLevel(p, s.balance, s.tolerance);
}

/** A chip at the top: the commissary, the shop, and the bike between them. */
function drawRoute(p: Painter, progress: number) {
  const w = 176;
  const x = Math.round(W / 2 - w / 2);
  chip(p, x, 6, w, 16);
  p.rect("#6b5850", x + 16, 14, w - 32, 1);
  p.rect("#f0c482", x + 16, 14, Math.round((w - 32) * progress), 1);
  // The commissary crate at the start, the shop's flag at the end.
  p.rect("#c79a68", x + 5, 10, 7, 7);
  p.rect("#8f6a4c", x + 5, 13, 7, 1);
  p.rect(CREAM, x + w - 9, 9, 1, 9);
  p.rect("#c4574a", x + w - 8, 9, 5, 3);
  const bx = x + 16 + Math.round((w - 32) * progress);
  p.rect(CREAM, bx - 3, 11, 7, 2);
  p.rect("#2b2526", bx - 3, 13, 2, 2);
  p.rect("#2b2526", bx + 2, 13, 2, 2);
}

/** A spirit level at the foot of the scene: the bubble is the box's tilt. */
function drawLevel(p: Painter, balance: number, tolerance: number) {
  const cx = W / 2;
  const y = 248;
  const half = 48;
  chip(p, cx - half - 8, y - 4, half * 2 + 16, 18);
  p.rect("#8d8686", cx - half - 2, y, half * 2 + 4, 10);
  p.rect("#bcd0b4", cx - half, y + 1, half * 2, 8);
  p.rect("#9fb597", cx - half, y + 7, half * 2, 2);
  const safe = Math.round(tolerance * half);
  p.rect(CREAM, cx - safe - 1, y - 2, 1, 14);
  p.rect(CREAM, cx + safe, y - 2, 1, 14);
  const out = Math.abs(balance) > tolerance;
  const bx = cx + Math.round(Math.max(-1, Math.min(1, balance)) * (half - 5));
  p.rect(out ? "#e48f88" : "#f6f9ef", bx - 5, y + 2, 10, 5);
  p.rect(out ? "#c4574a" : "#ffffff", bx - 3, y + 2, 3, 1);
}
