// Spill rules: a kettle pours a stream of tea and the player draws straws
// (short ramps) to steer it into the cup instead of onto the floor. Kept free
// of the DOM, of Math.random and of Date, so a room, its straws and its timing
// always replay the same way under node.
//
// The room is a portrait box WIDTH × HEIGHT in its own units, origin at the
// top-left, x to the right and y DOWN (screen order), so gravity is +y and the
// floor is the line y = FLOOR. The sides and the top are open: anything that
// leaves the box is gone.
//
// The liquid is a small position-based particle simulation. Each fixed step
// integrates gravity, pushes overlapping particles apart over a spatial hash
// (so tea has volume and a cup visibly fills), projects particles out of line
// segments (walls, cups, straws, fixtures) with a swept test so nothing
// tunnels, then derives velocity from the change in position and applies
// bounce and friction at contacts. Every per-particle quantity lives in a typed
// array sized once, so the hot loop allocates nothing.

import { ROOMS } from "./spill-rooms.js";

export { ROOMS };

export const WIDTH = 240;
export const HEIGHT = 300;
/** The floor is the bottom edge of the room. */
export const FLOOR = HEIGHT;
/** The fixed step the screen calls `step` with. */
export const STEP = 1 / 120;
export const GRAVITY = 520;
/** Terminal speed, so a long fall stays readable and the swept test stays cheap. */
export const MAX_SPEED = 320;
export const MAX_PARTICLES = 512;

export const TEA = 0;
export const MILK = 1;
export const PEARL = 2;
/** @type {ReadonlyArray<string>} */
export const KIND_NAMES = ["tea", "milk", "pearl"];
/** Collision radius by kind. */
export const RADIUS = [2.2, 2.2, 3.6];
/** Inverse mass by kind: a pearl outweighs four droplets. */
const INV_MASS = [1, 1, 0.25];
/** What a particle weighs on a scale, by kind. */
export const WEIGHT = [1, 1, 4];

/** A drawn straw's half thickness. */
export const STRAW_HALF = 1.5;
/** Points closer than this to the last kept point are dropped while drawing. */
export const MIN_SEGMENT = 6;
/** Douglas–Peucker tolerance applied when a stroke is committed. */
const SIMPLIFY_EPSILON = 0.6;
/** Cup walls' half thickness. */
export const CUP_WALL = 1.5;

/** Particle flags. */
export const SPILLED = 1;
export const IN_PIPE = 2;
const DEAD = 4;

/** Segment kinds. */
const SEG_SOLID = 0;
const SEG_STRAW = 1;
const SEG_SPONGE = 2;
const SEG_HOT = 3;
const SEG_JELLY = 4;
const SEG_GATE = 5;
const SEG_CUP = 6;

/** How hard overlapping particles are pushed apart each step, and the cap. */
const STIFFNESS = 0.8;
/** Passes over the pairs per step: more makes the liquid stiffer, so a cup holds what it looks like it holds. */
const SEPARATION_PASSES = 3;
const MAX_PUSH = 1.5;
/** Share of a push that is held back from the derived velocity. */
const PUSH_HELD = 0.7;
/** Share of the closing speed two touching droplets lose, so streams stay together. */
const VISCOSITY = 0.12;
/** A droplet's slide along a straw keeps (1 - friction) of its speed each contact step. */
const DROP_FRICTION = 0.008;
const PEARL_FRICTION = 0.001;
const FLOOR_FRICTION = 0.25;
/** Slide lost per unit of impact speed when a droplet lands on a surface. */
const SPLAT = 0.0012;
/** Droplets this close above the floor, outside a cup, count as puddle. */
const PUDDLE = 8;
const JELLY_BOUNCE = 0.85;
const BOUNCE = 0.08;

/** See `fresh` in createWorld. */
const FRESH_SECONDS = 0.18;
/** Particle hash: 8-unit cells cover the largest pair (two pearls). */
const GRID_X0 = -24;
const GRID_Y0 = -48;
const CELL = 8;
const COLS = Math.ceil((WIDTH - 2 * GRID_X0) / CELL);
const ROWS = Math.ceil((FLOOR - GRID_Y0 + 16) / CELL);
/** Segment broadphase: coarser cells, rebuilt only when segments change. */
const SEG_CELL = 16;
const SEG_COLS = Math.ceil((WIDTH - 2 * GRID_X0) / SEG_CELL);
const SEG_ROWS = Math.ceil((FLOOR - GRID_Y0 + 16) / SEG_CELL);
const MAX_SEGMENTS = 1024;
const MAX_SEG_REFS = 16384;
/** How far past a segment's thickness the broadphase reaches: a pearl plus a step. */
const SEG_MARGIN = 3.6 + 4;

/** A room has settled when hardly anything moved SETTLE_DRIFT in a window, twice running. */
const SETTLE_WINDOW = 0.25;
const SETTLE_DRIFT = 1;
const SETTLE_SECONDS = 0.5;
/** A room resolves this long after the last pour even if something still sloshes. */
const SETTLE_TIMEOUT = 5;
/** The conveyor runs on this long after the pours end, then eases to a stop. */
const BELT_RUN_ON = 1;
const BELT_EASE = 0.8;

/** Pipes: mouth radius, how long a transit takes, and the exit speed. */
export const PIPE_MOUTH = 7;
const PIPE_TRANSIT = 0.3;
const PIPE_EXIT_SPEED = 90;
const PIPE_COOLDOWN = 0.3;

/** Kettle spouts keep a square of this half size clear of straws. */
const SPOUT_CLEAR = 14;

/**
 * Seconds of planning before the kettles pour, unless a room sets its own
 * `plan`. The player can end it early with pourNow, for a bonus.
 */
export const DEFAULT_PLAN = 20;
/** The most an early pour earns, for pouring the instant the room opens. */
const EARLY_BONUS = 40;

export const START_LIVES = 3;
/** A run may start at these room indices once they have been reached. */
export const CHECKPOINTS = [0, 6, 12];
/** Points credited for each room skipped by starting at a checkpoint. */
export const PAR_POINTS = 220;

/** Event types emitted by `step`, read from `world.events`. */
export const EVENTS = Object.freeze({
  POUR_START: 1,
  POUR_STOP: 2,
  INTO_CUP: 3,
  SPLASH: 4,
  ABSORBED: 5,
  BOILED: 6,
  BOUNCE: 7,
  PIPE: 8,
  GATE_OPEN: 9,
  PEARL_IN_CUP: 10,
  CUP_FULL: 11,
  CLEARED: 12,
  FAILED: 13,
  PEARLS_DROP: 14,
});
/** @type {ReadonlyArray<string>} */
export const EVENT_NAMES = [
  "",
  "pour start",
  "pour stop",
  "into cup",
  "splash",
  "absorbed",
  "boiled",
  "bounce",
  "pipe",
  "gate open",
  "pearl in cup",
  "cup full",
  "room cleared",
  "room failed",
  "pearls drop",
];
const EVENT_CAP = 96;
/** Shortest gap between two events of a chatty type, seconds. */
const INTO_CUP_GAP = 1 / 30;
const SPLASH_GAP = 1 / 40;
const BOUNCE_GAP = 1 / 30;

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {{
 *   x: number, y: number, vx: number, vy: number, count: number, rate: number,
 *   delay?: number, kind?: "tea" | "milk"
 * }} KettleSpec spout at (x, y), pouring with velocity (vx, vy); delay is
 *   seconds after the planning time ends (a stagger), default 0
 * @typedef {{
 *   need: number, full: number, milk?: number, tol?: number, pearls?: number
 * }} Order need is the minimum count of droplets; full is the full line
 * @typedef {{ range: number, period: number, phase?: number }} Conveyor
 * @typedef {{ x: number, y: number, w: number, h: number, order: Order, conveyor?: Conveyor }} CupSpec
 *   x is the cup's centre, y its bottom
 * @typedef {{ type: "ice" | "jelly" | "sponge" | "hot", x: number, y: number, w: number, h: number, angle?: number }} BlockSpec
 *   x, y is the centre; angle in radians, clockwise on screen
 * @typedef {{ x: number, y: number, w: number, h: number, fx: number, fy: number }} FanSpec
 *   a region (top-left x, y) that accelerates droplets by (fx, fy)
 * @typedef {{ x: number, y: number, nx: number, ny: number }} PipeEnd a mouth and the way out of it
 * @typedef {{ a: PipeEnd, b: PipeEnd, path?: Array<[number, number]> }} PipeSpec
 * @typedef {{ x: number, y: number, w: number, h: number, need: number, gate: number }} ScaleSpec
 *   a shallow pan, centre x and bottom y; enough weight opens gates[gate]
 * @typedef {{ x1: number, y1: number, x2: number, y2: number }} GateSpec
 * @typedef {{ x: number, y: number, count: number, interval?: number }} HopperSpec
 * @typedef {{ strokes: Array<Array<[number, number]>>, pourAt?: number }} Solution
 * @typedef {{
 *   id: string, name: string, page: number, idea: string, hint: string, straw: number,
 *   kettles: KettleSpec[], cups: CupSpec[], blocks?: BlockSpec[], fans?: FanSpec[],
 *   pipes?: PipeSpec[], scales?: ScaleSpec[], gates?: GateSpec[], hopper?: HopperSpec,
 *   noDraw?: Rect[], seed?: number, solution: Solution, keep?: [number, number], plan?: number,
 *   remix?: { difficulty: number, mirrored: boolean, of: string }
 * }} Room
 * @typedef {{ id: number, points: Array<[number, number]>, length: number }} Stroke
 */

