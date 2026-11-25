// Spill's lessons: what the kitchen teaches, and when. Spill is a planning
// puzzle, so nothing is slowed: a lesson that explains holds the room
// instead. While it holds during planning the room is frozen outright (no
// step at all: the dial, a belt, a kettle on its rail all wait), so a held
// room plays out bit for bit as an unheld one would from the same planning
// time; straws can still be drawn and taken back. Each lesson holds for a
// few seconds of real time a visit at most, and Continue (Enter, or the
// slip's button), pressing Pour, or doing what it asks lets the room run on.
// Each line sits beside the thing it is about, in the room, with a pen loop
// round it; the kitchen dims except for that thing while the line is up.
//
// Room 1, the first time on a device, draws its own reference route as a
// ghost straw with chalk showing where and which way to draw it; the lesson
// is learned once the straws down would pour into the cup (the engine says
// so, on the straws as laid), and then Pour is pointed out. A straw that
// spoils it is where taking a straw back is taught. Each fixture is named,
// in play terms, the first time a room has one: ice, a fan, a belt, a second
// cup, jelly, a pipe, milk to a ratio, a sponge, a hot plate, pearls, a
// scale, glass, a kettle on a rail, a sieve. The gauge is named the first
// time straw runs low, the dial as the kettle is about to pour by itself,
// the fill line as tea first reaches a cup (the pour is live, so that line
// holds nothing), and the stars, the points and a spill's hint as a room
// first ends that way.
//
// DOM-free: the component asks `planningLesson` each frame and `resultLesson`
// as a room ends, hands the answer to the shared coach
// (src/lib/arcade/core/coach.ts), which shows one lesson at a time and
// remembers them per device, and asks `aim` where the lesson points.

import { HEIGHT, MAX_FRAME, MILK, PIPE_MOUTH, ROOMS, STEP, WIDTH, pourCountdown, simulate, strawLeft } from "./spill-engine.js";
import { frameSteps } from "./core/loop.ts";
import { clamp } from "./core/math.ts";

/**
 * @typedef {import("./spill-engine.js").Room} Room
 * @typedef {import("./spill-engine.js").World} World
 * @typedef {import("./core/coach.ts").Lesson} Lesson
 * The coach's lesson, with spill's own fields: `hold`, it holds the planning
 * dial (or a room's result) while it explains; `continuable: false`, it
 * offers no Continue (doing what it asks is how it ends); `during` ("plan",
 * "pour", "result" or "any"), when it belongs: a planning lesson ends as the
 * pour starts.
 */

/** Real seconds a lesson may hold the room in a visit, all its holds together: about seven, then play runs on. */
export const HOLD = 7;
/** Real seconds of quiet between two lines about things, so lessons never run together. */
export const REST = 0.6;
/** A straw follows the ghost when this share of the ghost lies within NEAR of it… */
export const COVER = 0.75;
/** …room units (the straw's own snap is 7), and it reaches the ghost's start, where the tea lands. */
export const NEAR = 6;
/** The dial is taught when the kettle is this close to pouring by itself (seconds of planning). */
export const DIAL_SOON = 5;
/** Below this share of the room's straw, the gauge reads low (the component colours it from this). */
export const LOW_SHARE = 0.2;
/** Roughly how much cup a settled droplet fills, measured from the authored rooms: places a cup's fill line. */
export const AREA_PER_DROP = 18.6;

const thing = { life: HOLD, minLife: 1.2, hold: true };
const move = { life: Infinity, minLife: 0.6, move: true, hold: true };

