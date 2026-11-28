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
  /** No glass in it: an open doorway (a rolled-up dock door) showing the outside, without the glare. */
  open?: boolean;
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
  /** Added to its depth among the people: a low front wall sorts in front of whoever stands just inside it. */
  depthBias?: number;
}

/**
 * The doorway guests come and go through: the wall it is cut in and its span
 * along that wall, in tiles. "left" and "right" are the back walls (x = 0 and
 * y = 0); "front-left" runs along y = rows and "front-right" along x = cols.
 */
export interface Doorway {
  wall: WallSide | "front-left" | "front-right";
  from: number;
  to: number;
}

/**
 * A place to sit: where the sitter's feet go, the way they face (one step
 * along x or y: toward their table, out of the window), and how high the
 * seat is. Seats round one table share `table`, so a couple or a parent and
 * child sit together; `dog` is where a dog lies beside it. `pieces` are the
 * keys of the seat's own chair or stool, which only its sitter may walk into.
 */
export interface Seat {
  id: string;
  x: number;
  y: number;
  face: [number, number];
  height: number;
  table?: string;
  dog?: [number, number];
  pieces: string[];
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
  /** Where guests come in, wait and leave, in tiles: where they appear and vanish, the spots in line (front first), and where they wait for their cup. */
  entry: [number, number];
  queue: [number, number][];
  pickup: [number, number];
  /** Where guests sit with their cup: chairs at tables, stools at a window ledge (the furniture is in `props` or `outside.props`). */
  seats?: Seat[];
  /** The doorway they use, or null when they stay outside and are served through a hatch. */
  doorway?: Doorway | null;
  /** From `entry` to the far end of the queue: the points they walk through, by the door. */
  way?: [number, number][];
  /** From pickup back out to `entry`: the points they walk through on the way out (`way` in reverse when not given). */
  out?: [number, number][];
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
