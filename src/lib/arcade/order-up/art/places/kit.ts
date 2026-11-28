/**
 * The kit the shop's places are painted with. Every place is a front-on
 * picture at the room's own density (270 rows), in flat colour with Bayer
 * joins and an ink edge, lit through `core/light.ts` for the hour, the
 * season and the weather: a face's colour comes from how squarely it meets
 * the sun, skies come from the light's own bands, and two light passes
 * brighten what is already painted (a sunbeam through a window by day, a
 * lamp's dithered pool after dark). DOM-free, so a node script paints the
 * same pictures the game does.
 */
import { Painter, noise, type Palette } from "../../../core/painter.ts";
import { bayer } from "../../../core/dither.ts";
import { hexToRgb, mixHex } from "../../../core/color.ts";
import { lightAt, shiftHour, PLANNING_HOUR, type Light } from "../../../core/light.ts";

export { Painter, noise, mixHex };
export type { Light, Palette };

/** Every place is painted on this grid: the room's 270 rows at the frame's 8:5. */
export const PLACE_W = 432;
export const PLACE_H = 270;
export const INK = "#2b2126";
export const CREAM = "#fff1dd";

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const q8 = (n: number) => Math.round(clamp01(n) * 8) / 8;

/** The light a place is painted in: the shop's hour for a shift's progress (morning before one). */
export function placeLight(season: string, weather: string, progress: number | null, indoor: boolean): Light {
  const hour = progress === null ? PLANNING_HOUR : shiftHour(progress);
  return lightAt({ hour, season, weather, indoor });
}

/** A shift's progress, or null between shifts. */
export const shiftProgress = (shift: { elapsed: number; duration: number } | null | undefined) =>
  shift ? clamp01(shift.elapsed / Math.max(1, shift.duration)) : null;

// --- How faces meet the light ---------------------------------------------------------

/**
 * How squarely each face of a front-on thing meets the sun, 0..1. The camera
 * looks north, so the morning sun (east) is on the right and lights faces
 * turned right; the evening sun lights faces turned left. `share` is how much
 * of the sun gets in: 1 outdoors, a third or so through a room's windows.
 */
export interface Faces {
  top: number;
  front: number;
  left: number;
  right: number;
}

export function faces(light: Light, share = 1): Faces {
  const s = light.sun * share;
  const low = 1 - light.elevation * 0.4;
  return {
    top: q8(s * (0.45 + 0.55 * light.elevation)),
    front: q8(s * (0.5 + 0.3 * (1 - Math.abs(light.azimuth))) * (1 - light.elevation * 0.25)),
    left: q8(s * Math.max(0, light.azimuth) * low),
    right: q8(s * Math.max(0, -light.azimuth) * low),
  };
}

/** A light bound to a place: colours for each face, lamp glow mixed in after dark. */
export interface Tone {
  light: Light;
  f: Faces;
  /** Lamp light after dark, 0..1, for the whole place (indoors). */
  glow: number;
  at(hex: string, face: number, glow?: number): string;
  top(hex: string): string;
  front(hex: string): string;
  left(hex: string): string;
  right(hex: string): string;
  /** The side away from the sun. */
  away(hex: string): string;
  /** Out of the light altogether. */
  shade(hex: string): string;
  palette(palette: Palette, face?: number): Palette;
}

export function tone(light: Light, share = 1, glow = 0): Tone {
  const f = faces(light, share);
  const at = (hex: string, face: number, g = glow) => light.lit(hex, q8(face), Math.round(clamp01(g) * 4) / 4);
  const awayFace = light.azimuth > 0 ? f.right : f.left;
  return {
    light,
    f,
    glow,
    at,
    top: (h) => at(h, f.top),
    front: (h) => at(h, f.front),
    left: (h) => at(h, f.left),
    right: (h) => at(h, f.right),
    away: (h) => at(h, awayFace * 0.5),
    shade: (h) => at(h, 0),
    palette(palette, face = f.front) {
      const out: Palette = {};
      for (const [k, v] of Object.entries(palette)) out[k] = k === "O" ? v : at(v, face);
      return out;
    },
  };
}

/** The ink edge, a touch warmer under lamps so it never reads as a hole. */
export const ink = (t: Tone) => (t.light.night > 0.5 && t.glow > 0 ? "#2f2328" : INK);

// --- Boxes, edges, shadows -------------------------------------------------------------------

