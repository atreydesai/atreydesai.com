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

/**
 * Each site is one kind of moon. Site 1 is always the mare, the gentlest;
 * sites 2 to 6 visit the other five in a shuffled order, and after that whole
 * shuffled rounds of six follow, never the same kind twice in a row.
 * @typedef {"mare" | "highlands" | "craters" | "rille" | "mesas" | "dunes"} Terrain
 */
/** @type {ReadonlyArray<Terrain>} */
export const TERRAINS = ["mare", "highlands", "craters", "rille", "mesas", "dunes"];

/** Names by terrain, used in turn as a run revisits that kind of ground. */
/** @type {Readonly<Record<Terrain, ReadonlyArray<string>>>} */
export const SITE_NAMES = {
  mare: ["sea of tapioca", "mare oolong", "lacus matcha"],
  highlands: ["jasmine ridge", "montes assam", "the high steep"],
  craters: ["crater of second sips", "the quiet saucer", "brown sugar basin"],
  rille: ["rima chai", "the long pour", "vallis earl grey"],
  mesas: ["taro flats", "rupes rooibos", "the tea tables"],
  dunes: ["the foam drifts", "hojicha dunes", "the milk powder"],
};

/**
 * Ground within this far of either end of a coaster is never higher than
 * the coaster, so a ship can always come straight down onto it.
 */
export const PAD_APRON = 18;
/** No ground rises above this, so every start clears it. */
export const TERRAIN_TOP = 180;
const TERRAIN_FLOOR = 14;
/** Spacing of the sampled outline, before corners are added. */
const SAMPLE_STEP = 5;

/** How far the plume is traced looking for ground, and the step it takes. */
const PLUME_SEARCH = 95;
const PLUME_STEP = 3;
/** Below this throttle there is no plume to speak of. */
const PLUME_THROTTLE = 0.08;

/** @typedef {{ cx: number, y: number, width: number, multiplier: number }} Pad */
/**
 * Landforms a site was built from, for the scene to paint. Distances are in
 * world units, and every x is a centre on the wrapped world.
 * @typedef {{ kind: "peak", cx: number, half: number, height: number }
 *   | { kind: "crater", cx: number, r: number, floor: number, depth: number, rim: number }
 *   | { kind: "rille", cx: number, floorHalf: number, walls: [number, number], floorY: number }
 *   | { kind: "mesa", cx: number, half: number, top: number, cliff: number, talus: number }
 *   | { kind: "dunes", count: number, phase: number, crest: number }} Feature
 */
/**
 * @typedef {{
 *   n: number, name: string, terrain: Terrain, seed: number,
 *   points: Array<[number, number]>, pads: Pad[], features: Feature[],
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
 * Signed distance from c to x the short way round the wrapped world.
 * @param {number} x
 * @param {number} c
 */
function offset(x, c) {
  const d = wrap(x - c);
  return d > PERIOD / 2 ? d - PERIOD : d;
}

