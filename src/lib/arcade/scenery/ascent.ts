import { mixHex } from "#lib/arcade/core/color.ts";
import { bayer } from "#lib/arcade/core/dither.ts";
import { clamp, hash, HEIGHT, Pixels, raster, WIDTH, wrap } from "./pixel";
import { paintProp } from "./props";

type Plate = readonly [string, string, string];
const skies: ReadonlyArray<{ at: number; colors: Plate }> = [
  { at: 0, colors: ["#4f506a", "#9f6a73", "#e0a47c"] },
  { at: 24, colors: ["#536888", "#937e95", "#e0a996"] },
  { at: 49, colors: ["#303d64", "#536b91", "#a38d9a"] },
  { at: 71, colors: ["#10172b", "#192844", "#364967"] },
  { at: 100, colors: ["#101221", "#171a30", "#282740"] },
];

const skyCache = new Map<number, HTMLCanvasElement>();
function sky(altitude: number) {
  let image = skyCache.get(altitude);
  if (image) return image;
  const upper = skies.findIndex(({ at }) => at >= altitude);
  const after = skies[upper];
  const before = skies[Math.max(0, upper - 1)];
  const step = before === after ? 0 : (altitude - before.at) / (after.at - before.at);
  const colors = before.colors.map((color, i) => mixHex(color, after.colors[i], step));
  image = raster(WIDTH, HEIGHT, (p) => p.bands(colors[0], colors[1], colors[2], 62, 18));
  skyCache.set(altitude, image);
  return image;
}

export function skyline(p: Pixels, foot: number, offset: number, layer: number, night = false) {
  const period = 18;
  const fill = night
    ? ["#46556d", "#39465d", "#292e42"][layer]
    : ["#9d7280", "#72586b", "#4b3d53"][layer];
  const shift = Math.floor(offset / period);
  for (let col = -1; col <= WIDTH / period + 1; col++) {
    const seed = wrap(col - shift, 97) + layer * 133;
    const x = col * period + wrap(offset, period);
    const w = 13 + Math.floor(hash(seed + 15) * 6);
    const h = 8 + Math.floor(hash(seed + 120) * (8 + 13 * layer));
    const top = foot - h;
    p.rect(fill, x, top, w, h);
    if (hash(seed + 45) > 0.45) {
      p.rect(fill, x + 3, top - 4, w - 6, 5);
      if (layer && hash(seed + 24) > 0.5) p.rect(fill, x + 6, top - 11, 1, 10);
    }
    const light = night ? "#9c7f79" : layer === 2 ? "#be8f7c" : "#ad7c81";
    for (let y = top + 5; y < foot - 2; y += 6) {
      for (let i = 3; i <= w - 4; i += 5) {
        if (hash(seed * 7 + i * 29 + y - top) > (layer ? 0.47 : 0.68)) p.rect(light, x + i, y, layer ? 2 : 1, 2);
      }
    }
  }
}

const bankColors = [
  ["#a48192", "#c69698", "#e0af9e", "#f2c9a9"],
  ["#637295", "#8690ad", "#a3a7bc", "#c2b9c5"],
  ["#425879", "#577192", "#6e87a6", "#9aa6ba"],
];

const cloudCache = new Map<number, HTMLCanvasElement>();
function cloudBank(color: number, variant: number) {
  const key = color * 4 + variant;
  let cloud = cloudCache.get(key);
  if (cloud) return cloud;
  const [shade, middle, crown, light] = bankColors[color];
  cloud = raster(158, 42, (p) => {
    const puffs = Array.from({ length: 8 }, (_, j) => ({
      x: 22 + j * 16,
      y: 25 - hash(variant * 22 + j * 3) * 13,
      radius: 4 + Math.floor(hash(variant * 53 + j) * 10),
    }));
    // Paint whole banks in passes so individual lobes merge along the lit edge.
    for (const { x, y, radius } of puffs) p.oval(shade, x, y + 6, 22, radius);
    for (const { x, y, radius } of puffs) p.oval(middle, x, y + 2, 19, radius);
    for (const { x, y, radius } of puffs) p.oval(crown, x - 2, y - 2, 17, Math.max(2, radius - 2));
    for (const { x, y, radius } of puffs.slice(1, -2)) {
      if (radius > 7) p.oval(light, x - 4, y - 5, 12, radius - 4);
    }
    for (let x = 14; x < 144; x += 7) p.rect(crown, x, 28 + Math.floor(hash(x + variant) * 7), 4 + (x % 9));
  });
  cloudCache.set(key, cloud);
  return cloud;
}