/** Every lesson: one short full sentence, eight words or fewer. @type {Readonly<Record<string, Lesson>>} */
export const LESSONS = Object.freeze({
  // Room 1: the move, then the button. The pen keys show beside the drag, so
  // a keyboard player never has to guess them.
  route: { id: "route", text: "Drag to draw a straw along the ghost.", keys: ["Space", "←↑↓→"], ...move, during: "plan" },
  pour: { id: "pour", text: "Pour when the straws are ready.", keys: ["Enter"], touch: "tap Pour", ...move, continuable: false, during: "plan" },
  // Above the route move: a straw off the ghost is taken back before the route goes on.
  takeBack: { id: "takeBack", text: "Click a straw to get its length back.", ...thing, priority: 3, during: "any" },
  gauge: { id: "gauge", text: "This is your straw left, running low.", ...thing, during: "plan" },
  dial: { id: "dial", text: "The kettle pours by itself at zero.", ...thing, during: "plan" },
  // The pour is live, so this one holds nothing and goes by itself.
  fill: { id: "fill", text: "Fill the cup to its dashed line.", life: 3.5, minLife: 1.2, during: "pour" },
  stars: { id: "stars", text: "Fuller cups and less spill earn more stars.", ...thing, during: "result" },
  bonus: { id: "bonus", text: "Straw left and an early pour add points.", ...thing, during: "result" },
  retry: { id: "retry", text: "A spill restarts the room with this hint.", ...thing, during: "result" },
  // Fixtures, named (in italic) the first time a room has one, then one line on what it does.
  ice: { id: "ice", name: "ice", text: "Tea slides off it like off a straw.", ...thing, during: "plan" },
  fan: { id: "fan", name: "fan", text: "Its wind pushes tea the way it blows.", ...thing, during: "plan" },
  updraft: { id: "updraft", name: "updraft", text: "This wind lifts tea that falls in.", ...thing, during: "plan" },
  belt: { id: "belt", name: "belt", text: "It slides the cup back and forth.", ...thing, during: "plan" },
  overflow: { id: "overflow", name: "overflow", text: "One cup's overflow can fill another.", ...thing, during: "plan" },
  jelly: { id: "jelly", name: "jelly", text: "It bounces tea up and away.", ...thing, during: "plan" },
  pipe: { id: "pipe", name: "pipe", text: "Tea in one end comes out the other.", ...thing, during: "plan" },
  milk: { id: "milk", name: "milk", text: "Mix milk and tea to the cup's band.", ...thing, during: "plan" },
  sponge: { id: "sponge", name: "sponge", text: "It soaks up any tea it touches.", ...thing, during: "plan" },
  hot: { id: "hot", name: "hot plate", text: "Tea that lands on it boils away.", ...thing, during: "plan" },
  pearls: { id: "pearls", name: "pearls", text: "Steer them from here into the cup.", ...thing, during: "plan" },
  scale: { id: "scale", name: "scale", text: "Weigh this pan down to open the gate.", ...thing, during: "plan" },
  glass: { id: "glass", name: "glass", text: "Straws won't go on it; tea flies through.", ...thing, during: "plan" },
  rail: { id: "rail", name: "rail", text: "This kettle slides along it while pouring.", ...thing, during: "plan" },
  sieve: { id: "sieve", name: "sieve", text: "It lets tea through but holds pearls.", ...thing, during: "plan" },
});

/** The room the ghost route is taught in: room 1, as authored or in expert, never a remix. */
export const ROUTE_ROOM = ROOMS[0].id;

/**
 * The same lesson, worded for the input the player is using: the pen keys
 * on a keyboard, a tap on a phone. Same id, so the coach sees one lesson.
 * @type {Record<string, Partial<Record<"touch" | "keys", Partial<Lesson>>>>}
 */
const WORDINGS = {
  route: { keys: { text: "Hold Space and steer along the ghost.", keys: ["Space", "←↑↓→"] } },
  takeBack: {
    touch: { text: "Tap a straw to get its length back." },
    keys: { text: "Delete refunds the straw under the pen.", keys: ["Delete"] },
  },
};

/** @type {Map<string, Readonly<Lesson>>} */
const worded = new Map();

/**
 * `lesson` as it is shown for `input` ("mouse", "touch" or "keys"), built
 * once and kept, so a frame never allocates one.
 * @param {Lesson} lesson
 * @param {"mouse" | "touch" | "keys"} input
 * @returns {Readonly<Lesson>}
 */
export function wordedFor(lesson, input) {
  const change = input === "mouse" ? null : WORDINGS[lesson.id]?.[input];
  if (!change) return lesson;
  const key = `${lesson.id}:${input}`;
  let shown = worded.get(key);
  if (!shown) {
    shown = Object.freeze({ ...lesson, ...change });
    worded.set(key, shown);
  }
  return shown;
}

/**
 * @typedef {{ kind: string, index: number }} Target
 * What a lesson points at: a fixture by kind and index ("block", "fan",
 * "cup", "band", "pipe", "hopper", "scale", "glass", "kettle", "sieve"),
 * the ghost route, a straw (by its id), a cup's fill line, a kettle's
 * dial, the cups together; or a control outside the room ("pour", "gauge",
 * "verdict", "caption").
 * @typedef {{ lesson: Lesson, target: Target }} Cue
 */

/** @type {Map<string, Cue>} */
const cues = new Map();