/** @param {number} t */
function smoothstep(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

/**
 * Bends heights over 150 smoothly toward TERRAIN_TOP instead of flattening
 * them against it.
 * @param {number} h
 */
function softTop(h) {
  const knee = 150;
  return h <= knee ? h : knee + (TERRAIN_TOP - knee) * Math.tanh((h - knee) / (TERRAIN_TOP - knee));
}

/**
 * @template T
 * @param {T[]} list shuffled in place
 * @param {() => number} random
 */
function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = (random() * (i + 1)) | 0;
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Periodic value noise in [0, 1] with `count` cells per period, so it wraps
 * without a seam. Linear joins give creased, rockier ridges.
 * @param {() => number} random
 * @param {number} count
 * @param {boolean} [creased]
 */
function periodic(random, count, creased = false) {
  const table = Array.from({ length: count }, () => random());
  /** @param {number} x */
  return (x) => {
    const f = (wrap(x) / PERIOD) * count;
    const i = Math.floor(f);
    const t = creased ? f - i : smoothstep(f - i);
    const a = table[i % count];
    return a + (table[(i + 1) % count] - a) * t;
  };
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
 * The run's route: which terrain each site has, from site 1 to n.
 * @param {number} n
 * @param {number} seed the run's seed
 * @returns {Terrain[]}
 */
function route(n, seed) {
  const random = createRng(seed ^ 0x2c1b3c6d);
  /** @type {Terrain[]} */
  const order = ["mare", ...shuffle(TERRAINS.filter((terrain) => terrain !== "mare"), random)];
  while (order.length < n) {
    const round = shuffle([...TERRAINS], random);
    if (round[0] === order[order.length - 1]) {
      const j = 1 + ((random() * (round.length - 1)) | 0);
      [round[0], round[j]] = [round[j], round[0]];
    }
    order.push(...round);
  }
  return order;
}

/**
 * The terrain of site n in the run with this seed.
 * @param {number} n
 * @param {number} seed
 */
export function terrainFor(n, seed) {
  return route(Math.max(1, n), seed)[Math.max(1, n) - 1];
}

/**
 * Points multiplier for landing at site n: ×1 at site 1, a quarter more for
 * each site after it, up to ×3 from site 9.
 * @param {number} n
 */
export function siteMultiplier(n) {
  return Math.min(3, 1 + 0.25 * (Math.max(1, n) - 1));
}

/**
 * How the ground meets a coaster: past the apron, higher ground climbs back
 * over `up` units; lower ground falls away over `down` units, per side.
 * @typedef {{ up: number, down: [number, number] }} Blend
 */
/**
 * A terrain's natural ground before the coasters are cut in. Profiles set
 * each pad's height, and list the corners the outline must keep sharp.
 * @typedef {{ height: (x: number) => number, blends: Blend[], corners: number[], features: Feature[] }} Profile
 */

/**
 * @param {number} up
 * @param {number} down
 * @returns {Blend}
 */
const blend = (up, down) => ({ up, down: [down, down] });

/**
 * Mare: a broad, low plain of long gentle swells. The ×5 sits in a shallow
 * dish.
 * @param {() => number} random
 * @param {Pad[]} pads
 * @returns {Profile}
 */
function mare(random, pads) {
  const swell = periodic(random, 3);
  const roll = periodic(random, 7);
  const ripple = periodic(random, 17);
  const grain = periodic(random, 43, true);
  /** @param {number} x */
  const height = (x) => 40 + 36 * swell(x) + 16 * roll(x) + 6 * ripple(x) + 2 * grain(x);
  for (const pad of pads) pad.y = height(pad.cx) - (pad.multiplier === 5 ? 8 : 0);
  return { height, blends: pads.map(() => blend(70, 60)), corners: [], features: [] };
}

/**
 * Highlands: jagged ridges between the coasters, which sit on benches cut
 * into the valley sides.
 * @param {() => number} random
 * @param {Pad[]} pads
 * @returns {Profile}
 */
function highlands(random, pads) {
  const base = periodic(random, 4);
  const crags = periodic(random, 29, true);
  const teeth = periodic(random, 71, true);
  const sorted = [...pads].sort((a, b) => a.cx - b.cx);
  /** @type {Array<Extract<Feature, { kind: "peak" }>>} */
  const peaks = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[(i + 1) % sorted.length];
    const from = a.cx + a.width / 2 + PAD_APRON + 14;
    let to = b.cx - b.width / 2 - PAD_APRON - 14;
    if (to < from) to += PERIOD;
    const count = to - from > 150 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const cx = wrap(from + (to - from) * ((k + 0.25 + random() * 0.5) / count));
      // A ridge's foot stays off every apron, so coasters sit in the valleys
      // and the slopes climb from there.
      const room = Math.min(
        ...pads.map((pad) => Math.abs(offset(cx, pad.cx)) - pad.width / 2 - PAD_APRON - 4),
      );
      const half = Math.min(34 + random() * 40, room);
      const height = Math.min(70 + random() * 55, half * 2.8);
      if (half >= 24) peaks.push({ kind: "peak", cx, half, height });
    }
  }
  /** @param {number} v */
  const ridged = (v) => 1 - Math.abs(v * 2 - 1);
  /** @param {number} x */
  const height = (x) => {
    let ridge = 0;
    for (const peak of peaks) {
      const t = 1 - Math.abs(offset(x, peak.cx)) / peak.half;
      if (t > 0) ridge = Math.max(ridge, peak.height * Math.pow(t, 0.9));
    }
    return 48 + 28 * base(x) + ridge * (0.78 + 0.34 * ridged(crags(x))) + (5 + ridge * 0.17) * ridged(teeth(x));
  };
  for (const pad of pads) pad.y = height(pad.cx) * (pad.multiplier === 5 ? 0.85 : 1);
  return { height, blends: pads.map(() => blend(16, 22)), corners: [], features: peaks };
}

