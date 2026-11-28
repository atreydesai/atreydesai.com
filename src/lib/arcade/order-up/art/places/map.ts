/**
 * The city from above at a slant, lit for the hour: blocks of roofs with
 * their south walls showing, streets and a rail line, parks, the river and
 * the harbour, the beach. Each shop has its own building at its own spot:
 * in its colours with a flag when it's yours, a sale board when it can be
 * bought, scaffolding while it isn't open yet. The van's routes run from
 * the commissary as dashed lines with the van along them. After dark the
 * windows and street lamps come on.
 */
import {
  Painter, PLACE_W, PLACE_H, INK, CREAM, mixHex, noise, tone, foliage, pool, haze, SEASON_GREENS, ink, type Light, type Tone,
} from "./kit.ts";

export interface MapShop {
  id: string;
  /** Roof and awning colours (the shop's palette). */
  palette: readonly string[];
}

export interface MapState {
  shops: readonly MapShop[];
  owned: readonly string[];
  /** Shops open to buy or already bought (the rest are still being built). */
  open: readonly string[];
  picked: string;
  here: string;
  routes: readonly { to: string; progress: number }[];
}

const W = PLACE_W;
const H = PLACE_H;
const ROAD = 10;
const VX = [16, 106, 196, 286];
const HY = [22, 186];
const RAIL = 100;

/** Where each shop's door is on the map (pins sit here). */
export const MAP_SPOTS: Record<string, { x: number; y: number }> = {
  lodge: { x: 56, y: 64 },
  campus: { x: 150, y: 66 },
  station: { x: 238, y: 80 },
  commissary: { x: 318, y: 66 },
  moon: { x: 398, y: 46 },
  loft: { x: 62, y: 148 },
  corner: { x: 128, y: 134 },
  night: { x: 244, y: 152 },
  harbor: { x: 330, y: 152 },
  garden: { x: 60, y: 232 },
  truck: { x: 152, y: 236 },
  boardwalk: { x: 262, y: 240 },
};

const ROOFS = ["#b0705a", "#8c8f7a", "#b49a74", "#7f6e7a", "#9a8466", "#a7826a", "#6f7f86"];

const river = (y: number) => 340 + Math.round(Math.sin(y / 23) * 6 + Math.sin(y / 9) * 2);

export function drawMap(p: Painter, light: Light, state: MapState) {
  const t = tone(light, 1);
  const g = SEASON_GREENS[light.season] ?? SEASON_GREENS.spring;
  const night = light.night;

  // Ground, then water on the right with the beach curling in at the bottom.
  p.rect(t.top(mixHex(g.grass, "#c9b99a", 0.45)), 0, 0, W, H);
  water(p, t, light);
  // Roads and pavements.
  const asphalt = t.top("#6c6873");
  const kerb = t.top("#b9ad98");
  for (const x of VX) {
    p.rect(kerb, x - 2, 0, ROAD + 4, H);
    p.rect(asphalt, x, 0, ROAD, H);
    for (let y = 2; y < H; y += 8) p.rect(t.top("#d8cba6"), x + ROAD / 2 - 0.5, y, 1, 4);
  }
  for (const y of HY) {
    p.rect(kerb, 0, y - 2, river(y) - 4, ROAD + 4);
    p.rect(asphalt, 0, y, river(y) - 6, ROAD);
    for (let x = 2; x < river(y) - 8; x += 8) p.rect(t.top("#d8cba6"), x, y + ROAD / 2, 4, 1);
  }
  // Crossings at each junction.
  for (const x of VX)
    for (const y of HY) {
      if (x > river(y) - 8) continue;
      for (let k = 0; k < ROAD; k += 2) {
        p.rect(t.top("#ece3cc"), x + k, y - 5, 1, 3);
        p.rect(t.top("#ece3cc"), x + k, y + ROAD + 2, 1, 3);
      }
    }
  rail(p, t);

  // The districts.
  forest(p, t, light, g);
  for (const [i, b] of blocks().entries()) {
    if (b.kind === "park") park(p, t, light, g, b.x, b.y, b.w, b.h, i);
    else if (b.kind === "beach") beach(p, t, b.x, b.y, b.w, b.h);
    else houses(p, t, light, b.x, b.y, b.w, b.h, i);
  }

  // Routes from the commissary, under the shops.
  for (const route of state.routes) path(p, t, route.to, route.progress);

  for (const shop of state.shops) {
    const at = MAP_SPOTS[shop.id];
    if (!at) continue;
    landmark(p, t, light, shop, at.x, at.y, {
      owned: state.owned.includes(shop.id),
      open: state.open.includes(shop.id),
      picked: state.picked === shop.id,
      here: state.here === shop.id,
    });
  }
  for (const route of state.routes) van(p, t, route.to, route.progress);

  if (night > 0.3) {
    for (const x of VX) for (const y of HY) if (x < river(y) - 8) pool(p, x + ROAD / 2, y + ROAD / 2, 18, 12, 0.5 * night);
    for (const x of VX) pool(p, x + ROAD / 2, 140, 12, 9, 0.4 * night);
  }
  if (light.weather === "fog") haze(p, light, 0, 0, W, H, 0.3);
  if (light.weather === "rain")
    p.alpha(0.4, () => {
      for (let i = 0; i < 160; i++) p.rect(light.lit("#c9d3de", 0.6), Math.floor(noise(i, 0, 90) * W), Math.floor(noise(i, 1, 90) * H), 1, 3);
    });
  if (light.weather === "snow") for (let i = 0; i < 200; i++) p.rect("#f8f8f2", Math.floor(noise(i, 0, 91) * W), Math.floor(noise(i, 1, 91) * H), 1, 1);
}

