// Daylight as a palette, not an overlay. A scene keeps flat base colours for
// its materials; `lightAt` says how the hour, the season and the weather
// light them, and `Light.lit` turns a base colour and how squarely a face
// meets the sun into the colour to paint. Shadows lean cool toward the sky
// and sunlit faces warm toward the sun, the way painters light a room, so
// a counter is a different colour at ten in the morning, at six in the
// evening and under the lamps at night.
//
// Lights are quantised into buckets (a few per hour) and memoised, so a
// scene re-bakes its static layers only when the bucket changes and every
// colour is mixed once per bucket. DOM-free.

import { hexToRgb, rgbToHex, type RGB } from "./color.ts";

export type Weather = "sun" | "rain" | "snow" | "fog" | "wind" | "night" | string;
export type SeasonName = "spring" | "summer" | "autumn" | "winter" | string;

export interface LightInput {
  /** Hour of the day, 0..24 (fractional). */
  hour: number;
  season?: SeasonName;
  weather?: Weather;
  /** Indoors the lamps hold the ambient up after dark; outdoors they don't. */
  indoor?: boolean;
}

export interface Light {
  readonly key: string;
  readonly hour: number;
  readonly season: SeasonName;
  readonly weather: Weather;
  readonly indoor: boolean;
  /** 0 full day .. 1 full night (lamps on, windows lit). */
  readonly night: number;
  /** 0..1 how much direct sun reaches anything. */
  readonly sun: number;
  /** -1 sunrise (east) .. 0 noon (south) .. 1 sunset (west). */
  readonly azimuth: number;
  /**
   * Toward the sun along the ground, in tile axes. The camera looks north
   * over the room: east is screen right (+x, -y), south toward the viewer
   * (+x, +y), west screen left (-x, +y).
   */
  readonly sunDir: readonly [number, number];
  /** 0 at the horizon .. 1 overhead. */
  readonly elevation: number;
  /** Multiplier for unlit surfaces, per channel. */
  readonly ambient: RGB;
  /** Colour of the direct light, per channel (0..1.3). */
  readonly sunColor: RGB;
  /** Sky from top to horizon. */
  readonly sky: readonly [string, string, string];
  /** Lamp glow colour. */
  readonly lamp: string;
  /** Base colour lit: `face` 0 is in shade, 1 squarely sunlit; `glow` adds lamp light. */
  lit(hex: string, face?: number, glow?: number): string;
}

const SUN_TIMES: Record<string, [number, number]> = {
  spring: [6.5, 19.5],
  summer: [5.75, 20.75],
  autumn: [7, 18.75],
  winter: [7.5, 17],
};

/** Steps per hour a light is quantised to. Four keeps a shift's light changing every few real seconds. */
export const LIGHT_STEPS_PER_HOUR = 4;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mixColor = (a: string, b: string, t: number) => rgbToHex(mix3(hexToRgb(a), hexToRgb(b), clamp01(t)));

const cache = new Map<string, Light>();