/**
 * A small seeded generator (mulberry32).
 * @param {number} seed
 * @returns {() => number} values in [0, 1)
 */
export function createRng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {string} text */
function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * @param {number} value
 * @param {number} low
 * @param {number} high
 */
function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

// --- World -----------------------------------------------------------------------

/**
 * Builds a playable world for a room: particle buffers, segments, cups and
 * kettles, all at rest and waiting for the pour.
 * @param {Room} room
 */
export function createWorld(room) {
  const n = MAX_PARTICLES;
  const p = {
    x: new Float64Array(n),
    y: new Float64Array(n),
    /** Positions at the start of the last step, for interpolating a frame. */
    px: new Float64Array(n),
    py: new Float64Array(n),
    /**
     * Where the velocity is measured from: the start position, nudged by
     * contacts between particles so the derived velocity carries them.
     */
    qx: new Float64Array(n),
    qy: new Float64Array(n),
    vx: new Float64Array(n),
    vy: new Float64Array(n),
    /** Where each particle was at the last settle check. */
    rx: new Float64Array(n),
    ry: new Float64Array(n),
    kind: new Uint8Array(n),
    flags: new Uint8Array(n),
    /** Which cup the particle is counted in, or -1. */
    cup: new Int8Array(n),
    /** Pipe transit time left while IN_PIPE; re-entry cooldown otherwise. */
    timer: new Float64Array(n),
    /**
     * Seconds a new droplet ignores other new droplets, so the spout's stream
     * spreads out under gravity instead of bursting apart at the lip.
     */
    fresh: new Float64Array(n),
    /** Pipe index and the end it entered, while IN_PIPE. */
    pipe: new Int8Array(n),
    pipeEnd: new Uint8Array(n),
    // The last contact this step, for bounce and friction.
    cnx: new Float64Array(n),
    cny: new Float64Array(n),
    cvn: new Float64Array(n),
    csvx: new Float64Array(n),
    csvy: new Float64Array(n),
    crest: new Float64Array(n),
    cfric: new Float64Array(n),
    contact: new Uint8Array(n),
  };
  const seg = {
    count: 0,
    ax: new Float64Array(MAX_SEGMENTS),
    ay: new Float64Array(MAX_SEGMENTS),
    bx: new Float64Array(MAX_SEGMENTS),
    by: new Float64Array(MAX_SEGMENTS),
    /** Where a cup segment sits with the belt at rest. */
    bax: new Float64Array(MAX_SEGMENTS),
    bbx: new Float64Array(MAX_SEGMENTS),
    half: new Float64Array(MAX_SEGMENTS),
    kind: new Uint8Array(MAX_SEGMENTS),
    owner: new Int16Array(MAX_SEGMENTS),
    /** Surface velocity, and how far the segment moved this step. */
    vx: new Float64Array(MAX_SEGMENTS),
    dx: new Float64Array(MAX_SEGMENTS),
    moving: new Uint8Array(MAX_SEGMENTS),
    dynamic: new Int32Array(64),
    dynamicCount: 0,
    gridStart: new Int32Array(SEG_COLS * SEG_ROWS + 1),
    gridItems: new Int32Array(MAX_SEG_REFS),
    gridFill: new Int32Array(SEG_COLS * SEG_ROWS),
  };
  const cells = COLS * ROWS;
  const hash = {
    start: new Int32Array(cells + 1),
    fill: new Int32Array(cells),
    items: new Int32Array(n),
    cellOf: new Int32Array(n),
  };
  const events = {
    count: 0,
    type: new Uint8Array(EVENT_CAP),
    x: new Float64Array(EVENT_CAP),
    y: new Float64Array(EVENT_CAP),
    /** The cup, kettle, pipe or gate the event is about, or -1. */
    a: new Int32Array(EVENT_CAP),
    /** A running count where one helps (a cup's droplets), else the particle kind. */
    b: new Int32Array(EVENT_CAP),
  };

  const plan = room.plan ?? DEFAULT_PLAN;
  const kettles = room.kettles.map((k) => ({
    x: k.x,
    y: k.y,
    vx: k.vx,
    vy: k.vy,
    kind: k.kind === "milk" ? MILK : TEA,
    count: k.count,
    rate: k.rate,
    /** When this kettle was due to start: the planning time plus its stagger. */
    delay: plan + (k.delay ?? 0),
    /** When this kettle starts, moved earlier by "pour now". */
    startAt: plan + (k.delay ?? 0),
    left: k.count,
    started: false,
    acc: 0,
  }));
  const cups = room.cups.map((c) => ({
    x: c.x,
    baseX: c.x,
    y: c.y,
    w: c.w,
    h: c.h,
    order: c.order,
    conveyor: c.conveyor ?? null,
    tea: 0,
    milk: 0,
    pearls: 0,
    count: 0,
    full: false,
    lastInto: -1,
  }));
  const scales = (room.scales ?? []).map((s) => ({ ...s, weight: 0, tripped: false }));
  const gates = (room.gates ?? []).map((g) => ({ ...g, open: false }));
  const hopper = room.hopper
    ? { ...room.hopper, interval: room.hopper.interval ?? 0.22, left: room.hopper.count, next: 0 }
    : null;

  const noDraw = [...(room.noDraw ?? [])];
  for (const k of room.kettles) {
    noDraw.push({ x: k.x - SPOUT_CLEAR, y: k.y - SPOUT_CLEAR, w: SPOUT_CLEAR * 2, h: SPOUT_CLEAR * 2 });
  }

  const world = {
    room,
    /** Seconds of planning before the pour. */
    plan,
    time: 0,
    /** @type {"waiting" | "pouring" | "settling" | "cleared" | "failed"} */
    status: /** @type {"waiting" | "pouring" | "settling" | "cleared" | "failed"} */ ("waiting"),
    random: createRng(room.seed ?? hashString(room.id)),
    p,
    /** Particles live in indices [0, count). */
    count: 0,
    seg,
    hash,
    events,
    kettles,
    cups,
    scales,
    gates,
    hopper,
    /** @type {FanSpec[]} */
    fans: room.fans ?? [],
    /** @type {PipeSpec[]} */
    pipes: room.pipes ?? [],
    /** @type {BlockSpec[]} */
    blocks: room.blocks ?? [],
    /** Each block's four corners, clockwise on screen, flattened. */
    blockCorners: Float64Array.from((room.blocks ?? []).flatMap((block) => blockCorners(block).flat())),
    noDraw,
    budget: room.straw,
    /** @type {Stroke[]} */
    strokes: [],
    /** @type {Array<[number, number]> | null} the stroke being drawn */
    draft: null,
    draftLength: 0,
    nextStrokeId: 1,
    /** When the first kettle actually started, or -1. */
    pourStartedAt: -1,
    /** When the last pour ended, or -1. */
    pourEndedAt: -1,
    beltTime: 0,
    beltSpeed: 1,
    quiet: 0,
    settleClock: 0,
    stats: { poured: 0, pearls: 0, spilled: 0, absorbed: 0, boiled: 0, piped: 0 },
    lastSplash: -1,
    lastBounce: -1,
    /** @type {RoomResult | null} */
    result: null,
  };
  rebuildSegments(world);
  return world;
}

/** @typedef {ReturnType<typeof createWorld>} World */

// --- Segments ---------------------------------------------------------------------

/**
 * @param {World} world
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @param {number} half
 * @param {number} kind
 * @param {number} owner
 * @param {boolean} [moving]
 */
function addSegment(world, ax, ay, bx, by, half, kind, owner, moving = false) {
  const s = world.seg;
  const i = s.count;
  if (i >= MAX_SEGMENTS) return;
  s.ax[i] = ax;
  s.ay[i] = ay;
  s.bx[i] = bx;
  s.by[i] = by;
  s.bax[i] = ax;
  s.bbx[i] = bx;
  s.half[i] = half;
  s.kind[i] = kind;
  s.owner[i] = owner;
  s.vx[i] = 0;
  s.dx[i] = 0;
  s.moving[i] = moving ? 1 : 0;
  s.count++;
}

/**
 * The corners of a block, clockwise on screen.
 * @param {BlockSpec} block
 * @returns {Array<[number, number]>}
 */
export function blockCorners(block) {
  const angle = block.angle ?? 0;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const hw = block.w / 2;
  const hh = block.h / 2;
  /** @type {Array<[number, number]>} */
  const local = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  return local.map(([lx, ly]) => [block.x + lx * c - ly * s, block.y + lx * s + ly * c]);
}

/**
 * The three walls of a cup (left, bottom, right) at belt offset 0.
 * @param {{ x: number, y: number, w: number, h: number }} cup
 * @returns {Array<[number, number, number, number]>}
 */
export function cupWalls(cup) {
  const l = cup.x - cup.w / 2 + CUP_WALL;
  const r = cup.x + cup.w / 2 - CUP_WALL;
  const top = cup.y - cup.h;
  const bottom = cup.y - CUP_WALL;
  return [
    [l, top, l, bottom],
    [l, bottom, r, bottom],
    [r, bottom, r, top],
  ];
}

/**
 * The counting region inside a cup at its current position.
 * @param {{ x: number, y: number, w: number, h: number }} cup
 * @returns {Rect}
 */
