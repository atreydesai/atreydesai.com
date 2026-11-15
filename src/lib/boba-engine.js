// Boba catch's rules, DOM-free. The run is endless: cups keep coming, faster
// and thicker, until the last pearl drops. Everything that decides how hard
// it is, what a catch is worth, and when a pearl comes back lives here; the
// component only draws, listens, and asks.

const GOLDEN_EVERY = 10;
export const PLAYFIELD_TOP = 86;
export const PLAYFIELD_EDGE = 8;

/** @typedef {"opening" | "steady" | "rush"} GamePhase */

/**
 * @typedef {object} CatchRules
 * @property {boolean} expert
 * @property {number} lives Pearls at the start, and the most a run can hold.
 * @property {number} basketWidth The basket as drawn; a cup is caught anywhere across it.
 * @property {number} perfectRadius How far from the basket's middle a catch is perfect.
 * @property {number} startIntensity Where the ramp starts.
 * @property {number} secondsPerIntensity Seconds the ramp takes to climb one whole unit.
 * @property {number} maxIntensity Where the ramp stops climbing.
 * @property {number} telegraphScale How long a link glows before it throws, relative to normal.
 * @property {number} goldensToRestore Golden cups in a row, with no miss, that win a pearl back (0: never).
 */

/**
 * Normal ramps from a calm opening to its cap at three and a half minutes.
 * Expert starts where normal is two minutes in, climbs about half as fast
 * again to a higher cap, with a basket a third narrower, a tighter perfect,
 * a shorter warning, and no pearls coming back.
 * @type {{ normal: CatchRules, expert: CatchRules }}
 */
export const CATCH_RULES = Object.freeze({
  normal: Object.freeze({
    expert: false,
    lives: 3,
    basketWidth: 78,
    perfectRadius: 12,
    startIntensity: 0,
    secondsPerIntensity: 210,
    maxIntensity: 1,
    telegraphScale: 1,
    goldensToRestore: 3,
  }),
  expert: Object.freeze({
    expert: true,
    lives: 3,
    basketWidth: 54,
    perfectRadius: 7,
    startIntensity: 0.5,
    secondsPerIntensity: 150,
    maxIntensity: 1.2,
    telegraphScale: 0.85,
    goldensToRestore: 0,
  }),
});

/** @param {boolean} [expert] */
export function catchRules(expert = false) {
  return expert ? CATCH_RULES.expert : CATCH_RULES.normal;
}

/**
 * @param {number} value
 * @param {number} low
 * @param {number} high
 */
function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// --- The ramp ---------------------------------------------------------------

/**
 * How far along the ramp a run is after `elapsed` seconds: 0 is the calm
 * opening, 1 is normal's cap (expert climbs past it).
 * @param {number} elapsed
 * @param {CatchRules} [rules]
 */
export function intensityAt(elapsed, rules = CATCH_RULES.normal) {
  const climbed = Math.max(0, elapsed) / rules.secondsPerIntensity;
  return Math.min(rules.maxIntensity, rules.startIntensity + climbed);
}

/**
 * The music's phase, and the ticket's label, follow the ramp.
 * @param {number} intensity
 * @returns {GamePhase}
 */
export function phaseForIntensity(intensity) {
  if (intensity < 0.2) return "opening";
  if (intensity < 0.55) return "steady";
  return "rush";
}

/**
 * @typedef {object} Difficulty
 * @property {GamePhase} phase
 * @property {number} intensity
 * @property {number} gravity Pixels per second squared, fixed per cup at its throw.
 * @property {number} spawnInterval Seconds between throws.
 * @property {number} maxActive Cups in the air or about to be, at most.
 * @property {number} spread Range of a throw's sideways speed, in pixels per second.
 * @property {number} telegraph Seconds a link glows before it throws.
 * @property {number} volleyChance Chance a throw is two cups from two links at once.
 * @property {number} tripleChance Chance a volley is three cups instead of two.
 * @property {number} lobChance Chance of a high lob that hangs and drifts.
 * @property {number} flickChance Chance of a low, fast flick.
 */

/**
 * Everything that makes the run harder, from how far along the ramp it is.
 * Each figure moves smoothly with intensity; volleys, lobs, and flicks only
 * start once the opening is over.
 * @param {number} intensity
 * @param {CatchRules} [rules]
 * @returns {Difficulty}
 */