export interface BoxColors {
  top: string;
  front: string;
  /** The front's top edge; lighter than the front by default. */
  lip?: string;
}

/**
 * A front-on box: a top band `d` rows deep above a front face, an ink edge
 * round both and a lit lip where they meet. (x, y) is the front's top-left.
 */
export function box(p: Painter, t: Tone, x: number, y: number, w: number, h: number, d: number, c: BoxColors, edge = true) {
  if (edge) p.rect(ink(t), x - 1, y - d - 1, w + 2, h + d + 2);
  if (d > 0) {
    p.rect(t.top(c.top), x, y - d, w, d);
    p.rect(t.top(mixHex(c.top, CREAM, 0.22)), x, y - d, w, 1);
  }
  p.rect(t.front(c.front), x, y, w, h);
  p.rect(t.front(c.lip ?? mixHex(c.front, CREAM, 0.2)), x, y, w, 1);
  if (h > 3) p.rect(t.front(mixHex(c.front, INK, 0.22)), x, y + h - 1, w, 1);
  // The side away from the sun rounds off a shade darker.
  const side = t.light.azimuth > 0 ? x + w - 2 : x;
  if (w > 10 && h > 4) p.rect(t.away(mixHex(c.front, INK, 0.12)), side, y + 1, 2, h - 2);
}

/** A soft contact shadow on the floor under something standing. */
export function contact(p: Painter, x: number, y: number, w: number, strength = 0.3) {
  p.alpha(strength, () => {
    p.rect(INK, x + 1, y, w - 2, 1);
    p.rect(INK, x + 3, y + 1, w - 6, 1);
  });
}

/**
 * A shadow cast on the ground by something `h` tall standing on (x..x+w, y):
 * thrown away from the sun, long when it is low, gone in shade or at night.
 */
export function cast(p: Painter, light: Light, x: number, y: number, w: number, h: number, depth = 6, strength = 0.28) {
  const s = light.sun;
  if (s < 0.05) {
    contact(p, x, y, w, 0.25);
    return;
  }
  const reach = Math.round(-light.azimuth * h * (1.15 - light.elevation));
  const color = mixHex(INK, light.sky[0], 0.3);
  p.alpha(strength * Math.min(1, s * 1.6), () => {
    for (let r = 0; r < depth; r++) {
      const taper = Math.round((1 - r / depth) * 2);
      const a = x + Math.min(0, reach) + taper;
      const b = x + w + Math.max(0, reach) - taper;
      if (b > a) p.rect(color, a, y - depth + 1 + r, b - a, 1);
    }
  });
}

/** One-pixel highlight runs along an edge in a lighter colour. */
export function glint(p: Painter, color: string, x: number, y: number, n: number, step = 1) {
  for (let i = 0; i < n; i++) p.rect(color, x + i * step, y, 1, 1);
}

// --- Surfaces -------------------------------------------------------------------------------

/**
 * A surface over a rectangle: `at(u, v)` gives a slot in `colors` for each
 * pixel, painted in runs. Colours are lit through `paint` once per slot.
 */
export function surface(p: Painter, x: number, y: number, w: number, h: number, colors: readonly string[], at: (u: number, v: number) => number) {
  for (let v = 0; v < h; v++) {
    let start = 0;
    let slot = at(0, v);
    for (let u = 1; u <= w; u++) {
      const next = u < w ? at(u, v) : -1;
      if (next !== slot) {
        if (slot >= 0) p.rect(colors[slot], x + start, y + v, u - start, 1);
        start = u;
        slot = next;
      }
    }
  }
}

const fract = (n: number) => n - Math.floor(n);

/** Running-bond brick or block: base, alt, mortar. */
export function brickAt(w = 8, h = 4, seed = 21) {
  return (u: number, v: number) => {
    const course = Math.floor(v / h);
    if (fract(v / h) * h < 1) return 2;
    const along = u + (course & 1) * (w / 2);
    if (fract(along / w) * w < 1) return 2;
    return noise(Math.floor(along / w), course, seed) > 0.72 ? 1 : 0;
  };
}

/** Glazed tiles with grout: base, alt, grout. */
export function tileAt(w = 8, h = 4, stagger = true) {
  return (u: number, v: number) => {
    const course = Math.floor(v / h);
    if (fract(v / h) * h < 1) return 2;
    const along = u + (stagger && course & 1 ? w / 2 : 0);
    if (fract(along / w) * w < 1) return 2;
    return noise(Math.floor(along / w), course, 17) > 0.84 ? 1 : 0;
  };
}