export function cupInterior(cup) {
  const inset = CUP_WALL * 2;
  return { x: cup.x - cup.w / 2 + inset, y: cup.y - cup.h - 1, w: cup.w - inset * 2, h: cup.h - inset + 1 };
}

/**
 * Rewrites every segment from the room, its open gates and the strokes, and
 * rebuilds the broadphase. Called when a stroke lands or goes, or a gate
 * opens: never per step.
 * @param {World} world
 */
function rebuildSegments(world) {
  const s = world.seg;
  s.count = 0;
  s.dynamicCount = 0;
  world.blocks.forEach((block, b) => {
    const kind =
      block.type === "jelly" ? SEG_JELLY : block.type === "sponge" ? SEG_SPONGE : block.type === "hot" ? SEG_HOT : SEG_SOLID;
    const corners = blockCorners(block);
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = corners[i];
      const [bx, by] = corners[(i + 1) % 4];
      addSegment(world, ax, ay, bx, by, 0.5, kind, b);
    }
  });
  world.cups.forEach((cup, c) => {
    const moving = !!cup.conveyor;
    for (const [ax, ay, bx, by] of cupWalls({ ...cup, x: cup.baseX })) {
      const i = s.count;
      addSegment(world, ax, ay, bx, by, CUP_WALL, SEG_CUP, c, moving);
      if (moving && s.dynamicCount < s.dynamic.length) s.dynamic[s.dynamicCount++] = i;
    }
  });
  world.scales.forEach((scale, k) => {
    for (const [ax, ay, bx, by] of cupWalls(scale)) addSegment(world, ax, ay, bx, by, CUP_WALL, SEG_SOLID, k);
  });
  world.gates.forEach((gate, g) => {
    if (!gate.open) addSegment(world, gate.x1, gate.y1, gate.x2, gate.y2, 2, SEG_GATE, g);
  });
  world.strokes.forEach((stroke) => {
    for (let i = 1; i < stroke.points.length; i++) {
      const [ax, ay] = stroke.points[i - 1];
      const [bx, by] = stroke.points[i];
      addSegment(world, ax, ay, bx, by, STRAW_HALF, SEG_STRAW, stroke.id);
    }
  });
  placeCups(world, 0);
  buildSegmentGrid(world);
}

/**
 * Two-pass counting fill of the static segments into the coarse grid.
 * @param {World} world
 */
function buildSegmentGrid(world) {
  const s = world.seg;
  const start = s.gridStart;
  start.fill(0);
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      // Prefix sums turn counts into where each cell's list begins.
      for (let c = 1; c < start.length; c++) start[c] += start[c - 1];
      s.gridFill.set(start.subarray(0, s.gridFill.length));
    }
    for (let i = 0; i < s.count; i++) {
      if (s.moving[i]) continue;
      const pad = s.half[i] + SEG_MARGIN;
      const c0 = clamp(Math.floor((Math.min(s.ax[i], s.bx[i]) - pad - GRID_X0) / SEG_CELL), 0, SEG_COLS - 1);
      const c1 = clamp(Math.floor((Math.max(s.ax[i], s.bx[i]) + pad - GRID_X0) / SEG_CELL), 0, SEG_COLS - 1);
      const r0 = clamp(Math.floor((Math.min(s.ay[i], s.by[i]) - pad - GRID_Y0) / SEG_CELL), 0, SEG_ROWS - 1);
      const r1 = clamp(Math.floor((Math.max(s.ay[i], s.by[i]) + pad - GRID_Y0) / SEG_CELL), 0, SEG_ROWS - 1);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const cell = r * SEG_COLS + c;
          if (pass === 0) start[cell + 1]++;
          else {
            const slot = s.gridFill[cell]++;
            if (slot < MAX_SEG_REFS) s.gridItems[slot] = i;
          }
        }
      }
    }
  }
}

/**
 * Slides conveyor cups to their offset for the current belt time.
 * @param {World} world
 * @param {number} dt
 */
function placeCups(world, dt) {
  const s = world.seg;
  for (let c = 0; c < world.cups.length; c++) {
    const cup = world.cups[c];
    const belt = cup.conveyor;
    if (!belt) continue;
    const offset = belt.range * Math.sin((2 * Math.PI * world.beltTime) / belt.period + (belt.phase ?? 0));
    const moved = cup.baseX + offset - cup.x;
    cup.x = cup.baseX + offset;
    for (let k = 0; k < s.dynamicCount; k++) {
      const i = s.dynamic[k];
      if (s.owner[i] !== c) continue;
      s.ax[i] = s.bax[i] + offset;
      s.bx[i] = s.bbx[i] + offset;
      s.dx[i] = moved;
      s.vx[i] = dt > 0 ? moved / dt : 0;
    }
  }
}

// --- Strokes ----------------------------------------------------------------------