export function difficultyForIntensity(intensity, rules = CATCH_RULES.normal) {
  const i = clamp(intensity, 0, rules.maxIntensity);
  return {
    phase: phaseForIntensity(i),
    intensity: i,
    gravity: 500 + 580 * i,
    // Geometric, so the gaps shrink quickly early and slowly near the cap.
    spawnInterval: 1.35 * Math.pow(0.3 / 1.35, i),
    maxActive: 3 + Math.floor(6 * i),
    spread: 110 + 170 * i,
    telegraph: (0.44 - 0.14 * i) * rules.telegraphScale,
    volleyChance: clamp((i - 0.25) * 0.6, 0, 0.5),
    tripleChance: clamp((i - 0.7) * 1.2, 0, 0.5),
    lobChance: clamp((i - 0.15) * 0.5, 0, 0.35),
    flickChance: clamp((i - 0.35) * 0.45, 0, 0.3),
  };
}

/**
 * @param {number} elapsed
 * @param {CatchRules} [rules]
 */
export function difficultyAt(elapsed, rules = CATCH_RULES.normal) {
  return difficultyForIntensity(intensityAt(elapsed, rules), rules);
}

/**
 * How many cups a throw sends at once: one, a pair, or three.
 * @param {Difficulty} difficulty
 * @param {() => number} [rand]
 */
export function volleySize(difficulty, rand = Math.random) {
  if (rand() >= difficulty.volleyChance) return 1;
  return rand() < difficulty.tripleChance ? 3 : 2;
}

/**
 * The throw out of a link. Every cup rises a little and peaks at least 150px
 * above the basket, so even a low flick gives time to read it. Lobs climb
 * higher and drift further; flicks barely rise and fly sideways faster.
 * @param {Difficulty} difficulty
 * @param {{ spawnBottom: number, catchLine: number }} place
 * @param {() => number} [rand]
 * @returns {{ vx: number, vy: number, kind: "throw" | "lob" | "flick" }}
 */
export function throwVelocity(difficulty, { spawnBottom, catchLine }, rand = Math.random) {
  const floor = Math.max(0, spawnBottom - (catchLine - 150));
  const base = Math.max(50, spawnBottom - Math.min(spawnBottom - 60, catchLine - 150));
  const roll = rand();
  let kind = /** @type {"throw" | "lob" | "flick"} */ ("throw");
  let rise = base;
  let spread = difficulty.spread;
  if (roll < difficulty.flickChance) {
    kind = "flick";
    rise = Math.max(36, floor);
    spread *= 1.35;
  } else if (roll < difficulty.flickChance + difficulty.lobChance) {
    kind = "lob";
    rise = base + 90 + rand() * 90;
  }
  const vx = (rand() - 0.5) * spread;
  const vy = -Math.sqrt(2 * difficulty.gravity * rise) - rand() * 24;
  return { vx, vy, kind };
}

// --- Fair landings ------------------------------------------------------------

/**
 * Folds a horizontal position into [left, right] the way wall bounces do.
 * @param {number} position
 * @param {number} left
 * @param {number} right
 */
function foldInto(position, left, right) {
  const span = right - left;
  if (span <= 0) return left;
  const period = span * 2;
  const offset = (((position - left) % period) + period) % period;
  return left + (offset <= span ? offset : period - offset);
}

/**
 * When and where a cup in flight reaches the basket's catch line, from its
 * current state: seconds from now, and the cup's centre then, wall bounces
 * included.
 * @param {{ x: number, y: number, vx: number, vy: number }} body Left/top of the sprite.
 * @param {number} gravity
 * @param {number} catchLine
 * @param {{ width: number, height: number }} sprite
 * @param {number} viewportWidth
 */
export function predictLanding(body, gravity, catchLine, sprite, viewportWidth) {
  const drop = catchLine - (body.y + sprite.height);
  const time =
    drop <= 0 && body.vy > 0 ? 0 : (-body.vy + Math.sqrt(Math.max(0, body.vy * body.vy + 2 * gravity * drop))) / gravity;
  const left = PLAYFIELD_EDGE;
  const right = Math.max(left, viewportWidth - PLAYFIELD_EDGE - sprite.width);
  const x = foldInto(body.x + body.vx * time, left, right);
  return { time, center: x + sprite.width / 2 };
}

