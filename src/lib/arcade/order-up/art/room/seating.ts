/**
 * Somewhere to sit with a cup: small tables with chairs round them, stools
 * at a ledge along the inside of a low front wall (looking out), a lone
 * stool, a bench. Each builder returns the furniture as props and the seats
 * as data, so the room draws one and the cast uses the other.
 *
 * Every piece is its own prop and sorts by its own middle: a chair's seat
 * and back, a table, a stretch of ledge. So a sitter is drawn over the chair
 * they sit on and behind the table in front of them, and someone sitting
 * with their back to us is drawn behind their chair's back.
 */
import { mixHex } from "../../../core/color.ts";
import { isoBox, project, faceLight, type IsoGrid } from "../../../core/iso.ts";
import type { Light } from "../../../core/light.ts";
import type { Painter } from "../../../core/painter.ts";
import type { PropSpec, Seat } from "./types.ts";
import { INK } from "./props.ts";

export interface FurnitureStyle {
  /** Frames and legs. */
  wood: string;
  /** The seat: a cushion, a woven seat, a painted one. */
  seat: string;
  /** The table top, when it differs from the wood. */
  top?: string;
  /** Thin metal legs (bar stools, cafe chairs) instead of wooden ones. */
  metal?: string;
  /** Chair shape: a slatted back, a round wicker tub, a log stump with no back. */
  chair?: "slat" | "tub" | "stump";
}

export interface Seating {
  props: PropSpec[];
  seats: Seat[];
}

export type Side = "-x" | "-y" | "+x" | "+y";

const FACE: Record<Side, [number, number]> = { "-x": [1, 0], "-y": [0, 1], "+x": [-1, 0], "+y": [0, -1] };

/** A small prop whose depth is its own middle (plus `lift`), not its far corner. */
function piece(key: string, cx: number, cy: number, w: number, d: number, height: number, draw: PropSpec["draw"], lift = 0): PropSpec {
  return { key, x: cx - w / 2, y: cy - d / 2, w, d, height, pad: 4, shadow: "none", depthBias: 1 - w / 2 - d / 2 + lift, draw };
}

/** Lit colour for a face of furniture. */
const lit = (light: Light, hex: string, face: number) => light.lit(hex, face);

/** A stool or chair seat with legs, at the middle of its local box (`w` by `d`), `h` pixels up. */
function seatBody(p: Painter, g: IsoGrid, light: Light, w: number, d: number, h: number, style: FurnitureStyle, share: number) {
  const legs = style.metal ?? mixHex(style.wood, INK, 0.25);
  const f = faceLight(light, share);
  if (style.chair === "stump") {
    // A log end: bark sides, a pale ring on top.
    isoBox(p, g, light, w * 0.18, d * 0.18, w * 0.64, d * 0.64, h, { top: mixHex(style.seat, "#f1dfb4", 0.35), left: style.wood, right: mixHex(style.wood, INK, 0.2) }, 0, share);
    return;
  }
  for (const [u, v] of [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]]) {
    const a = project(g, w * u, d * v, 0);
    p.rect(lit(light, legs, f.left * 0.6), a.x, a.y - h + 1, 1, h);
  }
  if (style.chair === "tub") {
    isoBox(p, g, light, w * 0.1, d * 0.1, w * 0.8, d * 0.8, 3, { top: style.seat, left: mixHex(style.wood, "#fff1dd", 0.1), right: style.wood }, h - 3, share);
    return;
  }
  isoBox(p, g, light, w * 0.12, d * 0.12, w * 0.76, d * 0.76, 2, { top: style.seat, left: mixHex(style.seat, INK, 0.25) }, h - 2, share);
}

/** A chair's back: a thin panel `h` pixels tall on top of the seat, along one side of the local box. */
function chairBack(p: Painter, g: IsoGrid, light: Light, w: number, d: number, seat: number, style: FurnitureStyle, share: number) {
  const tall = style.chair === "tub" ? 7 : 11;
  const color = style.chair === "tub" ? style.wood : mixHex(style.wood, "#fff1dd", 0.05);
  isoBox(p, g, light, 0, 0, w, d, tall, { top: color, left: color, right: mixHex(color, INK, 0.2) }, seat, share);
  if (style.chair !== "tub") {
    // Two rails across the slats.
    const a = project(g, w / 2, d / 2, seat + tall - 3);
    p.rect(lit(light, mixHex(color, INK, 0.3), 0), a.x - 1, a.y, 3, 1);
  }
}

/**
 * A table with chairs on the given sides. (x, y) is the table's middle; a
 * chair sits 0.6 tiles out on each side, facing it. Chairs on the -x and -y
 * sides face us across the table; those on +x and +y show their backs.
 */
