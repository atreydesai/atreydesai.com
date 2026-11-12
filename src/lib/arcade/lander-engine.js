// Tea minus rules: land a cup of milk tea on the moon, burning the tea as fuel.
// Kept free of the DOM (and of Math.random) so every site and every flight
// replays the same way under node.
//
// The world is in its own units: x wraps every PERIOD, y points up and ground
// heights are positive. Angles are radians, 0 is upright and positive tilts the
// cup to the right, so thrust then pushes it toward +x. The tuning numbers come
// from a play-tested prototype; change them only with a controller in hand.

export const PERIOD = 1200;
export const GRAVITY = 10;
export const THRUST = 27;
/** Fuel per second at full throttle. */
export const BURN = 30;
/** Target spin, rad/s, while a turn key is held. */
export const TURN_RATE = 2.5;
/** Fastest safe descent. */
export const SAFE_VY = 16;
/** Fastest safe sideways drift. */
export const SAFE_VX = 10;
/** Most tilt a landing forgives, rad. */
export const SAFE_TILT = 0.2;
/** A descent this slow or slower is a "feather" landing. */
export const FEATHER_VY = 6;
/** Feather bonus, per pad multiplier. */
export const FEATHER_BONUS = 25;
/** Site 1's tank; the HUD gauge is fuel / MAX_FUEL. */
export const MAX_FUEL = 620;
export const START_LIVES = 3;
/** Feet sit at local x = ±FOOT_SPAN. */
export const FOOT_SPAN = 11;
/** Feet sit at local y = -FOOT_DROP, so a landed ship rests at pad.y + FOOT_DROP. */
export const FOOT_DROP = 8;

/**
 * Collision points in the ship's local frame. The two feet come first, so any
 * other point touching the ground means the body hit.
 * @type {ReadonlyArray<readonly [number, number]>}
 */
export const HULL = [
  [-11, -8], [11, -8], [0, -6], [-7, 3], [7, 3], [-6, 7], [6, 7], [-3, 11], [3, 11], [6.5, 14.5],
];

export const SITE_NAMES = [
  "sea of tapioca",
  "mare oolong",
  "taro flats",
  "the quiet saucer",
  "brown sugar basin",
  "lacus matcha",
  "jasmine ridge",
  "crater of second sips",
];

/** How far the plume is traced looking for ground, and the step it takes. */
const PLUME_SEARCH = 95;
const PLUME_STEP = 3;
/** Below this throttle there is no plume to speak of. */
const PLUME_THROTTLE = 0.08;

/** @typedef {{ cx: number, y: number, width: number, multiplier: number }} Pad */
/**
 * @typedef {{
 *   n: number, name: string, points: Array<[number, number]>, pads: Pad[],
 *   wind: number, fuel: number
 * }} Site
 */
/** @typedef {"flying" | "landed" | "crashed"} ShipState */
/**
 * @typedef {{
 *   x: number, y: number, vx: number, vy: number, angle: number, spin: number,
 *   throttle: number, fuel: number, plumeReach: number, state: ShipState
 * }} Ship
 */
/** @typedef {{ left: boolean, right: boolean, thrust: boolean }} Controls */
/** @typedef {"fast" | "off" | "tilt" | "hard" | "drift"} CrashReason */
/**
 * @typedef {{ kind: "land", pad: Pad, points: number, feather: boolean }
 *   | { kind: "crash", reason: CrashReason }} Touchdown
 */

/**
 * @param {number} value
 * @param {number} low
 * @param {number} high
 */
function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

/** @param {number} x */
function wrap(x) {
  return ((x % PERIOD) + PERIOD) % PERIOD;
}

/**
 * A small seeded generator (mulberry32), so a seed always builds the same site.
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

/**
 * Builds landing site n (1-based): rolling terrain with four flat pads carved
 * into it. Later sites get narrower pads, smaller tanks and stronger wind.
 * @param {number} n
 * @param {number} seed
 * @returns {Site}
 */