// A hand on a mouse: a moment to react, then about this fast across the page.
const REACH_BASE = 0.15;
const REACH_SPEED = 2400;

/**
 * Seconds a player needs to move the basket `distance` pixels and be ready.
 * @param {number} distance
 */
export function reachSeconds(distance) {
  return REACH_BASE + Math.max(0, distance) / REACH_SPEED;
}

/**
 * Brutal, never impossible: a cup may only be thrown if the basket can get
 * from every other landing to this one in time (or both fall well inside it
 * at once). Times are on one clock; centres in pixels. The margins are kept
 * on the safe side, so a basket that really moves this fast never misses.
 * @param {{ time: number, center: number }} landing
 * @param {Array<{ time: number, center: number }>} others
 * @param {number} basketWidth
 */
export function isFairLanding(landing, others, basketWidth) {
  for (const other of others) {
    const apart = Math.abs(landing.center - other.center);
    if (apart <= basketWidth * 0.4) continue;
    if (Math.abs(landing.time - other.time) < reachSeconds(apart - basketWidth / 4)) return false;
  }
  return true;
}

/** Arcs tried each time a link is ready to throw, before it waits a beat. */
const THROW_TRIES = 6;

/**
 * A link's throw, planned so it lands fairly among the cups already in the
 * air: a few arcs are tried, and the first fair one is thrown. Null means
 * none was fair, and the link should hold its cup a moment and try again.
 * @param {Difficulty} difficulty
 * @param {{ x: number, y: number }} spawn Left/top of the cup on its link.
 * @param {{ catchLine: number, sprite: { width: number, height: number }, viewportWidth: number, basketWidth: number }} field
 * @param {Array<{ time: number, center: number }>} others Landings still to come, on the same clock as `now`.
 * @param {number} now
 * @param {() => number} [rand]
 */
export function planThrow(difficulty, spawn, field, others, now, rand = Math.random) {
  const { catchLine, sprite, viewportWidth, basketWidth } = field;
  for (let attempt = 0; attempt < THROW_TRIES; attempt++) {
    const { vx, vy, kind } = throwVelocity(difficulty, { spawnBottom: spawn.y + sprite.height, catchLine }, rand);
    const body = { x: spawn.x, y: spawn.y, vx, vy };
    const landing = predictLanding(body, difficulty.gravity, catchLine, sprite, viewportWidth);
    const at = { time: now + landing.time, center: landing.center };
    if (isFairLanding(at, others, basketWidth)) return { vx, vy, kind, landAt: at.time, landCenter: at.center };
  }
  return null;
}

/**
 * Where the demo's basket heads: the next cup to land, unless a golden cup
 * lands just after it, which it goes for instead (a little greedy, like a
 * person). Null when nothing is coming.
 * @param {Array<{ time: number, center: number, golden?: boolean }>} landings
 * @param {number} now
 */
export function demoTarget(landings, now) {
  const ahead = landings.filter((landing) => landing.time >= now).sort((a, b) => a.time - b.time);
  if (!ahead.length) return null;
  const next = ahead[0];
  if (!next.golden) {
    const golden = ahead.find((landing) => landing.golden && landing.time - next.time < 0.3);
    if (golden) return golden;
  }
  return next;
}

// --- The playfield --------------------------------------------------------------

/**
 * @param {number} centerX
 * @param {number} viewportWidth
 * @param {number} spriteWidth
 */
export function clampSpawnCenter(centerX, viewportWidth, spriteWidth) {
  const half = spriteWidth / 2;
  const min = PLAYFIELD_EDGE + half;
  const max = Math.max(min, viewportWidth - PLAYFIELD_EDGE - half);
  return Math.max(min, Math.min(max, centerX));
}

/**
 * @template {{ x: number, vx: number }} T
 * @param {T} body
 * @param {number} spriteWidth
 * @param {number} viewportWidth
 * @returns {T}
 */