function clouds(p: Pixels, altitude: number, time: number) {
  const opacity = clamp(1 - (altitude - 43) / 32, 0, 1) * clamp(0.46 + altitude / 28, 0, 1);
  if (!opacity) return;
  const cooling = altitude < 28 ? clamp((altitude - 13) / 15, 0, 1) : 1 + clamp((altitude - 28) / 20, 0, 1);
  const hue = Math.min(Math.floor(cooling), 1);
  const mix = cooling - hue;
  p.ctx.save();
  for (const layer of [0, 1, 2]) {
    const y = 73 + (altitude - 22) * 2 + layer * 27;
    const speed = 1 + layer * 2.2;
    for (let i = 0; i < 4; i++) {
      const x = wrap(7 + i * 118 + time * speed + layer * 67, 472) - 144;
      const top = y + hash(i * 21 + layer) * 15;
      const variant = (i + layer) % 4;
      p.ctx.globalAlpha = opacity;
      p.image(cloudBank(hue, variant), x, top);
      if (mix > 0) {
        p.ctx.globalAlpha = opacity * mix;
        p.image(cloudBank(hue + 1, variant), x, top);
      }
    }
  }
  p.ctx.restore();
}

function stars(p: Pixels, altitude: number, time: number) {
  const sight = clamp((altitude - 42) / 36, 0, 1);
  if (!sight) return;
  p.ctx.save();
  p.ctx.globalAlpha = sight;
  for (let i = 0; i < 95; i++) {
    const depth = hash(i * 8 + 2);
    const x = wrap(hash(i * 31 + 105) * WIDTH + time * depth * 0.9, WIDTH);
    const y = wrap(hash(i * 19 + 6) * HEIGHT + altitude * depth * 0.18, HEIGHT);
    const color = depth < 0.17 ? "#a3a4ad" : depth < 0.5 ? "#5a6886" : "#3d4865";
    p.rect(color, x, y);
    if (depth < 0.045 && Math.floor(time / 3 + i) % 3 !== 0) {
      p.rect("#596780", x - 1, y, 3);
      p.rect("#596780", x, y - 1, 1, 3);
      p.rect("#b3aaa2", x, y);
    }
  }
  p.ctx.restore();
}

const earthCache = new Map<number, HTMLCanvasElement>();
function earth(meridian: number) {
  let globe = earthCache.get(meridian);
  if (globe) return globe;
  const radius = 133;
  const size = radius * 2 + 1;
  globe = raster(size, size, (p) => {
    const image = p.ctx.createImageData(size, size);
    const shades = [
      "#1b2740", "#273b59", "#345775", "#426980",
      "#2e4d5d", "#477069", "#69877a",
      "#507187", "#7f9c9c", "#9cb1a8",
      "#416880", "#638b9a", "#8aa8aa", "#aa957e",
    ].map((hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)));
    const spin = meridian * 0.036;
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const nx = x / radius, ny = y / radius;
        const circle = nx * nx + ny * ny;
        if (circle > 1) continue;
        const nz = Math.sqrt(1 - circle);
        const lon = Math.atan2(nx, nz) + spin;
        const lat = Math.asin(ny);
        const daylight = nx * -0.43 + ny * -0.6 + nz * 0.45;
        const land = Math.sin(lon * 2 + Math.cos(lat * 3)) + Math.cos(lon * 3 - lat * 4) * 0.54 + Math.sin(lat * 10 + lon * 6) * 0.32;
        const cloud = Math.sin(lon * 5 + lat * 13 + Math.sin(lat * 8)) + Math.cos(lat * 23 + lon * 9) * 0.55;
        const texture = bayer(x, y) * 0.24;
        let selected = 0;
        if (nz < 0.22 && daylight > -0.18) selected = nz < 0.09 ? 10 : nz < 0.15 ? 11 : 12;
        else if (daylight + texture > 0.14) {
          const light = Math.min(2, Math.floor(daylight * 2.8 + texture));
          selected = land > 0.58 ? 4 + light : 1 + light;
          if (cloud > 1.03 || (cloud > 0.7 && texture > 0.15)) selected = 7 + light;
        } else if (land > 0.6 && hash(x + y * size) > 0.986) selected = 13;
        const offset = ((y + radius) * size + x + radius) * 4;
        image.data.set(shades[selected], offset);
        image.data[offset + 3] = 255;
      }
    }
    p.ctx.putImageData(image, 0, 0);
  });
  earthCache.set(meridian, globe);
  return globe;
}