/** Plaster, faintly mottled: base, alt. */
export const plasterAt = (seed = 41) => (u: number, v: number) => (noise(Math.floor(u / 3), Math.floor(v / 2), seed) > 0.87 ? 1 : 0);

/** Vertical boards (wainscot, a shed): base, alt, seam. */
export const boardsAt = (w = 6) => (u: number) => (fract(u / w) * w < 1 ? 2 : noise(Math.floor(u / w), 0, 31) > 0.55 ? 1 : 0);

/**
 * Floor boards seen from the front: rows that widen toward the viewer, ends
 * staggered, a little grain. base, alt, seam, grain.
 */
export function floorAt(rows: readonly number[], length = 54) {
  const starts: number[] = [];
  let acc = 0;
  for (const r of rows) {
    starts.push(acc);
    acc += r;
  }
  return (u: number, v: number) => {
    let row = 0;
    while (row + 1 < starts.length && v >= starts[row + 1]) row++;
    if (v === starts[row]) return 2;
    const along = u + noise(row, 3, 11) * length;
    if (fract(along / length) * length < 1) return 2;
    if (noise(Math.floor(along / 4), row, 5) > 0.95) return 3;
    return noise(Math.floor(along / length), row, 7) > 0.6 ? 1 : 0;
  };
}

/** Row heights for a floor `h` deep: thin at the back, wider toward the viewer. */
export function floorRows(h: number, first = 4, grow = 0.7) {
  const rows: number[] = [];
  let total = 0;
  let r = first;
  while (total < h) {
    const n = Math.min(Math.round(r), h - total);
    rows.push(n);
    total += n;
    r += grow;
  }
  return rows;
}

/** Poured concrete: blotches, joints, specks. base, alt, seam, speck. */
export function concreteAt(joint = 64) {
  return (u: number, v: number) => {
    if (fract(u / joint) * joint < 1 || (v > 0 && v % 22 === 0)) return 2;
    if (noise(u, v, 13) > 0.975) return 3;
    return noise(Math.floor(u / 9), Math.floor(v / 5), 2) > 0.62 ? 1 : 0;
  };
}

// --- Sky and the world outside ---------------------------------------------------------------

/**
 * The sky over (x, y, w, h) from the light's three bands, with the sun or
 * the moon where the hour puts it, stars at night and the day's weather.
 */
export function sky(p: Painter, light: Light, x: number, y: number, w: number, h: number, seed = 0) {
  clipped(p, x, y, w, h, () => skyInside(p, light, x, y, w, h, seed));
}

function skyInside(p: Painter, light: Light, x: number, y: number, w: number, h: number, seed: number) {
  const [a, b, c] = light.sky;
  bands(p, [a, b, c], x, y, w, h);
  if (light.night > 0.35) {
    const n = Math.round(w * h * 0.0028 * light.night);
    for (let i = 0; i < n; i++) {
      const sx = x + Math.floor(noise(i, 0, seed + 3) * w);
      const sy = y + Math.floor(noise(i, 1, seed + 3) * h * 0.7);
      p.rect(i % 5 ? mixHex(a, "#d8d2e8", 0.6) : "#fff4dc", sx, sy, 1, 1);
    }
  }
  const cloudy = light.weather === "rain" || light.weather === "fog" || light.weather === "snow";
  // The sun low and warm, or a moon at night.
  if (!cloudy && light.sun > 0.02) {
    const sx = x + w / 2 + light.azimuth * w * 0.42;
    const sy = y + h - 4 - light.elevation * h * 1.25;
    if (sy > y - 6) {
      const disc = mixHex("#fff3cf", "#ffc27a", 1 - light.elevation * 1.6);
      p.alpha(0.35, () => p.oval(mixHex(disc, c, 0.4), sx, sy, 9, 9));
      p.oval(disc, sx, sy, 5, 5);
    }
  }
  clouds(p, light, x, y, w, h, seed, cloudy ? 7 : 3);
  if (light.night > 0.6 && !cloudy) {
    // A crescent moon, clear of the clouds.
    const mx = x + w * 0.58;
    const my = y + h * 0.16;
    p.oval("#f4ecd6", mx, my, 5, 5);
    p.oval(a, mx + 3, my - 1, 4, 4);
  }
}