export function makeSite(n, seed) {
  const random = createRng(seed);
  // Layered octaves of periodic noise, coarse hills first, so the terrain
  // wraps without a seam.
  const octaves = [[3, 60], [6, 52], [12, 42], [24, 24], [48, 10]];
  const tables = octaves.map(([count]) => Array.from({ length: count }, () => random()));
  /** @param {number} x */
  const heightAt = (x) => {
    let height = 9;
    for (let i = 0; i < octaves.length; i++) {
      const [count, amplitude] = octaves[i];
      const table = tables[i];
      const f = wrap(x) / PERIOD * count;
      const i0 = Math.floor(f);
      const fraction = f - i0;
      const a = table[i0 % count];
      const b = table[(i0 + 1) % count];
      height += amplitude * (a + (b - a) * fraction);
    }
    return height;
  };

  const count = 92;
  const dx = PERIOD / count;
  /** @type {Array<[number, number]>} */
  let points = [];
  for (let i = 0; i < count; i++) {
    const x = (i + (random() - 0.5) * 0.7) * dx;
    points.push([x, heightAt(x)]);
  }

  const shrink = Math.max(0.6, 1 - 0.075 * (n - 1));
  const multipliers = [2, 3, 5, n > 3 ? 5 : 2];
  for (let i = 3; i > 0; i--) {
    const j = (random() * (i + 1)) | 0;
    [multipliers[i], multipliers[j]] = [multipliers[j], multipliers[i]];
  }
  // Richer pads are narrower, and the richest sit a little lower in the hills.
  /** @type {Record<number, number>} */
  const baseWidth = { 2: 74, 3: 52, 5: 38 };
  const slot = PERIOD / 4;
  /** @type {Pad[]} */
  const pads = [];
  multipliers.forEach((multiplier, i) => {
    const width = Math.max(29, baseWidth[multiplier] * shrink);
    const cx = slot * (i + 0.5) + (random() - 0.5) * slot * 0.42;
    const y = clamp(heightAt(cx) * (multiplier === 5 ? 0.8 : 1), 20, 165);
    pads.push({ cx, y, width, multiplier });
    points = points.filter((p) => p[0] < cx - width / 2 - 5 || p[0] > cx + width / 2 + 5);
    points.push([cx - width / 2, y], [cx + width / 2, y]);
  });
  // The first point can be jittered just below x = 0. Wrapping it to the far
  // end describes the same closed outline but keeps groundAt seamless.
  points = points.map(([x, y]) => [wrap(x), y]);
  points.sort((a, b) => a[0] - b[0]);

  const direction = random() < 0.5 ? -1 : 1;
  const wind = n < 2 ? 0 : direction * Math.min(6.5, 1.4 + 0.9 * (n - 2));
  return {
    n,
    name: SITE_NAMES[(n - 1) % SITE_NAMES.length],
    points,
    pads,
    wind,
    fuel: Math.max(270, 620 - 50 * (n - 1)),
  };
}

/**
 * Terrain height at any x, wrapping around the moon.
 * @param {Site} site
 * @param {number} x
 */
export function groundAt(site, x) {
  const points = site.points;
  const last = points.length - 1;
  const xm = wrap(x);
  if (xm < points[0][0]) {
    // Between the last point and the first one, across the seam.
    const [ax, ay] = points[last];
    const [bx, by] = points[0];
    const from = ax - PERIOD;
    return ay + ((by - ay) * (xm - from)) / (bx - from);
  }
  let i = last;
  while (i > 0 && points[i][0] > xm) i--;
  const [ax, ay] = points[i];
  const bx = i < last ? points[i + 1][0] : points[0][0] + PERIOD;
  const by = i < last ? points[i + 1][1] : points[0][1];
  return ay + ((by - ay) * (xm - ax)) / (bx - ax || 1);
}

/**
 * The highest terrain between two x, sampled every 7 units.
 * @param {Site} site
 * @param {number} x0
 * @param {number} x1
 */
