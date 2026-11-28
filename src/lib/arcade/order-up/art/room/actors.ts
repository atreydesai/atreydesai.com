/**
 * Who is in the room and where they are walking: the chef between counters,
 * crew at theirs, guests in from the door, along the queue, at pickup with
 * their cup ready, and back out. Positions ease toward their targets in
 * tiles per second; the walk cycle steps with distance walked. DOM-free, so
 * the room's motion is tested in node.
 */
import type { Venue } from "./types.ts";
import type { FloorState } from "../floor.ts";

export type Station = "brew" | "prep" | "build" | "serve" | "stock";

export interface Walker {
  id: string;
  name: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Distance walked, for the walk cycle. */
  walked: number;
  flip: boolean;
  role: "chef" | "crew" | "guest";
  face: string;
  slot: number;
  leaving: boolean;
  carrying: boolean;
  outside: boolean;
  /** Points to pass through, in order, before the target: the way along the line, through the door. */
  via: [number, number][];
}

const SPEED = { chef: 5.5, crew: 4, guest: 2.6 };

/** Where someone works a counter: behind it, or in front of one against the back wall. */
export function workSpot(at: readonly [number, number] | number[]): [number, number] {
  const [x, y] = at;
  return y >= 1 ? [x + 0.5, y - 0.28] : [x + 0.5, y + 1.3];
}