/** The light for an hour, season and weather, quantised and shared. */
export function lightAt({ hour, season = "spring", weather = "sun", indoor = true }: LightInput): Light {
  const forcedNight = weather === "night";
  const h = forcedNight ? Math.max(hour, 20.5) : hour;
  const q = Math.round((((h % 24) + 24) % 24) * LIGHT_STEPS_PER_HOUR) / LIGHT_STEPS_PER_HOUR;
  const key = `${q}|${season}|${weather}|${indoor ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const light = makeLight(q, season, weather, indoor, key);
  if (cache.size > 400) cache.clear();
  cache.set(key, light);
  return light;
}

function makeLight(hour: number, season: SeasonName, weather: Weather, indoor: boolean, key: string): Light {
  const [rise, set] = SUN_TIMES[season] ?? SUN_TIMES.spring;
  const noon = (rise + set) / 2;
  const half = (set - rise) / 2;
  // Elevation: a sine arc between sunrise and sunset, a little under zero outside it.
  const arc = (hour - noon) / half;
  const peak = season === "summer" ? 0.78 : season === "winter" ? 0.4 : 0.6;
  const elevation = Math.abs(arc) <= 1 ? Math.cos((arc * Math.PI) / 2) * peak : 0;
  const azimuth = Math.max(-1, Math.min(1, arc));
  // Night falls from just before sunset to an hour after (mirrored at dawn).
  const night = smooth(set - 0.2, set + 1.1, hour) + (1 - smooth(rise - 1.1, rise + 0.2, hour));
  const nightness = clamp01(night);
  // Low sun is warm: pale gold through the first hours, deepening to orange over the last three.
  const morning = (1 - smooth(rise + 0.2, rise + 3.2, hour)) * (1 - nightness);
  const evening = smooth(set - 3.2, set - 0.1, hour) * (1 - nightness);
  const golden = Math.max(evening, morning * 0.6);

  let sun = clamp01(elevation * 2.6) * (1 - nightness);
  const daySun: RGB = [1.1, 1.06, 0.96];
  const morningSun: RGB = [1.16, 1.02, 0.84];
  const eveningSun: RGB = [1.3, 0.9, 0.58];
  let sunColor = mix3(mix3(daySun, morningSun, morning), eveningSun, evening);
  const dayAmbient: RGB = indoor ? [0.9, 0.88, 0.86] : [0.82, 0.84, 0.9];
  const morningAmbient: RGB = indoor ? [0.86, 0.86, 0.9] : [0.78, 0.82, 0.92];
  const duskAmbient: RGB = indoor ? [0.8, 0.72, 0.78] : [0.74, 0.64, 0.76];
  const nightAmbient: RGB = indoor ? [0.56, 0.53, 0.62] : [0.4, 0.43, 0.58];
  let ambient = mix3(mix3(mix3(dayAmbient, morningAmbient, morning), duskAmbient, evening), nightAmbient, nightness);

  let sky: [string, string, string] = [
    mixColor(mixColor("#9fbcc9", "#b7a6c4", golden), "#262741", nightness),
    mixColor(mixColor("#c8d6d2", "#e3b0a0", golden), "#3a3552", nightness),
    mixColor(mixColor("#e8e2cf", "#f2c58f", golden), "#5a4a5c", nightness),
  ];

  if (weather === "rain") {
    sun *= 0.18;
    ambient = mix3(ambient, [0.74, 0.78, 0.84], 0.6);
    sky = [mixColor(sky[0], "#7f8590", 0.75), mixColor(sky[1], "#9a9ea6", 0.75), mixColor(sky[2], "#b3b4b4", 0.7)];
  } else if (weather === "fog") {
    sun *= 0.35;
    ambient = mix3(ambient, [0.88, 0.88, 0.88], 0.5);
    sky = [mixColor(sky[0], "#c9c8c2", 0.7), mixColor(sky[1], "#d6d3ca", 0.75), mixColor(sky[2], "#dedad0", 0.8)];
  } else if (weather === "snow") {
    sun *= 0.55;
    ambient = mix3(ambient, [0.95, 0.96, 1.02], 0.45);
    sunColor = mix3(sunColor, [1.05, 1.05, 1.08], 0.5);
    sky = [mixColor(sky[0], "#b9c3cc", 0.55), mixColor(sky[1], "#d7dde0", 0.55), mixColor(sky[2], "#eceeea", 0.55)];
  }

  const phi = ((azimuth + 1) / 2) * Math.PI;
  const sunDir: [number, number] = [(Math.cos(phi) + Math.sin(phi)) / Math.SQRT2, (Math.sin(phi) - Math.cos(phi)) / Math.SQRT2];
  const lamp = "#ffcf8a";
  const memo = new Map<string, string>();
  const ambientShadow: RGB = mix3(hexToRgb(sky[0]).map((c) => c / 255) as RGB, [1, 1, 1], 0.55);

  return {
    key,
    hour,
    season,
    weather,
    indoor,
    night: nightness,
    sun,
    azimuth,
    sunDir,
    elevation,
    ambient,
    sunColor,
    sky,
    lamp,
    lit(hex: string, face = 0.5, glow = 0) {
      const k = `${hex}|${face}|${glow}`;
      const hit = memo.get(k);
      if (hit) return hit;
      const base = hexToRgb(hex);
      const direct = sun * clamp01(face);
      const g = clamp01(glow) * nightness;
      const out: RGB = [0, 0, 0];
      for (let i = 0; i < 3; i++) {
        // Shade takes the sky's coolness; the lit part takes the sun's colour.
        const shade = ambient[i] * (0.8 + 0.2 * ambientShadow[i]);
        const m = shade * (1 - direct * 0.12) + sunColor[i] * direct * 0.46 + [1.0, 0.78, 0.48][i] * g * 0.55;
        out[i] = Math.max(0, Math.min(255, base[i] * m));
      }
      const color = rgbToHex(out);
      memo.set(k, color);
      return color;
    },
  };
}

/** Hour of the shop's day for a shift `progress` 0..1: doors at ten, last call at nine. */
export function shiftHour(progress: number, open = 10, close = 21) {
  return open + (close - open) * clamp01(progress);
}

/** Before a shift the shop is lit as a morning, between shifts as a late evening. */
export const PLANNING_HOUR = 8.75;