type Block = { x: number; y: number; w: number; h: number; kind: "houses" | "park" | "beach" };

/** The blocks between the roads, and what fills each. */
function blocks(): Block[] {
  const out: Block[] = [];
  const cols = [[0, VX[0] - 2], [VX[0] + ROAD + 2, VX[1] - 2], [VX[1] + ROAD + 2, VX[2] - 2], [VX[2] + ROAD + 2, VX[3] - 2], [VX[3] + ROAD + 2, 330]];
  const rows = [[HY[0] + ROAD + 2, RAIL - 4], [RAIL + 10, HY[1] - 2], [HY[1] + ROAD + 2, H]];
  for (const [ri, [y0, y1]] of rows.entries())
    for (const [ci, [x0, x1]] of cols.entries()) {
      if (ci === 0 || (ri === 0 && ci === 1)) continue;
      const kind = ri === 2 && ci === 2 ? "park" : ri === 2 && ci >= 3 ? "beach" : ri === 0 && ci === 2 ? "park" : "houses";
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind });
    }
  // Top strip above the first road.
  out.push({ x: VX[0] + ROAD + 2, y: 0, w: VX[3] - VX[0] - ROAD - 4, h: HY[0] - 2, kind: "houses" });
  return out;
}

function water(p: Painter, t: Tone, light: Light) {
  const deep = t.top(light.weather === "rain" ? "#5d7c84" : "#5f8f98");
  const shallow = t.top("#7fb0b0");
  const sand = t.top("#e3d2a6");
  for (let y = 0; y < H; y++) {
    const shore = river(y) - (y > 200 ? Math.round((y - 200) * 1.6) : 0);
    p.rect(sand, shore - 4, y, 4, 1);
    p.rect(shallow, shore, y, 5, 1);
    p.rect(deep, shore + 5, y, W - shore - 5, 1);
  }
  // Ripples, and the lights of the far bank on the water after dark.
  for (let i = 0; i < 90; i++) {
    const y = Math.floor(noise(i, 0, 21) * H);
    const x = river(y) + 8 + Math.floor(noise(i, 1, 21) * (W - river(y) - 8));
    p.rect(light.night > 0.4 && i % 4 === 0 ? "#e8c27a" : t.top("#a9cccc"), x, y, 3 + (i % 3), 1);
  }
}

