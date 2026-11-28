/**
 * Every shop's room, by id. A venue is built for the shop's grid and the
 * hour (its clock reads it); the counters are set at the shop's own layout,
 * which the player can rearrange.
 */
import type { Venue, PropSpec } from "../types.ts";
import { stationProp, type StationId } from "../props.ts";
import { truckVenue } from "./truck.ts";
import { genericVenue } from "./generic.ts";
import { cornerVenue } from "./corner.ts";
import { campusVenue } from "./campus.ts";
import { gardenVenue } from "./garden.ts";
import { nightVenue } from "./night.ts";
import { stationVenue } from "./station.ts";
import { harborVenue } from "./harbor.ts";
import { loftVenue } from "./loft.ts";
import { boardwalkVenue } from "./boardwalk.ts";
import { lodgeVenue } from "./lodge.ts";
import { commissaryVenue } from "./commissary.ts";
import { moonVenue } from "./moon.ts";

export interface VenueOptions {
  cols: number;
  rows: number;
  hour: () => number;
}

const BUILDERS: Record<string, (o: VenueOptions) => Venue> = {
  truck: (o) => truckVenue(o.cols, o.rows, o.hour),
  corner: cornerVenue,
  campus: campusVenue,
  garden: gardenVenue,
  night: nightVenue,
  station: stationVenue,
  harbor: harborVenue,
  loft: loftVenue,
  boardwalk: boardwalkVenue,
  lodge: lodgeVenue,
  commissary: commissaryVenue,
  moon: moonVenue,
};

export function venueFor(id: string, o: VenueOptions): Venue {
  return (BUILDERS[id] ?? ((x: VenueOptions) => genericVenue(id, x)))(o);
}

/** The five station counters at their places in the layout. */
export function stationProps(v: Venue, counters: Record<string, readonly [number, number] | number[]>, shop: string): PropSpec[] {
  void shop;
  const share = v.indoorSun ?? 0.4;
  return (["brew", "prep", "build", "serve", "stock"] as StationId[])
    .filter((id) => counters[id])
    .map((id) => {
      const [x, y] = counters[id];
      return stationProp(id, x, y, v.counter, share);
    });
}