/**
 * Crater field: the ground is cut by bowls with raised rims. One ×5 sits on
 * a crater's flat floor; the other coasters sit on rims, a bowl beside them.
 * @param {() => number} random
 * @param {Pad[]} pads
 * @returns {Profile}
 */
function craters(random, pads) {
  const swell = periodic(random, 3);
  const roll = periodic(random, 9);
  const grain = periodic(random, 31);
  /** @param {number} x */
  const base = (x) => 76 + 22 * swell(x) + 8 * roll(x) + 2 * grain(x);
  /** @type {Array<Extract<Feature, { kind: "crater" }> & { flank: number }>} */
  const bowls = [];
  /**
   * Whether a bowl of radius r centred at c stays clear of every other
   * coaster's apron and every bowl already dug.
   * @param {number} c
   * @param {number} r
   * @param {Pad | null} owner
   */
  const fits = (c, r, owner) =>
    pads.every(
      (pad) => pad === owner || Math.abs(offset(c, pad.cx)) >= r + pad.width / 2 + PAD_APRON + 4,
    ) && bowls.every((bowl) => Math.abs(offset(c, bowl.cx)) >= r + bowl.r + 4);

  const fives = pads.filter((pad) => pad.multiplier === 5);
  const deep = fives[(random() * fives.length) | 0];
  const floor = deep.width / 2 + PAD_APRON + 4 + random() * 8;
  const deepR = floor + 30 + random() * 20;
  bowls.push({
    kind: "crater",
    cx: deep.cx,
    r: deepR,
    floor,
    depth: Math.min(46 + random() * 20, base(deep.cx) - 22),
    rim: 12 + random() * 8,
    flank: deepR * 0.6,
  });

  const blends = pads.map(() => blend(24, 26));
  /** Where each rim coaster's crest is, to read its height once dug. */
  /** @type {Map<Pad, number>} */
  const crests = new Map();
  for (const [index, pad] of pads.entries()) {
    if (pad === deep) continue;
    const sides = random() < 0.5 ? [-1, 1] : [1, -1];
    const wanted = 26 + random() * 28;
    const rim = 10 + random() * 8;
    const extra = random() * 8;
    placed: for (const side of sides) {
      const crest = pad.cx + side * (pad.width / 2 + 4);
      for (let r = wanted; r >= 18; r -= 2) {
        const cx = wrap(crest + side * r);
        if (!fits(cx, r, pad)) continue;
        bowls.push({ kind: "crater", cx, r, floor: 0, depth: 0.42 * r + extra, rim, flank: r * 0.6 });
        crests.set(pad, crest);
        // Sharp into the bowl, gentle down the rim's outer side.
        blends[index] = { up: 24, down: side < 0 ? [6, 26] : [26, 6] };
        break placed;
      }
    }
  }
  // A few smaller craters wherever there is room.
  for (let tries = 0; tries < 24 && bowls.length < pads.length + 4; tries++) {
    const r = 12 + random() * 22;
    const cx = random() * PERIOD;
    if (fits(cx, r * 1.1, null)) {
      bowls.push({ kind: "crater", cx, r, floor: 0, depth: 0.38 * r + random() * 6, rim: 5 + random() * 7, flank: r * 0.6 });
    }
  }

  /** @param {number} x */
  const height = (x) => {
    let h = base(x);
    for (const bowl of bowls) {
      const d = Math.abs(offset(x, bowl.cx));
      if (d < bowl.r) {
        const t = d <= bowl.floor ? 0 : (d - bowl.floor) / (bowl.r - bowl.floor);
        h += -bowl.depth + (bowl.depth + bowl.rim) * t * t;
      } else if (d < bowl.r + bowl.flank) {
        const u = 1 - (d - bowl.r) / bowl.flank;
        h += bowl.rim * u * u;
      }
    }
    return h;
  };
  for (const pad of pads) {
    const crest = crests.get(pad);
    pad.y = crest === undefined ? height(pad.cx) : height(crest);
  }
  const corners = bowls.flatMap((bowl) => [bowl.cx - bowl.r, bowl.cx + bowl.r]);
  const features = bowls.map(({ kind, cx, r, floor, depth, rim }) => ({ kind, cx, r, floor, depth, rim }));
  return { height, blends, corners, features };
}

/**
 * Rille: a deep trench crosses the site with a ×5 on its floor and the other
 * coasters on the banks either side.
 * @param {() => number} random
 * @param {Pad[]} pads
 * @returns {Profile}
 */