/** Flat bands down a rectangle, each joined to the next by a dithered seam. */
export function bands(p: Painter, colors: readonly string[], x: number, y: number, w: number, h: number) {
  const n = colors.length - 1;
  for (let row = 0; row < h; row++) {
    const at = (row / Math.max(1, h - 1)) * n;
    const i = Math.min(n - 1, Math.floor(at));
    const blend = Math.max(0, Math.min(1, (at - i - 0.12) / 0.76));
    p.rect(colors[i], x, y + row, w, 1);
    p.dither(colors[i + 1], x, y + row, w, 1, blend);
  }
}

/** An oval of `color` wherever the Bayer threshold is under `amount`. */
export function ditherOval(p: Painter, color: string, cx: number, cy: number, rx: number, ry: number, amount: number) {
  for (let row = -Math.floor(ry); row <= ry; row++) {
    const dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (row / ry) ** 2)));
    p.dither(color, cx - dx, cy + row, dx * 2 + 1, 1, amount);
  }
}

/**
 * A clump of leaves: an inked dark mass, the mid green over it and a lit
 * cap toward the sun, joined by a dithered rim.
 */
export function foliage(p: Painter, t: Tone, cx: number, cy: number, rx: number, ry: number, leaf: string, leafLit: string, edge = true) {
  const side = t.light.azimuth > 0 ? -1 : 1;
  if (edge) p.oval(ink(t), cx, cy, rx + 1, ry + 1);
  p.oval(t.at(mixHex(leaf, INK, 0.35), 0), cx, cy, rx, ry);
  p.oval(t.front(leaf), cx + side * 0.5, cy - ry * 0.2, rx * 0.86, ry * 0.75);
  const lx = cx + side * rx * 0.3;
  const ly = cy - ry * 0.4;
  ditherOval(p, t.top(leafLit), lx, ly, rx * 0.62, ry * 0.5, 0.5);
  p.oval(t.top(leafLit), lx, ly - 1, rx * 0.36, ry * 0.26);
}

/** Flat clouds, lit from the sun's side, more and greyer in poor weather. */
export function clouds(p: Painter, light: Light, x: number, y: number, w: number, h: number, seed: number, count: number) {
  const grey = light.weather === "rain" || light.weather === "snow" || light.weather === "fog";
  const base = light.lit(grey ? "#c9c6c4" : "#f6efe4", 0.4 + light.sun * 0.6);
  const under = light.lit(grey ? "#a3a1a6" : "#dccfc8", 0.2);
  const lit = light.lit(grey ? "#dedad4" : "#fff8ec", 1);
  for (let i = 0; i < count; i++) {
    const cx = x + Math.floor(noise(i, 0, seed + 9) * w);
    const cy = y + 6 + Math.floor(noise(i, 1, seed + 9) * h * 0.45);
    const len = 18 + Math.floor(noise(i, 2, seed + 9) * 30) + (grey ? 24 : 0);
    p.rect(under, cx - len / 2, cy + 3, len, 3);
    p.oval(base, cx - len / 4, cy, len / 4, 4);
    p.oval(base, cx + len / 6, cy - 1, len / 3.5, 5);
    p.rect(base, cx - len / 2, cy + 1, len, 4);
    p.rect(lit, cx - len / 4 + (light.azimuth > 0 ? 3 : -3), cy - 4, len / 4, 1);
  }
}

/** Distant rooftops along `base`, their windows lit after dark. */
export function skyline(p: Painter, light: Light, base: number, x0: number, x1: number, color: string, seed: number, tall = 30) {
  let x = x0;
  let i = 0;
  const wall = light.lit(color, 0.3);
  const top = light.lit(mixHex(color, CREAM, 0.12), 0.7);
  const lit = mixHex("#ffd88f", "#f0b870", noise(seed, 0, 1));
  while (x < x1) {
    const w = 16 + Math.floor(noise(i, seed, 1) * 26);
    const h = 8 + Math.floor(noise(i, seed, 2) * tall);
    p.rect(wall, x, base - h, w, h);
    p.rect(top, x, base - h, w, 1);
    if (noise(i, seed, 3) > 0.6) p.rect(wall, x + 3, base - h - 4, 3, 4);
    for (let wy = base - h + 3; wy < base - 2; wy += 5)
      for (let wx = x + 2; wx < x + w - 2; wx += 4) {
        const on = noise(wx, wy, seed) < 0.22 + light.night * 0.25;
        if (light.night > 0.3 && on) p.rect(lit, wx, wy, 2, 2);
        else if (noise(wx, wy, seed + 1) < 0.3) p.rect(light.lit(mixHex(color, INK, 0.2), 0.2), wx, wy, 2, 2);
      }
    x += w + (noise(i, seed, 4) > 0.7 ? 2 : 0);
    i++;
  }
}

