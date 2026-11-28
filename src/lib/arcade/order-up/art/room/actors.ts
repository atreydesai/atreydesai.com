/**
 * Who is in the room and where they are walking: the chef between counters,
 * crew at theirs, guests in through the door, along the queue, at pickup with
 * their cup ready, and back out. Positions ease toward their targets in
 * tiles per second; the walk cycle steps with distance walked. DOM-free, so
 * the room's motion is tested in node.
 *
 * Guests only ever walk along one line through the venue (its route): in
 * from `entry` through the door, up the queue from its far end, to pickup,
 * and back out through the door. Every place a guest waits is a point on it,
 * so wherever they are told to go next they get there along the route, never
 * across a wall or a counter.
 *
 * Some guests sit down with their cup: from pickup they find a free seat by
 * a path across open floor, sit and sip a while, and leave the way they came
 * (back to pickup and out along the route). A few stay and order again: they
 * wait at their seat, fetch each refill from pickup and come back to it. A
 * child, a friend or a dog may come along, keeping close, sitting or lying
 * down beside them; they have no ticket of their own.
 */
import type { Venue, PropSpec, Seat } from "./types.ts";
import type { FloorState, FloorOrder } from "../floor.ts";
import { GUEST_BY_ID } from "../../content/guests.ts";
import { walkway, type Walkway } from "./walkway.ts";

export type Station = "brew" | "prep" | "build" | "serve" | "stock";

type Point = [number, number];
type Layout = Record<string, readonly [number, number] | number[]>;

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
  role: "chef" | "crew" | "guest" | "pal" | "kid" | "dog";
  face: string;
  slot: number;
  leaving: boolean;
  carrying: boolean;
  outside: boolean;
  /** Points to pass through, in order, before the target: the way along the line, through the door. */
  via: [number, number][];
  /** A guest's distance along the route from `entry`, and the distance it is walking to. */
  s: number;
  goal: number;
  /** Sitting, or (a dog) lying down, where it stopped. */
  pose: "stand" | "sit" | "lie";
  /** The seat it holds (an index into the room's seats), or -1; heading for it, or off the route for any reason. */
  seat: number;
  /** The seat it last got up from, whose chair it may still be stepping out of. */
  left: number;
  toSeat: boolean;
  off: boolean;
  /** Points left in `via` before it is back on the route, and where on the route that is. */
  offLeft: number;
  rejoin: number;
  /** Shift time a seated guest gets up; NaN until they have their last cup. */
  until: number;
  /** Sits after pickup; stays for refills. */
  sits: boolean;
  stays: boolean;
  /** A companion's guest; a guest's last steps, for a companion to follow; on its way back to its guest after sitting. */
  owner: string;
  regroup: boolean;
  trail: Point[];
}

const SPEED = { chef: 5.5, crew: 4, guest: 2.6, pal: 3.2, kid: 3.2, dog: 3.6 };
/** Spacing of the line past its last marked spot, and of ready guests stepping back from pickup, in tiles. */
const LINE_STEP = 0.75;
const FAN_STEP = 0.45;

/**
 * Where someone works a counter: behind it, or in front of one against the
 * back wall. Given the venue and the layout, a spot another counter or
 * something standing has taken gives way to the counter's front, then its
 * sides (a saved layout can put two counters back to back).
 */
export function workSpot(at: readonly [number, number] | number[], v?: Venue, layout?: Layout): [number, number] {
  const [x, y] = at;
  const usual: Point = y >= 1 ? [x + 0.5, y - 0.28] : [x + 0.5, y + 1.3];
  if (!v || !layout) return usual;
  const others = Object.fromEntries(Object.entries(layout).filter(([, p]) => p[0] !== x || p[1] !== y));
  const spots: Point[] = [usual, y >= 1 ? [x + 0.5, y + 1.3] : [x + 0.5, y - 0.28], [x - 0.3, y + 0.5], [x + 1.3, y + 0.5]];
  return spots.find(([sx, sy]) => sx > 0 && sy > 0 && sx < v.cols && sy < v.rows && openAt(v, others, sx, sy, 0.4, true)) ?? usual;
}

/** The guests' whole way through a venue as one line, with the distance along it of each point. */
export interface GuestRoute {
  points: Point[];
  at: number[];
  /** Distance along the route of each queue spot (front first), and of pickup. */
  queue: number[];
  pickup: number;
  length: number;
}