function rille(random, pads) {
  const swell = periodic(random, 3);
  const roll = periodic(random, 8);
  const grain = periodic(random, 29);
  /** @param {number} x */
  const bank = (x) => 104 + 34 * swell(x) + 10 * roll(x) + 3 * grain(x);
  const fives = pads.filter((pad) => pad.multiplier === 5);
  const deep = fives[(random() * fives.length) | 0];
  const floorHalf = deep.width / 2 + PAD_APRON + 5 + random() * 10;
  /** @type {[number, number]} */
  const walls = [26 + random() * 22, 26 + random() * 22];
  const floorY = 20 + random() * 10;
  const levee = 4 + random() * 5;
  // One wall steps down to a ledge partway; the other drops in one go.
  const ledgeSide = random() < 0.5 ? 0 : 1;
  const ledgeAt = 0.38 + random() * 0.14;
  const ledgeWidth = 0.14 + random() * 0.08;
  const ledgeLevel = 0.4 + random() * 0.15;

  /**
   * @param {number} t 0 at the floor, 1 at the lip
   * @param {number} side 0 left, 1 right
   */
  const wall = (t, side) => {
    if (side !== ledgeSide) return Math.pow(t, 1.5);
    if (t < ledgeAt) return ledgeLevel * Math.pow(t / ledgeAt, 1.4);
    if (t < ledgeAt + ledgeWidth) return ledgeLevel;
    const u = Math.max(0, (t - ledgeAt - ledgeWidth) / (1 - ledgeAt - ledgeWidth));
    return ledgeLevel + (1 - ledgeLevel) * Math.pow(u, 1.4);
  };
  /** @param {number} x */
  const height = (x) => {
    const d = offset(x, deep.cx);
    const a = Math.abs(d);
    if (a <= floorHalf) return floorY;
    const side = d < 0 ? 0 : 1;
    const run = walls[side];
    const top = bank(x);
    if (a < floorHalf + run) return floorY + (top + levee - floorY) * wall((a - floorHalf) / run, side);
    // A low levee lines the lip, as if the rille's edge were thrown up.
    const u = Math.max(0, 1 - (a - floorHalf - run) / 26);
    return top + levee * u * u;
  };
  for (const pad of pads) pad.y = height(pad.cx);
  const blends = pads.map((pad) => (pad === deep ? blend(4, 4) : blend(30, 30)));
  /** @type {number[]} */
  const corners = [];
  for (const side of [-1, 1]) {
    const run = walls[side < 0 ? 0 : 1];
    corners.push(deep.cx + side * floorHalf, deep.cx + side * (floorHalf + run));
    if ((side < 0 ? 0 : 1) === ledgeSide) {
      corners.push(
        deep.cx + side * (floorHalf + run * ledgeAt),
        deep.cx + side * (floorHalf + run * (ledgeAt + ledgeWidth)),
      );
    }
  }
  return {
    height,
    blends,
    corners,
    features: [{ kind: "rille", cx: deep.cx, floorHalf, walls, floorY }],
  };
}

/**
 * Mesas: flat-topped plateaus with near-vertical sides over low ground. Two
 * or three coasters sit on the tops; the rest, always including a ×5, sit
 * below between them.
 * @param {() => number} random
 * @param {Pad[]} pads
 * @returns {Profile}
 */
