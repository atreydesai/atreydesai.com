/**
 * A plain room in a shop's own colours: what a venue looks like until it has
 * its own build. Plaster over a wainscot, plank floor, one window each side.
 */
import { mixHex } from "../../../../core/color.ts";
import { SHOPS } from "../../../content/shops.ts";
import { planks, plaster, shiplap, ground } from "../surfaces.ts";
import type { Venue } from "../types.ts";
import type { VenueOptions } from "./index.ts";
import { menuBoard, shelf, clock } from "../walls.ts";

export function genericVenue(id: string, o: VenueOptions): Venue {
  const shop = SHOPS.find((s) => s.id === id);
  const [a, b, c] = shop?.palette ?? ["#b88a70", "#667e6e", "#dac29a"];
  const grass = ground("#7f9a62", "#86a368", "#9bb67a", 0.08, 5);
  return {
    id,
    cols: o.cols,
    rows: o.rows,
    floor: planks("#9a7458", "#a07a5c", "#6e5040", "#8a6650"),
    wall: plaster(mixHex(c, "#ffffff", 0.1), c),
    wainscot: { surface: shiplap(b, mixHex(b, "#ffffff", 0.08), mixHex(b, "#2b2126", 0.3)), height: 22, rail: a },
    cap: mixHex(c, "#ffffff", 0.3),
    slab: "#8a7468",
    windows: [
      { wall: "right", at: 1.5, width: 2, sill: 26, top: 58, bars: 1, transom: 10 },
      { wall: "left", at: 2, width: 2, sill: 26, top: 58, bars: 1, transom: 10 },
    ],
    doors: [],
    lamps: [{ kind: "pendant", x: o.cols / 2, y: o.rows / 2, z: 56, reach: 3 }],
    wallItems: [menuBoard("right", o.cols - 2.4, 40), shelf("left", 0.4, 36), clock("right", 4.2, 62, o.hour)],
    props: [],
    counter: { top: "#c59a6e", front: "#8a604c", side: "#634640", trim: "#a5785a", panel: "drawers" },
    outside: {
      ground: (x, y) => grass.colors[grass.at(x * 24, y * 24)],
      view: (_u, v, light) => (v < 0.3 ? light.lit("#6f8b62", 0.5) : light.sky[v < 0.7 ? 2 : 1]),
    },
    entry: [o.cols - 1, o.rows + 1],
    queue: [
      [o.cols - 1.5, o.rows - 1],
      [o.cols - 1, o.rows - 0.5],
      [o.cols - 0.5, o.rows + 0.5],
    ],
    pickup: [o.cols - 2, o.rows - 2],
  };
}