/**
 * The cue for `lesson` about a thing, made once and kept: the planning
 * check runs every frame and never builds one twice.
 * @param {Lesson} lesson
 * @param {string} kind
 * @param {number} [index]
 * @returns {Cue}
 */
function cue(lesson, kind, index = 0) {
  const key = `${lesson.id}:${kind}:${index}`;
  let made = cues.get(key);
  if (!made) {
    made = Object.freeze({ lesson, target: Object.freeze({ kind, index }) });
    cues.set(key, made);
  }
  return made;
}

/**
 * @param {Room} room
 * @param {"ice" | "jelly" | "sponge" | "hot"} type
 */
const blockOf = (room, type) => (room.blocks ?? []).findIndex((block) => block.type === type);

/**
 * Each fixture, in the order a room would name them, and how to find it in
 * a room: the index of the thing the lesson points at, or -1.
 * @type {ReadonlyArray<{ id: string, kind: string, find: (room: Room) => number }>}
 */
export const FIXTURES = Object.freeze([
  { id: "ice", kind: "block", find: (room) => blockOf(room, "ice") },
  { id: "fan", kind: "fan", find: (room) => ((room.fans ?? []).length ? 0 : -1) },
  // A fan that blows up more than across: what reaches it is lifted.
  { id: "updraft", kind: "fan", find: (room) => (room.fans ?? []).findIndex((fan) => -fan.fy > Math.abs(fan.fx)) },
  { id: "belt", kind: "cup", find: (room) => room.cups.findIndex((cup) => !!cup.conveyor) },
  // More than one cup: the lesson points at the highest, whose overflow goes on.
  { id: "overflow", kind: "cup", find: (room) => (room.cups.length > 1 ? highestCup(room) : -1) },
  { id: "jelly", kind: "block", find: (room) => blockOf(room, "jelly") },
  { id: "pipe", kind: "pipe", find: (room) => ((room.pipes ?? []).length ? 0 : -1) },
  {
    id: "milk",
    kind: "band",
    find: (room) => (room.kettles.some((kettle) => kettle.kind === "milk") ? room.cups.findIndex((cup) => cup.order.milk !== undefined) : -1),
  },
  { id: "sponge", kind: "block", find: (room) => blockOf(room, "sponge") },
  { id: "hot", kind: "block", find: (room) => blockOf(room, "hot") },
  { id: "pearls", kind: "hopper", find: (room) => (room.hopper ? 0 : -1) },
  { id: "scale", kind: "scale", find: (room) => ((room.scales ?? []).length ? 0 : -1) },
  { id: "glass", kind: "glass", find: (room) => ((room.noDraw ?? []).length ? 0 : -1) },
  { id: "rail", kind: "kettle", find: (room) => room.kettles.findIndex((kettle) => !!kettle.rail) },
  { id: "sieve", kind: "sieve", find: (room) => ((room.sieves ?? []).length ? 0 : -1) },
]);

/** @param {Room} room */
function highestCup(room) {
  let best = 0;
  room.cups.forEach((cup, index) => {
    if (cup.y < room.cups[best].y) best = index;
  });
  return best;
}

/** @type {WeakMap<Room, ReadonlyArray<{ id: string, kind: string, index: number }>>} */
const found = new WeakMap();

/**
 * The fixtures in `room`, each with what its lesson points at, in the order
 * the room would name them. A room's fixtures never change, so it is
 * worked out once per room.
 * @param {Room} room
 */
function fixturesOf(room) {
  let list = found.get(room);
  if (!list) {
    list = Object.freeze(
      FIXTURES.map((fixture) => ({ id: fixture.id, kind: fixture.kind, index: fixture.find(room) })).filter((entry) => entry.index >= 0),
    );
    found.set(room, list);
  }
  return list;
}

/**
 * The fixtures `room` has, as lesson ids, in the order it would name them.
 * @param {Room} room
 */
export function fixturesIn(room) {
  return fixturesOf(room).map((fixture) => fixture.id);
}

/**
 * The room (an index into ROOMS) whose clearing shows a lesson is already
 * known, so a device with progress from before the lessons skips what it
 * has played: a fixture's first room, room 1 for its own lessons, room 2
 * for the gauge, the dial and the points. Taking a straw back and a spill's
 * hint are taught whenever they come up. -1: never skipped.
 * @param {string} id
 */
export function introducedIn(id) {
  if (id === "route" || id === "pour" || id === "fill" || id === "stars") return 0;
  if (id === "gauge" || id === "dial" || id === "bonus") return 1;
  const fixture = FIXTURES.find((f) => f.id === id);
  if (!fixture) return -1;
  return ROOMS.findIndex((room) => fixture.find(room) >= 0);
}