function rail(p: Painter, t: Tone) {
  const end = river(RAIL) + 30;
  p.rect(t.top("#9a8f80"), 0, RAIL - 3, end, 12);
  for (let x = 0; x < end; x += 3) p.rect(t.top("#6e5242"), x, RAIL - 1, 2, 8);
  p.rect(t.top("#c9cfcf"), 0, RAIL, end, 1);
  p.rect(t.top("#c9cfcf"), 0, RAIL + 5, end, 1);
  // The bridge over the river.
  const bx = river(RAIL) - 4;
  p.rect(ink(t), bx, RAIL - 5, end - bx, 16);
  p.rect(t.top("#8d8a86"), bx + 1, RAIL - 4, end - bx - 2, 14);
  for (let x = bx + 2; x < end; x += 3) p.rect(t.top("#6e5242"), x, RAIL - 1, 2, 8);
  p.rect(t.top("#c9cfcf"), bx, RAIL, end - bx, 1);
  p.rect(t.top("#c9cfcf"), bx, RAIL + 5, end - bx, 1);
}

/** A building seen from above at a slant: a roof `d` deep over a south wall `h` tall. */
function building(p: Painter, t: Tone, light: Light, x: number, y: number, w: number, d: number, h: number, roof: string, wall: string, seed: number, lit = true) {
  // Its shadow on the ground, thrown away from the sun.
  if (light.sun > 0.05) {
    const dx = Math.round(-light.azimuth * h * (1.3 - light.elevation));
    p.alpha(0.3 * Math.min(1, light.sun * 1.5), () => p.rect(mixHex(INK, light.sky[0], 0.3), x + dx, y + h - Math.round(h * light.elevation * 0.4), w, d + 1));
  } else p.alpha(0.25, () => p.rect(INK, x + 1, y + d + h, w, 1));
  p.rect(ink(t), x - 1, y - 1, w + 2, d + h + 2);
  p.rect(t.top(roof), x, y, w, d);
  p.rect(t.top(mixHex(roof, CREAM, 0.25)), x, y, w, 1);
  p.rect(t.top(mixHex(roof, INK, 0.2)), x, y + d - 1, w, 1);
  if (w > 10 && noise(seed, 3, 2) > 0.5) p.rect(t.top(mixHex(roof, INK, 0.15)), x + Math.floor(w / 2), y + 1, 1, d - 2);
  p.rect(t.front(wall), x, y + d, w, h);
  // Windows: a row per storey, lit after dark.
  for (let wy = y + d + 2; wy < y + d + h - 2; wy += 4)
    for (let wx = x + 2; wx < x + w - 2; wx += 4) {
      const on = lit && light.night > 0.3 && noise(wx, wy, seed) < 0.55;
      p.rect(on ? "#ffd98f" : t.front(mixHex(wall, INK, 0.35)), wx, wy, 2, 2);
    }
}

function houses(p: Painter, t: Tone, light: Light, x: number, y: number, w: number, h: number, seed: number) {
  // Terraces along the block's south edge and its north edge, a yard between.
  p.rect(t.top("#b8ab94"), x, y, w, h);
  let bx = x + 1;
  let k = 0;
  while (bx < x + w - 6) {
    const bw = Math.min(x + w - 1 - bx, 12 + Math.floor(noise(k, seed, 1) * 14));
    const tall = 4 + Math.floor(noise(k, seed, 2) * 8);
    const d = Math.min(Math.floor(h / 2) - tall - 1, 8 + Math.floor(noise(k, seed, 3) * 6));
    const roof = ROOFS[Math.floor(noise(k, seed, 4) * ROOFS.length)];
    const wall = mixHex("#e3d6bc", roof, 0.25);
    if (d > 3) building(p, t, light, bx, y + 1, bw - 1, d, tall, roof, wall, seed * 31 + k);
    const d2 = Math.min(Math.floor(h / 2) - 4, 7 + Math.floor(noise(k, seed, 5) * 5));
    const tall2 = 3 + Math.floor(noise(k, seed, 6) * 6);
    if (d2 > 3 && h > 30) building(p, t, light, bx, y + h - d2 - tall2 - 1, bw - 1, d2, tall2, ROOFS[Math.floor(noise(k, seed, 7) * ROOFS.length)], wall, seed * 17 + k);
    bx += bw;
    k++;
  }
}