let distantDust: HTMLCanvasElement;
function dust(p: Pixels, time: number) {
  distantDust ??= raster(WIDTH + 16, HEIGHT, (q) => {
    for (let i = 0; i < 380; i++) {
      const x = hash(i * 53 + 8) * (WIDTH + 16);
      const spine = 134 - x * 0.36 + Math.sin(x / 38) * 8;
      const y = spine + (hash(i * 41 + 20) + hash(i * 17 + 30) - 1) * 52;
      q.rect(i % 7 ? "#282b45" : "#3a3b56", x, y);
    }
  });
  p.image(distantDust, -8 + Math.sin(time / 22) * 6, 0);
}

function crescent(p: Pixels, cx: number, cy: number) {
  p.oval("#26304a", cx, cy, 13, 13);
  for (let y = -12; y <= 12; y++) {
    const width = Math.floor(Math.sqrt(13 * 13 - y * y));
    const inset = Math.max(-width + 1, -width + 4 + Math.round(y * 0.4));
    p.rect("#929394", cx - width, cy + y, inset + width + 1);
    if (y < 3) p.rect("#b7af9f", cx - width, cy + y, 1);
  }
  p.rect("#6d7583", cx - 9, cy + 4, 2, 2);
}

const cups = [
  ["#a95457", "#e2a68a"], ["#677983", "#a4b9af"], ["#9a743e", "#e9bc75"],
  ["#866587", "#c3a4c2"], ["#a5636a", "#e7a0a4"], ["#63826f", "#a8be92"],
];

export function paintCup(p: Pixels, x: number, y: number, colors: readonly string[], scale = 1) {
  const [shade, fill] = colors;
  const dot = (color: string, dx: number, dy: number, w: number, h = 1) => p.rect(color, x + dx * scale, y + dy * scale, w * scale, h * scale);
  dot("#f6e5d2", 1, 0, 23);
  dot("#f6e5d2", 0, 1, 25, 2);
  dot("#312b31", 1, 2, 23, 2);
  dot("#edcfaa", 2, 2, 20);
  dot("#312b31", 2, 4, 21, 6);
  dot(fill, 3, 4, 19, 4);
  dot(shade, 5, 8, 15, 3);
  dot("#f6e5d2", 3, 10, 19);
  dot("#312b31", 4, 9, 17, 2);
  dot(shade, 5, 8, 15, 2);
  dot(fill, 5, 6, 2, 3);
  dot("#47343a", 9, 8, 2); dot("#47343a", 15, 8, 2);
}

export function paintTower(p: Pixels, altitude: number, time: number) {
  const top = 74 + (altitude < 9 ? (9 - altitude) * 5 : 0);
  const height = Math.min(9, 2 + Math.floor(altitude / 2));
  for (let i = height - 1; i >= 0; i--) {
    paintCup(p, 142 + (i % 3) - 1, top + i * 10, cups[(Math.floor(altitude / 6) + i) % cups.length]);
  }
  const slide = Math.round(Math.sin(time * 1.35) * 37);
  paintCup(p, 142 + slide, top - 17, cups[(Math.floor(altitude / 6) + 1) % cups.length]);
  p.rect("#f2ce9d", 139, top - 3, 3);
  p.rect("#f2ce9d", 168, top - 3, 3);
}