function mesas(random, pads) {
  const swell = periodic(random, 4);
  const roll = periodic(random, 13);
  /** @param {number} x */
  const low = (x) => 28 + 16 * swell(x) + 5 * roll(x);
  /** @type {Array<Extract<Feature, { kind: "mesa" }>>} */
  const tables = [];
  /**
   * @param {number} cx
   * @param {number} half
   */
  const mesa = (cx, half) => ({
    kind: /** @type {const} */ ("mesa"),
    cx: wrap(cx),
    half,
    top: 0,
    cliff: 3 + random() * 3,
    talus: 7 + random() * 8,
  });
  const order = shuffle([...pads], random);
  const fives = order.filter((pad) => pad.multiplier === 5);
  const tops = random() < 0.35 ? 3 : 2;
  /** @type {Set<Pad>} */
  const below = new Set([fives[0]]);
  /** @type {Set<Pad>} */
  const above = new Set();
  for (const pad of order) {
    if (below.has(pad)) continue;
    if (above.size < tops) above.add(pad);
    else below.add(pad);
  }
  for (const pad of pads) {
    if (!above.has(pad)) continue;
    const half = pad.width / 2 + 6 + random() * 18;
    const room = half - pad.width / 2 - 3;
    const table = mesa(pad.cx + (random() - 0.5) * 2 * room, half);
    // Under the soft ceiling, so a top is exactly as high as it says.
    table.top = 116 + random() * 34;
    tables.push(table);
    pad.y = table.top;
  }
  // Buttes without coasters fill some of the low ground between, never
  // close enough to crowd a coaster below.
  /** @type {Array<[number, number]>} */
  const taken = [
    ...[...below].map((pad) => /** @type {[number, number]} */ ([pad.cx, pad.width / 2 + PAD_APRON + 30])),
    ...tables.map((t) => /** @type {[number, number]} */ ([t.cx, t.half + t.cliff + t.talus + 6])),
  ].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < taken.length; i++) {
    const [ac, ar] = taken[i];
    const [bc, br] = taken[(i + 1) % taken.length];
    const from = ac + ar;
    let to = bc - br;
    if (i === taken.length - 1) to += PERIOD;
    const gap = to - from;
    if (gap < 46 || random() < 0.2) continue;
    const half = Math.max(7, Math.min(44, random() * (gap / 2 - 22)));
    const table = mesa((from + to) / 2 + (random() - 0.5) * (gap - 2 * half - 40) * 0.5, half);
    if (2 * (half + table.cliff + table.talus) > gap) continue;
    table.top = 84 + random() * 66;
    tables.push(table);
  }

  /** @param {number} x */
  const height = (x) => {
    const ground = low(x);
    let h = ground;
    for (const t of tables) {
      const a = Math.abs(offset(x, t.cx)) - t.half;
      if (a > t.cliff + t.talus) continue;
      const foot = ground + (t.top - ground) * 0.16;
      let v;
      if (a <= 0) v = t.top;
      else if (a <= t.cliff) v = t.top + (foot - t.top) * (a / t.cliff);
      else {
        const u = 1 - (a - t.cliff) / t.talus;
        v = ground + (foot - ground) * u * u;
      }
      h = Math.max(h, v);
    }
    return h;
  };
  for (const pad of below) pad.y = height(pad.cx);
  const blends = pads.map((pad) => (above.has(pad) ? blend(3, 2) : blend(24, 24)));
  const corners = tables.flatMap((t) =>
    [t.half, t.half + t.cliff, t.half + t.cliff + t.talus].flatMap((d) => [t.cx - d, t.cx + d]),
  );
  return { height, blends, corners, features: tables };
}

/**
 * Dunes of dust: smooth, low, rounded ridges in a steady rhythm, each with
 * a shorter face turned from the sun and a long gentle back.
 * @param {() => number} random
 * @param {Pad[]} pads
 * @returns {Profile}
 */
function dunes(random, pads) {
  const count = 7 + Math.floor(random() * 4);
  const phase = random();
  const crest = 0.45;
  const swell = periodic(random, 2);
  const size = periodic(random, 5);
  /** @param {number} x */
  // Rounded at crest and trough alike: a short face up, a long back down.
  const wave = (x) => {
    const p = ((wrap(x) / PERIOD) * count + phase) % 1;
    const t = p < crest ? p / crest : 1 - (p - crest) / (1 - crest);
    return 0.5 - 0.5 * Math.cos(Math.PI * t);
  };
  /** @param {number} x */
  const height = (x) => 38 + 24 * swell(x) + (14 + 20 * size(x)) * wave(x);
  for (const pad of pads) pad.y = height(pad.cx);
  return {
    height,
    blends: pads.map(() => blend(45, 35)),
    corners: [],
    features: [{ kind: "dunes", count, phase, crest }],
  };
}

/** @type {Record<Terrain, (random: () => number, pads: Pad[]) => Profile>} */
const PROFILES = { mare, highlands, craters, rille, mesas, dunes };

/** Coaster widths by multiplier: richer coasters are narrower. */
/** @type {Record<number, number>} */
const PAD_WIDTH = { 2: 74, 3: 52, 5: 38 };

/**
 * Builds landing site n (1-based) of the run with this seed: one kind of
 * terrain with four flat coasters cut into it. Later sites get narrower
 * coasters, smaller tanks and stronger wind.
 * @param {number} n
 * @param {number} seed the run's seed; each site derives its own from it
 * @param {Terrain} [terrain] to build a given kind of ground instead of the route's
 * @returns {Site}
 */
