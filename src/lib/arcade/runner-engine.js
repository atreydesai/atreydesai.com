// Sugar rush rules: a cup of milk tea on legs runs the rooftops at dusk,
// making deliveries. The tea in the cup is both its health and its pay: rough
// play sloshes it out, a fuller cup pays more at each drop-off, and an empty
// cup is a failed delivery. Kept free of the DOM, of Math.random and of the
// clock, so a seed and a list of inputs always replay the same run under node.
//
// The world is in its own units. x grows along the run (the runner only ever
// moves right) and doubles as the distance that sets speed and difficulty. y
// points up: the street is y = 0 and roof tops are positive. The runner's
// (x, y) is the middle of its feet, so its box is x ± RUNNER_W / 2 across and
// y to y + RUNNER_H up (SLIDE_H while sliding).
//
// The screen calls step(state, input, STEP) at 120 Hz with the keys held
// ({ jump, down, rush }); presses are found here, so the screen never has to.
// step mutates the state and returns that step's events for sound and effects.
// The course is generated a little ahead of the runner in chunks, each built
// from an authored pattern, and dropped once it is well behind.

export const STEP = 1 / 120;
export const GAME_ID = "runner";

// --- The runner -----------------------------------------------------------------

export const RUNNER_W = 14;
export const RUNNER_H = 18;
/** Box height while sliding: under anything whose underside is above it. */
export const SLIDE_H = 9;
const HALF_W = RUNNER_W / 2;

export const START_SPEED = 150;
export const TOP_SPEED = 330;
/** World x at which the run reaches TOP_SPEED, about three minutes in. */
export const SPEED_RAMP = 46000;
/** World x at which difficulty reaches 1, a little under two minutes in. */
export const DIFFICULTY_RAMP = 24000;

export const GRAVITY = 1600;
export const JUMP_SPEED = 400;
/** Gravity while jump is held on the way up, for at most HOLD_TIME. */
export const HOLD_GRAVITY = 500;
export const HOLD_TIME = 0.22;
/** A jump still works this long after running off an edge. */
export const COYOTE_TIME = 0.08;
/** A press this long before landing jumps on landing. */
export const BUFFER_TIME = 0.1;
export const TERMINAL_FALL = 900;
/** Glide stamina per airtime, refilled on touching down. */
export const GLIDE_TIME = 0.9;
/** Fastest fall while gliding. */
export const GLIDE_FALL = 60;
/** How hard a glide brakes a fall that is already faster than GLIDE_FALL. */
const GLIDE_BRAKE = 4000;
export const SLIDE_TIME = 0.5;
/** Holding down stretches a slide to this, no further (unless something is overhead). */
export const SLIDE_MAX = 0.8;
export const SLAM_SPEED = 950;
/** A slam drops nearly straight down, so it lands where it is aimed. */
export const SLAM_DRIFT = 0.5;
/** A wall this much higher than the feet is stepped up onto, not run into. */
export const MANTLE = 10;
/** Launch speed off an awning. */
export const BOUNCE_SPEED = 760;
/** Updraft acceleration over a vent, and the fastest it lifts. */
export const LIFT = 2800;
export const LIFT_MAX = 300;
/** A glide rides an updraft this much higher than its ceiling. */
export const GLIDE_LIFT_BONUS = 50;
/** Hop speed when letting go of a cable with jump. */
export const CABLE_JUMP = 330;
/** Below this the runner has fallen into the alley. */
export const FALL_Y = -40;

// --- The cup ------------------------------------------------------------------------

/** Impacts slower than this spill nothing. A full jump onto the same level lands at about 570. */
export const SAFE_LANDING = 600;
/** Tea lost per unit/s of impact over SAFE_LANDING, up to MAX_LANDING_SPILL. */
export const LANDING_SPILL = 0.0011;
export const MAX_LANDING_SPILL = 0.35;
export const SLAM_SPILL = 0.05;
export const BUMP_SPILL = 0.12;
export const PIGEON_SPILL = 0.1;
/** A bump slows the runner by up to STUMBLE_SLOW, easing off over STUMBLE_TIME. */
export const STUMBLE_TIME = 0.5;
export const STUMBLE_SLOW = 0.35;
/** After a bump, nothing else can bump or strike for this long. */
export const GRACE_TIME = 1;
export const RESPAWN_GRACE = 1.5;
/** Seconds between falling and reappearing. */
export const RESPAWN_TIME = 1;
export const START_LIVES = 3;
/** The cup is refilled to this when it runs dry (and after a fall, if lower). */
export const DRY_REFILL = 0.6;

// --- Score --------------------------------------------------------------------------

/** World units per metre; the distance score is one point a metre. */
export const METRE = 10;
/** A cup this full or fuller is a full cup. */
export const FULL_CUP = 0.9;
export const DELIVERY_BASE = 100;
export const FULL_CUP_BONUS = 50;
/** Each delivery in a streak adds this to the multiplier, up to STREAK_CAP deliveries. */
export const STREAK_STEP = 0.25;
export const STREAK_CAP = 8;
/** Sugar for delivering a full cup. */
export const FULL_CUP_SUGAR = 2;
export const PEARL_POINTS = 10;
/** A pearl chain lapses after this long without a pearl. */
export const COMBO_WINDOW = 1.2;
export const MAX_COMBO = 5;
/** Pearls per step of the combo multiplier. */
export const COMBO_STEP = 5;
export const SUGAR_FULL = 30;
export const RUSH_TIME = 4.5;
export const RUSH_SPEED = 1.2;
/** Pearls this close to the runner's middle are pulled in during a rush. */
export const RUSH_MAGNET = 64;
export const SMASH_POINTS = 25;
export const CRATE_POINTS = 30;
/** Pearls packed in each crate, freed when it breaks. */
export const PEARLS_PER_CRATE = 2;
export const PEARL_RADIUS = 5;

// --- The course ---------------------------------------------------------------------

export const MIN_TOP = 40;
export const MAX_TOP = 280;
export const BUILDING_STYLES = 8;
export const COASTER_W = 24;
/** Pigeons take off when the runner is this many seconds away, so they rise into the jump line at any speed. */
export const PIGEON_WARNING = 0.75;
export const PIGEON_W = 10;
export const PIGEON_H = 8;
/** Course is kept generated this far ahead of the runner, and kept this far behind. */
const AHEAD = 1600;
const BEHIND = 700;
const EPS = 1e-6;

/** Music phase by distance run. */
export const PHASES = Object.freeze([
  { phase: "opening", from: 0 },
  { phase: "steady", from: 3000 },
  { phase: "rush", from: 15000 },
]);

/**
 * @typedef {{
 *   type: "roof", x0: number, x1: number, top: number, kind: "roof" | "chimney",
 *   style: number, tower: boolean, sign: boolean, seed: number
 * }} Roof
 */
/** @typedef {{ x0: number, x1: number, dy: number, speed: number, assist: null | "drop" | "awning" | "vent" | "cable" }} Gap */
/**
 * Everything on the course the screen draws. Solid obstacles (ac, tank, crate)
 * stand on a roof from y0 to y1 and can be stood on; low ones (clothesline,
 * billboard) hang from y0 to y1 and are slid under. `hit` marks one bumped
 * through, `broken` one smashed.
 * @typedef {(
 *   { type: "pearl", x: number, y: number, taken: boolean }
 *   | { type: "coaster", x0: number, x1: number, y: number, customer: boolean, hard: boolean, done: null | "delivered" | "missed" }
 *   | { type: "ac" | "tank" | "crate" | "clothesline" | "billboard", x0: number, x1: number, y0: number, y1: number, count: number, hit: boolean, broken: boolean }
 *   | { type: "awning" | "ledge", x0: number, x1: number, y: number }
 *   | { type: "vent", x0: number, x1: number, y0: number, ceiling: number }
 *   | { type: "cable", x0: number, y0: number, x1: number, y1: number }
 *   | { type: "pigeon", x: number, y: number, vx: number, vy: number, delay: number, state: "sit" | "fly" | "struck", t: number }
 * )} Item
 */
/**
 * @typedef {{
 *   id: number, pattern: string, x0: number, x1: number, difficulty: number, speed: number,
 *   roofs: Roof[], items: Item[], gaps: Gap[]
 * }} Chunk
 */
/** @typedef {{ jump?: boolean, down?: boolean, rush?: boolean }} Input */
/** @typedef {{ type: string, [key: string]: any }} RunEvent */

/**
 * @param {number} value
 * @param {number} low
 * @param {number} high
 */
function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

// --- Randomness -----------------------------------------------------------------------

/**
 * Advances a mulberry32 generator whose whole state is one integer, so the
 * generator can live inside a run's state and be cloned with it.
 * @param {{ s: number }} gen mutated
 * @returns {number} a value in [0, 1)
 */