export function paintAscent(p: Pixels, altitude: number, time: number, gameplay: boolean) {
  p.image(sky(altitude), 0, 0);
  const horizon = 116 + altitude * 2.45;
  if (altitude < 16) {
    p.oval("#eaba8f", 223, 79 + altitude * 3, 22, 22);
    skyline(p, horizon + 3, time * 1, 0);
    skyline(p, horizon + 18, time * 2, 1);
    skyline(p, horizon + 30, time * 3, 2);
  }
  stars(p, altitude, time);
  clouds(p, altitude, time);

  if (altitude < 9) {
    const roof = 139 + altitude * 4;
    p.rect("#514351", 0, roof, WIDTH, 50);
    p.rect("#735560", 0, roof, WIDTH, 3);
    p.rect("#ad7e73", 0, roof, WIDTH, 1);
    for (let x = 4; x < WIDTH; x += 18) p.rect("#644c55", x, roof + 8, 9);
    paintProp(p, "tank", 39, roof - 41);
    paintProp(p, "awning", 253, roof - 22);
    if (gameplay) {
      p.rect("#8c6147", 126, roof - 2, 59, 5);
      p.rect("#e0ae84", 122, roof - 4, 68, 2);
      p.rect("#71504b", 130, roof + 3, 3, 17);
      p.rect("#71504b", 178, roof + 3, 3, 17);
    }
  }

  if (altitude > 14 && altitude < 40) {
    paintProp(p, "balloon", 235 - time % 42, 101 + (altitude - 24) * 3 + Math.sin(time * 1.2) * 3);
  }
  if (altitude > 34 && altitude < 63) {
    const x = wrap(time * 11 + 94, WIDTH + 110) - 60;
    const y = 107 + (altitude - 46) * 2;
    p.rect("#8f98ad", x - 58, y + 9, 52);
    p.rect("#656f91", x - 42, y + 11, 34);
    paintProp(p, "courier", x, y);
  }

  if (altitude > 56 && altitude < 99) {
    p.ctx.save();
    p.ctx.globalAlpha = Math.min(clamp((altitude - 56) / 8, 0, 1), clamp((99 - altitude) / 8, 0, 1));
    const meridian = Math.round((1 + Math.sin(time * 0.075)) * 8);
    p.image(earth(meridian), -105 + altitude / 3, 92 + Math.abs(altitude - 71) * 3);
    crescent(p, 247 - (altitude - 72) * 0.6, 33 + (altitude - 72) * 0.6);
    const x = 235 + 37 * Math.sin(time / 8);
    const y = 88 + (altitude - 72) * 2.5;
    paintProp(p, "station", x, y);
    if (Math.floor(time * 1.6) % 2 === 0) p.rect("#dfb281", x + 4, y + 22, 2, 2);
    if (altitude > 64) paintProp(p, "probe", 61 + Math.sin(time / 8) * 18, 48 + Math.sin(time / 2.8) * 5);
    p.ctx.restore();
  }
  if (altitude >= 83) {
    p.ctx.save();
    p.ctx.globalAlpha = clamp((altitude - 83) / 11, 0, 1);
    dust(p, time);
    paintProp(p, "ringed", 14 + Math.sin(time / 25) * 12, 19);
    p.oval("#545469", 112 + Math.sin(time / 8) * 11, 73 + Math.sin(time / 15) * 5, 3, 3);
    p.rect("#878290", 110 + Math.sin(time / 8) * 11, 72 + Math.sin(time / 15) * 5);
    paintProp(p, "coaster-moon", 237, 102);
    paintProp(p, "pearl-satellite", 56 + Math.sin(time / 6) * 17, 109 + Math.sin(time / 4) * 6, 1, 20 * Math.sin(time / 5));
    const cometX = 183 + wrap(time * 6 + 25, 165);
    const cometY = 41 + Math.sin(time / 4) * 8;
    paintProp(p, "ice", cometX, cometY);
    paintProp(p, "shard", cometX - 14, cometY + 16);
    p.rect("#5d7585", cometX - 9, cometY + 4, 3);
    p.rect("#52677e", cometX + 6, cometY + 24);
    p.rect("#687e8e", cometX + 2, cometY + 29, 2);
    p.ctx.restore();
  }

  if (gameplay) paintTower(p, altitude, time);
}