/** In from `entry` and through the door, up the queue from its far end, to pickup, and back out through the door to `entry`. */
export function guestRoute(v: Venue, pickup: readonly [number, number] = v.pickup): GuestRoute {
  const way = v.way ?? [];
  const points = [v.entry, ...way, ...[...v.queue].reverse(), pickup, ...(v.out ?? [...way].reverse()), v.entry].map(([x, y]) => [x, y] as Point);
  const at = [0];
  for (let i = 1; i < points.length; i++) at.push(at[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const far = 1 + way.length;
  return {
    points,
    at,
    queue: v.queue.map((_, i) => at[far + v.queue.length - 1 - i]),
    pickup: at[far + v.queue.length],
    length: at[at.length - 1],
  };
}

/** The point `s` along a route. */
export function routePoint(r: GuestRoute, s: number): Point {
  s = Math.max(0, Math.min(r.length, s));
  let i = 1;
  while (i < r.at.length - 1 && r.at[i] < s) i++;
  const a = r.points[i - 1];
  const b = r.points[i];
  const span = r.at[i] - r.at[i - 1];
  const t = span > 1e-9 ? (s - r.at[i - 1]) / span : 1;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** The route's corners strictly between two distances along it, in the order they are walked. */
export function routeBetween(r: GuestRoute, from: number, to: number): Point[] {
  const out: Point[] = [];
  if (to > from) {
    for (let i = 0; i < r.points.length; i++) if (r.at[i] > from + 1e-6 && r.at[i] < to - 1e-6) out.push([...r.points[i]] as Point);
  } else {
    for (let i = r.points.length - 1; i >= 0; i--) if (r.at[i] < from - 1e-6 && r.at[i] > to + 1e-6) out.push([...r.points[i]] as Point);
  }
  return out;
}

const outsideAt = (v: Venue, x: number, y: number) => y >= v.rows || x >= v.cols || x < 0 || y < 0;

/**
 * Whether someone can stand at a point with every counter where `layout`
 * puts it: on the room's floor clear of its walls (by `wall` tiles), its
 * counters and what stands in it, or on the ground outside, off the slab's
 * edge and clear of what stands there. Guests of a venue served through a
 * hatch stay outside; its crew (`crew`) work inside.
 */
function openAt(v: Venue, layout: Layout, x: number, y: number, wall: number, crew = false) {
  const clear = (props: readonly { x: number; y: number; w?: number; d?: number; flat?: boolean }[]) =>
    !props.some((p) => !p.flat && x > p.x - 0.05 && x < p.x + (p.w ?? 1) + 0.05 && y > p.y - 0.05 && y < p.y + (p.d ?? 1) + 0.05);
  if (x > 0 && y > 0 && x < v.cols && y < v.rows) {
    if ((v.doorway === null && !crew) || x < wall || y < wall || x > v.cols - wall || y > v.rows - wall) return false;
    for (const at of Object.values(layout)) if (x > at[0] - 0.04 && x < at[0] + 1.04 && y > at[1] - 0.04 && y < at[1] + 1.04) return false;
    return clear(v.props);
  }
  if (x > -0.6 && y > -0.6 && x < v.cols + 0.6 && y < v.rows + 0.6) return false;
  return clear(v.outside.props ?? []);
}

/** Whether the straight walk from a to b stays on open floor. */
function openLeg(v: Venue, layout: Layout, a: readonly number[], b: readonly number[]) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1));
  for (let i = 0; i <= n; i++) if (!openAt(v, layout, a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, 0.3)) return false;
  return true;
}

/**
 * Pickup beside the serve counter: the venue's own, or, when a saved layout
 * has moved the counter, the same step beside it there, as long as guests
 * can stand at it and walk to and from it on open floor.
 */
export function pickupFor(v: Venue, layout: Layout, defaultServe?: readonly [number, number] | number[]): Point {
  const serve = layout.serve;
  if (!defaultServe || !serve || (serve[0] === defaultServe[0] && serve[1] === defaultServe[1])) return [v.pickup[0], v.pickup[1]];
  const p: Point = [v.pickup[0] + serve[0] - defaultServe[0], v.pickup[1] + serve[1] - defaultServe[1]];
  const r = guestRoute(v, p);
  const i = 1 + (v.way ?? []).length + v.queue.length;
  // The ready guests step back from it along the way out, so all of that leg must be open too.
  return openAt(v, layout, p[0], p[1], 0.4) && openLeg(v, layout, r.points[i - 1], p) && openLeg(v, layout, p, r.points[i + 1]) ? p : [v.pickup[0], v.pickup[1]];
}