export function nextRandom(gen) {
  const a = (gen.s + 0x6d2b79f5) | 0;
  gen.s = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * A seeded generator as a function, for callers that don't keep state.
 * @param {number} seed
 * @returns {() => number}
 */
export function createRng(seed) {
  const gen = { s: seed | 0 };
  return () => nextRandom(gen);
}

// --- Curves -------------------------------------------------------------------------------

/**
 * Running speed at world x: eases from START_SPEED to TOP_SPEED.
 * @param {number} x
 */
export function speedAt(x) {
  const u = clamp(x / SPEED_RAMP, 0, 1);
  return START_SPEED + (TOP_SPEED - START_SPEED) * u * (2 - u);
}

/**
 * Difficulty, 0 to 1, at world x. Patterns unlock by it and stretch with it.
 * @param {number} x
 */
export function difficultyAt(x) {
  return clamp(x / DIFFICULTY_RAMP, 0, 1);
}

/**
 * Units between deliveries: close together early, further apart later.
 * @param {number} difficulty
 */
export function deliverySpacing(difficulty) {
  return 350 + 150 * clamp(difficulty, 0, 1);
}

/**
 * The music's phase at a distance run.
 * @param {number} distance
 * @returns {"opening" | "steady" | "rush"}
 */
export function phaseAt(distance) {
  let phase = PHASES[0].phase;
  for (const entry of PHASES) if (distance >= entry.from) phase = entry.phase;
  return /** @type {"opening" | "steady" | "rush"} */ (phase);
}

/**
 * The pearl multiplier for a chain this long (counting the pearl just taken).
 * @param {number} chain
 */
export function comboMultiplier(chain) {
  return Math.min(MAX_COMBO, 1 + Math.floor(Math.max(0, chain) / COMBO_STEP));
}

/**
 * Points for a delivery: the fuller the cup and the longer the streak, the more.
 * @param {number} tea 0 to 1, the cup as it arrives
 * @param {number} streak deliveries in a row before this one
 */
export function deliveryPoints(tea, streak) {
  const multiplier = 1 + STREAK_STEP * Math.min(Math.max(0, streak), STREAK_CAP);
  const full = tea >= FULL_CUP;
  const base = DELIVERY_BASE * (0.2 + 0.8 * clamp(tea, 0, 1)) + (full ? FULL_CUP_BONUS : 0);
  return Math.round(base * multiplier);
}

/**
 * Tea a landing spills, for the speed the feet hit at. Glides and rushes spill
 * nothing; a slam always spills its fixed slosh.
 * @param {number} impact downward speed at touchdown, positive
 * @param {{ gliding?: boolean, slamming?: boolean, rushing?: boolean }} [how]
 */
export function landingSpill(impact, how = {}) {
  if (how.gliding || how.rushing) return 0;
  if (how.slamming) return SLAM_SPILL;
  if (impact <= SAFE_LANDING) return 0;
  return Math.min(MAX_LANDING_SPILL, (impact - SAFE_LANDING) * LANDING_SPILL);
}

// --- Flight -------------------------------------------------------------------------------

/**
 * @typedef {{ vy: number, jumpHold: number, glideLeft: number, gliding: boolean }} Body
 */

/**
 * One step of airborne motion. The run and the generator's reach tables share
 * it, so every gap is planned with the physics the runner actually flies by.
 * @param {Body} body mutated
 * @param {boolean} held whether jump is held
 * @param {number} dt
 */
function fly(body, held, dt) {
  let gravity = GRAVITY;
  if (body.jumpHold > 0) {
    if (held && body.vy > 0) {
      gravity = HOLD_GRAVITY;
      body.jumpHold = Math.max(0, body.jumpHold - dt);
    } else {
      // Letting go ends the rise's extension for good; it can't be resumed.
      body.jumpHold = 0;
    }
  }
  body.vy -= gravity * dt;
  body.gliding = held && body.vy < 0 && body.glideLeft > 0 && body.jumpHold === 0;
  if (body.gliding) {
    body.glideLeft = Math.max(0, body.glideLeft - dt);
    if (body.vy < -GLIDE_FALL) body.vy = Math.min(-GLIDE_FALL, body.vy + GLIDE_BRAKE * dt);
  }
  if (body.vy < -TERMINAL_FALL) body.vy = -TERMINAL_FALL;
}

/**
 * Samples a jump from (0, 0) at a steady speed, holding jump for `hold`
 * seconds (STEP is a tap, HOLD_TIME a full jump; glide only if asked).
 * @param {number} speed
 * @param {{ hold?: number, glide?: boolean, vy?: number, until?: number, seconds?: number }} [options]
 *   vy overrides the launch speed (an awning's bounce); sampling stops once the
 *   path falls below `until`, or after `seconds`.
 * @returns {Array<{ t: number, x: number, y: number, vy: number }>}
 */
export function jumpPath(speed, options = {}) {
  const { hold = HOLD_TIME, glide = false, vy = JUMP_SPEED, until = -200, seconds = 3 } = options;
  const body = { vy, jumpHold: vy === JUMP_SPEED ? HOLD_TIME : 0, glideLeft: glide ? GLIDE_TIME : 0, gliding: false };
  const path = [];
  let x = 0;
  let y = 0;
  for (let i = 1; i * STEP <= seconds; i++) {
    const t = i * STEP;
    fly(body, t - STEP < hold || (glide && body.vy <= 0), STEP);
    x += speed * STEP;
    y += body.vy * STEP;
    path.push({ t, x, y, vy: body.vy });
    if (body.vy < 0 && y < until) break;
  }
  return path;
}

/**
 * How far a jump carries before coming back down to dy above its takeoff,
 * or 0 if it never gets that high. A full hold by default; pass STEP for a tap.
 * @param {number} speed
 * @param {number} [dy]
 * @param {number} [hold]
 */
export function jumpReach(speed, dy = 0, hold = HOLD_TIME) {
  const body = { vy: JUMP_SPEED, jumpHold: HOLD_TIME, glideLeft: 0, gliding: false };
  let x = 0;
  let y = 0;
  let apex = 0;
  for (let i = 1; i < 600; i++) {
    fly(body, (i - 1) * STEP < hold, STEP);
    x += speed * STEP;
    y += body.vy * STEP;
    apex = Math.max(apex, y);
    if (body.vy < 0 && y <= dy) return apex >= dy ? x : 0;
  }
  return 0;
}

/**
 * How far a full jump with a full glide carries before coming down to dy:
 * the furthest anything crosses without help.
 * @param {number} speed
 * @param {number} [dy]
 */
export function glideReach(speed, dy = 0) {
  const path = jumpPath(speed, { glide: true, until: dy, seconds: 4 });
  const last = path[path.length - 1];
  return last.y <= dy ? last.x : 0;
}

/**
 * How far running off an edge carries before dropping `drop` units.
 * @param {number} speed
 * @param {number} drop positive
 */
export function fallReach(speed, drop) {
  const body = { vy: 0, jumpHold: 0, glideLeft: 0, gliding: false };
  let x = 0;
  let y = 0;
  while (y > -drop) {
    fly(body, false, STEP);
    x += speed * STEP;
    y += body.vy * STEP;
  }
  return x;
}

/**
 * Where a pigeon is now: sitting, or on its way up and away.
 * @param {Extract<Item, { type: "pigeon" }>} pigeon
 */
export function pigeonPosition(pigeon) {
  if (pigeon.state === "sit") return { x: pigeon.x, y: pigeon.y };
  const t = Math.max(0, pigeon.t - pigeon.delay);
  return { x: pigeon.x + pigeon.vx * t, y: pigeon.y + pigeon.vy * t + 30 * t * t };
}

/**
 * Hand height of a cable at x.
 * @param {{ x0: number, y0: number, x1: number, y1: number }} cable
 * @param {number} x
 */
export function cableY(cable, x) {
  return cable.y0 + ((cable.y1 - cable.y0) * (x - cable.x0)) / (cable.x1 - cable.x0);
}

// --- Patterns -------------------------------------------------------------------------------

/**
 * The authored set pieces, by the difficulty that unlocks each. A pattern's
 * parameters stretch from its first, teaching form toward a remix as
 * difficulty climbs past its minimum.
 */
export const PATTERNS = Object.freeze([
  { id: "warmup", min: 0, weight: 1, late: 0.3, note: "a flat roof and a line of pearls" },
  { id: "gap", min: 0, weight: 1.2, note: "a plain gap" },
  { id: "stepDown", min: 0, weight: 1, bias: "down", note: "a gap down to a lower roof" },
  { id: "hops", min: 0, weight: 1.2, note: "ac units and, later, water tanks to hop" },
  { id: "stepUp", min: 0.05, weight: 1, bias: "up", note: "a gap up to a higher roof" },
  { id: "duck", min: 0.1, weight: 1, note: "a clothesline or billboard to slide under" },
  { id: "pigeons", min: 0.1, weight: 0.8, note: "a flock that takes off as you come; jumping into it spills" },
  { id: "longDrop", min: 0.15, weight: 1, bias: "down", note: "a long drop: glide late to save the tea" },
  { id: "crates", min: 0.15, weight: 0.9, note: "crate stacks to hop, or slam open for pearls" },
  { id: "awning", min: 0.2, weight: 0.8, bias: "up", note: "an awning that bounces you to a high roof" },
  { id: "stairs", min: 0.2, weight: 0.8, note: "three short steps up or down" },
  { id: "slideDrop", min: 0.25, weight: 0.8, note: "slide under a billboard and off the edge" },
  { id: "hopSlide", min: 0.3, weight: 0.9, note: "a hop straight into a slide" },
  { id: "cable", min: 0.3, weight: 0.8, bias: "down", note: "a cable to catch and ride across a wide gap" },
  { id: "vent", min: 0.35, weight: 0.8, note: "an updraft that carries you over a gap too wide to jump" },
  { id: "split", min: 0.35, weight: 0.7, note: "an upper line of pearls over a lower line with the coaster" },
  { id: "chimneys", min: 0.4, weight: 0.8, note: "a run of narrow chimney tops" },
  { id: "gauntlet", min: 0.55, weight: 0.9, note: "everything at once: hops, slides and crates in a row" },
]);

/**
 * A builder lays a pattern down from the end of the course, keeping the
 * pieces and the reach tables it needs in one place.
 * @param {any} course
 * @param {number} remix 0 to 1, how far past its minimum the pattern is
 */
function makeBuilder(course, remix) {
  const x0 = course.end;
  const random = () => nextRandom(course.gen);
  const v = speedAt(x0);
  /** @type {null | { x0: number, x1: number, assist: Gap["assist"], from: number }} */
  let pending = null;
  const b = {
    x: x0,
    top: course.top,
    d: difficultyAt(x0),
    t: remix,
    v,
    /** Clean roof before a gap, so a stumble has eased off by the edge. */
    runway: 0.6 * v,
    random,
    /** @type {Roof[]} */ roofs: [],
    /** @type {Item[]} */ items: [],
    /** @type {Gap[]} */ gaps: [],
    /** @type {Array<{ x: number, y: number, hard: boolean }>} */ slots: [],
    /** @type {null | { x: number, y: number }} */ forced: null,
    /** @param {number} low @param {number} high */
    range: (low, high) => low + (high - low) * random(),
    /**
     * The widest gap a full jump clears to a roof dy higher, scaled by frac.
     * The runner's own width is taken off so the margin is real.
     * @param {number} dy @param {number} frac
     */
    fit: (dy, frac) => Math.max(0, jumpReach(v, dy) - RUNNER_W) * frac,
    /** @param {number} width @param {Gap["assist"]} [assist] */
    gap(width, assist = null) {
      const w = Math.round(width);
      pending = { x0: b.x, x1: b.x + w, assist, from: b.top };
      b.x += w;
    },
    /** @param {number} width @param {number} [top] @param {"roof" | "chimney"} [kind] */
    roof(width, top, kind = "roof") {
      // Not a default parameter: one that reads `b` makes `b` type itself.
      const t = Math.round(clamp(top === undefined ? b.top : top, MIN_TOP, MAX_TOP));
      if (pending) {
        b.gaps.push({ x0: pending.x0, x1: pending.x1, dy: t - pending.from, speed: v, assist: pending.assist });
        pending = null;
      }
      const w = Math.round(width);
      /** @type {Roof} */
      const roof = {
        type: "roof",
        x0: b.x,
        x1: b.x + w,
        top: t,
        kind,
        style: Math.floor(random() * BUILDING_STYLES),
        tower: kind === "roof" && w >= 180 && random() < 0.3,
        sign: kind === "roof" && random() < 0.2,
        seed: Math.floor(random() * 2 ** 30),
      };
      b.roofs.push(roof);
      b.x += w;
      b.top = t;
      return roof;
    },
    /** Half the time a small gap, otherwise straight on at the same height. */
    lead() {
      if (random() < 0.5) b.gap(Math.max(20, b.fit(0, b.range(0.25, 0.4))));
    },
    /** @template {Item} T @param {T} item @returns {T} */
    add(item) {
      b.items.push(item);
      return item;
    },
    /** @param {number} x @param {number} y */
    pearl(x, y) {
      b.add({ type: "pearl", x: Math.round(x), y: Math.round(y), taken: false });
    },
    /**
     * Pearls along the path of a jump from (x, feet y), at the body's middle,
     * so following the line takes every one.
     * @param {number} x @param {number} y @param {number} hold @param {number} count
     * @param {{ every?: number, vy?: number, glide?: boolean }} [options]
     */
    arc(x, y, hold, count, options = {}) {
      const { every = 0.08, vy = JUMP_SPEED, glide = false } = options;
      const path = jumpPath(v, { hold, vy, glide, seconds: every * count + STEP });
      for (let k = 1; k <= count; k++) {
        const p = path[Math.min(path.length - 1, Math.round((every * k) / STEP) - 1)];
        b.pearl(x + p.x, y + p.y + RUNNER_H / 2);
      }
    },
    /** @param {number} x @param {number} y @param {number} count @param {number} spacing */
    line(x, y, count, spacing) {
      for (let k = 0; k < count; k++) b.pearl(x + k * spacing, y);
    },
    /**
     * @param {"ac" | "tank" | "crate" | "clothesline" | "billboard"} type
     * @param {number} x @param {number} top the roof under it
     */
    obstacle(type, x, top) {
      const random3 = () => random();
      let w = 24;
      let y0 = top;
      let y1 = top + 16;
      let count = 1;
      if (type === "ac") {
        w = Math.round(22 + random3() * 6);
        y1 = top + Math.round(14 + random3() * 4);
      } else if (type === "tank") {
        w = Math.round(30 + random3() * 6);
        y1 = top + Math.round(30 + random3() * 6);
      } else if (type === "crate") {
        count = 1 + Math.floor(random3() * Math.min(3, 1 + 2 * b.t + b.d));
        w = 20;
        y1 = top + 18 * count;
      } else if (type === "clothesline") {
        w = Math.round(60 + random3() * 20);
        y0 = top + 11;
        y1 = top + 13;
      } else {
        w = Math.round(70 + 50 * b.t + random3() * 20);
        y0 = top + 11;
        y1 = top + 110;
      }
      return b.add({ type, x0: Math.round(x), x1: Math.round(x) + w, y0, y1, count, hit: false, broken: false });
    },
    /** @param {number} x @param {number} y @param {boolean} [hard] */
    slot(x, y, hard = false) {
      b.slots.push({ x: Math.round(x), y, hard });
    },
  };
  return b;
}

/** @typedef {ReturnType<typeof makeBuilder>} Builder */

/**
 * Lays obstacles along a fresh roof with time-based spacing, so they read the
 * same at any speed, and arcs of pearls over each.
 * @param {Builder} b
 * @param {Array<"ac" | "tank" | "crate" | "clothesline" | "billboard">} types
 * @param {{ slots?: boolean }} [options]
 */
function obstacleRun(b, types, options = {}) {
  const { v } = b;
  const r = b.roof(10);
  // Lay the obstacles out first, then stretch the roof under them.
  let x = r.x0 + b.runway;
  /** @type {any[]} */
  const placed = [];
  types.forEach((type, i) => {
    const o = b.obstacle(type, x, r.top);
    placed.push(o);
    const low = type === "clothesline" || type === "billboard";
    const next = types[i + 1];
    let space = v * b.range(0.85 - 0.2 * b.t, 1.05);
    // Off a slide straight into a hop is quick; into a second slide, quicker.
    if (low) space = v * b.range(0.5, 0.65) + 20;
    // A tall tank needs a full jump, which lands a little later.
    if (type === "tank") space += 0.1 * v;
    if (next === "billboard" || next === "clothesline") space = Math.max(space, 0.55 * v + 10);
    x = o.x1 + space;
  });
  const last = placed[placed.length - 1];
  r.x1 = Math.round(last.x1 + b.runway + b.range(20, 80));
  b.x = r.x1;
  for (const o of placed) {
    const low = o.type === "clothesline" || o.type === "billboard";
    if (low) {
      const n = Math.max(2, Math.floor((o.x1 - o.x0) / 24));
      b.line(o.x0, r.top + 5, n, (o.x1 - o.x0) / (n - 1));
    } else if (o.y1 - o.y0 > 20) {
      b.arc(o.x0 - 0.3 * v, r.top, HOLD_TIME, 7, { every: 0.09 });
      if ((o.type === "tank" || o.type === "crate") && options.slots !== false) b.slot((o.x0 + o.x1) / 2, o.y1, true);
    } else {
      b.arc(o.x0 - 0.22 * v, r.top, STEP, 5, { every: 0.08 });
    }
  }
  if (options.slots !== false) {
    const after = last.x1 + 0.45 * v;
    if (after + 40 < r.x1 - 30) b.slot(after, r.top);
    else b.slot(r.x0 + b.runway * 0.5, r.top);
  }
  return r;
}

/** @type {Record<string, { can?: (top: number) => boolean, build: (b: Builder) => void }>} */
const BUILDERS = {
  warmup: {
    build(b) {
      b.lead();
      const r = b.roof(b.range(340, 480));
      const w = r.x1 - r.x0;
      b.arc(r.x0 + 0.25 * w, r.top, STEP, 5);
      b.slot(r.x0 + 0.7 * w, r.top);
    },
  },
  gap: {
    build(b) {
      const from = b.top;
      const dy = Math.round(b.range(-12, 12));
      const edge = b.x;
      b.gap(Math.max(24, b.fit(dy, b.range(0.4, 0.5 + 0.28 * b.t))));
      const r = b.roof(b.range(b.runway + 140, b.runway + 260), b.top + dy);
      b.arc(edge - 0.08 * b.v, from, HOLD_TIME, 7, { every: 0.09 });
      b.slot(r.x0 + 0.55 * (r.x1 - r.x0), r.top);
    },
  },
  stepDown: {
    can: (top) => top >= MIN_TOP + 50,
    build(b) {
      const from = b.top;
      const dy = -Math.min(from - MIN_TOP, Math.round(b.range(40, 60 + 40 * b.t)));
      const edge = b.x;
      b.gap(Math.max(24, b.fit(dy, b.range(0.3, 0.45 + 0.3 * b.t))));
      const r = b.roof(b.range(b.runway + 140, b.runway + 260), from + dy);
      b.arc(edge - 0.05 * b.v, from, STEP, 6, { every: 0.08 });
      b.slot(r.x0 + 0.5 * (r.x1 - r.x0), r.top);
    },
  },
  hops: {
    build(b) {
      b.lead();
      const count = 1 + Math.floor(b.random() * (1 + 2 * b.t + b.d));
      /** @type {Array<"ac" | "tank">} */
      const types = [];
      for (let i = 0; i < Math.min(3, count); i++) types.push(b.d >= 0.2 && b.random() < 0.4 ? "tank" : "ac");
      obstacleRun(b, types);
    },
  },
  stepUp: {
    can: (top) => top <= MAX_TOP - 40,
    build(b) {
      const from = b.top;
      const dy = Math.round(b.range(26, 40 + 24 * b.t));
      const edge = b.x;
      b.gap(Math.max(20, b.fit(dy, b.range(0.3, 0.45 + 0.25 * b.t))));
      const r = b.roof(b.range(b.runway + 140, b.runway + 240), from + dy);
      b.arc(edge - 0.1 * b.v, from, HOLD_TIME, 6, { every: 0.08 });
      b.slot(r.x0 + 0.5 * (r.x1 - r.x0), r.top);
    },
  },
  duck: {
    build(b) {
      b.lead();
      obstacleRun(b, [b.t < 0.5 && b.random() < 0.6 ? "clothesline" : "billboard"]);
    },
  },
  pigeons: {
    build(b) {
      const { v } = b;
      b.lead();
      const edgeVariant = b.t >= 0.25 && b.random() < 0.5;
      const r = b.roof(b.runway + (edgeVariant ? 180 : 300) + b.range(0, 80));
      const start = edgeVariant ? r.x1 - 60 : r.x0 + b.runway + 40;
      const count = 3 + Math.floor(b.random() * 3);
      let x = start;
      for (let i = 0; i < count; i++) {
        b.add({
          type: "pigeon",
          x: Math.round(x),
          y: r.top,
          vx: Math.round(b.range(30, 60)),
          vy: Math.round(b.range(50, 80)),
          delay: Math.round(b.random() * 15) / 100,
          state: "sit",
          t: 0,
        });
        x += b.range(9, 16);
      }
      // Staying low under a flock is safe, so the pearls sit low.
      b.line(start - 20, r.top + 6, 4, (x - start + 20) / 3);
      if (edgeVariant) {
        // The flock rises right where the jump goes: a tap clears this gap,
        // a full jump flies into the birds.
        const tap = Math.max(0, jumpReach(v, 0, STEP) - RUNNER_W);
        b.gap(Math.max(24, Math.min(b.fit(0, 0.5), tap * 0.75)));
        const next = b.roof(b.range(b.runway + 120, b.runway + 220));
        b.slot(next.x0 + 0.5 * (next.x1 - next.x0), next.top);
      } else {
        if (b.t >= 0.25 && b.random() < 0.5) {
          b.obstacle("ac", x + 1.1 * v, r.top);
          r.x1 = Math.round(x + 1.1 * v + 30 + b.runway);
          b.x = r.x1;
        }
        b.slot(r.x0 + b.runway * 0.5, r.top);
      }
    },
  },
  longDrop: {
    can: (top) => top >= 170,
    build(b) {
      const { v } = b;
      const from = b.top;
      const drop = Math.min(from - MIN_TOP, Math.round(b.range(130, 160 + 50 * b.t)));
      const edge = b.x;
      b.gap(Math.max(30, fallReach(v, drop) * b.range(0.35, 0.6)), "drop");
      const r = b.roof(b.range(b.runway + 200, b.runway + 300), from - drop);
      // A glide line: the slope a glide falls at, from the edge to the roof.
      const n = 6;
      for (let k = 0; k < n; k++) {
        const x = edge + 10 + k * 0.14 * v;
        b.pearl(x, from + RUNNER_H / 2 - (drop * k) / n);
      }
      b.slot(r.x0 + 0.6 * (r.x1 - r.x0), r.top);
    },
  },
  crates: {
    build(b) {
      b.lead();
      const r = obstacleRun(b, b.t > 0.4 && b.random() < 0.5 ? ["crate", "crate"] : ["crate"]);
      void r;
    },
  },
  awning: {
    can: (top) => top <= MAX_TOP - 100 && top >= MIN_TOP + 60,
    build(b) {
      const { v } = b;
      b.lead();
      const a = b.roof(b.range(b.runway + 80, b.runway + 200));
      const drop = Math.round(24 + 24 * b.t * b.random());
      const width = Math.round(clamp(0.3 * v, 48, 70));
      const off = Math.round(b.t * b.random() * 0.08 * v);
      const awning = b.add({ type: "awning", x0: a.x1 + off, x1: a.x1 + off + width, y: a.top - drop });
      const highX = Math.round(awning.x1 + HALF_W + 0.3 * v);
      const highTop = awning.y + Math.round(b.range(100, 118));
      b.gap(highX - a.x1, "awning");
      const high = b.roof(b.range(b.runway + 220, b.runway + 320), highTop);
      b.arc((awning.x0 + awning.x1) / 2, awning.y, 0, 6, { every: 0.1, vy: BOUNCE_SPEED });
      b.line(high.x0 + 40, high.top + 30, 5, 26);
      b.slot(high.x0 + 0.6 * (high.x1 - high.x0), high.top);
    },
  },
  stairs: {
    build(b) {
      const up = b.top < (MIN_TOP + MAX_TOP) / 2 + (b.random() - 0.5) * 60;
      for (let i = 0; i < 3; i++) {
        const from = b.top;
        const dy = Math.round((up ? 1 : -1) * b.range(22, 36));
        const edge = b.x;
        const g = up ? Math.max(18, b.fit(dy, b.range(0.25, 0.4))) : Math.max(20, b.fit(dy, b.range(0.25, 0.45)));
        b.gap(g);
        const r = b.roof(b.range(0.45 * b.v + 70, 0.55 * b.v + 110), from + dy);
        b.arc(edge - 0.1 * b.v, from, STEP, 5);
        if (i === 2) b.slot(r.x0 + 0.5 * (r.x1 - r.x0), r.top);
      }
    },
  },
  slideDrop: {
    can: (top) => top >= MIN_TOP + 70,
    build(b) {
      const { v } = b;
      b.lead();
      const a = b.roof(b.runway + b.range(160, 220));
      const board = b.obstacle("billboard", a.x1 - (0.5 * v + 30), a.top);
      board.x1 = a.x1 + 16;
      const n = Math.max(2, Math.floor((board.x1 - board.x0) / 24));
      b.line(board.x0, a.top + 5, n, (board.x1 - board.x0) / (n - 1));
      const drop = Math.round(b.range(50, 80));
      b.gap(Math.max(24, (fallReach(v, drop) + RUNNER_W) * b.range(0.45, 0.65)), "drop");
      const r = b.roof(b.range(b.runway + 160, b.runway + 260), a.top - drop);
      b.slot(r.x0 + 0.5 * (r.x1 - r.x0), r.top);
    },
  },
  hopSlide: {
    build(b) {
      b.lead();
      obstacleRun(b, ["ac", "billboard"]);
    },
  },
  cable: {
    can: (top) => top >= MIN_TOP + 80,
    build(b) {
      const { v } = b;
      b.lead();
      const a = b.roof(b.range(b.runway + 120, b.runway + 220));
      const drop = Math.min(a.top - MIN_TOP, Math.round(b.range(60, 110)));
      // Wider than any jump, even with a glide, so the cable is the way across.
      const span = Math.round((glideReach(v, -drop) + RUNNER_W) * b.range(1.08, 1.18) + 10);
      b.gap(span, "cable");
      const far = b.roof(b.range(b.runway + 200, b.runway + 300), a.top - drop);
      const cable = b.add({ type: "cable", x0: a.x1 - 36, y0: a.top + 44, x1: far.x0 + 40, y1: far.top + 30 });
      for (let x = cable.x0 + 40; x < cable.x1 - 20; x += 36) b.pearl(x, cableY(cable, x) - RUNNER_H / 2);
      b.slot(far.x0 + 0.6 * (far.x1 - far.x0), far.top);
    },
  },
  vent: {
    can: (top) => top <= MAX_TOP - 140,
    build(b) {
      const { v } = b;
      b.lead();
      const a = b.roof(b.range(b.runway + 80, b.runway + 200));
      const x0 = a.x1 + 16;
      // Wider than a jump and a glide together, so the updraft is the way across.
      const width = Math.round(glideReach(v, 30) + RUNNER_W + 30);
      const ceiling = a.top + 110;
      b.add({ type: "vent", x0, x1: x0 + width, y0: 0, ceiling });
      const farX = x0 + width + 18;
      b.gap(farX - a.x1, "vent");
      const far = b.roof(b.range(b.runway + 160, b.runway + 260), a.top + Math.round(b.range(-30, 30)));
      // A plain float takes the low line; a glide rides higher for the top one.
      b.line(x0 + width * 0.2, ceiling + 4, 4, width * 0.2);
      b.line(x0 + width * 0.3, ceiling + GLIDE_LIFT_BONUS - 4, 3, width * 0.2);
      b.slot(far.x0 + 0.5 * (far.x1 - far.x0), far.top);
    },
  },
  split: {
    build(b) {
      const { v } = b;
      b.lead();
      const r = b.roof(10);
      const ac = b.obstacle("ac", r.x0 + b.runway, r.top);
      const coasterX = ac.x1 + 0.9 * v + 12;
      let end = coasterX + 12;
      if (b.t > 0.3) {
        const second = b.obstacle("ac", end + 0.6 * v, r.top);
        end = second.x1;
      }
      r.x1 = Math.round(end + b.runway + 40);
      b.x = r.x1;
      b.forced = { x: Math.round(coasterX), y: r.top };
      // The upper line: one-way planks over the lower roof, with the pearls.
      const y = r.top + 72;
      let x = r.x0 + b.runway - 0.1 * v;
      const stop = r.x1 - 0.5 * v;
      while (x < stop - 60) {
        const len = Math.min(stop - x, 0.7 * v + 80);
        const ledge = b.add({ type: "ledge", x0: Math.round(x), x1: Math.round(x + len), y });
        for (let px = ledge.x0 + 20; px < ledge.x1 - 10; px += 34) b.pearl(px, y + RUNNER_H / 2);
        x += len + b.range(26, 40);
      }
    },
  },
  chimneys: {
    can: (top) => top >= MIN_TOP + 30 && top <= MAX_TOP - 30,
    build(b) {
      const { v } = b;
      b.lead();
      b.roof(b.runway + b.range(40, 120));
      const count = 3 + Math.floor(b.random() * (1 + 2 * b.t));
      const hardAt = Math.floor(b.random() * count);
      for (let i = 0; i < Math.min(5, count); i++) {
        const from = b.top;
        const width = Math.round(b.range(32, 44) - 10 * b.t);
        const dy = Math.round(clamp(b.range(-18, 18), MIN_TOP - from, MAX_TOP - from));
        const tap = jumpReach(v, dy, STEP);
        const g = clamp(tap - width * b.range(0.6, 1), 22, Math.max(22, b.fit(dy, 0.8)));
        const edge = b.x;
        b.gap(g);
        const c = b.roof(width, from + dy, "chimney");
        b.arc(edge - 0.1 * v, from, STEP, 4, { every: 0.1 });
        if (i === hardAt && width >= COASTER_W) b.slot((c.x0 + c.x1) / 2, c.top, true);
      }
      const from = b.top;
      const dy = Math.round(b.range(-20, 10));
      b.gap(Math.max(22, b.fit(dy, 0.35)));
      const r = b.roof(b.range(b.runway + 160, b.runway + 240), from + dy);
      b.slot(r.x0 + 0.5 * (r.x1 - r.x0), r.top);
    },
  },
  gauntlet: {
    build(b) {
      b.lead();
      /** @type {Array<"ac" | "tank" | "crate" | "clothesline" | "billboard">} */
      const pool = ["ac", "tank", "crate", "clothesline", "billboard"];
      const count = 3 + (b.random() < b.t ? 1 : 0);
      /** @type {typeof pool} */
      const types = [];
      for (let i = 0; i < count; i++) {
        let type = pool[Math.floor(b.random() * pool.length)];
        // Two of a kind in a row is just repetition; mix it.
        if (type === types[i - 1]) type = pool[(pool.indexOf(type) + 1) % pool.length];
        types.push(type);
      }
      obstacleRun(b, types);
    },
  },
};

/**
 * Picks the next pattern: unlocked by difficulty, fitting the current roof
 * height, never the one just used. Patterns just unlocked come up more, so
 * each is taught before it is mixed in with the rest.
 * @param {any} course
 * @param {number} d
 */
function pickPattern(course, d) {
  const options = PATTERNS.filter((p) => {
    const can = BUILDERS[p.id].can;
    return p.min <= d && p.id !== course.last && (!can || can(course.top));
  });
  // Roofs drift back toward the middle heights, so the patterns that need a
  // tall roof (a long drop, a cable) or headroom (an awning) keep coming up.
  const low = course.top < 100;
  const high = course.top > 190;
  const weights = options.map((p) => {
    const late = 1 + ((p.late ?? 1) - 1) * d;
    const fresh = d - p.min < 0.1 && p.min > 0 ? 2 : 1;
    const drift = (low && p.bias === "up") || (high && p.bias === "down") ? 1.8 : 1;
    return p.weight * late * fresh * drift;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = nextRandom(course.gen) * total;
  for (let i = 0; i < options.length; i++) {
    roll -= weights[i];
    if (roll < 0) return options[i];
  }
  return options[options.length - 1];
}

/**
 * Spots on plain roof where a coaster could sit: clear of anything to hop or
 * duck, and not so near an edge that delivering means missing the jump.
 * @param {Builder} b
 */
function clearSpots(b) {
  /** @type {Array<{ x: number, y: number, hard: boolean }>} */
  const spots = [];
  for (const roof of b.roofs) {
    if (roof.kind !== "roof") continue;
    for (let x = roof.x0 + 40; x <= roof.x1 - 0.45 * b.v; x += 40) {
      const busy = b.items.some((item) => {
        const o = /** @type {any} */ (item);
        if (item.type === "pigeon") return Math.abs(o.x - x) < 60;
        if (isSolid(item) || isLow(item)) return o.x0 - 0.5 * b.v < x + 20 && o.x1 + 0.4 * b.v > x - 20;
        if (item.type === "cable" || item.type === "awning" || item.type === "vent") return o.x0 - 60 < x && o.x1 + 20 > x;
        return false;
      });
      if (!busy) spots.push({ x: Math.round(x), y: roof.top, hard: false });
    }
  }
  return spots;
}

/**
 * @param {Builder} b
 * @param {any} course
 * @param {{ x: number, y: number, hard: boolean }} spot
 * @param {number} d
 */
function placeCoaster(b, course, spot, d) {
  b.add({
    type: "coaster",
    x0: spot.x - COASTER_W / 2,
    x1: spot.x + COASTER_W / 2,
    y: spot.y,
    customer: true,
    hard: spot.hard,
    done: null,
  });
  course.nextCoaster = spot.x + deliverySpacing(d);
}

/**
 * Builds the next chunk onto the end of the course.
 * @param {any} course mutated
 * @returns {Chunk}
 */
function buildChunk(course) {
  const d = difficultyAt(course.end);
  const first = course.count === 0;
  const pattern = first ? PATTERNS[0] : pickPattern(course, d);
  const b = makeBuilder(course, clamp((d - pattern.min) / 0.4, 0, 1));
  if (first) {
    // The first roof is long, flat and quiet: a moment to find the keys.
    const r = b.roof(560);
    b.line(r.x0 + 240, r.top + 6, 4, 24);
    b.slot(r.x0 + 420, r.top);
  } else {
    BUILDERS[pattern.id].build(b);
  }

  // A delivery is due every so often. Split routes always carry one on the
  // low line; otherwise each goes to the clear spot nearest where it is due,
  // now and then a pattern's harder one (a tank top, a chimney).
  if (b.forced) placeCoaster(b, course, { ...b.forced, hard: false }, d);
  const spots = [...b.slots, ...clearSpots(b)];
  for (let guard = 0; guard < 4 && course.nextCoaster <= b.x + 150; guard++) {
    const due = course.nextCoaster;
    const hard = spots.filter((s) => s.hard && s.x >= due - 250);
    const plain = spots.filter((s) => !s.hard && s.x >= due - 100);
    if (!hard.length && !plain.length) break;
    const nearest = (/** @type {typeof spots} */ list) =>
      list.reduce((a, s) => (Math.abs(s.x - due) < Math.abs(a.x - due) ? s : a));
    const spot = hard.length && (!plain.length || nextRandom(course.gen) < 0.5) ? nearest(hard) : nearest(plain);
    placeCoaster(b, course, spot, d);
  }

  /** @type {Chunk} */
  const chunk = {
    id: course.count,
    pattern: pattern.id,
    x0: course.end,
    x1: b.x,
    difficulty: d,
    speed: b.v,
    roofs: b.roofs,
    items: b.items,
    gaps: b.gaps,
  };
  course.count += 1;
  course.end = b.x;
  course.top = b.top;
  course.last = pattern.id;
  return chunk;
}

/**
 * @param {number} seed
 * @param {number} start world x of the first roof
 */
function newCourse(seed, start) {
  return {
    gen: { s: (seed ^ 0x5bd1e995) | 0 },
    end: start,
    top: 120,
    count: 0,
    last: "",
    nextCoaster: start + 420,
  };
}

/**
 * Generates a course without running it, for tests and previews.
 * @param {number} seed
 * @param {number} length world units to cover
 * @param {number} [start]
 * @returns {Chunk[]}
 */
export function buildCourse(seed, length, start = 0) {
  const course = newCourse(seed, start);
  const chunks = [];
  while (course.end < start + length) chunks.push(buildChunk(course));
  return chunks;
}

// --- The run -------------------------------------------------------------------------------

/**
 * A fresh run: a full cup, three pearls of life, standing on the first roof.
 * @param {number} seed
 * @param {{ startDistance?: number }} [options] start further along (for
 *   practice and tests); speed and difficulty follow world x.
 */
export function newRun(seed, options = {}) {
  const start = Math.max(0, options.startDistance ?? 0);
  const course = newCourse(seed, start);
  const first = buildChunk(course);
  const roof = first.roofs[0];
  const state = {
    seed,
    status: /** @type {"running" | "respawning" | "over"} */ ("running"),
    time: 0,
    startX: roof.x0 + 40,
    distance: 0,
    phase: phaseAt(0),
    lives: START_LIVES,
    tea: 1,
    sugar: 0,
    rush: 0,
    respawnIn: 0,
    combo: { chain: 0, timer: 0 },
    streak: 0,
    score: 0,
    points: { distance: 0, pearls: 0, deliveries: 0, smashes: 0 },
    stats: {
      pearls: 0,
      deliveries: 0,
      fullCups: 0,
      bestStreak: 0,
      missed: 0,
      rushes: 0,
      smashes: 0,
      bumps: 0,
      strikes: 0,
      falls: 0,
      dry: 0,
      spilled: 0,
      jumps: 0,
      bestCombo: 1,
    },
    held: { jump: false, down: false, rush: false },
    runner: {
      x: roof.x0 + 40,
      y: roof.top,
      vx: speedAt(roof.x0 + 40),
      vy: 0,
      grounded: true,
      coyote: 0,
      buffer: 0,
      jumpHold: 0,
      glideLeft: GLIDE_TIME,
      gliding: false,
      sliding: false,
      slideTime: 0,
      slamming: false,
      stumble: 0,
      grace: 0,
      blocked: false,
      venting: false,
      cableCooldown: 0,
      /** @type {null | Extract<Item, { type: "cable" }>} */
      cable: null,
    },
    course,
    /** @type {Chunk[]} */
    chunks: [first],
  };
  extendCourse(state);
  return state;
}

/** @typedef {ReturnType<typeof newRun>} RunState */

/**
 * A deep copy, for lookahead (a bot, a ghost) without touching the run.
 * @param {RunState} state
 * @returns {RunState}
 */
export function cloneRun(state) {
  return structuredClone(state);
}

/**
 * Keeps the course generated ahead and forgets what is far behind.
 * @param {RunState} state
 */
function extendCourse(state) {
  const x = state.runner.x;
  while (state.course.end < x + AHEAD) state.chunks.push(buildChunk(state.course));
  while (state.chunks.length > 1 && state.chunks[0].x1 < x - BEHIND) state.chunks.shift();
}

/**
 * The runner's box.
 * @param {RunState["runner"]} r
 */
export function runnerBox(r) {
  const height = r.sliding ? SLIDE_H : RUNNER_H;
  return { x0: r.x - HALF_W, x1: r.x + HALF_W, y0: r.y, y1: r.y + height };
}

/**
 * Chunks overlapping a stretch of world x, for drawing.
 * @param {RunState} state
 * @param {number} x0
 * @param {number} x1
 */
export function chunksIn(state, x0, x1) {
  return state.chunks.filter((c) => c.x1 >= x0 && c.x0 <= x1);
}

/** @param {Item} item */
function isSolid(item) {
  return item.type === "ac" || item.type === "tank" || item.type === "crate";
}

/** @param {Item} item */
function isLow(item) {
  return item.type === "clothesline" || item.type === "billboard";
}

/**
 * The top of anything that can be stood on, or null.
 * @param {Item} item
 */
function surfaceTop(item) {
  if (item.type === "ledge" || item.type === "awning") return item.y;
  if (isSolid(item)) {
    const o = /** @type {any} */ (item);
    return o.hit || o.broken ? null : o.y1;
  }
  return null;
}

/**
 * The highest surface the feet crossed on the way down this step.
 * @param {RunState} state
 * @param {number} prevY
 */
function findLanding(state, prevY) {
  const r = state.runner;
  const left = r.x - HALF_W;
  const right = r.x + HALF_W;
  /** @type {any} */
  let best = null;
  let bestY = -Infinity;
  for (const chunk of state.chunks) {
    if (chunk.x1 < left - 1 || chunk.x0 > right + 1) continue;
    for (const roof of chunk.roofs) {
      if (right > roof.x0 && left < roof.x1 && prevY >= roof.top - EPS && r.y <= roof.top && roof.top > bestY) {
        best = roof;
        bestY = roof.top;
      }
    }
    for (const item of chunk.items) {
      const top = surfaceTop(item);
      if (top === null) continue;
      const o = /** @type {any} */ (item);
      if (right > o.x0 && left < o.x1 && prevY >= top - EPS && r.y <= top && top > bestY) {
        best = item;
        bestY = top;
      }
    }
  }
  return best ? { surface: best, y: bestY } : null;
}

/**
 * Whether anything is under the feet of a grounded runner.
 * @param {RunState} state
 */
function hasSupport(state) {
  const r = state.runner;
  const left = r.x - HALF_W;
  const right = r.x + HALF_W;
  for (const chunk of state.chunks) {
    if (chunk.x1 < left - 1 || chunk.x0 > right + 1) continue;
    for (const roof of chunk.roofs) {
      if (right > roof.x0 && left < roof.x1 && Math.abs(roof.top - r.y) < 0.01) return true;
    }
    for (const item of chunk.items) {
      const top = surfaceTop(item);
      if (top === null || item.type === "awning") continue;
      const o = /** @type {any} */ (item);
      if (right > o.x0 && left < o.x1 && Math.abs(top - r.y) < 0.01) return true;
    }
  }
  return false;
}

/**
 * Whether standing up here would put the head into something low.
 * @param {RunState} state
 */
function lowOverhead(state) {
  const r = state.runner;
  for (const chunk of state.chunks) {
    if (chunk.x1 < r.x - 40 || chunk.x0 > r.x + 40) continue;
    for (const item of chunk.items) {
      if (!isLow(item)) continue;
      const o = /** @type {any} */ (item);
      if (o.hit || o.broken) continue;
      if (r.x + HALF_W > o.x0 && r.x - HALF_W < o.x1 && r.y + RUNNER_H > o.y0 && r.y < o.y1) return true;
    }
  }
  return false;
}

/**
 * @param {RunState} state
 * @param {number} amount
 * @param {string} cause
 * @param {RunEvent[]} events
 */
function spill(state, amount, cause, events) {
  const lost = Math.min(state.tea, amount);
  if (lost <= 0) return;
  state.tea -= lost;
  state.stats.spilled += lost;
  events.push({ type: "spill", amount: lost, cause, tea: state.tea, x: state.runner.x, y: state.runner.y });
}

/**
 * @param {RunState} state
 * @param {RunEvent[]} events
 */
function breakCombo(state, events) {
  if (state.combo.chain > 0) events.push({ type: "comboLost", chain: state.combo.chain });
  state.combo.chain = 0;
  state.combo.timer = 0;
}

/**
 * @param {RunState} state
 * @param {"fall" | "dry"} cause
 * @param {RunEvent[]} events
 */
function loseLife(state, cause, events) {
  const r = state.runner;
  state.lives -= 1;
  breakCombo(state, events);
  if (cause === "fall") {
    state.stats.falls += 1;
    events.push({ type: "fall", x: r.x, y: r.y, lives: state.lives });
    state.status = "respawning";
    state.respawnIn = RESPAWN_TIME;
    r.cable = null;
  } else {
    state.stats.dry += 1;
    events.push({ type: "dry", x: r.x, y: r.y, lives: state.lives });
    state.tea = DRY_REFILL;
    r.grace = Math.max(r.grace, GRACE_TIME);
  }
  if (state.lives <= 0) {
    state.lives = 0;
    state.status = "over";
    events.push({ type: "over", score: state.score });
  }
}

/**
 * Where a fallen runner comes back: the start of the next proper roof past
 * where it fell, never a chimney top, and never one too short to react on.
 * @param {RunState} state
 */
export function respawnPoint(state) {
  const fellAt = state.runner.x;
  for (const chunk of state.chunks) {
    for (const roof of chunk.roofs) {
      if (roof.kind === "roof" && roof.x0 > fellAt - 20 && roof.x1 - roof.x0 >= 120) {
        return { x: roof.x0 + 16, y: roof.top };
      }
    }
  }
  // The course is always generated far enough ahead that this is unreachable.
  const last = state.chunks[state.chunks.length - 1].roofs.at(-1);
  return { x: /** @type {Roof} */ (last).x0 + 16, y: /** @type {Roof} */ (last).top };
}

/**
 * @param {RunState} state
 * @param {RunEvent[]} events
 */
function respawn(state, events) {
  const r = state.runner;
  const point = respawnPoint(state);
  Object.assign(r, {
    x: point.x,
    y: point.y,
    vy: 0,
    grounded: true,
    coyote: 0,
    buffer: 0,
    jumpHold: 0,
    glideLeft: GLIDE_TIME,
    gliding: false,
    sliding: false,
    slideTime: 0,
    slamming: false,
    stumble: 0,
    grace: RESPAWN_GRACE,
    blocked: false,
    venting: false,
    cableCooldown: 0,
    cable: null,
  });
  state.tea = Math.max(state.tea, DRY_REFILL);
  state.status = "running";
  events.push({ type: "respawn", x: r.x, y: r.y });
  extendCourse(state);
}

/**
 * Feet meet a surface: settle, spill for the impact, or bounce off an awning.
 * @param {RunState} state
 * @param {{ surface: any, y: number }} landing
 * @param {RunEvent[]} events
 * @returns {boolean} whether the runner is now standing
 */
function touchDown(state, landing, events) {
  const r = state.runner;
  const { surface, y } = landing;
  const rushing = state.rush > 0;
  if (surface.type === "crate" && r.slamming) {
    smash(state, surface, "slam", events);
    return false;
  }
  if (surface.type === "awning") {
    r.y = y;
    r.vy = BOUNCE_SPEED;
    r.jumpHold = 0;
    r.slamming = false;
    r.sliding = false;
    r.glideLeft = GLIDE_TIME;
    events.push({ type: "bounce", x: r.x, y });
    return false;
  }
  const impact = -r.vy;
  const amount = landingSpill(impact, { gliding: r.gliding, slamming: r.slamming, rushing });
  const cause = r.slamming ? "slam" : "landing";
  events.push({ type: "land", x: r.x, y, impact, spill: amount, slam: r.slamming, glide: r.gliding });
  if (r.gliding) events.push({ type: "glideEnd" });
  r.y = y;
  r.vy = 0;
  r.grounded = true;
  r.coyote = 0;
  r.jumpHold = 0;
  r.glideLeft = GLIDE_TIME;
  r.gliding = false;
  r.slamming = false;
  r.blocked = false;
  if (amount > 0) spill(state, amount, cause, events);
  return true;
}

/**
 * @param {RunState} state
 * @param {any} o
 * @param {"slam" | "rush"} cause
 * @param {RunEvent[]} events
 */
function smash(state, o, cause, events) {
  o.broken = true;
  const points = o.type === "crate" ? CRATE_POINTS * o.count : SMASH_POINTS;
  state.points.smashes += points;
  state.stats.smashes += 1;
  events.push({ type: "smash", what: o.type, cause, points, x: (o.x0 + o.x1) / 2, y: o.y1 });
  if (o.type === "crate") {
    // The pearls packed inside spill out where the stack stood.
    const chunk = state.chunks.find((c) => c.items.includes(o));
    for (let i = 0; i < o.count * PEARLS_PER_CRATE; i++) {
      chunk?.items.push({ type: "pearl", x: o.x0 + 4 + i * 12, y: o.y0 + RUNNER_H / 2, taken: false });
    }
  }
}

/**
 * The runner meets the side of an obstacle.
 * @param {RunState} state
 * @param {any} o
 * @param {RunEvent[]} events
 */
function contact(state, o, events) {
  const r = state.runner;
  if (state.rush > 0) {
    smash(state, o, "rush", events);
    return;
  }
  o.hit = true;
  if (r.grace > 0) return;
  state.stats.bumps += 1;
  events.push({ type: "bump", what: o.type, x: r.x, y: r.y });
  spill(state, BUMP_SPILL, "bump", events);
  breakCombo(state, events);
  r.stumble = STUMBLE_TIME;
  r.grace = GRACE_TIME;
}

/**
 * @param {RunState} state
 * @param {any} pearl
 * @param {boolean} magnet
 * @param {RunEvent[]} events
 */
function takePearl(state, pearl, magnet, events) {
  pearl.taken = true;
  state.combo.chain += 1;
  state.combo.timer = COMBO_WINDOW;
  const combo = comboMultiplier(state.combo.chain);
  const points = PEARL_POINTS * combo;
  state.points.pearls += points;
  state.stats.pearls += 1;
  state.stats.bestCombo = Math.max(state.stats.bestCombo, combo);
  const wasFull = state.sugar >= SUGAR_FULL;
  state.sugar = Math.min(SUGAR_FULL, state.sugar + 1);
  events.push({ type: "pearl", x: pearl.x, y: pearl.y, points, combo, chain: state.combo.chain, magnet });
  if (!wasFull && state.sugar >= SUGAR_FULL && state.rush === 0) events.push({ type: "rushReady" });
}

/**
 * @param {RunState} state
 * @param {any} coaster
 * @param {RunEvent[]} events
 */
function deliver(state, coaster, events) {
  const tea = state.tea;
  const full = tea >= FULL_CUP;
  const points = deliveryPoints(tea, state.streak);
  coaster.done = "delivered";
  state.streak += 1;
  state.points.deliveries += points;
  state.stats.deliveries += 1;
  if (full) state.stats.fullCups += 1;
  state.stats.bestStreak = Math.max(state.stats.bestStreak, state.streak);
  state.tea = 1;
  if (full) {
    const wasFull = state.sugar >= SUGAR_FULL;
    state.sugar = Math.min(SUGAR_FULL, state.sugar + FULL_CUP_SUGAR);
    if (!wasFull && state.sugar >= SUGAR_FULL && state.rush === 0) events.push({ type: "rushReady" });
  }
  events.push({ type: "delivery", x: (coaster.x0 + coaster.x1) / 2, y: coaster.y, points, tea, full, streak: state.streak, hard: coaster.hard });
}

/**
 * Advances the run by one fixed step. Mutates the state.
 *
 * Events, in the order they happen: jump {coyote, buffered}, slide, slideEnd,
 * glide, glideEnd, slam, land {impact, spill, slam, glide}, bounce, wall,
 * spill {amount, cause: landing | slam | bump | pigeon}, bump {what},
 * smash {what, cause: slam | rush, points}, strike, pigeonsUp {count},
 * pearl {points, combo, chain, magnet}, comboLost, rushReady, rushStart,
 * rushEnd, delivery {points, tea, full, streak, hard}, miss, cableOn,
 * cableOff {jump}, vent, fall, dry, respawn, over, phase {phase}.
 *
 * @param {RunState} state
 * @param {Input} input keys held this step
 * @param {number} [dt]
 * @returns {RunEvent[]}
 */
export function step(state, input, dt = STEP) {
  /** @type {RunEvent[]} */
  const events = [];
  if (state.status === "over") return events;
  // Big steps would tunnel through thin things; the screen calls at STEP.
  dt = Math.min(dt, 1 / 30);
  const held = { jump: !!input.jump, down: !!input.down, rush: !!input.rush };
  const pressed = {
    jump: held.jump && !state.held.jump,
    down: held.down && !state.held.down,
    rush: held.rush && !state.held.rush,
  };
  state.held = held;
  state.time += dt;

  if (state.status === "respawning") {
    state.respawnIn -= dt;
    if (state.respawnIn <= 0) respawn(state, events);
    return events;
  }

  const r = state.runner;
  r.grace = Math.max(0, r.grace - dt);
  r.stumble = Math.max(0, r.stumble - dt);
  r.buffer = Math.max(0, r.buffer - dt);
  r.coyote = Math.max(0, r.coyote - dt);
  r.cableCooldown = Math.max(0, r.cableCooldown - dt);
  if (state.combo.chain > 0) {
    state.combo.timer -= dt;
    if (state.combo.timer <= 0) breakCombo(state, events);
  }
  if (state.rush > 0) {
    state.rush = Math.max(0, state.rush - dt);
    if (state.rush === 0) events.push({ type: "rushEnd" });
  }
  if (pressed.rush && state.sugar >= SUGAR_FULL && state.rush === 0) {
    state.rush = RUSH_TIME;
    state.sugar = 0;
    state.stats.rushes += 1;
    events.push({ type: "rushStart", x: r.x, y: r.y });
  }

  r.vx = speedAt(r.x) * (state.rush > 0 ? RUSH_SPEED : 1) * (1 - (STUMBLE_SLOW * r.stumble) / STUMBLE_TIME);
  if (pressed.jump) r.buffer = BUFFER_TIME;
  const prevX = r.x;
  const prevY = r.y;

  if (r.cable) {
    rideCable(state, pressed.jump, dt, events);
  } else {
    // Ground actions first: a jump (buffered, or just after an edge), a slide.
    if (r.buffer > 0 && (r.grounded || r.coyote > 0)) {
      events.push({ type: "jump", x: r.x, y: r.y, coyote: !r.grounded, buffered: !pressed.jump });
      state.stats.jumps += 1;
      if (r.sliding) events.push({ type: "slideEnd" });
      r.grounded = false;
      r.coyote = 0;
      r.buffer = 0;
      r.vy = JUMP_SPEED;
      r.jumpHold = HOLD_TIME;
      r.sliding = false;
    }
    if (pressed.down) {
      if (r.grounded) {
        if (!r.sliding) events.push({ type: "slide", x: r.x, y: r.y });
        r.sliding = true;
        r.slideTime = 0;
      } else if (!r.slamming) {
        r.slamming = true;
        r.jumpHold = 0;
        if (r.gliding) events.push({ type: "glideEnd" });
        r.gliding = false;
        events.push({ type: "slam", x: r.x, y: r.y });
      }
    }
    if (r.sliding) {
      r.slideTime += dt;
      const limit = held.down ? SLIDE_MAX : SLIDE_TIME;
      // A slide never ends with something overhead to stand up into.
      if (r.slideTime >= limit && !lowOverhead(state)) {
        r.sliding = false;
        events.push({ type: "slideEnd" });
      }
    }

    if (!r.grounded) {
      const wasGliding = r.gliding;
      if (r.slamming) r.vy = -SLAM_SPEED;
      else fly(r, held.jump, dt);
      if (r.gliding && !wasGliding) events.push({ type: "glide", x: r.x, y: r.y });
      if (!r.gliding && wasGliding && !r.slamming) events.push({ type: "glideEnd" });
      updraft(state, dt, events);
    }

    const vx = r.slamming ? r.vx * SLAM_DRIFT : r.vx;
    r.x += vx * dt;
    r.y += r.vy * dt;
    walls(state, prevX, prevY, events);

    if (!r.grounded && r.vy <= 0) {
      // Several surfaces can be crossed in one step only when a slam breaks a
      // crate on the way down to the roof under it.
      for (let i = 0; i < 3 && !r.grounded; i++) {
        const landing = findLanding(state, prevY);
        if (!landing) break;
        if (touchDown(state, landing, events)) break;
        if (r.vy > 0) break;
      }
    } else if (r.grounded && !hasSupport(state)) {
      r.grounded = false;
      r.coyote = COYOTE_TIME;
      r.vy = 0;
    }
    if (!r.grounded && !r.cable) catchCable(state, prevX, prevY, events);
  }

  touchItems(state, dt, events);

  if (r.y < FALL_Y && state.status === "running") loseLife(state, "fall", events);
  if (state.status === "running" && state.tea <= 1e-9) loseLife(state, "dry", events);

  state.distance = Math.max(state.distance, r.x - state.startX);
  state.points.distance = Math.floor(state.distance / METRE);
  state.score = state.points.distance + state.points.pearls + state.points.deliveries + state.points.smashes;
  const phase = phaseAt(state.distance);
  if (phase !== state.phase) {
    state.phase = phase;
    events.push({ type: "phase", phase });
  }
  extendCourse(state);
  return events;
}

/**
 * The fronts of buildings: a low step is climbed, a high one stops the runner
 * dead, to slide down into the alley.
 * @param {RunState} state
 * @param {number} prevX
 * @param {number} prevY
 * @param {RunEvent[]} events
 */
function walls(state, prevX, prevY, events) {
  const r = state.runner;
  for (const chunk of state.chunks) {
    if (chunk.x1 < prevX - 20 || chunk.x0 > r.x + 20) continue;
    for (const roof of chunk.roofs) {
      if (prevX + HALF_W > roof.x0 + EPS || r.x + HALF_W <= roof.x0 || r.y >= roof.top) continue;
      // Came over the top this step: that is a landing, not a wall.
      if (prevY >= roof.top - EPS && !r.grounded) continue;
      if (roof.top - r.y <= MANTLE) {
        r.y = roof.top;
        if (!r.grounded) {
          touchDown(state, { surface: roof, y: roof.top }, events);
        }
      } else {
        r.x = roof.x0 - HALF_W - EPS;
        if (!r.blocked) events.push({ type: "wall", x: r.x, y: r.y });
        r.blocked = true;
        if (r.grounded) {
          r.grounded = false;
          r.vy = 0;
        }
      }
    }
  }
}

/**
 * Vents lift anything over them up to their ceiling; a glide rides higher.
 * @param {RunState} state
 * @param {number} dt
 * @param {RunEvent[]} events
 */
function updraft(state, dt, events) {
  const r = state.runner;
  let inside = false;
  if (!r.slamming) {
    for (const chunk of state.chunks) {
      if (chunk.x1 < r.x || chunk.x0 > r.x) continue;
      for (const item of chunk.items) {
        if (item.type !== "vent" || r.x < item.x0 || r.x > item.x1 || r.y < FALL_Y) continue;
        const ceiling = item.ceiling + (r.gliding ? GLIDE_LIFT_BONUS : 0);
        if (r.y < ceiling) {
          r.vy = Math.min(LIFT_MAX, r.vy + LIFT * dt);
          r.jumpHold = 0;
        }
        inside = true;
      }
    }
  }
  if (inside && !r.venting) events.push({ type: "vent", x: r.x, y: r.y });
  r.venting = inside;
}

/**
 * A runner in the air whose hands cross a cable grabs it.
 * @param {RunState} state
 * @param {number} prevX
 * @param {number} prevY
 * @param {RunEvent[]} events
 */
function catchCable(state, prevX, prevY, events) {
  const r = state.runner;
  if (r.slamming || r.cableCooldown > 0) return;
  for (const chunk of state.chunks) {
    if (chunk.x1 < r.x - 400 || chunk.x0 > r.x + 400) continue;
    for (const item of chunk.items) {
      if (item.type !== "cable" || r.x < item.x0 || r.x > item.x1 - 30) continue;
      const before = prevY + RUNNER_H - cableY(item, Math.max(item.x0, prevX));
      const now = r.y + RUNNER_H - cableY(item, r.x);
      if (before * now <= 0 || Math.abs(now) < 3) {
        r.cable = item;
        r.y = cableY(item, r.x) - RUNNER_H;
        r.vy = 0;
        r.jumpHold = 0;
        r.slamming = false;
        r.sliding = false;
        if (r.gliding) events.push({ type: "glideEnd" });
        r.gliding = false;
        r.glideLeft = GLIDE_TIME;
        events.push({ type: "cableOn", x: r.x, y: r.y });
        return;
      }
    }
  }
}

/**
 * Hanging from a cable: carried down it at running speed until the end or a jump.
 * @param {RunState} state
 * @param {boolean} jump
 * @param {number} dt
 * @param {RunEvent[]} events
 */
function rideCable(state, jump, dt, events) {
  const r = state.runner;
  const cable = /** @type {NonNullable<typeof r.cable>} */ (r.cable);
  r.x = Math.min(cable.x1, r.x + r.vx * dt);
  r.y = cableY(cable, r.x) - RUNNER_H;
  const slope = (cable.y1 - cable.y0) / (cable.x1 - cable.x0);
  if (jump || r.x >= cable.x1) {
    r.cable = null;
    r.cableCooldown = 0.3;
    r.buffer = 0;
    r.vy = jump ? CABLE_JUMP : slope * r.vx;
    r.jumpHold = jump ? HOLD_TIME : 0;
    events.push({ type: "cableOff", x: r.x, y: r.y, jump });
  }
}

/**
 * Obstacles, pigeons, pearls and coasters near the runner.
 * @param {RunState} state
 * @param {number} dt
 * @param {RunEvent[]} events
 */
function touchItems(state, dt, events) {
  const r = state.runner;
  const box = runnerBox(r);
  const rushing = state.rush > 0;
  const airborne = !r.grounded;
  let flushed = 0;
  for (const chunk of state.chunks) {
    if (chunk.x1 < r.x - 200 || chunk.x0 > r.x + r.vx * PIGEON_WARNING + 20) continue;
    for (const item of chunk.items) {
      switch (item.type) {
        case "pearl": {
          if (item.taken) break;
          const cx = (box.x0 + box.x1) / 2;
          const cy = (box.y0 + box.y1) / 2;
          if (rushing && Math.hypot(item.x - cx, item.y - cy) <= RUSH_MAGNET) {
            takePearl(state, item, true, events);
          } else if (
            item.x + PEARL_RADIUS > box.x0 && item.x - PEARL_RADIUS < box.x1 &&
            item.y + PEARL_RADIUS > box.y0 && item.y - PEARL_RADIUS < box.y1
          ) {
            takePearl(state, item, false, events);
          }
          break;
        }
        case "coaster": {
          if (item.done) break;
          if (r.grounded && Math.abs(r.y - item.y) < 0.01 && box.x1 > item.x0 && box.x0 < item.x1) {
            deliver(state, item, events);
          } else if (box.x0 > item.x1) {
            item.done = "missed";
            state.stats.missed += 1;
            if (state.streak > 0) events.push({ type: "streakLost", streak: state.streak });
            state.streak = 0;
            events.push({ type: "miss", x: (item.x0 + item.x1) / 2, y: item.y });
          }
          break;
        }
        case "pigeon": {
          if (item.state === "sit") {
            if (item.x - r.x < r.vx * PIGEON_WARNING) {
              item.state = "fly";
              flushed += 1;
            }
            break;
          }
          item.t += dt;
          if (item.state !== "fly" || !airborne || r.cable) break;
          const p = pigeonPosition(item);
          if (
            p.x + PIGEON_W / 2 > box.x0 && p.x - PIGEON_W / 2 < box.x1 &&
            p.y + PIGEON_H > box.y0 && p.y < box.y1
          ) {
            item.state = "struck";
            if (rushing || r.grace > 0) break;
            state.stats.strikes += 1;
            events.push({ type: "strike", x: p.x, y: p.y });
            spill(state, PIGEON_SPILL, "pigeon", events);
          }
          break;
        }
        default: {
          if (!isSolid(item) && !isLow(item)) break;
          const o = /** @type {any} */ (item);
          if (o.hit || o.broken || r.cable) break;
          if (box.x1 <= o.x0 || box.x0 >= o.x1 || box.y1 <= o.y0 || box.y0 >= o.y1) break;
          // Feet level with a solid top means standing on it.
          if (isSolid(o) && r.y >= o.y1 - 0.01) break;
          contact(state, o, events);
        }
      }
    }
  }
  if (flushed) events.push({ type: "pigeonsUp", count: flushed });
}

/**
 * The run's figures for the results slip.
 * @param {RunState} state
 */
export function breakdown(state) {
  return {
    score: state.score,
    distance: Math.floor(state.distance / METRE),
    distancePoints: state.points.distance,
    pearls: state.stats.pearls,
    pearlPoints: state.points.pearls,
    deliveries: state.stats.deliveries,
    fullCups: state.stats.fullCups,
    bestStreak: state.stats.bestStreak,
    deliveryPoints: state.points.deliveries,
    smashes: state.stats.smashes,
    smashPoints: state.points.smashes,
    rushes: state.stats.rushes,
    missed: state.stats.missed,
    bumps: state.stats.bumps,
    falls: state.stats.falls,
    bestCombo: state.stats.bestCombo,
  };
}
