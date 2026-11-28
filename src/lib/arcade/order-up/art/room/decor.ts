/**
 * The player's decor, set into the room: each piece drawn by what it is
 * (its motif's last words: a planter, a stool, a print, a clock) in its
 * theme's colour. Pieces placed against a back wall hang on it; the rest
 * stand on the floor, a print on an easel, a tin on a side table.
 */
import { mixHex } from "../../../core/color.ts";
import { isoBox, isoTile, project } from "../../../core/iso.ts";
import type { Placement } from "../../engine/state.ts";
import type { Decor } from "../../content/schema.ts";
import type { PropSpec, WallItem, WallSide } from "./types.ts";
import { SPRITES, litPalette, INK } from "./props.ts";
import { wallRect, framed, clock, shelf } from "./walls.ts";

const KINDS = [
  "window-plant", "umbrella-pot", "planter-box", "low-stool", "cushion", "floor-mat", "table-runner", "tea-shelf",
  "shelf-tray", "bookend", "tea-tin", "small-vase", "counter-tile", "wall-tile", "wall-print", "menu-frame", "clock",
  "curtain", "bunting", "pendant-shade",
] as const;
type Kind = (typeof KINDS)[number];
const WALL_KINDS = new Set<Kind>(["wall-tile", "wall-print", "menu-frame", "clock", "curtain", "bunting", "pendant-shade", "tea-shelf"]);

export function decorKind(motif: string): Kind | null {
  for (const k of KINDS) if (motif.endsWith(k)) return k;
  return null;
}

/** Splits placed decor into wall pieces (baked with the walls) and standing props. */
export function placeDecor(placements: readonly Placement[], catalogue: readonly Decor[], cols: number, rows: number, hour: () => number, wallHeight = 80) {
  const props: PropSpec[] = [];
  const wall: WallItem[] = [];
  placements.forEach((pl, i) => {
    const d = catalogue.find((x) => x.id === pl.id);
    if (!d) return;
    const kind = decorKind(d.art.motif) ?? "window-plant";
    const color = d.art.color;
    const nearWall: WallSide | null = pl.y <= 0 ? "right" : pl.x <= 0 ? "left" : null;
    if (WALL_KINDS.has(kind) && nearWall) {
      const at = nearWall === "right" ? pl.x + 0.2 : pl.y + 0.2;
      wall.push(wallPiece(kind, nearWall, at, color, hour, wallHeight));
      return;
    }
    props.push(standing(kind, "decor:" + i + ":" + d.id, Math.min(cols - 1, Math.max(0, pl.x)), Math.min(rows - 1, Math.max(0, pl.y)), color));
  });
  return { props, wall };
}

function wallPiece(kind: Kind, wall: WallSide, at: number, color: string, hour: () => number, wallHeight: number): WallItem {
  // Nothing hangs higher than the wall it's on.
  const top = Math.min(80, wallHeight - 2);
  const z = (want: number) => Math.min(want, wallHeight - 14);
  if (kind === "clock") return clock(wall, at + 0.3, z(56), hour, mixHex(color, INK, 0.3));
  if (kind === "tea-shelf") return shelf(wall, at, z(40), 26, ["tin", "jar", "tin"], mixHex(color, INK, 0.2));
  if (kind === "bunting")
    return {
      wall,
      at,
      z: top - 10,
      draw(p, light, place) {
        for (let k = 0; k < 6; k++) {
          const a = k * 6;
          const x = place.x + place.dir * a;
          const y = place.y + place.slope * a + (k % 2);
          p.poly(light.lit(k % 2 ? color : mixHex(color, "#fff1dd", 0.5), 0.3), [x, y, x + place.dir * 5, y + place.slope * 5, x + place.dir * 2.5, y + 5]);
        }
      },
    };
  if (kind === "curtain")
    return {
      wall,
      at,
      z: 26,
      draw(p, light, place) {
        for (let k = 0; k < 12; k++) wallRect(p, place, k * 1.5, 0, 1.5, 36, light.lit(k % 3 ? color : mixHex(color, INK, 0.25), 0.2));
      },
    };
  if (kind === "pendant-shade")
    return {
      wall,
      at,
      z: 0,
      draw(p, light, place) {
        const shade = Math.min(58, top - 8);
        p.line(light.lit(INK, 0), place.x, place.y - top, place.x, place.y - shade);
        p.poly(light.lit(color, 0.3), [place.x - 3, place.y - shade, place.x + 3, place.y - shade, place.x + 6, place.y - shade + 5, place.x - 6, place.y - shade + 5]);
      },
    };
  if (kind === "wall-tile")
    return {
      wall,
      at,
      z: 30,
      draw(p, light, place) {
        for (let k = 0; k < 4; k++) for (let r = 0; r < 3; r++) wallRect(p, place, k * 5, r * 5, 4, 4, light.lit((k + r) % 2 ? color : mixHex(color, "#fff1dd", 0.45), 0.2));
      },
    };
  // A print or a menu frame.
  return framed(wall, at, z(kind === "menu-frame" ? 32 : 38), kind === "menu-frame" ? 14 : 12, 14, (p, light, x, y) => {
    p.rect(light.lit(color, 0.3), x - 4, y - 3, 8, 6);
    p.rect(light.lit(mixHex(color, "#fff1dd", 0.4), 0.3), x - 2, y - 1, 3, 2);
  });
}

