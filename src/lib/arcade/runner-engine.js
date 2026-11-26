// Sugar rush rules: a cup of milk tea on legs runs the rooftops at dusk,
// making deliveries. The run speeds up the whole way. Spare cups are the
// lives: anything run into, a fall into the alley, or a cup run dry costs
// one, and with none left the run ends. A few things (anything striped in
// hazard yellow, and the railway) end it outright. The tea is the pay: a
// fuller cup pays more at each drop-off. Kept free of the DOM, of
// Math.random and of the clock, so a seed and a list of inputs always replay
// the same run under node.
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

// --- Speed and difficulty, by mode ---------------------------------------------
//
// Speed climbs in a straight line with distance, so in time it keeps
// gathering pace until the cap: about 15% faster after the first half
// minute, a third faster after a minute, and nearly double by two and a half.
//
// The run climbs twice. Difficulty unlocks and remixes the set pieces and
// reaches 1 about a minute and a half in. Then intensity takes over and
// climbs to 1 by about five minutes: pieces chain, carry more, rest less,
// and kill more often, while the top speed creeps a little higher.

/**
 * @typedef {{
 *   startSpeed: number, topSpeed: number, speedRamp: number, difficultyRamp: number,
 *   intensityRamp: number, speedCreep: number, chainMost: number, breatherAfter: number,
 *   startSpares: number, spareFirst: number, spareGap: readonly number[],
 *   lethalMin: number, lethalWeight: number
 * }} Mode
 */
/** @type {Readonly<Mode>} */
export const NORMAL = Object.freeze({
  startSpeed: 180,
  topSpeed: 390,
  /** World x at which the run reaches topSpeed, about two and a half minutes in. */
  speedRamp: 42000,
  /** World x at which difficulty reaches 1, about a minute and a half in. */
  difficultyRamp: 20000,
  /** World x at which intensity, the second climb, reaches 1: about five minutes in. */
  intensityRamp: 96000,
  /** How much faster than topSpeed the run creeps, from speedRamp to intensityRamp. */
  speedCreep: 25,
  /** At full intensity, the chance that a set piece starts a chain. */
  chainMost: 0.9,
  /** Pieces laid in chains before a breather at full intensity (twice as many as the climb starts). */
  breatherAfter: 8,
  startSpares: 1,
  /** No spare is placed before this far along, then one every spareGap. */
  spareFirst: 9000,
  spareGap: Object.freeze([14000, 20000]),
  /** Lethal set pieces unlock at this share of their minimum, and come up this much more. */
  lethalMin: 1,
  lethalWeight: 1,
});
/**
 * Expert: faster from the off, a steeper climb, the second climb in half the
 * time with more of it chained, no spare to start, almost none to find, and
 * lethal pieces early.
 */
/** @type {Readonly<Mode>} */
export const EXPERT = Object.freeze({
  startSpeed: 215,
  topSpeed: 430,
  speedRamp: 30000,
  difficultyRamp: 11000,
  intensityRamp: 52000,
  speedCreep: 30,
  chainMost: 1,
  breatherAfter: 10,
  startSpares: 0,
  spareFirst: 40000,
  spareGap: Object.freeze([50000, 65000]),
  lethalMin: 0.5,
  lethalWeight: 1.6,
});

/** @param {boolean} [expert] */
export const modeOf = (expert = false) => (expert ? EXPERT : NORMAL);

export const START_SPEED = NORMAL.startSpeed;
export const TOP_SPEED = NORMAL.topSpeed;
export const SPEED_RAMP = NORMAL.speedRamp;
export const DIFFICULTY_RAMP = NORMAL.difficultyRamp;
export const INTENSITY_RAMP = NORMAL.intensityRamp;

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
/** A tapped slide lasts this long; a held one lasts as long as down is held. */
export const SLIDE_TIME = 0.5;
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
/** A hit slows the runner by up to STUMBLE_SLOW, easing off over STUMBLE_TIME. */
export const STUMBLE_TIME = 0.5;
export const STUMBLE_SLOW = 0.35;
/** After a hit costs a cup, nothing else can for this long (nothing lethal is held off). */
export const HIT_GRACE = 1.2;
export const RESPAWN_GRACE = 1.5;
/** Seconds between a spare cup saving a fall and the runner reappearing. */
export const RESPAWN_TIME = 1;
/** A cup saved from running dry comes back at least this full. */
export const DRY_REFILL = 0.6;
/**
 * Seconds of running at full speed that a stumble eats, slowing by
 * STUMBLE_SLOW and easing off over STUMBLE_TIME. Past anything that can be
 * run into, the course leaves at least this much plain roof before a gap or
 * anything lethal, so a hit is never followed by a fall or the end.
 */
export const STUMBLE_RUN = STUMBLE_TIME * (1 - STUMBLE_SLOW / 2);
/** A runner put back after a fall has at least this many seconds of roof before anything lethal or a railway edge. */
export const RESPAWN_CLEAR = 0.5;

// --- Spare cups -------------------------------------------------------------------------
//
// The spare cups are the lives. A run starts with the mode's startSpares and
// can hold MAX_SPARES; more are rare, and sit only low over something lethal,
// on a line that lands a moment from the end of the run.

export const MAX_SPARES = 2;
/** Points for a spare picked up with every slot already full. */
export const SPARE_BONUS = 200;
/** Half the side of a spare's pickup box (the cup is drawn 14 by 16). */
export const SPARE_RADIUS = 8;
/**
 * The line that takes a spare lands this many seconds of running past the
 * last of what it flies over. A take-off any earlier than that and a little
 * more is the end of the run.
 */
export const SPARE_MARGIN = 0.07;

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
/**
 * Half the side of a pearl's pickup box. The pearl is drawn 8 across and bobs
 * a unit either way, so anything that touches the drawn pearl takes it.
 */
export const PEARL_RADIUS = 6;

// --- The course ---------------------------------------------------------------------

export const MIN_TOP = 40;
export const MAX_TOP = 280;
export const BUILDING_STYLES = 8;
export const COASTER_W = 24;
/** Pigeons take off when the runner is this many seconds away, so they rise into the jump line at any speed. */
export const PIGEON_WARNING = 0.75;
export const PIGEON_W = 10;
export const PIGEON_H = 8;

// Lethal things lie flat on the roof (hop them) or hang low (slide under).
/** A live wire down on the roof, sparking. */
export const WIRE_H = 6;
/** A skylight's raised glass, which nothing can stand on. */
export const SKYLIGHT_H = 4;

// Things that move or keep time. None is lethal; each costs a cup if hit.
/** A barrel starts rolling at the runner when it is this many seconds away. */
export const BARREL_WARNING = 1;
export const BARREL_SPEED = 70;
export const BARREL_W = 16;
export const BARREL_H = 14;
/** A delivery drone flies in at slide height when the runner is this many seconds away. */
export const DRONE_WARNING = 1.2;
export const DRONE_SPEED = 100;
export const DRONE_W = 18;
export const DRONE_H = 10;
/** The drone's underside above the roof: over a slide, into a standing runner. */
export const DRONE_LOW = 12;
/** A sign hung on two arms from a gantry swings along the run; at its lowest it is this far over the roof. */
export const SWING_LOW = 12;
export const SWING_LEN = 44;
export const SWING_W = 26;
export const SWING_H = 14;
/** A steam pipe on the roof, and the plume it blows on a timer. */
export const STEAM_W = 12;
export const STEAM_PIPE = 8;
export const STEAM_PLUME = 60;
/** Of each period the plume blows this long, and hisses for STEAM_HISS before. */
export const STEAM_ON = 0.5;
export const STEAM_HISS = 0.3;
/** Rotten boards over a gap give way this long after they are first stood on. */
export const CRUMBLE_TIME = 0.45;

/** A row of steam pipes keeps one timer, each pipe this share of a period behind the last, so the plumes roll along it. */
export const STEAM_STAGGER = 0.3;
/**
 * In a row of steam pipes, the least seconds of running from one pipe to the
 * next: a full jump over one plume from anywhere it clears still comes down
 * in time to take off for the next.
 */
const STEAMWORKS_SPACE = 0.85;

// --- The second climb ---------------------------------------------------------------
//
// Once difficulty reaches 1 and every set piece is out, intensity climbs.
// Set pieces start to chain: two, later three, laid back to back with only a
// short run-in between instead of a plain roof, picked so the player has to
// switch moves, and never in a pairing CHAIN_RULES forbids. Pieces carry more
// obstacles, the plain roof between them shrinks, lethal pieces come up more
// often, and a breather comes after every few chained pieces, so the climb
// reads as waves rather than a wall. None of it reaches back into the first
// climb, where the game teaches its moves.

/** The chance a set piece starts a chain once difficulty reaches 1; it climbs to the mode's chainMost. */
const CHAIN_FIRST = 0.3;
/** Chains run to three pieces from this intensity, seven in ten of them by the end. */
const CHAIN_THREE_FROM = 0.35;
const CHAIN_THREE = 0.7;
/** A piece that makes the player switch moves from the last one comes up this much more in a chain. */
const CHAIN_SWITCH = 2.5;
/** In a chain, a piece's run-in before its first thing, in seconds of running. Lethal pieces keep a full runway. */
const LINK_RUNWAY = 0.3;
/** How much of the plain roof's spare length intensity takes away by the end. */
const REST_SHRINK = 0.8;
/** How much intensity tightens the widest spacing in a run of obstacles (and the closest by a quarter as much), in seconds of running. */
const SPACE_SHRINK = 0.2;
/** Lethal pieces come up this much more again by full intensity. */
const LETHAL_CLIMB = 1;
/** Light pieces, which ask for one thing, come up this much less by full intensity. */
const LIGHT_FADE = 0.5;

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
/** @typedef {null | "drop" | "awning" | "vent" | "cable" | "rail" | "boards"} Assist */
/** @typedef {{ x0: number, x1: number, dy: number, speed: number, assist: Assist }} Gap */
/** @typedef {"ac" | "tank" | "crate" | "clothesline" | "billboard" | "wire" | "skylight" | "neon" | "steam"} BoxType */
/**
 * Everything on the course the screen draws. Solid obstacles (ac, tank, crate)
 * stand on a roof from y0 to y1 and can be stood on; low ones (clothesline,
 * billboard, neon) hang from y0 to y1 and are slid under. Wires and
 * skylights lie on the roof and are hopped. Neon, wires and skylights are
 * lethal. `hit` marks one run through, `broken` one smashed. A pearl's
 * `group` names the arc or line it was placed with (0 for pearls freed from
 * a crate). Barrels, drones, swinging signs and steam pipes move or keep
 * time; boards give way.
 * @typedef {(
 *   { type: "pearl", x: number, y: number, taken: boolean, group: number }
 *   | { type: "spare", x: number, y: number, taken: boolean }
 *   | { type: "coaster", x0: number, x1: number, y: number, customer: boolean, hard: boolean, done: null | "delivered" | "missed" }
 *   | { type: BoxType, x0: number, x1: number, y0: number, y1: number, count: number, hit: boolean, broken: boolean, period: number, phase: number }
 *   | { type: "awning" | "ledge", x0: number, x1: number, y: number }
 *   | { type: "vent", x0: number, x1: number, y0: number, ceiling: number }
 *   | { type: "cable", x0: number, y0: number, x1: number, y1: number }
 *   | { type: "pigeon", x: number, y: number, vx: number, vy: number, delay: number, state: "sit" | "fly" | "struck", t: number }
 *   | { type: "barrel", x: number, y: number, minX: number, state: "wait" | "roll" | "hit" | "broken" | "fell", t: number }
 *   | { type: "drone", x: number, y: number, state: "wait" | "fly" | "hit" | "broken", t: number }
 *   | { type: "swing", x: number, y: number, len: number, amp: number, period: number, phase: number, hit: boolean, broken: boolean }
 *   | { type: "boards", x0: number, x1: number, y: number, at: number, gone: boolean }
 * )} Item
 */