/**
 * The lessons a device already knows from its progress: every lesson whose
 * room it has cleared.
 * @param {(index: number) => boolean} cleared
 */
export function knownFrom(cleared) {
  return Object.keys(LESSONS).filter((id) => {
    const index = introducedIn(id);
    return index >= 0 && cleared(index);
  });
}

// --- The ghost route ------------------------------------------------------------------

/** @type {WeakMap<Room, ReadonlyArray<Readonly<{ x: number, y: number }>> | null>} */
const routes = new WeakMap();

/**
 * The route the ghost shows: the first straw of the room's own reference
 * solution (the room as played, so expert's when expert), as points in
 * room units, made once per room. Null when the room has none.
 * @param {Room} room
 * @returns {ReadonlyArray<Readonly<{ x: number, y: number }>> | null}
 */
export function ghostRoute(room) {
  if (routes.has(room)) return routes.get(room) ?? null;
  const stroke = room.solution?.strokes?.[0];
  const route = stroke && stroke.length >= 2 ? Object.freeze(stroke.map(([x, y]) => Object.freeze({ x, y }))) : null;
  routes.set(room, route);
  return route;
}

/**
 * Distance from a point to a polyline of [x, y] pairs.
 * @param {number} x @param {number} y
 * @param {ReadonlyArray<readonly [number, number]>} points
 */
function distanceTo(x, y, points) {
  if (points.length === 1) return Math.hypot(x - points[0][0], y - points[0][1]);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/**
 * How much of the ghost a straw covers: the share of points along the
 * route, one every room unit, that lie within `near` of the straw. Which
 * way the straw was drawn doesn't matter.
 * @param {ReadonlyArray<{ x: number, y: number }>} route
 * @param {ReadonlyArray<readonly [number, number]>} straw
 * @param {number} [near]
 */
export function coverage(route, straw, near = NEAR) {
  if (route.length < 2 || !straw.length) return 0;
  let covered = 0;
  let samples = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      samples++;
      if (distanceTo(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n, straw) <= near) covered++;
    }
  }
  return covered / samples;
}

/**
 * Whether a straw follows the ghost: it covers most of it and reaches its
 * start, under the stream, where a straw cut short would miss the tea. This
 * only says which straw is off the ghost; whether the route works is the
 * engine's to say (`routeVerdict`).
 * @param {ReadonlyArray<{ x: number, y: number }>} route
 * @param {ReadonlyArray<readonly [number, number]>} straw
 */
export function follows(route, straw) {
  return coverage(route, straw) >= COVER && distanceTo(route[0].x, route[0].y, straw) <= NEAR;
}

/**
 * Whether the straws down would clear the room if Pour were pressed now: a
 * straw off the ghost that works anyway is the player's own route, and is
 * never what taking a straw back is taught on. Runs the room to its end
 * (a few milliseconds), so it is asked once per straw, only while the route
 * is being taught.
 * @param {Room} room
 * @param {ReadonlyArray<{ points: Array<[number, number]> }>} strokes
 */
export function wouldClear(room, strokes) {
  return simulate(
    room,
    strokes.map((stroke) => stroke.points),
    { pourAt: 0 },
  ).result.cleared;
}

/**
 * What the straws down say about the route lesson, after a straw goes down
 * (`drawnId`) or one is taken back (-1). The route is learned only when the
 * straws as laid would pour into the cup (the engine runs the room: a straw
 * along the ghost with another undoing it is not learned, and the player's
 * own way that works is). Otherwise `offGhost` is the straw to teach taking
 * back on: one off the ghost (the one just drawn, if it is off), else the
 * one just drawn, else -1. Runs the room (a few milliseconds), so the
 * component asks only in the route's room, while it is still to learn.
 * @param {Room} room
 * @param {ReadonlyArray<{ id: number, points: Array<[number, number]> }>} strokes
 * @param {number} [drawnId]
 * @returns {{ learned: boolean, offGhost: number }}
 */
export function routeVerdict(room, strokes, drawnId = -1) {
  const route = ghostRoute(room);
  if (!route || !strokes.length) return { learned: false, offGhost: -1 };
  if (wouldClear(room, strokes)) return { learned: true, offGhost: -1 };
  let offGhost = -1;
  for (const stroke of strokes) {
    if (follows(route, stroke.points)) continue;
    if (offGhost < 0 || stroke.id === drawnId) offGhost = stroke.id;
  }
  return { learned: false, offGhost: offGhost >= 0 ? offGhost : drawnId };
}