export function cafeTable(id: string, x: number, y: number, sides: Side[], style: FurnitureStyle, opts: { outside?: boolean; share?: number; size?: number; dog?: Partial<Record<Side, [number, number]>> } = {}): Seating {
  const share = opts.share ?? 0.4;
  const pre = (opts.outside ? "out:" : "") + "seat:" + id;
  const size = opts.size ?? 0.56;
  const top = style.top ?? style.wood;
  const props: PropSpec[] = [
    piece(pre + ":table", x, y, size, size, 22, (p, g, light) => {
      const f = faceLight(light, share);
      const c = project(g, size / 2, size / 2, 0);
      const z = 13;
      // A pedestal and a foot, then a round top with a darker rim.
      p.oval(lit(light, mixHex(style.wood, INK, 0.35), 0), c.x, c.y, 4, 2);
      p.rect(lit(light, mixHex(style.wood, INK, 0.2), f.left * 0.5), c.x - 1, c.y - z, 2, z);
      const r = size * 24 * 0.62;
      p.oval(lit(light, mixHex(top, INK, 0.45), 0), c.x, c.y - z + 1, r + 1, r / 2 + 1);
      p.oval(lit(light, mixHex(top, INK, 0.15), f.left * 0.5), c.x, c.y - z + 1, r, r / 2);
      p.oval(lit(light, top, f.top), c.x, c.y - z, r, r / 2);
      p.rect(lit(light, mixHex(top, "#fff4dc", 0.35), Math.min(1, f.top + 0.2)), c.x - Math.round(r / 2), c.y - z - Math.round(r / 4), Math.round(r / 2), 1);
    }),
  ];
  const seats: Seat[] = [];
  sides.forEach((side, i) => {
    const [fx, fy] = FACE[side];
    const sx = x - fx * 0.6;
    const sy = y - fy * 0.6;
    const seatId = id + ":" + i;
    const key = pre + ":" + i;
    const w = 0.34;
    const h = style.chair === "stump" ? 6 : 7;
    props.push(piece(key + ":seat", sx, sy, w, w, 12, (p, g, light) => seatBody(p, g, light, w, w, h, style, share), -0.05));
    const pieces = [key + ":seat"];
    if (style.chair !== "stump") {
      // The back stands on the side away from the table.
      const bw = fx ? 0.06 : w;
      const bd = fx ? w : 0.06;
      const bx = sx - fx * 0.15;
      const by = sy - fy * 0.15;
      props.push(piece(key + ":back", bx, by, bw, bd, h + 14, (p, g, light) => chairBack(p, g, light, bw, bd, h, style, share)));
      pieces.push(key + ":back");
    }
    // A dog lies beside the chair, away from the table.
    const dog = opts.dog?.[side] ?? ([sx - fy * 0.5 - fx * 0.2, sy - fx * 0.5 - fy * 0.2] as [number, number]);
    seats.push({ id: seatId, x: sx, y: sy, face: [fx, fy], height: h, table: id, dog, pieces });
  });
  return { props, seats };
}

/**
 * Stools at a ledge along the inside of a low front wall, looking out:
 * the front-left wall runs along y = rows, the front-right along x = cols.
 * The ledge caps the wall's inner side, so it reads as a window counter.
 */
export function windowBar(id: string, edge: "front-left" | "front-right", from: number, to: number, stools: number, size: { cols: number; rows: number; wall: number }, style: FurnitureStyle, share = 0.4): Seating {
  const along = edge === "front-left";
  const props: PropSpec[] = [];
  const seats: Seat[] = [];
  const line = along ? size.rows : size.cols;
  const depth = 0.3;
  const z = size.wall;
  // The ledge in pieces a tile long or less, each sorting in front of whoever sits at it.
  for (let a = from; a < to - 1e-6; a = Math.min(to, Math.floor(a) + 1)) {
    const b = Math.min(to, Math.floor(a) + 1);
    const len = b - a;
    const cx = along ? (a + b) / 2 : line - 0.14 - depth / 2;
    const cy = along ? line - 0.14 - depth / 2 : (a + b) / 2;
    const w = along ? len : depth;
    const d = along ? depth : len;
    props.push(
      piece(`seat:${id}:ledge${a.toFixed(2)}`, cx, cy, w, d, z + 6, (p, g, light) => {
        isoBox(p, g, light, 0, 0, w, d, 2, { top: style.top ?? style.wood, left: mixHex(style.wood, INK, 0.2) }, z, share);
        // A bracket under each end.
        const s = project(g, along ? 0.1 : depth / 2, along ? depth / 2 : 0.1, z - 4);
        p.rect(lit(light, mixHex(style.wood, INK, 0.35), 0), s.x, s.y, 1, 4);
      }, 0.35),
    );
  }
  const step = (to - from) / stools;
  for (let i = 0; i < stools; i++) {
    const t = from + step * (i + 0.5);
    const sx = along ? t : line - 0.72;
    const sy = along ? line - 0.72 : t;
    const key = `seat:${id}:${i}`;
    const w = 0.3;
    const h = Math.max(8, z - 5);
    props.push(piece(key + ":seat", sx, sy, w, w, h + 3, (p, g, light) => seatBody(p, g, light, w, w, h, { ...style, chair: "slat" }, share), -0.05));
    seats.push({
      id: id + ":" + i,
      x: sx,
      y: sy,
      face: along ? [0, 1] : [1, 0],
      height: h,
      // Neighbours at the ledge sit together, like a table.
      table: id,
      dog: along ? [sx, sy - 0.5] : [sx - 0.5, sy],
      pieces: [key + ":seat"],
    });
  }
  return { props, seats };
}

/** A lone stool (decor from the ledger) at the middle of a tile, facing us. */
export function stoolSeat(key: string, tx: number, ty: number, color: string, share = 0.4): Seating {
  const sx = tx + 0.5;
  const sy = ty + 0.5;
  const w = 0.34;
  const style: FurnitureStyle = { wood: mixHex(color, INK, 0.35), seat: color, chair: "slat" };
  return {
    props: [piece(key, sx, sy, w, w, 12, (p, g, light) => seatBody(p, g, light, w, w, 8, style, share), -0.05)],
    seats: [{ id: key, x: sx, y: sy, face: [1, 0], height: 8, dog: [sx - 0.1, sy + 0.42], pieces: [key] }],
  };
}

/** Joins several seatings into one. */
export function seating(...parts: Seating[]): Seating {
  return { props: parts.flatMap((s) => s.props), seats: parts.flatMap((s) => s.seats) };
}