export function highestGround(site, x0, x1) {
  const from = Math.min(x0, x1);
  const to = Math.max(x0, x1);
  let highest = 0;
  for (let x = from; x <= to; x += 7) highest = Math.max(highest, groundAt(site, x));
  return highest;
}

/**
 * The pad both feet are over, allowing a 1.5 unit lip either side, or null.
 * @param {Site} site
 * @param {number} leftX
 * @param {number} rightX
 */
export function padUnder(site, leftX, rightX) {
  for (const pad of site.pads) {
    // Compare against the copy of the pad nearest the feet, wherever the
    // ship is on the wrapped world.
    const centre = pad.cx + Math.round(((leftX + rightX) / 2 - pad.cx) / PERIOD) * PERIOD;
    if (leftX >= centre - pad.width / 2 - 1.5 && rightX <= centre + pad.width / 2 + 1.5) return pad;
  }
  return null;
}

/**
 * Sideways acceleration from the wind, gusting slowly around its mean.
 * @param {Site} site
 * @param {number} time seconds since the site began
 */
export function windAt(site, time) {
  return site.wind ? site.wind * (1 + 0.35 * Math.sin(time * 0.7)) : 0;
}

/**
 * Where a new ship starts, near the top of the view but never too low.
 * @param {number} viewHeight the view's height in world units
 */
export function startAltitude(viewHeight) {
  return Math.max(220, Math.min(viewHeight - 118, 560));
}

/**
 * A fresh ship drifting in from the left with a full tank.
 * @param {Site} site
 * @param {number} viewHeight
 * @returns {Ship}
 */
export function newShip(site, viewHeight) {
  return {
    x: 100,
    y: startAltitude(viewHeight),
    vx: 26 + 3 * Math.min(site.n, 6),
    vy: 0,
    angle: 0,
    spin: 0,
    throttle: 0,
    fuel: site.fuel,
    plumeReach: 999,
    state: "flying",
  };
}

/**
 * Decides how a touchdown went. A crash fast enough wrecks the ship wherever
 * it lands, so speed is checked before the pad, then attitude, then the
 * gentler limits.
 * @param {Pick<Ship, "vx" | "vy" | "angle">} ship
 * @param {Pad | null} pad
 * @param {boolean} bodyHit whether anything but the feet touched
 * @returns {CrashReason | null} null for a good landing
 */
export function judgeTouchdown(ship, pad, bodyHit) {
  if (ship.vy < -SAFE_VY * 1.8 || Math.abs(ship.vx) > SAFE_VX * 2.2) return "fast";
  if (!pad) return "off";
  if (bodyHit || Math.abs(ship.angle) > SAFE_TILT) return "tilt";
  if (ship.vy < -SAFE_VY) return "hard";
  if (Math.abs(ship.vx) > SAFE_VX) return "drift";
  return null;
}

/**
 * Points for a landing: leftover tea counts, scaled by the pad.
 * @param {Pad} pad
 * @param {number} fuel
 * @param {number} vy descent speed at touchdown
 */
export function landingScore(pad, fuel, vy) {
  const feather = Math.abs(vy) <= FEATHER_VY;
  const points =
    pad.multiplier * (50 + Math.round(fuel)) + (feather ? pad.multiplier * FEATHER_BONUS : 0);
  return { points, feather };
}

/**
 * Advances a flying ship by one fixed step.
 * @param {Ship} ship mutated in place
 * @param {Controls} controls
 * @param {Site} site
 * @param {number} time seconds since the site began, for the wind
 * @param {number} h step length in seconds
 * @param {number} [ceiling] above this, upward speed is damped away
 * @returns {Touchdown | null}
 */