// --- When ----------------------------------------------------------------------------

/**
 * What planning should teach now, if the device still needs it: what is
 * new in the room first (it is what the room is about), then the route (in
 * room 1 only), then Pour once a straw is down, the gauge once straw runs
 * low, and the dial as the kettle is about to pour by itself. `settled`
 * says what is learned, or set aside for the visit (a route skipped).
 * @param {World} world
 * @param {(id: string) => boolean} settled
 * @param {{ drafting: boolean }} state `drafting`: a straw is being drawn now
 * @returns {Cue | null}
 */
export function planningLesson(world, settled, { drafting }) {
  if (world.status !== "waiting") return null;
  const room = world.room;
  for (const fixture of fixturesOf(room)) {
    if (!settled(fixture.id)) return cue(LESSONS[fixture.id], fixture.kind, fixture.index);
  }
  if (!settled("route") && room.id === ROUTE_ROOM && ghostRoute(room)) return cue(LESSONS.route, "route");
  // Nothing breaks into a stroke being drawn.
  if (drafting) return null;
  if (!settled("pour") && world.strokes.length) return cue(LESSONS.pour, "pour");
  if (!settled("gauge") && world.strokes.length && strawLeft(world) < world.budget * LOW_SHARE) return cue(LESSONS.gauge, "gauge");
  if (!settled("dial")) {
    const left = pourCountdown(world);
    if (left > 0.25 && left <= DIAL_SOON) return cue(LESSONS.dial, "dial", firstKettle(world));
  }
  return null;
}

/** The kettle due to pour first, whose dial runs out first. @param {World} world */
function firstKettle(world) {
  let best = 0;
  world.kettles.forEach((kettle, index) => {
    if (kettle.startAt < world.kettles[best].startAt) best = index;
  });
  return best;
}

/**
 * What a room's end should teach, if the device still needs it: the stars
 * the first time a room clears, then what adds points; a spill's hint the
 * first time a room spills.
 * @param {boolean} cleared
 * @param {(id: string) => boolean} learned
 * @returns {Cue | null}
 */
export function resultLesson(cleared, learned) {
  if (cleared) {
    if (!learned("stars")) return cue(LESSONS.stars, "verdict");
    if (!learned("bonus")) return cue(LESSONS.bonus, "verdict");
    return null;
  }
  return learned("retry") ? null : cue(LESSONS.retry, "caption");
}

/**
 * Whether `next` may take the stage. A move (the route, Pour) may take over
 * once what is up has been read or is on its way out, since it is what the
 * player does next; a line about a thing waits until nothing is up and the
 * room has run quietly for `REST`. Whether the coach then accepts it is
 * still the coach's call.
 * @param {Lesson} next
 * @param {Lesson | null} current
 * @param {number} age Real seconds the current lesson has been up.
 * @param {number} [quiet] Real seconds since the last lesson came down.
 * @param {boolean} [leaving] The current lesson is on its way out.
 */
export function mayOffer(next, current, age, quiet = Infinity, leaving = false) {
  if (current) return current.id === next.id || (next.move === true && (leaving || age >= (current.minLife ?? 0.9)));
  return next.move === true || quiet >= REST;
}

/**
 * Whether `lesson` is one that holds the room while it explains: not once
 * it is done or its move is made, and never in expert, whose five seconds
 * are the rule.
 * @param {Lesson | null} lesson
 * @param {{ leaving: boolean, acting?: boolean, expert?: boolean }} state
 */
export function holds(lesson, { leaving, acting = false, expert = false }) {
  return !!lesson?.hold && !expert && !leaving && !acting;
}

/**
 * The visit's holds: each lesson may hold the room for `HOLD` real seconds
 * in a visit, all its holds together, however often it is shown (taken
 * down for a straw to be taken back and shown again, or its room opened
 * again from the level select). `take` says whether the lesson up holds
 * this frame and spends `dt` of its allowance if so; `holdable` is false
 * when there is nothing to hold (the tea is coming, or Pour was pressed),
 * which spends nothing. `clear` starts a new visit.
 * @param {boolean} expert
 */