export function makeSite(n, seed, terrain) {
  const plan = route(n, seed);
  const kind = terrain ?? plan[n - 1];
  const visits = plan.slice(0, n - 1).filter((t) => t === kind).length;
  const siteSeed = (seed + n * 7919) | 0;
  const random = createRng(siteSeed);

  const shrink = Math.max(0.6, 1 - 0.075 * (n - 1));
  const multipliers = shuffle([2, 3, 5, n > 3 ? 5 : 2], random);
  const slot = PERIOD / 4;
  /** @type {Pad[]} */
  const pads = multipliers.map((multiplier, i) => ({
    cx: slot * (i + 0.5) + (random() - 0.5) * slot * 0.36,
    y: 0,
    width: Math.max(29, PAD_WIDTH[multiplier] * shrink),
    multiplier,
  }));

  const profile = PROFILES[kind](random, pads);
  /** @param {number} x */
  const natural = (x) => clamp(softTop(profile.height(x)), TERRAIN_FLOOR, TERRAIN_TOP);
  for (const pad of pads) pad.y = clamp(softTop(pad.y), 18, 166);

  // Cut the coasters in: flat across the coaster, never above it across the
  // apron, then back to the natural ground.
  /** @param {number} x */
  const groundHeight = (x) => {
    let h = natural(x);
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      const d = offset(x, pad.cx);
      const out = Math.abs(d) - pad.width / 2;
      if (out <= 0) return pad.y;
      const { up, down } = profile.blends[i];
      const rise = h - pad.y;
      h = pad.y + rise * (rise > 0 ? smoothstep((out - PAD_APRON) / up) : smoothstep(out / down[d < 0 ? 0 : 1]));
    }
    return h;
  };

  /** @type {Array<[number, number]>} */
  const fixed = [];
  for (const pad of pads) {
    fixed.push([pad.cx - pad.width / 2, pad.y], [pad.cx + pad.width / 2, pad.y]);
    for (const side of [-1, 1]) {
      const x = pad.cx + side * (pad.width / 2 + PAD_APRON);
      fixed.push([x, groundHeight(x)]);
    }
  }
  for (const x of profile.corners) fixed.push([x, groundHeight(x)]);
  const onPad = (/** @type {number} */ x) =>
    pads.some((pad) => Math.abs(offset(x, pad.cx)) < pad.width / 2 + 1e-9);
  // The coasters' own corners always stay; a landform's corner on a coaster
  // would only be flattened, so it goes.
  /** @type {Array<[number, number]>} */
  const kept = fixed
    .filter(([x], index) => index < pads.length * 4 || !onPad(x))
    .map(([x, y]) => [wrap(x), y]);
  /** @type {Array<[number, number]>} */
  let points = [...kept];
  for (let i = 0; i < PERIOD / SAMPLE_STEP; i++) {
    const x = wrap((i + (random() - 0.5) * 0.5) * SAMPLE_STEP);
    if (onPad(x) || kept.some(([kx]) => Math.abs(offset(x, kx)) < 1.2)) continue;
    points.push([x, groundHeight(x)]);
  }
  points.sort((a, b) => a[0] - b[0]);
  points = points.filter((p, index) => index === 0 || p[0] - points[index - 1][0] > 0.05);

  const direction = random() < 0.5 ? -1 : 1;
  const wind = n < 2 ? 0 : direction * Math.min(6.5, 1.4 + 0.9 * (n - 2));
  const names = SITE_NAMES[kind];
  return {
    n,
    name: names[visits % names.length],
    terrain: kind,
    seed: siteSeed,
    points,
    pads,
    features: profile.features,
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
  // The last point at or before xm.
  let low = 0;
  let high = last;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (points[mid][0] <= xm) low = mid;
    else high = mid - 1;
  }
  const i = low;
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
 * Points for a landing: leftover tea counts, scaled by the pad, then the
 * whole by the site's multiplier, rounded.
 * @param {Pad} pad
 * @param {number} fuel
 * @param {number} vy descent speed at touchdown
 * @param {number} [multiplier] the site's, from siteMultiplier
 */
export function landingScore(pad, fuel, vy, multiplier = 1) {
  const feather = Math.abs(vy) <= FEATHER_VY;
  const points = Math.round(
    (pad.multiplier * (50 + Math.round(fuel)) + (feather ? pad.multiplier * FEATHER_BONUS : 0)) * multiplier,
  );
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
    const { points, feather } = landingScore(pad, ship.fuel, ship.vy, siteMultiplier(site.n));
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