function park(p: Painter, t: Tone, light: Light, g: { grass: string; leaf: string; leafLit: string }, x: number, y: number, w: number, h: number, seed: number) {
  p.rect(t.top(g.grass), x, y, w, h);
  p.rect(t.top("#d8c9a8"), x + Math.floor(w / 2) - 1, y, 3, h);
  p.rect(t.top("#d8c9a8"), x, y + Math.floor(h / 2) - 1, w, 3);
  for (let i = 0; i < Math.floor((w * h) / 260); i++) {
    const tx = x + 5 + Math.floor(noise(i, seed, 2) * (w - 10));
    const ty = y + 6 + Math.floor(noise(i, seed, 3) * (h - 10));
    if (Math.abs(tx - (x + w / 2)) < 5 || Math.abs(ty - (y + h / 2)) < 5) continue;
    tree(p, t, light, g, tx, ty);
  }
}

function tree(p: Painter, t: Tone, light: Light, g: { leaf: string; leafLit: string }, x: number, y: number, r = 4) {
  if (light.sun > 0.05) p.alpha(0.28, () => p.oval(INK, x - Math.round(light.azimuth * 4), y + 2, r, r * 0.6));
  if (light.season === "winter") {
    p.rect(t.front("#6a4c3c"), x, y - 2, 1, 4);
    p.oval(t.top("#e8e8e2"), x, y - 2, r - 1, r - 2);
    return;
  }
  foliage(p, t, x, y - 1, r, r * 0.85, g.leaf, g.leafLit);
}

function forest(p: Painter, t: Tone, light: Light, g: { leaf: string; leafLit: string; grass: string }) {
  // The hills behind the lodge: pines on a rise, left of the first road.
  p.rect(t.top(mixHex(g.grass, INK, 0.08)), 0, 0, VX[0] - 2, H);
  p.rect(t.top(mixHex(g.grass, INK, 0.05)), VX[0] + ROAD + 2, HY[0] + ROAD + 2, VX[1] - VX[0] - ROAD - 4, RAIL - HY[0] - ROAD - 6);
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(noise(i, 0, 44) * 100);
    const y = 4 + Math.floor(noise(i, 1, 44) * (H - 8));
    if (x > VX[0] - 4 && x < VX[0] + ROAD + 4) continue;
    if (y > HY[0] - 6 && y < HY[0] + ROAD + 4) continue;
    if (y > HY[1] - 6 && y < HY[1] + ROAD + 4) continue;
    if (y > RAIL - 6 && y < RAIL + 12) continue;
    if (x > 30 && y > 40 && y < 92) continue;
    if (x > 26 && y > 120 && y < 180) continue;
    if (x > 26 && y > 200) continue;
    const dark = t.at(mixHex(g.leaf, INK, 0.3), 0);
    if (light.sun > 0.05) p.alpha(0.25, () => p.rect(INK, x - 3 - Math.round(light.azimuth * 4), y + 1, 7, 2));
    p.poly(ink(t), [x, y - 10, x + 5, y + 1, x - 5, y + 1]);
    p.poly(light.season === "winter" ? t.top("#e8e8e2") : dark, [x, y - 9, x + 4, y, x - 4, y]);
    p.poly(light.season === "winter" ? t.top("#ffffff") : t.top(g.leaf), [x, y - 9, x - 4, y, x - 1, y]);
  }
}