export function createHolds(expert) {
  /** @type {Map<string, number>} */
  const used = new Map();
  return {
    /**
     * @param {Lesson | null} lesson
     * @param {{ leaving: boolean, acting?: boolean, holdable?: boolean }} state
     * @param {number} dt Real seconds this frame.
     */
    take(lesson, { leaving, acting = false, holdable = true }, dt) {
      if (!lesson || !holdable || !holds(lesson, { leaving, acting, expert })) return false;
      const spent = used.get(lesson.id) ?? 0;
      if (spent >= HOLD) return false;
      used.set(lesson.id, spent + Math.max(0, dt));
      return true;
    },
    /** Real seconds of hold `id` has left in the visit. @param {string} id */
    left(id) {
      return Math.max(0, HOLD - (used.get(id) ?? 0));
    },
    clear() {
      used.clear();
    },
  };
}

/**
 * One frame of the room's fixed clock, as the screen runs it: `dt` seconds
 * of steps, or none at all while a lesson holds planning. A held room is
 * frozen outright (the dial, a belt, a kettle on its rail, the stagger
 * between kettles), and the part-step left over is kept, so from the same
 * planning time a held room takes exactly the steps an unheld one would.
 * @param {World} world
 * @param {number} accumulator
 * @param {number} dt
 * @param {boolean} holding The lesson up holds the room (never once Pour is pressed).
 */
export function roomFrame(world, accumulator, dt, holding) {
  return frameSteps(accumulator, holding && world.status === "waiting" ? 0 : dt, STEP, MAX_FRAME);
}

/**
 * Whether the slip offers Continue: while it holds, unless doing what it
 * asks is the only way on (Pour).
 * @param {Lesson | null} lesson
 * @param {boolean} holding
 */
export const continuable = (lesson, holding) => holding && lesson?.continuable !== false;

// --- Where ---------------------------------------------------------------------------

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} Box
 * @typedef {object} Spot
 * Where a lesson points, in room units, refilled each frame (things move).
 * @property {"room" | "pour" | "gauge" | "verdict" | "caption"} place
 *   "room": at (x, y) in the room; otherwise at that control.
 * @property {number} x
 * @property {number} y
 * @property {number} ring Half the size of the pen loop round it (0: none).
 * @property {number} wide Half the width of a thing wider than the loop (Coach's `width`), else 0.
 * @property {Box[]} lit What stays lit while the lesson explains; the first `count` are in use.
 * @property {number} count
 */

/** @returns {Spot} */
export function createSpot() {
  return { place: "room", x: 0, y: 0, ring: 0, wide: 0, lit: [], count: 0 };
}

/**
 * @param {Spot} spot
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {number} [pad]
 */
function light(spot, x, y, w, h, pad = 4) {
  const box = (spot.lit[spot.count] ??= { x: 0, y: 0, w: 0, h: 0 });
  box.x = x - pad;
  box.y = y - pad;
  box.w = w + pad * 2;
  box.h = h + pad * 2;
  spot.count++;
}

/**
 * Rings a thing of half extents `hw` × `hh` centred at (x, y): the loop
 * fits round it (Coach draws it 1.75 rings tall and 2.3 wide, stretched by
 * `wide`), and the slip sits clear of it, up to a size (`cap`, room units)
 * that still reads as pointing at one thing.
 * @param {Spot} spot
 * @param {number} x @param {number} y @param {number} hw @param {number} hh
 * @param {number} [cap]
 */
function ringRound(spot, x, y, hw, hh, cap = 40) {
  spot.place = "room";
  spot.x = x;
  spot.y = y;
  spot.ring = (clamp(hh, 3, cap) + 3) / 0.875;
  const half = clamp(hw, 3, cap * 2) + 3;
  spot.wide = half > spot.ring * 1.15 ? half - 6 : 0;
}

/**
 * The box round a kettle and its dial, in room units: the spout is at
 * (x, y) and the body hangs back from it, against the way it pours.
 * @param {Spot} spot
 * @param {World["kettles"][number]} kettle
 */
function lightKettle(spot, kettle) {
  const back = kettle.vx < 0 ? 1 : -1;
  const x0 = back > 0 ? kettle.x - 4 : kettle.x - 30;
  light(spot, x0, kettle.y - 44, 34, 58);
}

/** @param {Spot} spot @param {World["cups"][number]} cup */
function lightCup(spot, cup) {
  light(spot, cup.x - cup.w / 2, cup.y - cup.h, cup.w, cup.h, 6);
}

/** Every straw down, as one box. @param {Spot} spot @param {World} world */
function lightStraws(spot, world) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const stroke of world.strokes) {
    for (const [x, y] of stroke.points) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x0 <= x1) light(spot, x0, y0, x1 - x0, y1 - y0, 6);
}