/** Rolling hills along a sine line: `base` is their foot, `rise` how high they swell. */
export function hills(p: Painter, color: string, x0: number, x1: number, base: number, rise: number, seed: number) {
  for (let x = x0; x < x1; x++) {
    const top = Math.round(base - rise * (0.55 + 0.3 * Math.sin(x / 37 + seed) + 0.15 * Math.sin(x / 13 + seed * 2)));
    p.rect(color, x, top, 1, base - top);
  }
}

// --- Weather on top --------------------------------------------------------------------------

/** Falling rain or snow over an area; `time` moves it. */
export function precipitation(p: Painter, light: Light, time: number, x: number, y: number, w: number, h: number, density = 1) {
  if (light.weather === "rain") {
    const color = light.lit("#c9d3de", 0.6);
    p.alpha(0.6, () => {
      const n = Math.round(w * h * 0.0011 * density);
      for (let i = 0; i < n; i++) {
        const sx = x + ((noise(i, 0, 70) * w - time * 22) % w + w) % w;
        const sy = y + (noise(i, 1, 70) * h + time * 170) % h;
        p.rect(color, sx, sy, 1, 4);
      }
    });
  } else if (light.weather === "snow") {
    const color = light.lit("#fbfbf6", 0.8);
    const n = Math.round(w * h * 0.0009 * density);
    for (let i = 0; i < n; i++) {
      const sx = x + ((noise(i, 0, 71) * w + Math.sin(time * 1.3 + i) * 3) % w + w) % w;
      const sy = y + (noise(i, 1, 71) * h + time * (18 + (i % 3) * 6)) % h;
      p.rect(color, sx, sy, i % 4 ? 1 : 2, i % 4 ? 1 : 2);
    }
  }
}

/** A veil of fog: the far colour dithered over everything below `y`. */
export function haze(p: Painter, light: Light, x: number, y: number, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  p.dither(light.sky[2], x, y, w, h, amount);
}

/**
 * Paints `fn` clipped to a rectangle where the target can clip (a pixel
 * buffer); elsewhere it paints unclipped.
 */
export function clipped(p: Painter, x: number, y: number, w: number, h: number, fn: () => void) {
  const ctx = p.ctx as unknown as { clip?: { x0: number; y0: number; x1: number; y1: number } | null };
  if (!("clip" in ctx) || typeof ctx.clip === "function") return fn();
  const before = ctx.clip ?? null;
  const box = { x0: Math.round(x + p.ox), y0: Math.round(y + p.oy), x1: Math.round(x + w + p.ox), y1: Math.round(y + h + p.oy) };
  ctx.clip = before ? { x0: Math.max(before.x0, box.x0), y0: Math.max(before.y0, box.y0), x1: Math.min(before.x1, box.x1), y1: Math.min(before.y1, box.y1) } : box;
  try {
    fn();
  } finally {
    ctx.clip = before;
  }
}

// --- Light passes ---------------------------------------------------------------------------

interface Buffered {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const buffered = (p: Painter) => (p.ctx as unknown as Partial<Buffered>).data && (p.ctx as unknown as Buffered);

/**
 * Brightens what is already painted inside an ellipse toward a lamp's colour,
 * in `steps` dithered rings: a pool of lamp light. Painting into a pixel
 * buffer it lights each pixel's own colour; on a canvas it dithers the tint.
 */
export function pool(p: Painter, cx: number, cy: number, rx: number, ry: number, strength: number, tint = "#ffcf8a", steps = 3) {
  if (strength <= 0) return;
  const buf = buffered(p);
  const [tr, tg, tb] = hexToRgb(tint);
  const x0 = Math.max(0, Math.floor(cx - rx + p.ox));
  const x1 = Math.min(p.width, Math.ceil(cx + rx + p.ox));
  const y0 = Math.max(0, Math.floor(cy - ry + p.oy));
  const y1 = Math.min(p.height, Math.ceil(cy + ry + p.oy));
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const dx = (x - cx - p.ox) / rx;
      const dy = (y - cy - p.oy) / ry;
      const d = dx * dx + dy * dy;
      if (d >= 1) continue;
      const level = Math.floor((1 - d) * steps + bayer(x, y) * 0.999) / steps;
      if (level <= 0) continue;
      const k = level * strength;
      if (buf) {
        const o = (y * buf.width + x) * 4;
        const d0 = buf.data;
        d0[o] = d0[o] + (d0[o] * (tr / 200) + tr * 0.3 - d0[o]) * k;
        d0[o + 1] = d0[o + 1] + (d0[o + 1] * (tg / 200) + tg * 0.3 - d0[o + 1]) * k;
        d0[o + 2] = d0[o + 2] + (d0[o + 2] * (tb / 200) + tb * 0.3 - d0[o + 2]) * k;
      } else if (bayer(x + 1, y) < k * 0.6) {
        p.ctx.fillStyle = tint;
        p.ctx.fillRect(x, y, 1, 1);
      }
    }
}