export function bounceHorizontal(body, spriteWidth, viewportWidth) {
  const left = PLAYFIELD_EDGE;
  const right = Math.max(left, viewportWidth - PLAYFIELD_EDGE - spriteWidth);

  if (body.x < left) {
    body.x = left;
    body.vx = Math.abs(body.vx);
  } else if (body.x > right) {
    body.x = right;
    body.vx = -Math.abs(body.vx);
  }

  return body;
}

// --- Catches, points, pearls ----------------------------------------------------

/**
 * @param {number} cupCenter
 * @param {number} basketX
 * @param {number} basketWidth
 * @param {number} [radius]
 */
export function isPerfectCatch(cupCenter, basketX, basketWidth, radius = CATCH_RULES.normal.perfectRadius) {
  return Math.abs(cupCenter - (basketX + basketWidth / 2)) <= radius;
}

/** @param {number} spawnNumber */
export function isGoldenSpawn(spawnNumber) {
  return spawnNumber > 0 && spawnNumber % GOLDEN_EVERY === 0;
}

/**
 * @param {boolean} golden
 * @param {boolean} perfect
 */
export function pointsForCatch(golden, perfect) {
  return (golden ? 3 : 1) + (perfect ? 1 : 0);
}

/**
 * @typedef {object} Lives
 * @property {number} left
 * @property {number} max
 * @property {number} goldens Golden cups caught in a row since the last miss, while a pearl is down.
 */

/**
 * @param {CatchRules} [rules]
 * @returns {Lives}
 */
export function createLives(rules = CATCH_RULES.normal) {
  return { left: rules.lives, max: rules.lives, goldens: 0 };
}

/**
 * A missed cup drops a pearl and breaks any golden run.
 * @param {Lives} lives
 * @returns {Lives}
 */
export function dropPearl(lives) {
  return { ...lives, left: Math.max(0, lives.left - 1), goldens: 0 };
}

/**
 * A golden cup caught. While a pearl is down, enough of them in a row (no
 * miss between) win one back; at full pearls there is nothing to win, so
 * nothing is counted.
 * @param {Lives} lives
 * @param {CatchRules} [rules]
 * @returns {{ lives: Lives, restored: boolean, toGo: number }}
 */
export function catchGolden(lives, rules = CATCH_RULES.normal) {
  const need = rules.goldensToRestore;
  if (need <= 0 || lives.left >= lives.max) {
    return { lives: { ...lives, goldens: 0 }, restored: false, toGo: 0 };
  }
  const goldens = lives.goldens + 1;
  if (goldens >= need) {
    return { lives: { ...lives, left: lives.left + 1, goldens: 0 }, restored: true, toGo: 0 };
  }
  return { lives: { ...lives, goldens }, restored: false, toGo: need - goldens };
}

// --- After the run ----------------------------------------------------------------

/**
 * Time on shift as m:ss.
 * @param {number} seconds
 */
export function formatShift(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Fifteen seconds of shift a square, until a run needs more than thirty. */
const SHARE_SEGMENT = 15;
const SHARE_CELLS = 30;

/**
 * @typedef {"drop" | "back" | "golden"} ShiftEventKind
 * @typedef {{ time: number, kind: ShiftEventKind }} ShiftEvent
 */

/**
 * The shift as a strip of emoji, one per stretch of time: a pearl dropped
 * (💥), a pearl won back (⚫), a golden cup caught (🌟), or a clean stretch
 * (🧋). A stretch shows the most dramatic thing in it.
 * @param {ShiftEvent[]} events
 * @param {number} seconds
 */
export function shiftCells(events, seconds) {
  const segment = Math.max(SHARE_SEGMENT, Math.ceil(seconds / SHARE_CELLS));
  const count = Math.max(1, Math.ceil(seconds / segment));
  const rank = { clean: 0, golden: 1, back: 2, drop: 3 };
  /** @type {Array<keyof typeof rank>} */
  const worst = Array.from({ length: count }, () => "clean");
  for (const event of events) {
    const index = clamp(Math.floor(event.time / segment), 0, count - 1);
    if (rank[event.kind] > rank[worst[index]]) worst[index] = event.kind;
  }
  const emoji = { clean: "🧋", golden: "🌟", back: "⚫", drop: "💥" };
  return worst.map((kind) => emoji[kind]);
}