function standing(kind: Kind, key: string, x: number, y: number, color: string): PropSpec {
  const pot = { P: color };
  const tableTop = (p: Parameters<PropSpec["draw"]>[0], g: Parameters<PropSpec["draw"]>[1], light: Parameters<PropSpec["draw"]>[2]) => {
    isoBox(p, g, light, 0.3, 0.3, 0.4, 0.4, 12, { top: "#a07a5c" }, 0, 0.4);
  };
  const on = (p: Parameters<PropSpec["draw"]>[0], g: Parameters<PropSpec["draw"]>[1], light: Parameters<PropSpec["draw"]>[2], name: string, z: number, recolor: Record<string, string>) => {
    const s = SPRITES[name];
    const at = project(g, 0.5, 0.5, z);
    p.sprite(s.grid, litPalette({ ...s.palette, ...recolor }, light, 0.4), at.x - Math.floor(s.grid[0].length / 2), at.y - s.grid.length + 1);
  };
  const flat = kind === "floor-mat" || kind === "table-runner";
  return {
    key,
    x,
    y,
    height: flat ? 4 : 30,
    flat,
    draw(p, g, light) {
      switch (kind) {
        case "floor-mat":
        case "table-runner":
          isoTile(p, g, 0.1, 0.15, 0.8, 0.7, light.lit(mixHex(color, INK, 0.3), 0.3));
          isoTile(p, g, 0.15, 0.2, 0.7, 0.6, light.lit(color, 0.4));
          isoTile(p, g, 0.3, 0.35, 0.4, 0.3, light.lit(mixHex(color, "#fff1dd", 0.35), 0.4));
          break;
        case "low-stool":
          isoBox(p, g, light, 0.32, 0.32, 0.36, 0.36, 9, { top: color }, 0, 0.4);
          break;
        case "cushion":
          isoBox(p, g, light, 0.25, 0.25, 0.5, 0.5, 4, { top: color, lip: mixHex(color, "#fff1dd", 0.4) }, 0, 0.4);
          break;
        case "planter-box":
          isoBox(p, g, light, 0.15, 0.3, 0.7, 0.4, 8, { top: "#6a4c3c", left: color, right: mixHex(color, INK, 0.2) }, 0, 0.4);
          on(p, g, light, "plant", 8, { P: color });
          break;
        case "umbrella-pot":
        case "window-plant":
          on(p, g, light, kind === "window-plant" ? "plant" : "monstera", 0, pot);
          break;
        case "tea-tin":
        case "bookend":
        case "shelf-tray":
        case "counter-tile":
        case "tea-shelf":
          tableTop(p, g, light);
          on(p, g, light, "tin", 12, { L: mixHex(color, "#fff1dd", 0.3), B: color });
          break;
        case "small-vase":
          tableTop(p, g, light);
          on(p, g, light, "bottle", 12, { L: mixHex(color, "#fff1dd", 0.3), B: color });
          break;
        default: {
          // A print or a clock on an easel.
          const b = project(g, 0.5, 0.5, 0);
          p.line(light.lit("#6a4c3c", 0.2), b.x - 4, b.y, b.x - 1, b.y - 20);
          p.line(light.lit("#6a4c3c", 0.2), b.x + 4, b.y, b.x + 1, b.y - 20);
          p.rect(light.lit("#5a4038", 0.3), b.x - 7, b.y - 24, 14, 12);
          p.rect(light.lit("#efe3c9", 0.4), b.x - 6, b.y - 23, 12, 10);
          p.rect(light.lit(color, 0.4), b.x - 3, b.y - 21, 6, 6);
        }
      }
    },
  };
}