function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Guests whose story says they settle in somewhere: the student, the sketcher, the knitter, the stargazer. */
const SETTLERS = new Set(["book", "pencil", "yarn", "star"]);
/** Specials who take their cup and go: the courier, the critic, the commuter and the rest. */
const SITTING_SPECIALS = new Set(["crammer", "parent", "grandparent", "rival"]);

/**
 * How a guest spends their visit, from who they are: whether they sit down
 * with their cup, stay on for refills (the crammer, anyone given one), and
 * who comes with them: a child (a parent, or some pairs of cups), a friend
 * (the rest of the pairs) or a dog.
 */
export function habitsOf(o: Pick<FloorOrder, "id" | "customerId" | "special" | "cups" | "refills">) {
  // Who someone is (their dog, whether they like to sit) is theirs every visit; who comes along varies.
  const me = hash(o.customerId);
  const h = hash(o.customerId + "|" + o.id);
  const arc = GUEST_BY_ID[o.customerId]?.story?.[0]?.prop ?? "";
  const special = o.special ?? null;
  const cups = o.cups ?? 1;
  const away = !!special && !SITTING_SPECIALS.has(special);
  const kid = special === "parent" || (!special && cups === 2 && h % 3 === 0);
  const pal = !kid && !special && cups === 2;
  const stays = special === "crammer" || (o.refills ?? 0) > 0;
  const sits = !away && (stays || kid || pal || !!special || SETTLERS.has(arc) || me % 5 === 0);
  const dog = !kid && !away && (arc === "shoe" || arc === "seed" ? me % 2 === 0 : me % 11 === 0);
  return { sits, stays, with: kid ? ("kid" as const) : pal ? ("pal" as const) : null, dog, sitFor: 20 + (h % 19) };
}

/** Seats someone could sit on with every counter where `layout` has it: none under a counter, all reachable from pickup. */
export function usableSeats(v: Venue, layout: Layout, ways: Walkway, extra: readonly Seat[] = []): Seat[] {
  const pickup = guestRoute(v).points[1 + (v.way ?? []).length + v.queue.length];
  return [...(v.seats ?? []), ...extra].filter((seat) => {
    const allow = new Set(seat.pieces);
    return ways.open([seat.x, seat.y], allow) && !!ways.path(pickup, [seat.x, seat.y], allow);
  });
}