/**
 * One set piece as laid. `link` is its place in a chain: 0 standing alone or
 * leading one, 1 or 2 following on from the piece before with only a run-in
 * between.
 * @typedef {{
 *   id: number, pattern: string, x0: number, x1: number, difficulty: number, intensity: number,
 *   link: number, speed: number, roofs: Roof[], items: Item[], gaps: Gap[]
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
 * Running speed at world x: climbs in a straight line from the mode's start
 * speed to its top speed, then creeps a little higher by the end of the
 * second climb, and holds.
 * @param {number} x
 * @param {boolean} [expert]
 */
export function speedAt(x, expert = false) {
  const mode = modeOf(expert);
  const u = clamp(x / mode.speedRamp, 0, 1);
  const creep = clamp((x - mode.speedRamp) / (mode.intensityRamp - mode.speedRamp), 0, 1);
  return mode.startSpeed + (mode.topSpeed - mode.startSpeed) * u + mode.speedCreep * creep;
}

/**
 * Difficulty, 0 to 1, at world x. Patterns unlock by it and stretch with it.
 * @param {number} x
 * @param {boolean} [expert]
 */
export function difficultyAt(x, expert = false) {
  return clamp(x / modeOf(expert).difficultyRamp, 0, 1);
}

/**
 * Intensity, 0 to 1, at world x: the second climb. It is 0 until difficulty
 * reaches 1, then rises in a straight line to the mode's intensityRamp. Set
 * pieces chain and crowd by it, and the last few unlock by it.
 * @param {number} x
 * @param {boolean} [expert]
 */
