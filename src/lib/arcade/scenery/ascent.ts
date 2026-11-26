import { mixHex } from "#lib/arcade/core/color.ts";
import { bayer } from "#lib/arcade/core/dither.ts";
import { lerp, smoothstep } from "#lib/arcade/core/math.ts";
import { clamp, hash, HEIGHT, Pixels, raster, WIDTH, wrap } from "./pixel";
import { paintGroundedProp, paintProp } from "./props";

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
      const x = wrap(7 + i * 120 + time * speed + layer * 67, WIDTH + 158) - 158;
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
    const x = wrap(hash(i * 31 + 105) * WIDTH + time * depth * 0.9, WIDTH + 4) - 2;
    const y = hash(i * 19 + 6) * HEIGHT + altitude * depth * 0.18;
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

const roofLight = { color: "#916f7a", amount: 0.29 };
const airLight = { color: "#9d8b9d", amount: 0.27 };
const orbitLight = { color: "#505973", amount: 0.31 };

/** The camera passes each band in either direction. */
function flybyProgress(altitude: number, enter: number, arrive: number, leave: number, exit: number) {
  return smoothstep(enter, arrive, altitude) * (1 - smoothstep(leave, exit, altitude));
}

export function paintAscent(p: Pixels, altitude: number, time: number) {
  p.image(sky(Math.min(100, Math.round(altitude))), 0, 0);
  const horizon = 116 + altitude * 2.45;
  if (horizon - 55 < HEIGHT) {
    p.oval("#eaba8f", 223, 79 + altitude * 3, 22, 22);
    skyline(p, horizon + 3, time * 1, 0);
    skyline(p, horizon + 18, time * 2, 1);
    skyline(p, horizon + 30, time * 3, 2);
  }
  stars(p, altitude, time);
  clouds(p, altitude, time);

  const roof = 139 + altitude * 4;
  if (roof - 38 < HEIGHT) {
    p.rect("#514351", 0, roof, WIDTH, 50);
    p.rect("#735560", 0, roof, WIDTH, 3);
    p.rect("#ad7e73", 0, roof, WIDTH, 1);
    for (let x = 4; x < WIDTH; x += 18) p.rect("#644c55", x, roof + 8, 9);
    p.oval("#463849", 53, roof + 2, 12, 2);
    paintGroundedProp(p, "tank", 51, roof + 1, { scale: 0.72, light: roofLight });
    p.rect("#614c59", 259, roof - 13, 22, 14);
    paintGroundedProp(p, "awning", 270, roof + 1, { scale: 0.73, light: roofLight });
  }

  // Side entries work through the viewport edge even when a tall phone
  // needs extra sky above and below the painted plate.
  const balloonX = lerp(WIDTH + 2, 242 + Math.sin(time / 8) * 13, flybyProgress(altitude, 11, 24, 34, 48));
  if (balloonX < WIDTH) {
    const y = 78 + (altitude - 22) * 1.6 + Math.sin(time * 1.2) * 2;
    paintProp(p, "balloon", balloonX, y, { scale: 0.78, light: airLight });
  }
  const courierX = lerp(-44, WIDTH + 59, smoothstep(31, 68, altitude));
  if (courierX > -43 && courierX < WIDTH + 58) {
    const courierY = 78 + (altitude - 41) * 0.85 + Math.sin(time / 7) * 4;
    const x = courierX;
    p.rect("#7986a1", x - 58, courierY + 7, 51);
    p.rect("#626f8e", x - 42, courierY + 9, 35);
    paintProp(p, "courier", x, courierY, { scale: 0.81, light: airLight });
  }

  const earthX = lerp(-269, -88, flybyProgress(altitude, 51, 75, 78, 103));
  if (earthX > -267) {
    const meridian = Math.round((1 + Math.sin(time * 0.075)) * 8);
    p.image(earth(meridian), earthX, 85 + ((altitude - 74) / 18) ** 2 * 11);
  }
  const moonX = lerp(WIDTH + 15, 247, flybyProgress(altitude, 55, 72, 80, 94));
  if (moonX < WIDTH + 14) crescent(p, moonX, 32 + (altitude - 72) * 0.76);
  const stationX = lerp(WIDTH + 2, 238 + 13 * Math.sin(time / 8), flybyProgress(altitude, 55, 74, 81, 99));
  if (stationX < WIDTH) {
    const x = stationX;
    const stationY = 77 + (altitude - 67) * 1.2;
    paintProp(p, "station", x, stationY, { scale: 0.76, light: orbitLight });
    if (Math.floor(time * 1.6) % 2 === 0) p.rect("#ada08e", x + 4, stationY + 17, 2, 2);
  }
  const probeX = lerp(-29, 55 + Math.sin(time / 8) * 12, flybyProgress(altitude, 62, 76, 82, 98));
  const probeY = 42 + (altitude - 73) * 1.3 + Math.sin(time / 2.8) * 4;
  if (probeX > -20) {
    paintProp(p, "probe", probeX, probeY, { scale: 0.78, light: orbitLight });
  }
  if (altitude > 77) {
    p.ctx.save();
    p.ctx.globalAlpha = smoothstep(77, 91, altitude);
    dust(p, time);
    p.ctx.restore();
  }
  const pearlX = lerp(-90, 18 + Math.sin(time / 25) * 8, smoothstep(81, 99, altitude));
  if (pearlX > -87) {
    paintProp(p, "ringed", pearlX, 30, { scale: 0.84, light: orbitLight });
  }
  const coasterX = lerp(WIDTH + 2, 244, smoothstep(87, 103, altitude));
  if (coasterX < WIDTH) {
    paintProp(p, "coaster-moon", coasterX, 105, { scale: 0.76, light: orbitLight });
  }
  const satelliteX = lerp(-65, 57 + Math.sin(time / 6) * 14, smoothstep(84, 102, altitude));
  if (satelliteX > -53) {
    paintProp(p, "pearl-satellite", satelliteX, 108 + Math.sin(time / 4) * 5, {
      scale: 0.73, turn: 20 * Math.sin(time / 5), light: orbitLight,
    });
  }
  const cometX = lerp(-26, WIDTH + 15, smoothstep(83, 115, altitude));
  const cometY = 43 + (altitude - 95) * 0.7 + Math.sin(time / 4) * 4;
  if (cometX > -25 && cometX < WIDTH + 14) {
    paintProp(p, "ice", cometX, cometY, { scale: 0.8, light: orbitLight });
    paintProp(p, "shard", cometX - 13, cometY + 14, { scale: 0.74, light: orbitLight });
  }
}
