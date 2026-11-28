/**
 * What a venue is made of, as data: its floor and walls, the windows and
 * doors cut in them, what hangs on them, the lamps, the counters' build,
 * what stands about, and the world outside. `scene.ts` bakes it.
 */
import type { Painter } from "../../../core/painter.ts";
import type { IsoGrid } from "../../../core/iso.ts";
import type { Light } from "../../../core/light.ts";
import type { Surface } from "./surfaces.ts";

export type WallSide = "left" | "right";

export interface WindowSpec {
  wall: WallSide;
  /** Start along the wall, in tiles. */
  at: number;
  /** Width along the wall, in tiles. */
  width: number;
  /** Bottom and top of the glass above the floor, in pixels. */
  sill: number;
  top: number;
  /** Vertical glazing bars across the width. */
  bars?: number;
  /** A transom bar this far down from the top. */
  transom?: number;
  frame?: string;
  /** Round-topped, or a porthole. */
  shape?: "square" | "arch" | "round";
}

export interface DoorSpec {
  wall: WallSide;
  at: number;
  width?: number;
  height?: number;
  color: string;
  /** Glass in the upper half. */
  glass?: boolean;
  /** Painted word over it (a pixel word). */
  sign?: string;
}

export interface LampSpec {
  kind: "pendant" | "sconce" | "bulbs" | "lantern" | "tube" | "fire";
  /** Ground position in tiles, and height in pixels. */
  x: number;
  y: number;
  z: number;
  color?: string;
  /** Light pool radius on the floor, in tiles. */
  reach?: number;
  /** For a string of bulbs: where it runs to. */
  to?: [number, number, number];
}

/** Something hung on a wall, drawn into the baked layer. */
export interface WallItem {
  wall: WallSide;
  at: number;
  /** Height of its bottom above the floor, in pixels. */
  z: number;
  draw: (p: Painter, light: Light, place: WallPlace) => void;
}

/** A wall item's frame of reference: screen point of its bottom-left on the wall, and the wall's slope. */
export interface WallPlace {
  /** Screen x, y of (at, z) on the wall. */
  x: number;
  y: number;
  /** Screen y change per pixel along the wall (0.5: both walls run downward away from the corner). */
  slope: number;
  /** 1 for the right wall (runs down-right), -1 for the left (runs down-left). */
  dir: 1 | -1;
  wall: WallSide;
}

/** A standing thing baked once per light into the atlas and depth-sorted with the people. */
export interface PropSpec {
  key: string;
  /** Footprint back corner, in tiles. */
  x: number;
  y: number;
  w?: number;
  d?: number;
  /** Tallest point above the ground, in pixels (sets the atlas cell). */
  height: number;
  draw: (p: Painter, g: IsoGrid, light: Light) => void;
  /** Extra pixels around the footprint the drawing may spill into. */
  pad?: number;
  /** Draw before everything at the same depth (a rug-high thing). */
  flat?: boolean;
  /** The shadow it throws on the ground outside: a block (default), a round crown, or none. */
  shadow?: "box" | "round" | "none";
}

export interface CounterStyle {
  top: string;
  front: string;
  side?: string;
  trim: string;
  /** Front panel detailing. */
  panel?: "drawers" | "slats" | "tile" | "steel" | "bamboo" | "log" | "crate" | "console";
  height?: number;
}

export interface OutsideSpec {
  /** Ground colour at a ground position in tiles (anywhere outside the room); the light says the season and weather. */
  ground(x: number, y: number, light?: Light): string;
  /** The far band: skyline, trees, sea, hills, stood on `horizon`. */
  far?: (p: Painter, light: Light, width: number, horizon: number) => void;
  /** The view through a window: u pixels along the wall, v 0 (sill) .. 1 (top), the glass's height in pixels. */
  view(u: number, v: number, light: Light, wall: WallSide, height: number): string;
  /** Things standing outside, as props. */
  props?: PropSpec[];
  /** Fully indoors (a station concourse): no sun on the ground around the room. */
  covered?: boolean;
  /** Ground that never takes snow: all of it (the moon), or where this says (open water). */
  noSnow?: boolean | ((x: number, y: number) => boolean);
}

export interface FrontWall {
  height: number;
  surface?: Surface;
  color: string;
  cap: string;
  /** A painted band: colour, height, lift. */
  stripe?: [string, number, number];
  /** Tiles along each front edge left open (doorways, a hatch). */
  gapsRight?: number[];
  gapsLeft?: number[];
}

/** The shop seen from outside, front on: what the street view paints. */
export interface FacadeSpec {
  /** The outside wall's material (u along, z up, in pixels). */
  wall: Surface;
  trim: string;
  sign: { board: string; ink: string };
  /** Awning stripes, or none. */
  awning?: [string, string] | null;
  door: string;
  /** A storey above the shop (windows), or a single-storey front. */
  upper?: boolean;
  /** Paint the whole front yourself (a truck, a stall, a dome). `box` is where the shop stands. */
  paint?: (p: Painter, light: Light, box: FrontBox) => void;
  /** What stands either side: other shopfronts, or nothing (open ground). */
  neighbours?: "shops" | "none";
  /** Where along the front the line forms, as a share of its width (the door, a hatch). */
  queueAt?: number;
}

export interface FrontBox {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The pavement line. */
  ground: number;
  open: boolean;
  name: string;
  /** The recipe in the shop window. */
  display?: string;
}

export interface Venue {
  id: string;
  /** Tiles: x along the right wall, y along the left. */
  cols: number;
  rows: number;
  floor: Surface;
  wall: Surface;
  /** The right wall's paint a step darker than the left's. */
  wainscot?: { surface: Surface; height: number; rail: string };
  cap: string;
  slab: string;
  /** Height of the floor's plinth above the ground outside (a truck's floor rides high). */
  slabHeight?: number;
  wallHeight?: number;
  windows: WindowSpec[];
  doors: DoorSpec[];
  lamps: LampSpec[];
  wallItems: WallItem[];
  props: PropSpec[];
  /** Flat things on the floor (rugs, painted lines) drawn into the baked floor. */
  floorItems?: ((p: Painter, g: IsoGrid, light: Light) => void)[];
  counter: CounterStyle;
  outside: OutsideSpec;
  front?: FrontWall;
  /** Where guests come in, wait and leave, in tiles. */
  entry: [number, number];
  queue: [number, number][];
  pickup: [number, number];
  /** Paint over the baked layer after the room (a truck's cab, a canopy's poles). */
  backHook?: (p: Painter, g: IsoGrid, light: Light, width: number, height: number) => void;
  /** Extra blocks that throw shadows outside (tiles, pixels high). */
  casters?: { x: number; y: number; w: number; d: number; h: number }[];
  /** Sun reaching the counters' faces indoors (0 dark hall .. 1 open air). */
  indoorSun?: number;
  /** The street view's shopfront. */
  facade?: FacadeSpec;
  /** Things hanging from the ceiling line drawn last (bunting, bulbs, canopy edge). */
  overhead?: (p: Painter, g: IsoGrid, light: Light, time: number) => void;
}