export function intensityAt(x, expert = false) {
  const mode = modeOf(expert);
  return clamp((x - mode.difficultyRamp) / (mode.intensityRamp - mode.difficultyRamp), 0, 1);
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
 * The take-offs from which a jump clears a box `width` long and `height`
 * high standing on the take-off's roof, with `margin` units to spare at each
 * end: as distances from the take-off to the box's near edge, `near` the
 * latest and `far` the earliest. Null when there are none.
 * @param {number} speed
 * @param {number} width
 * @param {number} height
 * @param {number} [hold]
 * @param {number} [margin]
 */
export function clearRange(speed, width, height, hold = HOLD_TIME, margin = 4) {
  const path = jumpPath(speed, { hold, until: Math.min(0, height) - 1 });
  let first = -1;
  let last = -1;
  for (let i = 0; i < path.length; i++) {
    if (path[i].y >= height) {
      if (first < 0) first = i;
      last = i;
    } else if (first >= 0) break;
  }
  if (first < 0 || last + 1 >= path.length) return null;
  const near = (first > 0 ? path[first - 1].x : 0) + HALF_W + margin;
  const far = path[last + 1].x - HALF_W - width - margin;
  return far > near ? { near, far } : null;
}

/**
 * The widest box of `height` a full jump clears with `slack` seconds of
 * take-off to choose from.
 * @param {number} speed
 * @param {number} height
 * @param {number} slack
 */
export function clearWidth(speed, height, slack) {
  const range = clearRange(speed, 0, height);
  return range ? Math.max(0, range.far - range.near - slack * speed) : 0;
}

/**
 * Where the runner that runs off a roof's edge starts to fall: once its back
 * foot is past the edge, half a step on (the step lands anywhere in one).
 * @param {number} edge
 * @param {boolean} [expert]
 */
export function leaveAt(edge, expert = false) {
  return edge + HALF_W + (speedAt(edge, expert) * STEP) / 2;
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

/**
 * A swinging sign's box at a moment of the run. It hangs on two parallel
 * arms, so it stays upright as it swings, lowest in the middle.
 * @param {Extract<Item, { type: "swing" }>} sign
 * @param {number} time
 */
export function swingBox(sign, time) {
  const angle = sign.amp * Math.sin(2 * Math.PI * (time / sign.period + sign.phase));
  const cx = sign.x + sign.len * Math.sin(angle);
  const y0 = sign.y + SWING_LOW + sign.len * (1 - Math.cos(angle));
  return { x0: cx - SWING_W / 2, x1: cx + SWING_W / 2, y0, y1: y0 + SWING_H, angle };
}

/**
 * The stretch of roof a swinging sign sweeps over, at slide height.
 * @param {Extract<Item, { type: "swing" }>} sign
 */
export function swingReach(sign) {
  const reach = sign.len * Math.sin(sign.amp) + SWING_W / 2;
  return { x0: sign.x - reach, x1: sign.x + reach };
}

/**
 * Where a steam pipe is in its cycle: off, hissing (about to blow), or on,
 * with how far into that part it is (0 to 1).
 * @param {{ period: number, phase: number }} pipe
 * @param {number} time
 */
export function steamPhase(pipe, time) {
  const t = ((time / pipe.period + pipe.phase) % 1 + 1) % 1 * pipe.period;
  const offFor = pipe.period - STEAM_ON - STEAM_HISS;
  if (t < offFor) return { state: /** @type {const} */ ("off"), f: t / offFor };
  if (t < offFor + STEAM_HISS) return { state: /** @type {const} */ ("hiss"), f: (t - offFor) / STEAM_HISS };
  return { state: /** @type {const} */ ("on"), f: (t - offFor - STEAM_HISS) / STEAM_ON };
}

/**
 * The plume's box while a steam pipe blows.
 * @param {{ x0: number, x1: number, y0: number }} pipe
 */
export function plumeBox(pipe) {
  return { x0: pipe.x0 - 3, x1: pipe.x1 + 3, y0: pipe.y0 + STEAM_PIPE, y1: pipe.y0 + STEAM_PIPE + STEAM_PLUME };
}

/** @param {Item} item */
export function isLethal(item) {
  return item.type === "wire" || item.type === "skylight" || item.type === "neon";
}

// --- Patterns -------------------------------------------------------------------------------

/**
 * The authored set pieces, by the difficulty that unlocks each (and, for the
 * last few, the intensity). A pattern's parameters stretch from its first,
 * teaching form toward a remix as difficulty climbs past its minimum. A
 * `hard` pattern offers a risky line where a spare cup can sit; a `lethal`
 * one can end the run outright.
 *
 * For chaining, `move` is what a piece mostly asks of the player (hop,
 * slide, slam, both, or ride the air). A `light` piece asks for one thing
 * (a gap, a step, a ride) and comes up less as intensity climbs, leaving
 * room for the busier ones. A `timed` piece keeps its own time
 * (things that come at you, swing, blow or give way); an `air` one ends
 * coming down from the air, somewhere that can't be known; one that stands
 * `alone` (a breather, a split route) is never part of a chain. A `mixed`
 * piece draws its contents from a pool that holds steam, wires and neon by
 * the time pieces chain, so a chain counts it as both timed and lethal.
 */
export const PATTERNS = Object.freeze([
  { id: "warmup", min: 0, weight: 1, late: 0.15, move: "none", alone: true, note: "a flat roof and a line of pearls" },
  { id: "gap", min: 0, weight: 1.2, light: true, move: "hop", note: "a plain gap" },
  { id: "stepDown", min: 0, weight: 1, bias: "down", light: true, move: "hop", note: "a gap down to a lower roof" },
  { id: "hops", min: 0, weight: 1.2, move: "hop", note: "ac units and, later, water tanks to hop" },
  { id: "stepUp", min: 0.05, weight: 1, bias: "up", light: true, move: "hop", note: "a gap up to a higher roof" },
  { id: "duck", min: 0.1, weight: 1, move: "slide", note: "a clothesline or billboard to slide under" },
  { id: "pigeons", min: 0.1, weight: 0.8, move: "hop", note: "a flock that takes off as you come; jumping into it scatters it" },
  { id: "longDrop", min: 0.15, weight: 1, bias: "down", light: true, move: "air", air: true, note: "a long drop: glide late to save the tea" },
  { id: "crates", min: 0.15, weight: 0.9, move: "slam", note: "crate stacks to hop, or slam open for pearls" },
  { id: "barrels", min: 0.15, weight: 0.9, move: "hop", timed: true, note: "barrels that roll at you as you come" },
  { id: "awning", min: 0.2, weight: 0.8, bias: "up", light: true, move: "air", air: true, note: "an awning that bounces you to a high roof" },
  { id: "stairs", min: 0.2, weight: 0.8, move: "hop", note: "three short steps up or down, later now and then four" },
  { id: "steam", min: 0.2, weight: 0.9, move: "hop", timed: true, note: "steam pipes that blow on a timer: hop the pipe, or jump the plume" },
  { id: "slideDrop", min: 0.25, weight: 0.8, move: "slide", air: true, note: "slide under a billboard and off the edge" },
  { id: "swing", min: 0.25, weight: 0.8, move: "slide", timed: true, note: "a sign swinging on a gantry: slide under, or time it" },
  { id: "wire", min: 0.25, weight: 0.9, move: "hop", lethal: true, note: "a live wire down on the roof" },
  { id: "hopSlide", min: 0.3, weight: 0.9, move: "both", note: "a hop straight into a slide" },
  { id: "cable", min: 0.3, weight: 0.8, bias: "down", light: true, move: "air", air: true, note: "a cable to catch and ride across a wide gap" },
  { id: "drone", min: 0.3, weight: 0.8, move: "slide", timed: true, note: "a rival's drone flying in at slide height" },
  { id: "skylight", min: 0.3, weight: 0.9, move: "hop", lethal: true, hard: true, note: "a skylight that nobody can stand on" },
  { id: "vent", min: 0.35, weight: 0.8, light: true, move: "air", air: true, note: "an updraft that carries you over a gap too wide to jump" },
  { id: "split", min: 0.35, weight: 0.7, move: "none", alone: true, note: "an upper line of pearls over a lower line with the coaster" },
  { id: "crumble", min: 0.35, weight: 0.8, light: true, move: "air", air: true, timed: true, note: "rotten boards over a wide gap that give way a moment after landing" },
  { id: "chimneys", min: 0.4, weight: 0.8, move: "hop", note: "a run of narrow chimney tops" },
  { id: "neon", min: 0.4, weight: 0.8, move: "slide", lethal: true, note: "a shorting neon sign to slide under" },
  { id: "railGap", min: 0.45, weight: 0.9, move: "hop", lethal: true, hard: true, note: "a gap over the railway, with no ledge below" },
  { id: "gauntlet", min: 0.55, weight: 0.9, move: "both", mixed: true, note: "everything at once: hops, slides and crates in a row" },
  // The second climb's own pieces, made of the same things.
  { id: "barrage", min: 1, intensity: 0.1, weight: 0.9, move: "both", timed: true, note: "barrels rolling at you with a drone flying in behind them: hop, hop, slide" },
  { id: "steamworks", min: 1, intensity: 0.25, weight: 0.8, move: "hop", timed: true, note: "a row of steam pipes that blow in turn: hop them in rhythm, or jump every plume" },
  { id: "wireWalk", min: 1, intensity: 0.4, weight: 0.8, move: "hop", lethal: true, note: "chimney tops with a live wire down the roof between them: miss one and it's the end" },
  { id: "crumbleRail", min: 1, intensity: 0.55, weight: 0.8, move: "hop", timed: true, lethal: true, note: "rotten boards over a gap, then the railway straight after" },
]);

/** @typedef {typeof PATTERNS[number]} Pattern */

/** The piece laid as a breather: a plain roof and a line of pearls. */
const BREATHER = PATTERNS[0];

/**
 * The difficulty that unlocks a pattern in a mode: lethal ones come early in expert.
 * @param {Pattern} pattern
 * @param {boolean} [expert]
 */
export function patternMin(pattern, expert = false) {
  return "lethal" in pattern && pattern.lethal ? pattern.min * modeOf(expert).lethalMin : pattern.min;
}

/**
 * The intensity that unlocks a pattern in a mode: 0 for all but the second
 * climb's own pieces, and lethal ones come early in expert.
 * @param {Pattern} pattern
 * @param {boolean} [expert]
 */
export function patternIntensity(pattern, expert = false) {
  const at = ("intensity" in pattern && pattern.intensity) || 0;
  return "lethal" in pattern && pattern.lethal ? at * modeOf(expert).lethalMin : at;
}

/** @param {Pattern} p */
const isAir = (p) => "air" in p && !!p.air;
/** @param {Pattern} p */
const isMixed = (p) => "mixed" in p && !!p.mixed;
/** Whether a piece keeps its own time, or may hold something that does. @param {Pattern} p */
const isTimed = (p) => ("timed" in p && !!p.timed) || isMixed(p);
/** Whether a piece can end the run, or may hold something that can. @param {Pattern} p */
const isDeadly = (p) => ("lethal" in p && !!p.lethal) || isMixed(p);
/** @param {Pattern} p */
const standsAlone = (p) => "alone" in p && !!p.alone;

/**
 * What a chain never lays back to back, as rules over the piece just laid
 * (`a`) and the one that would follow it on (`b`) at an intensity, each with
 * why. On top of these, a piece never follows itself, the pieces that stand
 * alone never chain, and a piece carrying a spare cup ends its chain, so the
 * risky line has its full run-out.
 * @type {ReadonlyArray<{ id: string, why: string, never: (a: Pattern, b: Pattern, intensity: number) => boolean }>}
 */
export const CHAIN_RULES = Object.freeze([
  {
    id: "afterAir",
    why: "nothing follows on from a piece that ends coming down from the air (a bounce, a float, a cable, a long drop, a slide off an edge, the boards): where it lands can't be known, so whatever came next could sit under the landing, unseen",
    never: (/** @type {Pattern} */ a) => isAir(a),
  },
  {
    id: "twoTimers",
    why: "two timed pieces never meet: barrels, drones, swings, steam and boards each keep their own time (and a gauntlet may hold steam), and back to back their windows could overlap until no line is left",
    never: (/** @type {Pattern} */ a, /** @type {Pattern} */ b) => isTimed(a) && isTimed(b),
  },
  {
    id: "twoLethal",
    why: "two pieces that can end the run (a gauntlet may hold wires and neon) meet only in the second half of the climb",
    never: (/** @type {Pattern} */ a, /** @type {Pattern} */ b, /** @type {number} */ intensity) => intensity < 0.5 && isDeadly(a) && isDeadly(b),
  },
]);

/**
 * Whether piece `b` may follow piece `a` on in a chain at this intensity.
 * @param {Pattern} a
 * @param {Pattern} b
 * @param {number} intensity
 */
export function chainAllows(a, b, intensity) {
  if (a.id === b.id || standsAlone(a) || standsAlone(b)) return false;
  return !CHAIN_RULES.some((rule) => rule.never(a, b, intensity));
}

/**
 * Whether following `a` with `b` makes the player change what they are doing.
 * @param {Pattern} a
 * @param {Pattern} b
 */
const switches = (a, b) => a.move !== b.move || a.move === "both";

/**
 * A builder lays a pattern down from the end of the course, keeping the
 * pieces and the reach tables it needs in one place.
 * @param {any} course
 * @param {number} remix 0 to 1, how far past its minimum the pattern is
 * @param {{ link?: boolean, tight?: boolean, lethal?: boolean, air?: boolean, breather?: boolean }} [chain]
 *   whether this piece follows the last one on in a chain, whether the next
 *   follows it, whether it can kill, whether it ends in the air, and whether
 *   it is a breather on the second climb
 */
function makeBuilder(course, remix, chain = {}) {
  const x0 = course.end;
  const expert = !!course.expert;
  const random = () => nextRandom(course.gen);
  const v = speedAt(x0, expert);
  const d = difficultyAt(x0, expert);
  const i = intensityAt(x0, expert);
  const link = !!chain.link;
  const tight = !!chain.tight;
  const runway = 0.6 * v;
  /** The least plain roof left past anything that can be run into: a stumble's worth. */
  const restFloor = STUMBLE_RUN * v;
  // A piece that ends coming down from the air keeps its whole landing roof,
  // since where it comes down can't be known; the rest give some up to intensity.
  const shrink = chain.air ? 0 : REST_SHRINK * i;
  /**
   * A plain stretch of roof between set pieces: a little runway plus some
   * breathing room, which shrinks as difficulty climbs and again as
   * intensity does, never below a stumble's worth.
   * @param {number} low @param {number} high
   */
  const flat = (low, high) =>
    Math.max(restFloor, 0.6 * v * (1 - 0.3 * d) + (low + (high - low) * random()) * (1 - 0.45 * d) * (1 - shrink));
  /** @type {null | { x0: number, x1: number, assist: Gap["assist"], from: number }} */
  let pending = null;
  const b = {
    x: x0,
    top: course.top,
    d,
    /** Intensity, the second climb. */
    i,
    t: remix,
    v,
    expert,
    /** Clean roof before a gap, so a stumble has eased off by the edge. */
    runway,
    /** Whether this piece follows the last one on in a chain, and whether the next follows it. */
    link,
    tight,
    /**
     * Clean roof before a piece's first thing: a runway, or in a chain a
     * short run-in, though anything lethal always keeps its full runway.
     */
    start: link && !chain.lethal ? LINK_RUNWAY * v : runway,
    /**
     * Clean roof a piece leaves past its last thing for whatever comes next:
     * a runway, or none when the next follows on in a chain (it brings its
     * own run-in).
     */
    handoff: tight ? 0 : runway,
    restFloor,
    random,
    /** @type {Roof[]} */ roofs: [],
    /** @type {Item[]} */ items: [],
    /** @type {Gap[]} */ gaps: [],
    /** @type {Array<{ x: number, y: number, hard: boolean }>} */ slots: [],
    /** @type {null | { x: number, y: number }} */ forced: null,
    /** @param {number} low @param {number} high */
    range: (low, high) => low + (high - low) * random(),
    flat,
    /**
     * The plain roof that ends a piece: flat, or just a stumble's worth when
     * the next piece follows on in a chain.
     * @param {number} low @param {number} high
     */
    rest: (low, high) => (tight ? restFloor : flat(low, high)),
    /** @param {number} x */
    speedAt: (x) => speedAt(x, expert),
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
    /**
     * Half the time a small gap, otherwise straight on at the same height;
     * always straight on in a chain, and into a breather on the second
     * climb, which should open with nothing to do.
     */
    lead() {
      if (!link && !chain.breather && random() < 0.5) b.gap(Math.max(20, b.fit(0, b.range(0.25, 0.4))));
    },
    /** @template {Item} T @param {T} item @returns {T} */
    add(item) {
      b.items.push(item);
      return item;
    },
    /** Starts a new group: the pearls of one arc or line, placed together. */
    group() {
      course.groups += 1;
      return course.groups;
    },
    /** @param {number} x @param {number} y @param {number} [group] a new group of one unless given */
    pearl(x, y, group = b.group()) {
      b.add({ type: "pearl", x: Math.round(x), y: Math.round(y), taken: false, group });
    },
    /**
     * A take-off at x, moved forward onto the next roof if x is over a gap:
     * the runner can only jump from where it stands.
     * @param {number} x
     */
    standOn(x) {
      if (x < x0) return x; // every chunk ends on a long roof
      const roof = b.roofs.find((r) => r.x1 > x);
      return roof && x < roof.x0 ? roof.x0 + HALF_W : x;
    },
    /**
     * Where the body's middle is `every` seconds apart along a jump from feet
     * (x, y), starting `start` intervals in. The path is flown at the runner's
     * real speed at the take-off, not the chunk's, so the spacing matches the
     * run that meets it.
     * @param {number} x @param {number} y @param {number} hold @param {number} count
     * @param {{ every?: number, vy?: number, glide?: boolean, start?: number }} [options]
     *   vy is the launch speed: JUMP_SPEED for a jump from a roof, BOUNCE_SPEED
     *   off an awning, 0 for running off an edge.
     */
    arcPoints(x, y, hold, count, options = {}) {
      const { every = 0.08, vy = JUMP_SPEED, glide = false, start = 1 } = options;
      const from = vy === JUMP_SPEED ? b.standOn(x) : x;
      const path = jumpPath(b.speedAt(from), { hold, vy, glide, seconds: every * (start + count) + STEP });
      const points = [];
      for (let k = start; k < start + count; k++) {
        const p = path[Math.min(path.length - 1, Math.round((every * k) / STEP) - 1)];
        points.push({ x: from + p.x, y: y + p.y + RUNNER_H / 2 });
      }
      return points;
    },
    /**
     * Pearls along the path of a jump, so following the line takes every one.
     * @param {number} x @param {number} y @param {number} hold @param {number} count
     * @param {{ every?: number, vy?: number, glide?: boolean, start?: number }} [options]
     */
    arc(x, y, hold, count, options = {}) {
      const group = b.group();
      for (const p of b.arcPoints(x, y, hold, count, options)) b.pearl(p.x, p.y, group);
    },
    /**
     * A full-jump arc of pearls over a box on the roof at `top`, flown from
     * the middle of the take-offs that clear it.
     * @param {number} x0 @param {number} width @param {number} height @param {number} top
     */
    clearArc(x0, width, height, top) {
      const range = clearRange(b.speedAt(x0), width, height);
      const lead = range ? (range.near + range.far) / 2 : 0.25 * v;
      b.arc(x0 - lead, top, HOLD_TIME, 7, { every: 0.09 });
    },
    /** Whether a spare cup is due on this chunk's risky line. */
    spareDue: false,
    /** @type {Array<{ x: number, y: number }>} */ spares: [],
    /**
     * A spare cup at (x, y), its middle; pearls within reach of it are taken
     * out so the two never overlap.
     * @param {number} x @param {number} y
     */
    spare(x, y) {
      const spot = { x: Math.round(x), y: Math.round(y) };
      b.items = b.items.filter((o) => o.type !== "pearl" || Math.abs(o.x - spot.x) > SPARE_RADIUS + PEARL_RADIUS + 6 || Math.abs(o.y - spot.y) > SPARE_RADIUS + PEARL_RADIUS + 6);
      b.add({ type: "spare", x: spot.x, y: spot.y, taken: false });
      b.spares.push(spot);
    },
    /**
     * A spare low at the far end of something lethal ending at x1, on the
     * line of the earliest full jump from a roof at `top` that still clears
     * it, by SPARE_MARGIN seconds of running: just before that line touches
     * down, so only a jump that comes down that close to the edge takes it.
     * `clear` is the height the feet must keep over it (relative to `top`);
     * `front` says the runner lands once its front foot is past x1 (a gap)
     * rather than its back foot (a box on the roof).
     * @param {number} x1 @param {number} top @param {number} clear @param {boolean} front
     */
    spareOver(x1, top, clear, front) {
      const speed = b.speedAt(x1);
      const path = jumpPath(speed, { hold: HOLD_TIME, until: clear - 1 });
      const land = path.findIndex((p) => p.vy < 0 && p.y < clear);
      const foot = front ? HALF_W : -HALF_W;
      const takeoff = x1 - foot + SPARE_MARGIN * speed - path[land].x;
      let k = land - 1;
      while (k > 0 && path[k].y < clear + 10) k--;
      b.spare(takeoff + path[k].x, top + path[k].y + RUNNER_H / 2);
    },
    /** @param {number} x @param {number} y @param {number} count @param {number} spacing */
    line(x, y, count, spacing) {
      const group = b.group();
      for (let k = 0; k < count; k++) b.pearl(x + k * spacing, y, group);
    },
    /**
     * @param {BoxType} type
     * @param {number} x @param {number} top the roof under it
     */
    obstacle(type, x, top) {
      let w = 24;
      let y0 = top;
      let y1 = top + 16;
      let count = 1;
      let period = 0;
      let phase = 0;
      if (type === "ac") {
        w = Math.round(22 + random() * 6);
        y1 = top + Math.round(14 + random() * 4);
      } else if (type === "tank") {
        w = Math.round(30 + random() * 6);
        y1 = top + Math.round(30 + random() * 6);
      } else if (type === "crate") {
        count = 1 + Math.floor(random() * Math.min(3, 1 + 2 * b.t + b.d));
        w = 20;
        y1 = top + 18 * count;
      } else if (type === "clothesline") {
        w = Math.round(60 + random() * 20);
        y0 = top + 11;
        y1 = top + 13;
      } else if (type === "billboard" || type === "neon") {
        w = Math.round(70 + 50 * b.t + random() * 20);
        y0 = top + 11;
        y1 = top + 110;
      } else if (type === "wire") {
        const most = clearWidth(v, WIRE_H, 0.14);
        w = Math.round(clamp(v * b.range(0.16, 0.24 + 0.1 * b.t), 26, Math.max(26, most)));
        y1 = top + WIRE_H;
      } else if (type === "skylight") {
        const most = clearWidth(v, SKYLIGHT_H, 0.12);
        w = Math.round(clamp(v * b.range(0.26, 0.32 + 0.08 * b.t), 40, Math.max(40, most)));
        y1 = top + SKYLIGHT_H;
      } else if (type === "steam") {
        w = STEAM_W;
        y1 = top + STEAM_PIPE;
        period = Math.round(b.range(1.3, 1.7) * 100) / 100;
        phase = Math.round(random() * 100) / 100;
      }
      return b.add({ type, x0: Math.round(x), x1: Math.round(x) + w, y0, y1, count, hit: false, broken: false, period, phase });
    },
    /** @param {number} x @param {number} y @param {boolean} [hard] */
    slot(x, y, hard = false) {
      b.slots.push({ x: Math.round(x), y, hard });
    },
  };
  return b;
}

/** @typedef {ReturnType<typeof makeBuilder>} Builder */

/** @param {string} type */
const isLowType = (type) => type === "clothesline" || type === "billboard" || type === "neon";

/**
 * Lays obstacles along a fresh roof with time-based spacing, so they read the
 * same at any speed, and arcs of pearls over each. Spacing tightens as
 * difficulty climbs, and again as intensity does.
 * @param {Builder} b
 * @param {BoxType[]} types
 * @param {{ slots?: boolean }} [options]
 */
function obstacleRun(b, types, options = {}) {
  const { v } = b;
  const r = b.roof(10);
  // Lay the obstacles out first, then stretch the roof under them. A plume
  // needs a full jump from well back, so it leaves room to land first.
  let x = r.x0 + b.start + (types[0] === "steam" ? 0.25 * v : 0);
  /** @type {any[]} */
  const placed = [];
  types.forEach((type, i) => {
    const o = b.obstacle(type, x, r.top);
    placed.push(o);
    const low = isLowType(type);
    const next = types[i + 1];
    let space = v * b.range(0.85 - 0.15 * b.t - 0.1 * b.d - SPACE_SHRINK * b.i / 4, 1.05 - 0.1 * b.d - SPACE_SHRINK * b.i);
    // Off a slide straight into a hop is quick; into a second slide, quicker.
    if (low) space = v * b.range(0.5, 0.65) + 20;
    // A tank, a crate stack two high or more, a wire or a skylight needs a
    // full jump, which lands a little later; a plume needs one from well back.
    if (type === "tank" || type === "wire" || type === "skylight" || (type === "crate" && o.count > 1)) space += 0.1 * v;
    if (type === "steam") space = Math.max(space, v * 0.95) + 0.25 * v;
    if (next && isLowType(next)) space = Math.max(space, 0.55 * v + 10);
    x = o.x1 + space;
  });
  const last = placed[placed.length - 1];
  r.x1 = Math.round(last.x1 + b.rest(20, 80));
  b.x = r.x1;
  for (const o of placed) {
    if (isLowType(o.type)) {
      const n = Math.max(2, Math.floor((o.x1 - o.x0) / 24));
      b.line(o.x0, r.top + 5, n, (o.x1 - o.x0) / (n - 1));
    } else if (o.type === "wire" || o.type === "skylight") {
      b.clearArc(o.x0, o.x1 - o.x0, o.y1 - o.y0, r.top);
    } else if (o.type === "steam") {
      const plume = plumeBox(o);
      b.clearArc(plume.x0, plume.x1 - plume.x0, plume.y1 - r.top, r.top);
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
    else b.slot(r.x0 + b.start * 0.5, r.top);
  }
  return r;
}

/**
 * Things that come at the runner when it is `warning` seconds away, at
 * `speed`, meet it about this far short of where they started.
 * @param {number} v @param {number} warning @param {number} speed
 */
const meetShift = (v, warning, speed) => (speed * v * warning) / (v + speed);

/**
 * How each pattern is laid. `can` says whether it fits the roof height it
 * would start from; an `edge` pattern starts right at the edge of that roof,
 * so in a chain it is given its run-in first.
 * @type {Record<string, { can?: (top: number) => boolean, edge?: boolean, build: (b: Builder) => void }>}
 */
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
    edge: true,
    build(b) {
      const from = b.top;
      const dy = Math.round(b.range(-12, 12));
      const edge = b.x;
      // With intensity the narrow end goes: every gap wants a real jump.
      b.gap(Math.max(24, b.fit(dy, b.range(0.4 + 0.1 * b.d + 0.15 * b.i, 0.55 + 0.25 * b.t))));
      const r = b.roof(b.rest(140, 260), b.top + dy);
      b.arc(edge - 0.08 * b.v, from, HOLD_TIME, 7, { every: 0.09 });
      b.slot(r.x0 + 0.55 * (r.x1 - r.x0), r.top);
    },
  },
  stepDown: {
    edge: true,
    can: (top) => top >= MIN_TOP + 50,
    build(b) {
      const from = b.top;
      const dy = -Math.min(from - MIN_TOP, Math.round(b.range(40, 60 + 40 * b.t)));
      const edge = b.x;
      b.gap(Math.max(24, b.fit(dy, b.range(0.3 + 0.15 * b.i, 0.45 + 0.3 * b.t))));
      const r = b.roof(b.rest(140, 260), from + dy);
      b.arc(edge - 0.05 * b.v, from, STEP, 6, { every: 0.08 });
      b.slot(r.x0 + 0.5 * (r.x1 - r.x0), r.top);
    },
  },
  hops: {
    build(b) {
      b.lead();
      // Up to four, then up to six by full intensity, more of them tanks.
      const count = 1 + Math.floor(b.random() * (1 + 2 * b.t + b.d + 2 * b.i));
      const most = (b.d > 0.6 ? 4 : 3) + Math.round(2 * b.i);
      /** @type {Array<"ac" | "tank">} */
      const types = [];
      for (let i = 0; i < Math.min(most, count); i++) types.push(b.d >= 0.2 && b.random() < 0.4 + 0.2 * b.i ? "tank" : "ac");
      obstacleRun(b, types);
    },
  },
  stepUp: {
    edge: true,
    can: (top) => top <= MAX_TOP - 40,
    build(b) {
      const from = b.top;
      const dy = Math.round(b.range(26, 40 + 24 * b.t));
      const edge = b.x;
      b.gap(Math.max(20, b.fit(dy, b.range(0.3 + 0.1 * b.i, 0.45 + 0.25 * b.t))));
      const r = b.roof(b.rest(140, 240), from + dy);
      b.arc(edge - 0.1 * b.v, from, HOLD_TIME, 6, { every: 0.08 });
      b.slot(r.x0 + 0.5 * (r.x1 - r.x0), r.top);
    },
  },
  duck: {
    build(b) {
      b.lead();
      /** @type {BoxType[]} */
      const types = [b.t < 0.5 && b.random() < 0.6 ? "clothesline" : "billboard"];
      // With intensity, a second thing to stay down for, close behind.
      if (b.i > 0 && b.random() < b.i) types.push(types[0] === "billboard" ? "clothesline" : "billboard");
      obstacleRun(b, types);
    },
  },
  pigeons: {
    build(b) {
      const { v } = b;
      b.lead();
      const edgeVariant = b.t >= 0.25 && b.random() < 0.5;
      const r = b.roof(b.start + (edgeVariant ? 180 : 300) + b.range(0, 80));
      const start = edgeVariant ? r.x1 - 60 : r.x0 + b.start + 40;
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
        const next = b.roof(b.rest(120, 220));
        b.slot(next.x0 + 0.5 * (next.x1 - next.x0), next.top);
      } else {
        if (b.t >= 0.25 && b.random() < 0.5) {
          b.obstacle("ac", x + 1.1 * v, r.top);
          r.x1 = Math.round(x + 1.1 * v + 30 + Math.max(b.handoff, b.restFloor));
          b.x = r.x1;
        }
        b.slot(r.x0 + b.start * 0.5, r.top);
      }
    },
  },
  longDrop: {
    edge: true,
    can: (top) => top >= 170,
    build(b) {
      const { v } = b;
      const from = b.top;
      const drop = Math.min(from - MIN_TOP, Math.round(b.range(130, 160 + 50 * b.t)));
      const edge = b.x;
      b.gap(Math.max(30, fallReach(v, drop) * b.range(0.35, 0.6)), "drop");
      const r = b.roof(b.rest(200, 300), from - drop);
      // The line running off the edge falls along, stopping high enough over
      // the roof below that a late glide still has room to save the tea.
      const group = b.group();
      for (const p of b.arcPoints(leaveAt(edge, b.expert), from, 0, 8, { vy: 0, every: 0.07 })) {
        if (p.y - RUNNER_H / 2 > r.top + 60) b.pearl(p.x, p.y, group);
      }
      b.slot(r.x0 + 0.6 * (r.x1 - r.x0), r.top);
    },
  },
  crates: {
    build(b) {
      b.lead();
      /** @type {BoxType[]} */
      const types = b.t > 0.4 && b.random() < 0.5 ? ["crate", "crate"] : ["crate"];
      if (b.i > 0 && b.random() < b.i) types.push("crate");
      obstacleRun(b, types);
    },
  },
  barrels: {
    build(b) {
      const { v } = b;
      b.lead();
      const r = b.roof(10);
      b.line(r.x0 + 30, r.top + 6, 3, 24);
      // Up to three, then up to five by full intensity.
      const count = 1 + Math.floor(b.random() * Math.min(3 + 2 * b.i, 1 + 2 * b.t + b.d + 2 * b.i));
      const shift = meetShift(v, BARREL_WARNING, BARREL_SPEED);
      // Where each meets the runner, a hop apart; each starts further on by
      // as far as it rolls before they meet.
      let meet = r.x0 + b.start + 120;
      let last = meet;
      for (let i = 0; i < count; i++) {
        b.add({ type: "barrel", x: Math.round(meet + shift), y: r.top, minX: r.x0 + BARREL_W / 2, state: "wait", t: 0 });
        last = meet;
        meet += v * b.range(0.9, 1.15);
      }
      r.x1 = Math.round(last + shift + BARREL_W + b.handoff + 0.4 * v);
      b.x = r.x1;
      if (!b.tight) b.slot(r.x1 - b.runway * 0.6, r.top);
    },
  },
  awning: {
    can: (top) => top <= MAX_TOP - 100 && top >= MIN_TOP + 60,
    build(b) {
      const { v } = b;
      b.lead();
      const a = b.roof(b.flat(80, 200));
      const drop = Math.round(24 + 24 * b.t * b.random());
      const width = Math.round(clamp(0.3 * v, 48, 70));
      // Hung where running off the roof comes down, give or take a little in
      // the remix, so the plain line always bounces and the arc follows it.
      const leave = leaveAt(a.x1, b.expert);
      const bounceX = leave + fallReach(b.speedAt(leave), drop);
      const shift = (b.random() - 0.5) * 0.3 * width * b.t;
      const x0 = Math.round(Math.max(a.x1, bounceX - width / 2 + shift));
      const awning = b.add({ type: "awning", x0, x1: x0 + width, y: a.top - drop });
      const highX = Math.round(awning.x1 + HALF_W + 0.3 * v);
      const highTop = awning.y + Math.round(b.range(100, 118));
      b.gap(highX - a.x1, "awning");
      const high = b.roof(b.rest(220, 320), highTop);
      // The arc rides the bounce.
      b.arc(bounceX, awning.y, 0, 6, { every: 0.1, vy: BOUNCE_SPEED });
      // Then a line along the high roof, just past where the bounce lands.
      const fall = jumpPath(b.speedAt(bounceX), { hold: 0, vy: BOUNCE_SPEED, until: high.top - awning.y }).at(-1);
      const land = bounceX + (fall?.x ?? 0.8 * v);
      b.line(Math.max(high.x0 + 30, land + 30), high.top + RUNNER_H / 2, 4, 24);
      b.slot(high.x0 + 0.6 * (high.x1 - high.x0), high.top);
    },
  },
  stairs: {
    edge: true,
    build(b) {
      const up = b.top < (MIN_TOP + MAX_TOP) / 2 + (b.random() - 0.5) * 60;
      // With intensity, now and then a fourth step.
      const steps = 3 + (b.i > 0 && b.random() < 0.6 * b.i ? 1 : 0);
      for (let i = 0; i < steps; i++) {
        const from = b.top;
        const dy = Math.round((up ? 1 : -1) * b.range(22, 36));
        const edge = b.x;
        const g = up ? Math.max(18, b.fit(dy, b.range(0.25, 0.4))) : Math.max(20, b.fit(dy, b.range(0.25, 0.45)));
        b.gap(g);
        const r = b.roof(b.range(0.45 * b.v + 70, 0.55 * b.v + 110), from + dy);
        b.arc(edge - 0.1 * b.v, from, STEP, 5);
        if (i === steps - 1) b.slot(r.x0 + 0.5 * (r.x1 - r.x0), r.top);
      }
    },
  },
  steam: {
    build(b) {
      b.lead();
      const count = 1 + Math.floor(b.random() * Math.min(3 + b.i, 1 + 2 * b.t + b.d + b.i));
      obstacleRun(b, /** @type {BoxType[]} */ (Array.from({ length: count }, () => "steam")));
    },
  },
  slideDrop: {
    can: (top) => top >= MIN_TOP + 70,
    build(b) {
      const { v } = b;
      b.lead();
      const a = b.roof(b.start + b.range(160, 220));
      const board = b.obstacle("billboard", a.x1 - (0.5 * v + 30), a.top);
      board.x1 = a.x1 + 16;
      const n = Math.max(2, Math.floor((board.x1 - board.x0) / 24));
      b.line(board.x0, a.top + 5, n, (board.x1 - board.x0) / (n - 1));
      const drop = Math.round(b.range(50, 80));
      b.gap(Math.max(24, (fallReach(v, drop) + RUNNER_W) * b.range(0.45, 0.65)), "drop");
      const r = b.roof(b.rest(160, 260), a.top - drop);
      b.slot(r.x0 + 0.5 * (r.x1 - r.x0), r.top);
    },
  },
  swing: {
    build(b) {
      const { v } = b;
      b.lead();
      const r = b.roof(10);
      const count = (b.t > 0.4 && b.random() < 0.5 ? 2 : 1) + (b.i > 0 && b.random() < b.i ? 1 : 0);
      let x = r.x0 + b.start;
      for (let i = 0; i < count; i++) {
        const amp = Math.round(b.range(0.55, 0.8) * 100) / 100;
        const reach = SWING_LEN * Math.sin(amp) + SWING_W / 2;
        const sign = b.add({
          type: "swing",
          x: Math.round(x + reach),
          y: r.top,
          len: SWING_LEN,
          amp,
          period: Math.round(b.range(1.3, 1.8) * 100) / 100,
          phase: Math.round(b.random() * 100) / 100,
          hit: false,
          broken: false,
        });
        // Low under the sweep: the slide line, safe at any moment of the swing.
        const span = swingReach(sign);
        const n = Math.max(3, Math.floor((span.x1 - span.x0) / 24));
        b.line(span.x0 + 4, r.top + 5, n, (span.x1 - span.x0 - 8) / (n - 1));
        x = span.x1 + v * b.range(0.6, 0.8);
      }
      r.x1 = Math.round(x + b.handoff);
      b.x = r.x1;
      if (!b.tight) b.slot(r.x1 - b.runway * 0.7, r.top);
    },
  },
  wire: {
    build(b) {
      b.lead();
      /** @type {BoxType[]} */
      const types = b.t > 0.5 && b.random() < 0.4 ? ["wire", "wire"] : ["wire"];
      if (b.i > 0 && b.random() < 0.6 * b.i) types.push("wire");
      obstacleRun(b, types);
    },
  },
  hopSlide: {
    build(b) {
      b.lead();
      // With intensity, back up again after the slide: hop, slide, hop.
      obstacleRun(b, b.i > 0 && b.random() < b.i ? ["ac", "billboard", "crate"] : ["ac", "billboard"]);
    },
  },
  cable: {
    can: (top) => top >= MIN_TOP + 80,
    build(b) {
      const { v } = b;
      b.lead();
      const a = b.roof(b.flat(120, 220));
      const drop = Math.min(a.top - MIN_TOP, Math.round(b.range(60, 110)));
      // Wider than any jump, even with a glide, so the cable is the way across.
      const span = Math.round((glideReach(v, -drop) + RUNNER_W) * b.range(1.08, 1.18) + 10);
      b.gap(span, "cable");
      const far = b.roof(b.rest(200, 300), a.top - drop);
      const cable = b.add({ type: "cable", x0: a.x1 - 36, y0: a.top + 44, x1: far.x0 + 40, y1: far.top + 30 });
      const group = b.group();
      for (let x = cable.x0 + 40; x < cable.x1 - 20; x += 36) b.pearl(x, cableY(cable, x) - RUNNER_H / 2, group);
      b.slot(far.x0 + 0.6 * (far.x1 - far.x0), far.top);
    },
  },
  drone: {
    build(b) {
      const { v } = b;
      b.lead();
      const r = b.roof(10);
      b.line(r.x0 + 30, r.top + 6, 3, 24);
      const count = (b.t > 0.4 && b.random() < 0.5 ? 2 : 1) + (b.i > 0 && b.random() < b.i ? 1 : 0);
      const shift = meetShift(v, DRONE_WARNING, DRONE_SPEED);
      let meet = r.x0 + b.start + 140;
      let last = meet;
      for (let i = 0; i < count; i++) {
        b.add({ type: "drone", x: Math.round(meet + shift), y: r.top + DRONE_LOW, state: "wait", t: 0 });
        last = meet;
        meet += v * b.range(0.9, 1.1);
      }
      r.x1 = Math.round(last + shift + DRONE_W + b.handoff + 0.4 * v);
      b.x = r.x1;
      if (!b.tight) b.slot(r.x1 - b.runway * 0.6, r.top);
    },
  },
  skylight: {
    build(b) {
      b.lead();
      const r = b.roof(10);
      const glass = b.obstacle("skylight", r.x0 + b.start + 0.3 * b.v, r.top);
      r.x1 = Math.round(glass.x1 + 0.8 * b.v + b.handoff);
      b.x = r.x1;
      if (b.spareDue) b.spareOver(glass.x1, r.top, SKYLIGHT_H, false);
      else b.clearArc(glass.x0, glass.x1 - glass.x0, SKYLIGHT_H, r.top);
      if (!b.tight) b.slot(r.x1 - b.runway * 0.6, r.top);
    },
  },
  vent: {
    can: (top) => top <= MAX_TOP - 140,
    build(b) {
      const { v } = b;
      b.lead();
      const a = b.roof(b.flat(80, 200));
      const x0 = a.x1 + 16;
      // Wider than a jump and a glide together, so the updraft is the way across.
      const width = Math.round(glideReach(v, 30) + RUNNER_W + 30);
      const ceiling = a.top + 110;
      b.add({ type: "vent", x0, x1: x0 + width, y0: 0, ceiling });
      const farX = x0 + width + 18;
      b.gap(farX - a.x1, "vent");
      const far = b.roof(b.rest(160, 260), a.top + Math.round(b.range(-30, 30)));
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
        const group = b.group();
        for (let px = ledge.x0 + 20; px < ledge.x1 - 10; px += 34) b.pearl(px, y + RUNNER_H / 2, group);
        x += len + b.range(26, 40);
      }
    },
  },
  crumble: {
    build(b) {
      b.lead();
      const a = b.roof(b.flat(80, 160));
      // Wider than a plain jump: glide over, or step on the boards and jump
      // off them before they go.
      const width = Math.round(b.fit(0, b.range(1.05, 1.2)) + RUNNER_W);
      b.add({ type: "boards", x0: a.x1, x1: a.x1 + width, y: a.top, at: -1, gone: false });
      b.line(a.x1 + 12, a.top + RUNNER_H / 2, 3, Math.min(24, (CRUMBLE_TIME * 0.5 * b.v) / 2));
      b.gap(width, "boards");
      const far = b.roof(b.rest(160, 260), a.top);
      b.slot(far.x0 + 0.55 * (far.x1 - far.x0), far.top);
    },
  },
  chimneys: {
    can: (top) => top >= MIN_TOP + 30 && top <= MAX_TOP - 30,
    build(b) {
      const { v } = b;
      b.lead();
      b.roof(b.start + b.range(40, 120));
      // Up to five tops, then up to seven by full intensity.
      const count = 3 + Math.floor(b.random() * (1 + 2 * b.t + 2 * b.i));
      const hardAt = Math.floor(b.random() * count);
      for (let i = 0; i < Math.min(5 + Math.round(2 * b.i), count); i++) {
        const from = b.top;
        const width = Math.round(b.range(32, 44) - 10 * b.t);
        const dy = Math.round(clamp(b.range(-18, 18), MIN_TOP - from, MAX_TOP - from));
        const tap = jumpReach(v, dy, STEP);
        const g = clamp(tap - width * b.range(0.6, 1), 22, Math.max(22, b.fit(dy, 0.8)));
        const edge = b.x;
        b.gap(g);
        const c = b.roof(width, from + dy, "chimney");
        // The pearls ride a tap that comes down on the middle of the top,
        // taken no sooner than a tenth of a second before the edge.
        b.arc(Math.max(edge - 0.1 * v, (c.x0 + c.x1) / 2 - tap), from, STEP, 4, { every: 0.1 });
        if (i === hardAt && width >= COASTER_W) b.slot((c.x0 + c.x1) / 2, c.top, true);
      }
      const from = b.top;
      const dy = Math.round(b.range(-20, 10));
      b.gap(Math.max(22, b.fit(dy, 0.35)));
      const r = b.roof(b.rest(160, 240), from + dy);
      b.slot(r.x0 + 0.5 * (r.x1 - r.x0), r.top);
    },
  },
  neon: {
    build(b) {
      b.lead();
      /** @type {BoxType[]} */
      const types = b.t > 0.5 && b.random() < 0.4 ? ["ac", "neon"] : ["neon"];
      // With intensity, up out of the slide for a tank straight after.
      if (b.i > 0 && b.random() < b.i) types.push("tank");
      obstacleRun(b, types);
    },
  },
  railGap: {
    build(b) {
      const { v } = b;
      const a = b.roof(b.start + b.range(60, 140));
      const from = a.top;
      const dy = Math.round(clamp(b.range(-10, 6), MIN_TOP - from, MAX_TOP - from));
      const reach = jumpReach(v, dy);
      const width = Math.max(30, Math.round(b.fit(dy, b.range(0.35, 0.48 + 0.12 * b.t))));
      b.gap(width, "rail");
      const far = b.roof(b.rest(160, 260), from + dy);
      if (b.spareDue) {
        b.spareOver(far.x0, from, dy, true);
      } else {
        // The middle of the full jumps that make it: back foot still on the
        // roof at take-off, front foot over the far roof on landing.
        const earliest = far.x0 - HALF_W - reach;
        const latest = a.x1 + HALF_W;
        b.arc((earliest + latest) / 2, from, HOLD_TIME, 7, { every: 0.09 });
      }
      b.slot(far.x0 + 0.55 * (far.x1 - far.x0), far.top);
    },
  },
  gauntlet: {
    build(b) {
      b.lead();
      /** @type {BoxType[]} */
      const pool = ["ac", "tank", "crate", "clothesline", "billboard"];
      if (b.d >= 0.6) pool.push("steam");
      if (b.d >= 0.7) pool.push("wire", "neon");
      if (b.i >= 0.5) pool.push("skylight");
      // Three or four, then up to six by full intensity.
      const count = 3 + (b.random() < b.t ? 1 : 0) + (b.i > 0 ? Math.floor(b.random() * (1 + 2 * b.i)) : 0);
      /** @type {BoxType[]} */
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

  // The second climb's own pieces.

  barrage: {
    build(b) {
      const { v } = b;
      b.lead();
      const r = b.roof(10);
      b.line(r.x0 + 30, r.top + 6, 3, 24);
      const roll = meetShift(v, BARREL_WARNING, BARREL_SPEED);
      const fly = meetShift(v, DRONE_WARNING, DRONE_SPEED);
      // Barrels to hop, then the drone to slide under; remixed, more barrels
      // first and one more after it.
      const before = 2 + Math.floor(b.random() * (1 + b.t + b.i));
      const after = b.t > 0.5 && b.random() < 0.5 + 0.5 * b.i ? 1 : 0;
      let meet = r.x0 + b.start + 120;
      let last = meet;
      for (let k = 0; k < before + 1 + after; k++) {
        const drone = k === before;
        if (drone) b.add({ type: "drone", x: Math.round(meet + fly), y: r.top + DRONE_LOW, state: "wait", t: 0 });
        else b.add({ type: "barrel", x: Math.round(meet + roll), y: r.top, minX: r.x0 + BARREL_W / 2, state: "wait", t: 0 });
        last = meet;
        // A hop apart, as in a run of barrels; into the slide and out of it
        // takes a little longer.
        meet += v * (drone || k + 1 === before ? b.range(1.05, 1.2) : b.range(0.9, 1.1));
      }
      r.x1 = Math.round(last + Math.max(roll, fly) + DRONE_W + b.handoff + 0.4 * v);
      b.x = r.x1;
      if (!b.tight) b.slot(r.x1 - b.runway * 0.6, r.top);
    },
  },
  steamworks: {
    build(b) {
      const { v } = b;
      b.lead();
      const r = b.roof(10);
      const count = 3 + Math.floor(b.random() * (1 + b.t + b.i));
      // One timer for the row, each pipe STEAM_STAGGER of a period behind
      // the last, so the plumes roll along it.
      const period = Math.round(b.range(1.3, 1.6) * 100) / 100;
      const first = Math.round(b.random() * 100) / 100;
      // The first plume needs a full jump from well back, so there is room to land first.
      let x = r.x0 + b.start + 0.25 * v;
      /** @type {any[]} */
      const pipes = [];
      for (let k = 0; k < count; k++) {
        const pipe = b.obstacle("steam", x, r.top);
        pipe.period = period;
        pipe.phase = Math.round((((first - k * STEAM_STAGGER) % 1) + 1) % 1 * 100) / 100;
        pipes.push(pipe);
        // Closer than a run of steam pipes, but a full jump over one plume
        // still lands in time to take off for the next.
        x = pipe.x0 + v * b.range(STEAMWORKS_SPACE, STEAMWORKS_SPACE + 0.12);
      }
      const last = pipes[pipes.length - 1];
      r.x1 = Math.round(last.x1 + b.rest(40, 100));
      b.x = r.x1;
      for (const pipe of pipes) {
        const plume = plumeBox(pipe);
        b.clearArc(plume.x0, plume.x1 - plume.x0, plume.y1 - r.top, r.top);
      }
      if (!b.tight) b.slot(r.x0 + b.start * 0.5, r.top);
    },
  },
  wireWalk: {
    can: (top) => top >= MIN_TOP + 50 && top <= MAX_TOP - 20,
    build(b) {
      const { v } = b;
      b.lead();
      b.roof(b.start + b.range(40, 100));
      const tops = 2 + Math.floor(b.random() * (1 + b.t + b.i));
      for (let k = 0; k <= tops; k++) {
        const from = b.top;
        const edge = b.x;
        const speed = b.speedAt(edge);
        const last = k === tops;
        // The chimney tops are wider than a run of chimneys', since missing
        // one here is the end.
        const width = last ? 0 : Math.round(b.range(56, 72));
        const dy = Math.round(clamp(b.range(-10, 10), MIN_TOP + 50 - from, MAX_TOP - 20 - from));
        // A tap from the middle of one top comes down on the middle of the
        // next; the last hop is onto a proper roof.
        const tap = jumpReach(speed, dy, STEP);
        const most = Math.min(b.fit(dy, 0.7), clearWidth(speed, WIRE_H, 0.14));
        const across = last ? b.fit(dy, b.range(0.3, 0.45)) : tap - width * b.range(0.95, 1.1);
        const span = Math.round(clamp(across, 40, Math.max(40, most)));
        // The roof between sits well below both tops, live from wall to wall.
        const floor = b.roof(span, Math.min(from, from + dy) - Math.round(b.range(26, 40)));
        const wire = b.obstacle("wire", floor.x0, floor.top);
        wire.x1 = floor.x1;
        const onto = last ? b.roof(b.rest(160, 240), from + dy) : b.roof(width, from + dy, "chimney");
        // The pearls ride the tap that lands on the middle of what comes next.
        const land = last ? onto.x0 + 0.25 * speed : (onto.x0 + onto.x1) / 2;
        b.arc(Math.min(edge - 4, land - tap), from, STEP, 4, { every: 0.1 });
        if (last) b.slot(onto.x0 + 0.5 * (onto.x1 - onto.x0), onto.top);
      }
    },
  },
  crumbleRail: {
    build(b) {
      const { v } = b;
      b.lead();
      const a = b.roof(b.start + b.range(40, 100));
      // Boards as in a crumble: glide over, or step on and jump off them in time.
      const width = Math.round(b.fit(0, b.range(1.05, 1.15)) + RUNNER_W);
      b.add({ type: "boards", x0: a.x1, x1: a.x1 + width, y: a.top, at: -1, gone: false });
      b.line(a.x1 + 12, a.top + RUNNER_H / 2, 3, Math.min(24, (CRUMBLE_TIME * 0.5 * v) / 2));
      b.gap(width, "boards");
      // Room to come down whichever way the boards were crossed, then the tracks.
      const mid = b.roof(jumpReach(v) + b.restFloor, a.top);
      const from = mid.top;
      const dy = Math.round(clamp(b.range(-10, 6), MIN_TOP - from, MAX_TOP - from));
      const speed = b.speedAt(mid.x1);
      const reach = jumpReach(speed, dy);
      const rail = Math.max(30, Math.round(b.fit(dy, b.range(0.35, 0.45 + 0.1 * b.t))));
      b.gap(rail, "rail");
      const far = b.roof(b.rest(160, 260), from + dy);
      b.arc((far.x0 - HALF_W - reach + mid.x1 + HALF_W) / 2, from, HOLD_TIME, 7, { every: 0.09 });
      b.slot(far.x0 + 0.55 * (far.x1 - far.x0), far.top);
    },
  },
};

/**
 * Picks the next pattern: unlocked by difficulty (and by intensity, for the
 * second climb's own pieces), fitting the current roof height, never the one
 * just used. Patterns just unlocked come up more, so each is taught before
 * it is mixed in with the rest, and lethal ones come up more as intensity
 * climbs. A piece following another on in a chain must be one CHAIN_RULES
 * allow after it, and comes up more if it makes the player switch moves;
 * null when none may.
 * @param {any} course
 * @param {number} d
 * @param {number} i intensity
 * @param {Pattern | null} [after] the piece this one would follow on from in a chain
 * @returns {Pattern | null}
 */
function pickPattern(course, d, i, after = null) {
  const mode = modeOf(course.expert);
  const options = PATTERNS.filter((p) => {
    const can = BUILDERS[p.id].can;
    return (
      patternMin(p, course.expert) <= d &&
      patternIntensity(p, course.expert) <= i &&
      p.id !== course.last &&
      (!can || can(course.top)) &&
      (!after || chainAllows(after, p, i))
    );
  });
  if (!options.length) return null;
  // Roofs drift back toward the middle heights, so the patterns that need a
  // tall roof (a long drop, a cable) or headroom (an awning) keep coming up.
  const low = course.top < 100;
  const high = course.top > 190;
  // Once a spare is due, the patterns with a risky line to put it on come up more.
  const due = course.end >= course.nextSpare;
  const weights = options.map((p) => {
    const min = patternMin(p, course.expert);
    const unlock = patternIntensity(p, course.expert);
    const late = 1 + ((("late" in p && p.late) || 1) - 1) * d;
    const fresh = unlock > 0 ? (i - unlock < 0.1 ? 2 : 1) : d - min < 0.1 && min > 0 ? 2 : 1;
    const drift = (low && "bias" in p && p.bias === "up") || (high && "bias" in p && p.bias === "down") ? 1.8 : 1;
    const spare = due && "hard" in p && p.hard ? 6 : 1;
    const lethal = "lethal" in p && p.lethal ? mode.lethalWeight * (1 + LETHAL_CLIMB * i) : 1;
    const light = "light" in p && p.light ? 1 - LIGHT_FADE * i : 1;
    const change = after && switches(after, p) ? CHAIN_SWITCH : 1;
    return p.weight * late * fresh * drift * spare * lethal * light * change;
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
        // Things that come at the runner can meet it anywhere short of where they wait.
        if (item.type === "barrel" || item.type === "drone") return o.x - 1.4 * b.v < x + 20 && o.x + 40 > x - 20;
        if (item.type === "swing") {
          const span = swingReach(item);
          return span.x0 - 0.5 * b.v < x + 20 && span.x1 + 0.4 * b.v > x - 20;
        }
        if (isSolid(item) || isLow(item) || isLethal(item) || item.type === "steam") return o.x0 - 0.5 * b.v < x + 20 && o.x1 + 0.4 * b.v > x - 20;
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
 * How far a pattern is into its remix, 0 to 1: by difficulty past its
 * minimum, or for the second climb's own pieces by intensity past theirs.
 * @param {Pattern} pattern
 * @param {number} d
 * @param {number} i
 * @param {boolean} expert
 */
function remixOf(pattern, d, i, expert) {
  const unlock = patternIntensity(pattern, expert);
  return clamp(unlock > 0 ? (i - unlock) / 0.4 : (d - patternMin(pattern, expert)) / 0.4, 0, 1);
}

/**
 * The chance a set piece starts a chain at intensity i, and the chance that
 * a chain it starts runs to three pieces rather than two.
 * @param {number} i
 * @param {Mode} mode
 */
function chainOdds(i, mode) {
  return {
    start: CHAIN_FIRST + (mode.chainMost - CHAIN_FIRST) * i,
    three: CHAIN_THREE * clamp((i - CHAIN_THREE_FROM) / (1 - CHAIN_THREE_FROM), 0, 1),
  };
}

/**
 * Builds the next chunk onto the end of the course.
 * @param {any} course mutated
 * @returns {Chunk}
 */
function buildChunk(course) {
  const d = difficultyAt(course.end, course.expert);
  const i = intensityAt(course.end, course.expert);
  const mode = modeOf(course.expert);
  const first = course.count === 0;
  // Following on in a chain under way, if anything may follow the last piece.
  let link = course.link;
  const prev = PATTERNS.find((p) => p.id === course.last) ?? null;
  let pattern = first ? PATTERNS[0] : link > 0 ? pickPattern(course, d, i, prev) : null;
  if (!pattern) {
    link = 0;
    // A breather once enough pieces have come chained, so the second climb
    // comes in waves (early on, when chains are rare, it takes twice as
    // many); otherwise anything that fits.
    const breather = i > 0 && course.chained >= mode.breatherAfter * (2 - i) && course.last !== BREATHER.id;
    pattern = breather ? BREATHER : /** @type {Pattern} */ (pickPattern(course, d, i));
  }
  const spareDue = !first && "hard" in pattern && !!pattern.hard && course.end >= course.nextSpare;
  // Whether the next piece follows this one on: the rest of a chain under
  // way, or the start of a new one. Nothing follows on from a piece that
  // ends in the air, one that stands alone, or one carrying a spare cup.
  const leads = !first && !spareDue && !isAir(pattern) && !standsAlone(pattern);
  let next = 0;
  if (link > 0) {
    if (leads && link + 1 < course.chainLength) next = link + 1;
  } else if (i > 0 && leads) {
    const odds = chainOdds(i, mode);
    if (nextRandom(course.gen) < odds.start) {
      course.chainLength = nextRandom(course.gen) < odds.three ? 3 : 2;
      next = 1;
    }
  }
  const b = makeBuilder(course, remixOf(pattern, d, i, course.expert), {
    link: link > 0,
    tight: next > 0,
    lethal: isDeadly(pattern),
    air: isAir(pattern),
    breather: pattern === BREATHER && i > 0,
  });
  b.spareDue = spareDue;
  if (first) {
    // The first roof is long, flat and quiet: a moment to find the keys.
    const r = b.roof(560);
    b.line(r.x0 + 240, r.top + 6, 4, 24);
    b.slot(r.x0 + 420, r.top);
  } else {
    const builder = BUILDERS[pattern.id];
    // A piece that starts right at the roof's edge is given its run-in when it follows on.
    if (link > 0 && builder.edge) b.roof(b.start);
    builder.build(b);
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

  // The next spare falls due a seeded distance past this one.
  const spare = b.spares[b.spares.length - 1];
  const gap = modeOf(course.expert).spareGap;
  if (spare) course.nextSpare = spare.x + gap[0] + (gap[1] - gap[0]) * nextRandom(course.gen);

  /** @type {Chunk} */
  const chunk = {
    id: course.count,
    pattern: pattern.id,
    x0: course.end,
    x1: b.x,
    difficulty: d,
    intensity: i,
    link,
    speed: b.v,
    roofs: b.roofs,
    items: b.items,
    gaps: b.gaps,
  };
  course.count += 1;
  course.end = b.x;
  course.top = b.top;
  course.last = pattern.id;
  course.link = next;
  // Chained pieces count toward the next breather; a plain roof resets it.
  if (pattern === BREATHER) course.chained = 0;
  else if (link > 0 || next > 0) course.chained += 1;
  return chunk;
}

/**
 * @param {number} seed
 * @param {number} start world x of the first roof
 * @param {boolean} expert
 */
function newCourse(seed, start, expert) {
  return {
    gen: { s: (seed ^ 0x5bd1e995) | 0 },
    expert,
    end: start,
    top: 120,
    count: 0,
    last: "",
    /** The place in a chain the next piece takes: 0 when it doesn't follow on. */
    link: 0,
    chainLength: 0,
    /** Pieces laid in chains since the last breather. */
    chained: 0,
    nextCoaster: start + 420,
    nextSpare: start + modeOf(expert).spareFirst,
    groups: 0,
  };
}

/**
 * Generates a course without running it, for tests and previews.
 * @param {number} seed
 * @param {number} length world units to cover
 * @param {number} [start]
 * @param {{ expert?: boolean }} [options]
 * @returns {Chunk[]}
 */
export function buildCourse(seed, length, start = 0, options = {}) {
  const course = newCourse(seed, start, !!options.expert);
  const chunks = [];
  while (course.end < start + length) chunks.push(buildChunk(course));
  return chunks;
}

// --- The run -------------------------------------------------------------------------------

/**
 * A fresh run: one full cup and the mode's spares, standing on the first roof.
 * @param {number} seed
 * @param {{ startDistance?: number, expert?: boolean }} [options] start
 *   further along (for practice and tests); speed and difficulty follow world x.
 */
export function newRun(seed, options = {}) {
  const start = Math.max(0, options.startDistance ?? 0);
  const expert = !!options.expert;
  const course = newCourse(seed, start, expert);
  const first = buildChunk(course);
  const roof = first.roofs[0];
  const state = {
    seed,
    expert,
    status: /** @type {"running" | "respawning" | "over"} */ ("running"),
    time: 0,
    startX: roof.x0 + 40,
    distance: 0,
    phase: phaseAt(0),
    /** Spare cups held, 0 to MAX_SPARES: each saves the run from one hit, fall or dry cup. */
    spare: modeOf(expert).startSpares,
    tea: 1,
    sugar: 0,
    rush: 0,
    respawnIn: 0,
    /** Where a fallen runner will come back, settled as it falls. */
    respawnAt: /** @type {null | { x: number, y: number }} */ (null),
    combo: { chain: 0, timer: 0 },
    streak: 0,
    score: 0,
    points: { distance: 0, pearls: 0, deliveries: 0, smashes: 0, spares: 0 },
    stats: {
      spares: 0,
      sparesUsed: 0,
      pearls: 0,
      deliveries: 0,
      fullCups: 0,
      bestStreak: 0,
      missed: 0,
      rushes: 0,
      smashes: 0,
      hits: 0,
      strikes: 0,
      falls: 0,
      dry: 0,
      spilled: 0,
      jumps: 0,
      bestCombo: 1,
    },
    /**
     * The run in brief, for sharing: each coaster as it went ("full",
     * "part", "missed"), each cup lost by what took it, and what ended it.
     */
    log: {
      /** @type {string[]} */ coasters: [],
      /** @type {string[]} */ losses: [],
      /** @type {null | string} */ ending: null,
    },
    held: { jump: false, down: false, rush: false },
    runner: {
      x: roof.x0 + 40,
      y: roof.top,
      vx: speedAt(roof.x0 + 40, expert),
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
  if (item.type === "boards") return item.gone ? null : item.y;
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
 * Whether standing up here would put the head into something low, or under
 * the sweep of a swinging sign or a drone overhead.
 * @param {RunState} state
 */
function lowOverhead(state) {
  const r = state.runner;
  const x0 = r.x - HALF_W;
  const x1 = r.x + HALF_W;
  for (const chunk of state.chunks) {
    if (chunk.x1 < r.x - 80 || chunk.x0 > r.x + 80) continue;
    for (const item of chunk.items) {
      if (item.type === "swing") {
        if (item.hit || item.broken || Math.abs(item.y - r.y) > 1) continue;
        const span = swingReach(item);
        if (x1 > span.x0 && x0 < span.x1) return true;
        continue;
      }
      if (item.type === "drone") {
        if (item.state !== "fly") continue;
        if (x1 > item.x - DRONE_W / 2 && x0 < item.x + DRONE_W / 2 && r.y + RUNNER_H > item.y && r.y < item.y + DRONE_H) return true;
        continue;
      }
      if (!isLow(item) && item.type !== "neon") continue;
      const o = /** @type {any} */ (item);
      if (o.hit || o.broken) continue;
      if (x1 > o.x0 && x0 < o.x1 && r.y + RUNNER_H > o.y0 && r.y < o.y1) return true;
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
 * The run is over.
 * @param {RunState} state
 * @param {string} cause what ended it: fall, dry, rail, or the thing run into
 * @param {RunEvent[]} events
 */
function finish(state, cause, events) {
  state.status = "over";
  state.log.ending = cause;
  state.runner.cable = null;
  events.push({ type: "over", cause, score: state.score });
}

/**
 * A hit, a fall or a dry cup costs a spare cup, or ends the run without one.
 * A fall comes back on the next safe roof; a hit or a dry cup carries on
 * where it is, with a moment of grace.
 * @param {RunState} state
 * @param {"hit" | "fall" | "dry"} cause
 * @param {string} what what took it: the thing hit, or the cause again
 * @param {RunEvent[]} events
 */
function loseCup(state, cause, what, events) {
  const r = state.runner;
  breakCombo(state, events);
  if (cause === "fall") state.stats.falls += 1;
  else if (cause === "dry") state.stats.dry += 1;
  else state.stats.hits += 1;
  const saved = state.spare > 0;
  events.push({ type: cause, what, x: r.x, y: r.y, spare: saved });
  if (!saved) {
    finish(state, what, events);
    return;
  }
  state.spare -= 1;
  state.stats.sparesUsed += 1;
  state.log.losses.push(what);
  events.push({ type: "spareUsed", cause, what, left: state.spare, x: r.x, y: r.y });
  if (cause === "fall") {
    r.cable = null;
    state.status = "respawning";
    state.respawnIn = RESPAWN_TIME;
    state.respawnAt = findRespawn(state);
  } else {
    r.grace = HIT_GRACE;
    if (cause === "hit") r.stumble = STUMBLE_TIME;
    else state.tea = Math.max(state.tea, DRY_REFILL);
  }
}

/**
 * Something lethal: the end of the run, spare cups or not.
 * @param {RunState} state
 * @param {string} what
 * @param {RunEvent[]} events
 */
function lethal(state, what, events) {
  const r = state.runner;
  breakCombo(state, events);
  events.push({ type: "lethal", what, x: r.x, y: r.y });
  finish(state, what, events);
}

/** The most chunks laid ahead of time while looking for somewhere safe to come back. */
const RESPAWN_SEARCH = 40;

/**
 * Where a fallen runner will come back: the start of the next proper roof
 * past where it fell, never a chimney top, never one too short to react on,
 * and never one with something lethal or the railway less than
 * RESPAWN_CLEAR seconds on (a live wire along a low roof, a sign hung low).
 * A roof is only judged once the course is laid that far past it, so when
 * the next safe roof isn't laid yet, more course is laid until it is.
 * @param {RunState} state mutated: may lay more course
 */
function findRespawn(state) {
  const fellAt = state.runner.x;
  for (let laid = 0; laid <= RESPAWN_SEARCH; laid++) {
    const point = safeRoofStart(state, fellAt);
    if (point) return point;
    // A fixed course (a test's hand-built stage) has nothing more to lay.
    if (state.course.end >= 1e9) break;
    state.chunks.push(buildChunk(state.course));
  }
  const last = /** @type {Roof} */ (state.chunks[state.chunks.length - 1].roofs.at(-1));
  return { x: last.x0 + 16, y: last.top };
}

/**
 * The first roof start past `fellAt` judged safe to come back on, or null if
 * the course isn't laid far enough to judge the next candidate.
 * @param {RunState} state
 * @param {number} fellAt
 */
function safeRoofStart(state, fellAt) {
  for (const chunk of state.chunks) {
    for (const roof of chunk.roofs) {
      if (roof.kind !== "roof" || roof.x0 <= fellAt - 20 || roof.x1 - roof.x0 < 120) continue;
      const x = roof.x0 + 16;
      // From the front of the runner, with a hair to spare for the speed
      // gained on the way.
      const clear = x + HALF_W + 2 + RESPAWN_CLEAR * speedAt(x, state.expert);
      if (clear > state.course.end) return null;
      const deadly = state.chunks.some(
        (c) =>
          c.x0 < clear &&
          c.x1 > x &&
          (c.items.some((o) => isLethal(o) && "x0" in o && o.x1 > x && o.x0 < clear) || c.gaps.some((g) => g.assist === "rail" && g.x0 >= x && g.x0 < clear)),
      );
      if (!deadly) return { x, y: roof.top };
    }
  }
  return null;
}

/**
 * Where a fallen runner comes back. It is settled the moment the runner
 * falls, so the camera's pan and the respawn go to the same place.
 * @param {RunState} state
 */
export function respawnPoint(state) {
  return state.respawnAt ?? findRespawn(state);
}

/**
 * @param {RunState} state
 * @param {RunEvent[]} events
 */
function respawn(state, events) {
  const r = state.runner;
  const point = respawnPoint(state);
  state.respawnAt = null;
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
  state.status = "running";
  events.push({ type: "respawn", x: r.x, y: r.y });
  extendCourse(state);
}

/**
 * Down on the roof: low, for SLIDE_TIME or for as long as down is held.
 * @param {RunState["runner"]} r
 * @param {RunEvent[]} events
 */
function startSlide(r, events) {
  if (!r.sliding) events.push({ type: "slide", x: r.x, y: r.y });
  r.sliding = true;
  r.slideTime = 0;
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
  const r = state.runner;
  o.broken = true;
  if ("state" in o) o.state = "broken";
  const points = o.type === "crate" ? CRATE_POINTS * o.count : SMASH_POINTS;
  state.points.smashes += points;
  state.stats.smashes += 1;
  const x = "x0" in o ? (o.x0 + o.x1) / 2 : o.type === "swing" ? swingBox(o, state.time).x0 + SWING_W / 2 : o.x;
  const y = "y1" in o ? o.y1 : r.y + RUNNER_H;
  events.push({ type: "smash", what: o.type, cause, points, x, y });
  if (o.type === "crate") {
    // The pearls packed inside spill out where the stack stood.
    const chunk = state.chunks.find((c) => c.items.includes(o));
    for (let i = 0; i < o.count * PEARLS_PER_CRATE; i++) {
      chunk?.items.push({ type: "pearl", x: o.x0 + 4 + i * 12, y: o.y0 + RUNNER_H / 2, taken: false, group: 0 });
    }
  }
}

/**
 * The runner meets something it should have hopped or slid under. A rush
 * smashes it; otherwise it costs a cup, unless the runner is in its grace.
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
  if ("state" in o) o.state = "hit";
  if (r.grace > 0) return;
  loseCup(state, "hit", o.type, events);
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
 * A spare cup goes into a free slot; with every slot full, it is worth
 * SPARE_BONUS instead.
 * @param {RunState} state
 * @param {Extract<Item, { type: "spare" }>} spare
 * @param {RunEvent[]} events
 */
function takeSpare(state, spare, events) {
  spare.taken = true;
  state.stats.spares += 1;
  if (state.spare >= MAX_SPARES) {
    state.points.spares += SPARE_BONUS;
    events.push({ type: "spareBonus", points: SPARE_BONUS, x: spare.x, y: spare.y });
  } else {
    state.spare += 1;
    events.push({ type: "spare", x: spare.x, y: spare.y, held: state.spare });
  }
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
  state.log.coasters.push(full ? "full" : "part");
  state.tea = 1;
  if (full) {
    const wasFull = state.sugar >= SUGAR_FULL;
    state.sugar = Math.min(SUGAR_FULL, state.sugar + FULL_CUP_SUGAR);
    if (!wasFull && state.sugar >= SUGAR_FULL && state.rush === 0) events.push({ type: "rushReady" });
  }
  events.push({ type: "delivery", x: (coaster.x0 + coaster.x1) / 2, y: coaster.y, points, tea, full, streak: state.streak, hard: coaster.hard });
}

/**
 * The rail gap under world x, if any.
 * @param {RunState} state
 * @param {number} x
 */
function railUnder(state, x) {
  for (const chunk of state.chunks) {
    if (chunk.x1 < x - 20 || chunk.x0 > x + 20) continue;
    for (const gap of chunk.gaps) if (gap.assist === "rail" && x > gap.x0 - HALF_W && x < gap.x1 + HALF_W) return gap;
  }
  return null;
}

/**
 * A control let go and pressed again with no step in between (a lesson's
 * pause holds the steps back): the run forgets it was held, so the next
 * step that sees it held takes it as a fresh press.
 * @param {RunState} state
 * @param {"jump" | "down" | "rush"} control
 */
export function letGo(state, control) {
  state.held[control] = false;
}

/**
 * Advances the run by one fixed step. Mutates the state.
 *
 * Events, in the order they happen: jump {coyote, buffered}, slide, slideEnd,
 * glide, glideEnd, slam, land {impact, spill, slam, glide} (then slide, when
 * a slam lands with down still held), bounce, wall,
 * spill {amount, cause: landing | slam}, smash {what, cause: slam | rush,
 * points}, pigeonsUp {count}, strike (into the flock, no cup), barrel, drone, creak, crumble, pearl {points,
 * combo, chain, magnet}, spare {held}, spareBonus {points}, comboLost,
 * rushReady, rushStart, rushEnd, delivery {points, tea, full, streak, hard},
 * miss, cableOn, cableOff {jump}, vent; a cup lost is hit {what}, fall or dry
 * {spare}, then spareUsed {cause, what, left} (a fall's respawn follows
 * RESPAWN_TIME later) or over {cause, score}; something lethal is lethal
 * {what} then over; phase {phase}.
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

  r.vx = speedAt(r.x, state.expert) * (state.rush > 0 ? RUSH_SPEED : 1) * (1 - (STUMBLE_SLOW * r.stumble) / STUMBLE_TIME);
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
        startSlide(r, events);
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
      // Held down keeps the slide going; let go and it ends once it has lasted
      // SLIDE_TIME, never with something overhead to stand up into.
      if (!held.down && r.slideTime >= SLIDE_TIME && !lowOverhead(state)) {
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
    // Touching down clears the slam, so remember it for the slide below.
    const slamming = r.slamming;
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
    // A tapped slam lands standing; one still held lands straight into a
    // slide, low before anything ahead is met this step.
    if (slamming && r.grounded && held.down) startSlide(r, events);
    if (!r.grounded && !r.cable) catchCable(state, prevX, prevY, events);
  }

  touchItems(state, dt, events);

  state.distance = Math.max(state.distance, r.x - state.startX);
  state.points.distance = Math.floor(state.distance / METRE);
  const p = state.points;
  state.score = p.distance + p.pearls + p.deliveries + p.smashes + p.spares;

  if (r.y < FALL_Y && state.status === "running") {
    if (railUnder(state, r.x)) lethal(state, "rail", events);
    else loseCup(state, "fall", "fall", events);
  }
  if (state.status === "running" && state.tea <= 1e-9) loseCup(state, "dry", "dry", events);
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
 * Whether two boxes overlap.
 * @param {{ x0: number, x1: number, y0: number, y1: number }} a
 * @param {{ x0: number, x1: number, y0: number, y1: number }} b
 */
const overlaps = (a, b) => a.x1 > b.x0 && a.x0 < b.x1 && a.y1 > b.y0 && a.y0 < b.y1;

/** The furthest ahead anything waits to be set off, in seconds of running. */
const TRIGGER_AHEAD = Math.max(PIGEON_WARNING, BARREL_WARNING, DRONE_WARNING);

/**
 * Obstacles, pigeons, pearls and coasters near the runner, and the things
 * that move: set off, moved, and met.
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
    if (chunk.x1 < r.x - 200 || chunk.x0 > r.x + r.vx * TRIGGER_AHEAD + 40) continue;
    for (const item of chunk.items) {
      if (state.status !== "running") return;
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
        case "spare": {
          if (
            !item.taken &&
            item.x + SPARE_RADIUS > box.x0 && item.x - SPARE_RADIUS < box.x1 &&
            item.y + SPARE_RADIUS > box.y0 && item.y - SPARE_RADIUS < box.y1
          ) {
            takeSpare(state, item, events);
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
            state.log.coasters.push("missed");
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
            // Flying into the flock only scatters it: feathers, never a cup.
            item.state = "struck";
            state.stats.strikes += 1;
            events.push({ type: "strike", x: p.x, y: p.y });
          }
          break;
        }
        case "barrel": {
          if (item.state === "wait") {
            if (item.x - r.x < r.vx * BARREL_WARNING) {
              item.state = "roll";
              events.push({ type: "barrel", x: item.x, y: item.y });
            }
            break;
          }
          if (item.state !== "roll") break;
          item.t += dt;
          item.x -= BARREL_SPEED * dt;
          if (item.x - BARREL_W / 2 < item.minX) {
            item.state = "fell";
            break;
          }
          if (r.cable) break;
          const o = { x0: item.x - BARREL_W / 2, x1: item.x + BARREL_W / 2, y0: item.y, y1: item.y + BARREL_H };
          if (overlaps(box, o)) contact(state, item, events);
          break;
        }
        case "drone": {
          if (item.state === "wait") {
            if (item.x - r.x < r.vx * DRONE_WARNING) {
              item.state = "fly";
              events.push({ type: "drone", x: item.x, y: item.y });
            }
            break;
          }
          if (item.state !== "fly" && item.state !== "hit") break;
          item.t += dt;
          item.x -= DRONE_SPEED * dt;
          if (item.state !== "fly" || r.cable) break;
          const o = { x0: item.x - DRONE_W / 2, x1: item.x + DRONE_W / 2, y0: item.y, y1: item.y + DRONE_H };
          if (overlaps(box, o)) contact(state, item, events);
          break;
        }
        case "swing": {
          if (item.hit || item.broken || r.cable) break;
          if (overlaps(box, swingBox(item, state.time))) contact(state, item, events);
          break;
        }
        case "boards": {
          if (item.gone) break;
          if (item.at < 0) {
            if (r.grounded && Math.abs(r.y - item.y) < 0.01 && box.x1 > item.x0 && box.x0 < item.x1) {
              item.at = state.time + CRUMBLE_TIME;
              events.push({ type: "creak", x: r.x, y: item.y });
            }
          } else if (state.time >= item.at) {
            item.gone = true;
            events.push({ type: "crumble", x0: item.x0, x1: item.x1, y: item.y });
          }
          break;
        }
        case "steam": {
          if (item.hit || item.broken || r.cable) break;
          if (overlaps(box, item) || (steamPhase(item, state.time).state === "on" && overlaps(box, plumeBox(item)))) {
            contact(state, item, events);
          }
          break;
        }
        default: {
          const lethalThing = isLethal(item);
          if (!lethalThing && !isSolid(item) && !isLow(item)) break;
          const o = /** @type {any} */ (item);
          if (o.hit || o.broken || r.cable) break;
          if (!overlaps(box, o)) break;
          // Feet level with a solid top means standing on it.
          if (isSolid(o) && r.y >= o.y1 - 0.01) break;
          if (lethalThing) {
            o.hit = true;
            lethal(state, o.type, events);
          } else {
            contact(state, o, events);
          }
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
    spares: state.stats.spares,
    sparesUsed: state.stats.sparesUsed,
    sparePoints: state.points.spares,
    rushes: state.stats.rushes,
    missed: state.stats.missed,
    hits: state.stats.hits,
    falls: state.stats.falls,
    dry: state.stats.dry,
    bestCombo: state.stats.bestCombo,
    ending: state.log.ending,
  };
}

// --- Sharing ---------------------------------------------------------------------------------

/** Each coaster as it went. */
export const SHARE_COASTERS = Object.freeze({ full: "🧋", part: "🥤", missed: "▫️" });
/** Whatever took a cup or ended the run. */
export const SHARE_CAUSES = Object.freeze({
  fall: "🕳️",
  dry: "💧",
  pigeon: "🐦",
  crate: "📦",
  barrel: "🛢️",
  drone: "🛸",
  steam: "♨️",
  wire: "⚡",
  neon: "⚡",
  skylight: "🪟",
  rail: "🚆",
});
/** What ended the run, in words. */
export const ENDINGS = Object.freeze({
  fall: "a fall",
  dry: "a dry cup",
  ac: "an air conditioner",
  tank: "a water tank",
  crate: "a crate",
  clothesline: "a clothesline",
  billboard: "a billboard",
  pigeon: "the pigeons",
  barrel: "a barrel",
  drone: "a drone",
  swing: "a swinging sign",
  steam: "a steam pipe",
  wire: "a live wire",
  skylight: "a skylight",
  neon: "a neon sign",
  rail: "the railway",
});

/** @param {string} cause */
const causeEmoji = (cause) => /** @type {Record<string, string>} */ (SHARE_CAUSES)[cause] ?? "💥";

/**
 * The run as at most four short lines for the share text: the distance, the
 * coasters as cups (two rows at most), and the cups lost, then what ended it.
 * @param {RunState} state
 * @returns {string[]}
 */
export function shareLines(state) {
  const metres = Math.floor(state.distance / METRE);
  const lines = [`🏃 ${metres.toLocaleString("en-US")} m`];
  const cells = state.log.coasters.map((c) => /** @type {Record<string, string>} */ (SHARE_COASTERS)[c]);
  const width = 10;
  for (let row = 0; row < 2 && row * width < cells.length; row++) {
    let line = cells.slice(row * width, (row + 1) * width).join("");
    if (row === 1 && cells.length > 2 * width) line += "…";
    lines.push(line);
  }
  const ending = state.log.ending;
  if (ending) {
    const lost = state.log.losses.map(causeEmoji).join("");
    const words = /** @type {Record<string, string>} */ (ENDINGS)[ending] ?? ending;
    lines.push(`${lost ? `${lost} then ` : ""}${causeEmoji(ending)} ${words}`);
  }
  return lines;
}
