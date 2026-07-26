export const GAME_DURATION_SECONDS = 60;
export const COUNTDOWN_SECONDS = 3;
export const GOLDEN_EVERY = 10;
export const PERFECT_RADIUS = 12;
export const PLAYFIELD_TOP = 86;
export const PLAYFIELD_EDGE = 8;

/** @typedef {"opening" | "steady" | "rush"} GamePhase */

/**
 * @typedef {object} Difficulty
 * @property {GamePhase} phase
 * @property {number} gravity
 * @property {number} spawnInterval
 * @property {number} maxActive
 */

/**
 * @param {number} from
 * @param {number} to
 * @param {number} t
 */
function mix(from, to, t) {
  return from + (to - from) * Math.max(0, Math.min(1, t));
}

/**
 * @param {number} elapsed
 * @returns {GamePhase}
 */
export function phaseForElapsed(elapsed) {
  if (elapsed < 15) return "opening";
  if (elapsed < 45) return "steady";
  return "rush";
}

/**
 * @param {number} elapsed
 * @returns {Difficulty}
 */
export function difficultyForElapsed(elapsed) {
  const t = Math.max(0, Math.min(GAME_DURATION_SECONDS, elapsed));
  const phase = phaseForElapsed(t);

  if (phase === "opening") {
    const p = t / 15;
    return {
      phase,
      gravity: mix(500, 575, p),
      spawnInterval: mix(1.35, 1.02, p),
      maxActive: 3,
    };
  }

  if (phase === "steady") {
    const p = (t - 15) / 30;
    return {
      phase,
      gravity: mix(575, 775, p),
      spawnInterval: mix(1.02, 0.64, p),
      maxActive: 5,
    };
  }

  const p = (t - 45) / 15;
  return {
    phase,
    gravity: mix(775, 930, p),
    spawnInterval: mix(0.64, 0.38, p),
    maxActive: 7,
  };
}

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

/**
 * @param {number} cupCenter
 * @param {number} basketX
 * @param {number} basketWidth
 */
export function isPerfectCatch(cupCenter, basketX, basketWidth) {
  return Math.abs(cupCenter - (basketX + basketWidth / 2)) <= PERFECT_RADIUS;
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

/** @param {number} elapsed */
export function timeRemaining(elapsed) {
  return Math.max(0, Math.ceil(GAME_DURATION_SECONDS - elapsed));
}