/** @param {Spot} spot @param {World} world */
function lightKettlesAndCups(spot, world) {
  for (const kettle of world.kettles) lightKettle(spot, kettle);
  for (const cup of world.cups) lightCup(spot, cup);
}

/**
 * The y of a cup's fill line (the amount its order needs), as the cup
 * draws it.
 * @param {World["cups"][number]} cup
 * @param {number} cupWall the engine's CUP_WALL
 */
export function fillLineY(cup, cupWall) {
  const inner = cup.w - cupWall * 4;
  const top = Math.round(cup.y - cup.h);
  return Math.max(top + 2, Math.round(cup.y - cupWall * 2 - (cup.order.need * AREA_PER_DROP) / inner));
}

/**
 * Fills `spot` with where `target` is in `world` now, and what to keep lit.
 * Returns false when the thing is gone (a straw taken back).
 * @param {Target} target
 * @param {World} world
 * @param {Spot} spot
 * @param {{ cupWall: number, dial?: { x: number, y: number } | null }} extra
 *   The cup wall, and the dial's centre as the kettle draws it.
 */
export function aim(target, world, spot, { cupWall, dial = null }) {
  spot.count = 0;
  spot.ring = 0;
  spot.wide = 0;
  spot.place = "room";
  const index = target.index;
  switch (target.kind) {
    case "route": {
      const route = ghostRoute(world.room);
      if (!route) return false;
      // The loop sits on the start, where the pen goes down.
      spot.x = route[0].x;
      spot.y = route[0].y;
      spot.ring = 7;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const point of route) {
        x0 = Math.min(x0, point.x);
        y0 = Math.min(y0, point.y);
        x1 = Math.max(x1, point.x);
        y1 = Math.max(y1, point.y);
      }
      light(spot, x0, y0, x1 - x0, y1 - y0, 10);
      lightKettlesAndCups(spot, world);
      return true;
    }
    case "straw": {
      let stroke = null;
      for (const s of world.strokes) if (s.id === index) stroke = s;
      if (!stroke) return false;
      // Round the whole straw, so the slip sits clear of all of it.
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [x, y] of stroke.points) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      ringRound(spot, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 2, (y1 - y0) / 2 + 2, HEIGHT / 2);
      light(spot, x0, y0, x1 - x0, y1 - y0, 6);
      return true;
    }
    case "pour":
      spot.place = "pour";
      lightStraws(spot, world);
      lightKettlesAndCups(spot, world);
      return true;
    case "gauge":
      spot.place = "gauge";
      lightStraws(spot, world);
      return true;
    case "verdict":
      spot.place = "verdict";
      for (const cup of world.cups) lightCup(spot, cup);
      return true;
    case "caption":
      spot.place = "caption";
      lightKettlesAndCups(spot, world);
      return true;
    case "dial": {
      const kettle = world.kettles[index];
      if (!kettle) return false;
      spot.x = dial?.x ?? kettle.x;
      spot.y = dial?.y ?? kettle.y - 30;
      spot.ring = 10;
      lightKettle(spot, kettle);
      return true;
    }
    case "line": {
      const cup = world.cups[index];
      if (!cup) return false;
      spot.x = cup.x;
      spot.y = fillLineY(cup, cupWall);
      spot.ring = 6;
      spot.wide = cup.w / 2;
      lightCup(spot, cup);
      return true;
    }
    case "block": {
      const block = world.blocks[index];
      if (!block) return false;
      // A block is centred on (x, y), turned by its angle: the box round it.
      const c = Math.abs(Math.cos(block.angle ?? 0));
      const s = Math.abs(Math.sin(block.angle ?? 0));
      const hw = (block.w / 2) * c + (block.h / 2) * s;
      const hh = (block.w / 2) * s + (block.h / 2) * c;
      ringRound(spot, block.x, block.y, hw, hh);
      light(spot, block.x - hw, block.y - hh, hw * 2, hh * 2);
      return true;
    }
    case "fan": {
      const fan = world.fans[index];
      if (!fan) return false;
      ringRound(spot, fan.x + fan.w / 2, fan.y + fan.h / 2, fan.w / 2, fan.h / 2);
      light(spot, fan.x, fan.y, fan.w, fan.h);
      return true;
    }
    case "cup": {
      const cup = world.cups[index];
      if (!cup) return false;
      ringRound(spot, cup.x, cup.y - cup.h / 2, cup.w / 2, cup.h / 2);
      lightCup(spot, cup);
      if (cup.conveyor) {
        const range = Math.abs(cup.conveyor.range);
        light(spot, cup.baseX - range - cup.w / 2, cup.y - cup.h, range * 2 + cup.w, cup.h + 14);
      }
      return true;
    }
    case "band": {
      const cup = world.cups[index];
      if (!cup) return false;
      // The band is drawn up the cup's outer side, toward the room's middle.
      const side = cup.x < WIDTH / 2 ? 1 : -1;
      ringRound(spot, cup.x + side * (cup.w / 2 + 3), cup.y - cup.h / 2, 4, cup.h / 2);
      lightCup(spot, cup);
      for (const kettle of world.kettles) if (kettle.kind === MILK) lightKettle(spot, kettle);
      return true;
    }
    case "pipe": {
      const pipe = world.pipes[index];
      if (!pipe) return false;
      spot.x = pipe.a.x;
      spot.y = pipe.a.y;
      spot.ring = PIPE_MOUTH + 4;
      let x0 = Math.min(pipe.a.x, pipe.b.x);
      let y0 = Math.min(pipe.a.y, pipe.b.y);
      let x1 = Math.max(pipe.a.x, pipe.b.x);
      let y1 = Math.max(pipe.a.y, pipe.b.y);
      for (const [x, y] of pipe.path ?? []) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      light(spot, x0, y0, x1 - x0, y1 - y0, PIPE_MOUTH + 3);
      return true;
    }
    case "hopper": {
      const hopper = world.hopper;
      if (!hopper) return false;
      ringRound(spot, hopper.x, hopper.y - 11, 10, 11);
      light(spot, hopper.x - 10, hopper.y - 22, 20, 26);
      for (const cup of world.cups) if (cup.order.pearls) lightCup(spot, cup);
      return true;
    }
    case "scale": {
      const scale = world.scales[index];
      if (!scale) return false;
      ringRound(spot, scale.x, scale.y - scale.h / 2, scale.w / 2, scale.h / 2);
      // The pan and its dial underneath, and the gate it opens.
      light(spot, scale.x - scale.w / 2, scale.y - scale.h, scale.w, scale.h + 18);
      const gate = world.gates[scale.gate];
      if (gate) light(spot, Math.min(gate.x1, gate.x2), Math.min(gate.y1, gate.y2), Math.abs(gate.x2 - gate.x1), Math.abs(gate.y2 - gate.y1), 8);
      return true;
    }
    case "glass": {
      const zone = world.room.noDraw?.[index];
      if (!zone) return false;
      ringRound(spot, zone.x + zone.w / 2, zone.y + zone.h / 2, zone.w / 2, zone.h / 2);
      light(spot, zone.x, zone.y, zone.w, zone.h);
      return true;
    }
    case "kettle": {
      const kettle = world.kettles[index];
      if (!kettle) return false;
      ringRound(spot, kettle.x - (kettle.vx < 0 ? -12 : 12), kettle.y - 12, 16, 14);
      const reach = Math.abs(kettle.rail?.range ?? 0);
      // Its whole run, from the slot in the trim down past the spout.
      light(spot, kettle.baseX - reach - 34, -8, reach * 2 + 68, kettle.y + 18);
      return true;
    }
    case "sieve": {
      const sieve = world.sieves[index];
      if (!sieve) return false;
      const hw = Math.abs(sieve.x2 - sieve.x1) / 2;
      const hh = Math.abs(sieve.y2 - sieve.y1) / 2;
      ringRound(spot, (sieve.x1 + sieve.x2) / 2, (sieve.y1 + sieve.y2) / 2, hw, hh);
      light(spot, Math.min(sieve.x1, sieve.x2), Math.min(sieve.y1, sieve.y2), hw * 2, hh * 2, 6);
      return true;
    }
    default:
      return false;
  }
}

/**
 * Which side of a room point a callout would rather sit on (the screen
 * falls back to another where that doesn't fit): above a thing in the lower
 * part of the room, below one high up, so the slip covers neither the
 * thing nor the floor where the cups are. The route's slip goes above its
 * start when the route runs down from there.
 * @param {Target} target
 * @param {Spot} spot
 * @param {Room} room
 * @returns {"above" | "below"}
 */
export function sideFor(target, spot, room) {
  if (target.kind === "route") {
    const route = ghostRoute(room);
    const runsDown = !!route && route[route.length - 1].y >= route[0].y;
    return runsDown && spot.y > 70 ? "above" : "below";
  }
  return spot.y > HEIGHT * 0.4 ? "above" : "below";
}
