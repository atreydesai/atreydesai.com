/**
 * One room bake as plain data: which shop, its layout and decor, the hour,
 * season and weather, and the canvas width. The same function runs in the
 * bake worker and, where workers aren't available, on the main thread; it
 * returns transferable buffers.
 */
import { lightAt } from "../../../core/light.ts";
// Only the decor table: the worker carries no more of the game's content than it draws.
import { DECOR } from "../../content/cosmetics.ts";
import type { Placement } from "../../engine/state.ts";
import { bakeRoom, composeRoom, type BakedRoom } from "./scene.ts";
import { venueFor, stationProps } from "./venues/index.ts";
import { placeDecor } from "./decor.ts";
import type { AtlasFrame } from "../../../core/atlas.ts";

export interface BakeJob {
  shop: string;
  cols: number;
  rows: number;
  layout: Record<string, [number, number]>;
  decor: Placement[];
  hour: number;
  season: string;
  weather: string;
  width: number;
  /** Bake the people-free frame flat (a thumbnail) instead of layers. */
  flat?: boolean;
}

export interface BakeResult {
  width: number;
  height: number;
  grid: BakedRoom["grid"];
  horizon: number;
  silhouette: number[];
  sprites: BakedRoom["sprites"];
  frames: [string, AtlasFrame][];
  background: Uint8ClampedArray<ArrayBuffer>;
  overhead: Uint8ClampedArray<ArrayBuffer>;
  atlas: Uint8ClampedArray<ArrayBuffer>;
  atlasWidth: number;
  atlasHeight: number;
}

export function runBake(job: BakeJob): BakeResult {
  const venue = venueFor(job.shop, { cols: job.cols, rows: job.rows, hour: () => job.hour });
  const light = lightAt({ hour: job.hour, season: job.season, weather: job.weather, indoor: true });
  const outdoor = lightAt({ hour: job.hour, season: job.season, weather: job.weather, indoor: false });
  const decor = placeDecor(job.decor, DECOR, venue.cols, venue.rows, () => job.hour, venue.wallHeight);
  const dressed = decor.wall.length ? { ...venue, wallItems: [...venue.wallItems, ...decor.wall] } : venue;
  const room = bakeRoom({ venue: dressed, light, outdoor, width: job.width, props: [...stationProps(venue, job.layout, job.shop), ...decor.props] });
  const background = job.flat ? composeRoom(room, venue, []).data : room.background.data;
  return {
    width: room.width,
    height: room.height,
    grid: room.grid,
    horizon: room.horizon,
    silhouette: room.silhouette,
    sprites: room.sprites,
    frames: [...room.frames],
    background,
    overhead: room.overhead.data,
    atlas: room.atlas.data,
    atlasWidth: room.atlas.width,
    atlasHeight: room.atlas.height,
  };
}