/**
 * Sunlight through a window onto what is painted: a slanted patch from the
 * span (x0..x1) at `top` to `bottom`, leaning `lean` pixels across its height.
 */
export function beam(p: Painter, x0: number, x1: number, top: number, bottom: number, lean: number, strength: number, tint = "#fff0c8") {
  if (strength <= 0.02) return;
  const buf = buffered(p);
  const [tr, tg, tb] = hexToRgb(tint);
  const h = Math.max(1, bottom - top);
  for (let y = Math.max(0, top); y < Math.min(p.height, bottom); y++) {
    const shift = ((y - top) / h) * lean;
    const a = Math.round(x0 + shift);
    const b = Math.round(x1 + shift);
    for (let x = Math.max(0, a); x < Math.min(p.width, b); x++) {
      // A dithered edge one pixel in from either side.
      const edge = x === a || x === b - 1 ? 0.5 : 1;
      if (edge < 1 && bayer(x, y) > 0.5) continue;
      const k = strength;
      if (buf) {
        const o = (y * buf.width + x) * 4;
        const d0 = buf.data;
        d0[o] = d0[o] + (d0[o] * (tr / 210) + 14 - d0[o]) * k;
        d0[o + 1] = d0[o + 1] + (d0[o + 1] * (tg / 210) + 10 - d0[o + 1]) * k;
        d0[o + 2] = d0[o + 2] + (d0[o + 2] * (tb / 210) + 4 - d0[o + 2]) * k;
      } else if (bayer(x, y) < k * 0.5) {
        p.ctx.fillStyle = tint;
        p.ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/**
 * After dark, darkens what lies outside a lamp's reach in dithered steps, so
 * the corners of a room fall away and the lit part reads.
 */
export function dim(p: Painter, cx: number, cy: number, rx: number, ry: number, strength: number, steps = 3) {
  if (strength <= 0) return;
  const buf = buffered(p);
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy) - 0.55;
      if (d <= 0) continue;
      const level = Math.min(steps, Math.floor(Math.min(1, d * 1.4) * steps + bayer(x, y) * 0.999)) / steps;
      if (level <= 0) continue;
      const k = 1 - level * strength;
      if (buf) {
        const o = (y * buf.width + x) * 4;
        buf.data[o] *= k;
        buf.data[o + 1] *= k;
        buf.data[o + 2] *= k * 1.02 + 0.0;
      } else if (bayer(x, y) < level * strength) {
        p.ctx.fillStyle = INK;
        p.ctx.fillRect(x, y, 1, 1);
      }
    }
}

// --- Fixtures -------------------------------------------------------------------------------

/**
 * A window in a wall with the sky and a strip of town behind it, a frame,
 * a sill and two panes. Returns nothing; by day it should be followed by a
 * `beam` where its light lands.
 */
export function windowPane(p: Painter, t: Tone, x: number, y: number, w: number, h: number, frame: string, seed = 0, outside?: (p: Painter) => void) {
  const light = t.light;
  p.rect(ink(t), x - 3, y - 3, w + 6, h + 6);
  p.rect(t.front(frame), x - 2, y - 2, w + 4, h + 4);
  p.rect(t.front(mixHex(frame, CREAM, 0.25)), x - 2, y - 2, w + 4, 1);
  // The view: sky, then rooftops, then whatever the caller adds.
  const outdoor = lightAt({ hour: light.hour, season: light.season, weather: light.weather, indoor: false });
  clipped(p, x, y, w, h, () => {
    sky(p, outdoor, x, y, w, h, seed);
    skyline(p, outdoor, y + h, x, x + w, light.season === "winter" ? "#a69a98" : "#b39484", seed + 11, Math.round(h * 0.45));
    outside?.(p);
  });
  // Glass catches a pale streak by day.
  if (light.night < 0.5) p.alpha(0.35, () => p.line("#ffffff", x + 3, y + h - 6, x + 10, y + 1));
  // Mullions and the sill.
  p.rect(t.front(frame), x + Math.floor(w / 2) - 1, y, 2, h);
  p.rect(t.front(frame), x, y + Math.floor(h / 2) - 1, w, 2);
  p.rect(ink(t), x - 5, y + h + 2, w + 10, 5);
  p.rect(t.top(mixHex(frame, CREAM, 0.15)), x - 4, y + h + 2, w + 8, 2);
  p.rect(t.front(mixHex(frame, INK, 0.15)), x - 4, y + h + 4, w + 8, 2);
}

/** A bulb on a cord from the ceiling, its shade, and (after dark) its glow. Returns the bulb's centre. */
export function hangingLamp(p: Painter, t: Tone, x: number, top: number, drop: number, shade = "#3f4a47") {
  const on = t.light.night > 0.15 || t.light.weather === "rain" || t.light.weather === "fog";
  p.rect(ink(t), x, top, 1, drop);
  const y = top + drop;
  p.rect(ink(t), x - 7, y - 1, 15, 7);
  p.poly(t.top(shade), [x - 6, y + 5, x - 3, y, x + 4, y, x + 7, y + 5]);
  p.rect(t.top(mixHex(shade, CREAM, 0.2)), x - 3, y, 7, 1);
  p.rect(on ? "#fff0c0" : t.shade("#d8d0bc"), x - 2, y + 5, 5, 2);
  return { x, y: y + 6, on };
}

/** A notched dark chip, the arcade's label plate. */
export function chip(p: Painter, x: number, y: number, w: number, h: number, face = "#2a2224") {
  p.rect(face, x + 1, y, w - 2, h);
  p.rect(face, x, y + 1, w, h - 2);
  p.alpha(0.3, () => {
    p.rect(CREAM, x + 2, y + 1, w - 4, 1);
  });
}

/**
 * A timing gauge: a track, the band to stop in and the needle. `cursor` 0..1,
 * `band` the half-width of the good zone as a share of the track.
 */
export function gauge(p: Painter, cx: number, y: number, half: number, cursor: number, band: number) {
  chip(p, cx - half - 8, y, half * 2 + 16, 16);
  p.rect("#4c3c39", cx - half, y + 6, half * 2, 4);
  const b = Math.round(band * half);
  p.rect("#5f7a5a", cx - b, y + 4, b * 2, 8);
  p.rect("#8fb07f", cx - b, y + 4, b * 2, 1);
  const nx = cx - half + Math.round(clamp01(cursor) * half * 2);
  p.rect(INK, nx - 2, y + 1, 5, 14);
  p.rect(CREAM, nx - 1, y + 2, 3, 12);
}

/** A sprite grid lit for a tone, set with its bottom-centre at (x, y). */
export function stand(p: Painter, t: Tone, grid: readonly string[], palette: Palette, x: number, y: number, face?: number, flip = false) {
  const w = grid[0].length;
  p.sprite(grid, t.palette(palette, face), Math.round(x - w / 2), y - grid.length + 1, flip);
}

/** A seeded choice. */
export const pick = <T>(list: readonly T[], a: number, b = 0, seed = 0) => list[Math.floor(noise(a, b, seed) * list.length) % list.length];

/** The season's grass, leaf and soil colours. */
export const SEASON_GREENS: Record<string, { grass: string; grassAlt: string; leaf: string; leafLit: string; far: string; blossom?: string }> = {
  spring: { grass: "#8fa66d", grassAlt: "#9fb47a", leaf: "#6f9260", leafLit: "#a9c48a", far: "#9fb08e", blossom: "#f0b8c0" },
  summer: { grass: "#7f9a5e", grassAlt: "#8ea96a", leaf: "#5f8552", leafLit: "#97b878", far: "#8ea482" },
  autumn: { grass: "#a39a62", grassAlt: "#b0a36b", leaf: "#c0793f", leafLit: "#e0a457", far: "#b4a07c" },
  winter: { grass: "#c9cbc4", grassAlt: "#dcdcd4", leaf: "#7d8a78", leafLit: "#a7b0a0", far: "#b8bcb8" },
};