export function createCast() {
  const people = new Map<string, Walker>();

  let fresh = false;
  function place(id: string, init: Omit<Walker, "x" | "y" | "walked" | "flip" | "tx" | "ty" | "via"> & { x: number; y: number }) {
    let w = people.get(id);
    fresh = !w;
    if (!w) {
      w = { ...init, tx: init.x, ty: init.y, walked: 0, flip: false, via: [] };
      people.set(id, w);
    }
    return w;
  }

  /**
   * Sets everyone's targets for this moment of the shift. `snap` puts them
   * there at once (reduced motion, or the first frame).
   */
  function plan(
    v: Venue,
    layout: Record<string, readonly [number, number] | number[]>,
    station: Station,
    floor: FloorState | null,
    crew: { id: string; name: string; station: Station | null }[],
    snap = false,
    /** Where the venue's serve counter was drawn; pickup moves with the counter from there. */
    defaultServe?: readonly [number, number] | number[],
  ) {
    const seen = new Set<string>();
    const chefAt = workSpot(layout[station] ?? layout.build);
    const chef = place("chef", { id: "chef", name: "chef", x: chefAt[0], y: chefAt[1], role: "chef", face: "calm", slot: -1, leaving: false, carrying: false, outside: false });
    chef.tx = chefAt[0];
    chef.ty = chefAt[1];
    seen.add("chef");
    crew.forEach((person, i) => {
      if (!person.station || person.station === station) return;
      const spot = workSpot(layout[person.station]);
      const w = place("crew:" + person.id, { id: "crew:" + person.id, name: person.name, x: spot[0], y: spot[1], role: "crew", face: "calm", slot: -1, leaving: false, carrying: false, outside: false });
      w.tx = spot[0] + (i % 2 ? 0.2 : -0.2);
      w.ty = spot[1];
      seen.add(w.id);
    });
    if (floor) {
      const waiting = floor.orders.filter((o) => o.status === "accepted" && !o.cup?.sealed);
      const ready = floor.orders.filter((o) => o.status === "accepted" && o.cup?.sealed);
      const entry = v.entry;
      const out = (y: number) => y >= v.rows || y < 0;
      // Past the last marked spot the line carries on the way it was going.
      const last = v.queue[v.queue.length - 1];
      const before = v.queue[v.queue.length - 2] ?? entry;
      const run = Math.hypot(last[0] - before[0], last[1] - before[1]) || 1;
      const step: [number, number] = [((last[0] - before[0]) / run) * 0.5, ((last[1] - before[1]) / run) * 0.5];
      // Pickup keeps its place beside the serve counter when the counter is moved.
      const serve = layout.serve;
      const moved = defaultServe && serve && (serve[0] !== defaultServe[0] || serve[1] !== defaultServe[1]);
      const pickup: [number, number] = moved
        ? [
            Math.max(0.3, Math.min(v.cols - 0.3, v.pickup[0] + serve[0] - defaultServe[0])),
            Math.max(0.3, Math.min(v.rows + 1.5, v.pickup[1] + serve[1] - defaultServe[1])),
          ]
        : [v.pickup[0], v.pickup[1]];
      waiting.forEach((o, i) => {
        const spot = v.queue[Math.min(i, v.queue.length - 1)];
        const extra = Math.max(0, i - v.queue.length + 1);
        const w = place("g:" + o.id, { id: "g:" + o.id, name: o.customerName, x: entry[0], y: entry[1], role: "guest", face: "calm", slot: o.slot, leaving: false, carrying: false, outside: out(entry[1]) });
        // A guest who has just come in walks up the line from its far end.
        if (fresh) w.via = v.queue.slice(Math.min(i, v.queue.length - 1) + 1).reverse().map(([x, y]) => [x, y] as [number, number]);
        w.tx = spot[0] + step[0] * extra;
        w.ty = spot[1] + step[1] * extra;
        w.slot = o.slot;
        const left = o.maxPatience ? o.patience / o.maxPatience : 1;
        w.face = left < 0.25 ? "cross" : left < 0.5 ? "glance" : "calm";
        seen.add(w.id);
      });
      ready.forEach((o, i) => {
        const w = place("g:" + o.id, { id: "g:" + o.id, name: o.customerName, x: entry[0], y: entry[1], role: "guest", face: "calm", slot: o.slot, leaving: false, carrying: false, outside: out(entry[1]) });
        // Ready guests gather at pickup, the rest stepping back toward the way out.
        if (fresh) w.via = v.queue.slice().reverse().map(([x, y]) => [x, y] as [number, number]);
        const back = Math.hypot(entry[0] - pickup[0], entry[1] - pickup[1]) || 1;
        w.tx = pickup[0] + ((entry[0] - pickup[0]) / back) * 0.45 * i;
        w.ty = pickup[1] + ((entry[1] - pickup[1]) / back) * 0.45 * i;
        w.slot = o.slot;
        w.face = "content";
        seen.add(w.id);
      });
      for (const o of floor.orders) {
        if (o.status === "accepted") continue;
        const w = people.get("g:" + o.id);
        if (!w) continue;
        // On the way out, back along the line to its far end and out of the door.
        if (!w.leaving) w.via = [[last[0], last[1]]];
        w.leaving = true;
        w.carrying = o.status === "served";
        w.face = o.status === "served" ? "content" : "cross";
        w.tx = entry[0];
        w.ty = entry[1];
        w.slot = -1;
        seen.add(w.id);
      }
    }
    for (const id of [...people.keys()]) if (!seen.has(id)) people.delete(id);
    if (snap)
      for (const w of people.values()) {
        w.x = w.tx;
        w.y = w.ty;
        w.via = [];
      }
  }

  /** Moves everyone toward their targets; true while anyone is walking. */
  function step(dt: number, v: Venue) {
    let moving = false;
    for (const w of people.values()) {
      // Drop waypoints already reached (or behind someone joining partway).
      while (w.via.length && Math.hypot(w.via[0][0] - w.x, w.via[0][1] - w.y) < 0.05) w.via.shift();
      const [gx, gy] = w.via[0] ?? [w.tx, w.ty];
      const dx = gx - w.x;
      const dy = gy - w.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.01 && !w.via.length) {
        w.x = w.tx;
        w.y = w.ty;
        if (w.leaving) people.delete(w.id);
        continue;
      }
      moving = true;
      const move = Math.min(d, SPEED[w.role] * dt);
      w.x += (dx / d) * move;
      w.y += (dy / d) * move;
      w.walked += move;
      // Screen-left is -x+y: face the way the walk goes across the screen.
      const across = dx - dy;
      if (Math.abs(across) > 0.02) w.flip = across < 0;
      w.outside = w.y >= v.rows || w.x >= v.cols || w.x < 0 || w.y < 0;
    }
    return moving;
  }

  /** The walk cycle's frame for someone: 0 standing, 1 and 2 mid-stride. */
  const frame = (w: Walker) => (!w.via.length && Math.hypot(w.tx - w.x, w.ty - w.y) < 0.02 ? 0 : 1 + (Math.floor(w.walked * 5) % 2));

  return { people, plan, step, frame };
}