export function createCast() {
  const people = new Map<string, Walker>();
  /** Seat index to the walker holding it. */
  const booked = new Map<number, string>();
  let seats: Seat[] = [];
  let ways: Walkway | null = null;
  let room = "";
  const paths = new Map<string, Point[] | null>();

  let fresh = false;
  function place(id: string, init: Omit<Walker, "x" | "y" | "walked" | "flip" | "tx" | "ty" | "via" | "s" | "goal" | "pose" | "seat" | "left" | "toSeat" | "off" | "offLeft" | "rejoin" | "until" | "sits" | "stays" | "owner" | "regroup" | "trail"> & { x: number; y: number }) {
    let w = people.get(id);
    fresh = !w;
    if (!w) {
      w = { ...init, tx: init.x, ty: init.y, walked: 0, flip: false, via: [], s: 0, goal: 0, pose: "stand", seat: -1, left: -1, toSeat: false, off: false, offLeft: 0, rejoin: 0, until: NaN, sits: false, stays: false, owner: "", regroup: false, trail: [] };
      people.set(id, w);
    }
    return w;
  }

  const allowFor = (...indices: number[]) => new Set(indices.flatMap((i) => (i >= 0 && seats[i] ? seats[i].pieces : [])));
  function pathBetween(a: Point, b: Point, allow: Set<string>) {
    const key = a.map((n) => n.toFixed(2)) + ">" + b.map((n) => n.toFixed(2)) + "|" + [...allow].join(",");
    if (!paths.has(key)) {
      if (paths.size > 400) paths.clear();
      paths.set(key, ways!.path(a, b, allow));
    }
    return paths.get(key)!;
  }

  function release(w: Walker) {
    if (w.seat >= 0 && booked.get(w.seat) === w.id) booked.delete(w.seat);
    if (w.seat >= 0) w.left = w.seat;
    w.seat = -1;
  }

  /** A free seat for a guest, and one at the same table for the friend or child with them. */
  function book(w: Walker, companion: Walker | undefined) {
    if (w.seat >= 0) return true;
    const free = seats.map((s, i) => i).filter((i) => !booked.has(i));
    if (!free.length) return false;
    // A different favourite for everyone, so the room fills unevenly.
    const order = free.sort((a, b) => hash(w.id + seats[a].id) - hash(w.id + seats[b].id));
    for (const i of order) {
      if (!companion) {
        booked.set(i, w.id);
        w.seat = i;
        return true;
      }
      const mate = order.find((j) => j !== i && seats[j].table && seats[j].table === seats[i].table);
      if (mate === undefined) continue;
      booked.set(i, w.id);
      booked.set(mate, companion.id);
      w.seat = i;
      companion.seat = mate;
      return true;
    }
    return false;
  }

  /** Takes a seat (and one for whoever is with them) and heads for it; false, holding nothing, when it can't. */
  function sit(w: Walker, r: GuestRoute, mate: Walker | undefined) {
    if (book(w, mate) && toSeat(w, r)) return true;
    release(w);
    if (mate) release(mate);
    return false;
  }

  /** Off the route to its seat: back along the route to pickup if need be, then across the floor. */
  function toSeat(w: Walker, r: GuestRoute) {
    if (w.toSeat) return true;
    if (w.seat < 0) return false;
    const seat = seats[w.seat];
    const at: Point = [seat.x, seat.y];
    const pk = routePoint(r, r.pickup);
    const from: Point = w.off ? [w.x, w.y] : pk;
    const p = pathBetween(from, at, allowFor(w.seat));
    if (!p) return false;
    w.via = [...(w.off ? [] : [...routeBetween(r, w.s, r.pickup), pk]), ...p.slice(1, -1)];
    [w.tx, w.ty] = at;
    w.toSeat = true;
    w.off = true;
    w.offLeft = 0;
    w.goal = -1;
    return true;
  }

  /** Back to the route from wherever it is off it (a seat, the way to one), then on along it to `goal`. */
  function rejoin(w: Walker, r: GuestRoute, goal: number) {
    if (Math.abs(goal - w.goal) < 1e-6 && !w.toSeat) return;
    const pk = routePoint(r, r.pickup);
    const p = pathBetween([w.x, w.y], pk, allowFor(w.seat)) ?? [[w.x, w.y] as Point, pk];
    w.via = [...p.slice(1), ...routeBetween(r, r.pickup, goal)];
    w.offLeft = p.length - 1;
    w.rejoin = r.pickup;
    w.goal = goal;
    [w.tx, w.ty] = routePoint(r, goal);
    w.toSeat = false;
    w.pose = "stand";
    if (!w.offLeft) {
      w.off = false;
      w.s = r.pickup;
    }
  }

  /** Sends a guest to a distance along the route, through every corner between where it is and there. */
  function head(w: Walker, r: GuestRoute, goal: number) {
    if (w.off) return rejoin(w, r, goal);
    if (Math.abs(goal - w.goal) < 1e-6) return;
    w.goal = goal;
    w.via = routeBetween(r, w.s, goal);
    [w.tx, w.ty] = routePoint(r, goal);
  }

  /** Out of the shop: from its seat (giving it up) or along the route, to the end it is nearer. */
  function leave(w: Walker, r: GuestRoute, back: boolean) {
    w.leaving = true;
    w.slot = -1;
    const keep = w.seat;
    release(w);
    if (w.off) {
      w.seat = keep;
      rejoin(w, r, r.length);
      w.seat = -1;
    } else head(w, r, back ? 0 : r.length);
  }

  /**
   * Sets everyone's targets for this moment of the shift. `snap` puts them
   * there at once (reduced motion, or the first frame). `extra` adds what the
   * shop's own decor brings: its stools to sit on, and everything standing.
   */
  function plan(
    v: Venue,
    layout: Layout,
    station: Station,
    floor: FloorState | null,
    crew: { id: string; name: string; station: Station | null }[],
    snap = false,
    /** Where the venue's serve counter was drawn; pickup moves with the counter from there. */
    defaultServe?: readonly [number, number] | number[],
    extra?: { props?: readonly PropSpec[]; seats?: readonly Seat[] },
  ) {
    const key = v.id + "|" + v.cols + "x" + v.rows + "|" + JSON.stringify(layout) + "|" + (extra?.props ?? []).map((p) => p.key + "@" + p.x + "," + p.y).join(";");
    if (key !== room) {
      room = key;
      ways = walkway(v, layout, extra?.props ?? []);
      seats = usableSeats(v, layout, ways, extra?.seats ?? []);
      paths.clear();
      booked.clear();
      for (const w of people.values()) {
        w.seat = -1;
        w.toSeat = false;
      }
    }
    const seen = new Set<string>();
    const chefAt = workSpot(layout[station] ?? layout.build, v, layout);
    const chef = place("chef", { id: "chef", name: "chef", x: chefAt[0], y: chefAt[1], role: "chef", face: "calm", slot: -1, leaving: false, carrying: false, outside: false });
    chef.tx = chefAt[0];
    chef.ty = chefAt[1];
    seen.add("chef");
    crew.forEach((person, i) => {
      if (!person.station || person.station === station) return;
      const spot = workSpot(layout[person.station], v, layout);
      const w = place("crew:" + person.id, { id: "crew:" + person.id, name: person.name, x: spot[0], y: spot[1], role: "crew", face: "calm", slot: -1, leaving: false, carrying: false, outside: false });
      w.tx = spot[0] + (i % 2 ? 0.2 : -0.2);
      w.ty = spot[1];
      seen.add(w.id);
    });
    if (floor) {
      const now = floor.elapsed;
      const waiting = floor.orders.filter((o) => o.status === "accepted" && !o.cup?.sealed);
      const ready = floor.orders.filter((o) => o.status === "accepted" && o.cup?.sealed);
      const r = guestRoute(v, pickupFor(v, layout, defaultServe));
      const last = r.queue.length - 1;
      // More waiting than marked spots: each further back along the way in, a step apart, where there is room to stand.
      const spill: number[] = [];
      for (let s = r.queue[last] - LINE_STEP; spill.length < waiting.length - last - 1 && s > 0; s -= 0.05) {
        const [x, y] = routePoint(r, s);
        if (openAt(v, layout, x, y, 0.4)) {
          spill.push(s);
          s -= LINE_STEP - 0.05;
        }
      }
      const guest = (o: FloorOrder) => {
        const habits = habitsOf(o);
        const w = place("g:" + o.id, { id: "g:" + o.id, name: o.customerName, x: v.entry[0], y: v.entry[1], role: "guest", face: "calm", slot: o.slot, leaving: false, carrying: false, outside: outsideAt(v, v.entry[0], v.entry[1]) });
        if (fresh) {
          // A guest who has just come in starts at the entry, at the start of the route; whoever is with them comes too.
          w.goal = w.s = 0;
          w.sits = habits.sits;
          for (const role of [habits.with, habits.dog ? ("dog" as const) : null]) {
            if (!role) continue;
            const c = place(role + ":" + o.id, { id: role + ":" + o.id, name: o.customerName, x: w.x, y: w.y, role, face: "calm", slot: -1, leaving: false, carrying: false, outside: w.outside });
            c.owner = w.id;
          }
        }
        w.stays ||= habits.stays;
        return { w, habits, mate: people.get((habits.with ?? "") + ":" + o.id) };
      };
      waiting.forEach((o, i) => {
        const { w, mate } = guest(o);
        // A guest staying on waits for a refill at their seat, if they have (or can get) one; otherwise in line.
        if (!(w.stays && (o.refills ?? 0) > 0 && sit(w, r, mate))) head(w, r, i <= last ? r.queue[i] : (spill[i - last - 1] ?? 0));
        w.slot = o.slot;
        const left = o.maxPatience ? o.patience / o.maxPatience : 1;
        w.face = left < 0.25 ? "cross" : left < 0.5 ? "glance" : "calm";
        seen.add(w.id);
      });
      ready.forEach((o, i) => {
        const { w } = guest(o);
        // Ready guests gather at pickup, the rest stepping back along the way out (a regular leaves their seat for it).
        head(w, r, Math.min(r.length, r.pickup + FAN_STEP * i));
        w.slot = o.slot;
        w.face = "content";
        seen.add(w.id);
      });
      for (const o of floor.orders) {
        if (o.status === "accepted") continue;
        const w = people.get("g:" + o.id);
        if (!w) continue;
        seen.add(w.id);
        if (w.leaving || !Number.isNaN(w.until)) continue;
        w.carrying = o.status === "served";
        w.face = o.status === "served" ? "content" : "cross";
        w.slot = -1;
        // Served: those who sit find a seat (or keep the one they had) for a while; the rest go. Missed: they go.
        if (o.status === "served" && w.sits && sit(w, r, people.get("pal:" + o.id) ?? people.get("kid:" + o.id))) w.until = now + (w.stays ? 30 : habitsOf(o).sitFor);
        else leave(w, r, o.status === "missed" && !w.off && w.s < r.pickup - 1e-6);
      }
      // Whoever is sitting stays until their time is up, then leaves; whoever is leaving walks on out.
      for (const w of people.values()) {
        if (w.role !== "guest" || seen.has(w.id)) continue;
        if (w.leaving || !Number.isNaN(w.until)) seen.add(w.id);
      }
      for (const w of people.values())
        if (w.role === "guest" && !w.leaving && !Number.isNaN(w.until) && now >= w.until) {
          w.carrying = true;
          leave(w, r, false);
        }
      // Companions stay with their guest.
      for (const w of people.values()) if (w.owner && seen.has(w.owner)) seen.add(w.id);
    }
    for (const [id, w] of [...people]) {
      if (seen.has(id)) continue;
      release(w);
      people.delete(id);
    }
    if (snap)
      for (const w of people.values()) {
        if (w.owner) continue;
        w.x = w.tx;
        w.y = w.ty;
        w.via = [];
        w.s = w.goal >= 0 ? w.goal : w.s;
        if (w.offLeft) {
          w.offLeft = 0;
          w.off = false;
          w.s = w.goal;
        }
        if (w.toSeat) w.pose = "sit";
        w.outside = outsideAt(v, w.x, w.y);
      }
    // Companions go where their guest is: beside them, or to their own seat (a dog lies down by the guest's).
    for (const c of people.values()) {
      if (!c.owner) continue;
      const o = people.get(c.owner);
      if (!o) continue;
      follow(c, o, v, snap);
    }
  }

  /** Where a companion wants to be: its seat (or its dog spot) once its guest has sat, otherwise close behind or beside them. */
  function follow(c: Walker, o: Walker, v: Venue, snap: boolean) {
    const seat = o.seat >= 0 && o.pose === "sit" ? (c.role === "dog" ? seats[o.seat]?.dog : c.seat >= 0 ? ([seats[c.seat].x, seats[c.seat].y] as Point) : null) : null;
    if (seat && ways!.open(seat, allowFor(c.seat))) {
      if (!c.toSeat) {
        const p = pathBetween([c.x, c.y], seat, allowFor(c.seat, o.seat));
        if (p) {
          c.via = p.slice(1, -1);
          [c.tx, c.ty] = seat;
          c.toSeat = true;
        }
      }
      if (snap) {
        [c.x, c.y] = seat;
        c.via = [];
        c.pose = c.role === "dog" ? "lie" : "sit";
      }
      return;
    }
    if (c.toSeat) {
      // Their guest got up: back to them the way the floor allows, then on behind them.
      const p = pathBetween([c.x, c.y], [o.x, o.y], allowFor(c.seat, o.seat, c.left, o.left));
      c.via = p ? p.slice(1, -1) : [];
      c.regroup = c.via.length > 0;
      c.toSeat = false;
      c.pose = "stand";
      if (!o.leaving) {
        /* keep its seat for the next sit */
      } else release(c);
    }
    if (c.regroup) {
      if (c.via.length) {
        [c.tx, c.ty] = [o.x, o.y];
        return;
      }
      c.regroup = false;
    }
    const want = companionSpot(c, o, v);
    [c.tx, c.ty] = want.at;
    c.via = want.via;
    if (snap) {
      [c.x, c.y] = want.at;
      c.via = [];
      c.outside = outsideAt(v, c.x, c.y);
    }
  }

  /**
   * Close behind a walking guest, along the very steps they took (never a
   * short cut past a chair); beside a standing one, where the floor is open.
   * Gives the way there and the spot.
   */
  function companionSpot(c: Walker, o: Walker, v: Venue): { via: Point[]; at: Point } {
    const trail = [...o.trail, [o.x, o.y] as Point];
    // Where on the guest's steps the companion is now, and the point `dist` back from the guest.
    let from = 0;
    let best = Infinity;
    trail.forEach((p, i) => {
      const d = Math.hypot(p[0] - c.x, p[1] - c.y);
      if (d < best + 1e-9) {
        best = d;
        from = i;
      }
    });
    const behind = (dist: number) => {
      let left = dist;
      for (let i = trail.length - 1; i > 0; i--) {
        const [a, b] = [trail[i], trail[i - 1]];
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d >= left) return { i, at: [a[0] + ((b[0] - a[0]) * left) / d, a[1] + ((b[1] - a[1]) * left) / d] as Point };
        left -= d;
      }
      return { i: 0, at: trail[0] };
    };
    const along = (spot: { i: number; at: Point }) => ({ via: from < spot.i ? trail.slice(from + 1, spot.i) : [], at: from <= spot.i ? spot.at : trail[from] });
    const walking = o.via.length > 0 || Math.hypot(o.tx - o.x, o.ty - o.y) > 0.02;
    if (walking) return along(behind(0.45));
    // Standing: to one side of the way they were facing, or else just behind.
    const prev = o.trail[o.trail.length - 1] ?? [o.x - 1, o.y];
    const dx = o.x - prev[0],
      dy = o.y - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    const sign = c.role === "dog" ? -1 : 1;
    const side: Point = [o.x - (dy / len) * 0.36 * sign, o.y + (dx / len) * 0.36 * sign];
    const near = behind(0.4);
    const wall = v.doorway === null ? 0.65 : 0.3;
    if (ways!.open(side, undefined, wall) && ways!.clear([o.x, o.y], side) && ways!.clear(near.at, side)) {
      const back = along(near);
      return { via: [...back.via, back.at], at: side };
    }
    return along(near);
  }

  /** Moves everyone toward their targets; true while anyone is walking. */
  function step(dt: number, v: Venue) {
    let moving = false;
    for (const w of people.values()) {
      if (w.owner && !w.toSeat && !w.regroup) {
        // Re-aim a follower at where its guest is now, along the way they went.
        const o = people.get(w.owner);
        if (o) {
          const want = companionSpot(w, o, v);
          [w.tx, w.ty] = want.at;
          w.via = want.via;
        }
      }
      // Drop waypoints already reached; back on the route once the last off it is behind.
      while (w.via.length && Math.hypot(w.via[0][0] - w.x, w.via[0][1] - w.y) < 0.05) {
        w.via.shift();
        if (w.offLeft > 0 && --w.offLeft === 0) {
          w.off = false;
          w.s = w.rejoin;
        }
      }
      const [gx, gy] = w.via[0] ?? [w.tx, w.ty];
      const dx = gx - w.x;
      const dy = gy - w.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.01 && !w.via.length) {
        w.x = w.tx;
        w.y = w.ty;
        if (w.goal >= 0) w.s = w.goal;
        if (w.toSeat && w.pose === "stand") w.pose = w.role === "dog" ? "lie" : "sit";
        if (w.leaving) {
          release(w);
          people.delete(w.id);
        }
        continue;
      }
      if (w.pose !== "stand" && d > 0.05) w.pose = "stand";
      moving = true;
      const move = Math.min(d, SPEED[w.role] * dt);
      w.x += (dx / d) * move;
      w.y += (dy / d) * move;
      w.walked += move;
      // A guest on the route walks along it, so how far it has come along it grows with each step.
      if (w.role === "guest" && !w.off) w.s = w.goal > w.s ? Math.min(w.goal, w.s + move) : Math.max(w.goal, w.s - move);
      const last = w.trail[w.trail.length - 1];
      if (!last || Math.hypot(last[0] - w.x, last[1] - w.y) > 0.1) {
        w.trail.push([w.x, w.y]);
        if (w.trail.length > 24) w.trail.shift();
      }
      // Screen-left is -x+y: face the way the walk goes across the screen.
      const across = dx - dy;
      if (Math.abs(across) > 0.02) w.flip = across < 0;
      w.outside = outsideAt(v, w.x, w.y);
    }
    return moving;
  }

  /** The walk cycle's frame for someone: 0 standing, 1 and 2 mid-stride. */
  const frame = (w: Walker) => (w.pose !== "stand" || (!w.via.length && Math.hypot(w.tx - w.x, w.ty - w.y) < 0.02) ? 0 : 1 + (Math.floor(w.walked * 5) % 2));

  /** The seat a walker holds, if any; and the one it last got up from. */
  const seatOf = (w: Walker) => (w.seat >= 0 ? seats[w.seat] : null);
  const leftOf = (w: Walker) => (w.left >= 0 ? seats[w.left] : null);

  return { people, plan, step, frame, seatOf, leftOf, get seats() { return seats; }, get booked() { return booked; } };
}