export function stepShip(ship, controls, site, time, h, ceiling = Infinity) {
  if (ship.state !== "flying") return null;

  // Spin and throttle ease toward their targets, so taps feel weighty.
  const spinTarget = ((controls.right ? 1 : 0) - (controls.left ? 1 : 0)) * TURN_RATE;
  const throttleTarget = controls.thrust && ship.fuel > 0 ? 1 : 0;
  ship.spin += (spinTarget - ship.spin) * Math.min(1, h * 11);
  ship.angle += ship.spin * h;
  ship.angle = Math.atan2(Math.sin(ship.angle), Math.cos(ship.angle));
  const rate = throttleTarget > ship.throttle ? 8 : 13;
  ship.throttle += (throttleTarget - ship.throttle) * Math.min(1, h * rate);
  ship.fuel = Math.max(0, ship.fuel - BURN * ship.throttle * h);

  const thrust = THRUST * ship.throttle;
  ship.vx += (Math.sin(ship.angle) * thrust + windAt(site, time)) * h;
  ship.vy += (Math.cos(ship.angle) * thrust - GRAVITY) * h;
  ship.x += ship.vx * h;
  ship.y += ship.vy * h;
  if (ship.y > ceiling && ship.vy > 0) ship.vy *= 1 - Math.min(1, h * 4);

  const cos = Math.cos(ship.angle);
  const sin = Math.sin(ship.angle);
  let hit = false;
  let bodyHit = false;
  for (let i = 0; i < HULL.length; i++) {
    const [lx, ly] = HULL[i];
    const wx = ship.x + lx * cos + ly * sin;
    const wy = ship.y - lx * sin + ly * cos;
    if (wy <= groundAt(site, wx)) {
      hit = true;
      if (i > 1) bodyHit = true;
    }
  }

  if (hit) {
    ship.plumeReach = 999;
    const pad = padUnder(
      site,
      ship.x - FOOT_SPAN * cos - FOOT_DROP * sin,
      ship.x + FOOT_SPAN * cos - FOOT_DROP * sin,
    );
    const reason = judgeTouchdown(ship, pad, bodyHit);
    if (reason || !pad) {
      ship.state = "crashed";
      ship.throttle = 0;
      return { kind: "crash", reason: reason ?? "off" };
    }
    const { points, feather } = landingScore(pad, ship.fuel, ship.vy);
    ship.state = "landed";
    ship.y = pad.y + FOOT_DROP;
    ship.angle = 0;
    ship.spin = 0;
    ship.vx = 0;
    ship.vy = 0;
    ship.throttle = 0;
    return { kind: "land", pad, points, feather };
  }

  // Trace the plume down its axis so the UI can raise dust where it strikes.
  if (ship.throttle > PLUME_THROTTLE) {
    const dirX = -sin;
    const dirY = -cos;
    const nozzleX = ship.x + dirX * 6;
    const nozzleY = ship.y + dirY * 6;
    let reach = 0;
    for (; reach < PLUME_SEARCH; reach += PLUME_STEP) {
      if (nozzleY + dirY * reach <= groundAt(site, nozzleX + dirX * reach)) break;
    }
    ship.plumeReach = reach;
  } else {
    ship.plumeReach = 999;
  }
  return null;
}

/**
 * Height of the feet above the ground directly below the ship.
 * @param {Pick<Ship, "x" | "y">} ship
 * @param {Site} site
 */
export function altitudeOf(ship, site) {
  return Math.max(0, ship.y - FOOT_DROP - groundAt(site, ship.x));
}

/**
 * Gap between the feet and the highest ground under the ship, which drives
 * the camera's zoom.
 * @param {Pick<Ship, "x" | "y">} ship
 * @param {Site} site
 */
export function clearance(ship, site) {
  const ground = Math.max(
    groundAt(site, ship.x),
    groundAt(site, ship.x - FOOT_SPAN),
    groundAt(site, ship.x + FOOT_SPAN),
  );
  return ship.y - FOOT_DROP - ground;
}

/**
 * How far to zoom in, 0 to 1, easing in as the ground comes up.
 * @param {number} c clearance
 */
export function zoomForClearance(c) {
  const t = clamp((c - 175) / (46 - 175), 0, 1);
  return t * t * (3 - 2 * t);
}