function beach(p: Painter, t: Tone, x: number, y: number, w: number, h: number) {
  p.rect(t.top("#e3d2a6"), x, y, w, h);
  for (let i = 0; i < 60; i++) p.rect(t.top("#cdb98c"), x + Math.floor(noise(i, 0, 3) * w), y + Math.floor(noise(i, 1, 3) * h), 1, 1);
  // The boardwalk along the top of the sand.
  p.rect(ink(t), x, y + 10, w, 10);
  p.rect(t.top("#b08562"), x, y + 11, w, 8);
  for (let bx = x; bx < x + w; bx += 3) p.rect(t.top("#94694d"), bx, y + 11, 1, 8);
  // Umbrellas.
  for (let i = 0; i < 4; i++) {
    const ux = x + 14 + i * Math.floor((w - 20) / 4);
    const uy = y + 36 + (i % 2) * 10;
    p.oval(ink(t), ux, uy, 6, 4);
    p.oval(t.top(["#c4574a", "#e9c46a", "#7f9a72", "#8fa4c4"][i]), ux, uy, 5, 3);
    p.rect(t.top("#fbf2de"), ux - 1, uy - 3, 3, 6);
  }
}

/** A shop's own building: its colours, an awning, and what state it's in. */
function landmark(p: Painter, t: Tone, light: Light, shop: MapShop, x: number, y: number, s: { owned: boolean; open: boolean; picked: boolean; here: boolean }) {
  const roof = s.open ? shop.palette[0] : "#a8a49c";
  const trim = shop.palette[1] ?? "#c4574a";
  const w = 26;
  const d = 12;
  const h = shop.id === "loft" ? 22 : shop.id === "station" ? 12 : 9;
  const bx = x - w / 2;
  const by = y - d - h;
  if (shop.id === "moon") {
    // The outpost sits on its own island off the bank.
    p.oval(ink(t), x + 4, y - 10, 30, 19);
    p.oval(t.top("#e3d2a6"), x + 4, y - 10, 29, 18);
    p.oval(t.top("#a7ab9c"), x + 4, y - 11, 25, 15);
  }
  // Clear a lot for it.
  p.rect(t.top("#cfc3aa"), bx - 4, by - 3, w + 8, d + h + 7);
  if (s.picked) {
    // A dashed cream ring round the lot.
    for (let i = 0; i < w + 12; i += 2) {
      p.rect(CREAM, bx - 6 + i, by - 5, 1, 1);
      p.rect(CREAM, bx - 6 + i, by + d + h + 5, 1, 1);
    }
    for (let i = 0; i < d + h + 10; i += 2) {
      p.rect(CREAM, bx - 6, by - 5 + i, 1, 1);
      p.rect(CREAM, bx + w + 5, by - 5 + i, 1, 1);
    }
  }
  building(p, t, light, bx, by, w, d, h, roof, s.open ? mixHex("#efe3c8", shop.palette[2] ?? "#efe3c8", 0.5) : "#c9c4ba", Math.floor(noise(x, y, 1) * 100), s.open);
  if (s.open) {
    // A striped awning over the door, a window glowing when it's yours.
    for (let k = 0; k < w; k += 4) p.rect(t.front(k % 8 ? CREAM : trim), bx + k, by + d, 4, 3);
    p.rect(ink(t), bx + w / 2 - 2, y - 4, 4, 4);
    p.rect(s.owned && light.night > 0.2 ? "#ffd98f" : t.front(mixHex(trim, INK, 0.3)), bx + w / 2 - 1, y - 3, 2, 3);
  } else {
    // Scaffolding: poles and boards across the front.
    for (let k = 0; k <= w; k += 6) p.rect(t.front("#8a6248"), bx + k, by - 2, 1, d + h + 2);
    for (const yy of [by + d + 2, by + d + h - 2]) p.rect(t.front("#c9a560"), bx - 1, yy, w + 2, 1);
  }
  if (s.owned) {
    // A flag on the roof in the shop's colour.
    p.rect(ink(t), bx + 3, by - 10, 1, 11);
    p.rect(t.front(trim), bx + 4, by - 10, 6, 4);
    p.rect(t.front(mixHex(trim, CREAM, 0.3)), bx + 4, by - 10, 6, 1);
  } else if (s.open) {
    // A sale board staked in front.
    p.rect(ink(t), bx + w + 1, y - 9, 10, 7);
    p.rect(t.front("#fbf2de"), bx + w + 2, y - 8, 8, 5);
    p.rect(t.front("#c4574a"), bx + w + 3, y - 7, 6, 1);
    p.rect(t.front("#c4574a"), bx + w + 3, y - 5, 4, 1);
    p.rect(ink(t), bx + w + 5, y - 2, 1, 3);
  }
  if (s.here) {
    // Where you're working: a star over the roof.
    const sx = bx + w - 6;
    const sy = by - 10;
    p.rect(ink(t), sx - 1, sy - 3, 3, 9);
    p.rect(ink(t), sx - 4, sy - 1, 9, 4);
    p.rect("#f4c542", sx, sy - 2, 1, 7);
    p.rect("#f4c542", sx - 3, sy, 7, 2);
  }
  if (shop.id === "moon") {
    // The outpost's rocket on its pad.
    p.rect(ink(t), bx + w + 4, by - 12, 7, 20);
    p.rect(t.front("#e8e4dc"), bx + w + 5, by - 11, 5, 18);
    p.rect(t.front("#c4574a"), bx + w + 5, by - 11, 5, 3);
    p.rect(t.front("#8fa4c4"), bx + w + 6, by - 5, 3, 3);
  }
}