/**
 * Whether a straw segment from a to b (with its thickness) touches a rect.
 * @param {Rect} r
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 */
function segmentHitsRect(r, ax, ay, bx, by) {
  const x0 = r.x - STRAW_HALF;
  const y0 = r.y - STRAW_HALF;
  const x1 = r.x + r.w + STRAW_HALF;
  const y1 = r.y + r.h + STRAW_HALF;
  // Liang–Barsky clip of the segment against the padded rect.
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const edges = [
    [-dx, ax - x0],
    [dx, x1 - ax],
    [-dy, ay - y0],
    [dy, y1 - ay],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

/**
 * Whether a point (with a straw's thickness) is in a no-draw zone.
 * @param {World} world
 * @param {number} x
 * @param {number} y
 */
export function inNoDraw(world, x, y) {
  return world.noDraw.some((r) => segmentHitsRect(r, x, y, x, y));
}

/** @param {Array<[number, number]>} points */
export function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return length;
}

/**
 * Straw left to draw with, counting the stroke in progress.
 * @param {World} world
 */
export function strawLeft(world) {
  let used = world.draftLength;
  for (const stroke of world.strokes) used += stroke.length;
  return Math.max(0, world.budget - used);
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {[number, number]}
 */
function clampToRoom(x, y) {
  return [clamp(x, 0, WIDTH), clamp(y, 0, FLOOR)];
}

/**
 * Starts a stroke at a point. Refused in a no-draw zone or with no straw left.
 * @param {World} world
 * @param {number} x
 * @param {number} y
 */
export function beginStroke(world, x, y) {
  const [cx, cy] = clampToRoom(x, y);
  if (inNoDraw(world, cx, cy) || strawLeft(world) < MIN_SEGMENT) {
    world.draft = null;
    return false;
  }
  world.draft = [[cx, cy]];
  world.draftLength = 0;
  return true;
}

/**
 * Extends the stroke toward a point. Points closer than MIN_SEGMENT are
 * skipped; a segment that would enter a no-draw zone is refused; a segment
 * longer than the straw left is cut short. Returns whether the point (or part
 * of it) was taken.
 * @param {World} world
 * @param {number} x
 * @param {number} y
 */
export function extendStroke(world, x, y) {
  const draft = world.draft;
  if (!draft) return false;
  const [lx, ly] = draft[draft.length - 1];
  let [cx, cy] = clampToRoom(x, y);
  let length = Math.hypot(cx - lx, cy - ly);
  if (length < MIN_SEGMENT) return false;
  const left = strawLeft(world);
  if (left < 0.5) return false;
  if (length > left) {
    cx = lx + ((cx - lx) * left) / length;
    cy = ly + ((cy - ly) * left) / length;
    length = left;
  }
  for (const r of world.noDraw) if (segmentHitsRect(r, lx, ly, cx, cy)) return false;
  draft.push([cx, cy]);
  world.draftLength += length;
  return true;
}

/**
 * Douglas–Peucker, so a wobbly line costs and collides as the line it meant.
 * @param {Array<[number, number]>} points
 * @param {number} epsilon
 * @returns {Array<[number, number]>}
 */
export function simplify(points, epsilon = SIMPLIFY_EPSILON) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  /** @type {Array<[number, number]>} */
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i0, i1] = /** @type {[number, number]} */ (stack.pop());
    const [ax, ay] = points[i0];
    const [bx, by] = points[i1];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let worst = -1;
    let worstDist = epsilon;
    for (let i = i0 + 1; i < i1; i++) {
      const d = Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / len;
      if (d > worstDist) {
        worst = i;
        worstDist = d;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([i0, worst], [worst, i1]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Lays the stroke in progress down as a straw. Returns its id, or -1 if it
 * was too short to keep.
 * @param {World} world
 */
export function commitStroke(world) {
  const draft = world.draft;
  world.draft = null;
  world.draftLength = 0;
  if (!draft || draft.length < 2) return -1;
  const points = simplify(draft);
  const length = polylineLength(points);
  if (length < MIN_SEGMENT) return -1;
  const id = world.nextStrokeId++;
  world.strokes.push({ id, points, length });
  rebuildSegments(world);
  return id;
}

/** @param {World} world */
export function cancelStroke(world) {
  world.draft = null;
  world.draftLength = 0;
}

/**
 * The stroke nearest a point within `slop` units, for removal, or -1.
 * @param {World} world
 * @param {number} x
 * @param {number} y
 * @param {number} [slop]
 */
export function strokeAt(world, x, y, slop = 8) {
  let best = -1;
  let bestDist = slop;
  for (const stroke of world.strokes) {
    for (let i = 1; i < stroke.points.length; i++) {
      const [ax, ay] = stroke.points[i - 1];
      const [bx, by] = stroke.points[i];
      const dx = bx - ax;
      const dy = by - ay;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
      if (d <= bestDist) {
        best = stroke.id;
        bestDist = d;
      }
    }
  }
  return best;
}

/**
 * Takes a straw away, refunding its length. Returns whether it existed.
 * @param {World} world
 * @param {number} id
 */
export function removeStroke(world, id) {
  const index = world.strokes.findIndex((stroke) => stroke.id === id);
  if (index < 0) return false;
  world.strokes.splice(index, 1);
  rebuildSegments(world);
  return true;
}

/** Removes the newest straw. @param {World} world */
export function undoStroke(world) {
  const last = world.strokes[world.strokes.length - 1];
  return last ? removeStroke(world, last.id) : false;
}

/** @param {World} world */
export function clearStrokes(world) {
  world.strokes.length = 0;
  rebuildSegments(world);
}

/**
 * Draws whole polylines as the player would, point by point. Returns how many
 * strokes were laid.
 * @param {World} world
 * @param {Array<Array<[number, number]>>} strokes
 */
export function drawStrokes(world, strokes) {
  let laid = 0;
  for (const line of strokes) {
    if (!beginStroke(world, line[0][0], line[0][1])) continue;
    for (let i = 1; i < line.length; i++) extendStroke(world, line[i][0], line[i][1]);
    if (commitStroke(world) >= 0) laid++;
  }
  return laid;
}

// --- Pouring ------------------------------------------------------------------------

/**
 * Starts the pour now instead of waiting for the kettle, keeping any stagger
 * between kettles. Pouring early earns a bonus.
 * @param {World} world
 */
export function pourNow(world) {
  if (world.status !== "waiting") return false;
  const first = Math.min(...world.kettles.map((k) => k.startAt));
  const shift = Math.max(0, first - world.time);
  for (const k of world.kettles) k.startAt -= shift;
  return true;
}

/** Seconds until the first kettle pours, 0 once it has. @param {World} world */
export function pourCountdown(world) {
  if (world.status !== "waiting") return 0;
  return Math.max(0, Math.min(...world.kettles.map((k) => k.startAt)) - world.time);
}

/**
 * @param {World} world
 * @param {number} type
 * @param {number} x
 * @param {number} y
 * @param {number} a
 * @param {number} b
 */
function emit(world, type, x, y, a, b) {
  const e = world.events;
  if (e.count >= EVENT_CAP) return;
  e.type[e.count] = type;
  e.x[e.count] = x;
  e.y[e.count] = y;
  e.a[e.count] = a;
  e.b[e.count] = b;
  e.count++;
}

/**
 * @param {World} world
 * @param {number} x
 * @param {number} y
 * @param {number} vx
 * @param {number} vy
 * @param {number} kind
 */
function spawn(world, x, y, vx, vy, kind) {
  if (world.count >= MAX_PARTICLES) return false;
  const p = world.p;
  const i = world.count++;
  p.x[i] = x;
  p.y[i] = y;
  p.px[i] = p.qx[i] = x - vx * STEP;
  p.py[i] = p.qy[i] = y - vy * STEP;
  p.rx[i] = -1000;
  p.ry[i] = -1000;
  p.vx[i] = vx;
  p.vy[i] = vy;
  p.kind[i] = kind;
  p.flags[i] = 0;
  p.cup[i] = -1;
  p.timer[i] = 0;
  p.fresh[i] = kind === PEARL ? 0 : FRESH_SECONDS;
  p.pipe[i] = -1;
  p.pipeEnd[i] = 0;
  p.contact[i] = 0;
  return true;
}

/**
 * Moves the last particle into slot i.
 * @param {World} world
 * @param {number} i
 */
function removeAt(world, i) {
  const p = world.p;
  const j = --world.count;
  if (i === j) return;
  p.x[i] = p.x[j];
  p.y[i] = p.y[j];
  p.px[i] = p.px[j];
  p.py[i] = p.py[j];
  p.qx[i] = p.qx[j];
  p.qy[i] = p.qy[j];
  p.rx[i] = p.rx[j];
  p.ry[i] = p.ry[j];
  p.vx[i] = p.vx[j];
  p.vy[i] = p.vy[j];
  p.kind[i] = p.kind[j];
  p.flags[i] = p.flags[j];
  p.cup[i] = p.cup[j];
  p.timer[i] = p.timer[j];
  p.fresh[i] = p.fresh[j];
  p.pipe[i] = p.pipe[j];
  p.pipeEnd[i] = p.pipeEnd[j];
}

/**
 * Kettles and the pearl hopper.
 * @param {World} world
 * @param {number} dt
 */
function pour(world, dt) {
  const random = world.random;
  let anyLeft = false;
  for (let k = 0; k < world.kettles.length; k++) {
    const kettle = world.kettles[k];
    if (kettle.left <= 0) continue;
    anyLeft = true;
    if (!kettle.started) {
      if (world.time < kettle.startAt) continue;
      kettle.started = true;
      if (world.pourStartedAt < 0) world.pourStartedAt = world.time;
      emit(world, EVENTS.POUR_START, kettle.x, kettle.y, k, kettle.kind);
    }
    kettle.acc += kettle.rate * dt;
    const speed = Math.hypot(kettle.vx, kettle.vy) || 1;
    // Unit vector across the stream, for a little jitter in where droplets leave.
    const ux = -kettle.vy / speed;
    const uy = kettle.vx / speed;
    while (kettle.acc >= 1 && kettle.left > 0) {
      kettle.acc -= 1;
      // Place each droplet where it would be had it left mid-step, so the
      // stream is evenly spaced rather than bunched per step.
      const ahead = kettle.acc / kettle.rate;
      const across = (random() - 0.5) * 0.8;
      const vx = kettle.vx + (random() - 0.5) * 3;
      const vy = kettle.vy + (random() - 0.5) * 3;
      if (!spawn(world, kettle.x + ux * across + vx * ahead, kettle.y + uy * across + vy * ahead, vx, vy, kettle.kind)) break;
      kettle.left--;
      world.stats.poured++;
      if (kettle.left === 0) emit(world, EVENTS.POUR_STOP, kettle.x, kettle.y, k, kettle.kind);
    }
  }
  const hopper = world.hopper;
  if (hopper && hopper.left > 0) {
    anyLeft = true;
    if (world.pourStartedAt >= 0 && world.time >= hopper.next) {
      if (hopper.left === hopper.count) emit(world, EVENTS.PEARLS_DROP, hopper.x, hopper.y, -1, PEARL);
      if (spawn(world, hopper.x + (random() - 0.5) * 2, hopper.y, (random() - 0.5) * 10, 20, PEARL)) {
        hopper.left--;
        world.stats.pearls++;
      }
      hopper.next = world.time + hopper.interval;
    }
  }
  return anyLeft;
}

// --- Physics --------------------------------------------------------------------------

/**
 * One fixed step. Returns how many events it emitted into `world.events`.
 * @param {World} world
 * @param {number} [dt] seconds; the screen calls this at STEP
 */
export function step(world, dt = STEP) {
  world.events.count = 0;
  if (world.status === "cleared" || world.status === "failed") return 0;
  world.time += dt;

  // The belt runs while tea is coming, then eases to a stop so the room can settle.
  if (world.pourEndedAt >= 0) {
    const since = world.time - world.pourEndedAt - BELT_RUN_ON;
    world.beltSpeed = since <= 0 ? 1 : Math.max(0, 1 - since / BELT_EASE);
  }
  world.beltTime += dt * world.beltSpeed;
  placeCups(world, dt);

  const pouring = pour(world, dt);
  if (world.pourStartedAt >= 0 && world.status === "waiting") world.status = "pouring";
  if (!pouring && world.status === "pouring") {
    world.status = "settling";
    world.pourEndedAt = world.time;
  }

  tickPipes(world, dt);
  integrate(world, dt);
  buildHash(world);
  for (let k = 0; k < SEPARATION_PASSES; k++) separate(world);
  collideSegments(world);
  expelFromBlocks(world);
  respond(world, dt);
  enterPipes(world);
  compact(world);
  countCups(world);
  weighScales(world);

  if (world.status === "settling") settle(world, dt);
  return world.events.count;
}

/**
 * @param {World} world
 * @param {number} dt
 */
function integrate(world, dt) {
  const p = world.p;
  const fans = world.fans;
  const maxStep = MAX_SPEED;
  for (let i = 0; i < world.count; i++) {
    if (p.flags[i] & IN_PIPE) continue;
    let vx = p.vx[i];
    let vy = p.vy[i] + GRAVITY * dt;
    const x = p.x[i];
    const y = p.y[i];
    if (fans.length) {
      const share = p.kind[i] === PEARL ? 0.25 : 1;
      for (let f = 0; f < fans.length; f++) {
        const fan = fans[f];
        if (x >= fan.x && x <= fan.x + fan.w && y >= fan.y && y <= fan.y + fan.h) {
          vx += fan.fx * share * dt;
          vy += fan.fy * share * dt;
        }
      }
    }
    const speed2 = vx * vx + vy * vy;
    if (speed2 > maxStep * maxStep) {
      const scale = maxStep / Math.sqrt(speed2);
      vx *= scale;
      vy *= scale;
    }
    p.px[i] = p.qx[i] = x;
    p.py[i] = p.qy[i] = y;
    p.x[i] = x + vx * dt;
    p.y[i] = y + vy * dt;
    p.contact[i] = 0;
    if (p.timer[i] > 0) p.timer[i] -= dt;
    if (p.fresh[i] > 0) p.fresh[i] -= dt;
  }
}

/** @param {World} world */
function buildHash(world) {
  const p = world.p;
  const h = world.hash;
  const start = h.start;
  start.fill(0);
  for (let i = 0; i < world.count; i++) {
    const col = clamp(Math.floor((p.x[i] - GRID_X0) / CELL), 0, COLS - 1);
    const row = clamp(Math.floor((p.y[i] - GRID_Y0) / CELL), 0, ROWS - 1);
    // Particles in a pipe are parked out of everyone's way.
    const cell = p.flags[i] & IN_PIPE ? -1 : row * COLS + col;
    h.cellOf[i] = cell;
    if (cell >= 0) start[cell + 1]++;
  }
  for (let c = 1; c < start.length; c++) start[c] += start[c - 1];
  h.fill.set(start.subarray(0, h.fill.length));
  for (let i = 0; i < world.count; i++) {
    const cell = h.cellOf[i];
    if (cell >= 0) h.items[h.fill[cell]++] = i;
  }
}

/**
 * Pushes overlapping particles apart and damps their closing speed, which is
 * what gives the liquid volume.
 * @param {World} world
 */
function separate(world) {
  const p = world.p;
  const h = world.hash;
  const { x, y, qx, qy, kind } = p;
  for (let i = 0; i < world.count; i++) {
    const cell = h.cellOf[i];
    if (cell < 0) continue;
    const col = cell % COLS;
    const row = (cell - col) / COLS;
    const ri = RADIUS[kind[i]];
    const wi = INV_MASS[kind[i]];
    for (let r = row - 1; r <= row + 1; r++) {
      if (r < 0 || r >= ROWS) continue;
      for (let c = col - 1; c <= col + 1; c++) {
        if (c < 0 || c >= COLS) continue;
        const other = r * COLS + c;
        const end = h.start[other + 1];
        for (let s = h.start[other]; s < end; s++) {
          const j = h.items[s];
          if (j <= i || (p.fresh[i] > 0 && p.fresh[j] > 0)) continue;
          const reach = ri + RADIUS[kind[j]];
          const dx = x[i] - x[j];
          const dy = y[i] - y[j];
          const d2 = dx * dx + dy * dy;
          if (d2 >= reach * reach) continue;
          let d = Math.sqrt(d2);
          let nx;
          let ny;
          if (d < 1e-6) {
            // Exactly stacked: split them by index so the result is repeatable.
            nx = (i & 1) === 0 ? 1 : -1;
            ny = 0;
            d = 0;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          const wj = INV_MASS[kind[j]];
          const share = wi / (wi + wj);
          let push = (reach - d) * STIFFNESS;
          if (push > MAX_PUSH) push = MAX_PUSH;
          const pi = push * share;
          const pj = push * (1 - share);
          x[i] += nx * pi;
          y[i] += ny * pi;
          x[j] -= nx * pj;
          y[j] -= ny * pj;
          // Only part of the push becomes speed; the rest is a pure move, so
          // a crowd settles instead of fizzing.
          qx[i] += nx * pi * PUSH_HELD;
          qy[i] += ny * pi * PUSH_HELD;
          qx[j] -= nx * pj * PUSH_HELD;
          qy[j] -= ny * pj * PUSH_HELD;
          // Velocities are changed through the previous positions, so the
          // velocity derived at the end of the step carries them. Touching
          // particles stop closing on each other (an inelastic contact, which
          // is what keeps a full cup still), and droplets share a little of
          // their sideways motion, which keeps a stream together.
          const rvx = x[i] - qx[i] - (x[j] - qx[j]);
          const rvy = y[i] - qy[i] - (y[j] - qy[j]);
          const closing = rvx * nx + rvy * ny;
          if (closing < 0) {
            const impulse = closing / (wi + wj);
            qx[i] += nx * impulse * wi;
            qy[i] += ny * impulse * wi;
            qx[j] -= nx * impulse * wj;
            qy[j] -= ny * impulse * wj;
          }
          if (kind[i] !== PEARL && kind[j] !== PEARL) {
            const k = VISCOSITY * (1 - d / reach) * 0.5;
            qx[i] += rvx * k;
            qy[i] += rvy * k;
            qx[j] -= rvx * k;
            qy[j] -= rvy * k;
          }
        }
      }
    }
  }
}

/**
 * Projects one particle out of one segment, using where it came from to tell
 * which side it belongs on, so a fast droplet cannot pass through a thin straw.
 * @param {World} world
 * @param {number} i particle
 * @param {number} k segment
 */
function collideOne(world, i, k) {
  const p = world.p;
  const s = world.seg;
  const ax = s.ax[k];
  const ay = s.ay[k];
  const dx = s.bx[k] - ax;
  const dy = s.by[k] - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return;
  const reach = RADIUS[p.kind[i]] + s.half[k];
  const x = p.x[i];
  const y = p.y[i];
  // Where the particle started, in the segment's frame (it may have moved).
  const qx = p.px[i] - s.dx[k];
  const qy = p.py[i];
  const minX = (dx < 0 ? ax + dx : ax) - reach;
  const maxX = (dx < 0 ? ax : ax + dx) + reach;
  const minY = (dy < 0 ? ay + dy : ay) - reach;
  const maxY = (dy < 0 ? ay : ay + dy) + reach;
  const outside = x < minX || x > maxX || y < minY || y > maxY;
  if (outside && (qx < minX || qx > maxX || qy < minY || qy > maxY)) return;

  const len = Math.sqrt(len2);
  const side0 = (dx * (qy - ay) - dy * (qx - ax)) / len;
  const side1 = (dx * (y - ay) - dy * (x - ax)) / len;
  let t = ((x - ax) * dx + (y - ay) * dy) / len2;
  let crossed = false;
  if ((side0 > 0 && side1 < 0) || (side0 < 0 && side1 > 0)) {
    // It went through the line this step: did it go through the segment?
    const f = side0 / (side0 - side1);
    const cx = qx + (x - qx) * f;
    const cy = qy + (y - qy) * f;
    const tc = ((cx - ax) * dx + (cy - ay) * dy) / len2;
    // The ends count as round caps, so nothing slips through where two
    // walls meet at a corner.
    const cap = reach / len;
    if (tc >= -cap && tc <= 1 + cap) {
      crossed = true;
      t = tc;
    }
  }
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  let ox = x - cx;
  let oy = y - cy;
  let dist = Math.sqrt(ox * ox + oy * oy);
  let nx;
  let ny;
  if (crossed || dist < 1e-6) {
    // Back to the side it came from.
    const sign = side0 >= 0 ? 1 : -1;
    nx = (-dy / len) * sign;
    ny = (dx / len) * sign;
    dist = 0;
  } else {
    if (dist >= reach) return;
    nx = ox / dist;
    ny = oy / dist;
  }
  const kind = s.kind[k];
  // Velocity into the surface before the push, for bounce.
  const vx = (x - p.qx[i]) / STEP - s.vx[k];
  const vy = (y - p.qy[i]) / STEP;
  const vn = vx * nx + vy * ny;
  p.x[i] = cx + nx * reach;
  p.y[i] = cy + ny * reach;
  p.cnx[i] = nx;
  p.cny[i] = ny;
  p.cvn[i] = vn;
  p.csvx[i] = s.vx[k];
  p.csvy[i] = 0;
  const pearl = p.kind[i] === PEARL;
  p.crest[i] = kind === SEG_JELLY ? JELLY_BOUNCE : BOUNCE;
  p.cfric[i] = kind === SEG_JELLY ? 0 : pearl ? PEARL_FRICTION : DROP_FRICTION;
  p.contact[i] = kind + 1;
  if (!pearl && (kind === SEG_SPONGE || kind === SEG_HOT)) {
    if (!(p.flags[i] & DEAD)) {
      p.flags[i] |= DEAD;
      if (kind === SEG_SPONGE) {
        world.stats.absorbed++;
        emit(world, EVENTS.ABSORBED, cx, cy, s.owner[k], p.kind[i]);
      } else {
        world.stats.boiled++;
        emit(world, EVENTS.BOILED, cx, cy, s.owner[k], p.kind[i]);
      }
    }
  }
}

/** @param {World} world */
function collideSegments(world) {
  const p = world.p;
  const s = world.seg;
  for (let i = 0; i < world.count; i++) {
    if (p.flags[i] & (IN_PIPE | DEAD)) continue;
    const col = Math.floor((p.x[i] - GRID_X0) / SEG_CELL);
    const row = Math.floor((p.y[i] - GRID_Y0) / SEG_CELL);
    if (col >= 0 && col < SEG_COLS && row >= 0 && row < SEG_ROWS) {
      const cell = row * SEG_COLS + col;
      const end = s.gridStart[cell + 1];
      for (let r = s.gridStart[cell]; r < end; r++) collideOne(world, i, s.gridItems[r]);
    }
    for (let d = 0; d < s.dynamicCount; d++) collideOne(world, i, s.dynamic[d]);
  }
}

/**
 * A last guard for solid blocks: a particle whose centre ended up inside one
 * (squeezed in by a crowd at a corner) is put back out through the nearest
 * face. Rare, but a droplet trapped inside ice looks broken.
 * @param {World} world
 */
function expelFromBlocks(world) {
  const corners = world.blockCorners;
  const blocks = world.blocks.length;
  if (!blocks) return;
  const p = world.p;
  for (let i = 0; i < world.count; i++) {
    if (p.flags[i] & (IN_PIPE | DEAD)) continue;
    const x = p.x[i];
    const y = p.y[i];
    for (let b = 0; b < blocks; b++) {
      const o = b * 8;
      // Inside a clockwise (on screen) quad: on the inner side of all four edges.
      let nearest = Infinity;
      let face = -1;
      for (let e = 0; e < 4; e++) {
        const ax = corners[o + e * 2];
        const ay = corners[o + e * 2 + 1];
        const bx = corners[o + ((e + 1) % 4) * 2];
        const by = corners[o + ((e + 1) % 4) * 2 + 1];
        const len = Math.hypot(bx - ax, by - ay) || 1;
        // Distance inward from this edge (positive inside).
        const inward = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / len;
        if (inward <= 0) {
          nearest = -1;
          break;
        }
        if (inward < nearest) {
          nearest = inward;
          face = e;
        }
      }
      if (nearest < 0 || face < 0) continue;
      const ax = corners[o + face * 2];
      const ay = corners[o + face * 2 + 1];
      const bx = corners[o + ((face + 1) % 4) * 2];
      const by = corners[o + ((face + 1) % 4) * 2 + 1];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      // The outward normal of a clockwise screen quad's edge.
      const nx = (by - ay) / len;
      const ny = -(bx - ax) / len;
      const out = nearest + RADIUS[p.kind[i]] + 0.5;
      p.x[i] = x + nx * out;
      p.y[i] = y + ny * out;
      p.qx[i] = p.x[i];
      p.qy[i] = p.y[i];
      break;
    }
  }
}

/**
 * Derives velocity from the step's motion, then applies the floor, bounce and
 * friction, and retires anything that left the room.
 * @param {World} world
 * @param {number} dt
 */
function respond(world, dt) {
  const p = world.p;
  for (let i = 0; i < world.count; i++) {
    if (p.flags[i] & (IN_PIPE | DEAD)) continue;
    const kind = p.kind[i];
    const r = RADIUS[kind];
    let vx = (p.x[i] - p.qx[i]) / dt;
    let vy = (p.y[i] - p.qy[i]) / dt;
    if (p.y[i] > FLOOR - r) {
      const vn = vy;
      p.y[i] = FLOOR - r;
      vy = 0;
      if (kind !== PEARL) vx *= 1 - FLOOR_FRICTION;
      else vx *= 0.995;
      if (!(p.flags[i] & SPILLED) && p.cup[i] < 0) {
        p.flags[i] |= SPILLED;
        if (kind !== PEARL) world.stats.spilled++;
      }
      // Anything landing hard makes a splash, puddle or not.
      if (vn > 60 && world.time - world.lastSplash >= SPLASH_GAP) {
        world.lastSplash = world.time;
        emit(world, EVENTS.SPLASH, p.x[i], FLOOR, -1, kind);
      }
    } else if (p.contact[i]) {
      const nx = p.cnx[i];
      const ny = p.cny[i];
      const rx = vx - p.csvx[i];
      const ry = vy - p.csvy[i];
      const vn = rx * nx + ry * ny;
      let tx = rx - vn * nx;
      let ty = ry - vn * ny;
      const before = p.cvn[i];
      // A hard landing splats: some of the slide is lost with the impact.
      const keep = Math.max(0, 1 - p.cfric[i] - (p.cfric[i] > 0 && before < 0 ? Math.min(0.4, -before * SPLAT) : 0));
      tx *= keep;
      ty *= keep;
      // Being pushed out of a wall is not a reason to fly off it: the normal
      // speed after a contact is the bounce, or what it already had leaving.
      let out = before > 0 ? Math.min(vn, before) : 0;
      if (before < -25) {
        out = -before * p.crest[i];
        if (p.contact[i] === SEG_JELLY + 1 && before < -60 && world.time - world.lastBounce >= BOUNCE_GAP) {
          world.lastBounce = world.time;
          emit(world, EVENTS.BOUNCE, p.x[i], p.y[i], -1, kind);
        }
      }
      vx = p.csvx[i] + tx + out * nx;
      vy = p.csvy[i] + ty + out * ny;
    }
    p.vx[i] = vx;
    p.vy[i] = vy;
    // Droplets piling on a puddle are part of it.
    if (!(p.flags[i] & SPILLED) && p.y[i] > FLOOR - r - PUDDLE && cupAt(world, p.x[i], p.y[i]) < 0) {
      p.flags[i] |= SPILLED;
      if (kind !== PEARL) world.stats.spilled++;
    }
    if (p.x[i] < -12 || p.x[i] > WIDTH + 12 || p.y[i] < -80) {
      if (!(p.flags[i] & SPILLED) && kind !== PEARL) world.stats.spilled++;
      p.flags[i] |= DEAD;
    }
  }
}

/** @param {World} world */
function enterPipes(world) {
  const pipes = world.pipes;
  if (!pipes.length) return;
  const p = world.p;
  const reach2 = PIPE_MOUTH * PIPE_MOUTH;
  for (let i = 0; i < world.count; i++) {
    if (p.flags[i] & (IN_PIPE | DEAD) || p.timer[i] > 0) continue;
    for (let k = 0; k < pipes.length; k++) {
      const pipe = pipes[k];
      for (let e = 0; e < 2; e++) {
        const end = e === 0 ? pipe.a : pipe.b;
        const dx = p.x[i] - end.x;
        const dy = p.y[i] - end.y;
        if (dx * dx + dy * dy > reach2) continue;
        p.flags[i] |= IN_PIPE;
        p.pipe[i] = k;
        p.pipeEnd[i] = e;
        p.timer[i] = PIPE_TRANSIT;
        p.x[i] = p.px[i] = p.qx[i] = end.x;
        p.y[i] = p.py[i] = p.qy[i] = end.y;
        p.cup[i] = -1;
        world.stats.piped++;
        emit(world, EVENTS.PIPE, end.x, end.y, k, e);
        k = pipes.length;
        break;
      }
    }
  }
}

/**
 * @param {World} world
 * @param {number} dt
 */
function tickPipes(world, dt) {
  const pipes = world.pipes;
  if (!pipes.length) return;
  const p = world.p;
  for (let i = 0; i < world.count; i++) {
    if (!(p.flags[i] & IN_PIPE)) continue;
    p.timer[i] -= dt;
    if (p.timer[i] > 0) continue;
    const pipe = pipes[p.pipe[i]];
    const out = p.pipeEnd[i] === 0 ? pipe.b : pipe.a;
    const len = Math.hypot(out.nx, out.ny) || 1;
    const nx = out.nx / len;
    const ny = out.ny / len;
    const away = PIPE_MOUTH + RADIUS[p.kind[i]] + 0.5;
    // A little spread across the mouth, or the pipe stacks droplets in a
    // perfect column that never slumps.
    const across = (world.random() - 0.5) * 3;
    p.flags[i] &= ~IN_PIPE;
    p.x[i] = p.px[i] = p.qx[i] = out.x + nx * away - ny * across;
    p.y[i] = p.py[i] = p.qy[i] = out.y + ny * away + nx * across;
    p.vx[i] = nx * PIPE_EXIT_SPEED;
    p.vy[i] = ny * PIPE_EXIT_SPEED;
    p.timer[i] = PIPE_COOLDOWN;
    p.pipe[i] = -1;
  }
}

/** Removes dead particles, keeping the live ones packed. @param {World} world */
function compact(world) {
  const p = world.p;
  for (let i = world.count - 1; i >= 0; i--) if (p.flags[i] & DEAD) removeAt(world, i);
}

/**
 * The cup whose counting region holds a point, or -1.
 * @param {World} world
 * @param {number} x
 * @param {number} y
 */
export function cupAt(world, x, y) {
  const cups = world.cups;
  for (let c = 0; c < cups.length; c++) {
    const cup = cups[c];
    const half = cup.w / 2 - CUP_WALL * 2;
    if (x >= cup.x - half && x <= cup.x + half && y >= cup.y - cup.h - 1 && y <= cup.y) return c;
  }
  return -1;
}

/** @param {World} world */
function countCups(world) {
  const p = world.p;
  const cups = world.cups;
  for (let c = 0; c < cups.length; c++) {
    const cup = cups[c];
    cup.tea = 0;
    cup.milk = 0;
    cup.pearls = 0;
  }
  for (let i = 0; i < world.count; i++) {
    if (p.flags[i] & IN_PIPE) continue;
    const x = p.x[i];
    const y = p.y[i];
    const inside = cupAt(world, x, y);
    const kind = p.kind[i];
    if (inside >= 0 && !(p.flags[i] & SPILLED)) {
      const cup = cups[inside];
      if (kind === TEA) cup.tea++;
      else if (kind === MILK) cup.milk++;
      else cup.pearls++;
      if (p.cup[i] !== inside) {
        if (kind === PEARL) emit(world, EVENTS.PEARL_IN_CUP, x, y, inside, cup.pearls);
        else if (world.time - cup.lastInto >= INTO_CUP_GAP) {
          cup.lastInto = world.time;
          emit(world, EVENTS.INTO_CUP, x, y, inside, cup.tea + cup.milk);
        }
      }
      p.cup[i] = inside;
    } else {
      p.cup[i] = -1;
    }
  }
  for (let c = 0; c < cups.length; c++) {
    const cup = cups[c];
    cup.count = cup.tea + cup.milk;
    if (!cup.full && cup.count >= cup.order.full) {
      cup.full = true;
      emit(world, EVENTS.CUP_FULL, cup.x, cup.y - cup.h, c, cup.count);
    }
  }
}

/** @param {World} world */
function weighScales(world) {
  if (!world.scales.length) return;
  const p = world.p;
  let opened = false;
  for (let k = 0; k < world.scales.length; k++) {
    const scale = world.scales[k];
    const half = scale.w / 2 - CUP_WALL * 2;
    let weight = 0;
    for (let i = 0; i < world.count; i++) {
      if (p.flags[i] & IN_PIPE) continue;
      const x = p.x[i];
      const y = p.y[i];
      if (x >= scale.x - half && x <= scale.x + half && y >= scale.y - scale.h - 1 && y <= scale.y) {
        weight += WEIGHT[p.kind[i]];
      }
    }
    scale.weight = weight;
    if (!scale.tripped && weight >= scale.need) {
      scale.tripped = true;
      const gate = world.gates[scale.gate];
      if (gate && !gate.open) {
        gate.open = true;
        opened = true;
        emit(world, EVENTS.GATE_OPEN, (gate.x1 + gate.x2) / 2, (gate.y1 + gate.y2) / 2, scale.gate, k);
      }
    }
  }
  if (opened) rebuildSegments(world);
}

/**
 * Every SETTLE_WINDOW the room checks how far each particle moved since the
 * last check. Position, not velocity, is the honest measure: a resting pile
 * carries a little velocity that its contacts cancel every step.
 * @param {World} world
 * @param {number} dt
 */
function settle(world, dt) {
  const timedOut = world.time - world.pourEndedAt >= SETTLE_TIMEOUT;
  world.settleClock += dt;
  if (world.settleClock >= SETTLE_WINDOW) {
    world.settleClock = 0;
    const p = world.p;
    let moving = 0;
    for (let i = 0; i < world.count; i++) {
      if (p.flags[i] & IN_PIPE) {
        moving += MAX_PARTICLES;
        continue;
      }
      // What is already on the floor can puddle as long as it likes.
      if (p.flags[i] & SPILLED) continue;
      const dx = p.x[i] - p.rx[i];
      const dy = p.y[i] - p.ry[i];
      if (dx * dx + dy * dy > SETTLE_DRIFT * SETTLE_DRIFT) moving++;
      p.rx[i] = p.x[i];
      p.ry[i] = p.y[i];
    }
    const allowed = Math.floor(world.count * 0.02);
    const beltStill = world.beltSpeed === 0 || world.cups.every((cup) => !cup.conveyor);
    world.quiet = moving <= allowed && beltStill ? world.quiet + SETTLE_WINDOW : 0;
  }
  if (world.quiet >= SETTLE_SECONDS || timedOut) resolve(world);
}

/** @param {World} world */
function resolve(world) {
  const result = judgeRoom(world);
  world.result = result;
  world.status = result.cleared ? "cleared" : "failed";
  emit(world, result.cleared ? EVENTS.CLEARED : EVENTS.FAILED, WIDTH / 2, HEIGHT / 2, -1, result.stars);
}

// --- Judging ----------------------------------------------------------------------------

/**
 * @typedef {{
 *   count: number, tea: number, milk: number, pearls: number, milkShare: number,
 *   enough: boolean, ratioOk: boolean, pearlsOk: boolean, ok: boolean, fill: number
 * }} CupResult
 * @typedef {{
 *   cleared: boolean, stars: number, points: number, cups: CupResult[],
 *   poured: number, inCups: number, spilled: number, absorbed: number, boiled: number,
 *   fill: number, keep: number, accuracy: number, strawLeft: number, strawBonus: number,
 *   earlySeconds: number, earlyBonus: number
 * }} RoomResult
 */

/**
 * How close a cup's milk share is to its order, 1 dead on and 0 at the edge
 * of the tolerance. A cup with no ratio is always 1.
 * @param {number} tea
 * @param {number} milk
 * @param {Order} order
 */
export function ratioAccuracy(tea, milk, order) {
  if (order.milk === undefined) return 1;
  const total = tea + milk;
  if (total === 0) return 0;
  const tol = order.tol ?? 0.1;
  return clamp(1 - Math.abs(milk / total - order.milk) / tol, 0, 1);
}

/**
 * Judges one cup against its order.
 * @param {{ tea: number, milk: number, pearls: number }} contents
 * @param {Order} order
 * @returns {CupResult}
 */
export function judgeCup(contents, order) {
  const { tea, milk, pearls } = contents;
  const count = tea + milk;
  const tol = order.tol ?? 0.1;
  const milkShare = count ? milk / count : 0;
  const enough = count >= order.need;
  const ratioOk = order.milk === undefined || (count > 0 && Math.abs(milkShare - order.milk) <= tol + 1e-9);
  const pearlsOk = pearls >= (order.pearls ?? 0);
  return {
    count,
    tea,
    milk,
    pearls,
    milkShare,
    enough,
    ratioOk,
    pearlsOk,
    ok: enough && ratioOk && pearlsOk,
    fill: Math.min(1, count / order.full),
  };
}

/** How much of the pour a room expects kept for two and for three stars. */
export const DEFAULT_KEEP = /** @type {[number, number]} */ ([0.55, 0.75]);

/**
 * Stars from how full the cups are, how much of the pour they kept and how
 * close the ratios are. A room where some spill can't be helped (a moving
 * cup) sets lower keep marks.
 * @param {number} fill average fill, 0 to 1
 * @param {number} keep share of poured droplets that ended in a cup
 * @param {number} accuracy average ratio accuracy, 0 to 1
 * @param {[number, number]} [marks] keep needed for two and three stars
 */
export function starsFor(fill, keep, accuracy, marks = DEFAULT_KEEP) {
  if (fill >= 0.95 && keep >= marks[1] && accuracy >= 0.5) return 3;
  if (fill >= 0.75 && keep >= marks[0]) return 2;
  return 1;
}

/**
 * The result of a room as it stands now (the room calls this itself when it
 * settles; the screen can call it any time for a live preview).
 * @param {World} world
 * @returns {RoomResult}
 */
export function judgeRoom(world) {
  const cups = world.cups.map((cup) => judgeCup(cup, cup.order));
  const cleared = cups.every((cup) => cup.ok);
  const inCups = cups.reduce((sum, cup) => sum + cup.count, 0);
  const poured = world.stats.poured;
  const fill = cups.reduce((sum, cup) => sum + cup.fill, 0) / cups.length;
  const keep = poured ? Math.min(1, inCups / poured) : 0;
  const accuracy =
    world.cups.reduce((sum, cup) => sum + ratioAccuracy(cup.tea, cup.milk, cup.order), 0) / world.cups.length;
  const stars = cleared ? starsFor(fill, keep, accuracy, world.room.keep) : 0;
  const left = strawLeft(world);
  const firstDelay = Math.min(...world.kettles.map((k) => k.delay));
  const earlySeconds = world.pourStartedAt >= 0 ? Math.max(0, firstDelay - world.pourStartedAt) : 0;
  const strawBonus = cleared ? Math.round((60 * left) / world.budget) : 0;
  // Scaled by the share of planning time given back, so pouring with half
  // the time left earns half the bonus.
  const earlyShare = world.plan > 0 ? Math.min(1, earlySeconds / world.plan) : 0;
  const earlyBonus = cleared ? Math.round(EARLY_BONUS * earlyShare) : 0;
  return {
    cleared,
    stars,
    points: cleared ? stars * 100 + strawBonus + earlyBonus : 0,
    cups,
    poured,
    inCups,
    spilled: Math.max(0, poured - inCups - world.stats.absorbed - world.stats.boiled),
    absorbed: world.stats.absorbed,
    boiled: world.stats.boiled,
    fill,
    keep,
    accuracy,
    strawLeft: left,
    strawBonus,
    earlySeconds,
    earlyBonus,
  };
}

/**
 * Runs a room to its end with some straws drawn first, as the tests and any
 * demo would. Returns the result and the world.
 * @param {Room} room
 * @param {Array<Array<[number, number]>>} [strokes]
 * @param {{ pourAt?: number, maxSeconds?: number }} [options] pourAt presses "pour now" at that time
 */
export function simulate(room, strokes = [], options = {}) {
  const world = createWorld(room);
  drawStrokes(world, strokes);
  const pourAt = options.pourAt ?? room.solution?.pourAt;
  const maxSteps = Math.round((options.maxSeconds ?? 40) / STEP);
  for (let n = 0; n < maxSteps; n++) {
    if (pourAt !== undefined && world.status === "waiting" && world.time >= pourAt) pourNow(world);
    step(world, STEP);
    if (world.status === "cleared" || world.status === "failed") break;
  }
  return { world, result: world.result ?? judgeRoom(world) };
}

// --- Runs, lives and checkpoints ---------------------------------------------------------

/**
 * @typedef {{
 *   index: number, lives: number, total: number, seed: number, over: boolean,
 *   attempts: number, results: Array<{ index: number, name: string, stars: number, points: number }>,
 *   reached: number, startedAt: number
 * }} Run
 */

/**
 * Which checkpoints a run may start from, given the furthest room index ever
 * reached on this device.
 * @param {number} reached
 */
export function availableCheckpoints(reached) {
  return CHECKPOINTS.filter((index) => index <= reached);
}

/**
 * A fresh run at a checkpoint, with par points for the rooms it skips.
 * @param {{ start?: number, reached?: number, seed?: number }} [options]
 * @returns {Run}
 */
export function newRun({ start = 0, reached = 0, seed = 1 } = {}) {
  const index = availableCheckpoints(reached).includes(start) ? start : 0;
  return {
    index,
    lives: START_LIVES,
    total: index * PAR_POINTS,
    seed,
    over: false,
    attempts: 0,
    results: [],
    reached: Math.max(reached, index),
    startedAt: index,
  };
}

/**
 * The room at a run index: the authored rooms in order, then remixes of them
 * forever, a little harder each time round.
 * @param {number} index
 * @param {number} [seed]
 * @returns {Room}
 */
export function roomAt(index, seed = 1) {
  if (index < ROOMS.length) return ROOMS[index];
  const past = index - ROOMS.length;
  const difficulty = 1 + Math.floor(past / 6);
  return remix(ROOMS[past % ROOMS.length], difficulty, seed * 7919 + index);
}

/** @param {Run} run */
export function currentRoom(run) {
  return roomAt(run.index, run.seed);
}

/**
 * Books a finished room into the run: a clear banks its points and moves on,
 * a failure costs a pearl and the same room is tried again.
 * @param {Run} run mutated in place
 * @param {RoomResult} result
 */
export function recordResult(run, result) {
  if (run.over) return run;
  run.attempts++;
  if (result.cleared) {
    run.total += result.points;
    run.results.push({ index: run.index, name: currentRoom(run).name, stars: result.stars, points: result.points });
    run.index++;
    run.reached = Math.max(run.reached, run.index);
    run.attempts = 0;
  } else {
    run.lives--;
    if (run.lives <= 0) run.over = true;
  }
  return run;
}

// --- Remixes --------------------------------------------------------------------------------

/** @param {number} x */
const flipX = (x) => WIDTH - x;

/**
 * Mirrors polylines left to right.
 * @param {Array<Array<[number, number]>>} strokes
 * @returns {Array<Array<[number, number]>>}
 */
export function mirrorStrokes(strokes) {
  return strokes.map((line) => line.map(([x, y]) => /** @type {[number, number]} */ ([flipX(x), y])));
}

/**
 * The room mirrored left to right, solution included.
 * @param {Room} room
 * @returns {Room}
 */
export function mirrorRoom(room) {
  /** @param {PipeEnd} end */
  const flipEnd = (end) => ({ x: flipX(end.x), y: end.y, nx: -end.nx, ny: end.ny });
  return {
    ...room,
    kettles: room.kettles.map((k) => ({ ...k, x: flipX(k.x), vx: -k.vx })),
    cups: room.cups.map((c) => ({
      ...c,
      x: flipX(c.x),
      conveyor: c.conveyor ? { ...c.conveyor, range: -c.conveyor.range } : undefined,
    })),
    blocks: (room.blocks ?? []).map((b) => ({ ...b, x: flipX(b.x), angle: -(b.angle ?? 0) })),
    fans: (room.fans ?? []).map((f) => ({ ...f, x: WIDTH - f.x - f.w, fx: -f.fx })),
    pipes: (room.pipes ?? []).map((pipe) => ({
      a: flipEnd(pipe.a),
      b: flipEnd(pipe.b),
      path: pipe.path?.map(([x, y]) => /** @type {[number, number]} */ ([flipX(x), y])),
    })),
    scales: (room.scales ?? []).map((s) => ({ ...s, x: flipX(s.x) })),
    gates: (room.gates ?? []).map((g) => ({ ...g, x1: flipX(g.x1), x2: flipX(g.x2) })),
    hopper: room.hopper ? { ...room.hopper, x: flipX(room.hopper.x) } : undefined,
    noDraw: (room.noDraw ?? []).map((r) => ({ ...r, x: WIDTH - r.x - r.w })),
    solution: { ...room.solution, strokes: mirrorStrokes(room.solution.strokes) },
  };
}

/**
 * A harder take on an authored room. The seed decides whether it is mirrored
 * and which of the squeezes apply; difficulty (1 and up) decides how hard each
 * squeezes: less straw, a bigger order, a faster belt.
 * @param {Room} room
 * @param {number} difficulty
 * @param {number} seed
 * @returns {Room}
 */
export function remix(room, difficulty, seed) {
  // Hash the seed with the room, so neighbouring seeds don't all start alike.
  const random = createRng(hashString(`${room.id}:${seed}`));
  const mirrored = random() < 0.5;
  const base = mirrored ? mirrorRoom(room) : room;
  const d = Math.max(1, difficulty);
  // Every remix trims the straw, a little more each lap, until the authored
  // routes no longer fit and a run has to find shorter ones; the other
  // squeezes join in more often as it goes.
  const squeezes = ["order", "belt"].filter(() => random() < 0.35 + 0.15 * d);
  const strawFactor = Math.max(0.55, 1 - 0.06 * d);
  const orderFactor = squeezes.includes("order") ? 1 + 0.04 * d : 1;
  const beltFactor = squeezes.includes("belt") ? 1 + 0.12 * d : 1;
  return {
    ...base,
    id: `${room.id}-remix-${d}-${seed}`,
    name: `${room.name}, again`,
    straw: Math.round(room.straw * strawFactor),
    cups: base.cups.map((cup) => ({
      ...cup,
      order: {
        ...cup.order,
        need: Math.min(Math.round(cup.order.full * 0.9), Math.round(cup.order.need * orderFactor)),
      },
      conveyor: cup.conveyor ? { ...cup.conveyor, period: cup.conveyor.period / beltFactor } : undefined,
    })),
    remix: { difficulty: d, mirrored, of: room.id },
  };
}

// --- Words ------------------------------------------------------------------------------------

/** @param {number} x */
function across(x) {
  return x < WIDTH / 3 ? "left" : x > (WIDTH * 2) / 3 ? "right" : "middle";
}

/** @param {number} y */
function down(y) {
  return y < HEIGHT / 3 ? "top" : y > (HEIGHT * 2) / 3 ? "bottom" : "middle";
}

/** @param {number} x @param {number} y */
function where(x, y) {
  const a = across(x);
  const d = down(y);
  return a === "middle" && d === "middle" ? "the middle" : d === "middle" ? `the middle ${a}` : `the ${d} ${a}`;
}

/** @param {number} n @param {string} one @param {string} [many] */
function count(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** @param {Order} order */
function describeOrder(order) {
  let text = `at least ${count(order.need, "droplet")}, full at ${order.full}`;
  if (order.milk !== undefined) {
    text += `, ${Math.round(order.milk * 100)}% milk give or take ${Math.round((order.tol ?? 0.1) * 100)}`;
  }
  if (order.pearls) text += `, and ${count(order.pearls, "pearl")}`;
  return text;
}

/**
 * A plain description of a room for screen readers: what is in it, where,
 * and what each cup wants.
 * @param {Room} room
 */
export function describeRoom(room) {
  /** @type {string[]} */
  const lines = [`${room.name}.`];
  for (const k of room.kettles) {
    const what = k.kind === "milk" ? "A milk jug" : "A kettle";
    lines.push(`${what} at ${where(k.x, k.y)} pours ${count(k.count, "droplet")} toward the ${k.vx < 0 ? "left" : "right"}.`);
  }
  room.cups.forEach((cup, i) => {
    const name = room.cups.length > 1 ? `Cup ${i + 1}` : "The cup";
    const moving = cup.conveyor ? ", sliding back and forth on a belt" : "";
    lines.push(`${name} sits at ${where(cup.x, cup.y - cup.h / 2)}${moving}. It wants ${describeOrder(cup.order)}.`);
  });
  /** @type {Record<string, string>} */
  const blockNames = { ice: "An ice block", jelly: "A jelly block", sponge: "A sponge", hot: "A hot plate" };
  for (const block of room.blocks ?? []) lines.push(`${blockNames[block.type]} at ${where(block.x, block.y)}.`);
  for (const fan of room.fans ?? []) {
    const dir = Math.abs(fan.fx) >= Math.abs(fan.fy) ? (fan.fx < 0 ? "left" : "right") : fan.fy < 0 ? "up" : "down";
    lines.push(`A fan at ${where(fan.x + fan.w / 2, fan.y + fan.h / 2)} blows ${dir}.`);
  }
  for (const pipe of room.pipes ?? []) {
    lines.push(`A pipe joins ${where(pipe.a.x, pipe.a.y)} and ${where(pipe.b.x, pipe.b.y)}.`);
  }
  for (const scale of room.scales ?? []) {
    lines.push(`A scale pan at ${where(scale.x, scale.y)} opens a gate once it holds ${scale.need}.`);
  }
  for (const gate of room.gates ?? []) lines.push(`A closed gate at ${where((gate.x1 + gate.x2) / 2, (gate.y1 + gate.y2) / 2)}.`);
  if (room.hopper) lines.push(`A hopper at ${where(room.hopper.x, room.hopper.y)} drops ${count(room.hopper.count, "pearl")} when the pour starts.`);
  lines.push(`${Math.round(room.straw)} units of straw, and ${Math.round(room.plan ?? DEFAULT_PLAN)} seconds to plan.`);
  return lines.join(" ");
}