/** The route from the commissary's dock to a shop, along the roads. */
function routePoints(to: string) {
  const from = MAP_SPOTS.commissary;
  const end = MAP_SPOTS[to];
  if (!end) return null;
  const street = VX[3] + ROAD / 2;
  const cross = end.y > RAIL ? HY[1] + ROAD / 2 : HY[0] + ROAD / 2;
  const nearest = VX.reduce((a, b) => (Math.abs(b + ROAD / 2 - end.x) < Math.abs(a + ROAD / 2 - end.x) ? b : a)) + ROAD / 2;
  return [from.x, from.y + 2, street, from.y + 2, street, cross, nearest, cross, nearest, end.y + 4, end.x, end.y + 4];
}

function path(p: Painter, t: Tone, to: string, progress: number) {
  const pts = routePoints(to);
  if (!pts) return;
  let n = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const [ax, ay, bx, by] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
    const len = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let k = 0; k <= len; k++) {
      n++;
      if (n % 5 > 2) continue;
      const x = Math.round(ax + ((bx - ax) * k) / Math.max(1, len));
      const y = Math.round(ay + ((by - ay) * k) / Math.max(1, len));
      p.rect(t.top("#f0c482"), x, y, 1, 1);
    }
  }
  void progress;
}

function van(p: Painter, t: Tone, to: string, progress: number) {
  const pts = routePoints(to);
  if (!pts) return;
  const segs: [number, number, number, number, number][] = [];
  let total = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const len = Math.abs(pts[i + 2] - pts[i]) + Math.abs(pts[i + 3] - pts[i + 1]);
    segs.push([pts[i], pts[i + 1], pts[i + 2], pts[i + 3], len]);
    total += len;
  }
  let at = Math.max(0, Math.min(1, progress)) * total;
  for (const [ax, ay, bx, by, len] of segs) {
    if (at > len) {
      at -= len;
      continue;
    }
    const k = len ? at / len : 0;
    const x = Math.round(ax + (bx - ax) * k);
    const y = Math.round(ay + (by - ay) * k);
    const across = Math.abs(bx - ax) > Math.abs(by - ay);
    const vw = across ? 10 : 6;
    const vh = across ? 6 : 10;
    p.rect(ink(t), x - vw / 2 - 1, y - vh / 2 - 1, vw + 2, vh + 2);
    p.rect(t.top("#f2ead8"), x - vw / 2, y - vh / 2, vw, vh);
    p.rect(t.top("#7f9a72"), across ? x + vw / 2 - 3 : x - vw / 2, across ? y - vh / 2 : y - vh / 2, across ? 3 : vw, across ? vh : 3);
    return;
  }
}
